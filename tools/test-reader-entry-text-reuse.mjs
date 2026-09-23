import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(s, c, next) { try { return next(s, c); } catch (e) {
  if (s.startsWith('.') && !s.endsWith('.ts')) return next(s + '.ts', c); throw e;
} } });
const { readPreparedReadingEntrySnapshot, readReadingEntrySnapshot, qualifyReadingEntryWindow } =
  await import('../entry/src/main/ets/features/reading/ReadingEntrySnapshot.ts');
const { readingChapterLayoutMap, prepareReadingChapterLayoutMap } =
  await import('../entry/src/main/ets/features/reading/ReadingSurfaceLayoutMap.ts');
const { ReadingSessionFlowGateway } =
  await import('../entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts');

function fixture(content, start = 0, total = start + Array.from(content).length, anchor = start) {
  const end = start + Array.from(content).length;
  const scope = { sourceId: 'local', bookId: 'book', chapterIndex: 4, bodyVersion: 'body', processingVersion: 'process' };
  const data = { kind: 'ready', ...scope, content, chapterTitle: '第四章', baseUrl: '', contentRefreshRequired: false,
    blocks: content ? [{ kind: 'text', text: content, startScalar: start, endScalar: end }] : [],
    documentWindow: { startScalar: start, endScalar: end, totalScalars: total, requestedScalar: anchor },
    positionScope: scope, progressRevision: 'observed', navigation: null,
    progress: { ...scope, chapterOffset: anchor, chapterProgress: total ? anchor / total : 0, updatedAt: 1 } };
  const f = { data, current: true, calls: 0 };
  f.runtime = { supportsCoreCapability: () => true, captureReadingContentValidity: () => () => f.current,
    readPreparedEntry: () => data,
    request: async method => { assert.equal(method, 'reading.entry.snapshot'); f.calls++; return { data }; } };
  f.read = (mode = 'lineSeparated') => readPreparedReadingEntrySnapshot(f.runtime, 'local', 'book', undefined, () => f.current, mode);
  return f;
}

// Observe actual Unicode scans, not source text or an elapsed-time threshold.
// Production mapping, qualification and gateway handoff must share one scan.
for (const [text, start, total, anchor, mode, expected, expectedStart, expectedEnd] of [
  ['A😀é👩‍👩‍👧‍👦B', 0, undefined, 1, 'lineSeparated', 'A😀é👩‍👩‍👧‍👦B', 0, undefined],
  ['tail\r\n目标😀é אבג\r\n第二段\r\nhead', 40, 100, 49, 'lineSeparated', '目标😀é אבג\r\n第二段', 46, 60],
  ['tail\r\n\r\n目标😀\r\n原段\r\n\r\nhead', 40, 100, 51, 'blankLineSeparated', '目标😀\r\n原段', 48, 55],
]) {
  const f = fixture(text, start, total, anchor);
  const tracked = new Set([text, expected]);
  let scans = 0, separateScalarVisits = 0;
  const iterator = String.prototype[Symbol.iterator];
  const codePointAt = String.prototype.codePointAt;
  String.prototype[Symbol.iterator] = function () {
    if (tracked.has(String(this))) scans++;
    return iterator.call(this);
  };
  String.prototype.codePointAt = function (index) {
    if (tracked.has(String(this))) separateScalarVisits++;
    return codePointAt.call(this, index);
  };
  try {
    const snapshot = f.read(mode);
    assert.ok(snapshot);
    assert.equal(snapshot.chapter.content, expected);
    assert.equal(snapshot.requestedScalar, anchor);
    const map = readingChapterLayoutMap(snapshot.chapter);
    assert.equal(map.residentStart(), expectedStart);
    assert.equal(map.residentEnd(), expectedEnd ?? f.data.documentWindow.endScalar);
    assert.equal(map.scalarCount(), f.data.documentWindow.totalScalars);
    assert.equal(await prepareReadingChapterLayoutMap(snapshot.chapter, () => true), map);
    if (snapshot.chapter.documentRange === undefined)
      assert.equal(qualifyReadingEntryWindow(snapshot, mode), snapshot, 'complete chapter keeps its owner');
    const gateway = new ReadingSessionFlowGateway('local', 'book', { kind: 'local' }, f.runtime);
    gateway.admitPreparedEntry(snapshot);
    const loaded = await gateway.loadChapter('book', 4, () => true);
    assert.equal(readingChapterLayoutMap(loaded), map);
    assert.equal(scans, 1, 'validate, crop and handoff scan original Unicode only once');
    assert.equal(separateScalarVisits, 0, 'block validation reuses the map instead of separately walking code points');
    assert.equal(f.calls, 0, 'handoff cannot re-read the body');
    let utf16 = 0;
    const scalars = Array.from(expected);
    for (let index = 0; index < scalars.length; index++) {
      assert.equal(map.utf16ForScalar(expectedStart + index), utf16);
      assert.equal(map.scalarForUtf16(utf16), expectedStart + index);
      if (scalars[index].length === 2) assert.throws(() => map.scalarForUtf16(utf16 + 1), /Unicode scalar/);
      utf16 += scalars[index].length;
    }
    assert.equal(map.scalarForUtf16(utf16), map.residentEnd());
  } finally { String.prototype[Symbol.iterator] = iterator; String.prototype.codePointAt = codePointAt; }
}

{
  const f = fixture('A😀B');
  const chapter = f.read().chapter, map = readingChapterLayoutMap(chapter);
  const differentRange = { ...chapter, documentRange: { startScalar: 40, endScalar: 43, totalScalars: 100 } };
  assert.notEqual(readingChapterLayoutMap(differentRange), map, 'same text in another resident range cannot reuse a map');
  assert.notEqual(readingChapterLayoutMap({ ...chapter, content: 'AXXB' }), map, 'changed text revokes inherited owner');
  const empty = map.slice(3, 3);
  assert.equal(empty.residentStart(), 3); assert.equal(empty.residentEnd(), 3);
  assert.equal(empty.scalarCount(), 3); assert.equal(empty.utf16Length(), 0);
  assert.throws(() => map.slice(2, 1), /reversed/);
  assert.throws(() => map.slice(-1, 2), /out of range/);
}

for (const mutate of [
  d => d.blocks[0].endScalar--,
  d => d.blocks[0].endScalar++,
  d => d.blocks[0].text = 'A😀X',
  d => d.blocks.push({ kind: 'text', text: 'B', startScalar: 2, endScalar: 3 }),
  d => d.blocks = [{ kind: 'text', text: 'A😀', startScalar: 0, endScalar: 2 }],
  d => d.positionScope = { ...d.positionScope, bodyVersion: 'changed' },
]) {
  const f = fixture('A😀B'); mutate(f.data);
  assert.throws(() => f.read(), 'optimizing the map must not weaken admission');
  await assert.rejects(readReadingEntrySnapshot(f.runtime, 'local', 'book', undefined, () => true, undefined, 16384));
}

// Only bounded entry text bypasses cooperative timers. Full chapters, image
// windows and larger windows retain the existing async projection behavior.
for (const [kind, expectYield] of [['bounded-text', false], ['whole-chapter', true], ['image', true], ['over-limit', true]]) {
  const text = kind === 'over-limit' ? '甲'.repeat(66000) : 'A😀'.repeat(9000);
  const f = fixture(text);
  if (kind === 'whole-chapter') delete f.data.documentWindow;
  if (kind === 'image') {
    f.data.content += '\uFFFC';
    f.data.blocks.push({ kind: 'image', source: 'https://example.invalid/image', startScalar: 18000, endScalar: 18001 });
    f.data.documentWindow.endScalar = 18001; f.data.documentWindow.totalScalars = 18001;
  }
  let yields = 0;
  const timer = globalThis.setTimeout;
  globalThis.setTimeout = (callback, delay, ...args) => { yields++; return timer(callback, delay, ...args); };
  try {
    const snapshot = await readReadingEntrySnapshot(f.runtime, 'local', 'book', undefined, () => f.current,
      undefined, kind === 'whole-chapter' ? undefined : 61440);
    assert.equal(f.calls, 1);
    assert.equal(snapshot.chapter.content, f.data.content);
    assert.equal(yields > 0, expectYield, kind);
    if (kind === 'image') assert.equal(snapshot.chapter.images[0].state, 'pending');
  } finally { globalThis.setTimeout = timer; }
}
console.log('PASS entry text reuse: one Unicode scan through real admission/cropping/handoff, absolute emoji/CRLF/bidi offsets, strict bad-block/scope rejection, bounded text without timers and cooperative full/image paths');
