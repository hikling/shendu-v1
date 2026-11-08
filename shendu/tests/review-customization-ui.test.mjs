import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {reviewQuestions,reviewDisabledFields} from '../public/review-schema.js';
import {normalizeReviewMetricIds,reconcileReviewMetrics} from '../public/review-metrics.js';

// Exercise the real bridge, not innerHTML stubs: template mutations replace only
// their owned region while React checkboxes preserve the native form contract.
const dom=new JSDOM('<!doctype html><html><body><div id="app"></div><div id="modal-root"></div></body></html>',{url:'http://localhost/',pretendToBeVisual:true});
for(const name of ['window','document','HTMLElement','HTMLInputElement','HTMLButtonElement','HTMLFormElement','Node','Event','CustomEvent','MutationObserver','getComputedStyle'])Object.defineProperty(globalThis,name,{value:name==='getComputedStyle'?dom.window.getComputedStyle.bind(dom.window):dom.window[name],configurable:true});
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
globalThis.ResizeObserver=class{observe(){} unobserve(){} disconnect(){}};
globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window);
const {renderMarkup,disposeUi}=await import('../public/ui/shadcn.js');
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
function owner(name){const match=new RegExp(`(?:^|\\n)((?:async )?function ${name}\\()`).exec(source);assert.ok(match,name);const start=match.index+(source[match.index]==='\n'?1:0),next=/\n(?:async )?function /.exec(source.slice(start+1));return source.slice(start,next?start+1+next.index:source.length).split('\ndocument.addEventListener')[0]}
const types=source.slice(source.indexOf('const TYPES ='),source.indexOf('const TYPE_ICONS ='));
const icons=source.match(/const TYPE_ICONS = [^\n]+/)[0];
const defaults=source.slice(source.indexOf('const QUESTIONS ='),source.indexOf('function mergeReviewTemplate('));
const promptFields=source.slice(source.indexOf('const ACTION_PROMPT_FIELDS ='),source.indexOf('function templateQuestionRow('));
const names=['mergeReviewTemplate','mergeActionTemplate','renderStageSettings','bindStageSettings','reviewTemplateEditor','templateQuestionRow','templateQuestionsEditor','stageMetricRow','stageMetricEditor','readTemplateQuestions','actionTemplateEditor','resetTemplateInputs'];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const $=(selector,root=document)=>root.querySelector(selector),$$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
  disposeUi($('#app'));$('#app').replaceChildren();
  const state={user:{id:'self'},route:'stage-settings',settingsReturn:'calendar',stage:{name:'稳住底盘',startDate:'2026-11-08',days:90,focus:'原阶段方向',sleepTarget:7,energyTarget:70,metrics:[{name:'旧指标',target:'保留达标线'}]},dirty:false,saving:false};
  const calls=[];
  const page=new Function('state','document','$','$$','shell','spacePageHead','esc','clone','request','FormData','toast','navigate','attemptNavigate','reviewQuestions','reviewDisabledFields','renderMarkup','Event','crypto','normalizeReviewMetricIds',`${types}\n${icons}\n${defaults}\n${promptFields}\n${names.map(owner).join('\n')}\nreturn {renderStageSettings};`)(state,document,$,$$,html=>renderMarkup($('#app'),`<main>${html}</main>`),(_,{title,description,action=''})=>`<header><h1>${title}</h1><p>${description}</p>${action}</header>`,esc,value=>structuredClone(value),async(path,options)=>{calls.push({path,...options});return options.body},dom.window.FormData,()=>{},()=>{},fn=>fn(),reviewQuestions,reviewDisabledFields,renderMarkup,dom.window.Event,dom.window.crypto,normalizeReviewMetricIds);
  page.renderStageSettings();return{state,calls,...page};
}
after(()=>{disposeUi($('#app'));dom.window.close()});

test('enhanced template checkboxes save exact required state through adding/removing and restore daily fields',async()=>{
  const f=fixture(),panel=$('[data-template-type="daily"]');
  const today=$('[data-template-question="today"]',panel),checkbox=$('[role="checkbox"]',today);
  assert.equal(checkbox.getAttribute('data-state'),'checked');checkbox.click();await settle();assert.equal($('[data-question-required]',today).checked,false);assert.equal(f.state.dirty,true);
  const sleep=$('[data-include-field="sleep"]',panel);sleep.closest('label').querySelector('[role="checkbox"]').click();await settle();assert.equal(sleep.checked,false);
  $('[data-add-question]',panel).click();await settle();
  const added=$$('[data-template-question]',panel).at(-1);assert.match(added.dataset.templateQuestion,/^custom_/);assert.equal(document.activeElement,$('[data-review-template]',added));
  $('[data-review-template]',added).value='自己的复盘问题';$('[role="checkbox"]',added).click();await settle();
  $('#stage-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await settle();
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].body.stage.reviewTemplates.daily.questions[0].required,false);assert.deepEqual(f.calls[0].body.stage.reviewTemplates.daily.questions.at(-1),{id:added.dataset.templateQuestion,label:'自己的复盘问题',required:true});assert.deepEqual(f.calls[0].body.stage.reviewTemplates.daily.disabledFields,['sleep']);
  f.renderStageSettings();const restoredPanel=$('[data-template-type="daily"]');$('[data-include-field="sleep"]',restoredPanel).closest('label').querySelector('[role="checkbox"]').click();await settle();
  // Reset updates the canonical native checkbox and the visible Radix state.
  $('[data-reset-review]',restoredPanel).click();await settle();const restored=$('[data-include-field="sleep"]',restoredPanel);assert.equal(restored.checked,true);assert.equal(restored.closest('label').querySelector('[role="checkbox"]').getAttribute('data-state'),'checked');
});

test('enhanced region replacement preserves unrelated typed values and makes empty custom question invalid',async()=>{
  const f=fixture(),form=$('#stage-form'),focus=$('[name="focus"]',form),metric=$('[data-metric-name]',form),panel=$('[data-template-type="weekly"]');
  focus.value='不能丢失的阶段方向';metric.value='不能丢失的指标名称';
  $('[data-add-question]',panel).click();await settle();const added=$$('[data-template-question]',panel).at(-1),input=$('[data-review-template]',added);
  assert.equal(input.value,'');assert.equal(form.checkValidity(),false);assert.equal(focus.value,'不能丢失的阶段方向');assert.equal($('[data-metric-name]',form),metric);
  form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await settle();assert.equal(f.calls.length,0);
  input.value='   ';form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await settle();assert.equal(f.calls.length,0);assert.equal(input.value,'','whitespace-only custom titles remain invalid rather than disappearing on save');
  $('[data-remove-question]',added).click();await settle();assert.equal(form.checkValidity(),true);assert.equal(focus.value,'不能丢失的阶段方向');assert.equal(metric.value,'不能丢失的指标名称');assert.equal(document.activeElement,$$('[data-review-template]',panel).find(el=>el.dataset.templateKey==='nextThree'));
});

test('locked review text keeps its full value and remains focusable for keyboard reading after enhancement',()=>{
  const long='这是需要滚动阅读的已锁定内容。'.repeat(200);
  const state={user:{displayName:'测试'},current:{type:'daily',status:'completed',title:long},stage:{sleepTarget:7,energyTarget:70}};
  const renderers=['dailyAnswerPreview','answerItemRow','answerAddButton','dailyAnswerInputs','dailyReflection','dailyActionFields','dailyJournal','dailyEvidence','extendedPromptCopy','extendedPromptHtml'];
  const pages=new Function('state','esc','reviewQuestions','gaugeCard','dailyVerificationCalendar',`${renderers.map(owner).join('\n')}\nreturn {dailyReflection,dailyActionFields,dailyJournal,dailyEvidence,extendedPromptHtml};`)(state,esc,reviewQuestions,()=>'',()=>'<div data-calendar></div>');
  const review={actionTitle:'行动',obstacleTitle:'应对',verifyDateTitle:'验证日期',recordTitle:'决定名称',questions:[{id:'custom_long',label:'自己的问题',required:false}]};
  const data={answers:{custom_long:[long,long]},action:long,ifCondition:long,ifThen:long,journal:long,risk:long,metrics:[{name:'指标',target:'目标',action:long,status:'已达标'}]};
  let html=pages.dailyReflection(data,true,review)+pages.dailyActionFields(data,true,review)+pages.dailyJournal(data,true)+pages.dailyEvidence(data,true);
  for(const kind of ['answer','action','ifThen','recordTitle'])html+=pages.extendedPromptHtml({id:kind==='answer'?'custom_long':kind,kind,label:'长内容',required:false},data,true,review);
  renderMarkup($('#app'),`<main class="daily-art-flow"><div class="daily-editor">${html}</div></main>`);
  $$('[hidden]',$('#app')).forEach(node=>node.hidden=false);
  const fields=$$('textarea',$('#app'));assert.ok(fields.length>=12);
  for(const field of fields){assert.equal(field.readOnly,true);assert.equal(field.disabled,false);assert.equal(field.value,long);field.focus();assert.equal(document.activeElement,field)}
  assert.equal($$('[data-add-item]',$('#app')).length,0);assert.ok($$('[data-remove-item]',$('#app')).every(button=>button.disabled));
  assert.ok($$('[data-metric-status]',$('#app')).every(select=>select.disabled));
});

test('all six current drafts follow settings while completed, verified and expired drafts retain their exact question snapshot',()=>{
  const state={stage:{reviewTemplates:{},actionTemplate:{resultPrompt:'当前验证问题'}}};
  const templateOwners=['mergeReviewTemplate','mergeActionTemplate','currentReviewTemplate','currentActionTemplate','templatesForRecord'];
  const api=new Function('state','reviewQuestions','reviewDisabledFields','defaultPeriod',`${defaults}\n${templateOwners.map(owner).join('\n')}\nreturn {templatesForRecord};`)(state,reviewQuestions,reviewDisabledFields,()=> 'current');
  for(const type of ['daily','weekly','monthly','quarterly','yearly','decision']){
    const current={questions:[{id:'custom_current',label:'当前新增问题',required:true}],disabledFields:['journal']},prior={questions:[{id:'custom_prior',label:'当时的问题',required:false}],disabledFields:[]};
    state.stage.reviewTemplates[type]=current;
    const record={type,period:'current',status:'draft',data:{answers:{custom_prior:['仍保留的旧答案']},templateSnapshot:{version:1,review:prior,action:{resultPrompt:'当时验证问题'}}}};
    assert.deepEqual(api.templatesForRecord(record).review.questions,current.questions);
    for(const status of ['completed','verified'])assert.deepEqual(api.templatesForRecord({...record,status}).review.questions,prior.questions);
    assert.deepEqual(api.templatesForRecord({...record,period:'expired'}).review.questions,prior.questions);
    assert.equal(api.templatesForRecord({...record,period:'expired'}).action.resultPrompt,'当时验证问题');assert.deepEqual(record.data.answers,{custom_prior:['仍保留的旧答案']});
    // Pre-customization snapshots lacking a questions key still show original labels.
    const oldLabel={...record,status:'completed',data:{templateSnapshot:{review:{[reviewQuestions(type)[0].id]:'旧标题'},action:{}}}};
    assert.equal(api.templatesForRecord(oldLabel).review.questions[0].label,'旧标题');
  }
});


test('stage metric identity survives edits and insertion in the real enhanced editor',async()=>{
  const f=fixture(),form=$('#stage-form'),original=$('[data-stage-metric]',form).dataset.stageMetric;
  $('[data-metric-name]',form).value='重命名的指标';$('[data-metric-target]',form).value='新的达标线';
  $('[data-add-metric]',form).click();await settle();
  const added=$$('[data-stage-metric]',form).at(-1);
  assert.match(added.dataset.stageMetric,/^metric_[a-f0-9]{32}$/);
  $('[data-metric-name]',added).value='新增指标';$('[data-metric-target]',added).value='半小时';
  form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await settle();
  assert.equal(f.calls[0].body.stage.metrics[0].id,original);assert.equal(f.calls[0].body.stage.metrics[0].name,'重命名的指标');
  assert.equal(f.calls[0].body.stage.metrics[1].id,added.dataset.stageMetric);
});

test('rendering current daily drafts reconciles changed metrics without modifying historical records or dropping answers',()=>{
  const first='metric_'+'a'.repeat(32),second='metric_'+'b'.repeat(32),third='metric_'+'c'.repeat(32);
  const state={stage:{metrics:[{id:first,name:'阅读改名',target:'四十分钟'},{id:third,name:'新指标',target:'三页'}]},records:[],current:null};
  const render=new Function('state','clone','defaultPeriod','newRecord','templatesForRecord','reconcileReviewMetrics','dailyReviewHtml','extendedReviewHtml','shell','bindReview',`${owner('renderReview')}\nreturn renderReview;`)(state,structuredClone,()=> 'current',()=>{throw new Error('existing record expected')},()=>({review:{},action:{}}),reconcileReviewMetrics,()=>'',()=>'',()=>{},()=>{});
  const data={metrics:[{id:first,name:'阅读',target:'二十分钟',action:'不能丢的阅读',status:'已达标'},{id:second,name:'运动',target:'半小时',action:'不能丢的运动',status:'部分达标'}]};
  const record={type:'daily',period:'current',status:'draft',data};render('daily','current',false,record);
  assert.deepEqual(state.current.data.metrics.map(metric=>[metric.id,metric.action]),[[first,'不能丢的阅读'],[third,'']]);
  assert.equal(state.current.data.archivedMetrics[0].action,'不能丢的运动');assert.equal(record.data.metrics.length,2);assert.equal(record.data.metrics[0].name,'阅读');
  for(const historical of [{...record,status:'completed'},{...record,status:'verified'},{...record,period:'past'}]){
    render('daily',historical.period,false,historical);assert.deepEqual(state.current.data,data);
  }
});
