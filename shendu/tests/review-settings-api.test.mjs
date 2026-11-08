import {after,before,beforeEach,test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import net from 'node:net';
import {REVIEW_QUESTIONS} from '../public/review-schema.js';
import {verificationMinimum} from '../public/verification-policy.js';

const appDir=fileURLToPath(new URL('../',import.meta.url)),root=mkdtempSync(join(tmpdir(),'shendu-review-settings-'));
const password='review-settings-'+randomBytes(16).toString('hex');
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
let child,base,cookie,ownerCookie,initialStage,accountNumber=0;
function period(type){
  if(type==='monthly')return today.slice(0,7);
  if(type==='yearly')return today.slice(0,4);
  if(type!=='weekly')return today;
  const date=new Date(`${today}T12:00:00Z`),day=date.getUTCDay()||7;
  date.setUTCDate(date.getUTCDate()+4-day);
  const year=date.getUTCFullYear(),week=Math.ceil((((date-new Date(Date.UTC(year,0,1)))/86400000)+1)/7);
  return `${year}-W${String(week).padStart(2,'0')}`;
}
async function api(path,{method='GET',body,auth=cookie}={}){
  const response=await fetch(base+path,{method,headers:{...(auth?{Cookie:auth}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
  return {status:response.status,value:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
async function settings(stage){const result=await api('/api/settings',{method:'PUT',body:{stage}});assert.equal(result.status,200);return result.value.stage;}
async function draft(type,data={}){
  const response=await api('/api/records',{method:'PUT',body:{type,period:period(type),title:'自己的复盘',data:{answers:{},action:'完成一件具体的事',ifCondition:'遇到阻碍',ifThen:'换一个可行的方法',verifyDate:verificationMinimum(type,today),...data}}});
  assert.equal(response.status,200,JSON.stringify(response.value));return response.value.record;
}
async function complete(record){return api(`/api/records/${record.id}/complete`,{method:'POST'});}
before(async()=>{
  const listener=net.createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
  base=`http://127.0.0.1:${port}`;
  child=spawn(process.execPath,['server.mjs'],{cwd:appDir,env:{...process.env,SHENDU_PORT:String(port),SHENDU_DATA_DIR:root,SHENDU_MASTER_KEY:'',SHENDU_MASTER_KEY_PATH:join(root,'backup-master.key'),SHENDU_SECURE_COOKIE:'false'},stdio:['ignore','pipe','pipe']});
  let logs='';child.stdout.on('data',value=>{logs+=value});child.stderr.on('data',value=>{logs+=value});
  let ready=false;for(let attempt=0;attempt<200&&!ready;attempt++){try{ready=(await fetch(base+'/healthz')).ok}catch{}if(!ready)await new Promise(resolve=>setTimeout(resolve,20));}
  assert.ok(ready,logs);
  const registration=await api('/api/auth/register',{method:'POST',auth:'',body:{username:'review_owner',password}});assert.equal(registration.status,201);cookie=ownerCookie=registration.cookie;
  initialStage=(await api('/api/me')).value.stage;
});
beforeEach(async()=>{
  const username=`review_test_${++accountNumber}`;
  assert.equal((await api('/api/admin/users',{method:'POST',auth:ownerCookie,body:{username,password}})).status,201);
  const login=await api('/api/auth/login',{method:'POST',auth:'',body:{username,password}});assert.equal(login.status,200);cookie=login.cookie;
});
after(async()=>{if(child&&child.exitCode===null){const stopped=once(child,'exit');child.kill('SIGTERM');await stopped;}rmSync(root,{recursive:true,force:true});});

test('settings round-trip empty, added and removed stage metrics without reinstating defaults',async()=>{
  for(const count of [0,1,5,12,15]){
    const metrics=Array.from({length:count},(_,index)=>({name:`指标 ${index+1}`,target:`达标线 ${index+1}`}));
    const saved=await settings({...initialStage,metrics});
    assert.deepEqual(saved.metrics.map(({id,...value})=>value),metrics.slice(0,12));
    assert.deepEqual(saved.metrics.map(value=>value.id),metrics.slice(0,12).map((_,index)=>`legacy_${index}`));
    assert.deepEqual((await api('/api/me')).value.stage.metrics,saved.metrics);
  }
  assert.equal((await settings({...initialStage,metrics:'invalid'})).metrics.length,3);
});

test('stage metric identities survive rename, reorder and backup normalization',async()=>{
  const first='metric_'+'a'.repeat(32),second='metric_'+'b'.repeat(32);
  const metrics=[{id:first,name:'阅读',target:'三页'},{id:second,name:'运动',target:'半小时'}];
  let saved=await settings({...initialStage,metrics});assert.deepEqual(saved.metrics,metrics);
  const reordered=[{...metrics[1],name:'身体恢复'},metrics[0]];
  saved=await settings({...saved,metrics:reordered});assert.deepEqual(saved.metrics,reordered);
  assert.deepEqual((await api('/api/me')).value.stage.metrics,reordered);
  const malformed=await settings({...saved,metrics:[{id:'legacy_0',name:'显式',target:'保留'},{id:'legacy_0',name:'重复',target:'独立'},{id:'bad',name:'非法',target:'修复'}]});
  assert.equal(malformed.metrics[0].id,'legacy_0');assert.equal(new Set(malformed.metrics.map(value=>value.id)).size,3);
});

test('all six types enforce a new required question and stop requiring deleted built-in questions',async()=>{
  for(const type of Object.keys(REVIEW_QUESTIONS)){
    const reviewTemplates={...initialStage.reviewTemplates,[type]:{...initialStage.reviewTemplates[type],questions:[{id:'custom_personal',label:'自己最关心的问题',required:true}],disabledFields:['sleep','energy','risk','journal']}};
    const stage=await settings({...initialStage,reviewTemplates});
    assert.deepEqual(stage.reviewTemplates[type].questions,[{id:'custom_personal',label:'自己最关心的问题',required:true}]);
    let record=await draft(type);
    assert.equal((await complete(record)).status,400,type+' must require the custom answer');
    const invalid=await api('/api/records',{method:'PUT',body:{...record,data:{...record.data,answers:{custom_personal:'not an array'}}}});assert.equal(invalid.status,200);
    assert.equal((await complete(invalid.value.record)).status,400,'malformed answers give a validation error');
    const updated=await api('/api/records',{method:'PUT',body:{...invalid.value.record,data:{...record.data,answers:{custom_personal:['自己的答案']}}}});assert.equal(updated.status,200);
    const completed=await complete(updated.value.record);assert.equal(completed.status,200,JSON.stringify(completed.value));
    record=completed.value.record;assert.equal(record.status,'completed');assert.equal(record.data.templateSnapshot.version,1);assert.deepEqual(record.data.templateSnapshot.review.questions,stage.reviewTemplates[type].questions);
    assert.deepEqual(record.data.answers,{custom_personal:['自己的答案']});
    await settings(initialStage);
    const reopened=(await api(`/api/records/${record.id}`)).value.record;
    assert.deepEqual(reopened.data.templateSnapshot,record.data.templateSnapshot,'later settings must not change the completed schema');
    assert.equal((await api('/api/records',{method:'PUT',body:reopened})).status,409,'completed records remain locked');
  }
});

test('explicit empty questions and removed optional daily fields survive snapshots, but core action requirements remain',async()=>{
  const stage=await settings({...initialStage,reviewTemplates:{...initialStage.reviewTemplates,daily:{...initialStage.reviewTemplates.daily,questions:[],disabledFields:['sleep','energy','risk','journal','action','verifyDate']}}});
  const snapshot={version:1,review:stage.reviewTemplates.daily,action:stage.actionTemplate};
  assert.deepEqual(snapshot.review.disabledFields,['sleep','energy','risk','journal']);
  let record=await draft('daily',{templateSnapshot:snapshot});const original=structuredClone(record.data);
  for(const field of ['action','ifCondition','ifThen','verifyDate']){
    const updated=await api('/api/records',{method:'PUT',body:{...record,data:{...original,[field]:''}}});assert.equal(updated.status,200);record=updated.value.record;
    assert.equal((await complete(record)).status,400,field+' is still required');
  }
  const updated=await api('/api/records',{method:'PUT',body:{...record,data:original}});assert.equal(updated.status,200);
  const result=await complete(updated.value.record);assert.equal(result.status,200);assert.deepEqual(result.value.record.data.templateSnapshot.review.questions,[]);
  assert.deepEqual(result.value.record.data.answers,{});
});

test('legacy snapshots preserve their labels and required rules after settings change',async()=>{
  const review={today:'旧的必填问题',cause:'旧的选填问题',actionTitle:'旧行动',obstacleTitle:'旧应对',verifyDateTitle:'旧验证日期'};
  const record=await draft('daily',{templateSnapshot:{version:1,review,action:initialStage.actionTemplate}});
  assert.equal((await complete(record)).status,400,'a legacy snapshot still requires today');
  const updated=await api('/api/records',{method:'PUT',body:{...record,data:{...record.data,answers:{today:['旧问题的答案']}}}});assert.equal(updated.status,200);
  const result=await complete(updated.value.record);assert.equal(result.status,200);
  assert.equal(result.value.record.data.templateSnapshot.review.questions[0].label,'旧的必填问题');
  assert.equal(result.value.record.data.templateSnapshot.review.questions[0].required,true);
});

test('settings and snapshot normalization drop malformed and duplicate questions safely',async()=>{
  const review={...initialStage.reviewTemplates.daily,questions:[{id:'__proto__',label:'bad'},{id:'action',label:'bad'},{id:'custom_keep',label:'保留',required:true},{id:'custom_keep',label:'duplicate'},{id:'custom_blank',label:' '}]};
  const stage=await settings({...initialStage,reviewTemplates:{...initialStage.reviewTemplates,daily:review}});
  assert.deepEqual(stage.reviewTemplates.daily.questions,[{id:'custom_keep',label:'保留',required:true}]);
  const record=await draft('daily',{templateSnapshot:{version:1,review,action:stage.actionTemplate},answers:{custom_keep:['内容']}});
  assert.deepEqual(record.data.templateSnapshot.review.questions,stage.reviewTemplates.daily.questions);
  assert.equal((await complete(record)).status,200);
});

test('personal backup restores configurable questions, disabled screens, metrics and locked snapshots',async()=>{
  const question={id:'custom_backup',label:'备份里的问题',required:true};
  const stage=await settings({...initialStage,metrics:[],reviewTemplates:{...initialStage.reviewTemplates,daily:{...initialStage.reviewTemplates.daily,questions:[question],disabledFields:['journal']}}});
  const record=await draft('daily',{answers:{custom_backup:['备份里的答案']},templateSnapshot:{version:1,review:stage.reviewTemplates.daily,action:stage.actionTemplate}});
  assert.equal((await complete(record)).status,200);
  assert.equal((await api('/api/backup/password',{method:'POST',body:{password}})).status,200);
  const exported=await api('/api/backup/export',{method:'POST',body:{}});assert.equal(exported.status,200);
  assert.equal((await api('/api/admin/users',{method:'POST',auth:ownerCookie,body:{username:'review_restored',password}})).status,201);
  const login=await api('/api/auth/login',{method:'POST',auth:'',body:{username:'review_restored',password}});assert.equal(login.status,200);
  const imported=await api('/api/data/import',{method:'POST',auth:login.cookie,body:{encryptedBackup:JSON.stringify(exported.value),password,sourceUsername:`review_test_${accountNumber}`,mode:'replace',confirmation:'RESTORE'}});assert.equal(imported.status,200,JSON.stringify(imported.value));
  const restoredStage=(await api('/api/me',{auth:login.cookie})).value.stage;
  assert.deepEqual(restoredStage.metrics,[]);assert.deepEqual(restoredStage.reviewTemplates.daily.questions,[question]);assert.deepEqual(restoredStage.reviewTemplates.daily.disabledFields,['journal']);
  const restored=(await api('/api/records',{auth:login.cookie})).value.records.find(value=>value.data.answers?.custom_backup?.[0]==='备份里的答案');
  assert.equal(restored.status,'completed');assert.deepEqual(restored.data.templateSnapshot.review.questions,[question]);
});
