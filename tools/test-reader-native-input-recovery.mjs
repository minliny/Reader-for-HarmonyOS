import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { selectedProductionMethods, selectedProductionComponentCallback } from './lib/selected-production-methods.mjs';
import { retainedReaderRoute } from '../entry/src/main/ets/app/navigation/ReaderNavigation.ts';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const cases = selectContractCases({
  'opening-recovery': 'Actual Root/Scene callback and Shell native input attributes recover on the delivered opening Prop using installed SDK dependency tracking. Live first-input rejection remains active.',
});
const root = new URL('../entry/src/main/ets/', import.meta.url);
const file = name => new URL(name, root);
const read = name => readFileSync(file(name), 'utf8');
const shellPath = 'features/reading/ui/ReaderShell.ets';

function check(source) {
  // Keep the exact shipping native input-host attributes. Its body is the
  // finite child seam; pagination/rendering is outside this dependency test.
  const start = source.indexOf("      .id(sourceSwitchTriggerFocusId(this.sourceId, this.bookId, 'reader-body'))");
  const end = source.indexOf(';', start) + 1;
  const close = source.lastIndexOf('\n}');
  assert.ok(start > 0 && end > start && close > end);
  const bounded = source.slice(0, close) + '\n @Builder private selectedInputHost() { Stack() {}\n' +
    source.slice(start, end) + '\n }\n' + source.slice(close);
  const Root = selectedProductionMethods(file('pages/Index.ets'), 'Index',
    ['readerContentInputCurrent', 'currentReadingRuntime', 'currentReaderPresentationIdentity'], { retainedReaderRoute });
  const Entry = selectedProductionMethods(file('features/reading/presentation/ReadingEntryPresentation.ets'),
    'ReadingEntryPresentation', ['readerPresentationIdentity']);
  const Motion = selectedProductionMethods(file('features/bookshelf/ui/BookshelfNavigationPresentation.ets'),
    'BookshelfNavigationPresentation', ['finish', 'coverClosed', 'resetOpeningPaint']);
  const scenarios = [];
  for (const boundary of ['opening', 'hidden', 'directory', 'source', 'manga']) {
    const runtime = {};
    const reading = Object.assign(new Entry(), { sessionActive: true, book: { sourceId: 'local', bookId: 'book' }, readyGeneration: 1 });
    const motion = Object.assign(new Motion(), { request: boundary === 'opening' ? { id: 3, direction: 'open' } : undefined,
      pendingExitId: -1, paint: { opening: { readerOpacity: 0 } }, deferredShelfMotionProjection: undefined, returnBookKey: '' });
    const host = Object.assign(new Root(), { readingEntry: reading, shelfMotion: motion,
      route: boundary === 'directory' ? 'directory' : 'reading', directoryReturnTarget: 'readerControl',
      searchAppForeground: boundary !== 'hidden', arkWebCapturesInput: false, shelfReceiptRetired: false,
      mountedRuntimeOwner: runtime, libraryAcquisition: { currentOwner: () => runtime },
      sourceSwitchPresentation: { isSurfacePresented: () => host.sourcePresented }, sourcePresented: boundary === 'source',
      mangaSourceSwitch: { selectionVisible: boundary === 'manga' } });
    const scene = { ports: { inputCurrent: identity => host.readerContentInputCurrent(identity) } };
    const properties = createArkUIPropertyRuntimeProbe();
    const names = ['sourceId', 'bookId', 'readingReadyGeneration', 'visible', 'route', 'inputAllowed', 'inputCurrent',
      'sourceSwitchPresented', 'sourceSwitchCovered', 'readingIdentityKey', 'readingContentIsForeground', 'selectedInputHost'];
    const { owner } = createReaderBuilderProbe(bounded, names, { ...properties.sdk,
      sourceSwitchTriggerFocusId: (source, book, kind) => JSON.stringify([source, book, kind]) }, properties.hooks);
    Object.assign(owner, { sourceId: 'local', bookId: 'book', readingReadyGeneration: 1,
      visible: boundary !== 'hidden', route: boundary === 'directory' ? 'directory' : 'reading',
      inputAllowed: selectedProductionComponentCallback(file('pages/Index.ets'), 'RetainedReaderScene', 'inputAllowed', host),
      sourceSwitchPresented: boundary === 'source', sourceSwitchCovered: boundary === 'manga',
      inputCurrent: selectedProductionComponentCallback(file('app/composition/RetainedReaderScene.ets'), 'ReaderShell', 'inputCurrent', scene) });
    owner.selectedInputHost();
    const node = [...owner.nodes.values()].find(node => node.type === 'Stack');
    assert.equal(node.enabled, false, `${boundary} starts disabled`);
    if (boundary === 'opening') motion.finish(3);
    host.searchAppForeground = true; host.route = 'reading'; host.sourcePresented = false;
    host.mangaSourceSwitch.selectionVisible = false;
    owner.updateStateVars({ visible: true, route: 'reading', sourceSwitchPresented: false, sourceSwitchCovered: false,
      inputAllowed: selectedProductionComponentCallback(file('pages/Index.ets'), 'RetainedReaderScene', 'inputAllowed', host) });
    properties.flush();
    assert.equal(owner.readingContentIsForeground(), true);
    assert.equal(node.enabled, true, `${boundary} native host recovers on delivered Props`);
    assert.equal(node.focusable, true);
    assert.equal(node.hitTestBehavior, 'HitTestMode.Transparent');
    assert.equal(node.accessibilityLevel, 'auto');
    assert.equal([...owner.nodes.values()].find(node => node.type === 'Stack'), node, 'recovery retains the same native actor');
    host.arkWebCapturesInput = true;
    assert.equal(node.enabled, true, 'published native attribute can precede the next Prop delivery');
    assert.equal(owner.readingContentIsForeground(), false, 'live input still rejects before delayed Props');
    host.arkWebCapturesInput = false;
    assert.equal(owner.readingContentIsForeground(), true);
    scenarios.push(boundary);
  }
  return { scenarios, boundary: 'Installed SDK property/proxy classes and emitted native setters. Dependency notification instrumented. No renderer, pixels or device action.' };
}

for (const id of cases) {
  const source = read(shellPath);
  const result = check(source);
  const old = source.replace(/return this\.inputAllowed && this\.visible && this\.route === 'reading' &&\s*!this\.sourceSwitchPresented && !this\.sourceSwitchCovered &&\s*\(this\.inputCurrent\?\.\(this\.readingIdentityKey\(\)\) \?\? true\);/,
    "return (this.inputCurrent?.(this.readingIdentityKey()) ?? true) && this.inputAllowed && this.visible && this.route === 'reading' && !this.sourceSwitchPresented && !this.sourceSwitchCovered;");
  assert.notEqual(old, source, 'negative restores the preceding live-first predicate');
  assert.throws(() => check(old), /opening native host recovers on delivered Props/);
  console.log(JSON.stringify({ case: id, result, rejectedOldPredicate: true }));
  recordContractCasePass(id);
}
