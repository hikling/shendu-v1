import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {attachReviewWheel} from '../public/review-wheel.js';
import {DAILY_STEPS,dailyPrompts,dailyPromptOwner,dailyPromptIssues,dailyPromptNeighbor} from '../public/daily-flow.js';
import {EXTENDED_FLOW,extendedPrompts,extendedPromptIssues,extendedPromptNeighbor} from '../public/extended-flow.js';
import {reviewQuestions} from '../public/review-schema.js';
import {reviewIntroLayout,reviewIntroLines} from '../public/review-intros.js';

const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8'),html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const dom=new JSDOM(html,{url:'http://localhost',pretendToBeVisual:true}),win=dom.window;
for(const name of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement','HTMLSelectElement','HTMLButtonElement','HTMLFormElement','Element','Node','NodeFilter','Event','CustomEvent','KeyboardEvent','MouseEvent','MutationObserver','getComputedStyle','FormData'])globalThis[name]=win[name];
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
const names=['dailyAnswerPreview','answerItemRow','answerAddButton','dailyAnswerInputs','gaugePresentation','gaugeCard','dailyEvidence','dailyReflection','dailyActionFields','dailyJournal','reviewAfterword','dailySceneArt','dailyReviewHtml','extendedSceneArt','extendedPromptCopy','extendedPromptHtml','extendedReviewHtml','verificationRead','currentDailyPrompts','dailyPromptCopy','setReviewPromptHeading','setDailyPromptHeading','showDailyPrompt','showDailySection','clearDailyIssues','dailyIssueLabel','showDailyIssues','bindDailyFlow','currentExtendedPrompts','setExtendedPromptHeading','showExtendedPrompt','extendedIssueLabel','showExtendedIssues','bindExtendedFlow','bindReviewWheel','bindReview','openDailyAnswer','renderReview','collectCurrent'];
function fixture(type='daily',locked=false){
  ui.dismissDialog($('#modal-root'));ui.renderMarkup($('#app'),'');
  const period={daily:'2026-11-13',weekly:'2026-W46',monthly:'2026-11',quarterly:'2026-11-01',yearly:'2026',decision:'2026-11-13'}[type];
  const current={id:`${type}-record`,type,period,title:'',version:1,created_at:'2026-11-13T04:00:00.000Z',updated_at:'2026-11-13T04:00:00.000Z',status:locked?'completed':'draft',data:{answers:{},metrics:[],action:'',ifCondition:'',ifThen:'',verifyDate:'2027-12-31',journal:''}};
  const state={user:{id:'owner',displayName:'测试',username:'owner'},theme:{reviewWheelNavigation:true},stage:{sleepTarget:7,energyTarget:70,metrics:[]},current,records:[current],dirty:false,saving:false,route:type,dailySection:'intro',dailyPrompt:null,extendedPrompt:null};
  let functions,templates,time=0;const writes=[];
  const context={$,$$,state,esc,renderMarkup:ui.renderMarkup,shell:content=>ui.renderMarkup($('#app'),`<main class="main" id="main-content">${content}</main>`),attachReviewWheel:(root,options)=>attachReviewWheel(root,{...options,now:()=>time}),DAILY_STEPS,dailyPrompts,dailyPromptOwner,dailyPromptIssues,dailyPromptNeighbor,EXTENDED_FLOW,extendedPrompts,extendedPromptIssues,extendedPromptNeighbor,reviewQuestions,reviewIntroLayout,dailyIntroLines:reviewIntroLines,
    defaultPeriod:()=>period,today:()=> '2026-11-13',quoteFor:()=> '回看事实，慢慢向前。',beijingTime:()=> '12:00',verificationMinimum:()=> '2026-11-13',dailyCalendarDateLabel:value=>value,verificationTimes:()=>'',verificationActualAt:r=>r.verified_at||'',formatDate:value=>value,clone:structuredClone,
    templatesForRecord:()=>templates,currentTemplateSnapshot:()=>({review:templates.review,action:templates.action}),reconcileReviewMetrics:metrics=>({metrics}),newRecord:()=>{throw new Error('new record unexpected')},
    dailyVerificationCalendar:value=>`<input type="hidden" data-simple="verifyDate" value="${esc(value)}"><div id="daily-verification-calendar" data-verify-month-value="2026-11"></div>`,renderDailyCalendar:()=>{},bindDailyCalendar:()=>{},reviewNavigation:{exit:()=>{}},cancelDailyTypewriter:()=>{},startDailyTypewriter:()=>{},setDailyImmersive:()=>{},focusDailyAnswer:()=>{},updateGauge:()=>{},renderReviewFromCurrent:()=>{},saveCurrent:()=>writes.push('save'),completeCurrent:()=>writes.push('complete'),deleteDraftRecord:()=>writes.push('delete')};
  functions=new Function(...Object.keys(context),`${constants}\n${names.map(owner).join('\n')}\nreturn {renderReview,showDailyPrompt,showExtendedPrompt,currentDailyPrompts,currentExtendedPrompts,review:DEFAULT_REVIEW_TEMPLATES,action:DEFAULT_ACTION_TEMPLATE};`)(...Object.values(context));
  templates={review:functions.review[type],action:functions.action};functions.renderReview(type,period,false,current);
  const canvas=$('.daily-flow'),prompt=()=>type==='daily'?state.dailyPrompt:state.extendedPrompt,prompts=()=>type==='daily'?functions.currentDailyPrompts():functions.currentExtendedPrompts();
  const wheel=(direction=1,target=canvas,gap=800)=>{time+=gap;const event=new win.WheelEvent('wheel',{deltaY:direction*120,bubbles:true,cancelable:true});target.dispatchEvent(event);return event};
  const show=id=>type==='daily'?functions.showDailyPrompt(id):functions.showExtendedPrompt(id);
  return {state,current:state.current,canvas,prompt,prompts,wheel,show,writes,start:()=>$('#daily-start').click()};
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

test.afterEach(()=>{ui.dismissDialog($('#modal-root'));ui.disposeUi($('#app'));$('#app').replaceChildren()});
test.after(()=>dom.window.close());
