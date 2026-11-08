import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {DAILY_STEPS,dailyPrompts} from '../public/daily-flow.js';
import {EXTENDED_FLOW,extendedPrompts} from '../public/extended-flow.js';
import {reviewQuestions} from '../public/review-schema.js';
import {reviewIntroLayout} from '../public/review-intros.js';

const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
function owner(name){
  const match=new RegExp(`(?:^|\\n)((?:async )?function ${name}\\()`).exec(source);assert.ok(match,name);
  const start=match.index+(source[match.index]==='\n'?1:0),next=/\n(?:async )?function /.exec(source.slice(start+1));
  return source.slice(start,next?start+1+next.index:source.length).split('\ndocument.addEventListener')[0];
}
const constants=source.slice(source.indexOf('const TYPES ='),source.indexOf('const TYPE_ICONS ='))+'\n'+source.slice(source.indexOf('const QUESTIONS ='),source.indexOf('function mergeReviewTemplate('));
const functions=['dailyAnswerPreview','answerItemRow','answerAddButton','dailyAnswerInputs','gaugePresentation','gaugeCard','dailyEvidence','dailyReflection','dailyActionFields','dailyJournal','reviewAfterword','dailySceneArt','dailyReviewHtml','extendedSceneArt','extendedPromptCopy','extendedPromptHtml','extendedReviewHtml','verificationRead'];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const content='完整正文 <不是HTML> & 保留原值';
function fixture(type,status,review={}){
  const data={answers:Object.fromEntries(reviewQuestions(type,review).map(question=>[question.id,[content]])),metrics:[],journal:content,action:content,ifCondition:content,ifThen:content,verifyDate:'2026-12-01'};
  const state={user:{displayName:'测试'},stage:{sleepTarget:7,energyTarget:70},current:{id:'record',type,status,title:content,data,verification:{result:content,adjustment:content}}};
  let templates;
  const context={state,esc,DAILY_STEPS,dailyPrompts,EXTENDED_FLOW,extendedPrompts,reviewQuestions,reviewIntroLayout,STATUS:{draft:'草稿',completed:'已完成',verified:'已验证'},defaultPeriod:()=> 'current',quoteFor:()=> '回看事实，慢慢向前。',formatDate:value=>value,beijingTime:()=> '12:00',today:()=> '2026-11-08',verificationMinimum:()=> '2026-11-08',dailyCalendarDateLabel:value=>value,templatesForRecord:()=>templates,verificationTimes:()=> '<div class="verification-times"></div>',dailyVerificationCalendar:(value,locked,label)=>`<div aria-label="${esc(label)}"><input type="hidden" data-simple="verifyDate" value="${esc(value)}" ${locked?'disabled':''}></div>`};
  const pages=new Function(...Object.keys(context),`${constants}\n${functions.map(owner).join('\n')}\nreturn {dailyReviewHtml,extendedReviewHtml,review:DEFAULT_REVIEW_TEMPLATES,action:DEFAULT_ACTION_TEMPLATE};`)(...Object.values(context));
  templates={review:{...pages.review[type],...review},action:pages.action};
  const html=type==='daily'?pages.dailyReviewHtml('current',status!=='draft',data,templates):pages.extendedReviewHtml(type,'current',status!=='draft',data,templates);
  const dom=new JSDOM(html);
  return{dom,document:dom.window.document,data,templates};
}
function assertContained(document,attribute,expectedPane){
  const afterwords=document.querySelectorAll(`[${attribute}]`);assert.equal(afterwords.length,1);
  const afterword=afterwords[0],pane=afterword.closest('.daily-pane');
  assert.ok(pane,'completion content must inherit the bounded writing column');
  assert.equal(pane.dataset.dailyPane,expectedPane);
  assert.equal(afterword.parentElement,pane);
  assert.equal(document.querySelector('.daily-editor-content > .daily-afterword'),null,'an editor-wide sibling recreates the illustration overlap');
  return afterword;
}

test('daily completed and verified afterwords stay inside the actual last writing pane, including no-journal templates',()=>{
  for(const status of ['completed','verified'])for(const review of [{},{disabledFields:['journal']},{questions:[],disabledFields:['sleep','energy','risk','journal']}]){
    const f=fixture('daily',status,review),last=dailyPrompts(0,f.templates.review).at(-1),afterword=assertContained(f.document,'data-review-afterword',last.step);
    assert.equal(f.document.querySelector('[data-simple="journal"]').value,content,'rendering completion retains the original diary value');
    assert.equal(f.document.querySelector('[data-simple="action"]').value,content);
    assert.equal(f.document.querySelector('[data-simple="journal"]').readOnly,true);
    if(status==='completed'){
      assert.deepEqual([...afterword.querySelectorAll('[data-nav]')].map(button=>button.dataset.nav),['history','actions']);
      assert.equal(afterword.querySelectorAll('.review-completion').length,1);
    }else{
      assert.equal(afterword.querySelector('.review-completion'),null);
      assert.equal(afterword.querySelectorAll('.verification-result-card').length,1);
      assert.ok(afterword.textContent.includes(content),'verified content remains complete escaped text');
      assert.equal(afterword.querySelector('不是HTML'),null);
    }
    f.dom.window.close();
  }
});

test('draft daily reviews do not display completion navigation when the diary is present or removed',()=>{
  for(const review of [{},{disabledFields:['journal']}]){
    const f=fixture('daily','draft',review),last=dailyPrompts(0,f.templates.review).at(-1),afterword=assertContained(f.document,'data-review-afterword',last.step);
    assert.equal(afterword.querySelector('[data-nav]'),null);assert.equal(afterword.textContent,'');
    assert.equal(f.document.querySelector('[data-simple="journal"]').value,content);
    assert.equal(f.document.querySelector('[data-simple="journal"]').readOnly,false);f.dom.window.close();
  }
});

test('all five extended flows keep completion and verification content within the final bounded pane',()=>{
  for(const type of Object.keys(EXTENDED_FLOW))for(const status of ['draft','completed','verified']){
    const f=fixture(type,status),afterword=assertContained(f.document,'data-extended-afterword',EXTENDED_FLOW[type].stages.at(-1).id);
    assert.equal(f.document.querySelector('[data-simple="action"]').value,content);
    assert.equal(f.document.querySelector('[data-simple="ifThen"]').value,content);
    if(status==='draft')assert.equal(afterword.textContent,'');
    else if(status==='completed')assert.deepEqual([...afterword.querySelectorAll('[data-nav]')].map(button=>button.dataset.nav),['history','actions']);
    else assert.equal(afterword.querySelectorAll('.verification-result-card').length,1);
    f.dom.window.close();
  }
});
