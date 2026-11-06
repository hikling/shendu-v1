// Test-only inconsistent local Date APIs. This models a failure class, not any plugin source.
function installCalendarTimezoneSpoof({mode,targetZone}){
 const NativeDate=Date,NativeFormatter=Intl.DateTimeFormat;
 const descriptors=Object.getOwnPropertyDescriptors(NativeDate.prototype);
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
 return ()=>{globalThis.Date=NativeDate;Intl.DateTimeFormat=NativeFormatter;Object.defineProperties(NativeDate.prototype,descriptors)};
}
module.exports={installCalendarTimezoneSpoof};
