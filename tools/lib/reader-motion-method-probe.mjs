import { ReadingRecordIntent, ReadingRecordRecoveryError } from '../../entry/src/main/ets/features/reading/ReaderReadingRecordState.ts';
import { BookRequestNotDispatchedError as ReaderCoreNotDispatchedError } from '../../entry/src/main/ets/app/BookRequestScheduler.ts';
import { ReaderReadingImageResources, sameReaderReadingImageResource } from '../../entry/src/main/ets/features/reading/ReaderReadingImageResources.ts';
import { ReaderNativeAlertOwner, ReaderNativeAlertLease } from '../../entry/src/main/ets/app/ReaderNativeAlertOwner.ts';
import { readingChapterLayoutMap } from '../../entry/src/main/ets/features/reading/ReadingSurfaceLayoutMap.ts';
import { hasKnownReadingImageGeometry } from '../../entry/src/main/ets/features/reading/ReadingChapterWindow.ts';
import { readerAppColor, readerThemeDefinition } from '../../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import { ReaderStartupContentOwner } from '../../entry/src/main/ets/app/ReaderStartupContentOwner.ts';
import { errorMessageOf } from '../../entry/src/main/ets/app/ErrorMessage.ts';
import { ReaderParagraphLayoutOwner } from '../../entry/src/main/ets/features/reading/ReaderParagraphLayoutOwner.ts';
import { ReaderPhysicalPaginationOwner } from '../../entry/src/main/ets/features/reading/ReaderPhysicalPaginationOwner.ts';
import { ReaderProgressProducerHost } from '../../entry/src/main/ets/features/reading/ReaderProgressProducerHost.ts';
import { RssPresentationProjection } from '../../entry/src/main/ets/features/rss/RssPresentationProjection.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { readerTypographyRoles } from './reader-typography-probe.mjs';
import { runtimeOwnerIdentityProbe } from './reader-runtime-admission-probe.mjs';
// Execute the pure production Host unchanged; its ArkTS-relative imports do
// not resolve in Node, so only import bindings are supplied by this probe.
const recordHostSource = readFileSync(new URL('../../entry/src/main/ets/features/reading/ReaderReadingRecordHost.ts', import.meta.url), 'utf8');
const ReaderReadingRecordHost = new Function('ReadingRecordIntent', 'ReadingRecordRecoveryError',
  stripTypeScriptTypes(recordHostSource.replace(/^import[\s\S]*?;\n/gm, '')).replace('export class ', 'class ') +
  '; return ReaderReadingRecordHost;')(ReadingRecordIntent, ReadingRecordRecoveryError);
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(`${sdk}/node_modules/typescript`);
const options = require(`${sdk}/lib/ets_checker.js`).compilerOptions;

/** Execute unmodified ordinary production methods, not a rewritten algorithm.
 * Native-node cleanup is instrumented; platform geometry has its separate SDK/VM suite.
 * This does not simulate ArkUI layout, reactive delivery, or compositor pixels. */
export function productionMotionMethods(file, names, dependencies = {}) {
  const fixtureRuntime = { captureReadingContentValidity: () => () => true, waitForReadingContentIdle: async () => {} };
  dependencies = { ReaderCoreNotDispatchedError, readerAppColor, readerThemeDefinition, readingChapterLayoutMap, hasKnownReadingImageGeometry, errorMessageOf,
    ...readerTypographyRoles, RssPresentationProjection, ReaderParagraphLayoutOwner, ReaderPhysicalPaginationOwner, ReaderStartupContentOwner, ReaderProgressProducerHost, ReaderNativeAlertOwner, ReaderNativeAlertLease, ReaderReadingImageResources, sameReaderReadingImageResource, ReaderReadingRecordHost, ReadingRecordRecoveryError,
    hilog: { error() {} }, ReaderRuntimeOwner: runtimeOwnerIdentityProbe(() => fixtureRuntime), ...dependencies };
  // Older fixtures inject current() as the instance-storage seam. Keep their
  // IO stub, but execute the actual production isCurrent predicate. The
  // original current() remains untouched, including its throwing behavior.
  if (dependencies.ReaderRuntimeOwner.isCurrent === undefined) {
    const injected = dependencies.ReaderRuntimeOwner;
    const authority = runtimeOwnerIdentityProbe(() => { try { return injected.current(); } catch (_error) { return undefined; } });
    dependencies.ReaderRuntimeOwner = Object.assign(Object.create(injected), { isCurrent: authority.isCurrent.bind(authority) });
  }
  const source = readFileSync(file, 'utf8');
  const tree = ts.createSourceFile('/tmp/ReaderMotionProbe.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  assert.equal(tree.parseDiagnostics.length, 0, `${file}: ETS parses`);
  const type = tree.statements.find(n => n.members && names.every(name => n.members.some(m => m.name?.getText(tree) === name)));
  assert.ok(type, `production methods: ${names.join(', ')}`);
  // Preserve the actual captured allocator initializer only for the reader
  // struct declaring it. Non-reader probes must not acquire a reader Runtime.
  const capturedOwnerFields = type.members.filter(m => ['readingImageResources', 'readingRecordHost'].includes(m.name?.getText(tree)))
    .map(m => m.getText(tree)).join('\n');
  // Keep newly factored business helpers real in existing method-level probes.
  // Fixtures can still supply their explicit I/O/lifecycle dependencies.
  names = [...names];
  let expanded;
  do {
    expanded = false;
    for (const helper of ['waitForPredecessorClose', 'errorMessage', 'isCurrentDetailProjection', 'consumeTemporaryBackBridge', 'isCurrentRuntime', 'showReaderAlert', 'showIndexAlert', 'isMountedToken', 'isSelectionCurrent', 'preparePersistedShelfBooks', 'shelfFilter', 'notifyReadingPresentationReady', 'isUnknownCatalogEdge', 'requestCatalogForTurn', 'entryChapterPosition', 'hasPartialEntryWindow', 'resolvePageImagePixels', 'rebuildFragmentIndex', 'prepareRemoteCatalogNearEnd', 'isRemoteCatalogNearEnd', 'remoteReadableChapterPosition', 'updateRemoteReadableChapterOrder', 'admitEntryResume', 'configureReadingChapterWindow', 'setCurrentReadingChapter', 'drainReadingWindowPrefetch', 'continuousProgressDependencies', 'progressProducerIntent', 'retireSourceSwitchPresentation', 'retireRssPresentation', 'persistMeasuredCanonicalProgress', 'readingPrefetchLease']) {
    if (!names.includes(helper) && type.members.some(m => m.name?.getText(tree) === helper) &&
      (capturedOwnerFields.includes(`this.${helper}(`) || type.members.some(m => names.includes(m.name?.getText(tree)) && m.getText(tree).includes(`this.${helper}(`)))) { names.push(helper); expanded = true; }
    }
  } while (expanded);
  const methods = names.flatMap(name => type.members.filter(m => m.name?.getText(tree) === name).map(m => m.getText(tree))).join('\n');
  const Probe = new Function(...Object.keys(dependencies), `${stripTypeScriptTypes(`class Probe {
    paragraphLayout = new ReaderParagraphLayoutOwner(); physicalPagination = new ReaderPhysicalPaginationOwner();
    progressProducers = new ReaderProgressProducerHost();
    nativeAlertOwner = new ReaderNativeAlertOwner();
    nativeTextMeasurement = { clear() {} }; nativeParagraphResources = { close() {}, retain() {} }; ${capturedOwnerFields} ${methods} }`)}; return Probe;`)(...Object.values(dependencies));
  // Existing probes describe pre-refactor component fields. Route those fixture
  // assignments to the real production owners; no production struct accessors
  // or duplicated batching/index-admission algorithm is introduced.
  for (const [alias, owner, field] of [
    ['readingRecordActiveSinceMs', 'readingRecordHost', 'activeSinceMs'], ['readingRecordPendingMillis', 'readingRecordHost', 'pendingMillis'],
    ['paragraphRanges', 'paragraphLayout', 'ranges'], ['measurementBatch', 'paragraphLayout', 'batch'],
    ['nextRangeIndex', 'paragraphLayout', 'nextRangeIndex'], ['firstRangeStartScalar', 'paragraphLayout', 'firstRangeStartScalar'],
    ['paginationIndex', 'physicalPagination', 'index'], ['paginationDraft', 'physicalPagination', 'draft'],
    ['measurementRequestedAnchorScalar', 'physicalPagination', 'requestedAnchor'],
    ['pendingPageFragments', 'physicalPagination', 'fragments'], ['pendingPageStartScalar', 'physicalPagination', 'startScalar'],
    ['pendingPageEndScalar', 'physicalPagination', 'endScalar'], ['pendingPageHeight', 'physicalPagination', 'height'],
    ['continuousCommitInFlight', 'progressProducers', 'continuousInFlight'], ['continuousCommitPending', 'progressProducers', 'continuousPending'],
    ['continuousCommitPromise', 'progressProducers', 'continuousPromise'], ['continuousUnknownTarget', 'progressProducers', 'continuousUnknownTarget'],
    ['continuousUnknownOrigin', 'progressProducers', 'continuousUnknownOrigin'],
  ]) Object.defineProperty(Probe.prototype, alias, { get() { return this[owner][field]; },
    set(value) { this[owner][field] = value; }, configurable: true });
  return Probe;
}
