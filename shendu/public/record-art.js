// Local archive artwork only. The approved overview and review canvases keep their own art.
const art = (scene,terms) => ({scene,terms,src:`/assets/records/${scene}.webp?v=1.0.0-records1`});
export const RECORD_ART = {
  daily: [
    art("daily-01-morning-window",["晨光","早晨","起床","开窗","清晨"]),
    art("daily-02-sleep-rest",["睡眠","睡觉","休息","熬夜","入睡"]),
    art("daily-03-stretch-energy",["精力","运动","锻炼","拉伸","伸展"]),
    art("daily-04-desk-focus",["专注","写报告","工作","书桌","集中"]),
    art("daily-05-reading-corner",["阅读","读书","书籍","看书","读完"]),
    art("daily-06-walk-leaves",["散步","步行","观察","树叶","出门走走"]),
    art("daily-07-small-checklist",["完成","清单","待办","打勾","小目标"]),
    art("daily-08-plant-care",["浇水","植物","养花","照料","盆栽"]),
    art("daily-09-tea-pause",["喝茶","茶","暂停","放松","片刻"]),
    art("daily-10-listen-talk",["倾听","沟通","交谈","聊天","表达"]),
    art("daily-11-tidy-room",["整理","房间","收拾","打扫","整洁"]),
    art("daily-12-cook-meal",["做饭","吃饭","烹饪","用餐","饮食"]),
    art("daily-13-cycle-outdoors",["骑行","自行车","户外","骑车","出游"]),
    art("daily-14-journal-page",["日记","写作","书写","手账","写下来"]),
    art("daily-15-balance-stones",["平衡","稳定","分寸","从容","稳住"]),
    art("daily-16-repair-mend",["修补","修理","修复","缝补","补救"]),
    art("daily-17-clear-inbox",["邮件","收件箱","积压","清空","消息"]),
    art("daily-18-music-break",["音乐","听歌","旋律","乐曲","耳机"]),
    art("daily-19-make-notes",["笔记","灵感","想法","念头","摘记"]),
    art("daily-20-rain-umbrella",["下雨","雨天","雨伞","挫折","逆境"]),
    art("daily-21-sunset-bench",["傍晚","夕阳","落日","黄昏","停留"]),
    art("daily-22-steps-stairs",["进步","台阶","一步","前进","小步"]),
    art("daily-23-protect-time",["时间","边界","守住","拒绝","打扰"]),
    art("daily-24-untangle-thread",["理清","思绪","纠结","思考","头绪"]),
    art("daily-25-garden-path",["成长","园艺","播种","耐心","培育"]),
    art("daily-26-quiet-breath",["呼吸","冥想","安静","平静","正念"]),
    art("daily-27-finish-puzzle",["拼图","拼合","解决","连接","理解"]),
    art("daily-28-night-lamp",["夜晚","台灯","复盘","回顾","夜读"]),
    art("daily-29-share-help",["帮助","分享","支持","感谢","协作"]),
    art("daily-30-tomorrow-bag",["明天","准备","出发","背包","行前"])
  ],
  weekly: [
    art("weekly-01-seven-pages",["本周","一周","回顾","周记","总结"]),
    art("weekly-02-weekly-pattern",["规律","反复","模式","原因","重复"]),
    art("weekly-03-week-priorities",["重点","优先","重要","取舍","排序"]),
    art("weekly-04-unfinished-carry",["未完成","遗留","延后","积压","搁置"]),
    art("weekly-05-week-balance",["休息","平衡","工作","生活","精力"]),
    art("weekly-06-week-path",["进展","走过","过程","经历","轨迹"]),
    art("weekly-07-week-next",["下周","计划","下一步","安排","行动"])
  ],
  monthly: [
    art("monthly-01-month-harvest",["成果","收获","结果","成就","完成"]),
    art("monthly-02-month-system",["系统","流程","方法","机制","整理"]),
    art("monthly-03-month-budget",["预算","资源","支出","投入","开销"]),
    art("monthly-04-month-habit",["习惯","坚持","打卡","日常","养成"]),
    art("monthly-05-month-bottleneck",["瓶颈","阻碍","困难","卡住","问题"]),
    art("monthly-06-month-experiment",["实验","尝试","测试","新方法","调整"]),
    art("monthly-07-month-learning",["学习","复习","课程","知识","技能"]),
    art("monthly-08-month-workspace",["工作空间","工作台","书桌","环境","布置"]),
    art("monthly-09-month-relation",["关系","相处","家人","朋友","沟通"]),
    art("monthly-10-month-energy",["精力","疲惫","恢复","体力","节奏"]),
    art("monthly-11-month-release",["放下","舍弃","清理","告别","负担"]),
    art("monthly-12-month-next",["下月","规划","地图","方向","目标"])
  ],
  quarterly: [
    art("quarterly-01-quarter-spring",["春","萌芽","方向","启动","播种"]),
    art("quarterly-02-quarter-summer",["夏","生长","行动","推进","执行"]),
    art("quarterly-03-quarter-autumn",["秋","收获","证据","成果","验证"]),
    art("quarterly-04-quarter-winter",["冬","校准","下季","复盘","路线"])
  ],
  yearly: [
    art("yearly-01-year-milestones",["里程碑","经历","重要时刻","年度","成就"]),
    art("yearly-02-year-growth",["成长","变化","进步","能力","收获"]),
    art("yearly-03-year-keep",["保留","珍惜","坚持","值得","价值"]),
    art("yearly-04-year-release",["放下","告别","过去","释怀","负担"]),
    art("yearly-05-year-coordinate",["坐标","定位","方向","选择","校准"]),
    art("yearly-06-year-horizon",["未来","明年","期望","愿景","规划"])
  ],
  decision: [
    art("decision-01-decision-question",["问题","疑问","决定","澄清","思考"]),
    art("decision-02-decision-facts",["事实","证据","信息","调查","核实"]),
    art("decision-03-decision-options",["方案","选择","比较","取舍","备选"]),
    art("decision-04-decision-risk",["风险","不确定","预案","代价","后果"]),
    art("decision-05-decision-first",["行动","第一步","开始","执行","尝试"]),
    art("decision-06-decision-return",["验证","复查","结果","调整","回看"])
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
