import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createReviewIntroPicker,REVIEW_INTROS,reviewIntroLines,reviewIntroLayout} from '../public/review-intros.js';
import {createReviewNavigator} from '../public/review-navigation.js';

test('six categories have distinct varied opening pools and preserve every punctuation-delimited phrase',()=>{
  assert.deepEqual(Object.keys(REVIEW_INTROS),['daily','weekly','monthly','quarterly','yearly','decision']);
  const all=Object.values(REVIEW_INTROS).flat();
  assert.equal(new Set(all).size,all.length);
  for(const pool of Object.values(REVIEW_INTROS)){
    assert.ok(pool.length>=12);
    assert.ok(new Set(pool.map(text=>Array.from(text).length)).size>=4,'openings are not a fixed eight-character pattern');
    for(const text of pool){
      const {lines,columns,density}=reviewIntroLayout(text);
      assert.equal(lines.join(''),text);
      assert.ok(lines.length>=1&&lines.length<=4,'each opening remains a short readable composition');
      assert.ok(columns>0&&Number.isFinite(columns));
      assert.ok(['long','regular'].includes(density));
    }
  }
  assert.deepEqual(reviewIntroLines('审问之，慎思之，明辨之，笃行之。'),['审问之，','慎思之，','明辨之，','笃行之。']);
  assert.deepEqual(reviewIntroLines('先看事实。再问为什么？最后决定！'),['先看事实。','再问为什么？','最后决定！']);
});

test('each category exhausts its own shuffled pool before repeating and cycle boundaries do not repeat',()=>{
  const picker=createReviewIntroPicker({random:()=>.5});
  for(const [type,pool] of Object.entries(REVIEW_INTROS)){
    const round=Array.from({length:pool.length},()=>picker.enter(type));
    assert.equal(new Set(round).size,pool.length);
    assert.deepEqual(new Set(round),new Set(pool));
    const second=Array.from({length:pool.length},()=>picker.enter(type));
    assert.notEqual(second[0],round.at(-1));
    assert.equal(new Set(second).size,pool.length);
  }
});

test('current visit text is stable through repeated reads and does not consume another choice',()=>{
  const picker=createReviewIntroPicker({random:()=>0}),first=picker.enter('daily');
  for(let index=0;index<20;index++)assert.equal(picker.current('daily'),first);
  const second=picker.enter('daily');assert.notEqual(second,first);
  assert.equal(picker.current('daily'),second);
  const weekly=picker.enter('weekly');assert.equal(picker.current('weekly'),weekly);
  assert.ok(REVIEW_INTROS.weekly.includes(weekly));
  assert.notEqual(picker.enter('daily'),second);
  assert.throws(()=>picker.enter('unknown'),RangeError);
});

test('real guarded entry selects once, while cancelled navigation and local redraws keep the current opening',async()=>{
  const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  const start=source.indexOf('const reviewNavigation=createReviewNavigator('),end=source.indexOf('\nlet modalReturnFocus',start);
  const quoteStart=source.indexOf('function quoteFor('),quoteEnd=source.indexOf('\nfunction ',quoteStart+1);
  assert.ok(start>=0&&end>start&&quoteStart>=0&&quoteEnd>quoteStart);
  const picker=createReviewIntroPicker({random:()=>.5}),state={route:'overview',current:null,dirty:false},opened=[];
  let pending;
  const bindings=new Function('createReviewNavigator','reviewIntros','state','window','document','TYPES','attemptNavigate','renderReview','navigate','requestAnimationFrame',`${source.slice(start,end)}\n${source.slice(quoteStart,quoteEnd)}\nreturn {enterReview,quoteFor};`)(
    createReviewNavigator,picker,state,{scrollY:0},{title:''},Object.fromEntries(Object.keys(REVIEW_INTROS).map(type=>[type,{label:type}])),
    next=>{if(state.dirty)pending=next;else next()},(...args)=>opened.push(args),()=>{},()=>{},
  );
  bindings.enterReview('daily','2026-11-05');
  const first=bindings.quoteFor('daily');assert.equal(opened.length,1);
  for(let redraw=0;redraw<5;redraw++)assert.equal(bindings.quoteFor('daily'),first);
  state.dirty=true;bindings.enterReview('daily','2026-11-05');
  assert.equal(opened.length,1);assert.equal(bindings.quoteFor('daily'),first,'guarded/cancelled entry cannot change visible text');
  state.dirty=false;pending();assert.equal(opened.length,2);
  assert.notEqual(bindings.quoteFor('daily'),first,'the same date gets new words on a fresh accepted visit');
  for(const type of Object.keys(REVIEW_INTROS)){
    state.route='overview';bindings.enterReview(type,'2026-11-05');
    assert.ok(REVIEW_INTROS[type].includes(bindings.quoteFor(type)));
  }
});
