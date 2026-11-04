// Local archive artwork only. The approved overview and review canvases keep their own art.
const art = (directory,scene,terms) => ({scene,terms,src:`/assets/${directory}/${scene}.webp?v=1.0.0-${directory==='daily'?'overview26':'palette2'}`});
export const RECORD_ART = {
  daily: [
    art('daily','sleep',['睡','休息','熬夜']),
    art('daily','energy',['精力','运动','跑步','锻炼']),
    art('daily','evidence',['记录','事实','完成','清单']),
    art('daily','reflection',['观察','原因','反思','思考']),
    art('daily','action',['行动','开始','计划','目标']),
    art('daily','calendar',['安排','时间','日程','日期']),
    art('daily','journal',['阅读','日记','书','写作']),
    art('daily','intro',['生活','日常','节奏'])
  ],
  weekly: [
    art('extended','weekly-recap',['回顾','总结','完成','进展']),
    art('extended','weekly-pattern',['规律','反复','发现','原因']),
    art('extended','weekly-next',['下周','计划','下一步','安排'])
  ],
  monthly: [
    art('extended','monthly-result',['成果','结果','完成','收获']),
    art('extended','monthly-bottleneck',['阻碍','困难','问题','瓶颈']),
    art('extended','monthly-experiment',['实验','尝试','调整','改变'])
  ],
  quarterly: [
    art('extended','quarterly-evidence',['证据','事实','成果','进展']),
    art('extended','quarterly-direction',['方向','选择','取舍','校准']),
    art('extended','quarterly-next',['下季','目标','计划','行动'])
  ],
  yearly: [
    art('extended','yearly-coordinate',['成长','坐标','经历','里程碑']),
    art('extended','yearly-release',['放下','告别','保留','取舍']),
    art('extended','yearly-next',['明年','未来','期望','规划'])
  ],
  decision: [
    art('extended','decision-question',['问题','疑问','决定','思考']),
    art('extended','decision-evidence',['证据','信息','事实','调查']),
    art('extended','decision-choice',['选择','方案','比较','取舍']),
    art('extended','decision-review',['验证','结果','调整','复查'])
  ]
};

function seed(value){let result=2166136261;for(const char of String(value))result=Math.imul(result^char.codePointAt(0),16777619)>>>0;return result}
function words(record){
  const data=record.data||{};
  return [record.title,...Object.values(data.answers||{}).flat(Infinity),data.action,data.journal,record.verification?.result,record.verification?.adjustment].filter(value=>typeof value==='string').join(' ').slice(0,30000).toLowerCase();
}

// Always pass the full record set before filtering. No random rerender changes or persisted image fields.
export function recordArtAssignments(records,catalog=RECORD_ART){
  const assigned=new Map(),unique=[...new Map(records.filter(record=>record?.id).map(record=>[record.id,record])).values()];
  const ordered=unique.sort((a,b)=>String(a.period||'').localeCompare(String(b.period||''))||String(a.id).localeCompare(String(b.id)));
  for(const [type,pool] of Object.entries(catalog)){
    if(!pool.length)continue;
    const uses=new Map(pool.map(image=>[image.src,0]));let previous='';
    for(const record of ordered.filter(item=>item.type===type)){
      const minimum=Math.min(...uses.values());
      let candidates=pool.filter(image=>uses.get(image.src)===minimum);
      if(candidates.length>1)candidates=candidates.filter(image=>image.src!==previous);
      const text=words(record),scores=candidates.map(image=>({image,score:image.terms.filter(term=>text.includes(term.toLowerCase())).length})),best=Math.max(...scores.map(item=>item.score));
      const leaders=scores.filter(item=>item.score===best),selected=leaders[seed(record.id)%leaders.length].image;
      uses.set(selected.src,uses.get(selected.src)+1);previous=selected.src;
      assigned.set(record.id,{src:selected.src,scene:selected.scene});
    }
  }
  return assigned;
}
