import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {attachReviewWheel} from '../public/review-wheel.js';
import {RECORD_ART,recordArtAssignments} from '../public/record-art.js';
import {overviewRecordTitle,overviewDateParts} from '../public/overview-reel.js';
import {DAILY_STEPS,dailyPrompts,dailyPromptOwner} from '../public/daily-flow.js';
import {EXTENDED_FLOW,extendedPrompts} from '../public/extended-flow.js';
import {reviewQuestions} from '../public/review-schema.js';
import {reviewIntroLayout,reviewIntroLines} from '../public/review-intros.js';

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
const constants=source.slice(source.indexOf('const TYPES ='),source.indexOf('const TYPE_ICONS ='))+'\n'+source.match(/const TYPE_ICONS = [^\n]+/)[0]+'\n'+source.match(/const STATUS = [^\n]+/)[0]+'\n'+source.slice(source.indexOf('const QUESTIONS ='),source.indexOf('function mergeReviewTemplate('));
const renderers=['dailyAnswerPreview','answerItemRow','answerAddButton','dailyAnswerInputs','gaugePresentation','gaugeCard','dailyEvidence','dailyReflection','dailyActionFields','dailyJournal','reviewAfterword','dailySceneArt','dailyReviewHtml','extendedSceneArt','extendedPromptCopy','extendedPromptHtml','extendedReviewHtml','verificationRead','currentDailyPrompts','dailyPromptCopy','setReviewPromptHeading','setDailyPromptHeading','showDailyPrompt','currentExtendedPrompts','setExtendedPromptHeading','showExtendedPrompt','bindReview','bindReviewWheel','clearDailyIssues','openDailyAnswer'];
function record(type='daily',status='draft',overrides={}){
  const periods={daily:'2026-11-09',weekly:'2026-W46',monthly:'2026-11',quarterly:'2026-11-01',yearly:'2026',decision:'2026-11-09'};
  return {id:`${type}-${status}`,type,status,period:periods[type],version:3,title:`${type} 私人草稿`,data:{answers:{},metrics:[],action:'下一步行动',journal:'未保存的日记',verifyDate:'2027-03-01'},...overrides};
}
function fixture({draft=record(),records=[draft],requestImpl=async()=>({ok:true}),review={}}={}){
  ui.dismissDialog($('#modal-root'));ui.renderMarkup($('#app'),'');
  const state={user:{id:'owner',username:'owner',displayName:'测试'},stage:{sleepTarget:7,energyTarget:70},records,current:draft,historyFilter:{q:'',type:'all',year:'all',month:'all'},dirty:false,saving:false,route:draft.type},calls=[],notices=[],reviews=[],navigations=[];
  const request=(path,options)=>{calls.push({path,...options});return requestImpl(path,options)};
  const shell=html=>ui.renderMarkup($('#app'),`<main class="main" id="main-content">${html}</main>`);
  const names=[...renderers,'recordSummary','isoWeekAnchor','historyYear','historyMonth','historyCardHtml','historyArchiveArt','renderHistory','renderActions','bindRecordOpen','deleteDraftRecord','dialogWriteTask','syncOverlayBackground','openModal','closeModal','spacePageHead'];
  let templates,functions;
  const context={$,$$,attachReviewWheel,state,request,renderMarkup:ui.renderMarkup,prepareDialogContainer:ui.prepareDialogContainer,showDialog:ui.showDialog,dismissDialog:ui.dismissDialog,cancelDailyTypewriter:()=>{},startDailyTypewriter:()=>{},setDailyImmersive:()=>{},esc,shell,recordArtAssignments,RECORD_ART,overviewRecordTitle,overviewDateParts,formatDate:value=>value,today:()=> '2026-11-09',toast:(...args)=>notices.push(args),enterReview:(...args)=>reviews.push(args),workspaceArt:()=>'',currentActionTemplate:()=>templates.action,DAILY_STEPS,dailyPrompts,dailyPromptOwner,EXTENDED_FLOW,extendedPrompts,reviewQuestions,reviewIntroLayout,dailyIntroLines:reviewIntroLines,defaultPeriod:type=>record(type).period,quoteFor:()=> '回看事实，慢慢向前。',beijingTime:()=> '12:00',verificationMinimum:()=> '2026-11-09',dailyCalendarDateLabel:value=>value,templatesForRecord:()=>templates,verificationTimes:()=>'',verificationActualAt:record=>record.verified_at||'',actionCard:record=>`<article data-action-record="${esc(record.id)}"></article>`,dailyVerificationCalendar:(value,locked)=>`<input type="hidden" data-simple="verifyDate" value="${esc(value)}" ${locked?'disabled':''}><div id="daily-verification-calendar" data-verify-month-value="2026-11"></div>`,renderDailyCalendar:()=>{},bindDailyFlow:()=>functions.showDailyPrompt(null),bindExtendedFlow:()=>functions.showExtendedPrompt(null),saveCurrent:async()=>{},completeCurrent:()=>{},collectCurrent:()=>{},renderReviewFromCurrent:()=>{},focusDailyAnswer:()=>{},updateGauge:()=>{},navigate:route=>{navigations.push(route);state.route=route;functions.renderHistory()}};
  functions=new Function(...Object.keys(context),`let modalReturnFocus=null;\n${constants}\n${names.map(owner).join('\n')}\nreturn {renderHistory,renderActions,deleteDraftRecord,historyCardHtml,openModal,closeModal,spacePageHead,dailyReviewHtml,extendedReviewHtml,showDailyPrompt,showExtendedPrompt,bindReview,review:DEFAULT_REVIEW_TEMPLATES,action:DEFAULT_ACTION_TEMPLATE};`)(...Object.values(context));
  templates={review:{...functions.review[draft.type],...review},action:functions.action};
  const go=id=>draft.type==='daily'?functions.showDailyPrompt(id):functions.showExtendedPrompt(id);
  const openReview=()=>{const locked=state.current.status!=='draft'||state.current.period!==record(state.current.type).period;const content=draft.type==='daily'?functions.dailyReviewHtml(state.current.period,locked,state.current.data,templates):functions.extendedReviewHtml(draft.type,state.current.period,locked,state.current.data,templates);shell(content);functions.bindReview()};
  const last=()=>draft.type==='daily'?dailyPrompts(0,templates.review).at(-1).id:'verifyDate';
  return {state,calls,notices,reviews,navigations,templates,...functions,openReview,go,last};
}

test('history lists only openable records, never a draft delete action',()=>{
  const records=Object.keys(RECORD_ART).flatMap(type=>['draft','completed','verified'].map(status=>record(type,status))),f=fixture({records});f.renderHistory();
  assert.equal($$('[data-open-record]').length,18);assert.equal($$('[data-delete-record],#delete-draft,.history-delete-draft').length,0);assert.equal($$('button button').length,0);
  $('[data-open-record="weekly-draft"]').click();assert.equal(f.reviews[0][3].id,'weekly-draft');
});

test('all six saved drafts show delete only on their actual final prompt, including historical read-only drafts',()=>{
  for(const type of Object.keys(RECORD_ART))for(const historical of [false,true]){
    const draft=record(type,'draft',historical?{period:type==='yearly'?'2025':type==='monthly'?'2025-11':type==='weekly'?'2025-W46':'2025-11-01'}:{}),f=fixture({draft});f.openReview();
    const button=$('#delete-draft');assert.ok(button);assert.equal(button.hidden,true);assert.equal($('#daily-editor').hidden,true);
    f.go('action');assert.equal(button.hidden,true);f.go(f.last());assert.equal(button.hidden,false);assert.ok(button.closest('.daily-flow-footer'));
    if(historical){assert.equal($('#daily-editor').dataset.dailyLocked,'true');assert.equal($('#save-draft'),null);assert.equal($('[data-simple="action"]').readOnly,true);assert.equal(button.disabled,false)}
    f.go('action');assert.equal(button.hidden,true);f.go(f.last());button.click();assert.ok($('#delete-draft-confirm'));f.closeModal(true);
  }
});

test('daily custom templates move the deletion entry to verifyDate when the diary is removed',()=>{
  for(const review of [{disabledFields:['journal']},{questions:[],disabledFields:['sleep','energy','risk','journal']}]){
    const f=fixture({review});f.openReview();f.go('ifCondition');assert.equal($('#delete-draft').hidden,true);f.go('verifyDate');assert.equal($('#delete-draft').hidden,false);assert.equal($('[data-daily-next]').hidden,true);
  }
});

test('submitted and verified records have no deletion entry for all six types',()=>{
  for(const type of Object.keys(RECORD_ART))for(const status of ['completed','verified']){
    const f=fixture({draft:record(type,status)});f.openReview();f.go(f.last());assert.equal($('#delete-draft'),null);f.deleteDraftRecord(f.state.current);assert.equal($('#delete-draft-confirm'),null);
  }
});

test('cancel preserves typed fields and dirty state, with one escaped destructive confirmation',async()=>{
  const draft=record('weekly','draft',{title:'<img src=x onerror=alert(1)> & 私人标题'}),f=fixture({draft});f.openReview();f.go(f.last());f.state.dirty=true;
  const input=$('[data-simple="action"]');input.value='刚刚输入但没有保存的内容';$('#delete-draft').focus();$('#delete-draft').click();await settle();
  assert.match($('.lock-summary').textContent,/<img src=x onerror=alert\(1\)> & 私人标题/);assert.equal($('#modal-root [onerror]'),null);assert.equal(f.state.dirty,true);
  assert.match($('#modal-root').textContent,/尚未保存的修改/);assert.equal($('#discard-change'),null);
  $$('[data-close]').find(button=>button.textContent==='保留草稿').click();await settle();
  assert.equal(f.state.current,draft);assert.equal(input.value,'刚刚输入但没有保存的内容');assert.equal(f.state.dirty,true);assert.equal(f.calls.length,0);assert.equal(document.activeElement,$('#delete-draft'));
});

test('successful saved deletion sends one exact version, blocks dismissal, clears current and navigates to history',async()=>{
  let finish;const draft=record(),keep=record('weekly'),f=fixture({draft,records:[draft,keep],requestImpl:()=>new Promise(resolve=>{finish=resolve})});f.openReview();f.go(f.last());f.state.dirty=true;f.state.historyFilter={q:'weekly',type:'weekly',year:'all',month:'all'};
  $('#delete-draft').click();await settle();const button=$('#delete-draft-confirm');button.click();button.click();
  assert.deepEqual(f.calls,[{path:`/api/records/${draft.id}`,method:'DELETE',body:{version:3}}]);assert.equal(button.disabled,true);assert.equal(f.state.saving,true);assert.equal(f.state.dirty,true);f.closeModal();assert.equal($('#delete-draft-confirm'),button);
  finish({ok:true});await settle();assert.deepEqual(f.navigations,['history']);assert.equal(f.state.route,'history');assert.equal(f.state.current,null);assert.equal(f.state.dirty,false);assert.equal(f.state.saving,false);assert.deepEqual(f.state.records,[keep]);assert.equal($('#history-search').value,'weekly');assert.equal(document.activeElement,$('[data-open-record]'));
});

test('failed deletion retains unsaved values and allows retry without changing the submitted version',async()=>{
  let attempt=0;const f=fixture({requestImpl:async()=>{if(++attempt===1)throw new Error('其他设备已更新，请刷新');return {ok:true}}});f.openReview();f.go(f.last());f.state.dirty=true;const draft=f.state.current,input=$('[data-simple="journal"]');input.value='失败后还要保留';
  $('#delete-draft').click();await settle();const button=$('#delete-draft-confirm');button.click();await settle();
  assert.equal(f.state.current,draft);assert.equal(f.state.records.length,1);assert.equal(f.state.dirty,true);assert.equal(input.value,'失败后还要保留');assert.equal(button.disabled,false);assert.equal(f.state.saving,false);assert.equal(f.navigations.length,0);
  button.click();await settle();assert.equal(f.calls.length,2);assert.deepEqual(f.calls[1].body,{version:3});assert.equal(f.state.current,null);
});

test('a never-saved draft is discarded locally after confirmation without creating or deleting server data',async()=>{
  const draft=record('daily','draft',{id:null,version:0}),f=fixture({draft,records:[]});f.openReview();f.go(f.last());f.state.dirty=true;$('#delete-draft').click();await settle();$('#delete-draft-confirm').click();await settle();
  assert.equal(f.calls.length,0);assert.equal(f.state.current,null);assert.equal(f.state.dirty,false);assert.deepEqual(f.navigations,['history']);assert.ok($('.history-empty'));assert.equal(document.activeElement,$('#history-title'));
});

test('first save updates the existing end-page action to use its new ID and version',async()=>{
  const draft=record('daily','draft',{id:null,version:0}),f=fixture({draft,records:[]});f.openReview();f.go(f.last());const saved={...draft,id:'first-save',version:1};f.state.current=saved;f.state.records=[saved];
  $('#delete-draft').click();await settle();$('#delete-draft-confirm').click();await settle();assert.deepEqual(f.calls,[{path:'/api/records/first-save',method:'DELETE',body:{version:1}}]);
});

test('stale account, record, page or dialog completion cannot clear a newer editor or release another write owner',async()=>{
  for(const mode of ['account','record','page','dialog']){
    let finish;const f=fixture({requestImpl:()=>new Promise(resolve=>{finish=resolve})});f.openReview();f.go(f.last());$('#delete-draft').click();await settle();$('#delete-draft-confirm').click();
    const original=f.state.current,originalRecords=f.state.records,newer=record('weekly'),newRecords=[newer];
    if(mode==='account'){f.state.user={id:'another'};f.state.records=newRecords}
    if(mode==='record')f.state.current=newer;
    if(mode==='page')ui.renderMarkup($('#app'),'<main>另一个页面</main>');
    if(mode==='dialog'){f.closeModal(true);f.openModal('<div class="modal-head"><h2>新的确认</h2></div><button id="new-confirm">继续</button>','',true)}
    const newerOwner={};f.state.dialogWriteOwner=newerOwner;f.state.saving=true;finish({ok:true});await settle();
    assert.equal(f.navigations.length,0);assert.equal(f.state.current,mode==='record'?newer:original);assert.equal(f.state.records,mode==='account'?newRecords:originalRecords);assert.equal(f.state.dialogWriteOwner,newerOwner);assert.equal(f.state.saving,true);assert.deepEqual(f.notices,[]);f.closeModal(true);
  }
});

test('a pending save or a nonfinal/intro page cannot start deleting the current draft',()=>{
  const f=fixture();f.openReview();f.deleteDraftRecord(f.state.current);assert.equal($('#delete-draft-confirm'),null);f.go('action');f.deleteDraftRecord(f.state.current);assert.equal($('#delete-draft-confirm'),null);f.go(f.last());f.state.saving=true;$('#delete-draft').click();assert.equal($('#delete-draft-confirm'),null);assert.equal(f.calls.length,0);
});

test('archive section title and count follow the filtered records, including empty results and reset',()=>{
  const records=[record('daily','draft',{title:'needle title'}),record('weekly','completed'),record('monthly','verified')],f=fixture({records});
  f.renderHistory();assert.equal($('#history-records-title').textContent,'全部记录');assert.equal($('.archive-section-count strong').textContent,'3');assert.equal($('.archive-section-count').getAttribute('aria-label'),'3 篇复盘');
  f.renderHistory({q:'needle',type:'all',year:'all',month:'all'});assert.equal($('#history-records-title').textContent,'筛选结果');assert.equal($('.archive-section-count strong').textContent,'1');assert.equal($$('[data-open-record]').length,1);
  f.renderHistory({q:'no match',type:'all',year:'all',month:'all'});assert.equal($('.archive-section-count strong').textContent,'0');assert.ok($('.history-empty'));assert.equal($('[data-delete-record]'),null);
  $('#history-reset').click();assert.equal($('.archive-section-count strong').textContent,'3');assert.equal($('#history-records-title').textContent,'全部记录');assert.equal($('#history-reset'),null);
});

test('action section headings show their own truthful counts with escaped custom labels and no repeated tally',()=>{
  const records=[record('daily','draft'),record('weekly','completed'),record('monthly','completed'),record('quarterly','verified')],f=fixture({records});
  f.templates.action={...f.templates.action,pendingTitle:'等待 <em>验证</em>',verifiedTitle:'已验证 & 留存',pendingIntro:'<img src=x> 等待结果',verifiedIntro:'真实结果'};
  f.renderActions();const pending=$('.archive-section-pending'),verified=$('.archive-section-verified');
  assert.equal($('#actions-pending-title').textContent,'等待 <em>验证</em>');assert.equal($('#actions-verified-title').textContent,'已验证 & 留存');assert.equal($('em',pending),null);assert.equal($('img',pending),null);
  assert.equal($('.archive-section-count strong',pending).textContent,'2');assert.equal($('.archive-section-count strong',verified).textContent,'1');assert.equal($('.actions-tallies'),null);assert.equal($$('svg[aria-hidden="false"]').length,0);
  assert.equal($('#actions-pending-title').parentElement.firstElementChild,$('#actions-pending-title'));assert.equal($('#actions-verified-title').parentElement.firstElementChild,$('#actions-verified-title'));
  f.state.records=[];f.renderActions();assert.deepEqual($$('.archive-section-count strong').map(node=>node.textContent),['0','0']);assert.equal($$('.actions-empty').length,2);
});

test('ordinary workspace page headings remain title-first',()=>{
  const f=fixture();f.renderHistory();assert.equal($('.history-hero-copy').firstElementChild,$('#history-title'));assert.equal($('.history-kicker'),null);
  f.state.records=[];f.renderActions();assert.equal($('.history-hero-copy').firstElementChild,$('#actions-title'));assert.equal($('.history-kicker,.actions-section-kicker'),null);
  for(const route of ['backup','users','settings','calendar','stage','guide']){ui.renderMarkup($('#app'),f.spacePageHead(route,{title:'实际标题',description:'有意义的功能说明'}));assert.equal($(`#workspace-${route}-title`).parentElement.firstElementChild,$(`#workspace-${route}-title`));assert.equal($('.workspace-kicker'),null)}
});
test.afterEach(()=>{ui.dismissDialog($('#modal-root'));ui.disposeUi($('#app'));$('#app').replaceChildren()});
test.after(()=>dom.window.close());
