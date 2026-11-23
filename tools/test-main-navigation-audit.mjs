import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { installedEtsCompiler } from './lib/ets-compiler-runtime.mjs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const definitions = {
  'viewport-rail': { description: 'Production host receipts and rail fit at 599/600, split hosts, short heights and scaled labels; invalid measurements cannot replace a valid receipt.' },
  'settings-migration': { description: 'Production Preferences gateway preserves old bottom default and explicit choices, isolates snapshots, and retains accepted rail choice after lost flush ACK.' },
  'grid-height': { description: 'Production shared grid is bounded at 320/600/760/960 and contains actual text line boxes plus optional progress at font scales 1/1.5/2.' },
  'discover-selection': { description: 'Shipping L0 rejects closed discovery before host/navigation work; current discover surface has no book selection API; actual retained library journey returns to its captured parent.' },
  'sdk-navigation': { description: 'Actual SDK lowered bottom and rail builders keep focus/selected actions and scale the rail box with its text.' },
  'sdk-followup-actions': { description: 'Actual shelf mode and bounded close builders retain role/focus/selected/disabled facts and guarded callbacks.' },
  'shell-owner': { description: 'Shared navigation builders place one orientation, forward overlay inset, and reject retired navigation callbacks.' },
  'settings-geometry': { description: 'Settings page publishes one resolved layout and rejects measurements from the previous viewport or rail.' },
  'font-receipt': { description: 'A font-only metrics receipt re-evaluates the real shell mode and every rail consumer subscribes to it.' },
  'detail-frame': { description: 'Actual standard detail dock is inset from its content owner at narrow, wide and asymmetric safe edges.' },
  'action-semantics': { description: 'Production shared modifier preserves disabled and selected facts without hiding child controls in non-action settings rows.' },
};
const selected = selectContractCases(definitions);
if (selected.length > 0) {
  const { ts, options } = installedEtsCompiler();
  const base = path.resolve(import.meta.dirname, '../entry/src/main/ets');
  function loader(overrides = {}, globals = {}) {
    const cache = new Map();
    function load(relative) {
      let file = path.resolve(base, relative);
      if (!existsSync(file)) file += existsSync(file + '.ts') ? '.ts' : '.ets';
      const key = path.relative(base, file).replaceAll('\\', '/');
      if (Object.hasOwn(overrides, key)) return overrides[key];
      if (cache.has(file)) return cache.get(file);
      const source = readFileSync(file, 'utf8');
      const result = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS }, reportDiagnostics: true });
      assert.deepEqual(result.diagnostics, [], key);
      const module = { exports: {} }; cache.set(file, module.exports);
      new Function('require', 'module', 'exports', ...Object.keys(globals), result.outputText)(id => {
        if (Object.hasOwn(overrides, id)) return overrides[id];
        assert.ok(id.startsWith('.'), `No unlisted platform dependency: ${id}`);
        return load(path.relative(base, path.resolve(path.dirname(file), id)));
      }, module, module.exports, ...Object.values(globals));
      return module.exports;
    }
    return load;
  }
  for (const id of selected) {
    if (id === 'viewport-rail') {
      const data = new Map(), AppStorage = { get: key => data.get(key), setOrCreate: (key, value) => data.set(key, value) };
      const basic = loader(), metricsModule = basic('ui/foundation/ReaderWindowMetrics.ts');
      const metrics = metricsModule.createDefaultReaderWindowMetrics();
      metrics.windowRect.width = 960; metrics.windowRect.height = 1000; metrics.ready = true;
      const load = loader({ 'app/ReaderWindowCoordinator.ts': { ReaderWindowCoordinator: { metrics: () => metrics } },
        'app/ReaderProductScope.ts': { isReaderMainTabEnabled: key => ['bookshelf', 'settings'].includes(key) } }, { AppStorage });
      const nav = load('features/shell/MainNavigationSpec.ts');
      for (const [width, height, rail] of [[320,800,false],[599,800,false],[600,800,true],[760,800,true],[960,800,true],[760,100,false]]) {
        nav.publishReaderMainViewport(width, height);
        assert.equal(nav.readerMainNavigationMode(true), rail ? 'rail' : 'bottom', `${width}×${height}, window remains 960 wide`);
        assert.equal(nav.readerMainNavigationMode(false), 'bottom');
        assert.equal(nav.readerMainViewport().width, width);
      }
      const before = data.get('readerMainViewportRevision');
      nav.publishReaderMainViewport(760,100); nav.publishReaderMainViewport(NaN,800); nav.publishReaderMainViewport(0,800);
      assert.equal(data.get('readerMainViewportRevision'), before);
      assert.deepEqual(nav.readerMainViewport(), { width:760, height:100 });
      for (const count of [2,4]) for (const scale of [1,1.5,2]) {
        const h=nav.mainTabRailHeight(count,scale);
        assert.ok(h >= count*(30+2+18*scale)+(count-1)*6+16, 'rail contains icon, scaled line, gaps and padding');
        assert.equal(nav.mainNavigationMode(true,760,h+23,0,0,count,scale),'bottom');
        assert.equal(nav.mainNavigationMode(true,760,h+24,0,0,count,scale),'rail');
        assert.equal(nav.mainTabRailTop(h+24,0,0,count,scale),12);
      }
      const floating=load('ui/layout/ReaderFloatingBarMetrics.ts');
      for(const scale of [1,1.5,2])for(const safe of [0,34]) {
        metrics.systemFontScale=scale;metrics.navigationInsets.bottom=safe;
        assert.equal(floating.readerFloatingTabContentInset(metrics),68+18*(scale-1)+Math.max(15,safe)+16);
        assert.ok(floating.readerFloatingTabBarHeight(scale)>=floating.readerMainTabItemHeight(scale)+8);
      }
      metrics.systemFontScale=1;metrics.navigationInsets.bottom=0;
      const geometry = load('ui/layout/ReaderPageGeometry.ts');
      nav.publishReaderMainViewport(600,800);
      const input = new geometry.ReaderPageGeometryInput(metrics);
      input.viewportWidth = nav.readerMainViewport().width; input.contentMaxWidth=620;
      input.contentLeftGap=nav.readerMainRailContentLeft(); input.contentRightGap=nav.readerMainRailContentRight();
      const frame=geometry.resolveReaderPageGeometry(input).content.frame;
      assert.ok(frame.left>=nav.readerMainRailLeading()+20);
      assert.ok(frame.left+frame.width+frame.right<=600.01);
      // Leading-rail consumers use a full-width host: origin and width must
      // both include precisely one rail. This catches a lost or doubled inset.
      for (const width of [600,760,960]) {
        input.viewportWidth=width;input.contentLeadingRail=99;
        input.contentLeftGap=19;input.contentRightGap=19;
        const full=geometry.resolveReaderPageGeometry(input).content.frame;
        assert.ok(full.left>=118);
        assert.ok(Math.abs(full.left+full.width+full.right-width)<1e-8);
        input.contentLeadingRail=0;
        const noRail=geometry.resolveReaderPageGeometry(input).content.frame;
        assert.ok(noRail.left<full.left);
      }
    }
    if (id === 'settings-migration') {
      function fixture(initial={}) {
        const cache=new Map(Object.entries(initial)),disk=new Map(cache);let loseAck=false;
        const store={get:async(k,d)=>cache.has(k)?cache.get(k):d,put:async(k,v)=>cache.set(k,v),flush:async()=>{
          disk.clear();for(const [k,v]of cache)disk.set(k,v);if(loseAck){loseAck=false;throw Error('lost ACK');}}};
        const load=loader({'@ohos.data.preferences':{default:{getPreferences:async()=>store}},
          'app/ReaderThemeHost.ts':{ReaderThemeHost:{prepareUserChange:async()=>{}}}});
        const mod=load('features/settings/application/SettingsGateway.ts');return {mod,gateway:new mod.SettingsGateway({}),cache,disk,lose:()=>{loseAck=true;}};
      }
      const legacy={autoCheckUpdate:false,tapBottomScrollTop:false,reduceMotion:true,crashLog:false,developerMode:true};
      const old=fixture(legacy),snapshot=await old.gateway.load();
      assert.deepEqual(snapshot,{...legacy,wideNavigationRail:false});assert.deepEqual(Object.fromEntries(old.disk),legacy,'read does not migrate by writing');
      const a=old.mod.createDefaultSettingsSnapshot();a.wideNavigationRail=true;assert.equal(old.mod.createDefaultSettingsSnapshot().wideNavigationRail,false);
      for(const explicit of [true,false]) assert.equal((await fixture({...legacy,wideNavigationRail:explicit}).gateway.load()).wideNavigationRail,explicit);
      old.lose();await assert.rejects(old.gateway.update({...snapshot,wideNavigationRail:true},false,'wideNavigationRail'),/lost ACK/);
      assert.equal(old.gateway.current().wideNavigationRail,true);assert.equal(old.gateway.writeFacts().pendingReconciliation,true);
      assert.deepEqual(await old.gateway.load(),{...legacy,wideNavigationRail:true});
      await old.gateway.retryAccepted();assert.equal(old.gateway.writeFacts().pendingReconciliation,false);
      await old.gateway.update({...snapshot,crashLog:true},false,'crashLog');
      assert.equal(old.gateway.current().wideNavigationRail,true,'an unrelated setting cannot overwrite the accepted navigation preference');
    }
    if (id === 'grid-height') {
      const load=loader(),grid=load('features/bookshelf/ui/BookshelfGridSpec.ets'),type=load('ui/foundation/ReaderTypography.ets');
      for(const width of [282,562,620,720])for(const expanded of [false,true])for(const scale of [1,1.5,2]) {
        const plain=grid.bookshelfGridFrame(width,expanded,scale,false),progress=grid.bookshelfGridFrame(width,expanded,scale,true);
        assert.ok(plain.rowWidth<=width+.001);assert.ok(plain.cardWidth>0);
        const required=(type.TYPE_SHELF_LIST_TITLE.lineHeightFp+type.TYPE_SHELF_LIST_AUTHOR.lineHeightFp)*scale+12;
        assert.ok(Math.abs(plain.cardHeight-plain.coverHeight-required)<1e-8);
        assert.ok(Math.abs(progress.cardHeight-plain.cardHeight-(6+type.TYPE_SHELF_LIST_STATUS.lineHeightFp*scale))<1e-8);
      }
    }
    if(id==='grid-height') {
      const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
      const load=loader(),type=load('ui/foundation/ReaderTypography.ets'),grid=load('features/bookshelf/ui/BookshelfGridSpec.ets');
      const metrics={systemFontScale:1};
      const {owner}=createReaderBuilderProbe(readFileSync(path.join(base,'features/bookshelf/ui/BookshelfPage.ets'),'utf8'),['projectionGridDetails'],
        {...type,...grid,ReaderWindowCoordinator:{metrics:()=>metrics}});
      Object.assign(owner,{appThemeScheme:'day',shelfBookCardWidth:()=>100,bookCardHeight:()=>150,gridProgressLabel:()=> '第 3 章',viewMode:'cover',viewSwitchGridContentOpacity:1});
      owner.projectionGridDetails({title:'标题',author:'作者'},false);
      for(const scale of [1,1.5,2]) {
        metrics.systemFontScale=scale;owner.replay();
        const lines=[...owner.nodes.values()].filter(n=>n.type==='Text').map(n=>n.lineHeight);
        assert.deepEqual(lines,[type.TYPE_SHELF_LIST_TITLE,type.TYPE_SHELF_LIST_AUTHOR,type.TYPE_SHELF_LIST_STATUS].map(t=>`${t.lineHeightFp}fp`));
      }
    }
    if (id === 'discover-selection') {
      const source=readFileSync(path.join(base,'pages/Index.ets'),'utf8');
      const tree=ts.createSourceFile('Index.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
      assert.equal(tree.parseDiagnostics.length,0,tree.parseDiagnostics.map(d=>`${d.start}: ${d.messageText}`).join('\n'));
      const component=tree.statements.find(n=>n.name?.text==='Index');
      // Discover is closed in the shipping product. The former book-selection
      // callback has no current producer or consumer; recreating it in Index
      // would invent a feature. Check actual admission and preserve the real
      // library return compatibility assertions below instead.
      const loadScope=loader();
      const scope=loadScope('app/ReaderProductScope.ts');
      assert.equal(scope.READER_PRODUCT_PROFILE,'l0');
      assert.equal(scope.isReaderProductSurfaceEnabled('discover'),false);
      assert.equal(scope.isReaderMainTabEnabled('discover'),false);
      const {selectedProductionMethods}=await import('./lib/selected-production-methods.mjs');
      const Entry=selectedProductionMethods(path.join(base,'pages/Index.ets'),'Index',['openDiscover'],
        {isReaderProductSurfaceEnabled:scope.isReaderProductSurfaceEnabled});
      const forbidden=[];
      const closed=new Entry();
      Object.assign(closed,{nextNavigationGeneration:()=>forbidden.push('advance'),
        readingEntry:{endReading:()=>forbidden.push('endReading')},
        navigateTo:()=>forbidden.push('navigate'),
        discoverPresentation:{open:()=>forbidden.push('open')},
        mountedRuntimeOwner:{},discoverIdentity:()=>{forbidden.push('identity');return '';}});
      closed.openDiscover();
      assert.deepEqual(forbidden,[],'closed L0 entry does not retire reading, navigate, or open a host');
      const content=component.members.find(n=>n.name?.getText(tree)==='discoverPageContent');
      assert.ok(content,'actual current discover builder remains available for compatibility');
      const surfaceSource=readFileSync(path.join(base,'features/discover/ui/DiscoverSurface.ets'),'utf8');
      const surfaceTree=ts.createSourceFile('DiscoverSurface.ets',surfaceSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
      assert.deepEqual(surfaceTree.parseDiagnostics,[]);
      const surface=surfaceTree.statements.find(n=>n.name?.text==='DiscoverSurface');
      assert.ok(surface);
      assert.equal(surface.members.some(n=>n.name?.getText(surfaceTree)==='onSelectBook'),false,
        'no closed-route book-action API is fabricated');
      const props=[];
      const walk=n=>{if(ts.isPropertyAssignment(n))props.push(n.name.getText(tree));ts.forEachChild(n,walk);};
      walk(content);
      assert.ok(props.includes('presentation')&&props.includes('identity'));
      assert.equal(props.includes('onSelectBook'),false,'actual Index builder has no retired selection callback');
      const libraryOwner=component.members.find(n=>n.name?.getText(tree)==='libraryJourney');
      assert.equal(libraryOwner.initializer.expression.getText(tree),'ReaderLibraryJourney');
      assert.deepEqual(libraryOwner.initializer.arguments.map(arg=>arg.getText(tree)),
        ['this.navigationOwner','this.libraryJourneyPorts()']);
      const load=loader(),routes=[],returnTrace=[];
      const {ReaderNavigation}=load('app/navigation/ReaderNavigation.ts');
      const {ReaderLibraryJourney}=load('app/composition/ReaderLibraryJourney.ets');
      const navigationOwner=new ReaderNavigation(),returns=navigationOwner.returns,runtime={};
      let currentOwner=runtime;
      const search={prepareReturnFromDetail(){returnTrace.push('prepareReturn');},
        resumeAfterDetail(){returnTrace.push('resume');routes.push('search');},
        close(){returnTrace.push('close');}};
      const parent=new ReaderLibraryJourney(navigationOwner,{
        runtime:()=>currentOwner,search:()=>search,
        readingActions:()=>({openReading(chapter){assert.equal(chapter,undefined);routes.push('reader');}}),
        reading:()=>({leaveDetail(owner){assert.equal(owner,currentOwner);returnTrace.push('leaveDetail');}}),
        advance(){returnTrace.push('advance');return navigationOwner.advance().generation;},
        publish(snapshot){returnTrace.push('publish:'+snapshot.route);if(snapshot.route==='bookshelf')routes.push('bookshelf');},
        refreshMembership(){returnTrace.push('membership');},
        clearRssSelection(){returnTrace.push('clearRss');},
        acquisition:()=>({endSearch(){returnTrace.push('endSearch');}}),
        refreshShelf(){returnTrace.push('refreshShelf');},
        readbackOnBookshelf(){returnTrace.push('readbackOnBookshelf');},
      });
      for(const origin of ['search','bookshelf']){
        returns.beginDetailEntry(undefined);
        returns.completeDetailEntry(origin,undefined,false);
        navigationOwner.show('detail');
        returnTrace.length=0;
        parent.returnFromDetail();
        assert.equal(navigationOwner.snapshot().route,origin);
        assert.deepEqual(returnTrace,origin==='search'?
          ['prepareReturn','advance','leaveDetail','publish:search','resume','membership']:
          ['close','advance','leaveDetail','clearRss','endSearch','publish:bookshelf','refreshShelf','readbackOnBookshelf']);
      }
      const retained=returns.captureReaderReturn(runtime,assert.fail);
      returns.requestBookInfoAfterExit({readerIdentity:'reader',request(){}},'book',retained);
      returns.dispatchAcceptedReaderExit('reader','book',runtime,{
        claimSystemFileExit:()=>false,deliverSystemFile:assert.fail,openDownloads:assert.fail,
        showReaderDetail(){navigationOwner.show('detail');},afterReaderDetail:assert.fail,openRules:assert.fail,
        returnFromDetail:assert.fail,returnToReadingOrigin:assert.fail,
      });
      parent.returnFromDetail();
      currentOwner=undefined;
      parent.returnFromDetail();
      assert.deepEqual(routes,['search','bookshelf','reader','bookshelf']);
    }
    if (id === 'sdk-navigation') {
      const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
      const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
      const properties = createArkUIPropertyRuntimeProbe();
      const raisedSource = readFileSync(path.join(base,'ui/surfaces/ReaderRaisedSurface.ets'),'utf8');
      // This parent probe observes the real SDK child inputs only. Canvas
      // painting/layout remains the separate native P0 evidence.
      class RaisedSurfaceInputs {
        constructor(owner, params, _storage, id) { Object.assign(this, {owner,params,id}); }
        updateStateVars(params) { Object.assign(this.params, params); }
      }
      const metrics = { systemFontScale: 1, densityPixels: 1 };
      const appStore = new Map();
      const deps = { 'app/ReaderWindowCoordinator.ts': { ReaderWindowCoordinator: { metrics: () => metrics } },
        'app/ReaderProductScope.ts': { isReaderMainTabEnabled: key => ['bookshelf','settings'].includes(key) } };
      const load = loader(deps, { AppStorage: {get:k=>appStore.get(k),setOrCreate:(k,v)=>appStore.set(k,v)},
        TextAlign: { Start: 'TextAlign.Start', Center: 'TextAlign.Center' } });
      const nav = load('features/shell/MainNavigationSpec.ts');
      const floating = load('ui/layout/ReaderFloatingBarMetrics.ts');
      const typography = load('ui/foundation/ReaderTypography.ets');
      const tokens = load('ui/foundation/ReaderTokens.ets');
      const surfaces = load('ui/surfaces/ReaderSurfaceSpecs.ets');
      const { owner } = createReaderBuilderProbe(readFileSync(path.join(base,'features/shell/MainTabBar.ets'),'utf8'),
        ['bottomBar','verticalRail','tabItem','navigationFontScale','recordRaisedSurface','vertical',
          'bottomSurfaceWidth','bottomSurfaceHeight','railSurfaceWidth','railSurfaceHeight'],
        {...properties.sdk,...nav,...floating,...typography,...tokens,...surfaces,ReaderRaisedSurface:RaisedSurfaceInputs,
          ReaderWindowCoordinator:deps['app/ReaderWindowCoordinator.ts'].ReaderWindowCoordinator},
        {...properties.hooks,childSources:{ReaderRaisedSurface:raisedSource}});
      const clicks=[];
      Object.assign(owner,{current:'bookshelf',appThemeScheme:'day',readerWindowMetricsRevision:0,
        bottomBarFrame:()=>({width:196}),bottomInset:()=>15,bottomBarTranslateX:()=>0,tabIcon:()=>{},
        onSelect:key=>clicks.push(key),onCurrentTap:key=>clicks.push('current:'+key)});
      owner.bottomBar();owner.verticalRail();
      for(const scale of [1,1.5,2]) {
        metrics.systemFontScale=scale;owner.replay();
        const nodes=[...owner.nodes.values()];
        const actions=nodes.filter(n=>n.type==='Column' && n.accessibilityText);
        assert.equal(actions.length,4);assert.ok(actions.every(n=>n.focusable===true && n.accessibilityRole==='AccessibilityRoleType.BUTTON'));
        const rail=nodes.find(n=>n.type==='Column' && n.width===82 && n.padding===8);
        assert.ok(rail);assert.equal(rail.height,nav.mainTabRailHeight(2,scale));
        const bottom=nodes.find(n=>n.type==='Row' && n.width===196);
        assert.equal(bottom.constraintSize.minHeight,68+18*(scale-1));
        assert.equal(bottom.borderRadius,tokens.TOK_RADIUS_PILL);assert.equal(rail.borderRadius,bottom.borderRadius);
        assert.equal(bottom.clip,false,'floating navigation leaves its shadow outside the painted frame');
        assert.equal(rail.clip,false,'rail keeps the same unclipped floating owner');
        assert.equal(bottom.shadow,undefined,'bottom material does not paint a second native shadow');
        assert.equal(rail.shadow,undefined,'rail material does not paint a second native shadow');
        const bottomWrapper=nodes.find(n=>n.type==='Stack'&&n.width===196&&n.margin?.bottom===15);
        const railWrapper=nodes.find(n=>n.type==='Stack'&&n.width===82);
        assert.ok(bottomWrapper&&railWrapper,'each material keeps an independent raised drawing host');
        assert.equal(bottomWrapper.clip,false);assert.equal(railWrapper.clip,false);
        assert.deepEqual(bottomWrapper.translate,{x:0},'the same offset moves material and shadow together');
        assert.equal(bottom.margin,undefined);assert.equal(bottom.translate,undefined,'insets and translation are owned once by the wrapper');
        assert.equal(bottomWrapper.height,undefined);assert.equal(railWrapper.height,undefined,'the original surfaces still supply natural wrapper height');
        owner.vertical=false;bottom.onAreaChange({}, {width:'196vp',height:`${68+18*(scale-1)}vp`});
        owner.vertical=true;rail.onAreaChange({}, {width:'82vp',height:`${nav.mainTabRailHeight(2,scale)}vp`});
        properties.flush();
        const raised=[...owner.children.values()].filter(child=>child instanceof RaisedSurfaceInputs);
        assert.equal(raised.length,2,'the SDK mounts one shared raised painter for each navigation surface');
        assert.deepEqual(raised.map(child=>({...child.params})),[
          {surfaceWidth:196,surfaceHeight:68+18*(scale-1),cornerRadius:tokens.TOK_RADIUS_PILL,scheme:'day'},
          {surfaceWidth:82,surfaceHeight:nav.mainTabRailHeight(2,scale),cornerRadius:tokens.TOK_RADIUS_PILL,scheme:'day'},
        ],'the retained child inputs use actual surface receipts and the shared radius/scheme');
        for(const action of actions) assert.equal(action.constraintSize.minHeight,
          (action.width===66?58:50)+18*(scale-1));
        assert.ok(nodes.filter(n=>n.type==='Text').every(n=>n.lineHeight==='18fp'));
        for(const action of actions) action.onClick();
      }
      assert.equal(clicks.filter(x=>x==='settings').length,6);assert.equal(clicks.filter(x=>x==='current:bookshelf').length,6);
    }
    if (id === 'sdk-followup-actions') {
      const { createReaderBuilderProbe }=await import('./lib/reader-control-builder-probe.mjs');
      const { switchControls }=await import('./lib/reader-switch-control-probe.mjs');
      const load=loader({}, {AccessibilityRoleType:{BUTTON:'AccessibilityRoleType.BUTTON'}});
      const access=load('ui/controls/ReaderActionAccessibility.ets');
      for(const enabled of [true,false]) {
        const controls=switchControls();
        const {owner}=createReaderBuilderProbe(readFileSync(path.join(base,'features/bookshelf/ui/BookshelfSettingsPage.ets'),'utf8'),
          ['pageContent','settingsPending','modePending','preferenceControlIdentity'],{...access,...controls.dependencies},controls.hooks);
        const calls=[];Object.assign(owner,{mode:'cover',appThemeScheme:'day',operation:{action:'load'},navigationGeneration:1,
          presentationRevision:1,mounted:true,viewModeSnapshot:{canonical:'cover'},viewModeHost:{canSave:()=>enabled},selectMode:v=>calls.push(v)});
        owner.pageContent();
        const nodes=controls.nodes(owner).filter(n=>n.type==='Button'&&n.accessibilityRole==='AccessibilityRoleType.RADIO');
        assert.deepEqual(nodes.map(n=>n.accessibilitySelected),[true,false]);
        assert.ok(nodes.every(n=>n.focusable===enabled && n.enabled===enabled && n.constraintSize.minHeight===44));
        if(enabled){nodes[1].onClick();assert.deepEqual(calls,['list']);}
        for(const specId of ['source-switch-window','tts-config-manager','tts-config']) {
          const {owner:header}=createReaderBuilderProbe(readFileSync(path.join(base,'ui/surfaces/ReaderBoundedSurfaceHeader.ets'),'utf8'),['closeAction','drawerClose'],access);
          let closed=0;Object.assign(header,{specId,appThemeScheme:'day',actionEnabled:enabled,placement:'side',
            drawerSpec:()=>({closeIcon:20,closeSize:44}),drawerScheme:()=> 'day',onClose:()=>closed++});
          header.closeAction();header.drawerClose();
          const actions=[...header.nodes.values()].filter(n=>n.accessibilityRole);
          assert.equal(actions.length,2);assert.ok(actions.every(n=>n.focusable===enabled && n.enabled===enabled && n.accessibilityText.startsWith('关闭')));
          for(const action of actions)action.onClick();assert.equal(closed,enabled?2:0);
        }
      }
    }
    if(id==='shell-owner') {
      const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
      const source=readFileSync(path.join(base,'features/shell/MainTabShell.ets'),'utf8');
      const childSources=Object.fromEntries(['MainTabBar','MainNavigationRail','MainNavigationOverlay']
        .map(n=>[n,readFileSync(path.join(base,'features/shell/'+n+'.ets'),'utf8')]));
      childSources.ReaderBottomNavigation=readFileSync(path.join(base,'app/navigation/ReaderBottomNavigation.ets'),'utf8');
      class Child {constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});} updateStateVars(params){Object.assign(this.params,params);}}
      for(const mode of ['bottom','rail']) {
        const {owner}=createReaderBuilderProbe(source,['bottomNavigation','mainOverlays','requestMainTab','requestCurrentTab'],
          {MainTabBar:Child,ReaderBottomNavigation:Child,MainNavigationOverlay:Child},{childSources});
        const calls=[],insets=[];Object.assign(owner,{mounted:true,navigationGeneration:7,activeTab:'settings',navigationMode:()=>mode,
          onMainTab:(k,g)=>calls.push([k,g]),onCurrentTabTap:(k,g)=>calls.push(['current:'+k,g]),
          overlayContent:()=>{},scrollOverlayContent:v=>insets.push(v)});
        owner.bottomNavigation();owner.mainOverlays(83);
        const children = [...owner.children.values()];
        const carrier = children.find(child => typeof child.params.railActive === 'boolean');
        assert.ok(carrier, 'shell mounts the shared navigation overlay');
        const { owner: overlay } = createReaderBuilderProbe(childSources.MainNavigationOverlay, ['build'],
          { MainNavigationRail: Child }, { childSources });
        Object.assign(overlay, carrier.params);
        overlay.initialRender();
        const navigation = [...children.filter(child => child !== carrier), ...overlay.children.values()];
        assert.equal(navigation.length, 1, 'only one navigation orientation mounts');
        assert.equal(overlay.children.size, mode === 'rail' ? 1 : 0);
        assert.deepEqual(insets, [83]);
        const [child] = navigation;
        child.params.onSelect('bookshelf',7);child.params.onCurrentTap('settings',7);
        assert.deepEqual(calls,[['bookshelf',7],['current:settings',7]]);
        owner.navigationGeneration=8;child.params.onSelect('bookshelf',7);owner.mounted=false;owner.requestMainTab('bookshelf',8);
        assert.equal(calls.length,2,'old callbacks cannot navigate');
      }
      // The home composition must reuse the owner; no independent rail or mode resolver remains.
      const settings=readFileSync(path.join(base,'features/settings/ui/SettingsShell.ets'),'utf8');
      assert.ok(settings.includes('MainTabShell({'));assert.ok(!/MainNavigationRail|MainTabBar|readerMainNavigationMode/.test(settings.replace(/\/\/[^\n]*/g,'')));
    }
    if (id === 'settings-geometry') {
      const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
      const load = loader();
      const geometry = load('ui/layout/ReaderPageGeometry.ts');
      const shell = load('ui/layout/ReaderPageShell.ts');
      const scroll = load('ui/layout/ReaderScrollLayout.ts');
      const { ReaderMeasurementStore } = load('ui/layout/ReaderMeasurements.ts');
      const metrics = load('ui/foundation/ReaderWindowMetrics.ts').createDefaultReaderWindowMetrics();
      const source = readFileSync(path.join(base, 'ui/layout/ReaderStandardPage.ets'), 'utf8');
      const { owner } = createReaderBuilderProbe(source, [
        'onLayoutInputsChanged', 'recordMeasurement', 'headerHeight', 'footerHeight', 'refreshGeometry', 'scrollLayout',
      ], {
        ...geometry, ...shell, ...scroll,
        readerPageInitialHeaderHeight: () => 48,
        ReaderWindowCoordinator: { metrics: () => metrics },
      });
      Object.assign(owner, { mounted: true, measurementKey: 0, geometryRevision: 0, viewportWidth: 366,
        viewportHeight: 800, variant: 'settingsHome', contentLeadingRail: 0, contentEndInset: -1,
        measurements: new ReaderMeasurementStore() });
      owner.onLayoutInputsChanged();
      const portraitKey = owner.measurementKey;
      owner.recordMeasurement('standard:header', 53, portraitKey);
      owner.recordMeasurement('standard:footer', 55, portraitKey);
      const portrait = owner.geometry;
      assert.equal(portrait.header.height, 53);
      assert.equal(portrait.footer.height, 55);
      assert.deepEqual(owner.scrollLayout(), scroll.readerScrollLayout(portrait));
      Object.assign(owner, { viewportWidth: 760, viewportHeight: 366, contentLeadingRail: 88, contentEndInset: 20 });
      owner.onLayoutInputsChanged();
      const landscape = owner.geometry;
      assert.equal(landscape.footer.height, 0);
      assert.equal(landscape.content.endInset, 20);
      assert.ok(landscape.content.frame.left >= 88);
      owner.recordMeasurement('standard:header', 99, portraitKey);
      owner.recordMeasurement('standard:footer', 99, portraitKey);
      assert.equal(owner.geometry, landscape, 'retired native callbacks cannot change the active layout');
      owner.recordMeasurement('standard:header', 61, owner.measurementKey);
      assert.equal(owner.geometry.header.height, 61);
      assert.deepEqual(owner.scrollLayout(), scroll.readerScrollLayout(owner.geometry));
      owner.mounted = false;
      const retired = owner.geometry;
      owner.recordMeasurement('standard:header', 99, owner.measurementKey);
      assert.equal(owner.geometry, retired);
    }
    if(id==='font-receipt') {
      const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
      const plain=loader(),metrics=plain('ui/foundation/ReaderWindowMetrics.ts').createDefaultReaderWindowMetrics();
      metrics.windowRect.width=960;metrics.windowRect.height=1000;metrics.navigationInsets.bottom=24;
      const store=new Map(),load=loader({'app/ReaderWindowCoordinator.ts':{ReaderWindowCoordinator:{metrics:()=>metrics}},
        'app/ReaderProductScope.ts':{isReaderMainTabEnabled:k=>['bookshelf','settings'].includes(k)}},
        {AppStorage:{get:k=>store.get(k),setOrCreate:(k,v)=>store.set(k,v)}});
      const nav=load('features/shell/MainNavigationSpec.ts');nav.publishReaderMainViewport(760,200);
      const source=readFileSync(path.join(base,'features/shell/MainTabShell.ets'),'utf8');
      const {owner}=createReaderBuilderProbe(source,['navigationMode'],nav);
      let reads=0;Object.assign(owner,{wideNavigationRail:true,mainViewportRevision:1});
      Object.defineProperty(owner,'readerWindowMetricsRevision',{get(){reads++;return reads;}});
      assert.equal(owner.navigationMode(),'rail');metrics.systemFontScale=2;assert.equal(owner.navigationMode(),'bottom');
      assert.equal(reads,2,'font receipt must be observed even if viewport has not changed');
      for(const rel of ['shell/MainTabShell.ets','bookshelf/BookshelfPage.ets','bookshelf/BookshelfEmptyPage.ets','bookshelf/BookshelfStatusContent.ets','discover/DiscoverPage.ets','rss/RssPage.ets']) {
        const text=readFileSync(path.join(base,'features',rel),'utf8'),tree=ts.createSourceFile(rel,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
        let count=0;function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(tree)==='readerMainNavigationMode') {
          count++;assert.equal(n.arguments[2]?.getText(tree),'this.readerWindowMetricsRevision',rel);
        }ts.forEachChild(n,visit);}visit(tree);assert.ok(count>0,rel);
      }
      const rail=readFileSync(path.join(base,'features/shell/MainNavigationRail.ets'),'utf8');
      assert.ok(rail.includes('readerMainRailTop(this.mainViewportRevision, this.readerWindowMetricsRevision)'));
    }
    if(id==='detail-frame') {
      const load=loader(),geometry=load('ui/layout/SurfaceHorizontalGeometry.ts'),tokens=load('ui/foundation/ReaderTokens.ets');
      const source=readFileSync(path.join(base,'features/reading/ui/LocalBookDetail.ets'),'utf8');
      const tree=ts.createSourceFile('LocalBookDetail.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
      const component=tree.statements.find(n=>n.name?.text==='LocalBookDetail');
      const method=component.members.find(n=>n.name?.getText(tree)==='dockFrame').getText(tree).replace('private ','');
      const emitted=ts.transpileModule('class Detail {'+method+'}',{compilerOptions:{target:ts.ScriptTarget.ES2021}}).outputText;
      const Detail=new Function(...Object.keys(geometry),'TOK_SPACE_SM',emitted+';return Detail;')(...Object.values(geometry),tokens.TOK_SPACE_SM);
      for(const width of [0,20,320,760,1200])for(const safe of [0,48]) {
        const content=geometry.resolveHorizontalFrame(width,safe,0,new geometry.SurfaceWidthSpec(tokens.TOK_CONTENT_MAX_W_TABLET,18,18));
        const owner=new Detail();Object.assign(owner,{book:{contentKind:'text'},contentFrame:()=>content});
        const frame=owner.dockFrame();assert.ok(frame.width>=0 && frame.width<=content.width);
        assert.ok(frame.left>=content.left && frame.right>=content.right);
        assert.ok(Math.abs(frame.left+frame.width+frame.right-width)<.001);
      }
    }
    if (id === 'action-semantics') {
      const load=loader({}, {AccessibilityRoleType:{BUTTON:'button'}});
      const {ReaderActionAccessibility}=load('ui/controls/ReaderActionAccessibility.ets');
      for(const enabled of [true,false])for(const selected of [true,false]) {
        const facts={},node=new Proxy({}, {get:(_,key)=>(v)=>{facts[key]=v;return node;}});
        new ReaderActionAccessibility('书名与作者',enabled,selected).applyNormalAttribute(node);
        assert.deepEqual(facts,{accessibilityRole:'button',accessibilityText:'书名与作者',accessibilitySelected:selected,focusable:enabled,enabled});
        const untouched={};new ReaderActionAccessibility('带开关的行',true,false,false).applyNormalAttribute(untouched);
        assert.deepEqual(untouched,{});
      }
    }
    recordContractCasePass(id);
  }
}
