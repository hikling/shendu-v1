const {createRequire}=require('node:module');
const {resolve}=require('node:path');
const {pathToFileURL}=require('node:url');
const {writeFileSync}=require('node:fs');
const repo=resolve(__dirname,'../../../..'),req=createRequire(resolve(repo,'shendu/package.json'));
const normalized=process.argv.includes('--normalize');

// Research-only demonstration. This is not an application implementation.
class CivilDate extends Date{
 constructor(...args){super(args.length===0?Date.now():args.length===1?args[0]:Date.UTC(...args))}
 getTimezoneOffset(){return 0}
}
for(const name of ['FullYear','Month','Date','Day','Hours','Minutes','Seconds','Milliseconds']){
 CivilDate.prototype['get'+name]=function(){return Date.prototype['getUTC'+name].call(this)};
 if(name!=='Day')CivilDate.prototype['set'+name]=function(...args){return Date.prototype['setUTC'+name].apply(this,args)};
}

(async()=>{
 const load=name=>import(pathToFileURL(resolve(repo,'shendu/node_modules/react-day-picker/dist/esm',name)).href);
 const [{DateLib},{getDates},{getMonths},{TZDate}]=await Promise.all([load('classes/DateLib.js'),load('helpers/getDates.js'),load('helpers/getMonths.js'),import(pathToFileURL(resolve(repo,'shendu/node_modules/@date-fns/tz/index.js')).href)]);
 const {zhCN}=req('date-fns/locale'),originals={};
 for(const name of ['getFullYear','getMonth','getDate','getDay','getHours','getMinutes','getSeconds','getMilliseconds','getTimezoneOffset'])originals[name]=Date.prototype[name];
 const results=[];
 for(const systemZone of ['Asia/Shanghai','America/New_York'])for(const targetZone of ['America/New_York','UTC'])for(const spoof of ['offset-only','local-getters']){
  process.env.TZ=systemZone;
  Object.assign(Date.prototype,originals);
  const fmt=new Intl.DateTimeFormat('en-US',{timeZone:targetZone,year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'numeric',second:'numeric',fractionalSecondDigits:3,hourCycle:'h23',weekday:'short'});
  const read=date=>{
   const parts=Object.fromEntries(fmt.formatToParts(date).map(p=>[p.type,p.value]));
   return{getFullYear:+parts.year,getMonth:+parts.month-1,getDate:+parts.day,getDay:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(parts.weekday),getHours:+parts.hour,getMinutes:+parts.minute,getSeconds:+parts.second,getMilliseconds:+parts.fractionalSecond};
  };
  Date.prototype.getTimezoneOffset=function(){if(isNaN(+this))return NaN;const p=read(this);return(+this-Date.UTC(p.getFullYear,p.getMonth,p.getDate,p.getHours,p.getMinutes,p.getSeconds,p.getMilliseconds))/60000};
  if(spoof==='local-getters')for(const name of Object.keys(originals).filter(n=>n!=='getTimezoneOffset'))Date.prototype[name]=function(){return isNaN(+this)?NaN:read(this)[name]};
  for(const fixedZone of [false,true,'civil-subclass']){
   const civil=fixedZone==='civil-subclass';
   const lib=new DateLib({locale:zhCN,weekStartsOn:1,...(fixedZone===true?{timeZone:'UTC'}:{})},civil?{newDate:(y,m,d)=>new CivilDate(y,m,d),today:()=>new CivilDate(Date.UTC(2026,10,6,12))}:undefined),months=[];
   for(const month of [8,9,10,11]){
    try{
     const input=civil?new CivilDate(2025,month,1,12):fixedZone?new TZDate(Date.UTC(2025,month,1,12),'UTC'):new Date(2025,month,1,12);
     const displayed=normalized?lib.addMonths(lib.startOfMonth(input),0):input;
     const dates=getDates([displayed],undefined,{fixedWeeks:true},lib),model=getMonths([displayed],dates,{fixedWeeks:true},lib)[0],days=model.weeks.flatMap(w=>w.days),visible=days.filter(d=>!d.outside),iso=visible.map(d=>d.isoDate);
     months.push({month:month+1,displayed:lib.format(displayed,'yyyy-MM-dd'),days:days.length,weeks:model.weeks.map(w=>w.days.map(d=>d.isoDate)),visible:visible.length,unique:new Set(iso).size});
    }catch(error){months.push({month:month+1,error:String(error)})}
   }
   results.push({systemZone,targetZone,spoof,fixedZone,normalized,months});
  }
 }
 Object.assign(Date.prototype,originals);
 writeFileSync(resolve(__dirname,normalized?'hybrid-normalized-model.json':'hybrid-date-model.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify(results.map(r=>({...r,months:r.months.map(m=>({...m,weeks:undefined}))})),null,2));
})().catch(error=>{console.error(error);process.exitCode=1});
