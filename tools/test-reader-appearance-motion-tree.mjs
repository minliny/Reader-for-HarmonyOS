import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reading = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
const stage = readFileSync(new URL('ReaderControlPanel.ets', reading), 'utf8');
const shared = readFileSync(new URL('ReaderControlAppearanceContent.ets', reading), 'utf8');
const control = readFileSync(new URL('ReaderControlPanel.ets', reading), 'utf8');
const host = readFileSync(new URL('LocalReadingExperience.ets', reading), 'utf8');

function methodBody(source, name, nextName) {
  const start = source.indexOf('private ' + name);
  assert.ok(start >= 0, 'missing ' + name);
  const end = nextName === undefined ? source.length : source.indexOf('private ' + nextName, start + 1);
  assert.ok(end > start, 'missing boundary after ' + name);
  return source.slice(start, end);
}

// Structural integration evidence only: a source check cannot prove ArkUI
// pointer routing, intermediate frames, or restored Figma pixel parity.
assert.match(host, /@State @Watch\('onControlSessionChanged'\) private controlSession:/);
assert.match(host, /controlSession: \$controlSession/);
assert.match(control, /@Link @Watch\('onControlSessionChanged'\) controlSession:/);
assert.match(control, /new ReaderControlRuntime/);
assert.match(control, /@State private visualExpansionProgress:/);
assert.match(control, /@State private visualVisibilityProgress:/);
assert.doesNotMatch(control, /@State private visualSession:/);
assert.doesNotMatch(control, /ReaderControlMotionStage\(|@BuilderParam|animateTo\(|setTimeout\(/);
const frameMethod = methodBody(control, 'frame()', 'controlQuickHeight()');
assert.match(frameMethod, /this\.motionFrameCache\.sample\(this\.visualVisibilityProgress, this\.visualExpansionProgress/);
assert.match(frameMethod, /this\.layout\.fullPanelWidth, this\.controlPanelHeight\(\), this\.layout\.dockBottomGap/);
assert.match(control, /this\.controlContent\(\)/);
assert.match(control, /this\.controlHeader\(\)/);
assert.match(control, /this\.topBar\(\)/);

const content = methodBody(control, 'appearanceContent()', 'secondaryModuleInputEnabled(');
assert.equal((content.match(/ReaderControlAppearanceContent\(\{/g) ?? []).length, 1);
assert.match(content, /motionProgress: this\.contentMotionProgress/);
assert.match(content, /availableWidth: this\.contentMotionWidth/);
assert.match(content, /availableHeight: this\.contentMotionHeight/);
assert.match(content, /interactionEnabled: this\.contentInputEnabled\(\)/);
assert.match(content, /dismissTemporaryRevision: this\.dismissTemporaryRevision/);
assert.match(content, /onTemporaryLayerChange:.*this\.onTemporaryLayerChange\(active\)/);
assert.doesNotMatch(control, /ReaderAppearanceFullPanel\(\{|ReaderAppearanceModulePanel\(\{/);

// Semantic actors retain identity, including text and user font ordering.
// No alternate Quick/Full root or actor-local clock is admitted.
assert.equal((shared.match(/Scroll\(this\.scroller\)/g) ?? []).length, 1);
for (const actor of ['themeShell', 'themeSwatch', 'fontCell', 'layoutLibrary']) {
  assert.ok(shared.includes('this.' + actor + '('), 'missing semantic actor ' + actor);
}
assert.match(shared, /sampleReaderControlAppearance\(this\.motionProgress, this\.availableWidth/);
assert.match(shared, /ForEach\(this\.themeIds\(\)/);
assert.match(shared, /ForEach\(this\.fontIds\(\)/);
assert.match(shared, /readerAppearanceFontSlotFamily\(this\.snapshot, font\)/);
assert.match(shared, /readerAppearanceFontSlotLabel\(this\.snapshot, font\)/);
assert.match(shared, /normalizeReaderAppearanceFontOrder/);
assert.match(shared, /importLayout: ReaderControlAppearanceImportLayout = 'ordered-slot-approved'/);
assert.doesNotMatch(shared, /animateTo|setTimeout|\.animation\(|\.transition\(|ReaderAppearanceSharedActors/);
assert.match(shared, /enableScrollInteraction\(this\.scrollInput\(\) && this\.draggedFontId === '' && this\.openSelect === ''\)/);
assert.match(shared, /private scrollInput\(\): boolean \{ return this\.extendedThemes\(\) \? this\.sharedInput\(\) : this\.fullInput\(\); \}/);
assert.match(shared, /@Prop @Watch\('onInputChanged'\) interactionEnabled/);
assert.match(shared, /this\.onCustomFontImport\(\)/);
assert.match(shared, /this\.onFontOrderChange\(/);

// One MR1 Dock group fades and translates the already-composited actor tree;
// brightness/navigation consume the same p and do not get independent clocks.
assert.match(stage, /\.translate\(\{ y: this\.frame\(\)\.dock\.translateY \}\)/);
assert.match(stage, /\.opacity\(this\.frame\(\)\.dock\.opacity\)/);
assert.doesNotMatch(stage, /\.renderGroup\(true\)/,
  'the animated dock must not allocate a dynamic off-screen render group');
assert.match(stage, /\.translate\(\{ y: this\.frame\(\)\.topBar\.translateY \}\)\.opacity\(this\.frame\(\)\.topBar\.opacity\)/);
assert.doesNotMatch(control, /\.renderGroup\(true\)/,
  'the animated top bar must remain in the normal compositor tree');
for (const actor of ['brightness', 'navigation']) {
  assert.match(stage, new RegExp('this\\.frame\\(\\)\\.' + actor + '\\.opacity'));
  assert.match(stage, new RegExp('this\\.frame\\(\\)\\.' + actor + '\\.y'));
}
assert.match(control, /this\.dockRect\.x = this\.rootScreenX \+ this\.dockLeft\(\)/,
  'dock backdrop rect is updated in place during motion');
assert.match(control, /this\.onBackdropRegionsChange\(this\.backdropRegions, ready\)/,
  'backdrop region array is retained across motion frames');
assert.match(stage, /this\.rootScreenY \+ this\.dockTop\(\) \+ f\.shell\.y \+ f\.dock\.translateY/);
assert.match(stage, /this\.controlQuickHeight\(\), this\.motionOffsetY/);
assert.match(readFileSync(new URL('ReaderControlMotionGeometry.ts', reading), 'utf8'), /frame\.shell\.y \+= offset/);

console.log('reader appearance unified production tree (structural only): PASS');
