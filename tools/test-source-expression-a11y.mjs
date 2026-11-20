import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  'source-semantics': 'Actual Source caller + shared SDK button/toggle/header/icon: explicit single-choice state, default action compatibility, entity/busy/disabled labels and real named header/import callbacks. No screen reader/focus proof.',
  contrast: 'Existing contrast arithmetic applied to actual current SDK metadata Text output and opaque day/night roles; formatting equivalent passes and old muted output fails. No pixel/font rasterization claim.',
});
if (selected.length) {
  const resolution = registerHooks({ resolve(specifier, context, next) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
      const url = new URL(specifier + '.ts', context.parentURL);
      if (existsSync(fileURLToPath(url))) return next(url.href, context);
    }
    return next(specifier, context);
  } });
  try {
  const { createReaderComponentProbe: createReaderBuilderProbe } = await import('./lib/reader-component-probe.mjs');
  const { readerSourceCategoryLabel } = await import('../entry/src/main/ets/features/source/ReaderSourceCategory.ts');
  const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
  const sourceFile = new URL('../entry/src/main/ets/features/source/SourceManagementPage.ets', import.meta.url);
  const source = readFileSync(sourceFile,'utf8');
  const book = { sourceId:'https://a.test',name:'甲书源',baseUrl:'https://a.test',category:'novel',enabled:true,checkState:'unchecked' };
  const semanticNode = (controls, child) => controls.nodes(child).find(node=>node.accessibilityRole!==undefined);
  async function headerAndImportSemantics() {
    const { iconButtonControls } = await import('./lib/reader-icon-button-probe.mjs');
    const { builderComponentMembers: boundedMembers } = await import('./lib/ets-builder-probe.mjs');
    const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
    const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
    const { productionReaderPressFeedback } = await import('./lib/reader-press-feedback-probe.mjs');
    const { readerFoundationTokens } = await import('./lib/reader-foundation-control-probe.mjs');
    const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
    const fonts = await import('../entry/src/main/ets/features/common/ReaderFontFamilies.ts');
    const headerMetrics = await import('../entry/src/main/ets/features/common/ReaderHeaderMetrics.ts');
    const visual = await import('../entry/src/main/ets/features/manga/MangaDirectoryVisual.ts');
    const read = file => readFileSync(new URL('../entry/src/main/ets/' + file, import.meta.url), 'utf8');
    const { readerScaledBarHeight } = pureModuleProbe(read('features/common/ReaderSurfaceResolvers.ts'),
      'ReaderSurfaceResolvers.ts', {}, ['readerScaledBarHeight']);
    const { MangaDirectoryPressFeedback } = pureModuleProbe(read('features/manga/MangaDirectoryPressFeedback.ets'),
      'MangaDirectoryPressFeedback.ets', { ...visual,
        LengthMetrics: { vp: value => value }, ColorMetrics: { resourceColor: value => value } }, ['MangaDirectoryPressFeedback']);
    const headerSource = read('features/common/PageBackBar.ets');
    const { root, require } = installedEtsCompiler(), syntax = require(root + '/lib/validate_ui_syntax.js');
    const previous = syntax.builderParamObjectCollection.get('PageBackBar');
    syntax.builderParamObjectCollection.set('PageBackBar', new Set(['trailing']));
    try {
      for (const scheme of ['day','night']) {
        const icons = iconButtonControls();
        const deps = { ...icons.dependencies, ...readerFoundationTokens, ...readerTypographyRoles,
          ...fonts, ...headerMetrics, readerAppColor, readerScaledBarHeight, MangaDirectoryPressFeedback,
          ReaderWindowCoordinator: { metrics: () => ({ systemFontScale: 1 }) },
          readerInteractiveSafeLeft: () => 0, readerInteractiveSafeRight: () => 0,
          // Shadow/veil paint and native insets are not evidence of this named-action case.
          readerSurfaceElevation: () => undefined,
          ReaderRaisedSurface: class { constructor() { assert.fail('fixed default header must not mount raised paint'); } },
        };
        const hooks = { ...icons.hooks, childSources: { ...icons.hooks.childSources,
          PageBackBar: headerSource, ReaderRaisedSurface: read('features/common/ReaderRaisedSurface.ets') } };
        deps.PageBackBar = createReaderBuilderProbe(headerSource, boundedMembers(headerSource), deps, hooks).Component;
        const page = createReaderBuilderProbe(source, ['backBar'], deps, hooks).owner;
        const events = [];
        Object.assign(page, { appThemeScheme: scheme, onBack: () => events.push('back'), openTools: () => events.push('tools') });
        page.backBar();
        const back = icons.nodes(page).find(node => node.accessibilityText === '返回');
        const tools = icons.nodes(page).find(node => node.accessibilityText === '书源工具');
        for (const node of [back, tools]) {
          assert.ok(node); assert.equal(node.accessibilityRole, 'AccessibilityRoleType.BUTTON');
          assert.equal(node.focusable, true); node.onClick();
        }
        assert.deepEqual(events, ['back','tools']);

        class FieldPort { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
        const fieldHooks = { ...icons.hooks, childSources: { ...icons.hooks.childSources,
          ReaderSearchField: read('features/common/ReaderSearchField.ets') } };
        const search = createReaderBuilderProbe(source, ['searchField'], { ...deps,
          ReaderSearchField: FieldPort, ReaderPressFeedback: productionReaderPressFeedback({}) }, fieldHooks).owner;
        Object.assign(search, { appThemeScheme: scheme, searchQuery: '', contentFrame: () => ({ width: 328 }),
          rebuildSourceProjection() {}, onAddSource: () => events.push('import') });
        search.searchField();
        const target = icons.nodes(search).find(node => node.accessibilityText === '导入书源');
        assert.ok(target); assert.equal(target.accessibilityRole, 'AccessibilityRoleType.BUTTON');
        assert.equal(target.focusable, true); target.onClick(); assert.equal(events.at(-1), 'import');
      }
    } finally {
      if (previous === undefined) syntax.builderParamObjectCollection.delete('PageBackBar');
      else syntax.builderParamObjectCollection.set('PageBackBar', previous);
    }
  }
  async function semantics() {
    const { foundationControls } = await import('./lib/reader-foundation-control-probe.mjs');
    const { switchControls } = await import('./lib/reader-switch-control-probe.mjs');
    const actor = (names, controls = foundationControls()) => ({ controls,
      page:createReaderBuilderProbe(source,names,{...controls.dependencies,readerSourceCategoryLabel,
        ScrollDirection:{Horizontal:'horizontal'},BarState:{Off:'off'}},controls.hooks).owner });
    for (const [specId, explicit, primary, expectedRole] of [
      ['source-action',false,true,'AccessibilityRoleType.BUTTON'],
      ['source-management-status-wide',true,true,'AccessibilityRoleType.RADIO'],
      ['source-management-status-wide',true,false,'AccessibilityRoleType.RADIO'],
      ['source-filter-option',false,true,'AccessibilityRoleType.RADIO'],
    ]) {
      const controls=foundationControls();
      const instance=new controls.button.Component(undefined,{scheme:'day',specId,label:'示例',primary,
        selectionSemantic:explicit,actionEnabled:true},undefined,1);
      instance.aboutToAppear(); instance.initialRender();
      const node=semanticNode(controls,instance); assert.ok(node);
      assert.equal(node.accessibilityRole,expectedRole);
      if(expectedRole.endsWith('RADIO'))assert.equal(node.accessibilitySelected,primary);
      else assert.equal(node.accessibilitySelected,undefined,'visual primary does not turn an ordinary action into a selection');
    }
    for(const [active,enabled] of [[true,true],[false,true],[false,false]]) {
      const {controls,page}=actor(['chip']); Object.assign(page,{appThemeScheme:'day',statusValue:active?'未检测':'全部',filterControlWidth:()=>328});
      page.chip(enabled?'未检测':'自定义',72,enabled);
      const child=[...page.children.values()].find(value=>value instanceof controls.button.Component); assert.ok(child);
      const node=semanticNode(controls,child); assert.equal(node.accessibilityRole,'AccessibilityRoleType.RADIO');
      assert.equal(node.accessibilitySelected,active); assert.equal(node.enabled,enabled);
      assert.match(node.accessibilityText,/书源状态/); if(!enabled)assert.match(node.accessibilityText,/暂不可用/);
    }
    {
      const {controls,page}=actor(['categoryFilter']); Object.assign(page,{appThemeScheme:'day',categoryValue:'music',contentFrame:()=>({width:328}),layoutBudget:()=>({filterHeight:44})});
      page.categoryFilter(); const children=[...page.children.values()].filter(value=>value instanceof controls.button.Component);
      assert.equal(children.length,7);assert.equal(children.filter(value=>semanticNode(controls,value).accessibilitySelected===true).length,1);
      for(const child of children)assert.match(semanticNode(controls,child).accessibilityText,/书源类型/);
    }
    for(const [checkState,blocked,unknown] of [['unchecked',false,false],['checking',false,false],['unchecked',true,true]]) {
      const {controls,page}=actor(['detectButton','loginButton','sourceActionLabel','sourceActionEnabled','sourceDetectEnabled']);
      const current={...book,checkState};Object.assign(page,{mounted:true,temporaryBackIdentity:'a11y-current',sources:[current],appThemeScheme:'day',
        operation:{original:{blocked},receipt:{receipt:{confirmation:unknown?'unknown':'confirmed'}}}});
      page.detectButton(current);page.loginButton(current);
      const children=[...page.children.values()].filter(value=>value instanceof controls.button.Component);assert.equal(children.length,2);
      for(const child of children){const node=semanticNode(controls,child);assert.match(node.accessibilityText,/甲书源/);assert.equal(node.accessibilityRole,'AccessibilityRoleType.BUTTON');
        if(checkState==='checking'){assert.match(node.accessibilityText,/忙碌/);assert.equal(node.enabled,false);}
        else if(child.specId==='source-management-login'&&blocked){assert.match(node.accessibilityText,/暂不可用/);assert.equal(node.enabled,false);}
        else assert.equal(node.enabled,true);
      }
    }
    for(const value of [true,false]) {
      const controls=switchControls(),{page}=actor(['sourceSwitch','sourceActionEnabled','sourceToggleBusy'],controls);
      Object.assign(page,{mounted:true,temporaryBackIdentity:'a11y-toggle',operation:{}});
      page.sourceSwitch(value,()=>{},book.sourceId,book.name);
      const node=controls.nodes(page).find(node=>node.accessibilityRole==='AccessibilityRoleType.SWITCH');assert.ok(node);
      assert.equal(node.accessibilityChecked,value);assert.match(node.accessibilityText,/甲书源.*启用书源/);
    }
    await headerAndImportSemantics();
    console.log(JSON.stringify({filterCategories:7,entityStates:3,sharedDefaultUnchanged:true,boundary:'SDK declarations only; native screen reader/focus and hit dispatch NOT_RUN'}));
  }
  async function contrastAudit() {
    const { selectedProductionValues }=await import('./lib/selected-production-methods.mjs');
    const { readerAppColor }=await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
    const { contrast }=selectedProductionValues(new URL('evidence/night-colors-20261020/reading-manga-probe.mjs',import.meta.url),['rgb','luminance','contrast']);
    const rgb=color=>{assert.match(color,/^#(?:FF)?[0-9A-F]{6}$/i,'this proof only supports opaque generated colors');return color.length===9?'#'+color.slice(3):color;};
    const results=[];
    for(const scheme of ['day','night']) for(const background of ['TOK_PAPER','TOK_CARD_BG','TOK_SURFACE_SOLID']) {
      const ratio=contrast(rgb(readerAppColor('TOK_CONTROL_INK',scheme)),rgb(readerAppColor(background,scheme)));
      assert(ratio>=4.5,`${scheme}/${background} source metadata is >=4.5:1`);results.push({scheme,background,ratio});
    }
    const old=contrast(rgb(readerAppColor('TOK_MUTED','day')),rgb(readerAppColor('TOK_PAPER','day')));
    assert(old<4.5,'the current old muted-on-paper finding is reproduced rather than copied');
    const role=readerTypographyRoles.TYPE_SOURCE_TOOLS_STATUS;
    const verifyMetadata=definition=>{
      for(const scheme of ['day','night']) {
        const value={...book,checkMessage:'检测摘要',checkState:'passed'};
        const owner=createReaderBuilderProbe(definition,['sourceInfo'],{...readerTypographyRoles,readerAppColor,readerSourceCategoryLabel,TOK_SPACE_XS:8}).owner;
        Object.assign(owner,{appThemeScheme:scheme,fontScale:()=>1,layoutBudget:()=>({rowForm:'inline',textMinWidth:120})});owner.sourceInfo(value);
        for(const text of [readerSourceCategoryLabel(value.category),value.baseUrl,value.checkMessage]){
          const node=[...owner.nodes.values()].find(node=>node.type==='Text'&&node.create===text);assert.ok(node);
          assert.ok(node.fontSize>=12&&node.lineHeight>=18,'actual metadata keeps readable declared type');
          for(const background of ['TOK_PAPER','TOK_CARD_BG','TOK_SURFACE_SOLID'])
            assert.ok(contrast(rgb(node.fontColor),rgb(readerAppColor(background,scheme)))>=4.5,'actual metadata contrast');
        }
      }
    };
    verifyMetadata(source);
    const equivalent=source.replaceAll("readerAppColor('TOK_CONTROL_INK', this.appThemeScheme)",'readerAppColor(\n"TOK_CONTROL_INK",this.appThemeScheme\n)');
    assert.notEqual(equivalent,source);verifyMetadata(equivalent);
    const {installedEtsCompiler}=await import('./lib/ets-compiler-runtime.mjs'),{ts,options}=installedEtsCompiler();
    const tree=ts.createSourceFile('SourceMetadataContrast.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
    assert.deepEqual(tree.parseDiagnostics,[]);const member=tree.statements.find(node=>node.name?.text==='SourceManagementPage').members.find(node=>node.name?.text==='sourceInfo'),targets=[];
    const visit=node=>{if(ts.isCallExpression(node)&&node.expression.getText(tree)==='readerAppColor'&&node.arguments[0]?.text==='TOK_CONTROL_INK')targets.push(node.arguments[0]);ts.forEachChild(node,visit);};visit(member);assert.equal(targets.length,3);
    let muted=source;for(const node of targets.sort((a,b)=>b.pos-a.pos))muted=muted.slice(0,node.getStart(tree))+"'TOK_MUTED'"+muted.slice(node.end);
    assert.throws(()=>verifyMetadata(muted),/actual metadata contrast/,'old low-contrast metadata output is rejected even if private formatting changes');
    console.log(JSON.stringify({oldDayMutedOnPaper:old,metadataRole:{fontSize:role.fontSizeFp,lineHeight:role.lineHeightFp},results,
      boundary:'Opaque generated role contrast; no native glyph/font or rasterized pixel evidence'}));
  }
  const cases={'source-semantics':semantics,contrast:contrastAudit};
  for(const id of selected){await cases[id]();recordContractCasePass(id);}
  } finally { resolution.deregister(); }
}
