import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const definitions = {
  'action-admission': { description: 'Actual v9 source row and Dock actions, including retired and busy callbacks' },
  'responsive-chip': { description: 'Actual v9 status filter, equal lanes and bounded single-line labels' },
  'trailing-tools': { description: 'Actual shared trailing icon opens the four v9 menu actions' },
  'status-badge-semantics': { description: 'Source v9 detection facts and shared RSS/Settings badge semantics' },
};
const selected = selectContractCases(definitions);
if (selected.length > 0) registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
    const url = new URL(specifier + '.ts', context.parentURL);
    if (existsSync(url)) return next(url.href, context);
  }
  return next(specifier, context);
} });

for (const id of selected) {
  if (id === 'status-badge-semantics') await runStatusBadgeSemantics();
  else await runSourceControls(id);
  recordContractCasePass(id);
}

async function runSourceControls(selectedCase) {
const { default: assert } = await import('node:assert/strict');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
const { boundedMembers, boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { labeledIconControls } = await import('./lib/reader-labeled-icon-action-probe.mjs');
const { iconButtonControls } = await import('./lib/reader-icon-button-probe.mjs');
const { sourceV9ReportTone, sourceV9ReportFill } = await import('../entry/src/main/ets/features/source/presentation/SourceManagementV9.ts');
const { readerAppColor } = await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
const readerFonts = await import('../entry/src/main/ets/ui/foundation/ReaderFontFamilies.ts');
const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
const { readerActionIcon } = boundedSurfaceSdk().deps;
const read = path => readFileSync(new URL('../entry/src/main/ets/' + path, import.meta.url), 'utf8');
const source = read('features/source/ui/SourceManagementPage.ets');
const chrome = read('features/source/ui/SourceV9Chrome.ets');
const controls = labeledIconControls();
const deps = { ...controls.dependencies, ...readerFonts, ...readerTypographyRoles, readerAppColor, readerActionIcon,
  sourceV9ReportTone, sourceV9ReportFill, LengthMetrics: { vp: value => value },
  Placement: { BottomRight: 'Placement.BottomRight' },
  ReaderUIVerificationProbe: { enabled: () => false },
  readerLayoutCarrierResponseRegion: () => ({}) };
const hooks = { ...controls.hooks, childSources: { ...controls.hooks.childSources, SourceV9DetectButton: chrome } };
deps.SourceV9DetectButton = createReaderBuilderProbe(chrome, boundedMembers(chrome, 'SourceV9DetectButton'),
  deps, { ...hooks, componentName: 'SourceV9DetectButton' }).Component;
const pageMembers = ['appThemeScheme', 'mounted', 'inputEnabled', 'temporaryBackIdentity', 'projectedSources', 'sources',
  'batchMode', 'batchSourceIds', 'onAddSource', 'onV9Action', 'onDetectSource', 'onLoginSource',
  'managementInputIsCurrent', 'managementOpeningIsCurrent', 'managementBackIsCurrent', 'isOpeningCurrent',
  'isInputAllowed', 'appForeground', 'groupOpen'];
function page(members, scheme, extra = {}) {
  const owner = createReaderBuilderProbe(source, [...new Set([...pageMembers, ...members])], deps, hooks).owner;
  Object.assign(owner, { appThemeScheme: scheme, mounted: true, inputEnabled: true, appForeground: true,
    temporaryBackIdentity: 'source-v9-controls', isOpeningCurrent: () => true, isInputAllowed: () => true,
    contentFrame: () => ({ width: 322 }), onToolsEntryFocused() {}, onToolsEntryLayout() {},
    scheduleImportStatusReadyObservation() {}, rebuildSourceProjection() {},
    offlineDetectBadgeId: () => '', verificationRowActionsCurrent: () => false, verificationRowTextId: () => '',
    sourceActionEnabled: () => true, ...extra });
  return owner;
}
let count = 0;
if(selectedCase==='action-admission') {
 // The historical hand-painted banner is not a production consumer. Preserve
 // its artifact as history; replace only its obsolete samples with the real
 // retained-list action, empty failure page and post-import status action.
 assert.doesNotMatch(source,/\bstatusBanner\b/,'retired private banner has no production definition or reference');
 const {sourceManagementRecoveryProbe,sourceRecoveryNativeAction}=await import('./lib/source-management-recovery-probe.mjs');
 for(const scheme of ['day','night']) for(const kind of ['retained-read','empty-read','import-action']) {
  const calls=[],operation={action:'load',sourceId:'',readFacts:kind==='import-action'?undefined:
   {fact:'failed',generation:9,canRetry:true,message:'read unavailable'}};
  const projection=sourceManagementRecoveryProbe(source,{operation,statusKind:'error',statusMessage:'read unavailable',
   sources:kind==='retained-read'?[{sourceId:'recovery-source'}]:[],
   statusActionLabel:kind==='import-action'?'重新搜索':'',statusActionGeneration:9,
   onReconcile:g=>calls.push(['reconcile',g]),onRetryLoad:()=>calls.push(['read']),
   onStatusAction:g=>calls.push(['status',g])},{scheme});
  const action=sourceRecoveryNativeAction(projection,kind==='import-action'?'重新搜索':kind==='empty-read'?'重试':'刷新列表');
  action.onClick();assert.deepEqual(calls,[[kind==='import-action'?'status':'reconcile',9]],'actual '+kind+' callback/generation');
  const generation=action.actor.generation;action.actor.generation=generation+1;
  action.onClick();assert.equal(calls.length,1,'retained native callback cannot adopt a replacement generation');
  count++;
 }
}

if (selectedCase === 'action-admission') for (const scheme of ['day', 'night']) {
  const events = [];
  const owner = page(['rowPressed','rowPressKey','loginButton', 'loginInk', 'loginSurface', 'detectButton', 'sourceBadgeLabel',
    'sourceActionLabel', 'sourceDetectEnabled', 'sourceRowCommand', 'sourceRowIsCurrent', 'sourceRenderKey',
    'bottomActionBar', 'sourceAddIcon', 'importFocusId', 'toolsFocusId'], scheme, {
    onDetectSource: id => events.push(['detect', id]), onLoginSource: (id, url) => events.push(['login', id, url]),
    onAddSource: (...ids) => events.push(['import', ...ids]), footerStacked: () => false, footerControlHeight: () => 44,
    footerManageWidth: () => 112, layoutBudget: () => ({ footerHeight: 44 }), actionBottomInset: () => 0,
    hasReadableSources: true, prepareV9ListReturn: view => events.push(['enter', view]), observeV9ListEntry() {},
  });
  const book = { sourceId: 'exact-source', name: '测试书源', checkState: 'unchecked', loginUrl: 'https://source.test/login' };
  owner.mounted = false;
  owner.sources = [book];
  owner.mounted = true;
  owner.projectedSources = [book];
  owner.loginButton(book);
  owner.detectButton(book);
  const login = [...owner.nodes.values()].find(node => node.accessibilityText?.includes('登录，状态未知'));
  const detectActor = [...owner.children.values()].find(child => child instanceof deps.SourceV9DetectButton);
  const detect = controls.nodes(detectActor).find(node => node.type === 'Button' && node.onClick);
  assert.deepEqual([login.width, login.height, detect.width, detect.height], [58, 26, 28, 28]);
  assert.ok(controls.nodes(detectActor).some(node => node.type === 'Image' && node.create === 'app.media.source_v9_wave'));
  login.onClick();
  detect.onClick();
  owner.groupOpen = true;
  login.onClick();
  detect.onClick();
  owner.groupOpen = false;
  owner.projectedSources = [{ ...book, loginUrl: 'https://source.test/replaced' }];
  login.onClick();
  detect.onClick();
  assert.deepEqual(events.splice(0), [['login', book.sourceId, book.loginUrl], ['detect', book.sourceId]]);

  const checking = { ...book, checkState: 'checking' };
  owner.mounted = false;
  owner.sources = [checking];
  owner.mounted = true;
  owner.projectedSources = [checking];
  owner.detectButton(checking);
  const busy = [...owner.children.values()].findLast(child => child instanceof deps.SourceV9DetectButton);
  assert.equal(controls.nodes(busy).find(node => node.type === 'Button').enabled, false);
  assert.ok(controls.nodes(busy).some(node => node.type === 'LoadingProgress'));

  owner.bottomActionBar();
  const manage = [...owner.children.values()].find(child => child.specId === 'source-management-manage');
  const add = [...owner.children.values()].find(child => child.specId === 'source-management-add');
  assert.equal(add.label, '导入书源');
  const addHit = controls.nodes(add).find(node => node.type === 'Button' && node.onClick);
  const manageHit = controls.nodes(manage).find(node => node.type === 'Button' && node.onClick);
  addHit.onClick();
  assert.deepEqual(events.splice(0), [['import', 'source-v9-controls:import:footer', 'source-v9-controls:tools:header']]);
  owner.temporaryBackIdentity = 'replacement';
  addHit.onClick();
  assert.deepEqual(events, [], 'old Dock callback is fenced by its opening identity');
  manageHit.onClick();
  assert.deepEqual(events.splice(0), [['enter', 'batch']]);
  assert.equal(owner.batchMode, true);
  owner.mounted = false;
  detect.onClick();
  assert.deepEqual(events, []);
  count += 2;
}

if (selectedCase === 'responsive-chip') for (const width of [280, 322, 440, 680]) {
  const owner = page(['statusFilter', 'chip', 'statusCount', 'statusCounts', 'statusValue', 'filterTextLayoutOptions'], 'day', {
    contentFrame: () => ({ width }), statusCounts: { all: 12345, enabled: 90, disabled: 12, abnormal: 6 },
    statusValue: '全部', filterTextLayoutOptions: () => undefined,
  });
  owner.statusFilter();
  const nodes = [...owner.nodes.values()];
  const chips = nodes.filter(node => node.type === 'Button');
  assert.deepEqual(chips.map(node => [node.layoutWeight, node.height]), Array(4).fill([1, 32]));
  assert.ok(nodes.filter(node => node.type === 'Text').every(node => node.maxLines === 1));
  assert.deepEqual(nodes.filter(node => node.type === 'Text').map(node => node.create), ['全部 12345', '已启用 90', '已停用 12', '异常 6']);
  assert.equal(nodes.find(node => node.id === 'reader-source-status-filter').width, width);
  count++;
}

if (selectedCase === 'trailing-tools') for (const scheme of ['day', 'night']) {
  const { require, root } = installedEtsCompiler();
  const syntax = require(root + '/lib/validate_ui_syntax.js');
  syntax.builderParamObjectCollection.set('PageBackBar', new Set(['trailing']));
  const Icon = iconButtonControls({ properties: controls.properties }).icon.Component;
  class Back {
    constructor(owner, params) { Object.assign(this, { owner }, params); }
    initialRender() {}
  }
  deps.ReaderIconButton = Icon;
  deps.PageBackBar = Back;
  hooks.childSources.ReaderIconButton = read('ui/controls/ReaderIconButton.ets');
  hooks.childSources.PageBackBar = read('ui/chrome/PageBackBar.ets');
  const events = [];
  const owner = page(['backBar', 'sourceMorePopup', 'sourceMoreMenu', 'sourceMoreAction', 'sourceMoreIcon',
    'moreMenuOpen', 'toolsFocusId', 'visibleIds', 'projectedSourceCount'], scheme, {
    onBack() {}, projectedSourceCount: 1, projectedSources: [{ sourceId: 'a' }],
    prepareV9ListReturn: view => events.push(['return', view]), onV9Action: (action, ids) => events.push([action, ids]),
  });
  owner.backBar();
  [...owner.children.values()].find(child => child instanceof Back).trailing();
  const icon = [...owner.children.values()].find(child => child instanceof Icon);
  const hit = controls.nodes(icon).find(node => node.onClick);
  assert.ok(hit && controls.nodes(icon).some(node => node.type === 'Image'));
  hit.onClick();
  assert.equal(owner.moreMenuOpen, true);
  owner.sourceMorePopup().builder();
  const buttons = [...owner.nodes.values()].filter(node => node.type === 'Button' && node.id?.startsWith('reader-source-v9-open'));
  assert.deepEqual(buttons.map(node => node.id), ['subscriptions', 'groups', 'detect', 'export'].map(action => 'reader-source-v9-open-' + action));
  const check = buttons.find(node => node.id.endsWith('detect'));
  check.onClick();
  check.onClick();
  assert.deepEqual(events, [['detect', ['a']]], 'an already closed popup cannot dispatch a second action');
  count++;
}
console.log('PASS actual source v9 controls, fixtures ' + count);
}

async function runStatusBadgeSemantics(){
 const {default:assert}=await import('node:assert/strict');
 const {readFileSync}=await import('node:fs');
 const {installedEtsCompiler}=await import('./lib/ets-compiler-runtime.mjs');
 const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
 const {createArkUIPropertyRuntimeProbe}=await import('./lib/arkui-property-runtime-probe.mjs');
 const {boundedMembers}=await import('./lib/bounded-surface-sdk-probe.mjs');
 const {selectedProductionMethods}=await import('./lib/selected-production-methods.mjs');
 const {verifySharedProducerInputCalls}=await import('./lib/shared-producer-inputs.mjs');
 const {readerAppColor}=await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
 const {sourceV9ReportTone}=await import('../entry/src/main/ets/features/source/presentation/SourceManagementV9.ts');
 const root=new URL('../entry/src/main/ets/',import.meta.url),file=path=>new URL(path,root),read=path=>readFileSync(file(path),'utf8');
 const badgePath='ui/controls/StatusBadge.ets',badgeSource=read(badgePath),{ts,options}=installedEtsCompiler();
 function open(status,label,scheme='day',density=1,source=badgeSource){
  const properties=createArkUIPropertyRuntimeProbe();
  const probe=createReaderBuilderProbe(source,boundedMembers(source),{...properties.sdk,readerAppColor,LineJoinStyle:{Round:'LineJoinStyle.Round'}},properties.hooks);
  const owner=new probe.Component(undefined,{status,label});
  Object.assign(owner,{appThemeScheme:scheme,getUIContext:()=>({vp2px:value=>value*density})});owner.initialRender();
  return {owner,properties,nodes:()=>[...owner.nodes.values()]};
 }
 function readable(f,label){
  const path=f.nodes().find(node=>node.type==='Path');assert.ok(path&&typeof path.commands==='string'&&path.commands.length>0,'status must have a visible non-color native path');
  const frame=f.nodes().find(node=>node.type==='Stack');assert.ok(frame);assert.equal(frame.width,24);assert.equal(frame.height,18);assert.equal(frame.borderRadius,6);
  assert.equal(frame.accessibilityText,label);assert.equal(frame.accessibilityGroup,true);
  assert.equal(path.width,12);assert.equal(path.height,12);assert.equal(path.accessibilityLevel,'no');
  assert.equal(f.nodes().some(node=>node.type==='Text'),false,'decorative mark is a graphic rather than font-scaled body text');
  assert.equal(f.nodes().some(node=>typeof node.onClick==='function'),false,'status stays read-only');return path;
 }
 const roles={success:['app.status.goodSoft','app.status.good'],error:['app.status.checkErrorSoft','app.status.checkError'],
  pending:['app.status.mutedSoft','app.status.mutedDot'],neutral:['app.status.mutedSoft','app.status.mutedDot'],
  enabled:['app.feed.enabledSurface','app.status.availableDot'],paused:['app.feed.disabledSurface','TOK_MUTED'],unknown:['app.status.mutedSoft','app.status.mutedDot']};
 const paths=new Set();
 for(const [status,[background,stroke]]of Object.entries(roles))for(const scheme of ['day','night']){
  const f=open(status,`当前${status}`,scheme),path=readable(f,`当前${status}`);paths.add(path.commands);
  assert.equal(f.nodes().find(node=>node.type==='Stack').backgroundColor,readerAppColor(background,scheme));assert.equal(path.stroke,readerAppColor(stroke,scheme));
  const dense=open(status,`当前${status}`,scheme,3),densePath=readable(dense,`当前${status}`);
  const numbers=text=>[...text.matchAll(/-?\d+(?:\.\d+)?/g)].map(match=>Number(match[0]));
  assert.deepEqual(numbers(densePath.commands),numbers(path.commands).map(value=>value*3),'native px commands scale from vp at actual density');
  assert.equal(path.strokeWidth,1.6);
  assert.ok(numbers(path.commands).every(value=>value-path.strokeWidth/2>=0&&value+path.strokeWidth/2<=12),'control points and complete stroke fit the existing graphic slot without a font clamp');
 }
 assert.equal(paths.size,7,'all admitted statuses have distinct non-color marks');
 const reactive=open('success','检查通过'),old=readable(reactive,'检查通过').commands;
 reactive.owner.updateStateVars({status:'error',label:'检查失败'});reactive.properties.flush();assert.notEqual(readable(reactive,'检查失败').commands,old);
 const densityRevision=open('pending','检查中'),densityBefore=readable(densityRevision,'检查中').commands;
 densityRevision.owner.getUIContext=()=>({vp2px:value=>value*3});densityRevision.owner.configurationRevision+=1;densityRevision.properties.flush();
 assert.notEqual(readable(densityRevision,'检查中').commands,densityBefore,'actual configuration revision refreshes the native density conversion');
 const colorOnly=badgeSource.replace('.commands(this.symbolPath())',".commands('')");assert.notEqual(colorOnly,badgeSource);
 assert.throws(()=>readable(open('success','检查通过','day',1,colorOnly),'检查通过'),/non-color native path/,'restoring color-only rendering must fail');
 function argument(path,ownerName,method,receiver,bindings,component='StatusBadge'){
  const source=read(path),tree=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);assert.deepEqual(tree.parseDiagnostics,[]);
  const owner=tree.statements.find(node=>node.name?.text===ownerName),member=owner.members.find(node=>node.name?.text===method);assert.ok(member);
  const calls=[];const visit=node=>{if((ts.isCallExpression(node)||ts.isEtsComponentExpression(node))&&node.expression.getText(tree)===component)calls.push(node.arguments[0]);ts.forEachChild(node,visit);};visit(member);assert.equal(calls.length,1);
  const js=ts.transpileModule('const value=('+calls[0].getText(tree)+');',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  return new Function(...Object.keys(bindings),js+';return value;').call(receiver,...Object.values(bindings));
 }
 const sourcePage='features/source/ui/SourceManagementPage.ets',rssPage='features/rss/ui/RssPage.ets',settingsPage='features/settings/ui/SettingsPage.ets';
 const Source=selectedProductionMethods(file(sourcePage),'SourceManagementPage',['rowPressed','rowPressKey','sourceBadgeLabel','sourceActionLabel'],{sourceV9ReportTone});
 const source=new Source();
 Object.assign(source,{verificationRowTextId:()=>'',offlineDetectBadgeId:()=>'',sourceDetectEnabled:()=>true,sourceRowCommand:()=>()=>{}});
 for(const [checkState,checkMaxLevel,tone,label]of [[undefined,undefined,'unverified','尚无有效检测报告'],
  ['checking',undefined,'unverified','检测中'],['passed','L2','partial','检测通过'],
  ['passed','L5','content','检测通过'],['failed','L3','earlyFailure','检测失败'],['failed','L5','deepFailure','检测失败']]){
  const checkReports=checkMaxLevel===undefined?[]:[{stale:false,report:{steps:[{
   level:checkMaxLevel,executed:true,status:checkState==='passed'?'pass':'fail',
  }]}}];
  const params=argument(sourcePage,'SourceManagementPage','detectButton',source,
   {source:{sourceId:'source',name:'书源',enabled:true,checkState,checkReports},sourceV9ReportTone},'SourceV9DetectButton');
  assert.equal(params.tone,tone);
  assert.equal(params.checking,checkState==='checking');
  assert.ok(params.label.includes(label));
 }
 const Rss=selectedProductionMethods(file(rssPage),'RssPage',['sourceBadgeStatus','sourceBadgeLabel']),rss=new Rss();
 for(const enabled of [true,false]){const params=argument(rssPage,'RssPage','sourceItem',rss,{sub:()=>({enabled})});assert.deepEqual(params,{status:enabled?'enabled':'paused',label:enabled?'订阅已启用':'订阅已暂停'});readable(open(params.status,params.label),params.label);}
 for(const label of ['文件访问','通知权限','电池优化']){const params=argument(settingsPage,'SettingsPage','permissionRow',{}, {label});assert.deepEqual(params,{status:'unknown',label:`${label}状态未查询`});readable(open(params.status,params.label),params.label);}
 for(const consumerFile of [rssPage,settingsPage]){
  const consumer=read(consumerFile),calls=verifySharedProducerInputCalls(badgeSource,consumer,{component:'StatusBadge',producerFile:badgePath,consumerFile});assert.equal(calls.length,1);assert.deepEqual(calls[0].keys.sort(),['label','status']);
  const wrong=consumer.replace('StatusBadge({','StatusBadge({ bg: "#fff",');assert.notEqual(wrong,consumer);assert.throws(()=>verifySharedProducerInputCalls(badgeSource,wrong,{component:'StatusBadge',producerFile:badgePath,consumerFile}),/illegal shared input bg/);
 }
 console.log('PASS actual native badge seven graphics/labels, density, reactive Props, Source facts, closed RSS/Settings compatibility and retired appearance negative controls; no device claim');
}
