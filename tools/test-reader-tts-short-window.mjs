import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { boundedSurfaceSdk, boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
const common = name => new URL(`../entry/src/main/ets/features/common/${name}`, import.meta.url);
const resolvers = pureModuleProbe(readFileSync(common('ReaderSurfaceResolvers.ts'), 'utf8'),
  'ReaderSurfaceResolvers.ts', {}, ['readerReadableFontScale', 'readerScaledControlHeight']);
const { readerActionTouchRegion } = pureModuleProbe(readFileSync(common('ReaderActionAccessibility.ets'), 'utf8'),
  'ReaderActionAccessibility.ets', {}, ['readerActionTouchRegion']);
const budgets = pureModuleProbe(readFileSync(common('ReaderSurfaceBudgets.ts'), 'utf8'),
  'ReaderSurfaceBudgets.ts', resolvers, ['readerTtsManagerFooterHeight', 'readerTtsManagerChromeHeight',
    'readerTtsManagerDesignHeight', 'readerTtsManagerScrollHeight', 'readerTtsManagerCompactThreshold']);
let systemFontScale = 1;
const ReaderWindowCoordinator = { metrics: () => ({ systemFontScale }) };
const url = new URL('../entry/src/main/ets/features/reading/ReaderTtsConfigOverlay.ets', import.meta.url);
const Overlay = productionMotionMethods(url, ['fontScale', 'managerFooterLineHeight', 'compactManager', 'managerOuterPadding', 'panelHeight'],
  { ...resolvers, ...budgets, ReaderWindowCoordinator });
const sdkScalesOnly = process.argv.includes('--case') && process.argv[process.argv.indexOf('--case') + 1] === 'sdk-scales';
if (!sdkScalesOnly) for (const scale of [1, 1.3, 1.6]) {
  systemFontScale = scale;
  const threshold = budgets.readerTtsManagerCompactThreshold(scale);
  if (scale === 1.6) assert.equal(threshold, 178);
  for (const usable of [0, 30, 44, 64, 96, 120, 140, 160, 166, 167, 172, 178, 179, 240, 844]) {
    const p = Object.assign(new Overlay(), { manager: true, modalUsableHeight: usable,
      readerWindowMetricsRevision: 0, choices: [], voicePicker: false, message: '', showManage: false,
      recoveryView: { visible: false }, listLoading: false, listLoadFailed: false, choicesContentHeight: 0 });
    assert.equal(p.fontScale(), scale, 'actual owner uses current metrics scale');
    assert.ok(p.panelHeight() >= 0);
    assert.ok(p.panelHeight() + 2 * p.managerOuterPadding() <= usable);
    assert.equal(p.compactManager(), usable <= threshold);
    if (!p.compactManager()) assert.ok(p.panelHeight() >= budgets.readerTtsManagerChromeHeight(scale),
      'fixed header/footer only when entire shared budget fits');
    else if (usable >= 44) assert.ok(p.panelHeight() >= 44, 'scroll viewport retains complete action height');
    if (usable === 844) assert.equal(budgets.readerTtsManagerScrollHeight(p.panelHeight(), scale), 440);
  }
}
systemFontScale = 1;
const source = readFileSync(url, 'utf8');
assert.match(source, /if \(this\.compactManager\(\)\) \{[\s\S]*?Scroll\(\) \{[\s\S]*?this\.configurationHeader\(\);[\s\S]*?this\.managerForm\(\);[\s\S]*?this\.managerFooter\(\);[\s\S]*?\.height\(this\.panelHeight\(\)\)/,
  'short mode scrolls header, form and footer as one document');
if (!sdkScalesOnly) {
const composition = boundedSurfaceSdk();
// Retain the real shared Actions SDK component, supplying its new pure import
// explicitly; the public SDK helper and production source stay unchanged.
const actionsSource = readFileSync(common('ReaderBoundedSurfaceActions.ets'), 'utf8');
const ActualActions = createReaderBuilderProbe(actionsSource, boundedMembers(actionsSource),
  { ...composition.deps, ...resolvers, ...budgets, ReaderWindowCoordinator, readerActionTouchRegion }, composition.hooks).Component;
const owner = composition.consumer(source, ['managerFooter'], { ReaderBoundedSurfaceActions: ActualActions });
let save = 0, cancel = 0;
Object.assign(owner, { appThemeScheme: 'day', busy: false, canSubmit: () => true,
  submit: () => save++, close: () => cancel++ });
owner.managerFooter();
const actions = composition.nodes(owner).filter(node => typeof node.onClick === 'function');
assert.equal(actions.length, 2);
for (const action of actions) { assert.equal(action.height, 44); assert.equal(action.enabled, true); action.onClick(); }
assert.equal(save, 1); assert.equal(cancel, 1);
owner.busy=true;owner.replay();composition.properties.flush();
for(const action of actions){assert.equal(action.enabled,false);action.onClick();}
assert.equal(save,1);assert.equal(cancel,1,'retained actual shared actions guard latest owner busy state');
}
for (const [scale, footerHeight, actionHeight] of [[1.3, 82, 50], [1.6, 88, 56]]) {
  systemFontScale = scale;
  const composition = boundedSurfaceSdk();
  const actionsSource = readFileSync(common('ReaderBoundedSurfaceActions.ets'), 'utf8');
  const ActualActions = createReaderBuilderProbe(actionsSource, boundedMembers(actionsSource),
    { ...composition.deps, ...resolvers, ...budgets, ReaderWindowCoordinator, readerActionTouchRegion }, composition.hooks).Component;
  const owner = composition.consumer(source, ['managerFooter'], { ReaderBoundedSurfaceActions: ActualActions });
  let save = 0, cancel = 0;
  Object.assign(owner, { appThemeScheme: 'day', busy: false, canSubmit: () => true,
    submit: () => save++, close: () => cancel++ });
  owner.managerFooter();
  const nodes = composition.nodes(owner);
  const actions = nodes.filter(node => typeof node.onClick === 'function');
  assert.equal(actions.length, 2);
  assert.ok(nodes.some(node => node.type === 'Row' && node.height === footerHeight), `actual SDK footer at scale ${scale}`);
  for (const action of actions) {
    assert.equal(action.height, actionHeight, `actual SDK physical action at scale ${scale}`);
    assert.equal(action.responseRegion.height, actionHeight, 'actual response region follows action growth');
    assert.equal(action.enabled, true); action.onClick();
  }
  assert.equal(save, 1); assert.equal(cancel, 1);
  owner.busy = true; owner.replay(); composition.properties.flush();
  for (const action of actions) { assert.equal(action.enabled, false); action.onClick(); }
  assert.equal(save, 1); assert.equal(cancel, 1, 'retained enlarged actions reject latest owner busy');
}
console.log('PASS TTS actual SDK action scales 1.3/1.6, footer 82/88, action and hit 50/56, retained busy admission');
