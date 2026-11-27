import { AppRouteJourneyBindings } from '../app/composition/AppRouteJourneyBindings';
import { AppOverlayHost, AppWindowOverlays } from './AppOverlayHost';
import { AppPrimaryRouteSurface, AppPrimarySearchResultsSlot, type AppPrimaryRouteInput,
  type AppPrimaryScope } from './AppPrimaryRouteSurface';
import { AppReadingDetailMotion, AppReadingRouteSurface } from './AppReadingRouteSurface';
import { AppSecondaryRouteStack, AppWideSettingsRoute, AppWideSettingsStackContent, type AppSecondaryScope,
  type AppWideSettingsRouteInput } from './AppSecondaryRouteStack';
import type { ReaderNativeAlertOptions } from '../ui/platform/ReaderNativeAlertOwner';
import { ReaderNativeAlertWindow } from '../ui/platform/ReaderNativeAlertWindow';
import { readerAppColor } from '../ui/foundation/ReaderThemeRegistry';
import { BookshelfGroupPresentation } from '../features/bookshelf/presentation/BookshelfGroupPresentation';
import { LibrarySearchPresentation } from '../features/search/presentation/LibrarySearchPresentation';
import { ReaderRuntimeOwner } from '../app/ReaderRuntimeOwner';
import { readerSettingsPresentationPlan, type ReaderSettingsPresentationPlan } from '../app/navigation/ReaderSettingsPresentationPolicy';
import { AppRouteCoordinator } from '../app/AppRouteCoordinator';
import { ReaderWindowCoordinator } from '../app/ReaderWindowCoordinator';
import { readerContentSafeTop, type ReaderRectVp } from '../ui/foundation/ReaderWindowMetrics';
import { BookshelfDetailPresentation } from '../features/bookshelf/presentation/BookshelfDetailPresentation';
import type { BookshelfDetailScenePorts } from '../features/bookshelf/ui/BookshelfDetailScene';
import { BookshelfMutationPresentation } from '../features/bookshelf/presentation/BookshelfMutationPresentation';
import { BookshelfManagementPresentation } from '../features/bookshelf/presentation/BookshelfManagementPresentation';
import { BookshelfReadPresentation } from '../features/bookshelf/presentation/BookshelfReadPresentation';
import { BookshelfCatalogPresentation } from '../features/bookshelf/presentation/BookshelfCatalogPresentation';
import type { BookshelfScenePorts } from '../features/bookshelf/ui/BookshelfScene';
import { DiscoverScenePresentation } from '../features/discover/presentation/DiscoverScenePresentation';
import type { DiscoverBook } from '../features/discover/application/DiscoverGateway';
import type { RetainedReaderScenePorts } from '../app/composition/RetainedReaderScene';
import { ReaderReadingEntryActions } from '../app/composition/ReaderReadingEntryActions';
import { ReadingEntryPresentation } from '../features/reading/presentation/ReadingEntryPresentation';
import { ReadingCommitPresentation } from '../features/reading/presentation/ReadingCommitPresentation';
import { MangaSourceSwitchPresentation } from '../features/manga/presentation/MangaSourceSwitchPresentation';
import { RssJourneyPresentation } from '../features/rss/presentation/RssJourneyPresentation';
import { SettingsPresentation, type SettingsRoute } from '../features/settings/presentation/SettingsPresentation';
import { settingsDestinationAllowedInSection, type SettingsDestination } from '../app/composition/SettingsScenes';
import type { SettingsPane } from '../features/settings/presentation/SettingsNavigationItems';
import { readerLegacySnapshotRecoveryView } from '../app/ReaderRecoveryProjection';
import {
  SharedDownloadPresentation,
  type DownloadReadingEntry,
} from '../features/downloads/presentation/SharedDownloadPresentation';
import { RulesManagementPresentation } from '../features/settings/presentation/RulesManagementPresentation';
import { SourceSwitchPresentation } from '../features/source/presentation/SourceSwitchPresentation';
import { SyncPresentation } from '../features/sync/presentation/SyncPresentation';
import { readerExpandedLayout } from '../ui/layout/ReaderLayoutCapability';
import type { ArkWebInteractiveBounds } from '../ui/platform/ArkWebExecutionHost';
import { readerPageAreaLength } from '../ui/layout/ReaderPageShell';
import { JsonImportPresentation, type JsonImportOpening } from '../app/composition/JsonImportPresentation';
import {
  ReaderNavigation,
  retainedReaderRoute,
  type DirectoryReturnTarget,
  type ReaderNavigationSnapshot,
  type ReaderRoute,
  type SettingsSection,
  type ReaderRouteMotionKind,
  type TemporaryBackScope,
} from '../app/navigation/ReaderNavigation';
import {
  READER_ROUTE_PARENT_DIM,
  READER_ROUTE_PARENT_PARALLAX,
  type ReaderDetailSceneSnapshot,
} from '../app/navigation/ReaderRouteMotionModel';
import { motionAnimateParam } from '../ui/foundation/MotionSpec';
import { ReaderRouteStackSurface, type ReaderRouteSurfaceKey } from '../app/navigation/ReaderRouteStackSurface';
import { ReaderBottomNavigation } from '../app/navigation/ReaderBottomNavigation';
import { readerMainNavigationMode } from '../features/shell/MainNavigationSpec';
import { readerLayoutCarrierResponseRegion } from '../ui/layout/ReaderPageNativeAttributes';
import { readerBeginTransition, readerTransitionsEnabled } from '../ui/foundation/ReaderTransitionSignals';

@Entry
@Component
struct Index {
  private readonly navigationOwner: ReaderNavigation = new ReaderNavigation();
  private readonly routeCoordinator: AppRouteCoordinator = new AppRouteCoordinator();
  private readonly journeys: AppRouteJourneyBindings = new AppRouteJourneyBindings(this.navigationOwner, this.routeCoordinator, {
    route: (): ReaderRoute => this.route,
    generation: (): number => this.navigationGeneration,
    mounting: (): number => this.detailShelfAdmissionMount,
    directoryTarget: (): DirectoryReturnTarget => this.directoryReturnTarget,
    foreground: (): boolean => this.searchAppForeground,
    webCapturesInput: (): boolean => this.arkWebCapturesInput,
    wideSettings: (): boolean => this.wideSettingsPane() !== undefined,
    detailPopping: (): boolean => this.readerDetailScene?.phase === 'pop',
    scheme: (): string => this.appThemeScheme,
    ui: (): UIContext => this.getUIContext(),
    publish: (snapshot: ReaderNavigationSnapshot): void => this.publishNavigation(snapshot),
  });

  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerReduceMotion') @Watch('onReaderParentMotionPolicyChanged') private appReduceMotion: boolean = false;

  @StorageLink('readerWindowMetricsRevision') @Watch('onReaderParentWindowChanged') readerWindowMetricsRevision: number = 0;

  // Keep the original observed presentations subscribed to this root's render cycle.
  @State private shelfMutations: BookshelfMutationPresentation = this.journeys.shelfMutations;

  @State private shelfGroupPresentation: BookshelfGroupPresentation = this.journeys.shelfGroupPresentation;
  @State private shelfRead: BookshelfReadPresentation = this.journeys.shelfRead;
  @State private downloadPresentation: SharedDownloadPresentation = this.journeys.downloadPresentation;
  @State private shelfCatalog: BookshelfCatalogPresentation = this.journeys.shelfCatalog;

  @State private shelfManagement: BookshelfManagementPresentation = this.journeys.shelfManagement;

  @State private sourcePaneBounds: ArkWebInteractiveBounds | undefined = undefined;
  @State private arkWebCapturesInput: boolean = false;
  @State @Watch('onSearchVisibilityChanged') private route: ReaderRoute = this.navigationOwner.snapshot().route;
  @State private navigationGeneration: number = this.navigationOwner.snapshot().generation;
  @State private directoryReturnTarget: DirectoryReturnTarget = this.navigationOwner.snapshot().directoryReturnTarget;
  @State private settingsSection: SettingsSection = this.navigationOwner.snapshot().settingsSection;
  @StorageLink('readerWideNavigationRail') private wideNavigationRail: boolean = false;
  @StorageLink('readerMainViewportRevision') private mainViewportRevision: number = 0;
  @State private primaryTabFooterHeight: number = 0;
  @State private settingsHomeScrollTopRequest: number = 0;
  @State private wideSettingsCollapsed: boolean = false;
  @State private wideSettingsLane: ReaderRouteSurfaceKey = 'settings-general';
  @State private wideSettingsMotion: ReaderRouteMotionKind = 'tab';
  @State private visibleRouteMotion: ReaderRouteMotionKind | 'none' = 'none';
  @State private readerParentProgress: number = 0;
  @State private readerParentAnimated: boolean = false;
  private readerParentAnimationGeneration: number = 0;
  private readerParentAnimationViewport: ReaderRectVp | undefined;
  @State private readerDetailScene: ReaderDetailSceneSnapshot | undefined = undefined;
  private readonly readingMotion: AppReadingDetailMotion = new AppReadingDetailMotion({
    current: (): ReaderDetailSceneSnapshot | undefined => this.readerDetailScene,
    publish: (snapshot: ReaderDetailSceneSnapshot | undefined): void => { this.readerDetailScene = snapshot; },
    ui: (): UIContext => this.getUIContext(),
    reduceMotion: (): boolean => this.appReduceMotion, foreground: (): boolean => this.searchAppForeground,
    viewportWidth: (): number => this.routeViewportWidth(), canPreview: (): boolean => this.readerDetailBackGestureEnabled(),
    bookKey: (): string | undefined => this.readingEntry.book === undefined ? undefined :
      JSON.stringify([this.readingEntry.book.sourceId, this.readingEntry.book.bookId]),
    back: (): boolean => this.onBackPress(),
  });
  @State private sourceOpeningGeneration: number = 0;
  @State private sourceBackPreviewBlocked: boolean = false;
  @State private sourceToolsOpeningGeneration: number = 0;
  private publishNavigation(snapshot: ReaderNavigationSnapshot): void {
    const restoringDirectory = this.route === 'reading' && snapshot.route === 'directory' &&
      snapshot.directoryReturnTarget === 'detail';
    if (this.readerDetailScene !== undefined && !this.readingMotion.matchesBook()) this.readingMotion.clear();
    if (snapshot.generation !== this.navigationGeneration || snapshot.route !== this.route) {
      this.journeys.bookRemovalConfirmation.dismiss();
      this.jsonImportPresentation.dismiss();
    }
    if (this.route === 'bookshelf' && snapshot.route !== 'bookshelf' && this.journeys.bookshelfModalVisible()) {
      if (this.shelfMutations.snapshot.importPresentation !== undefined) this.shelfMutations.closeImport();
      if (this.shelfGroupPresentation.identity.length > 0) this.shelfGroupPresentation.retire();
    }
    if (this.route === 'detail' && snapshot.route !== 'detail') {
      this.shelfGroupPresentation.retire();
      this.journeys.retireDetailBack();
    }
    const routeChanged = snapshot.route !== this.route;
    const routeMotion = this.navigationOwner.routeMotion();
    const transition = this.routeCoordinator.transition(this.route, this.directoryReturnTarget, snapshot, {
      routeMotion, foreground: this.searchAppForeground, hasReadingBook: this.readingEntry.book !== undefined,
      readingSessionActive: this.readingEntry.sessionActive,
      readingOrigin: this.navigationOwner.returns.snapshot().readingOrigin,
      currentLane: (): ReaderRoute => this.appRouteLane(),
    });
    const fromReader = transition.fromReader, toReader = transition.toReader;
    const incomingDetail = transition.incomingDetail, returningFromDetail = transition.returningFromDetail;
    if (routeChanged) {
      const to = snapshot.route;
      if (to === 'source') this.sourceOpeningGeneration = snapshot.generation;
      else if (to === 'sourceTools') this.sourceToolsOpeningGeneration = snapshot.generation;
      if (fromReader && !toReader) {
        // Advance native policy with the same navigation decision, before the normal page mounts.
        ReaderWindowCoordinator.requestAppChrome();
        void ReaderWindowCoordinator.requestAppWindowPolicy().catch((_error: Error): void => {});
      }
      if (incomingDetail) this.readingMotion.open();
      else if (returningFromDetail) this.readingMotion.back();
      else if (this.presentedReaderDetail() !== undefined) this.readingMotion.clear();
      if (transition.paintMotion !== undefined) this.visibleRouteMotion = transition.paintMotion;
    }
    if (!toReader && this.readerDetailScene?.phase === 'retired') this.readingMotion.clear();
    // Keep the last right-hand pane mounted while the whole Settings tab leaves.
    const lane = this.routeCoordinator.settingsLane(snapshot.route, this.navigationOwner.settingsPane());
    if (lane !== undefined && lane !== this.wideSettingsLane) {
      this.wideSettingsMotion = snapshot.route === this.route ? 'tab' : this.navigationOwner.routeMotion();
      this.wideSettingsLane = lane;
    }
    this.navigationGeneration = snapshot.generation;
    this.directoryReturnTarget = snapshot.directoryReturnTarget;
    this.settingsSection = snapshot.settingsSection;
    this.route = snapshot.route;
    if (routeChanged && fromReader !== toReader) {
      const lane = returningFromDetail ? this.navigationOwner.returns.snapshot().readingOrigin : this.appRouteLane();
      this.updateReaderParentMotion(toReader, this.routeCoordinator.recordReaderParentLane(transition, lane));
    }
    if (incomingDetail || returningFromDetail) this.readingMotion.animate();
    else if (routeChanged && fromReader !== toReader && readerTransitionsEnabled()) {
      const retainedReveal = fromReader && this.readingEntry.sessionActive;
      readerBeginTransition({ kind: 'route', action: toReader ? 'push' : 'pop', subject: 'reading', scope: 'retained-reader',
        nodes: ['reader-transition-retained-scene'], staticMotion: this.appReduceMotion || retainedReveal });
    }
    if (restoringDirectory) this.journeys.refreshDetailDirectoryPosition();
  }
  private updateReaderParentMotion(open: boolean, sameLane: boolean): void {
    const progress = open && sameLane ? 1 : 0;
    const animate = this.readerParentProgress !== progress && sameLane &&
      this.searchAppForeground && !this.appReduceMotion;
    this.readerParentAnimationGeneration += 1;
    this.readerParentAnimationViewport = animate ? this.routeViewport() : undefined;
    this.readerParentAnimated = animate;
    this.readerParentProgress = progress;
  }

  private onReaderParentWindowChanged(): void {
    if (this.readerParentAnimated && !this.readerParentViewportMatches()) {
      this.readerParentAnimated = false;
    }
    this.readingMotion.viewportChanged();
  }

  private onReaderParentMotionPolicyChanged(): void {
    if (this.appReduceMotion) this.readerParentAnimated = false;
    this.readingMotion.motionPolicyChanged();
  }

  private readerParentViewportMatches(): boolean {
    const start = this.readerParentAnimationViewport;
    if (start === undefined) return false;
    const current = this.routeViewport();
    return start.width === current.width && start.height === current.height;
  }

  private readerParentAnimation(): AnimateParam | null {
    if (!this.readerParentAnimated || !this.searchAppForeground || this.appReduceMotion ||
      !this.readerParentViewportMatches()) return null;
    const generation = this.readerParentAnimationGeneration;
    return motionAnimateParam(this.readerParentProgress === 1 ? 'app.navigation.push' : 'app.navigation.pop', (): void => {
      if (generation === this.readerParentAnimationGeneration) this.readerParentAnimated = false;
    });
  }

  private readerParentMotionProgress(): number {
    return this.searchAppForeground && !this.appReduceMotion ? this.readerParentProgress : 0;
  }

  private presentedReaderDetail(): ReaderDetailSceneSnapshot | undefined {
    return this.readerDetailScene?.phase === 'retired' ? undefined : this.readerDetailScene;
  }

  private detailAboveReader(): boolean {
    return this.presentedReaderDetail() !== undefined || (this.route === 'detail' && this.visibleRouteMotion === 'push');
  }

  private appRouteBackGestureEnabled(): boolean {
    return this.presentedReaderDetail() === undefined && this.journeys.journeyRecoveryInputAllowed() &&
      !(this.route === 'source' && this.sourceBackPreviewBlocked) &&
      retainedReaderRoute(this.route, this.directoryReturnTarget) === undefined;
  }

  private readerDetailBackGestureEnabled(): boolean {
    const detail = this.presentedReaderDetail();
    return this.route === 'detail' && detail !== undefined && detail.phase !== 'pop' &&
      this.readingMotion.matchesBook() && !this.appReduceMotion && this.journeys.journeyRecoveryInputAllowed() && !this.journeys.hasDetailBack() &&
      this.shelfGroupPresentation.identity.length === 0;
  }

  @StorageLink('readerAppForeground') @Watch('onSearchVisibilityChanged') private searchAppForeground: boolean = true;
  @State private jsonImportPresentation: JsonImportPresentation = this.journeys.jsonImportPresentation;
  @State private readingEntryActions: ReaderReadingEntryActions = this.journeys.readingEntryActions;

  @State private rulesPresentation: RulesManagementPresentation = this.journeys.rulesPresentation;
  @State private discoverPresentation: DiscoverScenePresentation = this.journeys.discoverPresentation;
  @State private sourceSwitchPresentation: SourceSwitchPresentation = this.journeys.sourceSwitchPresentation;
  @State private readingCommits: ReadingCommitPresentation = this.journeys.readingCommits;

  @State private mangaSourceSwitch: MangaSourceSwitchPresentation = this.journeys.mangaSourceSwitch;

  @State private detailShelfAdmissionMount: number = 0;
  @State private detailShelf: BookshelfDetailPresentation = this.journeys.detailShelf;
  @State private readingEntry: ReadingEntryPresentation = this.journeys.readingEntry;
  @State private settingsPresentation: SettingsPresentation = this.journeys.settingsPresentation;

  @State private librarySearch: LibrarySearchPresentation = this.journeys.librarySearch;

  @State private syncPresentation: SyncPresentation = this.journeys.syncPresentation;
  @State private rssJourney: RssJourneyPresentation = this.journeys.rssJourney;

  aboutToAppear(): void {
    this.journeys.mount((): void => {
      this.arkWebCapturesInput = false;
      this.detailShelfAdmissionMount += 1;
    });
  }

  aboutToDisappear(): void {
    this.journeys.retireOpening();
    this.readerParentAnimated = false;
    this.readingMotion.clear();
    this.journeys.disposePresentations();
  }

  onBackPress(): boolean {
    return this.journeys.onBackPress();
  }

  private expandedLayout(): boolean {
    if (this.readerWindowMetricsRevision < 0) return false;
    return readerExpandedLayout(ReaderWindowCoordinator.metrics());
  }

  private usesBottomMainNavigation(): boolean {
    return readerMainNavigationMode(this.wideNavigationRail, this.mainViewportRevision,
      this.readerWindowMetricsRevision) === 'bottom';
  }

  private showsPrimaryBottomNavigation(): boolean {
    return this.settingsViewportPlan().primaryFooter;
  }

  private settingsViewportPlan(): ReaderSettingsPresentationPlan {
    return readerSettingsPresentationPlan(this.route, this.navigationOwner.settingsPane() !== undefined, this.expandedLayout(),
      this.settingsSection === 'home', this.usesBottomMainNavigation());
  }

  private primaryBottomNavigationInputAllowed(): boolean {
    if (!this.showsPrimaryBottomNavigation() || !this.searchAppForeground || this.arkWebCapturesInput ||
      this.journeys.bookRemovalConfirmation.isOpen() || this.jsonImportPresentation.opening !== undefined ||
      ReaderNativeAlertWindow.isPresented()) return false;
    if (this.route === 'bookshelf') {
      return this.journeys.isInteractiveBookshelfPresentation(this.navigationGeneration,
        this.journeys.runtime(), this.detailShelfAdmissionMount);
    }
    if (this.expandedLayout()) return this.wideSettingsInputAllowed();
    return this.settingsPresentation.paintIdentity('settings') !== '';
  }

  private selectPrimaryBottomTab(key: string): void {
    if (!this.primaryBottomNavigationInputAllowed()) return;
    if (this.expandedLayout() && this.route !== 'bookshelf') this.requestWideSettingsMainTab(key);
    else if (key === 'bookshelf' && this.route === 'settings') this.journeys.libraryJourney.returnToBookshelf();
    else if (key === 'settings' && this.route === 'bookshelf') this.journeys.settingsNavigation.openSettings();
    else if (key === 'discover') this.journeys.openDiscover();
    else if (key === 'rss') this.rssJourney.openRss();
  }

  private retapPrimaryBottomTab(key: string): void {
    if (!this.primaryBottomNavigationInputAllowed() || key !== this.route ||
      !this.settingsPresentation.snapshot.tapBottomScrollTop) return;
    if (key === 'bookshelf') this.shelfRead.scrollTopToken += 1;
    else if (key === 'settings' && !this.expandedLayout()) this.settingsHomeScrollTopRequest += 1;
  }

  private recordPrimaryTabFooter(area: Area): void {
    const height = readerPageAreaLength(area.height);
    if (this.showsPrimaryBottomNavigation() && Number.isFinite(height) && height > 0 &&
      Math.abs(height - this.primaryTabFooterHeight) >= 0.1) this.primaryTabFooterHeight = height;
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.pageSurfaces();
      AppWindowOverlays({
        bookRemoval: this.journeys.bookRemovalConfirmation,
        webBounds: this.wideSettingsPane() === 'source' && this.route === 'source' ? this.sourcePaneBounds : undefined,
        topInset: this.overlaySafeTop(),
        onWebBack: (handler: (() => boolean) | undefined): void => { this.journeys.bindWebBack(handler); },
        onWebInputCaptured: (captured: boolean): void => {
          if (this.journeys.retired() || this.arkWebCapturesInput === captured) return;
          this.arkWebCapturesInput = captured;
          if (!captured) this.journeys.navigationSettled();
        },
      });
    }
      .width('100%')
      .height(LayoutPolicy.matchParent)
      .backgroundColor(readerAppColor('app.window.background', this.appThemeScheme))
      .expandSafeArea(this.mangaOwnsWindowEdges() ? [SafeAreaType.SYSTEM, SafeAreaType.CUTOUT] : [SafeAreaType.SYSTEM],
        this.mangaOwnsWindowEdges() ? [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END] :
          [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM])
      .ignoreLayoutSafeArea([LayoutSafeAreaType.SYSTEM],
        this.mangaOwnsWindowEdges() ? [LayoutSafeAreaEdge.ALL] : [LayoutSafeAreaEdge.TOP, LayoutSafeAreaEdge.BOTTOM])
  }

  @Builder
  private pageSurfaces() {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack({ alignContent: Alignment.TopStart }) {
        ReaderRouteStackSurface({
          route: this.appRouteLane(), routeMotion: this.searchAppForeground ? this.visibleRouteMotion : 'none',
          surfaceId: 'reader-app-route-stack',
          wideSettingsLayout: this.expandedLayout(), settingsPresentationRoot: this.settingsViewportPlan().settingsRoot,
          extendsToWindowEdges: true,
          viewportWidth: this.routeViewportWidth(), reduceMotion: this.appReduceMotion,
          readerDetailActive: this.presentedReaderDetail() !== undefined,
          readerDetailScene: this.readerDetailScene,
          backGestureEnabled: this.appRouteBackGestureEnabled(),
          content: (route: ReaderRouteSurfaceKey): void => { this.appRouteContent(route as ReaderRoute); },
          onBack: (): boolean => this.onBackPress(),
        });
        Column().opacity(this.readerParentMotionProgress() * READER_ROUTE_PARENT_DIM)
          .animation(this.readerParentAnimation())
          .width('100%').height('100%').backgroundColor(Color.Black)
          .hitTestBehavior(HitTestMode.None).accessibilityLevel('no-hide-descendants');
      }.translate({ x: -this.routeViewportWidth() * READER_ROUTE_PARENT_PARALLAX * this.readerParentMotionProgress() })
        .animation(this.readerParentAnimation())
        .width('100%').height('100%')
        .zIndex(this.detailAboveReader() ? 1 : 0);
      AppReadingRouteSurface({
        reading: this.readingEntry, commits: this.readingCommits,
        source: this.sourceSwitchPresentation, manga: this.mangaSourceSwitch,
        route: this.route, directoryTarget: this.directoryReturnTarget,
        detail: this.presentedReaderDetail(), detailMatchesBook: (): boolean => this.readingMotion.matchesBook(),
        detailAboveReader: this.detailAboveReader(),
        foreground: this.searchAppForeground, covered: this.arkWebCapturesInput, expanded: this.expandedLayout(),
        reduceMotion: this.appReduceMotion, viewportWidth: this.routeViewportWidth(),
        ports: (): RetainedReaderScenePorts => this.journeys.retainedReaderPorts(),
        backGestureEnabled: this.readerDetailBackGestureEnabled(), detailMotion: this.readingMotion,
      });
      this.primaryBottomNavigation();
      this.pageOverlays();
    }
    .width('100%').height('100%')
    .enabled(!this.arkWebCapturesInput)
    .hitTestBehavior(this.arkWebCapturesInput ? HitTestMode.None : HitTestMode.Default)
    .accessibilityLevel(this.arkWebCapturesInput ? 'no-hide-descendants' : 'auto');
  }

  @Builder
  private primaryBottomNavigation() {
    if (this.showsPrimaryBottomNavigation()) {
      Stack({ alignContent: Alignment.Bottom }) {
        Column() {
          ReaderBottomNavigation({ current: this.route === 'bookshelf' ? 'bookshelf' : 'settings',
            inputEnabled: this.primaryBottomNavigationInputAllowed(),
            actionGeneration: this.navigationGeneration,
            onSelect: (key: string): void => this.selectPrimaryBottomTab(key),
            onCurrentTap: (key: string): void => this.retapPrimaryBottomTab(key),
          });
        }.width('100%').onAreaChange((_old: Area, next: Area): void => this.recordPrimaryTabFooter(next))
          .hitTestBehavior(HitTestMode.Default).responseRegion(readerLayoutCarrierResponseRegion());
      }.width('100%').height('100%')
        .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM])
        .accessibilityLevel(this.primaryBottomNavigationInputAllowed() ? 'auto' : 'no-hide-descendants')
        .hitTestBehavior(this.primaryBottomNavigationInputAllowed() ? HitTestMode.Default : HitTestMode.None)
        .responseRegion(readerLayoutCarrierResponseRegion());
    }
  }

  private routeViewport(): ReaderRectVp {
    this.readerWindowMetricsRevision;
    return ReaderWindowCoordinator.metrics().windowRect;
  }

  private routeViewportWidth(): number {
    return this.routeViewport().width;
  }

  private overlaySafeTop(): number {
    return this.readerOwnsWindowEdges() ? 0 : this.appContentTopInset();
  }

  private appRouteLane(): ReaderRoute {
    return this.routeCoordinator.appLane(this.route, this.directoryReturnTarget,
      this.readerDetailScene?.phase === 'pop', this.navigationOwner.returns.snapshot().readingOrigin,
      (): ReaderRoute => this.settingsViewportPlan().lane);
  }

  private appRouteSafeTop(route: ReaderRoute): number {
    if (route === 'detail' || route === 'directory') return 0;
    return this.appContentTopInset();
  }

  @Builder
  private appRouteContent(route: ReaderRoute) {
    Stack({ alignContent: Alignment.TopStart }) {
      if (route === 'bookshelf' || route === 'detail' || route === 'directory') {
        AppPrimaryRouteSurface({
          paint: route, scope: this.primaryScope(),
          presentations: { read: this.shelfRead, mutations: this.shelfMutations, catalog: this.shelfCatalog,
            search: this.librarySearch, entry: this.readingEntry, detail: this.detailShelf },
          actions: {
            current: (): AppPrimaryScope => this.primaryScope(),
            manageSourcesFromSearch: (): void => this.journeys.sourceNavigation.manageFromSearch(),
            openDetailSourceSwitch: (): void => this.journeys.openDetailSourceSwitch(),
            onBack: (): boolean => this.onBackPress(),
            shelfPreparing: this.readingEntryActions.shelfPreparing,
            bookshelfAcceptsInput: this.bookshelfContentAcceptsInput(),
            detailIsForeground: this.journeys.detailContentIsForeground(), detailDirectoryActive: this.journeys.isDetailDirectoryRoute(),
            bookshelfPorts: (owner: ReaderRuntimeOwner | undefined, mounting: number): BookshelfScenePorts =>
              this.journeys.bookshelfScenePorts(owner, mounting),
            detailPorts: (): BookshelfDetailScenePorts => this.journeys.detailScenePorts(),
          },
          navigationOwner: this.navigationOwner, libraryJourney: this.journeys.libraryJourney,
          acquisition: this.journeys.libraryAcquisition, directory: this.journeys.directoryJourney,
          bottomNavigationHeight: this.primaryTabFooterHeight, tapBottomScrollTop: this.settingsPresentation.snapshot.tapBottomScrollTop,
          renderSearchResults: (input: AppPrimaryRouteInput): void => this.renderSearchResults(input),
        });
      } else if (route === 'settings' && this.expandedLayout()) {
        this.wideSettingsRoute();
      } else {
        this.secondaryRouteSurface(route);
      }
    }.width('100%').height('100%').padding({ top: this.appRouteSafeTop(route) });
  }

  private primaryScope(): AppPrimaryScope {
    return { route: this.route, navigation: this.navigationGeneration, mounting: this.detailShelfAdmissionMount,
      owner: this.journeys.runtime(), expanded: this.expandedLayout(), reduceMotion: this.appReduceMotion,
      foreground: this.searchAppForeground, covered: this.arkWebCapturesInput };
  }

  @Builder
  private renderSearchResults(input: AppPrimaryRouteInput) {
    AppPrimarySearchResultsSlot(input);
  }

  @Builder
  private renderWideSettingsStack(input: AppWideSettingsRouteInput, width: number) {
    AppWideSettingsStackContent(input, width);
  }

  @Builder
  private wideSettingsRoute() {
    AppWideSettingsRoute({
      pane: this.wideSettingsSelection(), lane: this.wideSettingsLane, motion: this.wideSettingsMotion,
      foreground: this.searchAppForeground, scheme: this.appThemeScheme, reduceMotion: this.appReduceMotion,
      collapsed: this.wideSettingsCollapsed, interactive: this.wideSettingsInputAllowed(),
      backGestureEnabled: this.journeys.journeyRecoveryInputAllowed(),
      footerHeight: this.settingsViewportPlan().reserveSharedFooter ? this.primaryTabFooterHeight : -1,
      toggleCollapsed: (): void => {
        if (this.wideSettingsInputAllowed()) this.wideSettingsCollapsed = !this.wideSettingsCollapsed;
      },
      onPane: (pane: SettingsPane): void => this.requestWideSettingsPane(pane),
      routeContent: (route: ReaderRouteSurfaceKey): void => {
        if (route === 'settings-general') this.secondaryRouteSurface('settings', true, 'general');
        else if (route === 'settings-backup') this.secondaryRouteSurface('settings', true, 'backup');
        else if (route === 'settings-about') this.secondaryRouteSurface('settings', true, 'about');
        else this.secondaryRouteSurface(route as ReaderRoute, true);
      },
      renderStackContent: (input: AppWideSettingsRouteInput, width: number): void => this.renderWideSettingsStack(input, width),
      onBack: (): boolean => this.onBackPress(),
    });
  }

  private bookshelfContentAcceptsInput(): boolean {
    // Read the root's observed presentations so both rendered input gates update on dismissal.
    const modalVisible = this.shelfMutations.snapshot.importPresentation !== undefined ||
      this.shelfGroupPresentation.identity.length > 0;
    return this.journeys.bookshelfContentAcceptsInput(modalVisible);
  }

  @Builder
  private pageOverlays() {
    AppOverlayHost({
      route: this.route, generation: this.navigationGeneration,
      reduceMotion: this.appReduceMotion, topInset: this.overlaySafeTop(),
      sourceSwitch: {
        entry: this.readingEntry, source: this.sourceSwitchPresentation, manga: this.mangaSourceSwitch,
        entryPickerAllowed: this.route === 'detail' || this.route === 'bookshelf' || this.journeys.isDetailDirectoryRoute(),
        interactive: this.searchAppForeground && !this.arkWebCapturesInput,
        consumeTopInset: this.readerOwnsWindowEdges(), actions: this.journeys.sourceSwitchActions,
      },
      modals: {
        groups: this.shelfGroupPresentation, imports: this.shelfMutations, json: this.jsonImportPresentation,
        expandedLayout: this.expandedLayout(),
        groupInput: (): boolean => this.searchAppForeground && !this.arkWebCapturesInput &&
          (this.route === 'bookshelf' || this.route === 'detail'),
        canRestoreImportFocus: (): boolean => this.journeys.isInteractiveBookshelfPresentation(
          this.navigationGeneration, this.journeys.runtime(), this.detailShelfAdmissionMount) &&
          !this.journeys.bookRemovalConfirmation.isOpen() && this.jsonImportPresentation.opening === undefined &&
          !this.sourceSwitchPresentation.isSurfacePresented() && !this.mangaSourceSwitch.selectionVisible,
        canUseJson: (): boolean => this.journeys.canUseJsonImport(),
        canRestoreJsonFocus: (opening: JsonImportOpening): boolean => this.journeys.canUseJsonImport() &&
          (opening.context === 'bookSource' && this.route === 'source' ||
            opening.context === 'ruleBundle' && this.route === 'rulesManagement'),
      },
      feedback: {
        detail: this.detailShelf, messageTopInset: this.messageSafeTop(),
        startupVisible: this.bookshelfContentAcceptsInput(),
        startup: readerLegacySnapshotRecoveryView(this.journeys.runtime()?.legacySnapshotMigrationRecovery()),
        interactive: this.journeys.journeyRecoveryInputAllowed(), canInteract: (): boolean => this.journeys.journeyRecoveryInputAllowed(),
        mangaVisible: this.journeys.canPresentMangaRecovery(), canRetryManga: (): boolean => this.journeys.canPresentMangaRecovery(),
        firstContentRequired: (): boolean => this.route === 'bookshelf' &&
          this.shelfRead.snapshot.visualAdmitted && !this.shelfRead.headerScrolled,
        pageInputEnabled: !this.arkWebCapturesInput && (this.route === 'bookshelf' ? this.bookshelfContentAcceptsInput() :
          this.route === 'detail' ? this.journeys.detailContentIsForeground() :
          !this.sourceSwitchPresentation.isSurfacePresented() && !this.mangaSourceSwitch.selectionVisible),
      },
    });
  }

  private wideSettingsPane(): SettingsPane | undefined {
    if (!this.expandedLayout()) return undefined;
    if (this.route === 'settings') return this.settingsSection === 'home' ? 'general' : this.settingsSection;
    return this.navigationOwner.settingsPane();
  }

  private wideSettingsSelection(): SettingsPane {
    if (this.wideSettingsLane === 'settings-general') return 'general';
    if (this.wideSettingsLane === 'settings-backup') return 'backup';
    if (this.wideSettingsLane === 'settings-about') return 'about';
    if (this.wideSettingsLane === 'sourceTools') return 'source';
    return this.wideSettingsLane as SettingsPane;
  }

  private wideSettingsInputAllowed(): boolean {
    return this.wideSettingsPane() !== undefined && this.journeys.rulesManagementInputAllowed() &&
      !this.journeys.bookRemovalConfirmation.isOpen() && !ReaderNativeAlertWindow.isPresented() &&
      this.navigationOwner.canSwitchSettingsPane(this.journeys.currentReadingRuntime());
  }

  private requestWideSettingsPane(pane: SettingsPane): void {
    if (!this.wideSettingsInputAllowed()) return;
    if (pane === 'source' && this.route === 'sourceTools') {
      this.journeys.sourceNavigation.returnToManagement();
      return;
    }
    if (this.wideSettingsPane() === pane) return;
    if (pane === 'general' || pane === 'backup' || pane === 'about') {
      this.journeys.settingsNavigation.returnToSettings(pane);
    } else {
      this.journeys.settingsNavigation.returnToSettings('home', false);
      this.journeys.openSettingsDestination(pane);
    }
    if (this.wideSettingsPane() === pane) this.wideSettingsMotion = 'tab';
  }

  private requestWideSettingsMainTab(tab: string): void {
    if (!this.wideSettingsInputAllowed()) return;
    if (tab === 'bookshelf') this.journeys.libraryJourney.returnToBookshelf(undefined, 'tab');
    else if (tab === 'discover') this.journeys.openDiscover(false, 'tab');
    else if (tab === 'rss') this.rssJourney.openRss('tab');
  }

  @Builder
  private secondaryRouteSurface(route: ReaderRoute, embeddedWide: boolean = false, paneSection?: 'general' | 'backup' | 'about') {
    AppSecondaryRouteStack({
      paint: route, embeddedWide, paneSection, scope: this.secondaryScope(), coordinator: this.routeCoordinator,
      presentations: {
        selection: this.shelfMutations, shelfManagement: this.shelfManagement, rss: this.rssJourney, discover: this.discoverPresentation,
        settings: this.settingsPresentation, downloads: this.downloadPresentation, rules: this.rulesPresentation,
        source: this.journeys.sourceJourney, sync: this.syncPresentation, json: this.jsonImportPresentation,
      },
      actions: {
        current: (): AppSecondaryScope => this.secondaryScope(),
        navigateBack: (): boolean => this.onBackPress(),
        showBookshelf: (): void => this.journeys.libraryJourney.returnToBookshelf(),
        showSettings: (): void => this.journeys.settingsNavigation.openSettings(),
        showDiscover: (): void => this.journeys.openDiscover(),
        openDiscoverBook: (generation: number, book: DiscoverBook): void => this.journeys.openDiscoveredBook(generation, book),
        returnToSettings: (): void => this.journeys.settingsNavigation.returnToSettings(),
        returnFromRules: (): void => this.journeys.settingsNavigation.returnFromRulesManagement(),
        settingsPaintCurrent: (route: SettingsRoute, section?: SettingsSection): boolean => this.settingsPaintCurrent(route, section),
        settingsInput: (route: SettingsRoute): boolean => this.searchAppForeground && !this.arkWebCapturesInput &&
          this.route === route && this.journeys.currentReadingRuntime() !== undefined,
        selectSettingsSection: (section: SettingsSection): void => {
          const next = this.navigationOwner.selectSettingsSection(section, (): void => { this.onBackPress(); });
          if (next !== undefined) this.publishNavigation(next);
        },
        openSettingsDestination: (destination: SettingsDestination): void => {
          if (this.route === 'settings' && settingsDestinationAllowedInSection(this.settingsSection, destination) &&
            this.journeys.currentReadingRuntime() !== undefined) {
            this.journeys.openSettingsDestination(destination);
          }
        },
        rulesIdentity: (generation: number, mounting: number): string => this.journeys.settingsNavigation.rulesIdentity(generation, mounting),
        sourceIdentity: (generation: number, mounting: number, route: 'source' | 'sourceTools'): string =>
          this.journeys.sourceNavigation.identity(generation, mounting, route),
        setSourceBackBlocked: (blocked: boolean): void => { this.sourceBackPreviewBlocked = blocked; },
        sourceBounds: (bounds: ArkWebInteractiveBounds): void => { this.sourcePaneBounds = bounds; },
        captureSourceSearch: (): (() => void) | undefined => this.journeys.sourceNavigation.importSearchAction(),
        confirmSourceDelete: (options: ReaderNativeAlertOptions, current: () => boolean): void => {
          this.journeys.showIndexAlert('confirmation-cancelable', options, current);
        },
        registerTemporaryBack: (scope: TemporaryBackScope, generation: number, owner: ReaderRuntimeOwner | undefined,
          handler: (() => boolean) | undefined, identity: string, blocksSettingsSwitch?: () => boolean): void =>
          this.journeys.registerTemporaryBackBridge(scope, generation, owner, handler, identity, blocksSettingsSwitch),
        readDownload: (entry: DownloadReadingEntry): void => this.journeys.downloadNavigation.openChapter(entry),
        downloadFeedback: (message: string): void => this.journeys.showOfflineDownloadFeedback(message),
      },
    });
  }

  private secondaryScope(): AppSecondaryScope {
    return {
      route: this.route, generation: this.navigationGeneration, mounting: this.detailShelfAdmissionMount,
      instance: this.journeys.rssInstanceIdentity, owner: this.journeys.runtime(), foreground: this.searchAppForeground,
      covered: this.arkWebCapturesInput, section: this.settingsSection, sourceOpening: this.sourceOpeningGeneration,
      sourceToolsOpening: this.sourceToolsOpeningGeneration, expandedLayout: this.expandedLayout(), reduceMotion: this.appReduceMotion,
      footerHeight: this.primaryTabFooterHeight, settingsScrollTop: this.settingsHomeScrollTopRequest,
    };
  }

  private readerOwnsWindowEdges(): boolean {
    if (this.mangaSourceSwitch.selectionVisible) return true;
    // Detail and its standalone directory each own their safe-top inset.
    if (this.readingEntry.book !== undefined && (this.route === 'detail' || this.journeys.isDetailDirectoryRoute())) return true;
    return this.readingEntry.sessionActive && (this.route === 'reading' ||
      (this.route === 'directory' && this.directoryReturnTarget === 'readerControl'));
  }

  private mangaOwnsWindowEdges(): boolean {
    if (this.mangaSourceSwitch.selectionVisible) return true;
    return (this.readingEntry.sessionActive || this.presentedReaderDetail() !== undefined) && this.readingEntry.contentKind === 'manga' &&
      this.readerOwnsWindowEdges();
  }

  private appContentTopInset(): number {
    // Reading the revision makes Window callbacks observable to this root;
    // the metric values themselves remain owned by ReaderWindowCoordinator.
    if (this.readerWindowMetricsRevision < 0) {
      return 0;
    }
    return readerContentSafeTop(ReaderWindowCoordinator.metrics());
  }

  private settingsPaintCurrent(route: SettingsRoute, section: SettingsSection | undefined): boolean {
    return this.route === route && (section === undefined || this.wideSettingsPane() === section);
  }

  private onSearchVisibilityChanged(): void {
    if (!this.searchAppForeground) {
      this.readerParentAnimated = false;
      this.readingMotion.foregroundLost();
    }
    this.journeys.visibilityChanged();
  }

  private messageSafeTop(): number {
    this.readerWindowMetricsRevision;
    // Ordinary App pages already inherit Index's safe-top padding.
    return this.readerOwnsWindowEdges() ? readerContentSafeTop(ReaderWindowCoordinator.metrics()) : 0;
  }

}
