import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"bounded-menu-frame": {"description": "书架更多原生面板的实际手机窗口边界", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase();
  recordContractCasePass(id);
}

async function runSelectedCase() {
  const {default: assert} = await import('node:assert/strict');
  const {createTemporaryBackLeafFixtures} = await import('./lib/temporary-back-leaf-fixture.mjs');
  const {ReaderWindowMetricsSnapshot, ReaderRectVp, ReaderInsetsVp} =
    await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
  const {readerAppColor} = await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
  const {shelfFixture} = await createTemporaryBackLeafFixtures();
  let width = 393, left = 0, right = 0;
  const metrics = () => new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, width, 844), undefined,
    new ReaderInsetsVp(left, 0, right, 0));
  const f = shelfFixture(undefined, metrics);
  const opening = f.sheet().sheet;
  for (const viewport of [[393, 0, 0], [365, 10, 9], [320, 0, 0]]) {
    [width, left, right] = viewport;
    const {options, sheet} = f.sheet();
    assert.equal(options.width, Math.min(390, width - left - right));
    assert.equal(options.height, 'fit-content');
    assert.equal(options.preferType, 'bottom');
    assert.equal(options.enableOutsideInteractive, false);
    assert.equal(sheet, opening, 'window changes keep the current native sheet content');
  }
  f.o.appThemeScheme = 'night';
  const {options} = f.sheet();
  assert.equal(options.backgroundColor, readerAppColor('TOK_SS_WINDOW_BG', 'night'));
  assert.equal(options.maskColor, readerAppColor('TOK_SS_DRAWER_SCRIM', 'night'));
  // The retired custom popover's triangle, global anchor conversion and
  // invalid-vp mutation have no corresponding path in the native Sheet.
  console.log('PASS actual bookshelf More native Sheet width, bounded content, retained identity and theme options');
}
