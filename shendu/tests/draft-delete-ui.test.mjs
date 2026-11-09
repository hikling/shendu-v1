import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {RECORD_ART,recordArtAssignments} from '../public/record-art.js';
import {overviewRecordTitle,overviewDateParts} from '../public/overview-reel.js';

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
const icons=source.match(/const TYPE_ICONS = [^\n]+/)[0];
const statuses=source.match(/const STATUS = [^\n]+/)[0];
function record(type='daily',status='draft',overrides={}){
  const periods={daily:'2026-11-09',weekly:'2026-W45',monthly:'2026-11',quarterly:'2026-11-01',yearly:'2026',decision:'2026-11-09'};
  return {id:`${type}-${status}`,type,status,period:periods[type],version:3,title:`${type} 私人草稿`,data:{answers:{note:['先写一段']},action:'下一步行动'},...overrides};
}
function fixture({records=[record()],requestImpl=async()=>({ok:true})}={}){
  ui.dismissDialog($('#modal-root'));ui.renderMarkup($('#app'),'');
  const state={user:{id:'owner',username:'owner'},records,historyFilter:{q:'',type:'all',year:'all',month:'all'},current:null,dirty:false,saving:false,route:'history'},calls=[],notices=[],reviews=[];
  const request=(path,options)=>{calls.push({path,...options});return requestImpl(path,options)};
  const shell=html=>ui.renderMarkup($('#app'),`<main>${html}</main>`);
  const names=['recordSummary','isoWeekAnchor','historyYear','historyMonth','historyCardHtml','renderHistory','renderActions','bindRecordOpen','deleteDraftRecord','dialogWriteTask','syncOverlayBackground','openModal','closeModal','attemptNavigate','spacePageHead'];
  const actionTemplate=()=>({pageTitle:'行动验证',pageIntro:'回看真实结果',historyButton:'查看历史',pendingTitle:'待验证',pendingIntro:'仍在等待的行动',verifiedTitle:'已验证',verifiedIntro:'已确认的结果',pendingEmptyTitle:'暂时没有待验证行动',pendingEmptyText:'完成复盘后再回来',verifiedEmptyTitle:'还没有验证结果',verifiedEmptyText:'验证后将显示在这里'});
  const functions=new Function('$','$$','state','request','renderMarkup','prepareDialogContainer','showDialog','dismissDialog','cancelDailyTypewriter','esc','shell','recordArtAssignments','RECORD_ART','overviewRecordTitle','overviewDateParts','formatDate','today','toast','enterReview','workspaceArt','currentActionTemplate',`let modalReturnFocus=null;\n${types}\n${icons}\n${statuses}\n${names.map(owner).join('\n')}\nreturn {renderHistory,renderActions,deleteDraftRecord,historyCardHtml,openModal,closeModal,attemptNavigate,spacePageHead};`)($,$$,state,request,ui.renderMarkup,ui.prepareDialogContainer,ui.showDialog,ui.dismissDialog,()=>{},esc,shell,recordArtAssignments,RECORD_ART,overviewRecordTitle,overviewDateParts,value=>value,()=> '2026-11-09',(...args)=>notices.push(args),(...args)=>reviews.push(args),()=>'<span class="workspace-art" aria-hidden="true"></span>',actionTemplate);
  return {state,calls,notices,reviews,...functions};
}

test('all six draft kinds have a separate accessible delete action while submitted records only open',()=>{
  const records=Object.keys(RECORD_ART).flatMap(type=>['draft','completed','verified'].map(status=>record(type,status))),f=fixture({records});f.renderHistory();
  assert.equal($$('.history-record-entry').length,18);assert.equal($$('[data-delete-record]').length,6);
  assert.equal($$('button button').length,0,'open and delete controls must not be nested');
  for(const item of records){
    const open=$(`[data-open-record="${item.id}"]`),entry=open.closest('.history-record-entry'),remove=$('[data-delete-record]',entry);
    assert.ok(open);assert.equal(open.type,'button');
    if(item.status==='draft'){assert.ok(remove);assert.equal(remove.dataset.deleteRecord,item.id);assert.match(remove.getAttribute('aria-label'),/删除.*草稿/);assert.equal(open.contains(remove),false)}
    else assert.equal(remove,null);
  }
  $('[data-open-record="daily-completed"]').click();assert.equal(f.reviews[0][3].id,'daily-completed');
  f.deleteDraftRecord(records.find(item=>item.status==='verified'));assert.equal($('#delete-draft-confirm'),null);
});

test('deletion confirmation escapes the draft title and cancelling leaves the archive untouched',async()=>{
  const draft=record('daily','draft',{title:'<img src=x onerror=alert(1)> & 私人标题'}),f=fixture({records:[draft]});f.renderHistory();
  $('[data-delete-record]').click();await settle();
  assert.ok($('#delete-draft-confirm'));assert.equal(f.reviews.length,0,'delete does not also open the record');
  assert.match($('.lock-summary').textContent,/<img src=x onerror=alert\(1\)> & 私人标题/);assert.equal($('#modal-root [onerror]'),null);
  const cancel=$$('[data-close]').find(button=>button.textContent==='保留草稿');assert.ok(cancel);cancel.click();await settle();
  assert.equal($('#delete-draft-confirm'),null);assert.equal(f.calls.length,0);assert.equal(f.state.records[0],draft);assert.ok($('[data-delete-record]'));
});

test('confirmed deletion sends one versioned request, protects pending UI and preserves active filters',async()=>{
  let finish;const draft=record(),keep=record('daily','draft',{id:'keep-draft',title:'daily 另一份草稿'}),other=record('weekly','draft'),f=fixture({records:[draft,keep,other],requestImpl:()=>new Promise(resolve=>{finish=resolve})});
  const filter={q:'daily',type:'daily',year:'2026',month:'11'};f.state.current=draft;f.renderHistory(filter);
  $(`[data-delete-record="${draft.id}"]`).click();await settle();const button=$('#delete-draft-confirm');button.click();button.click();
  assert.deepEqual(f.calls,[{path:`/api/records/${draft.id}`,method:'DELETE',body:{version:3}}]);assert.equal(f.state.saving,true);assert.equal(button.disabled,true);
  assert.equal($('#modal-root').dataset.persistent,'1');f.closeModal();assert.equal($('#delete-draft-confirm'),button);
  finish({ok:true});await settle();
  assert.deepEqual(f.state.records.map(item=>item.id),['keep-draft','weekly-draft']);assert.equal(f.state.current,null);assert.equal(f.state.saving,false);assert.equal(f.state.dirty,false);
  assert.deepEqual(f.state.historyFilter,filter);assert.equal($('#history-search').value,'daily');assert.equal($('#history-type').value,'daily');assert.equal($('#history-year').value,'2026');assert.equal($('#history-month').value,'11');
  assert.deepEqual($$('[data-open-record]').map(node=>node.dataset.openRecord),['keep-draft']);assert.equal($('#delete-draft-confirm'),null);assert.equal(document.activeElement,$('[data-open-record]'));assert.match(f.notices.at(-1)[0],/草稿已删除/);
});

test('failed deletion retains the draft and confirmation for retry without clearing another current record',async()=>{
  let attempt=0;const draft=record(),current=record('weekly','draft'),f=fixture({records:[draft,current],requestImpl:async()=>{if(++attempt===1)throw new Error('记录已在其他设备更新，请刷新');return {ok:true}}});
  f.state.current=current;f.renderHistory();$(`[data-delete-record="${draft.id}"]`).click();await settle();const button=$('#delete-draft-confirm');button.click();await settle();
  assert.equal(f.state.records[0],draft);assert.equal(f.state.current,current);assert.equal($('#delete-draft-confirm'),button);assert.equal(button.disabled,false);assert.equal(f.state.saving,false);assert.equal($('#modal-root').dataset.persistent,'0');assert.match(f.notices.at(-1)[0],/其他设备更新/);
  button.click();await settle();assert.equal(f.calls.length,2);assert.deepEqual(f.calls[1].body,{version:3});assert.equal(f.state.current,current);assert.deepEqual(f.state.records.map(item=>item.id),[current.id]);
});

test('removing the final visible draft shows the empty state and returns focus to its heading',async()=>{
  const f=fixture();f.renderHistory();$('[data-delete-record]').click();await settle();$('#delete-draft-confirm').click();await settle();
  assert.equal(f.state.records.length,0);assert.ok($('.history-empty'));assert.equal($('[data-open-record]'),null);assert.equal(document.activeElement,$('#history-title'));assert.equal($('#history-title').tabIndex,-1);
});

test('unsaved edits must be retained or explicitly discarded before a deletion can be confirmed',async()=>{
  const draft=record(),f=fixture({records:[draft]});f.state.current=draft;draft.data.action='这段还没有保存';f.state.dirty=true;f.renderHistory();
  $('[data-delete-record]').click();await settle();assert.ok($('#discard-change'));assert.equal($('#delete-draft-confirm'),null);assert.equal(f.calls.length,0);
  $('[data-close]').click();await settle();assert.equal(f.state.dirty,true);assert.equal(draft.data.action,'这段还没有保存');assert.equal($('#delete-draft-confirm'),null);
  $('[data-delete-record]').click();await settle();$('#discard-change').click();await settle();assert.equal(f.state.dirty,false);assert.ok($('#delete-draft-confirm'));assert.equal(f.calls.length,0);
  $('#delete-draft-confirm').click();await settle();assert.equal(f.state.records.length,0);
});

test('a forced replacement or account switch cannot let a late delete alter the new owner',async()=>{
  for(const mode of ['dialog','account']){
    let finish;const draft=record(),originalRecords=[draft],f=fixture({records:originalRecords,requestImpl:()=>new Promise(resolve=>{finish=resolve})});f.state.current=draft;f.renderHistory();$('[data-delete-record]').click();await settle();$('#delete-draft-confirm').click();
    const replacementUser={id:'other',username:'other'},replacementRecords=[record('weekly','draft',{id:'other-record'})];
    if(mode==='account'){f.state.user=replacementUser;f.state.records=replacementRecords}
    f.closeModal(true);f.openModal('<div class="modal-head"><h2>另一个确认</h2></div><button id="replacement-confirm">继续</button>','',true);
    const newerOwner={};f.state.dialogWriteOwner=newerOwner;f.state.saving=true;
    finish({ok:true});await settle();
    assert.ok($('#replacement-confirm'));assert.equal($('#modal-root').dataset.persistent,'1');assert.equal(f.state.dialogWriteOwner,newerOwner);assert.equal(f.state.saving,true);assert.equal(f.state.current,draft);assert.deepEqual(f.notices,[]);
    assert.equal(f.state.records,mode==='account'?replacementRecords:originalRecords);assert.equal(f.state.records[0].id,mode==='account'?'other-record':draft.id);
    f.closeModal(true);
  }
});

test('a changed account while the unsaved prompt is open never opens a destructive confirmation',async()=>{
  const f=fixture();f.state.dirty=true;f.renderHistory();$('[data-delete-record]').click();await settle();assert.ok($('#discard-change'));
  f.state.user={id:'other'};$('#discard-change').click();await settle();assert.equal($('#delete-draft-confirm'),null);assert.equal(f.calls.length,0);assert.equal(f.state.records.length,1);
});

test('history and ordinary workspace page headings start with the title, retaining meaningful descriptions',()=>{
  const f=fixture();f.renderHistory();assert.equal($('.history-hero-copy').firstElementChild,$('#history-title'));assert.equal($('.history-kicker'),null);assert.match($('.history-hero-note').textContent,/把写下的事实/);
  f.state.records=[];f.renderActions();assert.equal($('.history-hero-copy').firstElementChild,$('#actions-title'));assert.equal($('.history-kicker,.actions-section-kicker'),null);assert.equal($('.history-hero-note').textContent,'回看真实结果');assert.equal($('#actions-pending-title').parentElement.firstElementChild,$('#actions-pending-title'));assert.equal($('#actions-verified-title').parentElement.firstElementChild,$('#actions-verified-title'));
  for(const route of ['backup','users','settings','calendar','stage','guide']){
    ui.renderMarkup($('#app'),f.spacePageHead(route,{title:'实际标题',description:'有意义的功能说明'}));
    const heading=$(`#workspace-${route}-title`);assert.equal(heading.parentElement.firstElementChild,heading);assert.equal($('.workspace-kicker'),null);assert.equal($('.workspace-description').textContent,'有意义的功能说明');
  }
});

test.afterEach(()=>{ui.dismissDialog($('#modal-root'));ui.disposeUi($('#app'));$('#app').replaceChildren()});
test.after(()=>dom.window.close());
