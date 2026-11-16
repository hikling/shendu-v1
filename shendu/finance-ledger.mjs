import {createHash,randomUUID} from 'node:crypto';
import {DEFAULT_FINANCE_CATEGORIES,FINANCE_KINDS,parseMoneyExpression,suggestFinanceCategory} from './public/finance-domain.js';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_AMOUNT=99_999_999_999,MAX_ENTRIES=50000,MAX_CATEGORIES=100,MAX_FINANCE_BYTES=32*1024*1024;
const problem=(message,code='finance_invalid',status=400)=>Object.assign(new Error(message),{status,code});
const plain=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const text=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const stamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
const version=value=>Number.isSafeInteger(value)&&value>=1&&value<=100000000;
const canonical=value=>JSON.stringify(value);
const digest=value=>createHash('sha256').update(canonical(value)).digest('hex');
const baseIds=new Set(DEFAULT_FINANCE_CATEGORIES.map(item=>item.id));

export function normalizeFinanceDraft(value){
  if(!plain(value))return null;
  const draft={text:typeof value.text==='string'?value.text.slice(0,6000):'',expression:text(value.expression,200),purpose:text(value.purpose,160),categoryId:text(value.categoryId,100),note:text(value.note,1000),receiptIds:[]};
  if(Array.isArray(value.receiptIds))draft.receiptIds=[...new Set(value.receiptIds.filter(id=>typeof id==='string'&&UUID.test(id)))].slice(0,10);
  return draft;
}
export const financeDraftPending=value=>Boolean(value&&(text(value.text,6000)||text(value.expression,200)||text(value.purpose,160)||text(value.note,1000)||(Array.isArray(value.receiptIds)&&value.receiptIds.length)));

export function createFinanceLedger({db,encryptData,decryptData,dataScope,now,readJson,json,today,withActivity,verifyReceipts=()=>true}){
  db.exec(`
    CREATE TABLE IF NOT EXISTS finance_entries (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,id TEXT NOT NULL,date TEXT NOT NULL,
      data TEXT NOT NULL,create_hash TEXT NOT NULL,version INTEGER NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,deleted_at TEXT,
      PRIMARY KEY(user_id,id)
    );
    CREATE INDEX IF NOT EXISTS idx_finance_entry_date ON finance_entries(user_id,date DESC,id DESC);
    CREATE TABLE IF NOT EXISTS finance_categories (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,id TEXT NOT NULL,data TEXT NOT NULL,
      version INTEGER NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(user_id,id)
    );
    CREATE TABLE IF NOT EXISTS finance_days (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,date TEXT NOT NULL,data TEXT NOT NULL,
      version INTEGER NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(user_id,date)
    );
  `);
  const decodeEntry=row=>row?{id:row.id,...decryptData(row.data,dataScope('finance-entry',row.user_id,row.id)),version:row.version,createdAt:row.created_at,updatedAt:row.updated_at,deletedAt:row.deleted_at}:null;
  const find=(userId,id)=>db.prepare('SELECT * FROM finance_entries WHERE user_id=? AND id=?').get(userId,id);
  const categories=userId=>{
    const stored=db.prepare('SELECT * FROM finance_categories WHERE user_id=? ORDER BY created_at,id').all(userId);
    const result=new Map(DEFAULT_FINANCE_CATEGORIES.map(item=>[item.id,{...item,keywords:[...item.keywords],active:true,version:0}]));
    for(const row of stored)result.set(row.id,{id:row.id,...decryptData(row.data,dataScope('finance-category',userId,row.id)),version:row.version,createdAt:row.created_at,updatedAt:row.updated_at});
    return [...result.values()];
  };
  const entryData=(value,userId,{allowArchived=false,providedCategories=null}={})=>{
    if(!plain(value)||!validDate(value.date)||!Object.hasOwn(FINANCE_KINDS,value.kind)||typeof value.expression!=='string'||value.expression.length>200)throw problem('请填写有效日期、收支类型和金额');
    let amountCents;try{amountCents=parseMoneyExpression(value.expression)}catch{throw problem('金额只支持最多两位小数的数字和加减运算','finance_amount_invalid')}
    if(!Number.isSafeInteger(amountCents)||amountCents<=0||amountCents>MAX_AMOUNT)throw problem('金额必须大于零且不超过金额上限','finance_amount_invalid');
    const list=providedCategories||categories(userId),purpose=text(value.purpose,160),categoryId=text(value.categoryId,100)||suggestFinanceCategory(purpose,list,value.kind)||'uncategorized';
    const category=list.find(item=>item.id===categoryId);
    if(!category||(!allowArchived&&!category.active))throw problem('请选择有效的花销类别','finance_category_invalid');
    if(!purpose)throw problem('请填写这笔账的用途','finance_purpose_required');
    if(value.receiptIds!==undefined&&(!Array.isArray(value.receiptIds)||value.receiptIds.length>10||value.receiptIds.some(id=>typeof id!=='string'||!UUID.test(id))))throw problem('凭证关联无效','finance_receipt_invalid');
    const receiptIds=[...new Set(value.receiptIds||[])];
    const refundOf=value.kind==='refund'?text(value.refundOf,100):null;
    if(value.kind==='refund'&&!UUID.test(refundOf))throw problem('退款需要关联原支出','finance_refund_invalid');
    return {date:value.date,kind:value.kind,expression:value.expression.trim(),amountCents,purpose,categoryId,note:text(value.note,1000),refundOf,receiptIds,source:value.source==='daily'?'daily':'finance'};
  };
  const assertVersion=(body,row)=>{if(!version(body.version))throw problem('请提供有效的账目版本','finance_version_invalid');if(body.version!==row.version)throw problem('这笔账已在其他设备更新，请刷新后再操作','version_conflict',409)};
  const allEntries=userId=>db.prepare('SELECT * FROM finance_entries WHERE user_id=? ORDER BY date DESC,id DESC').all(userId).map(decodeEntry);
  const assertRefunds=(userId,entry,ownId,deleted=false)=>{
    const rows=allEntries(userId),children=rows.filter(item=>!item.deletedAt&&item.kind==='refund'&&item.refundOf===ownId&&item.id!==ownId);
    if(children.length&&(deleted||entry.kind!=='expense'||children.reduce((sum,item)=>sum+item.amountCents,0)>entry.amountCents))throw problem('这笔支出已有退款，请先订正关联退款','finance_refund_conflict',409);
    if(!deleted&&entry.kind==='refund'){
      if(entry.refundOf===ownId)throw problem('退款不能关联自身','finance_refund_invalid');
      const original=rows.find(item=>item.id===entry.refundOf&&!item.deletedAt&&item.kind==='expense');
      if(!original)throw problem('原支出不存在或不属于当前账户','finance_refund_invalid');
      const paid=rows.filter(item=>item.id!==ownId&&!item.deletedAt&&item.kind==='refund'&&item.refundOf===entry.refundOf).reduce((sum,item)=>sum+item.amountCents,0);
      if(paid+entry.amountCents>original.amountCents)throw problem('累计退款不能超过原支出','finance_refund_exceeded',409);
    }
  };
  const writeEntry=(userId,id,value,row=null,deletedAt=null,createHash=null)=>{
    const time=now(),revision=row?row.version+1:1,data=encryptData(value,dataScope('finance-entry',userId,id));
    const storedBytes=db.prepare('SELECT COALESCE(SUM(length(CAST(data AS BLOB))),0) AS n FROM finance_entries WHERE user_id=?').get(userId).n;
    if(storedBytes-Buffer.byteLength(row?.data||'')+Buffer.byteLength(data)>MAX_FINANCE_BYTES)throw problem('账目内容超过账户存储上限','finance_storage_limit',413);
    if(row)db.prepare('UPDATE finance_entries SET date=?,data=?,version=?,updated_at=?,deleted_at=? WHERE user_id=? AND id=? AND version=?').run(value.date,data,revision,time,deletedAt,userId,id,row.version);
    else db.prepare('INSERT INTO finance_entries(user_id,id,date,data,create_hash,version,created_at,updated_at,deleted_at) VALUES(?,?,?,?,?,1,?,?,?)').run(userId,id,value.date,data,createHash||digest(value),time,time,deletedAt);
    return decodeEntry(find(userId,id));
  };
  const transact=(userId,action,date,write)=>withActivity(userId,action,{period:date},write);
  const summaryOf=entries=>{
    const result={incomeCents:0,expenseCents:0,refundCents:0,netExpenseCents:0,balanceCents:0,count:entries.length};
    for(const item of entries){if(item.kind==='income')result.incomeCents+=item.amountCents;if(item.kind==='expense')result.expenseCents+=item.amountCents;if(item.kind==='refund')result.refundCents+=item.amountCents}
    result.netExpenseCents=result.expenseCents-result.refundCents;result.balanceCents=result.incomeCents-result.netExpenseCents;return result;
  };
  const dayState=(userId,date,entries)=>{
    const row=db.prepare('SELECT * FROM finance_days WHERE user_id=? AND date=?').get(userId,date);
    const saved=row?decryptData(row.data,dataScope('finance-day',userId,date)):null;
    return {date,state:entries.some(item=>!item.deletedAt&&item.kind!=='transfer')?'recorded':saved?.state==='zero'?'zero':'unrecorded',version:row?.version||0};
  };
  function snapshot(userId,date){
    const entries=db.prepare('SELECT * FROM finance_entries WHERE user_id=? AND date=? AND deleted_at IS NULL ORDER BY id').all(userId,date).map(decodeEntry),list=categories(userId);
    return {date,state:dayState(userId,date,entries).state,...summaryOf(entries),entries:entries.map(item=>({id:item.id,kind:item.kind,amountCents:item.amountCents,purpose:item.purpose,categoryName:list.find(category=>category.id===item.categoryId)?.name||'待分类'})),capturedAt:now()};
  }
  async function handle(req,res,url,user){
    const path=url.pathname,method=req.method;
    if(path==='/api/finance'&&method==='GET'){
      const date=url.searchParams.get('date'),month=url.searchParams.get('month')||today().slice(0,7),kind=url.searchParams.get('kind'),category=url.searchParams.get('category'),q=(url.searchParams.get('q')||'').trim().slice(0,160),cursor=url.searchParams.get('cursor'),includeDeleted=url.searchParams.get('deleted')==='1';
      if(date!==null&&!validDate(date))throw problem('请选择有效的账目日期');
      if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw problem('请选择有效月份');
      if(kind&&!Object.hasOwn(FINANCE_KINDS,kind))throw problem('收支类型无效');
      if(cursor&&!UUID.test(cursor))throw problem('账目分页位置无效','finance_cursor_invalid');
      const rows=date?db.prepare('SELECT * FROM finance_entries WHERE user_id=? AND date=? ORDER BY date DESC,id DESC').all(user.id,date):db.prepare('SELECT * FROM finance_entries WHERE user_id=? AND date>=? AND date<=? ORDER BY date DESC,id DESC').all(user.id,month+'-01',month+'-31');
      const decoded=rows.map(decodeEntry),active=decoded.filter(item=>!item.deletedAt),list=categories(user.id),needle=q.toLocaleLowerCase();
      let matching=decoded.filter(item=>(includeDeleted||!item.deletedAt)&&(!kind||item.kind===kind)&&(!category||item.categoryId===category)&&(!needle||`${item.purpose} ${item.note} ${list.find(value=>value.id===item.categoryId)?.name||''}`.toLocaleLowerCase().includes(needle)));
      if(cursor){const anchor=matching.findIndex(item=>item.id===cursor);if(anchor<0)throw problem('账目分页已变化，请重新加载','finance_cursor_not_found',404);matching=matching.slice(anchor+1)}
      const entries=matching.slice(0,50),trendMap=new Map(),totals=new Map(),expenseTotals=new Map();
      for(const item of active){
        const point=trendMap.get(item.date)||{date:item.date,expenseCents:0,incomeCents:0,spendingCents:0};
        if(item.kind==='expense'){point.expenseCents+=item.amountCents;point.spendingCents+=item.amountCents;expenseTotals.set(item.categoryId,(expenseTotals.get(item.categoryId)||0)+item.amountCents)}if(item.kind==='refund')point.expenseCents-=item.amountCents;if(item.kind==='income')point.incomeCents+=item.amountCents;
        trendMap.set(item.date,point);
        if(item.kind==='expense'||item.kind==='refund')totals.set(item.categoryId,(totals.get(item.categoryId)||0)+(item.kind==='refund'?-1:1)*item.amountCents);
      }
      json(res,200,{entries,categories:list,summary:summaryOf(active),expenseCategoryTotals:[...expenseTotals].map(([categoryId,cents])=>({categoryId,name:list.find(value=>value.id===categoryId)?.name||'待分类',cents})).sort((a,b)=>b.cents-a.cents||a.categoryId.localeCompare(b.categoryId)),trend:[...trendMap.values()].sort((a,b)=>a.date.localeCompare(b.date)),categoryTotals:[...totals].map(([categoryId,cents])=>({categoryId,name:list.find(value=>value.id===categoryId)?.name||'待分类',cents})).sort((a,b)=>b.cents-a.cents),nextCursor:matching.length>50?entries.at(-1).id:null,...(date?{day:dayState(user.id,date,active)}:{})});return true;
    }
    if(path==='/api/finance/entries'&&method==='POST'){
      const body=await readJson(req);if(!UUID.test(String(body.id||'')))throw problem('账目编号无效');
      const existing=find(user.id,body.id),value=entryData(body,user.id,{allowArchived:Boolean(existing)}),hash=digest(value);
      if(existing){if(existing.create_hash!==hash)throw problem('这笔账的编号已被使用，请刷新后再试','finance_id_conflict',409);json(res,200,{entry:decodeEntry(existing),duplicate:true});return true}
      if(db.prepare('SELECT COUNT(*) AS n FROM finance_entries WHERE user_id=?').get(user.id).n>=MAX_ENTRIES)throw problem('账目数量已达到上限','finance_entry_limit',413);
      if(!verifyReceipts(user.id,value.receiptIds))throw problem('凭证尚未上传或不属于当前账户','finance_receipt_invalid');
      const entry=transact(user.id,'finance_entry_created',value.date,()=>{assertRefunds(user.id,value,body.id);return writeEntry(user.id,body.id,value,null,null,hash)});
      json(res,201,{entry});return true;
    }
    const entryMatch=/^\/api\/finance\/entries\/([^/]+)(\/restore)?$/.exec(path);
    if(entryMatch&&['PUT','DELETE','POST'].includes(method)){
      const body=await readJson(req),id=entryMatch[1],row=find(user.id,id);if(!row)throw problem('账目不存在','finance_entry_not_found',404);
      const previous=decodeEntry(row);assertVersion(body,row);
      if(method==='POST'&&!entryMatch[2]||method!=='POST'&&entryMatch[2])return false;
      const restoring=method==='POST',deleting=method==='DELETE';
      if(restoring&&!row.deleted_at)throw problem('这笔账无需恢复','finance_not_deleted',409);
      if(!restoring&&row.deleted_at)throw problem('这笔账已删除，请先恢复','finance_deleted',409);
      const value=method==='PUT'?entryData(body,user.id,{allowArchived:body.categoryId===previous.categoryId}):entryData(previous,user.id,{allowArchived:true});
      if(!verifyReceipts(user.id,value.receiptIds))throw problem('凭证尚未上传或不属于当前账户','finance_receipt_invalid');
      const entry=transact(user.id,deleting?'finance_entry_deleted':restoring?'finance_entry_restored':'finance_entry_updated',value.date,()=>{assertRefunds(user.id,value,id,deleting);return writeEntry(user.id,id,value,row,deleting?now():null)});
      json(res,200,{entry});return true;
    }
    if(path==='/api/finance/categories'&&method==='POST'||/^\/api\/finance\/categories\/[^/]+$/.test(path)&&method==='PUT'){
      const body=await readJson(req),id=method==='POST'?body.id:path.split('/').at(-1),list=categories(user.id),previous=list.find(item=>item.id===id);
      if(method==='POST'&&(!UUID.test(String(id||''))||previous))throw problem('分类编号无效或已存在');
      if(method==='PUT'&&!previous)throw problem('分类不存在','finance_category_not_found',404);
      if(previous){if(!Number.isSafeInteger(body.version)||body.version<0)throw problem('分类版本无效','finance_version_invalid');if(body.version!==previous.version)throw problem('分类已更新，请刷新后再试','version_conflict',409)}
      if(method==='POST'&&list.length>=MAX_CATEGORIES)throw problem('最多保存100个分类');
      const name=text(body.name,30),keywords=Array.isArray(body.keywords)?[...new Set(body.keywords.map(value=>text(value,30)).filter(Boolean))].slice(0,30):[];
      if(!name||list.some(item=>item.id!==id&&item.name===name))throw problem('分类名称不能为空或重复');
      const value={name,keywords,active:body.active!==false};if(id==='uncategorized'&&!value.active)throw problem('待分类不能停用');
      const time=now(),revision=(previous?.version||0)+1;
      transact(user.id,'finance_category_updated',null,()=>db.prepare('INSERT INTO finance_categories(user_id,id,data,version,created_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,id) DO UPDATE SET data=excluded.data,version=excluded.version,updated_at=excluded.updated_at').run(user.id,id,encryptData(value,dataScope('finance-category',user.id,id)),revision,previous?.createdAt||time,time));
      json(res,method==='POST'?201:200,{category:categories(user.id).find(item=>item.id===id)});return true;
    }
    if(path==='/api/finance/day'&&method==='POST'){
      const body=await readJson(req);if(!validDate(body.date)||!['zero','unrecorded'].includes(body.state))throw problem('请提供有效日期和记录状态');
      const entries=db.prepare('SELECT * FROM finance_entries WHERE user_id=? AND date=? AND deleted_at IS NULL').all(user.id,body.date).map(decodeEntry);
      if(body.state==='zero'&&entries.some(item=>['expense','refund'].includes(item.kind)))throw problem('这一天已有花销账目，不能标为零支出','finance_zero_conflict',409);
      transact(user.id,'finance_day_updated',body.date,()=>db.prepare('INSERT INTO finance_days(user_id,date,data,version,updated_at) VALUES(?,?,?,1,?) ON CONFLICT(user_id,date) DO UPDATE SET data=excluded.data,version=finance_days.version+1,updated_at=excluded.updated_at').run(user.id,body.date,encryptData({state:body.state},dataScope('finance-day',user.id,body.date)),now()));
      json(res,200,{day:dayState(user.id,body.date,entries)});return true;
    }
    return false;
  }
  function exportUser(userId){
    return {version:1,entries:db.prepare('SELECT * FROM finance_entries WHERE user_id=? ORDER BY id').all(userId).map(row=>({...decodeEntry(row),createHash:row.create_hash})),categories:db.prepare('SELECT * FROM finance_categories WHERE user_id=? ORDER BY id').all(userId).map(row=>({id:row.id,...decryptData(row.data,dataScope('finance-category',userId,row.id)),version:row.version,createdAt:row.created_at,updatedAt:row.updated_at})),days:db.prepare('SELECT * FROM finance_days WHERE user_id=? ORDER BY date').all(userId).map(row=>({date:row.date,...decryptData(row.data,dataScope('finance-day',userId,row.date)),version:row.version,updatedAt:row.updated_at}))};
  }
  function validateImport(value){
    if(!plain(value)||value.version!==1||!Array.isArray(value.entries)||value.entries.length>MAX_ENTRIES||!Array.isArray(value.categories)||value.categories.length>MAX_CATEGORIES||!Array.isArray(value.days)||value.days.length>MAX_ENTRIES)throw problem('备份中的财务结构无效','finance_backup_invalid');
    const ids=new Set(),categoryIds=new Set(),dates=new Set(),list=DEFAULT_FINANCE_CATEGORIES.map(item=>({...item,active:true}));
    const clean={version:1,entries:[],categories:[],days:[]};
    for(const item of value.categories){
      if(!plain(item)||(!UUID.test(String(item.id||''))&&!baseIds.has(item.id))||categoryIds.has(item.id)||!version(item.version)||!stamp(item.createdAt)||!stamp(item.updatedAt)||typeof item.name!=='string'||!item.name.trim()||item.name.length>30||!Array.isArray(item.keywords)||item.keywords.length>30||item.keywords.some(key=>typeof key!=='string'||!key.trim()||key.length>30)||typeof item.active!=='boolean')throw problem('备份中的财务分类无效','finance_backup_invalid');
      categoryIds.add(item.id);const normalized={id:item.id,name:item.name,keywords:[...new Set(item.keywords)],active:item.active,version:item.version,createdAt:stamp(item.createdAt),updatedAt:stamp(item.updatedAt)};
      if(normalized.id==='uncategorized'&&!normalized.active)throw problem('备份中的待分类无效','finance_backup_invalid');
      clean.categories.push(normalized);const index=list.findIndex(category=>category.id===item.id);if(index<0)list.push(normalized);else list[index]=normalized;
    }
    if(new Set(list.map(item=>item.name)).size!==list.length)throw problem('备份中存在重复财务分类','finance_backup_invalid');
    for(const item of value.entries){
      if(!plain(item)||!UUID.test(String(item.id||''))||ids.has(item.id)||!version(item.version)||!stamp(item.createdAt)||!stamp(item.updatedAt)||(item.deletedAt!==null&&!stamp(item.deletedAt))||typeof item.createHash!=='string'||!/^[0-9a-f]{64}$/.test(item.createHash))throw problem('备份中的账目无效','finance_backup_invalid');
      const data=entryData(item,null,{allowArchived:true,providedCategories:list});if(item.amountCents!==data.amountCents)throw problem('备份中的账目金额不一致','finance_backup_invalid');
      ids.add(item.id);clean.entries.push({id:item.id,...data,version:item.version,createdAt:stamp(item.createdAt),updatedAt:stamp(item.updatedAt),deletedAt:item.deletedAt?stamp(item.deletedAt):null,createHash:item.createHash});
    }
    for(const item of clean.entries){
      if(item.kind!=='refund')continue;
      const original=clean.entries.find(entry=>entry.id===item.refundOf);if(!original||original.id===item.id)throw problem('备份中的退款关联无效','finance_backup_invalid');
      if(!item.deletedAt){if(original.kind!=='expense'||original.deletedAt)throw problem('备份中的退款关联已删除或已更正的支出','finance_backup_invalid');const total=clean.entries.filter(entry=>!entry.deletedAt&&entry.kind==='refund'&&entry.refundOf===original.id).reduce((sum,entry)=>sum+entry.amountCents,0);if(total>original.amountCents)throw problem('备份中的退款超过支出','finance_backup_invalid')}
    }
    for(const item of value.days){if(!plain(item)||!validDate(item.date)||dates.has(item.date)||!['zero','unrecorded'].includes(item.state)||!version(item.version)||!stamp(item.updatedAt))throw problem('备份中的花销日期状态无效','finance_backup_invalid');dates.add(item.date);clean.days.push({date:item.date,state:item.state,version:item.version,updatedAt:stamp(item.updatedAt)})}
    return clean;
  }
  function importUser(userId,value,{replace=false}={}){
    const clean=validateImport(value);
    if(replace)db.prepare('DELETE FROM finance_entries WHERE user_id=?').run(userId),db.prepare('DELETE FROM finance_categories WHERE user_id=?').run(userId),db.prepare('DELETE FROM finance_days WHERE user_id=?').run(userId);
    for(const item of clean.categories){
      const row=db.prepare('SELECT * FROM finance_categories WHERE user_id=? AND id=?').get(userId,item.id),old=row?{...decryptData(row.data,dataScope('finance-category',userId,item.id)),version:row.version,createdAt:row.created_at,updatedAt:row.updated_at,id:item.id}:null;
      if(old){if(old.version>item.version||old.updatedAt>item.updatedAt)continue;if(old.version===item.version){if(canonical(old)!==canonical(item)&&digest({name:old.name,keywords:old.keywords,active:old.active})!==digest({name:item.name,keywords:item.keywords,active:item.active}))throw problem('分类备份与当前版本冲突','finance_import_conflict',409);continue}}
      db.prepare('INSERT INTO finance_categories(user_id,id,data,version,created_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,id) DO UPDATE SET data=excluded.data,version=excluded.version,created_at=excluded.created_at,updated_at=excluded.updated_at').run(userId,item.id,encryptData({name:item.name,keywords:item.keywords,active:item.active},dataScope('finance-category',userId,item.id)),item.version,item.createdAt,item.updatedAt);
    }
    for(const item of clean.entries){
      const row=find(userId,item.id),old=decodeEntry(row),{id,version:revision,createdAt,updatedAt,deletedAt,createHash,...data}=item;
      if(old){if(old.deletedAt&&!deletedAt)continue;if(old.version>revision||old.updatedAt>updatedAt)continue;if(old.version===revision){const {version:oldVersion,createdAt:oldCreated,updatedAt:oldUpdated,deletedAt:oldDeleted,id:oldId,...oldData}=old;if(digest(oldData)!==digest(data)||oldDeleted!==deletedAt)throw problem('账目备份与当前版本冲突','finance_import_conflict',409);continue}}
      db.prepare('INSERT INTO finance_entries(user_id,id,date,data,create_hash,version,created_at,updated_at,deleted_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,id) DO UPDATE SET date=excluded.date,data=excluded.data,create_hash=excluded.create_hash,version=excluded.version,created_at=excluded.created_at,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at').run(userId,id,data.date,encryptData(data,dataScope('finance-entry',userId,id)),createHash,revision,createdAt,updatedAt,deletedAt);
    }
    for(const item of clean.days){const row=db.prepare('SELECT * FROM finance_days WHERE user_id=? AND date=?').get(userId,item.date);if(row&&(row.version>item.version||row.updated_at>item.updatedAt))continue;if(row&&row.version===item.version){if(decryptData(row.data,dataScope('finance-day',userId,item.date)).state!==item.state)throw problem('花销日期状态备份冲突','finance_import_conflict',409);continue}db.prepare('INSERT INTO finance_days(user_id,date,data,version,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,date) DO UPDATE SET data=excluded.data,version=excluded.version,updated_at=excluded.updated_at').run(userId,item.date,encryptData({state:item.state},dataScope('finance-day',userId,item.date)),item.version,item.updatedAt)}
    if(db.prepare('SELECT COUNT(*) AS n FROM finance_entries WHERE user_id=?').get(userId).n>MAX_ENTRIES)throw problem('恢复后的账目超过账户上限','finance_entry_limit',413);
    if(db.prepare('SELECT COALESCE(SUM(length(CAST(data AS BLOB))),0) AS n FROM finance_entries WHERE user_id=?').get(userId).n>MAX_FINANCE_BYTES)throw problem('恢复后的账目内容超过账户存储上限','finance_storage_limit',413);
    // Validate the combined graph as well as the incoming graph: merges can mix revisions.
    validateImport(exportUser(userId));
    return clean.entries.length;
  }
  return {handle,snapshot,exportUser,validateImport,importUser,categories};
}
