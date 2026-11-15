import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMoneyExpression,formatFinanceMoney,suggestFinanceCategory,DEFAULT_FINANCE_CATEGORIES,parseReceiptText} from '../public/finance-domain.js';

test('decimal calculations use exact integer cents and never evaluate code',()=>{
  for(const [expression,cents] of [['8+8+8-1',2300],['0.1+0.2',30],[' 12.50 + 6 - 0.01 ',1849],['-1+2',100],['0',0],['1＋2－0.5',250]])assert.equal(parseMoneyExpression(expression),cents,expression);
  for(const expression of ['', '+','-','1+','1--2','1++2','1*2','1/2','1.001','1.','1 2','NaN','Infinity','1e3','globalThis.x=1','alert(1)','9999999999999999'])assert.throws(()=>parseMoneyExpression(expression),undefined,expression);
  assert.equal(formatFinanceMoney(1234567),'12,345.67');assert.equal(formatFinanceMoney(-101),'-1.01');assert.equal(formatFinanceMoney(NaN),'—');
});

test('classification respects custom names, archived categories and unknown purposes',()=>{
  assert.equal(suggestFinanceCategory('早餐'), 'food');assert.equal(suggestFinanceCategory('滴滴打车'), 'transport');
  const categories=[...DEFAULT_FINANCE_CATEGORIES,{id:'custom',name:'咖啡',keywords:['星巴克'],active:true}];
  assert.equal(suggestFinanceCategory('星巴克咖啡',categories),'custom');assert.equal(suggestFinanceCategory('咖啡',categories),'custom');
  assert.equal(suggestFinanceCategory('不明用途',categories),'uncategorized');assert.equal(suggestFinanceCategory('',categories,'income'),'other-income');
  assert.equal(suggestFinanceCategory('星巴克',categories.map(category=>category.id==='custom'?{...category,active:false}:category)),'uncategorized');
});

test('receipt OCR produces editable drafts with warnings, excludes balances and keeps repeated amounts',()=>{
  const drafts=parseReceiptText('商户名称：早餐铺\n支付金额 ¥23.00\n2026年11月15日\n账户余额 ¥500.00',{date:'2026-11-15'});
  assert.equal(drafts.length,1);assert.equal(drafts[0].expression,'23.00');assert.equal(drafts[0].categoryId,'food');assert.equal(drafts[0].date,'2026-11-15');assert.ok(drafts[0].warnings.length);
  const list=parseReceiptText('¥8.00 早餐\n¥8.00 早餐\n余额 ¥200.00',{date:'2026-11-15'});assert.equal(list.length,2);
  assert.deepEqual(parseReceiptText('没有金额的文字'),[]);
  const refund=parseReceiptText('退款金额 ¥12.00',{date:'2026-11-15'})[0];assert.equal(refund.kind,'refund');assert.equal(refund.expression,'12.00');
});
