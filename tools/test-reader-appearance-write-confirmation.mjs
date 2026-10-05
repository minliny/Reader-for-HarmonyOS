import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { ReaderAppearanceStore } from '../entry/src/main/ets/features/reading/ReaderAppearanceStore.ts';
import * as state from '../entry/src/main/ets/features/reading/ReaderAppearanceState.ts';

const source = readFileSync(new URL('../entry/src/main/ets/app/ReaderAppearancePreferences.ts', import.meta.url), 'utf8');
const initial = state.createDefaultReaderAppearanceSnapshot();
const warm = current => state.setReaderAppearanceTheme(current, 'warm', 'day');
const night = current => state.setReaderAppearanceTheme(current, 'greenNight', 'day');
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function platform() {
  const disk = { raw: JSON.stringify(initial), cache: JSON.stringify(initial), events: [], fault: '', flushGate: undefined };
  const Preferences = new Function('preferences', ...Object.keys(state),
    stripTypeScriptTypes(source.replace(/^import[\s\S]*?;\n/gm, '')).replace('export class', 'class') +
    '; return ReaderAppearancePreferences;')({ async getPreferences(context, name) {
      assert.equal(name, 'reader_appearance_v1');
      disk.events.push(['open', context.id]);
      if (disk.fault === 'open') { disk.fault = ''; throw Error('open failed before dispatch'); }
      return {
        async get(key) { assert.equal(key, 'snapshot'); disk.events.push(['get', context.id]); return disk.cache; },
        async put(key, encoded) {
          assert.equal(key, 'snapshot'); disk.events.push(['put', context.id, JSON.parse(encoded).activeTheme]);
          if (disk.fault === 'put-before') { disk.fault = ''; throw Error('put acknowledgement lost'); }
          disk.cache = encoded;
          if (disk.fault === 'put-after') { disk.fault = ''; throw Error('put acknowledgement lost'); }
        },
        async flush() {
          disk.events.push(['flush', context.id]);
          if (disk.flushGate) await disk.flushGate.promise;
          if (disk.fault === 'flush-before') { disk.fault = ''; throw Error('flush acknowledgement lost'); }
          disk.raw = disk.cache;
          if (disk.fault === 'flush-after') { disk.fault = ''; throw Error('flush acknowledgement lost'); }
        },
      };
    } }, ...Object.values(state));
  return { disk, Preferences, owner(id) { return new ReaderAppearanceStore(new Preferences({ id })); } };
}

// Matching native cache or even matching durable bytes cannot settle the lost
// receipt. A warm successor retains accepted intent and uncertainty together.
for (const fault of ['put-before', 'put-after', 'flush-before', 'flush-after']) {
  const f = platform(), old = f.owner('old');
  await old.load(); f.disk.events.length = 0; f.disk.fault = fault;
  const changed = await old.change(warm);
  await assert.rejects(changed.saved, /acknowledgement lost/);
  await tick();
  assert.equal(old.current().activeTheme, 'warm');
  assert.equal(old.current().appThemeMode, warm(initial).appThemeMode);
  assert.equal(old.hasUnsavedChanges(), true);
  assert.equal(f.disk.events.filter(e => e[0] === 'put').length, 1, 'failure must not enqueue old-theme compensation');
  if (fault === 'flush-after') assert.equal(JSON.parse(f.disk.raw).activeTheme, 'warm', 'the negative case really persisted before losing ACK');
  const successor = f.owner('successor');
  assert.equal((await successor.load()).activeTheme, 'warm', 'accepted intent survives a warm owner replacement even when put did not change cache');
  assert.equal(successor.hasUnsavedChanges(), true, 'cached matching data is not an atomic save receipt');
  await successor.flush();
  assert.equal(JSON.parse(f.disk.raw).activeTheme, 'warm');
  assert.equal(successor.hasUnsavedChanges(), false, 'a fulfilled new full-snapshot flush confirms this latest idempotent write');
  assert.deepEqual(f.disk.events.filter(e => e[0] === 'put').map(e => e[2]), ['warm', 'warm']);
}

// A failure before acquiring the store issues zero writes. Current accepted
// intent is still retryable through the existing lifecycle flush contract.
{
  const f = platform(), owner = f.owner('initial');
  await owner.load();
  // Use a distinct adapter to exercise the actual getPreferences boundary.
  const adapter = new f.Preferences({ id: 'fresh-adapter' });
  f.disk.fault = 'open';
  await assert.rejects(adapter.save(warm(initial)), /before dispatch/);
  assert.equal(adapter.hasUnconfirmedSave(), false);
  assert.equal(f.disk.events.filter(e => e[0] === 'put').length, 0);
  await adapter.save(warm(initial));
  assert.equal(JSON.parse(f.disk.raw).activeTheme, 'warm');
}

// Distinct Runtime adapters share this one preference file's IO ordering.
// The successor cannot race a delayed predecessor put/flush or overwrite it
// and then have the predecessor flush undo the later accepted choice.
for (const lostAck of [false, true]) {
  const f = platform(), first = f.owner('first'); await first.load();
  f.disk.flushGate = deferred(); if (lostAck) f.disk.fault = 'flush-after';
  const old = await first.change(warm);
  const oldResult = old.saved.then(() => 'saved', () => 'unknown');
  await tick();
  const second = f.owner('second'), newChoice = second.change(night);
  await tick();
  assert.equal(f.disk.events.filter(e => e[0] === 'open' && e[1] === 'second').length, 0);
  const gate = f.disk.flushGate; f.disk.flushGate = undefined; gate.resolve();
  assert.equal(await oldResult, lostAck ? 'unknown' : 'saved');
  const latest = await newChoice; await latest.saved;
  assert.deepEqual(f.disk.events.filter(e => e[0] === 'put').map(e => e[2]), ['warm', 'greenNight']);
  assert.equal(JSON.parse(f.disk.raw).activeTheme, 'greenNight');
  assert.equal(second.hasUnsavedChanges(), false);
}
console.log('PASS actual AppearanceStore + platform Preferences: dispatched put/flush lost ACK, no compensation, accepted-vs-confirmed state, warm owner uncertainty, exact file IO ordering and latest full-snapshot retry. Native filesystem/target receipt is separate.');
