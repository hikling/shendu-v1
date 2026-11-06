import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const dom=new JSDOM(html,{url:'http://localhost',pretendToBeVisual:true}),win=dom.window;
for(const name of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement','HTMLSelectElement','HTMLButtonElement','HTMLFormElement','Element','Node','NodeFilter','Event','CustomEvent','KeyboardEvent','MouseEvent','MutationObserver','getComputedStyle','FormData'])globalThis[name]=win[name];
Object.defineProperty(globalThis,'navigator',{value:win.navigator,configurable:true});
globalThis.requestAnimationFrame=win.requestAnimationFrame.bind(win);globalThis.cancelAnimationFrame=win.cancelAnimationFrame.bind(win);
globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
const ui=await import('../public/ui/shadcn.js');
const $=(selector,root=document)=>root.querySelector(selector),$$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const settle=()=>new Promise(resolve=>setTimeout(resolve,25));
const owner=name=>{
  const match=new RegExp(`(?:^|\\n)((?:async )?function ${name}\\()`).exec(source);assert.ok(match,name);
  const start=match.index+(source[match.index]==='\n'?1:0),next=/\n(?:async )?function /.exec(source.slice(start+1));
  return source.slice(start,next?start+1+next.index:source.length);
};
function fixture(impl){
  ui.dismissDialog($('#modal-root'));ui.renderMarkup($('#app'),'<main id="actions-page"><button id="open-verification">填写行动验证</button></main>');
  const original={id:'record-one',type:'daily',period:'2026-09-01',status:'completed',data:{action:'original action',verifyDate:'2026-09-02'}};
  const state={user:{id:'owner',username:'owner'},records:[original],stats:{pending:1},saving:false},calls=[],notices=[],renders=[];
  const request=(path,options)=>{calls.push({path,...options});return impl(path,options)};
  const names=['syncOverlayBackground','openModal','closeModal','dialogWriteTask','openVerification','attemptNavigate'];
  const functions=new Function('$','$$','state','request','prepareDialogContainer','showDialog','dismissDialog','cancelDailyTypewriter','esc','toast','earliestActualVerification','today','dailyCalendarDateLabel','templatesForRecord','recordArtAssignments','RECORD_ART','TYPES','overviewDateParts','formatDate','renderActions',`let modalReturnFocus=null;\n${names.map(owner).join('\n')}\nreturn {openModal,closeModal,openVerification,attemptNavigate};`)($,$$,state,request,ui.prepareDialogContainer,ui.showDialog,ui.dismissDialog,()=>{},esc,(...args)=>notices.push(args),()=> '2026-09-02',()=> '2026-11-06',value=>value,()=>({action:new Proxy({},{get:(_,key)=>String(key)})}),()=>new Map(),{daily:[{src:'/assets/daily/action.webp'}]},{daily:{label:'每日复盘'}},()=>null,value=>value,()=>renders.push('actions'));
  $('#open-verification').addEventListener('click',()=>functions.openVerification(original.id));
  return {state,original,calls,notices,renders,...functions};
}
function submit(){ $('#verify-form').dispatchEvent(new win.Event('submit',{bubbles:true,cancelable:true})); }
function fill(){ $('#verify-result').value='actual result';$('#verify-adjustment').value='next adjustment'; }
const verified=original=>({...original,status:'verified',verification:{result:'actual result',adjustment:'next adjustment'}});

test('verification submits once and blocks cancellation/navigation while the exact form is pending',async()=>{
  let finish;const f=fixture(path=>path==='/api/stats'?Promise.resolve({pending:0,total:1}):new Promise(resolve=>{finish=resolve}));
  $('#open-verification').click();await settle();fill();submit();submit();assert.equal(f.calls.length,1);assert.equal(f.state.saving,true);
  assert.deepEqual(f.calls[0],{path:'/api/records/record-one/verify',method:'POST',body:{result:'actual result',adjustment:'next adjustment'}});
  assert.equal($('#verify-form [type="submit"]').disabled,true);assert.equal($('.modal-close').disabled,true);
  const form=$('#verify-form');f.closeModal();$('#verify-form [data-close]').click();let navigated=false;f.attemptNavigate(()=>{navigated=true});assert.equal($('#verify-form'),form);assert.equal(navigated,false);
  finish({record:verified(f.original)});await settle();assert.equal($('#verify-form'),null);assert.equal(f.state.records[0].status,'verified');assert.equal(f.state.stats.pending,0);assert.equal(f.state.saving,false);assert.deepEqual(f.renders,['actions']);
});

test('failed verification preserves input for retry; successful commit remains complete when stats refresh fails',async()=>{
  let finish;const f=fixture(path=>path==='/api/stats'?Promise.reject(new Error('stats unavailable')):new Promise((resolve,reject)=>{finish={resolve,reject}}));
  $('#open-verification').click();fill();submit();finish.reject(new Error('network unavailable'));await settle();assert.equal($('#verify-result').value,'actual result');assert.equal($('#verify-adjustment').value,'next adjustment');assert.equal($('#verify-form [type="submit"]').disabled,false);assert.equal(f.state.records[0],f.original);assert.equal(f.state.saving,false);
  submit();finish.resolve({record:verified(f.original)});await settle();assert.equal(f.calls.filter(call=>call.path.includes('/verify')).length,2);assert.equal(f.state.records[0].status,'verified');assert.equal($('#verify-form'),null);assert.deepEqual(f.renders,['actions']);assert.match(f.notices.at(-1)[0],/已锁定/);
});

test('late verification responses cannot close another modal, alter another account or release a newer write',async()=>{
  let finish;const f=fixture(()=>new Promise(resolve=>{finish=resolve}));$('#open-verification').click();fill();submit();
  f.closeModal(true);f.state.user={id:'new-owner'};f.state.records=[{id:'private-record'}];f.state.stats={pending:9};f.openModal('<div class="modal-head"><h2>New operation</h2></div><form id="replacement"><input name="value"><button>Save</button></form>');
  const replacement=$('#replacement');f.state.dialogWriteOwner=replacement;f.state.saving=true;
  finish({record:verified(f.original)});await settle();assert.equal($('#replacement'),replacement);assert.deepEqual(f.state.records,[{id:'private-record'}]);assert.deepEqual(f.state.stats,{pending:9});assert.equal(f.state.saving,true);assert.equal(f.state.dialogWriteOwner,replacement);assert.deepEqual(f.renders,[]);assert.equal(f.calls.length,1);
});
