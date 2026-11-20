import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const definitions = {
  'viewport-rail': { description: 'Production host receipts and rail fit at 599/600, split hosts, short heights and scaled labels; invalid measurements cannot replace a valid receipt.' },
  'settings-migration': { description: 'Production Preferences gateway preserves old bottom default and explicit choices, isolates snapshots, and retains accepted rail choice after lost flush ACK.' },
  'grid-height': { description: 'Production shared grid is bounded at 320/600/760/960 and contains actual text line boxes plus optional progress at font scales 1/1.5/2.' },
  'discover-selection': { description: 'Actual Index callback admits copied identities through current presentation, uses current metadata, rejects retired rows, and returns to the real parent.' },
  'sdk-navigation': { description: 'Actual SDK lowered bottom and rail builders keep focus/selected actions and scale the rail box with its text.' },
  'sdk-followup-actions': { description: 'Actual shelf mode and bounded close builders retain role/focus/selected/disabled facts and guarded callbacks.' },
  'shell-owner': { description: 'Shared navigation builders place one orientation, forward overlay inset, and reject retired navigation callbacks.' },
  'font-receipt': { description: 'A font-only metrics receipt re-evaluates actual shell mode; every scoped ordinary consumer and SDK rail forwards the current receipt, with equivalent syntax and lost-receipt controls.' },
  'detail-frame': { description: 'Actual standard detail dock is inset from its content owner at narrow, wide and asymmetric safe edges.' },
  'action-semantics': { description: 'Production shared modifier preserves disabled and selected facts without hiding child controls in non-action settings rows.' },
};
const selected = selectContractCases(definitions);
if (selected.length > 0) {
  const { installedEtsCompiler, emitSdkProbe } = await import('./lib/ets-compiler-runtime.mjs');
  const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
  const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
  const { createEtsBuilderProbe } = await import('./lib/ets-builder-probe.mjs');
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
      const output = emitSdkProbe(source, { fileName: file, scriptKind: file.endsWith('.ets') ? 'ETS' : 'TS', compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS } });
      const module = { exports: {} }; cache.set(file, module.exports);
      new Function('require', 'module', 'exports', ...Object.keys(globals), output)(id => {
        if (Object.hasOwn(overrides, id)) return overrides[id];
        assert.ok(id.startsWith('.'), `No unlisted platform dependency: ${id}`);
        return load(path.relative(base, path.resolve(path.dirname(file), id)));
      }, module, module.exports, ...Object.values(globals));
      return module.exports;
    }
    return load;
  }
  let commonPolicies;
  function navigationBuilder(source,names,dependencies={},hooks={}) {
    if(commonPolicies===undefined) { const load=loader(); commonPolicies={...load('features/common/ReaderTypography.ets'),...load('features/common/ReaderThemeRegistry.ts')}; }
    return createEtsBuilderProbe(source,names,{...commonPolicies,...dependencies},hooks);
  }
  for (const id of selected) {
    if (id === 'viewport-rail') {
      const data = new Map(), AppStorage = { get: key => data.get(key), setOrCreate: (key, value) => data.set(key, value) };
      const basic = loader(), metricsModule = basic('features/common/ReaderWindowMetrics.ts');
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
      const floating=load('features/common/ReaderFloatingBarMetrics.ts');
      for(const scale of [1,1.5,2])for(const safe of [0,34]) {
        metrics.systemFontScale=scale;metrics.navigationInsets.bottom=safe;
        assert.equal(floating.readerFloatingTabContentInset(metrics),68+18*(scale-1)+Math.max(15,safe)+16);
        assert.ok(floating.readerFloatingTabBarHeight(scale)>=floating.readerMainTabItemHeight(scale)+8);
      }
      metrics.systemFontScale=1;metrics.navigationInsets.bottom=0;
      const geometry = load('features/common/ReaderPageGeometry.ts');
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
          'app/ReaderThemeHost.ts':{ReaderThemeHost:{prepareUserChange:async()=>{},settingsWriteGeneration:()=>0,assertSettingsWritable:()=>{}}}});
        const mod=load('features/settings/SettingsGateway.ts');return {mod,gateway:new mod.SettingsGateway({}),cache,disk,lose:()=>{loseAck=true;}};
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
      const load=loader(),grid=load('features/bookshelf/BookshelfGridSpec.ets'),type=load('features/common/ReaderTypography.ets');
      for(const width of [282,562,620,720])for(const expanded of [false,true])for(const scale of [1,1.5,2]) {
        const plain=grid.bookshelfGridFrame(width,expanded,scale,false),progress=grid.bookshelfGridFrame(width,expanded,scale,true);
        assert.ok(plain.rowWidth<=width+.001);assert.ok(plain.cardWidth>0);
        const required=(type.TYPE_SHELF_LIST_TITLE.lineHeightFp+type.TYPE_SHELF_LIST_AUTHOR.lineHeightFp)*scale+12;
        assert.ok(Math.abs(plain.cardHeight-plain.coverHeight-required)<1e-8);
        assert.ok(Math.abs(progress.cardHeight-plain.cardHeight-(6+type.TYPE_SHELF_LIST_STATUS.lineHeightFp*scale))<1e-8);
      }
    }
    if(id==='grid-height') {
      const load=loader(),type=load('features/common/ReaderTypography.ets'),grid=load('features/bookshelf/BookshelfGridSpec.ets');
      const metrics={systemFontScale:1};
      const {owner}=navigationBuilder(readFileSync(path.join(base,'features/bookshelf/BookshelfPage.ets'),'utf8'),['projectionGridDetails'],
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
      const method=component.members.find(n=>n.name?.getText(tree)==='discoverPageSurface');
      let callback;
      const walk=n=>{if(ts.isPropertyAssignment(n)&&n.name.getText(tree)==='onSelectBook')callback=n.initializer.getText(tree);ts.forEachChild(n,walk);};walk(method);
      assert.ok(callback);
      const { factory }=pureModuleProbe(`function factory(generation,owner,mounting,host){return ${callback};}`,'DiscoverCallback.ets',{},['factory']);
      const calls=[],current={sourceId:'source',bookId:'book',name:'current title',author:'author',category:'novel',coverUrl:'cover',intro:'intro'};
      let admitted=true;
      const owner={discoverUi(){return this.discoverProduct;},isCurrentDiscoverPresentation:()=>admitted,sourceDisplayName:()=> 'source name',openRemoteBookDetail:(...args)=>calls.push(args),discoverProduct:{discoverPresentation:{books:[current]}}};
      const click=factory.call(owner,1,{},2,{});
      click({...current,name:'old title'});assert.equal(calls.length,1);assert.equal(calls[0][0].title,'current title');
      admitted=false;click({...current});assert.equal(calls.length,1);
      admitted=true;owner.discoverProduct.discoverPresentation.books=[];click({...current});assert.equal(calls.length,1);
      const ReturnProbe=selectedProductionMethods(new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),'Index',['returnFromDetail']);
      const parent=new ReturnProbe(),routes=[];
      Object.assign(parent,{openDiscover:()=>routes.push('discover'),returnToSearch:()=>routes.push('search'),returnToBookshelf:()=>routes.push('bookshelf')});
      for(const route of ['discover','search','bookshelf']){parent.detailReturnRoute=route;parent.returnFromDetail();}
      assert.deepEqual(routes,['discover','search','bookshelf']);
    }
    if (id === 'sdk-navigation') {
      const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
      const properties = createArkUIPropertyRuntimeProbe();
      const raisedSource = readFileSync(path.join(base,'features/common/ReaderRaisedSurface.ets'),'utf8');
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
      const floating = load('features/common/ReaderFloatingBarMetrics.ts');
      const typography = load('features/common/ReaderTypography.ets');
      const tokens = load('features/common/ReaderTokens.ets');
      const surfaces = load('features/common/ReaderSurfaceSpecs.ets');
      const { owner } = navigationBuilder(readFileSync(path.join(base,'features/shell/MainTabBar.ets'),'utf8'),
        ['bottomBar','verticalRail','tabItem','navigationFontScale','recordRaisedSurface','vertical',
          'bottomSurfaceWidth','bottomSurfaceHeight','railSurfaceWidth','railSurfaceHeight'],
        {...properties.sdk,...nav,...floating,...typography,...tokens,...surfaces,readerPageAreaLength:load('features/common/ReaderPageShell.ts').readerPageAreaLength,ReaderRaisedSurface:RaisedSurfaceInputs,
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
      const load=loader({}, {AccessibilityRoleType:{BUTTON:'AccessibilityRoleType.BUTTON'}});
      const access=load('features/common/ReaderActionAccessibility.ets');
      for(const enabled of [true,false]) {
        const {owner}=navigationBuilder(readFileSync(path.join(base,'features/bookshelf/BookshelfSettingsPage.ets'),'utf8'),['modeOption','selectMode'],access);
        let canSave=enabled;const calls=[];
        Object.assign(owner,{mounted:true,revision:0,mode:'cover',appThemeScheme:'day',viewModeSnapshot:{canSave:enabled},
          viewModeHost:{canSave:()=>canSave},persistRequestedMode:async value=>{calls.push(value);}});
        owner.modeOption('cover','封面');owner.modeOption('list','列表');
        const nodes=[...owner.nodes.values()].filter(n=>n.onClick);
        assert.deepEqual(nodes.map(n=>n.accessibilitySelected),[true,false]);
        assert.ok(nodes.every(n=>n.focusable===enabled&&n.enabled===enabled&&n.accessibilityRole==='AccessibilityRoleType.BUTTON'));
        nodes[1].onClick();assert.deepEqual(calls,enabled?['list']:[]);
        canSave=false;nodes[0].onClick();assert.equal(calls.length,enabled?1:0,'retained callback cannot bypass current save admission');
        canSave=true;owner.mounted=false;nodes[0].onClick();assert.equal(calls.length,enabled?1:0,'retired settings owner cannot change mode');
        for(const specId of ['source-switch-window','tts-config-manager','tts-config']) {
          const {owner:header}=navigationBuilder(readFileSync(path.join(base,'features/common/ReaderBoundedSurfaceHeader.ets'),'utf8'),['closeAction','drawerClose'],access);
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
      const source=readFileSync(path.join(base,'features/shell/MainTabShell.ets'),'utf8');
      const childSources=Object.fromEntries(['MainTabBar','MainNavigationRail','MainNavigationOverlay'].map(n=>[n,readFileSync(path.join(base,'features/shell/'+n+'.ets'),'utf8')]));
      class Child {constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});} updateStateVars(params){Object.assign(this.params,params);}}
      for(const mode of ['bottom','rail']) {
        const {owner}=navigationBuilder(source,['bottomNavigation','mainOverlays','requestMainTab','requestCurrentTab','overlayContent','scrollOverlayContent','emptySlot','emptyScrollOverlay'],
          {MainTabBar:Child,MainNavigationRail:Child,MainNavigationOverlay:Child},{childSources});
        const calls=[],insets=[];Object.assign(owner,{mounted:true,navigationGeneration:7,activeTab:'settings',navigationMode:()=>mode,
          onMainTab:(k,g)=>calls.push([k,g]),onCurrentTabTap:(k,g)=>calls.push(['current:'+k,g]),
          overlayContent:()=>{},scrollOverlayContent:v=>insets.push(v)});
        owner.bottomNavigation();owner.mainOverlays(83);
        const children=[...owner.children.values()];
        const overlayInputs=children.find(child=>Object.hasOwn(child.params,'railActive'));
        assert.ok(overlayInputs,'the actual shared overlay owns the rail branch');
        const {owner:overlay}=navigationBuilder(childSources.MainNavigationOverlay,['build','overlayContent','emptySlot'],
          {MainNavigationRail:Child},{childSources});
        Object.assign(overlay,overlayInputs.params);overlay.initialRender();
        const navigationChildren=[...children.filter(child=>child!==overlayInputs),...overlay.children.values()];
        assert.equal(owner.children.size,mode==='bottom'?2:1,'shared overlay remains mounted in both orientations');
        assert.equal(navigationChildren.length,1,'only one navigation orientation mounts');assert.deepEqual(insets,[83]);
        const child=navigationChildren[0];child.params.onSelect('bookshelf',7);child.params.onCurrentTap('settings',7);
        assert.deepEqual(calls,[['bookshelf',7],['current:settings',7]]);
        owner.navigationGeneration=8;child.params.onSelect('bookshelf',7);owner.mounted=false;owner.requestMainTab('bookshelf',8);
        assert.equal(calls.length,2,'old callbacks cannot navigate');
      }
      // Resolve imported identities rather than freezing whitespace, comments
      // or local import names. Only actual component/call ownership is checked.
      const settings=readFileSync(path.join(base,'features/shell/SettingsShell.ets'),'utf8');
      function checkSharedOwner(definition){
        const tree=ts.createSourceFile('SettingsShell.ets',definition,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
        assert.equal(tree.parseDiagnostics.length,0);const aliases=new Map();let sharedImport;
        for(const declaration of tree.statements.filter(ts.isImportDeclaration))for(const item of declaration.importClause?.namedBindings?.elements??[]) {
          const original=item.propertyName?.text??item.name.text;aliases.set(item.name.text,original);
          if(original==='MainTabShell'){assert.ok(declaration.moduleSpecifier.text.endsWith('/MainTabShell'));sharedImport=item;}
        }
        assert.ok(sharedImport);const owner=tree.statements.find(node=>node.name?.text==='SettingsShell');
        const build=owner.members.find(node=>node.name?.getText(tree)==='build');assert.ok(build);let shared=0;
        const visit=node=>{if((ts.isCallExpression(node)||ts.isEtsComponentExpression?.(node))&&ts.isIdentifier(node.expression)){
          const identity=aliases.get(node.expression.text)??node.expression.text;
          if(identity==='MainTabShell')shared++;
          assert.ok(!['MainTabBar','MainNavigationRail','readerMainNavigationMode'].includes(identity),'settings uses one shared navigation owner');
        }ts.forEachChild(node,visit);};visit(build);assert.equal(shared,1);return{tree,owner,build,sharedImport};
      }
      const shared=checkSharedOwner(settings),edits=[{start:shared.sharedImport.getStart(shared.tree),end:shared.sharedImport.end,text:'MainTabShell as SharedNavigationForProbe'}];
      const originalName=shared.sharedImport.name.text;
      const rename=node=>{if(ts.isIdentifier(node)&&node.text===originalName)edits.push({start:node.getStart(shared.tree),end:node.end,text:'SharedNavigationForProbe'});ts.forEachChild(node,rename);};
      rename(shared.owner);let equivalent=settings;
      for(const edit of edits.sort((a,b)=>b.start-a.start))equivalent=equivalent.slice(0,edit.start)+edit.text+equivalent.slice(edit.end);
      checkSharedOwner(equivalent);
      const start=shared.build.body.getStart(shared.tree)+1;
      const independent=settings.slice(0,start)+'\n MainTabBar({});\n'+settings.slice(start);
      assert.throws(()=>checkSharedOwner(independent),/one shared navigation owner/);
    }
    if(id==='font-receipt') {
      const plain=loader(),metrics=plain('features/common/ReaderWindowMetrics.ts').createDefaultReaderWindowMetrics();
      metrics.windowRect.width=960;metrics.windowRect.height=1000;metrics.navigationInsets.bottom=24;
      const store=new Map(),coordinator={metrics:()=>metrics};
      const load=loader({'app/ReaderWindowCoordinator.ts':{ReaderWindowCoordinator:coordinator},
        'app/ReaderProductScope.ts':{isReaderMainTabEnabled:k=>['bookshelf','settings'].includes(k)}},
        {AppStorage:{get:k=>store.get(k),setOrCreate:(k,v)=>store.set(k,v)}});
      const nav=load('features/shell/MainNavigationSpec.ts');nav.publishReaderMainViewport(760,200);
      const source=readFileSync(path.join(base,'features/shell/MainTabShell.ets'),'utf8');
      const {owner}=navigationBuilder(source,['navigationMode'],nav);
      let reads=0;Object.assign(owner,{wideNavigationRail:true,mainViewportRevision:1});
      Object.defineProperty(owner,'readerWindowMetricsRevision',{get(){reads++;return reads;}});
      assert.equal(owner.navigationMode(),'rail');metrics.systemFontScale=2;assert.equal(owner.navigationMode(),'bottom');
      assert.equal(reads,2,'font receipt must be observed even if viewport has not changed');
      const policy={...nav,...load('features/common/ReaderPageGeometry.ts'),...load('features/common/ReaderTokens.ets'),
        ...load('features/common/ReaderFloatingBarMetrics.ts'),ReaderWindowCoordinator:coordinator};
      let first;
      for(const rel of ['shell/MainTabShell.ets','bookshelf/BookshelfPage.ets','bookshelf/BookshelfEmptyPage.ets','bookshelf/BookshelfStatusContent.ets','discover/DiscoverPage.ets','rss/RssPage.ets']) {
        const full=path.join(base,'features',rel),text=readFileSync(full,'utf8'),tree=ts.createSourceFile(rel,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
        assert.equal(tree.parseDiagnostics.length,0);
        const aliases=new Set(tree.statements.filter(ts.isImportDeclaration).flatMap(node=>[...(node.importClause?.namedBindings?.elements??[])]
          .filter(item=>(item.propertyName?.text??item.name.text)==='readerMainNavigationMode').map(item=>item.name.text)));
        let count=0;
        for(const component of tree.statements.filter(node=>node.members))for(const method of component.members.filter(ts.isMethodDeclaration)) {
          const calls=[];
          const visit=node=>{if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&aliases.has(node.expression.text))calls.push(node);ts.forEachChild(node,visit);};
          visit(method);if(!calls.length)continue;count+=calls.length;
          const observed=[];const dependencies={...policy,...Object.fromEntries([...aliases].map(alias=>[alias,(...args)=>{observed.push(args);return nav.readerMainNavigationMode(...args);}]))};
          const methodName=method.name.getText(tree),Consumer=selectedProductionMethods(new URL('../entry/src/main/ets/features/'+rel,import.meta.url),component.name.text,[methodName],dependencies);
          function check(Type){const value=Object.assign(new Type(),{wideNavigationRail:true,mainViewportRevision:11});let currentReads=0;
            Object.defineProperty(value,'readerWindowMetricsRevision',{get(){currentReads++;return 77;}});observed.length=0;value[methodName]();
            assert.ok(currentReads>0,rel+' reads current metrics receipt');assert.ok(observed.length>0);
            assert.ok(observed.every(args=>args[2]===77),rel+' forwards current metrics receipt');}
          check(Consumer);
          if(!first)first={text,tree,method,call:calls[0],methodName,dependencies,check};
        }
        assert.ok(count>0,rel+' declares current policy consumers');
      }
      assert.ok(first);const arg=first.call.arguments[2];assert.ok(arg);
      const start=arg.getStart(first.tree)-first.method.getStart(first.tree),end=arg.end-first.method.getStart(first.tree),method=first.method.getText(first.tree);
      const compileMember=text=>pureModuleProbe('class ReceiptConsumer { '+text+' }','ReceiptConsumer.ets',first.dependencies,['ReceiptConsumer']).ReceiptConsumer;
      first.check(compileMember(method.slice(0,start)+'('+arg.getText(first.tree)+')'+method.slice(end)));
      assert.throws(()=>first.check(compileMember(method.slice(0,start)+'0'+method.slice(end))),/metrics receipt/,'lost current receipt must fail');
      const railFile='features/shell/MainNavigationRail.ets',railSource=readFileSync(path.join(base,railFile),'utf8');
      const {createArkUIPropertyRuntimeProbe}=await import('./lib/arkui-property-runtime-probe.mjs'),properties=createArkUIPropertyRuntimeProbe(),topCalls=[];
      class Child {constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}}
      const rail=navigationBuilder(railSource,['build'],{...properties.sdk,...nav,MainTabBar:Child,
        readerMainRailLeft:revision=>{assert.equal(revision,77);return nav.readerMainRailLeft(revision);},
        readerMainRailTop:(...args)=>{topCalls.push(args);return nav.readerMainRailTop(...args);}},
        {...properties.hooks,childSources:{MainTabBar:readFileSync(path.join(base,'features/shell/MainTabBar.ets'),'utf8')}}).owner;
      Object.assign(rail,{navigationGeneration:3,mainViewportRevision:11,activeTab:'settings'});
      Object.defineProperty(rail,'readerWindowMetricsRevision',{get:()=>77});rail.initialRender();
      assert.deepEqual(topCalls,[[11,77]],'actual SDK rail forwards current viewport and font receipt');
    }
    if(id==='detail-frame') {
      const load=loader(),geometry=load('features/common/SurfaceHorizontalGeometry.ts'),tokens=load('features/common/ReaderTokens.ets');
      const Detail=selectedProductionMethods(new URL('../entry/src/main/ets/features/bookshelf/LocalBookDetail.ets',import.meta.url),'LocalBookDetail',['dockFrame'],{...geometry,TOK_SPACE_SM:tokens.TOK_SPACE_SM});
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
      const {ReaderActionAccessibility}=load('features/common/ReaderActionAccessibility.ets');
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
