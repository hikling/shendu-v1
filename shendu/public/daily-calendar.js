// Date-only calendar arithmetic; the caller supplies Beijing's current date.
function dateValue(value){
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||''));
  if(!match)return null;
  const [year,month,day]=match.slice(1).map(Number),date=new Date(Date.UTC(year,month-1,day,12));
  return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day?date:null;
}
function iso(date){return date.toISOString().slice(0,10)}
const LAST_DATE='9999-12-31';

export function dailyCalendarModel(value,minimum,requestedMonth='',locked=false,focusDate=''){
  const selected=dateValue(value)?String(value):'',candidate=/^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth)&&dateValue(`${requestedMonth}-01`)?requestedMonth:(selected||minimum).slice(0,7),month=!locked&&candidate<minimum.slice(0,7)?minimum.slice(0,7):candidate;
  const first=dateValue(`${month}-01`),year=first.getUTCFullYear(),monthNumber=first.getUTCMonth()+1,lead=(first.getUTCDay()+6)%7,last=new Date(Date.UTC(year,monthNumber,0,12)).getUTCDate();
  const dates=Array.from({length:last},(_,index)=>`${month}-${String(index+1).padStart(2,'0')}`),enabled=dates.filter(date=>!locked&&date>=minimum);
  const tabDate=[focusDate,selected,minimum,...enabled].find(date=>enabled.includes(date))||'';
  return {month,year,monthNumber,selected,tabDate,previous:!locked&&month>minimum.slice(0,7),next:!locked&&month<'9999-12',cells:Array.from({length:42},(_,index)=>{const date=dates[index-lead];return date?{date,day:index-lead+1,today:date===minimum,selected:date===selected,disabled:locked||date<minimum}:null})};
}

export function dailyCalendarKeyDate(value,key,minimum,shift=false){
  const date=dateValue(value);if(!date)return null;
  const weekday=(date.getUTCDay()+6)%7,offset={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7,Home:-weekday,End:6-weekday}[key];
  if(offset!==undefined)date.setUTCDate(date.getUTCDate()+offset);
  else if(key==='PageUp'||key==='PageDown'){
    const day=date.getUTCDate(),amount=(key==='PageUp'?-1:1)*(shift?12:1);
    date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+amount);
    const last=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0,12)).getUTCDate();date.setUTCDate(Math.min(day,last));
  }else return null;
  if(date.getUTCFullYear()>9999)return LAST_DATE;
  const result=iso(date);return result<minimum?minimum:result;
}

export function dailyCalendarDateLabel(value){
  const date=dateValue(value);if(!date)return '未选择验证日期';
  return `${date.getUTCFullYear()}年${date.getUTCMonth()+1}月${date.getUTCDate()}日 星期${'日一二三四五六'[date.getUTCDay()]}`;
}
