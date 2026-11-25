import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { boundedSurfaceSdk } from './lib/bounded-surface-sdk-probe.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { selectedProductionMethods, selectedProductionComponentCallback } from './lib/selected-production-methods.mjs';
import { readerDirectoryToolbarBudget } from '../entry/src/main/ets/features/reading/presentation/ReaderFullDirectoryBudget.ts';
import { readerAppColor } from '../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts';

const selected = selectContractCases({
  'toolbar-dock': 'Standalone native cache/sort and current/top/bottom targets keep independent guarded callbacks.',
  'locate-and-cache': 'Current target clears old query and centers by source index, and cache opens only for the current Runtime.',
  'detail-directory-page': 'Book detail gets a safe-area standalone directory with a single Back header and full body budget; the reader keeps its overlay header.',
  'clear-search-and-more': 'The catalog restores results in both directory models and closes an anchored More menu when dismissed or blocked.',
});
const entry = new URL('../entry/src/main/ets/', import.meta.url);
const path = name => new URL('features/reading/ui/' + name + '.ets', entry);
const source = name => readFileSync(path(name), 'utf8');

for (const id of selected) {
  if (id === 'toolbar-dock') {
    const sdk = boundedSurfaceSdk();
    const { readerDirectoryQuickActionsHeight } = pureModuleProbe(source('ReaderDirectoryQuickActions').split('@Component')[0],
      'ReaderDirectoryQuickActions.ets', {}, ['readerDirectoryQuickActionsHeight']);
    const actionPath = 'ui/controls/ReaderActionAccessibility.ets';
    const { ReaderActionAccessibility } = pureModuleProbe(readFileSync(new URL(actionPath, entry), 'utf8'),
      actionPath, { AccessibilityRoleType: { BUTTON:'button' } }, ['ReaderActionAccessibility']);
    const iconPath = 'ui/foundation/ReaderActionIconResources.ets';
    const { readerPaperActionIcon } = pureModuleProbe(readFileSync(new URL(iconPath, entry), 'utf8'),
      iconPath, { $r: value => value }, ['readerPaperActionIcon']);
    const calls = [];
    const toolSource = source('ReaderDirectoryToolbar');
    const methods = ['catalogTool','mangaSortIcon','currentDirectoryInput'];
    const tool = sdk.consumer(toolSource, methods, { ReaderActionAccessibility, readerPaperActionIcon, MangaDirectoryPressFeedback: class {} });
    Object.assign(tool, { appThemeScheme: 'day', ascending: true, actionEnabled: true, directoryMounted: true,
      directoryFocusId: 'current', directoryFocusCurrent: id => id === 'current',
      onOpenCacheManagement: () => calls.push('downloads'), onToggleSort: () => calls.push('sort') });
    tool.catalogTool(false, 'current');
    tool.catalogTool(true, 'current');
    const buttons = sdk.nodes(tool).filter(node => node.type === 'Button');
    assert.equal(buttons.length,2);
    assert.ok(buttons.every(button => button.width === 44 && button.height === 44));
    const surfaces = sdk.nodes(tool).filter(node => node.type === 'Stack' && node.width === 36 && node.height === 36);
    assert.equal(surfaces.length, 2);
    for (const scheme of ['day', 'night']) {
      tool.appThemeScheme = scheme;
      tool.ascending = true;
      tool.replay();
      assert.deepEqual(surfaces.map(node => node.backgroundColor), Array(2).fill(readerAppColor('TOK_CARD_BG', scheme)));
      tool.ascending = false;
      tool.replay();
      assert.deepEqual(surfaces.map(node => node.backgroundColor),
        [readerAppColor('TOK_CARD_BG', scheme), readerAppColor('TOK_PRIMARY_SOFT', scheme)]);
    }
    buttons[0].onClick(); buttons[1].onClick();
    tool.directoryMounted = false;
    buttons[0].onClick();
    assert.deepEqual(calls,['downloads','sort']);
    assert.equal(readerDirectoryToolbarBudget(294, true, 36, 104, 0, true).stacked,false);
    assert.equal(readerDirectoryToolbarBudget(294, true, 62, 224, 0, true).stacked,true);

    const dock = sdk.consumer(source('ReaderDirectoryQuickActions'), undefined,
      { ReaderActionAccessibility, readerDirectoryQuickActionsHeight });
    Object.assign(dock, { title: '第三百一十章', positionLabel: '2 / 10 页', edgeEnabled: true, locateEnabled: true,
      onLocateCurrent: () => calls.push('current'), onTop: () => calls.push('top'), onBottom: () => calls.push('bottom') });
    dock.initialRender();
    const dockButtons = sdk.nodes(dock).filter(node => node.type === 'Button');
    assert.equal(dockButtons.length,3);
    assert.ok(dockButtons.every(button => button.height >= 44 && button.constraintSize.minWidth === 44));
    assert.ok(sdk.nodes(dock).some(node => node.create === '在读：第三百一十章'));
    assert.ok(sdk.nodes(dock).some(node => node.create === '2 / 10 页'));
    assert.ok(sdk.nodes(dock).filter(node => node.type === 'Text').every(node => node.halfLeading === true));
    assert.ok(sdk.nodes(dock).every(node => node.backdropBlur === undefined));
    dockButtons.forEach(button => button.onClick());
    dock.edgeEnabled = false; dock.locateEnabled = false;
    dockButtons.forEach(button => button.onClick());
    assert.deepEqual(calls,['downloads','sort','current','top','bottom']);
  } else if (id === 'locate-and-cache') {
    const calls = [];
    const Novel = selectedProductionMethods(path('FullDirectoryPanel'), 'FullDirectoryPanel', ['locateCurrent']);
    const novel = Object.assign(new Novel(), { panelInputCurrent: () => true, activeTab: 'directory', currentEntry: () => ({}),
      searchDraft: '别章', searchQuery: '别章', ascending: false, locateCurrentRevision: 0,
      rebuildProjection: (...args) => calls.push(['project',...args]), beginListPositioning: (...args) => calls.push(['center',...args]) });
    novel.locateCurrent();
    assert.equal(novel.searchDraft,''); assert.equal(novel.searchQuery,''); assert.equal(novel.locateCurrentRevision,1);
    assert.deepEqual(calls.splice(0),[['project','directory',false,''],['center','directory',false]]);

    const scroller = { scrollToIndex: (...args) => calls.push(args) };
    const edge = { Top:'top', Bottom:'bottom' };
    const align = { START:'start', CENTER:'center' };
    const Manga = selectedProductionMethods(path('BookDirectoryPage'), 'BookDirectoryPage',
      ['flushPendingScroll'], { Edge:edge, ScrollAlign:align });
    const manga = Object.assign(new Manga(), { mounted:true, listReady:false, pendingLocateChapter:50, listScroller:scroller,
      mangaLayoutRows:[{entries:[{index:10}]},{entries:[{index:49},{index:50}]}], mangaFlowFooter:()=>true });
    manga.flushPendingScroll();
    assert.deepEqual(calls,[]);
    manga.listReady = true;
    manga.flushPendingScroll();
    assert.deepEqual(calls.splice(0),[[2,false,'center']]);

    const List = selectedProductionMethods(path('ReaderDirectoryNavigationList'), 'ReaderDirectoryNavigationList',
      ['planPosition'], { ScrollAlign:align });
    const list = Object.assign(new List(), { mangaDisplay:true, mangaQuickDisplay:false,
      view:{viewId:'current',locateCurrent:true,currentVisibleIndex:50,currentDisplayCentered:true} });
    assert.equal(list.planPosition().align,'center');
    list.view.currentDisplayCentered = false;
    assert.equal(list.planPosition().align,'start','legacy manga quick positioning keeps its existing alignment');

    const Ops = selectedProductionMethods(new URL('features/reading/presentation/ReaderDirectoryOperations.ts', entry),
      'ReaderDirectoryOperations', ['openCacheManagement']);
    const Index = selectedProductionMethods(new URL('pages/Index.ets', entry), 'Index', ['directoryJourneyPorts']);
    const index = Object.assign(new Index(), { readingEntry: {sessionActive:false}, downloadNavigation: {
      open: intent => calls.push(['detail-downloads', intent]),
      requestFromReader: key => calls.push(['reader-downloads', key]),
    }});
    const owner = {}, scene = {owner,book:{},directoryVisible:true,retired:false,foreground:true};
    const ops = Object.assign(new Ops(), {ports:{scene:()=>scene,ownsRuntime: runtime=>runtime===owner,
      openDownloadProgress:index.directoryJourneyPorts().showDownloads}});
    ops.openCacheManagement(); scene.foreground = false; ops.openCacheManagement();
    scene.foreground = true; index.readingEntry.sessionActive = true; ops.openCacheManagement();
    scene.directoryVisible = false; ops.openCacheManagement();
    assert.deepEqual(calls,[['detail-downloads',{kind:'fresh',detailKey:''}],['reader-downloads','']]);
  } else if (id === 'detail-directory-page') {
    const header = path('ReaderFullDirectory');
    const page = selectedProductionComponentCallback(header, 'PageBackBar', 'onBack', {
      consumeBack: identity => { assert.equal(identity, 'current'); },
    }, { identity: 'current' });
    page();

    const Frame = selectedProductionMethods(header, 'ReaderFullDirectory', ['topBarTop', 'fullPanelHeight'], {
      readerWindowMetrics: () => ({}), readerVisualSafeTop: () => 29, readerInteractiveSafeBottom: () => 22,
    });
    const frame = Object.assign(new Frame(), { catalogContext: 'detail', readerWindowMetricsRevision: 1,
      headerSpec: {topGap: 18}, usesExpandedLayout: () => false, liveContainerHeight: () => 900, fullPanelTop: () => 95 });
    assert.equal(frame.topBarTop(), 29);
    assert.equal(frame.fullPanelHeight(), 783);
    frame.catalogContext = 'reader';
    assert.equal(frame.fullPanelHeight(), 736);

    const Panel = selectedProductionMethods(path('FullDirectoryPanel'), 'FullDirectoryPanel', [
      'standaloneAvailableHeight', 'standaloneEditorNaturalHeight', 'standaloneEditorHeight',
      'standaloneShort', 'chapterListHeight', 'bookmarkListHeight', 'innerWidth',
    ], { TOK_SPACE_XS: 4 });
    const panel = Object.assign(new Panel(), { detailPage: true, embeddedInControl: false,
      activeTab: 'directory', panelHeight: () => 330, panelWidth: () => 340, panelHeaderHeight: () => 30,
      tabStripHeight: () => 42, searchControlsHeight: () => 51, standaloneFooterHeight: () => 56,
      directoryRowHeight: () => 40, listRowHeight: () => 74 });
    assert.equal(panel.innerWidth(), 340);
    assert.equal(panel.standaloneEditorHeight(), 95);
    assert.equal(panel.chapterListHeight(), 179);
    panel.activeTab = 'bookmarks';
    assert.equal(panel.bookmarkListHeight(), 235);
    panel.panelHeight = () => 117;
    assert.ok(panel.standaloneShort());
    assert.equal(panel.bookmarkListHeight(), 73);
  } else {
    const catalogPath = path('FullDirectoryPanel');
    const Panel = selectedProductionMethods(catalogPath, 'FullDirectoryPanel', [
      'applySearch', 'clearCatalogSearch', 'catalogClearSearchVisible',
    ]);
    const chapter = { title: '第一章', index: 0 };
    const panel = Object.assign(new Panel(), { entries: [chapter], projectedEntries: [], activeTab: 'directory',
      searchDraft: '无匹配', searchQuery: '无匹配', navigationActive: false, ascending: true,
      panelInputCurrent: () => true, catalogToolbar: () => true,
      rebuildProjection(_tab, _ascending, query) { this.projectedEntries = query === '' ? this.entries : []; },
      scheduleProjectionTopScroll() {},
    });
    const sdk = boundedSurfaceSdk({ allowEmptyBranchAdmission: true });
    const flat = sdk.consumer(source('FullDirectoryPanel'), ['standaloneCatalogState']);
    Object.assign(flat, {
      appThemeScheme: 'day', entries: [chapter], catalogBusy: false,
      catalogEmptyMessage: () => '没有匹配的章节', catalogRetryVisible: () => false,
      panelInputCurrent: () => true, catalogClearSearchVisible: () => panel.catalogClearSearchVisible(),
      clearCatalogSearch: () => panel.clearCatalogSearch(),
    });
    flat.standaloneCatalogState();
    const clearAction = sdk.walk(flat).find(child => child instanceof sdk.deps.ReaderRecoveryAction);
    assert.ok(clearAction, 'flat state renders an actual clear action');
    assert.equal(panel.catalogClearSearchVisible(), true);
    sdk.nodes(clearAction).find(node => node.onClick).onClick();
    assert.equal(panel.searchDraft, '');
    assert.equal(panel.searchQuery, '');
    assert.deepEqual(panel.projectedEntries, [chapter]);

    const clearTree = selectedProductionComponentCallback(catalogPath, 'ReaderDirectoryNavigationSurface', 'onClearSearch', panel);
    panel.navigationActive = true;
    panel.searchDraft = '无匹配';
    panel.applySearch();
    clearTree();
    assert.equal(panel.searchDraft, '');
    assert.equal(panel.searchQuery, '');

    const directoryPath = path('ReaderFullDirectory');
    const Directory = selectedProductionMethods(directoryPath, 'ReaderFullDirectory', [
      'offlineMenuLeft', 'offlineMenuCanOpen', 'reconcileOfflineMenu', 'dismissOfflineMenu',
    ]);
    const menu = Object.assign(new Directory(), { offlineMenuVisible: true, offlineMenuGeneration: 2,
      containerOriginX: 11, moreTriggerRight: 611, topBarLeft: () => 28, topBarRight: () => 30,
      liveContainerWidth: () => 680, offlineMenuWidth: () => 142,
      isLocalBook: () => false, directoryRulesAvailable: () => false,
      catalogContext: 'reader', directoryRecovery: { offlineBlocked: false }, offlineBookOperationActive: false,
      interactive: true, directoryInputCurrent: () => true,
    });
    assert.equal(menu.offlineMenuLeft(), 458);
    const menuBackdrop = sdk.consumer(source('ReaderFullDirectory'), ['offlineMenuBackdrop']);
    menuBackdrop.dismissOfflineMenu = menu.dismissOfflineMenu.bind(menu);
    menuBackdrop.offlineMenuBackdrop('current', 'book', 2);
    const backdrop = sdk.nodes(menuBackdrop).find(node => node.type === 'Row');
    assert.equal(backdrop.width, '100%');
    assert.equal(backdrop.height, '100%');
    backdrop.onClick();
    assert.equal(menu.offlineMenuVisible, false);
    menu.offlineMenuVisible = true;
    menu.offlineBookOperationActive = true;
    menu.reconcileOfflineMenu();
    assert.equal(menu.offlineMenuVisible, false);
  }
  recordContractCasePass(id);
}
