import assert from 'node:assert/strict';
import { pureModuleProbe } from './ets-pure-module-probe.mjs';
import { selectedProductionMethods } from './selected-production-methods.mjs';
import { searchReadingJourneyFixture } from './search-reading-journey-owner-probe.mjs';
import { ProductionHost as ReadingEntryHost, setRuntime } from './reading-entry-owner-probe.mjs';
import { read, Runtime, origin, gatewayExports } from './source-switch-owner-probe.mjs';
import { actualReaderDirectoryOperations } from './reader-directory-operations-probe.mjs';
import { sourceSwitchProbeQuery } from './source-switch-presentation-probe.mjs';
import { sameRemoteSessionEvidence } from '../../entry/src/main/ets/features/reading/application/RemoteReadingEvidence.ts';
import { SourceSwitchCompletionPresentation } from '../../entry/src/main/ets/features/source/presentation/SourceSwitchCompletionPresentation.ts';
import { remoteReadingSeedForSession } from '../../entry/src/main/ets/features/reading/presentation/ReadingBookDetail.ts';
import { bookshelfSourceDisplayName } from '../../entry/src/main/ets/features/bookshelf/application/BookshelfSourceNameProjection.ts';
import { READER_FEEDBACK_EXTENDED_MS } from '../../entry/src/main/ets/ui/feedback/ReaderTransientFeedback.ts';
import { errorMessageOf } from '../../entry/src/main/ets/app/ErrorMessage.ts';
const [{ MangaSessionGateway }, { MangaSourceSwitchGateway, MangaSwitchChapterSelectionRequired },
  { RemoteReadingFlowGateway }] = await Promise.all([
  import('../../entry/src/main/ets/features/manga/application/MangaSessionGateway.ts'),
  import('../../entry/src/main/ets/features/manga/application/MangaSourceSwitchGateway.ts'),
  import('../../entry/src/main/ets/features/reading/application/RemoteReadingFlowGateway.ts'),
]);
const emit = (path, names, deps={}) => pureModuleProbe(read(path),path,{Observed:value=>value,...deps},names);
const { readerSourceSwitchActions } = emit('app/composition/ReaderSourceSwitchActions.ets',['readerSourceSwitchActions']);
const { ReadingCommitPresentation } = emit('features/reading/presentation/ReadingCommitPresentation.ets',['ReadingCommitPresentation'],{
  sameRemoteSessionEvidence,SourceSwitchCompletionPresentation,
  ReadingPrefetchHost:{forRuntime:()=>({nearEnd:()=>false,prefetch:async()=>{}})},
});
const IndexMangaPorts=selectedProductionMethods(new URL('../../entry/src/main/ets/pages/Index.ets',import.meta.url),
  'Index',['mangaSourceSwitchPorts','nextNavigationGeneration'],{READER_FEEDBACK_EXTENDED_MS});

/** Real current feature owners. Only unrelated search scheduling, prefetch and
 * native notices are controlled outbound ports; no Index mirror or entry stub. */
export function currentSourceSwitchOwners(f,{navigation=1,reading=false,cacheAuthority,initialBook,loadLocal}={}) {
  setRuntime(f.runtime);
  const acquisitions=f.runtime.bookAcquisitions,acceptedCatalogs=new WeakSet();
  f.runtime.bookAcquisitions=()=>{const port=acquisitions();return {...port,readingProjectionRevision:()=>0,setPreparationVisible(){},
    async acquireBook(...args){const session=await port.acquireBook(...args);acceptedCatalogs.add(session);return session;},
    hasCurrentCatalogProjection:session=>acceptedCatalogs.has(session)};};
  const preparationIntents=[],notePreparation=f.runtime.noteReadingPreparationIntent;
  f.runtime.noteReadingPreparationIntent=(sourceId,bookId)=>{preparationIntents.push({sourceId,bookId});notePreparation?.call(f.runtime,sourceId,bookId);};
  const events=[];
  const sourceName=(id,name='')=>bookshelfSourceDisplayName(id,name,[],x?.source.namedCandidate);
  const x=searchReadingJourneyFixture({runtime:f.runtime,ReadingHost:ReadingEntryHost,SourceHost:f.Constructor,route:'detail',
    sourceName,loadLocal,onEvent:event=>events.push(event),failure(message){events.push(['notice',message]);}});
  while(x.navigation.snapshot().generation<navigation)x.navigation.advance();
  x.navigation.returns.completeDetailEntry('bookshelf','bookshelf',false);
  Object.assign(x.entry,{book:initialBook??{...origin,sourceName:'Old',contentKind:'text'},inBookshelf:f.context.inBookshelf,
    toc:[{index:0,title:'Chapter 1',navigable:true}],directoryChapterTitle:'Chapter 1',readyGeneration:1,sessionActive:reading});
  if(reading)x.navigation.show('reading');
  const current=()=>!x.controls.retired&&Runtime.isCurrent(f.runtime);
  const bindReader=()=>x.entry.bindReader(f.runtime,x.actions.ports.entryPorts(f.runtime));
  bindReader();
  // Execute the actual Index composition port declaration. These receiver
  // callbacks delegate to the same real journey and feature owners as Index.
  const receiver={sourceSwitchJourney:x.switchJourney,readingEntry:x.entry,sourceSwitchPresentation:x.source,
    getSourceSwitchHost:()=>x.switchJourney.host(),sourceSwitchProbeQuery:()=>sourceSwitchProbeQuery(x.entry),
    isCurrentRuntime:owner=>owner===f.runtime&&current(),
    performSourceSwitchSeam:(...args)=>x.switchJourney.commit(...args),refreshBookshelf:()=>events.push('shelf.project'),
    transientFeedback:{show(_context,notice,admitted){if(admitted())events.push(['feedback',notice.message]);}},
    getUIContext:()=>({}),searchAppForeground:true,journeyRecoveryInputAllowed:current,
    showIndexRecoveryNotice:(message,label,retry,admitted)=>events.push({message,label,retry,admitted}),consumeSystemFileOpen:()=>events.push('file.consume')};
  assert.equal(typeof f.MangaSwitchRecoveryError,'function','use the exact actual recovery error class owned by this Host');
  const {MangaSourceSwitchPresentation}=emit('features/manga/presentation/MangaSourceSwitchPresentation.ets',
    ['MangaSourceSwitchPresentation'],{...gatewayExports,errorMessageOf,remoteReadingSeedForSession,
      MangaSessionGateway,MangaSourceSwitchGateway,MangaSwitchChapterSelectionRequired,RemoteReadingFlowGateway,
      MangaSwitchRecoveryError:f.MangaSwitchRecoveryError});
  const manga=new MangaSourceSwitchPresentation(IndexMangaPorts.prototype.mangaSourceSwitchPorts.call(receiver));
  x.switchJourney.ports.manga=()=>manga;
  x.exit.ports.switchBlocked=book=>x.source.host()?.blocksExit(book)===true;
  // Use Index's actual navigation retirement fan-out, retaining every active
  // source/manga/entry owner. Unrelated feature lifecycles remain finite ports.
  const inactive=()=>({retire(){}});
  const navigationReceiver={shelfMotion:{clear(){}},transientFeedback:{reset(){}},downloadPresentation:inactive(),
    settingsPresentation:inactive(),sourceJourney:inactive(),rssJourney:inactive(),shelfCatalog:inactive(),
    shelfManagement:inactive(),shelfGroupPresentation:inactive(),discoverPresentation:inactive(),rulesPresentation:inactive(),
    syncPresentation:inactive(),nativeAlertOwner:inactive(),shelfMutations:{retireSelection(){}},readingEntry:x.entry,
    readingEntryActions:x.actions,navigationOwner:x.navigation,retireSourceSwitchPresentation:()=>x.switchJourney.retire(),
    publishNavigation:snapshot=>{assert.equal(snapshot,x.navigation.snapshot());navigationReceiver.navigationGeneration=snapshot.generation;}};
  const advance=(...args)=>IndexMangaPorts.prototype.nextNavigationGeneration.call(navigationReceiver,...args);
  x.actions.ports.advance=advance;x.switchJourney.ports.advance=advance;x.exit.ports.advance=advance;x.journey.ports.advance=advance;
  const sourceActions=readerSourceSwitchActions(()=>x.source,()=>manga,()=>x.entry.book?.contentKind==='manga',()=>x.switchJourney.workflow());
  const cleanup=[];
  let directoryOperations,offline;
  if(cacheAuthority){
    const Operations=actualReaderDirectoryOperations({ReaderDirectoryHost:cacheAuthority.Directory,
      ReadingOfflineHost:cacheAuthority.Offline,...cacheAuthority.types});
    directoryOperations=new Operations({
      scene:()=>({owner:f.runtime,retired:x.controls.retired,mount:1,navigation:x.navigation.snapshot().generation,
        presentation:x.entry.directoryPresentationGeneration,sessionGeneration:x.entry.sessionGeneration,
        directoryVisible:x.navigation.snapshot().route==='directory',acceptsProjection:current(),foreground:x.controls.foreground,
        reading:x.entry.sessionActive,offlineBusy:x.entry.offlineOperationActive,book:x.entry.book,session:x.entry.session}),
      ownsRuntime:owner=>owner===f.runtime&&current(),currentEntries:()=>x.entry.toc,replaceEntries:entries=>{x.entry.toc=entries;},
      publishBookmarks:operation=>{x.entry.directoryOperation=operation;},
      publishOffline:(operation,busy)=>{x.entry.offlineOperation=operation;x.entry.offlineOperationActive=busy;},
      diagnostic:kind=>events.push({kind:'directory.diagnostic',diagnostic:kind}),
      refreshMangaDirectory(){assert.fail('directory refresh outside retired-source cleanup');},
      feedback(){assert.fail('download feedback outside retired-source cleanup');},
      openDownloadProgress(){assert.fail('download progress outside retired-source cleanup');},canExitReader:()=>false,
      afterReaderExitInDetail(){assert.fail('reader exit outside retired-source cleanup');},
      confirmOfflineClear(){assert.fail('explicit user clear outside retired-source cleanup');},
    });
    offline=directoryOperations.offlineHost(f.runtime);
  }
  const commits=new ReadingCommitPresentation({entry:()=>x.entry,
    scene:()=>({owner:f.runtime,retired:x.controls.retired,navigation:x.navigation.snapshot().generation,mounting:1,
      active:x.entry.sessionActive,readyGeneration:x.entry.readyGeneration}),ownsRuntime:owner=>owner===f.runtime&&current(),
    finalize:(sourceId,bookId,tx)=>x.source.finalizeTarget(x.switchJourney.scene(),{sourceId,bookId},tx),
    cleanup:(sourceId,bookId)=>{cleanup.push({sourceId,bookId});directoryOperations?.cleanupRetiredSource(sourceId,bookId);},
    sourceName,applyRefreshedSession:session=>x.actions.acceptReaderSession(session),
    refreshShelf:()=>events.push('shelf.project'),notifyFileNavigation(){},diagnostic(){},
  });
  navigationReceiver.readingCommits=commits;
  const bindSource=()=>{
    const host=x.source.acquire(x.switchJourney.scene());assert.equal(host,f.host);
    x.source.bindReader(host,x.source.workflowContext(x.switchJourney.workflow()),x.source.workflowLease(host,x.switchJourney.workflow()));
  };
  return {...x,manga,sourceActions,commits,cleanup,offline,directoryOperations,events,preparationIntents,bindReader,bindSource};
}
