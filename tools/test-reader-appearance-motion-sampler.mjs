import assert from 'node:assert/strict';

import {
  READER_APPEARANCE_ACTOR_TRACKS,
  READER_APPEARANCE_FIGMA_N_SOURCE_EVIDENCE_AVAILABLE,
  READER_APPEARANCE_SHARED_GEOMETRY_END_PROGRESS,
  readerAppearanceFigmaFramePercent,
  readerAppearanceGrabberScreenYFromMasterProgress,
  readerAppearanceMasterProgressFromScreenY,
  readerAppearanceMotionViewportHeight,
  readerAppearanceMotionViewportWidth,
  sampleReaderAppearanceMasterProgress,
} from '../entry/src/main/ets/features/reading/ReaderAppearanceMotionGeometry.ts';

function close(actual, expected, message, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, got ${actual}`);
}

assert.equal(READER_APPEARANCE_FIGMA_N_SOURCE_EVIDENCE_AVAILABLE, true);
assert.equal(READER_APPEARANCE_ACTOR_TRACKS.length, 29);
assert.equal(new Set(READER_APPEARANCE_ACTOR_TRACKS.map((entry) => entry.id)).size, 29);
close(READER_APPEARANCE_SHARED_GEOMETRY_END_PROGRESS, 10 / 23,
  'Quick subtree geometry endpoint');

const axis = { quickGrabberScreenY: 760, fullGrabberScreenY: 280 };
for (const p of [0, 0.25, 0.5, 0.75, 1]) {
  const screenY = readerAppearanceGrabberScreenYFromMasterProgress(p, axis);
  close(readerAppearanceMasterProgressFromScreenY(screenY, axis), p,
    `screenY round trip p=${p}`);
  close(sampleReaderAppearanceMasterProgress(p).figmaFramePercent,
    readerAppearanceFigmaFramePercent(p), `Figma review position p=${p}`);
}

const quick = sampleReaderAppearanceMasterProgress(0);
close(quick.shellHeight, 330, 'Quick MorphStage height');
close(quick.shellTranslateY, 406, 'Quick MorphStage translateY');
close(quick.quickMorph.x, 13, 'QuickMorph local x');
close(quick.quickMorph.y, 57, 'QuickMorph local y');
close(quick.quickMorph.width, 286, 'QuickMorph source width');
close(quick.quickMorph.height, 190, 'QuickMorph source height');
close(quick.quickMorph.translateX, -0.896, 'QuickMorph source translateX');
close(quick.quickMorph.translateY, -28.007, 'QuickMorph source translateY');
close(quick.quickMorph.opacity, 1, 'QuickMorph source opacity');

// These are composed on screen as MorphStage + QuickMorph + child. Keeping
// them separate in the sampler is what prevents the previous flattened-path
// drift and makes the real component displacement visible.
close(quick.shellTranslateY + quick.quickMorph.y + quick.quickMorph.translateY,
  434.993, 'QuickMorph source screen y');
close(quick.quickMorph.x + quick.quickMorph.translateX +
  (quick.themeItems[0].x - quick.quickMorph.x) + quick.themeItems[0].translateX,
23.104, 'ThemeDay source screen x');
close(quick.shellTranslateY + quick.quickMorph.y + quick.quickMorph.translateY +
  (quick.themeItems[0].y - quick.quickMorph.y) + quick.themeItems[0].translateY,
468.891, 'ThemeDay source screen y');

const geometryEnd = sampleReaderAppearanceMasterProgress(10 / 23);
close(geometryEnd.quickMorph.width, 338, 'QuickMorph authored geometry end width');
close(geometryEnd.quickMorph.height, 666, 'QuickMorph authored geometry end height');
close(geometryEnd.quickMorph.translateX, 0, 'QuickMorph authored translateX end');
close(geometryEnd.quickMorph.translateY, 0, 'QuickMorph authored translateY end');
close(geometryEnd.themeItems[0].width, 73.5, 'ThemeDay authored width end');
close(geometryEnd.themeItems[0].height, 58.8, 'ThemeDay authored height end');
close(geometryEnd.fontItems[0].width, 62.5, 'FontSystem fixed width');
close(geometryEnd.fontItems[0].height, 27, 'FontSystem fixed height');
close(geometryEnd.fontItems[0].translateX, 0, 'FontSystem translateX end');
close(geometryEnd.fontItems[0].translateY, 0, 'FontSystem translateY end');

for (const p of [0.5, 0.75, 1]) {
  const frame = sampleReaderAppearanceMasterProgress(p);
  close(frame.quickMorph.width, geometryEnd.quickMorph.width,
    `QuickMorph width holds after authored endpoint p=${p}`);
  close(frame.quickMorph.height, geometryEnd.quickMorph.height,
    `QuickMorph height holds after authored endpoint p=${p}`);
  close(frame.themeItems[0].width, geometryEnd.themeItems[0].width,
    `ThemeDay width holds after authored endpoint p=${p}`);
  close(frame.fontItems[0].width, 62.5, `FontSystem never gains product width morph p=${p}`);
  close(frame.fontItems[0].height, 27, `FontSystem never gains product height morph p=${p}`);
}

// Authored root crossfade windows are distinct; the Quick tree remains
// visible while the Full surface/content begin revealing underneath it.
close(sampleReaderAppearanceMasterProgress(7 / 23).contentSurface.opacity, 0,
  'ContentSurface reveal start');
close(sampleReaderAppearanceMasterProgress(14 / 23).contentSurface.opacity, 1,
  'ContentSurface reveal end');
close(sampleReaderAppearanceMasterProgress(8 / 23).appearanceContent.opacity, 0,
  'AppearanceContent reveal start');
close(sampleReaderAppearanceMasterProgress(14 / 23).appearanceContent.opacity, 1,
  'AppearanceContent reveal end');
close(sampleReaderAppearanceMasterProgress(8 / 23).quickMorph.opacity, 1,
  'QuickMorph fade start');
close(sampleReaderAppearanceMasterProgress(18 / 23).quickMorph.opacity, 0,
  'QuickMorph fade end');
close(sampleReaderAppearanceMasterProgress(17 / 23).header.opacity, 1,
  'Full Header reveal end');
close(sampleReaderAppearanceMasterProgress(1).typography.opacity, 1,
  'Typography reveal end');
close(sampleReaderAppearanceMasterProgress(1).fontLibrary.height, 136,
  'FontLibrary Figma instance height');
close(sampleReaderAppearanceMasterProgress(1).typography.height, 406,
  'Typography Figma instance height');

const half = sampleReaderAppearanceMasterProgress(0.5);
assert.equal(half.quickMorph.trackProgress, 1,
  'Quick geometry must already be complete at half of the Figma master window');
assert.ok(half.quickMorph.opacity > 0 && half.quickMorph.opacity < 1,
  'Quick root must be fading at half progress');
assert.ok(half.contentSurface.opacity > 0 && half.contentSurface.opacity < 1,
  'Full surface must be revealing at half progress');
assert.ok(half.header.trackProgress > 0 && half.header.trackProgress < 1,
  'Header must use its own later local window');
assert.notEqual(half.contentSurface.trackProgress, half.header.trackProgress,
  'independent actor windows collapsed into one progress');

// Responsive height changes only MorphStage's endpoint. The authored local
// Figma geometry remains in the same 364vp coordinate space and is clipped to
// the live shell.
const shortQuick = sampleReaderAppearanceMasterProgress(0, 620);
const shortFull = sampleReaderAppearanceMasterProgress(1, 620);
close(shortQuick.shellHeight, 330, 'short runtime Quick height');
close(shortQuick.shellTranslateY, 290, 'short runtime Quick stage y');
close(shortFull.shellHeight, 620, 'short runtime Full height');
close(shortFull.shellTranslateY, 0, 'short runtime Full stage y');
close(readerAppearanceMotionViewportHeight(shortQuick), 190, 'Quick viewport height');
close(readerAppearanceMotionViewportHeight(shortFull), 563, 'short Full viewport clips at shell');
close(readerAppearanceMotionViewportWidth(shortFull, 320), 307, 'narrow Full viewport clips at sheet');

// The sampler is a pure function of p. Expand and collapse therefore render
// exactly the same frame at the same physical handle position.
const ascending = new Map();
for (const p of [0, 0.25, 0.5, 0.75, 1]) {
  ascending.set(p, sampleReaderAppearanceMasterProgress(p, 820));
}
for (const p of [1, 0.75, 0.5, 0.25, 0]) {
  assert.deepEqual(sampleReaderAppearanceMasterProgress(p, 820), ascending.get(p),
    `reverse sampling changed p=${p}`);
}

console.log('reader appearance Figma N sampler: PASS');
