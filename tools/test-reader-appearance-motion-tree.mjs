import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reading = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
const stage = readFileSync(new URL('ReaderAppearanceMotionStage.ets', reading), 'utf8');
const shared = readFileSync(new URL('ReaderAppearanceSharedActors.ets', reading), 'utf8');
const full = readFileSync(new URL('ReaderAppearanceFullPanel.ets', reading), 'utf8');
const modulePanel = readFileSync(new URL('ReaderAppearanceModulePanel.ets', reading), 'utf8');
const control = readFileSync(new URL('ReaderControlPanel.ets', reading), 'utf8');

function methodBody(source, name, nextName) {
  const start = source.indexOf(`private ${name}`);
  assert.ok(start >= 0, `missing ${name}`);
  const end = nextName === undefined ? source.length : source.indexOf(`private ${nextName}`, start + 1);
  assert.ok(end > start, `missing boundary after ${name}`);
  return source.slice(start, end);
}

// Stage owns one persistent appearance content entry. Fixed-screen chrome may
// remain sibling slots, but Quick and Full can never be separate content slots.
assert.equal((stage.match(/@BuilderParam appearanceContent:/g) ?? []).length, 1);
assert.doesNotMatch(stage, /@BuilderParam quickMorph:|@BuilderParam fullContent:/);
assert.doesNotMatch(stage, /fullMorphStageLayer|quickDockLayer|quickMorphStageLayer/);
assert.doesNotMatch(stage, /motionState\.profile/,
  'presentation must never branch on expand/collapse direction');
assert.match(stage, /@Prop(?: @Watch\('[^']+'\))? availableHeight: number/);

const brightnessLayer = methodBody(stage, 'brightnessLayer()', 'moduleNavLayer()');
for (const property of ['opacity', 'translateX', 'translateY', 'blurVp']) {
  assert.match(brightnessLayer, new RegExp(`renderFrame\\.brightnessRail\\.${property}`));
}
const moduleNavLayer = methodBody(stage, 'moduleNavLayer()', 'grabberLayer()');
for (const property of ['opacity', 'translateX', 'translateY', 'blurVp']) {
  assert.match(moduleNavLayer, new RegExp(`renderFrame\\.moduleNav\\.${property}`));
}

// The old Quick component is static-only. Phone motion has exactly one owner:
// ReaderAppearanceFullPanel's motion branch.
assert.doesNotMatch(modulePanel, /motionFrame|ReaderAppearanceSharedActors|motionPanel/);
const phoneContent = methodBody(control, 'appearanceMotionContent(', 'appearanceMotionBrightness(');
assert.equal((phoneContent.match(/ReaderAppearanceFullPanel\(\{/g) ?? []).length, 1);
assert.doesNotMatch(phoneContent, /ReaderAppearanceModulePanel/);

for (const callback of [
  'onThemeChange',
  'onSetDayTheme',
  'onSetNightTheme',
  'onFontChange',
  'onFontOrderChange',
  'onFontReorderActivityChange',
  'onCustomFontImport',
  'onIndentRequest',
  'onAlignmentRequest',
  'onMetricStep',
  'onChineseConversionChange',
  'onPageTurnStyleChange',
]) {
  assert.match(phoneContent, new RegExp(`${callback}:`), `Phone motion owner misses ${callback}`);
}

// One Scroll owns both shared and Full-only bodies. SharedActors is now a pure
// child group: it neither owns a surface nor mirrors another scroller's offset.
const motionContent = methodBody(full, 'motionAppearanceContent()', 'motionFullOnlyActors()');
assert.equal((motionContent.match(/Scroll\(this\.contentScroller\)/g) ?? []).length, 1);
assert.match(motionContent, /ReaderAppearanceSharedActors\(\{/);
assert.match(motionContent, /this\.motionFullOnlyActors\(\)/);
assert.doesNotMatch(shared, /Scroll\(|contentScrollOffsetY|safeContentScrollOffsetY/);
assert.match(motionContent,
  /onFontReorderActivityChange:[\s\S]*this\.onMotionFontReorderActivityChange\(active\)/,
  'the shared font drag must lock the same owning Scroll');
assert.match(motionContent,
  /enableScrollInteraction\(this\.fullEndpointInteractionEnabled\(\) && !this\.motionFontReorderActive\)/);
assert.match(motionContent, /\.onDidScroll\([\s\S]*this\.captureMotionScrollOffset\(\)/,
  'the persistent owner must observe the one Scroll offset');
assert.match(full,
  /private captureMotionScrollOffset\(\): void[\s\S]*this\.contentScroller\.currentOffset\(\)[\s\S]*offset\.yOffset/,
  'scroll compensation must use the accumulated Scroller position, not one frame delta');
assert.match(full,
  /private motionScrollCompensationY\(\): number[\s\S]*readerAppearanceScrollCompensationVp\([\s\S]*this\.motionScrollOffsetY,[\s\S]*masterProgress/,
  'collapse must continuously cancel a retained Full scroll offset as p approaches Quick');
assert.match(full,
  /private motionViewportHeight\(\): number \{\s*return readerAppearanceMotionViewportHeight\(this\.currentMotionFrame\(\)\);/,
  'the motion viewport must stay within the live shell bottom on short windows');
assert.match(full,
  /private motionViewportWidth\(\): number \{\s*return readerAppearanceMotionViewportWidth\(this\.currentMotionFrame\(\), this\.sheetWidth\(\)\);/,
  'the motion viewport must never extend beyond its measured sheet width');

// Master progress is only an endpoint/input coordinate. Local visual changes
// must consume each actor's independently sampled trackProgress.
assert.match(shared, /frame\.themeHeader\.trackProgress/);
assert.match(shared, /frame\.themeItems\[safeIndex\]/);
assert.match(shared, /this\.fontActorFrame\(fontId\)/);
assert.doesNotMatch(shared, /this\.lerp\([^\n]*this\.masterProgress\(\)/);
assert.match(full, /quickMorph\.trackProgress/);
assert.match(shared,
  /TOK_READ_DISABLED_BG\)[\s\S]*\.opacity\(this\.themeActorProgress\(index\)\)/,
  'day-theme disabled surfaces must reach the authored Full endpoint on their own actor track');

console.log('reader appearance persistent tree contract: PASS');
