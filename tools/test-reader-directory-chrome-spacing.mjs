import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { installedEtsCompiler } from './lib/ets-compiler-runtime.mjs';
import { resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
import { readerFoundationTokens } from './lib/reader-tokens-probe.mjs';
import { readerAppColor } from '../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts';
import * as controlGeometry from '../entry/src/main/ets/features/reading/ui/ReaderControlGeometry.ts';

const selected = selectContractCases({
  'header-spacing': 'Measured control-header title/glyph center, compact painted collapse surface inside native44 carrier, four scales and legacy negatives.',
  'icon-roles': 'Actual directory toolbar/header images retain per-role dimensions independently of native44 target dimensions.',
});
const root = new URL('../entry/src/main/ets/', import.meta.url);
const read = relative => readFileSync(new URL(relative, root), 'utf8');
const panelSource = read('features/reading/ui/ReaderControlPanel.ets');
const toolbarSource = read('features/reading/ui/ReaderDirectoryToolbar.ets');
const fullSource = read('features/reading/ui/ReaderFullDirectory.ets');
const contentSource = read('features/reading/ui/ReaderControlDirectoryContent.ets');
const deps = { ...readerTypographyRoles, ...readerFoundationTokens, ...controlGeometry, readerAppColor };
const nodes = owner => [...owner.nodes.values()];
const samples = [];
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
    topBarHeightVp: 54, measureHomeForm: () => undefined }, 'directory',
    { panelWidthVp: width + 26, quickContentWidthVp: width - 52, fullContentWidthVp: width }, 'current|1',
    () => ({ module: 'directory', quick: { heightVp: 100, minWidthVp: 100, fits: true }, full: { heightVp: 100, minWidthVp: 100, fits: true } }));
  assert.ok(result, 'production minimum measurer must return the current header profile');
  const profile = result.profile;
  const owner = createReaderBuilderProbe(source, ['controlHeader'], deps).owner;
  let collapsed = 0;
  Object.assign(owner, { appScheme: 'day', contentLocation: () => ({ module: headerInter ? 'search' : 'directory' }),
    headerIcon: () => 'module-directory-icon', contentTitle: () => title, headerInter: () => headerInter,
    headerFrame: () => ({ x: 0, y: 0, width, height: profile.headerHeight }), selectedMinimumProfile: () => profile,
    collapseControl: () => collapsed++, replaceHeader: () => {} });
  owner.controlHeader();
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
  assert.equal(image.position.y + 8, profile.headerHeight / 2, 'module glyph centers in the measured header');
  assert.equal(titleNode.position.y + titleNode.height / 2, profile.headerHeight / 2, 'title centers in the measured header');
  assert.ok(button.width >= 44 && button.height >= 44, 'native collapse carrier retains44 minimum');
  assert.ok(button.position.y >= 0 && button.position.y + button.height <= profile.headerHeight, 'parent pays the full native carrier');
  assert.equal(button.backgroundColor, 'Color.Transparent', 'native target does not enlarge the painted capsule');
  assert.ok(paint, 'compact collapse paint surface remains distinct');
  assert.equal(paint.create.alignContent, 'Alignment.Center', 'collapse measured label is centered');
  assert.equal(paint.height, Math.max(26, profile.collapseLabelHeight + 12), 'paint grows from the approved26vp capsule with measured text');
  assert.ok(paint.height <= button.height && paint.width <= button.width);
  assert.equal(label.position, undefined, 'legacy fixed label offsets cannot bias vertical alignment');
  assert.ok(label.width >= advance('收起', label.fontSize * scale, label.fontFamily, label.fontWeight), 'both characters fit their measured lane');
  assert.ok(label.height >= profile.collapseLabelHeight);
  button.onClick();
  assert.equal(rendered.clicks(), 1, 'the existing collapse owner still receives the action');
  return { headerHeight: profile.headerHeight, targetWidth: button.width, targetHeight: button.height,
    paintedHeight: paint.height, labelHeight: label.height, glyph: image.width };
}

for (const id of selected) {
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
    const oldIcon = panelSource.replace('y: Math.max(0, (this.headerFrame().height - 16) / 2)', 'y: 7');
    assert.notEqual(oldIcon, panelSource);
    assert.throws(() => assertHeader(renderHeader(oldIcon, false, 340, 1)), /module glyph centers/, 'old header glyph offset is rejected');
    const oldSurface = panelSource.replace('.backgroundColor(Color.Transparent).borderRadius(8)\n        .id(\'reader-control-collapse\')',
      '.backgroundColor(readerAppColor(\'TOK_READ_ACTIVE_SOFT\', this.appScheme)).borderRadius(8)\n        .id(\'reader-control-collapse\')');
    assert.notEqual(oldSurface, panelSource);
    assert.throws(() => assertHeader(renderHeader(oldSurface, false, 340, 1)), /native target does not enlarge/, 'painted native44 target regression is rejected');
    const oldLabel = panelSource.replace(".fontColor(readerAppColor('TOK_READ_PRIMARY', this.appScheme)).textAlign(TextAlign.Center);\n      }.width(this.selectedMinimumProfile()?.collapseWidth ?? 44)",
      ".fontColor(readerAppColor('TOK_READ_PRIMARY', this.appScheme)).textAlign(TextAlign.Center).position({ x: 10, y: 6 });\n      }.width(this.selectedMinimumProfile()?.collapseWidth ?? 44)");
    assert.notEqual(oldLabel, panelSource);
    assert.throws(() => assertHeader(renderHeader(oldLabel, false, 340, 1)), /legacy fixed label offsets/, 'old label top offset is rejected');
    const narrowLabel = panelSource.replace("Text('收起').width((this.selectedMinimumProfile()?.collapseWidth ?? 44) - 20)", "Text('收起').width(20)");
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
        assert.equal(button.width, 44);
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
    Object.assign(full, { appThemeScheme: 'day', usesExpandedLayout: () => false });
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
  writeFileSync(new URL('../.reader-artifacts/vm-manual-acceptance-20261113/directory-chrome-repair/sdk-report.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ kind: 'directory-chrome-repair', selected, samples: samples.length, boundary: report.boundary }));
}
