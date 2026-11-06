// Read-only integration: real history entry, every review prompt, original date field.
const {mkdir,writeFile}=require('node:fs/promises');
const {resolve}=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {installCalendarTimezoneSpoof}=require('../../shendu/tests/helpers/calendar-timezone.cjs');
const base=process.argv[2]||'http://127.0.0.1:3192',out=__dirname;
const types=['daily','weekly','monthly','quarterly','yearly','decision'];
async function history(page){
 const direct=page.locator('.header-link[data-nav="history"]');
 if(await direct.isVisible())await direct.click();
 else{await page.locator('#menu-toggle').click();await page.getByRole('menuitem',{name:'历史复盘',exact:true}).click()}
 await page.locator('.history-record[data-open-record]').first().waitFor();
}
async function inspect(page){return page.locator('.daily-date-picker').evaluate(root=>{
 const box=e=>{const b=e.getBoundingClientRect();return{x:b.x,y:b.y,w:b.width,h:b.height,right:b.right,bottom:b.bottom}};
 const picker=root.querySelector('.sd-verification-calendar'),rows=[...picker.querySelectorAll('.rdp-week')],field=root.querySelector('[data-simple="verifyDate"]');
 return{box:box(picker),overflow:document.documentElement.scrollWidth>innerWidth,value:field.value,disabled:field.disabled,caption:picker.querySelector('.rdp-caption_label').textContent,headers:[...picker.querySelectorAll('.rdp-weekday')].map(e=>({text:e.textContent,...box(e)})),rows:rows.map(e=>({...box(e),count:e.children.length})),days:[...picker.querySelectorAll('[data-verify-day]')].map(e=>({date:e.dataset.verifyDay,day:e.dataset.day,text:e.textContent,disabled:e.disabled,selected:e.getAttribute('aria-pressed'),row:rows.indexOf(e.closest('.rdp-week')),...box(e)})),events:window.__actualDateEvents};
})}
function validate(data,record,label){
 const month=record.data.verifyDate.slice(0,7),[year,m]=month.split('-').map(Number),total=new Date(Date.UTC(year,m,0)).getUTCDate(),lead=(new Date(Date.UTC(year,m-1,1)).getUTCDay()+6)%7;
 assert.equal(data.overflow,false,label+' page overflow');assert.equal(data.value,record.data.verifyDate,label+' original hidden value');assert.equal(data.disabled,true,label+' locked native field');
 assert.deepEqual(data.headers.map(h=>h.text),[...'一二三四五六日'],label+' weekday order');
 assert.equal(data.rows.length,6,label+' six weeks');assert.ok(data.rows.every(r=>r.count===7&&r.h>20),label+' six positive seven-cell rows');assert.equal(data.days.length,total,label+' unique civil dates');
 data.days.forEach((d,i)=>{
  const value=`${month}-${String(i+1).padStart(2,'0')}`,column=(lead+i)%7,row=Math.floor((lead+i)/7),header=data.headers[column],bounds=data.rows[row];
  assert.equal(d.date,value,label+' exact date');assert.equal(d.day,value,label+' canonical DOM date');assert.equal(d.text,String(i+1));assert.equal(d.row,row);assert.equal(d.disabled,true,label+' locked day');
  assert.ok(Math.abs(d.x+d.w/2-header.x-header.w/2)<1.5,label+' weekday alignment');assert.ok(d.x>=data.box.x-1&&d.right<=data.box.right+1,label+' within picker');assert.ok(d.y>=bounds.y-1&&d.bottom<=bounds.bottom+1,label+' within week');
 });
 assert.deepEqual(data.days.filter(d=>d.selected==='true').map(d=>d.date),[record.data.verifyDate],label+' saved date selected');assert.deepEqual(data.events,[],label+' no field edits');
 return{type:record.type,period:record.period,status:record.status,originalValue:record.data.verifyDate,hiddenValue:data.value,days:total,weeks:6,pickerWidth:data.box.w};
}
(async()=>{
 await mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'}),results=[];
 try{for(const [mode,width] of [['normal',1280],['partial-setters',390]]){
  const context=await browser.newContext({viewport:{width,height:1000},locale:'zh-CN',timezoneId:'Asia/Shanghai'}),page=await context.newPage(),errors=[],checks=[];let chosen=[];
  try{
   if(mode!=='normal')await context.addInitScript(installCalendarTimezoneSpoof,{mode,targetZone:'America/New_York'});
   page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push(m.text())});
   await page.route('**/api/**',async route=>{
    const request=route.request();assert.equal(request.method(),'GET','integration cannot write data');
    if(new URL(request.url()).pathname==='/api/records'){
     const response=await route.fetch(),json=await response.json();chosen=types.map(type=>json.records.find(r=>r.type===type&&['completed','verified'].includes(r.status)));
     assert.ok(chosen.every(Boolean),'fixture provides six locked categories');json.records=chosen;await route.fulfill({response,json});
    }else await route.continue();
   });
   await page.goto(base,{waitUntil:'networkidle'});await history(page);
   for(const type of types){
    const record=chosen.find(r=>r.type===type),card=page.locator(`.history-record.type-${type}[data-open-record]`);assert.equal(await card.count(),1);
    assert.equal(await card.getAttribute('data-open-record'),record.id);await card.click();await page.locator('#daily-start').click();
    await page.evaluate(()=>{window.__actualDateEvents=[];document.querySelector('[data-simple="verifyDate"]').addEventListener('input',event=>window.__actualDateEvents.push(event.target.value))});
    let steps=0;
    while(!await page.locator('[data-daily-prompt="verifyDate"]').isVisible()){
     assert.ok(steps++<40,type+' reaches date question');await page.locator('[data-daily-next]').click();
    }
    await page.evaluate(()=>document.fonts.ready);
    const data=await inspect(page);checks.push({...validate(data,record,`${mode}-${width}-${type}`),promptsVisited:steps+1});
    assert.equal(await page.locator('.sd-verification-calendar .rdp-button_previous').isDisabled(),true);assert.equal(await page.locator('.sd-verification-calendar .rdp-button_next').isDisabled(),true);
    await page.locator('.daily-date-picker').screenshot({path:resolve(out,`actual-${type}-${mode}-${width}.png`)});
    await page.getByRole('button',{name:'退出复盘',exact:true}).click();await page.locator('.history-record[data-open-record]').first().waitFor();
    assert.equal(await page.locator(`.history-record.type-${type}[data-open-record]`).getAttribute('data-open-record'),record.id,'exit returns to original history set');
   }
   assert.deepEqual(errors,[]);results.push({mode,width,checks,errors,passed:true});console.log(JSON.stringify({mode,width,categories:checks.length,passed:true}));
  }finally{await context.close()}
 }}finally{await browser.close()}
 await writeFile(resolve(out,'actual-flows.json'),JSON.stringify({browser:'Chrome',results,passed:true},null,2));
})().catch(error=>{console.error(error);process.exitCode=1});
