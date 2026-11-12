import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import * as errors from '../../entry/src/main/ets/app/ErrorMessage.ts';
import { diagnosticCodeOf } from '../../entry/src/main/ets/app/LogPrivacy.ts';
import { readerRecoveryView } from '../../entry/src/main/ets/app/ReaderRecoveryProjection.ts';
import { normalizeReadingOfflineMaterializationError } from '../../entry/src/main/ets/features/reading/application/ReadingOfflineContract.ts';
import { bookshelfOperationClass } from './bookshelf-operation-owner-probe.mjs';
import { selectedProductionMethods } from './selected-production-methods.mjs';

const file = name => new URL(`../../entry/src/main/ets/features/reading/${name}.ts`, import.meta.url);
const bind = (source, deps, names) => new Function(...Object.keys(deps),
  `${stripTypeScriptTypes(source.replace(/^import[^;]+;\s*/gm, '').replace(/^export /gm, ''))}; return {${names.join(',')}};`)(...Object.values(deps));
const { readingOfflineFailureHint } = bind(readFileSync(file('presentation/ReadingOfflineFailurePresentation'), 'utf8'),
  { ...errors, diagnosticCodeOf, normalizeReadingOfflineMaterializationError }, ['readingOfflineFailureHint']);
const recovery = bind(readFileSync(file('presentation/ReadingDirectoryRecovery'), 'utf8'),
  { readerRecoveryView, readingOfflineFailureHint }, ['readingDirectoryRecovery', 'EMPTY_READING_DIRECTORY_RECOVERY']);
export const directoryOperationsSource = readFileSync(file('presentation/ReaderDirectoryOperations'), 'utf8');

/** Execute the actual feature owner. Reading/offline Host and intent-store
 * ports must be explicit when the fixture exercises the persistence boundary. */
export function actualReaderDirectoryOperations(dependencies = {}, source = directoryOperationsSource) {
  const readOnlyPort = { forRuntime: () => undefined };
  class ReadOnlyIntentStore {}
  return bind(source, { ReaderDirectoryHost: readOnlyPort, ReadingOfflineHost: readOnlyPort,
    BookmarkOperationIntentStore: ReadOnlyIntentStore, CacheClearOperationIntentStore: ReadOnlyIntentStore,
    ...recovery, readingOfflineFailureHint, ...dependencies }, ['ReaderDirectoryOperations']).ReaderDirectoryOperations;
}

export const directoryOperationIndexMembers = ['directoryJourneyPorts'];

export function actualReaderDirectoryJourney(dependencies = {}) {
  return bookshelfOperationClass('app/composition/ReaderDirectoryJourney.ets', 'ReaderDirectoryJourney', {
    hilog: { warn() {}, error() {} }, ...dependencies,
    ReaderDirectoryOperations: actualReaderDirectoryOperations(dependencies),
  });
}

// Some existing journey probes attach the actual reading-directory bindings to
// an already mounted Index fixture. Instantiate its real port initializer on
// that receiver so late replies still see its changing navigation.
export function installDirectoryOperationIndex(page, dependencies) {
  const index = new URL('../../entry/src/main/ets/pages/Index.ets', import.meta.url);
  const { directoryJourneyPorts } = selectedProductionMethods(index, 'Index', ['directoryJourneyPorts']).prototype;
  const Journey = actualReaderDirectoryJourney(dependencies);
  const journey = new Journey(page.navigationOwner, directoryJourneyPorts.call(page));
  Object.defineProperty(page, 'directoryJourney', { value: journey, configurable: true });
  return journey;
}
