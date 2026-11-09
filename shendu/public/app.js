import {backupScheduleLabel} from './backup-schedule.js?v=1.0.0-backups1';
import {normalizeReviewMetricIds,reconcileReviewMetrics} from './review-metrics.js?v=1.0.0-custom1';
import {reviewQuestions,reviewDisabledFields} from './review-schema.js?v=1.0.0-custom1';
import {renderMarkup,disposeUi,prepareDialogContainer,initializeToasts,showDialog,dismissDialog,showMenu,showVerificationCalendar,showStageCalendar,showToast} from './ui/shadcn.js?v=1.0.0-reviewcivil2';
import {overviewRecordAppearances,overviewVerifiedRecords,overviewRecordExcerpt,overviewLoopMetrics,overviewRecordTitle,overviewDateParts} from './overview-reel.js?v=1.0.0-overview15';
import {DAILY_STEPS,dailyStepIssues,dailyPrompts,dailyPromptIssues,dailyPromptNeighbor,dailyPromptOwner} from './daily-flow.js?v=1.0.0-custom1';
import {dailyCalendarModel,dailyCalendarDateLabel} from './daily-calendar.js?v=1.0.0-art1';
import {EXTENDED_FLOW,extendedPrompts,extendedPromptNeighbor,extendedPromptIssues,extendedReviewIssues} from './extended-flow.js?v=1.0.0-custom1';
import {verificationMinimum} from './verification-policy.js?v=1.0.0-verification2';
import {createReviewNavigator} from './review-navigation.js?v=1.0.0-pages1';
import {RECORD_ART,recordArtAssignments} from './record-art.js?v=1.0.0-records1';
import {createReviewIntroPicker,reviewIntroLines,reviewIntroLayout} from './review-intros.js?v=1.0.0-intros1';
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = (v = '') => String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const clone = v => JSON.parse(JSON.stringify(v));
const TYPES = {
  daily:{label:'每日复盘',meta:'每日看行动 · 5–8m',position:'看行动',date:'date'},
  weekly:{label:'每周复盘',meta:'找规律 · 30–45m',position:'找规律',date:'week'},
  monthly:{label:'每月复盘',meta:'调系统 · 45–60m',position:'调系统',date:'month'},
  quarterly:{label:'90 天复盘',meta:'校方向 · 60–90m',position:'校方向',date:'date'},
  yearly:{label:'年度复盘',meta:'看人生 · 90–120m',position:'看人生',date:'year'},
  decision:{label:'重大决策',meta:'留依据 · 20–30m',position:'留依据',date:'date'}
};
const TYPE_ICONS = {daily:'日',weekly:'周',monthly:'月',quarterly:'季',yearly:'年',decision:'决'};
const NAV_ICON_PATHS = {
  daily:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h8M8 17h5"/>',
  weekly:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h4M14 14h3M7 18h4"/>',
  monthly:'<circle cx="12" cy="12" r="9"/><path d="M12 3v9l5 3"/>',
  quarterly:'<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
  yearly:'<path d="M4 20V4h16v16H4ZM8 8h8M8 12h8M8 16h5"/>',
  decision:'<path d="M12 3 4 7v5c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V7l-8-4Z"/><path d="m9 12 2 2 4-4"/>',
  history:'<path d="M3 12a9 9 0 1 0 2.4-6.1M3 4v4h4M12 7v5l3 2"/>',
  actions:'<path d="M4 5h16M4 12h16M4 19h16M7 3v4M7 10v4M7 17v4"/>',
  backup:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M10 13h4"/>',
  users:'<circle cx="9" cy="8" r="3"/><path d="M3 19v-1a6 6 0 0 1 12 0v1M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5"/>'
};
function navIcon(route){return `<span class="${TYPE_ICONS[route]?'nav-type-icon type-'+route:'nav-glyph'}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${NAV_ICON_PATHS[route]||NAV_ICON_PATHS.daily}</svg></span>`}
const STATUS = {draft:'草稿',completed:'已完成',verified:'已验证'};
const DEFAULT_ACCENTS = {primary:'#176B67',secondary:'#A86436',tertiary:'#536C9C'};
const reviewIntros = createReviewIntroPicker();
const QUESTIONS = {
  daily:[['today','今天，哪件事最值得记下来？',1],['cause','是什么让它发生？',0]],
  weekly:[['plan','这周原本要完成什么？实际呢？',1],['progress','本周最有价值的三个进展',1],['patterns','反复出现的成功条件与阻碍',0],['keepStop','下周保留一件事，停止一件事',0],['nextThree','下周最重要的三件事',1]],
  monthly:[['goalResult','月初的目标与现在的结果',1],['change','哪个变化真正改善了生活？',1],['want','这些目标，仍然是我想要的吗？',0],['bottleneck','下个月只主攻哪一个瓶颈？',1],['experiment','一个小实验：假设、做法、成功标准',1]],
  quarterly:[['hope','这一阶段原本希望生活发生什么变化？',1],['evidence','90 天后，哪些变化有证据？',1],['worth','目标值得继续吗？付出的代价能接受吗？',0],['choices','继续、调整、停止：分别是什么？',1],['nextGoals','下一阶段最多三个目标',1]],
  yearly:[['coordinates','用五件事，留下这一年的坐标',1],['expectations','年初的期待，哪些成为了现实？',1],['areas','人生几个重要领域，分别发生了什么？',0],['decisions','最重要的决定，现在怎么看？',0],['keepRelease','我想保留什么，又该放下什么？',1],['nextYear','明年的主题与最多三个目标',1]],
  decision:[['decision','我正在做什么决定？为什么现在要做？',1],['options','有哪些选项？包括维持现状',1],['facts','我现在掌握哪些事实？哪些仍未知？',1],['expectation','预期结果、概率与出现的时间',1],['failure','如果决定失败，最可能因为什么？',1],['choice','最终选择与理由',1],['firstStep','决定后的第一步行动',1]]
};

const DEFAULT_REVIEW_TEMPLATES = Object.fromEntries(Object.entries(QUESTIONS).map(([type,questions])=>[type,{
  ...Object.fromEntries(questions.map(([key,label])=>[key,label])),
  actionTitle:type==='daily'?'明天最重要的一件事':'接下来，具体要做什么？',
  obstacleTitle:'如果遇到阻碍，那么我就……',
  verifyDateTitle:type==='daily'?'预期何时验证？':'预期什么时候验证？',
  ...(type==='decision'?{recordTitle:'决定的名字'}:{})
}]));
const DEFAULT_ACTION_TEMPLATE = {
  pageTitle:'行动验证',pageIntro:'预期验证日期和实际提交时间会同时保留，提前、按期或延后完成一眼可见。',historyButton:'查看全部历史',
  pendingTitle:'等待验证',pendingIntro:'按预期日期排列，实际验证时间将在提交时自动记录。',pendingEmptyTitle:'没有等待验证的行动',pendingEmptyText:'完成一份复盘后，约定的行动会出现在这里。',
  verifiedTitle:'已经验证',verifiedIntro:'保留预期与实际时间，便于以后判断是否提前完成。',verifiedEmptyTitle:'还没有已验证行动',verifiedEmptyText:'提交第一条验证结果后会显示在这里。',
  waitingStatus:'等待验证',overdueStatus:'已过约定日期',todayStatus:'今天验证',verifiedStatus:'已验证',countUnit:'项',earlyTimingText:'提前 {days} 天完成',lateTimingText:'晚于预期 {days} 天完成',onTimeText:'按预期日期完成',
  expectedDateLabel:'预期验证日期',actualDateLabel:'实际验证时间',expectedMissingText:'未设置',actualMissingText:'尚未验证',
  agreementEyebrow:'行动约定',agreementTitle:'复盘时锁定的计划',agreementNote:'原始记录',originalActionTitle:'原定行动',planTitle:'如果—那么预案',
  reviewEyebrow:'验证回看',reviewTitle:'实际结果与后续调整',reviewNote:'已永久锁定',resultTitle:'实际结果',adjustmentTitle:'保留或调整',
  ifLabel:'如果',thenLabel:'那么',responseLabel:'应对',missingActionText:'未填写行动',missingPlanText:'未填写预案',missingResponseText:'未填写应对动作',missingResultText:'未填写',
  submitActionButton:'提交验证结果',decisionActionButton:'进入结果后回看',viewRecordButton:'查看原复盘与验证结果',
  modalTitle:'提交行动验证',decisionModalTitle:'结果后回看',modalIntro:'提交后，验证结果与实际提交时间都会永久锁定。',originalActionLabel:'原定行动',actualAutoText:'提交时自动记录（北京时间）',
  resultPrompt:'实际发生了什么？与预期差在哪里？',outcomePrompt:'结果如何？',processPrompt:'当时的决策过程？',adjustmentPrompt:'我会保留、修正什么判断？',cancelButton:'取消',submitButton:'提交并锁定结果',
  decisionOutcomeLabel:'结果',decisionProcessLabel:'过程',lockedTitle:'行动验证结果',lockedIntro:'结果、预期日期与实际提交时间均已锁定。',
  lockedPendingTitle:'结果还没有验证',lockedPendingIntro:'无需等到当天；提前完成也可以直接提交，系统会记录实际验证时间。',lockedPendingButton:'填写行动验证'
};

function mergeReviewTemplate(type,value){const template={...DEFAULT_REVIEW_TEMPLATES[type],...(value&&typeof value==='object'?value:{})};return{...template,questions:reviewQuestions(type,template),disabledFields:reviewDisabledFields(template)}}
function mergeActionTemplate(value){return{...DEFAULT_ACTION_TEMPLATE,...(value&&typeof value==='object'?value:{})}}
function currentReviewTemplate(type){return mergeReviewTemplate(type,state.stage?.reviewTemplates?.[type])}
function currentActionTemplate(){return mergeActionTemplate(state.stage?.actionTemplate)}
function templatesForRecord(record){
  if(!record||(record.status==='draft'&&record.period===defaultPeriod(record.type)))return{review:currentReviewTemplate(record?.type||'daily'),action:currentActionTemplate()};
  const snapshot=record.data?.templateSnapshot;
  return{review:mergeReviewTemplate(record.type,snapshot?.review),action:mergeActionTemplate(snapshot?.action)};
}
function currentTemplateSnapshot(type){return{version:1,review:clone(currentReviewTemplate(type)),action:clone(currentActionTemplate())}}

const state = { user:null, stage:null, theme:null, records:[], stats:{week:0,pending:0,total:0}, route:'overview', current:null, dirty:false, saving:false, navOpen:false, reauthOpen:false, calendarMonth:null, dailySection:'intro', dailyPrompt:null, extendedPrompt:null, historyFilter:{q:'',type:'all',year:'all',month:'all'} };
const reviewNavigation=createReviewNavigator({
  source:()=>({route:state.route,scrollY:window.scrollY}),
  guard:next=>attemptNavigate(next),
  open:({type,period,forceNew=false,record=null})=>{
    reviewIntros.enter(type);
    state.route=type;state.current=record;
    document.title=`${TYPES[type].label} · 慎独`;
    renderReview(type,period,forceNew,record);
  },
  restore:context=>{
    navigate(context.route);
    requestAnimationFrame(()=>{
      if(state.route!==context.route)return;
      const trigger=context.recordId?$$('[data-open-record],[data-calendar-record]').find(button=>(button.dataset.openRecord||button.dataset.calendarRecord)===context.recordId):null;
      trigger?.focus({preventScroll:true});
      window.scrollTo({top:context.scrollY,behavior:'instant'});
    });
  }
});
function enterReview(type,period,forceNew=false,record=null){reviewNavigation.enter({type,period,forceNew,record})}

let modalReturnFocus=null;
let overviewReelObserver=null;
let dailyTypingTimer=null,dailyTypingCleanup=null;
async function request(path, options = {}) {
  const opts = { credentials:'same-origin', ...options, headers:{ ...(options.body && !(options.body instanceof Blob) && !(options.body instanceof ArrayBuffer) ? {'Content-Type':'application/json'} : {}), ...(options.headers||{}) } };
  if (opts.body && opts.headers['Content-Type']==='application/json' && typeof opts.body !== 'string') opts.body = JSON.stringify(opts.body);
  const res = await fetch(path,opts); const type=res.headers.get('content-type')||''; const data=type.includes('json')?await res.json():await res.blob();
  if(!res.ok){if(res.status===401&&state.user&&!state.reauthOpen&&!path.startsWith('/api/auth/'))sessionExpired();const e=new Error(data.message||'请求失败');e.code=data.error;e.status=res.status;throw e} return data;
}
function sessionExpired(){state.reauthOpen=true;openModal(`<div class="modal-head"><div><span class="legacy-kicker">记录仍在 · 重新连接</span><h2>登录已失效</h2><p>重新登录后，页面中尚未保存的内容仍会保留。</p></div><div class="legacy-dialog-art" aria-hidden="true"><img src="/assets/records/daily-28-night-lamp.webp" alt="" width="640" height="640" draggable="false"></div></div><form id="reauth-form"><div class="field"><label for="reauth-username">用户名</label><input id="reauth-username" name="username" value="${esc(state.user.username)}" readonly autocomplete="username"></div><div class="field"><label for="reauth-password">密码</label><input id="reauth-password" name="password" type="password" minlength="15" required autocomplete="current-password"></div><div class="modal-actions"><button class="btn btn-primary">重新登录</button></div></form>`,'legacy-reauth',true);const form=$('#reauth-form'),account=state.user,current=()=>form.isConnected&&state.user===account&&state.reauthOpen;let pending=false;form.addEventListener('submit',async e=>{e.preventDefault();if(pending||!current())return;const body=JSON.stringify(Object.fromEntries(new FormData(form))),controls=$$('button,input',form),disabled=controls.map(control=>control.disabled);pending=true;controls.forEach(control=>{control.disabled=true});try{const res=await fetch('/api/auth/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body});const data=await res.json();if(!current())return;if(!res.ok)throw new Error(data.message||'登录失败');state.reauthOpen=false;closeModal(true);toast('已重新登录，请再次保存')}catch(error){if(current())toast(error.message||'登录失败','error')}finally{pending=false;if(form.isConnected)controls.forEach((control,index)=>{control.disabled=disabled[index]})}})}
function toast(message,kind='success'){showToast($('#toast-root'),message,kind)}
function contrastFor(hex){const h=String(hex).replace('#','');if(!/^[0-9a-f]{6}$/i.test(h))return'#fff';const [r,g,b]=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*r+.7152*g+.0722*b>.52?'#201d19':'#fff'}
function applyTheme(theme){const t=theme||state.theme||{},r=document.documentElement;Object.entries(DEFAULT_ACCENTS).forEach(([key,color])=>{r.style.setProperty(`--${key}`,color);r.style.setProperty(`--${key}-contrast`,contrastFor(color))});document.body.classList.toggle('reduce-motion',!!t.reduceMotion);if(t.reduceMotion)cancelDailyTypewriter()}
const BEIJING_TIME_ZONE='Asia/Shanghai';
function beijingDateParts(value=new Date()){const parts=new Intl.DateTimeFormat('en-US',{timeZone:BEIJING_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(value);const result=Object.fromEntries(parts.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return{year:Number(result.year),month:Number(result.month),day:Number(result.day),iso:`${result.year}-${result.month}-${result.day}`}}
function today(){return beijingDateParts().iso}
function isoDate(value){const [year,month,day]=String(value).split('-').map(Number);return new Date(Date.UTC(year,month-1,day,12))}
function shiftIsoDate(value,days){const d=isoDate(value);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
function weekValue(value=today()){const x=isoDate(value);const day=x.getUTCDay()||7;x.setUTCDate(x.getUTCDate()+4-day);const y=new Date(Date.UTC(x.getUTCFullYear(),0,1));return `${x.getUTCFullYear()}-W${String(Math.ceil((((x-y)/86400000)+1)/7)).padStart(2,'0')}`}
function defaultPeriod(type){const current=today();if(type==='weekly')return weekValue(current);if(type==='monthly')return current.slice(0,7);if(type==='yearly')return current.slice(0,4);return current}
function shiftMonth(value,amount){const match=/^(\d{4})-(\d{2})$/.exec(String(value)),current=beijingDateParts(),base=match?new Date(Date.UTC(Number(match[1]),Number(match[2])-1,1,12)):new Date(Date.UTC(current.year,current.month-1,1,12));base.setUTCMonth(base.getUTCMonth()+Number(amount||0));return`${base.getUTCFullYear()}-${String(base.getUTCMonth()+1).padStart(2,'0')}`}
function formatDate(v){if(!v)return'';if(/^\d{4}-W\d{2}$/.test(v))return`${v.slice(0,4)} 年第 ${Number(v.slice(6))} 周`;if(/^\d{4}$/.test(v))return`${v} 年`;const match=/^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(v);if(!match)return String(v);const d=new Date(Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3]||1),12));return new Intl.DateTimeFormat('zh-CN',{timeZone:BEIJING_TIME_ZONE,year:'numeric',month:'long',day:match[3]?'numeric':undefined,weekday:match[3]?'short':undefined}).format(d)}
function beijingTime(value){const d=new Date(value);return Number.isNaN(d.valueOf())?'':new Intl.DateTimeFormat('zh-CN',{timeZone:BEIJING_TIME_ZONE,hour:'2-digit',minute:'2-digit',hour12:false}).format(d)}
function beijingDateTime(value){const d=new Date(value);return Number.isNaN(d.valueOf())?'':new Intl.DateTimeFormat('zh-CN',{timeZone:BEIJING_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d)}
function quoteFor(type){return reviewIntros.current(type)}
function recordFor(type,period){return state.records.find(r=>r.type===type&&r.period===period&&!((type==='decision')&&r.id!==state.current?.id))}
function newRecord(type,period){const data={answers:{},action:'',ifCondition:'',ifThen:'',verifyDate:'',journal:'',metrics:[],sleep:'',energy:'',risk:'',templateSnapshot:currentTemplateSnapshot(type)};return {id:null,type,period,title:'',data,status:'draft',version:0}}

function renderAuth(info={}){
  cancelDailyTypewriter();setDailyImmersive(false);
  dismissDialog($('#rail-root'));closeModal(true);
  reviewNavigation.clear();state.historyFilter={q:'',type:'all',year:'all',month:'all'};
  const registering=info.mode==='register'||info.firstRun;
  state.user=null;state.reauthOpen=false;renderMarkup($('#app'),`<main class="auth-shell auth-paper-shell"><div class="auth-book">
    <section class="auth-art"><div class="brand-lockup"><div class="brand-row"><span class="seal header-seal" aria-hidden="true">慎</span><span class="brand-cn header-wordmark">慎獨</span></div><span class="auth-brand-note">个人成长复盘</span></div>
      <div class="auth-story"><p class="legacy-kicker">在日常里，慢慢看见自己</p><div class="auth-quote"><span>言寡尤，行寡悔</span><span>慎独存诚</span></div><p class="auth-story-note">把经历写下，<br>把清醒留给下一步。</p></div>
      <div class="auth-scene" aria-hidden="true"><span class="auth-scene-paper"></span><img src="/assets/records/daily-01-morning-window.webp" alt="" width="640" height="640" draggable="false"></div>
      <div class="auth-art-footer"><span>记录事实</span><i aria-hidden="true"></i><span>调整行动</span><i aria-hidden="true"></i><span>验证改变</span></div></section>
    <section class="auth-panel"><form class="auth-card" id="auth-form"><div class="auth-form-head"><span class="legacy-kicker">${registering?'从这一页开始':'好久不见，欢迎回来'}</span><h1>${info.firstRun?'<span>建立自己的</span><strong>复盘室</strong>':registering?'<span>为自己，</span><strong>留一页纸</strong>':'<span>回到自己的</span><strong>复盘室</strong>'}</h1><p>${info.firstRun?'第一个注册账户将成为唯一超级管理员。':'留一段安静的时间，接着写下自己的故事。'}</p></div>
      ${info.mode==='register'||info.firstRun?`<div class="field"><label for="displayName">称呼</label><input id="displayName" name="displayName" maxlength="32" autocomplete="name" placeholder="例如：止水"></div>`:''}
      <div class="field"><label for="username">用户名</label><input id="username" name="username" minlength="3" maxlength="32" autocomplete="username" required placeholder="汉字、字母、数字或 _ . -"></div>
      <div class="field"><label for="password">密码</label><input id="password" name="password" minlength="15" maxlength="128" type="password" autocomplete="${info.mode==='register'||info.firstRun?'new-password':'current-password'}" required><span class="help">至少 15 个字符。请使用密码管理器保存。</span><label class="help password-visibility" for="show-password"><input id="show-password" type="checkbox"><span>显示密码</span></label></div>
      <div class="error-text" id="auth-error" role="status" aria-live="polite"></div><button class="btn btn-primary btn-block" type="submit">${registering?'创建账户并进入':'登录'}</button>
      ${!info.firstRun&&info.registrationOpen?`<p class="help auth-switch-note">${info.mode==='register'?'已有账户？':'还没有账户？'} <button class="link-button" type="button" id="auth-switch">${info.mode==='register'?'返回登录':'自行注册'}</button></p>`:''}
      <p class="auth-privacy-note"><span aria-hidden="true"></span>你的记录，只属于你。</p>
    </form></section></div></main>`);
  const form=$('#auth-form'),current=()=>form.isConnected&&state.user===null;let pending=false;
  form.addEventListener('submit',async e=>{e.preventDefault();if(pending||!current())return;const body=Object.fromEntries(new FormData(form)),controls=$$('button,input',form),disabled=controls.map(control=>control.disabled);const registering=info.firstRun||info.mode==='register';pending=true;controls.forEach(control=>{control.disabled=true});try{const data=await request(`/api/auth/${registering?'register':'login'}`,{method:'POST',body});if(current())await boot(data.user)}catch(err){if(current())$('#auth-error',form).textContent=err.message}finally{pending=false;if(form.isConnected)controls.forEach((control,index)=>{control.disabled=disabled[index]})}});
  $('#show-password').addEventListener('change',e=>{$('#password').type=e.target.checked?'text':'password'});
  $('#auth-switch')?.addEventListener('click',()=>renderAuth({...info,mode:info.mode==='register'?'login':'register'}));
}

function headerLink(route,label,extra=''){return `<button class="header-link ${state.route===route?'active':''}" type="button" data-nav="${route}" ${state.route===route?'aria-current="page"':''}>${esc(label)}${extra}</button>`}
function headerBrandContent(){return '<span class="seal header-seal" aria-hidden="true">慎</span><span class="brand-cn header-wordmark">慎獨</span>'}
function topbar(){
  const actionLabel=currentActionTemplate().pageTitle;
  const accountName=state.user.displayName||state.user.username;
  return `<header class="topbar shendu-header" id="site-header">
    <div class="header-inner">
      <button class="header-brand" type="button" data-nav="overview" aria-label="慎独，返回概览">${headerBrandContent()}</button>
      <nav class="header-nav" aria-label="主导航">
        ${headerLink('overview','概览')}
        ${headerLink('history','历史复盘')}
        ${headerLink('actions',actionLabel,state.stats.pending?`<span class="header-count">${Number(state.stats.pending)}</span>`:'')}
      </nav>
      <div class="header-actions">
        <button class="header-rail-button ${state.route==='calendar'?'active':''}" type="button" id="rail-toggle" data-nav="calendar" ${state.route==='calendar'?'aria-current="page"':''}>阶段与日历</button>
        <div class="header-menu header-account-menu" data-ui-native>
          <button class="header-account-trigger" type="button" data-menu-trigger aria-expanded="false" aria-controls="account-menu" aria-label="账户菜单：${esc(accountName)}"><span class="header-avatar" aria-hidden="true">${esc(accountName[0])}</span><span class="header-account-name">${esc(accountName)}</span><span class="header-chevron" aria-hidden="true"></span></button>
          <div class="header-menu-panel account-menu" id="account-menu" hidden>
            <span class="header-menu-caption">我的空间</span>
            <button class="header-menu-item ${state.route==='backup'?'active':''}" type="button" data-nav="backup" ${state.route==='backup'?'aria-current="page"':''}>${navIcon('backup')}<span>数据备份</span></button>
            <button class="header-menu-item ${state.route==='users'?'active':''}" type="button" data-nav="users" ${state.route==='users'?'aria-current="page"':''}>${navIcon('users')}<span>账户管理</span></button>
            <button class="header-menu-item ${state.route==='settings'?'active':''}" type="button" id="settings-trigger" data-nav="settings" ${state.route==='settings'?'aria-current="page"':''}>${navIcon('monthly')}<span>设置</span></button>
          </div>
        </div>
        <button class="header-mobile-trigger" type="button" id="menu-toggle" data-ui-native data-menu-trigger aria-expanded="false" aria-controls="mobile-nav" aria-label="打开顶部菜单"><span></span><span></span><span></span></button>
      </div>
    </div>
    <nav class="header-mobile-nav" id="mobile-nav" data-ui-native aria-label="手机导航" hidden>
      <div class="mobile-nav-main">${headerLink('overview','概览')}${headerLink('history','历史复盘')}${headerLink('actions',actionLabel)}</div>
      <div class="mobile-nav-bottom"><button type="button" class="${state.route==='backup'?'active':''}" data-nav="backup" ${state.route==='backup'?'aria-current="page"':''}>数据备份</button><button type="button" class="${state.route==='users'?'active':''}" data-nav="users" ${state.route==='users'?'aria-current="page"':''}>账户管理</button><button type="button" id="mobile-settings-trigger" data-nav="settings" ${state.route==='settings'?'aria-current="page"':''}>设置</button></div>
    </nav>
  </header>`;
}
function shell(content){cancelDailyTypewriter();setDailyImmersive(false);overviewReelObserver?.disconnect();overviewReelObserver=null;const overview=state.route==='overview';renderMarkup($('#app'),`<div class="app-shell ${overview?'overview-shell':''}">${topbar()}<div class="workspace"><main class="main ${overview?'overview-main':''}" id="main-content">${content}</main></div></div>`);bindCommon()}

function overviewText(value,limit){const text=String(value??'').replace(/\s+/g,' ').trim(),points=Array.from(text);return points.length>limit?points.slice(0,limit).join('')+'…':text}
function overviewRecordCard(record,appearance,duplicate=false,index=0){
  const day=overviewDateParts(record.period),date=day?day.full:formatDate(record.period),display=overviewRecordTitle(record,date,TYPES[record.type].label),summary=overviewText(overviewRecordExcerpt(record,recordSummary(record)),106);
  const customTitle=day&&!display.showDate?display.title.replace(date,'').replace(/^[\s·•:：|—–-]+|[\s·•:：|—–-]+$/g,''):display.title;
  const title=overviewText(customTitle,58),dateOnly=day?!title:display.title===date,layout=dateOnly?'note':appearance.layout;
  const copy=day?`<time class="overview-record-date ${dateOnly?'overview-record-date-primary':''}" datetime="${esc(record.period)}"><span>${esc(day.calendarDate)}</span><span>${esc(day.weekday)}</span></time>${title?`<strong class="overview-record-title">${esc(title)}</strong>`:''}`:`${display.showDate?`<time class="overview-record-date">${esc(date)}</time>`:''}<strong class="overview-record-title">${esc(title)}</strong>`;
  return `<button type="button" class="overview-record-card type-${record.type} record-layout-${layout} ${day?'record-has-weekday':''} ${day&&title?'record-has-title':''}" ${duplicate?'aria-hidden="true" tabindex="-1"':''} style="--reel-order:${index}" data-overview-record="${esc(record.id)}">
    <span class="overview-record-surface">
      <span class="overview-record-top"><span class="overview-record-category"><span class="overview-record-glyph" aria-hidden="true">${TYPE_ICONS[record.type]}</span><span>${esc(TYPES[record.type].label)}</span></span><span class="overview-record-status"><i aria-hidden="true"></i>${STATUS[record.status]}</span></span>
      <span class="overview-record-content"><span class="overview-record-copy">${copy}</span><span class="overview-record-art" aria-hidden="true"><img src="/assets/reel-emotions/${appearance.art}.webp?v=1.0.0-overview13" alt="" width="120" height="120"></span></span>
      <span class="overview-record-summary">${esc(summary)}</span>
      <span class="overview-record-footer" aria-hidden="true"><span>${esc(TYPES[record.type].position)}</span><span class="overview-record-open">翻开这页 <span>↗</span></span></span>
    </span>
  </button>`;
}
function overviewRecords(){
  const records=overviewVerifiedRecords(state.records,TYPES);
  for(let i=records.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[records[i],records[j]]=[records[j],records[i]]}
  return records;
}
function bindOverviewArc(){
  const window=$('.overview-reel-window'),track=$('.overview-reel-track');
  if(!window||!track)return;
  const originals=$$('.overview-record-card:not([aria-hidden="true"])',track),curve=document.createElementNS('http://www.w3.org/2000/svg','path');
  const layout=()=>{
    const width=window.clientWidth,cardWidth=originals[0].offsetWidth,cardHeight=originals[0].offsetHeight,gap=parseFloat(getComputedStyle(track).columnGap)||0,rise=Math.min(150,Math.max(78,width*.115));
    const style=getComputedStyle(originals[0]),scale=parseFloat(style.getPropertyValue('--record-hover-scale')),lift=parseFloat(style.getPropertyValue('--record-hover-lift'));
    const elapsed=originals[0].getAnimations().find(animation=>animation.animationName==='overview-flow')?.currentTime||0;
    let minY=Infinity,maxY=-Infinity;
    // Include tilted corners and the lifted surface, but only where they enter the viewport.
    // This keeps the reel compact without chopping cards at its top or bottom edges.
    for(let step=0;step<=96;step++){
      const t=step/96,x=-cardWidth+(width+2*cardWidth)*t,y=4*rise*t*(1-t),angle=Math.atan2(4*rise*(1-2*t),width+2*cardWidth),cos=Math.cos(angle),sin=Math.sin(angle);
      for(const [zoom,raise] of [[1,0],[scale,lift]]){
        const halfWidth=cardWidth*zoom/2,top=-cardHeight/2-raise-(zoom-1)*cardHeight,bottom=cardHeight/2-raise;
        const corners=[[-halfWidth,top],[halfWidth,top],[halfWidth,bottom],[-halfWidth,bottom]].map(([cx,cy])=>({x:x+cx*cos-cy*sin,y:y+cx*sin+cy*cos}));
        const visible=corners.filter(point=>point.x>=0&&point.x<=width);
        corners.forEach((point,index)=>{
          const next=corners[(index+1)%corners.length];
          for(const boundary of [0,width])if(boundary>Math.min(point.x,next.x)&&boundary<Math.max(point.x,next.x))visible.push({y:point.y+(next.y-point.y)*(boundary-point.x)/(next.x-point.x)});
        });
        for(const point of visible){minY=Math.min(minY,point.y);maxY=Math.max(maxY,point.y)}
      }
    }
    const edge=Math.ceil(24-minY);
    const arc=`M ${-cardWidth} ${edge} Q ${width/2} ${edge+rise*2} ${width+cardWidth} ${edge}`;
    curve.setAttribute('d',arc);
    const metrics=overviewLoopMetrics(originals.length,curve.getTotalLength(),cardWidth,gap),extension=metrics.extension;
    if(track.children.length!==metrics.slots){
      $$('.overview-record-card[aria-hidden="true"]',track).forEach(card=>card.remove());
      const copies=document.createDocumentFragment();
      for(let group=1;group<metrics.groups;group++)for(const original of originals){const copy=original.cloneNode(true);copy.setAttribute('aria-hidden','true');copy.tabIndex=-1;copies.append(copy)}
      track.append(copies);
    }
    const cards=$$('.overview-record-card',track);
    cards.forEach((card,index)=>card.style.setProperty('--reel-order',index));
    const path=`M ${-cardWidth-extension} ${edge} L ${-cardWidth} ${edge} Q ${width/2} ${edge+rise*2} ${width+cardWidth} ${edge} L ${width+cardWidth+extension} ${edge}`;
    curve.setAttribute('d',path);
    track.style.setProperty('--reel-count',metrics.slots);
    track.style.setProperty('--reel-path',`path('${path}')`);
    track.style.setProperty('--reel-duration',`${metrics.length/42}s`);
    // Newly added loop copies share the originals' clock after a resize.
    cards.forEach(card=>card.getAnimations().filter(animation=>animation.animationName==='overview-flow').forEach(animation=>{animation.currentTime=elapsed}));
    window.style.setProperty('--reel-height',`${Math.ceil(edge+maxY+56)}px`);
  };
  const observer=new ResizeObserver(()=>{if(window.isConnected)layout();else observer.disconnect()});
  overviewReelObserver=observer;
  observer.observe(window);
  layout();
}
function overviewBurst(){
  return `<span class="overview-type-burst" aria-hidden="true">${Array.from({length:12},(_,index)=>{const angle=index*Math.PI/6,reach=.78+(index%3)*.06;return `<i style="--burst-x:${(Math.sin(angle)*reach).toFixed(3)};--burst-y:${(-Math.cos(angle)*reach).toFixed(3)};--burst-turn:${index*53}deg;--burst-delay:${90+index%3*16}ms"></i>`}).join('')}</span>`;
}
function renderOverview(){
  const records=overviewRecords();
  const appearances=overviewRecordAppearances(records);
  const categories=Object.entries(TYPES).map(([key,item])=>`<div class="overview-type-card type-${key}"><button class="overview-type-trigger" type="button" data-overview-type="${key}" data-nav="${key}" aria-label="进入${item.label}"><span class="overview-type-flip" aria-hidden="true"><span class="overview-type-mark overview-type-front"><img src="/assets/overview/${key}.svg?v=1.0.0-overview13" alt="" width="320" height="320"></span><span class="overview-type-back"><strong><span>${key==='quarterly'?'季度':item.label.slice(0,2)}</span><span>${key==='quarterly'?'复盘':item.label.slice(2)}</span></strong></span></span>${overviewBurst()}</button></div>`).join('');
  const cardSet=records.map((record,index)=>overviewRecordCard(record,appearances.get(record.id),false,index)).join('');
  const reel=records.length?`<div class="overview-reel" id="overview-reel">
      <div class="overview-reel-window" aria-label="已验证复盘摘要"><div class="overview-reel-track" style="--reel-count:${records.length}">${cardSet}</div></div>
    </div>`:`<section class="overview-empty" aria-labelledby="overview-empty-title"><h2 id="overview-empty-title">还没有已验证的复盘</h2><p>写下行动的实际结果后，这里会出现你的回看卡片。</p><button type="button" data-nav="actions">去行动验证 <span aria-hidden="true">↗</span></button></section>`;
  shell(`<div class="overview-page">
    <section class="overview-hero" aria-labelledby="overview-title"><h1 id="overview-title">言寡尤，行寡悔<br><em>慎独存诚</em></h1><p>把事实、调整与验证，留成一份不会被情绪改写的记录。</p></section>
    <section class="overview-types" aria-labelledby="overview-types-title"><div class="overview-types-heading"><h2 id="overview-types-title">从哪里开始复盘？</h2></div><div class="overview-type-grid">${categories}</div></section>
    ${reel}
  </div>`);
  $('.overview-reel-track')?.addEventListener('click',event=>{const button=event.target.closest('[data-overview-record]');if(!button)return;const record=records.find(item=>item.id===button.dataset.overviewRecord);if(record?.status==='verified')enterReview(record.type,record.period,false,record)});
  bindOverviewArc();
}

const SPACE_PAGE_META = {
  history:{mark:'册',note:'循迹 · 归档有序'},
  actions:{mark:'验',note:'闭环 · 让行动有回音'},
  backup:{mark:'匣',note:'守存 · 密文归档'},
  users:{mark:'印',note:'账户 · 安心记录'},
  settings:{mark:'序',note:'日常 · 自有秩序'},calendar:{mark:'历',note:'在日常中 · 看见自己'},stage:{mark:'标',note:'定标 · 慢慢向前'},guide:{mark:'书',note:'循序 · 从容落笔'}
};

const WORKSPACE_SCENES={backup:'yearly-03-year-keep',users:'daily-29-share-help',account:'decision-04-decision-risk',settings:'monthly-08-month-workspace',calendar:'daily-07-small-checklist',stage:'quarterly-04-quarter-winter',guide:'daily-05-reading-corner'};
function workspaceArt(key,className=''){return `<span class="workspace-art ${esc(className)}" aria-hidden="true"><span class="workspace-art-paper"></span><img src="/assets/records/${esc(WORKSPACE_SCENES[key])}.webp?v=1.0.0-records1" alt="" width="640" height="640" draggable="false"></span>`}
function spacePageHead(route,{title,description,action=''}){return `<header class="workspace-hero"><div class="workspace-hero-copy"><p class="workspace-kicker">${esc(SPACE_PAGE_META[route].note)}</p><h1 id="workspace-${esc(route)}-title">${esc(title)}</h1><p class="workspace-description">${esc(description)}</p>${action?`<div class="workspace-hero-action">${action}</div>`:''}</div>${workspaceArt(route,'workspace-hero-art')}</header>`}

function stageProgress(){const start=isoDate(state.stage.startDate),current=isoDate(today()),day=Math.max(1,Math.floor((current-start)/86400000)+1),days=Number(state.stage.days||90);return{day:Math.min(day,days),days,pct:Math.min(100,Math.max(0,day/days*100))}}
function renderCalendar(){
  const p=stageProgress(),pending=state.records.filter(record=>record.status==='completed').sort((a,b)=>String(a.data.verifyDate).localeCompare(String(b.data.verifyDate))).slice(0,2),t=currentActionTemplate();
  shell(`<section class="workspace-page workspace-calendar" aria-labelledby="workspace-calendar-title">${spacePageHead('calendar',{title:'阶段与日历',description:'把每天留下的足迹，放回正在走的这一段路。'})}${statsHtml()}<div class="calendar-workspace-grid"><section class="workspace-panel calendar-paper" aria-labelledby="calendar-paper-title"><div id="stage-calendar"></div></section><div class="calendar-context"><section class="workspace-panel stage-panel stage-panel-current" aria-labelledby="calendar-current-title"><div class="stage-current-top"><span class="stage-panel-eyebrow">当前阶段</span><span class="stage-current-day">第 <strong>${p.day}</strong> / ${p.days} 天</span></div><h2 id="calendar-current-title">${esc(state.stage.name)}</h2><p class="stage-current-focus">${esc(state.stage.focus)}</p><div class="progress stage-current-progress" aria-label="当前阶段进度"><i style="width:${p.pct}%"></i></div><div class="stage-current-bottom"><span>${esc(formatDate(state.stage.startDate))} 起 · 共 ${p.days} 天</span><button type="button" class="stage-text-action" id="calendar-edit-stage">编辑阶段设置 <span aria-hidden="true">↗</span></button></div></section><section class="workspace-panel stage-panel stage-panel-pending" aria-labelledby="calendar-pending-title"><header class="stage-pending-header"><h2 id="calendar-pending-title">最近待验证</h2><span>${state.stats.pending} ${esc(t.countUnit)}</span></header>${pending.length?pending.map(record=>`<button type="button" class="stage-pending-item" data-open-action="${esc(record.id)}"><span class="stage-pending-meta"><span>${esc(TYPES[record.type].label)}</span><time>${esc(record.data.verifyDate||'未定日期')}</time></span><span class="stage-pending-copy">${esc(record.data.action||'未填写行动')}</span><span class="stage-pending-open" aria-hidden="true">↗</span></button>`).join(''):`<div class="stage-empty"><h3>暂时没有待验证行动</h3><p>完成复盘后，约定的行动会在这里等待回看。</p></div>`}<button type="button" class="stage-text-action stage-view-actions" data-nav="actions">查看全部行动 <span aria-hidden="true">→</span></button></section></div></div></section>`);
  $('#calendar-edit-stage').addEventListener('click',()=>openStage('calendar'));bindCalendar();
}

function statsHtml(){const t=currentActionTemplate();return `<section class="stage-summary rail-stats" aria-label="复盘概览">
  <button type="button" class="stage-summary-item stage-summary-first" data-nav="daily"><span class="stage-summary-label">本周每日复盘 <span aria-hidden="true">↗</span></span><strong>${state.stats.week}<small> / 7 天</small></strong></button>
  <button type="button" class="stage-summary-item" data-nav="actions"><span class="stage-summary-label">${esc(t.pendingTitle)} <span aria-hidden="true">↗</span></span><strong>${state.stats.pending}<small> ${esc(t.countUnit)}</small></strong></button>
  <button type="button" class="stage-summary-item" data-nav="history"><span class="stage-summary-label">累计完成复盘 <span aria-hidden="true">↗</span></span><strong>${state.stats.total}<small> 篇</small></strong></button>
</section>`}
function dailyAnswerPreview(value){const text=String(value).trim().replace(/\s+/g,' '),characters=Array.from(text);return characters.length>72?`${characters.slice(0,72).join('')}…`:text||'尚未填写'}
function answerItemRow(key,label,value,index,locked){return `<div class="item-row"><textarea class="control" aria-label="${esc(label)}${index?`（补充 ${index+1}）`:''}" data-answer="${key}" data-index="${index}" maxlength="6000" ${locked?'readonly':''} placeholder="先写事实，再写判断。">${esc(value)}</textarea>${index?`<button class="remove-btn" aria-label="删除这一项" type="button" data-remove-item="${key}" data-index="${index}" ${locked?'disabled':''}>×</button>`:''}</div>`}
function answerAddButton(key,count,locked){return count<5&&!locked?`<button class="add-item" type="button" data-add-item="${key}">＋ 再补充一项</button>`:''}
function dailyAnswerInputs(key,label,list,locked){return `<div class="question question-embedded" data-question="${key}"><div class="item-list">${list.map((value,index)=>`<details class="daily-answer" data-daily-answer ${index===list.length-1?'open':''}><summary><span class="daily-answer-number">记录 ${String(index+1).padStart(2,'0')}</span><span class="daily-answer-preview" data-answer-preview>${esc(dailyAnswerPreview(value))}</span><span class="daily-answer-toggle"><span class="answer-open-copy">收起</span><span class="answer-closed-copy">${locked?'查看':'修改'}</span><i aria-hidden="true"></i></span></summary>${answerItemRow(key,label,value,index,locked)}</details>`).join('')}</div>${answerAddButton(key,list.length,locked)}</div>`}
function itemInputs(key,label,required,values=[''],locked=false,accessibleLabel=''){const list=(Array.isArray(values)&&values.length?values:['']).slice(0,5),head=label?`<div class="question-label"><span>${esc(label)}</span></div>`:'';if(state.current?.type==='daily'&&['today','cause'].includes(key))return dailyAnswerInputs(key,accessibleLabel||label||key,list,locked);return `<div class="question ${label?'':'question-embedded'}" data-question="${key}">${head}<div class="item-list">${list.map((v,i)=>answerItemRow(key,accessibleLabel||label||key,v,i,locked)).join('')}</div>${answerAddButton(key,list.length,locked)}</div>`}
function gaugePresentation(kind,value,target,max){
  // Native number can keep an invalid editing buffer ("-", "1e+") while its value is empty.
  const raw=String(value??'').trim(),hasValue=raw!==''&&Number.isFinite(Number(raw)),n=hasValue?Number(raw):0,pct=Math.min(max,Math.max(0,n))/max*100,delta=n-Number(target),unit=kind==='sleep'?'小时':'分',inputCh=hasValue?Array.from(raw).reduce((width,character)=>width+(character==='.'?.5:1),.12):4.12;
  if(!hasValue)return{hasValue,pct,inputCh,reading:'等待填写',status:kind==='sleep'?'记录实际时长，也可以跳过。':'记录此刻的感受，也可以跳过。'};
  const amount=kind==='sleep'?Math.abs(delta).toFixed(1):String(Number(Math.abs(delta).toFixed(1)));
  return{hasValue,pct,inputCh,reading:delta===0?'与个人基线一致':delta>0?'高于个人基线':'低于个人基线',status:delta===0?`个人基线 ${target} ${unit}`:`比基线${delta>0?'多':'少'} ${amount} ${unit}`};
}
function gaugeCard(kind,label,value,target,locked){
  const sleep=kind==='sleep',max=sleep?24:100,unit=sleep?'小时':'/ 100',title=sleep?'睡眠时长':'精力分值',ticks=sleep?[0,6,12,18,24]:[0,25,50,75,100],view=gaugePresentation(kind,value,target,max),targetPct=Math.min(100,Math.max(0,Number(target)||0)/max*100),id=`daily-gauge-${kind}`;
  return `<div class="gauge-card ${kind}" data-gauge-kind="${kind}" data-gauge-target="${esc(target)}" data-gauge-max="${max}">
    <div class="gauge-reading"><label class="gauge-number-field" for="${id}"><input id="${id}" type="number" data-simple="${kind}" data-gauge-input min="0" max="${max}" step="${sleep?'.5':'5'}" value="${esc(value??'')}" style="--gauge-input-width:${view.inputCh}ch" ${locked?'disabled':''} aria-label="${title}，${label}" aria-describedby="${id}-hint ${id}-status" placeholder="${sleep?'输入时长':'输入分值'}"><span class="gauge-unit" aria-hidden="true">${unit}</span></label></div>
    <div class="gauge-state" id="${id}-status"><strong data-gauge-reading>${view.reading}</strong><span data-gauge-status>${esc(view.status)}</span></div>
    <div class="gauge-reference"><div class="gauge-reference-head"><span>${sleep?'时长参考（小时）':'精力参考'}</span><span class="gauge-baseline"><i aria-hidden="true"></i>个人基线 ${esc(target)}${sleep?' 小时':' 分'}</span></div>
      <div class="gauge" aria-hidden="true"><span data-gauge-fill style="width:${view.pct}%" ${view.hasValue?'':'hidden'}></span>${ticks.map((_,index)=>`<em class="gauge-tick" style="left:${index*25}%"></em>`).join('')}<i style="left:${targetPct}%"></i><b data-gauge-knob style="left:${view.pct}%" ${view.hasValue?'':'hidden'}></b></div>
      <div class="gauge-scale" aria-hidden="true">${ticks.map((tick,index)=>`<span style="left:${index*25}%">${tick}</span>`).join('')}</div>
    </div><p class="gauge-input-hint" id="${id}-hint">${sleep?'可输入 0—24 小时':'可输入 0—100 分'}，刻度仅作对照。</p>
  </div>`;
}
function updateGauge(input){
  const card=input.closest('[data-gauge-kind]');if(!card)return;
  const view=gaugePresentation(card.dataset.gaugeKind,input.value,card.dataset.gaugeTarget,Number(card.dataset.gaugeMax)),fill=$('[data-gauge-fill]',card),knob=$('[data-gauge-knob]',card);
  input.style.setProperty('--gauge-input-width',`${view.inputCh}ch`);
  fill.hidden=!view.hasValue;fill.style.width=`${view.pct}%`;knob.hidden=!view.hasValue;knob.style.left=`${view.pct}%`;
  $('[data-gauge-reading]',card).textContent=view.reading;$('[data-gauge-status]',card).textContent=view.status;
}
function dailyEvidence(data,locked){const metrics=data.metrics||[];return `<section class="card section-card folio-card daily-evidence-card">
  <div class="daily-prompt" data-daily-prompt="sleep" hidden>${gaugeCard('sleep','昨夜睡眠测度',data.sleep,state.stage.sleepTarget,locked)}</div>
  <div class="daily-prompt" data-daily-prompt="energy" hidden>${gaugeCard('energy','主观精力值刻度',data.energy,state.stage.energyTarget,locked)}</div>
  ${metrics.map((m,i)=>`<div class="daily-prompt metric-ledger" data-daily-prompt="metric-${i}" hidden><div class="metric-row metric-${i}"><i></i><div class="metric-copy"><b>${esc(m.name)}</b><small>${esc(m.target)}</small><textarea data-metric-action="${i}" aria-label="${esc(m.name)}：今天的具体行动" maxlength="6000" placeholder="今天的具体行动" ${locked?'readonly':''}>${esc(m.action||'')}</textarea></div><div class="metric-status-control"><select data-metric-status="${i}" aria-label="${esc(m.name)}完成状态" ${locked?'disabled':''}><option value="">未记录</option>${['已达标','部分达标','未达标','计划休息'].map(x=>`<option ${m.status===x?'selected':''}>${x}</option>`).join('')}</select><span class="metric-status-chevron" aria-hidden="true"></span></div></div></div>`).join('')}
  <div class="daily-prompt" data-daily-prompt="risk" hidden><div class="risk-note"><span>!</span><div><b>风险信号与偏离对策</b><textarea data-simple="risk" aria-label="风险信号与偏离对策" maxlength="6000" ${locked?'readonly':''} placeholder="记下具体偏离，以及准备怎样应对">${esc(data.risk||'')}</textarea></div></div></div></section>`}

function dailyReflection(data,locked,template){return `<section class="card section-card folio-card">${reviewQuestions('daily',template).map(question=>`<div class="daily-prompt reflection-question" data-daily-prompt="${esc(question.id)}" hidden>${dailyAnswerInputs(question.id,question.label,Array.isArray(data.answers?.[question.id])&&data.answers[question.id].length?data.answers[question.id].slice(0,5):[''],locked)}</div>`).join('')}</section>`}

function dailyVerificationCalendar(value,locked,label){const minimum=verificationMinimum(state.current.type,today()),model=dailyCalendarModel(value,minimum,'',locked,'',today());return `<div class="daily-date-picker" role="group" aria-label="${esc(label)}"><input type="hidden" data-simple="verifyDate" value="${esc(value||'')}" ${locked?'disabled':''}><p class="daily-calendar-selection" id="daily-verify-selection" aria-live="polite" aria-atomic="true">${esc(dailyCalendarDateLabel(value))}</p><div id="daily-verification-calendar" data-verify-month-value="${model.month}" data-verify-locked="${locked}"></div></div>`}
function renderDailyCalendar(month,focusDate='',focusMonth=''){
  const calendar=$('#daily-verification-calendar');if(!calendar)return;
  const input=$('[data-simple="verifyDate"]'),locked=calendar.dataset.verifyLocked==='true',minimum=verificationMinimum(state.current.type,today()),model=dailyCalendarModel(input.value,minimum,month,locked,focusDate,today());
  calendar.dataset.verifyMonthValue=model.month;
  showVerificationCalendar(calendar,{value:input.value,minimum,month:model.month,locked,today:today(),canSelect:()=>!state.saving,
    onMonthChange:value=>{calendar.dataset.verifyMonthValue=value;requestAnimationFrame(()=>{const error=$('#daily-flow-error');if(calendar.isConnected&&error&&!error.hidden){const field=$('[data-verify-day][tabindex="0"]',calendar);field?.setAttribute('aria-invalid','true');field?.setAttribute('aria-describedby','daily-flow-error')}})},
    onSelect:date=>{if(state.saving||locked||date<minimum)return;if(input.value!==date){input.value=date;input.dispatchEvent(new Event('input',{bubbles:true}))}$('#daily-verify-selection').textContent=dailyCalendarDateLabel(date)}
  });
  $('#daily-verify-selection').textContent=dailyCalendarDateLabel(input.value);
  if(!locked&&!$('#daily-flow-error').hidden&&(state.current.type==='daily'?dailyPromptIssues({verifyDate:input.value},'verifyDate',minimum):extendedPromptIssues({verifyDate:input.value},'',{id:'verifyDate',kind:'verifyDate',required:true},minimum)).length){const field=$('[data-verify-day][tabindex="0"]',calendar);field?.setAttribute('aria-invalid','true');field?.setAttribute('aria-describedby','daily-flow-error')}
  if(state.saving)setReviewBusy(true);
  if(focusDate)$(`[data-verify-day="${model.tabDate}"]`,calendar)?.focus();
}

function bindDailyCalendar(){const calendar=$('#daily-verification-calendar');if(calendar)renderDailyCalendar(calendar.dataset.verifyMonthValue)}

function dailyActionFields(data,locked,template){const action=data.action||data.answers?.tomorrow?.[0]||'';return `<section class="card section-card folio-card">
  <div class="daily-prompt action-lock focus-lock" data-daily-prompt="action" hidden><textarea data-simple="action" aria-label="${esc(template.actionTitle)}" maxlength="6000" ${locked?'readonly':''} placeholder="写下一个具体、可开始的动作">${esc(action)}</textarea></div>
  <div class="daily-prompt action-lock daily-contingency" data-daily-prompt="ifCondition" hidden><div class="daily-contingency-field"><label for="daily-if-condition">什么情况最容易让行动受阻？</label><textarea id="daily-if-condition" data-simple="ifCondition" maxlength="6000" ${locked?'readonly':''} aria-label="如果遇到的阻碍，什么情况最容易让行动受阻？" placeholder="如果……">${esc(data.ifCondition||'')}</textarea></div><div class="daily-contingency-field"><label for="daily-if-then">遇到这个情况，你准备怎么做？</label><textarea id="daily-if-then" data-simple="ifThen" maxlength="6000" ${locked?'readonly':''} aria-label="那么采取的行动，遇到这个情况，你准备怎么做？" placeholder="那么我就……">${esc(data.ifThen||'')}</textarea></div></div>
  <div class="daily-prompt verify-lock" data-daily-prompt="verifyDate" hidden>${dailyVerificationCalendar(data.verifyDate,locked,template.verifyDateTitle)}</div></section>`}

function dailyJournal(data,locked){return `<section class="card section-card folio-card"><div class="daily-prompt journal-paper" data-daily-prompt="journal" hidden><textarea data-simple="journal" aria-label="今天的日记（选填）" maxlength="6000" rows="8" ${locked?'readonly':''} placeholder="选填。这里不需要结论。">${esc(data.journal||'')}</textarea><div class="journal-foot"><span>私人空间加密存储 · <strong id="journal-count">${(data.journal||'').length} 字</strong></span><b>${esc(state.user.displayName.slice(0,2))}</b></div></div></section>`}

function reviewAfterword(locked,data,actionTemplate){return `${locked&&state.current.status==='completed'?`<section class="card section-card review-completion"><h2>复盘已完成并锁定</h2><p class="help">原记录已保存。你可以回看历史，或前往行动验证查看待验证计划。</p><div class="review-completion-actions"><button type="button" class="btn btn-primary" data-nav="history">查看历史复盘</button><button type="button" class="btn btn-ghost" data-nav="actions">前往行动验证</button></div></section>`:''}${state.current.status==='verified'?verificationRead(state.current):''}`}

// Each local scene is a pointer-inert illustration and a small static paper composition.
function dailySceneArt(){return `<div class="daily-scene-art" aria-hidden="true"><span class="daily-scene-corner"></span><span class="daily-scene-signet"></span><span class="daily-scene-rule"></span>${['intro','sleep','energy','evidence','reflection','action','calendar','journal'].map(scene=>`<img class="daily-scene-image" data-daily-art="${scene}" src="/assets/daily/${scene}.webp?v=1.0.0-overview26" alt="" width="1254" height="1254" draggable="false">`).join('')}</div>`}
function dailyIntroLines(quote){return reviewIntroLines(quote)}
function dailyReviewHtml(period,locked,data,templates){
  const panes=[dailyEvidence(data,locked),dailyReflection(data,locked,templates.review),dailyActionFields(data,locked,templates.review),dailyJournal(data,locked)];
  const lastPrompt=dailyPrompts(data.metrics?.length||0,templates.review).at(-1);
  const saved=locked?(period!==defaultPeriod('daily')?'非当前日期，仅可查看':'这份复盘已锁定'):state.dirty?'有未保存内容':state.current.updated_at?`${beijingTime(state.current.updated_at)} 草稿已保存`:'草稿尚未保存';
  const quote=quoteFor('daily'),{lines,columns,density}=reviewIntroLayout(quote);
  return `<div class="daily-flow daily-art-flow" data-daily-scene="intro" data-daily-side="right" data-daily-current-prompt="intro">${dailySceneArt()}
    <header class="daily-flow-head"><div class="daily-stage"><span class="daily-stage-label" id="daily-current-group" hidden></span></div><time datetime="${esc(period)}">${esc(formatDate(period))}</time><div class="daily-top-actions"><button type="button" class="daily-exit" data-daily-exit>退出复盘 <span aria-hidden="true">↗</span></button></div></header>
    <section class="daily-intro" id="daily-intro" aria-label="每日复盘引导"><div class="daily-intro-copy" data-intro-length="${density}" style="--daily-intro-columns:${columns}"><p class="daily-intro-kicker">把这一刻，留给自己。</p><p id="daily-intro-text"><span class="sr-only">${esc(quote)}</span><span class="daily-typewriter" aria-hidden="true">${lines.map(line=>`<span class="daily-intro-line">${Array.from(line).map(character=>`<span class="daily-glyph">${esc(character)}</span>`).join('')}</span>`).join('')}</span></p><button type="button" class="btn btn-primary" id="daily-start"><span data-start-label>${locked?'查看复盘':state.current.id||state.dirty?'继续复盘':'开始复盘'}</span> <span aria-hidden="true">→</span></button></div></section>
    <section class="daily-editor" id="daily-editor" aria-labelledby="daily-flow-title" data-daily-locked="${locked}" hidden><h1 class="sr-only" id="daily-flow-title">每日复盘</h1>
      <p class="sr-only" id="daily-step-status" aria-live="polite"></p>
      <div class="daily-editor-content"><div class="daily-question-heading"><h2 id="daily-prompt-title" tabindex="-1"></h2><p id="daily-prompt-description"></p></div>
      <p class="daily-flow-error" id="daily-flow-error" role="alert" hidden></p>
      ${DAILY_STEPS.map((step,index)=>`<div class="daily-pane" data-daily-pane="${step.id}" hidden>${panes[index]}${step.id===lastPrompt.step?`<div class="daily-afterword" data-review-afterword hidden>${reviewAfterword(locked,data,templates.action)}</div>`:''}</div>`).join('')}
      <div class="daily-step-note"><span id="daily-step-hint"></span>${locked?`<span class="status-chip done">${STATUS[state.current.status]}</span>`:''}</div>
      </div><footer class="daily-flow-footer"><button type="button" class="btn btn-ghost" data-daily-back>上一步</button><p class="save-state" role="status">${saved}</p><div class="daily-flow-actions">${!locked?`<button type="button" class="btn toolbar-save" id="save-draft">保存草稿</button><button type="button" class="btn btn-red" id="complete-record" hidden>完成并锁定</button>`:`<button type="button" class="btn btn-ghost" id="daily-finish" data-nav="history" hidden>回到历史记录</button>`}<button type="button" class="btn btn-primary" data-daily-next>下一题 <span aria-hidden="true">→</span></button></div></footer>
    </section></div>`;
}
function extendedSceneArt(type){return `<div class="daily-scene-art" aria-hidden="true"><span class="daily-scene-corner"></span><span class="daily-scene-signet"></span><span class="daily-scene-rule"></span>${EXTENDED_FLOW[type].stages.map((stage,index)=>`<img class="daily-scene-image" data-extended-art="${type}-${stage.id}" src="/assets/extended/${type}-${stage.id}.webp?v=1.0.0-palette2" alt="" width="1254" height="1254" draggable="false" ${index?'hidden':''}>`).join('')}</div>`}
function extendedPromptCopy(prompt,template){
  const title=prompt.kind==='recordTitle'?template.recordTitle:prompt.kind==='action'?template.actionTitle:prompt.kind==='ifThen'?template.obstacleTitle:prompt.kind==='verifyDate'?template.verifyDateTitle:prompt.label||template[prompt.id];
  const description=prompt.kind==='recordTitle'?'给这个决定一个清楚的名字，未来回看时容易找到。':prompt.kind==='action'?'写下一个具体、可以开始的动作。':prompt.kind==='ifThen'?'阻碍条件可留空；应对动作写具体。':prompt.kind==='verifyDate'?`最早可选 ${dailyCalendarDateLabel(verificationMinimum(state.current.type,today()))}。实际验证时间会在提交结果时自动记录。`:prompt.required?'先写具体事实，再写自己的判断。':'选填。留下真正有用的线索即可。';
  return{title,description};
}
function extendedPromptHtml(prompt,data,locked,template){
  const copy=extendedPromptCopy(prompt,template),label=esc(copy.title);
  if(prompt.kind==='recordTitle')return `<div class="daily-prompt extended-title-prompt" data-daily-prompt="recordTitle" hidden><label class="sr-only" for="record-title">${label}</label><textarea class="control extended-title-input" id="record-title" maxlength="200" ${locked?'readonly':''} placeholder="为这个决定命名">${esc(state.current.title||'')}</textarea></div>`;
  if(prompt.kind==='verifyDate')return `<div class="daily-prompt extended-date-prompt" data-daily-prompt="verifyDate" hidden>${dailyVerificationCalendar(data.verifyDate,locked,copy.title)}</div>`;
  if(prompt.kind==='ifThen')return `<div class="daily-prompt extended-contingency-prompt daily-contingency" data-daily-prompt="ifThen" hidden><div class="daily-contingency-field"><label for="extended-if-condition">什么情况最容易让行动受阻？（选填）</label><textarea class="control" id="extended-if-condition" data-simple="ifCondition" maxlength="6000" rows="2" ${locked?'readonly':''} placeholder="如果……">${esc(data.ifCondition||'')}</textarea></div><div class="daily-contingency-field"><label for="extended-if-then">遇到这个情况，你准备怎么做？</label><textarea class="control" id="extended-if-then" data-simple="ifThen" maxlength="6000" rows="2" ${locked?'readonly':''} placeholder="那么我就……">${esc(data.ifThen||'')}</textarea></div></div>`;
  if(prompt.kind==='action')return `<div class="daily-prompt extended-simple-prompt" data-daily-prompt="action" hidden><label class="sr-only" for="extended-action">${label}</label><textarea class="control" id="extended-action" data-simple="action" maxlength="6000" rows="5" ${locked?'readonly':''} placeholder="从一件能开始的小事写起">${esc(data.action||'')}</textarea></div>`;
  const values=(Array.isArray(data.answers?.[prompt.id])&&data.answers[prompt.id].length?data.answers[prompt.id]:['']).slice(0,5);
  return `<div class="daily-prompt extended-answer-prompt" data-daily-prompt="${prompt.id}" hidden>${dailyAnswerInputs(prompt.id,copy.title,values,locked)}</div>`;
}
function extendedReviewHtml(type,period,locked,data,templates){
  const config=EXTENDED_FLOW[type],prompts=extendedPrompts(type,QUESTIONS[type],templates.review),quote=quoteFor(type),{lines,columns,density}=reviewIntroLayout(quote);
  const saved=locked?(period!==defaultPeriod(type)?'非当前周期，仅可查看':'这份复盘已锁定'):state.dirty?'有未保存内容':state.current.updated_at?`${beijingTime(state.current.updated_at)} 草稿已保存`:'草稿尚未保存';
  return `<div class="daily-flow daily-art-flow extended-review-flow type-${type}" data-review-type="${type}" data-review-phase="${type}-${config.stages[0].id}" data-daily-scene="extended" data-daily-side="right" data-daily-current-prompt="intro">${extendedSceneArt(type)}
    <header class="daily-flow-head"><div class="daily-stage"><span class="daily-stage-label" id="daily-current-group" hidden></span></div><time>${esc(formatDate(period))}</time><div class="daily-top-actions"><button type="button" class="daily-exit" data-daily-exit>退出复盘 <span aria-hidden="true">↗</span></button></div></header>
    <section class="daily-intro" id="daily-intro" aria-label="${esc(TYPES[type].label)}引导"><div class="daily-intro-copy" data-intro-length="${density}" style="--daily-intro-columns:${columns}"><p class="daily-intro-kicker">给这段时间，一页纸。</p><p id="daily-intro-text"><span class="sr-only">${esc(quote)}</span><span class="daily-typewriter" aria-hidden="true">${lines.map(line=>`<span class="daily-intro-line">${Array.from(line).map(character=>`<span class="daily-glyph">${esc(character)}</span>`).join('')}</span>`).join('')}</span></p><button type="button" class="btn btn-primary" id="daily-start"><span data-start-label>${locked?'查看复盘':state.current.id||state.dirty?'继续复盘':'开始复盘'}</span> <span aria-hidden="true">→</span></button></div></section>
    <section class="daily-editor" id="daily-editor" aria-labelledby="daily-flow-title" data-daily-locked="${locked}" hidden><h1 class="sr-only" id="daily-flow-title">${esc(TYPES[type].label)}</h1><p class="sr-only" id="daily-step-status" aria-live="polite"></p>
      <div class="daily-editor-content"><div class="daily-question-heading"><h2 id="daily-prompt-title" tabindex="-1"></h2><p id="daily-prompt-description"></p></div><p class="daily-flow-error" id="daily-flow-error" role="alert" hidden></p>
      ${config.stages.map(stage=>`<div class="daily-pane" data-daily-pane="${stage.id}" hidden><section class="card section-card folio-card">${prompts.filter(prompt=>prompt.stage===stage.id).map(prompt=>extendedPromptHtml(prompt,data,locked,templates.review)).join('')}</section>${stage===config.stages.at(-1)?`<div class="daily-afterword" data-extended-afterword hidden>${reviewAfterword(locked,data,templates.action)}</div>`:''}</div>`).join('')}
      <div class="daily-step-note"><span id="daily-step-hint"></span>${locked?`<span class="status-chip done">${STATUS[state.current.status]}</span>`:''}</div>
      </div><footer class="daily-flow-footer"><button type="button" class="btn btn-ghost" data-daily-back>上一步</button><p class="save-state" role="status">${saved}</p><div class="daily-flow-actions">${!locked?`<button type="button" class="btn toolbar-save" id="save-draft">保存草稿</button><button type="button" class="btn btn-red" id="complete-record" hidden>完成并锁定</button>`:`<button type="button" class="btn btn-ghost" id="daily-finish" data-nav="history" hidden>回到历史记录</button>`}<button type="button" class="btn btn-primary" data-daily-next>下一题 <span aria-hidden="true">→</span></button></div></footer>
    </section></div>`;
}
function openDailyAnswer(input){const entry=input?.closest('[data-daily-answer]');if(!entry)return;$$('[data-daily-answer]',entry.closest('.item-list')).forEach(row=>row.open=row===entry)}
function focusDailyAnswer(input){if(!input)return;openDailyAnswer(input);input.focus()}
function cancelDailyTypewriter(reveal=true){
  if(dailyTypingTimer!==null){clearTimeout(dailyTypingTimer);dailyTypingTimer=null}
  dailyTypingCleanup?.();dailyTypingCleanup=null;
  if(reveal)$('#daily-intro-text')?.classList.remove('is-typing');
}
function startDailyTypewriter(){
  cancelDailyTypewriter();const intro=$('#daily-intro'),text=$('#daily-intro-text');if(!intro||intro.hidden||!text)return;
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  if(intro.dataset.typingStarted||state.theme?.reduceMotion||document.body.classList.contains('reduce-motion')||media.matches)return;
  intro.dataset.typingStarted='true';const glyphs=$$('.daily-glyph',text);glyphs.forEach(glyph=>glyph.classList.remove('is-visible'));text.classList.add('is-typing');
  const onMotionChange=event=>{if(event.matches)cancelDailyTypewriter()};media.addEventListener('change',onMotionChange);dailyTypingCleanup=()=>media.removeEventListener('change',onMotionChange);
  let index=0;const reveal=()=>{if(!text.isConnected||intro.hidden){cancelDailyTypewriter();return}if(index>=glyphs.length){cancelDailyTypewriter();return}const glyph=glyphs[index++];glyph.classList.add('is-visible');dailyTypingTimer=setTimeout(reveal,/[，。！？；]/.test(glyph.textContent)?150:45)};
  dailyTypingTimer=setTimeout(reveal,120);
}
function setDailyImmersive(open){
  if(open)closeHeaderMenus();
  $('.app-shell')?.classList.toggle('daily-immersive',open);
  const header=$('#site-header');if(header){header.hidden=open;header.inert=open}
}
function currentDailyPrompts(){return dailyPrompts(state.current.data.metrics?.length||0,templatesForRecord(state.current).review)}
function dailyPromptCopy(prompt){
  const template=templatesForRecord(state.current).review,metric=prompt.id.startsWith('metric-')?state.current.data.metrics[Number(prompt.id.slice(7))]:null;
  const question=reviewQuestions('daily',template).find(item=>item.id===prompt.id);
  if(question)return{title:question.label,description:question.required?'先写具体事实，再写自己的判断。':'选填。留下真正有用的线索即可。'};
  if(metric)return{title:`${metric.name||'这项行动'}，今天做了什么？`,description:metric.target?`阶段目标：${metric.target}。记录具体行动，再选一个符合实际的状态。`:'记录具体行动，再选一个符合实际的状态。'};
  const copy={sleep:['昨夜，你睡了多久？','记下实际睡眠时间。暂时不想记录，也可以直接继续。'],energy:['此刻的精力状态如何？','用 0—100 记录你的感受，不需要为了达标而修改。'],risk:['有没有需要留意的风险或偏离？','选填。写下具体信号，以及准备怎样应对。'],today:[template.today,'至少留下一件真实发生的事。不记流水账，也不急着下结论。'],cause:[template.cause,'选填。看看哪些条件促成了它，哪些方法可以再用一次。'],action:[template.actionTitle,'如果明天只能完成一件事，你会选什么？把开始的动作写具体。'],ifCondition:['如果受阻，怎样继续？',template.obstacleTitle],verifyDate:[template.verifyDateTitle,'选定回看这次行动的日期。实际验证时间会在提交结果时自动记录。'],journal:['今天，还有什么想留下？','选填。这里不需要结论，几句话或一整页都可以。']};
  return{title:copy[prompt.id][0],description:copy[prompt.id][1]};
}
function setReviewPromptHeading(heading,title,phrase=''){
  const text=title==null?'':String(title),emphasis=String(phrase),start=emphasis?text.indexOf(emphasis):-1;
  let offset=0;
  const lines=dailyIntroLines(text).map(line=>{
    const row=document.createElement('span');row.className='daily-prompt-line';
    const from=Math.max(start,offset),to=Math.min(start+emphasis.length,offset+line.length);
    if(start>=0&&from<to){
      const accent=document.createElement('span');accent.className='daily-title-emphasis';accent.textContent=line.slice(from-offset,to-offset);
      row.append(line.slice(0,from-offset),accent,line.slice(to-offset));
    }else row.textContent=line;
    offset+=line.length;return row;
  });
  heading.replaceChildren(...lines);
}
function setDailyPromptHeading(title,prompt){
  const heading=$('#daily-prompt-title'),metric=prompt.id.startsWith('metric-')?state.current.data.metrics[Number(prompt.id.slice(7))]:null;
  const phrases={sleep:'睡了多久',energy:'精力状态',risk:'风险或偏离',today:'记下来',cause:'发生',action:'最重要的一件事',ifCondition:'受阻',verifyDate:'验证',journal:'想留下'};
  setReviewPromptHeading(heading,title,metric?.name||phrases[prompt.id]||'');
}
function showDailyPrompt(promptId,focus=false){
  promptId=dailyPromptOwner(promptId);
  const prompts=currentDailyPrompts(),index=prompts.findIndex(prompt=>prompt.id===promptId),intro=index<0,prompt=prompts[index];
  state.dailySection=intro?'intro':prompt.step;state.dailyPrompt=intro?null:prompt.id;
  $('#daily-intro').hidden=!intro;$('#daily-editor').hidden=intro;
  $$('[data-daily-pane]').forEach(pane=>pane.hidden=intro||pane.dataset.dailyPane!==prompt.step);
  $$('[data-daily-prompt]').forEach(question=>question.hidden=intro||question.dataset.dailyPrompt!==promptId);
  setDailyImmersive(true);
  const scene=intro?'intro':prompt.id==='sleep'?'sleep':prompt.id==='energy'?'energy':prompt.step==='evidence'?'evidence':prompt.step==='reflection'?'reflection':prompt.id==='verifyDate'?'calendar':prompt.step==='action'?'action':'journal';
  $('.daily-art-flow').dataset.dailyScene=scene;$('.daily-art-flow').dataset.dailyCurrentPrompt=intro?'intro':prompt.id;
  $('.daily-art-flow').dataset.dailySide=!intro&&['reflection','journal'].includes(prompt.step)?'left':'right';
  $('#daily-current-group').hidden=intro;
  if(intro)$('#daily-current-group').textContent='';
  $('[data-start-label]',$('#daily-start')).textContent=$('#daily-editor').dataset.dailyLocked==='true'?'查看复盘 ':state.current.id||state.dirty?'继续复盘 ':'开始复盘 ';
  if(!intro){
    cancelDailyTypewriter();const locked=$('#daily-editor').dataset.dailyLocked==='true',last=index===prompts.length-1,group=DAILY_STEPS.findIndex(step=>step.id===prompt.step),copy=dailyPromptCopy(prompt);
    $('[data-daily-back]').textContent=index===0?'回到引导':'上一题';
    $('[data-daily-next]').hidden=last;
    if($('#complete-record'))$('#complete-record').hidden=!last;
    if($('#daily-finish'))$('#daily-finish').hidden=!last;
    $('#daily-current-group').textContent=`${String(group+1).padStart(2,'0')} · ${DAILY_STEPS[group].label}`;
    setDailyPromptHeading(copy.title,prompt);$('#daily-prompt-description').textContent=copy.description;
    $('#daily-step-status').textContent=`${DAILY_STEPS[group].label}，${copy.title}`;
    const required=reviewQuestions('daily',templatesForRecord(state.current).review).find(item=>item.id===prompt.id)?.required||['action','ifCondition','ifThen','verifyDate'].includes(prompt.id);
    $('[data-review-afterword]')?.toggleAttribute('hidden',!last);
    $('#daily-step-hint').textContent=locked?'这份记录只供查看。':required?'填写这一题后继续。':last?'这一题选填，留空也可以完成。':'这一题选填，可以直接继续。';
    if(promptId==='verifyDate')renderDailyCalendar($('#daily-verification-calendar').dataset.verifyMonthValue);
    if(focus){$('#daily-prompt-title').focus({preventScroll:true});$('.daily-flow-head').scrollIntoView({block:'start',behavior:'auto'})}
  }else{startDailyTypewriter();if(focus){$('#daily-start').focus({preventScroll:true});$('.daily-flow-head').scrollIntoView({block:'start',behavior:'auto'});$('#daily-start').scrollIntoView({block:'nearest',behavior:'auto'})}}
}
function showDailySection(section,focus=false){const prompts=currentDailyPrompts(),current=prompts.find(prompt=>prompt.id===dailyPromptOwner(state.dailyPrompt)&&prompt.step===section);showDailyPrompt(section==='intro'?null:(current?.id||prompts.find(prompt=>prompt.step===section)?.id),focus)}
function clearDailyIssues(){
  $$('[aria-describedby]').filter(control=>control.getAttribute('aria-describedby').split(' ').includes('daily-flow-error')).forEach(control=>{control.removeAttribute('aria-invalid');const ids=control.getAttribute('aria-describedby').split(' ').filter(id=>id!=='daily-flow-error');if(ids.length)control.setAttribute('aria-describedby',ids.join(' '));else control.removeAttribute('aria-describedby')});
  if($('#daily-flow-error'))$('#daily-flow-error').hidden=true;
}
function dailyIssueLabel(issue){const template=templatesForRecord(state.current).review;return reviewQuestions('daily',template).find(item=>item.id===issue.field)?.label||{today:template.today,action:template.actionTitle,ifCondition:'如果遇到的阻碍',ifThen:template.obstacleTitle,verifyDate:`${template.verifyDateTitle}（不能早于今天）`}[issue.field]}
function showDailyIssues(issues){
  clearDailyIssues();if(!issues.length)return;
  showDailyPrompt(issues[0].field);
  const error=$('#daily-flow-error');error.textContent=`请填写：${issues.map(dailyIssueLabel).join('、')}`;error.hidden=false;
  let first;
  for(const issue of issues){const field=$(reviewQuestions('daily',templatesForRecord(state.current).review).some(item=>item.id===issue.field)?`[data-answer="${issue.field}"]`:issue.field==='verifyDate'?'[data-verify-day][tabindex="0"]':`[data-simple="${issue.field}"]`);if(field){field.setAttribute('aria-invalid','true');const ids=new Set((field.getAttribute('aria-describedby')||'').split(' ').filter(Boolean));ids.add('daily-flow-error');field.setAttribute('aria-describedby',[...ids].join(' '));first ||= field}}
  openDailyAnswer(first);first?.focus();first?.scrollIntoView({block:'center',behavior:'auto'});
}
function bindDailyFlow(){
  bindDailyCalendar();
  const move=prompt=>{if(state.saving)return;if($('#daily-editor').dataset.dailyLocked!=='true')collectCurrent();clearDailyIssues();showDailyPrompt(prompt,true)};
  $('#daily-start').addEventListener('click',()=>move(currentDailyPrompts()[0].id));
  $('[data-daily-exit]').addEventListener('click',()=>reviewNavigation.exit());
  $('[data-daily-back]').addEventListener('click',()=>move(dailyPromptNeighbor(currentDailyPrompts(),state.dailyPrompt,-1)));
  $('[data-daily-next]').addEventListener('click',()=>{if(state.saving)return;if($('#daily-editor').dataset.dailyLocked!=='true'){collectCurrent();const issues=dailyPromptIssues(state.current.data,state.dailyPrompt,today(),templatesForRecord(state.current).review);if(issues.length){showDailyIssues(issues);return}}const next=dailyPromptNeighbor(currentDailyPrompts(),state.dailyPrompt,1);if(next)move(next)});
  showDailySection(state.dailySection);
}

function currentExtendedPrompts(){return extendedPrompts(state.current.type,QUESTIONS[state.current.type],templatesForRecord(state.current).review)}
function setExtendedPromptHeading(title,prompt){
  const heading=$('#daily-prompt-title'),phrases={plan:'原本要完成什么',progress:'三个进展',patterns:'成功条件与阻碍',keepStop:'保留一件事',nextThree:'最重要的三件事',goalResult:'目标与现在的结果',change:'改善了生活',want:'仍然是我想要的吗',bottleneck:'一个瓶颈',experiment:'一个小实验',hope:'生活发生什么变化',evidence:'哪些变化有证据',worth:'值得继续吗',choices:'继续、调整、停止',nextGoals:'最多三个目标',coordinates:'五件事',expectations:'成为了现实',areas:'重要领域',decisions:'最重要的决定',keepRelease:'保留什么',nextYear:'明年的主题',recordTitle:'决定',decision:'什么决定',options:'哪些选项',facts:'哪些事实',expectation:'预期结果',failure:'最可能因为什么',choice:'最终选择',firstStep:'第一步行动',action:'具体要做什么',ifThen:'如果遇到阻碍',verifyDate:'验证'};
  setReviewPromptHeading(heading,title,phrases[prompt.id]||'');
}
function showExtendedPrompt(promptId,focus=false){
  const type=state.current.type,config=EXTENDED_FLOW[type],prompts=currentExtendedPrompts(),index=prompts.findIndex(prompt=>prompt.id===promptId),intro=index<0,prompt=prompts[index],flow=$('.extended-review-flow');
  state.extendedPrompt=intro?null:prompt.id;
  $('#daily-intro').hidden=!intro;$('#daily-editor').hidden=intro;
  $$('[data-daily-pane]').forEach(pane=>pane.hidden=intro||pane.dataset.dailyPane!==prompt.stage);
  $$('[data-daily-prompt]').forEach(question=>question.hidden=intro||question.dataset.dailyPrompt!==promptId);
  setDailyImmersive(true);
  flow.dataset.reviewPhase=intro?`${type}-${config.stages[0].id}`:prompt.phase;
  $$('[data-extended-art]',flow).forEach(img=>{img.hidden=img.dataset.extendedArt!==flow.dataset.reviewPhase});
  flow.dataset.dailyScene='extended';flow.dataset.dailyCurrentPrompt=intro?'intro':prompt.id;
  flow.dataset.dailySide=intro||prompt.stageIndex%2===0?'right':'left';
  $('#daily-current-group').hidden=intro;
  if(intro)$('#daily-current-group').textContent='';
  $('[data-start-label]',$('#daily-start')).textContent=$('#daily-editor').dataset.dailyLocked==='true'?'查看复盘 ':state.current.id||state.dirty?'继续复盘 ':'开始复盘 ';
  if(!intro){
    cancelDailyTypewriter();
    const locked=$('#daily-editor').dataset.dailyLocked==='true',last=index===prompts.length-1,stage=config.stages[prompt.stageIndex],copy=extendedPromptCopy(prompt,templatesForRecord(state.current).review);
    $('[data-daily-back]').textContent=index===0?'回到引导':'上一题';
    $('[data-daily-next]').hidden=last;
    if($('#complete-record'))$('#complete-record').hidden=!last;
    if($('#daily-finish'))$('#daily-finish').hidden=!last;
    $('[data-extended-afterword]')?.toggleAttribute('hidden',!last);
    $('#daily-current-group').textContent=`${String(prompt.stageIndex+1).padStart(2,'0')} · ${stage.label}`;
    setExtendedPromptHeading(copy.title,prompt);$('#daily-prompt-description').textContent=copy.description;
    $('#daily-step-status').textContent=`${stage.label}，${String(copy.title??'')}`;
    $('#daily-step-hint').textContent=locked?'这份记录只供查看。':prompt.required?'填写这一题后继续。':last?'这一题选填，留空也可以完成。':'这一题选填，可以直接继续。';
    if(promptId==='verifyDate')renderDailyCalendar($('#daily-verification-calendar').dataset.verifyMonthValue);
    if(focus){$('#daily-prompt-title').focus({preventScroll:true});$('.daily-flow-head').scrollIntoView({block:'start',behavior:'auto'})}
  }else{startDailyTypewriter();if(focus){$('#daily-start').focus({preventScroll:true});$('.daily-flow-head').scrollIntoView({block:'start',behavior:'auto'});$('#daily-start').scrollIntoView({block:'nearest',behavior:'auto'})}}
}
function extendedIssueLabel(issue){
  const template=templatesForRecord(state.current).review;
  return issue.field==='recordTitle'?template.recordTitle:issue.field==='action'?template.actionTitle:issue.field==='ifCondition'?'什么情况最容易让行动受阻？':issue.field==='ifThen'?'遇到这个情况，你准备怎么做？':issue.field==='verifyDate'?`${template.verifyDateTitle}（最早 ${dailyCalendarDateLabel(verificationMinimum(state.current.type,today()))}）`:reviewQuestions(state.current.type,template).find(item=>item.id===issue.field)?.label||template[issue.field];
}
function showExtendedIssues(issues){
  clearDailyIssues();if(!issues.length)return;
  const issue=issues[0];showExtendedPrompt(issue.field==='ifCondition'?'ifThen':issue.field);
  const visibleIssues=['ifCondition','ifThen'].includes(issue.field)?issues.filter(item=>['ifCondition','ifThen'].includes(item.field)):[issue];
  const error=$('#daily-flow-error');error.textContent=`请填写：${visibleIssues.map(extendedIssueLabel).join('、')}`;error.hidden=false;
  let first;
  for(const item of visibleIssues){
    const field=$(item.field==='recordTitle'?'#record-title':item.field==='verifyDate'?'[data-verify-day][tabindex="0"]':['action','ifCondition','ifThen'].includes(item.field)?`[data-simple="${item.field}"]`:`[data-answer="${item.field}"]`);
    if(!field)continue;
    field.setAttribute('aria-invalid','true');const ids=new Set((field.getAttribute('aria-describedby')||'').split(' ').filter(Boolean));ids.add('daily-flow-error');field.setAttribute('aria-describedby',[...ids].join(' '));first ||= field;
  }
  if(first){openDailyAnswer(first);first.focus();first.scrollIntoView({block:'center',behavior:'auto'})}
}
function bindExtendedFlow(){
  bindDailyCalendar();
  const move=prompt=>{if(state.saving)return;if($('#daily-editor').dataset.dailyLocked!=='true')collectCurrent();clearDailyIssues();showExtendedPrompt(prompt,true)};
  $('#daily-start').addEventListener('click',()=>move(currentExtendedPrompts()[0].id));
  $('[data-daily-exit]').addEventListener('click',()=>reviewNavigation.exit());
  $('[data-daily-back]').addEventListener('click',()=>move(extendedPromptNeighbor(currentExtendedPrompts(),state.extendedPrompt,-1)));
  $('[data-daily-next]').addEventListener('click',()=>{
    if(state.saving)return;
    if($('#daily-editor').dataset.dailyLocked!=='true'){
      collectCurrent();const prompt=currentExtendedPrompts().find(item=>item.id===state.extendedPrompt),issues=extendedPromptIssues(state.current.data,state.current.title,prompt,verificationMinimum(state.current.type,today()));
      if(issues.length){showExtendedIssues(issues);return}
    }
    const next=extendedPromptNeighbor(currentExtendedPrompts(),state.extendedPrompt,1);if(next)move(next);
  });
  showExtendedPrompt(state.extendedPrompt);
}

function renderReview(type,period=state.current?.type===type?state.current.period:defaultPeriod(type),forceNew=false,draftOverride=null,options={}){
  let rec=draftOverride||(!forceNew?state.records.find(r=>r.type===type&&r.period===period):null);
  if(type==='decision'&&!state.current?.id&&forceNew)rec=null;
  state.current=rec?clone(rec):newRecord(type,period);state.dirty=!!options.dirty;state.dailySection=type==='daily'?(options.dailySection||'intro'):'intro';state.dailyPrompt=type==='daily'?(options.dailyPrompt||null):null;state.extendedPrompt=type!=='daily'?(options.extendedPrompt||null):null;
  const locked=state.current.status!=='draft'||period!==defaultPeriod(type),data=state.current.data||{},templates=templatesForRecord(state.current);
  if(type==='daily'){if(!locked)Object.assign(data,reconcileReviewMetrics(data.metrics,state.stage.metrics,data.archivedMetrics));else if(!Array.isArray(data.metrics))data.metrics=[]}
  const content=type==='daily'?dailyReviewHtml(period,locked,data,templates):extendedReviewHtml(type,period,locked,data,templates);
  shell(content);bindReview();
}
function verificationRead(rec){const v=rec.verification||{},t=templatesForRecord(rec).action;return `<section class="card section-card verification-result-card"><div class="section-head"><div class="section-title"><span class="art-num">验</span><div><h2>${esc(t.lockedTitle)}</h2><p>${esc(t.lockedIntro)}</p></div></div></div>${verificationTimes(rec,t)}<div class="action-part action-result-part"><div class="action-part-heading"><div><span>${esc(t.reviewEyebrow)}</span><h3>${esc(t.reviewTitle)}</h3></div><small>${esc(t.reviewNote)}</small></div><div class="action-detail-grid"><section class="action-detail result-detail"><div class="action-detail-head"><span>01</span><h3>${esc(t.resultTitle)}</h3></div><p>${esc(v.result||t.missingResultText)}</p></section><section class="action-detail adjustment-detail"><div class="action-detail-head"><span>02</span><h3>${esc(t.adjustmentTitle)}</h3></div><p>${esc(v.adjustment||t.missingResultText)}</p></section></div>${rec.type==='decision'?`<div class="decision-result-badges"><span class="badge">${esc(t.decisionOutcomeLabel)}：${esc(v.outcome||'—')}</span><span class="badge">${esc(t.decisionProcessLabel)}：${esc(v.process||'—')}</span></div>`:''}</div></section>`}

function bindReview(){
  const mark=()=>{if(state.current.status==='draft'){state.dirty=true;$('.save-state')&&($('.save-state').textContent='有未保存内容')}};
  $$('.main input,.main textarea,.main select').forEach(el=>el.addEventListener('input',()=>{mark();clearDailyIssues();if(el.matches('textarea')){const preview=$('[data-answer-preview]',el.closest('[data-daily-answer]')||el);if(preview)preview.textContent=dailyAnswerPreview(el.value)}if(el.matches('[data-gauge-input]'))updateGauge(el);if(el.dataset.simple==='journal')$('#journal-count').textContent=`${el.value.length} 字`}));
  $$('[data-daily-answer]').forEach(entry=>entry.addEventListener('toggle',()=>{if(entry.open)openDailyAnswer($('textarea',entry))}));
  $('#example-toggle')?.addEventListener('click',()=>$('#example-panel').classList.toggle('hidden'));
  $$('[data-add-item]').forEach(b=>b.addEventListener('click',()=>{collectCurrent();const k=b.dataset.addItem;state.current.data.answers[k]=state.current.data.answers[k]||[''];if(state.current.data.answers[k].length<5)state.current.data.answers[k].push('');state.dirty=true;renderReviewFromCurrent();focusDailyAnswer($(`[data-answer="${k}"][data-index="${state.current.data.answers[k].length-1}"]`))}));
  $$('[data-remove-item]').forEach(b=>b.addEventListener('click',()=>{collectCurrent();const k=b.dataset.removeItem,index=Number(b.dataset.index);state.current.data.answers[k].splice(index,1);state.dirty=true;renderReviewFromCurrent();focusDailyAnswer($(`[data-answer="${k}"][data-index="${Math.max(0,index-1)}"]`))}));
  $('#save-draft')?.addEventListener('click',()=>saveCurrent().catch(()=>{}));
  $('#complete-record')?.addEventListener('click',completeCurrent);
  if(state.current.type==='daily')bindDailyFlow();else bindExtendedFlow();
}
function renderReviewFromCurrent(){const keep=clone(state.current);renderReview(keep.type,keep.period,false,keep,{dailySection:state.dailySection,dailyPrompt:state.dailyPrompt,extendedPrompt:state.extendedPrompt,dirty:true})}
function collectCurrent(){if(!state.current)return;const d=state.current.data||(state.current.data={});d.answers=d.answers||{};$$('[data-answer]').forEach(el=>{const k=el.dataset.answer,i=Number(el.dataset.index);d.answers[k]=d.answers[k]||[];d.answers[k][i]=el.value});$$('[data-simple]').forEach(el=>d[el.dataset.simple]=el.value);$$('[data-metric-action]').forEach(el=>{const i=Number(el.dataset.metricAction);d.metrics[i].action=el.value});$$('[data-metric-status]').forEach(el=>{const i=Number(el.dataset.metricStatus);d.metrics[i].status=el.value});if($('#record-title'))state.current.title=$('#record-title').value;if(state.current.status==='draft')d.templateSnapshot=currentTemplateSnapshot(state.current.type)}
function validateCurrent(){collectCurrent();const r=state.current,d=r.data;if(r.type==='daily'){const issues=dailyStepIssues(d,null,today(),templatesForRecord(r).review);if(issues.length)showDailyIssues(issues);return issues.map(dailyIssueLabel)}const issues=extendedReviewIssues(d,r.title,currentExtendedPrompts(),verificationMinimum(r.type,today()));if(issues.length)showExtendedIssues(issues);return issues.map(extendedIssueLabel)}
function setReviewBusy(busy){
  const main=$('#main-content');if(!main)return;
  main.setAttribute('aria-busy',String(busy));
  $$('input,textarea,select,button',main).forEach(control=>{if(busy&&!control.disabled){control.dataset.reviewBusy='true';control.disabled=true}else if(!busy&&control.dataset.reviewBusy){control.disabled=false;delete control.dataset.reviewBusy}});
  const save=$('#save-draft');if(save){if(busy&&!save.dataset.idleHtml){save.dataset.idleHtml=save.innerHTML;renderMarkup(save,'正在保存…')}else if(!busy&&save.dataset.idleHtml){renderMarkup(save,save.dataset.idleHtml);delete save.dataset.idleHtml}}
}
async function saveCurrent(silent=false){
  if(state.saving)return null;
  collectCurrent();state.saving=true;setReviewBusy(true);
  try{const {record}=await request('/api/records',{method:'PUT',body:state.current});state.current=record;const i=state.records.findIndex(r=>r.id===record.id);if(i>=0)state.records[i]=record;else state.records.push(record);state.dirty=false;$('.save-state')&&($('.save-state').textContent=`${beijingTime(record.updated_at)} 草稿已存入纸笺`);if(!silent)toast('草稿已保存');return record}
  catch(e){$('.save-state')&&($('.save-state').textContent='保存失败，内容已保留，请重试');if(!silent)toast(e.message,'error');if(e.code==='version_conflict')await refreshData();throw e}
  finally{state.saving=false;setReviewBusy(false)}
}
async function completeCurrent(){
  if(state.saving)return;
  const missing=validateCurrent();if(missing.length){toast(`请先填写：${missing.slice(0,3).join('、')}${missing.length>3?'等':''}`,'error');return}
  openModal(`<div class="modal-head"><div><h2>${state.current.type==='decision'?'完成并封存依据？':'完成并永久锁定？'}</h2><p>锁定后，正文、标题、日期、日记和行动都不能修改。</p></div><button class="modal-close" data-close>×</button></div><div class="lock-summary">复盘周期：${esc(state.current.period)}<br>预期验证日期：${esc(state.current.data.verifyDate)}<br>达到最早验证日期后，可按实际情况提交，系统会自动记录实际验证时间。</div><div class="modal-actions"><button class="btn btn-ghost" data-close>再检查一下</button><button class="btn btn-red" id="confirm-complete">确认完成并锁定</button></div>`);
  $('#confirm-complete').addEventListener('click',async event=>{
    if(state.saving)return;const button=event.currentTarget,modal=button.closest('.modal');button.disabled=true;button.textContent='正在锁定…';modal.dataset.reviewLockBusy='true';modal.setAttribute('aria-busy','true');$$('[data-close]',modal).forEach(control=>control.setAttribute('aria-disabled','true'));
    try{if(!state.current.id||state.dirty)await saveCurrent(true);state.saving=true;setReviewBusy(true);const {record}=await request(`/api/records/${state.current.id}/complete`,{method:'POST'});const i=state.records.findIndex(x=>x.id===record.id);if(i>=0)state.records[i]=record;else state.records.push(record);state.current=record;closeModal(true);await refreshStats().catch(()=>{});toast('复盘已完成并锁定');renderReview(record.type,record.period,false,record,{dailySection:record.type==='daily'?currentDailyPrompts().at(-1).step:'intro',dailyPrompt:record.type==='daily'?currentDailyPrompts().at(-1).id:null,extendedPrompt:state.extendedPrompt})}
    catch(e){toast(e.message,'error')}
    finally{state.saving=false;setReviewBusy(false);if(modal.isConnected){delete modal.dataset.reviewLockBusy;modal.removeAttribute('aria-busy');$$('[data-close]',modal).forEach(control=>control.removeAttribute('aria-disabled'))}if(button.isConnected){button.disabled=false;button.textContent='确认完成并锁定'}}
  });
}

function recordSummary(r){const vals=Object.values(r.data.answers||{}).flat().filter(Boolean);return vals[0]||r.data.action||'这份记录还没有正文摘要。'}
function isoWeekAnchor(period){const match=/^(\d{4})-W(\d{2})$/.exec(String(period));if(!match)return'';const year=Number(match[1]),week=Number(match[2]);if(week<1||week>53)return'';const jan4=new Date(Date.UTC(year,0,4,12)),weekday=jan4.getUTCDay()||7;jan4.setUTCDate(jan4.getUTCDate()+(4-weekday)+(week-1)*7);return jan4.toISOString().slice(0,10)}
function historyYear(record){const match=/^(\d{4})/.exec(String(record?.period||''));return match?match[1]:''}
function historyMonth(record){const period=String(record?.period||'');if(record?.type==='yearly')return'';if(record?.type==='weekly')return isoWeekAnchor(period).slice(0,7);const match=/^(\d{4}-\d{2})/.exec(period);return match?match[1]:''}
function historyCardHtml(record,art=RECORD_ART[record.type][0]){
  const type=TYPES[record.type],day=overviewDateParts(record.period),date=day?`${day.calendarDate} ${day.weekday}`:formatDate(record.period),normalized=overviewRecordTitle(record,date,type.label),isPeriodTitle=normalized.title===date;
  const periodHtml=day?`<span class="history-period-date">${esc(day.calendarDate)}</span><span class="history-period-weekday">${esc(day.weekday)}</span>`:esc(date);
  return `<button type="button" class="history-record type-${esc(record.type)}" data-open-record="${esc(record.id)}"><span class="history-record-top"><span class="history-category"><span aria-hidden="true">${TYPE_ICONS[record.type]}</span>${esc(type.label)}</span><span class="history-status ${esc(record.status)}"><i aria-hidden="true"></i>${esc(STATUS[record.status])}</span></span><span class="history-record-body"><span class="history-record-copy">${normalized.showDate?`<span class="history-record-period">${periodHtml}</span>`:''}<strong class="history-record-title${isPeriodTitle?' is-period-title':''}">${isPeriodTitle?periodHtml:esc(normalized.title)}</strong><span class="history-record-excerpt">${esc(recordSummary(record))}</span></span><span class="history-record-art" aria-hidden="true"><img src="${esc(art.src)}" alt="" width="1254" height="1254" loading="lazy" draggable="false"></span></span><span class="history-record-foot"><span class="history-record-intent">${esc(type.position)}</span><span class="history-record-open">翻开复盘 <span class="history-record-arrow" aria-hidden="true">↗</span></span></span></button>`;
}
function renderHistory(filter=state.historyFilter,focusSearch=false){
  const artwork=recordArtAssignments(state.records);
  const active={q:String(filter.q||''),type:filter.type||'all',year:filter.year||'all',month:filter.month||'all'};
  if(active.year==='all')active.month='all';
  state.historyFilter={...active};
  const years=[...new Set([today().slice(0,4),...state.records.map(historyYear).filter(Boolean)])].sort((a,b)=>b.localeCompare(a));
  const rows=state.records.filter(r=>(active.type==='all'||r.type===active.type)&&(active.year==='all'||historyYear(r)===active.year)&&(active.month==='all'||historyMonth(r)===`${active.year}-${active.month}`)&&(!active.q||`${r.title} ${JSON.stringify(r.data)}`.toLowerCase().includes(active.q.toLowerCase()))).sort((a,b)=>b.period.localeCompare(a.period));
  const hasFilter=Boolean(active.q)||active.type!=='all'||active.year!=='all'||active.month!=='all';
  shell(`<section class="history-page" aria-labelledby="history-title"><header class="history-hero"><div class="history-hero-copy"><p class="history-kicker">循迹 · 归档有序</p><h1 id="history-title">历史复盘</h1><p class="history-hero-note">把写下的事实，留成往前的线索。</p><button class="history-write" data-nav="daily">写今天的复盘 <span aria-hidden="true">↗</span></button></div><div class="history-hero-art" aria-hidden="true"><span class="history-hero-orbit"></span><img src="/assets/daily/journal.webp?v=1.0.0-overview26" alt="" width="1254" height="1254"></div><div class="history-archive-count"><strong>${state.records.length}</strong><span>篇记录<br>安放在这里</span></div></header>
  <div class="filters history-filters"><label class="history-search-field"><span class="history-filter-caption">关键词</span><input class="history-search" id="history-search" value="${esc(active.q)}" placeholder="搜索标题、正文或行动" aria-label="搜索历史复盘"></label><label class="history-filter-select history-type-filter"><span class="history-filter-caption">复盘类型</span><select id="history-type"><option value="all">全部类型</option>${Object.entries(TYPES).map(([key,value])=>`<option value="${key}" ${active.type===key?'selected':''}>${value.label}</option>`).join('')}</select><span class="select-chevron" aria-hidden="true"></span></label><label class="history-filter-select history-year-filter"><span class="history-filter-caption">年份</span><select id="history-year"><option value="all">全部年份</option>${years.map(year=>`<option value="${year}" ${active.year===year?'selected':''}>${year} 年</option>`).join('')}</select><span class="select-chevron" aria-hidden="true"></span></label><label class="history-filter-select history-month-filter"><span class="history-filter-caption">月份</span><select id="history-month" ${active.year==='all'?'disabled':''}><option value="all">${active.year==='all'?'先选年份':'全年'}</option>${Array.from({length:12},(_,index)=>String(index+1).padStart(2,'0')).map(month=>`<option value="${month}" ${active.month===month?'selected':''}>${Number(month)} 月</option>`).join('')}</select><span class="select-chevron" aria-hidden="true"></span></label></div>
  <div class="history-results-head"><h2>${hasFilter?'筛选结果':'全部记录'} <span>${rows.length} 篇</span></h2>${hasFilter?'<button type="button" class="history-reset" id="history-reset">清除筛选 <span aria-hidden="true">↺</span></button>':'<p>每一份记录，都有它的来处。</p>'}</div><div class="history-record-grid">${rows.length?rows.map(record=>historyCardHtml(record,artwork.get(record.id))).join(''):`<div class="history-empty"><img src="/assets/daily/journal.webp?v=1.0.0-overview26" alt="" width="1254" height="1254" aria-hidden="true"><div><p class="history-kicker">${hasFilter?'换一条线索，再找找':'一切从第一笔开始'}</p><h3>${hasFilter?'这一页，暂时没有找到。':'还没有写下的记录。'}</h3><p>${hasFilter?'试试其他关键词、类型或日期。':'从今天发生的一件事开始，给未来的自己留一页。'}</p>${hasFilter?'<button type="button" class="history-write" id="history-empty-reset">清除筛选 <span aria-hidden="true">↗</span></button>':'<button class="history-write" data-nav="daily">开始每日复盘 <span aria-hidden="true">↗</span></button>'}</div></div>`}</div></section>`);
  $('#history-reset')?.addEventListener('click',()=>renderHistory({}));
  $('#history-empty-reset')?.addEventListener('click',()=>renderHistory({}));
  const nextFilter=()=>({q:$('#history-search').value,type:$('#history-type').value,year:$('#history-year').value,month:$('#history-month').value});
  $('#history-search').addEventListener('input',e=>renderHistory({...nextFilter(),q:e.target.value},true));
  $('#history-type').addEventListener('change',e=>renderHistory({...nextFilter(),type:e.target.value}));
  $('#history-year').addEventListener('change',e=>renderHistory({...nextFilter(),year:e.target.value,month:e.target.value==='all'?'all':$('#history-month').value}));
  $('#history-month').addEventListener('change',e=>renderHistory({...nextFilter(),month:e.target.value}));
  if(focusSearch){const input=$('#history-search');input.focus();input.setSelectionRange(input.value.length,input.value.length)}
  bindRecordOpen()
}
function bindRecordOpen(){$$('[data-open-record]').forEach(button=>button.addEventListener('click',()=>{const record=state.records.find(item=>item.id===button.dataset.openRecord);if(record)enterReview(record.type,record.period,false,record)}))}

function dueBadge(r,t=templatesForRecord(r).action){const d=r.data.verifyDate;if(r.status==='completed'&&today()<earliestActualVerification(r))return[t.waitingStatus,''];if(!d)return[t.waitingStatus,''];if(d<today())return[t.overdueStatus,'overdue'];if(d===today())return[t.todayStatus,'today'];return[t.waitingStatus,'']}
function earliestActualVerification(record){const source=record.completed_at||record.created_at;return verificationMinimum(record.type,source?beijingDateParts(new Date(source)).iso:today())}
function verificationActualAt(r){return r.verified_at||r.verification?.actualAt||''}
function verificationTiming(r,t=templatesForRecord(r).action){const expected=r.data?.verifyDate,actual=verificationActualAt(r);if(!expected||!actual)return null;const actualDate=beijingDateParts(new Date(actual)).iso,delta=Math.round((isoDate(actualDate)-isoDate(expected))/86400000),fill=(text,days)=>String(text).replaceAll('{days}',String(days));if(delta<0)return{label:fill(t.earlyTimingText,Math.abs(delta)),kind:'completed'};if(delta>0)return{label:fill(t.lateTimingText,delta),kind:'overdue'};return{label:t.onTimeText,kind:'today'}}
function verificationTimes(r,t=templatesForRecord(r).action,fullWeekday=false){const expected=r.data?.verifyDate||'',actual=verificationActualAt(r),timing=verificationTiming(r,t);return `<div class="verification-times"><div><small>${esc(t.expectedDateLabel)}</small><strong>${expected?esc(fullWeekday?dailyCalendarDateLabel(expected):formatDate(expected)):esc(t.expectedMissingText)}</strong></div><div><small>${esc(t.actualDateLabel)}</small><strong>${actual?esc(beijingDateTime(actual)):esc(t.actualMissingText)}</strong></div>${timing?`<span class="badge ${timing.kind}">${esc(timing.label)}</span>`:''}</div>`}
function actionCard(r,art=RECORD_ART[r.type][0]){
  const pending=r.status==='completed',t=templatesForRecord(r).action,b=pending?dueBadge(r,t):[t.verifiedStatus,'verified'],v=r.verification||{},earliest=pending?earliestActualVerification(r):'',tooEarly=pending&&today()<earliest;
  const type=TYPES[r.type],day=overviewDateParts(r.period),date=day?`${day.calendarDate} ${day.weekday}`:formatDate(r.period),heading=overviewRecordTitle({...r,title:r.title||r.data.action||t.pageTitle},date,type.label);
  return `<article class="action-archive-card type-${esc(r.type)}" aria-labelledby="action-title-${esc(r.id)}"><div class="action-archive-top"><span class="history-category"><span aria-hidden="true">${TYPE_ICONS[r.type]}</span>${esc(type.label)}</span><span class="action-state ${esc(b[1])}"><i aria-hidden="true"></i>${esc(b[0])}</span></div>
  <div class="action-archive-body"><div class="action-archive-copy">${heading.showDate?`<p class="action-record-period">${esc(date)}</p>`:''}<h3 id="action-title-${esc(r.id)}">${esc(heading.title)}</h3></div>${verificationTimes(r,t,true)}<div class="action-archive-art" aria-hidden="true"><span></span><img src="${esc(art.src)}" alt="" width="1254" height="1254" loading="lazy" draggable="false"></div></div>
  <div class="action-reading">
    <section class="action-reading-plan"><h4>${esc(t.originalActionTitle)}</h4><p>${esc(r.data.action||t.missingActionText)}</p></section>
    ${pending?'':`<div class="action-reading-outcome"><section><h4>${esc(t.resultTitle)}</h4><p>${esc(v.result||t.missingResultText)}</p></section><section><h4>${esc(t.adjustmentTitle)}</h4><p>${esc(v.adjustment||t.missingResultText)}</p></section></div>`}
  </div>
  <div class="action-archive-footer"><button type="button" class="action-record-open" data-open-record="${esc(r.id)}">${esc(t.viewRecordButton)} <span aria-hidden="true">↗</span></button>${pending?`<button type="button" class="action-verify-button" data-open-action="${esc(r.id)}" ${tooEarly?'disabled':''}>${tooEarly?`最早 ${esc(dailyCalendarDateLabel(earliest))} 验证`:esc(r.type==='decision'?t.decisionActionButton:t.submitActionButton)}${tooEarly?'':'<span aria-hidden="true">→</span>'}</button>`:''}</div></article>`;
}
function renderActions(){
  const artwork=recordArtAssignments(state.records),pending=state.records.filter(r=>r.status==='completed').sort((a,b)=>String(a.data.verifyDate).localeCompare(String(b.data.verifyDate))),verified=state.records.filter(r=>r.status==='verified').sort((a,b)=>String(verificationActualAt(b)).localeCompare(String(verificationActualAt(a)))),t=currentActionTemplate();
  shell(`<section class="actions-page" aria-labelledby="actions-title"><header class="history-hero actions-hero"><div class="history-hero-copy"><p class="history-kicker">知行之间 · 让结果作答</p><h1 id="actions-title">${esc(t.pageTitle)}</h1><p class="history-hero-note">${esc(t.pageIntro)}</p><button type="button" class="history-write" data-nav="history">${esc(t.historyButton)} <span aria-hidden="true">↗</span></button></div><div class="history-hero-art actions-hero-art" aria-hidden="true"><span class="history-hero-orbit"></span><img src="/assets/daily/action.webp?v=1.0.0-overview26" alt="" width="1254" height="1254"></div></header>
  <section class="actions-section actions-section-pending" aria-labelledby="actions-pending-title"><header class="actions-section-head"><div><p class="actions-section-kicker">约定 · 正在路上</p><h2 id="actions-pending-title">${esc(t.pendingTitle)}</h2><p>${esc(t.pendingIntro)}</p></div></header><div class="actions-pending-surface"><div class="actions-tallies" aria-label="行动验证数量"><div><strong>${pending.length}</strong><span>${esc(t.pendingTitle)}</span></div><div><strong>${verified.length}</strong><span>${esc(t.verifiedTitle)}</span></div></div><div class="action-archive-grid">${pending.length?pending.map(r=>actionCard(r,artwork.get(r.id))).join(''):`<div class="actions-empty"><img src="/assets/daily/calendar.webp?v=1.0.0-overview26" alt="" width="1254" height="1254" loading="lazy" aria-hidden="true"><div><p class="actions-section-kicker">留一点时间，等待结果</p><h3>${esc(t.pendingEmptyTitle)}</h3><p>${esc(t.pendingEmptyText)}</p></div></div>`}</div></div></section>
  <section class="actions-section" aria-labelledby="actions-verified-title"><header class="actions-section-head"><div><p class="actions-section-kicker">回声 · 已有答案</p><h2 id="actions-verified-title">${esc(t.verifiedTitle)}</h2><p>${esc(t.verifiedIntro)}</p></div></header><div class="action-archive-grid">${verified.length?verified.map(r=>actionCard(r,artwork.get(r.id))).join(''):`<div class="actions-empty"><img src="/assets/extended/decision-review.webp?v=1.0.0-palette2" alt="" width="1254" height="1254" loading="lazy" aria-hidden="true"><div><p class="actions-section-kicker">让每次尝试，都留下答案</p><h3>${esc(t.verifiedEmptyTitle)}</h3><p>${esc(t.verifiedEmptyText)}</p></div></div>`}</div></section></section>`);
  bindRecordOpen();
}
function bindActionButtons(root=document){$$('[data-open-action]',root).forEach(b=>b.addEventListener('click',()=>openVerification(b.dataset.openAction)))}
function decisionAdvice(outcome,process){if(outcome==='好'&&process==='好')return'保留有效方法，并提炼它适用的条件。';if(outcome==='好'&&process==='差')return'结果可能包含运气，警惕复制有问题的过程。';if(outcome==='差'&&process==='好')return'检查策略、结果滞后和环境，不必否定所有判断。';if(outcome==='差'&&process==='差')return'优先修正信息收集、风险判断与执行方法。';return''}
function openVerification(id){
  const r=state.records.find(x=>x.id===id);if(!r)return;
  const earliest=earliestActualVerification(r);if(today()<earliest){toast(`最早可在 ${dailyCalendarDateLabel(earliest)} 提交验证结果`,'error');return}
  const t=templatesForRecord(r).action,art=recordArtAssignments(state.records).get(r.id)||RECORD_ART[r.type][0];
  openModal(`<div class="modal-head verification-dialog-head"><div><p class="verification-category">${esc(TYPES[r.type].label)} · ${esc(overviewDateParts(r.period)?.full||formatDate(r.period))}</p><h2>${esc(r.type==='decision'?t.decisionModalTitle:t.modalTitle)}</h2><p>${esc(t.modalIntro)}</p></div><div class="verification-dialog-art" aria-hidden="true"><img src="${esc(art.src)}" alt="" width="1254" height="1254" draggable="false"></div><button type="button" class="modal-close" data-close>×</button></div>
  <section class="verification-original"><p class="verification-original-label">${esc(t.originalActionLabel)}</p><blockquote>${esc(r.data.action||t.missingActionText)}</blockquote><dl><div><dt>${esc(t.expectedDateLabel)}</dt><dd>${esc(r.data.verifyDate?dailyCalendarDateLabel(r.data.verifyDate):t.expectedMissingText)}</dd></div><div><dt>${esc(t.actualDateLabel)}</dt><dd>${esc(t.actualAutoText)}</dd></div></dl></section>
  <form id="verify-form"><div class="field"><label for="verify-result">${esc(t.resultPrompt)}</label><textarea id="verify-result" name="result" required maxlength="6000"></textarea></div>${r.type==='decision'?`<div class="input-grid"><div class="field"><label for="verify-outcome">${esc(t.outcomePrompt)}</label><select id="verify-outcome" name="outcome" required><option value="">请选择</option><option>好</option><option>差</option></select></div><div class="field"><label for="verify-process">${esc(t.processPrompt)}</label><select id="verify-process" name="process" required><option value="">请选择</option><option>好</option><option>差</option></select></div></div><div class="subsection hidden" id="decision-advice" role="status"></div>`:''}<div class="field"><label for="verify-adjustment">${esc(t.adjustmentPrompt)}</label><textarea id="verify-adjustment" name="adjustment" required maxlength="6000"></textarea></div><div class="modal-actions"><button class="btn btn-ghost" type="button" data-close>${esc(t.cancelButton)}</button><button class="btn btn-red" type="submit">${esc(t.submitButton)}</button></div></form>`,`verification-dialog type-${esc(r.type)}`);
  if(r.type==='decision'){$('[name=outcome]').addEventListener('change',showAdvice);$('[name=process]').addEventListener('change',showAdvice);function showAdvice(){const advice=decisionAdvice($('[name=outcome]').value,$('[name=process]').value),el=$('#decision-advice');el.textContent=advice;el.classList.toggle('hidden',!advice)}}$('#verify-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,body=Object.fromEntries(new FormData(form)),task=dialogWriteTask(form);if(!task.begin())return;try{const {record}=await request(`/api/records/${id}/verify`,{method:'POST',body});if(!task.current())return;const i=state.records.findIndex(x=>x.id===id);if(i>=0)state.records[i]=record;else state.records.push(record);const stats=await request('/api/stats').catch(()=>null);if(!task.current())return;if(stats)state.stats=stats;task.finish();closeModal();toast('验证结果与实际时间已锁定');renderActions()}catch(err){if(task.current())toast(err.message,'error')}finally{task.finish()}})}


function siteBackupSection(){return state.user.role==='superadmin'?`<section class="card workspace-panel site-backup-card"><div class="workspace-panel-head"><div><p class="workspace-kicker">整站资料 · 迁移副本</p><h2>整站迁移备份</h2></div><span class="badge verified">仅超级管理员</span></div><p class="workspace-panel-description">加密打包全部账户、复盘、设置、账户密码摘要与外部备份配置。</p><div class="backup-notice">整站恢复会完整替换当前站点资料并注销所有会话。适合在新服务器搭建完成后直接迁移，无需进入服务器执行命令。</div><div class="button-row workspace-panel-actions"><button class="btn btn-primary" id="site-backup-export">导出整站备份</button><label class="btn btn-ghost">恢复整站备份<input class="hidden" id="site-backup-file" type="file" accept=".shendu-site"></label></div><p class="help">整站文件使用独立密码进行 PBKDF2 + AES-256-GCM 整包加密；不会明文暴露用户名或数据统计。</p></section>`:''}

// A dialog write belongs to its original modal, page and account. Reauth or
// a forced replacement may detach it while the server is still responding.
function dialogWriteTask(anchor){
  const root=$('#modal-root'),modal=anchor.closest('.modal'),page=$('#backup-content'),account=state.user;
  let active=false,controls=[],persistent='0';
  const connected=()=>anchor.isConnected&&root.contains(anchor)&&anchor.closest('.modal')===modal;
  const current=()=>connected()&&state.user===account&&(!page||page.isConnected);
  return {current,
    begin(){
      if(active||anchor.dataset.dialogBusy==='1'||!current())return false;
      active=true;anchor.dataset.dialogBusy='1';persistent=root.dataset.persistent;
      controls=$$('button,input,select,textarea',modal).map(control=>[control,control.disabled]);
      controls.forEach(([control])=>{control.disabled=true});root.dataset.persistent='1';
      state.dialogWriteOwner=anchor;state.saving=true;return true;
    },
    finish(){
      if(!active)return;active=false;delete anchor.dataset.dialogBusy;
      if(state.dialogWriteOwner===anchor){delete state.dialogWriteOwner;state.saving=false}
      if(connected()){root.dataset.persistent=persistent;controls.forEach(([control,disabled])=>{control.disabled=disabled})}
    }
  };
}

function backupTargetKindLabel(kind){return kind==='s3'?'S3 兼容存储':kind==='webdav'?'WebDAV 网络存储':'外部存储'}
function backupRunRows(runs){
  const visible=runs.filter(run=>(!run.operation||run.operation==='backup')&&['success','error'].includes(run.status)&&!String(run.message||'').includes('连接测试'));
  return visible.length?visible.map(run=>`<tr><td data-label="时间">${esc(beijingDateTime(run.created_at))}</td><td data-label="备份目标"><strong>${esc(run.target_name||'原备份目标')}</strong><small>${esc(backupTargetKindLabel(run.target_kind))}</small></td><td data-label="执行方式">${run.trigger==='scheduled'?'定时备份':run.trigger==='manual'?'手动备份':'历史备份'}</td><td data-label="结果"><span class="badge ${run.status==='success'?'completed':'overdue'}">${run.status==='success'?'备份成功':'备份失败'}</span></td><td data-label="说明">${esc(run.message|| (run.status==='success'?'加密备份已上传至该目标':'备份未完成，请检查目标配置后重试'))}</td></tr>`).join(''):'<tr><td colspan="5" class="workspace-empty-cell">最近十天还没有备份结果。连接测试不计入备份记录。</td></tr>';
}
async function renderBackup(){
  shell(`<section class="workspace-page workspace-backup" aria-labelledby="workspace-backup-title">${spacePageHead('backup',{title:'数据备份',description:'把写下的每一页，妥善留存。服务器内的复盘内容与导出的备份均为密文。'})}<div id="backup-content"><div class="card workspace-panel skeleton" style="height:180px"></div></div></section>`);
  const owner=$('#backup-content'),account=state.user,current=()=>owner.isConnected&&state.user===account;
  try{
    const [status,targets]=await Promise.all([request('/api/backup/status'),request('/api/backup/targets')]);
    if(!current())return;
    renderMarkup($('#backup-content'),`<div class="workspace-backup-grid"><section class="card workspace-panel workspace-personal-backup"><div class="workspace-panel-head"><div><p class="workspace-kicker">个人资料 · 随身副本</p><h2>个人加密备份</h2></div><span class="badge ${status.configured?'completed':status.available?'':'overdue'}">${status.configured?'密码已设置':status.available?'尚未设置密码':'内部密钥待恢复'}</span></div><p class="workspace-panel-description">给复盘留一份只有自己能打开的副本，换一台设备，也能接着记录。</p>${status.error?`<div class="backup-notice">${esc(status.error)}</div>`:''}<div class="button-row workspace-panel-actions"><button class="btn btn-primary" id="backup-export" ${status.configured?'':'disabled'}>导出 .shendu</button><label class="btn btn-ghost">恢复备份<input class="hidden" id="backup-file" type="file" accept=".shendu"></label><button class="btn btn-soft" id="backup-password" ${status.available?'':'disabled'}>${status.configured?'修改备份密码':'设置备份密码'}</button></div><section class="workspace-details" aria-labelledby="backup-ownership-title"><h3 id="backup-ownership-title">加密方式与账户归属</h3><p>整包 PBKDF2-HMAC-SHA-256（600,000 次）与 AES-256-GCM 加密。远端只会收到加密整包。</p><p>新版备份会在密文中写入所属用户名；跨账户恢复必须再次输入原用户名与该文件的备份密码，旧版加密包仍会尽量读取原 profile 进行归属校验。</p></section></section>${siteBackupSection()}
    <section class="card workspace-panel workspace-external-backup"><div class="workspace-panel-head"><div><p class="workspace-kicker">多处留存 · 多一份安心</p><h2>S3 / WebDAV 外部备份</h2><p class="workspace-panel-description">最多 8 个目标，支持手动备份，或指定每天、每周的北京时间。</p></div><button class="btn btn-primary" id="add-target" ${status.configured?'':'disabled'}>新增目标</button></div><div class="list">${targets.targets.length?targets.targets.map(t=>`<div class="backup-target"><div><strong>${esc(t.name)}</strong> <span class="badge">${esc(backupTargetKindLabel(t.kind))}</span><p>${esc(backupScheduleLabel(t))} · ${t.last_success_at?`上次成功 ${beijingDateTime(t.last_success_at)}`:'尚未成功备份'}${t.last_error?` · ${esc(t.last_error)}`:''}</p></div><div class="backup-actions"><button class="btn btn-ghost" data-target-edit="${esc(t.id)}">编辑</button><button class="btn btn-ghost" data-target-test="${esc(t.id)}">测试</button><button class="btn btn-soft" data-target-run="${esc(t.id)}">立即备份</button><button class="btn btn-danger" data-target-delete="${esc(t.id)}">删除</button></div></div>`).join(''):`<div class="workspace-empty">${workspaceArt('guide','workspace-empty-art')}<div><h3>还没有外部目标</h3><p>可以连接 WebDAV、Cloudflare R2、AWS S3、MinIO 等服务。</p></div></div>`}</div></section>
    <section class="card workspace-panel workspace-backup-runs"><div class="workspace-panel-head"><div><p class="workspace-kicker">每次留存 · 都有回音</p><h2>最近运行记录</h2><p class="workspace-panel-description">最近十天（北京时间），仅记录备份成功和失败；连接测试不计入。</p></div></div><div class="table-wrap"><table class="table backup-runs-table"><thead><tr><th>时间</th><th>备份目标</th><th>执行方式</th><th>结果</th><th>说明</th></tr></thead><tbody>${backupRunRows(targets.runs)}</tbody></table></div></section></div>`);
    bindBackup(status,targets.targets);
  }catch(e){if(!current())return;renderMarkup(owner,`<div class="card workspace-panel workspace-empty"><div><h3>备份信息加载失败</h3><p>${esc(e.message)}</p><button class="btn btn-primary" id="backup-retry" type="button">重试</button></div></div>`);$('#backup-retry',owner).addEventListener('click',()=>renderBackup())}
}

function bindBackup(status,targets=[]){
  $('#backup-password')?.addEventListener('click',()=>{openModal(`<div class="modal-head"><div><h2>${status.configured?'修改':'设置'}备份密码</h2><p>至少 15 个字符。服务器无法替你找回这个密码。</p></div><button class="modal-close" data-close>×</button></div><form id="backup-pass-form"><div class="field"><label>备份密码</label><input name="password" type="password" minlength="15" maxlength="128" required autocomplete="new-password"></div><div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>取消</button><button class="btn btn-primary">保存密码</button></div></form>`);$('#backup-pass-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,body=Object.fromEntries(new FormData(form)),task=dialogWriteTask(form);if(!task.begin())return;try{await request('/api/backup/password',{method:'POST',body});if(!task.current())return;task.finish();closeModal();toast('备份密码已保存');renderBackup()}catch(err){if(task.current())toast(err.message,'error')}finally{task.finish()}})});
  $('#backup-export')?.addEventListener('click',async event=>{const button=event.currentTarget,account=state.user,current=()=>button.isConnected&&state.user===account;if(button.disabled)return;try{button.disabled=true;button.textContent='正在加密…';const blob=await request('/api/backup/export',{method:'POST',body:{}});if(!current())return;downloadBlob(blob,`shendu-${today()}.shendu`);toast('个人加密备份已下载')}catch(error){if(current())toast(error.message,'error')}finally{button.disabled=false;button.textContent='导出 .shendu'}});
  $('#backup-file')?.addEventListener('change',async e=>{
    const input=e.target,file=input.files[0],account=state.user,visit=Symbol();input.backupReadOwner=visit;
    const current=()=>input.isConnected&&input.backupReadOwner===visit&&state.user===account;
    input.value='';
    if(!file)return;
    if(file.size>36*1024*1024){toast('备份文件超过 36 MB，无法导入','error');return}
    try{
      toast('正在读取加密备份…');
      const encryptedBackup=await file.text();
      if(!current())return;
      if(!encryptedBackup.trim())throw new Error('备份文件为空');
      openModal(`<div class="modal-head"><div><h2>输入这份备份的密码</h2><p>${esc(file.name)} · 如果这是修改密码前生成的旧备份，请填写生成它时使用的旧密码。</p></div><button class="modal-close" data-close>×</button></div><form id="restore-password-form"><div class="field"><label>备份密码</label><input name="password" type="password" minlength="15" maxlength="256" required autocomplete="current-password"></div><div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>取消</button><button type="submit" class="btn btn-primary">校验备份</button></div></form>`);
      $('#restore-password-form').addEventListener('submit',async ev=>{
        ev.preventDefault();
        const submit=$('#restore-password-form button[type="submit"]');
        const password=String(new FormData(ev.currentTarget).get('password')||'');
        const task=dialogWriteTask(ev.currentTarget);if(!task.begin())return;
        try{
          submit.disabled=true;submit.textContent='正在校验…';
          const preview=await request('/api/data/inspect',{method:'POST',body:{encryptedBackup,password}});
          if(!task.current())return;task.finish();
          const crossAccount=preview.requiresOwnerConfirmation===true;
          openModal(`<div class="modal-head"><div><h2>恢复前确认</h2><p>备份已通过密码、完整性与账户归属校验。</p></div><button class="modal-close" data-close>×</button></div><div class="lock-summary">备份所属账户：${esc(preview.ownerUsername||'无法识别')}<br>当前登录账户：${esc(state.user.username)}<br>导出时间：${esc(beijingDateTime(preview.exportedAt)||preview.exportedAt||'未记录')}<br>总条目：${preview.count}<br>复盘记录：${preview.counts.record||0}</div>${crossAccount?`<div class="backup-notice">检测到备份账户与当前账户不同。为防止误恢复，请重新输入备份所属用户名和生成这份文件时使用的备份密码。</div><div class="input-grid"><div class="field"><label for="source-backup-username">备份所属用户名</label><input id="source-backup-username" maxlength="32" required autocomplete="username" placeholder="输入 ${esc(preview.ownerUsername||'原用户名')}"></div><div class="field"><label for="source-backup-password">该文件的备份密码</label><input id="source-backup-password" type="password" minlength="15" maxlength="256" required autocomplete="current-password"></div></div>`:''}<div class="field" style="margin-top:16px"><label>恢复方式</label><select id="restore-mode"><option value="merge">安全合并：保留较新的记录</option><option value="replace">完整恢复：替换当前账户复盘</option></select></div><div class="modal-actions"><button class="btn btn-ghost" data-close>取消</button><button class="btn btn-red" id="apply-restore">开始恢复</button></div>`);
          $('#apply-restore').addEventListener('click',async()=>{
            const button=$('#apply-restore'),mode=$('#restore-mode').value;
            if(button.disabled)return;
            const restore=dialogWriteTask(button);
            try{
              const sourceUsername=crossAccount?String($('#source-backup-username')?.value||'').trim():'';
              const restorePassword=crossAccount?String($('#source-backup-password')?.value||''):password;
              if(crossAccount&&(!sourceUsername||!restorePassword))throw new Error('请输入备份所属用户名和该文件的备份密码');
              if(!restore.begin())return;
              button.disabled=true;button.textContent='正在恢复…';
              await request('/api/data/import',{method:'POST',body:{encryptedBackup,password:restorePassword,sourceUsername,mode,confirmation:mode==='replace'?'RESTORE':undefined}});
              if(!restore.current()||!await refreshData(restore.current))return;
              restore.finish();closeModal();toast('备份已恢复');renderBackup();
            }catch(err){if(restore.current()){button.textContent='开始恢复';toast(err.message,'error')}}finally{restore.finish()}
          });
        }catch(err){if(task.current()){submit.textContent='校验备份';toast(err.message,'error')}}finally{task.finish()}
      });
    }catch(err){if(current())toast(err.message,'error')}
  });
  $('#add-target')?.addEventListener('click',()=>openTargetModal());$$('[data-target-edit]').forEach(b=>b.addEventListener('click',()=>openTargetModal(targets.find(t=>t.id===b.dataset.targetEdit))));
  $$('[data-target-test]').forEach(b=>b.addEventListener('click',()=>targetAction(b.dataset.targetTest,'test',b)));$$('[data-target-run]').forEach(b=>b.addEventListener('click',()=>targetAction(b.dataset.targetRun,'run',b)));$$('[data-target-delete]').forEach(b=>b.addEventListener('click',()=>{
    openModal(`<div class="modal-head"><div><h2>删除这个备份目标？</h2><p>删除后，系统将不再向这个目标发送备份。</p></div><button class="modal-close" data-close>×</button></div><div class="backup-notice">此操作仅移除连接配置，已经保存在远端的备份文件不会被删除。</div><div class="modal-actions"><button class="btn btn-ghost" type="button" data-close>取消</button><button class="btn btn-red" type="button" id="delete-target-confirm">确认删除目标</button></div>`);
    $('#delete-target-confirm').addEventListener('click',async e=>{
      const button=e.currentTarget;if(button.disabled)return;
      const task=dialogWriteTask(button);if(!task.begin())return;
      try{await request(`/api/backup/targets/${b.dataset.targetDelete}`,{method:'DELETE'});if(task.current()){task.finish();closeModal();toast('目标已删除');renderBackup()}}
      catch(err){if(task.current())toast(err.message,'error')}
      finally{task.finish()}
    });
  }));
  bindSiteBackup();
}
function downloadBlob(blob,filename){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function bindSiteBackup(){
  $('#site-backup-export')?.addEventListener('click',()=>{
    openModal(`<div class="modal-head"><div><h2>导出整站加密备份</h2><p>文件包含本站全部账户与资料，请设置独立密码并妥善保存。</p></div><button class="modal-close" data-close>×</button></div><form id="site-export-form"><div class="field"><label for="site-current-password">当前超级管理员登录密码</label><input id="site-current-password" name="currentPassword" type="password" minlength="15" maxlength="128" required autocomplete="current-password"></div><div class="input-grid"><div class="field"><label for="site-export-password">整站备份密码</label><input id="site-export-password" name="backupPassword" type="password" minlength="15" maxlength="128" required autocomplete="new-password"></div><div class="field"><label for="site-export-password-confirm">再次输入整站备份密码</label><input id="site-export-password-confirm" name="backupPasswordConfirm" type="password" minlength="15" maxlength="128" required autocomplete="new-password"></div></div><div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>取消</button><button class="btn btn-primary" type="submit">生成并下载</button></div></form>`);
    $('#site-export-form').addEventListener('submit',async event=>{
      event.preventDefault();const form=event.currentTarget,button=form.querySelector('button[type="submit"]'),values=Object.fromEntries(new FormData(form));
      if(values.backupPassword!==values.backupPasswordConfirm){toast('两次输入的整站备份密码不一致','error');return}
      const task=dialogWriteTask(form);if(!task.begin())return;
      try{button.disabled=true;button.textContent='正在加密整站资料…';const blob=await request('/api/admin/site-backup/export',{method:'POST',body:{currentPassword:values.currentPassword,backupPassword:values.backupPassword}});if(!task.current())return;downloadBlob(blob,`shendu-site-${today()}.shendu-site`);task.finish();closeModal();toast('整站加密备份已下载')}
      catch(error){if(task.current()){button.textContent='生成并下载';toast(error.message,'error')}}finally{task.finish()}
    });
  });
  $('#site-backup-file')?.addEventListener('change',async event=>{
    const input=event.target,file=input.files[0],account=state.user,visit=Symbol();input.backupReadOwner=visit;input.value='';if(!file)return;
    const current=()=>input.isConnected&&input.backupReadOwner===visit&&state.user===account;
    if(file.size>128*1024*1024){toast('整站备份超过 128 MB，无法通过网页恢复','error');return}
    try{
      toast('正在读取整站加密备份…');const encryptedBackup=await file.text();if(!current())return;if(!encryptedBackup.trim())throw new Error('整站备份文件为空');
      openModal(`<div class="modal-head"><div><h2>校验整站备份</h2><p>${esc(file.name)} · 输入生成这份整站备份时设置的密码。</p></div><button class="modal-close" data-close>×</button></div><form id="site-inspect-form"><div class="field"><label for="site-restore-password">整站备份密码</label><input id="site-restore-password" name="backupPassword" type="password" minlength="15" maxlength="256" required autocomplete="current-password"></div><div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>取消</button><button class="btn btn-primary" type="submit">校验整站备份</button></div></form>`);
      $('#site-inspect-form').addEventListener('submit',async inspectEvent=>{
        inspectEvent.preventDefault();const inspectForm=inspectEvent.currentTarget,inspectButton=inspectForm.querySelector('button[type="submit"]'),backupPassword=String(new FormData(inspectForm).get('backupPassword')||'');
        const task=dialogWriteTask(inspectForm);if(!task.begin())return;
        try{
          inspectButton.disabled=true;inspectButton.textContent='正在校验…';const preview=await request('/api/admin/site-backup/inspect',{method:'POST',body:{encryptedBackup,backupPassword}});
          if(!task.current())return;task.finish();
          openModal(`<div class="modal-head"><div><h2>确认恢复整站资料</h2><p>备份已通过密码与完整性校验。恢复完成后所有账户都会退出登录。</p></div><button class="modal-close" data-close>×</button></div><div class="lock-summary">创建时间：${esc(beijingDateTime(preview.createdAt)||preview.createdAt||'未记录')}<br>账户：${preview.users} 个<br>复盘记录：${preview.records} 条<br>设置：${preview.settings} 项<br>外部备份目标：${preview.targets} 个</div><div class="backup-notice">此操作会删除当前站点的全部账户与资料，再恢复备份中的完整数据。请确认你保存了当前站点所需内容。</div><form id="site-restore-form"><div class="field"><label for="site-restore-current-password">当前超级管理员登录密码</label><input id="site-restore-current-password" name="currentPassword" type="password" minlength="15" maxlength="128" required autocomplete="current-password"></div><div class="field"><label for="site-restore-confirmation">输入“恢复全部资料”确认</label><input id="site-restore-confirmation" name="confirmationText" required autocomplete="off" placeholder="恢复全部资料"></div><div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>取消</button><button class="btn btn-red" type="submit">完整恢复本站</button></div></form>`);
          $('#site-restore-form').addEventListener('submit',async restoreEvent=>{
            restoreEvent.preventDefault();const restoreForm=restoreEvent.currentTarget,restoreButton=restoreForm.querySelector('button[type="submit"]'),values=Object.fromEntries(new FormData(restoreForm));
            if(String(values.confirmationText||'').trim()!=='恢复全部资料'){toast('请输入“恢复全部资料”后再继续','error');return}
            const restore=dialogWriteTask(restoreForm);if(!restore.begin())return;
            try{restoreButton.disabled=true;restoreButton.textContent='正在恢复全部资料…';await request('/api/admin/site-backup/restore',{method:'POST',body:{encryptedBackup,backupPassword,currentPassword:values.currentPassword,confirmation:'RESTORE_SITE'}});if(!restore.current())return;restore.finish();closeModal();state.user=null;toast('整站资料已恢复，即将返回登录页');setTimeout(()=>{if(state.user===null)location.assign('/')},1200)}
            catch(error){if(restore.current()){restoreButton.textContent='完整恢复本站';toast(error.message,'error')}}finally{restore.finish()}
          });
        }catch(error){if(task.current()){inspectButton.textContent='校验整站备份';toast(error.message,'error')}}finally{task.finish()}
      });
    }catch(error){if(current())toast(error.message,'error')}
  });
}
function backupScheduleFields(target={}){
  const time=target.scheduleTime||'02:00',weekday=Number(target.scheduleWeekday)||1;
  return `<div id="target-schedule-fields" class="backup-schedule-fields"><div class="field" data-backup-weekday><label for="target-schedule-weekday">备份星期</label><select name="scheduleWeekday" id="target-schedule-weekday" aria-label="备份星期">${['星期一','星期二','星期三','星期四','星期五','星期六','星期日'].map((label,index)=>`<option value="${index+1}" ${weekday===index+1?'selected':''}>${label}</option>`).join('')}</select></div><div class="field" data-backup-time><label for="target-schedule-time">备份时间（北京时间）</label><input name="scheduleTime" id="target-schedule-time" type="time" lang="zh-CN" step="60" value="${esc(time)}" required aria-describedby="backup-schedule-hint"></div><p class="help" id="backup-schedule-hint">按北京时间每分钟检查，到点后自动执行，任务繁忙时顺延；服务恢复后只补最近一次到期任务。</p></div>`;
}
function bindBackupSchedule(form){
  const schedule=$('[name="schedule"]',form),time=$('[name="scheduleTime"]',form),weekday=$('[name="scheduleWeekday"]',form);
  const sync=()=>{const manual=schedule.value==='manual',weekly=schedule.value==='weekly';$('#target-schedule-fields',form).hidden=manual;$('[data-backup-weekday]',form).hidden=!weekly;time.disabled=manual;weekday.disabled=!weekly};
  schedule.addEventListener('change',sync);sync();
}
function openTargetModal(existing=null){
  openModal(`<div class="modal-head"><div><h2>${existing?'编辑':'新增'}外部备份目标</h2><p>${existing?'连接设置和备份计划会保留；为安全起见，请重新填写连接凭据。':'只接受 HTTPS 公网地址，系统会拒绝本机、私网和保留地址。'}</p></div><button class="modal-close" data-close>×</button></div><form id="target-form"><div class="input-grid"><div class="field"><label for="target-name">名称</label><input id="target-name" name="name" maxlength="80" required value="${esc(existing?.name||'')}" placeholder="例如：我的云备份"></div><div class="field"><label for="target-kind">类型</label><select name="kind" id="target-kind"><option value="webdav" ${existing?.kind==='webdav'?'selected':''}>WebDAV 网络存储</option><option value="s3" ${existing?.kind==='s3'?'selected':''}>S3 兼容存储</option></select></div></div><div id="target-fields"></div><div class="field"><label for="target-schedule">备份周期</label><select name="schedule" id="target-schedule"><option value="manual" ${!existing?.schedule||existing.schedule==='manual'?'selected':''}>仅手动</option><option value="daily" ${existing?.schedule==='daily'?'selected':''}>每天定时</option><option value="weekly" ${existing?.schedule==='weekly'?'selected':''}>每周定时</option></select></div>${backupScheduleFields(existing||{})}<div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>取消</button><button class="btn btn-primary" type="submit">保存目标</button></div></form>`);
  const form=$('#target-form'),drafts={};
  const draw=()=>{
    const region=$('#target-fields',form),previous=region.dataset.kind;
    if(previous){drafts[previous]=Object.fromEntries($$('input',region).map(input=>[input.name,input.type==='checkbox'?input.checked:input.value]))}
    const kind=$('#target-kind',form).value,config=drafts[kind]||(existing?.kind===kind?existing.config||{}:{});
    renderMarkup(region,kind==='webdav'?`<div class="field"><label for="target-url">网络存储服务地址</label><input id="target-url" name="url" type="url" required value="${esc(config.url||'')}" placeholder="填写网络存储服务的完整地址"></div><div class="input-grid"><div class="field"><label for="target-username">账号</label><input id="target-username" name="username" required autocomplete="off" value="${esc(drafts[kind]?.username||'')}"></div><div class="field"><label for="target-password">密码／应用密码</label><input id="target-password" name="password" type="password" required autocomplete="off" value="${esc(drafts[kind]?.password||'')}"></div></div><div class="field"><label for="target-directory">远端目录</label><input id="target-directory" name="directory" value="${esc(config.directory??'shendu')}"></div>`:`<div class="field"><label for="target-endpoint">服务地址</label><input id="target-endpoint" name="endpoint" type="url" required value="${esc(config.endpoint||'')}" placeholder="填写云存储提供的完整服务地址"></div><div class="input-grid"><div class="field"><label for="target-region">区域</label><input id="target-region" name="region" value="${esc(config.region==='auto'?'':config.region||'')}" placeholder="填写存储服务要求的区域"><p class="help">按存储服务要求填写；支持自动区域模式时可留空。</p></div><div class="field"><label for="target-bucket">存储桶</label><input id="target-bucket" name="bucket" required value="${esc(config.bucket||'')}" placeholder="填写存储桶名称"></div><div class="field"><label for="target-access-key">访问密钥</label><input id="target-access-key" name="accessKey" required autocomplete="off" value="${esc(drafts[kind]?.accessKey||'')}"></div><div class="field"><label for="target-secret-key">秘密密钥</label><input id="target-secret-key" name="secretKey" type="password" required autocomplete="off" value="${esc(drafts[kind]?.secretKey||'')}"></div></div><div class="field"><label for="target-directory">远端目录</label><input id="target-directory" name="directory" value="${esc(config.directory??'shendu')}"></div><label class="help"><input type="checkbox" name="pathStyle" ${config.pathStyle?'checked':''}> 使用路径式访问地址</label>`);
    region.dataset.kind=kind;
  };
  draw();$('#target-kind',form).addEventListener('change',draw);bindBackupSchedule(form);
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!form.reportValidity())return;
    const fd=new FormData(form),kind=fd.get('kind'),config={};
    for(const [key,value] of fd)if(!['name','kind','schedule','scheduleTime','scheduleWeekday'].includes(key))config[key]=value==='on'?true:value;
    const schedule=fd.get('schedule'),time=$('[name="scheduleTime"]',form).value;
    const body={name:fd.get('name'),kind,schedule,scheduleTime:schedule==='manual'?(time||'02:00'):time,scheduleWeekday:Number($('[name="scheduleWeekday"]',form).value)||1,config};
    const task=dialogWriteTask(form);if(!task.begin())return;
    try{await request(existing?`/api/backup/targets/${existing.id}`:'/api/backup/targets',{method:existing?'PATCH':'POST',body});if(!task.current())return;task.finish();closeModal();toast('外部目标与备份计划已保存');renderBackup()}
    catch(error){if(task.current())toast(error.message,'error')}finally{task.finish()}
  });
}

async function targetAction(id,action,button){const page=$('#backup-content'),account=state.user,current=()=>page?.isConnected&&state.user===account;if(!current()||button?.disabled)return;const controls=button?$$('button',button.closest('.backup-target')):[],disabled=controls.map(control=>control.disabled);controls.forEach(control=>{control.disabled=true});try{toast(action==='test'?'正在测试连接…':'正在生成并上传加密备份…');await request(`/api/backup/targets/${id}/${action}`,{method:'POST'});if(!current())return;toast(action==='test'?'连接测试成功':'外部备份完成');renderBackup()}catch(e){if(current())toast(e.message,'error')}finally{controls.forEach((control,index)=>{control.disabled=disabled[index]})}}


function accountSecurityHtml(){
  const user=state.user,role=user.role==='superadmin'?'超级管理员':user.role==='admin'?'管理员':'成员';
  return `<div class="workspace-account-grid"><section class="workspace-panel workspace-identity-panel" aria-labelledby="account-identity-title"><p class="workspace-kicker">我的账户 · 安心记录</p><h2 id="account-identity-title">${esc(user.displayName||user.username)}</h2><dl class="workspace-identity-details"><div><dt>用户名</dt><dd>${esc(user.username)}</dd></div><div><dt>账户角色</dt><dd>${role}</dd></div></dl>${workspaceArt('account','workspace-identity-art')}<div class="workspace-signout-panel"><p class="workspace-panel-description">如有未保存的复盘，请先保存或放弃修改再退出。</p><button class="btn btn-danger" id="logout" type="button">安全退出</button></div></section><form id="password-form" class="workspace-panel workspace-password-panel"><p class="workspace-kicker">为私人的记录 · 留一道门</p><h2>更新登录密码</h2><p class="workspace-panel-description">新密码至少 15 个字符，修改后需要重新登录。</p><fieldset><div class="field"><label for="account-current-password">当前密码</label><input id="account-current-password" name="currentPassword" type="password" required autocomplete="current-password"></div><div class="field"><label for="account-new-password">新密码</label><input id="account-new-password" name="newPassword" type="password" minlength="15" maxlength="128" required autocomplete="new-password"></div><button class="btn btn-primary" type="submit">修改密码</button></fieldset></form></div>`;
}
async function renderUsers(q=''){
  const admin=['admin','superadmin'].includes(state.user.role);
  shell(`<section class="workspace-page workspace-users" aria-labelledby="workspace-users-title">${spacePageHead('users',{title:'账户管理',description:'照顾好自己的账户，也为私人的记录留一道门。'})}${accountSecurityHtml()}${admin?`<section class="workspace-members" aria-labelledby="workspace-members-title"><div class="workspace-panel-head workspace-members-head"><div><p class="workspace-kicker">共管 · 权限有界</p><h2 id="workspace-members-title">成员管理</h2><p class="workspace-description">管理员只管理账户状态，不会看到任何人的复盘正文。</p></div><button class="btn btn-primary" id="add-user" type="button">创建成员 <span aria-hidden="true">↗</span></button></div><div id="users-content" class="card workspace-panel users-card skeleton"></div></section>`:''}</section>`);
  bindAccountSecurity();
  if(admin){$('#add-user').addEventListener('click',()=>openUserModal());await loadManagedUsers(q)}
}
async function loadManagedUsers(q=$('#user-search')?.value||''){
  const owner=$('#users-content'),account=state.user;
  if(!owner||!['admin','superadmin'].includes(account?.role))return;
  const visit=Symbol();owner.usersVisit=visit;owner.setAttribute('aria-busy','true');
  const current=()=>owner.isConnected&&owner.usersVisit===visit&&state.user===account;
  try{
    const data=await request(`/api/admin/users?q=${encodeURIComponent(q)}`);
    if(!current())return;
    owner.className='card workspace-panel users-card';
    renderMarkup(owner,`<div class="workspace-panel-head workspace-users-tools"><label class="workspace-user-search"><span>查找账户</span><input id="user-search" placeholder="搜索用户名或称呼" value="${esc(q)}" aria-label="搜索账户"></label>${state.user.role==='superadmin'?`<label class="help registration-toggle"><input type="checkbox" id="registration-open" ${data.registrationOpen?'checked':''}> 允许公开注册</label>`:''}</div><div class="table-wrap users-table-wrap"><table class="table users-table"><thead><tr><th>称呼</th><th>用户名</th><th>加入日期</th><th>角色</th><th>状态</th><th>操作</th></tr></thead><tbody>${data.users.length?data.users.map(u=>`<tr><td data-label="称呼"><span class="workspace-person-name">${esc(u.displayName)}</span>${u.id===state.user.id?'<small class="workspace-self">当前账户</small>':''}</td><td data-label="用户名">${esc(u.username)}</td><td data-label="加入日期">${esc(u.createdAt.slice(0,10))}</td><td data-label="角色">${u.role==='superadmin'?'超级管理员':u.role==='admin'?'管理员':'成员'}</td><td data-label="状态"><span class="badge ${u.status==='active'?'completed':'overdue'}">${u.status==='active'?'正常':'停用'}</span></td><td data-label="操作">${u.id===state.user.id||u.role==='superadmin'||(state.user.role==='admin'&&u.role==='admin')?'—':`<div class="inline-actions"><button class="btn btn-ghost" data-user-toggle="${esc(u.id)}" data-status="${u.status==='active'?'disabled':'active'}">${u.status==='active'?'停用':'恢复'}</button><button class="btn btn-soft" data-user-reset="${esc(u.id)}">重置密码</button>${state.user.role==='superadmin'?`<button class="btn btn-ghost" data-user-role="${esc(u.id)}" data-role="${u.role==='admin'?'member':'admin'}">设为${u.role==='admin'?'成员':'管理员'}</button>`:''}<button class="btn btn-danger" data-user-delete="${esc(u.id)}">删除用户</button></div>`}</td></tr>`).join(''):'<tr class="workspace-empty-row"><td colspan="6" class="workspace-empty-cell">没有找到匹配的账户，试试其他用户名或称呼。</td></tr>'}</tbody></table></div>`);
    bindUsers(data.users,owner);
  }catch(error){
    if(!current())return;
    owner.className='card workspace-panel workspace-empty users-card';
    renderMarkup(owner,`<div><h3>加载失败</h3><p>${esc(error.message)}</p><button class="btn btn-soft" id="users-retry" type="button">重新加载成员</button></div>`);
    $('#users-retry',owner).addEventListener('click',()=>loadManagedUsers(q));
  }finally{if(current())owner.removeAttribute('aria-busy')}
}

function bindUsers(users=[],owner=$('#users-content')){
  $('#user-search',owner)?.addEventListener('change',e=>loadManagedUsers(e.target.value));
  $('#registration-open',owner)?.addEventListener('change',async e=>{const control=e.target;try{await request('/api/admin/registration',{method:'PUT',body:{open:control.checked}});if(control.isConnected)toast('公开注册设置已更新')}catch(error){if(control.isConnected)toast(error.message,'error')}});
  $$('[data-user-toggle]',owner).forEach(button=>button.addEventListener('click',()=>patchUser(button.dataset.userToggle,{status:button.dataset.status})));
  $$('[data-user-role]',owner).forEach(button=>button.addEventListener('click',()=>patchUser(button.dataset.userRole,{role:button.dataset.role})));
  $$('[data-user-reset]',owner).forEach(button=>button.addEventListener('click',()=>openUserModal(button.dataset.userReset)));
  $$('[data-user-delete]',owner).forEach(button=>button.addEventListener('click',()=>{const target=users.find(user=>user.id===button.dataset.userDelete);if(target)openDeleteUserModal(target)}));
}

function openDeleteUserModal(target){openModal(`<div class="modal-head"><div><h2>永久删除用户</h2><p>删除后，${esc(target.displayName)} 的复盘、设置、会话和备份目标都会一并清除。</p></div><button class="modal-close" data-close>×</button></div><div class="backup-notice delete-warning">这项操作无法撤销。请先确认已经保存所需备份。</div><form id="delete-user-form"><div class="field"><label for="delete-user-confirm">输入用户名 <strong>${esc(target.username)}</strong> 确认</label><input id="delete-user-confirm" name="confirmationUsername" required autocomplete="off" autocapitalize="none" spellcheck="false"></div><div class="field"><label for="delete-user-password">你的当前登录密码</label><input id="delete-user-password" name="currentPassword" type="password" minlength="15" maxlength="128" required autocomplete="current-password"></div><div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>取消</button><button class="btn btn-red" type="submit">永久删除此用户</button></div></form>`);$('#delete-user-form').addEventListener('submit',async e=>{e.preventDefault();const body=Object.fromEntries(new FormData(e.currentTarget)),normalizeUsername=value=>String(value||'').trim().normalize('NFKC').toLocaleLowerCase('zh-CN');if(normalizeUsername(body.confirmationUsername)!==normalizeUsername(target.username)){toast('输入的用户名与待删除账户不一致','error');return}try{await request(`/api/admin/users/${target.id}`,{method:'DELETE',body});closeModal();toast(`用户 ${target.username} 已永久删除`);loadManagedUsers()}catch(err){toast(err.message,'error')}})}
function openUserModal(resetId=null){openModal(`<div class="modal-head"><div><h2>${resetId?'重置成员密码':'创建新账户'}</h2><p>${resetId?'该账户现有登录会立即失效，复盘数据会保留。':'管理员创建的账户可以直接登录。'}</p></div><button class="modal-close" data-close>×</button></div><form id="user-form">${resetId?'':`<div class="input-grid"><div class="field"><label>称呼</label><input name="displayName" required maxlength="32"></div><div class="field"><label>用户名</label><input name="username" required minlength="3" maxlength="32"></div></div>${state.user.role==='superadmin'?`<div class="field"><label>角色</label><select name="role"><option value="member">成员</option><option value="admin">管理员</option></select></div>`:''}`}<div class="field"><label>${resetId?'新密码':'初始密码'}</label><input name="password" type="password" required minlength="15" maxlength="128" autocomplete="new-password"></div><div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>取消</button><button class="btn btn-primary">确认</button></div></form>`);$('#user-form').addEventListener('submit',async e=>{e.preventDefault();try{const body=Object.fromEntries(new FormData(e.currentTarget));if(resetId)await request(`/api/admin/users/${resetId}`,{method:'PATCH',body:{password:body.password}});else await request('/api/admin/users',{method:'POST',body});closeModal();toast(resetId?'密码已重置':'账户已创建');loadManagedUsers()}catch(err){toast(err.message,'error')}})}
async function patchUser(id,body){try{await request(`/api/admin/users/${id}`,{method:'PATCH',body});toast('账户已更新');loadManagedUsers()}catch(e){toast(e.message,'error')}}

function settingsGuideHtml(){return `<div class="guide-flow">${['定标','事实','差距','机制','改变','验证'].map((x,i)=>`<div class="guide-step"><b>${String(i+1).padStart(2,'0')}</b><span>${x}</span></div>`).join('')}</div><h3>不同周期分别解决什么问题？</h3><p>每日看行动，不超过 8 分钟；每周找重复出现的条件；每月只选一个瓶颈和一个小实验；90 天重新校准方向；年度看人生结构；重大决策留下当时依据，避免事后诸葛亮。</p><h3>阶段指标怎么写？</h3><p>指标要能在一天结束时明确判断，而不是“变得更好”。例如把“提升收入能力”写成“专注 60 分钟，形成一个可展示的具体输出”。达标线是最低有效行动，不是理想状态。</p><h3>怎样避免越复盘越自责？</h3><ul><li>先写摄像头能拍到的事实，再写自己的解释。</li><li>一次只调整一个最可能影响结果的条件。</li><li>状态差时降低动作门槛，不把休息等同于失败。</li><li>验证的是方法，不是证明自己好或不好。</li></ul><h3>重大决定怎么回看？</h3><p>把过程质量与结果好坏分开。好结果可能来自运气，坏结果也不一定说明当时的判断错误。回到当时真正掌握的信息、可选方案和风险边界，再决定保留什么。</p>`}

function renderGuide(){shell(`<section class="workspace-page workspace-guide" aria-labelledby="workspace-guide-title">${spacePageHead('guide',{title:'使用指南',description:'用事实改善下一次行动。',action:'<button type="button" class="workspace-return" data-nav="settings">← 返回设置</button>'})}<div class="prose guide-content workspace-panel">${settingsGuideHtml()}</div></section>`)}

function openSettings(){attemptNavigate(()=>navigate('settings'))}
function renderSettings(){
  const items=[['account','账户管理','个人安全与成员管理'],['stage','阶段设置','目标与复盘问题'],['guide','使用指南','记录与验证方法']];
  shell(`<section class="workspace-page workspace-settings" aria-labelledby="workspace-settings-title">${spacePageHead('settings',{title:'设置',description:'留出适合自己的节奏，让每一次记录更从容。'})}<div class="settings-menu workspace-settings-menu">${items.map(([key,label,note])=>`<button class="settings-menu-item" type="button" data-settings-target="${key}"><span class="workspace-setting-copy"><strong>${label}</strong><small>${note}</small><span class="workspace-setting-enter" aria-hidden="true">打开 <span>↗</span></span></span>${workspaceArt(key,'workspace-setting-art')}</button>`).join('')}</div><form id="motion-form" class="workspace-panel workspace-motion-form"><fieldset><div class="workspace-motion-copy"><label id="motion-label" for="settings-reduce-motion">减少动态效果</label><p id="motion-description">减弱移动与翻转，让阅读更安静。</p></div><input id="settings-reduce-motion" name="reduceMotion" type="checkbox" aria-labelledby="motion-label" aria-describedby="motion-description" ${state.theme?.reduceMotion?'checked':''}><button class="btn btn-primary" type="submit">保存偏好</button></fieldset></form></section>`);
  $$('[data-settings-target]').forEach(button=>button.addEventListener('click',()=>openSettingsTarget(button.dataset.settingsTarget)));
  bindMotionPreferences();
}
function bindMotionPreferences(){
  const form=$('#motion-form'),account=state.user;let saving=false;
  const current=()=>form.isConnected&&state.user===account;
  form.addEventListener('change',()=>{state.dirty=$('[name="reduceMotion"]',form).checked!==!!state.theme?.reduceMotion});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(saving||!current())return;
    const theme={...state.theme,reduceMotion:new FormData(form).get('reduceMotion')==='on'},fieldset=$('fieldset',form);
    saving=true;state.settingsWriteOwner=form;state.saving=true;form.setAttribute('aria-busy','true');fieldset.disabled=true;
    try{const result=await request('/api/settings',{method:'PUT',body:{theme}});if(!current())return;state.theme=result.theme||theme;state.dirty=false;applyTheme(state.theme);toast('动态偏好已保存')}
    catch(error){if(current())toast(error.message,'error')}
    finally{saving=false;if(state.settingsWriteOwner===form){state.saving=false;delete state.settingsWriteOwner}if(form.isConnected){form.removeAttribute('aria-busy');fieldset.disabled=false}}
  });
}

function openSettingsTarget(target){
  if(target==='stage'){openStage('settings');return}
  const route={account:'users',guide:'guide'}[target];if(route)attemptNavigate(()=>navigate(route));
}
const ACTION_PROMPT_FIELDS = [
  ['resultPrompt','通用问题 1 · 实际结果'],
  ['outcomePrompt','重大决策追加问题 1 · 结果'],
  ['processPrompt','重大决策追加问题 2 · 决策过程'],
  ['adjustmentPrompt','通用问题 2 · 保留或调整']
];

function templateQuestionRow(type,question,index){return `<div class="template-question-row" data-template-question="${esc(question.id)}"><div class="field"><label for="question-${type}-${esc(question.id)}">问题 ${index+1}</label><input id="question-${type}-${esc(question.id)}" aria-label="${esc(`${TYPES[type].label} 问题 ${index+1}`)}" data-review-template="${type}" data-template-key="${esc(question.id)}" maxlength="160" required value="${esc(question.label)}"></div><div class="template-question-actions"><label class="template-required"><input type="checkbox" data-question-required ${question.required?'checked':''}>必填</label><button class="link-button" type="button" data-remove-question aria-label="删除问题 ${index+1}">删除</button></div></div>`}
function templateQuestionsEditor(type,template){const questions=Array.isArray(template.questions)?template.questions:reviewQuestions(type,template),missing=QUESTIONS[type].filter(([id])=>!questions.some(question=>question.id===id));return `<div data-question-rows>${questions.length?questions.map((question,index)=>templateQuestionRow(type,question,index)).join(''):'<p class="help">还没有普通问题，可以添加自己的问题或恢复默认问题。</p>'}</div><div class="template-question-tools"><button class="btn btn-ghost" type="button" data-add-question ${questions.length>=30?'disabled':''}>＋ 添加问题</button>${missing.length?`<details class="template-restore"><summary>恢复已删除的问题</summary><div>${missing.map(([id,label])=>`<button type="button" class="link-button" data-restore-question="${id}" ${questions.length>=30?'disabled':''}>＋ ${esc(label)}</button>`).join('')}</div></details>`:''}</div>`}
function reviewTemplateEditor(type,template){
  const fields=[...(type==='decision'?[["recordTitle","决定名称标题"]]:[]),['actionTitle','行动标题'],['obstacleTitle','阻碍预案标题'],['verifyDateTitle','验证日期标题']];
  return `<details class="template-panel" data-template-type="${type}" ${type==='daily'?'open':''}><summary><span class="template-type-icon type-${type}">${TYPE_ICONS[type]}</span><span><b>${TYPES[type].label}</b><small>增删问题 · 调整必填项</small></span><span class="template-chevron" aria-hidden="true"></span></summary><div class="template-panel-body"><div data-template-questions>${templateQuestionsEditor(type,template)}</div>${type==='daily'?`<div class="template-optional-fields"><h4>每日记录项</h4><p class="help">取消勾选即可从填写流程中移除，重新勾选可恢复。</p>${[['sleep','睡眠'],['energy','精力'],['risk','风险与偏离'],['journal','日记']].map(([id,label])=>`<label><input type="checkbox" data-include-field="${id}" ${reviewDisabledFields(template).includes(id)?'':'checked'}>${label}</label>`).join('')}</div>`:''}<h4>行动与验证</h4><p class="help">保留行动、应对与验证日期，可以修改标题。</p><div class="template-field-grid">${fields.map(([key,label])=>`<div class="field"><label>${label}</label><input aria-label="${esc(`${TYPES[type].label} ${label}`)}" data-review-template="${type}" data-template-key="${key}" maxlength="160" required value="${esc(template[key])}"></div>`).join('')}</div><button class="link-button template-reset" type="button" data-reset-review="${type}">恢复本类默认内容</button></div></details>`;
}
function stageMetricRow(metric,index){return `<div class="stage-metric-row" data-stage-metric="${esc(metric.id)}"><div class="input-grid"><div class="field"><label>指标 ${index+1}</label><input name="metricName${index}" data-metric-name aria-label="指标 ${index+1}" maxlength="80" value="${esc(metric.name)}" required></div><div class="field"><label>具体达标线</label><input name="metricTarget${index}" data-metric-target aria-label="指标 ${index+1} 具体达标线" maxlength="240" value="${esc(metric.target)}" required></div></div><button type="button" class="link-button" data-remove-metric aria-label="删除指标 ${index+1}">删除指标</button></div>`}
function stageMetricEditor(metrics){return `${metrics.map(stageMetricRow).join('')||'<p class="help">暂无阶段指标。每日复盘将跳过这部分。</p>'}`}
function readTemplateQuestions(panel){return $$('[data-template-question]',panel).map(row=>({id:row.dataset.templateQuestion,label:$('[data-review-template]',row).value,required:$('[data-question-required]',row).checked}))}

function actionTemplateEditor(template){return `<details class="template-panel action-template-panel"><summary><span class="template-type-icon action">验</span><span><b>行动验证</b><small>只修改提交验证时的四个问题</small></span><span class="template-chevron" aria-hidden="true"></span></summary><div class="template-panel-body"><div class="template-field-grid">${ACTION_PROMPT_FIELDS.map(([key,label])=>`<div class="field"><label>${label}</label><input aria-label="${esc(`行动验证 ${label}`)}" data-action-template data-template-key="${key}" maxlength="240" required value="${esc(template[key])}"></div>`).join('')}</div><button class="link-button template-reset" type="button" data-reset-action>恢复行动验证默认问题</button></div></details>`}
function resetTemplateInputs(selector,defaults){$$(selector).forEach(input=>{input.value=defaults[input.dataset.templateKey]||''})}

function openStage(returnRoute='settings'){attemptNavigate(()=>{state.settingsReturn=returnRoute; navigate('stage-settings')})}
function renderStageSettings(){
  const s=clone(state.stage);s.metrics=normalizeReviewMetricIds(s.metrics);const reviewTemplates=Object.fromEntries(Object.keys(TYPES).map(type=>[type,mergeReviewTemplate(type,s.reviewTemplates?.[type])])),actionTemplate=mergeActionTemplate(s.actionTemplate);
  shell(`<section class="workspace-page workspace-stage" aria-labelledby="workspace-stage-title">${spacePageHead('stage',{title:'阶段与内容设置',description:'模板只影响草稿和之后新建的复盘；已经完成、验证或锁定的记录保留当时内容。',action:'<button type="button" class="workspace-return" id="stage-settings-back">← 返回</button>'})}<form id="stage-form" class="workspace-form"><fieldset class="stage-edit-fields"><section class="workspace-panel stage-settings-section"><div class="settings-section-title"><span>01</span><div><h3>当前阶段</h3><p>设定阶段长度、关注方向和每日行动基线。</p></div></div><div class="input-grid"><div class="field"><label>当前阶段</label><select name="name">${['稳住底盘','建设能力','产出增长','扩张整合'].map(x=>`<option ${s.name===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>阶段开始日期</label><input name="startDate" type="date" value="${esc(s.startDate)}" required></div><div class="field"><label>阶段长度（7–366 天）</label><input name="days" type="number" min="7" max="366" value="${s.days}" required></div><div class="field"><label>这一阶段最想改善什么</label><input name="focus" maxlength="300" value="${esc(s.focus)}" required></div><div class="field"><label>睡眠达标线（小时）</label><input name="sleepTarget" type="number" min="0" max="24" step=".5" value="${s.sleepTarget}" required></div><div class="field"><label>精力观察线（0–100）</label><input name="energyTarget" type="number" min="0" max="100" step="10" value="${s.energyTarget}" required></div></div><div class="subsection"><h3>阶段指标</h3><p class="help">可添加或删除，最多 12 项；每项对应每日复盘中的一道行动题。</p><div data-stage-metrics>${stageMetricEditor(s.metrics)}</div><button type="button" class="btn btn-ghost" data-add-metric ${s.metrics.length>=12?'disabled':''}>＋ 添加指标</button></div><label class="quarter-toggle-card"><span class="quarter-toggle-art"><strong>90</strong><small>DAYS</small></span><span class="quarter-toggle-copy"><b>90 天复盘</b><small>启用 90 天阶段复盘，用更长周期校准方向。</small></span><input name="showQuarter" type="checkbox" ${s.showQuarter?'checked':''}><span class="quarter-switch" aria-hidden="true"></span></label></section><section class="workspace-panel stage-settings-section template-settings-section"><div class="settings-section-title"><span>02</span><div><h3>六类复盘内容</h3><p>每类最多 30 个普通问题，可新增、删除或设置必填。保存后用于草稿和新复盘，已锁定记录保留原内容。</p></div></div><div class="template-list">${Object.keys(TYPES).map(type=>reviewTemplateEditor(type,reviewTemplates[type])).join('')}</div></section><section class="workspace-panel stage-settings-section template-settings-section"><div class="settings-section-title"><span>03</span><div><h3>行动验证内容</h3><p>修改提交验证时的问题标题，保留结果与后续调整的验证流程。</p></div></div>${actionTemplateEditor(actionTemplate)}</section><div class="modal-actions stage-save-actions"><button type="button" class="btn btn-ghost" id="stage-settings-cancel">取消</button><button class="btn btn-primary">保存全部设置</button></div></fieldset></form></section>`);
  bindStageSettings(actionTemplate);
}
function bindStageSettings(actionTemplate){
  const form=$('#stage-form'),account=state.user,returnRoute=state.settingsReturn==='calendar'?'calendar':'settings';let pending=false;
  const current=()=>form.isConnected&&state.user===account;
  const leave=()=>attemptNavigate(()=>navigate(returnRoute));
  $('#stage-settings-back').addEventListener('click',leave);$('#stage-settings-cancel').addEventListener('click',leave);
  form.addEventListener('input',()=>{state.dirty=true});form.addEventListener('change',()=>{state.dirty=true});
  form.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button||pending)return;
    const panel=button.closest('[data-template-type]'),type=panel?.dataset.templateType;
    if(panel&&(button.matches('[data-add-question],[data-remove-question],[data-restore-question],[data-reset-review]'))){
      let questions=readTemplateQuestions(panel),focusId=null;
      if(button.matches('[data-reset-review]')){
        questions=reviewQuestions(type);resetTemplateInputs(`[data-review-template="${type}"]`,DEFAULT_REVIEW_TEMPLATES[type]);
        $$('[data-include-field]',panel).forEach(input=>{input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}))});
      }else if(button.matches('[data-remove-question]')){
        const id=button.closest('[data-template-question]').dataset.templateQuestion,index=questions.findIndex(question=>question.id===id);
        questions=questions.filter(question=>question.id!==id);focusId=questions[Math.min(index,questions.length-1)]?.id;
      }else if(questions.length<30){
        const restored=QUESTIONS[type].find(([id])=>id===button.dataset.restoreQuestion);
        const question=restored?{id:restored[0],label:restored[1],required:Boolean(restored[2])}:{id:`custom_${crypto.randomUUID().replaceAll('-','')}`,label:'',required:false};
        questions.push(question);focusId=question.id;
      }
      renderMarkup($('[data-template-questions]',panel),templateQuestionsEditor(type,{questions}));state.dirty=true;
      (focusId?$(`[data-template-key="${focusId}"]`,panel):$('[data-add-question]',panel))?.focus();
      toast(button.matches('[data-reset-review]')?'已恢复默认内容，保存后生效':'问题已调整，保存后生效');
    }
    if(button.matches('[data-add-metric],[data-remove-metric]')){
      const metrics=$$('[data-stage-metric]',form).map(row=>({id:row.dataset.stageMetric,name:$('[data-metric-name]',row).value,target:$('[data-metric-target]',row).value}));
      let index=metrics.length;
      if(button.matches('[data-remove-metric]')){index=$$('[data-stage-metric]',form).indexOf(button.closest('[data-stage-metric]'));metrics.splice(index,1)}else if(metrics.length<12)metrics.push({id:`metric_${crypto.randomUUID().replaceAll('-','')}`,name:'',target:''});
      renderMarkup($('[data-stage-metrics]',form),stageMetricEditor(metrics));$('[data-add-metric]',form).disabled=metrics.length>=12;state.dirty=true;
      ($$('[data-metric-name]',form)[Math.min(index,metrics.length-1)]||$('[data-add-metric]',form)).focus();
    }
  });
  $('[data-reset-action]',form)?.addEventListener('click',()=>{resetTemplateInputs('[data-action-template]',DEFAULT_ACTION_TEMPLATE);state.dirty=true;toast('行动验证已恢复默认问题')});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(pending||!current())return;
    $$('[data-review-template]',form).forEach(input=>{input.value=input.value.trim()});
    if(!form.checkValidity()){const invalid=$(':invalid',form);for(let parent=invalid?.parentElement;parent&&parent!==form;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;invalid?.focus();form.reportValidity();return}
    const f=new FormData(form),reviewTemplates=Object.fromEntries(Object.keys(TYPES).map(type=>[type,{...Object.fromEntries($$(`[data-review-template="${type}"]`,form).map(input=>[input.dataset.templateKey,input.value.trim()])),questions:readTemplateQuestions($(`[data-template-type="${type}"]`,form)),disabledFields:$$('[data-include-field]',$(`[data-template-type="${type}"]`,form)).filter(input=>!input.checked).map(input=>input.dataset.includeField)}])),actionPrompts=Object.fromEntries($$('[data-action-template]',form).map(input=>[input.dataset.templateKey,input.value.trim()])),savedActionTemplate={...actionTemplate,...actionPrompts},stage={name:f.get('name'),startDate:f.get('startDate'),days:Number(f.get('days')),focus:f.get('focus'),sleepTarget:Number(f.get('sleepTarget')),energyTarget:Number(f.get('energyTarget')),showQuarter:f.get('showQuarter')==='on',metrics:$$('[data-stage-metric]',form).map(row=>({id:row.dataset.stageMetric,name:$('[data-metric-name]',row).value,target:$('[data-metric-target]',row).value})),reviewTemplates,actionTemplate:savedActionTemplate};
    pending=true;state.settingsWriteOwner=form;state.saving=true;form.setAttribute('aria-busy','true');$('fieldset',form).disabled=true;
    try{const result=await request('/api/settings',{method:'PUT',body:{stage}});if(!current())return;state.stage=result.stage||stage;state.dirty=false;toast('阶段与内容设置已保存');navigate(returnRoute)}
    catch(error){if(current())toast(error.message,'error')}
    finally{pending=false;if(state.settingsWriteOwner===form){state.saving=false;delete state.settingsWriteOwner}if(form.isConnected){form.removeAttribute('aria-busy');$('fieldset',form).disabled=false}}
  });
}

function bindAccountSecurity(){
  const form=$('#password-form'),logout=$('#logout'),account=state.user;
  let pending=false;
  const current=()=>form.isConnected&&state.user===account;
  const busy=value=>{pending=value;if(value){state.accountWriteOwner=form;state.saving=true;form.setAttribute('aria-busy','true')}else{if(state.accountWriteOwner===form){state.saving=false;delete state.accountWriteOwner}form.removeAttribute('aria-busy')}$('fieldset',form).disabled=value;logout.disabled=value};
  const finish=()=>{if(current())busy(false);else if(state.accountWriteOwner===form){state.saving=false;delete state.accountWriteOwner}};
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(pending||!current())return;
    const body=Object.fromEntries(new FormData(form));busy(true);
    try{await request('/api/me/password',{method:'POST',body});if(!current())return;form.reset();toast('密码已修改，请重新登录');await init()}
    catch(error){if(current())toast(error.message,'error')}
    finally{finish()}
  });
  logout.addEventListener('click',async()=>{
    if(pending||!current())return;
    if(state.dirty){toast('请先保存或放弃当前修改','error');return}
    busy(true);
    try{await request('/api/auth/logout',{method:'POST'});if(current())await init()}
    catch(error){if(current())toast(error.message,'error')}
    finally{finish()}
  });
}

function syncOverlayBackground(){
  // Radix preserves aria-live descendants. Explicit inert ownership ensures a
  // review's live date/save status cannot expose its surrounding editor behind
  // a modal. Both overlay roots and the singleton toast live outside #app.
  const app=$('#app');if(app)app.inert=!!($('#modal-root .modal'));
}

function openModal(content,size='',persistent=false){
  cancelDailyTypewriter();const root=prepareDialogContainer($('#modal-root'));if(!root.children.length)modalReturnFocus=document.activeElement;
  root.dataset.persistent=persistent?'1':'0';
  const template=document.createElement('template');template.innerHTML=content;
  const title=$('.modal-head h2',template.content)?.textContent||'慎独',description=$('.modal-head p',template.content)?.textContent||'';
  const customSurface=/\b(?:workspace-dialog|verification-dialog)\b/.test(size)||$('form:is(#backup-pass-form,#restore-password-form,#site-export-form,#site-inspect-form,#site-restore-form,#target-form,#delete-user-form,#user-form)',template.content);
  if(!customSurface){const head=$('.modal-head',template.content);if(head&&!$('.legacy-dialog-art',head)){const art=$('#apply-restore,#delete-target-confirm',template.content)?'daily-23-protect-time':$('#confirm-complete',template.content)?'daily-30-tomorrow-bag':'daily-14-journal-page';head.insertAdjacentHTML('beforeend',`<div class="legacy-dialog-art" aria-hidden="true"><img src="/assets/records/${art}.webp" alt="" width="640" height="640" draggable="false"></div>`)}content=template.innerHTML}
  showDialog(root,{html:content,className:customSurface?size:`legacy-dialog ${size}`,title,description,canClose:()=>root.dataset.persistent!=='1'&&!$('.modal[data-review-lock-busy]',root),onClose:()=>closeModal(),returnFocus:modalReturnFocus});
  syncOverlayBackground();
  $$('.modal-close',root).forEach(button=>button.setAttribute('aria-label','关闭弹窗'));
  if(!persistent)$$('[data-close]',root).forEach(button=>button.addEventListener('click',()=>closeModal()));
  setTimeout(()=>$('.modal input:not([type="hidden"]),.modal textarea,.modal button',root)?.focus(),0);
}

function closeModal(force=false){const root=$('#modal-root');if(!force&&(root.dataset.persistent==='1'||$('.modal[data-review-lock-busy]',root)))return;dismissDialog(root);root.dataset.persistent='0';syncOverlayBackground();if(modalReturnFocus?.isConnected)modalReturnFocus.focus({preventScroll:true});modalReturnFocus=null}

function attemptNavigate(next){if(state.saving){toast('正在保存，请稍后再切换页面。','info');return}if(!state.dirty){next();return}openModal(`<div class="modal-head"><div><h2>这页还有未保存内容</h2><p>可以继续填写，或放弃刚才的修改。</p></div></div><div class="modal-actions"><button class="btn btn-primary" data-close>继续填写</button><button class="btn btn-danger" id="discard-change">放弃修改</button></div>`);$('#discard-change').addEventListener('click',()=>{state.dirty=false;closeModal();next()})}

function bindCalendar(){
 const card=$('#stage-calendar');if(!card)return;
 showStageCalendar(card,{month:state.calendarMonth||today().slice(0,7),today:today(),records:state.records.filter(record=>record.type==='daily'),statusLabels:STATUS,onMonthChange:value=>{state.calendarMonth=value},onSelect:(date,record)=>{attemptNavigate(()=>record?enterReview(record.type,record.period,false,record):enterReview('daily',date))}});
}

let headerMenuControls=[];
function closeHeaderMenus(restoreFocus=false){headerMenuControls.forEach(control=>control.close?.(restoreFocus))}
function bindHeaderMenus(){
  headerMenuControls=[];
  const action=button=>()=>{if(button.dataset.nav)attemptNavigate(()=>navigate(button.dataset.nav));else openSettings()};
  const descriptors=panel=>$$('button',panel).map(button=>({html:button.innerHTML,className:button.className,current:button.hasAttribute('aria-current'),onSelect:action(button)}));
  const account=$('.header-account-menu'),trigger=$('[data-menu-trigger]',account),panel=$('#account-menu');
  if(account&&trigger&&panel){const options={trigger:{html:trigger.innerHTML,className:trigger.className,props:{type:'button','aria-label':trigger.getAttribute('aria-label')}},items:descriptors(panel),label:'我的空间'};disposeUi(account);account.replaceChildren();account.removeAttribute('data-ui-native');headerMenuControls.push(showMenu(account,options))}
  const mobile=$('#menu-toggle'),nav=$('#mobile-nav');if(mobile&&nav){const host=document.createElement('span');host.className='sd-mobile-menu-host';const options={trigger:{html:mobile.innerHTML,className:mobile.className,props:{type:'button',id:'menu-toggle','aria-label':'打开顶部菜单'}},items:descriptors(nav),className:'sd-menu-mobile',label:'慎独'};mobile.replaceWith(host);nav.remove();headerMenuControls.push(showMenu(host,options))}
}


function bindCommon(){
 bindHeaderMenus();
 $$('[data-nav]',$('#app')).forEach(button=>button.addEventListener('click',()=>{closeHeaderMenus();attemptNavigate(()=>navigate(button.dataset.nav))}));
 bindActionButtons();
}

function navigate(route){
 if(TYPES[route])return enterReview(route,defaultPeriod(route),route==='decision');
 reviewNavigation.clear();state.route=route;state.navOpen=false;
 document.title=`${({overview:'概览',history:'历史复盘',actions:currentActionTemplate().pageTitle,backup:'数据备份',users:'账户管理',settings:'设置',calendar:'阶段与日历','stage-settings':'阶段与内容设置',guide:'使用指南'}[route]||'慎独')} · 慎独`;
 const render={overview:renderOverview,history:renderHistory,actions:renderActions,backup:renderBackup,users:renderUsers,settings:renderSettings,calendar:renderCalendar,'stage-settings':renderStageSettings,guide:renderGuide}[route];
 if(render){const result=render();if(['settings','calendar','stage-settings','guide'].includes(route)){const heading=$('main h1');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true})}window.scrollTo({top:0,behavior:'instant'})}return result}
 renderReview('daily');
}

async function refreshStats(){state.stats=await request('/api/stats')}
async function refreshData(isCurrent=()=>true){const account=state.user;const [me,rec,stats]=await Promise.all([request('/api/me'),request('/api/records'),request('/api/stats')]);if(state.user!==account||!isCurrent())return false;state.user=me.user;state.stage=me.stage;state.theme=me.theme;state.records=rec.records;state.stats=stats;applyTheme(state.theme);return true}
async function boot(user){cancelDailyTypewriter();setDailyImmersive(false);state.user=user;renderMarkup($('#app'),`<main class="connection-screen"><section class="connection-card" role="status"><div class="connection-brand"><span class="seal header-seal" aria-hidden="true">慎</span><span class="brand-cn header-wordmark">慎獨</span></div><div class="connection-art" aria-hidden="true"><img src="/assets/records/daily-01-morning-window.webp" alt="" width="640" height="640" draggable="false"></div><span class="legacy-kicker">稍候片刻</span><h1>正在翻开你的记录</h1><p>正在读取复盘与阶段资料。</p><div class="connection-loading" aria-hidden="true"><span></span><span></span><span></span></div></section></main>`);try{await refreshData();navigate('overview')}catch(e){if(e.status===401)return init();renderMarkup($('#app'),`<main class="connection-screen"><section class="connection-card"><div class="connection-brand"><span class="seal header-seal" aria-hidden="true">慎</span><span class="brand-cn header-wordmark">慎獨</span></div><div class="connection-art" aria-hidden="true"><img src="/assets/records/daily-28-night-lamp.webp" alt="" width="640" height="640" draggable="false"></div><span class="legacy-kicker">记录暂未连接</span><h1>暂时无法打开复盘室</h1><p>${esc(e.message)}</p><button class="btn btn-primary" id="retry">重试</button></section></main>`);$('#retry').addEventListener('click',()=>boot(user))}}
async function init(){cancelDailyTypewriter();setDailyImmersive(false);try{const info=await request('/api/auth/state');if(info.user)await boot(info.user);else renderAuth(info)}catch(e){renderMarkup($('#app'),`<main class="connection-screen"><section class="connection-card"><div class="connection-brand"><span class="seal header-seal" aria-hidden="true">慎</span><span class="brand-cn header-wordmark">慎獨</span></div><div class="connection-art" aria-hidden="true"><img src="/assets/records/daily-01-morning-window.webp" alt="" width="640" height="640" draggable="false"></div><span class="legacy-kicker">连接暂时中断</span><h1>服务器连接失败</h1><p>请确认服务已经启动，然后再试一次。</p><button class="btn btn-primary" id="reconnect">重新连接</button></section></main>`);$('#reconnect').addEventListener('click',()=>location.reload())}}

window.addEventListener('beforeunload',e=>{if(state.dirty){e.preventDefault();e.returnValue=''}});
function saveShortcut(event){if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'&&TYPES[state.route]&&state.current?.status==='draft'&&state.current.period===defaultPeriod(state.current.type)){event.preventDefault();saveCurrent().catch(()=>{})}}
document.addEventListener('keydown',saveShortcut);
initializeToasts($('#toast-root'));
init();
