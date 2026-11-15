import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { foundationControls } from './lib/reader-foundation-control-probe.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
import { boundedSurfaceSdk, boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import { selectedProductionMethods, selectedProductionValues } from './lib/selected-production-methods.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { readerAppColor, readerThemeDefinition } from '../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts';
import { createDefaultReaderAppearanceSnapshot } from '../entry/src/main/ets/features/reading/application/ReaderAppearanceState.ts';
import { createDefaultReaderReadingLayout, ReaderReadingLayoutSnapshot } from '../entry/src/main/ets/features/reading/ui/ReaderLayoutGeometry.ts';
import { ReaderTtsWaveformMotion, createReaderTtsWaveformSample } from '../entry/src/main/ets/features/reading/ui/ReaderTtsWaveformModel.ts';
import { readerTtsConfigChoices } from '../entry/src/main/ets/features/reading/presentation/ReaderTtsConfigOptions.ts';

const root = new URL('../entry/src/main/ets/', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const selected = selectContractCases({
  'discover-current': 'Retained Discover book fields consume replacement same-id DTOs.',
  'rss-summary': 'Retained RSS detail paragraphs consume same-guid readback.',
  'sync-history': 'Read-only history slots preserve distinct same-minute and legacy records.',
  'rule-preview': 'Two actual directory previews update retained result text.',
  'text-directory': 'Retained text nodes consume current title, level, availability and actions.',
  'reading-fragments': 'Actual page-turn surface provider updates retained native and fallback text payloads.',
  'waveform-current': 'Retained waveform bars consume current base height, scale and opacity.',
  'tts-choice-current': 'Retained TTS options consume current visible and accessibility labels.',
  'tts-picker-capacity': 'Non-manager TTS overlays fit positive short slots and share a bounded scroll.',
});

function discoverCurrent(source) {
  const controls = foundationControls();
  const { owner } = createReaderBuilderProbe(source,
    ['presentation', 'appThemeScheme', 'mounted', 'lastReadFeedback', 'readFeedbackIdentity',
      'resultList', 'resultRow', 'currentBook'],
    { ...controls.dependencies, ...readerTypographyRoles, readerAppColor, EMPTY_DISCOVER_PRESENTATION: { books: [] } }, controls.hooks);
  const first = { sourceId: 'source', bookId: 'book', name: '旧标题', author: '旧作者',
    intro: '旧简介', coverUrl: 'https://example.invalid/old.png' };
  Object.assign(owner, { presentation: { books: [first] }, paginationRow() {} });
  owner.resultList();
  const image = controls.nodes(owner).find(node => node.type === 'Image');
  const title = controls.nodes(owner).find(node => node.type === 'Text' && node.create === '旧标题');
  const current = { ...first, name: '当前标题', author: '当前作者', intro: '当前简介',
    coverUrl: 'https://example.invalid/current.png' };
  owner.updateStateVars({ presentation: { books: [current] } });
  controls.properties.flush();
  assert.equal(image.create, current.coverUrl, 'current Discover cover');
  assert.equal(title.create, current.name, 'current Discover title');
  const texts = controls.nodes(owner).filter(node => node.type === 'Text').map(node => node.create);
  assert.ok(texts.includes(current.author) && texts.includes(current.intro), 'current Discover metadata');
  assert.equal(controls.nodes(owner).find(node => node.type === 'Image'), image);
  return { currentFields: 4 };
}

function rssSummary(source) {
  const controls = foundationControls();
  const { owner } = createReaderBuilderProbe(source, ['item', 'appThemeScheme', 'summaryBodyCard', 'summaryParagraphs'],
    { ...controls.dependencies, ...readerTypographyRoles, readerAppColor }, controls.hooks);
  const first = { subscriptionId: 'source', guid: 'entry', description: '旧第一段\n旧第二段' };
  owner.item = first;
  owner.summaryBodyCard();
  const paragraphs = controls.nodes(owner).filter(node => node.type === 'Text' && node.create.startsWith('旧'));
  owner.updateStateVars({ item: { ...first, description: '当前第一段\n当前第二段' } });
  controls.properties.flush();
  assert.deepEqual(paragraphs.map(node => node.create), owner.summaryParagraphs(), 'current RSS summary');
  assert.equal(paragraphs.length, 2);
  return { retainedParagraphs: paragraphs.length };
}

function syncHistory(source) {
  const gateway = new URL('features/sync/application/SyncGateway.ts', root);
  const { DEFAULT_WEBDAV_DIRECTORY } = selectedProductionValues(gateway, ['DEFAULT_WEBDAV_DIRECTORY']);
  const { DEFAULT_SYNC_SNAPSHOT } = selectedProductionValues(gateway, ['DEFAULT_SYNC_SNAPSHOT'], { DEFAULT_WEBDAV_DIRECTORY });
  const controls = foundationControls();
  const { owner } = createReaderBuilderProbe(source,
    ['snapshot', 'appThemeScheme', 'historySection', 'historyRow', 'onSnapshotChanged', 'syncSnapshotInputs',
      'appliedSnapshotIdentity', 'acknowledgedSaveGeneration', 'webdavUrl', 'webdavUser', 'webdavPath',
      'webdavPass', 'backupPass', 'webdavUrlEdited', 'webdavUserEdited', 'webdavPathEdited'],
    { ...controls.dependencies, ...readerTypographyRoles, readerAppColor, DEFAULT_SYNC_SNAPSHOT,
      LengthMetrics: { vp: value => value } }, controls.hooks);
  const legacy = { timestamp: '2026-11-16 02:25', destination: 'WebDAV', size: 1048576, ok: true };
  Object.assign(owner, { snapshot: { ...DEFAULT_SYNC_SNAPSHOT, history: [legacy] },
    contentFrame: () => ({ width: 300 }), sectionHeadingMuted() {}, emptyState() {} });
  owner.historySection();
  const firstSize = controls.nodes(owner).find(node => node.type === 'Text' && node.create === '1.0 MB');
  const update = history => {
    owner.updateStateVars({ snapshot: { ...DEFAULT_SYNC_SNAPSHOT, history } });
    controls.properties.flush();
  };
  update([{ ...legacy, size: 2097152 }, legacy]);
  const sizes = () => controls.nodes(owner).filter(node => node.type === 'Text' && / MB$/.test(node.create));
  assert.deepEqual(sizes().map(node => node.create), ['2.0 MB', '1.0 MB'], 'both same-minute history records');
  assert.equal(sizes()[0], firstSize, 'current ordered slot preserves its actor');
  update([legacy, { ...legacy, size: 2097152, ok: false, destination: '本地' }]);
  assert.deepEqual(sizes().map(node => node.create), ['1.0 MB', '2.0 MB']);
  const texts = controls.nodes(owner).filter(node => node.type === 'Text').map(node => node.create);
  assert.ok(texts.includes('失败') && texts.includes('本地'));
  update([legacy, legacy, legacy]);
  assert.equal(sizes().length, 3, 'identical legacy captions still own distinct ordered slots');
  return { sameMinuteRecords: 2, identicalLegacyRecords: 3 };
}

async function rulePreview(source) {
  const controls = foundationControls();
  const { owner } = createReaderBuilderProbe(source,
    ['rules', 'presentationGeneration', 'busy', 'loaded', 'previewReady', 'preview', 'message', 'operation',
      'availableWidthVp', 'availableHeightVp', 'scheme', 'focusTargetId', 'build', 'run',
      'actorIdentity', 'recoveryIdentity', 'recoveryView', 'publishRecovery'],
    { ...controls.dependencies, ...readerTypographyRoles, LengthMetrics: { vp: value => value }, readerAppColor },
    { ...controls.hooks, allowEmptyBranchAdmission: true });
  let depth = 0;
  Object.assign(owner, { bookId: 'book', generation: 0, mounted: true, rules: [], preview: [], previewReady: false,
    message: 'loaded', loaded: true, busy: false, presentationGeneration: 1, interactionEnabled: true,
    canEdit: () => true, isPresentationCurrent: () => true, onRecoveryChanged() {},
    operation: { generation: 0, confirmation: 'undispatched', blocked: false },
    gateway: { ownsRuntime: () => true, supportsApply: () => true,
      snapshot: () => ({ generation: 0, confirmation: 'undispatched', blocked: false }),
      preview: async () => ({ status: 'ready', nodeCount: 1, readableChapterCount: 1,
        nodes: [{ depth, title: '第一章' }] }) } });
  owner.initialRender();
  await owner.run(false);
  controls.properties.flush(); owner.replay(); controls.properties.flush();
  const text = controls.nodes(owner).find(node => node.type === 'Text' && node.create === '第一章');
  assert.ok(text);
  depth = 2;
  await owner.run(false);
  controls.properties.flush(); owner.replay(); controls.properties.flush();
  assert.equal(text.create, '    第一章', 'current rule preview');
  assert.equal(owner.previewReady, true);
  return { previews: 2, retainedTextId: text.id };
}

function textDirectory(source) {
  const controls = foundationControls();
  const { owner } = createReaderBuilderProbe(source,
    ['view', 'rowPresentationRevision', 'onViewChanged', 'row', 'displayLevel', 'currentPaintNode', 'textRowAccessibility'],
    controls.dependencies, controls.hooks);
  let current = { nodeId: 'entry:7', title: '旧章节名', depth: 1, kind: 'target', chapterIndex: 7,
    hasChildren: false, expanded: false };
  const actions = [];
  Object.assign(owner, { mounted: false, rowHeight: 44, rowPresentationRevision: 0, interactionEnabled: true, appThemeScheme: 'day',
    view: { viewId: 'view' }, chapterByIndex: new Map(), isCurrentNode: () => false,
    dataSource: { currentView: () => owner.view, loadedItemById: () => ({ node: current, index: 7 }) },
    toggleNode: node => actions.push(node), selectTarget: node => actions.push(node) });
  owner.row({ key: current.nodeId, index: 7, node: current });
  const text = [...owner.nodes.values()].find(node => node.type === 'Text' && node.create === current.title);
  current = { ...current, title: '当前章节名', depth: 3, kind: 'disabled' };
  owner.rowPresentationRevision += 1;
  controls.properties.flush();
  assert.equal(text.create, current.title, 'current text directory title');
  assert.match(text.accessibilityText, /当前章节名，目标不可用/);
  assert.equal(text.enabled, false);
  current = { ...current, kind: 'target', chapterIndex: 9 };
  owner.rowPresentationRevision += 1;
  controls.properties.flush();
  assert.match(text.accessibilityText, /第3级，打开当前章节名/);
  text.onClick();
  assert.equal(actions.at(-1), current, 'action consumes current canonical candidate');
  return { payloadReplacements: 2, retainedTextId: text.id };
}

function readingFragments(source, native = true) {
  const properties = createArkUIPropertyRuntimeProbe();
  class Child {
    constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
    updateStateVars(params) { Object.assign(this.params, params); }
  }
  const fields = ['snapshotSynchronousImages', 'chapterTitle', 'showChapterTitle', 'pageParagraphs', 'pageFragments',
    'contentRevision', 'staticSnapshotId', 'highlightTextureIdentity', 'fragmentsProvider', 'layout', 'appearance',
    'ttsHighlightStart', 'ttsHighlightEnd', 'autoPageHighlightStart', 'autoPageHighlightEnd', 'bottomJustifyGap',
    'longPressSelectText', 'chromeTopStartText', 'chromeTopEndText', 'chromeTopTranslateY', 'chromeBottomStartText',
    'chromeBottomEndText', 'chromeSessionVisible', 'chromeSessionWidth', 'chromeSessionHeight', 'bookmark',
    'bookmarkMode', 'bookmarkOpacity', 'highlightMounted', 'highlightCanvasReady'];
  function createSurface(params) {
    return createReaderBuilderProbe(source, [...fields, 'build', 'renderFragments', 'currentFragment',
    'contentInsets', 'themeStyle', 'usesHighlightCanvas', 'onHighlightContentChanged', 'scheduleDynamicHighlights',
    'enqueueHighlightMeasurement', 'dynamicHighlightBlend'],
  { ...properties.sdk, Canvas: new Proxy({}, { get: () => () => {} }), BlendApplyType: { FAST: 0 },
    BlendMode: { SRC_OVER: 0, MULTIPLY: 1 }, ReaderReadingLayoutSnapshot, createDefaultReaderAppearanceSnapshot,
    createDefaultReaderReadingLayout, readerAppearanceThemeStyle: () => ({ ink: '#111111', paperStart: '#ffffff' }),
    readerThemeDefinition, readerNativeTextGeometryKey: style => JSON.stringify(style),
    ReaderPaperBackground: Child, ReaderPageChrome: Child, ReaderNativeParagraphView: Child, ReaderReadingTextFragment: Child },
  { ...properties.hooks, componentName: 'ReadingSurface', initialParams: params, allowEmptyBranchAdmission: true, childSources: {
    ReaderPaperBackground: read('features/reading/ui/ReaderPaperBackground.ets'),
    ReaderPageChrome: read('features/reading/ui/ReaderPageChrome.ets'),
    ReaderNativeParagraphView: read('features/reading/ui/ReaderNativeParagraphView.ets'), ReaderReadingTextFragment: source,
  } }).owner;
  }
  let surface;
  class SurfaceChild extends Child {
    constructor(...args) { super(...args); surface = createSurface(this.params); surface.initialRender(); }
    updateStateVars(params) { super.updateStateVars(params); surface.updateStateVars(params); }
  }
  const stageSource = read('features/reading/ui/ReaderPageTurnStage.ets');
  const carrierSource = stageSource.slice(stageSource.lastIndexOf('@Component', stageSource.indexOf('struct ReaderPageTurnSurface')),
    stageSource.indexOf('/**\n * Presentation-only stage'));
  const stage = createReaderBuilderProbe(carrierSource, boundedMembers(carrierSource),
    { ...properties.sdk, ReadingSurface: SurfaceChild, ReaderReadingLayoutSnapshot,
      createDefaultReaderAppearanceSnapshot, createDefaultReaderReadingLayout, readerThemeDefinition,
      COVER_OCCLUSION_RADIUS_VP: 16, COVER_OCCLUSION_OFFSET_X_VP: 6 },
    { ...properties.hooks, componentName: 'ReaderPageTurnSurface', childSources: { ReadingSurface: source } }).owner;
  const style = { widthVp: 300, fontFamily: 'system', fontSize: 20, fontWeight: 400, lineHeight: 30,
    letterSpacing: 0, color: '#111111', alignment: 0, breakAll: false };
  const first = { id: 'chapter-0:paragraph-0-0:0-4', text: '旧正文甲', startScalar: 0, endScalar: 4,
    isParagraphStart: true, imageHeight: 0, nativeParagraphFirst: true,
    nativeParagraph: native ? { key: 'old-recipe', text: '旧正文甲', startScalar: 0, firstLine: 0, lastLine: 0, style } : undefined };
  let current = [first];
  Object.assign(stage, { chapterTitle: 'chapter', showChapterTitle: false, pageFragmentsProvider: () => current,
    renderRevision: 1, slotIdentity: 'physical-slot-a', pageIdentity: 'chapter-0', pageVisible: true });
  stage.initialRender();
  const paragraph = [...surface.children.values()].find(child => native ? child.params.recipe : child.params.text === first.text);
  assert.ok(paragraph);
  const replace = fragment => {
    current = [fragment];
    stage.updateStateVars({ renderRevision: stage.renderRevision + 1 });
    properties.flush();
  };
  replace({ ...first, text: '新正文乙', nativeParagraph: native ? { ...first.nativeParagraph, key: 'current-recipe', text: '新正文乙' } : undefined });
  assert.equal(native ? paragraph.params.recipe.text : paragraph.params.text, '新正文乙', 'current retained reader text');
  if (native) assert.equal(paragraph.params.recipe.key, 'current-recipe');
  assert.equal(surface.pageFragments.length, 0, 'normal Stage provider path keeps the direct array default empty');
  assert.ok([...surface.children.values()].includes(paragraph));
  if (native) readingFragments(source, false);
  return { native, sameIdUpdates: 1, physicalSlots: stage.children.size };
}

function waveformCurrent(source) {
  const sdk = boundedSurfaceSdk();
  const owner = sdk.consumer(source, boundedMembers(source), { createReaderTtsWaveformSample,
    readerAppColor: () => '#FF333333', readerHighlightColor: () => [0.2, 0.2, 0.2, 1] });
  owner.liveSample = createReaderTtsWaveformSample();
  owner.initialRender();
  const bars = sdk.nodes(owner).filter(node => node.type === 'Row' && node.width === 2.5);
  assert.equal(bars.length, 24);
  const ids = bars.map(node => node.id);
  const motion = new ReaderTtsWaveformMotion({ ease: value => value, easeInOut: value => value });
  motion.setPlaying(true, 0);
  const playing = motion.sample(300);
  motion.setPlaying(false, 400);
  const stopped = motion.sample(800);
  motion.setPlaying(true, 900);
  for (const sample of [playing, stopped, motion.sample(1000, true), createReaderTtsWaveformSample()]) {
    owner.liveSample = sample;
    sdk.properties.flush(); owner.replay(); sdk.properties.flush();
    assert.deepEqual(bars.map(node => node.height), sample.heights, 'current waveform base heights');
    assert.deepEqual(bars.map(node => node.scale.y), sample.scales);
    assert.deepEqual(bars.map(node => node.opacity), sample.opacities);
    assert.ok(bars.every(node => node.backgroundColor === owner.barColor()));
  }
  owner.frozen = true;
  owner.frozenSample = playing;
  sdk.properties.flush(); owner.replay(); sdk.properties.flush();
  assert.deepEqual(bars.map(node => node.height), playing.heights);
  assert.deepEqual(bars.map(node => node.id), ids);
  return { retainedBars: bars.length, samples: 5 };
}

function ttsDependencies() {
  const measurement = pureModuleProbe(read('features/reading/ui/ReaderControlTextMeasurement.ets'),
    'ReaderControlTextMeasurement.ets', { WordBreak: { BREAK_WORD: 'break' } }, ['measureReaderControlText']);
  const context = { px2vp: value => value, getMeasureUtils: () => ({
    measureText: options => [...options.textContent].length * Number.parseFloat(options.fontSize),
    measureTextSize: options => ({ width: Math.min(options.constraintWidth,
      [...options.textContent].length * Number.parseFloat(options.fontSize)),
    height: Number.parseFloat(options.lineHeight ?? options.fontSize) * 1.5 }),
  }) };
  return { ...measurement, readerFontFamilyReady: () => true,
    ReaderWindowCoordinator: { metrics: () => ({ systemFontScale: 1 }) }, uiContext: context };
}

function ttsChoiceCurrent(source) {
  const sdk = boundedSurfaceSdk();
  const first = readerTtsConfigChoices('engine', 'system', [{ id: 77, name: '旧配置' }], []);
  let chosen = 0;
  const owner = sdk.consumer(source, boundedMembers(source), ttsDependencies(),
  { manager: false, title: '朗读引擎', selectionId: 'engine:1', availableWidth: 338, availableHeight: 666,
    choices: first, onChoose: async () => chosen++ });
  owner.aboutToAppear(); owner.initialRender();
  const text = sdk.nodes(owner).find(node => node.type === 'Text' && node.create === '在线 · 旧配置');
  const button = sdk.nodes(owner).find(node => node.type === 'Button' && node.accessibilityText === '在线 · 旧配置');
  const props = () => Object.fromEntries([...source.matchAll(/@Prop(?:\s+@Watch\([^)]*\))?\s+(\w+)\s*:/g)]
    .map(match => [match[1], owner[match[1]]]));
  owner.updateStateVars({ ...props(), choices: readerTtsConfigChoices('engine', 'system', [{ id: 77, name: '当前配置' }], []) });
  sdk.properties.flush(); owner.replay(); sdk.properties.flush();
  assert.equal(text.create, '在线 · 当前配置', 'current TTS choice text');
  assert.equal(button.accessibilityText, '在线 · 当前配置', 'current TTS choice accessibility');
  owner.updateStateVars({ ...props(), choices: [] });
  sdk.properties.flush();
  button.onClick();
  assert.equal(chosen, 0, 'retired option callback cannot select a removed id');
  return { visibleAndAccessibilityLabels: 2, removedCallbackRejected: true };
}

function ttsPickerCapacity(source) {
  const cases = [];
  for (const voicePicker of [false, true]) {
    for (const height of [0, 30, 44, 60, 100, 400]) {
      const sdk = boundedSurfaceSdk();
      let chosen = 0;
      const owner = sdk.consumer(source, boundedMembers(source), ttsDependencies(),
      { manager: false, voicePicker, windowModal: false, availableWidth: 286,
        availableHeight: height, modalUsableHeight: 844, appThemeScheme: 'day', choices: [{ id: 'system', label: '系统 TTS' }],
        message: '', errorText: '', anchorY: 0, showManage: false, selectionId: 'current-picker',
        onChoose: async () => chosen++ });
      owner.aboutToAppear();
      owner.initialRender();
      const frame = sdk.walk(owner).find(child => child instanceof sdk.deps.ReaderBoundedSurface);
      const box = [...frame.nodes.values()].find(node => node.type === 'Column');
      const carrier = [...owner.nodes.values()].find(node => node.type === 'Column' && node.position !== undefined);
      assert.ok(carrier.position.y >= 0 && carrier.position.y + box.height <= height, 'current TTS picker fits parent');
      const scrolls = [...owner.nodes.values()].filter(node => node.type === 'Scroll');
      assert.equal(scrolls.length, 1);
      assert.ok(scrolls[0].height <= box.height);
      const action = sdk.nodes(owner).find(node => node.type === 'Button' && node.accessibilityText === '系统 TTS');
      assert.ok(action && action.height >= 44, 'actual terminal choice stays inside the bounded scroll document');
      if (height > 0) {
        action.onClick();
        assert.equal(chosen, 1);
      }
      if (height === 44) assert.equal(box.height, 44, 'short slot retains all44vp when available');
      cases.push({ voicePicker, height, frameHeight: box.height, y: carrier.position.y });
    }
  }
  return { capacities: cases.length };
}

const cases = {
  'discover-current': ['features/discover/ui/DiscoverPage.ets', discoverCurrent, source => source.replaceAll('this.currentBook(book)', 'book')],
  'rss-summary': ['features/rss/ui/RssEntryDetailPage.ets', rssSummary, source => source.replace("this.summaryParagraphs()[index] ?? ''", 'paragraph')],
  'sync-history': ['features/sync/ui/SyncPage.ets', syncHistory, source => source.replace('`sync-history-${index}`', '`sync-history-${_entry.timestamp}`')],
  'rule-preview': ['features/reading/ui/ReaderDirectoryRules.ets', rulePreview, source => source.replace("this.preview[index] ?? ''", '_title')],
  'text-directory': ['features/reading/ui/ReaderDirectoryNavigationList.ets', textDirectory,
    source => source.replace('return revision >= 0 && this.dataSource.currentView()?.viewId === viewId ? current?.node ?? node : node;', 'return node;')],
  'reading-fragments': ['features/reading/ui/ReadingSurface.ets', readingFragments, source => source.replaceAll('this.currentFragment(fragment)', 'fragment')],
  'waveform-current': ['features/reading/ui/ReaderTtsWaveform.ets', waveformCurrent, source => source.replace('.height(this.sample().heights[index])', '.height(_height)')],
  'tts-choice-current': ['features/reading/ui/ReaderTtsConfigOverlay.ets', ttsChoiceCurrent, source => source.replaceAll('this.currentChoice(choice)', 'choice')],
  'tts-picker-capacity': ['features/reading/ui/ReaderTtsConfigOverlay.ets', ttsPickerCapacity, source => source
    .replace('Math.max(0, Math.min(content, this.availableHeight - 2 * this.pickerOuterPadding()))', 'Math.max(44, Math.min(content, this.availableHeight - 16))')
    .replace('const padding = this.pickerOuterPadding();', 'const padding = 8;')],
};
for (const id of selected) {
  const [path, run, mutate] = cases[id];
  const source = read(path);
  const result = await run(source);
  const old = mutate(source);
  assert.notEqual(old, source);
  await assert.rejects(async () => run(old), assert.AssertionError, 'old projection/capacity must fail a behavior assertion');
  console.log(JSON.stringify({ case: id, result, oldBehaviorNegative: 'REJECTED',
    scope: 'Actual production source and SDK/Host properties with finite platform ports. Native rendering and acceptance retain their own conditions.' }));
  recordContractCasePass(id);
}
