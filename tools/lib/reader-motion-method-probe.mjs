import { mangaDirectoryAdaptiveFields, mangaDirectoryAdaptiveMembers, mangaDirectoryAdaptiveDependencies } from './manga-directory-adaptive-probe.mjs';
import { ReadingRecordIntent, ReadingRecordRecoveryError } from '../../entry/src/main/ets/features/reading/ReaderReadingRecordState.ts';
import { BookRequestNotDispatchedError as ReaderCoreNotDispatchedError } from '../../entry/src/main/ets/app/BookRequestScheduler.ts';
import { ReaderReadingImageResources, sameReaderReadingImageResource } from '../../entry/src/main/ets/features/reading/ReaderReadingImageResources.ts';
import { ReaderNativeAlertOwner, ReaderNativeAlertLease } from './reader-native-alert-sdk-probe.mjs';
import { readingChapterLayoutMap, prepareReadingChapterLayoutMap } from '../../entry/src/main/ets/features/reading/ReadingSurfaceLayoutMap.ts';
import { prepareReadingParagraphUtf16Ranges, readingParagraphBoundaryMode } from '../../entry/src/main/ets/features/reading/ReadingParagraphProjection.ts';
import { hasKnownReadingImageGeometry } from '../../entry/src/main/ets/features/reading/ReadingChapterWindow.ts';
import { readerAppColor, readerThemeDefinition } from '../../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import { ReaderStartupContentOwner } from '../../entry/src/main/ets/app/ReaderStartupContentOwner.ts';
import { errorMessageOf } from '../../entry/src/main/ets/app/ErrorMessage.ts';
import { ReaderParagraphLayoutOwner } from '../../entry/src/main/ets/features/reading/ReaderParagraphLayoutOwner.ts';
import { ReaderPhysicalPaginationOwner } from '../../entry/src/main/ets/features/reading/ReaderPhysicalPaginationOwner.ts';
import { ReaderProgressProducerHost } from '../../entry/src/main/ets/features/reading/ReaderProgressProducerHost.ts';
import { ReaderWriteEvidence } from '../../entry/src/main/ets/app/ReaderWriteEvidence.ts';
import { RssPresentationProjection } from '../../entry/src/main/ets/features/rss/RssPresentationProjection.ts';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { readerTypographyRoles } from './reader-typography-probe.mjs';
import { actualReaderPageShell } from './reader-page-shell-runtime-probe.mjs';
import { runtimeOwnerIdentityProbe } from './reader-runtime-admission-probe.mjs';
// Execute the pure production Host unchanged; its ArkTS-relative imports do
// not resolve in Node, so only import bindings are supplied by this probe.
const recordHostSource = readFileSync(new URL('../../entry/src/main/ets/features/reading/ReaderReadingRecordHost.ts', import.meta.url), 'utf8');
const ReaderReadingRecordHost = new Function('ReadingRecordIntent', 'ReadingRecordRecoveryError',
  stripTypeScriptTypes(recordHostSource.replace(/^import[\s\S]*?;\n/gm, '')).replace('export class ', 'class ') +
  '; return ReaderReadingRecordHost;')(ReadingRecordIntent, ReadingRecordRecoveryError);
const rulesOwnerSource = readFileSync(new URL('../../entry/src/main/ets/features/settings/RulesMutationOwner.ts', import.meta.url), 'utf8');
const wholeRulesClass = (source, name, names) => new Function(...names,
  stripTypeScriptTypes(source.replace(/^import[\s\S]*?;\n/gm, '')).replace(/\bexport /g, '') + `;return ${name};`);
const rulesOwnerFactory = wholeRulesClass(rulesOwnerSource, 'RulesMutationOwner',
  ['ReaderRuntimeOwner', 'BookRequestNotDispatchedError', 'ReaderWriteEvidence', 'RULES_MUTATION_METHODS', 'RulesMutationIntentStore']);
const storePath = new URL('../../entry/src/main/ets/features/settings/RulesMutationIntentStore.ts', import.meta.url);
const rulesStoreFactory = existsSync(storePath) ? wholeRulesClass(readFileSync(storePath, 'utf8'), 'RulesMutationIntentStore',
  ['ReaderRuntimeOwner', 'RULES_MUTATION_METHODS', 'fileIo', 'util', 'replaceReaderAtomicSnapshot', 'sha256Hex']) : undefined;
const atomicFactory = wholeRulesClass(readFileSync(new URL('../../entry/src/main/ets/app/ReaderAtomicSnapshotFile.ts', import.meta.url), 'utf8'),
  'replaceReaderAtomicSnapshot', ['fileIo']);
// A method probe without an actual platform IO seam cannot manufacture a
// durable rules receipt. Non-rules probes only construct the unchanged owner.
const unsupportedRulesIo = () => { throw new Error('Rules probe requires an explicit platform IO seam'); };
const missingRulesIo = {readText: async () => unsupportedRulesIo(), open: async () => unsupportedRulesIo(),
  fsync: async () => unsupportedRulesIo(), close: async () => unsupportedRulesIo(),
  OpenMode: {READ_WRITE: 2, READ_ONLY: 0}, AtomicFile: class {constructor() {unsupportedRulesIo();}}};
function actualRulesMutationOwner(deps) {
  const io = deps.rulesFileIo ?? deps.fileIo ?? missingRulesIo;
  const store = rulesStoreFactory?.(deps.ReaderRuntimeOwner, RULES_MUTATION_METHODS, io,
    deps.rulesUtil ?? deps.util ?? {generateRandomUUID: unsupportedRulesIo},
    deps.replaceReaderAtomicSnapshot ?? atomicFactory(io),
    deps.rulesSha256Hex ?? deps.sha256Hex ?? unsupportedRulesIo);
  return rulesOwnerFactory(deps.ReaderRuntimeOwner, ReaderCoreNotDispatchedError, ReaderWriteEvidence, RULES_MUTATION_METHODS, store);
}
const rulesContractSource = readFileSync(new URL('../../entry/src/main/ets/features/settings/RulesMutationContract.ts', import.meta.url), 'utf8');
const RULES_MUTATION_METHODS = new Function(stripTypeScriptTypes(rulesContractSource).replace(/\bexport /g, '') + ';return RULES_MUTATION_METHODS;')();
const effectsSource = readFileSync(new URL('../../entry/src/main/ets/app/ReaderRuleMutationEffects.ts', import.meta.url), 'utf8');
const readerRuleMutationEffects = new Function('RULES_MUTATION_METHODS',
  stripTypeScriptTypes(effectsSource.replace(/^import[\s\S]*?;\n/gm, '')).replace(/\bexport /g, '') + ';return readerRuleMutationEffects;')(RULES_MUTATION_METHODS);
const require = createRequire(import.meta.url);
import {bookshelfSourceDisplayName} from '../../entry/src/main/ets/features/bookshelf/BookshelfSourceNameProjection.ts';
import {actualBookshelfOperationTypes} from './bookshelf-operation-owner-probe.mjs';
import {actualSourceManagementTypes} from './source-management-owner-probe.mjs';
import {actualGeneralSettingsTypes} from './general-settings-owner-probe.mjs';
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(`${sdk}/node_modules/typescript`);
const options = require(`${sdk}/lib/ets_checker.js`).compilerOptions;
const paragraphModels = ts.createSourceFile('/tmp/ReaderMeasurementModelsProbe.ets',
  readFileSync(new URL('../../entry/src/main/ets/features/reading/ReadingMeasurementModels.ets', import.meta.url), 'utf8'),
  ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
const paragraphRangeSource = paragraphModels.statements.find(node => node.name?.text === 'ParagraphRange').getText(paragraphModels);
const ParagraphRange = new Function(stripTypeScriptTypes(paragraphRangeSource).replace('export class', 'class') + '; return ParagraphRange;')();

/** Execute unmodified ordinary production methods, not a rewritten algorithm.
 * Native-node cleanup is instrumented; platform geometry has its separate SDK/VM suite.
 * This does not simulate ArkUI layout, reactive delivery, or compositor pixels. */
export function productionMotionMethods(file, names, dependencies = {}) {
  const fixtureRuntime = { captureReadingContentValidity: () => () => true, waitForReadingContentIdle: async () => {} };
  dependencies = { ...mangaDirectoryAdaptiveDependencies, bookshelfSourceDisplayName, ReaderCoreNotDispatchedError, readerAppColor, readerThemeDefinition, prepareMangaSheetFonts: async () => true, readingChapterLayoutMap, prepareReadingChapterLayoutMap, prepareReadingParagraphUtf16Ranges, readingParagraphBoundaryMode, ParagraphRange, hasKnownReadingImageGeometry, errorMessageOf,
    // Execute the current complete page-shell policy through its finite import seam.
    ...actualReaderPageShell(),
    ...readerTypographyRoles, readerRuleMutationEffects, RssPresentationProjection, ReaderParagraphLayoutOwner, ReaderPhysicalPaginationOwner, ReaderStartupContentOwner, ReaderProgressProducerHost, ReaderNativeAlertOwner, ReaderNativeAlertLease, ReaderReadingImageResources, sameReaderReadingImageResource, ReaderReadingRecordHost, ReadingRecordRecoveryError,
    hilog: { error() {} }, ReaderRuntimeOwner: runtimeOwnerIdentityProbe(() => fixtureRuntime), ...dependencies };
  // Older fixtures inject current() as the instance-storage seam. Keep their
  // IO stub, but execute the actual production isCurrent predicate. The
  // original current() remains untouched, including its throwing behavior.
  if (dependencies.ReaderRuntimeOwner.isCurrent === undefined) {
    const injected = dependencies.ReaderRuntimeOwner;
    const authority = runtimeOwnerIdentityProbe(() => {
      try { return typeof injected.current === 'function' ? injected.current() : injected.instance; }
      catch (_error) { return undefined; }
    });
    // Keep the injected singleton storage itself: closeRuntime writes instance
    // on this same authority. An Object.create wrapper would clear a shadow
    // field and leave the original platform fixture's owner retained.
    Object.defineProperty(injected, 'isCurrent', { value: authority.isCurrent.bind(authority),
      configurable: true, writable: true });
  }
  if (dependencies.RulesMutationOwner === undefined) dependencies.RulesMutationOwner = actualRulesMutationOwner(dependencies);
  const source = readFileSync(file, 'utf8');
  const tree = ts.createSourceFile('/tmp/ReaderMotionProbe.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  assert.equal(tree.parseDiagnostics.length, 0, `${file}: ETS parses`);
  const type = tree.statements.find(n => n.members && names.every(name => n.members.some(m => m.name?.getText(tree) === name)));
  assert.ok(type, `production methods: ${names.join(', ')}`);
  // Preserve the actual captured allocator initializer only for the reader
  // struct declaring it. Non-reader probes must not acquire a reader Runtime.
  const needsShelfHost = type.name?.text === 'Index' && type.members.some(m => names.includes(m.name?.getText(tree)) && m.getText(tree).includes('this.bookshelfHost.'));
  if (needsShelfHost) {
    dependencies.BookshelfHost ??= actualBookshelfOperationTypes(dependencies).Host;
    dependencies.IMPORT_PRESENTATION_KEY ??= 'reader.bookshelf.import.presentation.v1';
    const platformValues = new Map();
    dependencies.AppStorage ??= { setOrCreate: (key, value) => platformValues.set(key, value) };
  }
  let capturedOwnerFields = type.members.filter(m => ['readingImageResources', 'readingRecordHost', 'replaceRuntime', 'rulesMutationOwner', ...(needsShelfHost ? ['bookshelfHost'] : [])].includes(m.name?.getText(tree)))
    .map(m => m.getText(tree)).join('\n');
  // Keep newly factored business helpers real in existing method-level probes.
  // Fixtures can still supply their explicit I/O/lifecycle dependencies.
  names = [...names];
  let expanded;
  do {
    expanded = false;
    for (const helper of [...mangaDirectoryAdaptiveMembers, 'searchContentStartInset', 'searchHeaderLayoutKey', 'directoryCurrentPagePosition', 'directoryCurrentIndex', 'directoryEntries', 'directoryFontScale', 'directoryToolHeight', 'directoryInitialWidth', 'directoryHeaderChrome', 'directoryQuickHeight', 'reopenChangedChapter', 'retryLabel', 'notifyPublishedRows', 'rowRenderKey', 'isPrimaryErrorRow', 'primaryErrorRowKey', 'rowHasError', 'requestedLast', 'performPanelAction', 'closePanel', 'invalidatePanelMotion', 'openPanel', 'dismissPanelKeyboard', 'preparePanelFonts', 'settlePanel', 'panelTravel', 'panelWidth', 'panelHeight', 'widePanel', 'clearMangaSourceSwitchSelection', 'waitForPredecessorClose', 'errorMessage', 'isCurrentDetailProjection', 'consumeTemporaryBackBridge', 'isCurrentRuntime', 'showReaderAlert', 'showIndexAlert', 'isMountedToken', 'isSelectionCurrent', 'preparePersistedShelfBooks', 'shelfFilter', 'notifyReadingPresentationReady', 'isUnknownCatalogEdge', 'requestCatalogForTurn', 'entryChapterPosition', 'hasPartialEntryWindow', 'resolvePageImagePixels', 'rebuildFragmentIndex', 'prepareRemoteCatalogNearEnd', 'isRemoteCatalogNearEnd', 'remoteReadableChapterPosition', 'updateRemoteReadableChapterOrder', 'admitEntryResume', 'prepareChapterMeasurementProjection', 'configureReadingChapterWindow', 'setCurrentReadingChapter', 'drainReadingWindowPrefetch', 'continuousProgressDependencies', 'progressProducerIntent', 'retireSourceSwitchPresentation', 'retireSourceManagementPresentation', 'retireSettingsPresentation', 'retireRssPresentation', 'retireRssEditorPresentation', 'retireBookshelfCatalogPresentation', 'isCurrentRssEditorPresentation', 'persistMeasuredCanonicalProgress', 'readingPrefetchLease', 'getReadingEntryHost', 'readingEntryLease', 'applyReadingEntrySnapshot', 'bindReadingEntryReader', 'retireReadingEntryPresentation', 'readingPreparationContext', 'sharedReadingPreparationSeeds', 'chooseCachedChapterRefresh', 'readerReplaceRuntimeCurrent', 'projectReaderReplaceWriteFacts', 'loadDirectoryOperationProjections', 'detailReadableAdmission', 'detailBookKey', 'cancelSourceSwitchCompletion', 'finishSourceSwitchReveal', 'sourceSwitchCompletionKey', 'traceBoundary', 'tracePosition']) {    if (!names.includes(helper) && type.members.some(m => m.name?.getText(tree) === helper) &&
      (capturedOwnerFields.includes(`this.${helper}(`) || type.members.some(m => names.includes(m.name?.getText(tree)) && m.getText(tree).includes(`this.${helper}(`)))) { names.push(helper); expanded = true; }
    }
  } while (expanded);
  if (type.name?.text === 'Index' && names.includes('retireSourceManagementPresentation')) {
    dependencies.SourceHost ??= actualSourceManagementTypes(dependencies).SourceHost;
    capturedOwnerFields += '\n'+type.members.filter(m=>['sourceHost','sourcePresentationIdentity'].includes(m.name?.getText(tree))).map(m=>m.getText(tree)).join('\n');
  }
  if (type.name?.text === 'Index' && names.includes('retireSettingsPresentation')) {
    dependencies.SettingsHost ??= actualGeneralSettingsTypes(dependencies).SettingsHost;
    capturedOwnerFields += '\n'+type.members.filter(m=>['settingsHost','settingsPresentationIdentity'].includes(m.name?.getText(tree))).map(m=>m.getText(tree)).join('\n');
  }
  const mangaPanelHelpers = [...mangaDirectoryAdaptiveMembers, 'performPanelAction', 'closePanel', 'invalidatePanelMotion', 'openPanel',
    'dismissPanelKeyboard', 'preparePanelFonts', 'settlePanel', 'panelTravel', 'panelWidth', 'panelHeight', 'widePanel'];
  const ordinaryField = member => {
    if (member === undefined) return '';
    let text = member.getText(tree);
    for (const decorator of ts.getAllDecorators(member)) text = text.replace(decorator.getText(tree), '');
    return text.trim();
  };
  const pageChromeFields = type.name?.getText(tree) === 'SearchPage' && names.includes('searchContentStartInset')
    ? ['fixedHeaderHeight', 'fixedHeaderLayoutKey'].filter(name => !names.includes(name))
      .map(name => ordinaryField(type.members.find(member => member.name?.getText(tree) === name))).join('\n')
    : '';
if (names.includes('traceBoundary')) capturedOwnerFields += '\n' + ordinaryField(type.members.find(m => m.name?.getText(tree) === 'boundaryTraceEvents'));
  if (names.includes('tracePosition')) capturedOwnerFields += '\n' + ordinaryField(type.members.find(m => m.name?.getText(tree) === 'positionTraceEvents'));
  const panelFields = names.some(name => mangaPanelHelpers.includes(name)) && type.name?.getText(tree) === 'MangaReadingSurface'
    ? [...mangaDirectoryAdaptiveFields, 'isReaderIdentityCurrent', 'panel', 'panelOffset', 'panelScrimOpacity', 'panelPhase', 'panelGeneration', 'panelActionGeneration',
      'panelCloseTask', 'panelCloseResolve', 'panelFontsReady', 'panelFontGeneration', 'reduceMotion', 'directoryOpenRevision', 'directoryCurrentChapterIndex']
      .map(name => ordinaryField(type.members.find(m => m.name?.getText(tree) === name))).join('\n')
    : '';
  // Reader lifecycle probes execute the real visual cancellation chain as
  // well as their original owner methods. Preserve its finite actual state,
  // including inactive defaults; do not replace the production cleanup with
  // fixture noops or acquire visual state in non-reader probes.
  const completionFields = type.name?.getText(tree) === 'ReadingExperience' &&
    names.some(name => ['cancelSourceSwitchCompletion', 'finishSourceSwitchReveal'].includes(name))
    ? ['sourceSwitchCompletion', 'sourceSwitchCompletionEpoch', 'sourceSwitchRevealAnimator',
      'sourceSwitchRevealOpacity', 'sourceSwitchToastTimer', 'sourceSwitchToastText',
      'sourceSwitchVisualSelectionToken', 'consumedSourceSwitchCompletions']
      .filter(name => !names.includes(name))
      .map(name => {
        const member = type.members.find(m => m.name?.getText(tree) === name);
        assert.ok(member, `production completion state accompanies its real helper: ${name}`);
        return ordinaryField(member);
      }).join('\n')
    : '';
  const fields = names.includes('notifyPublishedRows') ? type.members.find(m => m.name?.getText(tree) === 'publishedRowKeys')?.getText(tree) : '';
  if (names.includes('notifyPublishedRows')) assert.ok(fields, 'production manga publication state accompanies its real helper');
  const methods = names.flatMap(name => type.members.filter(m => m.name?.getText(tree) === name).map(m => m.getText(tree))).join('\n');
  const chromePorts = type.name?.getText(tree) === 'MangaReadingSurface' ?
    ['refreshLoginRequiredForControls', 'onWindowChromeChanged', 'restoreAppWindowChrome']
      .filter(name => !names.includes(name)).map(name => `${name}() {}`).join('\n') : '';
  const Probe = new Function(...Object.keys(dependencies), `${stripTypeScriptTypes(`class Probe {
    paragraphLayout = new ReaderParagraphLayoutOwner(); physicalPagination = new ReaderPhysicalPaginationOwner();
    progressProducers = new ReaderProgressProducerHost();
    nativeAlertOwner = new ReaderNativeAlertOwner();
    nativeTextMeasurement = { clear() {} }; nativeParagraphResources = { close() {}, retain() {} }; ${fields ?? ''} ${pageChromeFields} ${panelFields} ${completionFields} ${chromePorts} ${capturedOwnerFields} ${methods} }`)}; return Probe;`)(...Object.values(dependencies));
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
