import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {createReviewNavigator} from '../public/review-navigation.js';

function harness(){
  const state={route:'history',scrollY:860,dirty:false,saving:false,record:null,filter:{q:'散步',type:'daily',year:'2026',month:'11'}},returns=[];
  let pending;
  const navigation=createReviewNavigator({
    source:()=>state,
    guard:next=>{if(state.saving)return;if(state.dirty){pending=next;return}next()},
    open:review=>{state.record=review.record;state.route=review.type;state.scrollY=0},
    restore:context=>{returns.push(context);state.route=context.route;state.scrollY=context.scrollY}
  });
  return {state,returns,navigation,discard(){state.dirty=false;const next=pending;pending=null;next?.()}};
}

test('all six review types return to their history or action origin and reading position',()=>{
  for(const route of ['history','actions'])for(const type of ['daily','weekly','monthly','quarterly','yearly','decision']){
    const {state,returns,navigation}=harness();state.route=route;
    const filter={...state.filter};
    navigation.enter({type,record:{id:`${type}-saved`,type}});
    assert.equal(state.route,type);
    navigation.exit();
    assert.deepEqual(returns,[{route,scrollY:860,recordId:`${type}-saved`}]);
    assert.deepEqual(state.filter,filter);
  }
});

test('a cancelled dirty exit retains its origin and input; a later discard returns there',()=>{
  const {state,returns,navigation,discard}=harness();
  navigation.enter({type:'daily',record:{id:'draft',data:{action:'原计划'}}});
  state.record.data.action='尚未保存的计划';state.dirty=true;
  navigation.exit();
  assert.equal(state.route,'daily');assert.equal(returns.length,0);
  assert.equal(state.record.data.action,'尚未保存的计划');
  navigation.exit();discard();
  assert.deepEqual(returns,[{route:'history',scrollY:860,recordId:'draft'}]);
});

test('saving blocks departure, and record replacement after save does not replace the origin',()=>{
  const {state,returns,navigation}=harness();
  navigation.enter({type:'monthly',record:{id:'before-save'}});
  state.saving=true;navigation.exit();assert.equal(returns.length,0);
  state.record={id:'after-save'};state.saving=false;
  navigation.exit();assert.deepEqual(returns,[{route:'history',scrollY:860,recordId:'before-save'}]);
});

test('new overview or calendar entries replace the prior visit instead of inheriting history',()=>{
  const {state,returns,navigation}=harness();
  navigation.enter({type:'daily',record:{id:'historical'}});navigation.exit();
  state.route='overview';state.scrollY=100;
  navigation.enter({type:'weekly',record:null});navigation.exit();
  assert.deepEqual(returns.at(-1),{route:'overview',scrollY:100,recordId:null});
  // A calendar can be opened while a review is active; that is a fresh visit.
  state.route='daily';state.scrollY=900;
  navigation.enter({type:'daily',record:{id:'calendar-record'}});navigation.exit();
  assert.deepEqual(returns.at(-1),{route:'overview',scrollY:0,recordId:null});
});

test('clearing on ordinary navigation and invalid sources cannot restore a stale destination',()=>{
  const {state,returns,navigation}=harness();
  navigation.enter({type:'yearly',record:{id:'old'}});navigation.clear();navigation.exit();
  assert.equal(returns.at(-1).route,'overview');
  state.route='https://outside.example';state.scrollY=NaN;
  navigation.enter({type:'decision',record:{id:'new'}});navigation.exit();
  assert.deepEqual(returns.at(-1),{route:'overview',scrollY:0,recordId:null});
});

test('full sign-out clears the previous account search and review origin',async()=>{
  const {state,returns,navigation}=harness();
  state.historyFilter={q:'上一账户的私人搜索',type:'daily',year:'2026',month:'11'};
  state.user={username:'previous_account'};
  navigation.enter({type:'daily',record:{id:'previous-record'}});
  const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  const start=source.indexOf('function renderAuth('),end=source.indexOf('\nfunction ',start+1);
  assert.ok(start>=0&&end>start,'locate actual logged-out renderer');
  const node={innerHTML:'',addEventListener(){}};
  runInNewContext(source.slice(start,end)+'\nrenderAuth();',{
    state,reviewNavigation:navigation,$:()=>node,renderMarkup:(target,html)=>{target.innerHTML=html},
    cancelDailyTypewriter(){},setDailyImmersive(){},dismissDialog(){},closeModal(){}
  });
  assert.equal(state.user,null);
  assert.deepEqual({...state.historyFilter},{q:'',type:'all',year:'all',month:'all'});
  navigation.exit();
  assert.deepEqual(returns,[{route:'overview',scrollY:0,recordId:null}]);
});
