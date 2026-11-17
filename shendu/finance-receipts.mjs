import {createHash,createHmac,randomUUID} from 'node:crypto';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH=/^[a-f0-9]{64}$/;
const TYPES=new Set(['image/webp','image/jpeg']);
const MAX_IMAGE=2*1024*1024,MAX_THUMB=96*1024,MAX_RECEIPTS=50000;
const configKey='finance_receipt_storage';
const bad=(message,code='finance_receipt_invalid',status=400)=>Object.assign(new Error(message),{code,status});
const sha=value=>createHash('sha256').update(value).digest('hex');
const checksum=value=>Buffer.from(value,'hex').toString('base64');
const encode=value=>encodeURIComponent(value).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
const stable=value=>JSON.stringify(value);
const validTime=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));

export function isR2ReceiptStorage(config){
  try{const url=new URL(config.endpoint);return url.protocol==='https:'&&url.hostname.endsWith('.r2.cloudflarestorage.com')}catch{return false}
}

export function receiptStorageIdentity(config){
  return sha(stable([config.endpoint,config.region,config.bucket,config.directory,config.pathStyle===true]));
}
export function receiptObjectUrl(config,key){
  const endpoint=new URL(config.endpoint),parts=endpoint.pathname.split('/').filter(Boolean).map(part=>{try{return decodeURIComponent(part)}catch{return part}}),segments=[...parts,...(config.pathStyle?[config.bucket]:[]),...config.directory.split('/'),...key.split('/')];
  if(!config.pathStyle)endpoint.hostname=`${config.bucket}.${endpoint.hostname}`;
  endpoint.pathname='/'+segments.map(encode).join('/');endpoint.search='';endpoint.hash='';return endpoint;
}
export function presignReceipt(config,key,{method='GET',variant,expires=300,time=new Date()}={}){
  if(!['GET','PUT'].includes(method)||!Number.isInteger(expires)||expires<1||expires>600)throw bad('图片授权参数不正确');
  const url=receiptObjectUrl(config,key),stamp=time.toISOString().replace(/[:-]|\.\d{3}/g,''),date=stamp.slice(0,8),scope=`${date}/${config.region}/s3/aws4_request`;
  const headers={host:url.host};
  if(method==='PUT'){
    if(!variant||!TYPES.has(variant.type)||!Number.isSafeInteger(variant.bytes)||variant.bytes<1||!HASH.test(variant.sha256))throw bad('图片参数不正确');
    headers['content-type']=variant.type;headers['content-length']=String(variant.bytes);headers['x-amz-meta-sha256']=variant.sha256;
    if(!isR2ReceiptStorage(config))headers['x-amz-checksum-sha256']=checksum(variant.sha256);
  }
  const names=Object.keys(headers).sort(),signedHeaders=names.join(';');
  const params={'X-Amz-Algorithm':'AWS4-HMAC-SHA256','X-Amz-Credential':`${config.accessKey}/${scope}`,'X-Amz-Date':stamp,'X-Amz-Expires':String(expires),'X-Amz-SignedHeaders':signedHeaders};
  const query=Object.entries(params).map(([key,value])=>[encode(key),encode(value)]).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>`${key}=${value}`).join('&');
  const canonical=`${method}\n${url.pathname}\n${query}\n${names.map(name=>`${name}:${headers[name]}\n`).join('')}\n${signedHeaders}\nUNSIGNED-PAYLOAD`;
  const sign=`AWS4-HMAC-SHA256\n${stamp}\n${scope}\n${sha(canonical)}`;
  const hmac=(key,value)=>createHmac('sha256',key).update(value).digest();
  const signingKey=hmac(hmac(hmac(hmac('AWS4'+config.secretKey,date),config.region),'s3'),'aws4_request');
  url.search=query+'&X-Amz-Signature='+createHmac('sha256',signingKey).update(sign).digest('hex');
  // Fetch supplies the signed Content-Length from the Blob; scripts cannot set it.
  return {url:url.href,headers:method==='PUT'?{'Content-Type':variant.type,'x-amz-meta-sha256':variant.sha256,...(!isR2ReceiptStorage(config)?{'x-amz-checksum-sha256':checksum(variant.sha256)}:{})}:{}};
}

function variantsFrom(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw bad('请提供压缩图片和缩略图');
  const result={};
  for(const name of ['image','thumb']){
    const item=value[name],maximum=name==='image'?MAX_IMAGE:MAX_THUMB;
    if(!item||!Number.isSafeInteger(item.bytes)||item.bytes<1||item.bytes>maximum||!TYPES.has(item.type)||!HASH.test(String(item.sha256||'')))throw bad(name==='image'?'压缩图片需为2MB以内的WebP或JPEG':'缩略图需为96KB以内的WebP或JPEG');
    result[name]={bytes:item.bytes,type:item.type,sha256:item.sha256};
  }
  return result;
}

export function createFinanceReceipts(deps){
  const {db,setting,putSetting,encryptData,decryptData,dataScope,now,readJson,json,error,assertPublicHttps,s3Request,normalizeBackupConfig,sessionUser}=deps;
  db.exec(`CREATE TABLE IF NOT EXISTS finance_receipts(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,hash TEXT NOT NULL,ready INTEGER NOT NULL DEFAULT 0 CHECK(ready IN(0,1)),data TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(user_id,hash)); CREATE INDEX IF NOT EXISTS finance_receipts_owner ON finance_receipts(user_id,created_at);`);
  const rates=new Map(),networkOwners=new Set();let networkCount=0;
  const unpack=row=>({...row,data:decryptData(row.data,dataScope('finance-receipt',row.user_id,row.id,'data'))});
  const storage=userId=>setting(userId,configKey,null);
  const storageIdentity=saved=>saved?.config?receiptStorageIdentity(saved.config):saved?.storageIdentity||null;
  const readyCount=userId=>db.prepare('SELECT COUNT(*) n FROM finance_receipts WHERE user_id=? AND ready=1').get(userId).n;
  const nextStorageVersion=(...versions)=>{const next=Math.max(0,...versions)+1;if(!Number.isSafeInteger(next))throw bad('存储版本超出范围，请联系管理员','finance_storage_version',409);return next};
  const namespace=userId=>{
    const user=db.prepare('SELECT username FROM users WHERE id=?').get(userId);
    if(!user)throw bad('账户不存在','finance_receipt_owner',404);
    return sha('shendu-receipts:'+user.username.toLowerCase()).slice(0,32);
  };
  const sessionCurrent=(req,user)=>{if(sessionUser(req)?.id!==user.id)throw bad('登录已失效，请重新登录','unauthorized',401)};
  const checkRate=(userId,kind,limit,period)=>{
    const stamp=Date.now(),key=userId+':'+kind,prior=rates.get(key)||[],next=prior.filter(value=>value>stamp-period);
    if(next.length>=limit)throw bad('图片操作过于频繁，请稍后再试','finance_receipt_rate',429);
    next.push(stamp);rates.set(key,next);
    if(rates.size>30000)for(const [stored,values]of rates)if(values.at(-1)<stamp-86400000)rates.delete(stored);
  };
  const network=async(userId,action)=>{
    if(networkOwners.has(userId)||networkCount>=4)throw bad('图片校验正在进行，请稍后重试','finance_receipt_busy',429);
    networkOwners.add(userId);networkCount++;
    try{return await action()}finally{networkOwners.delete(userId);networkCount--}
  };
  const safeStorage=userId=>{
    const saved=storage(userId),config=saved?.config;
    return {configured:!!config,disconnected:!config&&Boolean(storageIdentity(saved)),receiptCount:readyCount(userId),version:saved?.version||0,config:config?{endpoint:config.endpoint,region:config.region,bucket:config.bucket,directory:config.directory,pathStyle:config.pathStyle,accessKey:config.accessKey}:null,targets:deps.getS3Targets?.(userId)||[]};
  };
  const draftConfig=(body,userId,prior)=>{
    try{
      let config;
      if(body.reuseTargetId){config=deps.getS3TargetConfig?.(userId,body.reuseTargetId);if(!config)throw bad('所选存储目标不存在','finance_storage_target',404)}
      else{const incoming={...body.config};if(incoming.secretKey===undefined&&prior?.config)incoming.secretKey=prior.config.secretKey;config=incoming}
      return normalizeBackupConfig('s3',config);
    }catch(caught){if(caught.status)throw caught;throw bad('图片存储配置无效，请核对 HTTPS 服务地址、存储桶、目录和访问密钥','finance_storage_invalid')}
  };
  const sameStorage=(req,user,prior)=>{
    sessionCurrent(req,user);
    if(stable(storage(user.id))!==stable(prior))throw bad('存储设置已更新，请刷新后重试','version_conflict',409);
  };
  const changeStorage=(userId,write)=>{
    if(deps.withActivity)return deps.withActivity(userId,'preferences_updated',{},write);
    db.exec('BEGIN');try{const result=write();db.exec('COMMIT');return result}catch(caught){db.exec('ROLLBACK');throw caught}
  };
  const requireStorage=userId=>{const config=storage(userId)?.config;if(!config)throw bad('请先配置凭证图片存储','finance_storage_required',409);return config};
  const uploadData=(userId,id,variants,config)=>{
    const base=`receipts/${namespace(userId)}/${id}/${randomUUID()}`;
    return {keys:Object.fromEntries(['image','thumb'].map(name=>[name,`${base}/${name}${variants[name].type==='image/webp'?'.webp':'.jpg'}`])),variants,storageIdentity:receiptStorageIdentity(config)};
  };
  const owned=(userId,id)=>{if(!UUID.test(id))throw bad('图片不存在','finance_receipt_not_found',404);const row=db.prepare('SELECT * FROM finance_receipts WHERE id=? AND user_id=?').get(id,userId);if(!row)throw bad('图片不存在','finance_receipt_not_found',404);return unpack(row)};
  const hasReadyReceipt=(userId,id)=>!!db.prepare('SELECT id FROM finance_receipts WHERE id=? AND user_id=? AND ready=1').get(id,userId);
  const storageOrigins=userId=>{
    if(!userId)return [];
    try{const config=storage(userId)?.config;return config?[receiptObjectUrl(config,'').origin]:[]}catch{return []}
  };

  function validateImport(payload){
    if(!payload||payload.version!==1||!Array.isArray(payload.receipts)||payload.receipts.length>MAX_RECEIPTS)throw bad('备份中的凭证资料无效');
    let stored=null;
    if(payload.storage!==null&&payload.storage!==undefined){
      if(!Number.isSafeInteger(payload.storage.version)||payload.storage.version<1)throw bad('备份中的图片存储版本无效');
      if(payload.storage.config===null){
        const identity=payload.storage.storageIdentity;
        if(identity!==null&&!HASH.test(String(identity||'')))throw bad('备份中的图片存储标识无效');
        stored={version:payload.storage.version,config:null,storageIdentity:identity};
      }else stored={version:payload.storage.version,config:normalizeBackupConfig('s3',payload.storage.config)};
    }
    const ids=new Set(),hashes=new Set(),receipts=[];
    for(const item of payload.receipts){
      if(!UUID.test(item?.id)||ids.has(item.id)||!HASH.test(item.hash)||hashes.has(item.hash)||![0,1].includes(item.ready)||!Number.isSafeInteger(item.version)||item.version<1||!validTime(item.createdAt)||!validTime(item.updatedAt))throw bad('备份中的图片索引无效');
      if(!storageIdentity(stored)||item.data?.storageIdentity!==storageIdentity(stored))throw bad('备份中的图片存储关联不一致');
      const variants=variantsFrom(item.data.variants),keys=item.data.keys;
      if(!keys||['image','thumb'].some(name=>typeof keys[name]!=='string'||!/^receipts\/[a-f0-9]{32}\/[a-f0-9-]{36}\/[a-f0-9-]{36}\/(?:image|thumb)\.(?:webp|jpg)$/.test(keys[name])||!keys[name].includes('/'+item.id+'/')||!keys[name].endsWith('/'+name+(variants[name].type==='image/webp'?'.webp':'.jpg'))))throw bad('备份中的图片路径无效');
      ids.add(item.id);hashes.add(item.hash);receipts.push({id:item.id,hash:item.hash,ready:Number(item.ready),version:item.version,createdAt:new Date(item.createdAt).toISOString(),updatedAt:new Date(item.updatedAt).toISOString(),data:{keys:{...keys},variants,storageIdentity:item.data.storageIdentity}});
    }
    return {version:1,storage:stored,receipts};
  }
  function exportUser(userId){
    return {version:1,storage:storage(userId),receipts:db.prepare('SELECT * FROM finance_receipts WHERE user_id=? ORDER BY id').all(userId).map(raw=>{const row=unpack(raw);return {id:row.id,hash:row.hash,ready:row.ready,version:row.version,createdAt:row.created_at,updatedAt:row.updated_at,data:row.data}})};
  }
  function importUser(userId,payload,{replace=false}={}){
    const value=validateImport(payload),prefix=`receipts/${namespace(userId)}/`,current=storage(userId);
    if(value.receipts.some(item=>!item.data.keys.image.startsWith(prefix)||!item.data.keys.thumb.startsWith(prefix)))throw bad('凭证图片不属于当前账户');
    const existing=exportUser(userId).receipts;
    if(!replace&&storageIdentity(current)&&storageIdentity(value.storage)&&storageIdentity(current)!==storageIdentity(value.storage)&&existing.length)throw bad('现有凭证与备份的存储位置不同，请先核对','finance_storage_conflict',409);
    if(!replace&&current&&value.storage&&current.version===value.storage.version&&stable(current)!==stable(value.storage))throw bad('同版本的图片存储配置不一致');
    const replaceStorage=value.storage&&(!current||replace||value.storage.version>current.version||(!existing.length&&value.receipts.length));
    let nextStorage=replaceStorage?value.storage:replace&&!value.storage?null:current;
    if(replace&&current){
      const version=nextStorageVersion(current.version,nextStorage?.version||0);
      nextStorage=nextStorage?{...nextStorage,version}:{version,config:null,storageIdentity:null};
    }
    const merged=new Map((replace?[]:existing).map(item=>[item.id,item]));
    for(const item of value.receipts){
      const raw=db.prepare('SELECT user_id FROM finance_receipts WHERE id=?').get(item.id);
      if(raw&&raw.user_id!==userId)throw bad('备份中的凭证标识冲突');
      const old=merged.get(item.id);
      if(old){if(old.version>item.version)continue;if(old.version===item.version){if(stable(old.data)!==stable(item.data)||old.hash!==item.hash||old.ready!==item.ready)throw bad('备份中的同版本凭证不一致');continue}}
      merged.set(item.id,item);
    }
    // Validate the selected setting with retained local rows before the first write.
    // A disconnected setting is still pinned to the original receipt namespace.
    const checked=validateImport({version:1,storage:nextStorage,receipts:[...merged.values()]});
    if(replace)db.prepare('DELETE FROM finance_receipts WHERE user_id=?').run(userId);
    if(replaceStorage||replace&&!value.storage)putSetting(userId,configKey,nextStorage);
    for(const item of checked.receipts){
      const old=db.prepare('SELECT version FROM finance_receipts WHERE id=? AND user_id=?').get(item.id,userId);
      if(old&&old.version>=item.version)continue;
      db.prepare('INSERT INTO finance_receipts(id,user_id,hash,ready,data,version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET ready=excluded.ready,data=excluded.data,version=excluded.version,updated_at=excluded.updated_at').run(item.id,userId,item.hash,item.ready,encryptData(item.data,dataScope('finance-receipt',userId,item.id,'data')),item.version,item.createdAt,item.updatedAt);
    }
  }

  async function handle(req,res,url,user){
    const path=url.pathname;if(!path.startsWith('/api/finance/storage')&&!path.startsWith('/api/finance/receipts'))return false;
    try{
      if(path==='/api/finance/storage'&&req.method==='GET'){json(res,200,safeStorage(user.id));return true}
      if(path==='/api/finance/storage'&&req.method==='DELETE'){
        const body=await readJson(req),prior=storage(user.id);sessionCurrent(req,user);
        if(!Number.isSafeInteger(body.version)||body.version<0||body.version!==(prior?.version||0))throw bad('存储设置已更新，请刷新后重试','version_conflict',409);
        const identity=readyCount(user.id)?storageIdentity(prior):null;
        if(readyCount(user.id)&&!identity)throw bad('已有凭证的存储标识无效，请先恢复原配置','finance_storage_conflict',409);
        const write=()=>{
          db.prepare('DELETE FROM finance_receipts WHERE user_id=? AND ready=0').run(user.id);
          putSetting(user.id,configKey,{version:nextStorageVersion(prior?.version||0),config:null,storageIdentity:identity});
        };
        changeStorage(user.id,write);json(res,200,safeStorage(user.id));return true;
      }
      if(path==='/api/finance/storage'&&req.method==='PUT'||path==='/api/finance/storage/test'&&req.method==='POST'){
        const body=await readJson(req),prior=storage(user.id);sessionCurrent(req,user);
        if(body.version!==undefined&&body.version!==(prior?.version||0))throw bad('存储设置已更新，请刷新后重试','version_conflict',409);
        const config=draftConfig(body,user.id,prior),testing=path.endsWith('/test');
        if(testing)checkRate(user.id,'storage-test',10,60000);
        try{await assertPublicHttps(config.endpoint)}catch{sameStorage(req,user,prior);throw bad('无法验证图片存储地址，请使用可访问的公网 HTTPS 服务地址','finance_storage_invalid')}
        sameStorage(req,user,prior);
        if(testing){
          await network(user.id,async()=>{
            const key=`receipts/${namespace(user.id)}/connection-check-${randomUUID()}.bin`,bytes=Buffer.from('shendu-receipt-storage-test:'+randomUUID());
            let attempted=false,failed=null,cleanupFailed=false;
            try{
              sameStorage(req,user,prior);attempted=true;
              await s3Request(config,key,'PUT',bytes);sameStorage(req,user,prior);
              const read=await s3Request(config,key,'GET');sameStorage(req,user,prior);
              if(!Buffer.isBuffer(read.body)||!read.body.equals(bytes))throw new Error('readback mismatch');
            }catch(caught){failed=caught}
            finally{if(attempted){try{await s3Request(config,key,'DELETE')}catch{cleanupFailed=true}}}
            // Cleanup must finish even when a session/revision changes during a probe.
            // Never return the provider error or signed/private URL to the browser.
            sameStorage(req,user,prior);
            if(failed||cleanupFailed)throw bad(cleanupFailed?'图片存储测试未完成，测试文件清理失败，请核对删除权限后重试。':'图片存储测试失败，请核对地址、存储桶、目录和访问密钥及读写权限。','finance_storage_test_failed',409);
          });
          sameStorage(req,user,prior);
          json(res,200,{ok:true,message:'服务器读写和测试文件清理通过；网页跨域上传权限及图片 SHA-256 校验仍需实际上传验证。'});return true;
        }
        const identity=receiptStorageIdentity(config),previousIdentity=storageIdentity(prior);
        if(readyCount(user.id)&&previousIdentity!==identity)throw bad('已有凭证图片，请重新连接原存储桶和目录；可以更新访问密钥','finance_storage_in_use',409);
        const write=()=>{
          if(previousIdentity!==identity)db.prepare('DELETE FROM finance_receipts WHERE user_id=? AND ready=0').run(user.id);
          putSetting(user.id,configKey,{version:nextStorageVersion(prior?.version||0),config});
        };
        changeStorage(user.id,write);json(res,200,safeStorage(user.id));return true;
      }
      if(path==='/api/finance/receipts/prepare'&&req.method==='POST'){
        const body=await readJson(req);sessionCurrent(req,user);checkRate(user.id,'prepare-minute',30,60000);checkRate(user.id,'prepare-day',250,86400000);
        if(!UUID.test(body.id)||!HASH.test(String(body.hash||'')))throw bad('图片标识不正确');
        const variants=variantsFrom(body.variants),config=requireStorage(user.id),prior=storage(user.id);
        try{await assertPublicHttps(config.endpoint)}catch(caught){sameStorage(req,user,prior);throw caught}
        sameStorage(req,user,prior);
        let row=db.prepare('SELECT * FROM finance_receipts WHERE user_id=? AND hash=?').get(user.id,body.hash);
        const sameId=db.prepare('SELECT * FROM finance_receipts WHERE id=?').get(body.id);
        if(sameId&&(sameId.user_id!==user.id||sameId.hash!==body.hash))throw bad('图片标识不可用，请重新选择截图','finance_receipt_id_conflict',409);
        if(row){
          const encrypted=row.data;row=unpack(row);
          if(row.ready){json(res,200,{receiptId:row.id,ready:true,duplicate:true,uploads:{}});return true}
          if(row.data.storageIdentity!==receiptStorageIdentity(config))throw bad('图片存储位置已变化，请检查设置','finance_storage_conflict',409);
          if(stable(row.data.variants)!==stable(variants)){
            const version=row.version+1;if(!Number.isSafeInteger(version))throw bad('图片上传版本超出范围','finance_receipt_stale_upload',409);
            // Retired PUT tickets must never write to a newer attempt's objects.
            const data=uploadData(user.id,row.id,variants,config);
            const changed=db.prepare('UPDATE finance_receipts SET data=?,version=?,updated_at=? WHERE id=? AND user_id=? AND hash=? AND ready=0 AND version=? AND data=?').run(encryptData(data,dataScope('finance-receipt',user.id,row.id,'data')),version,now(),row.id,user.id,row.hash,row.version,encrypted);
            if(changed.changes!==1)throw bad('图片资料已更新，请重新上传','version_conflict',409);
            row={...row,data,version};
          }
        }
        else{
          if(db.prepare('SELECT COUNT(*) n FROM finance_receipts WHERE user_id=?').get(user.id).n>=MAX_RECEIPTS)throw bad('凭证图片数量已达上限，请先整理','finance_receipt_quota',413);
          const stamp=now(),data=uploadData(user.id,body.id,variants,config);
          db.prepare('INSERT INTO finance_receipts(id,user_id,hash,data,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(body.id,user.id,body.hash,encryptData(data,dataScope('finance-receipt',user.id,body.id,'data')),stamp,stamp);row={id:body.id,hash:body.hash,data,version:1};
        }
        if(row.data.storageIdentity!==receiptStorageIdentity(config))throw bad('图片存储位置已变化，请检查设置','finance_storage_conflict',409);
        const uploads=Object.fromEntries(['image','thumb'].map(name=>[name,presignReceipt(config,row.data.keys[name],{method:'PUT',variant:row.data.variants[name]})]));
        json(res,200,{receiptId:row.id,ready:false,uploadVersion:row.version,uploads});return true;
      }
      const completed=/^\/api\/finance\/receipts\/([^/]+)\/complete$/.exec(path);
      if(completed&&req.method==='POST'){
        const body=await readJson(req);sessionCurrent(req,user);checkRate(user.id,'complete',120,60000);
        const row=owned(user.id,completed[1]);
        if(row.ready){json(res,200,{receipt:{id:row.id,hash:row.hash,ready:true}});return true}
        if(body.uploadVersion===undefined?row.version!==1:!Number.isSafeInteger(body.uploadVersion)||body.uploadVersion<1||body.uploadVersion!==row.version)throw bad('本次上传授权已失效，请重新选择截图','finance_receipt_stale_upload',409);
        const config=requireStorage(user.id),storageSnapshot=stable(storage(user.id));if(row.data.storageIdentity!==receiptStorageIdentity(config))throw bad('图片存储关联不一致');
        const checkCurrent=()=>{
          sessionCurrent(req,user);
          const current=owned(user.id,row.id);
          if(current.version!==row.version||stable(current.data)!==stable(row.data)||stable(storage(user.id))!==storageSnapshot)throw bad('图片资料或存储配置已更新，请重试','version_conflict',409);
        };
        await network(user.id,async()=>{
          try{for(const name of ['image','thumb']){
            const result=await s3Request(config,row.data.keys[name],'HEAD'),headers=result.headers||{},v=row.data.variants[name];
            checkCurrent();
            if(Number(headers['content-length'])!==v.bytes||String(headers['content-type']||'').split(';')[0].trim()!==v.type||headers['x-amz-meta-sha256']!==v.sha256)throw new Error('receipt metadata mismatch');
            if(isR2ReceiptStorage(config)){
              // R2 does not provide the same single-part SHA-256 HEAD proof as S3.
              // Hash the bounded actual object in memory; metadata is not proof.
              const read=await s3Request(config,row.data.keys[name],'GET',Buffer.alloc(0),{maxResponseBytes:v.bytes});
              checkCurrent();
              if(!Buffer.isBuffer(read.body)||read.body.length!==v.bytes||sha(read.body)!==v.sha256)throw new Error('receipt content mismatch');
            }else if(headers['x-amz-checksum-sha256']!==checksum(v.sha256))throw new Error('receipt checksum mismatch');
          }}catch{checkCurrent();throw bad('图片尚未上传完整或 SHA-256 校验失败，请重新上传后重试','finance_receipt_incomplete',409)}
        });
        checkCurrent();
        const changed=db.prepare('UPDATE finance_receipts SET ready=1,version=version+1,updated_at=? WHERE id=? AND user_id=? AND hash=? AND ready=0 AND version=?').run(now(),row.id,user.id,row.hash,row.version);
        if(changed.changes!==1)throw bad('图片资料已更新，请重试','version_conflict',409);
        json(res,200,{receipt:{id:row.id,hash:row.hash,ready:true}});return true;
      }
      if(path==='/api/finance/receipts/read'&&req.method==='POST'){
        const body=await readJson(req);sessionCurrent(req,user);checkRate(user.id,'read',120,60000);
        if(!Array.isArray(body.ids)||body.ids.length<1||body.ids.length>50||!['image','thumb'].includes(body.variant))throw bad('图片读取参数不正确');
        const rows=[...new Set(body.ids)].map(id=>owned(user.id,id));if(rows.some(row=>!row.ready))throw bad('图片尚未上传完成','finance_receipt_not_ready',409);
        const config=requireStorage(user.id);await assertPublicHttps(config.endpoint);sessionCurrent(req,user);
        if(receiptStorageIdentity(requireStorage(user.id))!==receiptStorageIdentity(config)||rows.some(row=>{const current=owned(user.id,row.id);return !current.ready||current.version!==row.version||stable(current.data)!==stable(row.data)}))throw bad('图片资料或存储配置已更新，请重试','version_conflict',409);
        if(rows.some(row=>row.data.storageIdentity!==receiptStorageIdentity(config)))throw bad('图片存储关联不一致');
        json(res,200,{urls:Object.fromEntries(rows.map(row=>[row.id,presignReceipt(config,row.data.keys[body.variant],{expires:300}).url]))});return true;
      }
      throw bad('图片接口不存在','not_found',404);
    }catch(caught){if(caught.status){error(res,caught.status,caught.message,caught.code);return true}throw caught}
  }
  return {handle,hasReadyReceipt,hasReadyReceipts:(userId,ids)=>ids.every(id=>hasReadyReceipt(userId,id)),storageOrigins,allowedOrigins:storageOrigins,exportUser,validateImport,importUser};
}
