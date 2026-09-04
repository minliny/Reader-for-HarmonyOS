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

// Stage owns only the gesture clock and grabber. Dynamic visual content must
// be a direct child of the @State owner; any BuilderParam path can freeze it.
assert.doesNotMatch(stage, /@BuilderParam/);
assert.doesNotMatch(stage, /fullMorphStageLayer|quickDockLayer|quickMorphStageLayer/);
assert.doesNotMatch(stage, /motionState\.profile/,
  'presentation must never branch on expand/collapse direction');
assert.match(stage, /@Prop(?: @Watch\('[^']+'\))? availableHeight: number/);
assert.match(stage,
  /onMasterProgressChange: \(progress: number\) => void/,
  'Stage must publish the primitive master progress to the slot owner');
assert.match(methodBody(stage, 'publishFrame()', 'publishMotionActivity('),
  /onMasterProgressChange\(this\.renderFrame\.masterProgress\)/,
  'every rendered Stage frame must invalidate the owner with the same p');

const brightnessLayer = methodBody(control,
  'appearanceMotionBrightnessLayer()', 'appearanceMotionModuleNavLayer()');
for (const property of ['opacity', 'translateX', 'translateY', 'blurVp']) {
  assert.match(brightnessLayer,
    new RegExp(`currentAppearanceMotionFrame\\(\\)\\.brightnessRail\\.${property}`));
}
const moduleNavLayer = methodBody(control,
  'appearanceMotionModuleNavLayer()', 'onAppearanceMotionEndpointChange(');
for (const property of ['opacity', 'translateX', 'translateY', 'blurVp']) {
  assert.match(moduleNavLayer,
    new RegExp(`currentAppearanceMotionFrame\\(\\)\\.moduleNav\\.${property}`));
}

// The old Quick component is static-only. Phone motion has exactly one owner:
// ReaderAppearanceFullPanel's motion branch.
assert.doesNotMatch(modulePanel, /motionFrame|ReaderAppearanceSharedActors|motionPanel/);
const phoneContent = methodBody(control,
  'appearanceMotionContent()', 'appearanceMotionBrightnessLayer()');
assert.equal((phoneContent.match(/ReaderAppearanceFullPanel\(\{/g) ?? []).length, 1);
assert.doesNotMatch(phoneContent, /ReaderAppearanceModulePanel/);
assert.match(control, /@State private appearanceMotionMasterProgress: number/,
  'the parent must own an observable primitive progress');
assert.match(control, /@State private appearanceMotionStageMounted: boolean/,
  'the persistent Phone actor registry needs an explicit mounted latch');
assert.match(methodBody(control, 'usesPhoneAppearanceMotionStage()',
  'appearanceMotionStageCanMount()'),
  /if \(this\.activePage === 'fullAppearance'\) \{\s*return true;/,
  'the stable Full route must never fall back to the legacy static panel');
assert.match(methodBody(control, 'onActivePageChanged()', 'geo:'),
  /if \(!this\.appearanceMotionStageMounted && this\.appearanceMotionStageCanMount\(\)\)/,
  'the actor registry may mount on Appearance entry but must survive its endpoint route');
assert.match(methodBody(control, 'onLayoutChanged()', 'isExpanded()'),
  /else if \(!this\.appearanceMotionStageMounted && this\.appearanceMotionStageCanMount\(\)\)/,
  'late compact layout props must mount the registry even without a width-class change');
assert.match(phoneContent, /motionProgress: this\.appearanceMotionMasterProgress/,
  'the FullPanel boundary must receive observable primitive p');
assert.match(phoneContent, /motionFullHeight: this\.appearanceMotionStageHeight\(\)/,
  'the FullPanel boundary must receive the primitive runtime axis height');
assert.doesNotMatch(phoneContent, /motionFrame:/,
  'a complex frame object must not cross the FullPanel boundary');
assert.match(full, /@Prop motionProgress: number \| undefined/,
  'FullPanel motion invalidation must be driven by primitive p');
assert.match(shared,
  /@Prop motionProgress: number[\s\S]*?sampleReaderAppearanceMasterProgress\(this\.motionProgress, this\.fullHeight\)/,
  'shared actors must sample their own frame from primitive p');
assert.doesNotMatch(shared, /@Prop frame:/,
  'a cached complex frame must not cross into the shared actor component');
const phoneDock = methodBody(control, 'appearanceMotionDock()', 'appearanceMotionShellLayer()');
assert.doesNotMatch(phoneDock, /appearanceContent:|brightnessRail:|moduleNav:/,
  'dynamic visual slots must not return to the gesture Stage');
assert.match(phoneDock, /this\.appearanceMotionContentLayer\(\)/,
  'the visual tree must be a direct sibling owned by ReaderControlPanel');

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
assert.match(shared, /currentFrame\(\)\.themeHeader\.trackProgress/);
assert.match(shared, /frame\.themeItems\[safeIndex\]/);
assert.match(shared, /this\.fontActorFrame\(fontId\)/);
assert.doesNotMatch(shared, /this\.lerp\([^\n]*this\.masterProgress\(\)/);
assert.match(full, /quickMorph\.trackProgress/);
assert.match(shared,
  /TOK_READ_DISABLED_BG\)[\s\S]*\.opacity\(this\.themeActorProgress\(index\)\)/,
  'day-theme disabled surfaces must reach the authored Full endpoint on their own actor track');

console.log('reader appearance persistent tree contract: PASS');
