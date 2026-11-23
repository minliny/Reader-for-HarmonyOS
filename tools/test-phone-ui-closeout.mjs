import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const cases = {
  'wide-admission': { description: 'Actual Settings presentation and navigation preserve old preference while denying excluded rail and late writes', resources: [] },
  'reading-chrome': { description: 'Actual SDK reading action admission/touch targets, allocated title width and authoritative opaque day/night material; no pixel claim', resources: [] },
};
for (const id of selectContractCases(cases)) {
  const { default: assert } = await import('node:assert/strict');
  const { readFileSync } = await import('node:fs');
  const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
  const read = p => readFileSync(new URL('../entry/src/main/ets/' + p, import.meta.url), 'utf8');
  const policy = await import('../entry/src/main/ets/app/ReaderProductScope.ts');
  if (id === 'wide-admission') {
    console.log('wide-admission: compile actual presentation');
    const data = new Map(), AppStorage = { get: key => data.get(key), setOrCreate: (key, value) => data.set(key, value) };
    let listener, writes = 0;
    class SettingsHost {
      constructor(publish) { this.publish = publish; }
      cacheCleanupSnapshot() { return undefined; }
      toggle() { writes++; }
    }
    class SettingsGateway {
      subscribe(changed) { listener = changed; return () => {}; }
      async load() {}
    }
    const { SettingsPresentation } = pureModuleProbe(read('features/settings/presentation/SettingsPresentation.ets'),
      'SettingsPresentation.ets', { ...policy, AppStorage, SettingsHost, SettingsGateway, Observed: type => type,
        createDefaultSettingsSnapshot: () => ({ wideNavigationRail: false }), READER_REDUCE_MOTION_STORAGE_KEY: 'reduce' }, ['SettingsPresentation']);
    for (const stored of [false, true]) {
      const owner = { getUIAbilityContext: () => ({}) }, p = new SettingsPresentation();
      p.snapshot = { wideNavigationRail: stored };
      p.mount(owner, () => {});
      assert.equal(data.get('readerWideNavigationRail'), false);
      const snapshot = { wideNavigationRail: stored, reduceMotion: false, developerMode: false };
      listener(snapshot);
      assert.equal(p.snapshot.wideNavigationRail, stored, 'startup preference remains intact');
      p.opening = { isRouteCurrent: () => true };
      p.settingsHost().publish(snapshot);
      assert.equal(data.get('readerWideNavigationRail'), false, 'effective flag stays denied');
      p.isCurrent = () => true;
      p.toggle('current', 'wideNavigationRail', !stored);
      assert.equal(writes, stored ? 1 : 0, 'excluded action never reaches IO owner');
      p.toggle('current', 'reduceMotion', true);
      assert.equal(writes, stored ? 2 : 1, 'other settings retain their owner');
      assert.equal(snapshot.wideNavigationRail, stored);
    }
    console.log('wide-admission: compile actual navigation');
    const metrics = { windowRect: { width: 1000, height: 1000 }, systemFontScale: 1 };
    const navigationDependencies = {
      ...policy, AppStorage, ReaderWindowCoordinator: { metrics: () => metrics },
      readerMainTabItemHeight: () => 44, MAIN_TABS: [{ key: 'bookshelf' }, { key: 'settings' }],
      readerInteractiveSafeBottom: () => 0, readerInteractiveSafeLeft: () => 0, readerVisualSafeTop: () => 0,
      READER_EXPANDED_MIN_WIDTH: 600,
    };
    // Keep the production re-export of MAIN_TABS. A CommonJS compiler seam
    // resolves the real module boundary without rewriting its exports.
    const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
    const { ts } = installedEtsCompiler();
    const emitted = ts.transpileModule(read('features/shell/MainNavigationSpec.ts'), {
      fileName: 'MainNavigationSpec.ts', reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    });
    assert.deepEqual(emitted.diagnostics, []);
    const module = { exports: {} };
    const imports = new Set(['../../ui/layout/ReaderFloatingBarMetrics', '../../app/ReaderWindowCoordinator',
      '../../app/ReaderProductScope', '../../app/navigation/ReaderMainTabs', '../../ui/foundation/ReaderWindowMetrics',
      '../../ui/foundation/ReaderWidthClass']);
    new Function('require', 'module', 'exports', 'AppStorage', emitted.outputText)(name => {
      assert.ok(imports.has(name), 'explicit navigation dependency: ' + name); return navigationDependencies;
    }, module, module.exports, AppStorage);
    const nav = module.exports;
    nav.publishReaderMainViewport(1000, 1000);
    assert.equal(nav.mainNavigationMode(true, 1000, 1000, 0, 0, 2), 'rail', 'geometry alone could admit rail');
    assert.equal(nav.readerMainNavigationMode(true), 'bottom', 'production entry applies product admission even for raw true');
    assert.equal(policy.effectiveReaderWideNavigationRail(true), false);
  } else {
    const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
    const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
    const { readerAppColor } = await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
    const panel = read('features/reading/ui/ReaderControlPanel.ets');
    for (const scheme of ['day', 'night']) for (const local of [false, true]) {
      let invoked = 0;
      const { owner } = createReaderBuilderProbe(panel, ['topBarActions'], {
        ...readerTypographyRoles, readerAppColor, sourceSwitchTriggerFocusId: () => 'source-switch-current',
      });
      Object.assign(owner, { appScheme: scheme, isLocalBook: () => local, inputEnabled: true, controlObscured: false,
        temporaryLayerActive: false, moreMenuVisible: false, sourceId: 'source', sourceBookId: 'book',
        onSourceSwitch: () => invoked++, readerMorePopupOptions: () => ({}), setMoreMenuVisible() {} });
      owner.topBarActions();
      const nodes = [...owner.nodes.values()], action = nodes.find(n => n.accessibilityText === '换源');
      assert.ok(action); assert.equal(action.enabled, !local);
      assert.equal(action.width, 62); assert.equal(action.height, 42);
      assert.ok(action.responseRegion.width >= 44 && action.responseRegion.height >= 44);
      assert.equal(action.opacity, undefined, 'disabled ink does not fade the whole group');
      const label = nodes.find(n => n.type === 'Text' && n.create === '换源');
      assert.equal(label.fontColor, readerAppColor(local ? 'TOK_READ_UNREAD' : 'TOK_READ_INK', scheme));
      action.onClick(); assert.equal(invoked, local ? 0 : 1);
      owner.temporaryLayerActive = true; action.onClick(); assert.equal(invoked, local ? 0 : 1, 'retained callback reads current admission');
    }
    const chrome = read('ui/chrome/ReaderReadingTopBar.ets');
    const titleSource = chrome.slice(chrome.indexOf('export class ReaderReadingTopBarTitle'), chrome.indexOf('/** Reading and its directory'));
    const enums = { TextOverflow: { Ellipsis: 'ellipsis' }, TextAlign: { Start: 'start' }, FontWeight: { Bold: 'bold' } };
    const { ReaderReadingTopBarTitle } = pureModuleProbe(titleSource, 'ReaderReadingTopBarTitle.ets',
      { ...enums, ...readerTypographyRoles, readerAppColor }, ['ReaderReadingTopBarTitle']);
    const attrs = {};
    const node = new Proxy({}, { get: (_target, name) => (...args) => { attrs[name] = args[0]; return node; } });
    new ReaderReadingTopBarTitle('reading', true, 'day').applyNormalAttribute(node);
    assert.equal(attrs.width, '100%'); assert.equal(attrs.textAlign, 'start');
    assert.equal(attrs.maxLines, 1); assert.deepEqual(attrs.textOverflow, { overflow: 'ellipsis' });
    assert.equal(readerAppColor('TOK_READ_SURFACE', 'day'), '#FFFFFAF4');
    assert.equal(readerAppColor('TOK_READ_SURFACE', 'night'), '#FF302C28');
    const { ReaderPanelFrame } = pureModuleProbe(read('ui/surfaces/ReaderPanelFrame.ets'), 'ReaderPanelFrame.ets',
      { readerAppColor, TOK_BORDER_W: 1, TOK_RADIUS_XL: 24 }, ['ReaderPanelFrame']);
    for (const scheme of ['day', 'night']) for (const role of ['reader', 'reader-menu']) {
      new ReaderPanelFrame(role, scheme).applyNormalAttribute(node);
      assert.equal(attrs.backgroundColor, readerAppColor('TOK_READ_SURFACE', scheme));
      assert.match(attrs.backgroundColor, /^#FF/, 'stable outer paper is opaque, actor motion remains independent');
    }
  }
  recordContractCasePass(id);
}
