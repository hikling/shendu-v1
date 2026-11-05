import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';

const dom=new JSDOM('<!doctype html><html><body><main id="root"></main></body></html>',{url:'http://localhost',pretendToBeVisual:true}),win=dom.window;
for(const name of ['window','document','HTMLElement','HTMLInputElement','HTMLButtonElement','HTMLSelectElement','HTMLFormElement','Node','Event','CustomEvent','KeyboardEvent','MutationObserver','getComputedStyle'])Object.defineProperty(globalThis,name,{value:name==='getComputedStyle'?win.getComputedStyle.bind(win):win[name],configurable:true});
Object.defineProperty(globalThis,'navigator',{value:win.navigator,configurable:true});
globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
globalThis.requestAnimationFrame=win.requestAnimationFrame.bind(win);globalThis.cancelAnimationFrame=win.cancelAnimationFrame.bind(win);
const {renderMarkup,enhanceUi,disposeUi}=await import('../public/ui/shadcn.js');
const root=document.querySelector('#root'),settle=()=>new Promise(resolve=>setTimeout(resolve,20));
const $=s=>root.querySelector(s),$$=s=>[...root.querySelectorAll(s)];
after(()=>{disposeUi(root);win.close()});

test('history filters stay compact native selects with labels, values, disabled months and one change path',async()=>{
  renderMarkup(root,'<section class="history-page"><form><label>复盘类型<select id="history-type" name="type"><option value="all">全部类型</option><option value="daily" selected>每日复盘</option></select><span class="select-chevron" aria-hidden="true"></span></label><label>年份<select id="history-year" name="year"><option value="all">全部年份</option><option value="2026" selected>2026 年</option></select><span class="select-chevron" aria-hidden="true"></span></label><label>月份<select id="history-month" name="month" disabled><option value="all">先选年份</option><option value="11">11 月</option></select><span class="select-chevron" aria-hidden="true"></span></label></form></section>');
  assert.equal($$('[data-slot="native-select-wrapper"]').length,3);
  assert.equal($('[role="radiogroup"]'),null);
  const type=$('#history-type'),year=$('#history-year'),month=$('#history-month');
  for(const select of [type,year,month]){
    assert.equal(select.getAttribute('aria-hidden'),null);
    assert.equal(select.tabIndex,0);
    assert.equal(select.labels.length,1);
    assert.equal(select.classList.contains('sd-choice-native'),false);
  }
  assert.equal(type.value,'daily');assert.equal(year.value,'2026');assert.equal(month.disabled,true);
  assert.deepEqual([...new win.FormData($('form'))],[['type','daily'],['year','2026']]);
  let changes=0,target;
  type.addEventListener('change',event=>{changes++;target=event.target;});
  type.value='all';type.dispatchEvent(new win.Event('change',{bubbles:true}));await settle();
  assert.equal(changes,1);assert.equal(target,type);assert.equal(type.value,'all');
  month.disabled=false;month.value='11';month.dispatchEvent(new win.Event('change',{bubbles:true}));
  assert.equal(new win.FormData($('form')).get('month'),'11');
  enhanceUi(root);assert.equal($('#history-type'),type);assert.equal($('#history-month'),month);
  $('form').reset();assert.equal(type.value,'daily');assert.equal(month.value,'all');
});

test('direct shadcn choices preserve the one native value and emit one input/change event',async()=>{
  renderMarkup(root,'<form><label for="status">完成状态</label><select id="status" name="status"><option value="">未记录</option><option value="done" selected>已达标</option><option value="part">部分达标</option></select><button type="submit">保存</button></form>');
  const select=$('#status'),group=$('[role="radiogroup"]');
  assert.equal(group.dataset.slot,'radio-group');assert.equal(group.getAttribute('aria-label'),'完成状态');
  assert.equal($('[role="radio"][data-state="checked"]').textContent,'已达标');
  assert.equal(select.getAttribute('aria-hidden'),'true');assert.equal(select.tabIndex,-1);
  let inputs=0,changes=0,target;
  select.addEventListener('input',()=>inputs++);select.addEventListener('change',event=>{changes++;target=event.target});
  $('[role="radio"][value="part"]').click();await settle();
  assert.equal(select.value,'part');assert.equal(target,select);assert.equal(inputs,1);assert.equal(changes,1);
  assert.deepEqual(new win.FormData($('form')).getAll('status'),['part']);
  $('[role="radio"][value="part"]').click();await settle();
  assert.equal(inputs,1);assert.equal(changes,1,'choosing the current value does not dirty a record again');
});

test('native labels, required validation and focus target the visible choice group',async()=>{
  renderMarkup(root,'<form><label for="outcome">结果判断</label><select id="outcome" name="outcome" required><option value="">请选择</option><option value="good">好</option><option value="bad">差</option></select></form>');
  const select=$('#outcome'),group=$('[role="radiogroup"]');
  assert.equal(select.required,true);assert.equal(select.checkValidity(),false);await settle();
  assert.equal(group.getAttribute('aria-required'),'true');assert.equal(group.getAttribute('aria-invalid'),'true');
  assert.equal(document.activeElement.getAttribute('role'),'radio');
  $('[role="radio"][value="good"]').click();await settle();
  assert.equal(select.checkValidity(),true);assert.equal(group.hasAttribute('aria-invalid'),false);
  select.focus();assert.equal(document.activeElement,$('[role="radio"][value="good"]'));
});

test('disabled options and dynamically disabled native controls or fieldsets stay unavailable',async()=>{
  renderMarkup(root,'<form><fieldset><label>选择角色<select id="role" name="role"><option value="member">成员</option><option value="admin">管理员</option><option value="owner" disabled>所有者</option></select></label></fieldset></form>');
  const select=$('#role'),admin=$('[role="radio"][value="admin"]');
  assert.equal($('[role="radiogroup"]').getAttribute('aria-label'),'选择角色');
  assert.equal($('[role="radio"][value="owner"]').disabled,true);
  select.disabled=true;await settle();assert.equal(admin.disabled,true);admin.click();assert.equal(select.value,'member');
  select.disabled=false;await settle();assert.equal(admin.disabled,false);
  $('fieldset').disabled=true;await settle();assert.equal(admin.disabled,true);assert.equal(new win.FormData($('form')).has('role'),false);
  $('fieldset').disabled=false;await settle();assert.equal(admin.disabled,false);
  admin.click();await settle();assert.equal(select.value,'admin');
});

test('legacy value events and native reset update choices without remounting hidden or edited controls',async()=>{
  renderMarkup(root,'<form><div hidden><select id="month" name="month" aria-label="月份"><option value="all">全年</option><option value="11" selected>11月</option></select></div></form>');
  const select=$('#month'),group=$('[role="radiogroup"]');
  select.value='all';select.dispatchEvent(new win.Event('change',{bubbles:true}));await settle();
  assert.equal($('[role="radio"][data-state="checked"]').value,'all');
  enhanceUi(root);enhanceUi(root);assert.equal($('#month'),select);assert.equal($('[role="radiogroup"]'),group);
  assert.equal(new win.FormData($('form')).get('month'),'all');
  $('form').reset();await settle();assert.equal(select.value,'11');assert.equal($('[role="radio"][data-state="checked"]').value,'11');
});

test('Radix owns arrow navigation and user text remains plain text',async()=>{
  renderMarkup(root,'<label>判断<select name="judgment"><option value="first">第一项</option><option value="second">&lt;img src=x onerror=alert(1)&gt;</option><option value="third">第三项</option></select></label>');
  const first=$('[role="radio"][value="first"]');first.focus();
  first.dispatchEvent(new win.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));await settle();
  assert.equal(document.activeElement,$('[role="radio"][value="second"]'));
  assert.equal($('select').value,'second');assert.equal(root.querySelector('img'),null);
  assert.equal($('[role="radio"][value="second"]').textContent,'<img src=x onerror=alert(1)>');
  assert.equal($$('[role="radio"][tabindex="0"]').length,1);
});
