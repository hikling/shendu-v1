import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const dom=new JSDOM(html,{url:'http://localhost',pretendToBeVisual:true}),win=dom.window;
for(const name of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement','HTMLSelectElement','HTMLButtonElement','HTMLFormElement','Element','Node','NodeFilter','Event','CustomEvent','KeyboardEvent','MouseEvent','MutationObserver','getComputedStyle','FormData'])globalThis[name]=win[name];
Object.defineProperty(globalThis,'navigator',{value:win.navigator,configurable:true});
globalThis.requestAnimationFrame=win.requestAnimationFrame.bind(win);globalThis.cancelAnimationFrame=win.cancelAnimationFrame.bind(win);
globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
win.HTMLElement.prototype.scrollIntoView=function(){};
const ui=await import('../public/ui/shadcn.js');
const $=(selector,root=document)=>root.querySelector(selector),$$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const app=$('#app'),rail=$('#rail-root'),notifications=$('#toast-root');
ui.initializeToasts(notifications);
const owner=name=>{
  const start=source.indexOf(`function ${name}(`),end=source.indexOf('\nfunction ',start+1);
  assert.ok(start>=0&&end>start,`locate actual ${name} owner`);
  return source.slice(start,end);
};
const rightRail=()=>'<aside id="right-rail"><header class="rail-dialog-header"><h2>阶段与日历</h2><button id="rail-close">关闭</button></header><div class="rail-stats">统计</div><section class="rail-calendar">日历</section><section class="rail-stage">阶段</section><section class="rail-pending">待验证</section></aside>';
const names=['syncOverlayBackground','openModal','closeModal','setRailOverlayOpen','renderAuth'];
const state={};
const controls=new Function('$','$$','state','prepareDialogContainer','showDialog','dismissDialog','showRail','cancelDailyTypewriter','rightRail','railDecor','bindCalendar','bindActionButtons','setDailyImmersive','reviewNavigation','renderMarkup',`let modalReturnFocus=null;\n${names.map(owner).join('\n')}\nreturn {openModal,closeModal,setRailOverlayOpen,renderAuth};`)($,$$,state,ui.prepareDialogContainer,ui.showDialog,ui.dismissDialog,ui.showRail,()=>{},rightRail,()=>'',()=>{},()=>{},()=>{},{clear(){}},ui.renderMarkup);
const settle=()=>new Promise(resolve=>setTimeout(resolve,30));

test('application overlay owner makes live review descendants inert without disabling either overlay or notifications',async()=>{
  assert.equal(rail.parentElement,document.body,'stage portal stays outside the inert application');
  app.innerHTML='<header><button id="rail-toggle">阶段与日历</button></header><main id="daily-editor"><p aria-live="polite">预期验证日期</p><div><span aria-live="polite">已保存</span><button id="underlying-save">保存草稿</button><button>完成并锁定</button></div></main>';
  const save=$('#underlying-save');save.focus();
  controls.openModal('<div class="modal-head"><h2>完成确认</h2></div><button data-close>继续填写</button>');await settle();
  assert.equal(app.inert,true,'live date/save regions cannot expose the surrounding review controls');
  assert.equal($('#daily-editor').closest('#app'),app);assert.equal($('#modal-root .modal').closest('#app'),null);
  assert.notEqual($('#modal-root').inert,true);assert.notEqual(notifications.inert,true);
  ui.showToast(notifications,'请确认填写内容','info');await settle();assert.equal(notifications.closest('#app'),null);
  controls.closeModal();await settle();assert.equal(app.inert,false);assert.equal(document.activeElement,save);

  controls.setRailOverlayOpen(true);await settle();assert.equal(app.inert,true);assert.notEqual(rail.inert,true);
  const parent=$('#right-rail'),parentClose=$('#rail-close');parentClose.focus();
  controls.openModal('<div class="modal-head"><h2>阶段设置</h2></div><input name="focus">','',true);await settle();
  assert.equal(app.inert,true);assert.equal(parent.inert,true);assert.notEqual($('#modal-root').inert,true);
  controls.closeModal();assert.ok($('#modal-root .modal'),'persistent guard keeps background disabled');assert.equal(app.inert,true);
  controls.closeModal(true);await settle();assert.equal(app.inert,true,'parent stage still owns background inertness');assert.equal(parent.inert,false);assert.equal(document.activeElement,parentClose);
  controls.setRailOverlayOpen(false,true);await settle();assert.equal(app.inert,false);assert.equal(document.activeElement,$('#rail-toggle'));
});

test('full logged-out render removes body-level overlays and restores an interactive authentication screen',async()=>{
  controls.setRailOverlayOpen(true);await settle();assert.equal(app.inert,true);
  controls.openModal('<div class="modal-head"><h2>正在验证</h2></div><button>继续</button>','',true);await settle();
  controls.renderAuth();await settle();
  assert.equal(state.user,null);assert.equal(state.railOpen,false);assert.equal(app.inert,false);
  assert.equal(document.querySelector('[role="dialog"]'),null);assert.ok($('#auth-form'));assert.equal(rail.childElementCount,0);
});

test.after(()=>{ui.dismissDialog($('#modal-root'));ui.dismissDialog(rail);ui.disposeUi(app);ui.disposeUi(notifications);dom.window.close()});
