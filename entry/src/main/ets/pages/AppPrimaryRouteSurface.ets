import type { ReaderRuntimeOwner } from '../app/ReaderRuntimeOwner';
import type { ReaderNavigation, ReaderRoute } from '../app/navigation/ReaderNavigation';
import type { ReaderLibraryAcquisitionBinding } from '../app/composition/ReaderLibraryAcquisitionBinding';
import type { ReaderLibraryHeaderActions, ReaderLibraryJourney } from '../app/composition/ReaderLibraryJourney';
import { BookshelfScene, type BookshelfScenePorts } from '../features/bookshelf/ui/BookshelfScene';
import { BookshelfDetailScene, type BookshelfDetailScenePorts } from '../features/bookshelf/ui/BookshelfDetailScene';
import type { BookshelfReadPresentation } from '../features/bookshelf/presentation/BookshelfReadPresentation';
import type { BookshelfCatalogPresentation } from '../features/bookshelf/presentation/BookshelfCatalogPresentation';
import type { BookshelfDetailPresentation } from '../features/bookshelf/presentation/BookshelfDetailPresentation';
import type { BookshelfMutationPresentation } from '../features/bookshelf/presentation/BookshelfMutationPresentation';
import type { ReaderDirectoryJourney } from '../app/composition/ReaderDirectoryJourney';
import type { LibrarySearchPresentation } from '../features/search/presentation/LibrarySearchPresentation';
import { LibrarySearchResults } from '../features/search/ui/LibrarySearchResults';
import { ReaderLibrarySearchSurface } from '../features/search/ui/ReaderLibrarySearchSurface';
import type { SearchHost } from '../features/search/application/SearchHost';
import type { SearchBook } from '../features/search/application/SearchGateway';
import type { ReadingEntryPresentation } from '../features/reading/presentation/ReadingEntryPresentation';
import { DetailDirectoryScene } from '../features/reading/ui/DetailDirectoryScene';
import { READER_LAYOUT_DEBUG_BUILD } from '../ui/foundation/ReaderLayoutInvariantSignals';

export interface AppPrimaryScope {
  readonly route: ReaderRoute;
  readonly navigation: number;
  readonly mounting: number;
  readonly owner: ReaderRuntimeOwner | undefined;
  readonly expanded: boolean;
  readonly foreground: boolean;
  readonly covered: boolean;
  readonly reduceMotion: boolean;
}

export interface AppPrimaryPresentations {
  readonly read: BookshelfReadPresentation;
  readonly mutations: BookshelfMutationPresentation;
  readonly catalog: BookshelfCatalogPresentation;
  readonly search: LibrarySearchPresentation;
  readonly entry: ReadingEntryPresentation;
  readonly detail: BookshelfDetailPresentation;
}

export interface AppPrimaryActions {
  readonly current: () => AppPrimaryScope;
  readonly manageSourcesFromSearch: () => void;
  readonly openDetailSourceSwitch: () => void;
  readonly onBack: () => boolean;
  readonly shelfPreparing: boolean;
  readonly bookshelfAcceptsInput: boolean;
  readonly detailIsForeground: boolean;
  readonly detailDirectoryActive: boolean;
  readonly bookshelfPorts: (owner: ReaderRuntimeOwner | undefined, mounting: number) => BookshelfScenePorts;
  readonly detailPorts: () => BookshelfDetailScenePorts;
}

export interface AppPrimaryRouteInput {
  readonly paint: ReaderRoute;
  readonly scope: AppPrimaryScope;
  readonly presentations: AppPrimaryPresentations;
  readonly actions: AppPrimaryActions;
  readonly navigationOwner: ReaderNavigation;
  readonly libraryJourney: ReaderLibraryJourney;
  readonly acquisition: ReaderLibraryAcquisitionBinding;
  readonly directory: ReaderDirectoryJourney;
  readonly bottomNavigationHeight: number;
  readonly tapBottomScrollTop: boolean;
  readonly renderSearchResults: (input: AppPrimaryRouteInput) => void;
}

function resultsAttached(route: ReaderRoute, search: LibrarySearchPresentation, navigation: ReaderNavigation): boolean {
  return route === 'search' || (search.mode !== 'idle' &&
    (navigation.isSearchDetailJourney() ||
      ((route === 'source' || route === 'sourceTools') && navigation.returns.sourceOrigin().target === 'search')));
}

function resultIdentity(search: LibrarySearchPresentation, mounting: number): string {
  // The search host owns query revision; its publication triggers the paint.
  search.publicationRevision;
  return JSON.stringify([search.identity, search.host.viewState.revision, mounting]);
}

@Builder
function AppPrimarySearchResults(input: AppPrimaryRouteInput, key: string, owner: ReaderRuntimeOwner | undefined,
  mounting: number, host: SearchHost) {
  LibrarySearchResults({
    presentation: input.presentations.search,
    coordinator: input.acquisition.coordinator(),
    isCurrent: (): boolean => {
      const current = input.actions.current();
      return resultsAttached(current.route, input.presentations.search, input.navigationOwner) &&
        key === resultIdentity(input.presentations.search, current.mounting) &&
        input.libraryJourney.ownsSearchPresentation(owner, mounting, host);
    },
    presented: input.scope.route === 'search' && input.scope.foreground && !input.scope.covered,
    isVisible: (): boolean => {
      const current = input.actions.current();
      return current.route === 'search' && current.foreground && !current.covered;
    },
    reduceMotion: input.scope.reduceMotion,
    expandedLayout: input.scope.expanded,
    onBack: (): void => { input.actions.onBack(); },
    onQuery: (keyword: string, scopeSourceIds?: string[]): void => input.libraryJourney.search(keyword, scopeSourceIds),
    onResult: (book: SearchBook, variants: SearchBook[], cover?: string, focusKey?: string): void =>
      input.libraryJourney.selectResult(book, variants, cover, focusKey),
    onManageSources: input.actions.manageSourcesFromSearch,
  });
}

@Builder
export function AppPrimarySearchResultsSlot(input: AppPrimaryRouteInput) {
  if (resultsAttached(input.scope.route, input.presentations.search, input.navigationOwner)) {
    ForEach([resultIdentity(input.presentations.search, input.scope.mounting)], (key: string): void => {
      AppPrimarySearchResults(input, key, input.scope.owner, input.scope.mounting, input.presentations.search.host);
    }, (key: string): string => key);
  }
}

@Builder
function AppPrimarySearchHeader(input: AppPrimaryRouteInput, actions: ReaderLibraryHeaderActions) {
  ReaderLibrarySearchSurface({
    model: input.presentations.search.model, mode: input.presentations.search.mode, identity: input.presentations.search.identity,
    navigationGeneration: input.scope.navigation, mounting: input.scope.mounting,
    // Search owns an opaque material. Keep the real List position so closing
    // search or returning from detail never flashes the idle tint at mid-list.
    headerScrolled: (input.scope.route === 'bookshelf' || (input.scope.route === 'search' && input.presentations.search.mode === 'idle')) &&
      input.presentations.read.snapshot.visualAdmitted && input.presentations.read.headerScrolled,
    moreIdentity: input.presentations.search.shelfMoreIdentity(input.scope.navigation, input.scope.mounting),
    animateOnAppear: input.presentations.search.animateOnAppear, expandedLayout: input.scope.expanded,
    reduceMotion: input.scope.reduceMotion,
    continueCardRect: input.presentations.search.continueCardRect(input.scope.navigation, input.scope.mounting,
      input.presentations.read.snapshot.continueReading),
    onHistoryCoverageChanged: actions.onHistoryCoverageChanged,
    results: (): void => input.renderSearchResults(input),
    onOpen: actions.onOpen,
    onBack: actions.onBack,
    onInputRequested: actions.onInputRequested,
    onMore: actions.onMore,
    onHeaderBottom: actions.onHeaderBottom,
    onSettled: actions.onSettled,
  }).enabled(input.scope.route === 'search' || input.actions.bookshelfAcceptsInput)
    .customProperty('readerLayoutDebugExcluded', typeof READER_LAYOUT_DEBUG_BUILD === 'boolean' && READER_LAYOUT_DEBUG_BUILD &&
      input.scope.route !== 'bookshelf' && input.scope.route !== 'search')
    .hitTestBehavior(input.scope.route === 'search' || input.actions.bookshelfAcceptsInput ? HitTestMode.Transparent : HitTestMode.None)
    .accessibilityLevel(input.scope.route === 'search' || input.actions.bookshelfAcceptsInput ? 'auto' : 'no-hide-descendants');
}

/** Paints the app routes that share bookshelf, detail, and library search presentations. */
@Builder
export function AppPrimaryRouteSurface($$: AppPrimaryRouteInput) {
  if ($$.paint === 'bookshelf') {
    ForEach([$$.scope.mounting], (mounting: number): void => {
      BookshelfScene({
        read: $$.presentations.read, mutations: $$.presentations.mutations, catalog: $$.presentations.catalog,
        navigation: $$.scope.navigation,
        feedbackEnabled: $$.scope.route === 'bookshelf' && !$$.presentations.entry.sessionActive && !$$.actions.shelfPreparing,
        continueCardSuppressed: $$.scope.route === 'search' &&
          $$.presentations.search.continueCardSuppressed($$.scope.navigation, $$.scope.mounting),
        reduceMotion: $$.scope.reduceMotion,
        tapBottomScrollTop: $$.tapBottomScrollTop,
        sharedBottomNavigationHeight: $$.bottomNavigationHeight,
        ports: $$.actions.bookshelfPorts($$.scope.owner, mounting),
      })
        .enabled($$.actions.bookshelfAcceptsInput)
        .hitTestBehavior($$.actions.bookshelfAcceptsInput ? HitTestMode.Default : HitTestMode.None)
        .accessibilityLevel($$.actions.bookshelfAcceptsInput ? 'auto' : 'no-hide-descendants')
        .customProperty('readerLayoutDebugExcluded', $$.scope.route !== 'bookshelf');
    }, (mounting: number): string => mounting.toString());
    AppPrimarySearchHeader($$, $$.libraryJourney.headerActions($$.scope.owner, $$.presentations.search.host));
  } else if ($$.paint === 'detail') {
    BookshelfDetailScene({
      entry: $$.presentations.entry, detail: $$.presentations.detail, mutations: $$.presentations.mutations,
      identity: $$.presentations.detail.identity(), foreground: $$.actions.detailIsForeground,
      directoryRetained: $$.actions.detailDirectoryActive || $$.navigationOwner.retainsDetailDirectory(),
      mutationEnabled: $$.presentations.entry.book !== undefined &&
        $$.presentations.detail.mutationEnabled($$.presentations.entry.book),
      ports: $$.actions.detailPorts(),
    });
  } else if ($$.paint === 'directory' && $$.presentations.entry.book !== undefined) {
    DetailDirectoryScene({
      reduceMotion: $$.scope.reduceMotion, reading: $$.presentations.entry,
      operations: $$.directory.operations,
      navigation: $$.directory.navigationPorts(),
      interactive: $$.directory.isOpeningCurrent($$.presentations.entry.detailDirectoryPresentationGeneration, 'detail'),
      mangaDownloadEnabled: $$.presentations.entry.book.contentKind === 'manga' &&
        $$.scope.owner?.supportsCoreCapability('manga.offline.v1') === true,
      isOpeningCurrent: (opening: number): boolean => $$.directory.isOpeningCurrent(opening, 'detail'),
      onRetryCatalog: (): void => $$.directory.retryDetailCatalog(),
      onSwitchSource: $$.actions.openDetailSourceSwitch,
      onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string, opening: number): void =>
        $$.directory.registerBack('detail', opening, handler, identity),
      onBack: (): void => $$.directory.close(),
    }).width('100%').height('100%')
      .enabled($$.actions.detailDirectoryActive)
      .hitTestBehavior($$.actions.detailDirectoryActive ? HitTestMode.Default : HitTestMode.None)
      .accessibilityLevel($$.actions.detailDirectoryActive ? 'auto' : 'no-hide-descendants');
  }
}
