import { registerReaderFonts } from '../common/ReaderFonts';
import { TOK_BORDER_W } from '../common/ReaderTokens';
import type { ReaderAppearanceSnapshot } from './ReaderAppearanceState';
import { createDefaultReaderAppearanceSnapshot } from './ReaderAppearanceState';
import { readerThemePalette, type ReaderThemePalette } from './ReaderThemePalettes';
import type { ReaderAutoPageStatus } from './ReaderAutoPageState';
import {
  formatReaderAutoPageFullWheelValue,
  READER_AUTO_PAGE_FULL_MAX_MINUTES,
  READER_AUTO_PAGE_FULL_MAX_SECONDS,
  READER_AUTO_PAGE_FULL_MAX_SPEED_SECONDS,
  READER_AUTO_PAGE_FULL_MIN_MINUTES,
  READER_AUTO_PAGE_FULL_MIN_SECONDS,
  READER_AUTO_PAGE_FULL_MIN_SPEED_SECONDS,
} from './ReaderAutoPageFullState';
import {
  READER_AUTO_PAGE_ADDED_CONTROL_TITLE_TRANSLATE_Y,
  READER_AUTO_PAGE_ADDED_DETAILS_TITLE_TRANSLATE_Y,
  READER_AUTO_PAGE_ADDED_FOLLOW_HIGHLIGHT_TRANSLATE_Y,
  READER_AUTO_PAGE_ADDED_HEADER_TRANSLATE_Y,
  READER_AUTO_PAGE_ADDED_TIMER_TRANSLATE_Y,
  READER_AUTO_PAGE_COLLAPSED_BACK_TRANSLATE_Y,
  READER_AUTO_PAGE_COLLAPSED_CHAPTER_WIDTH,
  READER_AUTO_PAGE_COLLAPSED_PLAY_HEIGHT,
  READER_AUTO_PAGE_COLLAPSED_PLAY_WIDTH,
  READER_AUTO_PAGE_COLLAPSED_SPEED_HEIGHT,
  READER_AUTO_PAGE_COLLAPSED_SPEED_WIDTH,
  READER_AUTO_PAGE_CONTROL_SECTION_HEIGHT,
  READER_AUTO_PAGE_DETAILS_SECTION_HEIGHT,
  READER_AUTO_PAGE_DETAILS_SECTION_Y,
  READER_AUTO_PAGE_EXPANDED_CHAPTER_WIDTH,
  READER_AUTO_PAGE_EXPANDED_PLAY_HEIGHT,
  READER_AUTO_PAGE_EXPANDED_PLAY_WIDTH,
  READER_AUTO_PAGE_EXPANDED_SPEED_HEIGHT,
  READER_AUTO_PAGE_EXPANDED_SPEED_WIDTH,
  READER_AUTO_PAGE_FULL_BODY_HEIGHT,
  READER_AUTO_PAGE_FULL_BODY_WIDTH,
  READER_AUTO_PAGE_FULL_BODY_X,
  READER_AUTO_PAGE_FULL_BODY_Y,
  READER_AUTO_PAGE_FULL_CONTENT_HEIGHT,
  READER_AUTO_PAGE_FULL_CONTENT_WIDTH,
  READER_AUTO_PAGE_FULL_CONTENT_X,
  READER_AUTO_PAGE_FULL_CONTENT_Y,
  READER_AUTO_PAGE_FULL_GRABBER_HEIGHT,
  READER_AUTO_PAGE_FULL_GRABBER_WIDTH,
  READER_AUTO_PAGE_FULL_GRABBER_X,
  READER_AUTO_PAGE_FULL_GRABBER_Y,
  READER_AUTO_PAGE_FULL_HEADER_WIDTH,
  READER_AUTO_PAGE_FULL_HEADER_X,
  READER_AUTO_PAGE_FULL_HEADER_Y,
  READER_AUTO_PAGE_FULL_HEIGHT,
  READER_AUTO_PAGE_FULL_WIDTH,
  READER_AUTO_PAGE_PERSISTENT_NEXT_TRANSLATE_X,
  READER_AUTO_PAGE_PERSISTENT_NEXT_TRANSLATE_Y,
  READER_AUTO_PAGE_PERSISTENT_PLAY_LABEL_TRANSLATE_X,
  READER_AUTO_PAGE_PERSISTENT_PLAY_LABEL_TRANSLATE_Y,
  READER_AUTO_PAGE_PERSISTENT_PLAY_TRANSLATE_X,
  READER_AUTO_PAGE_PERSISTENT_PLAY_TRANSLATE_Y,
  READER_AUTO_PAGE_PERSISTENT_PREVIOUS_TRANSLATE_X,
  READER_AUTO_PAGE_PERSISTENT_PREVIOUS_TRANSLATE_Y,
  READER_AUTO_PAGE_PERSISTENT_SPEED_TRANSLATE_X,
  READER_AUTO_PAGE_PERSISTENT_SPEED_TRANSLATE_Y,
  READER_AUTO_PAGE_PERSISTENT_STOP_TRANSLATE_X,
  READER_AUTO_PAGE_PERSISTENT_STOP_TRANSLATE_Y,
  READER_AUTO_PAGE_TIMER_SECTION_HEIGHT,
  READER_AUTO_PAGE_TIMER_SECTION_Y,
} from './ReaderAutoPageMotionGeometry';

/**
 * Figma Full Auto Page sheet / Phone only.
 *
 * Static sources:
 * - Phone final page `1771:10277`
 * - Full panel instance `1771:10280`
 * - Content master `1764:10223`
 *
 * Motion sources `1938:6245` and `1979:21744` coordinate sixteen actors
 * spanning the Quick sheet, Full sheet, BrightnessRail, ModuleNav, and Back.
 * `ReaderControlPanel` owns the shared registry and production timing. This
 * component exposes the thirteen sheet-local actors; the owner supplies one
 * expansion endpoint so the source tracks remain individually addressable.
 *
 * Figma contains no Tablet Full Auto Page master. When `isTablet` is true the
 * component deliberately emits no layout instead of scaling the Phone sheet.
 */
@Component
export struct ReaderAutoPageFullPanel {
  @Prop isTablet: boolean = false;
  @Prop availableWidth: number = 0;
  @Prop availableHeight: number = 0;
  @Prop status: ReaderAutoPageStatus = 'stopped';
  @Prop timerSummaryText: string = '15:00';
  @Prop timerMinutes: number = 15;
  @Prop timerSeconds: number = 0;
  @Prop speedSeconds: number = 8;
  @Prop followHighlight: boolean = false;
  /** True only while mounted inside ReaderControlPanel's unified sheet actor. */
  @Prop embeddedInUnifiedSurface: boolean = false;
  /** False is the exact Quick endpoint; true is the exact Phone Full endpoint. */
  @Prop motionExpanded: boolean = true;
  @Prop interactionEnabled: boolean = true;
  @Prop appearanceSnapshot: ReaderAppearanceSnapshot = createDefaultReaderAppearanceSnapshot();

  private palette(): ReaderThemePalette {
    return readerThemePalette(this.appearanceSnapshot.activeTheme);
  }
  @State private speedPreviewSeconds: number = -1;

  onCollapse: () => void = (): void => {};
  onPreviousChapter: () => void = (): void => {};
  onToggleRunning: () => void = (): void => {};
  onStop: () => void = (): void => {};
  onNextChapter: () => void = (): void => {};
  onTimerChange: (minutes: number, seconds: number) => void =
    (_minutes: number, _seconds: number): void => {};
  onSpeedChange: (seconds: number) => void = (_seconds: number): void => {};
  onFollowHighlightChange: (enabled: boolean) => void = (_enabled: boolean): void => {};

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    if (!this.isTablet) {
      this.phonePanel();
    }
  }

  @Builder
  private phonePanel() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row()
        .width(READER_AUTO_PAGE_FULL_GRABBER_WIDTH)
        .height(READER_AUTO_PAGE_FULL_GRABBER_HEIGHT)
        .backgroundColor(this.palette().handle)
        .borderRadius(999)
        .position({ x: this.grabberX(), y: READER_AUTO_PAGE_FULL_GRABBER_Y });

      this.header();

      // OutgoingActor/Back is part of both source timelines even though it
      // does not exist in the Full static endpoint. Keep it in this registry
      // at its Quick coordinates and drive only the source opacity/y track.
      this.collapsedBackActor();

      Scroll() {
        Stack({ alignContent: Alignment.TopStart }) {
          Row()
            .width(this.bodyWidth())
            .height(READER_AUTO_PAGE_FULL_BODY_HEIGHT)
            .backgroundColor(this.palette().surfacePanelSoft)
            .border({ width: TOK_BORDER_W, color: this.palette().borderSoft })
            .borderRadius(12)
            .position({ x: this.bodyX(), y: 0 });

          Stack({ alignContent: Alignment.TopStart }) {
            this.controlSection();
            this.timerSection();
            this.detailsSection();
          }
          .width(this.contentWidth())
          .height(READER_AUTO_PAGE_FULL_CONTENT_HEIGHT)
          .position({
            x: this.contentX(),
            y: READER_AUTO_PAGE_FULL_CONTENT_Y - READER_AUTO_PAGE_FULL_BODY_Y,
          });
        }
        .width(this.panelWidth())
        .height(READER_AUTO_PAGE_FULL_BODY_HEIGHT);
      }
      .width(this.panelWidth())
      .height(this.bodyViewportHeight())
      .position({ x: 0, y: READER_AUTO_PAGE_FULL_BODY_Y })
      .scrollBar(BarState.Off)
      .edgeEffect(EdgeEffect.None);
    }
    .width(this.panelWidth())
    .height(this.panelHeight())
    .backgroundColor(this.embeddedInUnifiedSurface ? Color.Transparent : this.palette().surface)
    .border({
      width: this.embeddedInUnifiedSurface ? 0 : TOK_BORDER_W,
      color: this.palette().lineStrong,
    })
    .borderRadius(this.embeddedInUnifiedSurface ? 0 : 24)
    .clip(true)
    .enabled(this.interactionEnabled);
  }

  @Builder
  private header() {
    Row() {
      Row({ space: 8 }) {
        Image($r('app.media.reader_auto_full_header'))
          .width(16)
          .height(16);
        Text('自动翻页')
          .width(56)
          .height(17)
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(14)
          .lineHeight(16.8)
          .fontColor(this.palette().ink)
          .maxLines(1);
      }
      .layoutWeight(1)
      .constraintSize({ maxWidth: 286 })
      .height(30)
      .alignItems(VerticalAlign.Center);

      Text('收起')
        .width(40)
        .height(26)
          .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(10)
        .lineHeight(13)
        .fontColor(this.palette().primary)
        .textAlign(TextAlign.Center)
        .backgroundColor(this.palette().surfacePanelSoft)
        .borderRadius(8)
        .accessibilityText('收起自动翻页完整控制')
        .onClick((): void => this.onCollapse());
    }
    .width(this.headerWidth())
    .height(30)
    .alignItems(VerticalAlign.Center)
    .position({ x: this.headerX(), y: READER_AUTO_PAGE_FULL_HEADER_Y })
    .opacity(this.addedActorOpacity())
    .translate({ y: this.addedActorTranslateY(READER_AUTO_PAGE_ADDED_HEADER_TRANSLATE_Y) });
  }

  @Builder
  private collapsedBackActor() {
    Row({ space: 4 }) {
      Image($r('app.media.reader_quick_back'))
        .width(11)
        .height(11);
      Text('返回')
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(10)
        .lineHeight(10)
        .fontColor(this.palette().primary);
    }
    .height(24)
    .padding({ left: 9, right: 9 })
    .backgroundColor(this.palette().surfacePanelSoft)
    .borderRadius(8)
    .alignItems(VerticalAlign.Center)
    .position({ x: 23.44, y: 41 })
    .opacity(this.outgoingActorOpacity())
    .translate({ y: this.outgoingActorTranslateY(READER_AUTO_PAGE_COLLAPSED_BACK_TRANSLATE_Y) })
    .enabled(false)
    .accessibilityText('返回阅读控制首页');
  }

  @Builder
  private controlSection() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row() {
        Text('自动翻页控制')
          .layoutWeight(1)
          .constraintSize({ maxWidth: 268 })
          .height(14.4)
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(12)
          .lineHeight(14.4)
          .fontColor(this.palette().ink)
          .maxLines(1);
        Text('未开始')
          .width(30)
          .height(14)
          .margin({ left: 8 })
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Medium)
          .fontSize(10)
          .lineHeight(12)
          .fontColor(this.palette().inkSecondary)
          .textAlign(TextAlign.End)
          .maxLines(1);
      }
      .width(this.sectionInnerWidth())
      .height(14.4)
      .position({ x: 4, y: 10 })
      .opacity(this.addedActorOpacity())
      .translate({ y: this.addedActorTranslateY(READER_AUTO_PAGE_ADDED_CONTROL_TITLE_TRANSLATE_Y) });

      Stack({ alignContent: Alignment.TopStart }) {
        this.chapterButton(true);
        this.runningButton();
        this.stopButton();
        this.chapterButton(false);
      }
      .width(this.sectionInnerWidth())
      .height(62)
      .borderRadius(8)
      .clip(true)
      .position({ x: 4, y: 32.4 });
    }
    .width(this.contentWidth())
    .height(READER_AUTO_PAGE_CONTROL_SECTION_HEIGHT)
    .position({ x: 0, y: 0 });
  }

  @Builder
  private chapterButton(previous: boolean) {
    Column() {
      Stack({ alignContent: Alignment.TopStart }) {
        Image($r(previous ?
          'app.media.reader_auto_full_chevron_left' : 'app.media.reader_auto_full_chevron_right'))
          .width(16)
          .height(16)
          .position({ x: 3, y: 5.5 });
        Image($r(previous ?
          'app.media.reader_auto_full_chevron_left' : 'app.media.reader_auto_full_chevron_right'))
          .width(16)
          .height(16)
          .position({ x: 8, y: 5.5 });
      }
      .width(27)
      .height(27)
      .backgroundColor(this.palette().surfaceElevated)
      .borderRadius(8);

      Text(previous ? '上一章' : '下一章')
        .width(27)
        .height(9)
        .margin({ top: 7 })
          .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(9)
        .lineHeight(9)
        .fontColor(this.palette().ink)
        .textAlign(TextAlign.Center)
        .maxLines(1);
    }
    .width(this.persistentChapterWidth())
    .height(52)
    .alignItems(HorizontalAlign.Center)
    .position({ x: this.persistentChapterX(previous), y: 5 })
    .translate({
      x: this.persistentChapterTranslateX(previous),
      y: this.persistentActorTranslateY(previous ? READER_AUTO_PAGE_PERSISTENT_PREVIOUS_TRANSLATE_Y :
        READER_AUTO_PAGE_PERSISTENT_NEXT_TRANSLATE_Y),
    })
    .accessibilityText(previous ? '上一章' : '下一章')
    .onClick((): void => {
      if (previous) {
        this.onPreviousChapter();
      } else {
        this.onNextChapter();
      }
    });
  }

  @Builder
  private runningButton() {
    Column() {
      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.reader_auto_full_play'))
          .width(20)
          .height(20);
      }
      .width(32)
      .height(32)
      .backgroundColor(this.palette().primary)
      .borderRadius(16);

      Text('自动翻页')
        .width(36)
        .height(9)
        .margin({ top: 4.5 })
          .fontFamily('ReaderInter')
        .fontWeight(800)
        .fontSize(9)
        .lineHeight(9)
        .fontColor(this.palette().ink)
        .textAlign(TextAlign.Center)
        .maxLines(1)
        .translate({
          x: this.persistentActorTranslateX(READER_AUTO_PAGE_PERSISTENT_PLAY_LABEL_TRANSLATE_X),
          y: this.persistentActorTranslateY(READER_AUTO_PAGE_PERSISTENT_PLAY_LABEL_TRANSLATE_Y),
        });
    }
    .width(this.persistentPlayWidth())
    .height(this.persistentPlayHeight())
    .alignItems(HorizontalAlign.Center)
    .position({ x: 105.49, y: 5 })
    .translate({
      x: this.persistentActorTranslateX(READER_AUTO_PAGE_PERSISTENT_PLAY_TRANSLATE_X),
      y: this.persistentActorTranslateY(READER_AUTO_PAGE_PERSISTENT_PLAY_TRANSLATE_Y),
    })
    .accessibilityText(this.status === 'running' ? '暂停自动翻页' :
      (this.status === 'paused' ? '继续自动翻页' : '开始自动翻页'))
    .onClick((): void => this.onToggleRunning());
  }

  @Builder
  private stopButton() {
    Column() {
      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.reader_auto_full_stop'))
          .width(17)
          .height(17);
      }
      .width(24)
      .height(24)
      .borderRadius(12)
      .translate({
        x: this.persistentActorTranslateX(READER_AUTO_PAGE_PERSISTENT_STOP_TRANSLATE_X),
        y: this.persistentActorTranslateY(READER_AUTO_PAGE_PERSISTENT_STOP_TRANSLATE_Y),
      });
      Text('停止')
        .width(18)
        .height(9)
        .margin({ top: 4.5 })
          .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(9)
        .lineHeight(9)
        .fontColor(this.palette().error)
        .textAlign(TextAlign.Center)
        .maxLines(1)
        .translate({
          x: this.persistentActorTranslateX(READER_AUTO_PAGE_PERSISTENT_STOP_TRANSLATE_X),
          y: this.persistentActorTranslateY(READER_AUTO_PAGE_PERSISTENT_STOP_TRANSLATE_Y),
        });
    }
    .width(24)
    .height(42)
    .alignItems(HorizontalAlign.Center)
    .position({ x: 188.66, y: 15.5 })
    .accessibilityText('停止自动翻页')
    .onClick((): void => this.onStop());
  }

  @Builder
  private timerSection() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row() {
        Text('定时')
          .layoutWeight(1)
          .constraintSize({ maxWidth: 270.2 })
          .height(14.4)
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(12)
          .lineHeight(14.4)
          .fontColor(this.palette().ink)
          .maxLines(1);
        Text(this.timerSummaryText)
          .width(27.8)
          .height(12)
          .margin({ left: 8 })
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Medium)
          .fontSize(10)
          .lineHeight(12)
          .fontColor(this.palette().inkSecondary)
          .textAlign(TextAlign.End)
          .maxLines(1);
      }
      .width(this.sectionInnerWidth())
      .height(14.4)
      .position({ x: 4, y: 11 });

      Stack({ alignContent: Alignment.TopStart }) {
        Row({ space: 8 }) {
          Stack({ alignContent: Alignment.Center }) {
            Image($r('app.media.reader_auto_full_clock'))
              .width(18)
              .height(18);
          }
          .width(30)
          .height(30)
          .borderRadius(15);
          Text('自动停止')
          .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Bold)
            .fontSize(11)
            .lineHeight(11)
            .fontColor(this.palette().ink)
            .maxLines(1);
        }
        .width(84)
        .height(30)
        .alignItems(VerticalAlign.Center)
        .position({ x: 15, y: 54 });

        Stack({ alignContent: Alignment.TopStart }) {
          this.timerWheel(true);
          Text(':')
            .width(8)
            .height(22)
          .fontFamily('ReaderInter')
            .fontWeight(800)
            .fontSize(18)
            .lineHeight(22)
            .fontColor(this.palette().primary)
            .textAlign(TextAlign.Center)
            .position({ x: 84, y: 40.5 });
          this.timerWheel(false);
        }
        .width(176)
        .height(114)
        .position({ x: 115, y: 12 });
      }
      .width(this.sectionInnerWidth())
      .height(138)
      .backgroundColor(this.palette().surfacePanelSoft)
      .border({ width: TOK_BORDER_W, color: this.palette().borderSoft })
      .borderRadius(10)
      .position({ x: 4, y: 33.39 });
    }
    .width(this.contentWidth())
    .height(READER_AUTO_PAGE_TIMER_SECTION_HEIGHT)
    .border({ width: { top: TOK_BORDER_W }, color: this.palette().borderSoft })
    .position({ x: 0, y: READER_AUTO_PAGE_TIMER_SECTION_Y })
    .opacity(this.addedActorOpacity())
    .translate({ y: this.addedActorTranslateY(READER_AUTO_PAGE_ADDED_TIMER_TRANSLATE_Y) });
  }

  @Builder
  private timerWheel(minutes: boolean) {
    Stack({ alignContent: Alignment.TopStart }) {
      if (this.hasAdjacentTimerValue(minutes, -1)) {
        this.timerWheelText(this.adjacentTimerValue(minutes, -1), 0, false, minutes, -1);
      }
      this.timerWheelText(this.currentTimerValue(minutes), 34, true, minutes, 0);
      if (this.hasAdjacentTimerValue(minutes, 1)) {
        this.timerWheelText(this.adjacentTimerValue(minutes, 1), 68, false, minutes, 1);
      }
    }
    .width(76)
    .height(102)
    .border({ width: TOK_BORDER_W, color: this.palette().borderSoft })
    .borderRadius(8)
    .clip(true)
    .position({ x: minutes ? 0 : 100, y: 0 });

    Text(minutes ? '分' : '秒')
      .width(76)
      .height(8)
          .fontFamily('ReaderInter')
      .fontWeight(FontWeight.Bold)
      .fontSize(8)
      .lineHeight(8)
      .fontColor(this.palette().inkSecondary)
      .textAlign(TextAlign.Center)
      .position({ x: minutes ? 0 : 100, y: 106 });
  }

  @Builder
  private timerWheelText(value: number, y: number, selected: boolean, minutes: boolean, delta: number) {
    Text(formatReaderAutoPageFullWheelValue(value))
      .width(76)
      .height(34)
          .fontFamily('ReaderInter')
      .fontWeight(selected ? 800 : 600)
      .fontSize(selected ? 17 : 11)
      .lineHeight(selected ? 17 : 11)
      .fontColor(selected ? this.palette().ink : this.palette().inkSecondary)
      .opacity(selected ? 1 : 0.42)
      .textAlign(TextAlign.Center)
      .position({ x: 0, y })
      .accessibilityText(`${minutes ? '分钟' : '秒数'}，${value}`)
      .onClick((): void => {
        if (delta !== 0) {
          this.commitTimerStep(minutes, delta);
        }
      });
  }

  @Builder
  private detailsSection() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row() {
        Text('详细配置')
          .layoutWeight(1)
          .constraintSize({ maxWidth: 258 })
          .height(14.4)
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(12)
          .lineHeight(14.4)
          .fontColor(this.palette().ink)
          .maxLines(1);
        Text('即时生效')
          .width(40)
          .height(14)
          .margin({ left: 8 })
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Medium)
          .fontSize(10)
          .lineHeight(12)
          .fontColor(this.palette().inkSecondary)
          .textAlign(TextAlign.End)
          .maxLines(1);
      }
      .width(this.sectionInnerWidth())
      .height(14.4)
      .position({ x: 4, y: 11 })
      .opacity(this.addedActorOpacity())
      .translate({ y: this.addedActorTranslateY(READER_AUTO_PAGE_ADDED_DETAILS_TITLE_TRANSLATE_Y) });

      this.speedRow();
      this.followHighlightRow();
    }
    .width(this.contentWidth())
    .height(READER_AUTO_PAGE_DETAILS_SECTION_HEIGHT)
    .border({ width: { top: TOK_BORDER_W }, color: this.palette().borderSoft })
    .position({ x: 0, y: READER_AUTO_PAGE_DETAILS_SECTION_Y });
  }

  @Builder
  private speedRow() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row() {
        Text('翻页速度')
          .width(80.56)
          .height(14)
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(10)
          .lineHeight(13)
          .fontColor(this.palette().ink)
          .maxLines(1);
        Text(`${this.effectiveSpeedSeconds()} 秒`)
          .width(19.44)
          .height(14)
          .margin({ left: 8 })
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(10)
          .lineHeight(13)
          .fontColor(this.palette().inkSecondary)
          .maxLines(1);
      }
      .width(108)
      .height(44)
      .alignItems(VerticalAlign.Center)
      .position({ x: 11, y: 10 });

      Stack({ alignContent: Alignment.TopStart }) {
        Text('2 秒')
          .width(17.3)
          .height(13)
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(9)
          .lineHeight(13)
          .fontColor(this.palette().inkSecondary)
          .maxLines(1)
          .position({ x: 0, y: 15.5 });

        // Figma node `1764:11058` is an intentionally empty 109×44 frame.
        // The nearly-transparent native slider supplies semantics without
        // inventing a visible track or thumb absent from the source design.
        Slider({
          value: this.effectiveSpeedSeconds(),
          min: READER_AUTO_PAGE_FULL_MIN_SPEED_SECONDS,
          max: READER_AUTO_PAGE_FULL_MAX_SPEED_SECONDS,
          step: 1,
          style: SliderStyle.OutSet,
          direction: Axis.Horizontal,
          reverse: false,
        })
          .width(109)
          .height(44)
          .opacity(0.001)
          .accessibilityText('调整自动翻页速度')
          .onChange((value: number, mode: SliderChangeMode): void => {
            this.speedPreviewSeconds = Math.round(value);
            if (mode === SliderChangeMode.End) {
              const committed = this.speedPreviewSeconds;
              this.speedPreviewSeconds = -1;
              this.onSpeedChange(committed);
            }
          })
          .position({ x: 26.3, y: 0 });

        Text('20 秒')
          .width(23.14)
          .height(13)
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(9)
          .lineHeight(13)
          .fontColor(this.palette().inkSecondary)
          .textAlign(TextAlign.End)
          .maxLines(1)
          .position({ x: 143.86, y: 15.5 });
      }
      .width(167)
      .height(44)
      .position({ x: 128, y: 10 });
    }
    .width(this.persistentPageSpeedWidth())
    .height(this.persistentPageSpeedHeight())
    .backgroundColor(this.palette().surface)
    .border({ width: TOK_BORDER_W, color: this.palette().borderSoft })
    .borderRadius(6)
    .position({ x: 4, y: 33.39 })
    .translate({
      x: this.persistentActorTranslateX(READER_AUTO_PAGE_PERSISTENT_SPEED_TRANSLATE_X),
      y: this.persistentActorTranslateY(READER_AUTO_PAGE_PERSISTENT_SPEED_TRANSLATE_Y),
    });
  }

  @Builder
  private followHighlightRow() {
    Row() {
      Text('跟随高亮')
        .layoutWeight(1)
        .constraintSize({ maxWidth: 236 })
        .height(13)
          .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(10)
        .lineHeight(13)
        .fontColor(this.palette().ink)
        .maxLines(1);
      Stack({ alignContent: Alignment.TopStart }) {
        Row()
          .width(20)
          .height(20)
          .backgroundColor(this.palette().surfaceElevated)
          .borderRadius(10)
          .position({ x: this.followHighlight ? 22 : 2, y: 2 });
      }
      .width(44)
      .height(24)
      .margin({ left: 8 })
      .backgroundColor(this.followHighlight ? this.palette().primary : this.palette().surfacePanelSoft)
      .borderRadius(999)
      .accessibilityText(`跟随高亮，${this.followHighlight ? '已开启' : '已关闭'}`);
    }
    .width(this.sectionInnerWidth())
    .height(36)
    .padding({ left: 9, right: 9, top: 6, bottom: 6 })
    .backgroundColor(this.palette().surface)
    .border({ width: TOK_BORDER_W, color: this.palette().borderSoft })
    .borderRadius(6)
    .alignItems(VerticalAlign.Center)
    .position({ x: 4, y: 103.39 })
    .enabled(this.interactionEnabled && this.status === 'stopped')
    .opacity(this.addedActorOpacity())
    .onClick((): void => this.onFollowHighlightChange(!this.followHighlight))
    .translate({ y: this.addedActorTranslateY(READER_AUTO_PAGE_ADDED_FOLLOW_HIGHLIGHT_TRANSLATE_Y) });
  }

  // The values below are copied from the authoritative paired timelines:
  // expand `1938:6245`, collapse `1979:21744`. ReaderControlPanel supplies
  // the hold/easing schedule; this component supplies each actor endpoint.
  private addedActorOpacity(): number {
    return this.motionExpanded ? 1 : 0;
  }

  private outgoingActorOpacity(): number {
    return this.motionExpanded ? 0 : 1;
  }

  private addedActorTranslateY(collapsedY: number): number {
    return this.motionExpanded ? 0 : collapsedY;
  }

  private outgoingActorTranslateY(expandedY: number): number {
    return this.motionExpanded ? expandedY : 0;
  }

  private panelWidth(): number {
    return this.availableWidth > 0 ? Math.min(READER_AUTO_PAGE_FULL_WIDTH, this.availableWidth) :
      READER_AUTO_PAGE_FULL_WIDTH;
  }

  private panelHeight(): number {
    return this.availableHeight > 0 ? Math.min(READER_AUTO_PAGE_FULL_HEIGHT, this.availableHeight) :
      READER_AUTO_PAGE_FULL_HEIGHT;
  }

  private bodyWidth(): number {
    return Math.min(READER_AUTO_PAGE_FULL_BODY_WIDTH, Math.max(0, this.panelWidth() - 26));
  }

  private bodyViewportHeight(): number {
    return Math.min(READER_AUTO_PAGE_FULL_BODY_HEIGHT,
      Math.max(0, this.panelHeight() - READER_AUTO_PAGE_FULL_BODY_Y - 13));
  }

  private bodyX(): number {
    return Math.min(READER_AUTO_PAGE_FULL_BODY_X, Math.max(0, (this.panelWidth() - this.bodyWidth()) / 2));
  }

  private contentWidth(): number {
    return Math.min(READER_AUTO_PAGE_FULL_CONTENT_WIDTH, Math.max(0, this.panelWidth() - 58));
  }

  private sectionInnerWidth(): number {
    return Math.max(0, this.contentWidth() - 8);
  }

  private contentX(): number {
    return Math.min(READER_AUTO_PAGE_FULL_CONTENT_X,
      Math.max(0, (this.panelWidth() - this.contentWidth()) / 2));
  }

  private headerWidth(): number {
    return Math.min(READER_AUTO_PAGE_FULL_HEADER_WIDTH, Math.max(0, this.panelWidth() - 28));
  }

  private headerX(): number {
    return Math.min(READER_AUTO_PAGE_FULL_HEADER_X,
      Math.max(0, (this.panelWidth() - this.headerWidth()) / 2));
  }

  private grabberX(): number {
    return Math.min(READER_AUTO_PAGE_FULL_GRABBER_X,
      Math.max(0, (this.panelWidth() - READER_AUTO_PAGE_FULL_GRABBER_WIDTH) / 2));
  }

  private persistentActorTranslateX(collapsedX: number): number {
    return this.motionExpanded ? 0 : collapsedX;
  }

  private persistentActorTranslateY(collapsedY: number): number {
    return this.motionExpanded ? 0 : collapsedY;
  }

  private persistentChapterWidth(): number {
    return this.motionExpanded ? READER_AUTO_PAGE_EXPANDED_CHAPTER_WIDTH :
      READER_AUTO_PAGE_COLLAPSED_CHAPTER_WIDTH;
  }

  private persistentChapterX(previous: boolean): number {
    const designX = previous ? 9.75 : 224.25;
    const rightGap = previous ? 0 : 9.75;
    return Math.min(
      designX,
      Math.max(0, this.sectionInnerWidth() - this.persistentChapterWidth() - rightGap),
    );
  }

  private persistentChapterTranslateX(previous: boolean): number {
    return this.persistentActorTranslateX(previous ? READER_AUTO_PAGE_PERSISTENT_PREVIOUS_TRANSLATE_X :
      READER_AUTO_PAGE_PERSISTENT_NEXT_TRANSLATE_X);
  }

  private persistentPlayWidth(): number {
    return this.motionExpanded ? READER_AUTO_PAGE_EXPANDED_PLAY_WIDTH : READER_AUTO_PAGE_COLLAPSED_PLAY_WIDTH;
  }

  private persistentPlayHeight(): number {
    return this.motionExpanded ? READER_AUTO_PAGE_EXPANDED_PLAY_HEIGHT : READER_AUTO_PAGE_COLLAPSED_PLAY_HEIGHT;
  }

  private persistentPageSpeedWidth(): number {
    const designWidth = this.motionExpanded ? READER_AUTO_PAGE_EXPANDED_SPEED_WIDTH :
      READER_AUTO_PAGE_COLLAPSED_SPEED_WIDTH;
    return Math.min(designWidth, this.sectionInnerWidth());
  }

  private persistentPageSpeedHeight(): number {
    return this.motionExpanded ? READER_AUTO_PAGE_EXPANDED_SPEED_HEIGHT :
      READER_AUTO_PAGE_COLLAPSED_SPEED_HEIGHT;
  }

  private effectiveSpeedSeconds(): number {
    if (this.speedPreviewSeconds >= READER_AUTO_PAGE_FULL_MIN_SPEED_SECONDS) {
      return this.speedPreviewSeconds;
    }
    return Math.max(READER_AUTO_PAGE_FULL_MIN_SPEED_SECONDS,
      Math.min(READER_AUTO_PAGE_FULL_MAX_SPEED_SECONDS, Math.round(this.speedSeconds)));
  }

  private currentTimerValue(minutes: boolean): number {
    const raw = minutes ? this.timerMinutes : this.timerSeconds;
    const minimum = minutes ? READER_AUTO_PAGE_FULL_MIN_MINUTES : READER_AUTO_PAGE_FULL_MIN_SECONDS;
    const maximum = minutes ? READER_AUTO_PAGE_FULL_MAX_MINUTES : READER_AUTO_PAGE_FULL_MAX_SECONDS;
    if (!Number.isFinite(raw)) {
      return minimum;
    }
    return Math.max(minimum, Math.min(maximum, Math.trunc(raw)));
  }

  private adjacentTimerValue(minutes: boolean, delta: number): number {
    return this.currentTimerValue(minutes) + delta;
  }

  private hasAdjacentTimerValue(minutes: boolean, delta: number): boolean {
    const next = this.adjacentTimerValue(minutes, delta);
    const minimum = minutes ? READER_AUTO_PAGE_FULL_MIN_MINUTES : READER_AUTO_PAGE_FULL_MIN_SECONDS;
    const maximum = minutes ? READER_AUTO_PAGE_FULL_MAX_MINUTES : READER_AUTO_PAGE_FULL_MAX_SECONDS;
    return next >= minimum && next <= maximum;
  }

  private commitTimerStep(minutes: boolean, delta: number): void {
    if (minutes) {
      this.onTimerChange(this.adjacentTimerValue(true, delta), this.currentTimerValue(false));
    } else {
      this.onTimerChange(this.currentTimerValue(true), this.adjacentTimerValue(false, delta));
    }
  }
}
