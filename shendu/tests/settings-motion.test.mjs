import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
function owner(name,next){
  const start=source.indexOf(`function ${name}(`),end=source.indexOf(`\nfunction ${next}(`,start);
  assert.ok(start>=0&&end>start,`${name} owner exists`);return source.slice(start,end);
}
const legacyTheme=()=>({preset:'自定义',primary:'#FFFFFF',secondary:'#AABBCC',tertiary:'#778899',reduceMotion:false});
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('legacy custom colors retain the approved brand while reduced motion still applies',()=>{
  const dom=new JSDOM('<body></body>'),document=dom.window.document,theme=Object.freeze(legacyTheme()),state={theme};
  const defaults=source.match(/const DEFAULT_ACCENTS = [^\n]+/)[0];
  let canceled=0;
  const apply=new Function('document','state','cancelDailyTypewriter',`${defaults}\n${owner('contrastFor','applyTheme')}\n${owner('applyTheme','beijingDateParts')}\nreturn applyTheme;`)(document,state,()=>{canceled++});
  apply(theme);
  for(const [key,value] of Object.entries({primary:'#176B67',secondary:'#A86436',tertiary:'#536C9C'})){
    assert.equal(document.documentElement.style.getPropertyValue(`--${key}`),value);
    assert.equal(document.documentElement.style.getPropertyValue(`--${key}-contrast`),'#fff');
  }
  assert.equal(document.body.classList.contains('reduce-motion'),false);
  apply({...theme,reduceMotion:true});
  assert.equal(document.body.classList.contains('reduce-motion'),true);
  assert.equal(canceled,1);
  apply();
  assert.equal(document.body.classList.contains('reduce-motion'),false);
  assert.equal(theme.primary,'#FFFFFF');
  dom.window.close();
});

function settingsFixture(requestImpl,theme=legacyTheme()){
  const dom=new JSDOM('<div id="modal-root" data-persistent="0"></div>'),document=dom.window.document;
  const state={user:{displayName:'测试',username:'tester'},theme},calls=[],applied=[],notices=[];
  const $=(selector,root=document)=>root.querySelector(selector),$$=(selector,root=document)=>[...root.querySelectorAll(selector)];
  const openModal=html=>{$('#modal-root').innerHTML=html};
  const request=async(path,options)=>{calls.push({path,...options});return requestImpl(options.body)};
  const open=new Function('document','state','$','$$','openModal','workspaceDialogHead','workspaceArt','openSettingsTarget','FormData','request','applyTheme','toast',`${owner('openSettings','openSettingsTarget')}\nreturn openSettings;`)(
    document,state,$,$$,openModal,()=>'<div class="modal-head"><h2>设置</h2><button data-close type="button">关闭</button></div>',()=>'',()=>{},dom.window.FormData,request,theme=>applied.push(theme),(...args)=>notices.push(args)
  );
  open();
  const form=$('#motion-form'),checkbox=form.elements.reduceMotion;
  const submit=()=>form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
  return {dom,document,state,calls,applied,notices,$,$$,form,checkbox,submit};
}

test('settings saves only motion through the existing API and preserves all legacy theme fields',async()=>{
  let finish;
  const fixture=settingsFixture(()=>new Promise(resolve=>{finish=resolve})),{dom,state,calls,applied,notices,$,$$,form,checkbox,submit}=fixture;
  const original=state.theme;Object.freeze(original);
  assert.deepEqual($$('[data-settings-target]').map(node=>node.dataset.settingsTarget),['account','stage','guide']);
  assert.equal($('input[type="color"],#theme-form,[data-palette]'),null);
  checkbox.checked=true;submit();submit();
  assert.equal(calls.length,1);
  assert.equal(calls[0].path,'/api/settings');assert.equal(calls[0].method,'PUT');
  assert.deepEqual(calls[0].body,{theme:{...original,reduceMotion:true}});
  assert.equal(original.reduceMotion,false);
  assert.equal(form.getAttribute('aria-busy'),'true');
  assert.equal($('fieldset',form).disabled,true);
  assert.equal($('#modal-root').dataset.persistent,'1');
  assert.ok($$('button').every(button=>button.disabled));
  finish({theme:calls[0].body.theme});await flush();
  assert.deepEqual(state.theme,{...original,reduceMotion:true});
  assert.equal(applied[0],state.theme);assert.deepEqual(notices,[['动态偏好已保存']]);
  assert.equal(form.isConnected,true);assert.equal(form.hasAttribute('aria-busy'),false);
  assert.equal($('fieldset',form).disabled,false);assert.equal($('#modal-root').dataset.persistent,'0');
  assert.ok($$('button').every(button=>!button.disabled));
  dom.window.close();
});

test('failed motion save keeps the chosen preference available for retry without changing saved settings',async()=>{
  let attempt=0;
  const {dom,state,calls,notices,form,checkbox,submit,$}=settingsFixture(async body=>{
    if(++attempt===1)throw new Error('连接失败');return {theme:body.theme};
  });
  const original=state.theme;
  checkbox.checked=true;submit();await flush();
  assert.equal(state.theme,original);assert.equal(checkbox.checked,true);
  assert.deepEqual(notices,[['连接失败','error']]);
  assert.equal($('fieldset',form).disabled,false);assert.equal($('#modal-root').dataset.persistent,'0');
  submit();await flush();
  assert.equal(calls.length,2);assert.equal(state.theme.reduceMotion,true);
  assert.equal(state.theme.primary,original.primary);
  dom.window.close();
});

test('unchecking motion persists false and a replaced dialog keeps its own persistent guard',async()=>{
  let finish;
  const {dom,state,calls,applied,$,checkbox,submit}=settingsFixture(()=>new Promise(resolve=>{finish=resolve}),{...legacyTheme(),reduceMotion:true});
  checkbox.checked=false;submit();
  assert.equal(calls[0].body.theme.reduceMotion,false);
  // A session-expiry response may replace settings with a persistent login dialog.
  $('#modal-root').innerHTML='<form id="reauth-form"></form>';
  $('#modal-root').dataset.persistent='1';
  finish({theme:calls[0].body.theme});await flush();
  assert.equal(state.theme.reduceMotion,false);assert.equal(applied.length,1);
  assert.equal($('#modal-root').dataset.persistent,'1');assert.ok($('#reauth-form'));
  dom.window.close();
});
