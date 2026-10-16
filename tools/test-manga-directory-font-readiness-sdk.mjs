import { resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { mangaDirectoryEntryRowSdk } from './lib/manga-directory-entry-row-probe.mjs';
import { mangaRowBuilderMembers, mangaGridProbeDependencies } from './lib/manga-directory-grid-probe.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { ReaderDirectoryTrace } from '../entry/src/main/ets/features/reading/ReaderDirectoryTrace.ts';
import * as fonts from '../entry/src/main/ets/features/common/ReaderFontFamilies.ts';
import { sameReaderDirectoryData } from '../entry/src/main/ets/features/reading/ReaderDirectoryDataSnapshot.ts';
import { readerDirectoryAccessibilityText } from '../entry/src/main/ets/features/reading/ReaderDirectoryHierarchy.ts';

const surfacePath = new URL('../entry/src/main/ets/features/reading/ReaderDirectoryNavigationSurface.ets', import.meta.url);
const listPath = new URL('../entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets', import.meta.url);
const source = readFileSync(surfacePath, 'utf8');
const listSource = readFileSync(listPath, 'utf8');
const fallbackSource = readFileSync(new URL('../entry/src/main/ets/features/manga/MangaReadingDirectoryFallback.ets', import.meta.url), 'utf8');
const mangaSurfacePath = new URL('../entry/src/main/ets/features/manga/MangaReadingSurface.ets', import.meta.url);
const mangaSurfaceSource = readFileSync(mangaSurfacePath, 'utf8');
const { mangaSurfaceSdkDependencies } = await import('./lib/manga-surface-sdk-probe.mjs');
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function deferred() {
  let resolve, reject;
  return { promise: new Promise((yes, no) => { resolve = yes; reject = no; }),
    resolve: value => resolve(value), reject: value => reject(value) };
}
function fixture(manga = true) {
  const font = deferred(), query = deferred(), calls = [];
  const Methods = productionMotionMethods(surfacePath,
    ['openTree', 'prepareMangaFonts', 'onInteractionChanged', 'cancelQueryTimer', 'scheduleQueryOpen'], {
      prepareMangaSheetFonts: () => { calls.push('checked-fonts'); return font.promise; },
      openReaderDirectoryNavigation: (_gateway, request, guard) => {
        calls.push(['open', request, guard]); return query.promise;
      },
      ReaderDirectoryTrace, readerDirectoryScopeKey: () => 'manga:book',
      readerDirectoryViewportAnchor: () => undefined,
      readerDirectoryNoteMissingNavigation: () => assert.fail('online fonts cannot mark a local missing tree'),
    });
  const owner = Object.assign(new Methods(), { mounted: true, generation: 0, gateway: {},
    bookId: 'book', sourceId: 'manga', mangaDisplay: manga, mangaCurrentOpenInset: 50, mangaFontsReady: false,
    mangaFontGeneration: 0, mangaFontTask: undefined,
    query: '', ascending: true, currentChapterIndex: 79, interactionEnabled: true,
    settledFlat: false, interacted: false, locateCurrentPending: false, queryTimer: -1,
    pendingRefresh: false, pendingQueryRefresh: false, view: undefined,
    prepareVisiblePages: async () => [], onTreeStateChange: active => calls.push(['published', active]),
  });
  return { owner, calls, font, query };
}
{
  const { owner, calls, font, query } = fixture();
  owner.openTree(true);
  assert.deepEqual(calls, ['checked-fonts']);
  assert.equal(owner.view, undefined); assert.equal(owner.mangaFontsReady, false);
  font.resolve(true); await tick();
  assert.equal(calls[1][0], 'open'); assert.equal(calls[1][2](), true);
  assert.equal(owner.mangaFontsReady, true, 'only the checked four-face receipt admits manga text');
  query.resolve({ viewId: 'ready', visibleTotal: 1, currentVisibleIndex: 0 }); await tick();
  assert.equal(owner.view.viewId, 'ready'); assert.equal(owner.view.currentDisplayInset, 50);
  assert.equal(owner.view.currentDisplaySmooth, false);
}
for (const [invalidate, fontDisplayReady] of [[owner => { owner.mounted = false; }, false],
  [owner => { owner.generation++; }, true], [owner => { owner.bookId = 'changed'; }, true],
  [owner => { owner.sourceId = 'changed'; }, true]]) {
  const { owner, calls, font } = fixture();
  owner.openTree(true); invalidate(owner); font.resolve(true); await tick();
  assert.deepEqual(calls, ['checked-fonts'], 'late font completion cannot open a stale source/book/component');
  assert.equal(owner.mangaFontsReady, fontDisplayReady, 'global font display receipt belongs to mount, not stale navigation identity');
  assert.equal(owner.settledFlat, false);
}
for (const reject of [false, true]) {
  const { owner, calls, font } = fixture();
  owner.openTree(true);
  if (reject) font.reject(new Error('checked registration failed')); else font.resolve(false);
  await tick();
  assert.deepEqual(calls, ['checked-fonts']); assert.equal(owner.mangaFontsReady, false);
  assert.equal(owner.view, undefined); assert.equal(owner.openingGeneration, -1);
}
for (const watchBeforeReceipt of [false, true]) {
  const { owner, calls, font, query } = fixture();
  owner.openTree(true); owner.interactionEnabled = false;
  if (watchBeforeReceipt) owner.onInteractionChanged();
  font.resolve(true); await tick();
  assert.deepEqual(calls, ['checked-fonts']); assert.equal(owner.settledFlat, false);
  assert.equal(owner.mangaFontsReady, true, 'closing keeps the registered font display while tree interaction remains deferred');
  assert.equal(owner.pendingRefresh, true); assert.equal(owner.view, undefined);
  owner.interactionEnabled = true; owner.onInteractionChanged(); await tick();
  assert.equal(calls.filter(value => Array.isArray(value) && value[0] === 'open').length, 1);
  query.resolve({ viewId: 'after-closing-race', visibleTotal: 1 }); await tick();
  assert.equal(owner.view.viewId, 'after-closing-race', 'interaction Watch retries after a deferred font completion');
}
{
  const { owner, calls, query } = fixture(false);
  owner.openTree(true);
  assert.equal(calls.length, 1); assert.equal(calls[0][0], 'open', 'novel opening remains direct and has no font-wait task');
  query.resolve({ viewId: 'novel', visibleTotal: 1 }); await tick();
  assert.equal(owner.view.viewId, 'novel'); assert.equal(owner.view.currentDisplayInset, undefined);
}

async function nativeOpeningInset(text = source) {
  for (const inset of [50, 7]) for (const locate of [false, true]) for (const manga of [true, false]) {
    const properties = createArkUIPropertyRuntimeProbe(), requests = [], scrolls = [];
    const { owner } = createReaderBuilderProbe(text, ['mangaCurrentOpenInset', 'mangaQuickDisplay', 'mangaFontsReady',
      'mangaFontGeneration', 'mangaFontTask', 'openTree', 'prepareMangaFonts'], {
      ...properties.sdk, prepareMangaSheetFonts: async () => true,
      ReaderDirectoryTrace, readerDirectoryScopeKey: () => 'manga:book', readerDirectoryViewportAnchor: () => undefined,
      openReaderDirectoryNavigation: async (_gateway, request, guard) => {
        requests.push(request); assert.equal(guard(), true);
        return { viewId: 'position', visibleTotal: 30, currentVisibleIndex: 9, locateCurrent: request.locateCurrent };
      },
    }, properties.hooks);
    assert.equal(owner.mangaCurrentOpenInset, 50, 'the actual SDK manga inset Prop retains its phone default');
    Object.assign(owner, { mounted: true, generation: 0, gateway: {}, bookId: 'book', sourceId: 'manga',
      mangaDisplay: manga, query: '', ascending: true, currentChapterIndex: 79, interactionEnabled: true,
      settledFlat: false, interacted: false, locateCurrentPending: locate, prepareVisiblePages: async () => [], onTreeStateChange() {} });
    owner.updateStateVars({ mangaCurrentOpenInset: inset });
    owner.openTree(true); await tick();
    assert.equal(requests.length, 1); assert.equal(requests[0].locateCurrent, locate);
    assert.equal(owner.view.currentDisplayInset, manga ? locate ? 12 : inset : undefined,
      'the SDK production opening publishes the variant inset, while explicit locate stays 12');
    const { owner: list } = createReaderBuilderProbe(listSource,
      ['mangaContentStartOffset', 'planPosition', 'positionInitialCurrent', 'positionRowHeight', 'mangaGroupSpacing', 'mangaRowIndex'], {
        readerDirectoryScopeKey: () => 'manga:book', readerDirectoryViewportAnchor: () => undefined,
        ScrollAlign: { START: 'start', CENTER: 'center' }, LengthMetrics: { vp: value => ({ value }) },
      });
    Object.assign(list, { view: owner.view, mangaDisplay: manga, sourceId: 'manga', bookId: 'book',
      initialPositionPending: true, mangaVisibleTopInset: 0, contentStartInset: 0, listPaddingTop: 0, listPaddingY: 0, scroller: { scrollToIndex: (...args) => scrolls.push(args) } });
    list.positionInitialCurrent();
    assert.deepEqual(scrolls, manga ? [[9, locate, 'start', { extraOffset: { value: -(locate ? 12 : inset) } }]] : [[9, false, 'center']],
      'the published opening reaches the unmodified SDK list scroll request');
  }
}
await nativeOpeningInset();
const fixedPhoneOpen = source.replace('explicitLocateCurrent ? 12 : this.mangaCurrentOpenInset', 'explicitLocateCurrent ? 12 : 50');
assert.notEqual(fixedPhoneOpen, source);
await assert.rejects(() => nativeOpeningInset(fixedPhoneOpen), /variant inset/);

const require = createRequire(import.meta.url);
const sdk = resolveEtsLoaderRoot();
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
syntax.componentCollection.customComponents.add('ReaderDirectoryNavigationList');
syntax.propCollection.set('ReaderDirectoryNavigationList', new Set([...listSource.matchAll(/@Prop(?:\s+@Watch\([^)]*\))?\s+(\w+)\s*:/g)].map(match => match[1])));
class DirectoryChild { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
function nativeAdmission(text = source) {
  for (const ready of [false, true]) for (const withTree of [false, true]) {
    let fallback = 0;
    const properties = createArkUIPropertyRuntimeProbe();
    const { owner } = createReaderBuilderProbe(text, ['mangaFontsReady', 'fallbackBuilder', 'build'],
      { ...properties.sdk, ...fonts, ReaderDirectoryNavigationList: DirectoryChild }, properties.hooks);
    Object.assign(owner, { mangaDisplay: true, mangaFontsReady: ready, query: '',
      view: withTree ? { viewId: 'tree', visibleTotal: 1 } : undefined,
      fallbackBuilder: () => fallback++ });
    owner.initialRender();
    const nodes = [...owner.nodes.values()];
    assert.equal(nodes.some(node => node.type === 'Blank'), !ready, 'native SDK keeps a blank catalog before checked receipt');
    assert.equal(owner.children.size, ready && withTree ? 1 : 0);
    assert.equal(fallback, ready && !withTree ? 1 : 0, 'fallback text is gated by the same font receipt');
    assert.ok(properties.reads.some(property => property.name === 'mangaFontsReady' && property.id >= 0), 'ready state is actually observed');
  }
}
nativeAdmission();
const unguarded = source.replace('if (this.mangaDisplay && !this.mangaFontsReady)', 'if (false)');
assert.notEqual(unguarded, source);
assert.throws(() => nativeAdmission(unguarded), /blank catalog/);

// Keep the actual SDK compiler/property runtime and production lifecycle on
// one owner. Record the actual SDK-emitted If branch requests and execute its
// target Builder callback. Historical actors are retained: this proves branch/
// Builder requests, not native actor removal, renderer layout, or pixels.
function nativeLifecycleFixture(text = source, manga = true) {
  const receipts = [deferred(), deferred()], query = deferred(), calls = [], branches = new Map(), active = [];
  const properties = createArkUIPropertyRuntimeProbe();
  const hooks = { ...properties.hooks,
    onObserverEnter(owner, id) { active.push(id); properties.hooks.onObserverEnter(owner, id); },
    onObserverExit(owner, id) { properties.hooks.onObserverExit(owner, id); active.pop(); },
  };
  const members = ['mangaDisplay', 'mangaFontsReady', 'mangaFontGeneration', 'mangaFontTask',
    'interactionEnabled', 'view', 'mounted', 'generation', 'openingGeneration', 'settledFlat',
    'pendingRefresh', 'pendingQueryRefresh', 'queryTimer', 'queryTrace', 'lastQuery', 'lastAscending',
    'lastChapterIndex', 'locateCurrentPending', 'scrollIntentUnsubscribe', 'gateway',
    'bookId', 'sourceId', 'openRevision', 'query', 'currentChapterIndex', 'ascending',
    'aboutToAppear', 'aboutToDisappear', 'prepareMangaFonts', 'onIdentityChanged', 'onViewInputsChanged',
    'onInteractionChanged', 'cancelQueryTimer', 'scheduleQueryOpen', 'openTree', 'onProgrammaticScrollIntent',
    'build', 'fallbackBuilder'];
  let fontRequests = 0;
  const { owner } = createReaderBuilderProbe(text, members, {
    ...properties.sdk, ...fonts, ReaderDirectoryNavigationList: DirectoryChild,
    ReaderRuntimeOwner: { current: () => ({}) }, ReaderDirectoryNavigationGateway: class {},
    ReaderDirectoryTrace, readerDirectoryScopeKey: () => 'manga:book', readerDirectoryViewportAnchor: () => undefined,
    readerDirectoryObserveScrollIntent: () => () => calls.push('unsubscribe'),
    prepareMangaSheetFonts: () => { calls.push('checked-fonts'); return receipts[fontRequests++].promise; },
    openReaderDirectoryNavigation: (_gateway, request, current) => {
      calls.push(['tree', request, current]); return query.promise;
    },
    readerDirectoryNoteMissingNavigation: () => assert.fail('online font failure cannot mark missing local navigation'),
  }, hooks);
  owner.ifElseBranchUpdateFunction = function(branch, render) {
    const id = active.at(-1), old = branches.get(id);
    if (old?.branch === branch) return;
    branches.set(id, { branch });
    render();
  };
  const entry = { index: 79, title: '03', navigable: true };
  const { owner: mangaOwner } = createReaderBuilderProbe(mangaSurfaceSource,
    ['panel', 'panelPhase', 'directoryFallback', 'directoryOuterIdentity', 'directoryCurrentOpenInset', 'directoryQuickHeight', 'directoryQuickRemainingHeight', 'directoryQuickToolsHeight', 'directoryToolHeight', 'directoryFontScale', 'directoryHeaderChrome', 'panelContentHeight', 'panelHeight', 'panelInsets', 'interactiveInsets', 'windowInteractiveInsets', 'controlsPresentedForWindow', 'directoryCurrentIndex', 'directoryCurrentPagePosition', 'widePanel', 'persistentDirectory', 'selectDirectoryTarget', 'onWindowChromeChanged'],
    { ...properties.sdk, ...mangaSurfaceSdkDependencies }, properties.hooks);
  Object.assign(mangaOwner, { isReaderIdentityCurrent: () => false, mounted: true, panel: 'directory', panelPhase: 'opening',
    sourceId: 'manga', bookId: 'book', viewportWidth: 390, viewportHeight: 844, stageWidth: 390, stageHeight: 844,
    error: '', controlsVisible: false, chapterEnd: false, directoryOpenRevision: '',
    quickHeaderMeasured: 60, quickFooterMeasured: 48, quickToolsMeasured: 56, windowMetricsRevision: 0,
    backgroundPreference: 'paper', controller: { chapter: { chapterIndex: 79 } },
    directoryEntries: () => [entry], performPanelAction: action => { calls.push('target-action'); action(); },
    onSelectDirectoryTarget: index => calls.push(['target-index', index]) });
  mangaOwner.directoryFallback(false);
  const child = [...mangaOwner.children.values()][0];
  assert.ok([...mangaOwner.nodes.values()].some(node => node.type === '__Common__' && node.enabled === false),
    'the real manga fallback wrapper remains disabled during entry');
  const rowSdk = mangaDirectoryEntryRowSdk({ dependencies: { sameReaderDirectoryData, readerDirectoryAccessibilityText } });
  const { owner: fallback } = createReaderBuilderProbe(fallbackSource,
    ['row', 'prepareLayout', 'fontScale', 'layoutRow', 'showContext', 'rowPresentation', 'mangaColor', 'identity', 'selectEntry'], rowSdk.deps, rowSdk.hooks);
  Object.assign(fallback, { mounted: true, sourceId: 'manga', bookId: 'book',
    entries: [entry], admittedEntries: [entry], projectedEntries: [entry], admittedIdentity: 'manga\u0000book',
    currentChapterIndex: 79, query: '', mangaScheme: 'day', rowHeight: 58,
    mangaCatalogDisplay: false, mangaCatalogNarrow: false, layoutRows: [], presentation: new Map(), collapsedGroups: [],
    onSelectChapter: child.params.onSelectChapter });
  fallback.prepareLayout();
  let fallbackBuilds = 0;
  Object.assign(owner, { mangaDisplay: manga, interactionEnabled: false, bookId: 'book', sourceId: 'manga',
    query: '', ascending: true, currentChapterIndex: 79, openRevision: 'opening',
    prepareVisiblePages: async () => [], onTreeStateChange: active => calls.push(['published', active]),
    fallbackBuilder: () => { fallbackBuilds++; if (manga) fallback.row(entry, fallback.identity()); } });
  const update = changes => owner.updateStateVars({ mangaDisplay: owner.mangaDisplay,
    interactionEnabled: owner.interactionEnabled, bookId: owner.bookId, sourceId: owner.sourceId,
    query: owner.query, ascending: owner.ascending, currentChapterIndex: owner.currentChapterIndex,
    openRevision: owner.openRevision, ...changes });
  owner.aboutToAppear(); owner.initialRender();
  return { owner, mangaOwner, fallback, fallbackNodes: () => rowSdk.nodes(fallback), properties, calls, receipts, query, update,
    fallbackBuilds: () => fallbackBuilds, treeRequests: () => calls.filter(value => Array.isArray(value) && value[0] === 'tree'),
    blank: () => [...branches.values()].some(record => record.branch === 0),
    historicalBlank: () => [...owner.nodes.values()].some(node => node.type === 'Blank'),
    text: () => rowSdk.nodes(fallback).find(node => node.type === 'Text' && node.create === '03') };
}
async function sameMountDisabledAdmission(text = source) {
  const f = nativeLifecycleFixture(text);
  assert.equal(f.blank(), true); assert.equal(f.text(), undefined); assert.equal(f.treeRequests().length, 0);
  f.receipts[0].resolve(true); await tick(); f.properties.flush();
  assert.equal(f.blank(), false, 'same mounted SDK build leaves Blank after receipt even while interaction is false');
  assert.equal(f.historicalBlank(), true, 'the probe keeps historical native actors and does not claim renderer removal');
  assert.equal(f.fallbackBuilds(), 1); assert.equal(f.text().fontFamily, fonts.READER_FONT_NOTO_SANS_SC_UI_550,
    'the real prepared fallback row Text is requested by its production Builder after checked receipt');
  assert.equal(f.treeRequests().length, 0, 'display admission cannot issue a blocked tree request');
  const row = f.fallbackNodes().find(node => node.type === 'Stack' && node.accessibilityText?.includes('03') && typeof node.onClick === 'function');
  assert.ok(row, 'the prepared fallback keeps its real outer chapter selection callback');
  assert.equal(row.constraintSize.minHeight, 44, 'the callback belongs to the entire painted cell');
  assert.ok(!f.fallbackNodes().some(node => node.type === 'Text' && node.create === '03' && node.onClick),
    'inner title does not install a duplicate gesture actor');
  assert.equal(f.fallbackNodes().find(node => node.type === 'Row').onClick, undefined,
    'the grid-run layout remains an ancestor rather than a second selection handler');
  row.onClick(); await tick(); assert.equal(f.calls.includes('target-action'), false,
    'a programmatic retained row callback still hits the real manga target opening fence');
  assert.equal(f.owner.interactionEnabled, false);
  f.update({ interactionEnabled: true }); f.mangaOwner.panelPhase = 'open'; await tick();
  assert.equal(f.treeRequests().length, 1, 'only the existing interaction Watch admits tree work');
  row.onClick(); await tick();
  assert.deepEqual(f.calls.filter(call => Array.isArray(call) && call[0] === 'target-index'), [['target-index', 79]],
    'the same outer cell callback admits the exact chapter after the native business opening fence');
  f.update({ interactionEnabled: false }); f.mangaOwner.panelPhase = 'closing';
  f.query.resolve({ viewId: 'late-closed', visibleTotal: 1 }); await tick(); f.properties.flush();
  assert.equal(f.owner.view, undefined, 'late tree receipt cannot publish through the original closing fence');
  assert.equal(f.blank(), false, 'closing retains the independently admitted display');
  row.onClick(); await tick(); assert.equal(f.calls.filter(call => call === 'target-action').length, 1,
    'the retained outer actor cannot dispatch another chapter while closing');
}
await sameMountDisabledAdmission();
const oldMountCoupling = source.replace('    if (this.mangaDisplay) {\n      void this.prepareMangaFonts();\n    }\n', '');
assert.notEqual(oldMountCoupling, source);
await assert.rejects(() => sameMountDisabledAdmission(oldMountCoupling), /same mounted SDK build leaves Blank/);
for (const rejected of [false, true]) {
  const f = nativeLifecycleFixture();
  if (rejected) f.receipts[0].reject(new Error('registration failed')); else f.receipts[0].resolve(false);
  await tick(); f.properties.flush();
  assert.equal(f.blank(), true); assert.equal(f.text(), undefined); assert.equal(f.treeRequests().length, 0);
}
{
  const f = nativeLifecycleFixture(); f.owner.aboutToDisappear();
  f.receipts[0].resolve(true); await tick(); f.properties.flush();
  assert.equal(f.blank(), true); assert.equal(f.text(), undefined); assert.equal(f.owner.mangaFontsReady, false);
}
async function remountFontReceipt(text = source) {
  const f = nativeLifecycleFixture(text); f.owner.aboutToDisappear(); f.owner.aboutToAppear();
  f.receipts[0].resolve(true); await tick(); f.properties.flush();
  assert.equal(f.blank(), true, 'old receipt cannot admit a remounted display');
  assert.equal(f.text(), undefined);
  f.receipts[1].resolve(true); await tick(); f.properties.flush();
  assert.equal(f.blank(), false); assert.ok(f.text()); assert.equal(f.treeRequests().length, 0);
}
await remountFontReceipt();
const unfencedFontReceipt = source.replace('!this.mounted || generation !== this.mangaFontGeneration || !this.mangaDisplay', '!this.mounted || !this.mangaDisplay');
assert.notEqual(unfencedFontReceipt, source);
await assert.rejects(() => remountFontReceipt(unfencedFontReceipt), /old receipt cannot admit a remounted display/);
{
  const f = nativeLifecycleFixture(); const generation = f.owner.mangaFontGeneration;
  f.update({ query: 'new query', bookId: 'different-book' });
  assert.equal(f.owner.mangaFontGeneration, generation, 'query/book navigation does not own the global font lifecycle');
  f.receipts[0].resolve(true); await tick(); f.properties.flush();
  assert.equal(f.blank(), false); assert.ok(f.text()); assert.equal(f.treeRequests().length, 0);
  assert.equal(f.calls.filter(value => value === 'checked-fonts').length, 1);
}
{
  const f = nativeLifecycleFixture(source, false);
  assert.equal(f.calls.includes('checked-fonts'), false, 'novel mounting must not add a manga font task');
  assert.equal(f.blank(), false); assert.equal(f.fallbackBuilds(), 1); assert.equal(f.treeRequests().length, 0);
}

function liveCurrentFamily(text = listSource) {
  const properties = createArkUIPropertyRuntimeProbe();
  const { owner } = createReaderBuilderProbe(text,
    ['currentChapterIndex', 'mangaCatalogDisplay', 'mangaCatalogNarrow', 'mangaRowMinHeight',
      ...mangaRowBuilderMembers],
    { ...mangaGridProbeDependencies, ...properties.sdk, ...fonts }, properties.hooks);
  const entry = { nodeId: 'leaf', title: '03', depth: 2, kind: 'target', chapterIndex: 79 };
  Object.assign(owner, { mangaScheme: 'day', mangaSearchActive: false, currentChapterIndex: -1,
    interactionEnabled: true, view: { viewId: 'v' }, mangaRowMinHeight: 58,
    mangaCatalogDisplay: false, mangaCatalogNarrow: false, mangaPresentationRevision: 0,
    dataSource: { currentView: () => owner.view, loadedItemById: () => ({ node: entry, index: 0 }) } });
  owner.mangaRow({ node: entry, key: 'leaf', index: 0 });
  const title = [...owner.nodes.values()].find(node => node.type === 'Text' && node.create === '03');
  const actors = owner.observers.length;
  const update = params => {
    // The parent emits all declared Props in each child update. The actual
    // SDK resets omitted Props; a partial fixture is not that parent payload.
    owner.updateStateVars({ currentChapterIndex: owner.currentChapterIndex,
      mangaCatalogDisplay: owner.mangaCatalogDisplay, mangaCatalogNarrow: owner.mangaCatalogNarrow,
      mangaRowMinHeight: owner.mangaRowMinHeight, ...params });
    properties.flush();
  };
  assert.equal(title.fontFamily, fonts.READER_FONT_NOTO_SANS_SC_UI_REGULAR);
  update({ currentChapterIndex: 79 });
  assert.equal(title.fontFamily, fonts.READER_FONT_NOTO_SANS_SC_UI_550, 'native Prop update switches the retained title to physical fixed 550');
  assert.deepEqual(title.fontWeight, [550, {enableVariableFontWeight: true}], 'fixed outlines and explicit current weight use the shared 550 role');
  update({ currentChapterIndex: -1 });
  assert.equal(title.fontFamily, fonts.READER_FONT_NOTO_SANS_SC_UI_REGULAR);
  const row = [...owner.nodes.values()].find(node => node.type === 'Row');
  update({ mangaRowMinHeight: 50 });
  assert.equal(row.constraintSize.minHeight, 58, 'responsive entrance props retain the exact demo row anatomy');
  update({ mangaCatalogDisplay: true });
  assert.equal(title.fontSize, 13); assert.equal(title.lineHeight, 22);
  assert.equal(row.constraintSize.minHeight, 58); assert.equal(row.padding.left, 26); assert.equal(row.border.width.top, 1);
  update({ mangaCatalogNarrow: true });
  assert.equal(title.fontSize, 13); assert.equal(row.padding.left, 26); assert.equal(row.padding.right, 10); assert.equal(row.create.space, 12);
  update({ mangaCatalogDisplay: false, mangaRowMinHeight: 58 });
  assert.equal(title.fontSize, 13); assert.equal(title.lineHeight, 22);
  assert.equal(row.constraintSize.minHeight, 58); assert.equal(row.padding.left, 26); assert.equal(row.border.width.top, 1);
  assert.equal(owner.observers.length, actors, 'same native title actor switches family in both directions');
}
liveCurrentFamily();
const stuckRegular = listSource.replaceAll('this.isCurrentMangaNode(item) ? READER_FONT_NOTO_SANS_SC_UI_550 : READER_FONT_NOTO_SANS_SC_UI_REGULAR', 'READER_FONT_NOTO_SANS_SC_UI_REGULAR');
assert.notEqual(stuckRegular, listSource);
assert.throws(() => liveCurrentFamily(stuckRegular), /physical fixed 550/);
console.log('PASS manga directory fixed-font SDK binding, deferred checked receipt, fallback/tree admission, stale/closing fences, same actor responsive styles, phone/catalog open50 and side-panel open7 through SDK scroll requests, explicit locate12, novel direct/center path; 5 old-implementation negative controls, same mounted SDK Blank-to-prepared-fallback branch request while interaction disabled, retained closing display, dispose/remount receipt fences and unchanged tree/target admission. Native branch removal, glyph pixels and motion frames remain target acceptance.');
