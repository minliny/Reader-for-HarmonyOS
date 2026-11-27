import { sourceSwitchTriggerFocusId } from '../../features/source/presentation/SourceSwitchSurfaceLifecycle';
import type { ReaderDirectoryTargetProof } from '../../features/reading/application/ReaderDirectoryTargetProof';
import { ReaderTransientFeedback, READER_FEEDBACK_EXTENDED_MS } from '../../ui/feedback/ReaderTransientFeedback';
import {
  ReaderNativeAlertOwner,
  type ReaderNativeAlertLease,
  type ReaderNativeAlertOptions,
  type ReaderNativeAlertSpecId,
} from '../../ui/platform/ReaderNativeAlertOwner';
import { ReaderNativeAlertWindow } from '../../ui/platform/ReaderNativeAlertWindow';
import { ReaderDocumentPickerActivity } from '../../platform/ReaderDocumentPickerActivity';
import {
  MangaPositionHydrator,
  type MangaPositionCandidate,
  type MangaPositionScene,
} from '../../features/manga/presentation/MangaPositionHydrator';
import { MangaSourceLogin, type MangaSourceLoginScene } from '../../features/manga/presentation/MangaSourceLogin';
import { FrameCallback } from '@kit.ArkUI';
import { readerAppColor } from '../../ui/foundation/ReaderThemeRegistry';
import { BookshelfGroupPresentation } from '../../features/bookshelf/presentation/BookshelfGroupPresentation';
import { LibrarySearchPresentation } from '../../features/search/presentation/LibrarySearchPresentation';
import { ReaderRuntimeOwner } from '../ReaderRuntimeOwner';
import { AppRouteCoordinator, type AppExtensionOpeningPorts, type AppExtensionOpeningScope } from '../AppRouteCoordinator';
import { ReaderUIVerificationProbe, type ReaderUIVerificationChannel } from '../diagnostics/ReaderUIVerificationProbe';
import { ReaderEntryStartupTrace, ReaderStartupTrace, type ReaderShelfEntryPhase } from '../ReaderStartupTrace';
import { ReaderExitActions, type ReaderExitActionPorts } from './ReaderExitActions';
import type { SystemFileOpenReaderIdentity } from '../navigation/ReaderSystemFileOpenNavigationHost';
import { errorMessageOf } from '../ErrorMessage';
import type { ShelfBook, BookshelfState } from '../ReaderCoreGateway';
import type { BookshelfDataState, BookshelfFilter } from '../../features/bookshelf/application/BookshelfFlowGateway';
import { BookshelfDetailPresentation } from '../../features/bookshelf/presentation/BookshelfDetailPresentation';
import type { BookshelfDetailScenePorts } from '../../features/bookshelf/ui/BookshelfDetailScene';
import type { BookshelfReadableAdmissionSnapshot } from '../../features/bookshelf/application/BookshelfReadableAdmissionOwner';
import type { BookshelfOperationSnapshot } from '../../features/bookshelf/application/BookshelfOperationOwner';
import { BookshelfMutationPresentation } from '../../features/bookshelf/presentation/BookshelfMutationPresentation';
import { BookRemovalDialogPresentation } from '../../features/bookshelf/presentation/BookRemovalDialogPresentation';
import { BookshelfManagementPresentation } from '../../features/bookshelf/presentation/BookshelfManagementPresentation';
import { BookshelfHost, type BookshelfManagementSnapshot } from '../../features/bookshelf/application/BookshelfHost';
import {
  BookshelfReadPresentation,
  type BookshelfProjectionScene,
} from '../../features/bookshelf/presentation/BookshelfReadPresentation';
import type {
  BookshelfProjectionOwner,
  BookshelfProjectionSnapshot,
} from '../../features/bookshelf/application/BookshelfProjectionOwner';
import { BookshelfCatalogPresentation } from '../../features/bookshelf/presentation/BookshelfCatalogPresentation';
import type { BookshelfSceneDestination, BookshelfScenePorts } from '../../features/bookshelf/ui/BookshelfScene';
import type { BookshelfDetailReturnFocus } from '../../features/bookshelf/presentation/BookshelfViewState';
import type { BookshelfCatalogOwner } from '../../features/bookshelf/application/BookshelfCatalogOwner';
import type { BookshelfNamedSource } from '../../features/bookshelf/application/BookshelfSourceNameProjection';
import { DiscoverScenePresentation } from '../../features/discover/presentation/DiscoverScenePresentation';
import type { DiscoverBook } from '../../features/discover/application/DiscoverGateway';
import type { RetainedReaderScenePorts } from './RetainedReaderScene';
import { ReaderReadingEntryActions, type ReaderReadingEntryActionPorts } from './ReaderReadingEntryActions';
import {
  ReaderDirectoryJourney,
  type ReaderDirectoryJourneyPorts,
  type ReaderDirectoryJourneyScope,
} from './ReaderDirectoryJourney';
import {
  ReaderSourceSwitchJourney,
  type ReaderSourceSwitchJourneyPorts,
  type ReaderSourceSwitchScope,
} from './ReaderSourceSwitchJourney';
import { readerSourceSwitchActions, type ReaderSourceSwitchActions } from './ReaderSourceSwitchActions';
import type { ReaderSurfaceRect } from '../../ui/layout/ReaderSurfaceRect';
import type { ReadingBookDetail } from '../../features/reading/presentation/ReadingBookDetail';
import {
  ReadingEntryPresentation,
  type ReadingEntryPorts,
  type CachedChapterRecoveryPorts,
  type ReaderExitRequest,
  type ReadingShelfPreparationScene,
  type ReadingDirectoryNavigationPorts,
  type ReadingShelfEntryIntent,
} from '../../features/reading/presentation/ReadingEntryPresentation';
import {
  RemoteChapterCacheRefreshError,
  type RemoteReadingBookSeed,
  type RemoteReadingSession,
} from '../../features/reading/application/RemoteReadingFlowGateway';
import {
  ReadingCommitPresentation,
  type ReadingCommitScene,
  type ReadingCommitPorts,
} from '../../features/reading/presentation/ReadingCommitPresentation';
import {
  MangaSourceSwitchPresentation,
  type MangaSourceSwitchPorts,
  type MangaSourceSwitchScene,
} from '../../features/manga/presentation/MangaSourceSwitchPresentation';
import { RssJourneyPresentation, type RssRoute } from '../../features/rss/presentation/RssJourneyPresentation';
import { SettingsPresentation } from '../../features/settings/presentation/SettingsPresentation';
import type { SettingsDestination } from './SettingsScenes';
import { ReaderLibraryAcquisitionBinding } from './ReaderLibraryAcquisitionBinding';
import { ReaderLibraryJourney, type ReaderLibraryJourneyPorts, type ReaderLibraryScope } from './ReaderLibraryJourney';
import { ReaderSettingsJourney, type ReaderSettingsJourneyPorts, type ReaderSettingsJourneyScope } from './ReaderSettingsJourney';
import { ReaderSourceJourney, type ReaderSourceJourneyPorts, type ReaderSourceJourneyScope } from './ReaderSourceJourney';
import { ReaderDownloadJourney, type ReaderDownloadJourneyPorts, type ReaderDownloadJourneyScope } from './ReaderDownloadJourney';
import { SharedDownloadPresentation } from '../../features/downloads/presentation/SharedDownloadPresentation';
import type { SharedDownloadOpeningIntent } from '../../features/downloads/presentation/SharedDownloadUiContract';
import { RulesManagementPresentation } from '../../features/settings/presentation/RulesManagementPresentation';
import { SourceJourneyPresentation } from '../../features/source/presentation/SourceJourneyPresentation';
import type { SourceSwitchProbeQuery } from '../../features/source/application/SourceSwitchGateway';
import type { SourceSwitchHost, SourceSwitchPendingTransaction } from '../../features/source/application/SourceSwitchHost';
import {
  SourceSwitchPresentation,
  sourceSwitchProbeQuery,
  type SourceSwitchScene,
  type SourceSwitchWorkflowPorts,
} from '../../features/source/presentation/SourceSwitchPresentation';
import { SyncPresentation } from '../../features/sync/presentation/SyncPresentation';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { JsonImportPresentation } from './JsonImportPresentation';
import {
  ReaderNavigation,
  retainedReaderRoute,
  type DetailReturnRoute,
  type DirectoryReturnTarget,
  type ReaderNavigationSnapshot,
  type ReaderReturnContext,
  type ReaderRoute,
  type SettingsSection,
  type ReaderBackTarget,
  type ReaderRouteMotionKind,
  type TemporaryBackScope,
} from '../navigation/ReaderNavigation';

const DOMAIN = 0x5244;

class ReaderSourceFocusFrame extends FrameCallback {
  private readonly action: () => void;
  constructor(action: () => void) { super(); this.action = action; }
  onFrame(_time: number): void { this.action(); }
  onIdle(_remaining: number): void {}
}

class ReaderNavigationBackfillFrame extends FrameCallback {
  private action: () => void;
  constructor(action: () => void) { super(); this.action = action; }
  onFrame(_time: number): void { this.action(); }
  onIdle(_remaining: number): void {}
}

let rssIndexInstance: number = 0;

export interface AppRouteJourneyPorts {
  readonly route: () => ReaderRoute;
  readonly generation: () => number;
  readonly mounting: () => number;
  readonly directoryTarget: () => DirectoryReturnTarget;
  readonly foreground: () => boolean;
  readonly webCapturesInput: () => boolean;
  readonly wideSettings: () => boolean;
  readonly detailPopping: () => boolean;
  readonly scheme: () => string;
  readonly ui: () => UIContext;
  readonly publish: (snapshot: ReaderNavigationSnapshot) => void;
}

/** Owns the current mount and its original route presentations. The page
 * supplies reactive route facts and renders each presentation in place.
 * Retiring an opening does not transfer accepted operations to another owner.
 */
export class AppRouteJourneyBindings {
  private readonly transientFeedback: ReaderTransientFeedback;
  private readonly entryStartupTrace: ReaderEntryStartupTrace;
  readonly shelfMutations: BookshelfMutationPresentation;
  private shelfReceiptRetired: boolean;
  private readonly nativeAlertOwner: ReaderNativeAlertOwner;
  private nativeAlertWindowUnsubscribe: (() => void) | undefined;
  private documentPickerUnsubscribe: (() => void) | undefined;
  readonly shelfGroupPresentation: BookshelfGroupPresentation;
  readonly shelfRead: BookshelfReadPresentation;
  readonly downloadPresentation: SharedDownloadPresentation;
  readonly shelfCatalog: BookshelfCatalogPresentation;
  readonly bookRemovalConfirmation: BookRemovalDialogPresentation;
  readonly shelfManagement: BookshelfManagementPresentation;
  private arkWebBack: (() => boolean) | undefined;
  private detailMoreBack: (() => boolean) | undefined;
  private detailMoreBackIdentity: string;
  readonly jsonImportPresentation: JsonImportPresentation;
  readonly readingEntryActions: ReaderReadingEntryActions;
  readonly rulesPresentation: RulesManagementPresentation;
  readonly discoverPresentation: DiscoverScenePresentation;
  readonly sourceSwitchPresentation: SourceSwitchPresentation;
  readonly readingCommits: ReadingCommitPresentation;
  private readonly sourceSwitchJourney: ReaderSourceSwitchJourney;
  readonly mangaSourceSwitch: MangaSourceSwitchPresentation;
  readonly sourceSwitchActions: ReaderSourceSwitchActions;
  readonly directoryJourney: ReaderDirectoryJourney;
  private readonly mangaPositions: MangaPositionHydrator;
  private readonly mangaSourceLogin: MangaSourceLogin;
  readonly detailShelf: BookshelfDetailPresentation;
  readonly readingEntry: ReadingEntryPresentation;
  readonly settingsPresentation: SettingsPresentation;
  readonly libraryAcquisition: ReaderLibraryAcquisitionBinding;
  readonly librarySearch: LibrarySearchPresentation;
  private readonly bookshelfHost: BookshelfHost;
  private mountedRuntimeOwner: ReaderRuntimeOwner | undefined;
  readonly libraryJourney: ReaderLibraryJourney;
  readonly settingsNavigation: ReaderSettingsJourney;
  readonly sourceJourney: SourceJourneyPresentation;
  readonly sourceNavigation: ReaderSourceJourney;
  readonly downloadNavigation: ReaderDownloadJourney;
  readonly rssInstanceIdentity: number;
  readonly syncPresentation: SyncPresentation;
  readonly rssJourney: RssJourneyPresentation;
  private readonly readingExitActions: ReaderExitActions;
  private readonly navigationOwner: ReaderNavigation;
  private readonly routeCoordinator: AppRouteCoordinator;
  private readonly ports: AppRouteJourneyPorts;

  constructor(navigationOwner: ReaderNavigation, routeCoordinator: AppRouteCoordinator, ports: AppRouteJourneyPorts) {
    this.navigationOwner = navigationOwner;
    this.routeCoordinator = routeCoordinator;
    this.ports = ports;
    this.transientFeedback = new ReaderTransientFeedback();
    this.entryStartupTrace = new ReaderEntryStartupTrace(
      (phase: ReaderShelfEntryPhase, attempt: number, navigation: number, elapsedMs: number): void => {
        hilog.info(DOMAIN, 'Reader',
          'PERF shelf-entry phase=%{public}s attempt=%{public}d navigation=%{public}d elapsedMs=%{public}d',
          phase, attempt, navigation, elapsedMs);
      });
    this.shelfMutations = this.createShelfMutations();
    this.shelfReceiptRetired = false;
    this.nativeAlertOwner = new ReaderNativeAlertOwner();
    this.nativeAlertWindowUnsubscribe = undefined;
    this.documentPickerUnsubscribe = undefined;
    this.shelfGroupPresentation = new BookshelfGroupPresentation();
    this.shelfRead = new BookshelfReadPresentation({
      scene: (): BookshelfProjectionScene | undefined => this.bookshelfProjectionScene(),
      projection: (owner: ReaderRuntimeOwner): BookshelfProjectionOwner | undefined => this.bookshelfHost.projection(owner),
      sources: (): BookshelfNamedSource[][] => [this.librarySearch.host.sources(), this.sourceJourney.snapshot().sources,
        this.sourceJourney.snapshot().tools.sources],
      membership: (books: ShelfBook[]): void => this.librarySearch.host.updateShelf(books),
      accepted: (state: BookshelfDataState): void => this.libraryJourney.acceptShelfState(state),
      ready: (): void => this.traceStartupStage?.('shelf.model-ready', 'ready'),
      beginRead: (): number => this.beginStartupStage?.('shelf.query') ?? -1,
      endRead: (startedAt: number, status: string): void => this.endStartupStage?.('shelf.query', startedAt, status),
    });
    this.downloadPresentation = new SharedDownloadPresentation();
    this.shelfCatalog = this.createShelfCatalog();
    this.bookRemovalConfirmation = new BookRemovalDialogPresentation();
    this.shelfManagement = new BookshelfManagementPresentation();
    this.arkWebBack = undefined;
    this.detailMoreBack = undefined;
    this.detailMoreBackIdentity = '';
    this.jsonImportPresentation = new JsonImportPresentation();
    this.readingEntryActions = new ReaderReadingEntryActions(this.navigationOwner, this.entryStartupTrace, this.readingEntryActionPorts());
    this.rulesPresentation = new RulesManagementPresentation();
    this.discoverPresentation = new DiscoverScenePresentation();
    this.sourceSwitchPresentation = new SourceSwitchPresentation();
    this.readingCommits = new ReadingCommitPresentation(this.readingCommitPorts());
    this.sourceSwitchJourney = new ReaderSourceSwitchJourney(this.navigationOwner, this.sourceSwitchJourneyPorts());
    this.mangaSourceSwitch = new MangaSourceSwitchPresentation(this.mangaSourceSwitchPorts());
    this.sourceSwitchActions = readerSourceSwitchActions(
      (): SourceSwitchPresentation => this.sourceSwitchPresentation,
      (): MangaSourceSwitchPresentation => this.mangaSourceSwitch,
      (): boolean => this.readingEntry.book?.contentKind === 'manga',
      (): SourceSwitchWorkflowPorts => this.sourceSwitchPorts(),
    );
    this.directoryJourney = new ReaderDirectoryJourney(this.navigationOwner, this.directoryJourneyPorts());
    this.mangaPositions = new MangaPositionHydrator();
    this.mangaSourceLogin = new MangaSourceLogin();
    this.detailShelf = new BookshelfDetailPresentation({
      owner: (): ReaderRuntimeOwner | undefined => this.mountedRuntimeOwner,
      isCurrentOwner: (owner: ReaderRuntimeOwner | undefined): boolean => this.isCurrentRuntime(owner),
      retired: (): boolean => this.shelfReceiptRetired, route: (): string => this.route,
      generation: (): number => this.navigationGeneration, mounting: (): number => this.detailShelfAdmissionMount,
      book: (): ReadingBookDetail | undefined => this.readingEntry.book,
      session: (): RemoteReadingSession | undefined => this.readingEntry.session,
      inBookshelf: (): boolean => this.readingEntry.inBookshelf,
      blocked: (book: ReadingBookDetail): boolean => this.readingEntry.sessionActive ||
        this.sourceSwitchPresentation.pending !== undefined || this.sourceSwitchPresentation.host()?.blocksExit(book) === true ||
        this.readingEntry.offlineOperationActive,
      host: (): BookshelfHost => this.bookshelfHost, mutations: (): BookshelfMutationPresentation => this.shelfMutations,
      filter: (): BookshelfFilter => this.shelfFilter(),
      setMembership: (membership: boolean): void => { this.readingEntry.inBookshelf = membership; },
      refreshBookshelf: (): void => this.refreshBookshelf(), refreshSearchMembership: (): void => this.refreshSearchShelfMembership(),
      invalidateProjection: (): void => this.invalidateBookshelfProjection(),
      applyProjection: (shelf: BookshelfDataState): void => this.applyBookshelfState(shelf),
      confirm: (message: string, action: () => void): void => this.openBookRemovalDialog(message, action),
      showFailure: (title: string, message: string): void => this.showReadingFailure(title, message),
      postFrame: (action: () => void): void => this.getUIContext().postFrameCallback(new ReaderNavigationBackfillFrame(action)),
    });
    this.readingEntry = new ReadingEntryPresentation();
    this.settingsPresentation = new SettingsPresentation();
    this.libraryAcquisition = new ReaderLibraryAcquisitionBinding();
    this.librarySearch = new LibrarySearchPresentation(
      (): boolean => this.libraryAcquisition.currentOwner() !== undefined && this.searchAppForeground &&
        (this.route === 'search' || this.navigationOwner.isSearchDetailJourney()),
      (): boolean => this.libraryAcquisition.currentOwner() !== undefined && this.navigationOwner.isSearchDetailJourney(),
    );
    this.bookshelfHost = new BookshelfHost(
      (snapshot: BookshelfManagementSnapshot): void => this.shelfManagement.accept(snapshot),
      (): boolean => this.route === 'bookshelfManagement',
      undefined,
      (snapshot: BookshelfOperationSnapshot, owner: ReaderRuntimeOwner): void => {
        const removalPending = this.shelfMutations.snapshot.removalKey.length > 0;
        const importOpen = this.shelfMutations.snapshot.importPresentation !== undefined;
        this.shelfMutations.accept(snapshot, owner);
        if ((removalPending && this.shelfMutations.snapshot.removalKey.length === 0) ||
          (importOpen && this.shelfMutations.snapshot.importPresentation === undefined)) {
          this.readingExitActions.navigationSettled();
        }
      },
      (snapshots: BookshelfReadableAdmissionSnapshot[], owner: ReaderRuntimeOwner): void => this.detailShelf.accept(snapshots, owner),
    );
    this.libraryJourney = new ReaderLibraryJourney(this.navigationOwner, this.libraryJourneyPorts());
    this.settingsNavigation = new ReaderSettingsJourney(this.navigationOwner, this.settingsNavigationPorts());
    this.sourceJourney = new SourceJourneyPresentation();
    this.sourceNavigation = new ReaderSourceJourney(this.navigationOwner, this.sourceNavigationPorts());
    this.downloadNavigation = new ReaderDownloadJourney(this.navigationOwner, this.downloadNavigationPorts());
    this.rssInstanceIdentity = ++rssIndexInstance;
    this.syncPresentation = new SyncPresentation();
    this.rssJourney = new RssJourneyPresentation({
      route: (): string => this.route, generation: (): number => this.navigationGeneration,
      mounting: (): number => this.detailShelfAdmissionMount, instance: (): number => this.rssInstanceIdentity,
      owner: (): ReaderRuntimeOwner | undefined => this.mountedRuntimeOwner, retired: (): boolean => this.shelfReceiptRetired,
      isCurrentOwner: (owner: ReaderRuntimeOwner | undefined): boolean => this.isCurrentRuntime(owner),
      advance: (): number => this.nextNavigationGeneration(),
      show: (route: RssRoute, motion?: 'tab'): void => this.navigateTo(route, motion),
      endReading: (): void => {
        this.readingEntry.endReading(this.mountedRuntimeOwner);
      },
      importVisible: (): boolean => this.jsonImportPresentation.opening !== undefined,
      openImport: (context: 'rssMerge' | 'rssReplace'): void =>
        this.jsonImportPresentation.openRss(this.rssJourney, context, this.rssJourney.rssPresentationIdentity),
      confirm: (options: ReaderNativeAlertOptions, current: () => boolean): void => {
        this.showIndexAlert('confirmation-cancelable', options, current);
      },
      scheme: (): string => this.appThemeScheme,
    });
    this.readingExitActions = new ReaderExitActions(this.navigationOwner, this.readingExitActionPorts());
  }

  private createShelfMutations(): BookshelfMutationPresentation {
    return new BookshelfMutationPresentation({
      host: (): BookshelfHost => this.bookshelfHost,
      owner: (): ReaderRuntimeOwner | undefined => this.mountedRuntimeOwner,
      isCurrentOwner: (owner: ReaderRuntimeOwner | undefined): boolean => this.isCurrentRuntime(owner),
      route: (): string => this.route, generation: (): number => this.navigationGeneration,
      mounting: (): number => this.detailShelfAdmissionMount, instance: (): number => this.rssInstanceIdentity,
      retired: (): boolean => this.shelfReceiptRetired, filter: (): BookshelfFilter => this.shelfFilter(),
      pickerInputAllowed: (): boolean => this.searchAppForeground && !this.arkWebCapturesInput,
      invalidate: (): void => this.invalidateBookshelfProjection(),
      refreshShelf: (): void => this.refreshBookshelf(),
      apply: (shelf: BookshelfDataState): void => this.applyBookshelfState(shelf),
      readSelection: (): Promise<BookshelfState | undefined> => this.shelfRead.selection(),
      shelfProjection: (): BookshelfProjectionSnapshot => this.shelfRead.snapshot,
      readingActive: (): boolean => this.readingEntry.sessionActive,
      selectionMatches: (selection: BookshelfState, current: () => boolean, filter?: BookshelfFilter): Promise<boolean | undefined> =>
        this.shelfRead.selectionMatches(selection, current, filter),
      confirmRemoval: (message: string, action: () => void): void => this.openBookRemovalDialog(message, action),
      leaveSelection: (): void => this.libraryJourney.returnToBookshelf(),
      finishSelection: (): void => this.libraryJourney.finishSelection(),
      feedback: (message: string, current: () => boolean): void => {
        this.transientFeedback.show(() => this.getUIContext(), { message, duration: READER_FEEDBACK_EXTENDED_MS },
          (): boolean => this.searchAppForeground && current());
      },
    });
  }

  private createShelfCatalog(): BookshelfCatalogPresentation {
    return new BookshelfCatalogPresentation({
      scene: (): BookshelfProjectionScene | undefined => this.bookshelfProjectionScene(),
      catalog: (owner: ReaderRuntimeOwner): BookshelfCatalogOwner | undefined => this.bookshelfHost.catalog(owner),
      automaticAllowed: (): boolean => this.settingsPresentation.autoCheckUpdateEnabled() &&
        !this.readingEntry.sessionActive && this.searchAppForeground,
      revision: (): string => this.shelfRead.snapshot.revision,
      filter: (): BookshelfFilter => this.shelfRead.filter(),
      project: (state: BookshelfDataState): void => {
        this.shelfRead.invalidate();
        this.shelfRead.accept(state, true);
      },
      prefetch: (session: RemoteReadingSession, current: () => boolean, owner: ReaderRuntimeOwner): Promise<void> =>
        this.readingCommits.prefetch(session, undefined, current, owner),
      feedback: (message: string, current: () => boolean): void => {
        this.transientFeedback.show(() => this.getUIContext(),
          { message, duration: READER_FEEDBACK_EXTENDED_MS }, (): boolean => this.searchAppForeground && current());
      },
    });
  }

  private get route(): ReaderRoute { return this.ports.route(); }
  private get navigationGeneration(): number { return this.ports.generation(); }
  private get detailShelfAdmissionMount(): number { return this.ports.mounting(); }
  private get directoryReturnTarget(): DirectoryReturnTarget { return this.ports.directoryTarget(); }
  private get searchAppForeground(): boolean { return this.ports.foreground(); }
  private get arkWebCapturesInput(): boolean { return this.ports.webCapturesInput(); }
  private get appThemeScheme(): string { return this.ports.scheme(); }

  private getUIContext(): UIContext { return this.ports.ui(); }
  private publishNavigation(snapshot: ReaderNavigationSnapshot): void { this.ports.publish(snapshot); }

  runtime(): ReaderRuntimeOwner | undefined { return this.mountedRuntimeOwner; }
  retired(): boolean { return this.shelfReceiptRetired; }

  mount(prepareRoot: () => void): void {
    const owner = ReaderRuntimeOwner.current();
    this.mountedRuntimeOwner = owner;
    this.shelfReceiptRetired = false;
    prepareRoot();
    this.mountPresentations(owner);
  }

  retireOpening(): void { this.shelfReceiptRetired = true; }

  bindWebBack(handler: (() => boolean) | undefined): void { this.arkWebBack = handler; }

  retireDetailBack(): void {
    this.detailMoreBack = undefined;
    this.detailMoreBackIdentity = '';
  }

  hasDetailBack(): boolean { return this.detailMoreBack !== undefined; }
  navigationSettled(): void { this.readingExitActions.navigationSettled(); }
  refreshDetailDirectoryPosition(): void { this.directoryJourney.refreshDetailPosition(); }

  private mountPresentations(owner: ReaderRuntimeOwner): void {
    this.libraryAcquisition.mount(owner, {
      ownsRuntime: (owner: ReaderRuntimeOwner): boolean => this.isCurrentRuntime(owner),
      detailBook: (): ReadingBookDetail | undefined => this.readingEntry.book,
      refreshShelf: (): void => this.refreshBookshelf(),
      refreshMembership: (): void => this.refreshSearchShelfMembership(),
      refreshDetail: (): void => { void this.readingEntryActions.refreshDetailAcquisition(); },
    });
    this.librarySearch.model.verification = {
      enabled: (): boolean => ReaderUIVerificationProbe.enabled(),
      emit: (kind: string, channel: ReaderUIVerificationChannel, payload: Object): void =>
        ReaderUIVerificationProbe.emit(kind, channel, payload),
    };
    this.librarySearch.mount();
    this.detailShelf.mount(owner);
    // Mount after configuration recovery to avoid recursively waiting on that barrier.
    this.settingsPresentation.mount(owner, (): void => this.shelfCatalog.automatic(this.shelfRead.snapshot.books));
    this.shelfMutations.restore();
    // Show the shelf immediately and read original source-switch receipts in parallel.
    this.refreshBookshelf();
    void this.reconcilePendingSourceSwitches();
    this.mountSystemFileOpenNavigation(owner);
  }

  disposePresentations(): void {
    this.sourceSwitchPresentation.retireMangaRecovery();
    this.entryStartupTrace.retire();
    this.libraryAcquisition.dispose();
    this.mangaPositions.retire();
    this.nativeAlertWindowUnsubscribe?.();
    this.nativeAlertWindowUnsubscribe = undefined;
    this.documentPickerUnsubscribe?.();
    this.documentPickerUnsubscribe = undefined;
    this.readingExitActions.dispose();
    this.transientFeedback.reset();
    this.downloadPresentation.dispose();
    this.readingCommits.retire();
    this.navigationOwner.retire();
    this.settingsPresentation.dispose();
    this.sourceJourney.retire();
    this.nativeAlertOwner.retire();
    this.shelfCatalog.retire();
    this.shelfManagement.retire();
    this.shelfGroupPresentation.retire();
    this.discoverPresentation.retire();
    this.rulesPresentation.retire();
    this.syncPresentation.retire();
    this.bookRemovalConfirmation.dismiss();
    this.dismissJsonImport();
    this.shelfRead.retire();
    this.shelfMutations.detach();
    this.detailShelf.detach();
    this.rssJourney.retire();
    this.readingEntry.clearExitRequest();
    // The library binding already retires this root's preparation scope.
    this.readingEntry.retire(false);
    this.retireSourceSwitchPresentation();
    this.librarySearch.dispose();
    this.librarySearch.model.verification = undefined;
    this.mountedRuntimeOwner = undefined;
  }

  onBackPress(): boolean {
    if (this.currentReadingRuntime() === undefined) return false;
    if (this.ports.detailPopping()) return true;
    return this.navigationOwner.dispatchBack({
      wideSettings: this.ports.wideSettings(),
      nativeSurface: (): boolean => this.arkWebBack?.() === true ||
        (this.route === 'detail' && (this.shelfGroupPresentation.back() || this.detailMoreBack?.() === true)),
      mangaSelection: this.mangaSourceSwitch.selectionVisible ? (): void => this.mangaSourceSwitch.backFromSelection() : undefined,
      bookRemoval: this.bookRemovalConfirmation.isOpen() ? (): void => { this.bookRemovalConfirmation.dismiss(); } : undefined,
      jsonImport: this.jsonImportPresentation.opening !== undefined ? (): void => this.dismissJsonImport() : undefined,
      sourceSwitch: this.sourceSwitchPresentation.isSurfacePresented() ? this.sourceSwitchActions.back : undefined,
      bookshelfImport: this.route === 'bookshelf' && this.shelfMutations.snapshot.importPresentation !== undefined ?
        (): void => this.shelfMutations.closeImport() : undefined,
      bookshelfGroup: (): boolean => this.shelfGroupPresentation.back(),
      temporaryOwner: (): ReaderRuntimeOwner | undefined => this.currentReadingRuntime(),
      onTemporaryFailure: (error: Error): void => {
        try { hilog.error(DOMAIN, 'Reader', 'Temporary surface Back failed: %{private}s', errorMessageOf(error)); } catch (_) {}
      },
      shelfPreparation: this.readingEntryActions.shelfPreparing ? (): void => this.cancelShelfReadingPreparation() : undefined,
      destination: (target: ReaderBackTarget): void => this.dispatchBackDestination(target),
    });
  }

  visibilityChanged(): void {
    this.transientFeedback.reset();
    if (this.libraryAcquisition.currentOwner() === undefined || this.shelfReceiptRetired) return;
    this.readingEntry.shelfPreparationVisibilityChanged((): ReadingShelfPreparationScene => this.readingShelfPreparationScene());
    this.libraryAcquisition.visibilityChanged(this.route === 'search' && this.searchAppForeground);
    this.librarySearch.host.visibilityChanged();
    void this.readingEntryActions.refreshDetailAcquisition();
    this.readingExitActions.navigationSettled();
  }

  private setSettingsSection(section: SettingsSection): void {
    this.publishNavigation(this.navigationOwner.setSettingsSection(section));
  }

  private navigateTo(route: ReaderRoute, motion?: ReaderRouteMotionKind): void {
    this.publishNavigation(this.navigationOwner.show(route, motion));
  }

  private readingEntryActionPorts(): ReaderReadingEntryActionPorts {
    return {
      runtime: (): ReaderRuntimeOwner | undefined => this.currentReadingRuntime(),
      mounting: (): number => this.detailShelfAdmissionMount,
      entry: (): ReadingEntryPresentation => this.readingEntry,
      search: (): LibrarySearchPresentation => this.librarySearch,
      sourceSwitch: (): SourceSwitchPresentation => this.sourceSwitchPresentation,
      shelfBooks: (): ShelfBook[] => this.shelfRead.snapshot.books,
      removalPending: (): boolean => this.shelfMutations.snapshot.removalKey.length > 0,
      advance: (): number => this.nextNavigationGeneration(),
      show: (route: ReaderRoute, motion?: 'pop'): void => this.navigateTo(route, motion),
      bindReader: (): void => this.bindReadingEntryReader(),
      restoreReaderReturn: (context: ReaderReturnContext | undefined): boolean => this.downloadNavigation.restoreReaderReturn(context),
      entryPorts: (owner: ReaderRuntimeOwner): ReadingEntryPorts => this.readingEntryPorts(owner),
      sourceName: (sourceId: string, name?: string): string => this.sourceDisplayName(sourceId, name),
      detailReadAllowed: (): boolean => this.journeyRecoveryInputAllowed(),
      failure: (title: string, message: string): void => this.showReadingFailure(title, message),
      afterOpening: (project: () => void): void => project(),
      postFrame: (action: () => void): void => this.getUIContext().postFrameCallback(new ReaderNavigationBackfillFrame(action)),
      refreshNearEnd: (session: RemoteReadingSession, chapterIndex: number): void => this.readingCommits.refreshNearEnd(session, chapterIndex),
    };
  }

  private readingCommitPorts(): ReadingCommitPorts {
    return {
      entry: (): ReadingEntryPresentation => this.readingEntry,
      scene: (): ReadingCommitScene => ({ owner: this.mountedRuntimeOwner, retired: this.shelfReceiptRetired,
        navigation: this.navigationGeneration, mounting: this.detailShelfAdmissionMount,
        active: this.readingEntry.sessionActive, readyGeneration: this.readingEntry.readyGeneration }),
      ownsRuntime: (owner: ReaderRuntimeOwner): boolean => this.isCurrentRuntime(owner),
      finalize: (sourceId: string, bookId: string, transactionId: string): SourceSwitchPendingTransaction | undefined =>
        this.sourceSwitchPresentation.finalizeTarget(this.sourceSwitchScene(), { sourceId, bookId }, transactionId),
      cleanup: (sourceId: string, bookId: string): void => this.directoryJourney.operations.cleanupRetiredSource(sourceId, bookId),
      sourceName: (sourceId: string, name: string): string => this.sourceDisplayName(sourceId, name),
      applyRefreshedSession: (session: RemoteReadingSession): void => this.readingEntryActions.acceptReaderSession(session),
      refreshShelf: (): void => this.refreshBookshelf(),
      notifyFileNavigation: (): void => this.consumeSystemFileOpen(),
      diagnostic: (stage: 'window' | 'catalog', message: string): void => {
        hilog.warn(DOMAIN, 'Reader', stage === 'catalog' ? 'Near-end catalog refresh failed: %{private}s' :
          'Rolling chapter cache incomplete: %{private}s', message);
      },
    };
  }

  private sourceSwitchJourneyPorts(): ReaderSourceSwitchJourneyPorts {
    return {
      scope: (): ReaderSourceSwitchScope => ({ owner: this.mountedRuntimeOwner,
        retired: this.shelfReceiptRetired, mount: this.detailShelfAdmissionMount }),
      runtime: (): ReaderRuntimeOwner | undefined => this.currentReadingRuntime(),
      entry: (): ReadingEntryPresentation => this.readingEntry,
      entryActions: (): ReaderReadingEntryActions => this.readingEntryActions,
      entryPorts: (owner: ReaderRuntimeOwner): ReadingEntryPorts => this.readingEntryPorts(owner),
      source: (): SourceSwitchPresentation => this.sourceSwitchPresentation,
      manga: (): MangaSourceSwitchPresentation => this.mangaSourceSwitch,
      search: (): LibrarySearchPresentation => this.librarySearch,
      shelfBooks: (): ShelfBook[] => this.shelfRead.snapshot.books,
      removalPending: (): boolean => this.shelfMutations.snapshot.removalKey.length > 0,
      captureReturn: (): ReaderReturnContext | undefined => this.downloadNavigation.captureReaderReturn(),
      restoreReturn: (context: ReaderReturnContext | undefined): boolean => this.downloadNavigation.restoreReaderReturn(context),
      advance: (): void => { this.nextNavigationGeneration(); },
      showReading: (): void => this.navigateTo('reading'),
      leaveReader: (): void => this.readingExitActions.completeReturn(),
      bindReader: (): void => this.bindReadingEntryReader(),
      sourceName: (sourceId: string, name?: string): string => this.sourceDisplayName(sourceId, name),
      invalidateDownloads: (): void => this.downloadPresentation.invalidateMembership(),
      refreshShelf: (): void => this.refreshBookshelf(),
      navigationSettled: (): void => this.consumeSystemFileOpen(),
    };
  }

  private mangaSourceSwitchPorts(): MangaSourceSwitchPorts {
    const ports: MangaSourceSwitchPorts = {
      scene: (): MangaSourceSwitchScene => this.sourceSwitchJourney.mangaScene(),
      entry: (): ReadingEntryPresentation => this.readingEntry,
      source: (): SourceSwitchPresentation => this.sourceSwitchPresentation,
      sourceHost: (): SourceSwitchHost | undefined => this.getSourceSwitchHost(),
      query: (): SourceSwitchProbeQuery => this.sourceSwitchProbeQuery(),
      ownsRuntime: (owner: ReaderRuntimeOwner): boolean => this.isCurrentRuntime(owner),
      preview: (seed: RemoteReadingBookSeed, sourceName: string, session: RemoteReadingSession, shelfSnapshot: ShelfBook | undefined): void =>
        this.sourceSwitchJourney.preview(seed, sourceName, session, shelfSnapshot),
      committed: (book: ShelfBook, session: RemoteReadingSession, chapterIndex: number): void =>
        this.performSourceSwitchSeam(book, session, chapterIndex),
      chapterStartFeedback: (current: () => boolean): void => {
        try { this.transientFeedback.show(() => this.getUIContext(), { message: '已从本章开头继续' },
          (): boolean => this.searchAppForeground && current()); } catch (_) {}
      },
      refreshShelf: (): void => this.refreshBookshelf(),
      showReaderFailure: (): void => this.sourceSwitchJourney.presentReaderFailure(),
      savedRecovery: (message: string, current: () => boolean): void => {
        try { this.transientFeedback.show(() => this.getUIContext(), { message, duration: READER_FEEDBACK_EXTENDED_MS },
          (): boolean => this.journeyRecoveryInputAllowed() && current()); }
        catch (_) {}
      },
      recovery: (message: string, label: string, retry: (() => void) | undefined, current: () => boolean): void =>
        this.showIndexRecoveryNotice(message, label, retry, current),
      consumeFileOpen: (): void => this.consumeSystemFileOpen(),
    };
    return ports;
  }

  private directoryJourneyPorts(): ReaderDirectoryJourneyPorts {
    return {
      scope: (): ReaderDirectoryJourneyScope => ({ owner: this.mountedRuntimeOwner, mount: this.detailShelfAdmissionMount,
        retired: this.shelfReceiptRetired, foreground: this.searchAppForeground !== false,
        covered: this.arkWebCapturesInput || this.sourceSwitchPresentation.isSurfacePresented() || this.mangaSourceSwitch.selectionVisible }),
      ownsRuntime: (owner: ReaderRuntimeOwner | undefined): boolean => this.isCurrentRuntime(owner),
      runtime: (): ReaderRuntimeOwner | undefined => this.currentReadingRuntime(),
      entry: (): ReadingEntryPresentation => this.readingEntry,
      shelfBooks: (): ShelfBook[] => this.shelfRead.snapshot.books,
      removalPending: (): boolean => this.shelfMutations.snapshot.removalKey.length > 0,
      publish: (snapshot: ReaderNavigationSnapshot): void => this.publishNavigation(snapshot),
      advance: (): void => { this.nextNavigationGeneration(); },
      openReading: (chapter: number, proof?: ReaderDirectoryTargetProof): void => this.openReading(chapter, proof),
      bindReader: (): void => this.bindReadingEntryReader(),
      requestExit: (): void => this.requestReadingExit(),
      showDownloads: (key: string): void => {
        if (this.readingEntry.sessionActive) this.downloadNavigation.requestFromReader(key);
        else this.downloadNavigation.open({ kind: 'fresh', detailKey: key });
      },
      afterReaderExitInDetail: (action: () => void): void => this.requestReaderBookInfo(action),
      confirmOfflineClear: (title: string, message: string, accept: () => void, current: () => boolean): void =>
        this.confirmDirectoryCacheClear(title, message, accept, current),
      feedback: (message: string): void => this.showOfflineDownloadFeedback(message),
      bookmarkFeedback: (book: ReadingBookDetail, message: string): void => {
        try {
          this.transientFeedback.show(() => this.getUIContext(), { message },
            (): boolean => this.searchAppForeground && !this.shelfReceiptRetired &&
            this.isCurrentRuntime(this.mountedRuntimeOwner) && this.readingEntry.book === book);
        } catch (_) {}
      },
    };
  }

  private libraryJourneyPorts(): ReaderLibraryJourneyPorts {
    return {
      scope: (): ReaderLibraryScope => ({ owner: this.mountedRuntimeOwner, instance: this.rssInstanceIdentity, mounting: this.detailShelfAdmissionMount,
        retired: this.shelfReceiptRetired, inputAllowed: this.searchAppForeground && !this.arkWebCapturesInput }),
      ownsRuntime: (owner: ReaderRuntimeOwner): boolean => this.isCurrentRuntime(owner),
      shelfHost: (): BookshelfHost => this.bookshelfHost,
      management: (): BookshelfManagementPresentation => this.shelfManagement,
      group: (): BookshelfGroupPresentation => this.shelfGroupPresentation,
      read: (): BookshelfReadPresentation => this.shelfRead,
      catalog: (): BookshelfCatalogPresentation => this.shelfCatalog,
      preparePersistedShelf: (): void => this.preparePersistedShelfBooks(),
      emptyShelfReady: (): void => this.traceStartupStage?.('shelf.empty-model-ready', 'ready'),
      mutations: (): BookshelfMutationPresentation => this.shelfMutations,
      runtime: (): ReaderRuntimeOwner | undefined => this.currentReadingRuntime(),
      search: (): LibrarySearchPresentation => this.librarySearch,
      acquisition: (): ReaderLibraryAcquisitionBinding => this.libraryAcquisition,
      reading: (): ReadingEntryPresentation => this.readingEntry,
      readingActions: (): ReaderReadingEntryActions => this.readingEntryActions,
      shelfBooks: (): ShelfBook[] => this.shelfRead.snapshot.books,
      sourceName: (sourceId: string): string => this.sourceDisplayName(sourceId),
      failure: (title: string, message: string): void => this.showReadingFailure(title, message),
      advance: (): number => this.nextNavigationGeneration(),
      publish: (snapshot: ReaderNavigationSnapshot): void => this.publishNavigation(snapshot),
      refreshMembership: (): void => this.refreshSearchShelfMembership(),
      refreshShelf: (): void => this.refreshBookshelf(),
      readbackOnBookshelf: (): void => this.detailShelf.readbackOnBookshelf(),
      clearRssSelection: (): void => this.rssJourney.clearSelection(),
      showDiscover: (): void => this.openDiscover(true),
      feedback: (message: string, current: () => boolean): void => {
        this.transientFeedback.show(() => this.getUIContext(), { message, duration: READER_FEEDBACK_EXTENDED_MS },
          (): boolean => this.searchAppForeground && current());
      },
      bookshelfInputAllowed: (): boolean => this.searchAppForeground && this.bookshelfContentAcceptsInput(),
      back: (): void => { this.onBackPress(); },
    };
  }

  private settingsNavigationPorts(): ReaderSettingsJourneyPorts {
    return {
      scope: (): ReaderSettingsJourneyScope => ({ owner: this.mountedRuntimeOwner, instance: this.rssInstanceIdentity,
        mounting: this.detailShelfAdmissionMount, retired: this.shelfReceiptRetired,
        inputAllowed: this.rulesManagementInputAllowed() }),
      ownsRuntime: (owner: ReaderRuntimeOwner): boolean => this.isCurrentRuntime(owner),
      settings: (): SettingsPresentation => this.settingsPresentation,
      rules: (): RulesManagementPresentation => this.rulesPresentation,
      readingActions: (): ReaderReadingEntryActions => this.readingEntryActions,
      reading: (): ReadingEntryPresentation => this.readingEntry,
      advance: (): void => { this.nextNavigationGeneration(); },
      publish: (snapshot: ReaderNavigationSnapshot): void => this.publishNavigation(snapshot),
      showBookshelf: (): void => this.libraryJourney.returnToBookshelf(),
    };
  }

  private sourceNavigationPorts(): ReaderSourceJourneyPorts {
    return {
      scope: (): ReaderSourceJourneyScope => ({ owner: this.mountedRuntimeOwner, instance: this.rssInstanceIdentity,
        mounting: this.detailShelfAdmissionMount, retired: this.shelfReceiptRetired,
        inputAllowed: this.searchAppForeground && !this.arkWebCapturesInput }),
      ownsRuntime: (owner: ReaderRuntimeOwner): boolean => this.isCurrentRuntime(owner),
      runtime: (): ReaderRuntimeOwner | undefined => this.currentReadingRuntime(),
      presentation: (): SourceJourneyPresentation => this.sourceJourney,
      reading: (): ReadingEntryPresentation => this.readingEntry,
      search: (): LibrarySearchPresentation => this.librarySearch,
      acquisition: (): ReaderLibraryAcquisitionBinding => this.libraryAcquisition,
      settings: (): ReaderSettingsJourney => this.settingsNavigation,
      advance: (): void => { this.nextNavigationGeneration(); },
      publish: (snapshot: ReaderNavigationSnapshot): void => this.publishNavigation(snapshot),
      refreshMembership: (): void => this.refreshSearchShelfMembership(),
    };
  }

  private downloadNavigationPorts(): ReaderDownloadJourneyPorts {
    return {
      scope: (): ReaderDownloadJourneyScope => ({ instance: this.rssInstanceIdentity, mounting: this.detailShelfAdmissionMount,
        inputAllowed: this.searchAppForeground && !this.arkWebCapturesInput }),
      runtime: (): ReaderRuntimeOwner | undefined => this.currentReadingRuntime(),
      downloads: (): SharedDownloadPresentation => this.downloadPresentation,
      reading: (): ReadingEntryPresentation => this.readingEntry,
      readingActions: (): ReaderReadingEntryActions => this.readingEntryActions,
      exitActions: (): ReaderExitActions => this.readingExitActions,
      shelfBooks: (): ShelfBook[] => this.shelfRead.snapshot.books,
      advance: (): void => { this.nextNavigationGeneration(); },
      publish: (snapshot: ReaderNavigationSnapshot): void => this.publishNavigation(snapshot),
      showBookshelf: (): void => this.libraryJourney.returnToBookshelf(),
      showSettings: (): void => this.settingsNavigation.returnToSettings(),
      openDetailDirectory: (): void => this.directoryJourney.open('detail'),
      feedback: (message: string): void => this.showOfflineDownloadFeedback(message),
    };
  }

  private readingExitActionPorts(): ReaderExitActionPorts {
    return {
      entry: (): ReadingEntryPresentation => this.readingEntry,
      runtime: (): ReaderRuntimeOwner | undefined => this.currentReadingRuntime(),
      mounting: (): number => this.detailShelfAdmissionMount,
      foreground: (): boolean => this.searchAppForeground && !this.arkWebCapturesInput && ReaderNativeAlertWindow.hasWindow(),
      captureReturn: (): ReaderReturnContext | undefined => this.downloadNavigation.captureReaderReturn(),
      switchBlocked: (book: ReadingBookDetail): boolean => this.sourceSwitchPresentation.host()?.blocksExit(book) === true,
      fileOpenBlocked: (): boolean => !ReaderNativeAlertWindow.hasWindow() || ReaderNativeAlertWindow.isPresented() ||
        ReaderDocumentPickerActivity.isPending() ||
        this.shelfMutations.snapshot.removalKey.length > 0 ||
        (this.route === 'bookshelf' && this.shelfMutations.snapshot.importPresentation !== undefined),
      advance: (): void => { this.nextNavigationGeneration(); },
      publish: (snapshot: ReaderNavigationSnapshot): void => this.publishNavigation(snapshot),
      bindReader: (): void => this.bindReadingEntryReader(),
      hydrateMangaPosition: (book: ReadingBookDetail): void => this.hydrateMangaPositions([book]),
      refreshDetail: (): void => { void this.readingEntryActions.refreshDetailAcquisition(); },
      refreshShelf: (): void => this.refreshBookshelf(),
      returnToBookshelf: (): void => this.libraryJourney.returnToBookshelf(),
      returnFromDetail: (): void => this.libraryJourney.returnFromDetail(),
      showDownloads: (intent: SharedDownloadOpeningIntent): void => this.downloadNavigation.open(intent),
      showRules: (): void => this.settingsNavigation.presentRulesFromReader(),
      unavailableDownloads: (): void => this.showOfflineDownloadFeedback('阅读位置尚未就绪，请稍后打开下载管理'),
      prepareFileOpen: (): void => {
        this.retireSourceSwitchPresentation();
        this.dismissJsonImport();
      },
      openShelfBook: (book: ShelfBook): void => this.openShelfBook(book),
      resolveFileReaderTransaction: async (book: SystemFileOpenReaderIdentity): Promise<void> => {
        await this.resolveReaderSourceSwitchTransaction(book.sourceId, book.bookId);
      },
      fileNotice: (message: string, current: () => boolean): void => {
        this.transientFeedback.show(() => this.getUIContext(), { message }, (): boolean => this.searchAppForeground && current());
      },
    };
  }

  private cancelShelfReadingPreparation(): void { this.readingExitActions.cancelShelfPreparation(); }

  private dispatchBackDestination(target: ReaderBackTarget): void {
    switch (target) {
      case 'bookshelf':
        this.libraryJourney.returnToBookshelf(undefined, !this.ports.wideSettings() ? undefined : 'tab');
        break;
      case 'leaveSelection': this.libraryJourney.backFromSelection(); break;
      case 'bookshelfSettingsOrigin': this.settingsNavigation.returnFromBookshelfSettings(); break;
      case 'generalSettingsHome': this.setSettingsSection('home'); break;
      case 'settings': this.settingsNavigation.returnToSettings(); break;
      case 'searchMode': this.libraryJourney.back(); break;
      case 'sourceManagement': this.sourceNavigation.returnToManagement(); break;
      case 'sourceOrigin': this.sourceNavigation.returnFromManagement(); break;
      case 'downloadsOrigin': this.downloadNavigation.returnFromDownloads(); break;
      case 'rulesOrigin': this.settingsNavigation.returnFromRulesManagement(); break;
      case 'directoryOrigin': this.closeDirectory(); break;
      case 'readerExit': this.requestReadingExit(); break;
      case 'detailExit': this.handleDetailBack(); break;
      case 'rss': this.rssJourney.returnToRss(); break;
      case 'rssFeed': this.rssJourney.returnFromRssSourceFeed(); break;
      case 'rssEntry': this.rssJourney.returnFromRssEntryDetail(); break;
      case 'rssSubscriptionList': this.rssJourney.returnToRssSubscriptionManagement(); break;
    }
  }

  private handleDetailBack(): void {
    this.navigationOwner.backFromDetail(this.readingEntry.currentExitLease(), (): void => this.libraryJourney.returnFromDetail());
  }

  bookshelfScenePorts(owner: ReaderRuntimeOwner | undefined, mounting: number): BookshelfScenePorts {
    return {
      isCurrent: (navigation: number): boolean => this.isCurrentBookshelfPresentation(navigation, owner, mounting),
      isInteractive: (navigation: number): boolean => this.isInteractiveBookshelfPresentation(navigation, owner, mounting),
      registerMore: (handler: (() => void) | undefined, identity: string, navigation: number): void => {
        if (handler === undefined || (owner === this.mountedRuntimeOwner && mounting === this.detailShelfAdmissionMount &&
          navigation === this.navigationGeneration)) this.librarySearch.bindShelfMore(identity, navigation, mounting, handler);
      },
      registerBack: (handler: (() => boolean) | undefined, identity: string, navigation: number): void => {
        this.registerTemporaryBackBridge('bookshelf', navigation, owner, handler, identity);
      },
      measureContinueCard: (rect: ReaderSurfaceRect | undefined, navigation: number, bookKey: string): void => {
        if (owner === undefined || owner !== this.mountedRuntimeOwner || !this.isCurrentRuntime(owner) ||
          this.shelfReceiptRetired || mounting !== this.detailShelfAdmissionMount ||
          navigation !== this.navigationGeneration || (this.route !== 'bookshelf' && this.route !== 'search')) return;
        this.librarySearch.measureContinueCard(rect, navigation, mounting, bookKey, this.shelfRead.snapshot.continueReading);
      },
      prepareVisibleBooks: (books: ShelfBook[]): void => this.prepareVisibleReadingBooks(books),
      openDestination: (destination: BookshelfSceneDestination): void => {
        switch (destination) {
          case 'search': this.libraryJourney.openSearch('empty-shelf'); break;
          case 'discover': this.openDiscover(); break;
          case 'rss': this.rssJourney.openRss(); break;
          case 'settings': this.settingsNavigation.openSettings(); break;
          case 'bookshelfSettings': this.settingsNavigation.openBookshelfSettings(); break;
          case 'bookshelfManagement': this.libraryJourney.openBookshelfManagement(); break;
          case 'downloads': this.downloadNavigation.open(); break;
        }
      },
      openBook: (selection: ShelfBook): void => this.openShelfBook(selection),
      openSelection: (book?: ShelfBook): void => this.libraryJourney.openBookshelfMultiSelect(book),
      openBookInfo: (book: ShelfBook, focus?: BookshelfDetailReturnFocus): void =>
        this.navigationOwner.openBookshelfDetail(focus, (): void => this.openShelfBookInfo(book)),
      takeDetailReturnFocus: (navigation: number): BookshelfDetailReturnFocus | undefined =>
        this.navigationOwner.takeReturnedBookshelfFocus(navigation),
      openGroup: (book: ShelfBook, focusTarget?: string): void => this.libraryJourney.openShelfGroup(book, focusTarget),
    };
  }

  bookshelfModalVisible(): boolean {
    return this.route === 'bookshelf' && (this.shelfMutations.snapshot.importPresentation !== undefined ||
      this.shelfGroupPresentation.identity.length > 0);
  }

  bookshelfContentAcceptsInput(): boolean {
    return !this.arkWebCapturesInput && this.route === 'bookshelf' && !this.readingEntryActions.shelfPreparing &&
      !this.readingEntry.sessionActive && !this.bookshelfModalVisible() &&
      !this.sourceSwitchPresentation.isSurfacePresented() && !this.mangaSourceSwitch.selectionVisible;
  }

  isInteractiveBookshelfPresentation(generation: number, owner: ReaderRuntimeOwner | undefined,
    mounting: number): boolean {
    return this.libraryJourney.isInteractiveBookshelf(generation, owner, mounting);
  }

  detailScenePorts(): BookshelfDetailScenePorts {
    return {
      captureAction: (identity: string): (() => boolean) => {
        const owner = this.mountedRuntimeOwner;
        return (): boolean => this.isCurrentDetailPresentation(identity, owner);
      },
      captureDocumentSave: (identity: string): (() => boolean) => {
        const owner = this.mountedRuntimeOwner;
        return (): boolean => this.detailOwnsRoute() && owner !== undefined &&
          this.mountedRuntimeOwner === owner && this.isCurrentRuntime(owner) && this.detailShelf.isCurrent(identity);
      },
      retainedShareFile: async (bookId: string, current: () => boolean): Promise<string | undefined> => {
        const owner = this.currentReadingRuntime();
        return owner === undefined || !current() ? undefined : owner.retainedLocalBookSourcePath(bookId, current);
      },
      openReading: (chapterIndex?: number): void => this.openReading(chapterIndex),
      openDirectory: (): void => this.openFullDirectory(),
      retryCatalog: (): void => {
        const owner = this.currentReadingRuntime();
        if (owner !== undefined) this.readingEntry.retryDirectoryCatalog(owner);
      },
      openSourceSwitch: (focusId?: string): void => this.openDetailSourceSwitch(focusId),
      openDownloads: (): void => this.downloadNavigation.open(),
      openGroup: (identity: string, focusId?: string): void => { void this.openCurrentDetailGroup(identity, focusId); },
      projectCurrentChapter: (identity: string): void => {
        const owner = this.mountedRuntimeOwner;
        const current = (): boolean => this.isCurrentDetailPresentation(identity, owner);
        if (current()) this.readingEntry.projectDetailDirectoryPosition(owner, this.shelfRead.snapshot.books, current);
      },
      registerMoreBack: (handler: (() => boolean) | undefined, identity: string): void => {
        if (handler === undefined && this.detailMoreBackIdentity !== identity) return;
        this.detailMoreBackIdentity = handler === undefined ? '' : identity;
        this.detailMoreBack = handler;
      },
      back: (): void => { this.onBackPress(); },
    };
  }

  private async openCurrentDetailGroup(identity: string, focusId?: string): Promise<void> {
    const owner = this.mountedRuntimeOwner;
    const book = this.readingEntry.book;
    if (owner === undefined || book === undefined || !this.readingEntry.inBookshelf ||
      !this.isCurrentDetailPresentation(identity, owner)) return;
    const mounting = this.detailShelfAdmissionMount, navigation = this.navigationGeneration;
    const current = (): boolean => this.route === 'detail' && this.mountedRuntimeOwner === owner &&
      this.isCurrentRuntime(owner) && this.detailShelfAdmissionMount === mounting && this.navigationGeneration === navigation &&
      this.detailShelf.isCurrent(identity) && this.readingEntry.inBookshelf &&
      this.readingEntry.book?.sourceId === book.sourceId && this.readingEntry.book?.bookId === book.bookId;
    try {
      const shelfBook = await this.bookshelfHost.loadShelfBook(book.sourceId, book.bookId);
      if (!current() || !this.detailContentIsForeground() || shelfBook === undefined ||
        shelfBook.sourceId !== book.sourceId || shelfBook.bookId !== book.bookId) return;
      this.shelfGroupPresentation.open(owner, shelfBook, identity, current, (): void => {
        this.shelfRead.invalidate();
        this.refreshBookshelf();
      }, (message: string, admitted: () => boolean): void => {
        this.transientFeedback.show(() => this.getUIContext(), { message, duration: READER_FEEDBACK_EXTENDED_MS },
          (): boolean => this.searchAppForeground && current() && admitted());
      }, focusId, (): boolean => this.detailContentIsForeground() && current());
    } catch (error) {
      if (current()) hilog.warn(DOMAIN, 'Reader', 'Detail shelf group lookup: %{private}s', errorMessageOf(error));
    }
  }

  detailContentIsForeground(): boolean {
    return this.searchAppForeground !== false && this.detailOwnsRoute();
  }

  private detailOwnsRoute(): boolean {
    return !this.arkWebCapturesInput && this.route === 'detail' &&
      this.shelfGroupPresentation.identity.length === 0 &&
      !this.sourceSwitchPresentation.isSurfacePresented() && !this.mangaSourceSwitch.selectionVisible;
  }

  private isCurrentDetailPresentation(identity: string, owner: ReaderRuntimeOwner | undefined): boolean {
    return this.detailContentIsForeground() && owner !== undefined && this.mountedRuntimeOwner === owner &&
      this.isCurrentRuntime(owner) && this.detailShelf.isCurrent(identity);
  }

  private isDirectoryOpeningCurrent(opening: number, target: DirectoryReturnTarget): boolean {
    return this.directoryJourney.isOpeningCurrent(opening, target);
  }

  isDetailDirectoryRoute(): boolean {
    return this.route === 'directory' && this.directoryReturnTarget === 'detail';
  }

  openDiscoveredBook(generation: number, book: DiscoverBook): void {
    if (!this.isCurrentRoute(generation, 'discover') || !this.searchAppForeground || this.arkWebCapturesInput) return;
    this.navigationOwner.admitDetailFrom('discover', (): void => {
      this.readingEntryActions.openRemoteDetail({ seed: { sourceId: book.sourceId, bookId: book.bookId,
        detailUrl: book.bookId, title: book.name, author: book.author, coverUrl: book.coverUrl, intro: book.intro,
        contentKind: book.category === 'comic' ? 'manga' : 'text' }, sourceName: this.sourceDisplayName(book.sourceId) }, 'discover');
    });
  }

  openDiscover(returningFromDetail: boolean = false, motion?: 'tab'): void {
    this.routeCoordinator.openExtension(this.rssInstanceIdentity, 'discover', returningFromDetail ? 'pop' : motion,
      this.extensionOpeningPorts((owner: ReaderRuntimeOwner, identity: string, current: () => boolean): void =>
        this.discoverPresentation.open(owner, identity, current, returningFromDetail)));
  }

  openSettingsDestination(destination: SettingsDestination): void {
    switch (destination) {
      case 'source': this.sourceNavigation.openManagement(); break;
      case 'rulesManagement': this.settingsNavigation.openRulesManagement(); break;
      case 'sync': this.openSync(); break;
      case 'bookshelfSettings': this.settingsNavigation.openBookshelfSettings(); break;
      case 'downloads': this.downloadNavigation.open(); break;
      case 'rss': this.rssJourney.openRss(); break;
      case 'discover': this.openDiscover(); break;
    }
  }

  rulesManagementInputAllowed(): boolean {
    return this.searchAppForeground && !this.arkWebCapturesInput && this.jsonImportPresentation.opening === undefined;
  }

  registerTemporaryBackBridge(
    scope: TemporaryBackScope,
    generation: number,
    owner: ReaderRuntimeOwner | undefined,
    handler: (() => boolean) | undefined,
    identity: string,
    blocksSettingsSwitch?: () => boolean,
  ): void {
    if (owner === undefined || this.currentReadingRuntime() !== owner) return;
    this.navigationOwner.setTemporaryBack(scope, generation, owner, handler, identity, blocksSettingsSwitch);
  }

  private registerDirectoryBackBridge(target: DirectoryReturnTarget, opening: number,
    handler: (() => boolean) | undefined, identity: string): void {
    this.directoryJourney.registerBack(target, opening, handler, identity);
  }

  private isCurrentRuntime(owner: ReaderRuntimeOwner | undefined): boolean {
    return owner !== undefined && ReaderRuntimeOwner.isCurrent(owner);
  }

  canUseJsonImport(): boolean {
    return !this.shelfReceiptRetired && this.searchAppForeground && !this.arkWebCapturesInput;
  }

  private dismissJsonImport(): void { this.jsonImportPresentation.dismiss(); }

  showIndexAlert(spec: ReaderNativeAlertSpecId, options: ReaderNativeAlertOptions,
    isCurrent: () => boolean = (): boolean => true): ReaderNativeAlertLease | undefined {
    if (this.shelfReceiptRetired || !this.searchAppForeground || this.arkWebCapturesInput) return undefined;
    try {
      const owner = ReaderRuntimeOwner.current();
      const generation = this.navigationGeneration;
      const route = this.route;
      const current = (): boolean => {
        if (this.shelfReceiptRetired || !this.searchAppForeground || this.arkWebCapturesInput) return false;
        try { return this.isCurrentRuntime(owner) && generation === this.navigationGeneration &&
          this.route === route && isCurrent(); }
        catch (_) { return false; }
      };
      return this.nativeAlertOwner.present(
        (native: ReaderNativeAlertOptions): void => this.getUIContext().showAlertDialog(native), spec, options, current);
    } catch (error) {
      // The native notice is a separate platform outcome. A durable import,
      // deletion or read ACK must survive a synchronous presentation failure.
      try { hilog.warn(DOMAIN, 'Reader', 'Native Alert presentation failed: %{private}s', errorMessageOf(error)); }
      catch (_) {}
      return undefined;
    }
  }

  private openSync(): void {
    this.routeCoordinator.openExtension(this.rssInstanceIdentity, 'sync', undefined,
      this.extensionOpeningPorts((owner: ReaderRuntimeOwner, identity: string, current: () => boolean): void =>
        this.syncPresentation.open(owner, identity, current)));
  }

  private extensionOpeningPorts(
    open: (owner: ReaderRuntimeOwner, identity: string, current: () => boolean) => void,
  ): AppExtensionOpeningPorts {
    return {
      advance: (): void => { this.nextNavigationGeneration(); },
      endReading: (): void => { this.readingEntry.endReading(this.mountedRuntimeOwner); },
      show: (route: ReaderRoute, motion?: ReaderRouteMotionKind): void => this.navigateTo(route, motion),
      scope: (): AppExtensionOpeningScope => ({ owner: this.mountedRuntimeOwner, mounting: this.detailShelfAdmissionMount,
        generation: this.navigationGeneration, route: this.route, retired: this.shelfReceiptRetired }),
      isCurrentOwner: (owner: ReaderRuntimeOwner): boolean => this.isCurrentRuntime(owner),
      open,
    };
  }

  private openShelfBook(selection: ShelfBook): void {
    this.readingEntryActions.resumeShelf(selection);
  }

  private readingEntryPorts(owner: ReaderRuntimeOwner): ReadingEntryPorts {
    const generation = this.navigationGeneration, mounting = this.detailShelfAdmissionMount;
    return {
      current: (): boolean => !this.shelfReceiptRetired && this.libraryAcquisition.currentOwner() === owner &&
        generation === this.navigationGeneration && mounting === this.detailShelfAdmissionMount,
      projectionVisible: (): boolean => this.route === 'detail' && !this.readingEntry.sessionActive && !this.sourceSwitchPresentation.isSurfacePresented(),
      membership: () => this.detailShelf.readingMembership(),
      cacheDecision: (error: RemoteChapterCacheRefreshError, current: () => boolean): Promise<boolean> =>
        this.chooseCachedChapterRefresh(error, current),
      notice: (title: string, message: string): void => this.showReadingFailure(title, message),
      refreshShelf: (): void => this.refreshBookshelf(),
    };
  }

  private bindReadingEntryReader(): void {
    const owner = this.currentReadingRuntime();
    if (owner !== undefined) this.readingEntry.bindReader(owner, this.readingEntryPorts(owner));
  }

  private readingShelfPreparationScene(): ReadingShelfPreparationScene {
    return { runtime: this.libraryAcquisition.currentOwner(), mounting: this.detailShelfAdmissionMount,
      foreground: this.searchAppForeground, shelfVisible: this.route === 'bookshelf',
      settingsAvailable: this.settingsPresentation.ready(), revision: this.shelfRead.snapshot.revision,
      shared: this.shelfCatalog.snapshot.seeds };
  }

  private preparePersistedShelfBooks(): void {
    this.readingEntry.prepareShelf((): ReadingShelfPreparationScene => this.readingShelfPreparationScene());
  }

  private hydrateMangaPositions(books: MangaPositionCandidate[]): void {
    this.mangaPositions.hydrateVisible(books, (): MangaPositionScene => {
      const shelf = this.shelfRead.snapshot;
      return { owner: this.libraryAcquisition.currentOwner(), mounting: this.detailShelfAdmissionMount,
        navigation: this.navigationGeneration, route: this.route, shelfGeneration: shelf.generation, shelfBooks: shelf.books,
        continueReading: shelf.continueReading, detail: this.readingEntry.book,
        covered: this.readingEntry.sessionActive || this.sourceSwitchPresentation.isSurfacePresented() || this.mangaSourceSwitch.selectionVisible };
    }, (): void => this.readingEntry.refreshMangaPosition());
  }

  private prepareVisibleReadingBooks(books: ShelfBook[]): void {
    this.hydrateMangaPositions(books);
    this.readingEntry.prepareShelf((): ReadingShelfPreparationScene => this.readingShelfPreparationScene(), books);
  }

  private traceStartupStage(stage: string, status: string = 'event'): void {
    ReaderStartupTrace.current()?.mark(stage, status);
  }

  private beginStartupStage(stage: string): number {
    return ReaderStartupTrace.current()?.begin(stage) ?? -1;
  }

  private endStartupStage(stage: string, startedAt: number, status: string): void {
    ReaderStartupTrace.current()?.end(stage, startedAt, status);
  }

  private openShelfBookInfo(selection: ShelfBook, retainedParent?: DetailReturnRoute): void {
    this.openShelfEntry(selection, 'info', retainedParent);
  }

  private openShelfEntry(selection: ShelfBook, intent: ReadingShelfEntryIntent, retainedParent?: DetailReturnRoute): void {
    this.readingEntryActions.openShelfEntry(selection, intent, retainedParent);
  }

  showOfflineDownloadFeedback(message: string): void {
    try {
      this.transientFeedback.show(() => this.getUIContext(), { message }, (): boolean => this.searchAppForeground && (!this.shelfReceiptRetired && this.isCurrentRuntime(this.mountedRuntimeOwner)));
    } catch (_) {
      // Presentation must not cancel the durable Core download operation.
    }
  }

  private confirmDirectoryCacheClear(title: string, message: string, accept: () => void, current: () => boolean): void {
    this.showIndexAlert('confirmation-cancelable', {
      title, message,
      primaryButton: {
        value: '取消',
        action: (): void => {},
      },
      secondaryButton: {
        value: '清除',
        fontColor: readerAppColor('app.action.nativeDestructive', this.appThemeScheme),
        action: accept,
      },
    }, current);
  }

  private openBookRemovalDialog(message: string, action: () => void): void {
    const owner = this.mountedRuntimeOwner;
    if (owner === undefined) return;
    const generation = this.navigationGeneration, mounting = this.detailShelfAdmissionMount, route = this.route;
    const current = (): boolean => !this.shelfReceiptRetired && generation === this.navigationGeneration &&
      mounting === this.detailShelfAdmissionMount && route === this.route &&
      this.mountedRuntimeOwner === owner && this.isCurrentRuntime(owner) &&
      this.searchAppForeground && !this.arkWebCapturesInput;
    this.bookRemovalConfirmation.open(message, current, action, (phase: 'open' | 'close', error: Object): void => {
      hilog.warn(DOMAIN, 'Reader', 'Book removal dialog %{public}s failed: %{private}s', phase, errorMessageOf(error));
    });
  }

  private openReading(chapterIndex: number | undefined, mangaDirectoryTargetProof?: ReaderDirectoryTargetProof): void {
    this.readingEntryActions.openReading(chapterIndex, mangaDirectoryTargetProof);
  }

  retainedReaderPorts(): RetainedReaderScenePorts {
    return {
      runtime: (): ReaderRuntimeOwner | undefined => this.currentReadingRuntime(),
      inputCurrent: (readerIdentity: string): boolean => this.readerContentInputCurrent(readerIdentity),
      directory: this.directoryJourney.operations, directoryNavigation: this.directoryNavigationPorts(),
      toggleMangaShelf: (): void => this.requestMangaShelfMutation(),
      loginMangaSource: (): Promise<void> => this.mangaSourceLogin.openCurrent((): MangaSourceLoginScene => ({
        owner: this.currentReadingRuntime(), sourceId: this.readingEntry.book?.sourceId,
        navigation: this.navigationGeneration, mounting: this.detailShelfAdmissionMount,
        readerIdentity: this.currentReaderPresentationIdentity(),
        chapterRequest: this.readingEntry.mangaChapterRequestGeneration,
        foreground: this.searchAppForeground, route: this.route, sessionActive: this.readingEntry.sessionActive,
        contentKind: this.readingEntry.contentKind, sourceSwitchVisible: this.sourceSwitchPresentation.isSurfacePresented(),
        candidateVisible: this.mangaSourceSwitch.selectionVisible,
      })),
      attachExit: (request: ReaderExitRequest, identity: string, current: () => boolean,
        mangaGeneration?: number): (() => void) | undefined =>
        this.registerReadingExitRequest(request, identity, current, mangaGeneration),
      exit: (identity: string): void => this.onReaderExited(identity),
      cancelExit: (identity: string): void => this.cancelReaderExitDestination(identity),
      ready: (chapter: number, sourceId: string, bookId: string, generation: number): void =>
        this.readingEntryActions.readingReadyCallback(sourceId, bookId, generation)(chapter),
      sessionReady: (session: RemoteReadingSession, refreshDirectoryDisplay?: boolean): void =>
        this.readingEntryActions.acceptReaderSession(session, refreshDirectoryDisplay),
      resetFeedback: (): void => this.transientFeedback.reset(),
      openBookInfo: (): void => this.requestReaderBookInfo(),
      openDownloads: (): void => this.downloadNavigation.requestFromReader(),
      isDirectoryOpeningCurrent: (opening: number): boolean => this.isDirectoryOpeningCurrent(opening, 'readerControl'),
      directoryBack: (handler: (() => boolean) | undefined, identity: string, opening: number): void =>
        this.registerDirectoryBackBridge('readerControl', opening, handler, identity),
      openDirectory: (): void => this.openReaderControlDirectory(),
      closeDirectory: (): void => this.closeDirectory(),
      openSourceSwitch: (focusId?: string): void => this.openSourceSwitch(focusId),
      sourceSwitch: this.sourceSwitchActions,
      resolveSourceSwitchTransaction: (sourceId: string, bookId: string): Promise<string | undefined> =>
        this.resolveReaderSourceSwitchTransaction(sourceId, bookId),
    };
  }

  private directoryNavigationPorts(): ReadingDirectoryNavigationPorts { return this.directoryJourney.navigationPorts(); }

  private openFullDirectory(): void { this.directoryJourney.open('detail'); }

  private openReaderControlDirectory(): void { this.directoryJourney.open('readerControl'); }

  private retryDirectoryCatalog(): void { this.directoryJourney.retryDetailCatalog(); }

  private requestMangaShelfMutation(): void {
    this.readingExitActions.requestMangaShelfMutation((): void => this.detailShelf.request(this.detailShelf.identity()));
  }

  private requestReaderBookInfo(afterOpen?: () => void): void { this.readingExitActions.requestBookInfo(afterOpen); }

  private currentReaderPresentationIdentity(): string {
    return this.readingEntry.readerPresentationIdentity();
  }

  private registerReadingExitRequest(requestExit: ReaderExitRequest, readerIdentity: string,
    surfaceCurrent: () => boolean, mangaGeneration?: number): (() => void) | undefined {
    return this.readingExitActions.attach(requestExit, readerIdentity, surfaceCurrent, mangaGeneration);
  }

  private cancelReaderExitDestination(readerIdentity: string): void { this.readingExitActions.cancel(readerIdentity); }

  private onReaderExited(readerIdentity: string): void { this.readingExitActions.accepted(readerIdentity); }

  private closeDirectory(): void { this.directoryJourney.close(); }

  private requestReadingExit(): void { this.readingExitActions.requestExit(); }

  private sourceSwitchScene(): SourceSwitchScene { return this.sourceSwitchJourney.scene(); }

  private getSourceSwitchHost(): SourceSwitchHost | undefined { return this.sourceSwitchJourney.host(); }

  private sourceSwitchPorts(): SourceSwitchWorkflowPorts { return this.sourceSwitchJourney.workflow(); }

  private retireSourceSwitchPresentation(): void { this.sourceSwitchJourney.retire(); }

  private openSourceSwitch(focusId: string = ''): void {
    this.sourceSwitchJourney.openReader();
    this.bindSourceSwitchFocus(focusId);
  }

  openDetailSourceSwitch(focusId: string = ''): void {
    this.sourceSwitchJourney.openDetail();
    this.bindSourceSwitchFocus(focusId);
  }

  private bindSourceSwitchFocus(focusId: string): void {
    const source = this.sourceSwitchPresentation, owner = this.currentReadingRuntime(), book = this.readingEntry.book;
    if (!source.visible || owner === undefined || book === undefined) return;
    const scope = source.scopeId, route = this.route, navigation = this.navigationGeneration;
    const sourceId = book.sourceId, bookId = book.bookId, mounting = this.detailShelfAdmissionMount;
    const fallback = sourceSwitchTriggerFocusId(sourceId, bookId, route === 'detail' ? 'detail-back' : 'reader-body');
    source.bindSurfaceFocus(scope, {
      current: (): boolean => !this.shelfReceiptRetired && this.searchAppForeground && !this.arkWebCapturesInput &&
        this.isCurrentRuntime(owner) && this.route === route && this.navigationGeneration === navigation &&
        this.detailShelfAdmissionMount === mounting && this.readingEntry.book?.sourceId === sourceId &&
        this.readingEntry.book?.bookId === bookId && !this.mangaSourceSwitch.selectionVisible &&
        !this.bookRemovalConfirmation.isOpen() && this.jsonImportPresentation.opening === undefined,
      postFrame: (action: () => void): void => this.getUIContext().postFrameCallback(new ReaderSourceFocusFrame(action)),
      request: (target: string): void => this.getUIContext().getFocusController().requestFocus(target),
      restore: (): void => {
        const focus = this.getUIContext().getFocusController();
        if (focusId.length > 0) {
          try {
            const rect = this.getUIContext().getComponentUtils().getRectangleById(focusId);
            if (rect.size.width > 0 && rect.size.height > 0) { focus.requestFocus(focusId); return; }
          } catch (_) {}
        }
        try { focus.requestFocus(fallback); } catch (_) {}
      },
    });
  }

  private sourceSwitchProbeQuery(): SourceSwitchProbeQuery { return sourceSwitchProbeQuery(this.readingEntry); }

  private performSourceSwitchSeam(book: ShelfBook, session?: RemoteReadingSession, chapterIndex?: number): void {
    this.sourceSwitchJourney.commit(book, session, chapterIndex);
  }

  currentReadingRuntime(): ReaderRuntimeOwner | undefined {
    if (this.shelfReceiptRetired) return undefined;
    const owner = this.libraryAcquisition.currentOwner();
    return owner === this.mountedRuntimeOwner ? owner : undefined;
  }

  private readerContentInputCurrent(readerIdentity: string): boolean {
    return this.currentReadingRuntime() !== undefined && this.readingEntry.sessionActive &&
      readerIdentity === this.currentReaderPresentationIdentity() &&
      retainedReaderRoute(this.route, this.directoryReturnTarget) === 'reading' &&
      this.searchAppForeground && !this.arkWebCapturesInput &&
      !this.sourceSwitchPresentation.isSurfacePresented() && !this.mangaSourceSwitch.selectionVisible;
  }

  private chooseCachedChapterRefresh(error: RemoteChapterCacheRefreshError, current: () => boolean): Promise<boolean> {
    const ports: CachedChapterRecoveryPorts = {
      runtime: (): ReaderRuntimeOwner | undefined => this.currentReadingRuntime(),
      notice: (message: string, label: string, action: () => void, admitted: () => boolean): void =>
        this.showIndexRecoveryNotice(message, label, action, admitted),
      feedback: (message: string, admitted: () => boolean): void => {
        try { this.transientFeedback.show(() => this.getUIContext(), { message, duration: READER_FEEDBACK_EXTENDED_MS },
          (): boolean => this.journeyRecoveryInputAllowed() && admitted()); } catch (_) {}
      },
    };
    return this.readingEntry.chooseCachedChapterRefresh(error, current, ports);
  }

  private showReadingFailure(title: string, message: string): void {
    const detail = this.readingEntry.projectAdmissionFailure(message, this.route === 'detail' && !this.readingEntry.sessionActive);
    try { this.transientFeedback.show(() => this.getUIContext(), { message: `${title}：${detail}`, duration: READER_FEEDBACK_EXTENDED_MS },
      (): boolean => this.searchAppForeground && this.currentReadingRuntime() !== undefined); } catch (_) {}
  }

  private showIndexRecoveryNotice(message: string, actionLabel: string = '', action?: () => void,
    admitted: () => boolean = (): boolean => true): void {
    const generation = this.navigationGeneration, route = this.route;
    const owner = this.mountedRuntimeOwner, mounting = this.detailShelfAdmissionMount;
    const current = (): boolean => !this.shelfReceiptRetired && generation === this.navigationGeneration &&
      route === this.route && owner === this.mountedRuntimeOwner && mounting === this.detailShelfAdmissionMount &&
      this.isCurrentRuntime(owner) && admitted();
    this.readingEntry.showRecoveryNotice(message, actionLabel, action, current);
  }

  private reconcilePendingSourceSwitches(): Promise<void> {
    return this.sourceSwitchPresentation.inspectPending((): SourceSwitchScene => this.sourceSwitchScene(),
      (count: number): void => hilog.info(DOMAIN, 'Reader', 'Retained pending source switches: %{public}d', count),
      (error: Error): void => hilog.warn(DOMAIN, 'Reader', 'Pending source switch read failed: %{private}s', errorMessageOf(error)),
      (): void => this.refreshBookshelf());
  }

  journeyRecoveryInputAllowed(): boolean {
    return this.searchAppForeground && !this.arkWebCapturesInput && this.currentReadingRuntime() !== undefined &&
      !this.bookshelfModalVisible() && !this.bookRemovalConfirmation.isOpen() &&
      this.jsonImportPresentation.opening === undefined && !this.sourceSwitchPresentation.isSurfacePresented() &&
      !this.mangaSourceSwitch.selectionVisible;
  }

  canPresentMangaRecovery(): boolean {
    return this.bookshelfContentAcceptsInput() && this.journeyRecoveryInputAllowed();
  }

  private resolveReaderSourceSwitchTransaction(sourceId: string, bookId: string): Promise<string | undefined> {
    return this.sourceSwitchPresentation.resolveReaderTransaction({ sourceId, bookId }, this.sourceSwitchPorts());
  }

  private mountSystemFileOpenNavigation(owner: ReaderRuntimeOwner): void {
    this.nativeAlertWindowUnsubscribe?.();
    this.documentPickerUnsubscribe?.();
    const mounting = this.detailShelfAdmissionMount;
    const settled = (): void => {
      if (mounting === this.detailShelfAdmissionMount && this.currentReadingRuntime() === owner) {
        this.readingExitActions.navigationSettled();
      }
    };
    this.nativeAlertWindowUnsubscribe = ReaderNativeAlertWindow.subscribe(settled);
    this.documentPickerUnsubscribe = ReaderDocumentPickerActivity.subscribe(settled);
    this.readingExitActions.mountSystemFile(owner);
  }

  private consumeSystemFileOpen(): void { this.readingExitActions.consumeSystemFile(); }

  private sourceDisplayName(sourceId: string, persistedName: string = ''): string {
    const candidate = this.sourceSwitchPresentation.namedCandidate;
    return this.shelfRead.sourceDisplayName(sourceId, persistedName, candidate === undefined ? undefined :
      { sourceId: candidate.sourceId, sourceName: candidate.sourceName });
  }

  private shelfFilter(): BookshelfFilter {
    return this.shelfRead.filter();
  }

  private bookshelfProjectionScene(): BookshelfProjectionScene | undefined {
    const owner = this.libraryAcquisition.currentOwner();
    if (owner === undefined || this.shelfReceiptRetired) return undefined;
    return { owner, instance: this.rssInstanceIdentity, mounting: this.detailShelfAdmissionMount,
      navigation: this.navigationGeneration, route: this.route };
  }

  private isCurrentBookshelfPresentation(generation: number, owner: ReaderRuntimeOwner | undefined, mounting: number): boolean {
    return this.libraryJourney.isCurrentBookshelf(generation, owner, mounting);
  }

  private refreshSearchShelfMembership(): void {
    this.shelfRead.refreshMembership();
  }

  private refreshBookshelf(): void {
    this.shelfRead.refresh();
  }

  private invalidateBookshelfProjection(): void {
    this.shelfRead.invalidate();
  }

  private nextNavigationGeneration(): number {
    this.transientFeedback.reset();
    this.downloadPresentation.retire();
    this.readingCommits.retire();
    this.settingsPresentation.retire();
    this.sourceJourney.retire();
    this.retireSourceSwitchPresentation();
    this.rssJourney.retire();
    this.readingEntry.retire();
    this.shelfCatalog.retire();
    this.shelfMutations.retireSelection();
    this.shelfManagement.retire();
    this.shelfGroupPresentation.retire();
    this.discoverPresentation.retire();
    this.rulesPresentation.retire();
    this.syncPresentation.retire();
    this.nativeAlertOwner.retire();
    this.readingEntryActions.retirePreparation();
    this.publishNavigation(this.navigationOwner.advance());
    return this.navigationGeneration;
  }

  private isCurrentRoute(generation: number, route: ReaderRoute): boolean {
    return generation === this.navigationGeneration && this.route === route;
  }

  private applyBookshelfState(state: BookshelfDataState): void {
    this.shelfRead.accept(state);
  }

}
