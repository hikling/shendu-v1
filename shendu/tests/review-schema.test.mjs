import test from 'node:test';
import assert from 'node:assert/strict';
import {REVIEW_QUESTIONS,reviewQuestions,reviewDisabledFields} from '../public/review-schema.js';

test('legacy templates retain question labels and original required flags',()=>{
  for(const [type,defaults] of Object.entries(REVIEW_QUESTIONS)){
    const template={[defaults[0][0]]:'  自己的题目  '};
    const questions=reviewQuestions(type,template);
    assert.equal(questions[0].label,'自己的题目');
    assert.deepEqual(questions.map(({id,required})=>[id,Number(required)]),defaults.map(([id,,required])=>[id,required]));
    assert.deepEqual(reviewQuestions(type,{questions:[]}),[]);
  }
});

test('custom questions preserve stable IDs, order and independent required flags',()=>{
  const template={questions:[{id:'custom_one',label:' 第一个问题 ',required:true},{id:'cause',label:'重新命名的原因',required:true},{id:'custom_two',label:'选填题',required:false}]};
  const copy=structuredClone(template),questions=reviewQuestions('daily',template);
  assert.deepEqual(questions,[{id:'custom_one',label:'第一个问题',required:true},{id:'cause',label:'重新命名的原因',required:true},{id:'custom_two',label:'选填题',required:false}]);
  assert.deepEqual(template,copy);
});

test('malformed question schemas cannot introduce unsafe IDs or unbounded rows',()=>{
  const values=[null,[],{},'question',{id:'__proto__',label:'bad'},{id:'constructor',label:'bad'},{id:'action',label:'core field'},{id:'custom_',label:'bad'},{id:'custom_space here',label:'bad'},
    {id:'custom_blank',label:'   '},{id:'custom_number',label:42},{id:'custom_valid',label:'a'.repeat(200),required:'true'},{id:'custom_valid',label:'duplicate'},
    ...Array.from({length:40},(_,index)=>({id:`custom_${index}`,label:`Question ${index}`,required:true}))];
  const questions=reviewQuestions('weekly',{questions:values});
  assert.equal(questions.length,30);assert.equal(questions[0].id,'custom_valid');assert.equal(questions[0].label.length,160);assert.equal(questions[0].required,false);
  assert.equal(new Set(questions.map(question=>question.id)).size,questions.length);
  assert.deepEqual(reviewQuestions('__proto__'),[]);
  assert.deepEqual(reviewQuestions('daily',null),reviewQuestions('daily'));
});

test('only optional daily screens can be disabled and duplicates are removed',()=>{
  assert.deepEqual(reviewDisabledFields({disabledFields:['journal','action','sleep','sleep','__proto__','verifyDate','risk','energy']}),['sleep','energy','risk','journal']);
  for(const value of [undefined,null,{},[],{disabledFields:'sleep'}])assert.deepEqual(reviewDisabledFields(value),[]);
});
