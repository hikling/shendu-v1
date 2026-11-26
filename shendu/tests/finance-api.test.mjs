import {after,before,test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtempSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,randomUUID,createCipheriv,createDecipheriv,pbkdf2Sync,createHash} from 'node:crypto';
import {receiptStorageIdentity} from '../finance-receipts.mjs';
import {gzipSync,gunzipSync} from 'node:zlib';
import net from 'node:net';
import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';

const appDir=fileURLToPath(new URL('../',import.meta.url)),tempParent=realpathSync(tmpdir()),root=mkdtempSync(join(tempParent,'shendu-finance-api-'));
const password='finance-api-'+randomBytes(16).toString('hex'),backupPassword='finance-backup-'+randomBytes(16).toString('hex');
let child,base,ownerCookie,db,index=0;
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date()),month=today.slice(0,7);
async function api(path,{method='GET',body,auth=ownerCookie}={}){
  const response=await fetch(base+path,{method,headers:{...(auth?{Cookie:auth}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
  const text=await response.text();let value;try{value=JSON.parse(text)}catch{value=text}
  return{status:response.status,value,text,cookie:response.headers.get('set-cookie')?.split(';')[0],csp:response.headers.get('content-security-policy')};
}
async function account(){const username=`finance_member_${++index}`,created=await api('/api/admin/users',{method:'POST',body:{username,password}});assert.equal(created.status,201,created.text);const login=await api('/api/auth/login',{method:'POST',auth:'',body:{username,password}});assert.equal(login.status,200,login.text);const me=await api('/api/me',{auth:login.cookie});return{username,cookie:login.cookie,id:me.value.user.id}}
const input=(extra={})=>({id:randomUUID(),date:today,kind:'expense',expression:'8+8+8-1',purpose:'早餐',categoryId:'food',note:'',receiptIds:[],...extra});
async function create(auth,extra={}){const body=input(extra),result=await api('/api/finance/entries',{method:'POST',auth,body});assert.equal(result.status,201,result.text);return result.value.entry}
async function ledger(auth,query=''){const result=await api('/api/finance?month='+month+query,{auth});assert.equal(result.status,200,result.text);return result.value}
function legacyDeletion(userId,id){
  const time=new Date().toISOString();
  assert.equal(db.prepare('UPDATE finance_entries SET deleted_at=?,updated_at=?,version=version+1 WHERE user_id=? AND id=?').run(time,time,userId,id).changes,1);
}
function clearBackup(text){const {tag,data,...header}=JSON.parse(text),key=pbkdf2Sync(backupPassword,Buffer.from(header.kdf.salt,'base64'),600000,32,'sha256'),decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(header.cipher.iv,'base64'));decipher.setAAD(Buffer.from(JSON.stringify(header)));decipher.setAuthTag(Buffer.from(tag,'base64'));return JSON.parse(gunzipSync(Buffer.concat([decipher.update(Buffer.from(data,'base64')),decipher.final()])))}
function sealBackup(text,clear){const {tag,data,...header}=JSON.parse(text);header.kdf.salt=randomBytes(16).toString('base64');header.cipher.iv=randomBytes(12).toString('base64');const cipher=createCipheriv('aes-256-gcm',pbkdf2Sync(backupPassword,Buffer.from(header.kdf.salt,'base64'),600000,32,'sha256'),Buffer.from(header.cipher.iv,'base64'));cipher.setAAD(Buffer.from(JSON.stringify(header)));const encrypted=Buffer.concat([cipher.update(gzipSync(Buffer.from(JSON.stringify(clear)))),cipher.final()]);return JSON.stringify({...header,tag:cipher.getAuthTag().toString('base64'),data:encrypted.toString('base64')})}
before(async()=>{
  const listener=net.createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));base=`http://127.0.0.1:${port}`;
  child=spawn(process.execPath,['server.mjs'],{cwd:appDir,env:{...process.env,SHENDU_PORT:String(port),SHENDU_DATA_DIR:root,SHENDU_MASTER_KEY:'',SHENDU_MASTER_KEY_PATH:join(root,'backup-master.key'),SHENDU_SECURE_COOKIE:'false'},stdio:['ignore','pipe','pipe']});
  let logs='';child.stdout.on('data',value=>{logs+=value});child.stderr.on('data',value=>{logs+=value});let ready=false;
  for(let i=0;i<200&&!ready;i++){try{ready=(await fetch(base+'/healthz')).ok}catch{}if(!ready)await new Promise(resolve=>setTimeout(resolve,20))}assert.ok(ready,logs);
  const registered=await api('/api/auth/register',{method:'POST',auth:'',body:{username:'finance_owner',password}});assert.equal(registered.status,201,registered.text);ownerCookie=registered.cookie;db=new DatabaseSync(join(root,'shendu.db'));db.exec('PRAGMA busy_timeout=5000');
});
after(async()=>{db?.close();if(child&&child.exitCode===null){const stopped=once(child,'exit');child.kill('SIGTERM');await stopped}assert.equal(dirname(realpathSync(root)),tempParent);assert.ok(basename(root).startsWith('shendu-finance-api-'));rmSync(root,{recursive:true,force:true})});

test('finance exact cents, encrypted storage, account isolation and retry idempotency',async()=>{
  const a=await account(),b=await account(),body=input(),created=await api('/api/finance/entries',{method:'POST',auth:a.cookie,body});assert.equal(created.status,201,created.text);assert.equal(created.value.entry.amountCents,2300);
  const row=db.prepare('SELECT * FROM finance_entries WHERE user_id=? AND id=?').get(a.id,body.id);assert.match(row.data,/^sd1\./);assert.doesNotMatch(row.data,/早餐|2300/);
  const events=db.prepare("SELECT count(*) AS n FROM activity_events WHERE user_id=? AND action='finance_entry_created'").get(a.id).n;
  const replay=await api('/api/finance/entries',{method:'POST',auth:a.cookie,body});assert.equal(replay.status,200,replay.text);assert.equal(replay.value.duplicate,true);assert.equal(replay.value.entry.version,1);assert.equal(db.prepare("SELECT count(*) AS n FROM activity_events WHERE user_id=? AND action='finance_entry_created'").get(a.id).n,events);
  assert.equal((await api('/api/finance/entries',{method:'POST',auth:a.cookie,body:{...body,expression:'24'}})).status,409);
  assert.equal((await api('/api/finance/entries/'+body.id,{method:'DELETE',auth:b.cookie,body:{version:1}})).status,404);
  assert.equal((await ledger(b.cookie)).entries.length,0);assert.deepEqual((await ledger(b.cookie)).expenseCategoryTotals,[]);
  assert.equal((await api('/api/finance/entries',{method:'POST',auth:b.cookie,body})).status,201,'UUIDs cannot leak another account');
  for(const expression of ['0','-1','1.001','1/2','1e2','999999999999','process.exit()'])assert.equal((await api('/api/finance/entries',{method:'POST',auth:a.cookie,body:input({expression})})).status,400,expression);
  assert.equal(db.prepare("SELECT value FROM schema_meta WHERE key='schema_version'").get().value,'9');
  const activity=await api('/api/activity',{auth:a.cookie});assert.doesNotMatch(JSON.stringify(activity.value),/早餐|2300|amountCents|expression/);
});

test('posted entries are locked for every kind, while historical tombstones remain viewable',async()=>{
  const a=await account(),expense=await create(a.cookie),path=entry=>'/api/finance/entries/'+entry.id;
  const income=await create(a.cookie,{kind:'income',purpose:'工资',categoryId:'salary'});
  const refund=await create(a.cookie,{kind:'refund',purpose:'退款',expression:'5',refundOf:expense.id});
  const transfer=await create(a.cookie,{kind:'transfer',purpose:'转账'});
  const before=await ledger(a.cookie),events=db.prepare('SELECT count(*) n FROM activity_events WHERE user_id=?').get(a.id).n;
  for(const entry of [expense,income,refund,transfer]){
    for(const method of ['PUT','DELETE']){
      const response=await api(path(entry),{method,auth:a.cookie,body:{...entry,expression:'42',version:entry.version}});
      assert.equal(response.status,409,response.text);assert.equal(response.value.error,'finance_entry_locked');
    }
  }
  assert.deepEqual(await ledger(a.cookie),before);
  assert.equal(db.prepare('SELECT count(*) n FROM activity_events WHERE user_id=?').get(a.id).n,events);
  legacyDeletion(a.id,income.id);
  const restore=await api(path(income)+'/restore',{method:'POST',auth:a.cookie,body:{version:2}});
  assert.equal(restore.status,409,restore.text);assert.equal(restore.value.error,'finance_entry_locked');
  assert.equal((await ledger(a.cookie)).summary.incomeCents,0);
  assert.ok((await ledger(a.cookie,'&deleted=1')).entries.find(item=>item.id===income.id).deletedAt);
});

test('refunds are owned, bounded and atomic; income and transfers have distinct summary semantics',async()=>{
  const a=await account(),b=await account(),expense=await create(a.cookie,{expression:'100'}),foreign=await create(b.cookie,{expression:'100'});
  await create(a.cookie,{kind:'income',expression:'500',purpose:'工资',categoryId:'salary'});await create(a.cookie,{kind:'transfer',expression:'1000',purpose:'银行卡互转',categoryId:'uncategorized'});
  assert.equal((await api('/api/finance/entries',{method:'POST',auth:a.cookie,body:input({kind:'refund',expression:'1',refundOf:foreign.id})})).status,400);
  const refund=await create(a.cookie,{kind:'refund',expression:'40',purpose:'退回早餐款',refundOf:expense.id});
  const rejected=await api('/api/finance/entries',{method:'POST',auth:a.cookie,body:input({kind:'refund',expression:'61',refundOf:expense.id})});assert.equal(rejected.status,409,rejected.text);
  assert.equal((await api('/api/finance/entries/'+expense.id,{method:'DELETE',auth:a.cookie,body:{version:1}})).status,409);
  assert.equal((await api('/api/finance/entries/'+expense.id,{method:'PUT',auth:a.cookie,body:{...expense,expression:'39',version:1}})).status,409);
  const current=await ledger(a.cookie);assert.deepEqual(current.summary,{incomeCents:50000,expenseCents:10000,refundCents:4000,netExpenseCents:6000,balanceCents:44000,count:4});
  assert.equal(current.categoryTotals.find(item=>item.categoryId==='food').cents,6000);assert.deepEqual(current.expenseCategoryTotals,[{categoryId:'food',name:'餐饮',cents:10000}]);
  assert.equal(current.entries.find(item=>item.id===refund.id).refundOf,expense.id);
  assert.deepEqual(current.entries.find(item=>item.id===expense.id),expense);
});

test('custom categories archive rather than remove historic labels, with exact versions',async()=>{
  const a=await account(),id=randomUUID(),created=await api('/api/finance/categories',{method:'POST',auth:a.cookie,body:{id,name:'宠物',keywords:['猫粮','狗粮']}});assert.equal(created.status,201,created.text);
  await create(a.cookie,{purpose:'猫粮',categoryId:id});const archived=await api('/api/finance/categories/'+id,{method:'PUT',auth:a.cookie,body:{version:1,name:'宠物',keywords:['猫粮'],active:false}});assert.equal(archived.status,200,archived.text);
  assert.equal((await api('/api/finance/entries',{method:'POST',auth:a.cookie,body:input({categoryId:id})})).status,400);
  const view=await ledger(a.cookie,'&q='+encodeURIComponent('宠物'));assert.equal(view.entries.length,1);assert.equal(view.categories.find(item=>item.id===id).active,false);
  const defaultEdit=await api('/api/finance/categories/food',{method:'PUT',auth:a.cookie,body:{version:0,name:'吃饭',keywords:['早餐'],active:true}});assert.equal(defaultEdit.status,200,defaultEdit.text);
  assert.equal((await api('/api/finance/categories/food',{method:'PUT',auth:a.cookie,body:{version:0,name:'旧改名',keywords:[],active:true}})).status,409);
  assert.equal((await api('/api/finance/categories/uncategorized',{method:'PUT',auth:a.cookie,body:{version:0,name:'待分类',keywords:[],active:false}})).status,400);
});

test('expanded automatic purposes persist through the shared rules without rewriting manual or historical classifications',async()=>{
  const a=await account();
  for(const [purpose,expected] of [
    ['买菜','food'],['买东西','shopping'],['网购买鸡蛋','food'],['买东西买药','health'],
    ['京东买书','learning'],['共享单车','transport'],['天然气缴费','housing'],
    ['演唱会','entertainment'],['压岁钱','social'],['年终奖','salary']
  ])assert.equal((await create(a.cookie,{purpose,categoryId:''})).categoryId,expected,purpose);
  const manual=await create(a.cookie,{purpose:'买菜',categoryId:'shopping'});
  await create(a.cookie,{purpose:'买菜',categoryId:''});
  const view=await ledger(a.cookie);
  assert.equal(view.entries.find(entry=>entry.id===manual.id).categoryId,'shopping','new recognition must not rewrite an existing explicit choice');
  assert.equal(view.categories.some(category=>category.name==='买菜'),false,'recognized purpose must not create a new purpose-named category');
  const legacyCategory=randomUUID(),named=await api('/api/finance/categories',{method:'POST',auth:a.cookie,body:{id:legacyCategory,name:'买菜',keywords:[]}});
  assert.equal(named.status,201,named.text);
  const legacyEntry=await create(a.cookie,{purpose:'买菜',categoryId:legacyCategory});
  assert.equal((await create(a.cookie,{purpose:'买菜',categoryId:''})).categoryId,'food','future automatic entries recognize the concrete purpose despite the old purpose-only category');
  assert.equal((await create(a.cookie,{purpose:'买菜',categoryId:legacyCategory})).categoryId,legacyCategory,'explicitly selecting the old category remains valid');
  const preserved=await ledger(a.cookie);
  assert.equal(preserved.entries.find(entry=>entry.id===legacyEntry.id).categoryId,legacyCategory,'existing entries keep their exact saved ID');
  assert.equal(preserved.categories.find(category=>category.id===legacyCategory).name,'买菜');
  assert.equal(preserved.categories.find(category=>category.id===legacyCategory).version,1,'automatic inference does not mutate the old category');
  const unknown=await create(a.cookie,{purpose:'修鞋',categoryId:''});
  assert.equal((await create(a.cookie,{purpose:'修鞋',categoryId:''})).categoryId,unknown.categoryId,'unrecognized purpose reuses its previous purpose-only category');
  for(const name of ['买东西','超市买菜']){
    const category=await api('/api/finance/categories',{method:'POST',auth:a.cookie,body:{id:randomUUID(),name,keywords:[]}});
    assert.equal(category.status,201,category.text);
  }
  for(const [purpose,expected] of [['买东西买药','health'],['网购买东西买药','health'],['超市买菜刀','shopping']])assert.equal((await create(a.cookie,{purpose,categoryId:''})).categoryId,expected,'a longer purpose-only category name must not mask '+purpose);
  const configured=await api('/api/finance/categories/'+legacyCategory,{method:'PUT',auth:a.cookie,body:{version:1,name:'买菜',keywords:['有机菜篮'],active:true}});
  assert.equal(configured.status,200,configured.text);
  assert.equal((await create(a.cookie,{purpose:'买菜',categoryId:''})).categoryId,legacyCategory,'a configured exact custom category retains its rule');
});

test('screenshot food and colloquial shopping keep their expanded categories, original text and explicit saved choices',async()=>{
  const a=await account(),old=[];
  for(const name of ['买面条','买东西','买点东西','买点吃的','超市买面条']){
    const category={id:randomUUID(),name,keywords:[]},saved=await api('/api/finance/categories',{method:'POST',auth:a.cookie,body:category});
    assert.equal(saved.status,201,saved.text);old.push(category);
  }
  const historic=await create(a.cookie,{purpose:'买面条',categoryId:old[0].id});
  for(const [purpose,expected] of [
    ['买面条','food'],['买东西','shopping'],['买点东西','shopping'],['买些东西','shopping'],['天猫买东西','shopping'],
    ['在网上买点东西','shopping'],['买点吃的','food'],['买 面 条','food'],['买　东　西','shopping'],
    ['抖音商城买面条','food'],['买东西买退烧药','health'],['天猫买字帖','learning'],['超市买面条机','shopping'],
    ['快递费','transport'],['水管维修','housing'],['腾讯视频会员','entertainment'],['上网','entertainment'],
    ['网吧上机','entertainment'],['上网课','learning'],['家庭宽带续费','housing'],['全勤奖','salary'],['稿费','other-income']
  ]){
    const body=input({purpose,categoryId:''}),created=await api('/api/finance/entries',{method:'POST',auth:a.cookie,body});
    assert.equal(created.status,201,created.text);assert.equal(created.value.entry.categoryId,expected,purpose);assert.equal(created.value.entry.purpose,purpose,'matching does not rewrite stored purpose');
    const retry=await api('/api/finance/entries',{method:'POST',auth:a.cookie,body});assert.equal(retry.status,200,retry.text);assert.equal(retry.value.duplicate,true);assert.equal(retry.value.entry.categoryId,expected);
  }
  const corrected=await create(a.cookie,{purpose:'买面条',categoryId:'shopping'});assert.equal(corrected.categoryId,'shopping');
  const unknown=await create(a.cookie,{purpose:'修补 老式 装裱',categoryId:''});
  const repeated=await create(a.cookie,{purpose:'修补 老式 装裱',categoryId:''});assert.equal(repeated.categoryId,unknown.categoryId);
  const view=await ledger(a.cookie);assert.equal(view.entries.find(entry=>entry.id===historic.id).categoryId,old[0].id);
  for(const category of old){const saved=view.categories.find(row=>row.id===category.id);assert.equal(saved.version,1);assert.equal(saved.name,category.name);assert.deepEqual(saved.keywords,[])}
});

test('an automatic entry retry preserves the saved category when the suggestion changes',async()=>{
  const a=await account(),purpose='自助餐临时用途样本',body=input({purpose,categoryId:''});
  const post=value=>api('/api/finance/entries',{method:'POST',auth:a.cookie,body:value});
  const original=await post(body);
  assert.equal(original.status,201,original.text);
  assert.equal(original.value.entry.categoryId,'food');
  const categoryId=randomUUID(),configured=await api('/api/finance/categories',{method:'POST',auth:a.cookie,body:{id:categoryId,name:purpose,keywords:[purpose]}});
  assert.equal(configured.status,201,configured.text);
  const retry=await post(body);
  assert.equal(retry.status,200,retry.text);
  assert.equal(retry.value.duplicate,true);
  assert.equal(retry.value.entry.categoryId,'food');
  assert.equal((await post({...body,expression:'99'})).status,409);
  assert.equal((await post({...body,categoryId})).status,409);
  const next=await post({...body,id:randomUUID()});
  assert.equal(next.status,201,next.text);
  assert.equal(next.value.entry.categoryId,categoryId);
});

test('daily zero is explicit, and paging/search do not truncate monthly aggregate',async()=>{
  const a=await account();let day=await api('/api/finance?date='+today,{auth:a.cookie});assert.equal(day.value.day.state,'unrecorded');
  assert.equal((await api('/api/finance/day',{method:'POST',auth:a.cookie,body:{date:today,state:'zero'}})).status,200);day=await api('/api/finance?date='+today,{auth:a.cookie});assert.equal(day.value.day.state,'zero');
  for(let i=0;i<55;i++)await create(a.cookie,{expression:'1',purpose:i===0?'唯一一笔':'餐饮'});
  const first=await ledger(a.cookie);assert.equal(first.entries.length,50);assert.equal(first.summary.expenseCents,5500);assert.ok(first.nextCursor);
  const second=await ledger(a.cookie,'&cursor='+first.nextCursor);assert.equal(second.entries.length,5);assert.equal(new Set([...first.entries,...second.entries].map(item=>item.id)).size,55);assert.equal(second.summary.expenseCents,5500);
  const searched=await ledger(a.cookie,'&q='+encodeURIComponent('唯一'));assert.equal(searched.entries.length,1);assert.equal(searched.summary.expenseCents,5500);assert.deepEqual(first.expenseCategoryTotals,[{categoryId:'food',name:'餐饮',cents:5500}]);assert.deepEqual(second.expenseCategoryTotals,first.expenseCategoryTotals);assert.deepEqual(searched.expenseCategoryTotals,first.expenseCategoryTotals);const dayTotals=await api('/api/finance?date='+today+'&q=不存在&kind=income',{auth:a.cookie});assert.equal(dayTotals.value.entries.length,0);assert.deepEqual(dayTotals.value.expenseCategoryTotals,first.expenseCategoryTotals);assert.equal(dayTotals.value.trend[0].spendingCents,5500);
  assert.equal((await api('/api/finance/day',{method:'POST',auth:a.cookie,body:{date:today,state:'zero'}})).status,409);
  assert.equal((await api('/api/finance?date=2026-02-30',{auth:a.cookie})).status,400);
  assert.equal((await api('/api/finance?month='+month+'&cursor='+randomUUID(),{auth:a.cookie})).status,404);
});

test('daily completion captures server ledger snapshot, blocks pending input and keeps the snapshot after later entries',async()=>{
  const a=await account(),expense=await create(a.cookie),me=await api('/api/me',{auth:a.cookie});assert.equal(me.value.stage.reviewTemplates.daily.financeEnabled,true);
  const data={answers:{today:['真实发生的事']},action:'执行具体行动',ifCondition:'遇到阻碍',ifThen:'先做第一步',verifyDate:today,financeDraft:{expression:'2',purpose:'待确认'},financeSnapshot:{expenseCents:999999999},templateSnapshot:{version:1,review:me.value.stage.reviewTemplates.daily,action:me.value.stage.actionTemplate}};
  let saved=await api('/api/records',{method:'PUT',auth:a.cookie,body:{type:'daily',period:today,data}});assert.equal(saved.status,200,saved.text);assert.equal(saved.value.record.data.financeSnapshot,undefined);
  assert.equal((await api('/api/records/'+saved.value.record.id+'/complete',{method:'POST',auth:a.cookie})).status,400);
  saved=await api('/api/records',{method:'PUT',auth:a.cookie,body:{id:saved.value.record.id,version:saved.value.record.version,type:'daily',period:today,data:{...data,financeDraft:{}}}});assert.equal(saved.status,200,saved.text);
  const completed=await api('/api/records/'+saved.value.record.id+'/complete',{method:'POST',auth:a.cookie});assert.equal(completed.status,200,completed.text);assert.equal(completed.value.record.data.financeSnapshot.expenseCents,2300);assert.equal(completed.value.record.data.financeSnapshot.entries[0].id,expense.id);
  await create(a.cookie,{expression:'19'});
  const history=await api('/api/records/'+saved.value.record.id,{auth:a.cookie});assert.equal(history.value.record.data.financeSnapshot.expenseCents,2300);assert.equal((await ledger(a.cookie)).summary.expenseCents,4200);
  const b=await account(),otherMe=await api('/api/me',{auth:b.cookie}),review={...otherMe.value.stage.reviewTemplates.daily};delete review.financeEnabled;
  const old=await api('/api/records',{method:'PUT',auth:b.cookie,body:{type:'daily',period:today,data:{...data,financeDraft:{},templateSnapshot:{version:1,review,action:otherMe.value.stage.actionTemplate}}}});assert.equal(old.status,200,old.text);assert.equal(old.value.record.data.templateSnapshot.review.financeEnabled,false);
  const oldCompleted=await api('/api/records/'+old.value.record.id+'/complete',{method:'POST',auth:b.cookie});assert.equal(oldCompleted.status,200,oldCompleted.text);assert.equal(oldCompleted.value.record.data.financeSnapshot,undefined);
});

test('legacy and multiline finance drafts survive save and read, and unconfirmed text prevents completion without ledger writes',async()=>{
  const a=await account(),me=await api('/api/me',{auth:a.cookie}),receipt=randomUUID();
  const data={answers:{today:['记录真实发生的事']},action:'执行具体行动',ifCondition:'遇到阻碍',ifThen:'先做第一步',verifyDate:today,templateSnapshot:{version:1,review:me.value.stage.reviewTemplates.daily,action:me.value.stage.actionTemplate}};
  const legacy={expression:' 8+8-1 ',purpose:' 早餐 ',categoryId:' food ',note:' 原有备注 ',receiptIds:[receipt]};
  let saved=await api('/api/records',{method:'PUT',auth:a.cookie,body:{type:'daily',period:today,data:{...data,financeDraft:legacy}}});assert.equal(saved.status,200,saved.text);
  const expectedLegacy={text:'',expression:'8+8-1',purpose:'早餐',categoryId:'food',note:'原有备注',receiptIds:[receipt]};
  assert.deepEqual(saved.value.record.data.financeDraft,expectedLegacy);
  let read=await api('/api/records/'+saved.value.record.id,{auth:a.cookie});assert.deepEqual(read.value.record.data.financeDraft,expectedLegacy);
  let blocked=await api('/api/records/'+saved.value.record.id+'/complete',{method:'POST',auth:a.cookie});assert.equal(blocked.status,400,blocked.text);assert.equal(blocked.value.error,'finance_draft_pending');
  const text='\n60 打车\n50 吃饭\n';
  saved=await api('/api/records',{method:'PUT',auth:a.cookie,body:{id:saved.value.record.id,version:saved.value.record.version,type:'daily',period:today,data:{...data,financeDraft:{text}}}});assert.equal(saved.status,200,saved.text);
  read=await api('/api/records/'+saved.value.record.id,{auth:a.cookie});assert.equal(read.value.record.data.financeDraft.text,text);assert.equal(read.value.record.data.financeDraft.expression,'');assert.equal(read.value.record.data.financeDraft.purpose,'');
  blocked=await api('/api/records/'+saved.value.record.id+'/complete',{method:'POST',auth:a.cookie});assert.equal(blocked.status,400,blocked.text);assert.equal(blocked.value.error,'finance_draft_pending');
  read=await api('/api/records/'+saved.value.record.id,{auth:a.cookie});assert.equal(read.value.record.status,'draft');assert.equal(read.value.record.version,saved.value.record.version);assert.equal(read.value.record.data.financeSnapshot,undefined);
  assert.equal((await ledger(a.cookie)).entries.length,0,'draft save and blocked completion never confirm entries');
  assert.equal(db.prepare("SELECT count(*) n FROM activity_events WHERE user_id=? AND action='finance_entry_created'").get(a.id).n,0);
  saved=await api('/api/records',{method:'PUT',auth:a.cookie,body:{id:saved.value.record.id,version:saved.value.record.version,type:'daily',period:today,data:{...data,financeDraft:{text:' \n\t '}}}});assert.equal(saved.status,200,saved.text);
  const completed=await api('/api/records/'+saved.value.record.id+'/complete',{method:'POST',auth:a.cookie});assert.equal(completed.status,200,completed.text);assert.equal(completed.value.record.data.financeSnapshot.expenseCents,0);
});

test('encrypted personal backup restores multiline draft text without silently confirming entries',async()=>{
  const a=await account(),me=await api('/api/me',{auth:a.cookie}),text='60 打车\n50 吃饭\n8+8-1 早餐';
  const data={answers:{today:['仍待确认的花销']},action:'具体行动',ifCondition:'遇到阻碍',ifThen:'先做一步',verifyDate:today,templateSnapshot:{version:1,review:me.value.stage.reviewTemplates.daily,action:me.value.stage.actionTemplate},financeDraft:{text,note:'保留备注'}};
  const saved=await api('/api/records',{method:'PUT',auth:a.cookie,body:{type:'daily',period:today,data}});assert.equal(saved.status,200,saved.text);
  await api('/api/backup/password',{method:'POST',auth:a.cookie,body:{password:backupPassword}});
  const exported=await api('/api/backup/export',{method:'POST',auth:a.cookie,body:{}});assert.equal(exported.status,200,exported.text);
  const edited=await api('/api/records',{method:'PUT',auth:a.cookie,body:{id:saved.value.record.id,version:saved.value.record.version,type:'daily',period:today,data:{...data,financeDraft:{text:'1 临时修改'}}}});assert.equal(edited.status,200,edited.text);
  const imported=await api('/api/data/import',{method:'POST',auth:a.cookie,body:{encryptedBackup:exported.text,password:backupPassword,mode:'replace',confirmation:'RESTORE'}});assert.equal(imported.status,200,imported.text);
  const restored=await api('/api/records/'+saved.value.record.id,{auth:a.cookie});assert.equal(restored.status,200,restored.text);assert.equal(restored.value.record.data.financeDraft.text,text);assert.equal(restored.value.record.data.financeDraft.note,'保留备注');
  const completed=await api('/api/records/'+saved.value.record.id+'/complete',{method:'POST',auth:a.cookie});assert.equal(completed.status,400,completed.text);assert.equal(completed.value.error,'finance_draft_pending');assert.equal((await ledger(a.cookie)).entries.length,0);
});

test('personal backups preserve ledger tombstones, reject corrupt graph atomically, and old backups preserve new finances',async()=>{
  const a=await account();await api('/api/backup/password',{method:'POST',auth:a.cookie,body:{password:backupPassword}});
  const old=await api('/api/backup/export',{method:'POST',auth:a.cookie,body:{}});assert.equal(old.status,200,old.text);assert.equal(clearBackup(old.text).entries.some(item=>item.kind==='finance'),false);
  const entry=await create(a.cookie),exported=await api('/api/backup/export',{method:'POST',auth:a.cookie,body:{}});assert.equal(exported.status,200,exported.text);const clear=clearBackup(exported.text);assert.ok(clear.entries.find(item=>item.kind==='finance'));
  legacyDeletion(a.id,entry.id);
  const restored=await api('/api/data/import',{method:'POST',auth:a.cookie,body:{encryptedBackup:exported.text,password:backupPassword,mode:'merge'}});assert.equal(restored.status,200,restored.text);assert.equal((await ledger(a.cookie)).entries.length,0);assert.equal((await ledger(a.cookie,'&deleted=1')).entries[0].version,2);
  const legacy=await api('/api/data/import',{method:'POST',auth:a.cookie,body:{encryptedBackup:old.text,password:backupPassword,mode:'replace',confirmation:'RESTORE'}});assert.equal(legacy.status,200,legacy.text);assert.equal((await ledger(a.cookie,'&deleted=1')).entries.length,1);
  const tampered=structuredClone(clear);tampered.entries.find(item=>item.kind==='finance').value.entries[0].amountCents++;
  const bad=await api('/api/data/import',{method:'POST',auth:a.cookie,body:{encryptedBackup:sealBackup(exported.text,tampered),password:backupPassword,mode:'replace',confirmation:'RESTORE'}});assert.equal(bad.status,400,bad.text);assert.equal((await ledger(a.cookie,'&deleted=1')).entries[0].version,2);
  const forced=await api('/api/data/import',{method:'POST',auth:a.cookie,body:{encryptedBackup:exported.text,password:backupPassword,mode:'replace',confirmation:'RESTORE'}});assert.equal(forced.status,200,forced.text);assert.equal((await ledger(a.cookie)).summary.expenseCents,2300);
});

test('direct completion of a legacy daily draft without any template snapshot keeps finance disabled and ordinary current-question fallback',async()=>{
  const a=await account();await create(a.cookie);const me=await api('/api/me',{auth:a.cookie});
  const data={answers:{custom_current:['当前必填问题的答案']},action:'执行行动',ifCondition:'遇到阻碍',ifThen:'先做一步',verifyDate:today};
  const saved=await api('/api/records',{method:'PUT',auth:a.cookie,body:{type:'daily',period:today,data}});assert.equal(saved.status,200,saved.text);assert.equal(saved.value.record.data.templateSnapshot,undefined);
  const questions=[{id:'custom_current',label:'目前仍使用的必填问题',required:true}],stage=structuredClone(me.value.stage);stage.reviewTemplates.daily.questions=questions;
  const configured=await api('/api/settings',{method:'PUT',auth:a.cookie,body:{stage}});assert.equal(configured.status,200,configured.text);assert.equal(configured.value.stage.reviewTemplates.daily.financeEnabled,true);
  const completed=await api('/api/records/'+saved.value.record.id+'/complete',{method:'POST',auth:a.cookie});assert.equal(completed.status,200,completed.text);
  assert.equal(completed.value.record.data.templateSnapshot.review.financeEnabled,false);assert.deepEqual(completed.value.record.data.templateSnapshot.review.questions,questions);assert.equal(completed.value.record.data.financeSnapshot,undefined);assert.equal((await ledger(a.cookie)).summary.expenseCents,2300);
});

test('completion size limits include finance snapshots and preserve the draft, ledger and activity on failure',async()=>{
  const a=await account(),me=await api('/api/me',{auth:a.cookie});
  for(let i=0;i<4;i++)await create(a.cookie,{purpose:'财'.repeat(160)});
  const data={answers:{today:['真实发生的事']},action:'执行具体行动',ifCondition:'遇到阻碍',ifThen:'先做第一步',verifyDate:today,templateSnapshot:{version:1,review:me.value.stage.reviewTemplates.daily,action:me.value.stage.actionTemplate},padding:''};
  data.padding='x'.repeat(1024*1024-Buffer.byteLength(JSON.stringify(data))-1600);
  const saved=await api('/api/records',{method:'PUT',auth:a.cookie,body:{type:'daily',period:today,data}});assert.equal(saved.status,200,saved.text);
  const before=db.prepare("SELECT count(*) n FROM activity_events WHERE user_id=? AND action='review_completed'").get(a.id).n;
  const completed=await api('/api/records/'+saved.value.record.id+'/complete',{method:'POST',auth:a.cookie});assert.equal(completed.status,413,completed.text);assert.equal(completed.value.error,'record_too_large');
  const current=await api('/api/records/'+saved.value.record.id,{auth:a.cookie});assert.equal(current.value.record.status,'draft');assert.equal(current.value.record.version,saved.value.record.version);assert.equal(current.value.record.data.financeSnapshot,undefined);
  assert.equal((await ledger(a.cookie)).summary.expenseCents,4*2300);assert.equal(db.prepare("SELECT count(*) n FROM activity_events WHERE user_id=? AND action='review_completed'").get(a.id).n,before);
});

test('backups retain historical deleted refunds whose original was corrected before locking',async()=>{
  const a=await account(),expense=await create(a.cookie,{expression:'100'}),refund=await create(a.cookie,{kind:'refund',expression:'20',refundOf:expense.id});
  await api('/api/backup/password',{method:'POST',auth:a.cookie,body:{password:backupPassword}});
  const exported=await api('/api/backup/export',{method:'POST',auth:a.cookie,body:{}});assert.equal(exported.status,200,exported.text);
  const oldBackup=clearBackup(exported.text),entries=oldBackup.entries.find(item=>item.kind==='finance').value.entries,time=new Date().toISOString();
  Object.assign(entries.find(item=>item.id===expense.id),{kind:'income',version:2,updatedAt:time});
  Object.assign(entries.find(item=>item.id===refund.id),{deletedAt:time,updatedAt:time,version:2});
  const imported=await api('/api/data/import',{method:'POST',auth:a.cookie,body:{encryptedBackup:sealBackup(exported.text,oldBackup),password:backupPassword,mode:'replace',confirmation:'RESTORE'}});assert.equal(imported.status,200,imported.text);
  const current=await ledger(a.cookie,'&deleted=1');assert.equal(current.entries.length,2);assert.ok(current.entries.find(item=>item.id===refund.id).deletedAt);assert.equal(current.summary.incomeCents,10000);
  assert.equal((await api('/api/finance/entries/'+refund.id+'/restore',{method:'POST',auth:a.cookie,body:{version:2}})).value.error,'finance_entry_locked');
});

test('storage CSP origins belong only to the current session and login requests a document reload',async()=>{
  const a=await account(),b=await account();await create(a.cookie);
  await api('/api/backup/password',{method:'POST',auth:a.cookie,body:{password:backupPassword}});
  const exported=await api('/api/backup/export',{method:'POST',auth:a.cookie,body:{}}),clear=clearBackup(exported.text);
  clear.entries.find(item=>item.kind==='finance').value.receipts.storage={version:1,config:{endpoint:'https://private-ledger.example.test',bucket:'private-images',region:'auto',directory:'receipts',pathStyle:true,accessKey:'fixture-access',secretKey:'fixture-secret'}};
  const imported=await api('/api/data/import',{method:'POST',auth:a.cookie,body:{encryptedBackup:sealBackup(exported.text,clear),password:backupPassword,mode:'merge'}});assert.equal(imported.status,200,imported.text);
  assert.match((await api('/api/me',{auth:a.cookie})).csp,/https:\/\/private-ledger\.example\.test/);
  assert.doesNotMatch((await api('/api/me',{auth:b.cookie})).csp,/private-ledger/);
  assert.doesNotMatch((await api('/healthz',{auth:''})).csp,/private-ledger/);
  const login=await api('/api/auth/login',{method:'POST',auth:'',body:{username:a.username,password}});assert.equal(login.status,200,login.text);assert.equal(login.value.reloadForStorage,true);
  assert.match((await api('/api/me',{auth:login.cookie})).csp,/https:\/\/private-ledger\.example\.test/);
  const ordinary=await api('/api/auth/login',{method:'POST',auth:'',body:{username:b.username,password}});assert.equal(ordinary.status,200,ordinary.text);assert.equal(ordinary.value.reloadForStorage,undefined);
});

test('public finance assets return identical exact content length for GET and HEAD',async()=>{
  const get=await fetch(base+'/finance-domain.js'),bytes=await get.arrayBuffer();
  const head=await fetch(base+'/finance-domain.js',{method:'HEAD'});
  assert.equal(get.status,200);assert.equal(head.status,200);assert.equal(Number(get.headers.get('content-length')),bytes.byteLength);assert.equal(head.headers.get('content-length'),get.headers.get('content-length'));assert.equal((await head.arrayBuffer()).byteLength,0);
});

test('backup merge validates retained local receipt links and rolls back a conflicting receipt revision',async()=>{
  const a=await account();await create(a.cookie);await api('/api/backup/password',{method:'POST',auth:a.cookie,body:{password:backupPassword}});
  const exported=await api('/api/backup/export',{method:'POST',auth:a.cookie,body:{}}),clear=clearBackup(exported.text),finance=clear.entries.find(item=>item.kind==='finance').value;
  const hash=value=>createHash('sha256').update(value).digest('hex'),id=randomUUID(),time=new Date().toISOString();
  const config={endpoint:'https://receipt-fixture.example.test',bucket:'images',region:'auto',directory:'receipts',pathStyle:true,accessKey:'fixture-access',secretKey:'fixture-secret'};
  const prefix=`receipts/${hash('shendu-receipts:'+a.username.toLowerCase()).slice(0,32)}/${id}/${randomUUID()}`;
  finance.receipts={version:1,storage:{version:1,config},receipts:[{id,hash:hash('original'),ready:1,version:2,createdAt:time,updatedAt:time,data:{storageIdentity:receiptStorageIdentity(config),keys:{image:prefix+'/image.webp',thumb:prefix+'/thumb.webp'},variants:{image:{bytes:20,type:'image/webp',sha256:hash('image')},thumb:{bytes:10,type:'image/webp',sha256:hash('thumb')}}}}]};
  finance.entries[0].receiptIds=[id];
  const restored=await api('/api/data/import',{method:'POST',auth:a.cookie,body:{encryptedBackup:sealBackup(exported.text,clear),password:backupPassword,mode:'replace',confirmation:'RESTORE'}});assert.equal(restored.status,200,restored.text);
  const next=structuredClone(clear),incoming=next.entries.find(item=>item.kind==='finance').value;incoming.entries=[];incoming.receipts.receipts[0].ready=0;incoming.receipts.receipts[0].version=3;
  const merged=await api('/api/data/import',{method:'POST',auth:a.cookie,body:{encryptedBackup:sealBackup(exported.text,next),password:backupPassword,mode:'merge'}});assert.equal(merged.status,400,merged.text);
  const row=db.prepare('SELECT ready,version FROM finance_receipts WHERE id=? AND user_id=?').get(id,a.id);assert.equal(row.ready,1);assert.equal(row.version,2);assert.deepEqual((await ledger(a.cookie)).entries[0].receiptIds,[id]);
});

test('a saved receipt is exclusive across entries while exact retries and legacy links still work',async()=>{
  const a=await account(),foreign=await account();
  await create(a.cookie);
  await api('/api/backup/password',{method:'POST',auth:a.cookie,body:{password:backupPassword}});
  const exported=await api('/api/backup/export',{method:'POST',auth:a.cookie,body:{}});
  const clear=clearBackup(exported.text),finance=clear.entries.find(item=>item.kind==='finance').value;
  const hash=value=>createHash('sha256').update(value).digest('hex'),time=new Date().toISOString();
  // A ready duplicate returns before contacting storage.
  const config={endpoint:'https://93.184.216.34',bucket:'images',region:'auto',directory:'receipts',pathStyle:true,accessKey:'fixture-access',secretKey:'fixture-secret'};
  const receipt=(suffix)=>{
    const id=randomUUID(),prefix=['receipts',hash('shendu-receipts:'+a.username).slice(0,32),id,randomUUID()].join('/');
    return {id,hash:hash('original-'+suffix),ready:1,version:2,createdAt:time,updatedAt:time,data:{
      storageIdentity:receiptStorageIdentity(config),keys:{image:prefix+'/image.webp',thumb:prefix+'/thumb.webp'},
      variants:{image:{bytes:20,type:'image/webp',sha256:hash('image-'+suffix)},thumb:{bytes:10,type:'image/webp',sha256:hash('thumb-'+suffix)}}
    }};
  };
  const historical=receipt('old'),available=receipt('new');
  finance.receipts={version:1,storage:{version:1,config},receipts:[historical,available]};
  finance.entries[0].receiptIds=[historical.id];
  const legacyId=randomUUID();
  finance.entries.push({...finance.entries[0],id:legacyId,version:2,updatedAt:time,deletedAt:time});
  const restored=await api('/api/data/import',{method:'POST',auth:a.cookie,body:{encryptedBackup:sealBackup(exported.text,clear),password:backupPassword,mode:'replace',confirmation:'RESTORE'}});
  assert.equal(restored.status,200,restored.text);
  assert.equal((await ledger(a.cookie,'&deleted=1')).entries.filter(row=>row.receiptIds.includes(historical.id)).length,2);
  legacyDeletion(a.id,finance.entries[0].id);
  const post=(body,auth=a.cookie)=>api('/api/finance/entries',{method:'POST',auth,body});
  const prepare=record=>api('/api/finance/receipts/prepare',{method:'POST',auth:a.cookie,body:{id:randomUUID(),hash:record.hash,variants:record.data.variants}});
  const before=await prepare(available);assert.equal(before.status,200,before.text);assert.equal(before.value.ready,true);assert.equal(before.value.inUse,undefined);
  const bodies=[input({receiptIds:[available.id]}),input({receiptIds:[available.id],purpose:'不应重复入账',categoryId:''})];
  const writes=await Promise.all(bodies.map(body=>post(body)));
  assert.deepEqual(writes.map(result=>result.status).sort(),[201,409]);
  assert.equal(writes.find(result=>result.status===409).value.error,'finance_receipt_in_use');
  const committed=bodies[writes.findIndex(result=>result.status===201)];
  const retry=await post(committed);assert.equal(retry.status,200,retry.text);assert.equal(retry.value.duplicate,true);
  assert.equal((await prepare(available)).value.inUse,true);
  assert.equal((await prepare(historical)).value.inUse,true);
  for(const id of [historical.id,available.id]){
    const rejection=await post(input({receiptIds:[id],purpose:'拒绝时不建分类',categoryId:''}));assert.equal(rejection.value.error,'finance_receipt_in_use');
    assert.equal((await post(input({receiptIds:[id]}),foreign.cookie)).value.error,'finance_receipt_invalid');
  }
  const current=await ledger(a.cookie);assert.equal(current.entries.filter(row=>row.receiptIds.includes(available.id)).length,1);
  assert.equal(current.categories.some(row=>row.name==='拒绝时不建分类'),false);
  assert.equal(db.prepare("SELECT count(*) n FROM activity_events WHERE user_id=? AND action='finance_entry_created'").get(a.id).n,2);
});

test('account deletion cascades finance data and administrator cannot read another personal ledger',async()=>{
  const a=await account();await create(a.cookie);await api('/api/finance/day',{method:'POST',auth:a.cookie,body:{date:'2026-01-01',state:'zero'}});await api('/api/finance/categories',{method:'POST',auth:a.cookie,body:{id:randomUUID(),name:'私人类别',keywords:[]}});
  assert.equal((await ledger(ownerCookie,'&userId='+a.id)).entries.length,0);
  const removed=await api('/api/admin/users/'+a.id,{method:'DELETE',body:{currentPassword:password,confirmationUsername:a.username}});assert.equal(removed.status,200,removed.text);
  for(const table of ['finance_entries','finance_categories','finance_days'])assert.equal(db.prepare(`SELECT count(*) AS n FROM ${table} WHERE user_id=?`).get(a.id).n,0);
});

test('a revoked session during a slow finance write cannot commit an entry or activity',async()=>{
  const a=await account(),body=input(),serialized=JSON.stringify(body);let request;
  const result=new Promise((resolve,reject)=>{
    request=http.request(base+'/api/finance/entries',{method:'POST',headers:{Cookie:a.cookie,'Content-Type':'application/json','Content-Length':Buffer.byteLength(serialized)}},response=>{let text='';response.on('data',chunk=>text+=chunk);response.on('end',()=>resolve({status:response.statusCode,text}))});request.on('error',reject);request.write(serialized.slice(0,20));
  });
  const logout=await api('/api/auth/logout',{method:'POST',auth:a.cookie,body:{}});assert.equal(logout.status,200,logout.text);request.end(serialized.slice(20));
  assert.equal((await result).status,401);assert.equal(db.prepare('SELECT count(*) AS n FROM finance_entries WHERE user_id=?').get(a.id).n,0);assert.equal(db.prepare("SELECT count(*) AS n FROM activity_events WHERE user_id=? AND action='finance_entry_created'").get(a.id).n,0);
});

test('whole-site backup restores financial rows atomically and older site files preserve matching accounts finances',async()=>{
  const a=await account();await create(a.cookie);
  const exported=await api('/api/admin/site-backup/export',{method:'POST',body:{currentPassword:password,backupPassword}});assert.equal(exported.status,200,exported.text);
  const clear=clearBackup(exported.text),bundle=clear.finance.find(item=>item.user_id===a.id);assert.equal(bundle.value.entries[0].amountCents,2300);assert.equal(clear.schemaVersion,9);
  await create(a.cookie,{expression:'54'});
  const forged=structuredClone(clear);forged.finance.find(item=>item.user_id===a.id).value.entries[0].kind='not-a-kind';
  const invalid=await api('/api/admin/site-backup/restore',{method:'POST',body:{currentPassword:password,backupPassword,confirmation:'RESTORE_SITE',encryptedBackup:sealBackup(exported.text,forged)}});assert.equal(invalid.status,400,invalid.text);assert.equal((await ledger(a.cookie)).summary.expenseCents,7700);
  const restored=await api('/api/admin/site-backup/restore',{method:'POST',body:{currentPassword:password,backupPassword,confirmation:'RESTORE_SITE',encryptedBackup:exported.text}});assert.equal(restored.status,200,restored.text);
  assert.equal((await api('/api/finance',{auth:a.cookie})).status,401);
  let login=await api('/api/auth/login',{method:'POST',auth:'',body:{username:'finance_owner',password}});assert.equal(login.status,200,login.text);ownerCookie=login.cookie;
  login=await api('/api/auth/login',{method:'POST',auth:'',body:{username:a.username,password}});assert.equal(login.status,200,login.text);a.cookie=login.cookie;assert.equal((await ledger(a.cookie)).summary.expenseCents,2300);
  await create(a.cookie,{expression:'32'});
  const legacy=structuredClone(clear);delete legacy.finance;
  const oldRestore=await api('/api/admin/site-backup/restore',{method:'POST',body:{currentPassword:password,backupPassword,confirmation:'RESTORE_SITE',encryptedBackup:sealBackup(exported.text,legacy)}});assert.equal(oldRestore.status,200,oldRestore.text);
  login=await api('/api/auth/login',{method:'POST',auth:'',body:{username:a.username,password}});assert.equal(login.status,200,login.text);a.cookie=login.cookie;assert.equal((await ledger(a.cookie)).summary.expenseCents,5500);
  login=await api('/api/auth/login',{method:'POST',auth:'',body:{username:'finance_owner',password}});assert.equal(login.status,200,login.text);ownerCookie=login.cookie;
});

test('automatic categories are account-owned, encrypted, idempotent, atomic and backup-compatible',async()=>{
  const a=await account(),b=await account();
  for(const purpose of ['吃饭','聚餐','团建'])assert.equal((await create(a.cookie,{purpose,categoryId:''})).categoryId,'food');
  const body=input({purpose:'修鞋',categoryId:''}),first=await api('/api/finance/entries',{method:'POST',auth:a.cookie,body});assert.equal(first.status,201,first.text);
  const categoryId=first.value.entry.categoryId;
  assert.equal((await ledger(a.cookie)).categories.find(row=>row.id===categoryId).name,'修鞋');
  assert.equal((await ledger(b.cookie)).categories.some(row=>row.id===categoryId),false);
  const stored=db.prepare('SELECT data FROM finance_categories WHERE user_id=? AND id=?').get(a.id,categoryId);assert.match(stored.data,/^sd1\./);assert.doesNotMatch(stored.data,/修鞋/);
  const repeated=await api('/api/finance/entries',{method:'POST',auth:a.cookie,body});assert.equal(repeated.status,200,repeated.text);assert.equal(repeated.value.duplicate,true);
  const second=await create(a.cookie,{purpose:'修鞋',categoryId:''});assert.equal(second.categoryId,categoryId);
  assert.equal((await ledger(a.cookie)).categories.filter(row=>row.name==='修鞋').length,1);
  const other=await create(b.cookie,{purpose:'修鞋',categoryId:''});assert.notEqual(other.categoryId,categoryId,'private category identities must not correlate names across accounts');
  const longPurpose='待识别用途'.repeat(30),long=await create(a.cookie,{purpose:longPurpose,categoryId:''});
  assert.equal((await ledger(a.cookie)).categories.find(row=>row.id===long.categoryId).name,longPurpose);
  for(const extra of [{purpose:'未确认项目',receiptIds:[randomUUID()]},{purpose:'无效退款',kind:'refund',refundOf:randomUUID()}]){
    const failed=await api('/api/finance/entries',{method:'POST',auth:a.cookie,body:input({...extra,categoryId:''})});assert.equal(failed.status,400,failed.text);
    assert.equal((await ledger(a.cookie)).categories.some(row=>row.name===extra.purpose),false);
  }
  const rollbackBody=input({purpose:'事务失败不得留下分类',categoryId:''});
  db.exec(`CREATE TRIGGER fail_auto_entry BEFORE INSERT ON finance_entries WHEN NEW.id='${rollbackBody.id}' BEGIN SELECT RAISE(ABORT,'test entry failure'); END`);
  try{const failed=await api('/api/finance/entries',{method:'POST',auth:a.cookie,body:rollbackBody});assert.equal(failed.status,500);assert.equal((await ledger(a.cookie)).categories.some(row=>row.name===rollbackBody.purpose),false,'category must roll back with failed entry');}finally{db.exec('DROP TRIGGER fail_auto_entry')}
  const different=await create(a.cookie,{purpose:'修伞',categoryId:''});
  assert.equal((await ledger(a.cookie)).categories.find(row=>row.id===different.categoryId).name,'修伞');
  await api('/api/backup/password',{method:'POST',auth:a.cookie,body:{password:backupPassword}});
  const exported=await api('/api/backup/export',{method:'POST',auth:a.cookie,body:{}});assert.equal(exported.status,200,exported.text);
  const restored=await api('/api/data/import',{method:'POST',auth:a.cookie,body:{encryptedBackup:exported.text,password:backupPassword,mode:'replace',confirmation:'RESTORE'}});assert.equal(restored.status,200,restored.text);
  assert.equal((await ledger(a.cookie)).categories.find(row=>row.id===long.categoryId).name,longPurpose);
});

test('storage disconnect routes clear credentials and CSP without deleting ledger data, and survive encrypted backup restore',async()=>{
  const a=await account(),b=await account(),entry=await create(a.cookie);
  await api('/api/backup/password',{method:'POST',auth:a.cookie,body:{password:backupPassword}});
  const original=await api('/api/backup/export',{method:'POST',auth:a.cookie,body:{}}),clear=clearBackup(original.text);
  clear.entries.find(item=>item.kind==='finance').value.receipts.storage={version:1,config:{endpoint:'https://receipt-disconnect.example.test',bucket:'private-images',region:'auto',directory:'receipts',pathStyle:true,accessKey:'fixture-access',secretKey:'fixture-secret'}};
  const imported=await api('/api/data/import',{method:'POST',auth:a.cookie,body:{encryptedBackup:sealBackup(original.text,clear),password:backupPassword,mode:'merge'}});assert.equal(imported.status,200,imported.text);
  const read=await api('/api/finance/storage',{auth:a.cookie});assert.equal(read.value.configured,true);assert.ok(!read.text.includes('fixture-secret'));
  assert.equal((await api('/api/finance/storage',{method:'DELETE',auth:'',body:{version:1}})).status,401);
  assert.equal((await api('/api/finance/storage',{method:'DELETE',auth:a.cookie,body:{version:0}})).status,409);
  assert.equal((await api('/api/finance/storage/test',{method:'POST',auth:a.cookie,body:{version:0,config:{}}})).status,409);
  const removed=await api('/api/finance/storage',{method:'DELETE',auth:a.cookie,body:{version:1}});assert.equal(removed.status,200,removed.text);assert.equal(removed.value.configured,false);assert.equal(removed.value.version,2);
  assert.doesNotMatch((await api('/api/me',{auth:a.cookie})).csp,/receipt-disconnect/);
  assert.equal((await api('/api/finance/storage',{auth:b.cookie})).value.version,0);
  assert.equal((await ledger(a.cookie)).entries.some(row=>row.id===entry.id),true);
  const backup=await api('/api/backup/export',{method:'POST',auth:a.cookie,body:{}});assert.equal(backup.status,200,backup.text);
  const storage=clearBackup(backup.text).entries.find(item=>item.kind==='finance').value.receipts.storage;assert.equal(storage.config,null);assert.equal(storage.version,2);
  const restored=await api('/api/data/import',{method:'POST',auth:a.cookie,body:{encryptedBackup:backup.text,password:backupPassword,mode:'replace',confirmation:'RESTORE'}});assert.equal(restored.status,200,restored.text);
  assert.equal((await api('/api/finance/storage',{auth:a.cookie})).value.configured,false);
  assert.equal((await ledger(a.cookie)).entries.some(row=>row.id===entry.id),true);
});

test('yearly finance ledger query spans all months in the requested year and validates year format',async()=>{
  const jan=await create(ownerCookie,{date:'2026-01-10',expression:'40',purpose:'冬衣',categoryId:'shopping'});
  const nov=await create(ownerCookie,{date:'2026-11-15',expression:'25',purpose:'午饭',categoryId:'food'});
  const prev=await create(ownerCookie,{date:'2025-12-31',expression:'99',purpose:'去年跨年',categoryId:'food'});
  const yearly=await api('/api/finance?year=2026',{auth:ownerCookie});
  assert.equal(yearly.status,200,yearly.text);
  assert.deepEqual(yearly.value.entries.map(item=>item.id),[nov.id,jan.id]);
  assert.equal(yearly.value.entries.some(item=>item.id===prev.id),false);
  assert.equal(yearly.value.summary.netExpenseCents,6500);
  assert.deepEqual(yearly.value.monthSummaries.map(item=>[item.month,item.count,item.netExpenseCents,item.categoryTotalCents,item.topCategories[0]?.cents]),[['2026-11',1,2500,2500,2500],['2026-01',1,4000,4000,4000]]);
  const filtered=await api('/api/finance?year=2026&q='+encodeURIComponent('冬衣'),{auth:ownerCookie});
  assert.equal(filtered.status,200,filtered.text);
  assert.deepEqual(filtered.value.entries.map(item=>item.id),[jan.id]);
  assert.deepEqual(filtered.value.monthSummaries.map(item=>[item.month,item.count,item.netExpenseCents]),[['2026-01',1,4000]]);
  for(const bad of ['0000','2026-11','abc','26'])assert.equal((await api('/api/finance?year='+encodeURIComponent(bad),{auth:ownerCookie})).status,400,bad);
});
