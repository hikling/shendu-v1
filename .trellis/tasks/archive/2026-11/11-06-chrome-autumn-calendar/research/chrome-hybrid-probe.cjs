const {createRequire}=require('node:module');
const {writeFile}=require('node:fs/promises');
const {resolve}=require('node:path');
const {chromium}=createRequire('C:/Users/007/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json')('playwright');
const baseUrl=process.argv[2]||'http://127.0.0.1:3192';

// Test-only hostile environment. Not a claim about My Fingerprint's actual code.
function spoof({mode,targetZone}){
 const NativeDate=Date,NativeFormatter=Intl.DateTimeFormat;
 const methods=Object.fromEntries(Object.getOwnPropertyNames(NativeDate.prototype).filter(n=>typeof NativeDate.prototype[n]==='function').map(n=>[n,NativeDate.prototype[n]]));
 const fmt=new NativeFormatter('en-US',{timeZone:targetZone,year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'numeric',second:'numeric',fractionalSecondDigits:3,hourCycle:'h23',weekday:'short'});
 const fields=date=>{const p=Object.fromEntries(fmt.formatToParts(date).map(p=>[p.type,p.value]));return{FullYear:+p.year,Month:+p.month-1,Date:+p.day,Day:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(p.weekday),Hours:+p.hour,Minutes:+p.minute,Seconds:+p.second,Milliseconds:+p.fractionalSecond}};
 const wallTime=p=>NativeDate.UTC(p.FullYear,p.Month,p.Date,p.Hours,p.Minutes,p.Seconds,p.Milliseconds);
 const offset=date=>(wallTime(fields(date))-+date)/60000;
 const instant=wall=>{let candidate=wall;for(let i=0;i<3;i++)candidate=wall-offset(new NativeDate(candidate))*60000;return candidate};
 NativeDate.prototype.getTimezoneOffset=function(){return isNaN(+this)?NaN:-offset(this)};
 if(mode!=='offset-only')for(const name of ['FullYear','Month','Date','Day','Hours','Minutes','Seconds','Milliseconds'])NativeDate.prototype['get'+name]=function(){return isNaN(+this)?NaN:fields(this)[name]};
 if(mode==='partial-setters'){
  for(const name of ['FullYear','Month','Hours','Minutes','Seconds','Milliseconds'])NativeDate.prototype['set'+name]=function(...args){
   const shadow=new NativeDate(wallTime(fields(this)));
   methods['setUTC'+name].apply(shadow,args);
   return methods.setTime.call(this,instant(+shadow));
  };
  globalThis.Date=new Proxy(NativeDate,{construct(target,args,newTarget){
   const values=args.length>=2?[instant(NativeDate.UTC(...args))]:args;
   return Reflect.construct(target,values,newTarget===globalThis.Date?target:newTarget);
  }});
 }
 Intl.DateTimeFormat=new Proxy(NativeFormatter,{construct(target,args,newTarget){const [locale,options]=args;return Reflect.construct(target,[locale,{...options,timeZone:options?.timeZone||targetZone}],newTarget)},apply(target,thisArg,args){const [locale,options]=args;return target.call(thisArg,locale,{...options,timeZone:options?.timeZone||targetZone})}});
 globalThis.__spoofConfig={mode,targetZone,nativeZone:new NativeFormatter().resolvedOptions().timeZone};
}

(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),results=[];
 try{
  for(const mode of ['offset-only','local-getters','partial-setters']){
   const context=await browser.newContext({viewport:{width:1440,height:1100},locale:'zh-CN',timezoneId:'Asia/Shanghai'}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(String(e)));
   await context.addInitScript(spoof,{mode,targetZone:'America/New_York'});
   const states=[];
   try{
    await page.goto(baseUrl,{waitUntil:'networkidle'});await page.locator('#rail-toggle').click();
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const inspect=()=>page.evaluate(()=>{
     const cal=document.querySelector('.stage-calendar');if(!cal)return{missing:true,text:document.body.innerText.slice(0,1000)};
     const days=[...cal.querySelectorAll('[data-calendar-date]')].map(e=>({date:e.dataset.calendarDate,text:e.querySelector('.stage-day-number').textContent,lunar:e.querySelector('.stage-day-lunar').textContent}));
     return{year:cal.querySelector('.stage-calendar-year').textContent,month:cal.querySelector('.stage-month-number').textContent,dates:days,unique:new Set(days.map(d=>d.date)).size,rows:[...cal.querySelectorAll('.rdp-week')].map(e=>({count:e.children.length,height:e.getBoundingClientRect().height,days:[...e.children].map(c=>({date:c.dataset.day,text:c.textContent,hidden:c.dataset.hidden,outside:c.dataset.outside}))}))};
    });
    states.push({step:'initial',...await inspect()});
    if(!states[0].missing&&states[0].dates.length){
     for(let i=0;i<15;i++){await page.getByRole('button',{name:'上个月',exact:true}).click();states.push({step:'back-'+i,...await inspect()})}
     for(let i=0;i<4;i++){await page.getByRole('button',{name:'下个月',exact:true}).click();states.push({step:'forward-'+i,...await inspect()});await page.locator('.calendar-paper').screenshot({path:resolve(__dirname,`hybrid-${mode}-forward-${i}.png`)})}
    }
    results.push({mode,config:await page.evaluate(()=>globalThis.__spoofConfig),states,errors});
   }catch(error){results.push({mode,states,errors,error:String(error)})}finally{await context.close()}
  }
  await writeFile(resolve(__dirname,'chrome-hybrid-probe.json'),JSON.stringify({browser:browser.version(),baseUrl,results},null,2));
  console.log(JSON.stringify(results.map(r=>({...r,states:r.states.map(s=>({step:s.step,year:s.year,month:s.month,dates:s.dates?.length,unique:s.unique,rows:s.rows?.map(x=>[x.count,x.height]),missing:s.missing}))})),null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
