import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {registerHooks, createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const require=createRequire(import.meta.url);
const ets=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts=require(ets+'/node_modules/typescript');
const root=fileURLToPath(new URL('../../',import.meta.url));
const coreRoots=[process.env.READER_CORE_ROOT,resolve(root,'../Reader-Core-Native'),resolve(root,'../../../Reader-Core-Native'),resolve(root,'../../Reader-Core-Native')].filter(Boolean);
const coreRoot=coreRoots.find(path=>existsSync(resolve(path,'bindings/harmony/sdk/reader_core.ts')));
assert.ok(coreRoot,'actual Core SDK fixture input exists');
const sdk=await import(pathToFileURL(resolve(coreRoot,'bindings/harmony/sdk/reader_core.ts')).href);
const errors=await import('../../entry/src/main/ets/app/ErrorMessage.ts');
const receipt=await import('../../entry/src/main/ets/app/ReaderPersistedReceiptProjection.ts');
const evidence=await import('../../entry/src/main/ets/app/ReaderWriteEvidence.ts');
const policy=await import('../../entry/src/main/ets/app/HttpTransportPolicy.ts');
const category=await import('../../entry/src/main/ets/features/source/ReaderSourceCategory.ts');
const importFailure=await import('../../entry/src/main/ets/app/LocalImportFailure.ts');
const local=await import('../../entry/src/main/ets/features/reading/LocalReadingFlowGateway.ts');
const remote=await import('../../entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');
const readingEvidence=await import('../../entry/src/main/ets/features/reading/RemoteReadingEvidence.ts');
const position=await import('../../entry/src/main/ets/features/reading/RemoteReadingPositionMigration.ts');
const content=await import('../../entry/src/main/ets/features/reading/RemoteContentAdmission.ts');
const bookmarks=await import('../../entry/src/main/ets/features/reading/ReaderControlBookmarkLoad.ts');
const {ReadingOfflineGateway}=await import('../../entry/src/main/ets/features/reading/ReadingOfflineGateway.ts');
export const {BookAcquisitionCoordinator}=await import('../../entry/src/main/ets/app/BookAcquisitionCoordinator.ts');
export const {ReadingEntryPreparation}=await import('../../entry/src/main/ets/features/reading/ReadingEntryPreparation.ts');
export {readingEvidence,position,content};
export const read=path=>readFileSync(resolve(root,'entry/src/main/ets',path),'utf8');
export let currentRuntime;
export const setRuntime=runtime=>{currentRuntime=runtime;};
const Runtime={current:()=>currentRuntime,isCurrent:runtime=>currentRuntime===runtime&&!runtime.closed};
/** Entire actual production classes go through the installed SDK TS emitter.
 * Runtime identity and Core/OS transport are controlled test seams only. */
function emit(path,name,deps,source=read(path)){
 const tree=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 assert.deepEqual(tree.parseDiagnostics,[],path+' actual SDK parser');
 const body=source.replace(/^import[\s\S]*?;\n/gm,'');
 const result=ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.CommonJS},reportDiagnostics:true,fileName:path});
 assert.deepEqual(result.diagnostics,[],path+' actual SDK emitter');
 const exports={};new Function('exports',...Object.keys(deps),result.outputText)(exports,...Object.values(deps));return exports[name];
}
const common={ReaderRuntimeOwner:Runtime,...sdk,...errors,...receipt,...evidence,...policy,...category,...importFailure,...local,...remote,
 ...readingEvidence,...position,...content,...bookmarks,ReadingOfflineGateway,hilog:{warn(){},error(){},info(){}}};
const ReaderCoreGateway=emit('app/ReaderCoreGateway.ts','ReaderCoreGateway',common);
const LocalBookImportGateway=emit('features/bookshelf/LocalBookImportGateway.ts','LocalBookImportGateway',{...common,ReaderCoreGateway});
const BookshelfFlowGateway=emit('features/bookshelf/BookshelfFlowGateway.ts','BookshelfFlowGateway',{...common,ReaderCoreGateway,LocalBookImportGateway});
const SourceGateway=emit('features/source/SourceGateway.ts','SourceGateway',common);
const BookAcquisitionProjectionGateway=emit('app/BookAcquisitionProjectionGateway.ts','BookAcquisitionProjectionGateway',common);
export const ReaderDirectoryHost=emit('features/reading/ReaderDirectoryHost.ts','ReaderDirectoryHost',common);
const ReadingPrefetchHost=emit('features/reading/ReadingPrefetchHost.ts','ReadingPrefetchHost',common);
export const compileHost=(source=read('features/reading/ReadingEntryHost.ts'))=>emit('features/reading/ReadingEntryHost.ts','ReadingEntryHost',
 {...common,ReaderCoreGateway,BookshelfFlowGateway,SourceGateway,BookAcquisitionProjectionGateway,ReaderDirectoryHost,ReadingPrefetchHost},source);
export const ProductionHost=compileHost();
