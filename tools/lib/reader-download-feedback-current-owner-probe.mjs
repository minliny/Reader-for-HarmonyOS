import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { pureModuleProbe } from './ets-pure-module-probe.mjs';
import { selectedProductionMethods } from './selected-production-methods.mjs';
import { installedEtsCompiler } from './ets-compiler-runtime.mjs';
import { actualReadingEntryPresentation } from './reading-entry-presentation-probe.mjs';
import { actualReaderDirectoryOperations } from './reader-directory-operations-probe.mjs';
import { ReaderNavigation } from '../../entry/src/main/ets/app/navigation/ReaderNavigation.ts';
import { errorMessageOf } from '../../entry/src/main/ets/app/ErrorMessage.ts';
import { readingOfflineFailureHint } from '../../entry/src/main/ets/features/reading/presentation/ReadingOfflineFailurePresentation.ts';
import { READER_FEEDBACK_EXTENDED_MS } from '../../entry/src/main/ets/ui/feedback/ReaderTransientFeedback.ts';
import * as downloadProjection from '../../entry/src/main/ets/features/downloads/presentation/SharedDownloadProjection.ts';

const root = new URL('../../entry/src/main/ets/', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const emit = (path, names, deps = {}) => pureModuleProbe(read(path), path, { Observed: value => value, ...deps }, names);
export const { SharedDownloadProjectionRefreshError } = emit('features/downloads/application/SharedDownloadCoordinator.ts',
  ['SharedDownloadProjectionRefreshError']);
const IndexFeedback = selectedProductionMethods(new URL('pages/Index.ets', root), 'Index',
  ['showOfflineDownloadFeedback', 'chooseCachedChapterRefresh', 'showIndexRecoveryNotice'], { READER_FEEDBACK_EXTENDED_MS });

/** Execute the current Index feedback/decision declarations. The final shared
 * transient display adapter is an explicit outbound port, as Toast was in the
 * original fixture; this does not claim dedupe, native rendering or timing. */
function feedbackReceiver(runtime, entry, controls, messages, unavailableContext) {
  const receiver = { readingEntry: entry, mountedRuntimeOwner: runtime,
    shelfReceiptRetired: false, navigationGeneration: 1, detailShelfAdmissionMount: 1,
    route: 'detail', searchAppForeground: true, isCurrentRuntime: owner => owner === runtime && controls.live,
    currentReadingRuntime: () => controls.live ? runtime : undefined,
    journeyRecoveryInputAllowed: () => controls.live,
    getUIContext: () => { if (unavailableContext) throw Error('context gone'); return {}; },
    transientFeedback: { show(context, options, current) {
      if (!current()) return;
      context();
      messages.push(options.message);
    } },
  };
  for (const name of ['showOfflineDownloadFeedback', 'chooseCachedChapterRefresh', 'showIndexRecoveryNotice'])
    receiver[name] = IndexFeedback.prototype[name].bind(receiver);
  return receiver;
}

export function currentDirectoryFeedbackOwners({ runtime, session, offline, entryHost, controls = { live: true },
  messages = [], logs = [], unavailableContext = false, entries = [] }) {
  const Entry = actualReadingEntryPresentation({ ReadingEntryHost: { forRuntime: () => entryHost } });
  const entry = new Entry();
  Object.assign(entry, { book: { ...session.identity, title: 'Book', author: 'Author', contentKind: session.contentKind },
    session, sessionGeneration: 1, directoryPresentationGeneration: 1, toc: entries });
  const receiver = feedbackReceiver(runtime, entry, controls, messages, unavailableContext);
  const Operations = actualReaderDirectoryOperations({ SharedDownloadProjectionRefreshError,
    ReadingOfflineHost: { forRuntime: () => offline } });
  const { ReaderDirectoryJourney } = emit('app/composition/ReaderDirectoryJourney.ets', ['ReaderDirectoryJourney'], {
    ReaderDirectoryOperations: Operations, hilog: { warn: (...args) => logs.push(args), error: (...args) => logs.push(args) },
  });
  const navigation = new ReaderNavigation(); navigation.show('detail');
  const journey = new ReaderDirectoryJourney(navigation, {
    scope: () => ({ owner: runtime, mount: 1, retired: !controls.live, foreground: true, covered: false }),
    ownsRuntime: owner => owner === runtime && controls.live, runtime: () => runtime, entry: () => entry,
    feedback: receiver.showOfflineDownloadFeedback,
    showDownloads() { assert.fail('progress navigation is outside feedback settlement'); },
    afterReaderExitInDetail() { assert.fail('reader exit is outside feedback settlement'); },
    confirmOfflineClear() { assert.fail('cache clear is outside feedback settlement'); },
  });
  return { entry, receiver, operations: journey.operations, journey, navigation, controls, messages, logs };
}

export function currentCachedChapterFeedbackOwners(runtime, host, controls, messages, notices) {
  const Entry = actualReadingEntryPresentation({ ReadingEntryHost: { forRuntime: () => host } });
  const entry = new Entry(); entry.scopeId = 4;
  const receiver = feedbackReceiver(runtime, entry, controls, messages, false);
  const publish = receiver.showIndexRecoveryNotice;
  receiver.showIndexRecoveryNotice = (...args) => {
    const previous = entry.recoveryRevision;
    publish(...args);
    if (entry.recoveryRevision !== previous) notices.push({ ...entry.recoveryNotice, label: entry.recoveryActionLabel });
  };
  return { entry, receiver };
}

/** Actual Host→Presentation batch receipt path. Only coordinator transport and
 * list reload are controlled; no replacement batch/UNKNOWN business model. */
export function currentDownloadPageFeedbackOwners({ task, controls, messages, counts }) {
  const { SharedDownloadHost, withoutDownloadStorageSummary } = emit('features/downloads/application/SharedDownloadHost.ts',
    ['SharedDownloadHost', 'withoutDownloadStorageSummary'], { SharedDownloadProjectionRefreshError,
      SharedDownloadGateway: class {}, ReaderCoreGateway: class {} });
  const { SharedDownloadPresentation } = emit('features/downloads/presentation/SharedDownloadPresentation.ets',
    ['SharedDownloadPresentation'], { SharedDownloadHost, withoutDownloadStorageSummary, ...downloadProjection,
      errorMessageOf, readingOfflineFailureHint, hilog: { warn() {} } });
  const book = { sourceId: 's', bookId: 'b', title: 'Book', author: 'Author', contentKind: 'manga' };
  const runtime = { getDownloadCoordinator: () => ({ async operate() { counts.writes++; await task; } }) };
  const snapshot = { books: [{ ...book, shelfBook: book, key: JSON.stringify(['s', 'b']),
    projectionStatus: 'ready', chapters: [] }], loading: false, error: '', storageSummary: {} };
  const host = new SharedDownloadHost(runtime, () => {}); host.snapshot = snapshot;
  host.reload = async current => { if (current()) counts.reads++; };
  const presentation = new SharedDownloadPresentation();
  Object.assign(presentation, { opening: { owner: runtime, identity: 'd', isRouteCurrent: () => controls.live },
    identity: 'd', host, snapshot });
  const { ts, options } = installedEtsCompiler(), source = read('features/downloads/ui/SharedDownloadScene.ets');
  const tree = ts.createSourceFile('SharedDownloadScene.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  assert.deepEqual(tree.parseDiagnostics, []);
  let refreshArrow;
  const visit = node => {
    if (ts.isPropertyAssignment(node) && node.name.getText(tree) === 'onRefresh') {
      assert.equal(refreshArrow, undefined); refreshArrow = node.initializer;
    }
    ts.forEachChild(node, visit);
  };
  visit(tree); assert.ok(refreshArrow && ts.isArrowFunction(refreshArrow));
  const refresh = new Function('identity', 'return ' + stripTypeScriptTypes('(' + refreshArrow.getText(tree) + ')') + ';')
    .call({ presentation }, 'd');
  return { presentation, host, refresh, intent: { action: 'pause', books: [{ sourceId: 's', bookId: 'b' }] },
    run: intent => presentation.applyIntent('d', intent, message => messages.push(message)) };
}
