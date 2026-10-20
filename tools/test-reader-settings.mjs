import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

export const CONTRACT_CASES = {
  "state-migration": {
    "description": "Pure V1-V5 settings migration, independent flags and availability",
    "resources": []
  },
  "window-owner": {
    "description": "Actual current LocalReadingExperience window policy and late/foreign owner fences; fake native policy port",
    "resources": []
  },
  "preferences-durability": {
    "description": "Actual SettingsGateway cold reload, failed flush and accepted retry with map preference ports",
    "resources": []
  },
  "shared-sdk-row": {
    "description": "Current shared Quick/Full row retained callback and independent hide-status key; no obsolete standalone panel",
    "resources": []
  }
};

async function case_state_migration() {
const { default: assert } = await import('node:assert/strict');
const { readFile } = await import('node:fs/promises');
const { stripTypeScriptTypes } = await import('node:module');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const {
  copyReaderSettingsSnapshot,
  createDefaultReaderSettingsSnapshot,
  isReaderPageTurnStyleAvailable,
  isReaderScreenDirectionAvailable,
  isReaderScreenTimeoutAvailable,
  isReaderSettingsToggleAvailable,
  normalizeReaderSettingsSnapshot,
  readerPageTransitionUsesPreparedPages,
  readerPageTurnStyle,
  setReaderPageTurnStyle,
  setReaderScreenDirection,
  setReaderScreenTimeout,
  setReaderSettingsToggle,
} = await import('../entry/src/main/ets/features/reading/ReaderSettingsState.ts');
const initial = createDefaultReaderSettingsSnapshot();
assert.equal(initial.hideStatusBar, false, 'status hiding is an independent opt-in preference');
assert.deepEqual(initial, {
  version: 5,
  screenDirection: 'system',
  navigationMode: 'paged',
  pageTransition: 'slide',
  screenTimeout: 'system',
  hideStatusBar: false,
  hideNavigationBar: false,
  extendIntoCutout: false,
  justifyText: false,
  alignPageBottom: false,
  volumeKeysTurnPage: false,
  stopTtsOnScreenOff: false,
  longPressSelectText: true,
});

const normalized = normalizeReaderSettingsSnapshot({
  ...initial,
  screenDirection: 'landscape',
  navigationMode: 'paged',
  pageTransition: 'cover',
  screenTimeout: 'alwaysOn',
  hideStatusBar: false,
  hideNavigationBar: true,
  extendIntoCutout: true,
  justifyText: false,
  alignPageBottom: true,
  volumeKeysTurnPage: true,
  stopTtsOnScreenOff: true,
  longPressSelectText: false,
});
assert.equal(normalized.screenDirection, 'landscape');
assert.equal(readerPageTurnStyle(normalized), 'cover');
assert.equal(normalized.screenTimeout, 'alwaysOn');
assert.equal(normalized.hideStatusBar, false, 'status and cutout preferences remain independent');
assert.equal(normalized.hideNavigationBar, true);
assert.equal(normalized.extendIntoCutout, true);
assert.equal(normalized.volumeKeysTurnPage, true);
assert.equal(normalized.stopTtsOnScreenOff, true);
assert.equal(normalized.justifyText, false);
assert.equal(normalized.alignPageBottom, true);
assert.equal(normalized.longPressSelectText, false);

const migratedV1 = normalizeReaderSettingsSnapshot({
  version: 1,
  screenDirection: 'portrait',
  pageTurnStyle: 'scroll',
  screenTimeout: 'fiveMinutes',
  hideStatusBar: true,
  hideNavigationBar: false,
  extendIntoCutout: false,
  justifyText: true,
  alignPageBottom: true,
  volumeKeysTurnPage: true,
  stopTtsOnScreenOff: true,
  longPressSelectText: true,
});
assert.equal(migratedV1.version, 5);
assert.equal(migratedV1.navigationMode, 'continuous');
assert.equal(migratedV1.pageTransition, 'slide');
assert.equal(readerPageTurnStyle(migratedV1), 'scroll');
assert.equal(migratedV1.justifyText, false, 'Appearance remains the only justification owner');
assert.equal(migratedV1.extendIntoCutout, false, 'explicit legacy cutout false wins');

const migratedV2 = normalizeReaderSettingsSnapshot({
  version: 2,
  screenDirection: 'system',
  navigationMode: 'paged',
  pageTransition: 'slide',
  screenTimeout: 'system',
  hideStatusBar: false,
  hideNavigationBar: true,
  extendIntoCutout: false,
  justifyText: false,
  alignPageBottom: false,
  volumeKeysTurnPage: false,
  stopTtsOnScreenOff: false,
  longPressSelectText: false,
});
assert.equal(migratedV2.version, 5);
assert.equal(migratedV2.extendIntoCutout, false, 'legacy explicit cutout false is preserved');
assert.equal(migratedV2.hideNavigationBar, true, 'unrelated legacy choices must survive migration');
assert.equal(migratedV2.longPressSelectText, true,
  'legacy installs must receive the now-functional native text-selection path once');

const migratedV3 = normalizeReaderSettingsSnapshot({
  ...initial,
  version: 3,
  longPressSelectText: false,
});
assert.equal(migratedV3.version, 5);
assert.equal(migratedV3.longPressSelectText, true,
  'the old disabled-by-default V3 value must migrate to enabled once');

const oldV5 = { ...initial }; delete oldV5.hideStatusBar;
assert.equal(normalizeReaderSettingsSnapshot(oldV5).hideStatusBar, false);
assert.equal(normalizeReaderSettingsSnapshot({ ...initial, hideStatusBar: 'true' }).hideStatusBar, false);
for (const version of [3, 4, 5]) for (const hideStatusBar of [false, true]) {
  assert.equal(normalizeReaderSettingsSnapshot({ ...initial, version, hideStatusBar }).hideStatusBar, hideStatusBar);
}
const independent = { ...initial, hideStatusBar: true, hideNavigationBar: true, extendIntoCutout: false,
  mangaDirection: 'horizontal', mangaFit: 'contain', mangaBackground: 'ink', mangaPageNumbers: false };
assert.deepEqual(copyReaderSettingsSnapshot(independent), independent);
for (const changed of [setReaderPageTurnStyle(independent, 'scroll'), setReaderScreenDirection(independent, 'portrait'),
  setReaderScreenTimeout(independent, 'oneMinute'), setReaderSettingsToggle(independent, 'alignPageBottom', true)]) {
  assert.equal(changed.hideStatusBar, true);
  assert.equal(changed.hideNavigationBar, true); assert.equal(changed.extendIntoCutout, false);
  for (const key of ['mangaDirection','mangaFit','mangaBackground','mangaPageNumbers']) assert.equal(changed[key], independent[key]);
}

assert.notStrictEqual(copyReaderSettingsSnapshot(initial), initial);
const noAnimation = setReaderPageTurnStyle(initial, 'none');
assert.equal(readerPageTurnStyle(noAnimation), 'none');
assert.notStrictEqual(noAnimation, initial);
for (const style of ['cover', 'slide', 'scroll', 'none']) {
  const changed = setReaderPageTurnStyle(initial, style);
  assert.equal(readerPageTurnStyle(changed), style);
}
assert.equal(setReaderPageTurnStyle(initial, 'scroll').navigationMode, 'continuous');
assert.equal(setReaderPageTurnStyle(initial, 'cover').pageTransition, 'cover');
assert.equal(readerPageTransitionUsesPreparedPages(setReaderPageTurnStyle(initial, 'cover')), true);
assert.equal(readerPageTransitionUsesPreparedPages(setReaderPageTurnStyle(initial, 'scroll')), false);
assert.throws(() => setReaderSettingsToggle(initial, 'justifyText', true), /unavailable Reader Host/);
assert.equal(setReaderSettingsToggle(initial, 'alignPageBottom', true).alignPageBottom, true);
assert.equal(setReaderSettingsToggle(initial, 'longPressSelectText', true).longPressSelectText, true);
assert.equal(setReaderSettingsToggle(initial, 'volumeKeysTurnPage', true).volumeKeysTurnPage, true);
assert.equal(setReaderSettingsToggle(initial, 'stopTtsOnScreenOff', true).stopTtsOnScreenOff, true);
assert.equal(setReaderSettingsToggle(initial, 'hideStatusBar', true).hideStatusBar, true);
assert.equal(setReaderSettingsToggle(setReaderSettingsToggle(initial, 'hideStatusBar', true), 'hideStatusBar', false).hideStatusBar, false);
assert.equal(setReaderSettingsToggle(initial, 'hideNavigationBar', true).hideNavigationBar, true);
assert.equal(setReaderSettingsToggle(initial, 'extendIntoCutout', true).extendIntoCutout, true);
assert.equal(setReaderScreenDirection(initial, 'portrait').screenDirection, 'portrait');
assert.equal(setReaderScreenDirection(initial, 'landscape').screenDirection, 'landscape');
assert.equal(setReaderScreenTimeout(initial, 'alwaysOn').screenTimeout, 'alwaysOn');
assert.equal(setReaderScreenTimeout(initial, 'fiveMinutes').screenTimeout, 'fiveMinutes');

assert.equal(isReaderScreenDirectionAvailable('system'), true);
assert.equal(isReaderScreenDirectionAvailable('portrait'), true);
assert.equal(isReaderScreenDirectionAvailable('landscape'), true);
assert.equal(isReaderPageTurnStyleAvailable('slide'), true);
assert.equal(isReaderPageTurnStyleAvailable('none'), true);
assert.equal(isReaderPageTurnStyleAvailable('cover'), true);
assert.equal(isReaderPageTurnStyleAvailable('scroll'), true);
assert.equal(isReaderScreenTimeoutAvailable('system'), true);
assert.equal(isReaderScreenTimeoutAvailable('alwaysOn'), true);
assert.equal(isReaderScreenTimeoutAvailable('fiveMinutes'), true);
assert.equal(isReaderSettingsToggleAvailable('hideStatusBar'), true);
assert.equal(isReaderSettingsToggleAvailable('hideNavigationBar'), true);
assert.equal(isReaderSettingsToggleAvailable('extendIntoCutout'), true);
assert.equal(isReaderSettingsToggleAvailable('justifyText'), false);
assert.equal(isReaderSettingsToggleAvailable('alignPageBottom'), true);
for (const version of [1,2,3,4,5]) for (const hide of [false,true]) for (const extend of [false,true]) {
  const migrated=normalizeReaderSettingsSnapshot({...initial,version,hideStatusBar:hide,extendIntoCutout:extend});
  assert.equal(migrated.extendIntoCutout,extend);assert.equal(migrated.hideStatusBar,version>=3?hide:false);
}
for (const version of [1,2,3,4]) for (const hide of [false,true]) {
  const raw={...initial,version,hideStatusBar:hide};delete raw.extendIntoCutout;
  assert.equal(normalizeReaderSettingsSnapshot(raw).extendIntoCutout,version>=3?hide:false);
}

}

async function case_window_owner() {
const { default: assert } = await import('node:assert/strict');
const { readFile } = await import('node:fs/promises');
const { stripTypeScriptTypes } = await import('node:module');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const {
  copyReaderSettingsSnapshot,
  createDefaultReaderSettingsSnapshot,
  isReaderPageTurnStyleAvailable,
  isReaderScreenDirectionAvailable,
  isReaderScreenTimeoutAvailable,
  isReaderSettingsToggleAvailable,
  normalizeReaderSettingsSnapshot,
  readerPageTransitionUsesPreparedPages,
  readerPageTurnStyle,
  setReaderPageTurnStyle,
  setReaderScreenDirection,
  setReaderScreenTimeout,
  setReaderSettingsToggle,
} = await import('../entry/src/main/ets/features/reading/ReaderSettingsState.ts');
const initial=createDefaultReaderSettingsSnapshot(); const readingDir=new URL('../entry/src/main/ets/features/reading/',import.meta.url);
// Execute the production settings/lifecycle methods: a correct mount-time
// guard alone cannot stop settings/awake callbacks from reclaiming hidden UI.
{
  const calls = [];
  const windowFacts = new Map();
  let windowOwner = 'app';
  const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };
  const Owner = productionMotionMethods(new URL('LocalReadingExperience.ets', readingDir), [
    'applyWindowPolicyForChromeOwner', 'onWindowChromeActiveChanged', 'loadReaderSettingsSnapshot',
    'applyInitialReaderWindowPolicy', 'applyReaderWindowPolicy', 'windowPolicyFor', 'safeWindowSettingsFallback',
    'onScreenAwakeKeepScreenOnChanged', 'isMountedToken', 'isSessionActive',
  ], {
    ReaderWindowCoordinator: {
      requestAppWindowPolicy: async () => { windowOwner = 'app'; calls.push({ owner: 'app' }); },
      requestReaderWindowPolicy: async policy => { windowOwner = 'reader'; calls.push({ owner: 'reader', hideStatusBar: policy.hideStatusBar }); },
    },
    ReaderWindowPolicy: class {
      constructor(orientation, keepScreenOn, hideStatusBar, hideNavigationBar, extendIntoCutout) {
        Object.assign(this, { orientation, keepScreenOn, hideStatusBar, hideNavigationBar, extendIntoCutout });
      }
    },
    normalizeReaderSettingsSnapshot, AppStorage: { setOrCreate(key, value) { windowFacts.set(key, value); } },
  });
  function fixture(load) {
    let current = true, controls = false;
    const snapshot = { ...createDefaultReaderSettingsSnapshot(), hideStatusBar: true, extendIntoCutout: true };
    const owner = Object.assign(new Owner(), {
      isReaderIdentityCurrent: () => current, windowChromeActive: false, mounted: true, exitRequested: false,
      readerSettingsLoaded: false, readerSettingsMutationGeneration: 0, readerSettingsSnapshot: snapshot, lifecycleToken: 1,
      screenAwakeKeepScreenOn: false, ttsKeepScreenOn: false, controlsPresentedForWindow: () => controls,
      syncVolumeKeyPolicy() {}, configureReaderScreenAwakeLease() {}, applyReaderSystemEventPolicy() {},
      onControlInputBoundaryChanged() {}, applyWindowChrome() {}, readerSettingsGateway: { load },
      captureReaderSettingsAdmission: () => () => true, retryPendingReaderSettings() {},
    });
    return { owner, snapshot, current: value => { current = value; }, controls: value => { controls = value; } };
  }
  for (const outcome of ['success', 'failure']) {
    let resolve, reject;
    const pending = new Promise((a, b) => { resolve = a; reject = b; });
    const f = fixture(() => pending); calls.length = 0;
    f.owner.onWindowChromeActiveChanged();
    const loading = f.owner.loadReaderSettingsSnapshot(1);
    if (outcome === 'success') resolve(f.snapshot); else reject(new Error('controlled late settings failure'));
    await loading; await settle();
    assert.deepEqual(calls, [{ owner: 'app' }], `hidden late ${outcome} cannot write any Window policy`);
    f.owner.onScreenAwakeKeepScreenOnChanged(true); await settle();
    assert.deepEqual(calls, [{ owner: 'app' }], 'a hidden awake callback cannot write any Window policy');
  }
  const f = fixture(async () => f.snapshot); calls.length = 0;
  f.owner.windowChromeActive = true; f.owner.onWindowChromeActiveChanged(); await settle();
  f.controls(true); f.owner.applyWindowPolicyForChromeOwner(); await settle();
  f.controls(false); f.owner.applyWindowPolicyForChromeOwner(); await settle();
  f.owner.windowChromeActive = false; f.owner.onWindowChromeActiveChanged(); await settle();
  assert.deepEqual(calls, [{ owner: 'reader', hideStatusBar: true }, { owner: 'reader', hideStatusBar: false },
    { owner: 'reader', hideStatusBar: true }, { owner: 'app' }], 'active/open/close/inactive retain the correct bar policy');
  let reads = 0;
  f.owner.windowChromeActive = true;
  f.owner.controlsPresentedForWindow = () => ++reads === 1;
  calls.length = 0; f.owner.applyWindowPolicyForChromeOwner(); await settle();
  assert.equal(reads, 1, 'native policy and painted top band must share one control-session sample');
  assert.equal(f.owner.windowControlsPresented, true);
  assert.equal(windowFacts.get('readerTopInfoSuppressed'), true);
  assert.deepEqual(calls, [{ owner: 'reader', hideStatusBar: false }]);
  let resolveLate;
  const late = fixture(() => new Promise(resolve => { resolveLate = resolve; }));
  late.owner.windowChromeActive = true; calls.length = 0;
  late.owner.onWindowChromeActiveChanged();
  const lateLoad = late.owner.loadReaderSettingsSnapshot(1);
  late.owner.windowChromeActive = false; late.owner.onWindowChromeActiveChanged();
  resolveLate(late.snapshot); await lateLoad; await settle();
  assert.deepEqual(calls, [{ owner: 'reader', hideStatusBar: true }, { owner: 'app' }],
    'settings admitted before deactivation may not reclaim the window after its hidden transition');
  for (const outcome of ['success', 'failure']) {
    let resolve, reject;
    const pending = new Promise((a, b) => { resolve = a; reject = b; });
    const warm = fixture(() => pending);
    warm.owner.isReaderIdentityCurrent = undefined;
    warm.owner.onWindowChromeActiveChanged();
    const loading = warm.owner.loadReaderSettingsSnapshot(1);
    const visible = fixture(async () => createDefaultReaderSettingsSnapshot());
    visible.owner.windowChromeActive = true; visible.owner.onWindowChromeActiveChanged(); await settle();
    assert.equal(windowOwner, 'reader'); calls.length = 0;
    if (outcome === 'success') resolve(warm.snapshot); else reject(new Error('controlled warm settings failure'));
    await loading; warm.owner.onScreenAwakeKeepScreenOnChanged(true); await settle();
    assert.deepEqual(calls, [], `hidden warm ${outcome}/awake cannot replace a different visible reader with either App or Reader policy`);
    assert.equal(windowOwner, 'reader');
  }
  calls.length = 0; f.current(false);
  f.owner.onWindowChromeActiveChanged(); f.owner.onScreenAwakeKeepScreenOnChanged(true); await settle();
  assert.deepEqual(calls, [], 'an obsolete owner cannot restore app bars over the current reader');
  for (const retired of ['identity', 'unmounted']) {
    let resolve;
    const pending = new Promise(a => { resolve = a; });
    const old = fixture(() => pending); calls.length = 0;
    const loading = old.owner.loadReaderSettingsSnapshot(1);
    if (retired === 'identity') old.current(false); else old.owner.mounted = false;
    resolve(old.snapshot); await loading; await settle();
    assert.deepEqual(calls, [], `late settings from ${retired} lifecycle cannot reclaim chrome`);
  }
  const policyInputs = [['default', undefined], ['saved-v5-false', { ...initial, extendIntoCutout: false }],
    ['saved-v5-true', { ...initial, extendIntoCutout: true }]];
  for (const version of [1, 2, 3, 4]) for (const extend of [false, true]) for (const hide of [false, true]) {
    policyInputs.push([`legacy-v${version}-extend-${extend}-hide-${hide}`,
      { ...initial, version, extendIntoCutout: extend, hideStatusBar: hide }]);
  }
  for (const version of [3, 4]) {
    const raw = { ...initial, version, hideStatusBar: true }; delete raw.extendIntoCutout;
    policyInputs.push([`legacy-v${version}-missing-cutout`, raw]);
  }
  policyInputs.push(['window-fallback', new Owner().safeWindowSettingsFallback({ ...initial, extendIntoCutout: true })]);
  for (const [name, raw] of policyInputs) {
    const original = JSON.stringify(raw), snapshot = normalizeReaderSettingsSnapshot(raw);
    const active = fixture(async () => snapshot);
    active.owner.readerSettingsSnapshot = snapshot;
    active.owner.windowChromeActive = true; calls.length = 0;
    for (const controls of [false, true, false]) {
      active.controls(controls); active.owner.applyWindowPolicyForChromeOwner(); await settle();
    }
    assert.deepEqual(calls, [{ owner: 'reader', hideStatusBar: snapshot.hideStatusBar }, { owner: 'reader', hideStatusBar: false },
      { owner: 'reader', hideStatusBar: snapshot.hideStatusBar }], `${name}: only the independent hide choice may hide status while controls are closed`);
    assert.equal(active.owner.readerSettingsSnapshot.extendIntoCutout, snapshot.extendIntoCutout,
      `${name}: content cutout geometry remains the user's normalized preference`);
    assert.equal(JSON.stringify(raw), original, `${name}: status policy cannot rewrite persisted preferences`);
  }
  console.log(`reader status control lifecycle: PASS (${policyInputs.length} default/saved/legacy/fallback cases; cutout geometry preserved)`);
  console.log('reader settings window ownership lifecycle: PASS (hidden late success/failure/awake; active controls; inactive; retired)');
}

}

async function case_preferences_durability() {
const { default: assert } = await import('node:assert/strict');
const { readFile } = await import('node:fs/promises');
const { stripTypeScriptTypes } = await import('node:module');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const {
  copyReaderSettingsSnapshot,
  createDefaultReaderSettingsSnapshot,
  isReaderPageTurnStyleAvailable,
  isReaderScreenDirectionAvailable,
  isReaderScreenTimeoutAvailable,
  isReaderSettingsToggleAvailable,
  normalizeReaderSettingsSnapshot,
  readerPageTransitionUsesPreparedPages,
  readerPageTurnStyle,
  setReaderPageTurnStyle,
  setReaderScreenDirection,
  setReaderScreenTimeout,
  setReaderSettingsToggle,
} = await import('../entry/src/main/ets/features/reading/ReaderSettingsState.ts');
const initial=createDefaultReaderSettingsSnapshot(); const oldV5={...initial};delete oldV5.hideStatusBar; const independent={...initial,hideStatusBar:true,hideNavigationBar:false,extendIntoCutout:true,mangaPageNumbers:false};
const gateway=await readFile(new URL('../entry/src/main/ets/features/reading/ReaderSettingsGateway.ts',import.meta.url),'utf8');
// Execute the existing Preferences Gateway, with a fresh class/static state
// for each cold process. Only get/put/flush and Runtime ownership are seams.
function settingsStoreFixture(seed, inherited) {
  const durable = inherited ?? new Map(seed === undefined ? [] : [['snapshot', JSON.stringify(seed)]]);
  const cache = new Map(durable); let failFlush = false;
  const events = [], runtime = { getUIAbilityContext: () => ({}) };
  const preferences = { getPreferences: async () => ({
    get: async (key, fallback) => cache.get(key) ?? fallback,
    put: async (key, value) => { events.push(['put', JSON.parse(value)]); cache.set(key, value); },
    flush: async () => {
      if (failFlush) { failFlush = false; throw new Error('controlled flush failure'); }
      for (const [key, value] of cache) durable.set(key, value);
      events.push(['flush']);
    },
  }) };
  const dependencies = { copyReaderSettingsSnapshot, createDefaultReaderSettingsSnapshot, normalizeReaderSettingsSnapshot,
    preferences, ReaderRuntimeOwner: { current: () => runtime, isCurrent: owner => owner === runtime },
    ReaderThemeHost: { prepareUserChange: async () => {} } };
  const body = stripTypeScriptTypes(gateway.replace(/^import[\s\S]*?;\n/gm, '')).replace('export class ', 'class ');
  const Gateway = new Function(...Object.keys(dependencies), body + ';return ReaderSettingsGateway;')(...Object.values(dependencies));
  return { owner: new Gateway(runtime), durable, events, fail: () => { failFlush = true; } };
}
for (const seed of [undefined, oldV5, independent, { ...independent, version: 3 }, { ...independent, version: 4 }]) {
  const f = settingsStoreFixture(seed), loaded = await f.owner.load();
  assert.deepEqual(loaded, normalizeReaderSettingsSnapshot(seed));
  const enabled = setReaderSettingsToggle(loaded, 'hideStatusBar', true);
  await f.owner.update(enabled);
  const afterEnable = settingsStoreFixture(undefined, f.durable);
  assert.equal((await afterEnable.owner.load()).hideStatusBar, true);
  await afterEnable.owner.update(setReaderSettingsToggle(enabled, 'hideStatusBar', false));
  assert.equal((await settingsStoreFixture(undefined, f.durable).owner.load()).hideStatusBar, false);
  assert.deepEqual(JSON.parse(f.durable.get('snapshot')), { ...enabled, hideStatusBar: false });
}
{
  const f = settingsStoreFixture(independent); await f.owner.load();
  f.fail(); const changed = setReaderSettingsToggle(independent, 'hideStatusBar', false);
  await assert.rejects(f.owner.update(changed), /flush failure/);
  assert.equal(f.owner.current().hideStatusBar, false);
  assert.equal(f.owner.writeFacts().pendingReconciliation, true);
  assert.equal(JSON.parse(f.durable.get('snapshot')).hideStatusBar, true);
  await f.owner.retryAccepted();
  assert.equal(f.owner.writeFacts().pendingReconciliation, false);
  assert.deepEqual(JSON.parse(f.durable.get('snapshot')), changed);
}
console.log('reader status settings actual Preferences Gateway: PASS (V3/V4 preservation, old V5 default, true/false cold reload, manga retention, flush retry)');

}

async function case_shared_sdk_row() {
const { default: assert } = await import('node:assert/strict');
const { readFile } = await import('node:fs/promises');
const { stripTypeScriptTypes } = await import('node:module');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const {
  copyReaderSettingsSnapshot,
  createDefaultReaderSettingsSnapshot,
  isReaderPageTurnStyleAvailable,
  isReaderScreenDirectionAvailable,
  isReaderScreenTimeoutAvailable,
  isReaderSettingsToggleAvailable,
  normalizeReaderSettingsSnapshot,
  readerPageTransitionUsesPreparedPages,
  readerPageTurnStyle,
  setReaderPageTurnStyle,
  setReaderScreenDirection,
  setReaderScreenTimeout,
  setReaderSettingsToggle,
} = await import('../entry/src/main/ets/features/reading/ReaderSettingsState.ts');
const sharedContent=await readFile(new URL('../entry/src/main/ets/features/reading/ReaderControlSettingsContent.ets',import.meta.url),'utf8');
{
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  for (const [name, source, members] of [
    ['shared Quick/Full', sharedContent, ['toggleRow','toggleValue','toggleAccessibilityText','handleToggle']],
  ]) {
    const changes = [];
    const { owner } = createReaderBuilderProbe(source, members, { isReaderSettingsToggleAvailable });
    Object.assign(owner, { snapshot: createDefaultReaderSettingsSnapshot(), interactionEnabled: true,
      p: () => 1, child: () => ({ x: 0, y: 0, width: 308, height: 38, opacity: 1 }),
      sectionWidth: () => 308, onToggleChange: (key, value) => {
        changes.push([key, value]); owner.snapshot = setReaderSettingsToggle(owner.snapshot, key, value);
      } });
    owner.toggleRow('隐藏状态栏', 'hideStatusBar', 0);
    const row = [...owner.nodes.values()].find(node => node.accessibilityText === '隐藏状态栏，已关闭');
    assert.ok(row?.enabled, name); row.onClick(); owner.replay();
    assert.equal(row.accessibilityText, '隐藏状态栏，已开启', name); row.onClick();
    assert.deepEqual(changes, [['hideStatusBar', true], ['hideStatusBar', false]], name);
    assert.equal(owner.snapshot.hideNavigationBar, false); assert.equal(owner.snapshot.extendIntoCutout, false);
  }
}
console.log('reader status settings actual SDK Quick/Full rows: PASS (live on/off value and independent callback key)');

}

const implementations = {'state-migration':case_state_migration,'window-owner':case_window_owner,'preferences-durability':case_preferences_durability,'shared-sdk-row':case_shared_sdk_row};
for (const id of selectContractCases(CONTRACT_CASES)) {
  await implementations[id]();
  recordContractCasePass(id);
}
