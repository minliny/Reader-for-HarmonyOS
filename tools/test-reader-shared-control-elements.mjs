import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
import * as geometry from '../entry/src/main/ets/features/reading/ui/ReaderControlGeometry.ts';
import * as session from '../entry/src/main/ets/features/reading/ui/ReaderControlSessionState.ts';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { readerMotionValueDurationMs } from '../entry/src/main/ets/ui/foundation/ReaderMotionDurationPolicy.ts';
import { sourceSwitchTriggerFocusId } from '../entry/src/main/ets/features/source/presentation/SourceSwitchSurfaceLifecycle.ts';

const cases = {
  'input-admission': { description: 'Actual shared control SDK callbacks reject hidden, retired, temporary and successor module inputs while preserving current actions', resources: [] },
  'approved-elements': { description: 'Actual shared Home/nav/brightness/header paint and hit roles against frozen Make V17 and explicit accessible carrier successors', resources: [] },
};
const file = new URL('../entry/src/main/ets/features/reading/ui/ReaderControlPanel.ets', import.meta.url);
const source = readFileSync(file, 'utf8');
const { readerControlMotionMs } = pureModuleProbe(readFileSync(new URL('../entry/src/main/ets/features/reading/ui/ReaderControlMotionPolicy.ts', import.meta.url), 'utf8').replace(/export \{[^}]+\} from '[^']+';/g, ''), 'ReaderControlMotionPolicy.ts', { readerMotionValueDurationMs }, ['readerControlMotionMs']);
const names = ['secondaryModuleInputEnabled', 'contentLocation', 'contentInputEnabled', 'controlActionInputEnabled', 'progressInputEnabled', 'brightnessInputEnabled',
  'homeChapterCardHeight', 'homeContentMinimumHeight', 'progressRow', 'effectiveProgressPercent', 'progressChangeHandler', 'clampPercent', 'quickAction', 'quickActionPanel', 'quickActionIcon', 'chapterRow', 'canStepChapter', 'homeMetric',
  'moduleButton', 'moduleNavBar', 'moduleIcon', 'isActiveModule', 'activateModule', 'requestPage',
  'accessibleBrightnessActions', 'stepBrightness', 'navigationInputEnabled', 'brightnessRailContent', 'brightnessContentHeight', 'brightnessTrackHeight', 'brightnessRequiresChildClip',
  'beginBrightnessDrag', 'updateBrightnessDrag', 'finishBrightnessDrag', 'cancelBrightnessDrag', 'commitBrightnessTap',
  'effectiveBrightnessPercent', 'clampBrightness', 'roundBrightness', 'collapseControl', 'accessibleControlActions',
  'controlHeader', 'headerInter', 'headerIcon', 'topBarInputEnabled', 'topBarBack', 'topBarActions', 'sourceActionHeight',
  'shortWindowActions', 'shortWindowActionInput'];
const compiled = new Map();
const gesture = new Proxy({}, { get: () => () => gesture });
const gestures = { PanGesture: gesture, TapGesture: gesture, GestureGroup: gesture,
  PanDirection: { Vertical: 'vertical' }, GestureMode: { Exclusive: 'exclusive' }, GesturePriority: { Low: 'low' },
  globalThis: { Gesture: gesture, GestureGroup: gesture, PanGesture: gesture, TapGesture: gesture } };
function fixture(text = source) {
  const events = [];
  if (!compiled.has(text)) compiled.set(text, createReaderBuilderProbe(text, names, { ...geometry, ...session, ...gestures, readerControlMotionMs,
    sourceSwitchTriggerFocusId, ScrollDirection: { Horizontal: 'horizontal' }, READER_CONTROL_EXPAND_MS: 320 }).Component);
  const Component = compiled.get(text);
  const owner = new Component(undefined, {});
  Object.assign(owner, {
    runtimeMounted: true, inputEnabled: true, controlObscured: false, temporaryLayerActive: false, moreMenuVisible: false,
    visualVisibilityProgress: 1, visualHeldPointerId: -1, visualTransitionKind: '', visualExpansionProgress: 0,
    lastVisibleContentLocation: { level: 'home', module: 'home', form: 'quick', directoryTab: 'directory' },
    visualSession: session.openReaderControlSession(session.createReaderControlSessionState(), 0), reduceMotion: false,
    appScheme: 'day', bookTitle: '书名', chapterTitle: '章节', sourceId: 'source', sourceBookId: 'book',
    readableChapterPosition: 1, currentChapterIndex: 1, totalChapters: 3, tocEntries: [],
    minimumIdentity: '', brightnessAutomatic: false, brightnessPercent: 50, brightnessPreviewPercent: -1,
    brightnessDragging: false, brightnessLastEmittedPercent: -1, progressPercent: 50, progressPreviewPercent: -1, progressInputRevision: 1,
    layout: { viewportWidth: 366, topBarVisible: true, topBarHeight: 54, contentBudget: undefined },
    geo: { moduleNavH: 80, moduleNavRadiusTop: 14 },
    ttsState: { status: 'unavailable' }, selectedMinimumProfile: () => undefined,
    minimumInputReady: () => true, hasCurrentTemporaryInput: () => false,
    frame: () => ({ visibility: 1, progress: 0, content: { width: 264 }, topBar: { opacity: 1 },
      brightness: { width: 46, height: 190, opacity: 1 }, navigation: { opacity: 1 } }),
    headerFrame: () => ({ width: 312, height: 44, x: 0, y: 0 }), contentTitle: () => '目录',
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
  function nodes(parent = owner) { return [...parent.nodes.values(), ...[...parent.children.values()].flatMap(nodes)]; }
  return { owner, events, nodes, button: label => nodes().findLast(node => node.type === 'Button' && node.accessibilityText === label) };
}

function homeHandlers(f) {
  f.owner.chapterRow(); f.owner.quickActionPanel();
  return ['上一章', '下一章', '搜索', '自动翻页', '替换'].map(label => {
    const node = f.button(label); assert.ok(node?.onClick, `actual ${label} SDK Button callback exists`); return node.onClick;
  });
}
function runInput(text = source) {
  const f = fixture(text), callbacks = homeHandlers(f);
  callbacks.forEach(callback => callback());
  assert.deepEqual(f.events, ['previous', 'next', 'search', 'autoPage', 'replace']);
  const blocked = [
    owner => { owner.runtimeMounted = false; },
    owner => { owner.inputEnabled = false; },
    owner => { owner.controlObscured = true; },
    owner => { owner.temporaryLayerActive = true; },
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
    child.owner.temporaryLayerActive = true; assert.equal(child.owner.secondaryModuleInputEnabled(module), true, 'the current module retains its own editor');
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
  for (const key of ['temporaryLayerActive', 'moreMenuVisible']) {
    short.owner[key] = true; shortExit(); shortSource(); assert.deepEqual(short.events, [], 'old short-window ordinary actions cannot pass the explicit temporary/More guards'); short.owner[key] = false;
  }
  shortExit(); assert.deepEqual(short.events, ['exit']);
  short.owner.moreMenuVisible = true; short.button('更多').onClick(); assert.deepEqual(short.events.at(-1), ['more', false], 'the current popup trigger still closes its own menu');
  const a11y = fixture(text); a11y.owner.accessibleControlActions();
  const close = a11y.nodes().find(node => node.create === '关闭控制栏并返回阅读'); assert.ok(close.onClick);
  a11y.owner.temporaryLayerActive = true; close.onClick(); assert.deepEqual(a11y.events, []);
  a11y.owner.temporaryLayerActive = false; close.onClick(); assert.deepEqual(a11y.events, ['dismiss']);
  const full = fixture(text); full.owner.lastVisibleContentLocation = { level: 'secondary', module: 'directory', form: 'full' };
  full.owner.visualTransitionKind = 'morph'; full.owner.collapseControl();
  assert.equal(full.events[0][0], 'session', 'the current visible secondary still retargets collapse during its morph');
  full.owner.moreMenuVisible = true; full.owner.collapseControl(); assert.equal(full.events.length, 1);
  const hidden = fixture(text); hidden.owner.topBarBack(); const exit = hidden.button('退出阅读，返回上一页');
  hidden.owner.visualVisibilityProgress = 0; hidden.owner.frame = () => ({ topBar: { opacity: 0 } }); exit.onClick();
  assert.deepEqual(hidden.events, [], 'hidden top bar cannot dispatch a retained Back callback');
  const obscured = fixture(text); obscured.owner.topBarActions(); const source = obscured.button('换源').onClick, more = obscured.button('更多').onClick;
  obscured.owner.controlObscured = true; source(); more(); assert.deepEqual(obscured.events, [], 'obscured top bar rejects retained source and More callbacks');
  assert.equal(obscured.owner.topBarInputEnabled(), false);
  return blocked.length;
}

for (const id of selectContractCases(cases)) {
  if (id === 'input-admission') {
    const count = runInput();
    const oldHome = source.replace('if (!this.progressInputEnabled()) return;', 'if (!this.runtimeMounted || !this.contentInputEnabled()) return;');
    assert.notEqual(oldHome, source); assert.throws(() => runInput(oldHome), /retained Home callbacks/);
    const oldRail = source.replace('!this.moreMenuVisible && this.frame().brightness.opacity > 0', 'this.frame().brightness.opacity > 0');
    assert.notEqual(oldRail, source); assert.throws(() => runInput(oldRail), /retained brightness callbacks/);
    console.log(`PASS shared current owner admission: ${count} blocked Home states, 10 blocked rail states, active drag cancellation, accessible close, mid-flight collapse and two source mutants`);
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
    assert.ok(chapter.owner.homeChapterCardHeight() >= 104, 'fallback card pays54 chapter and50 progress rows');
    const progress = fixture(); progress.owner.progressRow();
    assert.equal(progress.nodes().find(node => node.type === 'Row').height, 50);
    assert.equal(progress.nodes().find(node => node.type === 'Slider').height, 44);
    assert.equal(progress.owner.homeContentMinimumHeight(), 185.438, 'same fallback minimum pays both rows, the original quick-action lane and its6gap');
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
    const header = fixture(); header.owner.lastVisibleContentLocation = { level: 'secondary', module: 'directory', form: 'full' }; header.owner.controlHeader();
    const collapse = header.nodes().find(node => node.id === 'reader-control-collapse'); assert.deepEqual([collapse.width, collapse.height], [44, 44]);
    assert.ok(header.nodes().some(node => node.type === 'Stack' && node.width === 40 && node.height === 26), 'visible 40×26 collapse paint remains distinct from its 44 hit carrier');
    console.log('PASS shared approved elements: frozen MakeV17 Black nav, 16 theme/active nav samples, unchanged 24/42/62 glyph-circle-button roles, 55.438 Home action, 44 A and 40×26 collapse paint');
  }
  recordContractCasePass(id);
}
