import test from 'node:test';
import assert from 'node:assert/strict';
import {matchFinanceReceipts} from '../public/finance-receipt-matching.js';

const row=(id,amountCents,extra={})=>({id,amountCents,purpose:id,...extra});
const candidate=(id,expression,extra={})=>({receiptIds:[id],expression,kind:'expense',...extra});
const result=(receiptIds,candidates)=>({receiptIds,candidates,imageStatus:'stored'});

test('unique exact cents associate the correct saved image without changing entered values',()=>{
  const rows=[row('taxi',6000,{expression:'20+40',categoryId:'transport',date:'2026-11-17'}),row('meal',800,{expression:'8',categoryId:'food'})];
  const matched=matchFinanceReceipts(rows,result(['meal-photo','taxi-photo'],[candidate('meal-photo','8.00'),candidate('taxi-photo','60')]));
  assert.deepEqual(matched.rows.map(item=>[item.id,item.receiptIds,item.matchReason]),[['taxi',['taxi-photo'],'amount'],['meal',['meal-photo'],'amount']]);
  assert.deepEqual(matched.rows.map(({receiptIds,matchReason,...original})=>original),rows);
  assert.deepEqual(matched.receipts,[{id:'meal-photo',index:0,amounts:[800],duplicate:false},{id:'taxi-photo',index:1,amounts:[6000],duplicate:false}]);
  assert.deepEqual(matched.unmatchedReceiptIds,[]);
});

test('same-amount entered rows stay separate and require manual selection rather than positional guessing',()=>{
  const rows=[row('first meal',800),row('second meal',800)];
  for(const receiptIds of [['photo-a'],['photo-a','photo-b']]){
    const matched=matchFinanceReceipts(rows,result(receiptIds,receiptIds.map(id=>candidate(id,'8'))));
    assert.deepEqual(matched.rows.map(item=>item.receiptIds),[[],[]]);
    assert.deepEqual(matched.rows.map(item=>item.matchReason),['duplicate-row-amount','duplicate-row-amount']);
    assert.deepEqual(matched.unmatchedReceiptIds,receiptIds);
  }
});

test('multiple saved images with one matching amount do not arbitrarily select the first',()=>{
  const matched=matchFinanceReceipts([row('meal',800)],result(['photo-b','photo-a'],[candidate('photo-a','8'),candidate('photo-b','8.00')]));
  assert.deepEqual(matched.rows[0].receiptIds,[]);assert.equal(matched.rows[0].matchReason,'multiple-receipts');
  assert.deepEqual(matched.unmatchedReceiptIds,['photo-b','photo-a']);
});

test('repeated OCR detections deduplicate, and an image matching different rows requires a manual choice',()=>{
  const matched=matchFinanceReceipts([row('a',800),row('b',1600)],result(['long-photo','long-photo'],[
    candidate('long-photo','16'),candidate('long-photo','8'),candidate('long-photo','8.00'),candidate('long-photo','16.00',{duplicate:true})
  ]));
  assert.deepEqual(matched.receipts,[{id:'long-photo',index:0,amounts:[800,1600],duplicate:true}]);
  assert.deepEqual(matched.rows.map(item=>item.receiptIds),[[],[]]);
  assert.ok(matched.rows.every(item=>item.matchReason==='multiple-rows'));assert.deepEqual(matched.unmatchedReceiptIds,['long-photo']);
});

test('prior manual choices and posted receipts are reserved before automatic matching',()=>{
  const matched=matchFinanceReceipts([row('first',800,{receiptIds:['manual']}),row('second',300),row('third',700)],{
    ...result(['manual','posted','available'],[candidate('manual','3'),candidate('posted','7'),candidate('available','8')]),
    usedReceiptIds:['posted']
  });
  assert.deepEqual(matched.rows.map(item=>item.receiptIds),[['manual'],[],[]]);
  assert.deepEqual(matched.unmatchedReceiptIds,['available']);
});

test('unknown, malformed and non-expense OCR values are not automatic expense matches',()=>{
  const invalid=['','unknown','8.001','1e3','8*1','¥8.00','8.','0','-8',undefined,null,8];
  const candidates=[...invalid.map(value=>candidate('photo',value)),candidate('photo','8',{kind:'income'}),candidate('photo','8',{kind:'refund'}),candidate('photo','8',{kind:'transfer'}),candidate('photo','8',{kind:undefined})];
  const matched=matchFinanceReceipts([row('meal',800)],result(['photo'],candidates));
  assert.equal(matched.rows[0].matchReason,'unrecognized-amount');assert.deepEqual(matched.rows[0].receiptIds,[]);
  assert.deepEqual(matched.receipts[0].amounts,[]);assert.deepEqual(matched.unmatchedReceiptIds,['photo']);
});

test('a recognized different amount and several smaller receipts never become a guessed total match',()=>{
  const matched=matchFinanceReceipts([row('meal',2300)],result(['eight','fifteen'],[candidate('eight','8'),candidate('fifteen','15')]));
  assert.equal(matched.rows[0].matchReason,'amount-mismatch');assert.deepEqual(matched.rows[0].receiptIds,[]);
  assert.deepEqual(matched.unmatchedReceiptIds,['eight','fifteen']);
});

test('only receipt IDs in the saved-image allowlist participate in recognition or preserved manual links',()=>{
  const matched=matchFinanceReceipts([row('meal',800,{receiptIds:['foreign','photo','photo']})],result(['photo','',' photo ',null,4],[
    candidate('foreign','8'),candidate('photo','9',{duplicate:true}),candidate('other','8'),null,{}
  ]));
  assert.deepEqual(matched.rows[0].receiptIds,['photo']);assert.equal(matched.rows[0].matchReason,'manual');
  assert.deepEqual(matched.receipts,[{id:'photo',index:0,amounts:[900],duplicate:true}]);assert.deepEqual(matched.unmatchedReceiptIds,[]);
  const foreignOnly=matchFinanceReceipts([row('meal',800,{receiptIds:['foreign']})],result(['photo'],[candidate('foreign','8')]));
  assert.deepEqual(foreignOnly.rows[0].receiptIds,[]);assert.equal(foreignOnly.rows[0].matchReason,'unrecognized-amount');
});

test('explicit valid associations survive ambiguous or unrecognized OCR without redistributing other rows',()=>{
  const matched=matchFinanceReceipts([row('first',800,{receiptIds:['unknown-photo']}),row('second',800)],result(['known-photo','unknown-photo'],[candidate('known-photo','8'),candidate('unknown-photo','')]));
  assert.equal(matched.rows[0].matchReason,'manual');assert.deepEqual(matched.rows[0].receiptIds,['unknown-photo']);
  assert.equal(matched.rows[1].matchReason,'duplicate-row-amount');assert.deepEqual(matched.rows[1].receiptIds,[]);
  assert.deepEqual(matched.unmatchedReceiptIds,['known-photo']);
});

test('integer-cent matching handles decimal expressions exactly and rejects invalid entered amounts',()=>{
  const invalid=[0,-1,0.3,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'30',undefined];
  const matched=matchFinanceReceipts([row('decimal',30),...invalid.map((amount,index)=>row(`invalid-${index}`,amount))],result(['photo'],[candidate('photo','0.1+0.2')]));
  assert.deepEqual(matched.rows[0].receiptIds,['photo']);assert.equal(matched.rows[0].matchReason,'amount');
  assert.ok(matched.rows.slice(1).every(item=>item.matchReason==='invalid-amount'&&item.receiptIds.length===0));
});

test('result order is stable, extra saved images stay explicitly unmatched and frozen inputs remain untouched',()=>{
  const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child)}return value};
  const rows=freeze([row('meal',800,{receiptIds:[],note:'keep me',categoryId:'custom'})]),upload=freeze(result(['unknown','photo','unused'],[candidate('photo','8'),candidate('unused','12'),candidate('unknown','')]));
  const matched=matchFinanceReceipts(rows,upload);
  assert.notEqual(matched.rows[0],rows[0]);assert.notEqual(matched.rows[0].receiptIds,rows[0].receiptIds);
  assert.deepEqual(matched.receipts.map(item=>[item.id,item.index]),[['unknown',0],['photo',1],['unused',2]]);
  assert.deepEqual(matched.unmatchedReceiptIds,['unknown','unused']);assert.equal(matched.rows[0].note,'keep me');
  assert.equal(rows[0].receiptIds.length,0);assert.deepEqual(upload.receiptIds,['unknown','photo','unused']);
});

test('empty batches and missing recognition arrays remain manual without side effects',()=>{
  assert.deepEqual(matchFinanceReceipts(),{rows:[],receipts:[],unmatchedReceiptIds:[]});
  assert.deepEqual(matchFinanceReceipts(null,null),{rows:[],receipts:[],unmatchedReceiptIds:[]});
  const matched=matchFinanceReceipts([row('meal',800)],{receiptIds:['photo']});
  assert.equal(matched.rows[0].matchReason,'unrecognized-amount');assert.deepEqual(matched.unmatchedReceiptIds,['photo']);
});
