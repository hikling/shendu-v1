import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {attachReviewWheel} from '../public/review-wheel.js';
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
  const match=new RegExp(String.raw`(?:^|\n)((?:async )?function ${name}\()`).exec(source);assert.ok(match,name);
  const start=match.index+(source[match.index]==='\n'?1:0),next=/\n(?:async )?function /.exec(source.slice(start+1));
  return source.slice(start,next?start+1+next.index:source.length).split('\ndocument.addEventListener')[0];
}
const constants=source.slice(source.indexOf('const TYPES ='),source.indexOf('const TYPE_ICONS ='))+'\n'+source.match(/const TYPE_ICONS = [^\n]+/)[0]+'\n'+source.match(/const STATUS = [^\n]+/)[0]+'\n'+source.slice(source.indexOf('const QUESTIONS ='),source.indexOf('function mergeReviewTemplate('));
const renderers=['dailyAnswerPreview','answerItemRow','answerAddButton','dailyAnswerInputs','gaugePresentation','gaugeCard','dailyEvidence','dailyReflection','dailyActionFields','dailyJournal','reviewAfterword','dailySceneArt','dailyReviewHtml','extendedSceneArt','extendedPromptCopy','extendedPromptHtml','extendedReviewHtml','verificationRead','currentDailyPrompts','dailyPromptCopy','setReviewPromptHeading','setDailyPromptHeading','showDailyPrompt','currentExtendedPrompts','setExtendedPromptHeading','showExtendedPrompt','bindReview','bindReviewWheel','clearDailyIssues','openDailyAnswer'];
function record(type='daily',overrides={}){
  const periods={daily:'2026-11-12',weekly:'2026-W46',monthly:'2026-11',quarterly:'2026-11-01',yearly:'2026',decision:'2026-11-12'};
  return {id:`${type}-draft`,type,status:'draft',period:periods[type],version:3,title:'私人记录',data:{answers:{today:['事实'],wins:['事实']},metrics:[],action:'继续行动',ifCondition:'遇到阻碍',ifThen:'及时调整',journal:'私人日记',verifyDate:'2027-11-12'},...overrides};
}
function fixture({draft=record(),dirty=true,impl=async(path,options)=>path==='/api/records'?{record:{...options.body,version:4}}:{total:1},fetchImpl=null}={}){
  ui.dismissDialog($('#modal-root'));ui.renderMarkup($('#app'),'');
  const state={user:{id:'owner',username:'owner',displayName:'测试',role:'member'},stage:{sleepTarget:7,energyTarget:70,metrics:[]},records:draft.id?[structuredClone(draft)]:[],stats:{total:0},current:draft,saving:false,dirty,route:draft.type},calls=[],notices=[],renders=[];
  let functions,templates;
  const request=(path,options)=>{calls.push({path,...structuredClone(options)});return impl(path,options)};
  const shell=content=>ui.renderMarkup($('#app'),`<main class="main" id="main-content">${content}</main>`);
  const context={$,$$,attachReviewWheel,state,request,shell,esc,renderMarkup:ui.renderMarkup,prepareDialogContainer:ui.prepareDialogContainer,showDialog:ui.showDialog,dismissDialog:ui.dismissDialog,cancelDailyTypewriter:()=>{},startDailyTypewriter:()=>{},setDailyImmersive:()=>{},DAILY_STEPS,dailyPrompts,dailyPromptOwner,EXTENDED_FLOW,extendedPrompts,reviewQuestions,reviewIntroLayout,dailyIntroLines:reviewIntroLines,defaultPeriod:type=>record(type).period,today:()=> '2026-11-12',quoteFor:()=> '回看事实，慢慢向前。',beijingTime:()=> '12:00',verificationMinimum:()=> '2026-11-12',dailyCalendarDateLabel:value=>value,templatesForRecord:()=>templates,verificationTimes:()=>'',verificationActualAt:r=>r.verified_at||'',currentTemplateSnapshot:()=>({review:templates.review,action:templates.action}),clone:structuredClone,reconcileReviewMetrics:metrics=>({metrics}),newRecord:()=>{throw new Error('unexpected new record')},dailyVerificationCalendar:value=>`<input type="hidden" data-simple="verifyDate" value="${esc(value)}"><div id="daily-verification-calendar" data-verify-month-value="2026-11"></div>`,renderDailyCalendar:()=>{},bindDailyFlow:()=>functions.showDailyPrompt(state.dailyPrompt),bindExtendedFlow:()=>functions.showExtendedPrompt(state.extendedPrompt),renderReviewFromCurrent:()=>{},focusDailyAnswer:()=>{},updateGauge:()=>{},deleteDraftRecord:()=>{},toast:(...args)=>notices.push(args),validateCurrent:()=>{functions.collectCurrent();return []},applyTheme:()=>{}};
  context.formatDate=value=>value;
  if(fetchImpl){delete context.request;context.fetch=(path,options)=>{calls.push({path,...structuredClone(options)});return fetchImpl(path,options)}}
  const names=[...renderers,'renderReview','collectCurrent','setReviewBusy','saveCurrent','completeCurrent','refreshData','dialogWriteTask','syncOverlayBackground','openModal','closeModal',...(fetchImpl?['request','sessionExpired']:[])];
  functions=new Function(...Object.keys(context),`let modalReturnFocus=null;\n${constants}\n${names.map(owner).join('\n')}\nreturn {renderReview,showDailyPrompt,showExtendedPrompt,collectCurrent,saveCurrent,completeCurrent,dialogWriteTask,openModal,closeModal,review:DEFAULT_REVIEW_TEMPLATES,action:DEFAULT_ACTION_TEMPLATE};`)(...Object.values(context));
  templates={review:functions.review[draft.type],action:functions.action};
  const render=(r=state.current,options={})=>{renders.push(r);return functions.renderReview(r.type,r.period,false,r,{dailySection:'journal',dailyPrompt:'journal',extendedPrompt:'verifyDate',dirty,...options})};
  render();
  return {state,calls,notices,renders,render,...functions};
}
const confirm=f=>{f.completeCurrent();$('#confirm-complete').click()};
const jsonResponse=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});

test('first save preserves all six mounted editors, prompt identity and exact record fields',async()=>{
  for(const type of ['daily','weekly','monthly','quarterly','yearly','decision']){
    const draft=record(type,{id:null,version:0}),f=fixture({draft,impl:async(_path,{body})=>({record:{...body,id:'first-save',version:1,updated_at:'2026-11-12'}})}),editor=$('#daily-editor'),input=$('[data-simple="action"]'),prompt=f.state.dailyPrompt||f.state.extendedPrompt;
    input.value='刚输入的行动';const saved=await f.saveCurrent();assert.equal(saved.id,'first-save');assert.equal(saved.data.action,'刚输入的行动');assert.equal(saved.type,type);assert.equal(saved.period,draft.period);assert.equal(saved.data.journal,type==='daily'?'私人日记':'私人日记');assert.equal($('#daily-editor'),editor);assert.equal($('[data-simple="action"]'),input);assert.equal(f.state.dailyPrompt||f.state.extendedPrompt,prompt);assert.equal(f.state.records[0],saved);assert.equal(f.state.dirty,false);assert.equal(f.state.saving,false);assert.equal(input.disabled,false);
  }
});

test('save is single-flight, retains failed content and can retry on its mounted editor',async()=>{
  const pending=[];const f=fixture({impl:()=>new Promise((resolve,reject)=>pending.push({resolve,reject}))});const input=$('[data-simple="action"]');input.value='失败后保留';const first=f.saveCurrent();assert.equal(await f.saveCurrent(),null);assert.equal(pending.length,1);assert.equal(input.disabled,true);assert.equal(f.state.saving,true);
  pending[0].reject(new Error('暂时无法保存'));await assert.rejects(first,/暂时无法保存/);assert.equal(input.value,'失败后保留');assert.equal(input.disabled,false);assert.equal(f.state.dirty,true);assert.equal(f.state.saving,false);assert.match($('.save-state').textContent,/保存失败/);
  const retry=f.saveCurrent();pending[1].resolve({record:{...f.state.current,version:4,updated_at:'2026-11-12'}});await retry;assert.equal(f.state.dirty,false);assert.deepEqual(f.notices,[['暂时无法保存','error'],['草稿已保存']]);
});

test('late save success/error cannot overwrite replacement account, record, editor, cache or newer writer',async()=>{
  for(const mode of ['account','record','page'])for(const fails of [false,true]){
    let finish,reject;const f=fixture({impl:()=>new Promise((yes,no)=>{finish=yes;reject=no})});const old=f.state.current,save=f.saveCurrent();const replacement=record('weekly',{id:'other-record'}),cache=[replacement],stats={total:9};
    if(mode==='account')f.state.user={id:'other',role:'member'};
    if(mode==='record')f.state.current=replacement;
    if(mode==='page')ui.renderMarkup($('#app'),'<main id="other-page"><input value="new content"></main>');
    f.state.records=cache;f.state.stats=stats;f.state.dirty=true;const newer={};f.state.reviewWriteOwner=newer;f.state.saving=true;
    if(fails){reject(new Error('旧操作错误'));await assert.rejects(save,/旧操作错误/)}else{finish({record:{...old,version:4}});assert.equal(await save,null)}
    assert.equal(f.state.current,mode==='record'?replacement:old);assert.equal(f.state.records,cache);assert.equal(f.state.stats,stats);assert.equal(f.state.dirty,true);assert.equal(f.state.reviewWriteOwner,newer);assert.equal(f.state.saving,true);assert.deepEqual(f.notices,[]);
  }
});

test('a stale save finally never releases a newer dialog/account/settings/admin write',async()=>{
  for(const field of ['dialogWriteOwner','accountWriteOwner','settingsWriteOwner','adminWriteOwner']){
    let finish;const f=fixture({impl:()=>new Promise(resolve=>{finish=resolve})});const save=f.saveCurrent(),next={};f.state[field]=next;finish({record:{...f.state.current,version:4}});assert.equal(await save,null);assert.equal(f.state[field],next);assert.equal(f.state.saving,true);assert.equal($('[data-simple="action"]').disabled,true);assert.deepEqual(f.notices,[]);
  }
});

test('finishing an obsolete dialog keeps a newer review save busy until that save completes',async()=>{
  let resolve;const f=fixture({impl:()=>new Promise(finish=>{resolve=finish})});f.openModal('<form id="older-dialog"><input name="old"></form>');const task=f.dialogWriteTask($('#older-dialog'));assert.equal(task.begin(),true);f.closeModal(true);
  // A forced page/account replacement can start a new writer before the old task settles.
  f.state.saving=false;const save=f.saveCurrent(),writer=f.state.reviewWriteOwner;
  task.finish();assert.equal(f.state.saving,true);assert.equal(f.state.reviewWriteOwner,writer);assert.equal($('[data-simple="action"]').disabled,true);
  resolve({record:{...f.state.current,version:4}});await save;assert.equal(f.state.saving,false);assert.equal(f.state.reviewWriteOwner,undefined);assert.equal($('[data-simple="action"]').disabled,false);
});

test('completion first saves a new draft once, locks its returned ID and preserves the final daily prompt',async()=>{
  const pending=[];const f=fixture({draft:record('daily',{id:null,version:0}),impl:(path)=>path==='/api/stats'?Promise.resolve({total:1}):new Promise(resolve=>pending.push(resolve))});const original=f.state.current;confirm(f);$('#confirm-complete').click();assert.equal(f.calls.length,1);f.closeModal();assert.ok($('#confirm-complete'));assert.equal(f.state.saving,true);
  const saved={...original,id:'saved-id',version:1};pending[0]({record:saved});await settle();assert.equal(f.calls.length,2);assert.deepEqual(f.calls[1],{path:'/api/records/saved-id/complete',method:'POST'});const completed={...saved,status:'completed',version:2};pending[1]({record:completed});await settle();assert.equal($('#confirm-complete'),null);assert.equal(f.state.current.id,'saved-id');assert.equal(f.state.current.status,'completed');assert.equal(f.state.dailyPrompt,'journal');assert.equal($('#daily-editor').dataset.dailyLocked,'true');assert.equal(f.state.saving,false);assert.equal($('[data-daily-back]').disabled,false);assert.deepEqual(f.state.stats,{total:1});assert.deepEqual(f.notices,[['复盘已完成并锁定']]);
});

test('a clean saved extended record completes without another save and retains its prompt after stats failure',async()=>{
  const draft=record('weekly'),f=fixture({draft,dirty:false,impl:async path=>{if(path==='/api/stats')throw new Error('statistics unavailable');return {record:{...draft,status:'completed',version:4}}}});confirm(f);await settle();assert.deepEqual(f.calls.map(call=>call.path),['/api/records/weekly-draft/complete','/api/stats']);assert.equal(f.state.extendedPrompt,'verifyDate');assert.equal($('#daily-editor').dataset.dailyLocked,'true');assert.equal(f.state.saving,false);assert.deepEqual(f.state.stats,{total:0});
});

test('save-before-complete failure retains confirmation and inputs, then retries with the saved version',async()=>{
  const pending=[];const f=fixture({impl:path=>path==='/api/stats'?Promise.resolve({total:1}):new Promise((resolve,reject)=>pending.push({resolve,reject}))});confirm(f);pending[0].reject(new Error('草稿保存失败'));await settle();assert.ok($('#confirm-complete'));assert.equal($('#confirm-complete').disabled,false);assert.equal($('.modal').hasAttribute('data-review-lock-busy'),false);assert.equal(f.state.dirty,true);assert.equal(f.state.saving,false);assert.equal($('[data-simple="action"]').value,'继续行动');assert.deepEqual(f.notices,[['草稿保存失败','error']]);
  $('#confirm-complete').click();pending[1].resolve({record:{...f.state.current,version:4}});await settle();assert.equal(f.calls.at(-1).path,'/api/records/daily-draft/complete');pending[2].resolve({record:{...f.state.current,status:'completed',version:5}});await settle();assert.equal(f.state.current.status,'completed');assert.equal(f.state.saving,false);
});

test('replacement account/record/editor/modal during save prevents a completion POST or stale save commit',async()=>{
  for(const mode of ['account','record','page','modal']){
    let finish;const f=fixture({impl:()=>new Promise(resolve=>{finish=resolve})});confirm(f);const old=f.state.current,replacement=record('weekly',{id:'replacement'}),cache=[replacement];
    if(mode==='account')f.state.user={id:'other',role:'member'};
    if(mode==='record')f.state.current=replacement;
    if(mode==='page')ui.renderMarkup($('#app'),'<main id="other-page">新页面</main>');
    if(mode==='modal'){f.closeModal(true);f.openModal('<div class="modal-head"><h2>新对话框</h2></div><button id="new-confirm">继续</button>','',true)}
    f.state.records=cache;f.state.dirty=true;finish({record:{...old,id:'old-result',version:4}});await settle();assert.equal(f.calls.length,1);assert.equal(f.state.current,mode==='record'?replacement:old);assert.equal(f.state.records,cache);assert.equal(f.state.dirty,true);assert.equal(f.state.saving,false);assert.deepEqual(f.notices,[]);if(mode==='modal')assert.ok($('#new-confirm'));
  }
});

test('completion commits before stats, and both phases reject results for replacement surfaces',async()=>{
  for(const phase of ['complete','stats'])for(const mode of ['account','record','page','modal']){
    const pending=[];const f=fixture({dirty:false,impl:()=>new Promise(resolve=>pending.push(resolve))});confirm(f);const old=f.state.current,completed={...old,status:'completed',version:4};
    if(phase==='stats'){pending[0]({record:completed});await settle();assert.equal(f.calls[1].path,'/api/stats');assert.equal(f.state.current.status,'completed');assert.equal(f.state.records[0],completed);assert.equal($('#daily-editor').dataset.dailyLocked,'true');assert.equal(f.state.saving,false)}
    const accepted=f.state.current;
    const replacement=record('weekly',{id:'replacement'}),cache=[replacement],stats={total:17};
    if(mode==='account')f.state.user={id:'other',role:'member'};
    if(mode==='record')f.state.current=replacement;
    if(mode==='page')ui.renderMarkup($('#app'),'<main id="other-page">新页面</main>');
    if(mode==='modal'){f.closeModal(true);f.openModal('<div class="modal-head"><h2>新的操作</h2></div><button id="new-confirm">继续</button>','',true)}
    f.state.records=cache;f.state.stats=stats;f.state.dirty=true;const next={};f.state.dialogWriteOwner=next;f.state.saving=true;
    pending.at(-1)(phase==='complete'?{record:completed}:{total:999});await settle();assert.equal(f.state.current,mode==='record'?replacement:accepted);assert.equal(f.state.records,cache);assert.equal(f.state.stats,stats);assert.equal(f.state.dirty,true);assert.equal(f.state.dialogWriteOwner,next);assert.equal(f.state.saving,true);assert.deepEqual(f.notices,phase==='stats'?[['复盘已完成并锁定']]:[]);assert.equal(f.calls.length,phase==='complete'?1:2);if(mode==='modal')assert.ok($('#new-confirm'));
  }
});

test('real stats 401 reauthenticates only after the completed record is committed and stays locked through login',async()=>{
  let finishStats;const draft=record(),completed={...draft,status:'completed',version:4};
  const f=fixture({draft,dirty:false,fetchImpl:path=>path.endsWith('/complete')?Promise.resolve(jsonResponse({record:completed})):path==='/api/stats'?new Promise(resolve=>{finishStats=resolve}):Promise.resolve(jsonResponse({}))});
  confirm(f);await settle();assert.equal(f.state.current.status,'completed');assert.equal(f.state.records[0].status,'completed');assert.equal($('#confirm-complete'),null);assert.equal($('#daily-editor').dataset.dailyLocked,'true');assert.equal(f.state.saving,false);
  finishStats(jsonResponse({error:'unauthorized',message:'登录已失效'},401));await settle();assert.ok($('#reauth-form'));assert.equal(f.state.reauthOpen,true);assert.equal($('#modal-root').dataset.persistent,'1');assert.equal(f.state.current.status,'completed');assert.equal(f.state.records[0].status,'completed');assert.deepEqual(f.notices,[['复盘已完成并锁定']]);
  $('#reauth-password').value='private-password';$('#reauth-form').dispatchEvent(new win.Event('submit',{bubbles:true,cancelable:true}));await settle();assert.equal($('#reauth-form'),null);assert.equal(f.state.reauthOpen,false);assert.equal(f.state.current.status,'completed');assert.equal($('#daily-editor').dataset.dailyLocked,'true');assert.equal(f.calls.filter(call=>call.path.endsWith('/complete')).length,1);assert.equal(f.calls.some(call=>call.method==='PUT'),false);
});

test('real late stats 401 cannot open reauthentication over another account, page, record or modal',async()=>{
  for(const mode of ['account','page','record','modal']){
    let finishStats;const draft=record(),completed={...draft,status:'completed',version:4};const f=fixture({draft,dirty:false,fetchImpl:path=>path.endsWith('/complete')?Promise.resolve(jsonResponse({record:completed})):new Promise(resolve=>{finishStats=resolve})});confirm(f);await settle();
    if(mode==='account')f.state.user={id:'other',username:'other',role:'member'};
    if(mode==='page')ui.renderMarkup($('#app'),'<main id="new-page">另一个页面</main>');
    if(mode==='record')f.state.current=record('weekly');
    if(mode==='modal')f.openModal('<div class="modal-head"><h2>新的操作</h2></div><input id="new-dialog">','',true);
    const owner=f.state.user,current=f.state.current,stats={total:88};f.state.stats=stats;finishStats(jsonResponse({error:'unauthorized',message:'旧统计请求已失效'},401));await settle();assert.equal($('#reauth-form'),null);assert.equal(f.state.reauthOpen,undefined);assert.equal(f.state.user,owner);assert.equal(f.state.current,current);assert.equal(f.state.stats,stats);assert.deepEqual(f.notices,[['复盘已完成并锁定']]);if(mode==='modal')assert.ok($('#new-dialog'));
  }
});

test('real save 401 keeps current dirty input behind reauth but never opens reauth for a replaced owner',async()=>{
  for(const mode of ['current','account','page']){
    let finish;const f=fixture({fetchImpl:()=>new Promise(resolve=>{finish=resolve})});$('[data-simple="action"]').value='未保存的行动';const saving=f.saveCurrent();
    if(mode==='account')f.state.user={id:'other',username:'other',role:'member'};
    if(mode==='page')ui.renderMarkup($('#app'),'<main id="new-page">另一个页面</main>');
    finish(jsonResponse({error:'unauthorized',message:'登录已失效'},401));await assert.rejects(saving,error=>error.status===401);await settle();assert.equal(f.state.saving,false);assert.equal(f.state.dirty,true);
    if(mode==='current'){assert.ok($('#reauth-form'));assert.equal(f.state.reauthOpen,true);assert.equal($('[data-simple="action"]').value,'未保存的行动');assert.equal(f.state.current.status,'draft');assert.deepEqual(f.notices,[['登录已失效','error']])}
    else{assert.equal($('#reauth-form'),null);assert.equal(f.state.reauthOpen,undefined);assert.deepEqual(f.notices,[])}
  }
});

test('a version conflict refresh retains dirty input and releases its own editor after user-object replacement',async()=>{
  const draft=record(),refreshedUser={id:'owner',username:'owner',displayName:'测试',role:'member'};
  let put=true;
  // Return a conflict for PUT while keeping the real refreshData GET paths.
  const conflict=Object.assign(new Error('其他设备已更新'),{code:'version_conflict'});
  const next=fixture({draft,impl:async(path,options)=>{if(options?.method==='PUT'&&put){put=false;throw conflict}if(path==='/api/me')return {user:refreshedUser,stage:{},theme:{}};if(path==='/api/records')return {records:[{...draft,version:8}]};return {total:1}}});
  $('[data-simple="action"]').value='尚未保存的行动';confirm(next);await settle();assert.equal(next.state.user,refreshedUser);assert.equal(next.state.dirty,true);assert.equal($('[data-simple="action"]').value,'尚未保存的行动');assert.equal($('[data-simple="action"]').disabled,false);assert.equal($('#confirm-complete').disabled,false);assert.equal(next.state.saving,false);assert.equal($('.modal').hasAttribute('data-review-lock-busy'),false);assert.deepEqual(next.notices,[['其他设备已更新','error']]);
});

test('accepted completion statistics update the header count without remounting the locked editor',async()=>{
  for(const pending of [0,7]){
    let finishStats;const draft=record(),completed={...draft,status:'completed',version:4};
    const f=fixture({draft,dirty:false,impl:path=>path.endsWith('/complete')?Promise.resolve({record:completed}):new Promise(resolve=>{finishStats=resolve})});
    confirm(f);await settle();const editor=$('#daily-editor');
    $('#app').insertAdjacentHTML('afterbegin',`<nav class="header-nav"><button data-nav="actions">行动验证${pending?'':'<span class="header-count">2</span>'}</button></nav>`);
    finishStats({total:1,pending});await settle();assert.equal($('#daily-editor'),editor);assert.equal(f.state.current.status,'completed');assert.equal(f.state.stats.pending,pending);assert.equal($('.header-count')?.textContent,pending?'7':undefined);
  }
});

test('late 401 during version-conflict refresh cannot reauthenticate a replacement account',async()=>{
  const pending=[];const f=fixture({fetchImpl:(path,options)=>options.method==='PUT'?Promise.resolve(jsonResponse({error:'version_conflict',message:'其他设备已更新'},409)):new Promise(resolve=>pending.push(resolve))});
  const saving=f.saveCurrent();await settle();assert.equal(pending.length,3);
  const account={id:'other',username:'other',role:'member'},cache=[record('weekly')];f.state.user=account;f.state.records=cache;
  pending.forEach(resolve=>resolve(jsonResponse({error:'unauthorized',message:'旧刷新请求失效'},401)));
  await assert.rejects(saving);await settle();assert.equal($('#reauth-form'),null);assert.equal(f.state.reauthOpen,undefined);assert.equal(f.state.user,account);assert.equal(f.state.records,cache);assert.equal(f.state.dirty,true);assert.equal(f.state.saving,false);
});

test.afterEach(()=>{ui.dismissDialog($('#modal-root'));ui.disposeUi($('#app'));$('#app').replaceChildren()});
test.after(()=>dom.window.close());
