import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { boundedSurfaceSdk } from './lib/bounded-surface-sdk-probe.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { selectedProductionMethods } from './lib/selected-production-methods.mjs';
import { readerDirectoryToolbarBudget } from '../entry/src/main/ets/features/reading/presentation/ReaderFullDirectoryBudget.ts';

const selected = selectContractCases({
  'toolbar-dock': 'Standalone native cache/sort and current/top/bottom targets keep independent guarded callbacks.',
  'locate-and-cache': 'Current target clears old query and centers by source index, and cache opens only for the current Runtime.',
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
    const calls = [];
    const toolSource = source('ReaderDirectoryToolbar');
    const methods = ['catalogTool','mangaSortIcon','currentDirectoryInput'];
    const tool = sdk.consumer(toolSource, methods, { ReaderActionAccessibility, MangaDirectoryPressFeedback: class {} });
    Object.assign(tool, { appThemeScheme: 'day', ascending: true, actionEnabled: true, directoryMounted: true,
      directoryFocusId: 'current', directoryFocusCurrent: id => id === 'current',
      onOpenCacheManagement: () => calls.push('downloads'), onToggleSort: () => calls.push('sort') });
    tool.catalogTool(false, 'current');
    tool.catalogTool(true, 'current');
    const buttons = sdk.nodes(tool).filter(node => node.type === 'Button');
    assert.equal(buttons.length,2);
    assert.ok(buttons.every(button => button.width === 44 && button.height === 44));
    assert.equal(sdk.nodes(tool).filter(node => node.type === 'Stack' && node.width === 36 && node.height === 36).length,2);
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
    dockButtons.forEach(button => button.onClick());
    dock.edgeEnabled = false; dock.locateEnabled = false;
    dockButtons.forEach(button => button.onClick());
    assert.deepEqual(calls,['downloads','sort','current','top','bottom']);
  } else {
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
    const owner = {}, scene = {owner,book:{},directoryVisible:true,retired:false,foreground:true};
    const ops = Object.assign(new Ops(), {ports:{scene:()=>scene,ownsRuntime: runtime=>runtime===owner,
      openDownloadProgress:key=>calls.push(['downloads',key])}});
    ops.openCacheManagement(); scene.foreground = false; ops.openCacheManagement();
    scene.foreground = true; scene.directoryVisible = false; ops.openCacheManagement();
    assert.deepEqual(calls,[['downloads','']]);
  }
  recordContractCasePass(id);
}
