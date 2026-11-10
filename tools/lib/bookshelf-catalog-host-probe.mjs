import { bookshelfOperationClass } from './bookshelf-operation-owner-probe.mjs';
import { BookshelfReadOwner } from '../../entry/src/main/ets/features/bookshelf/application/BookshelfReadOwner.ts';
import { BookshelfCatalogUpdate } from '../../entry/src/main/ets/features/bookshelf/application/BookshelfCatalogUpdate.ts';
import { projectOperationFacts } from '../../entry/src/main/ets/app/ReaderOperationFacts.ts';
import { runtimeOwnerIdentityProbe } from './reader-runtime-admission-probe.mjs';

/** Whole SDK-emitted existing feature Host/finite catalog owner. The supplied
 * Flow class is the controlled Core read seam; sweep/acquisition logic is real. */
export function bookshelfCatalogHost(BookshelfFlowGateway, owner) {
  const ReaderRuntimeOwner=runtimeOwnerIdentityProbe(owner);
  const BookshelfCatalogOwner=bookshelfOperationClass('features/bookshelf/application/BookshelfCatalogOwner.ts','BookshelfCatalogOwner',
    {BookshelfFlowGateway,BookshelfCatalogUpdate,projectOperationFacts});
  const Host=bookshelfOperationClass('features/bookshelf/application/BookshelfHost.ets','BookshelfHost',
    {ReaderRuntimeOwner,BookshelfFlowGateway,BookshelfCatalogUpdate,BookshelfReadOwner,BookshelfCatalogOwner});
  return new Host(()=>{},()=>true,owner);
}
export const catalogIndexMethods=['getBookshelfCatalogOwner','applyBookshelfCatalogSnapshot','retireBookshelfCatalogPresentation',
 'canRunBookshelfBackgroundRefresh','scheduleBookshelfBackgroundRefresh','startManualBookshelfUpdate','reconcileBookshelfCatalogProjection',
 'isCurrentBookshelfPresentation','isCurrentRuntime','shelfFilter','shelfRecovery','shelfReadRecovery','emptyShelfRecovery'];
