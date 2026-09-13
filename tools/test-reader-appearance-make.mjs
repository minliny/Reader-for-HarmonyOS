import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { appearanceSelectMenuHeight, appearanceSelectMenuPosition } from '../entry/src/main/ets/features/common/ReaderSelectAppearanceStyle.ts';
import * as style from '../entry/src/main/ets/features/reading/ReaderControlAppearanceStyle.ts';
import { createDefaultReaderAppearanceSnapshot, normalizeReaderAppearanceSnapshot,
  setReaderAppearanceTheme } from '../entry/src/main/ets/features/reading/ReaderAppearanceState.ts';

const Content = productionMotionMethods(new URL('../entry/src/main/ets/features/reading/ReaderControlAppearanceContent.ets', import.meta.url),
  ['selectOptions', 'selectValue', 'applySelect', 'commitSelect', 'toggleSelect', 'metricValue',
    'themeIds', 'themeLabel', 'themeColor', 'themeSummary'], { ...style, appearanceSelectMenuPosition });
const snapshot = createDefaultReaderAppearanceSnapshot();
const content = Object.assign(new Content(), { snapshot, pageTurnSimulationAvailable: true,
  chineseConversionMode: 'none', pageTurnStyle: 'slide', openSelect: '', selectGeneration: 0,
  fullInput: () => true, frame: () => ({ layout: { x: 11, y: 367 }, sectionWidth: 316 }),
  availableWidth: 338, availableHeight: 666, scrollMotion: { nativeScrollOffset: 0 },
  onTemporaryLayerChange() {}, requestSelectClose() { this.selectClosing = true; },
  onIndentRequest(value) { this.snapshot = { ...this.snapshot, indent: value }; },
  onChineseConversionChange(value) { this.chineseConversionMode = value; },
  onAlignmentRequest() { this.snapshot = { ...this.snapshot, alignment: this.snapshot.alignment === 'justify' ? 'start' : 'justify' }; },
  onPageTurnStyleChange(value) { this.pageTurnStyle = value; },
});

// Run the real menu handlers: selection updates the value, dismissal keeps it,
// stale/foreign options never leak into another setting, and reopen reads state.
for (const [kind, value, y] of [['indent', '1字符', 38], ['indent', '2字符', 38],
  ['language', '繁转简', 80], ['language', '简转繁', 80], ['alignment', '关闭', 164],
  ['alignment', '开启', 164], ['pageTurn', '滚动', 122], ['pageTurn', '覆盖', 122]]) {
  content.openSelect = '';
  content.toggleSelect(kind, y);
  assert.equal(content.selectClosing, false);
  const id = content.selectIdentity;
  content.commitSelect(value, id);
  assert.equal(content.selectValue(kind), value);
  content.toggleSelect(kind, y);
  assert.equal(content.selectClosing, true);
  content.openSelect = '';
  content.toggleSelect(kind, y);
  content.commitSelect('无', id);
  assert.equal(content.selectValue(kind), value, 'old menu cannot overwrite a later opening');
  content.commitSelect('不存在', content.selectIdentity);
  assert.equal(content.selectValue(kind), value, 'invalid options cannot reach Host callbacks');
}
content.pageTurnSimulationAvailable = false;
assert.ok(!content.selectOptions('pageTurn').includes('仿真'));
assert.ok(!content.selectOptions('pageTurn').includes('淡入'), 'visual update cannot invent an unsupported page-turn model');
assert.deepEqual(['fontSize', 'lineHeightMultiplier', 'paragraphSpacing', 'letterSpacing'].map(m => content.metricValue(m)),
  ['18px', '1.96', '16px', '0px']);

// Independent Make V9 values, read from the actual rendered preview.
const expected = ['#FFFCF8F0', '#FFF4E3BF', '#FF2B2823', '#FF413020', '#FFEBDABB', '#FFD7E8CF', '#FF26313F', '#FF24382C'];
const SharedActors = productionMotionMethods(new URL('../entry/src/main/ets/features/reading/ReaderAppearanceSharedActors.ets', import.meta.url),
  ['themeIds', 'themeLabel', 'themeColor'], { ...style });
const shared = new SharedActors();
assert.deepEqual(shared.themeIds().map(id => shared.themeColor(id)), expected);
assert.equal(shared.themeLabel('paperNight'), '靛夜');
for (const progress of [0, .25, .5, .75, 1]) {
  content.motionProgress = progress;
  assert.deepEqual(content.themeIds().map(id => content.themeColor(id)), expected);
}
content.snapshot = normalizeReaderAppearanceSnapshot(setReaderAppearanceTheme(snapshot, 'paperNight'));
assert.equal(content.snapshot.activeTheme, 'paperNight');
assert.equal(content.themeLabel(content.snapshot.activeTheme), '靛夜');
assert.equal(content.themeSummary(), '日间：日间 · 夜间：夜间');

// Both directions and native scroll offsets keep the entire menu hittable.
for (const [width, height] of [[308, 360], [338, 666], [690, 780]]) {
  for (const top of [0, 42, height / 2, height - 35]) {
    for (const count of [2, 3, 5]) {
      const menu = appearanceSelectMenuPosition(width - 23, top, count, width, height);
      assert.ok(menu.x >= 0 && menu.x + 104 <= width);
      assert.ok(menu.y >= 0 && menu.y + appearanceSelectMenuHeight(count) <= height);
      assert.ok(menu.y >= top + 30 || menu.y + appearanceSelectMenuHeight(count) <= top);
    }
  }
}
content.openSelect = '';
content.scrollMotion.nativeScrollOffset = 107;
content.toggleSelect('language', 80);
assert.equal(content.selectAnchorX, 211);
assert.equal(content.selectAnchorY, 380.5);
console.log('PASS Make V9 appearance: real selection handlers, stale menus, scroll/viewport placement, Quick/Full swatches and persisted theme identity. Native pixels remain separate.');
