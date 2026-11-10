import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

export const CONTRACT_CASES = {
  "late-identity": {
    "description": "Actual Index onReadingFailure ignores stale source/book and retains owned reader/session",
    "resources": []
  },
  "retained-failure-owner": {
    "description": "Actual LRE.fail revokes asynchronous selection while retaining mount and recovery ownership; fake platform ports",
    "resources": []
  },
  "probe-chapter-context": {
    "description": "Actual ReadingEntry presentation and Host forward exact chapter/context only for an admitted session and current scope; chapter gateway is controlled",
    "resources": []
  },
  "source-switch-route": {
    "description": "Actual Index source switch chooses mounted-reader owner or explicit detail fallback",
    "resources": []
  }
};

async function case_late_identity() {
const { default: assert } = await import('node:assert/strict');
const {productionMotionMethods} = await import('./lib/reader-motion-method-probe.mjs');
const indexFile=new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url);
const Index=productionMotionMethods(indexFile,['onReadingFailure'],{hilog:{warn(){}},DOMAIN:0});
for(const active of [false,true])for(const sourceId of ['s','other'])for(const bookId of ['b','other']){
 const page=Object.assign(new Index(),{readingSessionActive:active,detailBook:{sourceId:'s',bookId:'b'},detailLoadingMessage:'old',detailCatalogBusy:true,route:'reading',remoteReadingSession:{kept:true}});
 const before=page.remoteReadingSession;page.onReadingFailure(sourceId,bookId,'target failed','SOURCE_HTTP_FAILED');
 const accepted=active&&sourceId==='s'&&bookId==='b';assert.equal(page.detailLoadingMessage,accepted?'target failed':'old');assert.equal(page.detailCatalogBusy,!accepted);
 assert.equal(page.readingSessionActive,active);assert.equal(page.route,'reading');assert.equal(page.remoteReadingSession,before,'failure retains mount/session, never compensates source switch');
}

}

async function case_retained_failure_owner() {
const { default: assert } = await import('node:assert/strict');
const {productionMotionMethods} = await import('./lib/reader-motion-method-probe.mjs');
const indexFile=new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url);
const file=new URL('../entry/src/main/ets/features/reading/ui/LocalReadingExperience.ets',import.meta.url);
const Reader=productionMotionMethods(file,['fail']);
for(const active of [false,true]){
 const events=[];const page=Object.assign(new Reader(),{isSessionActive:()=>active,pageTurnPreparation:undefined,previousChapterMeasurement:undefined,recoverControlSelectionFailure:()=>false,errorMessage:e=>e.message,chapterSelectionToken:4,mounted:true,exitRequested:false,sourceId:'s',bookId:'b',phase:'ready',autoPageCoordinator:{stop:why=>events.push(['stop',why])},nativeAlertOwner:{retire:()=>events.push('retire')},physicalPagination:{index:{invalidateMeasurement:()=>events.push('invalidate')}},onReadingFailure:(...args)=>events.push(['failure',...args]),beginExit:()=>assert.fail('failure cannot dispose recovery owner')});
 for(const name of ['finishPageTurnPerf','captureReadingRecordElapsed','clearReadingRecordTimer','clearAutoPageTimer','clearAutoPageSessionTimer','cancelMeasurementDeadline','cancelFirstPageReadyDeadline','cancelFirstPageCompletionDeadline','cancelPageTurnPreparationRetry','resetPaginationDraft'])page[name]=()=>events.push(name);
 page.fail(Error('BODY_FAILED'),1);assert.equal(page.phase,active?'failed':'ready');assert.equal(page.chapterSelectionToken,active?5:4);assert.equal(page.mounted,true);assert.equal(page.exitRequested,false);
 if(active){assert.equal(events.filter(e=>Array.isArray(e)&&e[0]==='failure').length,1);assert.ok(events.includes('invalidate'));}else assert.deepEqual(events,[]);
}

}

async function case_probe_chapter_context() {
  const { default: assert } = await import('node:assert/strict');
  const { compileHost } = await import('./lib/reading-entry-owner-probe.mjs');
  const { actualReadingEntryPresentation } = await import('./lib/reading-entry-presentation-probe.mjs');
  const book = { sourceId: 's', bookId: 'b', sourceName: 'Source', title: 'Book', author: 'Writer' };
  const identity = { sourceId: book.sourceId, bookId: book.bookId };
  const session = { identity, sourceVersion: 'v1', catalogVersion: 'c1', contextVersion: 'x1', acquisitionMode: 'online',
    detailUrl: '/book', tocUrl: '/toc', book: { title: book.title, author: book.author }, continuationVariables: [],
    entries: [0, 324].map(index => ({ index, title: `Chapter ${index}`, url: `/chapter/${index}`, variables: [] })) };
  const context = { bodyVersion: 'body', processingVersion: 'p', anchors: [{ id: 'a', offset: 17 }] };
  const chapter = { ...identity, chapterIndex: 324, chapterUrl: '/chapter/324', chapterTitle: 'Chapter 324',
    bodyVersion: context.bodyVersion, processingVersion: context.processingVersion, contentVersion: 'materialized',
    content: 'Chapter body', images: [], extractionVia: 'rule' };
  let mountedRuntime;
  const Host = compileHost(undefined, {
    ReaderRuntimeOwner: { isCurrent: owner => owner === mountedRuntime },
    RemoteReadingFlowGateway: class {
      constructor(owner) { this.owner = owner; }
      loadChapter(...args) { return this.owner.loadChapter(...args); }
    },
  });
  const Entry = actualReadingEntryPresentation({ ReadingEntryHost: Host });

  function bind(candidate, loadChapter) {
    const runtime = { loadChapter, bookAcquisitions: () => ({ readingProjectionRevision: () => 0, setPreparationVisible() {} }) };
    mountedRuntime = runtime;
    const entry = Object.assign(new Entry(), { book, toc: session.entries, session: candidate });
    let active = true;
    const ports = { current: () => active, projectionVisible: () => true, offlineGeneration: () => 0,
      membership: () => ({ generation: 0, blocked: false, value: false }),
      cacheDecision: () => assert.fail('a chapter probe cannot require cache recovery'), notice: () => {}, refreshShelf: () => {} };
    entry.bindReader(runtime, ports);
    return { entry, runtime, host: entry.host, retireLease() { active = false; } };
  }

  for (const active of [false, true]) for (const mismatch of [undefined, 'sourceId', 'bookId']) for (const matchingScope of [false, true]) {
    const calls = [];
    const candidate = mismatch === undefined ? session : { ...session, identity: { ...identity, [mismatch]: 'other' } };
    const binding = bind(candidate, async (admitted, index, current, forceRefresh, position) => {
      calls.push([admitted.identity, index, current(), forceRefresh, position]);
      return chapter;
    });
    if (!active) binding.retireLease();
    const scope = binding.entry.scopeId + (matchingScope ? 0 : 1);
    const result = await binding.host.probe(scope, 324, context);
    const accepted = active && mismatch === undefined && matchingScope;
    assert.equal(result, accepted ? 324 : undefined);
    assert.deepEqual(calls, accepted ? [[identity, 324, true, false, context]] : [],
      'only the exact bound book and current scope may forward the chapter and captured position');
    if (accepted) assert.deepEqual(binding.entry.session.preparedChapter.positionContext, context);
  }

  let resolveChapter, pendingCurrent, forwardedPosition;
  const binding = bind(session, (_session, _chapter, current, _forceRefresh, position) => {
    pendingCurrent = current;
    forwardedPosition = position;
    return new Promise(resolve => { resolveChapter = resolve; });
  });
  const supplied = { ...context, anchors: context.anchors.map(anchor => ({ ...anchor })) };
  const pending = binding.host.probe(binding.entry.scopeId, 324, supplied);
  assert.equal(pendingCurrent(), true);
  supplied.anchors[0].offset = 42;
  assert.deepEqual(forwardedPosition, context, 'an in-flight chapter probe retains the captured position');
  binding.entry.installSession(binding.runtime, { ...session, contextVersion: 'x2' },
    () => assert.fail('same-book context changes keep the existing Host scope'));
  assert.equal(pendingCurrent(), false, 'replaced session evidence revokes the in-flight read');
  resolveChapter(chapter);
  assert.equal(await pending, undefined);
  assert.equal(binding.entry.session.contextVersion, 'x2');
  assert.equal(binding.entry.session.preparedChapter, undefined);

}

async function case_source_switch_route() {
  const { default: assert } = await import('node:assert/strict');
  const { fileURLToPath } = await import('node:url');
  const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
  const { actualReadingEntryPresentation } = await import('./lib/reading-entry-presentation-probe.mjs');
  const { actualSourceSwitchPresentation } = await import('./lib/source-switch-presentation-probe.mjs');
  const { ReaderNavigation } = await import('../entry/src/main/ets/app/navigation/ReaderNavigation.ts');
  const { ReaderSourceSwitchJourney } = await import('../entry/src/main/ets/app/composition/ReaderSourceSwitchJourney.ts');
  const indexFile = fileURLToPath(new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url));
  const Index = selectedProductionMethods(indexFile, 'Index', [
    'openSourceSwitch', 'openDetailSourceSwitch', 'sourceSwitchJourneyPorts', 'navigateTo', 'publishNavigation',
  ]);
  const ReadingEntry = actualReadingEntryPresentation();

  for (const route of ['reader-fallback', 'reading', 'detail', 'directory']) {
    const calls = [], runtime = {};
    const book = { sourceId: 's', bookId: 'b', title: 'Book', author: 'Writer' };
    const host = {
      owns: owner => owner === runtime,
      current: () => ({ scopeId: 0 }),
      retire() {},
      open(context, lease) { calls.push(['open', context.query.bookId, lease.isCurrent(book)]); },
    };
    const SourceSwitch = actualSourceSwitchPresentation({
      ReaderRuntimeOwner: { isCurrent: owner => owner === runtime },
      SourceSwitchHost: { forRuntime: () => host },
    });
    const page = Object.assign(new Index(), {
      mountedRuntimeOwner: runtime, shelfReceiptRetired: false, detailShelfAdmissionMount: 1,
      readingEntry: Object.assign(new ReadingEntry(), { book, sessionActive: route === 'reading' }),
      navigationOwner: new ReaderNavigation(), sourceSwitchPresentation: new SourceSwitch(),
      mangaSourceSwitch: { selectionVisible: false }, shelfMutations: { snapshot: { removalKey: '' } },
      shelfRead: { snapshot: { books: [] } },
      bookRemovalConfirmation: { dismiss() {} }, jsonImportPresentation: { dismiss() {} },
      nextNavigationGeneration() {
        calls.push('navigation');
        this.sourceSwitchPresentation.retire();
        this.publishNavigation(this.navigationOwner.advance());
      },
      bindReadingEntryReader: () => calls.push('bind'),
      returnToReadingOrigin: () => calls.push('origin'),
    });
    page.sourceSwitchJourney = new ReaderSourceSwitchJourney(page.navigationOwner, page.sourceSwitchJourneyPorts());
    if (route === 'reader-fallback') {
      page.navigateTo('detail');
      page.sourceSwitchJourney.openDetail = () => calls.push('detail');
      page.openSourceSwitch();
      assert.deepEqual(calls, ['origin', 'detail']);
      continue;
    }
    page.navigateTo(route);
    if (route === 'reading') page.openSourceSwitch();
    else page.openDetailSourceSwitch();
    const expected = route === 'directory' ? [] : ['navigation', 'bind'];
    assert.deepEqual(calls, [...expected, ['open', 'b', true]]);
    assert.equal(page.route, route);
    assert.equal(page.navigationGeneration, route === 'directory' ? 0 : 1);
  }

}

const implementations = {'late-identity':case_late_identity,'retained-failure-owner':case_retained_failure_owner,'probe-chapter-context':case_probe_chapter_context,'source-switch-route':case_source_switch_route};
for (const id of selectContractCases(CONTRACT_CASES)) {
  await implementations[id]();
  recordContractCasePass(id);
}

export const coverageAdoption = [{target:'H-reader-recoverable-entry#failure-actions-input',protects:'Actual SDK retry/settings/source action callbacks and retained input arena'}];
