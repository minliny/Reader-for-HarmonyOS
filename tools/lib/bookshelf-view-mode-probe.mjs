import { runtimeOwnerIdentityProbe } from './reader-runtime-admission-probe.mjs';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {ReaderWriteEvidence} from '../../entry/src/main/ets/app/ReaderWriteEvidence.ts';
import {projectOperationFacts,projectCommitReadback} from '../../entry/src/main/ets/app/ReaderOperationFacts.ts';
import {readerRecoveryView} from '../../entry/src/main/ets/app/ReaderRecoveryProjection.ts';
export {readerRecoveryView};
const source=p=>readFileSync(new URL('../../entry/src/main/ets/'+p,import.meta.url),'utf8');
const body=p=>stripTypeScriptTypes(source(p).replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm,'').replace(/^export /gm,''));
const projectPersistedReceipt=new Function('projectOperationFacts','projectCommitReadback',body('app/ReaderPersistedReceiptProjection.ts')+';return projectPersistedReceipt;')(projectOperationFacts,projectCommitReadback);
const runtime={};
const Host=new Function('WebDavCredentialStore','ReaderThemeHost','ReaderRuntimeOwner','ReaderWriteEvidence','errorMessageOf','projectOperationFacts','projectPersistedReceipt',
 body('features/bookshelf/BookshelfViewModeHost.ts')+';return BookshelfViewModeHost;')({instance:{}},{prepareUserChange:async()=>{}},runtimeOwnerIdentityProbe(()=>runtime),ReaderWriteEvidence,e=>e.message,projectOperationFacts,projectPersistedReceipt);
/** Legacy preference fixtures represent native writes explicitly. The real
 * Preferences boundary is covered by test-bookshelf-view-mode-receipts. */
export function actualModeHost(store,prepare=async()=>{}){
 return new Host({bookshelfModeContextGeneration:()=>0,currentBookshelfViewMode:()=>store.currentBookshelfViewMode?.(),
  loadBookshelfViewMode:migrate=>store.loadBookshelfViewMode(migrate),
  saveBookshelfViewMode:async(mode,_id,evidence,isCurrent)=>{if(!isCurrent())throw Error('RETIRED');evidence.dispatched();await store.saveBookshelfViewMode(mode);evidence.confirmed();}},prepare);
}
