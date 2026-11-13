import {after,before,test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtempSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,createCipheriv,createDecipheriv,pbkdf2Sync} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import net from 'node:net';
import {DatabaseSync} from 'node:sqlite';

const appDir=fileURLToPath(new URL('../',import.meta.url)),tempParent=realpathSync(tmpdir());
const root=mkdtempSync(join(tempParent,'shendu-wheel-settings-'));
const password='wheel-api-'+randomBytes(16).toString('hex');
const backupPassword='wheel-backup-'+randomBytes(16).toString('hex');
let child,base,ownerCookie,db,accountIndex=0;

async function api(path,{method='GET',body,auth=ownerCookie}={}){
  const response=await fetch(base+path,{method,headers:{...(auth?{Cookie:auth}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
  const text=await response.text();let value;try{value=JSON.parse(text)}catch{value=text}
  return{status:response.status,value,text,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
async function login(username){const result=await api('/api/auth/login',{method:'POST',auth:'',body:{username,password}});assert.equal(result.status,200,result.text);return result.cookie}
async function account(){
  const username=`wheel_member_${++accountIndex}`,created=await api('/api/admin/users',{method:'POST',body:{username,password}});assert.equal(created.status,201,created.text);
  const cookie=await login(username),me=await api('/api/me',{auth:cookie});return{username,cookie,id:me.value.user.id};
}
async function theme(auth){const result=await api('/api/me',{auth});assert.equal(result.status,200,result.text);return result.value.theme}
async function save(auth,reviewWheelNavigation,reduceMotion){
  const result=await api('/api/settings',{method:'PUT',auth,body:{theme:{preset:'保留旧配色',primary:'#123456',secondary:'#234567',tertiary:'#345678',reviewWheelNavigation,reduceMotion}}});
  assert.equal(result.status,200,result.text);return result.value.theme;
}
function payload(text){
  const {tag,data,...header}=JSON.parse(text),key=pbkdf2Sync(backupPassword,Buffer.from(header.kdf.salt,'base64'),600000,32,'sha256'),decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(header.cipher.iv,'base64'));
  decipher.setAAD(Buffer.from(JSON.stringify(header)));decipher.setAuthTag(Buffer.from(tag,'base64'));
  return JSON.parse(gunzipSync(Buffer.concat([decipher.update(Buffer.from(data,'base64')),decipher.final()])));
}
function seal(text,clear){
  const {tag,data,...header}=JSON.parse(text);header.kdf.salt=randomBytes(16).toString('base64');header.cipher.iv=randomBytes(12).toString('base64');
  const key=pbkdf2Sync(backupPassword,Buffer.from(header.kdf.salt,'base64'),600000,32,'sha256'),cipher=createCipheriv('aes-256-gcm',key,Buffer.from(header.cipher.iv,'base64'));
  cipher.setAAD(Buffer.from(JSON.stringify(header)));const bytes=Buffer.concat([cipher.update(gzipSync(Buffer.from(JSON.stringify(clear)))),cipher.final()]);
  return JSON.stringify({...header,tag:cipher.getAuthTag().toString('base64'),data:bytes.toString('base64')});
}

before(async()=>{
  const listener=net.createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));base=`http://127.0.0.1:${port}`;
  child=spawn(process.execPath,['server.mjs'],{cwd:appDir,env:{...process.env,SHENDU_PORT:String(port),SHENDU_DATA_DIR:root,SHENDU_MASTER_KEY:'',SHENDU_MASTER_KEY_PATH:join(root,'backup-master.key'),SHENDU_SECURE_COOKIE:'false'},stdio:['ignore','pipe','pipe']});
  let logs='';child.stdout.on('data',value=>{logs+=value});child.stderr.on('data',value=>{logs+=value});
  let ready=false;for(let i=0;i<200&&!ready;i++){try{ready=(await fetch(base+'/healthz')).ok}catch{}if(!ready)await new Promise(resolve=>setTimeout(resolve,20))}assert.ok(ready,logs);
  const registered=await api('/api/auth/register',{method:'POST',auth:'',body:{username:'wheel_owner',password}});assert.equal(registered.status,201,registered.text);ownerCookie=registered.cookie;
  db=new DatabaseSync(join(root,'shendu.db'));db.exec('PRAGMA busy_timeout=5000');
});
after(async()=>{
  db?.close();if(child&&child.exitCode===null){const stopped=once(child,'exit');child.kill('SIGTERM');await stopped}
  assert.equal(dirname(realpathSync(root)),tempParent);assert.ok(basename(root).startsWith('shendu-wheel-settings-'));rmSync(root,{recursive:true,force:true});
});

test('new owner and administrator-created member enable wheel navigation independently of reduced motion',async()=>{
  const ownerTheme=await theme(ownerCookie),member=await account(),memberTheme=await theme(member.cookie);
  for(const current of [ownerTheme,memberTheme]){assert.equal(current.reviewWheelNavigation,true);assert.equal(current.reduceMotion,false)}
  assert.equal(db.prepare("SELECT value FROM schema_meta WHERE key='schema_version'").get().value,'8');
});

test('legacy stored preferences without the wheel field read as enabled without rewriting the stored value',async()=>{
  const member=await account(),legacy={preset:'历史偏好',primary:'#ABCDEF',secondary:'#234567',tertiary:'#345678',reduceMotion:true};
  // Compatibility fixtures use the pre-encryption JSON representation still accepted by setting().
  const raw=JSON.stringify(legacy);db.prepare("UPDATE user_settings SET value=? WHERE user_id=? AND key='theme'").run(raw,member.id);
  const restored=await theme(member.cookie);assert.equal(restored.reviewWheelNavigation,true);assert.equal(restored.reduceMotion,true);assert.equal(restored.preset,legacy.preset);assert.equal(restored.primary,legacy.primary);
  assert.equal(db.prepare("SELECT value FROM user_settings WHERE user_id=? AND key='theme'").get(member.id).value,raw);
});

test('settings persist explicit false and true across login, remain account-scoped, and preserve other preferences',async()=>{
  const member=await account();
  for(const enabled of [false,true])for(const reduceMotion of [false,true]){
    const saved=await save(member.cookie,enabled,reduceMotion);assert.equal(saved.reviewWheelNavigation,enabled);assert.equal(saved.reduceMotion,reduceMotion);
    const current=await theme(await login(member.username));assert.deepEqual(current,saved);assert.equal(current.preset,'保留旧配色');assert.equal(current.primary,'#123456');
    assert.match(db.prepare("SELECT value FROM user_settings WHERE user_id=? AND key='theme'").get(member.id).value,/^sd1\./);
    assert.equal((await theme(ownerCookie)).reviewWheelNavigation,true);
  }
});

test('personal backup restores both wheel values and enables the missing field in an older backup',async()=>{
  const member=await account();assert.equal((await api('/api/backup/password',{method:'POST',auth:member.cookie,body:{password:backupPassword}})).status,200);
  let exported;
  for(const enabled of [false,true]){
    const saved=await save(member.cookie,enabled,!enabled);exported=await api('/api/backup/export',{method:'POST',auth:member.cookie,body:{}});assert.equal(exported.status,200,exported.text);
    const entry=payload(exported.text).entries.find(row=>row.kind==='theme');assert.deepEqual(entry.value,saved);
    await save(member.cookie,!enabled,enabled);
    const restored=await api('/api/data/import',{method:'POST',auth:member.cookie,body:{encryptedBackup:exported.text,password:backupPassword,mode:'replace',confirmation:'RESTORE'}});assert.equal(restored.status,200,restored.text);assert.deepEqual(await theme(member.cookie),saved);
  }
  const legacy=payload(exported.text),entry=legacy.entries.find(row=>row.kind==='theme');delete entry.value.reviewWheelNavigation;entry.value.reduceMotion=true;
  await save(member.cookie,false,false);
  const restored=await api('/api/data/import',{method:'POST',auth:member.cookie,body:{encryptedBackup:seal(exported.text,legacy),password:backupPassword,mode:'replace',confirmation:'RESTORE'}});assert.equal(restored.status,200,restored.text);
  const current=await theme(member.cookie);assert.equal(current.reviewWheelNavigation,true);assert.equal(current.reduceMotion,true);
});

test('whole-site backup restores separate wheel values and old settings use the same enabled default',async()=>{
  const disabled=await account(),enabled=await account();await save(disabled.cookie,false,true);await save(enabled.cookie,true,false);
  const exported=await api('/api/admin/site-backup/export',{method:'POST',body:{currentPassword:password,backupPassword}});assert.equal(exported.status,200,exported.text);
  const clear=payload(exported.text),rowFor=id=>clear.settings.find(row=>row.user_id===id&&row.key==='theme');assert.equal(rowFor(disabled.id).value.reviewWheelNavigation,false);assert.equal(rowFor(enabled.id).value.reviewWheelNavigation,true);
  await save(disabled.cookie,true,false);await save(enabled.cookie,false,true);
  const restore=encryptedBackup=>api('/api/admin/site-backup/restore',{method:'POST',body:{encryptedBackup,currentPassword:password,backupPassword,confirmation:'RESTORE_SITE'}});
  const restored=await restore(exported.text);assert.equal(restored.status,200,restored.text);assert.equal(restored.value.relogin,true);
  ownerCookie=await login('wheel_owner');disabled.cookie=await login(disabled.username);enabled.cookie=await login(enabled.username);
  assert.equal((await theme(disabled.cookie)).reviewWheelNavigation,false);assert.equal((await theme(disabled.cookie)).reduceMotion,true);assert.equal((await theme(enabled.cookie)).reviewWheelNavigation,true);assert.equal((await theme(enabled.cookie)).reduceMotion,false);
  delete rowFor(disabled.id).value.reviewWheelNavigation;
  const legacyRestored=await restore(seal(exported.text,clear));assert.equal(legacyRestored.status,200,legacyRestored.text);
  ownerCookie=await login('wheel_owner');disabled.cookie=await login(disabled.username);enabled.cookie=await login(enabled.username);
  assert.equal((await theme(disabled.cookie)).reviewWheelNavigation,true);assert.equal((await theme(disabled.cookie)).reduceMotion,true);assert.equal((await theme(enabled.cookie)).reviewWheelNavigation,true);
  assert.equal(db.prepare("SELECT value FROM schema_meta WHERE key='schema_version'").get().value,'8');
});
