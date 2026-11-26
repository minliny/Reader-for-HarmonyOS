import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createReaderBuilderProbe } from '../../lib/reader-control-builder-probe.mjs';
import { READER_FONT_NOTO_SANS_SC_UI_REGULAR } from '../../../entry/src/main/ets/ui/foundation/ReaderFontFamilies.ts';

const etsRoot = new URL('../../../entry/src/main/ets/', import.meta.url);
const surfaceSource = readFileSync(new URL('features/manga/ui/MangaReadingSurface.ets', etsRoot), 'utf8');
const headerSource = readFileSync(new URL('ui/chrome/ReaderReadingTopBar.ets', etsRoot), 'utf8');

test('SDK bounds the manga dock to its hit surface', () => {
  const insets = { left: 13, top: 40, right: 19, bottom: 18 };
  const { owner: surface } = createReaderBuilderProbe(surfaceSource, ['readerChrome', 'dockWidth', 'bottomControls',
    'dockHeight', 'dockPageRowHeight', 'dockActionHeight', 'bottomControlViewportHeight'], {
    READER_FONT_NOTO_SANS_SC_UI_REGULAR,
    ReaderIconButton: class { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } },
  }, {
    childSources: { ReaderIconButton: readFileSync(new URL('ui/controls/ReaderIconButton.ets', etsRoot), 'utf8') },
  });
  Object.assign(surface, {
    viewportWidth: 390, viewportHeight: 800, opened: true, horizontalPageCount: 8,
    topControls() {}, footerAction() {}, controlFontScale: () => 1,
    interactiveInsets: () => insets, mangaTopBarHeight: () => 52, offlineProbeStatus: '',
    chromeScheme: () => 'day', presentedPage: () => 2, pageOrdinal: () => 1,
    greenColor: () => 'green', mutedColor: () => 'muted', lineColor: () => 'line',
  });
  surface.readerChrome(insets);
  const nodes = () => [...surface.nodes.values()];
  const topCarrier = nodes().find(node => node.type === 'Column' && node.position?.top === insets.top);
  assert.equal(topCarrier.width, 'calc(100% - 32vp)');
  assert.deepEqual(topCarrier.position, { left: 13, top: 40 });
  assert.equal(topCarrier.hitTestBehavior, 'HitTestMode.Default');
  assert.equal(topCarrier.touchable, false);
  assert.equal(topCarrier.onTouch, undefined);

  const scroll = nodes().find(node => node.type === 'Scroll');
  assert.deepEqual(scroll.position, { left: 43, bottom: 30 }, 'outer gutter and bottom gap stay outside the scroll viewport');
  assert.equal(scroll.width, 298);
  assert.equal(scroll.height, 150);
  assert.equal(scroll.enableScrollInteraction, false);
  assert.equal(scroll.hitTestBehavior, 'HitTestMode.Default');
  const dockPaint = surface.attributeCalls.find(call => call.property === 'attributeModifier' && call.args[0].id === 'manga-dock');
  assert.ok(dockPaint, 'the actual dock paints its own surface');
  const dock = surface.nodes.get(dockPaint.id);
  assert.equal(dock.hitTestBehavior, 'HitTestMode.Default');
  assert.equal(typeof dock.onTouch, 'function');
  assert.equal(dock.onClick, undefined);
  assert.ok(nodes().some(node => node.type === 'Slider' && typeof node.onChange === 'function'));

  surface.viewportWidth = 888;
  surface.viewportHeight = 220;
  surface.replay();
  assert.equal(scroll.width, 560);
  assert.equal(scroll.height, 88);
  assert.equal(scroll.enableScrollInteraction, true, 'short windows still allow the dock to scroll');
});

test('SDK gives the manga top bar a touch barrier without a click action', () => {
  const { owner: header } = createReaderBuilderProbe(headerSource, ['build', 'leading', 'trailing', 'empty'], {
    ReaderReadingTopBarTitle: class { applyNormalAttribute() {} },
    readerHeaderVeilMaterial: () => ({ radius: 1 }), readerHeaderVeilBorder: () => 'line',
  });
  Object.assign(header, {
    variant: 'manga', barWidth: 390, scheme: 'day', inputEnabled: true,
    bookTitle: '漫画阅读', subtitle: '第一话', leading() {}, trailing() {},
    resolvedHeight: () => 52, titleFontScale: () => 1,
  });
  header.initialRender();
  const headerPaint = [...header.nodes.values()].find(node => node.type === 'Stack' && node.backgroundEffect !== undefined);
  assert.ok(headerPaint);
  assert.equal(headerPaint.hitTestBehavior, 'HitTestMode.Default');
  assert.equal(typeof headerPaint.onTouch, 'function');
  assert.equal(headerPaint.onClick, undefined);
});
