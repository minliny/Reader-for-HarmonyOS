import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
const source = readFileSync(new URL('../entry/src/main/ets/features/bookshelf/LocalBookDetail.ets', import.meta.url), 'utf8');
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
for (const name of ['heroCard', 'summaryCard']) require(`${sdk}/lib/component_map.js`).CUSTOM_BUILDER_METHOD.add(name);
const { Component } = createReaderBuilderProbe(source, ['detailScroll', 'chapterSection', 'chapterRow',
  'visibleToc', 'chapterSectionHeight', 'chapterEmptyMessage'], {
  ButtonType: { Normal: 'normal' }, CHAPTER_PREVIEW_LIMIT: 20, CHAPTER_SECTION_HEIGHT: 282,
  CHAPTER_ROW_HEIGHT: 58, TOK_SPACE_XS: 8,
});
// SDK output declares native attributes; it does not simulate compositor pixels.
// Different directory lengths keep explicit top anchoring and flexible sizing.
// Actual short/tall viewport geometry requires native layout verification.
for (const width of [352, 720]) for (const count of [0, 1, 3, 20]) {
  const owner = new Component();
  Object.assign(owner, { appThemeScheme: 'day', contentWidth: () => width,
    heroCard() {}, summaryCard() {}, book: { sourceId: 'local', bookId: 'layout' },
    toc: Array.from({ length: count }, (_, index) => ({ index, title: `第${index + 1}章` })),
    removing: false, readingEnabled: true, loadingMessage: '', readingBlockedReason: '' });
  owner.detailScroll();
  const nodes = [...owner.nodes.values()];
  const scroll = nodes.find(node => node.type === 'Scroll');
  assert.ok(['Alignment.Top', 'Alignment.TopStart'].includes(scroll.align),
    `${width}vp/${count} chapters: content must not inherit Scroll's center alignment`);
  assert.equal(scroll.layoutWeight, 1); assert.equal(scroll.height, undefined);
  assert.equal(scroll.width, '100%');
  assert.equal(nodes.filter(node => node.type === 'Row' && node.height === 58).length, count);
  const section = nodes.find(node => node.type === 'Stack' && node.clip === true);
  assert.equal(section.height, count ? 50 + 58 * count : 282);
  assert.equal(nodes.find(node => node.type === 'Column' && node.width === width).padding.top, 8);
  assert.equal(nodes.filter(node => node.type === 'Scroll').length, 1, 'directory previews share the page scroll');
}
console.log('PASS SDK detail Scroll: 0/1/3/20 chapters and narrow/wide content; explicit top alignment and flexible height, native viewport geometry unverified');
