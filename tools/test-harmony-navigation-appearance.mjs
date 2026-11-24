import assert from 'node:assert/strict';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const CASES = {
  'version-and-syscap': async () => {
    const { probeHarmonyCapabilities } = await import('../entry/src/main/ets/app/HarmonyCapabilityPolicy.ts');
    const calls = [];
    const dependencies = version => ({
      distributionVersion: () => version,
      navigation: () => { calls.push('navigation'); return true; },
      material: () => { calls.push('material'); return 'immersive'; },
      api26: () => { calls.push('26'); return true; },
      grip: () => { calls.push('grip'); return true; },
    });
    const unsupported = probeHarmonyCapabilities(dependencies(60000));
    assert.equal(unsupported.nativeNavigation, false);
    assert.equal(unsupported.grip, false);
    assert.deepEqual(calls, []);
    const first = probeHarmonyCapabilities(dependencies(60100));
    assert.equal(first.api24, false);
    assert.equal(first.api26, false);
    assert.equal(first.nativeMaterial, 'adaptive');
    const next = probeHarmonyCapabilities(dependencies(60101));
    assert.equal(next.api24, true);
    assert.equal(next.api26, false);
    assert.ok(!calls.includes('26'));
    const latest = probeHarmonyCapabilities(dependencies(260000));
    assert.equal(latest.api26, true);
    assert.equal(latest.nativeMaterial, 'immersive');
    assert.equal(latest.nativeNavigation, true);
    let unavailableMaterialRead = false;
    const denied = probeHarmonyCapabilities({ ...dependencies(260000), api26: () => false, navigation: () => false,
      grip: () => { throw new Error('no sensor'); }, material: () => { unavailableMaterialRead = true; return 'adaptive'; } });
    assert.equal(denied.api26, false);
    assert.equal(denied.nativeNavigation, false);
    assert.equal(denied.nativeMaterial, 'unavailable');
    assert.equal(denied.grip, false);
    assert.equal(unavailableMaterialRead, false);
    const noMaterial = probeHarmonyCapabilities({ ...dependencies(260000), material: () => 'unavailable' });
    assert.equal(noMaterial.nativeNavigation, true);
    assert.equal(noMaterial.nativeMaterial, 'unavailable');
  },
  'platform-probe-version-admission': async () => {
    const { readFileSync } = await import('node:fs');
    const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
    const policy = await import('../entry/src/main/ets/app/HarmonyCapabilityPolicy.ts');
    const source = readFileSync(new URL('../entry/src/main/ets/app/HarmonyCapabilityProbe.ets', import.meta.url), 'utf8');
    for (const version of [60100, 60101, 260000]) {
      const calls = [];
      const { readerHarmonyApi24, readerHarmonyCapabilities } = pureModuleProbe(source, 'HarmonyCapabilityProbe.ets', {
        ...policy, deviceInfo: { distributionOSApiVersion: version, deviceType: 'phone',
          apiAvailable(api) { calls.push(api); return api === '26.0.0'; } },
        canIUse: capability => capability === 'SystemCapability.UIDesign.HDSComponent.Core',
        hdsMaterial: { getSystemMaterialTypes() { calls.push('supported-types'); return [101]; },
          MaterialType: { NONE: 0, ADAPTIVE: 100, get IMMERSIVE() {
            calls.push('immersive-member');
            if (version < 260000) throw new Error('undispatched newer member');
            return 101;
          } } },
      }, ['readerHarmonyApi24', 'readerHarmonyCapabilities']);
      assert.equal(readerHarmonyApi24(), version >= 60101);
      assert.deepEqual(calls, [], 'the low-cost text policy does not probe HDS or API26');
      const output = readerHarmonyCapabilities();
      assert.equal(output.nativeMaterial, version >= 260000 ? 'immersive' : 'adaptive');
      assert.deepEqual(calls, version >= 260000 ? ['26.0.0', 'supported-types', 'immersive-member'] : ['supported-types']);
    }
  },
  'appearance-and-interaction': async () => {
    const { probeHarmonyCapabilities, normalizeReaderNavigationPreferences, resolveReaderNavigationAppearance,
      adoptReaderNavigationAppearance } = await import('../entry/src/main/ets/app/HarmonyCapabilityPolicy.ts');
    const capabilities = probeHarmonyCapabilities({ distributionVersion: () => 260000, navigation: () => true,
      material: () => 'immersive', api26: () => true, grip: () => false });
    const fresh = normalizeReaderNavigationPreferences(undefined);
    assert.deepEqual(fresh, { override: 'unset', reduceTransparency: false });
    assert.equal(resolveReaderNavigationAppearance(fresh, capabilities, 'day', 'day'), 'unified');
    const picked = normalizeReaderNavigationPreferences({ override: 'systemNative', reduceTransparency: false });
    assert.equal(resolveReaderNavigationAppearance(picked, capabilities, 'day', 'day'), 'immersive');
    assert.equal(resolveReaderNavigationAppearance(picked, capabilities, 'night', 'day'), 'unified');
    assert.equal(resolveReaderNavigationAppearance({ ...picked, reduceTransparency: true }, capabilities, 'day', 'day'),
      'unified');
    assert.equal(picked.override, 'systemNative');
    assert.equal(resolveReaderNavigationAppearance(fresh, capabilities, 'day', 'day', 'systemNative'), 'immersive');
    assert.equal(resolveReaderNavigationAppearance({ ...fresh, override: 'unified' }, capabilities,
      'day', 'day', 'systemNative'), 'unified');
    assert.equal(adoptReaderNavigationAppearance('unified', 'immersive', true), 'unified');
    assert.equal(adoptReaderNavigationAppearance('unified', 'immersive', false), 'immersive');
  },
  'sdk-navigation-dispatch': async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
    const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
    const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
    const { root, require, options } = installedEtsCompiler();
    const hds = JSON.parse(readFileSync(resolve(root, '../../../../hms/ets/build-tools/ets-loader/components/hds_tabs.json'), 'utf8'));
    options.ets.components = [...new Set([...(options.ets.components ?? []), hds.name])];
    const map = require(`${root}/lib/component_map.js`);
    map.COMPONENT_MAP[hds.name] = hds;
    for (const field of ['INNER_COMPONENT_NAMES', 'JS_BIND_COMPONENTS', 'BUILDIN_CONTAINER_COMPONENT']) map[field].add(hds.name);
    for (const attr of hds.attrs) map.BUILDIN_STYLE_NAMES.add(attr);
    map.BUILDIN_STYLE_NAMES.add('barFloatingStyle');
    const source = readFileSync(new URL('../entry/src/main/ets/app/navigation/ReaderSystemNavigationBar.ets', import.meta.url), 'utf8');
    class BottomStyle {
      static of(icon, label) { return new BottomStyle(icon, label); }
      constructor(icon, label) { Object.assign(this, { icon, label }); }
      labelStyle(colors) { this.colors = colors; return this; }
      id(id) { this.nodeId = id; return this; }
    }
    for (const vertical of [false, true]) {
      const properties = createArkUIPropertyRuntimeProbe();
      const hosts = new Map(), tabs = new Map(), calls = [];
      let observer;
      const record = (name, state) => new Proxy({ name }, { get(target, key) {
        if (key === 'name') return target.name;
        return (...args) => {
          if (key === 'pop') return;
          if (!state.has(observer)) state.set(observer, {});
          state.get(observer)[key] = args.length === 1 ? args[0] : args;
        };
      } });
      const probe = createReaderBuilderProbe(source,
        ['scheme', 'current', 'appearance', 'surfaceWidth', 'surfaceHeight', 'vertical', 'inputEnabled', 'onSelect',
          'onCurrentTap', 'mounted', 'aboutToAppear', 'aboutToDisappear', 'build', 'tabItems',
          'bottomBar', 'rail', 'selectedIndex', 'floatingStyle', 'selectionHandler', 'currentTapHandler'],
        { ...properties.sdk, HdsTabs: record('HdsTabs', hosts), TabContent: record('TabContent', tabs),
          BottomTabBarStyle: BottomStyle,
          MAIN_TABS: [{ key: 'bookshelf', label: '书架' }, { key: 'settings', label: '设置' }],
          readerMainTabIconResource: (key, selected) => `${key}-${selected}`, readerAppColor: key => key,
          hdsMaterial: { MaterialType: { ADAPTIVE: 100, IMMERSIVE: 101 }, MaterialLevel: { ADAPTIVE: 10 } },
          BlurStyle: { COMPONENT_THICK: 13 }, BarPosition: { End: 'end', Start: 'start' }, BarMode: { Fixed: 'fixed' } },
        { ...properties.hooks, onObserverEnter(owner, id) {
          observer = id; properties.hooks.onObserverEnter(owner, id);
        }, componentName: 'ReaderSystemNavigationBar',
        initialParams: { current: 'bookshelf', appearance: 'immersive', vertical, surfaceWidth: vertical ? 82 : 196,
          surfaceHeight: vertical ? 200 : 60, onSelect: key => calls.push(['select', key]),
          onCurrentTap: key => calls.push(['repeat', key]) } });
      const { owner } = probe;
      owner.aboutToAppear();
      owner.initialRender();
      assert.equal(hosts.size, 1);
      assert.equal(tabs.size, 2);
      const host = [...hosts.values()][0];
      assert.equal(host.vertical, vertical);
      assert.equal(host.barPosition, vertical ? 'start' : 'end');
      if (!vertical) assert.deepEqual(host.barFloatingStyle.systemMaterialEffect, { materialType: 101, materialLevel: 10 });
      assert.deepEqual([...tabs.values()].map(tab => tab.tabBar.nodeId), ['reader-main-tab-bookshelf', 'reader-main-tab-settings']);
      const oldTap = host.onTabBarClick, oldChange = host.onContentWillChange;
      assert.equal(oldChange(0, 1), false, 'shell owns route admission and HDS cannot switch on its own');
      oldTap(1);
      oldTap(0);
      assert.deepEqual(calls, [['select', 'settings'], ['repeat', 'bookshelf']]);
      owner.updateStateVars({ current: 'settings' });
      properties.flush();
      oldTap(0); oldChange(1, 0);
      assert.equal(calls.length, 2, 'retired visual callbacks cannot navigate or repeat');
      assert.equal(oldChange(0, 1), true, 'controlled index paint can reach an older callback before replacement');
      assert.equal(host.onContentWillChange(0, 1), true, 'controlled index paint dispatches no route request');
      assert.equal(calls.length, 2);
      host.onTabBarClick(1);
      assert.deepEqual(calls.at(-1), ['repeat', 'settings']);
      owner.updateStateVars({ inputEnabled: false });
      properties.flush();
      host.onTabBarClick(1);
      assert.equal(host.onContentWillChange(1, 0), false);
      assert.equal(calls.length, 3);
      owner.aboutToDisappear();
      host.onTabBarClick(1);
      assert.equal(calls.length, 3);
    }
  },
  'renderer-handoff': async () => {
    const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
    const policy = await import('../entry/src/main/ets/app/HarmonyCapabilityPolicy.ts');
    const capabilities = policy.probeHarmonyCapabilities({ distributionVersion: () => 60100, api26: () => false,
      navigation: () => true, material: () => 'adaptive', grip: () => false });
    const pending = new Map();
    let next = 0;
    const AppearanceHost = selectedProductionMethods(
      new URL('../entry/src/main/ets/app/navigation/ReaderNavigationAppearanceHost.ets', import.meta.url),
      'ReaderNavigationAppearanceHost',
      ['aboutToAppear', 'aboutToDisappear', 'onTouchActivity', 'releaseInteraction', 'deferRefresh', 'refreshAppearance'],
      { ...policy, readerHarmonyCapabilities: () => capabilities, TouchType: { Down: 0, Up: 1, Cancel: 2 },
        setTimeout: run => { pending.set(++next, run); return next; }, clearTimeout: id => { pending.delete(id); } });
    const host = Object.assign(new AppearanceHost(), {
      preferences: { override: 'unset', reduceTransparency: false }, appScheme: 'day', systemScheme: 'day', inputEnabled: true,
      foreground: true, mounted: false, touchIds: new Set(), keyPressed: false, navigationFocused: false,
      releaseTimer: -1, shown: 'unified',
    });
    const touch = (type, ...ids) => host.onTouchActivity({ type, changedTouches: ids.map(id => ({ id })) });
    const tick = () => { for (const [id, run] of pending) { pending.delete(id); run(); } };
    host.aboutToAppear();
    touch(0, 7); touch(0, 9);
    host.preferences = { override: 'systemNative', reduceTransparency: false };
    host.refreshAppearance();
    assert.equal(host.shown, 'unified');
    touch(1, 7); tick();
    assert.equal(host.shown, 'unified', 'another active touch keeps the original renderer');
    touch(1, 9);
    assert.equal(host.shown, 'unified', 'the old click actor survives Up processing');
    tick();
    assert.equal(host.shown, 'adaptive');
    touch(0, 5);
    host.keyPressed = true;
    host.inputEnabled = false;
    host.refreshAppearance();
    touch(0, 6);
    host.preferences = { override: 'systemNative', reduceTransparency: true };
    host.refreshAppearance();
    assert.equal(host.shown, 'adaptive');
    host.inputEnabled = true;
    host.refreshAppearance();
    assert.equal(host.shown, 'unified', 'reopening the input gate can adopt appearance without a retired Up');
    assert.equal(host.touchIds.size, 0);
    assert.equal(host.keyPressed, false);
    assert.equal(host.preferences.override, 'systemNative');
    touch(1, 9);
    host.aboutToDisappear();
    tick();
    assert.equal(pending.size, 0, 'a retired view cancels its deferred repaint');
  },
  'sdk-renderer-selection': async () => {
    const { readFileSync } = await import('node:fs');
    const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
    const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
    const policy = await import('../entry/src/main/ets/app/HarmonyCapabilityPolicy.ts');
    const source = readFileSync(new URL('../entry/src/main/ets/app/navigation/ReaderNavigationAppearanceHost.ets',
      import.meta.url), 'utf8');
    const capabilities = policy.probeHarmonyCapabilities({ distributionVersion: () => 60100, api26: () => false,
      navigation: () => true, material: () => 'adaptive', grip: () => false });
    for (const [override, reduceTransparency, expected, probeCount] of [
      ['unset', false, 'unified', 0],
      ['systemNative', true, 'unified', 0],
      ['systemNative', false, 'adaptive', 1],
    ]) {
      const properties = createArkUIPropertyRuntimeProbe();
      const mounted = [];
      const scope = {};
      let observedProbes = 0;
      const { owner } = createReaderBuilderProbe(source,
        ['preferences', 'appScheme', 'systemScheme', 'foreground', 'inputEnabled', 'unifiedContent', 'nativeContent',
          'shown', 'mounted', 'touchIds', 'keyPressed', 'navigationFocused', 'releaseTimer', 'emptyUnified', 'emptyNative',
          'aboutToAppear', 'aboutToDisappear', 'build', 'onTouchActivity', 'releaseInteraction', 'deferRefresh', 'refreshAppearance'],
        { ...properties.sdk, ...policy, Stack: new Proxy({}, { get: (_target, key) => (...args) => { scope[key] = args[0]; } }),
          readerHarmonyCapabilities: () => { observedProbes++; return capabilities; } },
        { ...properties.hooks, componentName: 'ReaderNavigationAppearanceHost',
          initialParams: { unifiedContent: () => mounted.push('unified'), nativeContent: mode => mounted.push(mode) } });
      owner.preferences = { override, reduceTransparency };
      owner.aboutToAppear();
      owner.initialRender();
      assert.deepEqual(mounted, [expected], 'SDK creates only the admitted appearance consumer');
      assert.equal(observedProbes, probeCount);
      if (override !== 'unset') continue;
      assert.equal(typeof scope.onFocus, 'function', 'both renderers share an SDK focus observation scope');
      assert.equal(scope.focusable, undefined, 'the appearance host does not introduce a focus stop');
      scope.onFocus();
      owner.preferences = { override: 'systemNative', reduceTransparency: false };
      owner.refreshAppearance();
      properties.flush();
      assert.equal(owner.shown, 'unified', 'the focused navigation stays mounted');
      scope.onBlur();
      await new Promise(resolve => setTimeout(resolve, 0));
      properties.flush();
      assert.equal(owner.shown, 'adaptive', 'navigation adopts appearance after focus leaves');
      owner.preferences = { override: 'unified', reduceTransparency: false };
      owner.refreshAppearance();
      assert.equal(owner.shown, 'unified', 'an ordinary settings change needs no programmatic focus');
    }
  },
  'local-preference-receipt': async () => {
    const { readFileSync } = await import('node:fs');
    const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
    const policy = await import('../entry/src/main/ets/app/HarmonyCapabilityPolicy.ts');
    const source = readFileSync(new URL('../entry/src/main/ets/app/ReaderNavigationAppearancePreferences.ts', import.meta.url), 'utf8');
    const { ts } = installedEtsCompiler();
    const emitted = ts.transpileModule(source, { fileName: 'ReaderNavigationAppearancePreferences.ts', reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS } });
    assert.deepEqual(emitted.diagnostics, []);
    let raw = '';
    let rejectFlush = false;
    const writes = [], opened = [], storage = new Map(), exports = {};
    const store = { async get() { return raw; },
      async put(key, value) { assert.equal(key, 'snapshot'); writes.push(JSON.parse(value)); raw = value; },
      async flush() { if (rejectFlush) throw new Error('unconfirmed'); } };
    const deps = { '@ohos.data.preferences': { default: { async getPreferences(context, name) {
      opened.push([context.filesDir, name]); return store;
    } } }, './diagnostics/ReaderPublicFixtureScope': { readerHostPreferencesName: (directory, name) => `${directory}:${name}` },
    './HarmonyCapabilityPolicy': policy };
    new Function('exports', 'require', 'AppStorage', emitted.outputText)(exports, name => deps[name],
      { setOrCreate: (key, value) => storage.set(key, value) });
    const { ReaderNavigationAppearancePreferences: preferences, NAVIGATION_APPEARANCE_STORAGE_KEY: snapshotKey,
      NAVIGATION_APPEARANCE_SAVE_PENDING_KEY: pendingKey } = exports;
    preferences.attach({ filesDir: '/isolated' });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(opened, [['/isolated', '/isolated:reader_navigation_appearance_v1']]);
    assert.equal(writes.length, 0, 'first startup does not persist a forced appearance');
    assert.deepEqual(storage.get(snapshotKey), { override: 'unset', reduceTransparency: false });
    await preferences.save({ override: 'systemNative' });
    rejectFlush = true;
    await assert.rejects(preferences.save({ reduceTransparency: true }), /unconfirmed/);
    assert.deepEqual(storage.get(snapshotKey), { override: 'systemNative', reduceTransparency: false });
    assert.equal(storage.get(pendingKey), true);
    await preferences.save({ override: 'unified' });
    assert.equal(writes.length, 2, 'pending receipt owns its exact accepted intent');
    rejectFlush = false;
    await preferences.retry();
    assert.deepEqual(writes.at(-1), { override: 'systemNative', reduceTransparency: true });
    assert.deepEqual(storage.get(snapshotKey), { override: 'systemNative', reduceTransparency: true });
    preferences.detach();
    preferences.attach({ filesDir: '/isolated' });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(storage.get(snapshotKey), { override: 'systemNative', reduceTransparency: true });
    await preferences.save({ override: 'unset' });
    assert.deepEqual(storage.get(snapshotKey), { override: 'unset', reduceTransparency: true });
    preferences.detach();
    await assert.rejects(preferences.save({ override: 'unified' }), /RETIRED/);
  },
};

const descriptions = {
  'version-and-syscap': 'Distribution gating and independent navigation, material, and grip capability outcomes.',
  'platform-probe-version-admission': 'Installed SDK-emitted platform adapter avoids API 26 access on API 23/24.',
  'appearance-and-interaction': 'Three-state local override, optional shared intent, and opaque fallback.',
  'sdk-navigation-dispatch': 'Installed SDK-emitted HDS footer/rail actions keep the routed state authoritative.',
  'renderer-handoff': 'The renderer survives active input and retires orphaned input when the gate closes.',
  'sdk-renderer-selection': 'Installed SDK lowering selects one renderer and defers handoff while the navigation is focused.',
  'local-preference-receipt': 'Fresh absence, persistence, failed-flush retry, reopen and retirement.',
};
const definitions = Object.fromEntries(Object.entries(descriptions).map(([name, description]) =>
  [name, { description, resources: [] }]));
for (const name of selectContractCases(definitions)) {
  await CASES[name]();
  recordContractCasePass(name);
}
