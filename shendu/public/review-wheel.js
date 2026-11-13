// A wheel burst may move one question only. Momentum must settle before rearming.
export function createWheelGesture({threshold=90,cooldown=650,idle=220}={}){
  let lastEvent=-Infinity,lastStep=-Infinity,spent=false,total=0,direction=0;
  return (delta,time,mode='step')=>{
    if(time-lastEvent>=idle){spent=false;total=0;direction=0}
    lastEvent=time;
    if(mode!=='step'){spent=true;total=0;return 0}
    if(spent)return 0;
    if(time-lastStep<cooldown){spent=true;total=0;return 0}
    const next=Math.sign(delta);
    if(!next)return 0;
    if(next!==direction){total=0;direction=next}
    total+=Math.abs(delta);
    if(total<threshold)return 0;
    spent=true;lastStep=time;return direction;
  };
}

function canScroll(node,direction){
  const maximum=node.scrollHeight-node.clientHeight;
  return maximum>1&&(direction>0?node.scrollTop<maximum-1:node.scrollTop>1);
}

function contentCanScroll(target,root,direction){
  const document=root.ownerDocument,view=document.defaultView;
  for(let node=target;node&&node!==document.body&&node!==document.documentElement;node=node.parentElement){
    if((node.tagName==='TEXTAREA'||/^(auto|scroll|overlay)$/.test(view.getComputedStyle(node).overflowY))&&canScroll(node,direction))return true;
  }
  const scroller=document.scrollingElement||document.documentElement;
  const height=Math.max(scroller.scrollHeight,document.body?.scrollHeight||0);
  const viewport=scroller.clientHeight||view.innerHeight;
  const top=view.scrollY||scroller.scrollTop||document.body?.scrollTop||0;
  return height>viewport+1&&(direction>0?top<height-viewport-1:top>1);
}

export function attachReviewWheel(root,{enabled=()=>true,active=()=>true,canStep=()=>true,step,now=()=>root.ownerDocument.defaultView.performance.now(),...timing}){
  const gesture=createWheelGesture(timing);
  let composing=false;
  const onCompositionStart=()=>{composing=true},onCompositionEnd=()=>{composing=false};
  const onWheel=event=>{
    const time=now(),target=event.target?.nodeType===1?event.target:event.target?.parentElement;
    const delta=Number(event.deltaY)||0,direction=Math.sign(delta);
    if(!root.isConnected||!enabled()||!active()||composing||event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||!direction||Math.abs(event.deltaX)>=Math.abs(delta)||target?.closest('input[type="number"],input[type="range"],select,[role="slider"],[role="spinbutton"],[role="combobox"]')){
      gesture(0,time,'ignore');return;
    }
    if(contentCanScroll(target,root,direction)){gesture(0,time,'native');return}
    if(!canStep(direction)){gesture(0,time,'boundary');return}
    // Capture the whole eligible burst, including its sub-threshold and inertial tail.
    if(!event.cancelable){gesture(0,time,'ignore');return}
    event.preventDefault();
    const unit=event.deltaMode===1?16:event.deltaMode===2?root.ownerDocument.defaultView.innerHeight:1;
    const move=gesture(delta*unit,time);
    if(move)step(move);
  };
  root.addEventListener('wheel',onWheel,{passive:false});
  root.addEventListener('compositionstart',onCompositionStart);
  root.addEventListener('compositionend',onCompositionEnd);
  return ()=>{
    root.removeEventListener('wheel',onWheel);
    root.removeEventListener('compositionstart',onCompositionStart);
    root.removeEventListener('compositionend',onCompositionEnd);
  };
}
