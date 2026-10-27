import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {overviewRecordAppearances,overviewVerifiedRecords,overviewRecordExcerpt,overviewLoopMetrics,overviewRecordTitle,overviewDateParts} from '../public/overview-reel.js';

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
test('verification content matches locally before an older review theme',()=>{
  const verifiedText={...daily,data:{journal:'工作时很焦虑'},verification:{result:'今晚加班',adjustment:'调整专注时间'}};
  assert.equal(appearance(verifiedText).art,'emotion-11');
  assert.equal(appearance({...daily,verification:{adjustment:'下次避免加班，留意细节'}}).art,'emotion-10');
});
test('only verified records from the six supplied review categories enter the reel',()=>{
  const types={daily:{},weekly:{},monthly:{},quarterly:{},yearly:{},decision:{}};
  const verified=Object.keys(types).map(type=>({...daily,id:type,type,status:'verified'}));
  const records=[...verified,...Object.keys(types).flatMap(type=>['completed','draft'].map(status=>({...daily,id:`${type}-${status}`,type,status}))),{...daily,type:'other',status:'verified'},{...daily,type:'toString',status:'verified'}];
  const snapshot=structuredClone(records);
  assert.deepEqual(overviewVerifiedRecords(records,types),verified);
  assert.deepEqual(records,snapshot,'selection does not mutate stored records');
});
test('one verified version per day, week, month and year survives using the latest verification time',()=>{
  const types={daily:{},weekly:{},monthly:{},yearly:{}};
  const records=Object.keys(types).flatMap((type,index)=>{
    const period=['2026-10-01','2026-W40','2026-10','2026'][index];
    return [{...daily,type,period,id:`${type}-old`,status:'verified',verified_at:'2026-10-01T12:00:00Z',updated_at:'2026-10-10T12:00:00Z'},
      {...daily,type,period,id:`${type}-recent`,status:'verified',verification:{actualAt:'2026-10-02T12:00:00Z'}}];
  });
  const selected=overviewVerifiedRecords(records,types);
  assert.equal(selected.length,4);
  assert.ok(selected.every(record=>record.id.endsWith('-recent')),'actual verification wins over a later unrelated update');
});
test('quarterly dates group by calendar quarter, while same-day decisions remain separate events',()=>{
  const types={quarterly:{},decision:{}};
  const quarter=(id,period,verified_at)=>({...daily,id,type:'quarterly',period,status:'verified',verified_at});
  const decision=(id,verified_at)=>({...daily,id,type:'decision',status:'verified',verified_at});
  const records=[quarter('q3-old','2026-07-01','2026-10-01T12:00:00Z'),quarter('q3-new','2026-09-30','2026-10-02T12:00:00Z'),quarter('q4','2026-10-01','2026-10-03T12:00:00Z'),quarter('previous-year','2025-09-30','2025-10-01T12:00:00Z'),decision('event-a','2026-10-01T12:00:00Z'),decision('event-b','2026-10-01T12:00:00Z'),decision('event-a','2026-10-02T12:00:00Z')];
  const selected=overviewVerifiedRecords(records,types);
  assert.deepEqual(selected.map(record=>record.id),['q3-new','q4','previous-year','event-a','event-b']);
  assert.equal(selected.find(record=>record.id==='event-a').verified_at,'2026-10-02T12:00:00Z');
});
test('invalid verification timestamps fall back safely to updates and ties are deterministic',()=>{
  const types={daily:{}};
  const records=[{...daily,id:'a',status:'verified',verified_at:'not-a-date',updated_at:'2026-10-01T12:00:00Z'},
    {...daily,id:'b',status:'verified',updated_at:'2026-10-02T12:00:00Z'},
    {...daily,id:'c',status:'verified',updated_at:'2026-10-02T12:00:00Z'}];
  assert.equal(overviewVerifiedRecords(records,types)[0].id,'c');
  assert.equal(overviewVerifiedRecords([...records].reverse(),types)[0].id,'c');
});
test('imported records with missing verification times compare their saved time against valid verification times',()=>{
  const old={...daily,id:'old',status:'verified',verified_at:'2026-10-01T12:00:00Z',updated_at:'2026-10-20T12:00:00Z'};
  for(const verified_at of [null,'invalid']){
    const recent={...daily,id:'recent-import',status:'verified',verified_at,verification:{actualAt:'invalid'},updated_at:'2026-10-02T12:00:00Z'};
    for(const records of [[old,recent],[recent,old]])assert.equal(overviewVerifiedRecords(records,{daily:{}})[0].id,'recent-import');
    const earlier={...recent,id:'earlier-import',updated_at:'2026-09-30T12:00:00Z'};
    assert.equal(overviewVerifiedRecords([earlier,old],{daily:{}})[0].id,'old');
  }
});
test('missing verification and update times fall back to creation without replacing a valid verification time',()=>{
  const old={...daily,id:'old',status:'verified',verified_at:'2026-10-01T12:00:00Z'};
  for(const updated_at of [null,'invalid']){
    const imported={...daily,id:'created-import',status:'verified',updated_at,created_at:'2026-10-02T12:00:00Z'};
    assert.equal(overviewVerifiedRecords([old,imported],{daily:{}})[0].id,'created-import');
    const explicitlyVerified={...imported,id:'verified-old',verified_at:'2026-09-30T12:00:00Z'};
    assert.equal(overviewVerifiedRecords([old,explicitlyVerified],{daily:{}})[0].id,'old');
  }
});
test('all verified records participate beyond the former 12-card limit',()=>{
  const records=Array.from({length:30},(_,index)=>({...daily,id:`record-${index}`,period:`2026-10-${String(index+1).padStart(2,'0')}`,status:'verified'}));
  assert.equal(overviewVerifiedRecords(records,{daily:{}}).length,30);
});
test('the reel excerpt prefers actual results, then adjustment, then the original review',()=>{
  assert.equal(overviewRecordExcerpt({...daily,verification:{result:'  已坚持行动  ',adjustment:'下次提前'}},'原记录'),'已坚持行动');
  assert.equal(overviewRecordExcerpt({...daily,verification:{result:'  ',adjustment:' 下次提前 '}},'原记录'),'下次提前');
  assert.equal(overviewRecordExcerpt(daily,'原记录'),'原记录');
});
test('loop geometry uses complete rounds with one normal card pitch across the seam',()=>{
  for(const count of [1,2,5,7,13,30])for(const [arc,width,gap] of [[2240.7,292,28],[922.1,240,28],[3500,292,28]]){
    const loop=overviewLoopMetrics(count,arc,width,gap);
    assert.equal(loop.slots%count,0,`${count} records need whole rounds`);
    assert.ok(loop.slots>=count,'every unique record participates');
    assert.ok(loop.length>=arc,'the visible arc is fully populated');
    assert.ok(loop.length-arc<count*loop.pitch,'no unnecessary whole round is added');
    assert.ok(Math.abs(arc+2*loop.extension-loop.length)<1e-9,'off-screen extensions close the exact loop');
    const firstCenter=0,lastCenter=(loop.slots-1)*loop.pitch;
    assert.equal(loop.length-lastCenter+firstCenter,width+gap,'last-to-first center spacing equals all other cards');
  }
  assert.deepEqual(overviewLoopMetrics(0,2240,292,28),{groups:0,slots:0,pitch:0,length:0,extension:0});
});
