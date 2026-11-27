import { readerAnimatePress, readerPressPointer } from '../../../ui/foundation/ReaderPressMotion';
import type { ReaderControlTemporaryInputKind } from './ReaderControlSessionState';
import { ReaderEditingVisibility } from '../../../ui/layout/ReaderEditingVisibility';
import { READER_LAYOUT_DEBUG_BUILD } from '../../../ui/foundation/ReaderLayoutInvariantSignals';
import type { LayoutInvariantTag } from '../../../ui/layout/LayoutInvariantEvaluator';
import { type ReaderControlMeasuredProfile, type ReaderControlModuleFacts, type ReaderControlPreparedModuleProfile } from './ReaderControlMinimumMeasurement';
import { ReaderPanelFrame } from '../../../ui/surfaces/ReaderPanelFrame';
import type { ReaderNavigationPreferences, ReaderSurfaceMaterialDecision, ReaderSurfaceMaterialRole } from '../../../app/HarmonyCapabilityPolicy';
import { defaultNavigationPreferences, ReaderModalScrimModifier, readerSurfaceMaterialDecision } from '../../../ui/surfaces/ReaderSurfaceMaterial';
import { ReaderControlChapterProgressCard } from './ReaderControlChapterProgressCard';
import { ReaderControlModuleNavigation, type ReaderControlNavigationModule } from './ReaderControlModuleNavigation';
import { readerMotionAnimateParam, readerMotionReducedFadeParam } from '../../../ui/foundation/ReaderMotionPolicy';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { type ReaderControlPlaybackProfileReader } from './ReaderControlPlaybackProfile';
import hilog from '@ohos.hilog';
import type { LocalReadingTocEntry } from '../application/LocalReadingFlowGateway';
import { type ReaderSessionMorphSourceKind } from './ReaderSessionMorphState';
import { TOK_BORDER_W } from '../../../ui/foundation/ReaderTokens';
import { READER_CONTROL_HOME_SECTION_GAP } from './ReaderControlGeometry';
import { ReaderControlLayoutSnapshot, readerControlExtentFits, type ReaderControlModuleMeasurer, type ReaderControlContentModule } from './ReaderLayoutGeometry';

import curves from '@ohos.curves';
import type { ReaderControlPage } from './ReaderControlRouting';
import type { ReaderControlBackdropRect } from './ReaderControlBackdropTouch';
import { type ReaderControlLocation, type ReaderControlSessionState } from './ReaderControlSessionState';
import { readerControlHasFullContentSurface, readerControlHasQuickContentSurface, type ReaderControlMotionFrame } from './ReaderControlMotionGeometry';

import {
  createReaderControlFactDelivery, defaultReaderControlIntent, type ReaderControlFactWatch,
  type ReaderControlPanelFacts, type ReaderControlIntentHandler, type ReaderControlPanelFrame,
} from './ReaderControlPanelNativeContract';
import {
  ReaderControlHeaderChrome, ReaderControlHeaderAction, ReaderControlHeaderGrabCap, ReaderControlHeaderScene,
} from './ReaderControlHeaderChrome';
import type { ReaderControlHeaderPaintProfile } from './ReaderControlHeaderGeometry';
import type { UIContext } from '@ohos.arkui.UIContext';
import { ReaderControlTopBar, ReaderControlShortWindowActions, ReaderControlTopBarPaint, ReaderControlTopBarOwner,
  ReaderControlTopBarBack, ReaderControlTopBarActions, ReaderControlMoreMenu,
  type ReaderControlTopBarView, type ReaderControlTopBarOrigin } from './ReaderControlTopBar';
import {
  ReaderControlQuickHomeActions, ReaderControlBrightnessRail, ReaderControlAccessibleBrightnessActions,
  ReaderControlQuickHomeOwner, ReaderControlQuickHomePaint,
} from './ReaderControlQuickHome';
import type { ReaderControlDocumentSnapshot, ReaderControlIntent, ReaderControlIntentResult } from './ReaderControlPanelNativeContract';
import { ReaderControlPanelMotionPaint, ReaderControlPanelRuntimeHost, type ReaderControlPanelRuntimeEnvironment } from './ReaderControlPanelRuntimeHost';
import { ReaderControlPanelMinimumHost, type ReaderControlPanelMinimumView } from './ReaderControlPanelMinimumHost';
import { ReaderControlPanelModuleContent, ReaderControlPanelModuleScene } from './ReaderControlPanelModuleContent';


export type { ReaderControlPage } from './ReaderControlRouting';

@Component
export struct ReaderControlPanel {
  @ObjectLink @Watch('onPanelFrameChanged') panelFrame!: ReaderControlPanelFrame;
  onIntent: ReaderControlIntentHandler = defaultReaderControlIntent;
  private deliveredFrame: ReaderControlPanelFrame | undefined = undefined;
  private readonly factDelivery = createReaderControlFactDelivery();

  @State private motionPaint: ReaderControlPanelMotionPaint = new ReaderControlPanelMotionPaint();
  private readonly motionEnvironment: ReaderControlPanelRuntimeEnvironment = {
    facts: (): ReaderControlPanelFacts => this.currentFacts(),
    paint: (): ReaderControlPanelMotionPaint => this.motionPaint,
    context: (): UIContext => this.getUIContext(),
    linkedSession: (): ReaderControlSessionState => this.controlSession,
    publishSession: (session: ReaderControlSessionState): void => { this.controlSession = session; },
    intent: (intent: ReaderControlIntent): ReaderControlIntentResult => this.onIntent(intent),
    hasIntent: (): boolean => this.onIntent !== defaultReaderControlIntent,
    environment: {
      editingOffset: (): number => this.editingOffsetY,
      setEditingOffset: (offset: number): void => { this.editingOffsetY = offset; },
      alignmentPreference: (): string => this.manualControlAlignment,
      foreground: (): boolean => this.gripForeground,
    },
    minimum: {
      layout: (): ReaderControlLayoutSnapshot => this.minimumHost.currentLayout(),
      currentIdentity: (): string => this.minimumHost.currentMinimumIdentity(),
      committedIdentity: (): string => this.minimumHost.committedMinimumIdentity(),
      presentationAvailable: (): boolean => this.minimumHost.minimumPresentationAvailable(),
      inputReady: (): boolean => this.minimumHost.minimumInputReady(),
      availabilityChanged: (): void => this.minimumHost.onMinimumAvailabilityChanged(),
      publishPlaybackProfile: (): void => this.minimumHost.publishSelectedPlaybackProfile(),
      registerFonts: (): void => this.minimumHost.registerFonts(),
      warmFonts: (): void => this.minimumHost.prepareFonts(),
      retire: (): void => this.minimumHost.retireFontsAndMeasurers(),
      retireDirectSheetReceipt: (): void => this.minimumHost.retireDirectSheetReceipt(),
    },
    quickHome: {
      holdsPlacement: (): boolean => this.quickHome.holdingPlacement(),
      syncProgress: (): void => this.quickHome.syncProgressInput(),
      invalidateProgress: (): void => this.quickHome.invalidateProgressInput(),
      cancelBrightness: (): void => this.quickHome.cancelBrightnessDrag(),
      retirePress: (): void => { this.quickOrModulePress = ''; this.quickOrModulePointer = -1; },
      admitInitialBookmark: (): void => {
        this.pageBookmarkFill = this.currentFacts().document.bookmarks.pageStatus === 'bookmarked' ? 1 : 0;
      },
      canStepChapter: (direction: number): boolean => this.quickHome.canStepChapter(direction),
    },
    topBar: {
      menuVisible: (): boolean => this.topBarOwner.menuVisible(),
      dismiss: (): void => this.topBarOwner.dismissMoreMenu(),
      rectangle: (): ReaderControlBackdropRect => this.topBarOwner.topBarRect(),
      retireTrace: (): void => this.topBarOwner.retireMenuTrace(),
    },
  };
  private readonly motion = new ReaderControlPanelRuntimeHost(this.motionEnvironment);

  private readonly minimumView: ReaderControlPanelMinimumView = {
    facts: (): ReaderControlPanelFacts => this.currentFacts(), uiContext: (): UIContext => this.getUIContext(),
    mounted: (): boolean => this.motion.mounted(), mountGeneration: (): number => this.motion.mountGeneration(),
    semanticSession: (): ReaderControlSessionState => this.controlSession,
    contentLocation: (): ReaderControlLocation => this.motion.contentLocation(),
    currentDirectoryEntries: (): LocalReadingTocEntry[] => this.currentDirectoryEntries(),
    directSheetClosing: (): boolean => this.motionPaint.directSheetClosing,
    contentMotionProgress: (): number => this.motionPaint.contentMotionProgress,
    bookmarkPillHeight: (): number => this.quickHome.bookmarkPillHeight(),
    currentOwnerScope: (): string => this.motion.currentMoreMenuOwnerScope(),
    captureControlGuard: (): (() => boolean) => this.motion.controlCallbackGuard(),
    onIntent: (intent: ReaderControlIntent): ReaderControlIntentResult => this.onIntent(intent),
    admitVisibleLocation: (location: ReaderControlLocation): void => this.motion.admitVisibleLocation(location),
    layoutChanged: (): void => this.motion.onLayoutChanged(),
    retireTemporaryInput: (): void => this.motion.retireTemporaryInput(),
    brightnessDragInvalid: (): boolean => this.quickHome.brightnessDragInvalid(),
    cancelBrightnessDrag: (): void => this.quickHome.cancelBrightnessDrag(),
    syncProgressInput: (): void => this.quickHome.syncProgressInput(),
    refreshLaunchSample: (): void => this.motion.onLaunchSampleChanged(),
    confirmLaunchSourceReady: (): void => this.motion.confirmLaunchSourceReady(),
  };
  private readonly minimumHost = new ReaderControlPanelMinimumHost(this.minimumView);

  private readonly moduleScene = new ReaderControlPanelModuleScene(
    (): ReaderControlPanelFacts => this.currentFacts(),
    (): ReaderControlIntentHandler => this.onIntent,
    {
      location: (): ReaderControlLocation => this.motion.contentLocation(),
      frame: (): ReaderControlMotionFrame => this.motion.frame(),
      expanded: (): boolean => this.minimumHost.currentLayout().isExpanded(),
      width: (): number => this.motionPaint.contentMotionWidth,
      height: (): number => this.motion.contentEditingHeight(),
      progress: (): number => this.motionPaint.contentMotionProgress,
      endpointHeight: (full: boolean): number => this.motion.contentEndpointHeight(full),
    },
    {
      identity: (): string => this.minimumHost.currentMinimumIdentity(),
      key: (): string => this.minimumHost.currentMinimumKey(),
      prepared: (): ReaderControlPreparedModuleProfile | undefined => this.minimumHost.preparedMinimum(),
      bind: (module: ReaderControlContentModule, identity: string, measurer: ReaderControlModuleMeasurer | undefined,
        profileReader?: ReaderControlPlaybackProfileReader): void =>
        this.minimumHost.bindModuleMinimum(module, identity, measurer, profileReader),
      factsChanged: (identity: string, facts: ReaderControlModuleFacts): void => this.minimumHost.onModuleMinimumFactsChanged(identity, facts),
    },
    {
      active: (module: string): boolean => this.motion.secondaryModuleInputEnabled(module),
      editorCurrent: (module: 'search' | 'directory' | 'tts'): boolean => this.motion.moduleEditorInputEnabled(module),
      temporaryLayer: (module: string): ((active: boolean, kind?: ReaderControlTemporaryInputKind, endEditing?: () => void | Promise<void>) => void) => this.motion.moduleTemporaryLayerHandler(module),
      editingHost: (): ReaderEditingVisibility => this.motion.editingVisibility(),
      listSessionKey: (): string => this.listSessionKey(),
      canStepChapter: (delta: number): boolean => this.quickHome.canStepChapter(delta),
      requestHome: (): void => this.motion.requestPage('home', 'module-back'),
      directoryTab: (tab: string): void => this.motion.requestDirectoryTab(tab),
      expandReplace: (): void => this.motion.expandReplace(),
      fontReorder: (active: boolean): void => this.motion.setAppearanceFontReorderActivity(active),
      mounted: (): boolean => this.motion.mounted(),
      visualEpoch: (): number => this.motion.visualState().epoch,
    },
    {
      visible: (kind: ReaderSessionMorphSourceKind): void => this.motion.onLaunchSourceVisible(kind),
      measured: (kind: ReaderSessionMorphSourceKind, left: number, top: number, width: number, height: number): void =>
        this.motion.reportSessionMorphSource(kind, left, top, width, height),
    },
  );

  @State private topBarPaint: ReaderControlTopBarPaint = new ReaderControlTopBarPaint();
  @State private quickHomePaint: ReaderControlQuickHomePaint = new ReaderControlQuickHomePaint();

  private readonly topBarView: ReaderControlTopBarView = {
    paint: (): ReaderControlTopBarPaint => this.topBarPaint,
    facts: (): ReaderControlPanelFacts => this.currentFacts(),
    layout: (): ReaderControlLayoutSnapshot => this.minimumHost.currentLayout(),
    frame: (): ReaderControlMotionFrame => this.motion.frame(),
    visualSession: (): ReaderControlSessionState => this.motion.visualState(),
    runtimeMounted: (): boolean => this.motion.mounted(), scheme: (): string => this.appScheme,
    buildLeading: (): void => { this.controlTopBarLeading(); },
    buildTrailing: (): void => { this.controlTopBarTrailing(); },
    buildMoreMenu: (generation: number): void => { this.controlMoreMenu(generation); },
    uiContext: (): UIContext => this.getUIContext(),
    origin: (): ReaderControlTopBarOrigin => ({ x: this.motion.windowX(), y: this.motion.windowY() }),
    editingMetricsRevision: (): number => this.editingMetricsRevision,
    popupMaterial: (): ReaderSurfaceMaterialDecision => this.surfaceMaterial('popoverMenu'),
    directSheetVisible: (): boolean => this.motion.directSheetVisible(),
    shortHomeContentInput: (): boolean => this.motion.contentLocation().level === 'home' && this.motion.contentInputEnabled(),
    currentOwnerScope: (): string => this.motion.currentMoreMenuOwnerScope(),
    guardAction: (action: () => void): (() => void) => this.motion.controlActionHandler(action),
    onIntent: (intent: ReaderControlIntent): ReaderControlIntentResult => this.onIntent(intent),
    syncProgressInput: (): void => this.quickHome.syncProgressInput(),
    refreshDockPlacement: (): void => this.motion.refreshDockPlacement(),
    reportBackdropRegions: (): void => this.motion.reportBackdropRegions(),
  };
  private readonly topBarOwner = new ReaderControlTopBarOwner(this.topBarView);

  private readonly quickHome = new ReaderControlQuickHomeOwner({
    paint: (): ReaderControlQuickHomePaint => this.quickHomePaint,
    geometry: {
      layout: (): ReaderControlLayoutSnapshot => this.minimumHost.currentLayout(),
      frame: (): ReaderControlMotionFrame => this.motion.frame(),
      profile: (): ReaderControlMeasuredProfile | undefined => this.minimumHost.selectedMinimumProfile(),
      scheme: (): string => this.appScheme, reducedMotion: (): boolean => this.currentFacts().geometry.reduceMotion,
      fontScale: (): number => this.currentFacts().geometry.fontScale,
    },
    reading: {
      document: (): ReaderControlDocumentSnapshot => this.currentFacts().document,
      directoryEntries: (): LocalReadingTocEntry[] => this.currentDirectoryEntries(),
      brightness: () => this.currentFacts().preferences.brightness,
    },
    input: {
      openRevision: (): number => this.currentFacts().geometry.openRevision,
      lifecycle: (): number => this.motion.mountGeneration(), runtimeTicket: (): number => this.motion.inputTicket(),
      temporaryLayer: (): ReaderControlTemporaryInputKind => this.currentFacts().geometry.temporary.layer,
      minimumIdentity: (): string => this.currentFacts().geometry.minimum.identity,
      minimumInputReady: (): boolean => this.minimumHost.minimumInputReady(), mounted: (): boolean => this.motion.mounted(),
      canUseContent: (): boolean => this.motion.contentInputEnabled(), menuVisible: (): boolean => this.topBarOwner.menuVisible(),
      pressed: (): string => this.quickOrModulePress, location: (): ReaderControlLocation => this.motion.contentLocation(),
    },
    effects: {
      observePress: (event: TouchEvent, action: string, enabled: boolean): void => this.observeQuickOrModulePress(event, action, enabled),
      captureAction: (): (() => boolean) => this.motion.controlCallbackGuard(),
      placementChanged: (): void => this.motion.refreshDockPlacement(),
      buildBrightnessActions: (): void => { this.controlBrightnessAccessibility(); },
      navigateDirectory: (): void => this.motion.requestPage('moduleDirectory'),
      navigateSearch: (): void => this.motion.promoteSearch(),
      intent: (intent: ReaderControlIntent): ReaderControlIntentResult => this.onIntent(intent),
    },
  });

  private readonly headerScene = new ReaderControlHeaderScene({
    layout: (): ReaderControlLayoutSnapshot => this.minimumHost.currentLayout(),
    frame: (): ReaderControlMotionFrame => this.motion.frame(),
    location: (): ReaderControlLocation => this.motion.contentLocation(),
    headerPaint: (): ReaderControlHeaderPaintProfile | undefined => this.minimumHost.selectedMinimumProfile()?.headerPaint,
    scheme: (): string => this.appScheme, fixedIsland: (): boolean => this.currentFacts().geometry.fixedIsland,
    surfaceHeight: (): number => this.motion.controlPanelHeight(), directSheetVisible: (): boolean => this.motion.directSheetVisible(),
    directSheetClosing: (): boolean => this.motionPaint.directSheetClosing,
    actionInputEnabled: (): boolean => this.motion.controlActionInputEnabled(),
  }, {
    guard: (action: () => void): (() => void) => this.motion.controlActionHandler(action),
    collapse: (): void => this.motion.collapseControl(),
    grabTouch: (): ((event: TouchEvent) => void) => this.motion.controlTouchHandler(),
  });

  @Builder
  private controlTopBarLeading() { ReaderControlTopBarBack({ owner: this.topBarOwner }); }

  @Builder
  private controlTopBarTrailing() { ReaderControlTopBarActions({ owner: this.topBarOwner }); }

  @Builder
  private controlMoreMenu(generation: number) { ReaderControlMoreMenu({ owner: this.topBarOwner, generation }); }

  @Builder
  private controlBrightnessAccessibility() { ReaderControlAccessibleBrightnessActions({ quick: this.quickHome }); }

  private currentFacts(): ReaderControlPanelFacts {
    return this.factDelivery.active() ?? this.panelFrame;
  }

  private onPanelFrameChanged(): void {
    const previous = this.deliveredFrame;
    const next = this.panelFrame;
    this.deliveredFrame = next;
    if (previous === undefined || previous === next) return;
    this.factDelivery.deliver(previous, next, (event: ReaderControlFactWatch): void => {
      switch (event) {
        case 'placement': this.motion.refreshDockPlacement(); break;
        case 'launch': this.motion.onLaunchSampleChanged(); break;
        case 'runtimeInput': this.motion.onRuntimeEnabledChanged(); break;
        case 'openRevision': this.quickHome.syncProgressInput(); break;
        case 'minimumIdentity': this.minimumHost.onMinimumIdentityChanged(); break;
        case 'minimumCommit': this.minimumHost.onCommittedMinimumIdentityChanged(); break;
        case 'measure': this.minimumHost.publishMinimumMeasurer(); break;
        case 'minimumMetrics': this.minimumHost.onMinimumMetricsChanged(); break;
        case 'receipt': this.minimumHost.onPresentationReceiptChanged(); break;
        case 'playbackMinimum': this.minimumHost.publishSelectedPlaybackProfile(); break;
        case 'minimumAvailability': this.minimumHost.onMinimumAvailabilityChanged(); break;
        case 'temporaryLayer': this.motion.onTemporaryLayerActivityChanged(); break;
        case 'minimumFacts': this.minimumHost.onMinimumFactsPropsChanged(); break;
        case 'layout': this.motion.onLayoutChanged(); break;
        case 'bookmark': this.onPageBookmarkStatusChanged(); break;
        case 'brightness': this.quickHome.onBrightnessConfirmed(); break;
        case 'recovery': this.topBarOwner.recoveryIdentityChanged(); break;
      }
    });
  }

  @StorageLink('readerControlAlignment') @Watch('refreshDockPlacement')
  private manualControlAlignment: string = 'center';
  @StorageLink('readerAppForeground') @Watch('refreshDockPlacement')
  private gripForeground: boolean = true;
  @StorageLink('readerWindowMetricsRevision') @Watch('onEditingWindowChanged') private editingMetricsRevision: number = 0;
  @State @Watch('onEditingOffsetChanged') private editingOffsetY: number = 0;
  private refreshDockPlacement(): void { this.motion.refreshDockPlacement(); }
  private onEditingWindowChanged(): void { this.motion.onEditingWindowChanged(); }
  private onEditingOffsetChanged(): void { this.motion.onEditingOffsetChanged(); }
  @StorageLink('readerAppScheme') private appScheme: string = 'day';
  @StorageLink('readerSystemScheme') private systemScheme: string = 'day';
  @StorageProp('readerNavigationAppearancePreferences') private navigationPreferences: ReaderNavigationPreferences =
    defaultNavigationPreferences();
  @Link @Watch('onControlSessionChanged') controlSession: ReaderControlSessionState;
  private currentDirectoryEntries(): LocalReadingTocEntry[] {
    return this.currentFacts().document.catalog.publication?.entriesAt(this.currentFacts().document.catalog.revision) ?? this.currentFacts().document.catalog.defaultEntries;
  }
  @State private pageBookmarkFill: number = 0;
  @State private pageBookmarkTuck: number = 1;

  aboutToAppear(): void {
    this.deliveredFrame = this.panelFrame;
    this.motion.mount();
  }

  aboutToDisappear(): void { this.motion.unmount(); }

  private onControlSessionChanged(): void { this.motion.onControlSessionChanged(); }

  @Builder
  private accessibleControlActions() {
    Text('关闭控制栏并返回阅读').width(1).height(1)
      .accessibilityRole(AccessibilityRoleType.BUTTON)
      .enabled(this.motion.controlActionInputEnabled())
      .onClick(this.motion.controlActionHandler((): void => {
        if (this.motion.controlActionInputEnabled()) { this.onIntent({ kind: 'inputActivity' }); this.onIntent({ kind: 'dismiss' }); }
      }));
    if (!this.currentFacts().geometry.fixedIsland && this.motion.contentLocation().level === 'secondary') {
      Text(this.motion.contentLocation().form === 'full' ? '收回快捷控制栏' : '展开完整控制栏')
        .width(1).height(1).accessibilityRole(AccessibilityRoleType.BUTTON)
        .enabled(this.motion.controlActionInputEnabled() && this.motion.contentInputEnabled())
        .onClick(this.motion.controlActionHandler((): void => {
          this.motion.activateAccessibleGrabber();
        }));
    }
  }

  private listSessionKey(): string {
    return `${this.currentFacts().document.source.id}:${this.currentFacts().document.bookTitle}:${this.currentFacts().geometry.openRevision}`;
  }

  private surfaceMaterial(role: ReaderSurfaceMaterialRole): ReaderSurfaceMaterialDecision {
    return readerSurfaceMaterialDecision(role, this.navigationPreferences, this.appScheme, this.systemScheme);
  }

  // The production component owns both the clock and every actor builder.
  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      if (this.motionPaint.controlActorsRetained || this.motion.frame().visibility > 0 || this.currentFacts().launch.sample !== undefined) {
      ReaderControlTopBar({ owner: this.topBarOwner });
      if (this.motion.directSheetVisible()) {
        Stack().width('100%').height('100%').id('reader-control-direct-sheet-scrim')
          .attributeModifier(new ReaderModalScrimModifier(this.navigationPreferences, this.appScheme,
            readerAppColor('app.scrim.warmModal', this.appScheme), this.surfaceMaterial('controlPanel').native))
          .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM])
          .opacity(this.motionPaint.visualExpansionProgress)
          .onTouch((event: TouchEvent): void => event.stopPropagation())
          .accessibilityLevel('no').onClick((): void => this.motion.closeDirectSheet());
      }
      Stack({ alignContent: Alignment.TopStart }) {
        Stack()
          .id('reader-control-motion-shell')
          .width(this.motion.frame().shell.width).height(this.motion.frame().shell.height)
          .position({ x: 0, y: this.motion.frame().shell.y })
          .attributeModifier(new ReaderPanelFrame('reader', this.appScheme, false, undefined,
            this.motion.frame().visibility > 0 ? this.surfaceMaterial('controlPanel') : undefined))
          .opacity(this.motion.frame().shell.opacity)
          // The shell is a visual actor only.  A full-size Block here steals
          // pointer hit testing from the mounted header/content actors below,
          // so taps such as the collapse action never reach their onClick.
          .hitTestBehavior(HitTestMode.None);
        Stack()
          .id('reader-control-full-content-surface')
          .width(this.motion.frame().contentSurface.width).height(this.motion.frame().contentSurface.height)
          .position({ x: this.motion.frame().contentSurface.x, y: this.motion.frame().contentSurface.y })
          .attributeModifier(new ReaderPanelFrame('reader-full-fill', this.appScheme))
          .opacity(readerControlHasFullContentSurface(this.motion.contentLocation().module) ?
            this.motion.frame().contentSurface.opacity : 0)
          .visibility(Visibility.Visible)
          .enabled(false).hitTestBehavior(HitTestMode.None);
        // Original Quick card (e.g. 924:69) is distinct from FullContentSurface.
        // TTS and Home own their own painted cards, so they are not doubled.
        Stack()
          .id('reader-control-quick-content-surface')
          .width(this.motion.frame().content.width).height(this.motion.frame().content.height)
          .position({ x: this.motion.frame().content.x, y: this.motion.frame().content.y })
          .attributeModifier(new ReaderPanelFrame('reader-quick-fill', this.appScheme))
          .opacity(this.motion.contentLocation().level !== 'home' && readerControlHasQuickContentSurface(this.motion.contentLocation().module) ?
            this.motion.frame().content.opacity * (1 - this.motion.frame().progress) : 0)
          .hitTestBehavior(HitTestMode.None);
        Stack({ alignContent: Alignment.TopStart }) {
          Stack({ alignContent: Alignment.TopStart }) { this.controlContent(); }
            .translate({ x: this.motionPaint.moduleMotionX, y: this.motionPaint.moduleMotionY }).opacity(this.motionPaint.moduleMotionOpacity)
            .width(this.motion.frame().content.width).height(this.motion.frame().content.height)
            .position({ x: 0, y: 0 });
        }
          .width(this.motion.frame().content.width).height(this.motion.frame().content.height)
          .position({ x: this.motion.frame().content.x, y: this.motion.frame().content.y })
          .id('reader-control-motion-content-clip')
          .borderRadius(8 + 4 * this.motion.frame().progress)
          .clip(true).opacity(this.motion.frame().content.opacity)
          .enabled(this.motion.contentInputEnabled())
          .hitTestBehavior(this.motion.frame().visibility > 0 ? HitTestMode.Default : HitTestMode.None);
        // Strokes stay above opaque scrolling rows. Each remains paired with
        // its own source surface rather than borrowing the other actor's rect.
        Stack()
          .id('reader-control-content-outline')
          .width(this.motion.frame().content.width).height(this.motion.frame().content.height)
          .position({ x: this.motion.frame().content.x, y: this.motion.frame().content.y })
          .borderRadius(8 + 4 * this.motion.frame().progress)
          .border({ width: TOK_BORDER_W, color: readerAppColor(this.motion.contentLocation().module === 'settings' &&
            this.motion.frame().progress === 0 ? 'TOK_LINE_STRONG' : 'TOK_LINE', this.appScheme) })
          .opacity(this.motion.contentLocation().level !== 'home' && readerControlHasQuickContentSurface(this.motion.contentLocation().module) ?
            this.motion.frame().content.opacity * (1 - this.motion.frame().progress) : 0)
          .hitTestBehavior(HitTestMode.None);
        Stack()
          .id('reader-control-full-content-outline')
          .width(this.motion.frame().contentSurface.width).height(this.motion.frame().contentSurface.height)
          .position({ x: this.motion.frame().contentSurface.x, y: this.motion.frame().contentSurface.y })
          .borderRadius(12)
          .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE', this.appScheme) })
          .opacity(readerControlHasFullContentSurface(this.motion.contentLocation().module) ?
            this.motion.frame().contentSurface.opacity : 0)
          .hitTestBehavior(HitTestMode.None);
        Stack({ alignContent: Alignment.TopStart }) { ReaderControlHeaderChrome({ scene: this.headerScene }); }
          .width(this.motion.frame().header.width).height(this.motion.frame().header.height)
          .position({ x: this.motion.frame().header.x, y: this.motion.frame().header.y })
          .opacity((this.motion.contentLocation().module === 'replace') ? 1 : this.motion.frame().header.opacity)
          // Default admits the child collapse action and masks lower siblings.
          // Block here would skip every child, leaving a visible but dead button.
          .zIndex(2)
          .hitTestBehavior(this.currentFacts().geometry.temporary.layer === '' && (this.motion.frame().header.opacity > 0 || this.motion.contentLocation().module === 'replace') ?
            HitTestMode.Default : HitTestMode.None)
          .enabled(this.currentFacts().geometry.inputEnabled && this.motion.frame().visibility > 0 && this.motionPaint.visualHeldPointerId < 0 &&
            (this.currentFacts().geometry.temporary.layer === '' || this.currentFacts().geometry.temporary.layer === 'moreMenu') &&
            (this.motion.frame().header.opacity > 0 || this.motion.contentLocation().module === 'replace'))
          .accessibilityLevel((this.currentFacts().geometry.temporary.layer !== '') ? 'no-hide-descendants' : 'auto');
        ReaderControlHeaderAction({ scene: this.headerScene });
        Stack({ alignContent: Alignment.TopStart }) { ReaderControlBrightnessRail({ quick: this.quickHome }); }
          .width(this.motion.frame().brightness.width).height(this.motion.frame().brightness.height)
          .position({ x: this.motion.frame().brightness.x, y: this.motion.frame().brightness.y })
          .opacity(this.motion.frame().brightness.opacity)
          // HitTestMode.None excludes only this container, not its children.
          // Retain the authored actors, but retire the whole faded subtree.
          .enabled(this.motion.contentInputEnabled() && (this.currentFacts().geometry.temporary.layer === '' || this.currentFacts().geometry.temporary.layer === 'moreMenu') &&
            this.motion.frame().brightness.opacity > 0)
          .hitTestBehavior(this.currentFacts().geometry.temporary.layer === '' && this.motion.frame().brightness.opacity > 0 ? HitTestMode.Default : HitTestMode.None)
          .accessibilityLevel(this.motion.contentInputEnabled() && this.currentFacts().geometry.temporary.layer === '' &&
            this.motion.frame().brightness.opacity > 0 ? 'auto' : 'no-hide-descendants');
        Stack({ alignContent: Alignment.TopStart }) { this.moduleNavBar(); }
          .width(this.motion.frame().navigation.width).height(this.motion.frame().navigation.height)
          .position({ x: this.motion.frame().navigation.x, y: this.motion.frame().navigation.y })
          .opacity(this.motion.frame().navigation.opacity)
          // The modal Popup owns background input. Keep the native Button
          // paint stable while dispatch and accessibility are suspended.
          .enabled(this.motion.navigationInputEnabled(true))
          .accessibilityLevel(!this.topBarOwner.menuVisible() && !this.motion.hasCurrentModalInput() &&
            this.motion.frame().navigation.opacity > 0 ? 'auto' : 'no-hide-descendants')
          .hitTestBehavior(this.motion.frame().navigation.opacity > 0 ? HitTestMode.Default : HitTestMode.None);
        // The cap and central grabber retain their one gesture owner.
        if (!this.currentFacts().geometry.fixedIsland) {
        ReaderControlHeaderGrabCap({ scene: this.headerScene });

        Stack({ alignContent: Alignment.TopStart }) {
          // Paint from the same actor used by the spatial axis. Stack margin
          // alignment must not become a second source of vertical placement.
          Row().width(this.motion.frame().grabber.width).height(this.motion.frame().grabber.height).borderRadius(2)
            .backgroundColor(readerAppColor('TOK_READ_HANDLE', this.appScheme))
            .position({ x: this.motion.frame().grabber.x - (this.minimumHost.currentLayout().fullPanelWidth - 72) / 2,
              y: this.motion.frame().grabber.y - this.motion.frame().shell.y })
            .id('reader-control-motion-grabber-bar').opacity(this.motion.frame().grabber.opacity);
        }
        .width(72).height(28)
        .id('reader-control-motion-grabber')
        .zIndex(3)
        .position({ x: (this.minimumHost.currentLayout().fullPanelWidth - 72) / 2, y: this.motion.frame().shell.y })
        .hitTestBehavior(HitTestMode.Block)
        .accessibilityText(this.motion.contentLocation().level === 'home' ?
          '控制栏拖动区域，向下关闭' : this.motion.contentLocation().form === 'full' ?
            '完整控制栏，向下收回快捷控制栏' : '快捷控制栏，向上展开，向下关闭')
        .accessibilityRole(AccessibilityRoleType.BUTTON)
        .accessibilityLevel('no')
        .accessibilityVirtualNode(this.accessibleControlActions)
        .onTouch(this.motion.controlTouchHandler());
        }
        }
        .width(this.minimumHost.currentLayout().fullPanelWidth).height(this.motion.controlPanelHeight())
        .id('reader-control-motion-dock')
        .customProperty('readerLayoutInvariant', typeof READER_LAYOUT_DEBUG_BUILD === 'boolean' && READER_LAYOUT_DEBUG_BUILD
          ? { role: 'modal-overlay', id: 'reading-controls', active: this.motion.frame().visibility > 0,
            intercepts: this.currentFacts().geometry.inputEnabled && (this.motion.frame().visibility > 0 || this.motionPaint.visualHeldPointerId >= 0) } as LayoutInvariantTag : undefined)
        .translate({ x: this.minimumHost.currentLayout().isExpanded() ? this.motion.directSheetTranslation() : 0,
          y: this.motion.frame().dock.translateY + (this.minimumHost.currentLayout().isExpanded() ? 0 : this.motion.directSheetTranslation()) })
        .opacity(this.motion.frame().dock.opacity * (this.motion.directSheetVisible() && this.currentFacts().geometry.reduceMotion ? this.motionPaint.visualExpansionProgress : 1))
        .position({ x: this.motion.dockLeft(), y: this.motion.presentedDockTop() })
        .onTouch((event: TouchEvent): void => this.motion.onDockPlacementTouch(event))
        // A held pointer may reach the hidden endpoint before UP. Retiring
        // its ancestor here loses UP/CANCEL and leaves the runtime held.
        .enabled(this.currentFacts().geometry.inputEnabled && (this.motion.frame().visibility > 0 || this.motionPaint.visualHeldPointerId >= 0))
          .hitTestBehavior(this.currentFacts().geometry.inputEnabled && (this.motion.frame().visibility > 0 || this.motionPaint.visualHeldPointerId >= 0) ?
          HitTestMode.Transparent : HitTestMode.None);
      }
    }
    .visibility(this.currentFacts().geometry.obscured ? Visibility.Hidden : Visibility.Visible)
    .width(this.minimumHost.currentLayout().viewportWidth)
    .height(this.minimumHost.currentLayout().viewportHeight)
    .accessibilityLevel(this.motion.frame().visibility > 0 || this.currentFacts().launch.sample !== undefined ? 'auto' : 'no-hide-descendants')
    .hitTestBehavior(HitTestMode.Transparent)
    .onAreaChange((_previous: Area, current: Area): void => {
      this.motion.panelAreaChanged(current);
    });
  }

  @Builder
  private controlContent() {
    // Only the business route changes the mounted module. Quick/Full keeps the same tree.
    Stack({ alignContent: Alignment.TopStart }) {
      if (this.minimumHost.minimumPresentationAvailable()) {
        if (this.motion.contentLocation().level === 'home') {
          Scroll() { this.homeContent(); }
            .id('reader-control-module-home')
            .width(this.motion.frame().content.width).height(this.motion.frame().content.height).edgeEffect(EdgeEffect.None)
            .enableScrollInteraction(!readerControlExtentFits(this.quickHome.homeContentMinimumHeight(), this.motion.frame().content.height));
        } else {
          // Read the observed launch publication in the render expression so the
          // live source retires with the proxy's ownership update.
          ReaderControlPanelModuleContent({ scene: this.moduleScene, launch: this.panelFrame.launch });
        }
      }
    }
    .id('reader-control-content-host')
    .width(this.motion.frame().content.width).height(this.motion.frame().content.height);
  }

  @State private quickOrModulePress: string = '';
  private quickOrModulePointer: number = -1;

  private observeQuickOrModulePress(event: TouchEvent, key: string, enabled: boolean): void {
    if (this.quickOrModulePress.length > 0 && this.quickOrModulePress !== key) return;
    const next = readerPressPointer(event, this.quickOrModulePointer, enabled);
    if (next === this.quickOrModulePointer) return;
    this.quickOrModulePointer = next;
    readerAnimatePress(this.getUIContext(), this.currentFacts().geometry.reduceMotion, (): void => { this.quickOrModulePress = next < 0 ? '' : key; });
  }

  @Builder
  private homeContent() {
    Column({ space: READER_CONTROL_HOME_SECTION_GAP }) {
      ReaderControlQuickHomeActions({ quick: this.quickHome }); this.chapterProgress();
      if (!this.minimumHost.currentLayout().topBarVisible) ReaderControlShortWindowActions({ owner: this.topBarOwner });
    }
      .width(this.motion.frame().content.width).alignItems(HorizontalAlign.Start);
  }

  private onPageBookmarkStatusChanged(): void {
    const fill = this.currentFacts().document.bookmarks.pageStatus === 'bookmarked' ? 1 : 0;
    if (fill === this.pageBookmarkFill) return;
    if (!this.motion.mounted()) { this.pageBookmarkFill = fill; return; }
    const lifecycle = this.motion.mountGeneration();
    const finish = (): void => {
      if (!this.currentFacts().geometry.reduceMotion && fill === 1 && this.motion.mounted() && this.motion.mountGeneration() === lifecycle &&
        this.pageBookmarkFill === 1) {
        this.getUIContext().animateTo(readerMotionAnimateParam('reader.control.handle.snap', false),
          (): void => { this.pageBookmarkTuck = 1; });
      }
    };
    this.getUIContext().animateTo(this.currentFacts().geometry.reduceMotion ? readerMotionReducedFadeParam() :
      readerMotionAnimateParam(fill === 1 ? 'reader.bookmark.pill.add' : 'reader.bookmark.pill.remove', false, finish), (): void => {
      this.pageBookmarkFill = fill;
      this.pageBookmarkTuck = !this.currentFacts().geometry.reduceMotion && fill === 1 ? 1.025 : 1;
    });
  }

  @Builder
  private chapterProgress() {
    ReaderControlChapterProgressCard({
      appScheme: this.appScheme, chapterTitle: this.minimumHost.presentedHomeChapterTitle(),
      titleHeight: this.quickHome.homeMetric('chapterTitleHeight', 34), titleLaneHeight: this.quickHome.chapterTitleLaneHeight(),
      cardHeight: this.quickHome.homeChapterCardHeight(), totalChapters: this.minimumHost.presentedHomeTotalChapters(),
      readableChapterPosition: this.currentFacts().document.readableChapterPosition, menuOccludesActions: this.topBarOwner.menuVisible() || this.currentFacts().geometry.temporary.layer === 'moreMenu',
      previousEnabled: this.quickHome.progressInputEnabled(true) && this.quickHome.canStepChapter(-1),
      nextEnabled: this.quickHome.progressInputEnabled(true) && this.quickHome.canStepChapter(1),
      actionScope: this.motion.controlActionScope(),
      chapterActionsCurrent: (scope: string): boolean => this.motion.controlActionScope() === scope &&
        this.quickHome.progressInputEnabled(true) && !this.topBarOwner.menuVisible() && this.currentFacts().geometry.temporary.layer === '',
      bookmarkLaneHeight: this.quickHome.bookmarkLaneHeight(), bookmarkWidth: this.quickHome.bookmarkPillWidth(), bookmarkHeight: this.quickHome.bookmarkPillHeight(),
      pageBookmarkStatus: this.currentFacts().document.bookmarks.pageStatus, pageBookmarkEnabled: this.currentFacts().document.bookmarks.pageEnabled,
      bookmarkInputEnabled: this.currentFacts().document.bookmarks.pageEnabled && this.quickHome.progressInputEnabled(true),
      quickOrModulePress: $quickOrModulePress, pageBookmarkFill: $pageBookmarkFill, pageBookmarkTuck: $pageBookmarkTuck,
      sessionFontScale: this.currentFacts().geometry.fontScale, reduceMotion: this.currentFacts().geometry.reduceMotion,
      progressPercent: this.quickHome.effectiveProgressPercent(), progressLabelWidth: this.quickHome.homeMetric('percentWidth', 26.23),
      progressLaneHeight: this.quickHome.progressLaneHeight(), progressInputRevision: this.quickHomePaint.progressInputRevision,
      onPreviousChapter: (): void => { if (this.quickHome.progressInputEnabled() && this.quickHome.canStepChapter(-1)) this.onIntent({ kind: 'previousChapter' }); },
      onNextChapter: (): void => { if (this.quickHome.progressInputEnabled() && this.quickHome.canStepChapter(1)) this.onIntent({ kind: 'nextChapter' }); },
      onBookmarkPress: (event: TouchEvent): void => this.observeQuickOrModulePress(event, 'bookmark',
        this.currentFacts().document.bookmarks.pageEnabled && this.quickHome.progressInputEnabled(true)),
      bookmarkClickHandler: (_scope: string): (() => void) => this.motion.controlActionHandler((): void => {
        if (this.currentFacts().document.bookmarks.pageEnabled && this.quickHome.progressInputEnabled()) this.onIntent({ kind: 'togglePageBookmark' });
      }),
      progressChangeHandler: (revision: number): ((value: number, mode: SliderChangeMode) => void) =>
        this.quickHome.progressChangeHandler(revision),
    });
  }

  @Builder
  private moduleNavBar() {
    ReaderControlModuleNavigation({
      appScheme: this.appScheme, activeModule: this.motion.activeNavigationModule(),
      navHeight: this.minimumHost.currentLayout().contentBudget?.navigationHeightVp ?? this.motion.nativeGeometry().moduleNavH,
      topRadius: this.motion.nativeGeometry().moduleNavRadiusTop,
      labelHeight: this.minimumHost.selectedMinimumProfile()?.navigationLabelHeight ?? 13.889,
      hasMeasuredProfile: this.minimumHost.selectedMinimumProfile() !== undefined,
      ttsUnavailable: this.currentFacts().playback.speech.state.status === 'unavailable', quickOrModulePress: $quickOrModulePress,
      reduceMotion: this.currentFacts().geometry.reduceMotion, actionEnabled: this.motion.navigationInputEnabled(true),
      actionScope: this.motion.controlActionScope(),
      onModulePress: (event: TouchEvent, module: ReaderControlNavigationModule): void =>
        this.observeQuickOrModulePress(event, module, this.motion.navigationInputEnabled(true)),
      moduleClickHandler: (module: ReaderControlNavigationModule, _scope: string): (() => void) =>
        this.motion.controlActionHandler((): void => { if (this.motion.navigationInputEnabled()) void this.motion.activateModule(module); }),
    });
  }
}
