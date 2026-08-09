import type { LocalReadingTocEntry } from './LocalReadingFlowGateway';
import type { ReaderDirectoryChapterStartBookmarkRequest } from './ReaderDirectoryMarkerState';
import {
  TOK_LINE_STRONG,
  TOK_READ_INK,
  TOK_READ_MUTED,
  TOK_READ_SURFACE,
  TOK_BORDER_W,
} from '../common/ReaderTokens';

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
  @Prop bookTitle: string = '';
  @Prop chapterTitle: string = '';
  @Prop entries: LocalReadingTocEntry[] = [];
  @Prop currentChapterIndex: number = -1;
  @Prop isTablet: boolean = false;
  // Source switch is only reachable for remote books (sourceId !== 'local');
  // local books render the top-bar 换源 affordance disabled. This is the
  // third copy of the LOCAL_SOURCE_ID sentinel (also Index.ets:70 and
  // LocalReadingFlowGateway.ts:89) — consolidated if those files are touched.
  @Prop sourceId: string = '';
  // True only for Module Directory -> Full Directory. Detail -> Directory
  // keeps its existing route semantics and does not borrow the Phone motion.
  @Prop animateFromControl: boolean = false;
  @Prop reduceMotion: boolean = false;
  // R-LOCAL-TOC-01: forward the chapter tap from the panel body to the
  // owning flow so a full-directory tap actually enters that chapter.
  onSelectChapter: (index: number) => void = (_index: number): void => {};
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
  @State private containerHeight: number = 0;
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
          isTablet: this.isTablet,
          panelHeightOverride: this.fullPanelHeight(),
          onSelectChapter: (index: number): void => this.onSelectChapter(index),
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
    }
    .width('100%')
    .height('100%')
    .onAreaChange((_oldValue: Area, newValue: Area): void => {
      const height = this.numericAreaLength(newValue.height);
      if (height > 0 && Math.abs(height - this.containerHeight) >= 0.01) {
        this.containerHeight = height;
      }
    });
  }

  @Builder
  private topBar() {
    // 自适应:外层 Row 撑满父宽,左右内边距按 Figma 视口差 (Phone 14/16, Tablet 28/30)
    // 决定内条宽度,替代固定 360/702 双尺寸表。标题宽度仍按 Figma 固定值 (titleWidth)。
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
            .width(this.titleWidth())
            .height(22)
            .fontFamily('ReaderNotoSerifSCBold')
            .fontWeight(FontWeight.Bold)
            .fontSize(16)
            .fontColor(TOK_READ_INK)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });

          Text(this.chapterTitle)
            .width(this.titleWidth())
            .height(17)
            .fontFamily('ReaderNotoSerifSCRegular')
            .fontWeight(FontWeight.Regular)
            .fontSize(12)
            .fontColor(TOK_READ_MUTED)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
        }
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
            .fontColor(TOK_READ_INK)
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
        .enabled(false)
        .accessibilityText('更多');
      }
      .width('100%')
      .height(54)
      .alignItems(VerticalAlign.Center)
      .backgroundColor(TOK_READ_SURFACE)
      .border({ width: TOK_BORDER_W, color: TOK_LINE_STRONG })
      .borderRadius(24);
    }
    .width('100%')
    .height(54)
    .padding({ left: this.topBarLeft(), right: this.topBarRight() })
    .margin({ top: 18 });
  }

  private topBarLeft(): number {
    return this.isTablet ? 28 : 14;
  }

  private topBarRight(): number {
    return this.isTablet ? 30 : 16;
  }

  private titleWidth(): number {
    return this.isTablet ? 512 : 170;
  }

  private shouldAnimatePanel(): boolean {
    // The current production motion card is Phone-specific. Tablet keeps the
    // source-backed static Full endpoint until a Tablet motion track exists.
    return this.animateFromControl && !this.isTablet && !this.reduceMotion;
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
    return this.isTablet ? 720 : 364;
  }

  private panelLeft(): number {
    return this.isTablet ? 26 : 12;
  }

  private panelViewportHeight(): number {
    if (!this.shouldAnimatePanel()) {
      return this.fullPanelHeight();
    }
    return 330 + (this.panelHeightDelta() * this.panelProgress);
  }

  private panelTop(): number {
    if (!this.shouldAnimatePanel()) {
      return 88;
    }
    // The source endpoint is bottom anchored (Figma full y=88,h=736 on an
    // unobstructed 844vp canvas). ReaderShell deliberately consumes the
    // status-bar inset, so derive the same 20vp bottom gap from the actual
    // content viewport instead of clipping the footer below the host.
    return 88 + (this.panelHeightDelta() * (1 - this.panelProgress));
  }

  private fullPanelHeight(): number {
    if (this.isTablet || this.containerHeight <= 0) {
      return this.isTablet ? 852 : 736;
    }
    return Math.max(330, this.containerHeight - 88 - 20);
  }

  private panelHeightDelta(): number {
    return Math.max(0, this.fullPanelHeight() - 330);
  }

  private numericAreaLength(value: Length): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }

  private isLocalBook(): boolean {
    return this.sourceId === 'local';
  }
}
