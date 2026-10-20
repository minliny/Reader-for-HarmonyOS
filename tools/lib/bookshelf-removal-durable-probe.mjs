import {managementFixture, read} from './bookshelf-management-durable-probe.mjs';
import {compile} from './rules-mutation-durable-probe.mjs';
import * as facts from '../../entry/src/main/ets/app/ReaderOperationFacts.ts';
import * as errors from '../../entry/src/main/ets/app/ErrorMessage.ts';
import * as failures from '../../entry/src/main/ets/app/LocalImportFailure.ts';
import {ReaderWriteEvidence} from '../../entry/src/main/ets/app/ReaderWriteEvidence.ts';
import {actualBookshelfOperationTypes} from './bookshelf-operation-owner-probe.mjs';

export async function removalFixture(existing) {
 const f=await managementFixture(existing),cleanup=[];
 f.runtime.releaseLocalBookAsset=async bookId=>{cleanup.push(bookId);if(f.options.cleanupGate)await f.options.cleanupGate.promise;if(f.options.cleanupFail)throw Error('retained EPUB file busy');};
 const storeTypes=compile('features/bookshelf/BookshelfManagementIntentStore.ts','*',{},true,
   read('features/bookshelf/BookshelfManagementIntentStore.ts').slice(0,read('features/bookshelf/BookshelfManagementIntentStore.ts').indexOf('export interface BookshelfManagementIntent')));
 const deps={ReaderRuntimeOwner:f.Runtime,ReaderCoreGateway:f.ReaderCoreGateway,ReaderWriteEvidence,
   BookshelfManagementIntentStore:f.Store,isBookshelfRemovalMethod:storeTypes.isBookshelfRemovalMethod,BookshelfManagementGateway:f.Gateway,...facts,...errors,...failures,hilog:{error(){},warn(){}}};
 deps.projectPersistedReceipt=compile('app/ReaderPersistedReceiptProjection.ts','projectPersistedReceipt',facts,true);
 deps.LocalBookImportGateway=compile('features/bookshelf/LocalBookImportGateway.ts','LocalBookImportGateway',deps,true);
 deps.BookshelfRemovalGateway=compile('features/bookshelf/BookshelfRemovalGateway.ts','BookshelfRemovalGateway',deps,true);
 deps.BookshelfFlowGateway=compile('features/bookshelf/BookshelfFlowGateway.ts','BookshelfFlowGateway',deps,true);
 const operation=actualBookshelfOperationTypes({...deps,BookshelfManagementOrchestrator:f.Orchestrator});
 const flow=new deps.BookshelfFlowGateway(f.runtime),removal=new deps.BookshelfRemovalGateway(f.runtime);
 return{...f,...deps,...operation,flow,removal,cleanup};
}
