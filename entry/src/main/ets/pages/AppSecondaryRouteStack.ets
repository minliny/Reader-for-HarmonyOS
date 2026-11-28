import type { ReaderRuntimeOwner } from '../app/ReaderRuntimeOwner';
import { isReaderProductSurfaceEnabled } from '../app/ReaderProductScope';
import { SettingsScenes, type SettingsDestination } from '../app/composition/SettingsScenes';
import { rulesManagementImportFocus, RulesManagementSurface } from '../features/settings/ui/RulesManagementSurface';
import { SharedDownloadScene } from '../features/downloads/ui/SharedDownloadScene';
import { SourceJourneySurface } from '../features/source/ui/SourceJourneySurface';
import { ReaderWideSettingsShell } from '../features/settings/ui/ReaderWideSettingsShell';
import { RssJourneySurface } from '../features/rss/ui/RssJourneySurface';
import { DiscoverSurface } from '../features/discover/ui/DiscoverSurface';
import { BookshelfMultiSelectPage } from '../features/bookshelf/ui/BookshelfMultiSelectPage';
import { BookshelfManagementSurface } from '../features/bookshelf/ui/BookshelfManagementSurface';
import { SyncSurface } from '../features/sync/ui/SyncSurface';
import { ReaderRouteStackSurface, type ReaderRouteSurfaceKey } from '../app/navigation/ReaderRouteStackSurface';
import type { ReaderRoute, ReaderRouteMotionKind, SettingsSection, TemporaryBackScope } from '../app/navigation/ReaderNavigation';
import type { AppRouteCoordinator } from '../app/AppRouteCoordinator';
import type { ReaderNativeAlertOptions } from '../ui/platform/ReaderNativeAlertOwner';
import { readerAppColor } from '../ui/foundation/ReaderAppColors';
import { readerPageAreaLength } from '../ui/layout/ReaderPageShell';
import type { ArkWebInteractiveBounds } from '../ui/platform/ArkWebExecutionHost';
import type { SettingsPane } from '../features/settings/presentation/SettingsNavigationItems';
import type { SettingsPresentation, SettingsRoute } from '../features/settings/presentation/SettingsPresentation';
import type { RulesManagementPresentation } from '../features/settings/presentation/RulesManagementPresentation';
import type { RssJourneyPresentation, RssRoute } from '../features/rss/presentation/RssJourneyPresentation';
import type { DiscoverBook } from '../features/discover/application/DiscoverGateway';
import type { DiscoverScenePresentation } from '../features/discover/presentation/DiscoverScenePresentation';
import type { SyncPresentation } from '../features/sync/presentation/SyncPresentation';
import type { SourceJourneyPresentation } from '../features/source/presentation/SourceJourneyPresentation';
import type { DownloadReadingEntry, SharedDownloadPresentation } from '../features/downloads/presentation/SharedDownloadPresentation';
import type { BookshelfManagementPresentation } from '../features/bookshelf/presentation/BookshelfManagementPresentation';
import type { BookshelfMutationPresentation } from '../features/bookshelf/presentation/BookshelfMutationPresentation';
import type { JsonImportPresentation } from '../app/composition/JsonImportPresentation';

export interface AppSecondaryScope {
  readonly route: ReaderRoute;
  readonly generation: number;
  readonly instance: number;
  readonly mounting: number;
  readonly owner: ReaderRuntimeOwner | undefined;
  readonly foreground: boolean;
  readonly covered: boolean;
  readonly section: SettingsSection;
  readonly sourceOpening: number;
  readonly sourceToolsOpening: number;
  readonly expandedLayout: boolean;
  readonly reduceMotion: boolean;
  readonly footerHeight: number;
  readonly settingsScrollTop: number;
}

export interface AppSecondaryPresentations {
  readonly selection: BookshelfMutationPresentation;
  readonly shelfManagement: BookshelfManagementPresentation;
  readonly rss: RssJourneyPresentation;
  readonly discover: DiscoverScenePresentation;
  readonly settings: SettingsPresentation;
  readonly downloads: SharedDownloadPresentation;
  readonly rules: RulesManagementPresentation;
  readonly source: SourceJourneyPresentation;
  readonly sync: SyncPresentation;
  readonly json: JsonImportPresentation;
}

export interface AppSecondaryActions {
  readonly current: () => AppSecondaryScope;
  readonly navigateBack: () => boolean;
  readonly showBookshelf: () => void;
  readonly showSettings: () => void;
  readonly showDiscover: () => void;
  readonly openDiscoverBook: (generation: number, book: DiscoverBook) => void;
  readonly returnToSettings: () => void;
  readonly returnFromRules: () => void;
  readonly settingsPaintCurrent: (route: SettingsRoute, section?: SettingsSection) => boolean;
  readonly settingsInput: (route: SettingsRoute) => boolean;
  readonly selectSettingsSection: (section: SettingsSection) => void;
  readonly openSettingsDestination: (destination: SettingsDestination) => void;
  readonly rulesIdentity: (generation: number, mounting: number) => string;
  readonly sourceIdentity: (generation: number, mounting: number, route: 'source' | 'sourceTools') => string;
  readonly setSourceBackBlocked: (blocked: boolean) => void;
  readonly sourceBounds: (bounds: ArkWebInteractiveBounds) => void;
  readonly captureSourceSearch: () => (() => void) | undefined;
  readonly confirmSourceDelete: (options: ReaderNativeAlertOptions, current: () => boolean) => void;
  readonly registerTemporaryBack: (scope: TemporaryBackScope, generation: number,
    owner: ReaderRuntimeOwner | undefined, handler: (() => boolean) | undefined, identity: string,
    blocksSettingsSwitch?: () => boolean) => void;
  readonly readDownload: (entry: DownloadReadingEntry) => void;
  readonly downloadFeedback: (message: string) => void;
}

export interface AppSecondaryRouteInput {
  readonly paint: ReaderRoute;
  readonly embeddedWide: boolean;
  readonly paneSection?: 'general' | 'backup' | 'about';
  readonly scope: AppSecondaryScope;
  readonly presentations: AppSecondaryPresentations;
  readonly actions: AppSecondaryActions;
  readonly coordinator: AppRouteCoordinator;
}

export interface AppWideSettingsRouteInput {
  readonly pane: SettingsPane;
  readonly lane: ReaderRouteSurfaceKey;
  readonly motion: ReaderRouteMotionKind | 'none';
  readonly foreground: boolean;
  readonly scheme: string;
  readonly reduceMotion: boolean;
  readonly collapsed: boolean;
  readonly interactive: boolean;
  readonly backGestureEnabled: boolean;
  readonly footerHeight: number;
  readonly toggleCollapsed: () => void;
  readonly onPane: (pane: SettingsPane) => void;
  readonly routeContent: (route: ReaderRouteSurfaceKey) => void;
  readonly renderStackContent: (input: AppWideSettingsRouteInput, width: number) => void;
  readonly onBack: () => boolean;
}

@Builder
export function AppWideSettingsStackContent(input: AppWideSettingsRouteInput, width: number) {
  ReaderRouteStackSurface({
    route: input.lane, surfaceId: 'reader-wide-settings-route-stack',
    routeMotion: input.foreground ? input.motion : 'none', reduceMotion: input.reduceMotion,
    viewportWidth: width, backGestureEnabled: input.backGestureEnabled,
    content: input.routeContent,
    onBack: input.onBack,
  }).width('100%').height('100%')
    .backgroundColor(readerAppColor('app.window.background', input.scheme));
}

@Builder
export function AppWideSettingsRoute($$: AppWideSettingsRouteInput) {
  ReaderWideSettingsShell({
    pane: $$.pane, collapsed: $$.collapsed, interactive: $$.interactive,
    sharedBottomNavigationHeight: $$.footerHeight,
    onToggle: $$.toggleCollapsed, onPane: $$.onPane,
    content: (width: number): void => $$.renderStackContent($$, width),
  });
}

/** Paint the selected route using its owning presentation and its original opening key. */
@Builder
export function AppSecondaryRouteStack($$: AppSecondaryRouteInput) {
  if ($$.paint === 'bookshelfSettings' || $$.paint === 'settings') {
    SecondarySettingsScene($$);
  } else if ($$.paint === 'bookshelfMultiSelect') {
    ForEach([$$.presentations.selection.selection.identity], (identity: number): void => {
      BookshelfMultiSelectPage({
        books: $$.presentations.selection.selection.books,
        ready: $$.presentations.selection.selection.ready,
        initialSelectedKey: $$.presentations.selection.selection.initialKey,
        busy: $$.presentations.selection.snapshot.batchRemovalBusy || $$.presentations.selection.selectionVerifying,
        isInputAllowed: (): boolean => {
          const current = $$.actions.current();
          return current.foreground && !current.covered && current.route === 'bookshelfMultiSelect' &&
            identity === $$.presentations.selection.selection.identity;
        },
        onCancel: (): void => {
          if (identity === $$.presentations.selection.selection.identity) $$.actions.showBookshelf();
        },
        onRemoveSelected: (keys: string[]): void => $$.presentations.selection.requestSelectionRemoval(identity, keys),
      });
    }, (identity: number): string => identity.toString());
  } else if ($$.paint === 'bookshelfManagement') {
    BookshelfManagementSurface({ presentation: $$.presentations.shelfManagement, onBack: $$.actions.showBookshelf });
  } else if (isReaderProductSurfaceEnabled('rss') && ($$.paint === 'rss' || $$.paint === 'rssSubscriptionManagement' ||
    $$.paint === 'rssSubscriptionEditor' || $$.paint === 'rssSourceFeed' || $$.paint === 'rssEntryDetail')) {
    ForEach([$$.scope.generation], (generation: number): void => {
      RssJourneySurface({ presentation: $$.presentations.rss, route: $$.paint as RssRoute, generation, owner: $$.scope.owner,
        mounting: $$.scope.mounting,
        identity: $$.paint === 'rssSubscriptionEditor' ? $$.presentations.rss.rssEditorPresentationIdentity :
          $$.presentations.rss.rssPresentationIdentity,
        expandedLayout: $$.scope.expandedLayout, onBookshelf: $$.actions.showBookshelf,
        onSettings: $$.actions.showSettings, onDiscover: $$.actions.showDiscover })
        .enabled($$.presentations.json.opening === undefined)
        .accessibilityLevel($$.presentations.json.opening === undefined ? 'auto' : 'no-hide-descendants');
    }, (generation: number): string => generation.toString());
  } else if (isReaderProductSurfaceEnabled('discover') && $$.paint === 'discover') {
    ForEach([$$.scope.generation], (generation: number): void => {
      DiscoverSurface({
        presentation: $$.presentations.discover,
        identity: $$.coordinator.extensionIdentity($$.scope.instance, $$.scope.mounting, generation, 'discover'),
        expandedLayout: $$.scope.expandedLayout, onBack: $$.actions.showBookshelf,
        onRss: (): void => $$.presentations.rss.openRss(), onSettings: $$.actions.showSettings,
        onOpenBook: (book: DiscoverBook): void => $$.actions.openDiscoverBook(generation, book),
      });
    }, (generation: number): string => generation.toString());
  } else if ($$.paint === 'downloads') {
    SharedDownloadScene({
      presentation: $$.presentations.downloads, reduceMotion: $$.scope.reduceMotion,
      active: $$.scope.route === 'downloads', isPaintCurrent: (): boolean => $$.actions.current().route === 'downloads',
      covered: $$.scope.covered, embeddedWide: $$.embeddedWide,
      onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string,
        blocksSettingsSwitch?: () => boolean): void => {
        const current = $$.actions.current();
        $$.actions.registerTemporaryBack('downloads', current.generation, current.owner, handler, identity, blocksSettingsSwitch);
      },
      onBack: (): void => { $$.actions.navigateBack(); },
      onRead: $$.actions.readDownload,
      onFeedback: $$.actions.downloadFeedback,
    });
  } else if ($$.paint === 'rulesManagement') {
    ForEach([$$.scope.generation], (generation: number): void => {
      SecondaryRulesScene($$, $$.actions.rulesIdentity(generation, $$.scope.mounting));
    }, (generation: number): string => generation.toString());
  } else if ($$.paint === 'source' || $$.paint === 'sourceTools') {
    // Advancing the navigation generation retires business actions before the
    // route changes. Preserve the covered lane's viewport until a real return.
    ForEach([$$.paint === 'sourceTools' ? $$.scope.sourceToolsOpening : $$.scope.sourceOpening],
      (generation: number): void => {
        SecondarySourceScene($$, generation, $$.scope.owner, $$.paint === 'sourceTools',
          $$.actions.sourceIdentity(generation, $$.scope.mounting, $$.paint === 'sourceTools' ? 'sourceTools' : 'source'));
      }, (generation: number): string =>
        $$.actions.sourceIdentity(generation, $$.scope.mounting, $$.paint === 'sourceTools' ? 'sourceTools' : 'source'));
  } else if (isReaderProductSurfaceEnabled('sync') && $$.paint === 'sync') {
    ForEach([$$.scope.generation], (generation: number): void => {
      SyncSurface({
        presentation: $$.presentations.sync,
        identity: $$.coordinator.extensionIdentity($$.scope.instance, $$.scope.mounting, generation, 'sync'),
        expandedLayout: $$.scope.expandedLayout, embeddedWide: $$.embeddedWide,
        onBack: $$.actions.returnToSettings,
      });
    }, (generation: number): string => generation.toString());
  }
}

@Builder
function SecondarySettingsScene($$: AppSecondaryRouteInput) {
  SettingsScenes({
    presentation: $$.presentations.settings, route: $$.paint as SettingsRoute,
    section: $$.paneSection ?? $$.scope.section,
    active: $$.actions.settingsPaintCurrent($$.paint as SettingsRoute, $$.paneSection),
    isPaintCurrent: (): boolean => $$.actions.settingsPaintCurrent($$.paint as SettingsRoute, $$.paneSection),
    expandedLayout: $$.scope.expandedLayout, embeddedWide: $$.embeddedWide, generation: $$.scope.generation,
    sharedBottomNavigationHeight: $$.scope.footerHeight, homeScrollTopRequest: $$.scope.settingsScrollTop,
    isInputAllowed: (): boolean => $$.actions.settingsInput($$.paint as SettingsRoute),
    onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string,
      blocksSettingsSwitch?: () => boolean): void => {
      const current = $$.actions.current();
      $$.actions.registerTemporaryBack('settings', current.generation, current.owner, handler, identity, blocksSettingsSwitch);
    },
    onSectionChange: $$.actions.selectSettingsSection,
    onBack: (): void => {
      if ($$.paint === 'bookshelfSettings') $$.actions.navigateBack();
      else $$.actions.showBookshelf();
    },
    onOpen: $$.actions.openSettingsDestination,
  });
}

@Builder
function SecondaryRulesScene(input: AppSecondaryRouteInput, identity: string) {
  RulesManagementSurface({
    presentation: input.presentations.rules, identity,
    inputEnabled: input.scope.foreground && !input.scope.covered && input.presentations.json.opening === undefined,
    embeddedWide: input.embeddedWide,
    onBack: input.actions.returnFromRules,
    onImport: (): void => input.presentations.json.openRuleBundle(input.presentations.rules, identity,
      rulesManagementImportFocus(identity, input.embeddedWide)),
  }).enabled(input.presentations.json.opening === undefined)
    .accessibilityLevel(input.presentations.json.opening === undefined ? 'auto' : 'no-hide-descendants');
}

@Builder
function SecondarySourceScene(input: AppSecondaryRouteInput, generation: number, owner: ReaderRuntimeOwner | undefined,
  showingTools: boolean, identity: string) {
  SourceJourneySurface({
    presentation: input.presentations.source, identity, showingTools,
    expandedLayout: input.scope.expandedLayout, embeddedWide: input.embeddedWide,
    reduceMotion: input.scope.reduceMotion,
    inputEnabled: input.scope.foreground && !input.scope.covered && input.presentations.json.opening === undefined,
    isInputAllowed: (): boolean => {
      const current = input.actions.current();
      return current.foreground && !current.covered && input.presentations.json.opening === undefined;
    },
    onBack: (): void => { input.actions.navigateBack(); },
    captureImportSearchAction: input.actions.captureSourceSearch,
    onBackPreviewBlocked: (blocked: boolean): void => {
      if (!showingTools && generation === input.actions.current().sourceOpening &&
        (!blocked || input.presentations.source.isManagementCurrent(identity))) input.actions.setSourceBackBlocked(blocked);
    },
    onTemporaryBackBridge: (handler: (() => boolean) | undefined, bridgeIdentity: string): void => {
      input.actions.registerTemporaryBack('source', generation, owner, handler, bridgeIdentity);
    },
    onToolsTemporaryBackBridge: (handler: (() => boolean) | undefined, bridgeIdentity: string): void => {
      input.actions.registerTemporaryBack('sourceTools', generation, owner, handler, bridgeIdentity);
    },
    onShowDeleteAlert: input.actions.confirmSourceDelete,
  })
    .enabled(input.presentations.json.opening === undefined)
    .accessibilityLevel(input.presentations.json.opening === undefined ? 'auto' : 'no-hide-descendants')
    .onAreaChange((_old: Area, area: Area): void => {
      if (!showingTools && input.embeddedWide && input.presentations.source.isManagementCurrent(identity)) {
        const width = readerPageAreaLength(area.width);
        const height = readerPageAreaLength(area.height);
        if (width > 0 && height > 0) input.actions.sourceBounds({
          left: readerPageAreaLength(area.globalPosition.x), top: readerPageAreaLength(area.globalPosition.y), width, height,
        });
      }
    });
}
