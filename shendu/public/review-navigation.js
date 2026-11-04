const SOURCE_ROUTES = new Set(['overview','history','actions','backup','users']);

// The origin belongs to one review visit, not to the record or its save payload.
export function createReviewNavigator({source,guard,open,restore}){
  let origin=null;
  return {
    enter(review){
      const current=source(),route=SOURCE_ROUTES.has(current.route)?current.route:'overview';
      const context={route,scrollY:route===current.route&&Number.isFinite(current.scrollY)?Math.max(0,current.scrollY):0,recordId:route===current.route?review.record?.id||null:null};
      guard(()=>{origin=context;open(review)});
    },
    exit(){
      guard(()=>{
        const context=origin||{route:'overview',scrollY:0,recordId:null};
        origin=null;
        restore(context);
      });
    },
    clear(){origin=null}
  };
}
