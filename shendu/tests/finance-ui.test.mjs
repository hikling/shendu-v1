import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import {mountFinancePage,mountDailyFinance} from '../public/finance-ui.js';
import {DEFAULT_FINANCE_CATEGORIES,parseMoneyExpression,suggestFinanceCategory} from '../public/finance-domain.js';

const dom=new JSDOM('<main id="app"></main><div id="modal-root"></div>',{url:'https://shendu.test',pretendToBeVisual:true}),win=dom.window;
for(const key of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement','HTMLSelectElement','HTMLButtonElement','HTMLFormElement','Element','DocumentFragment','Node','NodeFilter','Event','CustomEvent','KeyboardEvent','MouseEvent','MutationObserver','getComputedStyle','FormData'])globalThis[key]=win[key];
Object.defineProperty(globalThis,'navigator',{value:win.navigator,configurable:true});
globalThis.requestAnimationFrame=win.requestAnimationFrame.bind(win);globalThis.cancelAnimationFrame=win.cancelAnimationFrame.bind(win);globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
win.HTMLElement.prototype.scrollIntoView=function(){};
const originalBounds=win.HTMLElement.prototype.getBoundingClientRect;win.HTMLElement.prototype.getBoundingClientRect=function(){return this.classList.contains('recharts-responsive-container')?{width:300,height:230,top:0,left:0,right:300,bottom:230,x:0,y:0,toJSON(){return this}}:originalBounds.call(this)};
const ui=await import('../public/ui/shadcn.js');
const $=(selector,root=document)=>root.querySelector(selector),$$=(selector,root=document)=>[...root.querySelectorAll(selector)],flush=async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve))};
let controller;

function fixture({daily=false,readonly=false,snapshot,draft,handler,receiptClient,initialEntries=[],initialStorage}={}){
  ui.disposeUi($('#app'));ui.disposeUi($('#modal-root'));$('#app').replaceChildren();$('#modal-root').replaceChildren();
  const root=document.createElement('section');$('#app').append(root);let current=true,pending=false;
  const calls=[],notices=[],drafts=[],dirty=[],ended=[];let savedStorage=initialStorage||{configured:false,config:{},version:0,receiptCount:0,disconnected:false,targets:[{id:'storage-target',name:'自己的S3'}]};let entries=structuredClone(initialEntries),categories=DEFAULT_FINANCE_CATEGORIES.map(category=>({...category,version:0})),nextCursor=null;
  const result=(date)=>{const selected=entries.filter(row=>!date||row.date===date),active=selected.filter(row=>!row.deletedAt),totals=new Map();for(const row of active)if(row.kind==='expense')totals.set(row.categoryId,(totals.get(row.categoryId)||0)+row.amountCents);const expenseCents=active.filter(row=>row.kind==='expense').reduce((sum,row)=>sum+row.amountCents,0),refundCents=active.filter(row=>row.kind==='refund').reduce((sum,row)=>sum+row.amountCents,0);return {categories,entries:structuredClone(selected),nextCursor,summary:{incomeCents:0,expenseCents,refundCents,netExpenseCents:expenseCents-refundCents,balanceCents:refundCents-expenseCents,count:active.length},trend:[],categoryTotals:[],expenseCategoryTotals:[...totals].map(([categoryId,cents])=>({categoryId,name:categories.find(row=>row.id===categoryId)?.name||'待分类',cents})),day:{date:date||'2026-11-15',state:selected.length?'recorded':'unrecorded',version:0}}};
  const request=async(path,args={},guard=()=>true)=>{
    calls.push({path,args,guard});const intercepted=handler?.(path,args,guard);if(intercepted!==undefined)return await intercepted;
    if(path==='/api/finance/storage/test')return {ok:true};
    if(path==='/api/finance/storage'){
      if(args.method==='PUT'){const {secretKey,...config}=args.body.config;savedStorage={...savedStorage,configured:true,config,version:savedStorage.version+1,disconnected:false}}
      if(args.method==='DELETE')savedStorage={...savedStorage,configured:false,config:null,version:savedStorage.version+1,disconnected:Boolean(savedStorage.receiptCount)};
      return structuredClone(savedStorage);
    }
    if(path.startsWith('/api/finance?'))return result(new URL(path,'https://shendu.test').searchParams.get('date'));
    if(path==='/api/finance/entries'&&args.method==='POST'){let categoryId=args.body.categoryId;if(!categoryId){const found=suggestFinanceCategory(args.body.purpose,categories,'expense');if(found!=='uncategorized')categoryId=found;else{let category=categories.find(row=>row.name===args.body.purpose);if(!category){category={id:globalThis.crypto.randomUUID(),name:args.body.purpose,keywords:[],active:true,version:1};categories.push(category)}categoryId=category.id}}const entry={...args.body,categoryId,amountCents:parseMoneyExpression(args.body.expression),version:1,createdAt:'2026-11-15T00:00:00Z',updatedAt:'2026-11-15T00:00:00Z',deletedAt:null};entries.unshift(entry);return {entry}}
    if(path==='/api/finance/day')return {day:args.body};
    if(path==='/api/finance/categories'){const category={...args.body,version:1};categories.push(category);return {category}}
    if(path.startsWith('/api/finance/categories/')){const category={...args.body,id:decodeURIComponent(path.split('/').at(-1))};categories=categories.map(row=>row.id===category.id?category:row);return {category}}
    if(path.endsWith('/restore')){const entry=entries.find(row=>row.id===path.split('/').at(-2));entry.deletedAt=null;entry.version++;return {entry}}
    if(args.method==='DELETE'){const entry=entries.find(row=>row.id===path.split('/').at(-1));entry.deletedAt='2026-11-15T01:00:00Z';entry.version++;return {entry}}
    if(args.method==='PUT'){const entry=entries.find(row=>row.id===path.split('/').at(-1));Object.assign(entry,args.body,{version:entry.version+1,amountCents:parseMoneyExpression(args.body.expression)});return {entry}}
    throw new Error(`Unexpected ${path}`);
  };
  const options={request,renderMarkup:ui.renderMarkup,today:()=> '2026-11-15',isCurrent:()=>current,toast:(...args)=>notices.push(args),setDirty:value=>dirty.push(value),onDraftChange:value=>drafts.push(value),beginWrite:()=>{if(pending)return null;pending=true;return {}},endWrite:token=>{pending=false;ended.push(token)},showMonthPicker:ui.showFinanceMonthPicker,showFinanceDayPicker:ui.showFinanceDayPicker,showFinancePie:ui.showFinancePie,openModal:(html,className='')=>ui.renderMarkup($('#modal-root'),`<section class="modal ${className}">${html}</section>`),closeModal:force=>{if($('#modal-root').dataset.persistent==='1'&&!force)return;ui.disposeUi($('#modal-root'));$('#modal-root').replaceChildren();$('#modal-root').dataset.persistent='0'},receiptClient};
  controller=daily?mountDailyFinance(root,{...options,date:'2026-11-15',readonly,snapshot,draft}):mountFinancePage(root,options);
  return {root,calls,notices,drafts,dirty,ended,request,result,setEntries:value=>{entries=value},setCategories:value=>{categories=value},setCursor:value=>{nextCursor=value},setCurrent:value=>{current=value},pending:()=>pending};
}
function input(form,name,value){const field=form.elements[name];field.value=value;field.dispatchEvent(new win.Event('input',{bubbles:true}));return field}
function change(form,name,value){const field=form.elements[name];if(field.type==='checkbox')field.checked=value;else field.value=value;field.dispatchEvent(new win.Event('change',{bubbles:true}));return field}
function openBatch(root){$('[data-finance-detail]',root).click();$('[data-manual-batch]').click();return $('#finance-import-form')}
function submit(form){form.dispatchEvent(new win.Event('submit',{bubbles:true,cancelable:true}))}

test('refund-only month and day retain signed net values without inventing negative pie slices',async()=>{
  const refund={id:'refund',date:'2026-11-15',kind:'refund',amountCents:3000,categoryId:'shopping',receiptIds:[]};
  const f=fixture({handler:path=>path.startsWith('/api/finance?')?{categories:DEFAULT_FINANCE_CATEGORIES,entries:[refund],summary:{expenseCents:0,refundCents:3000,netExpenseCents:-3000,count:1},expenseCategoryTotals:[],trend:[]}:undefined});await flush();
  assert.match($('.finance-stat-expense',f.root).textContent,/-30\.00/);assert.equal($('[data-finance-trend]',f.root),null);assert.equal($('[data-finance-categories]',f.root),null);
  for(const selector of ['[data-finance-month-pie]','[data-finance-day-pie]']){const chart=$(selector,f.root);assert.match(chart.textContent,/没有支出/);assert.match(chart.textContent,/退款.*¥30\.00.*净支出.*−¥30\.00/);assert.equal($('[data-slot="chart"]',chart),null)}
});

test('month and day use independent full-period positive categories and retain the mounted entry on refresh',async()=>{
  const monthly={categories:DEFAULT_FINANCE_CATEGORIES,entries:[],summary:{expenseCents:3000,refundCents:4000,netExpenseCents:-1000,count:4},expenseCategoryTotals:[{categoryId:'food',name:'餐饮',cents:2000},{categoryId:'transport',name:'交通',cents:1000}],trend:[]};
  let daily={...monthly,summary:{expenseCents:800,refundCents:800,netExpenseCents:0},expenseCategoryTotals:[{categoryId:'food',name:'餐饮',cents:800}]};
  const f=fixture({handler:path=>path.startsWith('/api/finance?')?(path.includes('date=')?daily:monthly):undefined});await flush();
  const form=$('[data-finance-create]',f.root),field=input(form,'text','8+8 早餐'),month=$('[data-finance-month-pie]',f.root),day=$('[data-finance-day-pie]',f.root);
  assert.match(month.textContent,/¥30\.00/);assert.match(month.textContent,/餐饮.*¥20\.00.*66\.7%/);assert.match(day.textContent,/¥8\.00.*100%/);assert.match(day.textContent,/退款.*¥8\.00.*净支出.*¥0\.00/);assert.ok($('[data-slot="chart"]',month));
  daily={...daily,summary:{expenseCents:500,refundCents:0,netExpenseCents:500},expenseCategoryTotals:[{categoryId:'transport',name:'交通',cents:500}]};$('[data-finance-refresh]',f.root).click();await flush();assert.equal(form.elements.text,field);assert.equal(field.value,'8+8 早餐');assert.match(day.textContent,/交通.*¥5\.00.*100%/);assert.equal(f.calls.some(call=>call.args.method==='POST'),false);
});

for(const daily of [false,true])test(`shared ${daily?'daily':'finance'} textarea previews each line and confirms only explicit entries`,async()=>{
  const f=fixture({daily});await flush();const form=$('[data-finance-create]',f.root),field=input(form,'text','60 打车\n50 吃饭');
  assert.equal(field.tagName,'TEXTAREA');assert.equal($('[data-finance-calculation]',form).textContent,'2 笔待入账 · 合计 ¥110.00');assert.deepEqual($$('[data-line-category]',form).map(select=>select.value),['transport','food']);assert.equal(f.calls.filter(call=>call.args.method==='POST').length,0);
  const category=$$('[data-line-category]',form)[1];assert.equal(category.getAttribute('aria-hidden'),'true');assert.ok($('.sd-finance-select [data-slot="select-trigger"]',form));assert.equal($('[role="radiogroup"]',form),null);category.value='shopping';category.dispatchEvent(new win.Event('change',{bubbles:true}));
  submit(form);submit(form);await flush();const writes=f.calls.filter(call=>call.path==='/api/finance/entries');assert.equal(writes.length,2);assert.deepEqual(writes.map(call=>[call.args.body.expression,call.args.body.purpose,call.args.body.categoryId]),[['60','打车','transport'],['50','吃饭','shopping']]);assert.ok(writes.every(call=>call.args.body.source===(daily?'daily':'finance')));assert.notEqual(writes[0].args.body.id,writes[1].args.body.id);
  assert.equal(form.elements.text,field);assert.equal(field.value,'');assert.match($('[data-finance-entries]',f.root).textContent,/打车/);assert.equal(controller.hasPendingDraft(),false);
});

test('legacy daily draft retains note and receipts on failure, retry ID and mounted textarea',async()=>{
  let rejectWrite;let attempts=0;const f=fixture({daily:true,draft:{expression:'8+8',purpose:'早餐',note:'保留的旧备注',categoryId:'shopping',receiptIds:['old-receipt']},receiptClient:{loadReceiptUrls:async()=>({})},handler:(path,args)=>{if(path==='/api/finance/entries'&&++attempts===1)return new Promise((_,reject)=>{rejectWrite=reject})}});await flush();
  const form=$('[data-finance-create]',f.root),field=form.elements.text;assert.equal(field.value,'8+8 早餐');assert.match($('[data-finance-legacy-note]',form).textContent,/旧备注.*1 张截图/);submit(form);submit(form);await flush();assert.equal(f.calls.filter(call=>call.path==='/api/finance/entries').length,1);assert.equal($('fieldset',form).disabled,true);assert.equal(f.pending(),true);
  rejectWrite(new Error('网络暂时不可用'));await flush();assert.equal(form.elements.text,field);assert.equal(field.value,'8+8 早餐');assert.equal($('fieldset',form).disabled,false);assert.match($('[data-form-error]',form).textContent,/网络/);assert.equal(controller.hasPendingDraft(),true);
  submit(form);await flush();const writes=f.calls.filter(call=>call.path==='/api/finance/entries');assert.equal(writes[0].args.body.id,writes[1].args.body.id);assert.equal(writes[1].args.body.categoryId,'shopping');assert.equal(writes[1].args.body.note,'保留的旧备注');assert.deepEqual(writes[1].args.body.receiptIds,['old-receipt']);assert.equal(f.drafts.at(-1).text,'');assert.equal(f.pending(),false);
});

test('single pending category correction and detail edits preserve the legacy draft until confirmed',async()=>{
  const f=fixture({daily:true,draft:{expression:'8+8-1',purpose:'早餐',note:'原备注',receiptIds:['retained-receipt']},receiptClient:{loadReceiptUrls:async()=>({})}});await flush();const quick=$('[data-finance-create]',f.root),field=quick.elements.text,category=$('[data-line-category]',quick);category.value='shopping';category.dispatchEvent(new win.Event('change',{bubbles:true}));assert.equal(f.drafts.at(-1).categoryId,'shopping');$('[data-finance-detail]',f.root).click();let detail=$('#finance-detail-form');const cancel=$('[data-clear-entry]',detail);assert.equal(cancel.textContent,'取消');cancel.click();await flush();assert.equal($('#finance-detail-form'),null);assert.equal(field.value,'8+8-1 早餐');assert.equal(f.calls.some(call=>call.args.method==='POST'),false);$('[data-finance-detail]',f.root).click();detail=$('#finance-detail-form');assert.equal(detail.elements.expression.value,'8+8-1');assert.equal(detail.elements.categoryId.value,'shopping');assert.equal(detail.elements.note.value,'原备注');input(detail,'note','更正后的备注');assert.equal(field.value,'8+8-1 早餐');assert.equal(f.drafts.at(-1).note,'更正后的备注');submit(detail);await flush();const write=f.calls.find(call=>call.path==='/api/finance/entries');assert.deepEqual(write.args.body.receiptIds,['retained-receipt']);assert.equal(write.args.body.note,'更正后的备注');assert.equal(write.args.body.categoryId,'shopping');assert.equal(field.value,'');assert.equal(quick.elements.text,field);assert.equal(controller.hasPendingDraft(),false);
});

test('invalid lines show physical line numbers and block the entire confirmation without losing text',async()=>{
  const f=fixture();await flush();const form=$('[data-finance-create]',f.root),field=input(form,'text','60 打车\n\n8+ 早餐');submit(form);await flush();assert.equal(document.activeElement,field);assert.equal(field.value,'60 打车\n\n8+ 早餐');assert.match($('[data-finance-line-errors]',form).textContent,/第 3 行/);assert.ok($('[data-form-error]',form).textContent);assert.equal(f.calls.filter(call=>call.args.method==='POST').length,0);
});

test('refreshed account categories update automatic suggestions while preserving manual choices',async()=>{
  const f=fixture();await flush();const form=$('[data-finance-create]',f.root),field=input(form,'text','10 文具\n20 午饭');
  const selected=$$('[data-line-category]',form)[1];selected.value='shopping';selected.dispatchEvent(new win.Event('change',{bubbles:true}));
  f.setCategories([...DEFAULT_FINANCE_CATEGORIES,{id:'stationery',name:'文具',keywords:['文具'],active:true}]);$('[data-finance-refresh]',f.root).click();await flush();
  assert.deepEqual($$('[data-line-category]',form).map(node=>node.value),['stationery','shopping']);assert.equal(form.elements.text,field);assert.equal(field.value,'10 文具\n20 午饭');assert.equal(f.calls.some(call=>call.args.method==='POST'),false);
});

test('a category refresh after an uncertain create keeps the original retry identity and payload',async()=>{
  let failed=false;const f=fixture({handler:(path,args)=>{if(path==='/api/finance/entries'&&!failed){failed=true;return Promise.reject(new Error('响应中断，请重试'))}}});await flush();const form=$('[data-finance-create]',f.root);input(form,'text','10 装裱');submit(form);await flush();
  f.setCategories([...DEFAULT_FINANCE_CATEGORIES,{id:'framing',name:'装裱',keywords:['装裱'],active:true}]);$('[data-finance-refresh]',f.root).click();await flush();submit(form);await flush();
  const writes=f.calls.filter(call=>call.path==='/api/finance/entries');assert.equal(writes.length,2);assert.deepEqual(writes[1].args.body,writes[0].args.body);assert.equal(writes[0].args.body.categoryId,'');assert.equal(form.elements.text.value,'');
});

test('filters and pagination refresh only the ledger while preserving unsaved form nodes and search focus',async()=>{
  const f=fixture();await flush();const form=$('[data-finance-create]',f.root),field=input(form,'text','12.50 午餐'),search=$('input[name="q"]',f.root);
  f.setCursor('next-page');$('[data-finance-refresh]',f.root).click();await flush();search.value='午餐';search.focus();search.dispatchEvent(new win.Event('input',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,250));await flush();
  assert.equal($('[data-finance-create]',f.root),form);assert.equal(form.elements.text,field);assert.equal(field.value,'12.50 午餐');assert.equal(document.activeElement,search);assert.ok(f.calls.some(call=>call.path.includes('q=%E5%8D%88%E9%A4%90')));
  $('[data-finance-more]',f.root).click();await flush();assert.ok(f.calls.some(call=>call.path.includes('cursor=next-page')));
});

test('snapshot-only history never requests or displays the current account ledger',()=>{
  const f=fixture({daily:true,readonly:true,snapshot:{netExpenseCents:2300,state:'recorded',count:1,entries:[{kind:'expense',amountCents:2300,purpose:'<script>旧花销</script>',categoryName:'餐饮'}]}});
  assert.equal(f.calls.length,0);assert.match(f.root.textContent,/23.00/);assert.match(f.root.textContent,/<script>旧花销<\/script>/);assert.equal($('script',f.root),null);assert.equal($('form',f.root),null);assert.equal(controller.hasPendingDraft(),false);
});

test('obsolete reads and writes cannot replace a newer account surface or clear its draft',async()=>{
  let finishLoad;const f=fixture({handler:path=>path.startsWith('/api/finance?')?new Promise(resolve=>{finishLoad=resolve}):undefined});await flush();f.setCurrent(false);finishLoad({entries:[{id:'foreign',purpose:'不能显示'}],categories:[],summary:{}});await flush();assert.doesNotMatch(f.root.textContent,/不能显示/);
  controller.dispose();let finishWrite;const next=fixture({daily:true,handler:(path,args)=>path==='/api/finance/entries'?new Promise(resolve=>{finishWrite=resolve}):undefined});await flush();const form=$('[data-finance-create]',next.root);input(form,'text','20 原账户输入');submit(form);await flush();next.setCurrent(false);finishWrite({entry:{}});await flush();assert.equal(form.elements.text.value,'20 原账户输入');assert.equal(next.notices.length,0);assert.equal(next.drafts.at(-1).text,'20 原账户输入');assert.equal(next.pending(),false);
});

test('refund creation from the daily widget keeps original association and does not consume its unfinished entry',async()=>{
  const f=fixture({daily:true,initialEntries:[{id:'expense-id',date:'2026-11-15',kind:'expense',expression:'50',amountCents:5000,purpose:'午餐',categoryId:'food',version:2,receiptIds:[]}]});await flush();
  const original=$('[data-finance-create]',f.root);input(original,'text','8 还没记的早餐');$('[data-entry-action="refund"]',f.root).click();const form=$('#finance-edit-form');assert.ok(form.elements.kind);assert.equal(form.elements.kind.value,'refund');assert.equal(form.elements.refundOf.value,'expense-id');input(form,'expression','10');submit(form);await flush();
  const write=f.calls.find(call=>call.path==='/api/finance/entries');assert.equal(write.args.body.kind,'refund');assert.equal(write.args.body.refundOf,'expense-id');assert.equal(original.elements.text.value,'8 还没记的早餐');assert.equal(controller.hasPendingDraft(),true);assert.equal($('#finance-edit-form'),null);
});

test('delete and restore keep the selected version and truthful deleted state',async()=>{
  const f=fixture({initialEntries:[{id:'delete-id',date:'2026-11-15',kind:'expense',expression:'8',amountCents:800,purpose:'早餐',categoryId:'food',version:3,receiptIds:[]}]});await flush();$('[data-entry-action="delete"]',f.root).click();submit($('#finance-delete-form'));await flush();
  const deletion=f.calls.find(call=>call.args.method==='DELETE');assert.deepEqual(deletion.args.body,{version:3});assert.ok($('.finance-entry.is-deleted',f.root));$('[data-entry-action="restore"]',f.root).click();await flush();const restoration=f.calls.find(call=>call.path.endsWith('/restore'));assert.deepEqual(restoration.args.body,{version:4});assert.equal($('.finance-entry.is-deleted',f.root),null);
});

test('category management is removed and failed storage save preserves inputs for retry',async()=>{
  let failStorage=true;const f=fixture({handler:(path,args)=>{if(path==='/api/finance/storage'&&args.method==='PUT'&&failStorage){failStorage=false;return Promise.reject(new Error('存储暂不可达'))}}});await flush();assert.equal($('[data-manage-categories]',f.root),null);assert.doesNotMatch(f.root.textContent,/查看月份/);let form;
  $('[data-finance-storage]',f.root).click();await flush();form=$('#finance-storage-form');input(form,'endpoint','https://storage.example.com');input(form,'bucket','private-receipts');input(form,'secretKey','never-log-this');submit(form);await flush();assert.equal(form.elements.secretKey.value,'never-log-this');assert.match($('[data-form-error]',form).textContent,/存储/);assert.equal($('fieldset',form).disabled,false);submit(form);await flush();assert.equal(f.calls.filter(call=>call.path==='/api/finance/storage'&&call.args.method==='PUT').length,2);
});

test('screenshot candidates require confirmation, skip guessed refunds and survive partial import retry',async()=>{
  let secondId,fail=true;const f=fixture({receiptClient:{processReceiptFiles:async()=>({candidates:[{expression:'8',purpose:'早餐',categoryId:'food',kind:'expense',receiptIds:['receipt-a']},{expression:'12',purpose:'午餐',categoryId:'food',kind:'expense',receiptIds:['receipt-b']},{expression:'2',purpose:'退回款项',categoryId:'food',kind:'refund'}],warnings:['请核对日期'],receiptIds:['receipt-a','receipt-b']}),loadReceiptUrls:async()=>({})},handler:(path,args)=>{if(path==='/api/finance/entries'&&args.body.purpose==='午餐'){if(!secondId)secondId=args.body.id;if(fail){fail=false;return Promise.reject(new Error('第二笔失败'))}}}});await flush();
  const fileInput=$('[data-finance-files]',f.root);Object.defineProperty(fileInput,'files',{configurable:true,value:[new win.File(['image'],'receipt.png',{type:'image/png'})]});fileInput.dispatchEvent(new win.Event('change',{bubbles:true}));await flush();let form=$('#finance-import-form');assert.ok(form);assert.equal(f.calls.filter(call=>call.path==='/api/finance/entries').length,0);assert.equal(form.elements['select-2'].checked,false);submit(form);await flush();assert.match($('[data-import-index="0"] [data-import-result]',form).textContent,/已入账/);assert.match($('[data-form-error]',form).textContent,/第二笔失败/);submit(form);await flush();
  const writes=f.calls.filter(call=>call.path==='/api/finance/entries');assert.equal(writes.length,3);assert.equal(writes[1].args.body.id,writes[2].args.body.id);assert.equal(writes[0].args.body.receiptIds[0],'receipt-a');assert.equal(writes.some(call=>call.args.body.kind==='refund'),false);assert.equal($('#finance-import-form'),null);
});

test('late modal saves do not close or unprotect a replacement reauthentication surface',async()=>{
  let finishWrite;const f=fixture({initialEntries:[{id:'old-entry',date:'2026-11-15',kind:'expense',expression:'8',amountCents:800,purpose:'早餐',categoryId:'food',version:1,receiptIds:[]}],handler:(path,args)=>path==='/api/finance/entries/old-entry'&&args.method==='PUT'?new Promise(resolve=>{finishWrite=resolve}):undefined});await flush();
  $('[data-entry-action="edit"]',f.root).click();const form=$('#finance-edit-form');input(form,'expression','9');submit(form);await flush();assert.equal($('#modal-root').dataset.persistent,'1');
  ui.renderMarkup($('#modal-root'),'<section class="modal" id="replacement-reauth"><h2>重新登录</h2><input type="password" value="留在当前表单"></section>');$('#modal-root').dataset.persistent='1';
  finishWrite({entry:{}});await flush();assert.ok($('#replacement-reauth'));assert.equal($('#modal-root').dataset.persistent,'1');assert.equal($('input',$('#replacement-reauth')).value,'留在当前表单');assert.equal(f.notices.length,0);
});

function selectScreenshot(f){const fileInput=$('[data-finance-files]',f.root);Object.defineProperty(fileInput,'files',{configurable:true,value:[new win.File(['image'],'receipt.png',{type:'image/png'})]});fileInput.dispatchEvent(new win.Event('change',{bubbles:true}))}

test('cancel screenshot processing promptly releases write state and ignores a late recognizer result',async()=>{
  let finish,signal,disposed=0;const f=fixture({receiptClient:{processReceiptFiles:async(files,options)=>{signal=options.signal;return new Promise(resolve=>{finish=resolve})},disposeReceiptWorker:()=>disposed++}});await flush();
  const form=$('[data-finance-create]',f.root);input(form,'text','7 手填草稿');selectScreenshot(f);await flush();assert.equal(f.pending(),true);assert.equal($('[data-cancel-import]',f.root).hidden,false);
  $('[data-cancel-import]',f.root).click();await flush();assert.equal(signal.aborted,true);assert.equal(f.pending(),false);assert.equal($('fieldset',form).disabled,false);assert.equal($('[data-cancel-import]',f.root).hidden,true);assert.equal(form.elements.text.value,'7 手填草稿');assert.equal(disposed,1);assert.match($('[data-finance-status]',f.root).textContent,/已取消/);
  finish({candidates:[{expression:'99',purpose:'过期结果'}]});await flush();assert.equal($('#finance-import-form'),null);assert.equal(f.calls.filter(call=>call.path==='/api/finance/entries').length,0);
});

test('disposing processing aborts its owner and cannot update a replacement page',async()=>{
  let finish,signal;const f=fixture({receiptClient:{processReceiptFiles:async(files,options)=>{signal=options.signal;return new Promise(resolve=>{finish=resolve})},disposeReceiptWorker(){}}});await flush();selectScreenshot(f);await flush();controller.dispose();await flush();assert.equal(signal.aborted,true);assert.equal(f.pending(),false);finish({candidates:[{expression:'22'}]});await flush();assert.equal($('#finance-import-form'),null);
});

test('canceling a low-confidence preview creates no entries and duplicate candidates require an explicit selection',async()=>{
  const f=fixture({initialEntries:[{id:'prior',date:'2026-11-15',kind:'expense',expression:'8',amountCents:800,purpose:'早餐',categoryId:'food',version:1,receiptIds:[]}],receiptClient:{processReceiptFiles:async()=>({candidates:[{expression:'8',date:'2026-11-15',kind:'expense',purpose:'早餐',confidence:'low',warnings:['日期需要核对']},{expression:'12',kind:'expense',purpose:'午餐',confidence:'medium'}],warnings:[]})}});await flush();selectScreenshot(f);await flush();const form=$('#finance-import-form');assert.match(form.textContent,/请仔细核对/);assert.match(form.textContent,/疑似重复/);assert.equal(form.elements['select-0'].checked,false);assert.equal(form.elements['select-1'].checked,true);assert.match(form.textContent,/日期需要核对/);
  $('[data-close]',form).click(); // The app owns close handling; simulate the same successful close here.
  ui.renderMarkup($('#modal-root'),'');await flush();assert.equal(f.calls.filter(call=>call.path==='/api/finance/entries').length,0);assert.equal(f.pending(),false);
  selectScreenshot(f);await flush();const next=$('#finance-import-form');next.elements['select-0'].checked=true;next.elements['select-1'].checked=false;next.elements['acknowledge-0'].checked=true;submit(next);await flush();assert.equal(f.calls.filter(call=>call.path==='/api/finance/entries').length,1);assert.equal(f.calls.find(call=>call.path==='/api/finance/entries').args.body.expression,'8');
});

for(const daily of [false,true])test(`receipt lists ${daily?'inside a daily review':'on the finance page'} contain no thumbnails or eager image authorization`,async()=>{
  const reads=[];const f=fixture({daily,initialEntries:[{id:'photo-entry',date:'2026-11-15',kind:'expense',expression:'8',amountCents:800,purpose:'早餐',categoryId:'food',version:1,receiptIds:['receipt']}],receiptClient:{loadReceiptUrls:async(ids,variant)=>{reads.push({ids,variant});throw new Error('过期授权')}}});await flush();
  assert.equal(reads.length,0);assert.equal($$('img,[data-receipt-thumb],.finance-receipt-thumb', $('[data-finance-entries]',f.root)).length,0);
  const links=$$('[data-receipt-open]',f.root);assert.equal(links.length,1);assert.equal(links[0].textContent,'查看截图 · 1 张');
  links[0].click();await flush();assert.deepEqual(reads,[{ids:['receipt'],variant:'image'}]);assert.match($('[data-finance-image-status]').textContent,/过期授权/);assert.equal($('[data-finance-image-retry]').hidden,false);
});

test('storage save explicitly explains the page refresh needed for changed image access permissions',async()=>{
  const f=fixture();await flush();$('[data-finance-storage]',f.root).click();await flush();const form=$('#finance-storage-form');input(form,'endpoint','https://storage.example.com');input(form,'bucket','private');submit(form);await flush();assert.match($('[data-storage-note]',f.root).textContent,/保存未入账内容.*刷新页面/);assert.match(f.notices.at(-1)[0],/刷新页面/);
});

const photoEntry={id:'photo-entry',date:'2026-11-15',kind:'expense',expression:'8',amountCents:800,purpose:'早餐',categoryId:'food',version:1,receiptIds:['receipt-a','receipt-b']};

test('receipt preview uses the clicked entry metadata even when two entries share the same image',async()=>{
  const other={...photoEntry,id:'other-entry',date:'2026-11-14',kind:'income',purpose:'稿酬 <img src=x onerror=bad()>',amountCents:12600,categoryId:'salary',receiptIds:['receipt-a']},reads=[];
  const f=fixture({initialEntries:[photoEntry,other],receiptClient:{loadReceiptUrls:async(ids,variant)=>{reads.push({ids,variant});return {[ids[0]]:'https://private.example.com/shared.webp'}}}});await flush();
  const row=$('[data-entry-id="other-entry"]',f.root);assert.equal($('.finance-entry-heading h3',row).textContent,other.purpose);assert.equal($$('.finance-entry-tag',row).length,2);assert.ok($('.finance-entry-footer .finance-entry-actions',row));
  $('.finance-receipt-link',row).click();await flush();const modal=$('.finance-image-dialog');assert.equal($('.modal-head h2',modal).textContent,other.purpose);assert.equal($('.modal-head img',modal),null);assert.equal($('.finance-receipt-amount',modal).textContent,'+¥126.00');assert.equal($('time',modal).textContent,'2026-11-14');assert.equal($('time',modal).dateTime,'2026-11-14');assert.match($('.finance-receipt-details',modal).textContent,/收入.*工资/);assert.doesNotMatch(modal.textContent,/账目截图|原图未上传/);
  assert.deepEqual(reads,[{ids:['receipt-a'],variant:'image'}]);assert.equal($('.finance-image-navigation',modal).hidden,true);
  $('.finance-receipt-link',$('[data-entry-id="photo-entry"]',f.root)).click();await flush();assert.equal($('.modal-head h2',$('.finance-image-dialog')).textContent,'早餐');assert.equal($('.finance-receipt-amount').textContent,'−¥8.00');assert.equal($('time',$('.finance-image-dialog')).textContent,'2026-11-15');assert.equal(reads.length,2);
});

test('receipt gallery opens one image at a time and isolates rapid next/back requests and old image events',async()=>{
  const reads=[];const f=fixture({initialEntries:[photoEntry],receiptClient:{loadReceiptUrls:async(ids,variant,options)=>{assert.equal(variant,'image');return new Promise((resolve,reject)=>reads.push({ids,resolve,reject,current:options.isCurrent}))}}});await flush();
  $('.finance-receipt-link',f.root).click();await flush();const view=$('[data-finance-image-view]'),firstImage=$('img',view),previous=$('[data-finance-image-previous]'),next=$('[data-finance-image-next]');
  assert.equal(reads.length,1);assert.deepEqual(reads[0].ids,['receipt-a']);assert.equal(previous.disabled,true);assert.equal(next.disabled,false);assert.equal($('[data-finance-image-position]').textContent,'1 / 2');
  previous.dispatchEvent(new win.Event('click'));await flush();assert.equal(reads.length,1);
  next.click();await flush();assert.deepEqual(reads[1].ids,['receipt-b']);assert.equal(reads[0].current(),false);assert.equal(previous.disabled,false);assert.equal(next.disabled,true);assert.equal($('[data-finance-image-position]').textContent,'2 / 2');
  next.dispatchEvent(new win.Event('click'));await flush();assert.equal(reads.length,2);
  previous.click();await flush();assert.deepEqual(reads[2].ids,['receipt-a']);assert.equal(reads[1].current(),false);assert.equal(reads[2].current(),true);
  reads[0].resolve({'receipt-a':'https://private.example.com/stale-a.webp'});reads[1].reject(new Error('过时的下一张失败'));reads[2].resolve({'receipt-a':'https://private.example.com/final-a.webp'});await flush();
  const active=$('img',view);assert.match(active.src,/final-a.webp/);assert.equal($('[data-finance-image-view]'),view);active.dispatchEvent(new win.Event('load'));firstImage.dispatchEvent(new win.Event('error'));assert.equal($('[data-finance-image-status]').hidden,true);assert.equal($('[data-finance-image-retry]').hidden,true);assert.doesNotMatch(view.textContent,/过时的/);
  ui.renderMarkup($('#modal-root'),'');assert.equal(reads[2].current(),false);next.dispatchEvent(new win.Event('click'));await flush();assert.equal(reads.length,3);
});

test('full-image load failure offers a retry that obtains fresh authorization without replacing the modal',async()=>{
  const reads=[];const f=fixture({initialEntries:[photoEntry],receiptClient:{loadReceiptUrls:async(ids,variant)=>{assert.equal(variant,'image');reads.push(ids);return {[ids[0]]:`https://private.example.com/image.webp?signature=${reads.length}`}}}});await flush();
  $('[data-receipt-open="receipt-a"]',f.root).click();await flush();const view=$('[data-finance-image-view]'),image=$('img',view),message=$('[data-finance-image-status]',view),retry=$('[data-finance-image-retry]');assert.equal(reads.length,1);assert.match(image.src,/signature=1/);
  image.dispatchEvent(new win.Event('error'));assert.equal(image.hidden,true);assert.equal(message.hidden,false);assert.match(message.textContent,/截图加载失败.*授权已过期/);assert.equal(retry.hidden,false);
  retry.click();await flush();assert.equal($('[data-finance-image-view]'),view);assert.equal(reads.length,2);const refreshed=$('img',view);assert.notEqual(refreshed,image);assert.match(refreshed.src,/signature=2/);refreshed.dispatchEvent(new win.Event('load'));assert.equal(message.hidden,true);assert.equal(refreshed.hidden,false);assert.equal(retry.hidden,true);
  image.dispatchEvent(new win.Event('error'));assert.equal(message.hidden,true);assert.equal(f.calls.filter(call=>call.path==='/api/finance/entries').length,0);
});

test('a late full-image authorization cannot replace a newer same-account reauthentication modal',async()=>{
  let finish,guard;const f=fixture({initialEntries:[photoEntry],receiptClient:{loadReceiptUrls:async(ids,variant,options)=>{assert.equal(variant,'image');guard=options.isCurrent;return new Promise(resolve=>{finish=resolve})}}});await flush();$('[data-receipt-open="receipt-a"]',f.root).click();await flush();assert.equal(guard(),true);
  ui.renderMarkup($('#modal-root'),'<section class="modal" id="replacement-reauth"><h2>重新登录</h2><input type="password" value="保持当前输入"></section>');$('#modal-root').dataset.persistent='1';assert.equal(guard(),false);
  finish({'receipt-a':'https://private.example.com/stale.webp'});await flush();assert.ok($('#replacement-reauth'));assert.equal($('input',$('#replacement-reauth')).value,'保持当前输入');assert.equal($('#modal-root').dataset.persistent,'1');assert.equal($('[data-finance-image-view]'),null);assert.equal(f.notices.length,0);
});

test('old image-read failures stay silent while the latest receipt keeps its own inline retry',async()=>{
  const reads=[];const f=fixture({initialEntries:[photoEntry],receiptClient:{loadReceiptUrls:async(ids,variant,options)=>{assert.equal(variant,'image');return new Promise((resolve,reject)=>reads.push({ids,resolve,reject,current:options.isCurrent}))}}});await flush();
  $('[data-receipt-open="receipt-a"]',f.root).click();await flush();$('[data-finance-image-next]').click();await flush();assert.equal(reads[0].current(),false);assert.equal(reads[1].current(),true);const view=$('[data-finance-image-view]');
  reads[0].reject(new Error('旧截图错误不能出现'));reads[1].reject(new Error('图片授权暂时不可用'));await flush();assert.equal($('[data-finance-image-view]'),view);assert.match(view.textContent,/图片授权暂时不可用/);assert.doesNotMatch(view.textContent,/旧截图错误/);assert.equal($('[data-finance-image-retry]').hidden,false);assert.equal(f.notices.length,0);
  $('[data-finance-image-retry]').click();$('[data-finance-image-retry]').dispatchEvent(new win.Event('click'));await flush();assert.equal(reads.length,3);assert.deepEqual(reads[2].ids,['receipt-b']);reads[2].resolve({'receipt-b':'https://private.example.com/latest.webp'});await flush();assert.match($('img',view).src,/latest\.webp/);
});

for(const daily of [false,true])test(`manual multi-entry ${daily?'daily':'finance'} flow preserves mounted rows and saves only explicitly confirmed rows`,async()=>{
  const f=fixture({daily});await flush();const single=$('[data-finance-create]',f.root),unfinished=input(single,'text','9 保留单笔草稿');const form=openBatch(f.root);assert.match($('#modal-root').textContent,/记下多笔收支/);assert.equal($$('[data-import-index]',form).length,2);
  const first=input(form,'expression-0','8+8+8-1');input(form,'purpose-0','早餐');assert.equal(form.elements['category-0'].value,'food');assert.equal($('[data-import-index="0"] output',form).textContent,'合计 ¥23.00');change(form,'category-0','shopping');input(form,'purpose-0','早餐和日用品');input(form,'note-0','可选备注');assert.equal(form.elements['category-0'].value,'shopping');
  $('[data-import-add]',form).click();assert.equal($$('[data-import-index]',form).length,3);assert.equal(form.elements['expression-0'],first);assert.equal(first.value,'8+8+8-1');$('[data-import-remove="1"]',form).click();assert.equal($$('[data-import-index]',form).length,2);assert.equal(form.elements['expression-0'],first);assert.equal(form.elements['expression-1'],undefined);
  change(form,'kind-2','income');input(form,'expression-2','100');input(form,'purpose-2','工资');assert.equal(form.elements['category-2'].value,'salary');assert.equal(f.calls.filter(call=>call.path==='/api/finance/entries').length,0);submit(form);await flush();const writes=f.calls.filter(call=>call.path==='/api/finance/entries');assert.equal(writes.length,2);assert.equal(writes[0].args.body.expression,'8+8+8-1');assert.equal(writes[0].args.body.categoryId,'shopping');assert.equal(writes[0].args.body.note,'可选备注');assert.equal(writes[1].args.body.kind,'income');assert.equal(writes[1].args.body.categoryId,'salary');assert.equal(writes[0].args.body.source,daily?'daily':'finance');assert.notEqual(writes[0].args.body.id,writes[1].args.body.id);assert.equal(single.elements.text,unfinished);assert.equal(unfinished.value,'9 保留单笔草稿');assert.equal(controller.hasPendingDraft(),true);
});

test('manual multi-entry partial success preserves retry IDs and guards add/remove while a write is pending',async()=>{
  let rejectSecond,failed=false;const f=fixture({handler:(path,args)=>{if(path==='/api/finance/entries'&&args.body.purpose==='午餐'&&!failed){failed=true;return new Promise((_,reject)=>{rejectSecond=reject})}}});await flush();const form=openBatch(f.root);input(form,'expression-0','8');input(form,'purpose-0','早餐');input(form,'expression-1','12');input(form,'purpose-1','午餐');submit(form);submit(form);await flush();assert.equal(f.pending(),true);assert.equal(f.calls.filter(call=>call.path==='/api/finance/entries').length,2);
  $('[data-import-add]',form).dispatchEvent(new win.Event('click',{bubbles:true}));$('[data-import-remove="1"]',form).dispatchEvent(new win.Event('click',{bubbles:true}));assert.equal($$('[data-import-index]',form).length,2);rejectSecond(new Error('第二笔失败'));await flush();assert.equal($('[data-import-index="0"]',form).dataset.importDone,'true');assert.equal($('[data-import-remove="0"]',form).disabled,true);assert.equal(form.elements['expression-1'].value,'12');assert.match($('[data-form-error]',form).textContent,/第二笔失败/);
  const retained=form.elements['expression-1'];$('[data-import-add]',form).click();input(form,'expression-2','7');input(form,'purpose-2','打车');assert.equal(form.elements['expression-1'],retained);submit(form);await flush();const writes=f.calls.filter(call=>call.path==='/api/finance/entries');assert.equal(writes.length,4);assert.equal(writes[1].args.body.id,writes[2].args.body.id);assert.equal(writes.filter(call=>call.args.body.purpose==='早餐').length,1);assert.equal(writes[3].args.body.categoryId,'transport');assert.equal($('#finance-import-form'),null);
});

test('an obsolete account surface cannot open a manual batch dialog or mutate an already mounted batch',async()=>{
  const f=fixture();await flush();const button=$('[data-finance-detail]',f.root);f.setCurrent(false);button.click();assert.equal($('#finance-detail-form'),null);f.setCurrent(true);const form=openBatch(f.root);input(form,'expression-0','8');input(form,'purpose-0','早餐');input(form,'expression-1','12');input(form,'purpose-1','午餐');const rows=$$('[data-import-index]',form);
  f.setCurrent(false);$('[data-import-add]',form).click();$('[data-import-remove="0"]',form).click();submit(form);await flush();assert.deepEqual($$('[data-import-index]',form),rows);assert.equal(form.elements['expression-0'].value,'8');assert.equal(f.calls.filter(call=>call.path==='/api/finance/entries').length,0);assert.equal(f.pending(),false);
});

test('IME composition never searches unfinished text, and clear restores the list without replacing the draft',async()=>{
  const f=fixture();await flush();const form=$('[data-finance-create]',f.root),draft=input(form,'text','12 午餐'),search=$('input[name="q"]',f.root),filters=$('[data-finance-filters]',f.root),clear=$('[data-finance-clear-search]',f.root),loads=()=>f.calls.filter(call=>call.path.startsWith('/api/finance?month=')).length;
  const initial=loads();search.value='w';search.dispatchEvent(new win.Event('input',{bubbles:true}));search.dispatchEvent(new win.Event('compositionstart',{bubbles:true}));search.value='午';search.dispatchEvent(new win.InputEvent('input',{bubbles:true,isComposing:true}));submit(filters);await new Promise(resolve=>setTimeout(resolve,250));await flush();assert.equal(loads(),initial);
  search.value='午餐';search.dispatchEvent(new win.Event('compositionend',{bubbles:true}));search.dispatchEvent(new win.InputEvent('input',{bubbles:true,isComposing:false}));await new Promise(resolve=>setTimeout(resolve,250));await flush();assert.equal(loads(),initial+1);assert.ok(f.calls.filter(call=>call.path.startsWith('/api/finance?month=')).at(-1).path.includes('q=%E5%8D%88%E9%A4%90'));assert.equal(clear.hidden,false);
  clear.click();await flush();assert.equal(loads(),initial+2);assert.equal(search.value,'');assert.equal(clear.hidden,true);assert.equal(document.activeElement,search);assert.equal($('[data-finance-create]',f.root),form);assert.equal(form.elements.text,draft);assert.equal(draft.value,'12 午餐');assert.equal(f.calls.filter(call=>call.path.startsWith('/api/finance?month=')).at(-1).path.includes('q='),false);await new Promise(resolve=>setTimeout(resolve,250));assert.equal(loads(),initial+2);
});

test('partial textarea confirmation removes committed lines and retries only the remaining stable IDs',async()=>{
  let rejectSecond,failed=false;const f=fixture({daily:true,handler:(path,args)=>{if(path==='/api/finance/entries'&&args.body.purpose==='吃饭'&&!failed){failed=true;return new Promise((_,reject)=>{rejectSecond=reject})}}});await flush();
  const form=$('[data-finance-create]',f.root),field=input(form,'text','60 打车\n50 吃饭\n20 咖啡');submit(form);submit(form);await flush();assert.equal(f.calls.filter(call=>call.path==='/api/finance/entries').length,2);assert.equal(field.value,'50 吃饭\n20 咖啡');assert.equal(f.drafts.at(-1).text,'50 吃饭\n20 咖啡');assert.equal($('fieldset',form).disabled,true);
  rejectSecond(new Error('第二笔暂未成功'));await flush();assert.match($('[data-form-error]',form).textContent,/第二笔/);assert.equal(controller.hasPendingDraft(),true);input(form,'text','50 吃饭\n20 咖啡\n8 早餐');submit(form);await flush();
  const writes=f.calls.filter(call=>call.path==='/api/finance/entries');assert.equal(writes.length,5);assert.equal(writes[1].args.body.id,writes[2].args.body.id);assert.equal(writes.filter(call=>call.args.body.purpose==='打车').length,1);assert.deepEqual(writes.slice(2).map(call=>call.args.body.purpose),['吃饭','咖啡','早餐']);assert.equal(field.value,'');assert.equal(form.elements.text,field);assert.equal(controller.hasPendingDraft(),false);
});

test('editing a failed pending line creates a new ID while committed text stays removed',async()=>{
  let failed=false;const f=fixture({handler:(path,args)=>{if(path==='/api/finance/entries'&&args.body.purpose==='吃饭'&&!failed){failed=true;return Promise.reject(new Error('网络中断'))}}});await flush();const form=$('[data-finance-create]',f.root);input(form,'text','60 打车\n50 吃饭');submit(form);await flush();assert.equal(form.elements.text.value,'50 吃饭');input(form,'text','45 午饭');submit(form);await flush();const writes=f.calls.filter(call=>call.path==='/api/finance/entries');assert.equal(writes.length,3);assert.notEqual(writes[1].args.body.id,writes[2].args.body.id);assert.equal(writes.filter(call=>call.args.body.purpose==='打车').length,1);assert.equal(writes[2].args.body.expression,'45');
});

test('identical lines stay distinct, retain retry order and never remove the wrong physical line',async()=>{
  let failed=false;const f=fixture({handler:(path,args)=>{if(path==='/api/finance/entries'&&!failed){failed=true;return Promise.reject(new Error('再试一次'))}}});await flush();const form=$('[data-finance-create]',f.root);input(form,'text','8 早餐\n\n8 早餐');submit(form);await flush();submit(form);await flush();const writes=f.calls.filter(call=>call.path==='/api/finance/entries');assert.equal(writes.length,3);assert.equal(writes[0].args.body.id,writes[1].args.body.id);assert.notEqual(writes[1].args.body.id,writes[2].args.body.id);assert.equal(form.elements.text.value.trim(),'');assert.equal(controller.hasPendingDraft(),false);
});

test('textarea composition preserves the active native node, caret and draft without early writes',async()=>{
  const f=fixture({daily:true,draft:{text:'8+8-1 早餐'}});await flush();const form=$('[data-finance-create]',f.root),field=form.elements.text;field.focus();field.dispatchEvent(new win.Event('compositionstart',{bubbles:true}));field.value='60 打车\n50 吃';field.setSelectionRange(9,9);field.dispatchEvent(new win.InputEvent('input',{bubbles:true,isComposing:true}));assert.equal(f.drafts.at(-1).text,field.value);assert.equal(document.activeElement,field);assert.equal(form.elements.text,field);assert.equal(field.selectionStart,9);submit(form);await flush();assert.equal(f.calls.filter(call=>call.args.method==='POST').length,0);field.value='60 打车\n50 吃饭';field.dispatchEvent(new win.Event('compositionend',{bubbles:true}));assert.match($('[data-finance-calculation]',form).textContent,/110\.00/);assert.equal(controller.hasPendingDraft(),true);
});

test('ledger shows the amount only on the right and preserves original expressions in edit forms',async()=>{
  const f=fixture({initialEntries:[{id:'vegetables',date:'2026-11-15',kind:'expense',expression:'8+8-1',amountCents:1500,purpose:'买菜',categoryId:'food',note:'晚饭用',receiptIds:[],version:1},{id:'refund',date:'2026-11-15',kind:'refund',expression:'2',amountCents:200,purpose:'退菜',categoryId:'food',refundOf:'vegetables',receiptIds:[],version:1}]});await flush();
  const row=$('[data-entry-id="vegetables"]',f.root),copy=$('.finance-entry-copy',row);
  assert.match(copy.textContent,/买菜/);assert.match(copy.textContent,/晚饭用/);assert.doesNotMatch(copy.textContent,/8\+8-1|15\.00/);
  assert.equal($('.finance-entry-amount',row).textContent,'−¥15.00');assert.match($('[data-entry-id="refund"] .finance-entry-copy',f.root).textContent,/已关联原支出/);
  $('[data-entry-action="edit"]',row).click();assert.equal($('#finance-edit-form').elements.expression.value,'8+8-1');
});

test('secondary detail retains exact expressions, income and transfers with compact categories',async()=>{
  const f=fixture();await flush();const filters=$('[data-finance-filters]',f.root);assert.equal(filters.elements.kind.dataset.slot,'native-select');assert.equal(filters.elements.category,undefined);assert.doesNotMatch(filters.textContent,/账目分类|全部分类/);assert.equal($('[role="radiogroup"]',filters),null);assert.equal($('input[type="month"]',f.root),null);assert.ok($('[data-finance-period]',f.root));
  for(const kind of ['income','transfer']){$('[data-finance-detail]',f.root).click();const form=$('#finance-detail-form');change(form,'kind',kind);input(form,'expression','8+8+8-1');input(form,'purpose',kind==='income'?'工资':'账户间转入');assert.equal($('[data-finance-calculation]',form).textContent,'合计 ¥23.00');assert.equal(form.elements.categoryId.dataset.slot,'native-select');submit(form);await flush()}
  const writes=f.calls.filter(call=>call.path==='/api/finance/entries');assert.deepEqual(writes.map(call=>call.args.body.kind),['income','transfer']);assert.equal(writes[0].args.body.expression,'8+8+8-1');assert.equal(writes[0].args.body.categoryId,'salary');assert.equal($('#finance-detail-form'),null);
});

test('actual month controls load only accepted month changes and disable during entry writes',async()=>{
  let finish;const f=fixture({handler:(path,args)=>path==='/api/finance/entries'?new Promise(resolve=>{finish=resolve}):undefined});await flush();const host=$('[data-finance-period]',f.root),next=$('[aria-label="下个月"]',host),trigger=$('[data-slot="dropdown-menu-trigger"]',host),form=$('[data-finance-create]',f.root),field=input(form,'text','8 早餐'),loads=()=>f.calls.filter(call=>call.path.startsWith('/api/finance?month=')).length;
  assert.equal(typeof ui.showFinanceMonthPicker,'function');const initial=loads();trigger.dispatchEvent(new win.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));await flush();assert.ok($('.finance-period-menu'));assert.equal(loads(),initial);$('[aria-label="下一年"]').click();await flush();assert.equal(loads(),initial);$('[aria-label="2027年1月"]').click();await flush();assert.equal(loads(),initial+1);assert.ok(f.calls.some(call=>call.path.includes('month=2027-01')));assert.match($('.finance-writing>.finance-section-title',f.root).textContent,/记入 2026-11-15/);assert.equal($('[aria-label="下个月"]',host),next);assert.equal(form.elements.text,field);assert.equal(field.value,'8 早餐');
  submit(form);await flush();assert.equal(next.disabled,true);next.click();await flush();assert.equal(loads(),initial+1);assert.equal(f.calls.find(call=>call.path==='/api/finance/entries').args.body.date,'2026-11-15');finish({entry:{}});await flush();assert.equal(next.disabled,false);assert.equal(loads(),initial+2);f.setCurrent(false);next.click();await flush();assert.equal(loads(),initial+2);
});

test('finance hidden controls override the component button display and recover when revealed',async()=>{
  const style=document.createElement('style');style.textContent='.btn{display:inline-flex}'+readFileSync(new URL('../public/finance.css',import.meta.url),'utf8');document.head.append(style);
  try{for(const daily of [false,true]){controller?.dispose();const f=fixture({daily});await flush();for(const selector of ['[data-cancel-import]','[data-finance-more]']){const button=$(selector,f.root);assert.equal(button.hidden,true);assert.equal(win.getComputedStyle(button).display,'none');button.hidden=false;assert.notEqual(win.getComputedStyle(button).display,'none')}}}finally{style.remove()}
});

test.afterEach(()=>{controller?.dispose();ui.disposeUi($('#app'));ui.disposeUi($('#modal-root'));$('#app').replaceChildren();$('#modal-root').replaceChildren()});
test.after(()=>dom.window.close());

test('pie groups only more than six categories, preserves every amount and escapes category text',async()=>{
  const totals=Array.from({length:8},(_,index)=>({categoryId:`category-${index}`,name:index===0?'<img src=x onerror=alert(1)>':`分类${index}`,cents:(8-index)*100})),six=ui.financePieData(totals.slice(0,6)),eight=ui.financePieData(totals);
  assert.equal(six.slices.length,6);assert.equal(six.remainder.length,0);assert.equal(eight.slices.length,6);assert.equal(eight.remainder.length,3);assert.equal(eight.slices.reduce((sum,row)=>sum+row.cents,0),3600);
  const f=fixture({handler:path=>path.startsWith('/api/finance?')?{entries:[],summary:{expenseCents:3600,refundCents:0,netExpenseCents:3600},expenseCategoryTotals:totals}:undefined});await flush();
  const host=$('[data-finance-month-pie]',f.root),all=$$('.finance-pie-legend li',host);assert.equal(all.length,9);assert.ok(host.textContent.includes('<img src=x onerror=alert(1)>'));assert.equal($('img',host),null);assert.match($('.finance-pie-breakdown summary',host).textContent,/3 个分类/);assert.ok($('svg.recharts-surface',host));assert.ok($$('.recharts-pie-sector',host).length>0,'real Recharts pie sectors are rendered rather than CSS placeholders');
});

test('the same category keeps its pie color across monthly and daily ranks, renamed labels and grouped breakdowns',()=>{
  const defaults=ui.financePieData(DEFAULT_FINANCE_CATEGORIES.map(category=>({categoryId:category.id,name:category.name,cents:100})));
  assert.equal(new Set(defaults.categories.map(row=>row.fill)).size,DEFAULT_FINANCE_CATEGORIES.length,'default categories retain distinct colors even when their ranking changes');
  const monthly=ui.financePieData([{categoryId:'food',name:'餐饮',cents:100},{categoryId:'transport',name:'交通',cents:900},{categoryId:'custom-stationery',name:'文具',cents:50}]);
  const daily=ui.financePieData([{categoryId:'custom-stationery',name:'办公用品',cents:700},{categoryId:'food',name:'餐饮',cents:500},{categoryId:'transport',name:'交通',cents:1}]);
  for(const row of monthly.categories)assert.equal(daily.categories.find(item=>item.categoryId===row.categoryId).fill,row.fill);
  const grouped=ui.financePieData([...monthly.categories,...Array.from({length:5},(_,index)=>({categoryId:`extra-${index}`,name:`分类${index}`,cents:1000+index}))]);
  assert.equal(grouped.remainder.find(row=>row.categoryId==='food').fill,monthly.categories.find(row=>row.categoryId==='food').fill);
  assert.equal(grouped.slices.at(-1).fill,ui.financePieData(Array.from({length:7},(_,index)=>({categoryId:`other-${index}`,name:'其他',cents:index+1}))).slices.at(-1).fill);
});

test('date selection requests only that complete day and ignores a late previous-day response',async()=>{
  let releaseOld;const f=fixture({handler:path=>path==='/api/finance?date=2026-11-15'?new Promise(resolve=>{releaseOld=resolve}):path==='/api/finance?date=2026-11-14'?{summary:{expenseCents:1700,refundCents:0,netExpenseCents:1700},expenseCategoryTotals:[{categoryId:'food',name:'餐饮',cents:1700}]}:undefined});await flush();
  const field=input($('[data-finance-create]',f.root),'text','6 还没入账'),picker=$('[data-finance-day-picker]',f.root),trigger=$('button',picker),before=f.calls.length;trigger.click();await flush();const day=$('[aria-label="2026-11-14"]');assert.ok(day);assert.equal(f.calls.length,before,'opening the calendar never loads data');day.click();await flush();
  const chart=$('[data-finance-day-pie]',f.root);assert.match(chart.textContent,/餐饮.*¥17\.00/);assert.ok(trigger.getAttribute('aria-label').includes('2026-11-14'));assert.equal(f.calls.filter(call=>call.path==='/api/finance?date=2026-11-14').length,1);
  releaseOld({summary:{expenseCents:99900,refundCents:0,netExpenseCents:99900},expenseCategoryTotals:[{categoryId:'shopping',name:'旧日期',cents:99900}]});await flush();assert.doesNotMatch(chart.textContent,/旧日期|999\.00/);assert.equal($('[data-finance-create]',f.root).elements.text,field);assert.equal(field.value,'6 还没入账');assert.equal(f.calls.some(call=>call.args.method==='POST'),false);
});

test('historical months default to latest spending date or actual month end, and day failures retry without writes',async()=>{
  let failDay=true;const f=fixture({handler:path=>path.startsWith('/api/finance?month=2026-10')?{entries:[],summary:{expenseCents:1000},expenseCategoryTotals:[{categoryId:'food',name:'餐饮',cents:1000}],trend:[{date:'2026-10-03',spendingCents:1000},{date:'2026-10-29',spendingCents:0}]}:path==='/api/finance?date=2026-10-03'&&failDay?Promise.reject(new Error('当天离线')):undefined});await flush();
  const month=$('[data-finance-period]',f.root);$('[aria-label="上个月"]',month).click();await flush();assert.ok($('button',[...$$('[data-finance-day-picker]',f.root)][0]).getAttribute('aria-label').includes('2026-10-03'));assert.match($('[data-finance-day-pie]',f.root).textContent,/当天离线/);const retry=$('[data-finance-day-retry]',f.root);assert.equal(retry.hidden,false);failDay=false;retry.click();await flush();assert.equal(retry.hidden,true);assert.match($('[data-finance-day-pie]',f.root).textContent,/没有支出/);
  $('[aria-label="上个月"]',month).click();await flush();assert.ok($('button',$('[data-finance-day-picker]',f.root)).getAttribute('aria-label').includes('2026-09-30'));assert.ok(f.calls.some(call=>call.path==='/api/finance?date=2026-09-30'));assert.equal(f.calls.some(call=>call.args.method==='POST'),false);
});


test('unknown quick-entry purposes show their own classification and save automatically without category writes',async()=>{
  const f=fixture();await flush();const form=$('[data-finance-create]',f.root);input(form,'text','60 修鞋');
  assert.match($('[data-finance-line-preview]',form).textContent,/自动分类：修鞋/);assert.equal(f.calls.some(call=>call.args.method==='POST'),false);
  submit(form);await flush();const write=f.calls.find(call=>call.path==='/api/finance/entries');assert.equal(write.args.body.categoryId,'');assert.equal(write.args.body.purpose,'修鞋');assert.match($('[data-finance-entries]',f.root).textContent,/修鞋/);assert.equal(f.calls.some(call=>call.path.includes('/categories')),false);
});

test('detailed and multi-entry auto labels use unknown purposes while manual choices remain explicit',async()=>{
  const f=fixture();await flush();$('[data-finance-detail]',f.root).click();let form=$('#finance-detail-form');assert.ok(form.closest('.finance-detail-dialog'));input(form,'expression','30');input(form,'purpose','修鞋');assert.equal(form.elements.categoryId.value,'');assert.match($('[data-category-hint]',form).textContent,/修鞋/);submit(form);await flush();assert.equal(f.calls.find(call=>call.path==='/api/finance/entries').args.body.categoryId,'');
  form=openBatch(f.root);input(form,'expression-0','80');input(form,'purpose-0','稿酬');change(form,'kind-0','income');assert.equal(form.elements['category-0'].value,'');assert.match($('[data-import-category-hint]',form).textContent,/稿酬/);input(form,'expression-1','6');input(form,'purpose-1','早餐');change(form,'category-1','shopping');submit(form);await flush();const writes=f.calls.filter(call=>call.path==='/api/finance/entries');assert.equal(writes[1].args.body.categoryId,'');assert.equal(writes[2].args.body.categoryId,'shopping');
});

test('ledger receipt count links open the private image and upload explicitly awaits confirmation',async()=>{
  const reads=[];const f=fixture({initialEntries:[photoEntry],receiptClient:{loadReceiptUrls:async(ids,variant)=>{reads.push({ids,variant});return {[ids[0]]:'https://private.example.com/photo.webp'}},processReceiptFiles:async()=>({candidates:[{expression:'5',purpose:'吃饭',kind:'expense',receiptIds:['new-photo']}],receiptIds:['new-photo'],warnings:[]})}});await flush();const link=$('.finance-receipt-link',f.root);assert.equal(link.textContent,'查看截图 · 2 张');link.click();await flush();assert.ok($('[data-finance-image-view]'));assert.deepEqual(reads.find(read=>read.variant==='image').ids,['receipt-a']);
  ui.disposeUi($('#modal-root'));$('#modal-root').replaceChildren();selectScreenshot(f);await flush();assert.match($('[data-finance-status]',f.root).textContent,/尚未入账/);assert.match($('#finance-import-form').textContent,/已附 1 张压缩截图/);assert.equal(f.calls.some(call=>call.path==='/api/finance/entries'),false);submit($('#finance-import-form'));await flush();assert.deepEqual(f.calls.find(call=>call.path==='/api/finance/entries').args.body.receiptIds,['new-photo']);assert.ok($('[data-receipt-open="new-photo"]',f.root));
});

test('detailed entry keeps automatic quick suggestions live and preserves explicit legacy categories on edits',async()=>{
  const f=fixture({initialEntries:[{id:'legacy',date:'2026-11-15',kind:'expense',expression:'4',amountCents:400,purpose:'旧用途',categoryId:'uncategorized',receiptIds:[],version:1}]});await flush();
  const quick=$('[data-finance-create]',f.root);input(quick,'text','60 早餐');$('[data-finance-detail]',f.root).click();let form=$('#finance-detail-form');
  assert.equal(form.elements.categoryId.value,'food');input(form,'purpose','打车');assert.equal(form.elements.categoryId.value,'transport');submit(form);await flush();
  assert.equal(f.calls.find(call=>call.path==='/api/finance/entries').args.body.categoryId,'transport');
  $('[data-entry-action="edit"][data-id="legacy"]',f.root).click();form=$('#finance-edit-form');assert.ok(form);assert.equal(form.elements.categoryId.value,'uncategorized');input(form,'expression','5');submit(form);await flush();
  assert.equal(f.calls.find(call=>call.path==='/api/finance/entries/legacy'&&call.args.method==='PUT').args.body.categoryId,'uncategorized');
});


const storedImageConfig={configured:true,version:4,receiptCount:2,disconnected:false,config:{endpoint:'https://private.example.com',region:'auto',bucket:'photos',directory:'receipts',accessKey:'access-id',pathStyle:true},targets:[]};
function setFiles(field){Object.defineProperty(field,'files',{configurable:true,value:[new win.File(['image'],'receipt.png',{type:'image/png'})]});field.dispatchEvent(new win.Event('change',{bubbles:true}))}

test('storage test sends unsaved form values without saving, blocks duplicate work, and invalidates a prior success after edits',async()=>{
  let finish;const f=fixture({initialStorage:storedImageConfig,handler:(path,args)=>path==='/api/finance/storage/test'?new Promise(resolve=>{finish=resolve}):undefined});await flush();$('[data-finance-storage]',f.root).click();await flush();
  const form=$('#finance-storage-form');assert.ok(form.closest('.finance-detail-dialog'));assert.equal(form.elements.secretKey.value,'');input(form,'endpoint','https://changed.example.com');input(form,'secretKey','new-private-secret');
  $('[data-storage-test]',form).click();$('[data-storage-test]',form).dispatchEvent(new win.Event('click'));await flush();
  const tests=f.calls.filter(call=>call.path==='/api/finance/storage/test');assert.equal(tests.length,1);assert.equal(tests[0].args.body.config.endpoint,'https://changed.example.com');assert.equal(tests[0].args.body.config.secretKey,'new-private-secret');assert.equal(tests[0].args.body.version,4);
  assert.equal($('fieldset',form).disabled,true);assert.equal($('#modal-root').dataset.persistent,'1');assert.equal(f.calls.some(call=>call.args.method==='PUT'),false);
  finish({ok:true});await flush();assert.equal($('fieldset',form).disabled,false);assert.match($('[data-storage-status]',form).textContent,/测试通过.*尚未保存.*跨域/);assert.equal(form.elements.secretKey.value,'new-private-secret');
  input(form,'bucket','other');assert.doesNotMatch($('[data-storage-status]',form).textContent,/测试通过/);assert.equal($('[data-storage-status]',form).classList.contains('is-success'),false);
});

test('storage test failures keep edited credentials and configuration for correction and retry',async()=>{
  const f=fixture({initialStorage:storedImageConfig,handler:path=>path==='/api/finance/storage/test'?Promise.reject(new Error('存储权限不足')):undefined});await flush();$('[data-finance-storage]',f.root).click();await flush();const form=$('#finance-storage-form');input(form,'secretKey','correctable-secret');$('[data-storage-test]',form).click();await flush();
  assert.equal(form.elements.secretKey.value,'correctable-secret');assert.match($('[data-form-error]',form).textContent,/权限不足/);assert.match($('[data-storage-status]',form).textContent,/测试未通过/);assert.equal($('fieldset',form).disabled,false);assert.equal(f.calls.some(call=>call.args.method==='PUT'||call.args.method==='DELETE'),false);
});

test('a late storage-test result cannot modify a replacement modal',async()=>{
  let finish,guard;const f=fixture({initialStorage:storedImageConfig,handler:(path,args,current)=>{if(path==='/api/finance/storage/test'){guard=current;return new Promise(resolve=>{finish=resolve})}}});await flush();$('[data-finance-storage]',f.root).click();await flush();const form=$('#finance-storage-form');$('[data-storage-test]',form).click();await flush();assert.equal(guard(),true);
  ui.renderMarkup($('#modal-root'),'<section id="replacement"><input value="保留新的输入"></section>');assert.equal(guard(),false);finish({ok:true});await flush();assert.equal($('#replacement input').value,'保留新的输入');assert.doesNotMatch($('#replacement').textContent,/测试通过/);assert.equal(f.notices.length,0);
});

test('deleting storage requires confirmation, keeps external photos, and uses the saved version',async()=>{
  const f=fixture({initialStorage:storedImageConfig});await flush();$('[data-finance-storage]',f.root).click();await flush();const form=$('#finance-storage-form');$('[data-storage-delete]',form).click();await flush();
  const confirmation=$('[data-storage-delete-confirm]',form);assert.equal(confirmation.hidden,false);assert.match(confirmation.textContent,/不会删除账目或S3图片/);assert.equal(f.calls.some(call=>call.args.method==='DELETE'),false);
  $('[data-storage-delete-cancel]',form).click();assert.equal(confirmation.hidden,true);assert.equal(form.elements.bucket.value,'photos');$('[data-storage-delete]',form).click();$('[data-storage-delete-apply]',form).click();await flush();
  const deletion=f.calls.find(call=>call.path==='/api/finance/storage'&&call.args.method==='DELETE');assert.deepEqual(deletion.args.body,{version:4});assert.equal($('#finance-storage-form'),null);assert.match(f.notices.at(-1)[0],/账目和S3图片保留/);
  $('[data-finance-storage]',f.root).click();await flush();assert.match($('#finance-storage-form').textContent,/配置已删除.*2 张凭证.*原存储位置/);assert.equal($('#finance-storage-form').elements.secretKey.value,'');
});

test('recognition-only confirmation explicitly acknowledges that the screenshot is not stored',async()=>{
  const f=fixture({receiptClient:{processReceiptFiles:async()=>({candidates:[{expression:'6',purpose:'吃饭',kind:'expense',receiptIds:[]}],receiptIds:[],imageStatus:'not_stored',warnings:['尚未配置图片存储']})}});await flush();selectScreenshot(f);await flush();const form=$('#finance-import-form');assert.match(form.textContent,/截图未保存/);submit(form);await flush();assert.equal(f.calls.some(call=>call.path==='/api/finance/entries'),false);assert.match($('[data-form-error]',form).textContent,/未保存截图/);
  change(form,'acknowledge-0',true);submit(form);await flush();assert.deepEqual(f.calls.find(call=>call.path==='/api/finance/entries').args.body.receiptIds,[]);
});

test('failed configured screenshot processing opens no normal confirmation and preserves the manual draft',async()=>{
  const f=fixture({receiptClient:{processReceiptFiles:async()=>{throw Object.assign(new Error('图片未能保存，本批次尚未入账'),{code:'receipt_upload_failed'})}}});await flush();const quick=$('[data-finance-create]',f.root),field=input(quick,'text','7 原手填草稿');selectScreenshot(f);await flush();assert.equal($('#finance-import-form'),null);assert.equal(field.value,'7 原手填草稿');assert.match($('[data-finance-status]',f.root).textContent,/未能保存/);assert.equal(f.calls.some(call=>call.path==='/api/finance/entries'),false);
});

test('supplemental screenshots attach only when saving the existing entry and never replace OCR-sensitive fields',async()=>{
  const entry={...photoEntry,id:'repair-entry',version:7,receiptIds:['old-photo']};const f=fixture({initialEntries:[entry],receiptClient:{loadReceiptUrls:async()=>({}),processReceiptFiles:async()=>({receiptIds:['new-photo'],imageStatus:'stored',candidates:[{expression:'999',purpose:'OCR误判'}]})}});await flush();$('[data-entry-action="edit"]',f.root).click();await flush();const form=$('#finance-edit-form');assert.ok(form.closest('.finance-detail-dialog'));input(form,'expression','28.2');input(form,'note','保留手改备注');setFiles($('[data-attach-files]',form));await flush();
  assert.equal(form.elements.expression.value,'28.2');assert.equal(form.elements.purpose.value,'早餐');assert.equal(form.elements.note.value,'保留手改备注');assert.match($('[data-attach-status]',form).textContent,/保存修改/);assert.equal(f.calls.some(call=>call.args.method==='POST'||call.args.method==='PUT'),false);
  submit(form);await flush();const edit=f.calls.find(call=>call.path==='/api/finance/entries/repair-entry');assert.equal(edit.args.method,'PUT');assert.equal(edit.args.body.version,7);assert.equal(edit.args.body.expression,'28.2');assert.equal(edit.args.body.purpose,'早餐');assert.deepEqual(edit.args.body.receiptIds,['old-photo','new-photo']);assert.equal(f.calls.some(call=>call.path==='/api/finance/entries'&&call.args.method==='POST'),false);
});

test('unconfigured supplement errors preserve existing receipts, amount and edit retry',async()=>{
  const f=fixture({initialEntries:[{...photoEntry,receiptIds:['old-photo']}],receiptClient:{loadReceiptUrls:async()=>({}),processReceiptFiles:async()=>({receiptIds:[],imageStatus:'not_stored'})}});await flush();$('[data-entry-action="edit"]',f.root).click();await flush();const form=$('#finance-edit-form');input(form,'expression','12');setFiles($('[data-attach-files]',form));await flush();assert.match($('[data-form-error]',form).textContent,/截图尚未保存/);assert.equal(form.elements.expression.value,'12');assert.equal($('fieldset',form).disabled,false);submit(form);await flush();assert.deepEqual(f.calls.find(call=>call.path==='/api/finance/entries/photo-entry').args.body.receiptIds,['old-photo']);
});

test('canceling supplement releases its owner and ignores a delayed receipt result',async()=>{
  let finish,signal;const f=fixture({initialEntries:[{...photoEntry,receiptIds:[]}],receiptClient:{processReceiptFiles:async(files,args)=>{signal=args.signal;return new Promise(resolve=>{finish=resolve})},disposeReceiptWorker(){}}});await flush();$('[data-entry-action="edit"]',f.root).click();await flush();const form=$('#finance-edit-form');setFiles($('[data-attach-files]',form));await flush();assert.equal(f.pending(),true);assert.equal($('[data-cancel-attach]').hidden,false);$('[data-cancel-attach]').click();await flush();assert.equal(signal.aborted,true);assert.equal(f.pending(),false);assert.match($('[data-attach-status]',form).textContent,/已取消/);finish({receiptIds:['stale-photo'],imageStatus:'stored'});await flush();submit(form);await flush();assert.deepEqual(f.calls.find(call=>call.path==='/api/finance/entries/photo-entry').args.body.receiptIds,[]);
});
