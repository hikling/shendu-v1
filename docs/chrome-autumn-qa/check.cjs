// Run against an isolated authenticated fixture; never writes application data.
const {mkdir,writeFile}=require('node:fs/promises');
const {resolve}=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {installCalendarTimezoneSpoof}=require('../../shendu/tests/helpers/calendar-timezone.cjs');
const baseUrl=process.argv[2]||'http://127.0.0.1:3192',out=__dirname;

async function inspect(page){return page.evaluate(()=>{
  const calendar=document.querySelector('.stage-calendar');
  if(!calendar)return {missing:true};
  const box=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};
  const rows=[...calendar.querySelectorAll('.rdp-week')];
  return {month:calendar.querySelector('[role="grid"]').getAttribute('aria-label'),
    headers:[...calendar.querySelectorAll('.rdp-weekday')].map(e=>({text:e.textContent,...box(e)})),
    rows:rows.map(e=>({...box(e),count:e.children.length})),
    days:[...calendar.querySelectorAll('[data-calendar-date]')].map(e=>({date:e.dataset.calendarDate,text:e.querySelector('.stage-day-number').textContent,lunar:e.querySelector('.stage-day-lunar').textContent,column:Number(getComputedStyle(e.parentElement).gridColumnStart),row:rows.indexOf(e.closest('.rdp-week')),box:box(e)})),
    overflow:document.documentElement.scrollWidth>innerWidth};
})}
function validate(data,expected,label){
  assert.equal(data.missing,undefined,label+' calendar exists');
  assert.equal(data.month,`${expected.y}年${expected.m}月`,label+' displayed civil month');
  assert.deepEqual(data.headers.map(h=>h.text),[...'一二三四五六日'],label+' weekday headings');
  assert.equal(data.rows.length,6,label+' exactly six weeks');
  assert.ok(data.rows.every(r=>r.count===7&&r.h>=40),label+' no accumulated/empty-height rows');
  assert.equal(data.overflow,false,label+' no horizontal overflow');
  const total=new Date(Date.UTC(expected.y,expected.m,0)).getUTCDate();
  assert.equal(data.days.length,total,label+' date count');
  const firstColumn=(new Date(Date.UTC(expected.y,expected.m-1,1)).getUTCDay()+6)%7;
  data.days.forEach((day,i)=>{
    const value=`${expected.y}-${String(expected.m).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`;
    assert.equal(day.date,value,label+' date sequence');assert.equal(day.text,String(i+1));assert.ok(day.lunar,label+' lunar annotation');
    const column=(firstColumn+i)%7,row=Math.floor((firstColumn+i)/7),header=data.headers[column],bounds=data.rows[row];
    assert.equal(day.column,column+1);assert.equal(day.row,row);
    assert.ok(Math.abs((day.box.x+day.box.w/2)-(header.x+header.w/2))<1,label+' '+value+' weekday position');
    assert.ok(day.box.y>=bounds.y-1&&day.box.bottom<=bounds.bottom+1,label+' '+value+' inside actual week row');
  });
  return {label,month:data.month,dates:total,weeks:data.rows.length};
}
const shift=(value,amount)=>{const n=value.y*12+value.m-1+amount;return{y:Math.floor(n/12),m:n%12+1}};

(async()=>{
 await mkdir(out,{recursive:true});
 const results=[];
 for(const [name,path] of [['chrome',process.env.CHROME_EXECUTABLE_PATH],['edge',process.env.EDGE_EXECUTABLE_PATH]]){
  if(!path)continue;
  const browser=await chromium.launch({headless:true,executablePath:path});
  try{for(const mode of name==='chrome'?['normal','offset-only','local-getters','partial-setters']:['normal','partial-setters']){
    const context=await browser.newContext({viewport:{width:1440,height:1100},locale:'zh-CN',timezoneId:'Asia/Shanghai'}),page=await context.newPage(),errors=[],checks=[];
    try{
      if(mode!=='normal')await context.addInitScript(installCalendarTimezoneSpoof,{mode,targetZone:'America/New_York'});
      page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(['warning','error'].includes(m.type()))errors.push(m.text())});
      // Hold the application date and record identity constant, even if the
      // test extension also changes Intl's default timezone before app startup.
      await page.route('**/api/records',async route=>{const response=await route.fetch(),json=await response.json();json.records=json.records.filter(r=>r.type==='daily').slice(0,1).map(r=>({...r,id:'autumn-fixture',period:'2025-11-02',status:'draft'}));assert.equal(json.records.length,1);await route.fulfill({response,json})});
      await page.goto(baseUrl,{waitUntil:'networkidle'});await page.locator('#rail-toggle').click();await page.evaluate(()=>document.fonts.ready);
      let data=await inspect(page),match=/^(\d+)年(\d+)月$/.exec(data.month||'');assert.ok(match,'initial calendar');
      const current={y:+match[1],m:+match[2]};let expected={...current};
      const previous=page.getByRole('button',{name:'上个月',exact:true}),next=page.getByRole('button',{name:'下个月',exact:true});
      const root=await page.locator('[data-slot="calendar"]').elementHandle(),prevNode=await previous.elementHandle(),nextNode=await next.elementHandle();
      async function visit(direction){
        await page.locator('[data-calendar-date]').evaluateAll(days=>{window.__oldCalendarDays=days});
        const button=direction<0?previous:next;await button.focus();await button.click();expected=shift(expected,direction);
        checks.push(validate(await inspect(page),expected,`${name}-${mode}-${checks.length}`));
        assert.ok(await page.evaluate(({root,prevNode,nextNode,direction})=>root===document.querySelector('[data-slot="calendar"]')&&prevNode===document.querySelector('[aria-label="上个月"]')&&nextNode===document.querySelector('[aria-label="下个月"]')&&document.activeElement===(direction<0?prevNode:nextNode),{root,prevNode,nextNode,direction}),'stable nav and focus');
        assert.ok(await page.evaluate(()=>window.__oldCalendarDays.every(day=>!day.isConnected)),'old month date controls disposed');
      }
      checks.push(validate(data,expected,`${name}-${mode}-initial`));
      for(let i=0;i<38;i++)await visit(-1);
      for(let i=0;i<76;i++){
        await visit(1);
        if(name==='chrome'&&mode==='partial-setters'&&expected.y===2025&&[9,10,11,12].includes(expected.m))await page.locator('.calendar-paper').screenshot({path:resolve(out,`fixed-hybrid-2025-${expected.m}.png`)});
      }
      await page.locator('.stage-return-month').click();expected=current;checks.push(validate(await inspect(page),expected,'return-current'));
      for(const width of [820,390,320]){await page.setViewportSize({width,height:1100});checks.push(validate(await inspect(page),expected,`${name}-${mode}-${width}`))}
      if(name==='chrome'&&mode==='partial-setters')await page.locator('.calendar-paper').screenshot({path:resolve(out,'fixed-hybrid-320.png')});
      await page.setViewportSize({width:1280,height:1100});
      // Browse to the original recorded date, open it, exit, and verify source
      // month/focus/identity without saving or verifying anything.
      const distance=(expected.y-2025)*12+expected.m-11;
      for(let i=0;i<Math.abs(distance);i++)await visit(distance>0?-1:1);
      const record=page.locator('[data-calendar-record="autumn-fixture"]');await record.click();await page.getByRole('button',{name:'退出复盘',exact:true}).click();await page.locator('.stage-calendar').waitFor();
      assert.equal(await page.evaluate(()=>document.activeElement.dataset.calendarDate),'2025-11-02');
      checks.push(validate(await inspect(page),{y:2025,m:11},'record-return'));
      assert.equal(await record.getAttribute('data-calendar-date'),'2025-11-02');
      assert.deepEqual(errors,[]);
      results.push({browser:name,version:browser.version(),mode,checks,errors,passed:true});
      console.log(JSON.stringify({browser:name,mode,checks:checks.length,passed:true}));
    }finally{await context.close()}
  }}finally{await browser.close()}
 }
 assert.ok(results.length,'a Chrome or Edge executable is required');
 await writeFile(resolve(out,'final-checks.json'),JSON.stringify({baseUrl,results},null,2));
})().catch(error=>{console.error(error);process.exitCode=1});
