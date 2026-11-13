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
function owner(name){
  const match=new RegExp(String.raw`(?:^|\n)((?:async )?function ${name}\()`).exec(source);assert.ok(match,name);
  const start=match.index+(source[match.index]==='\n'?1:0),next=/\n(?:async )?function /.exec(source.slice(start+1));
  return source.slice(start,next?start+1+next.index:source.length);
}
const member={id:'member',displayName:'<img src=x onerror=alert(1)>',username:'member',role:'member',status:'active',createdAt:'2026-11-01'};
const data={registrationOpen:true,users:[member,{...member,id:'admin',username:'admin',role:'admin'},{...member,id:'root',username:'root',role:'superadmin'}]};
function fixture(impl=async()=>({}),role='superadmin'){
  ui.dismissDialog($('#modal-root'));ui.renderMarkup($('#app'),'');
  const state={user:{id:'root',username:'root',displayName:'站长',role},saving:false,dirty:false},calls=[],notices=[];
  const request=(path,options)=>{calls.push({path,...options});return path.startsWith('/api/admin/users?q=')?Promise.resolve(data):impl(path,options)};
  const context={$,$$,state,request,renderMarkup:ui.renderMarkup,prepareDialogContainer:ui.prepareDialogContainer,showDialog:ui.showDialog,dismissDialog:ui.dismissDialog,cancelDailyTypewriter:()=>{},esc,shell:content=>ui.renderMarkup($('#app'),`<main>${content}</main>`),spacePageHead:()=>'<h1>账户管理</h1>',workspaceArt:()=>'',toast:(...args)=>notices.push(args),init:async()=>{}};
  const names=['accountSecurityHtml','renderUsers','loadManagedUsers','managedUsersWriteTask','bindUsers','bindAccountSecurity','openUserModal','openDeleteUserModal','patchUser','dialogWriteTask','syncOverlayBackground','openModal','closeModal'];
  const functions=new Function(...Object.keys(context),`let modalReturnFocus=null;\n${names.map(owner).join('\n')}\nreturn {renderUsers,loadManagedUsers,openUserModal,openDeleteUserModal,openModal,closeModal};`)(...Object.values(context));
  return {state,calls,notices,...functions};
}
const submit=selector=>$(selector).dispatchEvent(new win.Event('submit',{bubbles:true,cancelable:true}));
function fillUser(reset=false){if(!reset){$('#user-form [name=displayName]').value='新成员';$('#user-form [name=username]').value='newmember'}$('#user-form [name=password]').value='private-new-password'}
function fillDelete(){ $('#delete-user-confirm').value=' ＭＥＭＢＥＲ ';$('#delete-user-password').value='private-current-password';}

test('admin creation is one flight, busy protected, retains failure inputs and permits retry',async()=>{
  const pending=[];const f=fixture(()=>new Promise((resolve,reject)=>pending.push({resolve,reject})));await f.renderUsers();f.openUserModal();fillUser();
  submit('#user-form');submit('#user-form');assert.equal(pending.length,1);assert.equal(f.state.saving,true);assert.equal($('#modal-root').dataset.persistent,'1');assert.equal($('#user-form [name=password]').disabled,true);
  f.closeModal();document.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await settle();assert.ok($('#user-form'));
  assert.deepEqual(f.calls.find(call=>call.method==='POST'),{path:'/api/admin/users',method:'POST',body:{displayName:'新成员',username:'newmember',role:'member',password:'private-new-password'}});
  pending[0].reject(new Error('用户名已存在'));await settle();assert.equal($('#user-form [name=password]').value,'private-new-password');assert.equal($('#user-form [name=password]').disabled,false);assert.equal(f.state.saving,false);
  submit('#user-form');pending[1].resolve({});await settle();assert.equal($('#user-form'),null);assert.deepEqual(f.notices,[['用户名已存在','error'],['账户已创建']]);assert.equal(f.calls.filter(call=>call.path.startsWith('/api/admin/users?q=')).length,2);
});

test('password reset sends only the password and late modal/page/account results have no effect',async()=>{
  for(const replace of ['modal','page','account','role']){
    let finish;const f=fixture(()=>new Promise(resolve=>{finish=resolve}));await f.renderUsers();f.openUserModal('member');fillUser(true);submit('#user-form');
    assert.deepEqual(f.calls.at(-1),{path:'/api/admin/users/member',method:'PATCH',body:{password:'private-new-password'}});
    f.closeModal(true);f.openModal('<div class="modal-head"><h2>新的操作</h2></div><input id="new-dialog">','',true);
    if(replace==='page')ui.renderMarkup($('#app'),'<main id="new-page">其他页面</main>');
    if(replace==='account')f.state.user={id:'other',role:'superadmin'};
    if(replace==='role')f.state.user.role='member';
    finish({});await settle();assert.ok($('#new-dialog'));assert.equal($('#modal-root').dataset.persistent,'1');assert.deepEqual(f.notices,[]);assert.equal(f.calls.length,2);assert.equal(f.state.saving,false);
  }
});

test('older admin modal completion cannot release a newer dialog write',async()=>{
  const pending=[];const f=fixture(()=>new Promise(resolve=>pending.push(resolve)));await f.renderUsers();f.openUserModal();fillUser();submit('#user-form');
  f.closeModal(true);f.openUserModal('member');fillUser(true);submit('#user-form');const current=$('#user-form');
  pending[0]({});await settle();assert.equal(f.state.dialogWriteOwner,current);assert.equal(f.state.saving,true);assert.equal(current.querySelector('input').disabled,true);assert.deepEqual(f.notices,[]);
  pending[1]({});await settle();assert.equal(f.state.saving,false);assert.equal($('#user-form'),null);assert.deepEqual(f.notices,[['密码已重置']]);
});

test('a replaced admin dialog cannot unlock a newer account password write, which releases itself normally',async()=>{
  const pending=[];const f=fixture(()=>new Promise((resolve,reject)=>pending.push({resolve,reject})));await f.renderUsers();f.openUserModal();fillUser();submit('#user-form');
  f.closeModal(true);await f.renderUsers();$('#account-current-password').value='private-current-password';$('#account-new-password').value='private-new-password';submit('#password-form');const form=$('#password-form');
  assert.equal(f.state.accountWriteOwner,form);assert.equal(pending.length,2);pending[0].resolve({});await settle();assert.equal(f.state.saving,true);assert.equal(f.state.accountWriteOwner,form);assert.equal($('fieldset',form).disabled,true);assert.deepEqual(f.notices,[]);
  pending[1].reject(new Error('密码不正确'));await settle();assert.equal(f.state.saving,false);assert.equal(f.state.accountWriteOwner,undefined);assert.equal($('fieldset',form).disabled,false);assert.deepEqual(f.notices,[['密码不正确','error']]);
});

test('a replaced admin dialog cannot unlock a newer member-status write, which releases itself normally',async()=>{
  const pending=[];const f=fixture(()=>new Promise(resolve=>pending.push(resolve)));await f.renderUsers();f.openUserModal();fillUser();submit('#user-form');
  f.closeModal(true);await f.renderUsers();f.state.saving=false;$('[data-user-toggle="member"]').click();const next=f.state.adminWriteOwner,button=$('[data-user-toggle="member"]');assert.ok(next);assert.equal(pending.length,2);
  pending[0]({});await settle();assert.equal(f.state.adminWriteOwner,next);assert.equal(f.state.saving,true);assert.equal(button.disabled,true);assert.deepEqual(f.notices,[]);
  pending[1]({});await settle();assert.equal(f.state.saving,false);assert.equal(f.state.adminWriteOwner,undefined);assert.equal($('[data-user-toggle="member"]').disabled,false);assert.deepEqual(f.notices,[['账户已更新']]);
});

test('user deletion validates escaped identity and keeps exact credentials through failure and retry',async()=>{
  const pending=[];const f=fixture(()=>new Promise((resolve,reject)=>pending.push({resolve,reject})));await f.renderUsers();f.openDeleteUserModal(member);
  assert.equal($('#modal-root [onerror]'),null);assert.match($('#modal-root').textContent,/<img src=x onerror=alert\(1\)>/);$('#delete-user-confirm').value='wrong';submit('#delete-user-form');assert.equal(pending.length,0);
  fillDelete();submit('#delete-user-form');submit('#delete-user-form');assert.equal(pending.length,1);assert.equal(f.state.saving,true);f.closeModal();assert.ok($('#delete-user-form'));
  assert.deepEqual(f.calls.at(-1),{path:'/api/admin/users/member',method:'DELETE',body:{confirmationUsername:' ＭＥＭＢＥＲ ',currentPassword:'private-current-password'}});
  pending[0].reject(new Error('密码不正确'));await settle();assert.equal($('#delete-user-password').value,'private-current-password');assert.equal($('#delete-user-password').disabled,false);
  submit('#delete-user-form');pending[1].resolve({});await settle();assert.equal($('#delete-user-form'),null);assert.deepEqual(f.notices.at(-1),['用户 member 已永久删除']);assert.equal(f.state.saving,false);
});

test('registration changes serialize, disable the real checkbox, roll back visibly on failure and retry',async()=>{
  const pending=[];const f=fixture(()=>new Promise((resolve,reject)=>pending.push({resolve,reject})));await f.renderUsers();
  const native=$('#registration-open'),visible=$('[data-ui-checkbox-for="registration-open"]');assert.equal(visible.getAttribute('aria-checked'),'true');visible.click();await settle();
  assert.equal(pending.length,1);assert.deepEqual(f.calls.at(-1),{path:'/api/admin/registration',method:'PUT',body:{open:false}});assert.equal(visible.disabled,true);assert.equal($('#logout').disabled,true);assert.equal(f.state.saving,true);visible.click();assert.equal(pending.length,1);
  pending[0].reject(new Error('网络暂不可用'));await settle();assert.equal(native.checked,true);assert.equal(visible.getAttribute('aria-checked'),'true');assert.equal(visible.disabled,false);assert.equal($('#logout').disabled,false);assert.equal(f.state.saving,false);
  visible.click();pending[1].resolve({});await settle();assert.equal(native.checked,false);assert.equal(visible.getAttribute('aria-checked'),'false');assert.deepEqual(f.notices,[['网络暂不可用','error'],['公开注册设置已更新']]);
});

test('status and role writes cannot duplicate, preserve errors for retry and ignore obsolete pages',async()=>{
  const pending=[];const f=fixture(()=>new Promise((resolve,reject)=>pending.push({resolve,reject})));await f.renderUsers();
  const button=$('[data-user-toggle="member"]');button.click();button.click();assert.equal(pending.length,1);assert.equal($('#add-user').disabled,true);assert.equal($('#account-current-password').disabled,true);
  pending[0].reject(new Error('请重试'));await settle();assert.equal(button.disabled,false);assert.equal(f.state.saving,false);button.click();pending[1].resolve({});await settle();assert.deepEqual(f.notices,[['请重试','error'],['账户已更新']]);
  $('[data-user-role="member"]').click();assert.deepEqual(f.calls.at(-1),{path:'/api/admin/users/member',method:'PATCH',body:{role:'admin'}});ui.renderMarkup($('#app'),'<main id="replacement">其他页面</main>');pending[2].resolve({});await settle();assert.ok($('#replacement'));assert.equal(f.notices.length,2);assert.equal(f.state.saving,false);
});

test('an old page write cannot change registration or clear a newer write owner',async()=>{
  let finish;const f=fixture(()=>new Promise(resolve=>{finish=resolve}));await f.renderUsers();$('[data-ui-checkbox-for="registration-open"]').click();
  f.state.user={id:'other',role:'superadmin'};await f.renderUsers();const replacement=$('#registration-open'),newOwner={};f.state.reviewWriteOwner=newOwner;f.state.saving=true;
  finish({});await settle();assert.equal(replacement.checked,true);assert.deepEqual(f.notices,[]);assert.equal(f.state.reviewWriteOwner,newOwner);assert.equal(f.state.saving,true);
});

test('ordinary admins retain member management without registration, role controls or administrator actions',async()=>{
  const f=fixture(undefined,'admin');await f.renderUsers();assert.equal($('#registration-open'),null);assert.equal($('[data-user-role]'),null);assert.ok($('[data-user-toggle="member"]'));assert.equal($('[data-user-toggle="admin"]'),null);assert.equal($('[data-user-toggle="root"]'),null);
  f.openUserModal();assert.equal($('#user-form [name=role]'),null);assert.equal($('#user-form [name=password]').minLength,15);assert.equal($('#user-form [name=password]').maxLength,128);
});

test.afterEach(()=>{ui.dismissDialog($('#modal-root'));ui.disposeUi($('#app'));$('#app').replaceChildren()});
test.after(()=>dom.window.close());
