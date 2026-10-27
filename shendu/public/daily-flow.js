export const DAILY_STEPS=[
  {id:'evidence',label:'今日证据',optional:true},
  {id:'reflection',label:'事实与原因',optional:false},
  {id:'action',label:'明日行动',optional:false},
  {id:'journal',label:'日记',optional:true}
];

export function dailyPrompts(metricCount=3){
  return [
    {id:'sleep',step:'evidence'},{id:'energy',step:'evidence'},
    ...Array.from({length:metricCount},(_,index)=>({id:`metric-${index}`,step:'evidence'})),
    {id:'risk',step:'evidence'},{id:'today',step:'reflection'},{id:'cause',step:'reflection'},
    {id:'action',step:'action'},{id:'ifCondition',step:'action'},{id:'ifThen',step:'action'},
    {id:'verifyDate',step:'action'},{id:'journal',step:'journal'}
  ];
}
export function dailyPromptNeighbor(prompts,current,direction){
  const index=prompts.findIndex(prompt=>prompt.id===current),next=index+direction;
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
export function dailyStepIssues(data={},step=null,today){
  const issues=[],add=(pane,field,reason='required')=>{if(!step||step===pane)issues.push({step:pane,field,reason})};
  if(!(data.answers?.today||[]).some(value=>String(value).trim()))add('reflection','today');
  for(const field of ['action','ifCondition','ifThen'])if(!hasText(data[field]))add('action',field);
  if(!validDate(data.verifyDate)||data.verifyDate<today)add('action','verifyDate','date');
  return issues;
}

export function dailyPromptIssues(data,promptId,today){
  return dailyStepIssues(data,null,today).filter(issue=>issue.field===promptId);
}
