import { installedEtsCompiler, emitSdkProbe } from './ets-compiler-runtime.mjs';
import { localFilePath } from './tool-environment.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ReaderWriteEvidence } from '../../entry/src/main/ets/app/ReaderWriteEvidence.ts';
import { projectPersistedReceipt } from '../../entry/src/main/ets/app/ReaderPersistedReceiptProjection.ts';
import { LocalReadingFlowGateway, LOCAL_SOURCE_ID } from '../../entry/src/main/ets/features/reading/LocalReadingFlowGateway.ts';
import { ReadingOfflineGateway } from '../../entry/src/main/ets/features/reading/ReadingOfflineGateway.ts';
import { MangaDownloadActionsGateway } from '../../entry/src/main/ets/features/manga/MangaDownloadActionsGateway.ts';
import { loadReaderControlBookmarkProjection } from '../../entry/src/main/ets/features/reading/ReaderControlBookmarkLoad.ts';
const { ts } = installedEtsCompiler();
function emit(name,dependencies){
 const path=new URL(`../../entry/src/main/ets/features/reading/${name}.ts`,import.meta.url);
 const source=readFileSync(path,'utf8');
 const body=source.replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm,'');
 const output=emitSdkProbe(body,{parseSource:source,fileName:localFilePath(path),compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.CommonJS,strict:true}});
 const exports={};new Function('exports',...Object.keys(dependencies),output)(exports,...Object.values(dependencies));
 return exports[name];
}
export const ReaderDirectoryHost=emit('ReaderDirectoryHost',{ReaderWriteEvidence,projectPersistedReceipt,LocalReadingFlowGateway,LOCAL_SOURCE_ID,loadReaderControlBookmarkProjection});
export const ReadingOfflineHost=emit('ReadingOfflineHost',{ReaderWriteEvidence,projectPersistedReceipt,ReadingOfflineGateway,MangaDownloadActionsGateway});
