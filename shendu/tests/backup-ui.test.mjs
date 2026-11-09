import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {backupScheduleLabel} from '../public/backup-schedule.js';

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
const status={configured:true,available:true},targets={targets:[],runs:[]};
function fixture(impl=async path=>path==='/api/backup/status'?status:targets){
  ui.dismissDialog($('#modal-root'));ui.renderMarkup($('#app'),'');
  const state={user:{id:'owner',username:'owner',role:'superadmin'},saving:false},calls=[],notices=[],downloads=[];
  const request=(path,options)=>{calls.push({path,...options});return impl(path,options)};
  const shell=html=>ui.renderMarkup($('#app'),`<main>${html}</main>`);
  const names=['syncOverlayBackground','openModal','closeModal','dialogWriteTask','backupTargetKindLabel','backupRunRows','renderBackup','bindBackup','bindSiteBackup','refreshData'];
  const functions=new Function('$','$$','state','request','renderMarkup','prepareDialogContainer','showDialog','dismissDialog','cancelDailyTypewriter','esc','shell','spacePageHead','workspaceArt','siteBackupSection','beijingDateTime','today','toast','downloadBlob','openTargetModal','targetAction','applyTheme','backupScheduleLabel',`let modalReturnFocus=null;\n${names.map(owner).join('\n')}\nreturn {renderBackup,bindBackup,bindSiteBackup,openModal,closeModal,refreshData};`)($,$$,state,request,ui.renderMarkup,ui.prepareDialogContainer,ui.showDialog,ui.dismissDialog,()=>{},esc,shell,()=>'<h1>数据备份</h1>',()=>'',()=>'<button id="site-backup-export">整站导出</button><input id="site-backup-file" type="file">',value=>value||'',()=> '2026-11-06',(...args)=>notices.push(args),(blob,name)=>downloads.push({blob,name}),()=>{},()=>{},()=>{},backupScheduleLabel);
  return {state,calls,notices,downloads,...functions};
}
function choose(id,file){const input=$(id);Object.defineProperty(input,'files',{value:[file],configurable:true});input.dispatchEvent(new win.Event('change',{bubbles:true}));}
function submit(id){$(id).dispatchEvent(new win.Event('submit',{bubbles:true,cancelable:true}));}
const file={name:'private.shendu',size:64,text:async()=> 'encrypted-backup-text'};
const preview={ownerUsername:'owner',count:1,counts:{record:1},requiresOwnerConfirmation:false};

test('backup page loads belong to their original visit and account, and metadata remains plain text',async()=>{
  const pending=[];const f=fixture(()=>new Promise((resolve,reject)=>pending.push({resolve,reject})));
  const first=f.renderBackup(),old=$('#backup-content'),second=f.renderBackup(),current=$('#backup-content');
  pending[0].resolve(status);pending[1].resolve(targets);await first;assert.notEqual(old,current);assert.equal(current.querySelector('.workspace-backup-grid'),null);
  pending[2].resolve(status);pending[3].resolve({targets:[{id:'target',name:'<img src=x onerror=alert(1)>',kind:'s3',schedule:'manual',last_error:'<script>bad</script>'}],runs:[{created_at:'2026-11-06',status:'error',message:'<svg onload=alert(1)>'}]});await second;
  assert.equal(current.querySelector('script,svg,[onerror],[onload]'),null);assert.match(current.textContent,/<img src=x onerror=alert\(1\)>/);
  const third=f.renderBackup();f.state.user={id:'other',username:'other'};pending[4].reject(new Error('late failure'));pending[5].resolve(targets);await third;
  assert.equal($('#backup-retry'),null,'old account errors cannot alter new account rendering');
});

test('backup page shows exact Beijing plans and complete target-aware result rows without the old twelve-row truncation',async()=>{
  const payload={targets:[
    {id:'cloud',name:'云存储',kind:'s3',schedule:'daily',scheduleTime:'02:35',scheduleWeekday:1},
    {id:'dav',name:'家里网络存储',kind:'webdav',schedule:'weekly',scheduleTime:'21:10',scheduleWeekday:7}
  ],runs:Array.from({length:16},(_,index)=>({operation:'backup',created_at:'2026-11-06',target_name:index%2?'家里网络存储':'云存储',target_kind:index%2?'webdav':'s3',trigger:index%2?'scheduled':'manual',status:index%2?'error':'success',message:index%2?'备份上传失败':'备份成功'}))};
  const f=fixture(async path=>path==='/api/backup/status'?status:payload);await f.renderBackup();
  assert.match($('.workspace-external-backup').textContent,/每天 02:35（北京时间）/);
  assert.match($('.workspace-external-backup').textContent,/每周日 21:10（北京时间）/);
  assert.deepEqual($$('.backup-runs-table th').map(node=>node.textContent),['时间','备份目标','执行方式','结果','说明']);
  assert.equal($$('.backup-runs-table tbody tr').length,16);
  assert.match($('.workspace-backup-runs').textContent,/最近十天（北京时间）/);
  const row=$('.backup-runs-table tbody tr');assert.match(row.textContent,/云存储.*S3 兼容存储.*手动备份.*备份成功/);
});

test('personal backup inspection is single-flight, busy-protected and cannot replace a newer dialog',async()=>{
  let finish;const f=fixture(path=>path==='/api/data/inspect'?new Promise(resolve=>{finish=resolve}):Promise.resolve(path==='/api/backup/status'?status:targets));
  await f.renderBackup();choose('#backup-file',file);await settle();$('#restore-password-form input').value='private-backup-password';
  submit('#restore-password-form');submit('#restore-password-form');assert.equal(f.calls.filter(call=>call.path==='/api/data/inspect').length,1);
  assert.equal(f.state.saving,true);assert.equal($('#modal-root').dataset.persistent,'1');f.closeModal();assert.ok($('#restore-password-form'));
  f.closeModal(true);f.openModal('<div class="modal-head"><h2>另一个确认</h2></div><input id="new-dialog">','',true);
  finish(preview);await settle();assert.ok($('#new-dialog'));assert.equal($('#apply-restore'),null);assert.equal(f.state.saving,false);assert.equal($('#modal-root').dataset.persistent,'1');
});

test('personal restore keeps exact file/password/mode, retries failure and refreshes only its current owner',async()=>{
  let finish,fail=true;const f=fixture((path,options)=>{
    if(path==='/api/data/inspect')return Promise.resolve(preview);
    if(path==='/api/data/import')return new Promise((resolve,reject)=>{finish=()=>fail?reject(new Error('恢复失败')):resolve({})});
    if(path==='/api/me')return Promise.resolve({user:{id:'owner',username:'owner'},stage:{name:'kept'},theme:{}});
    if(path==='/api/records')return Promise.resolve({records:[{id:'restored'}]});
    if(path==='/api/stats')return Promise.resolve({total:1});
    return Promise.resolve(path==='/api/backup/status'?status:targets);
  });
  await f.renderBackup();choose('#backup-file',file);await settle();$('#restore-password-form input').value='private-backup-password';submit('#restore-password-form');await settle();
  $('#restore-mode').value='replace';const button=$('#apply-restore');button.click();button.click();assert.equal(f.calls.filter(call=>call.path==='/api/data/import').length,1);
  assert.deepEqual(f.calls.find(call=>call.path==='/api/data/import').body,{encryptedBackup:'encrypted-backup-text',password:'private-backup-password',sourceUsername:'',mode:'replace',confirmation:'RESTORE'});
  finish();await settle();assert.equal($('#apply-restore'),button);assert.equal(button.disabled,false);assert.equal($('#restore-mode').value,'replace');assert.equal(f.state.saving,false);
  fail=false;button.click();finish();await settle();assert.deepEqual(f.state.records,[{id:'restored'}]);assert.equal($('#apply-restore'),null);assert.ok($('#backup-export'));assert.equal(f.state.saving,false);
});

test('late personal file reads and stale account exports do not open dialogs or download data',async()=>{
  let read,download;const f=fixture(path=>path==='/api/backup/export'?new Promise(resolve=>{download=resolve}):Promise.resolve(path==='/api/backup/status'?status:targets));
  await f.renderBackup();choose('#backup-file',{...file,text:()=>new Promise(resolve=>{read=resolve})});
  const next=f.renderBackup();read('late-file');await next;await settle();assert.equal($('#restore-password-form'),null);
  $('#backup-export').click();$('#backup-export').click();assert.equal(f.calls.filter(call=>call.path==='/api/backup/export').length,1);
  f.state.user={id:'other',username:'other'};download(new win.Blob(['encrypted']));await settle();assert.deepEqual(f.downloads,[]);
});

test('site backup inspection and restore cannot duplicate or finish into another account/dialog',async()=>{
  let inspect,restore;const f=fixture(path=>{
    if(path==='/api/admin/site-backup/inspect')return new Promise(resolve=>{inspect=resolve});
    if(path==='/api/admin/site-backup/restore')return new Promise(resolve=>{restore=resolve});
    return Promise.resolve(path==='/api/backup/status'?status:targets);
  });
  await f.renderBackup();choose('#site-backup-file',{...file,name:'site.shendu-site'});await settle();$('#site-inspect-form input').value='site-backup-password';submit('#site-inspect-form');submit('#site-inspect-form');
  assert.equal(f.calls.filter(call=>call.path==='/api/admin/site-backup/inspect').length,1);inspect({createdAt:'2026-11-06',users:1,records:1,settings:1,targets:0});await settle();
  $('#site-restore-current-password').value='current-login-password';$('#site-restore-confirmation').value='恢复全部资料';submit('#site-restore-form');submit('#site-restore-form');
  assert.equal(f.calls.filter(call=>call.path==='/api/admin/site-backup/restore').length,1);assert.equal(f.state.saving,true);f.closeModal();assert.ok($('#site-restore-form'));
  f.closeModal(true);f.openModal('<div class="modal-head"><h2>重新连接</h2></div><input id="new-owner-dialog">','',true);const replacement={id:'other',username:'other'};f.state.user=replacement;
  restore({});await settle();assert.equal(f.state.user,replacement);assert.ok($('#new-owner-dialog'));assert.equal(f.state.saving,false);
});

test('site export blocks duplicate submissions and a cancelled owner cannot download or close new UI',async()=>{
  let finish;const f=fixture(path=>path==='/api/admin/site-backup/export'?new Promise(resolve=>{finish=resolve}):Promise.resolve(path==='/api/backup/status'?status:targets));
  await f.renderBackup();$('#site-backup-export').click();$('#site-current-password').value='current-login-password';$('#site-export-password').value='site-backup-password';$('#site-export-password-confirm').value='site-backup-password';
  submit('#site-export-form');submit('#site-export-form');assert.equal(f.calls.filter(call=>call.path==='/api/admin/site-backup/export').length,1);
  f.closeModal(true);f.openModal('<div class="modal-head"><h2>新页面</h2></div><input id="replacement-dialog">');finish(new win.Blob(['encrypted']));await settle();
  assert.deepEqual(f.downloads,[]);assert.ok($('#replacement-dialog'));assert.equal(f.state.saving,false);
});

test('account refresh never commits responses after its caller or account became stale',async()=>{
  const pending=[];const f=fixture(()=>new Promise(resolve=>pending.push(resolve)));const original=f.state.user;
  const refresh=f.refreshData();const replacement={id:'other',username:'other'};f.state.user=replacement;
  pending[0]({user:original,stage:{name:'old'},theme:{}});pending[1]({records:[{id:'old'}]});pending[2]({total:7});assert.equal(await refresh,false);assert.equal(f.state.user,replacement);assert.equal(f.state.records,undefined);
  const guarded=f.refreshData(()=>false);pending[3]({user:replacement,stage:{},theme:{}});pending[4]({records:[]});pending[5]({total:0});assert.equal(await guarded,false);assert.equal(f.state.records,undefined);
});

test.afterEach(()=>{ui.dismissDialog($('#modal-root'));ui.disposeUi($('#app'));$('#app').replaceChildren()});
test.after(()=>dom.window.close());
