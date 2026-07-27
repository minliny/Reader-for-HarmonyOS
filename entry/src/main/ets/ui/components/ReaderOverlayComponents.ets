// ReaderOverlayComponents — shared reader overlay families + control layer.
// Ported from Reader UI/frontend-demo/render-runtime.js and frontend-demo/styles.
//
// Route-driven (Batch 1): render as body components of *-overlay-v2 view-state
// entries via ViewStateRenderer(stack). Colors flow through ColorTokens /
// DemoAliasTokens; sizes are bare vp (lint_tokens only forbids hex / px-unit
// strings — bare vp is allowed, same convention as ReaderComponents base structs).
//
// Slice scope: panel header, setting/list rows, button row, slider, segmented,
// toggle, the live demo control sheet, bottom bar, and night toast.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { SizeTokens, ZIndexTokens } from '../../contract/generated/DimensionTokens';
import { RouteId } from '../../contract/generated/RouteTable';
import { ReaderAppearanceFont, ReaderAppearanceSelect, ReaderAppearanceSpecRegistry } from '../../contract/reader_ui/Appearance';
import { ReaderUiVisualTokens } from '../../contract/reader_ui/VisualAdmission';
import { SafeAreaAdapter } from '../adapters/SafeAreaAdapter';
import { ViewportAdapter } from '../adapters/ViewportAdapter';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { ReaderSlice10LivePayloadResolver } from '../store/ReaderSlice10LivePayloadResolver';
import type { ReaderUIJSONPayload } from 'reader_ui_runtime';
import {
  BookDetail,
  ChapterTocEntry,
  CoreBookmark,
  CoreContentSearchResult,
  ReaderFontFamily,
  ReaderRenderMetric,
  ReaderToggleKey,
  ReaderSettingOptionKey,
  TocMode,
  TtsScope,
  TtsTimer,
  ReplaceRule,
  UiEvent,
} from '../store/ReaderUiState';
import { ReaderThemeResolver, ReaderThemeOption } from '../tokens/ReaderThemeResolver';
import { MotionAdapter } from '../adapters/MotionAdapter';
import { InteractionDebugBadge, InteractionDebugFrame } from './InteractionDebugComponents';

function appearanceReaderFontFamily(value: string): ReaderFontFamily {
  switch (value) {
    case 'serif': return 'serif';
    case 'sans': return 'sans';
    case 'kai': return 'kai';
    case 'fangsong': return 'fangsong';
    case 'mono': return 'mono';
    case 'sourceSerif': return 'sourceSerif';
    case 'lxgw': return 'lxgw';
    default: return 'system';
  }
}

// ── Panel header (.reader-panel-header) ──────────────────────────────────
//   flex space-between, gap 12. h2 title 18/700 + span meta/subtitle 12 (76% ink).
@Component
export struct ReaderPanelHeader {
  @Prop title: string = '';
  @Prop meta: string = '';

  build() {
    Row() {
      Text(this.title)
        .fontSize(18).fontWeight(700).fontColor(ColorTokens.controlInk)
        .layoutWeight(1)
      if (this.meta !== '') {
        Text(this.meta)
          .fontSize(12).fontColor(ColorTokens.muted)
          .margin({ left: 12 })
      }
    }
    .width('100%')
  }
}

// ── Setting row (.reader-setting-item) ────────────────────────────────────
//   flex space-between, gap 12, min-height 42, padding 9 10, radius 12, border,
//   surface-tint bg. name 14/600 + value 12 (muted) | disclosure chevron.
@Component
export struct ReaderSettingRow {
  @Prop name: string = '';
  @Prop value: string = '';
  @Prop disclosure: boolean = false;
  @Prop toggle: boolean = false;

  build() {
    Row() {
      Text(this.name)
        .fontSize(14).fontWeight(600).fontColor(ColorTokens.controlInk)
        .layoutWeight(1)
      if (this.toggle) {
        ToggleSwitch()
      } else if (this.value !== '') {
        Text(this.value)
          .fontSize(12).fontColor(ColorTokens.muted)
      }
      if (this.disclosure) {
        Image($r('app.media.ui_icon_chevron_dark'))
          .width(20).height(20)
          .margin({ left: 8 })
      }
    }
    .width('100%')
    .constraintSize({ minHeight: 42 })
    .padding({ left: 10, right: 10, top: 9, bottom: 9 })
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(DemoAliasTokens.radiusLg)
    .backgroundColor(ColorTokens.floatingControlBgAlt)
    .alignItems(VerticalAlign.Center)
  }
}

// ── List row (.reader-list-item) ──────────────────────────────────────────
//   flex space-between, gap 12, min-height 42, padding 9 10, radius 12. main
//   (title 14/600 + detail 12 muted) + optional trailing (switch / chevron).
@Component
export struct ReaderListRow {
  @Prop title: string = '';
  @Prop detail: string = '';

  build() {
    Row() {
      Column() {
        Text(this.title)
          .fontSize(14).fontWeight(600).fontColor(ColorTokens.controlInk)
        if (this.detail !== '') {
          Text(this.detail)
            .fontSize(12).fontColor(ColorTokens.muted)
            .margin({ top: 2 })
        }
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)
    }
    .width('100%')
    .constraintSize({ minHeight: 42 })
    .padding({ left: 10, right: 10, top: 9, bottom: 9 })
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(DemoAliasTokens.radiusLg)
    .backgroundColor(ColorTokens.floatingControlBgAlt)
    .alignItems(VerticalAlign.Center)
  }
}

// ── Action button (.reader-action-button) ─────────────────────────────────
//   min-height 36, radius pill, padding 0 14, 13/600. primary: primary bg +
//   on-primary text. dismiss=true → onClick route-pops (close / cancel / done).
@Component
export struct ReaderActionButton {
  @Prop label: string = '';
  @Prop primary: boolean = false;
  @Prop dismiss: boolean = false;

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Text(this.label)
        .fontSize(13).fontWeight(600)
        .fontColor(this.primary ? DemoAliasTokens.onPrimary : ColorTokens.controlInk)
        .backgroundColor(this.primary ? ColorTokens.primary : ColorTokens.floatingControlBgAlt)
        .border({ width: 1, color: this.primary ? ColorTokens.primary : ColorTokens.border })
        .borderRadius(DemoAliasTokens.radiusPill)
        .padding({ left: 14, right: 14, top: 8, bottom: 8 })
        .margin({ right: 8 })
        .onClick(() => {
          if (this.dismiss) ReaderUiStore.dispatch({ type: 'route-pop' });
        })
      InteractionDebugBadge({ label: 'button', tone: 'action' })
    }
  }
}

// ── Slider (.reader-slider) ───────────────────────────────────────────────
//   height 24, 4px track (muted), fill % + 16px thumb (primary). Local demo
//   state (D13: panel-internal state local for now; reducer interface later).
@Component
export struct ReaderSlider {
  @State value: number = 40;

  build() {
    Stack({ alignContent: Alignment.Start }) {
      // track
      Column().width('100%').height(4).borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.border)
      // fill
      Column().width(`${this.value}%`).height(4).borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.primary)
      // thumb
      Column().width(16).height(16).borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.primary)
        .border({ width: 2, color: ColorTokens.floatingControlBg })
        .margin({ left: `${this.value}%` })
    }
    .width('100%')
    .height(24)
    .alignContent(Alignment.Start)
  }
}

// ── Segmented control (.reader-segmented) ─────────────────────────────────
//   grid auto 1fr, gap 6. segment min-height 34, radius pill, 12/600. active:
//   primary bg + on-primary. Local @State active (D13).
@Component
export struct SegmentedControl {
  @Prop options: string[] = [];
  @State active: number = 0;

  build() {
    Row() {
      ForEach(this.options, (opt: string, i: number) => {
        Stack({ alignContent: Alignment.TopStart }) {
          Text(opt)
            .fontSize(12).fontWeight(600)
            .fontColor(i === this.active ? DemoAliasTokens.onPrimary : ColorTokens.controlInk)
            .backgroundColor(i === this.active ? ColorTokens.primary : ColorTokens.floatingControlBgAlt)
            .border({ width: 1, color: i === this.active ? ColorTokens.primary : ColorTokens.border })
            .borderRadius(DemoAliasTokens.radiusPill)
            .height(34)
            .textAlign(TextAlign.Center)
            .onClick(() => { this.active = i; })
          InteractionDebugBadge({ label: 'seg', tone: 'action' })
        }
        .layoutWeight(1)
        .height(34)
        .margin({ right: 6 })
      }, (opt: string, i: number) => `${opt}-${i}`)
    }
    .width('100%')
  }
}

// ── Toggle switch (.reader-switch) ────────────────────────────────────────
//   42×24, radius pill, 2 padding; knob 20px circle. off: muted track; on:
//   primary bg + knob offset 18. Local @State (D13).
@Component
export struct ToggleSwitch {
  @Prop initialOn: boolean = false;
  @State on: boolean = false;

  aboutToAppear() {
    this.on = this.initialOn;
  }

  build() {
    Stack({ alignContent: this.on ? Alignment.End : Alignment.Start }) {
      Column()
        .width(20).height(20).borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(DemoAliasTokens.onPrimary)
        .margin({ left: 2, right: 2 })
      InteractionDebugBadge({ label: 'toggle', tone: 'action' })
    }
    .width(42)
    .height(24)
    .borderRadius(DemoAliasTokens.radiusPill)
    .backgroundColor(this.on ? ColorTokens.primary : ColorTokens.border)
    .onClick(() => { this.on = !this.on; })
  }
}

// The reader shell, its quick panels, and its module panels all expose the
// same brightness rail.  Keep that rail bound to the reducer rather than
// drawing a decorative 42% fill in each surface: `set-brightness` updates the
// current window through ReaderEffects.applyBrightness.
@Component
struct ReaderBrightnessRail {
  // `brightness` is an ArkUI CustomComponent attribute name; using it as a
  // state field collides with the generated component base API. The storage
  // key remains unchanged.
  @StorageProp('reader.brightness') brightnessValue: number = 80;
  @StorageProp('reader.brightnessAuto') brightnessAuto: boolean = false;

  private update(value: number, mode: SliderChangeMode): void {
    // Begin only identifies the gesture. Moving/End/Click carry a real value
    // and are deliberately sent through the reducer so the visual rail and
    // the Harmony window never diverge.
    if (mode === SliderChangeMode.Begin) return;
    ReaderUiStore.dispatch({
      type: 'set-brightness',
      value: Math.round(value),
      previousValue: this.brightnessValue,
    });
  }

  private toggleAuto(): void {
    ReaderUiStore.dispatch({
      type: 'toggle-brightness-auto',
      enabled: !this.brightnessAuto,
      previousEnabled: this.brightnessAuto,
    });
  }

  build() {
    // `924:125` is a fixed 38 × 190 rail, not a generic panel that stretches
    // with its parent.  Every visible reader sheet composes this same Figma
    // component, so its geometry and all colors come from the generated
    // Reader-UI visual-admission contract.
    Stack({ alignContent: Alignment.TopStart }) {
      Column({ space: ReaderUiVisualTokens.readerBrightnessRailContentGap }) {
        Image($r('app.media.reader_control_brightness_sun'))
          .width(ReaderUiVisualTokens.readerBrightnessIconSize)
          .height(ReaderUiVisualTokens.readerBrightnessIconSize)
        Slider({
          value: this.brightnessValue,
          min: 0,
          max: 100,
          step: 1,
          style: SliderStyle.OutSet,
          direction: Axis.Vertical,
          reverse: true,
        })
          .width(ReaderUiVisualTokens.readerBrightnessTrackWidth)
          .height(ReaderUiVisualTokens.readerBrightnessTrackHeight)
          .trackColor(ReaderUiVisualTokens.readerBrightnessTrackSurface)
          .selectedColor(ReaderUiVisualTokens.readerBrightnessTrackSelected)
          .blockColor(ReaderUiVisualTokens.readerBrightnessTrackSelected)
          .onChange((value: number, mode: SliderChangeMode) => this.update(value, mode))
        // The Figma hit area is 24 × 20 while the pill itself is centered at
        // 20 × 20. It has a pale inner highlight rather than a dark selected
        // chip, which keeps the automatic-brightness affordance visible.
        Stack({ alignContent: Alignment.Center }) {
          Column()
            .width(ReaderUiVisualTokens.readerBrightnessAutoVisualWidth)
            .height(ReaderUiVisualTokens.readerBrightnessAutoHeight)
            .border({ width: 1, color: ReaderUiVisualTokens.readerBrightnessAutoBorder })
            .borderRadius(ReaderUiVisualTokens.readerBrightnessAutoRadius)
            .backgroundColor(ReaderUiVisualTokens.readerBrightnessAutoSurface)
          Column()
            .width(18)
            .height(1)
            .backgroundColor(ReaderUiVisualTokens.readerBrightnessAutoInnerHighlight)
            .borderRadius(1)
            .position({ x: 3, y: 1 })
          Text('A')
            .fontSize(13)
            .fontWeight(500)
            .fontColor(ReaderUiVisualTokens.readerBrightnessAutoInk)
            .textAlign(TextAlign.Center)
            .width(ReaderUiVisualTokens.readerBrightnessAutoVisualWidth)
            .height(ReaderUiVisualTokens.readerBrightnessAutoHeight)
        }
        .width(ReaderUiVisualTokens.readerBrightnessAutoHitWidth)
        .height(ReaderUiVisualTokens.readerBrightnessAutoHeight)
        .accessibilityText('自动亮度')
        .onClick(() => this.toggleAuto())
      }
      .width(ReaderUiVisualTokens.readerBrightnessRailWidth)
      .height(ReaderUiVisualTokens.readerBrightnessRailHeight)
      .padding({ top: ReaderUiVisualTokens.readerBrightnessRailTopInset })
      .alignItems(HorizontalAlign.Center)
      .backgroundColor(ReaderUiVisualTokens.readerBrightnessRailSurface)
      .border({ width: 1, color: ReaderUiVisualTokens.readerBrightnessRailBorder })
      .borderRadius(ReaderUiVisualTokens.readerBrightnessRailRadius)
      InteractionDebugBadge({ label: 'B', tone: 'action', offsetTop: 22 })
      InteractionDebugFrame({ label: 'BrightnessRail', tone: 'module' })
    }
    .width(ReaderUiVisualTokens.readerBrightnessRailWidth)
    .height(ReaderUiVisualTokens.readerBrightnessRailHeight)
  }
}

// ── Control sheet (.fd-reader-sheet + .fd-reader-control-main) ────────────
//   Live demo truth for control-layer-base-v2:
//   - mobile portrait: bottom sheet 330vp, left/right 12, module nav floats
//     inside the lower reserved area.
//   - tablet/landscape: right-side 340vp dock, sheet 252vp, attached directly
//     above the module nav.
//   It is not the obsolete three-detached-control layout.
@Component
export struct ReaderControlSheet {
  @StorageProp(SafeAreaAdapter.K_BOTTOM) safeAreaBottom: number = SafeAreaAdapter.DEFAULT_BOTTOM;
  @StorageProp(ViewportAdapter.K_WIDTH) viewportWidth: number = ViewportAdapter.DEFAULT_WIDTH;
  @StorageProp(ViewportAdapter.K_HEIGHT) viewportHeight: number = ViewportAdapter.DEFAULT_HEIGHT;
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;
  @StorageProp('reader.chapterToc') chapterToc: ChapterTocEntry[] = [];
  @StorageProp('reader.currentChapterTitle') currentChapterTitle: string = '';

  // `reader.control-home` is a single Figma component with two constrained
  // layouts.  Keep its source geometry here instead of inheriting the legacy
  // generic reader sheet palette/radius values.
  private readonly dockWidth: number = 340;
  private readonly dockRight: number = 25;
  private readonly mobileSheetInset: number = 13;
  private readonly navBottom: number = 33;
  private readonly dockGap: number = -1;
  private readonly mobileSheetBottom: number = 19;
  private readonly wideSheetHeight: number = 252;
  private readonly mobileSheetHeight: number = 330;
  private readonly controlTop: number = 29;
  private readonly wideControlBottom: number = 33;
  private readonly mobileControlBottom: number = 111;
  private readonly sheetPaddingX: number = 13;
  private readonly railGap: number = 14;
  private readonly quickHeight: number = 75.438;

  private quickActions: Array<[string, string, string]> = [
    ['搜索', 'reader_control_quick_search', 'reader-search-overlay-v2'],
    ['自动翻页', 'reader_control_quick_auto_page', 'reader-auto-scroll-overlay-v2'],
    ['替换', 'reader_control_quick_replace', 'reader-replace-overlay-v2'],
  ];

  private moduleForRoute(routeId: string): string {
    if (routeId === 'reader-search-overlay-v2') return 'search';
    if (routeId === 'reader-auto-scroll-overlay-v2') return 'auto-page';
    if (routeId === 'reader-replace-overlay-v2') return 'replacement';
    return '';
  }

  private quickDebugLabel(routeId: string): string {
    if (routeId === 'reader-search-overlay-v2') return 'search';
    if (routeId === 'reader-auto-scroll-overlay-v2') return 'auto';
    if (routeId === 'reader-replace-overlay-v2') return 'replace';
    return 'quick';
  }

  private wideControlDock(): boolean {
    return ViewportAdapter.isWide(this.viewportWidth, this.viewportHeight);
  }

  private sheetWidth(): number {
    return this.wideControlDock() ? this.dockWidth : Math.max(0, this.viewportWidth - this.mobileSheetInset * 2);
  }

  private sheetHeightValue(): number {
    return this.wideControlDock() ? this.wideSheetHeight : this.mobileSheetHeight;
  }

  private navHeightValue(): number {
    return this.wideControlDock() ? 79 : 80;
  }

  private sheetBottom(): number {
    if (this.wideControlDock()) {
      return this.safeAreaBottom + this.navBottom + this.navHeightValue() + this.dockGap;
    }
    return this.mobileSheetBottom;
  }

  private sheetRight(): number {
    return this.wideControlDock() ? this.dockRight : this.mobileSheetInset;
  }

  private controlBottomInset(): number {
    return this.wideControlDock() ? this.wideControlBottom : this.mobileControlBottom;
  }

  private controlHeight(): number {
    // Both Figma variants reserve a fixed 190vp control main area.  The
    // apparent difference is only the bottom space of the containing dock.
    return 190;
  }

  private chapterHeight(): number {
    return 108.563;
  }

  private chapterTitle(): string {
    if (this.currentBook === null) return '尚未选择书籍';
    return this.currentChapterTitle.length > 0 ? this.currentChapterTitle : 'Core 未返回当前章节';
  }

  private currentChapterIndex(): number {
    if (this.currentChapterTitle.length === 0) return -1;
    for (let i = 0; i < this.chapterToc.length; i += 1) {
      if (this.chapterToc[i].title === this.currentChapterTitle) return i;
    }
    return -1;
  }

  private chapterProgressLabel(): string {
    if (this.currentBook === null) return '未选择书籍';
    const index = this.currentChapterIndex();
    if (index >= 0 && this.chapterToc.length > 0) return `${index + 1}/${this.chapterToc.length}`;
    return this.chapterToc.length > 0 ? `已加载目录 ${this.chapterToc.length} 章` : '目录未加载';
  }

  private chapterProgressPercent(): number {
    const index = this.currentChapterIndex();
    if (index < 0 || this.chapterToc.length === 0) return 0;
    return Math.round((index + 1) * 100 / this.chapterToc.length);
  }

  private canSeekChapter(): boolean {
    return this.currentBook !== null && this.currentChapterIndex() >= 0 && this.chapterToc.length > 0;
  }

  private seekChapter(value: number, mode: SliderChangeMode): void {
    // Slider emits End for both a drag and a direct track tap.  Loading only
    // then prevents a network/Core request for every intermediate thumb move.
    if (!this.canSeekChapter() || mode !== SliderChangeMode.End) return;
    ReaderUiStore.dispatch({ type: 'chapter-progress-seek', value: Math.round(value) });
  }

  build() {
    Stack({ alignContent: Alignment.BottomEnd }) {
      Stack({ alignContent: Alignment.TopStart }) {
        Column() {
          Stack({ alignContent: Alignment.TopStart }) {
          Column()
            .width(42)
            .height(4)
            .borderRadius(999)
            .backgroundColor(ReaderUiVisualTokens.readerControlGrabber)
            .margin({ top: 10, left: '50%' })
            .translate({ x: -21 })

          Row({ space: this.railGap }) {
            Stack({ alignContent: Alignment.TopStart }) {
              Column({ space: 6 }) {
                Stack({ alignContent: Alignment.TopStart }) {
                  Row({ space: 8 }) {
                    ForEach(this.quickActions, (item: [string, string, string]) => {
                      Stack({ alignContent: Alignment.TopStart }) {
                        Column({ space: 5 }) {
                          Image($r(`app.media.${item[1]}`)).width(24).height(24)
                          Text(item[0])
                            .fontSize(11)
                            .fontWeight(800)
                            .fontColor(ReaderUiVisualTokens.readerControlInk)
                            .fontFamily(ReaderUiVisualTokens.readerControlFontFamily)
                            .maxLines(1)
                            .textOverflow({ overflow: TextOverflow.Ellipsis })
                        }
                        .width('100%')
                        .height(55.438)
                        .justifyContent(FlexAlign.Center)
                        .alignItems(HorizontalAlign.Center)
                        .backgroundColor(ReaderUiVisualTokens.readerControlQuickActionSurface)
                        .borderRadius(8)
                        .onClick(() => {
                          ReaderUiStore.dispatch({ type: 'reader-module-switch', module: this.moduleForRoute(item[2]) });
                        })
                        InteractionDebugBadge({ label: this.quickDebugLabel(item[2]), tone: 'action', offsetTop: 22 })
                      }
                      .layoutWeight(1)
                      .height(55.438)
                    }, (item: [string, string, string]) => item[2])
                  }
                  .height(this.quickHeight)
                  .padding({ left: 9, right: 9, top: 10, bottom: 10 })
                  .border({ width: 1, color: ReaderUiVisualTokens.readerControlBorder })
                  .borderRadius(8)
                  .backgroundColor(ReaderUiVisualTokens.readerControlTranslucentSurface)
                }
                .height(this.quickHeight)

                Stack({ alignContent: Alignment.TopStart }) {
                  Column({ space: 6 }) {
                  Row() {
                    Stack({ alignContent: Alignment.TopStart }) {
                      Row() {
                        Image($r('app.media.reader_control_chapter_prev'))
                          .width(20)
                          .height(20)
                      }
                      .width(34)
                      .height(34)
                      .justifyContent(FlexAlign.Center)
                      .alignItems(VerticalAlign.Center)
                      .backgroundColor(ReaderUiVisualTokens.readerControlStepSurface)
                      .borderRadius(999)
                      .margin({ top: 9 })
                      .onClick(() => ReaderUiStore.dispatch({ type: 'chapter-prev' }))
                      InteractionDebugBadge({ label: 'P', tone: 'action' })
                    }
                    .width(34)
                    .height(52.563)
                    Text(this.chapterTitle())
                      .fontSize(13)
                      .fontWeight(700)
                      .fontColor(ReaderUiVisualTokens.readerControlInk)
                      .fontFamily(ReaderUiVisualTokens.readerControlFontFamily)
                      .textAlign(TextAlign.Center)
                      .layoutWeight(1)
                      .maxLines(2)
                      .textOverflow({ overflow: TextOverflow.Ellipsis })
                    Stack({ alignContent: Alignment.TopStart }) {
                      Row() {
                        Image($r('app.media.reader_control_chapter_next')).width(20).height(20)
                      }
                      .width(34)
                      .height(34)
                      .justifyContent(FlexAlign.Center)
                      .alignItems(VerticalAlign.Center)
                      .backgroundColor(ReaderUiVisualTokens.readerControlStepSurface)
                      .borderRadius(999)
                      .margin({ top: 9 })
                      .onClick(() => ReaderUiStore.dispatch({ type: 'chapter-next' }))
                      InteractionDebugBadge({ label: 'N', tone: 'action' })
                    }
                    .width(34)
                    .height(52.563)
                  }
                  .height(52)
                  .alignItems(VerticalAlign.Center)

                  Row({ space: 6 }) {
                    Text(this.chapterProgressLabel())
                      .fontSize(9)
                      .fontColor(ReaderUiVisualTokens.readerControlMuted)
                      .fontWeight(400)
                      .fontFamily(ReaderUiVisualTokens.readerControlFontFamily)
                    Stack({ alignContent: Alignment.TopStart }) {
                      Slider({
                        value: this.chapterProgressPercent(),
                        min: 0,
                        max: 100,
                        step: 1,
                        style: SliderStyle.OutSet,
                      })
                        .width('100%')
                        .height(30)
                        .trackColor(ReaderUiVisualTokens.readerControlProgressTrack)
                        .selectedColor(ReaderUiVisualTokens.readerControlProgressFill)
                        .blockColor(ReaderUiVisualTokens.readerControlSurface)
                        .enabled(this.canSeekChapter())
                        .opacity(this.canSeekChapter() ? 1 : 0.54)
                        .onChange((value: number, mode: SliderChangeMode) => this.seekChapter(value, mode))
                      InteractionDebugBadge({ label: 'progress', tone: 'action' })
                    }
                    .layoutWeight(1)
                    .height(30)
                    Text(this.currentBook === null ? '未选择书籍' : (this.chapterToc.length > 0 ? `共 ${this.chapterToc.length} 章` : '目录未加载'))
                      .fontSize(9)
                      .fontColor(ReaderUiVisualTokens.readerControlMuted)
                      .fontWeight(400)
                      .fontFamily(ReaderUiVisualTokens.readerControlFontFamily)
                  }
                  .height(30)
                  .alignItems(VerticalAlign.Center)
                  }
                  .height(this.chapterHeight())
                  .padding({ left: 11, right: 11, top: 10, bottom: 10 })
                  .border({ width: 1, color: ReaderUiVisualTokens.readerControlBorder })
                  .borderRadius(8)
                  .backgroundColor(ReaderUiVisualTokens.readerControlTranslucentSurface)
                }
                .height(this.chapterHeight())
              }
              .width('100%')
              .height('100%')
              InteractionDebugFrame({ label: 'BottomControlPanel', tone: 'module' })
            }
            .layoutWeight(1)
            .height('100%')

            ReaderBrightnessRail()
          }
          .width('100%')
          .height(this.controlHeight())
          .padding({ left: this.sheetPaddingX, right: this.sheetPaddingX })
          .margin({ top: this.controlTop })
          }
          .width('100%')
          .height(this.sheetHeightValue())
          .clip(true)
          .border({ width: { left: 1, right: 1, top: 1, bottom: this.wideControlDock() ? 0 : 1 }, color: ReaderUiVisualTokens.readerControlBorder })
          .borderRadius({
            topLeft: 24,
            topRight: 24,
            bottomLeft: this.wideControlDock() ? 0 : 24,
            bottomRight: this.wideControlDock() ? 0 : 24,
          })
          .backgroundColor(ReaderUiVisualTokens.readerControlSurface)
        }
        .width('100%')
        .height('100%')
        InteractionDebugFrame({ label: 'bottomSheetHost', tone: 'sheet' })
      }
      .width(this.sheetWidth())
      .height(this.sheetHeightValue())
      .margin({ right: this.sheetRight(), bottom: this.sheetBottom() })
    }
    .width('100%')
    .height('100%')
    .hitTestBehavior(HitTestMode.Transparent)
    .zIndex(ZIndexTokens.bottomSheet)
  }
}

// ── Control bottom bar (.reader-control-bottom-bar) ───────────────────────
@Component
export struct ReaderBottomBar {
  @StorageProp(SafeAreaAdapter.K_BOTTOM) safeAreaBottom: number = SafeAreaAdapter.DEFAULT_BOTTOM;
  @StorageProp(ViewportAdapter.K_WIDTH) viewportWidth: number = ViewportAdapter.DEFAULT_WIDTH;
  @StorageProp(ViewportAdapter.K_HEIGHT) viewportHeight: number = ViewportAdapter.DEFAULT_HEIGHT;
  @StorageProp('reader.displayedRouteId') routeId: string = 'control-layer-base-v2';
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;

  // Figma `Control/ModuleNav` remains 340vp in both approved viewports.
  // Phone centers it with a 25vp inset; tablet docks it 25vp from the right.
  private readonly dockWidth: number = 340;
  private readonly dockRight: number = 25;
  private readonly navBottom: number = 33;

  private items: Array<[string, string, string]> = [
    ['directory', '目录', 'reader-directory-overlay-v2'],
    ['tts', '朗读', 'reader-tts-overlay-v2'],
    ['appearance', '界面', 'reader-appearance-overlay-v2'],
    ['settings', '设置', 'reader-settings-overlay-v2'],
  ];

  private wideControlDock(): boolean {
    return ViewportAdapter.isWide(this.viewportWidth, this.viewportHeight);
  }

  private navWidth(): number {
    return this.dockWidth;
  }

  private navHeightValue(): number {
    return this.wideControlDock() ? 79 : 80;
  }

  private navBottomValue(): number {
    return this.wideControlDock() ? this.safeAreaBottom + this.navBottom : this.navBottom;
  }

  private moduleIcon(kind: string, active: boolean): Resource {
    switch (kind) {
      case 'directory':
        return active ? $r('app.media.reader_control_module_directory_active') : $r('app.media.reader_control_module_directory_default');
      case 'appearance':
        return active ? $r('app.media.reader_control_module_appearance_active') : $r('app.media.reader_control_module_appearance_default');
      case 'tts':
        return active ? $r('app.media.reader_control_module_tts_active') : $r('app.media.reader_control_module_tts_default');
      case 'settings':
        return active ? $r('app.media.reader_control_module_settings_active') : $r('app.media.reader_control_module_settings_default');
      default:
        return $r('app.media.reader_control_module_directory_default');
    }
  }

  private active(kind: string): boolean {
    if (kind === 'directory') return this.routeId === 'reader-directory-overlay-v2';
    if (kind === 'tts') return this.routeId === 'reader-tts-overlay-v2';
    if (kind === 'appearance') return this.routeId === 'reader-appearance-overlay-v2';
    if (kind === 'settings') return this.routeId === 'reader-settings-overlay-v2';
    return false;
  }

  private moduleDebugLabel(kind: string): string {
    if (kind === 'directory') return 'dir';
    if (kind === 'appearance') return 'ui';
    return kind;
  }

  private selectModule(kind: string): void {
    MotionAdapter.apply('reader.module.switch', this.reducedMotion, this.getUIContext(), () => {
      if (kind === 'directory') {
        ReaderUiStore.dispatch({ type: 'reader.directory.open' });
        return;
      }
      ReaderUiStore.dispatch({ type: 'reader-module-switch', module: kind });
    });
  }

  build() {
    Stack({ alignContent: Alignment.BottomEnd }) {
      Stack({ alignContent: Alignment.TopStart }) {
        Row({ space: 4 }) {
          ForEach(this.items, (it: [string, string, string]) => {
            Stack({ alignContent: Alignment.TopStart }) {
              Column({ space: 3 }) {
                Stack({ alignContent: Alignment.Center }) {
                  Image(this.moduleIcon(it[0], this.active(it[0]))).width(24).height(24)
                }
                .width(42)
                .height(42)
                .borderRadius(999)
                .backgroundColor(this.active(it[0])
                  ? ReaderUiVisualTokens.readerControlModuleActive
                  : ReaderUiVisualTokens.readerControlModuleInactiveSurface)

                Text(it[1])
                  .fontSize(10)
                  .fontWeight(800)
                  .fontColor(this.active(it[0])
                    ? ReaderUiVisualTokens.readerControlModuleActive
                    : ReaderUiVisualTokens.readerControlModuleInactiveLabel)
                  .fontFamily(ReaderUiVisualTokens.readerControlFontFamily)
                  .maxLines(1)
                  .textOverflow({ overflow: TextOverflow.Ellipsis })
              }
              .width(77.5)
              .height(62)
              .justifyContent(FlexAlign.Center)
              .alignItems(HorizontalAlign.Center)
              .onClick(() => this.selectModule(it[0]))
              InteractionDebugBadge({ label: this.moduleDebugLabel(it[0]), tone: 'action', offsetTop: 24 })
            }
            .width(77.5)
            .height(62)
          }, (it: [string, string, string]) => it[2])
        }
        .width(this.navWidth())
        .height(this.navHeightValue())
        .padding({ left: 9, right: 9, top: this.wideControlDock() ? 8 : 9, bottom: 9 })
        .backgroundColor(ReaderUiVisualTokens.readerControlModuleSurface)
        .border({ width: { left: 1, right: 1, top: this.wideControlDock() ? 0 : 1, bottom: 1 }, color: ReaderUiVisualTokens.readerControlBorder })
        .borderRadius({
          topLeft: this.wideControlDock() ? 0 : 12,
          topRight: this.wideControlDock() ? 0 : 12,
          bottomLeft: 12,
          bottomRight: 12,
        })
        InteractionDebugFrame({ label: 'readerModuleNav', tone: 'sheet' })
      }
      .width(this.navWidth())
      .height(this.navHeightValue())
      .margin({ right: this.dockRight, bottom: this.navBottomValue() })
    }
    .width('100%')
    .height('100%')
    .hitTestBehavior(HitTestMode.Transparent)
    .zIndex(ZIndexTokens.readerModuleNav)
  }
}

// ── Panel shell (.reader-overlay-panel) ──────────────────────────────────
//   absolute, flex column, gap 14, radius 22, border, floating-control-bg,
//   shadow. Sits above the control bottom bar (bottom-function variant).
//   @BuilderParam content = the panel body (header + rows + lists + ...).
//   Each *-overlay-v2 panel wraps its body in this shell so the chrome is
//   declared once.
@Component
export struct ReaderOverlayPanel {
  @StorageProp(SafeAreaAdapter.K_BOTTOM) safeAreaBottom: number = SafeAreaAdapter.DEFAULT_BOTTOM;
  @StorageProp(ViewportAdapter.K_WIDTH) viewportWidth: number = ViewportAdapter.DEFAULT_WIDTH;
  @StorageProp(ViewportAdapter.K_HEIGHT) viewportHeight: number = ViewportAdapter.DEFAULT_HEIGHT;
  @BuilderParam content: () => void;

  private readonly dockWidth: number = 340;
  private readonly dockRight: number = 24;
  private readonly mobileSheetInset: number = 12;
  private readonly navBottom: number = 32;
  private readonly navHeight: number = 79;
  private readonly dockGap: number = -1;
  private readonly mobileSheetBottom: number = 18;
  private readonly mobileSheetHeight: number = 330;

  private wideControlDock(): boolean {
    return ViewportAdapter.isWide(this.viewportWidth, this.viewportHeight);
  }

  private panelWidth(): number {
    return this.wideControlDock() ? this.dockWidth : Math.max(0, this.viewportWidth - this.mobileSheetInset * 2);
  }

  private panelHeightValue(): number {
    return this.wideControlDock() ? 252 : this.mobileSheetHeight;
  }

  private panelBottomReserve(): number {
    return this.wideControlDock() ? 32 : 110;
  }

  private panelContentHeight(): number {
    return this.panelHeightValue() - this.panelBottomReserve();
  }

  private panelBottom(): number {
    if (this.wideControlDock()) {
      return this.safeAreaBottom + this.navBottom + this.navHeight + this.dockGap;
    }
    return this.mobileSheetBottom;
  }

  private panelRight(): number {
    return this.wideControlDock() ? this.dockRight : this.mobileSheetInset;
  }

  build() {
    Stack({ alignContent: Alignment.BottomEnd }) {
      Stack({ alignContent: Alignment.TopStart }) {
        Column() {
          Column({ space: 14 }) {
            this.content()
          }
          .width('100%')
          .height(this.panelContentHeight())
          .padding(16)
        }
        .width('100%')
        .height('100%')
        InteractionDebugFrame({ label: 'ReaderModulePanel', tone: 'module' })
      }
      .width(this.panelWidth())
      .height(this.panelHeightValue())
      .backgroundColor(ColorTokens.floatingControlBg)
      .border({ width: { left: 1, right: 1, top: 1, bottom: this.wideControlDock() ? 0 : 1 }, color: ColorTokens.border })
      .borderRadius({
        topLeft: DemoAliasTokens.radiusXl,
        topRight: DemoAliasTokens.radiusXl,
        bottomLeft: this.wideControlDock() ? 0 : DemoAliasTokens.radiusXl,
        bottomRight: this.wideControlDock() ? 0 : DemoAliasTokens.radiusXl,
      })
      .margin({ right: this.panelRight(), bottom: this.panelBottom() })
    }
    .width('100%')
    .height('100%')
    .hitTestBehavior(HitTestMode.Transparent)
    .zIndex(ZIndexTokens.bottomSheet)
  }
}

// ── Quick action sheet shell (.fd-reader-quick-detail) ───────────────────
// Live demo quick panels keep the same sheet frame, grabber, and right-side
// brightness rail as the control layer. The quick body occupies the left panel
// from top 28 to bottom 12; module navigation remains a separate overlay above
// the lower part of the sheet.
@Component
export struct ReaderQuickPanelShell {
  @StorageProp(SafeAreaAdapter.K_BOTTOM) safeAreaBottom: number = SafeAreaAdapter.DEFAULT_BOTTOM;
  @StorageProp(ViewportAdapter.K_WIDTH) viewportWidth: number = ViewportAdapter.DEFAULT_WIDTH;
  @StorageProp(ViewportAdapter.K_HEIGHT) viewportHeight: number = ViewportAdapter.DEFAULT_HEIGHT;
  @Prop debugLabel: string = 'ReaderQuickPanel';
  // Search and Auto Page are 196vp Figma sections; Replace is 190vp.
  @Prop contentHeight: number = 190;
  @BuilderParam content: () => void;

  private readonly dockWidth: number = 340;
  private readonly dockRight: number = 25;
  private readonly mobileSheetInset: number = 13;
  private readonly navBottom: number = 33;
  private readonly dockGap: number = -1;
  private readonly mobileSheetBottom: number = 19;
  private readonly wideSheetHeight: number = 252;
  private readonly mobileSheetHeight: number = 330;
  private readonly controlTop: number = 29;
  private readonly sheetPaddingX: number = 13;
  private readonly railGap: number = 14;

  private wideControlDock(): boolean {
    return ViewportAdapter.isWide(this.viewportWidth, this.viewportHeight);
  }

  private sheetWidth(): number {
    return this.wideControlDock() ? this.dockWidth : Math.max(0, this.viewportWidth - this.mobileSheetInset * 2);
  }

  private sheetHeightValue(): number {
    return this.wideControlDock() ? this.wideSheetHeight : this.mobileSheetHeight;
  }

  private navHeightValue(): number {
    return this.wideControlDock() ? 79 : 80;
  }

  private sheetBottom(): number {
    if (this.wideControlDock()) {
      return this.safeAreaBottom + this.navBottom + this.navHeightValue() + this.dockGap;
    }
    return this.mobileSheetBottom;
  }

  private sheetRight(): number {
    return this.wideControlDock() ? this.dockRight : this.mobileSheetInset;
  }

  private quickHeight(): number {
    return this.contentHeight;
  }

  build() {
    Stack({ alignContent: Alignment.BottomEnd }) {
      Column() {
        Stack({ alignContent: Alignment.TopStart }) {
          Column()
            .width(42)
            .height(4)
            .borderRadius(999)
            .backgroundColor(ReaderUiVisualTokens.readerControlGrabber)
            .margin({ top: 10, left: '50%' })
            .translate({ x: -21 })

          Row({ space: this.railGap }) {
            Column() {
              this.content()
            }
            .layoutWeight(1)
            .height('100%')
            .padding({ left: 11, right: 11, top: 13, bottom: 13 })
            .border({ width: 1, color: ReaderUiVisualTokens.readerControlBorder })
            .borderRadius(8)
            .backgroundColor(ReaderUiVisualTokens.readerControlTranslucentSurface)

            ReaderBrightnessRail()
          }
          .width('100%')
          .height(this.quickHeight())
          .padding({ left: this.sheetPaddingX, right: this.sheetPaddingX })
          .margin({ top: this.controlTop })
          .alignItems(VerticalAlign.Top)
          InteractionDebugFrame({ label: this.debugLabel, tone: 'sheet' })
        }
        .width('100%')
        .height(this.sheetHeightValue())
        .clip(true)
        .border({ width: { left: 1, right: 1, top: 1, bottom: this.wideControlDock() ? 0 : 1 }, color: ReaderUiVisualTokens.readerControlBorder })
        .borderRadius({
          topLeft: 24,
          topRight: 24,
          bottomLeft: this.wideControlDock() ? 0 : 24,
          bottomRight: this.wideControlDock() ? 0 : 24,
        })
        .backgroundColor(ReaderUiVisualTokens.readerControlSurface)
      }
      .width(this.sheetWidth())
      .height(this.sheetHeightValue())
      .margin({ right: this.sheetRight(), bottom: this.sheetBottom() })
    }
    .width('100%')
    .height('100%')
    .hitTestBehavior(HitTestMode.Transparent)
    .zIndex(ZIndexTokens.bottomSheet)
  }
}

@Component
struct ReaderQuickBackButton {
  @Prop buttonWidth: number = 51;

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row({ space: 4 }) {
        Image($r('app.media.reader_control_top_back')).width(11).height(11)
        Text('返回')
          .fontSize(10)
          .fontWeight(750)
          .fontColor(ReaderUiVisualTokens.readerModuleActive)
          .fontFamily(ReaderUiVisualTokens.readerControlFontFamily)
      }
      .width(this.buttonWidth)
      .height(24)
      .padding({ left: 8, right: 8 })
      .borderRadius(8)
      .backgroundColor(ReaderUiVisualTokens.readerControlTranslucentSurface)
      .alignItems(VerticalAlign.Center)
      .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))
      InteractionDebugBadge({ label: 'back', tone: 'action' })
    }
  }
}

@Component
struct ReaderQuickPillButton {
  @Prop label: string = '';
  @Prop disabled: boolean = false;
  @Prop tapEvent: string = '';

  build() {
    Text(this.label)
      .fontSize(10)
      .fontWeight(750)
      .fontColor(ColorTokens.primaryDark)
      .height(24)
      .padding({ left: 9, right: 9 })
      .border({ width: 1, color: ColorTokens.primary })
      .borderRadius(DemoAliasTokens.radiusMd)
      .backgroundColor(DemoAliasTokens.surface)
      .opacity(this.disabled ? 0.78 : 1)
      .enabled(!this.disabled)
      .textAlign(TextAlign.Center)
      .onClick(() => {
        if (!this.disabled && this.tapEvent.length > 0) {
          ReaderUiStore.dispatch({ type: this.tapEvent });
        }
      })
  }
}

@Component
struct ReaderSearchResultRow {
  @Prop title: string = '';
  @Prop detail: string = '';
  // A non-negative index identifies a real Core `search.content` projection.
  // The component deliberately carries no fixture text or local paragraph
  // index; ReaderEffects validates the result scope again before navigation.
  @Prop contentSearchResultIndex: number = -1;

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Column({ space: 2 }) {
        Text(this.title)
          .fontSize(10)
          .fontWeight(600)
          .fontColor(ReaderUiVisualTokens.readerControlInk)
          .fontFamily(ReaderUiVisualTokens.readerControlFontFamily)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(this.detail)
          .fontSize(8)
          .fontColor(ReaderUiVisualTokens.readerControlMuted)
          .fontFamily(ReaderUiVisualTokens.readerControlFontFamily)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .width('100%')
      .height('100%')
      .justifyContent(FlexAlign.Center)
      .alignItems(HorizontalAlign.Start)
      InteractionDebugBadge({ label: 'result', tone: 'state' })
    }
    .width('100%')
    .height(54)
    .padding({ left: 8, right: 8, top: 4, bottom: 4 })
    .border({ width: { top: 1 }, color: ReaderUiVisualTokens.readerModuleDivider })
    .onClick(() => {
      if (this.contentSearchResultIndex >= 0) {
        ReaderUiStore.dispatch({
          type: 'content-search-result-open',
          contentSearchResultIndex: this.contentSearchResultIndex,
        });
      }
    })
  }
}

@Component
struct ReaderReplaceRuleRow {
  @Prop title: string = '';
  @Prop active: boolean = true;

  build() {
    Row({ space: 10 }) {
      Text(this.title)
        .fontSize(12)
        .fontWeight(600)
        .fontColor(ColorTokens.controlInk)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .layoutWeight(1)
      ToggleSwitch({ initialOn: this.active })
    }
    .width('100%')
    .height(33)
    .padding({ left: 10, right: 10 })
    .border({ width: { top: 1 }, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
  }
}

// ── Module sheet shell (.fd-reader-module-panel) ─────────────────────────
// Live reader modules are not old standalone overlay cards. They render inside
// the same sheet frame as the control layer, keep the right brightness rail,
// and reserve the lower 110vp for module navigation.
@Component
struct ReaderModulePanelShell {
  @StorageProp(SafeAreaAdapter.K_BOTTOM) safeAreaBottom: number = SafeAreaAdapter.DEFAULT_BOTTOM;
  @StorageProp(ViewportAdapter.K_WIDTH) viewportWidth: number = ViewportAdapter.DEFAULT_WIDTH;
  @StorageProp(ViewportAdapter.K_HEIGHT) viewportHeight: number = ViewportAdapter.DEFAULT_HEIGHT;
  @Prop debugLabel: string = 'ReaderModulePanel';
  @Prop closeEvent: string = '';
  // The small grab handle is an explicit Figma affordance on modules that
  // have a fuller control page.  It must not silently become a close control:
  // TTS uses it to open the admitted full TTS page.
  @Prop expandRoute: string = '';
  @BuilderParam content: () => void;

  private readonly dockWidth: number = 340;
  private readonly dockRight: number = 25;
  private readonly mobileSheetInset: number = 13;
  private readonly navBottom: number = 33;
  private readonly dockGap: number = -1;
  private readonly mobileSheetBottom: number = 19;
  private readonly wideSheetHeight: number = 252;
  private readonly mobileSheetHeight: number = 330;
  private readonly moduleTop: number = 29;
  private readonly sheetPaddingX: number = 13;
  private readonly railGap: number = 14;

  private wideControlDock(): boolean {
    return ViewportAdapter.isWide(this.viewportWidth, this.viewportHeight);
  }

  private sheetWidth(): number {
    return this.wideControlDock() ? this.dockWidth : Math.max(0, this.viewportWidth - this.mobileSheetInset * 2);
  }

  private sheetHeightValue(): number {
    return this.wideControlDock() ? this.wideSheetHeight : this.mobileSheetHeight;
  }

  private navHeightValue(): number {
    return this.wideControlDock() ? 79 : 80;
  }

  private sheetBottom(): number {
    if (this.wideControlDock()) {
      return this.safeAreaBottom + this.navBottom + this.navHeightValue() + this.dockGap;
    }
    return this.mobileSheetBottom;
  }

  private sheetRight(): number {
    return this.wideControlDock() ? this.dockRight : this.mobileSheetInset;
  }

  private moduleHeight(): number {
    return 190;
  }

  build() {
    Stack({ alignContent: Alignment.BottomEnd }) {
      Column() {
        Stack({ alignContent: Alignment.TopStart }) {
          Column()
            .width(42)
            .height(4)
            .borderRadius(999)
            .backgroundColor(ReaderUiVisualTokens.readerControlGrabber)
            .margin({ top: 10, left: '50%' })
            .translate({ x: -21 })
            .onClick(() => {
              if (this.expandRoute.length > 0) {
                ReaderUiStore.dispatch({ type: 'route-push', id: this.expandRoute as RouteId });
              } else if (this.closeEvent.length > 0) {
                ReaderUiStore.dispatch({ type: this.closeEvent });
              }
            })

          Row({ space: this.railGap }) {
            Column() {
              this.content()
            }
            .layoutWeight(1)
            .height('100%')
            .padding({ left: 11, right: 11, top: 13, bottom: 13 })
            .border({ width: 1, color: ReaderUiVisualTokens.readerControlBorder })
            .borderRadius(8)
            .backgroundColor(ReaderUiVisualTokens.readerControlTranslucentSurface)

            ReaderBrightnessRail()
          }
          .width('100%')
          .height(this.moduleHeight())
          .padding({ left: this.sheetPaddingX, right: this.sheetPaddingX })
          .margin({ top: this.moduleTop })
          InteractionDebugFrame({ label: this.debugLabel, tone: 'sheet' })
        }
        .width('100%')
        .height(this.sheetHeightValue())
        .clip(true)
        .border({ width: { left: 1, right: 1, top: 1, bottom: this.wideControlDock() ? 0 : 1 }, color: ReaderUiVisualTokens.readerControlBorder })
        .borderRadius({
          topLeft: 24,
          topRight: 24,
          bottomLeft: this.wideControlDock() ? 0 : 24,
          bottomRight: this.wideControlDock() ? 0 : 24,
        })
        .backgroundColor(ReaderUiVisualTokens.readerControlSurface)
      }
      .width(this.sheetWidth())
      .height(this.sheetHeightValue())
      .margin({ right: this.sheetRight(), bottom: this.sheetBottom() })
    }
    .width('100%')
    .height('100%')
    .hitTestBehavior(HitTestMode.Transparent)
    .zIndex(ZIndexTokens.bottomSheet)
  }
}

@Component
struct ReaderCompactSwitch {
  @Prop active: boolean = false;
  @Prop toggleKey: string = '';
  @Prop disabled: boolean = false;

  build() {
    Stack({ alignContent: this.active ? Alignment.End : Alignment.Start }) {
      Column()
        .width(11)
        .height(11)
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(DemoAliasTokens.onPrimary)
        .margin({ left: 2, right: 2 })
    }
    .width(25)
    .height(15)
    .borderRadius(DemoAliasTokens.radiusPill)
    .backgroundColor(this.active ? ColorTokens.primary : ColorTokens.border)
    .opacity(this.disabled ? 0.56 : 1)
    .enabled(!this.disabled)
    .onClick(() => {
      if (!this.disabled && this.toggleKey.length > 0) {
        ReaderUiStore.dispatch({ type: 'set-reader-toggle', toggleKey: this.toggleKey as ReaderToggleKey, toggleValue: !this.active });
      }
    })
  }
}

@Component
struct ReaderBookmarkLiveRow {
  @Prop bookmark: CoreBookmark;
  @Prop expanded: boolean = false;
  @StorageProp('reader.pendingBookmarkDeleteTime') pendingBookmarkDeleteTime: number = -1;

  private chapterLabel(): string {
    const name = this.bookmark.chapterName.trim();
    return name.length > 0 ? name : `第 ${this.bookmark.chapterIndex + 1} 章`;
  }

  private textLabel(): string {
    const note = this.bookmark.content.trim();
    if (note.length > 0) return note;
    const original = this.bookmark.bookText.trim();
    return original.length > 0 ? original : 'Core 书签未保存原文片段或批注。';
  }

  private awaitingDeleteConfirmation(): boolean {
    return this.pendingBookmarkDeleteTime === this.bookmark.time;
  }

  build() {
    Column({ space: ReaderUiVisualTokens.readerQuickSettingsInternalGap }) {
      Row({ space: 8 }) {
        Text(this.chapterLabel())
          .fontSize(this.expanded ? 13 : 11)
          .fontWeight(700)
          .fontColor(ColorTokens.controlInk)
          .layoutWeight(1)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        // `time` is the Core bookmark primary key.  Do not convert it into a
        // device date because Core accepts caller-free monotonic ids too.
        Text(`Core #${this.bookmark.time}`)
          .fontSize(9)
          .fontColor(ColorTokens.muted)
      }
      .width('100%')
      Text(this.textLabel())
        .fontSize(this.expanded ? 12 : 10)
        .fontColor(ColorTokens.muted)
        .lineHeight(this.expanded ? 18 : 15)
        .maxLines(this.expanded ? 3 : 2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .width('100%')
      Row({ space: 8 }) {
        Text('跳转')
          .fontSize(10)
          .fontWeight(800)
          .fontColor(DemoAliasTokens.onPrimary)
          .height(28)
          .padding({ left: 10, right: 10 })
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(ColorTokens.primary)
          .onClick(() => ReaderUiStore.dispatch({ type: 'bookmark-open', bookmarkTime: this.bookmark.time }))
        Text('删除')
          .fontSize(10)
          .fontWeight(800)
          .fontColor(ColorTokens.accent)
          .height(28)
          .padding({ left: 10, right: 10 })
          .borderRadius(DemoAliasTokens.radiusPill)
          .border({ width: 1, color: ColorTokens.border })
          .onClick(() => ReaderUiStore.dispatch({ type: 'bookmark-delete-request', bookmarkTime: this.bookmark.time }))
      }
      .width('100%')
      if (this.awaitingDeleteConfirmation()) {
        Column({ space: 6 }) {
          Text('确认删除这条 Core 书签？')
            .fontSize(this.expanded ? 12 : 10)
            .fontWeight(800)
            .fontColor(ColorTokens.accent)
            .width('100%')
          Row({ space: 8 }) {
            Text('取消')
              .fontSize(this.expanded ? 11 : 10)
              .fontWeight(800)
              .fontColor(ColorTokens.primaryDark)
              .height(28)
              .padding({ left: 10, right: 10 })
              .borderRadius(DemoAliasTokens.radiusPill)
              .backgroundColor(ColorTokens.metaBg)
              .border({ width: 1, color: ColorTokens.border })
              .onClick(() => ReaderUiStore.dispatch({ type: 'bookmark-delete-cancel' }))
            Text('确认删除')
              .fontSize(this.expanded ? 11 : 10)
              .fontWeight(800)
              .fontColor(DemoAliasTokens.onPrimary)
              .height(28)
              .padding({ left: 10, right: 10 })
              .borderRadius(DemoAliasTokens.radiusPill)
              .backgroundColor(ColorTokens.accent)
              .onClick(() => ReaderUiStore.dispatch({ type: 'bookmark-delete-confirm', bookmarkTime: this.bookmark.time }))
          }
          .width('100%')
        }
        .width('100%')
        .padding(7)
        .borderRadius(DemoAliasTokens.radiusSm)
        .backgroundColor(ColorTokens.surfaceSoft)
      }
    }
    .width('100%')
    .padding({ left: this.expanded ? 12 : 8, right: this.expanded ? 12 : 8, top: 9, bottom: 9 })
    .border({ width: { top: 1 }, color: ColorTokens.border })
  }
}

@Component
struct ReaderTocLiveRow {
  @Prop bookId: string = '';
  @Prop chapterId: string = '';
  @Prop title: string = '';
  @Prop current: boolean = false;

  private openChapter(): void {
    if (this.bookId.length === 0 || this.chapterId.length === 0) return;
    ReaderUiStore.dispatch({
      type: 'chapter-load', chapterId: this.chapterId, bookId: this.bookId, chapterTitle: this.title,
    });
  }

  build() {
    Row({ space: 6 }) {
      Text(this.title)
        .fontSize(11)
        .fontWeight(500)
        .fontColor(ReaderUiVisualTokens.readerControlInk)
        .fontFamily(ReaderUiVisualTokens.readerControlFontFamily)
        .layoutWeight(1)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
      if (this.current) {
        // The current-directory marker is a compact Figma status circle, not
        // a locally invented "当前" label.
        Column()
          .width(24)
          .height(24)
          .borderRadius(999)
          .backgroundColor(ReaderUiVisualTokens.readerModuleStatusSurface)
      }
    }
    .width('100%')
    .height(32)
    .padding({ left: 8, right: 8 })
    .border({ width: { top: 1 }, color: ReaderUiVisualTokens.readerModuleDivider })
    .borderRadius(6)
    .backgroundColor(this.current ? ReaderUiVisualTokens.readerModuleSelectedSurface : Color.Transparent)
    .alignItems(VerticalAlign.Center)
    .onClick(() => this.openChapter())
  }
}

@Component
struct ReaderLiveStepperRow {
  @Prop label: string = '';
  @Prop value: string = '';
  @Prop metric: ReaderRenderMetric = 'fontSize';
  @Prop divider: boolean = false;

  build() {
    Row() {
      Text(this.label)
        .fontSize(9)
        .fontWeight(500)
        .fontColor(ColorTokens.controlInk)
        .layoutWeight(1)
      Row({ space: 4 }) {
        Text('-')
          .fontSize(8)
          .fontWeight(700)
          .fontColor(ColorTokens.controlInk)
          .width(24)
          .height(24)
          .borderRadius(DemoAliasTokens.radiusSm)
          .backgroundColor(ColorTokens.floatingControlBgAlt)
          .textAlign(TextAlign.Center)
          .onClick(() => ReaderUiStore.dispatch({ type: 'step-reader-render-metric', readerMetric: this.metric, delta: -1 }))
        Text(this.value)
          .fontSize(9)
          .fontWeight(700)
          .fontColor(ColorTokens.controlInk)
          .width(34)
          .height(24)
          .textAlign(TextAlign.Center)
        Text('+')
          .fontSize(8)
          .fontWeight(700)
          .fontColor(ColorTokens.controlInk)
          .width(24)
          .height(24)
          .borderRadius(DemoAliasTokens.radiusSm)
          .backgroundColor(ColorTokens.floatingControlBgAlt)
          .textAlign(TextAlign.Center)
          .onClick(() => ReaderUiStore.dispatch({ type: 'step-reader-render-metric', readerMetric: this.metric, delta: 1 }))
      }
    }
    .width('100%')
    .height(27)
    .border({ width: { top: this.divider ? 1 : 0 }, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
  }
}

@Component
struct ReaderFontChoices {
  @StorageProp('reader.typography.fontFamily') fontFamily: string = 'serif';

  private choices: ReaderAppearanceFont[] = ReaderAppearanceSpecRegistry.fonts
    .filter((item: ReaderAppearanceFont) => !item.importAction);

  private active(item: ReaderAppearanceFont): boolean {
    return appearanceReaderFontFamily(item.arktsValue) === this.fontFamily;
  }

  private previewFamily(item: ReaderAppearanceFont): string {
    switch (item.arktsValue) {
      case 'serif': return ReaderUiVisualTokens.readerControlTopFontFamily;
      case 'kai': return 'Kaiti SC';
      case 'fangsong': return 'STFangsong';
      case 'mono': return 'JetBrains Mono';
      case 'sourceSerif': return 'Noto Serif SC';
      case 'lxgw': return 'LXGW WenKai';
      case 'system':
      case 'sans':
      default: return ReaderUiVisualTokens.readerControlFontFamily;
    }
  }

  build() {
    Column({ space: 3 }) {
      Text('字体库')
        .fontSize(9)
        .fontWeight(700)
        .fontColor(ReaderUiVisualTokens.readerControlInk)
        .fontFamily(ReaderUiVisualTokens.readerControlFontFamily)
        .width('100%')
        .height(10)
      Column({ space: 4 }) {
        ForEach([0, 1], (row: number) => {
          Row({ space: 4 }) {
            ForEach(this.choices.slice(row * 4, row * 4 + 4), (item: ReaderAppearanceFont, i: number) => {
              Text(item.label)
                .fontSize(8)
                .fontWeight(400)
                .fontColor(ReaderUiVisualTokens.readerControlInk)
                .fontFamily(this.previewFamily(item))
                .width(62.5)
                .height(27)
                .border({ width: 1, color: ReaderUiVisualTokens.readerAppearanceDivider })
                .backgroundColor(this.active(item)
                  ? ReaderUiVisualTokens.readerAppearanceFontSelectedSurface
                  : Color.Transparent)
                .textAlign(TextAlign.Center)
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis })
                .onClick(() => ReaderUiStore.dispatch({
                  type: 'set-reader-font-family',
                  fontFamily: appearanceReaderFontFamily(item.arktsValue),
                }))
            }, (item: ReaderAppearanceFont, i: number) => `${item.id}-${row}-${i}`)
          }
          .width('100%')
          .height(27)
        }, (row: number) => `${row}`)
      }
      .width('100%')
      .height(58)
    }
    .width('100%')
    .height(77)
    .padding({ top: 4 })
    .border({ width: { top: 1 }, color: ReaderUiVisualTokens.readerAppearanceDivider })
  }
}

@Component
struct ReaderThemeSwatches {
  @StorageProp('reader.readerTheme') currentTheme: string = 'paper';
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;
  private options: ReaderThemeOption[] = ReaderThemeResolver.ALL_OPTIONS;

  private isActive(value: string): boolean {
    return this.currentTheme === value;
  }

  build() {
    Column({ space: 3 }) {
      Row() {
        Text('主题库')
          .fontSize(9)
          .fontWeight(700)
          .fontColor(ReaderUiVisualTokens.readerControlInk)
          .fontFamily(ReaderUiVisualTokens.readerControlFontFamily)
          .layoutWeight(1)
        Text('日间：纸纹 · 夜间：夜纹')
          .fontSize(8)
          .fontWeight(500)
          .fontColor(ReaderUiVisualTokens.readerControlMuted)
          .fontFamily(ReaderUiVisualTokens.readerControlFontFamily)
      }
      .width('100%')
      .height(16)
      .alignItems(VerticalAlign.Center)

      Column({ space: 4 }) {
        ForEach([0, 1], (row: number) => {
          Row({ space: 4 }) {
            ForEach(this.options.slice(row * 4, row * 4 + 4), (item: ReaderThemeOption, i: number) => {
              Column() {
                Column()
                  .width(46)
                  .height(18)
                  .borderRadius(6)
                  .backgroundColor(item.swatch)
                  .border({ width: 1, color: ReaderUiVisualTokens.readerAppearanceSwatchBorder })
              }
              .width(62.5)
              .height(24)
              .border({ width: this.isActive(item.value) ? 1 : 0, color: ReaderUiVisualTokens.readerAppearanceSelectedStroke })
              .backgroundColor(this.isActive(item.value)
                ? ReaderUiVisualTokens.readerAppearanceSelectedSurface
                : (item.scheme === 'night' ? ReaderUiVisualTokens.readerAppearanceNightTileSurface : Color.Transparent))
              .justifyContent(FlexAlign.Center)
              .alignItems(HorizontalAlign.Center)
              .onClick(() => {
                MotionAdapter.apply('segment.item.switch', this.reducedMotion, this.getUIContext(), () => {
                  ReaderUiStore.dispatch({ type: 'set-reader-theme', theme: item.value });
                  ReaderUiStore.dispatch({
                    type: 'settings-segment-switch',
                    settingsKey: 'appThemeMode',
                    settingsValue: item.scheme === 'night' ? 'dark' : 'light',
                  });
                });
              })
            }, (item: ReaderThemeOption, i: number) => `${item.value}-${row}-${i}`)
          }
          .width('100%')
          .height(24)
        }, (row: number) => `${row}`)
      }
      .width('100%')
      .height(52)
    }
    .width('100%')
    .height(75.89)
    .padding({ top: 3 })
  }
}

@Component
struct ReaderLiveOptionRow {
  @Prop icon: Resource = $r('app.media.ui_icon_info_dark');
  @Prop title: string = '';
  @Prop value: string = '';
  @Prop active: boolean = false;
  @Prop switchRow: boolean = false;
  @Prop toggleKey: string = '';
  @Prop optionKey: string = '';
  @Prop optionChoices: string[] = [];
  @Prop routeId: string = '';
  @Prop disabled: boolean = false;
  // A disabled setting must say why it is unavailable.  Rendering a fixed
  // switch in its place made no-op Host gaps look like successful settings.
  @Prop unavailableReason: string = '';
  @StorageProp('reader.readerSettingExpandedOption') expandedOption: string = '';

  private isExpanded(): boolean {
    return this.optionKey.length > 0 && this.expandedOption === this.optionKey;
  }

  private normalizedOptionValue(label: string): string {
    if (this.optionKey !== 'pageAnimation') return label;
    if (label === '覆盖' || label === 'cover') return 'cover';
    if (label === '滑动' || label === 'slide') return 'slide';
    if (label === '仿真' || label === 'simulation') return 'simulation';
    if (label === '滚动' || label === 'scroll') return 'scroll';
    if (label === '无' || label === '无动画' || label === 'none') return 'none';
    return 'slide';
  }

  private isSelected(choice: string): boolean {
    if (this.optionKey !== 'pageAnimation') return choice === this.value;
    return this.normalizedOptionValue(choice) === this.normalizedOptionValue(this.value);
  }

  // 根据选项 key 将选中的标签值分发到对应的 reducer action。
  private applyOptionChoice(label: string): void {
    if (this.optionKey === 'tapMode' || this.optionKey === 'pageAnimation' || this.optionKey === 'pageMode') {
      ReaderUiStore.dispatch({
        type: 'set-reader-setting-option',
        optionKey: this.optionKey as ReaderSettingOptionKey,
        optionValue: this.normalizedOptionValue(label),
      });
    } else if (this.optionKey === 'ttsRate') {
      ReaderUiStore.dispatch({ type: 'tts-set-rate', ttsRate: parseFloat(label) });
    } else if (this.optionKey === 'ttsVoice') {
      ReaderUiStore.dispatch({ type: 'tts-set-voice', ttsVoice: label });
    } else if (this.optionKey === 'ttsScope') {
      const scope: TtsScope = label === '全书' ? 'full' : 'chapter';
      ReaderUiStore.dispatch({ type: 'tts-set-scope', ttsScope: scope });
    } else if (this.optionKey === 'ttsTimer') {
      let timer: TtsTimer = 'off';
      if (label === '5 分钟') { timer = '5min'; }
      else if (label === '10 分钟') { timer = '10min'; }
      else if (label === '15 分钟') { timer = '15min'; }
      else if (label === '30 分钟') { timer = '30min'; }
      else if (label === '本章结束') { timer = 'chapterEnd'; }
      ReaderUiStore.dispatch({ type: 'tts-set-timer', ttsTimer: timer });
    }
  }

  build() {
    Column() {
      Row({ space: 9 }) {
        Image(this.icon)
          .width(18)
          .height(18)
          .margin({ left: 1, right: 1 })
        Text(this.title)
          .fontSize(11)
          .fontWeight(500)
          .fontColor(this.disabled ? ColorTokens.muted : ColorTokens.controlInk)
          .layoutWeight(1)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        if (this.switchRow && !this.disabled) {
          ReaderCompactSwitch({ active: this.active, toggleKey: this.toggleKey })
        } else if (this.switchRow && this.disabled) {
          Text(this.unavailableReason.length > 0 ? this.unavailableReason : '当前不可用')
            .fontSize(9)
            .fontWeight(600)
            .fontColor(ColorTokens.muted)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        } else {
          Text(this.value)
            .fontSize(10)
            .fontWeight(500)
            .fontColor(ColorTokens.muted)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
          if (!this.disabled) {
            Image($r('app.media.ui_icon_chevron_dark')).width(13).height(13)
              .rotate({ angle: this.isExpanded() ? 90 : 0 })
          }
        }
      }
      .width('100%')
      .height(34)
      .padding({ left: 9, right: 9 })
      .border({ width: { top: 1 }, color: ColorTokens.border })
      .alignItems(VerticalAlign.Center)
      .opacity(this.disabled ? 0.62 : 1)
      .enabled(!this.disabled)
      .onClick(() => {
        if (!this.disabled && !this.switchRow && this.routeId.length > 0) {
          ReaderUiStore.dispatch({ type: 'route-push', id: this.routeId as RouteId });
          return;
        }
        // 仅 disclosure 行响应展开/收起；switchRow 的切换由 CompactSwitch 处理。
        if (!this.disabled && !this.switchRow && this.optionKey.length > 0) {
          ReaderUiStore.dispatch({ type: 'set-reader-setting-option-expanded', settingOptionExpandedKey: this.optionKey });
        }
      })

      // 展开时渲染下拉选项列表。
      if (this.isExpanded() && this.optionChoices.length > 0) {
        Column() {
          ForEach(this.optionChoices, (choice: string, i: number) => {
            Row() {
              Text(choice)
                .fontSize(10)
                .fontWeight(500)
                .fontColor(this.isSelected(choice) ? ColorTokens.primaryDark : ColorTokens.controlInk)
                .layoutWeight(1)
              if (this.isSelected(choice)) {
                Image($r('app.media.ui_icon_check_primary')).width(12).height(12)
              }
            }
            .width('100%')
            .height(28)
            .padding({ left: 36, right: 9 })
            .alignItems(VerticalAlign.Center)
            .onClick(() => {
              this.applyOptionChoice(choice);
              ReaderUiStore.dispatch({ type: 'set-reader-setting-option-expanded', settingOptionExpandedKey: '' });
            })
          }, (choice: string, i: number) => `${choice}-${i}`)
        }
        .width('100%')
        .backgroundColor(ColorTokens.floatingControlBgAlt)
      }
    }
    .width('100%')
  }
}

// ── Directory panel (.fd-reader-toc-panel) ────────────────────────────────
@Component
export struct DirectoryPanel {
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;
  @StorageProp('reader.chapterToc') chapterToc: ChapterTocEntry[] = [];
  @StorageProp('reader.currentChapterTitle') currentChapterTitle: string = '';
  @StorageProp('reader.tocMode') tocMode: TocMode = 'directory';
  @StorageProp('reader.loading') loading: boolean = false;
  @StorageProp('reader.bookmarks') bookmarks: CoreBookmark[] = [];
  @StorageProp('reader.bookmarksLoaded') bookmarksLoaded: boolean = false;
  @StorageProp('reader.bookmarksLoading') bookmarksLoading: boolean = false;
  @StorageProp('reader.bookmarksError') bookmarksError: string = '';

  private statusMessage(): string {
    if (this.currentBook === null) return '尚未选择书籍，无法显示目录。';
    return this.loading ? '正在从 Core 加载章节目录…' : '暂无从 Core 返回的章节目录。';
  }

  private isCurrent(chapter: ChapterTocEntry): boolean {
    return this.currentChapterTitle.length > 0 && this.currentChapterTitle === chapter.title;
  }

  build() {
    Column() {
        Row({ space: 0 }) {
          Stack({ alignContent: Alignment.Bottom }) {
            Text('目录')
              .fontSize(10).fontWeight(600)
              .fontColor(this.tocMode === 'directory' ? ReaderUiVisualTokens.readerModuleActive : ReaderUiVisualTokens.readerControlMuted)
              .fontFamily(ReaderUiVisualTokens.readerControlFontFamily)
              .width('100%').height(31).textAlign(TextAlign.Center)
              .padding({ top: 9, bottom: 10 })
            if (this.tocMode === 'directory') {
              Column()
                .width(66).height(2).borderRadius(999)
                .backgroundColor(ReaderUiVisualTokens.readerModuleActive)
            }
          }
          .layoutWeight(1).height(31)
          .onClick(() => ReaderUiStore.dispatch({ type: 'set-toc-mode', tocMode: 'directory' }))
          Stack({ alignContent: Alignment.Bottom }) {
            Text('书签')
              .fontSize(10).fontWeight(600)
              .fontColor(this.tocMode === 'bookmark' ? ReaderUiVisualTokens.readerModuleActive : ReaderUiVisualTokens.readerControlMuted)
              .fontFamily(ReaderUiVisualTokens.readerControlFontFamily)
              .width('100%').height(31).textAlign(TextAlign.Center)
              .padding({ top: 9, bottom: 10 })
            if (this.tocMode === 'bookmark') {
              Column()
                .width(66).height(2).borderRadius(999)
                .backgroundColor(ReaderUiVisualTokens.readerModuleActive)
            }
          }
          .layoutWeight(1).height(31)
          .onClick(() => ReaderUiStore.dispatch({ type: 'set-toc-mode', tocMode: 'bookmark' }))
        }
        .width('100%')
        .height(32)
        .padding({ left: 5, right: 5 })
        .border({ width: { bottom: 1 }, color: ReaderUiVisualTokens.readerModuleDivider })

        if (this.tocMode === 'bookmark') {
          if (this.currentBook === null) {
            // There is no current Figma empty/bookmark-error visual.  Keep the
            // approved module chrome instead of inserting a generic message.
            Column().width(0).height(0)
          } else if (this.bookmarksLoading || !this.bookmarksLoaded) {
            Column().width(0).height(0)
          } else if (this.bookmarksError.length > 0) {
            Column().width(0).height(0)
          } else if (this.bookmarks.length === 0) {
            Column().width(0).height(0)
          } else {
            Scroll() {
              Column() {
                ForEach(this.bookmarks, (bookmark: CoreBookmark, i: number) => {
                  // The Figma file has no independent bookmark-card master.
                  // Reuse its approved directory-row geometry instead of the
                  // retired local jump/delete card.
                  ReaderFullBookmarkRow({ bookmark: bookmark })
                }, (bookmark: CoreBookmark, i: number) => `${bookmark.time}-${i}`)
              }
              .width('100%')
            }
            .width('100%')
            .layoutWeight(1)
            .scrollBar(BarState.Auto)
          }
        } else if (this.currentBook === null || this.chapterToc.length === 0) {
          Column().width(0).height(0)
        } else {
          Scroll() {
            Column() {
              ForEach(this.chapterToc, (chapter: ChapterTocEntry, i: number) => {
                ReaderTocLiveRow({
                  bookId: this.currentBook?.bookId ?? '',
                  chapterId: chapter.chapterId,
                  title: chapter.title,
                  current: this.isCurrent(chapter),
                })
              }, (chapter: ChapterTocEntry, i: number) => `${chapter.chapterId}-${i}`)
            }
            .width('100%')
          }
          .width('100%')
          .layoutWeight(1)
          .scrollBar(BarState.Auto)
        }
      }
      .width('100%')
      .height('100%')
  }
}

// ── Appearance panel (.fd-reader-appearance-panel) ────────────────────────
@Component
export struct AppearancePanel {
  build() {
    Column({ space: 10 }) {
        ReaderThemeSwatches()
        ReaderFontChoices()
      }
      .width('100%')
      .height(162.89)
      .padding({ left: 1, right: 1 })
      .alignItems(HorizontalAlign.Start)
  }
}

// ── TTS panel (.fd-reader-tts-panel) ──────────────────────────────────────
@Component
export struct ReaderTtsPanel {
  @StorageProp('reader.ttsSession.playback') playback: string = 'idle';
  @StorageProp('reader.ttsSession.currentSegment') currentSegment: number = 0;
  @StorageProp('reader.ttsSession.totalSegments') totalSegments: number = 0;
  @StorageProp('reader.ttsSession.rate') ttsRate: number = 1;
  @StorageProp('reader.ttsSession.timer') ttsTimer: TtsTimer = 'off';
  @StorageProp('reader.chapterContent') chapterContent: string[] = [];
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;

  private canStart(): boolean {
    return this.chapterContent.length > 0;
  }

  private hasQueue(): boolean {
    return this.totalSegments > 0;
  }

  private rateLabel(): string {
    return `${this.ttsRate.toFixed(1)}x`;
  }

  private timerLabel(): string {
    switch (this.ttsTimer) {
      case '5min': return '5 分钟';
      case '10min': return '10 分钟';
      case '15min': return '15 分钟';
      case '30min': return '30 分钟';
      case 'chapterEnd': return '本章结束';
      default: return '不定时';
    }
  }

  private updateRate(value: number, mode: SliderChangeMode): void {
    if (mode === SliderChangeMode.Begin) return;
    ReaderUiStore.dispatch({ type: 'tts-set-rate', ttsRate: Math.round(value) / 10 });
  }

  private stop(): void {
    // The red stop affordance in the Figma source goes through the generated
    // Reader-UI event so the production playback owner stops both Core and the
    // app-local speech engine together.
    ReaderUiStore.dispatch({ type: 'reader-tts-stop' });
  }

  private start(): void {
    MotionAdapter.apply('reader.session.tts.start', this.reducedMotion, this.getUIContext(), () => {
      ReaderUiStore.startTtsFromReaderSurface();
    });
  }

  build() {
    ReaderModulePanelShell({ debugLabel: 'ReaderModulePanel', expandRoute: 'reader-full-tts' }) {
      // This is the 264×164 Figma quick panel: playback (66), a gap (8),
      // then timer and rate rows (42 + 6 + 42).  Do not put unavailable
      // capability diagnostics or a second title into this surface.
      Column({ space: 8 }) {
        Row({ space: 8 }) {
          Row({ space: 8 }) {
            Image($r('app.media.reader_control_tts_playback'))
              .width(20)
              .height(20)
            Text('播放')
              .fontSize(12)
              .fontWeight(700)
              .fontColor(ReaderUiVisualTokens.readerControlInk)
              .fontFamily(ReaderUiVisualTokens.readerControlFontFamily)
          }
          .layoutWeight(1)
          .alignItems(VerticalAlign.Center)

          Row({ space: 4 }) {
            Image($r('app.media.reader_control_compact_prev'))
              .width(16)
              .height(16)
              .opacity(this.hasQueue() ? 1 : 0.5)
              .enabled(this.hasQueue())
              .onClick(() => ReaderUiStore.dispatch({ type: 'tts-prev' }))
            Stack({ alignContent: Alignment.Center }) {
              // CoreSpeechKit exposes start/stop, not a pause/resume state.
              // Keep this as the Figma play mark and disable it while active;
              // do not substitute a fake pause symbol.
              Image($r('app.media.reader_control_play'))
                .width(14)
                .height(14)
            }
            .width(24)
            .height(24)
            .borderRadius(999)
            .backgroundColor(ReaderUiVisualTokens.readerModuleActive)
            .opacity(this.canStart() && this.playback !== 'playing' ? 1 : 0.5)
            .enabled(this.canStart() && this.playback !== 'playing')
            .onClick(() => this.start())
            Stack({ alignContent: Alignment.Center }) {
              Column()
                .width(22)
                .height(22)
                .borderRadius(999)
                .backgroundColor(ReaderUiVisualTokens.readerTtsStop)
              Image($r('app.media.reader_control_tts_stop'))
                .width(26)
                .height(26)
            }
            .width(26)
            .height(26)
            .opacity(this.playback === 'idle' ? 0.5 : 1)
            .enabled(this.playback !== 'idle')
            .onClick(() => this.stop())
            Image($r('app.media.reader_control_compact_next'))
              .width(16)
              .height(16)
              .opacity(this.hasQueue() ? 1 : 0.5)
              .enabled(this.hasQueue())
              .onClick(() => ReaderUiStore.dispatch({ type: 'tts-next' }))
          }
          .width(128)
          .height(32)
          .justifyContent(FlexAlign.SpaceBetween)
          .alignItems(VerticalAlign.Center)
        }
        .width('100%')
        .height(66)
        .padding({ left: 11, right: 11 })
        .border({ width: 1, color: ReaderUiVisualTokens.readerControlBorder })
        .borderRadius(6)
        .alignItems(VerticalAlign.Center)

        Column({ space: 6 }) {
          Row({ space: 8 }) {
            Image($r('app.media.reader_control_tts_clock')).width(20).height(20)
            Text('定时')
              .fontSize(12)
              .fontWeight(700)
              .fontColor(ReaderUiVisualTokens.readerControlInk)
              .fontFamily(ReaderUiVisualTokens.readerControlFontFamily)
              .layoutWeight(1)
            Row({ space: 5 }) {
              Text(this.timerLabel())
                .fontSize(10)
                .fontWeight(600)
                .fontColor(ReaderUiVisualTokens.readerControlInk)
                .fontFamily(ReaderUiVisualTokens.readerControlFontFamily)
              Image($r('app.media.reader_control_tts_caret_down')).width(7).height(4)
            }
            .height(30)
            .padding({ left: 8, right: 8 })
            .border({ width: 1, color: ReaderUiVisualTokens.readerControlProgressTrack })
            .borderRadius(6)
            .backgroundColor(ReaderUiVisualTokens.readerTtsDropdownSurface)
            .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'reader-full-tts' }))
          }
          .width('100%')
          .height(42)
          .padding({ left: 11, right: 11 })
          .border({ width: 1, color: ReaderUiVisualTokens.readerControlBorder })
          .borderRadius(6)
          .alignItems(VerticalAlign.Center)

          Row({ space: 8 }) {
            Image($r('app.media.reader_control_tts_speed')).width(20).height(20)
            Text('语速')
              .fontSize(12)
              .fontWeight(700)
              .fontColor(ReaderUiVisualTokens.readerControlInk)
              .fontFamily(ReaderUiVisualTokens.readerControlFontFamily)
            Slider({
              value: this.ttsRate * 10,
              min: 5,
              max: 20,
              step: 1,
              style: SliderStyle.OutSet,
            })
              .width(116)
              .height(32)
              .trackColor(ReaderUiVisualTokens.readerControlProgressTrack)
              .selectedColor(ReaderUiVisualTokens.readerModuleActive)
              .blockColor(ReaderUiVisualTokens.readerControlSurface)
              .onChange((value: number, mode: SliderChangeMode) => this.updateRate(value, mode))
            Text(this.rateLabel())
              .fontSize(12)
              .fontWeight(700)
              .fontColor(ReaderUiVisualTokens.readerModuleActive)
              .fontFamily(ReaderUiVisualTokens.readerControlFontFamily)
              .width(38)
              .textAlign(TextAlign.End)
          }
          .width('100%')
          .height(42)
          .padding({ left: 11, right: 11 })
          .border({ width: 1, color: ReaderUiVisualTokens.readerControlBorder })
          .borderRadius(6)
          .alignItems(VerticalAlign.Center)
        }
        .width('100%')
      }
      .width('100%')
      .height(164)
    }
  }
}

// ── Settings panel (.fd-reader-settings-panel) ────────────────────────────
// The quick module is a direct composition of reader.module.settings (Figma
// Phone 942:70): three 30vp segments for orientation, page transition, and
// screen timeout. Do not add unrelated reader preferences to this panel.
@Component
struct ReaderQuickSettingsSegment {
  @Prop label: string = '';
  @Prop values: string[] = [];
  @Prop active: string = '';
  @Prop action: string = '';

  private normalizedPageAnimation(value: string): string {
    if (value === '覆盖') return 'cover';
    if (value === '滑动') return 'slide';
    if (value === '仿真') return 'simulation';
    if (value === '滚动') return 'scroll';
    if (value === '无动画') return 'none';
    return 'slide';
  }

  private selected(value: string): boolean {
    if (this.action !== 'pageAnimation') return value === this.active;
    return this.normalizedPageAnimation(value) === this.normalizedPageAnimation(this.active);
  }

  private actionable(): boolean {
    return this.action === 'pageAnimation' || this.action === 'screenTimeout';
  }

  private choose(value: string): void {
    if (this.action === 'pageAnimation') {
      ReaderUiStore.dispatch({
        type: 'set-reader-setting-option',
        optionKey: 'pageAnimation',
        optionValue: this.normalizedPageAnimation(value),
      });
    } else if (this.action === 'screenTimeout' && value === '始终开启') {
      // The current Host can truthfully keep the screen on. It cannot force an
      // arbitrary system timeout, so the remaining Figma choices stay visual
      // until such a capability is explicitly added.
      ReaderUiStore.dispatch({ type: 'set-reader-toggle', toggleKey: 'keepScreenOn', toggleValue: true });
    } else if (this.action === 'screenTimeout' && this.active === '始终开启') {
      ReaderUiStore.dispatch({ type: 'set-reader-toggle', toggleKey: 'keepScreenOn', toggleValue: false });
    }
  }

  build() {
    Column({ space: 5 }) {
      Text(this.label)
        .fontSize(ReaderUiVisualTokens.readerQuickSettingsLabelSize)
        .fontWeight(600)
        .fontColor(ReaderUiVisualTokens.readerControlMuted)
        .fontFamily(ReaderUiVisualTokens.readerQuickSettingsFontFamily)
        .width('100%')
      Row({ space: 0 }) {
        ForEach(this.values, (value: string) => {
          Text(value)
            .fontSize(ReaderUiVisualTokens.readerQuickSettingsChoiceSize)
            .fontWeight(this.selected(value) ? 700 : 500)
            .fontFamily(ReaderUiVisualTokens.readerQuickSettingsFontFamily)
            .fontColor(this.selected(value) ? ReaderUiVisualTokens.readerModuleActive : ReaderUiVisualTokens.readerControlMuted)
            .height(ReaderUiVisualTokens.readerQuickSettingsChoiceHeight)
            .layoutWeight(1)
            .padding({
              left: ReaderUiVisualTokens.readerQuickSettingsSegmentInset,
              right: ReaderUiVisualTokens.readerQuickSettingsSegmentInset,
            })
            .borderRadius(ReaderUiVisualTokens.readerQuickSettingsChoiceRadius)
            .backgroundColor(this.selected(value) ? ReaderUiVisualTokens.readerQuickSettingsSelectedSurface : Color.Transparent)
            .textAlign(TextAlign.Center)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .enabled(this.actionable())
            .onClick(() => this.choose(value))
        }, (value: string) => value)
      }
      .width('100%')
      .height(ReaderUiVisualTokens.readerQuickSettingsSegmentHeight)
      .padding(ReaderUiVisualTokens.readerQuickSettingsSegmentInset)
      .borderRadius(ReaderUiVisualTokens.readerQuickSettingsSegmentRadius)
      .backgroundColor(ReaderUiVisualTokens.readerQuickSettingsSegmentSurface)
    }
    .width('100%')
    .height(ReaderUiVisualTokens.readerQuickSettingsGroupHeight)
  }
}

@Component
export struct ReaderSettingsPanel {
  @StorageProp('reader.readerToggles.keepScreenOn') keepScreenOn: boolean = false;
  @StorageProp('reader.readerSettingOptions.pageAnimation') pageAnimation: string = ReaderAppearanceSpecRegistry.select('pageAnimation')!.defaultValue;

  private pageAnimationLabel(): string {
    if (this.pageAnimation === 'cover' || this.pageAnimation === '覆盖') return '覆盖';
    if (this.pageAnimation === 'simulation' || this.pageAnimation === '仿真') return '仿真';
    if (this.pageAnimation === 'scroll' || this.pageAnimation === '滚动') return '滚动';
    if (this.pageAnimation === 'none' || this.pageAnimation === '无' || this.pageAnimation === '无动画') return '无动画';
    return '滑动';
  }

  build() {
    ReaderModulePanelShell({ debugLabel: 'ReaderModulePanel' }) {
      Column({ space: ReaderUiVisualTokens.readerQuickSettingsGroupGap }) {
        ReaderQuickSettingsSegment({
          label: '屏幕方向',
          values: ['跟随系统', '竖屏', '横屏'],
          active: '跟随系统',
        })
        ReaderQuickSettingsSegment({
          label: '翻页样式',
          values: ['覆盖', '滑动', '仿真', '滚动', '无动画'],
          active: this.pageAnimationLabel(),
          action: 'pageAnimation',
        })
        ReaderQuickSettingsSegment({
          label: '屏幕超时',
          values: ['跟随系统', '1 分钟', '5 分钟', '10 分钟', '始终开启'],
          active: this.keepScreenOn ? '始终开启' : '5 分钟',
          action: 'screenTimeout',
        })
      }
      .width('100%')
      .height(ReaderUiVisualTokens.readerQuickSettingsPanelHeight)
    }
  }
}

// ── Full reader pages (.fd-reader-full-page-panel) ───────────────────────
// Live demo truth for reader-full-* / reader-book-cache / reader-debug-info:
// these are expanded full panels in the reader full host. They do not render
// ReaderBottomBar or the module nav; the grabber/header collapses back to the
// corresponding quick/module route.
@Component
struct ReaderFullPanelShell {
  @StorageProp(ViewportAdapter.K_WIDTH) viewportWidth: number = ViewportAdapter.DEFAULT_WIDTH;
  @StorageProp(ViewportAdapter.K_HEIGHT) viewportHeight: number = ViewportAdapter.DEFAULT_HEIGHT;
  @Prop title: string = '';
  @Prop quickRoute: string = 'reader';
  @Prop debugLabel: string = 'ReaderExpandedPanel';
  @Prop utility: boolean = false;
  @BuilderParam content: () => void;

  private isTablet(): boolean {
    return ViewportAdapter.classify(this.viewportWidth, this.viewportHeight) !== 'phone';
  }

  private panelWidth(): number {
    return this.isTablet()
      ? ReaderUiVisualTokens.readerFullPanelTabletWidth
      : ReaderUiVisualTokens.readerFullPanelPhoneWidth;
  }

  private panelHeight(): number {
    return this.isTablet()
      ? ReaderUiVisualTokens.readerFullPanelTabletHeight
      : ReaderUiVisualTokens.readerFullPanelPhoneHeight;
  }

  private panelLeft(): number {
    return this.isTablet()
      ? ReaderUiVisualTokens.readerFullPanelTabletLeft
      : ReaderUiVisualTokens.readerFullPanelPhoneLeft;
  }

  private contentWidth(): number {
    return this.isTablet()
      ? ReaderUiVisualTokens.readerFullContentTabletWidth
      : ReaderUiVisualTokens.readerFullContentPhoneWidth;
  }

  private contentHeight(): number {
    return this.isTablet()
      ? ReaderUiVisualTokens.readerFullContentTabletHeight
      : ReaderUiVisualTokens.readerFullContentPhoneHeight;
  }

  @Builder
  private titleIcon() {
    if (this.title === '目录') {
      Image($r('app.media.figma_reader_full_directory')).width(20).height(20)
    } else if (this.title === '朗读') {
      Image($r('app.media.figma_reader_full_tts')).width(20).height(20)
    } else if (this.title === '界面') {
      Image($r('app.media.figma_reader_full_appearance')).width(20).height(20)
    } else if (this.title === '设置') {
      Image($r('app.media.figma_reader_full_settings')).width(20).height(20)
    }
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Column()
        .width(ReaderUiVisualTokens.readerFullGrabberWidth)
        .height(4)
        .borderRadius(999)
        .backgroundColor(ReaderUiVisualTokens.readerFullGrabber)
        .position({
          x: (this.panelWidth() - ReaderUiVisualTokens.readerFullGrabberWidth) / 2,
          y: 10,
        })
        .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))

      Row({ space: 10 }) {
        Row({ space: 8 }) {
          this.titleIcon()
          Text(this.title)
            .fontSize(ReaderUiVisualTokens.readerFullHeaderTitleSize)
            .fontWeight(700)
            .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
            .fontColor(ReaderUiVisualTokens.readerFullHeaderInk)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        .layoutWeight(1)
        .height(20)
        .alignItems(VerticalAlign.Center)

        Text('收起')
          .fontSize(10)
          .fontWeight(700)
          .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
          .fontColor(ReaderUiVisualTokens.readerFullCollapseInk)
          .width(40)
          .height(26)
          .borderRadius(8)
          .backgroundColor(ReaderUiVisualTokens.readerFullCollapseSurface)
          .textAlign(TextAlign.Center)
          .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))
      }
      .width(this.contentWidth())
      .height(ReaderUiVisualTokens.readerFullHeaderHeight)
      .position({ x: ReaderUiVisualTokens.readerFullHeaderInsetX, y: ReaderUiVisualTokens.readerFullHeaderTop })

      Column() {
        this.content()
      }
      .width(this.contentWidth())
      .height(this.contentHeight())
      .justifyContent(FlexAlign.Start)
      .alignItems(HorizontalAlign.Start)
      .clip(true)
      .border({ width: 1, color: ReaderUiVisualTokens.readerFullContentBorder })
      .borderRadius(ReaderUiVisualTokens.readerFullContentRadius)
      .backgroundColor(ReaderUiVisualTokens.readerFullContentSurface)
      .position({ x: ReaderUiVisualTokens.readerFullHeaderInsetX, y: ReaderUiVisualTokens.readerFullContentTop })
      InteractionDebugFrame({ label: this.debugLabel, tone: 'sheet' })
    }
    .width(this.panelWidth())
    .height(this.panelHeight())
    .margin({ left: this.panelLeft(), top: ReaderUiVisualTokens.readerFullPanelTop })
    .border({ width: 1, color: ReaderUiVisualTokens.readerFullPanelBorder })
    .borderRadius(ReaderUiVisualTokens.readerFullPanelRadius)
    .backgroundColor(ReaderUiVisualTokens.readerFullPanelSurface)
    .hitTestBehavior(HitTestMode.Transparent)
    .zIndex(ZIndexTokens.bottomSheet)
  }
}

@Component
struct ReaderFullBlock {
  @Prop title: string = '';
  @Prop meta: string = '';
  @Prop separator: boolean = false;
  @BuilderParam content: () => void;

  build() {
    Column({ space: 8 }) {
      Row() {
        Text(this.title)
          .fontSize(ReaderUiVisualTokens.readerFullSettingsSectionTitleSize)
          .fontWeight(700)
          .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
          .fontColor(ReaderUiVisualTokens.readerFullHeaderInk)
          .layoutWeight(1)
        if (this.meta !== '') {
          Text(this.meta)
            .fontSize(10)
            .fontWeight(500)
            .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
            .fontColor(ReaderUiVisualTokens.readerControlMuted)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
      }
      .width('100%')
      .height(18)
      this.content()
    }
    .width('100%')
    .padding({ left: 10, right: 10, top: this.separator ? 11 : 10, bottom: 10 })
    .border({ width: { top: this.separator ? 1 : 0 }, color: ReaderUiVisualTokens.readerFullContentBorder })
  }
}

@Component
struct ReaderFullChoiceRow {
  @Prop values: string[] = [];
  @Prop active: string = '';
  @Prop choiceKey: string = '';
  @Prop disabled: boolean = false;

  private select(value: string): void {
    if (this.disabled || !this.isActionable()) return;
    if (this.choiceKey === 'tapMode') {
      ReaderUiStore.dispatch({ type: 'set-reader-setting-option', optionKey: 'tapMode', optionValue: value });
    } else if (this.choiceKey === 'pageAnimation') {
      ReaderUiStore.dispatch({ type: 'set-reader-setting-option', optionKey: 'pageAnimation', optionValue: this.pageAnimationValue(value) });
    } else if (this.choiceKey === 'ttsRate') {
      ReaderUiStore.dispatch({ type: 'tts-set-rate', ttsRate: parseFloat(value) });
    } else if (this.choiceKey === 'screenTimeout' && value === '始终开启') {
      ReaderUiStore.dispatch({ type: 'set-reader-toggle', toggleKey: 'keepScreenOn', toggleValue: true });
    } else if (this.choiceKey === 'screenTimeout') {
      ReaderUiStore.dispatch({ type: 'set-reader-toggle', toggleKey: 'keepScreenOn', toggleValue: false });
    }
  }

  private isActionable(): boolean {
    return this.choiceKey === 'tapMode' || this.choiceKey === 'pageAnimation' ||
      this.choiceKey === 'ttsRate' || this.choiceKey === 'screenTimeout';
  }

  private pageAnimationValue(value: string): string {
    if (value === '覆盖' || value === 'cover') return 'cover';
    if (value === '滑动' || value === 'slide') return 'slide';
    if (value === '仿真' || value === 'simulation') return 'simulation';
    if (value === '滚动' || value === 'scroll') return 'scroll';
    if (value === '无' || value === '无动画' || value === 'none') return 'none';
    return 'slide';
  }

  private isActive(value: string): boolean {
    if (this.choiceKey !== 'pageAnimation') return value === this.active;
    return this.pageAnimationValue(value) === this.pageAnimationValue(this.active);
  }

  build() {
    Row({ space: 0 }) {
      ForEach(this.values, (value: string, i: number) => {
        Text(value)
          .fontSize(ReaderUiVisualTokens.readerFullSettingsChoiceSize)
          .fontWeight(600)
          .fontFamily(ReaderUiVisualTokens.readerFullSettingsFontFamily)
          .fontColor(this.disabled
            ? ReaderUiVisualTokens.readerControlMuted
            : (this.isActive(value)
              ? ReaderUiVisualTokens.readerFullSettingsChoiceActive
              : ReaderUiVisualTokens.readerFullSettingsChoiceInk))
          .height(27)
          .layoutWeight(1)
          .borderRadius(6)
          .backgroundColor(!this.disabled && this.isActive(value)
            ? ReaderUiVisualTokens.readerFullSettingsSelectedSurface
            : Color.Transparent)
          .textAlign(TextAlign.Center)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .enabled(!this.disabled && this.isActionable())
          .onClick(() => this.select(value))
      }, (value: string, i: number) => `${value}-${i}`)
    }
    .width('100%')
    .height(ReaderUiVisualTokens.readerFullSettingsSegmentHeight)
    .padding(3)
    .borderRadius(8)
    .backgroundColor(ReaderUiVisualTokens.readerFullSettingsSegmentSurface)
  }
}

@Component
struct ReaderFullFontChoiceRow {
  @StorageProp('reader.typography.fontFamily') fontFamily: string = 'serif';
  private values: ReaderAppearanceFont[] = ReaderAppearanceSpecRegistry.fonts;

  private selected(item: ReaderAppearanceFont): boolean {
    return !item.importAction && appearanceReaderFontFamily(item.arktsValue) === this.fontFamily;
  }

  private previewFamily(item: ReaderAppearanceFont): string {
    switch (item.arktsValue) {
      case 'serif': return 'Songti SC';
      case 'kai': return 'Kaiti SC';
      case 'fangsong': return 'STFangsong';
      case 'mono': return 'JetBrains Mono';
      case 'sourceSerif': return 'Noto Serif SC';
      // The current Figma label itself is rendered in Tinos; the reader body
      // continues to use the contract's LXGW WenKai mapping after selection.
      case 'lxgw': return 'Tinos';
      default: return ReaderUiVisualTokens.readerFullHeaderFontFamily;
    }
  }

  @Builder
  private fontCell(item: ReaderAppearanceFont) {
    if (item.importAction) {
      Text('导入')
        .fontSize(10)
        .fontWeight(400)
        .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
        .fontColor(ReaderUiVisualTokens.readerFullHeaderInk)
        .width(73.5)
        .height(38)
        .borderRadius(6)
        .border({ width: 1, color: ReaderUiVisualTokens.readerFullAppearanceFontBorder })
        .textAlign(TextAlign.Center)
    } else {
      Text(item.label)
        .fontSize(10)
        .fontWeight(400)
        .fontFamily(this.previewFamily(item))
        .fontColor(ReaderUiVisualTokens.readerFullHeaderInk)
        .width(73.5)
        .height(38)
        .borderRadius(6)
        .border({
          width: 1,
          color: this.selected(item)
            ? ReaderUiVisualTokens.readerFullAppearanceFontSelectedStroke
            : ReaderUiVisualTokens.readerFullAppearanceFontBorder,
        })
        .backgroundColor(this.selected(item)
          ? ReaderUiVisualTokens.readerFullAppearanceFontSelectedSurface
          : Color.Transparent)
        .textAlign(TextAlign.Center)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .onClick(() => ReaderUiStore.dispatch({
          type: 'set-reader-font-family',
          fontFamily: appearanceReaderFontFamily(item.arktsValue),
        }))
    }
  }

  build() {
    Column({ space: 6 }) {
      ForEach([0, 1], (row: number) => {
        Row({ space: 6 }) {
          ForEach(this.values.slice(row * 4, row * 4 + 4), (item: ReaderAppearanceFont, i: number) => {
            this.fontCell(item)
          }, (item: ReaderAppearanceFont, i: number) => `${item.id}-${row}-${i}`)
        }
        .width('100%')
      }, (row: number) => `${row}`)
      Row() {
        this.fontCell(this.values.find((item: ReaderAppearanceFont) => item.importAction) ?? this.values[0])
        Blank().layoutWeight(1)
      }
      .width('100%')
    }
    .width('100%')
  }
}

@Component
struct ReaderFullThemeGrid {
  @StorageProp('reader.readerTheme') currentTheme: string = 'paper';
  @StorageProp('reader.appThemeMode') appThemeMode: string = 'system';
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;
  private options: ReaderThemeOption[] = ReaderThemeResolver.ALL_OPTIONS;

  private isActive(item: ReaderThemeOption): boolean {
    const isNight = this.appThemeMode === 'dark';
    let effectiveTheme: string = this.currentTheme;
    if (isNight && !effectiveTheme.endsWith('-night')) effectiveTheme = `${effectiveTheme}-night`;
    if (!isNight && effectiveTheme.endsWith('-night')) effectiveTheme = effectiveTheme.substring(0, effectiveTheme.length - 6);
    return effectiveTheme === item.value && ((isNight && item.scheme === 'night') || (!isNight && item.scheme === 'day'));
  }

  build() {
    Column({ space: 6 }) {
      ForEach([0, 1], (row: number) => {
        Row({ space: 6 }) {
          ForEach(this.options.slice(row * 4, row * 4 + 4), (item: ReaderThemeOption, i: number) => {
            Column({ space: 3 }) {
              Column()
                .width(64)
                .height(24)
                .borderRadius(6)
                .backgroundColor(item.swatch)
                .border({ width: 1, color: ReaderUiVisualTokens.readerAppearanceSwatchBorder })
              Text(item.label)
                .fontSize(9)
                .fontWeight(400)
                .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
                .fontColor(ReaderUiVisualTokens.readerControlMuted)
                .maxLines(1)
            }
            .layoutWeight(1)
            .height(59)
            .justifyContent(FlexAlign.Center)
            .alignItems(HorizontalAlign.Center)
            .borderRadius(8)
            .backgroundColor(this.isActive(item)
              ? ReaderUiVisualTokens.readerAppearanceSelectedSurface
              : ReaderUiVisualTokens.readerAppearanceNightTileSurface)
            .onClick(() => {
              MotionAdapter.apply('segment.item.switch', this.reducedMotion, this.getUIContext(), () => {
                ReaderUiStore.dispatch({ type: 'set-reader-theme', theme: item.value });
                ReaderUiStore.dispatch({ type: 'settings-segment-switch', settingsKey: 'appThemeMode', settingsValue: item.scheme === 'night' ? 'dark' : 'light' });
              });
            })
          }, (item: ReaderThemeOption, i: number) => `${item.value}-${item.scheme}-${row}-${i}`)
        }
        .width('100%')
      }, (row: number) => `${row}`)
      Row({ space: 6 }) {
        Blank().layoutWeight(1)
        ReaderFullAppearanceAction({ label: '设为日间主题', mode: 'light' })
        ReaderFullAppearanceAction({ label: '设为夜间主题', mode: 'dark' })
      }
      .width('100%')
    }
    .width('100%')
  }
}

@Component
struct ReaderFullAppearanceAction {
  @Prop label: string = '';
  @Prop mode: string = 'light';

  build() {
    Text(this.label)
      .fontSize(9)
      .fontWeight(700)
      .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
      .fontColor(ReaderUiVisualTokens.readerFullHeaderInk)
      .width(74)
      .height(28)
      .borderRadius(6)
      .border({ width: 1, color: ReaderUiVisualTokens.readerFullContentBorder })
      .textAlign(TextAlign.Center)
      .onClick(() => ReaderUiStore.dispatch({ type: 'settings-segment-switch', settingsKey: 'appThemeMode', settingsValue: this.mode }))
  }
}

@Component
struct ReaderFullAppearanceSelectRow {
  @Prop label: string = '';
  @Prop value: string = '';
  @Prop optionKey: ReaderSettingOptionKey = 'paragraphIndentMode';

  private spec(): ReaderAppearanceSelect | undefined {
    return ReaderAppearanceSpecRegistry.select(this.optionKey);
  }

  private currentLabel(): string {
    const spec: ReaderAppearanceSelect | undefined = this.spec();
    if (spec === undefined) return this.value;
    const option = spec.options.find((item) => item.value === this.value || item.label === this.value);
    return option?.label ?? this.value;
  }

  private nextValue(): string {
    const spec: ReaderAppearanceSelect | undefined = this.spec();
    if (spec === undefined || spec.options.length === 0) return this.value;
    for (let index: number = 0; index < spec.options.length; index += 1) {
      if (spec.options[index].value === this.value || spec.options[index].label === this.value) {
        return spec.options[(index + 1) % spec.options.length].value;
      }
    }
    return spec.defaultValue;
  }

  private select(): void {
    const next = this.nextValue();
    ReaderUiStore.dispatch({ type: 'set-reader-setting-option', optionKey: this.optionKey, optionValue: next });
    if (this.optionKey === 'paragraphIndentMode') {
      ReaderUiStore.dispatch({ type: 'set-reader-render-metric', readerMetric: 'paragraphIndent', value: next === 'none' ? 0 : 2 });
    }
  }

  build() {
    Row() {
      Text(this.label)
        .fontSize(ReaderUiVisualTokens.readerFullAppearanceFieldLabelSize)
        .fontWeight(700)
        .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
        .fontColor(ReaderUiVisualTokens.readerFullAppearanceFieldInk)
        .layoutWeight(1)
      Row({ space: 4 }) {
        Text(this.currentLabel())
          .fontSize(9)
          .fontWeight(500)
          .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
          .fontColor(ReaderUiVisualTokens.readerControlMuted)
          .layoutWeight(1)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text('⌄')
          .fontSize(10)
          .fontColor(ReaderUiVisualTokens.readerControlMuted)
      }
      .width(56)
      .height(36)
      .padding({ left: 6, right: 6 })
      .borderRadius(6)
      .border({ width: 1, color: ReaderUiVisualTokens.readerFullAppearanceFieldBorder })
      .backgroundColor(ReaderUiVisualTokens.readerFullAppearanceFieldSurface)
      .alignItems(VerticalAlign.Center)
    }
    .width('100%')
    .height(44)
    .padding({ left: 9, right: 8 })
    .borderRadius(6)
    .alignItems(VerticalAlign.Center)
    .onClick(() => this.select())
  }
}

@Component
struct ReaderFullStepperRow {
  @Prop label: string = '';
  @Prop value: string = '';
  @Prop metric: ReaderRenderMetric = 'fontSize';
  @Prop divider: boolean = false;

  private title(): string {
    return ReaderAppearanceSpecRegistry.stepper(this.metric)?.label ?? this.label;
  }

  build() {
    Row() {
      Text(this.title())
        .fontSize(11)
        .fontWeight(500)
        .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
        .fontColor(ReaderUiVisualTokens.readerFullAppearanceFieldInk)
        .layoutWeight(1)
      Row({ space: 4 }) {
        Text('-')
          .fontSize(14)
          .fontWeight(700)
          .fontColor(ReaderUiVisualTokens.readerFullAppearanceFieldInk)
          .width(24)
          .height(28)
          .borderRadius(8)
          .backgroundColor(ReaderUiVisualTokens.readerFullAppearanceStepperSurface)
          .textAlign(TextAlign.Center)
          .onClick(() => ReaderUiStore.dispatch({ type: 'step-reader-render-metric', readerMetric: this.metric, delta: -1 }))
        Text(this.value)
          .fontSize(10)
          .fontWeight(500)
          .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
          .fontColor(ReaderUiVisualTokens.readerControlMuted)
          .width(42)
          .textAlign(TextAlign.Center)
        Text('+')
          .fontSize(14)
          .fontWeight(700)
          .fontColor(ReaderUiVisualTokens.readerFullAppearanceFieldInk)
          .width(24)
          .height(28)
          .borderRadius(8)
          .backgroundColor(ReaderUiVisualTokens.readerFullAppearanceStepperSurface)
          .textAlign(TextAlign.Center)
          .onClick(() => ReaderUiStore.dispatch({ type: 'step-reader-render-metric', readerMetric: this.metric, delta: 1 }))
      }
    }
    .width('100%')
    .height(34)
    .padding({ left: 8, right: 8 })
    .border({ width: { top: this.divider ? 1 : 0 }, color: ReaderUiVisualTokens.readerFullContentBorder })
    .alignItems(VerticalAlign.Center)
  }
}

@Component
struct ReaderFullToggleRow {
  @Prop icon: string = '';
  @Prop title: string = '';
  @Prop active: boolean = false;
  @Prop toggleKey: string = '';
  @Prop routeId: string = '';
  @Prop disabled: boolean = false;
  @Prop unavailableReason: string = '';

  build() {
    Row({ space: 9 }) {
      Text(this.icon)
        .fontSize(12)
        .fontWeight(900)
        .fontColor(ColorTokens.primaryDark)
        .width(24)
        .height(24)
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.floatingControlBgAlt)
        .textAlign(TextAlign.Center)
      Text(this.title)
        .fontSize(12)
        .fontWeight(700)
        .fontColor(this.disabled ? ColorTokens.muted : ColorTokens.controlInk)
        .layoutWeight(1)
      if (this.disabled) {
        Text(this.unavailableReason.length > 0 ? this.unavailableReason : '当前不可用')
          .fontSize(9)
          .fontWeight(600)
          .fontColor(ColorTokens.muted)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      } else if (this.routeId.length > 0) {
        Text('打开')
          .fontSize(9)
          .fontWeight(700)
          .fontColor(ColorTokens.primaryDark)
      } else {
        ReaderCompactSwitch({ active: this.active, toggleKey: this.toggleKey })
      }
    }
    .width('100%')
    .height(38)
    .padding({ left: 9, right: 9 })
    .border({ width: { top: 1 }, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
    .enabled(!this.disabled)
    .onClick(() => {
      if (!this.disabled && this.routeId.length > 0) {
        ReaderUiStore.dispatch({ type: 'route-push', id: this.routeId as RouteId });
      }
    })
  }
}

@Component
struct ReaderFullTocRow {
  @Prop bookId: string = '';
  @Prop chapterId: string = '';
  @Prop title: string = '';
  @Prop current: boolean = false;

  private openChapter(): void {
    if (this.bookId.length === 0 || this.chapterId.length === 0) return;
    ReaderUiStore.dispatch({ type: 'route-pop' });
    ReaderUiStore.dispatch({
      type: 'chapter-load', chapterId: this.chapterId, bookId: this.bookId, chapterTitle: this.title,
    });
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Text(this.title)
        .fontSize(11)
        .fontWeight(500)
        .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
        .fontColor(ReaderUiVisualTokens.readerFullHeaderInk)
        .width('100%')
        .height(40)
        .padding({ left: 9, right: 9 })
        .borderRadius(6)
        .backgroundColor(this.current ? ReaderUiVisualTokens.readerModuleSelectedSurface : Color.Transparent)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .onClick(() => this.openChapter())
      InteractionDebugBadge({ label: 'row', tone: 'action' })
    }
      .width('100%')
      .height(40)
  }
}

@Component
struct ReaderFullBookmarkRow {
  @Prop bookmark: CoreBookmark;

  private title(): string {
    const chapterName = this.bookmark.chapterName.trim();
    return chapterName.length > 0 ? chapterName : `第 ${this.bookmark.chapterIndex + 1} 章`;
  }

  build() {
    Text(this.title())
      .fontSize(11)
      .fontWeight(500)
      .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
      .fontColor(ReaderUiVisualTokens.readerFullHeaderInk)
      .width('100%')
      .height(40)
      .padding({ left: 9, right: 9 })
      .borderRadius(6)
      .maxLines(1)
      .textOverflow({ overflow: TextOverflow.Ellipsis })
      .onClick(() => ReaderUiStore.dispatch({ type: 'bookmark-open', bookmarkTime: this.bookmark.time }))
  }
}

@Component
export struct ReaderFullDirectoryPage {
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;
  @StorageProp('reader.chapterToc') chapterToc: ChapterTocEntry[] = [];
  @StorageProp('reader.currentChapterTitle') currentChapterTitle: string = '';
  @StorageProp('reader.tocMode') tocMode: TocMode = 'directory';
  @StorageProp('reader.loading') loading: boolean = false;
  @StorageProp('reader.bookmarks') bookmarks: CoreBookmark[] = [];
  @StorageProp('reader.bookmarksLoaded') bookmarksLoaded: boolean = false;
  @StorageProp('reader.bookmarksLoading') bookmarksLoading: boolean = false;
  @StorageProp('reader.bookmarksError') bookmarksError: string = '';
  @State private searchText: string = '';
  @State private appliedQuery: string = '';
  @State private descending: boolean = false;
  private directoryScroller: Scroller = new Scroller();

  private statusMessage(): string {
    if (this.currentBook === null) return '暂无章节';
    return this.loading ? '加载章节中' : '暂无章节';
  }

  private isCurrent(chapter: ChapterTocEntry): boolean {
    return this.currentChapterTitle.length > 0 && this.currentChapterTitle === chapter.title;
  }

  private visibleChapters(): ChapterTocEntry[] {
    const query = this.appliedQuery.trim().toLowerCase();
    const result = query.length === 0
      ? this.chapterToc.slice()
      : this.chapterToc.filter((chapter: ChapterTocEntry) => chapter.title.toLowerCase().includes(query));
    return this.descending ? result.reverse() : result;
  }

  private applySearch(): void {
    this.appliedQuery = this.searchText;
    this.directoryScroller.scrollEdge(Edge.Top);
  }

  private jumpToTop(): void {
    this.directoryScroller.scrollEdge(Edge.Top);
  }

  private jumpToBottom(): void {
    this.directoryScroller.scrollEdge(Edge.Bottom);
  }

  private toggleOrder(): void {
    this.descending = !this.descending;
    this.directoryScroller.scrollEdge(Edge.Top);
  }

  private currentChapterOrdinal(): number {
    const all = this.visibleChapters();
    for (let index = 0; index < all.length; index += 1) {
      if (this.isCurrent(all[index])) return index + 1;
    }
    return 0;
  }

  private currentChapterLabel(): string {
    return this.currentChapterTitle.length > 0 ? this.currentChapterTitle : '—';
  }

  build() {
    ReaderFullPanelShell({ title: '目录', quickRoute: 'toc-bookmarks', debugLabel: 'ReaderExpandedPanel' }) {
      Column() {
        Row({ space: 0 }) {
          Column({ space: 0 }) {
            Text('目录')
              .fontSize(11)
              .fontWeight(600)
              .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
              .fontColor(this.tocMode === 'directory'
                ? ReaderUiVisualTokens.readerModuleActive
                : ReaderUiVisualTokens.readerControlMuted)
              .width('100%')
              .height(34)
              .textAlign(TextAlign.Center)
              .onClick(() => ReaderUiStore.dispatch({ type: 'set-toc-mode', tocMode: 'directory' }))
            Column()
              .width(83)
              .height(this.tocMode === 'directory' ? 2 : 0)
              .borderRadius(999)
              .backgroundColor(ReaderUiVisualTokens.readerModuleActive)
          }
          .layoutWeight(1)
          .height(36)
          .alignItems(HorizontalAlign.Center)

          Column({ space: 0 }) {
            Row({ space: 5 }) {
              Image($r('app.media.figma_reader_directory_bookmark')).width(15).height(15)
              Text('书签')
                .fontSize(11)
                .fontWeight(600)
                .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
                .fontColor(this.tocMode === 'bookmark'
                  ? ReaderUiVisualTokens.readerModuleActive
                  : ReaderUiVisualTokens.readerControlMuted)
            }
            .height(34)
            .justifyContent(FlexAlign.Center)
            .onClick(() => ReaderUiStore.dispatch({ type: 'set-toc-mode', tocMode: 'bookmark' }))
            Column()
              .width(83)
              .height(this.tocMode === 'bookmark' ? 2 : 0)
              .borderRadius(999)
              .backgroundColor(ReaderUiVisualTokens.readerModuleActive)
          }
          .layoutWeight(1)
        }
        .width('100%')
        .height(42)
        .padding({ left: 8, right: 8, top: 5 })
        .border({ width: { bottom: 1 }, color: ReaderUiVisualTokens.readerFullContentBorder })

        Row({ space: 5 }) {
          Row({ space: 7 }) {
            Image($r('app.media.figma_reader_directory_search')).width(16).height(16)
            TextInput({ text: this.searchText, placeholder: '搜索章节名称' })
              .fontSize(10)
              .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
              .fontColor(ReaderUiVisualTokens.readerFullHeaderInk)
              .placeholderColor(ReaderUiVisualTokens.readerControlMuted)
              .backgroundColor(Color.Transparent)
              .layoutWeight(1)
              .height(32)
              .onChange((value: string) => this.searchText = value)
          }
          .width(168)
          .height(32)
          .padding({ left: 9, right: 9 })
          .borderRadius(8)
          .backgroundColor(ReaderUiVisualTokens.readerFullSettingsSegmentSurface)
          .alignItems(VerticalAlign.Center)

          Stack({ alignContent: Alignment.Center }) {
            Image($r('app.media.figma_reader_directory_search_active')).width(16).height(16)
          }
          .width(32)
          .height(32)
          .borderRadius(8)
          .backgroundColor(ReaderUiVisualTokens.readerFullSettingsSegmentSurface)
          .onClick(() => this.applySearch())
          Stack({ alignContent: Alignment.Center }) {
            Image($r('app.media.figma_reader_directory_top')).width(16).height(16)
          }
          .width(32)
          .height(32)
          .borderRadius(8)
          .backgroundColor(ReaderUiVisualTokens.readerFullSettingsSegmentSurface)
          .onClick(() => this.jumpToTop())
          Stack({ alignContent: Alignment.Center }) {
            Image($r('app.media.figma_reader_directory_bottom')).width(16).height(16)
          }
          .width(32)
          .height(32)
          .borderRadius(8)
          .backgroundColor(ReaderUiVisualTokens.readerFullSettingsSegmentSurface)
          .onClick(() => this.jumpToBottom())
          Stack({ alignContent: Alignment.Center }) {
            Image($r('app.media.figma_reader_directory_order')).width(16).height(16)
          }
          .width(32)
          .height(32)
          .borderRadius(8)
          .backgroundColor(ReaderUiVisualTokens.readerFullSettingsSegmentSurface)
          .onClick(() => this.toggleOrder())
        }
        .width('100%')
        .height(51)
        .padding({ left: 10, right: 10, top: 9, bottom: 10 })
        .border({ width: { bottom: 1 }, color: ReaderUiVisualTokens.readerFullContentBorder })

        if (this.tocMode === 'bookmark') {
          if (this.currentBook === null) {
            Text('暂无书签')
              .fontSize(10).fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
              .fontColor(ReaderUiVisualTokens.readerControlMuted)
              .width('100%').layoutWeight(1).padding({ left: 10, right: 10, top: 16, bottom: 16 })
          } else if (this.bookmarksLoading || !this.bookmarksLoaded) {
            Text('加载书签中')
              .fontSize(10).fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
              .fontColor(ReaderUiVisualTokens.readerControlMuted)
              .width('100%').layoutWeight(1).padding({ left: 10, right: 10, top: 16, bottom: 16 })
          } else if (this.bookmarksError.length > 0) {
            Text('书签加载失败')
              .fontSize(10).fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
              .fontColor(ReaderUiVisualTokens.readerControlMuted)
              .width('100%').layoutWeight(1).padding({ left: 10, right: 10, top: 16, bottom: 16 })
          } else if (this.bookmarks.length === 0) {
            Text('暂无书签')
              .fontSize(10).fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
              .fontColor(ReaderUiVisualTokens.readerControlMuted)
              .width('100%').layoutWeight(1).padding({ left: 10, right: 10, top: 16, bottom: 16 })
          } else {
            Scroll(this.directoryScroller) {
              Column() {
                ForEach(this.bookmarks, (bookmark: CoreBookmark, i: number) => {
                  ReaderFullBookmarkRow({ bookmark: bookmark })
                }, (bookmark: CoreBookmark, i: number) => `${bookmark.time}-${i}`)
              }
              .width('100%')
              .padding({ left: 10, right: 10, top: 5 })
            }
            .width('100%')
            .layoutWeight(1)
            .scrollBar(BarState.Auto)
          }
        } else if (this.currentBook === null || this.chapterToc.length === 0) {
          Text(this.statusMessage())
            .fontSize(10)
            .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
            .fontColor(ReaderUiVisualTokens.readerControlMuted)
            .width('100%')
            .layoutWeight(1)
            .padding({ left: 10, right: 10, top: 16, bottom: 16 })
        } else {
          Scroll(this.directoryScroller) {
            Column() {
              ForEach(this.visibleChapters(), (chapter: ChapterTocEntry, i: number) => {
                ReaderFullTocRow({
                  bookId: this.currentBook?.bookId ?? '',
                  chapterId: chapter.chapterId,
                  title: chapter.title,
                  current: this.isCurrent(chapter),
                })
              }, (chapter: ChapterTocEntry, i: number) => `${chapter.chapterId}-${i}`)
            }
            .width('100%')
            .padding({ left: 10, right: 10, top: 5 })
          }
          .width('100%')
          .layoutWeight(1)
          .scrollBar(BarState.Auto)
        }

        Row({ space: 9 }) {
          Text('当前章节')
            .fontSize(9)
            .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
            .fontColor(ReaderUiVisualTokens.readerControlMuted)
          Text(this.currentChapterLabel())
            .fontSize(11)
            .fontWeight(700)
            .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
            .fontColor(ReaderUiVisualTokens.readerFullHeaderInk)
            .layoutWeight(1)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
          Text(`${this.currentChapterOrdinal()} / ${this.visibleChapters().length}`)
            .fontSize(9)
            .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
            .fontColor(ReaderUiVisualTokens.readerControlMuted)
        }
        .width('100%')
        .height(48)
        .padding({ left: 12, right: 12 })
        .border({ width: { top: 1 }, color: ReaderUiVisualTokens.readerFullContentBorder })
        .backgroundColor(ReaderUiVisualTokens.readerFullSettingsSegmentSurface)
        .alignItems(VerticalAlign.Center)
      }
      .width('100%')
      .height('100%')
    }
  }
}

@Component
struct ReaderFullTtsSwitch {
  @Prop active: boolean = false;

  build() {
    Stack({ alignContent: this.active ? Alignment.End : Alignment.Start }) {
      Column()
        .width(20)
        .height(20)
        .borderRadius(10)
        .backgroundColor(ReaderUiVisualTokens.readerFullTtsSwitchKnob)
        .margin({ left: 2, right: 2 })
    }
    .width(44)
    .height(24)
    .borderRadius(999)
    .backgroundColor(this.active
      ? ReaderUiVisualTokens.readerFullTtsSwitchActive
      : ReaderUiVisualTokens.readerFullTtsSwitchInactive)
    // Figma currently supplies the visible states only.  These no-owner
    // switches intentionally remain inert until Reader-UI/Core adds their
    // events; keeping the exact design state is safer than inventing a Host
    // capability or a local preference.
    .enabled(false)
  }
}

@Component
struct ReaderFullTtsTimerDial {
  @Prop value: string = '00';
  @Prop unit: string = '分';

  build() {
    Column({ space: 4 }) {
      Column() {
        Text(this.value)
          .fontSize(24)
          .fontWeight(700)
          .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
          .fontColor(ReaderUiVisualTokens.readerFullTtsInk)
          .textAlign(TextAlign.Center)
      }
      .width(121.5)
      .height(132)
      .border({ width: 1, color: ReaderUiVisualTokens.readerFullTtsSectionBorder })
      .borderRadius(ReaderUiVisualTokens.readerFullTtsSectionRadius)
      .backgroundColor(ReaderUiVisualTokens.readerFullTtsSectionSurface)
      .justifyContent(FlexAlign.Center)
      Text(this.unit)
        .fontSize(10)
        .fontWeight(600)
        .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
        .fontColor(ReaderUiVisualTokens.readerFullTtsMuted)
        .width(123.5)
        .textAlign(TextAlign.Center)
    }
    .width(123.5)
    .height(149)
  }
}

@Component
struct ReaderFullTtsEngineTab {
  @Prop title: string = '';
  @Prop detail: string = '';
  @Prop selected: boolean = false;

  build() {
    Row({ space: 8 }) {
      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.reader_control_tts_playback'))
          .width(16)
          .height(16)
      }
      .width(44)
      .height(44)
      .borderRadius(ReaderUiVisualTokens.readerFullTtsFieldRadius)
      .backgroundColor(this.selected ? ReaderUiVisualTokens.readerFullTtsSectionSurface : Color.Transparent)
      Column({ space: 2 }) {
        Text(this.title)
          .fontSize(12)
          .fontWeight(900)
          .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
          .fontColor(ReaderUiVisualTokens.readerFullTtsControlInk)
        Text(this.detail)
          .fontSize(10)
          .fontWeight(700)
          .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
          .fontColor(ReaderUiVisualTokens.readerFullTtsMuted)
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .height(54)
    .padding({ left: 11, right: 11 })
    .border({ width: this.selected ? 1 : 0, color: ReaderUiVisualTokens.readerFullTtsPrimary })
    .borderRadius(ReaderUiVisualTokens.readerFullTtsFieldRadius)
    .backgroundColor(this.selected ? ReaderUiVisualTokens.readerFullTtsTransportSurface : Color.Transparent)
    // The Figma master contains no reaction for service selection.  Do not
    // silently route to an unimplemented online TTS configuration.
    .enabled(false)
  }
}

@Component
export struct ReaderFullTtsPage {
  @StorageProp('reader.ttsSession.playback') playback: string = 'idle';
  @StorageProp('reader.ttsSession.currentSegment') currentSegment: number = 0;
  @StorageProp('reader.ttsSession.totalSegments') totalSegments: number = 0;
  @StorageProp('reader.ttsSession.rate') ttsRate: number = 1;
  @StorageProp('reader.ttsSession.timer') ttsTimer: TtsTimer = 'off';
  @StorageProp('reader.ttsSession.voice') ttsVoice: string = 'system-default';
  @StorageProp('reader.chapterContent') chapterContent: string[] = [];
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;

  private canStart(): boolean {
    return this.chapterContent.length > 0;
  }

  private hasQueue(): boolean {
    return this.totalSegments > 0;
  }

  private rateLabel(): string {
    return `${this.ttsRate.toFixed(1)}x`;
  }

  private playbackStatus(): string {
    if (this.playback === 'playing') return '播放中';
    if (this.playback === 'paused') return '已暂停';
    return '未开始';
  }

  private timerLabel(timer: TtsTimer = this.ttsTimer): string {
    switch (timer) {
      case '5min': return '05:00';
      case '10min': return '10:00';
      case '15min': return '15:00';
      case '30min': return '30:00';
      case 'chapterEnd': return '本章结束';
      default: return '不定时';
    }
  }

  private timerOptions(): TtsTimer[] {
    return ['off', '5min', '10min', '15min', '30min', 'chapterEnd'];
  }

  private timerOptionLabel(timer: TtsTimer): string {
    if (timer === 'off') return '不定时';
    return this.timerLabel(timer);
  }

  private timerMinutes(): string {
    switch (this.ttsTimer) {
      case '5min': return '05';
      case '10min': return '10';
      case '15min': return '15';
      case '30min': return '30';
      default: return '00';
    }
  }

  private cycleTimer(): void {
    let next: TtsTimer = '5min';
    switch (this.ttsTimer) {
      case '5min': next = '10min'; break;
      case '10min': next = '15min'; break;
      case '15min': next = '30min'; break;
      case '30min': next = 'off'; break;
      default: next = '5min'; break;
    }
    ReaderUiStore.dispatch({ type: 'tts-set-timer', ttsTimer: next });
  }

  private voiceLabel(): string {
    if (this.ttsVoice.length === 0 || this.ttsVoice === 'system-default') return '系统默认';
    return this.ttsVoice;
  }

  private updateRate(value: number, mode: SliderChangeMode): void {
    if (mode === SliderChangeMode.Begin) return;
    ReaderUiStore.dispatch({ type: 'tts-set-rate', ttsRate: Math.round(value) / 10 });
  }

  private stop(): void {
    ReaderUiStore.dispatch({ type: 'reader-tts-stop' });
  }

  private start(): void {
    MotionAdapter.apply('reader.session.tts.start', this.reducedMotion, this.getUIContext(), () => {
      ReaderUiStore.startTtsFromReaderSurface();
    });
  }

  build() {
    // Page/Reader Full TTS, current Phone master 942:78.  This is deliberately
    // not the old generic settings-card composition: the Figma master has its
    // own transport, timer, rate, detail and device-engine sections.  Only
    // transport/timer/rate are interactive because those are the operations
    // backed by the current Reader-UI/Core/Host contract.
    ReaderFullPanelShell({
      title: '朗读',
      quickRoute: 'tts',
      debugLabel: 'ReaderExpandedPanel',
    }) {
      Scroll() {
        Column({ space: 0 }) {
          Column({ space: 0 }) {
            Row() {
              Text('播放控制区')
                .fontSize(12)
                .fontWeight(700)
                .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
                .fontColor(ReaderUiVisualTokens.readerFullTtsInk)
                .layoutWeight(1)
              Text(this.playbackStatus())
                .fontSize(10)
                .fontWeight(500)
                .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
                .fontColor(ReaderUiVisualTokens.readerFullTtsMuted)
            }
            .width('100%')
            .height(28)

            Row({ space: 12 }) {
              Stack({ alignContent: Alignment.Center }) {
                Image($r('app.media.reader_control_compact_prev'))
                  .width(16)
                  .height(16)
              }
              .width(44)
              .height(44)
              .borderRadius(999)
              .border({ width: 1, color: ReaderUiVisualTokens.readerFullTtsSectionBorder })
              .backgroundColor(ReaderUiVisualTokens.readerFullTtsTransportSurface)
              .opacity(this.hasQueue() ? 1 : 0.48)
              .enabled(this.hasQueue())
              .onClick(() => ReaderUiStore.dispatch({ type: 'tts-prev' }))

              Stack({ alignContent: Alignment.Center }) {
                Image($r('app.media.reader_control_play'))
                  .width(21)
                  .height(21)
              }
              .width(52)
              .height(52)
              .borderRadius(999)
              .backgroundColor(ReaderUiVisualTokens.readerFullTtsPrimary)
              .opacity(this.canStart() && this.playback !== 'playing' ? 1 : 0.48)
              .enabled(this.canStart() && this.playback !== 'playing')
              .onClick(() => this.start())

              Stack({ alignContent: Alignment.Center }) {
                Image($r('app.media.reader_control_tts_stop'))
                  .width(44)
                  .height(44)
              }
              .width(44)
              .height(44)
              .borderRadius(999)
              .opacity(this.playback === 'idle' ? 0.48 : 1)
              .enabled(this.playback !== 'idle')
              .onClick(() => this.stop())

              Stack({ alignContent: Alignment.Center }) {
                Image($r('app.media.reader_control_compact_next'))
                  .width(16)
                  .height(16)
              }
              .width(44)
              .height(44)
              .borderRadius(999)
              .border({ width: 1, color: ReaderUiVisualTokens.readerFullTtsSectionBorder })
              .backgroundColor(ReaderUiVisualTokens.readerFullTtsTransportSurface)
              .opacity(this.hasQueue() ? 1 : 0.48)
              .enabled(this.hasQueue())
              .onClick(() => ReaderUiStore.dispatch({ type: 'tts-next' }))
            }
            .width('100%')
            .height(68)
            .margin({ top: 8 })
            .justifyContent(FlexAlign.Center)
            .alignItems(VerticalAlign.Center)
          }
          .width('100%')
          .height(128)
          .padding({ top: 12 })

          Column({ space: 0 }) {
            Row() {
              Text('定时')
                .fontSize(12)
                .fontWeight(700)
                .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
                .fontColor(ReaderUiVisualTokens.readerFullTtsInk)
                .layoutWeight(1)
              Text(this.timerLabel())
                .fontSize(10)
                .fontWeight(500)
                .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
                .fontColor(ReaderUiVisualTokens.readerFullTtsMuted)
            }
            .width('100%')
            .height(28)

            Column({ space: 0 }) {
              Row({ space: 12 }) {
                Stack({ alignContent: Alignment.Center }) {
                  Image($r('app.media.reader_control_tts_clock'))
                    .width(24)
                    .height(24)
                }
                .width(44)
                .height(44)
                .border({ width: 1, color: ReaderUiVisualTokens.readerFullTtsSectionBorder })
                .borderRadius(ReaderUiVisualTokens.readerFullTtsSectionRadius)
                .backgroundColor(ReaderUiVisualTokens.readerFullTtsTransportSurface)
                Column({ space: 2 }) {
                  Text('朗读后停止')
                    .fontSize(10)
                    .fontWeight(400)
                    .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
                    .fontColor(ReaderUiVisualTokens.readerFullTtsMuted)
                  Text(this.timerLabel())
                    .fontSize(20)
                    .fontWeight(700)
                    .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
                    .fontColor(ReaderUiVisualTokens.readerFullTtsInk)
                }
                .alignItems(HorizontalAlign.Start)
              }
              .width('100%')
              .height(44)
              .justifyContent(FlexAlign.Center)

              Row({ space: 8 }) {
                ReaderFullTtsTimerDial({ value: this.timerMinutes(), unit: '分' })
                Text(':')
                  .fontSize(15)
                  .fontWeight(700)
                  .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
                  .fontColor(ReaderUiVisualTokens.readerFullTtsMuted)
                  .width(5)
                  .textAlign(TextAlign.Center)
                ReaderFullTtsTimerDial({ value: '00', unit: '秒' })
              }
              .width('100%')
              .height(167)
              .margin({ top: 16 })
              .padding({ left: 9, right: 9, top: 9, bottom: 9 })
              .border({ width: 1, color: ReaderUiVisualTokens.readerFullTtsSectionBorder })
              .borderRadius(ReaderUiVisualTokens.readerFullTtsSectionRadius)
              .backgroundColor(ReaderUiVisualTokens.readerFullTtsTransportSurface)
              .alignItems(VerticalAlign.Center)
              .onClick(() => this.cycleTimer())
            }
            .width('100%')
            .height(253)
            .margin({ top: 8 })
            .padding({ left: 13, right: 13, top: 13, bottom: 13 })
            .border({ width: 1, color: ReaderUiVisualTokens.readerFullTtsSectionBorder })
            .borderRadius(ReaderUiVisualTokens.readerFullTtsSectionRadius)
            .backgroundColor(ReaderUiVisualTokens.readerFullTtsSectionSurface)
          }
          .width('100%')
          .height(314)
          .padding({ top: 13 })
          .border({ width: 1, color: ReaderUiVisualTokens.readerFullTtsSectionBorder })

          Column({ space: 0 }) {
            Row() {
              Text('语速')
                .fontSize(12)
                .fontWeight(700)
                .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
                .fontColor(ReaderUiVisualTokens.readerFullTtsInk)
                .layoutWeight(1)
              Text(this.rateLabel())
                .fontSize(10)
                .fontWeight(500)
                .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
                .fontColor(ReaderUiVisualTokens.readerFullTtsMuted)
            }
            .width('100%')
            .height(28)
            Row({ space: 10 }) {
              Text('0.5x')
                .fontSize(10)
                .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
                .fontColor(ReaderUiVisualTokens.readerFullTtsMuted)
              Slider({ value: this.ttsRate * 10, min: 5, max: 20, step: 1, style: SliderStyle.OutSet })
                .layoutWeight(1)
                .height(44)
                .trackColor(ReaderUiVisualTokens.readerFullTtsSectionBorder)
                .selectedColor(ReaderUiVisualTokens.readerFullTtsPrimary)
                .blockColor(ReaderUiVisualTokens.readerFullTtsPrimary)
                .onChange((value: number, mode: SliderChangeMode) => this.updateRate(value, mode))
              Text('2.0x')
                .fontSize(10)
                .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
                .fontColor(ReaderUiVisualTokens.readerFullTtsMuted)
            }
            .width('100%')
            .margin({ top: 8 })
            .alignItems(VerticalAlign.Center)
          }
          .width('100%')
          .height(105)
          .padding({ top: 13 })
          .border({ width: 1, color: ReaderUiVisualTokens.readerFullTtsSectionBorder })

          Column({ space: 0 }) {
            Row() {
              Text('详细配置')
                .fontSize(12)
                .fontWeight(700)
                .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
                .fontColor(ReaderUiVisualTokens.readerFullTtsInk)
                .layoutWeight(1)
              Text('即时生效')
                .fontSize(10)
                .fontWeight(500)
                .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
                .fontColor(ReaderUiVisualTokens.readerFullTtsMuted)
            }
            .width('100%')
            .height(28)
            Column({ space: 0 }) {
              Row({ space: 8 }) {
                Text('音色选项')
                  .fontSize(12)
                  .fontWeight(700)
                  .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
                  .fontColor(ReaderUiVisualTokens.readerFullTtsControlInk)
                  .layoutWeight(1)
                Row({ space: 3 }) {
                  Text(this.voiceLabel())
                    .fontSize(10)
                    .fontWeight(500)
                    .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
                    .fontColor(ReaderUiVisualTokens.readerFullTtsControlInk)
                    .layoutWeight(1)
                    .maxLines(1)
                    .textOverflow({ overflow: TextOverflow.Ellipsis })
                  Text('⌄')
                    .fontSize(10)
                    .fontColor(ReaderUiVisualTokens.readerFullTtsMuted)
                }
                .width(70)
                .height(36)
                .padding({ left: 6, right: 6 })
                .border({ width: 1, color: ReaderUiVisualTokens.readerFullTtsSectionBorder })
                .borderRadius(ReaderUiVisualTokens.readerFullTtsFieldRadius)
                .backgroundColor(ReaderUiVisualTokens.readerFullTtsFieldSurface)
                .alignItems(VerticalAlign.Center)
              }
              .width('100%')
              .height(47)
              .padding({ left: 10, right: 10 })
              .border({ width: { bottom: 1 }, color: ReaderUiVisualTokens.readerFullTtsSectionBorder })
              .alignItems(VerticalAlign.Center)
              Row() {
                Text('跟随高亮')
                  .fontSize(12)
                  .fontWeight(700)
                  .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
                  .fontColor(ReaderUiVisualTokens.readerFullTtsControlInk)
                  .layoutWeight(1)
                ReaderFullTtsSwitch({ active: true })
              }
              .width('100%')
              .height(44)
              .padding({ left: 10, right: 10 })
              .border({ width: { bottom: 1 }, color: ReaderUiVisualTokens.readerFullTtsSectionBorder })
              .alignItems(VerticalAlign.Center)
              Row() {
                Text('来电暂停')
                  .fontSize(12)
                  .fontWeight(700)
                  .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
                  .fontColor(ReaderUiVisualTokens.readerFullTtsControlInk)
                  .layoutWeight(1)
                ReaderFullTtsSwitch({ active: true })
              }
              .width('100%')
              .height(44)
              .padding({ left: 10, right: 10 })
              .border({ width: { bottom: 1 }, color: ReaderUiVisualTokens.readerFullTtsSectionBorder })
              .alignItems(VerticalAlign.Center)
              Row() {
                Text('允许与其他应用同时播放')
                  .fontSize(12)
                  .fontWeight(700)
                  .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
                  .fontColor(ReaderUiVisualTokens.readerFullTtsControlInk)
                  .layoutWeight(1)
                ReaderFullTtsSwitch({ active: false })
              }
              .width('100%')
              .height(44)
              .padding({ left: 10, right: 10 })
              .alignItems(VerticalAlign.Center)
            }
            .width('100%')
            .height(181)
            .margin({ top: 8 })
            .border({ width: 1, color: ReaderUiVisualTokens.readerFullTtsSectionBorder })
            .borderRadius(ReaderUiVisualTokens.readerFullTtsFieldRadius)
            .backgroundColor(ReaderUiVisualTokens.readerFullTtsSectionSurface)
          }
          .width('100%')
          .height(242)
          .padding({ top: 13 })
          .border({ width: 1, color: ReaderUiVisualTokens.readerFullTtsSectionBorder })

          Column({ space: 0 }) {
            Row() {
              Text('TTS 配置')
                .fontSize(12)
                .fontWeight(700)
                .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
                .fontColor(ReaderUiVisualTokens.readerFullTtsInk)
                .layoutWeight(1)
              Text('设备引擎')
                .fontSize(10)
                .fontWeight(500)
                .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
                .fontColor(ReaderUiVisualTokens.readerFullTtsMuted)
            }
            .width('100%')
            .height(28)
            Column({ space: 0 }) {
              ReaderFullTtsEngineTab({ title: '系统 TTS', detail: '使用设备内置语音', selected: true })
              ReaderFullTtsEngineTab({ title: '在线 TTS', detail: '第三方或自定义服务' })
            }
            .width('100%')
            .height(116)
            .margin({ top: 8 })
            .padding({ left: 3, right: 3, top: 3, bottom: 3 })
            .border({ width: 1, color: ReaderUiVisualTokens.readerFullTtsSectionBorder })
            .borderRadius(ReaderUiVisualTokens.readerFullTtsFieldRadius)
            .backgroundColor(ReaderUiVisualTokens.readerFullTtsSectionSurface)
            Column({ space: 0 }) {
              Row({ space: 8 }) {
                Text('系统引擎')
                  .fontSize(12)
                  .fontWeight(700)
                  .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
                  .fontColor(ReaderUiVisualTokens.readerFullTtsControlInk)
                  .layoutWeight(1)
                Text(this.voiceLabel())
                  .fontSize(10)
                  .fontWeight(500)
                  .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
                  .fontColor(ReaderUiVisualTokens.readerFullTtsControlInk)
                  .width(94)
                  .height(36)
                  .padding({ left: 7, right: 7 })
                  .border({ width: 1, color: ReaderUiVisualTokens.readerFullTtsSectionBorder })
                  .borderRadius(ReaderUiVisualTokens.readerFullTtsFieldRadius)
                  .backgroundColor(ReaderUiVisualTokens.readerFullTtsTransportSurface)
                  .textAlign(TextAlign.Center)
                  .maxLines(1)
                  .textOverflow({ overflow: TextOverflow.Ellipsis })
              }
              .width('100%')
              .height(45)
              .padding({ left: 10, right: 10 })
              .border({ width: { bottom: 1 }, color: ReaderUiVisualTokens.readerFullTtsSectionBorder })
              .alignItems(VerticalAlign.Center)
              Row({ space: 8 }) {
                Text('语言')
                  .fontSize(12)
                  .fontWeight(700)
                  .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
                  .fontColor(ReaderUiVisualTokens.readerFullTtsControlInk)
                  .layoutWeight(1)
                Text('中文')
                  .fontSize(10)
                  .fontWeight(500)
                  .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
                  .fontColor(ReaderUiVisualTokens.readerFullTtsControlInk)
                  .width(61)
                  .height(36)
                  .border({ width: 1, color: ReaderUiVisualTokens.readerFullTtsSectionBorder })
                  .borderRadius(ReaderUiVisualTokens.readerFullTtsFieldRadius)
                  .backgroundColor(ReaderUiVisualTokens.readerFullTtsTransportSurface)
                  .textAlign(TextAlign.Center)
              }
              .width('100%')
              .height(45)
              .padding({ left: 10, right: 10 })
              .border({ width: { bottom: 1 }, color: ReaderUiVisualTokens.readerFullTtsSectionBorder })
              .alignItems(VerticalAlign.Center)
              Row({ space: 8 }) {
                Text('音频会话')
                  .fontSize(12)
                  .fontWeight(700)
                  .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
                  .fontColor(ReaderUiVisualTokens.readerFullTtsControlInk)
                  .layoutWeight(1)
                Text('媒体')
                  .fontSize(10)
                  .fontWeight(500)
                  .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
                  .fontColor(ReaderUiVisualTokens.readerFullTtsControlInk)
                  .width(106)
                  .height(36)
                  .border({ width: 1, color: ReaderUiVisualTokens.readerFullTtsSectionBorder })
                  .borderRadius(ReaderUiVisualTokens.readerFullTtsFieldRadius)
                  .backgroundColor(ReaderUiVisualTokens.readerFullTtsTransportSurface)
                  .textAlign(TextAlign.Center)
              }
              .width('100%')
              .height(45)
              .padding({ left: 10, right: 10 })
              .border({ width: { bottom: 1 }, color: ReaderUiVisualTokens.readerFullTtsSectionBorder })
              .alignItems(VerticalAlign.Center)
              Row({ space: 8 }) {
                Text('不可用处理')
                  .fontSize(12)
                  .fontWeight(700)
                  .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
                  .fontColor(ReaderUiVisualTokens.readerFullTtsControlInk)
                  .layoutWeight(1)
                Text('跳过')
                  .fontSize(10)
                  .fontWeight(500)
                  .fontFamily(ReaderUiVisualTokens.readerFullHeaderFontFamily)
                  .fontColor(ReaderUiVisualTokens.readerFullTtsControlInk)
                  .width(106)
                  .height(36)
                  .border({ width: 1, color: ReaderUiVisualTokens.readerFullTtsSectionBorder })
                  .borderRadius(ReaderUiVisualTokens.readerFullTtsFieldRadius)
                  .backgroundColor(ReaderUiVisualTokens.readerFullTtsTransportSurface)
                  .textAlign(TextAlign.Center)
              }
              .width('100%')
              .height(45)
              .padding({ left: 10, right: 10 })
              .alignItems(VerticalAlign.Center)
            }
            .width('100%')
            .height(182)
            .margin({ top: 12 })
            .border({ width: 1, color: ReaderUiVisualTokens.readerFullTtsSectionBorder })
            .borderRadius(ReaderUiVisualTokens.readerFullTtsFieldRadius)
            .backgroundColor(ReaderUiVisualTokens.readerFullTtsSectionSurface)
          }
          .width('100%')
          .height(371)
          .padding({ top: 13 })
          .border({ width: 1, color: ReaderUiVisualTokens.readerFullTtsSectionBorder })
        }
        .width('100%')
        .padding({ left: 12, right: 12, top: 10, bottom: 0 })
      }
      .width('100%')
      .height('100%')
      .scrollBar(BarState.Off)
    }
  }
}

@Component
export struct ReaderFullAppearancePage {
  @StorageProp('reader.typography.fontSize') fontSize: number = ReaderAppearanceSpecRegistry.stepper('fontSize')!.defaultValue;
  @StorageProp('reader.typography.lineHeight') lineHeightRatio: number = ReaderAppearanceSpecRegistry.stepper('lineHeight')!.defaultValue;
  @StorageProp('reader.typography.paragraphGap') paragraphGap: number = ReaderAppearanceSpecRegistry.stepper('paragraphGap')!.defaultValue;
  @StorageProp('reader.typography.letterSpacing') letterSpacing: number = ReaderAppearanceSpecRegistry.stepper('letterSpacing')!.defaultValue;
  @StorageProp('reader.readerSettingOptions.paragraphIndentMode') paragraphIndentMode: string = ReaderAppearanceSpecRegistry.select('paragraphIndentMode')!.defaultValue;
  @StorageProp('reader.readerSettingOptions.textConversion') textConversion: string = ReaderAppearanceSpecRegistry.select('textConversion')!.defaultValue;
  @StorageProp('reader.readerSettingOptions.pageAnimation') pageAnimation: string = ReaderAppearanceSpecRegistry.select('pageAnimation')!.defaultValue;
  @StorageProp('reader.readerSettingOptions.textAlignment') textAlignment: string = ReaderAppearanceSpecRegistry.select('textAlignment')!.defaultValue;

  private whole(value: number): string {
    return `${Math.round(value)}`;
  }

  private one(value: number): string {
    return `${Math.round(value * 10) / 10}`;
  }

  private two(value: number): string {
    return `${Math.round(value * 100) / 100}`;
  }

  build() {
    ReaderFullPanelShell({ title: '界面', quickRoute: 'reader-appearance', debugLabel: 'ReaderExpandedPanel' }) {
      Scroll() {
        Column({ space: 0 }) {
          ReaderFullBlock({ title: '主题库', meta: '日间：纸纹 · 夜间：夜纹' }) {
            ReaderFullThemeGrid()
          }
          ReaderFullBlock({ title: '排版库', meta: '即时应用', separator: true }) {
            Column({ space: 8 }) {
              Row({ space: 12 }) {
                ReaderFullAppearanceSelectRow({ label: '缩进', value: this.paragraphIndentMode, optionKey: 'paragraphIndentMode' })
                ReaderFullAppearanceSelectRow({ label: '简繁', value: this.textConversion, optionKey: 'textConversion' })
              }
              .width('100%')
              Row({ space: 12 }) {
                ReaderFullAppearanceSelectRow({ label: '翻页动画', value: this.pageAnimation, optionKey: 'pageAnimation' })
                ReaderFullAppearanceSelectRow({ label: '文字两端对齐', value: this.textAlignment, optionKey: 'textAlignment' })
              }
              .width('100%')
              Column() {
                ReaderFullStepperRow({ label: '字号', value: this.whole(this.fontSize), metric: 'fontSize' })
                ReaderFullStepperRow({ label: '行距', value: this.two(this.lineHeightRatio), metric: 'lineHeight', divider: true })
                ReaderFullStepperRow({ label: '段距', value: this.whole(this.paragraphGap), metric: 'paragraphGap', divider: true })
                ReaderFullStepperRow({ label: '字距', value: this.one(this.letterSpacing), metric: 'letterSpacing', divider: true })
              }
              .width('100%')
            }
            .width('100%')
          }
          ReaderFullBlock({ title: '字体库', meta: '可拖动调整位置', separator: true }) {
            ReaderFullFontChoiceRow()
          }
        }
        .width('100%')
      }
      .width('100%')
      .height('100%')
      .scrollBar(BarState.Off)
    }
  }
}

@Component
struct ReaderFullFigmaChoiceRow {
  @Prop label: string = '';
  @Prop values: string[] = [];
  @Prop active: string = '';
  @Prop choiceKey: string = '';

  build() {
    Column({ space: 7 }) {
      Text(this.label)
        .fontFamily(ReaderUiVisualTokens.readerFullSettingsFontFamily)
        .fontSize(ReaderUiVisualTokens.readerFullSettingsRowLabelSize)
        .fontWeight(600)
        .fontColor(ReaderUiVisualTokens.readerFullSettingsChoiceInk)
        .width('100%')
        .height(16)
      ReaderFullChoiceRow({ values: this.values, active: this.active, choiceKey: this.choiceKey })
    }
    .width('100%')
    .height(72)
    .padding({ top: 8, bottom: 8 })
  }
}

@Component
struct ReaderFullFigmaSwitch {
  @Prop active: boolean = false;
  @Prop toggleKey: string = '';
  @Prop optionKey: string = '';

  private canToggle(): boolean {
    return this.toggleKey.length > 0 || this.optionKey === 'textAlignment';
  }

  private toggle(): void {
    if (this.toggleKey.length > 0) {
      ReaderUiStore.dispatch({ type: 'set-reader-toggle', toggleKey: this.toggleKey as ReaderToggleKey, toggleValue: !this.active });
    } else if (this.optionKey === 'textAlignment') {
      ReaderUiStore.dispatch({
        type: 'set-reader-setting-option',
        optionKey: 'textAlignment',
        optionValue: this.active ? 'leading' : 'justify',
      });
    }
  }

  build() {
    Stack({ alignContent: this.active ? Alignment.End : Alignment.Start }) {
      Column()
        .width(20)
        .height(20)
        .borderRadius(10)
        .backgroundColor(ReaderUiVisualTokens.readerFullSettingsSwitchKnob)
        .margin({ left: 2, right: 2 })
    }
    .width(44)
    .height(24)
    .borderRadius(999)
    .backgroundColor(this.active
      ? ReaderUiVisualTokens.readerFullSettingsSwitchActive
      : ReaderUiVisualTokens.readerFullSettingsSwitchInactive)
    .enabled(this.canToggle())
    .onClick(() => {
      if (this.canToggle()) this.toggle();
    })
  }
}

@Component
struct ReaderFullFigmaToggleRow {
  @Prop title: string = '';
  @Prop active: boolean = false;
  @Prop toggleKey: string = '';
  @Prop optionKey: string = '';

  build() {
    Row() {
      Text(this.title)
        .fontFamily(ReaderUiVisualTokens.readerFullSettingsFontFamily)
        .fontSize(ReaderUiVisualTokens.readerFullSettingsRowLabelSize)
        .fontWeight(600)
        .fontColor(ReaderUiVisualTokens.readerFullSettingsChoiceInk)
        .layoutWeight(1)
      // An empty key intentionally leaves an unbound Figma control inert. It
      // preserves the design without inventing a Host capability or a fake
      // “unavailable” explanation inside the approved UI.
      ReaderFullFigmaSwitch({ active: this.active, toggleKey: this.toggleKey, optionKey: this.optionKey })
    }
    .width('100%')
    .height(38)
    .alignItems(VerticalAlign.Center)
  }
}

@Component
export struct ReaderFullSettingsPage {
  @StorageProp('reader.readerToggles.keepScreenOn') keepScreenOn: boolean = false;
  @StorageProp('reader.readerToggles.hideStatusBar') hideStatusBar: boolean = false;
  @StorageProp('reader.readerToggles.volumePage') volumePage: boolean = false;
  @StorageProp('reader.readerSettingOptions.textAlignment') textAlignment: string = 'justify';
  @StorageProp('reader.readerSettingOptions.pageAnimation') pageAnimation: string = ReaderAppearanceSpecRegistry.select('pageAnimation')!.defaultValue;

  private screenTimeout(): string {
    return this.keepScreenOn ? '始终开启' : '5 分钟';
  }

  build() {
    ReaderFullPanelShell({ title: '设置', quickRoute: 'reader-settings', debugLabel: 'ReaderExpandedPanel' }) {
      Scroll() {
        Column({ space: 0 }) {
          ReaderFullBlock({ title: '屏幕样式' }) {
            Column({ space: 10 }) {
              ReaderFullFigmaChoiceRow({
                label: '屏幕方向',
                values: ['跟随系统', '竖屏', '横屏'],
                active: '跟随系统',
              })
              ReaderFullFigmaChoiceRow({
                label: '翻页样式',
                values: ['覆盖', '滑动', '仿真', '滚动', '无动画'],
                active: this.pageAnimation,
                choiceKey: 'pageAnimation',
              })
              ReaderFullFigmaChoiceRow({
                label: '屏幕超时',
                values: ['跟随系统', '1 分钟', '5 分钟', '10 分钟', '始终开启'],
                active: this.screenTimeout(),
                choiceKey: 'screenTimeout',
              })
            }
            .width('100%')
          }

          ReaderFullBlock({ title: '导航状态栏', separator: true }) {
            Column() {
              ReaderFullFigmaToggleRow({ title: '隐藏状态栏', active: this.hideStatusBar, toggleKey: 'hideStatusBar' })
              ReaderFullFigmaToggleRow({ title: '隐藏导航栏' })
              ReaderFullFigmaToggleRow({ title: '拓展到刘海（灵动岛）' })
            }
            .width('100%')
          }

          ReaderFullBlock({ title: '排版', separator: true }) {
            Column() {
              ReaderFullFigmaToggleRow({ title: '文字两端对齐', active: this.textAlignment === 'justify', optionKey: 'textAlignment' })
              ReaderFullFigmaToggleRow({ title: '底部对齐' })
            }
            .width('100%')
          }

          ReaderFullBlock({ title: '控制', separator: true }) {
            Column() {
              ReaderFullFigmaToggleRow({ title: '音量键翻页', active: this.volumePage })
              ReaderFullFigmaToggleRow({ title: '息屏终止朗读' })
              ReaderFullFigmaToggleRow({ title: '长按选择文本' })
            }
            .width('100%')
          }
        }
        .width('100%')
      }
      .width('100%')
      .height('100%')
      .scrollBar(BarState.Off)
    }
  }
}

@Component
struct ReaderUtilitySummaryCard {
  @Prop value: string = '';
  @Prop label: string = '';

  build() {
    Column({ space: 4 }) {
      Text(this.value)
        .fontSize(13)
        .fontWeight(820)
        .fontColor(ColorTokens.controlInk)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
      Text(this.label)
        .fontSize(9)
        .fontWeight(600)
        .fontColor(ColorTokens.muted)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
    }
    .layoutWeight(1)
    .padding({ left: 9, right: 9, top: 9, bottom: 9 })
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
  }
}

@Component
struct ReaderUtilityActionButton {
  @Prop title: string = '';
  @Prop detail: string = '';
  @Prop danger: boolean = false;
  @Prop disabled: boolean = false;
  @Prop action: string = '';

  private dispatchAction(): void {
    if (this.disabled) return;
    const state = ReaderUiStore.snapshot();
    let event: UiEvent | null = null;
    let method = 'cache.book.status';
    if (this.action === 'status') {
      event = ReaderSlice10LivePayloadResolver.cacheBookStatusEvent(state);
    } else if (this.action === 'prefetch-current') {
      method = 'cache.book.prefetch';
      event = ReaderSlice10LivePayloadResolver.cacheBookPrefetchEvent(state, 'current');
    } else if (this.action === 'prefetch-next') {
      method = 'cache.book.prefetch';
      event = ReaderSlice10LivePayloadResolver.cacheBookPrefetchEvent(state, 'next');
    } else if (this.action === 'clear-book') {
      method = 'cache.clear';
      event = ReaderSlice10LivePayloadResolver.cacheClearEvent(state, 'book');
    }
    if (event !== null) {
      ReaderUiStore.dispatch(event);
      return;
    }
    const message = '当前书籍、书源或章节范围已变化，请返回阅读页后重试。';
    ReaderUiStore.dispatch({
      type: 'core-slice10-failed',
      coreSlice10Method: method,
      coreSlice10Error: message,
      error: { code: 'CORE_SLICE10_LIVE_CONTEXT_REQUIRED', message: message, retryable: false },
    });
  }

  build() {
    Row({ space: 8 }) {
      Text(this.danger ? '删' : '动')
        .fontSize(11)
        .fontWeight(900)
        .fontColor(this.danger ? ColorTokens.accent : ColorTokens.primaryDark)
        .width(24)
        .height(24)
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.floatingControlBgAlt)
        .textAlign(TextAlign.Center)
      Column({ space: 2 }) {
        Text(this.title)
          .fontSize(11)
          .fontWeight(800)
          .fontColor(this.danger ? ColorTokens.accent : ColorTokens.controlInk)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(this.detail)
          .fontSize(9)
          .fontWeight(600)
          .fontColor(ColorTokens.muted)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)
    }
    .layoutWeight(1)
    .height(54)
    .padding({ left: 8, right: 8 })
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .alignItems(VerticalAlign.Center)
    .opacity(this.disabled ? 0.58 : 1)
    .enabled(!this.disabled)
    .onClick(() => this.dispatchAction())
  }
}

@Component
struct ReaderLoadedParagraphRow {
  @Prop index: number = 0;
  @Prop text: string = '';

  build() {
    Row({ space: 8 }) {
      Column({ space: 2 }) {
        Text(`本地片段 ${this.index + 1}`)
          .fontSize(12)
          .fontWeight(820)
          .fontColor(ColorTokens.controlInk)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(this.text)
          .fontSize(9)
          .fontColor(ColorTokens.muted)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)
      Text('当前内存')
        .fontSize(9)
        .fontWeight(760)
        .fontColor(ColorTokens.primaryDark)
        .height(24)
        .padding({ left: 8, right: 8 })
        .borderRadius(DemoAliasTokens.radiusSm)
        .backgroundColor(ColorTokens.floatingControlBgAlt)
        .textAlign(TextAlign.Center)
    }
    .width('100%')
    .height(42)
    .padding({ left: 9, right: 9 })
    .border({ width: { top: 1 }, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
  }
}

@Component
export struct ReaderBookCachePage {
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;
  @StorageProp('reader.chapterContent') chapterContent: string[] = [];
  @StorageProp('reader.currentChapterTitle') currentChapterTitle: string = '';
  @StorageProp('reader.loading') loading: boolean = false;
  @StorageProp('reader.coreSlice10Method') coreSlice10Method: string = '';
  @StorageProp('reader.coreSlice10Loading') coreSlice10Loading: boolean = false;
  @StorageProp('reader.coreSlice10Result') coreSlice10Result: ReaderUIJSONPayload | null = null;
  @StorageProp('reader.coreSlice10Error') coreSlice10Error: string = '';

  aboutToAppear(): void {
    if (this.coreSlice10Loading) return;
    const event = ReaderSlice10LivePayloadResolver.cacheBookStatusEvent(ReaderUiStore.snapshot());
    if (event !== null) ReaderUiStore.dispatch(event);
  }

  private canReadStatus(): boolean {
    return ReaderSlice10LivePayloadResolver.cacheBookStatusEvent(ReaderUiStore.snapshot()) !== null;
  }

  private canPrefetchCurrent(): boolean {
    return ReaderSlice10LivePayloadResolver.cacheBookPrefetchEvent(
      ReaderUiStore.snapshot(), 'current',
    ) !== null;
  }

  private canPrefetchNext(): boolean {
    return ReaderSlice10LivePayloadResolver.cacheBookPrefetchEvent(
      ReaderUiStore.snapshot(), 'next',
    ) !== null;
  }

  private resultNumber(key: string): string {
    if (this.coreSlice10Result === null) return '--';
    const value = this.coreSlice10Result[key];
    return typeof value === 'number' && Number.isSafeInteger(value) ? `${value}` : '--';
  }

  private cachedCount(): string {
    return this.coreSlice10Method === 'cache.book.status' ? this.resultNumber('cachedCount') : '--';
  }

  private queuedCount(): string {
    return this.coreSlice10Method === 'cache.book.status' ? this.resultNumber('queuedCount') : '--';
  }

  private commandMessage(): string {
    if (this.coreSlice10Loading) return `${this.coreSlice10Method} 正在执行…`;
    if (this.coreSlice10Error.length > 0) return this.coreSlice10Error;
    if (this.coreSlice10Result === null) return '进入页面后将读取当前书籍的 Core 缓存状态。';
    if (this.coreSlice10Method === 'cache.book.status') {
      return `Core 已返回：缓存 ${this.resultNumber('cachedCount')} 章，队列 ${this.resultNumber('queuedCount')} 章。`;
    }
    if (this.coreSlice10Method === 'cache.book.prefetch') {
      return `预取完成：新入队 ${this.resultNumber('prefetchedCount')} 章。可点击“刷新状态”查看队列。`;
    }
    if (this.coreSlice10Method === 'cache.clear') {
      return `清理完成：移除 ${this.resultNumber('cacheEntriesRemoved')} 个缓存条目。`;
    }
    return `${this.coreSlice10Method} 已完成。`;
  }

  private loadedParagraphs(): string[] {
    if (this.currentBook === null) return [];
    const paragraphs: string[] = [];
    for (let i = 0; i < this.chapterContent.length; i += 1) {
      if (this.chapterContent[i].trim().length > 0) paragraphs.push(this.chapterContent[i]);
    }
    return paragraphs;
  }

  private chapterLabel(): string {
    if (this.currentBook === null) return '未选择书籍';
    return this.currentChapterTitle.length > 0 ? this.currentChapterTitle : 'Core 未返回当前章节';
  }

  private loadedContentMessage(): string {
    if (this.currentBook === null) return '尚未选择书籍，无法展示当前已加载章节正文。';
    if (this.loading) return '正在加载章节正文，当前没有可展示的本地片段。';
    return 'Core 未返回本章正文，当前没有可展示的本地片段。';
  }

  build() {
    ReaderFullPanelShell({ title: '书籍缓存', quickRoute: 'reader', debugLabel: 'ReaderUtilityPage', utility: true }) {
      Scroll() {
        Column({ space: 10 }) {
          Row({ space: 8 }) {
            ReaderUtilitySummaryCard({ value: this.cachedCount(), label: 'Core 已缓存章节' })
            ReaderUtilitySummaryCard({ value: this.queuedCount(), label: 'Core 队列章节' })
            ReaderUtilitySummaryCard({ value: this.chapterLabel(), label: '当前章节' })
          }
          .width('100%')

          ReaderFullBlock({ title: '缓存能力', meta: 'Core 状态 / 预取 / 按书清理' }) {
            Column({ space: 8 }) {
              Text(this.commandMessage())
                .fontSize(10)
                .fontColor(this.coreSlice10Error.length > 0 ? ColorTokens.accent : ColorTokens.muted)
                .lineHeight(16)
              Row({ space: 8 }) {
                ReaderUtilityActionButton({
                  title: '缓存当前章节', detail: '当前章节范围', action: 'prefetch-current',
                  disabled: this.coreSlice10Loading || !this.canPrefetchCurrent(),
                })
                ReaderUtilityActionButton({
                  title: '预取后续章节', detail: '最多后续 10 章', action: 'prefetch-next',
                  disabled: this.coreSlice10Loading || !this.canPrefetchNext(),
                })
              }
              .width('100%')
              Row({ space: 8 }) {
                ReaderUtilityActionButton({
                  title: '刷新缓存状态', detail: '读取 Core 最新状态', action: 'status',
                  disabled: this.coreSlice10Loading || !this.canReadStatus(),
                })
                ReaderUtilityActionButton({
                  title: '清理本书缓存', detail: '保留书架与备份', action: 'clear-book', danger: true,
                  disabled: this.coreSlice10Loading || !this.canReadStatus(),
                })
              }
              .width('100%')
            }
            .width('100%')
          }

          ReaderFullBlock({ title: '当前已加载正文', meta: '仅内存片段，不等同于磁盘缓存' }) {
            Column() {
              if (this.loadedParagraphs().length === 0) {
                Text(this.loadedContentMessage())
                  .fontSize(11)
                  .fontColor(ColorTokens.muted)
                  .lineHeight(18)
                  .padding(10)
              } else {
                ForEach(this.loadedParagraphs(), (paragraph: string, i: number) => {
                  ReaderLoadedParagraphRow({ index: i, text: paragraph })
                }, (paragraph: string, i: number) => `${i}-${paragraph.length}`)
              }
            }
            .width('100%')
            .borderRadius(DemoAliasTokens.radiusMd)
            .backgroundColor(ColorTokens.surfaceSoft)
          }
        }
        .width('100%')
        .padding(10)
      }
      .width('100%')
      .height('100%')
      .scrollBar(BarState.Off)
    }
  }
}

@Component
struct ReaderDebugMetric {
  @Prop label: string = '';
  @Prop value: string = '';

  build() {
    Column({ space: 4 }) {
      Text(this.label)
        .fontSize(9)
        .fontWeight(700)
        .fontColor(ColorTokens.muted)
      Text(this.value)
        .fontSize(11)
        .fontWeight(780)
        .fontColor(ColorTokens.controlInk)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
    }
    .layoutWeight(1)
    .padding({ left: 8, right: 8, top: 8, bottom: 8 })
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
struct ReaderDebugLogRow {
  @Prop scope: string = '';
  @Prop code: string = '';
  @Prop state: string = '';
  @Prop message: string = '';

  build() {
    Row({ space: 8 }) {
      Column({ space: 2 }) {
        Text(this.scope)
          .fontSize(12)
          .fontWeight(800)
          .fontColor(ColorTokens.controlInk)
          .maxLines(1)
        Text(this.code + ' · ' + this.message)
          .fontSize(9)
          .fontColor(ColorTokens.muted)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)
      Text(this.state)
        .fontSize(9)
        .fontWeight(760)
        .fontColor(ColorTokens.primaryDark)
        .height(24)
        .padding({ left: 8, right: 8 })
        .borderRadius(DemoAliasTokens.radiusSm)
        .backgroundColor(ColorTokens.floatingControlBgAlt)
        .textAlign(TextAlign.Center)
    }
    .width('100%')
    .height(42)
    .padding({ left: 9, right: 9 })
    .border({ width: { top: 1 }, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
  }
}

@Component
export struct ReaderDebugInfoPage {
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;
  @StorageProp('reader.chapterContent') chapterContent: string[] = [];
  @StorageProp('reader.chapterToc') chapterToc: ChapterTocEntry[] = [];
  @StorageProp('reader.currentChapterTitle') currentChapterTitle: string = '';
  @StorageProp('reader.contentSearchQuery') contentSearchQuery: string = '';
  @StorageProp('reader.contentSearchResults') contentSearchResults: CoreContentSearchResult[] = [];
  @StorageProp('reader.contentSearchLoading') contentSearchLoading: boolean = false;
  @StorageProp('reader.contentSearchLoaded') contentSearchLoaded: boolean = false;
  @StorageProp('reader.contentSearchError') contentSearchError: string = '';
  @StorageProp('reader.contentSearchMessage') contentSearchMessage: string = '';
  @StorageProp('reader.loading') loading: boolean = false;
  @StorageProp('reader.pageIndex') readerPageIndex: number = 0;
  @StorageProp('reader.pageCount') readerPageCount: number = 0;
  @StorageProp('reader.errorCode') errorCode: string = '';
  @StorageProp('reader.errorMessage') errorMessage: string = '';

  private loadedParagraphCount(): number {
    if (this.currentBook === null) return 0;
    let count = 0;
    for (let i = 0; i < this.chapterContent.length; i += 1) {
      if (this.chapterContent[i].trim().length > 0) count += 1;
    }
    return count;
  }

  private bookLabel(): string {
    if (this.currentBook === null) return '未选择书籍';
    return this.currentBook.title.length > 0 ? this.currentBook.title : 'Core 未返回书名';
  }

  private chapterLabel(): string {
    if (this.currentBook === null) return '未选择书籍';
    return this.currentChapterTitle.length > 0 ? this.currentChapterTitle : 'Core 未返回当前章节';
  }

  private pageLabel(): string {
    if (this.currentBook === null || this.readerPageCount <= 0) return '未测量';
    const page = Math.max(0, Math.min(this.readerPageCount - 1, this.readerPageIndex)) + 1;
    return `${page}/${this.readerPageCount}`;
  }

  private bodyState(): string {
    if (this.currentBook === null) return '未选择书籍';
    if (this.loading) return '读取中';
    return this.loadedParagraphCount() > 0 ? '已加载片段' : '无正文';
  }

  private tocState(): string {
    if (this.currentBook === null) return '未选择书籍';
    return this.chapterToc.length > 0 ? `已加载 ${this.chapterToc.length} 项` : '未加载目录';
  }

  private errorLabel(): string {
    return this.errorCode.length > 0 ? this.errorCode : '无';
  }

  private contentSearchState(): string {
    if (this.currentBook === null) return '未选择书籍';
    if (this.contentSearchLoading) return 'Core 搜索中';
    if (this.contentSearchError.length > 0) return '失败';
    if (!this.contentSearchLoaded) return '待搜索';
    return this.contentSearchResults.length > 0 ? `命中 ${this.contentSearchResults.length} 条` : '无匹配';
  }

  private contentSearchDetail(): string {
    if (this.contentSearchMessage.length > 0) return this.contentSearchMessage;
    if (this.contentSearchError.length > 0) return this.contentSearchError;
    if (this.contentSearchQuery.length > 0) return `关键词：${this.contentSearchQuery}`;
    return '仅当前书源、当前书籍的 Core chapter cache';
  }

  private diagnostics(): Array<[string, string, string, string]> {
    return [
      ['正文', 'chapter-content', this.bodyState(), `当前内存 ${this.loadedParagraphCount()} 段`],
      ['目录', 'chapter-toc', this.tocState(), this.chapterLabel()],
      ['阅读缓存', 'reader-cache', '已接入', 'Core 状态、预取和清理结果由 reducer 投影'],
      ['正文搜索', 'search.content', this.contentSearchState(), this.contentSearchDetail()],
    ];
  }

  build() {
    ReaderFullPanelShell({ title: '调试信息', quickRoute: 'reader', debugLabel: 'ReaderUtilityPage', utility: true }) {
      Scroll() {
        Column({ space: 10 }) {
          Row({ space: 8 }) {
            ReaderUtilitySummaryCard({ value: this.bookLabel(), label: '当前书籍' })
            ReaderUtilitySummaryCard({ value: this.chapterLabel(), label: '当前章节' })
            ReaderUtilitySummaryCard({ value: this.errorLabel(), label: '当前错误' })
          }
          .width('100%')

          ReaderFullBlock({ title: '渲染状态', meta: '用于核对页面结构和正文渲染链路' }) {
            Column({ space: 8 }) {
              Row({ space: 8 }) {
                ReaderDebugMetric({ label: '正文状态', value: this.bodyState() })
                ReaderDebugMetric({ label: '目录状态', value: this.tocState() })
              }
              .width('100%')
              Row({ space: 8 }) {
                ReaderDebugMetric({ label: '页内分页', value: this.pageLabel() })
                ReaderDebugMetric({ label: '最近错误', value: this.errorMessage.length > 0 ? this.errorMessage : '无' })
              }
              .width('100%')
            }
            .width('100%')
          }

          ReaderFullBlock({ title: '调试日志', meta: '当前阅读链路关键节点' }) {
            Column() {
              ForEach(this.diagnostics(), (row: [string, string, string, string], i: number) => {
                ReaderDebugLogRow({ scope: row[0], code: row[1], state: row[2], message: row[3] })
              }, (row: [string, string, string, string], i: number) => `${row[0]}-${i}`)
            }
            .width('100%')
            .borderRadius(DemoAliasTokens.radiusMd)
            .backgroundColor(ColorTokens.surfaceSoft)
          }

          ReaderFullBlock({ title: '命令可用性', meta: '按真实 Core 能力显示' }) {
            Text('正文全文搜索只查询当前书源、当前书籍的已缓存章节；阅读缓存状态、章节预取和清理已接入 Core。调试日志导出仍保持未接入。')
              .fontSize(11)
              .fontColor(ColorTokens.muted)
              .lineHeight(18)
          }
        }
        .width('100%')
        .padding(10)
      }
      .width('100%')
      .height('100%')
      .scrollBar(BarState.Off)
    }
  }
}

// ── Search panel (.fd-reader-search-quick-panel) ──────────────────────────
//   Core `search.content` searches durable chapter_cache entries only. The
//   panel scopes every request to the currently open sourceId + bookId, so it
//   cannot turn a local snippet or another source's duplicate book id into a
//   reader jump target.
@Component
export struct ReaderSearchPanel {
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;
  @StorageProp('reader.contentSearchResults') contentSearchResults: CoreContentSearchResult[] = [];
  @StorageProp('reader.contentSearchLoading') contentSearchLoading: boolean = false;
  @StorageProp('reader.contentSearchLoaded') contentSearchLoaded: boolean = false;
  @StorageProp('reader.contentSearchError') contentSearchError: string = '';
  @StorageProp('reader.contentSearchMessage') contentSearchMessage: string = '';
  @StorageProp('reader.contentSearchQuery') @Watch('syncQueryFromCoreSearch') contentSearchQuery: string = '';
  @State query: string = '';

  aboutToAppear(): void {
    this.syncQueryFromCoreSearch();
  }

  // A native text-selection "搜索" action dispatches content-search-submit
  // before this route is drawn. Reflect that real selected text in the input
  // rather than leaving a blank field next to already-running Core results.
  private syncQueryFromCoreSearch(): void {
    const keyword = this.contentSearchQuery.trim();
    if (keyword.length > 0) this.query = keyword;
  }

  private hasCoreSearchScope(): boolean {
    if (this.currentBook === null) return false;
    const sourceId = this.currentBook.sourceId;
    return sourceId !== undefined && sourceId.trim().length > 0 && this.currentBook.bookId.trim().length > 0;
  }

  private canSubmit(): boolean {
    return this.hasCoreSearchScope() && !this.contentSearchLoading && this.query.trim().length > 0;
  }

  private submitSearch(): void {
    const keyword = this.query.trim();
    if (!this.hasCoreSearchScope() || keyword.length === 0 || this.contentSearchLoading) return;
    ReaderUiStore.dispatch({ type: 'content-search-submit', query: keyword });
  }

  private resultTitle(result: CoreContentSearchResult): string {
    const title = result.chapterTitle.trim();
    return title.length > 0 ? title : `Core 第 ${result.chapterIndex + 1} 章`;
  }

  private resultDetail(result: CoreContentSearchResult): string {
    const snippet = result.snippet.trim();
    const context = snippet.length > 0 ? snippet : 'Core 未返回上下文片段';
    return `正文偏移 ${result.chapterOffset} · ${context}`;
  }

  private statusMessage(): string {
    if (this.currentBook === null) return '尚未选择书籍，无法搜索正文。';
    if (!this.hasCoreSearchScope()) return '当前书籍缺少 Core sourceId 或 bookId，无法搜索已缓存正文。';
    if (this.contentSearchLoading) return 'Core 正在搜索当前书源、当前书籍的已缓存章节。';
    if (this.contentSearchError.length > 0) return this.contentSearchError;
    if (!this.contentSearchLoaded) return '输入关键词后，Core 仅查询当前书籍已缓存的章节正文。';
    if (this.contentSearchResults.length === 0) return `Core 未在当前书籍的已缓存章节中找到“${this.contentSearchQuery}”。`;
    return '';
  }

  build() {
    ReaderQuickPanelShell({ debugLabel: 'ReaderQuickPanel', contentHeight: 196 }) {
      Column({ space: 5 }) {
        Row({ space: 5 }) {
          ReaderQuickBackButton({ buttonWidth: 51 })
          Row({ space: 8 }) {
            Image($r('app.media.ui_icon_search_primary')).width(11).height(11)
            TextInput({ text: this.query, placeholder: '搜索正文内容' })
              .fontSize(9)
              .fontWeight(760)
              .fontColor(ReaderUiVisualTokens.readerControlMuted)
              .fontFamily(ReaderUiVisualTokens.readerControlFontFamily)
              .layoutWeight(1)
              .height(22)
              .backgroundColor(Color.Transparent)
              .enabled(this.hasCoreSearchScope() && !this.contentSearchLoading)
              .onChange((value: string) => { this.query = value; })
              .onSubmit(() => this.submitSearch())
          }
          .width(167)
          .height(24)
          .padding({ left: 7, right: 7 })
          .border({ width: 1, color: ReaderUiVisualTokens.readerQuickSearchInputBorder })
          .borderRadius(999)
          .backgroundColor(ReaderUiVisualTokens.readerQuickSearchInputSurface)
          .alignItems(VerticalAlign.Center)
          Text('搜索')
            .fontSize(10)
            .fontWeight(750)
            .fontColor(ReaderUiVisualTokens.readerControlSurface)
            .fontFamily(ReaderUiVisualTokens.readerControlFontFamily)
            .width(36)
            .height(24)
            .borderRadius(8)
            .backgroundColor(ReaderUiVisualTokens.readerModuleActive)
            .opacity(this.canSubmit() ? 1 : 0.54)
            .enabled(this.canSubmit())
            .textAlign(TextAlign.Center)
            .onClick(() => this.submitSearch())
        }
        .width('100%')
        .height(24)

        Stack({ alignContent: Alignment.TopStart }) {
          Column() {
          if (this.contentSearchResults.length > 0) {
            ForEach(this.contentSearchResults.slice(0, 2), (result: CoreContentSearchResult, i: number) => {
              ReaderSearchResultRow({
                title: this.resultTitle(result),
                detail: this.resultDetail(result),
                contentSearchResultIndex: i,
              })
            }, (result: CoreContentSearchResult, i: number) =>
              `${result.sourceId}-${result.bookId}-${result.chapterIndex}-${result.chapterOffset}-${i}`)
          } else {
            Text(this.statusMessage())
              .fontSize(9)
              .fontColor(ReaderUiVisualTokens.readerControlMuted)
              .fontFamily(ReaderUiVisualTokens.readerControlFontFamily)
              .lineHeight(14)
              .padding({ left: 8, right: 8, top: 10 })
          }
          }
          .width('100%')
        }
        .width('100%')
        .height(141)
        .clip(true)
        .border({ width: 1, color: ReaderUiVisualTokens.readerControlBorder })
        .borderRadius(8)
        .backgroundColor(ReaderUiVisualTokens.readerControlTranslucentSurface)
      }
      .width('100%')
      .height(170)
    }
  }
}

@Component
struct ReaderReplaceFigmaRuleRow {
  @Prop rule: ReplaceRule;

  private title(): string {
    return this.rule.pattern.length > 0 ? this.rule.pattern : this.rule.replacement;
  }

  build() {
    Row({ space: 10 }) {
      Stack({ alignContent: this.rule.enabled ? Alignment.End : Alignment.Start }) {
        Column()
          .width(12)
          .height(12)
          .borderRadius(999)
          .backgroundColor(ReaderUiVisualTokens.readerControlSurface)
          .margin({ left: 2, right: 2 })
      }
      .width(27)
      .height(16)
      .borderRadius(999)
      .backgroundColor(this.rule.enabled
        ? ReaderUiVisualTokens.readerModuleActive
        : ReaderUiVisualTokens.readerReplaceInactiveToggle)
      .onClick(() => ReaderUiStore.dispatch({
        type: 'replace-rule-toggle',
        replaceRuleId: this.rule.id,
      }))

      Text(this.title())
        .fontSize(9)
        .fontWeight(600)
        .fontColor(ReaderUiVisualTokens.readerControlInk)
        .fontFamily(ReaderUiVisualTokens.readerControlFontFamily)
        .layoutWeight(1)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
    }
    .width('100%')
    .height(28)
    .padding({ left: 5, right: 5 })
    .border({ width: { top: 1 }, color: ReaderUiVisualTokens.readerModuleDivider })
    .alignItems(VerticalAlign.Center)
  }
}

// ── Replace panel (.fd-replace-quick-panel) ───────────────────────────────
// Current Figma master is a compact rule switcher.  Editing, deleting,
// import/export, and management pages have no admitted Figma target here, so
// they are intentionally not rendered as extra native controls.
@Component
export struct ReplacePanel {
  @StorageProp('reader.replaceRules') rules: ReplaceRule[] = [];

  build() {
    Column({ space: 4 }) {
        Row() {
          Text('替换规则')
            .fontSize(13)
            .fontWeight(700)
            .fontColor(ReaderUiVisualTokens.readerControlInk)
            .fontFamily(ReaderUiVisualTokens.readerControlFontFamily)
            .layoutWeight(1)
        }
        .width('100%')
        .height(28)
        .padding({ left: 8, right: 8 })
        .border({ width: { bottom: 1 }, color: ReaderUiVisualTokens.readerModuleDivider })
        .alignItems(VerticalAlign.Center)

        Column({ space: 6 }) {
          Column() {
            ForEach(this.rules.slice(0, 3), (rule: ReplaceRule, i: number) => {
              ReaderReplaceFigmaRuleRow({ rule: rule })
            }, (rule: ReplaceRule, i: number) => `${rule.id}-${i}`)
          }
          .width('100%')
          .height(93)
          .padding({ left: 7, right: 7 })
          .clip(true)
        }
        .width('100%')
        .height(132)
      }
      .width('100%')
      .height(164)
  }
}
// ── Auto-page panel (.fd-reader-auto-page-quick-panel) ────────────────────
//   Live demo quick panel: toolbar, prev/toggle/next control, speed stepper,
//   and two-option mode segment.
@Component
export struct ReaderAutoScrollPanel {
  @StorageProp('reader.autoPageSession.intervalSeconds') intervalSeconds: number = 5;
  @StorageProp('reader.autoPageMode') autoPageMode: string = 'continuous';
  @StorageProp('reader.activeSession') activeSession: string = '';

  private toggleLabel(): string {
    return this.activeSession === 'auto-page' ? '停止自动翻页' : '开始自动翻页';
  }

  build() {
    ReaderQuickPanelShell({ debugLabel: 'ReaderQuickPanel', contentHeight: 196 }) {
      Column({ space: 5 }) {
        Row() {
          ReaderQuickBackButton({ buttonWidth: 53 })
        }
        .width('100%')
        .height(24)
        .alignItems(VerticalAlign.Center)

        Stack({ alignContent: Alignment.TopStart }) {
          Row({ space: 20 }) {
            Column({ space: 3 }) {
              Row() {
                Image($r('app.media.reader_control_chapter_prev')).width(14).height(14)
                Image($r('app.media.reader_control_chapter_prev')).width(14).height(14).margin({ left: -7 })
              }
              .width(27)
              .height(27)
              .justifyContent(FlexAlign.Center)
              .alignItems(VerticalAlign.Center)
              .border({ width: 1, color: ReaderUiVisualTokens.readerControlBorder })
              .borderRadius(8)
              .backgroundColor(ReaderUiVisualTokens.readerControlQuickActionSurface)
              Text('上一章')
                .fontSize(9)
                .fontWeight(700)
                .fontColor(ReaderUiVisualTokens.readerControlInk)
                .fontFamily(ReaderUiVisualTokens.readerControlFontFamily)
            }
            .width(62)
            .height(52)
            .justifyContent(FlexAlign.Center)
            .alignItems(HorizontalAlign.Center)
            .onClick(() => ReaderUiStore.dispatch({ type: 'chapter-prev' }))

            Column({ space: 4 }) {
              Stack({ alignContent: Alignment.Center }) {
                Image($r('app.media.reader_control_play')).width(20).height(20)
              }
              .width(32)
              .height(32)
              .borderRadius(999)
              .backgroundColor(ReaderUiVisualTokens.readerModuleActive)
              Text('自动翻页')
                .fontSize(9)
                .fontWeight(800)
                .fontColor(ReaderUiVisualTokens.readerControlInk)
                .fontFamily(ReaderUiVisualTokens.readerControlFontFamily)
                .maxLines(1)
            }
            .width(82)
            .height(52)
            .justifyContent(FlexAlign.Center)
            .alignItems(HorizontalAlign.Center)
            .onClick(() => ReaderUiStore.dispatch({ type: 'auto-page-toggle' }))

            Column({ space: 3 }) {
              Row() {
                Image($r('app.media.reader_control_chapter_next')).width(14).height(14)
                Image($r('app.media.reader_control_chapter_next')).width(14).height(14).margin({ left: -7 })
              }
              .width(27)
              .height(27)
              .justifyContent(FlexAlign.Center)
              .alignItems(VerticalAlign.Center)
              .border({ width: 1, color: ReaderUiVisualTokens.readerControlBorder })
              .borderRadius(8)
              .backgroundColor(ReaderUiVisualTokens.readerControlQuickActionSurface)
              Text('下一章')
                .fontSize(9)
                .fontWeight(700)
                .fontColor(ReaderUiVisualTokens.readerControlInk)
                .fontFamily(ReaderUiVisualTokens.readerControlFontFamily)
            }
            .width(62)
            .height(52)
            .justifyContent(FlexAlign.Center)
            .alignItems(HorizontalAlign.Center)
            .onClick(() => ReaderUiStore.dispatch({ type: 'chapter-next' }))
          }
          .width(246)
          .height(52)
          .margin({ left: 9, top: 26 })

          Column({ space: 3 }) {
            Text('■')
              .fontSize(13)
              .fontColor(ReaderUiVisualTokens.readerAutoStop)
              .width(24)
              .height(24)
              .textAlign(TextAlign.Center)
            Text('停止')
              .fontSize(9)
              .fontWeight(700)
              .fontColor(ReaderUiVisualTokens.readerAutoStop)
              .fontFamily(ReaderUiVisualTokens.readerControlFontFamily)
          }
          .width(24)
          .height(41)
          .position({ x: 161, y: 36 })
          .opacity(this.activeSession === 'auto-page' ? 1 : 0.5)
          .onClick(() => ReaderUiStore.dispatch({ type: 'auto-page-toggle' }))
        }
        .width('100%')
        .height(104)
        .border({ width: 1, color: ReaderUiVisualTokens.readerControlBorder })
        .borderRadius(8)
        .backgroundColor(ReaderUiVisualTokens.readerControlTranslucentSurface)

        Row() {
          Text('翻页速度')
            .fontSize(11)
            .fontWeight(760)
            .fontColor(ReaderUiVisualTokens.readerControlInk)
            .fontFamily(ReaderUiVisualTokens.readerControlFontFamily)
            .layoutWeight(1)
          Row({ space: 5 }) {
            Text('-').fontSize(18).fontWeight(800).fontColor(ReaderUiVisualTokens.readerControlModuleInactiveLabel)
              .width(24).height(24).textAlign(TextAlign.Center)
              .borderRadius(999).backgroundColor(ReaderUiVisualTokens.readerControlQuickActionSurface)
              .border({ width: 1, color: ReaderUiVisualTokens.readerControlBorder })
              .onClick(() => ReaderUiStore.dispatch({ type: 'auto-page-step-interval', delta: -1 }))
            Text(`${this.intervalSeconds} 秒`).fontSize(11).fontWeight(900).fontColor(ReaderUiVisualTokens.readerModuleActive)
              .fontFamily(ReaderUiVisualTokens.readerControlFontFamily)
              .width(30).textAlign(TextAlign.Center)
            Text('+').fontSize(18).fontWeight(800).fontColor(ReaderUiVisualTokens.readerControlModuleInactiveLabel)
              .width(24).height(24).textAlign(TextAlign.Center)
              .borderRadius(999).backgroundColor(ReaderUiVisualTokens.readerControlQuickActionSurface)
              .border({ width: 1, color: ReaderUiVisualTokens.readerControlBorder })
              .onClick(() => ReaderUiStore.dispatch({ type: 'auto-page-step-interval', delta: 1 }))
          }
        }
        .width('100%')
        .height(32)
        .padding({ left: 7, right: 7 })
        .border({ width: 1, color: ReaderUiVisualTokens.readerControlBorder })
        .borderRadius(6)
        .backgroundColor(ReaderUiVisualTokens.readerControlQuickActionSurface)
        .alignItems(VerticalAlign.Center)
      }
      .width('100%')
      .height(170)
    }
  }
}

// ── Night toast (.reader-night-toast) ─────────────────────────────────────
//   Transient pill "已切换夜间模式", positioned above the quick-actions row.
//   Uses night-theme tokens (floatingControlBgAltNight / controlInkNight) —
//   only meaningful on the night-state route where ReaderBase is themed night.
@Component
export struct NightToast {
  build() {
    Stack({ alignContent: Alignment.Bottom }) {
      Text('已切换夜间模式')
        .fontSize(13).fontColor(ColorTokens.controlInkNight)
        .padding({ left: 14, right: 14, top: 8, bottom: 8 })
        .backgroundColor(ColorTokens.floatingControlBgAltNight)
        .border({ width: 1, color: ColorTokens.border })
        .borderRadius(DemoAliasTokens.radiusPill)
        .margin({ bottom: SizeTokens.bottomBarHeight + 152 })
    }
    .width('100%')
    .height('100%')
  }
}
