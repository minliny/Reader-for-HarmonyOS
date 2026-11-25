import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const definitions = {
  'live-width-safe-frame': { description: '实际详情文字／漫画安全区与书架 Area 解析', resources: [] },
};
for (const id of selectContractCases(definitions)) {
  await runLiveWidthSafeFrame();
  recordContractCasePass(id);
}

async function runLiveWidthSafeFrame() {
  const { default: assert } = await import('node:assert/strict');
  const { localBookDetailSdk } = await import('./lib/local-book-detail-sdk-probe.mjs');
  const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
  const { actualReaderPageShell } = await import('./lib/reader-page-shell-runtime-probe.mjs');
  const { ReaderInsetsVp, ReaderRectVp, ReaderWindowMetricsSnapshot } =
    await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');

  const metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, 390, 844));
  const safeLeft = 40;
  const safeRight = 7;
  metrics.systemInsets = new ReaderInsetsVp(safeLeft, 0, safeRight, 0);
  const { owner } = localBookDetailSdk({ ReaderWindowCoordinator: { metrics: () => metrics } });
  for (const contentKind of ['text', 'manga']) {
    Object.assign(owner, { book: { contentKind }, viewportWidth: 0, readerWindowMetricsRevision: 1 });
    for (const width of [0, 160, 320, 390, 800]) {
      metrics.windowRect = new ReaderRectVp(0, 0, width, 844);
      owner.refreshGeometry();
      for (const method of ['contentFrame', 'dockFrame']) {
        const frame = owner[method]();
        const context = `${contentKind} ${method} at ${width}vp`;
        assert.ok(Number.isFinite(frame.width) && frame.width >= 0, context);
        assert.ok(frame.left + frame.width <= width && frame.right + frame.width <= width, context);
        if (width >= safeLeft + safeRight) {
          assert.ok(frame.left >= safeLeft && frame.right >= safeRight, context);
        }
      }
    }
    owner.viewportWidth = 320;
    assert.equal(owner.liveWidth(), 320, 'real measured area wins over old window width');
    owner.viewportWidth = 0;
    owner.readerWindowMetricsRevision = -1;
    assert.equal(owner.liveWidth(), 0, 'no invented 390/352 before live metrics');
  }

  const { readerPageAreaLength } = actualReaderPageShell();
  const shelfSource = new URL('../entry/src/main/ets/features/bookshelf/ui/BookshelfPage.ets', import.meta.url);
  const Shelf = selectedProductionMethods(shelfSource, 'BookshelfPage', ['onFilterContentMeasured']);
  const shelf = Object.assign(new Shelf(), { mounted: true, filterRowVisible: false, filterNaturalHeight: 13 });
  for (const [value, expected] of [[24, 24], ['24vp', 24], ['75.5vp', 75.5], [NaN, 13], ['invalid', 13], [{}, 13], [Infinity, 13]]) {
    shelf.filterNaturalHeight = 13;
    shelf.onFilterContentMeasured(readerPageAreaLength(value));
    assert.equal(shelf.filterNaturalHeight, expected);
  }
}
