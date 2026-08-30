import type { LocalReadingTocEntry } from './LocalReadingFlowGateway';
import type { ReaderDirectoryChapterStartBookmarkRequest } from './ReaderDirectoryMarkerState';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import {
  readerInteractiveSafeBottom,
  readerVisualSafeLeft,
  readerVisualSafeRight,
  readerVisualSafeTop,
} from '../common/ReaderWindowMetrics';
import {
  SurfaceHorizontalFrame,
  SurfaceWidthSpec,
  resolveHorizontalFrame,
} from '../common/SurfaceHorizontalGeometry';
import {
  TOK_BORDER_W,
} from '../common/ReaderTokens';
import type { ReaderAppearanceTheme } from './ReaderAppearanceState';
import { readerThemePalette, type ReaderThemePalette } from './ReaderThemePalettes';

import { FullDirectoryPanel } from './FullDirectoryPanel';
import { registerReaderFonts } from '../common/ReaderFonts';
import { motionAnimateParam } from '../common/MotionSpec';

/**
 * The non-body layers of the two Final Reader Full Directory variants.
 *
 * The owning Index keeps ReadingExperience mounted beneath this exact
 * overlay, so this component never substitutes its own body text, PaperLayer,
 * reading position, or a local directory fixture.
 *
 * Figma source:
 * - Phone `943:11617`, Section `I943:11617;927:36` (left-14, top-18, 360×54)
 * - Tablet `943:11949`, Section `I943:11949;929:32` (left-28, top-18, 702×54)
 */
@Component
export struct ReaderFullDirectory {
  @StorageLink('readerWindowMetricsRevision') readerWindowMetricsRevision: number = 0;
  @Prop bookTitle: string = '';
  @Prop chapterTitle: string = '';
  @Prop entries: LocalReadingTocEntry[] = [];
  @Prop currentChapterIndex: number = -1;
  // Source switch is only reachable for remote books (sourceId !== 'local');
  // local books render the top-bar 换源 affordance disabled. This is the
  // third copy of the LOCAL_SOURCE_ID sentinel (also Index.ets:70 and
  // LocalReadingFlowGateway.ts:89) — consolidated if those files are touched.
  @Prop sourceId: string = '';
  // True only for Module Directory -> Full Directory. Detail -> Directory
  // keeps its existing route semantics and does not borrow the Phone motion.
  @Prop animateFromControl: boolean = false;
  @Prop reduceMotion: boolean = false;
  @Prop offlineBookOperationActive: boolean = false;
  @Prop theme: ReaderAppearanceTheme = 'day';

  private palette(): ReaderThemePalette {
    return readerThemePalette(this.theme);
  }
  // R-LOCAL-TOC-01: forward the chapter tap from the panel body to the
  // owning flow so a full-directory tap actually enters that chapter.
  onSelectChapter: (index: number) => void = (_index: number): void => {};
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
  // R-LOCAL-TOC-01: the owner decides whether collapse returns to the mounted
  // Directory Module or exits a Detail-origin directory session.
  onExit: () => void = (): void => {};

  @State private panelProgress: number = 1;
  @State private containerWidth: number = 0;
  @State private containerHeight: number = 0;
  @State private offlineMenuVisible: boolean = false;
  private animationGeneration: number = 0;
  private collapseStarted: boolean = false;

  aboutToAppear(): void {
    // Figma maps the Reader control’s Songti faces to the shipped Noto Serif
    // SC pair.  Do not fall back to a system or synthetic font here.
    registerReaderFonts(this.getUIContext().getFont());
    this.collapseStarted = false;
    this.animationGeneration += 1;
    const generation = this.animationGeneration;
    if (this.shouldAnimatePanel()) {
      this.panelProgress = 0;
      setTimeout((): void => {
        if (generation !== this.animationGeneration || this.collapseStarted) {
          return;
        }
        this.getUIContext().animateTo(motionAnimateParam('reader.panel.expand'), (): void => {
          this.panelProgress = 1;
        });
      }, 0);
    } else {
      this.panelProgress = 1;
    }
  }

  aboutToDisappear(): void {
    this.animationGeneration += 1;
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.topBar();
      Stack({ alignContent: Alignment.BottomStart }) {
        FullDirectoryPanel({
          entries: this.entries,
          currentChapterIndex: this.currentChapterIndex,
          theme: this.theme,
          chapterDownloadEnabled: this.sourceId !== 'local',
          isTablet: this.usesExpandedLayout(),
          panelWidthOverride: this.panelWidth(),
          panelHeightOverride: this.fullPanelHeight(),
          onSelectChapter: (index: number): void => this.onSelectChapter(index),
          onDownloadChapter: (index: number): void => this.onDownloadChapter(index),
          onDeleteBookmarks: (bookmarkTimes: number[]): void => this.onDeleteBookmarks(bookmarkTimes),
          chapterStartBookmarkCreationEnabled: this.chapterStartBookmarkCreationEnabled,
          onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest): void =>
            this.onCreateChapterStartBookmark(request),
          onExit: (): void => this.requestCollapse(),
        });
      }
      .width(this.panelWidth())
      .height(this.panelViewportHeight())
      .position({ x: this.panelLeft(), y: this.panelTop() })
      .opacity(this.shouldAnimatePanel() ? this.panelProgress : 1)
      .clip(true);
      this.offlineBookMenu();
    }
    .width('100%')
    .height('100%')
    .clip(true)
    .onAreaChange((_oldValue: Area, newValue: Area): void => {
      const width = this.numericAreaLength(newValue.width);
      const height = this.numericAreaLength(newValue.height);
      if (width > 0 && Math.abs(width - this.containerWidth) >= 0.01) {
        this.containerWidth = width;
      }
      if (height > 0 && Math.abs(height - this.containerHeight) >= 0.01) {
        this.containerHeight = height;
      }
    });
  }

  @Builder
  private topBar() {
    // 自适应:外层 Row 撑满父宽,左右内边距按 Figma 视口差 (Phone 14/16, Tablet 28/30)
    // 决定内条宽度；中间标题只占剩余空间，不再用固定宽度挤出视口。
    Row() {
      Row() {
        Stack({ alignContent: Alignment.Center }) {
          Image($r('app.media.reader_directory_back'))
            .width(24)
            .height(24);
        }
        .width(44)
        .height(42)
        .margin({ left: 13 })
        .accessibilityText('收起目录')
        .onClick((): void => this.requestCollapse());

        Column({ space: 6 }) {
          Text(this.bookTitle)
            .width('100%')
            .height(22)
            .fontFamily('ReaderNotoSerifSCBold')
            .fontWeight(FontWeight.Bold)
            .fontSize(16)
            .fontColor(this.palette().ink)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });

          Text(this.chapterTitle)
            .width('100%')
            .height(17)
            .fontFamily('ReaderNotoSerifSCRegular')
            .fontWeight(FontWeight.Regular)
            .fontSize(12)
            .fontColor(this.palette().inkSecondary)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
        }
        .layoutWeight(1)
        .constraintSize({ minWidth: 0 })
        .margin({ left: 8 });

        Column({ space: 3.5 }) {
          Image($r('app.media.reader_directory_switch'))
            .width(20)
            .height(20)
            .alignSelf(ItemAlign.Center)
            .margin({ top: 1.25 });
          Text('换源')
            .width(24)
            .height(15)
            .fontFamily('ReaderInter')
            .fontWeight(800)
            .fontSize(12)
            .fontColor(this.palette().ink)
            .textAlign(TextAlign.Center)
            .alignSelf(ItemAlign.Center);
        }
        .width(62)
        .height(42)
        .margin({ left: 8 })
        .opacity(this.isLocalBook() ? 0.4 : 1)
        .enabled(!this.isLocalBook())
        .accessibilityText('换源')
        .onClick((): void => {
          if (!this.isLocalBook()) {
            this.onSwitchSource();
          }
        });

        Stack({ alignContent: Alignment.Center }) {
          Image($r('app.media.reader_directory_more'))
            .width(20)
            .height(20);
        }
        .width(34)
        .height(42)
        .margin({ left: 8 })
        .opacity(this.isLocalBook() || this.offlineBookOperationActive ? 0.4 : 1)
        .enabled(!this.isLocalBook() && !this.offlineBookOperationActive)
        .accessibilityText(this.offlineBookOperationActive ? '离线操作进行中' : '离线管理')
        .onClick((): void => {
          if (!this.isLocalBook() && !this.offlineBookOperationActive) {
            this.offlineMenuVisible = !this.offlineMenuVisible;
          }
        });
      }
      .width('100%')
      .height(54)
      .alignItems(VerticalAlign.Center)
      .backgroundColor(this.palette().surface)
      .border({ width: TOK_BORDER_W, color: this.palette().lineStrong })
      .borderRadius(24);
    }
    .width('100%')
    .height(54)
    .padding({ left: this.topBarLeft(), right: this.topBarRight() })
    .margin({ top: this.topBarTop() });
  }

  @Builder
  private offlineBookMenu() {
    if (this.offlineMenuVisible && !this.isLocalBook()) {
      Column() {
        Text('下载整书')
          .width('100%')
          .height(42)
          .padding({ left: 16 })
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Medium)
          .fontSize(13)
          .fontColor(this.palette().ink)
          .textAlign(TextAlign.Start)
          .accessibilityText('下载整书')
          .onClick((): void => {
            this.offlineMenuVisible = false;
            this.onDownloadBook();
          });
        Divider()
          .color(this.palette().lineStrong)
          .strokeWidth(TOK_BORDER_W);
        Text('清除本书离线')
          .width('100%')
          .height(42)
          .padding({ left: 16 })
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Medium)
          .fontSize(13)
          .fontColor(this.palette().ink)
          .textAlign(TextAlign.Start)
          .accessibilityText('清除本书离线内容')
          .onClick((): void => {
            this.offlineMenuVisible = false;
            this.onClearBookOffline();
          });
      }
      .width(142)
      .height(85)
      .backgroundColor(this.palette().surface)
      .border({ width: TOK_BORDER_W, color: this.palette().lineStrong })
      .borderRadius(12)
      .position({ x: this.offlineMenuLeft(), y: this.topBarTop() + 56 })
      .zIndex(8);
    }
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
    return Math.max(18, readerVisualSafeTop(ReaderWindowCoordinator.metrics()));
  }

  private shouldAnimatePanel(): boolean {
    // The current production motion card is Phone-specific. Tablet keeps the
    // source-backed static Full endpoint until a Tablet motion track exists.
    return this.animateFromControl && !this.usesExpandedLayout() && !this.reduceMotion;
  }

  private requestCollapse(): void {
    if (this.collapseStarted) {
      return;
    }
    this.collapseStarted = true;
    if (!this.shouldAnimatePanel()) {
      this.onExit();
      return;
    }
    const generation = this.animationGeneration;
    this.getUIContext().animateTo(motionAnimateParam('reader.panel.collapse', (): void => {
      if (generation === this.animationGeneration) {
        this.onExit();
      }
    }), (): void => {
      this.panelProgress = 0;
    });
  }

  private panelWidth(): number {
    return this.panelFrame().width;
  }

  private panelLeft(): number {
    return this.panelFrame().left;
  }

  private panelFrame(): SurfaceHorizontalFrame {
    const metrics = ReaderWindowCoordinator.metrics();
    const spec = this.usesExpandedLayout()
      ? new SurfaceWidthSpec(720, 27, 13, 'right')
      : new SurfaceWidthSpec(364, 12, 12, 'center');
    return resolveHorizontalFrame(
      this.liveContainerWidth(),
      readerVisualSafeLeft(metrics),
      readerVisualSafeRight(metrics),
      spec,
    );
  }

  private offlineMenuLeft(): number {
    const figmaLeft = this.usesExpandedLayout() ? 548 : 206;
    return Math.max(this.topBarLeft(), Math.min(figmaLeft,
      this.liveContainerWidth() - this.topBarRight() - 142));
  }

  private panelViewportHeight(): number {
    if (!this.shouldAnimatePanel()) {
      return this.fullPanelHeight();
    }
    return this.collapsedPanelHeight() + (this.panelHeightDelta() * this.panelProgress);
  }

  private panelTop(): number {
    if (!this.shouldAnimatePanel()) {
      return this.fullPanelTop();
    }
    // The source endpoint is bottom anchored (Figma full y=88,h=736 on an
    // unobstructed 844vp canvas). ReaderShell deliberately consumes the
    // status-bar inset, so derive the same 20vp bottom gap from the actual
    // content viewport instead of clipping the footer below the host.
    return this.fullPanelTop() + (this.panelHeightDelta() * (1 - this.panelProgress));
  }

  private fullPanelHeight(): number {
    const designHeight = this.usesExpandedLayout() ? 852 : 736;
    const safeBottom = Math.max(20, readerInteractiveSafeBottom(ReaderWindowCoordinator.metrics()));
    const available = Math.max(0, this.liveContainerHeight() - this.fullPanelTop() - safeBottom);
    return Math.min(designHeight, available);
  }

  private fullPanelTop(): number {
    // Figma keeps 16vp between the 54vp top bar and the full directory sheet:
    // 18 + 54 + 16 = 88. Preserve that relationship when safeTop moves.
    return this.topBarTop() + 70;
  }

  private panelHeightDelta(): number {
    return Math.max(0, this.fullPanelHeight() - this.collapsedPanelHeight());
  }

  private collapsedPanelHeight(): number {
    return Math.min(330, this.fullPanelHeight());
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
    return this.liveContainerWidth() >= 600;
  }

  private numericAreaLength(value: Length): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }

  private isLocalBook(): boolean {
    return this.sourceId === 'local';
  }
}
