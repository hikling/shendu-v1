// Opening words are local UI content, never part of a saved review. Classical
// lines below are public-domain excerpts; unattributed prose is written for Shendu.
export const REVIEW_INTROS = Object.freeze({
  daily: Object.freeze([
    '行到水穷处，坐看云起时。',
    '日暮归来，给今天一个诚实的交代。',
    '把走过的路写下，让明天多一盏灯。',
    '慢一点，把事实和心情分开。',
    '莫听穿林打叶声，何妨吟啸且徐行。',
    '一日之中，总有一件小事值得留下。',
    '为今天收笔，也为明天留白。',
    '山气日夕佳，飞鸟相与还。',
    '不必把一天过成满分，把真实的一天留下。',
    '往者不可谏，来者犹可追。',
    '先安顿此刻的自己，再看看今天发生了什么。',
    '灯下写几行，把寻常的一天慢慢看清。',
  ]),
  weekly: Object.freeze([
    '把七天连成一线，看看生活反复递来的提醒。',
    '横看成岭侧成峰，远近高低各不同。',
    '不以一天论成败，回到一周的起伏里找规律。',
    '这周留下什么，下周便从那里起步。',
    '温故而知新，可以为师矣。',
    '从重复中辨认自己，在取舍中安排下周。',
    '给忙碌留一道问句，什么真正向前了一步？',
    '休息也是节奏的一部分，不妨把空白一并记下。',
    '一周的答案，常藏在几件相似的小事里。',
    '不妨慢行七日，再辨来路与去处。',
    '草木有本心，何求美人折。',
    '把值得继续的事带走，给下一周留一点余地。',
  ]),
  monthly: Object.freeze([
    '问渠那得清如许，为有源头活水来。',
    '把一个月摊开，看见努力背后的方法。',
    '纸上得来终觉浅，绝知此事要躬行。',
    '月有盈亏，人有进退。不妨重新分配心力。',
    '比起做得更多，先找出值得改变的那一处。',
    '一个月的证据，足够让旧方法接受一次追问。',
    '删去一些忙碌，让真正重要的事慢慢生长。',
    '不积小流，无以成江海。',
    '回到月初的心愿，看看什么已经悄悄改变。',
    '把想法交给一次小实验，再把判断交给结果。',
    '流水不争先，争的是绵绵不绝。',
    '给下个月选一个主题，少一点分散的用力。',
  ]),
  quarterly: Object.freeze([
    '欲穷千里目，更上一层楼。',
    '走过一季，再问一次方向。',
    '不积跬步，无以至千里。',
    '把目光放远，看看日常把你带向哪里。',
    '已走的路值得回看，未走的路仍可选择。',
    '把目光放到更远处。回到生活本身，重新校准方向。',
    '三个多月的光阴，换来了哪些真实的不同？',
    '知止而后有定，定而后能静。',
    '有些事值得深耕，有些事该在此刻放下。',
    '给继续一个理由，也给改变留一扇门。',
    '路虽远，行则将至。先认清下一程。',
    '把这一季收进眼底，让下一步更接近本心。',
  ]),
  yearly: Object.freeze([
    '回首向来萧瑟处，归去，也无风雨也无晴。',
    '这一年的山川与人事，都值得被认真记住。',
    '岁月不居，时节如流。愿你看见自己的来路。',
    '年年岁岁花相似，岁岁年年人不同。',
    '不只盘点所得，也看看你学会了怎样生活。',
    '春有百花秋有月，夏有凉风冬有雪。',
    '把一年还给生活，让陪伴与恢复也有位置。',
    '旧年有旧年的答案，新年可以有新的愿望。',
    '人间有味是清欢。回头看看，哪些时刻最想珍惜。',
    '给重要的人留一页，给重要的自己留一页。',
    '回望不是为了盖棺定论，而是为了更自由地选择。',
    '把这一年慢慢合上，带着所得走向新的四季。',
  ]),
  decision: Object.freeze([
    '审问之，慎思之，明辨之，笃行之。',
    '先留下此刻的依据，再把答案交给时间。',
    '不畏浮云遮望眼，自缘身在最高层。',
    '把事实写清，把未知留在它该在的位置。',
    '选择一条路之前，也看看未走的另一条。',
    '谋定而后动，知止而有得。',
    '让倾向经得住追问，让行动有可以回看的依据。',
    '此刻不必预知结局，只需诚实面对已知与未知。',
    '兼听则明，偏信则暗。给另一种可能留一点声音。',
    '选择有所取，也必有所舍。想清楚你愿意承担什么。',
    '把愿望与判断分开，再为第一步选定方向。',
    '心中有尺，行事有据。为未来的自己留下这一页。',
  ]),
});

export function reviewIntroLines(text) {
  return String(text ?? '').split(/(?<=[，。！？；])/u).filter(Boolean);
}

export function reviewIntroLayout(text) {
  const lines = reviewIntroLines(text);
  const longest = Math.max(1, ...lines.map(line => Array.from(line).length));
  return {
    lines,
    columns: longest * 1.045 + .15,
    density: longest > 11 || lines.length > 3 || Array.from(String(text)).length > 32 ? 'long' : 'regular',
  };
}

// Saved record IDs select stable words across visits and reloads. Keep the
// published pool order stable; new unsaved visits alone consume shuffled items.
// Rendering/going back within one visit only reads the already selected words.
export function createReviewIntroPicker({ random = Math.random } = {}) {
  const bags = new Map(), last = new Map();
  let visit = null;
  function enter(type, recordId = null) {
    const pool = REVIEW_INTROS[type];
    if (!pool) throw new RangeError(`Unknown review intro type: ${type}`);
    if (typeof recordId === 'string' && recordId.length) {
      let hash = 2166136261;
      for (const unit of `${type}\0${recordId}`) hash = Math.imul(hash ^ unit.codePointAt(0), 16777619) >>> 0;
      visit = { type, text: pool[hash % pool.length] };
      return visit.text;
    }
    let bag = bags.get(type);
    if (!bag?.length) {
      bag = [...pool];
      for (let index = bag.length - 1; index > 0; index--) {
        const sample = Number(random());
        const target = Math.min(index, Math.max(0, Math.floor((Number.isFinite(sample) ? sample : 0) * (index + 1))));
        [bag[index], bag[target]] = [bag[target], bag[index]];
      }
      if (bag.at(-1) === last.get(type)) [bag[0], bag[bag.length - 1]] = [bag.at(-1), bag[0]];
      bags.set(type, bag);
    }
    const text = bag.pop();
    last.set(type, text);
    visit = { type, text };
    return text;
  }
  return {
    enter,
    current(type) { return visit?.type === type ? visit.text : enter(type); },
  };
}
