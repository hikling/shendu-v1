import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {inspectReceiptImage,receiptDimensions,validateReceiptFile,RECEIPT_LIMITS} from '../public/receipt-client.js';

const png=(width=800,height=1600)=>{const bytes=Buffer.alloc(24);bytes.set([137,80,78,71],0);bytes.write('IHDR',12);bytes.writeUInt32BE(width,16);bytes.writeUInt32BE(height,20);return bytes};
const screenshot=(width,height)=>{const bytes=png(width,height);return {type:'image/png',size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}};
const config={endpoint:'https://storage.example.com/api',bucket:'private',directory:'journal',pathStyle:true};
const objectUrl=name=>`https://storage.example.com/api/private/journal/receipts/owner/id/random/${name}.webp?X-Amz-Signature=temporary`;

async function browser({recognize=async()=>({data:{text:'商户：早餐店\n支付金额 ¥23.00'}}),encode,createWorker,transfer}={}){
  const originals=new Map();const set=(name,value)=>{originals.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,configurable:true,writable:true})};
  const canvases=[],bitmaps=[],workers=[],fetches=[];
  set('location',{origin:'https://shendu.test'});
  set('createImageBitmap',async()=>{const image={width:800,height:1600,closed:false,close(){this.closed=true}};bitmaps.push(image);return image});
  set('document',{createElement:()=>{const canvas={width:0,height:0,getContext:()=>({fillRect(){},drawImage(){}}),toBlob(callback,type,quality){callback(encode?encode({type,quality,canvas}):new Blob(['compressed-only'],{type}))}};canvases.push(canvas);return canvas}});
  set('fetch',async(url,args)=>{fetches.push({url,args});return transfer?transfer(url,args):{ok:true}});
  set('__receiptOcrLibrary',{createWorker:async(...args)=>{const instance={recognize,terminate:async()=>{instance.terminated=true},args};workers.push(instance);return createWorker?await createWorker(instance):instance}});
  // Replace only the browser asset import. The tested processing/ownership code is unchanged.
  const source=(await readFile(new URL('../public/receipt-client.js',import.meta.url),'utf8')).replace(/'\.\/finance-domain\.js(?:\?[^']*)?'/,JSON.stringify(new URL('../public/finance-domain.js',import.meta.url).href)).replace("import('/ocr/tesseract.esm.min.js')","Promise.resolve({default:globalThis.__receiptOcrLibrary})");
  const client=await import('data:text/javascript;base64,'+Buffer.from(source+'\n// '+Math.random()).toString('base64'));
  return {client,workers,canvases,bitmaps,fetches,restore(){client.disposeReceiptWorker();for(const [name,descriptor]of originals)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name]}};
}

test('receipt preflight rejects byte, type, pixel and malformed image bounds before decode',()=>{
  for(const file of [{type:'image/svg+xml',size:50},{type:'image/png',size:RECEIPT_LIMITS.fileBytes+1},{type:'image/jpeg',size:0}])assert.throws(()=>validateReceiptFile(file));
  assert.deepEqual(inspectReceiptImage(png(),'image/png'),{width:800,height:1600});
  assert.throws(()=>inspectReceiptImage(png(32000,32000),'image/png'),/尺寸/);
  assert.throws(()=>inspectReceiptImage(Buffer.alloc(24),'image/png'),/格式/);
  const jpg=Buffer.from([255,216,255,192,0,17,8,6,64,3,32,0,0,0,0,0,0,0,0,0,0]);
  assert.deepEqual(inspectReceiptImage(jpg,'image/jpeg'),{width:800,height:1600});
  const webp=Buffer.alloc(30);webp.write('RIFF',0);webp.write('WEBP',8);webp.write('VP8X',12);webp.writeUIntLE(799,24,3);webp.writeUIntLE(1599,27,3);
  assert.deepEqual(inspectReceiptImage(webp,'image/webp'),{width:800,height:1600});
});

test('compression dimensions retain aspect ratio while bounding long screenshot pixels and thumbnail size',()=>{
  for(const [width,height]of [[800,1600],[1440,23000],[32000,1000],[1000,32000]])for(const variant of ['image','thumb']){
    const size=receiptDimensions(width,height,variant);assert.ok(size.width<=width&&size.height<=height);
    assert.ok(size.width<=(variant==='thumb'?240:1440));assert.ok(size.height<=(variant==='thumb'?480:14000));
    assert.ok(size.width*size.height<=(variant==='thumb'?115200:8*1024*1024));
    assert.ok(Math.abs(size.width/width-size.height/height)<=1/width+1/height);
  }
});

test('compression releases decoded/canvas memory and hashes only accepted encoded variants',async()=>{
  const b=await browser();try{const result=await b.client.compressReceipt(screenshot());assert.equal(result.image.type,'image/webp');assert.equal(result.thumb.bytes,15);assert.match(result.image.sha256,/^[a-f0-9]{64}$/);assert.ok(b.bitmaps.every(bitmap=>bitmap.closed));assert.ok(b.canvases.every(canvas=>canvas.width===1&&canvas.height===1));assert.equal(b.workers.length,0)}finally{b.restore()}
});

test('unsupported WebP encoders fall back to JPEG; overlarge compressed output fails and cleans up',async()=>{
  let b=await browser({encode:({type})=>new Blob(['fallback'],{type:type==='image/webp'?'image/png':type})});try{const compressed=await b.client.compressReceipt(screenshot());assert.equal(compressed.image.type,'image/jpeg')}finally{b.restore()}
  b=await browser({encode:({type})=>new Blob([new Uint8Array(RECEIPT_LIMITS.imageBytes+1)],{type})});try{await assert.rejects(b.client.compressReceipt(screenshot()),/压缩后仍然过大/);assert.equal(b.bitmaps[0].closed,true);assert.equal(b.canvases[0].width,1)}finally{b.restore()}
});

test('unconfigured storage still recognizes locally using one lazy worker across sequential files',async()=>{
  const b=await browser();try{
    let transfers=0;const result=await b.client.processReceiptFiles([screenshot(),screenshot()],{request:async path=>{assert.equal(path,'/api/finance/storage');transfers++;return {configured:false}},date:'2026-11-15'});
    assert.equal(result.imageStatus,'not_stored');assert.equal(result.candidates.length,2);assert.equal(result.candidates[0].expression,'23.00');assert.deepEqual(result.receiptIds,[]);assert.match(result.warnings[0],/不会长期保存/);assert.equal(transfers,1);assert.equal(b.fetches.length,0);assert.equal(b.workers.length,1);
    const [languages,oem,options]=b.workers[0].args;assert.deepEqual(languages,['chi_sim','eng']);assert.equal(oem,1);assert.equal(options.workerBlobURL,false);for(const name of ['workerPath','corePath','langPath'])assert.ok(options[name].startsWith('https://shendu.test/ocr/'));
  }finally{b.restore()}
});

test('only compressed variants go directly to validated S3 URLs and complete after both successful PUTs',async()=>{
  const b=await browser();try{
    const calls=[];const result=await b.client.processReceiptFiles([screenshot()],{date:'2026-11-15',request:async(path,args)=>{calls.push({path,args});if(path.endsWith('/storage'))return {configured:true,config};if(path.endsWith('/prepare'))return {receiptId:'receipt-id',uploads:Object.fromEntries(['image','thumb'].map(name=>[name,{url:objectUrl(name),headers:{'Content-Type':'image/webp'}}]))};if(path.endsWith('/complete')){assert.equal(b.fetches.length,2);return {receipt:{ready:true}}}throw Error(path)}});
    assert.equal(result.imageStatus,'stored');assert.deepEqual(result.receiptIds,['receipt-id']);assert.equal(calls.length,3);assert.ok(calls[1].args.body.variants.image.bytes<24);assert.equal(JSON.stringify(calls).includes('compressed-only'),false);
    for(const transfer of b.fetches){assert.equal(await transfer.args.body.text(),'compressed-only');assert.equal(transfer.args.credentials,'omit');assert.equal(transfer.args.redirect,'error');assert.match(transfer.url,/^https:\/\/storage\.example\.com\//)}
  }finally{b.restore()}
});

test('foreign or escaped upload targets fail visibly without leaking image bytes or ready IDs',async()=>{
  for(const url of ['https://other.example.com/receipts/image.webp','https://storage.example.com/api/private/elsewhere/image.webp','https://user:pass@storage.example.com/api/private/journal/receipts/image.webp']){
    const b=await browser();try{await assert.rejects(b.client.processReceiptFiles([screenshot()],{request:async path=>path.endsWith('/storage')?{configured:true,config}:{receiptId:'bad',uploads:{image:{url}}}}),{code:'receipt_upload_failed'});assert.equal(b.fetches.length,0)}finally{b.restore()}
  }
});

test('ready duplicate images reuse the owned receipt and ask for duplicate review without another upload',async()=>{
  const b=await browser();try{const result=await b.client.processReceiptFiles([screenshot()],{request:async path=>path.endsWith('/storage')?{configured:true,config}:{receiptId:'existing',ready:true,duplicate:true}});assert.equal(b.fetches.length,0);assert.deepEqual(result.receiptIds,['existing']);assert.equal(result.candidates[0].duplicate,true);assert.match(result.warnings.join(' '),/重复记账/)}finally{b.restore()}
});

test('OCR failure preserves manual candidates and never creates ledger entries',async()=>{
  const b=await browser({recognize:async()=>{throw new Error('runtime error')}});try{const result=await b.client.processReceiptFiles([screenshot()],{upload:false});assert.equal(result.candidates[0].expression,'');assert.equal(result.candidates[0].confidence,0);assert.match(result.warnings.join(' '),/手动补充/);assert.equal(b.fetches.length,0)}finally{b.restore()}
});

test('cancel terminates the OCR worker, releases batch ownership, and blocks stale upload completion',async()=>{
  let started;const entered=new Promise(resolve=>{started=resolve});const b=await browser({recognize:()=>{started();return new Promise(()=>{})}});try{
    const aborter=new AbortController(),task=b.client.processReceiptFiles([screenshot()],{signal:aborter.signal,upload:false});await entered;
    await assert.rejects(b.client.processReceiptFiles([screenshot()],{upload:false}),/上一批/);aborter.abort();await assert.rejects(task,{name:'AbortError'});assert.equal(b.workers[0].terminated,true);assert.equal(b.fetches.length,0);
    await assert.rejects(b.client.processReceiptFiles(Array(21).fill(screenshot())),/最多处理20张/);
  }finally{b.restore()}
});

test('canceled initialization cannot spawn a second worker and terminates its eventual stale handle',async()=>{
  let finish,start;const started=new Promise(resolve=>{start=resolve});const b=await browser({createWorker:instance=>{start();return new Promise(resolve=>{finish=()=>resolve(instance)})}});try{
    const aborter=new AbortController(),first=b.client.processReceiptFiles([screenshot()],{signal:aborter.signal,upload:false});await started;aborter.abort();await assert.rejects(first,{name:'AbortError'});
    const secondAborter=new AbortController(),second=b.client.processReceiptFiles([screenshot()],{signal:secondAborter.signal,upload:false});while(b.canvases.length<4||b.canvases.at(-1).width!==1)await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));assert.equal(b.workers.length,1);
    finish();const result=await second;assert.equal(b.workers[0].terminated,true);assert.match(result.warnings.join(' '),/手动补充/);assert.equal(result.candidates[0].expression,'');
  }finally{b.restore()}
});

test('receipt reads batch IDs, validate storage path and origin, and suppress obsolete owners',async()=>{
  const b=await browser();try{
    const ids=Array.from({length:51},(_,index)=>'receipt-'+index),calls=[];const request=async(path,args)=>{calls.push({path,args});return path.endsWith('/storage')?{configured:true,config}:{urls:Object.fromEntries(args.body.ids.map(id=>[id,objectUrl('image')]))}};
    const urls=await b.client.loadReceiptUrls(ids,'image',{request});assert.equal(Object.keys(urls).length,51);assert.equal(calls.length,3);assert.equal(calls[1].args.body.ids.length,50);assert.equal(calls[2].args.body.ids.length,1);
    await assert.rejects(b.client.loadReceiptUrls(['receipt'],'image',{request:async path=>path.endsWith('/storage')?{configured:true,config}:{urls:{receipt:'https://other.example.com/image'}}}),/私有存储设置/);
    let current=true;await assert.rejects(b.client.loadReceiptUrls(['receipt'],'thumb',{isCurrent:()=>current,request:async()=>{current=false;return {configured:true,config}}}),{name:'AbortError'});
  }finally{b.restore()}
});

test('bundled OCR manifest includes every selectable core and both pinned language files with exact hashes',async()=>{
  const root=new URL('../public/ocr/',import.meta.url),manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
  assert.equal(manifest.engine,'tesseract.js@7.0.0');assert.equal(manifest.core,'tesseract.js-core@7.0.0');
  const names=new Set(manifest.files.map(item=>item.path));for(const language of ['eng','chi_sim'])assert.ok(names.has(`lang/${language}.traineddata.gz`));
  for(const variant of ['','-lstm','-simd','-simd-lstm','-relaxedsimd','-relaxedsimd-lstm'])for(const extension of ['wasm','wasm.js'])assert.ok(names.has(`core/tesseract-core${variant}.${extension}`));
  for(const file of manifest.files){const data=await readFile(new URL(file.path,root));assert.equal(data.byteLength,file.bytes,file.path);assert.equal(createHash('sha256').update(data).digest('hex'),file.sha256,file.path)}
});


test('configured upload or verification failure rejects without exposing image-free confirmation candidates',async()=>{
  for(const failure of ['put','verify']){
    const b=await browser({transfer:()=>({ok:failure!=='put',status:403})});try{
      const calls=[];await assert.rejects(b.client.processReceiptFiles([screenshot()],{request:async path=>{
        calls.push(path);if(path.endsWith('/storage'))return {configured:true,config};
        if(path.endsWith('/prepare'))return {receiptId:'receipt-id',uploads:Object.fromEntries(['image','thumb'].map(name=>[name,{url:objectUrl(name),headers:{}}]))};
        if(path.endsWith('/complete'))return {receipt:{ready:false}};
        throw Error(path);
      }}),error=>error.code==='receipt_upload_failed'&&/本批次尚未入账/.test(error.message));
      assert.ok(!calls.some(path=>path.includes('/entries')));if(failure==='put')assert.ok(!calls.some(path=>path.endsWith('/complete')));
    }finally{b.restore()}
  }
});

test('each stored screenshot retains its receipt even when OCR has no amount',async()=>{
  let index=0;const b=await browser({recognize:async()=>({data:{text:++index===1?'支付金额 ¥23.00':'没有金额'}})});try{
    let receipt=0;const result=await b.client.processReceiptFiles([screenshot(),screenshot()],{date:'2026-11-16',request:async path=>{
      if(path.endsWith('/storage'))return {configured:true,config};if(path.endsWith('/prepare'))return {receiptId:'stored-'+(++receipt),ready:true};throw Error(path);
    }});
    assert.equal(result.imageStatus,'stored');assert.equal(result.candidates.length,2);
    assert.deepEqual(result.candidates.map(row=>row.receiptIds),[['stored-1'],['stored-2']]);assert.equal(result.candidates[1].expression,'');
  }finally{b.restore()}
});
