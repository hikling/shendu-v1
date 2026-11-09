import {after,before,beforeEach,test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtempSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,randomUUID} from 'node:crypto';
import {request as httpRequest} from 'node:http';
import net from 'node:net';
import {DatabaseSync} from 'node:sqlite';
import {reviewQuestions} from '../public/review-schema.js';
import {verificationMinimum} from '../public/verification-policy.js';

const appDir=fileURLToPath(new URL('../',import.meta.url)),tempParent=realpathSync(tmpdir());
const root=mkdtempSync(join(tempParent,'shendu-record-delete-')),password='delete-test-'+randomBytes(16).toString('hex');
const types=['daily','weekly','monthly','quarterly','yearly','decision'];
let child,base,cookie,memberCookie,db,today;

async function api(path,{method='GET',body,auth=cookie,headers={}}={}){
  const response=await fetch(base+path,{method,headers:{...(auth?{Cookie:auth}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},body:body===undefined?undefined:JSON.stringify(body)});
  const text=await response.text();let value;try{value=JSON.parse(text)}catch{value=text}
  return{status:response.status,value,text,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
function period(type){
  if(type==='monthly')return today.slice(0,7);if(type==='yearly')return today.slice(0,4);if(type!=='weekly')return today;
  const date=new Date(today+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+4-(date.getUTCDay()||7));
  const start=new Date(Date.UTC(date.getUTCFullYear(),0,1,12));return `${date.getUTCFullYear()}-W${String(Math.ceil((((date-start)/86400000)+1)/7)).padStart(2,'0')}`;
}
async function create(type='daily',auth=cookie){
  const result=await api('/api/records',{method:'PUT',auth,body:{type,period:period(type),title:'可删除的草稿',data:{answers:Object.fromEntries(reviewQuestions(type).map(question=>[question.id,['已记录的事实']])),action:'完成具体行动',ifCondition:'遇到阻碍',ifThen:'换一个方法',verifyDate:verificationMinimum(type,today)}}});
  assert.equal(result.status,200,result.text);return result.value.record;
}
const row=id=>db.prepare('SELECT * FROM records WHERE id=?').get(id);
async function remove(record,extra={}){return api(`/api/records/${record.id}`,{method:'DELETE',body:{version:record.version},...extra})}

// Keep the request body open so another real HTTP request can change state
// before DELETE is allowed to commit. Only disposable fixture data is used.
async function pendingDelete(record,auth=cookie){
  const body=JSON.stringify({version:record.version});let request;
  const result=new Promise((resolve,reject)=>{
    request=httpRequest(base+`/api/records/${record.id}`,{method:'DELETE',headers:{Cookie:auth,'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}},response=>{
      let text='';response.setEncoding('utf8');response.on('data',chunk=>{text+=chunk});response.on('end',()=>{try{resolve({status:response.statusCode,value:JSON.parse(text)})}catch(error){reject(error)}});response.on('error',reject);
    });request.on('error',reject);
  });
  await new Promise((resolve,reject)=>request.write(body.slice(0,body.length-1),error=>error?reject(error):resolve()));
  await api('/api/me',{auth});
  return{finish(){request.end(body.slice(-1));return result}};
}

before(async()=>{
  const listener=net.createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));base=`http://127.0.0.1:${port}`;
  child=spawn(process.execPath,['server.mjs'],{cwd:appDir,env:{...process.env,SHENDU_PORT:String(port),SHENDU_DATA_DIR:root,SHENDU_MASTER_KEY:'',SHENDU_MASTER_KEY_PATH:join(root,'backup-master.key'),SHENDU_SECURE_COOKIE:'false'},stdio:['ignore','pipe','pipe']});
  let logs='';child.stdout.on('data',value=>{logs+=value});child.stderr.on('data',value=>{logs+=value});
  let ready=false;for(let attempt=0;attempt<200&&!ready;attempt++){try{ready=(await fetch(base+'/healthz')).ok}catch{}if(!ready)await new Promise(resolve=>setTimeout(resolve,20));}assert.ok(ready,logs);
  const registered=await api('/api/auth/register',{method:'POST',auth:'',body:{username:'delete_owner',password}});assert.equal(registered.status,201,registered.text);cookie=registered.cookie;
  assert.equal((await api('/api/admin/users',{method:'POST',body:{username:'delete_member',password}})).status,201);
  const login=await api('/api/auth/login',{method:'POST',auth:'',body:{username:'delete_member',password}});assert.equal(login.status,200);memberCookie=login.cookie;
  db=new DatabaseSync(join(root,'shendu.db'));db.exec('PRAGMA busy_timeout=5000');today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
});
beforeEach(()=>{db.exec('DELETE FROM records')});
after(async()=>{
  db?.close();if(child&&child.exitCode===null){const stopped=once(child,'exit');child.kill('SIGTERM');await stopped;}
  assert.equal(dirname(realpathSync(root)),tempParent);assert.ok(basename(root).startsWith('shendu-record-delete-'));rmSync(root,{recursive:true,force:true});
});

test('all six saved draft kinds can be deleted, including past-period drafts',async()=>{
  for(const type of types){
    const record=await create(type);
    if(type==='weekly'||type==='yearly')db.prepare('UPDATE records SET period=? WHERE id=?').run(type==='weekly'?'2000-W01':'2000',record.id);
    else db.prepare('UPDATE records SET period=? WHERE id=?').run(type==='monthly'?'2000-01':'2000-01-01',record.id);
    const result=await remove(record);assert.equal(result.status,200,`${type}: ${result.text}`);assert.deepEqual(result.value,{ok:true});assert.equal(row(record.id),undefined);
    assert.equal((await api(`/api/records/${record.id}`)).status,404);
    assert.equal((await remove(record)).status,404,'repeating deletion does not affect other records');
  }
});

test('completed and verified records stay immutable for all six kinds',async()=>{
  for(const type of types){
    const record=await create(type),completed=await api(`/api/records/${record.id}/complete`,{method:'POST'});assert.equal(completed.status,200,completed.text);
    let before=row(record.id),blocked=await remove(completed.value.record);assert.equal(blocked.status,409);assert.equal(blocked.value.error,'locked');assert.deepEqual(row(record.id),before);
    db.prepare('UPDATE records SET completed_at=? WHERE id=?').run('2000-01-01T00:00:00.000Z',record.id);
    const verified=await api(`/api/records/${record.id}/verify`,{method:'POST',body:{result:'实际完成',adjustment:'继续保留',outcome:'好',process:'好'}});assert.equal(verified.status,200,verified.text);
    before=row(record.id);blocked=await remove(verified.value.record);assert.equal(blocked.status,409);assert.equal(blocked.value.error,'locked');assert.deepEqual(row(record.id),before);
  }
});

test('draft deletion checks the exact saved version and rejects malformed versions',async()=>{
  let record=await create();const stale=record;
  const updated=await api('/api/records',{method:'PUT',body:{...record,title:'另一设备的新内容'}});assert.equal(updated.status,200);record=updated.value.record;
  let result=await remove(stale);assert.equal(result.status,409);assert.equal(result.value.error,'version_conflict');const before=row(record.id);
  for(const body of [{},{version:null},{version:true},{version:'2'},{version:0},{version:-1},{version:1.5},{version:Number.MAX_SAFE_INTEGER+1}]){
    result=await api(`/api/records/${record.id}`,{method:'DELETE',body});assert.equal(result.status,400,JSON.stringify(body));assert.equal(result.value.error,'invalid_record_version');assert.deepEqual(row(record.id),before);
  }
  result=await remove(record);assert.equal(result.status,200);assert.equal(row(record.id),undefined);
});

test('only the owning active session can delete a draft, with normal same-origin JSON protections',async()=>{
  const record=await create(),before=row(record.id);
  let result=await remove(record,{auth:memberCookie});assert.equal(result.status,404);assert.equal(result.value.error,'record_not_found');
  result=await remove({...record,id:randomUUID()});assert.equal(result.status,404);assert.equal(result.value.error,'record_not_found');
  assert.equal((await remove(record,{auth:''})).status,401);
  for(const headers of [{'Sec-Fetch-Site':'cross-site'},{Origin:'https://unrelated.example'}]){result=await remove(record,{headers});assert.equal(result.status,403);assert.equal(result.value.error,'csrf');}
  result=await remove(record,{headers:{'Content-Type':'text/plain'}});assert.equal(result.status,415);assert.equal(result.value.error,'unsupported_media_type');assert.deepEqual(row(record.id),before);
});

test('a stale save cannot recreate a deleted UUID or write a foreign record UUID',async()=>{
  const deleted=await create();assert.equal((await remove(deleted)).status,200);
  let result=await api('/api/records',{method:'PUT',body:{...deleted,title:'旧标签页尝试保存'}});assert.equal(result.status,404);assert.equal(result.value.error,'record_not_found');assert.equal(row(deleted.id),undefined);
  const owned=await create(),before=row(owned.id);
  result=await api('/api/records',{method:'PUT',auth:memberCookie,body:{...owned,title:'其他账户尝试保存'}});assert.equal(result.status,404);assert.equal(result.value.error,'record_not_found');assert.deepEqual(row(owned.id),before);
  result=await api('/api/records',{method:'PUT',body:{...deleted,id:randomUUID()}});assert.equal(result.status,404);assert.equal(result.value.error,'record_not_found');
  const replacement=await create('decision');assert.notEqual(replacement.id,deleted.id,'an intentional new draft receives a new server UUID');
});

test('submission while a delete body is arriving prevents deletion',async()=>{
  const record=await create(),pending=await pendingDelete(record),completed=await api(`/api/records/${record.id}/complete`,{method:'POST'});assert.equal(completed.status,200,completed.text);
  const before=row(record.id),result=await pending.finish();assert.equal(result.status,409);assert.equal(result.value.error,'locked');assert.deepEqual(row(record.id),before);
});

test('a competing save while a delete body is arriving preserves the newer draft',async()=>{
  const record=await create(),pending=await pendingDelete(record),saved=await api('/api/records',{method:'PUT',body:{...record,title:'新设备保存的草稿'}});assert.equal(saved.status,200,saved.text);
  const before=row(record.id),result=await pending.finish();assert.equal(result.status,409);assert.equal(result.value.error,'version_conflict');assert.deepEqual(row(record.id),before);
});

test('logout while a delete body is arriving invalidates the write',async()=>{
  const login=await api('/api/auth/login',{method:'POST',auth:'',body:{username:'delete_owner',password}});assert.equal(login.status,200);
  const record=await create('daily',login.cookie),before=row(record.id),pending=await pendingDelete(record,login.cookie);
  assert.equal((await api('/api/auth/logout',{method:'POST',auth:login.cookie,body:{}})).status,200);
  const result=await pending.finish();assert.equal(result.status,401);assert.equal(result.value.error,'unauthorized');assert.deepEqual(row(record.id),before);
});
