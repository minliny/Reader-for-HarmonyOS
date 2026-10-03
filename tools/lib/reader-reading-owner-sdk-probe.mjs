import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { ReaderWriteEvidence } from '../../entry/src/main/ets/app/ReaderWriteEvidence.ts';
import { projectPersistedReceipt } from '../../entry/src/main/ets/app/ReaderPersistedReceiptProjection.ts';
import { LocalReadingFlowGateway, LOCAL_SOURCE_ID } from '../../entry/src/main/ets/features/reading/LocalReadingFlowGateway.ts';
import { ReadingOfflineGateway } from '../../entry/src/main/ets/features/reading/ReadingOfflineGateway.ts';
import { loadReaderControlBookmarkProjection } from '../../entry/src/main/ets/features/reading/ReaderControlBookmarkLoad.ts';
const require=createRequire(import.meta.url);
const sdk=process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts=require(sdk+'/node_modules/typescript');
function emit(name,dependencies){
 const path=new URL(`../../entry/src/main/ets/features/reading/${name}.ts`,import.meta.url);
 const source=readFileSync(path,'utf8');
 const tree=ts.createSourceFile(path.pathname,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 assert.deepEqual(tree.parseDiagnostics,[],'actual complete owner source parses in SDK');
 const body=source.replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm,'');
 const result=ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.CommonJS,strict:true},reportDiagnostics:true,fileName:path.pathname});
 assert.deepEqual(result.diagnostics,[],'actual SDK emitter reports no diagnostics');
 const exports={};new Function('exports',...Object.keys(dependencies),result.outputText)(exports,...Object.values(dependencies));
 return exports[name];
}
export const ReaderDirectoryHost=emit('ReaderDirectoryHost',{ReaderWriteEvidence,projectPersistedReceipt,LocalReadingFlowGateway,LOCAL_SOURCE_ID,loadReaderControlBookmarkProjection});
export const ReadingOfflineHost=emit('ReadingOfflineHost',{ReaderWriteEvidence,projectPersistedReceipt,ReadingOfflineGateway});
