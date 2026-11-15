import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createReviewTransition} from '../public/review-transition.js';

const settle=()=>new Promise(resolve=>setImmediate(resolve));

function fixture({animate=true,systemReduced=false,failArt=false}={}){
  const dom=new JSDOM('<main><section class="daily-flow"><div id="daily-editor"><div class="daily-editor-content"><textarea>原有输入</textarea></div></div><div class="daily-scene-art"></div></section></main>');
  const win=dom.window,root=win.document.querySelector('.daily-flow'),copy=root.querySelector('.daily-editor-content'),input=root.querySelector('textarea');
  win.matchMedia=()=>({matches:systemReduced});
  const animations=[];
  if(animate)win.HTMLElement.prototype.animate=function(){
    if(failArt&&this.classList.contains('daily-scene-art'))throw new Error('Animation unavailable for art');
    let resolve,reject,ended=false;
    const animation={node:this,finished:new Promise((yes,no)=>{resolve=yes;reject=no}),
      finish(){if(!ended){ended=true;resolve()}},
      cancel(){if(!ended){ended=true;reject(new win.DOMException('Cancelled','AbortError'))}},
      get ended(){return ended}};
    animations.push(animation);return animation;
  };
  const controller=createReviewTransition(root);
  return {dom,win,root,copy,input,animations,controller,
    async finishPhase(){const pending=animations.filter(animation=>!animation.ended);for(const animation of pending)animation.finish();await settle()},
    close(){controller.cancel();dom.window.close()}};
}

test('outgoing completes before the accepted screen changes; incoming keeps the original input usable',async()=>{
  const f=fixture();let screen='first',updates=0;
  try{
    const result=f.controller.run(()=>{screen='second';updates++});
    assert.equal(screen,'first');assert.equal(f.controller.busy,true);assert.equal(f.copy.hasAttribute('inert'),true);
    await f.finishPhase();
    assert.equal(screen,'second');assert.equal(updates,1);assert.equal(f.controller.busy,true);
    assert.equal(f.copy.hasAttribute('inert'),false);assert.equal(f.root.querySelector('textarea'),f.input);assert.equal(f.input.value,'原有输入');
    await f.finishPhase();await result;
    assert.equal(f.controller.busy,false);assert.equal(f.root.hasAttribute('data-review-transition'),false);
    f.input.value='继续输入';assert.equal(f.input.value,'继续输入');
  }finally{f.close()}
});

test('repeated navigation is ignored for the whole turn instead of queued behind it',async()=>{
  const f=fixture();let updates=0;
  try{
    const result=f.controller.run(()=>updates++);
    f.controller.run(()=>updates+=10);
    await f.finishPhase();
    f.controller.run(()=>updates+=100);
    await f.finishPhase();await result;await settle();
    assert.equal(updates,1);assert.equal(f.controller.busy,false);
    const back=f.controller.run(()=>updates--,{direction:-1});
    await f.finishPhase();await f.finishPhase();await back;
    assert.equal(updates,0);assert.equal(f.controller.busy,false);
  }finally{f.close()}
});

test('cancelled, detached and superseded outgoing turns cannot change a later screen',async()=>{
  for(const reason of ['cancel','detach','owner']){
    const f=fixture();let current=true,updates=0;
    try{
      const result=f.controller.run(()=>updates++,{current:()=>current});
      if(reason==='cancel')f.controller.cancel();
      if(reason==='detach')f.root.remove();
      if(reason==='owner')current=false;
      await f.finishPhase();await result;await settle();
      assert.equal(updates,0,reason);assert.equal(f.controller.busy,false,reason);
      assert.equal(f.copy.hasAttribute('inert'),false,reason);assert.equal(f.root.hasAttribute('data-review-transition'),false,reason);
    }finally{f.close()}
  }
});

test('incoming cancellation keeps the accepted screen and restores pre-existing inert state',async()=>{
  const f=fixture();let updates=0;
  try{
    f.copy.setAttribute('inert','original');
    const result=f.controller.run(()=>updates++);
    await f.finishPhase();assert.equal(updates,1);
    f.controller.cancel();await result;await settle();
    assert.equal(updates,1);assert.equal(f.controller.busy,false);
    assert.equal(f.copy.getAttribute('inert'),'original');assert.equal(f.root.hasAttribute('data-review-transition'),false);
  }finally{f.close()}
});

test('native animation cancellation cannot commit, and old completion cannot release a newer turn',async()=>{
  const f=fixture();let updates=0;
  try{
    const nativeCancelled=f.controller.run(()=>updates+=10);
    f.animations[0].cancel();await f.finishPhase();await nativeCancelled;
    assert.equal(updates,0);assert.equal(f.controller.busy,false);
    const obsolete=f.controller.run(()=>updates+=100);f.controller.cancel();
    const accepted=f.controller.run(()=>updates++);
    await obsolete;await settle();
    assert.equal(f.controller.busy,true);assert.equal(f.copy.hasAttribute('inert'),true);assert.equal(updates,0);
    await f.finishPhase();await f.finishPhase();await accepted;
    assert.equal(updates,1);assert.equal(f.controller.busy,false);assert.equal(f.copy.hasAttribute('inert'),false);
  }finally{f.close()}
});

test('account/system reduced motion and missing animation support navigate synchronously',()=>{
  for(const mode of ['account','system','unsupported']){
    const f=fixture({animate:mode!=='unsupported',systemReduced:mode==='system'});let updates=0;
    try{
      f.controller.run(()=>updates++,{reduceMotion:()=>mode==='account'});
      assert.equal(updates,1,mode);assert.equal(f.controller.busy,false,mode);
      assert.equal(f.animations.length,0,mode);assert.equal(f.copy.hasAttribute('inert'),false,mode);
    }finally{f.close()}
  }
});

test('a partially unavailable animation restores controls and still accepts navigation once',async()=>{
  const f=fixture({failArt:true});let updates=0;
  try{
    await f.controller.run(()=>updates++);await settle();
    assert.equal(updates,1);assert.equal(f.controller.busy,false);
    assert.equal(f.copy.hasAttribute('inert'),false);assert.equal(f.root.hasAttribute('data-review-transition'),false);
    assert.ok(f.animations.every(animation=>animation.ended));
  }finally{f.close()}
});

test('a motion preference enabled during fade-out finishes on the accepted screen without a new animation',async()=>{
  const f=fixture();let reduced=false,updates=0;
  try{
    const result=f.controller.run(()=>updates++,{reduceMotion:()=>reduced});
    const outgoing=f.animations.length;reduced=true;
    await f.finishPhase();await result;
    assert.equal(updates,1);assert.equal(f.controller.busy,false);assert.equal(f.animations.length,outgoing);
    assert.equal(f.copy.hasAttribute('inert'),false);
  }finally{f.close()}
});
