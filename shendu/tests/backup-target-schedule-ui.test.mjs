import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {backupScheduleLabel} from '../public/backup-schedule.js';

const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const dom=new JSDOM('<!doctype html><html><body><div id="app"></div><div id="rail-root"></div><div id="modal-root"></div><div id="toast-root"></div></body></html>',{url:'http://localhost/',pretendToBeVisual:true}),win=dom.window;
for(const name of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement','HTMLSelectElement','HTMLButtonElement','HTMLFormElement','Element','Node','NodeFilter','Event','CustomEvent','KeyboardEvent','MouseEvent','MutationObserver','getComputedStyle','FormData'])globalThis[name]=win[name];
Object.defineProperty(globalThis,'navigator',{value:win.navigator,configurable:true});
globalThis.requestAnimationFrame=win.requestAnimationFrame.bind(win);globalThis.cancelAnimationFrame=win.cancelAnimationFrame.bind(win);
globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
const ui=await import('../public/ui/shadcn.js');
const $=(selector,root=document)=>root.querySelector(selector),$$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const settle=()=>new Promise(resolve=>setTimeout(resolve,25));
function owner(name){
  const match=new RegExp('(?:^|\\n)((?:async )?function '+name+'\\()').exec(source);assert.ok(match,name);
  const start=match.index+(source[match.index]==='\n'?1:0),next=/\n(?:async )?function /.exec(source.slice(start+1));
  return source.slice(start,next?start+1+next.index:source.length);
}
function fixture(impl=async()=>({ok:true})){
  ui.dismissDialog($('#modal-root'));ui.renderMarkup($('#app'),'<main><div id="backup-content"><button id="trigger">新增目标</button></div></main>');
  const state={user:{id:'owner',username:'owner'},saving:false},calls=[],notices=[],renders=[];
  const request=(path,options)=>{calls.push({path,...options});return impl(path,options)};
  const context={$,$$,state,request,renderMarkup:ui.renderMarkup,prepareDialogContainer:ui.prepareDialogContainer,showDialog:ui.showDialog,dismissDialog:ui.dismissDialog,cancelDailyTypewriter:()=>{},esc,toast:(...args)=>notices.push(args),renderBackup:()=>renders.push('backup'),beijingDateTime:value=>value||'',backupScheduleLabel};
  const names=['syncOverlayBackground','openModal','closeModal','dialogWriteTask','backupTargetKindLabel','backupRunRows','backupScheduleFields','bindBackupSchedule','openTargetModal'];
  const functions=new Function(...Object.keys(context),'let modalReturnFocus=null;\n'+names.map(owner).join('\n')+'\nreturn {openTargetModal,closeModal,openModal,backupRunRows};')(...Object.values(context));
  return{state,calls,notices,renders,...functions};
}
function select(name,value){
  const field=$('[name="'+name+'"]');assert.ok(field,name);field.value=String(value);
  field.dispatchEvent(new win.Event('input',{bubbles:true}));field.dispatchEvent(new win.Event('change',{bubbles:true}));return field;
}
function fill(name,value){const field=$('[name="'+name+'"]');assert.ok(field,name);field.value=value;field.dispatchEvent(new win.Event('input',{bubbles:true}));return field}
function fillS3(){
  fill('name','自己的云备份');select('kind','s3');fill('endpoint','https://objects.example.com');fill('bucket','private-backup');fill('accessKey','access-for-local-test');fill('secretKey','secret-for-local-test');fill('directory','shendu/archive');
}
function submit(){const form=$('#target-form');form.dispatchEvent(new win.Event('submit',{bubbles:true,cancelable:true}));}

test('S3 labels are Chinese and daily/weekly switches retain the same time and weekday controls',async()=>{
  const f=fixture();f.openTargetModal();await settle();fillS3();
  const form=$('#target-form'),text=form.textContent;
  for(const label of ['服务地址','区域','存储桶','访问密钥','秘密密钥','使用路径式访问地址'])assert.ok(text.includes(label),label);
  assert.doesNotMatch(text,/\b(?:Endpoint|Region|Bucket|Access Key|Secret Key|Path-style)\b/);
  assert.ok(text.includes('北京时间'));
  const time=$('[name="scheduleTime"]'),weekday=$('[name="scheduleWeekday"]');
  assert.equal(time.disabled,true);assert.equal(weekday.disabled,true);assert.equal($('#target-schedule-fields').hidden,true);
  select('schedule','weekly');select('scheduleWeekday',7);fill('scheduleTime','23:45');await settle();
  assert.equal(time.disabled,false);assert.equal(weekday.disabled,false);assert.equal($('[data-backup-weekday]').hidden,false);
  assert.equal($('[data-ui-choice-for="target-schedule"] [role="radio"][data-state="checked"]')?.textContent,'每周定时');
  select('schedule','manual');await settle();assert.equal(time.disabled,true);assert.equal(weekday.disabled,true);
  const manualValues=new win.FormData(form);assert.equal(manualValues.has('scheduleTime'),false);assert.equal(manualValues.has('scheduleWeekday'),false);
  select('schedule','daily');await settle();assert.equal($('[name="scheduleTime"]'),time);assert.equal(time.value,'23:45');assert.equal(weekday.disabled,true);
  select('schedule','weekly');await settle();assert.equal($('[name="scheduleWeekday"]'),weekday);assert.equal(weekday.value,'7');assert.equal(time.value,'23:45');
  assert.equal($('[name="secretKey"]').value,'secret-for-local-test');
  fill('scheduleTime','');assert.equal(form.checkValidity(),false,'a timed schedule cannot save without a time');
  select('schedule','manual');assert.equal(form.checkValidity(),true,'hidden time is disabled for manual backups');
  submit();await settle();assert.equal(f.calls.length,1);assert.equal(f.calls[0].body.schedule,'manual');assert.equal(f.calls[0].body.scheduleTime,'02:00','cleared hidden time cannot prevent manual target saving');
});

test('editing refills safe connection settings and schedule while never refilling secret credentials',async()=>{
  const f=fixture(),existing={id:'target-one',name:'家里的备份',kind:'s3',schedule:'weekly',scheduleTime:'04:35',scheduleWeekday:6,config:{endpoint:'https://safe.example.com',region:'auto',bucket:'old-bucket',directory:'old/place',pathStyle:true,accessKey:'must-not-render',secretKey:'must-not-render'}};
  f.openTargetModal(existing);await settle();
  assert.equal($('[name="name"]').value,existing.name);assert.equal($('[name="endpoint"]').value,existing.config.endpoint);
  assert.equal($('[name="bucket"]').value,'old-bucket');assert.equal($('[name="directory"]').value,'old/place');assert.equal($('[name="pathStyle"]').checked,true);
  assert.equal($('[name="scheduleTime"]').value,'04:35');assert.equal($('[name="scheduleWeekday"]').value,'6');
  assert.equal($('[name="region"]').value,'');assert.match($('#target-form').textContent,/支持自动区域模式时可留空/);
  assert.equal($('[name="accessKey"]').value,'');assert.equal($('[name="secretKey"]').value,'');
  assert.equal($('#target-form').checkValidity(),false,'credentials must be re-entered');
  fill('accessKey','fresh-access');fill('secretKey','fresh-secret');submit();await settle();
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].path,'/api/backup/targets/target-one');assert.equal(f.calls[0].method,'PATCH');
  assert.deepEqual(f.calls[0].body,{name:existing.name,kind:'s3',schedule:'weekly',scheduleTime:'04:35',scheduleWeekday:6,config:{endpoint:'https://safe.example.com',region:'',bucket:'old-bucket',accessKey:'fresh-access',secretKey:'fresh-secret',directory:'old/place',pathStyle:true}});
  assert.deepEqual(f.renders,['backup']);
});

test('editing WebDAV preserves its address and directory but requires both credentials again',async()=>{
  const f=fixture(),existing={id:'dav-target',name:'网络备份',kind:'webdav',schedule:'daily',scheduleTime:'08:20',scheduleWeekday:1,config:{url:'https://dav.example.com/old',directory:'old/archive',username:'must-not-return',password:'must-not-return'}};
  f.openTargetModal(existing);await settle();
  assert.equal($('[name="url"]').value,existing.config.url);assert.equal($('[name="directory"]').value,'old/archive');
  assert.equal($('[name="username"]').value,'');assert.equal($('[name="password"]').value,'');
  assert.equal($('[name="scheduleTime"]').value,'08:20');assert.equal($('#target-form').checkValidity(),false);
  fill('username','fresh-user');fill('password','fresh-pass');submit();await settle();
  assert.equal(f.calls[0].method,'PATCH');assert.deepEqual(f.calls[0].body.config,{url:'https://dav.example.com/old',username:'fresh-user',password:'fresh-pass',directory:'old/archive'});
});

test('schedule metadata stays outside credentials; failed saves retain exact values and single-flight protection',async()=>{
  let finish;
  const f=fixture(()=>new Promise((resolve,reject)=>{finish={resolve,reject}}));f.openTargetModal();await settle();fillS3();select('schedule','weekly');select('scheduleWeekday',5);fill('scheduleTime','20:15');
  const form=$('#target-form');submit();submit();assert.equal(f.calls.length,1);assert.equal(f.state.saving,true);
  const body=f.calls[0].body;assert.equal(body.scheduleTime,'20:15');assert.equal(body.scheduleWeekday,5);assert.equal(Object.hasOwn(body.config,'scheduleTime'),false);assert.equal(Object.hasOwn(body.config,'scheduleWeekday'),false);assert.equal(Object.hasOwn(body.config,'schedule'),false);
  f.closeModal();assert.equal($('#target-form'),form,'a pending save owns the dialog');assert.ok($$('input,select,button',form).every(field=>field.disabled));
  finish.reject(new Error('暂时无法连接'));await settle();assert.equal(f.state.saving,false);assert.equal($('#target-form'),form);
  assert.equal($('[name="scheduleTime"]').value,'20:15');assert.equal($('[name="scheduleWeekday"]').value,'5');assert.equal($('[name="secretKey"]').value,'secret-for-local-test');assert.equal(f.notices.at(-1)[0],'暂时无法连接');
  submit();assert.equal(f.calls.length,2);finish.resolve({ok:true});await settle();assert.equal($('#target-form'),null);assert.deepEqual(f.renders,['backup']);
});

test('changing storage type preserves this dialog draft but never leaks it into the submitted other type',async()=>{
  const f=fixture();f.openTargetModal();await settle();fillS3();fill('region','custom-region');select('schedule','daily');fill('scheduleTime','05:10');
  select('kind','webdav');fill('url','https://dav.example.com/user');fill('username','dav-user');fill('password','dav-pass');fill('directory','dav-place');
  select('kind','s3');assert.equal($('[name="endpoint"]').value,'https://objects.example.com');assert.equal($('[name="secretKey"]').value,'secret-for-local-test');assert.equal($('[name="region"]').value,'custom-region');
  select('kind','webdav');assert.equal($('[name="password"]').value,'dav-pass');assert.equal($('[name="scheduleTime"]').value,'05:10');
  submit();await settle();assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0].body.config,{url:'https://dav.example.com/user',username:'dav-user',password:'dav-pass',directory:'dav-place'});assert.equal(f.calls[0].body.scheduleTime,'05:10');
});

test('late target saves cannot close a replacement dialog or apply feedback to another account',async()=>{
  let finish;const f=fixture(()=>new Promise(resolve=>{finish=resolve}));f.openTargetModal();await settle();fillS3();submit();
  f.closeModal(true);f.state.user={id:'replacement'};f.openModal('<div class="modal-head"><h2>其他操作</h2></div><form id="replacement-form"><input name="newValue"><button>保存</button></form>');
  const replacement=$('#replacement-form');f.state.dialogWriteOwner=replacement;f.state.saving=true;
  finish({ok:true});await settle();assert.equal($('#replacement-form'),replacement);assert.equal(f.state.dialogWriteOwner,replacement);assert.equal(f.state.saving,true);assert.deepEqual(f.renders,[]);assert.equal(f.notices.length,0);
});

test('run table distinguishes named S3/WebDAV targets and manual/scheduled results, omitting connection tests',()=>{
  const f=fixture(),runs=[
    {operation:'backup',created_at:'2026-11-09T03:00:00Z',target_name:'云备份 <不作为HTML>',target_kind:'s3',trigger:'manual',status:'success',message:'备份成功'},
    {operation:'backup',created_at:'2026-11-08T19:00:00Z',target_name:'家里网络存储',target_kind:'webdav',trigger:'scheduled',status:'error',message:'云端响应失败 <script>literal</script>'},
    {operation:'test',created_at:'2026-11-09T02:00:00Z',target_name:'不应显示的测试',target_kind:'s3',trigger:'manual',status:'error',message:'测试失败'},
    {created_at:'2026-11-09T01:00:00Z',status:'success',message:'连接测试成功'},
    {operation:'backup',created_at:'2026-11-09T01:00:00Z',status:'pending',message:'不应当作结果'}
  ];
  ui.renderMarkup($('#app'),'<table><tbody>'+f.backupRunRows(runs)+'</tbody></table>');
  const rows=$$('tbody tr');assert.equal(rows.length,2);assert.equal(rows[0].querySelector('[data-label="备份目标"] strong').textContent,'云备份 <不作为HTML>');
  assert.ok(rows[0].textContent.includes('S3 兼容存储'));assert.ok(rows[0].textContent.includes('手动备份'));assert.ok(rows[0].textContent.includes('备份成功'));
  assert.ok(rows[1].textContent.includes('WebDAV 网络存储'));assert.ok(rows[1].textContent.includes('定时备份'));assert.ok(rows[1].textContent.includes('备份失败'));
  assert.equal($('#app script'),null);assert.ok(rows[1].textContent.includes('<script>literal</script>'));assert.doesNotMatch($('#app').textContent,/不应显示的测试|连接测试成功|不应当作结果/);
  ui.renderMarkup($('#app'),'<table><tbody>'+f.backupRunRows([])+'</tbody></table>');assert.equal($('tbody td').colSpan,5);assert.match($('tbody').textContent,/最近十天/);
});

test.afterEach(()=>{ui.dismissDialog($('#modal-root'));ui.disposeUi($('#app'));$('#app').replaceChildren()});
test.after(()=>dom.window.close());
