import lunarCalendar from 'lunar-javascript';

const {Solar}=lunarCalendar;
const pad=value=>String(value).padStart(2,'0');

// Date-only values are interpreted by their explicit calendar fields. Never
// parse them as UTC or let the browser timezone shift a Beijing calendar day.
function dateParts(value){
  const parts=value instanceof Date
    ? [value.getFullYear(),value.getMonth()+1,value.getDate()]
    : /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||''))?.slice(1).map(Number);
  if(!parts||parts.some(part=>!Number.isInteger(part)))throw new RangeError('Invalid calendar date');
  const [year,month,day]=parts;
  const check=new Date(0);check.setFullYear(year,month-1,day);check.setHours(12,0,0,0);
  if(year<1||year>9999||check.getFullYear()!==year||check.getMonth()+1!==month||check.getDate()!==day)throw new RangeError('Invalid calendar date');
  return parts;
}

export function lunarDateLabel(value){
  const [year,month,day]=dateParts(value);
  const lunar=Solar.fromYmd(year,month,day).getLunar();
  const monthName=`${lunar.getMonthInChinese()}月`,dayName=lunar.getDayInChinese(),solarTerm=lunar.getJieQi();
  return {
    date:`${String(year).padStart(4,'0')}-${pad(month)}-${pad(day)}`,
    year:lunar.getYear(),month:lunar.getMonth(),day:lunar.getDay(),
    monthName,dayName,solarTerm,
    label:solarTerm||(lunar.getDay()===1?monthName:dayName),
    fullLabel:`农历${lunar.getYearInGanZhi()}年${monthName}${dayName}${solarTerm?`，${solarTerm}`:''}`,
  };
}

export function lunarMonthLabels(month){
  const [year,number]=dateParts(`${month}-01`);
  const end=new Date(0);end.setFullYear(year,number,0);end.setHours(12,0,0,0);
  const days=new Map();
  for(let day=1;day<=end.getDate();day++){
    const value=`${String(year).padStart(4,'0')}-${pad(number)}-${pad(day)}`;
    days.set(value,lunarDateLabel(value));
  }
  return days;
}
