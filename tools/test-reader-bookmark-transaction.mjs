import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const definitions = {
  transaction: {
    description: 'Production bookmark pull, pointer/rebound, original write ACK and read projection completion orders',
    resources: [],
  },
};
for (const id of selectContractCases(definitions)) {
  await runTransaction();
  recordContractCasePass(id);
}

async function runTransaction() {
  const { productionReaderMotionSdk } = await import('./lib/reader-control-builder-probe.mjs');
  const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
  const { measureReaderPageChromeText, readerPageChromeTopTextStyle } = await import('./lib/reader-page-chrome-measurement-probe.mjs');
  const { loadReaderTypographyRoles, readerMessageStyles } = await import('./lib/reader-typography-probe.mjs');
  const base = '../entry/src/main/ets/';
  const reading = base + 'features/reading/';
  const file = name => new URL(reading + 'ui/' + name, import.meta.url);
  const gesture = await import(reading + 'ui/ReaderPageGestureState.ts');
  const rapid = await import(reading + 'ui/ReaderRapidPageTurnState.ts');
  const { mergeReaderControlBookmarkProjection } = await import(reading + 'presentation/ReaderControlBookmarkLoad.ts');
  const resolution = registerHooks({ resolve(specifier, state, next) {
    try { return next(specifier, state); }
    catch (error) {
      if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
        return next(specifier + '.ts', state);
      }
      throw error;
    }
  } });
  try {
    const { ReaderRectVp: Rect, ReaderDisplayCornerVp: Corner, ReaderWindowMetricsSnapshot: Metrics } =
      await import(base + 'ui/foundation/ReaderWindowMetrics.ts');
    const { resolveReaderReadingLayout } = await import(reading + 'ui/ReaderLayoutGeometry.ts');
    const { readerAppearanceChromeTone } = await import(reading + 'ui/ReaderAppearanceRenderStyle.ts');
    const { readerRenderStageKind } = await import(reading + 'ui/ReaderRenderStageSpec.ts');
    const { readerAppColor } = await import(base + 'ui/foundation/ReaderThemeRegistry.ts');
    const chromeLayout = await import(reading + 'ui/ReaderPageChromeLayout.ts');
    const bookmarkModel = await import(reading + 'presentation/ReaderPageBookmarkModel.ts');
    const motion = productionReaderMotionSdk();
    const typography = readFileSync(new URL(base + 'ui/foundation/ReaderTypography.ets', import.meta.url), 'utf8');
    const { TYPE_READER_IMMERSIVE_TIME, TYPE_READER_IMMERSIVE_PROGRESS, TYPE_READER_IMMERSIVE_PAGE_ORDINAL } =
      loadReaderTypographyRoles(typography);
    const dependencies = { ...chromeLayout, ...bookmarkModel, ...readerMessageStyles, readerAppColor,
      TYPE_READER_IMMERSIVE_TIME, TYPE_READER_IMMERSIVE_PROGRESS, TYPE_READER_IMMERSIVE_PAGE_ORDINAL,
      measureReaderPageChromeText, readerPageChromeTopTextStyle, readerAppearanceChromeTone, readerRenderStageKind };
    const metrics = new Metrics();
    Object.assign(metrics, { ready: true, revision: 1, windowRect: new Rect(0, 0, 390, 844),
      statusBarRect: new Rect(0, 0, 390, 48), statusBarHeight: 48, statusBarCutoutRect: new Rect(154, 0, 82, 32),
      topLeftCorner: new Corner(42, 42, 42), topRightCorner: new Corner(348, 42, 42), systemFontScale: 1 });
    const layout = resolveReaderReadingLayout(390, 844, false, metrics, false);

    // Production gesture state and real Host ACK bridge: threshold preview,
    // rebound, late write/projection, page/book changes and failed deletion.
    assert.deepEqual(motion.motionAnimateParam('reader.bookmark.rollback'), { duration: 300, curve: [0.2, 0, 0, 1] });
    assert.equal(motion.readerMotionReducedFadeParam().duration, 120);
    const bookmarkMotionDeps = { ...gesture, ...bookmarkModel, ...motion, LOCAL_READING_SOURCE_ID: 'local',
      vibrator: { startVibration: () => Promise.resolve() } };
    const H = productionMotionMethods(file('LocalReadingExperience.ets'), ['onReaderBookmarkGestureStateChanged',
      'onReaderBookmarkGestureReleased', 'finishBookmarkRollback', 'bookmarkMatchesCurrentChapter', 'toggleCurrentPageBookmark', 'currentPageBookmarkStatus',
      'pageBookmarkFeedbackAnchor', 'pageBookmarkFeedbackFilled', 'reconcilePageBookmarkFeedback',
      'canStartReaderBookmarkGesture', 'isReaderBookmarkGestureCurrent', 'bookmarkFeedbackOwnerKey'], bookmarkMotionDeps);
    let entries = [{ index: 0, title: 'C', bookmarks: [] }], pending = [];
    const host = Object.assign(new H(), { mounted: true, sourceId: 'local', bookId: 'b', visiblePage: { startScalar: 0, endScalar: 50 },
      currentChapterIndex: () => 0, currentPageBookmarkText: () => 'body', controlDirectoryEntries: () => entries,
      bookmarkPendingTarget: '', bookmarkPreviewChanged: false, bookmarkRollbackGeneration: 0, bookmarkMutationGeneration: 0,
      bookmarkGestureAnchor: '', lifecycleToken: 1, chapterSelectionToken: 1, pagePointerEpoch: 1, pageTurnInputRevision: 1,
      canTurnPage: () => true, isReaderPageInteractionEnabled: () => true, pageTurnTapOnlyInput: () => false,
      reduceMotion: true, appForeground: false, flushDeferredPageChromeState() {}, usesBookTurnSimulation: () => false,
      bookmarkWriteEnabled: () => true, getUIContext: () => ({ animateTo: (options, closure) => { closure(); options.onFinish(); } }),
      onTogglePageBookmark: r => pending.push(r) });
    assert.equal(host.canStartReaderBookmarkGesture(), true);
    let drag = gesture.beginReaderPageGesture(390, 200, 400, 0, 844);
    drag = gesture.moveReaderPageGesture(drag, 0, 24); host.onReaderBookmarkGestureStateChanged(drag);
    assert.equal(host.pageBookmarkFeedbackFilled(), false);
    drag = gesture.moveReaderPageGesture(drag, 0, 96); host.onReaderBookmarkGestureStateChanged(drag);
    assert.equal(host.pageBookmarkFeedbackFilled(), true);
    host.pageTurnGestureState = drag; host.onReaderBookmarkGestureReleased(true);
    assert.equal(host.bookmarkPageOffsetY, 0); assert.equal(host.pageBookmarkFeedbackFilled(), true);
    pending[0].onSettled(true); assert.equal(host.pageBookmarkFeedbackFilled(), true, 'ACK-before-projection retains fill');
    host.visiblePage = { startScalar: 50, endScalar: 100 }; host.reconcilePageBookmarkFeedback();
    assert.equal(host.pageBookmarkFeedbackFilled(), false, 'old page pending ACK cannot mark next page');
    entries = [{ index: 0, title: 'C', bookmarks: [{ time: 1, chapterOffset: 0 }] }];
    host.visiblePage = { startScalar: 0, endScalar: 50 }; assert.equal(host.pageBookmarkFeedbackFilled(), true);
    host.toggleCurrentPageBookmark(); assert.equal(host.pageBookmarkFeedbackFilled(), false);
    pending[1].onSettled(false); assert.equal(host.pageBookmarkFeedbackFilled(), true, 'failed deletion preserves canonical fill');
    host.visiblePage = { startScalar: 50, endScalar: 100 }; host.toggleCurrentPageBookmark();
    host.bookId = 'other'; entries = [{ index: 0, title: 'C', bookmarks: [] }]; pending[2].onSettled(true);
    assert.equal(host.pageBookmarkFeedbackFilled(), false, 'old book completion does not publish into new book');

    // Normal-motion rebound holds the released target until both the animation
    // and canonical projection are complete. ACK/projection are controlled inputs;
    // the production methods, marker cache and merge remain unmodified.
    const pointerReleaseTicks = [];
    const Normal = productionMotionMethods(file('LocalReadingExperience.ets'), [
      'onReaderBookmarkGestureStateChanged', 'onReaderBookmarkGestureReleased', 'finishBookmarkRollback',
      'bookmarkMatchesCurrentChapter', 'toggleCurrentPageBookmark', 'currentPageBookmarkStatus', 'pageBookmarkFeedbackAnchor',
      'pageBookmarkFeedbackFilled', 'reconcilePageBookmarkFeedback', 'canStartReaderBookmarkGesture',
      'isReaderBookmarkGestureCurrent', 'bookmarkFeedbackOwnerKey',
      'onReaderPageGestureStateChanged',
      'acquirePagePointer', 'releasePagePointer', 'pageTurnTapOnlyInput', 'regrabPageTurn',
      'controlDirectorySourceEntries', 'controlDirectoryEntries', 'invalidatePageTurnRuntime',
    ], { ...bookmarkMotionDeps, ...rapid,
      setTimeout: callback => { pointerReleaseTicks.push(callback); return pointerReleaseTicks.length; } });
    function normalHost(bookmarked = false) {
      const requests = [], animations = [];
      const h = Object.assign(new Normal(), { mounted: true, sourceId: 'local', bookId: 'b', chapter: undefined,
        visiblePage: { startScalar: 50, endScalar: 100 },
        directoryEntries: [{ index: 16, title: 'chapter17', bookmarks: bookmarked ? [{ time: 10, chapterOffset: 50 }] : [] }],
        tocEntries: [], currentChapterIndex: () => 16, currentPageBookmarkText: () => 'text', canTurnPage: () => true,
        bookmarkPendingTarget: '', bookmarkPreviewChanged: false, bookmarkRollbackGeneration: 0, bookmarkMutationGeneration: 0,
        bookmarkGestureAnchor: '', lifecycleToken: 1, chapterSelectionToken: 1, pagePointerEpoch: 1, pageTurnInputRevision: 1,
        pageTurnGestureState: gesture.createReaderPageGestureState(), pageTurnInputOwned: false,
        isReaderPageInteractionEnabled: () => true, bookmarkWriteEnabled: () => true, usesBookTurnSimulation: () => false,
        reduceMotion: false, appForeground: false, flushDeferredPageChromeState() {},
        onTogglePageBookmark: r => requests.push(r),
        getUIContext: () => ({ animateTo: (options, closure) => { animations.push(options.onFinish); closure(); } }),
        rapidPageTurnState: rapid.createReaderRapidPageTurnState(),
        autoPageCoordinator: { cancelPendingTurn() {} },
        clearPageTurnProjection() {}, finishPageTurnPerf() {}, cancelPageTurnSettlementDeadline() {},
        clearBookTurnCapturedIdentities() {}, releaseBookTurnTextureContent() {}, releaseBookTurnPendingSnapshot() {},
        releaseUnretainedReadingImages() {},
      });
      return { h, requests, animations };
    }
    function normalRelease(h, cancelled = false) {
      assert.equal(h.canStartReaderBookmarkGesture(), true);
      let state = gesture.beginReaderPageGesture(390, 200, 300, 0, 844);
      state = gesture.moveReaderPageGesture(state, 0, 96);
      const decision = gesture.settleReaderPageGesture(state, 0, cancelled ? 10 : 96);
      h.pageTurnGestureState = decision.state;
      h.onReaderBookmarkGestureStateChanged(decision.state);
      h.onReaderBookmarkGestureReleased(decision.bookmarkChanged);
    }
    // Exercise the real Layer -> Host release order. The Host already receives
    // bookmark settling before raw pointer release and the business UP callback;
    // blocking new DOWN must not change the predicate that admits this same UP.
    const ReboundInput = productionMotionMethods(file('ReaderPageInteractionLayer.ets'),
      ['acceptCurrentInput', 'startRawPointer', 'handleTouch', 'cancelPan', 'resetRawPointer'],
      { ...gesture, TouchType: { Down: 'down', Up: 'up', Move: 'move', Cancel: 'cancel' } });
    for (const reduced of [false, true]) for (const cancelled of [false, true]) {
      const { h, requests, animations } = normalHost();
      Object.assign(h, { activePagePointerId: -1, reduceMotion: reduced,
        pageTurnFrozenRevision: 0, pageTurnRenderRevision: 0, pageTurnSessionCapsuleFrozen: true });
      assert.equal(h.acquirePagePointer(11), true);
      assert.equal(h.canStartReaderBookmarkGesture(), true);
      const drag = gesture.moveReaderPageGesture(gesture.beginReaderPageGesture(390, 200, 300, 0, 844), 0, 96);
      h.onReaderPageGestureStateChanged(drag); h.onReaderBookmarkGestureStateChanged(drag);
      const decision = gesture.settleReaderPageGesture(drag, 0, cancelled ? 10 : 96);
      h.onReaderPageGestureStateChanged(decision.state); h.onReaderBookmarkGestureStateChanged(decision.state);
      h.releasePagePointer(11);
      assert.equal(h.pageTurnGestureState.phase, 'settling');
      assert.equal(h.isReaderBookmarkGestureCurrent(), true, 'publishing bookmark settling cannot reject its own legal UP');
      h.onReaderBookmarkGestureReleased(decision.bookmarkChanged);
      assert.equal(requests.length, cancelled ? 0 : 1, 'legal UP preserves add/cancel intent');
      const epoch = h.pagePointerEpoch, state = h.pageTurnGestureState;
      if (!reduced) {
        assert.equal(animations.length, 1);
        assert.equal(h.pageTurnInputOwned, true, 'the released bookmark owns its rebound');
        const input = Object.assign(new ReboundInput(), { interactionEnabled: true, activePointerId: -1,
          gestureState: decision.state, deferredSegmentReserved: false, systemOwnsPointer: () => false,
          onPointerStart: pointerId => h.acquirePagePointer(pointerId),
          freezePointerGeometry() { throw new Error('rebound DOWN must be rejected before freezing geometry'); },
          onDeferredSegmentStart() { throw new Error('rebound DOWN must not reserve deferred input'); },
          onGestureStateChange() { throw new Error('rebound DOWN must not replace the settling owner'); },
        });
        const touch = { changedTouches: [{ id: 12 }], touches: [{ id: 12 }] };
        input.handleTouch({ ...touch, type: 'down' });
        assert.equal(input.activePointerId, -1, 'rebound does not accept a second physical pointer');
        assert.equal(input.deferredSegmentReserved, false, 'rebound never queues the rejected segment');
        assert.equal(h.activePagePointerId, -1); assert.equal(h.pagePointerEpoch, epoch);
        assert.equal(h.pageTurnGestureState, state, 'rejected DOWN preserves the exact settling owner');
        animations[0]();
        input.handleTouch({ ...touch, type: 'move' }); input.handleTouch({ ...touch, type: 'up' });
        assert.equal(input.activePointerId, -1, 'a segment rejected during rebound cannot replay after it finishes');
      } else {
        assert.equal(animations.length, 1, 'reduced motion retains a 120ms alpha settlement');
        assert.equal(h.bookmarkPageOffsetY, 0);
        assert.equal(h.bookmarkRibbonFrame.y, -13);
        animations[0]();
      }
      assert.equal(h.pageTurnGestureState.phase, 'idle');
      assert.equal(h.pageTurnInputOwned, false);
      assert.equal(h.acquirePagePointer(13), true, 'a genuinely new DOWN is admitted after rebound finishes');
      assert.equal(h.pagePointerEpoch, epoch + 1);
    }
    for (const owner of ['horizontalPage', 'verticalPrevious']) {
      const { h } = normalHost();
      Object.assign(h, { activePagePointerId: -1, pageTurnGestureState: { ...gesture.createReaderPageGestureState(), owner, phase: 'settling' },
        pageTurnSettlementActive: true, pageTurnDirection: 'next', pageTurnOffsetX: -40,
        pageTurnSettlementGeneration: 10, pageTurnSlideTimeline: {}, usesBookTurnSimulation: () => false,
        completeRapidPageTurnTransaction() {} });
      assert.equal(h.acquirePagePointer(14), true, 'ordinary page settlement preserves its existing pointer/regrab admission');
      const resumed = h.regrabPageTurn(390, 844, 200, 300, 32);
      assert.equal(resumed.owner, 'horizontalPage'); assert.equal(resumed.currentOffsetX, -40);
      assert.equal(h.pageTurnSettlementActive, false, 'ordinary page regrab retains its existing settlement handoff');
    }
    console.log('PASS bookmark rebound input: legal UP, rejected new DOWN without epoch/defer/replay, finish/reduceMotion recovery and ordinary page regrab');
    const systemCancelPreviews = [];
    for (const bookmarked of [false, true]) {
      const { h, requests, animations } = normalHost(bookmarked);
      Object.assign(h, { activePagePointerId: -1, pageTurnFrozenRevision: 0,
        pageTurnRenderRevision: 0, pageTurnSessionCapsuleFrozen: true });
      assert.equal(h.acquirePagePointer(21), true);
      assert.equal(h.canStartReaderBookmarkGesture(), true);
      const drag = gesture.moveReaderPageGesture(gesture.beginReaderPageGesture(390, 200, 300, 0, 844), 0, 96);
      h.onReaderPageGestureStateChanged(drag); h.onReaderBookmarkGestureStateChanged(drag);
      assert.equal(h.pageBookmarkFeedbackFilled(), !bookmarked, 'threshold crossing previews the opposite state before CANCEL');
      const input = Object.assign(new ReboundInput(), { interactionEnabled: true, activePointerId: 21,
        gestureState: drag, tapOnlyPointer: false, pointerRejected: false,
        onGestureStateChange: state => h.onReaderPageGestureStateChanged(state),
        onBookmarkStateChange: state => h.onReaderBookmarkGestureStateChanged(state),
        onBookmarkRelease: changed => h.onReaderBookmarkGestureReleased(changed),
        onPointerEnd: pointerId => h.releasePagePointer(pointerId),
        resolveDeferredSegment() {}, clearPointerWatchdog() {}, clearLongPressTimer() {},
      });
      input.handleTouch({ type: 'cancel' });
      assert.equal(requests.length, 0, 'system CANCEL after the threshold never writes');
      assert.equal(animations.length, 1, 'system CANCEL still uses the existing rebound');
      assert.equal(h.activePagePointerId, -1); assert.equal(input.activePointerId, -1);
      systemCancelPreviews.push({ bookmarked, changed: h.bookmarkPreviewChanged, filled: h.pageBookmarkFeedbackFilled() });
      animations[0](); assert.equal(h.pageBookmarkFeedbackFilled(), bookmarked);
    }
    assert.deepEqual(systemCancelPreviews, [
      { bookmarked: false, changed: false, filled: false },
      { bookmarked: true, changed: false, filled: true },
    ], 'system CANCEL clears a threshold preview before rebound begins for both original states');
    console.log('PASS system bookmark CANCEL: threshold preview restores canonical empty/bookmarked before the existing rebound, with no write');
    function publishBookmark(h, bookmarked) {
      h.directoryEntries = mergeReaderControlBookmarkProjection(h.directoryEntries,
        [{ index: 16, title: 'chapter17', bookmarks: bookmarked ? [{ time: 10, chapterOffset: 50 }] : [] }]);
      h.reconcilePageBookmarkFeedback();
    }
    const completionOrders = [ ['ack', 'projection', 'rollback'], ['ack', 'rollback', 'projection'],
      ['projection', 'ack', 'rollback'], ['projection', 'rollback', 'ack'],
      ['rollback', 'ack', 'projection'], ['rollback', 'projection', 'ack'] ];
    for (const order of completionOrders) {
      const { h, requests, animations } = normalHost();
      for (const target of [true, false]) {
        assert.equal(h.canStartReaderBookmarkGesture(), true);
        normalRelease(h);
        const request = requests.at(-1), done = animations.at(-1), requestCount = requests.length;
        assert.equal(h.canStartReaderBookmarkGesture(), false, 'same-page mutation owns the gesture until reconciled');
        h.toggleCurrentPageBookmark();
        assert.equal(requests.length, requestCount, 'duplicate release cannot enqueue a second write');
        for (const step of order) {
          if (step === 'ack') request.onSettled(true);
          if (step === 'projection') publishBookmark(h, target);
          if (step === 'rollback') done();
          assert.equal(h.pageBookmarkFeedbackFilled(), target, `${target ? 'add' : 'remove'} cannot invert at ${order}/${step}`);
        }
        assert.equal(h.bookmarkPendingTarget, '', 'matching projection and finished rebound release pending state');
        assert.equal(h.canStartReaderBookmarkGesture(), true);
      }
    }
    for (const bookmarked of [false, true]) {
      const rejected = normalHost(bookmarked);
      normalRelease(rejected.h); rejected.requests[0].onSettled(false);
      assert.equal(rejected.h.pageBookmarkFeedbackFilled(), bookmarked, 'failed write restores canonical state');
      rejected.animations[0]();
      assert.equal(rejected.h.bookmarkPendingTarget, '');
      assert.equal(rejected.h.pageBookmarkFeedbackFilled(), bookmarked);
      const cancelled = normalHost(bookmarked);
      normalRelease(cancelled.h, true);
      assert.equal(cancelled.requests.length, 0, 'pull back before release cancels without writing');
      cancelled.animations[0](); assert.equal(cancelled.h.pageBookmarkFeedbackFilled(), bookmarked);
    }
    const invalidated = normalHost();
    normalRelease(invalidated.h); publishBookmark(invalidated.h, true); invalidated.requests[0].onSettled(true);
    assert.equal(invalidated.h.bookmarkPendingTarget, 'bookmarked', 'early ACK holds target through rebound');
    invalidated.h.invalidatePageTurnRuntime();
    assert.equal(invalidated.h.bookmarkPendingTarget, '', 'runtime cancellation also reconciles confirmed projection');
    invalidated.h.visiblePage = { startScalar: 100, endScalar: 150 };
    invalidated.animations[0]();
    assert.equal(invalidated.h.pageBookmarkFeedbackFilled(), false, 'late old animation cannot mark the new page');
    const late = normalHost();
    normalRelease(late.h); late.animations[0](); publishBookmark(late.h, true); late.requests[0].onSettled(true);
    normalRelease(late.h); late.requests[0].onSettled(false);
    assert.equal(late.h.bookmarkPendingTarget, 'empty', 'old ACK cannot erase a newer remove intent');
    late.animations[1](); publishBookmark(late.h, false); late.requests[1].onSettled(true);
    assert.equal(late.h.pageBookmarkFeedbackFilled(), false);
    assert.equal(late.h.bookmarkPendingTarget, '');
    for (const mutate of [
      h => { h.sourceId = 'other'; }, h => { h.bookId = 'other'; },
      h => { h.chapter.chapterIndex++; h.currentChapterIndex = () => 17; },
      h => { h.chapter.contentVersion = 'v2'; }, h => { h.chapter.bodyVersion = 'b2'; },
      h => { h.chapter.processingVersion = 'p2'; }, h => { h.visiblePage = { startScalar: 100, endScalar: 150 }; },
      h => { h.visiblePage.endScalar++; }, h => { h.lifecycleToken++; }, h => { h.chapterSelectionToken++; },
      h => { h.pagePointerEpoch++; }, h => { h.pageTurnInputRevision++; }, h => { h.mounted = false; },
      h => { h.exitRequested = true; }, h => { h.isReaderPageInteractionEnabled = () => false; },
      h => { h.pageTurnTapOnlyInput = () => true; }, h => { h.canTurnPage = () => false; },
    ]) {
      const { h, requests, animations } = normalHost();
      h.chapter = { chapterIndex: 16, contentVersion: 'v1', bodyVersion: 'b1', processingVersion: 'p1' };
      assert.equal(h.canStartReaderBookmarkGesture(), true);
      h.pageTurnGestureState = gesture.moveReaderPageGesture(gesture.beginReaderPageGesture(390, 200, 300, 0, 844), 0, 96);
      h.pageTurnInputOwned = true;
      const epoch = h.pagePointerEpoch;
      const inputRevision = h.pageTurnInputRevision;
      mutate(h); h.onReaderBookmarkGestureReleased(true);
      assert.equal(requests.length, 0, 'a superseded admission never writes into the current context');
      assert.equal(animations.length, 0, 'retired admission never starts another animation');
      if (h.mounted && h.pagePointerEpoch === epoch && h.pageTurnInputRevision === inputRevision) {
        assert.equal(h.pageTurnInputOwned, false, 'retired same-segment bookmark releases input ownership');
        assert.equal(h.pageTurnGestureState.phase, 'idle');
      } else if (h.pagePointerEpoch !== epoch) {
        assert.equal(h.pageTurnInputOwned, true, 'old-epoch release cannot clear newer input ownership');
      }
    }
    const cancelNative = normalHost();
    const cancelledBookmark = gesture.settleReaderPageGesture(
      gesture.moveReaderPageGesture(gesture.beginReaderPageGesture(390, 200, 300, 0, 844), 0, 96), 0, 10).state;
    cancelNative.h.usesBookTurnSimulation = () => { throw new Error('bookmark must not enter native page presentation'); };
    cancelNative.h.onReaderPageGestureStateChanged(cancelledBookmark);
    assert.equal(cancelNative.h.pageTurnGestureState.owner, 'bookmark');
    assert.equal(cancelNative.h.pageTurnInputOwned, true, 'bookmark release owns the dedicated rebound');
    const disabledCancel = normalHost();
    assert.equal(disabledCancel.h.canStartReaderBookmarkGesture(), true);
    disabledCancel.h.isReaderPageInteractionEnabled = () => false;
    disabledCancel.h.onReaderPageGestureStateChanged(cancelledBookmark);
    disabledCancel.h.onReaderBookmarkGestureStateChanged(cancelledBookmark);
    disabledCancel.h.onReaderBookmarkGestureReleased(false);
    assert.equal(disabledCancel.requests.length, 0, 'disabled raw CANCEL never writes a bookmark');
    assert.equal(disabledCancel.animations.length, 0, 'disabled raw CANCEL never starts another animation');
    assert.equal(disabledCancel.h.pageTurnInputOwned, false, 'disabled raw CANCEL releases its same-segment host input');
    assert.equal(disabledCancel.h.pageTurnGestureState.phase, 'idle');
    const releasedPointer = normalHost();
    releasedPointer.h.activePagePointerId = 7;
    assert.equal(releasedPointer.h.canStartReaderBookmarkGesture(), true);
    releasedPointer.h.activePagePointerId = -1;
    releasedPointer.h.onReaderBookmarkGestureReleased(true);
    releasedPointer.h.onReaderBookmarkGestureReleased(true);
    assert.equal(releasedPointer.requests.length, 1, 'UP consumes admission once after the raw pointer has been released');
    const oldContext = normalHost();
    normalRelease(oldContext.h); oldContext.h.chapterSelectionToken++;
    oldContext.h.bookmarkPreviewChanged = true;
    oldContext.requests[0].onSettled(false);
    assert.equal(oldContext.h.bookmarkPreviewChanged, true, 'old-context ACK cannot clear the new context preview');
    assert.equal(oldContext.h.pageBookmarkFeedbackFilled(), false, 'old preview and pending intent stay scoped to their context');
    assert.equal(oldContext.h.canStartReaderBookmarkGesture(), true, 'a retired context does not leave the new context locked');
    const awayAck = normalHost();
    normalRelease(awayAck.h);
    awayAck.h.visiblePage = { startScalar: 100, endScalar: 150 };
    awayAck.requests[0].onSettled(true);
    assert.equal(awayAck.h.bookmarkPendingTarget, '', 'off-page ACK retires its own request bookkeeping');
    awayAck.h.visiblePage = { startScalar: 50, endScalar: 100 };
    assert.equal(awayAck.h.canStartReaderBookmarkGesture(), true, 'returning to the origin after off-page ACK permits a new gesture');
    const noMoveScans = normalHost();
    let scans = 0;
    const realEntries = noMoveScans.h.controlDirectoryEntries.bind(noMoveScans.h);
    noMoveScans.h.controlDirectoryEntries = () => { scans++; return realEntries(); };
    assert.equal(noMoveScans.h.canStartReaderBookmarkGesture(), true);
    const admittedScans = scans;
    let preview = gesture.beginReaderPageGesture(390, 200, 300, 0, 844);
    for (const dy of [24, 32, 48, 96, 20]) {
      preview = gesture.moveReaderPageGesture(preview, 0, dy);
      noMoveScans.h.onReaderBookmarkGestureStateChanged(preview);
      noMoveScans.h.pageBookmarkFeedbackFilled();
    }
    assert.equal(scans, admittedScans, 'MOVE preview never scans the directory/bookmark projection');
    for (const [initial, next] of [ ['empty', 'bookmarked'], ['bookmarked', 'empty'], ['empty', 'unknown'] ]) {
      const { h, requests, animations } = normalHost(initial === 'bookmarked');
      let projectionScans = 0;
      const actualEntries = h.controlDirectoryEntries.bind(h);
      h.controlDirectoryEntries = () => { projectionScans++; return actualEntries(); };
      assert.equal(h.canStartReaderBookmarkGesture(), true);
      const admissionScans = projectionScans;
      let state = gesture.beginReaderPageGesture(390, 200, 300, 0, 844);
      for (const dy of [24, 32, 48, 96]) {
        state = gesture.moveReaderPageGesture(state, 0, dy);
        h.onReaderBookmarkGestureStateChanged(state);
        h.pageBookmarkFeedbackFilled();
      }
      assert.equal(projectionScans, admissionScans, `${initial}->${next}: MOVE never rescans the projection`);
      const previewFilled = h.pageBookmarkFeedbackFilled();
      h.directoryEntries = [{ index: 16, title: 'chapter17', bookmarks: next === 'unknown' ? undefined :
        next === 'bookmarked' ? [{ time: 20, chapterOffset: 50 }] : [] }];
      assert.equal(h.pageBookmarkFeedbackFilled(), previewFilled, 'incoming projection cannot reverse the live preview');
      h.pageTurnGestureState = gesture.settleReaderPageGesture(state, 0, 80).state;
      h.pageTurnInputOwned = true;
      const beforeUpScans = projectionScans;
      h.onReaderBookmarkGestureReleased(true);
      assert.equal(projectionScans, beforeUpScans + 1, `${initial}->${next}: UP revalidates canonical status once`);
      assert.equal(requests.length, 0, `${initial}->${next}: a changed projection never writes the opposite target`);
      assert.equal(animations.length, 0, 'superseded preview retires without another animation');
      assert.equal(h.pageTurnInputOwned, false, 'superseded preview releases same-segment input');
      assert.equal(h.pageTurnGestureState.phase, 'idle');
      assert.equal(h.bookmarkPendingTarget, '');
    }
    const feedbackTimers = [], nativeToasts = [];
    const Feedback = productionMotionMethods(file('LocalReadingExperience.ets'), [
      'onReaderBookmarkGestureUnavailable', 'bookmarkUnavailableHintFits', 'bookmarkFeedbackOwnerKey',
      'bookmarkUnavailableHintCurrent', 'bookmarkCornerLayout', 'pageBookmarkFeedbackAnchor',
    ], { ...dependencies, setTimeout: callback => { feedbackTimers.push(callback); return feedbackTimers.length; }, clearTimeout() {} });
    const feedbackLayout = { ...layout, contentTop: layout.contentTop + 80 };
    const feedback = Object.assign(new Feedback(), { mounted: true, lifecycleToken: 1, chapterSelectionToken: 1,
      sourceId: 'local', bookId: 'b', visiblePage: { startScalar: 0, endScalar: 50 }, currentChapterIndex: () => 0,
      bookmarkUnavailableMessage: '', bookmarkUnavailableGeneration: 0, bookmarkUnavailableTimer: -1,
      bookmarkPendingTarget: '', bookmarkPageOffsetY: 0, currentPageBookmarkStatus: () => 'unknown',
      readerSettingsSnapshot: { hideStatusBar: true },
      isReaderPageInteractionEnabled: () => true, readingLayout: () => feedbackLayout, bookmarkWriteEnabled: () => true,
      isSessionActive: () => true, appForeground: true, windowChromeActive: true,
      transientFeedback: { show: (_context, options, current) => { if (current()) nativeToasts.push(options.message); } },
      pageChromeClockText: '12:30', bookTitle: 'Book',
      getUIContext: () => ({ ...context(feedbackLayout.systemFontScale),
        getPromptAction: () => ({ showToast: options => nativeToasts.push(options.message) }) }) });
    feedback.onReaderBookmarkGestureUnavailable('busy');
    assert.equal((feedback.bookmarkUnavailableHintCurrent() ? feedback.bookmarkUnavailableMessage : ''), '页面切换中，请稍后下拉');
    const oldFeedbackTimer = feedbackTimers.at(-1);
    feedback.onReaderBookmarkGestureUnavailable('unavailable');
    assert.equal((feedback.bookmarkUnavailableHintCurrent() ? feedback.bookmarkUnavailableMessage : ''), '书签尚未加载，请稍后下拉');
    oldFeedbackTimer(); assert.equal((feedback.bookmarkUnavailableHintCurrent() ? feedback.bookmarkUnavailableMessage : ''), '书签尚未加载，请稍后下拉', 'retired feedback timer cannot clear newer feedback');
    feedback.bookmarkPendingTarget = 'bookmarked'; feedback.bookmarkPendingAnchor = feedback.pageBookmarkFeedbackAnchor();
    feedback.onReaderBookmarkGestureUnavailable('unavailable');
    assert.equal((feedback.bookmarkUnavailableHintCurrent() ? feedback.bookmarkUnavailableMessage : ''), '书签正在保存，请稍后再试');
    feedbackTimers.at(-1)(); assert.equal((feedback.bookmarkUnavailableHintCurrent() ? feedback.bookmarkUnavailableMessage : ''), '', 'local feedback retires without changing persistence');
    feedback.onReaderBookmarkGestureUnavailable('busy');
    const awayFeedbackTimer = feedbackTimers.at(-1);
    feedback.visiblePage = { startScalar: 50, endScalar: 100 };
    assert.equal((feedback.bookmarkUnavailableHintCurrent() ? feedback.bookmarkUnavailableMessage : ''), '', 'old-page feedback is hidden on another page');
    awayFeedbackTimer();
    feedback.visiblePage = { startScalar: 0, endScalar: 50 };
    assert.equal((feedback.bookmarkUnavailableHintCurrent() ? feedback.bookmarkUnavailableMessage : ''), '', 'returning to the old page cannot revive expired feedback');
    assert.equal(feedback.bookmarkUnavailableTimer, -1, 'off-page expiry releases its own timer handle');
    feedback.onReaderBookmarkGestureUnavailable('busy');
    feedback.lifecycleToken++; assert.equal((feedback.bookmarkUnavailableHintCurrent() ? feedback.bookmarkUnavailableMessage : ''), '', 'feedback never moves into a new lifecycle');
    feedbackTimers.at(-1)();
    feedback.readingLayout = () => ({ ...feedbackLayout,
      contentTop: feedbackLayout.pageChromeVisualSafeTop + feedbackLayout.pageChromeTopRegionHeight });
    feedback.onReaderBookmarkGestureUnavailable('busy');
    assert.deepEqual(nativeToasts, ['页面切换中，请稍后下拉'], 'zero whitespace uses one existing native short notice per arena callback');
    console.log('PASS bookmark admission: 17 identity/readiness invalidations, pointer-release-before-UP, duplicate UP, retired ACK and zero MOVE scans');
    console.log('PASS bookmark feedback: visible pull/cancel labels, transient busy/unknown/pending, stale timer/lifecycle isolation and constrained-space fallback');
    console.log('PASS PH86 normal motion: 6 completion orders/12 lifecycles without intermediate inversion; cancelled/failed/page-invalidated/duplicate/old ACK cases');
  } finally {
    resolution.deregister();
  }
}

function context(scale) {
  return { px2vp: v => v / 3, fp2px: v => v * 3 * scale, px2fp: v => v / (3 * scale),
    getHostContext: () => ({resourceManager: {getNumber: () => 16 * 3 * scale}}),
    getMeasureUtils: () => ({ measureText: ({ textContent }) => textContent.length * 7.2 * 3 * scale,
      measureTextSize: ({textContent}) => ({width: textContent.length * 7.2 * 3 * scale, height: 20 * 3 * scale}) }) };
}
