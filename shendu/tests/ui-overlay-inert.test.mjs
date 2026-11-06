import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const dom=new JSDOM(html,{url:'http://localhost',pretendToBeVisual:true}),win=dom.window;
for(const name of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement','HTMLSelectElement','HTMLButtonElement','HTMLFormElement','Element','Node','NodeFilter','Event','CustomEvent','KeyboardEvent','MouseEvent','MutationObserver','getComputedStyle','FormData'])globalThis[name]=win[name];
Object.defineProperty(globalThis,'navigator',{value:win.navigator,configurable:true});
globalThis.requestAnimationFrame=win.requestAnimationFrame.bind(win);globalThis.cancelAnimationFrame=win.cancelAnimationFrame.bind(win);
globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
win.HTMLElement.prototype.scrollIntoView=function(){};
const ui=await import('../public/ui/shadcn.js');
const $=(selector,root=document)=>root.querySelector(selector),$$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const app=$('#app'),rail=$('#rail-root'),notifications=$('#toast-root');
ui.initializeToasts(notifications);
const owner=name=>{
  const start=source.indexOf(`function ${name}(`),next=/\n(?:async )?function /.exec(source.slice(start+1)),end=next?start+1+next.index:-1;
  assert.ok(start>=0&&end>start,`locate actual ${name} owner`);
  return source.slice(start,end);
};
const names=['syncOverlayBackground','openModal','closeModal','renderAuth','sessionExpired'];
const state={};
const logins=[];let loginOk=true;
const login=async(path,options)=>{logins.push({path,...options});return{ok:loginOk,json:async()=>({message:'登录失败'})}};
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const controls=new Function('$','$$','state','prepareDialogContainer','showDialog','dismissDialog','cancelDailyTypewriter','setDailyImmersive','reviewNavigation','renderMarkup','esc','fetch','toast',`let modalReturnFocus=null;\n${names.map(owner).join('\n')}\nreturn {openModal,closeModal,renderAuth,sessionExpired};`)($,$$,state,ui.prepareDialogContainer,ui.showDialog,ui.dismissDialog,()=>{},()=>{},{clear(){}},ui.renderMarkup,escape,login,()=>{});
const settle=()=>new Promise(resolve=>setTimeout(resolve,30));

test('application overlay owner makes live review descendants inert without disabling either overlay or notifications',async()=>{
  assert.equal(rail.parentElement,document.body,'legacy empty mount stays outside the inert application');
  app.innerHTML='<header><button id="rail-toggle">阶段与日历</button></header><main id="daily-editor"><p aria-live="polite">预期验证日期</p><div><span aria-live="polite">已保存</span><button id="underlying-save">保存草稿</button><button>完成并锁定</button></div></main>';
  const save=$('#underlying-save');save.focus();
  controls.openModal('<div class="modal-head"><h2>完成确认</h2></div><button data-close>继续填写</button>');await settle();
  assert.equal(app.inert,true,'live date/save regions cannot expose the surrounding review controls');
  assert.equal($('#daily-editor').closest('#app'),app);assert.equal($('#modal-root .modal').closest('#app'),null);
  assert.notEqual($('#modal-root').inert,true);assert.notEqual(notifications.inert,true);
  ui.showToast(notifications,'请确认填写内容','info');await settle();assert.equal(notifications.closest('#app'),null);
  controls.closeModal();await settle();assert.equal(app.inert,false);assert.equal(document.activeElement,save);

});

test('full logged-out render removes body-level overlays and restores an interactive authentication screen',async()=>{
  controls.openModal('<div class="modal-head"><h2>正在验证</h2></div><button>继续</button>','',true);await settle();
  assert.equal(app.inert,true);
  controls.renderAuth();await settle();
  assert.equal(state.user,null);assert.equal(app.inert,false);
  assert.equal(document.querySelector('[role="dialog"]'),null);assert.ok($('#auth-form'));assert.equal(rail.childElementCount,0);
});

test('notice decoration preserves close controls and excludes specialized dialog surfaces',async()=>{
  controls.openModal('<div class="modal-head"><div><h2>还有未保存内容</h2><p>继续填写后再保存。</p></div></div><button id="continue-writing" data-close>继续填写</button>');await settle();
  assert.ok($('.modal.legacy-dialog'));assert.equal($('.legacy-dialog-art').getAttribute('aria-hidden'),'true');assert.equal($('.legacy-dialog-art img').alt,'');
  $('#continue-writing').click();await settle();assert.equal($('.modal'),null);
  for(const [size,content] of [['workspace-dialog','<div class="modal-head"><h2>设置</h2></div><button data-close>关闭</button>'],['verification-dialog','<div class="modal-head"><h2>验证</h2></div><button data-close>关闭</button>'],['','<div class="modal-head"><h2>新建用户</h2></div><form id="user-form"><input name="username"></form>']]){
    controls.openModal(content,size);await settle();assert.equal($('.modal.legacy-dialog'),null);assert.equal($('.legacy-dialog-art'),null);controls.closeModal();await settle();
  }
});

test('persistent illustrated reauthentication retains the original unsaved editor on failure and success',async()=>{
  ui.renderMarkup(app,'<main><textarea id="unsaved-editor">未保存的原文</textarea><button id="editor-save">保存</button></main>');
  const editor=$('#unsaved-editor');state.user={username:'<private-user>'};state.dirty=true;state.route='daily';$('#editor-save').focus();
  controls.sessionExpired();await settle();
  assert.equal(state.reauthOpen,true);assert.equal(state.dirty,true);assert.equal($('#unsaved-editor'),editor);assert.equal(app.inert,true);
  assert.ok($('.modal.legacy-reauth.legacy-dialog'));assert.equal($('.modal-close'),null);assert.equal($('#reauth-username').readOnly,true);assert.equal($('#reauth-username').value,'<private-user>');
  assert.equal($('#reauth-password').minLength,15);assert.equal($('#reauth-password').autocomplete,'current-password');
  controls.closeModal();assert.ok($('#reauth-form'),'persistent guard prevents dismissal');
  const submit=()=>$('#reauth-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  $('#reauth-password').value='a-secure-password';loginOk=false;submit();await settle();
  assert.ok($('#reauth-form'));assert.equal($('#unsaved-editor'),editor);assert.equal(editor.value,'未保存的原文');assert.equal(state.reauthOpen,true);
  loginOk=true;submit();await settle();
  assert.equal($('#reauth-form'),null);assert.equal(state.reauthOpen,false);assert.equal(state.dirty,true);assert.equal($('#unsaved-editor'),editor);assert.equal(app.inert,false);assert.equal(document.activeElement,$('#editor-save'));
  assert.equal(logins.length,2);assert.equal(logins[1].path,'/api/auth/login');assert.equal(logins[1].credentials,'same-origin');assert.deepEqual(JSON.parse(logins[1].body),{username:'<private-user>',password:'a-secure-password'});
});

test('illustrated registration preserves original identity and password constraints when switching to login',async()=>{
  controls.renderAuth({mode:'register',registrationOpen:true});await settle();
  assert.ok($('.auth-paper-shell'));assert.equal($('#displayName').name,'displayName');assert.equal($('#displayName').maxLength,32);assert.equal($('#username').minLength,3);assert.equal($('#username').maxLength,32);
  assert.equal($('#password').minLength,15);assert.equal($('#password').maxLength,128);assert.equal($('#password').autocomplete,'new-password');assert.equal($('#auth-error').getAttribute('role'),'status');
  $('#auth-switch').click();await settle();assert.equal($('#displayName'),null);assert.equal($('#password').autocomplete,'current-password');assert.ok($('#auth-form'));
});

test('backup target deletion waits for explicit confirmation and keeps cancellation, focus and retry safe',async()=>{
  ui.renderMarkup(app,'<button id="delete-test-target" data-target-delete="only-this-target">删除</button>');
  const requests=[];let fail=false,refreshed=0;
  const request=async(path,options)=>{requests.push({path,...options});if(fail)throw new Error('连接暂时失败');return{}};
  const bind=new Function('$','$$','state','openModal','closeModal','request','toast','renderBackup','bindSiteBackup',`${owner('dialogWriteTask')}\n${owner('bindBackup')}\nreturn bindBackup;`)($,$$,state,controls.openModal,controls.closeModal,request,()=>{},()=>{refreshed++},()=>{});
  bind({});const trigger=$('#delete-test-target');trigger.focus();trigger.click();await settle();
  assert.equal(requests.length,0);assert.ok($('.modal.legacy-dialog'));assert.match($('.backup-notice').textContent,/远端的备份文件不会被删除/);
  $('.modal-actions [data-close]').click();await settle();assert.equal(requests.length,0);assert.equal(document.activeElement,trigger);
  trigger.click();await settle();document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await settle();
  assert.equal($('.modal'),null);assert.equal(requests.length,0);assert.equal(document.activeElement,trigger);
  trigger.click();await settle();fail=true;$('#delete-target-confirm').click();await settle();
  assert.equal(requests.length,1);assert.ok($('.modal'));assert.equal($('#delete-target-confirm').disabled,false);assert.equal(refreshed,0);
  fail=false;$('#delete-target-confirm').click();await settle();assert.equal(requests.length,2);assert.deepEqual(requests[1],{path:'/api/backup/targets/only-this-target',method:'DELETE'});assert.equal($('.modal'),null);assert.equal(refreshed,1);assert.equal(document.activeElement,trigger);
});

test('pending target deletion cannot dismiss or later replace a newer dialog',async()=>{
  ui.renderMarkup(app,'<button id="pending-delete-target" data-target-delete="pending-target">删除</button>');
  let finish,refreshed=0,requests=0;
  const request=()=>{requests++;return new Promise(resolve=>{finish=resolve})};
  const bind=new Function('$','$$','state','openModal','closeModal','request','toast','renderBackup','bindSiteBackup',`${owner('dialogWriteTask')}\n${owner('bindBackup')}\nreturn bindBackup;`)($,$$,state,controls.openModal,controls.closeModal,request,()=>{},()=>{refreshed++},()=>{});
  bind({});$('#pending-delete-target').click();await settle();
  const confirm=$('#delete-target-confirm');confirm.click();confirm.click();
  assert.equal(requests,1);assert.equal(confirm.disabled,true);
  $('.modal-actions [data-close]').click();controls.closeModal();
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await settle();
  assert.equal($('#delete-target-confirm'),confirm,'pending deletion retains its confirmation surface');
  assert.equal($('#modal-root').dataset.persistent,'1');
  controls.closeModal(true);
  controls.openModal('<div class="modal-head"><h2>重新认证</h2></div><form id="new-reauth-form"><input name="password"></form>','',true);await settle();
  finish({});await settle();
  assert.ok($('#new-reauth-form'),'late completion cannot close a replacement dialog');
  assert.equal($('#modal-root').dataset.persistent,'1');assert.equal(refreshed,0);
  controls.closeModal(true);await settle();
});

test.after(()=>{ui.dismissDialog($('#modal-root'));ui.dismissDialog(rail);ui.disposeUi(app);ui.disposeUi(notifications);dom.window.close()});
