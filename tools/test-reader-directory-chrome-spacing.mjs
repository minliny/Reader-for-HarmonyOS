import { actualReaderPostLayoutFrame } from './lib/reader-post-layout-frame-probe.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { registerHooks } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { installedEtsCompiler } from './lib/ets-compiler-runtime.mjs';
import { resolveEtsLoaderRoot, resolveOpenHarmonySdkRoot } from './lib/tool-environment.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
import { readerFoundationTokens } from './lib/reader-tokens-probe.mjs';
import { readerAppColor } from '../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts';
import * as controlGeometry from '../entry/src/main/ets/features/reading/ui/ReaderControlGeometry.ts';
import * as headerGeometry from '../entry/src/main/ets/features/reading/ui/ReaderControlHeaderGeometry.ts';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { readerDirectoryToolbarBudget } from '../entry/src/main/ets/features/reading/presentation/ReaderFullDirectoryBudget.ts';
import { selectedProductionClasses } from './lib/selected-production-methods.mjs';
import { readerEditingSdk } from './lib/reader-editing-sdk-probe.mjs';

const selected = selectContractCases({
  'header-spacing': 'Measured control-header title/glyph center, compact painted collapse surface inside native44 carrier, four scales and legacy negatives.',
  'icon-roles': 'Actual directory toolbar/header images retain per-role dimensions independently of the paid response rectangle, including constrained targets.',
  'standalone-collapse': 'Phone and expanded collapse pills paint on the action itself, retain a compact height, and offer a 44vp response region with guarded Back dispatch.',
  'full-directory-font-revision': 'Mounted standalone DirectoryHeader and actual ReadingTopBar retain their Back actor while an existing metrics revision updates its font-aware budget.',
  'full-directory-source-caption': 'The actual phone/expanded source action preserves its glyph, carrier and admission while its single-line caption receives natural CJK width and font-aware height.',
});
const root = new URL('../entry/src/main/ets/', import.meta.url);
const read = relative => readFileSync(new URL(relative, root), 'utf8');
const panelSource = read('features/reading/ui/ReaderControlPanel.ets');
const toolbarSource = read('features/reading/ui/ReaderDirectoryToolbar.ets');
const fullSource = read('features/reading/ui/ReaderFullDirectory.ets');
const contentSource = read('features/reading/ui/ReaderControlDirectoryContent.ets');
const standaloneSource = read('features/reading/ui/FullDirectoryPanel.ets');
const deps = { ...readerTypographyRoles, ...readerFoundationTokens, ...controlGeometry, ...headerGeometry, readerAppColor,
  readerDirectoryToolbarBudget,
  ...selectedProductionClasses(new URL('../entry/src/main/ets/features/reading/ui/ReaderControlPanel.ets', import.meta.url), ['ReaderControlHeaderLineHeight']),
  ...pureModuleProbe(toolbarSource.slice(0, toolbarSource.indexOf('@Component')), 'DirectoryToolbarConstants.ets', {}, ['READER_DIRECTORY_TOOLBAR_HEIGHT']) };
const nodes = owner => [...owner.nodes.values()];
const samples = [];
let standaloneSupport;
const fonts = {
  ReaderNotoSansSCUIBold: new URL('../entry/src/main/resources/rawfile/NotoSansSC-UIBold.otf', import.meta.url),
  ReaderNotoSansSCUIRegular: new URL('../entry/src/main/resources/rawfile/NotoSansSC-UIRegular.otf', import.meta.url),
  ReaderInter: new URL('../entry/src/main/resources/rawfile/InterVariable.ttf', import.meta.url),
};
const advances = new Map();
function advance(text, size, family, weight) {
  const font = fonts[family] ?? fonts.ReaderNotoSansSCUIRegular;
  const key = JSON.stringify([text, size, family, weight]);
  if (!advances.has(key)) {
    const python = `from PIL import ImageFont\nimport sys\nf=ImageFont.truetype(sys.argv[1],round(float(sys.argv[3])*100))\ntry:\n f.set_variation_by_axes([float(sys.argv[4]),14])\nexcept (OSError,ValueError):\n pass\nprint(f.getlength(sys.argv[2])/100)`;
    advances.set(key, Number(execFileSync('python3', ['-c', python, font.pathname, text, String(size), String(weight)], { encoding: 'utf8', timeout: 10000 })));
  }
  return advances.get(key);
}
let scale = 1;
const context = {
  px2vp: value => value,
  getMeasureUtils: () => ({
    measureText: options => advance(options.textContent, Number.parseFloat(options.fontSize) * scale, options.fontFamily, options.fontWeight),
    measureTextSize(options) {
      const width = advance(options.textContent, Number.parseFloat(options.fontSize) * scale, options.fontFamily, options.fontWeight);
      const rows = options.maxLines === 1 ? 1 : Math.ceil(width / Math.max(1, options.constraintWidth));
      return { width: Math.min(width, options.constraintWidth), height: Number.parseFloat(options.lineHeight ?? options.fontSize) * scale * rows };
    },
  }),
};
const textMeasure = pureModuleProbe(read('features/reading/ui/ReaderControlTextMeasurement.ets'), 'ReaderControlTextMeasurement.ets',
  { WordBreak: { BREAK_WORD: 'WordBreak.BREAK_WORD' } }, ['measureReaderControlText']);
const minimum = pureModuleProbe(read('features/reading/ui/ReaderControlMinimumMeasurement.ets'), 'ReaderControlMinimumMeasurement.ets',
  { ...deps, ...textMeasure }, ['measureReaderControlMinimum']);
const surface = pureModuleProbe(read('ui/foundation/ReaderSurfaceResolvers.ts'), 'ReaderSurfaceResolvers.ts', {},
  ['readerReadableFontScale', 'readerScaledControlHeight']);

function renderHeader(source, headerInter, width, fontScale) {
  scale = fontScale;
  const title = headerInter ? '内容搜索' : '目录';
  const result = minimum.measureReaderControlMinimum({ context, headerInter, title, identity: 'current', metricsRevision: 1,
    topBarHeightVp: 54, measureHomeForm: () => ({ minimumHeight: 190, minWidth: 100, fits: true }) }, headerInter ? 'search' : 'directory',
    { panelWidthVp: width + 26, quickContentWidthVp: width - 52, fullContentWidthVp: width }, 'current|1',
    () => ({ module: headerInter ? 'search' : 'directory', quick: { heightVp: 100, minWidthVp: 100, fits: true }, full: { heightVp: 100, minWidthVp: 100, fits: true } }));
  assert.ok(result, 'production minimum measurer must return the current header profile');
  const profile = result.profile;
  const owner = createReaderBuilderProbe(source, ['controlHeader', 'headerPaintLayout', 'headerFrame', 'headerRole',
    'headerInter', 'headerTitleStyle', 'headerActionStyle', 'headerActionPaint', 'headerAction', 'headerActionFrame',
    'headerActionInputEnabled', 'activateHeaderAction', 'controlCallbackGuard', 'controlActionHandler', 'currentMoreMenuOwnerScope', 'currentMinimumIdentity'], deps).owner;
  let collapsed = 0;
  Object.assign(owner, { appScheme: 'day', contentLocation: () => ({ level: 'secondary', module: headerInter ? 'search' : 'directory' }),
    headerIcon: () => 'module-directory-icon', contentTitle: () => title,
    frame: () => ({ progress: 1, header: { x: 13, y: 19, width, height: profile.headerHeight, opacity: 1 } }),
    currentLayout: () => ({ fullPanelWidth: width + 26 }), controlPanelHeight: () => 736,
    controlActionInputEnabled: () => true, selectedMinimumProfile: () => profile,
    collapseControl: () => collapsed++, replaceHeader: () => {} });
  owner.controlHeader(); owner.headerAction();
  return { owner, profile, title, clicks: () => collapsed };
}
function assertHeader(rendered) {
  const { owner, profile, title } = rendered;
  const image = nodes(owner).find(node => node.type === 'Image');
  const titleNode = nodes(owner).find(node => node.type === 'Text' && node.create === title);
  const label = nodes(owner).find(node => node.type === 'Text' && node.create === '收起');
  const button = nodes(owner).find(node => node.id === 'reader-control-collapse');
  const paint = nodes(owner).find(node => node.type === 'Stack' && node.backgroundColor === readerAppColor('TOK_READ_ACTIVE_SOFT', 'day'));
  assert.equal(image.width, 16, 'header glyph remains the existing16vp role');
  assert.equal(image.height, 16);
  const local = owner.headerPaintLayout();
  assert.equal(image.position.y + 8, local.frame.y + profile.headerHeight / 2, 'module glyph centers in the measured header');
  assert.equal(titleNode.position.y + titleNode.height / 2, local.frame.y + profile.headerHeight / 2, 'title centers in the measured header');
  assert.ok(button.width >= 44 && button.height >= 44, 'native collapse carrier retains44 minimum');
  assert.ok(button.position.y >= 0 && button.position.y + button.height <= 19 + profile.headerHeight + 8,
    'dock sibling pays the carrier before content without inflating the30 paint header');
  assert.equal(button.backgroundColor, 'Color.Transparent', 'native target does not enlarge the painted capsule');
  assert.ok(paint, 'compact collapse paint surface remains distinct');
  assert.equal(paint.create.alignContent, 'Alignment.TopStart');
  assert.equal(paint.height, Math.max(26, profile.collapseLabelHeight), 'authored centered whitespace is not a second fixed vertical padding');
  assert.ok(paint.height <= button.height + .001 && paint.width <= button.width + .001,
    `paint${paint.width}x${paint.height} must fit the declared dock carrier${button.width}x${button.height}`);
  assert.equal(label.position.y + label.height / 2, paint.height / 2, 'legacy fixed label offsets cannot bias vertical alignment');
  assert.ok(label.width >= advance('收起', label.fontSize * scale, label.fontFamily, label.fontWeight), 'both characters fit their measured lane');
  assert.ok(label.height >= profile.collapseLabelHeight);
  button.onClick();
  assert.equal(rendered.clicks(), 1, 'the existing collapse owner still receives the action');
  return { headerHeight: profile.headerHeight, targetWidth: button.width, targetHeight: button.height,
    paintedHeight: paint.height, labelHeight: label.height, glyph: image.width };
}

function standaloneHeader(expanded, width, height, fontScale, tab, source = standaloneSource) {
  const properties = createArkUIPropertyRuntimeProbe();
  const metrics = { systemFontScale: fontScale };
  scale = fontScale;
  const parent = createReaderBuilderProbe(fullSource, ['consumeBack'], deps).owner;
  let exits = 0, keyboard = false, opening = true;
  Object.assign(parent, { mounted: true, interactive: true, temporaryBackIdentity: 'current-opening',
    directoryRulesVisible: false, offlineMenuVisible: false, bookId: 'current-book',
    isOpeningCurrent: () => opening,
    dismissDirectoryKeyboard: () => { const consumed = keyboard; keyboard = false; return consumed; },
    showDirectoryRules: (_identity, _book, visible) => { parent.directoryRulesVisible = visible; },
    requestExit: () => exits++ });
  const { ts, options } = installedEtsCompiler();
  const tree = ts.createSourceFile('ReaderFullDirectory.ets', fullSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  const callbacks = [];
  const visit = node => {
    if ((ts.isEtsComponentExpression(node) || ts.isCallExpression(node)) && node.expression.getText(tree) === 'FullDirectoryPanel') {
      callbacks.push(node.arguments[0].properties.find(property => property.name?.getText(tree) === 'onExit').initializer.getText(tree));
    }
    ts.forEachChild(node, visit);
  };
  visit(tree); assert.equal(callbacks.length, 1);
  const code = ts.transpileModule(`const callback = ${callbacks[0]};`,
    { compilerOptions: { target: ts.ScriptTarget.ES2021 } }).outputText;
  const onExit = new Function('identity', code + ';return callback;').call(parent, 'current-opening');
  const sourceTree = ts.createSourceFile('FullDirectoryPanel.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  const declaration = sourceTree.statements.find(node => ts.isStructDeclaration(node) && node.name.text === 'FullDirectoryPanel');
  const members = declaration.members.filter(member => member.name && member.name.getText(sourceTree) !== 'build' &&
    !ts.getAllDecorators(member).some(decorator => decorator.getText(sourceTree) === '@Builder')).map(member => member.name.getText(sourceTree));
  for (const name of ['panelHeader', 'collapseLabel'])
    if (declaration.members.some(member => member.name?.getText(sourceTree) === name)) members.push(name);
  const owner = createReaderBuilderProbe(source, members,
    { ...deps, ...surface, ...standaloneSupport, ...properties.sdk, readerWindowMetrics: () => metrics,
      ColorMetrics: { resourceColor: color => ({ color, blendColor: overlay => ({ color: [color, overlay.color] }) }) },
      uiContext: context, registerReaderFonts() {} }, properties.hooks).owner;
  Object.assign(owner, { expandedLayout: expanded, initialTab: tab, appThemeScheme: 'day', embeddedInControl: false,
    panelWidthOverride: width, panelHeightOverride: height, entries: [], allowUnanchoredBrowse: true, motionProgress: 1, onExit,
    standaloneShort: () => height === 168, tabs() {}, searchControls() {}, statusFooter() {} });
  owner.aboutToAppear();
  assert.equal(owner.positioningMounted, true, 'the actual lifecycle admits the mounted panel');
  owner.panelHeader();
  properties.flush();
  return { owner, parent, properties, metrics, exits: () => exits, keyboard: value => { keyboard = value; },
    opening: value => { opening = value; }, width, height, expanded, fontScale };
}

function assertStandalone(rendered, fontScale = rendered.fontScale) {
  const { owner, width, expanded } = rendered;
  scale = fontScale;
  const target = nodes(owner).find(node => typeof node.onClick === 'function');
  const label = nodes(owner).find(node => node.type === 'Text' && node.create === '收起');
  assert.ok(target); assert.equal(target.type, expanded ? 'Stack' : 'Button');
  const restingColor = readerAppColor('TOK_SURFACE_PANEL_SOFT', 'day');
  assert.equal(target.backgroundColor, restingColor, 'the collapse action paints its own pill');
  assert.equal(target.height, surface.readerScaledControlHeight(26, 14, fontScale));
  assert.equal(target.constraintSize.minWidth, 44); assert.equal(target.flexShrink, 0);
  assert.equal(target.width, undefined, 'the pill can grow with its label');
  assert.deepEqual(target.padding, { left: 10, right: 10, top: 0, bottom: 0 });
  assert.deepEqual(target.responseRegion, { x: 0, y: Math.min(0, (target.height - 44) / 2),
    width: '100%', height: Math.max(44, target.height) });
  const modifier = owner.attributeCalls.find(call => call.id === target.id && call.property === 'attributeModifier').args[0];
  let pressedColor;
  modifier.applyPressedAttribute({ backgroundColor(color) { pressedColor = color; return this; }, borderRadius() {} });
  assert.deepEqual(pressedColor, [restingColor, readerAppColor('app.interaction.press', 'day')],
    'the press modifier blends into the same surface that paints the pill at rest');
  assert.equal(label.hitTestBehavior, 'HitTestMode.None');
  assert.equal(label.accessibilityLevel, 'no');
  assert.equal(label.width, undefined, 'intrinsic text must not create a cyclic100percent width');
  assert.equal(label.maxLines, 1); assert.equal(label.textAlign, 'TextAlign.Center');
  const glyphWidth = advance('收起', label.fontSize * fontScale, label.fontFamily, label.fontWeight);
  const paintWidth = Math.max(44, glyphWidth + 20);
  assert.ok(paintWidth <= width - 26 && label.lineHeight * fontScale <= target.height,
    'the natural paint is paid by the original header lane');
  const heading = nodes(owner).find(node => node.type === 'Text' && ['目录', '书签'].includes(node.create));
  assert.ok(width - 26 - paintWidth >= 16 + deps.TOK_SPACE_XS +
    advance(heading.create, heading.fontSize * fontScale, heading.fontFamily, heading.fontWeight));
  return { target, paintWidth };
}

for (const id of selected) {
  if (id === 'full-directory-source-caption') {
    const fontPath = `${resolveOpenHarmonySdkRoot()}/previewer/common/bin/fonts/HarmonyOS_Sans_SC.ttf`;
    const fontSha256 = createHash('sha256').update(readFileSync(fontPath)).digest('hex');
    const python = `from PIL import ImageFont\nimport json,sys\nf=ImageFont.truetype(sys.argv[1],round(float(sys.argv[2])*100))\ntry:\n f.set_variation_by_axes([800])\nexcept (OSError,ValueError):\n pass\na,d=f.getmetrics()\nprint(json.dumps({'width':f.getlength('换源')/100,'height':(a+d)/100,'actualCjkGlyphs':all(bytes(f.getmask(c))!=bytes(f.getmask(chr(0x10ffff))) for c in '换源')}))`;
    function action(source, expanded, fontScale) {
      const owner = createReaderBuilderProbe(source, ['topBarActions', 'topBarSourceContent', 'topBarMoreIcon',
        'headerControlHeight', 'fontScale', 'switchDirectorySource'],
      { ...deps, ...surface, readerWindowMetrics: () => ({ systemFontScale: fontScale }) }).owner;
      let local = false, switches = 0;
      Object.assign(owner, { appThemeScheme: 'day', readerWindowMetricsRevision: 1, mounted: true, exitRequested: false,
        usesExpandedLayout: () => expanded, isLocalBook: () => local, directoryRulesAvailable: () => false,
        topBarMoreLabel: () => '离线管理', topBarMoreEnabled: () => true, offlineBookOperationActive: false,
        onSwitchSource: () => switches++, toggleTopBarMore() {} });
      owner.topBarActions('current-opening', 'current-book');
      const caption = nodes(owner).find(node => node.type === 'Text' && node.create === '换源');
      const target = nodes(owner).find(node => typeof node.onClick === 'function' && node.width === 62);
      const glyph = nodes(owner).find(node => node.type === 'Image');
      assert.ok(caption); assert.ok(target); assert.ok(glyph);
      const text = JSON.parse(execFileSync('python3', ['-c', python, fontPath, String(caption.fontSize * fontScale)],
        { encoding: 'utf8', timeout: 10000 }));
      assert.equal(text.actualCjkGlyphs, true, 'the SDK CJK budget must measure real characters, not missing-glyph boxes');
      const captionWidth = caption.width ?? Math.max(caption.constraintSize.minWidth, text.width);
      const captionHeight = caption.height ?? Math.max(caption.constraintSize.minHeight, text.height);
      assert.ok(captionWidth >= text.width && captionHeight >= text.height, 'the caption must pay its actual SDK CJK text box');
      assert.equal(caption.width, undefined); assert.equal(caption.height, undefined);
      assert.equal(caption.maxLines, 1);
      assert.deepEqual(caption.constraintSize, { minWidth: 24, minHeight: 15 * fontScale });
      assert.equal(caption.fontFamily, deps.TYPE_READER_DIRECTORY_SOURCE_ACTION.fontFamily);
      assert.equal(caption.fontWeight, deps.TYPE_READER_DIRECTORY_SOURCE_ACTION.fontWeight);
      assert.deepEqual([glyph.width, glyph.height], [20, 20]);
      assert.equal(target.type, expanded ? 'Column' : 'Button');
      assert.equal(target.height, surface.readerScaledControlHeight(44, 20, fontScale));
      const column = nodes(owner).find(node => node.type === 'Column' && node.width === 62);
      assert.ok(column);
      assert.ok(captionWidth <= column.width);
      const naturalContentHeight = glyph.height + glyph.margin.top + column.create.space + captionHeight;
      assert.ok(naturalContentHeight <= column.height && column.height <= target.height, 'the original source-action parent pays its caption and glyph');
      target.onClick(); assert.equal(switches, 1);
      local = true; target.onClick(); assert.equal(switches, 1, 'the original local-book restriction remains authoritative'); local = false;
      owner.mounted = false; target.onClick(); assert.equal(switches, 1); owner.mounted = true;
      owner.exitRequested = true; target.onClick(); assert.equal(switches, 1); owner.exitRequested = false;
      return { expanded, fontScale, captionWidth, captionHeight, naturalContentHeight, targetWidth: target.width,
        targetHeight: target.height, sdkCjkText: text, sdkFont: { path: fontPath, sha256: fontSha256 } };
    }
    for (const expanded of [false, true]) for (const fontScale of [1, 2])
      samples.push({ kind: 'full-directory-source-caption', ...action(fullSource, expanded, fontScale) });
    const fixedCaption = fullSource.replace('.constraintSize({ minWidth: 24, minHeight: 15 * this.fontScale() })\n      .maxLines(1)',
      '.width(24)\n      .height(15)');
    assert.notEqual(fixedCaption, fullSource);
    for (const expanded of [false, true]) assert.throws(() => action(fixedCaption, expanded, 2),
      /caption must pay its actual SDK CJK text box/, 'the original fixed24x15 caption frame cannot pay the2x text box');
  }
  if (id === 'full-directory-font-revision') {
    registerHooks({ resolve(specifier, context, next) {
      try { return next(specifier, context); } catch (error) {
        if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier))
          return next(specifier + '.ts', context);
        throw error;
      }
    } });
    const { boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
    const metricsApi = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
    const support = {
      ...metricsApi,
      ...await import('../entry/src/main/ets/ui/layout/ReaderPageGeometry.ts'),
      ...await import('../entry/src/main/ets/ui/layout/ReaderMeasurements.ts'),
      ...await import('../entry/src/main/ets/ui/foundation/ReaderWidthClass.ts'),
      ...await import('../entry/src/main/ets/features/reading/presentation/ReadingDirectoryRecovery.ts'),
      ...await import('../entry/src/main/ets/features/reading/application/ReaderDirectoryNavigation.ts'),
    };
    const { ts, options } = installedEtsCompiler();
    function mountedHeader(source) {
      const metrics = metricsApi.createDefaultReaderWindowMetrics();
      metrics.windowRect.width = 366; metrics.windowRect.height = 844; metrics.systemFontScale = 1;
      const frames = [], sdk = boundedSurfaceSdk({ windowMetrics: () => metrics });
      sdk.hooks.childSources.PageBackBar = read('ui/chrome/PageBackBar.ets');
      const classes = pureModuleProbe(source.slice(source.indexOf('class DirectoryRulesFocusFrame'),
        source.indexOf('let fullDirectoryBackGeneration')), 'FullDirectoryFrames.ets', { FrameCallback: class {} , ReaderPostLayoutFrame: actualReaderPostLayoutFrame()},
      ['DirectoryRulesFocusFrame', 'FullDirectoryHeaderMeasurementFrame']);
      const tree = ts.createSourceFile('ReaderFullDirectory.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
      const declaration = tree.statements.find(node => ts.isStructDeclaration(node));
      const members = declaration.members.filter(member => member.name && member.name.getText(tree) !== 'build' &&
        !ts.getAllDecorators(member).some(decorator => decorator.getText(tree) === '@Builder')).map(member => member.name.getText(tree));
      members.push('directoryHeader', 'topBar', 'topBarBack', 'topBarBackIcon', 'topBarActions', 'topBarSourceContent',
        'topBarMoreIcon', 'detailMoreAction');
      const owner = sdk.consumer(source, members, { ...support, ...classes, ...surface,
        fullDirectoryBackGeneration: 0, ReaderRuntimeOwner: { current: () => undefined }, registerReaderFonts() {},
        uiContext: { getFont: () => ({}), postFrameCallback: frame => frames.push(frame),
          getComponentUtils: () => ({ getRectangleById() { throw Error('native measurement outside this SDK contract'); } }) } });
      Object.assign(owner, { containerWidth: 366, containerHeight: 844, sourceId: 'local', bookId: 'book', bookKind: 'epub',
        bookTitle: 'Book', chapterTitle: 'Chapter', catalogContext: 'reader' });
      owner.aboutToAppear(); owner.directoryHeader(); sdk.properties.flush();
      const back = nodes(owner).find(node => node.type === 'Button' && node.accessibilityText === '收起目录');
      assert.ok(back); assert.equal(back.height, 44);
      const geometryBefore = owner.geometry, keyBefore = owner.measurementKey;
      metrics.systemFontScale = 2; metrics.revision++;
      for (const view of sdk.walk(owner)) {
        if (Object.getOwnPropertyDescriptor(Object.getPrototypeOf(view), 'readerWindowMetricsRevision'))
          view.readerWindowMetricsRevision += 1;
      }
      sdk.properties.flush();
      for (const frame of frames.splice(0)) frame.onIdle?.(1);
      sdk.properties.flush();
      assert.equal(owner.mounted, true);
      assert.ok(owner.measurementKey > keyBefore, 'actual mounted window Watch invalidates its measurement generation');
      assert.notEqual(owner.geometry, geometryBefore, 'actual mounted window Watch rebuilds geometry through its original methods');
      assert.ok(nodes(owner).includes(back), 'font changes retain the actual ReadingTopBar Back actor');
      return back.height;
    }
    assert.equal(mountedHeader(fullSource), 64, 'the existing revision reaches the actual mounted header budget');
    const unsubscribed = fullSource.replace('private fontScale(): number {\n    this.readerWindowMetricsRevision;\n    return',
      'private fontScale(): number {\n    return');
    assert.notEqual(unsubscribed, fullSource);
    assert.equal(mountedHeader(unsubscribed), 44,
      'without the getter dependency, geometry refresh alone leaves the same actor at its old budget');
    samples.push({ kind: 'full-directory-font-revision', fontScale: [1, 2], currentHeight: 64,
      unsubscribedHeight: 44, actualMountedLifecycle: true, manualBuilderReplay: false });
  }
  if (id === 'standalone-collapse') {
    standaloneSupport = {
      ...readerEditingSdk(),
      ...await import('../entry/src/main/ets/features/reading/ui/ReaderControlListPositioning.ts'),
      ...await import('../entry/src/main/ets/features/reading/presentation/ReaderDirectoryDataSnapshot.ts'),
      ...await import('../entry/src/main/ets/features/reading/presentation/ReaderDirectoryProjection.ts'),
      ...await import('../entry/src/main/ets/features/reading/presentation/ReaderBookmarkProjection.ts'),
      ...await import('../entry/src/main/ets/features/reading/presentation/ReaderFullDirectoryBudget.ts'),
      ...await import('../entry/src/main/ets/features/reading/ui/ReaderControlBookmarkGeometry.ts'),
    };
    const bookmark = read('features/reading/ui/ReaderBookmarkRow.ets');
    Object.assign(standaloneSupport, pureModuleProbe(bookmark.slice(0, bookmark.indexOf('/**\n * One bookmark row')), 'ReaderBookmarkRowMeasure.ets',
      { ...deps, ...textMeasure }, ['BOOKMARK_ROW_HEIGHT', 'measureReaderStandaloneBookmark']));
    for (const expanded of [false, true]) for (const width of [294, 366]) for (const height of [168, 736])
      for (const fontScale of [1, 2]) for (const tab of ['directory', 'bookmarks']) {
        const rendered = standaloneHeader(expanded, width, height, fontScale, tab);
        const measured = assertStandalone(rendered);
        measured.target.onClick(); assert.equal(rendered.exits(), 1, 'the actual onExit closure reaches the original consumeBack owner');
        for (const field of ['mounted', 'interactive']) {
          rendered.parent[field] = false; measured.target.onClick(); assert.equal(rendered.exits(), 1); rendered.parent[field] = true;
        }
        rendered.opening(false); measured.target.onClick(); assert.equal(rendered.exits(), 1); rendered.opening(true);
        rendered.parent.temporaryBackIdentity = 'successor'; measured.target.onClick(); assert.equal(rendered.exits(), 1);
        rendered.parent.temporaryBackIdentity = 'current-opening';
        rendered.keyboard(true); measured.target.onClick(); assert.equal(rendered.exits(), 1, 'Back consumes the original keyboard first');
        rendered.parent.directoryRulesVisible = true; measured.target.onClick(); assert.equal(rendered.parent.directoryRulesVisible, false);
        rendered.parent.offlineMenuVisible = true; measured.target.onClick(); assert.equal(rendered.parent.offlineMenuVisible, false);
        assert.equal(rendered.exits(), 1, 'local Back layers keep their original order');
        samples.push({ kind: 'standalone-collapse', expanded, width, height, fontScale, tab,
          paintWidth: measured.paintWidth, paintHeight: measured.target.height, responseRegion: measured.target.responseRegion });
      }
    for (const expanded of [false, true]) {
      const rendered = standaloneHeader(expanded, 294, 168, 1, 'directory');
      const original = assertStandalone(rendered), ids = [...rendered.owner.nodes.keys()];
      rendered.metrics.systemFontScale = 2; rendered.owner.readerWindowMetricsRevision += 1; rendered.properties.flush();
      await new Promise(resolve => setTimeout(resolve, 10)); rendered.properties.flush();
      assert.equal(rendered.owner.deferredFlushScheduled, false, 'the original mounted deferred motion flush has settled');
      const enlarged = assertStandalone(rendered, 2);
      assert.equal(enlarged.target, original.target, 'font changes retain the actual native actor');
      assert.deepEqual([...rendered.owner.nodes.keys()], ids, 'font changes do not rebuild a parallel header');
    }
    const transparentPress = standaloneSource.replaceAll("new ReaderPressFeedback(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme),",
      'new ReaderPressFeedback(Color.Transparent,');
    assert.notEqual(transparentPress, standaloneSource);
    for (const expanded of [false, true]) assert.throws(() => assertStandalone(
      standaloneHeader(expanded, 294, 168, 1, 'directory', transparentPress)), /paints its own pill/);
    const unsubscribed = standaloneSource.replace('    this.readerWindowMetricsRevision;\n', '');
    assert.notEqual(unsubscribed, standaloneSource);
    const stale = standaloneHeader(false, 294, 168, 1, 'directory', unsubscribed);
    assertStandalone(stale); stale.metrics.systemFontScale = 2; stale.owner.readerWindowMetricsRevision += 1; stale.properties.flush();
    await new Promise(resolve => setTimeout(resolve, 10)); stale.properties.flush();
    assert.equal(stale.owner.positioningMounted, true); assert.equal(stale.owner.deferredFlushScheduled, false);
    assert.throws(() => assertStandalone(stale, 2), assert.AssertionError,
      'mounted revision without an observer dependency leaves the header budget stale after its real deferred flush');
  }
  if (id === 'header-spacing') {
    const compiler = installedEtsCompiler();
    const declaration = readFileSync(`${resolveEtsLoaderRoot()}/declarations/stack.d.ts`, 'utf8');
    const tree = compiler.ts.createSourceFile('stack.d.ts', declaration, compiler.ts.ScriptTarget.Latest, true);
    const options = tree.statements.find(node => compiler.ts.isInterfaceDeclaration(node) && node.name.text === 'StackOptions');
    assert.ok(options.members.some(member => member.name?.getText(tree) === 'alignContent' && member.type?.getText(tree) === 'Alignment'),
      'installed SDK StackOptions declares the Alignment constructor option');
    for (const fontScale of [1, 1.3, 1.6, 2]) for (const width of [268, 340]) for (const headerInter of [false, true]) {
      const rendered = renderHeader(panelSource, headerInter, width, fontScale);
      samples.push({ kind: 'header', width, fontScale, headerInter, ...assertHeader(rendered) });
    }
    const oldIcon = panelSource.replace('y: this.headerPaintLayout().icon.y', 'y: 7');
    assert.notEqual(oldIcon, panelSource);
    assert.throws(() => assertHeader(renderHeader(oldIcon, false, 340, 2)), /module glyph centers/, 'old fixed header glyph offset is rejected when text grows');
    const oldSurface = panelSource.replace('.backgroundColor(Color.Transparent).borderRadius(8).zIndex(2)',
      '.backgroundColor(readerAppColor(\'TOK_READ_ACTIVE_SOFT\', this.appScheme)).borderRadius(8).zIndex(2)');
    assert.notEqual(oldSurface, panelSource);
    assert.throws(() => assertHeader(renderHeader(oldSurface, false, 340, 1)), /native target does not enlarge/, 'painted native44 target regression is rejected');
    const oldLabel = panelSource.replace('y: this.headerPaintLayout().actionLabel.y - this.headerPaintLayout().actionPaint.y', 'y: 6');
    assert.notEqual(oldLabel, panelSource);
    assert.throws(() => assertHeader(renderHeader(oldLabel, false, 340, 2)), /legacy fixed label offsets/, 'old label top offset is rejected after real growth');
    const narrowLabel = panelSource.replace('.width(this.headerPaintLayout().actionLabel.width)', '.width(20)');
    assert.notEqual(narrowLabel, panelSource);
    assert.throws(() => assertHeader(renderHeader(narrowLabel, false, 340, 2)), /both characters fit/, 'fixed20vp label lane at2x is rejected');
  }
  if (id === 'icon-roles') {
    for (const variant of ['standard', 'full-directory', 'manga-catalog']) for (const scheme of ['day', 'night']) {
      const owner = createReaderBuilderProbe(toolbarSource, ['tool', 'iconSize', 'controlFieldHeight', 'mangaSortIcon', 'toolLabel'],
        { ...deps, ...surface, readerWindowMetrics: () => ({ systemFontScale: 1 }) }).owner;
      Object.assign(owner, { variant, readerWindowMetricsRevision: 1, naturalFieldHeightVp: 0, appThemeScheme: scheme, ascending: true, showChapterTools: true });
      let clicks = 0;
      for (const kind of variant === 'manga-catalog' ? ['sort'] : ['search', 'top', 'bottom', 'sort']) owner.tool(kind, () => clicks++);
      const images = nodes(owner).filter(node => node.type === 'Image');
      assert.equal(images.length, variant === 'manga-catalog' ? 1 : 4);
      for (const image of images) assert.deepEqual([image.width, image.height], variant === 'standard' ? [24, 24] : [16, 16]);
      const buttons = nodes(owner).filter(node => node.type === 'Button');
      assert.equal(buttons.length, images.length);
      for (const button of buttons) {
        assert.equal(button.width, variant === 'full-directory' ? 32 : 44);
        assert.ok(button.height >= 44);
        button.onClick();
      }
      assert.equal(clicks, buttons.length);
      samples.push({ kind: 'toolbar', variant, scheme, glyphSize: images[0].width, targetWidth: buttons[0].width });
    }
    function Child(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
    const callerHooks = { childSources: { ReaderDirectoryToolbar: toolbarSource } };
    const caller = createReaderBuilderProbe(contentSource, ['directoryToolbar', 'shortTool'], { ...deps, ReaderDirectoryToolbar: Child }, callerHooks).owner;
    const calls = [];
    const callerState = { availableWidth: 340, appThemeScheme: 'day', selectedMinimum: () => ({ full: { fieldHeightVp: 76, inputHeightVp: 72 } }),
      toolbarHeight: () => 96, draft: '目录', placeholder: () => '搜索章节名称', ascending: true, tab: 'directory', layoutPresentation: 7,
      directoryFocusId: () => 'current-input', toolbarInteractive: () => true, directoryInputFocused: false, directoryFocusRevision: 0,
      directoryRestoreKeyboard: true, contentGeometry: () => ({ toolbarHeight: 96 }), value: (_quick, full) => full, progress: 1,
      currentContent: presentation => presentation === 7, search: () => calls.push('search'), clearSearch: () => calls.push('clear'),
      onRequireCompleteCatalog: () => calls.push('load'), scrollCatalogEdge: bottom => calls.push(bottom ? 'bottom' : 'top'), sort: () => calls.push('sort') };
    Object.assign(caller, callerState);
    caller.directoryToolbar(7);
    const toolbar = [...caller.children.values()][0];
    assert.equal(toolbar.params.variant, 'full-directory', 'reading full-directory caller selects its existing compact icon role');
    assert.equal(toolbar.params.naturalFieldHeightVp, 76);
    assert.equal(toolbar.params.naturalInputHeightVp, 72);
    assert.equal(toolbar.params.naturalToolbarHeightVp, 94);
    for (const kind of ['search', 'top', 'bottom', 'sort', 'clear', 'load']) caller.shortTool(kind, kind, 7);
    const shortImages = nodes(caller).filter(node => node.type === 'Image');
    assert.deepEqual(shortImages.map(node => node.width), [16, 16, 16, 16, 14, 16], 'constrained full-directory tools use the same semantic glyph roles');
    for (const button of nodes(caller).filter(node => node.type === 'Button')) {
      assert.deepEqual([button.width, button.height], [44, 44]);
      assert.equal(button.backgroundColor, 'Color.Transparent');
      button.onClick();
    }
    assert.deepEqual(calls, ['search', 'top', 'bottom', 'sort', 'clear', 'load']);
    const oldCaller = contentSource.replace("        variant: 'full-directory',\n        naturalFieldHeightVp:", '        naturalFieldHeightVp:');
    assert.notEqual(oldCaller, contentSource);
    const absentRole = createReaderBuilderProbe(oldCaller, ['directoryToolbar'], { ...deps, ReaderDirectoryToolbar: Child }, callerHooks).owner;
    Object.assign(absentRole, callerState);
    absentRole.directoryToolbar(7);
    assert.throws(() => assert.equal([...absentRole.children.values()][0].params.variant, 'full-directory'), /AssertionError/, 'omitting the reading caller role is rejected');
    for (const fontScale of [1, 1.3, 1.6, 2]) {
      scale = fontScale;
      const fieldHeight = Math.max(44, 24 * fontScale + 20);
      const inputHeight = fieldHeight - 2;
      const naturalToolbar = fieldHeight + 20;
      const field = createReaderBuilderProbe(toolbarSource, ['queryField', 'controlFieldHeight', 'controlToolbarHeight'],
        { ...deps, ...surface, ReaderSearchField: Child, readerWindowMetrics: () => ({ systemFontScale: fontScale }) },
        { childSources: { ReaderSearchField: read('ui/controls/ReaderSearchField.ets') } }).owner;
      Object.assign(field, { variant: 'full-directory', readerWindowMetricsRevision: 1, naturalFieldHeightVp: fieldHeight,
        naturalInputHeightVp: inputHeight, naturalToolbarHeightVp: naturalToolbar, text: '', placeholder: '搜索章节名称' });
      field.queryField('full-directory:input');
      const input = [...field.children.values()][0];
      assert.equal(input.params.naturalFieldHeightVp, fieldHeight, 'full-directory forwards the existing measured field budget');
      assert.equal(input.params.naturalInputHeightVp, inputHeight, 'full-directory forwards the existing measured input budget');
      assert.equal(field.controlToolbarHeight(), naturalToolbar, 'full-directory pays the selected measured toolbar parent');
      samples.push({ kind: 'directory-measured-input', fontScale, fieldHeight, inputHeight, naturalToolbar });
    }
    const full = createReaderBuilderProbe(fullSource, ['topBarBackIcon', 'topBarSourceContent', 'topBarMoreIcon'], deps).owner;
    Object.assign(full, { appThemeScheme: 'day', usesExpandedLayout: () => false, fontScale: () => 1 });
    full.topBarBackIcon(); full.topBarSourceContent(); full.topBarMoreIcon();
    assert.deepEqual(nodes(full).filter(node => node.type === 'Image').map(node => [node.width, node.height]), [[24, 24], [20, 20], [20, 20]]);
    const uniform = toolbarSource.replace("return this.variant === 'standard' ? 24 : 16;", 'return 44;');
    assert.notEqual(uniform, toolbarSource);
    const bad = createReaderBuilderProbe(uniform, ['tool', 'iconSize', 'controlFieldHeight', 'mangaSortIcon', 'toolLabel'],
      { ...deps, ...surface, readerWindowMetrics: () => ({ systemFontScale: 1 }) }).owner;
    Object.assign(bad, { variant: 'standard', readerWindowMetricsRevision: 1, naturalFieldHeightVp: 0, appThemeScheme: 'day', ascending: true, showChapterTools: true });
    bad.tool('search', () => {});
    const badImage = nodes(bad).find(node => node.type === 'Image');
    assert.throws(() => assert.deepEqual([badImage.width, badImage.height], [24, 24]), /AssertionError/, 'native44 target dimensions cannot replace the24vp toolbar glyph');
  }
  recordContractCasePass(id);
}
if (selected.length > 0) {
  const report = { result: 'PASS', selected, samples,
    fonts: Object.entries(fonts).map(([family, path]) => ({ family, path: path.pathname, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') })),
    inputTrace: process.env.READER_LAYOUT_TRACE_OUTPUT ?? 'NOT_RECORDED',
    boundary: 'Current production Builder emission, SDK-declared alignment, bundled-font advances and measured line budgets. Native layout, hit testing, glyph paint and user acceptance remain unverified.' };
  const standaloneOnly = selected.length === 1 && ['standalone-collapse', 'full-directory-font-revision', 'full-directory-source-caption'].includes(selected[0]);
  const reportPath = selected[0] === 'standalone-collapse' ? 'standalone-collapse-paint/' : `${selected[0]}/`;
  const repaired = selected.some(id => ['header-spacing', 'standalone-collapse', 'icon-roles'].includes(id));
  const reportDirectory = new URL(repaired ? `../.reader-artifacts/ui-full-fix-20261113/oracle-directory-chrome/${selected.join('+')}/` :
    standaloneOnly ? `../.reader-artifacts/vm-ui-feedback-20261113/${reportPath}` :
      '../.reader-artifacts/vm-manual-acceptance-20261113/directory-chrome-repair/', import.meta.url);
  if (standaloneOnly || repaired) mkdirSync(reportDirectory, { recursive: true });
  writeFileSync(new URL('sdk-report.json', reportDirectory), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ kind: 'directory-chrome-repair', selected, samples: samples.length, boundary: report.boundary }));
}
