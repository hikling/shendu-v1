import {after,before,beforeEach,test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,randomUUID,createCipheriv,createDecipheriv,pbkdf2Sync} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import net from 'node:net';
import {DatabaseSync} from 'node:sqlite';
import {backupHistoryCutoff} from '../public/backup-schedule.js';

const appDir=fileURLToPath(new URL('../',import.meta.url)),root=mkdtempSync(join(tmpdir(),'shendu-backup-schedule-'));
const password='schedule-test-'+randomBytes(16).toString('hex');
const source=readFileSync(join(appDir,'server.mjs'),'utf8');
let child,base,ownerCookie,cookie,userId,db,index=0;
async function api(path,{method='GET',body,auth=cookie}={}){
  const response=await fetch(base+path,{method,headers:{...(auth?{Cookie:auth}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
  const text=await response.text();let value;try{value=JSON.parse(text)}catch{value=text}
  return{status:response.status,value,text,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
const config={endpoint:'https://storage.example.com',region:'auto',bucket:'my-backups',accessKey:'test-access-key',secretKey:'test-secret-key',directory:'自己的目录',pathStyle:true};
async function target(extra={}){
  const result=await api('/api/backup/targets',{method:'POST',body:{name:'自己的对象存储',kind:'s3',schedule:'manual',enabled:false,config,...extra}});
  assert.equal(result.status,201,result.text);return result.value.id;
}
function insertRun(targetId,{stamp=new Date().toISOString(),operation='backup',status='success',message='备份成功',name='原目标名称',kind='s3',trigger='manual'}={}){
  const id=randomUUID();db.prepare(`INSERT INTO backup_runs(id,target_id,user_id,status,message,created_at,operation,target_name,target_kind,trigger_kind) VALUES(?,?,?,?,?,?,?,?,?,?)`).run(id,targetId,userId,status,message,stamp,operation,name,kind,trigger);return id;
}
function decodeSite(text){
  const {tag,data,...header}=JSON.parse(text),key=pbkdf2Sync(password,Buffer.from(header.kdf.salt,'base64'),600000,32,'sha256'),decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(header.cipher.iv,'base64'));
  decipher.setAAD(Buffer.from(JSON.stringify(header)));decipher.setAuthTag(Buffer.from(tag,'base64'));
  return JSON.parse(gunzipSync(Buffer.concat([decipher.update(Buffer.from(data,'base64')),decipher.final()])));
}
function encodeSite(text,payload){
  const {tag,data,...header}=JSON.parse(text),key=pbkdf2Sync(password,Buffer.from(header.kdf.salt,'base64'),600000,32,'sha256'),cipher=createCipheriv('aes-256-gcm',key,Buffer.from(header.cipher.iv,'base64'));
  cipher.setAAD(Buffer.from(JSON.stringify(header)));const bytes=Buffer.concat([cipher.update(gzipSync(Buffer.from(JSON.stringify(payload)))),cipher.final()]);
  return JSON.stringify({...header,tag:cipher.getAuthTag().toString('base64'),data:bytes.toString('base64')});
}

before(async()=>{
  const listener=net.createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));base=`http://127.0.0.1:${port}`;
  child=spawn(process.execPath,['server.mjs'],{cwd:appDir,env:{...process.env,SHENDU_PORT:String(port),SHENDU_DATA_DIR:root,SHENDU_MASTER_KEY:'',SHENDU_MASTER_KEY_PATH:join(root,'backup-master.key'),SHENDU_SECURE_COOKIE:'false'},stdio:['ignore','pipe','pipe']});
  let logs='';child.stdout.on('data',value=>{logs+=value});child.stderr.on('data',value=>{logs+=value});
  let ready=false;for(let attempt=0;attempt<200&&!ready;attempt++){try{ready=(await fetch(base+'/healthz')).ok}catch{}if(!ready)await new Promise(resolve=>setTimeout(resolve,20));}assert.ok(ready,logs);
  const registration=await api('/api/auth/register',{method:'POST',auth:'',body:{username:'schedule_owner',password}});assert.equal(registration.status,201);cookie=ownerCookie=registration.cookie;
  db=new DatabaseSync(join(root,'shendu.db'));db.exec('PRAGMA busy_timeout=5000');
});
beforeEach(async()=>{
  const username=`schedule_member_${++index}`;
  assert.equal((await api('/api/admin/users',{method:'POST',auth:ownerCookie,body:{username,password}})).status,201);
  const login=await api('/api/auth/login',{method:'POST',auth:'',body:{username,password}});assert.equal(login.status,200);cookie=login.cookie;userId=login.value.user.id;
});
after(async()=>{db?.close();if(child&&child.exitCode===null){const stopped=once(child,'exit');child.kill('SIGTERM');await stopped;}rmSync(root,{recursive:true,force:true});});

test('target API persists explicit schedules, safe edit fields and encrypted credentials',async()=>{
  const id=await target({schedule:'weekly',scheduleTime:'23:41',scheduleWeekday:7});
  let value=(await api('/api/backup/targets')).value.targets[0];
  assert.equal(value.schedule,'weekly');assert.equal(value.scheduleTime,'23:41');assert.equal(value.scheduleWeekday,7);
  assert.deepEqual(value.config,{endpoint:config.endpoint,region:config.region,bucket:config.bucket,directory:config.directory,pathStyle:true});
  assert.equal(JSON.stringify(value).includes(config.accessKey),false);assert.equal(JSON.stringify(value).includes(config.secretKey),false);
  assert.equal(db.prepare('SELECT encrypted_config FROM backup_targets WHERE id=?').get(id).encrypted_config.includes(config.secretKey),false);
  assert.equal((await api(`/api/backup/targets/${id}`,{method:'PATCH',body:{scheduleTime:'03:25',name:'改名'}})).status,200);
  value=(await api('/api/backup/targets')).value.targets[0];assert.equal(value.scheduleWeekday,7);assert.equal(value.scheduleTime,'03:25');assert.equal(value.enabled,0,'editing does not silently enable a disabled target');
  for(const invalid of [{schedule:'sometimes'},{scheduleTime:'25:00'},{scheduleTime:'02:75'},{scheduleTime:'9:00'},{scheduleWeekday:0},{scheduleWeekday:8}]){
    const result=await api(`/api/backup/targets/${id}`,{method:'PATCH',body:invalid});assert.equal(result.status,400,result.text);assert.equal(result.value.error,'backup_schedule_invalid');
  }
  const rejected=await api('/api/backup/targets',{method:'POST',body:{name:'invalid',kind:'s3',config,schedule:'daily',scheduleTime:'99:99'}});assert.equal(rejected.status,400);
  const other=await api(`/api/backup/targets/${id}`,{method:'PATCH',auth:ownerCookie,body:{name:'越权'}});assert.equal(other.status,404);
});

test('connection tests never enter backup history or change backup status, while manual failures do',async()=>{
  const id=await target();
  const before=db.prepare('SELECT last_run_at,last_success_at,last_error,last_scheduled_slot FROM backup_targets WHERE id=?').get(id);
  const testResult=await api(`/api/backup/targets/${id}/test`,{method:'POST'});assert.equal(testResult.status,400);assert.match(testResult.value.message,/备份密码/);
  assert.deepEqual(db.prepare('SELECT last_run_at,last_success_at,last_error,last_scheduled_slot FROM backup_targets WHERE id=?').get(id),before);
  assert.equal((await api('/api/backup/targets')).value.runs.length,0);
  const result=await api(`/api/backup/targets/${id}/run`,{method:'POST'});assert.equal(result.status,400);
  const runs=(await api('/api/backup/targets')).value.runs;assert.equal(runs.length,1);assert.equal(runs[0].status,'error');assert.equal(runs[0].target_name,'自己的对象存储');assert.equal(runs[0].target_kind,'s3');assert.equal(runs[0].trigger,'manual');assert.equal(runs[0].operation,'backup');
  assert.equal(db.prepare('SELECT last_scheduled_slot FROM backup_targets WHERE id=?').get(id).last_scheduled_slot,null);
  const failedState=db.prepare('SELECT last_run_at,last_success_at,last_error FROM backup_targets WHERE id=?').get(id);
  await api(`/api/backup/targets/${id}/test`,{method:'POST'});assert.deepEqual(db.prepare('SELECT last_run_at,last_success_at,last_error FROM backup_targets WHERE id=?').get(id),failedState);
});

test('history returns all real outcomes in ten Beijing days with snapshotted target identity and account isolation',async()=>{
  const id=await target(),cutoff=backupHistoryCutoff();
  const included=insertRun(id,{stamp:cutoff,message:'边界备份成功'}),expired=insertRun(id,{stamp:new Date(Date.parse(cutoff)-1).toISOString()});
  const future=insertRun(id,{stamp:new Date(Date.now()+86400000).toISOString()});
  const tested=insertRun(id,{operation:'test',message:'连接测试成功'}),unknown=insertRun(id,{operation:'legacy',message:'无法辨识的旧失败',status:'error'});
  for(let index=0;index<22;index++)insertRun(id,{stamp:new Date(Date.now()-index*1000).toISOString(),status:index%2?'error':'success',trigger:index%2?'scheduled':'manual'});
  await api(`/api/backup/targets/${id}`,{method:'PATCH',body:{name:'改名后的目标'}});
  const response=await api('/api/backup/targets');assert.equal(response.status,200);assert.equal(response.value.runs.length,23,'history is not capped at the previous12 rows');
  assert.ok(response.value.runs.some(row=>row.id===included));assert.equal(response.value.runs.some(row=>row.id===future),false,'future rows are not recent history');assert.ok(response.value.runs.every(row=>row.target_name==='原目标名称'&&row.target_kind==='s3'));
  assert.equal((await api('/api/backup/targets',{auth:ownerCookie})).value.runs.length,0);
  for(const removed of [expired,tested,unknown])assert.equal(db.prepare('SELECT id FROM backup_runs WHERE id=?').get(removed),undefined);
});

test('old database migration is additive, anchors schedules now and does not invent ambiguous backup events',()=>{
  const fixture=new DatabaseSync(':memory:');
  fixture.exec(`CREATE TABLE backup_targets(id TEXT PRIMARY KEY,name TEXT,kind TEXT,encrypted_config TEXT,created_at TEXT,last_run_at TEXT,last_success_at TEXT,last_error TEXT);CREATE TABLE backup_runs(id TEXT PRIMARY KEY,target_id TEXT,status TEXT,message TEXT,created_at TEXT);INSERT INTO backup_targets VALUES('t','旧目标','webdav','retain-encrypted-bytes','2020-01-01T00:00:00Z','2026-11-08T01:00:00Z','2026-11-08T01:00:00Z',NULL),('only-test','只有测试','s3','retain-other-bytes','2020-01-01T00:00:00Z','2026-11-08T01:00:00Z','2026-11-08T01:00:00Z',NULL);INSERT INTO backup_runs VALUES('ok','t','success','备份成功','2026-11-08T00:00:00Z'),('scheduled','t','success','定时备份成功','2026-11-07T00:00:00Z'),('test','t','success','连接测试成功','2026-11-08T01:00:00Z'),('unknown','t','error','上传失败','2026-11-08T00:30:00Z'),('test-only','only-test','success','连接测试成功','2026-11-08T01:00:00Z');`);
  const implementation=source.slice(source.indexOf('function migrateBackupSchedules('),source.indexOf("const DATA_ENVELOPE_PREFIX =")),start=new Date().toISOString();
  try{
    const migrate=new Function('db',implementation+';return migrateBackupSchedules;')(fixture);migrate();
    const target=fixture.prepare("SELECT * FROM backup_targets WHERE id='t'").get();assert.equal(target.encrypted_config,'retain-encrypted-bytes');assert.equal(target.schedule_time,'02:00');assert.equal(target.schedule_weekday,1);assert.ok(target.schedule_anchor_at>=start);
    assert.equal(target.last_run_at,'2026-11-08T00:00:00Z');assert.equal(target.last_success_at,'2026-11-08T00:00:00Z');
    const onlyTest=fixture.prepare("SELECT last_run_at,last_success_at FROM backup_targets WHERE id='only-test'").get();assert.equal(onlyTest.last_run_at,null);assert.equal(onlyTest.last_success_at,null);
    const runs=fixture.prepare('SELECT id,operation,trigger_kind,target_name,target_kind FROM backup_runs ORDER BY id').all();
    assert.equal(runs.find(row=>row.id==='test').operation,'legacy');assert.equal(runs.find(row=>row.id==='unknown').operation,'legacy');
    assert.equal(runs.find(row=>row.id==='scheduled').trigger_kind,'scheduled');assert.equal(runs.find(row=>row.id==='ok').target_kind,'webdav');
    const anchor=target.schedule_anchor_at;migrate();assert.equal(fixture.prepare('SELECT schedule_anchor_at FROM backup_targets').get().schedule_anchor_at,anchor,'migration is idempotent');
  }finally{fixture.close()}
});

test('site backup restore preserves new schedule/log metadata, canonicalizes timestamps and accepts legacy targets',async()=>{
  const id=await target({schedule:'weekly',scheduleTime:'06:20',scheduleWeekday:4});insertRun(id,{trigger:'scheduled',status:'error',message:'定时上传失败'});
  db.prepare('UPDATE backup_targets SET schedule_claim_token=?,schedule_claim_until=? WHERE id=?').run('transient-owner',new Date(Date.now()+300000).toISOString(),id);
  const exported=await api('/api/admin/site-backup/export',{method:'POST',auth:ownerCookie,body:{currentPassword:password,backupPassword:password}});assert.equal(exported.status,200,exported.text);
  const payload=decodeSite(exported.text),stored=payload.targets.find(row=>row.id===id);assert.equal(stored.scheduleTime,'06:20');assert.equal(stored.scheduleWeekday,4);
  assert.equal(Object.hasOwn(stored,'schedule_claim_token'),false);assert.equal(Object.hasOwn(stored,'schedule_claim_until'),false);
  const history=payload.runs.find(row=>row.target_id===id);assert.equal(history.target_kind,'s3');assert.equal(history.trigger,'scheduled');
  const cutoff=backupHistoryCutoff(),offset=stamp=>new Date(Date.parse(stamp)+8*3600000).toISOString().replace('Z','+08:00');
  history.created_at=offset(cutoff);payload.runs.push({...history,id:randomUUID(),created_at:offset(new Date(Date.parse(cutoff)-1).toISOString())});
  delete stored.scheduleTime;delete stored.scheduleWeekday;delete stored.schedule_anchor_at;delete stored.last_scheduled_slot;
  const beforeRestore=new Date().toISOString();
  const restored=await api('/api/admin/site-backup/restore',{method:'POST',auth:ownerCookie,body:{encryptedBackup:encodeSite(exported.text,payload),currentPassword:password,backupPassword:password,confirmation:'RESTORE_SITE'}});assert.equal(restored.status,200,restored.text);
  const login=await api('/api/auth/login',{method:'POST',auth:'',body:{username:'schedule_owner',password}});ownerCookie=login.cookie;
  const member=await api('/api/auth/login',{method:'POST',auth:'',body:{username:`schedule_member_${index}`,password}});cookie=member.cookie;
  const targetRow=db.prepare('SELECT * FROM backup_targets WHERE id=?').get(id);assert.equal(targetRow.schedule_time,'02:00');assert.equal(targetRow.schedule_weekday,1);assert.ok(targetRow.schedule_anchor_at>=beforeRestore);assert.equal(targetRow.schedule_claim_token,null);assert.equal(targetRow.schedule_claim_until,null);
  const runs=(await api('/api/backup/targets')).value.runs;assert.equal(runs.length,1);assert.equal(runs[0].created_at,cutoff);assert.equal(runs[0].target_name,'原目标名称');assert.equal(runs[0].trigger,'scheduled');
});
