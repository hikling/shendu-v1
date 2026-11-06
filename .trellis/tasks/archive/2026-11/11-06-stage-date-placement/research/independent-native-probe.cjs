const {createRequire}=require('node:module');
const {readFile,writeFile}=require('node:fs/promises');
const {resolve}=require('node:path');
const {createHash}=require('node:crypto');
const {chromium}=createRequire('C:/Users/007/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json')('playwright');
const repo=resolve(__dirname,'../../../..');
const box=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,cx:r.x+r.width/2}};
const variants={normal:'',hiddenNone:'.stage-calendar .rdp-day[data-hidden="true"]{display:none!important}',hiddenCollapse:'.stage-calendar .rdp-day[data-hidden="true"]{visibility:collapse!important}',nativeRows:'.stage-calendar .rdp-week,.stage-calendar .rdp-weekdays{display:table-row!important}',nativeCells:'.stage-calendar .rdp-day,.stage-calendar .rdp-weekday{display:table-cell!important}',nativeSections:'.stage-calendar .rdp-month_grid thead{display:table-header-group!important}.stage-calendar .rdp-month_grid tbody{display:table-row-group!important}'};
(async()=>{
 const js=await readFile(resolve(repo,'shendu/public/ui/shadcn.js'),'utf8'),css=await readFile(resolve(repo,'shendu/public/ui/shadcn.css'),'utf8'),app=await readFile(resolve(repo,'shendu/public/app.js'),'utf8');
 const results=[];
 for(const [engine,executablePath]of Object.entries({chrome:'C:/Program Files/Google/Chrome/Application/chrome.exe',edge:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'})){
  const browser=await chromium.launch({headless:true,executablePath});
  try{
   for(const [variant,rule]of Object.entries(variants)){
    if(engine==='chrome'&&variant==='hiddenNone')continue;
    const context=await browser.newContext({viewport:{width:1120,height:1000},locale:'zh-CN',timezoneId:'Asia/Shanghai'}),page=await context.newPage();
    await page.route('**/ui/shadcn.js?*',route=>route.fulfill({contentType:'text/javascript',body:js}));
    await page.route('**/ui/shadcn.css?*',route=>route.fulfill({contentType:'text/css',body:css}));
    await page.route('**/app.js?*',route=>route.fulfill({contentType:'text/javascript',body:app}));
    await page.route('**/api/records',async route=>{const response=await route.fetch(),body=await response.json();body.records=[];await route.fulfill({response,json:body})});
    await page.goto('http://127.0.0.1:3192',{waitUntil:'networkidle'});await page.locator('#rail-toggle').click();
    if(rule)await page.addStyleTag({content:rule});
    for(const width of variant==='normal'?[1120,821,390,320]:[1120]){
     await page.setViewportSize({width,height:1000});await page.waitForTimeout(70);
     const value=await page.evaluate(()=>{
      const b=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,cx:r.x+r.width/2}};
      const cal=document.querySelector('.stage-calendar'),heads=[...cal.querySelectorAll('.rdp-weekday')].map(b),dates=[...cal.querySelectorAll('[data-calendar-date]')];
      const placement=dates.map(e=>{const rect=b(e),[y,m,d]=e.dataset.calendarDate.split('-').map(Number),expected=(new Date(y,m-1,d,12).getDay()+6)%7;const distances=heads.map(h=>Math.abs(h.cx-rect.cx)),actual=distances.indexOf(Math.min(...distances));return{date:e.dataset.calendarDate,expected:expected+1,actual:actual+1,box:rect,spanRects:[...e.querySelector('.stage-day-number').getClientRects()].map(r=>({x:r.x,y:r.y,width:r.width}))}});
      return{width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,tableTag:cal.querySelector('.rdp-month_grid').tagName,first:placement[0],misplaced:placement.filter(x=>x.actual!==x.expected).map(x=>({date:x.date,expected:x.expected,actual:x.actual})),dateNodes:dates.length,unique:new Set(dates.map(e=>e.dataset.calendarDate)).size,oneNodes:dates.filter(e=>e.querySelector('.stage-day-number').textContent==='1').length,heads};
     });
     results.push({engine,version:browser.version(),variant,injected:!!rule,rule,...value});
     if(width===1120)await page.locator('.calendar-paper').screenshot({path:resolve(__dirname,`${engine}-${variant}.png`)});
    }
    await context.close();
   }
  }finally{await browser.close()}
 }
 await writeFile(resolve(__dirname,'native-probe.json'),JSON.stringify({bundleSha:createHash('sha256').update(js).digest('hex'),cssSha:createHash('sha256').update(css).digest('hex'),results},null,2));
 console.log(JSON.stringify(results.map(x=>({engine:x.engine,version:x.version,variant:x.variant,injected:x.injected,width:x.width,first:x.first?.actual,misplaced:x.misplaced.length,dateNodes:x.dateNodes,oneNodes:x.oneNodes})),null,2));
})().catch(error=>{console.error(error);process.exitCode=1});
