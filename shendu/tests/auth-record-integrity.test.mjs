import {after,before,beforeEach,test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtempSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,randomUUID} from 'node:crypto';
import net from 'node:net';
import {DatabaseSync} from 'node:sqlite';

const appDir=fileURLToPath(new URL('../',import.meta.url)),tempParent=realpathSync(tmpdir());
const root=mkdtempSync(join(tempParent,'shendu-auth-record-integrity-'));
const password='integrity-test-'+randomBytes(16).toString('hex');
const types=['daily','weekly','monthly','quarterly','yearly','decision'];
let child,base,cookie,memberCookie,ownerId,db,today,accountIndex=0;

async function api(path,{method='GET',body,auth=cookie}={}){
  const response=await fetch(base+path,{method,headers:{...(auth?{Cookie:auth}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
  const text=await response.text();let value;try{value=JSON.parse(text)}catch{value=text}
  return{status:response.status,value,text,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
function period(type){
  if(type==='monthly')return today.slice(0,7);if(type==='yearly')return today.slice(0,4);if(type!=='weekly')return today;
  const date=new Date(today+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+4-(date.getUTCDay()||7));
  const start=new Date(Date.UTC(date.getUTCFullYear(),0,1,12));return `${date.getUTCFullYear()}-W${String(Math.ceil((((date-start)/86400000)+1)/7)).padStart(2,'0')}`;
}
function pastPeriod(type){return type==='weekly'?'2000-W01':type==='monthly'?'2000-01':type==='yearly'?'2000':'2000-01-01'}
async function create(type='daily',auth=cookie){
  const result=await api('/api/records',{method:'PUT',auth,body:{type,period:period(type),title:'原来的草稿',data:{action:'保留原内容'}}});
  assert.equal(result.status,200,result.text);return result.value.record;
}
async function account(role='member'){
  const username=`integrity_account_${++accountIndex}`;
  const created=await api('/api/admin/users',{method:'POST',body:{username,password,role}});assert.equal(created.status,201,created.text);
  const login=await api('/api/auth/login',{method:'POST',auth:'',body:{username,password}});assert.equal(login.status,200,login.text);
  return{id:login.value.user.id,username,cookie:login.cookie};
}
const row=id=>db.prepare('SELECT * FROM records WHERE id=?').get(id);
const userRow=id=>db.prepare('SELECT * FROM users WHERE id=?').get(id);
const activities=()=>db.prepare('SELECT * FROM activity_events ORDER BY id').all();
const sessions=id=>db.prepare('SELECT * FROM sessions WHERE user_id=? ORDER BY token_hash').all(id);

before(async()=>{
  const listener=net.createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));base=`http://127.0.0.1:${port}`;
  child=spawn(process.execPath,['server.mjs'],{cwd:appDir,env:{...process.env,SHENDU_PORT:String(port),SHENDU_DATA_DIR:root,SHENDU_MASTER_KEY:'',SHENDU_MASTER_KEY_PATH:join(root,'backup-master.key'),SHENDU_SECURE_COOKIE:'false'},stdio:['ignore','pipe','pipe']});
  let logs='';child.stdout.on('data',value=>{logs+=value});child.stderr.on('data',value=>{logs+=value});
  let ready=false;for(let attempt=0;attempt<200&&!ready;attempt++){try{ready=(await fetch(base+'/healthz')).ok}catch{}if(!ready)await new Promise(resolve=>setTimeout(resolve,20));}assert.ok(ready,logs);
  const registered=await api('/api/auth/register',{method:'POST',auth:'',body:{username:'integrity_owner',password}});assert.equal(registered.status,201,registered.text);cookie=registered.cookie;ownerId=registered.value.user.id;
  db=new DatabaseSync(join(root,'shendu.db'));db.exec('PRAGMA busy_timeout=5000');today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
  memberCookie=(await account()).cookie;
});
beforeEach(()=>{db.exec('DELETE FROM records; DELETE FROM activity_events')});
after(async()=>{
  db?.close();if(child&&child.exitCode===null){const stopped=once(child,'exit');child.kill('SIGTERM');await stopped;}
  assert.equal(dirname(realpathSync(root)),tempParent);assert.ok(basename(root).startsWith('shendu-auth-record-integrity-'));rmSync(root,{recursive:true,force:true});
});

test('all six past-period drafts cannot be relabelled into the current period',async()=>{
  for(const type of types){
    const record=await create(type);db.prepare('UPDATE records SET period=? WHERE id=?').run(pastPeriod(type),record.id);
    const before=row(record.id),events=activities();
    const result=await api('/api/records',{method:'PUT',body:{...record,period:period(type),title:'试图重新提交旧草稿'}});
    assert.equal(result.status,409,`${type}: ${result.text}`);assert.equal(result.value.error,'record_identity_conflict');assert.deepEqual(row(record.id),before);assert.deepEqual(activities(),events);
    const originalPeriod=await api('/api/records',{method:'PUT',body:{...record,period:pastPeriod(type)}});
    assert.equal(originalPeriod.status,400);assert.equal(originalPeriod.value.error,'period_locked');
  }
});

test('saved draft kind is immutable while ordinary saves and version conflicts retain their behavior',async()=>{
  for(const type of types){
    const record=await create(type),otherType=type==='decision'?'daily':'decision',before=row(record.id),events=activities();
    const changedType=await api('/api/records',{method:'PUT',body:{...record,type:otherType,period:period(otherType)}});
    assert.equal(changedType.status,409);assert.equal(changedType.value.error,'record_identity_conflict');assert.deepEqual(row(record.id),before);assert.deepEqual(activities(),events);
    const saved=await api('/api/records',{method:'PUT',body:{...record,title:'同周期的新内容'}});assert.equal(saved.status,200,saved.text);assert.equal(saved.value.record.version,record.version+1);assert.equal(saved.value.record.title,'同周期的新内容');
    const updated=row(record.id),updatedEvents=activities(),stale=await api('/api/records',{method:'PUT',body:record});
    assert.equal(stale.status,409);assert.equal(stale.value.error,'version_conflict');assert.deepEqual(row(record.id),updated);assert.deepEqual(activities(),updatedEvents);
  }
});

test('duplicate period creates return a conflict without changing drafts, submitted rows or activity',async()=>{
  for(const type of types.filter(value=>value!=='decision')){
    const record=await create(type);
    for(const status of ['draft','completed','verified']){
      db.prepare('UPDATE records SET status=? WHERE id=?').run(status,record.id);const before=row(record.id),events=activities();
      const result=await api('/api/records',{method:'PUT',body:{type,period:period(type),title:'新建相同周期',data:{action:'不可覆盖'}}});
      assert.equal(result.status,409,`${type}/${status}: ${result.text}`);assert.equal(result.value.error,'period_conflict');assert.deepEqual(row(record.id),before);assert.deepEqual(activities(),events);
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM records WHERE user_id=? AND type=?').get(ownerId,type).n,1);
    }
  }
  const first=await create('decision'),second=await create('decision');assert.notEqual(first.id,second.id,'same-day decisions remain independent records');
  const memberRecord=await create('daily',memberCookie);assert.notEqual(memberRecord.id,db.prepare("SELECT id FROM records WHERE user_id=? AND type='daily'").get(ownerId).id,'the period constraint is per account');
});

test('locked and foreign records retain their existing denial semantics without mutations',async()=>{
  const record=await create();
  for(const status of ['completed','verified']){
    db.prepare('UPDATE records SET status=? WHERE id=?').run(status,record.id);const before=row(record.id),events=activities();
    const locked=await api('/api/records',{method:'PUT',body:{...record,type:'decision',title:'试图修改已提交记录'}});
    assert.equal(locked.status,409);assert.equal(locked.value.error,'locked');
    const foreign=await api('/api/records',{method:'PUT',auth:memberCookie,body:record});assert.equal(foreign.status,404);assert.equal(foreign.value.error,'record_not_found');assert.deepEqual(row(record.id),before);assert.deepEqual(activities(),events);
  }
  const absent=await api('/api/records',{method:'PUT',body:{...record,id:randomUUID()}});assert.equal(absent.status,404);assert.equal(absent.value.error,'record_not_found');
});

test('a combined account update either commits all fields and revokes sessions or rolls everything back',async()=>{
  const target=await account(),before=userRow(target.id),beforeSessions=sessions(target.id),replacement='replacement-'+randomBytes(16).toString('hex');
  // An injected SQLite write failure exercises the real HTTP transaction, using
  // disposable accounts only, and must not leave the earlier status/role writes.
  db.exec(`CREATE TRIGGER reject_integrity_password BEFORE UPDATE OF password_hash ON users WHEN NEW.id='${target.id}' BEGIN SELECT RAISE(ABORT,'synthetic password update failure'); END`);
  try{
    const failed=await api(`/api/admin/users/${target.id}`,{method:'PATCH',body:{status:'disabled',role:'admin',password:replacement}});
    assert.equal(failed.status,500,failed.text);assert.deepEqual(userRow(target.id),before);assert.deepEqual(sessions(target.id),beforeSessions);assert.equal((await api('/api/me',{auth:target.cookie})).status,200);
  }finally{db.exec('DROP TRIGGER reject_integrity_password')}
  const saved=await api(`/api/admin/users/${target.id}`,{method:'PATCH',body:{status:'active',role:'admin',password:replacement}});assert.equal(saved.status,200,saved.text);
  const updated=userRow(target.id);assert.equal(updated.status,'active');assert.equal(updated.role,'admin');assert.notEqual(updated.password_hash,before.password_hash);assert.equal(updated.session_version,before.session_version+3);assert.deepEqual(sessions(target.id),[]);
  assert.equal((await api('/api/me',{auth:target.cookie})).status,401);
  const login=await api('/api/auth/login',{method:'POST',auth:'',body:{username:target.username,password:replacement}});assert.equal(login.status,200,login.text);assert.equal(login.value.user.role,'admin');
});

test('a session deletion failure rolls back account fields and session version too',async()=>{
  const target=await account(),before=userRow(target.id),beforeSessions=sessions(target.id);
  db.exec(`CREATE TRIGGER reject_integrity_session_delete BEFORE DELETE ON sessions WHEN OLD.user_id='${target.id}' BEGIN SELECT RAISE(ABORT,'synthetic session deletion failure'); END`);
  try{
    const result=await api(`/api/admin/users/${target.id}`,{method:'PATCH',body:{status:'disabled',role:'admin'}});
    assert.equal(result.status,500,result.text);assert.deepEqual(userRow(target.id),before);assert.deepEqual(sessions(target.id),beforeSessions);assert.equal((await api('/api/me',{auth:target.cookie})).status,200);
  }finally{db.exec('DROP TRIGGER reject_integrity_session_delete')}
});

test('account-update atomicity preserves the established administrator boundaries',async()=>{
  const admin=await account('admin'),otherAdmin=await account('admin'),member=await account();
  for(const [auth,id] of [[member.cookie,admin.id],[admin.cookie,otherAdmin.id],[admin.cookie,ownerId],[admin.cookie,admin.id],[cookie,ownerId]]){
    const before=userRow(id),beforeSessions=sessions(id),result=await api(`/api/admin/users/${id}`,{method:'PATCH',auth,body:{status:'disabled',role:'member'}});
    assert.equal(result.status,403,result.text);assert.deepEqual(userRow(id),before);assert.deepEqual(sessions(id),beforeSessions);
  }
});
