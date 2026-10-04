import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import * as settings from '../entry/src/main/ets/features/reading/ReaderSettingsState.ts';
import { ShelfBookPresentation } from '../entry/src/main/ets/features/bookshelf/ShelfBookPresentation.ts';
import { readerAppColor } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';

const file = name => new URL(`../entry/src/main/ets/${name}`, import.meta.url);
const read = name => readFileSync(file(name), 'utf8');
const defaults = settings.createDefaultReaderSettingsSnapshot();
for (const mangaDirection of ['vertical', 'horizontal'])
for (const mangaFit of ['source', 'width', 'contain'])
for (const mangaBackground of ['paper', 'white', 'ink'])
for (const mangaPageNumbers of [false, true]) {
  const value = { ...defaults, mangaDirection, mangaFit, mangaBackground, mangaPageNumbers };
  assert.deepEqual(settings.normalizeReaderSettingsSnapshot(value), value);
  assert.deepEqual(settings.copyReaderSettingsSnapshot(value), value);
  assert.equal(settings.setReaderPageTurnStyle(value, 'cover').mangaFit, mangaFit);
}
assert.deepEqual(settings.normalizeReaderSettingsSnapshot({ ...defaults,
  mangaFit: 'invalid', mangaBackground: 'invalid', mangaPageNumbers: 'false' }), defaults);
assert.equal(settings.normalizeReaderSettingsSnapshot({ ...defaults, version: 4,
  mangaDirection: 'horizontal', mangaFit: 'width' }).mangaFit, undefined, 'old versions cannot claim new manga fields');
for (const readProgress of [0, undefined, NaN]) {
  const novel = { sourceId: 'local', bookId: 'novel', readProgress };
  assert.equal(ShelfBookPresentation.progress(novel, 'list-status'), '未读');
  assert.equal(ShelfBookPresentation.progress(novel, 'grid-caption'), '', 'existing grid unread caption stays absent');
}

const Navigation = productionMotionMethods(file('features/reading/ReaderDirectoryNavigationSurface.ets'),
  ['onIdentityChanged'], { readerDirectoryScopeKey: (source, book) => `${source}:${book}`,
    readerDirectoryObserveScrollIntent: () => () => {} });
const nav = Object.assign(new Navigation(), { mounted: true, generation: 0, locateCurrentPending: true,
  sourceId: 'new-source', bookId: 'new-book', query: '', ascending: true, currentChapterIndex: 4,
  cancelQueryTimer() {}, onTreeStateChange() {}, openTree() {} });
nav.onIdentityChanged(); assert.equal(nav.locateCurrentPending, false,
  'locate-current intent from another identity cannot clear the new book viewport anchor');

const lazy = new Proxy({}, { get: () => () => {} });
for (const [path, mode] of [
  ['features/reading/ReaderDirectoryList.ets', 'naturalRowHeight'],
  ['features/reading/ReaderDirectoryNavigationList.ets', 'mangaDisplay'],
]) for (const manga of [false, true]) {
  const source = read(path);
  const names = path.includes('Navigation') ? ['row', 'mangaRow', 'build'] : ['rowBuilder', 'build'];
  const owner = createReaderBuilderProbe(source, names, { LazyForEach: lazy }).owner;
  const sizes = { defaultSize: 40 };
  Object.assign(owner, { [mode]: manga, mangaCatalogDisplay: false, dataSource: {}, rowHeight: 40,
    itemSizes: sizes, listPaddingX: 10, listPaddingRight: 16, listPaddingY: 5,
    listPaddingTop: 7, listPaddingBottom: 9, contentStartInset: 82, contentEndInset: 96 });
  owner.initialRender();
  const list = [...owner.nodes.values()].find(node => node.type === 'List');
  assert.deepEqual([list.width, list.height], ['100%', '100%'], 'all consumers retain the full native viewport');
  assert.deepEqual(list.padding, { left: 10, right: 16, top: manga ? 0 : 7, bottom: manga ? 0 : 9 });
  assert.equal(list.contentStartOffset, manga ? 89 : 82, 'new natural-row padding composes with existing leading clearance');
  assert.equal(list.contentEndOffset, manga ? path.includes('Navigation') ? 119 : 105 : 96);
  if (!path.includes('Navigation')) assert.equal(list.childrenMainSize, manga ? undefined : sizes);
}

class Child { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
const panelSource = read('features/reading/SourceSwitchPanel.ets');
const windowSource = read('features/source/SourceSwitchWindow.ets');
const mangaSource = read('features/source/MangaSourceSwitchWindow.ets');
const events = [], candidate = { sourceId: 'same-source', bookUrl: 'second', sourceName: '当前新信息' };
const inputs = { state: { kind: 'candidates', candidates: [candidate] }, currentSourceId: 'old',
  bookTitle: '漫画标题', author: '作者', coverUrl: 'cover', currentSourceName: '原书源',
  currentChapterTitle: '第八话', contentKind: 'manga', reduceMotion: true, consumeTopInset: false,
  onStop: () => events.push('stop'), onClose: () => events.push('close'), onRetry: () => events.push('retry'),
  onRefresh: () => events.push('refresh'), onSelectCandidate: value => events.push(value), onRollback: () => events.push('rollback') };
const panel = createReaderBuilderProbe(panelSource, ['build'], { SourceSwitchWindow: Child },
  { childSources: { SourceSwitchWindow: windowSource } }).owner;
Object.assign(panel, inputs); panel.initialRender();
const forwarded = [...panel.children.values()][0].params;
for (const name of ['bookTitle', 'author', 'coverUrl', 'currentSourceName', 'currentChapterTitle',
  'contentKind', 'reduceMotion', 'consumeTopInset']) assert.equal(forwarded[name], inputs[name]);
for (const manga of [false, true]) {
  const owner = createReaderBuilderProbe(windowSource, ['build'], {
    MangaSourceSwitchWindow: Child, ReaderBoundedSurface: Child,
  }, { childSources: { MangaSourceSwitchWindow: mangaSource,
    ReaderBoundedSurface: read('features/common/ReaderBoundedSurface.ets') } }).owner;
  Object.assign(owner, forwarded, { contentKind: manga ? 'manga' : 'text',
    windowWidth: () => 300, windowHeight: () => 385, windowTranslateX: () => 0, windowTranslateY: () => 0 });
  owner.initialRender();
  const child = [...owner.children.values()][0];
  if (manga) {
    assert.equal(child.params.contentKind, 'manga'); assert.equal(child.params.bookTitle, '漫画标题');
    child.params.onStop(); child.params.onClose(); child.params.onRetry(); child.params.onRefresh();
    child.params.onSelectCandidate(candidate); child.params.onRollback();
    assert.deepEqual(events, ['stop', 'close', 'retry', 'refresh', candidate, 'rollback']);
  } else {
    assert.equal(child.params.specId, 'source-switch-window');
    assert.deepEqual([child.params.surfaceWidth, child.params.surfaceHeight], [300, 385],
      'novel keeps the current bounded seven-state surface');
  }
}

const gatewaySource = read('features/source/SourceSwitchGateway.ts');
const functions = gatewaySource.slice(gatewaySource.indexOf('export function sourceSwitchCandidateKey('),
  gatewaySource.indexOf('function deduplicateSourceSwitchCandidates(')).replace(/^export /gm, '');
const identities = new Function(stripTypeScriptTypes(functions) +
  ';return {sourceSwitchCandidateKey,sourceSwitchSourceCount};')();
const methods = ['candidateKey', 'acceptState', 'cancelPresentation', 'busy', 'isSweeping', 'selectCandidate',
  'requestRefresh', 'rollbackRequired', 'reconcileRequired', 'statusText', 'errorText'];
const Window = productionMotionMethods(file('features/source/MangaSourceSwitchWindow.ets'), methods,
  { ...identities, clearTimeout() {} });
const a = { sourceId: 'same-source', bookUrl: 'first', sourceName: '旧一', latencyMs: 500 };
const c = { sourceId: 'other-source', bookUrl: 'third', sourceName: '新增' };
const selected = [], requests = [];
const owner = Object.assign(new Window(), { state: { kind: 'candidates', candidates: [a, candidate] },
  contentKind: 'manga', selectionPending: false, displayedCandidates: [a, candidate], latestCandidates: [],
  pendingSearchKeys: new Set(), retestingKeys: [], wasRefreshing: false, touching: true, scrolling: false,
  presentationEpoch: 0, anchorEpoch: 0, reorderTimer: -1, heldKey: '', queueReorder() {},
  onSelectCandidate: value => selected.push(value), onStop: () => requests.push('stop'),
  onRefresh: () => requests.push('refresh'), onRetry: () => requests.push('retry') });
const updated = { ...candidate, sourceName: '来自同身份的新信息', latencyMs: 1 };
owner.state = { kind: 'candidates', candidates: [updated, a, c], refreshing: true };
owner.acceptState();
assert.deepEqual(owner.displayedCandidates.map(value => value.bookUrl), ['first', 'second', 'third'],
  'held row identity survives new ranking while new entries append');
assert.equal(owner.displayedCandidates[1], updated, 'latest metadata is rendered without swapping held row position');
owner.heldKey = identities.sourceSwitchCandidateKey(a.sourceId, a.bookUrl);
owner.selectCandidate(identities.sourceSwitchCandidateKey(updated.sourceId, updated.bookUrl));
assert.deepEqual(selected, [], 'a retained press cannot select another composite identity after enrichment');
owner.heldKey = ''; owner.selectCandidate(identities.sourceSwitchCandidateKey(updated.sourceId, updated.bookUrl));
assert.deepEqual(selected, [updated], 'current latest object is selected by source+book identity, not row rank');
owner.selectionPending = false; owner.requestRefresh(); assert.equal(requests.at(-1), 'stop');
owner.state = { kind: 'candidates', candidates: [updated], refreshing: false, stopped: true };
owner.acceptState();
owner.requestRefresh(); assert.equal(requests.at(-1), 'refresh');
assert.equal(owner.statusText(), '已停止 · 已发现 1 个');

const Repeat = items => ({ each(callback) { this.callback = callback; return this; }, key() { return this; },
  virtualScroll() { return this; }, render() { items.forEach((item, index) => this.callback({ item, index })); } });
const sourceBuild = createReaderBuilderProbe(mangaSource,
  ['build', 'header', 'bookContext', 'discoveryStatus', 'candidateList', 'recoveryNotice',
    'candidateKey', 'busy', 'isSweeping', 'rollbackRequired', 'reconcileRequired', 'requestRefresh', 'statusText', 'errorText',
    'safeTop', 'safeBottom', 'safeLeft', 'safeRight', 'listStartInset'], {
    ...identities, Repeat, ButtonType: { Normal: 'normal' }, NoCoverCover: Child, SearchSpinner: Child, SourceSwitchLiveRow: Child,
    ReaderWindowCoordinator: { metrics: () => ({}) }, readerVisualSafeTop: () => 48,
    readerInteractiveSafeBottom: () => 34, readerInteractiveSafeLeft: () => 3, readerInteractiveSafeRight: () => 7,
  }, { componentName: 'MangaSourceSwitchWindow', childSources: {
    NoCoverCover: read('features/bookshelf/NoCoverCover.ets'),
    SearchSpinner: read('features/search/SearchSpinner.ets'), SourceSwitchLiveRow: mangaSource,
  } }).owner;
Object.assign(sourceBuild, inputs, { readerWindowMetricsRevision: 1, appThemeScheme: 'day',
  foreground: true, __Repeat: Repeat, displayedCandidates: [updated], retestingKeys: [], coverFailed: false,
  selectedKey: '', selectionPending: false, firstVisibleIndex: 0, firstVisibleListIndex: 0,
  contextHeight: 72, statusHeight: 50, restoringAnchor: false, candidateScroller: {},
  listTouch() {}, queueReorder() {}, selectCandidate() {} });
sourceBuild.initialRender();
const sourceList = [...sourceBuild.nodes.values()].find(node => node.type === 'List');
assert.deepEqual([sourceList.width, sourceList.height], ['100%', '100%']);
assert.equal(sourceList.contentStartOffset, 76, 'reader-owned source overlay consumes no second top safe inset');
assert.equal(sourceList.contentEndOffset, 54, 'last candidate can clear the gesture area plus internal 20vp');
assert.ok([...sourceBuild.children.values()].some(child => child.params.candidate === updated),
  'actual SDK retained row receives the full current candidate object');

const recovery = createReaderBuilderProbe(mangaSource, ['recoveryNotice', 'errorText', 'rollbackRequired',
  'reconcileRequired', 'requestRefresh', 'busy', 'isSweeping'], { ButtonType: { Normal: 'normal' } },
  { componentName: 'MangaSourceSwitchWindow' }).owner;
Object.assign(recovery, { state: { kind: 'failure', message: '结果尚待核对', transactionId: 'tx',
  confirmation: 'unknown', reconcile: true }, appThemeScheme: 'day',
  onRetry: () => requests.push('reconcile'), onRollback: () => assert.fail('unknown receipt must use owner reconciliation') });
recovery.recoveryNotice();
const retry = [...recovery.nodes.values()].find(node => node.type === 'Button');
assert.deepEqual(retry.createWithLabel, ['重试核对', { type: 'normal' }]); retry.onClick(); assert.equal(requests.at(-1), 'reconcile');
{
  // Two native Rows now call one real ArkUI setter. The scanner still sees
  // that setter plus the original novel current marker: its budget stays2.
  const source = read('features/reading/ReaderDirectoryNavigationList.ets');
  assert.equal((source.match(/\.backgroundColor\(/g) ?? []).length, 2);
  assert.equal((source.match(/new ReaderDirectoryRowBackgroundModifier\(/g) ?? []).length, 2);
  const verifyPaint = definition => {
    for (const manga of [false, true]) for (const scheme of ['day', 'night']) for (const current of [false, true]) for (const group of [false, true]) {
      const node = { nodeId: 'paint-row', title: '实际目录标题', kind: group ? 'group' : 'target', chapterIndex: 7,
        depth: 1, hasChildren: false, expanded: true, readableDescendantCount: 3 };
      const owner = createReaderBuilderProbe(definition, ['row', 'mangaRow', 'isCurrentNode', 'isCurrentMangaNode', 'mangaColor']).owner;
      Object.assign(owner, { appThemeScheme: scheme, mangaScheme: scheme, mangaDisplay: manga, mangaCatalogDisplay: false,
        mangaCatalogNarrow: false, mangaSearchActive: false, rowHeight: 40, mangaRowMinHeight: 58,
        interactionEnabled: true, currentChapterIndex: current ? 7 : 9, chapterDownloadEnabled: false,
        chapterByIndex: new Map(), view: { currentVisibleIndex: current ? 0 : undefined },
        dataSource: { loadedNode: () => node }, displayLevel: () => 1, mangaGroupNode: n => n,
        mangaRowPaddingLeft: () => 10, mangaGroupSpacing: () => 0, mangaRowIndex: () => 0 });
      owner[manga ? 'mangaRow' : 'row']({ node, index: 0, key: node.nodeId });
      const row = [...owner.nodes.values()].find(n => n.type === 'Row');
      const expected = manga ? group ? scheme === 'night' ? '#30342D' : '#F0ECE3' : current ? scheme === 'night' ? '#303C2D' : '#E8EDE2' : 'Color.Transparent' :
        current ? readerAppColor('TOK_READ_ACTIVE_SOFT', scheme) : 'Color.Transparent';
      assert.equal(row.backgroundColor, expected, 'same production Row paint setter keeps exact novel/manga day/night/current/group palette');
      assert.equal(row.width, '100%');
      if (manga) { assert.equal(row.height, undefined); assert.equal(row.constraintSize.minHeight, group ? 48 : 58); assert.deepEqual(row.margin, { top: 0 }); }
      else { assert.equal(row.height, 40); assert.equal(row.borderRadius, 6); }
      assert.equal(owner.attributeCalls.filter(c => c.property === 'attributeModifier').length, 1, 'native row invokes actual shared apply once');
    }
  };
  verifyPaint(source);
  for (const bad of [source.replace('instance.backgroundColor(this.color);', ''),
    source.replace('instance.backgroundColor(this.color);', "instance.backgroundColor('#FF0000');")]) {
    assert.notEqual(bad, source);
    assert.throws(() => verifyPaint(bad), /same production Row paint setter/, 'missing/wrong actual native apply is rejected');
  }
}
console.log('PASS shared manga UI closure: optional settings/copy, novel captions, full native directory viewport and composed offsets, actual SDK panel/window props, preserved text surface, current candidate identity and failure reconciliation; one real row paint setter preserves novel/manga day/night/current/group bounds and colors with missing/wrong-apply negatives');
