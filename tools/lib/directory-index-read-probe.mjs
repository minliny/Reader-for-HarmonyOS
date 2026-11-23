import {fixture} from './reading-operation-durable-probe.mjs';
import {productionMotionMethods} from './reader-motion-method-probe.mjs';
import {installDirectoryOperationIndex, directoryOperationIndexMembers} from './reader-directory-operations-probe.mjs';
// Whole production atomic intent stores/owners use the existing real temporary
// file adapter. Only the current Runtime and RPC replies belong to each journey.
export async function directoryIndexReadProbe(){
 const f=await fixture(true);
 const methods=['loadDirectoryOperationProjections','getReadingOfflineHost',
  'offlineBinding','applyOwnedDirectoryEntries'];
 return {attach(page,runtime,extra={}){
  f.install(runtime);
  if(runtime.getUIAbilityContext===undefined)runtime.getUIAbilityContext=()=>({filesDir:f.files});
  const deps={ ReaderDirectoryHost:f.Directory,ReadingOfflineHost:f.Offline,...f.types,ReaderRuntimeOwner:f.Runtime,
   DOMAIN:0,hilog:{warn(){},error(){}},...extra };
  const Methods=productionMotionMethods(new URL('../../entry/src/main/ets/pages/Index.ets',import.meta.url),methods,deps);
  for(const [name,descriptor] of Object.entries(Object.getOwnPropertyDescriptors(Methods.prototype)))
   if((methods.includes(name)||directoryOperationIndexMembers.includes(name))&&typeof descriptor.value==='function')page[name]=descriptor.value;
  installDirectoryOperationIndex(page,deps);
  return page;
 },fixture:f};
}
