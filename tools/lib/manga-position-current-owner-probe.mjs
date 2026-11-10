import assert from 'node:assert/strict';
import { selectedProductionClasses, selectedProductionMethods } from './selected-production-methods.mjs';
import { bookshelfOperationClass } from './bookshelf-operation-owner-probe.mjs';
import { actualReadingEntryPresentation } from './reading-entry-presentation-probe.mjs';
import { ProductionHost, setRuntime, BookAcquisitionCoordinator } from './reading-entry-owner-probe.mjs';
import { MangaBookPresentation } from '../../entry/src/main/ets/features/manga/presentation/MangaBookPresentation.ts';
import { ReaderNavigation } from '../../entry/src/main/ets/app/navigation/ReaderNavigation.ts';
import { ReaderEntryStartupTrace } from '../../entry/src/main/ets/app/ReaderStartupTrace.ts';
import { readingEntryInputForSearchContext } from '../../entry/src/main/ets/features/reading/presentation/ReadingEntryDto.ts';
import { pureModuleProbe } from './ets-pure-module-probe.mjs';
import { runtimeOwnerIdentityProbe } from './reader-runtime-admission-probe.mjs';
import { readFileSync } from 'node:fs';

const file = path => new URL('../../entry/src/main/ets/' + path, import.meta.url);
const Entry = actualReadingEntryPresentation({ ReadingEntryHost: ProductionHost });
const Actions = bookshelfOperationClass('app/composition/ReaderReadingEntryActions.ets', 'ReaderReadingEntryActions', {
  Observed: value => value, readingEntryInputForSearchContext,
});
const Exit = bookshelfOperationClass('app/composition/ReaderExitActions.ets', 'ReaderExitActions');
const Directory = selectedProductionMethods(file('app/composition/ReaderDirectoryJourney.ets'), 'ReaderDirectoryJourney', ['navigationPorts']);
export const { readerDirectoryActions } = pureModuleProbe(readFileSync(file('features/reading/presentation/ReaderDirectoryActions.ets'), 'utf8'),
  'ReaderDirectoryActions.ets', {}, ['readerDirectoryActions']);

/** Current full Hydrator, Entry, EntryActions, ExitActions and navigation.
 * Only Gateway IO, animation completion and unrelated surface admission are
 * ports. The Index methods are current wiring; no retired Index fields exist. */
export function mangaPositionOwnerFixture({ runtime = {}, observe = value => value } = {}) {
  let ownedAcquisitions;
  if (runtime.bookAcquisitions === undefined) {
    ownedAcquisitions = new BookAcquisitionCoordinator(async method => assert.fail('unexpected acquisition IO: ' + method), () => false);
    runtime.bookAcquisitions = () => ownedAcquisitions;
  }
  const control = { runtime, pending: [], writes: [], nullEntryBooks: new Set(), refreshes: 0 };
  setRuntime(runtime);
  class Gateway {
    constructor(owner) { this.owner = owner; }
    entry(sourceId, bookId, _index, current) { return new Promise(resolve => control.pending.push({ owner: this.owner,
      sourceId, bookId, current, resolve, kind: 'entry', entryNull: control.nullEntryBooks.has(bookId) })); }
    progress(sourceId, bookId, current) { return new Promise(resolve => control.pending.push({ owner: this.owner,
      sourceId, bookId, current, resolve, kind: 'progress' })); }
  }
  const { MangaPositionHydrator } = selectedProductionClasses(file('features/manga/presentation/MangaPositionHydrator.ts'),
    ['MangaPositionHydrator'], { MangaBookPresentation, MangaSessionGateway: Gateway,
      AppStorage: { setOrCreate: (_key, value) => control.writes.push(value) } });
  const Runtime = runtimeOwnerIdentityProbe(() => control.runtime);
  const IndexPorts = selectedProductionMethods(file('pages/Index.ets'), 'Index', ['hydrateMangaPositions',
    'readingEntryPorts', 'bindReadingEntryReader', 'readingEntryActionPorts', 'readingExitActionPorts',
    'currentReadingRuntime', 'isCurrentRuntime'], { ReaderRuntimeOwner: Runtime });
  const index = new IndexPorts(), navigation = new ReaderNavigation(), entry = observe(new Entry());
  navigation.show('bookshelf');
  Object.assign(index, { navigationOwner: navigation, readingEntry: entry, mangaPositions: new MangaPositionHydrator(),
    detailShelfAdmissionMount: 1, mountedRuntimeOwner: runtime, shelfReceiptRetired: false,
    searchAppForeground: true, arkWebCapturesInput: false,
    libraryAcquisition: { currentOwner: () => control.runtime },
    shelfRead: { snapshot: { books: [], generation: 1, revision: 'r1', continueReading: undefined } },
    sourceSwitchPresentation: { visible: false, pending: undefined, failureMessage: '',
      isSurfacePresented() { return this.visible; }, host: () => undefined },
    mangaSourceSwitch: { selectionVisible: false }, shelfMutations: { snapshot: { removalKey: '' } },
    detailShelf: { readingMembership: () => ({ generation: 0, blocked: false, value: true }) },
    librarySearch: { host: { visibilityChanged() {} } },
    readingCommits: { refreshNearEnd() {} },
    downloadNavigation: { restoreReaderReturn: () => false, captureReaderReturn: () => ({ owner: control.runtime }) },
    showReadingFailure() {}, chooseCachedChapterRefresh: async () => false,
    sourceDisplayName: (_id, name) => name ?? 'Source',
    refreshBookshelf: () => control.refreshes++,
    getUIContext: () => ({ postFrameCallback: () => assert.fail('frame backfill outside position fixture') }),
  });
  Object.defineProperties(index, { route: { get: () => navigation.snapshot().route },
    navigationGeneration: { get: () => navigation.snapshot().generation } });
  index.nextNavigationGeneration = () => { entry.retire(false); return navigation.advance().generation; };
  index.navigateTo = route => navigation.show(route);
  index.publishNavigation = () => {}; // Navigation already owns the published snapshot.
  index.shelfMotion = { pendingExitId: -1, projectAfterOpening: project => project(), resumeReturn() {},
    returnToOrigin: () => index.readingExitActions.completeReturn() }; // Native cover completion port.
  index.returnToReadingOrigin = () => index.shelfMotion.returnToOrigin();
  index.readingEntryActions = new Actions(navigation, new ReaderEntryStartupTrace(() => {}), index.readingEntryActionPorts());
  // The metadata path is selected explicitly; ordinary return does not create
  // unrelated transport work in these position-only fixtures.
  const actionPorts = index.readingExitActionPorts();
  actionPorts.refreshDetail = () => {}; // Metadata IO is driven through EntryActions by its own selected leaf.
  index.readingExitActions = new Exit(navigation, actionPorts);
  const directory = Object.assign(new Directory(), { navigation, ports: {
    publish() {}, advance: () => index.nextNavigationGeneration(), bindReader: () => index.bindReadingEntryReader(),
    openReading: (...args) => index.readingEntryActions.openReading(...args),
    bookmarkFeedback: () => assert.fail('manga target cannot enter text bookmark navigation'),
  } });
  const directoryActions = readerDirectoryActions(() => entry, () => directory.navigationPorts(), () => undefined);
  return { index, entry, navigation, actions: index.readingEntryActions, exit: index.readingExitActions, directoryActions,
    hydrator: index.mangaPositions, control,
    hydrate: books => index.hydrateMangaPositions(books),
    setRuntime(owner) { control.runtime = owner; setRuntime(owner); },
    show: route => navigation.show(route), advance: () => navigation.advance(),
    close() { index.mangaPositions.retire(); entry.retire(false); entry.host?.retire(); index.readingExitActions.dispose(); ownedAcquisitions?.close(); },
  };
}
