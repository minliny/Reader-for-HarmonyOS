import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const cases=selectContractCases({
 'ready-close-admission':'Current ready/direct-ready refusal during serialized approved cover exit, duplicate Back/covered/finish, fresh origin and ordinary ready acceptance.',
 'close-cancellation':'Current actual reduced actor fade-to-covered completion, clear/navigation/window/nonbookshelf/background serialized cleanup.',
 'projection-identity':'Current deferred remote/local/fallback projection composition and duplicate ready, visual flush/navigation discard, book/runtime/reader identity refusal.',
 'retained-shell-receipts':'Actual SDK retained ReaderShell opacity/BookshelfShell callbacks, current child navigation Prop intent, current LibrarySearch header owner and recovery measurement identities.',
 'shelf-chrome-lease':'Actual Page claim/finish/teardown restore chrome only for the current host.'
});
if(cases.length){
 const {readFileSync}=await import('node:fs');
 const {installedEtsCompiler}=await import('./lib/ets-compiler-runtime.mjs');
 const {selectedProductionMethods}=await import('./lib/selected-production-methods.mjs');
 const {pureModuleProbe}=await import('./lib/ets-pure-module-probe.mjs');
 const {createEtsBuilderProbe}=await import('./lib/ets-builder-probe.mjs');
 const {createArkUIPropertyRuntimeProbe}=await import('./lib/arkui-property-runtime-probe.mjs');
 const {bookshelfOpeningActor}=await import('./lib/bookshelf-opening-probe.mjs');
 const {readerAppColor}=await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
 const {readerTypographyRoles}=await import('./lib/reader-typography-probe.mjs');
 const {readerPageAreaLength}= (await import('./lib/reader-page-shell-runtime-probe.mjs')).actualReaderPageShell();
 const geometry=await import('../entry/src/main/ets/features/bookshelf/BookshelfNavigationMotion.ts');
 const {ts,options}=installedEtsCompiler();
 const file=path=>new URL('../entry/src/main/ets/'+path,import.meta.url),read=path=>readFileSync(file(path),'utf8');
 function sdkBuilder(source,names,deps={},hooks={}){return createEtsBuilderProbe(source,names,{...readerTypographyRoles,readerAppColor,readerPageAreaLength,...deps},hooks);}
 class Frame{constructor(callback){this.callback=callback;}}
 const target={x:0,y:0,width:390,height:844},origin={sourceId:'local',bookId:'a',coverUrl:'cover-a',title:'A',radius:8,rect:{x:24,y:180,width:98,height:146}};
 const request=(id,direction='open',extra={})=>({id,direction,origin,target,paperColor:'#f4f2ed',paperInk:'#24211d',...extra});
 let now=0;
 const deps={...geometry,hilog:{info(){}},readerMotionNowMs:()=>now,readerAppColor,readerAppearanceThemeStyle:()=>({paperStart:'#f4f2ed',ink:'#24211d'}),
   ReaderRuntimeOwner:{current:()=>({getAppearanceStore:()=>({current:()=>({activeTheme:'day'})})})},ReaderNavigationBackfillFrame:Frame,LOCAL_SOURCE_ID:'local',ReadingEntryHost:{forRuntime:()=>({preparationVisibilityChanged(){}})}};
 const Index=selectedProductionMethods(file('pages/Index.ets'),'Index',["clearShelfNavigationMotion","finishShelfNavigationMotion","onShelfCoverClosed","shelfMotionViewport","sameShelfMotionWindow","onShelfMotionWindowChanged","beginShelfReturnMotion","resolveShelfReturnMotionFallback","receiveShelfReturnMotionOrigin","receiveShelfReturnMotionUnavailable","returnToReadingOrigin","completeReturnToReadingOrigin","nextNavigationGeneration","currentReaderPresentationIdentity","readingReadyCallback","presentPreparedReading","onBackPress","onSearchVisibilityChanged","openShelfBookWithMotion","retainsShelfOpeningBackground","receiveShelfOpeningReaderOpacity","isCurrentBookshelfPresentation","traceShelfMotion","shelfPaperPalette","requestShelfOpeningReverse","isCurrentSearchPresentation"],deps);
 function indexFixture(){
    const frames = [], calls = [], projections = [], nativeResets = [];
    const runtime = { setDownloadReadingProtection: (...args) => calls.push(args.length > 0 ? 'set-protection' : 'release-protection'),
      bookAcquisitions: () => ({ visibilityChanged() {}, setPreparationVisible() {} }) };
    const value = Object.assign(new Index(), {
      readingSessionActive: true, detailBook: { ...origin, contentKind: 'text' }, readingOriginRoute: 'bookshelf', route: 'reading',
      shelfMotionOrigin: origin, shelfMotionWindow: target, shelfMotionSequence: 10, navigationGeneration: 20,
      pendingShelfCoverExitId: -1, settingsSnapshot: { reduceMotion: false }, searchAppForeground: true,
      shelfOpeningReaderOpacity: 1, readingContentKind:'text', shelfMotionReturnNavigation:-1, returnMotionBookKey:'', detailShelfAdmissionMount: 4, shelfReceiptRetired: false,
      mountedRuntimeOwner: runtime, readingReadyGeneration: 5, readingEntryScopeId: 3, readingPresentedScopeId: -1,
      shelfReadingPreparation: false, startupEntryId: 0, preparedReaderRoute: 'reading', detailToc: [{ index: 0, bookmarks: [] }],
      liveViewport: { ...target }, transientFeedback: { reset: () => calls.push('transient-reset') },
      nativeAlertOwner: { retire: () => calls.push('native-retire') }, bookshelfHost: { detachManagementPresentation() {} },
      isCurrentRuntime: owner => owner === runtime, hasVisibleImportDialog: () => false, consumeTemporaryBackBridge: () => false,
      bindReadingEntryReader: () => calls.push('bind-reader'), refreshDetailAcquisitionProjection: () => Promise.resolve(),
      refreshBookshelf: () => calls.push('refresh-shelf'), readingPreparationContext: () => ({}), sharedReadingPreparationSeeds: () => [],
      searchHost: { visibilityChanged() {} }, consumeSystemFileOpen() {},showLibraryRestoreStartupFeedback(){calls.push("restore-feedback-port");},
      scheduleNavigationBackfillAfterReady: () => calls.push('schedule-backfill'),
      openShelfBook: selection => { value.detailBook = selection; value.route = 'reading'; value.readingOriginRoute = 'bookshelf'; value.readingSessionActive = true; },
      getReadingEntryHost: () => ({ deferredDirectoryProjection: () => () => projections.push('fallback') }),
      getUIContext: () => ({ postFrameCallback: frame => frames.push(frame.callback), px2vp: px => px,
        animateTo: (options, event) => { nativeResets.push(options.duration); event(); },
        getFrameNodeById: () => ({ getPositionToWindowWithTransform: () => ({ x: value.liveViewport.x, y: value.liveViewport.y }) }),
        getComponentUtils: () => ({ getRectangleById: () => ({ size: { width: value.liveViewport.width, height: value.liveViewport.height } }) }) }),
    });
    for (const name of ['retireSettingsPresentation', 'retireSourceManagementPresentation', 'retireSourceSwitchPresentation',
      'retireRssEditorPresentation', 'retireRssPresentation', 'retireReadingEntryPresentation', 'retireBookshelfCatalogPresentation',
      'clearIndexRecoveryNotice']) value[name] = () => calls.push(name);
    return { value, frames, calls, projections, runtime, nativeResets };
  }

 for(const selected of cases){now=0;
    if(selected==="ready-close-admission"){
      const t = indexFixture(); let repeatedExit = 0;
      const readyBeforeExit = t.value.readingReadyCallback(origin.sourceId, origin.bookId, t.value.readingReadyGeneration);
      t.value.readingExitRequest = () => repeatedExit++;
      t.value.returnToReadingOrigin();
      const id = t.value.shelfNavigationMotion.id;
      assert.equal(t.value.pendingShelfCoverExitId, id); assert.equal(t.value.readingSessionActive, true);
      assert.equal(t.value.route, 'reading'); assert.equal(t.value.navigationGeneration, 20);
      const lateProjection = () => t.projections.push('late-remote');
      t.value.pendingRemoteDirectoryProjection = lateProjection;
      readyBeforeExit(0);
      assert.equal(t.calls.includes('set-protection'), false, 'queued same-reader ready cannot reacquire protection during the closing cover');
      assert.equal(t.calls.includes('schedule-backfill'), false, 'queued same-reader ready cannot schedule directory work after approved exit');
      assert.equal(t.value.readingPresentedScopeId, -1);
      assert.equal(t.value.pendingRemoteDirectoryProjection, lateProjection, 'retained cover subtree cannot consume a new ready projection');
      t.value.presentPreparedReading(0);
      assert.equal(t.value.readingPresentedScopeId, -1, 'direct ready admission is also closed during the cover handoff');
      assert.equal(t.value.pendingRemoteDirectoryProjection, lateProjection);
      assert.deepEqual(t.projections, []);
      t.value.returnToReadingOrigin(); assert.equal(t.value.shelfNavigationMotion.id, id);
      assert.equal(t.value.onBackPress(), true); assert.equal(repeatedExit, 0);
      t.value.onShelfCoverClosed(id - 1); assert.equal(t.value.readingSessionActive, true);
      t.value.onShelfCoverClosed(id);
      assert.equal(t.value.readingSessionActive, false); assert.equal(t.value.route, 'bookshelf');
      assert.equal(t.value.pendingShelfCoverExitId, -1); assert.equal(t.value.navigationGeneration, 21);
      assert.equal(t.value.shelfNavigationMotion.awaitingOrigin, true);
      t.value.onShelfCoverClosed(id); assert.equal(t.value.navigationGeneration, 21);
      t.value.receiveShelfReturnMotionOrigin({ ...origin, bookId: 'other' });
      assert.equal(t.value.shelfNavigationMotion.awaitingOrigin, true);
      const fresh = { ...origin, rect: { ...origin.rect, y: 370 } };
      t.value.receiveShelfReturnMotionOrigin(fresh);
      assert.equal(t.value.shelfNavigationMotion.awaitingOrigin, false);
      assert.equal(t.value.shelfNavigationMotion.origin.rect.y, 370);
      for (const callback of t.frames.splice(0)) callback();
      assert.equal(t.value.shelfNavigationMotion.fadeOnly, false, 'stale fallback cannot replace the fresh current target');
      t.value.finishShelfNavigationMotion(id); assert.equal(t.value.shelfNavigationMotion, undefined);
      t.value.finishShelfNavigationMotion(id); assert.equal(t.value.navigationGeneration, 21);
      const normal = indexFixture();
      delete normal.value.pendingShelfCoverExitId;
      normal.value.pendingRemoteDirectoryProjection = () => normal.projections.push('normal-ready');
      normal.value.readingReadyCallback(origin.sourceId, origin.bookId, normal.value.readingReadyGeneration)(0);
      assert.equal(normal.calls.filter(call => call === 'set-protection').length, 1);
      assert.equal(normal.calls.filter(call => call === 'schedule-backfill').length, 1);
      assert.deepEqual(normal.projections, ['normal-ready'], 'legacy fixture without pending state admits a real ready page normally');

    }
    else if(selected==="close-cancellation"){
      const reduce=indexFixture();reduce.value.settingsSnapshot.reduceMotion=true;reduce.value.returnToReadingOrigin();
      assert.equal(reduce.value.readingSessionActive,true,'Index waits for current actor covered fact, including reduced fade');
      const frames=[],Actor=bookshelfOpeningActor({hilog:{info(){}},readerMotionNowMs:()=>now});
      const actor=Object.assign(new Actor(),{request:reduce.value.shelfNavigationMotion,reduceMotion:true,getUIContext:()=>({postFrameCallback:frame=>frames.push(frame)}),
        onCovered:id=>reduce.value.onShelfCoverClosed(id),onFinished:(id,reversed)=>reduce.value.finishShelfNavigationMotion(id,reversed),onReaderOpacity(){}});
      actor.aboutToAppear();now=180;frames.shift().onFrame(now);assert.equal(reduce.value.route,'bookshelf');assert.equal(reduce.value.readingSessionActive,false);
      now=360;frames.shift().onFrame(now);assert.equal(reduce.value.shelfNavigationMotion,undefined);assert.equal(reduce.value.navigationGeneration,21);
      const clear = indexFixture(); clear.value.returnToReadingOrigin(); const oldId = clear.value.shelfNavigationMotion.id;
      clear.value.clearShelfNavigationMotion(true);
      assert.equal(clear.value.route, 'bookshelf'); assert.equal(clear.value.readingSessionActive, false);
      assert.equal(clear.value.navigationGeneration, 21);
      clear.value.onShelfCoverClosed(oldId); clear.value.finishShelfNavigationMotion(oldId);
      assert.equal(clear.value.navigationGeneration, 21);
      const navigation = indexFixture(); navigation.value.returnToReadingOrigin(); navigation.value.nextNavigationGeneration();
      assert.equal(navigation.value.navigationGeneration, 21, 'superseding navigation retires once');
      assert.equal(navigation.calls.filter(x => x === 'native-retire').length, 1);
      assert.equal(navigation.value.pendingShelfCoverExitId, -1);
      const resize = indexFixture(); resize.value.returnToReadingOrigin(); resize.value.liveViewport.width += 20;
      resize.value.onShelfMotionWindowChanged(); resize.frames.shift()();
      assert.equal(resize.value.route, 'bookshelf'); assert.equal(resize.value.shelfNavigationMotion, undefined);
      const detail = indexFixture(); detail.value.readingOriginRoute = 'detail'; detail.value.returnToReadingOrigin();
      const detailId = detail.value.shelfNavigationMotion.id;
      detail.value.onSearchVisibilityChanged(); assert.equal(detail.value.pendingShelfCoverExitId, detailId);
      detail.value.onShelfCoverClosed(detailId); assert.equal(detail.value.route, 'detail');
      assert.equal(detail.value.shelfNavigationMotion.fadeOnly, true);
      detail.value.onSearchVisibilityChanged(); assert.equal(detail.value.shelfNavigationMotion.id, detailId);
      detail.value.finishShelfNavigationMotion(detailId); assert.equal(detail.value.shelfNavigationMotion, undefined);
      const background = indexFixture(); background.value.returnToReadingOrigin(); background.value.searchAppForeground = false;
      background.value.onSearchVisibilityChanged(); assert.equal(background.value.readingSessionActive, false);
      assert.equal(background.value.pendingShelfCoverExitId, -1); assert.equal(background.value.shelfNavigationMotion, undefined);

    }
    else if(selected==="projection-identity"){
      const t = indexFixture(); t.value.shelfNavigationMotion = request(30);
      t.value.pendingRemoteDirectoryProjection = () => t.projections.push('remote');
      t.value.presentPreparedReading(0); t.value.presentPreparedReading(0);
      assert.equal(t.value.route, 'reading'); assert.equal(t.value.readingSessionActive, true);
      assert.deepEqual(t.projections, []);
      t.value.pendingLocalDirectoryProjection = () => t.projections.push('local'); t.value.presentPreparedReading(0);
      t.value.finishShelfNavigationMotion(30); assert.deepEqual(t.projections, ['remote', 'local']);
      t.value.finishShelfNavigationMotion(30); assert.deepEqual(t.projections, ['remote', 'local']);
      const fallback = indexFixture(); fallback.value.shelfNavigationMotion = request(31);
      fallback.value.detailToc = [{ index: 0 }]; fallback.value.presentPreparedReading(0);
      fallback.value.finishShelfNavigationMotion(31); assert.deepEqual(fallback.projections, ['fallback']);
      for (const cancel of ['visual', 'navigation']) {
        const next = indexFixture(); next.value.shelfNavigationMotion = request(32);
        next.value.pendingRemoteDirectoryProjection = () => next.projections.push('remote'); next.value.presentPreparedReading(0);
        if (cancel === 'visual') next.value.clearShelfNavigationMotion(true);
        else next.value.nextNavigationGeneration();
        assert.deepEqual(next.projections, cancel === 'visual' ? ['remote'] : []);
      }
      for (const stale of ['book', 'owner', 'reader']) {
        const next = indexFixture(); next.value.shelfNavigationMotion = request(33);
        next.value.pendingRemoteDirectoryProjection = () => next.projections.push('remote'); next.value.presentPreparedReading(0);
        if (stale === 'book') next.value.detailBook = { ...next.value.detailBook, bookId: 'replacement' };
        else if (stale === 'owner') next.value.mountedRuntimeOwner = {};
        else next.value.readingSessionActive = false;
        next.value.finishShelfNavigationMotion(33); assert.deepEqual(next.projections, []);
      }

    }
    else if(selected==="retained-shell-receipts"){
      const t = indexFixture();
      t.value.route = 'bookshelf'; t.value.readingSessionActive = false;
      t.value.openShelfBookWithMotion(origin, origin);
      const input = t.value.shelfNavigationMotion;
      assert.equal(t.value.shelfOpeningReaderOpacity,0,'source opacity initialized synchronously with request');
      assert.equal(t.value.retainsShelfOpeningBackground(),true);t.value.receiveShelfOpeningReaderOpacity(input.id,1);assert.equal(t.value.shelfOpeningReaderOpacity,1);
      t.value.finishShelfNavigationMotion(input.id);
      assert.equal(t.value.readingSessionActive, true); assert.equal(t.value.route, 'reading');
      assert.equal(t.value.retainsShelfOpeningBackground(), false);
      for (const cancel of ['clear', 'window', 'navigation', 'finish']) {
        const f = indexFixture(); f.value.route = 'bookshelf'; f.value.readingSessionActive = false;
        f.value.openShelfBookWithMotion(origin, origin); const id = f.value.shelfNavigationMotion.id;
        if (cancel === 'window') { f.value.liveViewport.width += 20; f.value.onShelfMotionWindowChanged(); f.frames.shift()(); }
        else if (cancel === 'navigation') f.value.nextNavigationGeneration();
        else if (cancel === 'finish') f.value.finishShelfNavigationMotion(id);
        else f.value.clearShelfNavigationMotion(true);
        assert.equal(f.value.shelfOpeningReaderOpacity,1,cancel+' resets current opacity');
        f.value.receiveShelfOpeningReaderOpacity(id,.2);assert.equal(f.value.shelfOpeningReaderOpacity,1,'late old-id opacity inert');
      }

      const indexSource = readFileSync(new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url), 'utf8');
      const ast = ts.createSourceFile('OpeningSurfaceIndex.ets', indexSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
      const declaration = ast.statements.find(node => node.name?.text === 'Index');
      const member = name => declaration.members.find(node => node.name?.getText(ast) === name);
      const ifs = [];
      function visit(node) { if (ts.isIfStatement(node)) ifs.push(node); ts.forEachChild(node, visit); }
      visit(member('indexContent'));
      const has=(node,predicate)=>{let found=false;function walk(n){if(predicate(n))found=true;ts.forEachChild(n,walk);}walk(node);return found;};
      const shelf=ifs.find(node=>has(node.expression,n=>ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='retainsShelfOpeningBackground')&&has(node.thenStatement,n=>ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='bookshelfShellContent'));
      const reader=ifs.find(node=>has(node.thenStatement,n=>(ts.isCallExpression(n)||ts.isEtsComponentExpression(n))&&ts.isIdentifier(n.expression)&&n.expression.text==='ReaderShell'));
      assert.ok(shelf && reader);
      // Exact production branches retain their original sibling positions.
      // Unrelated routes/overlays are outside this SDK composition fixture.
      const boundedSource = `@Component struct OpeningSurfaceProbe {
        @Builder private indexContent() { Stack() {
          if (${shelf.expression.getText(ast)}) ${shelf.thenStatement.getText(ast)}
          ${reader.getText(ast)}
        } }
        ${member('bookshelfShellContent').getText(ast)}
        ${member('retainsShelfOpeningBackground').getText(ast)}
        @Builder private bookshelfContent() {}
        build() { this.indexContent(); }
      }`;
      class ShelfSlot {
        constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
        updateStateVars(params) { this.params.navigationGeneration = params.navigationGeneration; }
      }
      class ReaderSlot { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
      const properties = createArkUIPropertyRuntimeProbe();
      const childSources = Object.fromEntries([['BookshelfShell', 'bookshelf/BookshelfShell.ets'], ['ReaderShell', 'shell/ReaderShell.ets']]
        .map(([name, file]) => [name, readFileSync(new URL(`../entry/src/main/ets/features/${file}`, import.meta.url), 'utf8')]));
      const f = indexFixture();
      const { owner } = sdkBuilder(boundedSource, ['indexContent', 'bookshelfShellContent', 'bookshelfContent', 'retainsShelfOpeningBackground'],
        { ...properties.sdk, BookshelfShell: ShelfSlot, ReaderShell: ReaderSlot, deviceInfo: { deviceType: 'phone' } },
        { ...properties.hooks, childSources, allowEmptyBranchAdmission: true });
      Object.assign(owner, f.value, { route: 'bookshelf', readingSessionActive: false, readingContentKind: 'text',
        shelfOperation: {}, shelfBooks: [], shelfProjectionRevision: '', settingsSnapshot: { reduceMotion: false },
        shelfHeaderHeight: 80, shelfPendingNoticeHeight: 0,
        shelfRecovery: () => ({}), shelfReadRecovery: () => ({}), canContinueShelfRemoval: () => false,
        expandedLayout:()=>false,librarySearchIdentity:11,librarySearchMode:'idle',appContentTopInset: () => 48, directoryRecovery: () => ({}), currentSourceSwitchTransactionId: () => undefined,
        controlBookmarkProjectionMessage: () => '', canCancelMangaSourcePreparation: () => false,
        openBookshelfSettings: () => f.calls.push('settings'), openBookshelfMultiSelect: () => f.calls.push('batch'),
        startManualBookshelfUpdate: () => f.calls.push('updates'), openDownloads: () => f.calls.push('downloads') });
      for (const name of Object.getOwnPropertyNames(Index.prototype)) if (name !== 'constructor' && typeof owner[name] !== 'function') owner[name] = Index.prototype[name];
      owner.openShelfBook = selection => { owner.detailBook = selection; owner.route = 'reading'; owner.readingOriginRoute = 'bookshelf'; owner.readingSessionActive = true; };
      owner.indexContent();
      const shelfChild = [...owner.children.values()].find(child => child instanceof ShelfSlot);
      assert.ok(shelfChild);
      const handlers = shelfChild.params;
      handlers.onBookshelfSettingsRequested(20); handlers.onBatchManageRequested(20); handlers.onCheckUpdatesRequested(20);
      handlers.onDownloadsRequested(20);
      assert.deepEqual(f.calls.filter(call => ['settings', 'batch', 'updates'].includes(call)), ['settings', 'batch', 'updates']);
      assert.equal(f.calls.filter(call => call === 'downloads').length, 1);
      owner.openShelfBookWithMotion(origin, origin); owner.replay();
      assert.equal([...owner.children.values()].filter(child => child instanceof ShelfSlot).length, 1, 'opening keeps the original shelf child');
      const readerChild = [...owner.children.values()].find(child => child instanceof ReaderSlot);
      assert.ok(readerChild);
      const readerCarrier=[...owner.nodes.values()].find(node=>node.clip===true&&node.opacity===0);
      assert.ok(readerCarrier,'actual SDK reader carrier observes the opening opacity');assert.equal(readerCarrier.enabled,false,'opening reader cannot receive input');
      const retainedReaderId = readerChild.id;
      handlers.onBookshelfSettingsRequested(20); handlers.onBatchManageRequested(20); handlers.onCheckUpdatesRequested(20);
      handlers.onDownloadsRequested(20);
      handlers.onNoticeHeightChange(900, 20);
      assert.deepEqual(f.calls.filter(call => ['settings', 'batch', 'updates'].includes(call)), ['settings', 'batch', 'updates']);
      assert.notEqual(owner.shelfHeaderHeight, 900); assert.notEqual(owner.shelfPendingNoticeHeight, 900);
      assert.equal(f.calls.filter(call => call === 'downloads').length, 1);
      assert.ok([...owner.nodes.values()].some(node => node.hitTestBehavior === 'HitTestMode.None' && node.accessibilityLevel === 'no-hide-descendants'));
      const before=owner.shelfOpeningReaderOpacity;owner.receiveShelfOpeningReaderOpacity(owner.shelfNavigationMotion.id,1);owner.replay();
      assert.equal(before,0);assert.equal(owner.shelfOpeningReaderOpacity,1);assert.equal(readerChild.id,retainedReaderId);
      assert.equal(readerCarrier.opacity,1,'same actual SDK native carrier observes current opacity endpoint');
      assert.equal([...owner.children.values()].filter(child => child instanceof ReaderSlot).length, 1, 'opacity endpoint updates the same actual ReaderShell slot');
      owner.clearShelfNavigationMotion(true); owner.route = 'bookshelf'; owner.readingSessionActive = false; owner.navigationGeneration += 1;
      // The common probe explicitly does not simulate branch destruction.
      // Replay only this existing child's update closure: regular handlers
      // stay setInitially, while its real @Prop generation is refreshed.
      owner.replayOnly([shelfChild.id]);
      const generation = owner.navigationGeneration;
      handlers.onBookshelfSettingsRequested(20); assert.equal(f.calls.filter(call => call === 'settings').length, 1);
      handlers.onBookshelfSettingsRequested(generation); handlers.onBatchManageRequested(generation); handlers.onCheckUpdatesRequested(generation);
      handlers.onDownloadsRequested(20); assert.equal(f.calls.filter(call => call === 'downloads').length, 1);
      handlers.onDownloadsRequested(generation); assert.equal(f.calls.filter(call => call === 'downloads').length, 2);
      handlers.onNoticeHeightChange(10, generation);
      assert.equal(owner.shelfPendingNoticeHeight, 10);
      assert.equal(f.calls.filter(call => call === 'settings').length, 2, 'a retained regular callback accepts the current child Prop generation after return');
      const shellSource = childSources.BookshelfShell;
      const Shell=selectedProductionMethods(file('features/bookshelf/BookshelfShell.ets'),'BookshelfShell',['moreIntentAction','requestCheckUpdates','noticeHeightHandler','numericAreaLength']);
      const shellOwner = Object.assign(new Shell(), { mounted: true, navigationGeneration: 20, moreMenuVisible: true,
        moreSelectionId: 'old-menu', canCheckUpdates: true, updateRunning: false, backgroundUpdateRunning: false,
        onCheckUpdatesRequested: handlers.onCheckUpdatesRequested });
      const oldMenu = shellOwner.moreIntentAction('old-menu', current => shellOwner.requestCheckUpdates(current));
      shellOwner.navigationGeneration = shelfChild.params.navigationGeneration; shellOwner.moreSelectionId = 'new-menu';
      const updateCount = f.calls.filter(call => call === 'updates').length;
      oldMenu(); assert.equal(f.calls.filter(call => call === 'updates').length, updateCount);
      shellOwner.moreIntentAction('new-menu', current => shellOwner.requestCheckUpdates(current))();
      assert.equal(f.calls.filter(call => call === 'updates').length, updateCount + 1, 'real Shell intent carries its current Prop generation to the retained parent handler');

      // BookshelfShell no longer forwards header measurement. Execute the
      // current LibrarySearch owner callback with its actual captured ports.
      const headers=[];function headerVisit(node){if(ts.isPropertyAssignment(node)&&node.name?.getText(ast)==='onHeaderBottom')headers.push(node.initializer);ts.forEachChild(node,headerVisit);}
      headerVisit(member('librarySearchSurface'));assert.equal(headers.length,1);
      const capturedOwner=owner.mountedRuntimeOwner,capturedHost=owner.searchHost;
      const {bindHeader}=pureModuleProbe('function bindHeader(){return '+headers[0].getText(ast)+';}','CurrentLibraryHeaderReceipt.ets',{owner:capturedOwner,host:capturedHost},['bindHeader']);
      const header=bindHeader.call(owner),beforeHeader=owner.shelfHeaderHeight;
      for(const [bottom,identity,nav,mount]of [[900,10,generation,4],[900,11,20,4],[900,11,generation,3],[NaN,11,generation,4],[0,11,generation,4]]){header(bottom,identity,123,nav,mount);assert.equal(owner.shelfHeaderHeight,beforeHeader);}
      header(88,11,123,generation,4);assert.equal(owner.shelfHeaderHeight,88,'current LibrarySearch header receipt reaches current bookshelf owner');
      owner.librarySearchMode='input';header(90,11,123,generation,4);assert.equal(owner.shelfHeaderHeight,88,'search input cannot write idle bookshelf header');
      owner.librarySearchMode='idle';owner.mountedRuntimeOwner={};header(90,11,123,generation,4);assert.equal(owner.shelfHeaderHeight,88,'old captured runtime cannot write replacement host');owner.mountedRuntimeOwner=capturedOwner;
      const noticeUpdates = [];
      Object.assign(shellOwner, { noticeHeight: 0, navigationGeneration: 20, recovery: { visible: true, generation: 1 },
        onNoticeHeightChange: (height, navigation) => { noticeUpdates.push([height, navigation]); handlers.onNoticeHeightChange(height, navigation); } });
      const staleNavigationNotice = shellOwner.noticeHeightHandler();
      shellOwner.navigationGeneration = generation;
      staleNavigationNotice({}, { height: 900 }); assert.deepEqual(noticeUpdates, []);
      const staleRecoveryNotice = shellOwner.noticeHeightHandler();
      shellOwner.recovery = { visible: true, generation: 2 };
      staleRecoveryNotice({}, { height: 900 }); assert.deepEqual(noticeUpdates, []);
      shellOwner.noticeHeightHandler()({}, { height: '16vp' });
      assert.deepEqual(noticeUpdates, [[16, generation]]); assert.equal(owner.shelfPendingNoticeHeight, 16);
      const hiddenNotice = shellOwner.noticeHeightHandler(); shellOwner.recovery.visible = false;
      hiddenNotice({}, { height: 900 }); assert.deepEqual(noticeUpdates, [[16, generation]]);

    }
    else if(selected==="shelf-chrome-lease"){
      const pageSource = readFileSync(new URL('../entry/src/main/ets/features/bookshelf/BookshelfPage.ets', import.meta.url), 'utf8');
      let chrome=0,overlay=0;
      const chromeDeps={ReaderWindowCoordinator:{requestAppChrome:()=>chrome++,requestOverlayChrome:()=>overlay++},readerAppColor,readerScrimmedOpaqueColor:color=>color,ReaderWindowChromeStyle:class{}};
      const Shelf=selectedProductionMethods(file('features/bookshelf/BookshelfPage.ets'),'BookshelfPage',['aboutToDisappear','finishBookActionSheet','claimBookActionChrome'],chromeDeps);
      for (const current of [false, true]) {
        const value = Object.assign(new Shelf(), { mounted: true, actionBook: origin, actionSheetId: 'sheet', actionSheetChromeId: 'sheet',
          navigationGeneration: 20, actionSheetNavigation: 20, transientFeedback: { reset() {} }, viewState: {},
          isCurrentChromeHost: generation => current && generation === 20, saveShelfViewport() {}, resetViewSwitchMotion() {},publishContinueCardRect(){},
          isCurrentBookActionSheet: () => true, bookActionSheetSpec: () => ({ hostMaskRole: 'mask', hostBackgroundRole: 'paper' }), appThemeScheme: 'day' });
        const overlaysBefore = overlay; value.claimBookActionChrome('sheet', origin);
        assert.equal(overlay - overlaysBefore, current ? 1 : 0, 'queued onWillAppear cannot claim overlay chrome after its actual host departs');
        const before = chrome; value.finishBookActionSheet('sheet', origin);
        assert.equal(chrome - before, current ? 1 : 0);
        value.actionSheetChromeId = 'late-sheet'; value.aboutToDisappear();
        assert.equal(chrome - before, current ? 2 : 0, 'departing reader background cannot overwrite desired reader chrome');
      }

    }
 recordContractCasePass(selected);
 }
}
