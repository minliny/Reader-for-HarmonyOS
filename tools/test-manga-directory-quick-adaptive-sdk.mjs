import { resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { mangaSurfaceSdkDependencies, mangaSurfaceBoundedControls } from './lib/manga-surface-sdk-probe.mjs';
import { mangaDirectoryAdaptiveFields, mangaDirectoryAdaptiveMembers, mangaDirectoryAdaptiveDependencies } from './lib/manga-directory-adaptive-probe.mjs';
import { MANGA_DIRECTORY_VISUAL as visual, mangaDirectoryQuickMinimumListHeight } from '../entry/src/main/ets/features/manga/MangaDirectoryVisual.ts';

const source = readFileSync(new URL('../entry/src/main/ets/features/manga/MangaReadingSurface.ets', import.meta.url), 'utf8');
// The real frontend registers all declared Builder names before lowering a
// selected branch. Inactive mode/settings/more remain outside this scope.
const require = createRequire(import.meta.url);
const sdkRoot = resolveEtsLoaderRoot();
const componentMap = require(`${sdkRoot}/lib/component_map.js`);
for (const match of source.matchAll(/@Builder\s+private (\w+)\(/g)) componentMap.CUSTOM_BUILDER_METHOD.add(match[1]);
const members = [...mangaDirectoryAdaptiveFields, ...mangaDirectoryAdaptiveMembers,
  'panelOverlay', 'isActionPanel', 'actionPanelInsets', 'actionPanelSurface', 'actionPanelHeader', 'actionPanelBody',
  'directoryPanel', 'directoryTools', 'directoryBody', 'directoryFallback',
  'directoryCurrentFooter', 'directoryCurrentTitle', 'directoryCurrentIndex', 'directoryCurrentPagePosition',
  'directoryFontScale', 'directoryToolHeight', 'directoryHeaderChrome', 'directoryInitialWidth', 'directoryQuickHeight',
  'onDirectoryMetricsChanged', 'panelHeight', 'panelContentHeight', 'panelContentInset', 'panelWidth',
  'settlePanel',
  'panelInsets', 'interactiveInsets', 'windowInteractiveInsets', 'controlsPresentedForWindow', 'pageOrdinal',
  'widePanel', 'persistentDirectory', 'directoryColumnWidth', 'adjacentChapter',
  'selectAdjacentChapter', 'accentColor', 'mutedColor', 'inkColor', 'lineColor', 'paperColor', 'surfaceColor', 'panelTitle'];

function fixture({ candidate = source, width = 320, height = 480, scale = 3.2 } = {}) {
  const timers = [], actions = [], animations = [];
  const state = { scale };
  const shared = mangaSurfaceBoundedControls();
  const { owner } = createReaderBuilderProbe(candidate, members, { ...mangaDirectoryAdaptiveDependencies, ...mangaSurfaceSdkDependencies, ...shared.deps,
    setTimeout: action => { timers.push(action); return timers.length; },
    curves: { interpolatingSpring: (...args) => ({ args }) },
    uiContext: { animateTo: (params, apply) => { apply(); animations.push(params); } },
    ReaderWindowCoordinator: { metrics: () => ({ systemFontScale: state.scale,
      systemInsets: { top: 0, right: 0, bottom: 0, left: 0 }, cutoutInsets: { top: 0, right: 0, bottom: 0, left: 0 },
      gestureInsets: { top: 0, right: 0, bottom: 0, left: 0 }, navigationInsets: { top: 0, right: 0, bottom: 0, left: 0 },
      statusBarRect: { top: 0, height: 0 } }) },
  }, shared.hooks);
  const entries = Array.from({ length: 681 }, (_, index) => ({ index: index * 2 + 1, title: 'Chapter ' + (index + 1), navigable: true }));
  Object.assign(owner, { mounted: true, sourceId: 'source', bookId: 'book', directoryOpenRevision: 3,
    panel: 'directory', panelPhase: 'open', panelGeneration: 1, panelOffset: 0, panelScrimOpacity: 1, backgroundPreference: 'paper',
    viewportWidth: width, viewportHeight: height, stageWidth: width, stageHeight: height,
    windowMetricsRevision: 0, quickHeaderMeasured: 0, quickToolsMeasured: 0, quickFooterMeasured: 0,
    directoryQuery: '', directoryAscending: true, directoryRevision: 0, publishedManifestVersion: 'manifest',
    controller: { chapter: { chapterIndex: 691 }, totalPages: 24 }, displayedPage: 4,
    directoryEntries: () => entries, isReaderIdentityCurrent: () => true,
    title: 'Chapter 346', horizontal: false, downloadEnabled: false, error: '', openingRetry: false,
    recovering: false, loginRequiredForControls: false, controlsVisible: true, chapterEnd: false,
    onWindowChromeChanged: () => actions.push('existing-chrome'),
  });
  owner.resetDirectoryOuterLayout();
  owner.panelOverlay();
  const nodes = [...owner.nodes.values()];
  const scroll = nodes.find(node => node.type === 'Scroll' && node.create === owner.directoryOuterScroller);
  const content = nodes.find(node => node.type === 'Column' && node.create?.space === 17 && node.padding?.bottom === 24);
  const tools = nodes.find(node => node.type === 'Flex' && node.onAreaChange);
  const tree = [...owner.children.values()].find(child => child.params.currentChapterIndex === 691 && child.params.mangaDisplay === true)?.params;
  assert.ok(scroll && content && tools && tree, 'actual SDK emits the existing outer Scroll, flow Column, measured tools and v2 child');
  const flush = () => { while (timers.length) timers.shift()(); };
  return { owner, state, nodes, scroll, content, tools, tree, flush, actions, animations };
}

function checkShort(candidate = source) {
  const f = fixture({ candidate });
  assert.equal(f.owner.panelHeight(), 374, '480vp actual app height owns the 78% panel cap');
  assert.equal(f.scroll.constraintSize.maxHeight, 243.6, 'outer Scroll excludes the actual 30 handle/100.4 header within the capped panel');
  assert.ok(Math.abs(f.owner.directoryQuickHeight() - 185.6) < .001, 'shared minimum is58×3.2; old44 cannot fit a70.4 line');
  assert.equal(f.tree.mangaCurrentOpenInset, 0, 'short list cannot spend50vp above the current row');
  // The native port supplies actual areas. These inputs are deliberately
  // asymmetric to prove we use measured tools rather than the fallback budget.
  f.tools.onAreaChange({}, { height: 149 });
  const toolsHeight = 149 + visual.toolsTop + visual.toolsBottom;
  const contentHeight = toolsHeight + 185.6 + 34 + 182 + 24;
  f.scroll.onAreaChange({}, { height: 243.6 });
  f.content.onAreaChange({}, { height: contentHeight });
  f.flush();
  assert.equal(f.owner.directoryOuterScroller.operations.length, 0, 'outer positioning waits for the real directory first-layout callback');
  f.tree.onFirstLayout(); f.flush();
  assert.deepEqual(f.owner.directoryOuterScroller.operations.at(-1), { xOffset: 0, yOffset: toolsHeight + 17, animation: false },
    'first current placement removes actual tools + flow gap from the outer intersection');
  const visibleListTop = toolsHeight + 17 - f.owner.directoryOuterScroller.currentOffset().yOffset;
  const referenceNamedRowHeight = 169.82; // Recorded browser VP48 row, not a native text measurement.
  assert.ok(visibleListTop + referenceNamedRowHeight <= Math.min(243.6, f.owner.directoryQuickHeight()),
    'the recorded reference row fits the declared list/outer intersection after zero inset');
  const count = f.owner.directoryOuterScroller.operations.length;
  f.scroll.onAreaChange({}, { height: 243.6 }); f.content.onAreaChange({}, { height: contentHeight }); f.tree.onFirstLayout(); f.flush();
  assert.equal(f.owner.directoryOuterScroller.operations.length, count, 'repeated areas/first-layout do not reposition current again');
  // Live resize/font decrease clears old measurements, then uses the new
  // physical areas. No Scroller or chapter/proof owner is replaced.
  const scroller = f.owner.directoryOuterScroller;
  f.owner.viewportHeight = 844; f.owner.stageHeight = 844; f.state.scale = 1;
  f.owner.onDirectoryMetricsChanged();
  assert.equal(f.owner.quickOuterViewportHeight, 0); assert.equal(f.owner.quickOuterContentHeight, 0);
  assert.equal(f.owner.directoryQuickHeight(), 330); assert.equal(f.owner.directoryCurrentOpenInset(false), 50);
  f.scroll.onAreaChange({}, { height: 539 }); f.content.onAreaChange({}, { height: 492 }); f.flush();
  assert.equal(f.owner.directoryOuterScroller, scroller);
  assert.equal(scroller.operations.at(-1).yOffset, 0, 'restoring a normal viewport reveals tools/footer again');
  return f;
}
checkShort();
function checkEndpoint(candidate = source) {
  const f = fixture({ candidate }); f.owner.panelPhase = 'opening';
  f.tools.onAreaChange({}, { height: 149 }); f.scroll.onAreaChange({}, { height: 243.6 });
  f.content.onAreaChange({}, { height: 520 }); f.tree.onFirstLayout(); f.flush();
  assert.equal(f.owner.directoryOuterScroller.operations.length, 0, 'opening frame does not admit outer repositioning');
  f.owner.settlePanel(1); assert.equal(f.owner.panelPhase, 'opening');
  assert.deepEqual(f.animations[0].curve.args, [0, .9, 500, 43]);
  f.animations[0].onFinish(); f.flush();
  assert.equal(f.owner.panelPhase, 'open'); assert.equal(f.owner.directoryOuterScroller.operations.at(-1).yOffset, 184,
    'the actual unchanged spring completion admits the measured first positioning');
}
checkEndpoint();
{
  const f = fixture();
  f.scroll.onAreaChange({}, { height: 243.6 }); f.content.onAreaChange({}, { height: 520 }); f.tree.onFirstLayout(); f.flush();
  assert.equal(f.owner.directoryOuterScroller.operations.length, 0, 'late tool area must not use an estimated tools offset');
  f.tools.onAreaChange({}, { height: 149 }); f.flush();
  assert.equal(f.owner.directoryOuterScroller.operations.at(-1).yOffset, 184, 'the late real tools area completes first positioning');
}
{
  const f = fixture({ width: 390, height: 844, scale: 1 });
  assert.equal(f.owner.directoryQuickHeight(), 330); assert.equal(f.tree.mangaCurrentOpenInset, 50);
  assert.equal(f.content.create.space, 17); assert.equal(f.content.padding.bottom, 24);
  f.scroll.onAreaChange({}, { height: f.scroll.constraintSize.maxHeight }); f.content.onAreaChange({}, { height: 492 });
  f.tree.onFirstLayout(); f.flush(); assert.equal(f.owner.directoryOuterScroller.operations.at(-1).yOffset, 0);
  f.owner.viewportHeight = 180; assert.equal(f.owner.panelHeight(), 180, 'even a window below260vp cannot be exceeded by the phone snap');
}
function checkUser(candidate = source) {
  for (const scope of ['outer', 'tree', 'fallback']) {
    const f = fixture({ candidate });
    f.tools.onAreaChange({}, { height: 149 });
    f.scroll.onAreaChange({}, { height: 243.6 }); f.content.onAreaChange({}, { height: 520 });
    if (scope === 'outer') f.scroll.onWillStartDragging();
    else if (scope === 'tree') f.tree.onUserScrollIntent();
    else {
      f.owner.directoryFallback(false);
      const flat = [...f.owner.children.values()].find(child => child.params.onListUserScroll)?.params;
      assert.ok(flat, 'actual fallback interface has the same user-intent cancel callback'); flat.onListUserScroll();
    }
    f.tree.onFirstLayout(); f.flush();
    assert.equal(f.owner.directoryOuterScroller.operations.length, 0, 'a user scroll before first-layout cancels automatic outer positioning');
  }
}
checkUser();
function checkLate(candidate = source) {
  const f = fixture({ candidate });
  const oldHeight = f.owner.quickOuterViewportHeight;
  f.owner.bookId = 'new-book'; f.owner.directoryOpenRevision++;
  f.tools.onAreaChange({}, { height: 149 }); f.scroll.onAreaChange({}, { height: 243.6 }); f.content.onAreaChange({}, { height: 520 }); f.tree.onFirstLayout(); f.flush();
  assert.equal(f.owner.quickOuterViewportHeight, oldHeight, 'retained old area callback cannot become a new-book measurement');
  assert.equal(f.owner.quickToolsMeasured, 0, 'old tools area cannot become a new-book offset');
  assert.equal(f.owner.directoryOuterScroller.operations.length, 0);
  const closed = fixture({ candidate }); closed.owner.panelPhase = 'closing';
  closed.scroll.onAreaChange({}, { height: 243.6 }); closed.content.onAreaChange({}, { height: 520 }); closed.tree.onFirstLayout(); closed.flush();
  assert.equal(closed.owner.directoryOuterScroller.operations.length, 0, 'closing animation cannot admit an old positioning operation');
}
checkLate();
for (const supersede of [owner => { owner.directoryOpenRevision++; }, owner => { owner.isReaderIdentityCurrent = () => false; }, owner => { owner.mounted = false; }]) {
  const f = fixture(); f.tools.onAreaChange({}, { height: 149 }); f.scroll.onAreaChange({}, { height: 243.6 });
  f.content.onAreaChange({}, { height: 520 }); f.tree.onFirstLayout(); supersede(f.owner); f.flush();
  assert.equal(f.owner.directoryOuterScroller.operations.length, 0, 'queued work cannot survive reopen, identity revocation or disposal');
}
for (const [name, test, before, after] of [
  ['old44 floor', checkShort, 'Math.max(mangaDirectoryQuickMinimumListHeight(this.directoryFontScale()), this.directoryQuickRemainingHeight())', 'Math.max(visual.gridHeight, this.directoryQuickRemainingHeight())'],
  ['lost inset clamp', checkShort, 'mangaCurrentOpenInset: this.directoryCurrentOpenInset(catalog),', 'mangaCurrentOpenInset: 50,'],
  ['no first-layout wire', checkShort, 'if (!catalog) this.onDirectoryListFirstLayout(directoryIdentity);', 'if (false) this.onDirectoryListFirstLayout(directoryIdentity);'],
  ['no normal restoration', checkShort, 'if (wasOverflow || !this.quickOuterPositioned) {', 'if (false) {'],
  ['lost user-intent fence', checkUser, 'if (this.quickOuterUserScrolled || this.quickOuterPositioned || this.quickToolsMeasured <= 0) return;', 'if (this.quickOuterPositioned || this.quickToolsMeasured <= 0) return;'],
  ['old identity accepted', checkLate, 'identity !== this.directoryOuterIdentity() ||', 'false ||'],
  ['lost spring completion admission', checkEndpoint, "this.panelPhase = 'open';\n        this.scheduleDirectoryOuterPosition(this.directoryOuterIdentity());", "this.panelPhase = 'open';"],
]) {
  assert.ok(source.includes(before), `${name} target exists`);
  assert.throws(() => test(source.replace(before, after)), undefined, name);
}
assert.equal(mangaDirectoryQuickMinimumListHeight(1), 58);
console.log('PASS actual SDK Quick outerScroll cap/identity/areas, measured tools+17 current first-layout and spring endpoint,185.6 list/zeroInset, baseline330/50, stable Scroller resize restoration and outer/tree/fallback user cancel;7 regressions rejected; native text/layout/gesture remain pending');
