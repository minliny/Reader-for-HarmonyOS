import type { SettingsSection } from '../navigation/ReaderNavigation';
import { ReaderThemeHost } from '../ReaderThemeHost';
import type { CommitReadbackSummary } from '../ReaderOperationFacts';
import { BookshelfSettingsPage } from '../../features/bookshelf/ui/BookshelfSettingsPage';
import { SettingsPage } from '../../features/settings/ui/SettingsPage';
import type { GeneralSettingsKey } from '../../features/settings/application/SettingsGateway';
import { SettingsPresentation, type SettingsRoute } from '../../features/settings/presentation/SettingsPresentation';
import type { ReaderAppThemeMode } from '../../ui/foundation/ReaderThemeRegistry';

export type SettingsDestination = 'source' | 'rulesManagement' | 'sync' | 'bookshelfSettings' | 'downloads' | 'rss' | 'discover';

@Component
export struct SettingsScenes {
  @ObjectLink presentation: SettingsPresentation;
  @Prop route: SettingsRoute = 'settings';
  @Prop section: SettingsSection = 'home';
  @Prop expandedLayout: boolean = false;
  @Prop generation: number = 0;
  isInputAllowed: (() => boolean) | undefined = undefined;
  onBack: () => void = (): void => {};
  onOpen: (destination: SettingsDestination) => void = (_destination: SettingsDestination): void => {};
  onSectionChange: (section: SettingsSection) => void = (_section: SettingsSection): void => {};
  onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string) => void =
    (_handler: (() => boolean) | undefined, _identity: string): void => {};

  private open(identity: string, destination: SettingsDestination): void {
    if (this.route === 'settings' && this.section === 'home' && this.inputIsCurrent(identity)) {
      this.onOpen(destination);
    }
  }

  private inputIsCurrent(identity: string): boolean {
    return (this.isInputAllowed?.() ?? true) && this.presentation.isCurrent(identity);
  }

  @Builder
  private bookshelf(identity: string, generation: number) {
    BookshelfSettingsPage({
      navigationGeneration: generation,
      autoCheckUpdate: this.presentation.snapshot.autoCheckUpdate,
      operation: this.presentation.operation,
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
      navigationGeneration: this.generation,
      activeSection: this.section, snapshot: this.presentation.snapshot, operation: this.presentation.operation,
      cacheCleanup: this.presentation.cacheCleanup, expandedLayout: this.expandedLayout,
      isOpeningCurrent: (): boolean => this.route === 'settings' && this.presentation.isCurrent(identity),
      isInputAllowed: (): boolean => this.route === 'settings' && this.inputIsCurrent(identity),
      onSelectAppTheme: (mode: ReaderAppThemeMode): Promise<void> =>
        this.route === 'settings' && this.section === 'general' && this.inputIsCurrent(identity) ?
          ReaderThemeHost.selectApp(mode) : Promise.resolve(),
      onTemporaryBackBridge: (handler: (() => boolean) | undefined, bridgeIdentity: string): void => {
        if (this.presentation.isCurrent(identity)) this.onTemporaryBackBridge(handler, bridgeIdentity);
      },
      onSectionChange: (section: SettingsSection): void => {
        if (this.inputIsCurrent(identity)) this.onSectionChange(section);
      },
      onBack: (): void => { if (this.inputIsCurrent(identity)) this.onBack(); },
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
    ForEach(this.presentation.identity.length > 0 ? [this.presentation.identity] : [], (identity: string): void => {
      if (this.route === 'settings') {
        this.settings(identity);
      } else {
        this.bookshelf(identity, this.generation);
      }
    }, (identity: string): string => identity);
  }
}
