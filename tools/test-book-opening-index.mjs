// Exact current Index/Bookshelf ordinary behavior; finite host/frame ports.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
const selectedCases = selectContractCases({
 'palette-and-origin': 'Actual request-time palette and full local host geometry/fallback; no page measurement/backfill.',
 'reverse-terminal': 'Actual Back reversal, authoritative terminal match and serialized reader cleanup/deferred projection.',
 'origin-handshake': 'Actual150ms current origin deadline, old callbacks, unavailable, geometry/navigation admission.',
 'opacity-identities': 'Actual current request/route/finite opacity and stale id refusal.',
 'shelf-admission': 'Actual native shelf enabled expression and real selection/retained unavailable callback admission.',
 'shelf-return-origin': 'Actual Page return-origin frame deduplication, current navigation/key/viewport and unavailable facts.',
});
if (selectedCases.length) {
 const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
 const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
 const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
 const { bookshelfMotionOriginFits, bookshelfMotionLocalOrigin, bookshelfMotionBookKey, shelfMotionWindowRect } = await import('../entry/src/main/ets/features/bookshelf/BookshelfNavigationMotion.ts');
 const { readerAppearanceThemeStyle } = await import('../entry/src/main/ets/features/reading/ReaderAppearanceRenderStyle.ts');
 const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
const { ts, options } = installedEtsCompiler();
const parse = path => {
  const tree = ts.createSourceFile(path, readFileSync(new URL(path, import.meta.url), 'utf8'),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  assert.equal(tree.parseDiagnostics.length, 0, path);
  return tree;
};
const tree = parse('../entry/src/main/ets/pages/Index.ets');
const component = tree.statements.find(n => n.name?.text === 'Index');
const member = name => {
  const node = component.members.find(m => m.name?.getText(tree) === name);
  assert.ok(node, name); return node;
};
const names = ['traceShelfMotion', 'onBackPress', 'shelfMotionViewport', 'sameShelfMotionWindow', 'onShelfMotionWindowChanged',
  'shelfPaperPalette', 'openShelfBookWithMotion', 'beginShelfReturnMotion', 'requestShelfOpeningReverse',
  'resolveShelfReturnMotionFallback', 'receiveShelfReturnMotionUnavailable', 'receiveShelfReturnMotionOrigin',
  'receiveShelfOpeningReaderOpacity', 'clearShelfNavigationMotion', 'finishShelfNavigationMotion',
  'onShelfCoverClosed', 'completeReturnToReadingOrigin', 'nextNavigationGeneration', 'onSearchVisibilityChanged'];
class Frame { constructor(callback) { this.callback = callback; } }
let now = 0, activeTheme = 'day', appearanceFailure = false;
const deps = { hilog: { info: () => {} }, bookshelfMotionOriginFits, bookshelfMotionLocalOrigin, bookshelfMotionBookKey, shelfMotionWindowRect,
  readerAppearanceThemeStyle, readerAppColor, readerMotionNowMs: () => now, ReaderNavigationBackfillFrame: Frame,
  ReaderRuntimeOwner: { current: () => ({ getAppearanceStore: () => ({ current: () => {
    if (appearanceFailure) throw new Error('unavailable');
    return { activeTheme };
  } }) }) } };
const Index = selectedProductionMethods(new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url), 'Index', names, deps);
const book = { sourceId: 's', bookId: 'b', title: 'book', coverUrl: 'cover', contentKind: 'text' };
const origin = { ...book, radius: 8, rect: { x: 50, y: 180, width: 90, height: 130 } };
const windowRect = { x: 0, y: 0, width: 390, height: 844 };
function fixture() {
  const frames = [], calls = { refresh: 0, bind: 0, exit: 0, protection: 0 };
  let available = true;
  const host = { x: 10, y: 20 }, size = { width: 390, height: 844 };
  const ui = { postFrameCallback: f => frames.push(f.callback), px2vp: x => x,
    getFrameNodeById: id => {
      assert.equal(id, 'reader-bookshelf-motion-host', 'only the full host is measured');
      return available ? { getPositionToWindowWithTransform: () => host } : null;
    },
    getComponentUtils: () => ({ getRectangleById: id => {
      assert.equal(id, 'reader-bookshelf-motion-host'); return { size };
    } }) };
  const value = Object.assign(new Index(), { route: 'bookshelf', readingOriginRoute: 'bookshelf',
    detailBook: undefined, readingSessionActive: false, readingContentKind: 'text', shelfMotionSequence: 0,
    navigationGeneration: 7, pendingShelfCoverExitId: -1, shelfMotionReturnNavigation: -1,
    shelfNavigationMotion: undefined, deferredShelfMotionProjection: undefined, returnMotionBookKey: '',
    settingsSnapshot: { reduceMotion: false }, searchAppForeground: true, appThemeScheme: 'day',
    getUIContext: () => ui, hasVisibleImportDialog: () => false, consumeTemporaryBackBridge: () => false,
    transientFeedback: { reset() {} }, nativeAlertOwner: { retire() {} }, bookshelfHost: { detachManagementPresentation() {} },
    readingExitRequest: () => calls.exit++, isCurrentRuntime: () => false,
    bindReadingEntryReader: () => calls.bind++, refreshBookshelf: () => calls.refresh++,
    refreshDetailAcquisitionProjection: () => {},
    openShelfBook: selection => { value.detailBook = selection; value.route = 'reading'; value.readingSessionActive = true; } });
  for (const name of ['retireSettingsPresentation', 'retireSourceManagementPresentation', 'retireSourceSwitchPresentation',
    'retireRssEditorPresentation', 'retireRssPresentation', 'retireReadingEntryPresentation',
    'retireBookshelfCatalogPresentation', 'clearIndexRecoveryNotice']) value[name] = () => {};
  return { value, frames, calls, host, size, unavailable: () => { available = false; },
    frameAt: time => { now = time; const frame = frames.shift(); assert.ok(frame, 'expected queued frame'); frame(); } };
}
function opening() { const f = fixture(); f.value.openShelfBookWithMotion(book, origin); return f; }
function waitingClose() {
  now = 0;
  const f = opening(); f.value.finishShelfNavigationMotion(f.value.shelfNavigationMotion.id);
  assert.equal(f.value.beginShelfReturnMotion(origin), true);
  const id = f.value.shelfNavigationMotion.id;
  f.value.onShelfCoverClosed(id);
  assert.equal(f.value.route, 'bookshelf');
  assert.equal(f.value.shelfNavigationMotion.awaitingOrigin, true);
  return { ...f, id };
}

for (const caseId of selectedCases) {
 now=0; activeTheme='day'; appearanceFailure=false;
 if (caseId === "palette-and-origin") {
// Full-window request geometry and request-time reading palette, including the fallback.
for (const theme of ['day', 'warm', 'green', 'night']) {
  activeTheme = theme;
  const f = opening(), request = f.value.shelfNavigationMotion, style = readerAppearanceThemeStyle(theme);
  assert.deepEqual(request.target, windowRect);
  assert.deepEqual(request.origin.rect, { x: 40, y: 160, width: 90, height: 130 });
  assert.equal(request.paperColor, style.paperStart); assert.equal(request.paperInk, style.ink);
  assert.equal(f.value.shelfOpeningReaderOpacity, 0);
  assert.equal(f.frames.length, 0, 'no page measurement/backfill is scheduled');
  activeTheme = theme === 'night' ? 'day' : 'night';
  assert.equal(request.paperColor, style.paperStart, 'request palette is immutable through motion');
  f.value.beginShelfReturnMotion(origin);
  assert.equal(f.value.shelfNavigationMotion.paperColor, readerAppearanceThemeStyle(activeTheme).paperStart);
  assert.deepEqual(f.value.shelfNavigationMotion.target, windowRect);
}
activeTheme = 'day'; appearanceFailure = true;
const paletteFallback = opening().value.shelfNavigationMotion;
assert.equal(paletteFallback.paperColor, readerAppColor('TOK_PAPER', 'day'));
assert.equal(paletteFallback.paperInk, readerAppColor('TOK_INK', 'day'));
appearanceFailure = false;
const missingOrigin = fixture(); missingOrigin.value.openShelfBookWithMotion(book);
assert.equal(missingOrigin.value.shelfNavigationMotion.fadeOnly, true, 'text falls back to a paper fade without a measured cover');
assert.deepEqual(missingOrigin.value.shelfNavigationMotion.origin.rect, windowRect);
const missingHost = fixture(); missingHost.unavailable(); missingHost.value.openShelfBookWithMotion(book, origin);
assert.equal(missingHost.value.shelfNavigationMotion, undefined, 'unmeasurable host retains ordinary navigation');
for (const kind of ['manga', 'audio']) {
  const f = fixture(); f.value.readingContentKind = kind; f.value.openShelfBookWithMotion(book, origin);
  assert.equal(f.value.shelfNavigationMotion.fadeOnly, true);
  f.value.beginShelfReturnMotion(origin);
  assert.equal(f.value.shelfNavigationMotion.awaitingOrigin, false);
}
const reduced = opening(); reduced.value.settingsSnapshot.reduceMotion = true;
reduced.value.beginShelfReturnMotion(origin);
assert.equal(reduced.value.shelfNavigationMotion.awaitingOrigin, false);
const noCloseOrigin = opening(); noCloseOrigin.value.beginShelfReturnMotion(undefined);
assert.equal(noCloseOrigin.value.shelfNavigationMotion.fadeOnly, true);
assert.equal(noCloseOrigin.value.shelfNavigationMotion.awaitingOrigin, false);

}
 else if (caseId === "reverse-terminal") {
// Back reverses one active open request; all disallowed/repeated backs are consumed.
const reverse = opening(), original = reverse.value.shelfNavigationMotion;
assert.equal(reverse.value.onBackPress(), true);
const reversed = reverse.value.shelfNavigationMotion;
assert.equal(reversed.id, original.id); assert.equal(reversed.direction, 'open'); assert.equal(reversed.reversed, true);
assert.equal(reversed.origin, original.origin); assert.equal(reversed.target, original.target);
assert.equal(reversed.paperColor, original.paperColor); assert.equal(reversed.paperInk, original.paperInk);
assert.equal(reverse.value.onBackPress(), true); assert.equal(reverse.value.shelfNavigationMotion, reversed);
assert.equal(reverse.calls.exit, 0);
for (const blocked of ['fade', 'reduce', 'background']) {
  const f = opening();
  if (blocked === 'fade') f.value.shelfNavigationMotion.fadeOnly = true;
  if (blocked === 'reduce') f.value.settingsSnapshot.reduceMotion = true;
  if (blocked === 'background') f.value.searchAppForeground = false;
  const request = f.value.shelfNavigationMotion;
  assert.equal(f.value.onBackPress(), true); assert.equal(f.value.shelfNavigationMotion, request, blocked);
  assert.equal(f.calls.exit, 0, blocked);
}
reverse.value.searchAppForeground = false;
reverse.value.onSearchVisibilityChanged();
assert.equal(reverse.value.shelfNavigationMotion, reversed, 'background retains an already reversed actor');
const cancelled = opening(); cancelled.value.searchAppForeground = false; cancelled.value.onSearchVisibilityChanged();
assert.equal(cancelled.value.shelfNavigationMotion, undefined, 'ordinary opening keeps existing background cancellation');
const changedRoute = opening(); changedRoute.value.onBackPress(); changedRoute.value.route = 'detail';
changedRoute.value.onSearchVisibilityChanged(); assert.equal(changedRoute.value.shelfNavigationMotion, undefined);

// Use the real finish -> completeReturn -> nextNavigationGeneration chain, not a stub.
let flushed = 0, flushSawRetired = false;
reverse.value.deferredShelfMotionProjection = () => { flushed++; flushSawRetired = !reverse.value.readingSessionActive; };
reverse.value.mountedRuntimeOwner = { setDownloadReadingProtection: () => reverse.calls.protection++ };
const priorNavigation = reverse.value.navigationGeneration;
reverse.value.finishShelfNavigationMotion(reversed.id + 1); assert.equal(reverse.value.shelfNavigationMotion, reversed);
reverse.value.finishShelfNavigationMotion(reversed.id, false);
assert.equal(reverse.value.shelfNavigationMotion, reversed, 'old forward ACK cannot retire accepted Root reverse');
assert.equal(reverse.value.readingSessionActive, true);
assert.equal(reverse.value.navigationGeneration, priorNavigation);
assert.equal(flushed, 0, 'mismatched terminal cannot flush deferred projection');
reverse.value.finishShelfNavigationMotion(reversed.id, true);
assert.equal(reverse.value.shelfNavigationMotion, undefined); assert.equal(reverse.value.readingSessionActive, false);
assert.equal(reverse.value.route, 'bookshelf'); assert.equal(reverse.value.navigationGeneration, priorNavigation + 1);
assert.equal(reverse.value.readingExitRequest, undefined); assert.equal(reverse.value.returnMotionBookKey, '');
assert.equal(reverse.value.shelfMotionReturnNavigation, -1); assert.equal(reverse.value.shelfOpeningReaderOpacity, 0);
assert.equal(reverse.calls.bind, 1); assert.equal(reverse.calls.refresh, 1); assert.equal(reverse.calls.protection, 1);
assert.equal(flushed, 1); assert.equal(flushSawRetired, true);
reverse.value.finishShelfNavigationMotion(reversed.id); assert.equal(flushed, 1, 'late finish is inert');
const normal = opening(); const normalId = normal.value.shelfNavigationMotion.id;
normal.value.finishShelfNavigationMotion(normalId);
assert.equal(normal.value.readingSessionActive, true); assert.equal(normal.value.route, 'reading');
assert.equal(normal.value.shelfOpeningReaderOpacity, 1); assert.equal(normal.value.onBackPress(), true);
assert.equal(normal.calls.exit, 1, 'normal completed opening returns through the serialized reader exit');

}
 else if (caseId === "origin-handshake") {
// The close handshake accepts a new origin at 120 ms and expires by time, not frame count.
const late = waitingClose(), lateOriginal = late.value.shelfNavigationMotion;
late.frameAt(120); assert.equal(late.value.shelfNavigationMotion, lateOriginal);
late.value.receiveShelfReturnMotionOrigin({ ...origin, rect: { ...origin.rect, x: 70 } });
assert.equal(late.value.shelfNavigationMotion.awaitingOrigin, false);
assert.equal(late.value.shelfNavigationMotion.fadeOnly, false);
assert.equal(late.value.shelfNavigationMotion.origin.rect.x, 60);
late.frameAt(150); assert.equal(late.value.shelfNavigationMotion.fadeOnly, false, 'expired callback cannot override accepted origin');
const deadline = waitingClose(), deadlineRequest = deadline.value.shelfNavigationMotion;
for (const time of [16, 32, 48, 64, 149]) {
  deadline.frameAt(time); assert.equal(deadline.value.shelfNavigationMotion, deadlineRequest, `${time}ms remains eligible`);
}
deadline.frameAt(150);
assert.equal(deadline.value.shelfNavigationMotion.awaitingOrigin, false); assert.equal(deadline.value.shelfNavigationMotion.fadeOnly, true);
assert.equal(deadline.value.returnMotionBookKey, '');
assert.equal(deadline.value.shelfNavigationMotion.paperColor, deadlineRequest.paperColor);
assert.equal(deadline.value.shelfNavigationMotion.paperInk, deadlineRequest.paperInk);
const unavailable = waitingClose();
const unavailableRequest = unavailable.value.shelfNavigationMotion;
unavailable.value.receiveShelfReturnMotionUnavailable(unavailable.id, unavailable.value.navigationGeneration);
assert.equal(unavailable.value.shelfNavigationMotion.fadeOnly, true, 'unavailable is immediate without waiting for another frame');
assert.equal(unavailable.value.shelfNavigationMotion.awaitingOrigin, false);
unavailable.frameAt(150); assert.equal(unavailable.value.shelfNavigationMotion.paperColor, unavailableRequest.paperColor);
for (const stale of ['id', 'navigation', 'handshake', 'route']) {
  const f = waitingClose(), request = f.value.shelfNavigationMotion;
  let id = f.id, generation = f.value.navigationGeneration;
  if (stale === 'id') id++;
  if (stale === 'navigation') generation--;
  if (stale === 'handshake') f.value.shelfMotionReturnNavigation--;
  if (stale === 'route') f.value.route = 'reading';
  f.value.receiveShelfReturnMotionUnavailable(id, generation);
  assert.equal(f.value.shelfNavigationMotion, request, `${stale} cannot trigger unavailable`);
}
for (const stale of ['id', 'navigation', 'route']) {
  const f = waitingClose();
  if (stale === 'id') f.value.shelfNavigationMotion = { ...f.value.shelfNavigationMotion, id: f.id + 1 };
  if (stale === 'navigation') f.value.navigationGeneration++;
  if (stale === 'route') f.value.route = 'reading';
  const request = f.value.shelfNavigationMotion; f.frameAt(150);
  assert.equal(f.value.shelfNavigationMotion, request, `${stale} invalidates queued deadline`);
}
for (const invalid of ['identity', 'outside', 'window', 'navigation']) {
  const f = waitingClose(), request = f.value.shelfNavigationMotion;
  let incoming = origin;
  if (invalid === 'identity') incoming = { ...origin, bookId: 'other' };
  if (invalid === 'outside') incoming = { ...origin, rect: { ...origin.rect, x: -500 } };
  if (invalid === 'window') f.size.width++;
  if (invalid === 'navigation') f.value.navigationGeneration++;
  f.value.receiveShelfReturnMotionOrigin(incoming); assert.equal(f.value.shelfNavigationMotion, request, invalid);
}
const closeBack = opening(); closeBack.value.beginShelfReturnMotion(origin);
assert.equal(closeBack.value.onBackPress(), true); assert.equal(closeBack.calls.exit, 0);
closeBack.value.onShelfCoverClosed(closeBack.value.shelfNavigationMotion.id);
assert.equal(closeBack.value.onBackPress(), true); assert.equal(closeBack.calls.exit, 0);
for (const route of ['settings', 'directory', 'detail', 'downloads']) {
  const guarded = fixture(); guarded.value.route = route;
  guarded.value.shelfNavigationMotion = { id: 77, direction: 'close', awaitingOrigin: false };
  guarded.value.bookRemovalDialogOpen = true;
  assert.equal(guarded.value.onBackPress(), true, `${route} consumes Back before route/overlay dispatch`);
  assert.equal(guarded.value.route, route);
}
const resized = opening(); resized.value.onBackPress(); resized.value.onShelfMotionWindowChanged(); resized.size.width++;
resized.frameAt(10); assert.equal(resized.value.shelfNavigationMotion, undefined); assert.equal(resized.value.shelfOpeningReaderOpacity, 1);

}
 else if (caseId === "opacity-identities") {
// Opacity publications preserve request/route identity, including decreasing reverse samples.
const opacity = opening(), opacityId = opacity.value.shelfNavigationMotion.id;
opacity.value.receiveShelfOpeningReaderOpacity(opacityId, .8); opacity.value.onBackPress();
opacity.value.receiveShelfOpeningReaderOpacity(opacityId, .4); assert.equal(opacity.value.shelfOpeningReaderOpacity, .4);
opacity.value.receiveShelfOpeningReaderOpacity(opacityId + 1, .2); assert.equal(opacity.value.shelfOpeningReaderOpacity, .4);
opacity.value.receiveShelfOpeningReaderOpacity(opacityId, NaN); assert.equal(opacity.value.shelfOpeningReaderOpacity, .4);
opacity.value.clearShelfNavigationMotion(false);
opacity.value.receiveShelfOpeningReaderOpacity(opacityId, .2); assert.equal(opacity.value.shelfOpeningReaderOpacity, 1);

}
 else if (caseId === "shelf-admission") {
// Native enabled and the UI selection callback independently guard the remaining close carry.
const enabledNodes = [];
const containsShelf = node => {
  let found = false;
  const visit = value => { if (ts.isCallExpression(value) && ts.isPropertyAccessExpression(value.expression) &&
    value.expression.expression.kind === ts.SyntaxKind.ThisKeyword && value.expression.name.text === 'bookshelfShellContent') found = true;
    ts.forEachChild(value, visit); };
  visit(node); return found;
};
const findEnabled = node => {
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'enabled' &&
    containsShelf(node.expression.expression)) enabledNodes.push(node.arguments[0]);
  ts.forEachChild(node, findEnabled);
};
findEnabled(member('indexContent')); assert.equal(enabledNodes.length, 1, 'one actual shelf carrier admission');
const { enabled } = pureModuleProbe('function enabled() { return (' + enabledNodes[0].getText(tree) + '); }',
 'ShelfNativeAdmission.ets', {}, ['enabled']);
const shelfIdle = fixture();
assert.equal(enabled.call(shelfIdle.value), true);
shelfIdle.value.shelfNavigationMotion = { id: 99, direction: 'close', awaitingOrigin: false };
assert.equal(enabled.call(shelfIdle.value), false);
function callback(name, target) {
  let found;
  const walk = node => {
    if (ts.isPropertyAssignment(node) && node.name.getText(tree) === name) found = node.initializer;
    ts.forEachChild(node, walk);
  };
  walk(member('bookshelfContent')); assert.ok(found, name);
  const { bind } = pureModuleProbe('function bind() { return (' + found.getText(tree) + '); }',
    'ShelfCallback.ets', { generation: target.navigationGeneration, owner: undefined, mounting: 0 }, ['bind']);
  return bind.call(target);
}
let selected = 0;
shelfIdle.value.isCurrentBookshelfPresentation = () => true;
shelfIdle.value.openShelfBookWithMotion = () => selected++;
const select = callback('onBookSelected', shelfIdle.value);
select(book); assert.equal(selected, 0);
shelfIdle.value.shelfNavigationMotion = undefined; select(book); assert.equal(selected, 1);
const retained = opening();
retained.value.isCurrentBookshelfPresentation = presentedNavigation => presentedNavigation === retained.value.navigationGeneration;
const retainedUnavailable = callback('onReturnMotionUnavailable', retained.value);
const oldNavigation = retained.value.navigationGeneration;
retained.value.finishShelfNavigationMotion(retained.value.shelfNavigationMotion.id);
retained.value.beginShelfReturnMotion(origin); retained.value.onShelfCoverClosed(retained.value.shelfNavigationMotion.id);
const currentClose = retained.value.shelfNavigationMotion;
retainedUnavailable(oldNavigation);
assert.equal(retained.value.shelfNavigationMotion, currentClose, 'stale presented navigation cannot resolve new close');
retainedUnavailable(retained.value.navigationGeneration);
assert.equal(retained.value.shelfNavigationMotion.awaitingOrigin, false, 'retained callback resolves current request id');
assert.equal(retained.value.shelfNavigationMotion.fadeOnly, true);

}
 else if (caseId === "shelf-return-origin") {
// BookshelfPage emits one success or unavailable result per key/navigation after viewport restore.
const Page = selectedProductionMethods(new URL('../entry/src/main/ets/features/bookshelf/BookshelfPage.ets', import.meta.url),
 'BookshelfPage', ['scheduleReturnMotionOrigin', 'isShelfPresentationCurrent'], { BookshelfMotionFrameCallback: Frame });
function pageFixture({ books = [book], measured = origin, continuing = false } = {}) {
  const frames = [], successes = [], misses = [];
  const value = Object.assign(new Page(), { mounted: true, viewportRestored: true, reduceMotion: false,
    navigationGeneration: 11, returnMotionBookKey: bookshelfMotionBookKey(book.sourceId, book.bookId),
    returnMotionReported: '', returnMotionFrameQueued: '', continueReading: continuing ? book : undefined,
    viewState: { openedBookKey: bookshelfMotionBookKey(book.sourceId, book.bookId), openedFromContinueReading: continuing },
    rowDataSource: { totalCount: () => books.length === 0 ? 0 : 1, getData: () => books },
    measureBookOrigin: () => measured, getUIContext: () => ({ postFrameCallback: f => frames.push(f.callback) }),
    onReturnMotionOrigin: (value, navigation) => successes.push({ value, navigation }),
    onReturnMotionUnavailable: navigation => misses.push(navigation) });
  return { value, frames, successes, misses };
}
for (const scenario of [{}, { books: [] }, { measured: undefined }, { continuing: true }]) {
  // An explicit missing measurement must survive the default parameter above.
  const f = pageFixture(scenario); if ('measured' in scenario) f.value.measureBookOrigin = () => undefined;
  f.value.scheduleReturnMotionOrigin(); f.value.scheduleReturnMotionOrigin();
  assert.equal(f.frames.length, 1, 'duplicate frame is not queued'); f.frames.shift()();
  const missing = scenario.books?.length === 0 || 'measured' in scenario;
  assert.equal(f.misses.length, missing ? 1 : 0); assert.equal(f.successes.length, missing ? 0 : 1);
  f.value.scheduleReturnMotionOrigin(); assert.equal(f.frames.length, 0, 'result is deduped');
  f.value.navigationGeneration++; f.value.scheduleReturnMotionOrigin(); assert.equal(f.frames.length, 1);
  f.frames.shift()(); assert.equal(f.misses.length + f.successes.length, 2, 'new navigation may report again');
}
for (const invalidation of ['navigation', 'key', 'unmounted', 'viewport']) {
  const f = pageFixture({ books: [] }); f.value.scheduleReturnMotionOrigin();
  if (invalidation === 'navigation') f.value.navigationGeneration++;
  if (invalidation === 'key') f.value.returnMotionBookKey = 'another';
  if (invalidation === 'unmounted') f.value.mounted = false;
  if (invalidation === 'viewport') f.value.viewportRestored = false;
  f.frames.shift()(); assert.equal(f.misses.length + f.successes.length, 0, `${invalidation} rejects queued result`);
}
const reordered = pageFixture({ books: [] });
reordered.value.scheduleReturnMotionOrigin(); const oldFrame = reordered.frames.shift();
reordered.value.navigationGeneration++; reordered.value.scheduleReturnMotionOrigin();
const queuedNew = reordered.value.returnMotionFrameQueued; oldFrame();
assert.equal(reordered.value.returnMotionFrameQueued, queuedNew, 'old callback cannot clear a newer queued request');
assert.equal(reordered.misses.length, 0); reordered.frames.shift()(); assert.equal(reordered.misses.length, 1);
const viewportWait = pageFixture({ books: [] }); viewportWait.value.viewportRestored = false;
viewportWait.value.scheduleReturnMotionOrigin(); assert.equal(viewportWait.frames.length, 0);
viewportWait.value.viewportRestored = true; viewportWait.value.scheduleReturnMotionOrigin();
assert.equal(viewportWait.frames.length, 1);
}
 recordContractCasePass(caseId);
}
}
