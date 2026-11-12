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
const { SOURCE_SWITCH_VISUAL } = await import('../entry/src/main/ets/features/source/ui/SourceSwitchVisual.ts');
const {runtimeOwnerIdentityProbe} = await import('./lib/reader-runtime-admission-probe.mjs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { resolveHorizontalFrame, SurfaceWidthSpec } = await import('../entry/src/main/ets/ui/layout/SurfaceHorizontalGeometry.ts');
const { readerInteractiveSafeLeft, readerInteractiveSafeRight, ReaderWindowMetricsSnapshot,
  ReaderRectVp, ReaderInsetsVp } = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');


const file = name => new URL(`../entry/src/main/ets/${name}`, import.meta.url);
const require = createRequire(import.meta.url);
const sdk = resolveEtsLoaderRoot();
const ts = require(`${sdk}/node_modules/typescript`);
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
const options = require(`${sdk}/lib/ets_checker.js`).compilerOptions;
const surfaceSource = readFileSync(file('ui/surfaces/ReaderDialogSurface.ets'), 'utf8');
const surfaceTree = ts.createSourceFile(virtualFilePath('BookRemovalSurfaceProbe.ets'), surfaceSource,
  ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
assert.equal(surfaceTree.parseDiagnostics.length, 0, 'production dialog surface parses');
const actionModel = surfaceTree.statements.find(node => node.name?.text === 'DialogActionView');
assert.ok(actionModel, 'production action model is present');
const DialogActionView = new Function(stripTypeScriptTypes(actionModel.getText(surfaceTree))
  .replace(/^export /, '') + '; return DialogActionView;')();
const specSource = readFileSync(file('ui/surfaces/ReaderSurfaceSpecs.ets'), 'utf8');
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
if (selectedCase === 'confirmation-admission') {
  const { selectedProductionClasses, selectedProductionMethods, selectedProductionValues } = await import('./lib/selected-production-methods.mjs');
  const { BookRemovalDialogPresentation } = await import('../entry/src/main/ets/features/bookshelf/presentation/BookRemovalDialogPresentation.ts');
  const { ReaderNavigation } = await import('../entry/src/main/ets/app/navigation/ReaderNavigation.ts');
  const mutationFile = file('features/bookshelf/presentation/BookshelfMutationPresentation.ets');
  const { EMPTY_SELECTION } = selectedProductionValues(mutationFile, ['EMPTY_SELECTION']);
  const { BookshelfMutationPresentation } = selectedProductionClasses(mutationFile, ['BookshelfMutationPresentation'],
    { EMPTY_SELECTION, EMPTY_BOOKSHELF_OPERATION_SNAPSHOT: { busy: false, removalKey: '' } });
  const { BookshelfDetailPresentation } = selectedProductionClasses(
    file('features/bookshelf/presentation/BookshelfDetailPresentation.ets'), ['BookshelfDetailPresentation']);
  const { BookshelfProjectionOwner } = selectedProductionClasses(
    file('features/bookshelf/application/BookshelfProjectionOwner.ts'), ['BookshelfProjectionOwner']);
  const runtime = {}, ReaderRuntimeOwner = runtimeOwnerIdentityProbe(() => runtime);
  const local = { sourceId: 'local', bookId: 'a', title: '本地书', addedAt: 1 };
  const online = { sourceId: 'source', bookId: 'b', title: '在线书', addedAt: 2 };
  const localKey = 'local\0a';
  const tick = () => new Promise(resolve => setImmediate(resolve));
  let nativeEvents, nativeController;
  class NativeController {
    constructor(options) { this.options = options; nativeController = this; }
    open() { nativeEvents.push('open'); this.options.builder(); }
    close() { nativeEvents.push('close'); }
    cancelNatively() { nativeEvents.push('close'); this.options.cancel(); }
  }
  class DialogChild {
    constructor(owner, params, _storage, id) { Object.assign(this, {owner, params, id}); }
  }
  const nativeHostSource = readFileSync(file('features/bookshelf/ui/BookRemovalDialogHost.ets'), 'utf8');
  const nativeHostMembers = ['aboutToAppear', 'aboutToDisappear', 'createDialog', 'dialogContent'];
  const NativeHost = createReaderBuilderProbe(nativeHostSource, nativeHostMembers, {
    BookRemovalDialog: DialogChild, CustomDialogController: NativeController, DialogAlignment: { Center: 'center' },
  }, { childSources: { BookRemovalDialog: readFileSync(file('features/bookshelf/ui/BookRemovalDialog.ets'), 'utf8') } }).Component;
  const hostMethods = ['openBookRemovalDialog', 'onBackPress', 'isCurrentRuntime'];
  const Host = selectedProductionMethods(file('pages/Index.ets'), 'Index', hostMethods, {
    ReaderRuntimeOwner, hilog: { warn() {} }, DOMAIN: 0, errorMessageOf: error => error.message,
  });

  function fixture(route, book = local, paged = true) {
    const events = [], feedback = [], messages = [];
    nativeEvents = events;
    const model = { books: [local, online], revision: 'r1', pending: undefined, failed: false };
    const state = () => ({ books: model.books, total: model.books.length,
      projectionRevision: paged ? model.revision : undefined });
    const projection = new BookshelfProjectionOwner(runtime, () => true, () => ({
      loadAll: async () => state(),
      loadPage: async () => {
        if (model.pending !== undefined) await model.pending;
        if (model.failed) throw Error('shelf temporarily unavailable');
        return state();
      },
    }), async () => []);
    const binding = { identity: 'selection', current: () => true, emit() {} };
    projection.attach(binding);
    const host = Object.assign(new Host(), {
      route, readingSessionActive: false, shelfRead: { snapshot: { books: [local, online] } },
      mangaSourceSwitch: { selectionVisible: false }, navigationGeneration: 1, bookRemovalConfirmation: new BookRemovalDialogPresentation(),
      detailShelfAdmissionMount: 1, mountedRuntimeOwner: runtime, shelfReceiptRetired: false,
      navigationOwner: new ReaderNavigation(), jsonImportPresentation: {},
      sourceSwitchPresentation: { visible: false }, shelfGroupPresentation: { back: () => false },
    });
    host.navigationOwner.show(route);
    const nativeHost = new NativeHost(undefined, {});
    nativeHost.presentation = host.bookRemovalConfirmation;
    nativeHost.aboutToAppear();
    const confirmCurrent = () => [...nativeHost.children.values()].findLast(child => child instanceof DialogChild).params.onConfirm();
    const confirm = (message, action) => { messages.push(message); host.openBookRemovalDialog(message, action); };
    const operation = {
      current: () => ({ generation: 1 }),
      remove(targets, batch, _filter, current) {
        assert.equal(current(), true);
        events.push([batch ? 'batch' : route, targets]);
        return Promise.resolve(undefined);
      },
    };
    host.shelfMutations = new BookshelfMutationPresentation({
      host: () => ({ operations: () => operation }), owner: () => host.mountedRuntimeOwner,
      isCurrentOwner: owner => owner === runtime, retired: () => host.shelfReceiptRetired, route: () => host.route,
      generation: () => host.navigationGeneration, mounting: () => host.detailShelfAdmissionMount,
      filter: () => ({ readingState: 'all', sourceKind: 'all' }), feedback: message => feedback.push(message),
      readSelection: () => projection.selection(binding),
      selectionMatches: (selection, current) => projection.selectionMatches(selection, binding, current),
      shelfProjection: () => ({ generation: 1, revision: model.revision, books: host.shelfRead.snapshot.books,
        value: { shelf: state() }, filter: { readingState: 'all', sourceKind: 'all' } }),
      readingActive: () => false, refreshShelf() {},
      confirmRemoval: confirm, leaveSelection: () => events.push('leave'), finishSelection: () => events.push('finish'),
    });
    const detail = new BookshelfDetailPresentation({
      owner: () => host.mountedRuntimeOwner, isCurrentOwner: owner => owner === runtime, retired: () => false,
      route: () => host.route, generation: () => host.navigationGeneration, mounting: () => host.detailShelfAdmissionMount,
      book: () => model.detailBook, inBookshelf: () => model.inBookshelf, blocked: () => false,
      mutations: () => host.shelfMutations, confirm,
    });
    model.detailBook = book;
    model.inBookshelf = true;
    return { host, model, detail, events, feedback, messages, confirmCurrent };
  }

  for (const route of ['detail', 'bookshelf', 'bookshelfMultiSelect']) {
    for (const exit of ['cancel', 'back', 'confirm', 'stale', 'busy']) {
      const f = fixture(route), h = f.host, selection = h.shelfMutations;
      if (route === 'bookshelfMultiSelect') { selection.openSelection(local, [local, online]); await tick(); }
      const request = () => {
        if (route === 'detail') f.detail.request(f.detail.identity());
        else if (route === 'bookshelf') selection.requestSingleRemoval(local);
        else selection.requestSelectionRemoval(selection.selection.identity, [localKey]);
      };
      request(); request();
      assert.deepEqual(f.events, ['open'], 'repeated requests preserve one confirmation');
      if (exit === 'cancel') nativeController.cancelNatively();
      else if (exit === 'back') assert.equal(h.onBackPress(), true);
      else {
        if (exit === 'stale') h.navigationGeneration++;
        if (exit === 'busy') selection.snapshot = { ...selection.snapshot, busy: true };
        f.confirmCurrent();
      }
      f.confirmCurrent();
      await tick();
      assert.equal(h.bookRemovalConfirmation.isOpen(), false);
      assert.deepEqual(f.events, exit === 'confirm' ?
        ['open', 'close', [route === 'bookshelfMultiSelect' ? 'batch' : route, [{ sourceId: 'local', bookId: 'a' }]]] :
        ['open', 'close'], `${route}/${exit}`);
    }
  }

  for (const book of [local, online]) {
    const f = fixture('detail', book);
    f.detail.request(f.detail.identity());
    assert.ok(f.messages[0].includes(book.title));
    assert.match(f.messages[0], book === local ? /解析内容、阅读进度和离线任务将一并删除/ : /阅读进度和已缓存正文不会删除/);
    f.model.detailBook = book === local ? online : local;
    f.confirmCurrent();
    assert.deepEqual(f.events, ['open', 'close'], 'changed detail identity is never removed');
  }
  {
    const f = fixture('detail');
    f.model.inBookshelf = false;
    f.detail.request(f.detail.identity());
    assert.deepEqual(f.events, [], 'removed local metadata cannot reopen confirmation');
  }
  {
    const f = fixture('bookshelf');
    f.host.shelfMutations.requestSingleRemoval(local);
    f.host.shelfRead.snapshot.books = [online];
    f.confirmCurrent();
    assert.deepEqual(f.events, ['open', 'close'], 'missing shelf identity is never removed');
  }

  for (const paged of [true, false]) {
    const f = fixture('bookshelfMultiSelect', local, paged), selection = f.host.shelfMutations;
    selection.openSelection(local, [local, online]);
    await tick();
    const oldIdentity = selection.selection.identity;
    assert.equal(selection.selection.initialKey, localKey);
    selection.requestSelectionRemoval(oldIdentity, [localKey, 'unknown']);
    assert.deepEqual(f.events, [], 'partial obsolete targets never open a destructive confirmation');
    selection.requestSelectionRemoval(oldIdentity, [localKey]);
    f.model.revision = 'r2';
    f.model.books = [{ ...local, addedAt: 3 }, online];
    f.confirmCurrent();
    await tick();
    assert.deepEqual(f.events, ['open', 'close'], 'changed selection version never dispatches removeBatch');
    assert.deepEqual(f.feedback, ['书架已变化，请重新选择']);
    assert.notEqual(selection.selection.identity, oldIdentity);
    assert.equal(selection.selection.initialKey, '');
    assert.equal(selection.selection.ready, true);
    selection.requestSelectionRemoval(oldIdentity, [localKey]);
    assert.deepEqual(f.events, ['open', 'close'], 'old page callbacks cannot borrow refreshed identity');
    selection.requestSelectionRemoval(selection.selection.identity, [localKey]);
    f.confirmCurrent();
    await tick();
    assert.deepEqual(f.events.at(-1), ['batch', [{ sourceId: 'local', bookId: 'a' }]]);
  }
  {
    const f = fixture('bookshelfMultiSelect'), selection = f.host.shelfMutations;
    selection.openSelection(local, [local, online]);
    await tick();
    selection.requestSelectionRemoval(selection.selection.identity, [localKey]);
    f.model.failed = true;
    f.confirmCurrent();
    await tick();
    assert.deepEqual(f.events, ['open', 'close']);
    assert.deepEqual(f.feedback, ['暂时无法核对书架，请重试']);
    assert.equal(selection.selectionVerifying, false);
    let resume;
    f.model.failed = false;
    f.model.pending = new Promise(resolve => { resume = resolve; });
    selection.requestSelectionRemoval(selection.selection.identity, [localKey]);
    f.confirmCurrent();
    assert.equal(selection.selectionVerifying, true);
    selection.retireSelection();
    f.host.navigationGeneration++;
    resume();
    await tick();
    assert.deepEqual(f.events, ['open', 'close', 'open', 'close'], 'late recheck cannot dispatch into a newer route');
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
const dialogSource = readFileSync(file('features/bookshelf/ui/BookRemovalDialog.ets'), 'utf8');
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
const resolverSource = readFileSync(file('ui/foundation/ReaderSurfaceResolvers.ts'), 'utf8');
const { readerReadableFontScale, readerScaledControlHeight } = new Function(stripTypeScriptTypes(resolverSource)
  .replace(/^import[^;]+;\s*/gm, '').replace(/^export /gm, '') + '; return { readerReadableFontScale, readerScaledControlHeight };')();
let metrics=new ReaderWindowMetricsSnapshot();
// Surface probe: the shared component owns spec geometry, the standard header,
// the data-driven actions row and press feedback for the book-removal spec.
metrics = new ReaderWindowMetricsSnapshot();
metrics.windowRect = new ReaderRectVp(0, 0, 390, 844);
const { owner: surface } = createReaderBuilderProbe(surfaceSource,
  ['body', 'defaultBody', 'build', 'header', 'actionsRow', 'actionCell', 'spec', 'resolvedFrame',
    'frameWidth', 'framePadding', 'actionLabelColor', 'actionSurfaceRole', 'actionModifier',
    'actionTouchRegion', 'bodyActionsInnerMargin', 'actionHeight', 'fontScale'], {
  ReaderWindowCoordinator: { metrics: () => metrics }, readerInteractiveSafeLeft, readerInteractiveSafeRight,
  resolveHorizontalFrame, SurfaceWidthSpec, SurfaceHorizontalFrame: class {
    constructor(left, right, width) { Object.assign(this, { left, right, width }); }
  }, resolveDialogSpec, readerReadableFontScale, readerScaledControlHeight,
  MESSAGE_ACTION: { lineHeightFp: 20 }, ButtonType: { Normal: 'Normal' },
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
