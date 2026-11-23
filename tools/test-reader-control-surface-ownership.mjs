import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { readerFoundationTokens } from './lib/reader-tokens-probe.mjs';
import { readerControlNativeTree } from './fixtures/reader-control-native-tree.mjs';
import * as motion from '../entry/src/main/ets/features/reading/ui/ReaderControlMotionGeometry.ts';
import { sampleReaderControlAutoPage } from '../entry/src/main/ets/features/reading/ui/ReaderControlPlaybackGeometry.ts';
import { sampleReaderControlReplace } from '../entry/src/main/ets/features/reading/ui/ReaderControlReplaceGeometry.ts';
import { READER_CONTROL_HOME_QUICK_ACTION_HEIGHT } from '../entry/src/main/ets/features/reading/ui/ReaderControlGeometry.ts';
import { readerControlMorphScrollExtent } from '../entry/src/main/ets/features/reading/ui/ReaderControlMorphScroll.ts';

const definitions = {
  'surface-owner': {
    description: 'Actual Panel and child viewport paints preserve each original Quick/Full surface owner, rect, alpha and drawing order.',
    resources: [],
  },
};
const read = name => readFileSync(new URL('../entry/src/main/ets/features/reading/ui/' + name, import.meta.url), 'utf8');
const panelSource = read('ReaderControlPanel.ets');
const bounds = motion.readerControlMotionBounds(364, 736, 19, 330);
const noop = () => {};
const near = (a, b, why) => assert.ok(Math.abs(a - b) < 1e-8, `${why}: ${a}/${b}`);
const rect = node => ({ x: node.position?.x ?? 0, y: node.position?.y ?? 0, width: node.width, height: node.height });
const frameRect = actor => ({ x: actor.x, y: actor.y, width: actor.width, height: actor.height });
const allNodes = owner => [...owner.nodes.values()];
const tree = () => readerControlNativeTree(['Stack', 'Row', 'Column', 'Scroll', 'Text']);
const deps = { ...motion, ...readerFoundationTokens, READER_CONTROL_HOME_QUICK_ACTION_HEIGHT, readerControlMorphScrollExtent };

function panel(location, source = panelSource, counterfactualIdPrefix = '') {
  const recorder = tree();
  // A moved counterfactual changes SDK source locations. Give only that
  // fixture its own native id namespace so the compiler's global id map
  // cannot confuse it with the already-compiled actual production method.
  const compiledSource = counterfactualIdPrefix.length === 0 ? source :
    source.replaceAll(".id('reader-control-", `.id('${counterfactualIdPrefix}reader-control-`);
  const { owner } = createReaderBuilderProbe(compiledSource, ['build'], { ...deps, ...recorder.dependencies },
    { ...recorder.hooks, childSources: { ReaderSessionLaunchStage: read('ReaderSessionLaunchStage.ets') } });
  let current = motion.sampleReaderControlMotionComposition({ visibilityProgress: 1, expansionProgress: 0 }, bounds);
  let contentOrder;
  Object.assign(owner, { currentLayout: () => ({ viewportWidth: 390, viewportHeight: 844, fullPanelWidth: 364,
    topBarWidth: 360, topBarHeight: 54, topBarTop: 19 }), frame: () => current,
    contentLocation: () => location, controlActorsRetained: true, launchSample: undefined,
    appScheme: 'day', inputEnabled: true, controlObscured: false, visualHeldPointerId: -1,
    temporaryLayerActive: false, moreMenuVisible: false,
    topBar: noop, controlHeader: noop, headerAction: noop, headerGrabCap: noop,
    brightnessRail: noop, moduleNavBar: noop, accessibleControlActions: noop,
    topBarInputEnabled: () => true, contentInputEnabled: () => true, navigationInputEnabled: () => true,
    controlPanelHeight: () => 736, dockLeft: () => 13, dockTop: () => 89,
    controlTouchHandler: () => noop,
    controlContent() {
      if (contentOrder === undefined) contentOrder = Math.max(...allNodes(owner)
        .map(node => node.creationOrder).filter(Number.isFinite));
    },
  });
  owner.initialRender();
  const byId = id => allNodes(owner).find(node => node.id === counterfactualIdPrefix + id);
  const ids = ['reader-control-quick-content-surface', 'reader-control-content-outline',
    'reader-control-full-content-surface', 'reader-control-full-content-outline'];
  const identities = ids.map(byId);
  assert.ok(identities.every(Boolean), 'all paired source drawing leaves stay mounted');
  return { owner, sample(p) {
    current = motion.sampleReaderControlMotionComposition({ visibilityProgress: 1, expansionProgress: p }, bounds);
    owner.replay();
    assert.equal(recorder.remaining(), 0);
    ids.forEach((id, index) => assert.equal(byId(id), identities[index], 'paint node identity survives every progress sample'));
    return { frame: current, quickFill: byId(ids[0]), quickStroke: byId(ids[1]),
      fullFill: byId(ids[2]), fullStroke: byId(ids[3]), contentOrder };
  } };
}

// Actual child viewport Builders are compiled separately against the same
// parent-selected width/height. Interior business actors are finite ports.
// These records establish paint ownership, not complete child/native layout.
function childPaint(group, p, frame) {
  const width = frame.content.width, height = frame.content.height;
  if (group.level === 'home') {
    for (const method of ['chapterProgress', 'quickActionPanel']) {
      const { owner } = createReaderBuilderProbe(panelSource, [method], deps);
      Object.assign(owner, { appScheme: 'day', homeChapterCardHeight: () => 106,
        homeMetric: (_key, fallback) => fallback, chapterRow: noop, progressRow: noop, quickAction: noop });
      owner[method]();
      const paint = allNodes(owner).find(node => node.border?.width === 1);
      assert.equal(paint.borderRadius, 8, 'Home retains each individual card role');
    }
    return [];
  }
  const files = { directory: 'ReaderControlDirectoryContent.ets', appearance: 'ReaderControlAppearanceContent.ets',
    settings: 'ReaderControlSettingsContent.ets', search: 'ReaderControlSearchContent.ets',
    autoPage: 'ReaderControlAutoPageContent.ets', replace: 'ReaderControlReplaceContent.ets', tts: 'ReaderControlTtsContent.ets' };
  const method = group.module === 'autoPage' ? 'normalContent' : group.module === 'tts' ? 'quickBackdrop' : 'build';
  const { owner } = createReaderBuilderProbe(read(files[group.module]), [method], deps);
  const genericFrame = { divider: { x: 0, y: 0, width: 0, opacity: p }, contentTranslateX: 0,
    queryDivider: { x: 0, y: 0, width, height: 1 }, list: { x: 0, y: 0, width, height },
    content: { x: 0, y: 0, width, height }, details: { x: 0, y: 0, width, height },
    progress: p, actionHeight: 28, statusHeight: 76 };
  Object.assign(owner, { availableWidth: width, availableHeight: height, appScheme: 'day', appThemeScheme: 'day',
    preparedMinimumRequired: false, sourceDetached: false, sourceOnly: 'none', form: p === 1 ? 'full' : 'quick',
    motionProgress: p, progress: p, p: () => p, shortContent: true, tab: group.directoryTab,
    currentInputEnabled: () => true, currentEditorInputEnabled: () => true, fullInput: () => p === 1,
    actorId: () => '',
    quickMinimumScrollInput: () => false, quickFlowInput: () => false,
    frame: () => group.module === 'autoPage' ? sampleReaderControlAutoPage(p, width) :
      group.module === 'replace' ? sampleReaderControlReplace(p, width, height) : genericFrame,
    listHeight: () => height, listTop: () => 0, listBody: noop, presentation: () => ({ contentOpacity: 1, contentBlur: 0 }),
    searchField: noop, searchAction: noop, resultsBody: noop, quickBack: noop,
    quickHeader: noop, controlSection: noop, timerSection: noop, moduleHeader: noop, speedRow: noop, followHighlightRow: noop,
    syncMorphScroll: noop, quickScrollMotion: { fullScrollOffset: 0, nativeScrollOffset: 0 },
    scrollMotion: { fullScrollOffset: 0, nativeScrollOffset: 0 }, quickFlowContentHeight: () => height,
    quickScrollTranslation: () => 0, ruleToolbar: noop, statusContent: noop, textAction: noop, quickFooter: noop,
    displayState: () => ({ rules: [], errorMessage: '' }), displayedFacts: () => ({ statusVisible: false }),
    displayLayer: () => '', listContentMinHeight: () => height, sharedScrollTranslation: () => 0,
    fullOnlyScrollTranslation: () => 0,
    themeHeaders: noop, themeIds: () => [], themeAction: noop, fontHeaders: noop, fontIds: () => [], layoutLibrary: noop,
    actorPosition: value => ({ x: value.x, y: value.y }), scrollContentHeight: () => height,
    scrollInput: () => true, draggedFontId: '', openSelect: '', selectOverlay: noop,
    screenGroup: noop, addedGroup: noop,
  });
  if (method === 'build') owner.initialRender();
  else owner[method]();
  const paints = allNodes(owner).filter(node => node.width === width && node.height === height &&
    typeof node.border?.width === 'number' && node.border.width > 0);
  if (['search', 'autoPage', 'replace'].includes(group.module)) {
    assert.equal(paints.length, 1, 'child-owned module keeps exactly its original viewport border');
    assert.equal(paints[0].borderRadius, 12);
    assert.equal(paints[0].opacity ?? 1, 1);
  } else if (group.module === 'tts') {
    assert.equal(paints.length, 1);
    near(paints[0].opacity, 1 - p, 'actual TTS Quick backdrop alpha');
    assert.equal(paints[0].border.width, .5);
    assert.equal(paints[0].borderRadius, 8);
  } else assert.equal(paints.length, 0, 'shared surface group keeps its outer child viewport unbordered');
  return paints;
}

function check(group, p, fixture, source = panelSource) {
  const result = fixture.sample(p), { frame, quickFill, quickStroke, fullFill, fullStroke } = result;
  const commonQuick = group.level !== 'home' && ['directory', 'appearance', 'settings'].includes(group.module);
  const commonFull = ['directory', 'tts', 'appearance', 'settings'].includes(group.module);
  near(quickFill.opacity, commonQuick ? 1 - p : 0, 'shared Quick fill alpha');
  near(quickStroke.opacity, commonQuick ? 1 - p : 0, 'shared Quick stroke alpha');
  near(fullFill.opacity, commonFull ? p : 0, 'source Full fill alpha');
  near(fullStroke.opacity, commonFull ? p : 0, 'source Full stroke alpha');
  assert.deepEqual(rect(quickStroke), frameRect(frame.content), 'Quick stroke uses its moving Quick viewport actor');
  assert.deepEqual(rect(fullStroke), frameRect(frame.contentSurface), 'Full stroke uses the fixed source Full surface actor');
  assert.deepEqual(rect(fullFill), rect(fullStroke), 'Full fill and stroke remain paired to one source rect');
  assert.equal(fullFill.border, undefined, 'Full fill does not paint a second hidden stroke');
  assert.equal(fullStroke.borderRadius, 12);
  assert.equal(quickStroke.borderRadius, 8 + 4 * p);
  assert.ok(fullStroke.creationOrder > result.contentOrder,
    `Full stroke is after the actual content mount subtree: ${fullStroke.creationOrder}/${result.contentOrder}`);
  assert.ok(fullFill.creationOrder < result.contentOrder, 'original Full fill stays below the content subtree');
  for (const paint of [quickFill, quickStroke, fullFill, fullStroke]) assert.equal(paint.hitTestBehavior, 'HitTestMode.None');
  const child = childPaint(group, p, frame);
  const visible = [quickStroke, fullStroke, ...child].filter(node => (node.opacity ?? 1) > 0);
  if (['search', 'autoPage', 'replace'].includes(group.module)) assert.equal(visible.length, 1,
    'only the child paints its original viewport surface throughout morph');
  else if (group.level !== 'home') assert.equal(visible.length, p === 0 || p === 1 ? 1 : 2,
    'distinct Quick and fixed Full source actors coexist only during morph');
  if (p > 0 && p < 1 && commonFull) assert.notDeepEqual(rect(quickStroke), rect(fullStroke),
    'source Full and moving viewport rects are distinct during morph');
  return result;
}

function checkReferenceStage(group) {
  const recorder = tree();
  const { owner } = createReaderBuilderProbe(read('ReaderControlMotionStage.ets'),
    ['build', 'topBarContent', 'moduleContent', 'fullHeaderContent', 'brightnessContent', 'navigationContent'],
    { ...deps, ...recorder.dependencies, readerControlContentLocation: () => group }, recorder.hooks);
  let current = motion.sampleReaderControlMotionComposition({ visibilityProgress: 1, expansionProgress: 0 }, bounds);
  Object.assign(owner, { frame: () => current, bounds: () => bounds, contentModule: () => group.module,
    visualSession: { heldPointerId: -1 }, inputEnabled: true,
    topBarContent: noop, topBarWidthValue: () => 364, viewportWidthValue: () => 390,
    viewportHeightValue: () => 844, topBarTopValue: () => 19,
    topBarFrame: () => ({ opacity: 1, translateY: 0 }), dockLeftValue: () => 13, dockTopValue: () => 88,
    fullContentMountWidth: () => 338, fullContentMountHeight: () => 666,
    moduleContent: noop, fullHeaderContent: noop, brightnessContent: noop, navigationContent: noop,
    accessibleControlActions: noop });
  owner.initialRender();
  const surface = allNodes(owner).find(node => node.id === 'reader-control-verification-content-surface');
  assert.ok(surface);
  let samples = 0;
  for (const p of group.level === 'home' ? [0] : [0, .25, .5, .75, 1]) {
    current = motion.sampleReaderControlMotionComposition({ visibilityProgress: 1, expansionProgress: p }, bounds);
    owner.replay();
    assert.equal(recorder.remaining(), 0);
    assert.equal(allNodes(owner).find(node => node.id === surface.id), surface);
    assert.deepEqual(rect(surface), frameRect(current.contentSurface), 'reference Full source keeps the same fixed actor rect');
    near(surface.opacity, motion.readerControlHasFullContentSurface(group.module) ? p : 0, 'reference Full source alpha');
    assert.equal(surface.border.width, 1); assert.equal(surface.borderRadius, 12);
    samples++;
  }
  return samples;
}

for (const id of selectContractCases(definitions)) {
  const original = JSON.parse(readFileSync(new URL('./fixtures/reader-control-shared-layer-live-20260906.json', import.meta.url), 'utf8'));
  for (const node of original.sources.surfaces.nodes) {
    if (node.name === 'AddedActor/FullContentSurface') {
      assert.equal(node.strokeWeight, 1); assert.equal(node.cornerRadius, 12);
      assert.equal(node.strokes.length, 1); assert.equal(node.parentIndex, 1);
      assert.deepEqual([node.x - 13, node.y - 89, node.width, node.height], [13, 57, 338, 666]);
    } else assert.deepEqual([node.fills.length, node.strokes.length, node.parentIndex], [0, 0, 2]);
  }
  const groups = [
    { name: 'Home', level: 'home', module: 'directory', directoryTab: 'directory', form: 'quick' },
    ...['directory', 'tts', 'appearance', 'settings', 'search', 'autoPage', 'replace'].map(module =>
      ({ name: module, level: 'secondary', module, directoryTab: 'directory', form: 'quick' })),
    { name: 'bookmarks', level: 'secondary', module: 'directory', directoryTab: 'bookmarks', form: 'quick' },
  ];
  let samples = 0;
  let referenceSamples = 0;
  for (const group of groups) {
    const fixture = panel(group);
    for (const p of group.level === 'home' ? [0] : [0, .25, .5, .75, 1]) {
      check(group, p, fixture); samples++;
    }
    referenceSamples += checkReferenceStage(group);
  }
  for (const module of [undefined, 'home', 'search', 'autoPage', 'replace', 'tts', 'unknown'])
    assert.equal(motion.readerControlHasQuickContentSurface(module), false);

  const oldQuick = panelSource.replaceAll('readerControlHasQuickContentSurface(this.contentLocation().module)',
    "this.contentLocation().module !== 'tts'");
  assert.notEqual(oldQuick, panelSource);
  for (const module of ['search', 'autoPage', 'replace']) {
    const group = { level: 'secondary', module, directoryTab: 'directory', form: 'quick' };
    assert.throws(() => check(group, 0, panel(group, oldQuick)), /shared Quick fill alpha/,
      'old common admission duplicates a child-owned viewport');
  }
  const start = panelSource.indexOf("        Stack()\n          .id('reader-control-full-content-outline')");
  const end = panelSource.indexOf('.hitTestBehavior(HitTestMode.None);', start) + '.hitTestBehavior(HitTestMode.None);'.length;
  assert.ok(start > 0 && end > start);
  const block = panelSource.slice(start, end);
  const wrongRect = block.replaceAll('this.frame().contentSurface.width', 'this.frame().content.width')
    .replaceAll('this.frame().contentSurface.height', 'this.frame().content.height')
    .replaceAll('this.frame().contentSurface.x', 'this.frame().content.x')
    .replaceAll('this.frame().contentSurface.y', 'this.frame().content.y');
  const wrongRectSource = panelSource.slice(0, start) + wrongRect + panelSource.slice(end);
  const directory = { level: 'secondary', module: 'directory', directoryTab: 'directory', form: 'quick' };
  assert.throws(() => check(directory, .5, panel(directory, wrongRectSource)), /fixed source Full surface actor/,
    'old moving-viewport Full stroke geometry fails the original source rect');
  const mount = panelSource.indexOf('        Stack({ alignContent: Alignment.TopStart }) {\n          Stack({ alignContent: Alignment.TopStart }) { this.controlContent(); }');
  assert.ok(mount > 0 && mount < start);
  const behindSource = panelSource.slice(0, mount) + block + '\n' + panelSource.slice(mount, start) + panelSource.slice(end);
  assert.throws(() => check(directory, .5, panel(directory, behindSource, 'behind:')), /after the actual content mount subtree/,
    'stroke below opaque content loses the existing drawing-order protection');
  console.log(JSON.stringify({ kind: id, samples, referenceSamples, moduleIds: 7, presentationGroups: 9, secondarySamples: 40, homeQuickSamples: 1,
    sourceFullRectAtHalf: { x: 13, y: 260, width: 338, height: 666 },
    movingViewportAtHalf: { x: 13, y: 246, width: 312, height: 428 },
    oldQuickAdmissionNegatives: 3, oldFullRectNegative: true, behindContentStrokeNegative: true,
    boundary: 'Actual SDK paint-owner attributes and drawing order, child viewport Builders with finite interior ports. Native raster/gestures NOT_RUN.' }));
  recordContractCasePass(id);
}
