import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { installedEtsCompiler } from './lib/ets-compiler-runtime.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { readerTypographyRoles, readerMessageStyles } from './lib/reader-typography-probe.mjs';
import { selectedProductionClasses } from './lib/selected-production-methods.mjs';
import { readerAppColor } from '../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts';
import * as ttsState from '../entry/src/main/ets/features/reading/application/ReaderTtsState.ts';
import * as controlGeometry from '../entry/src/main/ets/features/reading/ui/ReaderControlGeometry.ts';
import * as playbackGeometry from '../entry/src/main/ets/features/reading/ui/ReaderControlPlaybackGeometry.ts';
import { readerControlLerp } from '../entry/src/main/ets/features/reading/ui/ReaderControlActorGeometry.ts';

const cases = {
  'finite-pill': {
    description: 'Reading native pill inputs use SDK Capsule or finite paint-box radii with retained geometry and action admission',
    resources: [],
  },
};
const { ts, options, root: sdkRoot } = installedEtsCompiler();
const source = file => readFileSync(new URL('../entry/src/main/ets/features/reading/ui/' + file, import.meta.url), 'utf8');
const compact = text => text?.replace(/\s/g, '');

function radiusSites(text, file) {
  const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  assert.deepEqual(tree.parseDiagnostics, [], `${file} parses with the installed SDK`);
  const sites = [];
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression?.name?.text === 'borderRadius') {
      assert.ok(!/\b(?:999|TOK_RADIUS_PILL)\b/.test(node.arguments[0].getText(tree)), `${file} has no raw pill radius input`);
      const attributes = new Map();
      let base = node;
      while (base.expression && ts.isPropertyAccessExpression(base.expression)) {
        attributes.set(base.expression.name.text, base.arguments.map(argument => argument.getText(tree)));
        base = base.expression.expression;
      }
      if (base.kind === ts.SyntaxKind.EtsComponentExpression) {
        let method = node.parent;
        while (method && !ts.isMethodDeclaration(method)) method = method.parent;
        sites.push({ method: method.name.getText(tree), base: base.expression.getText(tree),
          width: compact(attributes.get('width')?.[0]), height: compact(attributes.get('height')?.[0]),
          expression: node.arguments[0].getText(tree) });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return { tree, sites };
}

function evaluate(expression, owner, bindings = {}, args = {}) {
  const code = ts.transpileModule(`function value(){return ${expression};}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.None },
  }).outputText;
  const scope = { ...controlGeometry, ...bindings, ...args };
  return new Function(...Object.keys(scope), code + ';return value;')(...Object.values(scope)).call(owner);
}

for (const id of selectContractCases(cases)) {
  const files = ['FullDirectoryPanel.ets', 'ReaderControlDirectoryContent.ets', 'ReaderControlPanel.ets',
    'ReaderControlSwitchTrack.ets', 'ReaderControlTtsContent.ets', 'ReaderDirectoryChapterRow.ets',
    'ReaderDirectoryNavigationList.ets', 'ReaderSessionCapsule.ets', 'ReaderTtsConfigOverlay.ets'];
  const parsed = new Map(files.map(file => [file, radiusSites(source(file), file)]));
  assert.throws(() => radiusSites(source('ReaderControlSwitchTrack.ets').replace(
    '.borderRadius(Math.min(this.trackWidth, this.trackHeight) / 2)', '.borderRadius(999)'), 'old-radius.ets'),
  /no raw pill radius/, 'the former raw native input is rejected');

  // Nineteen non-Button sites have explicit dimensions. The remaining natural
  // status chip is verified below through its real measurement-return path.
  // boxes, including thin indicators, rather than the enclosing 44vp carriers.
  const targets = [
    ['FullDirectoryPanel.ets', 'standalonePanel', '42', '4', () => [42, 4]],
    ['FullDirectoryPanel.ets', 'directoryTabContent', 'this.activeTabLineWidth()', '2', o => [o.line, 2]],
    ['FullDirectoryPanel.ets', 'bookmarkTabContent', 'this.activeTabLineWidth()', '2', o => [o.line, 2]],
    ['ReaderControlDirectoryContent.ets', 'tabButton', "'52%'", '2', o => [o.tabWidth * .52, 2]],
    ['ReaderControlPanel.ets', 'brightnessRailContent', 'READER_CONTROL_BRIGHTNESS_RAIL_WIDTH', 'this.brightnessContentHeight()',
      o => [controlGeometry.READER_CONTROL_BRIGHTNESS_RAIL_WIDTH, o.railHeight]],
    ['ReaderControlPanel.ets', 'brightnessRailContent',
      'this.layout.contentBudget?.brightnessAutoWidthVp??READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE',
      'this.layout.contentBudget?.brightnessAutoHeightVp??READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE',
      o => [o.layout.contentBudget.brightnessAutoWidthVp, o.layout.contentBudget.brightnessAutoHeightVp]],
    ['ReaderControlPanel.ets', 'moduleButton', '42', '42', () => [42, 42]],
    ['ReaderControlSwitchTrack.ets', 'build', 'this.trackWidth', 'this.trackHeight', o => [o.trackWidth, o.trackHeight]],
    ['ReaderControlTtsContent.ets', 'moduleHeader', '5', '5', () => [5, 5]],
    ['ReaderControlTtsContent.ets', 'roundControl', "'100%'", "'100%'", o => [o.transportRect.width, o.transportRect.height]],
    ['ReaderControlTtsContent.ets', 'speed', 'this.frame().speedTrack.width', 'this.frame().speedTrack.height', o => [o.geometry.speedTrack.width, o.geometry.speedTrack.height]],
    ['ReaderControlTtsContent.ets', 'speed', 'this.frame().speedThumb.x+9-this.frame().speedTrack.x', 'this.frame().speedTrack.height',
      o => [o.geometry.speedThumb.x + 9 - o.geometry.speedTrack.x, o.geometry.speedTrack.height]],
    ['ReaderControlTtsContent.ets', 'speed', '18', '18', () => [18, 18]],
    ['ReaderControlTtsContent.ets', 'ttsSelectValueField', 'this.textMinimum()?.voiceBadgeWidth??24', 'this.textMinimum()?.voiceBadge??24',
      o => [o.minimum.voiceBadgeWidth, o.minimum.voiceBadge]],
    ['ReaderDirectoryChapterRow.ets', 'build', '3', 'Math.max(44,this.rowHeight)', o => [3, Math.max(44, o.rowHeight)]],
    ['ReaderDirectoryNavigationList.ets', 'row', '3', 'Math.max(44,this.rowHeight)', o => [3, Math.max(44, o.rowHeight)]],
    ['ReaderSessionCapsule.ets', 'build', 'this.countdownSize', 'this.countdownSize', o => [o.countdownSize, o.countdownSize]],
    ['ReaderSessionCapsule.ets', 'build', '16', '16', () => [16, 16]],
    ['ReaderTtsConfigOverlay.ets', 'choiceRow', '34', '34', () => [34, 34]],
  ];
  assert.equal(targets.length, 19);
  let paintSamples = 0;
  for (const scale of [1, 1.3, 1.6, 2]) for (const progress of [0, .25, .5, .75, 1]) {
    const owner = {
      line: 83 + 93 * progress, tabWidth: 127 + 33 * progress, railHeight: 160 + 90 * progress,
      layout: { contentBudget: { brightnessAutoWidthVp: 28 * scale, brightnessAutoHeightVp: 28 * scale } },
      trackWidth: 42, trackHeight: 24, rowHeight: 44 * scale, countdownSize: 16 * scale, headerWidth: 286,
      minimum: { header: 18 * scale, voiceBadgeWidth: 24 * scale, voiceBadge: 24 * scale },
      transportRect: { width: 32 + 18 * progress, height: 32 + 10 * progress },
      geometry: { speedTrack: { width: 242, height: 4, x: 16 }, speedThumb: { x: 16 + 242 * progress } },
      activeTabLineWidth() { return this.line; }, brightnessContentHeight() { return this.railHeight; },
      textMinimum() { return this.minimum; }, headerActor() { return { width: this.headerWidth }; },
      transport() { return this.transportRect; }, frame() { return this.geometry; },
    };
    for (const [file, method, width, height, dimensions] of targets) {
      const matches = parsed.get(file).sites.filter(site => site.method === method && site.width === width && site.height === height);
      assert.equal(matches.length, 1, `${file}.${method} has one exact original paint box ${width}x${height}`);
      const actual = evaluate(matches[0].expression, owner, {}, { kind: 'toggle' });
      const [w, h] = dimensions(owner);
      assert.equal(actual, Math.min(w, h) / 2, `${file}.${method} uses its paint-box radius`);
      assert.ok(Number.isFinite(actual) && actual >= 0 && actual <= Math.min(w, h) / 2);
      paintSamples++;
    }
  }

  const sdkButton = readFileSync(resolve(sdkRoot, '../../component/button.d.ts'), 'utf8');
  assert.match(sdkButton, /Capsule\*\* type[\s\S]*?radius[\s\S]*?half of the button height or width, whichever is smaller/);
  const sdkTree = ts.createSourceFile('button.d.ts', sdkButton, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS, options);
  const buttonEnum = sdkTree.statements.find(node => ts.isEnumDeclaration(node) && node.name.text === 'ButtonType');
  assert.ok(buttonEnum.members.some(member => member.name.text === 'Capsule'), 'Capsule is an installed SDK ButtonType enum member');
  const tts = source('ReaderControlTtsContent.ets');
  const typography = selectedProductionClasses(new URL('../entry/src/main/ets/ui/foundation/ReaderTypography.ets', import.meta.url),
    ['ReaderTextStyle', 'ReaderInheritedTextStyle']);
  const textMeasurement = pureModuleProbe(source('ReaderControlTextMeasurement.ets'), 'ReaderControlTextMeasurement.ets',
    { WordBreak: { BREAK_WORD: 'break' } }, ['measureReaderControlText']);
  const minimum = pureModuleProbe(source('ReaderControlTtsMinimum.ets'), 'ReaderControlTtsMinimum.ets', {
    ...readerTypographyRoles, ...readerMessageStyles, ...typography, ...textMeasurement, ...playbackGeometry, readerControlLerp,
  }, ['measureReaderTtsMinimum', 'sampleReaderTtsTextMinimum']);
  let headerSamples = 0;
  for (const scale of [1, 2]) for (const status of ['未开始', '正在检查朗读可用性']) for (const maxCap of [14, 128]) {
    const calls = [];
    const extent = options => [...options.textContent].length * Number.parseFloat(options.fontSize) * scale;
    const context = { px2vp: value => value, getMeasureUtils: () => ({
      measureText(options) { calls.push(options); return extent(options); },
      measureTextSize: options => ({ width: Math.min(options.constraintWidth, extent(options)),
        height: Number.parseFloat(options.lineHeight ?? options.fontSize) * scale * (options.lineHeight ? 1 : 1.5) }),
    }) };
    const facts = { playbackLabel: '朗读内容', status, voice: '系统女声', timerCaption: '不开启', timerSummary: '00:00',
      minutes: '00', seconds: '00', rate: '1.00x', error: '', seek: false, online: false, serviceDescription: '设备内置语音',
      manageLabel: '立即配置', engineValue: '系统语音', languageValue: '中文普通话', failureValue: '停止并提示' };
    const profile = minimum.measureReaderTtsMinimum(context,
      { panelWidthVp: 364, quickContentWidthVp: 286, fullContentWidthVp: 338 }, facts);
    assert.ok(profile);
    const statusCalls = calls.filter(options => options.textContent === status);
    assert.equal(statusCalls.length, 2, 'both real quick/full forms measure the current status');
    for (const options of statusCalls) {
      assert.equal(options.fontFamily, 'ReaderNotoSansSCUIMedium');
      assert.equal(options.fontSize, 10); assert.equal(options.lineHeight, '14fp');
    }
    const measuredStatusWidth = [...status].length * 10 * scale;
    for (const progress of [0, .5, 1]) {
      const text = minimum.sampleReaderTtsTextMinimum(profile, progress);
      assert.equal(text.playbackMetaWidth, measuredStatusWidth, 'the current status width crosses the real minimum/interpolation path');
      for (const kind of ['playback', 'timer', 'speed']) {
        const { owner: header } = createReaderBuilderProbe(tts, ['moduleHeader', 'headerMetaRadius'],
          { ...readerTypographyRoles, readerAppColor });
        Object.assign(header, { appScheme: 'day', textMinimum: () => text,
          headerActor: () => ({ width: maxCap / .45, height: text.header, x: 0, y: 0, opacity: 1 }),
          headerMeta: () => kind === 'playback' ? status : kind === 'timer' ? '00:00' : '1.00x',
          isActivelySpeaking: () => false, timerMode: 'off' });
        header.moduleHeader(kind);
        const paint = [...header.nodes.values()].find(node => node.type === 'Row' && node.width === undefined && node.borderRadius !== undefined);
        assert.ok(paint);
        const expected = kind === 'playback' ? Math.min(text.header, maxCap, measuredStatusWidth + 26) / 2 : 0;
        assert.equal(paint.borderRadius, expected);
        headerSamples++;
      }
    }
    // Native measurement is an explicit port. This adversarial narrow receipt
    // demonstrates why maxWidth cannot substitute for the natural status width.
    const narrowContext = { ...context, getMeasureUtils: () => ({
      ...context.getMeasureUtils(), measureText: options => options.textContent === status ? 1 : extent(options),
    }) };
    const narrowProfile = minimum.measureReaderTtsMinimum(narrowContext,
      { panelWidthVp: 364, quickContentWidthVp: 286, fullContentWidthVp: 338 }, facts);
    const narrow = minimum.sampleReaderTtsTextMinimum(narrowProfile, 1);
    assert.equal(narrow.playbackMetaWidth, 1);
    const { owner: shortHeader } = createReaderBuilderProbe(tts, ['headerMetaRadius'], {});
    Object.assign(shortHeader, { textMinimum: () => narrow, headerActor: () => ({ width: 128 / .45 }) });
    assert.equal(shortHeader.headerMetaRadius('playback'), Math.min(narrow.header, 27, 128) / 2);
    delete narrow.playbackMetaWidth;
    const partial = minimum.sampleReaderTtsTextMinimum({ ...narrowProfile, quickText: narrow, fullText: narrow }, .5);
    assert.equal(partial.playbackMetaWidth, 0, 'old partial minimum fields have a finite zero-width fallback');
    shortHeader.textMinimum = () => partial;
    assert.equal(shortHeader.headerMetaRadius('playback'), Math.min(partial.header, 26, 128) / 2);
    shortHeader.textMinimum = () => undefined;
    assert.equal(shortHeader.headerMetaRadius('playback'), 9, 'pre-minimum fallback retains finite existing paint allowances');
  }
  const methods = ['roundControl', 'timer', 'timerStepButton', 'ttsSelectValueField', 'toggleRow', 'onlineServiceInfoRow'];
  const { tree } = parsed.get('ReaderControlTtsContent.ets');
  const ownerType = tree.statements.find(node => node.members && node.name?.text === 'ReaderControlTtsContent');
  for (const method of methods) {
    const text = ownerType.members.find(member => member.name?.getText(tree) === method).getText(tree);
    assert.equal((text.match(/Button\(\{ type: ButtonType.Capsule, stateEffect: false \}\)/g) ?? []).length, 1,
      `${method} has one stable Capsule constructor`);
    assert.doesNotMatch(text, /ButtonType.Normal|\.borderRadius\(999\)/);
  }
  const callbacks = [];
  const { readerTtsPlayGradientStart } = pureModuleProbe(source('ReaderControlTtsStyle.ts'),
    'ReaderControlTtsStyle.ts', { readerAppColor }, ['readerTtsPlayGradientStart']);
  const { owner } = createReaderBuilderProbe(tts, methods, {
    ...readerTypographyRoles, ...ttsState, readerAppColor, readerTtsPlayGradientStart, ScrollDirection: { Horizontal: 'horizontal' },
  });
  const rect = { width: 130, height: 44, x: 0, y: 0, opacity: 1 };
  let nativeMinimum;
  const geometry = new Proxy({}, { get: () => rect });
  Object.assign(owner, {
    appScheme: 'day', serviceBusy: false, state: { status: 'speaking' }, httpEngines: [], configFocusId: 'config',
    timerMinutes: 1, timerSeconds: 20, configField: '',
    textMinimum: () => nativeMinimum, p: () => 0, transport: () => rect, frame: () => geometry,
    sharedInput: () => owner.admitted, fullInput: () => owner.admitted, admitted: true,
    isActivelySpeaking: () => false, onlineServicePage: () => false, isHttpEngineSelected: () => false,
    hasActiveQueue: () => true, controlText: kind => kind, currentVoiceLabel: () => '女声',
    fieldWidth: () => rect.width, fieldHeight: () => rect.height, fieldValue: () => '女声', fieldLabel: () => '音色',
    toggleLabel: () => '跟随高亮', toggleValue: () => true, changeToggle: kind => { if (owner.admitted) callbacks.push(kind); },
    sectionSurface() {}, moduleHeader() {}, quickLabel() {}, timerPreset() {}, timerStepper() {},
    timerCaption: () => '不开启', presentation: () => ({ contentOpacity: 1, contentBlur: 0 }),
    sharedScrollTranslation: () => 0, sharedClip: () => undefined,
    cycleQuickTimer: () => { if (owner.admitted) callbacks.push('timer'); },
    stepTimer: () => callbacks.push('step'), openConfiguration: kind => { if (owner.admitted) callbacks.push(kind); },
    onPrevious: () => callbacks.push('previous'), onNext: () => callbacks.push('next'), onStop: () => callbacks.push('stop'), onToggle: () => callbacks.push('toggle'),
  });
  owner.roundControl('toggle'); owner.timer(); owner.timerStepButton(false, 5);
  owner.ttsSelectValueField('voice'); owner.toggleRow('followHighlight'); owner.onlineServiceInfoRow();
  const buttons = () => [...owner.nodes.values()].filter(node => node.type === 'Button');
  assert.equal(buttons().length, 6);
  for (const button of buttons()) {
    assert.deepEqual(button.createWithChild, { type: 'ButtonType.Capsule', stateEffect: false });
    assert.equal(button.borderRadius, undefined, 'native Capsule owns the radius');
    assert.ok(button.width > 0 && button.height >= 44);
    assert.equal(typeof button.onClick, 'function');
    button.onClick();
  }
  assert.equal(callbacks.length, 6, 'each actual callback retains its original single intent');
  const mountedIds = [...owner.nodes].filter(([, button]) => button.type === 'Button').map(([nodeId]) => nodeId);
  nativeMinimum = { timerStepButton: 72, manageButtonWidth: 180, manageButton: 72,
    voiceBadgeWidth: 48, voiceBadge: 48 };
  rect.width = 96; rect.height = 72;
  owner.replay();
  assert.deepEqual([...owner.nodes].filter(([, button]) => button.type === 'Button').map(([nodeId]) => nodeId), mountedIds,
    'the same recorded actors survive geometry growth');
  for (const button of buttons()) {
    assert.deepEqual(button.createWithChild, { type: 'ButtonType.Capsule', stateEffect: false });
    assert.equal(button.borderRadius, undefined);
    assert.ok(button.width >= 44 && button.height >= 44);
  }
  owner.admitted = false; owner.replay();
  for (const button of buttons()) { assert.equal(button.enabled, false); button.onClick(); }
  assert.equal(callbacks.length, 6, 'retired presentation cannot dispatch through changed constructors');
  console.log(JSON.stringify({ files: files.length, formerSites: 26, capsuleButtons: 6, explicitFinitePaintSites: targets.length,
    measuredStatusPaintSites: 1, paintSamples, headerSamples,
    callbacks: 6, retiredCallbacks: 0, nativePaint: 'NOT_RUN' }));
  recordContractCasePass(id);
}
