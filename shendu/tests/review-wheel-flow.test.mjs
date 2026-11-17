import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {attachReviewWheel} from '../public/review-wheel.js';
import {createReviewTransition} from '../public/review-transition.js';
import {mountDailyFinance} from '../public/finance-ui.js';
import {DEFAULT_FINANCE_CATEGORIES} from '../public/finance-domain.js';
import {DAILY_STEPS,dailyPrompts,dailyPromptOwner,dailyPromptIssues,dailyPromptNeighbor} from '../public/daily-flow.js';
import {EXTENDED_FLOW,extendedPrompts,extendedPromptIssues,extendedPromptNeighbor} from '../public/extended-flow.js';
import {reviewQuestions} from '../public/review-schema.js';
import {reviewIntroLayout,reviewIntroLines} from '../public/review-intros.js';

const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8'),html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const dom=new JSDOM(html,{url:'http://localhost',pretendToBeVisual:true}),win=dom.window;
for(const name of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement','HTMLSelectElement','HTMLButtonElement','HTMLFormElement','Element','DocumentFragment','Node','NodeFilter','Event','CustomEvent','KeyboardEvent','MouseEvent','MutationObserver','getComputedStyle','FormData'])globalThis[name]=win[name];
Object.defineProperty(globalThis,'navigator',{value:win.navigator,configurable:true});
globalThis.requestAnimationFrame=win.requestAnimationFrame.bind(win);globalThis.cancelAnimationFrame=win.cancelAnimationFrame.bind(win);
globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
win.HTMLElement.prototype.scrollIntoView=function(){};
const ui=await import('../public/ui/shadcn.js');
const $=(selector,root=document)=>root.querySelector(selector),$$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const types=['daily','weekly','monthly','quarterly','yearly','decision'];
function owner(name){
  const match=new RegExp(String.raw`(?:^|\n)((?:async )?function ${name}\()`).exec(source);assert.ok(match,name);
  const start=match.index+(source[match.index]==='\n'?1:0),next=/\n(?:async )?function /.exec(source.slice(start+1));
  return source.slice(start,next?start+1+next.index:source.length).split('\ndocument.addEventListener')[0];
}
const constants=source.slice(source.indexOf('const TYPES ='),source.indexOf('const TYPE_ICONS ='))+'\n'+source.match(/const TYPE_ICONS = [^\n]+/)[0]+'\n'+source.match(/const STATUS = [^\n]+/)[0]+'\n'+source.slice(source.indexOf('const QUESTIONS ='),source.indexOf('function mergeReviewTemplate('));
const names=['dailyAnswerPreview','answerItemRow','answerAddButton','dailyAnswerInputs','gaugePresentation','gaugeCard','dailyEvidence','dailyReflection','dailyActionFields','dailyJournal','reviewAfterword','dailySceneArt','dailyReviewHtml','extendedSceneArt','extendedPromptCopy','extendedPromptHtml','extendedReviewHtml','verificationRead','currentDailyPrompts','dailyPromptCopy','setReviewPromptHeading','setDailyPromptHeading','showDailyPrompt','showDailySection','clearDailyIssues','dailyIssueLabel','showDailyIssues','bindDailyFlow','currentExtendedPrompts','setExtendedPromptHeading','showExtendedPrompt','extendedIssueLabel','showExtendedIssues','bindExtendedFlow','bindReviewWheel','bindReview','openDailyAnswer','renderReview','collectCurrent','moveReviewPrompt','shell','setReviewBusy','openModal','closeModal','syncOverlayBackground'];
function fixture(type='daily',locked=false,{financeEnabled=false}={}){
  ui.dismissDialog($('#modal-root'));ui.renderMarkup($('#app'),'');
  const period={daily:'2026-11-13',weekly:'2026-W46',monthly:'2026-11',quarterly:'2026-11-01',yearly:'2026',decision:'2026-11-13'}[type];
  const current={id:`${type}-record`,type,period,title:'',version:1,created_at:'2026-11-13T04:00:00.000Z',updated_at:'2026-11-13T04:00:00.000Z',status:locked?'completed':'draft',data:{answers:{},metrics:[],action:'',ifCondition:'',ifThen:'',verifyDate:'2027-12-31',journal:''}};
  const state={user:{id:'owner',displayName:'测试',username:'owner'},theme:{reviewWheelNavigation:true},stage:{sleepTarget:7,energyTarget:70,metrics:[]},current,records:[current],dirty:false,saving:false,route:type,dailySection:'intro',dailyPrompt:null,extendedPrompt:null};
  let functions,templates,time=0;const writes=[],financeCalls=[],financeEntries=[];
  const financeSummary=()=>({incomeCents:0,expenseCents:financeEntries.reduce((sum,entry)=>sum+entry.amountCents,0),refundCents:0,netExpenseCents:financeEntries.reduce((sum,entry)=>sum+entry.amountCents,0),balanceCents:0,count:financeEntries.length});
  const request=async(path,args={})=>{financeCalls.push({path,...args});if(path==='/api/finance/storage')return {configured:false,config:{},version:0,targets:[]};if(path==='/api/finance/entries'){const entry={...args.body,amountCents:2300,version:1,deletedAt:null};financeEntries.push(entry);return {entry}};if(path.startsWith('/api/finance?'))return {entries:[...financeEntries],categories:DEFAULT_FINANCE_CATEGORIES,summary:financeSummary(),trend:[],categoryTotals:[],nextCursor:null,day:{date:period,state:financeEntries.length?'recorded':'unrecorded',version:0}};throw new Error(`Unexpected finance API ${path}`)};
  const context={$,$$,state,esc,createReviewTransition,mountDailyFinance,showFinanceMonthPicker:ui.showFinanceMonthPicker,showFinanceDayPicker:ui.showFinanceDayPicker,showFinancePie:ui.showFinancePie,request,toast:()=>{},financeUiOptions:(container,extra={})=>({...extra,request,renderMarkup:ui.renderMarkup,openModal:(html,className='')=>ui.renderMarkup($('#modal-root'),'<section class="modal '+className+'">'+html+'</section>'),closeModal:()=>ui.renderMarkup($('#modal-root'),''),receiptClient:{processReceiptFiles:async()=>({imageStatus:'stored',receiptIds:['wheel-photo'],candidates:[{kind:'expense',expression:'23',receiptIds:['wheel-photo']}],warnings:[]})},today:()=> '2026-11-13',isCurrent:()=>container.isConnected&&state.user.id==='owner'&&(extra.isCurrent?.()??true),setDirty:value=>{if(value)state.dirty=true},beginWrite:()=>{if(state.saving)return null;state.saving=true;return {}},endWrite:()=>{state.saving=false}}),renderMarkup:ui.renderMarkup,topbar:()=>'',bindCommon:()=>{},prepareDialogContainer:ui.prepareDialogContainer,showDialog:ui.showDialog,dismissDialog:ui.dismissDialog,attachReviewWheel:(root,options)=>attachReviewWheel(root,{...options,now:()=>time}),DAILY_STEPS,dailyPrompts,dailyPromptOwner,dailyPromptIssues,dailyPromptNeighbor,EXTENDED_FLOW,extendedPrompts,extendedPromptIssues,extendedPromptNeighbor,reviewQuestions,reviewIntroLayout,dailyIntroLines:reviewIntroLines,
    defaultPeriod:()=>period,today:()=> '2026-11-13',quoteFor:()=> '回看事实，慢慢向前。',beijingTime:()=> '12:00',verificationMinimum:()=> '2026-11-13',dailyCalendarDateLabel:value=>value,verificationTimes:()=>'',verificationActualAt:r=>r.verified_at||'',formatDate:value=>value,clone:structuredClone,
    templatesForRecord:()=>templates,currentTemplateSnapshot:()=>({review:templates.review,action:templates.action}),reconcileReviewMetrics:metrics=>({metrics}),newRecord:()=>{throw new Error('new record unexpected')},
    dailyVerificationCalendar:value=>`<input type="hidden" data-simple="verifyDate" value="${esc(value)}"><div id="daily-verification-calendar" data-verify-month-value="2026-11"></div>`,renderDailyCalendar:()=>{},bindDailyCalendar:()=>{},reviewNavigation:{exit:()=>{}},cancelDailyTypewriter:()=>{},startDailyTypewriter:()=>{},setDailyImmersive:()=>{},focusDailyAnswer:()=>{},updateGauge:()=>{},renderReviewFromCurrent:()=>{},saveCurrent:()=>writes.push('save'),completeCurrent:()=>writes.push('complete'),deleteDraftRecord:()=>writes.push('delete')};
  functions=new Function(...Object.keys(context),`let overviewReelObserver=null,modalReturnFocus=null;\n${constants}\n${names.map(owner).join('\n')}\nreturn {renderReview,showDailyPrompt,showExtendedPrompt,currentDailyPrompts,currentExtendedPrompts,collectCurrent,shell,setReviewBusy,openModal,closeModal,review:DEFAULT_REVIEW_TEMPLATES,action:DEFAULT_ACTION_TEMPLATE};`)(...Object.values(context));
  templates={review:{...functions.review[type],financeEnabled},action:functions.action};functions.renderReview(type,period,false,current);
  const canvas=$('.daily-flow'),prompt=()=>type==='daily'?state.dailyPrompt:state.extendedPrompt,prompts=()=>type==='daily'?functions.currentDailyPrompts():functions.currentExtendedPrompts();
  const wheel=(direction=1,target=canvas,gap=800)=>{time+=gap;const event=new win.WheelEvent('wheel',{deltaY:direction*120,bubbles:true,cancelable:true});target.dispatchEvent(event);return event};
  const show=id=>type==='daily'?functions.showDailyPrompt(id):functions.showExtendedPrompt(id);
  return {state,current:state.current,canvas,prompt,prompts,wheel,show,writes,financeCalls,financeEntries,collect:functions.collectCurrent,start:()=>$('#daily-start').click(),replace:()=>functions.shell('<p>另一页</p>'),busy:functions.setReviewBusy,modal:()=>functions.openModal('<div class="modal-head"><h2>确认</h2></div><button data-close>返回</button>'),closeModal:functions.closeModal};
}

test('all six real flow handlers keep intro and end boundaries, traverse readonly questions and never submit',()=>{
  for(const type of types){
    const f=fixture(type,true);assert.equal(f.wheel().defaultPrevented,false);assert.equal(f.prompt(),null);f.start();
    const ids=f.prompts().map(prompt=>prompt.id);assert.equal(f.prompt(),ids[0]);f.wheel(-1);assert.equal(f.prompt(),ids[0]);
    for(const id of ids.slice(1)){f.wheel();assert.equal(f.prompt(),id,`${type} ${id}`)}
    f.wheel();f.wheel();assert.equal(f.prompt(),ids.at(-1));assert.deepEqual(f.writes,[]);assert.equal(f.state.dirty,false);
    for(const id of ids.slice(0,-1).reverse()){f.wheel(-1);assert.equal(f.prompt(),id,`${type} previous ${id}`)}
  }
});

test('wheel uses each real next-button validator and preserves the same mounted draft input through next/back',()=>{
  for(const type of types){
    const f=fixture(type);f.start();const id=type==='daily'?'today':f.prompts()[0].id;f.show(id);
    const input=id==='recordTitle'?$('#record-title'):$(`[data-answer="${id}"]`),editor=$('#daily-editor');
    f.wheel();assert.equal(f.prompt(),id);assert.equal($('#daily-flow-error').hidden,false);assert.equal(input.getAttribute('aria-invalid'),'true');
    input.value='真实填写的内容';input.dispatchEvent(new win.Event('input',{bubbles:true}));f.wheel();
    assert.notEqual(f.prompt(),id);assert.equal(type==='decision'?f.current.title:f.current.data.answers[id][0],'真实填写的内容');
    f.wheel(-1);assert.equal(f.prompt(),id);assert.equal($('#daily-editor'),editor);assert.equal(id==='recordTitle'?$('#record-title'):$(`[data-answer="${id}"]`),input);assert.equal(input.value,'真实填写的内容');assert.equal(f.state.dirty,true);assert.deepEqual(f.writes,[]);
  }
});

test('one long burst cannot sweep real questions and disabled preference preserves ordinary buttons',()=>{
  const f=fixture('daily',true);f.start();const ids=f.prompts().map(prompt=>prompt.id);f.wheel();assert.equal(f.prompt(),ids[1]);
  for(let i=0;i<100;i++)f.wheel(1,f.canvas,30);assert.equal(f.prompt(),ids[1]);
  f.wheel();assert.equal(f.prompt(),ids[2]);f.state.theme.reviewWheelNavigation=false;assert.equal(f.wheel().defaultPrevented,false);assert.equal(f.prompt(),ids[2]);
  $('[data-daily-next]').click();assert.equal(f.prompt(),ids[3]);f.state.theme.reviewWheelNavigation=true;f.wheel(-1);assert.equal(f.prompt(),ids[2]);
});

test('real flow ignores busy/modal/foreign account events and gives overflowing writing content the whole gesture',()=>{
  const f=fixture('weekly',true);f.start();const id=f.prompt();f.state.saving=true;assert.equal(f.wheel().defaultPrevented,false);assert.equal(f.prompt(),id);f.state.saving=false;
  $('#modal-root').innerHTML='<div class="modal" role="dialog">确认框</div>';assert.equal(f.wheel().defaultPrevented,false);assert.equal(f.prompt(),id);$('#modal-root').replaceChildren();
  const input=$(`[data-answer="${id}"]`);input.style.overflowY='auto';Object.defineProperties(input,{scrollHeight:{value:500,configurable:true},clientHeight:{value:200,configurable:true}});input.scrollTop=100;
  assert.equal(f.wheel(1,input).defaultPrevented,false);input.scrollTop=300;f.wheel(1,input,40);assert.equal(f.prompt(),id);f.wheel(1,input);assert.notEqual(f.prompt(),id);
  const accepted=f.prompt();f.state.user={id:'other'};f.wheel();assert.equal(f.prompt(),accepted);f.canvas.remove();f.wheel();assert.equal(f.prompt(),accepted);assert.deepEqual(f.writes,[]);
});

function animationHarness(canvas){
  const animations=[];
  for(const node of $$('.daily-editor-content,.daily-intro-copy,.daily-scene-art',canvas))node.animate=(frames,options)=>{
    let resolve,reject,settled=false;
    const finished=new Promise((yes,no)=>{resolve=yes;reject=no});
    const animation={node,frames,options,finished,get pending(){return !settled},finish(){if(!settled){settled=true;resolve()}},cancel(){if(!settled){settled=true;reject(new Error('cancelled'))}}};
    animations.push(animation);return animation;
  };
  const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve()};
  return {animations,flush,async phase(){const pending=animations.filter(animation=>animation.pending);assert.equal(pending.length,2,'copy and art participate in one phase');pending.forEach(animation=>animation.finish());await flush()}};
}

test('all six actual button and wheel paths animate every question and stage with one preserved input tree',async()=>{
  for(const type of types){
    const f=fixture(type,true),h=animationHarness(f.canvas),editor=$('#daily-editor'),art=$('.daily-scene-art'),fields=$$('textarea,input',editor),header=$('.daily-flow-head'),footer=$('.daily-flow-footer');
    const ids=f.prompts().map(prompt=>prompt.id);f.start();assert.equal(f.prompt(),null);await h.phase();assert.equal(f.prompt(),ids[0]);await h.phase();
    for(let i=1;i<ids.length;i++){
      if(i%2)f.wheel();else $('[data-daily-next]').click();
      assert.equal(f.prompt(),ids[i-1],`${type}: old question survives outgoing phase`);const count=h.animations.length;
      $('[data-daily-next]').click();$('[data-daily-back]').click();assert.equal(h.animations.length,count,'rapid presses do not queue or overlap');
      await h.phase();assert.equal(f.prompt(),ids[i]);assert.equal(document.activeElement,$('#daily-prompt-title'));await h.phase();
      assert.equal($('#daily-editor'),editor);assert.equal($('.daily-scene-art'),art);assert.deepEqual($$('textarea,input',editor),fields);assert.equal($('.daily-flow-head'),header);assert.equal($('.daily-flow-footer'),footer);
      assert.equal(f.canvas.reviewTransition.busy,false);assert.ok(h.animations.every(animation=>animation.node!==header&&animation.node!==footer));
    }
    const count=h.animations.length;f.wheel();assert.equal(h.animations.length,count);assert.equal(f.prompt(),ids.at(-1));assert.deepEqual(f.writes,[]);
    for(let i=ids.length-2;i>=0;i--){
      if(i%2)f.wheel(-1);else $('[data-daily-back]').click();
      assert.equal(f.prompt(),ids[i+1]);assert.equal(h.animations.at(-1).frames.at(-1).translate,'0 8px');
      await h.phase();assert.equal(f.prompt(),ids[i]);assert.equal(h.animations.at(-1).frames[0].translate,'0 -16px');await h.phase();
    }
    assert.equal(f.state.dirty,false);assert.deepEqual(f.writes,[]);
  }
});

test('animated six-flow navigation validates synchronously and preserves typed values on next and back',async()=>{
  for(const type of types){
    const f=fixture(type);f.start();const id=type==='daily'?'today':f.prompts()[0].id;f.show(id);
    const input=id==='recordTitle'?$('#record-title'):$(`[data-answer="${id}"]`),h=animationHarness(f.canvas);
    f.wheel();assert.equal(f.prompt(),id);assert.equal(h.animations.length,0);assert.equal(input.getAttribute('aria-invalid'),'true');assert.equal(document.activeElement,input);
    const value='一段需要保留的长内容\n'.repeat(40);input.value=value;input.dispatchEvent(new win.Event('input',{bubbles:true}));
    $('[data-daily-next]').click();assert.equal(f.prompt(),id);assert.equal($('.daily-editor-content').hasAttribute('inert'),true);
    await h.phase();assert.notEqual(f.prompt(),id);assert.equal($('.daily-editor-content').hasAttribute('inert'),false);await h.phase();
    f.wheel(-1);await h.phase();await h.phase();assert.equal(f.prompt(),id);
    assert.equal(id==='recordTitle'?$('#record-title'):$(`[data-answer="${id}"]`),input);assert.equal(input.value,value);assert.equal(type==='decision'?f.current.title:f.current.data.answers[id][0],value);assert.equal(f.state.dirty,true);assert.deepEqual(f.writes,[]);
  }
});

test('real route, save and modal entry cancel outgoing and incoming presentation without a late question switch',async()=>{
  for(const phase of ['out','in'])for(const action of ['route','save','modal','show']){
    const f=fixture('weekly',true);f.start();const ids=f.prompts().map(prompt=>prompt.id),h=animationHarness(f.canvas),copy=$('.daily-editor-content');
    $('[data-daily-next]').click();if(phase==='in')await h.phase();const accepted=f.prompt();
    if(action==='route')f.replace();else if(action==='save')f.busy(true);else if(action==='modal')f.modal();else f.show(ids[0]);
    await h.flush();assert.equal(f.canvas.reviewTransition.busy,false);assert.equal(copy.hasAttribute('inert'),false);assert.equal(h.animations.some(animation=>animation.pending),false);
    assert.equal(f.prompt(),action==='show'?ids[0]:accepted);assert.deepEqual(f.writes,[]);
    if(action==='modal'){assert.ok($('.modal'));f.closeModal(true)}
    if(action==='save')f.busy(false);
  }
});

test('delayed six-flow switch rejects replaced owners or saving that starts during fade-out',async()=>{
  for(const type of types)for(const change of ['account','record','editor','saving']){
    const f=fixture(type,true);f.start();const accepted=f.prompt(),h=animationHarness(f.canvas),copy=$('.daily-editor-content');$('[data-daily-next]').click();
    if(change==='account')f.state.user={id:'replacement'};
    else if(change==='record')f.state.current={...f.current};
    else if(change==='editor')$('#daily-editor').id='replaced-editor';
    else f.state.saving=true;
    await h.phase();assert.equal(f.prompt(),accepted);assert.equal(h.animations.length,2);assert.equal(f.canvas.reviewTransition.busy,false);assert.equal(copy.hasAttribute('inert'),false);assert.deepEqual(f.writes,[]);
  }
});

test('account and system reduced motion keep both real button and wheel navigation immediate',()=>{
  const oldMatchMedia=win.matchMedia;
  try{for(const preference of ['account','system'])for(const type of types){
    win.matchMedia=()=>({matches:preference==='system'});const f=fixture(type,true),h=animationHarness(f.canvas);f.state.theme.reduceMotion=preference==='account';f.start();
    const ids=f.prompts().map(prompt=>prompt.id);assert.equal(f.prompt(),ids[0]);$('[data-daily-next]').click();assert.equal(f.prompt(),ids[1]);f.wheel(-1);assert.equal(f.prompt(),ids[0]);assert.equal(h.animations.length,0);assert.deepEqual(f.writes,[]);
  }}finally{win.matchMedia=oldMatchMedia}
});

test('daily expense step uses the real widget, holds unconfirmed input and creates one shared ledger entry',async()=>{
  const f=fixture('daily',false,{financeEnabled:true});
  for(let i=0;i<12;i++)await Promise.resolve();
  f.start();$('[data-daily-next]').click();assert.equal(f.prompt(),'energy');f.wheel();assert.equal(f.prompt(),'finance');
  assert.equal(f.canvas.dataset.dailyScene,'finance');
  const amount=$('#daily-finance [name="text"]');
  assert.ok(amount);amount.value='8+8+8-1 早餐';amount.dispatchEvent(new win.Event('input',{bubbles:true}));
  assert.equal(f.state.current.data.financeDraft.text,'8+8+8-1 早餐');
  $('[data-daily-next]').click();assert.equal(f.prompt(),'finance');assert.equal(amount.getAttribute('aria-invalid'),'true');
  assert.equal(f.financeCalls.filter(call=>call.method==='POST').length,0);
  f.collect();assert.equal(f.state.current.data.templateSnapshot.review.financeEnabled,true);assert.equal(f.state.current.data.financeDraft.text,'8+8+8-1 早餐');
  const form=amount.closest('form');form.dispatchEvent(new win.Event('submit',{bubbles:true,cancelable:true}));
  for(let i=0;i<30;i++)await Promise.resolve();
  assert.equal(f.financeEntries.length,0);const files=$('[data-finance-files]');Object.defineProperty(files,'files',{configurable:true,value:[{name:'test.png',type:'image/png'}]});files.dispatchEvent(new win.Event('change',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,25));const matching=$('#finance-match-form');assert.ok(matching);matching.dispatchEvent(new win.Event('submit',{bubbles:true,cancelable:true}));await new Promise(resolve=>setTimeout(resolve,25));
  assert.equal(f.financeEntries.length,1);assert.equal(f.financeEntries[0].amountCents,2300);assert.equal(f.financeEntries[0].categoryId,'food');
  assert.equal(f.state.current.data.financeDraft.text,'');assert.equal(f.state.dirty,true);assert.equal(f.state.saving,false);
  assert.equal($('#daily-finance [name="text"]'),amount);$('[data-daily-next]').click();assert.notEqual(f.prompt(),'finance');
  f.wheel(-1);assert.equal(f.prompt(),'finance');assert.equal(f.financeEntries.length,1);assert.equal($('#daily-finance [name="text"]'),amount);
});

test.afterEach(()=>{$('#daily-finance')?.financeController?.dispose();$('.daily-flow')?.reviewTransition?.cancel();ui.dismissDialog($('#modal-root'));ui.disposeUi($('#app'));$('#app').replaceChildren()});
test.after(()=>dom.window.close());
