import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {normalizeBackupSchedule,backupScheduleDue,backupHistoryCutoff,backupScheduleLabel} from '../public/backup-schedule.js';

test('precise schedule normalization validates explicit values and keeps old defaults compatible',()=>{
  assert.deepEqual(normalizeBackupSchedule({}),{schedule:'manual',scheduleTime:'02:00',scheduleWeekday:1});
  assert.deepEqual(normalizeBackupSchedule({schedule:'weekly',scheduleTime:'23:59',scheduleWeekday:'7'}),{schedule:'weekly',scheduleTime:'23:59',scheduleWeekday:7});
  assert.deepEqual(normalizeBackupSchedule({scheduleTime:'10:30'},{schedule:'weekly',schedule_time:'02:00',schedule_weekday:3}),{schedule:'weekly',scheduleTime:'10:30',scheduleWeekday:3});
  for(const value of [{schedule:'hourly'},{scheduleTime:'2:00'},{scheduleTime:'24:00'},{scheduleTime:'02:60'},{scheduleWeekday:0},{scheduleWeekday:8},{scheduleWeekday:'1 OR 1'}])assert.throws(()=>normalizeBackupSchedule(value));
  assert.equal(backupScheduleLabel({schedule:'daily',scheduleTime:'03:45'}),'每天 03:45（北京时间）');
  assert.equal(backupScheduleLabel({schedule:'weekly',scheduleTime:'21:05',scheduleWeekday:7}),'每周日 21:05（北京时间）');
});

test('daily and weekly slots use Beijing civil days across UTC day and year boundaries',()=>{
  const daily={schedule:'daily',scheduleTime:'00:15',created_at:'2026-01-01T00:00:00Z'};
  assert.equal(backupScheduleDue(daily,new Date('2026-11-08T16:15:00Z')),'2026-11-08T16:15:00.000Z');
  assert.equal(backupScheduleDue(daily,new Date('2026-11-08T16:14:59Z')),'2026-11-07T16:15:00.000Z');
  assert.equal(backupScheduleDue({...daily,scheduleTime:'02:00'},new Date('2026-12-31T18:00:00Z')),'2026-12-31T18:00:00.000Z');
  const weekly={schedule:'weekly',scheduleTime:'02:00',scheduleWeekday:1,created_at:'2026-01-01T00:00:00Z'};
  assert.equal(backupScheduleDue(weekly,new Date('2026-11-08T18:00:00Z')),'2026-11-08T18:00:00.000Z');
  assert.equal(backupScheduleDue(weekly,new Date('2026-11-08T17:59:59Z')),'2026-11-01T18:00:00.000Z');
  assert.equal(backupScheduleDue({...weekly,scheduleWeekday:7},new Date('2026-11-07T18:00:00Z')),'2026-11-07T18:00:00.000Z');
});

test('new or changed plans never replay earlier slots; manual/test timestamps do not change the plan',()=>{
  const target={schedule:'daily',scheduleTime:'02:00',created_at:'2026-11-08T19:00:00Z'};
  assert.equal(backupScheduleDue(target,new Date('2026-11-09T01:00:00Z')),null,'created after today’s slot');
  const old={...target,created_at:'2026-01-01T00:00:00Z',last_run_at:'2026-11-08T20:00:00Z',last_success_at:'2026-11-08T20:00:00Z'};
  assert.equal(backupScheduleDue(old,new Date('2026-11-09T01:00:00Z')),'2026-11-08T18:00:00.000Z');
  assert.equal(backupScheduleDue({...old,schedule_anchor_at:'2026-11-08T19:00:00Z'},new Date('2026-11-09T01:00:00Z')),null,'editing the plan establishes a new anchor');
  assert.equal(backupScheduleDue({...old,last_scheduled_slot:'2026-11-08T18:00:00.000Z'},new Date('2026-11-09T01:00:00Z')),null);
  assert.equal(backupScheduleDue({...old,enabled:0},new Date('2026-11-09T01:00:00Z')),null);
  assert.equal(backupScheduleDue({...old,schedule:'manual'},new Date('2026-11-09T01:00:00Z')),null);
  assert.equal(backupScheduleDue(old,new Date('2026-11-15T01:00:00Z')),'2026-11-14T18:00:00.000Z','downtime replays only latest slot');
});

test('history keeps today and nine preceding Beijing days, including midnight exactly',()=>{
  assert.equal(backupHistoryCutoff(new Date('2026-11-08T16:00:00Z')),'2026-10-30T16:00:00.000Z');
  assert.equal(backupHistoryCutoff(new Date('2026-11-08T15:59:59Z')),'2026-10-29T16:00:00.000Z');
  const original=process.env.TZ;try{
    for(const zone of ['UTC','America/Los_Angeles','Pacific/Auckland']){process.env.TZ=zone;assert.equal(backupHistoryCutoff(new Date('2026-11-08T16:00:00Z')),'2026-10-30T16:00:00.000Z');}
  }finally{if(original===undefined)delete process.env.TZ;else process.env.TZ=original}
});

function schedulerFixture(){
  const db=new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE backup_targets(id TEXT PRIMARY KEY,user_id TEXT,name TEXT,kind TEXT,schedule TEXT,schedule_time TEXT,schedule_weekday INTEGER,schedule_anchor_at TEXT,last_scheduled_slot TEXT,enabled INTEGER,updated_at TEXT,last_run_at TEXT,last_success_at TEXT,last_error TEXT,schedule_claim_token TEXT,schedule_claim_until TEXT);CREATE TABLE backup_runs(id TEXT PRIMARY KEY,target_id TEXT,user_id TEXT,status TEXT,message TEXT,created_at TEXT,operation TEXT,target_name TEXT,target_kind TEXT,trigger_kind TEXT);`);
  const source=readFileSync(new URL('../server.mjs',import.meta.url),'utf8'),implementation=source.slice(source.indexOf('const scheduledBackups ='),source.indexOf('let scheduledBackupRunning='));
  const outcome=source.slice(source.indexOf('function saveBackupOutcome('),source.indexOf('function staticFile(')),now=()=>new Date().toISOString();
  const save=new Function('db','now','safeText','randomUUID','pruneBackupRuns',outcome+';return saveBackupOutcome;')(db,now,value=>value,randomUUID,()=>{});
  const insert=(id=randomUUID())=>{const anchor='2000-01-01T00:00:00.000Z';db.prepare('INSERT INTO backup_targets(id,user_id,name,kind,schedule,schedule_time,schedule_weekday,schedule_anchor_at,enabled,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,id,'自己的目标','s3','daily','02:00',1,anchor,1,anchor);return id};
  const runner=(worker,active=new Set())=>new Function('db','backupScheduleDue','activeExternalBackupUsers','runExternalBackup','saveBackupOutcome','randomUUID','now',`${implementation};return scheduledBackups;`)(db,backupScheduleDue,active,worker,save,randomUUID,now);
  return{db,insert,runner};
}

test('scheduler consumes failed or successful slots once, retains busy slots and survives restart',async()=>{
  const {db,insert,runner}=schedulerFixture(),id=insert();let mode='failure',attempts=0;const active=new Set();
  const worker=async()=>{attempts++;if(mode==='failure')throw new Error('上传失败');if(mode==='busy')throw Object.assign(new Error('繁忙'),{code:'backup_busy'})};
  try{
    let run=runner(worker,active);await run();assert.equal(attempts,1);
    const row=db.prepare('SELECT * FROM backup_targets').get();assert.ok(row.last_scheduled_slot);assert.equal(row.schedule_claim_token,null);
    assert.equal(db.prepare('SELECT status FROM backup_runs').get().status,'error');
    run=runner(worker,active);await run();assert.equal(attempts,1,'persisted terminal slot prevents another attempt after restart');
    db.prepare('UPDATE backup_targets SET last_scheduled_slot=NULL').run();mode='busy';await run();assert.equal(attempts,2);assert.equal(db.prepare('SELECT last_scheduled_slot FROM backup_targets').get().last_scheduled_slot,null);assert.equal(db.prepare('SELECT schedule_claim_token FROM backup_targets').get().schedule_claim_token,null);
    mode='success';active.add(id);await run();assert.equal(attempts,2);active.clear();await run();assert.equal(attempts,3);assert.equal(db.prepare("SELECT count(*) AS n FROM backup_runs WHERE status='success'").get().n,1);
    await run();assert.equal(attempts,3,'success also consumes exactly one slot');
  }finally{db.close()}
});

test('a target edited while another upload is pending cannot be claimed using stale credentials or plan anchor',async()=>{
  const {db,insert,runner}=schedulerFixture(),first=insert(),second=insert();let finish;const calls=[];
  const run=runner(target=>{calls.push(target.id);return new Promise(resolve=>{finish=resolve})});
  try{
    const pending=run();assert.deepEqual(calls,[first]);
    db.prepare('UPDATE backup_targets SET schedule_anchor_at=?,updated_at=? WHERE id=?').run(new Date().toISOString(),new Date().toISOString(),second);
    finish();await pending;assert.deepEqual(calls,[first]);assert.equal(db.prepare('SELECT last_scheduled_slot FROM backup_targets WHERE id=?').get(second).last_scheduled_slot,null);
  }finally{db.close()}
});

test('an interrupted upload is retried after its lease expires and stale completion cannot clear the new lease',async()=>{
  const {db,insert,runner}=schedulerFixture();insert();let finishOld,finishNew,attempts=0;
  try{
    const interrupted=runner(()=>{attempts++;return new Promise(resolve=>{finishOld=resolve})})();
    const first=db.prepare('SELECT * FROM backup_targets').get();assert.ok(first.schedule_claim_token);assert.ok(first.schedule_claim_until);assert.equal(first.last_scheduled_slot,null);
    const retry=runner(()=>{attempts++;return new Promise(resolve=>{finishNew=resolve})});
    await retry();assert.equal(attempts,1,'restart cannot overlap an unexpired lease');
    db.prepare("UPDATE backup_targets SET schedule_claim_until='2000-01-01T00:00:00.000Z'").run();
    const restarted=retry();assert.equal(attempts,2);const second=db.prepare('SELECT * FROM backup_targets').get();assert.notEqual(second.schedule_claim_token,first.schedule_claim_token);
    finishOld();await interrupted;assert.equal(db.prepare('SELECT schedule_claim_token FROM backup_targets').get().schedule_claim_token,second.schedule_claim_token);assert.equal(db.prepare('SELECT count(*) AS n FROM backup_runs').get().n,0,'stale lease cannot publish an outcome');
    finishNew();await restarted;const complete=db.prepare('SELECT * FROM backup_targets').get();assert.equal(complete.schedule_claim_token,null);assert.equal(complete.schedule_claim_until,null);assert.ok(complete.last_scheduled_slot);assert.equal(db.prepare('SELECT count(*) AS n FROM backup_runs').get().n,1);
  }finally{db.close()}
});

test('successful and failed connection tests do not record outcomes; real manual backups record their target and trigger',async()=>{
  const source=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
  const start=source.indexOf("  if (/^\\/api\\/backup\\/targets\\/[^/]+\\/(test|run)$/.test(path)");assert.ok(start>0);
  const branch=source.slice(start,source.indexOf("  if (path === '/api/admin/users'",start));
  const outcome=source.slice(source.indexOf('function saveBackupOutcome('),source.indexOf('function staticFile('));
  const db=new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE backup_targets(id TEXT PRIMARY KEY,user_id TEXT,name TEXT,kind TEXT,last_run_at TEXT,last_success_at TEXT,last_error TEXT);CREATE TABLE backup_runs(id TEXT PRIMARY KEY,target_id TEXT,user_id TEXT,status TEXT,message TEXT,created_at TEXT,operation TEXT,target_name TEXT,target_kind TEXT,trigger_kind TEXT);INSERT INTO backup_targets(id,user_id,name,kind) VALUES('target','owner','执行时的名称','webdav');`);
  const save=new Function('db','now','safeText','randomUUID','pruneBackupRuns',outcome+';return saveBackupOutcome;')(db,()=> '2026-11-09T03:00:00.000Z',value=>value,randomUUID,()=>{});
  let mode='success';const calls=[];
  const handler=new Function('db','user','req','res','limited','runExternalBackup','saveBackupOutcome','json','error','path','method',`return (async()=>{${branch}})();`);
  const call=action=>handler(db,{id:'owner'},{},{},()=>false,async(target,test)=>{calls.push(test);if(mode==='failure')throw new Error('上传失败')},save,(_res,status,value)=>({status,value}),(_res,status,message)=>({status,message}),`/api/backup/targets/target/${action}`,'POST');
  try{
    assert.equal((await call('test')).status,200);mode='failure';assert.equal((await call('test')).status,400);
    assert.equal(db.prepare('SELECT count(*) AS n FROM backup_runs').get().n,0);assert.equal(db.prepare('SELECT last_run_at FROM backup_targets').get().last_run_at,null);
    mode='success';assert.equal((await call('run')).status,200);
    const row=db.prepare('SELECT * FROM backup_runs').get();assert.equal(row.operation,'backup');assert.equal(row.target_name,'执行时的名称');assert.equal(row.target_kind,'webdav');assert.equal(row.trigger_kind,'manual');assert.equal(row.status,'success');assert.deepEqual(calls,[true,true,false]);
  }finally{db.close()}
});
