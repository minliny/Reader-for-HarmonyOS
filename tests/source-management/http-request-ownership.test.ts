import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HttpActiveRequests, HttpDnsHopQueue, HttpDnsPinOwnership, waitForHttpDnsMutation, type HttpDnsAdmission } from
  '../../entry/src/main/ets/platform/network/HttpRequestOwnership.ts';

test('cancelling a shared request ID visits all active operations and respects exact release', () => {
  const active = new HttpActiveRequests<object>();
  const first = {};
  const second = {};
  const unrelated = {};
  active.track(7, first);
  active.track(7, second);
  active.track(8, unrelated);
  const drained: object[] = [];
  active.forEach(7, (operation) => drained.push(operation));
  assert.deepEqual(drained, [first, second]);
  active.release(7, second);
  const remaining: object[] = [];
  active.forEach(7, (operation) => remaining.push(operation));
  assert.deepEqual(remaining, [first]);
});

test('matching clean direct DNS proofs share a pin from first send until the last release', async () => {
  const host = 'example.test';
  const events: string[] = [];
  const firstSent = Promise.withResolvers<void>();
  const firstDone = Promise.withResolvers<void>();
  const secondDone = Promise.withResolvers<void>();
  const target: HttpDnsAdmission = { route: 'direct', addresses: ['192.0.2.10'], directAdmissionScope: 'source:net1' };
  const queue = new HttpDnsHopQueue<HttpDnsAdmission, string>({
    recover: async () => { events.push('recover'); },
    install: async () => { events.push('pin'); },
    release: async () => { events.push('unpin'); },
  });
  const first = queue.enqueue(host, {
    assertCurrent() {},
    async admit() { events.push('admit1'); return target; },
    async send() { events.push('send1'); firstSent.resolve(); await firstDone.promise; return 'one'; },
  });
  const second = queue.enqueue(host, {
    assertCurrent() {},
    async admit() { events.push('admit2'); return target; },
    async send() { events.push('send2'); await secondDone.promise; return 'two'; },
  });
  try {
    await firstSent.promise;
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(events, ['recover', 'admit1', 'admit2', 'pin', 'send1', 'send2']);
    firstDone.resolve();
    assert.equal(await first, 'one');
    assert.equal(events.includes('unpin'), false);
    secondDone.resolve();
    assert.deepEqual(await Promise.all([first, second]), ['one', 'two']);
    assert.equal(events.at(-1), 'unpin');
  } finally {
    firstDone.resolve();
    secondDone.resolve();
    await Promise.allSettled([first, second]);
  }
});

test('different addresses, network scopes and later arrivals need a fresh clean admission', async () => {
  const host = 'example.test';
  const firstTarget: HttpDnsAdmission = {
    route: 'direct', addresses: ['192.0.2.10'], directAdmissionScope: 'source:net1',
  };
  for (const laterTarget of [
    { ...firstTarget, addresses: ['192.0.2.11'] },
    { ...firstTarget, directAdmissionScope: 'source:net2' },
    { ...firstTarget, directAdmissionScope: 'webdav:net1' },
    firstTarget,
  ]) {
    const release = Promise.withResolvers<void>();
    const sending = Promise.withResolvers<void>();
    let pinned = false;
    let maxConcurrent = 0;
    let active = 0;
    let installs = 0;
    let laterAdmissions = 0;
    const queue = new HttpDnsHopQueue<HttpDnsAdmission, void>({
      recover: async () => { assert.equal(pinned, false); },
      install: async () => { assert.equal(pinned, false); pinned = true; installs += 1; },
      release: async () => { assert.equal(active, 0); pinned = false; },
    });
    const first = queue.enqueue(host, {
      assertCurrent() {},
      admit: async () => firstTarget,
      async send() {
        active += 1;
        maxConcurrent = Math.max(maxConcurrent, active);
        sending.resolve();
        await release.promise;
        active -= 1;
      },
    });
    const enqueueLater = () => queue.enqueue(host, {
      assertCurrent() {},
      async admit() { assert.equal(pinned, false); laterAdmissions += 1; return laterTarget; },
      async send() {
        active += 1;
        maxConcurrent = Math.max(maxConcurrent, active);
        active -= 1;
      },
    });
    // Same-proof launch after the first pin belongs to a different cohort.
    if (laterTarget === firstTarget) await sending.promise;
    const later = enqueueLater();
    try {
      await sending.promise;
      assert.equal(installs, 1);
      if (laterTarget === firstTarget) assert.equal(laterAdmissions, 0);
      release.resolve();
      await Promise.all([first, later]);
      assert.equal(maxConcurrent, 1);
      assert.equal(installs, 2);
      assert.equal(laterAdmissions, laterTarget === firstTarget ? 1 : 2);
    } finally {
      release.resolve();
      await Promise.allSettled([first, later]);
    }
  }
});

test('a timed-out DNS caller leaves the original add and cleanup owned until their real acknowledgements', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const ownership = new HttpDnsPinOwnership();
  const host = 'example.test';
  const add = Promise.withResolvers<void>();
  const remove = Promise.withResolvers<void>();
  let removals = 0;
  const registration = ownership.add(host, () => add.promise);
  const waiting = waitForHttpDnsMutation(registration, 3000, () => new Error('add timed out'));
  let failure: Error | undefined;
  const outcome = waiting.catch((error: Error) => { failure = error; });
  try {
    t.mock.timers.tick(3000);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.match(failure?.message ?? '', /add timed out/);
    const removal = ownership.clear(host, () => { removals += 1; return remove.promise; });
    assert.equal(ownership.clear(host, async () => { assert.fail('duplicate removal'); }), removal);
    await assert.rejects(ownership.add(host, async () => {}), /still owned/);
    assert.equal(removals, 0);
    add.resolve();
    await registration;
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(removals, 1);
    await assert.rejects(ownership.add(host, async () => {}), /still owned/);
    remove.resolve();
    await removal;
    await ownership.add(host, async () => {});
  } finally {
    add.resolve();
    remove.resolve();
    await outcome;
  }
});
