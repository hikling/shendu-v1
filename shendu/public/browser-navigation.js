const PAGES=new Set(['overview','history','actions','finance','backup','users','settings','calendar','stage-settings','guide','activity']);
const REVIEWS=new Set(['daily','weekly','monthly','quarterly','yearly','decision']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const overview=()=>({route:'overview'});

function validPeriod(type,value){
  if(typeof value!=='string')return false;
  const year=Number(value.slice(0,4));if(year<1||year>9999)return false;
  if(type==='yearly')return /^\d{4}$/.test(value);
  if(type==='monthly')return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
  if(type==='weekly'){
    if(!/^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(value))return false;
    const last=new Date(0);last.setUTCFullYear(year,11,28);last.setUTCHours(0,0,0,0);
    const first=new Date(0);first.setUTCFullYear(year,0,1);first.setUTCHours(0,0,0,0);
    const days=Math.floor((last-first)/86400000)+1,weekday=last.getUTCDay()||7;
    return Number(value.slice(-2))<=Math.floor((days-weekday+10)/7);
  }
  if(!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value))return false;
  const date=new Date(0);date.setUTCFullYear(year,Number(value.slice(5,7))-1,Number(value.slice(8)));date.setUTCHours(0,0,0,0);
  return date.getUTCFullYear()===year&&date.getUTCMonth()+1===Number(value.slice(5,7))&&date.getUTCDate()===Number(value.slice(8));
}

// The URL holds only navigation identity. Never put form values or account data
// in either the URL or history.state.
export function parseBrowserRoute(value){
  let url;try{url=new URL(typeof value==='string'?value:value.href,'http://localhost')}catch{return overview()}
  const path=url.pathname.replace(/\/$/,'')||'/';
  if(path==='/')return overview();
  const page=path.slice(1);if(PAGES.has(page))return {route:page};
  const saved=/^\/review\/([^/]+)$/.exec(path);if(saved&&UUID.test(saved[1]))return {route:'review',id:saved[1].toLowerCase()};
  const fresh=/^\/review\/new\/([^/]+)$/.exec(path),period=url.searchParams.get('period');
  if(fresh&&REVIEWS.has(fresh[1])&&validPeriod(fresh[1],period))return {route:'review',type:fresh[1],period};
  return overview();
}

export function browserRoutePath(target){
  if(target?.route==='review'){
    if(UUID.test(target.id||''))return `/review/${target.id.toLowerCase()}`;
    if(REVIEWS.has(target.type)&&validPeriod(target.type,target.period))return `/review/new/${target.type}?period=${encodeURIComponent(target.period)}`;
  }
  return `/${PAGES.has(target?.route)?target.route:'overview'}`;
}

export function createBrowserNavigator({window:win,guard,restore}){
  const history=win.history;
  history.scrollRestoration='manual';
  let enabled=false,active=null,phase=null,generation=0,applying=false,scrollQueued=false;
  const metadata=value=>{
    const own=value?.shendu;
    return own?.version===1&&UUID.test(own.session||'')&&Number.isSafeInteger(own.index)&&own.index>=0&&own.index<1e7?own:null;
  };
  const stateFor=entry=>({shendu:{version:1,session:entry.session,index:entry.index,scrollY:Math.max(0,Number(entry.scrollY)||0)}});
  const replace=()=>history.replaceState(stateFor(active),'',browserRoutePath(active.target));
  const remember=()=>{if(active){active.scrollY=Math.max(0,Number(win.scrollY)||0);replace()}};
  const apply=(target,scrollY=0)=>{
    applying=true;
    try{const actual=restore(target);active.target=actual||target;active.scrollY=Math.max(0,Number(scrollY)||0);replace();}
    finally{applying=false}
    const owner=generation,index=active.index;
    win.requestAnimationFrame(()=>{if(enabled&&owner===generation&&active.index===index)win.scrollTo({top:active.scrollY,behavior:'instant'})});
  };
  const cancel=()=>{generation++;phase=null};
  const replay=operation=>{phase={...operation,kind:'replaying'};history.go(operation.destination.index-active.index)};
  const confirm=()=>{
    const operation=phase,owner=generation;phase={...operation,kind:'confirming'};
    guard(()=>{
      if(!enabled||owner!==generation||phase?.kind!=='confirming')return;
      const current=metadata(history.state);
      if(current?.session===active.session&&current.index===active.index)replay(operation);
      else if(current?.session===active.session){phase={...operation,kind:'approved-restoring'};history.go(active.index-current.index)}
      else cancel();
    },()=>{if(owner===generation)cancel()});
  };
  function pop(event){
    if(!enabled||!active)return;
    const entry=metadata(event.state);
    // Outside this app's history, the browser owns navigation. Do not fabricate
    // an entry or a back trap when there is no recoverable app index.
    if(!entry||entry.session!==active.session)return;
    const target=parseBrowserRoute(win.location),destination={...entry,target};
    if(phase?.kind==='replaying'&&entry.index===phase.destination.index){
      generation++;phase=null;active=destination;apply(target,entry.scrollY);return;
    }
    if(entry.index===active.index){if(phase?.kind==='restoring')confirm();else if(phase?.kind==='approved-restoring')replay(phase);return}
    if(!phase||phase.kind==='replaying'){
      generation++;phase={kind:'restoring',destination};
    }
    // popstate cannot be cancelled: first traverse back to the original entry,
    // then ask the existing business guard, and replay only after acceptance.
    history.go(active.index-entry.index);
  }
  const scroll=()=>{
    if(!enabled||!active||phase||metadata(history.state)?.index!==active.index)return;
    active.scrollY=Math.max(0,Number(win.scrollY)||0);
    if(scrollQueued)return;scrollQueued=true;const owner=generation,index=active.index;
    win.requestAnimationFrame(()=>{scrollQueued=false;if(enabled&&owner===generation&&!phase&&active.index===index&&metadata(history.state)?.index===index)replace()});
  };
  win.addEventListener('popstate',pop);
  win.addEventListener('scroll',scroll,{passive:true});
  return {
    start(){
      cancel();const previous=metadata(history.state);
      active={session:previous?.session||win.crypto.randomUUID(),index:previous?.index||0,target:parseBrowserRoute(win.location),scrollY:previous?.scrollY||0};
      enabled=true;replace();apply(active.target,active.scrollY);
    },
    commit(target,{replace:replaceEntry=false}={}){
      if(!enabled||applying)return;
      cancel();remember();const path=browserRoutePath(target);
      if(replaceEntry||path===browserRoutePath(active.target)){active.target=parseBrowserRoute(path);replace();return}
      active={session:active.session,index:active.index+1,target:parseBrowserRoute(path),scrollY:0};history.pushState(stateFor(active),'',path);
    },
    suspend(){enabled=false;cancel()},
    reset(){enabled=false;cancel();const previous=metadata(history.state);active={session:previous?.session||win.crypto.randomUUID(),index:previous?.index||0,target:overview(),scrollY:0};replace()},
    dispose(){enabled=false;cancel();win.removeEventListener('popstate',pop);win.removeEventListener('scroll',scroll)}
  };
}
