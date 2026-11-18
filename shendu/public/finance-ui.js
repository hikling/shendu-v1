import {parseMoneyExpression,parseFinanceLines,formatFinanceMoney,DEFAULT_FINANCE_CATEGORIES,FINANCE_KINDS,suggestFinanceCategory,financeCategoryLabel} from './finance-domain.js?v=1.0.0-finance17';

import {matchFinanceReceipts} from './finance-receipt-matching.js';

const $=(selector,root)=>root.querySelector(selector),$$=(selector,root)=>[...root.querySelectorAll(selector)];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const blank=()=>({text:'',expression:'',purpose:'',categoryId:'',note:'',receiptIds:[]});
const automaticCategory=(purpose,categories,kind='expense')=>{const found=suggestFinanceCategory(purpose,categories,'expense');return found==='uncategorized'?'':found};
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

function createWorkspace(container,options,daily){
  let disposed=false,pending=false,loadOwner=null,storageOwner=null,data=null,storage=null,categories=[...DEFAULT_FINANCE_CATEGORIES],cursor=null;
  let importController=null,receiptModule=null,storageDialogOwner=null,lastMatchResult=null;
  let entries=[],draft={...blank(),...(options.draft||{})},createId=id(),searchTimer,periodController=null,quickRows=[],refreshQuick=null,dayPicker=null,ledgerDayPicker=null,monthPie=null,dayPie=null,dayOwner=null,selectedDay='',chartMonth=null;
  if(!draft.text&&(draft.expression||draft.purpose))draft.text=`${draft.expression} ${draft.purpose}`.trim();
  const aborter=new AbortController();
  const day=options.date||options.today(),filters={month:day.slice(0,7),range:'month',date:day,q:'',kind:'',deleted:false};
  const alive=()=>!disposed&&container.isConnected&&(options.isCurrent?.()??true);
  const render=(node,html)=>options.renderMarkup(node,html);
  const notify=(message,type='info')=>{if(alive())options.toast?.(message,type)};
  const request=(path,args={},guard=alive)=>options.request(path,args,guard);
  const query=()=>{const params=new URLSearchParams(daily?{date:day}:filters.range==='day'?{date:filters.date}:{month:filters.month});for(const key of ['q','kind'])if(filters[key])params.set(key,filters[key]);if(filters.deleted)params.set('deleted','1');return params};
  const changed=()=>{options.onDraftChange?.({...draft,receiptIds:[...(draft.receiptIds||[])]});options.setDirty?.(hasDraft(draft))};
  const status=(message,error=false)=>{const node=$('[data-finance-status]',container);if(node){node.textContent=message;node.classList.toggle('is-error',error)}};
  const noFormLoss=()=>{const form=$('[data-finance-create]',container);return form?.isConnected?form:null};
  const categoryName=value=>categories.find(category=>category.id===value)?.name||'待分类';

  async function write(anchor,operation){
    if(pending||!alive()||!anchor?.isConnected)return false;
    const token=options.beginWrite?options.beginWrite():{};if(token===null||token===false)return false;
    pending=true;
    periodController?.setDisabled?.(true);dayPicker?.setDisabled?.(true);ledgerDayPicker?.setDisabled?.(true);const range=$('[name="range"]',container);if(range)range.disabled=true;
    const fieldset=$('fieldset',anchor),previousDisabled=fieldset?.disabled,modal=anchor.closest('.modal')?.parentElement,previousPersistent=modal?.dataset.persistent;
    if(fieldset)fieldset.disabled=true;if(modal)modal.dataset.persistent='1';anchor.setAttribute('aria-busy','true');
    const current=()=>alive()&&anchor.isConnected&&(token.isCurrent?.()??true);
    try{await operation(current);return current()}
    catch(error){if(current()){const errorNode=$('[data-form-error]',anchor);if(errorNode)errorNode.textContent=error.message||'未能保存，请重试。';else status(error.message||'未能保存，请重试。',true)}return false}
    finally{pending=false;options.endWrite?.(token);if(alive()){periodController?.setDisabled?.(false);dayPicker?.setDisabled?.(false);ledgerDayPicker?.setDisabled?.(false);if(range?.isConnected)range.disabled=false;}if(anchor.isConnected){anchor.removeAttribute('aria-busy');if(fieldset)fieldset.disabled=previousDisabled}if(modal?.isConnected&&anchor.isConnected&&modal.contains(anchor)){if(previousPersistent===undefined)delete modal.dataset.persistent;else modal.dataset.persistent=previousPersistent}}
  }

  function mountQuickEntry(host){
    const prefix=`finance-lines-${++formSequence}`;
    render(host,`<form data-finance-create class="finance-quick-form"><fieldset><label class="finance-quick-label" for="${prefix}">每行一笔，先写金额，再写用途</label><textarea id="${prefix}" name="text" rows="5" maxlength="6000" placeholder="60 打车&#10;50 吃饭" aria-describedby="${prefix}-help ${prefix}-total">${esc(draft.text)}</textarea><p class="help" id="${prefix}-help">也支持加减算式，例如 8+8-1 早餐。分类会自动建议。填好后上传截图，核对匹配后再入账。</p><div class="finance-line-preview" data-finance-line-preview></div><p class="finance-line-errors" data-finance-line-errors role="status" aria-live="polite"></p><p class="finance-legacy-note" data-finance-legacy-note></p><div class="finance-quick-footer"><output id="${prefix}-total" data-finance-calculation aria-live="polite"></output><div class="finance-quick-actions"><button class="btn btn-ghost" type="button" data-clear-entry>清空</button><button class="btn btn-primary" type="submit" data-upload-expenses>上传截图</button></div></div><p class="error-text" data-form-error role="status" aria-live="polite"></p></fieldset></form>`);
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
    options.openModal?.(`<div class="modal-head"><div><h2>收入记账</h2><p>记录实际到账的收入，支出请在花销区上传截图。</p></div></div><form id="finance-detail-form" class="finance-entry-form finance-income-form">${entryForm(seed,{modal:true,incomeOnly:true})}</form>`,'workspace-dialog finance-dialog finance-detail-dialog');
    const form=container.ownerDocument.querySelector('#finance-detail-form');if(form)bindForm(form,seed,{modal:true,incomeOnly:true,automaticCategory:true});
  }

  function entryForm(entry={},extra={}){
    const prefix=`finance-form-${++formSequence}`,kind=entry.kind||'expense',refunds=entries.filter(row=>row.kind==='expense'&&!row.deletedAt),dailyInline=daily&&!extra.modal;
    if(extra.original&&!refunds.some(row=>row.id===extra.original.id))refunds.unshift(extra.original);
    return `<fieldset><div class="finance-form-top">${dailyInline?'':`<div class="field"><label for="${prefix}-date">日期</label><input id="${prefix}-date" name="date" type="date" required value="${esc(entry.date||day)}"></div>${extra.incomeOnly?'<input type="hidden" name="kind" value="income">':`<div class="field"><label for="${prefix}-kind">收支类型</label><select data-finance-compact id="${prefix}-kind" name="kind">${Object.entries(FINANCE_KINDS).map(([key,label])=>`<option value="${key}" ${kind===key?'selected':''}>${esc(label)}</option>`).join('')}</select></div>`}`}</div><div class="finance-money-row"><div class="field"><label for="${prefix}-amount">金额 / 算式</label><input id="${prefix}-amount" name="expression" inputmode="decimal" autocomplete="off" maxlength="240" required value="${esc(entry.expression||'')}" placeholder="例如 8+8+8-1" aria-describedby="${prefix}-calculation"><output id="${prefix}-calculation" data-finance-calculation>输入金额，自动计算合计</output></div><div class="field"><label for="${prefix}-purpose">${extra.incomeOnly?'收入来源':'用途'}</label><input id="${prefix}-purpose" name="purpose" maxlength="160" value="${esc(entry.purpose||'')}" placeholder="${extra.incomeOnly?'例如 工资、奖金':'例如 早餐、打车'}"></div></div><div class="finance-form-bottom">${extra.incomeOnly?'<input type="hidden" name="categoryId" value="">':`<div class="field"><label for="${prefix}-category">分类</label><div data-category-host><select data-finance-compact id="${prefix}-category" name="categoryId">${categoryOptions(categories,entry.categoryId==='uncategorized'&&!extra.edit&&!extra.preserveCategory?'':entry.categoryId,'',kind)}</select></div><span class="help" data-category-hint>${esc(entry.purpose?`自动分类：${financeCategoryLabel(entry.purpose,categories,kind)}`:'常见用途归入对应类别，其他用途直接作为分类。')}</span></div>`}<div class="field"><label for="${prefix}-note">备注（选填）</label><input id="${prefix}-note" name="note" maxlength="500" value="${esc(entry.note||'')}" placeholder="补充说明（可不填）"></div></div>${dailyInline?'':`<div class="field finance-refund-source" data-refund-source ${kind==='refund'?'':'hidden'}><label for="${prefix}-refund">对应的原支出</label><select data-finance-compact id="${prefix}-refund" name="refundOf"><option value="">选择原支出</option>${refunds.map(row=>`<option value="${esc(row.id)}" ${row.id===entry.refundOf?'selected':''}>${esc(row.date)} · ${esc(row.purpose||categoryName(row.categoryId))} · ¥${money(row.amountCents)}</option>`).join('')}</select><span class="help">可先找到原支出，再点“登记退款”。退款会减少净支出。</span></div>`}${extra.edit?'<section class="finance-receipt-supplement"><div><h3>账目截图</h3><p>补传图片后，点击“保存修改”才会关联到这笔账目。</p></div><button class="btn btn-ghost" type="button" data-attach-receipts>补传截图</button><input data-attach-files type="file" accept="image/png,image/jpeg,image/webp" multiple hidden><p data-attach-status class="help" role="status" aria-live="polite"></p></section>':''}<p class="error-text" data-form-error role="status" aria-live="polite"></p><div class="finance-form-actions"><span class="finance-receipt-count" data-receipt-count>${entry.receiptIds?.length?`附有 ${entry.receiptIds.length} 张压缩截图`:''}</span><button class="btn btn-ghost" type="button" data-clear-entry>${extra.edit||extra.modal?'取消':'清空'}</button><button class="btn btn-primary" type="submit">${extra.edit?'保存修改':'确认入账'}</button></div></fieldset>`;
  }

  function bindForm(form,entry={},extra={}){
    let formReceiptIds=[...(entry.receiptIds||[])];
    let categoryChosen=extra.edit||extra.preserveCategory||!extra.automaticCategory&&Boolean(entry.categoryId&&entry.categoryId!=='uncategorized'),entryId=entry.id||(extra.modal?id():createId);
    const refreshCalculation=()=>{
      const output=$('[data-finance-calculation]',form),text=form.elements.expression.value.trim();
      try{const amount=parseMoneyExpression(text);output.textContent=amount>0?`合计 ¥${money(amount)}`:'入账金额需要大于 0';output.classList.toggle('is-error',amount<=0)}catch{output.textContent=text?'请检查算式，只支持数字、小数、加减。':'输入金额，自动计算合计';output.classList.toggle('is-error',Boolean(text))}
    };
    const capture=()=>{if(extra.edit||extra.modal&&!extra.consumeDraft)return;draft={...draft,text:`${form.elements.expression.value} ${form.elements.purpose.value}`.trim(),expression:form.elements.expression.value,purpose:form.elements.purpose.value,categoryId:form.elements.categoryId.value,note:form.elements.note.value,receiptIds:[...(draft.receiptIds||[])]};const quick=$('[data-finance-create]',container);if(quick){quick.elements.text.value=draft.text;quickRows=[];refreshQuick?.()}changed()};
    const suggest=()=>{if(categoryChosen)return;const kind=form.elements.kind?.value||'expense',suggested=automaticCategory(form.elements.purpose.value,categories,kind);form.elements.categoryId.value=suggested||'';form.elements.categoryId.dispatchEvent(new Event('change',{bubbles:true}));const hint=$('[data-category-hint]',form);if(hint)hint.textContent=form.elements.purpose.value.trim()?`自动分类：${financeCategoryLabel(form.elements.purpose.value,categories,kind)}`:'常见用途归入对应类别，其他用途直接作为分类。'};
    let suggesting=false;
    form.addEventListener('input',event=>{if(!alive()||pending)return;if(event.target.name==='purpose'){suggesting=true;suggest();suggesting=false}refreshCalculation();capture()});
    form.addEventListener('change',event=>{if(!alive()||pending)return;if(event.target.name==='categoryId'&&!suggesting)categoryChosen=true;if(event.target.name==='kind'){const source=$('[data-refund-source]',form);if(source)source.hidden=event.target.value!=='refund';suggesting=true;suggest();suggesting=false}capture()});
    $('[data-clear-entry]',form).addEventListener('click',()=>{if(pending)return;if(extra.edit||extra.modal){options.closeModal?.();return}draft=blank();createId=id();entryId=createId;categoryChosen=false;form.reset();form.elements.expression.value='';form.elements.purpose.value='';form.elements.categoryId.value='';form.elements.note.value='';$('[data-receipt-count]',form).textContent='';$('[data-form-error]',form).textContent='';refreshCalculation();changed()});
    form.addEventListener('submit',event=>{
      event.preventDefault();if(pending||!alive())return;
      const values=new FormData(form),expression=String(values.get('expression')||'');
      try{if(parseMoneyExpression(expression)<=0)throw new Error('入账金额需要大于 0。')}catch(error){$('[data-form-error]',form).textContent=error.message||'请检查金额算式。';form.elements.expression.focus();return}
      const kind=extra.incomeOnly?'income':String(values.get('kind')||'expense'),body={id:entryId,date:String(values.get('date')||day),kind,expression,purpose:String(values.get('purpose')||''),categoryId:String(values.get('categoryId')||''),note:String(values.get('note')||''),refundOf:kind==='refund'?String(values.get('refundOf')||''):null,receiptIds:[...(extra.edit?formReceiptIds:extra.modal?entry.receiptIds||[]:draft.receiptIds||[])],source:daily?'daily':'finance'};
      if(extra.edit)body.version=entry.version;
      write(form,async current=>{
        await request(extra.edit?`/api/finance/entries/${encodeURIComponent(entry.id)}`:'/api/finance/entries',{method:extra.edit?'PUT':'POST',body},current);if(!current())return;
        if(extra.consumeDraft){draft=blank();quickRows=[];const quick=$('[data-finance-create]',container);if(quick)quick.elements.text.value='';changed();refreshQuick?.()}
        if(extra.edit||extra.modal)options.closeModal?.(true);else{draft=blank();createId=id();entryId=createId;categoryChosen=false;form.reset();form.elements.expression.value='';form.elements.purpose.value='';form.elements.categoryId.value='';form.elements.note.value='';$('[data-receipt-count]',form).textContent='';changed();refreshCalculation()}
        notify(extra.edit?'账目已更新':'已入账，复盘草稿可继续填写。','success');await load();
      });
    });
    if(extra.edit)bindReceiptSupplement(form,()=>formReceiptIds,value=>{formReceiptIds=value});
    refreshCalculation();return form;
  }

  function bindReceiptSupplement(form,getIds,setIds){
    const input=$('[data-attach-files]',form),button=$('[data-attach-receipts]',form),message=$('[data-attach-status]',form),cancel=$('[data-cancel-attach]',form.parentElement);
    let attachmentOwner=null;
    button.addEventListener('click',()=>{if(alive()&&form.isConnected&&!pending)input.click()});
    cancel?.addEventListener('click',()=>{attachmentOwner?.abort();receiptModule?.disposeReceiptWorker?.()});
    input.addEventListener('change',async()=>{
      const files=Array.from(input.files||[]);input.value='';if(!files.length||pending||!alive()||!form.isConnected)return;
      const error=$('[data-form-error]',form);error.textContent='';
      if(files.length>10-getIds().length){error.textContent='每笔账目最多关联10张截图，请减少选择的图片。';return}
      const owner=new AbortController();attachmentOwner=owner;const stop=()=>owner.abort();aborter.signal.addEventListener('abort',stop,{once:true});if(cancel)cancel.hidden=false;
      let onAbort;
      try{await write(form,async current=>{
        const active=()=>current()&&!owner.signal.aborted;
        try{
          message.textContent='正在保存补传截图…';receiptModule=options.receiptClient||await import('./receipt-client.js?v=1.0.0-finance17');if(!active())return;
          const task=receiptModule.processReceiptFiles(files,{request,isCurrent:active,signal:owner.signal,categories,date:form.elements.date.value,upload:true,onProgress:progress=>{if(active())message.textContent=typeof progress==='string'?progress:progress?.message||'正在保存截图…'}});
          const result=await Promise.race([task,new Promise((_,reject)=>{onAbort=()=>reject(new DOMException('已取消截图处理','AbortError'));owner.signal.addEventListener('abort',onAbort,{once:true});if(owner.signal.aborted)onAbort()})]);if(!active())return;
          const uploaded=[...new Set(result.receiptIds||[])];if(!uploaded.length||result.imageStatus==='not_stored')throw new Error('截图尚未保存，未关联到账目。请先在图片存储设置中配置并测试S3，再重新补传。');
          const merged=[...new Set([...getIds(),...uploaded])];if(merged.length>10)throw new Error('每笔账目最多关联10张截图，请减少图片后重试。');
          setIds(merged);$('[data-receipt-count]',form).textContent=`附有 ${merged.length} 张压缩截图`;
          message.textContent=`已保存 ${uploaded.length} 张补传截图。点击“保存修改”后会显示在这笔账目的明细中。`;
        }catch(error){if(error.name!=='AbortError'){if(current())message.textContent='截图未关联，原账目内容已保留。';throw error}if(current())message.textContent='已取消补传，原账目内容已保留。'}
      })}finally{if(onAbort)owner.signal.removeEventListener('abort',onAbort);aborter.signal.removeEventListener('abort',stop);if(attachmentOwner===owner){attachmentOwner=null;if(cancel?.isConnected)cancel.hidden=true}}
    });
  }

  function updateCategories(){
    for(const host of $$('[data-category-host]',container)){const select=$('select',host),selected=select?.value||'',identifier=select?.id;if(identifier)render(host,`<select data-finance-compact id="${esc(identifier)}" name="categoryId">${categoryOptions(categories,selected)}</select>`)}
  }

  function entryHtml(entry){
    const deleted=Boolean(entry.deletedAt),title=entry.purpose||categoryName(entry.categoryId),receiptIds=entry.receiptIds||[],amount=money(entry.amountCents);
    const actions=deleted?`<button type="button" class="link-button" data-entry-action="restore" data-id="${esc(entry.id)}">恢复</button>`:`<button type="button" class="link-button" data-entry-action="edit" data-id="${esc(entry.id)}">修改</button>${entry.kind==='expense'?`<button type="button" class="link-button" data-entry-action="refund" data-id="${esc(entry.id)}">登记退款</button>`:''}<button type="button" class="link-button" data-entry-action="delete" data-id="${esc(entry.id)}">删除</button>`;
    return `<article class="finance-entry ${amount.length>10?'has-long-amount':''} ${deleted?'is-deleted':''}" data-entry-id="${esc(entry.id)}"><div class="finance-entry-copy"><div class="finance-entry-heading"><h3>${esc(title)}</h3><span class="finance-entry-tag kind-${esc(entry.kind)}">${esc(FINANCE_KINDS[entry.kind]||'账目')}</span><span class="finance-entry-tag finance-entry-tag-category">${esc(categoryName(entry.categoryId))}</span>${deleted?'<span class="finance-entry-tag">已删除</span>':''}</div>${entry.note?`<p>${esc(entry.note)}</p>`:''}${entry.refundOf?'<small>已关联原支出</small>':''}</div><div class="finance-entry-end"><strong class="finance-entry-amount kind-${esc(entry.kind)}">${entryMoney(entry)}</strong></div><div class="finance-entry-footer">${receiptIds.length?`<button type="button" class="link-button finance-receipt-link" data-receipt-open="${esc(receiptIds[0])}">查看截图 · ${receiptIds.length} 张</button>`:'<span class="finance-entry-no-receipt">未附截图</span>'}<div class="finance-entry-actions">${actions}</div></div></article>`;
  }
  function renderEntries(){
    const list=$('[data-finance-entries]',container),groups=new Map();for(const entry of entries){if(!groups.has(entry.date))groups.set(entry.date,[]);groups.get(entry.date).push(entry)}
    render(list,entries.length?[...groups].map(([date,rows])=>`<section class="finance-day-group"><div class="finance-section-title"><h2>${esc(date)}</h2><span>${rows.length} 笔</span></div>${rows.map(entryHtml).join('')}</section>`).join(''):`<div class="finance-empty"><span aria-hidden="true">¥</span><h3>${daily?'这一天还没有入账':'这一页还没有账目'}</h3><p>${daily?'可以记下真实花销，或明确标记今天零支出。':'从一笔真实的收支开始，也可以调整筛选条件。'}</p></div>`);
    const more=$('[data-finance-more]',container);if(more)more.hidden=!cursor;
  }
  function renderSummary(){
    const summary=data?.summary||{},summaries=$('[data-finance-summary]',container);
    render(summaries,daily?`<span>今日净支出</span><strong>¥${money(summary.netExpenseCents)}</strong><small>${data?.day?.state==='zero'?'已确认今日零支出':data?.day?.state==='recorded'||summary.count?'账目已单独保存':'尚未记录，和零支出不同'}</small>`:`${[['本月收入',summary.incomeCents,'income'],['本月净支出',summary.netExpenseCents,'expense'],['收支差额',summary.balanceCents,'balance']].map(([label,value,type])=>`<div class="finance-stat finance-stat-${type}"><span>${label}</span><strong><small>¥</small>${money(value)}</strong><p>${type==='expense'?'支出减去已登记退款':type==='balance'?'收入减去净支出，不代表账户余额':`${Number(summary.count)||0} 笔有效流水`}</p></div>`).join('')}`);
    if(daily)return;
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
    if(daily||!alive()||!selectedDay)return;
    const date=selectedDay,month=filters.month,owner={};dayOwner=owner;
    const current=()=>alive()&&dayOwner===owner&&selectedDay===date&&filters.month===month;
    dayPie?.setData({loading:true,error:'',totals:[]});
    const retry=$('[data-finance-day-retry]',container);if(retry)retry.hidden=true;
    try{
      const result=await request(`/api/finance?date=${encodeURIComponent(date)}`,{},current);if(!current())return;
      dayPie?.setData({totals:result.expenseCategoryTotals||[],refundCents:result.summary?.refundCents||0,netExpenseCents:result.summary?.netExpenseCents||0,title:`${date} 每日花销`,loading:false,error:''});
    }catch(error){if(current()){dayPie?.setData({loading:false,error:error.message||'当天花销暂时未能读取。'});if(retry)retry.hidden=false}}
  }
  function syncDailyChart(){
    if(daily)return;
    if(chartMonth!==filters.month||!selectedDay.startsWith(filters.month)){
      chartMonth=filters.month;selectedDay=defaultChartDay();
      dayPicker?.setMonth?.(filters.month);dayPicker?.setValue?.(selectedDay);
    }
    dayPicker?.setDisabled?.(pending);return loadDailyChart();
  }
  async function load(append=false){
    if(!alive())return;const owner={};loadOwner=owner;const current=()=>alive()&&loadOwner===owner;
    if(!append){cursor=null;const more=$('[data-finance-more]',container);if(more)more.hidden=true;}
    const params=query();if(append&&cursor)params.set('cursor',cursor);status(append?'正在读取更早的账目…':'正在整理账目…');
    try{const byDay=!daily&&filters.range==='day';const [result,monthly]=await Promise.all([request(`/api/finance?${params}`,{},current),byDay?request(`/api/finance?month=${encodeURIComponent(filters.month)}`,{},current):Promise.resolve(null)]);if(!current())return;data=monthly||result;categories=result.categories||categories;entries=append?[...entries,...(result.entries||[])]:result.entries||[];cursor=result.nextCursor||null;renderSummary();renderEntries();syncDailyChart();
      if(!noFormLoss()){const host=$('[data-finance-form]',container);mountQuickEntry(host)}else updateCategories();refreshQuick?.();
      status(daily?'确认入账后，账目已保存；复盘仍可保留为草稿。':`明细显示 ${byDay?filters.date:filters.month+' 整月'}；上方总计与月度饼图仍按整月计算。`);
    }catch(error){if(current()){status(error.message||'账目暂时未能读取。',true);if(!daily){monthPie?.setData({loading:false,error:'当月花销暂时未能读取，请刷新账本重试。'});dayPie?.setData({loading:false,error:'请先重新读取当月账本。'});dayOwner=null}const list=$('[data-finance-entries]',container);if(!data)render(list,'<div class="finance-empty"><h3>暂时没有翻开账本</h3><button class="btn" type="button" data-finance-retry>重新读取</button></div>')}}
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
      try{const {loadReceiptUrls}=options.receiptClient||await import('./receipt-client.js?v=1.0.0-finance17');if(!accepted())return;const urls=await loadReceiptUrls([receiptId],'image',{request,isCurrent:accepted});if(!accepted())return;const url=safeImageUrl(urls[receiptId]);if(!url)throw new Error('这张截图暂时无法读取，请检查凭证存储后重试。');message.textContent='正在载入截图…';image.src=url;image.hidden=false}
      catch(error){failed(error)}finally{if(accepted()){loading=false;retry.disabled=false}}
    }
    function changeImage(offset){
      if(!current())return;const target=index+offset;if(target<0||target>=receiptIds.length)return;
      index=target;previous.disabled=index===0;next.disabled=index===receiptIds.length-1;position.textContent=`${index+1} / ${receiptIds.length}`;loadImage(true);
    }
    previous.addEventListener('click',()=>changeImage(-1));next.addEventListener('click',()=>changeImage(1));
    retry.addEventListener('click',()=>loadImage());await loadImage();
  }
  function openEdit(entry,refund=false){
    const value=refund?{date:options.today(),kind:'refund',expression:money(entry.amountCents).replaceAll(',',''),purpose:`退回：${entry.purpose||categoryName(entry.categoryId)}`,categoryId:entry.categoryId,refundOf:entry.id,receiptIds:[]}:entry;
    options.openModal?.(`<div class="modal-head"><div><h2>${refund?'登记退款':'修改账目'}</h2><p>${refund?'到账后再登记，退款会从净支出中扣除。':'保留更正后的金额、分类和用途。'}</p></div></div><form id="finance-edit-form" class="finance-entry-form">${entryForm(value,{edit:!refund,modal:true,original:entry})}</form><button class="link-button" type="button" data-cancel-attach hidden>取消截图处理</button>`,'workspace-dialog finance-dialog finance-detail-dialog');
    const form=container.ownerDocument.querySelector('#finance-edit-form');if(form)bindForm(form,value,{edit:!refund,modal:true,original:entry});
  }
  function confirmDelete(entry){
    options.openModal?.(`<div class="modal-head"><div><h2>删除这笔账目？</h2><p>${esc(entry.purpose||categoryName(entry.categoryId))} · ¥${money(entry.amountCents)}。删除后不再计入统计，可以在已删除记录中恢复。</p></div></div><form id="finance-delete-form"><fieldset><p class="error-text" data-form-error role="status"></p><div class="modal-actions"><button class="btn" type="button" data-close>保留</button><button class="btn btn-danger" type="submit">删除账目</button></div></fieldset></form>`,'workspace-dialog');
    const form=container.ownerDocument.querySelector('#finance-delete-form');form?.addEventListener('submit',event=>{event.preventDefault();write(form,async current=>{await request(`/api/finance/entries/${encodeURIComponent(entry.id)}`,{method:'DELETE',body:{version:entry.version}},current);if(current()){options.closeModal?.(true);await load();notify('账目已移入已删除记录。','success')}})});
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
      const clearTest=()=>{if(!current()||pending)return;message.textContent='配置已修改，请重新测试当前输入。';message.classList.remove('is-success');error.textContent='';confirmation.hidden=true};form.addEventListener('input',clearTest);form.addEventListener('change',clearTest);
      $('[data-storage-test]',form).addEventListener('click',()=>{if(!current()||pending)return;const body=payload();error.textContent='';message.textContent='正在测试当前输入的存储连接…';message.classList.remove('is-success');write(form,async accepted=>{try{await request('/api/finance/storage/test',{method:'POST',body},()=>current()&&accepted())}catch(error){if(current()&&accepted())message.textContent='测试未通过，当前输入和已保存的配置均保留。';throw error}if(!current()||!accepted())return;message.textContent='服务端读写测试通过，测试文件已清理。当前输入尚未保存；网页跨域和图片校验仍需实际上传验证。';message.classList.add('is-success')})});
      $('[data-storage-delete]',form).addEventListener('click',()=>{if(current()&&!pending){confirmation.hidden=false;error.textContent='';$('[data-storage-delete-cancel]',form).focus()}});
      $('[data-storage-delete-cancel]',form).addEventListener('click',()=>{if(current()&&!pending){confirmation.hidden=true;$('[data-storage-delete]',form).focus()}});
      $('[data-storage-delete-apply]',form).addEventListener('click',()=>{if(!current()||pending)return;write(form,async accepted=>{await request('/api/finance/storage',{method:'DELETE',body:{version:saved.version}},()=>current()&&accepted());if(!current()||!accepted())return;options.closeModal?.(true);await loadStorage();notify('图片存储配置已删除，账目和S3图片保留。重新连接原存储后可查看已有凭证。','success')})});
      form.addEventListener('submit',event=>{event.preventDefault();if(!current()||pending)return;const body=payload();write(form,async accepted=>{await request('/api/finance/storage',{method:'PUT',body},()=>current()&&accepted());if(!current()||!accepted())return;options.closeModal?.(true);await loadStorage();const note=$('[data-storage-note]',container);if(note)note.textContent='图片存储配置已保存。请先保存未入账内容，再刷新页面使图片访问权限生效。';notify('图片存储配置已保存，请保存未入账内容并刷新页面后上传截图。','success')})});
    }catch(error){if(visitCurrent())notify(error.message,'error')}
  }

  function openMatchedExpenses(planned,result){
    const legacyIds=planned.length?[...(draft.receiptIds||[])]:[],previousIds=[...legacyIds,...planned.flatMap(row=>row.attemptedBody?.receiptIds||[])],combined={...result,receiptIds:[...new Set([...(result.receiptIds||[]),...previousIds])]};
    const matched=matchFinanceReceipts(planned.map(row=>({...row,receiptIds:row.attemptedBody?.receiptIds||[]})),combined),allowed=new Set(combined.receiptIds);
    const rows=matched.rows.map((row,index)=>({...row,receiptIds:[...new Set([...(row.attemptedBody?.receiptIds||row.receiptIds),...(!index&&!row.attemptedBody?legacyIds:[])])]})),receipts=matched.receipts;
    const number=receiptId=>(receipts.find(receipt=>receipt.id===receiptId)?.index??0)+1;
    const reasons={'duplicate-row-amount':'有多笔相同金额，请手动匹配','multiple-receipts':'多张截图金额相同，请手动匹配','amount-mismatch':'识别金额不同，请手动匹配','unrecognized-amount':'未识别到金额，请手动匹配','invalid-amount':'请先检查金额'};
    options.openModal?.(`<div class="modal-head"><div><h2>核对花销与截图</h2><p>金额和用途按你的填写保留。相同金额或未识别的截图，请手动选择对应关系。</p></div></div>${(result.warnings||[]).length?`<div class="finance-import-warnings">${result.warnings.map(value=>`<p>${esc(value)}</p>`).join('')}</div>`:''}<form id="finance-match-form"><fieldset><div class="finance-match-rows">${rows.map((row,index)=>`<section class="finance-match-row" data-match-row="${esc(row.id)}"><div class="finance-match-heading"><div><h3>${esc(row.purpose)}</h3><span>${esc(row.categoryId?categoryName(row.categoryId):financeCategoryLabel(row.purpose,categories))}</span></div><strong>¥${money(row.amountCents)}</strong></div><p class="help" data-match-reason>${row.attemptedBody?'提交结果待确认，重试时保留原金额与截图。':row.matchReason==='amount'?'已按唯一金额自动匹配。':esc(reasons[row.matchReason]||'请选择对应截图。')}</p><details class="finance-match-options" ${row.receiptIds.length?'':'open'}><summary data-match-summary>${row.receiptIds.length?row.receiptIds.map(value=>`截图 ${number(value)}`).join('、'):'选择对应截图'}</summary><div>${receipts.map(receipt=>`<label class="finance-checkbox"><input type="checkbox" name="match-${index}" value="${esc(receipt.id)}" ${row.receiptIds.includes(receipt.id)?'checked':''} ${row.attemptedBody?'disabled':''}>截图 ${receipt.index+1}<small>${receipt.amounts.length?receipt.amounts.map(value=>`¥${money(value)}`).join(' / '):'未识别金额'}${receipt.duplicate?' · 已上传过':''}</small></label>`).join('')}</div></details><p class="finance-import-result" data-match-result></p></section>`).join('')}</div><section class="finance-match-images"><h3>本次截图</h3>${receipts.map(receipt=>`<div class="finance-match-image"><div><span>截图 ${receipt.index+1}</span><span>${receipt.amounts.length?receipt.amounts.map(value=>`¥${money(value)}`).join(' / '):'金额待手动核对'}</span><button type="button" class="link-button" data-match-preview="${esc(receipt.id)}">查看截图</button></div><div data-match-image="${esc(receipt.id)}" hidden></div></div>`).join('')}</section><label class="finance-checkbox finance-match-unused" data-match-unused hidden><input type="checkbox" name="acknowledge-unused"><span data-match-unused-copy></span></label><p class="error-text" data-form-error role="status" aria-live="polite"></p><div class="modal-actions"><button type="button" class="btn" data-close>返回修改</button><button type="submit" class="btn btn-primary">确认匹配并入账</button></div></fieldset></form>`,'workspace-dialog finance-dialog finance-import-dialog finance-match-dialog');
    const form=container.ownerDocument.querySelector('#finance-match-form');if(!form)return;
    const live=()=>alive()&&form.isConnected&&container.ownerDocument.querySelector('#finance-match-form')===form;
    const update=()=>{
      const values=new FormData(form),used=new Set();
      for(const [index,row] of rows.entries()){
        if(!row.attemptedBody&&!row.done)row.receiptIds=[...new Set(values.getAll(`match-${index}`).map(String))].filter(value=>allowed.has(value));
        for(const receiptId of row.receiptIds)used.add(receiptId);
        const section=$(`[data-match-row="${row.id}"]`,form);$('[data-match-reason]',section).textContent=row.attemptedBody?'提交结果待确认，重试时保留原金额与截图。':row.receiptIds.length?(row.matchReason==='amount'?'已按唯一金额自动匹配。':'已手动匹配，请核对所选截图。'):(reasons[row.matchReason]||'请选择对应截图。');$('[data-match-summary]',section).textContent=row.receiptIds.length?row.receiptIds.map(value=>`截图 ${number(value)}`).join('、'):'选择对应截图';
      }
      const unused=receipts.filter(receipt=>!used.has(receipt.id));$('[data-match-unused]',form).hidden=!unused.length;
      $('[data-match-unused-copy]',form).textContent=`截图 ${unused.map(receipt=>receipt.index+1).join('、')} 未关联本次账目，我确认暂不用于入账。`;
      return unused;
    };
    form.addEventListener('change',event=>{if(live()&&!pending&&event.target.name.startsWith('match-')){const row=rows[Number(event.target.name.slice(6))];if(row&&!row.attemptedBody)row.matchReason='manual';form.elements['acknowledge-unused'].checked=false;update()}});
    const previewOwners=new Map();
    form.addEventListener('click',async event=>{
      const button=event.target.closest('[data-match-preview]');if(!button||!live()||pending)return;const receiptId=button.dataset.matchPreview,host=$(`[data-match-image="${receiptId}"]`,form),owner={};previewOwners.set(receiptId,owner);
      if(!host.hidden){host.hidden=true;return}host.hidden=false;render(host,'<p class="help" role="status">正在读取截图…</p>');
      const current=()=>live()&&!host.hidden&&previewOwners.get(receiptId)===owner;
      try{const module=options.receiptClient||await import('./receipt-client.js?v=1.0.0-finance17');if(!current())return;const urls=await module.loadReceiptUrls([receiptId],'image',{request,isCurrent:current});if(!current())return;const url=safeImageUrl(urls[receiptId]);if(!url)throw new Error('截图暂时无法读取，请点击重新查看。');render(host,`<img src="${esc(url)}" alt="截图 ${number(receiptId)}，用于核对花销" loading="lazy">`);const image=$('img',host);image.addEventListener('error',()=>{if(current())render(host,'<p class="help">图片未能载入，请收起后重新查看。</p>')},{once:true})}
      catch(error){if(current())render(host,`<p class="help" role="status">${esc(error.message||'截图读取失败，请重试。')}</p>`)}
    });
    update();
    form.addEventListener('submit',event=>{
      event.preventDefault();if(!live()||pending)return;const unused=update(),error=$('[data-form-error]',form),remaining=rows.filter(row=>!row.done);
      const missing=remaining.find(row=>!row.receiptIds.length||row.receiptIds.length>10||row.receiptIds.some(value=>!allowed.has(value)));
      if(missing){error.textContent=!missing.receiptIds.length?`请为“${missing.purpose}”选择对应截图。`:'每笔最多关联10张有效截图。';const section=$(`[data-match-row="${missing.id}"]`,form);$('details',section).open=true;return}
      if(unused.length&&!form.elements['acknowledge-unused'].checked){error.textContent='还有截图未关联账目，请先匹配，或确认这些截图暂不入账。';return}
      error.textContent='';write(form,async current=>{
        let committed=0;
        try{for(const row of remaining){
          const original=quickRows.find(item=>item.id===row.id);if(!original)throw new Error('待记花销已变化，请返回后重新核对。');
          const first=quickRows[0]===original,body=row.attemptedBody||{id:row.id,date:day,kind:'expense',expression:row.expression,purpose:row.purpose,categoryId:row.categoryId||'',note:first?draft.note||'':'',receiptIds:[...row.receiptIds],source:daily?'daily':'finance'};
          row.attemptedBody=body;original.attemptedBody=body;original.attempted=true;original.receiptIds=[...body.receiptIds];
          const section=$(`[data-match-row="${row.id}"]`,form);for(const control of $$('input',section))control.disabled=true;
          refreshQuick?.();try{await request('/api/finance/entries',{method:'POST',body},()=>current()&&live())}catch(error){if(error.status===400&&current()&&live()){delete row.attemptedBody;delete original.attemptedBody;original.attempted=false;const latest=quickRows.find(item=>item.id===row.id);if(latest){delete latest.attemptedBody;latest.attempted=false;}for(const control of $$('input',section))control.disabled=false;refreshQuick?.()}throw error}if(!current()||!live())return;
          row.done=true;$('[data-match-result]',section).textContent='已入账';section.dataset.matchDone='true';
          const quick=$('[data-finance-create]',container),lines=quick.elements.text.value.split(/\r\n?|\n/);lines.splice(original.line-1,1);quick.elements.text.value=lines.join('\n');quickRows=quickRows.filter(item=>item.id!==original.id);
          if(first){draft.note='';draft.receiptIds=[];draft.categoryId=''}draft={...draft,text:quick.elements.text.value,expression:'',purpose:''};committed++;changed();refreshQuick?.();
        }
        if(current()&&live()){await load();if(!current()||!live())return;options.closeModal?.(true);lastMatchResult=null;notify('截图已匹配，花销已入账。','success')}
        }finally{if(committed&&current()){await load();notify(`已入账 ${committed} 笔。`,'success')}}
      });
    });
  }

  function importPreview(candidates,warnings=[],{manual=false}={}){
    const normalize=candidate=>{let duplicate=candidate.duplicate===true;try{const amount=parseMoneyExpression(candidate.expression);duplicate ||= entries.some(entry=>!entry.deletedAt&&entry.date===(candidate.date||day)&&entry.kind===(candidate.kind||'expense')&&entry.amountCents===amount)}catch{}return {...candidate,duplicate,id:id(),receiptIds:candidate.receiptIds||[],categoryChosen:false,categoryId:automaticCategory(candidate.purpose,categories,candidate.kind)}};
    const rows=candidates.map(candidate=>normalize({...candidate,manual}));
    const rowFields=(row,index)=>`<div class="finance-import-row-head"><label class="finance-checkbox"><input name="select-${index}" type="checkbox" ${row.kind!=='expense'||row.duplicate?'':'checked'}>第 ${index+1} 笔${row.duplicate?' · 疑似重复，确认仍需保留时勾选':''}${!row.manual&&row.confidence!=='high'?' · 请仔细核对':''}</label><button class="link-button" type="button" data-import-remove="${index}" aria-label="移除第 ${index+1} 笔">移除</button></div><div class="finance-form-top"><label>日期<input name="date-${index}" type="date" value="${esc(row.date||day)}" required></label><input type="hidden" name="kind-${index}" value="expense"><div class="finance-income-kind"><span>类型</span><strong>支出</strong></div></div><div class="finance-money-row"><label>金额 / 算式<input name="expression-${index}" value="${esc(row.expression||'')}" inputmode="decimal" maxlength="240" placeholder="例如 8+8+8-1"><output data-import-calculation aria-live="polite"></output></label><label>用途<input name="purpose-${index}" value="${esc(row.purpose||'')}" maxlength="160" placeholder="例如 早餐、打车"></label></div><label>分类<select data-finance-compact name="category-${index}">${categoryOptions(categories,row.categoryId,'',row.kind)}</select><span class="help" data-import-category-hint>${esc(row.purpose?`自动分类：${financeCategoryLabel(row.purpose,categories,row.kind)}`:'根据用途自动分类')}</span></label><label>备注（选填）<input name="note-${index}" value="${esc(row.note||'')}" maxlength="500"></label>${row.kind!=='expense'?'<p class="help">这张截图可能是收入或退款，请从收入记账或原支出退款入口登记。</p>':''}${row.receiptIds?.length?`<p class="finance-import-receipt-note">已附 ${row.receiptIds.length} 张压缩截图 · 确认入账后可在收支明细查看</p>`:'<p class="help">截图未保存，不能确认支出。</p>'}${row.warnings?.length?`<p class="help">${row.warnings.map(esc).join('；')}</p>`:''}<p class="finance-import-result" data-import-result></p>`;
    options.openModal?.(`<div class="modal-head"><div><h2>${manual?'记下多笔收支':'核对截图账目'}</h2><p>${manual?'逐行填写金额和用途，可以增加或移除行，核对后再确认入账。':'识别可能有误，请核对日期、金额和分类，再确认入账。'}</p></div></div>${warnings.length?`<div class="finance-import-warnings" role="status">${warnings.map(warning=>`<p>${esc(warning)}</p>`).join('')}</div>`:''}<form id="finance-import-form"><fieldset><div class="finance-import-rows">${rows.map((row,index)=>`<section class="finance-import-row" data-import-index="${index}">${rowFields(row,index)}</section>`).join('')}</div><p class="error-text" data-form-error role="status"></p><div class="modal-actions"><button class="btn" type="button" data-close>取消</button><button class="btn btn-primary" type="submit">确认选中账目入账</button></div></fieldset></form>`,'workspace-dialog finance-dialog finance-import-dialog');
    const form=container.ownerDocument.querySelector('#finance-import-form');if(!form)return;
    const editable=()=>alive()&&form.isConnected&&!pending;
    const refreshCalculation=section=>{const index=Number(section.dataset.importIndex),text=form.elements[`expression-${index}`].value.trim(),output=$('[data-import-calculation]',section);try{const amount=parseMoneyExpression(text);output.textContent=amount>0?`合计 ¥${money(amount)}`:'入账金额需要大于 0';output.classList.toggle('is-error',amount<=0)}catch{output.textContent=text?'请检查算式，只支持数字、小数、加减。':'输入金额，自动计算合计';output.classList.toggle('is-error',Boolean(text))}};
    const updateRowActions=()=>{const count=rows.filter(row=>!row.removed).length;for(const section of $$('[data-import-index]',form))$('[data-import-remove]',section).disabled=count<=1||rows[Number(section.dataset.importIndex)].done===true};
    let suggesting=false;
    const suggestRow=(index)=>{if(rows[index].categoryChosen)return;const select=form.elements[`category-${index}`];select.value=automaticCategory(form.elements[`purpose-${index}`].value,categories,form.elements[`kind-${index}`].value)||'';const hint=$('[data-import-category-hint]',select.closest('[data-import-index]'));if(hint)hint.textContent=`自动分类：${financeCategoryLabel(form.elements[`purpose-${index}`].value,categories,form.elements[`kind-${index}`].value)}`;suggesting=true;select.dispatchEvent(new Event('change',{bubbles:true}));suggesting=false};
    form.addEventListener('input',event=>{if(!editable())return;const section=event.target.closest('[data-import-index]');if(!section)return;const index=Number(section.dataset.importIndex);if(event.target.name===`purpose-${index}`)suggestRow(index);refreshCalculation(section)});
    form.addEventListener('change',event=>{if(!editable()||suggesting)return;const section=event.target.closest('[data-import-index]');if(!section)return;const index=Number(section.dataset.importIndex);if(event.target.name===`category-${index}`)rows[index].categoryChosen=true;if(event.target.name===`kind-${index}`)suggestRow(index)});
    form.addEventListener('click',event=>{
      if(!editable())return;const button=event.target.closest('button');

      if(button?.matches('[data-import-remove]')){const index=Number(button.dataset.importRemove);if(rows[index]?.done||rows[index]?.attemptedBody||rows.filter(row=>!row.removed).length<=1)return;const section=button.closest('[data-import-index]'),neighbor=section.nextElementSibling||section.previousElementSibling;rows[index].removed=true;render(section,'');section.remove();updateRowActions();$('input[name^="expression-"]',neighbor)?.focus()}
    });
    for(const section of $$('[data-import-index]',form))refreshCalculation(section);updateRowActions();
    form.addEventListener('submit',event=>{event.preventDefault();if(!editable())return;const values=new FormData(form),selected=rows.flatMap((row,index)=>!row.removed&&!row.done&&(row.attemptedBody||values.get(`select-${index}`)==='on')?[{row,index,body:row.attemptedBody||{id:row.id,date:String(values.get(`date-${index}`)||day),kind:'expense',expression:String(values.get(`expression-${index}`)||''),purpose:String(values.get(`purpose-${index}`)||''),categoryId:String(values.get(`category-${index}`)||''),receiptIds:row.receiptIds,note:String(values.get(`note-${index}`)||''),source:daily?'daily':'finance'}}]:[]);
      if(!selected.length){$('[data-form-error]',form).textContent='请至少选择一笔待入账记录。';return}
      try{for(const item of selected){if(!item.row.receiptIds?.length)throw new Error(`第 ${item.index+1} 笔未保存截图，请配置图片存储后重新上传。`);if(item.row.receiptIds.length>10)throw new Error(`第 ${item.index+1} 笔最多关联10张截图，请减少图片后重试。`);if(item.row.kind!=='expense')throw new Error('收入或退款截图请使用对应记账入口。');if(parseMoneyExpression(item.body.expression)<=0)throw new Error(`请检查第 ${item.index+1} 笔金额。`)}}catch(error){$('[data-form-error]',form).textContent=error.message;return}
      write(form,async current=>{for(const item of selected){
        item.row.attemptedBody=item.body;const locked=$(`[data-import-index="${item.index}"]`,form);for(const control of $$('input,select,button',locked))control.disabled=true;
        try{await request('/api/finance/entries',{method:'POST',body:item.body},current)}catch(error){
          // A definitive validation rejection committed nothing; let this row be
          // corrected. Uncertain failures keep their original idempotent payload.
          if(error.status===400&&current()){delete item.row.attemptedBody;for(const control of $$('input,select,button',locked))control.disabled=false;updateRowActions()}
          throw error;
        }
        if(!current())return;const section=$(`[data-import-index="${item.index}"]`,form);item.row.done=true;$('[data-import-result]',section).textContent='已入账';for(const control of $$('input,select,button',section))control.disabled=true;section.dataset.importDone='true';
      }if(current()){options.closeModal?.(true);await load();notify('选中账目已入账。','success')}});
    });
  }
  async function importFiles(files){
    if(!files?.length||pending||!alive())return;
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
        status('正在本地读取截图…');receiptModule=options.receiptClient||await import('./receipt-client.js?v=1.0.0-finance17');if(!active())return;
        const task=receiptModule.processReceiptFiles(files,{request,isCurrent:active,signal:owner.signal,categories,date:day,upload:true,onProgress:progress=>{if(active())status(typeof progress==='string'?progress:progress?.message||'正在本地识别截图…')}});
        const result=await Promise.race([task,new Promise((_,reject)=>{onAbort=()=>reject(new DOMException('已取消图片处理','AbortError'));owner.signal.addEventListener('abort',onAbort,{once:true});if(owner.signal.aborted)onAbort()})]);if(!active())return;
        if(result.imageStatus!=='stored'||!result.receiptIds?.length)throw new Error('截图尚未保存，不能确认支出。请先在图片存储设置中配置并测试S3，再重新上传。');
        lastMatchResult=result;
        if(planned.length){status('截图已保存，请核对花销与截图的匹配关系。');openMatchedExpenses(planned,result);return}
        const candidates=result.candidates?.length?result.candidates.map(candidate=>({...candidate,receiptIds:(candidate.receiptIds||[]).filter(value=>result.receiptIds.includes(value))})):[{date:day,expression:'',purpose:'',kind:'expense',categoryId:'',receiptIds:result.receiptIds||[],confidence:0}];
        if(candidates.length===1&&!candidates[0].receiptIds?.length)candidates[0].receiptIds=result.receiptIds||[];
        status(result.receiptIds?.length?`已上传 ${result.receiptIds.length} 张压缩截图，尚未入账。请核对并确认，入账后在明细点击“查看截图”。`:'截图已识别，未保存图片。请核对后确认入账。');importPreview(candidates,result.warnings||[]);
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
    if(button.matches('[data-entry-action]')){const entry=entries.find(row=>row.id===button.dataset.id);if(!entry)return;const action=button.dataset.entryAction;if(action==='edit')openEdit(entry);if(action==='refund')openEdit(entry,true);if(action==='delete')confirmDelete(entry);if(action==='restore')write(button,async current=>{await request(`/api/finance/entries/${encodeURIComponent(entry.id)}/restore`,{method:'POST',body:{version:entry.version}},current);if(current()){await load();notify('账目已恢复。','success')}})}
  }
  function mount(){
    if(daily){render(container,`<div class="finance-daily"><div class="finance-day-summary" data-finance-summary><span>今日净支出</span><strong>—</strong><small>正在读取当天账目</small></div><div data-finance-form class="finance-entry-form"></div><div class="finance-daily-tools"><button class="btn btn-ghost" type="button" data-finance-detail>收入记账</button><button class="btn btn-ghost" type="button" data-day-zero>今天没有花销</button><button class="link-button" type="button" data-finance-storage>图片存储设置</button></div><p class="help" data-storage-note></p><p class="finance-status" data-finance-status role="status" aria-live="polite"></p><button type="button" class="btn btn-ghost" data-cancel-import hidden>取消截图处理</button><div data-finance-entries></div><button class="btn btn-ghost" type="button" data-finance-more hidden>加载更早记录</button><input data-finance-files type="file" accept="image/png,image/jpeg,image/webp" multiple hidden></div>`)}
    else render(container,`<section class="workspace-page finance-page" aria-labelledby="finance-page-title"><header class="finance-page-head"><div><h1 id="finance-page-title">财务收支</h1><p>把每一笔写清楚，让花销有迹可循。</p></div><div class="finance-hero-art" aria-hidden="true"><img src="/assets/finance/ledger.webp?v=1.0.0-finance2" alt="" width="640" height="640" draggable="false"></div></header><div class="finance-month-line"><div data-finance-period></div><button class="link-button" type="button" data-finance-refresh>刷新账本</button></div><div class="finance-summary" data-finance-summary></div><section class="finance-writing"><div class="finance-section-title"><h2>记下花销</h2><span>记入 ${esc(day)} · 人民币</span></div><div data-finance-form class="finance-entry-form"></div><div class="finance-daily-tools"><button class="btn btn-ghost" type="button" data-finance-detail>收入记账</button></div></section><div class="finance-insights"><section class="finance-insight"><div class="finance-chart-heading"><h2>月度花销</h2><span>按分类看整月支出</span></div><div data-finance-month-pie></div></section><section class="finance-insight"><div class="finance-chart-heading"><h2>每日花销</h2><div data-finance-day-picker></div></div><div data-finance-day-pie></div><button type="button" class="link-button" data-finance-day-retry hidden>重新读取当天花销</button></section></div><section class="finance-ledger"><div class="finance-section-title"><h2>收支明细</h2><button class="link-button" type="button" data-finance-storage>图片存储设置</button></div><form class="finance-filters" data-finance-filters role="search"><label>搜索用途<span class="finance-search-field"><input name="q" type="search" maxlength="160" placeholder="搜索用途或备注"><button class="link-button" type="button" data-finance-clear-search aria-label="清空用途搜索" hidden>清空</button></span></label><label>收支类型<select data-finance-compact name="kind"><option value="">全部类型</option>${Object.entries(FINANCE_KINDS).map(([key,label])=>`<option value="${key}">${esc(label)}</option>`).join('')}</select></label><label>显示范围<select data-finance-compact name="range"><option value="month">整月明细</option><option value="day">单日明细</option></select></label><label class="finance-checkbox"><input name="deleted" type="checkbox">包含已删除</label></form><div class="finance-ledger-date" data-finance-ledger-date-row hidden><span>明细日期</span><div data-finance-ledger-day-picker></div></div><p class="help" data-storage-note></p><p class="finance-status" data-finance-status role="status" aria-live="polite"></p><button type="button" class="btn btn-ghost" data-cancel-import hidden>取消截图处理</button><div data-finance-entries></div><button class="btn btn-ghost finance-more" type="button" data-finance-more hidden>加载更早记录</button></section><input data-finance-files type="file" accept="image/png,image/jpeg,image/webp" multiple hidden></section>`);
    container.addEventListener('click',onClick);
    $('[data-finance-files]',container).addEventListener('change',event=>{const files=[...event.target.files];event.target.value='';importFiles(files)});
    container.addEventListener('paste',onPaste);
    const period=$('[data-finance-period]',container);if(period&&options.showMonthPicker)periodController=options.showMonthPicker(period,{value:filters.month,today:options.today(),isCurrent:alive,onChange:value=>{if(!alive()||pending||value===filters.month)return;filters.month=value;if(!filters.date.startsWith(value+'-'))filters.date=defaultChartDay();ledgerDayPicker?.setMonth?.(value);ledgerDayPicker?.setValue?.(filters.date);dayOwner=null;dayPicker?.setMonth?.(value);dayPicker?.setDisabled?.(true);dayPie?.setData({loading:true,error:'',totals:[]});monthPie?.setData({loading:true,error:'',totals:[]});load()}});
    if(!daily){
      monthPie=options.showFinancePie?.($('[data-finance-month-pie]',container),{title:'月度花销',loading:true});
      dayPie=options.showFinancePie?.($('[data-finance-day-pie]',container),{title:'每日花销',loading:true});
      selectedDay=options.today();
      dayPicker=options.showFinanceDayPicker?.($('[data-finance-day-picker]',container),{value:selectedDay,month:filters.month,today:options.today(),isCurrent:alive,onChange:value=>{if(!alive()||pending||value===selectedDay||!value.startsWith(filters.month+'-'))return;selectedDay=value;loadDailyChart()}});
      ledgerDayPicker=options.showFinanceDayPicker?.($('[data-finance-ledger-day-picker]',container),{value:filters.date,month:filters.month,today:options.today(),label:'明细日期',isCurrent:alive,onChange:value=>{if(!alive()||pending||filters.range!=='day'||value===filters.date||!value.startsWith(filters.month+'-'))return;filters.date=value;load()}});
      $('[data-finance-day-retry]',container)?.addEventListener('click',()=>{if(alive()&&!pending)loadDailyChart()});
    }
    const filterForm=$('[data-finance-filters]',container);let composingSearch=false;
    const applySearch=()=>{if(!filterForm||pending)return;filters.q=filterForm.elements.q.value;$('[data-finance-clear-search]',filterForm).hidden=!filters.q;clearTimeout(searchTimer);searchTimer=setTimeout(()=>load(),220)};
    filterForm?.addEventListener('submit',event=>{event.preventDefault();if(pending||composingSearch||event.isComposing)return;clearTimeout(searchTimer);filters.q=filterForm.elements.q.value;load()});
    filterForm?.addEventListener('change',event=>{if(pending)return;const values=new FormData(filterForm);filters.kind=String(values.get('kind')||'');filters.deleted=values.get('deleted')==='on';filters.range=values.get('range')==='day'?'day':'month';$('[data-finance-ledger-date-row]',container).hidden=filters.range!=='day';if(event.target.name!=='q')load()});
    filterForm?.addEventListener('compositionstart',event=>{if(event.target.name==='q'){composingSearch=true;clearTimeout(searchTimer)}});
    filterForm?.addEventListener('compositionend',event=>{if(event.target.name==='q'){composingSearch=false;applySearch()}});
    filterForm?.addEventListener('input',event=>{if(event.target.name!=='q'||pending)return;$('[data-finance-clear-search]',filterForm).hidden=!event.target.value;if(composingSearch||event.isComposing)return;applySearch()});
    filterForm?.addEventListener('click',event=>{if(!event.target.closest('[data-finance-clear-search]')||pending)return;composingSearch=false;clearTimeout(searchTimer);const search=filterForm.elements.q;search.value='';filters.q='';$('[data-finance-clear-search]',filterForm).hidden=true;search.focus();load()});
    mountQuickEntry($('[data-finance-form]',container));load();loadStorage();
  }
  function onPaste(event){const files=[...(event.clipboardData?.files||[])].filter(file=>file.type.startsWith('image/'));if(files.length&&!pending){event.preventDefault();importFiles(files)}}
  mount();return {dispose(){disposed=true;periodController?.dispose?.();dayPicker?.dispose?.();ledgerDayPicker?.dispose?.();monthPie?.dispose?.();dayPie?.dispose?.();dayOwner=null;loadOwner=null;storageOwner=null;aborter.abort();receiptModule?.disposeReceiptWorker?.();clearTimeout(searchTimer);container.removeEventListener('click',onClick);container.removeEventListener('paste',onPaste)},hasPendingDraft:()=>hasDraft(draft)};
}

export function mountFinancePage(container,options){return createWorkspace(container,options,false)}

export function mountDailyFinance(container,options){
  if(options.readonly){const snapshot=options.snapshot,render=options.renderMarkup;render(container,snapshot?`<section class="finance-daily finance-day-readonly"><div class="finance-day-summary"><span>复盘时记录的净支出</span><strong>¥${money(snapshot.netExpenseCents)}</strong><small>${snapshot.state==='zero'?'当日已确认零支出':snapshot.state==='unrecorded'?'当时未记录花销':`${Number(snapshot.count)||0} 笔账目`} · 锁定后保留当时摘要</small></div>${(snapshot.entries||[]).map(entry=>`<div class="finance-snapshot-entry"><span>${esc(entry.purpose||entry.categoryName||'账目')}<small>${esc(entry.categoryName||'')} · ${esc(FINANCE_KINDS[entry.kind]||'')}</small></span><strong>¥${money(entry.amountCents)}</strong></div>`).join('')}<p class="help">账本后续可以订正，这份复盘仍保留提交时的记录。</p></section>`:'<p class="help">这份历史复盘没有记录财务摘要。</p>');return {dispose(){},hasPendingDraft:()=>false}}
  return createWorkspace(container,options,true);
}
