import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { resolveHorizontalFrame, SurfaceWidthSpec } from '../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts';
import { readerInteractiveSafeLeft, readerInteractiveSafeRight, ReaderWindowMetricsSnapshot,
  ReaderRectVp, ReaderInsetsVp } from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';

const file = name => new URL(`../entry/src/main/ets/${name}`, import.meta.url);
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
const source = readFileSync(file('features/bookshelf/BookRemovalDialog.ets'), 'utf8');
const { owner } = createReaderBuilderProbe(source, ['build', 'action', 'dialogWidth', 'messageMaxHeight'], {
  ReaderWindowCoordinator: { metrics: () => metrics }, readerInteractiveSafeLeft, readerInteractiveSafeRight,
  resolveHorizontalFrame, SurfaceWidthSpec, ButtonType: { Normal: 'Normal' },
});
let cancel = 0, confirm = 0;
Object.assign(owner, { appThemeScheme: 'day', readerWindowMetricsRevision: 0,
  message: '很长的书名'.repeat(120), measuredMessageHeight: 50,
  onCancel: () => cancel++, onConfirm: () => confirm++ });
owner.initialRender();
const nodes = [...owner.nodes.values()];
const body = nodes.find(n => n.type === 'Text' && n.create === owner.message);
const scroll = nodes.find(n => n.type === 'Scroll');
const buttons = nodes.filter(n => n.type === 'Button');
assert.equal(owner.dialogWidth(), 306);
assert.equal(scroll.height, 50);
assert.equal(body.maxLines, undefined, 'purge notices must not be ellipsized');
assert.equal(body.textOverflow, undefined);
body.onAreaChange({}, { height: '220vp' }); owner.replay();
assert.equal(scroll.height, 220, 'native text measurement expands the notice');
metrics.windowRect = new ReaderRectVp(0, 0, 280, 300);
metrics.systemInsets = new ReaderInsetsVp(8, 24, 12, 20);
metrics.systemFontScale = 2;
owner.replay();
assert.ok(owner.dialogWidth() <= 240, 'small windows honor side insets');
assert.equal(scroll.height, 50, 'long notice scrolls when window height is limited');
assert.deepEqual(buttons.map(b => b.height), [38, 38]);
assert.deepEqual(buttons.map(b => b.responseRegion.height), [44, 44]);
assert.deepEqual(buttons.map(b => b.defaultFocus), [true, false], 'keyboard focus defaults to cancel');
buttons[0].onClick(); buttons[1].onClick();
assert.equal(cancel, 1); assert.equal(confirm, 1);
console.log('book removal dialog: confirmation admission, cancellation, stale intent and native Builder layout PASS');
