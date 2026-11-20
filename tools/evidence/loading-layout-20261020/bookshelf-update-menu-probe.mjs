// Only the new bookshelf update-menu behavior and actual shared menu row.
// Does not import/run historical menu/manual-update/shell test suites.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';

registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier))
      return next(specifier + '.ts', context);
    throw error;
  }
} });

const paths = [
  'entry/src/main/ets/features/bookshelf/BookshelfMoreMenu.ets',
  'entry/src/main/ets/features/bookshelf/BookshelfShell.ets',
  'entry/src/main/ets/features/common/ReaderActionMenuSurface.ets',
  'entry/src/main/ets/features/common/ReaderSurfaceSpecs.ets',
];
const sources = Object.fromEntries(paths.map(path => [path, readFileSync(new URL('../../../' + path, import.meta.url), 'utf8')]));
const sourceSha256 = Object.fromEntries(Object.entries(sources).map(([path, value]) => [path, createHash('sha256').update(value).digest('hex')]));
const receiptPath = new URL('./bookshelf-update-menu-result.json', import.meta.url);
const previous = existsSync(receiptPath) ? JSON.parse(readFileSync(receiptPath, 'utf8')) : { attempts: [] };
const passed = [];
let stage = 'imports';

async function main() {
  const [{ compileTailConsumer }, { createArkUIPropertyRuntimeProbe }, shared, { readerAppColor }, { resolveArkUIRuntime }] = await Promise.all([
    import('../../lib/foundation-tail-consumer-probe.mjs'),
    import('../../lib/arkui-property-runtime-probe.mjs'),
    import('../../lib/reader-action-menu-probe.mjs'),
    import('../../../entry/src/main/ets/features/common/ReaderThemeRegistry.ts'),
    import('../../lib/tool-environment.mjs'),
  ]);
  // The focused property helper extracts classes but omits this native SDK
  // global initializer. Execute the installed declaration verbatim so copied
  // DTO arrays do not collide on an accidental literal "undefined" key.
  const binary = readFileSync(resolveArkUIRuntime());
  const marker = binary.indexOf(Buffer.from('class SynchedPropertyOneWayPU'));
  const runtime = binary.subarray(binary.lastIndexOf(0, marker) + 1, binary.indexOf(0, marker)).toString('utf8');
  const nameInitializer = runtime.match(/^globalThis\.__OBSERVED_OBJECT_NAME\s*=\s*Symbol\([^\n]+;/m)?.[0];
  assert.ok(nameInitializer, 'installed native property runtime declares its observed-object-name symbol');
  new Function(nameInitializer)();
  const { ReaderMenuActionView, resolvePopupSpec, resolveActionSheetSpec } = shared;
  const properties = createArkUIPropertyRuntimeProbe();
  const dependencies = { ...properties.sdk, ReaderMenuActionView, resolvePopupSpec, resolveActionSheetSpec,
    registerReaderFonts() {},
  };
  const surfaceSource = sources[paths[2]];
  const surfaceMembers = ['appThemeScheme', 'foreground', 'variant', 'specId', 'scheme', 'actions', 'availableWidth',
    'viewportHeight', 'reduceMotion', 'onAction', 'mounted', 'aboutToAppear', 'aboutToDisappear',
    'build', 'menuActions', 'actionRow', 'spec', 'action', 'dividerWidth', 'effectiveScheme', 'commitAction'];
  stage = 'compile actual bounded shared menu row';
  const surface = compileTailConsumer(surfaceSource, surfaceMembers, dependencies, properties.hooks);
  dependencies.ReaderActionMenuSurface = surface.Component;
  const hooks = { ...properties.hooks, childSources: { ReaderActionMenuSurface: surfaceSource }, mountChildren: true, lifecycleChildren: true };
  const menuMembers = ['appThemeScheme', 'anchorRight', 'anchorBottom', 'reduceMotion', 'onBatchManage', 'onLocalImport',
    'onBookshelfSettings', 'onDownloadsRequested', 'onCheckUpdates', 'canCheckUpdates', 'updateRunning',
    'backgroundUpdateRunning', 'overlayWidth', 'overlayHeight', 'onDismiss', 'panelHeight', 'closeInFlight',
    'mounted', 'generation', 'closeFinish', 'surfaceSpec', 'aboutToAppear', 'aboutToDisappear',
    'onReduceMotionChanged', 'finishCollapse', 'menuContent', 'menuActions', 'performMenuAction', 'actionEnabled',
    'updatesRunning', 'actionLabel', 'actionIcon', 'menuWidth', 'menuTop', 'visiblePanelHeight', 'collapseMenu', 'commitAction'];
  stage = 'compile actual bounded BookshelfMoreMenu methods';
  const menu = compileTailConsumer(sources[paths[0]], menuMembers, dependencies, hooks);
  const shellMembers = ['canCheckUpdates', 'updateRunning', 'backgroundUpdateRunning', 'onCheckUpdatesRequested',
    'moreMenuVisible', 'moreSelectionId', 'mounted', 'dismissMoreMenu', 'moreIntentAction', 'requestCheckUpdates'];
  stage = 'compile actual bounded BookshelfShell methods';
  const shell = compileTailConsumer(sources[paths[1]], shellMembers, dependencies, properties.hooks);
  const walk = owner => [owner, ...[...owner.children.values()].flatMap(child => child.nodes ? walk(child) : [])];
  const nodes = owner => walk(owner).flatMap(child => [...child.nodes.values()]);
  const scenario = (name, run) => { stage = name; run(); passed.push(name); console.log('PASS ' + name); };

  function fixture({ manual = false, automatic = false, online = true } = {}) {
    const calls = [], animations = [];
    const shellOwner = new shell.Component(undefined, { canCheckUpdates: online,
      updateRunning: manual, backgroundUpdateRunning: automatic });
    shellOwner.mounted = true; shellOwner.moreMenuVisible = true; shellOwner.moreSelectionId = 'menu-one';
    shellOwner.onCheckUpdatesRequested = () => calls.push('update');
    const intent = shellOwner.moreIntentAction('menu-one', () => shellOwner.requestCheckUpdates());
    const owner = new menu.Component(undefined, { canCheckUpdates: online,
      updateRunning: manual, backgroundUpdateRunning: automatic, reduceMotion: true });
    owner.getUIContext = () => ({ getFont: () => ({}), animateTo(options, action) { animations.push(options); action(); } });
    owner.aboutToAppear(); owner.overlayWidth = 390; owner.overlayHeight = 700;
    owner.panelHeight = resolvePopupSpec('bookshelf-more-menu').expandedHeight;
    owner.onCheckUpdates = intent;
    owner.onDismiss = () => { calls.push('dismiss'); shellOwner.dismissMoreMenu(); };
    owner.onBatchManage = () => calls.push('batch'); owner.onLocalImport = () => calls.push('import');
    owner.onDownloadsRequested = () => calls.push('downloads'); owner.onBookshelfSettings = () => calls.push('settings');
    owner.menuContent();
    const child = [...owner.children.values()][0]; assert.ok(child instanceof surface.Component);
    const row = id => nodes(child).find(node => typeof node.onClick === 'function' &&
      node.accessibilityText === child.action(id).accessibilityLabel);
    return { owner, shellOwner, child, row, calls, animations, intent };
  }

  scenario('idle real menu click dispatches update without dismissing/collapsing the mounted popup', () => {
    const f = fixture(), height = f.owner.panelHeight, child = f.child;
    assert.equal(f.child.action('update').label, '检查更新');
    assert.equal(f.child.action('update').busy, false);
    f.row('update').onClick();
    assert.deepEqual(f.calls, ['update']); assert.deepEqual(f.animations, []);
    assert.equal(f.owner.panelHeight, height); assert.equal(f.owner.closeInFlight, false);
    assert.equal(f.shellOwner.moreMenuVisible, true); assert.equal(f.shellOwner.moreSelectionId, 'menu-one');
    assert.equal([...f.owner.children.values()][0], child);
  });

  scenario('manual/automatic busy states share fixed text and deny repeated/current or retained update callbacks', () => {
    for (const [manual, automatic] of [[true, false], [false, true], [true, true]]) {
      const f = fixture({ manual, automatic });
      const action = f.child.action('update');
      assert.equal(action.label, '检查更新中'); assert.equal(action.accessibilityLabel, '检查更新中');
      assert.equal(action.busy, true); assert.equal(action.enabled, false);
      assert.equal(f.row('update').enabled, false);
      f.row('update').onClick(); f.owner.performMenuAction('update'); f.shellOwner.requestCheckUpdates();
      assert.deepEqual(f.calls, []); assert.equal(f.shellOwner.moreMenuVisible, true);
      assert.ok(!nodes(f.child).some(node => node.type === 'Text' && /\d+\s*\/\s*\d+/.test(String(node.create))));
    }
    const retained = fixture(); const click = retained.row('update').onClick;
    retained.owner.updateRunning = true;
    click(); assert.deepEqual(retained.calls, [], 'parent rechecks live busy even before a child repaint');
    retained.shellOwner.backgroundUpdateRunning = true; retained.intent();
    assert.deepEqual(retained.calls, [], 'Shell also rechecks its original business admission');
  });

  scenario('unavailable online books and retired/closed menu identities reject old callbacks', () => {
    const offline = fixture({ online: false });
    assert.equal(offline.child.action('update').enabled, false);
    assert.equal(offline.child.action('update').accessibilityLabel, '检查更新，没有在线书籍');
    offline.row('update').onClick(); offline.owner.performMenuAction('update'); offline.shellOwner.requestCheckUpdates();
    assert.deepEqual(offline.calls, []);
    for (const retire of [f => f.owner.aboutToDisappear(), f => { f.owner.closeInFlight = true; },
      f => f.child.aboutToDisappear(), f => { f.shellOwner.mounted = false; },
      f => f.shellOwner.dismissMoreMenu(), f => { f.shellOwner.moreSelectionId = 'new-menu'; }]) {
      const f = fixture(), click = f.row('update').onClick;
      retire(f); click(); assert.deepEqual(f.calls, []);
    }
  });

  scenario('other navigation actions still dispatch once and commit the original popup collapse', () => {
    for (const id of ['batch', 'import', 'downloads', 'settings']) {
      const f = fixture(); f.row(id).onClick(); f.row(id).onClick();
      assert.deepEqual(f.calls, [id, 'dismiss']);
      assert.equal(f.owner.closeInFlight, true);
      assert.equal(f.owner.panelHeight, resolvePopupSpec('bookshelf-more-menu').collapsedHeight);
      assert.equal(f.shellOwner.moreMenuVisible, false); assert.equal(f.shellOwner.moreSelectionId, '');
    }
  });

  scenario('actual shared row swaps original icon for same-size native LoadingProgress with foreground/reduce-motion ownership', () => {
    const spec = resolvePopupSpec('bookshelf-more-menu'), geometry = [];
    for (const [busy, foreground, reduceMotion] of [[false, true, false], [true, true, false], [true, false, false], [true, true, true]]) {
      const owner = new surface.Component(undefined, { specId: 'bookshelf-more-menu', scheme: 'day', reduceMotion,
        actions: [new ReaderMenuActionView('update', busy ? '检查更新中' : '检查更新', !busy, 'original-update-icon',
          busy ? '检查更新中' : '检查更新', '', '', '', 'default', false, busy)] });
      owner.foreground = foreground; owner.aboutToAppear(); owner.actionRow('update', false);
      const all = nodes(owner), icon = all.find(node => node.type === (busy ? 'LoadingProgress' : 'Image'));
      const row = all.find(node => node.type === 'Row');
      const label = all.find(node => node.type === 'Text');
      const frame = all.find(node => typeof node.onClick === 'function');
      assert.ok(icon && row && label && frame);
      assert.equal(icon.width, spec.actionIconSize); assert.equal(icon.height, spec.actionIconSize);
      assert.equal(row.height, spec.actionHeight); assert.equal(frame.height, spec.actionHeight);
      assert.equal(row.create.space, 16); assert.equal(frame.opacity, 1);
      assert.equal(label.fontColor, readerAppColor(spec.actionTextRole, 'day'), 'busy label retains its normal readable role');
      assert.equal(all.filter(node => node.type === 'Image').length, busy ? 0 : 1);
      assert.equal(all.filter(node => node.type === 'LoadingProgress').length, busy ? 1 : 0);
      if (busy) assert.equal(icon.enableLoading, foreground && !reduceMotion);
      geometry.push([icon.width, icon.height, row.height, frame.height]);
    }
    assert.ok(geometry.every(value => JSON.stringify(value) === JSON.stringify(geometry[0])));
    const compatible = new ReaderMenuActionView('legacy', '原动作', true, 'icon');
    assert.equal(compatible.busy, false, 'old constructor callers do not opt into busy presentation');
  });
  return { surfaceMembers, menuMembers, shellMembers,
    nativePorts: 'font registration and animation completion (reduceMotion=true for collapse); foreground is a real StorageLink input',
    spec: { iconSize: resolvePopupSpec('bookshelf-more-menu').actionIconSize,
      rowHeight: resolvePopupSpec('bookshelf-more-menu').actionHeight } };
}

let outcome;
try { outcome = { result: 'PASS', exitCode: 0, ...await main(), passed }; }
catch (error) {
  outcome = { result: 'FAIL', exitCode: 1, stage, passed, error: { name: error.name, message: error.message, stack: error.stack } };
  console.error(error.stack); process.exitCode = 1;
}
const attempt = { timestamp: new Date().toISOString(), ...outcome, sourceSha256,
  probeSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),
  evidence: 'selected actual Menu/Shell production methods plus actual DTO/shared actionRow SDK lowering and native callbacks',
  notProven: 'native pixels/animation, native branch replacement, actual catalog task lifecycle, HAP/device/user acceptance' };
writeFileSync(receiptPath, JSON.stringify({ attempts: [...previous.attempts, attempt], latest: attempt }, null, 2) + '\n');
console.log(JSON.stringify(attempt));
