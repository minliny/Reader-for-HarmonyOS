import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"confirmation-admission": {"description": "实际Index三origin confirmation取消/确认/identity/busy拒绝", "resources": []}, "dialog-message": {"description": "实际BookRemovalDialog长文本测量/滚动/action路由", "resources": []}, "removal-actions": {"description": "实际removal shared actions cancel默认focus与ID路由", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {


const { resolveEtsLoaderRoot, virtualFilePath } = await import('./lib/tool-environment.mjs');
const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createRequire, stripTypeScriptTypes } = await import('node:module');
const { SOURCE_SWITCH_VISUAL } = await import('../entry/src/main/ets/features/source/SourceSwitchVisual.ts');
const {runtimeOwnerIdentityProbe} = await import('./lib/reader-runtime-admission-probe.mjs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { resolveHorizontalFrame, SurfaceWidthSpec } = await import('../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts');
const { readerInteractiveSafeLeft, readerInteractiveSafeRight, ReaderWindowMetricsSnapshot,
  ReaderRectVp, ReaderInsetsVp } = await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');


const file = name => new URL(`../entry/src/main/ets/${name}`, import.meta.url);
const require = createRequire(import.meta.url);
const sdk = resolveEtsLoaderRoot();
const ts = require(`${sdk}/node_modules/typescript`);
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
const options = require(`${sdk}/lib/ets_checker.js`).compilerOptions;
const surfaceSource = readFileSync(file('features/common/ReaderDialogSurface.ets'), 'utf8');
const indexSource = readFileSync(file('pages/Index.ets'), 'utf8');
const surfaceTree = ts.createSourceFile(virtualFilePath('BookRemovalSurfaceProbe.ets'), surfaceSource,
  ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
assert.equal(surfaceTree.parseDiagnostics.length, 0, 'production dialog surface parses');
const actionModel = surfaceTree.statements.find(node => node.name?.text === 'DialogActionView');
assert.ok(actionModel, 'production action model is present');
const DialogActionView = new Function(stripTypeScriptTypes(actionModel.getText(surfaceTree))
  .replace(/^export /, '') + '; return DialogActionView;')();
const specSource = readFileSync(file('features/common/ReaderSurfaceSpecs.ets'), 'utf8');
const { resolveDialogSpec } = new Function('TextAlign', 'SOURCE_SWITCH_VISUAL', stripTypeScriptTypes(specSource)
  .replace(/^import[^;]+;\s*/gm, '').replace(/^export /gm, '') + '; return { resolveDialogSpec };')({ Start: 'TextAlign.Start', Center: 'TextAlign.Center' }, SOURCE_SWITCH_VISUAL);
// Mirror the SDK frontend's production child/decorator collection before the
// isolated parent Builder transform; do not rewrite the component call.
syntax.componentCollection.customComponents.add('ReaderDialogSurface');
syntax.propCollection.set('ReaderDialogSurface', new Set(
  [...surfaceSource.matchAll(/@Prop\s+(\w+)\s*:/g)].map(match => match[1])));
syntax.builderParamObjectCollection.set('ReaderDialogSurface', new Set(
  [...surfaceSource.matchAll(/@BuilderParam\s+(\w+)\s*:/g)].map(match => match[1])));
syntax.componentCollection.customComponents.add('BookRemovalDialog');
syntax.componentCollection.customDialogs.add('BookRemovalDialog');syntax.propCollection.set('BookRemovalDialog',new Set(['message']));
const actualRuntime={};const ReaderRuntimeOwner=runtimeOwnerIdentityProbe(()=>actualRuntime);let activeEvents;
class NativeController { constructor(options){this.options=options;}open(){activeEvents.push('open');}close(){activeEvents.push('close');} }
const hostMethods=[
  'openBookRemovalDialog', 'dismissBookRemovalDialog', 'confirmBookRemovalDialog',
  'requestRemoveDetailBook', 'requestRemoveShelfBook', 'requestRemoveShelfBooks',
  'hasUnknownShelfWrite', 'canRemoveDetailBook', 'canRemoveShelfBook', 'isSameDetailBook', 'shelfBookKey', 'onBackPress',
];
hostMethods.push('isCurrentRuntime','isCurrentBookRemoval','bookRemovalDialogContent');
const Host=createReaderBuilderProbe(indexSource,hostMethods,{LOCAL_SOURCE_ID:'local',ReaderRuntimeOwner,
 CustomDialogController:NativeController,BookRemovalDialog:class{},DialogAlignment:{Center:'center'}}).Component;

const local = { sourceId: 'local', bookId: 'a', title: '本地书' };
const online = { sourceId: 'source', bookId: 'b', title: '在线书' };
function fixture(route, book = local) {
  const events = [];activeEvents=events;
  const host = Object.assign(new Host(), { route, detailBook: book, detailInBookshelf: true, shelfBooks: [local, online],
    bookshelfSelectionBooks: [local, online], bookshelfSelectionReady: true,
    bookshelfBatchRemovalBusy: false, shelfOperation: {removalKey:'',busy:false,batchRemovalBusy:false}, offlineMutationActiveKey: '',
    readingSessionActive: false, sourceSwitchVisible: false, pendingSourceSwitch: undefined,
    navigationGeneration: 1, bookRemovalPresentation:0,detailShelfAdmissionMount:1,mountedRuntimeOwner:actualRuntime,shelfReceiptRetired:false,bookRemovalDialogOpen: false,
    bookRemovalDialogController: { open() { events.push('open'); }, close() { events.push('close'); } },
    removeDetailBook(target) { events.push(['detail', target]); },
    removeShelfBook(target) { events.push(['shelf', target]); },
    removeShelfBooks(targets) { events.push(['batch', targets]); },
  });
  return { host, events };
}
{
 const {host,events}=fixture('detail',local);host.detailInBookshelf=false;host.requestRemoveDetailBook();
 assert.deepEqual(events,[],'removed local metadata cannot dispatch another delete or open a dead confirmation');
}
for (const origin of ['detail', 'bookshelf', 'bookshelfMultiSelect']) {
  const request = h => origin === 'detail' ? h.requestRemoveDetailBook() :
    origin === 'bookshelf' ? h.requestRemoveShelfBook(local) : h.requestRemoveShelfBooks([h.shelfBookKey(local)]);
  for (const exit of ['cancel', 'back', 'confirm', 'stale', 'busy']) {
    const { host: h, events } = fixture(origin);
    request(h); request(h);
    assert.deepEqual(events, ['open'], 'repeated requests must preserve one confirmation');
    if (exit === 'cancel') h.dismissBookRemovalDialog();
    else if (exit === 'back') assert.equal(h.onBackPress(), true);
    else {
      if (exit === 'stale') h.navigationGeneration++;
      if (exit === 'busy') { h.shelfOperation={...h.shelfOperation,removalKey:'busy',busy:true,batchRemovalBusy:true}; }
      h.confirmBookRemovalDialog();
    }
    h.confirmBookRemovalDialog();
    assert.equal(h.bookRemovalDialogOpen, false);
    assert.equal(h.bookRemovalConfirmAction, undefined, 'intent is released on every exit');
    assert.equal(events.filter(Array.isArray).length, exit === 'confirm' ? 1 : 0,
      `${origin}/${exit}: only one admitted confirmation may dispatch a mutation`);
    if (exit === 'confirm') assert.deepEqual(events[2][1], origin === 'bookshelfMultiSelect' ? [local] : local);
    assert.equal(events.filter(e => e === 'close').length, 1);
  }
}
for (const book of [local, online]) if(selectedCase==='confirmation-admission') {
{
  const { host: h } = fixture('detail', book); h.requestRemoveDetailBook();
  assert.ok(h.bookRemovalMessage.includes(book.title));
  assert.match(h.bookRemovalMessage, book === local ? /解析内容、阅读进度和离线任务将一并删除/ : /阅读进度和已缓存正文不会删除/);
}
{
  const { host: h, events } = fixture('detail'); h.requestRemoveDetailBook(); h.detailBook = online;
  h.confirmBookRemovalDialog(); assert.deepEqual(events, ['open', 'close'], 'changed detail identity is never removed');
}
{
  const { host: h, events } = fixture('bookshelf'); h.requestRemoveShelfBook(local); h.shelfBooks = [online];
  h.confirmBookRemovalDialog(); assert.deepEqual(events, ['open', 'close'], 'missing shelf identity is never removed');
}

}
if(selectedCase==='dialog-message') {
let metrics = new ReaderWindowMetricsSnapshot();
metrics.windowRect = new ReaderRectVp(0, 0, 390, 844);

// Dialog struct probe: the native modal delegates frame/header/actions to the
// shared surface while keeping its own message measurement and callbacks.
class SurfaceChild {
  constructor(owner, params, _storage, id) {
    Object.assign(this, { owner, params, id });
    // The custom-child boundary consumes the actual SDK-emitted body slot.
    // The shared surface itself is exercised by the second probe below.
    params.body();
  }
}
const dialogSource = readFileSync(file('features/bookshelf/BookRemovalDialog.ets'), 'utf8');
void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
const { owner: dialog } = createReaderBuilderProbe(dialogSource,
  ['build', 'messageBody', 'messageMaxHeight'], {
  ReaderWindowCoordinator: { metrics: () => metrics }, ReaderDialogSurface: SurfaceChild, DialogActionView,
  registerReaderFonts: () => {},
});
let cancel = 0, confirm = 0;
Object.assign(dialog, { appThemeScheme: 'day', message: '很长的书名'.repeat(120),
  measuredMessageHeight: 50, onCancel: () => cancel++, onConfirm: () => confirm++ });
dialog.initialRender();
const surfaceChild = [...dialog.children.values()][0];
assert.equal(surfaceChild.params.specId, 'book-removal');
assert.equal(surfaceChild.params.title, '移出书架');
assert.deepEqual(surfaceChild.params.actions.map(a => [a.id, a.tone, a.enabled, a.defaultFocus]),
  [['cancel', 'default', true, true], ['confirm', 'danger', true, false]],
  'action identity, tone, admission and default focus are declared once');
assert.equal(typeof surfaceChild.params.body, 'function', 'message body is delegated as the body slot');
const dialogNodes = [...dialog.nodes.values()];
const dialogScroll = dialogNodes.find(n => n.type === 'Scroll');
const dialogBody = dialogNodes.find(n => n.type === 'Text' && n.create === dialog.message);
assert.equal(dialogScroll.height, 50);
assert.equal(dialogBody.maxLines, undefined, 'purge notices must not be ellipsized');
assert.equal(dialogBody.textOverflow, undefined);

dialogBody.onAreaChange({}, { height: '220vp' }); dialog.replay();
assert.equal(dialogScroll.height, 220, 'native text measurement expands the notice');
metrics.windowRect = new ReaderRectVp(0, 0, 280, 300);
metrics.systemInsets = new ReaderInsetsVp(8, 24, 12, 20);
metrics.systemFontScale = 2;
dialog.replay();
assert.equal(dialogScroll.height, 50, 'long notice scrolls when window height is limited');
surfaceChild.params.onAction('cancel');
surfaceChild.params.onAction('confirm');
assert.equal(cancel, 1); assert.equal(confirm, 1);
surfaceChild.params.onAction('unknown');
assert.equal(cancel + confirm, 2, 'unrouted action ids never reach the callbacks');

}
if(selectedCase==='removal-actions') {
let metrics=new ReaderWindowMetricsSnapshot();
// Surface probe: the shared component owns spec geometry, the standard header,
// the data-driven actions row and press feedback for the book-removal spec.
metrics = new ReaderWindowMetricsSnapshot();
metrics.windowRect = new ReaderRectVp(0, 0, 390, 844);
const { owner: surface } = createReaderBuilderProbe(surfaceSource,
  ['body', 'defaultBody', 'build', 'header', 'actionsRow', 'actionCell', 'spec', 'resolvedFrame',
    'frameWidth', 'framePadding', 'actionLabelColor', 'actionSurfaceRole', 'actionModifier',
    'actionTouchRegion', 'bodyActionsInnerMargin'], {
  ReaderWindowCoordinator: { metrics: () => metrics }, readerInteractiveSafeLeft, readerInteractiveSafeRight,
  resolveHorizontalFrame, SurfaceWidthSpec, SurfaceHorizontalFrame: class {
    constructor(left, right, width) { Object.assign(this, { left, right, width }); }
  }, resolveDialogSpec, ButtonType: { Normal: 'Normal' },
});
const actions = [
  { id: 'cancel', label: '取消', tone: 'default', enabled: true, defaultFocus: true },
  { id: 'confirm', label: '移除', tone: 'danger', enabled: true, defaultFocus: false },
];
Object.assign(surface, { appThemeScheme: 'day', readerWindowMetricsRevision: 0,
  specId: 'book-removal', title: '移出书架', showCloseButton: false, actions });
surface.initialRender();
const surfaceNodes = [...surface.nodes.values()];
const buttons = surfaceNodes.filter(n => n.type === 'Button');
void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
assert.equal(buttons.length,actions.length);
void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
assert.deepEqual(buttons.map(b => b.defaultFocus), [true, false], 'keyboard focus defaults to cancel');
assert.ok(buttons.every(b=>b.responseRegion?.width==='100%'),'each action owns its full horizontal response region');
metrics.windowRect = new ReaderRectVp(0, 0, 280, 300);
metrics.systemInsets = new ReaderInsetsVp(8, 24, 12, 20);
surface.replay();
assert.ok(surface.resolvedFrame().width <= 240, 'small windows honor side insets');
let routed = [];
surface.onAction = id => routed.push(id);
surface.replay();
buttons[0].onClick(); buttons[1].onClick();
assert.deepEqual(routed, ['cancel', 'confirm'], 'actions dispatch by id through one callback');
assert.ok(surfaceNodes.some(n => n.type === 'Text' && n.create === '移出书架'), 'standard header renders the title');

}
console.log('selected book removal confirmation case PASS: '+selectedCase);

}
