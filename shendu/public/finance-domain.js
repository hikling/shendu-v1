export const FINANCE_KINDS=Object.freeze({expense:'支出',income:'收入',refund:'退款',transfer:'不计收支'});

export const DEFAULT_FINANCE_CATEGORIES=Object.freeze([
  {id:'food',name:'餐饮',keywords:['早餐','午餐','晚餐','吃饭','餐厅','外卖','咖啡','奶茶','水果','超市食品']},
  {id:'transport',name:'交通',keywords:['打车','滴滴','地铁','公交','高铁','火车','机票','加油','停车','通行费']},
  {id:'shopping',name:'购物',keywords:['购物','日用品','淘宝','京东','衣服','鞋','数码','拼多多']},
  {id:'housing',name:'居住',keywords:['房租','房贷','水费','电费','燃气','物业','宽带','话费']},
  {id:'health',name:'医疗',keywords:['医院','药店','看病','挂号','体检','医疗','买药']},
  {id:'learning',name:'学习',keywords:['学费','课程','教材','买书','书店','考试','培训']},
  {id:'entertainment',name:'娱乐',keywords:['电影','游戏','旅游','门票','会员','健身']},
  {id:'social',name:'人情',keywords:['礼物','红包','礼金','请客','份子钱']},
  {id:'salary',name:'工资',keywords:['工资','薪资','薪水','奖金','绩效']},
  {id:'other-income',name:'其他收入',keywords:['兼职','收入','报酬','利息']},
  {id:'uncategorized',name:'待分类',keywords:[]}
].map(category=>Object.freeze({...category,keywords:Object.freeze(category.keywords),active:true,version:1})));

const MAX_CENTS=99_999_999_999;

export function hasPendingFinanceDraft(draft){
  return Boolean(draft&&typeof draft==='object'&&(['expression','purpose','note'].some(key=>String(draft[key]??'').trim())||(Array.isArray(draft.receiptIds)&&draft.receiptIds.length)));
}

// Deliberately only decimal addition/subtraction: user text is never executable code.
export function parseMoneyExpression(value){
  if(typeof value!=='string'||value.length>200)throw new Error('请输入有效的金额算式');
  const text=value.trim().replace(/＋/g,'+').replace(/[−－]/g,'-');
  if(!text)throw new Error('请输入金额');
  const tokens=text.match(/[+-]|\d+(?:\.\d{1,2})?/g);
  if(!tokens||tokens.join('')!==text.replace(/\s+/g,'')||/\d\s+\d/.test(text)||tokens.length>81)throw new Error('金额只支持数字、两位小数和加减，例如 8+8+8-1');
  let total=0,sign=1,index=0;
  if(tokens[0]==='+'||tokens[0]==='-'){sign=tokens[0]==='-'?-1:1;index++}
  for(;index<tokens.length;index+=2){
    const number=tokens[index];
    if(!/^\d+(?:\.\d{1,2})?$/.test(number)||number.length>14)throw new Error('金额算式不完整');
    const [whole,fraction='']=number.split('.'),cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));
    if(!Number.isSafeInteger(cents)||cents>MAX_CENTS)throw new Error('金额超过允许范围');
    total+=sign*cents;
    if(!Number.isSafeInteger(total)||Math.abs(total)>MAX_CENTS)throw new Error('合计金额超过允许范围');
    if(index+1<tokens.length){const operator=tokens[index+1];if(operator!=='+'&&operator!=='-')throw new Error('金额算式不完整');sign=operator==='-'?-1:1;if(index+2>=tokens.length)throw new Error('金额算式不完整')}
  }
  if(index===1&&(tokens[0]==='+'||tokens[0]==='-'))throw new Error('金额算式不完整');
  return total;
}

export function formatFinanceMoney(cents){
  if(!Number.isSafeInteger(cents))return '—';
  const amount=Math.abs(cents),whole=Math.floor(amount/100).toLocaleString('zh-CN');
  return `${cents<0?'-':''}${whole}.${String(amount%100).padStart(2,'0')}`;
}

export function suggestFinanceCategory(purpose,categories=DEFAULT_FINANCE_CATEGORIES,kind='expense'){
  const text=String(purpose??'').trim().toLowerCase(),active=categories.filter(category=>category.active!==false);
  if(!text)return kind==='income'&&active.some(category=>category.id==='other-income')?'other-income':'uncategorized';
  const exact=active.find(category=>String(category.name).toLowerCase()===text);
  if(exact)return exact.id;
  let best=null,score=0;
  for(const category of active){
    const words=[category.name,...(Array.isArray(category.keywords)?category.keywords:[])];
    for(const word of words){const keyword=String(word).trim().toLowerCase();if(keyword&&text.includes(keyword)&&keyword.length>score){best=category.id;score=keyword.length}}
  }
  return best||(kind==='income'&&active.some(category=>category.id==='other-income')?'other-income':'uncategorized');
}

function receiptDate(text,fallback){
  const match=text.match(/\b(20\d{2})[年\/.\-](\d{1,2})[月\/.\-](\d{1,2})(?:日|\b)/);
  if(!match)return fallback;
  const date=`${match[1]}-${match[2].padStart(2,'0')}-${match[3].padStart(2,'0')}`,parsed=new Date(`${date}T12:00:00Z`);
  return Number.isFinite(parsed.valueOf())&&parsed.toISOString().slice(0,10)===date?date:fallback;
}

// OCR is a draft, not a transaction: leave ambiguity visible for human confirmation.
export function parseReceiptText(value,{date='',categories=DEFAULT_FINANCE_CATEGORIES}={}){
  const text=String(value??'').slice(0,50_000).replace(/[￥¥]/g,'¥'),lines=text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  if(!lines.length)return [];
  const found=[];
  const merchant=lines.find(line=>/^(?:商户(?:名称|全称)?|收款(?:方|商家)|商品(?:说明|名称)?|交易对方)\s*[:：]?\s*\S/.test(line));
  const merchantName=merchant?.replace(/^(?:商户(?:名称|全称)?|收款(?:方|商家)|商品(?:说明|名称)?|交易对方)\s*[:：]?\s*/,'').slice(0,120)||'';
  const transactionDate=receiptDate(text,date);
  const strong=lines.filter(line=>/(?:实付|实付款|支付金额|付款金额|实收|到账金额|退款金额|合计金额|收支金额)/.test(line));
  const candidates=strong.length?strong:lines.filter(line=>/(?:¥\s*[-+]?\s*\d|(?:^|\s)[-+]\s*\d+\.\d{2}\b|\d+\.\d{2}\s*元)/.test(line)&&!/(?:余额|优惠|折扣|减免|手续费|订单号|交易号|账单号)/.test(line));
  for(const line of candidates.slice(0,30)){
    const matches=[...line.matchAll(/(?:¥\s*)?([-+]?\s*\d{1,9}(?:,\d{3})*(?:\.\d{1,2})?)(?:\s*元)?/g)].filter(match=>!/^20\d{2}$/.test(match[1].trim()));
    if(!matches.length)continue;
    // Currency marker/decimal takes precedence over unrelated counts on the same line.
    const chosen=matches.find(match=>match[0].includes('¥'))||matches.find(match=>match[1].includes('.'))||matches.at(-1);
    const expression=chosen[1].replace(/[\s,+]/g,'').replace(/^-/,'');
    let amount;try{amount=parseMoneyExpression(expression)}catch{continue}
    if(amount<=0)continue;
    const kind=/退款/.test(line)||(/退款成功/.test(text)&&strong.length<=1)?'refund':/(?:实收|到账|收入|收款成功)/.test(line)?'income':'expense';
    const purpose=merchantName||line.replace(chosen[0],'').replace(/(?:支付金额|付款金额|实付款?|实收|到账金额|退款金额|合计金额|收支金额|元|[:：])/g,'').trim().slice(0,120)||'截图识别';
    const warnings=['请核对金额、日期和分类后入账'];
    if(!transactionDate)warnings.push('未识别到日期');
    if(!merchantName)warnings.push('用途需要核对');
    found.push({date:transactionDate,expression:formatFinanceMoney(amount).replace(/,/g,''),purpose,kind,categoryId:suggestFinanceCategory(purpose,categories,kind),confidence:strong.includes(line)?'medium':'low',warnings});
  }
  return found;
}
