export const FINANCE_KINDS=Object.freeze({expense:'支出',income:'收入',refund:'退款',transfer:'不计收支'});

export const DEFAULT_FINANCE_CATEGORIES=Object.freeze([
  {id:'food',name:'餐饮',keywords:['早餐','早饭','午餐','午饭','晚餐','晚饭','吃饭','聚餐','团建','餐厅','餐饮','饭店','外卖','夜宵','宵夜','火锅','烧烤','自助餐','小吃','零食','饮料','咖啡','奶茶','水果','超市食品','买菜','菜钱','菜市场','菜场','蔬菜','食材','生鲜','猪肉','牛肉','羊肉','鸡肉','鸭肉','鸡蛋','海鲜','水产','大米','面粉','食用油','调味料','酱油','牛奶','酸奶','面包','蛋糕','甜品','饼干','坚果','饮用水','矿泉水','盒饭','便当','食堂','餐费','饭钱','面馆','快餐','麻辣烫','米线','螺蛳粉','包子','饺子','汉堡','披萨','炸鸡','烤肉']},
  {id:'transport',name:'交通',keywords:['打车','滴滴','出租车','网约车','地铁','公交','高铁','火车','机票','加油','停车','通行费','过路费','车票','交通费','路费','打的','顺风车','代驾','共享单车','骑行费','公交卡','地铁卡','充电桩','汽车充电','电动车充电','高速费','高速通行','停车场','停车费','洗车','修车','保养车','车辆保养','汽车保养','汽车维修']},
  {id:'shopping',name:'购物',keywords:['购物','日用品','淘宝','京东','衣服','买鞋','数码','拼多多','纸巾','洗衣液','洗发水','护肤','化妆品','生活用品','买东西','网购','买衣服','衣裤','裤子','外套','羽绒服','鞋子','袜子','内衣','背包','箱包','洗漱用品','牙膏','牙刷','沐浴露','洗洁精','垃圾袋','卫生纸','卫生巾','剃须刀','买菜刀','菜刀','锅具','厨具','餐具','床单','被子','枕头','毛巾','家具','家电','冰箱','洗衣机','空调','买手机','换手机','手机壳','充电器','充电线','耳机','键盘','鼠标','显示器','买电脑','笔记本电脑','电池','文具','打印纸','办公用品','宠物用品']},
  {id:'housing',name:'居住',keywords:['房租','房贷','水费','电费','燃气','物业','宽带','话费','租金','租房','房屋租赁','煤气','天然气','网费','手机套餐','通讯费','通信费','维修房屋','房屋维修','装修','家政','保洁','搬家','住宿','酒店','宾馆','民宿']},
  {id:'health',name:'医疗',keywords:['医院','药店','看病','挂号','体检','医疗','买药','药品','药费','医药','诊所','门诊','住院','手术','治疗','牙医','牙科','补牙','拔牙','洗牙','疫苗','接种','检查费','化验','复诊','配眼镜','验光','口罩','消毒液']},
  {id:'learning',name:'学习',keywords:['学费','课程','教材','买书','书店','考试','培训','书籍','图书','报班','网课','在线课程','辅导班','补习','报考','报名费','考试费','考证','驾校','学习资料','教辅','学杂费','托班','幼儿园','绘本']},
  {id:'entertainment',name:'娱乐',keywords:['电影','游戏','旅游','门票','会员','健身','影院','演唱会','音乐会','展览','博物馆','游乐园','游泳','羽毛球','篮球','足球','台球','保龄球','棋牌','剧本杀','密室逃脱','露营','景区','景点','游玩','唱歌','ktv','网吧','游戏充值','视频会员','音乐会员','运动场']},
  {id:'social',name:'人情',keywords:['礼物','红包','礼金','请客','份子钱','随礼','随份子','压岁钱','婚礼','喜酒','结婚礼金','生日礼物','节日礼物','孝敬','赡养','捐款','捐赠']},
  {id:'salary',name:'工资',keywords:['工资','薪资','薪水','奖金','绩效','年终奖','加班费','基本工资','提成','发薪']},
  {id:'other-income',name:'其他收入',keywords:['兼职','收入','报酬','利息','分红','收益','收租','租金收入','报销到账','补贴到账','出售闲置','卖闲置','二手转卖']},
  {id:'uncategorized',name:'待分类',keywords:[]}
].map(category=>Object.freeze({...category,keywords:Object.freeze(category.keywords),active:true,version:1})));

const MAX_CENTS=99_999_999_999;
const BUILTIN_CATEGORY_IDS=new Set(DEFAULT_FINANCE_CATEGORIES.map(category=>category.id));
// Shopping channels and vague purchases are fallbacks; the actual item wins.
const GENERAL_SHOPPING_KEYWORDS=new Set(['购物','淘宝','京东','拼多多','买东西','网购']);

export function hasPendingFinanceDraft(draft){
  return Boolean(draft&&typeof draft==='object'&&(['text','expression','purpose','note'].some(key=>String(draft[key]??'').trim())||(Array.isArray(draft.receiptIds)&&draft.receiptIds.length)));
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

// Normalize only amount characters; purpose text and the legacy cents parser stay intact.
export function parseFinanceLines(value,{categories=DEFAULT_FINANCE_CATEGORIES,kind='expense'}={}){
  const rows=[],errors=[];
  if(typeof value!=='string')return {rows,errors:[{line:1,message:'请输入逐行花销'}],totalCents:0};
  if(value.length>6000)return {rows,errors:[{line:1,message:'花销输入最多6000个字符'}],totalCents:0};
  let count=0,totalCents=0;
  for(const [index,raw] of value.split(/\r\n?|\n/).entries()){
    const text=raw.trim(),line=index+1;
    if(!text)continue;
    if(++count>30){errors.push({line,message:'一次最多输入30笔，请分批确认入账'});continue}
    // Greedy amount prefix keeps spaced expressions together rather than accepting
    // an unfinished operator or an extra number as part of the purpose.
    const match=/^([0-9０-９.．+＋−－\s-]+)\s+(\S[\s\S]*)$/.exec(text);
    if(!match){errors.push({line,message:'请按“金额 用途”填写，例如 60 打车'});continue}
    const expression=match[1].trim().replace(/[０-９]/g,digit=>String(digit.charCodeAt(0)-0xff10)).replace(/．/g,'.').replace(/＋/g,'+').replace(/[−－]/g,'-'),purpose=match[2].trim();
    let amountCents;
    try{
      amountCents=parseMoneyExpression(expression);
      if(/^[+＋−－*/×÷=\-]/.test(purpose))throw new Error('金额只支持数字、两位小数和加减，例如 8+8+8-1');
      if(amountCents<=0)throw new Error('金额必须大于零');
      if(purpose.length>160)throw new Error('每笔用途最多160个字符');
    }catch(error){errors.push({line,message:error.message});continue}
    rows.push({line,expression,purpose,amountCents,categoryId:suggestFinanceCategory(purpose,categories,kind)});
    totalCents+=amountCents;
  }
  return {rows,errors,totalCents};
}

export function formatFinanceMoney(cents){
  if(!Number.isSafeInteger(cents))return '—';
  const amount=Math.abs(cents),whole=Math.floor(amount/100).toLocaleString('zh-CN');
  return `${cents<0?'-':''}${whole}.${String(amount%100).padStart(2,'0')}`;
}

export function suggestFinanceCategory(purpose,categories=DEFAULT_FINANCE_CATEGORIES,kind='expense'){
  const text=String(purpose??'').trim().toLowerCase(),active=categories.filter(category=>category.active!==false);
  if(!text)return kind==='income'&&active.some(category=>category.id==='other-income')?'other-income':'uncategorized';
  const purposeOnly=category=>!BUILTIN_CATEGORY_IDS.has(category.id)&&!(Array.isArray(category.keywords)&&category.keywords.length);
  const exact=active.find(category=>String(category.name).toLowerCase()===text);
  if(exact&&!purposeOnly(exact))return exact.id;
  // Empty-keyword custom names are purpose fallbacks, regardless of provenance.
  // A concrete built-in intent wins over both exact and substring fallback names.
  if(active.some(purposeOnly)){
    const builtins=active.filter(category=>BUILTIN_CATEGORY_IDS.has(category.id)),recognized=suggestFinanceCategory(text,builtins,'expense');
    let concrete=recognized!=='uncategorized';
    if(recognized==='shopping'){
      const shopping=builtins.find(category=>category.id==='shopping');
      const shoppingWords=[shopping?.name,...(shopping?.keywords||[]),...DEFAULT_FINANCE_CATEGORIES.find(category=>category.id==='shopping').keywords];
      concrete=['买东西','购物','网购'].includes(text)||shoppingWords.some(word=>{const keyword=String(word??'').trim().toLowerCase();return keyword&&!GENERAL_SHOPPING_KEYWORDS.has(keyword)&&text.includes(keyword)});
    }
    if(concrete)return suggestFinanceCategory(text,active.filter(category=>!purposeOnly(category)),kind);
  }
  if(exact)return exact.id;
  let best=null,score=0;
  for(const category of active){
    const words=[category.name,...(Array.isArray(category.keywords)?category.keywords:[]),...(DEFAULT_FINANCE_CATEGORIES.find(item=>item.id===category.id)?.keywords||[])];
    for(const word of words){
      const keyword=String(word).trim().toLowerCase(),weight=category.id==='shopping'&&GENERAL_SHOPPING_KEYWORDS.has(keyword)?1:keyword.length;
      if(keyword&&text.includes(keyword)&&weight>score){best=category.id;score=weight}
    }
  }
  return best||(kind==='income'&&active.some(category=>category.id==='other-income')?'other-income':'uncategorized');
}

// Preview only: an unrecognized purpose becomes a category on confirmed entry.
export function financeCategoryLabel(purpose,categories=DEFAULT_FINANCE_CATEGORIES,kind='expense'){
  const categoryId=suggestFinanceCategory(purpose,categories,String(purpose??'').trim()?'expense':kind);
  return categoryId==='uncategorized'?(String(purpose??'').trim().slice(0,160)||'待填写用途'):categories.find(category=>category.id===categoryId)?.name||String(purpose??'').trim().slice(0,160);
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
