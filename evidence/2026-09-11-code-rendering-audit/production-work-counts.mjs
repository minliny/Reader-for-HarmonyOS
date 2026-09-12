import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { productionMotionMethods } from '../../tools/lib/reader-motion-method-probe.mjs';
import * as settings from '../../entry/src/main/ets/features/reading/ReaderControlSettingsGeometry.ts';
import * as actor from '../../entry/src/main/ets/features/reading/ReaderControlActorGeometry.ts';
import * as paint from '../../entry/src/main/ets/features/reading/ReaderControlMotionPresentation.ts';
import * as scroll from '../../entry/src/main/ets/features/reading/ReaderControlMorphScroll.ts';

// Executes ordinary production methods with boundary counters. This is NOT
// ArkUI reactive dispatch, native drawing, timing, or touch-to-photon evidence.
const source = name => new URL(`../../entry/src/main/ets/features/reading/${name}.ets`, import.meta.url);
const result = { scope: 'Production method call counts; synthetic inputs; no ArkUI engine or VM', settings: {}, directory: {}, highlights: {}, text: {} };
let counts;
class PathShape {
  constructor() { counts.pathShapes++; }
  commands(path) { counts.pathCommands++; this.path = path; return this; }
}
const Settings = productionMotionMethods(source('ReaderControlSettingsContent'),
  ['p', 'sharedRect', 'sharedClip', 'geometry', 'syncMorphScroll', 'fullInput', 'onFullDidScroll'],
  { ...actor, ...settings, ...paint, ...scroll, PathShape,
    sampleReaderControlSettings: (...args) => { counts.geometrySamples++; return settings.sampleReaderControlSettings(...args); },
    readerControlSettingsBar: (...args) => { counts.actorSamples++; return settings.readerControlSettingsBar(...args); },
    readerControlSettingsLabel: (...args) => { counts.actorSamples++; return settings.readerControlSettingsLabel(...args); } });
const makeSettings = () => Object.assign(new Settings(), {
  motionProgress: 0.5, availableWidth: 312, fullViewportHeight: 666,
  scrollMotion: scroll.createReaderControlMorphScroll(), interactionEnabled: false,
  getUIContext: () => ({ vp2px: value => { counts.densityReads++; return value * 3; } }),
  scroller: { currentOffset: () => { counts.scrollOffsetReads++; return { yOffset: 0 }; },
    scrollTo: () => { counts.scrollTo++; } },
});
const newCounts = () => ({ pathShapes: 0, pathCommands: 0, actorSamples: 0, geometrySamples: 0,
  densityReads: 0, scrollOffsetReads: 0, scrollTo: 0 });
for (const changing of [false, true]) {
  counts = newCounts(); const panel = makeSettings();
  for (let step = 0; step < 120; step++) {
    panel.motionProgress = changing ? (step + 0.5) / 120 : 0.5;
    panel.availableWidth = 286 + 52 * panel.motionProgress;
    for (let row = 0; row < 3; row++) for (const bar of [false, true]) {
      panel.geometry(); panel.sharedClip(row, bar);
    }
    panel.syncMorphScroll();
  }
  assert.equal(counts.pathShapes, 720); assert.equal(counts.actorSamples, 2160);
  assert.equal(counts.geometrySamples, changing ? 120 : 1);
  assert.equal(counts.scrollTo, 0);
  result.settings[changing ? '120ChangingPoses' : '120RepeatedAttributeEvaluationsAtSamePose'] = { ...counts };
}
counts = newCounts(); const panel = makeSettings(); let fullRectCases = 0; let partialRectCases = 0;
for (const height of [190, 666]) for (const offset of [0, 100, 250]) {
  for (let step = 0; step <= 120; step++) for (let row = 0; row < 3; row++) for (const bar of [false, true]) {
    panel.availableWidth = 286 + 52 * step / 120;
    const full = panel.sharedRect(row, bar, 1), current = panel.sharedRect(row, bar, step / 120);
    const rects = paint.readerControlMotionClipRects(step / 120, full, current,
      panel.sharedRect(row, bar, 0), height, offset);
    const covers = rects[0].x === 0 && rects[0].y === 0 && rects[0].width === current.width && rects[0].height === current.height;
    if (height === 666 && offset === 0) { assert.ok(covers); fullRectCases++; }
    if (!covers) partialRectCases++;
  }
}
assert.equal(fullRectCases, 726); assert.ok(partialRectCases > 0);
result.settings.clipFastPath = { fullViewportHeight: 666, scrollOffset: 0, all726ActorsFullyCovered: fullRectCases,
  partialSourceCasesAcrossOtherViewportsAndOffsets: partialRectCases,
  implication: 'Source rectangle alone covers entire local actor in the unscrolled 666vp case; partial scrolling cases must retain custom clipping' };

class Frame { constructor(callback) { this.callback = callback; } }
const Directory = productionMotionMethods(source('ReaderControlDirectoryContent'),
  ['onProgressChanged', 'captureLeadingRow', 'rowHeight', 'value'],
  { ControlDirectoryFrame: Frame, ScrollAlign: { START: 'START' }, LengthMetrics: { vp: value => value } });
for (const tab of ['chapters', 'bookmarks']) for (const atTop of [false, true]) {
  const queue = [], stats = { corrections: 0, indexReads: 0, rectReads: 0 };
  const directory = Object.assign(new Directory(), {
    mounted: true, lifecycle: 1, correctionQueued: false, tab, progress: 0,
    previousRowHeight: tab === 'bookmarks' ? 54 : 32, availableWidth: 312,
    interactionEnabled: false, snapshot: { rows: Array.from({ length: 100 }, (_, i) => ({ key: `row-${i}` })) },
    getUIContext: () => ({ postFrameCallback: cb => queue.push(cb) }),
    scroller: {
      getItemIndex: () => { stats.indexReads++; return atTop ? 0 : 42; },
      getItemRect: () => { stats.rectReads++; return { y: atTop ? 0 : -16, height: 32 }; },
      scrollToIndex: (index, animation, align, offset) => {
        assert.equal(index, atTop ? 0 : 42); assert.equal(animation, false);
        assert.equal(offset.extraOffset, directory.rowHeight() * (atTop ? 0 : 0.5)); stats.corrections++;
      },
    },
  });
  for (let i = 1; i <= 120; i++) {
    directory.progress = i / 120; directory.onProgressChanged();
    while (queue.length) queue.shift().callback();
  }
  assert.deepEqual(stats, { corrections: 120, indexReads: 1, rectReads: 1 });
  result.directory[`${tab}-${atTop ? 'atTop' : 'deepPartialRow'}`] = stats;
}

const Surface = productionMotionMethods(source('ReadingSurface'), ['drawDynamicHighlights', 'renderFragments'],
  { readerHighlightCanvasColor: value => value });
class Range { constructor(startUtf16, endUtf16) { this.startUtf16 = startUtf16; this.endUtf16 = endUtf16; } }
const TextFragment = productionMotionMethods(source('ReadingSurface'),
  ['scheduleHighlightGeometry', 'highlightRange', 'usesTtsHighlight', 'utf16ForScalar', 'highlightPrefix', 'highlightBody', 'highlightSuffix'],
  { ReaderHighlightFrame: Frame, ReadingSurfaceHighlightRange: Range });
for (const number of [12, 24, 48]) {
  const queue = [], stats = { frameCallbacks: 0, canvasClears: 0, providerReads: 0, liveFragmentVisits: 0, outputs: 0, emptyOutputs: 0 };
  const fragments = Array.from({ length: number }, (_, i) => ({ get id() { stats.liveFragmentVisits++; return `p-${i}`; } }));
  const surface = Object.assign(new Surface(), {
    highlightCanvasReady: true, staticSnapshotId: 'current-snapshot', contentRevision: 1,
    highlightTextureIdentity: 'page-current', highlightRootX: 0, highlightRootY: 0,
    layout: { viewportWidth: 400, viewportHeight: 800 }, highlightRects: new Map(),
    highlightCanvas: { clearRect: () => stats.canvasClears++, fillRect: () => assert.fail('No active highlights') },
    fragmentsProvider: () => { stats.providerReads++; return fragments; },
    onDynamicHighlights: (_id, rects) => { stats.outputs++; if (rects.length === 0) stats.emptyOutputs++; },
  });
  for (let i = 0; i < number; i++) {
    const fragment = Object.assign(new TextFragment(), {
      text: '正文片段', startScalar: i * 4, endScalar: (i + 1) * 4,
      highlightMounted: true, separateHighlight: true, highlightQueued: false,
      getUIContext: () => ({ postFrameCallback: frame => { stats.frameCallbacks++; queue.push(frame); } }),
      onHighlightGeometry: (_key, rects) => { surface.highlightRects.set(`p-${i}`, rects); surface.drawDynamicHighlights(); },
    });
    fragment.scheduleHighlightGeometry(); fragment.scheduleHighlightGeometry(); // per-fragment queue already deduplicates
  }
  while (queue.length) queue.shift().callback();
  assert.equal(stats.frameCallbacks, number); assert.equal(stats.canvasClears, number);
  assert.equal(stats.liveFragmentVisits, number * number); assert.equal(stats.emptyOutputs, number);
  result.highlights[`${number}FragmentsNoActiveHighlight`] = stats;
}

for (const highlighted of [false, true]) {
  const stats = { rangeCalls: 0, utf16Calls: 0, scalarScanIterations: 0 };
  const fragment = Object.assign(new TextFragment(), { text: '汉'.repeat(1000), startScalar: 0, endScalar: 1000,
    autoPageHighlightStart: highlighted ? 500 : undefined, autoPageHighlightEnd: highlighted ? 700 : undefined });
  const range = fragment.highlightRange, utf16 = fragment.utf16ForScalar;
  fragment.highlightRange = function () { stats.rangeCalls++; return range.call(this); };
  fragment.utf16ForScalar = function (scalar) { stats.utf16Calls++; stats.scalarScanIterations += scalar; return utf16.call(this, scalar); };
  // Reproduce the actual three length-guard / Span-evaluation call sites;
  // this counts method work, it does not execute the ArkUI builder.
  let rebuilt = '';
  for (const method of ['highlightPrefix', 'highlightBody', 'highlightSuffix']) {
    if (fragment[method]().length > 0) rebuilt += fragment[method]();
  }
  assert.equal(rebuilt, fragment.text);
  assert.equal(stats.utf16Calls, highlighted ? 12 : 0);
  result.text[highlighted ? 'ActiveHighlight500To700Of1000Scalars' : 'NoActiveHighlight'] = stats;
}
writeFileSync(new URL('production-work-counts.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
