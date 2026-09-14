import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { sampleReaderControlBookmark } from '../entry/src/main/ets/features/reading/ReaderControlBookmarkGeometry.ts';
import { createReaderBuilderProbe, readerBuilderSdkAvailable } from './lib/reader-control-builder-probe.mjs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const list = read('entry/src/main/ets/features/reading/ReaderBookmarkList.ets');
const row = read('entry/src/main/ets/features/reading/ReaderBookmarkRow.ets');
const panel = read('entry/src/main/ets/features/reading/FullDirectoryPanel.ets');
const height = Number(row.match(/export const BOOKMARK_ROW_HEIGHT = (\d+)/)[1]);
const expression = list.match(/ListItem\(\)[\s\S]*?\.width\('100%'\)\s*\.height\(([^\n]+)\)/)?.[1];
assert.ok(expression, 'actual ListItem height expression exists');
const actualHeight = new Function('BOOKMARK_ROW_HEIGHT', 'return ' + expression);
function method(src, name) {
  const start = src.indexOf('  private ' + name + '(');
  assert.ok(start >= 0, `actual method ${name}`);
  const open = src.indexOf('{', start);
  let depth = 1, end = open + 1;
  while (depth) { if (src[end] === '{') depth++; if (src[end] === '}') depth--; end++; }
  return src.slice(start, end);
}
function methods(src, names, dependencies = {}) {
  return new Function(...Object.keys(dependencies), stripTypeScriptTypes(
    'class Probe {' + names.map(n => method(src, n)).join('\n') + '}') + ';return Probe;')(...Object.values(dependencies));
}
const pendingLayoutFlushes = [];
const List = methods(list, ['rowHeight', 'stableLayoutEnabled', 'layoutRowHeightValue', 'layoutPaddingXValue',
  'onRowGeometryChanged', 'scheduleRowGeometryFlush'], {
    BOOKMARK_ROW_HEIGHT: height, sampleReaderControlBookmark,
    setTimeout: callback => pendingLayoutFlushes.push(callback),
  });
const flushLayout = () => { while (pendingLayoutFlushes.length > 0) pendingLayoutFlushes.shift()(); };
const quick = Object.assign(new List(), { motionProgress: 0, embeddedInControl: true,
  rowWidth: 254, layoutRowHeight: 0, itemSizes: { childDefaultSize: 74 }, mounted: true,
  rowGeometryGeneration: 0, rowGeometryLifecycleGeneration: 0,
  rowGeometryFlushScheduled: false, rowGeometryFlushLifecycleGeneration: -1,
  pendingRowGeometryHeight: undefined });
assert.equal(actualHeight.call(quick, height), 54,
  'actual nonempty bookmark ListItem must use restored Quick height, not fixed Full height');
const fixture = JSON.parse(read('tools/fixtures/reader-control-bookmark-live-20260906.json'));
const design = fixture.sources[0].result.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
const motion = JSON.parse(fixture.sources[1].result.content.find(c => c.type === 'text').text).nodes;
assert.equal(fixture.fileKey, 'klhs2jMM4MncaJFqZMfqEK');
assert.match(design, /left-\[11px\] overflow-clip top-0 w-\[316px\][^\n]*1841:3781/);
assert.match(design, /top-\[99px\][^\n]*1974:431/);
const near = (a, b, why = '') => assert.ok(Math.abs(a - b) < 1e-8, `${why}: ${a} != ${b}`);
function track(id, property, p) {
  const css = motion.find(n => n.nodeId === id).codeSnippets.css;
  const body = css.slice(css.indexOf('@keyframes kf_' + id.replace(':', '_') + '_' + property + '_0'));
  const value = percent => body.match(new RegExp('(?:^|\\s)' + percent + '% \\{ ' + property + ': ([^;]+);'))[1]
    .split(' ').map(Number.parseFloat);
  const a = value(0), b = value(100);
  return a.map((v, i) => v + (b[i] - v) * p);
}
for (const p of [0, .25, .5, .75, 1, .75, 0]) {
  const width = track('1841:3781', 'width', p)[0];
  const f = sampleReaderControlBookmark(p, width);
  near(f.card.height, track('1841:3781', 'height', p)[0]);
  near(f.card.width, width);
  for (const [key, id, x, y] of [['title', '1841:3782', 10, 9], ['accent', '1841:3783', 10, 33],
    ['excerpt', '1841:3784', 28, 32], ['divider', '1841:3785', 10, 73]]) {
    const delta = track(id, 'translate', p); near(f[key].x, x + delta[0]); near(f[key].y, y + delta[1]);
    if (key === 'accent' || key === 'excerpt') near(f[key].height, track(id, 'height', p)[0]);
    if (key === 'excerpt' || key === 'divider') near(f[key].width, track(id, 'width', p)[0]);
  }
  const firstY = 99 + track('1841:3781', 'translate', p)[1];
  const secondY = 99 + 74 + track('1841:3786', 'translate', p)[1];
  near(secondY - firstY, f.card.height, 'all real rows preserve source spacing, not two fake samples');
  Object.assign(quick, { motionProgress: p, rowWidth: width }); quick.onRowGeometryChanged();
  near(actualHeight.call(quick, height), f.card.height);
  assert.notEqual(quick.itemSizes.childDefaultSize, f.card.height,
    'geometry Watch must not mutate ChildrenMainSize during reconciliation');
  flushLayout();
  near(quick.itemSizes.childDefaultSize, f.card.height, 'offscreen native extent matches real materialized rows');
}
const stable = Object.assign(new List(), { motionProgress: 0.5, embeddedInControl: true,
  rowWidth: 285, layoutRowHeight: 74, itemSizes: { childDefaultSize: 74 }, mounted: true,
  rowGeometryGeneration: 0, rowGeometryLifecycleGeneration: 0,
  rowGeometryFlushScheduled: false, rowGeometryFlushLifecycleGeneration: -1,
  pendingRowGeometryHeight: undefined });
stable.onRowGeometryChanged();
flushLayout();
for (const p of [0.1, 0.25, 0.5, 0.75, 0.9]) {
  stable.motionProgress = p;
  stable.rowWidth = 254 + 62 * p;
  stable.onRowGeometryChanged();
  assert.equal(stable.layoutRowHeightValue(), 74,
    'embedded morph keeps the native bookmark extent at its endpoint layout height');
  assert.equal(stable.itemSizes.childDefaultSize, 74,
    'live bookmark visual progress cannot rewrite ChildrenMainSize');
  flushLayout();
}
quick.embeddedInControl = false; quick.motionProgress = 0; quick.onRowGeometryChanged();
flushLayout();
assert.equal(quick.rowHeight(), 74, 'standalone bookmark entry keeps existing Full geometry by default');
assert.equal(quick.itemSizes.childDefaultSize, 74);
assert.match(list, /\.childrenMainSize\(this\.itemSizes\)/);
assert.match(list, /@Prop @Watch\('onRowGeometryChanged'\) motionProgress/);
assert.match(list, /@Prop @Watch\('onRowGeometryChanged'\) layoutRowHeight/);
assert.match(list, /private stableLayoutEnabled\(\): boolean/);
assert.match(list, /private rowGeometryGeneration: number = 0;/,
  'bookmark geometry updates must carry a mutation generation');
assert.match(list, /private rowGeometryLifecycleGeneration: number = 0;/,
  'bookmark geometry updates must carry a lifecycle generation');
assert.match(list, /private scheduleRowGeometryFlush\(\): void \{[\s\S]*?setTimeout\(\(\): void => \{/,
  'bookmark extent writes must be deferred to the next turn');
assert.match(list, /\.height\(this\.layoutRowHeightValue\(\)\)/,
  'ListItem layout height is decoupled from the live bookmark card frame');
assert.match(list, /\.width\(this\.layoutViewportWidth > 0 \? this\.layoutViewportWidth : '100%'\)/);
assert.match(list, /\.height\(this\.layoutViewportHeight > 0 \? this\.layoutViewportHeight : '100%'\)/);
assert.match(list, /\.clip\(this\.stableLayoutEnabled\(\) \? false : true\)/);
assert.match(list, /motionProgress: this\.motionProgress/);
assert.match(list, /reusable: false/);
assert.match(list, /reader-bookmark-\$\{row\.bookmarkId\}/);
assert.doesNotMatch(row, /\.scale\(|animateTo\(|\.animation\(|setTimeout\(/,
  'M-02 keeps native typography stable; no independent clock or text scaling');
assert.match(panel, /rowHeight: this\.listRowHeight\(tab\)/);
assert.match(panel, /layoutRowHeight: this\.bookmarkListLayoutRowHeight\(\)/);
assert.match(panel, /layoutViewportWidth: this\.bookmarkListLayoutViewportWidth\(\)/);
assert.match(panel, /layoutViewportHeight: this\.bookmarkListLayoutViewportHeight\(\)/);
assert.match(panel, /layoutPaddingX: this\.bookmarkListLayoutPaddingX\(\)/);
assert.match(panel, /\.clip\(this\.embeddedInControl\)/,
  'bookmark outer wrapper clips the stable native viewport during a morph');
assert.match(panel, /this\.previousRowHeight = this\.listRowHeight\(tab\)/,
  'changing tabs resets the height basis, not the new tab using the previous tab row units');
const pending = [];
const Panel = methods(panel, ['controlProgress', 'controlValue', 'controlValueAt', 'panelWidth', 'innerWidth',
  'panelHeight', 'bookmarkRowWidth', 'bookmarkContentWidthAt', 'bookmarkContentHeightAt',
  'bookmarkPaddingXAt', 'bookmarkVisualRowWidthAt', 'bookmarkVisualRowHeight', 'bookmarkViewportWidthAt',
  'bookmarkViewportHeightAt', 'bookmarkListLayoutRowHeight', 'bookmarkListLayoutViewportWidth',
  'bookmarkListLayoutViewportHeight', 'bookmarkListLayoutPaddingX', 'directoryRowHeight', 'listRowHeight',
  'onMotionProgressChanged', 'scheduleDeferredMutationFlush', 'flushDeferredMutations',
  'applyMotionProgress', 'readListOffset'],
  { sampleReaderControlBookmark, BOOKMARK_ROW_HEIGHT: 74, TOK_SPACE_CONTROL_INLINE: 10,
    setTimeout: callback => pending.push(callback), Curve: { Linear: 'linear' } });
const owner = Object.assign(new Panel(), { motionProgress: 0, panelWidthOverride: 286, embeddedInControl: true,
  activeTab: 'bookmarks',
  positioningTab: 'bookmarks', positioningMounted: true, previousRowHeight: 54,
  motionStableBookmarkRowHeight: 54, motionStableBookmarkViewportWidth: 284,
  motionStableBookmarkViewportHeight: 142, motionStableBookmarkPaddingX: 15,
  bookmarkMotionDirection: 0, previousMotionProgress: 0,
  controlQuickContentWidth: 0, controlFullContentWidth: 0,
  controlQuickContentHeight: 0, controlFullContentHeight: 0,
  listPositioning: { status: 'positioned', listOpenRevision: 3 }, motionLayoutRevision: 0,
  motionActive: false, deferredMotionProgress: undefined, deferredSessionKey: undefined,
  deferredReadingAnchor: false, deferredMutationGeneration: 0, deferredLifecycleGeneration: 0,
  deferredFlushScheduled: false, deferredFlushLifecycleGeneration: -1,
  leadingRowAnchor: undefined, geometryProbeEnabled: false,
  listScroller: { offset: 270, currentOffset() { return { yOffset: this.offset }; },
    scrollTo(command) { this.offset = command.yOffset; } } });
const tabSection = panel.slice(panel.indexOf('private embeddedBody()'), panel.indexOf('this.searchControls();', panel.indexOf('private embeddedBody()')));
const tabPositions = [...tabSection.matchAll(/\.position\((\{[\s\S]*?\})\)/g)].map(m => new Function('return ' + m[1]));
assert.equal(tabPositions.length, 3, 'actual persistent tab roots and divider bindings');
for (const p of [0, .25, .5, 1]) {
  Object.assign(owner, { motionProgress: p, panelWidthOverride: 286 + 52 * p });
  const directoryTab = tabPositions[0].call(owner), bookmarkTab = tabPositions[1].call(owner), divider = tabPositions[2].call(owner);
  for (const [value, id, baseX, baseY] of [[directoryTab, '1841:3754', 9, 6],
    [bookmarkTab, '1841:3766', 169, 6], [divider, '1841:3773', 1, 42]]) {
    const delta = track(id, 'translate', p); near(value.x, baseX + delta[0]); near(value.y, baseY + delta[1]);
  }
}
owner.motionProgress = 0; owner.panelWidthOverride = 286;
for (const p of [1, .5, 0]) {
  Object.assign(owner, { motionProgress: p, panelWidthOverride: 286 + 52 * p });
  owner.onMotionProgressChanged(); while (pending.length) pending.shift()();
  const expectedOffset = p === 1 ? 370 : (p === 0 ? 270 : 370);
  near(owner.listScroller.offset, expectedOffset,
    'bookmark anchor is corrected only at settled endpoints, not every morph sample');
  near(owner.bookmarkRowWidth(), 254 + 62 * p);
  if (p > 0 && p < 1) {
    assert.equal(owner.bookmarkListLayoutRowHeight(), 54,
      'reverse morph locks the native bookmark extent to its source endpoint');
    assert.equal(owner.bookmarkListLayoutViewportHeight(), 142,
      'reverse morph keeps the native viewport stable while the outer clip shrinks');
  }
  assert.equal(owner.listPositioning.listOpenRevision, 3, 'morph never opens the list again');
}
if (readerBuilderSdkAvailable) {
  function mounted(source) {
    const { owner } = createReaderBuilderProbe(source, ['frame', 'motionBody'], {
      sampleReaderControlBookmark, BOOKMARK_ROW_HEIGHT: 74,
      BOOKMARK_EXCERPT_ACCENT: '#8C9B8466', BOOKMARK_PENDING_LABEL: '待确认' });
    Object.assign(owner, { motionProgress: 0, availableWidth: 254,
      row: { bookmarkId: 'a', chapterIndex: 2, chapterOffset: 3, chapterTitle: '旧章节', excerpt: '旧片段',
        positionLabel: '20%', timeLabel: '今天', identityStatus: 'pendingConfirmation' } });
    const calls = []; owner.onSelectBookmark = (...args) => calls.push(args);
    owner.motionBody();
    const card = owner.nodes.get(0), click = card.onClick;
    const title = [...owner.nodes.values()].find(n => n.type === 'Row');
    const excerpt = [...owner.nodes.values()].find(n => n.create === '旧片段');
    owner.row = { ...owner.row, chapterTitle: '新章节', excerpt: '新片段', bookmarkId: 'b', chapterOffset: 8 };
    for (const p of [1, .5, 0, .25, 1]) {
      Object.assign(owner, { motionProgress: p, availableWidth: 254 + 62 * p }); owner.replay();
      const f = sampleReaderControlBookmark(p, owner.availableWidth);
      assert.equal(card.clip, true, 'same real card clips its own child actors');
      near(card.height, f.card.height); near(card.width, f.card.width);
      assert.deepEqual(title.position, { x: f.title.x, y: f.title.y });
      assert.deepEqual(excerpt.position, { x: f.excerpt.x, y: f.excerpt.y });
      near(excerpt.width, f.excerpt.width); near(excerpt.height, f.excerpt.height);
      assert.equal(excerpt.create, '新片段'); assert.equal(excerpt.fontSize, 9); assert.equal(excerpt.lineHeight, 14);
      const text = [...owner.nodes.values()].find(n => n.create === '新章节');
      assert.ok(text, 'mounted title follows current business payload'); assert.equal(text.fontSize, 11); assert.equal(text.lineHeight, 14);
      for (const value of ['20%', '今天', '待确认']) assert.ok([...owner.nodes.values()].some(n => n.create === value));
    }
    click(); assert.deepEqual(calls, [['b', 2, 8, undefined]], 'retained click selects the latest exact bookmark identity/offset');
  }
  mounted(row);
  assert.throws(() => mounted(row.replace('.height(this.frame().card.height).clip(true)',
    '.height(BOOKMARK_ROW_HEIGHT).clip(true)')), /!=/,
  'reject a fixed height returned to the mounted card');
  assert.throws(() => mounted(row.replace('.height(this.frame().card.height).clip(true)',
    '.height(this.frame().card.height).clip(false)')), /real card clips/);
  console.log('Actual SDK nonempty bookmark row: mounted reversible actors, live metadata/identity and clip mutations PASS');
}
console.log('PASS bookmark production geometry, native row-height extent binding and same-open anchor continuation; NOT native visual acceptance');
