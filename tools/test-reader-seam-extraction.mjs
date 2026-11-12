import assert from 'node:assert/strict';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
const definitions = {
  'measurement-facts': { description: 'Actual scalar facts and SDK LineMetrics adapter preserve units/proofs', resources: [] },
  'presentation-models': { description: 'Actual retained/selection/prepared models preserve page/gateway/lease identity', resources: [] },
  'preparation-coordination': { description: 'Actual queue coordinator and LRE wrapper retain retry/generation/visible boundaries', resources: [] },
  'control-minimum': { description: 'Actual minimum measurement and receipt selection reject stale/mismatched facts', resources: [] },
};
const selected = selectContractCases(definitions);
for (const id of selected) {
  const { readingSource, readerP1Module, readerP1Methods, readerExperienceDeclarationSource } = await import('./lib/reader-p1-seam-probe.mjs');
  if (id === 'measurement-facts') {
    const { CoreReadingAnchor, InitialReadingToc, CoreReadingLayout } = await import('../entry/src/main/ets/features/reading/application/ReadingMeasurementFacts.ts');
    const proof = { catalogVersion: 'exact' }, entries = [{ index: 1 }];
    const anchor = new CoreReadingAnchor(1, 3, .25, 'body', 'processing', proof);
    assert.equal(anchor.chapterOffset, 3); assert.equal(anchor.directoryTargetProof, proof);
    assert.equal(anchor.bodyVersion, 'body'); assert.equal(anchor.processingVersion, 'processing');
    assert.equal(new InitialReadingToc('book', entries).entries, entries);
    assert.deepEqual({ ...new CoreReadingLayout(390, 844, 1.2, 27) }, { viewportWidth: 390, viewportHeight: 844, fontScale: 1.2, lineHeight: 27 });
    const { ArkUILineMetric } = readerP1Module('ui/ReaderArkUILineMetric.ets', {}, ['ArkUILineMetric']);
    const metric = new ArkUILineMetric({ startIndex: 1, endIndex: 3 }, 20, 2, 100, 15);
    assert.deepEqual({ ...metric }, { startIndex: 1, endIndex: 3, height: 20, topHeight: 2, width: 100, baseline: 15 });
    assert.doesNotMatch(readingSource('application/ReadingMeasurementFacts.ts'), /@ohos|@kit|\.\.\/ui\/|LineMetrics|TextController/);
    const source = readingSource('ui/LocalReadingExperience.ets');
    assert.match(source, /from '\.\.\/application\/ReadingMeasurementFacts'/);
    assert.match(source, /new ArkUILineMetric\(/);
    assert.doesNotMatch(source, /class (CoreReadingAnchor|ArkUILineMetric)/);
  } else if (id === 'presentation-models') {
    const names = ['ReaderMaterializedChapterContext', 'ReaderRetainedPresentation', 'ReaderControlSelectionOrigin',
      'ReaderControlSelectionCandidate', 'PreparedReaderPageTurn', 'ReaderPageTurnPreparation', 'ReaderDeferredChapterSelection'];
    const model = readerP1Module('presentation/ReaderPagePresentationModels.ets', {}, names);
    const chapter = { chapterIndex: 1 }, map = {}, ranges = [], draft = {}, page = {}, gateway = {}, progress = {}, navigation = {};
    const context = new model.ReaderMaterializedChapterContext(chapter, map, 'v1', ranges, draft, 3, .3, -1);
    for (const [field, value] of Object.entries({ chapter, layoutMap: map, paragraphRanges: ranges, paginationDraft: draft })) assert.equal(context[field], value);
    const current = () => true;
    const retained = new model.ReaderRetainedPresentation('s', 'b', gateway, context, page, ranges, progress, 'a', 's', 'l', 2, current, navigation);
    for (const [field, value] of Object.entries({ gateway, context, page, progress, isCurrent: current, navigation })) assert.equal(retained[field], value);
    assert.equal(new model.PreparedReaderPageTurn('next', page, context, {}, 1, 3, 8).page, page);
    assert.equal(new model.ReaderControlSelectionOrigin(context, page, progress, 3, false, 'l').committedProgress, progress);
    assert.equal(new model.ReaderControlSelectionCandidate(context, page, false, 'l').context, context);
    const lease = { revision: 4 }, scope = {};
    const deferred = new model.ReaderDeferredChapterSelection(2, 4, false, true, .3, 5, true, false, scope, lease);
    assert.equal(deferred.ttsOwner, lease); assert.equal(deferred.positionContext, scope);
    const { ReadingEntryHandoff } = await import('../entry/src/main/ets/features/reading/application/ReadingEntryHandoff.ts');
    const releases = [], owner = { optionalReadingEntryMemoryEnabled: () => true };
    const host = readerP1Module('presentation/ReaderRetainedPresentationHost.ets', {
      ReadingEntryHandoff, ReaderRuntimeOwner: { current: () => owner },
      registerReadingEntryMemoryRelease: (runtime, release) => { assert.equal(runtime, owner); releases.push(release); },
    }, ['readingEntryHandoff', 'readerEntryPresentation']);
    const handoff = host.readingEntryHandoff(owner);
    assert.equal(host.readingEntryHandoff(owner), handoff); assert.equal(releases.length, 1);
    handoff.publish('s', 'b', retained, 100, current);
    assert.equal(host.readerEntryPresentation('s', 'b'), retained);
    releases[0](); assert.equal(host.readerEntryPresentation('s', 'b'), undefined);
    const { admitReaderControlVisualSnapshot } = await import('../entry/src/main/ets/features/reading/ui/ReaderControlVisualHostPort.ts');
    const { createReaderControlSessionState } = await import('../entry/src/main/ets/features/reading/ui/ReaderControlSessionState.ts');
    const semantic = createReaderControlSessionState(), observations = [];
    let presented = true, captured;
    admitReaderControlVisualSnapshot(semantic, {
      presentedForWindow: () => presented,
      capture: value => { captured = value; presented = false; observations.push('capture'); },
      closing: value => observations.push(['closing', value]), chromeOwnerChanged: () => observations.push('chrome'),
    });
    assert.notEqual(captured, semantic, 'host keeps a decision snapshot, never writes the runtime object');
    assert.deepEqual(captured, semantic); assert.equal(observations.at(-1), 'chrome');
    const unchanged = [];
    admitReaderControlVisualSnapshot(semantic, { presentedForWindow: () => false, capture() {}, closing() {}, chromeOwnerChanged: () => unchanged.push('chrome') });
    assert.deepEqual(unchanged, [], 'samples with unchanged ownership cannot reacquire window policy');
    const source = readingSource('ui/LocalReadingExperience.ets');
    assert.match(source, /export \{ ReaderRetainedPresentation \} from '\.\.\/presentation\/ReaderPagePresentationModels'/);
    assert.doesNotMatch(source, /class (PreparedReaderPageTurn|ReaderRetainedPresentation)/);
    assert.ok(readerExperienceDeclarationSource().includes('class PreparedReaderPageTurn'),
      'declaration fixtures link the actual production class; fixture transport removes export syntax');
  } else if (id === 'preparation-coordination') {
    const { drainReaderPagePreparation } = await import('../entry/src/main/ets/features/reading/ui/ReaderPagePreparationCoordinator.ts');
    const queue = ['previous', 'next'], events = [];
    drainReaderPagePreparation({ renderWorkBlocked: () => false, laneBlocked: () => false,
      take: () => queue.shift(), ready: direction => direction === 'previous',
      prepare: direction => { events.push(direction); return 'begun'; }, idle: () => events.push('idle'),
      begun: () => events.push('begun'), retry: () => assert.fail('ready lane must not retry') });
    assert.deepEqual(events, ['next', 'begun']); assert.deepEqual(queue, []);
    const callbacks = [], cleared = [], noops = () => {};
    const Owner = readerP1Methods('ui/LocalReadingExperience.ets', ['drainPageTurnPreparationQueue', 'retryPageTurnPreparation', 'cancelPageTurnPreparationRetry'], {
      drainReaderPagePreparation, readerPageTransitionUsesPreparedPages: () => true,
      PAGE_TURN_PREPARATION_RETRY_LIMIT: 16, PAGE_TURN_PREPARATION_RETRY_BASE_MS: 250, PAGE_TURN_PREPARATION_RETRY_MAX_MS: 2000,
      setTimeout: (callback, delay) => { callbacks.push({ callback, delay }); return callbacks.length; }, clearTimeout: handle => cleared.push(handle),
    });
    const owner = Object.assign(new Owner(), { pageTurnPreparationQueue: ['next'], pageTurnGestureState: { phase: 'idle' },
      readerSettingsSnapshot: {}, pageTurnPreparationRetryTimer: -1, pageTurnPreparationRetryCount: 0,
      pageTurnGeneration: 2, chapterSelectionToken: 3, sessionLaunchRenderWorkBlocked: () => false,
      canTurnPage: () => true, preparedPageTurn: () => undefined, adjacentPageTurnTarget: () => ({}),
      beginPageTurnPreparation: () => 'retry', scheduleBookTurnTextureRefresh: noops });
    owner.drainPageTurnPreparationQueue(); assert.deepEqual(owner.pageTurnPreparationQueue, ['next']);
    assert.equal(callbacks[0].delay, 250); assert.equal(owner.pageTurnPreparationRetryCount, 1);
    owner.pageTurnGeneration++; callbacks[0].callback(); assert.deepEqual(owner.pageTurnPreparationQueue, []);
    assert.equal(owner.pageTurnPreparationRetryCount, 0, 'old preparation cannot continue on successor generation');
    owner.pageTurnPreparationQueue = ['previous']; owner.pageTurnGestureState.phase = 'dragging';
    owner.drainPageTurnPreparationQueue(); assert.deepEqual(owner.pageTurnPreparationQueue, ['previous']);
    owner.pageTurnGestureState.phase = 'idle'; owner.beginPageTurnPreparation = () => 'begun';
    owner.pageTurnPreparationRetryTimer = 42; owner.drainPageTurnPreparationQueue(); assert.deepEqual(cleared, [42]);
    assert.equal(owner.pageTurnPreparationQueue.length, 0);
    for (const outcome of ['wait', 'abandon']) {
      let reads = 0, idle = 0;
      drainReaderPagePreparation({ renderWorkBlocked: () => false, laneBlocked: () => false,
        take: () => reads++ === 0 ? 'next' : undefined, ready: () => false, prepare: () => outcome,
        idle: () => idle++, begun: () => assert.fail(), retry: () => assert.fail() });
      assert.equal(idle, outcome === 'abandon' ? 1 : 0);
    }
  } else if (id === 'control-minimum') {
    const { measureReaderControlMinimumCandidates } = await import('../entry/src/main/ets/features/reading/ui/ReaderControlMinimumReceipt.ts');
    const widths = [280, 300].map(panelWidthVp => ({ panelWidthVp, quickContentWidthVp: panelWidthVp - 40, fullContentWidthVp: panelWidthVp - 20 }));
    const make = (width, key) => ({ key, widths: width });
    assert.equal(measureReaderControlMinimumCandidates(widths, 'owner', 2, make, () => true).length, 1);
    assert.deepEqual(measureReaderControlMinimumCandidates(widths, 'owner', 2, (width, key) => ({ ...make(width, key), key: 'old' }), () => true), []);
    assert.deepEqual(measureReaderControlMinimumCandidates(widths, 'owner', 2, (width, key) => ({ key, widths: { ...width, fullContentWidthVp: 9 } }), () => true), []);
    const geometry = await import('../entry/src/main/ets/features/reading/ui/ReaderControlGeometry.ts');
    const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
    let missing = false;
    const actual = readerP1Module('ui/ReaderControlMinimumMeasurement.ets', { ...geometry, ...readerTypographyRoles,
      TOK_BORDER_W: .5, measureReaderControlText: () => missing ? undefined : ({ heightVp: 20, singleLineWidthVp: 30 }),
    }, ['measureReaderControlMinimum']).measureReaderControlMinimum;
    const input = { context: {}, headerInter: false, title: '目录', identity: 'owner', metricsRevision: 7,
      measureHomeForm: () => ({ minimumHeight: 150, minWidth: 100, fits: true }) };
    const delegate = () => ({ module: 'directory', quick: { heightVp: 180, minWidthVp: 120, fits: true }, full: { heightVp: 250, minWidthVp: 120, fits: true } });
    const value = actual(input, 'directory', widths[0], 'owner|2|280', delegate);
    assert.equal(value.profile.identity, 'owner'); assert.equal(value.profile.metricsRevision, 7);
    assert.equal(value.candidate.key, 'owner|2|280'); assert.equal(value.candidate.minimum.full.heightVp, 250);
    assert.ok(value.candidate.minimum.quick.heightVp >= 180);
    assert.equal(actual(input, 'tts', widths[0], 'key', delegate), undefined, 'wrong module receipt must not fit another module');
    missing = true; assert.equal(actual(input, 'directory', widths[0], 'key', delegate), undefined, 'unmeasured font is not fallback success');
    const panel = readingSource('ui/ReaderControlPanel.ets'), lre = readingSource('ui/LocalReadingExperience.ets');
    assert.match(panel, /const measured = measureReaderControlMinimum\(/);
    assert.match(panel, /this\.minimumProfiles\.set\(key, measured\.profile\)/);
    assert.match(lre, /measureReaderControlMinimumCandidates\(widths, identity, generation, measure/);
    assert.match(lre, /generation !== this\.controlMinimumGeneration \|\| measure !== this\.controlMinimumProvider/);
  }
  recordContractCasePass(id);
}
