import { mangaDirectoryAdaptiveFields, mangaDirectoryAdaptiveMembers, mangaDirectoryAdaptiveDependencies } from './lib/manga-directory-adaptive-probe.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { mangaSurfaceSdkDependencies, mangaSurfaceBoundedControls } from './lib/manga-surface-sdk-probe.mjs';
import { boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import * as fonts from '../entry/src/main/ets/features/common/ReaderFontFamilies.ts';

const source = readFileSync(new URL('../entry/src/main/ets/features/manga/MangaReadingSurface.ets', import.meta.url), 'utf8');
const footerSource = readFileSync(new URL('../entry/src/main/ets/features/manga/MangaDirectoryCurrentFooter.ets', import.meta.url), 'utf8');
const subsetTitles = new Set(['章节目录', '阅读方式', '漫画阅读设置', '更多', '本书下载', '本话下载']);
const fields = [...mangaDirectoryAdaptiveFields, 'mounted', 'panel', 'panelOffset', 'panelScrimOpacity', 'panelPhase', 'panelGeneration',
  'panelActionGeneration', 'morePresentationGeneration', 'panelCloseTask', 'panelCloseResolve', 'reduceMotion', 'directoryQuery',
  'directoryRevision', 'directoryOpenRevision', 'chapterEnd', 'controlsVisible', 'backgroundPreference',
  'panelFontsReady', 'panelFontGeneration', 'refreshing', 'moreMenuVariant', 'brightnessOwner', 'exiting', 'zoom', 'directoryAscending', 'brightnessPercent', 'showPageNumbers', 'fitPreference', 'horizontal',
  'quickHeaderMeasured', 'quickToolsMeasured', 'quickFooterMeasured', 'windowMetricsRevision',
  'downloadActionsChapterIndex', 'downloadActions', 'downloadActionsLoading', 'downloadActionsFailure'];
const methods = [...mangaDirectoryAdaptiveMembers, 'openPanel', 'closePanel', 'invalidatePanelMotion', 'dismissPanelKeyboard', 'settlePanel',
  'preparePanelFonts', 'performPanelAction', 'beginPanelDrag', 'updatePanelDrag', 'finishPanelDrag', 'panelTravel', 'panelHeight',
  'panelWidth', 'panelContentHeight', 'windowInteractiveInsets', 'interactiveInsets', 'panelInsets', 'controlsPresentedForWindow', 'widePanel', 'persistentDirectory', 'directoryColumnWidth', 'tabletDirectory', 'panelTitle', 'panelOverlay', 'directoryPanel',
  'directoryTools', 'directoryCurrentFooter', 'directoryCurrentTitle', 'directoryCurrentIndex', 'directoryCurrentPagePosition', 'pageOrdinal', 'adjacentChapter', 'selectAdjacentChapter', 'directoryBody', 'panelContentInset', 'directoryFallback', 'modePanel', 'settingsPanel', 'morePanel', 'moreActions', 'performMoreAction', 'performMorePanelAction', 'sectionTitle', 'sheetChoice', 'fitLine', 'choiceIcon',
  'isActionPanel', 'actionPanelInsets', 'actionPanelSurface', 'actionPanelHeader', 'actionPanelBody',
  'isSheetChoiceSelected', 'paperColor', 'surfaceColor', 'inkColor', 'mutedColor', 'faintColor', 'lineColor',
  'softSurfaceColor', 'greenColor', 'accentColor', 'aboutToDisappear', 'handleBack', 'openDirectory',
  'showDetail', 'openSourceSwitch', 'selectDirectoryTarget', 'displayedBrightnessPercent', 'resetMangaPreferences',
  'onWindowChromeChanged', 'restoreAppWindowChrome', 'directoryFontScale', 'directoryToolHeight', 'directoryHeaderChrome', 'directoryInitialWidth', 'directoryQuickHeight', 'onDirectoryMetricsChanged'];
function deferred() {
  let resolve; const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function fixture(text = source, options = {}) {
  const properties = createArkUIPropertyRuntimeProbe(), events = [], frames = [], animations = [], pans = [];
  const panGesture = new Proxy({}, { get: (_target, name) => (...args) => {
    if (name === 'create') pans.push({ options: args[0] });
    else if (String(name).startsWith('onAction')) pans.at(-1)[name] = args[0];
  } });
  const shared=mangaSurfaceBoundedControls(properties, { panGesture });
  let owner;
  const uiContext = {
    getFocusController: () => ({ clearFocus: () => events.push('clear-focus') }),
    postFrameCallback: frame => frames.push(frame),
    animateTo(params, apply) {
      const before = [owner.panelOffset, owner.panelScrimOpacity];
      apply(); animations.push({ params, before, after: [owner.panelOffset, owner.panelScrimOpacity] });
    },
  };
  const dependencies = {
    ...mangaDirectoryAdaptiveDependencies, ...properties.sdk, ...mangaSurfaceSdkDependencies, ...shared.deps, ...fonts, uiContext,
    inputMethod: { getController: () => ({ hideTextInput: () => { events.push('hide-input'); return options.keyboard ?? Promise.resolve(); } }) },
    prepareMangaSheetFonts: () => { events.push(['prepare-font', 'required-static-receipts']); return options.font ?? Promise.resolve(true); },
    prepareReaderFontFamily: family => { events.push(['prepare-serif', family]); return options.serif ?? Promise.resolve(); },
    Curve: { EaseInOut: 'easeInOut' },
    curves: { interpolatingSpring: (...args) => ({ kind: 'native-interpolatingSpring', args }) },
    hilog: { warn: (...args) => events.push(['keyboard-warning', ...args]) },
    ReaderWindowCoordinator: { brightness: () => ({ release: async () => {} }), metrics: () => ({systemInsets:{left:0,top:0,right:0,bottom:0},cutoutInsets:{left:0,top:0,right:0,bottom:0},gestureInsets:{left:0,top:0,right:0,bottom:0},navigationInsets:{left:0,top:0,right:0,bottom:0},statusBarRect:{top:0,height:0}}) },
  };
  const hooks = { ...shared.hooks, allowEmptyBranchAdmission: options.allowEmptyBranchAdmission,
    childSources: { ...shared.childSources, MangaDirectoryCurrentFooter: footerSource }, mountChildren: true };
  dependencies.MangaDirectoryCurrentFooter = createReaderBuilderProbe(footerSource, boundedMembers(footerSource), dependencies, hooks).Component;
  const probe = createReaderBuilderProbe(text, [...fields, ...methods], dependencies, hooks);
  owner = probe.owner;
  const chapter = {};
  Object.assign(owner, {
    // This suite owns sheet frames, not a mounted system-window identity.
    sourceId: '', bookId: '',
    isReaderIdentityCurrent: () => false,
    retainPreparationOnDisappear: () => false,
    mounted: true, viewportWidth: 390, viewportHeight: 844, stageWidth: 390, stageHeight: 844,
    error: '', openingRetry: false, recovering: false, loginRequiredForControls: false,
    windowChromeOverlayActive: false,
    runtime: {}, title: '第5话', bookTitle: '示例漫画', offline: false, inBookshelf: true, controller: { chapter, close: async () => { events.push('controller-close'); } },
    saveVisible: () => { events.push('save'); return options.saving ?? Promise.resolve(); },
    directoryEntries: () => [],
    onBack: () => events.push('back'), onDetail: () => events.push('detail'),
    onSwitchSource: () => events.push('source'), onSelectDirectoryTarget: (...args) => events.push(['target', ...args]),
    setBackground() {}, setBrightness() {}, setPageNumbers() {}, resetMangaPreferences: async () => {},
    toggleDirection() {}, changeFit: async () => {},
  });
  const walk = owner => [owner, ...[...owner.children.values()].flatMap(child => child.nodes ? walk(child) : [])];
  return { owner, frames, animations, events, properties, pans, output: probe.output,
    nodes: () => walk(owner).flatMap(child => [...child.nodes.values()]),
    frame: () => { const next = frames.shift(); assert.ok(next, 'native next-frame boundary was requested'); next.onFrame(16); },
    enterFrames: () => { const before = animations.length; assert.equal(frames.length, 1); frames.shift().onFrame(16); assert.equal(animations.length, before, 'onFrame may precede build: admission frame cannot start animation'); assert.equal(frames.length, 1); frames.shift().onFrame(32); },
    finish: index => { assert.equal(typeof animations[index]?.params.onFinish, 'function'); animations[index].params.onFinish(); },
  };
}
function assertOpening(f, panel) {
  assert.equal(f.owner.panel, panel); assert.equal(f.owner.panelPhase, 'opening');
  assert.equal(f.owner.panelOffset, Math.round(844 * (panel === 'directory' ? .78 : panel === 'more' ? .75 : panel === 'downloads' ? .5 : .67)) + 36);
  assert.equal(f.owner.panelScrimOpacity, 0); assert.equal(f.animations.length, 0);
  f.owner.panelOverlay();
  const sheet = f.nodes().find(node => (panel==='more'||panel==='downloads'?node.type==='__Common__':node.type==='Stack'&&node.clip===true) && node.translate);
  const scrim = f.nodes().find(node => node.type === 'Column' && node.backgroundColor === '#57000000');
  assert.deepEqual(sheet.translate, { x: 0, y: f.owner.panelOffset }, 'actual SDK lowered actor starts outside the phone');
  assert.equal(scrim.opacity, 0, 'actual SDK lowered scrim starts transparent');
  const staticWeights = { 400: fonts.READER_FONT_NOTO_SANS_SC_UI_REGULAR,
    500: fonts.READER_FONT_NOTO_SANS_SC_UI_MEDIUM, 600: fonts.READER_FONT_NOTO_SANS_SC_UI_600, 700: fonts.READER_FONT_NOTO_SANS_SC_UI_BOLD, 900: fonts.READER_FONT_NOTO_SANS_SC_UI_900 };
  assert.ok(f.nodes().filter(node => node.type === 'Text').every(node =>
    node.fontFamily === staticWeights[node.fontWeight]),
  'every mounted sheet Text explicitly owns its exact baked static face without variable flags');
  assert.ok(f.nodes().filter(node => node.type === 'Text' && node.fontFamily === 'ReaderMangaSans900')
    .every(node => subsetTitles.has(node.create)), 'the subset 900 face only paints its six proven static titles');
  assert.ok(f.nodes().filter(node => node.type === 'Text').every(node => node.enableVariableFontWeight === undefined),
    'static sheet outlines do not request a variable-axis modifier');
  if (panel === 'directory') {
    const actions = f.nodes().filter(node => ['上一章节', '完整目录', '下一章节'].includes(node.accessibilityText));
    assert.equal(actions.length, 3, 'the demo quick toolbar stays reachable while the sheet is opening');
    assert.ok(actions.every(node => node.constraintSize.minHeight === 38));
    assert.ok(!f.nodes().some(node => node.type === 'TextInput'), 'quick display opens without a keyboard field');
  }
  f.enterFrames();
  assert.equal(f.animations.length, 2);
  assert.equal(f.animations[0].params.duration, 160); assert.equal(f.animations[0].params.curve, 'easeInOut');
  assert.deepEqual(f.animations[1].params.curve.args, [0, .9, 500, 43]);
  assert.equal(f.owner.panelPhase, 'opening', 'target mutation is not treated as animation completion');
  f.finish(1); assert.equal(f.owner.panelPhase, 'open');
}
async function verifyMotion(text = source) {
  for (const panel of ['directory', 'mode', 'settings', 'more']) {
    const f = fixture(text); await f.owner.openPanel(panel);
    assert.deepEqual(f.events.slice(0, 3), ['save', 'clear-focus', 'hide-input']);
    assert.ok(f.events.some(event => Array.isArray(event) && event[0] === 'prepare-font'), `${panel} waits for its required checked static font receipts`);
    assert.deepEqual(f.events.find(event => Array.isArray(event) && event[0] === 'prepare-serif'),
      ['prepare-serif', fonts.READER_FONT_NOTO_SERIF_SC_BOLD], 'the sidebar title face has its own checked receipt before panel admission');
    assertOpening(f, panel);
    const closing = f.owner.closePanel();
    assert.equal(f.owner.closePanel(), closing, 'repeated dismiss shares one completion');
    assert.equal(f.animations.length, 4);
    assert.equal(f.animations[2].params.duration, 160);
    assert.deepEqual(f.animations[3].params.curve.args, [0, 1.05, 250, 30]);
    assert.equal(f.owner.panel, panel, 'same content is retained while leaving');
    await f.owner.selectDirectoryTarget(99); assert.ok(!f.events.some(event => Array.isArray(event) && event[0] === 'target'), 'late directory selection cannot navigate during exit');
    assert.equal(f.owner.panelTitle(), { directory: '章节目录', mode: '阅读方式', settings: '漫画阅读设置', more: '更多' }[panel]);
    f.properties.flush(); f.owner.replay();
    assert.equal(f.nodes().find(node => (panel==='more'?node.type==='__Common__':node.type==='Stack'&&node.clip===true) && node.translate).enabled, false,
      'native content is blocked during the closing lifecycle');
    f.finish(3); assert.equal(await closing, true); assert.equal(f.owner.panel, '');
  }
}
async function verifyRaces(text = source) {
  const f = fixture(text); await f.owner.openPanel('directory'); f.enterFrames(); f.finish(1);
  const closing = f.owner.closePanel();
  await f.owner.openPanel('settings'); assert.equal(await closing, false);
  f.finish(3); assert.equal(f.owner.panel, 'settings', 'stale exit cannot remove the reopened sheet');
  f.enterFrames(); f.owner.aboutToDisappear(); f.finish(5);
  assert.equal(f.owner.mounted, false); assert.notEqual(f.owner.panelPhase, 'open', 'unmounted entry callback is inert');

  const keyboard = deferred(), preMount = fixture(text, { keyboard: keyboard.promise });
  const opening = preMount.owner.openPanel('directory');
  await preMount.owner.closePanel(); keyboard.resolve(); await opening;
  assert.equal(preMount.owner.panel, ''); assert.equal(preMount.frames.length, 0, 'dismiss while preparing cannot reopen');

  const font = deferred(), admission = fixture(text, { font: font.promise });
  const fontOpening = admission.owner.openPanel('directory'); await Promise.resolve(); await Promise.resolve();
  assert.equal(admission.owner.panel, '', 'search input waits for its actual static font owner receipt');
  font.resolve(true); await fontOpening; assert.equal(admission.owner.panel, 'directory');

  const saving = deferred(), nav = fixture(text, { saving: saving.promise });
  await nav.owner.openPanel('directory'); nav.enterFrames(); nav.finish(1);
  const oldNavigation = nav.owner.showDetail(); nav.finish(3);
  await nav.owner.openPanel('mode'); saving.resolve(); await oldNavigation;
  assert.ok(!nav.events.includes('detail'), 'a delayed save cannot navigate over the reopened sheet');

  const pendingFrame = fixture(text); await pendingFrame.owner.openPanel('mode');
  pendingFrame.owner.aboutToDisappear(); pendingFrame.frame();
  assert.equal(pendingFrame.animations.length, 0, 'unmount before next frame starts no native animation');
  const beforeSave = pendingFrame.events.filter(event => event === 'save').length;
  await pendingFrame.owner.showDetail();
  assert.equal(pendingFrame.events.filter(event => event === 'save').length, beforeSave, 'late action does not enter an unmounted save owner');
}
await verifyMotion(); await verifyRaces();
{
  const f = fixture(); f.owner.reduceMotion = true; f.owner.isReaderIdentityCurrent = () => true;
  Object.assign(f.owner, { refreshLoginRequiredForControls() {}, applyWindowChrome() {}, applyWindowPolicyForChromeOwner() {} });
  await f.owner.openPanel('more'); const token = f.owner.morePresentationGeneration;
  f.owner.panelOverlay();
  assert.equal(f.pans.length, 1, 'the composed shared header registers exactly one native handle recognizer');
  const pan = f.pans[0];
  assert.deepEqual(pan.options, { fingers: 1, direction: 'vertical', distance: 1 });
  pan.onActionStart(); pan.onActionUpdate({ offsetY: 20 }); pan.onActionEnd({ offsetY: 20, velocityY: 0 });
  assert.equal(f.owner.panelPhase, 'open');
  assert.notEqual(f.owner.panelGeneration, token, 'a cancelled drag advances only the motion fence');
  f.owner.performMoreAction('source', token);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.events.filter(event => event === 'source').length, 1, 'the retained More opening still accepts actions after a cancelled drag');
  await f.owner.openPanel('more'); f.owner.performMoreAction('source', token);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.events.filter(event => event === 'source').length, 1, 'a reopened More sheet rejects the old opening token');
}

async function verifyDownloadPanelTitles(text = source) {
  for (const [chapterIndex, expected] of [[undefined, '本书下载'], [0, '本话下载'], [17, '本话下载']]) {
    const f = fixture(text);
    f.owner.downloadActionsChapterIndex = chapterIndex;
    await f.owner.openPanel('downloads');
    assert.equal(f.owner.panelTitle(), expected, 'the production title distinguishes whole-book scope from chapter scope including index0');
    assertOpening(f, 'downloads');
    const heading = f.nodes().find(node => node.type === 'Text' && node.create === expected);
    assert.ok(heading, 'the actual SDK header renders the selected download scope');
    assert.deepEqual([heading.fontFamily, heading.fontWeight, heading.fontSize, heading.lineHeight],
      ['ReaderMangaSans900', 900, 18, 26], 'download titles use their checked static900 face and existing18/26 heading');
    assert.equal(heading.enableVariableFontWeight, undefined);
    const closing = f.owner.closePanel(); f.finish(3);
    assert.equal(await closing, true); assert.equal(f.owner.panel, '');
  }
}
await verifyDownloadPanelTitles();

async function verifyAllPanelFontAdmission(text = source) {
  for (const panel of ['directory', 'mode', 'settings', 'more']) {
    const font = deferred(), f = fixture(text, { font: font.promise });
    assert.ok(!f.events.some(event => Array.isArray(event) && event[0] === 'prepare-font'), 'font demand begins with a panel, not the reader image owner');
    const opening = f.owner.openPanel(panel);
    await Promise.resolve(); await Promise.resolve();
    assert.equal(f.owner.panel, '', `${panel} cannot mount before four checked static faces`);
    assert.equal(f.frames.length, 0, `${panel} font admission precedes the frame fence`);
    font.resolve(true); await opening;
    assert.equal(f.owner.panel, panel); assert.equal(f.owner.panelFontsReady, true);
    const count = f.events.filter(event => Array.isArray(event) && event[0] === 'prepare-font').length;
    await f.owner.openPanel('settings');
    assert.equal(f.events.filter(event => Array.isArray(event) && event[0] === 'prepare-font').length, count,
      'the same ready owner reuses checked receipts on later panels');
    const failed = fixture(text, { font: Promise.resolve(false) });
    const imageOwner = failed.owner.controller;
    await failed.owner.openPanel(panel);
    assert.equal(failed.owner.panel, '', 'an unavailable receipt cannot mount a sheet');
    assert.equal(failed.frames.length, 0); assert.equal(failed.owner.panelFontsReady, false);
    assert.equal(failed.owner.controller, imageOwner, 'font preparation cannot replace the image owner');
  }
  const font = deferred(), stale = fixture(text, { font: font.promise });
  const old = stale.owner.openPanel('mode');
  await Promise.resolve(); await Promise.resolve();
  const current = stale.owner.openPanel('settings');
  await Promise.resolve(); await Promise.resolve();
  font.resolve(true); await old; await current;
  assert.equal(stale.owner.panel, 'settings', 'a late shared receipt cannot reopen the old panel');
}
await verifyAllPanelFontAdmission();

async function verifySerifFontAdmission(text = source) {
  const serif = deferred(), f = fixture(text, { serif: serif.promise });
  const admission = f.owner.preparePanelFonts();
  assert.equal(f.owner.panelFontsReady, false, 'sidebar Serif title cannot inherit a Sans-only receipt');
  assert.ok(!f.events.some(event => Array.isArray(event) && event[0] === 'prepare-font'),
    'Sans admission follows the checked Serif receipt rather than racing its load');
  serif.resolve(); assert.equal(await admission, true);
  const failed = fixture(text, { serif: Promise.reject(new Error('checked Serif file unavailable')) });
  await failed.owner.openPanel('directory');
  assert.equal(failed.owner.panelFontsReady, false); assert.equal(failed.owner.panel, '');
  assert.equal(failed.frames.length, 0, 'a failed title face cannot paint a fallback frame');
}
await verifySerifFontAdmission();

async function verifyResetPreferences(text = source) {
  const f = fixture(text), operations = [];
  delete f.owner.resetMangaPreferences;
  Object.assign(f.owner, { horizontal: true, fitPreference: 'contain', backgroundPreference: 'ink', brightnessPercent: 8,
    showPageNumbers: false,
    toggleDirection() { this.horizontal = false; operations.push('vertical'); },
    changeFit: async function(fit) { this.fitPreference = fit; operations.push(['fit', fit]); },
    setBrightness: function(percent, automatic = false) { this.brightnessPercent = percent; operations.push(['brightness', percent, automatic]); },
    settingsGateway: { updateMangaPreferences: async value => operations.push(['preferences', value]) },
  });
  await f.owner.resetMangaPreferences();
  assert.equal(f.owner.backgroundPreference, 'ink', 'reset preserves the selected dark appearance');
  assert.equal(f.owner.horizontal, false); assert.equal(f.owner.fitPreference, 'width');
  assert.equal(f.owner.showPageNumbers, true); assert.equal(f.owner.brightnessPercent, 78);
  assert.ok(operations.some(value => Array.isArray(value) && value[0] === 'brightness' && value[1] === 78 && value[2] === false),
    'reset selects the demo manual brightness instead of automatic platform brightness');
  assert.deepEqual(operations.at(-1), ['preferences', { mangaDirection: 'vertical', mangaFit: 'width', mangaPageNumbers: true }]);
}
await verifyResetPreferences();

async function verifyPersistentFontAdmission(text = source) {
  const font = deferred(), f = fixture(text, { font: font.promise, allowEmptyBranchAdmission: true });
  Object.assign(f.owner, { viewportWidth: 1000, viewportHeight: 900, stageWidth: 1000, stageHeight: 900 });
  f.owner.tabletDirectory();
  assert.ok(!f.nodes().some(node => node.type === 'Text'), 'persistent catalog cannot paint an unadmitted static Text face');
  assert.ok(!f.nodes().some(node => node.type === 'TextInput'), 'persistent catalog cannot paint an unadmitted static input face');
  const admission = f.owner.preparePanelFonts();
  assert.equal(f.owner.panelFontsReady, false); font.resolve(true);
  assert.equal(await admission, true); assert.equal(f.owner.panelFontsReady, true);
  f.properties.flush();
  assert.ok(!f.nodes().some(node => node.type === 'TextInput'), 'persistent catalog has no phone search input');
  assert.ok(f.nodes().some(node => node.type === 'Text' && node.create === '示例漫画' && node.fontFamily === 'ReaderNotoSerifSCBold' && node.fontSize === 18 && node.lineHeight === 26 && node.fontWeight === 700),
    'checked receipt admits the dynamic book title with the existing Serif face');
  assert.ok(f.nodes().some(node => node.type === 'Text' && node.create === '章节目录' && node.fontFamily === 'ReaderNotoSansSCUIRegular' && node.fontSize === 10));
  const lateFont = deferred(), unmounted = fixture(text, { font: lateFont.promise });
  const lateAdmission = unmounted.owner.preparePanelFonts();
  unmounted.owner.aboutToDisappear(); lateFont.resolve(true); await lateAdmission;
  assert.equal(unmounted.owner.panelFontsReady, false, 'late font receipt cannot change an unmounted owner');
}
await verifyPersistentFontAdmission();

async function verifyReachableWideDirectory(text=source) {
  const f=fixture(text);Object.assign(f.owner,{stageWidth:920,stageHeight:900,viewportWidth:662,viewportHeight:900});
  await f.owner.openPanel('directory');
  assert.equal(f.owner.panel,'directory','real tablet directory action opens the right panel');
  assert.equal(f.owner.panelPhase,'opening');assert.equal(f.owner.panelOffset,376);
  f.owner.tabletDirectory();f.owner.panelOverlay();
  const catalog=[...f.owner.children.values()].find(child=>child.params.mangaCatalogDisplay===true);
  assert.ok(catalog);assert.equal(catalog.params.interactionEnabled,false,'entering right panel temporarily blocks the left catalog');
  f.enterFrames();f.finish(1);
  f.properties.flush();assert.equal(catalog.params.interactionEnabled,true,'stable right panel preserves catalog interaction');
  const proof={canonicalIndex:8},selection=f.owner.selectDirectoryTarget(8,proof);
  assert.equal(f.owner.panelPhase,'closing');f.finish(3);await selection;
  assert.deepEqual(f.events.filter(event=>Array.isArray(event)&&event[0]==='target'),[['target',8,proof]],
    'right directory preserves the canonical target/proof through retained close');
  await f.owner.selectDirectoryTarget(9,proof,true);
  assert.equal(f.events.filter(event=>Array.isArray(event)&&event[0]==='target').length,2,'closed persistent catalog remains selectable');
  await f.owner.openPanel('mode');f.enterFrames();f.finish(5);
  await f.owner.selectDirectoryTarget(10,proof);
  assert.equal(f.events.filter(event=>Array.isArray(event)&&event[0]==='target').length,2,'other right panels reject a stale right-directory pick');
  f.properties.flush();assert.equal(catalog.params.interactionEnabled,true);
  catalog.params.onSelectTarget(10,0,undefined,proof);
  assert.equal(f.owner.panelPhase,'closing','real left-catalog callback closes a mode panel');
  const modeClose=f.owner.panelCloseTask;catalog.params.onSelectTarget(99,0,undefined,proof);
  assert.equal(f.animations.length,8,'closing rejects a duplicate catalog pick');
  f.finish(7);await modeClose;await Promise.resolve();
  assert.deepEqual(f.events.filter(event=>Array.isArray(event)&&event[0]==='target').at(-1),['target',10,proof]);
  await f.owner.openPanel('settings');f.enterFrames();f.finish(9);f.properties.flush();
  catalog.params.onSelectTarget(11,0,undefined,proof);
  assert.equal(f.owner.panelPhase,'closing','real left-catalog callback closes a settings panel');
  const settingsClose=f.owner.panelCloseTask;f.finish(11);await settingsClose;await Promise.resolve();
  assert.deepEqual(f.events.filter(event=>Array.isArray(event)&&event[0]==='target').at(-1),['target',11,proof]);
  const keyboard=deferred(),preparing=fixture(text,{keyboard:keyboard.promise});
  Object.assign(preparing.owner,{stageWidth:920,stageHeight:900,viewportWidth:662,viewportHeight:900});
  const opening=preparing.owner.openPanel('mode');await preparing.owner.selectDirectoryTarget(11,proof,true);
  assert.ok(!preparing.events.some(event=>Array.isArray(event)&&event[0]==='target'),'preparing modal also rejects catalog picks');
  keyboard.resolve();await opening;
  const saving=deferred(),late=fixture(text,{saving:saving.promise});
  Object.assign(late.owner,{stageWidth:920,stageHeight:900,viewportWidth:662,viewportHeight:900});
  await late.owner.openPanel('mode');late.enterFrames();late.finish(1);
  const oldPick=late.owner.selectDirectoryTarget(12,proof,true);late.finish(3);
  await late.owner.openPanel('settings');saving.resolve();await oldPick;
  assert.ok(!late.events.some(event=>Array.isArray(event)&&event[0]==='target'),'delayed catalog save cannot switch over a reopened panel');
}
await verifyReachableWideDirectory();

const drag = fixture(); await drag.owner.openPanel('mode'); drag.enterFrames(); drag.finish(1);
drag.owner.beginPanelDrag(); drag.owner.updatePanelDrag(-20); assert.equal(drag.owner.panelOffset, 0);
drag.owner.updatePanelDrag(96); drag.owner.finishPanelDrag(96, 550);
assert.equal(drag.owner.panelPhase, 'opening', 'thresholds are strictly greater, matching the demo');
assert.deepEqual(drag.animations[2].params.curve.args, [0, .9, 500, 43], 'drag updates use the demo enter spring');
assert.deepEqual(drag.animations.at(-1).params.curve.args, [0, .9, 500, 43]); drag.finish(drag.animations.length - 1);
drag.owner.beginPanelDrag(); drag.owner.updatePanelDrag(40); drag.owner.finishPanelDrag(40, 551);
assert.equal(drag.owner.panelPhase, 'closing'); drag.finish(drag.animations.length - 1);
const distance = fixture(); await distance.owner.openPanel('mode'); distance.enterFrames(); distance.finish(1);
distance.owner.beginPanelDrag(); distance.owner.finishPanelDrag(97, 0); assert.equal(distance.owner.panelPhase, 'closing');

const reduced = fixture(); reduced.owner.reduceMotion = true;
await reduced.owner.openPanel('settings'); assert.equal(reduced.owner.panelPhase, 'open');
assert.equal(reduced.owner.panelOffset, 0); assert.equal(reduced.owner.panelScrimOpacity, 1);
await reduced.owner.closePanel(); assert.equal(reduced.owner.panel, '');
assert.equal(reduced.frames.length, 0); assert.equal(reduced.animations.length, 0);

// Narrow production-method regressions must fail the same lifecycle behavior;
// neither the expected result nor the native I/O boundary is rewritten.
const require = createRequire(import.meta.url), sdk = process.env.READER_ETS_LOADER_ROOT ??
  '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(`${sdk}/node_modules/typescript`);
function mutate(name, transform) {
  const tree = ts.createSourceFile('/tmp/MangaSheetMotionNegative.ets', source, ts.ScriptTarget.Latest, true,
    ts.ScriptKind.ETS, require(`${sdk}/lib/ets_checker.js`).compilerOptions);
  const component = tree.statements.find(node => node.name?.getText(tree) === 'MangaReadingSurface');
  const member = component.members.find(node => node.name?.getText(tree) === name);
  const before = member.getText(tree), after = transform(before); assert.notEqual(before, after);
  return source.slice(0, member.getStart(tree)) + after + source.slice(member.end);
}
await assert.rejects(() => verifyMotion(mutate('closePanel', text =>
  text.replace("this.panelPhase = 'closing';", "this.panelPhase = 'closing'; this.panel = '';"))), /same content is retained/);
await assert.rejects(() => verifyRaces(mutate('closePanel', text =>
  text.replace('if (!this.mounted || generation !== this.panelGeneration) { resolve(false); return; }', ''))),
/stale exit cannot remove/);
await assert.rejects(() => verifyMotion(mutate('settlePanel', text =>
  text.replace('0.9, 500, 43', '1.05, 250, 30'))), /deep-equal/);

await assert.rejects(() => verifyMotion(mutate('openPanel', text => {
  const tree = ts.createSourceFile('/tmp/FirstFrameSheet.ets', `class Probe { ${text} }`, ts.ScriptTarget.Latest, true,
    ts.ScriptKind.ETS, require(`${sdk}/lib/ets_checker.js`).compilerOptions);
  const requests = [];
  const visit = node => { if (ts.isCallExpression(node) && node.expression?.name?.getText(tree) === 'postFrameCallback') requests.push(node); ts.forEachChild(node, visit); };
  visit(tree);
  assert.equal(requests.length, 2, 'the production entry fence has two native frame admissions');
  const inner = requests[1];
  return text.replace(inner.getText(tree), `${inner.arguments[0].getText(tree)}.onFrame(0)`);
})), /admission frame cannot start animation/);
await assert.rejects(() => verifyRaces(mutate('settlePanel', text =>
  text.replace("if (this.mounted && generation === this.panelGeneration && this.panelPhase === 'opening')", 'if (true)'))),
/unmounted entry callback is inert/);
await assert.rejects(() => verifyPersistentFontAdmission(mutate('tabletDirectory', text =>
  text.replace('if (this.panelFontsReady)', 'if (true)'))), /persistent catalog cannot paint/);
await assert.rejects(() => verifyPersistentFontAdmission(mutate('preparePanelFonts', text =>
  text.replace('if (!this.mounted || generation !== this.panelFontGeneration) return false;', ''))), /late font receipt/);

await assert.rejects(() => verifyAllPanelFontAdmission(mutate('openPanel', text =>
  text.replace('if (!await this.preparePanelFonts())', "if (panel === 'directory' && !await this.preparePanelFonts())"))),
/cannot mount before four/);
await assert.rejects(() => verifyAllPanelFontAdmission(mutate('preparePanelFonts', text =>
  text.replace('this.panelFontsReady = ready;', 'this.panelFontsReady = true;').replace('return ready;', 'return true;'))),
/unavailable receipt/);
await assert.rejects(() => verifySerifFontAdmission(mutate('preparePanelFonts', text =>
  text.replace('await prepareReaderFontFamily(READER_FONT_NOTO_SERIF_SC_BOLD);', ''))),
/Sans admission follows/);
await assert.rejects(() => verifyResetPreferences(mutate('resetMangaPreferences', text =>
  text.replace('this.showPageNumbers = true;', "this.showPageNumbers = true; this.backgroundPreference = 'paper';"))),
/reset preserves/);
await assert.rejects(() => verifyMotion(mutate('sectionTitle', text =>
  text.replace('READER_FONT_NOTO_SANS_SC_UI_600', 'READER_FONT_NOTO_SANS_SC_UI_900'))),
/exact baked static face/);
await assert.rejects(() => verifyDownloadPanelTitles(mutate('panelTitle', text =>
  text.replace("? '本书下载' : '本话下载'", "? '更多' : '更多'"))), /production title distinguishes/,
  'a generic fallback heading cannot hide either download scope');
await assert.rejects(() => verifyDownloadPanelTitles(mutate('panelTitle', text =>
  text.replace('this.downloadActionsChapterIndex === undefined', '!this.downloadActionsChapterIndex'))), /production title distinguishes/,
  'chapter index0 cannot be misclassified as the whole-book download scope');
await assert.rejects(()=>verifyReachableWideDirectory(mutate('openPanel',text=>text.replace('this.panel = panel;',
 "if (panel === 'directory' && this.persistentDirectory()) { await this.closePanel(); return; } this.panel = panel;"))),/real tablet directory action/);
await assert.rejects(()=>verifyReachableWideDirectory(mutate('selectDirectoryTarget',text=>text.replace("} else if (this.panelPhase !== 'open' || this.panel !== 'directory') return;",
 "} else if (this.persistentDirectory() || this.panelPhase !== 'open' || this.panel !== 'directory') return;"))),/closing/);
await assert.rejects(()=>verifyReachableWideDirectory(mutate('directoryBody',text=>text.replace('this.selectDirectoryTarget(chapterIndex, proof, catalog)',
 'this.selectDirectoryTarget(chapterIndex, proof, false)'))),/real left-catalog callback closes a mode panel/);

console.log('PASS actual SDK-lowered manga sheet lifecycle: required checked static receipts before directory/mode/settings/more and persistent text admission, exact 400/500/600/900 family actors including the actual shared footer, six legal900 headings and both download scopes including chapter0, demo reset preserving dark preference, reachable tablet right directory and left catalog choices in mode/settings via close/save/proof, two-frame callback-before-build, native springs and160ms scrim, retained exit/block, drag/reduce-motion and late target/save/reopen/unmount; missing receipt/incorrect static face/generic or chapter0 download heading/old reset/unreachable or blocked catalog and lifecycle negative controls rejected');
console.log('Boundary: native scheduling, input/font I/O and animator are instrumented; compositor frames, physical font paint and VM motion still require separate continuous evidence.');
