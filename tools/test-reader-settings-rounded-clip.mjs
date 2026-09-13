import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { productionSettingsOptionModifier } from './lib/reader-control-option-modifier-probe.mjs';
import * as geometry from '../entry/src/main/ets/features/reading/ReaderControlSettingsGeometry.ts';
import * as actors from '../entry/src/main/ets/features/reading/ReaderControlActorGeometry.ts';
import * as paint from '../entry/src/main/ets/features/reading/ReaderControlMotionPresentation.ts';
import * as policy from '../entry/src/main/ets/features/reading/ReaderSettingsState.ts';
import { readerAppColor } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';

const source = readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderControlSettingsContent.ets', import.meta.url), 'utf8');
const fixture = JSON.parse(readFileSync(new URL('./fixtures/reader-control-search-settings-live-20260905.json', import.meta.url), 'utf8'));
const design = fixture.sources.find(n => n.key === 'settingsDesign').result.content.map(n => n.text ?? '').join('\n');
for (const id of ['1692:3687', '1692:3692', '1692:3699']) {
  const line = design.split('\n').find(n => n.includes(`data-node-id="${id}"`));
  assert.match(line, /rounded-\[var\(--fd-ds-radius-large,8px\)\]/);
  assert.match(line, /reader-control-panel-soft,rgba\(238,230,219,0\.64\)/);
}
const motion = JSON.parse(fixture.sources.find(n => n.key === 'settingsMotion').result.content[0].text);
const surface = motion.nodes.find(n => n.nodeId === '1692:3148');
assert.match(surface.codeSnippets.css, /0% \{ opacity: 0;/);
assert.match(surface.codeSnippets.css, /100% \{ opacity: 1;/);

function probe(sourceText) {
  let owner, activeId, mounting = false;
  const ancestors = [], parentById = new Map();
  // Real SDK create/pop calls establish parentage. Attribute records are not a
  // native renderer: the test proves the emitted paint/mask ownership and that
  // retained observers continue to update both layers without remounting.
  const NativeStack = new Proxy({ name: 'Stack' }, { get: (_, property) => {
    if (property === 'name') return 'Stack';
    return (...args) => {
      if (property === 'pop') { if (mounting) ancestors.pop(); return; }
      const node = owner.nodes.get(activeId);
      if (property === 'create') { node.type = 'Stack'; if (mounting) ancestors.push(activeId); }
      node[property] = args.length === 1 ? args[0] : args;
      return NativeStack;
    };
  } });
  const members = ['segmentRow', 'p', 'geometry', 'bar', 'label', 'presentation', 'sharedRect', 'sharedClip', 'choice',
    'optionModifier', 'groupOptions', 'groupLabel', 'optionLabel', 'isSegmentActive', 'isSegmentAvailable',
    'segmentAccessibilityText', 'handleSegment'];
  const built = createReaderBuilderProbe(sourceText, members, { ...geometry, ...actors, ...paint, ...policy,
    Stack: NativeStack, ReaderControlSettingsOptionModifier: productionSettingsOptionModifier(),
    SETTINGS_DIRECTION_OPTIONS: ['system', 'portrait', 'landscape'],
    SETTINGS_PAGE_OPTIONS: ['cover', 'slide', 'simulation', 'scroll', 'none'],
    SETTINGS_TIMEOUT_OPTIONS: ['system', 'oneMinute', 'fiveMinutes', 'tenMinutes', 'alwaysOn'] });
  owner = built.owner;
  const observe = owner.observeComponentCreation2;
  owner.observeComponentCreation2 = function(callback, component) {
    parentById.set(this.observers.length, ancestors.at(-1));
    return observe.call(this, callback, component);
  };
  const run = owner.runObserver;
  owner.runObserver = function(id, initial) { activeId = id; return run.call(this, id, initial); };
  let paths = 0, rectangles = 0;
  const clipCache = new paint.ReaderControlMotionClipCache(path => { paths++; return { path }; },
    () => { rectangles++; return { width: '100%', height: '100%' }; });
  Object.assign(owner, { motionProgress: 0, availableWidth: 261.714285714, fullViewportHeight: 666,
    geometryProgress: -1, geometryWidth: -1, paintProgress: -1, clipEndpointWidth: -1,
    clipFullRects: [], clipQuickRects: [], scrollMotion: { fullScrollOffset: 0 }, clipCache,
    getUIContext: () => ({ vp2px: n => n * 3.5 }), optionModifiers: [], snapshot: policy.createDefaultReaderSettingsSnapshot(),
    appThemeScheme: 'day', interactionEnabled: true, pageTurnSimulationAvailable: true });
  mounting = true;
  ['direction', 'pageTurn', 'timeout'].forEach((group, row) => owner.segmentRow(group, row));
  mounting = false;
  assert.equal(ancestors.length, 0, 'actual SDK create/pop hierarchy is balanced');
  const layers = [...owner.nodes.entries()].filter(([, n]) => n.type === 'Stack' && n.backgroundColor !== undefined);
  assert.equal(layers.length, 3, 'one painted surface for each real group');
  function validate() {
    for (const [row, labelText] of ['direction', 'pageTurn', 'timeout'].map(group => owner.groupLabel(group)).entries()) {
      const label = [...owner.nodes.values()].find(n => n.type === 'Text' && n.create === labelText);
      assert.ok(label.lineHeight <= label.height, 'a native label line must fit its motion clipping box');
      assert.ok(label.position.y + label.height <= owner.bar(row).y, 'the complete label stays above its option bar');
    }
    layers.forEach(([id, layer], row) => {
      const parent = owner.nodes.get(parentById.get(id));
      assert.ok(parent?.clipShape, 'rounded paint must have a separate parent carrying the dynamic visibility mask');
      assert.equal(parent.backgroundColor, undefined, 'the dynamic clip carrier has no paint');
      assert.equal(parent.border, undefined, 'the dynamic clip carrier has no stroke');
      assert.equal(layer.clipShape, undefined, 'round paint layer never receives the rectangular visibility mask');
      assert.equal(layer.borderRadius, 8); assert.equal(layer.clip, true);
      assert.equal(layer.backgroundColor, readerAppColor('TOK_SURFACE_PANEL_SOFT', owner.appThemeScheme));
      assert.equal(layer.border.color, readerAppColor('TOK_LINE', owner.appThemeScheme));
      assert.deepEqual(layer.position, { x: 0, y: 0 }, 'no border inset from automatic Stack placement');
      const bar = owner.bar(row);
      assert.equal(layer.width, bar.width); assert.equal(layer.height, bar.height);
      assert.equal(parent.width, bar.width); assert.equal(parent.height, bar.height);
      assert.deepEqual(parent.position, { x: bar.x, y: bar.y });
      const options = [...owner.nodes.entries()].filter(([child, n]) => n.type === 'Text' && parentById.get(child) === id);
      assert.equal(options.length, row === 0 ? 3 : 5);
      for (const [, option] of options) { assert.equal(option.borderRadius, 6); assert.equal(typeof option.onClick, 'function'); }
    });
  }
  validate();
  const initialNodes = owner.nodes.size;
  for (const scheme of ['day', 'night']) for (const delta of [-24.285714286, 0, 120]) {
    for (const p of [0, .2, .5, 1, .5, .2, 0]) {
      Object.assign(owner, { motionProgress: p, availableWidth: 286 + 52 * p + delta, appThemeScheme: scheme });
      owner.replay(); validate();
    }
  }
  assert.equal(paths, 0); assert.equal(rectangles, 1, 'full coverage still reuses one rectangle across all groups and widths');
  owner.motionProgress = .5; owner.fullViewportHeight = 190; owner.scrollMotion.fullScrollOffset = 170;
  owner.replay(); validate();
  const partialPaths = paths;
  assert.ok(partialPaths > 0, 'scrolled/partly-visible groups retain the existing path mask');
  owner.replay(); validate(); assert.equal(paths, partialPaths, 'unchanged partial masks stay cached');
  assert.equal(owner.nodes.size, initialNodes, 'forward/reverse/scroll do not remount either layer or choices');
  return { layers: layers.map(([id, layer]) => ({ parent: owner.nodes.get(parentById.get(id)), paint: layer })),
    counters: { paths, rectangles, nodes: owner.nodes.size }, sourceEvidence: '1692:3687/3692/3699 round8 + 1692:3148 quick0/full1' };
}

const result = probe(source);
assert.throws(() => probe(source.replace('.fontSize(10 + this.p()).lineHeight(this.label(row).height)',
  '.fontSize(11).lineHeight(16)')), /native label line/,
  'the shipped fixed Full typography in a Quick 12vp mask reproduces PH05');
const collapsed = source.replace('      .borderRadius(8).clip(true).position({ x: 0, y: 0 });',
  '      .borderRadius(8).clip(true).position({ x: 0, y: 0 }).clipShape(this.sharedClip(row, true));')
  .replace('    .clipShape(this.sharedClip(row, true));', '    ;');
assert.notEqual(collapsed, source);
assert.throws(() => probe(collapsed), /separate parent carrying|never receives/,
  'putting the rectangle/path back onto the painted bar reproduces the original structural failure');
const record = process.argv.indexOf('--record');
if (record >= 0) writeFileSync(process.argv[record + 1], JSON.stringify(result, null, 2) + '\n');
console.log('Settings real SDK Builder hierarchy: separate rounded paint and cached dynamic mask; 42 reversible width/theme poses + partial scroll + mutation PASS');
