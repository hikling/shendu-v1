import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {reviewQuestions,reviewDisabledFields} from '../public/review-schema.js';
import {normalizeReviewMetricIds} from '../public/review-metrics.js';

const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
function owner(name){
  const match=new RegExp(`(?:^|\\n)((?:async )?function ${name}\\()`).exec(source);assert.ok(match,name);
  const start=match.index+(source[match.index]==='\n'?1:0),next=/\n(?:async )?function /.exec(source.slice(start+1));
  return source.slice(start,next?start+1+next.index:source.length).split('\ndocument.addEventListener')[0];
}
const types=source.slice(source.indexOf('const TYPES ='),source.indexOf('const TYPE_ICONS ='));
const icons=source.match(/const TYPE_ICONS = [^\n]+/)[0];
const defaults=source.slice(source.indexOf('const QUESTIONS ='),source.indexOf('function mergeReviewTemplate('));
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(requestImpl=async body=>body){
  const dom=new JSDOM('<div id="app"></div><div id="modal-root"></div>'),document=dom.window.document;
  const $=(selector,root=document)=>root.querySelector(selector),$$=(selector,root=document)=>[...root.querySelectorAll(selector)];
  const calls=[],notices=[],navigated=[],reviews=[],calendar=[];
  const state={user:{id:'self'},route:'stage-settings',settingsReturn:'calendar',stage:{name:'稳住底盘',startDate:'2026-11-01',days:90,focus:'留出专注的时间',sleepTarget:7,energyTarget:60,showQuarter:true,metrics:[{name:'阅读',target:'二十分钟'},{name:'运动',target:'散步'},{name:'输出',target:'写一段'}],actionTemplate:{pageTitle:'自己的验证',customLegacy:'retain'}},records:[{id:'daily-record',type:'daily',period:'2026-11-04',status:'draft',data:{}},{id:'pending-record',type:'weekly',period:'2026-W44',status:'completed',data:{action:'看一次结果',verifyDate:'2026-11-10'}}],stats:{week:3,pending:1,total:8},dirty:false,saving:false};
  const shell=html=>{$('#app').innerHTML=`<main>${html}</main>`};
  const request=async(path,options)=>{calls.push({path,...options});return requestImpl(options.body)};
  const openModal=html=>{$('#modal-root').innerHTML=html;$$('[data-close]',$('#modal-root')).forEach(button=>button.addEventListener('click',()=>{$('#modal-root').replaceChildren()}))};
  const names=['mergeReviewTemplate','mergeActionTemplate','currentActionTemplate','statsHtml','renderCalendar','bindCalendar','openSettingsTarget','openStage','renderStageSettings','bindStageSettings','reviewTemplateEditor','templateQuestionRow','templateQuestionsEditor','stageMetricRow','stageMetricEditor','readTemplateQuestions','actionTemplateEditor','resetTemplateInputs','attemptNavigate','saveShortcut'];
  const page=new Function('state','document','$','$$','shell','spacePageHead','workspaceArt','esc','clone','request','FormData','toast','navigate','openModal','closeModal','stageProgress','formatDate','today','STATUS','showStageCalendar','enterReview','defaultPeriod','saveCurrent','reviewQuestions','reviewDisabledFields','renderMarkup','Event','crypto','normalizeReviewMetricIds',`${types}\n${icons}\n${defaults}\n${names.map(owner).join('\n')}\nreturn {renderCalendar,bindCalendar,openSettingsTarget,openStage,renderStageSettings,attemptNavigate,saveShortcut};`)(state,document,$,$$,shell,(key,{title,description,action=''})=>`<header><h1 id="workspace-${key}-title">${title}</h1><p>${description}</p>${action}</header>`,()=>'',escape,value=>JSON.parse(JSON.stringify(value)),request,dom.window.FormData,(...args)=>notices.push(args),route=>navigated.push(route),openModal,()=>$('#modal-root').replaceChildren(),()=>({day:5,days:90,pct:5}),value=>value,()=> '2026-11-05',{draft:'草稿'},(node,options)=>calendar.push({node,options}),(...args)=>reviews.push(args),()=> '2026-11-05',async()=>calls.push('shortcut-save'),reviewQuestions,reviewDisabledFields,(container,html)=>{container.innerHTML=html},dom.window.Event,dom.window.crypto,normalizeReviewMetricIds);
  return {dom,document,$,$$,state,calls,notices,navigated,reviews,calendar,...page,submit(){ $('#stage-form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})) }};
}

test('calendar is an ordinary workspace with one shared summary and preserves date/record navigation',()=>{
  const f=fixture();f.state.route='calendar';f.renderCalendar();
  assert.ok(f.$('main .workspace-calendar'));assert.equal(f.$('[role="dialog"],#right-rail'),null);
  assert.equal(f.$$('.stage-summary').length,1);assert.ok(f.$('#calendar-current-title'));assert.ok(f.$('[data-open-action="pending-record"]'));
  const {node,options}=f.calendar[0];assert.equal(node,f.$('#stage-calendar'));assert.equal(options.records.length,1);
  options.onMonthChange('2027-01');assert.equal(f.state.calendarMonth,'2027-01');assert.equal(f.reviews.length,0);
  options.onSelect('2026-11-04',f.state.records[0]);assert.deepEqual(f.reviews[0],['daily','2026-11-04',false,f.state.records[0]]);
  options.onSelect('2026-11-05');assert.deepEqual(f.reviews[1],['daily','2026-11-05']);
  f.$('#calendar-edit-stage').click();assert.equal(f.state.settingsReturn,'calendar');assert.equal(f.navigated.at(-1),'stage-settings');f.dom.window.close();
});

test('settings entry points retain the unsaved guard instead of opening another settings overlay',()=>{
  const f=fixture();f.state.dirty=true;f.openSettingsTarget('stage');assert.equal(f.navigated.length,0);
  assert.ok(f.$('#discard-change'));f.$('[data-close]').click();assert.equal(f.state.dirty,true);assert.equal(f.navigated.length,0);
  f.openSettingsTarget('stage');f.$('#discard-change').click();assert.equal(f.state.settingsReturn,'settings');assert.equal(f.state.dirty,false);assert.equal(f.navigated.at(-1),'stage-settings');
  f.openSettingsTarget('account');assert.equal(f.navigated.at(-1),'users');f.openSettingsTarget('guide');assert.equal(f.navigated.at(-1),'guide');f.dom.window.close();
});

test('stage settings retain all saved fields and template keys, validate, save once and return to the calendar',async()=>{
  let finish;const f=fixture(body=>new Promise(resolve=>{finish=()=>resolve(body)}));f.renderStageSettings();
  const form=f.$('#stage-form');assert.ok(form.closest('main'));assert.equal(f.$('[role="dialog"]'),null);
  assert.equal(f.$$('[data-review-template]').length,49);assert.equal(f.$$('[data-action-template]').length,4);
  const focus=form.elements.focus;focus.value='';f.submit();assert.equal(f.calls.length,0,'native required fields still block submission');
  focus.value='更新后的方向';focus.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));assert.equal(f.state.dirty,true);
  f.submit();f.submit();assert.equal(f.calls.length,1);assert.equal(f.state.saving,true);assert.equal(form.querySelector('fieldset').disabled,true);
  const saved=f.calls[0];assert.equal(saved.path,'/api/settings');assert.equal(saved.method,'PUT');assert.equal(saved.body.stage.focus,'更新后的方向');assert.equal(saved.body.stage.showQuarter,true);assert.equal(saved.body.stage.metrics.length,3);assert.equal(saved.body.stage.actionTemplate.pageTitle,'自己的验证');assert.equal(saved.body.stage.actionTemplate.customLegacy,'retain');assert.equal(Object.keys(saved.body.stage.reviewTemplates).length,6);
  f.attemptNavigate(()=>f.navigated.push('blocked'));assert.equal(f.navigated.length,0);
  finish();await settle();assert.equal(f.state.stage.focus,'更新后的方向');assert.equal(f.state.dirty,false);assert.equal(f.state.saving,false);assert.equal(f.navigated.at(-1),'calendar');f.dom.window.close();
});

test('stage cancellation and reset keep dirty input protected; failed save retains it for retry',async()=>{
  let attempt=0;const f=fixture(async body=>{if(++attempt===1)throw new Error('暂时断线');return body});f.renderStageSettings();
  const form=f.$('#stage-form'),focus=form.elements.focus;focus.value='不能丢失的修改';focus.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));
  f.$('#stage-settings-cancel').click();assert.equal(f.navigated.length,0);f.$('[data-close]').click();assert.equal(form.elements.focus.value,'不能丢失的修改');
  f.$('[data-reset-review="weekly"]').click();assert.equal(f.state.dirty,true);
  f.submit();await settle();assert.equal(f.state.saving,false);assert.equal(f.state.dirty,true);assert.equal(f.$('#stage-form'),form);assert.equal(focus.value,'不能丢失的修改');assert.equal(form.querySelector('fieldset').disabled,false);assert.equal(f.notices.at(-1)[0],'暂时断线');
  f.submit();await settle();assert.equal(f.calls.length,2);assert.equal(f.state.dirty,false);assert.equal(f.navigated.at(-1),'calendar');f.dom.window.close();
});

test('obsolete stage completion cannot overwrite a new account or release a newer write owner',async()=>{
  let finish;const f=fixture(body=>new Promise(resolve=>{finish=()=>resolve(body)}));f.renderStageSettings();f.submit();
  const original=f.state.stage,newOwner={};f.state.user={id:'other'};f.state.settingsWriteOwner=newOwner;f.state.saving=true;
  finish();await settle();assert.equal(f.state.stage,original);assert.equal(f.state.saving,true);assert.equal(f.state.settingsWriteOwner,newOwner);assert.equal(f.navigated.length,0);f.dom.window.close();
});

test('save shortcut ignores a stale review record on workspace pages and still saves a real review',()=>{
  const f=fixture();f.state.current={type:'daily',period:'2026-11-05',status:'draft'};let prevented=0;
  const key={ctrlKey:true,key:'s',preventDefault(){prevented++}};
  for(const route of ['settings','calendar','stage-settings','guide','users','history']){f.state.route=route;f.saveShortcut(key)}
  assert.equal(prevented,0);assert.equal(f.calls.length,0);f.state.route='daily';f.saveShortcut(key);assert.equal(prevented,1);assert.deepEqual(f.calls,['shortcut-save']);f.dom.window.close();
});

test('all six template editors add custom required questions, remove and restore defaults, and save their exact configuration',async()=>{
  const f=fixture();f.renderStageSettings();
  const expected=new Map();
  for(const type of ['daily','weekly','monthly','quarterly','yearly','decision']){
    const panel=f.$(`[data-template-type="${type}"]`),defaults=reviewQuestions(type),first=defaults[0];
    const core=f.$('[data-template-key="actionTitle"]',panel);core.value=`${type} 的行动标题`;
    f.$(`[data-template-question="${first.id}"] [data-remove-question]`,panel).click();
    assert.equal(f.$(`[data-template-question="${first.id}"]`,panel),null);
    assert.ok(f.$(`[data-restore-question="${first.id}"]`,panel));assert.equal(f.state.dirty,true);
    f.$(`[data-restore-question="${first.id}"]`,panel).click();
    const restored=f.$(`[data-template-question="${first.id}"]`,panel);
    assert.equal(f.$('[data-review-template]',restored).value,first.label);
    assert.equal(f.$('[data-question-required]',restored).checked,first.required);
    f.$('[data-add-question]',panel).click();
    const custom=f.$$('[data-template-question]',panel).at(-1),input=f.$('[data-review-template]',custom);
    assert.match(custom.dataset.templateQuestion,/^custom_[a-f0-9]+$/);
    assert.equal(input.value,'');assert.equal(f.document.activeElement,input,'new blank question is ready to name');
    f.submit();assert.equal(f.calls.length,0,'an unnamed custom question cannot silently disappear from a save');
    input.value=`${type} <自己的问题> & 细节`;
    input.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));
    f.$('[data-question-required]',custom).click();
    expected.set(type,{id:custom.dataset.templateQuestion,label:input.value,required:true});
    // A second insert/redraw must preserve the edited first question and its required flag.
    f.$('[data-add-question]',panel).click();
    const blank=f.$$('[data-template-question]',panel).at(-1);f.$('[data-remove-question]',blank).click();
    const retained=f.$(`[data-template-question="${custom.dataset.templateQuestion}"]`,panel);
    assert.equal(f.$('[data-review-template]',retained).value,input.value);
    assert.equal(f.$('[data-question-required]',retained).checked,true);
    assert.equal(core.value,`${type} 的行动标题`,'question mutations do not rebuild unrelated inputs');
    assert.equal(f.$('script',panel),null);
  }
  f.submit();await settle();assert.equal(f.calls.length,1);
  for(const [type,question] of expected){
    const template=f.calls[0].body.stage.reviewTemplates[type];
    assert.deepEqual(template.questions.at(-1),question);
    assert.equal(template.questions.length,reviewQuestions(type).length+1);
    assert.equal(template.actionTitle,`${type} 的行动标题`);
  }
  assert.equal(f.state.dirty,false);assert.equal(f.navigated.at(-1),'calendar');f.dom.window.close();
});

test('all ordinary questions can be removed while core fields remain and daily optional records can be restored',async()=>{
  const f=fixture();f.renderStageSettings();const panel=f.$('[data-template-type="daily"]');
  while(f.$('[data-remove-question]',panel))f.$('[data-remove-question]',panel).click();
  assert.equal(f.$$('[data-template-question]',panel).length,0);assert.match(panel.textContent,/还没有普通问题/);
  for(const checkbox of f.$$('[data-include-field]',panel))checkbox.click();
  assert.ok(f.$('[data-template-key="actionTitle"]',panel));assert.ok(f.$('[data-template-key="obstacleTitle"]',panel));assert.ok(f.$('[data-template-key="verifyDateTitle"]',panel));
  f.submit();await settle();assert.equal(f.calls.length,1);
  assert.deepEqual(f.calls[0].body.stage.reviewTemplates.daily.questions,[]);
  assert.deepEqual(f.calls[0].body.stage.reviewTemplates.daily.disabledFields,['sleep','energy','risk','journal']);
  // Revisit the saved empty configuration, then reset the actual controls.
  f.renderStageSettings();const reloaded=f.$('[data-template-type="daily"]');
  assert.equal(f.$$('[data-template-question]',reloaded).length,0);
  assert.ok(f.$$('[data-include-field]',reloaded).every(input=>!input.checked));
  f.$('[data-reset-review="daily"]').click();
  assert.equal(f.$$('[data-template-question]',reloaded).length,reviewQuestions('daily').length);
  assert.ok(f.$$('[data-include-field]',reloaded).every(input=>input.checked));
  assert.equal(f.state.dirty,true);f.submit();await settle();
  assert.deepEqual(f.calls[1].body.stage.reviewTemplates.daily.disabledFields,[]);f.dom.window.close();
});

test('stage indicators support zero entries, preserve edits during add/remove, and persist failure inputs for retry',async()=>{
  let attempts=0;const f=fixture(async body=>{if(++attempts===1)throw new Error('暂时断线');return body});f.renderStageSettings();
  const focus=f.$('[name="focus"]');focus.value='指标增删时仍保留';focus.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));
  f.$('[data-metric-name]').value='已改的指标';f.$('[data-add-metric]').click();
  assert.equal(f.$$('[data-stage-metric]').length,4);assert.equal(f.$('[data-metric-name]').value,'已改的指标');
  assert.equal(f.document.activeElement,f.$$('[data-metric-name]').at(-1));
  f.submit();assert.equal(f.calls.length,0,'new indicator name and target remain required');
  while(f.$('[data-remove-metric]'))f.$('[data-remove-metric]').click();
  assert.equal(f.$$('[data-stage-metric]').length,0);assert.equal(f.document.activeElement,f.$('[data-add-metric]'));
  f.submit();await settle();assert.deepEqual(f.calls[0].body.stage.metrics,[]);
  assert.equal(f.state.dirty,true);assert.equal(f.state.saving,false);assert.equal(f.$('[name="focus"]'),focus);assert.equal(focus.value,'指标增删时仍保留');
  assert.equal(f.$$('[data-stage-metric]').length,0);
  f.submit();await settle();assert.equal(f.calls.length,2);assert.deepEqual(f.state.stage.metrics,[]);assert.equal(f.state.dirty,false);f.dom.window.close();
});

test('template and indicator limits are exposed in the UI and delegated mutations cannot run during a pending save',async()=>{
  let finish;const f=fixture(body=>new Promise(resolve=>{finish=()=>resolve(body)}));
  f.state.stage.reviewTemplates={weekly:{questions:Array.from({length:30},(_,index)=>({id:`custom_${index}`,label:`问题 ${index}`,required:false}))}};
  f.state.stage.metrics=Array.from({length:12},(_,index)=>({name:`指标 ${index}`,target:'做一小步'}));f.renderStageSettings();
  const panel=f.$('[data-template-type="weekly"]');
  assert.equal(f.$('[data-add-question]',panel).disabled,true);assert.equal(f.$('[data-restore-question]',panel).disabled,true);assert.equal(f.$('[data-add-metric]').disabled,true);
  f.$('[data-remove-question]',panel).click();f.$('[data-remove-metric]').click();
  assert.equal(f.$('[data-add-question]',panel).disabled,false);assert.equal(f.$('[data-add-metric]').disabled,false);
  f.submit();assert.equal(f.state.saving,true);assert.equal(f.calls.length,1);
  const questionCount=f.$$('[data-template-question]',panel).length,metricCount=f.$$('[data-stage-metric]').length;
  for(const button of [f.$('[data-remove-question]',panel),f.$('[data-add-question]',panel),f.$('[data-reset-review]',panel),f.$('[data-remove-metric]'),f.$('[data-add-metric]')])button.dispatchEvent(new f.dom.window.MouseEvent('click',{bubbles:true}));
  assert.equal(f.$$('[data-template-question]',panel).length,questionCount);assert.equal(f.$$('[data-stage-metric]').length,metricCount);assert.equal(f.calls.length,1);
  finish();await settle();assert.equal(f.state.saving,false);f.dom.window.close();
});
