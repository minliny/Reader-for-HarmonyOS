import assert from 'node:assert/strict';
import test from 'node:test';
import { commitReadingAppearance, loadReadingAppearance } from '../../entry/src/main/ets/features/reading/application/ReadingAppearanceAdmission';
import {
  createDefaultReaderAppearanceSnapshot,
  ReaderCustomFontDescriptor,
  resolveMeasuredReaderAppearanceSnapshot,
  setReaderAppearanceFont,
  type ReaderAppearanceSnapshot,
} from '../../entry/src/main/ets/features/reading/application/ReaderAppearanceState';
import { ReaderAppearanceCommit, type ReaderAppearanceChange, type ReaderAppearanceChangeGuard } from '../../entry/src/main/ets/features/reading/application/ReaderAppearanceStore';

function makeStore(initial: ReaderAppearanceSnapshot) {
  let snapshot = initial;
  const saved = Promise.resolve();
  return {
    async load() { return snapshot; },
    current() { return snapshot; },
    set(next: ReaderAppearanceSnapshot) { snapshot = next; },
    async update(change: ReaderAppearanceChange, guard: ReaderAppearanceChangeGuard) {
      if (!guard(snapshot)) return undefined;
      snapshot = change(snapshot);
      return new ReaderAppearanceCommit(1, saved);
    },
    flush() { return saved; },
  };
}

test('font readiness restarts when the shared font changes before admission', async () => {
  const before = createDefaultReaderAppearanceSnapshot();
  const later = setReaderAppearanceFont(before, 'sans');
  const store = makeStore(before);
  const events: string[] = [];
  await loadReadingAppearance(store, () => events.push('refresh'), {
    current: () => true,
    async prepareFont(snapshot) {
      events.push(snapshot.font);
      if (snapshot === before) store.set(later);
    },
    async registerCustomFont() { assert.fail('unexpected custom registration'); },
    admit(snapshot) { assert.equal(snapshot, later); events.push('admit'); },
    observeSave() { events.push('observe'); },
    loadFailed(error) { assert.fail(error); },
  });
  assert.deepEqual(events, ['refresh', 'serif', 'sans', 'admit', 'observe']);
});

test('an unavailable persisted custom font saves the fallback before admitting it', async () => {
  const initial: ReaderAppearanceSnapshot = {
    ...createDefaultReaderAppearanceSnapshot(),
    font: 'custom',
    customFont: new ReaderCustomFontDescriptor('Test', 'ReaderTestFont', '/test/reader.ttf', 'a'.repeat(64)),
  };
  const store = makeStore(initial);
  const events: string[] = [];
  await loadReadingAppearance(store, () => events.push('refresh'), {
    current: () => true,
    async prepareFont(snapshot) { events.push(snapshot.font); },
    async registerCustomFont(snapshot) {
      assert.equal(snapshot, initial);
      events.push('register');
      return false;
    },
    admit(snapshot) { assert.equal(snapshot.font, 'serif'); events.push('admit'); },
    observeSave() { events.push('observe'); },
    loadFailed(error) { assert.fail(error); },
  });
  assert.deepEqual(events, ['refresh', 'custom', 'register', 'observe', 'serif', 'admit', 'observe']);
});

test('a retired mutation keeps observing its accepted save without publishing the view', async () => {
  const store = makeStore(createDefaultReaderAppearanceSnapshot());
  const saved = Promise.resolve();
  let current = true;
  const events: string[] = [];
  const result = await commitReadingAppearance(store, async sessionCurrent => {
    assert.equal(sessionCurrent(), true);
    return new ReaderAppearanceCommit(1, saved);
  }, {
    sessionCurrent: () => true,
    mutationCurrent: () => current,
    async prepareFont() { current = false; events.push('prepare'); },
    admit() { assert.fail('retired reading view must remain unchanged'); },
    observeSave(operation) { assert.equal(operation, saved); events.push('observe'); },
    mutationFailed(error) { assert.fail(error); },
  });
  assert.equal(result, undefined);
  assert.deepEqual(events, ['observe', 'prepare']);
});

test('new colors apply to an already measured page without changing measured spacing', () => {
  const measured = createDefaultReaderAppearanceSnapshot();
  const current: ReaderAppearanceSnapshot = { ...measured, activeTheme: 'night', fontSize: 30 };
  const projected = resolveMeasuredReaderAppearanceSnapshot(measured, current);
  assert.equal(projected.activeTheme, 'night');
  assert.equal(projected.fontSize, measured.fontSize);
  assert.equal(resolveMeasuredReaderAppearanceSnapshot(measured, measured), measured);
});
