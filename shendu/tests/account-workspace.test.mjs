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
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const settle=()=>new Promise(resolve=>setTimeout(resolve,20));
const owner=name=>{
  const match=new RegExp(`(?:^|\\n)((?:async )?function ${name}\\()`).exec(source);assert.ok(match,`${name} exists`);
  const start=match.index+(source[match.index]==='\n'?1:0),tail=source.slice(start+1),next=/\n(?:async )?function /.exec(tail);
  return source.slice(start,next?start+1+next.index:source.length);
};
const adminData={registrationOpen:false,users:[{id:'me',displayName:'测试',username:'tester',createdAt:'2026-11-01',role:'superadmin',status:'active'},{id:'member',displayName:'普通成员',username:'member',createdAt:'2026-11-02',role:'member',status:'active'}]};
function fixture(role='member',requestImpl=async()=>adminData){
  ui.renderMarkup($('#app'),'');
  const state={user:{id:'me',displayName:'<个人称呼>',username:'tester',role},route:'users',dirty:false,saving:false},calls=[],notices=[],initialized=[];
  const request=async(path,options)=>{calls.push({path,...options});return requestImpl(path,options)};
  const shell=html=>ui.renderMarkup($('#app'),`<main>${html}</main>`);
  const init=async()=>{initialized.push(true);state.user=null;ui.renderMarkup($('#app'),'<div id="login">登录</div>')};
  const fn=new Function('state','$','$$','shell','esc','workspaceArt','spacePageHead','request','renderMarkup','FormData','toast','init','openUserModal','patchUser','openDeleteUserModal',`${['accountSecurityHtml','renderUsers','loadManagedUsers','bindUsers','bindAccountSecurity'].map(owner).join('\n')}\nreturn {renderUsers,loadManagedUsers};`)(state,$,$$,shell,escape,()=>'<span aria-hidden="true"></span>',(_key,{title,description})=>`<header><h1 id="workspace-users-title">${title}</h1><p>${description}</p></header>`,request,ui.renderMarkup,win.FormData,(...args)=>notices.push(args),init,()=>{},()=>{},()=>{});
  return {state,calls,notices,initialized,...fn};
}
function submit(){const form=$('#password-form');form.dispatchEvent(new win.Event('submit',{bubbles:true,cancelable:true}))}
function fillPasswords(){ $('#account-current-password').value='current-private-password';$('#account-new-password').value='new-private-password';}

test('members see their own security fields without any admin request, and header has one account destination per menu',async()=>{
  const f=fixture();await f.renderUsers();
  assert.deepEqual(f.calls,[]);assert.ok($('#password-form'));assert.ok($('#logout'));assert.equal($('.workspace-members'),null);
  assert.equal($('#account-identity-title').textContent,'<个人称呼>');assert.equal($('#account-identity-title > *'),null,'identity is escaped');
  const current=$('#account-current-password'),next=$('#account-new-password');
  assert.equal(current.required,true);assert.equal(current.autocomplete,'current-password');
  assert.equal(next.required,true);assert.equal(next.minLength,15);assert.equal(next.maxLength,128);assert.equal(next.autocomplete,'new-password');
  const topbar=new Function('state','currentActionTemplate','headerLink','headerBrandContent','navIcon','esc',`${owner('topbar')}\nreturn topbar;`)({...f.state,stats:{}},()=>({pageTitle:'行动验证'}),()=>'',()=>'',()=>'',escape);
  const template=document.createElement('template');template.innerHTML=topbar();
  assert.equal(template.content.querySelectorAll('[data-nav="users"]').length,2,'one desktop and one mobile destination');
  assert.equal(template.content.querySelector('[data-modal="account"]'),null);
  assert.equal(template.content.textContent.includes('账户与安全'),false);
});

test('admin search refreshes only managed accounts, preserving edited native password fields',async()=>{
  const f=fixture('superadmin');await f.renderUsers();fillPasswords();
  const form=$('#password-form'),field=$('#account-new-password');
  assert.ok($('.workspace-members'));assert.ok($('#registration-open'));assert.ok($('#add-user'));
  $('#user-search').value='member';$('#user-search').dispatchEvent(new win.Event('change',{bubbles:true}));await settle();
  assert.deepEqual(f.calls.map(call=>call.path),['/api/admin/users?q=','/api/admin/users?q=member']);
  assert.equal($('#password-form'),form);assert.equal($('#account-new-password'),field);assert.equal(field.value,'new-private-password');
  assert.equal(new win.FormData(form).get('newPassword'),'new-private-password');
});

test('stale managed-account results cannot replace a new visit or newer search, and failure can retry locally',async()=>{
  const pending=[];const f=fixture('admin',()=>new Promise((resolve,reject)=>pending.push({resolve,reject})));
  const first=f.renderUsers();const oldOwner=$('#users-content');
  const second=f.renderUsers();const currentOwner=$('#users-content');
  pending[0].resolve(adminData);await first;assert.notEqual(oldOwner,currentOwner);assert.equal(currentOwner.textContent,'');
  pending[1].resolve(adminData);await second;assert.equal($('#registration-open'),null,'admin cannot change public registration');
  const older=f.loadManagedUsers('older'),newer=f.loadManagedUsers('newer');
  pending[3].resolve({...adminData,users:[]});await newer;
  pending[2].resolve(adminData);await older;assert.equal($('#user-search').value,'newer');assert.ok($('.workspace-empty-cell'));
  const failed=f.loadManagedUsers('again');pending[4].reject(new Error('暂时不可用'));await failed;assert.ok($('#users-retry'));
  $('#users-retry').click();pending[5].resolve(adminData);await settle();assert.equal($('#user-search').value,'again');assert.equal($('#users-content').hasAttribute('aria-busy'),false);
});

test('password submission is single-flight, retains input on error, and successful retry uses the original endpoint',async()=>{
  let reject,resolve;let attempt=0;
  const f=fixture('member',()=>new Promise((yes,no)=>{attempt++;resolve=yes;reject=no}));await f.renderUsers();fillPasswords();
  submit();submit();assert.equal(attempt,1);assert.equal(f.state.saving,true);assert.equal($('#password-form').getAttribute('aria-busy'),'true');assert.equal($('#password-form fieldset').disabled,true);assert.equal($('#logout').disabled,true);
  assert.deepEqual(f.calls[0],{path:'/api/me/password',method:'POST',body:{currentPassword:'current-private-password',newPassword:'new-private-password'}});
  reject(new Error('原密码不正确'));await settle();assert.equal($('#account-new-password').value,'new-private-password');assert.equal($('#password-form fieldset').disabled,false);assert.equal(f.state.saving,false);assert.deepEqual(f.notices,[['原密码不正确','error']]);
  submit();resolve({});await settle();assert.equal(f.initialized.length,1);assert.ok($('#login'));assert.equal(f.state.saving,false);
});

test('logout respects dirty state and pending guard, while stale password completion cannot initialize a different owner',async()=>{
  let complete;const f=fixture('member',()=>new Promise(resolve=>{complete=resolve}));await f.renderUsers();f.state.dirty=true;$('#logout').click();
  assert.equal(f.calls.length,0);assert.deepEqual(f.notices,[['请先保存或放弃当前修改','error']]);f.state.dirty=false;
  $('#logout').click();$('#logout').click();assert.equal(f.calls.length,1);assert.equal(f.calls[0].path,'/api/auth/logout');complete({});await settle();assert.equal(f.initialized.length,1);

  let oldComplete;const stale=fixture('member',()=>new Promise(resolve=>{oldComplete=resolve}));await stale.renderUsers();fillPasswords();submit();
  const other={id:'other',username:'other',displayName:'Other',role:'member'};stale.state.user=other;ui.renderMarkup($('#app'),'<main id="other-owner">另一位用户</main>');
  oldComplete({});await settle();assert.ok($('#other-owner'));assert.equal(stale.initialized.length,0);assert.equal(stale.state.saving,false);
});

test('an old password completion cannot clear a newer account write owner',async()=>{
  const pending=[];const f=fixture('member',()=>new Promise((resolve,reject)=>pending.push({resolve,reject})));
  await f.renderUsers();fillPasswords();submit();const oldForm=$('#password-form');
  f.state.user={id:'other',username:'other',displayName:'Other',role:'member'};
  await f.renderUsers();fillPasswords();submit();const currentForm=$('#password-form');
  assert.notEqual(oldForm,currentForm);assert.equal(f.state.accountWriteOwner,currentForm);
  pending[0].resolve({});await settle();assert.equal(f.initialized.length,0);assert.equal(f.state.accountWriteOwner,currentForm);assert.equal(f.state.saving,true);assert.equal(currentForm.getAttribute('aria-busy'),'true');
  pending[1].reject(new Error('请重试'));await settle();assert.equal(f.state.saving,false);assert.equal(f.state.accountWriteOwner,undefined);assert.equal($('#account-new-password').value,'new-private-password');
});

test('settings account destination closes its dialog before guarded navigation; other settings keep their back control',()=>{
  const calls=[],container=$('#modal-root');
  const openSettingsTarget=new Function('document','$','closeModal','attemptNavigate','navigate','openStage','openGuide','enhanceUi','openSettings',`${owner('openSettingsTarget')}\nreturn openSettingsTarget;`)(document,$,()=>calls.push('close'),next=>{calls.push('guard');next()},route=>calls.push(route),()=>{container.innerHTML='<div class="modal-head"><h2>阶段设置</h2></div>'},()=>{},ui.enhanceUi,()=>calls.push('settings'));
  container.innerHTML='<div class="modal-head"><h2>设置</h2></div>';openSettingsTarget('account');assert.deepEqual(calls,['close','guard','users']);assert.equal($('.settings-back'),null);
  openSettingsTarget('stage');assert.ok($('.settings-back'));$('.settings-back').click();assert.equal(calls.at(-1),'settings');
  ui.disposeUi(container);container.replaceChildren();
});
