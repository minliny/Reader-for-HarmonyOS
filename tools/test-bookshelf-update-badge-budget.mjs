import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
import { readerSurfaceSpecsForProbe } from './lib/bounded-surface-sdk-probe.mjs';
import { ShelfBookPresentation } from '../entry/src/main/ets/features/bookshelf/presentation/ShelfBookPresentation.ts';
import { bookCoverDisplayUrl } from '../entry/src/main/ets/app/library/BookCoverDisplay.ts';

const definitions = {
  'bounded-badge': {
    description: '当前封面/形变图层角标显式最大宽、省略、系统字号语义和书卡完整计数可访问名称', resources: [],
  },
};
for (const id of selectContractCases(definitions)) {
  runBadgeBudget();
  recordContractCasePass(id);
}

function runBadgeBudget() {
  const page = readFileSync(new URL('../entry/src/main/ets/features/bookshelf/ui/BookshelfPage.ets', import.meta.url), 'utf8');
  const grid = readFileSync(new URL('../entry/src/main/ets/features/bookshelf/ui/BookshelfGridSpec.ets', import.meta.url), 'utf8');
  const geometry = pureModuleProbe(grid, 'BookshelfGridSpec.ets', { ...readerTypographyRoles, TOK_SPACE_XS: 8 },
    ['bookshelfGridFrame', 'bookshelfCoverHeight']);
  const names = ['projectionBookCoverLayer', 'projectionBookCard', 'shelfBookCardWidth', 'bookCardWidth', 'bookCardHeight',
    'gridProgressLabel', 'continueCardFontScale', 'hasCover', 'coverUrl', 'coverErrorHandler', 'failedCoverUrls'];
  const coverSource = readFileSync(new URL('../entry/src/main/ets/ui/patterns/NoCoverCover.ets', import.meta.url), 'utf8');
  class Cover { constructor(owner, params) { Object.assign(this, { owner, params }); } }
  const nativeGesture = new Proxy({}, { get: () => () => {} });
  const properties = createArkUIPropertyRuntimeProbe();
  const probe = createReaderBuilderProbe(page, names, { ...properties.sdk, ...geometry, ...readerSurfaceSpecsForProbe(), ShelfBookPresentation,
    bookCoverDisplayUrl, NoCoverCover: Cover,
    globalThis: { Gesture: nativeGesture }, LongPressGesture: nativeGesture, GesturePriority: { Low: 'low' } },
    { ...properties.hooks, childSources: { NoCoverCover: coverSource } });
  let variants = 0;
  for (const width of [320, 366, 720]) for (const count of [1, 99, 123456789]) for (const fontScale of [1, 2]) {
    for (const morph of [false, true]) {
      const wide = width === 720;
      const owner = new probe.Component(undefined, {});
      Object.assign(owner, {
        appThemeScheme: 'day', viewSwitchGridContentOpacity: 1,
        shelfContentWidth: () => width - 40, projectionCoverRadius: () => 8,
        projectionCoverLayerOpacity: () => 1,
        continueCardFontScale: () => fontScale,
      });
      const book = { sourceId: 'test', bookId: 'same', title: '书名', author: '作者', coverUrl: 'file://cover', unreadCount: count };
      owner.projectionBookCoverLayer(book, wide, morph, () => 0);
      const nodes = [...owner.nodes.values()];
      const text = nodes.find(node => node.type === 'Text' && node.create === `更新 ${count} 章`);
      const badge = nodes.find(node => node.type === 'Row' && node.constraintSize?.maxWidth !== undefined && node.padding?.top === 3);
      assert.ok(text && badge);
      const layer = nodes.find(node => node.type === 'Stack' && node.linearGradient);
      assert.equal(layer.create.alignContent, 'Alignment.TopEnd');
      assert.deepEqual(badge.margin, { top: 7, right: 7 });
      const coverWidth = owner.shelfBookCardWidth(wide);
      assert.equal(badge.constraintSize.maxWidth, Math.max(0, coverWidth - 14));
      assert.equal(text.constraintSize.maxWidth, Math.max(0, coverWidth - 28));
      assert.equal(badge.borderRadius, Math.min(Math.max(0, coverWidth - 14),
        readerTypographyRoles.TYPE_SHELF_UPDATE_BADGE.lineHeightFp * fontScale + 6) / 2,
        'badge Native corners stay finite within the bounded paint width and actual single-line typography budget');
      assert.equal(text.maxLines, 1);
      assert.equal(text.textOverflow.overflow, 'TextOverflow.Ellipsis');
      assert.equal(text.fontSize, readerTypographyRoles.TYPE_SHELF_UPDATE_BADGE.fontSizeFp);
      assert.equal(text.maxFontScale, undefined, 'badge retains the shared system-scale role');
      assert.equal(text.minFontSize, undefined);
      // Native applies the system-scale typography role inside this bounded
      // viewport. SDK attributes do not establish pixel fitting at 2x.
      assert.ok(text.constraintSize.maxWidth + 14 <= badge.constraintSize.maxWidth);
      Object.assign(owner, {
        projectionBookCover() {}, projectionGridDetails() {}, projectionListDetails() {},
        projectionBookWidth: () => coverWidth, projectionBookHeight: () => 200,
        projectionBookTranslateX: () => 0, projectionBookTranslateY: () => 0,
        projectionDetailsOpacity: () => 0,
        bookActionFocusKey: () => 'book', bookSelectionHandler: () => () => {},
        bookActionPresentationHandler: () => () => {}, shelfPressed: () => false,
      });
      owner.projectionBookCard(book, wide, () => 0, 0);
      assert.ok([...owner.nodes.values()].some(node => node.accessibilityText?.includes(`更新 ${count} 章`)),
        'book card preserves the exact count when the visual badge ellipsizes');
      assert.equal(book.unreadCount, count);
      variants++;
    }
  }
  console.log(`PASS actual SDK bounded update badge ${variants} variants; native glyph fitting remains OPEN`);
}
