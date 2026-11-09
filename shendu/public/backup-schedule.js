const WEEKDAYS=['','一','二','三','四','五','六','日'];
const TIME=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
const own=(value,key)=>value!=null&&Object.hasOwn(value,key);
const field=(value,camel,snake)=>own(value,camel)?value[camel]:own(value,snake)?value[snake]:undefined;

// Stored SQL rows and browser/API targets share one scheduling contract.
export function normalizeBackupSchedule(value={},fallback={}){
  const schedule=value.schedule??fallback.schedule??'manual';
  const scheduleTime=field(value,'scheduleTime','schedule_time')??field(fallback,'scheduleTime','schedule_time')??'02:00';
  const day=field(value,'scheduleWeekday','schedule_weekday')??field(fallback,'scheduleWeekday','schedule_weekday')??1;
  if(!['manual','daily','weekly'].includes(schedule))throw new Error('备份周期不正确');
  if(typeof scheduleTime!=='string'||!TIME.test(scheduleTime))throw new Error('备份时间应为有效的时分，例如 02:00');
  if(!/^[1-7]$/.test(String(day)))throw new Error('请选择周一至周日中的一天');
  return {schedule,scheduleTime,scheduleWeekday:Number(day)};
}

export function backupScheduleLabel(target){
  const {schedule,scheduleTime,scheduleWeekday}=normalizeBackupSchedule(target);
  return schedule==='manual'?'仅手动备份':schedule==='daily'?`每天 ${scheduleTime}（北京时间）`:`每周${WEEKDAYS[scheduleWeekday]} ${scheduleTime}（北京时间）`;
}

function beijingDay(value){
  const date=value instanceof Date?value:new Date(value);
  if(!Number.isFinite(date.valueOf()))throw new Error('时间不正确');
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
  return new Date(Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),12));
}
function atTime(day,time){return new Date(`${day.toISOString().slice(0,10)}T${time}:00+08:00`)}

// The last scheduled slot is independent of connection tests and manual runs.
// After downtime only the latest due slot is considered, once, and never before
// the target was created or its schedule changed.
export function backupScheduleDue(target,now=new Date()){
  const {schedule,scheduleTime,scheduleWeekday}=normalizeBackupSchedule(target);
  if(schedule==='manual'||target.enabled===0||target.enabled===false)return null;
  const current=now instanceof Date?now:new Date(now),day=beijingDay(current);
  if(schedule==='weekly')day.setUTCDate(day.getUTCDate()-((day.getUTCDay()||7)-scheduleWeekday+7)%7);
  if(atTime(day,scheduleTime)>current)day.setUTCDate(day.getUTCDate()-(schedule==='daily'?1:7));
  const slot=atTime(day,scheduleTime),anchor=target.schedule_anchor_at??target.scheduleAnchorAt??target.created_at??target.createdAt;
  if(anchor&&Number.isFinite(Date.parse(anchor))&&slot.valueOf()<Date.parse(anchor))return null;
  const last=target.last_scheduled_slot??target.lastScheduledSlot;
  if(last&&Number.isFinite(Date.parse(last))&&Date.parse(last)>=slot.valueOf())return null;
  return slot.toISOString();
}

// Inclusive ten Beijing calendar days: today plus its preceding nine days.
export function backupHistoryCutoff(now=new Date()){
  const day=beijingDay(now);day.setUTCDate(day.getUTCDate()-9);
  return atTime(day,'00:00').toISOString();
}
