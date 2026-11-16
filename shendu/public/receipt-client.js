import {parseReceiptText} from './finance-domain.js?v=1.0.0-finance2';

export const RECEIPT_LIMITS=Object.freeze({files:20,fileBytes:20*1024*1024,pixels:32*1024*1024,imageBytes:2*1024*1024,thumbBytes:96*1024});
let worker=null,workerPromise=null,workerGeneration=0,activeBatch=null,ocrProgress=()=>{};
const cancelled=()=>new DOMException('已取消图片处理','AbortError');
const assertCurrent=(isCurrent,signal)=>{if(signal?.aborted||!isCurrent())throw cancelled()};

function dimensions(width,height){
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width>32000||height>32000||width*height>RECEIPT_LIMITS.pixels)throw new Error('截图尺寸过大，请裁剪或分成几张后上传');
  return {width,height};
}
export function inspectReceiptImage(buffer,type){
  const bytes=new Uint8Array(buffer),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),ascii=(from,count)=>String.fromCharCode(...bytes.slice(from,from+count));
  if(type==='image/png'&&bytes.length>=24&&bytes[0]===137&&ascii(1,3)==='PNG'&&ascii(12,4)==='IHDR')return dimensions(view.getUint32(16),view.getUint32(20));
  if(type==='image/webp'&&bytes.length>=30&&ascii(0,4)==='RIFF'&&ascii(8,4)==='WEBP'){
    const chunk=ascii(12,4);
    if(chunk==='VP8X')return dimensions(1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16),1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16));
    if(chunk==='VP8L'&&bytes[20]===47)return dimensions(1+((bytes[21]|(bytes[22]<<8))&16383),1+(((bytes[22]>>6)|(bytes[23]<<2)|(bytes[24]<<10))&16383));
    if(chunk==='VP8 '&&bytes[23]===157&&bytes[24]===1&&bytes[25]===42)return dimensions(view.getUint16(26,true)&16383,view.getUint16(28,true)&16383);
  }
  if(type==='image/jpeg'&&bytes.length>=12&&bytes[0]===255&&bytes[1]===216){
    let offset=2;
    while(offset+4<=Math.min(bytes.length,512*1024)){
      if(bytes[offset]!==255)break;
      while(bytes[offset+1]===255)offset++;
      const marker=bytes[offset+1];offset+=2;
      if(marker===217||marker===218)break;
      if(marker===216||(marker>=208&&marker<=215))continue;
      const length=view.getUint16(offset);if(length<2||offset+length>bytes.length)break;
      if(marker>=192&&marker<=207&&![196,200,204].includes(marker)&&length>=7)return dimensions(view.getUint16(offset+5),view.getUint16(offset+3));
      offset+=length;
    }
  }
  throw new Error('图片格式无法读取，请选择PNG、JPEG或WebP截图');
}
export function receiptDimensions(width,height,variant='image'){
  dimensions(width,height);
  const factor=Math.min(1,(variant==='thumb'?240:1440)/width,(variant==='thumb'?480:14000)/height,Math.sqrt((variant==='thumb'?115200:8*1024*1024)/(width*height)));
  return {width:Math.max(1,Math.floor(width*factor)),height:Math.max(1,Math.floor(height*factor))};
}
export function validateReceiptFile(file){
  if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||!Number.isSafeInteger(file.size)||file.size<1||file.size>RECEIPT_LIMITS.fileBytes)throw new Error('请选择20MB以内的PNG、JPEG或WebP截图');
}
const digest=async blob=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(value=>value.toString(16).padStart(2,'0')).join('');

async function decode(file){
  if(typeof createImageBitmap==='function')return createImageBitmap(file);
  const url=URL.createObjectURL(file);
  try{return await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('图片解码失败，请换一张截图'));image.src=url})}finally{URL.revokeObjectURL(url)}
}
async function toBlob(canvas,type,quality){
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('无法压缩图片，请重试')),type,quality));
}
export async function compressReceipt(file,{isCurrent=()=>true,signal}={}){
  validateReceiptFile(file);const buffer=await file.arrayBuffer();assertCurrent(isCurrent,signal);inspectReceiptImage(buffer,file.type);
  const image=await decode(file);
  try{
    assertCurrent(isCurrent,signal);
    const width=image.width||image.naturalWidth,height=image.height||image.naturalHeight;dimensions(width,height);
    const result={};
    for(const name of ['image','thumb']){
      const size=receiptDimensions(width,height,name),canvas=document.createElement('canvas');canvas.width=size.width;canvas.height=size.height;
      try{
        const context=canvas.getContext('2d');if(!context)throw new Error('浏览器暂不支持图片压缩');
        context.fillStyle='#fff';context.fillRect(0,0,size.width,size.height);context.drawImage(image,0,0,size.width,size.height);
        let blob=await toBlob(canvas,'image/webp',name==='thumb'?.72:.82);
        if(!['image/webp','image/jpeg'].includes(blob.type))blob=await toBlob(canvas,'image/jpeg',name==='thumb'?.72:.82);
        if(!['image/webp','image/jpeg'].includes(blob.type))throw new Error('浏览器无法生成压缩凭证，请更换浏览器');
        if(name==='image'&&blob.size>300*1024)blob=await toBlob(canvas,blob.type,.72);
        const maximum=name==='image'?RECEIPT_LIMITS.imageBytes:RECEIPT_LIMITS.thumbBytes;
        if(blob.size>maximum)throw new Error('截图压缩后仍然过大，请裁剪或分成几张以保留清晰文字');
        assertCurrent(isCurrent,signal);result[name]={blob,type:blob.type,bytes:blob.size,sha256:await digest(blob)};
      }finally{canvas.width=1;canvas.height=1}
    }
    return {...result,hash:[...new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))].map(value=>value.toString(16).padStart(2,'0')).join('')};
  }finally{image.close?.()}
}

async function localWorker(){
  if(worker)return worker;if(workerPromise)return workerPromise;
  const generation=workerGeneration;
  const initializing=(async()=>{
    const library=(await import('/ocr/tesseract.esm.min.js')).default;
    const origin=location.origin;
    const created=await library.createWorker(['chi_sim','eng'],1,{workerPath:origin+'/ocr/worker.min.js',corePath:origin+'/ocr/core',langPath:origin+'/ocr/lang',workerBlobURL:false,errorHandler:()=>{},logger:message=>ocrProgress(message)});
    if(generation!==workerGeneration){await created.terminate();throw cancelled()}
    worker=created;return created;
  })();
  workerPromise=initializing;
  try{return await initializing}finally{if(workerPromise===initializing)workerPromise=null}
}
function resetWorker(abortBatch){
  workerGeneration++;const prior=worker;worker=null;ocrProgress=()=>{};if(abortBatch)activeBatch?.abort();
  if(prior)Promise.resolve(prior.terminate()).catch(()=>{});
}
export function disposeReceiptWorker(){resetWorker(true)}
async function recognize(blob,{isCurrent,signal,onProgress}){
  const generation=workerGeneration;
  ocrProgress=message=>{if(!signal?.aborted&&isCurrent())onProgress({stage:'recognizing',message:'正在本地识别截图',progress:Number(message.progress)||0})};
  let timer,abort;
  try{
    const task=(async()=>{const engine=await localWorker();assertCurrent(isCurrent,signal);return engine.recognize(blob)})();
    const result=await Promise.race([task,new Promise((_,reject)=>{
      timer=setTimeout(()=>{resetWorker(false);reject(new Error('本地识别用时较长，可先手动填写账目'))},90000);
      abort=()=>{resetWorker(false);reject(cancelled())};signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
    })]);
    assertCurrent(isCurrent,signal);if(generation!==workerGeneration)throw cancelled();return result.data?.text||'';
  }finally{clearTimeout(timer);if(abort)signal?.removeEventListener('abort',abort);ocrProgress=()=>{}}
}

async function uploadVariants(compressed,{request,isCurrent,signal,config}){
  assertCurrent(isCurrent,signal);
  const variants=Object.fromEntries(['image','thumb'].map(name=>[name,{bytes:compressed[name].bytes,type:compressed[name].type,sha256:compressed[name].sha256}]));
  const ticket=await request('/api/finance/receipts/prepare',{method:'POST',body:{id:crypto.randomUUID(),hash:compressed.hash,variants}},isCurrent);assertCurrent(isCurrent,signal);
  if(ticket.ready)return {id:ticket.receiptId,duplicate:ticket.duplicate===true};
  for(const name of ['image','thumb']){
    assertCurrent(isCurrent,signal);const upload=ticket.uploads?.[name],target=storageTarget(upload?.url,config);
    const transfer=new AbortController(),stop=()=>transfer.abort(),deadline=setTimeout(stop,60000);signal?.addEventListener('abort',stop,{once:true});
    try{
      const response=await fetch(target.href,{method:'PUT',headers:upload.headers,body:compressed[name].blob,mode:'cors',credentials:'omit',redirect:'error',signal:transfer.signal});
      if(!response.ok)throw new Error(`图片上传失败（${response.status}），请核对存储权限与跨域设置`);
    }catch(caught){if(signal?.aborted)throw cancelled();throw caught.name==='AbortError'?new Error('图片上传超时，请稍后重试'):caught}
    finally{clearTimeout(deadline);signal?.removeEventListener('abort',stop)}
  }
  assertCurrent(isCurrent,signal);await request(`/api/finance/receipts/${encodeURIComponent(ticket.receiptId)}/complete`,{method:'POST',body:{}},isCurrent);assertCurrent(isCurrent,signal);return {id:ticket.receiptId,duplicate:false};
}

function storageTarget(raw,config){
  let target,expected;
  try{
    target=new URL(raw);expected=new URL(config.endpoint);
    if(!config.pathStyle)expected.hostname=`${config.bucket}.${expected.hostname}`;
    const parts=[...expected.pathname.split('/').filter(Boolean).map(decodeURIComponent),...(config.pathStyle?[config.bucket]:[]),...String(config.directory||'').split('/').filter(Boolean),'receipts'];
    const prefix='/'+parts.map(part=>encodeURIComponent(part).replace(/[!'()*]/g,char=>'%'+char.charCodeAt(0).toString(16).toUpperCase())).join('/')+'/';
    if(target.protocol!=='https:'||target.origin!==expected.origin||target.username||target.password||target.hash||!target.pathname.startsWith(prefix))throw new Error();
  }catch{throw new Error('图片地址与私有存储设置不一致，请重新读取设置')}
  return target;
}

export async function processReceiptFiles(files,{request,isCurrent=()=>true,onProgress=()=>{},signal,categories,date,upload=true}={}){
  const list=Array.from(files||[]);if(!list.length)return {candidates:[],receiptIds:[],warnings:[]};
  if(list.length>RECEIPT_LIMITS.files)throw new Error('每次最多处理20张截图，请分批选择');
  if(activeBatch)throw new Error('上一批截图还在处理中，请稍候');list.forEach(validateReceiptFile);
  const owner=new AbortController();activeBatch=owner;const abort=()=>owner.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)owner.abort();
  const current=()=>activeBatch===owner&&!owner.signal.aborted&&isCurrent(),candidates=[],receiptIds=[],warnings=[];
  try{
    let configured=null;
    if(upload&&request){const result=await request('/api/finance/storage',{},current);assertCurrent(current,owner.signal);configured=result.configured?result.config:null;if(!configured)warnings.push('尚未配置凭证存储：可以识别和记账，但本次图片不会长期保存。')}
    for(let index=0;index<list.length;index++){
      assertCurrent(current,owner.signal);onProgress({stage:'compressing',message:`正在压缩第${index+1}/${list.length}张截图`,index,total:list.length});
      const compressed=await compressReceipt(list[index],{isCurrent:current,signal:owner.signal});
      let text='',imageWarning=[];
      try{text=await recognize(compressed.image.blob,{isCurrent:current,signal:owner.signal,onProgress})}
      catch(caught){assertCurrent(current,owner.signal);imageWarning.push('未能自动识别完整账目，请核对并手动补充。')}
      assertCurrent(current,owner.signal);let receiptId=null,duplicate=false;
      if(configured){
        onProgress({stage:'uploading',message:`正在保存第${index+1}/${list.length}张压缩凭证`,index,total:list.length});
        try{const stored=await uploadVariants(compressed,{request,isCurrent:current,signal:owner.signal,config:configured});receiptId=stored.id;duplicate=stored.duplicate;receiptIds.push(receiptId);if(duplicate)imageWarning.push('这张截图已保存过，请核对是否重复记账。')}
        catch(caught){assertCurrent(current,owner.signal);imageWarning.push(caught.message||'凭证图片保存失败，请重试。')}
      }
      const parsed=parseReceiptText(text,{date,categories}),rows=parsed.length?parsed:[{date,expression:'',purpose:'',kind:'expense',categoryId:'uncategorized',confidence:0,warnings:['未识别到金额，请手动填写。']}];
      for(const row of rows)candidates.push({...row,duplicate,receiptIds:receiptId?[receiptId]:[],warnings:[...(row.warnings||[]),...imageWarning]});
      warnings.push(...imageWarning);onProgress({stage:'processed',message:`已处理${index+1}/${list.length}张截图`,index:index+1,total:list.length});
    }
    return {candidates,receiptIds:[...new Set(receiptIds)],warnings:[...new Set(warnings)]};
  }finally{signal?.removeEventListener('abort',abort);if(activeBatch===owner)activeBatch=null;ocrProgress=()=>{}}
}

export async function loadReceiptUrls(ids,variant,{request,isCurrent=()=>true}={}){
  const unique=[...new Set(ids||[])];if(!unique.length)return {};
  if(!['thumb','image'].includes(variant))throw new Error('图片类型无效');const urls={};
  assertCurrent(isCurrent);const storage=await request('/api/finance/storage',{},isCurrent);assertCurrent(isCurrent);
  if(!storage.configured||!storage.config)throw new Error('尚未配置凭证图片存储');
  for(let offset=0;offset<unique.length;offset+=50){
    assertCurrent(isCurrent);const result=await request('/api/finance/receipts/read',{method:'POST',body:{ids:unique.slice(offset,offset+50),variant}},isCurrent);assertCurrent(isCurrent);
    for(const [id,raw]of Object.entries(result.urls||{}))if(unique.includes(id))urls[id]=storageTarget(raw,storage.config).href;
  }
  return urls;
}
