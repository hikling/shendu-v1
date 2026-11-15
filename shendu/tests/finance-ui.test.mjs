import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mountFinancePage,mountDailyFinance} from '../public/finance-ui.js';
import {DEFAULT_FINANCE_CATEGORIES,parseMoneyExpression} from '../public/finance-domain.js';

const dom=new JSDOM('<main id="app"></main><div id="modal-root"></div>',{url:'https://shendu.test',pretendToBeVisual:true}),win=dom.window;
for(const key of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement','HTMLSelectElement','HTMLButtonElement','HTMLFormElement','Element','Node','NodeFilter','Event','CustomEvent','KeyboardEvent','MouseEvent','MutationObserver','getComputedStyle','FormData'])globalThis[key]=win[key];
Object.defineProperty(globalThis,'navigator',{value:win.navigator,configurable:true});
globalThis.requestAnimationFrame=win.requestAnimationFrame.bind(win);globalThis.cancelAnimationFrame=win.cancelAnimationFrame.bind(win);globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
win.HTMLElement.prototype.scrollIntoView=function(){};
const ui=await import('../public/ui/shadcn.js');
const $=(selector,root=document)=>root.querySelector(selector),$$=(selector,root=document)=>[...root.querySelectorAll(selector)],flush=async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve))};
let controller;

function fixture({daily=false,readonly=false,snapshot,draft,handler,receiptClient,initialEntries=[]}={}){
  ui.disposeUi($('#app'));ui.disposeUi($('#modal-root'));$('#app').replaceChildren();$('#modal-root').replaceChildren();
  const root=document.createElement('section');$('#app').append(root);let current=true,pending=false;
  const calls=[],notices=[],drafts=[],dirty=[],ended=[];let entries=structuredClone(initialEntries),categories=DEFAULT_FINANCE_CATEGORIES.map(category=>({...category,version:0})),nextCursor=null;
  const result=()=>({categories,entries:structuredClone(entries),nextCursor,summary:{incomeCents:0,expenseCents:entries.filter(entry=>!entry.deletedAt).reduce((sum,row)=>sum+row.amountCents,0),refundCents:0,netExpenseCents:entries.filter(entry=>!entry.deletedAt).reduce((sum,row)=>sum+row.amountCents,0),balanceCents:-entries.filter(entry=>!entry.deletedAt).reduce((sum,row)=>sum+row.amountCents,0),count:entries.filter(entry=>!entry.deletedAt).length},trend:[],categoryTotals:[],day:{date:'2026-11-15',state:entries.length?'recorded':'unrecorded',version:0}});
  const request=async(path,args={},guard=()=>true)=>{
    calls.push({path,args,guard});const intercepted=handler?.(path,args,guard);if(intercepted!==undefined)return await intercepted;
    if(path==='/api/finance/storage')return {configured:false,config:{},version:0,targets:[{id:'storage-target',name:'自己的S3'}]};
    if(path.startsWith('/api/finance?'))return result();
    if(path==='/api/finance/entries'&&args.method==='POST'){const entry={...args.body,amountCents:parseMoneyExpression(args.body.expression),version:1,createdAt:'2026-11-15T00:00:00Z',updatedAt:'2026-11-15T00:00:00Z',deletedAt:null};entries.unshift(entry);return {entry}}
    if(path==='/api/finance/day')return {day:args.body};
    if(path==='/api/finance/categories'){const category={...args.body,version:1};categories.push(category);return {category}}
    if(path.startsWith('/api/finance/categories/')){const category={...args.body,id:decodeURIComponent(path.split('/').at(-1))};categories=categories.map(row=>row.id===category.id?category:row);return {category}}
    if(path.endsWith('/restore')){const entry=entries.find(row=>row.id===path.split('/').at(-2));entry.deletedAt=null;entry.version++;return {entry}}
    if(args.method==='DELETE'){const entry=entries.find(row=>row.id===path.split('/').at(-1));entry.deletedAt='2026-11-15T01:00:00Z';entry.version++;return {entry}}
    if(args.method==='PUT'){const entry=entries.find(row=>row.id===path.split('/').at(-1));Object.assign(entry,args.body,{version:entry.version+1,amountCents:parseMoneyExpression(args.body.expression)});return {entry}}
    throw new Error(`Unexpected ${path}`);
  };
  const options={request,renderMarkup:ui.renderMarkup,today:()=> '2026-11-15',isCurrent:()=>current,toast:(...args)=>notices.push(args),setDirty:value=>dirty.push(value),onDraftChange:value=>drafts.push(value),beginWrite:()=>{if(pending)return null;pending=true;return {}},endWrite:token=>{pending=false;ended.push(token)},openModal:html=>ui.renderMarkup($('#modal-root'),`<section class="modal">${html}</section>`),closeModal:force=>{if($('#modal-root').dataset.persistent==='1'&&!force)return;ui.disposeUi($('#modal-root'));$('#modal-root').replaceChildren();$('#modal-root').dataset.persistent='0'},receiptClient};
  controller=daily?mountDailyFinance(root,{...options,date:'2026-11-15',readonly,snapshot,draft}):mountFinancePage(root,options);
  return {root,calls,notices,drafts,dirty,ended,request,result,setEntries:value=>{entries=value},setCursor:value=>{nextCursor=value},setCurrent:value=>{current=value},pending:()=>pending};
}
function input(form,name,value){const field=form.elements[name];field.value=value;field.dispatchEvent(new win.Event('input',{bubbles:true}));return field}
function change(form,name,value){const field=form.elements[name];if(field.type==='checkbox')field.checked=value;else field.value=value;field.dispatchEvent(new win.Event('change',{bubbles:true}));return field}
function submit(form){form.dispatchEvent(new win.Event('submit',{bubbles:true,cancelable:true}))}

test('refund-only month retains a negative trend and category with explicit signed accessible amounts',async()=>{
  const refund={id:'refund',date:'2026-11-15',kind:'refund',expression:'30',amountCents:3000,purpose:'上月购物退款',categoryId:'shopping',refundOf:'last-month-expense',version:1,receiptIds:[]};
  const f=fixture({handler:path=>path.startsWith('/api/finance?')?{categories:DEFAULT_FINANCE_CATEGORIES,entries:[refund],summary:{incomeCents:0,expenseCents:0,refundCents:3000,netExpenseCents:-3000,balanceCents:3000,count:1},trend:[{date:'2026-11-15',expenseCents:-3000,incomeCents:0}],categoryTotals:[{categoryId:'shopping',name:'购物',cents:-3000}]}:undefined});await flush();
  assert.match($('.finance-stat-expense',f.root).textContent,/-30\.00/);const trend=$('[data-finance-trend]',f.root),day=$('.finance-trend-day',trend);assert.ok(day.classList.contains('is-refund'));assert.equal(day.getAttribute('aria-label'),'2026-11-15 净支出 −¥30.00');assert.equal($('.finance-trend-bar',day).style.getPropertyValue('--finance-bar'),'125px');assert.equal($('.finance-chart-empty',trend),null);
  assert.match($('.finance-chart-legend',trend).textContent,/负数表示退款多于支出/);const details=$('details',trend);assert.match($('summary',details).textContent,/查看每日净支出金额/);details.open=true;assert.equal($('dd',details).textContent,'−¥30.00');
  const categories=$('[data-finance-categories]',f.root),category=$('.finance-category-meter',categories);assert.ok(category.classList.contains('is-refund'));assert.match(category.textContent,/购物（退款净额）/);assert.equal($('strong',category).textContent,'−¥30.00');assert.equal($('.finance-meter-track>span',category).style.width,'100%');assert.equal($('.finance-chart-empty',categories),null);assert.match($('.finance-insight .finance-section-title',f.root).textContent,/每日净支出/);
});

test('mixed net expenses scale by absolute cents, keep zero bars empty, and preserve mounted input on refresh',async()=>{
  let result={categories:DEFAULT_FINANCE_CATEGORIES,entries:[],summary:{incomeCents:0,expenseCents:1000,refundCents:4000,netExpenseCents:-3000,balanceCents:3000,count:2},trend:[{date:'2026-11-13',expenseCents:1000},{date:'2026-11-14',expenseCents:-4000},{date:'2026-11-15',expenseCents:0}],categoryTotals:[{categoryId:'transport',name:'交通',cents:1000},{categoryId:'shopping',name:'购物',cents:0},{categoryId:'food',name:'餐饮',cents:-4000}]};
  const f=fixture({handler:path=>path.startsWith('/api/finance?')?result:undefined});await flush();const form=$('[data-finance-create]',f.root),draft=input(form,'expression','8+8');
  const days=$$('.finance-trend-day',f.root);assert.deepEqual(days.map(day=>$('.finance-trend-bar',day).style.getPropertyValue('--finance-bar')),['31.25px','125px','0px']);assert.equal(days[0].classList.contains('is-refund'),false);assert.equal(days[1].classList.contains('is-refund'),true);assert.equal(days[2].classList.contains('is-refund'),false);assert.equal(days[0].getAttribute('aria-label'),'2026-11-13 净支出 +¥10.00');assert.equal(days[2].getAttribute('aria-label'),'2026-11-15 净支出 ¥0.00');
  assert.deepEqual($$('.finance-trend-values dd',f.root).map(node=>node.textContent),['+¥10.00','−¥40.00','¥0.00']);const categories=$$('.finance-category-meter',f.root);assert.equal(categories.length,2);assert.deepEqual(categories.map(category=>$('strong',category).textContent),['+¥10.00','−¥40.00']);assert.deepEqual(categories.map(category=>$('.finance-meter-track>span',category).style.width),['20%','80%']);
  result={...result,trend:[{date:'2026-11-16',expenseCents:-500}],categoryTotals:[{categoryId:'food',name:'餐饮',cents:-500}]};$('[data-finance-refresh]',f.root).click();await flush();assert.equal($('[data-finance-create]',f.root),form);assert.equal(form.elements.expression,draft);assert.equal(draft.value,'8+8');assert.equal($('.finance-category-meter strong',f.root).textContent,'−¥5.00');assert.equal(f.calls.some(call=>call.args.method==='POST'),false);
});

test('fully offset expense and refund totals show an honest zero-net chart state',async()=>{
  const f=fixture({handler:path=>path.startsWith('/api/finance?')?{entries:[],summary:{expenseCents:800,refundCents:800,netExpenseCents:0,count:2},trend:[{date:'2026-11-15',expenseCents:0}],categoryTotals:[{categoryId:'food',cents:0}]}:undefined});await flush();assert.equal($('.finance-trend-day',f.root),null);assert.equal($('.finance-category-meter',f.root),null);assert.match($('[data-finance-trend]',f.root).textContent,/暂无净支出变化.*相抵/);assert.match($('[data-finance-categories]',f.root).textContent,/暂无分类净支出.*相抵/);
});

test('finance uses exact expression preview and suggestions without creating entries until explicit confirmation',async()=>{
  const f=fixture();await flush();const form=$('[data-finance-create]',f.root),amount=form.elements.expression;
  input(form,'expression','8+8+8-1');input(form,'purpose','早餐');
  assert.equal($('[data-finance-calculation]',form).textContent,'合计 ¥23.00');assert.equal(form.elements.categoryId.value,'food');
  assert.equal(f.calls.filter(call=>call.args.method==='POST').length,0);change(form,'categoryId','shopping');input(form,'purpose','早餐和日用品');assert.equal(form.elements.categoryId.value,'shopping');
  submit(form);await flush();const writes=f.calls.filter(call=>call.path==='/api/finance/entries');assert.equal(writes.length,1);assert.equal(writes[0].args.body.expression,'8+8+8-1');assert.equal(writes[0].args.body.categoryId,'shopping');
  assert.equal(form.elements.expression,amount);assert.equal(amount.value,'');assert.match($('[data-finance-entries]',f.root).textContent,/早餐和日用品/);assert.equal(controller.hasPendingDraft(),false);
});

test('daily draft survives failed writes; retry keeps the exact creation ID and submit is serialized',async()=>{
  let rejectWrite;let attempts=0;const f=fixture({daily:true,draft:{expression:'8+8',purpose:'早餐'},handler:(path,args)=>{if(path==='/api/finance/entries'&&++attempts===1)return new Promise((_,reject)=>{rejectWrite=reject})}});await flush();
  const form=$('[data-finance-create]',f.root);assert.equal(form.elements.expression.value,'8+8');input(form,'note','不要丢失这段备注');submit(form);submit(form);await flush();
  assert.equal(f.calls.filter(call=>call.path==='/api/finance/entries').length,1);assert.equal($('fieldset',form).disabled,true);assert.equal(f.pending(),true);
  rejectWrite(new Error('网络暂时不可用'));await flush();assert.equal(form.elements.note.value,'不要丢失这段备注');assert.equal(form.elements.expression.value,'8+8');assert.equal($('fieldset',form).disabled,false);assert.match($('[data-form-error]',form).textContent,/网络/);assert.equal(controller.hasPendingDraft(),true);
  submit(form);await flush();const writes=f.calls.filter(call=>call.path==='/api/finance/entries');assert.equal(writes[0].args.body.id,writes[1].args.body.id);assert.equal(f.drafts.at(-1).expression,'');assert.equal(f.pending(),false);
});

test('invalid amounts remain on the same actual field and never reach the write API',async()=>{
  const f=fixture();await flush();const form=$('[data-finance-create]',f.root),field=input(form,'expression','8+');submit(form);await flush();assert.equal(document.activeElement,field);assert.equal(field.value,'8+');assert.ok($('[data-form-error]',form).textContent);assert.equal(f.calls.filter(call=>call.args.method==='POST').length,0);
});

test('filters and pagination refresh only the ledger while preserving unsaved form nodes and search focus',async()=>{
  const f=fixture();await flush();const form=$('[data-finance-create]',f.root),field=input(form,'expression','12.50'),search=$('input[name="q"]',f.root);
  f.setCursor('next-page');$('[data-finance-refresh]',f.root).click();await flush();search.value='午餐';search.focus();search.dispatchEvent(new win.Event('input',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,250));await flush();
  assert.equal($('[data-finance-create]',f.root),form);assert.equal(form.elements.expression,field);assert.equal(field.value,'12.50');assert.equal(document.activeElement,search);assert.ok(f.calls.some(call=>call.path.includes('q=%E5%8D%88%E9%A4%90')));
  $('[data-finance-more]',f.root).click();await flush();assert.ok(f.calls.some(call=>call.path.includes('cursor=next-page')));
});

test('snapshot-only history never requests or displays the current account ledger',()=>{
  const f=fixture({daily:true,readonly:true,snapshot:{netExpenseCents:2300,state:'recorded',count:1,entries:[{kind:'expense',amountCents:2300,purpose:'<script>旧花销</script>',categoryName:'餐饮'}]}});
  assert.equal(f.calls.length,0);assert.match(f.root.textContent,/23.00/);assert.match(f.root.textContent,/<script>旧花销<\/script>/);assert.equal($('script',f.root),null);assert.equal($('form',f.root),null);assert.equal(controller.hasPendingDraft(),false);
});

test('obsolete reads and writes cannot replace a newer account surface or clear its draft',async()=>{
  let finishLoad;const f=fixture({handler:path=>path.startsWith('/api/finance?')?new Promise(resolve=>{finishLoad=resolve}):undefined});await flush();f.setCurrent(false);finishLoad({entries:[{id:'foreign',purpose:'不能显示'}],categories:[],summary:{}});await flush();assert.doesNotMatch(f.root.textContent,/不能显示/);
  controller.dispose();let finishWrite;const next=fixture({daily:true,handler:(path,args)=>path==='/api/finance/entries'?new Promise(resolve=>{finishWrite=resolve}):undefined});await flush();const form=$('[data-finance-create]',next.root);input(form,'expression','20');input(form,'purpose','原账户输入');submit(form);await flush();next.setCurrent(false);finishWrite({entry:{}});await flush();assert.equal(form.elements.purpose.value,'原账户输入');assert.equal(next.notices.length,0);assert.equal(next.drafts.at(-1).purpose,'原账户输入');assert.equal(next.pending(),false);
});

test('refund creation from the daily widget keeps original association and does not consume its unfinished entry',async()=>{
  const f=fixture({daily:true,initialEntries:[{id:'expense-id',date:'2026-11-15',kind:'expense',expression:'50',amountCents:5000,purpose:'午餐',categoryId:'food',version:2,receiptIds:[]}]});await flush();
  const original=$('[data-finance-create]',f.root);input(original,'expression','8');input(original,'purpose','还没记的早餐');$('[data-entry-action="refund"]',f.root).click();const form=$('#finance-edit-form');assert.ok(form.elements.kind);assert.equal(form.elements.kind.value,'refund');assert.equal(form.elements.refundOf.value,'expense-id');input(form,'expression','10');submit(form);await flush();
  const write=f.calls.find(call=>call.path==='/api/finance/entries');assert.equal(write.args.body.kind,'refund');assert.equal(write.args.body.refundOf,'expense-id');assert.equal(original.elements.purpose.value,'还没记的早餐');assert.equal(controller.hasPendingDraft(),true);assert.equal($('#finance-edit-form'),null);
});

test('delete and restore keep the selected version and truthful deleted state',async()=>{
  const f=fixture({initialEntries:[{id:'delete-id',date:'2026-11-15',kind:'expense',expression:'8',amountCents:800,purpose:'早餐',categoryId:'food',version:3,receiptIds:[]}]});await flush();$('[data-entry-action="delete"]',f.root).click();submit($('#finance-delete-form'));await flush();
  const deletion=f.calls.find(call=>call.args.method==='DELETE');assert.deepEqual(deletion.args.body,{version:3});assert.ok($('.finance-entry.is-deleted',f.root));$('[data-entry-action="restore"]',f.root).click();await flush();const restoration=f.calls.find(call=>call.path.endsWith('/restore'));assert.deepEqual(restoration.args.body,{version:4});assert.equal($('.finance-entry.is-deleted',f.root),null);
});

test('built-in category edits retain version zero and failed storage save preserves inputs for retry',async()=>{
  let failStorage=true;const f=fixture({handler:(path,args)=>{if(path==='/api/finance/storage'&&args.method==='PUT'&&failStorage){failStorage=false;return Promise.reject(new Error('存储暂不可达'))}}});await flush();$('[data-manage-categories]',f.root).click();$('[data-edit-category="food"]').click();let form=$('#finance-category-form');input(form,'name','吃饭');submit(form);await flush();assert.equal(f.calls.find(call=>call.path==='/api/finance/categories/food').args.body.version,0);
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
  const form=$('[data-finance-create]',f.root);input(form,'expression','7');input(form,'purpose','手填草稿');selectScreenshot(f);await flush();assert.equal(f.pending(),true);assert.equal($('[data-cancel-import]',f.root).hidden,false);
  $('[data-cancel-import]',f.root).click();await flush();assert.equal(signal.aborted,true);assert.equal(f.pending(),false);assert.equal($('fieldset',form).disabled,false);assert.equal($('[data-cancel-import]',f.root).hidden,true);assert.equal(form.elements.purpose.value,'手填草稿');assert.equal(disposed,1);assert.match($('[data-finance-status]',f.root).textContent,/已取消/);
  finish({candidates:[{expression:'99',purpose:'过期结果'}]});await flush();assert.equal($('#finance-import-form'),null);assert.equal(f.calls.filter(call=>call.path==='/api/finance/entries').length,0);
});

test('disposing processing aborts its owner and cannot update a replacement page',async()=>{
  let finish,signal;const f=fixture({receiptClient:{processReceiptFiles:async(files,options)=>{signal=options.signal;return new Promise(resolve=>{finish=resolve})},disposeReceiptWorker(){}}});await flush();selectScreenshot(f);await flush();controller.dispose();await flush();assert.equal(signal.aborted,true);assert.equal(f.pending(),false);finish({candidates:[{expression:'22'}]});await flush();assert.equal($('#finance-import-form'),null);
});

test('canceling a low-confidence preview creates no entries and duplicate candidates require an explicit selection',async()=>{
  const f=fixture({initialEntries:[{id:'prior',date:'2026-11-15',kind:'expense',expression:'8',amountCents:800,purpose:'早餐',categoryId:'food',version:1,receiptIds:[]}],receiptClient:{processReceiptFiles:async()=>({candidates:[{expression:'8',date:'2026-11-15',kind:'expense',purpose:'早餐',confidence:'low',warnings:['日期需要核对']},{expression:'12',kind:'expense',purpose:'午餐',confidence:'medium'}],warnings:[]})}});await flush();selectScreenshot(f);await flush();const form=$('#finance-import-form');assert.match(form.textContent,/请仔细核对/);assert.match(form.textContent,/疑似重复/);assert.equal(form.elements['select-0'].checked,false);assert.equal(form.elements['select-1'].checked,true);assert.match(form.textContent,/日期需要核对/);
  $('[data-close]',form).click(); // The app owns close handling; simulate the same successful close here.
  ui.renderMarkup($('#modal-root'),'');await flush();assert.equal(f.calls.filter(call=>call.path==='/api/finance/entries').length,0);assert.equal(f.pending(),false);
  selectScreenshot(f);await flush();const next=$('#finance-import-form');next.elements['select-0'].checked=true;next.elements['select-1'].checked=false;submit(next);await flush();assert.equal(f.calls.filter(call=>call.path==='/api/finance/entries').length,1);assert.equal(f.calls.find(call=>call.path==='/api/finance/entries').args.body.expression,'8');
});

test('thumbnail authorization waits for viewport proximity and failed thumbnails expose retry',async()=>{
  const previous=globalThis.IntersectionObserver;let callback,disconnected=0;const observed=[];globalThis.IntersectionObserver=class{constructor(fn,options){callback=fn;assert.equal(options.rootMargin,'240px')}observe(node){observed.push(node)}unobserve(){}disconnect(){disconnected++}};
  const reads=[];try{const f=fixture({initialEntries:[{id:'photo-entry',date:'2026-11-15',kind:'expense',expression:'8',amountCents:800,purpose:'早餐',categoryId:'food',version:1,receiptIds:['receipt']}],receiptClient:{loadReceiptUrls:async(ids,variant)=>{reads.push({ids,variant});throw new Error('过期授权')}}});await flush();assert.equal(reads.length,0);assert.equal(observed.length,1);callback([{target:observed[0],isIntersecting:true}]);await flush();assert.equal(reads.length,1);assert.equal(reads[0].variant,'thumb');assert.match(observed[0].textContent,/重试/);assert.match(observed[0].getAttribute('aria-label'),/重新获取/);controller.dispose();assert.ok(disconnected)}finally{if(previous===undefined)delete globalThis.IntersectionObserver;else globalThis.IntersectionObserver=previous}
});

test('storage save explicitly explains the page refresh needed for changed image access permissions',async()=>{
  const f=fixture();await flush();$('[data-finance-storage]',f.root).click();await flush();const form=$('#finance-storage-form');input(form,'endpoint','https://storage.example.com');input(form,'bucket','private');submit(form);await flush();assert.match($('[data-storage-note]',f.root).textContent,/保存未入账内容.*刷新页面/);assert.match(f.notices.at(-1)[0],/刷新页面/);
});

const photoEntry={id:'photo-entry',date:'2026-11-15',kind:'expense',expression:'8',amountCents:800,purpose:'早餐',categoryId:'food',version:1,receiptIds:['receipt-a','receipt-b']};

test('full-image load failure offers a retry that obtains fresh authorization without replacing the modal',async()=>{
  const reads=[];const f=fixture({initialEntries:[photoEntry],receiptClient:{loadReceiptUrls:async(ids,variant)=>{if(variant==='thumb')return {};reads.push(ids);return {[ids[0]]:`https://private.example.com/image.webp?signature=${reads.length}`}}}});await flush();
  $('[data-receipt-open="receipt-a"]',f.root).click();await flush();const view=$('[data-finance-image-view]'),image=$('img',view),message=$('[data-finance-image-status]',view),retry=$('[data-finance-image-retry]');assert.equal(reads.length,1);assert.match(image.src,/signature=1/);
  image.dispatchEvent(new win.Event('error'));assert.equal(image.hidden,true);assert.equal(message.hidden,false);assert.match(message.textContent,/截图加载失败.*授权已过期/);assert.equal(retry.hidden,false);
  retry.click();await flush();assert.equal($('[data-finance-image-view]'),view);assert.equal(reads.length,2);const refreshed=$('img',view);assert.notEqual(refreshed,image);assert.match(refreshed.src,/signature=2/);refreshed.dispatchEvent(new win.Event('load'));assert.equal(message.hidden,true);assert.equal(refreshed.hidden,false);assert.equal(retry.hidden,true);
  image.dispatchEvent(new win.Event('error'));assert.equal(message.hidden,true);assert.equal(f.calls.filter(call=>call.path==='/api/finance/entries').length,0);
});

test('a late full-image authorization cannot replace a newer same-account reauthentication modal',async()=>{
  let finish,guard;const f=fixture({initialEntries:[photoEntry],receiptClient:{loadReceiptUrls:async(ids,variant,options)=>{if(variant==='thumb')return {};guard=options.isCurrent;return new Promise(resolve=>{finish=resolve})}}});await flush();$('[data-receipt-open="receipt-a"]',f.root).click();await flush();assert.equal(guard(),true);
  ui.renderMarkup($('#modal-root'),'<section class="modal" id="replacement-reauth"><h2>重新登录</h2><input type="password" value="保持当前输入"></section>');$('#modal-root').dataset.persistent='1';assert.equal(guard(),false);
  finish({'receipt-a':'https://private.example.com/stale.webp'});await flush();assert.ok($('#replacement-reauth'));assert.equal($('input',$('#replacement-reauth')).value,'保持当前输入');assert.equal($('#modal-root').dataset.persistent,'1');assert.equal($('[data-finance-image-view]'),null);assert.equal(f.notices.length,0);
});

test('old image-read failures stay silent while the latest receipt keeps its own inline retry',async()=>{
  const reads=[];const f=fixture({initialEntries:[photoEntry],receiptClient:{loadReceiptUrls:async(ids,variant,options)=>{if(variant==='thumb')return {};return new Promise((resolve,reject)=>reads.push({ids,resolve,reject,current:options.isCurrent}))}}});await flush();
  $('[data-receipt-open="receipt-a"]',f.root).click();await flush();$('[data-receipt-open="receipt-b"]',f.root).click();await flush();assert.equal(reads[0].current(),false);assert.equal(reads[1].current(),true);const view=$('[data-finance-image-view]');
  reads[0].reject(new Error('旧截图错误不能出现'));reads[1].reject(new Error('图片授权暂时不可用'));await flush();assert.equal($('[data-finance-image-view]'),view);assert.match(view.textContent,/图片授权暂时不可用/);assert.doesNotMatch(view.textContent,/旧截图错误/);assert.equal($('[data-finance-image-retry]').hidden,false);assert.equal(f.notices.length,0);
  $('[data-finance-image-retry]').click();$('[data-finance-image-retry]').dispatchEvent(new win.Event('click'));await flush();assert.equal(reads.length,3);assert.deepEqual(reads[2].ids,['receipt-b']);reads[2].resolve({'receipt-b':'https://private.example.com/latest.webp'});await flush();assert.match($('img',view).src,/latest\.webp/);
});

for(const daily of [false,true])test(`manual multi-entry ${daily?'daily':'finance'} flow preserves mounted rows and saves only explicitly confirmed rows`,async()=>{
  const f=fixture({daily});await flush();const single=$('[data-finance-create]',f.root),unfinished=input(single,'purpose','保留单笔草稿');$('[data-manual-batch]',f.root).click();const form=$('#finance-import-form');assert.match($('#modal-root').textContent,/记下多笔收支/);assert.equal($$('[data-import-index]',form).length,2);
  const first=input(form,'expression-0','8+8+8-1');input(form,'purpose-0','早餐');assert.equal(form.elements['category-0'].value,'food');assert.equal($('[data-import-index="0"] output',form).textContent,'合计 ¥23.00');change(form,'category-0','shopping');input(form,'purpose-0','早餐和日用品');input(form,'note-0','可选备注');assert.equal(form.elements['category-0'].value,'shopping');
  $('[data-import-add]',form).click();assert.equal($$('[data-import-index]',form).length,3);assert.equal(form.elements['expression-0'],first);assert.equal(first.value,'8+8+8-1');$('[data-import-remove="1"]',form).click();assert.equal($$('[data-import-index]',form).length,2);assert.equal(form.elements['expression-0'],first);assert.equal(form.elements['expression-1'],undefined);
  change(form,'kind-2','income');input(form,'expression-2','100');input(form,'purpose-2','工资');assert.equal(form.elements['category-2'].value,'salary');assert.equal(f.calls.filter(call=>call.path==='/api/finance/entries').length,0);submit(form);await flush();const writes=f.calls.filter(call=>call.path==='/api/finance/entries');assert.equal(writes.length,2);assert.equal(writes[0].args.body.expression,'8+8+8-1');assert.equal(writes[0].args.body.categoryId,'shopping');assert.equal(writes[0].args.body.note,'可选备注');assert.equal(writes[1].args.body.kind,'income');assert.equal(writes[1].args.body.categoryId,'salary');assert.equal(writes[0].args.body.source,daily?'daily':'finance');assert.notEqual(writes[0].args.body.id,writes[1].args.body.id);assert.equal(single.elements.purpose,unfinished);assert.equal(unfinished.value,'保留单笔草稿');assert.equal(controller.hasPendingDraft(),true);
});

test('manual multi-entry partial success preserves retry IDs and guards add/remove while a write is pending',async()=>{
  let rejectSecond,failed=false;const f=fixture({handler:(path,args)=>{if(path==='/api/finance/entries'&&args.body.purpose==='午餐'&&!failed){failed=true;return new Promise((_,reject)=>{rejectSecond=reject})}}});await flush();$('[data-manual-batch]',f.root).click();const form=$('#finance-import-form');input(form,'expression-0','8');input(form,'purpose-0','早餐');input(form,'expression-1','12');input(form,'purpose-1','午餐');submit(form);submit(form);await flush();assert.equal(f.pending(),true);assert.equal(f.calls.filter(call=>call.path==='/api/finance/entries').length,2);
  $('[data-import-add]',form).dispatchEvent(new win.Event('click',{bubbles:true}));$('[data-import-remove="1"]',form).dispatchEvent(new win.Event('click',{bubbles:true}));assert.equal($$('[data-import-index]',form).length,2);rejectSecond(new Error('第二笔失败'));await flush();assert.equal($('[data-import-index="0"]',form).dataset.importDone,'true');assert.equal($('[data-import-remove="0"]',form).disabled,true);assert.equal(form.elements['expression-1'].value,'12');assert.match($('[data-form-error]',form).textContent,/第二笔失败/);
  const retained=form.elements['expression-1'];$('[data-import-add]',form).click();input(form,'expression-2','7');input(form,'purpose-2','打车');assert.equal(form.elements['expression-1'],retained);submit(form);await flush();const writes=f.calls.filter(call=>call.path==='/api/finance/entries');assert.equal(writes.length,4);assert.equal(writes[1].args.body.id,writes[2].args.body.id);assert.equal(writes.filter(call=>call.args.body.purpose==='早餐').length,1);assert.equal(writes[3].args.body.categoryId,'transport');assert.equal($('#finance-import-form'),null);
});

test('an obsolete account surface cannot open a manual batch dialog or mutate an already mounted batch',async()=>{
  const f=fixture();await flush();const button=$('[data-manual-batch]',f.root);f.setCurrent(false);button.click();assert.equal($('#finance-import-form'),null);f.setCurrent(true);button.click();const form=$('#finance-import-form');input(form,'expression-0','8');input(form,'purpose-0','早餐');input(form,'expression-1','12');input(form,'purpose-1','午餐');const rows=$$('[data-import-index]',form);
  f.setCurrent(false);$('[data-import-add]',form).click();$('[data-import-remove="0"]',form).click();submit(form);await flush();assert.deepEqual($$('[data-import-index]',form),rows);assert.equal(form.elements['expression-0'].value,'8');assert.equal(f.calls.filter(call=>call.path==='/api/finance/entries').length,0);assert.equal(f.pending(),false);
});

test('IME composition never searches unfinished text, and clear restores the list without replacing the draft',async()=>{
  const f=fixture();await flush();const form=$('[data-finance-create]',f.root),draft=input(form,'expression','12'),search=$('input[name="q"]',f.root),filters=$('[data-finance-filters]',f.root),clear=$('[data-finance-clear-search]',f.root),loads=()=>f.calls.filter(call=>call.path.startsWith('/api/finance?')).length;
  const initial=loads();search.value='w';search.dispatchEvent(new win.Event('input',{bubbles:true}));search.dispatchEvent(new win.Event('compositionstart',{bubbles:true}));search.value='午';search.dispatchEvent(new win.InputEvent('input',{bubbles:true,isComposing:true}));submit(filters);await new Promise(resolve=>setTimeout(resolve,250));await flush();assert.equal(loads(),initial);
  search.value='午餐';search.dispatchEvent(new win.Event('compositionend',{bubbles:true}));search.dispatchEvent(new win.InputEvent('input',{bubbles:true,isComposing:false}));await new Promise(resolve=>setTimeout(resolve,250));await flush();assert.equal(loads(),initial+1);assert.ok(f.calls.at(-1).path.includes('q=%E5%8D%88%E9%A4%90'));assert.equal(clear.hidden,false);
  clear.click();await flush();assert.equal(loads(),initial+2);assert.equal(search.value,'');assert.equal(clear.hidden,true);assert.equal(document.activeElement,search);assert.equal($('[data-finance-create]',f.root),form);assert.equal(form.elements.expression,draft);assert.equal(draft.value,'12');assert.equal(f.calls.at(-1).path.includes('q='),false);await new Promise(resolve=>setTimeout(resolve,250));assert.equal(loads(),initial+2);
});

test.afterEach(()=>{controller?.dispose();ui.disposeUi($('#app'));ui.disposeUi($('#modal-root'));$('#app').replaceChildren();$('#modal-root').replaceChildren()});
test.after(()=>dom.window.close());
