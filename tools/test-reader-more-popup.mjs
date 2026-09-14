import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { readerAppColor } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';

const file = new URL('../entry/src/main/ets/features/reading/ReaderControlPanel.ets', import.meta.url);
const source = readFileSync(file, 'utf8');
const enums = name => new Proxy({}, { get: (_, key) => `${name}.${String(key)}` });
const typography = { fontFamily: 'ReaderNotoSerifSC', fontWeight: 400, fontSizeFp: 12 };
const dependencies = {
  Placement: enums('Placement'), ArrowPointPosition: enums('ArrowPointPosition'), BlurStyle: enums('BlurStyle'),
  TYPE_READER_CONTROL_BOOK_TITLE: typography, TYPE_READER_CONTROL_CHAPTER_SOURCE: typography,
  TYPE_READER_CONTROL_SOURCE_ACTION: typography,
};
const methods = ['topBar', 'readerMoreMenu', 'readerMoreAction', 'readerMoreMenuWidth',
  'readerMoreActionEnabled', 'setMoreMenuVisible', 'dismissMoreMenu', 'performMoreAction'];
function fixture(scheme = 'day') {
  const { owner } = createReaderBuilderProbe(source, methods, dependencies);
  const actions = [], measurements = [], temporary = [];
  let textScale = 1;
  Object.assign(owner, {
    appScheme: scheme, bookTitle: '当前书名', chapterTitle: '当前章节', sourceLabel: () => '当前书源',
    inputEnabled: true, controlObscured: false, chapterRefreshEnabled: true, bookDownloadEnabled: true,
    moreMenuVisible: false, moreMenuMeasuredWidth: 0,
    layout: { viewportWidth: 390, viewportHeight: 844, topBarWidth: 360 },
    controlSession: Object.freeze({ location: Object.freeze({ module: 'appearance', form: 'full' }) }),
    frame: () => ({ visibility: 1 }), isLocalBook: () => false,
    onTemporaryLayerChange: visible => temporary.push(visible),
    onOpenBookInfo: () => actions.push('info'), onRefreshChapter: () => actions.push('refresh'),
    onDownloadBook: () => actions.push('download'), onExitReading: () => actions.push('exit'),
    onSourceSwitch: () => actions.push('source'),
    getUIContext: () => ({
      getMeasureUtils: () => ({ measureTextSize: options => {
        measurements.push(options);
        return { width: options.textContent.length * 15 * 3 * textScale };
      } }), px2vp: px => px / 3,
    }),
  });
  owner.topBar();
  const nodes = () => [...owner.nodes.values()];
  const anchor = nodes().find(node => node.accessibilityText === '更多');
  return { owner, anchor, nodes, actions, measurements, temporary, setTextScale: scale => { textScale = scale; } };
}

for (const scheme of ['day', 'night']) {
  const t = fixture(scheme), original = t.owner.controlSession;
  assert.deepEqual([t.anchor.width, t.anchor.height], [34, 42], 'existing More target remains the popup anchor');
  assert.equal(t.measurements.length, 0, 'closed top bar does not measure menu text');
  assert.equal(t.anchor.bindPopup[0], false);
  t.anchor.onClick(); t.owner.replay();
  const [visible, popup] = t.anchor.bindPopup;
  assert.equal(visible, true);
  assert.deepEqual([popup.placement, popup.enableArrow, popup.arrowWidth, popup.arrowHeight, popup.radius],
    ['Placement.BottomRight', true, 24, 12, 16]);
  assert.equal(popup.arrowPointPosition, 'ArrowPointPosition.CENTER');
  assert.equal(popup.width, 126, 'longest actual label at 15fp + two 18vp text insets');
  assert.equal(popup.backgroundBlurStyle, 'BlurStyle.NONE');
  assert.equal(popup.popupColor, readerAppColor('app.BookshelfMoreMenu.build.backgroundColor.FFFFFCF8', scheme));
  assert.equal(popup.borderWidth, 1);
  assert.deepEqual(popup.borderLinearGradient.colors, [0, 1].map(stop =>
    [readerAppColor('app.BookshelfMoreMenu.build.color.FFE3DED6', scheme), stop]));
  assert.equal(popup.shadow.radius, 28); assert.equal(popup.shadow.offsetY, 10);
  assert.ok(popup.autoCancel && popup.mask && popup.focusable && popup.followTransformOfTarget);
  assert.equal(popup.offset, undefined, 'native anchor/avoidance replaces manual screen coordinates');
  assert.equal(t.measurements.length, 3);
  for (const options of t.measurements) assert.deepEqual([options.fontFamily, options.fontSize, options.fontWeight],
    ['ReaderNotoSansSC', '15fp', '500']);
  t.owner.replay(); assert.equal(t.measurements.length, 3, 'ordinary publication reuses measured width');
  popup.builder.builder(); // SDK wraps CustomBuilder with its bound native builder record.
  const menuLabels = ['书籍信息', '刷新本章', '下载全部章节'];
  const rowTexts = t.nodes().filter(node => menuLabels.includes(node.create));
  assert.deepEqual(rowTexts.map(node => node.create), menuLabels);
  for (const text of rowTexts) {
    assert.deepEqual([text.fontSize, text.lineHeight, text.fontWeight], [15, 22, 'FontWeight.Medium']);
    assert.equal(text.fontColor, readerAppColor('TOK_INK', scheme));
  }
  const scroll = t.nodes().find(node => node.type === 'Scroll');
  assert.equal(scroll.height, 150); assert.equal(scroll.position, undefined);
  const rows = menuLabels.map(label => t.nodes().find(node => node.accessibilityText === label));
  assert.ok(rows.every(row => row.height === 50 && row.enabled === true));
  t.owner.bookDownloadEnabled = false; t.owner.chapterRefreshEnabled = false; t.owner.replay();
  assert.deepEqual(rows.map(row => row.enabled), [true, false, false], 'retained builder observes fresh action availability');
  t.owner.bookDownloadEnabled = true; t.owner.chapterRefreshEnabled = true; t.owner.replay();
  assert.ok(rows.every(row => row.enabled === true));
  for (let index = 0; index < rows.length; index++) {
    t.owner.setMoreMenuVisible(true); rows[index].onClick(); rows[index].onClick();
    assert.equal(t.actions.length, index + 1, 'each click dispatches once and closes its temporary layer');
  }
  assert.deepEqual(t.actions, ['info', 'refresh', 'download']);
  assert.equal(t.owner.controlSession, original, 'More actions never rewrite expansion/module state');
  t.owner.setMoreMenuVisible(true);
  popup.onStateChange({ isVisible: false });
  assert.equal(t.owner.moreMenuVisible, false); assert.equal(t.temporary.at(-1), false);
  console.log(`PASS PH87 ${scheme}: actual SDK anchored popup, three guarded actions, application colors and dismissal`);
}

const t = fixture();
t.owner.bookDownloadEnabled = false; t.anchor.onClick(); t.owner.replay(); t.anchor.bindPopup[1].builder.builder();
const download = t.nodes().find(node => node.accessibilityText === '下载全部章节');
assert.equal(download.enabled, false); download.onClick();
assert.deepEqual(t.actions, []); assert.equal(t.owner.moreMenuVisible, true);
t.owner.chapterRefreshEnabled = false; t.owner.performMoreAction('refresh'); assert.deepEqual(t.actions, []);
t.owner.inputEnabled = false; t.owner.performMoreAction('info'); assert.deepEqual(t.actions, []);
t.owner.inputEnabled = true; t.owner.controlObscured = true; t.owner.performMoreAction('info'); assert.deepEqual(t.actions, []);
t.owner.dismissMoreMenu(); t.owner.setMoreMenuVisible(true); assert.equal(t.owner.moreMenuVisible, false);
t.owner.controlObscured = false; t.owner.frame = () => ({ visibility: 0 });
t.owner.setMoreMenuVisible(true); assert.equal(t.owner.moreMenuVisible, false);
console.log('PASS PH87 disabled download/refresh, obscured and hidden controls cannot dispatch');

const g = fixture();
for (const [viewport, textScale, expected] of [[390, 1, 126], [840, 2, 216], [150, 2, 126]]) {
  g.owner.layout.viewportWidth = viewport; g.setTextScale(textScale);
  g.owner.setMoreMenuVisible(true); g.owner.replay();
  assert.equal(g.anchor.bindPopup[1].width, expected);
  g.owner.dismissMoreMenu(); g.owner.replay();
}
g.owner.layout.viewportHeight = 100; g.owner.readerMoreMenu();
assert.equal(g.nodes().find(node => node.type === 'Scroll').height, 64,
  'short windows retain a bounded native scroll viewport and arrow/window clearance');
assert.equal(g.measurements.length, 9, 'fresh openings remeasure font scale; no per-frame text measurement');
const Lifecycle = productionMotionMethods(file, ['onRuntimeEnabledChanged', 'dismissMoreMenu', 'setMoreMenuVisible']);
for (const [inputEnabled, controlObscured] of [[false, false], [true, true]]) {
  const layers = [], owner = Object.assign(new Lifecycle(), { moreMenuVisible: true, inputEnabled, controlObscured,
    onTemporaryLayerChange: visible => layers.push(visible) });
  owner.onRuntimeEnabledChanged(); assert.equal(owner.moreMenuVisible, false); assert.deepEqual(layers, [false]);
}
assert.doesNotMatch(source, /if \(this\.moreMenuVisible\) \{ this\.readerMoreMenu\(\); \}/,
  'removed the independent overlay tree; native popup is the single menu owner');
assert.match(source, /if \(this\.moreMenuVisible && visual\.visibilityProgress <= 0\) this\.dismissMoreMenu\(\)/);
console.log('PASS PH87 adaptive text/window geometry and popup lifecycle; native pixels/placement remain a platform gate');
