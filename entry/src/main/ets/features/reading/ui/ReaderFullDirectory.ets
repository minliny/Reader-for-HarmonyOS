import hilog from '@ohos.hilog';
import inputMethod from '@ohos.inputMethod';
import { FrameCallback } from '@kit.ArkUI';
import type { ReaderDirectoryTargetProof } from '../application/ReaderDirectoryTargetProof';
import { ReaderDirectoryRecoverySurface } from './ReaderDirectoryRecoverySurface';
import { ReaderDirectoryRules, type ReaderDirectoryRulesRecoveryProjection } from './ReaderDirectoryRules';
import { EMPTY_READING_DIRECTORY_RECOVERY, type ReadingDirectoryRecovery,
  type ReadingDirectoryMessageKind } from '../presentation/ReadingDirectoryRecovery';
import { TYPE_READER_DIRECTORY_OFFLINE_ACTION, TYPE_READER_DIRECTORY_SOURCE_ACTION } from '../../../ui/foundation/ReaderTypography';
import { ReaderReadingTopBar } from '../../../ui/chrome/ReaderReadingTopBar';
import type { RemoteReadingPositionScope } from '../application/RemoteReadingPositionMigration';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { ReaderActionAccessibility } from '../../../ui/controls/ReaderActionAccessibility';
import { ReaderRecoveryNotice } from '../../../ui/feedback/ReaderRecoveryNotice';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';
import { ReaderPanelFrame } from '../../../ui/surfaces/ReaderPanelFrame';
import { ReaderFrameStyle, readerFrameStyle } from '../../../ui/layout/ReaderFrameStyle';
import { readerIsExpandedWidth } from '../../../ui/foundation/ReaderWidthClass';
import { ReaderPageScaffold } from '../../../ui/layout/ReaderPageScaffold';
import { ReaderPageGeometry, ReaderPageGeometryInput, resolveReaderPageGeometry } from '../../../ui/layout/ReaderPageGeometry';
import { readerPageAreaLength } from '../../../ui/layout/ReaderPageShell';
import { ReaderMeasurementStore } from '../../../ui/layout/ReaderMeasurements';
import type { LocalReadingTocEntry } from '../application/LocalReadingFlowGateway';
import type { ReaderBookIdentity } from '../presentation/ReaderBookmarkProjection';
import type { ReaderDirectoryChapterStartBookmarkRequest } from '../presentation/ReaderDirectoryMarkerState';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import {
  readerInteractiveSafeBottom,
  readerVisualSafeLeft,
  readerVisualSafeRight,
  readerVisualSafeTop,
} from '../../../ui/foundation/ReaderWindowMetrics';
import {
  TOK_LINE_STRONG,
  TOK_READ_INK,
  TOK_READ_MUTED,
  TOK_BORDER_W,
} from '../../../ui/foundation/ReaderTokens';

import { isReaderLocalTxtFormat } from '../application/ReaderDirectoryNavigation';
import { consumeReaderControlKeyboardBack } from '../../../ui/foundation/ReaderKeyboardBack';
import { FullDirectoryPanel } from './FullDirectoryPanel';
import { registerReaderFonts } from '../../../ui/foundation/ReaderFonts';

interface FullDirectoryHeaderMetrics {
  readonly barHeight: number;
  readonly topGap: number;
  readonly panelGap: number;
  readonly controlHeight: number;
  readonly menuGap: number;
  readonly menuRowHeight: number;
}

interface FullDirectoryRecoveryMessageSignature {
  visible: boolean;
  generation: number;
  message: string;
  retry: boolean;
  continuing: boolean;
  busy?: boolean;
  kind?: ReadingDirectoryMessageKind;
  readback?: boolean;
}

interface FullDirectoryRulesHeaderSignature {
  identity: string;
  view: ReaderRecoveryView;
  action: string;
  secondary: string;
  busy: boolean;
}

interface FullDirectoryRecoveryHeaderSignature {
  book: string;
  source: string;
  kind: string;
  presentation: string;
  rulesVisible: boolean;
  bookmarks: FullDirectoryRecoveryMessageSignature;
  offline: FullDirectoryRecoveryMessageSignature;
  rules?: FullDirectoryRulesHeaderSignature;
}

class DirectoryRulesFocusFrame extends FrameCallback {
  private readonly focus: () => void;
  constructor(focus: () => void) { super(); this.focus = focus; }
  onFrame(_frameTimeInNano: number): void { this.focus(); }
  onIdle(_timeLeftInNano: number): void {}
}

class FullDirectoryHeaderMeasurementFrame extends FrameCallback {
  private readonly measure: () => void;
  constructor(measure: () => void) { super(); this.measure = measure; }
  onFrame(_frameTimeInNano: number): void {}
  onIdle(_timeLeftInNano: number): void { this.measure(); }
}

let fullDirectoryBackGeneration = 0;

/**
 * The non-body layers of the two Final Reader Full Directory variants.
 *
 * Detail mounts this external catalog directly, without a reading instance.
 * ReaderShell may also retain its existing reading instance beneath it. The
 * component never creates body text, a reading position, or a local fixture.
 *
 * Figma source:
 * - Phone `943:11617`, Section `I943:11617;927:36` (left-14, top-18, 360×54)
 * - Tablet `943:11949`, Section `I943:11949;929:32` (left-28, top-18, 702×54)
 */
@Component
export struct ReaderFullDirectory {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowChromeUnderlayColor') private chromeUnderlayColor: string =
    readerAppColor('app.window.background', 'day');

  @StorageLink('readerWindowMetricsRevision') @Watch('onWindowMetricsChanged') readerWindowMetricsRevision: number = 0;
  @Prop bookTitle: string = '';
  @Prop @Watch('retireDirectoryRules') bookId: string = '';
  @Prop @Watch('retireDirectoryRules') bookKind: string = '';
  @Prop chapterTitle: string = '';
  @Prop entries: LocalReadingTocEntry[] = [];
  @Prop catalogMessage: string = '';
  @Prop catalogBusy: boolean = false;
  onRetryCatalog: () => void = (): void => {};
  @Prop @Watch('onHeaderRecoveryChanged') directoryRecovery: ReadingDirectoryRecovery = EMPTY_READING_DIRECTORY_RECOVERY;
  onReconcileBookmarks: (generation: number, identity: string) => void = (): void => {};
  onContinueBookmarks: (generation: number, identity: string) => void = (): void => {};
  onReconcileOffline: (generation: number, identity: string) => void = (): void => {};
  onContinueOffline: (generation: number, identity: string) => void = (): void => {};

  @Prop currentChapterIndex: number = -1;
  @Prop @Watch('invalidateFrame') catalogContext: 'detail' | 'reader' = 'reader';
  // Source switch is only reachable for remote books (sourceId !== 'local');
  // local books render the top-bar 换源 affordance disabled. This is the
  // third copy of the LOCAL_SOURCE_ID sentinel (also Index.ets:70 and
  // LocalReadingFlowGateway.ts:89) — consolidated if those files are touched.
  @Prop @Watch('retireDirectoryRules') sourceId: string = '';
  @Prop mangaSearch: boolean = false;
  @Prop interactive: boolean = true;
  @Prop offlineBookOperationActive: boolean = false;
  isOpeningCurrent: () => boolean = (): boolean => true;
  // R-LOCAL-TOC-01: forward the chapter tap from the panel body to the
  // owning flow so a full-directory tap actually enters that chapter.
  onSelectChapter: (index: number) => void = (_index: number): void => {};
  onSelectNavigationTarget: (chapterIndex: number, chapterOffsetScalar: number, positionScope?: RemoteReadingPositionScope, directoryTargetProof?: ReaderDirectoryTargetProof) => void =
    (_chapterIndex: number, _chapterOffsetScalar: number, _positionScope?: RemoteReadingPositionScope, _directoryTargetProof?: ReaderDirectoryTargetProof): void => {};
  // Bookmark tab precise-anchor wiring: undefined keeps the panel's legacy
  // chapter-start fallback, so this stays a zero-regression opt-in.
  onSelectBookmark: ((bookmarkId: string, chapterIndex: number, chapterOffset: number, positionScope?: RemoteReadingPositionScope) => void) | undefined =
    undefined;
  // Static per-session book identity for stable bookmark ids; plain member by
  // contract (the identity never changes while the session is mounted).
  bookmarkIdentity: ReaderBookIdentity | undefined = undefined;
  onDownloadChapter: (index: number) => void = (_index: number): void => {};
  onDownloadBook: () => void = (): void => {};
  onClearBookOffline: () => void = (): void => {};
  // The owning reading session performs the Core mutation and refreshes the
  // projected TOC. This overlay only forwards exact existing bookmark ids.
  onDeleteBookmarks: (bookmarkTimes: number[]) => void = (_bookmarkTimes: number[]): void => {};
  @Prop chapterStartBookmarkCreationEnabled: boolean = false;
  onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest) => void =
    (_request: ReaderDirectoryChapterStartBookmarkRequest): void => {};
  onSwitchSource: () => void = (): void => {};
  // The original directory owner decides the route after a synchronous exit.
  onExit: () => void = (): void => {};
  onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string) => void = (): void => {};

  @State private containerWidth: number = 0;
  @State private containerHeight: number = 0;
  // Authored dimensions are inputs to the measured frame and menu placement.
  private readonly headerSpec: FullDirectoryHeaderMetrics = {
    barHeight: 54,
    topGap: 18,
    panelGap: 16,
    controlHeight: 42,
    menuGap: 2,
    menuRowHeight: 42,
  };
  @State private geometry: ReaderPageGeometry = new ReaderPageGeometry();
  @State private measurementKey: number = 0;
  @State private headerMeasuredKey: number = -1;
  private readonly headerMeasurements: ReaderMeasurementStore = new ReaderMeasurementStore();
  private headerLayoutInputs: string = '';
  private headerRecoverySignature: string = '';
  @State private offlineMenuVisible: boolean = false;
  @State private offlineMenuGeneration: number = 0;
  @State private directoryRulesOpened: boolean = false;
  @State private directoryRulesVisible: boolean = false;
  @State private directoryRulesRevision: number = 0;
  @State private directoryRulesRecovery: ReaderDirectoryRulesRecoveryProjection | undefined = undefined;
  private directoryRulesFocusGeneration: number = 0;
  @State private exitRequested: boolean = false;
  private mounted: boolean = false;
  private temporaryBackIdentity: string = '';

  aboutToAppear(): void {
    // Figma maps the Reader control’s Songti faces to the shipped Noto Serif
    // SC pair.  Do not fall back to a system or synthetic font here.
    registerReaderFonts(this.getUIContext().getFont());
    this.mounted = true;
    const identity = `full-directory:${++fullDirectoryBackGeneration}`;
    this.temporaryBackIdentity = identity;
    this.retireDirectoryRules();
    this.invalidateFrame();
    this.exitRequested = false;
    this.onTemporaryBackBridge((): boolean => this.consumeBack(identity), identity);
  }

  aboutToDisappear(): void {
    const identity = this.temporaryBackIdentity;
    this.mounted = false;
    this.offlineMenuVisible = false;
    this.temporaryBackIdentity = '';
    this.onTemporaryBackBridge(undefined, identity);
    this.headerMeasurements.clear();
  }

  @Builder
  private recoveryContent() {
    if (this.directoryRecovery.bookmarks.visible || this.directoryRecovery.offline.visible) {
      ReaderDirectoryRecoverySurface({ recovery: this.directoryRecovery,
        onReconcileBookmarks: this.onReconcileBookmarks, onContinueBookmarks: this.onContinueBookmarks,
        onReconcileOffline: this.onReconcileOffline, onContinueOffline: this.onContinueOffline });
    }
  }

  private headerRecoveryVisible(): boolean {
    return !this.directoryRulesVisible && (this.directoryRecovery.bookmarks.visible ||
      this.directoryRecovery.offline.visible || this.directoryRulesRecovery?.view.visible === true);
  }

  @Builder
  private directoryHeader() {
    if (this.usesExpandedLayout()) {
      this.topBar(this.temporaryBackIdentity, this.bookId);
    } else {
      Column({ space: 0 }) {
        Column() { this.topBar(this.temporaryBackIdentity, this.bookId); }
          .width('100%').id(`${this.temporaryBackIdentity}:topbar:${this.measurementKey}`)
          .onAreaChange(this.topBarAreaChangeHandler(this.measurementKey, this.temporaryBackIdentity));
        if (this.headerRecoveryVisible()) {
          Column({ space: 8 }) {
            this.recoveryContent();
            this.directoryRulesNotice(this.temporaryBackIdentity, this.directoryRulesRecovery);
          }.width(this.panelWidth()).alignSelf(ItemAlign.Start)
            .margin({ left: this.panelLeft() - this.topBarLeft(), top: this.headerSpec.panelGap });
        }
      }.width('100%').alignItems(HorizontalAlign.Start)
        .id(`${this.temporaryBackIdentity}:header:${this.measurementKey}`);
    }
  }

  @Builder
  private directoryOverlay() {
    if (this.usesExpandedLayout() && !this.directoryRulesVisible && (this.directoryRecovery.bookmarks.visible ||
      this.directoryRecovery.offline.visible || this.directoryRulesRecovery?.view.visible === true)) {
      Column({ space: 8 }) {
        this.recoveryContent();
        this.directoryRulesNotice(this.temporaryBackIdentity, this.directoryRulesRecovery);
      }
        .width(this.panelWidth()).position({ x: this.panelLeft(), y: this.panelTop() })
        .zIndex(8).hitTestBehavior(HitTestMode.Transparent);
    }
    this.offlineBookMenu();
  }

  build() {
    ReaderPageScaffold({
      frameStyle: this.frameStyle(),
      geometry: this.geometry, headerMeasurementKey: this.measurementKey,
      header: (): void => { this.directoryHeader(); },
      content: (): void => { this.directoryContent(this.temporaryBackIdentity, this.bookId); },
      overlayContent: (): void => { this.directoryOverlay(); },
      onHeaderHeightChange: (height: number, key: number): void => {
        if (!this.mounted || key !== this.measurementKey || height <= 0) return;
        this.acceptHeaderHeight(height, key);
      },
    }).onAreaChange((_oldValue: Area, newValue: Area): void => {
      const width = readerPageAreaLength(newValue.width);
      const height = readerPageAreaLength(newValue.height);
      this.recordViewportArea(width, height);
    }).enabled(!this.exitRequested)
      .accessibilityLevel(this.exitRequested ? 'no-hide-descendants' : 'auto');
  }

  @Builder
  private directoryContent(identity: string = this.temporaryBackIdentity, bookId: string = this.bookId) {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack({ alignContent: Alignment.BottomStart }) {
        FullDirectoryPanel({
          entries: this.entries,
          catalogMessage: this.catalogMessage,
          catalogBusy: this.catalogBusy,
          onRetryCatalog: (): void => this.onRetryCatalog(),
          currentChapterIndex: this.currentChapterIndex,
          allowUnanchoredBrowse: this.catalogContext === 'detail',
          prepareLocalTxt: this.catalogContext === 'detail' && this.sourceId === 'local' && isReaderLocalTxtFormat(this.bookKind),
          directoryRulesRevision: this.directoryRulesRevision,
          chapterActionsEnabled: this.interactive && !this.directoryRulesVisible && !this.exitRequested,
          chapterDownloadEnabled: this.sourceId !== 'local',
          mangaSearch: this.mangaSearch,
          expandedLayout: this.usesExpandedLayout(),
          panelWidthOverride: this.panelWidth(),
          panelHeightOverride: this.fullPanelHeight(),
          onSelectChapter: (index: number): void => {
            if (!this.directoryRulesVisible) this.onSelectChapter(index);
          },
          onSelectNavigationTarget: (chapterIndex: number, chapterOffsetScalar: number,
            positionScope?: RemoteReadingPositionScope, directoryTargetProof?: ReaderDirectoryTargetProof): void => {
            if (!this.directoryRulesVisible) {
              this.onSelectNavigationTarget(chapterIndex, chapterOffsetScalar, positionScope, directoryTargetProof);
            }
          },
          onSelectBookmark: this.onSelectBookmark,
          bookmarkIdentity: this.bookmarkIdentity,
          onDownloadChapter: (index: number): void => { if (this.directoryRecovery.offlineBlocked !== true) this.onDownloadChapter(index); },
          onDeleteBookmarks: (bookmarkTimes: number[]): void => this.onDeleteBookmarks(bookmarkTimes),
          chapterStartBookmarkCreationEnabled: this.chapterStartBookmarkCreationEnabled,
          onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest): void =>
            this.onCreateChapterStartBookmark(request),
          onExit: (): void => { this.consumeBack(identity); },
        });
      }
      .width(this.panelWidth())
      .height(this.panelViewportHeight())
      .position({ x: this.panelLeft(), y: this.panelTop() })
      .enabled(!this.directoryRulesVisible && this.headerLayoutReady())
      .accessibilityLevel(this.directoryRulesVisible || !this.headerLayoutReady() ? 'no-hide-descendants' : 'auto')
      .hitTestBehavior(this.directoryRulesVisible || !this.headerLayoutReady() ? HitTestMode.None : HitTestMode.Default)
      .clip(true);
      if (this.directoryRulesOpened) {
        this.directoryRulesLayer(identity, bookId);
      }
    }
    .width('100%')
    .height('100%')
    .enabled(this.headerLayoutReady())
    .accessibilityLevel(this.headerLayoutReady() ? 'auto' : 'no-hide-descendants')
    .hitTestBehavior(this.headerLayoutReady() ? HitTestMode.Default : HitTestMode.None);
  }

  private directoryRulesAvailable(): boolean {
    if (!this.isLocalBook() || this.bookId.length === 0 || !isReaderLocalTxtFormat(this.bookKind)) return false;
    let owner: ReaderRuntimeOwner;
    try { owner = ReaderRuntimeOwner.current(); } catch (_) { return false; }
    return owner.supportsCoreCapability('reading.directory.view.v2');
  }

  private directoryRulesCurrent(identity: string, bookId: string): boolean {
    return this.mounted && this.interactive && !this.exitRequested &&
      identity.length > 0 && identity === this.temporaryBackIdentity && bookId === this.bookId &&
      this.directoryRulesAvailable() && this.isOpeningCurrent();
  }

  private retireDirectoryRules(): void {
    this.directoryRulesFocusGeneration += 1;
    this.directoryRulesVisible = false;
    this.directoryRulesOpened = false;
    this.directoryRulesRecovery = undefined;
    this.directoryRulesRevision = 0;
    this.onHeaderRecoveryChanged();
  }

  private directoryRulesFocusId(identity: string, editor: boolean): string {
    return `${identity}:${editor ? 'rules-title' : 'rules-trigger'}`;
  }

  private showDirectoryRules(identity: string, bookId: string, visible: boolean): void {
    if (!this.directoryRulesCurrent(identity, bookId)) return;
    if (visible) {
      this.dismissDirectoryKeyboard(identity);
      this.directoryRulesOpened = true;
    }
    this.directoryRulesVisible = visible;
    this.onHeaderRecoveryChanged();
    const generation = ++this.directoryRulesFocusGeneration;
    this.getUIContext().postFrameCallback(new DirectoryRulesFocusFrame((): void => {
      if (generation !== this.directoryRulesFocusGeneration || visible !== this.directoryRulesVisible ||
        !this.directoryRulesCurrent(identity, bookId)) return;
      try {
        this.getUIContext().getFocusController().requestFocus(this.directoryRulesFocusId(identity, visible));
      } catch (_) {
        // A retiring focus context cannot prevent the directory transition.
      }
    }));
  }

  private admitDirectoryRulesRecovery(identity: string, bookId: string,
    recovery: ReaderDirectoryRulesRecoveryProjection | undefined): void {
    if (!this.directoryRulesCurrent(identity, bookId) || (recovery !== undefined && recovery.bookId !== bookId)) return;
    this.directoryRulesRecovery = recovery;
    this.onHeaderRecoveryChanged();
  }

  @Builder
  private directoryRulesNotice(identity: string, recovery: ReaderDirectoryRulesRecoveryProjection | undefined) {
    if (recovery !== undefined && recovery.view.visible) {
      ReaderRecoveryNotice({ view: recovery.view, tag: '目录规则',
        actionLabel: recovery.actionLabel, secondaryActionLabel: recovery.secondaryActionLabel,
        busy: recovery.busy,
        onReconcile: (generation: number): void => {
          if (this.directoryRulesCurrent(identity, recovery.bookId) &&
            recovery.identity === this.directoryRulesRecovery?.identity) recovery.onReconcile(generation);
        },
        onSecondaryAction: (generation: number): void => {
          if (this.directoryRulesCurrent(identity, recovery.bookId) &&
            recovery.identity === this.directoryRulesRecovery?.identity) recovery.onSecondaryAction(generation);
        },
      });
    }
  }

  @Builder
  private directoryRulesLayer(identity: string, bookId: string) {
    Scroll() {
      Column({ space: 8 }) {
        this.directoryRulesNotice(identity, this.directoryRulesRecovery);
        ReaderDirectoryRules({ bookId,
          interactionEnabled: this.directoryRulesVisible && this.interactive,
          focusTargetId: this.directoryRulesFocusId(identity, true),
          isPresentationCurrent: (): boolean => this.directoryRulesCurrent(identity, bookId),
          onApplied: (): void => {
            if (this.directoryRulesCurrent(identity, bookId)) this.directoryRulesRevision += 1;
          },
          onRecoveryChanged: (recovery: ReaderDirectoryRulesRecoveryProjection | undefined): void => {
            this.admitDirectoryRulesRecovery(identity, bookId, recovery);
          },
        });
      }.width('100%').alignItems(HorizontalAlign.Start);
    }.width(this.panelWidth()).height(this.panelViewportHeight())
      .position({ x: this.panelLeft(), y: this.panelTop() })
      .align(Alignment.TopStart).scrollBar(BarState.Auto)
      .attributeModifier(new ReaderPanelFrame('reader', this.appThemeScheme)).clip(true)
      .visibility(this.directoryRulesVisible ? Visibility.Visible : Visibility.None)
      .enabled(this.directoryRulesVisible && this.interactive)
      .accessibilityLevel(this.directoryRulesVisible && this.interactive ? 'auto' : 'no-hide-descendants')
      .hitTestBehavior(this.directoryRulesVisible && this.interactive ? HitTestMode.Default : HitTestMode.None);
  }


  @Builder
  private topBar(identity: string = this.temporaryBackIdentity, bookId: string = this.bookId) {
    ReaderReadingTopBar({ variant: 'directory', barHeight: this.headerSpec.barHeight,
      bookTitle: this.bookTitle, subtitle: this.chapterTitle, scheme: this.appThemeScheme,
      leading: (): void => { this.topBarBack(identity); }, trailing: (): void => { this.topBarActions(identity, bookId); },
    });
  }

  @Builder
  private topBarBack(identity: string) {
    if (this.usesExpandedLayout()) {
      Stack({ alignContent: Alignment.Center }) {
        this.topBarBackIcon();
      }
      .width(44)
      .height(this.headerSpec.controlHeight)
      .margin({ left: 13 })
      .attributeModifier(new ReaderActionAccessibility(this.directoryRulesVisible ? '返回目录' : '收起目录'))
      .onClick((): void => { this.consumeBack(identity); });
    } else {
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        this.topBarBackIcon();
      }
      .width(44)
      .height(this.headerSpec.controlHeight)
      .padding(0).borderRadius(0).backgroundColor(Color.Transparent)
      .margin({ left: 13 })
      .attributeModifier(new ReaderActionAccessibility(this.directoryRulesVisible ? '返回目录' : '收起目录', true, false, true, undefined, 'nativeButton'))
      .onClick((): void => { this.consumeBack(identity); });
    }
  }

  @Builder
  private topBarBackIcon() {
    Image((this.appThemeScheme === 'night' ? $r('app.media.reader_directory_back_theme_night') : $r('app.media.reader_directory_back')))
      .width(24).height(24)
      .accessibilityLevel(this.usesExpandedLayout() ? 'auto' : 'no');
  }

  @Builder
  private topBarActions(identity: string, bookId: string) {
    if (this.usesExpandedLayout()) {
      Column({ space: 3.5 }) {
        this.topBarSourceContent();
      }
      .width(62).height(this.headerSpec.controlHeight).margin({ left: 8 })
      .opacity(this.isLocalBook() ? 0.4 : 1)
      .attributeModifier(new ReaderActionAccessibility('换源', !this.isLocalBook()))
      .onClick((): void => { this.switchDirectorySource(); });
      Stack({ alignContent: Alignment.Center }) {
        this.topBarMoreIcon();
      }
      .width(34).height(this.headerSpec.controlHeight).margin({ left: 8 })
      .id(this.directoryRulesAvailable() ? this.directoryRulesFocusId(identity, false) : undefined)
      .opacity(!this.directoryRulesAvailable() && (this.isLocalBook() || this.offlineBookOperationActive) ? 0.4 : 1)
      .attributeModifier(new ReaderActionAccessibility(this.topBarMoreLabel(), this.topBarMoreEnabled()))
      .onClick((): void => { this.toggleTopBarMore(identity, bookId); });
    } else {
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        Column({ space: 3.5 }) {
          this.topBarSourceContent();
        }
        .width(62).height(this.headerSpec.controlHeight)
        .accessibilityLevel('no-hide-descendants');
      }
      .width(62).height(this.headerSpec.controlHeight)
      .padding(0).borderRadius(0).backgroundColor(Color.Transparent).margin({ left: 8 })
      .opacity(this.isLocalBook() ? 0.4 : 1)
      .attributeModifier(new ReaderActionAccessibility('换源', !this.isLocalBook(), false, true, undefined, 'nativeButton'))
      .onClick((): void => { this.switchDirectorySource(); });
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        this.topBarMoreIcon();
      }
      .width(34).height(this.headerSpec.controlHeight)
      .padding(0).borderRadius(0).backgroundColor(Color.Transparent).margin({ left: 8 })
      .id(this.directoryRulesAvailable() ? this.directoryRulesFocusId(identity, false) : undefined)
      .opacity(!this.directoryRulesAvailable() && (this.isLocalBook() || this.offlineBookOperationActive) ? 0.4 : 1)
      .attributeModifier(new ReaderActionAccessibility(this.topBarMoreLabel(), this.topBarMoreEnabled(), false, true, undefined, 'nativeButton'))
      .onClick((): void => { this.toggleTopBarMore(identity, bookId); });
    }
  }

  @Builder
  private topBarSourceContent() {
    Image((this.appThemeScheme === 'night' ? $r('app.media.reader_directory_switch_theme_night') : $r('app.media.reader_directory_switch')))
      .width(20)
      .height(20)
      .alignSelf(ItemAlign.Center)
      .margin({ top: 1.25 });
    Text('换源')
      .width(24)
      .height(15)
      .fontFamily(TYPE_READER_DIRECTORY_SOURCE_ACTION.fontFamily)
      .fontWeight(TYPE_READER_DIRECTORY_SOURCE_ACTION.fontWeight)
      .fontSize(TYPE_READER_DIRECTORY_SOURCE_ACTION.fontSizeFp)
      .fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme))
      .textAlign(TextAlign.Center)
      .alignSelf(ItemAlign.Center);
  }

  @Builder
  private topBarMoreIcon() {
    Image((this.appThemeScheme === 'night' ? $r('app.media.reader_directory_more_theme_night') : $r('app.media.reader_directory_more')))
      .width(20).height(20)
      .accessibilityLevel(this.usesExpandedLayout() ? 'auto' : 'no');
  }

  private switchDirectorySource(): void {
    if (this.mounted && !this.exitRequested && !this.isLocalBook()) this.onSwitchSource();
  }

  private topBarMoreLabel(): string {
    return this.directoryRulesAvailable() ?
      (this.directoryRulesVisible ? '返回目录' : '本书目录层级规则') :
      (this.offlineBookOperationActive ? '离线操作进行中' : '离线管理');
  }

  private topBarMoreEnabled(): boolean {
    return this.directoryRulesAvailable() ||
      (!this.isLocalBook() && !this.offlineBookOperationActive && this.directoryRecovery.offlineBlocked !== true);
  }

  private toggleTopBarMore(identity: string, bookId: string): void {
    if (this.directoryRulesAvailable()) {
      if (!this.directoryRulesCurrent(identity, bookId)) return;
      if (this.directoryRulesVisible) this.consumeBack(identity);
      else this.showDirectoryRules(identity, bookId, true);
      return;
    }
    if (this.mounted && !this.exitRequested && !this.isLocalBook() &&
      !this.offlineBookOperationActive && this.directoryRecovery.offlineBlocked !== true) {
      if (!this.offlineMenuVisible) this.offlineMenuGeneration += 1;
      this.offlineMenuVisible = !this.offlineMenuVisible;
    }
  }

  @Builder
  private offlineBookMenu() {
    if (this.offlineMenuVisible && !this.isLocalBook()) {
      Column() {
        this.offlineBookMenuRow('下载整书', '下载整书', this.offlineBookAction(this.offlineMenuGeneration, this.onDownloadBook));
        Divider()
          .color(readerAppColor('TOK_LINE_STRONG', this.appThemeScheme))
          .strokeWidth(TOK_BORDER_W);
        this.offlineBookMenuRow('清除本书离线', '清除本书离线内容', this.offlineBookAction(this.offlineMenuGeneration, this.onClearBookOffline));
      }
      .width(142)
      .height(85)
      .attributeModifier(new ReaderPanelFrame('reader-menu', this.appThemeScheme))
      .position({ x: this.offlineMenuLeft(), y: this.offlineMenuTop() })
      .zIndex(8);
    }
  }

  @Builder
  private offlineBookMenuRow(label: string, accessibilityLabel: string, action: () => void) {
    if (this.usesExpandedLayout()) {
      Text(label)
        .width('100%').height(this.headerSpec.menuRowHeight).padding({ left: 16 })
        .fontFamily(TYPE_READER_DIRECTORY_OFFLINE_ACTION.fontFamily)
        .fontWeight(TYPE_READER_DIRECTORY_OFFLINE_ACTION.fontWeight)
        .fontSize(TYPE_READER_DIRECTORY_OFFLINE_ACTION.fontSizeFp)
        .fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme)).textAlign(TextAlign.Start)
        .attributeModifier(new ReaderActionAccessibility(accessibilityLabel)).onClick(action);
    } else {
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        Text(label)
          .width('100%').height(this.headerSpec.menuRowHeight).padding({ left: 16 })
          .fontFamily(TYPE_READER_DIRECTORY_OFFLINE_ACTION.fontFamily)
          .fontWeight(TYPE_READER_DIRECTORY_OFFLINE_ACTION.fontWeight)
          .fontSize(TYPE_READER_DIRECTORY_OFFLINE_ACTION.fontSizeFp)
          .fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme)).textAlign(TextAlign.Start)
          .accessibilityLevel('no');
      }
      .width('100%').height(this.headerSpec.menuRowHeight)
      .padding(0).borderRadius(0).backgroundColor(Color.Transparent)
      .attributeModifier(new ReaderActionAccessibility(accessibilityLabel, true, false, true, undefined, 'nativeButton')).onClick(action);
    }
  }

  private offlineBookAction(generation: number, action: () => void): () => void {
    return (): void => {
      if (!this.mounted || this.exitRequested || !this.offlineMenuVisible || generation !== this.offlineMenuGeneration) return;
      this.offlineMenuVisible = false;
      if (!this.isLocalBook() && !this.offlineBookOperationActive && this.directoryRecovery.offlineBlocked !== true) action();
    };
  }

  private topBarLeft(): number {
    const metrics = ReaderWindowCoordinator.metrics();
    return Math.max(this.usesExpandedLayout() ? 28 : 14, readerVisualSafeLeft(metrics));
  }

  private topBarRight(): number {
    const metrics = ReaderWindowCoordinator.metrics();
    return Math.max(this.usesExpandedLayout() ? 30 : 16, readerVisualSafeRight(metrics));
  }

  private topBarTop(): number {
    if (this.readerWindowMetricsRevision < 0) return this.headerSpec.topGap;
    if (this.catalogContext === 'detail') return this.headerSpec.topGap;
    return Math.max(this.headerSpec.topGap, readerVisualSafeTop(ReaderWindowCoordinator.metrics()));
  }

  private requestExit(): void {
    if (!this.mounted || this.exitRequested) {
      return;
    }
    this.exitRequested = true;
    this.onExit();
  }

  private dismissDirectoryKeyboard(identity: string): boolean {
    return consumeReaderControlKeyboardBack(ReaderWindowCoordinator.metrics(), {
      hideTextInput: (): Promise<void> => inputMethod.getController().hideTextInput(),
      onFailure: (error: Error): void => {
        if (this.mounted && identity === this.temporaryBackIdentity) {
          hilog.warn(0x5244, 'Reader', 'Directory keyboard dismissal: %{private}s', error.message);
        }
      },
    });
  }

  private consumeBack(identity: string): boolean {
    if (!this.mounted || !this.interactive || identity.length === 0 || identity !== this.temporaryBackIdentity ||
      !this.isOpeningCurrent()) return false;
    if (this.dismissDirectoryKeyboard(identity)) return true;
    if (this.directoryRulesVisible) this.showDirectoryRules(identity, this.bookId, false);
    else if (this.offlineMenuVisible) this.offlineMenuVisible = false;
    else this.requestExit();
    return true;
  }

  private panelWidth(): number {
    return this.liveContainerWidth() > 0 ? this.geometry.content.frame.width : 0;
  }

  private panelLeft(): number {
    return this.liveContainerWidth() > 0 ? this.geometry.content.frame.left : 0;
  }

  private offlineMenuLeft(): number {
    const figmaLeft = this.usesExpandedLayout() ? 548 : 206;
    return Math.max(this.topBarLeft(), Math.min(figmaLeft,
      this.liveContainerWidth() - this.topBarRight() - 142));
  }

  private offlineMenuTop(): number {
    if (this.usesExpandedLayout()) return this.geometry.header.bottom + this.headerSpec.menuGap;
    const topBarHeight = this.headerMeasurements.readForGeneration('fullDirectory:topbar', this.measurementKey,
      this.headerSpec.barHeight);
    return this.geometry.header.top + topBarHeight + this.headerSpec.menuGap;
  }

  private panelViewportHeight(): number {
    return this.fullPanelHeight();
  }

  private panelTop(): number {
    return this.fullPanelTop();
  }

  private frameStyle(): ReaderFrameStyle {
    const pageBackground = this.catalogContext === 'detail' ?
      readerAppColor('app.window.background', this.appThemeScheme) : this.chromeUnderlayColor;
    return readerFrameStyle({ backgroundColor: pageBackground, headerBackground: pageBackground,
      headerTransparent: true, footerBackground: pageBackground });
  }

  private fullPanelHeight(): number {
    const designHeight = this.usesExpandedLayout() ? 852 : 736;
    const safeBottom = Math.max(20, readerInteractiveSafeBottom(ReaderWindowCoordinator.metrics()));
    const available = Math.max(0, this.liveContainerHeight() - this.fullPanelTop() - safeBottom);
    return Math.min(designHeight, available);
  }

  private onHeaderRecoveryChanged(): void {
    if (!this.mounted || this.usesExpandedLayout()) return;
    const bookmarks = this.directoryRecovery.bookmarks;
    const offline = this.directoryRecovery.offline;
    const rules = this.directoryRulesRecovery;
    const bookmarksSignature: FullDirectoryRecoveryMessageSignature = {
        visible: bookmarks.visible, generation: bookmarks.generation, message: bookmarks.message,
        retry: bookmarks.canRetry, continuing: this.directoryRecovery.canContinueBookmarks,
        busy: this.directoryRecovery.bookmarksBusy, kind: this.directoryRecovery.bookmarksKind,
        readback: this.directoryRecovery.bookmarksReadbackFailed };
    const offlineSignature: FullDirectoryRecoveryMessageSignature = {
        visible: offline.visible, generation: offline.generation, message: offline.message,
        retry: offline.canRetry, continuing: this.directoryRecovery.canContinueOffline,
        busy: this.directoryRecovery.offlineBusy, kind: this.directoryRecovery.offlineKind,
        readback: this.directoryRecovery.offlineReadbackFailed };
    const rulesSignature: FullDirectoryRulesHeaderSignature | undefined = rules === undefined ? undefined : {
      identity: rules.identity, view: rules.view, action: rules.actionLabel,
      secondary: rules.secondaryActionLabel, busy: rules.busy };
    const headerSignature: FullDirectoryRecoveryHeaderSignature = {
      book: this.bookId, source: this.sourceId, kind: this.bookKind,
      presentation: this.directoryRecovery.presentationId, rulesVisible: this.directoryRulesVisible,
      bookmarks: bookmarksSignature, offline: offlineSignature, rules: rulesSignature };
    const signature = JSON.stringify(headerSignature);
    if (signature === this.headerRecoverySignature) return;
    this.headerRecoverySignature = signature;
    this.invalidateFrame();
  }

  private acceptHeaderHeight(height: number, key: number): void {
    if (!this.mounted || key !== this.measurementKey || !Number.isFinite(height) || height <= 0) return;
    const changed = this.headerMeasurements.record('fullDirectory:header', height, key, .1);
    this.headerMeasuredKey = key;
    if (changed) this.refreshGeometry();
  }

  private acceptTopBarHeight(height: number, key: number): void {
    if (!this.mounted || this.usesExpandedLayout() || key !== this.measurementKey ||
      !Number.isFinite(height) || height <= 0) return;
    if (this.headerMeasurements.record('fullDirectory:topbar', height, key, .1)) this.refreshGeometry();
  }

  private topBarAreaChangeHandler(key: number, identity: string): (_old: Area, next: Area) => void {
    return (_old: Area, next: Area): void => {
      if (identity !== this.temporaryBackIdentity) return;
      this.acceptTopBarHeight(readerPageAreaLength(next.height), key);
    };
  }

  private scheduleHeaderMeasurement(): void {
    if (this.usesExpandedLayout() || this.temporaryBackIdentity.length === 0) return;
    const key = this.measurementKey, identity = this.temporaryBackIdentity;
    try {
      this.getUIContext().postFrameCallback(new FullDirectoryHeaderMeasurementFrame((): void => {
        if (!this.mounted || key !== this.measurementKey || identity !== this.temporaryBackIdentity ||
          this.usesExpandedLayout()) return;
        try {
          const context = this.getUIContext();
          const topBar = context.getComponentUtils().getRectangleById(`${identity}:topbar:${key}`);
          const header = context.getComponentUtils().getRectangleById(`${identity}:header:${key}`);
          if (topBar.size.width <= 0 || header.size.width <= 0) return;
          this.acceptTopBarHeight(context.px2vp(topBar.size.height), key);
          // This natural Column has the same height as the transparent,
          // unpadded HeaderHost; it is not a second geometry owner. A fresh
          // rectangle also acknowledges a key whose height did not change.
          this.acceptHeaderHeight(context.px2vp(header.size.height), key);
        } catch (_) { /* A removed native node cannot admit another opening. */ }
      }));
    } catch (_) { /* The existing native area receipt remains authoritative. */ }
  }

  private headerLayoutReady(): boolean {
    return this.usesExpandedLayout() || this.headerMeasuredKey === this.measurementKey;
  }

  private headerLayoutInputKey(): string {
    const metrics = ReaderWindowCoordinator.metrics();
    return [this.liveContainerWidth(), this.topBarLeft(), this.topBarRight(),
      metrics.densityPixels, metrics.systemFontScale].join('|');
  }

  private onWindowMetricsChanged(): void {
    if (!this.mounted) return;
    if (this.headerLayoutInputs !== this.headerLayoutInputKey()) this.invalidateFrame();
    else this.refreshGeometry();
  }

  private recordViewportArea(width: number, height: number): void {
    if (!this.mounted || !Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return;
    if (Math.abs(width - this.containerWidth) < .1 && Math.abs(height - this.containerHeight) < .1) return;
    this.containerWidth = width;
    this.containerHeight = height;
    this.onWindowMetricsChanged();
  }

  private invalidateFrame(): void {
    if (!this.mounted) return;
    this.headerLayoutInputs = this.headerLayoutInputKey();
    this.measurementKey += 1;
    this.refreshGeometry();
    this.scheduleHeaderMeasurement();
  }

  private refreshGeometry(): void {
    const metrics = ReaderWindowCoordinator.metrics();
    const input = new ReaderPageGeometryInput(metrics);
    input.viewportWidth = this.liveContainerWidth();
    input.viewportHeight = this.liveContainerHeight();
    input.measurementRevision = this.measurementKey;
    input.headerTop = this.topBarTop();
    input.headerHeight = this.headerMeasurements.readForGeneration('fullDirectory:header', this.measurementKey,
      this.headerSpec.barHeight);
    input.headerInsetLeft = this.topBarLeft();
    input.headerInsetRight = this.topBarRight();
    input.contentGap = this.headerSpec.panelGap;
    const expanded = this.usesExpandedLayout();
    input.contentMaxWidth = expanded ? 720 : 364;
    input.contentLeftGap = expanded ? 27 : 12;
    input.contentRightGap = expanded ? 13 : 12;
    input.contentAlignment = expanded ? 'right' : 'center';
    this.geometry = resolveReaderPageGeometry(input);
  }

  private fullPanelTop(): number {
    return this.geometry.content.startInset;
  }

  private liveContainerWidth(): number {
    if (this.containerWidth > 0) {
      return this.containerWidth;
    }
    if (this.readerWindowMetricsRevision < 0) {
      return 0;
    }
    const width = ReaderWindowCoordinator.metrics().windowRect.width;
    return Number.isFinite(width) && width > 0 ? width : 0;
  }

  private liveContainerHeight(): number {
    if (this.containerHeight > 0) {
      return this.containerHeight;
    }
    if (this.readerWindowMetricsRevision < 0) {
      return 0;
    }
    const height = ReaderWindowCoordinator.metrics().windowRect.height;
    return Number.isFinite(height) && height > 0 ? height : 0;
  }

  private usesExpandedLayout(): boolean {
    return readerIsExpandedWidth(this.liveContainerWidth());
  }

  private isLocalBook(): boolean {
    return this.sourceId === 'local';
  }
}
