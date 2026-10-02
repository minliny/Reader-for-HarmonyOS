import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { resolveHorizontalFrame, SurfaceWidthSpec } from '../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts';
import { readerInteractiveSafeLeft, readerInteractiveSafeRight, ReaderWindowMetricsSnapshot,
  ReaderRectVp, ReaderInsetsVp } from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';

const file = name => new URL(`../entry/src/main/ets/${name}`, import.meta.url);
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ??
  '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(`${sdk}/node_modules/typescript`);
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
const options = require(`${sdk}/lib/ets_checker.js`).compilerOptions;
const surfaceSource = readFileSync(file('features/common/ReaderDialogSurface.ets'), 'utf8');
const indexSource = readFileSync(file('pages/Index.ets'), 'utf8');
const surfaceTree = ts.createSourceFile('/tmp/BookRemovalSurfaceProbe.ets', surfaceSource,
  ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
assert.equal(surfaceTree.parseDiagnostics.length, 0, 'production dialog surface parses');
const actionModel = surfaceTree.statements.find(node => node.name?.text === 'DialogActionView');
assert.ok(actionModel, 'production action model is present');
const DialogActionView = new Function(stripTypeScriptTypes(actionModel.getText(surfaceTree))
  .replace(/^export /, '') + '; return DialogActionView;')();
const specSource = readFileSync(file('features/common/ReaderSurfaceSpecs.ets'), 'utf8');
const { resolveDialogSpec } = new Function('TextAlign', stripTypeScriptTypes(specSource)
  .replace(/^export /gm, '') + '; return { resolveDialogSpec };')({ Start: 'TextAlign.Start', Center: 'TextAlign.Center' });
// Mirror the SDK frontend's production child/decorator collection before the
// isolated parent Builder transform; do not rewrite the component call.
syntax.componentCollection.customComponents.add('ReaderDialogSurface');
syntax.propCollection.set('ReaderDialogSurface', new Set(
  [...surfaceSource.matchAll(/@Prop\s+(\w+)\s*:/g)].map(match => match[1])));
syntax.builderParamObjectCollection.set('ReaderDialogSurface', new Set(
  [...surfaceSource.matchAll(/@BuilderParam\s+(\w+)\s*:/g)].map(match => match[1])));
const Host = productionMotionMethods(file('pages/Index.ets'), [
  'openBookRemovalDialog', 'dismissBookRemovalDialog', 'confirmBookRemovalDialog',
  'requestRemoveDetailBook', 'requestRemoveShelfBook', 'requestRemoveShelfBooks',
  'canRemoveDetailBook', 'canRemoveShelfBook', 'isSameDetailBook', 'shelfBookKey', 'onBackPress',
], { LOCAL_SOURCE_ID: 'local' });
const local = { sourceId: 'local', bookId: 'a', title: '本地书' };
const online = { sourceId: 'source', bookId: 'b', title: '在线书' };
function fixture(route, book = local) {
  const events = [];
  const host = Object.assign(new Host(), { route, detailBook: book, shelfBooks: [local, online],
    bookshelfSelectionBooks: [local, online], bookshelfSelectionReady: true,
    bookshelfBatchRemovalBusy: false, bookshelfRemovalActiveKey: '', offlineMutationActiveKey: '',
    readingSessionActive: false, sourceSwitchVisible: false, pendingSourceSwitch: undefined,
    navigationGeneration: 1, bookRemovalDialogOpen: false,
    bookRemovalDialogController: { open() { events.push('open'); }, close() { events.push('close'); } },
    removeDetailBook(target) { events.push(['detail', target]); },
    removeShelfBook(target) { events.push(['shelf', target]); },
    removeShelfBooks(targets) { events.push(['batch', targets]); },
  });
  return { host, events };
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
      if (exit === 'busy') { h.bookshelfRemovalActiveKey = 'busy'; h.bookshelfBatchRemovalBusy = true; }
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
for (const book of [local, online]) {
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
assert.match(dialogSource, /ReaderDialogSurface\(/, 'dialog consumes the shared surface');
assert.match(dialogSource, /specId: 'book-removal'/, 'dialog passes its finite spec id');
assert.doesNotMatch(dialogSource, /\.borderRadius\(|\.shadow\(|resolveHorizontalFrame/,
  'dialog no longer owns frame geometry or shadow');
assert.doesNotMatch(dialogSource, /margin\(\{ bottom: 30 \}\)/,
  'the body-to-actions spacing moved to the spec; the body no longer owns a duplicate margin');
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
assert.equal(surfaceChild.params.title, '移除书架');
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
  specId: 'book-removal', title: '移除书架', showCloseButton: false, actions });
surface.initialRender();
const surfaceNodes = [...surface.nodes.values()];
const buttons = surfaceNodes.filter(n => n.type === 'Button');
assert.equal(surface.resolvedFrame().width, 306);
assert.equal(surface.frameWidth(), 306, 'cap mode clamps the surface column width');
assert.equal(surface.framePadding(), 17, 'cap mode uses uniform spec padding');
assert.deepEqual(buttons.map(b => b.height), [38, 38]);
assert.deepEqual(buttons.map(b => b.defaultFocus), [true, false], 'keyboard focus defaults to cancel');
assert.deepEqual(surface.actionTouchRegion(), { x: 0, y: -3, width: '100%', height: 44 },
  'book-removal preserves the extended touch region from the original 38vp visual/44vp touch contract');
assert.deepEqual(buttons.map(b => b.responseRegion), [
  { x: 0, y: -3, width: '100%', height: 44 },
  { x: 0, y: -3, width: '100%', height: 44 },
], 'each action cell carries the extended region');
assert.deepEqual(surface.bodyActionsInnerMargin(), { bottom: 30 },
  'the 30vp body-to-actions spacing is an inner gap, never an outer negative margin');
assert.equal(surface.spec().hasBorder, true, 'book-removal keeps the original 1vp border');
metrics.windowRect = new ReaderRectVp(0, 0, 280, 300);
metrics.systemInsets = new ReaderInsetsVp(8, 24, 12, 20);
surface.replay();
assert.ok(surface.resolvedFrame().width <= 240, 'small windows honor side insets');
let routed = [];
surface.onAction = id => routed.push(id);
surface.replay();
buttons[0].onClick(); buttons[1].onClick();
assert.deepEqual(routed, ['cancel', 'confirm'], 'actions dispatch by id through one callback');
assert.ok(surfaceNodes.some(n => n.type === 'Text' && n.create === '移除书架'), 'standard header renders the title');

// Propagation proof: the shared header/actions/geometry live in one component,
// and the json-import spec is a distinct registered variant of the same family.
// Re-probe the same surface source under the second spec id to show the shared
// code paths resolve to that variant's values without any per-dialog copy.
{
  metrics = new ReaderWindowMetricsSnapshot();
  metrics.windowRect = new ReaderRectVp(0, 0, 390, 844);
  const { owner: jsonSurface } = createReaderBuilderProbe(surfaceSource,
    ['body', 'defaultBody', 'build', 'header', 'actionsRow', 'actionCell', 'spec', 'resolvedFrame',
      'frameWidth', 'framePadding', 'actionLabelColor', 'actionSurfaceRole', 'actionModifier',
      'actionTouchRegion', 'bodyActionsInnerMargin'], {
    ReaderWindowCoordinator: { metrics: () => metrics }, readerInteractiveSafeLeft, readerInteractiveSafeRight,
    resolveHorizontalFrame, SurfaceWidthSpec, SurfaceHorizontalFrame: class {
      constructor(left, right, width) { Object.assign(this, { left, right, width }); }
    }, resolveDialogSpec, ButtonType: { Normal: 'Normal' },
  });
  const jsonActions = [
    { id: 'importOnline', label: '从在线链接导入', tone: 'primary', enabled: true, defaultFocus: false },
  ];
  Object.assign(jsonSurface, { appThemeScheme: 'day', readerWindowMetricsRevision: 0,
    specId: 'json-import', title: '导入 JSON', showCloseButton: true, actions: jsonActions });
  jsonSurface.initialRender();
  const jsonSpec = jsonSurface.spec();
  assert.equal(jsonSpec.maxWidth, 520);
  assert.equal(jsonSpec.frameMode, 'card-inset');
  assert.equal(jsonSpec.actionsLayout, 'stack');
  assert.equal(jsonSurface.frameWidth(), 350,
    'card-inset mode sizes the surface to the resolved card width at 390vp/20vp edges');
  assert.equal(jsonSurface.framePadding(), 16, 'card-inset mode keeps uniform spec padding');
  const jsonButtons = [...jsonSurface.nodes.values()].filter(n => n.type === 'Button');
  assert.deepEqual(jsonButtons.map(b => b.height), [44],
    'only the trailing online-import action lives in the shared actions row');
  assert.deepEqual(jsonSurface.actionTouchRegion(), { x: 0, y: 0, width: '100%', height: 44 },
    'json-import actions keep their own 44vp bounds, no legacy extended region');
  assert.deepEqual(jsonSurface.bodyActionsInnerMargin(), {},
    'json-import body-to-actions spacing is a plain gap, no margin ownership');
  assert.equal(jsonSpec.hasBorder, true, 'json-import keeps the original 1vp border');
  // The json-import actions are full-width primary cells using the spec's own
  // dark-primary surface, not the shared 'primary'/TOK_ACCENT default.
  assert.equal(jsonSpec.actionPrimarySurfaceRole, 'TOK_PRIMARY_DARK');
  assert.equal(jsonSpec.actionPrimaryLabelRole, 'TOK_ON_PRIMARY');
  metrics.windowRect = new ReaderRectVp(0, 0, 1440, 900);
  jsonSurface.replay();
  assert.equal(jsonSurface.frameWidth(), 520, 'wide windows clamp to the 520vp spec cap');
  metrics.windowRect = new ReaderRectVp(0, 0, 390, 844);
  jsonSurface.replay();
  assert.ok([...jsonSurface.nodes.values()].some(n => n.type === 'Text' && n.create === '关闭'),
    'showCloseButton header renders the close affordance');
  // Distinct-variant isolation: book-removal stays 306/row/shadow while
  // json-import resolves 520/stack/no-shadow from the same registry.
  const removalSpec = resolveDialogSpec('book-removal');
  assert.equal(removalSpec.maxWidth, 306);
  assert.equal(removalSpec.actionsLayout, 'row');
  assert.equal(removalSpec.hasShadow, true);
  assert.equal(jsonSpec.hasShadow, false, 'variant change does not leak across specs');
  assert.equal(removalSpec.bodyActionsOwnMargin, 30);
  assert.equal(jsonSpec.bodyActionsOwnMargin, 0, 'json-import keeps plain gap spacing');
}

// Shelf-group migration proof: the Index '编辑分组' inline overlay delegates its
// frame to the shared surface under the third registered variant — a preserved
// legacy percentage width (75%) with no actions row and no close button.
assert.match(indexSource, /ReaderDialogSurface\(\{\s*specId: 'shelf-group'/,
  'Index default-group overlay consumes the shared surface');
assert.doesNotMatch(indexSource, /Column\(\{ space: 12 \}\) \{\s*Text\('编辑分组'\)/,
  'the hand-drawn 编辑分组 frame is deleted');
assert.doesNotMatch(indexSource, /\.padding\(20\)\.width\('75%'\)/,
  'no private 75%/padding-20 frame modifier chain remains in Index');
{
  metrics = new ReaderWindowMetricsSnapshot();
  metrics.windowRect = new ReaderRectVp(0, 0, 390, 844);
  const { owner: groupSurface } = createReaderBuilderProbe(surfaceSource,
    ['body', 'defaultBody', 'build', 'header', 'actionsRow', 'actionCell', 'spec', 'resolvedFrame',
      'frameWidth', 'framePadding', 'actionLabelColor', 'actionSurfaceRole', 'actionModifier',
      'actionTouchRegion', 'bodyActionsInnerMargin'], {
    ReaderWindowCoordinator: { metrics: () => metrics }, readerInteractiveSafeLeft, readerInteractiveSafeRight,
    resolveHorizontalFrame, SurfaceWidthSpec, SurfaceHorizontalFrame: class {
      constructor(left, right, width) { Object.assign(this, { left, right, width }); }
    }, resolveDialogSpec, ButtonType: { Normal: 'Normal' },
  });
  Object.assign(groupSurface, { appThemeScheme: 'day', readerWindowMetricsRevision: 0,
    specId: 'shelf-group', title: '编辑分组', showCloseButton: false, actions: [] });
  groupSurface.initialRender();
  const groupSpec = groupSurface.spec();
  assert.equal(groupSpec.widthPercent, 75, 'preserved legacy percentage width');
  assert.equal(groupSurface.frameWidth(), '75%', 'percent spec bypasses cap/inset resolution');
  assert.equal(groupSurface.framePadding(), 20, 'percent spec keeps uniform padding');
  assert.equal(groupSpec.padding, 20);
  assert.equal(groupSpec.borderRadius, 20);
  assert.equal(groupSpec.backgroundRole, 'TOK_SURFACE_SOLID',
    'day #FFFFFCF8 / night #FF2A2622 matches the original Index overlay role exactly');
  assert.equal(groupSpec.hasShadow, false);
  assert.equal(groupSpec.hasBorder, false,
    'the hand-drawn Index frame never drew a border; the spec preserves that');
  assert.equal(groupSpec.headerGap, 12, 'header-body gap preserved from the hand-drawn frame');
  assert.equal(groupSpec.bodyActionsOwnMargin, 0);
  assert.deepEqual(groupSurface.bodyActionsInnerMargin(), {},
    'no actions row means no spacing ownership');
  const groupNodes = [...groupSurface.nodes.values()];
  assert.equal(groupNodes.filter(n => n.type === 'Button').length, 0,
    'an empty actions array renders no action cells');
  assert.ok(!groupNodes.some(n => n.type === 'Text' && n.create === '关闭'),
    'shelf-group header has no close affordance');
  const groupTitle = groupNodes.find(n => n.type === 'Text' && n.create === '编辑分组');
  assert.ok(groupTitle, 'standard header renders the group title');
  assert.equal(groupTitle.textAlign, 'TextAlign.Center',
    'shelf-group preserves the centered title from the former intrinsic Column');
  // Cross-variant isolation after the third registration.
  assert.equal(resolveDialogSpec('book-removal').maxWidth, 306);
  assert.equal(resolveDialogSpec('json-import').frameMode, 'card-inset');
  assert.equal(resolveDialogSpec('book-removal').headerGap, 16,
    'existing specs keep their spacing');
  assert.equal(resolveDialogSpec('book-removal').hasBorder, true);
  assert.equal(resolveDialogSpec('json-import').hasBorder, true,
    'shelf-group is the only borderless variant');
}
console.log('book removal dialog: confirmation admission, cancellation, stale intent, surface delegation, native Builder layout, shared-spec propagation and shelf-group migration PASS');
