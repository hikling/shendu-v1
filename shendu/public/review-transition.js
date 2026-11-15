// One visual turn owns the mounted copy and artwork; form nodes never move.
export function createReviewTransition(root){
  let active=null;
  const view=root.ownerDocument.defaultView;
  const targets=()=>[root.querySelector('#daily-editor')?.hidden?root.querySelector('.daily-intro-copy'):root.querySelector('.daily-editor-content'),root.querySelector('.daily-scene-art')].filter(Boolean);
  const restore=turn=>{
    for(const animation of turn.animations)animation.cancel();
    turn.animations=[];
    if(turn.locked){
      const {node,inert}=turn.locked;
      if(inert===null)node.removeAttribute('inert');else node.setAttribute('inert',inert);
      turn.locked=null;
    }
  };
  const finish=turn=>{restore(turn);if(active===turn){active=null;delete root.dataset.reviewTransition}};
  const cancel=()=>{if(active&&!active.committing){const turn=active;active=null;finish(turn);delete root.dataset.reviewTransition}};
  const reduced=preference=>preference()||view.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
  const animate=(turn,nodes,frames,options)=>{
    const finished=[];
    try{for(const node of nodes){
      const animation=node.animate(frames,{...options,fill:'both'});
      // Attach rejection handling before another target can throw or be cancelled.
      finished.push(animation.finished.then(()=>true,()=>false));
      turn.animations.push(animation);
    }}
    catch{restore(turn);return null}
    return Promise.all(finished).then(results=>results.every(Boolean));
  };
  return {
    get busy(){return active!==null},
    cancel,
    run(update,{direction=1,current=()=>true,reduceMotion=()=>false}={}){
      if(active||!root.isConnected||!current())return;
      root.dataset.reviewTransitionReady='true';
      const nodes=targets();
      if(reduced(reduceMotion)||!nodes.length||nodes.some(node=>typeof node.animate!=='function')){update();return}
      const turn={animations:[],locked:null,committing:false};active=turn;
      root.dataset.reviewTransition='out';
      const copy=nodes[0];turn.locked={node:copy,inert:copy.getAttribute('inert')};copy.setAttribute('inert','');
      const outward=animate(turn,nodes,[{opacity:1,translate:'0 0'},{opacity:0,translate:`0 ${-8*Math.sign(direction||1)}px`}],{duration:100,easing:'ease-in'});
      const reveal=(completed=true)=>{
        if(active!==turn)return;
        if(!completed||!root.isConnected||!current()){finish(turn);return}
        restore(turn);
        turn.committing=true;
        try{update()}catch(error){finish(turn);throw error}finally{turn.committing=false}
        if(active!==turn||!root.isConnected||!current()){finish(turn);return}
        if(reduced(reduceMotion)){finish(turn);return}
        root.dataset.reviewTransition='in';
        const inward=animate(turn,targets(),[{opacity:0,translate:`0 ${16*Math.sign(direction||1)}px`},{opacity:1,translate:'0 0'}],{duration:220,easing:'cubic-bezier(.2,.7,.2,1)'});
        if(!inward){finish(turn);return}
        return inward.then(()=>finish(turn));
      };
      if(!outward)return reveal();
      return outward.then(reveal);
    }
  };
}
