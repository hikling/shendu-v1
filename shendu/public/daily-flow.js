import {reviewQuestions,reviewDisabledFields} from './review-schema.js?v=1.0.0-custom1';

export const DAILY_STEPS=[
  {id:'evidence',label:'今日证据',optional:true},
  {id:'reflection',label:'事实与原因',optional:false},
  {id:'action',label:'明日行动',optional:false},
  {id:'journal',label:'日记',optional:true}
];

// Both stored contingency fields share one writing screen.
export function dailyPromptOwner(field){return field==='ifThen'?'ifCondition':field}

export function dailyPrompts(metricCount=3,template={}){
  const disabled=new Set(reviewDisabledFields(template));
  return [
    {id:'sleep',step:'evidence'},{id:'energy',step:'evidence'},
    ...Array.from({length:metricCount},(_,index)=>({id:`metric-${index}`,step:'evidence'})),
    {id:'risk',step:'evidence'},
    ...reviewQuestions('daily',template).map(question=>({...question,step:'reflection',kind:'answer'})),
    {id:'action',step:'action',required:true},{id:'ifCondition',step:'action',required:true},
    {id:'verifyDate',step:'action',required:true},{id:'journal',step:'journal'}
  ].filter(prompt=>!disabled.has(prompt.id));
}
export function dailyPromptNeighbor(prompts,current,direction){
  const index=prompts.findIndex(prompt=>prompt.id===dailyPromptOwner(current)),next=index+direction;
  return index>=0&&next>=0&&next<prompts.length?prompts[next].id:null;
}

function hasText(value){return typeof value==='string'&&value.trim().length>0}
function validDate(value){
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||''));
  if(!match)return false;
  const [year,month,day]=match.slice(1).map(Number),date=new Date(Date.UTC(year,month-1,day,12));
  return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day;
}

// Match the server's daily completion requirements; evidence and journal stay optional.
export function dailyStepIssues(data={},step=null,today,template={}){
  const issues=[],add=(pane,field,reason='required')=>{if(!step||step===pane)issues.push({step:pane,field,reason})};
  for(const question of reviewQuestions('daily',template)){
    const answers=data.answers?.[question.id];
    if(question.required&&(!Array.isArray(answers)||!answers.some(value=>String(value??'').trim())))add('reflection',question.id);
  }
  for(const field of ['action','ifCondition','ifThen'])if(!hasText(data[field]))add('action',field);
  if(!validDate(data.verifyDate)||data.verifyDate<today)add('action','verifyDate','date');
  return issues;
}

export function dailyPromptIssues(data,promptId,today,template={}){
  return dailyStepIssues(data,null,today,template).filter(issue=>dailyPromptOwner(issue.field)===dailyPromptOwner(promptId));
}
