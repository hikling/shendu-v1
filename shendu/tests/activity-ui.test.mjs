import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

// Run the actual app owners against the production component bridge: native
// date values and delegated button events must survive React enhancement.
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
  const match=new RegExp(`(?:^|\\n)((?:async )?function ${name}\\()`).exec(source);assert.ok(match,name);
  const start=match.index+(source[match.index]==='\n'?1:0),next=/\n(?:async )?function /.exec(source.slice(start+1));
  return source.slice(start,next?start+1+next.index:source.length).split('\ndocument.addEventListener')[0];
}
const types=source.slice(source.indexOf('const TYPES ='),source.indexOf('const TYPE_ICONS ='));
const zone=source.match(/const BEIJING_TIME_ZONE=[^\n]+/)[0];
function event(id='first',overrides={}){
  return {id,action:'draft_saved',recordType:'daily',period:'2026-11-10',targetKind:'',createdAt:'2026-11-09T16:05:00.000Z',...overrides};
}
function fixture(impl=async()=>({date:'2026-11-10',entries:[],nextCursor:null})){
  ui.disposeUi($('#app'));$('#app').replaceChildren();
  const state={user:{id:'self',username:'self'},saving:false,dirty:false},calls=[],targets=[];
  let instant='2026-11-09T16:05:00.000Z';
  const request=(path,options)=>{calls.push({path,...options});return impl(path,options)};
  const shell=markup=>ui.renderMarkup($('#app'),`<main id="main-content">${markup}</main>`);
  const head=(_,{title,description,action=''})=>`<header><h1>${esc(title)}</h1><p>${esc(description)}</p>${action}</header>`;
  const names=['beijingDateParts','isoDate','shiftIsoDate','formatDate','beijingTime','activityEntryHtml','renderActivity','renderSettings','bindMotionPreferences'];
  const context={$,$$,state,request,shell,spacePageHead:head,renderMarkup:ui.renderMarkup,esc,clockNow:()=>new Date(instant),FormData:win.FormData,workspaceArt:()=>'',openSettingsTarget:target=>targets.push(target),applyTheme:()=>{},toast:()=>{}};
  const functions=new Function(...Object.keys(context),`${zone}\n${types}\n${names.map(owner).join('\n')}\nfunction today(){return beijingDateParts(clockNow()).iso}\nreturn {renderActivity,activityEntryHtml,renderSettings};`)(...Object.values(context));
  return {state,calls,targets,...functions,setNow:value=>{instant=value}};
}
function changeDate(value){const field=$('#activity-date');field.value=value;field.dispatchEvent(new win.Event('change',{bubbles:true}));}
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject};}

test('activity starts on Beijing today across the UTC day boundary and retains its native accessible date controls',async()=>{
  const f=fixture(async()=>({date:'2026-11-10',entries:[event()],nextCursor:null}));f.renderActivity();
  const input=$('#activity-date'),previous=$('#activity-prev');await settle();
  assert.deepEqual(f.calls,[{path:'/api/activity?date=2026-11-10'}]);assert.equal(input.type,'date');assert.equal(input.value,'2026-11-10');assert.equal(input.max,'2026-11-10');assert.equal($('label[for="activity-date"]').textContent,'查看日期（北京时间）');
  assert.equal($('#activity-next').disabled,true);assert.equal($('#activity-date'),input);assert.equal($('#activity-prev'),previous);
  assert.equal($('.activity-entry time').textContent,'00:05');assert.equal($('.activity-entry time').getAttribute('datetime'),'2026-11-09T16:05:00.000Z');
  assert.match($('#activity-summary').textContent,/2026年11月10日.*已显示 1 条记录/);assert.equal($('.activity-entry h3').textContent,'保存草稿');assert.match($('.activity-history-note').textContent,/启用前的操作/);
});

test('settings exposes the usage log alongside stage and guide, without restoring a duplicate account destination',()=>{
  const f=fixture();f.renderSettings();assert.deepEqual($$('[data-settings-target]').map(node=>node.dataset.settingsTarget),['stage','activity','guide']);
  $('[data-settings-target="activity"]').click();assert.deepEqual(f.targets,['activity']);assert.equal($('[data-settings-target="account"]'),null);assert.ok($('#motion-form'));
});

test('activity displays fixed Chinese action labels and only safe escaped metadata, never supplied body or title',async()=>{
  const hostile='<img src=x onerror=alert(1)>',entries=[
    event('saved',{period:hostile,title:'DO NOT SHOW PRIVATE TITLE',data:{body:'DO NOT SHOW BODY'},summary:'DO NOT SHOW SUMMARY'}),
    event('failed',{action:'backup_failed',recordType:'',targetKind:'s3'}),
    event('unknown',{action:'<svg onload=alert(1)>',recordType:'constructor',targetKind:hostile,period:hostile}),
    event('webdav',{action:'backup_target_updated',recordType:'',targetKind:'webdav'})
  ];const f=fixture(async()=>({date:'2026-11-10',entries,nextCursor:null}));f.renderActivity();await settle();
  assert.equal($('#activity-list script,#activity-list svg,#activity-list img,#activity-list [onerror]'),null);assert.match($('.activity-entry p').textContent,/<img src=x onerror=alert\(1\)>/);
  assert.deepEqual($$('.activity-entry h3').map(node=>node.textContent),['保存草稿','外部备份失败','使用记录','修改备份目标']);assert.equal($$('.activity-entry-failed').length,1);
  assert.match($('#activity-list').textContent,/S3 兼容存储/);assert.match($('#activity-list').textContent,/WebDAV 网络存储/);assert.doesNotMatch($('#activity-list').textContent,/DO NOT SHOW/);
  assert.equal($$('.activity-entry')[2].querySelector('p'),null,'unknown fields cannot introduce user-authored labels or detail text');
});

test('all declared activity actions use Chinese operation labels with no raw enum leakage',()=>{
  const f=fixture(),actions={login:'登录慎独',logout:'退出登录',draft_saved:'保存草稿',draft_deleted:'删除草稿',review_completed:'提交并锁定复盘',action_verified:'提交行动验证',stage_updated:'修改阶段与复盘内容',preferences_updated:'修改动态偏好',backup_success:'外部备份成功',backup_failed:'外部备份失败',backup_target_created:'新增备份目标',backup_target_updated:'修改备份目标',backup_target_deleted:'删除备份目标',data_exported:'导出个人备份',data_imported:'恢复个人资料',site_exported:'导出整站备份',site_imported:'恢复整站资料',password_updated:'修改登录密码',backup_password_updated:'修改备份密码'};
  ui.renderMarkup($('#app'),`<ol>${Object.keys(actions).map(action=>f.activityEntryHtml(event(action,{action,recordType:''}))).join('')}</ol>`);
  assert.deepEqual($$('h3').map(node=>node.textContent),Object.values(actions));
});

test('previous, next and today use civil dates, prevent future queries and keep the mounted date field',async()=>{
  const f=fixture(async path=>({date:new URL(path,'http://local').searchParams.get('date'),entries:[],nextCursor:null}));f.renderActivity();await settle();const input=$('#activity-date');
  $('#activity-prev').click();await settle();assert.equal(input.value,'2026-11-09');assert.equal($('#activity-next').disabled,false);
  $('#activity-next').click();await settle();assert.equal(input.value,'2026-11-10');assert.equal($('#activity-next').disabled,true);
  const before=f.calls.length;$('#activity-next').click();changeDate('2026-11-11');changeDate('');assert.equal(input.value,'2026-11-10');assert.equal(f.calls.length,before);
  changeDate('2026-01-01');await settle();$('#activity-prev').click();await settle();assert.equal(input.value,'2025-12-31');
  $('#activity-today').click();await settle();assert.equal(input.value,'2026-11-10');assert.equal($('#activity-date'),input);
  assert.deepEqual(f.calls.map(call=>call.path),['/api/activity?date=2026-11-10','/api/activity?date=2026-11-09','/api/activity?date=2026-11-10','/api/activity?date=2026-01-01','/api/activity?date=2025-12-31','/api/activity?date=2026-11-10']);
  f.setNow('2026-11-10T16:01:00.000Z');$('#activity-today').click();await settle();assert.equal(input.value,'2026-11-11');assert.equal(input.max,'2026-11-11');
});

test('load more uses the exact same-day encoded cursor once, deduplicates overlapping entries and marks the end',async()=>{
  const next=deferred(),cursor='record /?&=';let count=0;
  const f=fixture(async()=>++count===1?{date:'2026-11-10',entries:[event('newer')],nextCursor:cursor}:next.promise);f.renderActivity();await settle();
  const input=$('#activity-date'),more=$('#activity-more');assert.equal(more.hidden,false);more.click();more.click();
  assert.equal(f.calls.length,2);assert.equal(more.disabled,true);assert.equal(f.calls[1].path,`/api/activity?date=2026-11-10&cursor=${encodeURIComponent(cursor)}`);assert.match($('#activity-list').textContent,/保存草稿/);
  next.resolve({date:'2026-11-10',entries:[event('newer'),event('older',{action:'action_verified'})],nextCursor:null});await settle();
  assert.equal($$('.activity-entry').length,2);assert.deepEqual($$('.activity-entry h3').map(node=>node.textContent),['保存草稿','提交行动验证']);assert.match($('#activity-summary').textContent,/已显示 2 条记录/);assert.equal(more.hidden,true);assert.equal(more.disabled,false);assert.equal($('#activity-date'),input);
});

test('a failed next page keeps loaded rows and retries the same cursor, with error text escaped',async()=>{
  let count=0;const retry=deferred(),f=fixture(async()=>{count++;if(count===1)return {date:'2026-11-10',entries:[event('kept')],nextCursor:'page-two'};if(count===2)throw new Error('<img onerror=alert(1)> 读取失败');return retry.promise});f.renderActivity();await settle();
  $('#activity-more').click();await settle();assert.equal($$('.activity-entry').length,1);assert.match($('#activity-summary').textContent,/已显示 1 条记录/);assert.equal($('#activity-feedback img'),null);assert.match($('#activity-feedback').textContent,/<img onerror=alert\(1\)>/);assert.equal($('#activity-more').disabled,false);
  $('#activity-retry').click();$('#activity-more').click();assert.equal(f.calls.length,3);assert.equal(f.calls[2].path,'/api/activity?date=2026-11-10&cursor=page-two');
  retry.resolve({date:'2026-11-10',entries:[event('earlier',{action:'preferences_updated'})],nextCursor:null});await settle();assert.equal($$('.activity-entry').length,2);assert.equal($('#activity-retry'),null);assert.equal($('#activity-more').hidden,true);
});

test('an initial failure remains a read error until retry, then shows the truthful empty day state',async()=>{
  let count=0;const f=fixture(async()=>{if(++count===1)throw new Error('网络暂时不可用');return {date:'2026-11-10',entries:[],nextCursor:null}});f.renderActivity();await settle();
  assert.ok($('#activity-retry'));assert.equal($('.activity-empty'),null);assert.match($('#activity-summary').textContent,/暂时无法读取记录/);$('#activity-retry').click();await settle();
  assert.equal(f.calls.length,2);assert.ok($('.activity-empty'));assert.equal($('#activity-retry'),null);assert.match($('#activity-summary').textContent,/已显示 0 条记录/);assert.equal($('#activity-more').hidden,true);
});

test('changing the date discards its cursor and late success or failure cannot replace the newer day',async()=>{
  const reads=[];const f=fixture(()=>{const request=deferred();reads.push(request);return request.promise});f.renderActivity();
  changeDate('2026-11-09');changeDate('2026-11-08');assert.equal(reads.length,3);assert.deepEqual(f.calls.map(call=>call.path),['/api/activity?date=2026-11-10','/api/activity?date=2026-11-09','/api/activity?date=2026-11-08']);
  reads[1].resolve({date:'2026-11-09',entries:[event('wrong-day',{action:'backup_success'})],nextCursor:'wrong-cursor'});reads[0].reject(new Error('old read failed'));await settle();
  assert.equal($$('.activity-entry').length,0);assert.equal($('#activity-retry'),null);assert.match($('#activity-summary').textContent,/11月8日/);assert.equal($('#activity-more').hidden,true);
  reads[2].resolve({date:'2026-11-08',entries:[event('current',{action:'draft_deleted'})],nextCursor:null});await settle();assert.equal($('.activity-entry h3').textContent,'删除草稿');assert.equal($('#activity-more').disabled,false);assert.equal($('#activity-date').value,'2026-11-08');
});

test('switching days during a pending next page never reuses the previous cursor or lets its completion unlock the new read',async()=>{
  const oldPage=deferred(),newDay=deferred();let count=0;
  const f=fixture(()=>{if(++count===1)return Promise.resolve({date:'2026-11-10',entries:[event('kept')],nextCursor:'old-cursor'});return count===2?oldPage.promise:newDay.promise});f.renderActivity();await settle();$('#activity-more').click();changeDate('2026-11-09');
  assert.equal(f.calls[2].path,'/api/activity?date=2026-11-09');oldPage.resolve({date:'2026-11-10',entries:[event('too-late')],nextCursor:'late-cursor'});await settle();assert.equal($$('.activity-entry').length,0);assert.equal($('#activity-more').disabled,true);assert.equal($('#activity-more').hidden,true);
  newDay.resolve({date:'2026-11-09',entries:[],nextCursor:null});await settle();assert.equal($('#activity-more').disabled,false);assert.ok($('.activity-empty'));
});

test('each page visit and account owns its own result and failures cannot write into replacements',async()=>{
  const reads=[],f=fixture(()=>{const request=deferred();reads.push(request);return request.promise});f.renderActivity();const first=$('.workspace-activity');f.renderActivity();const second=$('.workspace-activity');assert.notEqual(first,second);
  reads[0].resolve({date:'2026-11-10',entries:[event('stale',{action:'backup_failed'})],nextCursor:'stale'});await settle();assert.equal($$('.activity-entry').length,0);assert.equal($('#activity-more').hidden,true);
  reads[1].resolve({date:'2026-11-10',entries:[event('current')],nextCursor:null});await settle();assert.equal($('.activity-entry h3').textContent,'保存草稿');
  f.renderActivity();f.state.user={id:'another'};ui.renderMarkup($('#app'),'<main id="other-account">另一个账户页面</main>');reads[2].reject(new Error('old-account failure'));await settle();assert.ok($('#other-account'));assert.equal($('#activity-retry'),null);
});

test('an account change invalidates success and failure even while the old page remains mounted',async()=>{
  for(const outcome of ['success','failure']){
    const read=deferred(),f=fixture(()=>read.promise);f.renderActivity();const page=$('.workspace-activity'),summary=$('#activity-summary').textContent;
    f.state.user={id:'other-owner'};
    if(outcome==='success')read.resolve({date:'2026-11-10',entries:[event('private-old-account')],nextCursor:'old-private-cursor'});else read.reject(new Error('private old error'));
    await settle();assert.equal(page.isConnected,true);assert.equal($('#activity-summary').textContent,summary);assert.equal($$('.activity-entry').length,0);assert.equal($('#activity-retry'),null);assert.equal($('#activity-more').hidden,true);
  }
});

test.afterEach(()=>{ui.disposeUi($('#app'));$('#app').replaceChildren()});
test.after(()=>dom.window.close());
