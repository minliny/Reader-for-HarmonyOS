import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';

const definitions = {
  'inactive-back-cleanup': {
    description: 'Actual Host cancellation and Back methods distinguish active consumed intent from inactive cleanup, with old frame retirement.',
    resources: [],
  },
};
const selected = selectContractCases(definitions);
if (selected.length) {
  registerHooks({ resolve(specifier, context, next) {
    try { return next(specifier, context); } catch (error) {
      if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier))
        return next(specifier + '.ts', context);
      throw error;
    }
  } });
  const ui = name => new URL('../entry/src/main/ets/features/reading/ui/' + name, import.meta.url);
  const source = readFileSync(ui('LocalReadingExperience.ets'), 'utf8');
  const session = await import(ui('ReaderControlSessionState.ts'));
  const hostPolicy = await import(ui('ReaderControlHostSession.ts'));
  const window = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
  const methods = ['setControlPage', 'requestControlSession', 'cancelControlNavigationIntent',
    'onControlInputActivity', 'requestExit', 'activeControlNavigationIntent', 'controlMinimumIdentity',
    'controlMinimumCommittedIdentity', 'controlMinimumOwnerKey', 'controlMinimumEnvironmentKey',
    'controlMinimumCurrent', 'scheduleControlMinimum', 'hideControl', 'openReaderControl',
    'controlVisible', 'controlPage'];
  const make = (mutate = text => text) => {
    const metrics = window.createDefaultReaderWindowMetrics();
    const frames = [];
    let normalBackChecks = 0, exitCalls = 0, measureCalls = 0;
    const owner = createReaderBuilderProbe(mutate(source), methods, {
      ...session, ...hostPolicy,
      ReaderWindowCoordinator: { metrics: () => metrics },
      ReaderUIFrameCallback: class { constructor(onFrame) { this.onFrame = onFrame; } },
      readerControlKeyboardVisible: () => false,
      consumeReaderControlKeyboardBack: () => false,
      cancelReaderRapidPageTurn: state => state,
      measureReaderControlMinimumCandidates: () => { throw Error('retired frame reached measurement'); },
    }).owner;
    const home = session.openReaderControlSession(session.createReaderControlSessionState(), 0);
    Object.assign(owner, { mounted: true, exitRequested: false, sourceId: 'source', bookId: 'book',
      lifecycleToken: 1, controlOpenRevision: 1, controlModuleVisitRevision: 1,
      controlNavigationGeneration: 0, controlMinimumGeneration: 0,
      controlSession: home, latestControlVisualSession: session.copyReaderControlSessionState(home),
      controlPresentationReceipt: {}, controlMinimumReady: true, appForeground: true,
      windowChromeActive: true, windowChromeOverlayActive: false, interactionBlocked: false, controlObscured: false,
      expandedLayout: false, rapidPageTurnState: {},
      isSessionActive: token => owner.mounted && token === owner.lifecycleToken,
      isControlInputEnabled: () => true, isReaderPageInteractionEnabled: () => true,
      pageTurnOwnsReaderInput: () => false, readerRecoveryRequestCurrent: () => false,
      invalidateControlBackdrop() {}, dismissControlTemporaryLayers() {}, retireReaderRecovery() {},
      loadContentMetricsIfNeeded: async () => {}, refreshReaderBrightness() {},
      controlKeyboardHost: () => { normalBackChecks++; return {}; }, beginExit: () => { exitCalls++; },
      controlTiming: () => ({ showDurationMs: 100, dismissDurationMs: 100, morphDurationMs: 0, navigateDurationMs: 0 }),
      effectiveViewportWidth: () => 390, effectiveViewportHeight: () => 844,
      getUIContext: () => ({ postFrameCallback: frame => frames.push(frame) }),
    });
    const queueFrame = () => {
      owner.controlMinimumProviderIdentity = owner.controlMinimumIdentity();
      owner.controlMinimumProvider = () => { measureCalls++; throw Error('retired provider ran'); };
      owner.controlMinimumProviderEnvironment = owner.controlMinimumEnvironmentKey();
      owner.controlMinimumProviderFactsKey = 'target';
      owner.scheduleControlMinimum();
      assert.equal(frames.length, 1);
      return frames.shift();
    };
    return { owner, queueFrame, normalBackChecks: () => normalBackChecks,
      exitCalls: () => exitCalls, measureCalls: () => measureCalls };
  };
  const verifyInactive = (mutate = text => text) => {
    const closing = make(mutate);
    closing.owner.setControlPage('moduleTts');
    const oldFrame = closing.queueFrame();
    assert.ok(closing.owner.activeControlNavigationIntent());
    closing.owner.hideControl();
    closing.owner.latestControlVisualSession = session.copyReaderControlSessionState(closing.owner.controlSession);
    assert.ok(closing.owner.controlNavigationIntent, 'closed intent object still needs cleanup');
    assert.equal(closing.owner.activeControlNavigationIntent(), undefined);
    closing.owner.requestExit();
    assert.equal(closing.normalBackChecks(), 1, 'inactive cleanup must continue the same Back dispatch');
    assert.equal(session.readerControlTargetLocation(closing.owner.controlSession).level, 'hidden');
    assert.equal(closing.exitCalls(), 0, 'closing control Back stays in its existing control dismissal path');
    oldFrame.onFrame(0);
    assert.equal(closing.measureCalls(), 0);
    const reopened = make(mutate);
    reopened.owner.setControlPage('moduleAppearance');
    reopened.owner.hideControl();
    reopened.owner.controlSession = session.advanceReaderControlSession(reopened.owner.controlSession, 1000,
      reopened.owner.controlSession.epoch);
    reopened.owner.latestControlVisualSession = session.copyReaderControlSessionState(reopened.owner.controlSession);
    assert.equal(reopened.owner.controlVisible(), false);
    reopened.owner.openReaderControl();
    reopened.owner.latestControlVisualSession = session.copyReaderControlSessionState(reopened.owner.controlSession);
    assert.equal(reopened.owner.controlVisible(), true);
    assert.equal(session.sampleReaderControlSession(reopened.owner.controlSession).visibilityProgress, 0);
    reopened.owner.requestExit();
    assert.equal(reopened.normalBackChecks(), 1, 'first Back after actual hide/open does not get swallowed by an old object');
    assert.equal(session.readerControlTargetLocation(reopened.owner.controlSession).level, 'hidden',
      'the first Back targets the hidden control endpoint');
    assert.equal(reopened.exitCalls(), 0, 'the first control Back does not exit the book');
  };
  for (const id of selected) {
    const active = make();
    active.owner.setControlPage('moduleTts');
    const oldFrame = active.queueFrame();
    active.owner.requestExit();
    assert.equal(active.owner.controlNavigationIntent, undefined);
    assert.equal(active.normalBackChecks(), 0, 'active pending Back is consumed by intent cancellation');
    oldFrame.onFrame(0);
    assert.equal(active.measureCalls(), 0);
    verifyInactive();
    const mismatches = [
      { label: 'book', apply: owner => { owner.bookId = 'successor'; } },
      { label: 'source', apply: owner => { owner.sourceId = 'successor'; } },
      { label: 'lifecycle', apply: owner => { owner.lifecycleToken++; } },
      { label: 'opening', apply: owner => { owner.controlOpenRevision++; } },
      { label: 'module visit', apply: owner => { owner.controlModuleVisitRevision++; } },
      { label: 'generation', apply: owner => { owner.controlNavigationGeneration++; } },
      { label: 'hidden', apply: owner => { owner.controlSession = session.dismissReaderControlSession(owner.controlSession, 0); } },
    ];
    for (const mismatch of mismatches) {
      const host = make(); host.owner.setControlPage('moduleTts');
      const frame = host.queueFrame();
      mismatch.apply(host.owner);
      const generation = host.owner.controlMinimumGeneration;
      assert.equal(host.owner.activeControlNavigationIntent(), undefined, mismatch.label + ' retires active intent');
      assert.equal(host.owner.cancelControlNavigationIntent(), false, mismatch.label + ' is cleanup without Back consumption');
      assert.equal(host.owner.controlNavigationIntent, undefined);
      assert.equal(host.owner.controlMinimumGeneration, generation + 1, 'old measurement generation still retires');
      frame.onFrame(0); assert.equal(host.measureCalls(), 0);
    }
    const empty = make();
    assert.equal(empty.owner.cancelControlNavigationIntent(), false);
    assert.equal(empty.owner.controlMinimumGeneration, 0, 'no intent has no cancellation side effect');
    empty.owner.controlSession = session.createReaderControlSessionState();
    empty.owner.latestControlVisualSession = session.copyReaderControlSessionState(empty.owner.controlSession);
    empty.owner.requestExit();
    assert.equal(empty.exitCalls(), 1, 'normal hidden Back reaches the existing exit path');
    const old = text => text.replace('return consumed;', 'return true;');
    assert.notEqual(old(source), source);
    assert.throws(() => verifyInactive(old), /inactive cleanup must continue/,
      'the former unconditional consumed result is rejected');
    console.log(JSON.stringify({ kind:id,status:'PASS',activePendingConsumed:true,
      closingAndActualReopenBack:true,inactiveOwnerCases:mismatches.length,
      oldFramesRejected:9,undefinedNoSideEffect:true,normalHiddenExit:true,oldConsumedNegative:1,
      boundary:'Actual SDK-lowered production ordinary methods and real session policies. Platform/observer delivery is a finite port; Native Back dispatch NOT_RUN.' }));
    recordContractCasePass(id);
  }
}
