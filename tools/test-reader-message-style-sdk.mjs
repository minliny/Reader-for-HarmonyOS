import{selectContractCases,recordContractCasePass}from'./lib/contract-case-selection.mjs';
const selected=selectContractCases({'fonts-carriers':{description:'Upstream real static font tables and current SDK message role/action/loader carriers',resources:[]},'detail-notice':{description:'Actual Index detail notice original identity and single safe-top ownership',resources:[]},'group-receipt':{description:'Actual BookshelfGroupPresentation obeys original receipt/unfinished cleanup',resources:[]}});
async function run(id){
const{default:assert}=await import('node:assert/strict');const{readFileSync}=await import('node:fs');const{boundedSurfaceSdk}=await import('./lib/bounded-surface-sdk-probe.mjs');
const{readerAppColor}=await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
const{readerMessageStyles,readerTypographyRoles}=await import('./lib/reader-typography-probe.mjs');
const windowMetrics=await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
const read=name=>readFileSync(new URL(`../entry/src/main/ets/ui/feedback/${name}.ets`,import.meta.url),'utf8');const sdk=boundedSurfaceSdk(),runtime={};
if(id==='fonts-carriers'){
const messageFaces={ReaderNotoSansSCUIRegular:['NotoSansSC-UIRegular.otf',400],ReaderNotoSansSCUIMedium:['NotoSansSC-UIMedium.otf',500],ReaderMangaSans600:['ReaderMangaSans600.otf',600]};
const {execFileSync}=await import('node:child_process');const{fileURLToPath}=await import('node:url');
const fontTables=JSON.parse(execFileSync(process.env.READER_FONTTOOLS_PYTHON||'python3',['-c',String.raw`
import json,sys,fontTools,hashlib
from fontTools.ttLib import TTFont
faces=json.loads(sys.argv[2]);result=[]
for family,(asset,weight) in faces.items():
    with TTFont(sys.argv[1]+'/'+asset,lazy=False) as font:
        assert 'fvar' not in font
        assert font['OS/2'].usWeightClass==weight
        names=sorted(set(n.toUnicode() for n in font['name'].names if n.nameID in [1,4,6,16]))
        assert names, 'actual font has identity names; app registration alias need not equal embedded name'
        assert len(font.getBestCmap())>30000
        result.append({'familyAlias':family,'asset':asset,'fontNames':names,'weight':weight,'unicodeCount':len(font.getBestCmap()),'sha256':hashlib.sha256(open(sys.argv[1]+'/'+asset,'rb').read()).hexdigest()})
print(json.dumps({'python':sys.version,'fontTools':fontTools.__version__,'faces':result}))
`,fileURLToPath(new URL('../entry/src/main/resources/rawfile/',import.meta.url)),JSON.stringify(messageFaces)],{encoding:'utf8',timeout:20000}));
console.log(JSON.stringify({kind:'message-font-table-evidence',...fontTables}));
// Platform registration explicitly maps an application alias to a physical file;
// embedded name records are evidence, not the application registration key.
const{stripTypeScriptTypes}=await import('node:module');
const families=await import('../entry/src/main/ets/ui/foundation/ReaderFontFamilies.ts');
const loads=[];const registrarSource=readFileSync(new URL('../entry/src/main/ets/ui/foundation/ReaderFonts.ets',import.meta.url),'utf8').replace(/import[\s\S]*?from\s+['"][^'"]+['"];\s*/g,'').replace(/^export /gm,'');
const registrar=new Function(...Object.keys(families),'$rawfile','loadReaderFontChecked','readerFontLoadReady','hilog',stripTypeScriptTypes(registrarSource)+';return {registerReaderShelfFonts};')(...Object.values(families),value=>value,(family,src)=>{loads.push({family,src});return Promise.resolve();},()=>false,{warn(){}});
registrar.registerReaderShelfFonts({});
for(const[family,[asset]]of Object.entries(messageFaces))assert.equal(loads.find(row=>row.family===family)?.src,asset,'actual checked registrar binds application alias to inspected physical asset');
const scope=JSON.parse(readFileSync(new URL('../docs/message-ui/approved-scope-20261019.json',import.meta.url),'utf8'));
const loadingRule=scope.rules.find(rule=>rule.includes('32px原生LoadingProgress')&&rule.includes('18px并固定占位'));
assert.ok(loadingRule,'approved message loading rule exists');
const pageLoader=Number(loadingRule.match(/采用(\d+)px原生LoadingProgress/)[1]),actionLoader=Number(loadingRule.match(/加载采用(\d+)px并固定占位/)[1]);
for (const [name, family, weight, size, height] of [
  ['MESSAGE_TITLE', 'ReaderMangaSans600', 600, 17, 24],
  ['MESSAGE_ACTION', 'ReaderNotoSansSCUIMedium', 500, 13, 20],
  ['MESSAGE_BODY', 'ReaderNotoSansSCUIRegular', 400, 13, 21],
  ['MESSAGE_META', 'ReaderNotoSansSCUIRegular', 400, 12, 18],
  ['MESSAGE_NOTICE_TITLE', 'ReaderNotoSansSCUIRegular', 400, 14, 22],
  ['MESSAGE_GESTURE_ICON', 'ReaderNotoSansSCUIRegular', 400, 16, 22],
]) {
  const role = readerMessageStyles[name];
  assert.deepEqual([role.fontFamily,role.fontWeight],[family,weight],`${name}: actual static face role`);
  assert.ok(role.fontSizeFp>0&&role.lineHeightFp>=role.fontSizeFp,'current role usable line box; historic size tuple is not frozen');
}
assert.equal(readerTypographyRoles.TYPE_FILE_IMPORT_TITLE.fontFamily, 'ReaderNotoSerifSCBold',
  'the retained ordinary import heading keeps its original Serif face');
let first = 0, second = 0;
const notice = sdk.consumer(read('ReaderRecoveryNotice'));
Object.assign(notice, { appThemeScheme: 'day', tag: '删除',
  view: { message: '原书源删除仍待核对，保留原操作', visible: true, canRetry: true, generation: 7 },
  actionLabel: '核对', secondaryActionLabel: '继续原操作',
  onReconcile: generation => { assert.equal(generation, 7); first++; },
  onSecondaryAction: generation => { assert.equal(generation, 7); second++; } });
notice.initialRender();
const actions = () => sdk.walk(notice).filter(child => child instanceof sdk.deps.ReaderRecoveryAction);
assert.equal(actions().length, 2, 'independent original actions remain on the same notice');
for (const action of actions()) {
  assert.equal(action.variant, 'notice');
  const hit = [...action.nodes.values()].find(node => node.onClick);
  assert.equal(hit.type, 'Button');
  assert.ok(hit.constraintSize.minWidth >= 44 && hit.constraintSize.minHeight >= 44); hit.onClick();
}
assert.equal(first, 1); assert.equal(second, 1);
const retainedAction = actions()[0];
const retainedGesture = [...retainedAction.nodes.values()].find(node => node.onClick).onClick;
retainedAction.generation = 8;retainedGesture();assert.equal(first, 1, 'old physical action cannot borrow successor generation');
retainedAction.generation = 7;
assert.ok(sdk.nodes(notice).some(node => node.backgroundColor === readerAppColor('TOK_SURFACE_ELEVATED', 'day')));
const busy = sdk.consumer(read('ReaderRecoveryAction'));
Object.assign(busy, { label: '核对', variant: 'notice', isBusy: true, onReconcile: () => first++ });
busy.initialRender();
const label = sdk.nodes(busy).find(node => node.type === 'Text' && node.create === '核对');
assert.equal(label.fontFamily, 'ReaderNotoSansSCUIMedium');
assert.equal(label.fontWeight, 500);
assert.equal(label.opacity, 0, 'busy label preserves its measured width');
const spinner = sdk.nodes(busy).find(node => node.type === 'LoadingProgress');
assert.equal(spinner.width,actionLoader);assert.equal(spinner.height,actionLoader);
const hit = sdk.nodes(busy).find(node => node.onClick);assert.equal(hit.enabled, false);hit.onClick();assert.equal(first, 1);
const state = sdk.consumer(read('ReaderPageState'));
Object.assign(state, { title: '正在载入', message: '', loading: true });state.initialRender();
const loading = sdk.nodes(state).find(node => node.type === 'LoadingProgress');
assert.equal(loading.width,pageLoader);assert.equal(loading.height,pageLoader);
assert.equal(sdk.walk(state).filter(child => child instanceof sdk.deps.ReaderRecoveryAction).length, 0,
  'loading does not expose an unrelated retry');
assert.equal(sdk.nodes(state).find(node => node.create === '正在载入').fontFamily, 'ReaderMangaSans600');
const messageState = sdk.consumer(read('ReaderPageState'));
Object.assign(messageState, { title: '没有符合条件的书籍', message: '调整筛选后再试', actionLabel: '清除全部条件' });
messageState.initialRender();
for (const [content, family] of [['没有符合条件的书籍', 'ReaderMangaSans600'],
  ['调整筛选后再试', 'ReaderNotoSansSCUIRegular'], ['清除全部条件', 'ReaderNotoSansSCUIMedium']])
  assert.equal(sdk.nodes(messageState).find(node => node.create === content).fontFamily, family,
    'real page-state title/body/action selects the checked physical face');
const measured = [];
notice.getUIContext = () => ({ px2vp: value => value, getMeasureUtils: () => ({
  measureText: options => { measured.push({ ...options }); return options.textContent === '\u00a0' ? 4 : 36; },
  measureTextSize: options => { measured.push({ ...options }); return { width: 100, height: 22 }; },
}) });
notice.measureFlow(300);
assert.equal(measured.find(options => options.textContent === '核对').fontFamily, label.fontFamily,
  'notice trailing reservation measures the same static action face the real child paints');
assert.equal(measured.find(options => options.textContent === '核对').fontWeight, label.fontWeight);
assert.equal(measured.find(options => options.constraintWidth).fontFamily, 'ReaderNotoSansSCUIRegular');
const noticeTitle = sdk.nodes(notice).find(node => node.type === 'Text' && node.fontSize === readerMessageStyles.MESSAGE_NOTICE_TITLE.fontSizeFp);
assert.equal(noticeTitle.fontFamily, 'ReaderNotoSansSCUIRegular');
const horizontal = await import('../entry/src/main/ets/ui/layout/SurfaceHorizontalGeometry.ts');
const dialogWindow = windowMetrics.createDefaultReaderWindowMetrics();
dialogWindow.windowRect = new windowMetrics.ReaderRectVp(0, 0, 390, 844);
for (const specId of ['book-removal', 'json-import', 'shelf-group', 'local-import']) {
  const dialogSource = readFileSync(new URL('../entry/src/main/ets/ui/surfaces/ReaderDialogSurface.ets',import.meta.url),'utf8');
  const dialog = sdk.consumer(dialogSource, undefined,
    { ...windowMetrics, ...horizontal, readerWindowMetrics: () => dialogWindow, ButtonType: { Normal: 'ButtonType.Normal' } });
  Object.assign(dialog, { specId, title: '确认操作', showCloseButton: false,
    actions: [{ id: 'cancel', label: '取消', tone: 'default', enabled: true, defaultFocus: false }] });
  dialog.initialRender();
  const heading = sdk.nodes(dialog).find(node => node.create === '确认操作');
  assert.equal(heading.fontFamily, 'ReaderNotoSerifSCBold', `${specId}: the frozen dialog heading uses the checked Serif face`);
  assert.equal(heading.fontSize, 18, `${specId}: the complete prompt remains an 18fp dialog heading`);
  assert.equal(sdk.nodes(dialog).find(node => node.create === '取消').fontFamily, 'ReaderNotoSansSCUIMedium',
    `${specId}: actual shared action selects static 500`);
}

const night = sdk.consumer(read('ReaderRecoveryNotice'));
Object.assign(night, { appThemeScheme: 'night', tag: '设置', actionLabel: '',
  view: { message: '保存未确认，当前设置保留', visible: true, canRetry: false, generation: 8 } });night.initialRender();
assert.ok(sdk.nodes(night).some(node => node.backgroundColor === readerAppColor('TOK_SURFACE_ELEVATED', 'night')));
console.log('PASS actual SDK message family: same-card independent actions, original generation, busy admission and stable label, native18/32 loaders, day/night scoped notice palette');


}else if(id==='detail-notice'){
// Run the current root notice and the real pending-operations presentation.
// Inject the earlier unknown receipt and observe only its read-only port.
const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { selectedProductionClasses, selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
const { createDefaultReaderWindowMetrics, readerContentSafeTop } = windowMetrics;
const sourceRoot = new URL('../entry/src/main/ets/', import.meta.url);
const indexSource = new URL('pages/Index.ets', sourceRoot);
const metrics = createDefaultReaderWindowMetrics();
metrics.systemInsets.top = 39;
const SafeTop = selectedProductionMethods(indexSource, 'Index', ['messageSafeTop', 'readerOwnsWindowEdges'],
  { ReaderWindowCoordinator: { metrics: () => metrics }, readerContentSafeTop });
const book = { sourceId: 'source', bookId: 'book', contentKind: 'manga' };
const host = Object.assign(new SafeTop(), {
  route: 'bookshelf',
  readingEntry: { book, sessionActive: false, recoveryNoticeVisible: () => false },
  mangaSourceSwitch: { selectionVisible: false },
});
assert.equal(host.messageSafeTop(), 0, 'App root already consumed its safe top');
host.route = 'detail';
assert.equal(host.messageSafeTop(), 39, 'edge-to-edge detail uses one safe top');
host.route = 'reading';
host.readingEntry.sessionActive = true;
assert.equal(host.messageSafeTop(), 39, 'edge-to-edge reader uses one safe top');
host.route = 'detail';
host.readingEntry.sessionActive = false;

const { BookshelfDetailPresentation } = selectedProductionClasses(
  new URL('features/bookshelf/presentation/BookshelfDetailPresentation.ets', sourceRoot),
  ['BookshelfDetailPresentation'], { EMPTY_READABLE_ADMISSION: { confirmation: 'none' } });
const generation = 9;
const filter = { readingState: 'all', sourceKind: 'all' };
let mount = 2, navigation = 4, owner = runtime, interactive = true, reads = 0;
const mutations = {
  owner: runtime,
  snapshot: { generation, reconcileBusy: false },
  hasUnknownWrite: () => true,
  recovery: () => ({ visible: true, canRetry: true, generation, message: '删除尚未确认' }),
  remove: () => assert.fail('reconciliation must never issue another removal'),
};
const presentation = new BookshelfDetailPresentation({
  owner: () => owner,
  isCurrentOwner: candidate => candidate === runtime,
  retired: () => false,
  route: () => host.route,
  generation: () => navigation,
  mounting: () => mount,
  book: () => book,
  mutations: () => mutations,
  filter: () => filter,
  host: () => ({ operations: candidate => {
    assert.equal(candidate, runtime);
    return { reconcile: async (expected, currentFilter, current) => {
      assert.equal(expected, generation);
      assert.equal(currentFilter, filter);
      assert.equal(current(), true);
      reads++;
      return undefined;
    } };
  } }),
});
Object.assign(presentation, {
  removalKey: `${book.sourceId}\u0000${book.bookId}`,
  removalGeneration: generation,
});
assert.ok(presentation.removalRecovery()?.visible, 'the original unknown removal remains visible');

const { root, require } = installedEtsCompiler();
const syntax = require(root + '/lib/validate_ui_syntax.js');
for (const name of ['BookshelfDetailPresentation', 'ReadingEntryPresentation']) syntax.observedClassCollection.add(name);
sdk.deps.SynchedPropertyNesedObjectPU = sdk.properties.sdk.SynchedPropertyNestedObjectPU;
const detailSource = readFileSync(new URL('features/bookshelf/ui/BookshelfDetailNotice.ets', sourceRoot), 'utf8');
sdk.childSources.BookshelfDetailNotice = detailSource;
sdk.deps.BookshelfDetailNotice = createReaderBuilderProbe(detailSource, boundedMembers(detailSource), sdk.deps, sdk.hooks).Component;
const journeySource = readFileSync(new URL('app/composition/ReaderJourneyRecoveryNotices.ets', sourceRoot), 'utf8');
const observe = value => sdk.properties.sdk.ObservedObject.createNew(value, undefined);
const detail = observe(presentation);
const reading = observe(host.readingEntry);

function mountAction() {
  const journey = sdk.consumer(journeySource, boundedMembers(journeySource), {}, {
    reading, detail, topInset: host.messageSafeTop(), interactive: true,
  });
  Object.assign(journey, { canInteract: () => interactive, noticeWidth: () => 300, availableHeight: () => 400 });
  journey.initialRender();
  const detailNotices = sdk.walk(journey).filter(child => child instanceof sdk.deps.BookshelfDetailNotice);
  assert.equal(detailNotices.length, 1, 'the current root mounts one actual detail notice');
  const actions = sdk.walk(detailNotices[0]).filter(child => child instanceof sdk.deps.ReaderRecoveryAction &&
    child.label === '核对原操作');
  assert.equal(actions.length, 1, 'the original unknown removal owns one real SDK action');
  const button = [...actions[0].nodes.values()].find(node => node.type === 'Button' && node.onClick);
  assert.ok(button, 'the real recovery notice exposes a native Button callback');
  assert.equal(sdk.nodes(journey).find(node => node.type === 'Scroll')?.margin?.top, 51,
    'the root applies the one admitted 39vp safe top plus its 12vp gap');
  return button.onClick;
}
const stale = mountAction();
mount++;
stale();
assert.equal(reads, 0, 'the old detail opening cannot borrow its successor');
const current = mountAction();
interactive = false;
current();
assert.equal(reads, 0, 'a retained action obeys the real root input gate');
interactive = true;
current();
assert.equal(reads, 1, 'the active detail opening reconciles exactly one original receipt');
mutations.snapshot.generation++;
current();
assert.equal(reads, 1, 'a retained action cannot borrow a newer write generation');
mutations.snapshot.generation = generation;
owner = {};
current();
assert.equal(reads, 1, 'a retired Runtime cannot dispatch recovery');
owner = runtime;
navigation++;
current();
assert.equal(reads, 1, 'a new navigation invalidates the retained callback');
console.log('PASS current detail root, native action and presentation preserve safe top, opening, foreground, runtime and original write generation');

}else{
// A confirmed write can still own unfinished durable cleanup. Closing its
// presentation then would hide the original check/continuation entry.
const {selectedProductionMethods}=await import('./lib/selected-production-methods.mjs');
const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
const feedbackStorage = new Map();
const { ReaderTransientFeedback, READER_FEEDBACK_EXTENDED_MS, READER_TRANSIENT_TOAST_STORAGE_KEY } = pureModuleProbe(
  readFileSync(new URL('../entry/src/main/ets/ui/feedback/ReaderTransientFeedback.ts', import.meta.url), 'utf8'),
  'ReaderTransientFeedback.ts', {
    AppStorage: {
      get: key => feedbackStorage.get(key),
      setOrCreate: (key, value) => feedbackStorage.set(key, value),
    },
  }, ['ReaderTransientFeedback', 'READER_FEEDBACK_EXTENDED_MS', 'READER_TRANSIENT_TOAST_STORAGE_KEY']);
const LibraryPorts = selectedProductionMethods(new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url), 'Index',
  ['libraryJourneyPorts'], { READER_FEEDBACK_EXTENDED_MS });
const GroupCompletion = selectedProductionMethods(new URL('../entry/src/main/ets/features/bookshelf/presentation/BookshelfGroupPresentation.ets', import.meta.url),'BookshelfGroupPresentation',
  ['assignDefault','isCurrent','retire'], { hilog: { error() {} }, errorMessageOf: String,
    EMPTY_BOOKSHELF_MANAGEMENT_SNAPSHOT: {busy:false} });
for (const [confirmation, blocked, fact] of [
  ['confirmed', false, 'succeeded'], ['confirmed', false, 'confirmedRefreshFailed'],
  ['confirmed', true, 'confirmedRefreshFailed'], ['unknown', true, 'pendingReconciliation'],
]) {
  let closes = 0, refreshes = 0, writes = 0;
  feedbackStorage.clear();
  const index = Object.assign(new LibraryPorts(), { searchAppForeground: true,
    transientFeedback: new ReaderTransientFeedback(), getUIContext: () => ({}) });
  const onNotice = index.libraryJourneyPorts().feedback;
  const identity = 'original-group-opening', book = { sourceId: 'source', bookId: 'book' };
  const presentation = Object.assign(new GroupCompletion(), {
    identity, assigning: false,
    opening: { owner: runtime, book, identity, isRouteCurrent: () => true,
      onApplied() { refreshes++; }, onNotice },
    host: { isManagementPresentationCurrent: (owner, currentIdentity) => owner === runtime && currentIdentity === identity,
      detachManagementPresentation() { closes++; },
      assignDefaultGroup: async (currentBook, currentIdentity) => {
      assert.equal(currentBook, book); assert.equal(currentIdentity, identity); writes++; return {
      receipt: { receipt: { confirmation, fact } }, managementMutation: { blocked },
    }; } },
  });
  await presentation.assignDefault(identity);
  assert.equal(writes, 1, 'presentation consumes exactly the original write result');
  assert.equal(closes, confirmation === 'confirmed' && !blocked ? 1 : 0,
    'unfinished original cleanup and unknown receipts retain their pending presentation');
  assert.equal(refreshes, closes);
  const feedback = feedbackStorage.get(READER_TRANSIENT_TOAST_STORAGE_KEY);
  const expectedFeedback = confirmation === 'confirmed' && !blocked && fact === 'confirmedRefreshFailed';
  assert.equal(feedback?.generation ?? 0, expectedFeedback ? 1 : 0);
  if (expectedFeedback) {
    assert.equal(feedback.visible, true);
    assert.equal(feedback.message, '分组已保存，列表刷新失败');
    assert.equal(feedback.duration, READER_FEEDBACK_EXTENDED_MS);
  }
  assert.equal(presentation.assigning, false);
}
console.log('PASS actual group completion: confirmed refresh failure closes with feedback; confirmed blocked/unknown retain original pending entry');

}
}
for(const id of selected){await run(id);recordContractCasePass(id);}
