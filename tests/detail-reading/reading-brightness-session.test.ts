import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate as drainTasks } from 'node:timers/promises';
import { ReaderBrightnessWriter } from '../../entry/src/main/ets/app/ReaderBrightnessWriter.ts';
import { readerBrightnessControlPercent, readerBrightnessSystemValue, readerBrightnessWindowValue }
  from '../../entry/src/main/ets/features/reading/ui/ReaderBrightnessCurve.ts';
import { ReaderBrightnessSession } from '../../entry/src/main/ets/features/reading/ui/ReaderBrightnessSession.ts';

test('observing native automatic brightness cannot replace a newer manual intent', async () => {
  let finishObservation: (raw: string) => void = () => {};
  const observation = new Promise<string>(resolve => { finishObservation = resolve; });
  const writes: number[] = [];
  let native = -1;
  const writer = new ReaderBrightnessWriter(async () => ({
    getWindowProperties: () => ({ brightness: native }),
    setWindowBrightness: async value => { native = value; writes.push(value); },
  }));
  let automatic = true;
  let rail = 50;
  let revision = 0;
  let observations = 0;
  const owner = new ReaderBrightnessSession({
    writer: () => writer,
    isMounted: () => true,
    observeSystemBrightness: () => { observations += 1; return observation; },
    readAutomatic: () => automatic,
    readPercent: () => rail,
    publishAutomatic: next => { automatic = next; },
    publishPercent: next => { rail = next; },
    publishRevision: () => { revision += 1; },
    reportFailure: (_operation, error) => assert.fail(error.message),
  });

  owner.refresh();
  await drainTasks();
  assert.equal(observations, 1);
  owner.toggleAutomatic();
  assert.equal(owner.automatic(), false);
  assert.equal(observations, 1);
  owner.setManual(70);
  await drainTasks();
  const manual = readerBrightnessWindowValue(70);
  assert.deepEqual(writes, [manual]);
  const acknowledged = revision;
  finishObservation('128');
  await drainTasks();
  assert.deepEqual(writes, [manual]);
  assert.equal(rail, readerBrightnessControlPercent(manual));
  assert.equal(automatic, false);
  assert.equal(revision, acknowledged);
  owner.restore();
  await drainTasks();
  assert.deepEqual(writes, [manual, -1]);
});

test('leaving automatic mode uses the latest observed setting rather than the prior rail position', async () => {
  let value = -1;
  const writer = new ReaderBrightnessWriter(async () => ({
    getWindowProperties: () => ({ brightness: value }),
    setWindowBrightness: async next => { value = next; },
  }));
  let automatic = true;
  const owner = new ReaderBrightnessSession({
    writer: () => writer,
    isMounted: () => true,
    observeSystemBrightness: () => Promise.resolve('128'),
    readAutomatic: () => automatic,
    readPercent: () => 10,
    publishAutomatic: next => { automatic = next; },
    publishPercent: () => {},
    publishRevision: () => {},
    reportFailure: (_operation, error) => assert.fail(error.message),
  });
  owner.toggleAutomatic();
  assert.equal(owner.automatic(), false);
  await drainTasks();
  assert.equal(value, readerBrightnessSystemValue('128'));
  assert.equal(automatic, false);
});
