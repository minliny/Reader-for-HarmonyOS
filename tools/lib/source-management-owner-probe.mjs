import {bookshelfOperationClass} from './bookshelf-operation-owner-probe.mjs';
import {isReaderCoreTransactionPendingError} from '../../entry/vendor/core-harmony/sdk/reader_core.ts';
import {projectOperationFacts,projectCommitReadback} from '../../entry/src/main/ets/app/ReaderOperationFacts.ts';
import {ReaderWriteEvidence} from '../../entry/src/main/ets/app/ReaderWriteEvidence.ts';
import {errorMessageOf} from '../../entry/src/main/ets/app/ErrorMessage.ts';
import * as windowMetrics from '../../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';
import * as horizontalGeometry from '../../entry/src/main/ets/ui/layout/SurfaceHorizontalGeometry.ts';
import * as widthClass from '../../entry/src/main/ets/ui/foundation/ReaderWidthClass.ts';
import * as scrollLayout from '../../entry/src/main/ets/ui/layout/ReaderScrollLayout.ts';
import {ReaderMeasurementStore} from '../../entry/src/main/ets/ui/layout/ReaderMeasurements.ts';
import {actualReaderPageShell} from './reader-page-shell-runtime-probe.mjs';

export function actualSourceManagementGeometry(metrics = windowMetrics.createDefaultReaderWindowMetrics()) {
 const shell = actualReaderPageShell();
 const geometry = bookshelfOperationClass('ui/layout/ReaderPageGeometry.ts',
   '({ReaderPageGeometry,ReaderPageGeometryInput,resolveReaderPageGeometry})',
   {...shell,...windowMetrics,...horizontalGeometry,...widthClass});
 const readerFloatingBarBottomInset = bookshelfOperationClass('ui/layout/ReaderFloatingBarMetrics.ts',
   'readerFloatingBarBottomInset',windowMetrics);
 return {...shell,...geometry,...scrollLayout,ReaderMeasurementStore,readerFloatingBarBottomInset,
   ReaderWindowCoordinator:{metrics:()=>metrics}};
}
export function actualSourceManagementTypes(deps) {
 const facts={projectOperationFacts,projectCommitReadback};
 const projectPersistedReceipt=bookshelfOperationClass('app/ReaderPersistedReceiptProjection.ts','projectPersistedReceipt',facts);
 const http=bookshelfOperationClass('platform/network/HttpTransportPolicy.ts','({httpUrlHostname,isPrivateNetworkTarget})');
 const categories=bookshelfOperationClass('features/source/application/ReaderSourceCategory.ts','({classifyReaderSource})');
 const all={...deps,...facts,ReaderWriteEvidence,errorMessageOf,projectPersistedReceipt,isReaderCoreTransactionPendingError,...http,...categories};
 const SourceGateway=bookshelfOperationClass('features/source/application/SourceGateway.ts','SourceGateway',all);
 const SourceOrchestrator=bookshelfOperationClass('features/source/application/SourceOrchestrator.ets','SourceOrchestrator',{...all,SourceGateway});
 const SourceHost=bookshelfOperationClass('features/source/application/SourceHost.ets','SourceHost',{...all,SourceGateway,SourceOrchestrator});
 return{SourceGateway,SourceOrchestrator,SourceHost};
}

export function actualSourceJourneyTypes(deps) {
 const sourceTypes = actualSourceManagementTypes(deps);
 const facts = {projectOperationFacts,projectCommitReadback};
 const projectPersistedReceipt = bookshelfOperationClass('app/ReaderPersistedReceiptProjection.ts','projectPersistedReceipt',facts);
 const tools = bookshelfOperationClass('features/source/application/SourceToolsOrchestrator.ets',
   '({SourceToolsOrchestrator,EMPTY_SOURCE_TOOLS_SNAPSHOT})',
   {...deps,...sourceTypes,...facts,ReaderWriteEvidence,projectPersistedReceipt});
 return {...sourceTypes,...tools,...bookshelfOperationClass('features/source/presentation/SourceJourneyPresentation.ets',
   '({SourceJourneyPresentation,EMPTY_SOURCE_JOURNEY})',{...sourceTypes,...tools})};
}
