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
function fixture(impl=async()=>({user:{username:'owner'}}),fetchImpl=async()=>({ok:true,json:async()=>({})})){
  ui.dismissDialog($('#modal-root'));ui.renderMarkup($('#app'),'');
  const state={user:null,reauthOpen:false},calls=[],boots=[],notices=[];
  const request=(path,options)=>{calls.push({path,...options});return impl(path,options)};
  const names=['syncOverlayBackground','openModal','closeModal','renderAuth','sessionExpired'];
  const functions=new Function('$','$$','state','request','fetch','boot','renderMarkup','prepareDialogContainer','showDialog','dismissDialog','cancelDailyTypewriter','setDailyImmersive','reviewNavigation','esc','toast',`let modalReturnFocus=null;\n${names.map(owner).join('\n')}\nreturn {renderAuth,sessionExpired,openModal,closeModal};`)($,$$,state,request,fetchImpl,async user=>boots.push(user),ui.renderMarkup,ui.prepareDialogContainer,ui.showDialog,ui.dismissDialog,()=>{},()=>{},{clear(){}},esc,(...args)=>notices.push(args));
  return {state,calls,boots,notices,...functions};
}
function submit(id){$(id).dispatchEvent(new win.Event('submit',{bubbles:true,cancelable:true}));}

test('authentication submits once, retains failed values and retries with original native form payload',async()=>{
  let finish;const f=fixture(()=>new Promise((resolve,reject)=>{finish={resolve,reject}}));
  f.renderAuth({registrationOpen:true});$('#username').value='owner';$('#password').value='personal-password';
  submit('#auth-form');submit('#auth-form');assert.equal(f.calls.length,1);assert.equal($('#auth-switch').disabled,true);
  assert.deepEqual(f.calls[0],{path:'/api/auth/login',method:'POST',body:{username:'owner',password:'personal-password'}});
  finish.reject(new Error('<img src=x onerror=alert(1)>'));await settle();assert.equal($('#auth-error img'),null);assert.equal($('#auth-error').textContent,'<img src=x onerror=alert(1)>');assert.equal($('#password').value,'personal-password');assert.equal($('#auth-switch').disabled,false);
  submit('#auth-form');finish.resolve({user:{username:'owner'}});await settle();assert.deepEqual(f.boots,[{username:'owner'}]);
});

test('obsolete authentication responses cannot boot or write errors into a replacement authentication form',async()=>{
  const pending=[];const f=fixture(()=>new Promise((resolve,reject)=>pending.push({resolve,reject})));
  f.renderAuth();submit('#auth-form');f.renderAuth({mode:'register'});pending[0].resolve({user:{username:'old'}});await settle();assert.equal(f.boots.length,0);assert.ok($('#displayName'));
  submit('#auth-form');f.renderAuth();pending[1].reject(new Error('old login failure'));await settle();assert.equal($('#auth-error').textContent,'');assert.equal(f.boots.length,0);
});

test('reauthentication is single-flight, handles network failure and cannot dismiss a replacement modal',async()=>{
  const pending=[];const f=fixture(undefined,(path,options)=>new Promise((resolve,reject)=>pending.push({resolve,reject,path,options})));
  f.state.user={username:'owner'};f.sessionExpired();$('#reauth-password').value='personal-password';submit('#reauth-form');submit('#reauth-form');assert.equal(pending.length,1);
  pending[0].reject(new Error('network disconnected'));await settle();assert.ok($('#reauth-form'));assert.equal($('#reauth-password').disabled,false);assert.equal($('#reauth-password').value,'personal-password');assert.equal(f.notices.at(-1)[0],'network disconnected');
  submit('#reauth-form');f.closeModal(true);f.openModal('<div class="modal-head"><h2>Another operation</h2></div><input id="replacement">','',true);
  pending[1].resolve({ok:true,json:async()=>({})});await settle();assert.ok($('#replacement'));assert.equal(f.state.reauthOpen,true);
  f.renderAuth();assert.equal(f.state.reauthOpen,false);assert.equal(f.state.user,null);
});
