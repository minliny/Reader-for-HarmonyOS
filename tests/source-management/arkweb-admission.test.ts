import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ArkWebJobQueue, ArkWebProxyAdmission } from '../../entry/src/main/ets/platform/network/ArkWebAdmission.ts';

test('interactive login is admitted ahead of pending checks after the current browser releases', async () => {
  const queue = new ArkWebJobQueue<void>();
  const activeJob = Promise.withResolvers<void>();
  const started: string[] = [];
  const active = queue.submit(false, async () => {
    started.push('active check');
    await activeJob.promise;
    started.push('released');
  });
  const pending = queue.submit(false, async () => { started.push('pending check'); });
  const login = queue.submit(true, async () => { started.push('login'); });

  await Promise.resolve();
  assert.deepEqual(started, ['active check']);
  activeJob.resolve();
  await Promise.all([active, pending, login]);
  assert.deepEqual(started, ['active check', 'released', 'login', 'pending check']);
});

test('missing proxy acknowledgements permit retry and cannot acknowledge a newer restoration', () => {
  const admission = new ArkWebProxyAdmission();
  const configure = admission.configuration;
  assert.equal(admission.fail(configure), true);
  assert.equal(admission.phase, 'failed');
  const firstRestore = admission.beginRestore();
  assert.ok(firstRestore);
  assert.equal(admission.acknowledge(configure), false);
  assert.equal(admission.fail(firstRestore), true);
  assert.equal(admission.phase, 'failed');
  const retry = admission.beginRestore();
  assert.ok(retry);
  assert.equal(admission.acknowledge(firstRestore), false);
  assert.equal(admission.phase, 'removing');
  assert.equal(admission.acknowledge(retry), true);
  assert.equal(admission.phase, 'retired');
});
