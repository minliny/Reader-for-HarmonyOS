import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bookshelfOperationClass as load } from './lib/bookshelf-operation-owner-probe.mjs';
import * as scope from '../entry/src/main/ets/app/ReaderProductScope.ts';
import * as metricsApi from '../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';
import { readerIsExpandedWidth } from '../entry/src/main/ets/ui/foundation/ReaderWidthClass.ts';
import { actualReaderFloatingBarMetrics } from './lib/reader-page-shell-runtime-probe.mjs';

const { readerMainTabItemHeight } = actualReaderFloatingBarMetrics();

function fixture(admitPreference = scope.effectiveReaderWideNavigationRail) {
  const metrics = metricsApi.createDefaultReaderWindowMetrics();
  const storage = new Map();
  const AppStorage = {
    get: key => storage.get(key),
    setOrCreate: (key, value) => { storage.set(key, value); },
  };
  const { MAIN_TABS } = load('app/navigation/ReaderMainTabs.ts', '({MAIN_TABS})', scope);
  const nav = load('features/shell/MainNavigationSpec.ts',
    '({mainTabRailHeight, publishReaderMainViewport, readerMainViewport, readerMainNavigationMode, readerMainRailTop})',
    { ...metricsApi, AppStorage, readerMainTabItemHeight, MAIN_TABS, readerIsExpandedWidth,
      effectiveReaderWideNavigationRail: admitPreference, ReaderWindowCoordinator: { metrics: () => metrics } });
  return { nav, metrics, storage, MAIN_TABS };
}

test('Shipping L0 keeps the paper bottom navigation when an old preference requests the wide rail', () => {
  const { nav, metrics, MAIN_TABS } = fixture();
  assert.deepEqual(MAIN_TABS.map(item => item.key), ['bookshelf', 'settings']);
  assert.equal(scope.isReaderProductSurfaceEnabled('wideNavigationRail'), false);
  metrics.systemFontScale = 2;
  for (const [width, height] of [[599, 800], [600, 800], [760, 800], [1200, 1000]]) {
    nav.publishReaderMainViewport(width, height);
    assert.equal(nav.readerMainNavigationMode(true), 'bottom');
    assert.equal(nav.readerMainNavigationMode(false), 'bottom');
  }
});

test('Under explicit rail admission, the measured viewport, insets and actual font scale determine fit', () => {
  const { nav, metrics, storage } = fixture(preferred => preferred);
  metrics.windowRect.width = 1280;
  metrics.windowRect.height = 900;
  metrics.navigationInsets.bottom = 26;
  for (const scale of [1, 1.5, 2]) {
    metrics.systemFontScale = scale;
    const railHeight = nav.mainTabRailHeight(2, scale);
    for (const [width, usableHeight, expected] of [
      [599, railHeight + 40, 'bottom'],
      [600, railHeight + 23, 'bottom'],
      [600, railHeight + 24, 'rail'],
      [760, railHeight + 24, 'rail'],
    ]) {
      nav.publishReaderMainViewport(width, usableHeight + 26);
      assert.equal(nav.readerMainNavigationMode(true), expected);
      if (expected === 'rail') assert.equal(nav.readerMainRailTop(), 12);
    }
  }
  const last = storage.get('readerMainViewportRevision');
  nav.publishReaderMainViewport(NaN, 900);
  assert.equal(storage.get('readerMainViewportRevision'), last);
  assert.equal(nav.readerMainViewport().width, 760);
});
