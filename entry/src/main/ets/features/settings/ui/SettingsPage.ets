import { createDefaultSettingsSnapshot, type SettingsSnapshot, type GeneralSettingsKey } from '../application/SettingsGateway';
import { ReaderTransientFeedback, READER_FEEDBACK_EXTENDED_MS } from '../../../ui/feedback/ReaderTransientFeedback';
import { ReaderRecoveryAction } from '../../../ui/feedback/ReaderRecoveryAction';
import { ReaderRecoveryGroup } from '../../../ui/feedback/ReaderRecoveryGroup';
import { ReaderRecoveryNotice } from '../../../ui/feedback/ReaderRecoveryNotice';
import { MESSAGE_BODY } from '../../../ui/foundation/ReaderMessageStyle';
import { readerRecoveryView } from '../../../app/ReaderRecoveryProjection';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';
import type { CommitReadbackSummary } from '../../../app/ReaderOperationFacts';
import type { SettingsOperationProjection } from '../application/SettingsOrchestrator';
import type { SettingsCacheCleanupSnapshot } from '../application/SettingsCacheCleanupOwner';
import { ReaderNativeAlertOwner, type ReaderNativeAlertOptions } from '../../../ui/platform/ReaderNativeAlertOwner';
import { TYPE_APP_INHERITED_BODY } from '../../../ui/foundation/ReaderTypography';
import { readerAppColor, type ReaderAppThemeMode } from '../../../ui/foundation/ReaderThemeRegistry';
import { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import { ReaderRouteStackSurface, type ReaderRouteSurfaceKey } from '../../../app/navigation/ReaderRouteStackSurface';
import type { SettingsSection } from '../../../app/navigation/ReaderNavigation';
import { settingsNavigationGroups, type SettingsNavigationGroup, type SettingsNavigationItem, type SettingsPane } from '../presentation/SettingsNavigationItems';
import { ReaderControlPlacementPreferences } from '../../../app/ReaderControlPlacementPreferences';
import { setReaderSystemMigrationIncludesOriginals } from '../../../app/ReaderSystemMigrationPreferences';
import { readerHarmonyCapabilities } from '../../../app/HarmonyCapabilityProbe';
import { readerControlAlignment } from '../../reading/ui/ReaderControlPlacement';
import { readerWidthClassWithHint } from '../../../ui/foundation/ReaderWidthClass';
import { ReaderAppearanceSaveUnconfirmedError, type ReaderAppearanceSaveState } from '../../reading/application/ReaderAppearanceStore';
import { readerPageAreaLength } from '../../../ui/layout/ReaderPageShell';
import { SettingsShell } from './SettingsShell';
import { ReaderStandardPage } from '../../../ui/layout/ReaderStandardPage';
import { PageBackBar } from '../../../ui/chrome/PageBackBar';
import { ReaderMessagePreviewPage } from './ReaderMessagePreviewPage';
import { registerReaderFonts } from '../../../ui/foundation/ReaderFonts';
import { ReaderButton } from '../../../ui/controls/ReaderButton';
import { ReaderToggle } from '../../../ui/controls/ReaderToggle';
import { ReaderSelect } from '../../../ui/controls/ReaderSelect';
import { ReaderSegmentedControl, READER_APP_THEME_SEGMENT_WIDTH } from '../../../ui/controls/ReaderSegmentedControl';
import { CategorySection } from './CategorySection';
import { ReaderCard } from '../../../ui/surfaces/ReaderCard';
import { DialogActionView, ReaderDialogSurface } from '../../../ui/surfaces/ReaderDialogSurface';
import { readerMotionStandardCurve } from '../../../ui/foundation/MotionSpec';
import { readerMotionReducedFadeParam } from '../../../ui/foundation/ReaderMotionPolicy';
import { ReaderPostLayoutFrame } from '../../../ui/layout/ReaderPostLayoutFrame';
import { ReaderFormRow } from '../../../ui/controls/ReaderFormRow';
import type { ReaderNavigationPreferenceChange, ReaderNavigationPreferences } from '../../../app/HarmonyCapabilityPolicy';
import { ReaderNavigationAppearancePreferences } from '../../../app/ReaderNavigationAppearancePreferences';
import { defaultNavigationPreferences, ReaderModalScrimModifier } from '../../../ui/surfaces/ReaderSurfaceMaterial';
import { DEFAULT_BOOKSHELF_VIEW, type BookshelfViewMode } from '../../bookshelf/application/BookshelfViewMode';
import { LocalRecoveryPanel } from '../../bookshelf/ui/LocalRecoveryPanel';
import { ReaderEditingVisibility } from '../../../ui/layout/ReaderEditingVisibility';
import { SettingsSelectOverlay, type SettingsSelectField } from './SettingsSelectOverlay';
import { NavigationAppearanceSettings, readerRenderModeLabel } from './NavigationAppearanceSettings';
import { SettingsLicensesPage } from './SettingsLicensesPage';
import { ReaderSmartGestureSettingsRows } from './ReaderSmartGestureSettingsRows';
import { isReaderProductSurfaceEnabled } from '../../../app/ReaderProductScope';
import { emptyReaderAppBuildInfo, readReaderAppBuildInfo, readerAppBuildDisplay, readerAppBuildCopy, type ReaderAppBuildInfo } from '../../../platform/bundle/ReaderAppBuildInfo';
import { copyReaderBuildIdentity } from '../../../platform/clipboard/ReaderClipboardHost';

// App主题 为分段控件 (Figma ThemeSegment 2114:20635), 非下拉; 标签用 Figma 原文。
const SEG_OPTIONS: string[] = ['跟随', '浅色', '深色'];
const THEME_SUMMARIES: string[] = ['跟随系统主题', '浅色主题', '深色主题'];
const DEVELOPER_UNLOCK_TAPS: number = 5;
const DEVELOPER_UNLOCK_MAX_GAP_MS: number = 1500;

interface SettingsSelectAnchor {
  right: number;
  bottom: number;
}

let settingsSelectionGeneration: number = 0;

@Component
export struct SettingsPage {
  @Prop embeddedWide: boolean = false;
  @Prop wideWindow: boolean = false;
  private readonly transientFeedback: ReaderTransientFeedback = new ReaderTransientFeedback();
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerAppForeground') private appForeground: boolean = true;
  @StorageLink('readerReduceMotion') private appReduceMotion: boolean = false;
  @StorageProp('readerSystemReduceMotion') private systemReduceMotion: boolean = false;
  @StorageProp('readerBookshelfViewMode') private bookshelfViewMode: BookshelfViewMode = DEFAULT_BOOKSHELF_VIEW;
  @StorageProp('readerNavigationAppearancePreferences')
  private navigationPreferences: ReaderNavigationPreferences = defaultNavigationPreferences();
  @StorageProp('readerNavigationAppearanceSavePending') private navigationSavePending: boolean = false;
  @StorageLink('readerDeveloperToolsUnlocked') private developerToolsUnlocked: boolean = false;
  @State private navigationSaving: boolean = false;
  @State private backupBusy: boolean = false;
  @StorageProp('readerSystemMigrationOriginals') private systemMigrationOriginals: boolean = false;
  @StorageProp('readerSystemMigrationState') private systemMigrationState: string = 'none';
  @State private systemMigrationSaving: boolean = false;

  @Prop @Watch('onActiveSectionChanged') activeSection: SettingsSection = 'home';
  @Prop @Watch('onAppearanceSaveHostChanged') navigationGeneration: number = 0;
  onSectionChange: (section: SettingsSection) => void = (_section: SettingsSection): void => {};
  isOpeningCurrent: () => boolean = (): boolean => false;
  isInputAllowed: (() => boolean) | undefined = undefined;
  onSelectAppTheme: (mode: ReaderAppThemeMode) => Promise<void> = (_mode: ReaderAppThemeMode): Promise<void> => Promise.resolve();

  @Prop @Watch('onSnapshotChanged') snapshot: SettingsSnapshot = createDefaultSettingsSnapshot();
  @Prop expandedLayout: boolean;
  @Prop @Watch('onOperationChanged') operation: SettingsOperationProjection = { action: 'load' };
  @Prop @Watch('onCacheCleanupChanged') cacheCleanup: SettingsCacheCleanupSnapshot | undefined = undefined;
  onReconcile: (generation: number) => void = (_generation: number): void => {};
  onRetryAccepted: (generation: number) => void = (_generation: number): void => {};
  onReconcileCache: (generation: number) => void = (_generation: number): void => {};
  onContinueCache: (generation: number) => void = (_generation: number): void => {};
  @StorageLink('readerAppThemeMode') private appThemeMode: string = 'system';
  @StorageLink('readerControlAlignment') private controlAlignment: string = 'center';
  @StorageLink('readerControlPlacementPendingGeneration') private controlPlacementPending: number = 0;
  @State private controlPlacementSaving: boolean = false;
  @State private languageValue: string = '简体中文';
  @State private startupValue: string = '书架';
  @State private tapBottomScrollTopValue: boolean = true;
  @State private crashLogValue: boolean = true;
  @State private developerModeValue: boolean = false;
  @State private wideNavigationRailValue: boolean = false;
  @State private resetInFlight: boolean = false;
  @State private resetMessage: string = '';
  @State private resetDialogTicket: number = 0;
  @State private resetCoverVisible: boolean = false;
  @State private resetFrameVisible: boolean = false;
  private resetDialogSerial: number = 0;
  private resetDialogWanted: boolean = false;
  private resetFrameAttached: boolean = false;
  private readonly nativeAlertOwner: ReaderNativeAlertOwner = new ReaderNativeAlertOwner();
  private mounted: boolean = false;
  private themeOwner: ReaderRuntimeOwner | undefined = undefined;
  @State private appearanceSaveRecovery: ReaderRecoveryView = { message: '', visible: false, canRetry: false, generation: 0 };
  @State private appearanceSaveRecoveryBusy: boolean = false;
  private appearanceSaveRevision: number = 0;
  private appearanceSaveRecoveryIdentity: string = '';
  private appearanceSaveUnsubscribe: (() => void) | undefined = undefined;
  @State private temporaryBackIdentity: string = '';
  @State private appThemeControlGeneration: number = 0;
  @State private aboutPageId: string = '';
  @State private aboutInfo: ReaderAppBuildInfo = emptyReaderAppBuildInfo();
  @State private developerPageId: string = '';
  @State private messagePreviewId: string = '';
  @State private licensesPageId: string = '';
  private retainedLicensesId: string = '';
  private licensesBackHandler: (() => boolean) | undefined = undefined;
  private developerTapCount: number = 0;
  private developerLastTap: number = 0;
  private readonly backupEditingHost: ReaderEditingVisibility = new ReaderEditingVisibility();
  private retainedAboutId: string = '';
  private retainedDeveloperId: string = '';
  private retainedMessagePreviewId: string = '';
  private messagePreviewBackHandler: (() => boolean) | undefined = undefined;
  onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string, blocksSettingsSwitch?: () => boolean) => void =
    (_handler: (() => boolean) | undefined, _identity: string): void => {};
  private resetRevision: number = 0;
  private resetSectionRevision: number = 0;
  private lastOperationFeedback: string = '';
  private lastOperationToast: string = '';
  private lastCacheFeedback: string = '';
  @State private openSelect: SettingsSelectField | '' = '';
  @State private selectionId: string = '';
  @State private selectionField: SettingsSelectField | '' = '';
  // 展开面板锚点: 触发条全局坐标减去宿主 Stack 原点, 得面板相对宿主 Stack 的位置。
  // selectAnchors 为普通 map(非 @State): 逐行 onAreaChange 写入, 打开时读入 anchorX/Y。
  @State private anchorRight: number = 0;
  @State private anchorBottom: number = 0;
  @State private originX: number = 0;
  @State private originY: number = 0;
  @State private paneWidth: number = 0;
  private selectAnchors: Record<string, SettingsSelectAnchor> = {};
  @Prop homeScrollY: number = 0;
  @Prop sharedBottomNavigationHeight: number = -1;
  @Prop homeScrollTopRequest: number = 0;
  private readonly homeScroller: Scroller = new Scroller();
  onBack: () => void = (): void => {};
  onHomeScrollDeparture: (y: number) => void = (_y: number): void => {};
  onOpenSourceManagement: () => void = (): void => {};
  onOpenRulesManagement: () => void = (): void => {};
  onOpenBookshelfSettings: () => void = (): void => {};
  onOpenDownloads: () => void = (): void => {};
  onOpenSync: () => void = (): void => {};
  onRssRequested: () => void = (): void => {};
  onDiscoverRequested: () => void = (): void => {};
  onClearCache: () => Promise<void> = (): Promise<void> => Promise.resolve();
  onRestoreDefaults: () => Promise<CommitReadbackSummary | undefined> =
    async (): Promise<CommitReadbackSummary | undefined> => undefined;
  onToggle: (key: GeneralSettingsKey, value: boolean) => void =
    (_key: string, _value: boolean): void => {};

  aboutToAppear(): void {
    this.mounted = true;
    try { this.themeOwner = ReaderRuntimeOwner.current(); }
    catch (_unavailable) { this.themeOwner = undefined; }
    registerReaderFonts(this.getUIContext().getFont());
    this.aboutInfo = readReaderAppBuildInfo();
    this.syncSnapshotValues();
    this.prepareAboutSection();
    this.lastOperationFeedback = this.operationFeedbackIdentity();
    this.lastCacheFeedback = this.cacheFeedbackIdentity();
    const identity = `settings-back:${++settingsSelectionGeneration}`;
    this.temporaryBackIdentity = identity;
    this.onTemporaryBackBridge((): boolean => this.consumeTemporaryBack(identity), identity,
      (): boolean => this.mounted && identity === this.temporaryBackIdentity && (this.resetDialogTicket > 0 || this.backupBusy));
    const owner = this.themeOwner;
    this.appearanceSaveUnsubscribe?.();
    if (owner !== undefined) this.appearanceSaveUnsubscribe = owner.getAppearanceStore().subscribeSaveState(
      (state: ReaderAppearanceSaveState): void => this.updateAppearanceSaveRecovery(owner, state));
  }

  aboutToDisappear(): void {
    this.transientFeedback.reset();
    this.appearanceSaveUnsubscribe?.();
    this.appearanceSaveUnsubscribe = undefined;
    this.appearanceSaveRecoveryIdentity = '';
    this.appearanceSaveRecovery = { message: '', visible: false, canRetry: false,
      generation: this.appearanceSaveRecovery.generation + 1 };
    this.appearanceSaveRecoveryBusy = false;
    this.aboutPageId = '';
    this.closeLicensesPage();
    this.retireDeveloperPages();
    const identity = this.temporaryBackIdentity;
    this.mounted = false;
    this.themeOwner = undefined;
    this.temporaryBackIdentity = '';
    this.nativeAlertOwner.retire();
    this.retireResetDialog();
    this.resetRevision += 1;
    this.retireSelection(true);
    this.onTemporaryBackBridge(undefined, identity);
  }

  private consumeTemporaryBack(identity: string): boolean {
    if (!this.mounted || identity !== this.temporaryBackIdentity) return false;
    if (this.activeSection === 'backup' && this.backupBusy) return true;
    if (this.resetDialogTicket > 0) {
      this.closeResetDialog(this.resetDialogTicket);
      return true;
    }
    if (this.messagePreviewCurrent(this.messagePreviewId)) {
      if (this.messagePreviewBackHandler?.() !== true) this.closeMessagePreview(this.messagePreviewId);
      return true;
    }
    if (this.developerPageCurrent(this.developerPageId)) {
      this.retireDeveloperPages();
      return true;
    }
    if (this.licensesPageCurrent(this.licensesPageId)) {
      if (this.licensesBackHandler?.() !== true) this.closeLicensesPage();
      return true;
    }
    if (!this.ownsSelection(this.selectionId)) return false;
    this.retireSelection();
    return true;
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack({ alignContent: Alignment.TopStart }) { this.pageSurface(); }
        .width('100%').height('100%').enabled(this.resetDialogTicket === 0)
        .accessibilityLevel(this.resetDialogTicket === 0 ? 'auto' : 'no-hide-descendants');
      Column().width(0).height(0).hitTestBehavior(HitTestMode.None).accessibilityLevel('no')
        .bindContentCover(this.resetCoverVisible, this.resetDialogCover,
          this.resetCoverOptions(this.resetDialogTicket, this.temporaryBackIdentity));
    }.width('100%').height('100%').hitTestBehavior(HitTestMode.Transparent)
      .onAreaChange((_old: Area, next: Area): void => {
        const width = readerPageAreaLength(next.width);
        if (width > 0 && width !== this.paneWidth) this.paneWidth = width;
      });
  }

  @Builder
  private pageSurface() {
    ReaderRouteStackSurface({
      route: this.settingsSubroute(), initialRoot: this.embeddedWide ? undefined : 'settings-home', routeMotion: 'push',
      surfaceId: this.settingsStackSurfaceId(),
      viewportWidth: this.paneWidth, reduceMotion: this.appReduceMotion,
      backGestureEnabled: this.settingsInputIsCurrent() && !this.backupBusy && this.resetDialogTicket === 0 && this.openSelect === '',
      content: (route: ReaderRouteSurfaceKey): void => { this.settingsPageContent(route); },
      onBack: (): boolean => this.settingsRouteBack(),
    });
  }

  private settingsStackSurfaceId(): string {
    return this.embeddedWide ? `reader-wide-settings-${this.activeSection}-subroute-stack` : 'reader-settings-subroute-stack';
  }

  private settingsSubroute(): ReaderRouteSurfaceKey {
    if (this.messagePreviewId.length > 0) return 'settings-message-preview';
    if (this.developerPageId.length > 0) return 'settings-developer';
    if (this.licensesPageId.length > 0) return 'settings-licenses';
    if (this.activeSection === 'about') return 'settings-about';
    if (this.activeSection === 'backup') return 'settings-backup';
    return this.activeSection === 'home' ? 'settings-home' : 'settings-general';
  }

  private settingsRouteBack(): boolean {
    if (!this.settingsInputIsCurrent()) return false;
    if (this.consumeTemporaryBack(this.temporaryBackIdentity)) return true;
    if (this.embeddedWide) { this.onBack(); return true; }
    if (this.activeSection === 'home') return false;
    this.onSectionChange('home');
    return true;
  }

  @Builder
  private settingsPageContent(route: ReaderRouteSurfaceKey) {
    if (route === 'settings-about') {
      ForEach([this.retainedAboutId], (identity: string): void => { this.aboutPage(identity); }, (identity: string): string => identity);
    } else if (route === 'settings-message-preview') {
      ForEach([this.retainedMessagePreviewId], (identity: string): void => {
        ReaderMessagePreviewPage({
          embeddedWide: this.embeddedWide,
          previewEnabled: this.messagePreviewCurrent(identity),
          onBack: (): void => this.closeMessagePreview(identity),
          onBackHandlerChange: (handler: (() => boolean) | undefined): void => {
            if (this.messagePreviewCurrent(identity)) this.messagePreviewBackHandler = handler;
          },
        });
      }, (identity: string): string => identity);
    } else if (route === 'settings-developer') {
      ForEach([this.retainedDeveloperId], (identity: string): void => {
        this.developerPage(identity);
      }, (identity: string): string => identity);
    } else if (route === 'settings-licenses') {
      ForEach([this.retainedLicensesId], (identity: string): void => {
        SettingsLicensesPage({
          current: this.licensesPageCurrent(identity),
          embeddedWide: this.embeddedWide,
          onBack: (): void => {
            if (this.licensesPageCurrent(identity)) this.closeLicensesPage();
          },
          onBackHandlerChange: (handler: (() => boolean) | undefined): void => {
            if (this.licensesPageCurrent(identity)) this.licensesBackHandler = handler;
          },
        });
      }, (identity: string): string => identity);
    } else if (route === 'settings-backup') {
      this.backupPage();
    } else {
    SettingsShell({
      activeSection: route === 'settings-home' ? 'home' : 'general',
      routeCurrent: route === this.settingsSubroute(),
      embeddedWide: this.embeddedWide,
      homeScroller: this.homeScroller, homeScrollY: this.homeScrollY,
      navigationGeneration: this.navigationGeneration,
      sharedBottomNavigationHeight: this.sharedBottomNavigationHeight,
      homeScrollTopRequest: this.homeScrollTopRequest,
      tapBottomScrollTop: this.tapBottomScrollTopValue,
      reduceMotion: this.appReduceMotion,
      onSectionChange: (section: 'home' | 'general'): void => {
        if (route !== this.settingsSubroute() || !this.settingsInputIsCurrent()) return;
        if (section === 'home' && this.consumeTemporaryBack(this.temporaryBackIdentity)) return;
        this.onSectionChange(section);
      },
      onBack: this.onBack,
      onOpenSourceManagement: this.onOpenSourceManagement,
      onOpenSync: this.onOpenSync,
      onRssRequested: this.onRssRequested,
      onDiscoverRequested: this.onDiscoverRequested,
      showOverlay: route === this.settingsSubroute() && this.selectionField !== '',
      boundedOverlayVisible: route === this.settingsSubroute() && this.pendingFeedbackVisible(),
      boundedOverlayContent: (): void => { this.pendingFeedback(); },
      onOverlayOriginChange: (x: number, y: number, width?: number): void => {
        if (route === this.settingsSubroute()) this.recordShellArea(x, y, width);
      },
      // ArkUI 限制: @Builder 方法引用作 @BuilderParam 时, 方法内部再建 @Builder
      // 闭包 (CategorySection content → this.navRow) 会丢 this 绑定, 运行时崩
      // "Cannot read property bind of undefined"。改内联闭包词法捕获 this (同
      // BookshelfPage 尾随闭包 pattern), 内层 this.buildHome() 才正确绑定。
      homeContent: (): void => { this.buildHome(); },
      generalContent: (): void => { this.buildGeneral(); },
      overlayContent: (): void => { this.buildOverlay(); },
    }).enabled(!this.resetInFlight);
    }
  }

  @Builder
  private backupPage() {
    ReaderStandardPage({ floatingHeader: true, embeddedWide: this.embeddedWide, variant: 'settingsGeneral',
      editingHost: this.backupEditingHost,
      header: (): void => {
        PageBackBar({ floating: true, centered: true, elevation: 'floating', showBack: !this.embeddedWide,
          title: '本地备份与恢复', onBack: (): void => { this.settingsRouteBack(); } });
      },
      content: (): void => {
        LocalRecoveryPanel({ navigationGeneration: this.navigationGeneration, editingHost: this.backupEditingHost,
          isOpeningCurrent: (): boolean => this.activeSection === 'backup' && this.isOpeningCurrent(),
          isInputAllowed: (): boolean => this.backupInputIsCurrent(),
          onBusyChange: (busy: boolean): void => {
            if (this.activeSection === 'backup') this.backupBusy = busy;
          } });
        this.systemMigrationCard();
      },
    });
  }

  @Builder
  private systemMigrationCard() {
    CategorySection({ title: '系统迁移' }) {
      ReaderFormRow({ label: '系统备份包含本地原书',
        secondaryText: this.systemMigrationState === 'interrupted' ? '迁移尚待完成，将在下次启动继续' :
          '由系统发起备份或换机。默认迁移书库资料，开启后加入保留的原书',
        actionEnabled: this.backupInputIsCurrent() && !this.systemMigrationSaving,
        onLabelAction: (): void => { void this.setSystemMigrationOriginals(!this.systemMigrationOriginals); } }) {
        ReaderToggle({ value: this.systemMigrationOriginals, accessibilityLabel: '系统备份包含本地原书',
          actionEnabled: this.backupInputIsCurrent() && !this.systemMigrationSaving,
          onToggle: (enabled: boolean): void => { void this.setSystemMigrationOriginals(enabled); } });
      }
    }
  }

  private async setSystemMigrationOriginals(enabled: boolean): Promise<void> {
    if (this.systemMigrationSaving || !this.backupInputIsCurrent()) return;
    const generation = this.navigationGeneration;
    this.systemMigrationSaving = true;
    try {
      const application = ReaderRuntimeOwner.current().getUIAbilityContext().getApplicationContext();
      await setReaderSystemMigrationIncludesOriginals(application, enabled);
    } catch (_) {
      this.showFeedbackToast('系统备份偏好保存失败，请重试', 'backup', generation);
    } finally {
      this.systemMigrationSaving = false;
    }
  }

  private backupInputIsCurrent(): boolean {
    return this.activeSection === 'backup' && this.settingsInputIsCurrent();
  }

  private aboutPageCurrent(identity: string): boolean {
    return identity.length > 0 && identity === this.aboutPageId && this.mounted && this.activeSection === 'about' &&
      this.isOpeningCurrent() && ReaderRuntimeOwner.isCurrent(this.themeOwner);
  }

  private prepareAboutSection(): void {
    if (this.activeSection !== 'about') return;
    this.developerTapCount = 0;
    this.developerLastTap = 0;
    this.retainedAboutId = `about:${++settingsSelectionGeneration}`;
    this.aboutPageId = this.retainedAboutId;
  }

  private closeAboutPage(identity: string): void {
    if (!this.aboutPageCurrent(identity) || !this.settingsInputIsCurrent()) return;
    this.onSectionChange('home');
  }

  private showAboutFeedback(message: string, identity: string): void {
    this.transientFeedback.show(() => this.getUIContext(), { message },
      (): boolean => this.aboutPageCurrent(identity) && this.settingsInputIsCurrent());
  }

  private copyAboutBuild(identity: string): void {
    if (!this.aboutPageCurrent(identity) || !this.settingsInputIsCurrent()) return;
    const value = readerAppBuildCopy(this.aboutInfo);
    if (!value) return;
    try { copyReaderBuildIdentity(value); this.showAboutFeedback('已复制完整构建信息', identity); }
    catch (_) { if (this.aboutPageCurrent(identity)) this.showAboutFeedback('复制失败，请重试', identity); }
  }

  @Builder
  private aboutPage(identity: string) {
    ReaderStandardPage({ floatingHeader: true, embeddedWide: this.embeddedWide, variant: 'settingsGeneral',
      header: (): void => { this.aboutPageHeader(identity); },
      content: (): void => { this.aboutPageContent(identity); },
      boundedOverlayVisible: this.pendingFeedbackVisible(),
      boundedOverlayContent: (): void => { this.pendingFeedback(); },
    });
  }

  @Builder
  private aboutPageHeader(identity: string) {
    PageBackBar({ floating: true, centered: true, elevation: 'floating', showBack: !this.embeddedWide,
      title: '关于 Reader', onBack: (): void => {
      this.closeAboutPage(identity);
    } });
  }

  @Builder
  private aboutPageContent(identity: string) {
    CategorySection({ title: '版本与构建' }) {
      ReaderFormRow({ label: '版本号', secondaryText: readerAppBuildDisplay(this.aboutInfo),
        actionEnabled: this.aboutPageCurrent(identity), onAction: (): void => this.tapAboutVersion(identity) });
      if (this.aboutInfo.status === 'available') {
        Column({ space: 12 }) {
          Text(`版本代码：${this.aboutInfo.versionCode}`).width('100%')
            .fontFamily(TYPE_APP_INHERITED_BODY.fontFamily).fontWeight(TYPE_APP_INHERITED_BODY.fontWeight)
            .fontSize(TYPE_APP_INHERITED_BODY.fontSizeFp).fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
          Text(this.aboutInfo.appBuildId).width('100%').wordBreak(WordBreak.BREAK_ALL)
            .fontFamily(TYPE_APP_INHERITED_BODY.fontFamily).fontWeight(TYPE_APP_INHERITED_BODY.fontWeight)
            .fontSize(TYPE_APP_INHERITED_BODY.fontSizeFp).fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
          Text(`内容摘要：${this.aboutInfo.appContentHash}`).width('100%').wordBreak(WordBreak.BREAK_ALL)
            .fontFamily(TYPE_APP_INHERITED_BODY.fontFamily).fontWeight(TYPE_APP_INHERITED_BODY.fontWeight)
            .fontSize(TYPE_APP_INHERITED_BODY.fontSizeFp).fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
        }.width('100%').padding(12);
      }
      ReaderFormRow({ label: '复制完整构建信息',
        actionEnabled: this.aboutInfo.status === 'available' && this.aboutPageCurrent(identity),
        onAction: (): void => this.copyAboutBuild(identity) });
    }
    CategorySection({ title: '开源许可' }) {
      this.subpageNavRow('查看开源许可与声明', (): void => this.openLicensesPage(identity));
    }
    if (this.developerToolsUnlocked || this.developerModeValue) {
      CategorySection({ title: '开发工具' }) {
        this.subpageNavRow('开发者模式', (): void => this.openDeveloperPage(identity));
      }
    }
  }

  private tapAboutVersion(identity: string): void {
    if (!this.aboutPageCurrent(identity) || !this.settingsInputIsCurrent() || this.aboutInfo.versionName === '' ||
      this.developerToolsUnlocked || this.developerModeValue || this.settingsSubroute() !== 'settings-about') return;
    const now = Date.now();
    this.developerTapCount = now - this.developerLastTap <= DEVELOPER_UNLOCK_MAX_GAP_MS ? this.developerTapCount + 1 : 1;
    this.developerLastTap = now;
    const remaining = DEVELOPER_UNLOCK_TAPS - this.developerTapCount;
    if (remaining === 0) {
      this.developerToolsUnlocked = true;
      this.showAboutFeedback('开发者模式入口已解锁', identity);
    } else if (remaining <= 2) {
      this.showAboutFeedback(`再点击 ${remaining} 次解锁开发者模式`, identity);
    }
  }

  private licensesPageCurrent(identity: string): boolean {
    return identity !== '' && identity === this.licensesPageId && this.aboutPageCurrent(this.aboutPageId) &&
      this.settingsInputIsCurrent();
  }

  private openLicensesPage(identity: string): void {
    if (!this.aboutPageCurrent(identity) || !this.settingsInputIsCurrent() || this.settingsSubroute() !== 'settings-about') return;
    this.retainedLicensesId = `licenses:${++settingsSelectionGeneration}`;
    this.licensesPageId = this.retainedLicensesId;
  }

  private closeLicensesPage(): void {
    this.licensesPageId = '';
    this.licensesBackHandler = undefined;
  }

  private settingsNavigationCurrent(): boolean {
    return this.mounted && this.activeSection === 'general' && !this.resetInFlight &&
      ReaderRuntimeOwner.isCurrent(this.themeOwner);
  }

  private settingsInputIsCurrent(identity: string = this.temporaryBackIdentity): boolean {
    return this.appForeground && this.mounted && identity === this.temporaryBackIdentity && this.isOpeningCurrent() &&
      (this.isInputAllowed?.() ?? true);
  }

  private generalConfirmationCurrent(identity: string): boolean {
    return identity === this.temporaryBackIdentity && this.settingsNavigationCurrent() && this.developerPageId === '';
  }

  private developerPageCurrent(identity: string): boolean {
    return identity.length > 0 && identity === this.developerPageId && this.aboutPageCurrent(this.aboutPageId);
  }

  private messagePreviewCurrent(identity: string): boolean {
    return identity.length > 0 && identity === this.messagePreviewId && this.developerPageCurrent(this.developerPageId);
  }

  private openDeveloperPage(identity: string): void {
    if (!this.aboutPageCurrent(identity) || !this.settingsInputIsCurrent() || this.settingsSubroute() !== 'settings-about' ||
      (!this.developerToolsUnlocked && !this.developerModeValue)) return;
    this.nativeAlertOwner.retire();
    this.retireSelection(true);
    this.appThemeControlGeneration += 1;
    this.retainedDeveloperId = `developer:${++settingsSelectionGeneration}`;
    this.developerPageId = this.retainedDeveloperId;
  }

  private openMessagePreview(identity: string): void {
    if (!this.developerPageCurrent(identity) || this.messagePreviewId !== '') return;
    this.messagePreviewBackHandler = undefined;
    this.retainedMessagePreviewId = `message-preview:${++settingsSelectionGeneration}`;
    this.messagePreviewId = this.retainedMessagePreviewId;
  }

  private closeMessagePreview(identity: string): void {
    if (identity.length === 0 || identity !== this.messagePreviewId) return;
    this.messagePreviewId = '';
    this.messagePreviewBackHandler = undefined;
  }

  private retireDeveloperPages(): void {
    this.closeMessagePreview(this.messagePreviewId);
    this.developerPageId = '';
  }

  private onActiveSectionChanged(): void {
    this.backupBusy = false;
    this.onAppearanceSaveHostChanged();
    this.appThemeControlGeneration += 1;
    this.resetSectionRevision += 1;
    this.resetMessage = '';
    if (this.aboutPageId.length > 0) this.transientFeedback.reset();
    this.aboutPageId = '';
    this.closeLicensesPage();
    this.nativeAlertOwner.retire();
    this.retireResetDialog();
    this.retireSelection(true);
    this.retireDeveloperPages();
    if (this.mounted) this.prepareAboutSection();
  }

  private toggleDeveloperBoundary(value: boolean, identity: string): void {
    if (!this.developerPageCurrent(identity) || this.messagePreviewId !== '') return;
    this.toggleSetting('developerMode', value);
  }

  private hideDeveloperTools(identity: string): void {
    if (!this.developerPageCurrent(identity) || this.messagePreviewId !== '' || !this.settingCanToggle(this.temporaryBackIdentity)) return;
    this.developerToolsUnlocked = false;
    this.developerTapCount = 0;
    this.developerLastTap = 0;
    if (this.developerModeValue) this.toggleSetting('developerMode', false);
    this.retireDeveloperPages();
  }

  @Builder
  private developerPage(identity: string) {
    ReaderStandardPage({ floatingHeader: true, embeddedWide: this.embeddedWide, variant: 'settingsGeneral',
      header: (): void => { this.developerPageHeader(identity); },
      content: (): void => { this.developerPageContent(identity); },
      boundedOverlayVisible: this.pendingFeedbackVisible(),
      boundedOverlayContent: (): void => { this.pendingFeedback(); },
    });
  }

  @Builder
  private developerPageHeader(identity: string) {
    PageBackBar({ floating: true, centered: true, elevation: 'floating', title: '开发者模式', onBack: (): void => {
      if (this.developerPageCurrent(identity)) this.retireDeveloperPages();
    } });
  }

  @Builder
  private developerPageContent(identity: string) {
    CategorySection({ title: '开发工具' }) {
      this.subpageNavRow('消息预览', (): void => this.openMessagePreview(identity));
      ReaderFormRow({
        label: '显示组件边界',
        actionEnabled: this.settingCanToggle(this.temporaryBackIdentity), isBusy: this.settingToggleBusy(),
        onLabelAction: (): void => this.toggleDeveloperBoundary(!this.developerModeValue, identity),
      }) {
        ReaderToggle({ value: this.developerModeValue, specId: 'standard-toggle',
          inputIdentity: `${identity}:component-bounds`, accessibilityLabel: '显示组件边界',
          actionEnabled: this.settingCanToggle(this.temporaryBackIdentity), isBusy: this.settingToggleBusy(),
          onToggle: (next: boolean): void => this.toggleDeveloperBoundary(next, identity) });
      }
      ReaderFormRow({ label: '关闭并隐藏开发者模式', actionEnabled: this.settingCanToggle(this.temporaryBackIdentity),
        onAction: (): void => this.hideDeveloperTools(identity) });
    }
    this.operationFeedback();
  }

  @Builder
  private buildHome() {
    this.operationFeedback();
    ForEach(settingsNavigationGroups(), (group: SettingsNavigationGroup): void => {
      this.homeNavigationGroup(group);
    }, (group: SettingsNavigationGroup): string => group.id);
  }

  @Builder
  private homeNavigationGroup(group: SettingsNavigationGroup) {
    CategorySection({ title: group.label }) {
      ForEach(group.items, (item: SettingsNavigationItem): void => {
        this.navRow(item.label, (): Resource => $r(`app.media.${item.icon}${this.appThemeScheme === 'night' ? '_theme_night' : ''}`),
          (): void => this.openHomeDestination(item.id), item.actionId ?? '', this.homeDestinationSummary(item.id));
      }, (item: SettingsNavigationItem): string => item.id);
    }
  }

  private homeDestinationSummary(pane: SettingsPane): string {
    switch (pane) {
      case 'general': return `${THEME_SUMMARIES[this.themeIndex()]} · ${readerRenderModeLabel(this.navigationPreferences.renderMode)}`;
      case 'bookshelfSettings': return `${this.bookshelfViewMode === 'cover' ? '封面' : '列表'} · 自动检查更新${this.snapshot.autoCheckUpdate ? '已开启' : '已关闭'}`;
      case 'about': return this.aboutInfo.versionName;
      default: return '';
    }
  }

  private openHomeDestination(pane: SettingsPane): void {
    // Read before the destination retires this opening and detaches its Scroll.
    try { this.onHomeScrollDeparture(this.homeScroller.currentOffset().yOffset); }
    catch (_detached) {}
    switch (pane) {
      case 'general':
      case 'backup':
      case 'about': this.onSectionChange(pane); break;
      case 'source': this.onOpenSourceManagement(); break;
      case 'rulesManagement': this.onOpenRulesManagement(); break;
      case 'sync': this.onOpenSync(); break;
      case 'bookshelfSettings': this.onOpenBookshelfSettings(); break;
      case 'downloads': this.onOpenDownloads(); break;
    }
  }

  @Builder
  private buildGeneral() {
    this.preferenceCard();
    this.behaviorCard();
    this.maintenanceCard();
    this.dangerRow();
    this.operationFeedback();
  }

  private recovery(): ReaderRecoveryView { return readerRecoveryView(this.operation.receipt, this.operation.readFacts); }

  private feedbackMessage(): string {
    const messages: string[] = [];
    if (this.recovery().visible) messages.push(this.recovery().message);
    else if (this.resetMessage.length > 0) messages.push(this.resetMessage);
    const cleanup = this.cacheCleanup;
    const cleanupReport = cleanup?.operation.value;
    if (cleanup !== undefined && (cleanup.operation.canRetry || cleanup.confirmation === 'unknown' ||
      (cleanupReport?.scope === 'text' && cleanupReport.cleanupError !== undefined)))
      messages.push(cleanup.operation.message ?? '原清理结果尚未确认，请核对；已有正文仍可使用');
    return messages.join('\n');
  }
  private recoveryActionIdentities(): string[] {
    const identities: string[] = [];
    if (this.recovery().canRetry) identities.push(`${this.temporaryBackIdentity}\u0000read\u0000${this.recovery().generation}`);
    if (this.operation.canRetryAccepted === true && this.operation.receipt !== undefined)
      identities.push(`${this.temporaryBackIdentity}\u0000accepted\u0000${this.operation.receipt.facts.generation}`);
    if (this.cacheCleanup !== undefined && !this.cacheCleanup.busy && this.cacheCleanup.operation.canRetry)
      identities.push(`${this.temporaryBackIdentity}\u0000cache-read\u0000${this.cacheCleanup.operation.generation}`);
    if (this.cacheCleanup?.canContinueOriginal === true && !this.cacheCleanup.busy)
      identities.push(`${this.temporaryBackIdentity}\u0000cache-continue\u0000${this.cacheCleanup.operation.generation}`);
    return identities;
  }
  private recoveryActionGeneration(identity: string): number { return Number(identity.slice(identity.lastIndexOf('\u0000') + 1)); }
  private recoveryActionKind(identity: string): string { return identity.split('\u0000')[1]; }
  private recoveryActionLabel(identity: string): string {
    const kind = this.recoveryActionKind(identity);
    return kind === 'read' ? '刷新设置' : kind === 'accepted' ? '重试保存当前设置' :
      kind === 'cache-read' ? '核对清理结果' : '继续原操作';
  }
  private recoveryActionCurrent(identity: string): boolean {
    return this.mounted && ReaderRuntimeOwner.isCurrent(this.themeOwner) && this.recoveryActionIdentities().includes(identity);
  }
  private dispatchRecoveryAction(identity: string): void {
    if (!this.settingsInputIsCurrent() || this.openSelect !== '' || this.resetInFlight || !this.recoveryActionCurrent(identity)) return;
    const generation = this.recoveryActionGeneration(identity), kind = this.recoveryActionKind(identity);
    if (kind === 'read') this.onReconcile(generation);
    else if (kind === 'accepted') this.onRetryAccepted(generation);
    else if (kind === 'cache-read') this.onReconcileCache(generation);
    else if (kind === 'cache-continue') this.onContinueCache(generation);
  }

  @Builder
  private operationFeedback() {
    if (this.resetInFlight || this.cacheCleanup?.busy === true) {
      Row({ space: 10 }) {
        LoadingProgress().width(32).height(32).color(readerAppColor('TOK_MESSAGE_SOFT_INK', this.appThemeScheme))
          .enableLoading(this.appForeground && !this.appReduceMotion);
        Text(this.resetInFlight ? '正在恢复界面与阅读设置' : this.cacheCleanup?.operation.message ?? '正在清理文字缓存')
          .layoutWeight(1).fontFamily(MESSAGE_BODY.fontFamily).fontWeight(MESSAGE_BODY.fontWeight).fontSize(MESSAGE_BODY.fontSizeFp)
          .lineHeight(MESSAGE_BODY.lineHeightFp as number).fontColor(readerAppColor('TOK_MESSAGE_MUTED', this.appThemeScheme));
      }.width('100%').padding(17);
    }
    if (!this.hasPendingSettings() && this.recovery().canRetry) {
      ForEach(this.recoveryActionIdentities().filter((identity: string): boolean => this.recoveryActionKind(identity) === 'read'), (identity: string): void => {
        ReaderRecoveryAction({ label: '刷新设置', generation: this.recoveryActionGeneration(identity),
          actionEnabled: this.recoveryActionCurrent(identity), onReconcile: (): void => this.dispatchRecoveryAction(identity) });
      }, (identity: string): string => identity);
    }
  }

  private hasPendingSettings(): boolean {
    return this.operation.receipt?.receipt.confirmation === 'unknown' || this.operation.canRetryAccepted === true;
  }

  private hasPendingCleanup(): boolean {
    return this.cacheCleanup?.confirmation === 'unknown' || this.cacheCleanup?.canContinueOriginal === true ||
      this.cacheCleanup?.confirmation === 'confirmed' && this.cacheCleanup.operation.canRetry;
  }

  private recoveryIdentityFor(kind: string): string {
    return this.recoveryActionIdentities().find((identity: string): boolean => this.recoveryActionKind(identity) === kind) ?? '';
  }
  private capturedPendingAction(identity: string, index: number): string {
    return (JSON.parse(identity) as string[])[index];
  }

  private onAppearanceSaveHostChanged(): void {
    const owner = this.themeOwner;
    if (this.mounted && owner !== undefined && ReaderRuntimeOwner.isCurrent(owner))
      this.updateAppearanceSaveRecovery(owner, owner.getAppearanceStore().saveState());
  }

  private updateAppearanceSaveRecovery(owner: ReaderRuntimeOwner, state: ReaderAppearanceSaveState): void {
    if (!this.mounted || owner !== this.themeOwner || !ReaderRuntimeOwner.isCurrent(owner)) return;
    const identity = JSON.stringify([this.temporaryBackIdentity, this.navigationGeneration, this.activeSection, state.revision]);
    const generation = identity === this.appearanceSaveRecoveryIdentity ? this.appearanceSaveRecovery.generation :
      this.appearanceSaveRecovery.generation + 1;
    this.appearanceSaveRecoveryIdentity = identity;
    this.appearanceSaveRevision = state.revision;
    this.appearanceSaveRecoveryBusy = state.retrying;
    this.appearanceSaveRecovery = { visible: state.unconfirmed,
      message: state.unconfirmed ? '外观设置保存尚未确认，当前选择已保留。' : '',
      canRetry: state.canRetry, generation };
  }

  private hasPendingAppearanceSave(): boolean { return this.appearanceSaveRecovery.visible; }

  private retryAppearanceSave(identity: string, generation: number): void {
    if (!this.settingsInputIsCurrent() || this.openSelect !== '' || this.resetInFlight ||
      identity !== this.appearanceSaveRecoveryIdentity || generation !== this.appearanceSaveRecovery.generation ||
      identity !== JSON.stringify([this.temporaryBackIdentity, this.navigationGeneration, this.activeSection, this.appearanceSaveRevision])) return;
    const owner = this.themeOwner;
    if (owner === undefined || !ReaderRuntimeOwner.isCurrent(owner)) return;
    const store = owner.getAppearanceStore();
    const state = store.saveState();
    if (!state.canRetry || state.revision !== this.appearanceSaveRevision) return;
    void store.retrySave(state.revision).catch((_error: Error): void => { /* The original Store retains and republishes recovery. */ });
  }

  private pendingFeedbackVisible(): boolean {
    return this.settingsInputIsCurrent() && !this.resetInFlight && this.openSelect === '' &&
      (this.hasPendingSettings() || this.hasPendingCleanup() || this.hasPendingAppearanceSave() ||
        this.hasPendingControlPlacement() || this.hasPendingNavigationAppearance());
  }

  private hasPendingNavigationAppearance(): boolean {
    return this.activeSection === 'general' && this.navigationSavePending;
  }

  private navigationPreferenceActionCurrent(generation: number): boolean {
    return generation === this.navigationGeneration && this.settingsInputIsCurrent() &&
      this.settingsNavigationCurrent() && this.openSelect === '' && this.resetDialogTicket === 0 && !this.navigationSaving;
  }

  private async applyNavigationPreference(generation: number, change?: ReaderNavigationPreferenceChange): Promise<void> {
    if (!this.navigationPreferenceActionCurrent(generation) || this.navigationSavePending !== (change === undefined)) return;
    this.navigationSaving = true;
    try {
      if (change === undefined) await ReaderNavigationAppearancePreferences.retry();
      else await ReaderNavigationAppearancePreferences.save(change);
    } catch (_) { /* The preference owner retains the original write for retry. */ }
    finally { this.navigationSaving = false; }
  }

  @Builder
  private pendingFeedback() {
    ReaderRecoveryGroup({ content: (): void => { this.pendingFeedbackItems(); } });
  }

  @Builder
  private pendingFeedbackItems() {
      if (this.hasPendingSettings()) {
        ForEach([JSON.stringify([this.recoveryIdentityFor('read'), this.recoveryIdentityFor('accepted'),
          this.temporaryBackIdentity, `${this.operation.receipt?.facts.generation ?? 0}`])], (identity: string) => {
          ReaderRecoveryNotice({ grouped: true, view: { visible: true, message: this.recovery().message || '当前设置尚未确认，请核对原保存结果。',
            canRetry: true, generation: this.operation.receipt?.facts.generation ?? 0 },
            actionLabel: '核对', busy: this.operation.receipt?.facts.fact === 'refreshing',
            secondaryActionLabel: this.recoveryIdentityFor('accepted').length > 0 ? '继续保存' : '',
            onReconcile: (): void => this.dispatchRecoveryAction(this.capturedPendingAction(identity, 0)),
            onSecondaryAction: (): void => this.dispatchRecoveryAction(this.capturedPendingAction(identity, 1)) });
        }, (key: string): string => key);
      }
      if (this.hasPendingAppearanceSave()) {
        ForEach([JSON.stringify([this.appearanceSaveRecoveryIdentity, `${this.appearanceSaveRecovery.generation}`])], (identity: string): void => {
          ReaderRecoveryNotice({ grouped: true, follows: this.hasPendingSettings(), view: this.appearanceSaveRecovery,
            tag: '外观设置', actionLabel: '重试保存', actionEnabled: this.appearanceSaveRecovery.canRetry,
            retainPrimaryAction: true, busy: this.appearanceSaveRecoveryBusy,
            onReconcile: (): void => this.retryAppearanceSave(this.capturedPendingAction(identity, 0),
              Number(this.capturedPendingAction(identity, 1))) });
        }, (identity: string): string => `appearance:${identity}`);
      }
      if (this.hasPendingNavigationAppearance()) {
        ForEach([this.navigationGeneration], (generation: number): void => {
          ReaderRecoveryNotice({ grouped: true, follows: this.hasPendingSettings() || this.hasPendingAppearanceSave(),
            view: { visible: true, message: '界面外观与渲染模式的保存结果待确认。', canRetry: true, generation },
            tag: '界面与渲染', actionLabel: '重试保存', busy: this.navigationSaving,
            actionEnabled: this.navigationPreferenceActionCurrent(generation), retainPrimaryAction: true,
            onReconcile: (): void => { void this.applyNavigationPreference(generation); },
          });
        }, (generation: number): string => `navigation-appearance:${generation}`);
      }
      if (this.hasPendingCleanup()) {
        ForEach([JSON.stringify([this.recoveryIdentityFor('cache-read'), this.recoveryIdentityFor('cache-continue'),
          this.temporaryBackIdentity, `${this.cacheCleanup?.operation.generation ?? 0}`])], (identity: string) => {
          ReaderRecoveryNotice({ grouped: true,
            follows: this.hasPendingSettings() || this.hasPendingAppearanceSave() || this.hasPendingNavigationAppearance(), view: { visible: true,
            message: this.cacheCleanup?.operation.message ?? '原清理结果尚未确认，请核对；已有正文仍可使用',
            canRetry: true, generation: this.cacheCleanup?.operation.generation ?? 0 },
            actionLabel: '核对', busy: this.cacheCleanup?.busy === true,
            secondaryActionLabel: this.recoveryIdentityFor('cache-continue').length > 0 ? '继续' : '',
            onReconcile: (): void => this.dispatchRecoveryAction(this.capturedPendingAction(identity, 0)),
            onSecondaryAction: (): void => this.dispatchRecoveryAction(this.capturedPendingAction(identity, 1)) });
        }, (key: string): string => key);
      }
      this.controlPlacementRecovery();
  }


  private operationFeedbackIdentity(): string {
    return `${this.operation.receipt?.facts.generation ?? 0}:${this.operation.readFacts?.generation ?? 0}`;
  }

  private onOperationChanged(): void {
    const identity = this.operationFeedbackIdentity();
    if (!this.mounted || identity === this.lastOperationFeedback) return;
    this.lastOperationFeedback = identity;
    if (this.operation.action === 'reset' && (this.activeSection !== 'general' || !this.isOpeningCurrent())) return;
    if (this.operation.receipt?.facts.fact === 'refreshing' || this.operation.readFacts?.fact === 'refreshing') {
      this.lastOperationToast = '';
      return;
    }
    const writeNotDispatched = this.operation.action !== 'reset' &&
      this.operation.receipt?.receipt.fact === 'notDispatched';
    if (!this.hasPendingSettings() && this.recovery().visible && (writeNotDispatched ||
      this.operation.readFacts?.fact === 'refreshFailed' || this.operation.receipt?.receipt.fact === 'confirmedRefreshFailed')) {
      const message = writeNotDispatched ? '当前设置未保存，请重试' : this.recovery().message;
      if (message !== this.lastOperationToast) { this.lastOperationToast = message; this.showFeedbackToast(message); }
    }
  }

  private cacheFeedbackIdentity(): string {
    return `${this.cacheCleanup?.operation.generation ?? 0}:${this.cacheCleanup?.operation.fact ?? ''}:` +
      `${this.cacheCleanup?.busy === true ? 1 : 0}:${this.cacheCleanup?.operation.message ?? ''}`;
  }

  private showFeedbackToast(message: string, section: SettingsSection = 'general',
    generation: number = this.navigationGeneration): void {
    const identity = this.temporaryBackIdentity;
    const current = (): boolean => this.activeSection === section && this.navigationGeneration === generation &&
      this.settingsInputIsCurrent(identity);
    if (message.length === 0 || !current()) return;
    try { this.transientFeedback.show(() => this.getUIContext(), { message, duration: READER_FEEDBACK_EXTENDED_MS }, current); } catch (_) {}
  }

  @Builder
  private preferenceCard() {
    CategorySection({ title: '外观与显示' }) {
      this.segmentRow('App 主题');
      NavigationAppearanceSettings({ generation: this.navigationGeneration,
        actionEnabled: this.navigationPreferenceActionCurrent(this.navigationGeneration) && !this.navigationSavePending,
        onChange: (change: ReaderNavigationPreferenceChange, generation: number): void => {
          void this.applyNavigationPreference(generation, change);
        } });
      this.switchRow('减少动态效果', 'reduceMotion', this.systemReduceMotion ? '已由系统辅助功能开启' : '');
    }
  }

  @Builder
  private behaviorCard() {
    CategorySection({ title: '交互与布局' }) {
      this.switchRow('点击当前底栏回顶部', 'tapBottomScrollTop');
      if (this.isWideSettings() && isReaderProductSurfaceEnabled('wideNavigationRail')) {
        this.switchRow('宽屏使用侧边导航', 'wideNavigationRail');
      }
      if (this.isWideSettings()) this.controlPlacementRow();
      if (readerHarmonyCapabilities().api26) {
        ReaderSmartGestureSettingsRows({ generation: this.navigationGeneration,
          inputCurrent: (): boolean => this.activeSection === 'general' && this.settingsInputIsCurrent(),
          onFailure: (): void => this.showFeedbackToast('智慧手势偏好保存失败，请重试') });
      }
      if (isReaderProductSurfaceEnabled('unimplementedSettings')) {
        this.selectRow('语言', 'language', ['简体中文', '繁體中文', 'English', '日本語', '한국어']);
        this.selectRow('启动时打开', 'startup', ['书架', '发现', 'RSS', '设置']);
        this.switchRow('崩溃日志', 'crashLog');
      }
    }
  }

  @Builder
  private controlPlacementRow() {
    ReaderFormRow({ label: '宽屏控制栏默认位置', contentMinWidth: READER_APP_THEME_SEGMENT_WIDTH,
      secondaryText: '未检测到单手握姿时使用此默认位置' }) {
      ForEach([this.controlPlacementHostIdentity()], (identity: string): void => {
        ReaderSegmentedControl({
          specId: 'app-theme-segment', options: ['左', '居中', '右'], optionIds: ['left', 'center', 'right'],
          inputIdentity: identity, accessibilityLabel: '宽屏控制栏默认位置',
          actionEnabled: this.controlPlacementCurrent(identity) && this.controlPlacementPending === 0 && !this.controlPlacementSaving,
          selectedIndex: this.controlAlignment === 'left' ? 0 : this.controlAlignment === 'right' ? 2 : 1,
          onSelect: (index: number): void => this.selectControlPlacement(index, identity),
        });
      }, (identity: string): string => identity);
    }
  }

  private selectControlPlacement(index: number, identity: string): void {
    const current = (): boolean => this.controlPlacementCurrent(identity);
    if (!current() || this.controlPlacementSaving || this.controlPlacementPending !== 0 ||
      !Number.isInteger(index) || index < 0 || index > 2) return;
    this.controlPlacementSaving = true;
    void ReaderControlPlacementPreferences.select(readerControlAlignment(['left', 'center', 'right'][index]), current)
      .then((result): void => {
        if (result === 'notDispatched' && current()) this.showFeedbackToast('控制栏位置未保存，请重试');
      }).finally((): void => { this.controlPlacementSaving = false; });
  }

  @Builder
  private controlPlacementRecovery() {
    if (this.hasPendingControlPlacement()) {
      ForEach([JSON.stringify([this.controlPlacementHostIdentity(), `${this.controlPlacementPending}`])], (ticket: string): void => {
        ReaderRecoveryNotice({ grouped: true,
          follows: this.hasPendingSettings() || this.hasPendingAppearanceSave() || this.hasPendingNavigationAppearance() ||
            this.hasPendingCleanup(),
          view: { visible: true, message: '控制栏位置的保存结果待确认。', canRetry: true,
            generation: Number(this.capturedPendingAction(ticket, 1)) },
          tag: '控制栏位置', actionLabel: '重试保存', busy: this.controlPlacementSaving,
          onReconcile: (generation: number): void => this.retryControlPlacement(ticket, generation),
        });
      }, (ticket: string): string => `control-placement:${ticket}`);
    }
  }

  private hasPendingControlPlacement(): boolean {
    return this.controlPlacementPending > 0 && this.controlPlacementCurrent(this.controlPlacementHostIdentity());
  }

  private retryControlPlacement(ticket: string, generation: number): void {
    const identity = this.capturedPendingAction(ticket, 0);
    const current = (): boolean => this.controlPlacementCurrent(identity) && this.controlPlacementPending === generation;
    if (this.controlPlacementSaving || generation <= 0 || generation !== Number(this.capturedPendingAction(ticket, 1)) || !current()) return;
    this.controlPlacementSaving = true;
    void ReaderControlPlacementPreferences.retry(generation, current)
      .finally((): void => { this.controlPlacementSaving = false; });
  }

  private controlPlacementHostIdentity(): string {
    return JSON.stringify([this.temporaryBackIdentity, this.navigationGeneration]);
  }

  private controlPlacementCurrent(identity: string): boolean {
    return identity === this.controlPlacementHostIdentity() && this.settingsInputIsCurrent() && this.settingsNavigationCurrent() &&
      this.developerPageId === '' && this.openSelect === '';
  }

  private paneExpanded(): boolean {
    return readerWidthClassWithHint(this.paneWidth, this.expandedLayout) === 'expanded';
  }

  private isWideSettings(): boolean { return this.embeddedWide || this.wideWindow || this.paneExpanded(); }

  private recordShellArea(x: number, y: number, width?: number): void {
    this.originX = x;
    this.originY = y;
    if (width !== undefined && Number.isFinite(width) && width > 0) this.paneWidth = width;
  }

  @Builder
  private maintenanceCard() {
    CategorySection({ title: '存储维护' }) {
      this.cacheActionRow();
      this.subpageNavRow('管理下载与自动清理策略', this.onOpenDownloads);
    }
  }

  @Builder
  private navRow(label: string, icon: () => Resource, action: () => void, actionId: string = '', summary: string = '') {
    ReaderFormRow({ icon: icon(), label, secondaryText: summary, disclosure: true, actionId,
      onAction: (): void => { if (this.settingsInputIsCurrent()) action(); } });
  }

  @Builder
  private subpageNavRow(label: string, action: () => void) {
    ReaderFormRow({ label, disclosure: true, onAction: (): void => { if (this.settingsInputIsCurrent()) action(); } });
  }

  @Builder
  private switchRow(label: string, key: GeneralSettingsKey, secondaryText: string = '') {
    ForEach([this.temporaryBackIdentity], (identity: string): void => {
      ReaderFormRow({ label, secondaryText, actionEnabled: this.settingCanToggle(identity, key), isBusy: this.settingToggleBusy(),
        onLabelAction: (): void => this.toggleSetting(key, !this.settingValue(key), identity) }) {
        ReaderToggle({ value: this.settingValue(key), specId: 'standard-toggle',
          inputIdentity: `${identity}:${key}`, accessibilityLabel: label,
          actionEnabled: this.settingCanToggle(identity, key), isBusy: this.settingToggleBusy(),
          onToggle: (next: boolean): void => this.toggleSetting(key, next, identity) });
      }
    }, (identity: string): string => identity);
  }


  private onSnapshotChanged(): void {
    this.syncSnapshotValues();
  }

  private syncSnapshotValues(): void {
    this.tapBottomScrollTopValue = this.snapshot.tapBottomScrollTop;
    this.crashLogValue = this.snapshot.crashLog;
    this.developerModeValue = this.snapshot.developerMode;
    this.wideNavigationRailValue = this.snapshot.wideNavigationRail;
  }

  private settingToggleBusy(): boolean {
    return this.operation.receipt?.facts.fact === 'refreshing';
  }

  private settingCanToggle(identity: string, key?: GeneralSettingsKey): boolean {
    return this.settingsInputIsCurrent(identity) && ReaderRuntimeOwner.isCurrent(this.themeOwner) &&
      (key !== 'reduceMotion' || !this.systemReduceMotion) &&
      !this.resetInFlight && !this.settingToggleBusy() && this.operation.receipt?.receipt.confirmation !== 'unknown';
  }

  private toggleSetting(
    key: GeneralSettingsKey,
    value: boolean,
    identity: string = this.temporaryBackIdentity,
  ): void {
    if (!this.settingCanToggle(identity, key)) return;
    if (key === 'wideNavigationRail' && !isReaderProductSurfaceEnabled('wideNavigationRail')) return;
    // The Settings owner publishes the accepted snapshot before/after its
    // actual IO. The page never paints an unaccepted optimistic mirror.
    this.lastOperationToast = '';
    this.onToggle(key, value);
  }

  private settingValue(key: GeneralSettingsKey): boolean {
    if (key === 'tapBottomScrollTop') {
      return this.tapBottomScrollTopValue;
    }
    if (key === 'reduceMotion') {
      return this.appReduceMotion;
    }
    if (key === 'developerMode') {
      return this.developerModeValue;
    }
    if (key === 'wideNavigationRail') {
      return this.wideNavigationRailValue;
    }
    return this.crashLogValue;
  }

  // The menu stays in SettingsShell's full-height overlay. Only the trigger
  // participates in the row layout.
  @Builder
  private selectRow(label: string, key: SettingsSelectField, options: string[]) {
    ReaderFormRow({ label }) {
      ReaderSelect({
        value: this.currentValue(key),
        options: options,
        isOpen: this.openSelect === key,
        variant: this.paneExpanded() ? 'settingsTablet' : 'settingsPhone',
        reduceMotion: this.appReduceMotion,
        onToggle: (): void => {
          this.toggleSelection(key);
          const a = this.selectAnchors[key];
          if (a !== undefined) {
            this.anchorRight = a.right;
            this.anchorBottom = a.bottom;
          }
        },
      })
        .onAreaChange((_oldValue: Area, newValue: Area): void => {
          // Area.globalPosition 已是 vp 单位, 直接取用 (曾 px2vp 二次÷3.5 致面板错位)。
          this.selectAnchors[key] = {
            right: readerPageAreaLength(newValue.globalPosition.x) + readerPageAreaLength(newValue.width),
            bottom: readerPageAreaLength(newValue.globalPosition.y) + readerPageAreaLength(newValue.height),
          };
        });
    }
  }

  @Builder
  private segmentRow(label: string) {
    ReaderFormRow({ label, contentMinWidth: READER_APP_THEME_SEGMENT_WIDTH }) {
      this.appThemeControl();
    }
  }

  @Builder
  private appThemeControl() {
    ForEach([this.appThemeControlIdentity()], (capturedIdentity: string): void => {
      ReaderSegmentedControl({
        specId: 'app-theme-segment', options: SEG_OPTIONS, optionIds: ['system', 'day', 'night'],
        inputIdentity: capturedIdentity, accessibilityLabel: 'App 主题',
        actionEnabled: this.settingsInputIsCurrent() && this.appThemeControlIsCurrent(capturedIdentity),
        selectedIndex: this.themeIndex(),
        onSelect: (index: number): void => this.selectAppTheme(index, capturedIdentity),
      });
    }, (capturedIdentity: string): string => capturedIdentity);
  }

  private appThemeControlIdentity(): string {
    return `${this.temporaryBackIdentity}:theme:${this.appThemeControlGeneration}`;
  }

  private appThemeControlIsCurrent(identity: string): boolean {
    return identity === this.appThemeControlIdentity() && this.settingsNavigationCurrent() &&
      this.developerPageId === '' && this.isOpeningCurrent();
  }

  private selectAppTheme(index: number, identity: string): void {
    const current = (): boolean => this.appThemeControlIsCurrent(identity);
    if (!this.settingsInputIsCurrent() || !current() || (index !== 0 && index !== 1 && index !== 2)) return;
    void this.onSelectAppTheme(index === 0 ? 'system' : index === 1 ? 'day' : 'night')
      .catch((error: Error): void => {
        if (!current() || error instanceof ReaderAppearanceSaveUnconfirmedError) return;
        try { this.transientFeedback.show(() => this.getUIContext(), {
          message: '主题暂时无法修改，请重试',
        }, (): boolean => current()); } catch (_notice) { /* Feedback cannot rewrite the accepted choice. */ }
      });
  }

  @Builder
  private cacheActionRow() {
    ForEach([this.temporaryBackIdentity], (capturedIdentity: string): void => {
      ReaderFormRow({
        label: '清理阅读缓存', secondaryText: this.cacheActionSummary(),
        actionEnabled: this.canClearTextCache(capturedIdentity), isBusy: this.cacheCleanup?.busy === true,
        onLabelAction: (): void => this.requestClearTextCache(capturedIdentity),
      }) {
        ReaderButton({ scheme: this.appThemeScheme, variant: 'tonal', visualSize: 'small', label: this.cacheActionLabel(),
          actionAccessibilityLabel: this.cacheActionLabel() === '清理' ? '清理文字缓存' : this.cacheActionLabel(),
          actionEnabled: this.canClearTextCache(capturedIdentity), isBusy: this.cacheCleanup?.busy === true,
          onAction: (): void => this.requestClearTextCache(capturedIdentity) });
      }
    }, (capturedIdentity: string): string => capturedIdentity);
  }

  private requestClearTextCache(identity: string): void {
    const current = (): boolean => this.canClearTextCache(identity);
    if (!current()) return;
    this.nativeAlertOwner.present((native: ReaderNativeAlertOptions): void => this.getUIContext().showAlertDialog(native), 'confirmation', {
      title: '清理文字缓存',
      message: '清理可重新获取的文字正文与正文图片。保留下载任务、受保护内容、书籍、阅读进度和书签。',
      primaryButton: { value: '取消', action: (): void => {} },
      secondaryButton: { value: this.cacheActionLabel(), fontColor: readerAppColor('TOK_MESSAGE_DANGER', this.appThemeScheme),
        action: (): void => this.clearTextCache(identity) },
    }, current);
  }

  private canClearTextCache(identity: string): boolean {
    return this.settingsInputIsCurrent(identity) && this.generalConfirmationCurrent(identity) && this.isOpeningCurrent() &&
      this.cacheCleanup?.busy !== true && !this.hasPendingCleanup();
  }

  private clearTextCache(identity: string): void {
    if (!this.canClearTextCache(identity)) return;
    void this.onClearCache().catch((): void => {
      if (this.generalConfirmationCurrent(identity) && this.isOpeningCurrent())
        this.showFeedbackToast('清理状态暂不可用，请稍后重试');
    });
  }

  private onCacheCleanupChanged(): void {
    const identity = this.cacheFeedbackIdentity();
    if (!this.mounted || !this.isOpeningCurrent() || identity === this.lastCacheFeedback) return;
    this.lastCacheFeedback = identity;
    if (this.cacheCleanup !== undefined && !this.cacheCleanup.busy && !this.hasPendingCleanup())
      this.showFeedbackToast(this.cacheCleanup.operation.message ?? '');
  }

  private cacheActionLabel(): string {
    const report = this.cacheCleanup?.operation.value;
    return this.cacheCleanup?.confirmation === 'undispatched' ||
      (report?.scope === 'text' && report.cleanupError !== undefined) ? '重试' : '清理';
  }

  private cacheActionSummary(): string {
    const description = '清理可重新获取的文字正文与正文图片';
    const result = this.cacheCleanup?.busy === true ? '' : this.cacheCleanup?.operation.message ?? '';
    return result === '' ? description : `${description}。\n${result}`;
  }

  private themeIndex(): number {
    return this.appThemeMode === 'day' ? 1 : this.appThemeMode === 'night' ? 2 : 0;
  }

  private currentValue(key: SettingsSelectField): string {
    if (key === 'language') {
      return this.languageValue;
    }
    return this.startupValue;
  }

  private setSelectValue(key: SettingsSelectField, value: string): void {
    if (key === 'language') {
      this.languageValue = value;
    } else {
      this.startupValue = value;
    }
  }

  private selectOptions(key: SettingsSelectField): string[] {
    if (key === 'language') {
      return ['简体中文', '繁體中文', 'English', '日本語', '한국어'];
    }
    return ['书架', '发现', 'RSS', '设置'];
  }

  // 展开面板: SettingsShell 根 Stack 即全高 overlay 宿主, 面板相对位置 = 触发条全局坐标
  // - 宿主原点。面板落在宿主 bounds 内 → 所有选项可点。
  private toggleSelection(field: SettingsSelectField): void {
    if (this.openSelect === field) { this.retireSelection(); return; }
    this.openSelect = field;
    this.selectionField = field;
    this.selectionId = `${field}:${++settingsSelectionGeneration}`;
  }

  private retireSelection(immediate: boolean = false): void {
    this.openSelect = '';
    if (immediate) this.finishSelectionClose(this.selectionId);
  }

  private finishSelectionClose(identity: string): void {
    if (this.openSelect !== '' || identity !== this.selectionId) return;
    this.selectionField = '';
    this.selectionId = '';
  }

  private ownsSelection(identity: string | undefined): boolean {
    return this.mounted && identity !== undefined && identity.length > 0 && identity === this.selectionId &&
      this.selectionField !== '' && this.selectionField === this.openSelect;
  }

  private commitSelection(option: string, identity: string | undefined): void {
    if (!this.ownsSelection(identity) || this.openSelect === '' || !this.selectOptions(this.openSelect).includes(option)) return;
    this.setSelectValue(this.openSelect, option); this.retireSelection();
  }

  private dismissSelection(identity: string | undefined): void {
    if (this.ownsSelection(identity)) this.retireSelection();
  }

  @Builder
  private buildOverlay() {
    if (this.selectionField !== '') {
      SettingsSelectOverlay({
        visible: this.openSelect !== '',
        expandedLayout: this.paneExpanded(),
        field: this.selectionField,
        value: this.currentValue(this.selectionField),
        options: this.selectOptions(this.selectionField),
        anchorRight: this.anchorRight - this.originX,
        anchorBottom: this.anchorBottom - this.originY,
        selectionId: this.selectionId,
        onSelect: (opt: string, identity?: string): void => this.commitSelection(opt, identity),
        onDismiss: (identity?: string): void => this.dismissSelection(identity),
        onClosed: (identity: string): void => this.finishSelectionClose(identity),
      });
    }
  }

  private requestRestoreDefaults(): void {
    const identity = this.temporaryBackIdentity;
    if (!this.settingsInputIsCurrent(identity) || !this.generalConfirmationCurrent(identity) ||
      this.resetDialogTicket > 0 || this.openSelect.length > 0) return;
    this.resetDialogTicket = ++this.resetDialogSerial;
    this.resetDialogWanted = true;
    this.resetCoverVisible = true;
  }

  private resetCoverOptions(ticket: number, identity: string): ContentCoverOptions {
    return {
      modalTransition: ModalTransition.NONE, backgroundColor: Color.Transparent,
      onAppear: (): void => {
        if (!this.mounted || identity !== this.temporaryBackIdentity || ticket !== this.resetDialogTicket) return;
        if (this.resetDialogWanted) this.resetFrameVisible = true;
        else this.resetCoverVisible = false;
      },
      onWillDismiss: (_action: DismissContentCoverAction): void => this.closeResetDialog(ticket),
      onDisappear: (): void => {
        if (ticket <= 0 || ticket !== this.resetDialogTicket) return;
        this.retireResetDialog();
        this.restoreResetFocus(identity);
      },
    };
  }

  private resetTriggerId(identity: string): string { return `${identity}:restore-defaults`; }

  private restoreResetFocus(identity: string): void {
    try {
      const context = this.getUIContext();
      context.postFrameCallback(new ReaderPostLayoutFrame(context, (): void => {
        if (!this.settingsInputIsCurrent(identity) || this.activeSection !== 'general' ||
          this.resetDialogTicket > 0 || this.resetInFlight) return;
        try { context.getFocusController().requestFocus(this.resetTriggerId(identity)); } catch (_) {}
      }));
    } catch (_) {}
  }

  private closeResetDialog(ticket: number): void {
    if (ticket <= 0 || ticket !== this.resetDialogTicket || !this.resetDialogWanted) return;
    this.resetDialogWanted = false;
    this.resetFrameVisible = false;
    if (!this.resetFrameAttached) this.resetCoverVisible = false;
  }

  private retireResetDialog(): void {
    this.resetDialogTicket = 0;
    this.resetDialogWanted = false;
    this.resetFrameAttached = false;
    this.resetFrameVisible = false;
    this.resetCoverVisible = false;
  }

  @Builder
  private resetDialogCover() {
    Stack({ alignContent: Alignment.Center }) {
      if (this.resetFrameVisible) {
        ForEach([this.resetDialogTicket], (ticket: number): void => { this.resetDialog(ticket, this.temporaryBackIdentity); },
          (ticket: number): string => ticket.toString());
      }
    }.width('100%').height('100%').hitTestBehavior(HitTestMode.Default);
  }

  @Builder
  private resetDialog(ticket: number, identity: string) {
    Stack({ alignContent: Alignment.Center }) {
      Stack().width('100%').height('100%')
        .attributeModifier(new ReaderModalScrimModifier(this.navigationPreferences, this.appThemeScheme,
          readerAppColor('app.scrim.warmModal', this.appThemeScheme)))
        .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM])
        .accessibilityLevel('no').onClick((): void => this.closeResetDialog(ticket));
      Column() {
        ReaderDialogSurface({ specId: 'book-removal', title: '恢复界面与阅读设置',
          actions: [new DialogActionView('cancel', '取消', 'default', true, true),
            new DialogActionView('confirm', '恢复默认', 'danger')],
          onAction: (action: string): void => this.chooseResetDialog(ticket, identity, action),
          body: (): void => { this.resetDialogMessage(); },
        });
      }.width('100%').padding({ left: 20, right: 20 }).hitTestBehavior(HitTestMode.Transparent)
        .transition(this.resetDialogMotion());
    }.width('100%').height('100%')
      .onAppear((): void => { if (ticket === this.resetDialogTicket) this.resetFrameAttached = true; })
      .transition(this.appReduceMotion ? TransitionEffect.OPACITY.animation(readerMotionReducedFadeParam()) :
        TransitionEffect.asymmetric(
          TransitionEffect.OPACITY.animation({ duration: 220, curve: readerMotionStandardCurve() }),
          TransitionEffect.OPACITY.animation({ duration: 180, curve: readerMotionStandardCurve() })),
        (entering: boolean): void => {
          if (!entering && ticket === this.resetDialogTicket && !this.resetDialogWanted) this.resetCoverVisible = false;
        });
  }

  private resetDialogMotion(): TransitionEffect {
    if (this.appReduceMotion) return TransitionEffect.IDENTITY;
    const effect = TransitionEffect.scale({ x: 0.95, y: 0.95 }).combine(TransitionEffect.translate({ y: 8 }));
    return TransitionEffect.asymmetric(
      effect.animation({ duration: 220, curve: readerMotionStandardCurve() }),
      TransitionEffect.scale({ x: 0.95, y: 0.95 }).animation({ duration: 180, curve: readerMotionStandardCurve() }));
  }

  @Builder
  private resetDialogMessage() {
    Scroll() {
      Text('将重置通用偏好、界面外观与渲染模式、书架视图与筛选、阅读及朗读设置。书籍、书源、阅读进度、书签、导入字体文件及服务凭据会完整保留。')
        .width('100%').textAlign(TextAlign.Center)
        .fontFamily(MESSAGE_BODY.fontFamily).fontWeight(MESSAGE_BODY.fontWeight).fontSize(MESSAGE_BODY.fontSizeFp)
        .lineHeight(MESSAGE_BODY.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_MESSAGE_MUTED', this.appThemeScheme));
    }.width('100%').constraintSize({ maxHeight: '45%' }).scrollBar(BarState.Auto);
  }

  private chooseResetDialog(ticket: number, identity: string, action: string): void {
    if (!this.resetDialogWanted || ticket !== this.resetDialogTicket ||
      !this.settingsInputIsCurrent(identity) || !this.generalConfirmationCurrent(identity)) return;
    if (action !== 'cancel' && action !== 'confirm') return;
    this.closeResetDialog(ticket);
    if (action === 'confirm') void this.performRestoreDefaults(identity);
  }

  private async performRestoreDefaults(identity: string): Promise<void> {
    if (!this.settingsInputIsCurrent(identity) || !this.generalConfirmationCurrent(identity) || !this.isOpeningCurrent()) return;
    this.resetInFlight = true;
    const revision = ++this.resetRevision;
    const sectionRevision = this.resetSectionRevision;
    this.resetMessage = '';
    let result: CommitReadbackSummary | undefined;
    try {
      result = await this.onRestoreDefaults();
    } catch (_) { /* A missing reply supplies no reset receipt. */ }
    if (!this.mounted || identity !== this.temporaryBackIdentity || revision !== this.resetRevision) return;
    this.resetInFlight = false;
    if (!this.generalConfirmationCurrent(identity) || !this.isOpeningCurrent() || sectionRevision !== this.resetSectionRevision) return;
    if (result?.fact === 'confirmedCurrent') {
      this.developerToolsUnlocked = false;
      this.resetMessage = '已恢复界面与阅读设置';
    }
    else if (result === undefined || result.fact === 'notDispatched') this.resetMessage = '恢复未完成，请重试';
    // Pending writes and failed readback already use the owner's recovery projection.
    this.showFeedbackToast(this.resetMessage);
    if (this.resetDialogTicket === 0) this.restoreResetFocus(identity);
  }

  @Builder
  private dangerRow() {
    ReaderCard({ specId: 'settings-category' }) {
      ReaderFormRow({ kind: 'danger', label: '恢复默认设置', isBusy: this.resetInFlight,
        actionId: this.resetTriggerId(this.temporaryBackIdentity),
        onAction: (): void => this.requestRestoreDefaults() });
    }
  }

}
