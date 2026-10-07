import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { boundedSurfaceSdk } from './lib/bounded-surface-sdk-probe.mjs';
import { sourceSwitchLiveSdk } from './lib/source-switch-sdk-consumer.mjs';
import { SourceSwitchCompletionPresentation } from '../entry/src/main/ets/features/source/SourceSwitchCompletionPresentation.ts';
import { SOURCE_SWITCH_VISUAL } from '../entry/src/main/ets/features/source/SourceSwitchVisual.ts';
import { bookshelfSourceDisplayName, readableBookshelfSourceName } from '../entry/src/main/ets/features/bookshelf/BookshelfSourceNameProjection.ts';
import { ReaderPhysicalPaginationOwner } from '../entry/src/main/ets/features/reading/ReaderPhysicalPaginationOwner.ts';
import { ReadingSurfaceLayoutMap } from '../entry/src/main/ets/features/reading/ReadingSurfaceLayoutMap.ts';
import { ReaderPageChromeSnapshot } from '../entry/src/main/ets/features/reading/ReaderPageChromeModel.ts';

const read = path => readFileSync(new URL(`../entry/src/main/ets/${path}`, import.meta.url), 'utf8');
const localSource = read('features/reading/LocalReadingExperience.ets');
const indexSource = read('pages/Index.ets');
const members = ['sourceSwitchCompletion', 'readingReadyGeneration', 'sourceSwitchCompletionVisible',
  'sourceSwitchRevealOpacity', 'sourceSwitchToastText', 'sourceSwitchVisualSelectionToken', 'sourceSwitchCompletionEpoch',
  'sourceSwitchRevealAnimator', 'sourceSwitchToastTimer', 'consumedSourceSwitchCompletions', 'phase',
  'sourceSwitchPresentedRevision', 'sourceSwitchPresentedSelectionToken', 'sourceSwitchPresentedContinuous',
  'sourceSwitchPendingCompletionKey', 'sourceSwitchPendingCompletionSelectionToken', 'sourceSwitchPendingCompletionLifecycleToken',
  'sourceSwitchCanonicalPageCurrent', 'sourceSwitchContinuousRangeObserver', 'onSourceSwitchPagePresented', 'hasContinuousRenderContent',
  'sourceSwitchCompletionKey', 'sourceSwitchCompletionCurrent', 'sourceSwitchCompletionDisplayCurrent',
  'finishSourceSwitchReveal', 'cancelSourceSwitchCompletion', 'sourceSwitchCompletionVisibleChanged',
  'sourceSwitchCompletionChanged', 'sourceSwitchCompletionWash', 'sourceSwitchCompletionToast'];

function fixture({ reduced = false, phase = 'ready', presented = true, extraMembers = [], extraDeps = {} } = {}) {
  const p = boundedSurfaceSdk({ allowEmptyBranchAdmission: true });
  let nextTimer = 0;
  const timers = new Map(), animators = [];
  const uiContext = { getFont: () => ({}), createAnimator(options) {
    const port = { options, plays: 0, cancels: 0, onFrame() {}, onFinish() {},
      play() { this.plays += 1; },
      cancel() { this.cancels += 1; this.onFrame(options.end); this.onFinish(); } };
    animators.push(port);
    return port;
  } };
  const deps = sourceSwitchLiveSdk(p, { uiContext,
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); }, ...extraDeps });
  const reader = p.consumer(localSource, [...members, ...extraMembers], deps);
  Object.assign(reader, { mounted: true, exitRequested: false, appForeground: true, reduceMotion: reduced,
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
  return { p, reader, deps, event, accept, timers, animators };
}

// Exercise the actual Index member, including its exact returned-finalized
// boundary. The unchanged canonical owner is a controlled port here; this
// test does not invent a Core ACK or prove native/compositor timing.
{
  const p = boundedSurfaceSdk();
  const page = p.consumer(indexSource, ['sourceSwitchCompletion', 'readingContentKind', 'sourceSwitchNamedCandidate', 'sourceDisplayName',
    'readingDetailForShelf', 'onPickSource', 'applyReadingCommit', 'nextNavigationGeneration'],
    { ...sourceSwitchLiveSdk(p), SourceSwitchCompletionPresentation, bookshelfSourceDisplayName, readableBookshelfSourceName });
  let acknowledged = false, cleanup = 0, finalizedCalls = 0;
  const finalized = { transactionId: 'confirmed', targetSourceId: 'target', targetBookId: 'book' };
  const selected = { sourceId: 'target', bookUrl: 'book', sourceName: '目标书源' };
  const pickKeys = [];
  Object.assign(page, { detailBook: { sourceId: 'target', bookId: 'book', sourceName: '书源名称暂不可用', contentKind: 'text' },
    sourceSwitchScopeId: 5, sourceSwitchVisible: true, sourceSwitchState: { kind: 'candidates', candidates: [selected] },
    sourceSwitchHost: { pick(candidate, scope) { pickKeys.push([candidate.sourceId, candidate.bookUrl, scope]); } },
    searchHost: { sources: () => [] }, sourceSources: [], sourceToolsSnapshot: { sources: [] },
    readingReadyGeneration: 7, readingContentKind: 'text', readingSessionActive: true, remoteReadingSession: undefined,
    getSourceSwitchHost: () => ({ targetCommitted(identity, id) {
      finalizedCalls += 1;
      assert.deepEqual(identity, { sourceId: 'target', bookId: 'book' });
      assert.equal(id, 'confirmed');
      return acknowledged ? finalized : undefined;
    } }), cleanupRetiredSourceCache() { cleanup += 1; }, consumeSystemFileOpen() {} });
  page.onPickSource({ ...selected, bookUrl: 'not-admitted', sourceName: '未准入名称' }, 5);
  assert.equal(page.sourceSwitchNamedCandidate, undefined, 'unpublished row metadata cannot enrich the reader');
  page.onPickSource(selected, 4);
  assert.equal(page.sourceSwitchNamedCandidate, undefined, 'stale picker scope cannot capture metadata');
  page.onPickSource(selected, 5);
  assert.equal(page.sourceDisplayName('target', '书源名称暂不可用'), '目标书源', 'exact selected-source metadata replaces the shelf placeholder');
  assert.equal(page.sourceDisplayName('other', '书源名称暂不可用'), '书源名称暂不可用', 'a different source cannot borrow its name');
  const detail = page.readingDetailForShelf({ sourceId: 'target', bookId: 'book', title: '目标书', sourceName: '书源名称暂不可用', contentKind: 'text' });
  assert.equal(detail.sourceName, '目标书源', 'control bar and reopened drawer share the same reader detail projection');
  const commit = { sourceId: 'target', bookId: 'book', sourceSwitchTransactionId: 'confirmed', chapterIndex: 2, chapterOffset: 0 };
  page.applyReadingCommit({ ...commit, sourceId: 'retired' });
  assert.equal(finalizedCalls, 0);
  page.applyReadingCommit(commit);
  assert.equal(page.sourceSwitchCompletion, undefined, 'an unaccepted receipt cannot display success');
  acknowledged = true;
  page.applyReadingCommit(commit);
  assert.equal(cleanup, 1);
  assert.deepEqual({ ...page.sourceSwitchCompletion }, { ...new SourceSwitchCompletionPresentation('confirmed', 'target', 'book', 7, '目标书源', 2, 0) });
  page.readingContentKind = 'manga';
  page.sourceSwitchCompletion = undefined;
  page.applyReadingCommit(commit);
  assert.equal(page.sourceSwitchCompletion, undefined, 'canonical manga fact never emits the novel view receipt');
  for (const name of ['retireSettingsPresentation', 'retireSourceManagementPresentation', 'retireSourceSwitchPresentation',
    'retireRssEditorPresentation', 'retireRssPresentation', 'retireReadingEntryPresentation', 'retireBookshelfCatalogPresentation']) page[name] = () => {};
  Object.assign(page, { bookshelfHost: { detachManagementPresentation() {} }, nativeAlertOwner: { retire() {} }, navigationGeneration: 1 });
  page.sourceSwitchCompletion = new SourceSwitchCompletionPresentation('confirmed', 'target', 'book', 7, '目标书源', 2, 0);
  page.nextNavigationGeneration();
  assert.equal(page.sourceSwitchCompletion, undefined, 'navigation retires the view event without replay');
}

{
  const x = fixture();
  x.accept(x.event('ready'));
  assert.equal(x.reader.phase, 'ready');
  assert.equal(x.reader.sourceSwitchToastText, '已切换至 目标书源');
  assert.equal(x.reader.sourceSwitchRevealOpacity, 1 - SOURCE_SWITCH_VISUAL.readerEnterFromOpacity);
  assert.equal(x.animators.length, 1);
  const animator = x.animators[0];
  assert.equal(animator.options.duration, SOURCE_SWITCH_VISUAL.readerEnterDurationMs);
  assert.equal(animator.options.end, 0);
  assert.equal(animator.options.iterations, 1);
  assert.equal([...x.timers.values()][0].delay, SOURCE_SWITCH_VISUAL.toastDurationMs);
  animator.onFrame(.25);
  assert.equal(x.reader.sourceSwitchRevealOpacity, .25);
  x.accept(x.event('ready')); // a fresh ArkUI DTO copy is the same event
  assert.equal(x.animators.length, 1);
  animator.onFrame(.1);
  assert.equal(x.reader.sourceSwitchRevealOpacity, .1, 'retained animation survives copied equal props');
  x.reader.sourceSwitchCompletionWash();
  x.reader.sourceSwitchCompletionToast();
  x.p.properties.flush();
  const overlays = x.p.walk(x.reader).filter(child => child instanceof x.deps.SourceSwitchCompletionOverlay);
  assert.equal(overlays.length, 2, 'actual wash and toast children are emitted');
  const toast = x.p.nodes(x.reader).find(node => node.type === 'Text' && node.create === '已切换至 目标书源');
  assert.equal(toast.fontSize, SOURCE_SWITCH_VISUAL.toastFontSize);
  assert.equal(toast.lineHeight, SOURCE_SWITCH_VISUAL.toastLineHeight);
  const paper = x.p.walk(x.reader).find(child => child instanceof x.deps.ReaderPaperBackground);
  assert.equal(paper.theme, 'warm', 'wash uses the actual visible reading paper');
  animator.onFinish();
  assert.equal(x.reader.sourceSwitchRevealOpacity, 0);
  [...x.timers.values()][0].callback();
  assert.equal(x.reader.sourceSwitchToastText, '');
  assert.equal(x.reader.phase, 'ready', 'visual clocks do not change business readiness');
}

for (const mutation of [reader => { reader.sourceId = 'retired'; }, reader => { reader.readingReadyGeneration = 8; },
  reader => { reader.visiblePageSelectionToken = 2; }, reader => { reader.visiblePage = { startScalar: 9 }; },
  reader => { reader.appForeground = false; }, reader => { reader.sourceSwitchCompletionVisible = false; }]) {
  const x = fixture(); mutation(x.reader); x.p.properties.flush(); x.accept(x.event('guarded'));
  assert.equal(x.animators.length, 0);
  assert.equal(x.reader.sourceSwitchToastText, '');
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
  assert.equal(x.reader.sourceSwitchToastText, '');
  x.reader.sourceSwitchCompletionVisible = true; x.p.properties.flush();
  assert.equal(x.animators.length, 1, 'retired event is consumed and cannot replay on return');
}

{
  const x = fixture(); x.accept(x.event('selection'));
  x.reader.chapterSelectionToken += 1;
  x.reader.visiblePageSelectionToken = x.reader.chapterSelectionToken;
  assert.equal(x.reader.sourceSwitchCompletionDisplayCurrent(), false, 'same-anchor successor selection immediately rejects the old view');
  x.animators[0].onFrame(.3);
  assert.equal(x.reader.sourceSwitchToastText, '');
  assert.equal(x.timers.size, 0);
}

{
  const x = fixture({ reduced: true }); x.accept(x.event('reduced'));
  assert.equal(x.animators.length, 0);
  assert.equal(x.reader.sourceSwitchRevealOpacity, 0);
  assert.equal(x.reader.sourceSwitchToastText, '已切换至 目标书源');
  assert.equal(x.timers.size, 1);
}

for (const mutation of [reader => { reader.chapterSelectionToken += 1; reader.visiblePageSelectionToken += 1; reader.materializedChapterSelectionToken += 1; },
  reader => { reader.lifecycleToken += 1; }]) {
  const x = fixture({ phase: 'loading', presented: false }); x.accept(x.event('pending-owner'));
  mutation(x.reader); x.reader.phase = 'ready'; x.p.properties.flush();
  x.reader.onSourceSwitchPagePresented(x.reader.pageTurnRenderRevision);
  assert.equal(x.animators.length, 0); assert.equal(x.timers.size, 0);
  assert.equal(x.reader.sourceSwitchToastText, '', 'same-anchor manual refresh/successor lifecycle cannot replay a pending old receipt');
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
  assert.equal(x.reader.sourceSwitchToastText, '', 'legacy/empty/obsolete model cannot emit a success notice');
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

// Execute the actual canonical first-page branch and the actual SDK-emitted
// resident-stage cache. The only progress authority here is a held controlled
// gateway receipt; this is model/SDK ordering proof, not a real Core/VM ACK.
{
  const require = createRequire(import.meta.url);
  const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
  const ts = require(`${sdk}/node_modules/typescript`), options = require(`${sdk}/lib/ets_checker.js`).compilerOptions;
  const actualClass = (source, name, deps = {}) => {
    const tree = ts.createSourceFile('/tmp/CompletionActualClasses.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    const declaration = tree.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === name);
    assert.ok(declaration, `actual production class ${name}`);
    return new Function(...Object.keys(deps), stripTypeScriptTypes(declaration.getText(tree)).replace(/^export /, '') + `;return ${name};`)(...Object.values(deps));
  };
  const stageSource = read('features/reading/ReaderPageTurnStage.ets');
  const ReaderPageTurnRenderPage = actualClass(stageSource, 'ReaderPageTurnRenderPage', { ReaderPageChromeSnapshot });
  const CoreReadingAnchor = actualClass(localSource, 'CoreReadingAnchor');
  const ReadingCommit = actualClass(localSource, 'ReadingCommit');
  const PhysicalReadingPage = actualClass(read('features/reading/ReadingMeasurementModels.ets'), 'PhysicalReadingPage');
  const ReadingSurfacePageFragment = actualClass(read('features/reading/ReadingSurface.ets'), 'ReadingSurfacePageFragment');
  const x = fixture({ phase: 'measuring', presented: false,
    extraDeps: { CoreReadingAnchor, ReadingCommit, ReaderPageTurnRenderPage },
    extraMembers: ['completeFirstPage', 'persistMeasuredCanonicalProgress', 'activeGateway', 'requireChapter', 'requireChapterLayoutMap',
      'isMeasurementCurrent', 'isSessionActive', 'isMountedToken', 'isSelectionCurrent', 'isSelectionActive',
      'resumeSupersededAppearanceMeasurement', 'isOrdinaryPageMeasurement', 'admitCommittedProgress', 'isChapterFirstPageStart', 'errorMessage',
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
  x.reader.onReadingCommitted = commit => {
    assert.equal(commit.sourceSwitchTransactionId, 'canonical');
    assert.ok(x.reader.pageTurnRenderRevision > before, 'canonical body invalidates the resident cache before its durable observer');
    x.accept(x.event('canonical'));
  };
  const completion = x.reader.completeFirstPage(page, generation, x.reader.chapterSelectionToken, x.reader.lifecycleToken);
  await Promise.resolve();
  assert.equal(x.reader.visiblePage, undefined); assert.equal(x.animators.length, 0);
  releaseReceipt({ chapterIndex: 2, chapterOffset: 0, chapterProgress: 0, sourceSwitchTransactionId: 'canonical',
    bodyVersion: 'fresh-body', processingVersion: 'fresh-processing' });
  await completion; x.p.properties.flush();
  assert.equal(x.reader.pageTurnRenderRevision, before + 1);
  assert.equal(stage.currentRenderPage().fragments.length, 0, 'unchanged revision reproduces the old cached empty tree');
  stage.contentRevision = x.reader.pageTurnRenderRevision; x.p.properties.flush();
  assert.equal(stage.currentRenderPage().fragments[0].text, x.reader.chapter.content, 'canonical revision delivers actual body to the resident stage');
  assert.equal(x.animators.length, 0, 'model publication alone is insufficient for success visual');
  x.reader.onSourceSwitchPagePresented(stage.currentRenderPage().renderRevision);
  assert.equal(x.animators.length, 1, 'current resident callback admits the already confirmed canonical receipt');
}

console.log('source switch completion visual: actual SDK receipt, guard, view and cancellation checks passed');
