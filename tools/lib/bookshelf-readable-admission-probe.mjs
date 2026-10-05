import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
import {actualBookshelfOperationTypes,actualBookshelfHostField,bookshelfOperationClass} from './bookshelf-operation-owner-probe.mjs';
import {runtimeOwnerIdentityProbe} from './reader-runtime-admission-probe.mjs';
import {productionMotionMethods} from './reader-motion-method-probe.mjs';
registerHooks({resolve(s,c,n){try{return n(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return n(`${s}.ts`,c);throw e;}}});
const {ReaderCoreRequestError}=await import('../../entry/vendor/core-harmony/sdk/reader_core.ts');
export {ReaderCoreRequestError};
export const readableSource=p=>readFileSync(new URL('../../entry/src/main/ets/'+p,import.meta.url),'utf8');
export const readableTick=()=>new Promise(resolve=>setImmediate(resolve));
export const readableDeferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
export function readableAdmissionFixture({runtime,book={sourceId:'s',bookId:'b',title:'书',author:'作者'},add,cancel,lookup}={}) {
 let installed; const calls=[];
 runtime??={bookAcquisitions:()=>({addReadableBook:async params=>{calls.push(['add',params]);return add?add(params):{data:{sourceId:params.sourceId,bookId:params.bookId,created:true,addedAt:1}};},cancelReadableBook:async(...id)=>{calls.push(['cancel',id]);return cancel?.(...id);}}),request:async(method,p)=>{calls.push([method,p]);if(method==='bookshelf.get')return{data:{book:lookup?await lookup(p):null}};throw Error(method);}};
 installed=runtime;
 const ReaderRuntimeOwner=runtimeOwnerIdentityProbe(()=>installed);
 const ReaderCoreGateway=bookshelfOperationClass('app/ReaderCoreGateway.ts','ReaderCoreGateway',{ReaderRuntimeOwner});
 const types=actualBookshelfOperationTypes({ReaderRuntimeOwner,ReaderCoreGateway,ReaderCoreRequestError});
 const methods=['addDetailBook','cancelDetailBookAddition','isSameDetailBook','readableAdmissionCurrent','publishReadableAdmission','detailReadableAdmission','detailShelfAdmissionIdentity','isCurrentDetailShelfAdmission','requestDetailShelfMutation'];
 const Index=productionMotionMethods(new URL('../../entry/src/main/ets/pages/Index.ets',import.meta.url),methods,{ReaderRuntimeOwner,LOCAL_SOURCE_ID:'local',EMPTY_READABLE_ADMISSION:types.EMPTY_READABLE_ADMISSION});
 const make=()=>{
  const notices=[];const page=Object.assign(new Index(),{route:'detail',navigationGeneration:1,mountedRuntimeOwner:runtime,shelfReceiptRetired:false,
   detailShelfAdmissionMount:1,readableAdmissions:[],detailBook:{...book},remoteReadingSession:{identity:{sourceId:book.sourceId,bookId:book.bookId},book:{...book}},
   shelfOperation:{removalKey:'',busy:false,batchRemovalBusy:false},detailInBookshelf:false,refreshes:0,memberships:0,
   canRemoveDetailBook:()=>true,detailBookKey:b=>`${b.sourceId}\u0000${b.bookId}`,
   refreshBookshelf(){this.refreshes++;},refreshSearchShelfMembership(){this.memberships++;},showReadingFailure:(...args)=>notices.push(args)});
  page.bookshelfHost=actualBookshelfHostField(page,types.Host,{setOrCreate(){}});
  page.bookshelfHost.readable(runtime);
  return {page,notices};
 };
 const first=make();return {...first,runtime,calls,types,ReaderRuntimeOwner,ReaderCoreGateway,
  rebuild:make,setRuntime:value=>{installed=value;},snapshot:()=>first.page.detailReadableAdmission(first.page.detailBook)};
}
