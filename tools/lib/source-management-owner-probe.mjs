import {bookshelfOperationClass} from './bookshelf-operation-owner-probe.mjs';
import {isReaderCoreTransactionPendingError} from '../../entry/vendor/core-harmony/sdk/reader_core.ts';
import {projectOperationFacts,projectCommitReadback} from '../../entry/src/main/ets/app/ReaderOperationFacts.ts';
import {ReaderWriteEvidence} from '../../entry/src/main/ets/app/ReaderWriteEvidence.ts';
import {errorMessageOf} from '../../entry/src/main/ets/app/ErrorMessage.ts';
export function actualSourceManagementTypes(deps) {
 const facts={projectOperationFacts,projectCommitReadback};
 const projectPersistedReceipt=bookshelfOperationClass('app/ReaderPersistedReceiptProjection.ts','projectPersistedReceipt',facts);
 const http=bookshelfOperationClass('app/HttpTransportPolicy.ts','({httpUrlHostname,isPrivateNetworkTarget})');
 const categories=bookshelfOperationClass('features/source/ReaderSourceCategory.ts','({classifyReaderSource})');
 const all={...deps,...facts,ReaderWriteEvidence,errorMessageOf,projectPersistedReceipt,isReaderCoreTransactionPendingError,...http,...categories};
 const SourceGateway=bookshelfOperationClass('features/source/SourceGateway.ts','SourceGateway',all);
 const SourceOrchestrator=bookshelfOperationClass('features/source/SourceOrchestrator.ets','SourceOrchestrator',{...all,SourceGateway});
 const SourceHost=bookshelfOperationClass('features/source/SourceHost.ets','SourceHost',{...all,SourceGateway,SourceOrchestrator});
 return{SourceGateway,SourceOrchestrator,SourceHost};
}
