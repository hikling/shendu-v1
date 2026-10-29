// Calendar boundaries use a Beijing YYYY-MM-DD date supplied by the caller.
// UTC arithmetic below keeps weekday and month-end calculations independent of host TZ.
const iso = date => date.toISOString().slice(0,10);
const utc = (year,month,day) => new Date(Date.UTC(year,month-1,day,12));

export function verificationMinimum(type,beijingDate){
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(beijingDate));
  if(!match)throw new RangeError('Expected a Beijing ISO calendar date');
  const [,yearValue,monthValue,dayValue]=match;
  const year=Number(yearValue),month=Number(monthValue),day=Number(dayValue),date=utc(year,month,day);
  if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)throw new RangeError('Invalid Beijing calendar date');
  if(type==='weekly'){date.setUTCDate(day+8-(date.getUTCDay()||7));return iso(date)}
  if(type==='monthly')return iso(utc(year,month+1,1));
  if(type==='quarterly')return iso(utc(year,Math.floor((month-1)/3)*3+4,1));
  if(type==='yearly')return iso(utc(year+1,1,1));
  if(type==='decision'){
    const first=utc(year,month+3,1),last=utc(first.getUTCFullYear(),first.getUTCMonth()+2,0);
    return iso(utc(first.getUTCFullYear(),first.getUTCMonth()+1,Math.min(day,last.getUTCDate())));
  }
  if(type==='daily')return beijingDate;
  throw new RangeError(`Unknown review type: ${type}`);
}
