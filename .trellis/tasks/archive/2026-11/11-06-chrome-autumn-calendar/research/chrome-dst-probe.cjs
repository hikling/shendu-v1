const {createRequire}=require('node:module');
const {writeFile}=require('node:fs/promises');
const {resolve}=require('node:path');
const {chromium}=createRequire('C:/Users/007/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json')('playwright');
const baseUrl=process.argv[2]||'http://127.0.0.1:3192';

(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const zones=['America/New_York','America/Los_Angeles','Europe/London'];
 try{
  const results=await Promise.allSettled(zones.map(async timezoneId=>{
   const context=await browser.newContext({viewport:{width:1440,height:1100},locale:'zh-CN',timezoneId});
   const page=await context.newPage(),errors=[],snapshots=[];
   page.on('pageerror',error=>errors.push(String(error)));
   await page.clock.install({time:new Date('2026-11-06T12:00:00Z')});
   try{
    await page.goto(baseUrl,{waitUntil:'networkidle'});
    await page.locator('#rail-toggle').click();
    await page.evaluate(()=>document.fonts.ready);
    const inspect=()=>page.evaluate(()=>{
     const cal=document.querySelector('.stage-calendar'),rect=e=>{const b=e.getBoundingClientRect();return{x:b.x,y:b.y,w:b.width,h:b.height,right:b.right,bottom:b.bottom}};
     const rows=[...cal.querySelectorAll('.rdp-week')],headers=[...cal.querySelectorAll('.rdp-weekday')].map(rect);
     const days=[...cal.querySelectorAll('[data-calendar-date]')].map(e=>({date:e.dataset.calendarDate,text:e.querySelector('.stage-day-number').textContent,lunar:e.querySelector('.stage-day-lunar').textContent,box:rect(e),cell:rect(e.parentElement),row:rows.indexOf(e.closest('.rdp-week')),column:Number(getComputedStyle(e.parentElement).gridColumnStart)}));
     const cells=[...cal.querySelectorAll('.stage-calendar-cell')];
     return{month:days[0]?.date.slice(0,7),headers,days,cells:cells.length,rows:rows.map(e=>({box:rect(e),dates:[...e.children].map(d=>d.dataset.day),count:e.children.length})),outside:cells.filter(e=>e.dataset.outside==='true'||e.dataset.hidden==='true').map(e=>({text:e.textContent,children:e.children.length,display:getComputedStyle(e).display,visibility:getComputedStyle(e).visibility})),retainedOldCells:(window.__oldStageCells||[]).filter(e=>e.isConnected).length,retainedOldWeekRows:(window.__oldStageWeeks||[]).filter(e=>e.isConnected).length,rootRetained:!window.__oldStageRoot||window.__oldStageRoot===cal.querySelector('[data-slot="calendar"]'),navRetained:!window.__oldStagePrev||window.__oldStagePrev===cal.querySelector('.rdp-button_previous'),focus:document.activeElement?.getAttribute('aria-label'),overflow:document.documentElement.scrollWidth>innerWidth};
    });
    const validate=(data,step)=>{
     const issues=[],[year,month]=data.month.split('-').map(Number),expected=new Date(Date.UTC(year,month,0)).getUTCDate();
     if(data.days.length!==expected||new Set(data.days.map(d=>d.date)).size!==expected)issues.push('date count or duplicate');
     if(data.cells!==42||data.rows.length!==6||data.rows.some(r=>r.count!==7||r.box.h<40||r.box.h>60))issues.push('cell count or abnormal week geometry');
     if(data.outside.some(e=>e.text||e.children))issues.push('outside month cell has content');
     if(data.retainedOldCells)issues.push('previous month cells remain connected');
     if(!data.rootRetained||!data.navRetained)issues.push('root or navigation remounted');
     if(data.overflow)issues.push('horizontal overflow');
     for(const day of data.days){
      const [y,m,d]=day.date.split('-').map(Number),column=(new Date(Date.UTC(y,m-1,d)).getUTCDay()+6)%7;
      const row=Math.floor(((new Date(Date.UTC(y,m-1,1)).getUTCDay()+6)%7+d-1)/7),header=data.headers[column],rowBox=data.rows[row].box;
      if(day.date.slice(0,7)!==data.month||Number(day.text)!==d)issues.push(day.date+' stale date text');
      if(Math.abs((day.box.x+day.box.w/2)-(header.x+header.w/2))>1||day.column!==column+1)issues.push(day.date+' weekday offset');
      if(day.row!==row||day.box.y<rowBox.y-1||day.box.bottom>rowBox.bottom+1)issues.push(day.date+' week offset');
     }
     snapshots.push({step,month:data.month,dates:data.days.length,issues,retainedOldCells:data.retainedOldCells,retainedOldWeekRows:data.retainedOldWeekRows,rootRetained:data.rootRetained,navRetained:data.navRetained,focus:data.focus,rows:data.rows.map(r=>r.box.h),...(issues.length?{full:data}:{})});
    };
    validate(await inspect(),'initial');
    const previous=page.getByRole('button',{name:'上个月',exact:true}),next=page.getByRole('button',{name:'下个月',exact:true});
    const turn=async(button,label)=>{
     await page.evaluate(()=>{const cal=document.querySelector('.stage-calendar');window.__oldStageCells=[...cal.querySelectorAll('.stage-calendar-cell')];window.__oldStageWeeks=[...cal.querySelectorAll('.rdp-week')];window.__oldStageRoot=cal.querySelector('[data-slot="calendar"]');window.__oldStagePrev=cal.querySelector('.rdp-button_previous')});
     await button.click();
     await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
     const data=await inspect();validate(data,label);
     if(data.month==='2025-10'||data.month==='2025-11'){
      await writeFile(resolve(__dirname,`chrome-${timezoneId.replaceAll('/','-')}-${data.month}-${label}.json`),JSON.stringify(data,null,2));
      if(label.startsWith('back-'))await page.locator('.calendar-paper').screenshot({path:resolve(__dirname,`chrome-${timezoneId.replaceAll('/','-')}-${data.month}.png`)});
     }
    };
    for(let i=0;i<38;i++)await turn(previous,'back-'+i);
    for(let i=0;i<38;i++)await turn(next,'forward-'+i);
    const dates=await page.evaluate(()=>({resolved:Intl.DateTimeFormat().resolvedOptions().timeZone,november:[1,2,3].map(d=>({day:d,date:new Date(2025,10,d).toString(),offset:new Date(2025,10,d).getTimezoneOffset()}))}));
    return{timezoneId,...dates,snapshots,errors};
   }finally{await context.close()}
  }));
  const payload={browser:browser.version(),baseUrl,results:results.map((r,i)=>r.status==='fulfilled'?r.value:{timezoneId:zones[i],error:String(r.reason)})};
  await writeFile(resolve(__dirname,'chrome-dst-probe.json'),JSON.stringify(payload,null,2));
  console.log(JSON.stringify({...payload,results:payload.results.map(r=>({...r,snapshots:r.snapshots?.length,failures:r.snapshots?.filter(s=>s.issues.length)}))},null,2));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
