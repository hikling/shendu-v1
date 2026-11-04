import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {RECORD_ART,recordArtAssignments} from '../public/record-art.js';

const records=(type,count)=>Array.from({length:count},(_,index)=>({id:`${type}-${String(index).padStart(3,'0')}`,type,period:`2026-${String(index+1).padStart(3,'0')}`,data:{answers:{fact:['同一类记录也应拥有不同画面。']}}}));

test('the transition catalog contains only real local category art, with no duplicated files',()=>{
  const paths=Object.values(RECORD_ART).flat().map(image=>image.src.split('?')[0]);
  assert.equal(paths.length,24);
  assert.equal(new Set(paths).size,24);
  for(const path of paths)assert.ok(existsSync(new URL(`../public${path}`,import.meta.url)),path);
});

test('each category exhausts its own pool before reusing illustrations, even for matching content',()=>{
  for(const [type,pool] of Object.entries(RECORD_ART)){
    const input=records(type,pool.length*3).map(record=>({...record,title:pool[0].terms.join(' ')})),assigned=recordArtAssignments(input);
    for(let round=0;round<3;round++){
      const urls=input.slice(round*pool.length,(round+1)*pool.length).map(record=>assigned.get(record.id).src);
      assert.equal(new Set(urls).size,pool.length,type);
      assert.ok(urls.every(url=>pool.some(image=>image.src===url)));
    }
    for(let index=1;index<input.length;index++)assert.notEqual(assigned.get(input[index-1].id).src,assigned.get(input[index].id).src);
  }
});

test('a 30-picture category can display 30 daily entries without any repetition',()=>{
  const pool=Array.from({length:30},(_,index)=>({src:`/daily-${index}.webp`,scene:`daily-${index}`,terms:['记录']}));
  const assigned=recordArtAssignments(records('daily',30),{daily:pool});
  assert.equal(new Set([...assigned.values()].map(image=>image.src)).size,30);
});

test('input order and duplicate IDs do not change assignments or mutate the records',()=>{
  const input=[...records('daily',18),...records('weekly',5)],snapshot=structuredClone(input);
  const expected=recordArtAssignments(input),reversed=recordArtAssignments([...input].reverse()),duplicated=recordArtAssignments([...input,...input]);
  for(const record of input){assert.deepEqual(reversed.get(record.id),expected.get(record.id));assert.deepEqual(duplicated.get(record.id),expected.get(record.id))}
  assert.deepEqual(input,snapshot);
});

test('unused semantic matches win, fallback is stable, and unsupported records are ignored',()=>{
  const reading={id:'reading',type:'daily',period:'2026-01-01',title:'今天阅读一本书',data:{}};
  assert.equal(recordArtAssignments([reading]).get('reading').scene,'journal');
  const result=recordArtAssignments([reading,{...reading,id:'unknown',type:'unknown'},null]);
  assert.equal(result.size,1);
  assert.equal(recordArtAssignments([]).size,0);
});
