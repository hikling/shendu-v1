import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createElement} from 'react';
import {createPortal} from 'react-dom';

const dom = new JSDOM('<!doctype html><html><body><main id="test-root"></main></body></html>', {url: 'http://localhost/', pretendToBeVisual: true});
for (const name of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLButtonElement', 'Node', 'Event', 'CustomEvent', 'MutationObserver', 'getComputedStyle']) {
  Object.defineProperty(globalThis, name, {value: name === 'getComputedStyle' ? dom.window.getComputedStyle.bind(dom.window) : dom.window[name], configurable: true});
}
Object.defineProperty(globalThis, 'navigator', {value: dom.window.navigator, configurable: true});
globalThis.ResizeObserver = class {observe() {} unobserve() {} disconnect() {}};
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
const {renderMarkup, enhanceUi, disposeUi, mountComponent} = await import('../public/ui/shadcn.js');
const region = document.querySelector('#test-root');
after(() => {disposeUi(region); dom.window.close();});

test('real primitives keep native forms, values, labels, readonly/disabled and file semantics', () => {
  renderMarkup(region, `<form id="review"><section class="card"><label for="sleep">睡眠</label><input id="sleep" name="sleep" type="number" value="7.5" step=".5" min="0" max="24"><textarea name="journal">已保存 &lt;记录&gt;</textarea><select name="scale"><option value="daily">日</option><option value="weekly" selected>周</option></select><input name="files" type="file"><input name="color" type="color" value="#abcdef"><input name="locked" value="只读" readonly><input name="excluded" value="停用" disabled><input name="date" type="hidden" value="2026-11-04"><button>保存</button></section></form>`);
  const form = region.querySelector('form');
  assert.equal(form.querySelector('section').dataset.slot, 'card');
  assert.equal(form.querySelector('#sleep').dataset.slot, 'input');
  assert.equal(form.querySelector('textarea').dataset.slot, 'textarea');
  assert.equal(form.querySelector('select').dataset.slot, 'native-select');
  assert.equal(form.querySelector('label').dataset.slot, 'label');
  assert.equal(form.querySelector('label').control, form.querySelector('#sleep'));
  assert.equal(form.querySelector('button').dataset.slot, 'button');
  assert.equal(form.querySelector('button').type, 'submit');
  assert.equal(form.querySelector('[name=files]').value, '');
  assert.equal(form.querySelector('[name=color]').value, '#abcdef');
  assert.equal(form.querySelector('[name=locked]').readOnly, true);
  const values = new dom.window.FormData(form);
  assert.equal(values.get('sleep'), '7.5');
  assert.equal(values.get('journal'), '已保存 <记录>');
  assert.equal(values.get('scale'), 'weekly');
  assert.equal(values.get('date'), '2026-11-04');
  assert.equal(values.get('locked'), '只读');
  assert.equal(values.has('excluded'), false);
});

test('hidden prompts retain their actual edited fields through repeated enhancement and dynamic answer redraw', () => {
  renderMarkup(region, '<form><div hidden id="past"><textarea name="first">旧答案</textarea></div><section class="card"><input name="energy" type="number" value="0"><div id="answers"><textarea name="second">第二项</textarea></div></section></form>');
  const first = region.querySelector('[name=first]');
  const energy = region.querySelector('[name=energy]');
  first.value = '尚未保存的隐藏答案'; energy.value = '100';
  enhanceUi(region); enhanceUi(region);
  assert.equal(region.querySelector('[name=first]'), first);
  assert.equal(region.querySelector('[name=energy]'), energy);
  renderMarkup(region.querySelector('#answers'), '<textarea name="second">第二项保留</textarea><textarea name="third">新的一项</textarea>');
  const values = new dom.window.FormData(region.querySelector('form'));
  assert.equal(values.get('first'), '尚未保存的隐藏答案');
  assert.equal(values.get('energy'), '100');
  assert.equal(values.get('second'), '第二项保留');
  assert.equal(values.get('third'), '新的一项');
});

test('checkbox adapter exposes real shadcn interaction and native checked/change/FormData contract', async () => {
  renderMarkup(region, '<form><label>显示密码<input id="show-password" name="showPassword" value="yes" type="checkbox"></label><label><input name="enabled" type="checkbox" checked>启用</label></form>');
  const form = region.querySelector('form');
  const native = form.querySelector('#show-password');
  const checkbox = form.querySelector('[data-ui-checkbox-for="show-password"]');
  assert.equal(checkbox.dataset.slot, 'checkbox');
  assert.equal(checkbox.getAttribute('aria-label'), '显示密码');
  assert.equal(native.checked, false);
  assert.equal(new dom.window.FormData(form).get('showPassword'), null);
  let inputs = 0, changes = 0, target;
  native.addEventListener('input', () => inputs++);
  native.addEventListener('change', event => {changes++; target = event.target;});
  checkbox.click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(native.checked, true);
  assert.equal(checkbox.getAttribute('data-state'), 'checked');
  assert.equal(new dom.window.FormData(form).get('showPassword'), 'yes');
  assert.equal(new dom.window.FormData(form).get('enabled'), 'on');
  assert.equal(target, native); assert.equal(inputs, 1); assert.equal(changes, 1);
  checkbox.click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(native.checked, false);
  assert.equal(new dom.window.FormData(form).has('showPassword'), false);
});

test('button HTML remains an opaque writable region and submit/click are native once', () => {
  renderMarkup(region, '<form><button id="save" type="submit" class="btn btn-primary"><span data-label>保存</span><i>↗</i></button><button id="cancel" type="button">取消</button></form>');
  const form = region.querySelector('form');
  let submits = 0, clicks = 0;
  form.addEventListener('submit', event => {event.preventDefault(); submits++;});
  const save = region.querySelector('#save');
  save.addEventListener('click', () => clicks++);
  renderMarkup(save, '<span data-label>正在保存</span>');
  save.disabled = true; save.click();
  assert.equal(submits, 0);
  save.disabled = false; save.click();
  region.querySelector('#cancel').click();
  assert.equal(submits, 1); assert.equal(clicks, 1);
  assert.equal(save.querySelector('[data-label]').textContent, '正在保存');
});

test('replacing a page disposes nested roots deepest first and logical portal ownership', () => {
  const messages = [];
  const original = console.error;
  console.error = (...args) => messages.push(args.join(' '));
  try {
    for (let round = 0; round < 4; round++) renderMarkup(region, '<section class="card"><label>姓名<input name="who"></label><div id="surface"></div></section>');
    const surface = region.querySelector('#surface');
    mountComponent(surface, createPortal(createElement('div', {id: 'test-portal'}, '弹窗'), document.body));
    assert.ok(document.querySelector('#test-portal'));
    renderMarkup(region, '<p>新的页面</p>');
    assert.equal(document.querySelector('#test-portal'), null);
    assert.equal(region.querySelector('[data-ui-mount]'), null);
    assert.deepEqual(messages, []);
  } finally {console.error = original;}
});

test('custom overview geometry and native disclosures stay authored while contained fields adopt primitives', () => {
  renderMarkup(region, '<button class="overview-type-trigger" data-nav="daily" aria-label="进入每日复盘"><span class="overview-type-flip" aria-hidden="true"><span class="overview-type-front">日</span><span class="overview-type-back">每日复盘</span></span></button><div class="overview-reel-track"><button class="overview-record-card">回看</button></div><details><summary>已写下的答案</summary><textarea>保留挂载</textarea></details><div data-ui-native><button>专用控件</button></div>');
  const entry = region.querySelector('.overview-type-trigger');
  assert.equal(entry.hasAttribute('data-slot'), false);
  assert.equal(entry.dataset.nav, 'daily');
  assert.equal(entry.querySelector('.overview-type-back').textContent, '每日复盘');
  let navigations = 0;
  entry.addEventListener('click', () => navigations++);
  entry.querySelector('.overview-type-back').click();
  assert.equal(navigations, 1, 'both faces retain one native navigation owner');
  assert.equal(region.querySelector('.overview-record-card').hasAttribute('data-slot'), false);
  assert.equal(region.querySelector('summary').textContent, '已写下的答案');
  assert.equal(region.querySelector('textarea').dataset.slot, 'textarea');
  assert.equal(region.querySelector('[data-ui-native] button').hasAttribute('data-slot'), false);
});

test('status, stage progress, table and loading feedback use semantic shadcn components', () => {
  renderMarkup(region, '<article class="action-archive-card"><span class="action-state">等待验证</span><div class="progress"><i style="width:42%"></i></div><div class="skeleton" style="height:30px"></div><div class="error-text" id="error"></div><table class="table"><tbody><tr><td><span class="badge">正常</span><button type="button">编辑</button></td></tr></tbody></table></article>');
  assert.equal(region.querySelector('article').dataset.slot, 'card');
  assert.equal(region.querySelector('.action-state').dataset.slot, 'badge');
  assert.equal(region.querySelector('[role=progressbar]').getAttribute('aria-valuenow'), '42');
  assert.equal(region.querySelector('.skeleton').dataset.slot, 'skeleton');
  assert.equal(region.querySelector('#error').getAttribute('role'), 'alert');
  assert.equal(region.querySelector('table').dataset.slot, 'table');
  assert.equal(region.querySelector('td .badge').dataset.slot, 'badge');
  assert.equal(region.querySelector('td button').dataset.slot, 'button');
});

test('external surface update cleans enhanced raw children then recreates unchanged markup safely', () => {
  disposeUi(region); region.replaceChildren();
  const html = '<label>问题<textarea name="answer">初始内容</textarea></label>';
  const element = createElement('section', {dangerouslySetInnerHTML: {__html: html}});
  const surface = mountComponent(region, element);
  enhanceUi(region);
  region.querySelector('textarea').value = '即将重绘';
  surface.update(element);
  enhanceUi(region);
  assert.equal(region.querySelectorAll('textarea').length, 1);
  assert.equal(region.querySelector('textarea').value, '初始内容');
  assert.equal(region.querySelector('textarea').dataset.slot, 'textarea');
});
