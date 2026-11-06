const {mkdir,writeFile}=require('node:fs/promises');
const {resolve}=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out=resolve(__dirname),baseUrl=process.argv[2]||'http://127.0.0.1:3192';
(async()=>{
 await mkdir(out,{recursive:true});
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE_PATH?{executablePath:process.env.CHROME_EXECUTABLE_PATH}:{})});
 const checks=[],errors=[];
 try{
  const page=await browser.newPage({viewport:{width:1120,height:1100},locale:'zh-CN',timezoneId:'Asia/Shanghai'});
  await page.clock.install({time:new Date('2026-11-06T12:00:00+08:00')});
  let empty=false;
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push(m.text())});
  await page.route('**/api/records',async route=>{const response=await route.fetch(),json=await response.json();json.records=empty?[]:json.records.filter(x=>x.type==='daily').slice(0,1).map(x=>({...x,id:'screenshot-draft',period:'2026-11-05',status:'draft'}));assert.ok(empty||json.records.length===1,'requires an isolated fixture with one daily record');await route.fulfill({response,json})});
  await page.goto(baseUrl,{waitUntil:'networkidle'});await page.locator('#rail-toggle').click();await page.evaluate(()=>document.fonts.ready);
  const inspect=()=>page.evaluate(()=>{
   const cal=document.querySelector('.stage-calendar'),box=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};
   const headers=[...cal.querySelectorAll('.rdp-weekday')].map(box),weekRows=[...cal.querySelectorAll('.rdp-week')];
   const days=[...cal.querySelectorAll('[data-calendar-date]')].map(e=>({date:e.dataset.calendarDate,box:box(e),cell:box(e.parentElement),row:weekRows.indexOf(e.closest('.rdp-week')),column:Number(getComputedStyle(e.parentElement).gridColumnStart),texts:e.querySelector('.stage-day-number').textContent}));
   return{width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,headers,days,rows:weekRows.map(e=>({...box(e),count:e.children.length})),tableTags:cal.querySelectorAll('table,thead,tbody,tr,td,th').length,legend:box(cal.querySelector('.stage-calendar-legend')),title:box(cal.querySelector('#calendar-paper-title'))};
  });
  function validate(data,label,{allowTable=false,normal=true}={}){
   const month=data.days[0].date.slice(0,7),[year,m]=month.split('-').map(Number),total=new Date(Date.UTC(year,m,0)).getUTCDate();
   assert.equal(data.overflow,false,label+' document overflow');if(!allowTable)assert.equal(data.tableTags,0,label+' has no native table subtree');
   assert.equal(data.rows.length,6);if(normal)assert.ok(data.rows.every(r=>r.count===7));
   assert.ok(data.rows.every(r=>r.h>=40),label+' empty weeks retain their height');
   assert.equal(data.days.length,total);assert.equal(new Set(data.days.map(d=>d.date)).size,total);assert.equal(data.days.filter(d=>d.texts==='1').length,1);
   for(const day of data.days){
    const [y,m,d]=day.date.split('-').map(Number),column=(new Date(Date.UTC(y,m-1,d)).getUTCDay()+6)%7,header=data.headers[column];
    assert.ok(Math.abs((day.box.x+day.box.w/2)-(header.x+header.w/2))<1,label+' '+day.date+' aligns to civil weekday '+column);
    assert.ok(day.box.x>=day.cell.x-1&&day.box.right<=day.cell.right+1,label+' day inside its own cell');
    const firstColumn=(new Date(Date.UTC(y,m-1,1)).getUTCDay()+6)%7,row=Math.floor((firstColumn+d-1)/7),rowBox=data.rows[row];
    assert.equal(day.row,row,label+' '+day.date+' stays in its civil week');
    assert.ok(day.box.y>=rowBox.y-1&&day.box.bottom<=rowBox.bottom+1,label+' date is painted inside its week row');
   }
   checks.push({label,month,dates:total,rows:6,firstColumn:data.days[0].column,noOverflow:true});
  }
  for(const width of [1280,1120,1100,960,821,820,390,320]){
   await page.setViewportSize({width,height:1100});const data=await inspect();validate(data,'normal-'+width);
   if([1120,390].includes(width))await page.locator('.calendar-paper').screenshot({path:resolve(out,`fixed-${width}.png`)});
  }
  await page.setViewportSize({width:1120,height:1100});
  assert.ok(await page.locator('.stage-calendar-cell[data-hidden="true"]').count()>0);
  const fault=await page.addStyleTag({content:'.stage-calendar .stage-calendar-cell[data-hidden="true"]{display:none!important}'});
  assert.equal(await page.locator('.stage-calendar-cell[data-hidden="true"]').first().evaluate(e=>getComputedStyle(e).display),'none','fault actually collapses placeholders');
  validate(await inspect(),'collapsed-blank-cells');await page.locator('.calendar-paper').screenshot({path:resolve(out,'fixed-collapsed-blank-cells.png')});
  await fault.evaluate(e=>e.remove());
  const previous=page.getByRole('button',{name:'上个月',exact:true}),next=page.getByRole('button',{name:'下个月',exact:true});
  for(let i=0;i<10;i++)await previous.click();
  for(let i=0;i<27;i++){
   validate(await inspect(),'month-'+i);
   await next.focus();const handle=await next.elementHandle();await next.click();assert.equal(await page.evaluate(e=>e===document.activeElement,handle),true,'month button focus retained');
  }
  await page.locator('.stage-return-month').click();validate(await inspect(),'return-to-current');
  for(const zoom of [0.8,1,1.1,1.25,1.5]){
   await page.evaluate(z=>document.body.style.zoom=z,zoom);validate(await inspect(),'zoom-'+zoom);
   if([1.25,1.5].includes(zoom))await page.locator('.calendar-paper').screenshot({path:resolve(out,`fixed-zoom-${zoom}.png`)});
  }
  await page.evaluate(()=>document.body.style.zoom='1');
  const record=page.locator('[data-calendar-record="screenshot-draft"]');await record.click();await page.getByRole('button',{name:'退出复盘',exact:true}).click();
  await page.locator('.stage-calendar').waitFor();assert.equal(await page.evaluate(()=>document.activeElement.dataset.calendarDate),'2026-11-05');
  validate(await inspect(),'record-return');
  await page.emulateMedia({reducedMotion:'reduce'});validate(await inspect(),'reduced-motion');
  await page.setViewportSize({width:1280,height:1000});await page.locator('.workspace-calendar').screenshot({path:resolve(out,'fixed-layout.png')});
  empty=true;await page.reload({waitUntil:'networkidle'});await page.locator('#rail-toggle').click();
  for(const width of [1120,390,320]){await page.setViewportSize({width,height:1100});validate(await inspect(),'empty-'+width)}
  await page.setViewportSize({width:1120,height:1100});
  await page.addStyleTag({content:'.stage-calendar .stage-calendar-cell[data-hidden="true"]{display:none!important}'});
  validate(await inspect(),'empty-collapsed-blank-cells');
  assert.deepEqual(errors,[]);
  const ax=await page.locator('.stage-calendar').ariaSnapshot();assert.ok(ax.includes('grid "2026年11月"'));assert.ok(ax.includes('gridcell'));assert.ok(ax.includes('星期日'));
  await writeFile(resolve(out,'final-checks.json'),JSON.stringify({chrome:browser.version(),checks,errors,aria:ax},null,2));
  console.log(JSON.stringify({chrome:browser.version(),checks:checks.length,errors,passed:true},null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
