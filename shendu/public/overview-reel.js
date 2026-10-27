// Private, local-only illustration selection for completed review cards.
const EMOTION_RULES=[
  {id:1,terms:['精疲力尽','筋疲力尽','疲惫','疲劳','很累','累坏','累瘫','没有力气']},
  {id:2,terms:['熬夜','失眠','晚睡','通宵','睡眠不足','睡不着','没睡好']},
  {id:3,terms:['摸鱼','偷懒','开小差','分心','走神','拖延']},
  {id:4,terms:['装腔','虚伪','敷衍','质疑','不可信','看不惯']},
  {id:5,terms:['赶死线','赶工','截止日期','期限紧','赶进度','紧急交付','来不及']},
  {id:6,terms:['害怕','恐惧','担心','紧张','发抖','惶恐','胆怯']},
  {id:7,terms:['葛优瘫','颓废','躺平','提不起劲','无精打采','摆烂']},
  {id:8,terms:['生气','愤怒','发火','恼火','气愤','气死','暴躁']},
  {id:9,terms:['困惑','疑惑','迷茫','不知道怎么办','理不清','没想明白']},
  {id:10,terms:['观察','察觉','发现规律','留意细节','审视','留心']},
  {id:11,terms:['加班','搬砖','工作很忙','埋头工作','努力工作','忙碌']},
  {id:12,terms:['尴尬','不好意思','难为情','社死','羞愧']},
  {id:13,terms:['压力很大','压力太大','焦虑','头疼','头大','烦躁','烦恼','崩溃']},
  {id:14,terms:['绝望','失落','难过','沮丧','灰心','心情低落','无助']},
  {id:15,terms:['等下班','期待下班','等待下班','下班倒计时']}
];
function recordSeed(id){let seed=2166136261;for(const character of String(id))seed=Math.imul(seed^character.codePointAt(0),16777619)>>>0;return seed}
function recordWords(record){const data=record.data||{},answers=Object.values(data.answers||{}).flat(Infinity),metrics=Array.isArray(data.metrics)?data.metrics.flatMap(item=>[item?.name,item?.action,item?.status]):[];return [record.title,...answers,...metrics,data.action,data.ifCondition,data.ifThen,data.journal,data.risk,record.verification?.result,record.verification?.adjustment].filter(value=>typeof value==='string').join(' ').slice(0,30000).toLowerCase()}
function hasPositiveTerm(text,term){let index=text.indexOf(term);while(index>=0){const before=text.slice(Math.max(0,index-8),index);if(!/(?:不|没|未|别|无需|避免|戒掉|停止|摆脱|戒除|告别)(?:再|有|要|去|想|继续)?\s*$/.test(before))return true;index=text.indexOf(term,index+term.length)}return false}
export function overviewRecordAppearance(record){
  const seed=recordSeed(record.id),text=recordWords(record),matches=EMOTION_RULES.map(rule=>({id:rule.id,score:rule.terms.filter(term=>hasPositiveTerm(text,term)).length}));
  const best=Math.max(0,...matches.map(item=>item.score)),leaders=matches.filter(item=>best>0&&item.score===best);
  const art=leaders.length===1?leaders[0].id:seed%EMOTION_RULES.length+1;
  return{art:`emotion-${String(art).padStart(2,'0')}`,layout:(seed>>>8)%2?'story':'note'};
}

// A day-based reel period has a separate, full weekday line.
export function overviewDateParts(period){
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(period||''));
  if(!match)return null;
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
  const value=new Date(Date.UTC(year,month-1,day,12));
  if(value.getUTCFullYear()!==year||value.getUTCMonth()!==month-1||value.getUTCDate()!==day)return null;
  const calendarDate=`${year}年${month}月${day}日`,weekday=`星期${'日一二三四五六'[value.getUTCDay()]}`;
  return{calendarDate,weekday,full:calendarDate+weekday};
}

// Normalize only occurrences of this record's period; preserve different dates and custom wording.
export function overviewRecordTitle(record,date,label){
  let title=String(record.title||'').replace(/\s+/g,' ').trim();
  if(!title)return{title:date,showDate:false};
  const compact=value=>value.replace(/\s+/g,'');
  let found=compact(title).includes(compact(date));
  const period=String(record.period||''),day=/^(\d{4})-(\d{2})-(\d{2})$/.exec(period),month=/^(\d{4})-(\d{2})$/.exec(period),week=/^(\d{4})-W(\d{2})$/.exec(period),year=/^\d{4}$/.test(period);
  if(day){
    const replaceDay=(whole,y,m,d)=>{if(Number(y)===Number(day[1])&&Number(m)===Number(day[2])&&Number(d)===Number(day[3])){found=true;return date}return whole};
    title=title.replace(/(?<!\d)(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})(?!\d)(?:\s*(?:周|星期)[一二三四五六日天])?/g,replaceDay);
    title=title.replace(/(?<!\d)(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日(?:\s*(?:周|星期)[一二三四五六日天])?/g,replaceDay);
  }else if(month){
    title=title.replace(/(?<!\d)(\d{4})(?:[.\/-](\d{1,2})(?![.\/-]\d)|年\s*(\d{1,2})月)(?!\d)/g,(whole,y,a,b)=>{if(Number(y)===Number(month[1])&&Number(a||b)===Number(month[2])){found=true;return date}return whole});
  }else if(week){
    title=title.replace(/(?<!\d)(\d{4})\s*(?:[-.\/]?W\s*|年\s*第\s*)(\d{1,2})(?:\s*周)?(?!\d)/gi,(whole,y,w)=>{if(Number(y)===Number(week[1])&&Number(w)===Number(week[2])){found=true;return date}return whole});
  }else if(year){
    const stripped=title.replace(/[\s·•:：|—–-]/g,'');
    if(stripped===period||stripped===`${label}${period}`||stripped===`${label}${period}年`){title=date;found=true}
  }
  if(found){
    const remainder=title.replace(date,'').replace(/[\s·•:：|—–-]/g,'');
    if(!remainder||remainder===compact(label))title=date;
    return{title,showDate:false};
  }
  return{title,showDate:true};
}
