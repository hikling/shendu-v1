// DayPicker/date-fns preserve Date subclasses when cloning. Keep stage dates
// as civil fields throughout that calculation, including when an extension
// overrides the browser's local getters, setters or timezone offset.
// These UTC fields are internal storage, not a conversion of a saved instant.
class StageDate extends Date {
  constructor(...args){
    super(args.length===0?Date.now():args.length===1?args[0]:0);
    if(args.length>1){
      this.setUTCFullYear(args[0],args[1],args[2]??1);
      this.setUTCHours(args[3]??0,args[4]??0,args[5]??0,args[6]??0);
    }
  }
  getFullYear(){return this.getUTCFullYear()}
  getMonth(){return this.getUTCMonth()}
  getDate(){return this.getUTCDate()}
  getDay(){return this.getUTCDay()}
  getHours(){return this.getUTCHours()}
  getMinutes(){return this.getUTCMinutes()}
  getSeconds(){return this.getUTCSeconds()}
  getMilliseconds(){return this.getUTCMilliseconds()}
  getTimezoneOffset(){return 0}
  setFullYear(...args){return this.setUTCFullYear(...args)}
  setMonth(...args){return this.setUTCMonth(...args)}
  setDate(...args){return this.setUTCDate(...args)}
  setHours(...args){return this.setUTCHours(...args)}
  setMinutes(...args){return this.setUTCMinutes(...args)}
  setSeconds(...args){return this.setUTCSeconds(...args)}
  setMilliseconds(...args){return this.setUTCMilliseconds(...args)}
}

export function stageDate(value){
  const [year,month,day]=String(value||'').split('-').map(Number);
  return year&&month&&day?new StageDate(year,month-1,day,12):undefined;
}

// DateLib otherwise creates native local Dates for weekday headings and focus.
// The caller memoizes this object by its business "today", not displayed month.
export function stageDateLibrary(today){
  return {newDate:(year,month,day)=>new StageDate(year,month,day),today:()=>stageDate(today)};
}
