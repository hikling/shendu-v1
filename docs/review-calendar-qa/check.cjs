// Actual browser geometry against built components and an isolated read-only fixture.
const {mkdir,writeFile}=require('node:fs/promises');
const {resolve}=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {installCalendarTimezoneSpoof}=require('../../shendu/tests/helpers/calendar-timezone.cjs');
const base=process.argv[2]||'http://127.0.0.1:3192',baseline=process.argv.includes('--baseline'),out=__dirname;
const types=['daily','weekly','monthly','quarterly','yearly','decision'];
const today='2026-11-06';
async function inspect(page){return page.locator('#qa-picker').evaluate(root=>{
 const box=e=>{const b=e.getBoundingClientRect();return{x:b.x,y:b.y,w:b.width,h:b.height,right:b.right,bottom:b.bottom}};
 const rows=[...root.querySelectorAll('.rdp-week')];
 return{box:box(root),overflow:document.documentElement.scrollWidth>innerWidth,caption:root.querySelector('.rdp-caption_label').textContent,headers:[...root.querySelectorAll('.rdp-weekday')].map(e=>({text:e.textContent,...box(e)})),rows:rows.map(e=>({...box(e),count:e.children.length})),days:[...root.querySelectorAll('[data-verify-day]')].map(e=>({date:e.dataset.verifyDay,day:e.dataset.day,text:e.textContent,disabled:e.disabled,selected:e.getAttribute('aria-pressed'),row:rows.indexOf(e.closest('.rdp-week')),cell:box(e.parentElement),...box(e)})),value:root.querySelector('input').value,events:window.__qaEvents,months:window.__qaMonths};
})}
function validate(data,month,label){
 const [year,m]=month.split('-').map(Number),total=new Date(Date.UTC(year,m,0)).getUTCDate(),lead=(new Date(Date.UTC(year,m-1,1)).getUTCDay()+6)%7;
 assert.equal(data.overflow,false,label+' page overflow');assert.deepEqual(data.headers.map(h=>h.text),[...'一二三四五六日'],label+' weekday order');
 assert.equal(data.rows.length,6,label+' six weeks');assert.ok(data.rows.every(r=>r.count===7&&r.h>20),label+' six positive-height seven-cell rows');
 assert.equal(data.days.length,total,label+' unique civil date count');
 data.days.forEach((d,i)=>{
  const value=`${month}-${String(i+1).padStart(2,'0')}`,column=(lead+i)%7,row=Math.floor((lead+i)/7),header=data.headers[column],bounds=data.rows[row];
  assert.equal(d.date,value,label+' exact ordered date');assert.equal(d.day,value,label+' canonical DOM date');assert.equal(d.text,String(i+1));assert.equal(d.row,row);
  assert.ok(Math.abs(d.x+d.w/2-header.x-header.w/2)<1.5,label+' '+value+' weekday alignment');
  assert.ok(d.x>=data.box.x-1&&d.right<=data.box.right+1,label+' '+value+' inside picker');
  assert.ok(d.y>=bounds.y-1&&d.bottom<=bounds.bottom+1,label+' '+value+' inside week');
 });
 return{label,month,dates:total,rows:6,width:data.box.w,value:data.value};
}
async function fixture(page,mode){
 await page.route('**/api/**',async route=>{assert.equal(route.request().method(),'GET','browser QA never writes');await route.continue()});
 await page.goto(base,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
 await page.evaluate(async()=>{
  window.__qaUi=await import('/ui/shadcn.js');window.__qaPolicy=await import('/verification-policy.js');window.__qaDateLabel=(await import('/daily-calendar.js')).dailyCalendarDateLabel;
  document.getElementById('app').hidden=true;
  const root=document.createElement('main');root.id='qa-canvas';root.className='daily-art-flow';root.style.cssText='padding:40px 16px;display:flex;align-items:flex-start;justify-content:center';
  root.innerHTML='<div class="daily-date-picker" id="qa-picker"><input type="hidden" data-simple="verifyDate"><p class="daily-calendar-selection">未选择验证日期</p><div id="qa-calendar"></div></div>';document.body.append(root);
 });
}
async function mount(page,options){await page.evaluate(options=>{
 const root=document.getElementById('qa-calendar'),input=document.querySelector('#qa-picker input');window.__qaUi.disposeUi(root);root.replaceChildren();
 document.getElementById('qa-canvas').className='daily-art-flow'+(options.type&&options.type!=='daily'?' extended-review-flow type-'+options.type:'');
 input.value=options.value||'';window.__qaEvents=[];window.__qaMonths=[];const label=document.querySelector('#qa-picker .daily-calendar-selection');label.textContent=window.__qaDateLabel(input.value);input.oninput=()=>{window.__qaEvents.push(input.value);label.textContent=window.__qaDateLabel(input.value)};
 window.__qaUi.showVerificationCalendar(root,{today:'2026-11-06',minimum:'2024-01-01',month:'2026-11',value:'',locked:false,...options,canSelect:()=>!options.busy,onSelect:value=>{if(value!==input.value){input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}))}},onMonthChange:value=>window.__qaMonths.push(value)});
},options)}
async function stage(page,width){
 await page.setViewportSize({width,height:1100});await page.goto(base,{waitUntil:'networkidle'});await page.locator('#rail-toggle').click();await page.evaluate(()=>document.fonts.ready);
 const result=await page.locator('.calendar-workspace-grid').evaluate(root=>{
  const box=e=>{const b=e.getBoundingClientRect();return{x:b.x,y:b.y,w:b.width,h:b.height,right:b.right,bottom:b.bottom}};
  const paper=root.querySelector('.calendar-paper'),context=root.querySelector('.calendar-context'),cal=paper.querySelector('.stage-calendar');
  return{width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,spread:box(root),paper:box(paper),calendar:box(cal),context:box(context),grid:box(cal.querySelector('[role="grid"]')),title:box(cal.querySelector('#calendar-paper-title')),legend:box(cal.querySelector('.stage-calendar-legend'))};
 });
 assert.equal(result.overflow,false);if(width>820){assert.ok(Math.abs(result.paper.y-result.context.y)<1);assert.ok(Math.abs(result.paper.bottom-result.context.bottom)<1)}
 if(!baseline&&width>1050){assert.ok(result.paper.w<=621,'compact desktop card');assert.ok(result.calendar.w<=541,'compact calendar contents')}
 if([1440,390].includes(width))await page.locator('.calendar-workspace-grid').screenshot({path:resolve(out,`${baseline?'before':'after'}-stage-${width}.png`),style:'#site-header,#site-header *{visibility:hidden!important}'});
 return result;
}
(async()=>{
 await mkdir(out,{recursive:true});const results=[];
 for(const [browserName,path] of [['chrome',process.env.CHROME_EXECUTABLE_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'],['edge',process.env.EDGE_EXECUTABLE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']]){
  if(baseline&&browserName==='edge')continue;
  const browser=await chromium.launch({headless:true,executablePath:path});
  try{for(const mode of baseline?['partial-setters']:browserName==='chrome'?['normal','offset-only','local-getters','partial-setters']:['normal','partial-setters']){
   const context=await browser.newContext({viewport:{width:1280,height:950},locale:'zh-CN',timezoneId:'Asia/Shanghai'}),page=await context.newPage(),errors=[],checks=[];
   try{
    if(mode!=='normal')await context.addInitScript(installCalendarTimezoneSpoof,{mode,targetZone:'America/New_York'});
    page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push(m.text())});
    await fixture(page,mode);await mount(page,{month:'2026-11'});
    if(baseline){
     const data=await inspect(page);await page.locator('#qa-picker').screenshot({path:resolve(out,'before-verification-hostile.png')});
     checks.push({reproducedEightCellWeek:data.rows.some(r=>r.count===8),rowCellCounts:data.rows.map(r=>r.count),dates:data.days.map(d=>d.date)});
    }else{
     await mount(page,{month:'2025-09'});
     const next=page.getByRole('button',{name:'下个月',exact:true}),previous=page.getByRole('button',{name:'上个月',exact:true}),root=await page.locator('#qa-calendar [data-slot="calendar"]').elementHandle(),nextNode=await next.elementHandle();
     for(let index=0;index<30;index++){
      const n=2025*12+8+index,month=`${Math.floor(n/12)}-${String(n%12+1).padStart(2,'0')}`;
      checks.push(validate(await inspect(page),month,`${browserName}-${mode}-${month}`));
      await next.focus();await next.click();assert.ok(await page.evaluate(({root,nextNode})=>root===document.querySelector('#qa-calendar [data-slot="calendar"]')&&nextNode===document.activeElement,{root,nextNode}),'same root and focused month button');
     }
     assert.deepEqual((await inspect(page)).events,[],'browsing does not choose');
     for(const type of types){
      const minimum=await page.evaluate(({type,today})=>window.__qaPolicy.verificationMinimum(type,today),{type,today});
      await mount(page,{type,minimum,month:minimum.slice(0,7)});checks.push(validate(await inspect(page),minimum.slice(0,7),`${type}-minimum`));
      assert.equal((await inspect(page)).value,'');assert.ok((await inspect(page)).days.filter(d=>d.date<minimum).every(d=>d.disabled));
      await next.click();await page.locator('[data-verify-today]').click();assert.equal((await inspect(page)).value,minimum);assert.deepEqual((await inspect(page)).events,[minimum]);
      if(browserName==='chrome'&&mode==='partial-setters')await page.locator('#qa-picker').screenshot({path:resolve(out,`after-${type}-hostile.png`)});
     }
     await mount(page,{value:'2024-02-29',month:'2024-02',minimum:today,locked:true});checks.push(validate(await inspect(page),'2024-02','locked-leap-day'));assert.ok((await inspect(page)).days.every(d=>d.disabled));assert.equal((await inspect(page)).value,'2024-02-29');
     await mount(page,{minimum:today,month:'2026-11',busy:true});await page.locator('[data-verify-day="2026-11-07"]').click();assert.equal((await inspect(page)).value,'');
     for(const width of [820,390,320]){await page.setViewportSize({width,height:950});await mount(page,{minimum:today,month:'2026-11'});checks.push(validate(await inspect(page),'2026-11',`narrow-${width}`));await page.locator('[data-verify-day="2026-11-07"]').click();assert.deepEqual((await inspect(page)).events,['2026-11-07']);}
     if(browserName==='chrome'&&mode==='partial-setters')await page.locator('#qa-picker').screenshot({path:resolve(out,'after-verification-320.png')});
     await page.emulateMedia({reducedMotion:'reduce'});checks.push(validate(await inspect(page),'2026-11','reduced-motion'));
    }
    if(browserName==='chrome'&&mode==='partial-setters')for(const width of baseline?[1920,1440,1280,390]:[1920,1660,1440,1280,1100,1050,960,821,820,390,320])checks.push({stage:await stage(page,width)});
    assert.deepEqual(errors,[]);results.push({browser:browserName,version:browser.version(),mode,checks,errors,passed:!baseline});console.log(JSON.stringify({browser:browserName,mode,checks:checks.length,baseline,passed:!baseline}));
   }finally{await context.close()}
  }}finally{await browser.close()}
 }
 await writeFile(resolve(out,baseline?'baseline.json':'final-checks.json'),JSON.stringify({results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
