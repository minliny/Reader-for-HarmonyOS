import{selectContractCases,recordContractCasePass}from'./lib/contract-case-selection.mjs';
const selected=selectContractCases({'fonts-carriers':{description:'Upstream real static font tables and current SDK message role/action/loader carriers',resources:[]},'detail-notice':{description:'Actual Index detail notice original identity and single safe-top ownership',resources:[]},'group-receipt':{description:'Actual Index group presentation obeys original receipt/unfinished cleanup',resources:[]}});
async function run(id){
const{default:assert}=await import('node:assert/strict');const{readFileSync}=await import('node:fs');const{boundedSurfaceSdk}=await import('./lib/bounded-surface-sdk-probe.mjs');
const{readerAppColor}=await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
const{readerMessageStyles,readerTypographyRoles}=await import('./lib/reader-typography-probe.mjs');
const windowMetrics=await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const read=name=>readFileSync(new URL(`../entry/src/main/ets/features/common/${name}.ets`,import.meta.url),'utf8');const sdk=boundedSurfaceSdk(),runtime={};
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
const families=await import('../entry/src/main/ets/features/common/ReaderFontFamilies.ts');
const loads=[];const registrarSource=readFileSync(new URL('../entry/src/main/ets/features/common/ReaderFonts.ets',import.meta.url),'utf8').replace(/import[\s\S]*?from\s+['"][^'"]+['"];\s*/g,'').replace(/^export /gm,'');
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
  assert.equal(hit.type, 'Stack'); hit.onClick();
}
assert.equal(first, 1); assert.equal(second, 1);
const retainedAction = actions()[0];
const retainedGesture = [...retainedAction.nodes.values()].find(node => node.onClick).onClick;
retainedAction.generation = 8;retainedGesture();assert.equal(first, 1, 'old physical action cannot borrow successor generation');
retainedAction.generation = 7;
assert.ok(sdk.nodes(notice).some(node => node.backgroundColor === readerAppColor('TOK_MESSAGE_NOTICE', 'day')));
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
for (const specId of ['book-removal', 'json-import', 'shelf-group', 'local-import']) {
  const dialog = sdk.consumer(read('ReaderDialogSurface'), undefined,
    { ...windowMetrics, ButtonType: { Normal: 'ButtonType.Normal' } });
  Object.assign(dialog, { specId, title: '确认操作', showCloseButton: false,
    actions: [{ id: 'cancel', label: '取消', tone: 'default', enabled: true, defaultFocus: false }] });
  dialog.initialRender();
  assert.equal(sdk.nodes(dialog).find(node => node.create === '确认操作').fontFamily, 'ReaderMangaSans600',
    `${specId}: actual shared header selects static 600`);
  assert.equal(sdk.nodes(dialog).find(node => node.create === '取消').fontFamily, 'ReaderNotoSansSCUIMedium',
    `${specId}: actual shared action selects static 500`);
}

const night = sdk.consumer(read('ReaderRecoveryNotice'));
Object.assign(night, { appThemeScheme: 'night', tag: '设置', actionLabel: '',
  view: { message: '保存未确认，当前设置保留', visible: true, canRetry: false, generation: 8 } });night.initialRender();
assert.ok(sdk.nodes(night).some(node => node.backgroundColor === readerAppColor('TOK_MESSAGE_NOTICE', 'night')));
console.log('PASS actual SDK message family: same-card independent actions, original generation, busy admission and stable label, native18/32 loaders, day/night scoped notice palette');


}else if(id==='detail-notice'){
// The new detail matter shares Index's intrinsic top host. A physical action
// must retain its original detail opening as well as the write generation.
const { readerRecoveryView } = await import('../entry/src/main/ets/app/ReaderRecoveryProjection.ts');
const indexSource = readFileSync(new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url), 'utf8');

const index = sdk.consumer(indexSource, ['detailOperationNoticeContent','detailPendingNoticeVisible',
  'detailReadableAdmission','detailBookKey','shelfRecovery','emptyShelfRecovery','hasUnknownShelfWrite',
  'readerOwnsWindowEdges','messageSafeTop','isCurrentRuntime','detailShelfAdmissionIdentity','isCurrentDetailShelfAdmission','reconcileDetailShelfWrite'], {
  readerRecoveryView, ReaderRuntimeOwner: { isCurrent: owner => owner === runtime },
  EMPTY_READABLE_ADMISSION: { confirmation: 'none', message: '', generation: 0 },
});
Object.assign(index, { route: 'detail', appThemeScheme: 'day', navigationGeneration: 4, detailShelfAdmissionMount: 2,
  shelfReceiptRetired: false, mountedRuntimeOwner: runtime, shelfOperationOwner: runtime,
  detailBook: { sourceId: 'source', bookId: 'book' }, readableAdmissions: [],
  shelfOperation: { generation: 9, busy: false, reconcileBusy: false,
    receipt: { receipt: { confirmation: 'unknown', fact: 'pendingReconciliation', message: '删除尚未确认' },
      facts: { canRetry: true, generation: 9, message: '删除尚未确认' } } },
  detailShelfRemovalGeneration: 9, shelfFilter: () => ({ readingState: 'all', sourceKind: 'all' }) });
index.detailShelfRemovalKey = index.detailBookKey(index.detailBook);
let reads = 0;
index.bookshelfHost = { operations: () => ({ reconcile: async (generation, _filter, current) => {
  assert.equal(generation, 9);assert.equal(current(), true);reads++;return undefined;
} }) };
assert.equal(index.detailPendingNoticeVisible(), true);index.detailOperationNoticeContent();
const latestAction = () => {
  const actor = sdk.walk(index).filter(child => child instanceof sdk.deps.ReaderRecoveryAction && child.label === '核对原操作').at(-1);
  return [...actor.nodes.values()].find(node => node.onClick).onClick;
};
const stale = latestAction();index.detailShelfAdmissionMount++;stale();await Promise.resolve();assert.equal(reads, 0);
index.detailOperationNoticeContent();const current = latestAction();current();await Promise.resolve();assert.equal(reads, 1);
index.navigationGeneration++;current();await Promise.resolve();assert.equal(reads, 1);
console.log('PASS Index detail pending top-host action retains exact detail opening, runtime, navigation and original write generation; recheck never reissues deletion');

const {selectedProductionMethods}=await import('./lib/selected-production-methods.mjs');
const { createDefaultReaderWindowMetrics, readerContentSafeTop } = await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const metrics = createDefaultReaderWindowMetrics();metrics.systemInsets.top = 39;
const SafeTop = selectedProductionMethods(new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),'Index',
  ['messageSafeTop','readerOwnsWindowEdges'], { ReaderWindowCoordinator: { metrics: () => metrics }, readerContentSafeTop });
const host = Object.assign(new SafeTop(), { route: 'bookshelf', readingSessionActive: false, mangaSourceSwitchSelectionVisible: false });
assert.equal(host.messageSafeTop(), 0, 'App root already consumed its safe top');
host.route = 'detail';host.detailBook = { contentKind: 'manga' };
assert.equal(host.messageSafeTop(), 39, 'edge-to-edge detail floating notice consumes safe top exactly once');
host.route = 'reading';host.readingSessionActive = true;
assert.equal(host.messageSafeTop(), 39, 'reader background owns its own safe top');
console.log('PASS message host safe top: ordinary App padding is not counted twice; detail/reader own exactly one inset');


}else{
// A confirmed write can still own unfinished durable cleanup. Closing its
// presentation then would hide the original check/continuation entry.
const {selectedProductionMethods}=await import('./lib/selected-production-methods.mjs');
const GroupCompletion = selectedProductionMethods(new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),'Index',
  ['assignShelfDefaultGroup'], { hilog: { error() {} }, DOMAIN: 0, errorMessageOf: String });
for (const [confirmation, blocked, fact] of [
  ['confirmed', false, 'succeeded'], ['confirmed', false, 'confirmedRefreshFailed'],
  ['confirmed', true, 'confirmedRefreshFailed'], ['unknown', true, 'pendingReconciliation'],
]) {
  let closes = 0, refreshes = 0, writes = 0; const toasts = [];
  const presentation = Object.assign(new GroupCompletion(), {
    editingShelfGroupPresentation: 6, editingShelfGroupBusy: false,
    isCurrentShelfGroup: () => true, bookshelfManagementIdentity: () => 'original-group-opening',
    bookshelfHost: { assignDefaultGroup: async () => { writes++; return {
      receipt: { receipt: { confirmation, fact } }, managementMutation: { blocked },
    }; } },
    invalidateBookshelfProjection() {}, refreshBookshelf() { refreshes++; },
    closeShelfGroup() { closes++; }, getUIContext: () => ({ getPromptAction: () => ({ showToast: value => toasts.push(value.message) }) }),
  });
  await presentation.assignShelfDefaultGroup(6, 1, runtime, 2, { sourceId: 'source', bookId: 'book' });
  assert.equal(writes, 1, 'presentation consumes exactly the original write result');
  assert.equal(closes, confirmation === 'confirmed' && !blocked ? 1 : 0,
    'unfinished original cleanup and unknown receipts retain their pending presentation');
  assert.equal(refreshes, closes);
  assert.equal(toasts.length, confirmation === 'confirmed' && !blocked && fact === 'confirmedRefreshFailed' ? 1 : 0);
  assert.equal(presentation.editingShelfGroupBusy, false);
}
console.log('PASS Index group completion: confirmed refresh failure closes with Toast; confirmed blocked/unknown retain original pending entry');

}
}
for(const id of selected){await run(id);recordContractCasePass(id);}
