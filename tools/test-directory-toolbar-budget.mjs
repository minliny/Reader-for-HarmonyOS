import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { installedEtsCompiler } from './lib/ets-compiler-runtime.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
import { readerFoundationTokens } from './lib/reader-tokens-probe.mjs';
import { readerAppColor } from '../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts';
import { readerDirectoryToolbarBudget, readerFullDirectoryHeights } from '../entry/src/main/ets/features/reading/presentation/ReaderFullDirectoryBudget.ts';
import { MANGA_DIRECTORY_VISUAL as manga, mangaDirectoryColor, mangaDirectoryLineBox } from '../entry/src/main/ets/features/manga/ui/MangaDirectoryVisual.ts';
import { READER_FONT_NOTO_SANS_SC_UI_REGULAR } from '../entry/src/main/ets/ui/foundation/ReaderFontFamilies.ts';
import { resolveReaderControlDirectoryGeometry } from '../entry/src/main/ets/features/reading/ui/ReaderControlDirectoryGeometry.ts';

const selected = selectContractCases({
  'editable-budget': { description: 'Actual directory toolbar budgets useful editable width, both scaled rows and parent list/prefix height.', resources: [] },
  'sdk-actions': { description: 'SDK toolbar field and grouped per-role actions retain query/scroll/sort callbacks and reject retired no-focus actors.', resources: [] },
});
const base = new URL('../entry/src/main/ets/', import.meta.url);
const read = path => readFileSync(new URL(path, base), 'utf8');
const panelSource = read('features/reading/ui/FullDirectoryPanel.ets');
const toolbarSource = read('features/reading/ui/ReaderDirectoryToolbar.ets');
const fieldSource = read('ui/controls/ReaderSearchField.ets');
const contentSource = read('features/reading/ui/ReaderControlDirectoryContent.ets');
const minimumSource = read('features/reading/ui/ReaderControlDirectoryMinimum.ets');
const textMeasurement = pureModuleProbe(read('features/reading/ui/ReaderControlTextMeasurement.ets'), 'ReaderControlTextMeasurement.ets',
  { WordBreak: { BREAK_WORD: 'WordBreak.BREAK_WORD' } }, ['measureReaderControlText']);
const surface = pureModuleProbe(read('ui/foundation/ReaderSurfaceResolvers.ts'), 'ReaderSurfaceResolvers.ts', {},
  ['readerReadableFontScale', 'readerScaledControlHeight']);
const typographySource = read('ui/foundation/ReaderTypography.ets');
const typographyClasses = pureModuleProbe(typographySource.slice(0, typographySource.indexOf('export const TYPE_')),
  'ReaderTypographyClasses.ets', {}, ['ReaderInheritedTextStyle']);
const fonts = {
  ReaderNotoSansSC: new URL('../entry/src/main/resources/rawfile/NotoSansSC-VF.otf', import.meta.url),
  ReaderInter: new URL('../entry/src/main/resources/rawfile/InterVariable.ttf', import.meta.url),
  ReaderNotoSerifSCBold: new URL('../entry/src/main/resources/rawfile/NotoSerifSC-Bold.ttf', import.meta.url),
  ReaderNotoSansSCUIRegular: new URL('../entry/src/main/resources/rawfile/NotoSansSC-UIRegular.otf', import.meta.url),
};
const advances = new Map();
function advance(text, size, family, weight = 400) {
  const file = fonts[family] ?? fonts.ReaderNotoSansSC;
  const key = JSON.stringify([text, size, file.pathname, weight]);
  if (!advances.has(key)) {
    const code = `from PIL import ImageFont\nimport sys\nf=ImageFont.truetype(sys.argv[1],round(float(sys.argv[3])*100))\ntry:\n a=f.get_variation_axes();v=[x['default'] for x in a];v[0]=float(sys.argv[4]);f.set_variation_by_axes(v)\nexcept (OSError,ValueError,AttributeError):\n pass\nprint(f.getlength(sys.argv[2])/100)`;
    advances.set(key, Number(execFileSync('python3', ['-c', code, file.pathname, text, String(size), String(weight)],
      { encoding: 'utf8', timeout: 10000 })));
  }
  return advances.get(key);
}
function contextAt(scale) {
  let calls = 0;
  const context = { px2vp: value => value, getMeasureUtils: () => ({
    measureText(options) {
      calls++;
      return advance(options.textContent, Number.parseFloat(options.fontSize) * scale, options.fontFamily, options.fontWeight);
    },
    measureTextSize(options) {
      calls++;
      const width = advance(options.textContent, Number.parseFloat(options.fontSize) * scale, options.fontFamily, options.fontWeight);
      const rows = options.maxLines === 1 ? 1 : Math.max(1, Math.ceil(width / Math.max(1, options.constraintWidth)));
      return { width: Math.min(width, options.constraintWidth), height: Number.parseFloat(options.lineHeight ?? options.fontSize) * scale * rows };
    },
  }) };
  return { context, calls: () => calls };
}
const toolbarConstants = pureModuleProbe(toolbarSource.slice(0, toolbarSource.indexOf('@Component')),
  'ReaderDirectoryToolbarConstants.ets', {}, ['READER_DIRECTORY_TOOLBAR_HEIGHT']);
const deps = { ...readerTypographyRoles, ...readerFoundationTokens, ...surface, ...textMeasurement, ...toolbarConstants,
  ...typographyClasses, readerDirectoryToolbarBudget, readerFullDirectoryHeights, readerAppColor,
  manga, mangaDirectoryColor, mangaDirectoryLineBox, READER_FONT_NOTO_SANS_SC_UI_REGULAR,
  resolveReaderControlDirectoryGeometry };
const samples = [];
const compatibilitySamples = [];

function panel(width, height, scale, tab) {
  const measure = contextAt(scale), metrics = { systemFontScale: scale };
  let ready = true;
  const names = ['panelWidth', 'innerWidth', 'panelHeight', 'fontScale', 'queryHeight', 'tabHeight', 'tabStripHeight',
    'panelHeaderHeight',
    'toolbarInputMinimumWidth', 'toolbarInputWidthKey', 'toolbarInputWidthCached', 'searchControlsHeight', 'heights',
    'standaloneFooterHeight', 'standaloneShort', 'standalonePrefixHeight', 'contentHeight', 'bodyContentHeight', 'embeddedToolbarGrowth',
    'chapterListHeight', 'bookmarkListHeight', 'directoryRowHeight', 'controlProgress', 'controlValue', 'searchPlaceholder'];
  const owner = createReaderBuilderProbe(panelSource, names, { ...deps, uiContext: measure.context,
    readerWindowMetrics: () => metrics, readerFontFamilyReady: () => ready }).owner;
  Object.assign(owner, { panelWidthOverride: width, panelHeightOverride: height, expandedLayout: width > 600,
    embeddedInControl: false, activeTab: tab, readerWindowMetricsRevision: 1, motionProgress: 1,
    listRowHeight: () => surface.readerScaledControlHeight(40, 20, scale) });
  return { owner, measure, metrics, ready: value => { ready = value; } };
}

function controlGeometry(width, height, scale, tab, profile) {
  const owner = createReaderBuilderProbe(contentSource, ['contentGeometry', 'toolbarHeight', 'queryGrowth',
    'fontScale', 'directoryQueryHeight', 'value'], { ...deps,
    readerWindowMetrics: () => ({ systemFontScale: scale }) }).owner;
  Object.assign(owner, { availableWidth: width, availableHeight: height, tab, progress: 1, minimumMetricsRevision: 1,
    selectedMinimum: () => profile, tabHeight: () => 36, rowHeight: () => 40, footerHeight: () => 48 });
  return owner;
}

const { ts, options } = installedEtsCompiler();
function members(source) {
  const tree = ts.createSourceFile('DirectoryToolbar.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  assert.deepEqual(tree.parseDiagnostics, []);
  const component = tree.statements.find(node => ts.isStructDeclaration(node));
  return component.members.filter(node => node.name).map(node => node.name.getText(tree));
}
function mountedToolbar(width, scale, tab, variant = 'full-directory', source = toolbarSource) {
  const properties = createArkUIPropertyRuntimeProbe(), metrics = { systemFontScale: scale };
  const measure = contextAt(scale), hooks = { ...properties.hooks, mountChildren: true, lifecycleChildren: true,
    childSources: { ReaderSearchField: fieldSource } };
  const region = pureModuleProbe(read('ui/controls/ReaderActionAccessibility.ets'), 'ReaderActionAccessibility.ets', {},
    ['readerActionTouchRegion']);
  const fieldTypes = pureModuleProbe(fieldSource.slice(0, fieldSource.indexOf('@Component')), 'ReaderSearchFieldTypes.ets',
    { ...region, FrameCallback: class {} }, ['ReaderSearchInputTarget', 'ReaderSearchFocusFrame']);
  const native = { ...deps, ...properties.sdk, ...fieldTypes, readerWindowMetrics: () => metrics,
    TextInputController: class {}, uiContext: measure.context };
  const Field = createReaderBuilderProbe(fieldSource, members(fieldSource), native, hooks).Component;
  const owner = createReaderBuilderProbe(source, members(source), { ...native, ReaderSearchField: Field }, hooks).owner;
  const calls = [];
  Object.assign(owner, { availableWidthVp: width, inputMinimumWidthVp: 60 * scale, variant,
    text: '', placeholder: '搜索章节名称', showChapterTools: tab === 'directory', naturalFieldHeightVp: 0,
    naturalInputHeightVp: 0, naturalToolbarHeightVp: 0, readerWindowMetricsRevision: 1,
    directoryFocusId: '', directoryFocusAllowed: false, ascending: true,
    onTextChange: value => calls.push(['text', value]), onSearch: () => calls.push('search'),
    onTop: () => calls.push('top'), onBottom: () => calls.push('bottom'), onToggleSort: () => calls.push('sort') });
  owner.aboutToAppear(); owner.initialRender(); properties.flush();
  const nodes = target => [target, ...[...target.children.values()].flatMap(child => child.nodes ? nodes(child) : [])];
  return { owner, properties, calls, owners: nodes(owner), metrics };
}

function assertToolbarRows(rendered) {
  const { owner } = rendered;
  const rows = [...owner.nodes.values()].filter(node => node.type === 'Row' && node.padding?.top === 3);
  assert.ok(rows.length > 0);
  for (const row of rows) assert.ok(row.height >= owner.controlFieldHeight() + 6,
    'both toolbar rows pay the current glyph growth,44-high tool lane and vertical padding');
}

for (const id of selected) {
  if (id === 'editable-budget') {
    for (const width of [294, 320, 366, 720]) for (const scale of [1, 1.3, 1.6, 2]) for (const tab of ['directory', 'bookmarks']) {
      const rendered = panel(width, 736, scale, tab), owner = rendered.owner;
      const minimum = owner.toolbarInputMinimumWidth(), before = rendered.measure.calls();
      const raw = readerDirectoryToolbarBudget(owner.innerWidth(), tab === 'directory', owner.queryHeight(), minimum);
      const availableField = raw.stacked ? owner.innerWidth() - 20 : owner.innerWidth() - 20 - 5 - raw.actionsWidth;
      assert.ok(availableField - 39 + .01 >= minimum, 'useful editable text has its own paid lane');
      assert.equal(owner.searchControlsHeight(), raw.height + 1);
      assert.equal(raw.height, raw.stacked ? (owner.queryHeight() + 18) * 2 + 8 : owner.queryHeight() + 18);
      const heights = owner.heights();
      assert.ok(owner.tabStripHeight() + owner.searchControlsHeight() + heights.chapterList + owner.standaloneFooterHeight() <= heights.body);
      for (const query of ['', '一', '章节名称']) { owner.searchDraft = query; owner.searchControlsHeight(); }
      assert.equal(rendered.measure.calls(), before, 'typing reuses the same font/revision/placeholder width');
      owner.readerWindowMetricsRevision++;
      owner.toolbarInputMinimumWidth(); assert.ok(rendered.measure.calls() > before);
      rendered.ready(false); const unavailableCalls = rendered.measure.calls();
      assert.ok(owner.toolbarInputMinimumWidth() > 0); assert.equal(rendered.measure.calls(), unavailableCalls, 'unprepared fonts use positive fallback without repeated native measurement');
      const short = panel(width, 180, scale, tab).owner;
      assert.equal(short.standaloneShort(), true);
      assert.equal(short.standalonePrefixHeight(), short.panelHeaderHeight() + readerFoundationTokens.TOK_SPACE_XS + short.tabStripHeight() +
        short.searchControlsHeight() + (tab === 'directory' ? short.standaloneFooterHeight() : 0));
      samples.push({ kind: id, width, scale, tab, stacked: raw.stacked, editable: availableField - 39,
        minimum, toolbar: raw.height, prefix: short.standalonePrefixHeight() });
      const unmeasured = controlGeometry(width, 736, scale, tab), geometry = unmeasured.contentGeometry();
      assert.equal(geometry.toolbarHeight, unmeasured.toolbarHeight());
      assert.ok(geometry.nominalListTop >= geometry.toolbarTop + geometry.toolbarHeight,
        'first-frame list starts after the complete paid toolbar');
      const constrained = controlGeometry(width, geometry.nominalListTop + 20, scale, tab).contentGeometry();
      assert.equal(constrained.shortContentRequired, true);
      const embedded = panel(width, 736, scale, tab).owner;
      embedded.embeddedInControl = true;
      for (const progress of [0, .5, 1]) {
        embedded.motionProgress = progress;
        const paid = readerDirectoryToolbarBudget(embedded.innerWidth(), tab === 'directory', embedded.queryHeight(), embedded.toolbarInputMinimumWidth());
        assert.equal(embedded.searchControlsHeight(), paid.height);
        assert.equal(embedded.embeddedToolbarGrowth(), Math.max(0, paid.height - 52) * progress);
        assert.equal((tab === 'directory' ? embedded.chapterListHeight() : embedded.bookmarkListHeight()) +
          embedded.controlValue(tab === 'directory' ? 48 : 47, 99) + embedded.embeddedToolbarGrowth() +
          (tab === 'directory' ? 48 * progress : 0) + 1, embedded.panelHeight());
      }
      compatibilitySamples.push({ width, scale, tab, host: 'unmounted-legacy-embedded', result: 'finite-budget-conservation' });
    }
    // The original four32-wide tool lanes keep their five-vp gaps. Their
    // vertical44 responses remain distinct from32 paint; E2 width stays open.
    const normal = mountedToolbar(336, 1, 'directory');
    assert.equal(normal.owner.queryStacked(), false, 'approved normal width retains one toolbar row');
    assert.equal(normal.owner.controlToolbarHeight(), 50, 'normal toolbar pays44vp targets plus3vp vertical insets; control host adds2vp boundaries');
    assert.equal(normal.owner.toolbarBudget().actionsWidth, 143);
    assert.equal(mountedToolbar(314, 1, 'directory').owner.queryStacked(), false, 'current366vp phone full-content width retains one row');
    assert.equal(mountedToolbar(314, 2, 'directory').owner.queryStacked(), true, 'real2x text growth selects the narrow variant');
    assert.equal(336 - 20 - 5 - 143, 168, 'independent original toolbar retains168vp field');
    const inflated = readerDirectoryToolbarBudget(336, true, 44, 80);
    assert.equal(inflated.stacked, false);
    assert.equal(mountedToolbar(294, 1, 'directory').owner.queryStacked(), false, '294vp retains an adequate126vp field');
    const current = mountedToolbar(240, 1, 'directory');
    assert.equal(current.owner.queryStacked(), true, 'a genuinely unpaid editable field selects two rows');
    const oldThreshold = toolbarSource.replace(/return this\.variant !== 'manga-catalog' && this\.toolbarBudget\(\)\.stacked;/,
      "return this.variant !== 'manga-catalog' && this.availableWidthVp > 0 && this.availableWidthVp - 20 - 5 - (this.showChapterTools ? 143 : 32) < 44;");
    assert.notEqual(oldThreshold, toolbarSource);
    assert.throws(() => assert.equal(mountedToolbar(240, 1, 'directory', 'full-directory', oldThreshold).owner.queryStacked(), true));
    const normalMinimum = pureModuleProbe(minimumSource, 'NormalDirectoryMinimum.ets', {
      ...deps, readerWindowMetrics: () => ({ systemFontScale: 1 }) }, ['measureReaderDirectoryMinimum']);
    const normalProfile = normalMinimum.measureReaderDirectoryMinimum(contextAt(1).context,
      { quickContentWidthVp: 286, fullContentWidthVp: 338 },
      { tab: 'directory', title: '第一章', excerpt: '正文', currentTitle: '第一章', currentPosition: '1/1', hasRows: true,
        loading: false, message: '', action: '', bookmarkError: false, catalogStatus: '', catalogAction: '' });
    assert.equal(normalProfile.full.toolbarHeightVp, 52, 'actual control parent retains approved52vp default total');
    const minimum = pureModuleProbe(minimumSource, 'ReaderControlDirectoryMinimum.ets', {
      ...deps, readerWindowMetrics: () => ({ systemFontScale: 2 }) }, ['measureReaderDirectoryMinimum']);
    const profile = minimum.measureReaderDirectoryMinimum(contextAt(2).context, { quickContentWidthVp: 286, fullContentWidthVp: 316 },
      { tab: 'directory', title: '第一章', excerpt: '正文', currentTitle: '第一章', currentPosition: '1/1', hasRows: true,
        loading: false, message: '', action: '', bookmarkError: false, catalogStatus: '', catalogAction: '' });
    assert.ok(profile); assert.ok(profile.full.inputMinimumWidthVp >= 120);
    assert.ok(profile.full.toolbarHeightVp >= 158, 'control minimum pays both scaled rows plus its existing border');
    const measuredOwner = controlGeometry(318, 736, 2, 'directory', profile), measured = measuredOwner.contentGeometry();
    assert.equal(measured.toolbarHeight, profile.full.toolbarHeightVp);
    assert.equal(measured.nominalListTop, profile.full.listTopVp);
    assert.ok(measured.nominalListTop >= measured.toolbarTop + measured.toolbarHeight);
    const firstFrame = controlGeometry(294, 736, 1, 'directory');
    const legacyGeometry = resolveReaderControlDirectoryGeometry(1, 'directory', 736, 36, 44 - 32, 40);
    assert.ok(firstFrame.contentGeometry().toolbarHeight < legacyGeometry.toolbarHeight,
      'uniform44 field paint would inflate the independently restored first-frame toolbar');
    assert.ok(contentSource.includes('availableWidthVp: Math.max(0, this.availableWidth - 2)'));
    assert.ok(contentSource.includes('inputMinimumWidthVp: this.selectedMinimum()?.full.inputMinimumWidthVp'));
  }
  if (id === 'sdk-actions') {
    for (const width of [316, 694]) for (const scale of [1, 2]) for (const tab of ['directory', 'bookmarks']) {
      const rendered = mountedToolbar(width, scale, tab), { owner, owners, calls } = rendered;
      assertToolbarRows(rendered);
      const nodes = owners.flatMap(value => [...value.nodes.values()]);
      const buttons = nodes.filter(node => node.type === 'Button');
      assert.equal(buttons.length, tab === 'directory' ? 4 : 1);
      for (const button of buttons) {
        assert.equal(button.width, 32); assert.equal(button.height, Math.max(44, owner.controlFieldHeight()));
        assert.deepEqual(button.responseRegion, { x: 0, y: 0, width: 32, height: Math.max(44, owner.controlFieldHeight()) });
        button.onClick();
      }
      assert.deepEqual(calls, tab === 'directory' ? ['search', 'top', 'bottom', 'sort'] : ['search']);
      const actionImages = [...owner.nodes.values()].filter(node => node.type === 'Image');
      assert.ok(actionImages.every(node => node.width === 16 && node.height === 16));
      const paints = [...owner.nodes.values()].filter(node => node.type === 'Stack' && node.width === 32);
      assert.equal(paints.length, buttons.length); assert.ok(paints.every(node => node.height === 32));
      const input = nodes.find(node => node.type === 'TextInput'); assert.ok(input);
      assert.ok(input.height > 0 && input.height <= owner.controlFieldHeight());
      input.onChange('第十章'); input.onSubmit(); assert.deepEqual(calls.slice(-2), [['text', '第十章'], 'search']);
      const previous = calls.length; owner.aboutToDisappear();
      for (const button of buttons) button.onClick(); input.onChange('旧事件'); input.onSubmit();
      assert.equal(calls.length, previous, 'retired standalone empty-focus callbacks cannot borrow live permission');
      samples.push({ kind: id, width, scale, tab, buttons: buttons.length, glyph: 16, paint: 32,
        targetWidth: 32, targetHeight: Math.max(44, owner.controlFieldHeight()), complete44: false, conflict: 'neighbor' });
    }
    const legacy = toolbarSource.replace("return this.directoryMounted && (id.length === 0 || (id === this.directoryFocusId && this.directoryFocusCurrent(id)));",
      "return id.length === 0 || (this.directoryMounted && id === this.directoryFocusId && this.directoryFocusCurrent(id));");
    assert.notEqual(legacy, toolbarSource);
    const retired = mountedToolbar(316, 1, 'directory', 'full-directory', legacy);
    retired.owner.aboutToDisappear();
    const before = retired.calls.length;
    [...retired.owner.nodes.values()].find(node => node.type === 'Button').onClick();
    assert.ok(retired.calls.length > before, 'the old empty-focus lease admits an already retired actor');
    const shortToolRow = toolbarSource.replace("Row() { this.queryTools(inputFocusId); }.width('100%').height(this.controlFieldHeight() + 18)",
      "Row() { this.queryTools(inputFocusId); }.width('100%').height(50)");
    assert.notEqual(shortToolRow, toolbarSource);
    assert.throws(() => assertToolbarRows(mountedToolbar(316, 2, 'directory', 'full-directory', shortToolRow)), /both toolbar rows pay/);
    for (const scale of [1, 2]) {
      const manga = mountedToolbar(316, scale, 'directory', 'manga-catalog');
      assert.equal(manga.owner.controlToolbarHeight(), manga.owner.controlFieldHeight());
      const buttons = [...manga.owner.nodes.values()].filter(node => node.type === 'Button');
      assert.equal(buttons.length, 2, 'manga retains its sort and separately owned locate action');
      buttons[0].onClick(); assert.deepEqual(manga.calls, ['sort']);
      samples.push({ kind: id, variant: 'manga-catalog', scale, toolbar: manga.owner.controlToolbarHeight(), buttons: 1 });
    }
  }
  recordContractCasePass(id);
}
if (selected.length) {
  const output = new URL('../.reader-artifacts/ui-full-fix-20261113/oracle-directory-toolbar/' + selected.join('+') + '/', import.meta.url);
  mkdirSync(output, { recursive: true });
  writeFileSync(new URL('sdk-report.json', output), JSON.stringify({ result: 'PASS', selected, samples, finiteCompatibility: compatibilitySamples,
    fonts: Object.entries(fonts).map(([family, path]) => ({ family, path: path.pathname, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') })),
    boundary: 'Actual production layout/budget and SDK field/actions with bundled-font advances. Native layout, physical hit delivery, IME and pixel acceptance remain separate.' }, null, 2) + '\n');
  console.log(JSON.stringify({ selected, samples: samples.length, result: 'PASS' }));
}
