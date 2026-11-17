import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID,createHash,createCipheriv,createDecipheriv,randomBytes,createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createFinanceReceipts,presignReceipt,receiptObjectUrl,receiptStorageIdentity,isR2ReceiptStorage} from '../finance-receipts.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const checksum=value=>Buffer.from(value,'hex').toString('base64');
const config={endpoint:'https://storage.example.test',bucket:'private-receipts',region:'test-region',directory:'shendu-images',pathStyle:true,accessKey:'fixture-access',secretKey:'fixture-secret'};
const variants={image:{type:'image/webp',bytes:21000,sha256:hash('image')},thumb:{type:'image/webp',bytes:900,sha256:hash('thumb')}};
const r2Config={...config,endpoint:'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com',region:'auto'};
const r2Image=Buffer.alloc(1024*1024+19,7),r2Thumb=Buffer.alloc(900,9);
const r2Variants={image:{type:'image/webp',bytes:r2Image.length,sha256:hash(r2Image)},thumb:{type:'image/webp',bytes:r2Thumb.length,sha256:hash(r2Thumb)}};
function r2Object(key){const name=key.includes('/thumb.')?'thumb':'image',variant=r2Variants[name],body=name==='image'?r2Image:r2Thumb;return {name,variant,body,headers:{'content-length':variant.bytes,'content-type':variant.type,'x-amz-meta-sha256':variant.sha256}}}
async function prepareR2(f){
  assert.equal((await f.route('/api/finance/storage',{method:'PUT',body:{config:r2Config,version:0}})).status,200);
  const prepared=await f.prepare(f.owner,{variants:r2Variants});assert.equal(prepared.status,200);return prepared.value.receiptId;
}
function fixture(){
  const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON; CREATE TABLE users(id TEXT PRIMARY KEY,username TEXT UNIQUE); CREATE TABLE user_settings(user_id TEXT,key TEXT,value TEXT,PRIMARY KEY(user_id,key));');
  const owner={id:randomUUID(),username:'receipt_owner'},other={id:randomUUID(),username:'receipt_other'};for(const user of [owner,other])db.prepare('INSERT INTO users VALUES(?,?)').run(user.id,user.username);
  const master=randomBytes(32),calls=[],activity=[],probes=new Map();let valid=true,wrongHead=false,headChecksum='valid',dnsWait=null,networkWait=null,requestHook=null;
  const scope=(...parts)=>parts.join('|');
  const encrypt=(value,aad)=>{const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',master,iv);cipher.setAAD(Buffer.from(aad));return JSON.stringify({iv:iv.toString('hex'),tag:(()=>{const bytes=Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]);return {tag:cipher.getAuthTag().toString('hex'),bytes:bytes.toString('hex')}})()})};
  const decrypt=(text,aad)=>{const value=JSON.parse(text),decipher=createDecipheriv('aes-256-gcm',master,Buffer.from(value.iv,'hex'));decipher.setAAD(Buffer.from(aad));decipher.setAuthTag(Buffer.from(value.tag.tag,'hex'));return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.tag.bytes,'hex')),decipher.final()]).toString())};
  const setting=(id,key,fallback=null)=>{const row=db.prepare('SELECT value FROM user_settings WHERE user_id=? AND key=?').get(id,key);return row?decrypt(row.value,scope('setting',id,key)):fallback};
  const putSetting=(id,key,value)=>db.prepare('INSERT INTO user_settings VALUES(?,?,?) ON CONFLICT(user_id,key) DO UPDATE SET value=excluded.value').run(id,key,encrypt(value,scope('setting',id,key)));
  const normalize=(_kind,value)=>{const result={...value};const url=new URL(value.endpoint);if(url.protocol!=='https:'||url.hostname==='localhost'||url.username||url.password||!value.secretKey)throw new Error('invalid storage');return result};
  const service=createFinanceReceipts({db,setting,putSetting,dataScope:scope,encryptData:encrypt,decryptData:decrypt,now:()=>new Date().toISOString(),readJson:async req=>req.body||{},json:(res,status,value)=>Object.assign(res,{status,value}),error:(res,status,message,error)=>Object.assign(res,{status,value:{message,error}}),assertPublicHttps:async endpoint=>{if(dnsWait)await dnsWait;return {url:new URL(endpoint)}},sessionUser:req=>valid?req.user:null,normalizeBackupConfig:normalize,getS3Targets:()=>[{id:'owned-target',name:'凭证存储'}],getS3TargetConfig:(id,target)=>id===owner.id&&target==='owned-target'?{...config}:null,withActivity:(id,action,metadata,write)=>{db.exec('BEGIN');try{const result=write();db.exec('COMMIT');activity.push({id,action});return result}catch(error){db.exec('ROLLBACK');throw error}},s3Request:async(c,key,method,body,options)=>{calls.push({key,method,config:{...c},body,options});if(networkWait)await networkWait;if(requestHook)return requestHook(c,key,method,body,options);if(key.includes('/connection-check-')){if(method==='PUT')probes.set(key,Buffer.from(body));if(method==='DELETE')probes.delete(key);return {body:probes.get(key),headers:{}};}const variant=key.includes('/thumb.')?variants.thumb:variants.image;return {headers:{'content-length':variant.bytes,'content-type':variant.type,'x-amz-meta-sha256':wrongHead?'bad':variant.sha256,...(headChecksum==='missing'?{}:{'x-amz-checksum-sha256':headChecksum==='valid'?checksum(variant.sha256):checksum(hash('different bytes'))})}}}});
  async function route(path,{method='POST',body={},user=owner}={}){const res={};await service.handle({method,body,user},res,new URL(path,'http://localhost'),user);return res}
  return {db,service,owner,other,calls,activity,probes,route,set requestHook(value){requestHook=value},set valid(value){valid=value},set wrongHead(value){wrongHead=value},set headChecksum(value){headChecksum=value},set dnsWait(value){dnsWait=value},set networkWait(value){networkWait=value},async configure(user=owner){return route('/api/finance/storage',{method:'PUT',body:{config,version:0},user})},async prepare(user=owner,body={}){return route('/api/finance/receipts/prepare',{user,body:{id:randomUUID(),hash:hash('original'),variants,...body}})},close(){db.close()}};
}

test('presigned PUT binds exact object, MIME, byte length and digest without exposing the secret',()=>{
  const ticket=presignReceipt(config,'receipts/user/path/image.webp',{method:'PUT',variant:variants.image,time:new Date('2026-11-15T01:02:03.000Z')}),url=new URL(ticket.url);
  assert.equal(url.pathname,'/private-receipts/shendu-images/receipts/user/path/image.webp');
  assert.equal(url.searchParams.get('X-Amz-SignedHeaders'),'content-length;content-type;host;x-amz-checksum-sha256;x-amz-meta-sha256');assert.equal(url.searchParams.get('X-Amz-Expires'),'300');
  assert.deepEqual(ticket.headers,{'Content-Type':'image/webp','x-amz-meta-sha256':variants.image.sha256,'x-amz-checksum-sha256':checksum(variants.image.sha256)});assert.ok(!ticket.url.includes(config.secretKey));assert.ok(!('Content-Length'in ticket.headers));
  const signedParams=[...url.searchParams].filter(([key])=>key!=='X-Amz-Signature').map(([key,value])=>[encodeURIComponent(key),encodeURIComponent(value)]).sort(([a],[b])=>a.localeCompare(b)).map(pair=>pair.join('=')).join('&');
  const headers=`content-length:${variants.image.bytes}\ncontent-type:${variants.image.type}\nhost:${url.host}\nx-amz-checksum-sha256:${checksum(variants.image.sha256)}\nx-amz-meta-sha256:${variants.image.sha256}\n`;
  const canonical=`PUT\n${url.pathname}\n${signedParams}\n${headers}\n${url.searchParams.get('X-Amz-SignedHeaders')}\nUNSIGNED-PAYLOAD`,scope='20261115/test-region/s3/aws4_request';
  const hmac=(key,value)=>createHmac('sha256',key).update(value).digest();const signingKey=hmac(hmac(hmac(hmac('AWS4'+config.secretKey,'20261115'),'test-region'),'s3'),'aws4_request');
  assert.equal(url.searchParams.get('X-Amz-Signature'),createHmac('sha256',signingKey).update(`AWS4-HMAC-SHA256\n20261115T010203Z\n${scope}\n${hash(canonical)}`).digest('hex'));
  assert.equal(receiptObjectUrl({...config,pathStyle:false},'image.webp').host,'private-receipts.storage.example.test');
});

test('native R2 PUT signatures retain type, length and digest metadata without accepting endpoint lookalikes',()=>{
  for(const endpoint of [r2Config.endpoint,'https://account.eu.r2.cloudflarestorage.com','https://account.fedramp.r2.cloudflarestorage.com']){
    const storage={...r2Config,endpoint},ticket=presignReceipt(storage,'receipts/user/id/image.webp',{method:'PUT',variant:r2Variants.image,time:new Date('2026-11-17T01:02:03.000Z')}),url=new URL(ticket.url);
    assert.equal(isR2ReceiptStorage(storage),true);assert.equal(url.searchParams.get('X-Amz-SignedHeaders'),'content-length;content-type;host;x-amz-meta-sha256');
    assert.deepEqual(ticket.headers,{'Content-Type':'image/webp','x-amz-meta-sha256':r2Variants.image.sha256});assert.ok(!ticket.url.includes(storage.secretKey));assert.ok(!('Content-Length'in ticket.headers));
  }
  for(const endpoint of ['https://account.r2.cloudflarestorage.com.attacker.test','https://r2.cloudflarestorage.com','https://images.example.test','https://attacker.test/account.r2.cloudflarestorage.com','http://account.r2.cloudflarestorage.com','not a URL'])assert.equal(isR2ReceiptStorage({endpoint}),false,endpoint);
  const ticket=presignReceipt(r2Config,'receipts/user/id/image.webp',{method:'PUT',variant:r2Variants.image,time:new Date('2026-11-17T01:02:03.000Z')}),url=new URL(ticket.url);
  const params=[...url.searchParams].filter(([key])=>key!=='X-Amz-Signature').map(([key,value])=>[encodeURIComponent(key),encodeURIComponent(value)]).sort(([a],[b])=>a.localeCompare(b)).map(pair=>pair.join('=')).join('&');
  const headers=`content-length:${r2Variants.image.bytes}\ncontent-type:image/webp\nhost:${url.host}\nx-amz-meta-sha256:${r2Variants.image.sha256}\n`;
  const canonical=`PUT\n${url.pathname}\n${params}\n${headers}\n${url.searchParams.get('X-Amz-SignedHeaders')}\nUNSIGNED-PAYLOAD`,scope='20261117/auto/s3/aws4_request';
  const hmac=(key,value)=>createHmac('sha256',key).update(value).digest(),signingKey=hmac(hmac(hmac(hmac('AWS4'+config.secretKey,'20261117'),'auto'),'s3'),'aws4_request');
  assert.equal(url.searchParams.get('X-Amz-Signature'),createHmac('sha256',signingKey).update(`AWS4-HMAC-SHA256\n20261117T010203Z\n${scope}\n${hash(canonical)}`).digest('hex'));
});

test('R2 completion hashes bounded actual bytes including images larger than the default S3 read limit',async()=>{
  const f=fixture();try{
    const id=await prepareR2(f);
    f.requestHook=(_config,key,method,_body,options)=>{const object=r2Object(key);assert.equal(f.service.hasReadyReceipt(f.owner.id,id),false);if(method==='HEAD')return {headers:object.headers};assert.equal(method,'GET');assert.equal(options.maxResponseBytes,object.body.length);return {body:object.body}};
    const done=await f.route(`/api/finance/receipts/${id}/complete`);assert.equal(done.status,200,JSON.stringify(done.value));assert.equal(f.service.hasReadyReceipt(f.owner.id,id),true);
    assert.deepEqual(f.calls.map(call=>call.method),['HEAD','GET','HEAD','GET']);
    assert.deepEqual(f.calls.filter(call=>call.method==='GET').map(call=>call.options.maxResponseBytes),[r2Image.length,r2Thumb.length]);
  }finally{f.close()}
});

test('R2 metadata cannot replace missing, corrupt or oversized actual object bytes',async()=>{
  for(const problem of ['corrupt','missing','short','oversize','string']){
    const f=fixture();try{
      const id=await prepareR2(f);
      f.requestHook=(_config,key,method)=>{const object=r2Object(key);if(method==='HEAD')return {headers:object.headers};return {body:problem==='missing'?undefined:problem==='string'?'fake':problem==='short'?object.body.subarray(1):problem==='oversize'?Buffer.concat([object.body,Buffer.from([0])]):Buffer.alloc(object.body.length,1)}};
      const response=await f.route(`/api/finance/receipts/${id}/complete`);assert.equal(response.status,409,problem);assert.equal(response.value.error,'finance_receipt_incomplete');assert.equal(f.service.hasReadyReceipt(f.owner.id,id),false);
    }finally{f.close()}
  }
});

test('R2 HEAD metadata mismatch rejects before downloading any object content',async()=>{
  for(const field of ['content-length','content-type','x-amz-meta-sha256']){
    const f=fixture();try{
      const id=await prepareR2(f);
      f.requestHook=(_config,key,method)=>{assert.equal(method,'HEAD');const object=r2Object(key);return {headers:{...object.headers,[field]:field==='content-length'?object.body.length+1:field==='content-type'?'text/plain':hash('untrusted metadata')}}};
      const response=await f.route(`/api/finance/receipts/${id}/complete`);
      assert.equal(response.status,409,field);assert.equal(response.value.error,'finance_receipt_incomplete');
      assert.deepEqual(f.calls.map(call=>call.method),['HEAD']);assert.equal(f.service.hasReadyReceipt(f.owner.id,id),false);
    }finally{f.close()}
  }
});

test('R2 GET success or failure cannot complete after logout, same-config restore or receipt revision change',async()=>{
  for(const change of ['logout','restore','receipt'])for(const fails of [false,true]){
    const f=fixture();let release,pending;
    try{
      const id=await prepareR2(f);let enter;
      const entered=new Promise(resolve=>{enter=resolve}),hold=new Promise(resolve=>{release=resolve});
      f.requestHook=async(_config,key,method)=>{
        const object=r2Object(key);if(method==='HEAD')return {headers:object.headers};
        assert.equal(method,'GET');enter();await hold;
        if(fails)throw new Error('private upstream URL and credentials must not escape');
        return {body:object.body};
      };
      pending=f.route(`/api/finance/receipts/${id}/complete`);await entered;
      if(change==='logout')f.valid=false;
      else if(change==='restore'){
        const snapshot=f.service.exportUser(f.owner.id),priorVersion=snapshot.storage.version;
        f.service.importUser(f.owner.id,snapshot,{replace:true});
        assert.ok(f.service.exportUser(f.owner.id).storage.version>priorVersion);
      }else f.db.prepare('UPDATE finance_receipts SET version=version+1 WHERE id=?').run(id);
      release();const response=await pending;
      assert.equal(response.status,change==='logout'?401:409,`${change}/${fails}`);
      assert.equal(response.value.error,change==='logout'?'unauthorized':'version_conflict');
      assert.equal(f.service.hasReadyReceipt(f.owner.id,id),false);assert.doesNotMatch(JSON.stringify(response.value),/private upstream/);
      assert.deepEqual(f.calls.map(call=>call.method),['HEAD','GET']);
    }finally{release?.();if(pending)await pending;f.close()}
  }
});

test('private storage is safe to read, reuses only an owned target and rejects stale configuration',async()=>{
  const f=fixture();try{
    const configured=await f.route('/api/finance/storage',{method:'PUT',body:{reuseTargetId:'owned-target',version:0}});assert.equal(configured.status,200);assert.equal(configured.value.version,1);assert.ok(!JSON.stringify(configured.value).includes(config.secretKey));
    const foreign=await f.route('/api/finance/storage',{method:'PUT',user:f.other,body:{reuseTargetId:'owned-target'}});assert.equal(foreign.status,404);
    const stale=await f.route('/api/finance/storage',{method:'PUT',body:{config,version:0}});assert.equal(stale.status,409);
    const invalid=await f.route('/api/finance/storage',{method:'PUT',body:{config:{...config,endpoint:'http://localhost'},version:1}});assert.equal(invalid.status,400);assert.equal(invalid.value.error,'finance_storage_invalid');
    assert.deepEqual(f.service.storageOrigins(),[]);assert.deepEqual(f.service.storageOrigins(f.other.id),[]);assert.equal(f.service.storageOrigins(f.owner.id)[0],'https://storage.example.test');const raw=f.db.prepare('SELECT value FROM user_settings WHERE user_id=?').get(f.owner.id).value;assert.ok(!raw.includes(config.secretKey));
  }finally{f.close()}
});

test('receipt HEAD requests signed checksums and addresses the same encoded object as browser PUT',async()=>{
  const source=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
  const implementation=source.slice(source.indexOf('const awsDate ='),source.indexOf('async function uploadWebdav('));
  let request;
  const send=runInNewContext(implementation+';s3Request',{
    Buffer,URL,createHash,createHmac,isR2ReceiptStorage,
    assertPublicHttps:async endpoint=>({url:new URL(endpoint)}),
    pinnedHttpsRequest:async(validated,url,options)=>{request={url,options};return {ok:true,headers:{}}}
  });
  const storage={...config,directory:'截图(私有)!'},key='receipts/owner/image.webp';
  await send(storage,key,'HEAD');
  assert.equal(request.url.href,receiptObjectUrl(storage,key).href);
  assert.equal(request.options.headers['x-amz-checksum-mode'],'ENABLED');
  assert.match(request.options.headers.Authorization,/SignedHeaders=[^,]*x-amz-checksum-mode/);
  assert.equal(request.options.body.length,0);
});

test('native R2 S3 requests omit checksum mode and forward bounded reads while ordinary defaults remain intact',async()=>{
  const source=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
  const implementation=source.slice(source.indexOf('const awsDate ='),source.indexOf('async function uploadWebdav('));
  const calls=[];let dnsCalls=0;
  const send=runInNewContext(implementation+';s3Request',{
    Buffer,URL,createHash,createHmac,isR2ReceiptStorage,
    assertPublicHttps:async endpoint=>{dnsCalls++;return {url:new URL(endpoint)}},
    pinnedHttpsRequest:async(validated,url,options)=>{calls.push({url,options});return {ok:true,headers:{},body:Buffer.alloc(0)}}
  });
  await send(r2Config,'receipts/owner/image.webp','HEAD');
  assert.equal(calls[0].options.headers['x-amz-checksum-mode'],undefined);
  assert.doesNotMatch(calls[0].options.headers.Authorization,/x-amz-checksum-mode/);
  assert.equal(calls[0].options.maxResponseBytes,1024*1024);
  await send(r2Config,'receipts/owner/image.webp','GET',Buffer.alloc(0),{maxResponseBytes:r2Image.length});
  assert.equal(calls[1].options.maxResponseBytes,r2Image.length);assert.equal(calls[1].options.body.length,0);
  await send(r2Config,'receipts/owner/image.webp','GET',Buffer.alloc(0),{maxResponseBytes:2*1024*1024});
  assert.equal(calls[2].options.maxResponseBytes,2*1024*1024);
  await send(config,'receipts/owner/image.webp','HEAD');
  assert.equal(calls[3].options.headers['x-amz-checksum-mode'],'ENABLED');assert.equal(calls[3].options.maxResponseBytes,1024*1024);
  const priorDns=dnsCalls;
  for(const limit of [0,-1,1.5,NaN,Infinity,2*1024*1024+1])await assert.rejects(send(r2Config,'receipts/owner/image.webp','GET',Buffer.alloc(0),{maxResponseBytes:limit}),/读取上限/);
  assert.equal(dnsCalls,priorDns,'invalid limits cannot issue DNS or storage requests');
});

test('receipt prepare is idempotent, disallows PNG/oversize and requires both valid uploaded variants',async()=>{
  const f=fixture();try{
    assert.equal((await f.prepare()).status,409);await f.configure();
    const invalid=await f.prepare(f.owner,{variants:{...variants,image:{...variants.image,type:'image/png'}}});assert.equal(invalid.status,400);
    assert.equal((await f.prepare(f.owner,{variants:{...variants,image:{...variants.image,bytes:3*1024*1024}}})).status,400);
    const first=await f.prepare();assert.equal(first.status,200);const id=first.value.receiptId;
    const replay=await f.prepare();assert.equal(replay.value.receiptId,id);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM finance_receipts').get().n,1);
    assert.equal((await f.route('/api/finance/receipts/read',{body:{ids:[id],variant:'image'}})).status,409);
    f.wrongHead=true;assert.equal((await f.route(`/api/finance/receipts/${id}/complete`)).status,409);assert.equal(f.service.hasReadyReceipt(f.owner.id,id),false);
    f.wrongHead=false;assert.equal((await f.route(`/api/finance/receipts/${id}/complete`)).status,200);assert.equal(f.service.hasReadyReceipt(f.owner.id,id),true);assert.equal(f.calls.length,3);
    assert.equal((await f.prepare()).value.ready,true);const read=await f.route('/api/finance/receipts/read',{body:{ids:[id],variant:'image'}});assert.equal(read.status,200);assert.ok(read.value.urls[id].includes('X-Amz-Signature'));
    const raw=f.db.prepare('SELECT data FROM finance_receipts WHERE id=?').get(id).data;assert.ok(!raw.includes('receipts/'));assert.ok(!raw.includes('variants'));
  }finally{f.close()}
});

test('failed pending upload reuses identical tickets and rotates both paths when recompression changes',async()=>{
  const f=fixture();try{
    await f.configure();const first=await f.prepare(),id=first.value.receiptId;
    assert.equal(first.value.uploadVersion,1);
    f.wrongHead=true;assert.equal((await f.route(`/api/finance/receipts/${id}/complete`)).status,409);
    const original=f.service.exportUser(f.owner.id).receipts[0],retry=await f.prepare();
    assert.equal(retry.value.uploadVersion,1);assert.equal(retry.value.receiptId,id);
    assert.deepEqual(f.service.exportUser(f.owner.id).receipts[0],original);
    for(const name of ['image','thumb'])assert.equal(new URL(retry.value.uploads[name].url).pathname,new URL(first.value.uploads[name].url).pathname);
    const changed={...variants,image:{type:'image/jpeg',bytes:22000,sha256:hash('recompressed image')}};
    const next=await f.prepare(f.owner,{variants:changed});assert.equal(next.status,200);assert.equal(next.value.receiptId,id);assert.equal(next.value.uploadVersion,2);
    const row=f.service.exportUser(f.owner.id).receipts[0];
    assert.equal(row.hash,original.hash);assert.equal(row.ready,0);assert.equal(row.version,2);assert.equal(row.createdAt,original.createdAt);assert.deepEqual(row.data.variants,changed);
    for(const name of ['image','thumb']){assert.notEqual(row.data.keys[name],original.data.keys[name]);assert.ok(row.data.keys[name].includes(`/${id}/`))}
    assert.equal(f.db.prepare('SELECT COUNT(*) n FROM finance_receipts').get().n,1);
    assert.doesNotMatch(f.db.prepare('SELECT data FROM finance_receipts WHERE id=?').get(id).data,/receipts\/|variants|recompressed/);
    const beforeCalls=f.calls.length;
    for(const uploadVersion of [undefined,null,0,-1,1,'2',2.5,Number.MAX_SAFE_INTEGER+1,3]){
      const response=await f.route(`/api/finance/receipts/${id}/complete`,{body:uploadVersion===undefined?{}:{uploadVersion}});
      assert.equal(response.status,409);assert.equal(response.value.error,'finance_receipt_stale_upload');assert.equal(f.calls.length,beforeCalls);assert.equal(f.service.hasReadyReceipt(f.owner.id,id),false);
    }
    f.requestHook=(_config,key,method)=>{assert.equal(method,'HEAD');const v=key.includes('/thumb.')?changed.thumb:changed.image;return {headers:{'content-length':v.bytes,'content-type':v.type,'x-amz-meta-sha256':v.sha256,'x-amz-checksum-sha256':checksum(v.sha256)}}};
    assert.equal((await f.route(`/api/finance/receipts/${id}/complete`,{body:{uploadVersion:2}})).status,200);
    const saved=f.service.exportUser(f.owner.id).receipts[0];assert.equal(saved.ready,1);
    const replay=await f.prepare();assert.equal(replay.value.ready,true);assert.equal(replay.value.receiptId,id);assert.deepEqual(replay.value.uploads,{});
    assert.deepEqual(f.service.exportUser(f.owner.id).receipts[0],saved,'ready image must ignore recompression changes');
    assert.equal((await f.route(`/api/finance/receipts/${id}/complete`,{body:{uploadVersion:1}})).status,200,'ready completion stays idempotent');
    assert.equal(f.calls.length,beforeCalls+2);
  }finally{f.close()}
});

test('retired R2 PUT tickets cannot overwrite the retried objects or complete their newer attempt',async()=>{
  const f=fixture();try{
    const id=await prepareR2(f),old=f.service.exportUser(f.owner.id).receipts[0],objects=new Map();
    const bodies={image:Buffer.alloc(1500,3),thumb:Buffer.alloc(90,4)},changed=Object.fromEntries(['image','thumb'].map(name=>[name,{type:'image/jpeg',bytes:bodies[name].length,sha256:hash(bodies[name])}]));
    const next=await f.prepare(f.owner,{variants:changed});assert.equal(next.value.uploadVersion,2);
    const current=f.service.exportUser(f.owner.id).receipts[0];
    for(const name of ['image','thumb'])objects.set(old.data.keys[name],{variant:r2Variants[name],body:name==='image'?r2Image:r2Thumb});
    f.requestHook=(_config,key,method)=>{const object=objects.get(key);if(!object)throw Error('not uploaded');const v=object.variant;return method==='HEAD'?{headers:{'content-length':v.bytes,'content-type':v.type,'x-amz-meta-sha256':v.sha256}}:{body:object.body}};
    assert.equal((await f.route(`/api/finance/receipts/${id}/complete`,{body:{uploadVersion:1}})).value.error,'finance_receipt_stale_upload');assert.equal(f.calls.length,0);
    assert.equal((await f.route(`/api/finance/receipts/${id}/complete`,{body:{uploadVersion:2}})).value.error,'finance_receipt_incomplete');
    for(const name of ['image','thumb'])objects.set(current.data.keys[name],{variant:changed[name],body:bodies[name]});
    const done=await f.route(`/api/finance/receipts/${id}/complete`,{body:{uploadVersion:2}});assert.equal(done.status,200);assert.equal(f.service.hasReadyReceipt(f.owner.id,id),true);
    assert.equal(objects.size,4,'retired objects are not deleted by retry');
    const restored=f.service.validateImport(f.service.exportUser(f.owner.id));assert.equal(restored.receipts[0].id,id);assert.deepEqual(restored.receipts[0].data.keys,current.data.keys);
  }finally{f.close()}
});

test('recompression during asynchronous verification invalidates the older completion on success and failure',async()=>{
  for(const fails of [false,true]){
    const f=fixture();let release,pending;try{
      await f.configure();const first=await f.prepare(),id=first.value.receiptId;let enter;
      const entered=new Promise(resolve=>{enter=resolve}),hold=new Promise(resolve=>{release=resolve});
      f.requestHook=async()=>{enter();await hold;if(fails)throw Error('private provider failure');const v=variants.image;return {headers:{'content-length':v.bytes,'content-type':v.type,'x-amz-meta-sha256':v.sha256,'x-amz-checksum-sha256':checksum(v.sha256)}}};
      pending=f.route(`/api/finance/receipts/${id}/complete`,{body:{uploadVersion:1}});await entered;
      const changed={...variants,thumb:{...variants.thumb,sha256:hash('new thumb')}};
      assert.equal((await f.prepare(f.owner,{variants:changed})).value.uploadVersion,2);
      release();const response=await pending;assert.equal(response.status,409);assert.equal(response.value.error,'version_conflict');assert.equal(f.service.hasReadyReceipt(f.owner.id,id),false);assert.equal(f.calls.length,1);
      assert.doesNotMatch(JSON.stringify(response.value),/private provider/);
    }finally{release?.();if(pending)await pending;f.close()}
  }
});

test('prepare checks the full storage snapshot after DNS and keeps real UUID collisions isolated',async()=>{
  const f=fixture();let release,pending;try{
    await f.configure();await f.configure(f.other);const first=await f.prepare(),id=first.value.receiptId;
    for(const [user,body] of [[f.other,{id}],[f.owner,{id,hash:hash('other original')}]] ){
      const response=await f.prepare(user,body);assert.equal(response.status,409);assert.equal(response.value.error,'finance_receipt_id_conflict');
    }
    const snapshot=f.service.exportUser(f.owner.id),before=JSON.stringify(snapshot.receipts);
    f.dnsWait=new Promise(resolve=>{release=resolve});pending=f.prepare(f.owner,{variants:{...variants,image:{...variants.image,bytes:22001}}});await new Promise(resolve=>setImmediate(resolve));
    f.service.importUser(f.owner.id,snapshot,{replace:true});release();
    assert.equal((await pending).value.error,'version_conflict');assert.equal(JSON.stringify(f.service.exportUser(f.owner.id).receipts),before);assert.equal(f.calls.length,0);
  }finally{release?.();if(pending)await pending;f.close()}
});

test('foreign receipts and old sessions cannot receive URLs or complete writes after asynchronous validation',async()=>{
  const f=fixture();try{
    await f.configure();await f.configure(f.other);const prepared=await f.prepare(),id=prepared.value.receiptId;
    assert.equal((await f.route(`/api/finance/receipts/${id}/complete`,{user:f.other})).status,404);
    assert.equal((await f.route('/api/finance/receipts/read',{user:f.other,body:{ids:[id],variant:'thumb'}})).status,404);
    let release;f.networkWait=new Promise(resolve=>{release=resolve});const pending=f.route(`/api/finance/receipts/${id}/complete`);await new Promise(resolve=>setImmediate(resolve));f.valid=false;release();
    assert.equal((await pending).status,401);assert.equal(f.service.hasReadyReceipt(f.owner.id,id),false);
  }finally{f.close()}
});

test('declared SHA metadata cannot replace the checksum verified by the storage service',async()=>{
  const f=fixture();try{
    await f.configure();const prepared=await f.prepare(),id=prepared.value.receiptId;
    for(const checksum of ['wrong','missing']){
      f.headChecksum=checksum;
      const response=await f.route(`/api/finance/receipts/${id}/complete`);
      assert.equal(response.status,409);assert.match(response.value.message,/SHA-256/);
      assert.equal(f.service.hasReadyReceipt(f.owner.id,id),false);
    }
    f.headChecksum='valid';assert.equal((await f.route(`/api/finance/receipts/${id}/complete`)).status,200);
  }finally{f.close()}
});

test('receipt URLs and completion reject storage replacement while network validation is pending',async()=>{
  for(const operation of ['read','complete']){
    const f=fixture();try{
      await f.configure();const prepared=await f.prepare(),id=prepared.value.receiptId;
      if(operation==='read')assert.equal((await f.route(`/api/finance/receipts/${id}/complete`)).status,200);
      let release;const hold=new Promise(resolve=>{release=resolve});
      if(operation==='read')f.dnsWait=hold;else f.networkWait=hold;
      const pending=operation==='read'?f.route('/api/finance/receipts/read',{body:{ids:[id],variant:'image'}}):f.route(`/api/finance/receipts/${id}/complete`);
      await new Promise(resolve=>setImmediate(resolve));
      const replacement=f.service.exportUser(f.owner.id);replacement.storage.config.bucket='replacement-bucket';
      for(const receipt of replacement.receipts)receipt.data.storageIdentity=receiptStorageIdentity(replacement.storage.config);
      f.service.importUser(f.owner.id,replacement,{replace:true});release();
      const response=await pending;assert.equal(response.status,409);assert.equal(response.value.error,'version_conflict');assert.equal(response.value.urls,undefined);
      if(operation==='complete')assert.equal(f.service.hasReadyReceipt(f.owner.id,id),false);
    }finally{f.close()}
  }
});

test('storage identity stays pinned while credentials rotate; backup restores metadata but rejects another owner prefix',async()=>{
  const f=fixture();try{
    await f.configure();const prepared=await f.prepare(),id=prepared.value.receiptId;await f.route(`/api/finance/receipts/${id}/complete`);
    const moved=await f.route('/api/finance/storage',{method:'PUT',body:{config:{...config,bucket:'another-bucket'},version:1}});assert.equal(moved.status,409);
    const rotated=await f.route('/api/finance/storage',{method:'PUT',body:{config:{...config,secretKey:'rotated-fixture'},version:1}});assert.equal(rotated.status,200);
    const exported=f.service.exportUser(f.owner.id);assert.equal(exported.receipts.length,1);f.service.validateImport(exported);
    f.service.importUser(f.owner.id,exported,{replace:true});assert.equal(f.service.hasReadyReceipt(f.owner.id,id),true);
    assert.throws(()=>f.service.importUser(f.other.id,exported),/不属于/);
    const malformed=structuredClone(exported);malformed.receipts[0].data.keys.image='../other';assert.throws(()=>f.service.validateImport(malformed),/路径/);
    f.db.prepare('DELETE FROM users WHERE id=?').run(f.owner.id);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM finance_receipts').get().n,0);
  }finally{f.close()}
});


test('draft storage tests write, read and delete an isolated probe without saving settings or logging success',async()=>{
  const f=fixture();try{
    const before=f.service.exportUser(f.owner.id);
    const tested=await f.route('/api/finance/storage/test',{body:{config,version:0}});
    assert.equal(tested.status,200);assert.equal(tested.value.ok,true);assert.match(tested.value.message,/跨域/);assert.match(tested.value.message,/实际上传/);
    assert.deepEqual(f.calls.map(call=>call.method),['PUT','GET','DELETE']);
    assert.equal(new Set(f.calls.map(call=>call.key)).size,1);assert.match(f.calls[0].key,/^receipts\/[a-f0-9]{32}\/connection-check-[a-f0-9-]{36}\.bin$/);
    assert.ok(f.calls[0].body.length<100);assert.equal(f.probes.size,0);assert.deepEqual(f.service.exportUser(f.owner.id),before);assert.equal(f.activity.length,0);
    assert.ok(!JSON.stringify(tested.value).includes(config.secretKey));
    await f.configure();const saved=f.service.exportUser(f.owner.id).storage;
    const draft={...config,bucket:'different-draft',secretKey:'corrected-secret'};
    assert.equal((await f.route('/api/finance/storage/test',{body:{config:draft,version:1}})).status,200);
    assert.deepEqual(f.service.exportUser(f.owner.id).storage,saved);assert.equal(f.activity.length,1);
    const {secretKey,...withoutSecret}=config;
    assert.equal((await f.route('/api/finance/storage/test',{body:{config:withoutSecret,version:1}})).status,200);
    assert.equal(f.calls.at(-1).config.secretKey,config.secretKey);
    const reused=await f.route('/api/finance/storage/test',{body:{reuseTargetId:'owned-target',version:1}});assert.equal(reused.status,200);
    const foreign=await f.route('/api/finance/storage/test',{user:f.other,body:{reuseTargetId:'owned-target',version:0}});assert.equal(foreign.status,404);
    const stale=await f.route('/api/finance/storage/test',{body:{config,version:0}});assert.equal(stale.status,409);
  }finally{f.close()}
});

test('storage test failures clean up their own probe and redact provider errors',async()=>{
  for(const failure of ['PUT','GET','mismatch','DELETE']){
    const f=fixture();try{
      f.requestHook=async(c,key,method,body)=>{
        if(method===failure)throw Error('private signed URL '+config.secretKey);
        if(method==='PUT')f.probes.set(key,Buffer.from(body));
        if(method==='DELETE')f.probes.delete(key);
        return {body:failure==='mismatch'?Buffer.from('wrong bytes'):f.probes.get(key)};
      };
      const response=await f.route('/api/finance/storage/test',{body:{config,version:0}});
      assert.equal(response.status,409,failure);assert.equal(response.value.error,'finance_storage_test_failed');
      assert.equal(f.calls.at(-1).method,'DELETE');assert.ok(!JSON.stringify(response).includes(config.secretKey));
      assert.equal(f.service.exportUser(f.owner.id).storage,null);assert.equal(f.activity.length,0);
      if(failure!=='DELETE')assert.equal(f.probes.size,0);
    }finally{f.close()}
  }
});

test('storage test cleanup finishes after logout or a concurrent setting change and suppresses stale success',async()=>{
  for(const mutation of ['logout','change']){
    const f=fixture();try{
      await f.configure();
      f.requestHook=async(c,key,method,body)=>{
        if(method==='PUT'){
          f.probes.set(key,Buffer.from(body));
          if(mutation==='logout')f.valid=false;
          else assert.equal((await f.route('/api/finance/storage',{method:'PUT',body:{config:{...config,secretKey:'rotated'},version:1}})).status,200);
        }
        if(method==='DELETE')f.probes.delete(key);
        return {body:f.probes.get(key)};
      };
      const response=await f.route('/api/finance/storage/test',{body:{config,version:1}});
      assert.equal(response.status,mutation==='logout'?401:409);assert.deepEqual(f.calls.map(call=>call.method),['PUT','DELETE']);assert.equal(f.probes.size,0);
    }finally{f.close()}
  }
});

test('storage tests bound concurrent requests and block logout while DNS is pending',async()=>{
  let f=fixture();try{
    let release;f.networkWait=new Promise(resolve=>{release=resolve});
    const first=f.route('/api/finance/storage/test',{body:{config,version:0}});await new Promise(resolve=>setImmediate(resolve));
    const second=await f.route('/api/finance/storage/test',{body:{config,version:0}});assert.equal(second.status,429);
    release();assert.equal((await first).status,200);
    for(let count=2;count<10;count++)assert.equal((await f.route('/api/finance/storage/test',{body:{config,version:0}})).status,200);
    const priorCalls=f.calls.length;assert.equal((await f.route('/api/finance/storage/test',{body:{config,version:0}})).status,429);assert.equal(f.calls.length,priorCalls);
  }finally{f.close()}
  f=fixture();try{
    let release;f.dnsWait=new Promise(resolve=>{release=resolve});
    const pending=f.route('/api/finance/storage/test',{body:{config,version:0}});await new Promise(resolve=>setImmediate(resolve));f.valid=false;release();
    assert.equal((await pending).status,401);assert.equal(f.calls.length,0);
  }finally{f.close()}
});

test('deleting storage clears credentials and pending uploads but keeps ready receipts and a reconnectable tombstone',async()=>{
  const f=fixture();try{
    await f.configure();const pending=await f.prepare(f.owner,{hash:hash('pending-image')});
    const ready=await f.prepare(f.owner,{hash:hash('ready-image')});const id=ready.value.receiptId;await f.route(`/api/finance/receipts/${id}/complete`);
    assert.equal((await f.route('/api/finance/storage',{method:'DELETE',body:{version:0}})).status,409);
    const deleted=await f.route('/api/finance/storage',{method:'DELETE',body:{version:1}});
    assert.equal(deleted.status,200);assert.equal(deleted.value.version,2);assert.equal(deleted.value.configured,false);assert.equal(deleted.value.disconnected,true);assert.equal(deleted.value.receiptCount,1);assert.equal(deleted.value.config,null);
    assert.equal(f.service.hasReadyReceipt(f.owner.id,id),true);assert.equal(f.db.prepare('SELECT id FROM finance_receipts WHERE id=?').get(pending.value.receiptId),undefined);
    assert.deepEqual(f.service.storageOrigins(f.owner.id),[]);assert.equal(f.calls.some(call=>call.method==='DELETE'),false,'disconnect never deletes external photos');
    const exported=f.service.exportUser(f.owner.id);assert.deepEqual(exported.storage,{version:2,config:null,storageIdentity:receiptStorageIdentity(config)});assert.ok(!JSON.stringify(exported).includes(config.secretKey));
    assert.equal((await f.route('/api/finance/receipts/read',{body:{ids:[id],variant:'image'}})).status,409);
    f.service.validateImport(exported);f.service.importUser(f.owner.id,exported,{replace:true});assert.equal(f.service.hasReadyReceipt(f.owner.id,id),true);const restoredVersion=f.service.exportUser(f.owner.id).storage.version;assert.ok(restoredVersion>2);
    assert.equal((await f.route('/api/finance/storage',{method:'PUT',body:{config:{...config,bucket:'wrong-bucket'},version:restoredVersion}})).status,409);
    assert.equal((await f.route('/api/finance/storage',{method:'PUT',body:{config:{...config,secretKey:'corrected-secret'},version:restoredVersion}})).status,200);
    assert.equal((await f.route('/api/finance/receipts/read',{body:{ids:[id],variant:'image'}})).status,200);
    assert.equal((await f.route('/api/finance/storage',{method:'DELETE',body:{version:2}})).status,409);
    assert.equal((await f.route('/api/finance/storage',{method:'DELETE',body:{version:restoredVersion+1}})).value.version,restoredVersion+2);
  }finally{f.close()}
});

test('wrong empty storage can be removed and replaced, and invalid detached backup graphs do not mutate local state',async()=>{
  const f=fixture();try{
    await f.configure();const pending=await f.prepare();
    const removed=await f.route('/api/finance/storage',{method:'DELETE',body:{version:1}});assert.equal(removed.status,200);assert.equal(removed.value.disconnected,false);
    assert.deepEqual(f.service.exportUser(f.owner.id).storage,{version:2,config:null,storageIdentity:null});assert.equal(f.db.prepare('SELECT id FROM finance_receipts WHERE id=?').get(pending.value.receiptId),undefined);
    f.service.importUser(f.owner.id,f.service.exportUser(f.owner.id),{replace:true});
    const restoredVersion=f.service.exportUser(f.owner.id).storage.version;
    assert.equal((await f.route('/api/finance/storage',{method:'PUT',body:{config:{...config,bucket:'corrected-bucket'},version:restoredVersion}})).status,200);
    const prepared=await f.prepare(f.owner,{hash:hash('ready-after-correction')}),id=prepared.value.receiptId;await f.route(`/api/finance/receipts/${id}/complete`);
    const before=f.service.exportUser(f.owner.id),malformed=structuredClone(before);malformed.storage={version:before.storage.version+1,config:null,storageIdentity:null};malformed.receipts=[];
    assert.throws(()=>f.service.importUser(f.owner.id,malformed),/关联不一致/);assert.deepEqual(f.service.exportUser(f.owner.id),before);
    const mismatched=structuredClone(before);mismatched.storage={version:before.storage.version+1,config:null,storageIdentity:hash('other-location')};assert.throws(()=>f.service.validateImport(mismatched),/关联不一致/);
  }finally{f.close()}
});


test('replacement restores preserve monotonic storage revisions and cannot revive a stale delete or test',async()=>{
  const f=fixture();try{
    await f.configure();const old=f.service.exportUser(f.owner.id);
    assert.equal((await f.route('/api/finance/storage',{method:'PUT',body:{config:{...config,secretKey:'changed'},version:1}})).value.version,2);
    f.service.importUser(f.owner.id,old,{replace:true});const restored=f.service.exportUser(f.owner.id).storage;
    assert.equal(restored.version,3);assert.equal(restored.config.secretKey,config.secretKey);
    assert.equal((await f.route('/api/finance/storage',{method:'DELETE',body:{version:1}})).status,409);
    assert.equal((await f.route('/api/finance/storage/test',{body:{config,version:1}})).status,409);assert.equal(f.calls.length,0);
    f.service.importUser(f.owner.id,{version:1,storage:null,receipts:[]},{replace:true});
    assert.deepEqual(f.service.exportUser(f.owner.id).storage,{version:4,config:null,storageIdentity:null});
    assert.equal((await f.route('/api/finance/storage',{method:'PUT',body:{config,version:0}})).status,409);
    assert.equal((await f.route('/api/finance/storage',{method:'PUT',body:{config,version:4}})).value.version,5);
  }finally{f.close()}
});
