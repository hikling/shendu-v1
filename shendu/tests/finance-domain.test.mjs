import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMoneyExpression,parseFinanceLines,hasPendingFinanceDraft,formatFinanceMoney,suggestFinanceCategory,financeCategoryLabel,DEFAULT_FINANCE_CATEGORIES,parseReceiptText} from '../public/finance-domain.js';
import {normalizeFinanceDraft,financeDraftPending} from '../finance-ledger.mjs';

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

test('automatic category labels recognize meal synonyms and retain an unknown full purpose without writing',()=>{
  for(const purpose of ['吃饭','周末聚餐','部门团建','火锅','夜宵','烧烤'])assert.equal(financeCategoryLabel(purpose),'餐饮',purpose);
  const customized=DEFAULT_FINANCE_CATEGORIES.map(category=>category.id==='food'?{...category,name:'伙食',keywords:['早餐']}:category);
  assert.equal(financeCategoryLabel('聚餐',customized),'伙食','updated synonyms also apply to stored built-in overrides');
  for(const [purpose,name] of [['地铁车票','交通'],['买鞋','购物'],['水费','居住'],['体检','医疗'],['培训','学习'],['电影','娱乐'],['礼金','人情']])assert.equal(financeCategoryLabel(purpose),name);
  assert.equal(financeCategoryLabel(' 修鞋 '),'修鞋');assert.equal(financeCategoryLabel('稿酬',DEFAULT_FINANCE_CATEGORIES,'income'),'稿酬');
  assert.equal(financeCategoryLabel('工资',DEFAULT_FINANCE_CATEGORIES,'income'),'工资');assert.equal(financeCategoryLabel(''),'待填写用途');
  const categories=JSON.stringify(DEFAULT_FINANCE_CATEGORIES);financeCategoryLabel('未知用途');assert.equal(JSON.stringify(DEFAULT_FINANCE_CATEGORIES),categories);
  assert.equal(financeCategoryLabel('甲'.repeat(160)),'甲'.repeat(160));
});

test('line entry shares exact cents, preserves expressions and physical line numbers, and suggests categories',()=>{
  const parsed=parseFinanceLines('\n60 打车\r\n\t \n50 吃饭\r8 + 8 + 8 - 1 早餐\n0.1+0.2 便利店');
  assert.deepEqual(parsed.errors,[]);
  assert.deepEqual(parsed.rows,[
    {line:2,expression:'60',purpose:'打车',amountCents:6000,categoryId:'transport'},
    {line:4,expression:'50',purpose:'吃饭',amountCents:5000,categoryId:'food'},
    {line:5,expression:'8 + 8 + 8 - 1',purpose:'早餐',amountCents:2300,categoryId:'food'},
    {line:6,expression:'0.1+0.2',purpose:'便利店',amountCents:30,categoryId:'uncategorized'}
  ]);
  assert.equal(parsed.totalCents,13330);
  assert.deepEqual(parseFinanceLines(' \n\t'),{rows:[],errors:[],totalCents:0});
  assert.equal(parseFinanceLines('8 早餐\n8 早餐').rows.length,2,'identical amounts remain separate entries');
  assert.equal(parseFinanceLines('60 7号线地铁').rows[0].purpose,'7号线地铁');
});

test('everyday purposes recognize groceries, purchases and a wider range of living expenses',()=>{
  const cases={
    food:['买菜','菜市场买食材','超市买鸡蛋','买牛奶和面包','生鲜配送','公司食堂','下午茶甜品','麻辣烫'],
    shopping:['买东西','网购','买洗漱用品','换手机','牙膏纸巾','买文具','买菜刀'],
    transport:['顺风车','共享单车','汽车充电','高速费','车辆保养'],
    housing:['交网费','租房','天然气缴费','手机套餐','酒店住宿','家政保洁'],
    health:['诊所复诊','牙科补牙','疫苗接种','药品费用','配眼镜'],
    learning:['在线课程','教辅资料','考证报名费','报驾校','绘本'],
    entertainment:['演唱会','景区游玩','羽毛球场','密室逃脱','KTV'],
    social:['随礼','压岁钱','生日礼物','捐款'],
    salary:['年终奖','加班费','提成'],
    'other-income':['分红','出售闲置','租金收入','报销到账']
  };
  for(const [expected,purposes] of Object.entries(cases)){
    for(const purpose of purposes)assert.equal(suggestFinanceCategory(purpose),expected,purpose);
  }
  for(const purpose of ['便利店','星巴克','修鞋','修伞','甲店','车间材料','卡套定制'])assert.equal(suggestFinanceCategory(purpose),'uncategorized',purpose);
});

test('specific purposes beat general shopping channels while custom and inactive categories retain their rules',()=>{
  for(const [purpose,expected] of [
    ['网购买菜','food'],['买东西：鸡蛋牛奶','food'],['拼多多买药','health'],
    ['买东西买药','health'],['京东买书','learning'],['淘宝买教材','learning'],
    ['网购火车票','transport'],['买东西送生日礼物','social'],['购物买日用品','shopping']
  ])assert.equal(suggestFinanceCategory(purpose),expected,purpose);
  const customized=DEFAULT_FINANCE_CATEGORIES.map(category=>({...category,keywords:category.id==='food'?['早餐']:category.keywords}));
  assert.equal(suggestFinanceCategory('网购买菜',customized),'food','new built-in words supplement previously saved built-in keyword lists');
  const custom={id:'own-groceries',name:'买菜',keywords:['有机菜篮'],active:true};
  assert.equal(suggestFinanceCategory('买菜',[...customized,custom]),custom.id,'preserve exact custom category names');
  assert.equal(suggestFinanceCategory('有机菜篮',[...customized,custom]),custom.id);
  assert.equal(suggestFinanceCategory('买菜',[...customized,{...custom,active:false}]),'food');
  assert.equal(suggestFinanceCategory('买菜',customized.map(category=>category.id==='food'?{...category,active:false}:category)),'uncategorized');
});

test('multiline preview, display labels and receipt drafts use the same expanded categorizer',()=>{
  const parsed=parseFinanceLines('25 买菜\n18 买东西\n35 京东买书');
  assert.deepEqual(parsed.errors,[]);assert.deepEqual(parsed.rows.map(row=>row.categoryId),['food','shopping','learning']);
  assert.equal(parsed.totalCents,7800);
  assert.equal(financeCategoryLabel('买菜'),'餐饮');assert.equal(financeCategoryLabel('买东西'),'购物');
  const receipt=parseReceiptText('商户名称：菜市场买菜\n支付金额 ¥25.00',{date:'2026-11-17'});
  assert.equal(receipt.length,1);assert.equal(receipt[0].categoryId,'food');assert.equal(receipt[0].purpose,'菜市场买菜');
});

test('purpose-only categories do not hide recognized built-ins during future automatic inference',()=>{
  const purposeCategories=[
    {id:'old-groceries',name:'买菜',keywords:[],active:true},
    {id:'old-purchase',name:'买东西',keywords:[],active:true},
    {id:'old-unknown',name:'修鞋',keywords:[],active:true},
    {id:'old-marketplace',name:'淘宝修鞋',keywords:[],active:true},
    {id:'old-vague',name:'买东西补伞',keywords:[],active:true},
    {id:'old-market-groceries',name:'超市买菜',keywords:[],active:true}
  ],categories=[...DEFAULT_FINANCE_CATEGORIES,...purposeCategories],original=JSON.stringify(categories);
  assert.equal(suggestFinanceCategory('买菜',categories),'food');
  assert.equal(suggestFinanceCategory('买东西',categories),'shopping');
  assert.equal(suggestFinanceCategory('买东西买药',categories),'health');
  assert.equal(suggestFinanceCategory('网购买东西买药',categories),'health');
  assert.equal(suggestFinanceCategory('超市买菜刀',categories),'shopping');
  assert.equal(suggestFinanceCategory('修鞋',categories),'old-unknown');
  assert.equal(suggestFinanceCategory('淘宝修鞋',categories),'old-marketplace','a vague platform hint cannot override the complete existing purpose');
  assert.equal(suggestFinanceCategory('买东西补伞',categories),'old-vague');
  assert.equal(suggestFinanceCategory('修鞋',categories,'income'),'old-unknown','unknown purpose is not overridden by the generic income fallback');
  assert.deepEqual(parseFinanceLines('25 买菜\n18 买东西',{categories}).rows.map(row=>row.categoryId),['food','shopping']);
  assert.equal(financeCategoryLabel('买菜',categories),'餐饮');
  assert.equal(parseReceiptText('商户名称：买菜\n支付金额 ¥25.00',{categories})[0].categoryId,'food');
  assert.equal(suggestFinanceCategory('买菜',categories.map(category=>category.id==='food'?{...category,active:false}:category)),'old-groceries');
  assert.equal(suggestFinanceCategory('买菜',categories.map(category=>category.id==='old-groceries'?{...category,keywords:['有机菜篮']}:category)),'old-groceries','explicit custom keyword rules still win');
  assert.equal(JSON.stringify(categories),original,'inference never rewrites old category objects');
});

test('line entry normalizes only safe fullwidth amount characters and respects current account categories',()=>{
  const categories=[...DEFAULT_FINANCE_CATEGORIES,{id:'custom',name:'咖啡',keywords:['星巴克'],active:true}];
  const parsed=parseFinanceLines('１２．５０ ＋ ６ − ０．０１　星巴克 Ａ店',{categories});
  assert.deepEqual(parsed,{rows:[{line:1,expression:'12.50 + 6 - 0.01',purpose:'星巴克 Ａ店',amountCents:1849,categoryId:'custom'}],errors:[],totalCents:1849});
  assert.equal(parseMoneyExpression(parsed.rows[0].expression),parsed.rows[0].amountCents,'normalized expression is accepted by the existing ledger API');
  assert.equal(parseFinanceLines('50 零散报酬',{kind:'income'}).rows[0].categoryId,'other-income');
  assert.equal(parseFinanceLines('50 星巴克',{categories:categories.map(item=>item.id==='custom'?{...item,active:false}:item)}).rows[0].categoryId,'uncategorized');
});

test('line errors retain valid rows and reject missing purposes, invalid arithmetic and nonpositive amounts',()=>{
  const invalid=['60','打车60','60打车','1.001 早餐','1. 早餐','1--2 早餐','1 + 早餐','1 2 早餐','1*2 早餐','1 * 2 早餐','1 / 2 早餐','1e3 早餐','globalThis.x=1 早餐','0 早餐','-1 早餐','9999999999999999 早餐','1 '+ 'a'.repeat(161)];
  const parsed=parseFinanceLines(['60 打车','',...invalid,'50 吃饭'].join('\n'));
  assert.equal(parsed.rows.length,2);assert.equal(parsed.totalCents,11000);
  assert.deepEqual(parsed.errors.map(item=>item.line),invalid.map((_,index)=>index+3));
  assert.ok(parsed.errors.every(item=>typeof item.message==='string'&&item.message));
  assert.equal(parseFinanceLines('1'.repeat(201)+' 早餐').errors.length,1);
});

test('line entry enforces text and nonempty line limits without silently truncating entries',()=>{
  const thirty=Array.from({length:30},()=> '1 早餐').join('\n\n'),accepted=parseFinanceLines(thirty);
  assert.equal(accepted.rows.length,30);assert.equal(accepted.totalCents,3000);assert.deepEqual(accepted.errors,[]);
  const overflow=parseFinanceLines(thirty+'\n\n2 打车\n3 吃饭');
  assert.equal(overflow.rows.length,30);assert.equal(overflow.totalCents,3000);assert.deepEqual(overflow.errors.map(item=>item.line),[61,62]);
  const atLimit='1 早餐'+' '.repeat(5996);assert.equal(parseFinanceLines(atLimit).rows.length,1);
  assert.deepEqual(parseFinanceLines(atLimit+' ').rows,[]);assert.equal(parseFinanceLines(atLimit+' ').errors.length,1);
  for(const value of [null,undefined,{},1])assert.equal(parseFinanceLines(value).errors.length,1);
});

test('bounded multiline drafts preserve legacy metadata and both browser and server pending rules',()=>{
  const receipt='a585b786-6b68-4327-a8b5-660d14b57440',legacy={expression:' 8+8-1 ',purpose:' 早餐 ',categoryId:' food ',note:' 核对备注 ',receiptIds:[receipt,receipt,'invalid']};
  assert.deepEqual(normalizeFinanceDraft(legacy),{text:'',expression:'8+8-1',purpose:'早餐',categoryId:'food',note:'核对备注',receiptIds:[receipt]});
  const text='\n60 打车\n50 吃饭\n',draft=normalizeFinanceDraft({...legacy,text});
  assert.equal(draft.text,text);assert.equal(draft.note,'核对备注');assert.deepEqual(draft.receiptIds,[receipt]);
  assert.equal(normalizeFinanceDraft({text:'x'.repeat(6001)}).text.length,6000);
  for(const pending of [hasPendingFinanceDraft,financeDraftPending]){
    assert.equal(pending({text}),true);assert.equal(pending({text:'尚未填写金额'}),true);
    for(const key of ['expression','purpose','note'])assert.equal(pending({[key]:'旧草稿'}),true);
    assert.equal(pending({receiptIds:[receipt]}),true);
    for(const empty of [null,{},{text:' \n\t',categoryId:'food'}])assert.equal(pending(empty),false);
  }
});

test('receipt OCR produces editable drafts with warnings, excludes balances and keeps repeated amounts',()=>{
  const drafts=parseReceiptText('商户名称：早餐铺\n支付金额 ¥23.00\n2026年11月15日\n账户余额 ¥500.00',{date:'2026-11-15'});
  assert.equal(drafts.length,1);assert.equal(drafts[0].expression,'23.00');assert.equal(drafts[0].categoryId,'food');assert.equal(drafts[0].date,'2026-11-15');assert.ok(drafts[0].warnings.length);
  const list=parseReceiptText('¥8.00 早餐\n¥8.00 早餐\n余额 ¥200.00',{date:'2026-11-15'});assert.equal(list.length,2);
  assert.deepEqual(parseReceiptText('没有金额的文字'),[]);
  const refund=parseReceiptText('退款金额 ¥12.00',{date:'2026-11-15'})[0];assert.equal(refund.kind,'refund');assert.equal(refund.expression,'12.00');
});
