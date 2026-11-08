// Shared by the browser and server: labels, stable answer IDs and required flags
// travel with a completed record rather than following later settings changes.
export const REVIEW_QUESTIONS = {
  daily:[['today','今天，哪件事最值得记下来？',1],['cause','是什么让它发生？',0]],
  weekly:[['plan','这周原本要完成什么？实际呢？',1],['progress','本周最有价值的三个进展',1],['patterns','反复出现的成功条件与阻碍',0],['keepStop','下周保留一件事，停止一件事',0],['nextThree','下周最重要的三件事',1]],
  monthly:[['goalResult','月初的目标与现在的结果',1],['change','哪个变化真正改善了生活？',1],['want','这些目标，仍然是我想要的吗？',0],['bottleneck','下个月只主攻哪一个瓶颈？',1],['experiment','一个小实验：假设、做法、成功标准',1]],
  quarterly:[['hope','这一阶段原本希望生活发生什么变化？',1],['evidence','90 天后，哪些变化有证据？',1],['worth','目标值得继续吗？付出的代价能接受吗？',0],['choices','继续、调整、停止：分别是什么？',1],['nextGoals','下一阶段最多三个目标',1]],
  yearly:[['coordinates','用五件事，留下这一年的坐标',1],['expectations','年初的期待，哪些成为了现实？',1],['areas','人生几个重要领域，分别发生了什么？',0],['decisions','最重要的决定，现在怎么看？',0],['keepRelease','我想保留什么，又该放下什么？',1],['nextYear','明年的主题与最多三个目标',1]],
  decision:[['decision','我正在做什么决定？为什么现在要做？',1],['options','有哪些选项？包括维持现状',1],['facts','我现在掌握哪些事实？哪些仍未知？',1],['expectation','预期结果、概率与出现的时间',1],['failure','如果决定失败，最可能因为什么？',1],['choice','最终选择与理由',1],['firstStep','决定后的第一步行动',1]]
};

const DAILY_OPTIONAL_FIELDS = ['sleep','energy','risk','journal'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const labelText = value => typeof value === 'string' ? value.trim().slice(0,160) : '';

export function reviewQuestions(type, template = {}) {
  const defaults = Object.hasOwn(REVIEW_QUESTIONS,type) ? REVIEW_QUESTIONS[type] : [];
  const source = object(template) ? template : {};
  const byId = new Map(defaults.map(([id,label,required]) => [id,{id,label,required:Boolean(required)}]));
  if (!Array.isArray(source.questions)) return defaults.map(([id,label,required]) => ({id,label:labelText(source[id])||label,required:Boolean(required)}));
  const questions = [], seen = new Set();
  for (const value of source.questions) {
    if (!object(value) || typeof value.id !== 'string' || seen.has(value.id)) continue;
    const base = byId.get(value.id);
    if (!base && !/^custom_[a-zA-Z0-9_-]{1,73}$/.test(value.id)) continue;
    const label = labelText(value.label) || (base ? labelText(source[value.id]) || base.label : '');
    if (!label) continue;
    const required = typeof value.required === 'boolean' ? value.required : Boolean(base?.required);
    questions.push({id:value.id,label,required});
    seen.add(value.id);
    if (questions.length === 30) break;
  }
  return questions;
}

export function reviewDisabledFields(template = {}) {
  const fields = object(template) && Array.isArray(template.disabledFields) ? template.disabledFields : [];
  return DAILY_OPTIONAL_FIELDS.filter(field => fields.includes(field));
}
