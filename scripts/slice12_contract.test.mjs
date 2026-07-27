import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function source(relativePath) {
  return readFile(resolve(root, relativePath), 'utf8');
}

test('Slice 12 onboarding and permission recovery use native local routes without inventing settings return', async () => {
  const policy = await source('entry/src/main/ets/ui/store/Slice12CapabilityPolicy.ets');
  const registry = await source('entry/src/main/ets/ui/router/ReaderCapabilityClosureRouteRegistry.ets');
  const renderer = await source('entry/src/main/ets/ui/components/ViewStateRenderer.ets');
  const components = await source('entry/src/main/ets/ui/components/Slice12LifecycleComponents.ets');
  const retiredImportRoutes = await source('entry/src/main/ets/ui/router/RetiredLocalImportRouteDisplayPolicy.ets');
  for (const route of ['onboarding-welcome', 'onboarding-capability-setup', 'permission-recovery', 'settings-accessibility']) {
    assert.ok(registry.includes(`nativeRouteDefinition('${route}'`), `native route missing: ${route}`);
  }
  for (const component of [
    'Slice12OnboardingWelcomePage', 'Slice12OnboardingCapabilityPage',
    'Slice12PermissionRecoveryPage', 'Slice12AccessibilitySettingsPage',
  ]) assert.ok(renderer.includes(component), `renderer missing ${component}`);
  assert.ok(components.includes("id: 'onboarding-capability-setup'"));
  // The confirmed Figma flow replaces the obsolete local-import full page
  // with a system picker plus in-place result dialog. Its retained route ID
  // must therefore resolve back to the bookshelf, never revive that renderer.
  assert.ok(retiredImportRoutes.includes("'local-import'"));
  assert.ok(retiredImportRoutes.includes("FALLBACK_ROUTE_ID: string = 'bookshelf'"));
  assert.ok(components.includes('不会提供无效按钮'));
  assert.match(policy, /id: 'onboarding\.first-run-persistence'[\s\S]*ContractMissingFailClosed/);
  assert.match(policy, /id: 'permission\.system-settings-return'[\s\S]*ContractMissingFailClosed/);
});

test('Slice 12 settings freeze owner, default, persistence and reset without crossing the Core boundary', async () => {
  const policy = await source('entry/src/main/ets/ui/store/Slice12CapabilityPolicy.ets');
  const preferences = await source('entry/src/main/ets/host/adapters/ReaderUiPreferenceHostAdapter.ets');
  const runtime = await source('entry/src/main/ets/bridge/CoreRuntime.ets');
  const entry = await source('entry/src/main/ets/entryability/EntryAbility.ets');
  const reducer = await source('entry/src/main/ets/ui/store/ReaderReducer.ets');
  const effects = await source('entry/src/main/ets/ui/store/ReaderEffects.ets');
  for (const id of [
    'reducedMotion', 'readerPageTurn', 'appThemeMode', 'mergeSameBooks',
    'enableSearchHistory', 'showLocalBookBadge', 'durableDomainData',
  ]) assert.ok(policy.includes(`id: '${id}'`), `setting definition missing: ${id}`);
  assert.match(policy, /id: 'reducedMotion'[\s\S]*defaultValue: 'false'[\s\S]*reader_ui_preferences_v1\/reducedMotion[\s\S]*reset: 'false'/);
  assert.match(policy, /id: 'readerPageTurn'[\s\S]*defaultValue: 'slide\/horizontal'[\s\S]*pageAnimation\+pageMode[\s\S]*scroll only = vertical/);
  assert.match(policy, /id: 'durableDomainData'[\s\S]*Reader-Core-Native[\s\S]*ContractMissingFailClosed/);
  assert.ok(preferences.includes("const KEY_REDUCED_MOTION: string = 'reducedMotion'"));
  assert.ok(preferences.includes("const KEY_PAGE_ANIMATION: string = 'pageAnimation'"));
  assert.ok(preferences.includes("const KEY_PAGE_MODE: string = 'pageMode'"));
  assert.ok(preferences.includes('savePageTurnPreference'));
  assert.ok(preferences.includes('inconsistent Reader UI preference pageAnimation/pageMode'));
  for (const forbidden of ['firstOpenPlayed', 'appThemeMode', 'coverColumns', 'bookshelf', 'searchHistory', 'bookId', 'sourceId']) {
    assert.equal(preferences.includes(forbidden), false, `UI preference store must not persist ${forbidden}`);
  }
  assert.ok(runtime.includes('getReaderUiPreferenceAdapter()'));
  assert.ok(entry.includes("type: 'hydrate-reduced-motion'"));
  assert.ok(entry.includes("type: 'hydrate-reader-page-turn-preference'"));
  assert.ok(reducer.includes("case 'hydrate-reduced-motion':"));
  assert.ok(reducer.includes("case 'hydrate-reader-page-turn-preference':"));
  assert.ok(effects.includes('preferences.saveReducedMotion(enabled)'));
  assert.ok(effects.includes('preferences.savePageTurnPreference(options.pageAnimation, options.pageMode)'));
});

test('Slice 12 viewport publishes only Phone and Tablet while fold stays explicit unverified', async () => {
  const viewport = await source('entry/src/main/ets/ui/adapters/ViewportAdapter.ets');
  const entry = await source('entry/src/main/ets/entryability/EntryAbility.ets');
  const components = await source('entry/src/main/ets/ui/components/Slice12LifecycleComponents.ets');
  assert.ok(viewport.includes("export type ViewportClass = 'phone' | 'tablet'"));
  assert.ok(viewport.includes("return safeWidth >= 700 || safeWidth > safeHeight ? 'tablet' : 'phone';"));
  assert.equal(viewport.includes("'compact-landscape'"), false);
  assert.ok(entry.includes('ViewportAdapter.classify(width, height)'));
  assert.ok(entry.includes("ViewportAdapter.K_FOLD_POSTURE, 'unverified'"));
  assert.ok(components.includes('未收到 hinge Host 事件时不会按宽度猜测折叠状态'));
  assert.match(await source('entry/src/main/ets/ui/store/Slice12CapabilityPolicy.ets'),
    /id: 'layout\.fold-posture'[\s\S]*HostBlockedFailClosed/);
});

test('MainTabShell maps the approved Tablet rail without replacing Phone tab behavior', async () => {
  const shell = await source('entry/src/main/ets/ui/shells/MainTabShell.ets');
  assert.ok(shell.includes('TABLET_NAV_WIDTH: number = 82'));
  assert.ok(shell.includes('TABLET_NAV_FOOTPRINT: number = 100'));
  assert.ok(shell.includes('if (this.usesTabletShell())'));
  assert.ok(shell.includes('this.renderTabletMainNav()'));
  assert.ok(shell.includes('if (!this.usesTabletShell())'));
  assert.ok(shell.includes('BottomNav()'));
  assert.ok(shell.includes("MotionAdapter.apply('tab.switch'"));
  assert.equal(shell.includes('.position('), false);
});

test('Slice 12 accessibility baseline labels shared controls and removes loading animation under reduced motion', async () => {
  const shared = await source('entry/src/main/ets/ui/components/SharedComponents.ets');
  const settings = await source('entry/src/main/ets/ui/components/SettingsComponents.ets');
  const selection = await source('entry/src/main/ets/ui/components/ReaderSelectionToolbar.ets');
  const components = await source('entry/src/main/ets/ui/components/Slice12LifecycleComponents.ets');
  for (const label of [".accessibilityText('搜索书籍')", ".accessibilityText('更多操作')", ".accessibilityText('返回')"]) {
    assert.ok(shared.includes(label), `shared navigation semantic missing: ${label}`);
  }
  assert.ok(shared.includes("@StorageProp('reader.reducedMotion') reducedMotion"));
  assert.ok(shared.includes("if (this.reducedMotion)"));
  assert.ok(shared.includes("Text('加载中')"));
  assert.ok(settings.includes('.accessibilityText(this.label)'));
  assert.ok(selection.includes(".accessibilityText('复制所选正文')"));
  assert.ok(selection.includes('minHeight: 44'));
  assert.ok(components.includes(".accessibilityText('减少动态效果')"));
  assert.ok(components.includes("type: 'toggle-reduced-motion', enabled: false"));
});

test('Slice 12 system integrations distinguish real business entry from adapter-only capability', async () => {
  const effects = await source('entry/src/main/ets/ui/store/ReaderEffects.ets');
  const policy = await source('entry/src/main/ets/ui/store/Slice12CapabilityPolicy.ets');
  const entry = await source('entry/src/main/ets/entryability/EntryAbility.ets');
  const clipboardStart = effects.indexOf('private static async importSourcePackageFromClipboard');
  const clipboardEnd = effects.indexOf('private static legadoBookSourceFromPackageEntry', clipboardStart);
  const clipboard = effects.slice(clipboardStart, clipboardEnd);
  const checkIndex = clipboard.indexOf('permission.check');
  const requestIndex = clipboard.indexOf('permission.request');
  const pasteIndex = clipboard.indexOf('getClipboardAdapter().paste()');
  assert.ok(checkIndex >= 0 && requestIndex > checkIndex && pasteIndex > requestIndex,
    'clipboard import must check/request permission before paste');
  assert.ok(effects.includes("getClipboardAdapter().copy({ text: selectedText })"));
  assert.ok(effects.includes("executeCoreMethod('source.export'"));
  assert.ok(effects.includes('share.invoke(request)'));
  assert.match(policy, /id: 'notification\.business-entry'[\s\S]*ContractMissingFailClosed/);
  assert.match(policy, /id: 'background\.rss-schedule'[\s\S]*ContractMissingFailClosed/);
  assert.match(policy, /id: 'background\.lifecycle-checkpoint'[\s\S]*HostReadyDeviceProofRequired/);
  assert.ok(entry.includes('onBackground(): void'));
  assert.ok(entry.includes('suspendPlaybackForBackground'));
  assert.ok(entry.includes('flushCoreStorage'));
});

test('Slice 12 evidence manifest is registration-only and contains no false passed state', async () => {
  const manifest = JSON.parse(await source('evidence/manifest.json'));
  assert.equal(manifest.manifestKind, 'template');
  assert.equal(manifest.platform, 'harmonyos');
  assert.equal(manifest.releaseIdentity, null);
  const ids = Object.keys(manifest.slices);
  assert.deepEqual(ids, Array.from({ length: 13 }, (_, index) => `slice-${index}`));
  for (const id of ids) {
    const slice = manifest.slices[id];
    assert.ok(['planned', 'in-progress', 'blocked'].includes(slice.status), `${id} has forbidden status ${slice.status}`);
    assert.deepEqual(slice.tests, []);
    assert.deepEqual(slice.evidence, []);
  }
  assert.equal(JSON.stringify(manifest).includes('"status":"passed"'), false);
  assert.ok(manifest.slices['slice-12'].blockers.some((value) => value.includes('Fold posture')));
  assert.ok(manifest.slices['slice-12'].blockers.some((value) => value.includes('release locks')));
});
