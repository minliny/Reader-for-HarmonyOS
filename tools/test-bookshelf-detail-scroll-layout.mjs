import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { READER_FLOATING_TOP_BAR_HEIGHT, readerFloatingBarBottomInset } from './lib/reader-floating-bar-metrics-probe.mjs';
import { ReaderWindowMetricsSnapshot, ReaderRectVp, ReaderInsetsVp } from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
const source = readFileSync(new URL('../entry/src/main/ets/features/bookshelf/LocalBookDetail.ets', import.meta.url), 'utf8');
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
for (const name of ['heroCard', 'summaryCard']) require(`${sdk}/lib/component_map.js`).CUSTOM_BUILDER_METHOD.add(name);
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
syntax.componentCollection.customComponents.add('PageBackBar');
syntax.propCollection.set('PageBackBar', new Set(['title', 'backIcon', 'onBack']));
class Header { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
let metrics;
const { Component } = createReaderBuilderProbe(source, ['build', 'backBar', 'detailScroll', 'actionArea',
  'actionAreaBottomOffset', 'chapterSection', 'chapterRow', 'visibleToc', 'chapterSectionHeight',
  'chapterEmptyMessage', 'readingActionLabel', 'shelfActionLabel', 'actionButtonWidth'], {
  ButtonType: { Normal: 'normal' }, CHAPTER_PREVIEW_LIMIT: 20, CHAPTER_SECTION_HEIGHT: 282,
  CHAPTER_ROW_HEIGHT: 58, TOK_SPACE_XS: 8, TOK_SPACE_MD: 16, TOK_SPACE_CONTROL_INLINE: 10,
  DETAIL_ACTION_AREA_HEIGHT: 77, READER_FLOATING_TOP_BAR_HEIGHT, readerFloatingBarBottomInset,
  ReaderWindowCoordinator: { metrics: () => metrics }, PageBackBar: Header,
});
// This executes the SDK output and verifies its native attributes and actors.
// The probe does not replace native viewport, compositor or gesture validation.
for (const [width, buttonWidth] of [[282, 128], [352, 163], [720, 347]])
  for (const count of [0, 1, 3, 20]) for (const safeBottom of [0, 24, 48]) {
  metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, width + 38, 844), undefined,
    new ReaderInsetsVp(0, 0, 0, safeBottom));
  const owner = new Component(); const calls = [];
  Object.assign(owner, { appThemeScheme: 'day', readerWindowMetricsRevision: 1,
    contentWidth: () => width, contentFrame: () => ({ left: 19, right: 19, width }),
    heroCard() {}, summaryCard() {}, book: { sourceId: 'local', bookId: 'layout' },
    toc: Array.from({ length: count }, (_, index) => ({ index, title: `第${index + 1}章` })),
    shelfMessage: '加入书架失败，请重试', inBookshelf: true, removalEnabled: true,
    removing: false, adding: false, cancellingAdd: false, readingEnabled: true, loadingMessage: '', readingBlockedReason: '',
    onContinue: () => calls.push('continue'), onRemove: () => calls.push('remove') });
  owner.initialRender();
  const nodes = [...owner.nodes.values()];
  assert.equal(nodes[0].type, 'Stack');
  assert.equal(nodes[0].create.alignContent, 'Alignment.TopStart');
  const scroll = nodes.find(node => node.type === 'Scroll');
  assert.equal(scroll.align, 'Alignment.Top');
  assert.equal(scroll.layoutWeight, undefined); assert.equal(scroll.height, '100%');
  assert.equal(scroll.width, '100%');
  assert.deepEqual(scroll.padding, { left: 19, right: 19 }, 'vertical clearance belongs to scrolling content');
  assert.equal(nodes.filter(node => node.type === 'Row' && node.height === 58).length, count);
  const section = nodes.find(node => node.type === 'Stack' && node.clip === true);
  assert.equal(section.height, count ? 50 + 58 * count : 282);
  const offset = Math.max(0, safeBottom - 15);
  const content = nodes.find(node => node.type === 'Column' && node.width === width);
  assert.deepEqual(content.padding, { top: 66, bottom: 77 + offset });
  const footer = nodes.find(node => node.type === 'Stack' && node.create.alignContent === 'Alignment.Bottom');
  assert.deepEqual([footer.width, footer.height], ['100%', '100%']);
  assert.deepEqual(footer.padding, { left: 19, right: 19, bottom: offset });
  assert.equal(footer.align, undefined, 'the overlay parent Stack positions the footer without child-content align');
  assert.equal(footer.hitTestBehavior, 'HitTestMode.Transparent');
  const actions = nodes.find(node => node.type === 'Row' && node.height === 77);
  assert.equal(actions.width, width);
  assert.deepEqual(actions.padding, { top: 16, bottom: 15 });
  assert.equal(actions.hitTestBehavior, 'HitTestMode.Transparent');
  assert.equal(actions.linearGradient, undefined, 'only the rounded buttons paint the floating action area');
  assert.equal(actions.backgroundColor, undefined);
  const buttons = nodes.filter(node => node.type === 'Stack' && node.height === 46);
  assert.equal(buttons.length, 2);
  assert.deepEqual(buttons.map(button => button.width), [buttonWidth, buttonWidth]);
  assert.deepEqual(buttons.map(button => button.margin), [{ left: 4, right: 4 }, { left: 4, right: 4 }]);
  assert.equal(buttons.reduce((occupied, button) => occupied + button.width + button.margin.left +
    button.margin.right, 10), actions.width, 'two narrower buttons retain the row width with their margins and gap');
  buttons[0].onClick(); buttons[1].onClick();
  assert.deepEqual(calls, ['continue', 'remove']);
  const error = nodes.find(node => node.type === 'Text' && node.create === owner.shelfMessage);
  assert.ok(error.id > content.id && error.id < footer.id, 'shelf errors remain in the scrolling content before overlay actors');
  const header = [...owner.children.values()].find(child => child instanceof Header);
  assert.ok(header.id > scroll.id && header.id < footer.id, 'the shared header mounts above the already-created scroll');
  assert.equal(nodes.filter(node => node.type === 'Scroll').length, 1, 'directory previews share the page scroll');
  for (const scheme of ['night', 'day']) { owner.appThemeScheme = scheme; owner.replay(); }
}
console.log('PASS SDK detail floating header/actions: 0/1/3/20 chapters, narrow/wide, 0/24/48 vp safe bottom, in-content errors and preserved button callbacks; native geometry remains unverified');
