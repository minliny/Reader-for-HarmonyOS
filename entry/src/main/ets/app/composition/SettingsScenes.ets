import type { SettingsSection } from '../navigation/ReaderNavigation';
import { ReaderThemeHost } from '../ReaderThemeHost';
import type { CommitReadbackSummary } from '../ReaderOperationFacts';
import { BookshelfSettingsPage } from '../../features/bookshelf/ui/BookshelfSettingsPage';
import { SettingsPage } from '../../features/settings/ui/SettingsPage';
import type { GeneralSettingsKey, SettingsSnapshot } from '../../features/settings/application/SettingsGateway';
import type { SettingsOperationProjection } from '../../features/settings/application/SettingsOrchestrator';
import type { SettingsCacheCleanupSnapshot } from '../../features/settings/application/SettingsCacheCleanupOwner';
import { SettingsPresentation, type SettingsRoute } from '../../features/settings/presentation/SettingsPresentation';
import type { ReaderAppThemeMode } from '../../ui/foundation/ReaderThemeRegistry';

export type SettingsDestination = 'source' | 'rulesManagement' | 'sync' | 'bookshelfSettings' | 'downloads' | 'rss' | 'discover';

interface SettingsScenePaint {
  identity: string;
  generation: number;
  section: SettingsSection;
  homeScrollY: number;
  snapshot: SettingsSnapshot;
  operation: SettingsOperationProjection;
  cacheCleanup?: SettingsCacheCleanupSnapshot;
}

@Component
export struct SettingsScenes {
  @ObjectLink @Watch('capturePaint') presentation: SettingsPresentation;
  @Prop @Watch('capturePaint') route: SettingsRoute = 'settings';
  @Prop @Watch('capturePaint') section: SettingsSection = 'home';
  @Prop expandedLayout: boolean = false;
  @Prop embeddedWide: boolean = false;
  @Prop @Watch('capturePaint') generation: number = 0;
  @Prop @Watch('capturePaint') active: boolean = true;
  isPaintCurrent: (() => boolean) | undefined = undefined;
  isInputAllowed: (() => boolean) | undefined = undefined;
  onBack: () => void = (): void => {};
  onOpen: (destination: SettingsDestination) => void = (_destination: SettingsDestination): void => {};
  onSectionChange: (section: SettingsSection) => void = (_section: SettingsSection): void => {};
  onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string, blocksSettingsSwitch?: () => boolean) => void =
    (_handler: (() => boolean) | undefined, _identity: string): void => {};

  @State private painted: SettingsScenePaint | undefined = undefined;
  private mounted: boolean = false;

  aboutToAppear(): void {
    this.mounted = true;
    this.capturePaint();
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.painted = undefined;
  }

  private capturePaint(): void {
    if (!this.mounted || this.active === false || this.isPaintCurrent?.() === false) return;
    const identity = this.presentation.paintIdentity(this.route);
    // Keep the last live subtree while Navigation finishes painting this lane.
    if (identity.length === 0) return;
    this.painted = { identity, generation: this.generation, section: this.section, homeScrollY: this.presentation.homeScrollY,
      snapshot: this.presentation.snapshot, operation: this.presentation.operation, cacheCleanup: this.presentation.cacheCleanup };
  }

  private open(identity: string, destination: SettingsDestination): void {
    if (this.route === 'settings' && this.section === 'home' && this.inputIsCurrent(identity)) {
      this.onOpen(destination);
    }
  }

  private inputIsCurrent(identity: string): boolean {
    return this.active !== false && this.isPaintCurrent?.() !== false &&
      (this.isInputAllowed?.() ?? true) && this.presentation.isCurrent(identity);
  }

  @Builder
  private bookshelf(identity: string, generation: number) {
    BookshelfSettingsPage({
      embeddedWide: this.embeddedWide,
      navigationGeneration: generation,
      autoCheckUpdate: (this.painted?.snapshot ?? this.presentation.snapshot).autoCheckUpdate,
      operation: this.painted?.operation ?? this.presentation.operation,
      isInputAllowed: (): boolean => this.route === 'bookshelfSettings' && this.inputIsCurrent(identity),
      onBack: (): void => { if (this.inputIsCurrent(identity)) this.onBack(); },
      onAutoCheckUpdate: (value: boolean): void => {
        if (this.inputIsCurrent(identity)) this.presentation.toggle(identity, 'autoCheckUpdate', value);
      },
      onReconcile: (expected: number, navigation?: number): void => {
        if (this.inputIsCurrent(identity) && (navigation === undefined || navigation === generation))
          this.presentation.reconcile(identity, expected);
      },
      onRetryAccepted: (expected: number, navigation?: number): void => {
        if (this.inputIsCurrent(identity) && (navigation === undefined || navigation === generation))
          this.presentation.reconcile(identity, expected, true);
      },
    });
  }

  @Builder
  private settings(identity: string) {
    SettingsPage({
      navigationGeneration: this.painted?.generation ?? this.generation,
      homeScrollY: this.painted?.homeScrollY ?? this.presentation.homeScrollY,
      activeSection: this.painted?.section ?? this.section,
      snapshot: this.painted?.snapshot ?? this.presentation.snapshot, operation: this.painted?.operation ?? this.presentation.operation,
      cacheCleanup: this.painted === undefined ? this.presentation.cacheCleanup : this.painted.cacheCleanup,
      expandedLayout: this.expandedLayout, embeddedWide: this.embeddedWide,
      isOpeningCurrent: (): boolean => this.route === 'settings' && this.active !== false &&
        this.isPaintCurrent?.() !== false && this.presentation.isCurrent(identity),
      isInputAllowed: (): boolean => this.route === 'settings' && this.inputIsCurrent(identity),
      onSelectAppTheme: (mode: ReaderAppThemeMode): Promise<void> =>
        this.route === 'settings' && this.section === 'general' && this.inputIsCurrent(identity) ?
          ReaderThemeHost.selectApp(mode, (): boolean => this.route === 'settings' &&
            this.section === 'general' && this.inputIsCurrent(identity)) : Promise.resolve(),
      onTemporaryBackBridge: (handler: (() => boolean) | undefined, bridgeIdentity: string, blocksSettingsSwitch?: () => boolean): void => {
        if (this.active !== false && this.isPaintCurrent?.() !== false && this.presentation.isCurrent(identity))
          this.onTemporaryBackBridge(handler, bridgeIdentity, blocksSettingsSwitch);
      },
      onSectionChange: (section: SettingsSection): void => {
        if (this.inputIsCurrent(identity)) this.onSectionChange(section);
      },
      onBack: (): void => { if (this.inputIsCurrent(identity)) this.onBack(); },
      onHomeScrollDeparture: (y: number): void => {
        if (this.route === 'settings' && this.section === 'home' && this.inputIsCurrent(identity)) {
          this.presentation.rememberHomeScroll(identity, y);
        }
      },
      onOpenSourceManagement: (): void => this.open(identity, 'source'),
      onOpenSync: (): void => this.open(identity, 'sync'),
      onOpenBookshelfSettings: (): void => this.open(identity, 'bookshelfSettings'),
      onOpenDownloads: (): void => this.open(identity, 'downloads'),
      onRssRequested: (): void => this.open(identity, 'rss'),
      onDiscoverRequested: (): void => this.open(identity, 'discover'),
      onToggle: (key: GeneralSettingsKey, value: boolean): void => {
        if (this.inputIsCurrent(identity)) this.presentation.toggle(identity, key, value);
      },
      onRestoreDefaults: (): Promise<CommitReadbackSummary | undefined> =>
        this.route === 'settings' && this.section === 'general' && this.inputIsCurrent(identity) ?
        this.presentation.restoreDefaults(identity) : Promise.resolve(undefined),
      onReconcile: (expected: number): void => {
        if (this.inputIsCurrent(identity)) this.presentation.reconcile(identity, expected);
      },
      onRetryAccepted: (expected: number): void => {
        if (this.inputIsCurrent(identity)) this.presentation.reconcile(identity, expected, true);
      },
      onReconcileCache: (expected: number): void => {
        if (this.inputIsCurrent(identity)) void this.presentation.reconcileCache(identity, expected);
      },
      onContinueCache: (expected: number): void => {
        if (this.inputIsCurrent(identity)) void this.presentation.reconcileCache(identity, expected, true);
      },
      onClearCache: (): Promise<void> => this.section === 'general' && this.inputIsCurrent(identity) ?
        this.presentation.clearCache(identity) : Promise.resolve(),
    });
  }

  build() {
    ForEach(this.painted === undefined ? [] : [this.painted.identity], (identity: string): void => {
      if (this.route === 'settings') {
        this.settings(identity);
      } else {
        this.bookshelf(identity, this.painted?.generation ?? this.generation);
      }
    }, (identity: string): string => identity);
  }
}
