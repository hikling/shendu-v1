import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeReviewMetricIds,reconcileReviewMetrics} from '../public/review-metrics.js';

const id = suffix => `metric_${String(suffix).padStart(32,'0')}`;
const metric = (key,name,action='',status='') => ({id:key,name,target:`${name}达标线`,action,status});

test('legacy metrics receive deterministic identities and valid identities survive reorder',()=>{
  const legacy=[{name:'阅读',target:'二十分钟'},{name:'运动',target:'半小时'}];
  assert.deepEqual(normalizeReviewMetricIds(legacy).map(value=>value.id),['legacy_0','legacy_1']);
  const stable=normalizeReviewMetricIds(legacy);
  assert.deepEqual(normalizeReviewMetricIds(stable.toReversed()),stable.toReversed());
  assert.equal(Object.hasOwn(legacy[0],'id'),false,'normalization is pure');
  assert.deepEqual(normalizeReviewMetricIds([]),[]);
});

test('invalid, duplicate and absent identities cannot collide with explicit metric identities',()=>{
  const values=[{name:'缺ID'},{id:'legacy_0',name:'显式'},{id:'legacy_0',name:'重复'},{id:'__proto__',name:'非法'},{id:id(1),name:'新增'}];
  const normalized=normalizeReviewMetricIds(values);
  assert.equal(normalized[1].id,'legacy_0');assert.equal(normalized[4].id,id(1));
  assert.equal(new Set(normalized.map(value=>value.id)).size,values.length);
  assert.deepEqual(normalizeReviewMetricIds(normalized),normalized);
});

test('stable IDs carry draft answers through rename, reorder and insertion',()=>{
  const current=[metric(id(1),'阅读','看完第二章','已达标'),metric(id(2),'运动','慢跑','部分达标')];
  const stage=[{id:id(2),name:'身体恢复',target:'散步'},{id:id(3),name:'写作',target:'一页'},{id:id(1),name:'阅读',target:'四十分钟'}];
  const before=structuredClone({current,stage});
  const result=reconcileReviewMetrics(current,stage);
  assert.deepEqual(result.metrics.map(value=>[value.id,value.name,value.target,value.action,value.status]),[[id(2),'身体恢复','散步','慢跑','部分达标'],[id(3),'写作','一页','',''],[id(1),'阅读','四十分钟','看完第二章','已达标']]);
  assert.deepEqual(result.archivedMetrics,[]);assert.deepEqual({current,stage},before);
});

test('removing and restoring a metric preserves its draft answer in the archive',()=>{
  const current=[metric(id(1),'阅读','读了三页','已达标'),metric(id(2),'运动','跑了两公里','部分达标')];
  const removed=reconcileReviewMetrics(current,[current[0]]);
  assert.deepEqual(removed.archivedMetrics,[current[1]]);
  const restored=reconcileReviewMetrics(removed.metrics,[current[1],current[0]],removed.archivedMetrics);
  assert.deepEqual(restored.metrics,[current[1],current[0]]);assert.deepEqual(restored.archivedMetrics,[]);
  assert.deepEqual(reconcileReviewMetrics(current,[]),{metrics:[],archivedMetrics:current});
});

test('legacy records match names before using legacy index for a renamed metric',()=>{
  const current=[{name:'阅读',target:'二十分钟',action:'看书',status:'已达标'},{name:'运动',target:'半小时',action:'慢跑',status:'部分达标'},{name:'写作',target:'一页',action:'写了一段',status:'已达标'}];
  const reordered=reconcileReviewMetrics(current,[{id:'legacy_2',name:'写作',target:'一页'},{id:'legacy_0',name:'阅读',target:'二十分钟'},{id:'legacy_1',name:'身体恢复',target:'散步'}]);
  assert.deepEqual(reordered.metrics.map(value=>value.action),['写了一段','看书','慢跑']);assert.deepEqual(reordered.archivedMetrics,[]);
  const edited=reconcileReviewMetrics(current,[{id:id(8),name:'运动',target:'半小时'}]);
  assert.equal(edited.metrics[0].action,'慢跑');assert.equal(edited.archivedMetrics.length,2);
});

test('a new metric does not steal another metric answer by its position',()=>{
  const current=[{name:'旧指标',target:'旧达标线',action:'不能丢的内容',status:'已达标'}];
  const stage=[{id:id(1),name:'新指标',target:'新达标线'}];
  const result=reconcileReviewMetrics(current,stage);
  assert.equal(result.metrics[0].action,'');assert.equal(result.archivedMetrics[0].action,'不能丢的内容');
  assert.equal(result.archivedMetrics[0].id,'legacy_0');
  const restored=reconcileReviewMetrics(result.metrics,[{id:'legacy_0',name:'重命名的旧指标',target:'更新的达标线'}],result.archivedMetrics);
  assert.equal(restored.metrics[0].action,'不能丢的内容');
});

test('legacy name matches are reserved before any renamed row falls back to its old index',()=>{
  const current=[{name:'阅读',target:'三页',action:'阅读答案'},{name:'运动',target:'半小时',action:'运动答案'}];
  const stage=[{id:'legacy_0',name:'一个新名字',target:'新目标'},{id:'legacy_1',name:'阅读',target:'三页'}];
  const result=reconcileReviewMetrics(current,stage);
  assert.equal(result.metrics[0].action,'');assert.equal(result.metrics[1].action,'阅读答案');
  assert.equal(result.archivedMetrics[0].action,'运动答案');
});

test('an unmatched legacy answer gets archived even after a legacy stage changed position',()=>{
  const current=[{name:'删除的指标',target:'目标',action:'保留我'},{name:'保留的指标',target:'目标',action:'保留我2'}];
  const result=reconcileReviewMetrics(current,[{id:'legacy_0',name:'保留的指标',target:'目标'}]);
  assert.equal(result.metrics[0].action,'保留我2');assert.equal(result.archivedMetrics[0].action,'保留我');
  assert.notEqual(result.archivedMetrics[0].id,result.metrics[0].id);
});

test('current content wins over stale archive copies, and distinct unused content is retained',()=>{
  const current=[metric(id(1),'阅读','新答案')],archive=[metric(id(1),'阅读','旧答案'),metric(id(2),'运动','旧运动')];
  const result=reconcileReviewMetrics(current,[current[0]],archive);
  assert.equal(result.metrics[0].action,'新答案');assert.deepEqual(result.archivedMetrics,archive);
  assert.deepEqual(reconcileReviewMetrics(result.metrics,[current[0]],result.archivedMetrics),result,'reconciliation is stable across repeated renders');
});
