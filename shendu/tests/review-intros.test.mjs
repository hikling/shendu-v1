import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createReviewIntroPicker,REVIEW_INTROS,reviewIntroLines,reviewIntroLayout} from '../public/review-intros.js';
import {createReviewNavigator} from '../public/review-navigation.js';

const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
function entryFixture({picker=createReviewIntroPicker({random:()=>.5}),records=[]}={}){
  const start=source.indexOf('const reviewNavigation=createReviewNavigator('),end=source.indexOf('\nlet modalReturnFocus',start);
  const quoteStart=source.indexOf('function quoteFor('),quoteEnd=source.indexOf('\nfunction ',quoteStart+1);
  assert.ok(start>=0&&end>start&&quoteStart>=0&&quoteEnd>quoteStart);
  const state={route:'overview',current:null,records,dirty:false},opened=[];
  let pending;
  const bindings=new Function('createReviewNavigator','reviewIntros','state','window','document','TYPES','attemptNavigate','renderReview','navigate','requestAnimationFrame',`${source.slice(start,end)}\n${source.slice(quoteStart,quoteEnd)}\nreturn {enterReview,quoteFor};`)(
    createReviewNavigator,picker,state,{scrollY:0},{title:''},Object.fromEntries(Object.keys(REVIEW_INTROS).map(type=>[type,{label:type}])),
    next=>{if(state.dirty)pending=next;else next()},(...args)=>opened.push(args),()=>{},()=>{},
  );
  return {state,opened,...bindings,accept(){state.dirty=false;const next=pending;pending=null;next?.()}};
}

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

test('real guarded new entry selects once, while cancelled navigation and local redraws keep the current opening',()=>{
  const f=entryFixture();f.enterReview('daily','2026-11-05');
  const first=f.quoteFor('daily');assert.equal(f.opened.length,1);
  for(let redraw=0;redraw<5;redraw++)assert.equal(f.quoteFor('daily'),first);
  f.state.dirty=true;f.enterReview('daily','2026-11-05');
  assert.equal(f.opened.length,1);assert.equal(f.quoteFor('daily'),first,'guarded/cancelled entry cannot change visible text');
  f.accept();assert.equal(f.opened.length,2);
  assert.notEqual(f.quoteFor('daily'),first,'an unsaved period still gets new words on a fresh accepted visit');
  for(const type of Object.keys(REVIEW_INTROS)){
    f.state.route='overview';f.enterReview(type,'2026-11-05');
    assert.ok(REVIEW_INTROS[type].includes(f.quoteFor(type)));
  }
});

test('saved choices remain identical across visits and fresh pickers without consuming unsaved shuffle choices',()=>{
  const picker=createReviewIntroPicker({random:()=>.3}),control=createReviewIntroPicker({random:()=>.3});
  for(const type of Object.keys(REVIEW_INTROS)){
    assert.equal(picker.enter(type),control.enter(type));
    const saved=picker.enter(type,`${type}-saved`);
    assert.ok(REVIEW_INTROS[type].includes(saved));
    for(let visit=0;visit<15;visit++){
      picker.enter(type,`${type}-another`);
      assert.equal(picker.enter(type,`${type}-saved`),saved);
      const reloaded=createReviewIntroPicker({random:()=>{throw new Error('saved records must not draw random choices')}});
      assert.equal(reloaded.enter(type,`${type}-saved`),saved);
      assert.equal(reloaded.current(type),saved);
    }
    assert.equal(picker.enter(type),control.enter(type),'saved reads leave the next new-review choice unchanged');
    assert.ok(new Set(Array.from({length:30},(_,index)=>picker.enter(type,`record-${index}`))).size>1,'different records can have different stable openings');
  }
});

test('all six saved types keep their opening through statuses, edited data, source routes and reloaded visits',()=>{
  for(const type of Object.keys(REVIEW_INTROS)){
    const record={id:`${type}-saved`,type,period:'2026-11-05',status:'draft',updated_at:'2026-11-05T00:00:00Z',data:{action:'原行动'}},f=entryFixture({records:[record]});
    f.state.route='history';f.enterReview(type,record.period,false,record);const text=f.quoteFor(type);
    for(const status of ['draft','completed','verified'])for(const route of ['history','actions','calendar','overview']){
      const updated={...record,status,updated_at:'2026-11-10T23:59:00Z',data:{action:'修改后的私人行动'}},copy=structuredClone(updated);
      f.state.route=route;f.enterReview(type,updated.period,false,updated);
      assert.equal(f.quoteFor(type),text);assert.equal(f.opened.at(-1)[3],updated);
      assert.deepEqual(updated,copy,'opening words do not modify the record or saved data');
      const reloaded=entryFixture({records:[updated],picker:createReviewIntroPicker({random:()=>.99})});
      reloaded.state.route=route;reloaded.enterReview(type,updated.period,false,updated);
      assert.equal(reloaded.quoteFor(type),text);
    }
    f.state.route='overview';f.enterReview(type,record.period);
    assert.equal(f.quoteFor(type),text,'implicit period restoration uses the same saved ID as explicit history entry');
    assert.equal(f.opened.at(-1)[3],record);
  }
});

test('force-new decisions stay new and saving an unsaved visit does not replace its visible opening',()=>{
  const record={id:'decision-saved',type:'decision',period:'2026-11-05',status:'verified'},f=entryFixture({records:[record]});
  f.enterReview('decision',record.period,true);const initial=f.quoteFor('decision');
  assert.equal(f.state.current,null);assert.equal(f.opened.at(-1)[3],null,'force-new must not silently open a saved decision for the same day');
  f.state.current={id:'newly-saved-decision',type:'decision',period:record.period,status:'draft'};
  f.state.records.push(f.state.current);
  for(let redraw=0;redraw<5;redraw++)assert.equal(f.quoteFor('decision'),initial,'first-save ID allocation does not change the current visit');
  const saved=f.state.current;
  f.enterReview('decision',saved.period,false,saved);
  const reopened=f.quoteFor('decision');
  const reloaded=entryFixture();reloaded.enterReview('decision',saved.period,false,{...saved,status:'completed'});
  assert.equal(reloaded.quoteFor('decision'),reopened);
  f.enterReview('decision',record.period,true,record);
  assert.equal(f.opened.at(-1)[3],record,'an explicit saved override retains the existing render contract even with forceNew');
});

test('a blocked entry into a saved record does not replace the current visit or consume the new-review bag',()=>{
  const record={id:'daily-saved',type:'daily',period:'2026-11-05',status:'draft'},f=entryFixture({records:[record]});
  f.enterReview('daily','2026-11-06');const current=f.quoteFor('daily');
  f.state.dirty=true;f.enterReview('daily',record.period,false,record);
  assert.equal(f.quoteFor('daily'),current);assert.equal(f.opened.length,1);
  f.accept();assert.equal(f.opened.length,2);
  assert.equal(f.quoteFor('daily'),createReviewIntroPicker().enter('daily',record.id));
});
