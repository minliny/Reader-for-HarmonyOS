import {fixture as rulesFixture,compile} from './rules-mutation-durable-probe.mjs';
import {projectOperationFacts,projectCommitReadback} from '../../entry/src/main/ets/app/ReaderOperationFacts.ts';
import {ReaderWriteEvidence} from '../../entry/src/main/ets/app/ReaderWriteEvidence.ts';
import {errorMessageOf} from '../../entry/src/main/ets/app/ErrorMessage.ts';
import {httpUrlHostname,isPrivateNetworkTarget} from '../../entry/src/main/ets/app/HttpTransportPolicy.ts';
import {classifyReaderSource} from '../../entry/src/main/ets/features/source/ReaderSourceCategory.ts';
import {isReaderCoreTransactionPendingError} from '../../entry/vendor/core-harmony/sdk/reader_core.ts';
export async function fixture(existing) {
 const f=await rulesFixture(true,existing);
 const SourceGateway=compile('features/source/SourceGateway.ts','SourceGateway',{
  ReaderRuntimeOwner:f.Runtime,RulesMutationOwner:f.Owner,errorMessageOf,httpUrlHostname,isPrivateNetworkTarget,
  classifyReaderSource,isReaderCoreTransactionPendingError},true);
 const capabilities=new Set((await f.command('core.info')).data.capabilities);
 f.runtime.supportsCoreCapability=capability=>f.options.capability!==false && capabilities.has(capability);
 const cleanupCalls=[];
 f.runtime.clearSourceCookieSession=async id=>{cleanupCalls.push(id);if(f.options.cookieFailure)throw Error('original Host cookie cleanup failed');};
 const projectPersistedReceipt=compile('app/ReaderPersistedReceiptProjection.ts','projectPersistedReceipt',{projectOperationFacts,projectCommitReadback},true);
 const common={SourceGateway,ReaderRuntimeOwner:f.Runtime,ReaderWriteEvidence,projectOperationFacts,projectCommitReadback,projectPersistedReceipt,errorMessageOf,isReaderCoreTransactionPendingError,hilog:{error(){},warn(){},info(){}}};
 const SourceOrchestrator=compile('features/source/SourceOrchestrator.ets','SourceOrchestrator',common,true);
 const SourceHost=compile('features/source/SourceHost.ets','SourceHost',{...common,SourceOrchestrator},true);
 const SourceToolsOrchestrator=compile('features/source/SourceToolsOrchestrator.ets','SourceToolsOrchestrator',common,true);
 const gateway=new SourceGateway(f.runtime);
 return{...f,cleanupCalls,SourceGateway,SourceHost,SourceOrchestrator,SourceToolsOrchestrator,source:gateway,current:()=>f.Runtime.isCurrent(f.runtime),
  recoverSource:retry=>gateway.recoverOriginalSource(()=>f.Runtime.isCurrent(f.runtime),retry)};
}
