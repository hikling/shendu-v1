// The five longer reviews share one traversal contract. Field labels and
// required flags still come from QUESTIONS and the saved review template.
export const EXTENDED_FLOW = {
  weekly:{intro:'回看七天，找到节奏。',stages:[
    {id:'recap',label:'回看一周',fields:['plan','progress']},
    {id:'pattern',label:'找出规律',fields:['patterns','keepStop']},
    {id:'next',label:'安排下周',fields:['nextThree','action','ifThen','verifyDate']}
  ]},
  monthly:{intro:'看见变化，调整方法。',stages:[
    {id:'result',label:'目标与结果',fields:['goalResult','change']},
    {id:'bottleneck',label:'看见瓶颈',fields:['want','bottleneck']},
    {id:'experiment',label:'小步实验',fields:['experiment','action','ifThen','verifyDate']}
  ]},
  quarterly:{intro:'检视方向，走向下一程。',stages:[
    {id:'evidence',label:'阶段证据',fields:['hope','evidence']},
    {id:'direction',label:'校准方向',fields:['worth','choices']},
    {id:'next',label:'下一阶段',fields:['nextGoals','action','ifThen','verifyDate']}
  ]},
  yearly:{intro:'收好一年，写下未来。',stages:[
    {id:'coordinate',label:'年度坐标',fields:['coordinates','expectations','areas']},
    {id:'release',label:'保留与放下',fields:['decisions','keepRelease']},
    {id:'next',label:'走向明年',fields:['nextYear','action','ifThen','verifyDate']}
  ]},
  decision:{intro:'写清依据，再作选择。',stages:[
    {id:'question',label:'写清问题',fields:['recordTitle','decision','options']},
    {id:'evidence',label:'检查依据',fields:['facts','expectation','failure']},
    {id:'choice',label:'作出选择',fields:['choice','firstStep']},
    {id:'review',label:'约定回看',fields:['action','ifThen','verifyDate']}
  ]}
};

const SPECIAL_FIELDS = new Set(['recordTitle','action','ifThen','verifyDate']);
function hasText(value){return String(value??'').trim().length>0}
function validDate(value){
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||''));
  if(!match)return false;
  const [year,month,day]=match.slice(1).map(Number),date=new Date(Date.UTC(year,month-1,day,12));
  return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day;
}

export function extendedPrompts(type,questions){
  const config=EXTENDED_FLOW[type];
  if(!config)throw new Error(`Unknown review type: ${type}`);
  const questionMap=new Map(questions.map(([key,,required])=>[key,Boolean(required)]));
  const prompts=config.stages.flatMap((stage,stageIndex)=>stage.fields.map(id=>{
    if(!SPECIAL_FIELDS.has(id)&&!questionMap.has(id))throw new Error(`Unknown ${type} review field: ${id}`);
    return{id,stage:stage.id,stageIndex,phase:`${type}-${stage.id}`,required:SPECIAL_FIELDS.has(id)||questionMap.get(id)===true,kind:SPECIAL_FIELDS.has(id)?id:'answer'};
  }));
  const included=new Set(prompts.map(prompt=>prompt.id));
  for(const key of questionMap.keys())if(!included.has(key))throw new Error(`Missing ${type} review field: ${key}`);
  return prompts;
}

export function extendedPromptNeighbor(prompts,current,direction){
  const index=prompts.findIndex(prompt=>prompt.id===current),next=index+direction;
  return index>=0&&next>=0&&next<prompts.length?prompts[next].id:null;
}

export function extendedPromptIssues(data={},title='',prompt,minimum){
  if(!prompt||!prompt.required)return[];
  // The five extended types retain their original rule: ifCondition is optional.
  if(prompt.kind==='ifThen')return hasText(data.ifThen)?[]:[{field:'ifThen',reason:'required'}];
  const value=prompt.kind==='recordTitle'?title:prompt.kind==='answer'?data.answers?.[prompt.id]:data[prompt.id];
  if(prompt.kind==='verifyDate')return validDate(value)&&value>=minimum?[]:[{field:prompt.id,reason:'date'}];
  if(prompt.kind==='answer')return Array.isArray(value)&&value.some(hasText)?[]:[{field:prompt.id,reason:'required'}];
  return hasText(value)?[]:[{field:prompt.id,reason:'required'}];
}

export function extendedReviewIssues(data={},title='',prompts,minimum){
  return prompts.flatMap(prompt=>extendedPromptIssues(data,title,prompt,minimum));
}
