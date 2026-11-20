import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {registerHooks} from 'node:module';
import {fileURLToPath} from 'node:url';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const definitions = {
  'sheet-header-mount': { description: 'Actual SDK Surface/Header slots in three owners; old inline class-call negative and retained opening callbacks', resources: [] },
  'directory-mount': { description: 'Actual ReaderFullDirectory SDK Builder passes admitted viewport and retains clipped parent', resources: [] },
  'directory-math': { description: 'Original base allocations and actual owner font/header/query/tab reservations at approved scales; zero override retained', resources: [] },
  'sheet-math': { description: 'Three actual sheet owners conserve measured header margins and surface/footer insets', resources: [] },
  'tts-math': { description: 'Shared TTS footer, chrome, design, compact threshold and scroll budgets', resources: [] },
  'shelf-math': { description: 'Shelf text and row heights at the three approved scales', resources: [] },
  'labeled-icon-math': { description: 'Actual SourceAdd Row/Hit modifiers and ReaderButton agree at approved scales', resources: [] },
  'chrome-contract': { description: 'Approved fixed caps and current directory/bookmark font-scale consumers, natural height/clip contracts and shared Header native Area forwarding', resources: [] },
  wiring: { description: 'Actual shelf projections and Quick/full responseRegion consumer; 320 remains unresolved', resources: [] },
};
const selected = selectContractCases(definitions);
if (selected.length) {
  const productionRoot=new URL('../entry/src/main/ets/',import.meta.url).href;
  const resolver=registerHooks({resolve(specifier,context,next){
    if(context.parentURL?.startsWith(productionRoot)&&specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier)){
      const url=new URL(specifier+'.ts',context.parentURL);if(existsSync(fileURLToPath(url)))return next(url.href,context);
    }return next(specifier,context);
  }});
  try {
  const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
  const { selectedProductionMethods, selectedProductionClasses, selectedProductionValues } = await import('./lib/selected-production-methods.mjs');
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const root = '../entry/src/main/ets/';
  const file = path => new URL(path.startsWith('./') ? path : root + path, import.meta.url);
  const read = path => readFileSync(file(path), 'utf8');
  const resolvers = pureModuleProbe(read('features/common/ReaderSurfaceResolvers.ts'), 'ReaderSurfaceResolvers.ts', {},
    ['readerScaledControlHeight', 'readerReadableFontScale']);
  const exports = ['FULL_DIRECTORY_MIN_PANEL', 'readerFullDirectoryHeights', 'readerSheetBodyBudget',
    'readerTtsManagerFooterHeight', 'readerTtsManagerChromeHeight', 'readerTtsManagerDesignHeight',
    'readerTtsManagerScrollHeight', 'readerTtsManagerCompactThreshold', 'readerShelfDetailsHeight', 'readerShelfListRowHeight'];
  const budgets = pureModuleProbe(read('features/common/ReaderSurfaceBudgets.ts'), 'ReaderSurfaceBudgets.ts', resolvers, exports);
  const scales = [1, 1.3, 1.6];
  const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
  const {createEtsBuilderProbe,builderComponentMembers}=await import('./lib/ets-builder-probe.mjs');
  const {createArkUIPropertyRuntimeProbe}=await import('./lib/arkui-property-runtime-probe.mjs');
  const {ts,options}=installedEtsCompiler();
  const unwrap=node=>node&&ts.isParenthesizedExpression(node)?unwrap(node.expression):node;
  const visit=(node,predicate)=>{const found=[];const walk=n=>{if(predicate(n))found.push(n);ts.forEachChild(n,walk);};walk(node);return found;};
  function builder(path,name,ownerName,source=read(path)) {
    const tree=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
    assert.deepEqual(tree.parseDiagnostics,[],path+' parses');
    const owners=tree.statements.filter(n=>n.members&&(ownerName===undefined||n.name?.text===ownerName)&&n.members.some(m=>m.name?.getText(tree)===name));
    assert.equal(owners.length,1,path+':'+name);
    return {tree,node:owners[0].members.find(m=>m.name?.getText(tree)===name)};
  }
  const calls=(definition,name)=>visit(definition.node,n=>ts.isCallExpression(n)&&ts.isPropertyAccessExpression(unwrap(n.expression))&&unwrap(n.expression).name.text===name);
  const property=(object,name)=>unwrap(object)?.properties?.find(n=>ts.isPropertyAssignment(n)&&(ts.isIdentifier(n.name)||ts.isStringLiteral(n.name))&&n.name.text===name)?.initializer;
  const evaluate=(expression,tree,owner={},dependencies={})=>pureModuleProbe('function evaluate(){return '+expression.getText(tree)+';}','DimensionExpression.ets',dependencies,['evaluate']).evaluate.call(owner);
  const hasMinimum=definition=>calls(definition,'constraintSize').some(call=>property(call.arguments[0],'minHeight')!==undefined);
  function finiteNatural(definition,cap,owner={}) {
    assert.ok(calls(definition,'maxFontScale').some(call=>evaluate(call.arguments[0],definition.tree,owner)===cap),'approved finite cap');
    assert.ok(hasMinimum(definition),'natural minimum height');
  }
  function sheetSdk() {
    const {searchSheetSdkInputs}=sheetPolicies;
    const properties=createArkUIPropertyRuntimeProbe(),deps={...properties.sdk,...searchSheetSdkInputs({densityPixels:1})};
    const childSources=Object.fromEntries(['ReaderBoundedSurface','ReaderBoundedSurfaceHeader'].map(name=>[name,read('features/common/'+name+'.ets')]));
    const hooks={...properties.hooks,childSources,mountChildren:true,lifecycleChildren:true};
    for(const [name,source] of Object.entries(childSources))deps[name]=createEtsBuilderProbe(source,builderComponentMembers(source,name),deps,{...hooks,componentName:name}).Component;
    const walk=owner=>[owner,...[...owner.children.values()].flatMap(child=>child.nodes?walk(child):[])];
    return {deps,hooks,walk,nodes:owner=>walk(owner).flatMap(child=>[...child.nodes.values()]),consumer:(source,names,extra)=>createEtsBuilderProbe(source,names,{...deps,...extra},hooks).owner};
  }
  const sheetPolicies=await import('./lib/search-sheet-sdk-probe.mjs');
  function headerReceipt(specId) {
    const composition=sheetSdk(),receipts=[];
    const header=new composition.deps.ReaderBoundedSurfaceHeader(undefined,{specId,title:'measured',onAreaChanged:(...args)=>receipts.push(args)});
    header.initialRender();
    const carriers=composition.nodes(header).filter(node=>typeof node.onAreaChange==='function');assert.equal(carriers.length,1);
    const old={height:40},next={height:66};carriers[0].onAreaChange(old,next);assert.equal(receipts.length,1);assert.equal(receipts[0][0],old);assert.equal(receipts[0][1],next);
    return {composition,header};
  }
  for (const id of selected) {
    if (id === 'sheet-header-mount') {
      const { actualReaderPageShell } = await import('./lib/reader-page-shell-runtime-probe.mjs');
      const { readerPageAreaLength } = actualReaderPageShell();
      const targets = [
        ['./fixtures/source-workflow/ReaderSourceFilterPanel.ets', 'source-management-filter', '筛选书源', 'identity', 'headerHeight'],
        ['features/source/SourceManagementMoreMenu.ets', 'source-management-more', '书源管理', 'identity', 'headerHeight'],
        ['features/search/ReaderSearchTaskPanel.ets', 'search-task-status', '搜索进度', 'presentationIdentity', 'measuredHeaderHeight'],
      ];
      function mount(source, target) {
        // Both protected children are actual whole SDK component sources and
        // actual V1 Props/lifecycle; only unrelated content slots are empty.
        const composition = sheetSdk();
        const names = ['sheetContent', 'sheetHeader', 'accepts', ...(target[3] === 'identity' ? ['close'] : ['measureHeader'])];
        const owner = composition.consumer(source, names, { readerPageAreaLength,
          uiContext: { getFocusController: () => ({ clearFocus() {} }) } });
        const dismissed = [];
        Object.assign(owner, { mounted: true, expanded: true, identity: 'opening-1', presentationIdentity: 'opening-1',
          scheme: 'day', mode: 'sources', headerHeight: 0, measuredHeaderHeight: 0,
          sheetBody() {}, footer() {}, onDismiss: identity => dismissed.push(identity) });
        return { composition, owner, dismissed };
      }
      for (const target of targets) {
        const current = mount(read(target[0]), target);
        assert.doesNotThrow(() => current.owner.sheetContent(), target[0] + ' mounts actual slots');
        const headers = current.composition.walk(current.owner)
          .filter(child => child instanceof current.composition.deps.ReaderBoundedSurfaceHeader);
        assert.equal(headers.length, 1, 'one actual Header component constructed inside actual Surface');
        const header = headers[0];
        assert.equal(header.specId, target[1]); assert.equal(header.title, target[2]);
        const area=current.composition.nodes(header).find(node=>typeof node.onAreaChange==='function');assert.ok(area);area.onAreaChange({}, {height:66});
        assert.equal(current.owner[target[4]], 66, 'actual measurement callback preserved');
        const closeNode = current.composition.nodes(header).find(node => typeof node.onClick === 'function');
        assert.ok(closeNode, 'actual Header emits native close action');
        closeNode.onClick();
        if (target[3] === 'identity') assert.equal(current.owner.expanded, false);
        else assert.deepEqual(current.dismissed, ['opening-1']);
        current.owner.expanded = true; current.owner[target[3]] = 'opening-2'; current.owner[target[4]] = 0;
        closeNode.onClick(); area.onAreaChange({}, { height: 88 });
        assert.equal(current.owner.expanded, true, 'retained old physical close cannot close another opening');
        assert.equal(current.owner[target[4]], 0, 'retained old measurement cannot change another opening');
        if (target[3] !== 'identity') assert.deepEqual(current.dismissed, ['opening-1']);
      }
      const target = targets[0], fixed = read(target[0]);
      const declaration=builder(target[0],'sheetContent'),header=builder(target[0],'sheetHeader');
      const callbacks=visit(declaration.node,n=>ts.isPropertyAssignment(n)&&n.name?.getText(declaration.tree)==='header');assert.equal(callbacks.length,1);
      const callback=callbacks[0].initializer;
      const old=fixed.slice(0,callback.getStart(declaration.tree))+'(): void => '+header.node.body.getText(header.tree)+fixed.slice(callback.end);
      const broken=mount(old,target);
      assert.throws(()=>broken.owner.sheetContent(),error=>error instanceof TypeError&&/class constructor.*without ['"]?new/i.test(error.message),'actual inline class call counterexample');
      // Select the renamed actual Builder, never replace its executable body.
      const composition=sheetSdk(),renamed=composition.consumer(fixed.replaceAll('sheetHeader','measuredHeaderBuilder'),['sheetContent','measuredHeaderBuilder','accepts','close'],{readerPageAreaLength,uiContext:{getFocusController:()=>({clearFocus(){}})}});
      Object.assign(renamed,{mounted:true,expanded:true,identity:'opening-equivalent',scheme:'day',sheetBody(){},footer(){}});renamed.sheetContent();
      assert.equal(composition.walk(renamed).filter(child=>child instanceof composition.deps.ReaderBoundedSurfaceHeader).length,1,'private Builder rename preserves actual mounting');
    } else if (id === 'directory-mount') {
      const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
      const parentSource = read('features/reading/ReaderFullDirectory.ets'), panelSource = read('features/reading/FullDirectoryPanel.ets');
      class PanelBoundary {
        constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
        updateStateVars(next) { Object.assign(this.params, next); }
      }
      for (const expanded of [false, true]) for (const available of [0, 214, 460, 844]) {
        const props = createArkUIPropertyRuntimeProbe();
        const { owner } = createEtsBuilderProbe(parentSource,
          ['directoryContent', 'fullPanelHeight', 'panelViewportHeight'],
          { ...props.sdk, FullDirectoryPanel: PanelBoundary,
            ReaderWindowCoordinator: { metrics: () => ({}) }, readerInteractiveSafeBottom: () => 20 },
          { ...props.hooks, childSources: { FullDirectoryPanel: panelSource } });
        Object.assign(owner, { entries: [], sourceId: 'remote', catalogContext: 'detail', directoryRecovery: {},
          usesExpandedLayout: () => expanded, liveContainerHeight: () => available + 20, fullPanelTop: () => 0,
          panelWidth: () => 340, panelLeft: () => 13, panelTop: () => 0, shouldAnimatePanel: () => false });
        owner.directoryContent();
        const child = [...owner.children.values()].find(value => value instanceof PanelBoundary);
        assert.ok(child, 'actual SDK mounts FullDirectoryPanel declaration');
        const expected = Math.min(expanded ? 852 : 736, available);
        assert.equal(child.params.panelHeightOverride, expected);
        assert.equal(child.params.panelWidthOverride, 340); assert.equal(child.params.expandedLayout, expanded);
        assert.equal(child.params.entries, owner.entries); assert.equal(child.params.allowUnanchoredBrowse, true);
        const clip = [...owner.nodes.values()].find(node => node.type === 'Stack' && node.clip === true);
        assert.ok(clip, 'actual native parent retains clip(true)');
        assert.equal(clip.height, expected); assert.equal(clip.width, 340);
        owner.updateStateVars({ entries: [{ index: 1, title: 'updated' }] }); props.flush();
        assert.equal(child.params.entries, owner.entries, 'SDK child Props update payload preserves current entries');
      }
    } else if (id === 'directory-math') {
      const examples = [[852, 820, 782, 639, 689], [736, 704, 666, 523, 573],
        [460, 428, 390, 247, 297], [214, 182, 144, 1, 51], [213, 181, 143, 0, 50]];
      assert.equal(budgets.FULL_DIRECTORY_MIN_PANEL, 214);
      const metrics={systemFontScale:1};
      const Directory = selectedProductionMethods(file('features/reading/FullDirectoryPanel.ets'), 'FullDirectoryPanel',
        ['panelHeight','heights','contentHeight','bodyContentHeight','chapterListHeight','bookmarkListHeight',
          'panelHeaderHeight','queryHeight','tabStripHeight','queryStacked','searchControlsHeight','fontScale','tabHeight','panelWidth','innerWidth'],
        {...budgets,...resolvers,ReaderWindowCoordinator:{metrics:()=>metrics},TOK_SPACE_CONTROL_INLINE:10});
      for (const [panel, content, body, chapterList, bookmarkList] of examples) {
        assert.deepEqual(budgets.readerFullDirectoryHeights(panel), { panel, content, body, chapterList, bookmarkList });
        for (const expandedLayout of [false, true]) for(const [i,scale]of scales.entries()) {
          metrics.systemFontScale=scale;
          const owner = Object.assign(new Directory(), {expandedLayout,embeddedInControl:false,panelHeightOverride:panel,
            panelWidthOverride:364,readerWindowMetricsRevision:0,activeTab:'directory'});
          const headerGrowth=[14,20,26][i],queryGrowth=[0,8,15][i],tabGrowth=5;
          assert.deepEqual([owner.panelHeight(), owner.contentHeight(), owner.bodyContentHeight(), owner.chapterListHeight(), owner.bookmarkListHeight()],
            [panel,content,Math.max(0,body-headerGrowth),Math.max(0,chapterList-headerGrowth-queryGrowth-tabGrowth-1),Math.max(0,bookmarkList-headerGrowth-queryGrowth-tabGrowth-3)],
            'current owner reserves its actual header/query/tab growth; base budget remains independently checked');
        }
      }
      const zero = Object.assign(new Directory(), { expandedLayout: true, embeddedInControl: false, panelHeightOverride: 0 });
      assert.equal(zero.panelHeight(), 0, 'zero is an admitted viewport, not the design fallback');
      zero.panelHeightOverride = -1; assert.equal(zero.panelHeight(), 852);
      zero.expandedLayout = false; assert.equal(zero.panelHeight(), 736);
      assert.equal(budgets.readerFullDirectoryHeights(NaN).panel, 0);
    } else if (id === 'sheet-math') {
      const spec = { titleHeight: 44, titleLineHeight: 24, titleBottom: 12, contentBottom: 20 };
      const metrics = { windowRect: { height: 844 }, systemFontScale: 1 };
      const dependencies = { ...budgets, resolveSheetSpec: () => spec, ReaderWindowCoordinator: { metrics: () => metrics },
        readerVisualSafeTop: () => 24, readerVisualSafeBottom: () => 24, readerInteractiveSafeBottom: () => 24 };
      const Task = selectedProductionMethods(file('features/search/ReaderSearchTaskPanel.ets'), 'ReaderSearchTaskPanel', ['bodyLimit'], dependencies);
      const Filter = selectedProductionMethods(file('./fixtures/source-workflow/ReaderSourceFilterPanel.ets'), 'ReaderSourceFilterPanel', ['bodyLimit'], dependencies);
      const More = selectedProductionMethods(file('features/source/SourceManagementMoreMenu.ets'), 'SourceManagementMoreMenu', ['bodyLimit'], dependencies);
      for (const scale of scales) for (const header of [0, 44]) for (const height of [844, 366]) {
        Object.assign(metrics, { systemFontScale: scale }); metrics.windowRect.height = height;
        const task = Object.assign(new Task(), { measuredHeaderHeight: header, fontScale: () => scale });
        const filter = Object.assign(new Filter(), { metricsRevision: 0, headerHeight: header, footerHeight: 72, readableFontScale: () => scale });
        const more = Object.assign(new More(), { metricsRevision: 0, headerHeight: header });
        assert.equal(task.bodyLimit(), height === 844 ? 720 : 242);
        near(filter.bodyLimit(), height === 844 ? 540.16 : 170);
        assert.equal(more.bodyLimit(), height === 844 ? 720 : 242);
        assert.ok(task.bodyLimit() + 44 + 12 + 20 + 48 <= height, 'complete task flow stays within the available height');
        assert.ok(filter.bodyLimit() + 44 + 12 + 20 + 72 + 48 <= height);
      }
      assert.equal(budgets.readerSheetBodyBudget({ windowHeight: 20, safeTop: 24, safeBottom: 24,
        headerFrame: 44, titleBottom: 12, contentBottom: 20 }), 0);
    } else if (id === 'tts-math') {
      for (const [i, scale] of scales.entries()) {
        const footer = [76, 82, 88][i], chrome = [134, 140, 146][i], design = [574, 580, 586][i];
        assert.equal(budgets.readerTtsManagerFooterHeight(scale), footer);
        assert.equal(budgets.readerTtsManagerChromeHeight(scale), chrome);
        assert.equal(budgets.readerTtsManagerCompactThreshold(scale), [166, 172, 178][i]);
        assert.equal(budgets.readerTtsManagerDesignHeight(scale), design);
        assert.equal(budgets.readerTtsManagerScrollHeight(design, scale), 440);
        assert.equal(budgets.readerTtsManagerScrollHeight(chrome - 1, scale), 0);
        assert.equal(budgets.readerTtsManagerScrollHeight(chrome + 1, scale), 1);
      }
    } else if (id === 'shelf-math') {
      assert.deepEqual(scales.map(budgets.readerShelfDetailsHeight), [72, 89, 107]);
      assert.deepEqual(scales.map(s => budgets.readerShelfListRowHeight(72, s)), [72, 89, 107]);
      assert.deepEqual(scales.map(s => budgets.readerShelfListRowHeight(104, s)), [104, 104, 107]);
      assert.equal(budgets.readerShelfDetailsHeight(NaN), 72);
    } else if (id === 'labeled-icon-math') {
      const { labeledIconSpecs } = await import('./lib/reader-labeled-icon-action-probe.mjs');
      const { foundationSpecs, foundationModifiers, readerFoundationTokens } = await import('./lib/reader-foundation-control-probe.mjs');
      const { productionReaderPressFeedback } = await import('./lib/reader-press-feedback-probe.mjs');
      const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
      const specs = labeledIconSpecs();
      const modifiers = selectedProductionClasses(file('features/common/ReaderLabeledIconAction.ets'),['ReaderLabeledIconRowModifier','ReaderLabeledIconHitModifier'],
        {...specs,...resolvers,...readerFoundationTokens,readerAppColor,ReaderPressFeedback:productionReaderPressFeedback(),VerticalAlign:{Center:'center'},FlexAlign:{Center:'center'}});
      const buttonSpecs = foundationSpecs(), { ReaderButtonFrameModifier } = foundationModifiers(buttonSpecs);
      const attrs = modifier => { const result = {}; const native = new Proxy({}, { get: (_t, key) => (...args) => { result[key] = args[0]; return native; } }); modifier.applyNormalAttribute(native); return result; };
      for (const [i, scale] of scales.entries()) {
        const row = attrs(new modifiers.ReaderLabeledIconRowModifier('source-management-add', false, 'day', true, scale));
        const hit = attrs(new modifiers.ReaderLabeledIconHitModifier('source-management-add', 'day', true, scale));
        const button = attrs(new ReaderButtonFrameModifier('source-management-manage', false, true, 'equal', 'day', false, 0, scale));
        assert.equal(row.height, [44, 50, 56][i]); assert.equal(hit.height, row.height); assert.equal(button.height, row.height);
        assert.equal(attrs(new modifiers.ReaderLabeledIconRowModifier('rss-feed', false, 'day', true, scale)).height, 32);
        assert.equal(attrs(new modifiers.ReaderLabeledIconHitModifier('rss-feed', 'day', true, scale)).height, 44);
      }
      assert.equal(specs.resolveReaderLabeledIconActionSpec('source-management-add').scaleHeight, true);
      for (const role of ['rss-feed', 'rss-entry', 'rss-management', 'rss-manage', 'rss-source-operations', 'rss-view-all', 'discover-apply'])
        assert.equal(specs.resolveReaderLabeledIconActionSpec(role).scaleHeight, false, role + ' keeps its prior contract');
    } else if (id === 'chrome-contract') {
      const roleBuilders = [
        ['ReaderControlSearchContent.ets', 'resultRow', 1.3], ['ReaderControlSearchContent.ets', 'resultSnippet', 1.3],
        ['ReaderControlSettingsContent.ets', 'segmentRow', 1.3], ['ReaderControlAppearanceContent.ets', 'stepperRow', 1.6],
        ['ReaderSessionCapsule.ets', 'build', 1.6, 'ReaderSessionCapsuleLeading'], ['ReaderControlPanel.ets', 'controlHeader', 1.1],
        ['ReaderControlReplaceContent.ets', 'ruleRow', 1.1], ['ReaderBookmarkRow.ets', 'motionBody', null],
        ['ReaderControlTimerWheel.ets', 'build', 1.3],
      ];
      for(const[name,method,cap,ownerName]of roleBuilders){
        const definition=builder('features/reading/'+name,method,ownerName);
        if(name==='ReaderControlPanel.ets'){
          const metrics={systemFontScale:1};
          const Header=selectedProductionMethods(file('features/reading/'+name),'ReaderControlPanel',['directoryHeaderScale'],{...resolvers,ReaderWindowCoordinator:{metrics:()=>metrics}});
          for(const module of['settings','appearance','search','directory'])for(const scale of scales){metrics.systemFontScale=scale;
            const owner=Object.assign(new Header(),{readerWindowMetricsRevision:0,contentLocation:()=>({module})});
            finiteNatural(definition,module==='directory'?scale:cap,owner);
          }
        }else if(name==='ReaderBookmarkRow.ets'){
          const metrics={systemFontScale:1};
          const Bookmark=selectedProductionMethods(file('features/reading/'+name),'ReaderBookmarkRow',['fontScale'],{...resolvers,ReaderWindowCoordinator:{metrics:()=>metrics}});
          for(const scale of scales){metrics.systemFontScale=scale;finiteNatural(definition,scale,Object.assign(new Bookmark(),{readerWindowMetricsRevision:0}));}
        }else finiteNatural(definition,cap);
      }
      const capsule=builder('features/reading/ReaderSessionCapsule.ets','build','ReaderSessionCapsule');
      const capsuleValues=selectedProductionValues(file('features/reading/ReaderSessionCapsule.ets'),['READER_SESSION_CAPSULE_HEIGHT']);
      assert.ok(calls(capsule,'constraintSize').some(call=>{const min=property(call.arguments[0],'minHeight');return min&&evaluate(min,capsule.tree,{},capsuleValues)===capsuleValues.READER_SESSION_CAPSULE_HEIGHT;}),'outer clipped capsule grows naturally');
      const result=builder('features/reading/ReaderControlSearchContent.ets','resultRow');
      const columns=visit(result.node,n=>(ts.isCallExpression(n)||ts.isEtsComponentExpression(n))&&ts.isIdentifier(unwrap(n.expression))&&unwrap(n.expression).text==='Column');
      assert.ok(columns.some(call=>{const space=property(call.arguments[0],'space');return space&&evaluate(space,result.tree)===9;}));
      assert.equal(calls(result,'position').length,1,'one shared flow origin');
      assert.equal(calls(builder('features/reading/ReaderControlSearchContent.ets','resultSnippet'),'position').length,0);
      const bookmark=builder('features/reading/ReaderBookmarkRow.ets','motionBody');
      const bookmarkMetrics={systemFontScale:1};
      const Bookmark=selectedProductionMethods(file('features/reading/ReaderBookmarkRow.ets'),'ReaderBookmarkRow',['fontScale'],{...resolvers,ReaderWindowCoordinator:{metrics:()=>bookmarkMetrics}});
      const {sampleReaderControlBookmark}=await import('../entry/src/main/ets/features/reading/ReaderControlBookmarkGeometry.ts');
      const capCalls=calls(bookmark,'maxFontScale');assert.equal(capCalls.length,7,'chapter/pending/two metadata placements/excerpt bounded');
      for(const scale of scales){bookmarkMetrics.systemFontScale=scale;const owner=Object.assign(new Bookmark(),{readerWindowMetricsRevision:0});
        for(const call of capCalls)assert.equal(evaluate(call.arguments[0],bookmark.tree,owner),scale);
        for(const progress of[0,.5,1]){const frame=sampleReaderControlBookmark(progress,320,scale);
          assert.ok(frame.excerpt.y+frame.excerpt.height<frame.divider.y,'current scaled excerpt ends before divider');
          assert.ok(frame.divider.y+frame.divider.height<=frame.card.height,'current divider remains inside clip');
          assert.ok(frame.metadata.y+frame.metadata.height<=frame.excerpt.y,'large-font metadata is reserved before excerpt');
        }
      }
      near(9.09375+13.2*1.3+9+27.9*1.3,71.52375);assert.ok(12+18*1.6<42);
      for(const id of ['source-management-filter','source-management-more','search-task-status'])headerReceipt(id);
      for(const[path,method]of [['features/bookshelf/ShelfBookListDetails.ets','build'],['features/bookshelf/BookshelfMultiSelectPage.ets','selectionTopBar'],['features/common/ReaderSectionHeading.ets','build'],['features/manga/MangaReadingSurface.ets','sheetChoice']])assert.ok(hasMinimum(builder(path,method)),path+' natural height');
      const path='features/reading/ReaderControlSearchContent.ets',source=read(path),cap=calls(result,'maxFontScale')[0].arguments[0];
      const replace=value=>source.slice(0,cap.getStart(result.tree))+value+source.slice(cap.end);
      finiteNatural(builder(path,'resultRow',undefined,replace('(1 + .3)')),1.3);
      assert.throws(()=>finiteNatural(builder(path,'resultRow',undefined,replace('10')),1.3),/finite cap/);
    } else if (id === 'wiring') {
      const { sampleReaderControlAppearance } = await import('../entry/src/main/ets/features/reading/ReaderControlAppearanceGeometry.ts');
      const Appearance = selectedProductionMethods(file('features/reading/ReaderControlAppearanceContent.ets'), 'ReaderControlAppearanceContent', ['quickThemeHitWidth']);
      for (const [width, lane, hit] of [[262, 58.5, 58.5], [216, 43.166666666666664, 62.5]]) {
        const frame = sampleReaderControlAppearance(0, width, 666), owner = Object.assign(new Appearance(), { frame: () => frame });
        near(frame.quickThemeLane, lane); near(owner.quickThemeHitWidth(), hit);
        if (width === 262) { near((62.5 - hit) / 2, 2); assert.ok(hit >= 44 && hit <= lane); }
        else assert.equal(hit, 62.5, '320 remains explicitly unresolved; do not shrink or disable its target');
      }
      const theme = builder('features/reading/ReaderControlAppearanceContent.ets', 'themeSwatch');
      const regions=calls(theme,'responseRegion');assert.equal(regions.length,1);
      for(const full of[false,true])for(const width of[262,216]){
        const frame=sampleReaderControlAppearance(0,width,666),owner=Object.assign(new Appearance(),{fullInput:()=>full,frame:()=>frame});
        const actual=evaluate(regions[0].arguments[0],theme.tree,owner,{index:0});
        near(actual.width,full?frame.themeShells[0].width:owner.quickThemeHitWidth());near(actual.x,full?-(frame.themeShells[0].width-62.5)/2:(62.5-owner.quickThemeHitWidth())/2);assert.equal(actual.height,44);
      }
      const Shelf = selectedProductionMethods(file('features/bookshelf/BookshelfPage.ets'), 'BookshelfPage',
        ['listRowHeight', 'projectionRowHeight', 'projectionBookHeight', 'projectionBookTranslateY', 'projectionCoverCompensationY'],
        { ...budgets, TOK_SPACE_CONTROL_INLINE: 10 });
      for (const scale of scales) {
        const height = [72, 89, 107][scales.indexOf(scale)], owner = Object.assign(new Shelf(), {
          listCoverHeight: () => 72, continueCardFontScale: () => scale, gridBookCardHeight: () => 200,
          projectionListProgress: () => 1, bookCardHeight: () => 200, shelfBookCardWidth: () => 100 });
        assert.equal(owner.listRowHeight(false), height);
        assert.equal(owner.projectionRowHeight([{}, {}], false, 0), height * 2 + 10);
        assert.equal(owner.projectionBookHeight({}, false, 0), height);
        assert.equal(owner.projectionBookTranslateY(1, false, 0), height + 10);
        assert.equal(owner.projectionCoverCompensationY(false, 0), -(200 - height) / 2);
      }
      const details=builder('features/bookshelf/BookshelfPage.ets','projectionListDetails');
      const heights=calls(details,'height');
      for(const expandedLayout of[false,true]){const receipts=[];const owner={listRowHeight:value=>{receipts.push(value);return 107;}};
        assert.ok(heights.some(call=>evaluate(call.arguments[0],details.tree,owner,{expandedLayout})===107));assert.deepEqual(receipts,[expandedLayout],'actual projection height forwards layout to current owner');}
    }
    recordContractCasePass(id);
  }
  } finally {resolver.deregister();}
}
