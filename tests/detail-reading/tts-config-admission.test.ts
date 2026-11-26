import assert from 'node:assert/strict';
import test from 'node:test';
import {
  admitInitialReaderTts, admitReaderTtsRate, ReaderTtsPreparation, type ReaderTtsInitialAdmission, type ReaderTtsRateAdmission,
  type ReaderTtsPreparationIntent, type ReaderTtsWarmupOwner,
} from '../../entry/src/main/ets/features/reading/application/ReaderTtsConfigAdmission.ts';
import type { ReaderTtsConfig } from '../../entry/src/main/ets/features/reading/application/ReaderTtsGateway.ts';
import {
  readerTtsCoreRateForMultiplier, readerTtsMultiplierForConfig, readerTtsRatePercentForMultiplier,
} from '../../entry/src/main/ets/features/reading/application/ReaderTtsState.ts';

const probeConfig: ReaderTtsConfig = { engine: 'system', rate: 4, ratePercent: 75, pitch: 0, followSys: false };

function probeFixture() {
  const calls: Array<string | number> = [];
  const probe = {
    probeAvailability: async (): Promise<boolean> => { calls.push('probe'); return true; },
    getProbedConfig: (): ReaderTtsConfig => { calls.push('read'); return probeConfig; },
    setRate: async (rate: number): Promise<void> => { calls.push(rate); },
  };
  const owner: ReaderTtsInitialAdmission = {
    isCurrent: (): boolean => true,
    isConfigCurrent: (): boolean => true,
    admitConfig: (config: ReaderTtsConfig | undefined): void => { assert.equal(config, probeConfig); calls.push('admit'); },
    resolveAvailability: (): void => { calls.push('resolve'); },
    reportFailure: (stage: 'initial-rate' | 'initialization', _error: Error): void => { calls.push(stage); },
  };
  return { calls, probe, owner };
}

test('TTS initial admission publishes availability after installing the versioned rate', async () => {
  const { calls, probe, owner } = probeFixture();
  assert.equal(await admitInitialReaderTts(probe, owner), true);
  assert.deepEqual(calls, ['probe', 'read', 'admit', 0.75, 'resolve']);
  assert.equal(readerTtsCoreRateForMultiplier(0.75), 4);
  assert.equal(readerTtsRatePercentForMultiplier(0.75), 75);
  assert.equal(readerTtsMultiplierForConfig(4), 0.8);
  assert.equal(readerTtsMultiplierForConfig(4, 75.5), 0.8);
  assert.equal(readerTtsMultiplierForConfig(4, 201), 0.8);
});

test('TTS initial admission skips an old config and rechecks the generation after admission', async () => {
  const { calls, probe, owner } = probeFixture();
  let configCurrent = false;
  owner.isConfigCurrent = (): boolean => configCurrent;
  assert.equal(await admitInitialReaderTts(probe, owner), true);
  assert.deepEqual(calls, ['probe', 'read', 'resolve']);

  calls.length = 0;
  configCurrent = true;
  owner.admitConfig = (): void => { calls.push('admit'); configCurrent = false; };
  assert.equal(await admitInitialReaderTts(probe, owner), true);
  assert.deepEqual(calls, ['probe', 'read', 'admit', 'resolve']);
});

test('TTS initial admission suppresses a late rate failure and result after owner retirement', async () => {
  const { calls, probe, owner } = probeFixture();
  let current = true;
  owner.isCurrent = (): boolean => current;
  probe.setRate = async (): Promise<void> => { calls.push('rate'); current = false; throw new Error('retired'); };
  assert.equal(await admitInitialReaderTts(probe, owner), false);
  assert.deepEqual(calls, ['probe', 'read', 'admit', 'rate']);
});

test('TTS initial admission reports current probe and rate failures with their original ordering', async () => {
  const { calls, probe, owner } = probeFixture();
  probe.setRate = async (): Promise<void> => { calls.push('rate'); throw new Error('rate'); };
  assert.equal(await admitInitialReaderTts(probe, owner), true);
  assert.deepEqual(calls, ['probe', 'read', 'admit', 'rate', 'initial-rate', 'resolve']);

  calls.length = 0;
  probe.probeAvailability = async (): Promise<boolean> => { throw new Error('probe'); };
  assert.equal(await admitInitialReaderTts(probe, owner), false);
  assert.deepEqual(calls, ['resolve', 'initialization']);
});

function rateFixture() {
  const calls: string[] = [];
  const transport = { setRate: async (rate: number): Promise<void> => { calls.push(`transport:${rate}`); } };
  const owner: ReaderTtsRateAdmission = {
    isCurrent: (): boolean => true,
    persistRate: async (rate: number): Promise<void> => { calls.push(`persist:${rate}`); },
    presentPendingReconciliation: (): boolean => { calls.push('inspect receipt'); return false; },
    declineRate: (): void => { calls.push('decline'); },
    reportFailure: (error: Error): void => { calls.push(`report:${error.message}`); },
  };
  return { calls, transport, owner };
}

test('TTS rate change persists the accepted live rate only for a current owner', async () => {
  const { calls, transport, owner } = rateFixture();
  await admitReaderTtsRate(transport.setRate, 1.25, 1, owner);
  assert.deepEqual(calls, ['transport:1.25', 'persist:1.25']);

  calls.length = 0;
  owner.isCurrent = (): boolean => false;
  await admitReaderTtsRate(transport.setRate, 1.25, 1, owner);
  assert.deepEqual(calls, ['transport:1.25']);
});

test('an unconfirmed TTS config write goes to reconciliation with the live rate retained', async () => {
  const { calls, transport, owner } = rateFixture();
  owner.persistRate = async (): Promise<void> => { calls.push('persist'); throw new Error('missing response'); };
  owner.presentPendingReconciliation = (): boolean => { calls.push('present receipt'); return true; };
  await admitReaderTtsRate(transport.setRate, 1.25, 1, owner);
  assert.deepEqual(calls, ['transport:1.25', 'persist', 'present receipt']);
});

test('a confirmed TTS rate failure restores the prior live rate before decline and reporting', async () => {
  const { calls, transport, owner } = rateFixture();
  owner.persistRate = async (): Promise<void> => { calls.push('persist'); throw new Error('write failed'); };
  await admitReaderTtsRate(transport.setRate, 1.25, 1, owner);
  assert.deepEqual(calls, ['transport:1.25', 'persist', 'inspect receipt', 'transport:1', 'decline', 'report:write failed']);
});

test('TTS rollback completion declines only while its intent remains current', async () => {
  const { calls, transport, owner } = rateFixture();
  let current = true;
  owner.isCurrent = (): boolean => current;
  owner.persistRate = async (): Promise<void> => { calls.push('persist'); throw new Error('write failed'); };
  transport.setRate = async (rate: number): Promise<void> => {
    calls.push(`transport:${rate}`);
    if (rate === 1) { current = false; throw new Error('rollback failed'); }
  };
  await admitReaderTtsRate(transport.setRate, 1.25, 1, owner);
  assert.deepEqual(calls, ['transport:1.25', 'persist', 'inspect receipt', 'transport:1', 'report:write failed']);
});

test('TTS setup shares an in-flight probe and allows a retry independent of optional metadata', async () => {
  const host = new ReaderTtsPreparation();
  const metadata = Promise.withResolvers<void>();
  const availability = Promise.withResolvers<boolean>();
  const { calls, probe } = probeFixture();
  const intent: ReaderTtsPreparationIntent = {
    probe: { ...probe, probeAvailability: () => { calls.push('probe'); return availability.promise; } },
    isCurrent: () => true,
    loadMetadata: () => { calls.push('metadata'); return metadata.promise; },
    admitConfig: () => { calls.push('admit'); },
    reportFailure: () => assert.fail('no failure expected'),
  };
  const operation = host.initialize(false, () => true, () => intent);
  assert.deepEqual(calls, ['metadata', 'probe']);
  assert.equal(host.initialize(true, () => true, () => assert.fail('probe still pending')), operation);
  availability.resolve(true);
  assert.equal(await operation, true);
  assert.equal(host.resolved(), true);
  assert.equal(host.initialize(false, () => true, () => assert.fail('first result is retained')), operation);
  assert.equal(await host.initialize(true, () => true, () => intent), true);
  assert.deepEqual(calls, ['metadata', 'probe', 'read', 'admit', 0.75, 'probe', 'read', 'admit', 0.75]);
  metadata.resolve();
});

test('a newer configuration intent retires the cold rate while keeping the availability result', async () => {
  const host = new ReaderTtsPreparation();
  const availability = Promise.withResolvers<boolean>();
  const { calls, probe } = probeFixture();
  const operation = host.initialize(false, () => true, () => ({
    probe: { ...probe, probeAvailability: () => availability.promise },
    isCurrent: () => true,
    loadMetadata: () => Promise.resolve(),
    admitConfig: () => assert.fail('stale config cannot publish'),
    reportFailure: () => assert.fail('no failure expected'),
  }));
  const configure = host.beginConfiguration();
  availability.resolve(true);
  assert.equal(await operation, true);
  assert.equal(host.resolved(), true);
  assert.deepEqual(calls, ['read']);
  host.reset();
  assert.equal(configure(), true);
  assert.equal(host.resolved(), false);
});

test('TTS warmup posts once and an old callback cannot release the current reader reservation', async () => {
  const host = new ReaderTtsPreparation();
  const callbacks: Array<() => void> = [];
  let reader = 1;
  let ready = false;
  const initialized: number[] = [];
  const capture = (): ReaderTtsWarmupOwner => {
    const mounted = reader;
    return { postFrame: callback => callbacks.push(callback), isMounted: () => mounted === reader,
      isReady: () => ready, initialize: async () => { initialized.push(mounted); return true; } };
  };
  host.scheduleWarmup(false, capture);
  host.scheduleWarmup(false, capture);
  assert.equal(callbacks.length, 1);
  reader += 1;
  host.reset();
  host.scheduleWarmup(false, capture);
  callbacks[0]();
  host.scheduleWarmup(false, capture);
  assert.equal(callbacks.length, 2);
  callbacks[1]();
  assert.deepEqual(initialized, []);
  host.scheduleWarmup(true, capture);
  assert.equal(callbacks.length, 2);
  host.scheduleWarmup(false, capture);
  ready = true;
  callbacks[2]();
  assert.deepEqual(initialized, [2]);
});

test('configuration retains the original rejection and only the current operation notifies the reader', async () => {
  const host = new ReaderTtsPreparation();
  const first = Promise.withResolvers<void>();
  const second = Promise.withResolvers<void>();
  const calls: string[] = [];
  const old = host.configure(1, id => { assert.equal(id, 1); return first.promise; }, () => true, () => calls.push('old'));
  const current = host.configure(2, id => { assert.equal(id, 2); return second.promise; }, () => true, () => calls.push('current'));
  first.reject(new Error('old'));
  second.reject(new Error('current'));
  await Promise.all([assert.rejects(old, /old/), assert.rejects(current, /current/)]);
  assert.deepEqual(calls, ['current']);
});
