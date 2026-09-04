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

// Stage owns the gesture clock and every animated wrapper. Builder slots may
// carry static business UI only; no sampled frame is allowed across them.
assert.equal((stage.match(/@BuilderParam/g) ?? []).length, 2);
for (const slot of ['brightnessContent', 'moduleNavContent']) {
  assert.match(stage, new RegExp(`@BuilderParam ${slot}:`));
}
assert.doesNotMatch(stage, /@BuilderParam[^\n]*(frame|progress)/i);
assert.doesNotMatch(stage, /fullMorphStageLayer|quickDockLayer|quickMorphStageLayer/);
assert.doesNotMatch(stage, /motionState\.profile/,
  'presentation must never branch on expand/collapse direction');
assert.match(stage, /@Prop(?: @Watch\('[^']+'\))? availableHeight: number/);
assert.match(stage,
  /onMasterProgressChange: \(progress: number\) => void/,
  'Stage must publish the primitive master progress to the slot owner');
assert.match(methodBody(stage, 'publishFrame()', 'publishMotionActivity('),
  /this\.masterProgress = this\.renderFrame\.masterProgress/,
  'every rendered Stage frame must update the shared primitive p');
assert.match(stage,
  /@State private masterProgress: number = 0/,
  'the gesture clock must retain one primitive progress state across the complete axis');
assert.match(methodBody(stage, 'publishFrame()', 'publishMotionActivity('),
  /onMasterProgressChange\(this\.renderFrame\.masterProgress\)/,
  'the route owner may observe the same p without owning presentation');

const brightnessLayer = methodBody(stage, 'brightnessLayer()', 'moduleNavLayer()');
for (const property of ['opacity', 'translateX', 'translateY', 'blurVp']) {
  assert.match(brightnessLayer,
    new RegExp(`renderFrame\\.brightnessRail\\.${property}`));
}
const moduleNavLayer = methodBody(stage, 'moduleNavLayer()', 'grabberLayer()');
for (const property of ['opacity', 'translateX', 'translateY', 'blurVp']) {
  assert.match(moduleNavLayer,
    new RegExp(`renderFrame\\.moduleNav\\.${property}`));
}

// The old Quick component is static-only. Phone motion has exactly one owner:
// ReaderAppearanceFullPanel's motion branch.
assert.doesNotMatch(modulePanel, /motionFrame|ReaderAppearanceSharedActors|motionPanel/);
const phoneContent = methodBody(stage, 'appearancePanel()', 'brightnessLayer()');
assert.equal((phoneContent.match(/ReaderAppearanceFullPanel\(\{/g) ?? []).length, 1);
assert.doesNotMatch(phoneContent, /ReaderAppearanceModulePanel/);
assert.match(control, /@State private appearanceMotionMasterProgress: number/,
  'the parent keeps only the stable endpoint mirror used by fallback routes');
assert.match(control, /@State private appearanceMotionStageMounted: boolean/,
  'the persistent Phone actor registry needs an explicit mounted latch');
assert.match(methodBody(control, 'usesPhoneAppearanceMotionStage()',
  'appearanceMotionStageCanMount()'),
  /if \(this\.activePage === 'fullAppearance'\) \{\s*return true;/,
  'the stable Full route must never fall back to the legacy static panel');
assert.match(methodBody(control, 'usesPhoneAppearanceMotionStage()',
  'appearanceMotionStageCanMount()'),
  /this\.activePage === 'moduleAppearance'[\s\S]*?this\.appearanceMotionStageMounted \|\| this\.appearanceMotionStageCanMount\(\)/,
  'the first Quick render must enter the motion Stage even before the mounted latch commits');
assert.match(methodBody(control, 'onActivePageChanged()', 'geo:'),
  /if \(!this\.appearanceMotionStageMounted && this\.appearanceMotionStageCanMount\(\)\)/,
  'the actor registry may mount on Appearance entry but must survive its endpoint route');
assert.match(methodBody(control, 'onLayoutChanged()', 'isExpanded()'),
  /else if \(!this\.appearanceMotionStageMounted && this\.appearanceMotionStageCanMount\(\)\)/,
  'late compact layout props must mount the registry even without a width-class change');
assert.match(phoneContent, /motionProgress: this\.masterProgress/,
  'the FullPanel boundary must receive observable primitive p');
assert.match(phoneContent, /motionEnabled: true/,
  'the persistent FullPanel must render its motion actor branch');
assert.match(phoneContent, /motionFullHeight: this\.stageHeight\(\)/,
  'the FullPanel boundary must receive the runtime motion axis height');
assert.doesNotMatch(phoneContent, /motionFrame:/,
  'a complex frame object must not cross the FullPanel boundary');
assert.match(full,
  /@Prop motionProgress: number/,
  'FullPanel must observe the frame-clock primitive progress');
assert.match(full, /ReaderAppearanceSharedActors\(\{[\s\S]*?motionProgress: this\.motionProgress/,
  'FullPanel must preserve the same primitive progress into SharedActors');
assert.match(shared,
  /@Prop motionProgress: number[\s\S]*?sampleReaderAppearanceMasterProgress\(this\.motionProgress, this\.fullHeight\)/,
  'shared actors must sample their frames from the same primitive p');
assert.doesNotMatch(shared, /@Prop frame:/,
  'a cached complex frame must not cross into the shared actor component');
const phoneDock = methodBody(control, 'appearanceMotionDock()', 'onAppearanceMotionEndpointChange(');
assert.doesNotMatch(phoneDock, /appearanceContent:/,
  'the motion panel must be mounted directly by the Stage, never through a Builder slot');
assert.match(phoneDock, /brightnessContent: \(\): void => this\.brightnessRail\(\)/);
assert.match(phoneDock, /moduleNavContent: \(\): void => this\.moduleNav\(\)/);

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
