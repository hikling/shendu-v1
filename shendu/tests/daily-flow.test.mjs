import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyStepIssues,dailyPrompts,dailyPromptIssues,dailyPromptNeighbor} from '../public/daily-flow.js';

const today='2026-10-27';
const complete={answers:{today:['记录一件真实发生的事'],cause:[]},action:'明天先完成一页',ifCondition:'遇到手机消息',ifThen:'打开专注模式',verifyDate:today};

test('evidence and diary are optional even on an otherwise empty review',()=>{
  assert.deepEqual(dailyStepIssues({},'evidence',today),[]);
  assert.deepEqual(dailyStepIssues({},'journal',today),[]);
});
test('reflection needs one substantive fact but does not require a cause',()=>{
  assert.deepEqual(dailyStepIssues({answers:{today:[' ','\n']}},'reflection',today),[{step:'reflection',field:'today',reason:'required'}]);
  assert.deepEqual(dailyStepIssues({answers:{today:['','一件具体事实']}},'reflection',today),[]);
});
test('next-step validation checks only its own fields',()=>{
  assert.deepEqual(dailyStepIssues({answers:{today:['事实']}},'reflection',today),[]);
  const fields=dailyStepIssues({},'action',today).map(issue=>issue.field);
  assert.deepEqual(fields,['action','ifCondition','ifThen','verifyDate']);
});
test('final completion preserves all original daily requirements and their pane locations',()=>{
  const issues=dailyStepIssues({},null,today);
  assert.equal(issues[0].step,'reflection');
  assert.deepEqual(issues.map(issue=>issue.field),['today','action','ifCondition','ifThen','verifyDate']);
  assert.deepEqual(dailyStepIssues(complete,null,today),[],'sleep, energy, metrics, cause and journal stay optional');
});
test('verification date must be a real date and cannot be earlier than today',()=>{
  for(const verifyDate of ['','2026-10-26','2026-02-30','2026-13-01','not-a-date'])assert.deepEqual(dailyStepIssues({...complete,verifyDate},'action',today),[{step:'action',field:'verifyDate',reason:'date'}],verifyDate);
  for(const verifyDate of [today,'2026-10-28','2028-02-29'])assert.deepEqual(dailyStepIssues({...complete,verifyDate},'action',today),[],verifyDate);
});
test('validation is read-only and retains draft whitespace and optional content',()=>{
  const data={...complete,answers:{today:[' 事实 '],cause:['']},journal:'  私人日记  ',sleep:'',metrics:[]},snapshot=structuredClone(data);
  dailyStepIssues(data,null,today);
  assert.deepEqual(data,snapshot);
});
test('daily prompts show sleep and energy separately, then each metric and remaining questions',()=>{
  const prompts=dailyPrompts(3);
  assert.deepEqual(prompts.map(prompt=>prompt.id),['sleep','energy','metric-0','metric-1','metric-2','risk','today','cause','action','ifCondition','ifThen','verifyDate','journal']);
  assert.deepEqual(prompts.map(prompt=>prompt.step),['evidence','evidence','evidence','evidence','evidence','evidence','reflection','reflection','action','action','action','action','journal']);
});
test('historical metric counts determine the exact set of questions',()=>{
  for(const count of [0,1,2,5]){
    const prompts=dailyPrompts(count),metrics=prompts.filter(prompt=>prompt.id.startsWith('metric-'));
    assert.equal(metrics.length,count);
    assert.equal(prompts.length,10+count);
    assert.equal(prompts.at(-1).id,'journal');
  }
});
test('previous and next traverse every question and stop at the intro and final boundary',()=>{
  const prompts=dailyPrompts(3),visited=[];let current=prompts[0].id;
  while(current){visited.push(current);current=dailyPromptNeighbor(prompts,current,1)}
  assert.deepEqual(visited,prompts.map(prompt=>prompt.id));
  const backwards=[];current=prompts.at(-1).id;
  while(current){backwards.push(current);current=dailyPromptNeighbor(prompts,current,-1)}
  assert.deepEqual(backwards,[...visited].reverse());
  assert.equal(dailyPromptNeighbor(prompts,'missing',1),null);
});
test('a question validates its own existing requirement without asking for later fields',()=>{
  for(const prompt of ['sleep','energy','metric-0','risk','cause','journal'])assert.deepEqual(dailyPromptIssues({},prompt,today),[],prompt);
  assert.deepEqual(dailyPromptIssues({action:'具体动作'},'action',today),[]);
  assert.deepEqual(dailyPromptIssues({ifCondition:'遇到阻碍'},'ifCondition',today),[]);
  assert.deepEqual(dailyPromptIssues({ifThen:'执行应对'},'ifThen',today),[]);
  for(const field of ['today','action','ifCondition','ifThen','verifyDate']){
    const issues=dailyPromptIssues({},field,today);
    assert.equal(issues.length,1);assert.equal(issues[0].field,field);
  }
});
