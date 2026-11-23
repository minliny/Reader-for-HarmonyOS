import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
const selected = selectContractCases({ 'spec-endpoints': {description:'Actual production popup finite endpoints',resources:[]}, 'panel-actions':{description:'Actual SDK native popup action admission, callbacks and width cache',resources:[]}, 'adaptive-lifecycle':{description:'Actual popup width/window adaptation and input lifecycle',resources:[]}, 'native-reduce-motion':{description:'Actual More anchor native popup transition consumes current and changed reduce-motion preference',resources:[]} });
async function run(id) {
const { actionMenuProbe, resolvePopupSpec } = await import('./lib/reader-action-menu-probe.mjs');
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const { readerAppColor } = await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');

const file = new URL('../entry/src/main/ets/features/reading/ui/ReaderControlPanel.ets', import.meta.url);
const source = readFileSync(file, 'utf8');
const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
const { readerReadableFontScale } = pureModuleProbe(readFileSync(new URL('../entry/src/main/ets/ui/foundation/ReaderSurfaceResolvers.ts', import.meta.url), 'utf8'), 'ReaderSurfaceResolvers.ts', {}, ['readerReadableFontScale']);
const enums = name => new Proxy({}, { get: (_, key) => `${name}.${String(key)}` });
const readerMoreSurface = resolvePopupSpec('reader-more-menu');
const { sourceSwitchTriggerFocusId } = await import('../entry/src/main/ets/features/source/presentation/SourceSwitchSurfaceLifecycle.ts');
const dependencies = {
  Placement: enums('Placement'), ArrowPointPosition: enums('ArrowPointPosition'), BlurStyle: enums('BlurStyle'),
  TransitionEffect: { IDENTITY: { animation: params => ({ kind: 'identity', animation: params }) } },
  resolvePopupSpec, readerReadableFontScale, sourceSwitchTriggerFocusId,
};
const methods = ['topBar', 'topBarBack', 'topBarActions', 'topBarInputEnabled', 'sourceActionHeight', 'currentLayout', 'currentMinimumIdentity', 'controlCallbackGuard', 'controlActionHandler', 'readerMorePopupOptions', 'moreMenuGeneration', 'readerMoreMenu', 'readerMoreActions', 'readerMoreMenuWidth',
  'currentMoreMenuOwnerScope', 'readerMoreSurfaceSpec', 'readerMoreActionEnabled', 'moreMenuWidthKey', 'setMoreMenuVisible', 'dismissMoreMenu', 'performMoreAction'];
function fixture(scheme = 'day') {
  const shared = actionMenuProbe(dependencies.resolvePopupSpec);
  const { owner } = createReaderBuilderProbe(source, methods, {...dependencies,...shared.dependencies}, shared.hooks);
  const replay=owner.replay.bind(owner);owner.replay=()=>{replay();shared.properties.flush();};
  const actions = [], measurements = [], temporary = [];
  let textScale = 1, measurementFailure = false, measurementInvalid = false;
  Object.assign(owner, {
    appScheme: scheme, bookTitle: '当前书名', chapterTitle: '当前章节', sourceLabel: () => '当前书源',
    runtimeMounted: true, inputEnabled: true, controlObscured: false, chapterRefreshEnabled: true, bookDownloadEnabled: true,
    moreMenuVisible: false, moreMenuMeasuredWidth: 0, moreMenuWidthKey: '', minimumMetricsRevision: 1, minimumKey: 'initial',
    bookDownloadActive: false, syncProgressInput() {},
    layout: { viewportWidth: 390, viewportHeight: 844, topBarWidth: 360, topBarHeight: 54, topBarVisible: true },
    controlSession: Object.freeze({ location: Object.freeze({ module: 'appearance', form: 'full' }) }),
    frame: () => ({ visibility: 1, topBar: { opacity: 1 } }), isLocalBook: () => false,
    onTemporaryLayerChange: visible => temporary.push(visible),
    onOpenBookInfo: () => actions.push('info'), onRefreshChapter: () => actions.push('refresh'),
    onDownloadBook: () => actions.push('download'), onExitReading: () => actions.push('exit'),
    onSourceSwitch: () => actions.push('source'),
    getUIContext: () => ({
      getMeasureUtils: () => ({ measureTextSize: options => {
        measurements.push(options);
        if (measurementFailure) throw new Error('native measurement unavailable');
        if (measurementInvalid) return { width: NaN };
        return { width: options.textContent.length * 15 * 3 * textScale };
      } }), px2vp: px => px / 3,
    }),
  });
  owner.topBar();
  const nodes = () => shared.nodes(owner);
  const anchor = nodes().find(node => node.accessibilityText === '更多');
  return { owner, anchor, nodes, actions, measurements, temporary, setTextScale: scale => { textScale = scale; },
    failMeasurement: value => { measurementFailure = value; }, invalidMeasurement: value => { measurementInvalid = value; } };
}

if (id === 'native-reduce-motion') {
  const f = fixture();
  for (const reduceMotion of [false, true, false]) {
    f.owner.reduceMotion = reduceMotion; f.owner.replay();
    const anchor = f.nodes().find(node => node.accessibilityText === '更多');
    assert.deepEqual(anchor.bindPopup[1].transition, reduceMotion ? { kind: 'identity', animation: { duration: 0 } } : undefined);
  }
}
if (id === 'spec-endpoints') {
 assert.deepEqual([readerMoreSurface.width,readerMoreSurface.pointerWidth,readerMoreSurface.pointerHeight,readerMoreSurface.borderRadius],[176,24,12,16]);
 assert.deepEqual([readerMoreSurface.actionHeight,readerMoreSurface.actionsHeight,readerMoreSurface.actionFontSize,readerMoreSurface.actionLineHeight],[50,150,15,22]);
 return;
}
if (id === 'panel-actions') {
for (const scheme of ['day', 'night']) {
  const t = fixture(scheme), original = t.owner.controlSession;
  assert.deepEqual([t.anchor.width, t.anchor.height], [44, 44], 'current paid More target remains the popup anchor');
  assert.equal(t.measurements.length, 0, 'closed top bar does not measure menu text');
  assert.equal(t.anchor.bindPopup[0], false);
  t.anchor.onClick(); t.owner.replay();
  const [visible, popup] = t.anchor.bindPopup;
  assert.equal(visible, true);
  assert.deepEqual([popup.placement, popup.enableArrow, popup.arrowWidth, popup.arrowHeight, popup.radius],
    ['Placement.BottomRight', true, 24, 12, 16]);
  assert.equal(popup.arrowPointPosition, 'ArrowPointPosition.CENTER');
  assert.equal(popup.width, 176, 'shared menu specification remains the baseline width while larger labels can grow');
  assert.equal(popup.backgroundBlurStyle, 'BlurStyle.NONE');
  assert.equal(popup.popupColor, readerAppColor(readerMoreSurface.surfaceBackgroundRole, scheme));
  assert.equal(popup.borderWidth, 1);
  assert.deepEqual(popup.borderLinearGradient.colors, [0, 1].map(stop =>
    [readerAppColor(readerMoreSurface.surfaceBorderRole, scheme), stop]));
  assert.equal(popup.shadow.radius, 28); assert.equal(popup.shadow.offsetY, 10);
  assert.ok(popup.autoCancel && popup.mask && popup.focusable && popup.followTransformOfTarget);
  assert.equal(popup.offset, undefined, 'native anchor/avoidance replaces manual screen coordinates');
  assert.equal(t.measurements.length, 3);
  for (const options of t.measurements) assert.deepEqual([options.fontFamily, options.fontSize, options.fontWeight],
    ['ReaderNotoSansSC', '15fp', '500']);
  t.owner.replay(); assert.equal(t.measurements.length, 3, 'ordinary publication reuses measured width');
  popup.builder(); // The actual CustomPopupOptions supplies its production generation-captured closure.
  const menuLabels = ['书籍信息', '刷新本章', '下载全部章节'];
  const rowTexts = t.nodes().filter(node => menuLabels.includes(node.create));
  assert.deepEqual(rowTexts.map(node => node.create), menuLabels);
  for (const text of rowTexts) {
    assert.deepEqual([text.fontSize, text.lineHeight, text.fontWeight], [15, 22, 500]);
    assert.equal(text.fontColor, readerAppColor('TOK_INK', scheme));
  }
  const scroll = t.nodes().find(node => node.type === 'Scroll');
  assert.equal(scroll.height, 150); assert.equal(scroll.position, undefined);
  const rows = menuLabels.map(label => t.nodes().find(node => node.accessibilityText === label));
  assert.ok(rows.every(row => row.height === 50 && row.enabled === true));
  t.owner.bookDownloadEnabled = false; t.owner.chapterRefreshEnabled = false; t.owner.replay();
  assert.deepEqual(rows.map(row => row.enabled), [true, false, false], 'retained builder observes fresh action availability');
  t.owner.bookDownloadEnabled = true; t.owner.chapterRefreshEnabled = true; t.owner.replay();
  assert.ok(rows.every(row => row.enabled === true));
  for (let index = 0; index < rows.length; index++) {
    t.owner.setMoreMenuVisible(true); t.owner.replay(); t.anchor.bindPopup[1].builder();
    const currentRow = t.nodes().findLast(row => row.accessibilityText === menuLabels[index]);
    currentRow.onClick(); currentRow.onClick();
    assert.equal(t.actions.length, index + 1, 'each click dispatches once and closes its temporary layer');
  }
  assert.deepEqual(t.actions, ['info', 'refresh', 'download']);
  assert.equal(t.owner.controlSession, original, 'More actions never rewrite expansion/module state');
  t.owner.setMoreMenuVisible(true); t.owner.replay();
  t.anchor.bindPopup[1].onStateChange({ isVisible: false });
  assert.equal(t.owner.moreMenuVisible, false); assert.equal(t.temporary.at(-1), false);
  console.log(`PASS PH87 ${scheme}: actual SDK anchored popup, three guarded actions, application colors and dismissal`);
}

const t = fixture();
t.owner.bookDownloadEnabled = false; t.anchor.onClick(); t.owner.replay(); t.anchor.bindPopup[1].builder();
const download = t.nodes().find(node => node.accessibilityText === '下载全部章节');
assert.equal(download.enabled, false); download.onClick();
assert.deepEqual(t.actions, []); assert.equal(t.owner.moreMenuVisible, true);
t.owner.chapterRefreshEnabled = false; t.owner.performMoreAction('refresh'); assert.deepEqual(t.actions, []);
t.owner.inputEnabled = false; t.owner.performMoreAction('info'); assert.deepEqual(t.actions, []);
t.owner.inputEnabled = true; t.owner.controlObscured = true; t.owner.performMoreAction('info'); assert.deepEqual(t.actions, []);
t.owner.dismissMoreMenu(); t.owner.setMoreMenuVisible(true); assert.equal(t.owner.moreMenuVisible, false);
t.owner.controlObscured = false; t.owner.frame = () => ({ visibility: 0, topBar: { opacity: 0 } });
t.owner.setMoreMenuVisible(true); assert.equal(t.owner.moreMenuVisible, false);
console.log('PASS PH87 disabled download/refresh, obscured and hidden controls cannot dispatch');


} else {
const g = fixture();
for (const [viewport, textScale, expected] of [[390, 1, 176], [840, 2, 216], [150, 2, 126]]) {
  g.owner.layout.viewportWidth = viewport; g.setTextScale(textScale);
  g.owner.setMoreMenuVisible(true); g.owner.replay();
  assert.equal(g.anchor.bindPopup[1].width, expected);
  g.owner.dismissMoreMenu(); g.owner.replay();
}
g.owner.layout.viewportHeight = 100; g.owner.readerMoreMenu();
assert.equal(g.nodes().find(node => node.type === 'Scroll').height, 64,
  'short windows retain a bounded native scroll viewport and arrow/window clearance');
assert.equal(g.measurements.length, 9, 'fresh openings remeasure font scale; no per-frame text measurement');
const Lifecycle = productionMotionMethods(file, ['onRuntimeEnabledChanged', 'dismissMoreMenu', 'setMoreMenuVisible']);
for (const [inputEnabled, controlObscured] of [[false, false], [true, true]]) {
  const layers = [], owner = Object.assign(new Lifecycle(), { moreMenuVisible: true, inputEnabled, controlObscured,
    syncProgressInput() {},
    onTemporaryLayerChange: visible => layers.push(visible) });
  owner.onRuntimeEnabledChanged(); assert.equal(owner.moreMenuVisible, false); assert.deepEqual(layers, [false]);
}
const live = fixture();
live.anchor.onClick(); live.owner.replay();
assert.equal(live.anchor.bindPopup[1].width, 176);
const initialMeasurements = live.measurements.length;
live.owner.bookDownloadActive = true; live.owner.replay();
assert.equal(live.anchor.bindPopup[1].width, 176, 'busy actual seven-character label fits the shared baseline width');
assert.equal(live.measurements.length, initialMeasurements + 3);
live.setTextScale(2); live.owner.minimumMetricsRevision += 1; live.owner.replay();
assert.equal(live.anchor.bindPopup[1].width, 246, 'already-open popup reacts to an actual font metrics publication');
live.owner.replay(); assert.equal(live.measurements.length, initialMeasurements + 6, 'unchanged motion publications reuse the width');
live.owner.layout.viewportWidth = 150; live.owner.replay();
assert.equal(live.anchor.bindPopup[1].width, 126, 'window cap is live without unnecessary text remeasurement');
live.owner.layout.viewportWidth = 390;
live.failMeasurement(true); live.owner.minimumKey = 'new-font-generation';
assert.doesNotThrow(() => live.owner.replay());
assert.equal(live.anchor.bindPopup[1].width, 176, 'unavailable platform measurement keeps the authored bounded fallback');
live.failMeasurement(false); live.invalidMeasurement(true); live.owner.minimumKey = 'invalid-font-generation'; live.owner.replay();
assert.equal(live.anchor.bindPopup[1].width, 176, 'invalid platform dimensions cannot poison native popup geometry');
live.invalidMeasurement(false); live.owner.minimumKey = 'ready-font-generation'; live.owner.replay();
assert.equal(live.anchor.bindPopup[1].width, 246, 'later valid metrics recover without replacing the opening');
const sameBookWidth = live.anchor.bindPopup[1].width;
live.owner.sourceBookId = 'successor-book'; live.owner.performMoreAction('info');
assert.deepEqual(live.actions, [], 'an old popup cannot dispatch information for a successor book');
assert.equal(live.owner.readerMoreActionEnabled('info'), false, 'current UI projects the retired opening as disabled');
live.owner.dismissMoreMenu(); live.owner.setMoreMenuVisible(true); live.owner.replay();
assert.equal(live.owner.readerMoreActionEnabled('info'), true, 'an explicit opening captures the current book');
assert.equal(live.anchor.bindPopup[1].width, sameBookWidth);
const oldPopup = live.anchor.bindPopup[1]; live.owner.dismissMoreMenu(); live.owner.setMoreMenuVisible(true);
oldPopup.onStateChange({ isVisible: false }); assert.equal(live.owner.moreMenuVisible, true, 'old popup teardown cannot dismiss a successor opening');
live.owner.runtimeMounted = false; live.owner.performMoreAction('info'); assert.deepEqual(live.actions, [], 'retired owner rejects retained actions');
console.log('PASS PH87 adaptive text/window geometry, live labels/metrics, invalid measurement fallback and popup lifecycle; native pixels/placement remain a platform gate');

}
}
for (const id of selected) { await run(id); recordContractCasePass(id); }
