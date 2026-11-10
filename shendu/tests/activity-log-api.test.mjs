import {after,before,beforeEach,test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtempSync,rmSync,readFileSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,randomUUID,createCipheriv,createDecipheriv,pbkdf2Sync} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import net from 'node:net';
import {DatabaseSync} from 'node:sqlite';
import {reviewQuestions} from '../public/review-schema.js';
import {verificationMinimum} from '../public/verification-policy.js';

const appDir=fileURLToPath(new URL('../',import.meta.url)),tempParent=realpathSync(tmpdir()),root=mkdtempSync(join(tempParent,'shendu-activity-'));
const password='activity-test-'+randomBytes(16).toString('hex'),source=readFileSync(join(appDir,'server.mjs'),'utf8');
let child,base,ownerCookie,cookie,userId,db,today,index=0;
async function api(path,{method='GET',body,auth=cookie,headers={}}={}){
  const response=await fetch(base+path,{method,headers:{...(auth?{Cookie:auth}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},body:body===undefined?undefined:JSON.stringify(body)});
  const text=await response.text();let value;try{value=JSON.parse(text)}catch{value=text}
  return{status:response.status,value,text,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
async function start(){
  const listener=net.createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));base=`http://127.0.0.1:${port}`;
  child=spawn(process.execPath,['server.mjs'],{cwd:appDir,env:{...process.env,SHENDU_PORT:String(port),SHENDU_DATA_DIR:root,SHENDU_MASTER_KEY:'',SHENDU_MASTER_KEY_PATH:join(root,'backup-master.key'),SHENDU_SECURE_COOKIE:'false'},stdio:['ignore','pipe','pipe']});
  let logs='';child.stdout.on('data',value=>{logs+=value});child.stderr.on('data',value=>{logs+=value});
  let ready=false;for(let attempt=0;attempt<200&&!ready;attempt++){try{ready=(await fetch(base+'/healthz')).ok}catch{}if(!ready)await new Promise(resolve=>setTimeout(resolve,20));}assert.ok(ready,logs);
}
async function stop(){if(child&&child.exitCode===null){const ended=once(child,'exit');child.kill('SIGTERM');await ended}}
const rows=()=>db.prepare('SELECT * FROM activity_events WHERE user_id=? ORDER BY created_at DESC,id DESC').all(userId);
const log=async()=>{const result=await api('/api/activity');assert.equal(result.status,200,result.text);return result.value.entries};
function period(type){
  if(type==='monthly')return today.slice(0,7);if(type==='yearly')return today.slice(0,4);if(type!=='weekly')return today;
  const date=new Date(today+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+4-(date.getUTCDay()||7));const first=new Date(Date.UTC(date.getUTCFullYear(),0,1,12));return `${date.getUTCFullYear()}-W${String(Math.ceil((((date-first)/86400000)+1)/7)).padStart(2,'0')}`;
}
async function draft(type='daily'){
  const result=await api('/api/records',{method:'PUT',body:{type,period:period(type),title:'NEVER_LOG_PRIVATE_TITLE',data:{answers:Object.fromEntries(reviewQuestions(type).map(question=>[question.id,['NEVER_LOG_PRIVATE_BODY']])),action:'NEVER_LOG_ACTION_BODY',ifCondition:'障碍',ifThen:'应对',verifyDate:verificationMinimum(type,today)}}});assert.equal(result.status,200,result.text);return result.value.record;
}
function insertEvent({id=randomUUID(),owner=userId,action='preferences_updated',stamp=new Date().toISOString(),recordType=null,periodValue=null,targetKind=null}={}){
  db.prepare('INSERT INTO activity_events(id,user_id,action,record_type,period,target_kind,created_at) VALUES(?,?,?,?,?,?,?)').run(id,owner,action,recordType,periodValue,targetKind,stamp);return id;
}
function decodeSite(text){const {tag,data,...header}=JSON.parse(text),key=pbkdf2Sync(password,Buffer.from(header.kdf.salt,'base64'),600000,32,'sha256'),decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(header.cipher.iv,'base64'));decipher.setAAD(Buffer.from(JSON.stringify(header)));decipher.setAuthTag(Buffer.from(tag,'base64'));return JSON.parse(gunzipSync(Buffer.concat([decipher.update(Buffer.from(data,'base64')),decipher.final()])))}
function encodeSite(text,payload){const {tag,data,...header}=JSON.parse(text),key=pbkdf2Sync(password,Buffer.from(header.kdf.salt,'base64'),600000,32,'sha256'),cipher=createCipheriv('aes-256-gcm',key,Buffer.from(header.cipher.iv,'base64'));cipher.setAAD(Buffer.from(JSON.stringify(header)));const bytes=Buffer.concat([cipher.update(gzipSync(Buffer.from(JSON.stringify(payload)))),cipher.final()]);return JSON.stringify({...header,tag:cipher.getAuthTag().toString('base64'),data:bytes.toString('base64')})}

before(async()=>{
  await start();const registered=await api('/api/auth/register',{method:'POST',auth:'',body:{username:'activity_owner',password}});assert.equal(registered.status,201,registered.text);ownerCookie=registered.cookie;
  db=new DatabaseSync(join(root,'shendu.db'));db.exec('PRAGMA busy_timeout=5000');today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
});
beforeEach(async()=>{
  const username=`activity_member_${++index}`;assert.equal((await api('/api/admin/users',{method:'POST',auth:ownerCookie,body:{username,password}})).status,201);
  const login=await api('/api/auth/login',{method:'POST',auth:'',body:{username,password}});assert.equal(login.status,200,login.text);cookie=login.cookie;userId=login.value.user.id;
  db.prepare('DELETE FROM activity_events WHERE user_id=?').run(userId);
});
after(async()=>{db?.close();await stop();assert.equal(realpathSync(dirname(root)),tempParent);assert.ok(basename(root).startsWith('shendu-activity-'));rmSync(root,{recursive:true,force:true})});

test('all six review lifecycles emit truthful metadata and never persist their private content',async()=>{
  for(const type of ['daily','weekly','monthly','quarterly','yearly','decision']){
    let record=await draft(type);const saved=await api('/api/records',{method:'PUT',body:{...record,title:'ANOTHER_PRIVATE_TITLE'}});assert.equal(saved.status,200,saved.text);record=saved.value.record;
    assert.equal((await api(`/api/records/${record.id}/complete`,{method:'POST'})).status,200);
    const before=rows().length;assert.equal((await api(`/api/records/${record.id}`,{method:'DELETE',body:{version:record.version}})).status,409);assert.equal(rows().length,before);
    db.prepare("UPDATE records SET completed_at='2000-01-01T00:00:00.000Z' WHERE id=?").run(record.id);
    assert.equal((await api(`/api/records/${record.id}/verify`,{method:'POST',body:{result:'NEVER_LOG_PRIVATE_RESULT',adjustment:'NEVER_LOG_PRIVATE_ADJUSTMENT',outcome:'好',process:'好'}})).status,200);
  }
  const remove=await draft('decision');assert.equal((await api(`/api/records/${remove.id}`,{method:'DELETE',body:{version:remove.version}})).status,200);
  const events=await log();assert.equal(events.filter(event=>event.action==='draft_saved').length,13);assert.equal(events.filter(event=>event.action==='review_completed').length,6);assert.equal(events.filter(event=>event.action==='action_verified').length,6);assert.equal(events.filter(event=>event.action==='draft_deleted').length,1);
  for(const event of events){assert.deepEqual(Object.keys(event).sort(),['id','action','recordType','period','targetKind','createdAt'].sort());assert.ok(['daily','weekly','monthly','quarterly','yearly','decision'].includes(event.recordType));assert.equal(event.period,period(event.recordType));assert.equal(event.targetKind,null)}
  assert.doesNotMatch(JSON.stringify(rows()),/PRIVATE|ACTION_BODY/);assert.doesNotMatch(JSON.stringify(events),/PRIVATE|ACTION_BODY/);
});

test('day windows are Beijing civil dates and keyset pages remain complete without foreign cursors',async()=>{
  const start=new Date(today+'T00:00:00+08:00').toISOString(),end=new Date(Date.parse(start)+86400000).toISOString(),expected=[];
  for(let i=0;i<121;i++)expected.push(insertEvent({stamp:start}));
  const earlier=insertEvent({stamp:new Date(Date.parse(start)-1).toISOString()}),later=insertEvent({stamp:end}),future=insertEvent({stamp:new Date(Date.now()+3600000).toISOString()});
  expected.sort((a,b)=>b.localeCompare(a));const collected=[];let cursor='',pages=0;
  do{const result=await api(`/api/activity?date=${today}&limit=9999${cursor?'&cursor='+cursor:''}`);assert.equal(result.status,200,result.text);assert.equal(result.value.date,today);assert.ok(result.value.entries.length<=50);collected.push(...result.value.entries.map(event=>event.id));cursor=result.value.nextCursor;pages++}while(cursor);
  assert.equal(pages,3);assert.deepEqual(collected,expected);assert.equal(new Set(collected).size,121);assert.ok(!collected.includes(earlier)&&!collected.includes(later)&&!collected.includes(future));
  const ownerId=db.prepare("SELECT id FROM users WHERE username='activity_owner'").get().id,foreign=insertEvent({owner:ownerId,stamp:start});
  for(const id of [foreign,earlier,later,randomUUID()])assert.equal((await api(`/api/activity?date=${today}&cursor=${id}`)).status,404);
  for(const value of ['','2026-02-30','2026-13-01','2026-1-01','x'])assert.equal((await api('/api/activity?date='+value)).status,400);
  for(const value of ['',"' OR 1=1",'not-a-uuid'])assert.equal((await api(`/api/activity?date=${today}&cursor=${encodeURIComponent(value)}`)).status,400);
  assert.equal((await api('/api/activity',{auth:''})).status,401);assert.equal((await api('/api/activity',{headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);
  assert.equal((await api('/api/activity',{method:'POST',body:{action:'review_completed'}})).status,404);assert.equal(rows().length,124,'reads and rejected writes never create use-log entries');
});

test('settings, authentication and password changes log their operation without values',async()=>{
  const me=(await api('/api/me')).value;
  assert.equal((await api('/api/settings',{method:'PUT',body:{stage:{...me.stage,focus:'NEVER_LOG_PRIVATE_FOCUS'},theme:{...me.theme,reduceMotion:true}}})).status,200);
  assert.equal((await api('/api/backup/password',{method:'POST',body:{password}})).status,200);
  const invalid=await api('/api/me/password',{method:'POST',body:{currentPassword:'bad',newPassword:password+'x'}});assert.equal(invalid.status,400);
  assert.equal((await api('/api/me/password',{method:'POST',body:{currentPassword:password,newPassword:password+'x'}})).status,200);
  const login=await api('/api/auth/login',{method:'POST',auth:'',body:{username:`activity_member_${index}`,password:password+'x'}});cookie=login.cookie;assert.equal(login.status,200);
  assert.equal((await api('/api/auth/logout',{method:'POST'})).status,200);assert.equal((await api('/api/auth/logout',{method:'POST'})).status,200);
  const actions=rows().map(event=>event.action);for(const kind of ['stage_updated','preferences_updated','backup_password_updated','password_updated','login','logout'])assert.equal(actions.filter(action=>action===kind).length,1);
  assert.doesNotMatch(JSON.stringify(rows()),/PRIVATE_FOCUS|activity-test|reduceMotion/);assert.ok(rows().every(event=>Object.keys(event).every(key=>!['password','newPassword','currentPassword'].includes(key))));
});

test('target changes and real backup failures log once, while connection tests and inspections do not',async()=>{
  const config={endpoint:'https://storage.example.com',region:'auto',bucket:'test-bucket',accessKey:'NEVER_LOG_ACCESS_KEY',secretKey:'NEVER_LOG_SECRET_KEY',directory:'shendu'};
  const created=await api('/api/backup/targets',{method:'POST',body:{name:'NEVER_LOG_TARGET_NAME',kind:'s3',config,schedule:'manual',enabled:false}});assert.equal(created.status,201,created.text);const id=created.value.id;
  assert.equal((await api(`/api/backup/targets/${id}`,{method:'PATCH',body:{name:'PRIVATE_RENAME'}})).status,200);
  assert.equal((await api(`/api/backup/targets/${id}/test`,{method:'POST'})).status,400);assert.equal(rows().filter(event=>event.action.startsWith('backup_')).length,2);
  assert.equal((await api(`/api/backup/targets/${id}/run`,{method:'POST'})).status,400);assert.equal(rows().filter(event=>event.action==='backup_failed').length,1);
  assert.equal((await api('/api/data/inspect',{method:'POST',body:{encryptedBackup:'invalid',password}})).status,400);
  assert.equal((await api(`/api/backup/targets/${id}`,{method:'DELETE'})).status,200);assert.equal((await api(`/api/backup/targets/${id}`,{method:'DELETE'})).status,200);
  assert.deepEqual(rows().map(event=>event.action).sort(),['backup_target_created','backup_target_updated','backup_target_deleted','backup_failed'].sort());assert.ok(rows().every(event=>event.target_kind==='s3'));
  assert.doesNotMatch(JSON.stringify(rows()),/PRIVATE|NEVER_LOG|SECRET|ACCESS/);
});

test('an event write failure rolls back the associated mutation rather than reporting a partial operation',async()=>{
  db.exec("CREATE TRIGGER fail_activity BEFORE INSERT ON activity_events WHEN NEW.action='draft_saved' BEGIN SELECT RAISE(ABORT,'fixture event failure'); END");
  try{const failed=await api('/api/records',{method:'PUT',body:{type:'daily',period:today,title:'NEVER_LOG_PRIVATE_TITLE',data:{}}});assert.equal(failed.status,500);assert.equal(db.prepare('SELECT count(*) AS n FROM records WHERE user_id=?').get(userId).n,0);assert.equal(rows().length,0)}finally{db.exec('DROP TRIGGER fail_activity')}
  const record=await draft(),before=db.prepare('SELECT * FROM records WHERE id=?').get(record.id),eventCount=rows().length;
  db.exec("CREATE TRIGGER fail_activity BEFORE INSERT ON activity_events WHEN NEW.action='draft_deleted' BEGIN SELECT RAISE(ABORT,'fixture event failure'); END");
  try{assert.equal((await api(`/api/records/${record.id}`,{method:'DELETE',body:{version:record.version}})).status,500);assert.deepEqual(db.prepare('SELECT * FROM records WHERE id=?').get(record.id),before);assert.equal(rows().length,eventCount)}finally{db.exec('DROP TRIGGER fail_activity')}
  const stageBefore=db.prepare("SELECT value FROM user_settings WHERE user_id=? AND key='stage'").get(userId).value;
  db.exec("CREATE TRIGGER fail_activity BEFORE INSERT ON activity_events WHEN NEW.action='stage_updated' BEGIN SELECT RAISE(ABORT,'fixture event failure'); END");
  try{assert.equal((await api('/api/settings',{method:'PUT',body:{stage:{focus:'must roll back'}}})).status,500);assert.equal(db.prepare("SELECT value FROM user_settings WHERE user_id=? AND key='stage'").get(userId).value,stageBefore)}finally{db.exec('DROP TRIGGER fail_activity')}
});

test('personal exports and restores record generated/imported operations, leaving failed requests unlogged',async()=>{
  await draft();assert.equal((await api('/api/backup/export',{method:'POST',body:{}})).status,400);assert.equal(rows().filter(event=>event.action==='data_exported').length,0);
  assert.equal((await api('/api/backup/password',{method:'POST',body:{password}})).status,200);
  const exported=await api('/api/backup/export',{method:'POST',body:{}});assert.equal(exported.status,200,exported.text);assert.equal(rows().filter(event=>event.action==='data_exported').length,1);
  const imported=await api('/api/data/import',{method:'POST',body:{encryptedBackup:exported.text,password,mode:'merge'}});assert.equal(imported.status,200,imported.text);assert.equal(rows().filter(event=>event.action==='data_imported').length,1);
});

test('whole-site backups preserve optional validated activity and restore atomically with old-file compatibility',async()=>{
  insertEvent({action:'draft_deleted',recordType:'weekly',periodValue:'2026-W01'});
  const exported=await api('/api/admin/site-backup/export',{method:'POST',auth:ownerCookie,body:{currentPassword:password,backupPassword:password}});assert.equal(exported.status,200,exported.text);const payload=decodeSite(exported.text),event=payload.activity.find(event=>event.user_id===userId);
  assert.ok(event);assert.equal(payload.schemaVersion,8);assert.equal(db.prepare("SELECT value FROM schema_meta WHERE key='schema_version'").get().value,'8');assert.doesNotMatch(JSON.stringify(payload.activity),/PRIVATE|NEVER_LOG|SECRET/);
  const before=db.prepare('SELECT * FROM activity_events ORDER BY id').all();
  for(const alter of [row=>{row.user_id=randomUUID()},row=>{row.action='fake_operation'},row=>{row.created_at='not-a-time'},row=>{row.period='PRIVATE_BODY'}]){
    const invalid=structuredClone(payload);alter(invalid.activity[0]);const inspected=await api('/api/admin/site-backup/inspect',{method:'POST',auth:ownerCookie,body:{encryptedBackup:encodeSite(exported.text,invalid),backupPassword:password}});assert.equal(inspected.status,400,inspected.text);assert.deepEqual(db.prepare('SELECT * FROM activity_events ORDER BY id').all(),before);
  }
  const encoded=encodeSite(exported.text,payload),restored=await api('/api/admin/site-backup/restore',{method:'POST',auth:ownerCookie,body:{encryptedBackup:encoded,currentPassword:password,backupPassword:password,confirmation:'RESTORE_SITE'}});assert.equal(restored.status,200,restored.text);
  assert.equal(db.prepare('SELECT count(*) AS n FROM activity_events WHERE id=?').get(event.id).n,1);assert.equal(db.prepare("SELECT count(*) AS n FROM activity_events WHERE action='site_imported'").get().n,1);
  let login=await api('/api/auth/login',{method:'POST',auth:'',body:{username:'activity_owner',password}});ownerCookie=login.cookie;
  const legacy=structuredClone(payload);delete legacy.activity;
  const legacyResult=await api('/api/admin/site-backup/restore',{method:'POST',auth:ownerCookie,body:{encryptedBackup:encodeSite(exported.text,legacy),currentPassword:password,backupPassword:password,confirmation:'RESTORE_SITE'}});assert.equal(legacyResult.status,200,legacyResult.text);assert.equal(db.prepare('SELECT count(*) AS n FROM activity_events').get().n,1,'legacy restore starts new history without fabricated old events');
  login=await api('/api/auth/login',{method:'POST',auth:'',body:{username:'activity_owner',password}});ownerCookie=login.cookie;
});

test('startup adds an empty activity table to an old database without reconstructing old actions',async()=>{
  await stop();db.exec("DROP TABLE activity_events;UPDATE schema_meta SET value='7' WHERE key='schema_version'");await start();
  assert.equal(db.prepare("SELECT value FROM schema_meta WHERE key='schema_version'").get().value,'8');assert.equal(db.prepare('SELECT count(*) AS n FROM activity_events').get().n,0);
  const login=await api('/api/auth/login',{method:'POST',auth:'',body:{username:'activity_owner',password}});ownerCookie=login.cookie;assert.equal(login.status,200);assert.equal(db.prepare('SELECT count(*) AS n FROM activity_events').get().n,1);
});
