// Reader row-identity guard. Hover after a released press is not scrolling.
export function createSourceFlowPointerGuard({now=()=>Date.now()}={}) {
  let press=null,heldKey=null,blockedUntil=0;
  return {
    down({key=null,x,y}){heldKey=key;press={x,y};},
    move({x,y}){if(press&&Math.hypot(x-press.x,y-press.y)>8){heldKey=null;blockedUntil=now()+240;}},
    release(){press=null;},
    cancel(){press=null;heldKey=null;blockedUntil=now()+240;},
    scroll(){blockedUntil=now()+180;},
    take(key){const allowed=now()>=blockedUntil&&(heldKey===null||heldKey===key);heldKey=null;return allowed;},
    reset(){press=null;heldKey=null;blockedUntil=0;}
  };
}
