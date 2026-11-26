import {parseMoneyExpression,parseFinanceLines,formatFinanceMoney,DEFAULT_FINANCE_CATEGORIES,FINANCE_KINDS,suggestFinanceCategory,financeCategoryLabel} from './finance-domain.js?v=1.0.0-audit1';

import {matchFinanceReceipts} from './finance-receipt-matching.js?v=1.0.0-audit1';

const $=(selector,root)=>root.querySelector(selector),$$=(selector,root)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const blank=()=>({text:'',expression:'',purpose:'',categoryId:'',note:'',receiptIds:[]});
const automaticCategory=(purpose,categories,kind='expense')=>{const found=suggestFinanceCategory(purpose,categories,String(purpose??'').trim()?'expense':kind);return found==='uncategorized'?'':found};
const money=value=>formatFinanceMoney(Number(value)||0);
const id=()=>globalThis.crypto.randomUUID();
const entryMoney=entry=>`${entry.kind==='transfer'?'':entry.kind==='expense'?'−':'+'}¥${money(entry.amountCents)}`;
let formSequence=0;

function categoryOptions(categories,selected='',purpose='',kind='expense'){
  const values=categories.filter(category=>category.active!==false||category.id===selected);
  return `<option value="">${esc(purpose?`自动分类：${financeCategoryLabel(purpose,categories,kind)}`:'按用途自动分类')}</option>${values.map(category=>`<option value="${esc(category.id)}" ${category.id===selected?'selected':''}>${esc(category.name)}${category.active===false?'（已停用）':''}</option>`).join('')}`;
}
function hasDraft(draft){return Boolean(String(draft.text||'').trim()||String(draft.expression||'').trim()||String(draft.purpose||'').trim()||String(draft.note||'').trim()||draft.receiptIds?.length)}
function safeImageUrl(value){try{const url=new URL(value);return url.protocol==='https:'?url.href:''}catch{return ''}}
const rejectedFinanceWrite=error=>error.status===400||error.code==='finance_receipt_in_use';
const receiptOwners=ids=>new Map((ids||[]).map(id=>[id,-1]));
function claimRowReceipts(owners,ids,index){
  for(const id of ids)if(!owners.has(id))owners.set(id,index);
}
function clearReceiptChoice(checkbox){
  if(!checkbox.checked)return;
  checkbox.checked=false;
  checkbox.dispatchEvent(new Event('change'));
}
const WEEKDAY_SHORT=['日','一','二','三','四','五','六'];
const WEEKDAY_FULL=['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
const CATEGORY_ACCENTS=new Map(Object.entries({
  food:'#2f8f79',transport:'#d4943f',shopping:'#5b89b8',housing:'#cf7267',
  health:'#79a86b',learning:'#8a79b8',entertainment:'#d48653',social:'#4ea3b0',
  salary:'#6d84c2','other-income':'#b97ea8'
}));
const CATEGORY_PALETTE=[...CATEGORY_ACCENTS.values()];
function categoryAccent(id){
  const key=String(id||'');
  if(!key||key==='uncategorized')return '#a9b6ac';
  if(CATEGORY_ACCENTS.has(key))return CATEGORY_ACCENTS.get(key);
  let hash=2166136261;for(const char of key)hash=Math.imul(hash^char.codePointAt(0),16777619);
  return CATEGORY_PALETTE[(hash>>>0)%CATEGORY_PALETTE.length];
}
function dayCardParts(isoDate){
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate||''));
  if(!match)return {year:'',month:'',dayNum:String(isoDate||''),shortMonthDay:'',weekdayShort:'',fullTitle:String(isoDate||'')};
  const year=Number(match[1]),month=Number(match[2]),dayNum=Number(match[3]);
  const weekday=new Date(Date.UTC(year,month-1,dayNum)).getUTCDay();
  return {year:String(year),month:String(month),dayNum:String(dayNum),shortMonthDay:`${month}月`,weekdayShort:`周${WEEKDAY_SHORT[weekday]}`,fullTitle:`${year}年${month}月${dayNum}日 ${WEEKDAY_FULL[weekday]}`};
}
function summarizeDayRows(rows,nameOf){
  let expenseCents=0,refundCents=0,incomeCents=0,activeCount=0;
  const catTotals=new Map();
  for(const row of rows){
    if(row.deletedAt)continue;
    activeCount++;
    if(row.kind==='expense'){
      expenseCents+=row.amountCents;
      const cid=String(row.categoryId||'uncategorized');
      catTotals.set(cid,(catTotals.get(cid)||0)+row.amountCents);
    }
    if(row.kind==='refund')refundCents+=row.amountCents;
    if(row.kind==='income'){
      incomeCents+=row.amountCents;
      if(!expenseCents){
        const cid=String(row.categoryId||'other-income');
        catTotals.set(cid,(catTotals.get(cid)||0)+row.amountCents);
      }
    }
  }
  const topCategories=[...catTotals.entries()].sort((a,b)=>b[1]-a[1]).slice(0,2).map(([cid])=>({id:cid,name:nameOf?nameOf(cid):'',color:categoryAccent(cid)})).filter(item=>item.name);
  const netExpenseCents=expenseCents-refundCents,totalCount=rows.length;
  let label='当日记录',amountText='¥0.00',tone='is-neutral',subline='';
  if(expenseCents>0||refundCents>0){
    label=netExpenseCents<0?'当日净退回':'当日花销';
    amountText=`${netExpenseCents<0?'−':''}¥${money(Math.abs(netExpenseCents))}`;
    tone=netExpenseCents<0?'is-refund':'is-expense';
    subline=incomeCents>0?`收入 +¥${money(incomeCents)}`:'';
  }else if(incomeCents>0){
    label='当日收入';
    amountText=`+¥${money(incomeCents)}`;
    tone='is-income';
  }
  return {expenseCents,refundCents,incomeCents,netExpenseCents,activeCount,totalCount,label,amountText,tone,subline,topCategories};
}

function formatSharePct(rawPct){
  const value=Number(rawPct)||0;
  if(value<=0)return '0%';
  if(value>=99.95)return '100%';
  if(value<0.1)return '<0.1%';
  return `${value.toFixed(1)}%`;
}
function compactMoney(cents){
  const amount=Math.max(0,Number(cents)||0);
  if(!amount)return '';
  if(amount>=100000000)return `¥${Math.round(amount/1000000)}万`;
  if(amount>=1000000)return `¥${(amount/1000000).toFixed(1).replace(/\.0$/,'')}万`;
  if(amount>=10000)return `¥${Math.round(amount/100)}`;
  return `¥${(amount/100).toFixed(amount%100===0?0:1)}`;
}

function createWorkspace(container,options,mode='month'){
  const daily=mode==='daily',annual=mode==='annual';
  let disposed=false,pending=false,loadOwner=null,storageOwner=null,data=null,storage=null,categories=[...DEFAULT_FINANCE_CATEGORIES],cursor=null;
  let importController=null,receiptModule=null,storageDialogOwner=null,lastMatchResult=null;
  let entries=[],draft={...blank(),...(options.draft||{})},searchTimer,periodController=null,quickRows=[],refreshQuick=null,dayPicker=null,monthPie=null,dayPie=null,yearPie=null,dayOwner=null,selectedDay='',chartMonth=null,expandedLedgerDay=null;
  if(!draft.text&&(draft.expression||draft.purpose))draft.text=`${draft.expression} ${draft.purpose}`.trim();
  const aborter=new AbortController();
  const day=options.date||options.today();
  const initialMonth=/^\d{4}-(0[1-9]|1[0-2])$/.test(String(options.initialMonth||''))?options.initialMonth:day.slice(0,7);
  const initialYear=/^\d{4}$/.test(String(options.initialYear||''))&&options.initialYear!=='0000'?options.initialYear:day.slice(0,4);
  const filters={month:initialMonth,year:initialYear,q:'',kind:'',deleted:false};
  const alive=()=>!disposed&&container.isConnected&&(options.isCurrent?.()??true);
  const render=(node,html)=>options.renderMarkup(node,html);
  const notify=(message,type='info')=>{if(alive())options.toast?.(message,type)};
  const request=(path,args={},guard=alive)=>options.request(path,args,guard);
  const query=()=>{const params=new URLSearchParams(daily?{date:day}:annual?{year:filters.year}:{month:filters.month});for(const key of ['q','kind'])if(filters[key])params.set(key,filters[key]);if(filters.deleted)params.set('deleted','1');return params};
  const changed=()=>{options.onDraftChange?.({...draft,receiptIds:[...(draft.receiptIds||[])]});options.setDirty?.(hasDraft(draft))};
  const status=(message,error=false)=>{const node=$('[data-finance-status]',container);if(node){node.textContent=message;node.classList.toggle('is-error',error)}};
  const noFormLoss=()=>{const form=$('[data-finance-create]',container);return form?.isConnected?form:null};
  const categoryName=value=>categories.find(category=>category.id===value)?.name||'待分类';

  async function write(anchor,operation){
    if(pending||!alive()||!anchor?.isConnected)return false;
    const token=options.beginWrite?options.beginWrite():{};if(token===null||token===false)return false;
    pending=true;
    periodController?.setDisabled?.(true);dayPicker?.setDisabled?.(true);
    syncYearNavState();
    const fieldset=$('fieldset',anchor),previousDisabled=fieldset?.disabled,modal=anchor.closest('.modal')?.parentElement,previousPersistent=modal?.dataset.persistent;
    if(fieldset)fieldset.disabled=true;if(modal)modal.dataset.persistent='1';anchor.setAttribute('aria-busy','true');
    const current=()=>alive()&&anchor.isConnected&&(token.isCurrent?.()??true);
    try{await operation(current);return current()}
    catch(error){if(current()){const errorNode=$('[data-form-error]',anchor);if(errorNode)errorNode.textContent=error.message||'未能保存，请重试。';else status(error.message||'未能保存，请重试。',true)}return false}
    finally{pending=false;options.endWrite?.(token);if(alive()){periodController?.setDisabled?.(false);dayPicker?.setDisabled?.(false);syncYearNavState();}if(anchor.isConnected){anchor.removeAttribute('aria-busy');if(fieldset)fieldset.disabled=previousDisabled}if(modal?.isConnected&&anchor.isConnected&&modal.contains(anchor)){if(previousPersistent===undefined)delete modal.dataset.persistent;else modal.dataset.persistent=previousPersistent}}
  }

  function mountQuickEntry(host){
    const prefix=`finance-lines-${++formSequence}`;
    render(host,`<form data-finance-create class="finance-quick-form" data-finance-dropzone><fieldset><div class="finance-quick-split"><div class="finance-quick-input-pane"><div class="finance-quick-label-row"><label class="finance-quick-label" for="${prefix}">每行一笔，先写金额，再写用途</label><div class="finance-quick-hints" aria-hidden="true"><span>60 打车</span><span>8+8-1 早餐</span></div></div><textarea id="${prefix}" name="text" rows="5" maxlength="6000" placeholder="60 打车&#10;50 吃饭" aria-describedby="${prefix}-help ${prefix}-total">${esc(draft.text)}</textarea><p class="help" id="${prefix}-help">支持加减算式与多行连续记账，也可直接拖拽或粘贴消费截图。</p></div><div class="finance-quick-desk"><div class="finance-desk-head"><span class="finance-desk-title"><i aria-hidden="true"></i>待入账清单</span><span class="finance-desk-tag" data-finance-desk-badge>支持拖拽 / 粘贴截图</span></div><div class="finance-desk-body"><div class="finance-desk-empty" data-finance-desk-empty><span class="finance-desk-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="10" r="1.5"/><path d="m21 15-4.5-4.5a1.5 1.5 0 0 0-2.1 0L7 18"/></svg></span><strong>拖入、粘贴消费截图，或点此选择</strong><span>左侧写下金额与用途后，此处会实时拆分并自动归类</span></div><div class="finance-line-preview" data-finance-line-preview></div><p class="finance-line-errors" data-finance-line-errors role="status" aria-live="polite"></p><p class="finance-legacy-note" data-finance-legacy-note></p></div><div class="finance-quick-footer"><output id="${prefix}-total" data-finance-calculation aria-live="polite"></output><div class="finance-quick-actions"><button class="btn btn-ghost" type="button" data-clear-entry>清空</button><button class="btn btn-primary" type="submit" data-upload-expenses>上传截图</button></div></div><p class="error-text" data-form-error role="status" aria-live="polite"></p></div></div></fieldset></form>`);
    const form=$('[data-finance-create]',host),textarea=form.elements.text;
    let composing=false;
    const reconcile=parsed=>{
      const available=[...quickRows],lines=textarea.value.split(/\r\n?|\n/);
      quickRows=parsed.rows.map(row=>{const raw=lines[row.line-1].trim(),index=available.findIndex(item=>item.raw===raw),previous=index<0?null:available.splice(index,1)[0];return {...previous,...row,raw,id:previous?.id||id(),chosen:previous?.chosen||false,attempted:previous?.attempted||false,categoryId:previous&&(previous.chosen||previous.attempted)?previous.categoryId:automaticCategory(row.purpose,categories)}});
      if(!available.length&&quickRows.length===1&&draft.categoryId&&!quickRows[0].chosen)quickRows[0].categoryId=draft.categoryId;
    };
    refreshQuick=()=>{
      const parsed=parseFinanceLines(textarea.value,{categories,kind:'expense'});reconcile(parsed);textarea.readOnly=quickRows.some(row=>row.attemptedBody);$('[data-clear-entry]',form).disabled=textarea.readOnly;
      render($('[data-finance-line-preview]',form),quickRows.map(row=>`<div class="finance-line-row"><span class="finance-line-number">${row.line}</span><span class="finance-line-purpose">${esc(row.purpose)}</span><strong>¥${money(row.amountCents)}</strong><select data-finance-compact data-line-category="${esc(row.id)}" ${row.attemptedBody?'disabled':''} aria-label="第 ${row.line} 行分类">${categoryOptions(categories,row.categoryId,row.purpose)}</select></div>`).join(''));
      $('[data-finance-line-errors]',form).textContent=parsed.errors.map(error=>`第 ${error.line} 行：${error.message}`).join('\n');
      const output=$('[data-finance-calculation]',form);output.textContent=`${quickRows.length} 笔待入账 · 合计 ¥${money(parsed.totalCents)}`;output.classList.toggle('is-error',Boolean(parsed.errors.length));
      const legacy=$('[data-finance-legacy-note]',form);legacy.textContent=[draft.note?`首笔备注：${draft.note}`:'',draft.receiptIds?.length?`首笔保留 ${draft.receiptIds.length} 张截图`:''].filter(Boolean).join(' · ');legacy.hidden=!legacy.textContent;
      const emptyDesk=$('[data-finance-desk-empty]',form);if(emptyDesk)emptyDesk.hidden=Boolean(quickRows.length||parsed.errors.length);
      const deskBadge=$('[data-finance-desk-badge]',form);if(deskBadge)deskBadge.textContent=parsed.errors.length?'请先修正左侧输入':quickRows.length?'已自动归类 · 可调分类':'支持拖拽 / 粘贴截图';
      const uncertain=quickRows.some(row=>row.attemptedBody);textarea.readOnly=uncertain;$('[data-clear-entry]',form).disabled=uncertain;
      $('[data-upload-expenses]',form).textContent=uncertain?'继续核对':'上传截图';
      return parsed;
    };
    const capture=()=>{draft={...draft,text:textarea.value,expression:'',purpose:''};changed()};
    form.addEventListener('compositionstart',event=>{if(event.target===textarea)composing=true});
    form.addEventListener('compositionend',event=>{if(event.target!==textarea||!alive()||pending||textarea.readOnly)return;composing=false;capture();refreshQuick()});
    form.addEventListener('input',event=>{if(event.target!==textarea||!alive()||pending||textarea.readOnly)return;capture();$('[data-form-error]',form).textContent='';if(!composing&&!event.isComposing)refreshQuick()});
    form.addEventListener('change',event=>{if(!alive()||pending||!event.target.matches('[data-line-category]'))return;const row=quickRows.find(item=>item.id===event.target.dataset.lineCategory);if(row&&!row.attemptedBody){const selected=event.target.value,categoryId=selected||automaticCategory(row.purpose,categories);if(categoryId!==row.categoryId)row.id=id();row.categoryId=categoryId;row.chosen=Boolean(selected);event.target.value=categoryId;event.target.dataset.lineCategory=row.id;if(quickRows.length===1)draft.categoryId=selected;changed()}});
    $('[data-clear-entry]',form).addEventListener('click',()=>{if(!alive()||pending||textarea.readOnly)return;draft=blank();quickRows=[];textarea.value='';$('[data-form-error]',form).textContent='';changed();refreshQuick();textarea.focus()});
    $('[data-finance-desk-empty]',form)?.addEventListener('click',()=>{if(!alive()||pending||textarea.readOnly)return;const parsed=refreshQuick();if(parsed.errors.length){$('[data-form-error]',form).textContent='请先修正上方标出的行，再上传截图。';textarea.focus();return}$('[data-finance-files]',container).click()});
    form.addEventListener('submit',event=>{
      event.preventDefault();if(pending||!alive()||composing||event.isComposing)return;
      const parsed=refreshQuick(),error=$('[data-form-error]',form);
      if(parsed.errors.length){error.textContent='请先修正上方标出的行，再上传截图。';textarea.focus();return}
      error.textContent='';
      if(quickRows.some(row=>row.attemptedBody)&&lastMatchResult){openMatchedExpenses(quickRows,lastMatchResult);return}
      $('[data-finance-files]',container).click();
    });
    refreshQuick();
  }

  function openDetailed(){
    const seed={...blank(),kind:'income'};
    options.openModal?.(`<div class="modal-head"><div><h2>收入记账</h2><p>核对收入日期、金额和来源，明细入账后锁定。</p></div></div><form id="finance-detail-form" class="finance-entry-form finance-income-form">${entryForm(seed,{modal:true,incomeOnly:true})}</form>`,'workspace-dialog finance-dialog finance-detail-dialog');
    const form=container.ownerDocument.querySelector('#finance-detail-form');if(form)bindForm(form,seed,{modal:true,incomeOnly:true,automaticCategory:true});
  }

  function entryForm(entry={},extra={}){
    const prefix=`finance-form-${++formSequence}`,kind=entry.kind||'expense',refunds=entries.filter(row=>row.kind==='expense'&&!row.deletedAt);
    if(extra.original&&!refunds.some(row=>row.id===extra.original.id))refunds.unshift(extra.original);
    return `<fieldset><div class="finance-form-top"><div class="field"><label for="${prefix}-date">日期</label><input id="${prefix}-date" name="date" type="date" required value="${esc(entry.date||day)}"></div>${extra.incomeOnly?'<input type="hidden" name="kind" value="income">':extra.refundOnly?'<input type="hidden" name="kind" value="refund">':`<div class="field"><label for="${prefix}-kind">收支类型</label><select data-finance-compact id="${prefix}-kind" name="kind">${Object.entries(FINANCE_KINDS).map(([key,label])=>`<option value="${key}" ${kind===key?'selected':''}>${esc(label)}</option>`).join('')}</select></div>`}</div><div class="finance-money-row"><div class="field"><label for="${prefix}-amount">金额 / 算式</label><input id="${prefix}-amount" name="expression" inputmode="decimal" autocomplete="off" maxlength="240" required value="${esc(entry.expression||'')}" placeholder="例如 8+8+8-1" aria-describedby="${prefix}-calculation"><output id="${prefix}-calculation" data-finance-calculation>输入金额，自动计算合计</output></div><div class="field"><label for="${prefix}-purpose">${extra.incomeOnly?'收入来源':'用途'}</label><input id="${prefix}-purpose" name="purpose" maxlength="160" value="${esc(entry.purpose||'')}" placeholder="${extra.incomeOnly?'例如 工资、奖金':'例如 早餐、打车'}"></div></div><div class="finance-form-bottom">${extra.incomeOnly?'<input type="hidden" name="categoryId" value="">':`<div class="field"><label for="${prefix}-category">分类</label><div data-category-host><select data-finance-compact id="${prefix}-category" name="categoryId">${categoryOptions(categories,entry.categoryId==='uncategorized'&&!extra.original?'':entry.categoryId,'',kind)}</select></div><span class="help" data-category-hint>${esc(entry.purpose?`自动分类：${financeCategoryLabel(entry.purpose,categories,kind)}`:'常见用途归入对应类别，其他用途直接作为分类。')}</span></div>`}<div class="field"><label for="${prefix}-note">备注（选填）</label><input id="${prefix}-note" name="note" maxlength="500" value="${esc(entry.note||'')}" placeholder="补充说明（可不填）"></div></div>${extra.incomeOnly?'':`<div class="finance-refund-source" data-refund-source ${kind==='refund'?'':'hidden'}><label for="${prefix}-refund">对应的原支出</label><select data-finance-compact id="${prefix}-refund" name="refundOf"><option value="">选择原支出</option>${refunds.map(row=>`<option value="${esc(row.id)}" ${row.id===entry.refundOf?'selected':''}>${esc(row.date)} · ${esc(row.purpose||categoryName(row.categoryId))} · ¥${money(row.amountCents)}</option>`).join('')}</select><span class="help">到账后确认金额和对应支出，明细入账后锁定。</span></div>`}<p class="error-text" data-form-error role="status" aria-live="polite"></p><div class="finance-form-actions"><button class="btn btn-ghost" type="button" data-clear-entry>取消</button><button class="btn btn-primary" type="submit">确认入账</button></div></fieldset>`;
  }

  function bindForm(form,entry={},extra={}){
    let categoryChosen=Boolean(entry.categoryId);const entryId=id();
    const refreshCalculation=()=>{
      const output=$('[data-finance-calculation]',form),text=form.elements.expression.value.trim();
      try{const amount=parseMoneyExpression(text);output.textContent=amount>0?`合计 ¥${money(amount)}`:'入账金额需要大于 0';output.classList.toggle('is-error',amount<=0)}catch{output.textContent=text?'请检查算式，只支持数字、小数、加减。':'输入金额，自动计算合计';output.classList.toggle('is-error',Boolean(text))}
    };
    let suggesting=false;
    const refreshSuggestion=()=>{
      const kind=form.elements.kind?.value||'expense',purpose=form.elements.purpose.value;
      const hint=$('[data-category-hint]',form);
      if(hint)hint.textContent=purpose.trim()?`自动分类：${financeCategoryLabel(purpose,categories,kind)}`:'常见用途归入对应类别，其他用途直接作为分类。';
      if(categoryChosen)return;
      suggesting=true;
      form.elements.categoryId.value=automaticCategory(purpose,categories,kind);
      form.elements.categoryId.dispatchEvent(new Event('change',{bubbles:true}));
      suggesting=false;
    };
    form.addEventListener('input',event=>{if(!alive()||pending)return;if(event.target.name==='purpose')refreshSuggestion();refreshCalculation()});
    form.addEventListener('change',event=>{
      if(!alive()||pending||suggesting)return;
      if(event.target.name==='categoryId'){
        categoryChosen=Boolean(event.target.value);
        if(!categoryChosen)refreshSuggestion();
      }
      if(event.target.name==='kind'){
        const source=$('[data-refund-source]',form);if(source)source.hidden=event.target.value!=='refund';
        refreshSuggestion();
      }
    });
    $('[data-clear-entry]',form).addEventListener('click',()=>{if(!pending)options.closeModal?.()});
    form.addEventListener('submit',event=>{
      event.preventDefault();if(pending||!alive())return;
      const values=new FormData(form),expression=String(values.get('expression')||'');
      try{if(parseMoneyExpression(expression)<=0)throw new Error('入账金额需要大于 0。')}catch(error){$('[data-form-error]',form).textContent=error.message||'请检查金额算式。';form.elements.expression.focus();return}
      const kind=extra.incomeOnly?'income':extra.refundOnly?'refund':String(values.get('kind')||'expense'),body={id:entryId,date:String(values.get('date')||day),kind,expression,purpose:String(values.get('purpose')||''),categoryId:String(values.get('categoryId')||''),note:String(values.get('note')||''),refundOf:kind==='refund'?String(values.get('refundOf')||''):null,receiptIds:[],source:daily?'daily':'finance'};
      write(form,async current=>{
        await request('/api/finance/entries',{method:'POST',body},current);if(!current())return;
        if(!daily)expandedLedgerDay=body.date;
        options.closeModal?.(true);
        notify('已入账。','success');await load();
      });
    });
    refreshCalculation();return form;
  }

  function entryHtml(entry){
    const deleted=Boolean(entry.deletedAt),title=entry.purpose||categoryName(entry.categoryId),receiptIds=entry.receiptIds||[],amount=money(entry.amountCents),accent=categoryAccent(entry.categoryId);
    const actions=!deleted&&entry.kind==='expense'?`<button type="button" class="link-button finance-entry-refund-btn" data-entry-action="refund" data-id="${esc(entry.id)}">登记退款</button>`:'';
    return `<article class="finance-entry kind-${esc(entry.kind)} ${amount.length>10?'has-long-amount':''} ${deleted?'is-deleted':''}" style="--entry-accent:${esc(accent)}" data-entry-id="${esc(entry.id)}"><span class="finance-entry-dot" aria-hidden="true"></span><div class="finance-entry-copy"><div class="finance-entry-heading"><h3>${esc(title)}</h3><div class="finance-entry-tags"><span class="finance-entry-tag kind-${esc(entry.kind)}">${esc(FINANCE_KINDS[entry.kind]||'账目')}</span><span class="finance-entry-tag finance-entry-tag-category">${esc(categoryName(entry.categoryId))}</span>${deleted?'<span class="finance-entry-tag">已删除</span>':''}</div></div>${entry.note?`<p>${esc(entry.note)}</p>`:''}${entry.refundOf?'<small>已关联原支出</small>':''}</div><div class="finance-entry-end"><strong class="finance-entry-amount kind-${esc(entry.kind)}">${entryMoney(entry)}</strong></div><div class="finance-entry-footer">${receiptIds.length?`<button type="button" class="link-button finance-receipt-link" data-receipt-open="${esc(receiptIds[0])}">查看截图 · ${receiptIds.length} 张</button>`:'<span class="finance-entry-no-receipt">未附截图</span>'}<div class="finance-entry-actions">${actions}</div></div></article>`;
  }
  function renderEntries(){
    const list=$('[data-finance-entries]',container),groups=new Map();for(const entry of entries){if(!groups.has(entry.date))groups.set(entry.date,[]);groups.get(entry.date).push(entry)}
    const meta=$('[data-finance-ledger-meta]',container);
    if(meta)meta.textContent=entries.length?`共 ${groups.size} 天 · ${entries.length} 笔`:'';
    if(daily){
      render(list,entries.length?[...groups].map(([date,rows])=>`<section class="finance-day-group"><div class="finance-section-title"><h2>${esc(date)}</h2><span>${rows.length} 笔</span></div>${rows.map(entryHtml).join('')}</section>`).join(''):`<div class="finance-empty"><span aria-hidden="true">¥</span><h3>这一天还没有入账</h3><p>可以记下真实花销，或明确标记今天零支出。</p></div>`);
      const more=$('[data-finance-more]',container);if(more)more.hidden=!cursor;
      return;
    }
    if(!entries.length){
      expandedLedgerDay=null;
      render(list,`<div class="finance-empty"><span aria-hidden="true">¥</span><h3>这一页还没有账目</h3><p>从一笔真实的收支开始，也可以调整筛选条件。</p></div>`);
      const more=$('[data-finance-more]',container);if(more)more.hidden=!cursor;
      return;
    }
    const daySummaries=[...groups].map(([date,rows])=>({date,rows,parts:dayCardParts(date),info:summarizeDayRows(rows,categoryName)}));
    const activeDate=expandedLedgerDay&&groups.has(expandedLedgerDay)?expandedLedgerDay:null;
    expandedLedgerDay=activeDate;
    const selected=activeDate?daySummaries.find(item=>item.date===activeDate):null;
    const visibleTotals={netExpenseCents:0,positiveNetExpenseCents:0,expenseCents:0,incomeCents:0,refundCents:0};
    for(const item of daySummaries){
      visibleTotals.netExpenseCents+=item.info.netExpenseCents;
      if(item.info.netExpenseCents>0)visibleTotals.positiveNetExpenseCents+=item.info.netExpenseCents;
      visibleTotals.expenseCents+=item.info.expenseCents;visibleTotals.incomeCents+=item.info.incomeCents;visibleTotals.refundCents+=item.info.refundCents;
    }
    const summaryTotals=data?.summary||{};
    const periodNetExpense=summaryTotals.netExpenseCents!=null?Number(summaryTotals.netExpenseCents)||0:visibleTotals.netExpenseCents;
    const periodGrossExpense=summaryTotals.expenseCents!=null?Math.max(0,Number(summaryTotals.expenseCents)||0):visibleTotals.expenseCents;
    const periodIncome=summaryTotals.incomeCents!=null?Math.max(0,Number(summaryTotals.incomeCents)||0):visibleTotals.incomeCents;
    const periodRefund=summaryTotals.refundCents!=null?Math.max(0,Number(summaryTotals.refundCents)||0):visibleTotals.refundCents;
    const periodPrefix=annual?'全年':'本月';
    const cardsHtml=daySummaries.map(item=>{
      let rawPct=0,shareLabel=`占${periodPrefix}支出`;
      if(item.info.tone==='is-expense'&&item.info.netExpenseCents>0){
        const denom=periodNetExpense>0&&periodNetExpense>=item.info.netExpenseCents?periodNetExpense:Math.max(periodGrossExpense,visibleTotals.positiveNetExpenseCents,item.info.netExpenseCents);
        rawPct=denom>0?Math.min(100,item.info.netExpenseCents/denom*100):0;
      }else if(item.info.tone==='is-income'&&item.info.incomeCents>0){
        const denom=periodIncome>0?periodIncome:visibleTotals.incomeCents;
        rawPct=denom>0?Math.min(100,item.info.incomeCents/denom*100):0;
        shareLabel=`占${periodPrefix}收入`;
      }else if(item.info.tone==='is-refund'&&item.info.netExpenseCents<0){
        const netRefund=Math.abs(item.info.netExpenseCents);
        const denom=periodRefund>0&&periodRefund>=netRefund?periodRefund:Math.max(visibleTotals.refundCents,netRefund);
        rawPct=denom>0?Math.min(100,netRefund/denom*100):0;
        shareLabel=`占${periodPrefix}退款`;
      }
      const barWidth=rawPct>0?Math.max(2,Number(rawPct.toFixed(1))):0;
      const pctText=formatSharePct(rawPct);
      const isSelected=item.date===activeDate;
      const catsHtml=item.info.topCategories.length?`<span class="finance-day-card-cats">${item.info.topCategories.map(cat=>`<span><i style="background:${esc(cat.color)}" aria-hidden="true"></i>${esc(cat.name)}</span>`).join('<em class="finance-day-cat-sep" aria-hidden="true">·</em>')}</span>`:'<span class="finance-day-card-cats is-empty" aria-hidden="true"></span>';
      return `<button type="button" class="finance-day-card ${item.info.tone}${isSelected?' is-selected':''}" data-finance-day-card="${esc(item.date)}" aria-expanded="${isSelected?'true':'false'}"><span class="finance-day-card-head"><span class="finance-day-card-stamp"><strong>${esc(item.parts.dayNum)}</strong><span class="finance-day-card-meta"><span>${esc(item.parts.shortMonthDay)} · ${esc(item.parts.weekdayShort)}</span>${item.date===options.today()?'<em class="finance-day-today">今天</em>':''}</span></span><span class="finance-day-card-count">${item.info.totalCount} 笔</span></span>${catsHtml}<span class="finance-day-card-foot"><span class="finance-day-card-amount"><small>${esc(item.info.label)}</small><strong>${esc(item.info.amountText)}</strong>${item.info.subline?`<span class="finance-day-card-sub">${esc(item.info.subline)}</span>`:''}</span><span class="finance-day-card-meter"><span class="finance-day-card-bar" aria-hidden="true"><i style="width:${barWidth}%"></i></span><span class="finance-day-card-share"><span>${esc(shareLabel)}</span><em>${esc(pctText)}</em></span></span></span></button>`;
    }).join('');
    let detailHtml='';
    if(selected){
      const stripParts=[];
      if(selected.info.expenseCents>0||selected.info.refundCents>0)stripParts.push(`<div class="finance-detail-metric is-expense"><span>当日净支出</span><strong>${selected.info.netExpenseCents<0?'−':''}¥${money(Math.abs(selected.info.netExpenseCents))}</strong></div>`);
      if(selected.info.incomeCents>0)stripParts.push(`<div class="finance-detail-metric is-income"><span>当日收入</span><strong>+¥${money(selected.info.incomeCents)}</strong></div>`);
      if(selected.info.refundCents>0)stripParts.push(`<div class="finance-detail-metric is-refund"><span>含退款</span><strong>¥${money(selected.info.refundCents)}</strong></div>`);
      detailHtml=`<aside class="finance-day-detail" data-finance-day-detail="${esc(selected.date)}" aria-label="${esc(selected.date)} 收支明细"><header class="finance-day-detail-head"><div class="finance-day-detail-title"><span class="finance-detail-date-badge" aria-hidden="true"><small>${esc(selected.parts.month)}月</small><strong>${esc(selected.parts.dayNum)}</strong></span><div><h3>${esc(selected.parts.month)}月${esc(selected.parts.dayNum)}日</h3><p>${esc(selected.parts.fullTitle)} · ${selected.rows.length} 笔流水</p></div></div><button type="button" class="finance-day-close" data-finance-day-close aria-label="收起当日明细">收起</button></header>${stripParts.length?`<div class="finance-day-detail-strip">${stripParts.join('')}</div>`:''}<div class="finance-day-detail-list">${selected.rows.map(entryHtml).join('')}</div></aside>`;
    }
    render(list,`<div class="finance-ledger-board${activeDate?' has-selection':''}"><div class="finance-day-cards" data-ui-native>${cardsHtml}</div>${detailHtml}</div>`);
    const more=$('[data-finance-more]',container);if(more)more.hidden=!cursor;
  }
  function syncYearNavState(){
    if(!annual)return;
    const num=Number(filters.year)||Number(day.slice(0,4)),todayYear=options.today().slice(0,4);
    const label=$('[data-finance-year-label]',container);if(label)label.textContent=`${num}年`;
    const prev=$('[data-finance-year-prev]',container);if(prev)prev.disabled=pending||num<=1;
    const next=$('[data-finance-year-next]',container);if(next)next.disabled=pending||num>=9999;
    const currentBtn=$('[data-finance-year-current]',container);if(currentBtn){currentBtn.hidden=filters.year===todayYear;currentBtn.disabled=pending}
    for(const btn of $$('[data-finance-year-month]',container))btn.disabled=pending;
  }
  function renderSummary(){
    const summary=data?.summary||{},summaries=$('[data-finance-summary]',container);
    if(daily){
      render(summaries,`<span>今日净支出</span><strong>¥${money(summary.netExpenseCents)}</strong><small>${data?.day?.state==='zero'?'已确认今日零支出':data?.day?.state==='recorded'||summary.count?'账目已单独保存':'尚未记录，和零支出不同'}</small>`);
      return;
    }
    const count=Number(summary.count)||0,expenseCents=Math.max(0,Number(summary.expenseCents)||0),refundCents=Math.max(0,Number(summary.refundCents)||0);
    const incomeCents=Math.max(0,Number(summary.incomeCents)||0),netExpenseCents=Number(summary.netExpenseCents)||0,balanceCents=Number(summary.balanceCents)||0;
    const positiveSpend=Math.max(0,netExpenseCents),flowTotal=incomeCents+positiveSpend;
    const spendShare=flowTotal>0?Math.round(positiveSpend/flowTotal*100):0;
    const incomeShare=flowTotal>0?100-spendShare:0;
    const balanceState=balanceCents>0?'positive':balanceCents<0?'negative':'neutral';
    const balanceBarPct=balanceCents>0?(incomeCents>0?Math.min(100,Math.round(balanceCents/incomeCents*100)):100):balanceCents<0?(flowTotal>0?Math.min(100,Math.round(Math.abs(balanceCents)/flowTotal*100)):0):0;
    const balanceLeft=balanceCents>0?`结余率 ${balanceBarPct}%`:balanceCents<0?`缺口占 ${balanceBarPct}%`:'收支持平';
    const balanceRight=balanceCents>0?`净结余 ¥${money(balanceCents)}`:balanceCents<0?`净流出 ¥${money(Math.abs(balanceCents))}`:'差额归零';
    const incomeRight=incomeCents>0?(positiveSpend>0?`覆盖支出 ${Math.min(999,Math.round(incomeCents/positiveSpend*100))}%`:'纯收入入账'):'等待收入入账';
    if(annual){
      const year=filters.year,todayMonth=options.today().slice(0,7);
      const months=Array.from({length:12},(_,index)=>({month:index+1,key:`${year}-${String(index+1).padStart(2,'0')}`,netExpenseCents:0,expenseCents:0,incomeCents:0}));
      for(const point of data?.trend||[]){
        const match=/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.exec(String(point?.date||''));
        if(!match||!String(point.date).startsWith(`${year}-`))continue;
        const slot=months[Number(match[1])-1];
        slot.netExpenseCents+=Number(point.expenseCents)||0;
        slot.expenseCents+=Math.max(0,Number(point.spendingCents)||0);
        slot.incomeCents+=Math.max(0,Number(point.incomeCents)||0);
      }
      const activeSpendMonths=months.filter(slot=>slot.netExpenseCents>0);
      const peakMonth=activeSpendMonths.reduce((best,slot)=>!best||slot.netExpenseCents>best.netExpenseCents?slot:best,null);
      const maxMonthlySpend=peakMonth?peakMonth.netExpenseCents:0;
      const avgMonthlyCents=activeSpendMonths.length?Math.round(positiveSpend/activeSpendMonths.length):0;
      const activeMonthPct=Math.round(activeSpendMonths.length/12*100);
      const balanceBadge=balanceCents>0?'年度结余':balanceCents<0?'支大于收':'收支平衡';
      render(summaries,`<div class="finance-stat finance-stat-expense"><div class="finance-stat-top"><span class="finance-stat-kicker"><i aria-hidden="true"></i>年度净支出</span><span class="finance-stat-badge">${refundCents>0?`含退款 ¥${money(refundCents)}`:`${count} 笔流水`}</span></div><strong><small>¥</small>${money(summary.netExpenseCents)}</strong><p>${esc(year)} 年支出减去已登记退款</p><div class="finance-flow-meter" aria-hidden="true"><span class="finance-flow-track"><i class="is-expense" style="width:${spendShare}%"></i></span><span class="finance-flow-legend"><small>支出占 ${spendShare}%</small><small>总支出 ¥${money(expenseCents)}</small></span></div></div><div class="finance-stat finance-stat-income"><div class="finance-stat-top"><span class="finance-stat-kicker"><i aria-hidden="true"></i>年度收入</span><span class="finance-stat-badge">${incomeCents>0?'全年已入账':'暂无入账'}</span></div><strong><small>¥</small>${money(summary.incomeCents)}</strong><p>${count} 笔有效流水</p><div class="finance-flow-meter" aria-hidden="true"><span class="finance-flow-track"><i class="is-income" style="width:${incomeShare}%"></i></span><span class="finance-flow-legend"><small>收入占 ${incomeShare}%</small><small>${incomeRight}</small></span></div></div><div class="finance-stat finance-stat-balance is-${balanceState}"><div class="finance-stat-top"><span class="finance-stat-kicker"><i aria-hidden="true"></i>年度收支差额</span><span class="finance-stat-badge">${balanceBadge}</span></div><strong><small>¥</small>${money(summary.balanceCents)}</strong><p>全年收入减去净支出，不代表账户余额</p><div class="finance-flow-meter" aria-hidden="true"><span class="finance-flow-track"><i class="is-balance is-${balanceState}" style="width:${balanceBarPct}%"></i></span><span class="finance-flow-legend"><small>${balanceLeft}</small><small>${balanceRight}</small></span></div></div><div class="finance-stat finance-stat-average"><div class="finance-stat-top"><span class="finance-stat-kicker"><i aria-hidden="true"></i>月均净支出</span><span class="finance-stat-badge">${activeSpendMonths.length?`${activeSpendMonths.length} 个活跃月`:'暂无花销'}</span></div><strong>${activeSpendMonths.length?`<small>¥</small>${money(avgMonthlyCents)}`:'—'}</strong><p>${activeSpendMonths.length?'按全年有花销月份平均计算':'记下花销后自动统计月均花销'}</p><div class="finance-flow-meter" aria-hidden="true"><span class="finance-flow-track"><i class="is-average" style="width:${activeMonthPct}%"></i></span><span class="finance-flow-legend"><small>有花销月 ${activeSpendMonths.length}/12</small><small>${peakMonth?`峰值 ${peakMonth.month}月 ¥${money(peakMonth.netExpenseCents)}`:'暂无峰值'}</small></span></div></div>`);
      const rhythmHost=$('[data-finance-year-rhythm]',container);
      if(rhythmHost){
        const colsHtml=months.map(slot=>{
          const positive=Math.max(0,slot.netExpenseCents);
          const barPct=maxMonthlySpend>0&&positive>0?Math.max(8,Math.round(positive/maxMonthlySpend*100)):0;
          const isCurrentMonth=slot.key===todayMonth;
          const isPeak=Boolean(peakMonth&&peakMonth.key===slot.key&&positive>0);
          const tip=`${year}年${slot.month}月 · 净支出 ${slot.netExpenseCents<0?'−':''}¥${money(Math.abs(slot.netExpenseCents))}${slot.incomeCents>0?` · 收入 ¥${money(slot.incomeCents)}`:''}`;
          return `<button type="button" class="finance-year-col${isCurrentMonth?' is-active':''}${isPeak?' is-peak':''}${positive>0?' has-value':''}" data-finance-year-month="${esc(slot.key)}" title="${esc(tip)}" aria-label="进入 ${esc(tip)}"><span class="finance-year-col-val" aria-hidden="true">${esc(compactMoney(positive))}</span><span class="finance-year-col-track" aria-hidden="true"><i style="height:${barPct}%"></i></span><span class="finance-year-col-month">${slot.month}月</span></button>`;
        }).join('');
        render(rhythmHost,`<div class="finance-year-bars" data-ui-native>${colsHtml}</div><p class="finance-pie-note finance-year-rhythm-foot"><span class="finance-pie-note-pills"><span class="finance-pie-note-pill">有花销月份 <strong>${activeSpendMonths.length} 个</strong></span><span class="finance-pie-note-pill is-net">${peakMonth?`峰值 ${peakMonth.month}月 <strong>¥${money(peakMonth.netExpenseCents)}</strong>`:'全年暂无支出'}</span></span><small>点击任意月份可进入对应月份账本。</small></p>`);
      }
      yearPie?.setData({totals:data?.expenseCategoryTotals||[],refundCents,netExpenseCents,title:`${year} 年度花销`,loading:false,error:''});
      syncYearNavState();
      return;
    }
    const balanceBadge=balanceCents>0?'当月结余':balanceCents<0?'支大于收':'收支平衡';
    render(summaries,`<div class="finance-stat finance-stat-expense"><div class="finance-stat-top"><span class="finance-stat-kicker"><i aria-hidden="true"></i>本月净支出</span><span class="finance-stat-badge">${refundCents>0?`含退款 ¥${money(refundCents)}`:`${count} 笔流水`}</span></div><strong><small>¥</small>${money(summary.netExpenseCents)}</strong><p>支出减去已登记退款</p><div class="finance-flow-meter" aria-hidden="true"><span class="finance-flow-track"><i class="is-expense" style="width:${spendShare}%"></i></span><span class="finance-flow-legend"><small>支出占 ${spendShare}%</small><small>总支出 ¥${money(expenseCents)}</small></span></div></div><div class="finance-stat finance-stat-income"><div class="finance-stat-top"><span class="finance-stat-kicker"><i aria-hidden="true"></i>本月收入</span><span class="finance-stat-badge">${incomeCents>0?'当月已入账':'暂无入账'}</span></div><strong><small>¥</small>${money(summary.incomeCents)}</strong><p>${count} 笔有效流水</p><div class="finance-flow-meter" aria-hidden="true"><span class="finance-flow-track"><i class="is-income" style="width:${incomeShare}%"></i></span><span class="finance-flow-legend"><small>收入占 ${incomeShare}%</small><small>${incomeRight}</small></span></div></div><div class="finance-stat finance-stat-balance is-${balanceState}"><div class="finance-stat-top"><span class="finance-stat-kicker"><i aria-hidden="true"></i>收支差额</span><span class="finance-stat-badge">${balanceBadge}</span></div><strong><small>¥</small>${money(summary.balanceCents)}</strong><p>收入减去净支出，不代表账户余额</p><div class="finance-flow-meter" aria-hidden="true"><span class="finance-flow-track"><i class="is-balance is-${balanceState}" style="width:${balanceBarPct}%"></i></span><span class="finance-flow-legend"><small>${balanceLeft}</small><small>${balanceRight}</small></span></div></div>`);
    monthPie?.setData({totals:data?.expenseCategoryTotals||[],refundCents:summary.refundCents||0,netExpenseCents:summary.netExpenseCents||0,title:`${filters.month} 月度花销`,loading:false,error:''});
  }
  function defaultChartDay(){
    if(filters.month===options.today().slice(0,7))return options.today();
    const dates=(data?.trend||[]).filter(row=>row.spendingCents>0).map(row=>row.date).filter(value=>value.startsWith(filters.month)).sort();
    if(dates.length)return dates.at(-1);
    const [year,month]=filters.month.split('-').map(Number),last=new Date(0);last.setUTCFullYear(year,month,0);
    return `${filters.month}-${String(last.getUTCDate()).padStart(2,'0')}`;
  }
  async function loadDailyChart(){
    if(daily||annual||!alive()||!selectedDay)return;
    const date=selectedDay,month=filters.month,owner={};dayOwner=owner;
    const current=()=>alive()&&dayOwner===owner&&selectedDay===date&&filters.month===month;
    dayPie?.setData({loading:true,error:'',totals:[]});
    const retry=$('[data-finance-day-retry]',container);if(retry)retry.hidden=true;
    try{
      const result=await request(`/api/finance?date=${encodeURIComponent(date)}`,{},current);if(!current())return;
      dayPie?.setData({totals:result.expenseCategoryTotals||[],refundCents:result.summary?.refundCents||0,netExpenseCents:result.summary?.netExpenseCents||0,title:`${date} 每日花销`,loading:false,error:''});
    }catch(error){if(current()){dayPie?.setData({loading:false,error:error.message||'当天花销暂时未能读取。'});if(retry)retry.hidden=false}}
  }
  function switchMonth(nextMonth){
    if(!alive()||pending||!nextMonth||nextMonth===filters.month)return;
    filters.month=nextMonth;expandedLedgerDay=null;dayOwner=null;
    periodController?.setValue?.(nextMonth);
    dayPicker?.setMonth?.(nextMonth);dayPicker?.setDisabled?.(true);
    dayPie?.setData({loading:true,error:'',totals:[]});
    monthPie?.setData({loading:true,error:'',totals:[]});
    load();
  }
  function switchYear(nextYear){
    if(!annual||!alive()||pending||!nextYear||nextYear===filters.year)return;
    filters.year=nextYear;expandedLedgerDay=null;
    yearPie?.setData({loading:true,error:'',totals:[]});
    syncYearNavState();
    load();
  }
  function syncDailyChart(){
    if(daily||annual)return;
    if(chartMonth!==filters.month||!selectedDay.startsWith(filters.month)){
      chartMonth=filters.month;selectedDay=defaultChartDay();
      dayPicker?.setMonth?.(filters.month);dayPicker?.setValue?.(selectedDay);
    }
    dayPicker?.setDisabled?.(pending);return loadDailyChart();
  }
  function resetPagination(){
    cursor=null;
    const more=$('[data-finance-more]',container);if(more)more.hidden=true;
  }
  async function load(append=false){
    if(!alive()||(append&&!cursor))return;const owner={};loadOwner=owner;const current=()=>alive()&&loadOwner===owner;
    if(!append){clearTimeout(searchTimer);resetPagination()}
    const params=query();if(append)params.set('cursor',cursor);status(append?'正在读取更早的账目…':'正在整理账目…');
    try{
      const result=await request(`/api/finance?${params}`,{},current);if(!current())return;
      data=result;categories=result.categories||categories;entries=append?[...entries,...(result.entries||[])]:result.entries||[];cursor=result.nextCursor||null;
      renderSummary();renderEntries();syncDailyChart();
      if(!annual){if(!noFormLoss()){const host=$('[data-finance-form]',container);if(host)mountQuickEntry(host)}refreshQuick?.()}
      const dayCount=new Set(entries.map(item=>item.date)).size;
      status(daily?'确认入账后，账目已保存；复盘仍可保留为草稿。':annual?(entries.length?`${filters.year} 年全年共 ${dayCount} 天有记录 · 点击日期卡牌展开当日明细；进度条显示当日占全年总额比例。`:`${filters.year} 年暂无符合条件的收支记录。`):entries.length?`共 ${dayCount} 天有记录 · 点击日期卡牌展开当日明细；上方总计与月度图表按整月计算。`:`明细显示 ${filters.month} 整月；上方总计与月度图表按整月计算。`);
    }catch(error){if(current()){status(error.message||'账目暂时未能读取。',true);if(annual){yearPie?.setData({loading:false,error:'年度花销暂时未能读取，请刷新年度账本重试。'});syncYearNavState()}else if(!daily){dayPicker?.setDisabled?.(pending);monthPie?.setData({loading:false,error:'当月花销暂时未能读取，请刷新账本重试。'});dayPie?.setData({loading:false,error:'请先重新读取当月账本。'});dayOwner=null}const list=$('[data-finance-entries]',container);if(!data)render(list,'<div class="finance-empty"><h3>暂时没有翻开账本</h3><button class="btn" type="button" data-finance-retry>重新读取</button></div>')}}
  }

  async function viewReceipt(entry){
    const receiptIds=[...(entry?.receiptIds||[])];
    if(!alive()||!receiptIds.length)return;
    const title=entry.purpose||categoryName(entry.categoryId),kind=FINANCE_KINDS[entry.kind]||'账目';
    options.openModal?.(`<div class="modal-head finance-receipt-head"><div><h2>${esc(title)}</h2><p class="finance-receipt-details"><span class="finance-entry-tag kind-${esc(entry.kind)}">${esc(kind)}</span><span class="finance-entry-tag finance-entry-tag-category">${esc(categoryName(entry.categoryId))}</span><time datetime="${esc(entry.date)}">${esc(entry.date)}</time></p></div><strong class="finance-receipt-amount kind-${esc(entry.kind)}">${entryMoney(entry)}</strong></div><div class="finance-image-navigation" ${receiptIds.length===1?'hidden':''}><button class="link-button" type="button" data-finance-image-previous aria-label="上一张截图" disabled>上一张</button><span data-finance-image-position role="status" aria-live="polite">1 / ${receiptIds.length}</span><button class="link-button" type="button" data-finance-image-next aria-label="下一张截图">下一张</button></div><div class="finance-image-view" data-finance-image-view><p class="help" data-finance-image-status role="status" aria-live="polite">正在读取截图…</p><div data-finance-image-host></div></div><div class="modal-actions"><button class="btn" type="button" data-finance-image-retry hidden>重新读取截图</button><button class="btn" type="button" data-close>关闭</button></div>`,'finance-image-dialog');
    const view=container.ownerDocument.querySelector('[data-finance-image-view]');if(!view)return;
    const modal=view.closest('.modal')||view.parentElement,host=$('[data-finance-image-host]',view),message=$('[data-finance-image-status]',view),retry=$('[data-finance-image-retry]',modal),previous=$('[data-finance-image-previous]',modal),next=$('[data-finance-image-next]',modal),position=$('[data-finance-image-position]',modal);
    const current=()=>alive()&&view.isConnected&&modal.contains(view)&&container.ownerDocument.querySelector('[data-finance-image-view]')===view;
    let index=0,loading=false,readOwner=null;
    async function loadImage(replace=false){
      if(loading&&!replace||!current())return;
      const receiptId=receiptIds[index],owner={};readOwner=owner;const accepted=()=>current()&&readOwner===owner;
      loading=true;retry.disabled=true;retry.hidden=true;message.hidden=false;message.textContent='正在读取截图…';
      render(host,`<img alt="${esc(title)}的${esc(kind)}凭证，第${index+1}张" hidden>`);const image=$('img',host);
      const failed=error=>{if(!accepted()||!image.isConnected)return;image.hidden=true;message.hidden=false;message.textContent=error?.message||'截图加载失败，可能是授权已过期或网络暂时不可用。请重新读取。';retry.hidden=false;retry.disabled=false};
      image.addEventListener('error',()=>failed(),{once:true});image.addEventListener('load',()=>{if(accepted()&&image.isConnected){message.hidden=true;image.hidden=false}},{once:true});
      try{const {loadReceiptUrls}=options.receiptClient||await import('./receipt-client.js?v=1.0.0-audit1');if(!accepted())return;const urls=await loadReceiptUrls([receiptId],'image',{request,isCurrent:accepted});if(!accepted())return;const url=safeImageUrl(urls[receiptId]);if(!url)throw new Error('这张截图暂时无法读取，请检查凭证存储后重试。');message.textContent='正在载入截图…';image.src=url;image.hidden=false}
      catch(error){failed(error)}finally{if(accepted()){loading=false;retry.disabled=false}}
    }
    function changeImage(offset){
      if(!current())return;const target=index+offset;if(target<0||target>=receiptIds.length)return;
      index=target;previous.disabled=index===0;next.disabled=index===receiptIds.length-1;position.textContent=`${index+1} / ${receiptIds.length}`;loadImage(true);
    }
    previous.addEventListener('click',()=>changeImage(-1));next.addEventListener('click',()=>changeImage(1));
    retry.addEventListener('click',()=>loadImage());await loadImage();
  }
  function openRefund(entry){
    const originalCategory=categories.find(category=>category.id===entry.categoryId);
    const activeCategoryId=originalCategory&&originalCategory.active!==false?entry.categoryId:'';
    const value={date:options.today(),kind:'refund',expression:money(entry.amountCents).replaceAll(',',''),purpose:`退回：${entry.purpose||categoryName(entry.categoryId)}`,categoryId:activeCategoryId,refundOf:entry.id,receiptIds:[]};
    options.openModal?.(`<div class="modal-head"><div><h2>登记退款</h2><p>到账后再登记，退款会从净支出中扣除。</p></div></div><form id="finance-refund-form" class="finance-entry-form">${entryForm(value,{modal:true,refundOnly:true,original:entry})}</form>`,'workspace-dialog finance-dialog finance-detail-dialog');
    const form=container.ownerDocument.querySelector('#finance-refund-form');if(form)bindForm(form,value,{modal:true,refundOnly:true,original:entry});
  }
  async function loadStorage(){const owner={};storageOwner=owner;const current=()=>alive()&&storageOwner===owner;try{const result=await request('/api/finance/storage',{},current);if(!current())return;storage=result;const node=$('[data-storage-note]',container);if(node)node.textContent=result.configured?'压缩截图保存在你配置的私有存储。':'尚未配置图片存储：收入可直接登记，支出需先配置存储并上传截图。'}catch{if(current()){const node=$('[data-storage-note]',container);if(node)node.textContent='图片存储状态暂未读取，可打开设置重试。'}}}
  async function storageDialog(){
    const visit={};storageDialogOwner=visit;const visitCurrent=()=>alive()&&storageDialogOwner===visit;
    try{const saved=await request('/api/finance/storage',{},visitCurrent);if(!visitCurrent())return;storage=saved;const config=saved.config||{};
      options.openModal?.(`<div class="modal-head"><div><h2>凭证图片存储</h2><p>图片保存在私有S3。原图不上传，只保存压缩图与缩略图。</p></div></div><form id="finance-storage-form"><fieldset><div class="field"><label for="finance-reuse-target">复用已有 S3 备份配置</label><select data-finance-compact id="finance-reuse-target" name="reuseTargetId"><option value="">单独填写图片存储</option>${(saved.targets||[]).map(target=>`<option value="${esc(target.id)}">${esc(target.name)}</option>`).join('')}</select></div><div class="finance-storage-fields">${[['endpoint','服务地址','https://…'],['region','存储地区','auto'],['bucket','存储桶',''],['directory','凭证目录','shendu-receipts'],['accessKey','访问密钥标识',''],['secretKey','访问密钥密码',saved.configured?'留空保留现有密码':'']].map(([name,label,placeholder])=>`<div class="field"><label for="finance-storage-${name}">${label}</label><input id="finance-storage-${name}" name="${name}" ${name==='secretKey'?'type="password" autocomplete="new-password"':name==='endpoint'?'type="url"':''} value="${esc(name==='secretKey'?'':config[name]||'')}" placeholder="${esc(placeholder)}" maxlength="${name==='endpoint'?1024:512}"></div>`).join('')}<label class="finance-checkbox"><input name="pathStyle" type="checkbox" ${config.pathStyle?'checked':''}>使用路径式地址</label></div><p class="help">测试当前输入的服务端读写权限，不会保存修改。网页上传还需存储桶允许当前网站的跨域访问。</p>${saved.disconnected?`<p class="finance-storage-state">配置已删除，保留 ${Number(saved.receiptCount)||0} 张凭证的关联。重新填写原存储位置和正确密钥后可恢复查看。</p>`:saved.receiptCount?`<p class="finance-storage-state">已有 ${Number(saved.receiptCount)} 张凭证。可以修改访问密钥；更换存储位置会使原图片无法读取。</p>`:''}<p data-storage-status class="finance-storage-status" role="status" aria-live="polite"></p><div data-storage-delete-confirm class="finance-storage-delete-confirm" hidden><p>删除配置会移除保存的访问密钥，不会删除账目或S3图片。已有凭证需要重新连接原存储位置后才能查看。</p><div><button class="btn btn-ghost" type="button" data-storage-delete-cancel>保留配置</button><button class="btn btn-danger" type="button" data-storage-delete-apply>确认删除配置</button></div></div><p class="error-text" data-form-error role="status"></p><div class="finance-storage-actions"><button class="link-button" type="button" data-storage-delete ${saved.configured?'':'hidden'}>删除配置</button><div><button class="btn btn-ghost" type="button" data-close>取消</button><button class="btn btn-ghost" type="button" data-storage-test>测试连接</button><button class="btn btn-primary" type="submit">${saved.configured?'保存修改':'保存存储配置'}</button></div></div></fieldset></form>`,'workspace-dialog finance-dialog finance-detail-dialog finance-storage-dialog');
      const form=container.ownerDocument.querySelector('#finance-storage-form');if(!form)return;
      const current=()=>visitCurrent()&&form.isConnected&&container.ownerDocument.querySelector('#finance-storage-form')===form;
      const message=$('[data-storage-status]',form),error=$('[data-form-error]',form),confirmation=$('[data-storage-delete-confirm]',form);
      const payload=()=>{const values=new FormData(form),reuseTargetId=String(values.get('reuseTargetId')||''),config={endpoint:String(values.get('endpoint')||'').trim(),region:String(values.get('region')||'').trim()||'auto',bucket:String(values.get('bucket')||'').trim(),directory:String(values.get('directory')||'').trim()||'shendu-receipts',accessKey:String(values.get('accessKey')||'').trim(),pathStyle:values.get('pathStyle')==='on'};if(values.get('secretKey'))config.secretKey=String(values.get('secretKey'));return {config,version:saved.version,...(reuseTargetId?{reuseTargetId}:{})}};
      const syncReuse=()=>{const reusing=Boolean(form.elements.reuseTargetId?.value);const fields=$('.finance-storage-fields',form);if(fields){fields.hidden=reusing;$$('input',fields).forEach(control=>{control.disabled=reusing})}};
      const clearTest=()=>{if(!current()||pending)return;syncReuse();message.textContent='配置已修改，请重新测试当前输入。';message.classList.remove('is-success');error.textContent='';confirmation.hidden=true};form.addEventListener('input',clearTest);form.addEventListener('change',clearTest);syncReuse();
      $('[data-storage-test]',form).addEventListener('click',()=>{if(!current()||pending)return;const body=payload();error.textContent='';message.textContent='正在测试当前输入的存储连接…';message.classList.remove('is-success');write(form,async accepted=>{try{await request('/api/finance/storage/test',{method:'POST',body},()=>current()&&accepted())}catch(error){if(current()&&accepted())message.textContent='测试未通过，当前输入和已保存的配置均保留。';throw error}if(!current()||!accepted())return;message.textContent='服务端读写测试通过，测试文件已清理。当前输入尚未保存；网页跨域和图片校验仍需实际上传验证。';message.classList.add('is-success')})});
      $('[data-storage-delete]',form).addEventListener('click',()=>{if(current()&&!pending){confirmation.hidden=false;error.textContent='';$('[data-storage-delete-cancel]',form).focus()}});
      $('[data-storage-delete-cancel]',form).addEventListener('click',()=>{if(current()&&!pending){confirmation.hidden=true;$('[data-storage-delete]',form).focus()}});
      $('[data-storage-delete-apply]',form).addEventListener('click',()=>{if(!current()||pending)return;write(form,async accepted=>{await request('/api/finance/storage',{method:'DELETE',body:{version:saved.version}},()=>current()&&accepted());if(!current()||!accepted())return;options.closeModal?.(true);await loadStorage();notify('图片存储配置已删除，账目和S3图片保留。重新连接原存储后可查看已有凭证。','success')})});
      form.addEventListener('submit',event=>{event.preventDefault();if(!current()||pending)return;const body=payload();write(form,async accepted=>{await request('/api/finance/storage',{method:'PUT',body},()=>current()&&accepted());if(!current()||!accepted())return;options.closeModal?.(true);await loadStorage();const note=$('[data-storage-note]',container);if(note)note.textContent='图片存储配置已保存。请先保存未入账内容，再刷新页面使图片访问权限生效。';notify('图片存储配置已保存，请保存未入账内容并刷新页面后上传截图。','success')})});
    }catch(error){if(visitCurrent())notify(error.message,'error')}
  }

  function openMatchedExpenses(planned,result){
    const unavailable=new Set(result.usedReceiptIds||[]),attemptedIds=new Set(planned.flatMap(row=>row.attemptedBody?.receiptIds||[]));
    const legacyIds=planned.length&&!planned[0].attemptedBody?(draft.receiptIds||[]).filter(id=>!unavailable.has(id)&&!attemptedIds.has(id)):[];
    const combined={...result,receiptIds:[...new Set([...(result.receiptIds||[]),...legacyIds,...attemptedIds])],usedReceiptIds:[...unavailable,...legacyIds]};
    const matched=matchFinanceReceipts(planned.map(row=>({...row,receiptIds:row.attemptedBody?.receiptIds||[]})),combined),allowed=new Set(combined.receiptIds);
    const rows=matched.rows.map((row,index)=>({...row,receiptIds:row.attemptedBody?.receiptIds||[...row.receiptIds,...(!index?legacyIds:[])]})),receipts=matched.receipts;
    const number=receiptId=>(receipts.find(receipt=>receipt.id===receiptId)?.index??0)+1;
    const reasons={'duplicate-row-amount':'有多笔相同金额，请手动匹配','multiple-receipts':'多张截图金额相同，请手动匹配','multiple-rows':'这张图可能对应多笔花销，请手动匹配','amount-mismatch':'识别金额不同，请手动匹配','unrecognized-amount':'未识别到金额，请手动匹配','invalid-amount':'请先检查金额'};
    options.openModal?.(`<div class="modal-head"><div><h2>核对花销与截图</h2><p>金额和用途按你的填写保留。每张截图只可选给一笔。请核对匹配关系，明细入账后锁定。</p></div></div>${(result.warnings||[]).length?`<div class="finance-import-warnings">${result.warnings.map(value=>`<p>${esc(value)}</p>`).join('')}</div>`:''}<form id="finance-match-form"><fieldset><div class="finance-match-rows">${rows.map((row,index)=>`<section class="finance-match-row" data-match-row="${esc(row.id)}"><div class="finance-match-heading"><div><h3>${esc(row.purpose)}</h3><span>${esc(row.categoryId?categoryName(row.categoryId):financeCategoryLabel(row.purpose,categories))}</span></div><strong>¥${money(row.amountCents)}</strong></div><p class="help" data-match-reason>${row.attemptedBody?'提交结果待确认，重试时保留原金额与截图。':row.matchReason==='amount'?'已按唯一金额自动匹配。':esc(reasons[row.matchReason]||'请选择对应截图。')}</p><details class="finance-match-options" ${row.receiptIds.length?'':'open'}><summary data-match-summary>${row.receiptIds.length?row.receiptIds.map(value=>`截图 ${number(value)}`).join('、'):'选择对应截图'}</summary><div>${receipts.map(receipt=>`<label class="finance-checkbox"><input type="checkbox" name="match-${index}" value="${esc(receipt.id)}" ${row.receiptIds.includes(receipt.id)?'checked':''} ${row.attemptedBody?'disabled':''}>截图 ${receipt.index+1}<small>${receipt.amounts.length?receipt.amounts.map(value=>`¥${money(value)}`).join(' / '):'未识别金额'}${receipt.duplicate?' · 已上传过':''}<span data-receipt-owner></span></small></label>`).join('')}</div></details><p class="finance-import-result" data-match-result></p></section>`).join('')}</div><section class="finance-match-images"><h3>本次截图</h3>${receipts.map(receipt=>`<div class="finance-match-image"><div><span>截图 ${receipt.index+1}</span><span>${receipt.amounts.length?receipt.amounts.map(value=>`¥${money(value)}`).join(' / '):'金额待手动核对'}</span><button type="button" class="link-button" data-match-preview="${esc(receipt.id)}">查看截图</button></div><div data-match-image="${esc(receipt.id)}" hidden></div></div>`).join('')}</section><label class="finance-checkbox finance-match-unused" data-match-unused hidden><input type="checkbox" name="acknowledge-unused"><span data-match-unused-copy></span></label><p class="error-text" data-form-error role="status" aria-live="polite"></p><div class="modal-actions"><button type="button" class="btn" data-close>返回修改</button><button type="submit" class="btn btn-primary">确认匹配并入账</button></div></fieldset></form>`,'workspace-dialog finance-dialog finance-import-dialog finance-match-dialog');
    const form=container.ownerDocument.querySelector('#finance-match-form');if(!form)return;
    const live=()=>alive()&&form.isConnected&&container.ownerDocument.querySelector('#finance-match-form')===form;
    const sections=$$('[data-match-row]',form);
    const choices=sections.map((section,index)=>$$(`input[name="match-${index}"]`,section));
    const update=()=>{
      const owners=receiptOwners([...unavailable]);
      for(const [index,row] of rows.entries()){
        if(row.attemptedBody||row.done)claimRowReceipts(owners,row.receiptIds,index);
      }
      for(const [index,row] of rows.entries()){
        if(row.attemptedBody||row.done)continue;
        row.receiptIds=choices[index].filter(box=>box.checked&&allowed.has(box.value)&&!owners.has(box.value)).map(box=>box.value);
        claimRowReceipts(owners,row.receiptIds,index);
      }
      for(const [index,row] of rows.entries()){
        const section=sections[index],locked=Boolean(row.attemptedBody||row.done);
        for(const box of choices[index]){
          const owner=owners.get(box.value),taken=owner!==undefined&&owner!==index;
          box.disabled=locked||taken;
          const label=box.closest('label'),message=$('[data-receipt-owner]',label);
          message.textContent=taken?(owner<0||rows[owner].done?' · 已用于入账':` · 已选给第 ${owner+1} 笔`):'';
          if(taken&&!locked)clearReceiptChoice(box);
        }
        $('[data-match-reason]',section).textContent=row.done?'本笔已入账。':row.attemptedBody?'提交结果待确认，重试时保留原金额与截图。':row.receiptIds.length?(row.matchReason==='amount'?'已按唯一金额自动匹配。':'已手动匹配，请核对所选截图。'):(reasons[row.matchReason]||'请选择对应截图。');
        $('[data-match-summary]',section).textContent=row.receiptIds.length?row.receiptIds.map(value=>`截图 ${number(value)}`).join('、'):'选择对应截图';
      }
      const unused=receipts.filter(receipt=>!owners.has(receipt.id));$('[data-match-unused]',form).hidden=!unused.length;
      $('[data-match-unused-copy]',form).textContent=`截图 ${unused.map(receipt=>receipt.index+1).join('、')} 未关联本次账目，我确认暂不用于入账。`;
      return unused;
    };
    form.addEventListener('change',event=>{
      if(!live()||pending||event.target.disabled||!event.target.name?.startsWith('match-'))return;
      const row=rows[Number(event.target.name.slice(6))];if(row&&!row.attemptedBody)row.matchReason='manual';
      const acknowledgment=form.elements['acknowledge-unused'];
      if(acknowledgment.checked){
        acknowledgment.checked=false;
        acknowledgment.dispatchEvent(new Event('change',{bubbles:true}));
      }
      update();
    });
    const previewOwners=new Map();
    form.addEventListener('click',async event=>{
      const button=event.target.closest('[data-match-preview]');if(!button||!live()||pending)return;const receiptId=button.dataset.matchPreview,host=$$('[data-match-image]',form).find(node=>node.dataset.matchImage===receiptId),owner={};if(!host)return;previewOwners.set(receiptId,owner);
      if(!host.hidden){host.hidden=true;return}host.hidden=false;render(host,'<p class="help" role="status">正在读取截图…</p>');
      const current=()=>live()&&!host.hidden&&previewOwners.get(receiptId)===owner;
      try{const module=options.receiptClient||await import('./receipt-client.js?v=1.0.0-audit1');if(!current())return;const urls=await module.loadReceiptUrls([receiptId],'image',{request,isCurrent:current});if(!current())return;const url=safeImageUrl(urls[receiptId]);if(!url)throw new Error('截图暂时无法读取，请点击重新查看。');render(host,`<img src="${esc(url)}" alt="截图 ${number(receiptId)}，用于核对花销" loading="lazy">`);const image=$('img',host);image.addEventListener('error',()=>{if(current())render(host,'<p class="help">图片未能载入，请收起后重新查看。</p>')},{once:true})}
      catch(error){if(current())render(host,`<p class="help" role="status">${esc(error.message||'截图读取失败，请重试。')}</p>`)}
    });
    update();
    form.addEventListener('submit',event=>{
      event.preventDefault();if(!live()||pending)return;const unused=update(),error=$('[data-form-error]',form),remaining=rows.filter(row=>!row.done);
      const missing=remaining.find(row=>!row.receiptIds.length||row.receiptIds.length>10||row.receiptIds.some(value=>!allowed.has(value)));
      if(missing){error.textContent=!missing.receiptIds.length?`请为“${missing.purpose}”选择对应截图。`:'每笔最多关联10张有效截图。';const section=sections.find(node=>node.dataset.matchRow===missing.id);if(section)$('details',section).open=true;return}
      if(unused.length&&!form.elements['acknowledge-unused'].checked){error.textContent='还有截图未关联账目，请先匹配，或确认这些截图暂不入账。';return}
      error.textContent='';write(form,async current=>{
        let committed=0,allDone=false;
        try{for(const row of remaining){
          const original=quickRows.find(item=>item.id===row.id);if(!original)throw new Error('待记花销已变化，请返回后重新核对。');
          const first=quickRows[0]===original,body=row.attemptedBody||{id:row.id,date:day,kind:'expense',expression:row.expression,purpose:row.purpose,categoryId:row.categoryId||'',note:first?draft.note||'':'',receiptIds:[...row.receiptIds],source:daily?'daily':'finance'};
          row.attemptedBody=body;original.attemptedBody=body;original.attempted=true;original.receiptIds=[...body.receiptIds];
          const section=sections.find(node=>node.dataset.matchRow===row.id);update();
          refreshQuick?.();
          try{await request('/api/finance/entries',{method:'POST',body},()=>current()&&live())}
          catch(error){
            if(rejectedFinanceWrite(error)&&current()&&live()){
              delete row.attemptedBody;delete original.attemptedBody;original.attempted=false;
              const latest=quickRows.find(item=>item.id===row.id);
              if(latest){delete latest.attemptedBody;latest.attempted=false}
              if(error.code==='finance_receipt_in_use'&&body.receiptIds.length===1){
                unavailable.add(body.receiptIds[0]);
                if(lastMatchResult)lastMatchResult={...lastMatchResult,usedReceiptIds:[...new Set([...(lastMatchResult.usedReceiptIds||[]),...unavailable])]};
              }
              update();refreshQuick?.();
            }
            throw error;
          }
          if(!current()||!live())return;
          row.done=true;if(section){$('[data-match-result]',section).textContent='已入账';section.dataset.matchDone='true'}
          if(!daily)expandedLedgerDay=day;
          if(lastMatchResult)lastMatchResult={...lastMatchResult,usedReceiptIds:[...new Set([...(lastMatchResult.usedReceiptIds||[]),...body.receiptIds])]};
          update();
          const quick=$('[data-finance-create]',container),lines=quick.elements.text.value.split(/\r\n?|\n/);lines.splice(original.line-1,1);quick.elements.text.value=lines.join('\n');quickRows=quickRows.filter(item=>item.id!==original.id);
          if(first){draft.note='';draft.receiptIds=[];draft.categoryId=''}draft={...draft,text:quick.elements.text.value,expression:'',purpose:''};committed++;changed();refreshQuick?.();
        }
        allDone=true;
        if(current()&&live()){await load();if(!current()||!live())return;options.closeModal?.(true);lastMatchResult=null;notify('截图已匹配，花销已入账。','success')}
        }finally{if(committed&&!allDone&&current()){try{await load()}catch{}notify(`已入账 ${committed} 笔。`,'success')}}
      });
    });
  }

  function importPreview(candidates,warnings=[],{manual=false,usedReceiptIds=[]}={}){
    const normalize=candidate=>{let duplicate=candidate.duplicate===true;try{const amount=parseMoneyExpression(candidate.expression);duplicate ||= entries.some(entry=>!entry.deletedAt&&entry.date===(candidate.date||day)&&entry.kind===(candidate.kind||'expense')&&entry.amountCents===amount)}catch{}return {...candidate,duplicate,id:id(),receiptIds:candidate.receiptIds||[],categoryChosen:false,categoryId:automaticCategory(candidate.purpose,categories,candidate.kind)}};
    const rows=candidates.map(candidate=>normalize({...candidate,manual}));
    const existingUsage=receiptOwners(usedReceiptIds),candidateCounts=new Map();
    for(const row of rows){
      if(row.kind!=='expense')continue;
      for(const id of row.receiptIds)candidateCounts.set(id,(candidateCounts.get(id)||0)+1);
    }
    const initiallySelected=row=>row.kind==='expense'&&!row.duplicate&&row.receiptIds.every(id=>!existingUsage.has(id)&&candidateCounts.get(id)===1);
    const rowFields=(row,index)=>`<div class="finance-import-row-head"><label class="finance-checkbox"><input name="select-${index}" type="checkbox" ${initiallySelected(row)?'checked':''}>第 ${index+1} 笔${row.duplicate?' · 疑似重复，确认仍需保留时勾选':''}${!row.manual&&row.confidence!=='high'?' · 请仔细核对':''}</label><button class="link-button" type="button" data-import-remove="${index}" aria-label="移除第 ${index+1} 笔">移除</button></div><div class="finance-form-top"><label>日期<input name="date-${index}" type="date" value="${esc(row.date||day)}" required></label><input type="hidden" name="kind-${index}" value="expense"><div class="finance-income-kind"><span>类型</span><strong>支出</strong></div></div><div class="finance-money-row"><label>金额 / 算式<input name="expression-${index}" value="${esc(row.expression||'')}" inputmode="decimal" maxlength="240" placeholder="例如 8+8+8-1"><output data-import-calculation aria-live="polite"></output></label><label>用途<input name="purpose-${index}" value="${esc(row.purpose||'')}" maxlength="160" placeholder="例如 早餐、打车"></label></div><label>分类<select data-finance-compact name="category-${index}">${categoryOptions(categories,row.categoryId,'',row.kind)}</select><span class="help" data-import-category-hint>${esc(row.purpose?`自动分类：${financeCategoryLabel(row.purpose,categories,row.kind)}`:'根据用途自动分类')}</span></label><label>备注（选填）<input name="note-${index}" value="${esc(row.note||'')}" maxlength="500"></label>${row.kind!=='expense'?'<p class="help">这张截图可能是收入或退款，请从收入记账或原支出退款入口登记。</p>':''}${row.receiptIds?.length?`<p class="finance-import-receipt-note">已附 ${row.receiptIds.length} 张压缩截图 · 确认入账后可在收支明细查看</p>`:'<p class="help">截图未保存，不能确认支出。</p>'}${row.warnings?.length?`<p class="help">${row.warnings.map(esc).join('；')}</p>`:''}<p class="help" data-import-conflict hidden></p><p class="finance-import-result" data-import-result></p>`;
    options.openModal?.(`<div class="modal-head"><div><h2>${manual?'记下多笔收支':'核对截图账目'}</h2><p>${manual?'逐行填写金额和用途，可以增加或移除行，核对后再确认入账。':'请核对日期、金额和用途，明细入账后锁定。'}</p></div></div>${warnings.length?`<div class="finance-import-warnings" role="status">${warnings.map(warning=>`<p>${esc(warning)}</p>`).join('')}</div>`:''}<form id="finance-import-form"><fieldset><div class="finance-import-rows">${rows.map((row,index)=>`<section class="finance-import-row" data-import-index="${index}">${rowFields(row,index)}</section>`).join('')}</div><p class="error-text" data-form-error role="status"></p><div class="modal-actions"><button class="btn" type="button" data-close>取消</button><button class="btn btn-primary" type="submit">确认选中账目入账</button></div></fieldset></form>`,'workspace-dialog finance-dialog finance-import-dialog');
    const form=container.ownerDocument.querySelector('#finance-import-form');if(!form)return;
    const editable=()=>alive()&&form.isConnected&&!pending;
    const refreshCalculation=section=>{const index=Number(section.dataset.importIndex),text=form.elements[`expression-${index}`].value.trim(),output=$('[data-import-calculation]',section);try{const amount=parseMoneyExpression(text);output.textContent=amount>0?`合计 ¥${money(amount)}`:'入账金额需要大于 0';output.classList.toggle('is-error',amount<=0)}catch{output.textContent=text?'请检查算式，只支持数字、小数、加减。':'输入金额，自动计算合计';output.classList.toggle('is-error',Boolean(text))}};
    const updateRowActions=()=>{
      const sections=$$('[data-import-index]',form),owners=new Map(existingUsage);
      for(const [index,row] of rows.entries()){
        if(row.done||row.attemptedBody)claimRowReceipts(owners,row.receiptIds,index);
      }
      for(const section of sections){
        const index=Number(section.dataset.importIndex),row=rows[index],choice=form.elements[`select-${index}`];
        if(row.kind==='expense'&&choice.checked&&row.receiptIds.every(id=>!owners.has(id)||owners.get(id)===index))claimRowReceipts(owners,row.receiptIds,index);
      }
      for(const section of sections){
        const index=Number(section.dataset.importIndex),row=rows[index],choice=form.elements[`select-${index}`],locked=Boolean(row.done||row.attemptedBody);
        const other=row.receiptIds.map(id=>owners.get(id)).find(owner=>owner!==undefined&&owner!==index);
        choice.disabled=locked||row.kind!=='expense'||other!==undefined;
        if(choice.disabled&&!locked)clearReceiptChoice(choice);
        $('[data-import-remove]',section).disabled=sections.length<=1||locked;
        const hint=$('[data-import-conflict]',section);
        hint.hidden=other===undefined;
        hint.textContent=other===undefined?'':other<0||rows[other].done?'这张截图已用于入账。':`这张截图已选给第 ${other+1} 笔。`;
      }
    };
    let suggesting=false;
    const suggestRow=(index)=>{
      const select=form.elements[`category-${index}`],purpose=form.elements[`purpose-${index}`].value,kind=form.elements[`kind-${index}`].value;
      const hint=$('[data-import-category-hint]',select.closest('[data-import-index]'));
      if(hint)hint.textContent=purpose.trim()?`自动分类：${financeCategoryLabel(purpose,categories,kind)}`:'根据用途自动分类';
      if(rows[index].categoryChosen)return;
      suggesting=true;
      select.value=automaticCategory(purpose,categories,kind);
      select.dispatchEvent(new Event('change',{bubbles:true}));
      suggesting=false;
    };
    form.addEventListener('input',event=>{if(!editable())return;const section=event.target.closest('[data-import-index]');if(!section)return;const index=Number(section.dataset.importIndex);if(event.target.name===`purpose-${index}`)suggestRow(index);refreshCalculation(section)});
    form.addEventListener('change',event=>{
      if(!editable()||suggesting)return;
      const section=event.target.closest('[data-import-index]');if(!section)return;
      const index=Number(section.dataset.importIndex);
      if(event.target.name===`category-${index}`){
        rows[index].categoryChosen=Boolean(event.target.value);
        if(!rows[index].categoryChosen)suggestRow(index);
      }
      if(event.target.name===`kind-${index}`)suggestRow(index);
      if(event.target.name===`select-${index}`)updateRowActions();
    });
    form.addEventListener('click',event=>{
      if(!editable())return;const button=event.target.closest('button');

      if(button?.matches('[data-import-remove]')){const index=Number(button.dataset.importRemove);if(rows[index]?.done||rows[index]?.attemptedBody||rows.filter(row=>!row.removed).length<=1)return;const section=button.closest('[data-import-index]'),neighbor=section.nextElementSibling||section.previousElementSibling;rows[index].removed=true;render(section,'');section.remove();updateRowActions();$('input[name^="expression-"]',neighbor)?.focus()}
    });
    for(const section of $$('[data-import-index]',form))refreshCalculation(section);updateRowActions();
    form.addEventListener('submit',event=>{event.preventDefault();if(!editable())return;updateRowActions();const values=new FormData(form),selected=rows.flatMap((row,index)=>!row.removed&&!row.done&&(row.attemptedBody||values.get(`select-${index}`)==='on')?[{row,index,body:row.attemptedBody||{id:row.id,date:String(values.get(`date-${index}`)||day),kind:'expense',expression:String(values.get(`expression-${index}`)||''),purpose:String(values.get(`purpose-${index}`)||''),categoryId:String(values.get(`category-${index}`)||''),receiptIds:row.receiptIds,note:String(values.get(`note-${index}`)||''),source:daily?'daily':'finance'}}]:[]);
      if(!selected.length){$('[data-form-error]',form).textContent='请至少选择一笔待入账记录。';return}
      try{for(const item of selected){if(!item.row.receiptIds?.length)throw new Error(`第 ${item.index+1} 笔未保存截图，请配置图片存储后重新上传。`);if(item.row.receiptIds.length>10)throw new Error(`第 ${item.index+1} 笔最多关联10张截图，请减少图片后重试。`);if(item.row.kind!=='expense')throw new Error('收入或退款截图请使用对应记账入口。');if(parseMoneyExpression(item.body.expression)<=0)throw new Error(`请检查第 ${item.index+1} 笔金额。`)}}catch(error){$('[data-form-error]',form).textContent=error.message;return}
      write(form,async current=>{let expandedBatchDay=false,committed=0,allDone=false;try{for(const item of selected){
        item.row.attemptedBody=item.body;const locked=$(`[data-import-index="${item.index}"]`,form);for(const control of $$('input,select,button',locked))control.disabled=true;
        try{await request('/api/finance/entries',{method:'POST',body:item.body},current)}catch(error){
          // A definitive validation rejection committed nothing; let this row be
          // corrected. Uncertain failures keep their original idempotent payload.
          if(rejectedFinanceWrite(error)&&current()){
            delete item.row.attemptedBody;
            for(const control of $$('input,select,button',locked))control.disabled=false;
            if(error.code==='finance_receipt_in_use'&&item.row.receiptIds.length===1)existingUsage.set(item.row.receiptIds[0],-1);
            updateRowActions();
          }
          throw error;
        }
        if(!current())return;const section=$(`[data-import-index="${item.index}"]`,form);item.row.done=true;committed++;if(!daily&&!expandedBatchDay){expandedLedgerDay=item.body.date;expandedBatchDay=true}$('[data-import-result]',section).textContent='已入账';for(const control of $$('input,select,button',section))control.disabled=true;section.dataset.importDone='true';
        updateRowActions();
      }allDone=true;if(current()){options.closeModal?.(true);await load();notify('选中账目已入账。','success')}}finally{if(committed&&!allDone&&current()){try{await load()}catch{}}}});
    });
  }
  async function importFiles(files){
    if(!files?.length||pending||!alive())return;
    if(quickRows.some(row=>row.attemptedBody)){if(lastMatchResult)openMatchedExpenses(quickRows,lastMatchResult);return}
    const quick=$('[data-finance-create]',container),parsed=refreshQuick?.();
    if(parsed?.errors.length){$('[data-form-error]',quick).textContent='请先修正待记花销，再上传截图。';quick.elements.text.focus();return}
    const planned=quickRows.map(row=>({...row}));
    const anchor=quick||container,owner=new AbortController();importController=owner;
    const stop=()=>owner.abort();aborter.signal.addEventListener('abort',stop,{once:true});
    const cancel=$('[data-cancel-import]',container);cancel.hidden=false;
    let onAbort;
    try{await write(anchor,async current=>{
      const active=()=>current()&&!owner.signal.aborted;
      try{
        status('正在本地读取截图…');receiptModule=options.receiptClient||await import('./receipt-client.js?v=1.0.0-audit1');if(!active())return;
        const task=receiptModule.processReceiptFiles(files,{request,isCurrent:active,signal:owner.signal,categories,date:day,upload:true,onProgress:progress=>{if(active())status(typeof progress==='string'?progress:progress?.message||'正在本地识别截图…')}});
        const result=await Promise.race([task,new Promise((_,reject)=>{onAbort=()=>reject(new DOMException('已取消图片处理','AbortError'));owner.signal.addEventListener('abort',onAbort,{once:true});if(owner.signal.aborted)onAbort()})]);if(!active())return;
        if(result.imageStatus!=='stored'||!result.receiptIds?.length)throw new Error('截图尚未保存，不能确认支出。请先在图片存储设置中配置并测试S3，再重新上传。');
        const usedReceiptIds=result.usedReceiptIds||[];
        if(result.receiptIds.every(id=>usedReceiptIds.includes(id)))throw new Error('这批截图都已用于入账，请换成对应新账目的截图。');
        lastMatchResult=result;
        if(planned.length){status('截图已保存，请核对花销与截图的匹配关系。');openMatchedExpenses(planned,result);return}
        const candidates=result.candidates?.length?result.candidates.map(candidate=>({...candidate,receiptIds:(candidate.receiptIds||[]).filter(value=>result.receiptIds.includes(value))})):[{date:day,expression:'',purpose:'',kind:'expense',categoryId:'',receiptIds:result.receiptIds||[],confidence:0}];
        if(candidates.length===1&&!candidates[0].receiptIds?.length)candidates[0].receiptIds=result.receiptIds||[];
        status(result.receiptIds?.length?`已上传 ${result.receiptIds.length} 张压缩截图，尚未入账。请核对并确认，入账后在明细点击“查看截图”。`:'截图已识别，未保存图片。请核对后确认入账。');importPreview(candidates,result.warnings||[],{usedReceiptIds});
      }catch(error){if(error.name!=='AbortError'){if(current())status(error.message||'图片未能保存，尚未入账。',true);throw error}if(current())status('已取消截图处理，未入账。')}
    })}finally{if(onAbort)owner.signal.removeEventListener('abort',onAbort);aborter.signal.removeEventListener('abort',stop);if(importController===owner){importController=null;cancel.hidden=true}}
  }

  function onClick(event){
    if(!alive())return;const button=event.target.closest('button');if(!button||!container.contains(button))return;if(button.matches('[data-cancel-import]')){importController?.abort();receiptModule?.disposeReceiptWorker?.();return}if(pending)return;
    if(button.matches('[data-finance-retry]'))load();
    if(button.matches('[data-finance-more]'))load(true);
    if(button.matches('[data-finance-refresh]'))load();
    if(button.matches('[data-finance-storage]'))storageDialog();
    if(button.matches('[data-finance-detail]'))openDetailed();
    if(button.matches('[data-focus-entry]')){const form=$('[data-finance-create]',container);form?.elements.text.focus();form?.scrollIntoView?.({block:'center',behavior:'smooth'})}
    if(button.matches('[data-day-zero]'))write(button,async current=>{await request('/api/finance/day',{method:'POST',body:{date:day,state:'zero'}},current);if(current()){await load();notify('已记录今日零支出。','success')}});
    if(button.matches('[data-receipt-open]')){const entry=entries.find(row=>row.id===button.closest('[data-entry-id]')?.dataset.entryId);if(entry)viewReceipt(entry)}
    if(button.matches('[data-entry-action="refund"]')){
      const entry=entries.find(row=>row.id===button.dataset.id);
      if(entry?.kind==='expense'&&!entry.deletedAt)openRefund(entry);
    }
    if(button.matches('[data-finance-day-card]')){
      const date=button.dataset.financeDayCard;
      expandedLedgerDay=expandedLedgerDay===date?null:date;
      renderEntries();
      if(expandedLedgerDay&&(globalThis.innerWidth||1200)<900)$('[data-finance-day-detail]',container)?.scrollIntoView?.({block:'nearest',behavior:'smooth'});
    }
    if(button.matches('[data-finance-day-close]')){expandedLedgerDay=null;renderEntries();}
    if(button.matches('[data-finance-open-annual]')){options.onOpenAnnual?.(filters.month.slice(0,4))}
    if(button.matches('[data-finance-back]')){options.onBackToFinance?.()}
    if(button.matches('[data-finance-year-prev],[data-finance-year-next]')){
      const step=button.matches('[data-finance-year-prev]')?-1:1;
      const next=Math.min(9999,Math.max(1,(Number(filters.year)||Number(day.slice(0,4)))+step));
      switchYear(String(next).padStart(4,'0'));
    }
    if(button.matches('[data-finance-year-current]')){switchYear(options.today().slice(0,4))}
    if(button.matches('[data-finance-year-month]')){options.onSelectMonth?.(button.dataset.financeYearMonth)}
  }
  function mount(){
    const filterStrip=`<form class="finance-filters" data-finance-filters role="search"><label>搜索用途<span class="finance-search-field"><input name="q" type="search" maxlength="160" placeholder="搜索用途或备注"><button class="link-button" type="button" data-finance-clear-search aria-label="清空用途搜索" hidden>清空</button></span></label><label>收支类型<select data-finance-compact name="kind"><option value="">全部类型</option>${Object.entries(FINANCE_KINDS).map(([key,label])=>`<option value="${key}">${esc(label)}</option>`).join('')}</select></label><label class="finance-checkbox"><input name="deleted" type="checkbox">包含已删除</label></form>`;
    if(daily){render(container,`<div class="finance-daily"><div class="finance-day-summary" data-finance-summary><span>今日净支出</span><strong>—</strong><small>正在读取当天账目</small></div><div data-finance-form class="finance-entry-form"></div><div class="finance-daily-tools"><button class="btn btn-ghost" type="button" data-finance-detail>收入记账</button><button class="btn btn-ghost" type="button" data-day-zero>今天没有花销</button><button class="link-button" type="button" data-finance-storage>图片存储设置</button></div><p class="help" data-storage-note></p><p class="finance-status" data-finance-status role="status" aria-live="polite"></p><button type="button" class="btn btn-ghost" data-cancel-import hidden>取消截图处理</button><div data-finance-entries></div><button class="btn btn-ghost" type="button" data-finance-more hidden>加载更早记录</button><input data-finance-files type="file" accept="image/png,image/jpeg,image/webp" multiple hidden></div>`)}
    else if(annual){render(container,`<section class="finance-page finance-annual-page" aria-labelledby="finance-annual-title"><header class="history-hero finance-hero finance-annual-hero"><div class="history-hero-copy finance-hero-copy"><button type="button" class="finance-back-link" data-finance-back><span aria-hidden="true">←</span> 返回财务收支</button><h1 id="finance-annual-title">年度开销</h1><p class="history-hero-note">从一整年的维度回看花销结构、月度节律与全年明细。</p></div><div class="finance-hero-actions"><div class="finance-year-nav is-hero" role="group" aria-label="切换年度开销年份" data-ui-native><button type="button" class="finance-year-step" data-finance-year-prev aria-label="查看上一年年度开销">‹</button><span class="finance-year-label" data-finance-year-label>${esc(filters.year)}年</span><button type="button" class="finance-year-step" data-finance-year-next aria-label="查看下一年年度开销">›</button><button type="button" class="finance-year-current" data-finance-year-current hidden>回今年</button></div><div class="finance-hero-links"><button class="link-button" type="button" data-finance-refresh>刷新年度账本</button></div></div><div class="history-hero-art finance-hero-art" aria-hidden="true"><span class="history-hero-orbit"></span><img src="/assets/finance/ledger.webp?v=1.0.0-finance2" alt="" width="640" height="640" draggable="false"></div></header><section class="finance-studio finance-annual-studio" aria-label="年度收支总览"><div class="finance-summary finance-annual-summary" data-finance-summary></div></section><section class="finance-insights-section" aria-labelledby="finance-annual-insights-title"><header class="archive-section-head finance-section-head"><div class="archive-section-main"><div class="archive-section-copy"><div class="archive-section-title-row"><div class="archive-section-label"><h2 id="finance-annual-insights-title">年度支出构成</h2><span class="archive-section-count">全年分类 · 月度节奏</span></div></div><p>全年分类占比与 12 个月花销起伏并列对照，点击任意月份可直达当月账本。</p></div></div></header><div class="finance-insights finance-annual-insights"><section class="finance-insight finance-insight-annual-pie"><div class="finance-chart-heading"><div><h2>年度花销分类</h2><span>按分类看全年实际支出</span></div></div><div data-finance-year-pie></div></section><section class="finance-insight finance-insight-annual-rhythm"><div class="finance-chart-heading"><div><h2>12 个月花销节奏</h2><span>按月对照全年净支出起伏</span></div><span class="finance-year-rhythm-hint">点击月份进入该月</span></div><div class="finance-annual-rhythm-body" data-finance-year-rhythm></div></section></div></section><section class="finance-ledger finance-annual-ledger" aria-labelledby="finance-annual-ledger-title"><header class="archive-section-head finance-section-head"><div class="archive-section-main"><div class="archive-section-copy"><div class="archive-section-title-row"><div class="archive-section-label"><h2 id="finance-annual-ledger-title">整年收支明细</h2><span class="archive-section-count" data-finance-ledger-meta></span></div></div><p>按天归档全年全部流水，点击日期卡牌可查看当日明细、凭证截图或登记退款。</p></div></div></header>${filterStrip}<p class="finance-status" data-finance-status role="status" aria-live="polite"></p><div data-finance-entries></div><button class="btn btn-ghost finance-more" type="button" data-finance-more hidden>加载更早记录</button></section></section>`)}
    else render(container,`<section class="finance-page" aria-labelledby="finance-page-title"><header class="history-hero finance-hero"><div class="history-hero-copy finance-hero-copy"><h1 id="finance-page-title">财务收支</h1><p class="history-hero-note">把每一笔写清楚，让花销有迹可循。</p></div><div class="finance-hero-actions"><div class="finance-period-shell" data-finance-period></div><button class="history-write finance-hero-cta" type="button" data-finance-detail>收入记账 <span class="mobile-action-arrow" aria-hidden="true">↗</span></button><button class="finance-hero-annual-btn" type="button" data-finance-open-annual>年度开销 <span class="mobile-action-arrow" aria-hidden="true">↗</span></button><div class="finance-hero-links"><button class="link-button" type="button" data-finance-storage>图片存储设置</button><button class="link-button" type="button" data-finance-refresh>刷新账本</button></div></div><div class="history-hero-art finance-hero-art" aria-hidden="true"><span class="history-hero-orbit"></span><img src="/assets/finance/ledger.webp?v=1.0.0-finance2" alt="" width="640" height="640" draggable="false"></div></header><section class="finance-studio" aria-label="当月账面与快速记账"><div class="finance-summary" data-finance-summary></div><section class="finance-writing" aria-labelledby="finance-write-title"><div class="finance-writing-head finance-section-title"><div><span class="finance-writing-kicker"><i aria-hidden="true"></i>快捷入账</span><h2 id="finance-write-title">记下花销</h2></div><span class="finance-writing-date">记入 ${esc(day)} · 人民币</span></div><div data-finance-form class="finance-entry-form finance-writing-pad"></div></section></section><section class="finance-insights-section" aria-labelledby="finance-insights-title"><header class="archive-section-head finance-section-head"><div class="archive-section-main"><div class="archive-section-copy"><div class="archive-section-title-row"><div class="archive-section-label"><h2 id="finance-insights-title">支出构成</h2><span class="archive-section-count">分类对比 · 退款单列</span></div><button type="button" class="link-button finance-section-jump" data-finance-open-annual>查看年度开销 ↗</button></div><p>整月与单日开销并列对照，方便回顾消费重心与节律。</p></div></div></header><div class="finance-insights"><section class="finance-insight finance-insight-monthly"><div class="finance-chart-heading"><div><h2>月度花销</h2><span>按分类看整月支出</span></div></div><div data-finance-month-pie></div></section><section class="finance-insight finance-insight-daily"><div class="finance-chart-heading"><div><h2>每日花销</h2><span>选一天看明细占比</span></div><div data-finance-day-picker></div></div><div data-finance-day-pie></div><button type="button" class="link-button" data-finance-day-retry hidden>重新读取当天花销</button></section></div></section><section class="finance-ledger" aria-labelledby="finance-ledger-title"><header class="archive-section-head finance-section-head"><div class="archive-section-main"><div class="archive-section-copy"><div class="archive-section-title-row"><div class="archive-section-label"><h2 id="finance-ledger-title">收支明细</h2><span class="archive-section-count" data-finance-ledger-meta></span></div><button type="button" class="link-button finance-section-jump" data-finance-open-annual>查看整年明细 ↗</button></div><p data-storage-note></p></div></div></header>${filterStrip}<p class="finance-status" data-finance-status role="status" aria-live="polite"></p><button type="button" class="btn btn-ghost" data-cancel-import hidden>取消截图处理</button><div data-finance-entries></div><button class="btn btn-ghost finance-more" type="button" data-finance-more hidden>加载更早记录</button></section><input data-finance-files type="file" accept="image/png,image/jpeg,image/webp" multiple hidden></section>`);
    container.addEventListener('click',onClick);
    if(!annual){
      $('[data-finance-files]',container)?.addEventListener('change',event=>{const files=[...event.target.files];event.target.value='';importFiles(files)});
      container.addEventListener('paste',onPaste);
    }
    const period=$('[data-finance-period]',container);if(period&&options.showMonthPicker)periodController=options.showMonthPicker(period,{value:filters.month,today:options.today(),isCurrent:alive,onChange:value=>switchMonth(value)});
    if(annual){
      yearPie=options.showFinancePie?.($('[data-finance-year-pie]',container),{title:`${filters.year} 年度花销`,loading:true});
      syncYearNavState();
    }else if(!daily){
      monthPie=options.showFinancePie?.($('[data-finance-month-pie]',container),{title:'月度花销',loading:true});
      dayPie=options.showFinancePie?.($('[data-finance-day-pie]',container),{title:'每日花销',loading:true});
      selectedDay=filters.month===options.today().slice(0,7)?options.today():`${filters.month}-01`;
      dayPicker=options.showFinanceDayPicker?.($('[data-finance-day-picker]',container),{value:selectedDay,month:filters.month,today:options.today(),isCurrent:alive,onChange:value=>{if(!alive()||pending||value===selectedDay||!value.startsWith(filters.month+'-'))return;selectedDay=value;loadDailyChart()}});
      $('[data-finance-day-retry]',container)?.addEventListener('click',()=>{if(alive()&&!pending)loadDailyChart()});
    }
    const filterForm=$('[data-finance-filters]',container);let composingSearch=false;
    const applySearch=()=>{
      if(!filterForm||pending)return;
      const value=filterForm.elements.q.value;
      $('[data-finance-clear-search]',filterForm).hidden=!value;
      filters.q=value;loadOwner=null;resetPagination();
      clearTimeout(searchTimer);searchTimer=setTimeout(()=>load(),220);
    };
    filterForm?.addEventListener('submit',event=>{event.preventDefault();if(pending||composingSearch||event.isComposing)return;clearTimeout(searchTimer);filters.q=filterForm.elements.q.value;load()});
    filterForm?.addEventListener('change',event=>{if(pending)return;const values=new FormData(filterForm);filters.kind=String(values.get('kind')||'');filters.deleted=values.get('deleted')==='on';if(event.target.name!=='q')load()});
    filterForm?.addEventListener('compositionstart',event=>{if(event.target.name==='q'){composingSearch=true;clearTimeout(searchTimer)}});
    filterForm?.addEventListener('compositionend',event=>{if(event.target.name==='q'){composingSearch=false;applySearch()}});
    filterForm?.addEventListener('input',event=>{if(event.target.name!=='q'||pending)return;$('[data-finance-clear-search]',filterForm).hidden=!event.target.value;if(composingSearch||event.isComposing)return;applySearch()});
    filterForm?.addEventListener('click',event=>{if(!event.target.closest('[data-finance-clear-search]')||pending)return;composingSearch=false;clearTimeout(searchTimer);const search=filterForm.elements.q;search.value='';filters.q='';$('[data-finance-clear-search]',filterForm).hidden=true;search.focus();load()});
    if(!annual){mountQuickEntry($('[data-finance-form]',container));loadStorage()}
    load();
  }
  function onDragOver(event){if(!alive()||pending)return;const zone=event.target.closest?.('[data-finance-dropzone]');if(!zone||![...(event.dataTransfer?.types||[])].includes('Files'))return;event.preventDefault();zone.classList.add('is-dragover')}
  function onDragLeave(event){const zone=event.target.closest?.('[data-finance-dropzone]');if(zone&&!zone.contains(event.relatedTarget))zone.classList.remove('is-dragover')}
  function onDrop(event){const zone=event.target.closest?.('[data-finance-dropzone]');zone?.classList.remove('is-dragover');if(!zone||!alive()||pending)return;const files=[...(event.dataTransfer?.files||[])].filter(file=>file.type.startsWith('image/'));if(files.length){event.preventDefault();importFiles(files)}}
  function onPaste(event){const files=[...(event.clipboardData?.files||[])].filter(file=>file.type.startsWith('image/'));if(files.length&&!pending){event.preventDefault();importFiles(files)}}
  if(!annual){container.addEventListener('dragover',onDragOver);container.addEventListener('dragleave',onDragLeave);container.addEventListener('drop',onDrop)}
  mount();return {dispose(){disposed=true;periodController?.dispose?.();dayPicker?.dispose?.();yearPie?.dispose?.();monthPie?.dispose?.();dayPie?.dispose?.();dayOwner=null;loadOwner=null;storageOwner=null;aborter.abort();receiptModule?.disposeReceiptWorker?.();clearTimeout(searchTimer);container.removeEventListener('click',onClick);container.removeEventListener('paste',onPaste);container.removeEventListener('dragover',onDragOver);container.removeEventListener('dragleave',onDragLeave);container.removeEventListener('drop',onDrop)},hasPendingDraft:()=>!annual&&hasDraft(draft)};
}

export function mountFinancePage(container,options){return createWorkspace(container,options,'month')}

export function mountFinanceAnnualPage(container,options){return createWorkspace(container,options,'annual')}

export function mountDailyFinance(container,options){
  if(options.readonly){const snapshot=options.snapshot,render=options.renderMarkup;render(container,snapshot?`<section class="finance-daily finance-day-readonly"><div class="finance-day-summary"><span>复盘时记录的净支出</span><strong>¥${money(snapshot.netExpenseCents)}</strong><small>${snapshot.state==='zero'?'当日已确认零支出':snapshot.state==='unrecorded'?'当时未记录花销':`${Number(snapshot.count)||0} 笔账目`} · 锁定后保留当时摘要</small></div>${(snapshot.entries||[]).map(entry=>`<div class="finance-snapshot-entry"><span>${esc(entry.purpose||entry.categoryName||'账目')}<small>${esc(entry.categoryName||'')} · ${esc(FINANCE_KINDS[entry.kind]||'')}</small></span><strong>${entryMoney(entry)}</strong></div>`).join('')}<p class="help">账本后续可以订正，这份复盘仍保留提交时的记录。</p></section>`:'<p class="help">这份历史复盘没有记录财务摘要。</p>');return {dispose(){},hasPendingDraft:()=>false}}
  return createWorkspace(container,options,'daily');
}
