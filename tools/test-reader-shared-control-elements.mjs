import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
import * as geometry from '../entry/src/main/ets/features/reading/ui/ReaderControlGeometry.ts';
import * as session from '../entry/src/main/ets/features/reading/ui/ReaderControlSessionState.ts';
import { readerControlHostClosing } from '../entry/src/main/ets/features/reading/ui/ReaderControlHostSession.ts';
import * as headerGeometry from '../entry/src/main/ets/features/reading/ui/ReaderControlHeaderGeometry.ts';
import { registerHooks } from 'node:module';
import { ReaderPageInputClock } from '../entry/src/main/ets/features/reading/ui/ReaderPageInputClock.ts';
import { sampleReaderControlMotionComposition } from '../entry/src/main/ets/features/reading/ui/ReaderControlMotionGeometry.ts';
import { readerFoundationTokens } from './lib/reader-tokens-probe.mjs';
import { installedEtsCompiler } from './lib/ets-compiler-runtime.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { selectedProductionMethods, selectedProductionClasses } from './lib/selected-production-methods.mjs';
import { iconButtonControls } from './lib/reader-icon-button-probe.mjs';
import { readerMotionValueDurationMs } from '../entry/src/main/ets/ui/foundation/ReaderMotionDurationPolicy.ts';
import { sourceSwitchTriggerFocusId } from '../entry/src/main/ets/features/source/presentation/SourceSwitchSurfaceLifecycle.ts';

const cases = {
  'live-topbar-input': { description: 'Actual SDK Back/source/More callbacks consume a live root input change before any retained Prop delivery, and recover in the same opening', resources: [] },
  'input-admission': { description: 'Actual shared control SDK callbacks reject hidden, retired, temporary and successor module inputs while preserving current actions', resources: [] },
  'header-roles-sdk': { description: 'Original per-module header paint, actual measured labels, separate dock action carriers and exact cap difference in the SDK builders', resources: [] },
  'approved-elements': { description: 'Actual shared Home/nav/brightness/header paint and hit roles against frozen Make V17 and explicit accessible carrier successors', resources: [] },
};
const file = new URL('../entry/src/main/ets/features/reading/ui/ReaderControlPanel.ets', import.meta.url);
const source = readFileSync(file, 'utf8');
const headerTextModifier = selectedProductionClasses(file, ['ReaderControlHeaderLineHeight']);
const { readerControlMotionMs } = pureModuleProbe(readFileSync(new URL('../entry/src/main/ets/features/reading/ui/ReaderControlMotionPolicy.ts', import.meta.url), 'utf8').replace(/export \{[^}]+\} from '[^']+';/g, ''), 'ReaderControlMotionPolicy.ts', { readerMotionValueDurationMs }, ['readerControlMotionMs']);
const names = ['secondaryModuleInputEnabled', 'contentLocation', 'contentInputEnabled', 'controlActionInputEnabled',
  'hasCurrentModalInput', 'currentTemporaryInputScope', 'progressInputEnabled', 'brightnessInputEnabled',
  'homeChapterCardHeight', 'homeContentMinimumHeight', 'presentedHomeChapterTitle', 'presentedHomeTotalChapters', 'progressRow', 'effectiveProgressPercent', 'progressChangeHandler', 'clampPercent', 'quickAction', 'quickActionPanel', 'quickActionIcon', 'chapterRow', 'canStepChapter', 'homeMetric',
  'moduleButton', 'moduleNavBar', 'moduleIcon', 'isActiveModule', 'activateModule', 'requestPage',
  'accessibleBrightnessActions', 'stepBrightness', 'navigationInputEnabled', 'brightnessRailContent', 'brightnessContentHeight', 'brightnessTrackHeight', 'brightnessRequiresChildClip',
  'beginBrightnessDrag', 'updateBrightnessDrag', 'finishBrightnessDrag', 'cancelBrightnessDrag', 'commitBrightnessTap',
  'effectiveBrightnessPercent', 'clampBrightness', 'roundBrightness', 'collapseControl', 'accessibleControlActions',
  'controlHeader', 'headerFrame', 'headerPaintLayout', 'headerRole', 'headerTitleStyle', 'headerActionStyle',
  'headerActionPaint', 'headerAction', 'headerActionFrame', 'headerActionInputEnabled', 'activateHeaderAction', 'controlCallbackGuard', 'controlActionScope', 'controlActionHandler', 'brightnessGestureHandler', 'controlTouchHandler', 'currentMoreMenuOwnerScope', 'currentMinimumIdentity', 'committedMinimumIdentity', 'minimumPresentationAvailable', 'headerGrabRegions', 'headerGrabCapFrame', 'headerGrabResponseRegions', 'headerGrabCap',
  'replaceHeader', 'replaceHeaderFrame', 'headerInter', 'headerIcon', 'topBarInputEnabled', 'topBarBack', 'topBarActions', 'sourceActionHeight',
  'shortWindowActions', 'shortWindowActionInput'];
const compiled = new Map();
const gestureCalls = [];
const gesture = new Proxy({}, { get: (_, name) => (...args) => {
  if (['onActionStart', 'onActionUpdate', 'onActionEnd', 'onActionCancel', 'onAction'].includes(name)) {
    gestureCalls.push({ name, callback: args[0] });
  }
  return gesture;
} });
const gestures = { PanGesture: gesture, TapGesture: gesture, GestureGroup: gesture,
  PanDirection: { Vertical: 'vertical' }, GestureMode: { Exclusive: 'exclusive' }, GesturePriority: { Low: 'low' },
  globalThis: { Gesture: gesture, GestureGroup: gesture, PanGesture: gesture, TapGesture: gesture } };
function fixture(text = source) {
  const events = [];
  if (!compiled.has(text)) compiled.set(text, createReaderBuilderProbe(text, names, { ...geometry, ...session, ...headerGeometry, ...headerTextModifier, ...gestures, readerControlMotionMs,
    TOK_BORDER_W: readerFoundationTokens.TOK_BORDER_W,
    sourceSwitchTriggerFocusId, ScrollDirection: { Horizontal: 'horizontal' }, READER_CONTROL_EXPAND_MS: 320 }).Component);
  const Component = compiled.get(text);
  const owner = new Component(undefined, {});
  Object.assign(owner, {
    runtimeMounted: true, inputEnabled: true, controlObscured: false, temporaryLayerKind: '', moreMenuVisible: false,
    visualVisibilityProgress: 1, visualHeldPointerId: -1, visualTransitionKind: '', visualExpansionProgress: 0,
    lastVisibleContentLocation: { level: 'home', module: 'home', form: 'quick', directoryTab: 'directory' },
    visualSession: session.openReaderControlSession(session.createReaderControlSessionState(), 0), reduceMotion: false,
    appScheme: 'day', bookTitle: '书名', chapterTitle: '章节', sourceId: 'source', sourceBookId: 'book',
    readableChapterPosition: 1, currentChapterIndex: 1, totalChapters: 3, tocEntries: [],
    minimumIdentity: '', brightnessAutomatic: false, brightnessPercent: 50, brightnessPreviewPercent: -1,
    brightnessDragging: false, brightnessLastEmittedPercent: -1, progressPercent: 50, progressPreviewPercent: -1, progressInputRevision: 1,
    layout: { viewportWidth: 366, fullPanelWidth: 364, topBarVisible: true, topBarHeight: 54, contentBudget: undefined },
    currentLayout: function() { return this.layout; }, controlPanelHeight: () => 736,
    geo: { moduleNavH: 80, moduleNavRadiusTop: 14 },
    ttsState: { status: 'unavailable' }, selectedMinimumProfile: () => undefined,
    minimumInputReady: () => true, hasCurrentTemporaryInput: function() { return this.temporaryLayerKind !== ''; },
    frame: () => ({ visibility: 1, progress: 0, content: { x: 13, y: 57, width: 264, height: 190 }, header: { x: 13, y: 19, width: 338, height: 30, opacity: 1 }, shell: { x: 0, y: 0, width: 364, height: 736 }, topBar: { opacity: 1 },
      brightness: { width: 46, height: 190, opacity: 1 }, navigation: { opacity: 1, height: 80 } }),
    contentTitle: () => '目录',
    readerMorePopupOptions: () => ({}), isLocalBook: () => false, setMoreMenuVisible: value => events.push(['more', value]),
    onPreviousChapter: () => events.push('previous'), onNextChapter: () => events.push('next'),
    promoteSearch: () => events.push('search'), promoteAutoPage: () => events.push('autoPage'),
    onOpenReplace: () => events.push('replace'), onBrightnessAuto: () => events.push('auto'),
    onBrightnessChange: value => events.push(['brightness', value]), onBrightnessCancel: () => events.push('cancel'),
    onInputActivity() {}, invalidateProgressInput() {}, onPageChange: page => events.push(['page', page]),
    onModuleSelect: module => events.push(['module', module]), onDismiss: () => events.push('dismiss'),
    applySemanticSession: next => events.push(['session', next]),
    onExitReading: () => events.push('exit'), onSourceSwitch: id => events.push(['source', id]),
  });
  Object.defineProperty(owner, 'temporaryInputKind', { get: () => owner.temporaryLayerKind });
  function nodes(parent = owner) { return [...parent.nodes.values(), ...[...parent.children.values()].flatMap(nodes)]; }
  return { owner, events, nodes, button: label => nodes().findLast(node => node.type === 'Button' && node.accessibilityText === label) };
}

function homeHandlers(f) {
  f.owner.chapterRow(); f.owner.quickActionPanel();
  return ['上一章', '下一章', '搜索', '自动翻页', '替换'].map(label => {
    const node = f.button(label); assert.ok(node?.onClick, `actual ${label} SDK Button callback exists`); return node.onClick;
  });
}
function runBrightnessGestureRetirement(text = source) {
  for (const axis of ['book', 'opening', 'presentation']) {
    const current = fixture(text);
    let identity = 'owner|committed-visit';
    Object.assign(current.owner, { preparedMinimumRequired: true, minimumOwnerKey: 'owner',
      minimumCommittedIdentity: identity, currentMinimumIdentity: () => identity, minimumPresentationAvailable: () => true });
    const capture = build => {
      const first = gestureCalls.length;
      build();
      const calls = gestureCalls.slice(first);
      return Object.fromEntries(['onActionStart', 'onActionUpdate', 'onActionEnd', 'onActionCancel'].map(name => {
        const callback = calls.findLast(call => call.name === name)?.callback;
        assert.equal(typeof callback, 'function', 'the actual Pan builder registers ' + name);
        return [name, callback];
      }));
    };
    const old = capture(() => current.owner.brightnessRailContent());
    old.onActionStart(); old.onActionUpdate({ offsetY: 10 });
    assert.equal(current.owner.brightnessDragging, true);
    if (axis === 'book') { current.owner.sourceId = 'successor'; current.owner.minimumOwnerKey = 'successor'; }
    if (axis === 'opening') current.owner.controlOpenRevision = 9;
    if (axis === 'presentation') { identity = 'owner|next-committed-visit'; current.owner.minimumCommittedIdentity = identity; }
    const writes = current.events.length;
    current.owner.cancelBrightnessDrag();
    assert.equal(current.events.length, writes, 'retirement clears only the old local drag');
    const next = capture(() => current.owner.replay());
    next.onActionStart(); next.onActionUpdate({ offsetY: 5 });
    assert.equal(current.owner.brightnessDragging, true, 'the successor current drag is active');
    const snapshot = () => [current.owner.brightnessDragging, current.owner.brightnessPreviewPercent,
      current.owner.brightnessLastEmittedPercent, current.events.length];
    const before = snapshot();
    for (const name of ['onActionUpdate', 'onActionEnd', 'onActionCancel']) {
      old[name]({ offsetY: 60 });
      assert.deepEqual(snapshot(), before, `old registered Pan ${name} cannot alter the active successor ${axis}`);
    }
    next.onActionEnd({ offsetY: 5 });
    assert.equal(current.owner.brightnessDragging, false, 'the current registered End remains usable');
    assert.ok(current.events.length > before[3]);
    next.onActionStart(); next.onActionCancel();
    assert.equal(current.events.at(-1), 'cancel', 'same-owner registered Cancel keeps the original writer cancellation');
  }
}
function runInput(text = source) {
  const f = fixture(text), callbacks = homeHandlers(f);
  callbacks.forEach(callback => callback());
  assert.deepEqual(f.events, ['previous', 'next', 'search', 'autoPage', 'replace']);
  const blocked = [
    owner => { owner.runtimeMounted = false; },
    owner => { owner.inputEnabled = false; },
    owner => { owner.controlObscured = true; },
    owner => { owner.temporaryLayerKind = 'modal'; },
    owner => { owner.moreMenuVisible = true; },
    owner => { owner.visualVisibilityProgress = 0; },
    owner => { owner.visualTransitionKind = 'morph'; },
    owner => { owner.visualHeldPointerId = 8; },
    owner => { owner.minimumInputReady = () => false; },
    owner => { owner.lastVisibleContentLocation = { level: 'secondary', module: 'directory', form: 'quick' }; },
  ];
  for (const block of blocked) {
    const current = fixture(text), handlers = homeHandlers(current); block(current.owner);
    handlers.forEach(callback => callback()); assert.deepEqual(current.events, [], 'retained Home callbacks cannot enter a blocked or successor owner');
  }
  for (const block of blocked.slice(0, -1).concat(owner => {
    owner.frame = () => ({ brightness: { width: 46, height: 190, opacity: 0 } });
  })) {
    const current = fixture(text); current.owner.brightnessRailContent(); const auto = current.button('手动亮度，点击跟随系统');
    assert.ok(auto?.onClick); block(current.owner); auto.onClick();
    current.owner.beginBrightnessDrag(); current.owner.commitBrightnessTap({ fingerList: [{ localY: 20 }] });
    assert.deepEqual(current.events, [], 'retained brightness callbacks cannot enter a blocked or invisible rail');
  }
  const rail = fixture(text); rail.owner.brightnessRailContent();
  rail.button('手动亮度，点击跟随系统').onClick();
  rail.owner.beginBrightnessDrag(); rail.owner.updateBrightnessDrag(10);
  rail.owner.moreMenuVisible = true; rail.owner.finishBrightnessDrag(20);
  assert.ok(rail.events.some(event => Array.isArray(event) && event[0] === 'brightness'));
  assert.equal(rail.events.at(-1), 'cancel', 'revoking an active drag calls the original cancellation owner');
  const count = rail.events.length; rail.owner.updateBrightnessDrag(30); assert.equal(rail.events.length, count);
  const brightA11y = fixture(text); brightA11y.owner.accessibleBrightnessActions();
  const increase = brightA11y.nodes().find(node => node.create === '提高阅读亮度，当前50%，手动模式');
  increase.onClick(); assert.deepEqual(brightA11y.events, [['brightness', 51]], 'virtual increment reuses the original brightness writer');
  brightA11y.owner.moreMenuVisible = true; increase.onClick(); assert.equal(brightA11y.events.length, 1);
  const limit = fixture(text); limit.owner.brightnessPercent = 100; limit.owner.brightnessAutomatic = true; limit.owner.accessibleBrightnessActions();
  const maximum = limit.nodes().find(node => node.create === '提高阅读亮度，当前100%，跟随系统');
  assert.equal(maximum.enabled, false); maximum.onClick(); assert.deepEqual(limit.events, [], 'current upper bound disables and rejects a retained increment');
  for (const module of ['directory', 'tts', 'appearance', 'settings', 'search', 'autoPage', 'replace']) {
    const child = fixture(text); child.owner.lastVisibleContentLocation = { level: 'secondary', module, form: 'quick' };
    assert.equal(child.owner.secondaryModuleInputEnabled(module), true);
    child.owner.temporaryLayerKind = 'inlineEditor'; assert.equal(child.owner.secondaryModuleInputEnabled(module), true, 'the current module retains its own editor');
    child.owner.moreMenuVisible = true; assert.equal(child.owner.secondaryModuleInputEnabled(module), false, 'shared More cannot become a module-local input permission');
    child.owner.moreMenuVisible = false; child.owner.runtimeMounted = false; assert.equal(child.owner.secondaryModuleInputEnabled(module), false, 'retired shared owner cannot admit a retained child');
  }
  const nav = fixture(text); nav.owner.moduleButton('rc_list', '目录', 'directory');
  const enter = nav.button('目录').onClick; nav.owner.runtimeMounted = false; enter(); assert.deepEqual(nav.events, []);
  nav.owner.runtimeMounted = true; nav.owner.moreMenuVisible = true; enter(); assert.deepEqual(nav.events, []);
  nav.owner.moreMenuVisible = false; enter(); assert.deepEqual(nav.events, [['page', 'moduleDirectory'], ['module', 'directory']]);
  const short = fixture(text); short.owner.layout.topBarVisible = false; short.owner.shortWindowActions();
  const shortExit = short.button('退出阅读，返回上一页').onClick; short.owner.runtimeMounted = false; shortExit(); assert.deepEqual(short.events, []);
  short.owner.runtimeMounted = true;
  const shortSource = short.button('换源').onClick;
  short.owner.temporaryLayerKind = 'modal';
  shortExit(); shortSource(); assert.deepEqual(short.events, [], 'old short-window ordinary actions reject a temporary layer');
  short.owner.temporaryLayerKind = '';
  short.owner.moreMenuVisible = true;
  shortExit(); shortSource(); assert.deepEqual(short.events, [], 'old short-window ordinary actions reject More');
  short.owner.moreMenuVisible = false;
  shortExit(); assert.deepEqual(short.events, ['exit']);
  short.owner.moreMenuVisible = true; short.button('更多').onClick(); assert.deepEqual(short.events.at(-1), ['more', false], 'the current popup trigger still closes its own menu');
  const a11y = fixture(text); a11y.owner.accessibleControlActions();
  const close = a11y.nodes().find(node => node.create === '关闭控制栏并返回阅读'); assert.ok(close.onClick);
  a11y.owner.temporaryLayerKind = 'modal'; close.onClick(); assert.deepEqual(a11y.events, []);
  a11y.owner.temporaryLayerKind = ''; close.onClick(); assert.deepEqual(a11y.events, ['dismiss']);
  a11y.owner.sourceId = 'successor'; close.onClick(); assert.deepEqual(a11y.events, ['dismiss'], 'old virtual close cannot act for a successor book owner');
  const virtual = fixture(text); virtual.owner.lastVisibleContentLocation = { level: 'secondary', module: 'directory', form: 'full' };
  virtual.owner.accessibleControlActions();
  const toggle = virtual.nodes().find(node => node.create === '收回快捷控制栏');
  toggle.onClick(); assert.equal(virtual.events.length, 1, 'current virtual toggle preserves the original action');
  virtual.owner.controlOpenRevision = 2; toggle.onClick();
  assert.equal(virtual.events.length, 1, 'old virtual toggle cannot act for a successor opening');
  const publicActions = {
    home: current => homeHandlers(current),
    topBar: current => { current.owner.topBarBack(); current.owner.topBarActions(); return current.nodes().filter(node => node.type === 'Button').map(node => node.onClick); },
    shortWindow: current => { current.owner.layout.topBarVisible = false; current.owner.shortWindowActions(); return current.nodes().filter(node => node.type === 'Button').map(node => node.onClick); },
    navigation: current => { current.owner.moduleButton('rc_list', '目录', 'directory'); return [current.button('目录').onClick]; },
    brightness: current => { current.owner.brightnessRailContent(); current.owner.accessibleBrightnessActions();
      const tap = current.owner.brightnessGestureHandler(value => current.owner.commitBrightnessTap(value));
      return [current.button('手动亮度，点击跟随系统').onClick,
        ...current.nodes().filter(node => node.type === 'Text' && node.create?.includes?.('阅读亮度，当前')).map(node => node.onClick),
        () => tap({ fingerList: [{ localY: 20 }] })];
    },
    virtualControl: current => { current.owner.lastVisibleContentLocation = { level: 'secondary', module: 'directory', form: 'full' };
      current.owner.accessibleControlActions(); return current.nodes().filter(node => node.type === 'Text' && node.onClick).map(node => node.onClick); },
  };
  for (const [category, capture] of Object.entries(publicActions)) for (const axis of ['book', 'opening', 'presentation']) {
    const current = fixture(text); let identity = 'owner|committed-visit';
    Object.assign(current.owner, { preparedMinimumRequired: true, minimumOwnerKey: 'owner',
      minimumCommittedIdentity: identity, currentMinimumIdentity: () => identity, minimumPresentationAvailable: () => true });
    const callbacks = capture(current);
    for (const callback of callbacks) { const before = current.events.length; callback(); assert.ok(current.events.length > before, category + ' has a usable current action'); }
    const accepted = current.events.length;
    if (axis === 'book') { current.owner.sourceId = 'successor'; current.owner.minimumOwnerKey = 'successor'; }
    if (axis === 'opening') current.owner.controlOpenRevision = 9;
    if (axis === 'presentation') { identity = 'owner|next-committed-visit'; current.owner.minimumCommittedIdentity = identity; }
    if (category === 'home') current.owner.replay();
    callbacks.forEach(callback => callback());
    assert.equal(current.events.length, accepted, `${category} old callbacks reject successor ${axis}`);
  }
  {
    const current = fixture(text); current.owner.chapterRow();
    const [childId, child] = [...current.owner.children.entries()].find(([, child]) => child.accessibilityLabel === '上一章');
    assert.ok(child, 'actual shared chapter icon child is mounted');
    const button = [...child.nodes.values()].find(node => node.type === 'Button');
    const old = button.onClick, initialIds = [...child.nodes.keys()];
    old(); assert.deepEqual(current.events, ['previous']);
    current.owner.controlOpenRevision = 2;
    current.owner.replayOnly(new Set([childId]));
    assert.equal(current.owner.children.get(childId), child, 'close/reopen preserves the actual shared component');
    assert.deepEqual([...child.nodes.keys()], initialIds, 'reactive scope updates preserve the native button');
    old(); assert.deepEqual(current.events, ['previous'], 'old native closure rejects the new opening scope');
    button.onClick(); assert.deepEqual(current.events, ['previous', 'previous'], 'updated native handler uses the stable ordinary onTap receiver');
    const controls = iconButtonControls(), legacyChild = controls.icon.owner;
    let legacyCalls = 0;
    Object.assign(legacyChild, { icon: 'fixture-icon', specId: 'toolbar-standard', accessibilityLabel: '默认动作',
      actionEnabled: true, scheme: 'day', onTap: () => legacyCalls++ });
    legacyChild.aboutToAppear(); legacyChild.initialRender(); controls.properties.flush();
    assert.equal(legacyChild.actionScope, '', 'existing callers retain the default empty scope');
    const legacyClick = [...legacyChild.nodes.values()].find(node => node.type === 'Button').onClick;
    legacyClick(); controls.update(legacyChild, { actionEnabled: false }); legacyClick();
    assert.equal(legacyCalls, 1, 'default-scope original eligibility remains current');
    controls.update(legacyChild, { actionEnabled: true }); legacyClick();
    assert.equal(legacyCalls, 2, 'default-scope existing consumer behavior remains usable');
  }
  const Activity = selectedProductionMethods(new URL('../entry/src/main/ets/features/reading/ui/LocalReadingExperience.ets', import.meta.url),
    'ReadingExperience', ['activeControlNavigationIntent', 'controlMinimumOwnerKey', 'controlMinimumCommittedIdentity',
      'cancelControlNavigationIntent', 'onControlInputActivity'],
    { readerControlHostClosing, readerControlContentLocation: session.readerControlContentLocation });
  const activity = Object.assign(new Activity(), {
    controlSession: session.openReaderControlSession(session.createReaderControlSessionState(), 0),
    controlNavigationGeneration: 1, controlMinimumGeneration: 1, invalidateControlBackdrop() {},
  });
  activity.controlNavigationIntent = { generation: 1, ownerKey: activity.controlMinimumOwnerKey(),
    sourceIdentity: activity.controlMinimumCommittedIdentity() };
  const retiredDrag = fixture(text); retiredDrag.owner.onInputActivity = () => activity.onControlInputActivity();
  retiredDrag.owner.beginBrightnessDrag();
  assert.equal(activity.controlNavigationIntent, undefined, 'admitted PanStart cancels pending navigation through the existing actual Host activity');
  retiredDrag.owner.updateBrightnessDrag(10);
  const beforeRetire = retiredDrag.events.length; retiredDrag.owner.sourceId = 'successor';
  retiredDrag.owner.updateBrightnessDrag(20); retiredDrag.owner.finishBrightnessDrag(30);
  assert.equal(retiredDrag.events.length, beforeRetire, 'retired drag dispatches neither write nor cancellation into a successor owner');
  assert.equal(retiredDrag.owner.brightnessDragging, false); assert.equal(retiredDrag.owner.brightnessPreviewPercent, -1);
  const full = fixture(text); full.owner.lastVisibleContentLocation = { level: 'secondary', module: 'directory', form: 'full' };
  full.owner.visualTransitionKind = 'morph'; full.owner.collapseControl();
  assert.equal(full.events[0][0], 'session', 'the current visible secondary still retargets collapse during its morph');
  full.owner.moreMenuVisible = true; full.owner.collapseControl(); assert.equal(full.events.length, 1);
  {
    const current = fixture(text);
    current.owner.topBarBack(); current.owner.topBarActions();
    current.owner.moduleButton('rc_list', '目录', 'directory');
    homeHandlers(current);
    const background = ['退出阅读，返回上一页', '换源', '目录', '上一章', '下一章', '搜索', '自动翻页', '替换'];
    current.owner.moreMenuVisible = true;
    current.owner.temporaryLayerKind = 'moreMenu';
    current.owner.replay();
    for (const label of background) {
      const button = current.button(label);
      assert.equal(button.enabled, true, `More preserves the native paint of ${label}`);
      button.onClick();
    }
    assert.deepEqual(current.events, [], 'More still blocks the painted background actions');
    current.owner.readableChapterPosition = 0;
    current.owner.replay();
    assert.equal(current.button('上一章').enabled, false, 'More preserves a genuinely unavailable action');
  }
  const hidden = fixture(text); hidden.owner.topBarBack(); const exit = hidden.button('退出阅读，返回上一页');
  hidden.owner.visualVisibilityProgress = 0; hidden.owner.frame = () => ({ topBar: { opacity: 0 } }); exit.onClick();
  assert.deepEqual(hidden.events, [], 'hidden top bar cannot dispatch a retained Back callback');
  const obscured = fixture(text); obscured.owner.topBarActions(); const source = obscured.button('换源').onClick, more = obscured.button('更多').onClick;
  obscured.owner.controlObscured = true; source(); more(); assert.deepEqual(obscured.events, [], 'obscured top bar rejects retained source and More callbacks');
  assert.equal(obscured.owner.topBarInputEnabled(), false);
  runBrightnessGestureRetirement(text);
  return blocked.length;
}


async function runHeaderRoles() {
  // The shipping module uses ArkTS extensionless imports. Resolve those only
  // while loading its actual runtime graph through Node's TypeScript support.
  const resolution = registerHooks({ resolve(specifier, context, next) {
    try { return next(specifier, context); } catch (error) {
      if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(specifier + '.ts', context);
      throw error;
    }
  } });
  let ReaderControlRuntime;
  try { ({ ReaderControlRuntime } = await import('../entry/src/main/ets/features/reading/ui/ReaderControlRuntime.ts')); }
  finally { resolution.deregister(); }
  const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const headerPath = 'entry/src/main/ets/features/reading/ui/ReaderControlHeaderGeometry.ts';
  const minimumPath = 'entry/src/main/ets/features/reading/ui/ReaderControlMinimumMeasurement.ets';
  const textMeasurePath = 'entry/src/main/ets/features/reading/ui/ReaderControlTextMeasurement.ets';
  const original = JSON.parse(read('tools/fixtures/reader-control-shared-layer-live-20260906.json'));
  const make = read('tools/fixtures/tts-reference/PhoneScreen.tsx');
  assert.equal(createHash('sha256').update(make).digest('hex'), '731582c1ac493d48f1ebdaae1e5527de5dfe3f391d37d8c85a51643ce72b4a3c');
  assert.ok(make.includes('gap-[4px] bg-[rgba(238,230,219,0.7)] h-[26px] left-[290px]'));
  assert.ok(make.includes('top-[2px] px-[9px]'));
  assert.ok(make.includes('M3 4.5 6 7.5l3-3'));
  const rawHeaders = new Map(original.sources.headers.nodes.map(node => [node.id, node]));
  for (const id of ['1689:1710', '1841:3388', '1721:22563', '1721:22599', '1938:5075', '1938:7519']) {
    assert.equal(rawHeaders.get(id).height, 30, 'independent original header paint height');
    const action = rawHeaders.get(id).children.at(-1);
    assert.deepEqual([action.width, action.height], [40, 26]);
  }
  const dayChevron = read('entry/src/main/resources/base/media/reader_control_header_chevron.svg');
  const nightChevron = read('entry/src/main/resources/base/media/reader_control_header_chevron_theme_night.svg');
  for (const svg of [dayChevron, nightChevron]) {
    assert.ok(svg.includes('viewBox="0 0 12 12"'));
    assert.ok(svg.includes('M3 4.5L6 7.5L9 4.5'));
    assert.ok(svg.includes('stroke-width="1.3"'));
  }
  const materialStroke = svg => svg.match(/stroke="(#[A-Fa-f0-9]+)"/)[1];
  assert.equal(materialStroke(dayChevron), materialStroke(read('entry/src/main/resources/base/media/reader_chevron_down_primary.svg')));
  assert.equal(materialStroke(nightChevron), materialStroke(read('entry/src/main/resources/base/media/reader_chevron_down_primary_theme_night.svg')));

  const compiler = installedEtsCompiler();
  const assertImports = text => {
    const tree = compiler.ts.createSourceFile('HeaderPanel.ets', text, compiler.ts.ScriptTarget.Latest, true, compiler.ts.ScriptKind.ETS, compiler.options);
    const imported = tree.statements.filter(compiler.ts.isImportDeclaration)
      .flatMap(node => node.importClause?.namedBindings?.elements ?? []).map(node => node.name.text);
    for (const name of ['readerControlHeaderRole', 'readerControlHeaderTitle', 'readerControlHeaderActionLabel',
      'readerControlHeaderLayout', 'readerControlHeaderTargetFrame', 'readerControlHeaderGrabRegions', 'TYPE_READER_CONTROL_COLLAPSE_TTS']) {
      assert.equal(imported.filter(value => value === name).length, 1, `${name} has a real explicit production import`);
      assert.ok(name.startsWith('TYPE_') ? name in readerTypographyRoles : name in headerGeometry, `${name} resolves to its actual target export`);
    }
  };
  assertImports(source);
  assert.throws(() => assertImports(source.replace('readerControlHeaderLayout, readerControlHeaderTargetFrame', 'readerControlHeaderTargetFrame')),
    /real explicit production import/, 'probe globals cannot hide a missing shipping import');

  const pureText = pureModuleProbe(read(textMeasurePath), 'ReaderControlTextMeasurement.ets',
    { WordBreak: { BREAK_WORD: 'break' } }, ['measureReaderControlText']);
  const actor = pureModuleProbe(read('entry/src/main/ets/features/reading/ui/ReaderControlActorGeometry.ts'),
    'ReaderControlActorGeometry.ts', {}, ['readerControlActor', 'readerControlUnit']);
  const replaceGeometry = pureModuleProbe(read('entry/src/main/ets/features/reading/ui/ReaderControlReplaceGeometry.ts'),
    'ReaderControlReplaceGeometry.ts', { ...actor,
      ...pureModuleProbe(read('entry/src/main/ets/features/reading/ui/ReaderControlActorGeometry.ts'),
        'ReaderControlActorGeometry.ts', {}, ['readerControlLerp', 'sampleReaderControlActor']) }, ['sampleReaderControlReplaceHeader']);
  const headerExports = ['readerControlHeaderRole', 'readerControlHeaderTitle', 'readerControlHeaderActionLabel',
    'readerControlHeaderPaintProfile', 'readerControlHeaderLayout', 'readerControlHeaderTargetFrame', 'readerControlHeaderGrabRegions'];
  const dependencies = { ...geometry, ...session, ...readerFoundationTokens, ...readerTypographyRoles, ...pureText, ...headerTextModifier,
    ...headerGeometry, readerControlMotionMs, READER_CONTROL_EXPAND_MS: 320, DEBUG: false,
    ReaderPageInputClock, readerMotionNowMs: () => 100,
    TouchType: { Down: 'down', Move: 'move', Up: 'up', Cancel: 'cancel' } };
  const bodySource = read(minimumPath);
  const methods = ['headerPaintLayout', 'headerFrame', 'headerRole', 'headerInter', 'headerTitleStyle', 'headerActionStyle',
    'headerIcon', 'controlHeader', 'headerActionPaint', 'headerAction', 'headerActionFrame', 'headerActionInputEnabled',
    'activateHeaderAction', 'controlCallbackGuard', 'controlActionHandler', 'controlTouchHandler', 'currentMoreMenuOwnerScope', 'currentMinimumIdentity',
    'headerGrabRegions', 'headerGrabCapFrame', 'headerGrabResponseRegions', 'headerGrabCap', 'replaceHeaderFrame', 'replaceHeader',
    'controlActionInputEnabled', 'contentInputEnabled', 'collapseControl', 'handleControlTouch'];
  const components = new Map();
  const modules = ['directory', 'bookmarks', 'tts', 'appearance', 'settings', 'search', 'autoPage', 'replace'];
  const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < .001, `${message}: ${actual} vs ${expected}`);
  const intersects = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

  function sample(moduleName, panelWidth, scale, progress, panelText = source, headerFunctions = headerGeometry, minimumText = bodySource) {
    const module = moduleName === 'bookmarks' ? 'directory' : moduleName;
    const title = headerGeometry.readerControlHeaderTitle(module, moduleName === 'bookmarks' ? 'bookmarks' : 'directory');
    const calls = [];
    const advance = text => [...text].reduce((sum, char) => sum + (/\p{Script=Han}/u.test(char) ? 1 : .55), 0);
    const context = { px2vp: value => value, vp2px: value => value, getMeasureUtils: () => ({
      measureText: options => advance(options.textContent) * Number.parseFloat(options.fontSize) * scale,
      measureTextSize(options) {
        calls.push(options);
        const naturalWidth = advance(options.textContent) * Number.parseFloat(options.fontSize) * scale;
        const height = Number.parseFloat(options.lineHeight ?? options.fontSize) * scale * (options.lineHeight ? 1 : 1.2);
        return { width: Math.min(naturalWidth, options.constraintWidth),
          height: height * (options.maxLines === 1 ? 1 : Math.max(1, Math.ceil(naturalWidth / options.constraintWidth))) };
      },
    }) };
    const deps = { ...dependencies, ...headerFunctions };
    const minimum = pureModuleProbe(minimumText, 'HeaderMinimum.ets', deps, ['measureReaderControlMinimum']);
    const home = { chapterTitleHeight: 34, chapterRowHeight: 54, progressHeight: 50, percentWidth: 20, countWidth: 20,
      actionLabelHeight: 13, actionHeight: 55.438, minimumHeight: 190, minWidth: 140, fits: true };
    const widths = { panelWidthVp: panelWidth, quickContentWidthVp: panelWidth - 78, fullContentWidthVp: panelWidth - 26 };
    const measured = minimum.measureReaderControlMinimum({ context, headerInter: module === 'search' || module === 'autoPage',
      title, identity: 'header-current', metricsRevision: 1, topBarHeightVp: 54, measureHomeForm: () => home }, module,
      widths, 'header-current', () => ({ module, quick: { heightVp: 190, minWidthVp: 140, fits: true },
        full: { heightVp: 190, minWidthVp: 140, fits: true } }));
    assert.ok(measured?.profile.headerPaint, 'normal shipping minimum entry returns the measured header recipe');
    const profile = measured.profile;
    const key = JSON.stringify([panelText, Object.keys(headerFunctions), minimumText === bodySource]);
    let Component = components.get(key);
    // Mutant dependencies are compiled separately even if their exported names agree.
    if (headerFunctions !== headerGeometry || !Component) {
      Component = createReaderBuilderProbe(panelText, methods, deps).Component;
      if (headerFunctions === headerGeometry) components.set(key, Component);
    }
    const owner = new Component(undefined, {});
    const events = [];
    const location = { level: 'secondary', module, form: progress === 1 ? 'full' : 'quick', directoryTab: moduleName === 'bookmarks' ? 'bookmarks' : 'directory' };
    const frame = sampleReaderControlMotionComposition({ expansionProgress: progress, visibilityProgress: 1 },
      { width: panelWidth, fullHeight: 736, quickHeight: 330, bottomGap: 0, contentBudget: {
        headerHeightVp: profile.headerPaint.heightVp, quickContentHeightVp: 190,
        fullContentHeightVp: 736 - 19 - profile.headerPaint.heightVp - 8 - 13,
        navigationHeightVp: profile.navigationHeight,
      } });
    Object.assign(owner, { appScheme: 'day', runtimeMounted: true, inputEnabled: true, controlObscured: false,
      temporaryLayerKind: '', moreMenuVisible: false, visualVisibilityProgress: 1, visualHeldPointerId: -1,
      contentLocation: () => location, contentTitle: () => title, frame: () => frame,
      currentLayout: () => ({ fullPanelWidth: panelWidth }), controlPanelHeight: () => 736,
      hasCurrentTemporaryInput: () => false,
      preparedMinimumRequired: false, minimumInputReady: () => true,
      visualTransitionKind: progress > 0 && progress < 1 ? 'morph' : '',
      selectedMinimumProfile: () => profile, reduceMotion: false,
      visualSession: session.openReaderControlSession(session.createReaderControlSessionState(), 0),
      onInputActivity() {}, applySemanticSession: value => events.push(value) });
    owner.controlHeader(); owner.headerAction(); owner.headerGrabCap();
    const nodes = [...owner.nodes.values()];
    const button = nodes.find(node => node.id === 'reader-control-collapse');
    const paintedLabel = nodes.find(node => node.type === 'Text' && node.create === (module === 'replace' ? '完成' : '收起'));
    const paint = nodes.find(node => node.type === 'Stack' && node.backgroundColor !== undefined && node.borderRadius === 8);
    assert.ok(button && paintedLabel && paint, 'actual SDK action carrier, label and paint exist');
    close(paint.height, Math.max(26, profile.headerPaint.actionLabelHeightVp), 'actual paint grows only for its own label');
    close(paint.width, Math.max(40, 20 * scale + (module === 'tts' ? 34 : 20)), 'role-specific horizontal paint budget');
    close(button.width, Math.max(44, paint.width), 'actual native Button pays horizontal carrier');
    close(button.height, Math.max(44, paint.height), 'actual native Button pays vertical carrier');
    if (scale === 1) {
      assert.equal(profile.headerPaint.heightVp, 30, 'default visual header retains original30');
      if (progress === 1) assert.equal(frame.content.y, 57, 'default Full content retains original57');
    }
    const caps = nodes.filter(node => typeof node.id === 'string' && node.id.startsWith('reader-control-motion-grab-cap'));
    if (button.enabled) {
      const target = { ...button.position, width: button.width, height: button.height };
      assert.ok(target.x >= 0 && target.y >= 0 && target.x + target.width <= panelWidth);
      if (progress === 1) assert.ok(target.y + target.height <= frame.content.y + .001, 'stable action uses the original space before content');
      else assert.equal(owner.contentInputEnabled(), false, 'actual morph admission retires the overlapping content input');
      assert.equal(caps.length, 1, 'one persistent native cap owns all response rectangles');
      for (const cap of caps) {
        assert.equal(cap.hitTestBehavior, 'HitTestMode.Block');
        for (const region of cap.responseRegion) {
          assert.ok(region.x >= 0 && region.y >= 0 && region.x + region.width <= cap.width && region.y + region.height <= cap.height);
          assert.equal(intersects(target, { x: cap.position.x + region.x, y: cap.position.y + region.y,
            width: region.width, height: region.height }), false,
          'actual SDK cap declarations cannot own any part of the current action target');
        }
      }
      assert.equal(intersects(target, { x: (panelWidth - 72) / 2, y: frame.shell.y, width: 72, height: 28 }), false,
        'action and central grabber have disjoint physical boxes');
      button.onClick(); assert.equal(events.length, 1, 'current actual Button sends one collapse intent');
      owner.runtimeMounted = false; button.onClick(); assert.equal(events.length, 1, 'retained retired action is rejected');
    } else {
      button.onClick(); assert.equal(events.length, 0, 'invisible/nonadmitted action callback is rejected at receiver');
    }
    if (module === 'tts') {
      const chevron = nodes.find(node => node.type === 'Image' && String(node.create).includes('reader_control_header_chevron'));
      assert.deepEqual([chevron?.width, chevron?.height], [12, 12], 'Make TTS has its own12 chevron');
      assert.equal(paintedLabel.lineHeight, 10);
    }
    if (module === 'replace') {
      assert.equal(paintedLabel.lineHeight, undefined, 'inherited Replace action line height omits the modifier');
      assert.deepEqual(paintedLabel.fontWeight, [700, { enableVariableFontWeight: false }], 'Replace keeps its original weight and variable-font option');
      assert.ok(calls.some(options => options.textContent === '完成'), 'producer measures the actual complete action');
      assert.ok(calls.some(options => options.textContent === '替换规则管理'), 'producer measures the full six-character title');
      if (progress === 1) {
        const titleNode = nodes.find(node => node.type === 'Text' && node.create === title);
        close(titleNode.width, 84 * scale, 'actual Full Replace title binds its growing six-character width');
      }
    } else {
      assert.equal(paintedLabel.lineHeight, module === 'tts' ? 10 : module === 'search' || module === 'autoPage' ? 12 : 14,
        'explicit role line heights remain distinct');
    }
    if (panelWidth === 364 && scale === 1 && progress === 1) {
      const expected = module === 'tts' ? [303, 12, 54, 44] : ['search', 'autoPage', 'replace'].includes(module) ? [308, 13, 44, 44] : [309, 12, 44, 44];
      assert.deepEqual([button.position.x, button.position.y, button.width, button.height], expected,
        'native carrier follows the independently frozen role coordinates');
      assert.equal(caps.length, 1, 'cap retains a single native host');
      assert.equal(caps[0].responseRegion.length, 3, 'single native cap keeps the exact three response rectangles');
    }
    return { owner, button, caps };
  }
  for (const module of modules) sample(module, 364, 1, 1);
  for (const width of [320, 366]) for (const scale of [1, 1.3, 1.6, 2]) {
    for (const module of modules) for (const p of [0, .5, 1]) sample(module, width - 26, scale, p);
  }
  for (const finish of ['up', 'cancel']) {
    const { owner } = sample('directory', 364, 1, 1);
    owner.runtimeMounted = true;
    const initialSession = session.expandReaderControlSession(session.enterReaderControlModule(
      session.openReaderControlSession(session.createReaderControlSessionState(), 0), 'directory', 0), 0);
    const runtime = new ReaderControlRuntime({ axis: { quickGrabberScreenY: 400, fullGrabberScreenY: 100,
      hiddenGrabberScreenY: 740 }, tapMaxDurationMs: 200, directionSlopVp: 4, settleDurationMs: 320 }, () => 100);
    owner.runtime = runtime;
    const InputHost = selectedProductionMethods(new URL('../entry/src/main/ets/features/reading/ui/LocalReadingExperience.ets', import.meta.url),
      'ReadingExperience', ['cancelControlNavigationIntent', 'onControlInputActivity']);
    const inputHost = Object.assign(new InputHost(), { controlNavigationIntent: { generation: 1 },
      controlNavigationGeneration: 1, controlMinimumGeneration: 1, invalidateControlBackdrop() {} });
    owner.onInputActivity = () => inputHost.onControlInputActivity();
    const actualDown = runtime.down.bind(runtime);
    runtime.down = (...args) => {
      assert.equal(inputHost.controlNavigationIntent, undefined, 'actual Host input activity cancels pending navigation before runtime Down');
      assert.equal(inputHost.controlNavigationGeneration, 2);
      return actualDown(...args);
    };
    owner.acceptRuntime = update => {
      owner.visualSession = update.session;
      owner.visualHeldPointerId = runtime.owner();
    };
    owner.acceptRuntime(runtime.start(initialSession));
    const [capId, cap] = [...owner.nodes.entries()].find(([, node]) => node.id === 'reader-control-motion-grab-cap');
    owner.replayOnly(new Set([capId]));
    const beforeCount = owner.observers.length;
    const originalCallback = cap.onTouch;
    let consumed = 0;
    const touch = (type, ns) => ({ type, timestamp: ns, changedTouches: [{ id: 7, windowY: 110 }],
      touches: [{ id: 7, windowY: 110 }], stopPropagation() { consumed += 1; } });
    originalCallback(touch('down', 100_000_000));
    assert.equal(runtime.owner(), 7, 'actual Panel touch callback gives the real runtime one held pointer');
    owner.replayOnly(new Set([capId]));
    assert.equal(owner.nodes.get(capId), cap, 'held-state update preserves the native cap record');
    assert.equal(owner.observers.length, beforeCount, 'held-state update creates no successor touch host');
    assert.equal(cap.responseRegion.length, 1, 'held action retirement updates regions on the same native host');
    cap.onTouch(touch(finish, 130_000_000));
    assert.equal(runtime.owner(), -1, `actual ${finish} releases the original runtime pointer`);
    assert.ok(consumed >= 2, 'actual Down and terminal callbacks both consume the original gesture');
    owner.replayOnly(new Set([capId]));
    assert.equal(owner.nodes.get(capId), cap, 'terminal update keeps the same native host');
    assert.equal(cap.responseRegion.length, 3, 'release restores paid action exclusion without owner replacement');
    const retiredTouch = cap.onTouch;
    owner.minimumOwnerKey = 'successor-book-owner';
    retiredTouch(touch('down', 160_000_000));
    assert.equal(runtime.owner(), -1, 'an old cap or central callback cannot start a gesture for the successor owner');
    owner.minimumOwnerKey = undefined;
    owner.runtime = new ReaderControlRuntime({ axis: { quickGrabberScreenY: 400, fullGrabberScreenY: 100,
      hiddenGrabberScreenY: 740 }, tapMaxDurationMs: 200, directionSlopVp: 4, settleDurationMs: 320 }, () => 100);
    owner.runtime.start(initialSession);
    retiredTouch(touch('down', 180_000_000));
    assert.equal(owner.runtime.owner(), -1, 'old touch callback cannot acquire a successor runtime with the same identity fields');
  }
  {
    const { owner, button } = sample('directory', 364, 1, 1);
    owner.runtimeMounted = true;
    owner.preparedMinimumRequired = true;
    owner.minimumOwnerKey = 'original-book';
    owner.minimumPresentationAvailable = () => true;
    let identity = 'original-book|directory-visit';
    owner.currentMinimumIdentity = () => identity;
    const buttonId = [...owner.nodes.entries()].find(([, node]) => node === button)[0];
    owner.replayOnly(new Set([buttonId]));
    let actions = 0;
    owner.collapseControl = () => actions++;
    const original = button.onClick;
    original(); assert.equal(actions, 1, 'current committed header callback remains usable');
    identity = 'original-book|tts-visit';
    original(); assert.equal(actions, 1, 'old module callback rejects an already committed successor visit');
    owner.replayOnly(new Set([buttonId]));
    const current = button.onClick;
    current(); assert.equal(actions, 2, 'updated callback can act for its own committed receipt');
    owner.minimumOwnerKey = 'successor-book';
    current(); assert.equal(actions, 2, 'old callback rejects an already committed successor book owner');
  }
  for (const width of [0, 10, Number.NaN]) {
    const local = headerGeometry.readerControlHeaderLayout('directory', 1, width);
    const target = headerGeometry.readerControlHeaderTargetFrame(local.actionTarget,
      { x: 13, y: 19, width, height: 30, opacity: 1 }, width, 70);
    assert.ok(Number.isFinite(target.width) && Number.isFinite(target.height));
    assert.ok(target.width <= (Number.isFinite(width) ? width : 0), 'unpaid narrow/invalid host cannot invent44');
  }
  assert.deepEqual(headerGeometry.readerControlHeaderGrabRegions({ x: 0, y: 0, width: Number.NaN, height: 19, opacity: 1 }, undefined), []);
  assert.equal(headerGeometry.readerControlHeaderRole('home'), 'none');

  const originalGeometry = read(headerPath);
  const highHeader = originalGeometry.replace('heightVp: Math.max(30,', 'heightVp: Math.max(44,');
  assert.notEqual(highHeader, originalGeometry);
  const highFunctions = pureModuleProbe(highHeader, 'HeaderHighMutant.ts', { ...actor, ...replaceGeometry }, headerExports);
  assert.throws(() => sample('directory', 364, 1, 1, source, highFunctions), /original30/, 'old44 paint floor is rejected');
  const missingCaret = source.replace("if (this.headerRole() === 'ttsMake') {", 'if (false) {');
  assert.notEqual(missingCaret, source);
  assert.throws(() => sample('tts', 364, 1, 1, missingCaret), /own12 chevron/, 'missing TTS glyph is rejected');
  const wrongLabel = bodySource.replace('measureReaderControlText(context, readerControlHeaderActionLabel(module), actionStyle, width)',
    "measureReaderControlText(context, '收起', actionStyle, width)");
  assert.notEqual(wrongLabel, bodySource);
  assert.throws(() => sample('replace', 364, 1, 1, source, headerGeometry, wrongLabel), /actual complete action/, 'generic replacement action measurement is rejected');
  const wholeCap = source.replace('return readerControlHeaderGrabRegions(cap, this.headerActionInputEnabled() ? this.headerActionFrame() : undefined);', 'return [cap];');
  assert.notEqual(wholeCap, source);
  assert.throws(() => sample('directory', 364, 1, 1, wholeCap), /cannot own any part/, 'old full-width cap overlap is rejected');
  const unpaid = source.replace('}.width(this.headerActionFrame().width).height(this.headerActionFrame().height).padding(0)',
    '}.width(this.headerActionFrame().width).height(this.headerFrame().height).padding(0)');
  assert.notEqual(unpaid, source);
  assert.throws(() => sample('directory', 364, 1, 1, unpaid), /vertical carrier/, 'declaring a30-high native action is rejected');
  const inheritedZero = source.replace('.attributeModifier(new ReaderControlHeaderLineHeight(this.headerActionStyle().lineHeightFp))',
    '.lineHeight(this.headerActionStyle().lineHeightFp ?? 0)');
  assert.notEqual(inheritedZero, source);
  assert.throws(() => sample('replace', 364, 1, 1, inheritedZero), /inherited Replace action line height/,
    'undefined inherited line height cannot be replaced with zero');
  console.log('PASS header-roles-sdk: 8 original canonical roles +192 adaptive SDK samples, actual role measurement, independent native carriers, one native cap response array and real Runtime Down→held→Up/Cancel retention, cap/central target exclusion,5 geometric mutants + import negative; no native hit/pixel simulation');
}

for (const id of selectContractCases(cases)) {
  if (id === 'live-topbar-input') {
    const verify = (text = source) => {
      const f = fixture(text); let live = true; f.owner.inputCurrent = () => live;
      f.owner.topBarBack(); f.owner.topBarActions();
      const callbacks = ['退出阅读，返回上一页', '换源', '更多'].map(label => f.button(label).onClick);
      live = false; callbacks.forEach(callback => callback());
      assert.deepEqual(f.events, [], 'live root retires every first topbar action before retained Props update');
      live = true; callbacks.forEach(callback => callback());
      assert.deepEqual(f.events, ['exit', ['source', sourceSwitchTriggerFocusId('source', 'book', 'reader-control')], ['more', true]],
        'the same opening recovers without remounting or accepting a successor owner');
      f.owner.controlOpenRevision = 99; callbacks.forEach(callback => callback());
      assert.equal(f.events.length, 3, 'old opening remains retired');
    };
    verify();
    const before = 'return this.runtimeMounted && this.inputEnabled && (this.inputCurrent?.() ?? true) && !this.controlObscured &&';
    const start = source.indexOf('  private topBarInputEnabled()');
    const old = source.slice(0, start) + source.slice(start).replace(before, 'return this.runtimeMounted && this.inputEnabled && !this.controlObscured &&');
    assert.notEqual(old, source); assert.throws(() => verify(old), /live root retires/);
  }
  else if (id === 'header-roles-sdk') await runHeaderRoles();
  else if (id === 'input-admission') {
    const count = runInput();
    const oldHome = source.replace('if (!this.progressInputEnabled()) return;', 'if (!this.runtimeMounted || !this.contentInputEnabled()) return;');
    assert.notEqual(oldHome, source); assert.throws(() => runInput(oldHome), /retained Home callbacks/);
    const oldRail = source.replace('!this.moreMenuVisible && this.frame().brightness.opacity > 0', 'this.frame().brightness.opacity > 0');
    assert.notEqual(oldRail, source); assert.throws(() => runInput(oldRail), /retained brightness callbacks/);
    for (const [name, before, after] of [
      ['update', '.onActionUpdate(this.brightnessGestureHandler(', '.onActionUpdate(('],
      ['end', '.onActionEnd(this.brightnessGestureHandler(', '.onActionEnd(('],
      ['cancel', '.onActionCancel(this.controlActionHandler(', '.onActionCancel(('],
    ]) {
      const unscoped = source.replace(before, after);
      assert.notEqual(unscoped, source, 'the ' + name + ' guard source mutant applies');
      assert.throws(() => runBrightnessGestureRetirement(unscoped), /old registered Pan .*active successor/);
    }
    console.log(`PASS shared current owner admission: ${count} blocked Home states, 10 blocked rail states, six public-action categories across three successor axes, retained IconButton scope, same-owner drag cancellation and old registered Pan update/end/cancel rejection after successor drag start; five source mutants`);
  } else {
    const make = readFileSync(new URL('./fixtures/tts-reference/PhoneScreen.tsx', import.meta.url));
    assert.equal(createHash('sha256').update(make).digest('hex'), '731582c1ac493d48f1ebdaae1e5527de5dfe3f391d37d8c85a51643ce72b4a3c');
    assert.match(make.toString(), /Noto_Sans_SC:Black.*font-black leading-\[13\.889px\].*text-\[10px\]/);
    const role = readerTypographyRoles.TYPE_READER_CONTROLS_RETAINED_MODULE_BUTTON_LABEL;
    assert.deepEqual([role.fontFamily, role.fontWeight, role.fontSizeFp, role.lineHeightFp], ['ReaderNotoSansSC', 900, 10, 13.889]);
    for (const scheme of ['day', 'night']) for (const [icon, label, module] of [
      ['rc_list', '目录', 'directory'], ['rc_headphones', '朗读', 'tts'], ['rc_palette', '界面', 'appearance'], ['rc_settings', '设置', 'settings'],
    ]) for (const active of [false, true]) {
      const f = fixture(); f.owner.appScheme = scheme;
      if (active) f.owner.lastVisibleContentLocation = { level: 'secondary', module, form: 'quick' };
      f.owner.moduleButton(icon, label, module);
      const button = f.button(label), text = f.nodes().find(node => node.create === label), image = f.nodes().find(node => node.type === 'Image');
      assert.equal(button.height, 62); assert.equal(button.padding, 0);
      assert.deepEqual([text.fontFamily, text.fontWeight, text.fontSize, text.lineHeight, text.height], ['ReaderNotoSansSC', [900, { enableVariableFontWeight: true }], 10, 13.889, 13.889]);
      assert.deepEqual(f.owner.attributeCalls.findLast(call => call.id === text.id && call.property === 'fontWeight')?.args, [900, { enableVariableFontWeight: true }]);
      assert.deepEqual([image.width, image.height], [24, 24]);
      assert.ok(f.nodes().some(node => node.type === 'Stack' && node.width === 42 && node.height === 42 && node.borderRadius === 21));
    }
    const chapter = fixture(); chapter.owner.chapterRow();
    for (const label of ['上一章', '下一章']) {
      const button = chapter.button(label); assert.deepEqual([button.width, button.height], [34, 34]);
      assert.deepEqual(button.responseRegion, { x: -5, y: -5, width: 44, height: 44 }, 'chapter paint remains34 with its independent paid44 response');
    }
    assert.equal(chapter.nodes().find(node => node.type === 'Row').height, 54);
    assert.ok(chapter.nodes().filter(node => node.type === 'Image').every(node => node.width === 20 && node.height === 20));
    assert.ok(chapter.owner.homeChapterCardHeight() >= 106, 'fallback card pays54 chapter and50 progress rows plus its two native borders');
    const progress = fixture(); progress.owner.progressRow();
    assert.equal(progress.nodes().find(node => node.type === 'Row').height, 50);
    assert.equal(progress.nodes().find(node => node.type === 'Slider').height, 44);
    assert.equal(progress.owner.homeContentMinimumHeight(), 187.438, 'same fallback minimum pays both rows, native card border2, quick-action lane and gap6');
    const oldFallback = source.replaceAll("this.homeMetric('chapterRowHeight', Math.max(54, READER_CONTROL_HOME_CHAPTER_ROW_HEIGHT))", "this.homeMetric('chapterRowHeight', READER_CONTROL_HOME_CHAPTER_ROW_HEIGHT)");
    assert.notEqual(oldFallback, source); const unpaid = fixture(oldFallback); unpaid.owner.chapterRow();
    assert.ok(unpaid.nodes().find(node => node.type === 'Row').height - 10 < 44, 'former missing-profile chapter fallback is an actual unpaid SDK negative');
    const bar = fixture(); bar.owner.topBarBack(); bar.owner.topBarActions();
    assert.deepEqual([bar.button('退出阅读，返回上一页').width, bar.button('退出阅读，返回上一页').height], [44, 44]);
    assert.deepEqual([bar.button('换源').width, bar.button('换源').height], [62, 44]);
    assert.deepEqual([bar.button('更多').width, bar.button('更多').height], [44, 44]);
    const shortBar = fixture(); shortBar.owner.layout.topBarVisible = false; shortBar.owner.shortWindowActions();
    const sourceText = shortBar.nodes().find(node => node.create === '换源');
    assert.deepEqual([sourceText.fontFamily, sourceText.fontWeight, sourceText.fontSize, sourceText.lineHeight],
      ['ReaderNotoSansSC', [700, { enableVariableFontWeight: true }], 12, 14.4]);
    assert.deepEqual([shortBar.button('换源').width, shortBar.button('换源').height], [76, 44]);
    const home = fixture(); home.owner.quickActionPanel();
    for (const label of ['搜索', '自动翻页', '替换']) assert.equal(home.button(label).height, 55.438);
    assert.equal(home.nodes().find(node => node.type === 'Row').height, 75.438);
    const rail = fixture(); rail.owner.brightnessRailContent();
    const auto = rail.button('手动亮度，点击跟随系统'); assert.deepEqual([auto.width, auto.height], [44, 44]);
    assert.ok(rail.nodes().some(node => node.type === 'Stack' && node.width === 8 && node.clip === true), 'inner brightness track remains a real fill crop');
    const header = fixture(); header.owner.lastVisibleContentLocation = { level: 'secondary', module: 'directory', form: 'full' }; header.owner.controlHeader(); header.owner.headerAction();
    const collapse = header.nodes().find(node => node.id === 'reader-control-collapse'); assert.deepEqual([collapse.width, collapse.height], [44, 44]);
    assert.ok(header.nodes().some(node => node.type === 'Stack' && node.width === 40 && node.height === 26), 'visible 40×26 collapse paint remains distinct from its 44 hit carrier');
    console.log('PASS shared approved elements: frozen MakeV17 Black nav, 16 theme/active nav samples, unchanged 24/42/62 glyph-circle-button roles, 55.438 Home action, 44 A and 40×26 collapse paint');
  }
  recordContractCasePass(id);
}
