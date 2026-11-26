import {fixture as rulesFixture,compile} from './rules-mutation-durable-probe.mjs';
import {projectOperationFacts,projectCommitReadback} from '../../entry/src/main/ets/app/ReaderOperationFacts.ts';
import {ReaderWriteEvidence} from '../../entry/src/main/ets/app/ReaderWriteEvidence.ts';
import {errorMessageOf} from '../../entry/src/main/ets/app/ErrorMessage.ts';
import {httpUrlHostname,isPrivateNetworkTarget} from '../../entry/src/main/ets/platform/network/HttpTransportPolicy.ts';
import {classifyReaderSource} from '../../entry/src/main/ets/features/source/application/ReaderSourceCategory.ts';
import {isReaderCoreTransactionPendingError} from '../../entry/vendor/core-harmony/sdk/reader_core.ts';
import {projectSourceV9Check, retainSourceV9Check, sourceV9AuthenticationDenied, sourceV9Supports}
 from '../../entry/src/main/ets/features/source/presentation/SourceManagementV9.ts';
import {OFFLINE_DETECT_CORE_REASON, PUBLIC_OFFLINE_DETECT_SOURCE_URL, sourceVerificationOfflineDetectIdentity,
 sourceVerificationOpening, sourceVerificationRecoveryControl, sourceVerificationRowLoginControl,
 sourceVerificationToggleAnchor, sourceVerificationOfflineDetectFixture} from '../../entry/src/main/ets/features/source/ui/SourceManagementVerification.ts';

// The source-management probe compiles the production Gateway and
// Orchestrator through the installed ETS compiler. Their verification probe
// is a Harmony runtime observer, so provide its no-op production seam here
// while retaining every pure V9 projection and verification function.
const ReaderUIVerificationProbe = { enabled: () => false, emit: () => {} };
export async function fixture(existing) {
 const f=await rulesFixture(true,existing);
 const SourceGateway=compile('features/source/application/SourceGateway.ts','SourceGateway',{
  ReaderRuntimeOwner:f.Runtime,RulesMutationOwner:f.Owner,errorMessageOf,httpUrlHostname,isPrivateNetworkTarget,
  classifyReaderSource,isReaderCoreTransactionPendingError,ReaderUIVerificationProbe,
  sourceVerificationOfflineDetectFixture},true);
 const capabilities=new Set((await f.command('core.info')).data.capabilities);
 f.runtime.supportsCoreCapability=capability=>f.options.capability!==false && capabilities.has(capability);
 const cleanupCalls=[];
 f.runtime.clearSourceCookieSession=async id=>{cleanupCalls.push(id);if(f.options.cookieFailure)throw Error('original Host cookie cleanup failed');};
 const projectPersistedReceipt=compile('app/ReaderPersistedReceiptProjection.ts','projectPersistedReceipt',{projectOperationFacts,projectCommitReadback},true);
 const common={SourceGateway,ReaderRuntimeOwner:f.Runtime,ReaderWriteEvidence,projectOperationFacts,projectCommitReadback,
  projectPersistedReceipt,errorMessageOf,isReaderCoreTransactionPendingError,ReaderUIVerificationProbe,
  projectSourceV9Check,retainSourceV9Check,sourceV9AuthenticationDenied,sourceV9Supports,
  OFFLINE_DETECT_CORE_REASON,PUBLIC_OFFLINE_DETECT_SOURCE_URL,sourceVerificationOfflineDetectIdentity,
  sourceVerificationOpening,sourceVerificationRecoveryControl,sourceVerificationRowLoginControl,
  sourceVerificationToggleAnchor,hilog:{error(){},warn(){},info(){}}};
 const SourceOrchestrator=compile('features/source/application/SourceOrchestrator.ets','SourceOrchestrator',common,true);
 const SourceHost=compile('features/source/application/SourceHost.ets','SourceHost',{...common,SourceOrchestrator},true);
 const SourceToolsOrchestrator=compile('features/source/application/SourceToolsOrchestrator.ets','SourceToolsOrchestrator',common,true);
 const gateway=new SourceGateway(f.runtime);
 return{...f,cleanupCalls,SourceGateway,SourceHost,SourceOrchestrator,SourceToolsOrchestrator,source:gateway,current:()=>f.Runtime.isCurrent(f.runtime),
  recoverSource:retry=>gateway.recoverOriginalSource(()=>f.Runtime.isCurrent(f.runtime),retry)};
}
