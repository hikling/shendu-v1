import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createBrowserNavigator,parseBrowserRoute,browserRoutePath} from '../public/browser-navigation.js';

function fixture(path='/overview'){
  const listeners=new Map(),tasks=[],entries=[{path:'/outside',state:null},{path,state:null}],renders=[],prompts=[];
  let cursor=1,dirty=false,saving=false;
  const win={location:new URL('https://example.test'+path),scrollY:0,crypto:{randomUUID},requestAnimationFrame:fn=>tasks.push(fn),scrollTo:({top})=>{win.scrollY=top},addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
  const update=()=>{win.location=new URL('https://example.test'+entries[cursor].path)};
  win.history={get state(){return entries[cursor].state},replaceState(state,unused,path){entries[cursor]={state:structuredClone(state),path};update()},pushState(state,unused,path){entries.splice(cursor+1);entries.push({state:structuredClone(state),path});cursor++;update()},go(delta){tasks.push(()=>{const next=cursor+delta;if(next<0||next>=entries.length||next===cursor)return;cursor=next;update();listeners.get('popstate')?.({state:this.state})})}};
  const options={window:win,guard:(yes,no)=>{if(saving){no();return}if(dirty){prompts.push({yes:()=>{dirty=false;yes()},no});return}yes()},restore:target=>{renders.push(target);return target}};
  let controller=createBrowserNavigator(options);
  const flush=()=>{let count=0;while(tasks.length){assert.ok(count++<100,'history recovery must settle');tasks.shift()()}};
  controller.start();flush();
  return {win,entries,renders,prompts,flush,get controller(){return controller},setDirty:value=>dirty=value,setSaving:value=>saving=value,scroll(top){win.scrollY=top;listeners.get('scroll')?.()},reload(){controller.dispose();controller=createBrowserNavigator(options);controller.start();flush()}};
}

test('page and review addresses whitelist navigation identity and validate civil periods',()=>{
  for(const route of ['overview','history','actions','finance','finance-annual','settings','backup','users','calendar','stage-settings','guide','activity'])assert.deepEqual(parseBrowserRoute('/'+route+'?private=omitted'),{route});
  const id=randomUUID();assert.deepEqual(parseBrowserRoute('/review/'+id),{route:'review',id});
  for(const [type,period] of [['daily','2028-02-29'],['quarterly','2026-11-16'],['decision','2026-11-16'],['monthly','2026-11'],['weekly','2026-W53'],['yearly','0001']]){
    const target={route:'review',type,period};assert.deepEqual(parseBrowserRoute(browserRoutePath(target)),target);
  }
  for(const path of ['/api/me','/unknown','/review/not-a-uuid','/review/new/daily?period=2026-02-29','/review/new/weekly?period=2025-W53','/review/new/monthly?period=0000-01','/review/new/__proto__?period=2026'])assert.deepEqual(parseBrowserRoute(path),{route:'overview'},path);
  assert.equal(browserRoutePath({route:'finance',amount:1234,search:'private'}),'/finance');
});

test('normal back/forward keeps distinct page entries and restores scroll without storing content',()=>{
  const f=fixture();f.scroll(240);f.controller.commit({route:'history'});f.scroll(850);f.controller.commit({route:'finance'});f.controller.commit({route:'finance'});
  assert.equal(f.entries.length,4);assert.equal(f.win.location.pathname,'/finance');
  f.win.history.go(-1);f.flush();assert.deepEqual(f.renders.at(-1),{route:'history'});assert.equal(f.win.scrollY,850);
  f.win.history.go(1);f.flush();assert.equal(f.renders.at(-1).route,'finance');
  assert.ok(f.entries.slice(1).every(item=>Object.keys(item.state.shendu).sort().join(',')==='index,scrollY,session,version'));
});

test('scroll bursts coalesce history writes and a pending scroll cannot rewrite a later page',()=>{
  const f=fixture();let replacements=0;const replace=f.win.history.replaceState.bind(f.win.history);f.win.history.replaceState=(...args)=>{replacements++;replace(...args)};
  for(let index=1;index<=100;index++)f.scroll(index);
  assert.equal(replacements,0);f.flush();assert.equal(replacements,1);assert.equal(f.win.history.state.shendu.scrollY,100);
  f.scroll(550);f.controller.commit({route:'finance'});const afterNavigation=replacements;f.flush();assert.equal(replacements,afterNavigation);assert.equal(f.win.location.pathname,'/finance');
  f.win.history.go(-1);f.flush();assert.equal(f.win.scrollY,550);
});

test('rejecting a dirty back preserves the mounted page and forward stack; accepting replays once',()=>{
  const f=fixture();f.controller.commit({route:'history'});f.controller.commit({route:'finance'});f.setDirty(true);
  f.win.history.go(-1);f.flush();assert.equal(f.win.location.pathname,'/finance');assert.equal(f.prompts.length,1);assert.equal(f.renders.length,1);
  f.prompts[0].no();assert.equal(f.entries.length,4);assert.equal(f.win.location.pathname,'/finance');
  f.win.history.go(-1);f.flush();f.prompts[1].yes();f.flush();assert.equal(f.win.location.pathname,'/history');assert.equal(f.renders.length,2);
  f.win.history.go(1);f.flush();assert.equal(f.win.location.pathname,'/finance');assert.equal(f.renders.length,3);
});

test('saving and rapid back operations cannot discard a current editor or stack confirmations',()=>{
  const f=fixture();f.controller.commit({route:'history'});f.controller.commit({route:'finance'});f.setSaving(true);f.win.history.go(-1);f.flush();assert.equal(f.win.location.pathname,'/finance');assert.equal(f.renders.length,1);
  f.setSaving(false);f.setDirty(true);f.win.history.go(-1);f.win.history.go(-1);f.flush();assert.equal(f.win.location.pathname,'/finance');assert.equal(f.prompts.length,1);
  f.win.history.go(-1);f.flush();assert.equal(f.prompts.length,1);f.prompts[0].yes();f.flush();assert.equal(f.win.location.pathname,'/history');assert.equal(f.renders.length,2);
});

test('reload retains history indexes and first save replaces the review address without another render',()=>{
  const f=fixture('/finance');f.controller.commit({route:'review',type:'daily',period:'2026-11-16'});const id=randomUUID(),count=f.renders.length;
  f.controller.commit({route:'review',id},{replace:true});assert.equal(f.entries.length,3);assert.equal(f.renders.length,count);assert.equal(f.win.location.pathname,'/review/'+id);
  f.reload();assert.deepEqual(f.renders.at(-1),{route:'review',id});f.win.history.go(-1);f.flush();assert.equal(f.win.location.pathname,'/finance');f.win.history.go(1);f.flush();assert.equal(f.win.location.pathname,'/review/'+id);
});

test('authentication reset invalidates outstanding confirmation and resolves prior IDs through the new account',()=>{
  const f=fixture();f.controller.commit({route:'history'});f.controller.commit({route:'review',id:randomUUID()});f.setDirty(true);f.win.history.go(-1);f.flush();assert.equal(f.prompts.length,1);
  f.controller.suspend();f.prompts[0].yes();f.flush();assert.equal(f.renders.length,1);
  f.controller.reset();assert.equal(f.win.location.pathname,'/overview');f.controller.start();f.flush();f.win.history.go(-1);f.flush();assert.equal(f.renders.at(-1).route,'history');
});

test('the browser owns leaving the initial app entry and disposal removes all event handlers',()=>{
  const f=fixture('/finance');f.win.history.go(-1);f.flush();assert.equal(f.win.location.pathname,'/outside');assert.equal(f.renders.length,1);f.controller.dispose();
});

const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
function appOwner(name){const start=app.indexOf(`function ${name}(`),end=/\n(?:async )?function |\nconst browserNavigation=/.exec(app.slice(start+1));assert.ok(start>=0&&end);return app.slice(app.slice(start-6,start)==='async '?start-6:start,start+1+end.index)}

test('direct review restoration resolves only a current-account record ID and missing records return to history',()=>{
  const record={id:randomUUID(),type:'decision',period:'2026-11-16'},state={records:[record],current:null},pages=[],opened=[],messages=[];
  const restore=new Function('state','navigate','enterReview','toast',`${appOwner('restoreBrowserRoute')}\nreturn restoreBrowserRoute;`)(state,page=>pages.push(page),(type,period,forceNew,row)=>{opened.push({type,period,forceNew,row});state.current=row||{type,period}},message=>messages.push(message));
  assert.deepEqual(restore({route:'review',id:record.id}),{route:'review',id:record.id});assert.equal(opened[0].row,record);assert.equal(opened[0].forceNew,false);
  assert.deepEqual(restore({route:'review',id:randomUUID()}),{route:'history'});assert.deepEqual(pages,['history']);assert.equal(opened.length,1);assert.equal(messages.length,1);
  assert.deepEqual(restore({route:'review',type:'daily',period:'2026-11-16'}),{route:'review',type:'daily',period:'2026-11-16'});assert.equal(opened.at(-1).row,null);
});

test('login restores its deep link only after the owned account refresh succeeds',async()=>{
  const state={},refreshes=[],starts=[],shell={};
  const boot=new Function('state','browserNavigation','cancelDailyTypewriter','setDailyImmersive','renderMarkup','$','refreshData','esc','init',`${appOwner('boot')}\nreturn boot;`)(state,{suspend(){},start:()=>starts.push(state.user.id)},()=>{},()=>{},()=>{},()=>shell,current=>new Promise(resolve=>refreshes.push({current,resolve})),String,()=>{});
  const first=boot({id:'old-account'}),second=boot({id:'new-account'});
  assert.equal(refreshes[0].current(),false);refreshes[0].resolve(false);await first;assert.deepEqual(starts,[]);
  assert.equal(refreshes[1].current(),true);state.user={id:'new-account',displayName:'accepted refresh'};refreshes[1].resolve(true);await second;
  assert.deepEqual(starts,['new-account']);assert.equal(state.dirty,false);
});
