export const FINANCE_KINDS=Object.freeze({expense:'支出',income:'收入',refund:'退款',transfer:'不计收支'});

export const DEFAULT_FINANCE_CATEGORIES=Object.freeze([
  {id:'food',name:'餐饮',keywords:['早餐','早饭','午餐','午饭','晚餐','晚饭','吃饭','聚餐','团建','餐厅','餐饮','饭店','外卖','夜宵','宵夜','火锅','烧烤','自助餐','小吃','零食','饮料','咖啡','奶茶','水果','超市食品','买菜','菜钱','菜市场','菜场','蔬菜','食材','生鲜','猪肉','牛肉','羊肉','鸡肉','鸭肉','鸡蛋','海鲜','水产','大米','面粉','食用油','调味料','酱油','牛奶','酸奶','面包','蛋糕','甜品','饼干','坚果','饮用水','矿泉水','盒饭','便当','食堂','餐费','饭钱','面馆','快餐','麻辣烫','米线','螺蛳粉','包子','饺子','汉堡','披萨','炸鸡','烤肉','面条','米饭','炒饭','炒面','炒粉','米粉','河粉','粉条','方便面','泡面','挂面','面食','拉面','牛肉面','馄饨','馒头','花卷','烧饼','煎饼','饭团','肠粉','油条','豆浆','豆腐','豆制品','土豆','番茄','西红柿','黄瓜','青菜','白菜','萝卜','菠菜','茄子','辣椒','蘑菇','玉米','红薯','鸡腿','排骨','鱼肉','鱼虾','虾仁','香肠','火腿肠','肉丸','冷冻食品','速冻食品','食用盐','白糖','醋调料','调料','粮油','早餐店','早餐铺','便利店早餐','买点吃的','买吃的','吃点东西','吃东西','喝粥','买粥','粥店','买早点','早茶','下午茶','茶饮','饮品','甜点','冰淇淋','雪糕','可乐','果汁','啤酒','白酒','餐酒','纯净水','桶装水','电解质水','外卖餐费','肯德基','麦当劳','华莱士','蜜雪冰城','瑞幸','喜茶','奈雪','茶百道','霸王茶姬','星巴克']},
  {id:'transport',name:'交通',keywords:['打车','滴滴','出租车','网约车','地铁','公交','高铁','火车','机票','加油','停车','通行费','过路费','车票','交通费','路费','打的','顺风车','代驾','共享单车','骑行费','公交卡','地铁卡','充电桩','汽车充电','电动车充电','高速费','高速通行','停车场','停车费','洗车','修车','保养车','车辆保养','汽车保养','汽车维修','打摩的','摩的','轮渡','船票','客运','客车','大巴','巴士','动车','动车票','飞机票','航空票','汽车票','租车','租车费','代步车','出行费','网约单车','单车月卡','骑车费用','补胎','换轮胎','轮胎','车险','年检费','车辆年检','汽车美容','汽车清洗','换机油','机油','充电费','公交充值','交通卡充值','快递费','邮寄','寄件','寄快递','寄东西','运费','配送费','搬运费','顺丰快递','菜鸟裹裹']},
  {id:'shopping',name:'购物',keywords:['购物','日用品','淘宝','京东','衣服','买鞋','数码','拼多多','纸巾','洗衣液','洗发水','护肤','化妆品','生活用品','买东西','网购','买衣服','衣裤','裤子','外套','羽绒服','鞋子','袜子','内衣','背包','箱包','洗漱用品','牙膏','牙刷','沐浴露','洗洁精','垃圾袋','卫生纸','卫生巾','剃须刀','买菜刀','菜刀','锅具','厨具','餐具','床单','被子','枕头','毛巾','家具','家电','冰箱','洗衣机','空调','买手机','换手机','手机壳','充电器','充电线','耳机','键盘','鼠标','显示器','买电脑','笔记本电脑','电池','文具','打印纸','办公用品','宠物用品','买点东西','购买东西','买些东西','买点小东西','买了东西','买杂物','日常采购','日常购物','商场购物','超市购物','网购下单','网上购物','网上买','实体店购物','线下购物','逛街购物','天猫','抖音商城','小红书商城','唯品会','苏宁易购','得物','买衣物','衣物','服装','短袖','衬衫','卫衣','毛衣','裙子','连衣裙','牛仔裤','运动鞋','拖鞋','凉鞋','皮鞋','帽子','围巾','手套','雨伞','雨衣','眼影','口红','面霜','面膜','乳液','防晒霜','洗面奶','卸妆','洗护用品','护发素','洗手液','清洁用品','消毒湿巾','湿巾','保鲜袋','保鲜膜','保鲜盒','收纳盒','收纳柜','储物箱','垃圾桶','晾衣架','衣架','扫把','拖把','水杯','保温杯','饭盒','餐盘','碗筷','水果刀','削皮刀','面条机','面包机','豆浆机','咖啡机','电饭煲','电磁炉','空气炸锅','烤箱','电水壶','吸尘器','风扇','电暖器','电热毯','床垫','被套','被芯','窗帘','沙发','桌椅','书桌','台灯','灯泡','插座','插排','数据线','移动电源','充电宝','蓝牙音箱','路由器','平板电脑','手机配件','电脑配件','打印机','墨盒','硒鼓','宠物粮','猫粮','狗粮','猫砂','玩具','积木','充电电池']},
  {id:'housing',name:'居住',keywords:['房租','房贷','水费','电费','燃气','物业','宽带','话费','租金','租房','房屋租赁','煤气','天然气','网费','手机套餐','通讯费','通信费','维修房屋','房屋维修','装修','家政','保洁','搬家','住宿','酒店','宾馆','民宿','暖气费','取暖费','供暖费','热水费','供水费','水电费','水电煤','燃气费','物业费','房屋租金','租赁费','管理费','网络费','电话费','手机话费','手机充值','流量包','流量费','话费充值','宽带续费','通讯套餐','通信套餐','电视费','有线电视费','住宿费','酒店房费','住房','住店','旅馆','青年旅舍','维修水管','水管维修','开锁','换锁','保洁费','钟点工','家政费']},
  {id:'health',name:'医疗',keywords:['医院','药店','看病','挂号','体检','医疗','买药','药品','药费','医药','诊所','门诊','住院','手术','治疗','牙医','牙科','补牙','拔牙','洗牙','疫苗','接种','检查费','化验','复诊','配眼镜','验光','口罩','消毒液','感冒药','退烧药','止痛药','消炎药','止咳药','药房','中药','中医','西药','保健药','医疗器械','医用耗材','创可贴','绷带','医用棉签','医用酒精','处方药','医疗保险','医保缴费','门诊费','住院费','挂号费','护理费','诊疗费','诊疗','理疗','康复治疗','牙套','矫正牙齿','口腔','隐形眼镜','眼药水','医疗检查','核磁共振','ct检查','核酸检测','验血']},
  {id:'learning',name:'学习',keywords:['学费','课程','教材','买书','书店','考试','培训','书籍','图书','报班','网课','在线课程','辅导班','补习','报考','报名费','考试费','考证','驾校','学习资料','教辅','学杂费','托班','幼儿园','绘本','书本','买课','购课','知识付费','线上学习','在线学习','学习课程','论文打印','打印资料','教辅资料','练习册','字帖','工具书','参考书','英语课','钢琴课','舞蹈课','美术课','兴趣班','培训班','自习室','学习机','点读笔','家教','补课','托管费','留学费用','大学学费','学校缴费']},
  {id:'entertainment',name:'娱乐',keywords:['电影','游戏','旅游','门票','会员','健身','影院','演唱会','音乐会','展览','博物馆','游乐园','游泳','羽毛球','篮球','足球','台球','保龄球','棋牌','剧本杀','密室逃脱','露营','景区','景点','游玩','唱歌','ktv','网吧','游戏充值','视频会员','音乐会员','运动场','看电影','电影票','演出票','演出','音乐节','戏剧','话剧','歌剧','脱口秀','相声','桌游','电竞','游戏币','手游充值','steam游戏','追剧','视频订阅','腾讯视频','爱奇艺','优酷会员','哔哩哔哩会员','网易云会员','qq音乐会员','付费音乐','出游','旅行','度假','度假村','露营地','游船','公园门票','儿童乐园','蹦床','攀岩','滑雪','滑冰','瑜伽','普拉提','运动课程','健身房','健身卡','球场费','球馆','场地费','钓鱼','足浴','足疗']},
  {id:'social',name:'人情',keywords:['礼物','红包','礼金','请客','份子钱','随礼','随份子','压岁钱','婚礼','喜酒','结婚礼金','生日礼物','节日礼物','孝敬','赡养','捐款','捐赠','人情往来','人情费','生日红包','婚庆红包','结婚红包','礼品','礼盒','贺礼','贺金','乔迁礼','乔迁红包','满月酒','百日宴','升学宴','慰问金','探望长辈','孝敬父母','给爸妈','赡养费','公益捐助','公益捐款','慈善捐款','随份','随份子钱']},
  {id:'salary',name:'工资',keywords:['工资','薪资','薪水','奖金','绩效','年终奖','加班费','基本工资','提成','发薪','薪酬','月薪','底薪','基本薪资','工资到账','工资入账','出勤奖','全勤奖','年终奖金','年中奖金','业绩提成','销售提成','餐补到账','交通补贴到账']},
  {id:'other-income',name:'其他收入',keywords:['兼职','收入','报酬','利息','分红','收益','收租','租金收入','报销到账','补贴到账','出售闲置','卖闲置','二手转卖','劳务费','酬劳','稿费','佣金','项目款','服务费收入','交易返现','返利到账','政府补贴','报销款','助学金','奖学金','意外收入','捡到的钱','闲置出售','卖二手','二手出售','租金到账']},
  {id:'uncategorized',name:'待分类',keywords:[]}
].map(category=>Object.freeze({...category,keywords:Object.freeze(category.keywords),active:true,version:1})));

const MAX_CENTS=99_999_999_999;
const BUILTIN_CATEGORY_IDS=new Set(DEFAULT_FINANCE_CATEGORIES.map(category=>category.id));
// Shopping channels and vague purchases are fallbacks; the actual item wins.
const SHOPPING_PURPOSE_KEYWORDS=new Set(['购物','买东西','网购','买点东西','购买东西','买些东西','买点小东西','买了东西','买杂物','日常采购','日常购物','商场购物','超市购物','网购下单','网上购物','网上买','实体店购物','线下购物','逛街购物']);
const SHOPPING_CHANNEL_KEYWORDS=['淘宝','京东','拼多多','天猫','抖音商城','小红书商城','唯品会','苏宁易购','得物'];
const GENERAL_SHOPPING_KEYWORDS=new Set([...SHOPPING_PURPOSE_KEYWORDS,...SHOPPING_CHANNEL_KEYWORDS]);
// Matching tolerates OCR spacing/fullwidth glyphs; stored purpose/custom names stay intact.
const categoryMatchText=value=>String(value??'').normalize('NFKC').trim().toLowerCase().replace(/[\s\u200b\ufeff]+/g,'');
function isShoppingPurpose(text){
  if(SHOPPING_PURPOSE_KEYWORDS.has(text))return true;
  let purpose=text.replace(/^(?:在|去)/,'');
  for(const channel of [...SHOPPING_CHANNEL_KEYWORDS,'商场','超市','实体店','网上','线下']){if(purpose.startsWith(channel)){purpose=purpose.slice(channel.length).replace(/^上/,'');break}}
  return SHOPPING_PURPOSE_KEYWORDS.has(purpose);
}

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
  const text=String(purpose??'').trim().toLowerCase(),matchedText=categoryMatchText(text),active=categories.filter(category=>category.active!==false);
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
      concrete=isShoppingPurpose(matchedText)||shoppingWords.some(word=>{const keyword=categoryMatchText(word);return keyword&&!GENERAL_SHOPPING_KEYWORDS.has(keyword)&&matchedText.includes(keyword)});
    }
    if(concrete)return suggestFinanceCategory(text,active.filter(category=>!purposeOnly(category)),kind);
  }
  if(exact)return exact.id;
  let best=null,score=0,bestCustomRule=false;
  for(const category of active){
    const builtin=BUILTIN_CATEGORY_IDS.has(category.id),customRule=!builtin&&Array.isArray(category.keywords)&&category.keywords.length>0,words=[category.name,...(Array.isArray(category.keywords)?category.keywords:[]),...(DEFAULT_FINANCE_CATEGORIES.find(item=>item.id===category.id)?.keywords||[])];
    for(const word of words){
      const keyword=builtin?categoryMatchText(word):String(word).trim().toLowerCase(),weight=category.id==='shopping'&&GENERAL_SHOPPING_KEYWORDS.has(keyword)?1:keyword.length;
      if(keyword&&(builtin?matchedText:text).includes(keyword)&&(weight>score||weight===score&&customRule&&!bestCustomRule)){best=category.id;score=weight;bestCustomRule=customRule}
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
