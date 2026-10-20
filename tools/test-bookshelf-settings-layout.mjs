import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"settings-render": {"description": "实际shared header/toggle/mode当前callback与主题retained传播", "resources": []}, "read-state": {"description": "实际PageState按finite read facts/Promise busy与old-canRetry反例", "resources": []}, "mode-persistence": {"description": "实际mode owner commit/rollback/late准备和旧revision拒绝", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {


const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const {actualModeHost,readerRecoveryView} = await import('./lib/bookshelf-view-mode-probe.mjs');
const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createRequire } = await import('node:module');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const { boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { projectOperationFacts } = await import('../entry/src/main/ets/app/ReaderOperationFacts.ts');
const { SurfaceHorizontalFrame, SurfaceWidthSpec, resolveHorizontalFrame } = await import('../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts');
const { ReaderWindowMetricsSnapshot, ReaderRectVp, ReaderInsetsVp, readerVisualSafeLeft, readerVisualSafeRight,
  readerInteractiveSafeLeft, readerInteractiveSafeRight } = await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
const { READER_FLOATING_TOP_BAR_HEIGHT, readerFloatingBarBottomInset } = await import('./lib/reader-floating-bar-metrics-probe.mjs');
const { loadReaderTypographyRoles } = await import('./lib/reader-typography-probe.mjs');

const typographySource = readFileSync(new URL('../entry/src/main/ets/features/common/ReaderTypography.ets', import.meta.url), 'utf8');
const { TYPE_PAGE_TITLE } = loadReaderTypographyRoles(typographySource);
const file = new URL('../entry/src/main/ets/features/bookshelf/BookshelfSettingsPage.ets', import.meta.url);
const source = readFileSync(file, 'utf8');
const headerSource = readFileSync(new URL('../entry/src/main/ets/features/common/PageBackBar.ets', import.meta.url), 'utf8');
const require = createRequire(import.meta.url);
const sdk = resolveEtsLoaderRoot();
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
syntax.componentCollection.customComponents.add('PageBackBar');
syntax.componentCollection.customComponents.add('ReaderRecoveryNotice');
syntax.propCollection.set('ReaderRecoveryNotice',new Set(['view','actionLabel']));
syntax.propCollection.set('PageBackBar', new Set(['titleColor']));
class Header { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
let activeOwner, activeId;
const Toggle = new Proxy({ name: 'Toggle' }, { get: (target, key) => key === 'name' ? target.name : (...args) => {
  if (key !== 'pop') activeOwner.nodes.get(activeId)[key] = args.length === 1 ? args[0] : args;
} });
let metrics = new ReaderWindowMetricsSnapshot();
class Notice {constructor(owner,params,_s,id){Object.assign(this,{owner,params,id});}}
const deps = { readerRecoveryView,ReaderRecoveryNotice:Notice, PageBackBar: Header, Toggle, ToggleType: { Switch: 'switch' },
  ReaderWindowCoordinator: { metrics: () => metrics }, SurfaceHorizontalFrame, SurfaceWidthSpec, resolveHorizontalFrame,
  readerVisualSafeLeft, readerVisualSafeRight, readerInteractiveSafeLeft, readerInteractiveSafeRight,
  TOK_CONTENT_MAX_W_TABLET: 720, TOK_SCREEN_INSET: 19, TOK_SPACE_XS: 8, TOK_SPACE_MD: 16,
  READER_FLOATING_TOP_BAR_HEIGHT, readerFloatingBarBottomInset, TYPE_PAGE_TITLE };
const methods = ['settingsPending','modePending','pendingOverlay','retrySettingsAccepted','viewModeRecovery','build','settingsRecovery','settingsRecoveryIdentity','settingsRecoveryCurrent','retrySettingsRecovery', 'modeOption', 'pageContent', 'pageHeader'];
if (source.includes('private contentFrame(')) methods.push('contentFrame');
const { Component } = createReaderBuilderProbe(source, methods, deps,
  { onObserverEnter(owner, id) { activeOwner = owner; activeId = id; } });
const { Component: HeaderComponent } = createReaderBuilderProbe(headerSource, ['trailing', 'build', 'leftInset', 'rightInset'], deps);
if(selectedCase==='settings-render') {
for (const [width, height, left, right, safeBottom] of [[365, 320, 0, 0, 0], [390, 844, 32, 24, 24], [1280, 800, 48, 32, 48]]) {
  metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, width, height), undefined,
    new ReaderInsetsVp(0, 48, 0, safeBottom), new ReaderInsetsVp(left, 0, right, 0));
  const owner = new Component(undefined, {}); let backs = 0; const updates = [], selections = [];
  Object.assign(owner, { appThemeScheme: 'day', mode: 'cover', operation:{action:'load'}, viewModeSnapshot:{canonical:'cover'}, error: '', autoCheckUpdate: true,
    readerWindowMetricsRevision: 1, onBack: () => { backs++; }, onAutoCheckUpdate: value => updates.push(value),
    selectMode: value => selections.push(value) });
  owner.initialRender();
  const headers = [...owner.children.values()].filter(child => child instanceof Header);
  assert.equal(headers.length, 1, 'settings must mount the shared PageBackBar, not a private return/text row');
  assert.equal(headers[0].params.title, '书架设置');
  const header = new HeaderComponent(undefined, {});
  Object.assign(header, headers[0].params, { appThemeScheme: 'day', readerWindowMetricsRevision: 1, titleColor: '' });
  header.initialRender();
  const headerNodes = [...header.nodes.values()];
  const hit = headerNodes.find(node => node.type === 'Stack');
  void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */ hit.onClick(); assert.equal(backs, 1);
  const title = headerNodes.find(node => node.type === 'Text');
  assert.deepEqual([title.fontFamily, title.fontSize, title.lineHeight],
    [TYPE_PAGE_TITLE.fontFamily, TYPE_PAGE_TITLE.fontSizeFp, TYPE_PAGE_TITLE.lineHeightFp]);
  const headerRow = headerNodes.find(node => node.type === 'Row');
  assert.equal(headerRow.width,'100%'); assert.ok(headerRow.padding.left>=left && headerRow.padding.right>=right);
  const actors = current => [current, ...[...(current.children?.values() ?? [])].flatMap(actors)];
  const nodes = actors(owner).flatMap(current => [...(current.nodes?.values() ?? [])]);
  const root = nodes.find(node => node.type === 'Stack' && node.backgroundColor);
  assert.ok(root, 'the actual public scaffold paints the page');
  assert.equal(root.padding?.top, undefined, 'host alone consumes the top safe area');
  assert.equal(root.padding?.bottom, undefined, 'host alone consumes the bottom safe area');
  assert.equal(root.type, 'Stack');
  const scroll = nodes.find(node => node.type === 'Scroll');
  assert.ok(scroll); assert.equal(scroll.layoutWeight, undefined); assert.equal(scroll.align, 'Alignment.TopStart');
  assert.equal(scroll.height, '100%', 'the viewport extends behind the floating header even in short windows');
  const frame = resolveHorizontalFrame(width, left, right, new SurfaceWidthSpec(720, 19, 19));
  const content=nodes.find(node=>node.type==='Column' && Number.isFinite(node.padding?.top) && Number.isFinite(node.padding?.bottom));
  assert.ok(content); assert.equal(content.padding.left,frame.left); assert.equal(content.padding.right,frame.right); assert.ok(content.padding.bottom>=safeBottom);
  const toggle = nodes.find(node => node.type === 'Toggle');
  toggle.onChange(false); toggle.onChange(true); assert.deepEqual(updates, [false, true]);
  for (const label of ['封面', '列表']) nodes.find(node => node.type === 'Text' && node.create === label).onClick();
  assert.deepEqual(selections, ['cover', 'list']);
  for (const scheme of ['night', 'day']) {
    // StorageLink delivery is the platform seam: deliver one global scheme to
    // every retained public frame actor, then execute its real SDK observers.
    for (const actor of actors(owner)) { actor.appThemeScheme = scheme; actor.replay?.(); }
    header.appThemeScheme = scheme; header.replay();
    assert.equal(title.fontColor, readerAppColor('TOK_INK', scheme));
    assert.equal(root.backgroundColor, readerAppColor('TOK_PAPER', scheme));
    assert.equal(nodes.find(node => node.type === 'Text' && node.create === '封面').fontColor,
      readerAppColor('app.BookshelfSettingsPage.modeOption.onSelected', scheme));
  }
}
const retryOwner = new Component(undefined, {});
const retries=[];
Object.assign(retryOwner,{appThemeScheme:'day',mode:'cover',operation:{action:'load'},viewModeSnapshot:{canonical:'cover',receipt:{receipt:{confirmation:'unknown',readback:'idle'},facts:{fact:'pendingReconciliation',generation:9,canRetry:true,blocked:false}}},error:'pending',autoCheckUpdate:true,readerWindowMetricsRevision:1,
 viewModeRecovery:()=>({visible:true,message:'pending',canRetry:true,generation:9}),retryMode:g=>retries.push(g)});
retryOwner.initialRender();
const recovery=[...retryOwner.children.values()].find(c=>c instanceof Notice&&c.params.view?.visible);
recovery.params.onReconcile(9);assert.deepEqual(retries,[9],'visible recovery retains operation identity and reads only');

}
if(selectedCase==='read-state') {
// The real PageState/Action/native-loader tree must derive activity from finite
// facts, never from whether a recovery happens to be admitted.
function readStatePage(definition=source) {
  const sdk=boundedSurfaceSdk({allowEmptyBranchAdmission:true});
  const Model=sdk.consumer(definition,['operation','viewModeSnapshot','modeLoadBusy','modeReconcileBusy',
    'settingsPending','modePending','viewModeRecovery','pageContent','modeOption'],{readerRecoveryView}).constructor;
  return (facts,extra={})=>{
    const owner=new Model(undefined,{}),reads=[];
    Object.assign(owner,{appThemeScheme:'day',operation:{action:'load',readFacts:facts},viewModeSnapshot:{canonical:undefined,readFacts:facts},
      modeLoadBusy:false,modeReconcileBusy:false,onReconcile:(...args)=>reads.push(args),navigationGeneration:4,...extra});
    owner.pageContent();
    const states=sdk.walk(owner).filter(child=>child instanceof sdk.deps.ReaderPageState);
    assert.equal(states.length,2,'both missing values use their actual shared page-state consumer');
    return {sdk,owner,states,reads};
  };
}
const statePage=readStatePage();
let readStateCases=0;
for(const [phase,blockedReason,titleEnding] of [
  ['idle',undefined,'尚未读取'],['cancelled',undefined,'读取已取消'],['failed',undefined,'读取失败'],
  ['refreshFailed',undefined,'读取失败'],['notDispatched',undefined,'尚未读取'],['idle','CAPABILITY_UNAVAILABLE','暂不可用'],
]) {
  const facts=projectOperationFacts({phase,blockedReason,canRetry:false,generation:27,message:'当前读取不可用'});
  const x=statePage(facts);
  for(const state of x.states){
    assert.equal(state.loading,false,`${facts.fact} is quiet even without retry admission`);
    assert.equal(x.sdk.nodes(state).some(node=>node.type==='LoadingProgress'),false);
    assert.ok(state.title.endsWith(titleEnding));assert.equal(state.message,facts.message);
    assert.equal(x.sdk.nodes(state).some(node=>node.type==='Stack'&&node.onClick),false);
  }
  readStateCases++;
}
for(const phase of ['loading','refreshing']){
  const x=statePage(projectOperationFacts({phase,canRetry:false,generation:28}));
  for(const state of x.states){
    assert.equal(state.loading,true);assert.match(state.title,/^正在读取/);
    assert.ok(x.sdk.nodes(state).some(node=>node.type==='LoadingProgress'));
  }
  readStateCases++;
}
{
  const x=statePage(projectOperationFacts({phase:'failed',canRetry:true,generation:29,message:'读取失败，保留原失败事实'}));
  for(const state of x.states){assert.equal(state.loading,false);assert.equal(state.actionLabel,'重试');
    assert.ok(x.sdk.nodes(state).some(node=>node.type==='Stack'&&node.onClick));}
  x.sdk.nodes(x.states[0]).find(node=>node.type==='Stack'&&node.onClick).onClick();assert.deepEqual(x.reads,[[29,4]]);
  readStateCases++;
}
{
  const x=statePage(projectOperationFacts({phase:'idle'}),{modeReconcileBusy:true});
  assert.equal(x.states[0].loading,false);assert.equal(x.states[1].loading,true,'only the actually running mode query is busy');
  assert.ok(x.sdk.nodes(x.states[1]).some(node=>node.type==='LoadingProgress'));readStateCases++;
}
// Actual initial mode owner publishes no intermediate readFacts. The page's
// loadMode Promise is therefore the only legitimate local loading fact.
{
  const sdk=boundedSurfaceSdk({allowEmptyBranchAdmission:true});
  const actual=actualModeHost({loadBookshelfViewMode:()=>new Promise(resolve=>{finishLoad=resolve;})});
  let finishLoad;
  const page=sdk.consumer(source,['operation','viewModeSnapshot','modeLoadBusy','modeReconcileBusy','mounted','revision','mode',
    'settingsPending','modePending','viewModeRecovery','pageContent','modeOption','loadMode','applyModeSnapshot','modeFeedback','modePending','aboutToDisappear'],{readerRecoveryView});
  Object.assign(page,{mounted:true,revision:0,presentationRevision:0,appThemeScheme:'day',operation:{action:'load',readFacts:projectOperationFacts({phase:'idle'})},viewModeHost:actual,
    viewModeSnapshot:{canonical:undefined},lastModeFeedback:'',getUIContext:()=>({getPromptAction:()=>({showToast(){}})})});
  page.loadMode();assert.equal(page.modeLoadBusy,true);assert.equal(actual.current().readFacts,undefined);
  page.pageContent();const state=sdk.walk(page).find(child=>child instanceof sdk.deps.ReaderPageState&&child.title==='正在读取显示方式…');
  assert.equal(state.title,'正在读取显示方式…');assert.equal(state.loading,true);
  assert.ok(sdk.nodes(state).some(node=>node.type==='LoadingProgress'));
  finishLoad('cover');await new Promise(resolve=>setImmediate(resolve));assert.equal(page.modeLoadBusy,false);assert.equal(page.viewModeSnapshot.canonical,'cover');
  let finishRetired;page.viewModeHost=actualModeHost({loadBookshelfViewMode:()=>new Promise(resolve=>{finishRetired=resolve;})});
  page.loadMode();assert.equal(page.modeLoadBusy,true);page.aboutToDisappear();assert.equal(page.modeLoadBusy,false);
  const retained=page.viewModeSnapshot;finishRetired('list');await new Promise(resolve=>setImmediate(resolve));assert.equal(page.viewModeSnapshot,retained);
  assert.equal(page.modeLoadBusy,false,'retired load cannot reapply activity or value');
  const finishes=[];page.mounted=true;page.viewModeHost=actualModeHost({loadBookshelfViewMode:()=>new Promise(resolve=>finishes.push(resolve))});
  page.loadMode();page.loadMode();assert.equal(finishes.length,2);finishes[0]('cover');await new Promise(resolve=>setImmediate(resolve));
  assert.equal(page.modeLoadBusy,true,'old revision cannot clear the newer actual load');assert.equal(page.viewModeSnapshot,retained);
  finishes[1]('list');await new Promise(resolve=>setImmediate(resolve));assert.equal(page.modeLoadBusy,false);assert.equal(page.viewModeSnapshot.canonical,'list');
  readStateCases++;
}
for(const [from,to] of [
  ["loading: this.operation.readFacts?.fact === 'loading' || this.operation.readFacts?.fact === 'refreshing'","loading: this.operation.readFacts?.canRetry !== true"],
  ["loading: this.modeLoadBusy || this.modeReconcileBusy || this.viewModeSnapshot.readFacts?.fact === 'loading' || this.viewModeSnapshot.readFacts?.fact === 'refreshing'","loading: !this.viewModeRecovery().canRetry"],
]) {
  assert.ok(source.includes(from));const regression=readStatePage(source.replace(from,to));
  const x=regression(projectOperationFacts({phase:'cancelled',canRetry:false,message:'已取消'}));
  assert.throws(()=>x.states.forEach(state=>assert.equal(state.loading,false)),/true !== false/,'actual SDK counterexample rejects the former canRetry loading heuristic');
}
}
if(selectedCase==='mode-persistence') {
let persistedMode = 'cover';
let prepare = async () => {}, saved = [], load = async () => persistedMode,
  save = async mode => { saved.push(mode); persistedMode = mode; };
let fontRegistrations = 0;
const Model = productionMotionMethods(file, ['aboutToAppear', 'aboutToDisappear', 'persistRequestedMode', 'selectMode','viewModeRecovery','applyModeSnapshot','loadMode','retryMode','onOperationChanged','settingsPending','modePending','modeFeedback'], {
  readerRecoveryView, registerReaderFonts: () => { fontRegistrations++; }, ReaderThemeHost: { prepareUserChange: () => prepare() },
  WebDavCredentialStore: { instance: { currentBookshelfViewMode:()=>persistedMode, loadBookshelfViewMode: () => load(), saveBookshelfViewMode: mode => save(mode) } },
});
const mount = () => { const owner = Object.assign(new Model(), { mode: 'cover', revision: 0, presentationRevision:0, operation:{action:'load'}, lastSettingsFeedback:'', lastModeFeedback:'', error: '',
  getUIContext: () => ({ getFont: () => ({}) }),viewModeHost:actualModeHost({currentBookshelfViewMode:()=>persistedMode,loadBookshelfViewMode:()=>load(),saveBookshelfViewMode:mode=>save(mode)},()=>prepare()),viewModeSnapshot:{canonical:undefined} }); owner.aboutToAppear(); return owner; };
const settle = () => new Promise(resolve => setImmediate(resolve));
let owner = mount(); owner.selectMode('list'); assert.equal(owner.mode, 'list'); await settle();
assert.deepEqual(saved, ['list']); assert.equal(owner.confirmed, 'list'); assert.equal(fontRegistrations, 1);
save = async () => { throw new Error('disk'); }; owner.selectMode('cover'); await settle();
assert.equal(owner.mode, 'list', 'failed optimistic change rolls back to the confirmed persisted mode');
assert.equal(owner.viewModeSnapshot.receipt.receipt.confirmation,'unknown');assert.match(owner.error,/等待核对/); assert.equal(owner.requestedMode, 'cover');
load = async () => 'list'; owner=mount();owner.selectMode('cover'); await settle(); assert.equal(owner.mode, 'list');
prepare = async () => { throw new Error('BOOKSHELF_RESTORE_PENDING'); }; owner=mount();owner.selectMode('cover'); await settle();
assert.equal(owner.error, '请先在同步设置中重试未完成的恢复'); assert.equal(owner.mode, 'list');
let release; prepare = () => new Promise(resolve => { release = resolve; }); saved = [];
save = async mode => { saved.push(mode); }; owner = mount(); owner.selectMode('list');
await settle();owner.aboutToDisappear(); release(); await settle(); assert.deepEqual(saved, []); assert.equal(owner.error, '');
let firstRelease; let preparations = 0;
prepare = () => ++preparations === 1 ? new Promise(resolve => { firstRelease = resolve; }) : Promise.resolve();
load = async () => 'cover'; owner = mount(); owner.selectMode('list'); owner.selectMode('cover'); await settle();
firstRelease(); await settle();await settle(); assert.deepEqual(saved, ['cover']); assert.equal(owner.mode, 'cover');
}
console.log('selected bookshelf settings case PASS: '+selectedCase);

}
