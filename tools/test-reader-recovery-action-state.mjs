import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  'pending-busy-owner': {
    description: 'Current bookmark/offline owner action reaches the actual SDK notice and correct busy button while both actions retain admission guards.', resources: [],
  },
  'confirmed-readback': {
    description: 'An explicit retry retains the known-confirmed readback actor through reading and failure; successful reads and ordinary initial reads retain their existing classification.', resources: [],
  },
});

if (selected.length > 0) {
  registerHooks({ resolve(specifier, context, next) {
    try { return next(specifier, context); }
    catch (error) {
      if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier))
        return next(specifier + '.ts', context);
      throw error;
    }
  } });
  const { boundedSurfaceSdk, boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
  const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const { readingDirectoryRecovery, EMPTY_READING_DIRECTORY_RECOVERY } = await import('../entry/src/main/ets/features/reading/presentation/ReadingDirectoryRecovery.ts');
  const { projectPersistedReceipt } = await import('../entry/src/main/ets/app/ReaderPersistedReceiptProjection.ts');
  const { readerRecoveryView } = await import('../entry/src/main/ets/app/ReaderRecoveryProjection.ts');
  const { readingOfflineFailureHint } = await import('../entry/src/main/ets/features/reading/presentation/ReadingOfflineFailurePresentation.ts');
  const root = new URL('../entry/src/main/ets/', import.meta.url);
  const read = path => readFileSync(new URL(path, root), 'utf8');
  const surfaceSource = read('features/reading/ui/ReaderDirectoryRecoverySurface.ets');
  const projectionSource = read('features/reading/presentation/ReadingDirectoryRecovery.ts');
  const noticeSource = read('ui/feedback/ReaderRecoveryNotice.ets');
  const book = { sourceId: 'local', bookId: 'book', title: 'Book', author: 'Author' };
  let samples = 0, externalSpinnerRemovals = 0;

  function recovery(family, confirmation, readback, recoveryAction, projector = readingDirectoryRecovery, retained = {}) {
    const projection = projectPersistedReceipt({ confirmation, readback, generation: 8,
      canRetry: readback === 'failed' || (confirmation === 'unknown' && readback !== 'reading'), value: [], message: '原操作的当前结果' });
    const canContinueOriginal = confirmation === 'unknown';
    const operation = family === 'bookmarks' ? {
      action: 'createPosition', book, generation: 8, requestedCount: 1,
      confirmedCount: confirmation === 'confirmed' ? 1 : 0,
      completion: confirmation === 'unknown' ? 'unknown' : 'complete',
      canContinueOriginal, recoveryAction, projection, ...retained,
    } : {
      action: 'clear', sourceId: book.sourceId, bookId: book.bookId, generation: 8,
      materialization: 'idle', canContinueOriginal, recoveryAction, projection, ...retained,
    };
    return projector('presentation-a', book, family === 'bookmarks' ? operation : undefined,
      family === 'offline' ? operation : undefined, false);
  }

  function mounted(value, source = surfaceSource, notice = noticeSource) {
    const sdk = boundedSurfaceSdk({ allowEmptyBranchAdmission: true, ReaderRecoveryNotice: notice });
    class Feedback { show() { return true; } reset() {} }
    const owner = sdk.consumer(source, boundedMembers(source), { ReaderTransientFeedback: Feedback, EMPTY_READING_DIRECTORY_RECOVERY });
    const calls = [];
    Object.assign(owner, { recovery: value, presentationActive: true,
      onReconcileBookmarks: (...args) => calls.push(['bookmarks', 'reconcile', ...args]),
      onContinueBookmarks: (...args) => calls.push(['bookmarks', 'continue', ...args]),
      onReconcileOffline: (...args) => calls.push(['offline', 'reconcile', ...args]),
      onContinueOffline: (...args) => calls.push(['offline', 'continue', ...args]),
    });
    owner.aboutToAppear(); owner.initialRender(); sdk.properties.flush();
    const components = type => sdk.walk(owner).filter(view => view instanceof sdk.deps[type]);
    const button = action => [...action.nodes.values()].find(node => node.type === 'Button' && node.onClick);
    const actions = () => components('ReaderRecoveryAction');
    const action = label => {
      const view = actions().find(view => view.label === label);
      assert.ok(view, `current action ${label}`);
      return view;
    };
    return { sdk, owner, calls, components, actions, action, button };
  }

  function spinnerRemovalPort(action) {
    const original = action.ifElseBranchUpdateFunction.bind(action);
    action.ifElseBranchUpdateFunction = (id, generator) => {
      try { return original(id, generator); }
      catch (error) {
        if (!String(error.message).startsWith('probe only admits previously empty branches')) throw error;
        externalSpinnerRemovals++;
      }
    };
  }

  function assertBusy(fixture, family, expectedAction) {
    const query = fixture.action(family === 'bookmarks' ? '重新载入核对书签' : '核对离线结果');
    const continuation = fixture.action('继续原操作');
    assert.equal(query.isBusy, expectedAction === 'reconcile');
    assert.equal(continuation.isBusy, expectedAction === 'continue');
    assert.equal(fixture.button(query).enabled, false);
    assert.equal(fixture.button(continuation).enabled, false);
    const notice = fixture.components('ReaderRecoveryNotice')[0];
    const labelWidth = label => Math.max(44, label.length * 8 + 4);
    notice.getUIContext = () => ({ px2vp: value => value, getMeasureUtils: () => ({
      measureText: options => options.textContent === '\u00a0' ? 4 : options.textContent.length * 8,
      measureTextSize: () => ({ width: 600, height: 22 }),
    }) });
    notice.measureFlow(600); fixture.sdk.properties.flush();
    assert.equal(notice.actionsWidth, labelWidth(query.label) + labelWidth(continuation.label) + 18,
      'the original flow budget includes the retained primary during secondary busy');
    fixture.button(query).onClick(); fixture.button(continuation).onClick();
    assert.equal(fixture.calls.length, 0, 'busy native actors cannot submit either original action');
    samples++;
  }

  function assertActualCallers() {
    const { ts, options } = installedEtsCompiler();
    for (const name of ['LocalReadingExperience', 'ReaderFullDirectory', 'BookDirectoryPage']) {
      const source = read(`features/reading/ui/${name}.ets`);
      const tree = ts.createSourceFile(name + '.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
      const argumentsFound = [];
      function visit(node) {
        if ((ts.isEtsComponentExpression(node) || ts.isCallExpression(node)) && node.expression.getText(tree) === 'ReaderDirectoryRecoverySurface')
          argumentsFound.push(node.arguments[0].properties.find(property => property.name?.getText(tree) === 'recovery').initializer.getText(tree));
        ts.forEachChild(node, visit);
      }
      visit(tree);
      const activeReadingHost = name === 'LocalReadingExperience';
      assert.equal(argumentsFound.length, activeReadingHost ? 2 : 0,
        `${name} follows the active-reading or foreground-directory presentation policy`);
      if (!activeReadingHost) continue;
      for (const [family, actionKey, inactive] of [
        ['bookmarks', 'bookmarksRecoveryAction', 'offline'], ['offline', 'offlineRecoveryAction', 'bookmarks'],
      ]) {
        const argumentsForFamily = argumentsFound.filter(expression => expression.includes(`${actionKey}:`));
        assert.equal(argumentsForFamily.length, 1, `${family} has one active-reading owner`);
        const emitted = ts.transpileModule(`function currentRecovery(grouped: boolean) { return ${argumentsForFamily[0]}; }`, {
          compilerOptions: { target: ts.ScriptTarget.ES2022 },
        }).outputText;
        const project = new Function('EMPTY_READING_DIRECTORY_RECOVERY', emitted + ';return currentRecovery;')(EMPTY_READING_DIRECTORY_RECOVERY);
        for (const action of ['reconcile', 'continue']) {
          const value = recovery(family, 'unknown', 'reading', action);
          const forwarded = project.call({ bookmarkRecovery: value }, true);
          assert.equal(forwarded[actionKey], action, `${family} forwards the current original action`);
          assert.deepEqual(forwarded[inactive], EMPTY_READING_DIRECTORY_RECOVERY[inactive]);
        }
      }
    }
  }

  for (const id of selected) {
    if (id === 'pending-busy-owner') {
      assertActualCallers();
      for (const family of ['bookmarks', 'offline']) {
        for (const currentAction of ['reconcile', 'continue'])
          assertBusy(mounted(recovery(family, 'unknown', 'reading', currentAction)), family, currentAction);
        const fixture = mounted(recovery(family, 'unknown', 'failed'));
        const queryLabel = family === 'bookmarks' ? '重新载入核对书签' : '核对离线结果';
        const query = fixture.action(queryLabel), continuation = fixture.action('继续原操作');
        fixture.button(query).onClick(); fixture.button(continuation).onClick();
        assert.deepEqual(fixture.calls, [[family, 'reconcile', 8, 'presentation-a'], [family, 'continue', 8, 'presentation-a']]);
        // Input admission must retire immediately, before a queued repaint.
        fixture.owner.presentationActive = false;
        fixture.button(query).onClick(); fixture.button(continuation).onClick(); assert.equal(fixture.calls.length, 2);
        fixture.owner.presentationActive = true; fixture.owner.recovery = { ...fixture.owner.recovery, presentationId: 'successor' };
        fixture.button(query).onClick(); fixture.button(continuation).onClick(); assert.equal(fixture.calls.length, 2);
        samples++;
      }
      const oldBusy = surfaceSource.replace("busy: this.busy(identity) && this.recoveryAction(identity) !== 'continue',",
        'busy: this.busy(identity),').replace("secondaryBusy: this.busy(identity) && this.recoveryAction(identity) === 'continue',", 'secondaryBusy: false,');
      assert.notEqual(oldBusy, surfaceSource);
      for (const family of ['bookmarks', 'offline'])
        assert.throws(() => assertBusy(mounted(recovery(family, 'unknown', 'reading', 'continue'), oldBusy), family, 'continue'), assert.AssertionError);
      const oldNotice = noticeSource.replaceAll('this.view.canRetry || this.busy || this.secondaryBusy', 'this.view.canRetry || this.busy');
      assert.notEqual(oldNotice, noticeSource);
      for (const family of ['bookmarks', 'offline'])
        assert.throws(() => assertBusy(mounted(recovery(family, 'unknown', 'reading', 'continue'), surfaceSource, oldNotice), family, 'continue'), assert.AssertionError);
      const oldBudget = noticeSource.replace('if ((this.view.canRetry || this.busy || this.secondaryBusy || this.retainPrimaryAction) && this.actionLabel.length > 0) widths.push',
        'if ((this.view.canRetry || this.busy || this.retainPrimaryAction) && this.actionLabel.length > 0) widths.push');
      assert.notEqual(oldBudget, noticeSource);
      assert.throws(() => assertBusy(mounted(recovery('offline', 'unknown', 'reading', 'continue'), surfaceSource, oldBudget),
        'offline', 'continue'), assert.AssertionError);
    }

    if (id === 'confirmed-readback') {
      const variants = [
        { family: 'bookmarks', retained: {}, expectedKind: 'readback' },
        { family: 'offline', retained: {}, expectedKind: 'readback' },
        { family: 'bookmarks', retained: { completion: 'partial', confirmedCount: 1, requestedCount: 2 }, expectedKind: 'result' },
        { family: 'offline', retained: { materializationFailure: 'network error' }, expectedKind: 'result' },
        { family: 'offline', retained: { action: 'download', progress: { failedChapters: 1, completedChapters: 1, totalChapters: 2 } }, expectedKind: 'result' },
      ];
      for (const { family, retained, expectedKind } of variants) {
        const key = family === 'bookmarks' ? 'bookmarksKind' : 'offlineKind';
        const label = family === 'bookmarks' ? '重新读取书签' : '重新读取离线状态';
        const failed = recovery(family, 'confirmed', 'failed', undefined, readingDirectoryRecovery, retained);
        const reading = recovery(family, 'confirmed', 'reading', 'reconcile', readingDirectoryRecovery, retained);
        const succeeded = recovery(family, 'confirmed', 'succeeded', undefined, readingDirectoryRecovery, retained);
        assert.equal(failed[key], expectedKind); assert.equal(reading[key], expectedKind);
        assert.equal(succeeded[key], expectedKind === 'result' ? 'result' : 'none');
        assert.equal(recovery(family, 'confirmed', 'reading')[key], 'none', 'ordinary initial read adds no recovery surface');
        const fixture = mounted(failed), retry = fixture.action(label), native = fixture.button(retry);
        assert.equal(native.enabled, true); native.onClick(); assert.deepEqual(fixture.calls, [[family, 'reconcile', 8, 'presentation-a']]);
        fixture.owner.recovery = reading; fixture.sdk.properties.flush();
        assert.equal(fixture.action(label), retry, 'explicit reading keeps the same readback child');
        assert.equal(fixture.button(retry), native, 'the paid native Button remains mounted');
        assert.equal(retry.isBusy, true); assert.equal(native.enabled, false);
        native.onClick(); assert.equal(fixture.calls.length, 1);
        spinnerRemovalPort(retry);
        fixture.owner.recovery = failed; fixture.sdk.properties.flush();
        assert.equal(fixture.action(label), retry); assert.equal(fixture.button(retry), native);
        assert.equal(retry.isBusy, false); assert.equal(native.enabled, true);
        native.onClick(); assert.equal(fixture.calls.length, 2);
        const terminal = mounted(succeeded);
        assert.equal(terminal.actions().some(action => action.label === label), false, 'a completed read removes the retry action while retaining any known partial result');
        samples++;
      }
      const oldClassification = projectionSource
        .replace("bookmarksReadbackFailed || (dir.recoveryAction !== undefined && dir.projection.receipt.readback === 'reading')", 'bookmarksReadbackFailed')
        .replace("offlineReadbackFailed || (cached.recoveryAction !== undefined && cached.projection.receipt.readback === 'reading')", 'offlineReadbackFailed');
      assert.notEqual(oldClassification, projectionSource);
      const oldProject = pureModuleProbe(oldClassification, 'ReadingDirectoryRecovery.ts',
        { readerRecoveryView, readingOfflineFailureHint }, ['readingDirectoryRecovery']).readingDirectoryRecovery;
      for (const family of ['bookmarks', 'offline']) {
        const key = family === 'bookmarks' ? 'bookmarksKind' : 'offlineKind';
        assert.equal(recovery(family, 'confirmed', 'reading', 'reconcile', oldProject)[key], 'none', 'the prior classification removes the current retry surface');
      }
      const oldRetryRow = surfaceSource.replace(
        /\(this\.readbackFailed\(identity\) \|\| \(this\.recoveryAction\(identity\) === 'reconcile' && this\.busy\(identity\)\)\) &&\s*\(this\.view\(identity\)\.canRetry \|\| this\.busy\(identity\)\)/,
        'this.readbackFailed(identity) && this.view(identity).canRetry');
      assert.notEqual(oldRetryRow, surfaceSource);
      for (const { family, retained } of variants) {
        const label = family === 'bookmarks' ? '重新读取书签' : '重新读取离线状态';
        const old = mounted(recovery(family, 'confirmed', 'reading', 'reconcile', readingDirectoryRecovery, retained), oldRetryRow);
        assert.equal(old.actions().some(action => action.label === label), false,
          'the prior row condition also removes the explicit busy retry from known result branches');
      }
    }
    recordContractCasePass(id);
  }
  console.log(JSON.stringify({ kind: 'reader-recovery-action-state', selected, samples, externalSpinnerRemovals,
    boundary: 'Actual production DTO, installed SDK children/attributes/callbacks and same native Button records. Spinner paint removal is a finite external port. Native paint/timing/touch, successful child removal and device fallback glyphs remain unverified.' }));
}
