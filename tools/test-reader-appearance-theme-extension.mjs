import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import * as geometry from '../entry/src/main/ets/features/reading/ReaderControlAppearanceGeometry.ts';
import { readerControlAppearanceThemeEnd } from '../entry/src/main/ets/features/reading/ReaderControlAppearanceStyle.ts';
import * as scroll from '../entry/src/main/ets/features/reading/ReaderControlMorphScroll.ts';

const url = new URL('../entry/src/main/ets/features/reading/ReaderControlAppearanceContent.ets', import.meta.url);
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
for (const count of [8, 9, 12, 24]) {
  const rows = Math.max(0, Math.ceil(count / 4) - 2);
  for (const p of [0, .25, .5, .9, 1]) {
    const frame = geometry.sampleReaderControlAppearance(p, 286 + 52 * p, 666, count);
    assert.equal(frame.themeShells.length, count); assert.equal(frame.themeSwatches.length, count);
    assert.equal(frame.quickContentHeight, 190 + rows * 28);
    assert.equal(frame.contentHeight, 689 + rows * 64.8);
    for (const actors of [frame.themeShells, frame.themeSwatches]) for (const actor of actors)
      for (const field of ['x', 'y', 'width', 'height', 'opacity']) assert.ok(Number.isFinite(actor[field]));
    const full = geometry.sampleReaderControlAppearance(1, 338, 666, count);
    const last = full.themeShells.at(-1);
    assert.ok(last.y + last.height < full.themeDayAction.y, 'all added rows precede default actions');
    assert.ok(full.themeDayAction.y + full.themeDayAction.height < full.divider.y);
    const firstFont = geometry.readerControlAppearanceFontActor(full, 0, 0);
    near(firstFont.y, 251 + rows * 64.8);
    assert.equal(geometry.readerControlAppearanceFontDropIndex(full, firstFont.x, firstFont.y, 0, 0, 9), 0);
  }
}
assert.deepEqual(geometry.sampleReaderControlAppearance(.6, 317.2, 666),
  geometry.sampleReaderControlAppearance(.6, 317.2, 666, 8), 'existing eight-theme geometry remains exact');

const Content = productionMotionMethods(url, ['frame', 'endpointFrame', 'fullInput', 'sharedInput',
  'extendedThemes', 'scrollInput', 'scrollContentHeight', 'syncExtendedThemeScroll',
  'sharedScrollTranslation', 'fullOnlyScrollTranslation'], { ...geometry, ...scroll });
let ids = Array.from({ length: 9 }, (_, i) => `theme-${i}`), native = 0;
const c = Object.assign(new Content(), {
  themeIds: () => ids, motionProgress: 0, interactionEnabled: true, availableWidth: 286,
  availableHeight: 190, fullContentHeight: 666, cachedThemeCount: -1, endpointThemeCount: -1,
  extendedScrollOffset: 0, extendedScrollPath: scroll.readerControlMorphScrollPath(0, 0),
  extendedScrollInMotion: false, extendedScrollEndpoint: 0,
  scroller: { currentOffset: () => ({ yOffset: native }), scrollTo: v => { native = v.yOffset; } },
});
assert.equal(c.frame().themeShells.length, 9); assert.equal(c.endpointFrame(true).themeShells.length, 9);
ids = Array.from({ length: 12 }, (_, i) => `theme-${i}`);
assert.equal(c.frame().themeShells.length, 12, 'registry count invalidates sampled cache');
assert.equal(c.endpointFrame(false).themeSwatches.length, 12, 'registry count invalidates endpoint cache');
assert.equal(c.scrollInput(), true, 'added quick rows are scrollable, not silently truncated');
native = 28; c.syncExtendedThemeScroll();
assert.equal(c.sharedScrollTranslation(), 0);
c.interactionEnabled = false; c.syncExtendedThemeScroll();
c.motionProgress = .5; c.syncExtendedThemeScroll();
near(native - c.sharedScrollTranslation(), 14, 'one path interpolates quick offset to full top');
c.motionProgress = .25; c.syncExtendedThemeScroll();
near(native - c.sharedScrollTranslation(), 21, 'reverse drag samples the same path');
c.motionProgress = 0; c.interactionEnabled = true; c.syncExtendedThemeScroll();
assert.equal(native, 28, 'returning to interrupted quick endpoint retains actual row');
c.interactionEnabled = false; c.syncExtendedThemeScroll();
c.motionProgress = 1; c.interactionEnabled = true; c.syncExtendedThemeScroll();
assert.equal(native, 0); assert.equal(c.scrollInput(), true);

// SDK-emitted swatches for added IDs still call the actual selection handler;
// safe array length alone must not leave them disabled or without identity.
const source = readFileSync(url, 'utf8');
const { owner } = createReaderBuilderProbe(source, ['themeSwatch'], { readerControlAppearanceThemeEnd });
const chosen = [];
Object.assign(owner, { frame: () => geometry.sampleReaderControlAppearance(1, 338, 666, 12),
  snapshot: { activeTheme: 'theme-8' }, appThemeScheme: 'day', themeColor: () => '#FFFFFF',
  themeLabel: id => id, presentation: () => ({ contentOpacity: 1, contentBlur: 0 }),
  actorPosition: actor => ({ x: actor.x, y: actor.y }), sharedClip: () => 'clip',
  fullInput: () => true, sharedInput: () => true, onThemeChange: id => chosen.push(id),
});
for (const index of [8, 11]) {
  owner.themeSwatch(`theme-${index}`, index);
  const clickable = [...owner.nodes.values()].filter(node => typeof node.onClick === 'function').at(-1);
  assert.ok(clickable); assert.equal(clickable.enabled, true); clickable.onClick();
}
assert.deepEqual(chosen, ['theme-8', 'theme-11']);
console.log('PASS appearance theme extension: 8 unchanged, 9/12/24 geometry, registry cache, quick/full scroll reversal, SDK selection');
