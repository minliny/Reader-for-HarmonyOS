import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  'reading-request-policy': { description: 'Reading recovery is explicitly requested through the real existing More menu, dismisses projection on Back/body/control, and never changes pagination or receipts.', resources: [] },
  'foreign-book-guidance': { description: 'Actual recovery projection names a foreign original book, keeps retry authority on that book and preserves global write blocking, including a cold metadata projection.', resources: [] },
  'group-owners': { description: 'Actual Settings pending builders share one painted recovery group while captured actions and generations remain independent.', resources: [] },
});
const read = path => readFileSync(new URL('../entry/src/main/ets/' + path, import.meta.url), 'utf8');

for (const id of selected) {
  if (id === 'reading-request-policy') {
    const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
    const source = read('features/reading/ui/LocalReadingExperience.ets');
    const methods = ['openReaderRecovery', 'readerRecoveryInputCurrent', 'requestExit', 'onReaderManualInteraction',
      'readerRecoveryRequestCurrent', 'retireReaderRecovery', 'readerRecoveryOverlayId'];
    const owner = createReaderBuilderProbe(source, methods).owner;
    const events = [];
    Object.assign(owner, { mounted: true, exitRequested: false, readerRecoveryRequested: false,
      hasReaderRecoveryContent: () => true, isControlInputEnabled: () => true,
      sourceId: 'source-a', bookId: 'book-a', lifecycleToken: 7,
      controlVisible: () => false, controlMotionVisible: () => false, sourceSwitchPresentationVisible: false,
      hideControl: () => events.push('close-control'), invalidateControlBackdrop: () => events.push('backdrop'),
      invalidateTtsPageFollow: () => events.push('follow'), pauseAutoPageForInteraction: () => events.push('pause'),
    });
    const before = { pagination: 77, chapterAnchor: 42, controlMinimum: 120, generation: 8 };
    Object.assign(owner, before);
    assert.equal(owner.readerRecoveryInputCurrent(), false, 'a restored pending fact does not automatically cover reading');
    owner.openReaderRecovery(owner.readerRecoveryOverlayId());
    assert.equal(owner.readerRecoveryInputCurrent(), true);
    assert.deepEqual(events, ['close-control']);
    owner.requestExit();
    assert.equal(owner.readerRecoveryRequested, false);
    assert.deepEqual(events, ['close-control'], 'Back retires the requested projection without exiting or reconciling');
    owner.openReaderRecovery(owner.readerRecoveryOverlayId()); owner.onReaderManualInteraction();
    assert.equal(owner.readerRecoveryRequested, false);
    for (const [key, value] of Object.entries(before)) assert.equal(owner[key], value);
    owner.openReaderRecovery(owner.readerRecoveryOverlayId()); owner.controlVisible = () => true;
    assert.equal(owner.readerRecoveryInputCurrent(), false);
    owner.controlVisible = () => false; owner.sourceSwitchPresentationVisible = true;
    assert.equal(owner.readerRecoveryInputCurrent(), false);
    owner.sourceSwitchPresentationVisible = false; owner.mounted = false; owner.readerRecoveryRequested = false;
    owner.openReaderRecovery(owner.readerRecoveryOverlayId()); assert.equal(owner.readerRecoveryRequested, false);

    const panel = createReaderBuilderProbe(read('features/reading/ui/ReaderControlPanel.ets'),
      ['readerMoreActions', 'readerMoreActionEnabled', 'performMoreAction'],
      { ReaderMenuActionView: class { constructor(id, label, enabled) { Object.assign(this, { id, label, enabled }); } } }).owner;
    let requests = 0;
    Object.assign(panel, { inputEnabled: true, controlObscured: false, recoveryAvailable: true,
      moreMenuVisible: true, moreMenuGeneration: 4, recoveryIdentity: 'reading-a', moreMenuRecoveryIdentity: 'reading-a', dismissMoreMenu() { this.moreMenuVisible = false; },
      onOpenRecovery() { requests++; } });
    assert.equal(panel.readerMoreActions().filter(item => item.id === 'recovery').length, 1);
    panel.performMoreAction('recovery', 3); assert.equal(requests, 0);
    panel.performMoreAction('recovery', 4); assert.equal(requests, 1);
    panel.moreMenuVisible = true; panel.recoveryAvailable = false;
    assert.equal(panel.readerMoreActions().some(item => item.id === 'recovery'), false);
    panel.performMoreAction('recovery', 4); assert.equal(requests, 1);
  }
  if (id === 'foreign-book-guidance') {
    const hook = registerHooks({ resolve(specifier, context, next) {
      try { return next(specifier, context); }
      catch (error) {
        if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier))
          return next(specifier + '.ts', context);
        throw error;
      }
    } });
    try {
      const { readingDirectoryRecovery } = await import('../entry/src/main/ets/features/reading/presentation/ReadingDirectoryRecovery.ts');
      const { projectPersistedReceipt } = await import('../entry/src/main/ets/app/ReaderPersistedReceiptProjection.ts');
      const original = { sourceId: 'source-a', bookId: 'book-a', title: '原书', author: '原作者' };
      const current = { sourceId: 'source-b', bookId: 'book-b', title: '当前书', author: '当前作者' };
      const operation = { action: 'delete', book: original, generation: 8, requestedCount: 1, confirmedCount: 0,
        completion: 'unknown', canContinueOriginal: true,
        projection: projectPersistedReceipt({ confirmation: 'unknown', readback: 'failed', generation: 8, canRetry: true }) };
      const foreign = readingDirectoryRecovery('presentation-current', current, operation, undefined, false);
      assert.equal(foreign.bookmarks.visible, false);
      assert.equal(foreign.canContinueBookmarks, false);
      assert.equal(foreign.bookmarkWriteEnabled, false);
      assert.match(foreign.bookmarkWriteBlockReason, /原书.*原作者/);
      assert.match(foreign.bookmarkWriteBlockReason, /更多 → 待处理事项/);
      const cold = readingDirectoryRecovery('cold', current, undefined, undefined, false, original);
      assert.equal(cold.bookmarkWriteBlockReason, foreign.bookmarkWriteBlockReason);
      const own = readingDirectoryRecovery('original', original, operation, undefined, false, original);
      assert.equal(own.bookmarks.visible, true); assert.equal(own.bookmarkWriteBlockReason, undefined);
      assert.equal(own.canContinueBookmarks, true);
      assert.equal(readingDirectoryRecovery('enabled', current, undefined, undefined, true, original).bookmarkWriteBlockReason, undefined);
      assert.equal(operation.generation, 8); assert.equal(operation.projection.receipt.confirmation, 'unknown');
      const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
      const { ReaderDirectoryHost } = pureModuleProbe(read('features/reading/application/ReaderDirectoryHost.ts'),
        'ReaderDirectoryHost.ts', { projectPersistedReceipt }, ['ReaderDirectoryHost']);
      let settlements = 0;
      const host = new ReaderDirectoryHost({ ownsRuntime: () => true, gateway: {
        bookmarkAuthorityAvailable: () => true,
        pendingBookmarkOperation: async () => ({ context: original }),
        reconcileBookmarkOperation() { settlements++; throw Error('foreign book must not reconcile'); },
      } });
      await host.recoverPending({ book: current, current: () => true }, false);
      assert.equal(settlements, 0);
      assert.equal(host.snapshot(), undefined, 'foreign intent metadata never becomes a current-book operation');
      assert.equal(host.bookmarkWriteEnabled(), false);
      const copy = host.blockingBookmarkBook();
      assert.deepEqual(copy, original); copy.title = 'mutated external copy';
      assert.equal(host.blockingBookmarkBook().title, '原书');
      assert.equal(readingDirectoryRecovery('cold-host', current, undefined, undefined,
        host.bookmarkWriteEnabled(), host.blockingBookmarkBook()).bookmarkWriteBlockReason, foreign.bookmarkWriteBlockReason);

    } finally { hook.deregister(); }
  }
  if (id === 'group-owners') {
    const { boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
    const sdk = boundedSurfaceSdk({ allowEmptyBranchAdmission: true });
    const owner = sdk.consumer(read('features/settings/ui/SettingsPage.ets'), ['pendingFeedback', 'pendingFeedbackItems']);
    const calls = [];
    Object.assign(owner, { hasPendingSettings: () => true, hasPendingCleanup: () => true,
      recoveryIdentityFor: kind => kind, temporaryBackIdentity: 'opening-a',
      operation: { receipt: { facts: { generation: 8 } } }, cacheCleanup: { operation: { generation: 11, message: '清理未确认' } },
      recovery: () => ({ message: '设置未确认' }),
      capturedPendingAction: (identity, index) => JSON.parse(identity)[index],
      dispatchRecoveryAction: key => calls.push(key),
    });
    owner.pendingFeedback();
    const groups = sdk.walk(owner).filter(child => child instanceof sdk.deps.ReaderRecoveryGroup);
    const notices = sdk.walk(owner).filter(child => child instanceof sdk.deps.ReaderRecoveryNotice);
    assert.equal(groups.length, 1); assert.equal(notices.length, 2);
    assert.ok(notices.every(notice => notice.grouped));
    assert.equal(notices[0].follows, false); assert.equal(notices[1].follows, true);
    assert.deepEqual(notices.map(notice => notice.view.generation), [8, 11]);
    notices[0].onReconcile(8); notices[1].onSecondaryAction(11);
    assert.deepEqual(calls, ['read', 'cache-continue']);
  }
  console.log(JSON.stringify({ kind: 'ui-recovery-composition', case: id,
    boundary: 'Actual production methods and SDK declarations with explicit external ports. No Native layout, focus, touch or receipt settlement.' }));
  recordContractCasePass(id);
}
