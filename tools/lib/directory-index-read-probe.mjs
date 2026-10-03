import {fixture} from './reading-operation-durable-probe.mjs';
import {productionMotionMethods} from './reader-motion-method-probe.mjs';
// Whole production atomic intent stores/owners use the existing real temporary
// file adapter. Only the current Runtime and RPC replies belong to each journey.
export async function directoryIndexReadProbe(){
 const f=await fixture(true);
 const methods=['loadDirectoryOperationProjections','getReaderDirectoryHost','getReadingOfflineHost',
  'directoryOperationPresentationId','directoryOperationBindingId','isCurrentDirectoryOperationBinding',
  'isCurrentDirectoryOperationPresentation','directoryBinding','offlineBinding','applyOwnedDirectoryEntries'];
 return {attach(page,runtime,extra={}){
  f.install(runtime);
  if(runtime.getUIAbilityContext===undefined)runtime.getUIAbilityContext=()=>({filesDir:f.files});
  const Methods=productionMotionMethods(new URL('../../entry/src/main/ets/pages/Index.ets',import.meta.url),methods,{
   ReaderDirectoryHost:f.Directory,ReadingOfflineHost:f.Offline,...f.types,DOMAIN:0,hilog:{warn(){},error(){}},...extra});
  for(const [name,descriptor] of Object.entries(Object.getOwnPropertyDescriptors(Methods.prototype)))
   if(methods.includes(name)&&typeof descriptor.value==='function')page[name]=descriptor.value;
  return page;
 },fixture:f};
}
