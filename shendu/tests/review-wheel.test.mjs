import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {attachReviewWheel,createWheelGesture} from '../public/review-wheel.js';

test('a continuous wheel burst crosses one question at most until both idle and cooldown pass',()=>{
  const input=createWheelGesture(),moves=[];
  for(let time=0;time<=1600;time+=20){const move=input(120,time);if(move)moves.push([time,move])}
  assert.deepEqual(moves,[[0,1]]);
  assert.equal(input(120,1900),1);
  assert.equal(input(-120,2150),0,'idle alone cannot bypass the minimum cooldown');
  assert.equal(input(-120,2200),0);
  assert.equal(input(-120,2600),-1);
});

test('trackpad distances accumulate, opposite movement resets distance, and native gestures stay native',()=>{
  const input=createWheelGesture();
  assert.equal(input(45,0),0);assert.equal(input(-50,20),0);assert.equal(input(-45,40),-1);
  assert.equal(input(0,800,'native'),0);assert.equal(input(120,820),0,'content reaching its edge in the same burst cannot navigate');
  assert.equal(input(120,1200),1);
  assert.equal(input(0,2000,'ignore'),0);assert.equal(input(120,2050),0);assert.equal(input(120,2300),1);
});

function fixture(){
  const dom=new JSDOM('<main id="canvas"><article id="copy"><textarea style="overflow-y:auto"></textarea><input type="number"><input type="range"><select><option>一</option></select></article></main>',{pretendToBeVisual:true}),document=dom.window.document;
  const root=document.querySelector('#canvas'),textarea=document.querySelector('textarea'),moves=[];
  let time=0,enabled=true,active=true,allowed=true;
  const dispose=attachReviewWheel(root,{now:()=>time,enabled:()=>enabled,active:()=>active,canStep:()=>allowed,step:direction=>moves.push(direction)});
  const wheel=(target=root,options={})=>{const event=new dom.window.WheelEvent('wheel',{deltaY:120,bubbles:true,cancelable:true,...options});target.dispatchEvent(event);return event};
  return {dom,document,root,textarea,moves,dispose,wheel,time:value=>{time=value},enable:value=>{enabled=value},activate:value=>{active=value},allow:value=>{allowed=value}};
}
function scrollSize(element,height,viewport){Object.defineProperties(element,{scrollHeight:{value:height,configurable:true},clientHeight:{value:viewport,configurable:true}})}

test('eligible pixel/line/page wheels capture small deltas and normalize to one step',()=>{
  for(const mode of [0,1,2]){
    const f=fixture();
    const delta=mode===0?45:mode===1?3:0.06;
    assert.equal(f.wheel(f.root,{deltaY:delta,deltaMode:mode}).defaultPrevented,true);assert.deepEqual(f.moves,[]);
    f.time(20);f.wheel(f.root,{deltaY:delta,deltaMode:mode});assert.deepEqual(f.moves,[1]);
    f.time(30);f.wheel(f.root,{deltaY:-500});assert.deepEqual(f.moves,[1]);f.dom.window.close();
  }
});

test('textarea and scrollable ancestors keep a complete native scroll burst, then permit a fresh edge gesture',()=>{
  for(const ancestor of [false,true]){
    const f=fixture(),scroller=ancestor?f.document.querySelector('#copy'):f.textarea;
    scroller.style.overflowY='auto';scrollSize(scroller,500,200);scroller.scrollTop=100;
    assert.equal(f.wheel(f.textarea).defaultPrevented,false);assert.deepEqual(f.moves,[]);
    scroller.scrollTop=300;f.time(20);assert.equal(f.wheel(f.textarea).defaultPrevented,true);assert.deepEqual(f.moves,[]);
    f.time(300);f.wheel(f.textarea);assert.deepEqual(f.moves,[1]);
    f.time(1100);assert.equal(f.wheel(f.textarea,{deltaY:-120}).defaultPrevented,false);assert.deepEqual(f.moves,[1]);f.dom.window.close();
  }
});

test('document content scrolls to the edge before a separate gesture may change questions',()=>{
  const f=fixture(),scroller=f.document.documentElement;scrollSize(scroller,1800,600);scroller.scrollTop=400;
  assert.equal(f.wheel().defaultPrevented,false);scroller.scrollTop=1200;f.time(40);f.wheel();assert.deepEqual(f.moves,[]);
  f.time(300);f.wheel();assert.deepEqual(f.moves,[1]);f.dom.window.close();
});

test('preference, busy/modal owner, composition, boundary and detached surfaces never navigate',()=>{
  for(const mode of ['disabled','inactive','composition','boundary','detached','disposed']){
    const f=fixture();
    if(mode==='disabled')f.enable(false);if(mode==='inactive')f.activate(false);if(mode==='boundary')f.allow(false);
    if(mode==='composition')f.root.dispatchEvent(new f.dom.window.CompositionEvent('compositionstart',{bubbles:true}));
    if(mode==='detached')f.root.remove();if(mode==='disposed')f.dispose();
    assert.equal(f.wheel().defaultPrevented,false);assert.deepEqual(f.moves,[],mode);f.dom.window.close();
  }
});

test('zoom, horizontal wheels and numeric/range/select controls retain their native handling',()=>{
  for(const options of [{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true},{deltaX:150},{deltaY:0},{cancelable:false}]){
    const f=fixture();assert.equal(f.wheel(f.root,options).defaultPrevented,false);assert.deepEqual(f.moves,[]);f.dom.window.close();
  }
  for(const selector of ['input[type="number"]','input[type="range"]','select']){
    const f=fixture();assert.equal(f.wheel(f.document.querySelector(selector)).defaultPrevented,false);assert.deepEqual(f.moves,[]);f.dom.window.close();
  }
});
