import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm,access} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import {resolve,join,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';

const publicDir=resolve(fileURLToPath(new URL('../public/',import.meta.url)));
const csp="default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'; img-src 'self' data: blob:; object-src 'none'; base-uri 'none'";
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function chromeExecutable(){
  for(const path of [process.env.CHROME_EXECUTABLE_PATH,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe','/usr/bin/google-chrome','/usr/bin/chromium']){
    if(!path)continue;
    try{await access(path);return path}catch{}
  }
  return null;
}

function connectCdp(url){
  const socket=new WebSocket(url),pending=new Map(),listeners=new Set();let sequence=0;
  const ready=new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',()=>reject(new Error('Could not connect to isolated Chrome')),{once:true})});
  socket.addEventListener('message',event=>{
    const message=JSON.parse(event.data);
    if(message.id){const item=pending.get(message.id);if(!item)return;pending.delete(message.id);clearTimeout(item.timer);if(message.error)item.reject(new Error(message.error.message));else item.resolve(message.result);return}
    for(const listener of listeners)listener(message);
  });
  socket.addEventListener('close',()=>{for(const item of pending.values()){clearTimeout(item.timer);item.reject(new Error(`Isolated Chrome closed while running ${item.method}`))}pending.clear()});
  return {ready,onEvent:listener=>listeners.add(listener),close:()=>socket.close(),
    async send(method,params={},sessionId,timeout=10000){
      await ready;const id=++sequence;
      return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`CDP timeout: ${method}`))},timeout);pending.set(id,{resolve,reject,timer,method});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}))});
    }
  };
}

test('real Chrome runs self-hosted receipt OCR under strict CSP without external requests',{timeout:60000},async t=>{
  if(process.env.SHENDU_BROWSER_OCR_SMOKE!=='1'){t.skip('Set SHENDU_BROWSER_OCR_SMOKE=1 in a browser-capable environment');return}
  const executable=await chromeExecutable();if(!executable){t.skip('Chrome is not installed; local OCR asset and client unit tests remain required');return}
  const profile=await mkdtemp(join(tmpdir(),'shendu-receipt-ocr-'));
  const requested=[],external=[],runtimeErrors=[],childSetups=[];
  let chrome,cdp,browserLog='';
  const server=createServer(async(req,res)=>{
    res.setHeader('Content-Security-Policy',csp);
    try{
      const pathname=new URL(req.url,'http://localhost').pathname;
      if(pathname==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<!doctype html><meta charset="utf-8"><title>Isolated local receipt OCR</title>');return}
      const path=resolve(publicDir,'.'+decodeURIComponent(pathname));
      if(!path.startsWith(publicDir+sep)){res.writeHead(404);res.end();return}
      const bytes=await readFile(path);
      res.writeHead(200,{'Content-Type':({'.js':'text/javascript; charset=utf-8','.wasm':'application/wasm','.gz':'application/octet-stream'})[extname(path)]||'application/octet-stream'});res.end(bytes);
    }catch{res.writeHead(404);res.end()}
  });
  t.after(async()=>{
    try{if(cdp)await cdp.send('Browser.close',{},undefined,2000)}catch{}
    cdp?.close();
    if(chrome&&chrome.exitCode===null){chrome.kill();await Promise.race([new Promise(resolve=>chrome.once('exit',resolve)),delay(2000)])}
    server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
    // Chrome may release its profile handles a moment after the browser process exits.
    assert.ok(resolve(profile).startsWith(resolve(tmpdir())+sep+'shendu-receipt-ocr-'));
    await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  chrome=spawn(executable,['--headless=new','--disable-gpu','--disable-software-rasterizer','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--disable-domain-reliability','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1','about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  chrome.stderr.on('data',chunk=>{browserLog=(browserLog+chunk).slice(-4000)});
  const browserUrl=await new Promise((resolve,reject)=>{
    let output='';const timer=setTimeout(()=>reject(new Error('Isolated Chrome did not start within 10 seconds')),10000);
    chrome.once('error',error=>{clearTimeout(timer);reject(error)});
    chrome.once('exit',code=>{clearTimeout(timer);reject(new Error(`Isolated Chrome exited before ready (${code})`))});
    chrome.stderr.on('data',chunk=>{output+=chunk;const match=output.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timer);resolve(match[1])}});
  });
  cdp=connectCdp(browserUrl);await cdp.ready;
  const track=message=>{
    if(message.method==='Network.requestWillBeSent'){
      const raw=message.params.request.url;requested.push(raw);
      if(/^https?:/.test(raw)&&new URL(raw).origin!==origin)external.push(raw);
    }
    if(message.method==='Runtime.exceptionThrown')runtimeErrors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);
    if(message.method==='Fetch.requestPaused'){
      const {requestId,request}=message.params,raw=request.url;
      const foreign=/^https?:/.test(raw)&&new URL(raw).origin!==origin;
      if(foreign)external.push(raw);
      cdp.send(foreign?'Fetch.failRequest':'Fetch.continueRequest',{requestId,...(foreign?{errorReason:'BlockedByClient'}:{})},message.sessionId).catch(()=>{});
    }
    if(message.method==='Target.attachedToTarget'){
      const {sessionId}=message.params;
      const setup=(async()=>{await cdp.send('Network.enable',{},sessionId);await cdp.send('Runtime.enable',{},sessionId);await cdp.send('Fetch.enable',{patterns:[{urlPattern:'*'}]},sessionId);await cdp.send('Runtime.runIfWaitingForDebugger',{},sessionId)})();
      childSetups.push(setup);setup.catch(error=>runtimeErrors.push(error.message));
    }
  };
  cdp.onEvent(track);
  let sessionId;
  try{
    const {targetId}=await cdp.send('Target.createTarget',{url:'about:blank'});
    // Initial page setup is explicit; automatic child attachment then catches the OCR worker.
    ({sessionId}=await cdp.send('Target.attachToTarget',{targetId,flatten:true}));
    await Promise.all(childSetups);
    await cdp.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true},sessionId);
    await cdp.send('Page.enable',{},sessionId);await cdp.send('Page.navigate',{url:origin},sessionId);
  }catch(error){
    if(browserLog.includes("GPU process isn't usable")){t.skip('Chrome GPU subprocess is unavailable in this environment; OCR was not reached');return}
    throw error;
  }
  const expression=`(async()=>{
    while(document.readyState!=='complete')await new Promise(resolve=>setTimeout(resolve,10));
    const module=await import('/receipt-client.js');
    try{
      const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=300;
      const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.fillStyle='#111';context.font='64px "Microsoft YaHei", Arial, sans-serif';context.fillText('支付金额 ¥23.00',60,160);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      return await module.processReceiptFiles([new File([blob],'synthetic-receipt.png',{type:'image/png'})],{upload:false,date:'2026-11-15'});
    }finally{module.disposeReceiptWorker()}
  })()`;
  let result;
  try{result=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},sessionId,45000)}catch(error){t.diagnostic(`Isolated Chrome exit: ${chrome.exitCode}; ${browserLog}`);throw error}
  assert.equal(result.exceptionDetails,undefined,result.exceptionDetails?.exception?.description);
  const processed=result.result.value;
  assert.ok(processed.candidates.some(candidate=>candidate.expression==='23.00'),JSON.stringify(processed));
  assert.deepEqual(processed.receiptIds,[]);
  assert.ok(!processed.warnings.some(warning=>/未能自动识别|识别失败/.test(warning)),JSON.stringify(processed.warnings));
  for(const path of ['/ocr/tesseract.esm.min.js','/ocr/worker.min.js','/ocr/lang/chi_sim.traineddata.gz','/ocr/lang/eng.traineddata.gz'])assert.ok(requested.some(raw=>new URL(raw).pathname===path),`Missing local OCR request: ${path}`);
  assert.ok(requested.some(raw=>/\/ocr\/core\/tesseract-core[^/]*\.wasm\.js$/.test(new URL(raw).pathname)),'No local OCR core loaded');
  assert.deepEqual(external,[]);assert.deepEqual(runtimeErrors,[]);
});
