const {createRequire}=require('node:module');
const {writeFile}=require('node:fs/promises');
const {resolve}=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=createRequire('C:/Users/007/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json')('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const results=[];
 try{
  const page=await browser.newPage({viewport:{width:1120,height:1000},locale:'zh-CN',timezoneId:'Asia/Shanghai'});
  await page.clock.install({time:new Date('2026-11-06T12:00:00+08:00')});
  await page.route('**/api/records',async route=>{const response=await route.fetch(),body=await response.json();body.records=[];await route.fulfill({response,json:body})});
  await page.goto('http://127.0.0.1:3192',{waitUntil:'networkidle'});await page.locator('#rail-toggle').click();
  for(const collapsed of [false,true]){
   if(collapsed)await page.addStyleTag({content:'.stage-calendar .stage-calendar-cell[data-hidden="true"]{display:none!important}'});
   for(const width of [1120,821,390,320]){
    await page.setViewportSize({width,height:1000});
    const data=await page.evaluate(()=>{
     const cal=document.querySelector('.stage-calendar'),heads=[...cal.querySelectorAll('.rdp-weekday')].map(e=>{const r=e.getBoundingClientRect();return r.x+r.width/2});
     const bad=[...cal.querySelectorAll('[data-calendar-date]')].flatMap(e=>{const r=e.getBoundingClientRect(),[y,m,d]=e.dataset.calendarDate.split('-').map(Number),col=(new Date(y,m-1,d,12).getDay()+6)%7;return Math.abs(r.x+r.width/2-heads[col])>.8?[e.dataset.calendarDate]:[]});
     return{width:innerWidth,tableTags:cal.querySelectorAll('table,thead,tbody,tr,td,th').length,bad,dates:cal.querySelectorAll('[data-calendar-date]').length,rows:[...cal.querySelectorAll('.rdp-week')].map(e=>e.getBoundingClientRect().height),one:cal.querySelectorAll('[data-calendar-date="2026-11-01"]').length};
    });
    assert.equal(data.tableTags,0);assert.deepEqual(data.bad,[]);assert.equal(data.dates,30);assert.equal(data.one,1);assert.ok(data.rows.every(h=>h>=40));results.push({collapsed,...data});
   }
  }
  const next=page.getByRole('button',{name:'下个月',exact:true});await next.focus();const handle=await next.elementHandle();await next.click();assert.equal(await page.evaluate(e=>document.activeElement===e,handle),true);await next.click();assert.equal(await page.locator('.stage-calendar-year').textContent(),'2027年');
  await writeFile(resolve(__dirname,'final-edge-probe.json'),JSON.stringify({edge:browser.version(),results,focusRetained:true,crossYear:true},null,2));
  console.log('PASS Edge '+browser.version()+': stage-only div grid, every civil date column, normal/collapsed blank cells1120/821/390/320, six positive-height weeks, month focus and cross-year.');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
