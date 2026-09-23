import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(s, c, next) { try { return next(s, c); } catch (e) {
  if (s.startsWith('.') && !s.endsWith('.ts')) return next(s + '.ts', c); throw e;
} } });
const { ReadingSessionFlowGateway } = await import('../entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts');
const { extendReadingParagraphWindow } = await import('../entry/src/main/ets/features/reading/ReadingDocumentWindow.ts');
const { readingChapterLayoutMap } = await import('../entry/src/main/ets/features/reading/ReadingSurfaceLayoutMap.ts');
const { readingSessionDocuments } = await import('../entry/src/main/ets/features/reading/ReadingSessionDocuments.ts');
const scope = { sourceId: 's', bookId: 'b', chapterIndex: 4, bodyVersion: 'body', processingVersion: 'process' };
const baseUrl = 'https://example.org/chapter';
function fixture(content, options = {}) {
  const scalars = Array.from(content), calls = [];
  let live = true;
  const data = (start, end) => {
    const text = scalars.slice(start, end).join('');
    return { kind: 'ready', ...scope, positionScope: scope, baseUrl, content: text,
      startScalar: start, endScalar: end, totalScalars: scalars.length, hasMore: end < scalars.length,
      blocks: text.length ? [{ kind: 'text', text, startScalar: start, endScalar: end }] : [] };
  };
  const runtime = {
    supportsCoreCapability: () => true, captureReadingContentValidity: () => () => live,
    request: async (method, p, requestOptions) => {
      calls.push({ method, ...p });
      assert.ok(!requestOptions?.shouldCancel?.(), 'no request starts after cancellation');
      if (method === 'reading.entry.snapshot') {
        assert.equal(p.windowScalarLimit, 8192, 'entry must never fall back to a whole chapter RPC');
        const [start, end, anchor] = options.entry;
        return { data: { ...data(start, end), chapterTitle: '章', contentRefreshRequired: false,
          documentWindow: { startScalar: start, endScalar: end, totalScalars: scalars.length, requestedScalar: anchor },
          progress: null, navigation: null } };
      }
      assert.equal(method, 'reading.document.window', 'no whole chapter/progress/catalog commands');
      assert.ok(p.scalarLimit > 0 && p.scalarLimit <= 65536);
      assert.deepEqual(p.positionContext, { bodyVersion: 'body', processingVersion: 'process',
        anchors: [{ id: 'window', offset: p.startScalar }] });
      const end = Math.min(scalars.length, p.startScalar + Math.min(p.scalarLimit, options.maxScalars ?? Infinity));
      let answer = data(p.startScalar, end);
      if (options.mutate) answer = options.mutate(answer, p, calls.length);
      if (options.cancelAfterRequest) live = false;
      await Promise.resolve();
      return { data: answer };
    },
  };
  const chapter = (start, end) => ({ ...scope, chapterTitle: '章', chapterUrl: baseUrl,
    content: scalars.slice(start, end).join(''), contentVersion: 'same-identity', extractionVia: 'rule',
    documentRange: { startScalar: start, endScalar: end, totalScalars: scalars.length }, images: [] });
  const gateway = new ReadingSessionFlowGateway('s', 'b', { kind: 'remote', seed: { sourceId: 's', bookId: 'b' } }, runtime);
  return { runtime, gateway, chapter, data, calls, scalars, invalidate: () => { live = false; } };
}

for (const [mode, separator] of [['lineSeparated', '\r\n'], ['blankLineSeparated', '\r\n \t\r\n']]) {
  const paragraphs = ['前😀段', mode === 'blankLineSeparated' ? '目标😀\r\n原段' : '目标😀原段', '后 é אב段', '末段'];
  const text = paragraphs.join(separator), f = fixture(text);
  const start = Array.from(paragraphs[0] + separator).length;
  const end = start + Array.from(paragraphs[1]).length;
  const admitted = f.chapter(start, end);
  const before = await f.gateway.loadParagraphWindow(admitted, start, 'before', mode, () => true);
  const after = await f.gateway.loadParagraphWindow(admitted, end, 'after', mode, () => true);
  assert.ok((before.documentRange?.startScalar ?? 0) < start);
  assert.ok((after.documentRange?.endScalar ?? f.scalars.length) > end);
  for (const extended of [before, after]) {
    assert.equal(extended.contentVersion, admitted.contentVersion);
    assert.equal(extended.bodyVersion, admitted.bodyVersion);
    assert.equal(extended.chapterTitle, admitted.chapterTitle);
    assert.equal(readingChapterLayoutMap(extended).sliceByScalar(start, end), admitted.content);
    assert.equal(readingSessionDocuments(f.runtime).read('s', 'b', 4), undefined, 'partial windows never poison complete cache');
  }
}

{
  // This exceeds both entry size and one maximum RPC. The only correct shape
  // input is the whole original paragraph, including emoji and bidi context.
  const giant = '巨😀éאב'.repeat(14000), text = '首段\r\n' + giant + '\r\n末段';
  const anchor = 42000, f = fixture(text, { entry: [anchor - 4000, anchor + 4000, anchor] });
  const snapshot = await f.gateway.loadEntrySnapshot(4, () => true,
    { bodyVersion: 'body', processingVersion: 'process', anchors: [{ id: 'entry', offset: anchor }] }, 'lineSeparated');
  assert.ok(snapshot.chapter.content.includes(giant), 'no partial giant paragraph is returned for shaping');
  assert.equal(f.calls.filter(c => c.method === 'reading.entry.snapshot').length, 1);
  assert.ok(f.calls.filter(c => c.method === 'reading.document.window').length > 5);
  assert.equal(snapshot.requestedScalar, anchor);
  assert.deepEqual(snapshot.progress, { kind: 'missing' });
  assert.equal(snapshot.chapter.contentVersion.startsWith('reader-entry-scope-v1:'), true);
}

{
  const text = ('前😀段\r\n').repeat(2000) + '当前\r\n后段', f = fixture(text, { maxScalars: 128 });
  const start = Array.from(('前😀段\r\n').repeat(2000)).length;
  const result = await f.gateway.loadParagraphWindow(f.chapter(start, start + 2), start, 'before', 'lineSeparated', () => true);
  assert.ok(result.documentRange.startScalar < start, '128-part underfill still finds connected previous paragraphs');
  assert.ok(f.calls.length > 1);
}

for (const [name, mutate, pattern] of [
  ['scope', d => ({ ...d, positionScope: { ...scope, bodyVersion: 'changed' } }), /scope mismatch/],
  ['total', d => ({ ...d, totalScalars: d.totalScalars + 1, hasMore: true }), /document mismatch/],
  ['base URL', d => ({ ...d, baseUrl: 'https://changed.invalid/' }), /document mismatch/],
  ['overlap', d => { const content = 'X' + d.content.slice(1); return { ...d, content,
    blocks: [{ ...d.blocks[0], text: content }] }; }, /overlap mismatch/],
  ['no progress', (d, p) => ({ ...d, content: '中', startScalar: p.startScalar, endScalar: p.startScalar + 1,
    hasMore: true, blocks: [{ kind: 'text', text: '中', startScalar: p.startScalar, endScalar: p.startScalar + 1 }] }), /no progress/],
]) {
  const f = fixture('前\n中\n后\n末', { mutate });
  await assert.rejects(f.gateway.loadParagraphWindow(f.chapter(2, 3), 3, 'after', 'lineSeparated', () => true), pattern, name);
}
{
  const f = fixture('前\n中\n后', { cancelAfterRequest: true });
  await assert.rejects(f.gateway.loadParagraphWindow(f.chapter(2, 3), 3, 'after', 'lineSeparated', () => true), /cancelled/);
  assert.equal(f.calls.length, 1);
  await assert.rejects(f.gateway.loadParagraphWindow(f.chapter(2, 3), 3, 'after', 'lineSeparated', () => false), /cancelled/);
  assert.equal(f.calls.length, 1, 'cancelled caller never dispatches');
}
{
  const f = fixture('前\n中\n后');
  const result = await extendReadingParagraphWindow(f.runtime, f.chapter(0, 5), 5, 'after', 'lineSeparated', () => true);
  assert.equal(result.documentRange, undefined);
  assert.equal(f.calls.length, 0, 'true chapter boundary needs no expansion');
  await assert.rejects(f.gateway.loadParagraphWindow({ ...f.chapter(2, 3), sourceId: 'other' }, 3, 'after', 'lineSeparated', () => true), /cancelled/);
}
{
  // The overlap itself is an image scalar. Keep the already decoded image
  // handle and reject different metadata even when canonical text matches.
  let changed = false;
  const f = fixture('首\n中\uFFFC\n后\n末', { mutate: d => ({ ...d, blocks: [
    { kind: 'image', source: changed ? 'other.png' : 'picture.png', startScalar: 3, endScalar: 4 },
    { kind: 'text', text: d.content.slice(1), startScalar: 4, endScalar: d.endScalar },
  ] }) });
  const pixelMap = { native: 'existing' }, image = { source: 'picture.png', baseUrl, startScalar: 3, endScalar: 4,
    state: 'ready', pixelMap, fileUri: 'file://retained', intrinsicWidth: 10, intrinsicHeight: 20, revision: 'decoded' };
  const admitted = { ...f.chapter(2, 4), images: [image] };
  const result = await f.gateway.loadParagraphWindow(admitted, 4, 'after', 'lineSeparated', () => true);
  assert.equal(result.images[0], image);
  assert.equal(result.images[0].pixelMap, pixelMap);
  changed = true;
  await assert.rejects(f.gateway.loadParagraphWindow(admitted, 4, 'after', 'lineSeparated', () => true), /image mismatch/);
}
console.log('PASS paragraph windows: actual gateway/scanner, bidirectional original paragraphs, emoji/CRLF/blank lines, giant multi-RPC, part underfill, scope/overlap/no-progress/cancellation, no whole RPC or progress/cache writes');
