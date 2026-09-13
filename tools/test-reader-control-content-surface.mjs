import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readerControlMotionBounds, sampleReaderControlMotionComposition }
  from '../entry/src/main/ets/features/reading/ReaderControlMotionGeometry.ts';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const fixtureLayers = JSON.parse(read('tools/fixtures/reader-control-shared-layer-live-20260906.json'));
const nodes = fixtureLayers.sources.surfaces.nodes;
const fixture = JSON.parse(read('tools/fixtures/reader-control-restored-baseline-20260905.json'));
for (const n of nodes.filter(n => n.name === 'AddedActor/FullContentSurface')) {
  assert.deepEqual([n.x, n.y, n.width, n.height, n.cornerRadius], [26, 146, 338, 666, 12]);
  assert.equal(n.parentIndex, 1);
  const viewport = nodes.find(v => v.parentId === n.parentId && v.parentIndex === 2);
  assert.deepEqual(viewport.fills, []); assert.deepEqual(viewport.strokes, []);
  const track = fixture.records.flatMap(r => r.motionContext.nodes).find(v => v.nodeId === n.id);
  assert.ok(track, n.id);
  assert.match(track.codeSnippets.css, /opacity: 0;/);
  assert.match(track.codeSnippets.css, /opacity: 1;/);
  assert.doesNotMatch(track.codeSnippets.css, /translate:|width:|height:/);
}
const bounds = readerControlMotionBounds(364, 736, 19);
for (const p of [0, .2, .5, .8, 1, .8, .5, .2, 0]) {
  for (const v of [1, .5, 0]) {
    const frame = sampleReaderControlMotionComposition({ expansionProgress: p, visibilityProgress: v }, bounds);
    assert.ok(frame.contentSurface, 'the fixed Full surface must be a separate actor from the morphing content viewport');
    assert.deepEqual(frame.contentSurface, { x: 13, y: frame.shell.y + 57, width: 338, height: 666, opacity: p });
    assert.ok(Math.abs(frame.contentSurface.y - frame.content.y - 28 * (1 - p)) < 1e-8);
  }
}
const stage = read('entry/src/main/ets/features/reading/ReaderControlMotionStage.ets');
assert.match(stage, /readerControlHasFullContentSurface\(this\.contentModule\(\)\)/);
assert.match(stage, /\.width\(this.frame\(\).contentSurface.width\).height\(this.frame\(\).contentSurface.height\)/);
assert.match(stage, /\.opacity\(readerControlHasFullContentSurface\(this\.contentModule\(\)\)\s*\?\s*this\.frame\(\)\.contentSurface\.opacity\s*:\s*0\)/);
assert.match(stage, /\.visibility\(Visibility\.Visible\)/);
assert.doesNotMatch(stage, /readerControlHasFullContentSurface\(this\.contentModule\(\)\)\s*\?\s*Visibility\.Visible\s*:\s*Visibility\.Hidden/);
assert.ok(stage.indexOf(".id('reader-control-full-content-surface')") < stage.indexOf('this.moduleContent();'));
const directory = read('entry/src/main/ets/features/reading/FullDirectoryPanel.ets').split('private embeddedBody()')[1].split('@Builder')[0];
assert.doesNotMatch(directory, /backgroundColor\(TOK_SURFACE_PANEL\)|\.border\(/);
const settings = read('entry/src/main/ets/features/reading/ReaderControlSettingsContent.ets').split('  build()')[1].split('@Builder')[0];
assert.doesNotMatch(settings, /backgroundColor\(TOK_SURFACE_PANEL\)|\.border\(/);
for (const name of ['Tts', 'Appearance']) {
  const body = read(`entry/src/main/ets/features/reading/ReaderControl${name}Content.ets`).split('  build()')[1].split('@Builder')[0];
  assert.doesNotMatch(body, /Row\(\).width\(this.availableWidth\).height\(this.availableHeight\)/);
}
const ttsSurface = read('entry/src/main/ets/features/reading/ReaderControlTtsContent.ets');
assert.match(ttsSurface, /private quickBackdrop\(\)[\s\S]*?app\.control\.paint\.FFFAF4[\s\S]*?app\.control\.paint\.F6ECDD[\s\S]*?\.opacity\(1 - this\.p\(\)\)\.hitTestBehavior\(HitTestMode.None\)/,
  'Make Quick parchment backdrop must retire on the same p and never duplicate the Full surface');
assert.equal((ttsSurface.match(/this\.quickBackdrop\(\)/g) ?? []).length, 1);
console.log('reader control independent FullContentSurface source geometry and single-background wiring: PASS');
