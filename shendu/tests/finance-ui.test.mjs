import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import {mountFinancePage,mountFinanceAnnualPage,mountDailyFinance} from '../public/finance-ui.js';
import {DEFAULT_FINANCE_CATEGORIES,parseMoneyExpression,parseFinanceLines,suggestFinanceCategory} from '../public/finance-domain.js';

const dom=new JSDOM('<main id="app"></main><div id="modal-root"></div>',{url:'https://shendu.test',pretendToBeVisual:true}),win=dom.window;
for(const key of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement','HTMLSelectElement','HTMLButtonElement','HTMLFormElement','Element','DocumentFragment','Node','NodeFilter','Event','CustomEvent','KeyboardEvent','MouseEvent','MutationObserver','getComputedStyle','FormData'])globalThis[key]=win[key];
Object.defineProperty(globalThis,'navigator',{value:win.navigator,configurable:true});
globalThis.requestAnimationFrame=win.requestAnimationFrame.bind(win);globalThis.cancelAnimationFrame=win.cancelAnimationFrame.bind(win);globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
win.HTMLElement.prototype.scrollIntoView=function(){};
const originalBounds=win.HTMLElement.prototype.getBoundingClientRect;win.HTMLElement.prototype.getBoundingClientRect=function(){return this.classList.contains('recharts-responsive-container')?{width:300,height:230,top:0,left:0,right:300,bottom:230,x:0,y:0,toJSON(){return this}}:originalBounds.call(this)};
const ui=await import('../public/ui/shadcn.js');
const $=(selector,root=document)=>root.querySelector(selector),$$=(selector,root=document)=>[...root.querySelectorAll(selector)],flush=async()=>{for(let i=0;i<16;i++)await new Promise(resolve=>setImmediate(resolve))};
let controller,completeQuickUpload;

function fixture({daily=false,annual=false,readonly=false,snapshot,draft,handler,receiptClient,initialEntries=[],initialStorage,initialMonth,initialYear,onOpenAnnual,onBackToFinance,onSelectMonth}={}){
  ui.disposeUi($('#app'));ui.disposeUi($('#modal-root'));$('#app').replaceChildren();$('#modal-root').replaceChildren();
  const root=document.createElement('section');$('#app').append(root);let current=true,pending=false;
  const calls=[],notices=[],drafts=[],dirty=[],ended=[];let savedStorage=initialStorage||{configured:false,config:{},version:0,receiptCount:0,disconnected:false,targets:[{id:'storage-target',name:'自己的S3'}]};let entries=structuredClone(initialEntries),categories=DEFAULT_FINANCE_CATEGORIES.map(category=>({...category,version:0})),nextCursor=null;
  const result=({date=null,year=null,month=null}={})=>{const selected=entries.filter(row=>date?row.date===date:year?row.date.startsWith(year+'-'):month?row.date.startsWith(month+'-'):true),active=selected.filter(row=>!row.deletedAt),totals=new Map();for(const row of active)if(row.kind==='expense')totals.set(row.categoryId,(totals.get(row.categoryId)||0)+row.amountCents);const expenseCents=active.filter(row=>row.kind==='expense').reduce((sum,row)=>sum+row.amountCents,0),refundCents=active.filter(row=>row.kind==='refund').reduce((sum,row)=>sum+row.amountCents,0);return {categories,entries:structuredClone(selected),nextCursor,summary:{incomeCents:0,expenseCents,refundCents,netExpenseCents:expenseCents-refundCents,balanceCents:refundCents-expenseCents,count:active.length},trend:[],categoryTotals:[],expenseCategoryTotals:[...totals].map(([categoryId,cents])=>({categoryId,name:categories.find(row=>row.id===categoryId)?.name||'待分类',cents})),day:{date:date||'2026-11-15',state:selected.length?'recorded':'unrecorded',version:0}}};
  const request=async(path,args={},guard=()=>true)=>{
    calls.push({path,args,guard});const intercepted=handler?.(path,args,guard);if(intercepted!==undefined)return await intercepted;
    if(path==='/api/finance/storage/test')return {ok:true};
    if(path==='/api/finance/storage'){
      if(args.method==='PUT'){const {secretKey,...config}=args.body.config;savedStorage={...savedStorage,configured:true,config,version:savedStorage.version+1,disconnected:false}}
      if(args.method==='DELETE')savedStorage={...savedStorage,configured:false,config:null,version:savedStorage.version+1,disconnected:Boolean(savedStorage.receiptCount)};
      return structuredClone(savedStorage);
    }
    if(path.startsWith('/api/finance?')){const params=new URL(path,'https://shendu.test').searchParams;return result({date:params.get('date'),year:params.get('year'),month:params.get('month')})}
    if(path==='/api/finance/entries'&&args.method==='POST'){let categoryId=args.body.categoryId;if(!categoryId){const found=suggestFinanceCategory(args.body.purpose,categories,'expense');if(found!=='uncategorized')categoryId=found;else{let category=categories.find(row=>row.name===args.body.purpose);if(!category){category={id:globalThis.crypto.randomUUID(),name:args.body.purpose,keywords:[],active:true,version:1};categories.push(category)}categoryId=category.id}}const entry={...args.body,categoryId,amountCents:parseMoneyExpression(args.body.expression),version:1,createdAt:'2026-11-15T00:00:00Z',updatedAt:'2026-11-15T00:00:00Z',deletedAt:null};entries.unshift(entry);return {entry}}
    if(path==='/api/finance/day')return {day:args.body};
    if(path==='/api/finance/categories'){const category={...args.body,version:1};categories.push(category);return {category}}
    if(path.startsWith('/api/finance/categories/')){const category={...args.body,id:decodeURIComponent(path.split('/').at(-1))};categories=categories.map(row=>row.id===category.id?category:row);return {category}}
    if(path.endsWith('/restore')){const entry=entries.find(row=>row.id===path.split('/').at(-2));entry.deletedAt=null;entry.version++;return {entry}}
    if(args.method==='DELETE'){const entry=entries.find(row=>row.id===path.split('/').at(-1));entry.deletedAt='2026-11-15T01:00:00Z';entry.version++;return {entry}}
    if(args.method==='PUT'){const entry=entries.find(row=>row.id===path.split('/').at(-1));Object.assign(entry,args.body,{version:entry.version+1,amountCents:parseMoneyExpression(args.body.expression)});return {entry}}
    throw new Error(`Unexpected ${path}`);
  };
  const originalReceipt=receiptClient;
  const receiptAdapter={...receiptClient,processReceiptFiles:async(...args)=>{
    if(originalReceipt?.processReceiptFiles){const result=await originalReceipt.processReceiptFiles(...args);return result.imageStatus===undefined&&result.receiptIds?.length?{...result,imageStatus:'stored'}:result}
    const parsed=parseFinanceLines($('[data-finance-create]',root).elements.text.value),receiptIds=parsed.rows.map(()=>globalThis.crypto.randomUUID());return {imageStatus:'stored',receiptIds,candidates:parsed.rows.map((row,index)=>({...row,kind:'expense',receiptIds:[receiptIds[index]]}))};
  }};
  const options={request,renderMarkup:ui.renderMarkup,today:()=> '2026-11-15',isCurrent:()=>current,toast:(...args)=>notices.push(args),setDirty:value=>dirty.push(value),onDraftChange:value=>drafts.push(value),beginWrite:()=>{if(pending)return null;pending=true;return {}},endWrite:token=>{pending=false;ended.push(token)},showMonthPicker:ui.showFinanceMonthPicker,showFinanceDayPicker:ui.showFinanceDayPicker,showFinancePie:ui.showFinancePie,initialMonth,initialYear,onOpenAnnual,onBackToFinance,onSelectMonth,openModal:(html,className='')=>ui.renderMarkup($('#modal-root'),`<section class="modal ${className}">${html}</section>`),closeModal:force=>{if($('#modal-root').dataset.persistent==='1'&&!force)return;ui.disposeUi($('#modal-root'));$('#modal-root').replaceChildren();$('#modal-root').dataset.persistent='0'},receiptClient:receiptAdapter};
  controller=daily?mountDailyFinance(root,{...options,date:'2026-11-15',readonly,snapshot,draft}):annual?mountFinanceAnnualPage(root,options):mountFinancePage(root,options);
  let pickerRequested=false;$('[data-finance-files]',root)?.addEventListener('click',()=>{pickerRequested=true});
  completeQuickUpload=async form=>{
    // Tests of other behavior explicitly walk the real upload+matching path.
    if(!form.isConnected||!form.matches('[data-finance-create]')||!parseFinanceLines(form.elements.text.value).rows.length||parseFinanceLines(form.elements.text.value).errors.length)return;
    if(!$('#finance-match-form')){if(!pickerRequested)return;pickerRequested=false;const files=$('[data-finance-files]',root);Object.defineProperty(files,'files',{configurable:true,value:[{name:'test.png',type:'image/png'}]});files.dispatchEvent(new win.Event('change',{bubbles:true}));}
    await flush();const match=$('#finance-match-form');if(!match)return;
    for(const [index,section] of $$('[data-match-row]',match).entries()){const boxes=$$('input[type=checkbox][name^="match-"]',section);if(!boxes.some(box=>box.checked)&&boxes[index]){boxes[index].checked=true;boxes[index].dispatchEvent(new win.Event('change',{bubbles:true}))}}
    match.elements['acknowledge-unused'].checked=true;dispatchSubmit(match);
  };
  return {root,calls,notices,drafts,dirty,ended,request,result,setEntries:value=>{entries=value},setCategories:value=>{categories=value},setCursor:value=>{nextCursor=value},setCurrent:value=>{current=value},pending:()=>pending};
}
function input(form,name,value){const field=form.elements[name];field.value=value;field.dispatchEvent(new win.Event('input',{bubbles:true}));return field}
function change(form,name,value){const field=form.elements[name];if(field.type==='checkbox')field.checked=value;else field.value=value;field.dispatchEvent(new win.Event('change',{bubbles:true}));return field}
function dispatchSubmit(form){form.dispatchEvent(new win.Event('submit',{bubbles:true,cancelable:true}))}
function submit(form){dispatchSubmit(form);if(form.matches('[data-finance-create]'))void completeQuickUpload(form)}

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
  const form=$('[data-finance-create]',f.root),field=form.elements.text;assert.equal(field.value,'8+8 早餐');assert.match($('[data-finance-legacy-note]',form).textContent,/旧备注.*1 张截图/);submit(form);submit(form);await flush();assert.equal(f.calls.filter(call=>call.path==='/api/finance/entries').length,1);assert.equal($('fieldset',$('#finance-match-form')).disabled,true);assert.equal(f.pending(),true);
  rejectWrite(new Error('网络暂时不可用'));await flush();assert.equal(form.elements.text,field);assert.equal(field.value,'8+8 早餐');assert.equal($('fieldset',form).disabled,false);assert.match($('[data-form-error]',$('#finance-match-form')).textContent,/网络/);assert.equal(controller.hasPendingDraft(),true);
  submit(form);await flush();const writes=f.calls.filter(call=>call.path==='/api/finance/entries');assert.equal(writes[0].args.body.id,writes[1].args.body.id);assert.equal(writes[1].args.body.categoryId,'shopping');assert.equal(writes[1].args.body.note,'保留的旧备注');assert.ok(writes[1].args.body.receiptIds.includes('old-receipt'));assert.equal(writes[1].args.body.receiptIds.length,2);assert.deepEqual(writes[1].args.body,writes[0].args.body);assert.equal(f.drafts.at(-1).text,'');assert.equal(f.pending(),false);
});


test('income recording leaves the exact expense plan and legacy metadata untouched',async()=>{
 const f=fixture({daily:true,draft:{expression:'8+8-1',purpose:'早餐',note:'原备注',receiptIds:['retained-receipt']}});await flush();const quick=$('[data-finance-create]',f.root),field=quick.elements.text;
 const category=$('[data-line-category]',quick);category.value='shopping';category.dispatchEvent(new win.Event('change',{bubbles:true}));const before=structuredClone(f.drafts.at(-1));
 $('[data-finance-detail]',f.root).click();const form=$('#finance-detail-form');assert.equal(form.elements.expression.value,'');assert.equal(form.elements.kind.type,'hidden');assert.equal(form.elements.kind.value,'income');assert.equal($('[data-manual-batch]'),null);
 input(form,'expression','1000');input(form,'purpose','工资');form.elements.kind.value='expense';submit(form);await flush();const post=f.calls.find(call=>call.path==='/api/finance/entries');assert.equal(post.args.body.kind,'income');assert.equal(post.args.body.categoryId,'salary');assert.equal(quick.elements.text,field);assert.equal(field.value,'8+8-1 早餐');assert.deepEqual(f.drafts.at(-1),before);
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
  const original=$('[data-finance-create]',f.root);input(original,'text','8 还没记的早餐');$('[data-entry-action="refund"]',f.root).click();const form=$('#finance-refund-form');assert.ok(form.elements.kind);assert.equal(form.elements.kind.value,'refund');assert.equal(form.elements.refundOf.value,'expense-id');input(form,'expression','10');submit(form);await flush();
  const write=f.calls.find(call=>call.path==='/api/finance/entries');assert.equal(write.args.body.kind,'refund');assert.equal(write.args.body.refundOf,'expense-id');assert.equal(original.elements.text.value,'8 还没记的早餐');assert.equal(controller.hasPendingDraft(),true);assert.equal($('#finance-refund-form'),null);
});

test('the finance page and daily ledger render locked records and preserve receipts',async()=>{
  const entries=[photoEntry,{...photoEntry,id:'legacy-deleted',deletedAt:'2026-11-15T12:00:00Z',receiptIds:['old-photo']}];
  for(const daily of [false,true]){
    const f=fixture({daily,initialEntries:entries});await flush();
    if(!daily)$('[data-finance-day-card="2026-11-15"]',f.root).click();
    assert.ok($('[data-entry-id="photo-entry"] [data-receipt-open]',f.root));
    assert.ok($('[data-entry-id="photo-entry"] [data-entry-action="refund"]',f.root));
    assert.equal($('[data-entry-action="edit"],[data-entry-action="delete"],[data-entry-action="restore"]',f.root),null);
    assert.match($('[data-entry-id="legacy-deleted"]',f.root).textContent,/已删除/);
    assert.equal($('[data-entry-id="legacy-deleted"] [data-entry-action]',f.root),null);
    assert.equal(f.calls.some(call=>call.args.method==='PUT'||call.args.method==='DELETE'),false);
  }
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
  let finishWrite;const f=fixture({handler:(path,args)=>path==='/api/finance/entries'&&args.method==='POST'?new Promise(resolve=>{finishWrite=resolve}):undefined});await flush();
  $('[data-finance-detail]',f.root).click();const form=$('#finance-detail-form');input(form,'expression','9');input(form,'purpose','工资');submit(form);await flush();assert.equal($('#modal-root').dataset.persistent,'1');
  ui.renderMarkup($('#modal-root'),'<section class="modal" id="replacement-reauth"><h2>重新登录</h2><input type="password" value="留在当前表单"></section>');$('#modal-root').dataset.persistent='1';
  finishWrite({entry:{}});await flush();assert.ok($('#replacement-reauth'));assert.equal($('#modal-root').dataset.persistent,'1');assert.equal($('input',$('#replacement-reauth')).value,'留在当前表单');assert.equal(f.notices.length,0);
});

function selectScreenshot(f){dispatchSubmit($('[data-finance-create]',f.root));const fileInput=$('[data-finance-files]',f.root);Object.defineProperty(fileInput,'files',{configurable:true,value:[new win.File(['image'],'receipt.png',{type:'image/png'})]});fileInput.dispatchEvent(new win.Event('change',{bubbles:true}))}

test('cancel screenshot processing promptly releases write state and ignores a late recognizer result',async()=>{
  let finish,signal,disposed=0;const f=fixture({receiptClient:{processReceiptFiles:async(files,options)=>{signal=options.signal;return new Promise(resolve=>{finish=resolve})},disposeReceiptWorker:()=>disposed++}});await flush();
  const form=$('[data-finance-create]',f.root);input(form,'text','7 手填草稿');selectScreenshot(f);await flush();assert.equal(f.pending(),true);assert.equal($('[data-cancel-import]',f.root).hidden,false);
  $('[data-cancel-import]',f.root).click();await flush();assert.equal(signal.aborted,true);assert.equal(f.pending(),false);assert.equal($('fieldset',form).disabled,false);assert.equal($('[data-cancel-import]',f.root).hidden,true);assert.equal(form.elements.text.value,'7 手填草稿');assert.equal(disposed,1);assert.match($('[data-finance-status]',f.root).textContent,/已取消/);
  finish({candidates:[{expression:'99',purpose:'过期结果'}]});await flush();assert.equal($('#finance-import-form'),null);assert.equal(f.calls.filter(call=>call.path==='/api/finance/entries').length,0);
});

test('disposing processing aborts its owner and cannot update a replacement page',async()=>{
  let finish,signal;const f=fixture({receiptClient:{processReceiptFiles:async(files,options)=>{signal=options.signal;return new Promise(resolve=>{finish=resolve})},disposeReceiptWorker(){}}});await flush();selectScreenshot(f);await flush();controller.dispose();await flush();assert.equal(signal.aborted,true);assert.equal(f.pending(),false);finish({candidates:[{expression:'22'}]});await flush();assert.equal($('#finance-import-form'),null);
});


test('stored low-confidence screenshot drafts retain duplicate selection and cancellation creates no entries',async()=>{
 const f=fixture({initialEntries:[{id:'prior',date:'2026-11-15',kind:'expense',amountCents:800,purpose:'早餐',categoryId:'food',version:1,receiptIds:[]}],receiptClient:{processReceiptFiles:async()=>({imageStatus:'stored',receiptIds:['a','b'],candidates:[{expression:'8',date:'2026-11-15',kind:'expense',purpose:'早餐',receiptIds:['a'],confidence:'low',warnings:['日期需要核对']},{expression:'12',kind:'expense',purpose:'午餐',receiptIds:['b'],confidence:'medium'}],warnings:[]})}});await flush();selectScreenshot(f);await flush();const form=$('#finance-import-form');assert.ok(form);assert.equal(form.elements['select-0'].checked,false);assert.equal(form.elements['select-1'].checked,true);assert.match(form.textContent,/日期需要核对/);ui.renderMarkup($('#modal-root'),'');await flush();assert.equal(f.calls.some(call=>call.path==='/api/finance/entries'),false);
 selectScreenshot(f);await flush();const next=$('#finance-import-form');change(next,'select-0',true);change(next,'select-1',false);submit(next);await flush();const post=f.calls.find(call=>call.path==='/api/finance/entries');assert.deepEqual(post.args.body.receiptIds,['a']);assert.equal(post.args.body.kind,'expense');
});

test('screenshot validation rejection unlocks only the rejected row for correction without losing completed rows',async()=>{
 const f=fixture({receiptClient:{processReceiptFiles:async()=>({imageStatus:'stored',receiptIds:['first-photo','second-photo'],candidates:[{expression:'8',kind:'expense',purpose:'早餐',receiptIds:['first-photo']},{expression:'12',kind:'expense',purpose:'',receiptIds:['second-photo']}]})},handler:(path,args)=>{if(path==='/api/finance/entries'&&!args.body.purpose)return Promise.reject(Object.assign(new Error('请填写这笔账的用途'),{status:400,code:'finance_purpose_required'}))}});await flush();selectScreenshot(f);await flush();const form=$('#finance-import-form');submit(form);await flush();
 assert.equal(f.calls.filter(call=>call.path==='/api/finance/entries').length,2);assert.equal(form.elements['purpose-0'].disabled,true);assert.equal(form.elements['purpose-1'].disabled,false);assert.equal(form.elements['select-1'].checked,true);assert.equal(form.elements['expression-1'].value,'12');assert.match($('[data-form-error]',form).textContent,/用途/);
 input(form,'purpose-1','午餐');submit(form);await flush();const writes=f.calls.filter(call=>call.path==='/api/finance/entries');assert.equal(writes.length,3);assert.equal(writes[2].args.body.id,writes[1].args.body.id);assert.equal(writes[2].args.body.purpose,'午餐');assert.deepEqual(writes[2].args.body.receiptIds,['second-photo']);assert.equal($('#finance-import-form'),null);
});

test('uncertain screenshot conflict retains its exact attempted payload and disabled fields',async()=>{
 let rejectOnce=true;const f=fixture({receiptClient:{processReceiptFiles:async()=>({imageStatus:'stored',receiptIds:['photo'],candidates:[{expression:'12',kind:'expense',purpose:'午餐',receiptIds:['photo']}]})},handler:(path,args)=>{if(path==='/api/finance/entries'&&rejectOnce){rejectOnce=false;return Promise.reject(Object.assign(new Error('需要确认先前结果'),{status:409}))}}});await flush();selectScreenshot(f);await flush();const form=$('#finance-import-form');submit(form);await flush();assert.equal(form.elements['purpose-0'].disabled,true);assert.equal(form.elements['select-0'].disabled,true);submit(form);await flush();const writes=f.calls.filter(call=>call.path==='/api/finance/entries');assert.equal(writes.length,2);assert.deepEqual(writes[1].args.body,writes[0].args.body);assert.equal($('#finance-import-form'),null);
});

for(const daily of [false,true])test(`receipt lists ${daily?'inside a daily review':'on the finance page'} contain no thumbnails or eager image authorization`,async()=>{
  const reads=[];const f=fixture({daily,initialEntries:[{id:'photo-entry',date:'2026-11-15',kind:'expense',expression:'8',amountCents:800,purpose:'早餐',categoryId:'food',version:1,receiptIds:['receipt']}],receiptClient:{loadReceiptUrls:async(ids,variant)=>{reads.push({ids,variant});throw new Error('过期授权')}}});await flush();
  if(!daily)$('[data-finance-day-card="2026-11-15"]',f.root).click();
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
  $('[data-finance-day-card="2026-11-14"]',f.root).click();
  const row=$('[data-entry-id="other-entry"]',f.root);assert.equal($('.finance-entry-heading h3',row).textContent,other.purpose);assert.equal($$('.finance-entry-tag',row).length,2);assert.ok($('.finance-entry-footer .finance-entry-actions',row));
  $('.finance-receipt-link',row).click();await flush();const modal=$('.finance-image-dialog');assert.equal($('.modal-head h2',modal).textContent,other.purpose);assert.equal($('.modal-head img',modal),null);assert.equal($('.finance-receipt-amount',modal).textContent,'+¥126.00');assert.equal($('time',modal).textContent,'2026-11-14');assert.equal($('time',modal).dateTime,'2026-11-14');assert.match($('.finance-receipt-details',modal).textContent,/收入.*工资/);assert.doesNotMatch(modal.textContent,/账目截图|原图未上传/);
  assert.deepEqual(reads,[{ids:['receipt-a'],variant:'image'}]);assert.equal($('.finance-image-navigation',modal).hidden,true);
  $('[data-finance-day-card="2026-11-15"]',f.root).click();
  $('.finance-receipt-link',$('[data-entry-id="photo-entry"]',f.root)).click();await flush();assert.equal($('.modal-head h2',$('.finance-image-dialog')).textContent,'早餐');assert.equal($('.finance-receipt-amount').textContent,'−¥8.00');assert.equal($('time',$('.finance-image-dialog')).textContent,'2026-11-15');assert.equal(reads.length,2);
});

test('receipt gallery opens one image at a time and isolates rapid next/back requests and old image events',async()=>{
  const reads=[];const f=fixture({initialEntries:[photoEntry],receiptClient:{loadReceiptUrls:async(ids,variant,options)=>{assert.equal(variant,'image');return new Promise((resolve,reject)=>reads.push({ids,resolve,reject,current:options.isCurrent}))}}});await flush();
  $('[data-finance-day-card="2026-11-15"]',f.root).click();
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
  $('[data-finance-day-card="2026-11-15"]',f.root).click();
  $('[data-receipt-open="receipt-a"]',f.root).click();await flush();const view=$('[data-finance-image-view]'),image=$('img',view),message=$('[data-finance-image-status]',view),retry=$('[data-finance-image-retry]');assert.equal(reads.length,1);assert.match(image.src,/signature=1/);
  image.dispatchEvent(new win.Event('error'));assert.equal(image.hidden,true);assert.equal(message.hidden,false);assert.match(message.textContent,/截图加载失败.*授权已过期/);assert.equal(retry.hidden,false);
  retry.click();await flush();assert.equal($('[data-finance-image-view]'),view);assert.equal(reads.length,2);const refreshed=$('img',view);assert.notEqual(refreshed,image);assert.match(refreshed.src,/signature=2/);refreshed.dispatchEvent(new win.Event('load'));assert.equal(message.hidden,true);assert.equal(refreshed.hidden,false);assert.equal(retry.hidden,true);
  image.dispatchEvent(new win.Event('error'));assert.equal(message.hidden,true);assert.equal(f.calls.filter(call=>call.path==='/api/finance/entries').length,0);
});

test('a late full-image authorization cannot replace a newer same-account reauthentication modal',async()=>{
  let finish,guard;const f=fixture({initialEntries:[photoEntry],receiptClient:{loadReceiptUrls:async(ids,variant,options)=>{assert.equal(variant,'image');guard=options.isCurrent;return new Promise(resolve=>{finish=resolve})}}});await flush();$('[data-finance-day-card="2026-11-15"]',f.root).click();$('[data-receipt-open="receipt-a"]',f.root).click();await flush();assert.equal(guard(),true);
  ui.renderMarkup($('#modal-root'),'<section class="modal" id="replacement-reauth"><h2>重新登录</h2><input type="password" value="保持当前输入"></section>');$('#modal-root').dataset.persistent='1';assert.equal(guard(),false);
  finish({'receipt-a':'https://private.example.com/stale.webp'});await flush();assert.ok($('#replacement-reauth'));assert.equal($('input',$('#replacement-reauth')).value,'保持当前输入');assert.equal($('#modal-root').dataset.persistent,'1');assert.equal($('[data-finance-image-view]'),null);assert.equal(f.notices.length,0);
});

test('old image-read failures stay silent while the latest receipt keeps its own inline retry',async()=>{
  const reads=[];const f=fixture({initialEntries:[photoEntry],receiptClient:{loadReceiptUrls:async(ids,variant,options)=>{assert.equal(variant,'image');return new Promise((resolve,reject)=>reads.push({ids,resolve,reject,current:options.isCurrent}))}}});await flush();
  $('[data-finance-day-card="2026-11-15"]',f.root).click();
  $('[data-receipt-open="receipt-a"]',f.root).click();await flush();$('[data-finance-image-next]').click();await flush();assert.equal(reads[0].current(),false);assert.equal(reads[1].current(),true);const view=$('[data-finance-image-view]');
  reads[0].reject(new Error('旧截图错误不能出现'));reads[1].reject(new Error('图片授权暂时不可用'));await flush();assert.equal($('[data-finance-image-view]'),view);assert.match(view.textContent,/图片授权暂时不可用/);assert.doesNotMatch(view.textContent,/旧截图错误/);assert.equal($('[data-finance-image-retry]').hidden,false);assert.equal(f.notices.length,0);
  $('[data-finance-image-retry]').click();$('[data-finance-image-retry]').dispatchEvent(new win.Event('click'));await flush();assert.equal(reads.length,3);assert.deepEqual(reads[2].ids,['receipt-b']);reads[2].resolve({'receipt-b':'https://private.example.com/latest.webp'});await flush();assert.match($('img',view).src,/latest\.webp/);
});


for(const daily of [false,true])test(`receipt matching ${daily?'daily':'finance'} requires stored images and explicit manual choices`,async()=>{
 const f=fixture({daily,receiptClient:{processReceiptFiles:async()=>({imageStatus:'stored',receiptIds:['taxi','unknown'],candidates:[{kind:'expense',expression:'60',receiptIds:['taxi']},{kind:'expense',expression:'',receiptIds:['unknown']} ]})}});await flush();const quick=$('[data-finance-create]',f.root),field=input(quick,'text','60 打车\n15 买东西');dispatchSubmit(quick);await flush();assert.equal(f.calls.some(call=>call.path==='/api/finance/entries'),false);selectScreenshot(f);await flush();const match=$('#finance-match-form');assert.ok(match);assert.equal(match.elements['match-0'][0].checked,true);dispatchSubmit(match);await flush();assert.equal(f.calls.some(call=>call.path==='/api/finance/entries'),false);assert.match($('[data-form-error]',match).textContent,/选择对应截图/);
 const box=$('input[name="match-1"][value="unknown"]',match);box.checked=true;box.dispatchEvent(new win.Event('change',{bubbles:true}));dispatchSubmit(match);await flush();const posts=f.calls.filter(call=>call.path==='/api/finance/entries');assert.deepEqual(posts.map(call=>call.args.body.receiptIds),[['taxi'],['unknown']]);assert.ok(posts.every(call=>call.args.body.kind==='expense'&&call.args.body.source===(daily?'daily':'finance')));assert.equal(quick.elements.text,field);assert.equal(field.value,'');
});


test('matching partial success freezes uncertain payloads and retries only the remaining original ID',async()=>{
 let failed=false;const f=fixture({handler:(path,args)=>{if(path==='/api/finance/entries'&&args.body.purpose==='午餐'&&!failed){failed=true;return Promise.reject(new Error('响应中断'))}}});await flush();const quick=$('[data-finance-create]',f.root),field=input(quick,'text','8 早餐\n12 午餐');submit(quick);await flush();const match=$('#finance-match-form'),posts=f.calls.filter(call=>call.path==='/api/finance/entries');assert.equal(posts.length,2);assert.equal(field.value,'12 午餐');assert.equal(field.readOnly,true);assert.equal($('[data-clear-entry]',quick).disabled,true);assert.match($('[data-form-error]',match).textContent,/响应中断/);assert.equal($('input[name="match-1"]',match).disabled,true);dispatchSubmit(match);dispatchSubmit(match);await flush();const all=f.calls.filter(call=>call.path==='/api/finance/entries');assert.equal(all.length,3);assert.deepEqual(all[2].args.body,all[1].args.body);assert.equal(all.filter(call=>call.args.body.purpose==='早餐').length,1);assert.equal(field.value,'');assert.equal(field.readOnly,false);
});


test('an obsolete account cannot open income or confirm a mounted expense matching dialog',async()=>{
 const f=fixture();await flush();f.setCurrent(false);$('[data-finance-detail]',f.root).click();assert.equal($('#finance-detail-form'),null);f.setCurrent(true);const quick=$('[data-finance-create]',f.root);input(quick,'text','8 早餐');dispatchSubmit(quick);selectScreenshot(f);await flush();const match=$('#finance-match-form');assert.ok(match);f.setCurrent(false);dispatchSubmit(match);await flush();assert.equal(f.calls.some(call=>call.path==='/api/finance/entries'),false);assert.equal(quick.elements.text.value,'8 早餐');
});

test('IME composition never searches unfinished text, and clear restores the list without replacing the draft',async()=>{
  const f=fixture();await flush();const form=$('[data-finance-create]',f.root),draft=input(form,'text','12 午餐'),search=$('input[name="q"]',f.root),filters=$('[data-finance-filters]',f.root),clear=$('[data-finance-clear-search]',f.root),loads=()=>f.calls.filter(call=>call.path.startsWith('/api/finance?month=')).length;
  const initial=loads();search.value='w';search.dispatchEvent(new win.Event('input',{bubbles:true}));search.dispatchEvent(new win.Event('compositionstart',{bubbles:true}));search.value='午';search.dispatchEvent(new win.InputEvent('input',{bubbles:true,isComposing:true}));submit(filters);await new Promise(resolve=>setTimeout(resolve,250));await flush();assert.equal(loads(),initial);
  search.value='午餐';search.dispatchEvent(new win.Event('compositionend',{bubbles:true}));search.dispatchEvent(new win.InputEvent('input',{bubbles:true,isComposing:false}));await new Promise(resolve=>setTimeout(resolve,250));await flush();assert.equal(loads(),initial+1);assert.ok(f.calls.filter(call=>call.path.startsWith('/api/finance?month=')).at(-1).path.includes('q=%E5%8D%88%E9%A4%90'));assert.equal(clear.hidden,false);
  clear.click();await flush();assert.equal(loads(),initial+2);assert.equal(search.value,'');assert.equal(clear.hidden,true);assert.equal(document.activeElement,search);assert.equal($('[data-finance-create]',f.root),form);assert.equal(form.elements.text,draft);assert.equal(draft.value,'12 午餐');assert.equal(f.calls.filter(call=>call.path.startsWith('/api/finance?month=')).at(-1).path.includes('q='),false);await new Promise(resolve=>setTimeout(resolve,250));assert.equal(loads(),initial+2);
});

test('partial textarea confirmation removes committed lines and retries only the remaining stable IDs',async()=>{
  let rejectSecond,failed=false;const f=fixture({daily:true,handler:(path,args)=>{if(path==='/api/finance/entries'&&args.body.purpose==='吃饭'&&!failed){failed=true;return new Promise((_,reject)=>{rejectSecond=reject})}}});await flush();
  const form=$('[data-finance-create]',f.root),field=input(form,'text','60 打车\n50 吃饭\n20 咖啡');submit(form);submit(form);await flush();assert.equal(f.calls.filter(call=>call.path==='/api/finance/entries').length,2);assert.equal(field.value,'50 吃饭\n20 咖啡');assert.equal(f.drafts.at(-1).text,'50 吃饭\n20 咖啡');assert.equal($('fieldset',$('#finance-match-form')).disabled,true);
  rejectSecond(new Error('第二笔暂未成功'));await flush();assert.match($('[data-form-error]',$('#finance-match-form')).textContent,/第二笔/);assert.equal(controller.hasPendingDraft(),true);assert.equal(field.readOnly,true);submit(form);await flush();input(form,'text','8 早餐');submit(form);await flush();
  const writes=f.calls.filter(call=>call.path==='/api/finance/entries');assert.equal(writes.length,5);assert.equal(writes[1].args.body.id,writes[2].args.body.id);assert.equal(writes.filter(call=>call.args.body.purpose==='打车').length,1);assert.deepEqual(writes.slice(2).map(call=>call.args.body.purpose),['吃饭','咖啡','早餐']);assert.equal(field.value,'');assert.equal(form.elements.text,field);assert.equal(controller.hasPendingDraft(),false);
});


test('a definitive validation rejection unlocks corrections while uncertain writes stay immutable',async()=>{
 let first=true;const f=fixture({handler:path=>{if(path==='/api/finance/entries'&&first){first=false;return Promise.reject(Object.assign(new Error('请重新选择分类'),{status:400}))}}});await flush();const quick=$('[data-finance-create]',f.root),field=input(quick,'text','8 早餐');submit(quick);await flush();assert.equal(field.readOnly,false);assert.match($('[data-form-error]',$('#finance-match-form')).textContent,/分类/);ui.renderMarkup($('#modal-root'),'');input(quick,'text','9 午餐');submit(quick);await flush();const posts=f.calls.filter(call=>call.path==='/api/finance/entries');assert.equal(posts.length,2);assert.equal(posts[1].args.body.expression,'9');assert.notEqual(posts[0].args.body.id,posts[1].args.body.id);assert.equal(field.value,'');
});

test('identical lines stay distinct, retain retry order and never remove the wrong physical line',async()=>{
  let failed=false;const f=fixture({handler:(path,args)=>{if(path==='/api/finance/entries'&&!failed){failed=true;return Promise.reject(new Error('再试一次'))}}});await flush();const form=$('[data-finance-create]',f.root);input(form,'text','8 早餐\n\n8 早餐');submit(form);await flush();submit(form);await flush();const writes=f.calls.filter(call=>call.path==='/api/finance/entries');assert.equal(writes.length,3);assert.equal(writes[0].args.body.id,writes[1].args.body.id);assert.notEqual(writes[1].args.body.id,writes[2].args.body.id);assert.equal(form.elements.text.value.trim(),'');assert.equal(controller.hasPendingDraft(),false);
});

test('textarea composition preserves the active native node, caret and draft without early writes',async()=>{
  const f=fixture({daily:true,draft:{text:'8+8-1 早餐'}});await flush();const form=$('[data-finance-create]',f.root),field=form.elements.text;field.focus();field.dispatchEvent(new win.Event('compositionstart',{bubbles:true}));field.value='60 打车\n50 吃';field.setSelectionRange(9,9);field.dispatchEvent(new win.InputEvent('input',{bubbles:true,isComposing:true}));assert.equal(f.drafts.at(-1).text,field.value);assert.equal(document.activeElement,field);assert.equal(form.elements.text,field);assert.equal(field.selectionStart,9);submit(form);await flush();assert.equal(f.calls.filter(call=>call.args.method==='POST').length,0);field.value='60 打车\n50 吃饭';field.dispatchEvent(new win.Event('compositionend',{bubbles:true}));assert.match($('[data-finance-calculation]',form).textContent,/110\.00/);assert.equal(controller.hasPendingDraft(),true);
});

test('ledger shows the amount only on the right and keeps refunds as separate entries',async()=>{
  const f=fixture({initialEntries:[{id:'vegetables',date:'2026-11-15',kind:'expense',expression:'8+8-1',amountCents:1500,purpose:'买菜',categoryId:'food',note:'晚饭用',receiptIds:[],version:1},{id:'refund',date:'2026-11-15',kind:'refund',expression:'2',amountCents:200,purpose:'退菜',categoryId:'food',refundOf:'vegetables',receiptIds:[],version:1}]});await flush();
  $('[data-finance-day-card="2026-11-15"]',f.root).click();
  const row=$('[data-entry-id="vegetables"]',f.root),copy=$('.finance-entry-copy',row);
  assert.match(copy.textContent,/买菜/);assert.match(copy.textContent,/晚饭用/);assert.doesNotMatch(copy.textContent,/8\+8-1|15\.00/);
  assert.equal($('.finance-entry-amount',row).textContent,'−¥15.00');assert.match($('[data-entry-id="refund"] .finance-entry-copy',f.root).textContent,/已关联原支出/);
  $('[data-entry-action="refund"]',row).click();assert.equal($('#finance-refund-form').elements.expression.value,'15.00');
});


test('income-only entry preserves exact arithmetic and cannot submit another kind',async()=>{
 const f=fixture();await flush();$('[data-finance-detail]',f.root).click();const form=$('#finance-detail-form');assert.equal(form.elements.kind.type,'hidden');input(form,'expression','8+8+8-1');input(form,'purpose','工资');assert.equal($('[data-finance-calculation]',form).textContent,'合计 ¥23.00');form.elements.kind.value='transfer';submit(form);await flush();const post=f.calls.find(call=>call.path==='/api/finance/entries');assert.equal(post.args.body.kind,'income');assert.equal(post.args.body.expression,'8+8+8-1');assert.equal(post.args.body.categoryId,'salary');
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


test('monthly finance ledger omits range selector and links cleanly to the dedicated annual page',async()=>{
  const make=(id,date,amountCents)=>({id,date,kind:'expense',categoryId:'food',purpose:id,amountCents,expression:String(amountCents/100),receiptIds:[],version:1});
  const opened=[];
  const f=fixture({initialEntries:[make('今天早餐','2026-11-15',800),make('昨天面条','2026-11-14',1200),make('夏季冷饮','2026-08-03',1500),make('去年记录','2025-12-20',5000)],onOpenAnnual:year=>opened.push(year)});await flush();
  const form=$('[data-finance-create]',f.root),field=input(form,'text','30 尚未入账'),filters=$('[data-finance-filters]',f.root),summary=$('[data-finance-summary]',f.root);
  assert.equal($('[data-finance-hero-count]',f.root),null);
  assert.equal($('[data-finance-ledger-date-row]',f.root),null);
  assert.equal(filters.elements.range,undefined,'annual ledger range moved to the dedicated annual page');
  assert.equal($('[data-finance-year-pie]',f.root),null,'monthly page stays focused on monthly and daily charts');
  assert.equal($$('.finance-day-card',f.root).length,2);assert.equal($$('.finance-entry',f.root).length,0);
  assert.match(summary.textContent,/20\.00/);assert.match($('[data-finance-month-pie]',f.root).textContent,/20\.00/);assert.match($('[data-finance-day-pie]',f.root).textContent,/8\.00/);
  $('[data-finance-day-card="2026-11-15"]',f.root).click();assert.equal($$('.finance-entry',f.root).length,1);assert.match($('[data-finance-day-detail="2026-11-15"]',f.root).textContent,/今天早餐/);
  $('[data-finance-day-close]',f.root).click();assert.equal($('[data-finance-day-detail]',f.root),null);
  $('[data-finance-open-annual]',f.root).click();
  assert.deepEqual(opened,['2026']);
  assert.equal(form.elements.text,field);assert.equal(field.value,'30 尚未入账');assert.equal(f.calls.some(call=>call.args.method==='POST'),false);
});

test('a stale annual-list response cannot overwrite a newer year or filter view',async()=>{
  let resolveOld;const f=fixture({annual:true,handler:path=>path==='/api/finance?year=2025'?new Promise(resolve=>{resolveOld=resolve}):undefined});await flush();
  $('[data-finance-year-prev]',f.root).click();await flush();assert.equal(typeof resolveOld,'function');
  $('[data-finance-year-current]',f.root).click();await flush();
  resolveOld({...f.result(),entries:[{id:'stale',date:'2025-08-15',kind:'income',purpose:'过期整年记录',amountCents:99900,categoryId:'salary',receiptIds:[]}],nextCursor:'stale-cursor'});await flush();
  assert.doesNotMatch($('[data-finance-entries]',f.root).textContent,/过期整年记录/);assert.equal($('[data-finance-more]',f.root).hidden,true);assert.equal($('[data-finance-year-label]',f.root).textContent,'2026年');
});

test('typing a new ledger search invalidates the previous result cursor immediately',async()=>{
  const f=fixture();await flush();
  f.setCursor('unfiltered-page');
  $('[data-finance-refresh]',f.root).click();await flush();
  const more=$('[data-finance-more]',f.root),before=f.calls.length;
  assert.equal(more.hidden,false);
  f.setCursor(null);
  input($('[data-finance-filters]',f.root),'q','早餐');
  more.click();
  assert.equal(more.hidden,true);
  assert.equal(f.calls.length,before,'the old cursor must not query the new search');
  await new Promise(resolve=>setTimeout(resolve,260));await flush();
  const searches=f.calls.slice(before).filter(call=>new URL(call.path,'https://shendu.test').searchParams.has('q'));
  assert.equal(searches.length,1);
  assert.equal(new URL(searches[0].path,'https://shendu.test').searchParams.has('cursor'),false);
});

test('unknown quick-entry purposes show their own classification and save automatically without category writes',async()=>{
  const f=fixture();await flush();const form=$('[data-finance-create]',f.root);input(form,'text','60 修鞋');
  assert.match($('[data-finance-line-preview]',form).textContent,/自动分类：修鞋/);assert.equal(f.calls.some(call=>call.args.method==='POST'),false);
  submit(form);await flush();const write=f.calls.find(call=>call.path==='/api/finance/entries');assert.equal(write.args.body.categoryId,'');assert.equal(write.args.body.purpose,'修鞋');assert.match($('[data-finance-entries]',f.root).textContent,/修鞋/);assert.equal(f.calls.some(call=>call.path.includes('/categories')),false);
});

test('registering a refund lets the user resume automatic classification and then choose a manual category',async()=>{
  const f=fixture({initialEntries:[{id:'older-meal',date:'2026-11-15',kind:'expense',expression:'8',amountCents:800,purpose:'买面条',categoryId:'shopping',version:1,receiptIds:[]}]});
  await flush();
  $('[data-finance-day-card="2026-11-15"]',f.root).click();
  $('[data-entry-action="refund"]',f.root).click();
  const form=$('#finance-refund-form');
  assert.equal(form.elements.categoryId.value,'shopping');
  change(form,'categoryId','');
  assert.equal(form.elements.categoryId.value,'food');
  assert.match($('[data-category-hint]',form).textContent,/餐饮/);
  input(form,'purpose','上网');
  assert.equal(form.elements.categoryId.value,'entertainment');
  change(form,'categoryId','shopping');
  input(form,'purpose','买菜');
  assert.equal(form.elements.categoryId.value,'shopping');
  assert.match($('[data-category-hint]',form).textContent,/餐饮/);
  change(form,'categoryId','');
  dispatchSubmit(form);await flush();
  const write=f.calls.find(call=>call.path==='/api/finance/entries'&&call.args.body?.kind==='refund');
  assert.equal(write.args.body.categoryId,'food');
});

test('screenshot review returns to automatic classification after a manual choice is cleared',async()=>{
  const f=fixture({receiptClient:{processReceiptFiles:async()=>({
    imageStatus:'stored',receiptIds:['new-screenshot'],candidates:[{kind:'expense',expression:'5',purpose:'买面条',receiptIds:['new-screenshot']}]
  })}});
  await flush();
  selectScreenshot(f);await flush();
  const form=$('#finance-import-form');
  assert.equal(form.elements['category-0'].value,'food');
  change(form,'category-0','shopping');
  input(form,'purpose-0','上网');
  assert.equal(form.elements['category-0'].value,'shopping');
  change(form,'category-0','');
  assert.equal(form.elements['category-0'].value,'entertainment');
  assert.match($('[data-import-category-hint]',form).textContent,/娱乐/);
  dispatchSubmit(form);await flush();
  assert.equal(f.calls.find(call=>call.path==='/api/finance/entries').args.body.categoryId,'entertainment');
});


test('unused images require an explicit acknowledgment and never create extra ledger entries',async()=>{
 const f=fixture({receiptClient:{processReceiptFiles:async()=>({imageStatus:'stored',receiptIds:['meal','extra'],candidates:[{kind:'expense',expression:'8',receiptIds:['meal']},{kind:'expense',expression:'99',receiptIds:['extra']}]})}});await flush();const quick=$('[data-finance-create]',f.root);input(quick,'text','8 早餐');dispatchSubmit(quick);selectScreenshot(f);await flush();const match=$('#finance-match-form');dispatchSubmit(match);await flush();assert.equal(f.calls.some(call=>call.path==='/api/finance/entries'),false);assert.match($('[data-form-error]',match).textContent,/还有截图未关联/);change(match,'acknowledge-unused',true);dispatchSubmit(match);await flush();const writes=f.calls.filter(call=>call.path==='/api/finance/entries');assert.equal(writes.length,1);assert.deepEqual(writes[0].args.body.receiptIds,['meal']);
});

test('changing a screenshot match clears the visible and native unused-image confirmation',async()=>{
  const f=fixture({receiptClient:{processReceiptFiles:async()=>({
    imageStatus:'stored',receiptIds:['meal','extra'],
    candidates:[{kind:'expense',expression:'8',receiptIds:['meal']},{kind:'expense',expression:'99',receiptIds:['extra']}]
  })}});
  await flush();
  input($('[data-finance-create]',f.root),'text','8 早餐');
  selectScreenshot(f);await flush();
  const match=$('#finance-match-form');
  const acknowledgment=match.elements['acknowledge-unused'];
  const visible=$('[data-ui-checkbox-for="acknowledge-unused"]',match);
  const extra=$('input[name="match-0"][value="extra"]',match);
  const extraBox=$('[data-slot="checkbox"]',extra.closest('.sd-checkbox-adapter'));
  visible.click();await flush();
  assert.equal(acknowledgment.checked,true);
  assert.equal(visible.getAttribute('aria-checked'),'true');
  extraBox.click();await flush();
  extraBox.click();await flush();
  assert.equal(acknowledgment.checked,false);
  assert.equal(visible.getAttribute('aria-checked'),'false');
  dispatchSubmit(match);await flush();
  assert.equal(f.calls.some(call=>call.path==='/api/finance/entries'),false);
  visible.click();await flush();
  dispatchSubmit(match);await flush();
  assert.equal(f.calls.filter(call=>call.path==='/api/finance/entries').length,1);
});

test('a pending match retry locks the visible receipt choices until the result is known',async()=>{
  let attempts=0;
  const f=fixture({handler:(path)=>{
    if(path==='/api/finance/entries'&&++attempts===1)return Promise.reject(new Error('响应中断'));
  }});
  await flush();
  input($('[data-finance-create]',f.root),'text','8 早餐');
  selectScreenshot(f);await flush();
  const match=$('#finance-match-form'),native=$('input[name="match-0"]',match);
  const visible=$('[data-ui-checkbox-for="match-0"]',match);
  dispatchSubmit(match);await flush();
  assert.equal(native.disabled,true);
  assert.equal(visible.disabled,true);
  visible.click();await flush();
  assert.equal(native.checked,true);
  assert.equal(visible.getAttribute('aria-checked'),'true');
  dispatchSubmit(match);await flush();
  const posts=f.calls.filter(call=>call.path==='/api/finance/entries');
  assert.equal(posts.length,2);
  assert.deepEqual(posts[1].args.body,posts[0].args.body);
});

test('manual matching enforces the per-entry ten-image bound before any write',async()=>{
 const ids=Array.from({length:11},(_,i)=>`image-${i}`),f=fixture({receiptClient:{processReceiptFiles:async()=>({imageStatus:'stored',receiptIds:ids,candidates:ids.map(id=>({kind:'expense',expression:'8',receiptIds:[id]}))})}});await flush();const quick=$('[data-finance-create]',f.root);input(quick,'text','8 早餐');dispatchSubmit(quick);selectScreenshot(f);await flush();const match=$('#finance-match-form');for(const box of $$('input[name="match-0"]',match)){box.checked=true;box.dispatchEvent(new win.Event('change',{bubbles:true}))}dispatchSubmit(match);await flush();assert.equal(f.calls.some(call=>call.path==='/api/finance/entries'),false);assert.match($('[data-form-error]',match).textContent,/最多关联10/);
});

test('inline receipt preview keeps matching mounted and ignores superseded read responses',async()=>{
 const reads=[],f=fixture({receiptClient:{loadReceiptUrls:(ids,variant,{isCurrent})=>new Promise((resolve,reject)=>reads.push({ids,variant,current:isCurrent,resolve,reject}))}});await flush();const quick=$('[data-finance-create]',f.root);input(quick,'text','8 早餐');dispatchSubmit(quick);selectScreenshot(f);await flush();const match=$('#finance-match-form'),button=$('[data-match-preview]',match),id=button.dataset.matchPreview;button.click();await flush();assert.equal(reads.length,1);button.click();button.click();await flush();assert.equal(reads.length,2);assert.equal(reads[0].current(),false);reads[1].resolve({[id]:'https://private.example.com/latest.webp'});await flush();reads[0].resolve({[id]:'https://private.example.com/stale.webp'});await flush();assert.equal($('#finance-match-form'),match);assert.match($('[data-match-image] img',match).src,/latest/);assert.equal(f.calls.some(call=>call.path==='/api/finance/entries'),false);f.setCurrent(false);button.click();assert.equal(reads.length,2);
});

for(const daily of [false,true])test(`one upload entry supports empty OCR and planned matching in ${daily?'daily':'finance'}`,async()=>{
 const f=fixture({daily,receiptClient:{processReceiptFiles:async()=>({imageStatus:'stored',receiptIds:['one-photo'],candidates:[{kind:'expense',expression:'8',purpose:'早餐',receiptIds:['one-photo']}]})}});await flush();const form=$('[data-finance-create]',f.root),files=$('[data-finance-files]',f.root);let clicks=0;files.addEventListener('click',()=>clicks++);assert.equal($('[data-import-receipts]',f.root),null);assert.equal($$('[data-upload-expenses]',f.root).length,1);assert.equal($('[data-upload-expenses]',f.root).textContent,'上传截图');dispatchSubmit(form);assert.equal(clicks,1);assert.equal($('[data-form-error]',form).textContent,'');assert.equal(f.calls.some(call=>call.path==='/api/finance/entries'),false);input(form,'text','8+ 早餐');dispatchSubmit(form);assert.equal(clicks,1);assert.match($('[data-form-error]',form).textContent,/修正/);input(form,'text','');selectScreenshot(f);await flush();assert.ok($('#finance-import-form'));assert.equal($('#finance-match-form'),null);assert.equal(f.calls.some(call=>call.path==='/api/finance/entries'),false);submit($('#finance-import-form'));await flush();assert.deepEqual(f.calls.find(call=>call.path==='/api/finance/entries').args.body.receiptIds,['one-photo']);
});

test('income form has only date, amount, source and note while classification stays automatic',async()=>{
 const f=fixture();await flush();$('[data-finance-detail]',f.root).click();const form=$('#finance-detail-form');input(form,'expression','30');input(form,'purpose','稿酬');assert.equal(form.elements.categoryId.type,'hidden');assert.equal(form.elements.kind.type,'hidden');assert.equal($('[data-category-hint]',form),null);assert.doesNotMatch(form.textContent,/收支类型|分类/);assert.deepEqual($$('input:not([type=hidden])',form).map(input=>input.name),['date','expression','purpose','note']);assert.equal(form.elements.categoryId.value,'');input(form,'purpose','工资');assert.equal(form.elements.categoryId.value,'salary');submit(form);await flush();const post=f.calls.find(call=>call.path==='/api/finance/entries');assert.equal(post.args.body.kind,'income');assert.equal(post.args.body.categoryId,'salary');
});

test('ledger receipt count links open the private image and upload explicitly awaits confirmation',async()=>{
  const reads=[];const f=fixture({initialEntries:[photoEntry],receiptClient:{loadReceiptUrls:async(ids,variant)=>{reads.push({ids,variant});return {[ids[0]]:'https://private.example.com/photo.webp'}},processReceiptFiles:async()=>({candidates:[{expression:'5',purpose:'吃饭',kind:'expense',receiptIds:['new-photo']}],receiptIds:['new-photo'],warnings:[]})}});await flush();$('[data-finance-day-card="2026-11-15"]',f.root).click();const link=$('.finance-receipt-link',f.root);assert.equal(link.textContent,'查看截图 · 2 张');link.click();await flush();assert.ok($('[data-finance-image-view]'));assert.deepEqual(reads.find(read=>read.variant==='image').ids,['receipt-a']);
  ui.disposeUi($('#modal-root'));$('#modal-root').replaceChildren();selectScreenshot(f);await flush();assert.match($('[data-finance-status]',f.root).textContent,/尚未入账/);assert.match($('#finance-import-form').textContent,/已附 1 张压缩截图/);assert.equal(f.calls.some(call=>call.path==='/api/finance/entries'),false);submit($('#finance-import-form'));await flush();assert.deepEqual(f.calls.find(call=>call.path==='/api/finance/entries').args.body.receiptIds,['new-photo']);assert.ok($('[data-receipt-open="new-photo"]',f.root));
});


test('income and refunds keep their separate category and draft ownership',async()=>{
 const entry={id:'prior',date:'2026-11-15',kind:'expense',expression:'8',amountCents:800,purpose:'早餐',categoryId:'shopping',receiptIds:[],version:1};const f=fixture({initialEntries:[entry]});await flush();const quick=$('[data-finance-create]',f.root),field=input(quick,'text','12 修鞋');$('[data-finance-detail]',f.root).click();let form=$('#finance-detail-form');assert.equal(form.elements.purpose.value,'');input(form,'expression','20');input(form,'purpose','工资');submit(form);await flush();assert.equal(field.value,'12 修鞋');$('[data-entry-id="prior"] [data-entry-action="refund"]',f.root).click();form=$('#finance-refund-form');assert.equal(form.elements.categoryId.value,'shopping');input(form,'purpose','早餐修改');assert.equal(form.elements.categoryId.value,'shopping');submit(form);await flush();assert.equal(f.calls.find(call=>call.args.body?.kind==='refund').args.body.categoryId,'shopping');assert.equal(field.value,'12 修鞋');
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


test('recognition-only output never opens an expense confirmation or accepts text without saved images',async()=>{
 const f=fixture({receiptClient:{processReceiptFiles:async()=>({imageStatus:'not_stored',receiptIds:[],candidates:[{kind:'expense',expression:'8',purpose:'早餐',receiptIds:[]}]})}});await flush();selectScreenshot(f);await flush();assert.equal($('#finance-import-form'),null);assert.equal($('#finance-match-form'),null);assert.equal(f.calls.some(call=>call.path==='/api/finance/entries'),false);assert.match($('[data-finance-status]',f.root).textContent,/截图尚未保存/);
});

test('failed configured screenshot processing opens no normal confirmation and preserves the manual draft',async()=>{
  const f=fixture({receiptClient:{processReceiptFiles:async()=>{throw Object.assign(new Error('图片未能保存，本批次尚未入账'),{code:'receipt_upload_failed'})}}});await flush();const quick=$('[data-finance-create]',f.root),field=input(quick,'text','7 原手填草稿');selectScreenshot(f);await flush();assert.equal($('#finance-import-form'),null);assert.equal(field.value,'7 原手填草稿');assert.match($('[data-finance-status]',f.root).textContent,/未能保存/);assert.equal(f.calls.some(call=>call.path==='/api/finance/entries'),false);
});

test('same-amount receipts can be assigned once and releasing a choice re-enables the other row',async()=>{
  const screenshots={imageStatus:'stored',receiptIds:['a','b'],candidates:[
    {expression:'8',purpose:'早餐',kind:'expense',receiptIds:['a']},
    {expression:'8',purpose:'午餐',kind:'expense',receiptIds:['b']}
  ]};
  const f=fixture({receiptClient:{processReceiptFiles:async()=>screenshots}});await flush();
  input($('[data-finance-create]',f.root),'text','8 早餐\n8 午餐');
  selectScreenshot(f);await flush();const form=$('#finance-match-form'),rows=$$('[data-match-row]',form);
  const box=(row,id)=>$('input[value="'+id+'"]',rows[row]),visible=(row,id)=>$('[data-slot="checkbox"]',box(row,id).closest('label'));
  assert.equal($$('input[type="checkbox"]:checked',form).length,0);
  visible(0,'a').click();await flush();
  assert.equal(box(0,'a').checked,true);assert.equal(box(1,'a').disabled,true);assert.equal(visible(1,'a').disabled,true);
  assert.match(box(1,'a').closest('label').textContent,/已选给第 1 笔/);
  visible(1,'a').click();assert.equal(box(1,'a').checked,false);
  visible(0,'a').click();await flush();assert.equal(visible(1,'a').disabled,false);
  visible(1,'a').click();await flush();visible(0,'b').click();await flush();
  dispatchSubmit(form);await flush();
  assert.deepEqual(f.calls.filter(call=>call.path==='/api/finance/entries').map(call=>call.args.body.receiptIds),[['b'],['a']]);
});

test('competing OCR candidates require an exclusive selection and already posted images stay disabled',async()=>{
  const f=fixture({receiptClient:{processReceiptFiles:async()=>({
    imageStatus:'stored',receiptIds:['photo','used'],usedReceiptIds:['used'],
    candidates:[
      {kind:'expense',expression:'12',purpose:'早餐',receiptIds:['photo']},
      {kind:'expense',expression:'18',purpose:'午餐',receiptIds:['photo']},
      {kind:'expense',expression:'25',purpose:'晚餐',receiptIds:['used']}
    ]
  })}});await flush();selectScreenshot(f);await flush();
  const form=$('#finance-import-form'),rows=$$('[data-import-index]',form),choice=i=>form.elements['select-'+i];
  const visible=i=>$('[data-slot="checkbox"]',choice(i).closest('label'));
  assert.equal(choice(0).checked,false);assert.equal(choice(1).checked,false);assert.equal(visible(2).disabled,true);
  visible(0).click();await flush();assert.equal(visible(1).disabled,true);
  assert.match($('[data-import-conflict]',rows[1]).textContent,/第 1 笔/);
  visible(0).click();await flush();assert.equal(visible(1).disabled,false);
  visible(1).click();await flush();assert.equal(visible(0).disabled,true);
  dispatchSubmit(form);await flush();
  const writes=f.calls.filter(call=>call.path==='/api/finance/entries');
  assert.equal(writes.length,1);assert.equal(writes[0].args.body.purpose,'午餐');assert.deepEqual(writes[0].args.body.receiptIds,['photo']);
});

test('an image claimed elsewhere during confirmation stays blocked and the user can use another',async()=>{
  let first=true;
  const f=fixture({receiptClient:{processReceiptFiles:async()=>({
    imageStatus:'stored',receiptIds:['first','replacement'],
    candidates:[{kind:'expense',expression:'8',purpose:'早餐',receiptIds:['first']}]
  })},handler:path=>{
    if(path!=='/api/finance/entries'||!first)return;first=false;
    throw Object.assign(new Error('截图已用于入账'),{status:409,code:'finance_receipt_in_use'});
  }});
  await flush();input($('[data-finance-create]',f.root),'text','8 早餐');selectScreenshot(f);await flush();
  const form=$('#finance-match-form');form.elements['acknowledge-unused'].checked=true;
  dispatchSubmit(form);await flush();
  const previous=$('input[value="first"]',form),replacement=$('input[value="replacement"]',form);
  assert.match($('[data-form-error]',form).textContent,/已用于入账/);assert.equal(previous.checked,false);assert.equal(previous.disabled,true);
  assert.equal($('[data-finance-create]',f.root).elements.text.readOnly,false);
  replacement.click();dispatchSubmit(form);await flush();
  assert.deepEqual(f.calls.filter(call=>call.path==='/api/finance/entries').map(call=>call.args.body.receiptIds),[['first'],['replacement']]);
});

test('income and refund modal changes do not throw and storage readiness note renders cleanly',async()=>{
  const expense={id:'exp-1',date:'2026-11-15',kind:'expense',expression:'30',amountCents:3000,purpose:'午餐',categoryId:'food',receiptIds:[],version:1};
  const f=fixture({initialEntries:[expense]});await flush();
  assert.equal($('[data-storage-banner]',f.root),null);
  assert.match($('[data-storage-note]',f.root).textContent,/尚未配置图片存储/);
  $('[data-finance-detail]',f.root).click();
  const detail=$('#finance-detail-form');
  assert.doesNotThrow(()=>{change(detail,'categoryId','salary');detail.elements.kind.dispatchEvent(new win.Event('change',{bubbles:true}))});
  $('[data-finance-day-card="2026-11-15"]',f.root).click();
  $('[data-entry-action="refund"]',f.root).click();
  const refund=$('#finance-refund-form');
  assert.doesNotThrow(()=>{change(refund,'categoryId','shopping');change(refund,'kind','refund')});
  const f2=fixture({initialStorage:{configured:true,config:{endpoint:'https://s3.example.com',bucket:'b'},version:1,receiptCount:0,disconnected:false,targets:[]}});await flush();
  assert.match($('[data-storage-note]',f2.root).textContent,/压缩截图保存在你配置的私有存储/);
});

test('month ledger groups entries into collapsed day cards that expand on click and toggle cleanly',async()=>{
  const initialEntries=[
    {id:'e-1',date:'2026-11-15',kind:'expense',expression:'35.5',amountCents:3550,purpose:'午饭',categoryId:'food',receiptIds:[],version:1},
    {id:'e-2',date:'2026-11-15',kind:'expense',expression:'12',amountCents:1200,purpose:'地铁',categoryId:'transport',receiptIds:[],version:1},
    {id:'e-3',date:'2026-11-14',kind:'income',expression:'800',amountCents:80000,purpose:'兼职稿酬',categoryId:'salary',receiptIds:[],version:1}
  ];
  const f=fixture({initialEntries});await flush();
  assert.ok(Boolean($('.finance-insights',f.root).compareDocumentPosition($('.finance-ledger',f.root))&Node.DOCUMENT_POSITION_FOLLOWING),'ledger sits below insights at the bottom of the finance page');
  const cards=$$('.finance-day-card',f.root);
  assert.equal(cards.length,2);
  assert.equal($$('.finance-entry',f.root).length,0);
  assert.match($('[data-finance-day-card="2026-11-15"]',f.root).textContent,/¥47\.50/);
  assert.match($('[data-finance-day-card="2026-11-14"]',f.root).textContent,/\+¥800\.00/);
  assert.equal($('[data-finance-day-card="2026-11-15"]',f.root).closest('[data-slot="button"]'),null);
  $('[data-finance-day-card="2026-11-15"]',f.root).click();
  assert.equal($('[data-finance-day-detail]',f.root).dataset.financeDayDetail,'2026-11-15');
  assert.equal($$('.finance-entry',f.root).length,2);
  assert.match($('[data-finance-day-detail]',f.root).textContent,/午饭/);
  assert.doesNotMatch($('[data-finance-day-detail]',f.root).textContent,/兼职稿酬/);
  $('[data-finance-day-card="2026-11-14"]',f.root).click();
  assert.equal($('[data-finance-day-detail]',f.root).dataset.financeDayDetail,'2026-11-14');
  assert.equal($$('.finance-entry',f.root).length,1);
  assert.match($('[data-finance-day-detail]',f.root).textContent,/兼职稿酬/);
  $('[data-finance-day-close]',f.root).click();
  assert.equal($('[data-finance-day-detail]',f.root),null);
  assert.equal($$('.finance-entry',f.root).length,0);
});

test('all three summary cards render data bars and the split quick composer toggles its empty desk cleanly',async()=>{
  const f=fixture({handler:path=>path.startsWith('/api/finance?')?{categories:DEFAULT_FINANCE_CATEGORIES,entries:[],summary:{expenseCents:6000,refundCents:0,netExpenseCents:6000,incomeCents:14000,balanceCents:8000,count:3},expenseCategoryTotals:[{categoryId:'food',name:'餐饮',cents:6000}],trend:[]}:undefined});await flush();
  const meters=$$('.finance-summary .finance-stat .finance-flow-meter',f.root);
  assert.equal(meters.length,3);
  assert.match($('.finance-stat-expense .finance-flow-legend',f.root).textContent,/支出占 30%.*总支出 ¥60\.00/);
  assert.match($('.finance-stat-income .finance-flow-legend',f.root).textContent,/收入占 70%.*覆盖支出 233%/);
  assert.match($('.finance-stat-balance .finance-flow-legend',f.root).textContent,/结余率 57%.*净结余 ¥80\.00/);
  assert.equal($('.finance-stat-expense .finance-flow-track>i',f.root).style.width,'30%');
  assert.equal($('.finance-stat-income .finance-flow-track>i',f.root).style.width,'70%');
  assert.equal($('.finance-stat-balance .finance-flow-track>i',f.root).style.width,'57%');
  const form=$('[data-finance-create]',f.root),emptyDesk=$('[data-finance-desk-empty]',form),badge=$('[data-finance-desk-badge]',form);
  assert.equal(emptyDesk.hidden,false);
  assert.match(badge.textContent,/支持拖拽/);
  input(form,'text','60 打车\n50 吃饭');
  assert.equal(emptyDesk.hidden,true);
  assert.match(badge.textContent,/已自动归类/);
  assert.equal($$('.finance-line-row',form).length,2);
  $('[data-clear-entry]',form).click();
  assert.equal(emptyDesk.hidden,false);
  assert.equal($$('.finance-line-row',form).length,0);
});

test('daily card progress bars reflect share of the monthly total rather than max single day',async()=>{
  const initialEntries=[
    {id:'d-1',date:'2026-11-25',kind:'expense',expression:'200',amountCents:20000,purpose:'车费',categoryId:'transport',receiptIds:[],version:1},
    {id:'d-2',date:'2026-11-20',kind:'expense',expression:'100',amountCents:10000,purpose:'晚餐',categoryId:'food',receiptIds:[],version:1},
    {id:'d-3',date:'2026-11-18',kind:'expense',expression:'200',amountCents:20000,purpose:'采购',categoryId:'shopping',receiptIds:[],version:1},
    {id:'d-4',date:'2026-11-15',kind:'income',expression:'1000',amountCents:100000,purpose:'稿酬',categoryId:'salary',receiptIds:[],version:1},
    {id:'d-5',date:'2026-11-10',kind:'income',expression:'3000',amountCents:300000,purpose:'工资',categoryId:'salary',receiptIds:[],version:1}
  ];
  const f=fixture({initialEntries});await flush();
  const c25=$('[data-finance-day-card="2026-11-25"]',f.root);
  const c20=$('[data-finance-day-card="2026-11-20"]',f.root);
  const c15=$('[data-finance-day-card="2026-11-15"]',f.root);
  const c10=$('[data-finance-day-card="2026-11-10"]',f.root);
  assert.equal($('.finance-day-card-bar>i',c25).style.width,'40%');
  assert.match($('.finance-day-card-share',c25).textContent,/占本月支出.*40\.0%/);
  assert.equal($('.finance-day-card-bar>i',c20).style.width,'20%');
  assert.match($('.finance-day-card-share',c20).textContent,/占本月支出.*20\.0%/);
  assert.equal($('.finance-day-card-bar>i',c15).style.width,'25%');
  assert.match($('.finance-day-card-share',c15).textContent,/占本月收入.*25\.0%/);
  assert.equal($('.finance-day-card-bar>i',c10).style.width,'75%');
  assert.match($('.finance-day-card-share',c10).textContent,/占本月收入.*75\.0%/);
});

test('dedicated annual page displays yearly summary, pie, 12-month rhythm, expandable monthly ledger cards, and navigation hooks',async()=>{
  const entries2026=[
    {id:'y-1',date:'2026-11-15',kind:'expense',expression:'180',amountCents:18000,purpose:'聚餐',categoryId:'food',receiptIds:[],version:1},
    {id:'y-2',date:'2026-08-03',kind:'expense',expression:'150',amountCents:15000,purpose:'打车',categoryId:'transport',receiptIds:[],version:1}
  ];
  const year2026={categories:DEFAULT_FINANCE_CATEGORIES,entries:entries2026,summary:{incomeCents:120000,expenseCents:35000,refundCents:2000,netExpenseCents:33000,balanceCents:87000,count:8},expenseCategoryTotals:[{categoryId:'food',name:'餐饮',cents:21000},{categoryId:'transport',name:'交通',cents:14000}],trend:[{date:'2026-08-03',expenseCents:15000,spendingCents:15000,incomeCents:0},{date:'2026-11-15',expenseCents:18000,spendingCents:20000,incomeCents:120000}],monthSummaries:[{month:'2026-11',count:5,dayCount:3,expenseCents:20000,refundCents:2000,netExpenseCents:18000,incomeCents:120000,categoryTotalCents:20000,topCategories:[{id:'food',name:'餐饮',cents:14000},{id:'transport',name:'交通',cents:6000}]},{month:'2026-08',count:3,dayCount:2,expenseCents:15000,refundCents:0,netExpenseCents:15000,incomeCents:0,categoryTotalCents:15000,topCategories:[{id:'transport',name:'交通',cents:15000}]}],nextCursor:'next-year-page'};
  const augMonth={categories:DEFAULT_FINANCE_CATEGORIES,entries:[entries2026[1]],summary:{incomeCents:0,expenseCents:15000,refundCents:0,netExpenseCents:15000,balanceCents:-15000,count:1},expenseCategoryTotals:[],trend:[],nextCursor:'next-aug-page'};
  const augMore={categories:DEFAULT_FINANCE_CATEGORIES,entries:[{id:'y-3',date:'2026-08-01',kind:'expense',expression:'40',amountCents:4000,purpose:'早茶',categoryId:'food',receiptIds:[],version:1}],summary:{incomeCents:0,expenseCents:15000,refundCents:0,netExpenseCents:15000,balanceCents:-15000,count:2},expenseCategoryTotals:[],trend:[],nextCursor:null};
  const year2025={categories:DEFAULT_FINANCE_CATEGORIES,entries:[{id:'y-old',date:'2025-12-20',kind:'expense',expression:'90',amountCents:9000,purpose:'冬衣',categoryId:'shopping',receiptIds:[],version:1}],summary:{incomeCents:50000,expenseCents:9000,refundCents:0,netExpenseCents:9000,balanceCents:41000,count:2},expenseCategoryTotals:[{categoryId:'shopping',name:'购物',cents:9000}],trend:[{date:'2025-12-20',expenseCents:9000,spendingCents:9000,incomeCents:50000}],monthSummaries:[{month:'2025-12',count:1,dayCount:1,expenseCents:9000,refundCents:0,netExpenseCents:9000,incomeCents:50000,categoryTotalCents:9000,topCategories:[{id:'shopping',name:'购物',cents:9000}]}],nextCursor:null};
  const back=[],jumped=[];
  const f=fixture({annual:true,onBackToFinance:()=>back.push(true),onSelectMonth:month=>jumped.push(month),handler:path=>path==='/api/finance?year=2026'?year2026:path==='/api/finance?year=2025'?year2025:path==='/api/finance?month=2026-08'?augMonth:path==='/api/finance?month=2026-08&cursor=next-aug-page'?augMore:undefined});await flush();
  assert.match($('[data-finance-summary]',f.root).textContent,/年度净支出.*330\.00.*年度收入.*1,200\.00.*年度收支差额.*870\.00.*月均净支出.*165\.00/);
  assert.match($('[data-finance-year-pie]',f.root).textContent,/餐饮.*¥210\.00.*交通.*¥140\.00/);
  assert.equal($$('[data-finance-year-month]',f.root).length,12);
  assert.match($('[data-finance-year-rhythm]',f.root).textContent,/峰值 11月.*¥180\.00/);
  assert.equal($$('[data-finance-month-card]',f.root).length,2);
  assert.equal($$('.finance-day-card',f.root).length,0,'annual month cards use their own independent archive layout');
  assert.equal($('[data-finance-filters]',f.root).elements.q,undefined,'annual ledger omits redundant purpose search field');
  assert.equal($$('.finance-entry',f.root).length,0);
  const novCard=$('[data-finance-month-card="2026-11"]',f.root).textContent;
  assert.match(novCard,/2026年.*11月.*餐饮 70%.*占全年支出.*54\.5%/);
  assert.doesNotMatch(novCard,/NOV|Q[1-4]/,'annual cards keep pure Chinese copy without English codes');
  $('[data-finance-month-card="2026-08"]',f.root).click();await flush();
  assert.equal($('.finance-day-detail',f.root),null,'annual expanded month uses full-width broadsheet rather than daily drawer');
  assert.equal($('.finance-spread-seal',f.root),null,'expanded monthly header omits redundant crowded square icon');
  const augDetail=$('[data-finance-month-detail="2026-08"]',f.root).textContent;
  assert.match(augDetail,/8月收支明细.*月度收支差额.*打车/);
  assert.doesNotMatch(augDetail,/AUGUST/,'expanded monthly header omits English eyebrow');
  $('[data-finance-month-more]',f.root).click();await flush();
  assert.match($('[data-finance-month-detail="2026-08"]',f.root).textContent,/早茶/);
  $('[data-finance-month-close]',f.root).click();
  assert.equal($('[data-finance-month-detail]',f.root),null);
  $('[data-finance-year-prev]',f.root).click();await flush();
  assert.equal($('[data-finance-year-label]',f.root).textContent,'2025年');
  assert.equal($('[data-finance-year-current]',f.root).hidden,false);
  assert.match($('[data-finance-year-pie]',f.root).textContent,/购物.*¥90\.00/);
  assert.equal($('[data-finance-month-card="2025-12"]',f.root).classList.contains('is-featured'),true,'single-month year elevates card to full-width featured layout');
  assert.match($('[data-finance-month-card="2025-12"]',f.root).textContent,/12月.*购物/);
  $('[data-finance-month-card="2025-12"]',f.root).click();
  assert.match($('[data-finance-month-detail="2025-12"]',f.root).textContent,/冬衣/);
  $('[data-finance-year-current]',f.root).click();await flush();
  assert.equal($('[data-finance-year-label]',f.root).textContent,'2026年');
  $('[data-finance-year-month="2026-08"]',f.root).click();
  assert.deepEqual(jumped,['2026-08']);
  $('[data-finance-back]',f.root).click();
  assert.equal(back.length,1);
});
