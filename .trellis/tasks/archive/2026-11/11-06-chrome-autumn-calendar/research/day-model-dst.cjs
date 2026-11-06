const {createRequire}=require('node:module');
const {writeFileSync}=require('node:fs');
const {resolve}=require('node:path');
const {pathToFileURL}=require('node:url');
const repo=resolve(__dirname,'../../../..'),req=createRequire(resolve(repo,'shendu/package.json'));
(async()=>{
 const load=name=>import(pathToFileURL(resolve(repo,'shendu/node_modules/react-day-picker/dist/esm',name)).href);
 const [{DateLib},{getDates},{getMonths}]=await Promise.all([load('classes/DateLib.js'),load('helpers/getDates.js'),load('helpers/getMonths.js')]);
 const {zhCN}=req('date-fns/locale'),results=[];
 for(const zone of ['Asia/Shanghai','America/New_York','America/Los_Angeles','Europe/London','America/Havana']){
  process.env.TZ=zone;
  const lib=new DateLib({locale:zhCN,weekStartsOn:1});
  let checked=0;const failures=[];
  for(let year=2000;year<=2050;year++)for(let month=8;month<=11;month++){
   const displayed=new Date(year,month,1,12),dates=getDates([displayed],undefined,{fixedWeeks:true},lib),model=getMonths([displayed],dates,{fixedWeeks:true},lib)[0],days=model.weeks.flatMap(w=>w.days),visible=days.filter(d=>!d.outside),iso=visible.map(d=>d.isoDate),expect=new Date(year,month+1,0).getDate();
   const bad=model.weeks.filter(w=>w.days.length!==7),unique=new Set(iso).size;
   if(days.length!==42||model.weeks.length!==6||bad.length||visible.length!==expect||unique!==expect)failures.push({year,month:month+1,total:days.length,weeks:model.weeks.map(w=>({week:w.weekNumber,dates:w.days.map(d=>d.isoDate)})),visible:visible.length,unique,expect});
   checked++;
  }
  results.push({zone,resolved:Intl.DateTimeFormat().resolvedOptions().timeZone,checked,failures,fallback2025:[1,2,3].map(d=>({day:d,date:new Date(2025,10,d).toString(),offset:new Date(2025,10,d).getTimezoneOffset()}))});
 }
 writeFileSync(resolve(__dirname,'day-model-dst.json'),JSON.stringify({node:process.version,results},null,2));
 console.log(JSON.stringify(results.map(r=>({zone:r.zone,resolved:r.resolved,checked:r.checked,failures:r.failures.length,fallback2025:r.fallback2025})),null,2));
})().catch(error=>{console.error(error);process.exitCode=1});
