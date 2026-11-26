import { actualReaderPostLayoutFrame } from './lib/reader-post-layout-frame-probe.mjs';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  'journey-retention': 'Actual SourceJourneyPresentation and both operation owners retain copied filters/scroll only across the same Runtime Source-Tools-Source journey; no Core process.',
  'tools-focus-echo': 'Actual page and SearchField changeText preserve pending Tools focus on the restored value echo, cancel on real edits and reject stale/inactive input; method-level request and explicit focus ACK only.',
  'scroll-restoration': 'Actual Source page capture/restore methods preserve signed header offsets and same-layout itemY, use current-layout insets, and retire changed-filter/old-opening frames.',
  'header-top-growth': 'Actual header measurement and geometry move only an unchanged current list top after the native frame. Coalesced heights, old receipts and anchors are covered.',
  'tools-delete-confirmation': 'Actual Source Tools presentation and selection owner retain the selection until confirmation and reject stale confirmations.',
});
if (selected.length) {
  registerHooks({ resolve(specifier, context, next) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
      const url = new URL(specifier + '.ts', context.parentURL);
      if (existsSync(fileURLToPath(url))) return next(url.href, context);
    }
    return next(specifier, context);
  } });
  const { copySourceManagementScroll, sourceManagementFilterKey } = await import('../entry/src/main/ets/features/source/presentation/SourceManagementScrollState.ts');
  const { actualSourceJourneyTypes, actualSourceManagementGeometry } = await import('./lib/source-management-owner-probe.mjs');
  const { runtimeOwnerIdentityProbe } = await import('./lib/reader-runtime-admission-probe.mjs');
  const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
  const tick = () => new Promise(resolve => setImmediate(resolve));
  const filters={searchQuery:'晋江',status:'未检测',category:'novel',group:'自选'};
  const scroll={anchorId:'b',firstIndex:2,itemY:22,offset:345,filterKey:sourceManagementFilterKey(filters),layoutKey:'328:1:0'};
  async function journeyRetention() {
    let installed;
    const Runtime=runtimeOwnerIdentityProbe(()=>installed);
    const {SourceJourneyPresentation,SourceOrchestrator,SourceToolsOrchestrator}=actualSourceJourneyTypes({ReaderRuntimeOwner:Runtime,hilog:{info(){},warn(){},error(){}}});
    const runtime=()=>({supportsCoreCapability:()=>false,async request(method){assert.equal(method,'source.list');return{data:{sources:[]}};}});
    const settle=async(owner)=>{await tick();await SourceOrchestrator.forRuntime(owner)?.operationChain;await SourceToolsOrchestrator.forRuntime(owner)?.operationTail;await tick();};
    const owner=runtime();installed=owner;
    const journey=new SourceJourneyPresentation();
    let route='source';
    journey.openManagement(owner,'source:first',()=>route==='source');await settle(owner);
    assert.equal(journey.initialManagementViewState('source:first'),undefined);
    const requested={...filters,anchorSourceId:'b',anchorFallbackIndex:1,toolsEntry:'header',scroll:{...scroll}};
    assert.equal(journey.retainManagementViewForTools('source:old',requested),false);
    assert.equal(journey.retainManagementViewForTools('source:first',requested),true);
    requested.searchQuery='caller mutation';requested.scroll.offset=999;
    journey.retire();route='sourceTools';journey.openTools(owner,'tools:first',()=>route==='sourceTools');await settle(owner);
    journey.retire();route='source';journey.openManagement(owner,'source:return',()=>route==='source');await settle(owner);
    const returned=journey.initialManagementViewState('source:return');
    assert.deepEqual(returned,{...filters,anchorSourceId:'b',anchorFallbackIndex:1,toolsEntry:'header',scroll});
    returned.group='caller changed returned value';returned.scroll.itemY=-999;
    assert.equal(journey.initialManagementViewState('source:return').group,filters.group);
    assert.equal(journey.initialManagementViewState('source:return').scroll.itemY,22);
    assert.equal(journey.initialManagementViewState('source:first'),undefined);
    journey.retainManagementViewForTools('source:return',{...filters,anchorSourceId:'b',scroll});
    journey.retire();journey.retire();
    journey.openManagement(owner,'source:fresh',()=>true);await settle(owner);
    assert.equal(journey.initialManagementViewState('source:fresh'),undefined,'an extra route retirement ends the Tools handoff');
    journey.retainManagementViewForTools('source:fresh',{...filters,anchorSourceId:'b',scroll});journey.retire();
    route='sourceTools';journey.openTools(owner,'tools:second',()=>route==='sourceTools');await settle(owner);journey.retire();
    const next=runtime();installed=next;route='source';journey.openManagement(next,'source:new-runtime',()=>true);await settle(next);
    assert.equal(journey.initialManagementViewState('source:new-runtime'),undefined,'another Runtime owns a fresh presentation');
    assert.equal(copySourceManagementScroll({...scroll,offset:NaN}),undefined);
    assert.equal(copySourceManagementScroll({...scroll,itemY:Infinity}),undefined);
    assert.equal(copySourceManagementScroll({...scroll,firstIndex:-1}),undefined);
    assert.equal(copySourceManagementScroll({...scroll,anchorId:'',firstIndex:0,offset:-58}).offset,-58);
  }
  async function toolsDeleteConfirmation() {
    const sources = ['https://a.test', 'https://b.test'].map((id) => ({
      sourceId: id, name: id, baseUrl: id, enabled: true, enabledExplore: false, sourceVersion: '1'.repeat(64),
      bookSource: { bookSourceUrl: id, bookSourceName: id, bookSourceType: 0, enabled: true },
    }));
    const deletes = [];
    const owner = {
      supportsCoreCapability: () => false,
      async request(method) {
        assert.equal(method, 'source.list');
        return { data: { sources } };
      },
    };
    let installed = owner;
    const Runtime = runtimeOwnerIdentityProbe(() => installed);
    const { SourceJourneyPresentation } = actualSourceJourneyTypes({
      ReaderRuntimeOwner: Runtime, hilog: { info() {}, warn() {}, error() {} },
    });
    const journey = new SourceJourneyPresentation();
    const identity = 'tools:delete-confirmation';
    journey.openTools(owner, identity, () => true);
    const host = journey.tools(identity);
    assert.ok(host);
    await tick();
    await host.operationTail;
    host.deleteSelected = ids => deletes.push([...ids]);
    const requested = () => {
      const snapshot = host.current();
      const selection = { sourceIds: snapshot.selectedSourceIds.slice(),
        sourceListRevision: snapshot.sourceListRevision, selectionRevision: snapshot.selectionRevision };
      let alert;
      journey.requestDelete(identity, selection, (count, confirm, current) => { alert = { count, confirm, current }; });
      assert.ok(alert);
      return alert;
    };
    const all = sources.map(row => row.sourceId);
    host.selectAll();
    const cancelled = requested();
    assert.equal(cancelled.count, 2);
    assert.deepEqual(host.current().selectedSourceIds, all, 'opening or cancelling a confirmation must preserve selection');
    assert.deepEqual(deletes, []);

    host.setSelection([all[1]]);
    assert.equal(cancelled.current(), false);
    cancelled.confirm();
    assert.deepEqual(deletes, [], 'a superseded selection cannot submit an old confirmation');
    assert.deepEqual(host.current().selectedSourceIds, [all[1]]);

    const confirmed = requested();
    assert.equal(confirmed.current(), true);
    confirmed.confirm();
    confirmed.confirm();
    assert.deepEqual(deletes, [[all[1]]]);
    assert.deepEqual(host.current().selectedSourceIds, []);

    host.setSelection([all[0]]);
    const retired = requested();
    installed = undefined;
    assert.equal(retired.current(), false);
    retired.confirm();
    assert.deepEqual(deletes, [[all[1]]], 'a retired Runtime cannot submit');
    journey.retire();
  }
  async function scrollRestoration() {
    const file=new URL('../entry/src/main/ets/features/source/ui/SourceManagementPage.ets',import.meta.url);
    const source=readFileSync(file,'utf8');
    const {installedEtsCompiler}=await import('./lib/ets-compiler-runtime.mjs');
    const {ts,options}=installedEtsCompiler();
    const tree=ts.createSourceFile('SourceScroll.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
    const frame=tree.statements.find(node=>node.name?.getText(tree)==='SourceListLayoutFrame');assert.ok(frame);
    const emitted=ts.transpileModule(frame.getText(tree),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
    const SourceListLayoutFrame=new Function('FrameCallback','ReaderPostLayoutFrame', emitted+';return SourceListLayoutFrame;')(class{}, actualReaderPostLayoutFrame());
    const names=['currentFilterKey','scrollLayoutKey','cancelScrollRestore',
      'readCurrentScroll','observeRestoredScroll','observeVerificationScroll',
      'scheduleSourceAnchorRestore','sourceAnchorReadPending','sourceReturnFiltersMatch','managementOpeningIsCurrent','managementBackIsCurrent','cancelToolsReturnFocus'];
    const { ReaderRectVp, ReaderWindowMetricsSnapshot, readerInteractiveSafeTop, readerInteractiveSafeBottom } =
      await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
    let metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, 366, 809));
    const Page=selectedProductionMethods(file,'SourceManagementPage',names,{SourceListLayoutFrame,sourceManagementFilterKey,copySourceManagementScroll,
      ReaderWindowCoordinator:{metrics:()=>metrics},readerInteractiveSafeTop,readerInteractiveSafeBottom,
      ReaderUIVerificationProbe:{enabled:()=>false},
      readerScrollStartOffset:value=>value.startInset,ScrollAlign:{START:'start'},Edge:{Top:'top'}});
    function page(initial) {
      const actor=new Page(),frames=[],calls=[];
      Object.assign(actor,{mounted:true,appForeground:true,listMounted:true,temporaryBackIdentity:'source:current',
        searchQuery:filters.searchQuery,statusValue:filters.status,categoryValue:filters.category,groupValue:filters.group,
        firstVisibleListIndex:2,scrollRestoreEpoch:0,anchorRestoreScheduled:false,toolsFocusRevision:0,
        operation:{readFacts:{fact:'succeeded'}},statusKind:'idle',projectedSources:[{sourceId:'a'},{sourceId:'b'},{sourceId:'c'}],
        readerWindowMetricsRevision:0,contentFrame:()=>({width:328}),fontScale:()=>1,scrollLayout:()=>({startInset:58}),
        sourceScroller:{currentOffset:()=>({yOffset:345}),getItemRect:()=>({y:80,height:110}),
          scrollToIndex:(...args)=>calls.push(['index',...args]),scrollBy:(...args)=>calls.push(['by',...args]),
          scrollTo:value=>calls.push(['to',value]),scrollEdge:value=>calls.push(['edge',value])},
        getUIContext:()=>({postFrameCallback:callback=>frames.push(callback)})});
      actor.initialViewState = initial ?? {...filters,anchorSourceId:'b',anchorFallbackIndex:1,
        scroll:{...scroll, layoutKey:actor.scrollLayoutKey()}};
      actor.pendingSourceAnchor = actor.initialViewState.anchorSourceId;
      actor.pendingScroll = copySourceManagementScroll(actor.initialViewState.scroll);
      return{actor,frames,calls,flush(){for(let i=0;i<5&&frames.length;i++)frames.shift().onIdle(1);assert.equal(frames.length,0,'bounded exact frame chain');}};
    }
    const same=page();same.actor.scheduleSourceAnchorRestore();same.flush();
    assert.deepEqual(same.calls,[['index',2,false,'start'],['by',0,58]],'same-layout anchor retains its item offset');
    const changed=page();changed.actor.fontScale=()=>2;changed.actor.scheduleSourceAnchorRestore();changed.flush();
    assert.deepEqual(changed.calls,[['index',2,false,'start'],['by',0,22]],'changed layout aligns to current header clearance');
    const top=page({...filters,anchorSourceId:'',scroll:{...same.actor.initialViewState.scroll,anchorId:'',firstIndex:0,offset:-58}});
    top.actor.scheduleSourceAnchorRestore();top.flush();assert.deepEqual(top.calls,[['to',{xOffset:0,yOffset:-58,animation:false}]]);
    for(const retire of ['opening','filter','touch']) {
      const old=page();old.actor.scheduleSourceAnchorRestore();
      if(retire==='opening')old.actor.temporaryBackIdentity='source:successor';
      if(retire==='filter')old.actor.searchQuery='changed';
      if(retire==='touch')old.actor.cancelScrollRestore();
      old.flush();assert.deepEqual(old.calls,[],`${retire} retires queued restore`);
    }
    const capture=page();capture.actor.cancelScrollRestore();capture.actor.sourceScroller.getItemRect=()=>({y:22,height:110});
    assert.deepEqual(capture.actor.readCurrentScroll(), same.actor.initialViewState.scroll);

    // The filter header is still the first native list item, so this scroll
    // position has an offset but no source row anchor.
    const partiallyScrolled = page();
    partiallyScrolled.actor.cancelScrollRestore();
    partiallyScrolled.actor.firstVisibleListIndex = 0;
    partiallyScrolled.actor.readerWindowMetricsRevision = 5;
    const captured = { ...filters, anchorSourceId: '', scroll: partiallyScrolled.actor.readCurrentScroll() };
    assert.equal(captured.scroll.anchorId, '');
    assert.equal(captured.scroll.offset, 345);

    const afterKeyboard = page(captured);
    afterKeyboard.actor.readerWindowMetricsRevision = 7;
    afterKeyboard.actor.scheduleSourceAnchorRestore();
    afterKeyboard.flush();
    assert.deepEqual(afterKeyboard.calls, [['to', {xOffset:0,yOffset:345,animation:false}]],
      'the keyboard round trip must retain a nonzero offset when the final layout matches');

    metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, 366, 660));
    const resized = page(captured);
    resized.actor.readerWindowMetricsRevision = 7;
    resized.actor.scheduleSourceAnchorRestore();
    resized.flush();
    assert.deepEqual(resized.calls, [['edge', 'top']], 'a genuine height change invalidates the raw offset');
  }

  async function headerTopGrowth() {
    const file = new URL('../entry/src/main/ets/features/source/ui/SourceManagementPage.ets', import.meta.url);
    const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
    const { ts, options } = installedEtsCompiler();
    const { APP_FLOATING_HEADER_BAR_HEIGHT, APP_FLOATING_HEADER_TOP_GAP } = await import('../entry/src/main/ets/ui/foundation/ReaderHeaderMetrics.ts');
    const { applyReaderStandardFloatingHeader } = await import('../entry/src/main/ets/ui/layout/ReaderPageGeometry.ts');
    const { READER_STANDARD_PAGE_CONTENT_GAP } = await import('../entry/src/main/ets/ui/layout/ReaderPageShell.ts');
    const tree = ts.createSourceFile('SourceHeaderScroll.ets', readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    const frame = tree.statements.find(node => node.name?.getText(tree) === 'SourceListLayoutFrame');
    assert.ok(frame);
    const emitted = ts.transpileModule(frame.getText(tree), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const SourceListLayoutFrame = new Function('ReaderPostLayoutFrame', emitted + ';return SourceListLayoutFrame;')(actualReaderPostLayoutFrame());
    const layout = actualSourceManagementGeometry();
    const Page = selectedProductionMethods(file, 'SourceManagementPage', [
      'recordMeasurement', 'alignListTopAfterHeaderChange', 'refreshGeometry', 'observeVerificationGeometry', 'managementOpeningIsCurrent',
      'managementBackIsCurrent', 'cancelScrollRestore',
    ], { ...layout, APP_FLOATING_HEADER_BAR_HEIGHT, READER_STANDARD_PAGE_CONTENT_GAP, applyReaderStandardFloatingHeader,
      ReaderUIVerificationProbe: { enabled: () => false },
      SourceListLayoutFrame, Edge: { Top: 'top' } });
    const fallbackContentStart = APP_FLOATING_HEADER_TOP_GAP + APP_FLOATING_HEADER_BAR_HEIGHT + READER_STANDARD_PAGE_CONTENT_GAP;
    function current() {
      const frames = [], calls = [];
      const actor = Object.assign(new Page(), { mounted: true, appForeground: true, listMounted: true,
        temporaryBackIdentity: 'same-opening', pendingSourceAnchor: '', scrollRestoreEpoch: 1, measurementKey: 3,
        footerMeasurementKey: 3, measurements: new layout.ReaderMeasurementStore(), measurementRevision: 0,
        viewportWidth: 320, viewportHeight: 770, footerFallbackHeight: () => 64,
        getUIContext: () => ({ postFrameCallback: callback => frames.push(callback) }),
        sourceScroller: { getItemRect: () => ({ y: fallbackContentStart, height: 330 }), scrollEdge: edge => calls.push(edge) } });
      actor.refreshGeometry();
      return { actor, frames, calls, flush: () => { for (const f of frames.splice(0)) f.onIdle(1); } };
    }
    const top = current();
    assert.equal(top.actor.geometry.content.startInset, fallbackContentStart);
    top.actor.recordMeasurement('source:header', 132, 2);
    assert.equal(top.actor.geometry.content.startInset, fallbackContentStart);
    top.actor.recordMeasurement('source:header', 132, 3);
    top.actor.recordMeasurement('source:header', 140, 3);
    assert.equal(top.actor.geometry.content.startInset,
      APP_FLOATING_HEADER_TOP_GAP + 140 + READER_STANDARD_PAGE_CONTENT_GAP);
    assert.equal(top.frames.length, 1, 'same opening coalesces header measurements');
    assert.deepEqual(top.calls, [], 'wait for the new contentStartOffset');
    top.flush();
    assert.deepEqual(top.calls, ['top']);
    for (const change of ['user touch', 'new opening', 'new offset', 'pending anchor']) {
      const other = current();
      if (change === 'pending anchor') other.actor.pendingSourceAnchor = 'bookmarked-source';
      other.actor.recordMeasurement('source:header', 132, 3);
      if (change === 'user touch') other.actor.cancelScrollRestore();
      if (change === 'new opening') other.actor.temporaryBackIdentity = 'later-opening';
      if (change === 'new offset') other.actor.sourceScroller.getItemRect = () => ({ y: -11, height: 330 });
      other.flush();
      assert.deepEqual(other.calls, [], change);
    }
  }

  async function toolsFocusEcho() {
    const file = new URL('../entry/src/main/ets/features/source/ui/SourceManagementPage.ets', import.meta.url);
    const source = readFileSync(file, 'utf8');
    const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
    const { ts, options } = installedEtsCompiler();
    const tree = ts.createSourceFile('SourceFocus.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    const frame = tree.statements.find(node => node.name?.getText(tree) === 'SourceListLayoutFrame');
    const emitted = ts.transpileModule(frame.getText(tree), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
    const SourceListLayoutFrame = new Function('FrameCallback', 'ReaderPostLayoutFrame', emitted + ';return SourceListLayoutFrame;')(class {}, actualReaderPostLayoutFrame());
    const Page = selectedProductionMethods(file, 'SourceManagementPage', ['sourceSearchInputIdentity', 'applySourceSearchInput',
      'cancelToolsReturnFocus', 'traceToolsReturnFocus', 'toolsFocusId', 'onToolsEntryLayout', 'scheduleToolsReturnFocus',
      'onToolsEntryFocused', 'managementOpeningIsCurrent', 'managementBackIsCurrent'],
      { SourceListLayoutFrame, readerPageAreaLength: value => Number(value), hilog: { info() {} } });
    const Field = selectedProductionMethods(new URL('../entry/src/main/ets/ui/controls/ReaderSearchField.ets', import.meta.url),
      'ReaderSearchField', ['changeText']);
    function fixture() {
      const frames = [], requests = [], page = new Page();
      Object.assign(page, { mounted: true, appForeground: true, temporaryBackIdentity: 'source-back:3', searchQuery: '17',
        sourceSearchInputRevision: 0, searchInputRevision: 0, pendingToolsFocus: 'header', toolsFocusReady: false,
        toolsFocusScheduled: false, toolsFocusRevision: 1, toolsFocusAttempt: 0, groupOpen: false,
        rebuildSourceProjection() {}, getUIContext: () => ({ postFrameCallback: frame => frames.push(frame),
          getFocusController: () => ({ requestFocus: id => requests.push(id) }) }) });
      const identity = page.sourceSearchInputIdentity();
      const field = Object.assign(new Field(), { mounted: true, mode: 'live', onTextChange: value => page.applySourceSearchInput(identity, value) });
      return { page, field, frames, requests };
    }
    const echo = fixture();
    echo.field.changeText('17');
    assert.equal(echo.page.pendingToolsFocus, 'header', 'restored-value Native echo must preserve the pending return target');
    echo.page.onToolsEntryLayout('source-back:3', 'header', { width: 44, height: 44 });
    echo.frames.shift().onIdle(1);
    assert.deepEqual(echo.requests, ['source-back:3:tools:header']);
    assert.equal(echo.page.pendingToolsFocus, 'header', 'a request is not an onFocus ACK');
    echo.page.onToolsEntryFocused('source-back:3', 'header');
    assert.equal(echo.page.pendingToolsFocus, undefined);
    while (echo.frames.length) echo.frames.shift().onIdle(1);
    assert.equal(echo.requests.length, 1, 'ACK retires a queued second request');
    const edit = fixture();
    edit.page.onToolsEntryLayout('source-back:3', 'header', { width: 44, height: 44 });
    edit.field.changeText('18');
    assert.equal(edit.page.searchQuery, '18');
    assert.equal(edit.page.pendingToolsFocus, undefined, 'an actual changed draft owns focus');
    while (edit.frames.length) edit.frames.shift().onIdle(1);
    assert.deepEqual(edit.requests, []);
    const stale = fixture(); stale.page.temporaryBackIdentity = 'successor'; stale.field.changeText('99');
    assert.equal(stale.page.searchQuery, '17', 'retired input cannot borrow the successor opening');
    const blocked = fixture(); blocked.page.groupOpen = true; blocked.field.changeText('99');
    assert.equal(blocked.page.searchQuery, '17');
    assert.equal(blocked.page.searchInputRevision, 1, 'rejected changed native buffer requests a current rebind');
  }
  const cases={'journey-retention':journeyRetention,'scroll-restoration':scrollRestoration,'header-top-growth':headerTopGrowth,'tools-focus-echo':toolsFocusEcho,'tools-delete-confirmation':toolsDeleteConfirmation};
  for(const id of selected){await cases[id]();recordContractCasePass(id);}
}
