import { readReaderExperienceFixture } from './lib/reader-experience-fixture-source.mjs';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"historical-definition": {"description": "仅显式历史message carrier witness；不作为runtime completion前置", "resources": []}, "ack-boundary": {"description": "实际Index finalized精确target/transaction接纳、小说与漫画分界及navigation退休", "resources": []}, "visual-clock": {"description": "实际reader已呈现receipt动效/notice/重复DTO/guard/取消/selection/reducedMotion", "resources": []}, "stage-order": {"description": "实际resident/continuous回调必须匹配本selection/lifecycle/body当前revision", "resources": []}, "canonical-stage": {"description": "实际completeFirstPage等待canonical progress ACK→revision→SDK resident stage→视觉准入", "resources": []}, "actor-clock-isolation": {"description": "两真实SDK actor独立动画与共享提示代次，旧回调不影响后继", "resources": []}};
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const { resolveEtsLoaderRoot, virtualFilePath } = await import('./lib/tool-environment.mjs');
const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createRequire, stripTypeScriptTypes } = await import('node:module');
const { AsyncLocalStorage } = await import('node:async_hooks');
const { boundedMembers, boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { sourceSwitchLiveSdk } = await import('./lib/source-switch-sdk-consumer.mjs');
const { SourceSwitchCompletionPresentation } = await import('../entry/src/main/ets/features/source/presentation/SourceSwitchCompletionPresentation.ts');
const { SOURCE_SWITCH_VISUAL } = await import('../entry/src/main/ets/features/source/ui/SourceSwitchVisual.ts');
const { bookshelfSourceDisplayName } = await import('../entry/src/main/ets/features/bookshelf/application/BookshelfSourceNameProjection.ts');
const { ReaderPhysicalPaginationOwner } = await import('../entry/src/main/ets/features/reading/ui/ReaderPhysicalPaginationOwner.ts');
const { ReadingSurfaceLayoutMap } = await import('../entry/src/main/ets/features/reading/application/ReadingSurfaceLayoutMap.ts');
const { ReaderPageChromeSnapshot } = await import('../entry/src/main/ets/features/reading/presentation/ReaderPageChromeModel.ts');
const {bookshelfOperationClass} = await import('./lib/bookshelf-operation-owner-probe.mjs');



const read = path => readReaderExperienceFixture(new URL(`../entry/src/main/ets/${path}`, import.meta.url), 'utf8');
const localSource = read('features/reading/ui/LocalReadingExperience.ets');
if(selectedCase==='historical-definition'){const {approvedTypographyContract}=await import('./lib/approved-manga-typography-carriers.mjs');assert.equal(approvedTypographyContract(read('features/source/ui/SourceSwitchCompletionOverlay.ets'),'features/source/ui/SourceSwitchCompletionOverlay.ets').registered,true);return;}
const members = ['sourceSwitchCompletion', 'readingReadyGeneration', 'sourceSwitchCompletionVisible',
  'sourceSwitchRevealOpacity', 'sourceSwitchVisualSelectionToken', 'sourceSwitchCompletionEpoch',
  'sourceSwitchRevealAnimator', 'consumedSourceSwitchCompletions', 'phase',
  'sourceSwitchPresentedRevision', 'sourceSwitchPresentedSelectionToken', 'sourceSwitchPresentedContinuous',
  'sourceSwitchPendingCompletionKey', 'sourceSwitchPendingCompletionSelectionToken', 'sourceSwitchPendingCompletionLifecycleToken',
  'sourceSwitchCanonicalPageCurrent', 'sourceSwitchContinuousRangeObserver', 'onSourceSwitchPagePresented', 'hasContinuousRenderContent',
  'sourceSwitchCompletionKey', 'sourceSwitchCompletionCurrent', 'sourceSwitchCompletionDisplayCurrent',
  'finishSourceSwitchReveal', 'cancelSourceSwitchCompletion', 'sourceSwitchCompletionVisibleChanged',
  'sourceSwitchCompletionChanged', 'sourceSwitchCompletionWash'];
const visualScope = new AsyncLocalStorage();
const {ReaderTransientFeedback, READER_FEEDBACK_EXTENDED_MS, READER_TRANSIENT_TOAST_STORAGE_KEY, retireReaderTransientToast} =
  bookshelfOperationClass('ui/feedback/ReaderTransientFeedback.ts',
    '({ReaderTransientFeedback, READER_FEEDBACK_EXTENDED_MS, READER_TRANSIENT_TOAST_STORAGE_KEY, retireReaderTransientToast})',
    {AppStorage: {get: key=>visualScope.getStore().feedbackStore.get(key),
      setOrCreate: (key,value)=>visualScope.getStore().feedbackStore.set(key,value)}});
let visualTemplate, visualEmissions = 0;
const visualActors = [];

function fixture({ reduced = false, phase = 'ready', presented = true, extraMembers = [], extraDeps = {}, feedbackStore = new Map() } = {}) {
  let nextTimer = 0;
  const timers = new Map(), animators = [];
  const uiContext = { getFont: () => ({}), createAnimator(options) {
    const port = { options, plays: 0, cancels: 0, onFrame() {}, onFinish() {},
      play() { this.plays += 1; },
      cancel() { this.cancels += 1; this.onFrame(options.end); this.onFinish(); } };
    animators.push(port);
    return port;
  } };
  const ports = { uiContext, feedbackStore,
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); } };
  const reusable = extraMembers.length === 0 && Object.keys(extraDeps).length === 0;
  let base, deps, reader;
  if (reusable && visualTemplate !== undefined) {
    ({ p: base, deps } = visualTemplate);
    reader = new visualTemplate.Component(undefined, {});
  } else {
    base = boundedSurfaceSdk({ allowEmptyBranchAdmission: true });
    const scoped = () => { const value = visualScope.getStore(); assert.ok(value, 'each native callback owns its independent visual ports'); return value; };
    deps = sourceSwitchLiveSdk(base, {
      READER_FEEDBACK_EXTENDED_MS,
      uiContext: new Proxy({}, { get: (_target, key) => (...args) => scoped().uiContext[key](...args) }),
      setTimeout(callback, delay) { const owner = scoped(); return owner.setTimeout(() => visualScope.run(owner, callback), delay); },
      clearTimeout(id) { scoped().clearTimeout(id); }, ...extraDeps });
    reader = visualScope.run(ports, () => base.consumer(localSource, [...members, ...extraMembers], deps));
    if (reusable) { visualEmissions++; visualTemplate = { p: base, deps, Component: reader.constructor }; }
  }
  // Only immutable SDK code is shared. Each actor keeps fresh property cells,
  // watches, native nodes and clock/animator ports. Bind even late callbacks to
  // their original ports rather than whichever scenario happens to run next.
  const originals = new Map();
  for (const name of [...members, ...extraMembers]) if (typeof reader[name] === 'function') {
    const method = reader[name]; originals.set(name, method);
    reader[name] = (...args) => visualScope.run(ports, () => method.apply(reader, args));
  }
  for (const [field, watch] of reader.watches) for (const [name, method] of originals)
    if (watch === method) reader.watches.set(field, reader[name]);
  reader.getUIContext = () => uiContext;
  const ownsPropertyActor = owner => {
    for (let current = owner; current !== undefined; current = current.owner)
      if (current === reader) return true;
    return false;
  };
  const p = { ...base, properties: { ...base.properties,
    flush: () => visualScope.run(ports, () => base.properties.flush(ownsPropertyActor)) } };
  for (const previous of visualActors) {
    assert.notEqual(reader, previous); assert.notEqual(reader.nodes, previous.nodes);
    assert.notEqual(reader.watches, previous.watches);
    assert.notEqual(reader.__sourceSwitchCompletion, previous.__sourceSwitchCompletion);
    assert.notEqual(reader.consumedSourceSwitchCompletions, previous.consumedSourceSwitchCompletions);
  }
  visualActors.push(reader);
  Object.assign(reader, { mounted: true, exitRequested: false, appForeground: true, reduceMotion: reduced,
    sourceSwitchFeedback: new ReaderTransientFeedback(),
    isReaderIdentityCurrent: () => true, sourceId: 'target', bookId: 'book', readingReadyGeneration: 7,
    sourceSwitchFailureMessage: '', sourceSwitchCompletionVisible: true, phase,
    visiblePage: { startScalar: 0 }, visibleFragments: [{ text: '真实正文', imageHeight: 0 }],
    chapter: { sourceId: 'target', bookId: 'book', chapterIndex: 2, chapterTitle: '当前章', content: '真实正文' },
    materializedChapterSelectionToken: 3, pageTurnRenderRevision: 2, continuousRenderRevision: 4,
    continuousFragments: [], readerSettingsSnapshot: { navigationMode: 'paged' },
    visiblePageSelectionToken: 3, chapterSelectionToken: 3, lifecycleToken: 5,
    visibleReadingAppearance: () => ({ activeTheme: 'warm' }), readingLayout: () => ({ widthClass: 'compact' }),
    readerWindowMetricsRevision: 0, readerStatusBarMetrics: () => deps.createDefaultReaderWindowMetrics() });
  p.properties.flush();
  if (presented) reader.onSourceSwitchPagePresented(reader.pageTurnRenderRevision);
  const event = id => new SourceSwitchCompletionPresentation(id, 'target', 'book', 7, '目标书源', 2, 0);
  const accept = value => { reader.sourceSwitchCompletion = value; p.properties.flush(); };
  const notice = () => {const state=feedbackStore.get(READER_TRANSIENT_TOAST_STORAGE_KEY);return state?.visible?state:undefined;};
  const retireNotice = () => visualScope.run(ports, () => retireReaderTransientToast(notice()?.generation ?? 0));
  return { p, reader, deps, event, accept, timers, animators, notice, retireNotice };
}

if(selectedCase==='ack-boundary'){
  // Deliver the canonical producer's receipt at the retained scene boundary.
  // The Runtime's pending-list and the cache IO are controlled fixture ports.
  const {fixture: ownerFixture, Runtime, settle, setCurrentRuntime} = await import('./lib/source-switch-owner-probe.mjs');
  const {createReaderBuilderProbe} = await import('./lib/reader-control-builder-probe.mjs');
  const {ReaderNavigation} = await import('../entry/src/main/ets/app/navigation/ReaderNavigation.ts');
  const {readerSourceSwitchActions} = await import('../entry/src/main/ets/app/composition/ReaderSourceSwitchActions.ts');
  const {ReaderSourceSwitchJourney} = await import('../entry/src/main/ets/app/composition/ReaderSourceSwitchJourney.ts');
  const {readerDirectoryActions} = await import('../entry/src/main/ets/features/reading/presentation/ReaderDirectoryActions.ts');
  const ReaderReadingEntryActions = bookshelfOperationClass('app/composition/ReaderReadingEntryActions.ets',
    'ReaderReadingEntryActions', {Observed: value => value});
  const ReadingCommitPresentation = bookshelfOperationClass('features/reading/presentation/ReadingCommitPresentation.ets',
    'ReadingCommitPresentation', {Observed: value => value, SourceSwitchCompletionPresentation});
  const p = boundedSurfaceSdk();
  const identity = {sourceId: 'target', bookId: 'book'};
  const origin = {sourceId: 'old', bookId: 'old-book'};
  const pending = {transactionId: 'confirmed', fromSourceId: origin.sourceId, fromBookId: origin.bookId,
    targetSourceId: identity.sourceId, targetBookId: identity.bookId};
  const owner = ownerFixture({open: false, shared: true, pending: [pending]});
  owner.runtime.supportsCoreCapability = () => false;
  const cleanup = [];
  const offline = {snapshot: () => undefined, busy: () => false,
    async cleanupRetiredSource(book) { cleanup.push(book); }};
  const page = p.consumer(read('pages/Index.ets'), ['navigationOwner', 'publishNavigation', 'nextNavigationGeneration',
    'isCurrentRuntime', 'jsonImportPresentation', 'readingCommits', 'readingCommitPorts', 'sourceSwitchActions',
    'retainedReaderPorts', 'directoryNavigationPorts', 'currentReadingRuntime', 'resolveReaderSourceSwitchTransaction',
    'getSourceSwitchHost', 'retireSourceSwitchPresentation', 'sourceDisplayName',
    'readingEntryActions', 'readingEntryActionPorts', 'sourceSwitchJourney', 'sourceSwitchJourneyPorts'],
    {ReaderNavigation, ReadingCommitPresentation, readerSourceSwitchActions, ReaderSourceSwitchJourney, ReaderReadingEntryActions, ReaderRuntimeOwner: Runtime,
      SourceSwitchHost: owner.Constructor, ReadingOfflineHost: {forRuntime: () => offline}});
  const lifetime = {retire() {}};
  const manga = {retire() {}, canCancelPreparation: () => false};
  Object.assign(page, {mountedRuntimeOwner: owner.runtime, shelfReceiptRetired: false, detailShelfAdmissionMount: 1,
    searchAppForeground: true, libraryAcquisition: {currentOwner: () => owner.runtime},
    shelfMotion: {clear() {}}, transientFeedback: {reset() {}}, downloadPresentation: lifetime,
    settingsPresentation: lifetime, sourceJourney: lifetime, rssJourney: lifetime, shelfCatalog: lifetime,
    shelfMutations: {retireSelection() {}}, shelfManagement: lifetime, shelfGroupPresentation: lifetime,
    discoverPresentation: lifetime, rulesPresentation: lifetime, syncPresentation: lifetime, nativeAlertOwner: lifetime,
    mangaSourceSwitch: manga, consumeSystemFileOpen() {},
    shelfRead: {snapshot: {books: []},
      sourceDisplayName: (sourceId, name, candidate) => bookshelfSourceDisplayName(sourceId, name, [], candidate)}});
  page.publishNavigation(page.navigationOwner.show('reading'));
  const book = {...identity, title: '目标书', author: '作者', sourceName: '书源名称暂不可用', contentKind: 'text'};
  const entry = page.readingEntry, source = page.sourceSwitchPresentation;
  Object.assign(entry, {book, sessionActive: true, readyGeneration: 7});
  assert.equal(page.getSourceSwitchHost(), owner.host);

  class ReaderShellPort {
    constructor(parent, params, _storage, id) { Object.assign(this, {owner: parent, params, id}); }
  }
  const sceneSource = read('app/composition/RetainedReaderScene.ets');
  const sceneParams = () => ({reading: entry, commits: page.readingCommits, source, manga,
    visibleRoute: 'reading', ports: page.retainedReaderPorts()});
  const {Component: RetainedReaderScene} = createReaderBuilderProbe(sceneSource, boundedMembers(sceneSource),
    {...p.deps, ReaderShell: ReaderShellPort, readerDirectoryActions}, {...p.hooks, initialParams: sceneParams(),
      childSources: {...p.childSources, ReaderShell: read('features/reading/ui/ReaderShell.ets')}});
  const render = () => {
    const scene = new RetainedReaderScene(undefined, sceneParams());
    scene.initialRender();
    return [...scene.children.values()].find(child => child instanceof ReaderShellPort).params;
  };
  try {
    const previewShell = render();
    const selected = {sourceId: identity.sourceId, bookUrl: identity.bookId, sourceName: '目标书源', sourceVersion: 'v1'};
    Object.assign(source, {scopeId: 5, visible: true, state: {kind: 'candidates', candidates: [selected]}});
    previewShell.onPickSource({...selected, bookUrl: 'not-admitted', sourceName: '未准入名称'}, 5);
    assert.equal(source.namedCandidate, undefined, 'unpublished row metadata cannot enrich the reader');
    previewShell.onPickSource(selected, 4);
    assert.equal(source.namedCandidate, undefined, 'stale picker scope cannot capture metadata');
    previewShell.onPickSource(selected, 5);
    assert.equal(page.sourceDisplayName('target', book.sourceName), '目标书源');
    assert.equal(page.sourceDisplayName('other', book.sourceName), book.sourceName, 'other sources cannot borrow the label');
    assert.equal(page.sourceSwitchJourney.workflow().detailForShelf(book).sourceName, '目标书源', 'reopened detail shares the source-name projection');

    const previewCommit = {...identity, chapterIndex: 2, chapterOffset: 0};
    const commit = {...previewCommit, sourceSwitchTransactionId: pending.transactionId};
    assert.equal(previewShell.sourceSwitchTransactionId, undefined);
    previewShell.onReadingCommitted(previewCommit);
    previewShell.onReadingCommitted(commit);
    assert.equal(render().sourceSwitchCompletion, undefined, 'preview and a receipt without a bound transaction stay silent');
    assert.deepEqual(cleanup, []);

    assert.equal(await previewShell.resolveSourceSwitchTransactionId(identity.sourceId, identity.bookId), pending.transactionId);
    const confirmedShell = render();
    assert.equal(confirmedShell.sourceSwitchTransactionId, pending.transactionId);
    confirmedShell.onReadingCommitted({...commit, sourceId: 'retired'});
    confirmedShell.onReadingCommitted({...commit, bookId: 'another-book'});
    confirmedShell.onReadingCommitted({...commit, sourceSwitchTransactionId: 'older'});
    entry.book = {...book, bookId: 'another-book'};
    render().onReadingCommitted({...commit, bookId: 'another-book'});
    entry.book = book;
    assert.equal(render().sourceSwitchCompletion, undefined, 'stale target or transaction cannot display completion');
    assert.equal(owner.host.currentTransactionId(identity), pending.transactionId, 'the current transaction remains pending');
    assert.deepEqual(cleanup, []);

    confirmedShell.onReadingCommitted(commit);
    assert.deepEqual(cleanup, [origin]);
    assert.deepEqual({...render().sourceSwitchCompletion}, {...new SourceSwitchCompletionPresentation(
      pending.transactionId, identity.sourceId, identity.bookId, 7, '目标书源', 2, 0)});
    assert.equal(owner.host.currentTransactionId(identity), undefined);

    page.nextNavigationGeneration();
    assert.equal(render().sourceSwitchCompletion, undefined, 'navigation retires the view event');
    confirmedShell.onReadingCommitted(commit);
    assert.equal(render().sourceSwitchCompletion, undefined, 'an old retained callback cannot replay a finalized receipt');
    assert.deepEqual(cleanup, [origin]);

    const mangaTarget = {...identity, bookId: 'manga-book'};
    const mangaPending = {...pending, transactionId: 'manga-confirmed', targetBookId: mangaTarget.bookId};
    owner.pending().push(mangaPending);
    Object.assign(entry, {contentKind: 'manga', book: {...book, ...mangaTarget, contentKind: 'manga'}});
    assert.equal(await render().resolveSourceSwitchTransactionId(mangaTarget.sourceId, mangaTarget.bookId), mangaPending.transactionId);
    const mangaShell = render();
    assert.equal(mangaShell.sourceSwitchTransactionId, mangaPending.transactionId);
    mangaShell.onReadingCommitted({...previewCommit, ...mangaTarget, sourceSwitchTransactionId: mangaPending.transactionId});
    assert.equal(owner.host.currentTransactionId(mangaTarget), undefined, 'the manga receipt still reaches its transaction owner');
    assert.deepEqual(cleanup, [origin, origin]);
    assert.equal(render().sourceSwitchCompletion, undefined, 'canonical manga never emits the novel view receipt');
    await settle();
  } finally {
    owner.host.retire();
    setCurrentRuntime(undefined);
  }
}
if(selectedCase==='visual-clock'){
{
  const x = fixture();
  x.accept(x.event('ready'));
  assert.equal(x.reader.phase, 'ready');
  assert.equal(x.notice()?.message, '已切换至 目标书源');
  assert.equal(x.notice()?.title, '书源已切换');
  assert.equal(x.notice()?.tone, 'success');
  assert.equal(x.reader.sourceSwitchRevealOpacity, 1 - SOURCE_SWITCH_VISUAL.readerEnterFromOpacity);
  assert.equal(x.animators.length, 1);
  const animator = x.animators[0];
  assert.equal(animator.options.duration, SOURCE_SWITCH_VISUAL.readerEnterDurationMs);
  assert.equal(animator.options.end, 0);
  assert.equal(animator.options.iterations, 1);
  assert.equal(x.notice()?.duration, READER_FEEDBACK_EXTENDED_MS);
  animator.onFrame(.25);
  assert.equal(x.reader.sourceSwitchRevealOpacity, .25);
  x.accept(x.event('ready')); // a fresh ArkUI DTO copy is the same event
  assert.equal(x.animators.length, 1);
  animator.onFrame(.1);
  assert.equal(x.reader.sourceSwitchRevealOpacity, .1, 'retained animation survives copied equal props');
  x.reader.sourceSwitchCompletionWash();
  x.p.properties.flush();
  const overlays = x.p.walk(x.reader).filter(child => child instanceof x.deps.SourceSwitchCompletionOverlay);
  assert.equal(overlays.length, 1, 'the reading subtree owns only the paper wash');
  const paper = x.p.walk(x.reader).find(child => child instanceof x.deps.ReaderPaperBackground);
  assert.equal(paper.theme, 'warm', 'wash uses the actual visible reading paper');
  animator.onFinish();
  assert.equal(x.reader.sourceSwitchRevealOpacity, 0);
  x.retireNotice();
  assert.equal(x.notice(), undefined);
  assert.equal(x.reader.phase, 'ready', 'visual clocks do not change business readiness');
}

for (const mutation of [reader => { reader.sourceId = 'retired'; }, reader => { reader.readingReadyGeneration = 8; },
  reader => { reader.visiblePageSelectionToken = 2; }, reader => { reader.visiblePage = { startScalar: 9 }; },
  reader => { reader.appForeground = false; }, reader => { reader.sourceSwitchCompletionVisible = false; }]) {
  const x = fixture(); mutation(x.reader); x.p.properties.flush(); x.accept(x.event('guarded'));
  assert.equal(x.animators.length, 0);
  assert.equal(x.notice(), undefined);
}

{
  const x = fixture({ phase: 'loading' });
  x.accept(x.event('deferred'));
  assert.equal(x.animators.length, 0, 'a canonical receipt cannot substitute for a ready visible page');
  x.reader.phase = 'ready'; x.p.properties.flush();
  assert.equal(x.animators.length, 0, 'phase ready alone cannot acknowledge a resident text page');
  x.reader.onSourceSwitchPagePresented(x.reader.pageTurnRenderRevision);
  assert.equal(x.animators.length, 1, 'the current resident revision callback admits the same receipt after reflow');
}

{
  const x = fixture(); x.accept(x.event('cancelled'));
  const animator = x.animators[0], lateFrame = animator.onFrame, lateFinish = animator.onFinish;
  x.reader.sourceSwitchCompletionVisible = false; x.p.properties.flush();
  assert.equal(animator.cancels, 1);
  assert.equal(x.timers.size, 0);
  lateFrame(.55); lateFinish();
  assert.equal(x.reader.sourceSwitchRevealOpacity, 0);
  assert.equal(x.notice(), undefined);
  x.reader.sourceSwitchCompletionVisible = true; x.p.properties.flush();
  assert.equal(x.animators.length, 1, 'retired event is consumed and cannot replay on return');
}

{
  const x = fixture(); x.accept(x.event('selection'));
  x.reader.chapterSelectionToken += 1;
  x.reader.visiblePageSelectionToken = x.reader.chapterSelectionToken;
  assert.equal(x.reader.sourceSwitchCompletionDisplayCurrent(), false, 'same-anchor successor selection immediately rejects the old view');
  x.animators[0].onFrame(.3);
  assert.equal(x.notice(), undefined);
  assert.equal(x.timers.size, 0);
}

{
  const x = fixture({ reduced: true }); x.accept(x.event('reduced'));
  assert.equal(x.animators.length, 0);
  assert.equal(x.reader.sourceSwitchRevealOpacity, 0);
  assert.equal(x.notice()?.message, '已切换至 目标书源');
  assert.equal(x.timers.size, 0, 'the reader has no local notice timer');
}


}
if(selectedCase==='stage-order'){
for (const mutation of [reader => { reader.chapterSelectionToken += 1; reader.visiblePageSelectionToken += 1; reader.materializedChapterSelectionToken += 1; },
  reader => { reader.lifecycleToken += 1; }]) {
  const x = fixture({ phase: 'loading', presented: false }); x.accept(x.event('pending-owner'));
  mutation(x.reader); x.reader.phase = 'ready'; x.p.properties.flush();
  x.reader.onSourceSwitchPagePresented(x.reader.pageTurnRenderRevision);
  assert.equal(x.animators.length, 0); assert.equal(x.timers.size, 0);
  assert.equal(x.notice(), undefined, 'same-anchor manual refresh/successor lifecycle cannot replay a pending old receipt');
}

// Reproduce the VM's early success independently from visual clocks: a true
// canonical receipt can arrive while the stage still holds its empty revision.
{
  const x = fixture({ presented: false }); x.accept(x.event('resident'));
  assert.equal(x.animators.length, 0); assert.equal(x.timers.size, 0);
  x.reader.onSourceSwitchPagePresented(x.reader.pageTurnRenderRevision - 1);
  assert.equal(x.animators.length, 0, 'an old resident slot callback cannot announce the new body');
  x.reader.onSourceSwitchPagePresented(x.reader.pageTurnRenderRevision);
  assert.equal(x.animators.length, 1);
}

{
  const x = fixture({ presented: false });
  x.reader.chapter.cacheRefreshRequired = true; x.accept(x.event('legacy-consumed'));
  x.reader.chapter.cacheRefreshRequired = false;
  x.reader.onSourceSwitchPagePresented(x.reader.pageTurnRenderRevision);
  assert.equal(x.animators.length, 0, 'later same-selection validation cannot revive a degraded-cache completion');
  assert.equal(x.timers.size, 0);
}

for (const mutation of [reader => { reader.chapter.cacheRefreshRequired = true; },
  reader => { reader.chapter.sourceCorrectionRequired = true; }, reader => { reader.chapter.content = '  '; },
  reader => { reader.chapter.sourceId = 'old'; }, reader => { reader.chapter.bookId = 'other'; },
  reader => { reader.materializedChapterSelectionToken = 2; },
  reader => { reader.visibleFragments = [{ text: '', imageHeight: 30 }]; },
  reader => { reader.visibleFragments = [{ text: 'not mounted', imageHeight: 0, nativeParagraph: {}, nativeParagraphFirst: false }]; }]) {
  const x = fixture({ presented: false }); mutation(x.reader); x.accept(x.event('unverified'));
  x.reader.onSourceSwitchPagePresented(x.reader.pageTurnRenderRevision);
  assert.equal(x.animators.length, 0); assert.equal(x.timers.size, 0);
  assert.equal(x.notice(), undefined, 'legacy/empty/obsolete model cannot emit a success notice');
}

{
  const x = fixture({ presented: false });
  x.reader.readerSettingsSnapshot = { navigationMode: 'continuous' };
  x.reader.continuousFragments = [{ text: '真实正文', imageHeight: 0 }];
  let visibleReports = 0;
  x.reader.onContinuousVisibleRangeChanged = () => { visibleReports += 1; };
  const stale = x.reader.sourceSwitchContinuousRangeObserver(x.reader.continuousRenderRevision - 1);
  const current = x.reader.sourceSwitchContinuousRangeObserver(x.reader.continuousRenderRevision);
  x.accept(x.event('continuous')); stale(0, 0, 0);
  assert.equal(x.animators.length, 0, 'an obsolete continuous layout callback cannot borrow the new revision');
  x.reader.onSourceSwitchPagePresented(x.reader.pageTurnRenderRevision);
  assert.equal(x.animators.length, 0, 'paged callbacks cannot acknowledge a mounted continuous stage');
  current(0, 0, 0);
  assert.equal(visibleReports, 2); assert.equal(x.animators.length, 1);
}


}
if(selectedCase==='canonical-stage'){
// Execute the actual canonical first-page branch and the actual SDK-emitted
// resident-stage cache. The only progress authority here is a held controlled
// gateway receipt; this is model/SDK ordering proof, not a real Core/VM ACK.
{
  const require = createRequire(import.meta.url);
  const sdk = resolveEtsLoaderRoot();
  const ts = require(`${sdk}/node_modules/typescript`), options = require(`${sdk}/lib/ets_checker.js`).compilerOptions;
  const actualClass = (source, name, deps = {}) => {
    const tree = ts.createSourceFile(virtualFilePath('CompletionActualClasses.ets'), source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    const declaration = tree.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === name);
    assert.ok(declaration, `actual production class ${name}`);
    return new Function(...Object.keys(deps), stripTypeScriptTypes(declaration.getText(tree)).replace(/^export /, '') + `;return ${name};`)(...Object.values(deps));
  };
  const stageSource = read('features/reading/ui/ReaderPageTurnStage.ets');
  const ReaderPageTurnRenderPage = actualClass(stageSource, 'ReaderPageTurnRenderPage', { ReaderPageChromeSnapshot });
  const CoreReadingAnchor = actualClass(localSource, 'CoreReadingAnchor');
  const ReadingCommit = actualClass(read('features/reading/application/ReadingCommit.ts'), 'ReadingCommit');
  const PhysicalReadingPage = actualClass(read('features/reading/ui/ReadingMeasurementModels.ets'), 'PhysicalReadingPage');
  const ReadingSurfacePageFragment = actualClass(read('features/reading/ui/ReadingSurface.ets'), 'ReadingSurfacePageFragment');
  const x = fixture({ phase: 'measuring', presented: false,
    extraDeps: { CoreReadingAnchor, ReadingCommit, ReaderPageTurnRenderPage },
    extraMembers: ['completeFirstPage', 'persistMeasuredCanonicalProgress', 'activeGateway', 'requireChapter', 'requireChapterLayoutMap',
      'isMeasurementCurrent', 'isSessionActive', 'isMountedToken', 'isSelectionCurrent', 'isSelectionActive',
      'resumeSupersededAppearanceMeasurement', 'isOrdinaryPageMeasurement', 'admitCommittedProgress', 'isChapterFirstPageStart', 'errorMessage',
      'readerRecoveryOwnerKey', 'showReaderRecovery', 'settleReaderRecovery',
      'readerRecoveryView', 'readerRecoveryActionLabel', 'readerRecoveryAction', 'readerRecoveryKind',
      'readerRecoveryIdentity', 'readerRecoveryProgressRevision', 'lastCommittedProgress',
      'retainedReadingRecencyReceipt', 'retainedReadingRecencyVisible', 'retainedReadingRecencySkipped',
      'currentPageTurnRenderPage'] });
  Object.assign(x.reader, { visiblePage: undefined, visibleFragments: [], sourceSwitchTransactionId: 'canonical',
    physicalPagination: new ReaderPhysicalPaginationOwner(), chapterLayoutMap: new ReadingSurfaceLayoutMap(x.reader.chapter.content),
    paragraphLayout: { ranges: [{ startScalar: 0 }] }, ordinaryPageMeasurementSelection: -1,
    paginationLayoutSignature: () => 'actual-layout', coreLayout: () => ({ viewportWidth: 390, viewportHeight: 844 }),
    pageTurnFrozenRevision: -1, materializedContentVersion: 'fresh-body',
    pageChromePaginationKey: () => undefined, pageChromeSnapshot: () => new ReaderPageChromeSnapshot(),
    pageBottomJustifyGap: () => 0, bookTurnTextureIdentity: () => 'current-texture', bookTurnSurfaceIdentity: () => 'current-page',
    releaseUnretainedReadingImages() {}, beginReadingRecordClock() {}, finishPageTurnPerf() {},
    cancelFirstPageReadyDeadline() {}, cancelFirstPageCompletionDeadline() {}, schedulePageTurnPreparation() {},
    completeControlSelectionAfterCommit() {}, notifyControlSelectionReadingReady: () => true,
    prefetchNextChapter() {}, completeRapidPageTurnTransaction() {}, drainRapidPageTurn() {}, onAutoPagePageCommitted() {},
    resumeDeferredMeasurement() {}, fail(error) { throw error; } });
  x.reader.chapter.bodyVersion = 'fresh-body'; x.reader.chapter.processingVersion = 'fresh-processing';
  x.reader.lastCommittedProgress = new ReadingCommit('target', 'book', 2, 0, 0,
    undefined, undefined, undefined, 'fresh-body', 'fresh-processing', 'progress:before');
  x.reader.showReaderRecovery('pending canonical progress', '', undefined, 'progress');
  x.p.properties.flush();
  assert.equal(x.reader.readerRecoveryView.visible, true, 'the real recovery helper owns the pending progress notice');
  let releaseReceipt;
  const receipt = new Promise(resolve => { releaseReceipt = resolve; });
  x.reader.sessionGateway = { hasPendingSourceSwitch: () => true,
    persistCanonicalProgress(_book, _title, anchor, _layout, current) {
      assert.equal(current(), true); assert.equal(anchor.bodyVersion, 'fresh-body'); return receipt;
    } };
  const before = x.reader.pageTurnRenderRevision;
  const stage = x.p.consumer(stageSource, ['contentRevision', 'currentPageProvider', 'previousPageProvider', 'nextPageProvider',
    'renderPagesRevision', 'cachedCurrentPage', 'cachedPreviousPage', 'cachedNextPage', 'emptyPage', 'refreshRenderPages', 'currentRenderPage'],
    { ReaderPageTurnRenderPage }, {}, 'ReaderPageTurnStage');
  stage.currentPageProvider = () => x.reader.currentPageTurnRenderPage();
  stage.contentRevision = before;
  assert.equal(stage.currentRenderPage().fragments.length, 0);
  const fragments = [new ReadingSurfacePageFragment('canonical-body', x.reader.chapter.content, true)];
  const page = new PhysicalReadingPage(fragments, 0, 4, 30, 700);
  const generation = x.reader.physicalPagination.index.beginMeasurement(x.reader.chapterSelectionToken);
  let committedObservers = 0;
  x.reader.onReadingCommitted = commit => {
    committedObservers += 1;
    assert.equal(commit.sourceSwitchTransactionId, 'canonical');
    assert.equal(commit.progressRevision, 'progress:confirmed');
    assert.equal(x.reader.readerRecoveryView.visible, false, 'the same-owner new receipt settles progress before its observer');
    assert.ok(x.reader.pageTurnRenderRevision > before, 'canonical body invalidates the resident cache before its durable observer');
    x.accept(x.event('canonical'));
  };
  const completion = x.reader.completeFirstPage(page, generation, x.reader.chapterSelectionToken, x.reader.lifecycleToken);
  await Promise.resolve();
  assert.equal(x.reader.visiblePage, undefined); assert.equal(x.animators.length, 0);
  assert.equal(committedObservers, 0); assert.equal(x.reader.readerRecoveryView.visible, true);
  releaseReceipt({ chapterIndex: 2, chapterOffset: 0, chapterProgress: 0, sourceSwitchTransactionId: 'canonical',
    bodyVersion: 'fresh-body', processingVersion: 'fresh-processing', progressRevision: 'progress:confirmed' });
  await completion; x.p.properties.flush();
  assert.equal(committedObservers, 1, 'the canonical receipt reaches its durable observer exactly once');
  assert.equal(x.reader.lastCommittedProgress.progressRevision, 'progress:confirmed');
  assert.equal(x.reader.readerRecoveryView.visible, false, 'the actual recovery helper admits the new progress revision');
  assert.equal(x.reader.pageTurnRenderRevision, before + 1);
  assert.equal(stage.currentRenderPage().fragments.length, 0, 'unchanged revision reproduces the old cached empty tree');
  stage.contentRevision = x.reader.pageTurnRenderRevision; x.p.properties.flush();
  assert.equal(stage.currentRenderPage().fragments[0].text, x.reader.chapter.content, 'canonical revision delivers actual body to the resident stage');
  assert.equal(x.animators.length, 0, 'model publication alone is insufficient for success visual');
  x.reader.onSourceSwitchPagePresented(stage.currentRenderPage().renderRevision);
  assert.equal(x.animators.length, 1, 'current resident callback admits the already confirmed canonical receipt');
}


}
if(selectedCase==='actor-clock-isolation'){
{
  const feedbackStore = new Map();
  const first = fixture({feedbackStore}), second = fixture({feedbackStore});
  first.accept(first.event('independent-first'));
  const firstGeneration = first.notice()?.generation;
  second.accept(second.event('independent-second'));
  const successor = second.notice();
  assert.ok(successor.generation > firstGeneration);
  const lateFirst = first.animators[0].onFinish;
  first.reader.sourceSwitchCompletionVisible = false; first.p.properties.flush();
  lateFirst();
  assert.equal(second.notice(), successor, 'retiring the old actor cannot clear the successor shared notice generation');
  assert.equal(second.animators[0].cancels, 0, 'native animator ports remain actor-local');
}

}
}
