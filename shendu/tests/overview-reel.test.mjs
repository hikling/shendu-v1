import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {overviewRecordAppearances,overviewCompletedRecords,overviewRecordTitle,overviewDateParts} from '../public/overview-reel.js';

test('day periods use a separate full weekday line for every weekday',()=>{
  const cases=[['2026-09-13','星期日'],['2026-09-14','星期一'],['2026-09-15','星期二'],['2026-09-16','星期三'],['2026-09-17','星期四'],['2026-09-18','星期五'],['2026-09-19','星期六']];
  for(const [period,weekday] of cases){
    const parts=overviewDateParts(period);
    assert.equal(parts.calendarDate,`2026年9月${Number(period.slice(-2))}日`);
    assert.equal(parts.weekday,weekday);
    assert.equal(parts.full,parts.calendarDate+weekday);
  }
  assert.equal(overviewDateParts('2026-W40'),null);
  assert.equal(overviewDateParts('2026-09'),null);
  assert.equal(overviewDateParts('2025'),null);
  assert.equal(overviewDateParts('2026-02-30'),null);
});
test('old short weekdays and dotted defaults normalize to the full weekday',()=>{
  const date=overviewDateParts('2026-09-16').full;
  for(const title of ['每日复盘 · 2026.09.16','2026年9月16日周三','2026年9月16日星期三']){
    assert.deepEqual(overviewRecordTitle({period:'2026-09-16',title},date,'每日复盘'),{title:date,showDate:false});
  }
});
const daily={id:'record-1',type:'daily',period:'2026-09-16',data:{answers:{},action:''}};
const appearance=(record,random=()=>0)=>overviewRecordAppearances([record],random).get(record.id);
const date='2026年9月16日周三',label='每日复盘';
test('legacy default titles, dates and empty titles render the same period once',()=>{
  for(const title of ['', '每日复盘 · 2026.09.16','每日复盘 • 2026/9/16','每日复盘：2026-09-16','2026年9月16日星期三','2026年9月16日周三']){
    assert.deepEqual(overviewRecordTitle({...daily,title},date,label),{title:date,showDate:false},title);
  }
});
test('custom wording and other dates are retained',()=>{
  assert.deepEqual(overviewRecordTitle({...daily,title:'运动与恢复'},date,label),{title:'运动与恢复',showDate:true});
  assert.deepEqual(overviewRecordTitle({...daily,title:'2026.09.16 开始戒烟'},date,label),{title:date+' 开始戒烟',showDate:false});
  assert.deepEqual(overviewRecordTitle({...daily,title:'回看2026.09.17的计划'},date,label),{title:'回看2026.09.17的计划',showDate:true});
});
test('other period types normalize only their own period',()=>{
  assert.deepEqual(overviewRecordTitle({period:'2026-09',title:'每月复盘 · 2026.09'},'2026年9月','每月复盘'),{title:'2026年9月',showDate:false});
  assert.deepEqual(overviewRecordTitle({period:'2026-W40',title:'每周复盘 · 2026-W40'},'2026 年第 40 周','每周复盘'),{title:'2026 年第 40 周',showDate:false});
  assert.deepEqual(overviewRecordTitle({period:'2025',title:'年度复盘 · 2025'},'2025 年','年度复盘'),{title:'2025 年',showDate:false});
});
test('local content matching selects the related illustration',()=>{
  const samples=[['今天精疲力尽','emotion-01'],['昨晚失眠没睡好','emotion-02'],['工作总是摸鱼','emotion-03'],['看不惯他装腔','emotion-04'],['今天赶工来不及','emotion-05'],['心里很害怕','emotion-06'],['今天摆烂了','emotion-07'],['今天真的很生气','emotion-08'],['面对问题很困惑','emotion-09'],['留意细节','emotion-10'],['今晚加班','emotion-11'],['一次尴尬的发言','emotion-12'],['工作时很焦虑','emotion-13'],['心情有些沮丧','emotion-14'],['正在等下班','emotion-15']];
  for(const [text,expected] of samples)assert.equal(appearance({...daily,data:{answers:{today:[text]}}}).art,expected,text);
});
test('matching also considers the journal and metric actions',()=>{
  assert.equal(appearance({...daily,data:{answers:{},journal:'今天一直很焦虑'}}).art,'emotion-13');
  assert.equal(appearance({...daily,data:{answers:{},metrics:[{name:'工作',action:'今晚加班'}]}}).art,'emotion-11');
});
test('unknown and negated content randomly use the complete local collection',()=>{
  const unknown={...daily,data:{answers:{today:['散步、运动、喝水']}}};
  const first=appearance(unknown);
  assert.equal(first.art,'emotion-01');
  const next=appearance(unknown,()=>.999);
  assert.equal(next.art,'emotion-15');
  assert.equal(first.layout,next.layout,'refresh changes fallback art without changing layout');
  const negated={...daily,data:{answers:{today:['没有熬夜']}}};
  assert.deepEqual(appearance(negated),first);
});
test('ambiguous content selects a matching theme before unrelated art',()=>{
  const ambiguous={...daily,data:{answers:{today:['很生气，也很困惑']}}};
  assert.equal(appearance(ambiguous).art,'emotion-08');
  assert.equal(appearance(ambiguous,()=>.999).art,'emotion-09');
});
test('all 15 illustrations are allocated before fallback repeats and every asset exists',()=>{
  const records=Array.from({length:16},(_,index)=>({...daily,id:`unknown-${index}`}));
  const result=overviewRecordAppearances(records,()=>0);
  const arts=records.slice(0,15).map(record=>result.get(record.id).art);
  assert.equal(new Set(arts).size,15);
  for(let index=1;index<=15;index++){
    const art=`emotion-${String(index).padStart(2,'0')}`;
    assert.ok(arts.includes(art),art);
    assert.ok(existsSync(new URL(`../public/assets/reel-emotions/${art}.webp`,import.meta.url)),art);
  }
  assert.ok(arts.includes(result.get(records[15].id).art),'after exhaustion, fallback still uses the collection');
});
test('clear matches are reserved before random cards and loop copies share one allocation',()=>{
  const unknown={...daily,id:'unknown'};
  const tired={...daily,id:'tired',title:'今天精疲力尽'};
  const result=overviewRecordAppearances([unknown,tired,{...unknown}],()=>0);
  assert.equal(result.size,2);
  assert.equal(result.get('tired').art,'emotion-01');
  assert.equal(result.get('unknown').art,'emotion-02');
});
test('verification results never influence review illustration matching',()=>{
  const verifiedText={...daily,verification:{result:'今晚加班',adjustment:'工作时很焦虑'}};
  assert.deepEqual(appearance(verifiedText),appearance(daily));
});
test('only completed records from the six supplied review categories enter the reel',()=>{
  const types={daily:{},weekly:{},monthly:{},quarterly:{},yearly:{},decision:{}};
  const completed=Object.keys(types).map(type=>({...daily,id:type,type,status:'completed'}));
  const records=[...completed,...Object.keys(types).flatMap(type=>['verified','draft'].map(status=>({...daily,id:`${type}-${status}`,type,status}))),{...daily,type:'other',status:'completed'},{...daily,type:'toString',status:'completed'}];
  const snapshot=structuredClone(records);
  assert.deepEqual(overviewCompletedRecords(records,types),completed);
  assert.deepEqual(records,snapshot,'selection does not mutate stored records');
});
