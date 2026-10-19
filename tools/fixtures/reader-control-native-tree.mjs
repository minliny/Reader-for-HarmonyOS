// Finite native-call recorder for actual SDK Builder closures. This records
// authored parentage/attributes only; it performs no layout, paint or hit test.
export function readerControlNativeTree(types=['Stack','Row','Column','Text']) {
  const stack=[],parents=new Map();let active,owner,order=0;
  const hooks={onObserverEnter(value,id){owner=value;active=id;},onObserverExit(){owner=undefined;active=undefined;}};
  const dependencies=Object.fromEntries(types.map(type=>{
    const native=new Proxy({name:type},{get(_target,property){
      if(property==='name')return type;
      if(property==='pop')return()=>{const top=stack.pop();if(top?.type!==type)throw Error('SDK native create/pop type mismatch');};
      if(property==='canRetake')return()=>false;
      return(...args)=>{
        if(owner===undefined)throw Error('native attribute outside SDK observer');
        const node=owner.nodes.get(active);
        if(property==='create'&&!parents.has(active)){
          node.type=type;node.parentId=stack.at(-1)?.id;node.creationOrder=order++;
          parents.set(active,node.parentId);stack.push({id:active,type});
        }
        node[property]=args.length===1?args[0]:args;
        owner.attributeCalls.push({id:active,property,args});return native;
      };
    }});return[type,native];
  }));
  return{hooks,dependencies,parents,remaining:()=>stack.length};
}
