import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

export const CONTRACT_CASES = {
  'standard-page-generation': {
    description: 'Actual StandardPage methods and real page geometry reject stale reads/receipts across layout generations and unmount; no native rendering',
    resources: [],
  },
  'window-environment': {
    description: 'Actual readonly environment/coordinator binding shares the current snapshot; finite fake platform I/O, no window or device',
    resources: [],
  },
};

for (const id of selectContractCases(CONTRACT_CASES)) {
  if (id === 'standard-page-generation') await standardPageGeneration();
  else await windowEnvironment();
  recordContractCasePass(id);
}

async function standardPageGeneration() {
  const { default: assert } = await import('node:assert/strict');
  const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
  const { actualReaderPageLayout } = await import('./lib/reader-page-shell-runtime-probe.mjs');
  const { createDefaultReaderWindowMetrics } = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
  const { APP_HEADER_BAR_HEIGHT } = await import('../entry/src/main/ets/ui/foundation/ReaderHeaderMetrics.ts');
  const layout = actualReaderPageLayout();
  const metrics = createDefaultReaderWindowMetrics();
  metrics.windowRect.width = 393;
  metrics.windowRect.height = 852;
  metrics.ready = true;
  const Owner = selectedProductionMethods(new URL(
    '../entry/src/main/ets/ui/layout/ReaderStandardPage.ets', import.meta.url), 'ReaderStandardPage', [
    'aboutToAppear', 'aboutToDisappear', 'onLayoutInputsChanged', 'recordMeasurement',
    'headerHeight', 'footerHeight', 'refreshGeometry',
  ], { ...layout, APP_HEADER_BAR_HEIGHT, readerWindowMetrics: () => metrics,
    ReaderWindowCoordinator: { metrics: () => metrics } });
  const owner = Object.assign(new Owner(), {
    mounted: false, measurementKey: 0, geometryRevision: 0, viewportWidth: 393, viewportHeight: 852,
    variant: 'settingsHome', contentLeadingRail: 0, contentEndInset: -1,
    measurements: new layout.ReaderMeasurementStore(), geometry: new layout.ReaderPageGeometry(),
  });
  owner.aboutToAppear();
  const firstKey = owner.measurementKey;
  owner.recordMeasurement('standard:header', 93, firstKey);
  owner.recordMeasurement('standard:footer', 84, firstKey);
  assert.equal(owner.headerHeight(), 93);
  assert.equal(owner.footerHeight(), 84);
  assert.equal(owner.geometry.content.startInset, 93 + layout.READER_STANDARD_PAGE_CONTENT_GAP);

  owner.viewportWidth = 320;
  owner.viewportHeight = 700;
  owner.onLayoutInputsChanged();
  const resizedKey = owner.measurementKey;
  assert.notEqual(resizedKey, firstKey);
  assert.equal(owner.headerHeight(), APP_HEADER_BAR_HEIGHT, 'a resized layout cannot read the preceding header measurement');
  assert.equal(owner.footerHeight(), 0, 'a resized layout cannot read the preceding footer measurement');
  assert.equal(owner.geometry.content.startInset, APP_HEADER_BAR_HEIGHT + layout.READER_STANDARD_PAGE_CONTENT_GAP);
  assert.ok(owner.geometry.content.frame.width <= 320, 'actual local viewport bounds the new geometry');
  const resizedGeometry = owner.geometry;
  owner.recordMeasurement('standard:header', 500, firstKey);
  owner.recordMeasurement('standard:footer', 500, firstKey);
  assert.equal(owner.geometry, resizedGeometry, 'old native callbacks cannot publish geometry for a new layout');
  owner.recordMeasurement('standard:header', 76, resizedKey);
  owner.recordMeasurement('standard:footer', 64, resizedKey);
  assert.equal(owner.headerHeight(), 76);
  assert.equal(owner.footerHeight(), 64);
  assert.equal(owner.geometry.content.startInset, 76 + layout.READER_STANDARD_PAGE_CONTENT_GAP);

  metrics.systemFontScale = 1.5;
  metrics.revision += 1;
  owner.onLayoutInputsChanged();
  assert.equal(owner.headerHeight(), APP_HEADER_BAR_HEIGHT, 'a font/environment revision also invalidates current measurements');
  assert.equal(owner.footerHeight(), 0);
  owner.recordMeasurement('standard:header', 110, owner.measurementKey);
  owner.recordMeasurement('standard:footer', 96, owner.measurementKey);
  assert.equal(owner.headerHeight(), 110);
  assert.equal(owner.footerHeight(), 96);

  owner.contentLeadingRail = 88;
  owner.contentEndInset = 24;
  owner.onLayoutInputsChanged();
  const railKey = owner.measurementKey;
  owner.recordMeasurement('standard:footer', 160, railKey);
  assert.equal(owner.footerHeight(), 0, 'a rail cannot charge a simultaneous bottom navigation height');
  assert.equal(owner.geometry.content.endInset, 24, 'the explicit rail end budget reaches actual geometry');

  owner.contentLeadingRail = 0;
  owner.contentEndInset = -1;
  owner.onLayoutInputsChanged();
  assert.equal(owner.footerHeight(), 0, 'returning to a bottom bar cannot revive the rail generation receipt');
  const mountedKey = owner.measurementKey;
  owner.aboutToDisappear();
  const retiredGeometry = owner.geometry;
  owner.recordMeasurement('standard:header', 700, mountedKey);
  assert.equal(owner.geometry, retiredGeometry, 'unmounted callbacks are inert');
  owner.aboutToAppear();
  assert.ok(owner.measurementKey > mountedKey, 'a remount owns a fresh monotonic measurement generation');
  assert.equal(owner.headerHeight(), APP_HEADER_BAR_HEIGHT);
  assert.equal(owner.footerHeight(), 0);
  owner.recordMeasurement('standard:header', 700, mountedKey);
  assert.equal(owner.headerHeight(), APP_HEADER_BAR_HEIGHT, 'a callback from the retired mounting remains stale after remount');
  owner.recordMeasurement('standard:header', Number.NaN, owner.measurementKey);
  owner.recordMeasurement('standard:header', -1, owner.measurementKey);
  assert.equal(owner.headerHeight(), APP_HEADER_BAR_HEIGHT, 'invalid measurements never enter the current budget');
  owner.recordMeasurement('standard:header', 81, owner.measurementKey);
  assert.equal(owner.headerHeight(), 81, 'a valid current callback still converges');
}

async function windowEnvironment() {
  const { default: assert } = await import('node:assert/strict');
  const { readFileSync, readdirSync } = await import('node:fs');
  const { posix: path } = await import('node:path');
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const { readerWindowEnvironmentForProbe } = await import('./lib/reader-window-environment-probe.mjs');
  const metrics = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
  const { findReaderTheme } = await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
  const { ReaderBrightnessWriter } = await import('../entry/src/main/ets/app/ReaderBrightnessWriter.ts');
  const { ts, options } = installedEtsCompiler();
  const base = new URL('../entry/src/main/ets/', import.meta.url);
  const environment = readerWindowEnvironmentForProbe();
  assert.equal(environment.readerWindowMetrics().ready, false, 'an isolated UI has explicit unready defaults before composition');
  const emitActual = (file, dependencies) => {
    const output = ts.transpileModule(readFileSync(new URL(file, base), 'utf8'), {
      fileName: file, reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS },
    });
    assert.deepEqual(output.diagnostics, [], 'actual module SDK emit: ' + file);
    const exports = {};
    new Function('exports', 'require', output.outputText)(exports, name => {
      assert.ok(Object.hasOwn(dependencies, name), 'explicit finite platform/module dependency: ' + name);
      return dependencies[name];
    });
    return exports;
  };
  const status = emitActual('app/ReaderStatusBarMeasurement.ts', { '../ui/foundation/ReaderWindowMetrics': metrics });
  const displayInfo = { id: 1, rotation: 0, densityPixels: 2, scaledDensity: 3 };
  const windowKit = {
    Orientation: { UNSPECIFIED: 0, PORTRAIT: 1, LANDSCAPE: 2, AUTO_ROTATION_UNSPECIFIED: 3 },
    AvoidAreaType: { TYPE_SYSTEM: 0, TYPE_CUTOUT: 1, TYPE_SYSTEM_GESTURE: 2, TYPE_NAVIGATION_INDICATOR: 3, TYPE_KEYBOARD: 4 },
  };
  const { ReaderWindowCoordinator: owner } = emitActual('app/ReaderWindowCoordinator.ts', {
    '@kit.ArkUI': { display: { getDefaultDisplaySync: () => displayInfo }, window: windowKit },
    '@kit.PerformanceAnalysisKit': { hilog: { info() {}, warn() {} } },
    '@kit.BasicServicesKit': { deviceInfo: { deviceType: 'phone' } },
    './ReaderBrightnessWriter': { ReaderBrightnessWriter }, './ReaderStatusBarMeasurement': status,
    '../ui/platform/ReaderNativeAlertWindow': { ReaderNativeAlertWindow: {} },
    '../platform/ReaderDocumentPickerActivity': { ReaderDocumentPickerActivity: {} },
    '../ui/foundation/ReaderThemeRegistry': { findReaderTheme },
    '../ui/foundation/ReaderWindowMetrics': metrics,
    '../ui/foundation/ReaderWindowEnvironment': environment,
  });
  assert.equal(environment.readerWindowMetrics(), owner.metrics(), 'the actual composition binds the original owner snapshot');
  assert.throws(() => environment.bindReaderWindowMetricsSource(() => metrics.createDefaultReaderWindowMetrics()),
    /already has an owner/, 'a second source cannot steal the environment');

  const zero = { left: 0, top: 0, width: 0, height: 0 };
  let rect = { left: 0, top: 0, width: 786, height: 1704 };
  owner.mainWindow = {
    getWindowProperties: () => ({ windowRect: rect }),
    getWindowAvoidArea: type => ({ leftRect: zero, rightRect: zero, bottomRect: zero,
      topRect: type === 0 ? { left: 0, top: 0, width: rect.width, height: 80 } : zero }),
  };
  const previousStorage = globalThis.AppStorage;
  const writes = [];
  globalThis.AppStorage = { setOrCreate: (key, value) => writes.push([key, value]) };
  try {
    owner.refreshMetrics();
    const first = environment.readerWindowMetrics();
    assert.equal(first, owner.metrics());
    assert.equal(first.windowRect.width, 393);
    assert.equal(first.systemFontScale, 1.5);
    assert.equal(first.ready, true);
    assert.deepEqual(writes, [['readerWindowMetricsRevision', first.revision]], 'only the original coordinator publishes metrics revisions');
    for (let read = 0; read < 20; read++) assert.equal(environment.readerWindowMetrics(), first);
    owner.refreshMetrics();
    assert.equal(writes.length, 1, 'UI reads and unchanged platform facts publish no competing revision');
    rect = { ...rect, width: 640 };
    displayInfo.scaledDensity = 4;
    owner.refreshMetrics();
    const second = environment.readerWindowMetrics();
    assert.notEqual(second, first, 'the port does not cache an obsolete snapshot');
    assert.equal(second, owner.metrics());
    assert.equal(second.windowRect.width, 320);
    assert.equal(second.systemFontScale, 2);
    assert.equal(second.revision, first.revision + 1);
    assert.equal(writes.length, 2);
  } finally {
    owner.mainWindow = undefined;
    if (previousStorage === undefined) delete globalThis.AppStorage;
    else globalThis.AppStorage = previousStorage;
  }

  let consumers = 0;
  for (const relative of readdirSync(new URL('ui/', base), { recursive: true })) {
    if (!/\.(ets|ts)$/.test(relative)) continue;
    const file = 'ui/' + relative.replaceAll('\\', '/');
    const text = readFileSync(new URL(file, base), 'utf8');
    const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true,
      file.endsWith('.ets') ? ts.ScriptKind.ETS : ts.ScriptKind.TS, options);
    assert.deepEqual(tree.parseDiagnostics, [], 'current shared UI parses: ' + file);
    for (const statement of tree.statements) {
      if (!(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) || !statement.moduleSpecifier) continue;
      const name = statement.moduleSpecifier.text;
      if (name.startsWith('.')) {
        const target = path.normalize(path.join(path.dirname(file), name));
        assert.ok(!target.startsWith('app/'), 'shared UI cannot import/re-export an app owner: ' + file);
        if (target.endsWith('/ReaderWindowEnvironment')) {
          consumers++;
          assert.ok(!statement.getText(tree).includes('bindReaderWindowMetricsSource'), 'UI consumes the read side of the port: ' + file);
        }
      }
    }
  }
  assert.ok(consumers > 0, 'the readonly port has actual shared UI consumers');
}
