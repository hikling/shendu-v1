import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {RECORD_ART,recordArtAssignments} from '../public/record-art.js';

const records=(type,count)=>Array.from({length:count},(_,index)=>({id:`${type}-${String(index).padStart(3,'0')}`,type,period:`2026-${String(index+1).padStart(3,'0')}`,data:{answers:{fact:['同一类记录也应拥有不同画面。']}}}));
const manifest=JSON.parse(readFileSync(new URL('../public/assets/records/manifest.json',import.meta.url),'utf8'));
const requiredCounts={daily:30,weekly:7,monthly:12,quarterly:4,yearly:6,decision:6};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

test('the reviewed catalog publishes all 65 unique scenes in the required category counts',()=>{
  assert.equal(manifest.status,'reviewed-and-published');
  assert.deepEqual(manifest.counts,requiredCounts);
  assert.deepEqual(Object.fromEntries(Object.entries(RECORD_ART).map(([type,pool])=>[type,pool.length])),requiredCounts);
  const images=Object.values(RECORD_ART).flat(),assets=new Map(manifest.assets.map(asset=>[asset.id,asset]));
  assert.equal(images.length,65);
  assert.equal(manifest.assets.length,65);
  assert.equal(assets.size,65);
  assert.equal(new Set(images.map(image=>image.src)).size,65);
  for(const [type,pool] of Object.entries(RECORD_ART))for(const image of pool){
    const asset=assets.get(image.scene);
    assert.ok(asset,image.scene);
    assert.equal(asset.type,type);
    assert.equal(image.src.split('?')[0],asset.webp);
    assert.match(asset.webp,new RegExp(`^/assets/records/${type}-[\\w-]+\\.webp$`));
    assert.deepEqual(image.terms,asset.terms);
    assert.ok(image.terms.length>0);
  }
});

test('every published WebP and original PNG matches its recorded dimensions and unique SHA256',()=>{
  const sourceHashes=new Set(),publishedHashes=new Set();
  for(const asset of manifest.assets){
    const source=readFileSync(new URL(`../../${asset.source}`,import.meta.url));
    assert.equal(source.subarray(0,8).toString('hex'),'89504e470d0a1a0a',asset.id);
    assert.equal(source.readUInt32BE(16),asset.source_width,asset.id);
    assert.equal(source.readUInt32BE(20),asset.source_height,asset.id);
    assert.equal(hash(source),asset.source_sha256,asset.id);
    sourceHashes.add(hash(source));
    const webp=readFileSync(new URL(`../public${asset.webp}`,import.meta.url));
    assert.equal(webp.toString('ascii',0,4),'RIFF',asset.id);
    assert.equal(webp.toString('ascii',8,16),'WEBPVP8X',asset.id);
    assert.equal(webp.readUIntLE(24,3)+1,640,asset.id);
    assert.equal(webp.readUIntLE(27,3)+1,640,asset.id);
    assert.equal(asset.width,640,asset.id);
    assert.equal(asset.height,640,asset.id);
    assert.equal(webp.length,asset.bytes,asset.id);
    assert.equal(hash(webp),asset.webp_sha256,asset.id);
    publishedHashes.add(hash(webp));
  }
  assert.equal(sourceHashes.size,65);
  assert.equal(publishedHashes.size,65);
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

test('the actual daily library displays 30 daily entries without any repetition',()=>{
  const assigned=recordArtAssignments(records('daily',30));
  assert.equal(new Set([...assigned.values()].map(image=>image.src)).size,30);
  assert.ok([...assigned.values()].every(image=>RECORD_ART.daily.some(candidate=>candidate.src===image.src)));
});

test('input order and duplicate IDs do not change assignments or mutate the records',()=>{
  const input=[...records('daily',18),...records('weekly',5)],snapshot=structuredClone(input);
  const expected=recordArtAssignments(input),reversed=recordArtAssignments([...input].reverse()),duplicated=recordArtAssignments([...input,...input]);
  for(const record of input){assert.deepEqual(reversed.get(record.id),expected.get(record.id));assert.deepEqual(duplicated.get(record.id),expected.get(record.id))}
  assert.deepEqual(input,snapshot);
});

test('unused semantic matches win, fallback is stable, and unsupported records are ignored',()=>{
  const reading={id:'reading',type:'daily',period:'2026-01-01',title:'今天阅读一本书',data:{}};
  assert.equal(recordArtAssignments([reading]).get('reading').scene,'daily-05-reading-corner');
  const result=recordArtAssignments([reading,{...reading,id:'unknown',type:'unknown'},null]);
  assert.equal(result.size,1);
  assert.equal(recordArtAssignments([]).size,0);
});

test('review answers, actions and verification results select the matching local scene',()=>{
  const input=[
    {id:'reading-answer',type:'daily',period:'2026-01-01',data:{answers:{fact:['读完书籍，做阅读笔记。']}}},
    {id:'next-action',type:'weekly',period:'2026-W01',data:{action:'下周计划：安排下一步行动。'}},
    {id:'fact-result',type:'decision',period:'2026-01-01',data:{},verification:{result:'调查后核实了证据和事实。'}}
  ];
  const assigned=recordArtAssignments(input);
  assert.equal(assigned.get('reading-answer').scene,'daily-05-reading-corner');
  assert.equal(assigned.get('next-action').scene,'weekly-07-week-next');
  assert.equal(assigned.get('fact-result').scene,'decision-02-decision-facts');
});
