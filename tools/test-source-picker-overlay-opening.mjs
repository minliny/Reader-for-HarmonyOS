import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) {
    if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(specifier + '.ts', context);
    throw error;
  }
} });
const { fixture, settle, deferred, rawCandidate, origin, target } = await import('./lib/source-switch-owner-probe.mjs');
const { currentSourceSwitchOwners } = await import('./lib/source-switch-current-owner-probe.mjs');
const selected = selectContractCases({
  'opening-retention': { description: 'Actual Journey/Index/Entry/Source owners preserve detail/search/shelf return and reader/directory route, scope and actor during picker open/close; stale nonreading callback negative', resources: [] },
  'target-handoff': { description: 'Actual source preview and committed target selection retain explicit reading target transition and original Host receipt semantics', resources: [] },
  'failure-retention': { description: 'Actual Host acquisition failure keeps detail/directory inactive with the current picker failure surface; explicit original-candidate retry, close and retired callbacks retain authority', resources: [] },
  'restoration-retention': { description: 'A real previous pending source switch restores its canonical entry before the next choice without starting inactive detail/directory reading', resources: [] },
});
async function settled() { await settle(); await new Promise(setImmediate); await settle(); }
const snapshot = x => ({ navigation: x.navigation.snapshot(), returns: x.navigation.returns.snapshot(),
  book: x.entry.book, session: x.entry.session, toc: x.entry.toc, scopeId: x.entry.scopeId,
  sessionGeneration: x.entry.sessionGeneration, readyGeneration: x.entry.readyGeneration,
  hostScope: x.entry.host.snapshot().scopeId });
function assertRetained(x, before) {
  assert.deepEqual(x.navigation.snapshot(), before.navigation);
  assert.deepEqual(x.navigation.returns.snapshot(), before.returns);
  for (const key of ['book','session','toc','scopeId','sessionGeneration','readyGeneration']) assert.equal(x.entry[key], before[key], key + ' retained');
  assert.equal(x.entry.host.snapshot().scopeId, before.hostScope, 'the existing entry Host is not rebound');
}
for (const id of selected) {
  if (id === 'opening-retention') {
    for (const origin of ['bookshelf','search']) for (const directory of [false,true]) {
      const f = fixture({ shared: true, open: false }), x = currentSourceSwitchOwners(f);
      x.navigation.returns.completeDetailEntry(origin, origin, false);
      x.navigation.show('detail');
      if (directory) assert.ok(x.navigation.openDirectory('detail', () => true));
      const before = snapshot(x);
      x.switchJourney.openDetail(); await settled();
      assert.equal(x.source.visible, true); assertRetained(x, before);
      const scope = x.source.scopeId;
      x.sourceActions.close(scope); await settled();
      assert.equal(x.source.visible, false); assertRetained(x, before);
      x.close(); f.host.retire();
    }
    for (const directory of [false,true]) {
      const f = fixture({ shared: true, open: false }), x = currentSourceSwitchOwners(f, { reading: true });
      if (directory) assert.ok(x.navigation.openDirectory('readerControl', () => true));
      const before = snapshot(x);
      x.switchJourney.openReader(); await settled();
      assert.equal(x.source.visible, true); assertRetained(x, before);
      x.sourceActions.close(x.source.scopeId); await settled();
      assert.equal(x.source.visible, false); assertRetained(x, before);
      x.close(); f.host.retire();
    }
    for (const route of ['reading','settings','search']) {
      const f = fixture({ shared: true, open: false }), x = currentSourceSwitchOwners(f);
      x.navigation.show(route);
      const before = snapshot(x);
      x.switchJourney.openReader(); await settled();
      assert.equal(x.source.visible, false, 'an obsolete reader callback cannot open from an unrelated current host');
      assertRetained(x, before);
      x.close(); f.host.retire();
    }
  } else if (id === 'target-handoff') {
    for (const preview of [false,true]) {
      const f = fixture({ shared: true, open: false, preview }), x = currentSourceSwitchOwners(f);
      const before = snapshot(x);
      x.switchJourney.openDetail(); await settled(); assertRetained(x, before);
      const candidate = f.candidate(); assert.ok(candidate, 'the actual discovery owner publishes the candidate');
      x.sourceActions.select(candidate, x.source.scopeId); await settled();
      assert.equal(x.navigation.snapshot().route, 'reading', 'selection retains the explicit target reader handoff');
      assert.equal(x.entry.book.sourceId, candidate.sourceId); assert.equal(x.entry.book.bookId, candidate.bookUrl);
      assert.notEqual(x.entry.scopeId, before.scopeId, 'the new target owns a new entry scope after selection');
      if (preview) assert.equal(f.host.current().write, undefined, 'a preview does not invent a persisted source-switch receipt');
      else {
        assert.equal(f.host.current().write.confirmation, 'confirmed');
        assert.ok(f.host.current().pending.transactionId, 'confirmed target retains its exact transaction until measured target commit');
      }
      x.close(); f.host.retire();
    }
  } else if (id === 'failure-retention') {
    const { readFileSync } = await import('node:fs');
    const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
    const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
    const windowFile = new URL('../entry/src/main/ets/features/source/ui/SourceSwitchWindow.ets', import.meta.url);
    const Window = selectedProductionMethods(windowFile, 'SourceSwitchWindow',
      ['requestRefresh', 'busy', 'isSweeping', 'rollbackRequired', 'requiresReconciliation', 'hasPendingRecovery', 'errorText']);
    const surfaces = readFileSync(new URL('../entry/src/main/ets/app/composition/ReaderSourceSwitchSurfaces.ets', import.meta.url), 'utf8');
    const childSources = {
      SourceSwitchPanel: readFileSync(new URL('../entry/src/main/ets/features/source/ui/SourceSwitchPanel.ets', import.meta.url), 'utf8'),
      BookDirectoryPage: readFileSync(new URL('../entry/src/main/ets/features/reading/ui/BookDirectoryPage.ets', import.meta.url), 'utf8'),
    };
    class Child {
      constructor(parent, params, _storage, id) { Object.assign(this, { owner: parent, params, id }); }
      initialRender() {}
    }
    for (const preview of [false, true]) for (const directory of [false, true]) for (const reading of [false, true]) {
      const f = fixture({ shared: true, open: false, preview, failAcquire: true });
      const x = currentSourceSwitchOwners(f, { reading });
      if (directory) assert.ok(x.navigation.openDirectory(reading ? 'readerControl' : 'detail', () => true));
      const before = snapshot(x), failures = [];
      const presentFailure = x.switchJourney.presentReaderFailure.bind(x.switchJourney);
      x.switchJourney.presentReaderFailure = () => {
        failures.push({ route: x.navigation.snapshot().route, active: x.entry.sessionActive,
          message: x.source.failureMessage, scope: x.source.scopeId });
        presentFailure();
      };
      if (reading) x.switchJourney.openReader(); else x.switchJourney.openDetail();
      await settled();
      const candidate = f.candidate(); assert.ok(candidate);
      x.sourceActions.select(candidate, x.source.scopeId); await settled();
      assert.equal(failures.length, 1, 'actual Host failure reaches the current Presentation and Journey once');
      assert.ok(failures[0].message.length > 0, 'the Host failure fact is published before its effect');
      assert.equal(x.entry.sessionActive, reading, 'a failed source choice cannot start an inactive reader');
      if (!reading) {
        assertRetained(x, before);
        assert.equal(x.source.visible, true, 'the original picker presents its current known acquisition failure');
        assert.equal(x.source.state.kind, 'failure');
        assert.equal(x.source.state.message, x.source.failureMessage);
        assert.equal(x.source.state.transactionId, undefined, 'read failure owns no durable transaction recovery');
        assert.equal(x.source.state.reconcile, undefined);
        assert.equal(x.entry.recoveryNoticeVisible(), false, 'known read failure uses the ordinary picker state');
        const { owner: surface } = createReaderBuilderProbe(surfaces, ['build'],
          { SourceSwitchPanel: Child, BookDirectoryPage: Child }, { childSources });
        Object.assign(surface, { reading: x.entry, source: x.source, manga: x.manga, actions: x.sourceActions,
          entryPickerAllowed: true, interactive: true, reduceMotion: true, consumeTopInset: true });
        surface.initialRender();
        const panel = [...surface.children.values()].find(child => child.params.currentSourceId === x.entry.book.sourceId);
        assert.ok(panel, 'the actual root surface still mounts the picker over the inactive entry');
        assert.equal(panel.params.showing, true);
        assert.equal(panel.params.state, x.source.state);
        assert.equal(panel.params.onRetry, x.sourceActions.retry);
      } else {
        assert.equal(x.navigation.snapshot().route, 'reading', 'an active reader keeps its existing failure destination');
        assert.equal(x.entry.recoveryNoticeVisible(), false, 'the existing reader failure surface owns active reading');
      }
      const originalAcquisitions = f.calls.filter(([method]) => method === 'acquire').length;
      f.options.failAcquire = false;
      if (reading) x.sourceActions.retryFailure(x.source.scopeId);
      else {
        const scope = x.source.scopeId;
        const window = Object.assign(new Window(), { mounted: true, foreground: true, selectionPending: false,
          state: x.source.state, onRetry: () => x.sourceActions.retry(scope) });
        assert.equal(window.errorText(), x.source.failureMessage);
        assert.equal(window.hasPendingRecovery(), false, 'the known read failure never becomes a write-recovery notice');
        window.requestRefresh();
      }
      await settled();
      assert.equal(x.navigation.snapshot().route, 'reading', 'explicit retry can complete the chosen target handoff');
      assert.equal(x.entry.book.sourceId, candidate.sourceId);
      assert.equal(x.entry.book.bookId, candidate.bookUrl);
      assert.equal(x.entry.recoveryNoticeVisible(), false);
      const acquisitions = f.calls.filter(([method]) => method === 'acquire');
      assert.equal(acquisitions.length, originalAcquisitions + 1, 'one explicit retry acquires the original candidate once');
      assert.deepEqual(acquisitions.at(-1)[1], acquisitions[0][1]);
      x.close(); f.host.retire();
    }
    for (const preview of [false, true]) {
      const acquireGate = deferred();
      const f = fixture({ shared: true, open: false, preview, failAcquire: true, acquireGate });
      const x = currentSourceSwitchOwners(f);
      x.switchJourney.openDetail(); await settled();
      x.sourceActions.select(f.candidate(), x.source.scopeId); await settled();
      assert.equal(f.calls.filter(([method]) => method === 'acquire').length, 1);
      x.close(); const retired = snapshot(x);
      acquireGate.resolve(); await settled();
      assertRetained(x, retired);
      assert.equal(x.entry.sessionActive, false);
      assert.equal(x.source.visible, false, 'a retired acquisition cannot open a successor failure surface');
      assert.equal(x.source.failureMessage, '', 'a retired Host suppresses the late failure effect');
      f.host.retire();
    }
    for (const invalidation of ['scope', 'navigation', 'retirement']) {
      const f = fixture({ shared: true, open: false, preview: true, failAcquire: true });
      const x = currentSourceSwitchOwners(f);
      x.switchJourney.openDetail(); await settled();
      x.sourceActions.select(f.candidate(), x.source.scopeId); await settled();
      const scope = x.source.scopeId;
      if (invalidation === 'scope') {
        x.sourceActions.close(scope); await settled();
        assert.equal(x.source.visible, false);
        assert.equal(x.source.failureMessage, '', 'explicit close dismisses this known read failure');
        assert.equal(x.entry.sessionActive, false);
        x.switchJourney.openDetail(); await settled();
      }
      else if (invalidation === 'navigation') x.navigation.advance();
      else x.close();
      const calls = f.calls.length;
      x.sourceActions.retry(scope); await settled();
      assert.equal(f.calls.length, calls, 'an obsolete picker scope cannot retry a newer source operation');
      x.close(); f.host.retire();
    }
    {
      const f = fixture({ shared: true, open: false, preview: true, failAcquire: true });
      const x = currentSourceSwitchOwners(f);
      assert.ok(x.navigation.openDirectory('detail', () => x.entry.prepareDirectory(false)));
      const opening = x.navigation.snapshot();
      let directoryBack = 0;
      x.navigation.setTemporaryBack('directory', opening.generation, f.runtime,
        () => { directoryBack += 1; return true; }, 'original-detail-directory');
      x.switchJourney.openDetail(); await settled();
      x.sourceActions.select(f.candidate(), x.source.scopeId); await settled();
      x.sourceActions.back(); await settled();
      assert.equal(x.source.visible, false);
      assert.equal(x.source.failureMessage, '');
      assert.equal(x.navigation.snapshot(), opening, 'closing the failed picker preserves the original detail directory opening');
      assert.equal(directoryBack, 0, 'picker Back consumes its own layer');
      assert.equal(x.navigation.consumeTemporaryBack(owner => owner === f.runtime, error => assert.fail(error)), true);
      assert.equal(directoryBack, 1, 'the original directory Back lease remains registered');
      x.close(); f.host.retire();
    }
  } else if (id === 'restoration-retention') {
    const previous = fixture({ shared: true, open: false });
    const previousOwners = currentSourceSwitchOwners(previous);
    previousOwners.switchJourney.openDetail(); await settled();
    previousOwners.sourceActions.select(previous.candidate(), previousOwners.source.scopeId); await settled();
    assert.equal(previous.host.current().write.confirmation, 'confirmed');
    const pending = previous.host.current().pending;
    assert.ok(pending.transactionId, 'the first real target handoff leaves its original pending receipt');
    previousOwners.close(); previous.host.retire();
    for (const directory of [false, true]) for (const reading of [false, true]) {
      // Production explicitly supports a legacy Core journal without a
      // caller-private intent. Preserve the real prior Core record while
      // giving this caller the same supported empty private-intent boundary.
      const f = fixture({ shared: true, open: false, pending: [{ ...pending }], failAcquire: true });
      const x = currentSourceSwitchOwners(f, { reading, initialBook: { ...target, contentKind: 'text' } });
      if (directory) assert.ok(x.navigation.openDirectory(reading ? 'readerControl' : 'detail',
        () => x.entry.prepareDirectory(reading)));
      const before = x.navigation.snapshot(), returns = x.navigation.returns.snapshot();
      f.setRows([{ ...rawCandidate, origin: origin.sourceId, bookUrl: origin.bookId }]);
      const request = f.runtime.request.bind(f.runtime);
      f.runtime.request = async (method, ...args) => {
        const response = await request(method, ...args);
        if (method !== 'search-book.related') return response;
        return { ...response, data: { ...response.data,
          sourceVersions: [{ sourceId: origin.sourceId, sourceVersion: 'v1', enabled: true }] } };
      };
      const restorations = [];
      const restore = x.entry.resumeRestoredSource.bind(x.entry);
      x.entry.resumeRestoredSource = (...args) => { restorations.push(args); restore(...args); };
      if (reading) x.switchJourney.openReader(); else x.switchJourney.openDetail();
      await settled();
      const candidate = f.candidate(); assert.ok(candidate, JSON.stringify({ route: x.navigation.snapshot(),
        source: x.source.state, host: f.host.current(), calls: f.calls.map(([method]) => method) }));
      assert.equal(candidate.sourceId, origin.sourceId);
      x.sourceActions.select(candidate, x.source.scopeId); await settled();
      assert.equal(f.calls.filter(([method]) => method === 'source.switch.rollback').length, 1,
        'the actual previous transaction is restored once before the new choice');
      assert.equal(x.entry.book.sourceId, origin.sourceId);
      assert.equal(x.entry.book.bookId, origin.bookId);
      assert.equal(x.entry.sessionActive, reading, 'canonical restoration cannot start an inactive reader');
      assert.equal(restorations.length, reading ? 1 : 0, 'only the originally active reader resumes a reading session');
      if (!reading) {
        assert.equal(x.navigation.snapshot(), before, 'detail and directory keep their exact navigation opening');
        assert.deepEqual(x.navigation.returns.snapshot(), returns);
        assert.equal(x.source.visible, true, 'the following known acquisition failure remains in the original picker');
        assert.equal(x.source.state.kind, 'failure');
      } else assert.equal(x.navigation.snapshot().route, 'reading');
      assert.equal(f.host.current().pending, undefined, 'the confirmed rollback retires only the previous pending record');
      assert.equal(f.calls.filter(([method]) => method === 'source.switch.commit').length, 0,
        'failed acquisition of the new choice dispatches no new source commit');
      x.close(); f.host.retire();
    }
  }
  console.log('PASS source picker ' + id + ' with actual current Journey/Index-owner composition; no native execution');
  recordContractCasePass(id);
}
