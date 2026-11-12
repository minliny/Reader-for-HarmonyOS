// Finite native-call recorder for actual SDK Builder closures. This records
// authored parentage/attributes only; it performs no layout, paint or hit test.
export function readerControlNativeTree(types=['Stack','Row','Column','Text'], {crossComponent=false}={}) {
  const stack=[],parents=new Map(),ownerIds=new WeakMap();let active,owner,order=0,nextOwnerId=0;
  const keyFor=(value,id)=>{
    if(!crossComponent)return id;
    if(!ownerIds.has(value))ownerIds.set(value,++nextOwnerId);
    return `${ownerIds.get(value)}:${id}`;
  };
  const hooks={onObserverEnter(value,id){owner=value;active=id;},onObserverExit(){owner=undefined;active=undefined;}};
  const dependencies=Object.fromEntries(types.map(type=>{
    const native=new Proxy({name:type},{get(_target,property){
      if(property==='name')return type;
      if(property==='pop')return()=>{const top=stack.pop();if(top?.type!==type)throw Error('SDK native create/pop type mismatch');};
      if(property==='canRetake')return()=>false;
      return(...args)=>{
        if(owner===undefined)throw Error('native attribute outside SDK observer');
        const node=owner.nodes.get(active);
        const key=keyFor(owner,active);
        if((property==='create'||property.startsWith('createWith'))&&!parents.has(key)){
          node.type=type;node.parentId=stack.at(-1)?.id;node.creationOrder=order++;
          if(crossComponent)node.nativeKey=key;
          parents.set(key,node.parentId);stack.push({id:key,type});
        }
        node[property]=args.length===1?args[0]:args;
        owner.attributeCalls.push({id:active,property,args});return native;
      };
    }});return[type,native];
  }));
  return{hooks,dependencies,parents,remaining:()=>stack.length};
}
