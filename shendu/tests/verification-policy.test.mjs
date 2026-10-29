import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
import {verificationMinimum} from '../public/verification-policy.js';

test('周期最早日期跨周、月、季、年，决策满三个日历月并夹住月底',()=>{
  const date='2026-10-29';
  assert.deepEqual(Object.fromEntries(['daily','weekly','monthly','quarterly','yearly','decision'].map(type=>[type,verificationMinimum(type,date)])),{
    daily:date,weekly:'2026-11-02',monthly:'2026-11-01',quarterly:'2027-01-01',yearly:'2027-01-01',decision:'2027-01-29'
  });
  assert.equal(verificationMinimum('weekly','2026-11-01'),'2026-11-02');
  assert.equal(verificationMinimum('weekly','2026-11-02'),'2026-11-09');
  assert.equal(verificationMinimum('quarterly','2026-12-31'),'2027-01-01');
  assert.equal(verificationMinimum('decision','2025-01-31'),'2025-04-30');
  assert.equal(verificationMinimum('decision','2023-11-30'),'2024-02-29');
  assert.throws(()=>verificationMinimum('monthly','2026-02-30'),RangeError);
});

test('服务端拒绝当期预期日期与到期前实际验证，每日原规则仍可即时验证',async t=>{
  const root=mkdtempSync(join(tmpdir(),'shendu-verification-'));
  const appDir=fileURLToPath(new URL('../',import.meta.url));
  const listener=net.createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');
  const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
  const base=`http://127.0.0.1:${port}`;
  const child=spawn(process.execPath,['server.mjs'],{cwd:appDir,env:{...process.env,SHENDU_PORT:String(port),SHENDU_DATA_DIR:join(root,'data'),SHENDU_TMP_DIR:join(root,'tmp'),SHENDU_MASTER_KEY:'',SHENDU_MASTER_KEY_PATH:join(root,'data','backup-master.key')},stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',chunk=>{output+=chunk});child.stderr.on('data',chunk=>{output+=chunk});
  t.after(async()=>{if(child.exitCode===null){const exited=once(child,'exit');child.kill('SIGTERM');await exited}rmSync(root,{recursive:true,force:true})});
  let ready=false;for(let i=0;i<150&&!ready;i++){try{ready=(await fetch(base+'/healthz')).ok}catch{}if(!ready)await new Promise(resolve=>setTimeout(resolve,20))}
  assert.ok(ready,output);
  let cookie='';
  async function api(path,method='GET',body){const response=await fetch(base+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const value=await response.json();return{status:response.status,value,cookie:response.headers.get('set-cookie')?.split(';')[0]}}
  const registration=await api('/api/auth/register','POST',{username:'date_audit',password:'date-audit-password-2026'});assert.equal(registration.status,201);cookie=registration.cookie;
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
  const week=(()=>{const d=new Date(`${today}T12:00:00Z`),day=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()+4-day);const start=new Date(Date.UTC(d.getUTCFullYear(),0,1,12));return `${d.getUTCFullYear()}-W${String(Math.ceil((((d-start)/86400000)+1)/7)).padStart(2,'0')}`})();
  const keys={weekly:['plan','progress','nextThree'],monthly:['goalResult','change','bottleneck','experiment'],quarterly:['hope','evidence','choices','nextGoals'],yearly:['coordinates','expectations','keepRelease','nextYear'],decision:['decision','options','facts','expectation','failure','choice','firstStep']};
  for(const type of Object.keys(keys)){
    const period=type==='weekly'?week:type==='monthly'?today.slice(0,7):type==='yearly'?today.slice(0,4):today;
    const data={answers:Object.fromEntries(keys[type].map(key=>[key,['有事实的回答']])),action:'下一步',ifThen:'遇到阻碍时调整',verifyDate:today};
    let saved=await api('/api/records','PUT',{type,period,title:type==='decision'?'一项决定':'复盘',data});assert.equal(saved.status,200,JSON.stringify(saved.value));
    const id=saved.value.record.id;
    const premature=await api(`/api/records/${id}/complete`,'POST');assert.equal(premature.status,400,type);
    data.verifyDate=verificationMinimum(type,today);
    saved=await api('/api/records','PUT',{id,type,period,title:type==='decision'?'一项决定':'复盘',version:saved.value.record.version,data});assert.equal(saved.status,200,type);
    const completed=await api(`/api/records/${id}/complete`,'POST');assert.equal(completed.status,200,`${type}: ${JSON.stringify(completed.value)}`);
    const early=await api(`/api/records/${id}/verify`,'POST',{result:'实际结果',adjustment:'继续调整',outcome:'好',process:'好'});assert.equal(early.status,400,type);assert.equal(early.value.error,'verification_too_early',type);
  }
  const daily=await api('/api/records','PUT',{type:'daily',period:today,title:'当天记录',data:{answers:{today:['事实']},action:'行动',ifCondition:'阻碍',ifThen:'应对',verifyDate:today}});
  assert.equal(daily.status,200);
  assert.equal((await api(`/api/records/${daily.value.record.id}/complete`,'POST')).status,200);
  assert.equal((await api(`/api/records/${daily.value.record.id}/verify`,'POST',{result:'结果',adjustment:'调整'})).status,200);
});
