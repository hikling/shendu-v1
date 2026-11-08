// Metric identity belongs to the stage, while action/status belong to a record.
// Legacy stages use their original index until saved with an explicit identity.
const metricId = value => typeof value === 'string' && /^(?:metric_[a-f0-9]{32}|legacy_(?:0|[1-9]\d{0,5}))$/.test(value);
const metricObjects = value => Array.isArray(value) ? value.filter(metric => metric && typeof metric === 'object' && !Array.isArray(metric)) : [];

export function normalizeReviewMetricIds(metrics) {
  const values = metricObjects(metrics), first = new Map();
  values.forEach((metric,index) => {if(metricId(metric.id) && !first.has(metric.id)) first.set(metric.id,index)});
  const reserved = new Set(first.keys());
  return values.map((metric,index) => {
    let id = metric.id;
    if(!metricId(id) || first.get(id) !== index){
      let fallback = index;
      while(reserved.has(`legacy_${fallback}`)) fallback++;
      id = `legacy_${fallback}`;reserved.add(id);
    }
    return {...metric,id};
  });
}

export function reconcileReviewMetrics(currentMetrics,stageMetrics,archivedMetrics = []) {
  const stages = normalizeReviewMetricIds(stageMetrics);
  const pool = [
    ...metricObjects(currentMetrics).map((metric,index) => ({metric,index,current:true,used:false})),
    ...metricObjects(archivedMetrics).map((metric,index) => ({metric,index,current:false,used:false}))
  ];
  const matches = new Map();
  const match = predicate => stages.forEach(stage => {
    if(matches.has(stage.id)) return;
    const found = pool.find(entry => !entry.used && predicate(entry,stage));
    if(found){found.used = true;matches.set(stage.id,found.metric)}
  });
  // Reserve every exact identity before considering ID-less legacy entries.
  // Current content wins over an older archive copy of the same metric.
  match((entry,stage) => metricId(entry.metric.id) && entry.metric.id === stage.id);
  // Reserve all name matches before index rename fallback so an earlier
  // renamed row cannot take the answer of a later reordered legacy row.
  match((entry,stage) => !metricId(entry.metric.id) && entry.metric.name === stage.name && entry.metric.target === stage.target);
  match((entry,stage) => /^legacy_\d+$/.test(stage.id) && entry.current && entry.index === Number(stage.id.slice(7)) && !metricId(entry.metric.id));
  const metrics = stages.map(stage => {
    const found = matches.get(stage.id);
    return {...(found||{}),...stage,action:found?.action??'',status:found?.status??''};
  });
  const reserved = new Set([...stages.map(metric => metric.id),...pool.filter(entry => metricId(entry.metric.id)).map(entry => entry.metric.id)]);
  const archived = pool.filter(entry => !entry.used).map(entry => {
    const metric = {...entry.metric};
    if(!metricId(metric.id)){
      let fallback = entry.index;
      while(reserved.has(`legacy_${fallback}`)) fallback++;
      metric.id = `legacy_${fallback}`;reserved.add(metric.id);
    }
    return metric;
  });
  return {metrics,archivedMetrics:archived};
}
