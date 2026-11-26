import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultReaderWindowMetrics } from '../../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';
import { ReaderControlMinimumState } from '../../entry/src/main/ets/features/reading/ui/ReaderControlMinimumState.ts';
import type { ReaderControlCandidateMinimum, ReaderControlCandidateWidths } from '../../entry/src/main/ets/features/reading/ui/ReaderLayoutGeometry.ts';

function minimum(widths: ReaderControlCandidateWidths, key: string): ReaderControlCandidateMinimum {
  return {
    key, widths,
    minimum: { module: 'home', quick: { heightVp: 110, minWidthVp: 120, fits: true },
      full: { heightVp: 240, minWidthVp: 140, fits: true } },
    chrome: { quickReserveVp: 40, fullReserveVp: 48, navigationHeightVp: 18, headerHeightVp: 28,
      brightnessAutoHeightVp: 22, brightnessAutoWidthVp: 22 },
  };
}

function fixture() {
  const input = { source: 'source', book: 'book', lifecycle: 1, open: 2, visit: 3, expanded: false, minimum: 0,
    identity: 'reader', environment: 'window', navigation: 5 };
  const metrics = createDefaultReaderWindowMetrics();
  const viewport = { width: 390, height: 844, expanded: false, metrics };
  const reads: string[] = [];
  const calls: string[] = [];
  const frames: (() => void)[] = [];
  let measured: ReaderControlCandidateMinimum[] = [];
  const owner = new ReaderControlMinimumState<number, string>({
    sourceId: () => { reads.push('source'); return input.source; },
    bookId: () => { reads.push('book'); return input.book; },
    lifecycleToken: () => { reads.push('lifecycle'); return input.lifecycle; },
    openRevision: () => { reads.push('open'); return input.open; },
    visitRevision: () => { reads.push('visit'); return input.visit; },
    expandedLayout: () => { reads.push('expanded'); return input.expanded; },
    minimumRevision: () => { reads.push('minimum'); return input.minimum; },
  });
  const host = {
    current: (identity: string) => identity === input.identity,
    environment: () => input.environment,
    navigationGeneration: () => input.navigation,
    location: () => ({ level: 'home' as const, module: 'directory' as const, directoryTab: 'directory' as const,
      form: 'quick' as const }),
    window: () => viewport,
    postFrame: (run: () => void) => { frames.push(run); },
    onPending: () => { calls.push('pending'); },
    onUnavailable: () => { calls.push('unavailable'); },
    canAdoptFacts: () => true,
    adoptFacts: (facts: string) => { calls.push(facts); },
    admit: (candidates: ReaderControlCandidateMinimum[]) => { measured = candidates; calls.push('admit'); },
  };
  function sampleMeasured(): ReaderControlCandidateMinimum[] {
    owner.bind(input.identity, minimum, undefined, host.environment, undefined, '');
    owner.schedule(host);
    frames.shift()!();
    return measured;
  }
  return { input, metrics, viewport, owner, host, reads, calls, frames, sampleMeasured };
}

test('control minimum fences pending frames and rejects a provider invalidated during measurement', () => {
  const { owner, input, host, frames, calls } = fixture();
  owner.bind(input.identity, minimum, undefined, host.environment, undefined, '');
  owner.schedule(host);
  input.navigation += 1;
  frames.shift()!();
  assert.deepEqual(calls, []);

  owner.schedule(host);
  input.environment = 'different window';
  frames.shift()!();
  assert.deepEqual(calls, []);

  owner.bind(input.identity, (widths, key) => {
    calls.push('measure');
    owner.invalidateRequest();
    return minimum(widths, key);
  }, undefined, host.environment, undefined, '');
  owner.schedule(host);
  frames.shift()!();
  assert.deepEqual(calls, ['pending', 'measure']);
});

test('control minimum reuses committed display facts before measurement and retires its provider on disappearance', () => {
  const { owner, input, host, frames, calls, sampleMeasured } = fixture();
  const measured = sampleMeasured();
  assert.equal(measured.length, 1);
  calls.length = 0;
  owner.bind(input.identity, minimum, () => 12, host.environment, 'display facts', 'geometry');
  owner.commitFacts();
  owner.schedule(host);
  frames.shift()!();
  assert.deepEqual(calls, ['pending', 'display facts']);

  owner.defer(measured, input.identity);
  assert.deepEqual(owner.deferred, { candidates: measured, identity: input.identity });
  owner.bind(input.identity, minimum, () => 12, host.environment, 'display facts', 'geometry');
  assert.equal(owner.deferred, undefined);
  owner.schedule(host);
  owner.retireProvider();
  frames.shift()!();
  assert.deepEqual(calls, ['pending', 'display facts']);
  assert.equal(owner.profileReader, undefined);
  owner.schedule(host);
  frames.shift()!();
  assert.deepEqual(calls, ['pending', 'display facts', 'pending', 'unavailable']);
});

test('control minimum cache reads only its original dependencies and retains geometry across a visit change', () => {
  const { owner, input, metrics, viewport, reads, sampleMeasured } = fixture();
  const measured = sampleMeasured();
  owner.commitCandidates(measured, () => viewport.width, () => viewport.height, () => metrics.revision);
  assert.deepEqual(reads.splice(0), ['source', 'book', 'lifecycle', 'open', 'visit']);
  assert.equal(owner.unprofiledReceiptCurrent(measured[0].key, () => input.identity), true);

  const initial = owner.layout(viewport.width, viewport.height, metrics);
  assert.equal(initial.minimumStatus, 'preferred');
  assert.deepEqual(reads.splice(0), ['source', 'book', 'lifecycle', 'open', 'visit', 'expanded', 'expanded', 'minimum']);
  assert.equal(owner.layout(viewport.width, viewport.height, metrics), initial);
  assert.deepEqual(reads.splice(0), ['expanded', 'minimum']);

  input.visit += 1;
  owner.invalidateLayout();
  assert.equal(owner.layout(viewport.width, viewport.height, metrics), initial);
  assert.deepEqual(reads.splice(0), ['source', 'book', 'lifecycle', 'open', 'visit', 'source', 'book', 'lifecycle',
    'expanded', 'minimum']);

  metrics.revision += 1;
  owner.revalidateEnvironment('revalidated');
  assert.equal(owner.unprofiledReceiptCurrent(measured[0].key, () => input.identity), false);
  owner.revalidateCandidateMetrics(metrics.revision);
  assert.equal(owner.layout(viewport.width, viewport.height, metrics), initial);

  input.source = 'different source';
  owner.invalidateLayout();
  assert.equal(owner.layout(viewport.width, viewport.height, metrics).minimumStatus, 'legacy');
});

test('profiled control minimum checks candidate generation before evaluating the current environment', () => {
  const { owner, input, host, frames, sampleMeasured } = fixture();
  const stale = sampleMeasured();
  owner.bind(input.identity, minimum, () => 12, host.environment, 'facts', 'geometry');
  let environmentReads = 0;
  const readEnvironment = () => { environmentReads += 1; return input.environment; };
  assert.equal(owner.acceptsProfiledCandidates(stale, input.identity, readEnvironment), false);
  assert.equal(environmentReads, 0);
  let current: ReaderControlCandidateMinimum[] = [];
  owner.schedule({ ...host, admit: (candidates) => { current = candidates; } });
  frames.shift()!();
  assert.equal(current.length, 1);
  assert.equal(owner.acceptsProfiledCandidates(current, input.identity, readEnvironment), true);
  input.environment = 'changed';
  assert.equal(owner.acceptsProfiledCandidates(current, input.identity, readEnvironment), false);
  assert.equal(environmentReads, 2);
});

test('minimum admission checks the current profile before deferring page input and reuses only matching geometry', () => {
  const { owner, input, host, frames, sampleMeasured } = fixture();
  const stale = sampleMeasured();
  const actions: string[] = [];
  let idle = false;
  let same = false;
  owner.bind(input.identity, minimum, key => { actions.push(`profile:${key}`); return 12; }, host.environment, 'facts', 'geometry');
  let candidates: ReaderControlCandidateMinimum[] = [];
  owner.schedule({ ...host, admit: measured => { candidates = measured; } });
  frames.shift()!();
  const admission = {
    current: host.current,
    environment: () => { actions.push('environment'); return input.environment; },
    inputIdle: () => { actions.push('input'); return idle; },
    location: host.location,
    window: host.window,
    matchesProfile: (profile: number) => { actions.push(`match:${profile}`); return profile === 12; },
    previousReceipt: () => { actions.push('previous'); return 'receipt'; },
    sameGeometry: (receipt: string) => { actions.push(`same:${receipt}`); return same; },
  };
  assert.deepEqual(owner.prepareAdmission(stale, input.identity, admission), { kind: 'ignored' });
  assert.deepEqual(actions, []);
  assert.deepEqual(owner.prepareAdmission([], input.identity, admission), { kind: 'unavailable' });
  assert.deepEqual(actions.splice(0), ['environment']);
  assert.deepEqual(owner.prepareAdmission(candidates, input.identity, admission), { kind: 'ignored' });
  assert.deepEqual(actions.splice(0), ['environment', 'input']);
  assert.deepEqual(owner.deferred, { candidates, identity: input.identity });
  idle = true;
  same = true;
  assert.deepEqual(owner.prepareAdmission(candidates, input.identity, admission), { kind: 'reuse', profile: 12 });
  assert.deepEqual(actions.splice(0), ['environment', 'input', `profile:${candidates[0].key}`, 'match:12',
    'previous', 'environment', 'same:receipt']);
  same = false;
  const next = owner.prepareAdmission(candidates, input.identity, admission);
  assert.equal(next.kind, 'new-profile');
  if (next.kind === 'new-profile') {
    assert.equal(next.environment, input.environment);
    assert.equal(next.layout.minimumKey, candidates[0].key);
  }
});

test('unprofiled minimums retain legacy admission and profile disagreement reports unavailable', () => {
  const { owner, input, host, frames, sampleMeasured } = fixture();
  const unprofiled = sampleMeasured();
  const admission = {
    current: host.current,
    environment: host.environment,
    inputIdle: () => true,
    location: host.location,
    window: host.window,
    matchesProfile: () => false,
    previousReceipt: () => assert.fail('a rejected profile cannot inspect the prior receipt'),
    sameGeometry: () => assert.fail('a rejected profile cannot compare geometry'),
  };
  assert.deepEqual(owner.prepareAdmission(unprofiled, input.identity, admission), { kind: 'unprofiled' });
  owner.bind(input.identity, minimum, () => 12, host.environment, 'facts', 'geometry');
  let measured: ReaderControlCandidateMinimum[] = [];
  owner.schedule({ ...host, admit: candidates => { measured = candidates; } });
  frames.shift()!();
  assert.deepEqual(owner.prepareAdmission(measured, input.identity, admission), { kind: 'unavailable' });
});
