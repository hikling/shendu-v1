import test from 'node:test';
import assert from 'node:assert/strict';
import {EXTENDED_FLOW,extendedPrompts,extendedPromptNeighbor,extendedPromptIssues,extendedReviewIssues} from '../public/extended-flow.js';

const questionKeys={
  weekly:{plan:1,progress:1,patterns:0,keepStop:0,nextThree:1},
  monthly:{goalResult:1,change:1,want:0,bottleneck:1,experiment:1},
  quarterly:{hope:1,evidence:1,worth:0,choices:1,nextGoals:1},
  yearly:{coordinates:1,expectations:1,areas:0,decisions:0,keepRelease:1,nextYear:1},
  decision:{decision:1,options:1,facts:1,expectation:1,failure:1,choice:1,firstStep:1}
};
const questions=type=>Object.entries(questionKeys[type]).map(([key,required])=>[key,key,required]);
const expectedPhases={
  weekly:['weekly-recap','weekly-pattern','weekly-next'],
  monthly:['monthly-result','monthly-bottleneck','monthly-experiment'],
  quarterly:['quarterly-evidence','quarterly-direction','quarterly-next'],
  yearly:['yearly-coordinate','yearly-release','yearly-next'],
  decision:['decision-question','decision-evidence','decision-choice','decision-review']
};

test('all five flows expose every existing answer and the original save fields exactly once',()=>{
  for(const type of Object.keys(questionKeys)){
    const prompts=extendedPrompts(type,questions(type));
    const fields=prompts.map(prompt=>prompt.id);
    assert.equal(new Set(fields).size,fields.length,type);
    assert.deepEqual(fields.filter(key=>key in questionKeys[type]),Object.keys(questionKeys[type]),type);
    assert.deepEqual(fields.slice(-3),['action','ifThen','verifyDate'],type);
    assert.equal(fields[0]==='recordTitle',type==='decision',type);
    assert.deepEqual([...new Set(prompts.map(prompt=>prompt.phase))],expectedPhases[type],type);
    assert.ok(EXTENDED_FLOW[type].intro.length>0,type);
    for(const prompt of prompts){
      assert.equal(prompt.required,prompt.kind==='answer'?Boolean(questionKeys[type][prompt.id]):true,`${type}: ${prompt.id}`);
    }
  }
});

test('prompt traversal stops at both ends and preserves the actual field order',()=>{
  const prompts=extendedPrompts('decision',questions('decision'));
  assert.equal(extendedPromptNeighbor(prompts,'recordTitle',-1),null);
  assert.equal(extendedPromptNeighbor(prompts,'recordTitle',1),'decision');
  assert.equal(extendedPromptNeighbor(prompts,'ifThen',1),'verifyDate');
  assert.equal(extendedPromptNeighbor(prompts,'verifyDate',1),null);
});

test('current-screen gate skips optional answers and checks only the visible required answer',()=>{
  const prompts=extendedPrompts('weekly',questions('weekly'));
  const plan=prompts.find(prompt=>prompt.id==='plan'),patterns=prompts.find(prompt=>prompt.id==='patterns');
  assert.deepEqual(extendedPromptIssues({answers:{plan:['  ',''] }},'',plan,'2026-10-29'),[{field:'plan',reason:'required'}]);
  assert.deepEqual(extendedPromptIssues({answers:{plan:['  ','a real observation']}},'',plan,'2026-10-29'),[]);
  assert.deepEqual(extendedPromptIssues({},'',patterns,'2026-10-29'),[]);
});

test('the paired contingency screen keeps the original optional condition and required response',()=>{
  const prompt=extendedPrompts('monthly',questions('monthly')).find(item=>item.id==='ifThen');
  assert.deepEqual(extendedPromptIssues({ifCondition:'',ifThen:''},'',prompt,'2026-10-29'),[{field:'ifThen',reason:'required'}]);
  assert.deepEqual(extendedPromptIssues({ifCondition:'会议冲突',ifThen:''},'',prompt,'2026-10-29'),[{field:'ifThen',reason:'required'}]);
  assert.deepEqual(extendedPromptIssues({ifCondition:'会议冲突',ifThen:'改到晚上'},'',prompt,'2026-10-29'),[]);
  assert.deepEqual(extendedPromptIssues({ifCondition:'',ifThen:'改到晚上'},'',prompt,'2026-10-29'),[]);
});

test('final validation retains decision title, required answers, action, contingency and a real future date',()=>{
  const prompts=extendedPrompts('decision',questions('decision'));
  const data={answers:Object.fromEntries(Object.keys(questionKeys.decision).map(key=>[key,['已记录']])),action:'先做第一步',ifCondition:'如果延期',ifThen:'改到明天',verifyDate:'2026-10-30'};
  assert.deepEqual(extendedReviewIssues(data,'决定名称',prompts,'2026-10-29'),[]);
  assert.deepEqual(extendedReviewIssues(data,' ',prompts,'2026-10-29'),[{field:'recordTitle',reason:'required'}]);
  assert.deepEqual(extendedReviewIssues({...data,verifyDate:'2026-02-30'},'决定名称',prompts,'2026-10-29'),[{field:'verifyDate',reason:'date'}]);
  assert.deepEqual(extendedReviewIssues({...data,verifyDate:'2026-10-28'},'决定名称',prompts,'2026-10-29'),[{field:'verifyDate',reason:'date'}]);
  assert.deepEqual(extendedReviewIssues({...data,ifCondition:''},'决定名称',prompts,'2026-10-29'),[]);
});

test('stage configuration fails early if a question field is omitted or unknown',()=>{
  assert.throws(()=>extendedPrompts('weekly',questions('weekly').filter(([key])=>key!=='plan')),/Unknown weekly review field: plan/);
  assert.throws(()=>extendedPrompts('weekly',[...questions('weekly'),['newField','newField',1]]),/Missing weekly review field: newField/);
});
