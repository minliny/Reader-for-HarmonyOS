import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  adoptReaderNavigationAppearance,
  isReaderRealtimeBlurEnabled,
  probeHarmonyCapabilities,
  resolveReaderModalScrimSpec,
  resolveReaderNavigationAppearance,
  resolveReaderSurfaceMaterial,
  shouldBlurBackdrop,
  type HarmonyCapabilityPort,
  type ReaderNavigationPreferences,
  type ReaderSurfaceMaterialRole,
} from '../../entry/src/main/ets/app/HarmonyCapabilityPolicy.ts';

const api26Port: HarmonyCapabilityPort = {
  distributionVersion: () => 260000,
  api26: () => true,
  navigation: () => true,
  material: () => 'immersive',
  grip: () => false,
  surfaceMaterial: () => true,
};
const nativePreferences: ReaderNavigationPreferences = { override: 'systemNative', renderMode: 'quality' };
const api26Capabilities = probeHarmonyCapabilities(api26Port);
const roleSpecs = [
  ['chromeBar', 'thin', false],
  ['floatingDock', 'thin', false],
  ['sessionCapsule', 'ultraThin', true],
  ['controlPanel', 'thick', false],
  ['popoverMenu', 'thick', false],
  ['modalSheet', 'ultraThick', false],
] as const satisfies ReadonlyArray<readonly [ReaderSurfaceMaterialRole, string, boolean]>;

test('API 26 immersive capability requires a successful platform probe', () => {
  assert.equal(api26Capabilities.api26, true);
  assert.equal(api26Capabilities.immersiveSurfaceMaterial, true);
  assert.equal(probeHarmonyCapabilities({ ...api26Port, surfaceMaterial: () => false }).immersiveSurfaceMaterial, false);
  assert.equal(probeHarmonyCapabilities({ ...api26Port, surfaceMaterial: undefined }).immersiveSurfaceMaterial, false);
  assert.equal(probeHarmonyCapabilities({ ...api26Port, surfaceMaterial: () => {
    throw new Error('platform probe failed');
  } }).immersiveSurfaceMaterial, false);
});

test('API 23 and rejected API 26 checks never call the immersive material probe', () => {
  let calls = 0;
  const surfaceMaterial = () => { calls += 1; return true; };
  const api23 = probeHarmonyCapabilities({ ...api26Port, distributionVersion: () => 60100, surfaceMaterial });
  assert.equal(api23.api23, true);
  assert.equal(api23.api26, false);
  assert.equal(api23.immersiveSurfaceMaterial, false);
  const rejected = probeHarmonyCapabilities({ ...api26Port, api26: () => false, surfaceMaterial });
  assert.equal(rejected.api26, false);
  assert.equal(rejected.immersiveSurfaceMaterial, false);
  assert.equal(calls, 0);
});

test('six surface roles use the requested thickness and light interaction in day and night', () => {
  for (const scheme of ['day', 'night']) {
    for (const [role, style, interactive] of roleSpecs) {
      assert.deepEqual(resolveReaderSurfaceMaterial(role, nativePreferences, api26Capabilities, scheme, scheme),
        { native: true, style, interactive, performanceMode: false }, `${role} in ${scheme}`);
    }
  }
});

test('each failed gate returns all surface roles and navigation to the unified appearance', () => {
  const unsupported = probeHarmonyCapabilities({ ...api26Port, surfaceMaterial: () => false });
  const cases = [
    [nativePreferences, unsupported, 'day', 'day'],
    [nativePreferences, { ...api26Capabilities, api26: false }, 'day', 'day'],
    [nativePreferences, api26Capabilities, 'day', 'night'],
    [nativePreferences, api26Capabilities, 'other', 'other'],
  ] as const;
  assert.equal(resolveReaderNavigationAppearance(nativePreferences, api26Capabilities, 'day', 'day'), 'immersive');
  for (const [preferences, capabilities, app, system] of cases) {
    assert.equal(resolveReaderNavigationAppearance(preferences, capabilities, app, system), 'unified');
    for (const [role] of roleSpecs) {
      const decision = resolveReaderSurfaceMaterial(role, preferences, capabilities, app, system);
      assert.equal(decision.native, false, role);
      assert.equal(decision.performanceMode, false, role);
    }
  }
  assert.equal(adoptReaderNavigationAppearance('immersive', 'unified', true), 'unified');
  assert.equal(adoptReaderNavigationAppearance('unified', 'immersive', true), 'unified');
});

test('ArkUI can paint the Reader navigation renderer without HDS immersive support', () => {
  const capabilities = probeHarmonyCapabilities({ ...api26Port, navigation: () => false });
  assert.equal(resolveReaderNavigationAppearance(nativePreferences, capabilities, 'day', 'day'), 'unified');
  assert.equal(resolveReaderSurfaceMaterial('chromeBar', nativePreferences, capabilities, 'day', 'day').native, true);
});

test('appearance and render mode form a two by two matrix for all surface roles', () => {
  for (const override of ['unset', 'systemNative'] as const) {
    for (const renderMode of ['quality', 'performance'] as const) {
      const preferences: ReaderNavigationPreferences = { override, renderMode };
      const quality = renderMode === 'quality';
      const native = override === 'systemNative' && quality;
      assert.equal(isReaderRealtimeBlurEnabled(preferences), quality);
      assert.equal(resolveReaderNavigationAppearance(preferences, api26Capabilities, 'day', 'day'), native ? 'immersive' : 'unified');
      for (const [role, style, interactive] of roleSpecs) {
        const material = resolveReaderSurfaceMaterial(role, preferences, api26Capabilities, 'day', 'day');
        assert.deepEqual(material, { native, style, interactive, performanceMode: !quality }, role);
        assert.equal(shouldBlurBackdrop(preferences, material.native), quality && !native, role);
      }
    }
  }
});

test('the modal scrim uses 15vp with day and night tint and clears blur for native or performance', () => {
  const standardScrimColor = '#5C151715';
  const solidScrim = { blurred: false, radiusVp: 0, scrimColor: standardScrimColor };
  for (const [scheme, scrimColor] of [['day', '#3D151715'], ['night', '#6B000000']]) {
    assert.deepEqual(resolveReaderModalScrimSpec(nativePreferences, scheme, standardScrimColor),
      { blurred: true, radiusVp: 15, scrimColor });
    assert.deepEqual(resolveReaderModalScrimSpec(nativePreferences, scheme, standardScrimColor, true), solidScrim);
    const performance: ReaderNavigationPreferences = { ...nativePreferences, renderMode: 'performance' };
    assert.deepEqual(resolveReaderModalScrimSpec(performance, scheme, standardScrimColor), solidScrim);
    assert.deepEqual(resolveReaderModalScrimSpec(performance, scheme, standardScrimColor, true), solidScrim);
  }
});
