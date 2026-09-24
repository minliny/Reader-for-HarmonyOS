import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as paint from '../entry/src/main/ets/features/reading/ReaderControlMotionPresentation.ts';
import * as scroll from '../entry/src/main/ets/features/reading/ReaderControlMorphScroll.ts';
import * as appearance from '../entry/src/main/ets/features/reading/ReaderControlAppearanceGeometry.ts';
import { READER_CONTROL_APPEARANCE_THEMES } from '../entry/src/main/ets/features/reading/ReaderControlAppearanceStyle.ts';
import * as appearanceState from '../entry/src/main/ets/features/reading/ReaderAppearanceState.ts';
import * as render from '../entry/src/main/ets/features/reading/ReaderAppearanceRenderStyle.ts';
import * as playback from '../entry/src/main/ets/features/reading/ReaderControlPlaybackGeometry.ts';
import * as settings from '../entry/src/main/ets/features/reading/ReaderControlSettingsGeometry.ts';
import * as actors from '../entry/src/main/ets/features/reading/ReaderControlActorGeometry.ts';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';

const source = name => readFileSync(new URL(`../entry/src/main/ets/features/reading/ReaderControl${name}Content.ets`, import.meta.url), 'utf8');
const PathShape = class { commands(path) { this.path = path; return this; } };
const RectShape = class { width(value) { this.widthValue = value; return this; } height(value) { this.heightValue = value; return this; } };
const props = () => ({
  clipCache: new paint.ReaderControlMotionClipCache(p => new PathShape().commands(p), () => new RectShape().width('100%').height('100%')),
  pathCache: new paint.ReaderControlMotionPathCache(p => new PathShape().commands(p)),
  clipEndpointWidth: -1, clipFullRects: [], clipQuickRects: [], motionProgress: 0, availableWidth: 286, availableHeight: 190, fullViewportHeight: 666,
  fullContentHeight: 666, quickContentHeight: 190, interactionEnabled: true,
  scrollMotion: scroll.createReaderControlMorphScroll(), getUIContext: () => ({ getFont: () => ({}), vp2px: x => 3 * x }) });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const deps = { ...paint, ...scroll, ...actors, PathShape };

// Production clipping adapters operate in each actor's actual parent basis.
const { owner: auto } = createReaderBuilderProbe(source('AutoPage'),
  ['p', 'frame', 'presentation', 'sharedPaintRect', 'sharedClip', 'quickBack'], { ...deps, ...playback });
Object.assign(auto, props(), { cachedProgress: -1, cachedWidth: -1 });
const { owner: screen } = createReaderBuilderProbe(source('Settings'),
  ['p', 'geometry', 'presentation', 'sharedRect', 'sharedClip', 'segmentRow'], { ...deps, ...settings });
Object.assign(screen, props());
for (const offset of [0, 100, 300, 666, 3300]) {
  for (const p of [0, .05, .1, .3, .7, .9, 1, .9, .3, .05, 0]) {
    for (const owner of [auto, screen]) {
      owner.motionProgress = p; owner.availableWidth = 286 + 52 * p;
      owner.scrollMotion.fullScrollOffset = offset;
    }
    for (const kind of ['control', 'speed']) assert.doesNotMatch(auto.sharedClip(kind).path, /NaN|Infinity/);
    for (let row = 0; row < 3; row++) for (const bar of [true, false]) {
      const f = screen.sharedRect(row, bar, 1), c = screen.sharedRect(row, bar, p), q = screen.sharedRect(row, bar, 0);
      const rects = paint.readerControlMotionClipRects(p, f, c, q, 666, offset);
      const clipped = screen.sharedClip(row, bar);
      if (paint.readerControlMotionSourceFullyVisible(f, 666, offset)) {
        assert.equal(clipped.widthValue, '100%'); assert.equal(clipped.heightValue, '100%');
        assert.deepEqual(rects[0], { x: 0, y: 0, width: c.width, height: c.height });
      } else assert.equal(clipped.path, paint.readerControlMotionClipPath(rects, 3));
      if (offset >= f.y + f.height) near(rects[0].height, 0);
      if (p === 0) near(rects[1].height, c.height);
    }
  }
}
assert.equal(auto.sharedPaintRect('speed', 0).height, 64, 'Quick speed keeps its real child overflow');
assert.equal(auto.sharedPaintRect('control', 0).height, 67, 'transport icons above local zero are not cut off');

// Actual SDK-generated font cell: rounded paint inside the motion clip, with
// text softening independent of the surface. Native rounded rendering is also
// checked on the VM; this probe checks the retained observer attributes.
const enums = new Proxy({}, { get: (_, k) => k });
const native = new Proxy({}, { get: () => () => {} });
const { owner: font } = createReaderBuilderProbe(source('Appearance'),
  ['frame', 'endpointFrame', 'fullInput', 'sharedInput', 'presentation', 'sharedClip', 'actorPosition',
    'sharedScrollTranslation', 'fullOnlyScrollTranslation', 'extendedThemes', 'themeIds', 'fontIds', 'fontActor', 'fontActorAt',
    'fontInput', 'activeFont', 'fontCellPosition', 'previewFamily', 'fontPreviewReady', 'visiblePreviewFamily', 'fontCell'],
  { ...deps, ...appearance, ...appearanceState, ...render, READER_CONTROL_APPEARANCE_THEMES,
    BorderStyle: enums, GesturePriority: enums, Gesture: native, LongPressGesture: native,
    globalThis: { Gesture: native, LongPressGesture: native } });
Object.assign(font, props(), { snapshot: appearanceState.setReaderAppearanceCustomFont(appearanceState.createDefaultReaderAppearanceSnapshot(),
    new appearanceState.ReaderCustomFontDescriptor('测试字体', 'ReaderCustom_aaaaaaaaaaaaaaaa', '/fonts/a.ttf', 'a'.repeat(64))),
  draggedFontId: '', previewFontOrder: [], readyPreviewFamilies: [], fontTracks: new Map(), importLayout: 'ordered-slot-approved',
  cachedProgress: -1, cachedWidth: -1, cachedFullHeight: -1 });
for (const slot of font.fontIds()) font.fontCell(slot);
const actions = [];
Object.assign(font, { motionProgress: 1, interactionEnabled: true, suppressFontClick: false, onCustomFontImport: () => actions.push('import'),
  onFontChange: selected => actions.push(selected) });
for (const name of ['切换到测试字体', '导入自定义字体']) {
  const node = [...font.nodes.values()].find(n => n.accessibilityText === name);
  assert.ok(node, name); node.onClick();
}
assert.deepEqual(actions, ['custom', 'import'], 'custom selection and import retain independent actions');
const outlineNodes = [...font.nodes.values()].filter(n => n.type === 'Stack');
const surfaceNodes = [...font.nodes.values()].filter(n => n.type === 'Row');
const textNodes = [...font.nodes.values()].filter(n => n.type === 'Text');
assert.equal(outlineNodes.length, font.fontIds().length);
assert.equal(surfaceNodes.length, font.fontIds().length);
for (const selected of ['serif', 'sans', 'kai', 'system', 'custom']) {
  font.snapshot = { ...font.snapshot, font: selected };
  font.replay();
  assert.equal(surfaceNodes.filter(n => n.backgroundColor === '#FF2F6373').length, 1);
  for (const [i, slot] of font.fontIds().entries()) {
    const active = slot !== 'import' && selected === slot;
    assert.equal(surfaceNodes[i].backgroundColor, active ? '#FF2F6373' : '#FFFFFCF8');
    assert.equal(textNodes[i].fontColor, active ? '#FFFFFAF4' : '#FF332C25');
  }
}
for (const offset of [0, 250, 565, 1000]) for (const p of [0, .1, .5, .9, 1, .7, .1, 0]) {
  Object.assign(font, { motionProgress: p, availableWidth: 286 + 52 * p });
  font.scrollMotion.fullScrollOffset = offset; font.scrollMotion.nativeScrollOffset = offset;
  font.replay();
  for (const [i, slot] of font.fontIds().entries()) {
    const outer = outlineNodes[i], surface = surfaceNodes[i], text = textNodes[i], a = font.fontActor(slot);
    near(outer.width, a.width); near(outer.height, a.height);
    near(surface.width, a.width); near(surface.height, a.height);
    assert.equal(surface.borderRadius, 12);
    assert.equal(surface.clip, true);
    assert.equal(surface.clipShape, undefined, 'motion PathShape must not override the painted surface radius');
    assert.equal(surface.hitTestBehavior, 'HitTestMode.None');
    assert.equal(surface.blur, undefined);
    assert.equal(outer.backgroundColor, undefined, 'the rectangular motion clip does not paint selected fill');
    assert.deepEqual(outer.position, font.actorPosition(a, slot !== 'import'));
    assert.equal(outer.blur, undefined, 'font outline is not blurred');
    assert.equal(outer.clipShape.path, font.sharedClip('font', 0, slot).path);
    near(text.opacity, paint.sampleReaderControlMotionPresentation(p).contentOpacity);
    near(text.blur, paint.sampleReaderControlMotionPresentation(p).contentBlur);
    near(text.fontSize, 12);
  }
}
// Empty/loading/error list content must use the same nonblank fade envelope.
for (const name of ['AutoPage', 'Appearance', 'Settings', 'Search', 'Replace', 'Directory', 'Tts']) {
  const tree = source(name);
  assert.match(tree, /sampleReaderControlMotionPresentation/);
  assert.doesNotMatch(tree, /setInterval|componentSnapshot|animateTo/);
}
for (const y of [-100, -10, 0, 70, 100]) {
  const rect = paint.readerControlMotionVisibleRect({ x: 0, y, width: 100, height: 30 }, 80);
  assert.ok(rect.height >= 0 && rect.height <= 30);
  if (y >= 80 || y + 30 <= 0) near(rect.height, 0);
}
console.log('PASS global presentation: shared policies, production actor-local clips, retained overflow, actual SDK font content/outline separation and reversal; device evidence separate');

// Theme/font clipping reads both endpoints repeatedly; geometry is shared
// within the live width/height, including reversal and font-order updates.
const {productionMotionMethods} = await import('./lib/reader-motion-method-probe.mjs');
let endpointSamples=0;
const EndpointOwner=productionMotionMethods(new URL('../entry/src/main/ets/features/reading/ReaderControlAppearanceContent.ets', import.meta.url),
  ['endpointFrame','themeIds','fontIds','presentation'], {...appearanceState,...paint,READER_CONTROL_APPEARANCE_THEMES,
    sampleReaderControlAppearance: (...args) => { endpointSamples++; return appearance.sampleReaderControlAppearance(...args); }});
const cache = Object.assign(new EndpointOwner(), {availableWidth:286,fullContentHeight:666,motionProgress:0,
  snapshot:appearanceState.createDefaultReaderAppearanceSnapshot(), draggedFontId:'',previewFontOrder:[]});
for(let frame=0;frame<100;frame++) {cache.motionProgress=frame/100;for(let cell=0;cell<16;cell++) {cache.endpointFrame(false);cache.endpointFrame(true);}}
assert.equal(endpointSamples,2,'endpoints do not depend on sampled progress');
cache.availableWidth=338;cache.endpointFrame(true);assert.equal(endpointSamples,4);
const ids=cache.fontIds();assert.equal(cache.fontIds(),ids);
cache.snapshot.fontOrder=cache.snapshot.fontOrder.slice().reverse();assert.notDeepEqual(cache.fontIds(),ids);
cache.draggedFontId='system';cache.previewFontOrder=['system','import'];assert.deepEqual(cache.fontIds(),['system','import']);
cache.previewFontOrder.reverse();assert.deepEqual(cache.fontIds(),['import','system']);
