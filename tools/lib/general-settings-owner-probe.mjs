// Full unchanged Settings production classes for method-level Index probes.
// Platform writes require explicit seams; a probe cannot fake successful IO.
import {bookshelfOperationClass,bookshelfOperationSource} from './bookshelf-operation-owner-probe.mjs';
import {ReaderWriteEvidence} from '../../entry/src/main/ets/app/ReaderWriteEvidence.ts';
import {projectOperationFacts} from '../../entry/src/main/ets/app/ReaderOperationFacts.ts';
import {ReaderCoreRequestError,isReaderCoreTransactionPendingError} from '../../entry/vendor/core-harmony/sdk/reader_core.ts';
const unsupported=()=>{throw Error('Actual Settings probe requires an explicit platform IO seam');};
const missingIo={readText:async()=>unsupported(),open:async()=>unsupported(),fsync:async()=>unsupported(),close:async()=>unsupported(),
 OpenMode:{READ_WRITE:2,READ_ONLY:0},AtomicFile:class{constructor(){unsupported();}}};
export function actualGeneralSettingsTypes(deps={}) {
 const projectPersistedReceipt=bookshelfOperationClass('app/ReaderPersistedReceiptProjection.ts','projectPersistedReceipt',{projectOperationFacts});
 const all={...deps,ReaderWriteEvidence,projectOperationFacts,projectPersistedReceipt,ReaderCoreRequestError,isReaderCoreTransactionPendingError,
  preferences:deps.settingsPreferences??deps.preferences??{getPreferences:async()=>unsupported()},
  ReaderThemeHost:deps.ReaderThemeHost??{prepareUserChange:async()=>unsupported()},
  fileIo:deps.settingsFileIo??deps.fileIo??missingIo,
  util:deps.settingsUtil??deps.util??{generateRandomUUID:unsupported},
  hilog:deps.hilog??{error(){}}};
 all.replaceReaderAtomicSnapshot=deps.replaceReaderAtomicSnapshot??bookshelfOperationClass('app/ReaderAtomicSnapshotFile.ts','replaceReaderAtomicSnapshot',all);
 const readingIntents=bookshelfOperationClass('features/reading/ReadingOperationIntents.ts','({CacheClearOperationIntentStore,ReadingOperationPendingError})',all);
 const gateway=bookshelfOperationClass('features/settings/SettingsGateway.ts','({SettingsGateway,createDefaultSettingsSnapshot})',all);
 const reset=deps.LocalConfigurationReset??bookshelfOperationClass('features/settings/LocalConfigurationReset.ts','LocalConfigurationReset',{...all,...gateway});
 const SettingsOrchestrator=bookshelfOperationClass('features/settings/SettingsOrchestrator.ets','SettingsOrchestrator',{...all,...gateway,LocalConfigurationReset:reset});
 const SettingsCacheGateway=bookshelfOperationClass('features/settings/SettingsCacheGateway.ts','SettingsCacheGateway',{...all,...readingIntents});
 const SettingsCacheCleanupOwner=bookshelfOperationClass('features/settings/SettingsCacheCleanupOwner.ts','SettingsCacheCleanupOwner',{...all,...readingIntents,SettingsCacheGateway});
 const SettingsHost=bookshelfOperationClass('features/settings/SettingsHost.ets','SettingsHost',{...all,SettingsOrchestrator,SettingsCacheCleanupOwner});
 return {...gateway,SettingsOrchestrator,SettingsCacheGateway,SettingsCacheCleanupOwner,SettingsHost};
}
export function actualGeneralSettingsHostField(index,SettingsHost) {
 const text=bookshelfOperationSource('pages/Index.ets'),start=text.indexOf('  private settingsHost:'),end=text.indexOf('\n  );',start)+6;
 if(start<0||end<=start)throw Error('actual SettingsHost Index initializer missing');
 const expression=text.slice(text.indexOf('=',start)+1,end).trim().replace(/;$/,'');
 // Use the same installed SDK transpiler as all neighboring owner probes.
 return bookshelfOperationClassText(expression,index,SettingsHost);
}
import {createRequire} from 'node:module';
const sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts=createRequire(import.meta.url)(sdk+'/node_modules/typescript');
function bookshelfOperationClassText(expression,index,SettingsHost) {
 const code=ts.transpileModule('const value='+expression+';',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 return new Function('SettingsHost',code+'return value;').call(index,SettingsHost);
}
