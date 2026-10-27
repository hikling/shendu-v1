import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyStepIssues} from '../public/daily-flow.js';

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
