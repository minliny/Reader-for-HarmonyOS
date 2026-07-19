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
import { SafeAreaAdapter } from '../adapters/SafeAreaAdapter';
import { ViewportAdapter } from '../adapters/ViewportAdapter';
import { ReaderUiStore } from '../store/ReaderUiStore';
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

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Column({ space: 8 }) {
        Image($r('app.media.reader_icon_sun_primary')).width(18).height(18)
        Slider({
          value: this.brightnessValue,
          min: 0,
          max: 100,
          step: 1,
          style: SliderStyle.OutSet,
          direction: Axis.Vertical,
          reverse: true,
        })
          .width(24)
          .layoutWeight(1)
          .trackColor(ColorTokens.border)
          .selectedColor(ColorTokens.primary)
          .blockColor(ColorTokens.primaryDark)
          .onChange((value: number, mode: SliderChangeMode) => this.update(value, mode))
        Text(`${Math.round(this.brightnessValue)}%`)
          .fontSize(9)
          .fontWeight(800)
          .fontColor(ColorTokens.primaryDark)
          .maxLines(1)
          .textAlign(TextAlign.Center)
      }
      .width('100%')
      .height('100%')
      .padding({ top: 12, bottom: 12 })
      .justifyContent(FlexAlign.Center)
      .alignItems(HorizontalAlign.Center)
      .backgroundColor(ColorTokens.floatingControlBg)
      .borderRadius(DemoAliasTokens.radiusLg)
      InteractionDebugBadge({ label: 'B', tone: 'action', offsetTop: 22 })
      InteractionDebugFrame({ label: 'BrightnessRail', tone: 'module' })
    }
    .width('100%')
    .height('100%')
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

  private readonly dockWidth: number = 340;
  private readonly dockRight: number = 24;
  private readonly mobileSheetInset: number = 12;
  private readonly navBottom: number = 32;
  private readonly navHeight: number = 79;
  private readonly dockGap: number = -1;
  private readonly mobileSheetBottom: number = 18;
  private readonly wideSheetHeight: number = 252;
  private readonly mobileSheetHeight: number = 330;
  private readonly controlTop: number = 28;
  private readonly wideControlBottom: number = 32;
  private readonly mobileControlBottom: number = 110;
  private readonly sheetPaddingX: number = 12;
  private readonly railWidth: number = 38;
  private readonly railGap: number = 14;
  private readonly quickHeight: number = 76;

  private quickActions: Array<[string, string, string]> = [
    ['搜索', 'reader_icon_reader_content_search_action', 'reader-search-overlay-v2'],
    ['自动翻页', 'reader_icon_reader_auto_page_action', 'reader-auto-scroll-overlay-v2'],
    ['替换', 'reader_icon_reader_content_replace_action', 'reader-replace-overlay-v2'],
    ['书签', 'ui_icon_bookmark_dark', 'bookmark-create'],
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
    if (routeId === 'bookmark-create') return 'bookmark';
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

  private sheetBottom(): number {
    if (this.wideControlDock()) {
      return this.safeAreaBottom + this.navBottom + this.navHeight + this.dockGap;
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
    return this.sheetHeightValue() - this.controlTop - this.controlBottomInset();
  }

  private chapterHeight(): number {
    return this.controlHeight() - this.quickHeight - 6;
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
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(ColorTokens.muted)
            .margin({ top: 9, left: '50%' })
            .translate({ x: -21 })

          Row({ space: this.railGap }) {
            Stack({ alignContent: Alignment.TopStart }) {
              Column({ space: 6 }) {
                Stack({ alignContent: Alignment.TopStart }) {
                  Row({ space: 8 }) {
                    ForEach(this.quickActions, (item: [string, string, string]) => {
                      Stack({ alignContent: Alignment.TopStart }) {
                        Column({ space: 6 }) {
                          Image($r(`app.media.${item[1]}`)).width(22).height(22)
                          Text(item[0])
                            .fontSize(11)
                            .fontWeight(800)
                            .fontColor(ColorTokens.controlInk)
                            .maxLines(1)
                            .textOverflow({ overflow: TextOverflow.Ellipsis })
                        }
                        .width('100%')
                        .height(70)
                        .justifyContent(FlexAlign.Center)
                        .alignItems(HorizontalAlign.Center)
                        .backgroundColor(ColorTokens.surfaceSoft)
                        .borderRadius(DemoAliasTokens.radiusLg)
                        .onClick(() => {
                          if (item[2] === 'bookmark-create') {
                            ReaderUiStore.dispatch({ type: 'bookmark-create' });
                          } else {
                            ReaderUiStore.dispatch({ type: 'reader-module-switch', module: this.moduleForRoute(item[2]) });
                          }
                        })
                        InteractionDebugBadge({ label: this.quickDebugLabel(item[2]), tone: 'action', offsetTop: 22 })
                      }
                      .layoutWeight(1)
                      .height(70)
                    }, (item: [string, string, string]) => item[2])
                  }
                  .height(this.quickHeight)
                  .padding({ left: 8, right: 8, top: 9, bottom: 9 })
                  .border({ width: 1, color: ColorTokens.border })
                  .borderRadius(DemoAliasTokens.radiusLg)
                  .backgroundColor(ColorTokens.floatingControlBg)
                }
                .height(this.quickHeight)

                Stack({ alignContent: Alignment.TopStart }) {
                  Column({ space: 8 }) {
                  Row() {
                    Stack({ alignContent: Alignment.TopStart }) {
                      Row() {
                        Image($r('app.media.reader_icon_chevron_left_chapter'))
                          .width(22)
                          .height(22)
                      }
                      .width(34)
                      .height(34)
                      .justifyContent(FlexAlign.Center)
                      .alignItems(VerticalAlign.Center)
                      .backgroundColor(ColorTokens.floatingControlBgAlt)
                      .borderRadius(DemoAliasTokens.radiusPill)
                      .margin({ top: 9 })
                      .onClick(() => ReaderUiStore.dispatch({ type: 'chapter-prev' }))
                      InteractionDebugBadge({ label: 'P', tone: 'action' })
                    }
                    .width(34)
                    .height(52)
                    Text(this.chapterTitle())
                      .fontSize(13)
                      .fontWeight(750)
                      .fontColor(ColorTokens.controlInk)
                      .textAlign(TextAlign.Center)
                      .layoutWeight(1)
                      .maxLines(2)
                      .textOverflow({ overflow: TextOverflow.Ellipsis })
                    Stack({ alignContent: Alignment.TopStart }) {
                      Row() {
                        Image($r('app.media.reader_icon_chevron_chapter')).width(22).height(22)
                      }
                      .width(34)
                      .height(34)
                      .justifyContent(FlexAlign.Center)
                      .alignItems(VerticalAlign.Center)
                      .backgroundColor(ColorTokens.floatingControlBgAlt)
                      .borderRadius(DemoAliasTokens.radiusPill)
                      .margin({ top: 9 })
                      .onClick(() => ReaderUiStore.dispatch({ type: 'chapter-next' }))
                      InteractionDebugBadge({ label: 'N', tone: 'action' })
                    }
                    .width(34)
                    .height(52)
                  }
                  .height(52)
                  .alignItems(VerticalAlign.Center)

                  Row({ space: 6 }) {
                    Text(this.chapterProgressLabel())
                      .fontSize(9)
                      .fontColor(ColorTokens.muted)
                      .fontWeight(700)
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
                        .trackColor(ColorTokens.border)
                        .selectedColor(ColorTokens.primary)
                        .blockColor(ColorTokens.primaryDark)
                        .enabled(this.canSeekChapter())
                        .opacity(this.canSeekChapter() ? 1 : 0.54)
                        .onChange((value: number, mode: SliderChangeMode) => this.seekChapter(value, mode))
                      InteractionDebugBadge({ label: 'progress', tone: 'action' })
                    }
                    .layoutWeight(1)
                    .height(30)
                    Text(this.currentBook === null ? '未选择书籍' : (this.chapterToc.length > 0 ? `共 ${this.chapterToc.length} 章` : '目录未加载'))
                      .fontSize(9)
                      .fontColor(ColorTokens.muted)
                      .fontWeight(700)
                  }
                  .height(30)
                  .alignItems(VerticalAlign.Center)
                  }
                  .height(this.chapterHeight())
                  .padding({ left: 10, right: 10, top: 9, bottom: 9 })
                  .border({ width: 1, color: ColorTokens.border })
                  .borderRadius(DemoAliasTokens.radiusLg)
                  .backgroundColor(ColorTokens.floatingControlBg)
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
            .width(this.railWidth)
            .height('100%')
          }
          .width('100%')
          .height(this.controlHeight())
          .padding({ left: this.sheetPaddingX, right: this.sheetPaddingX })
          .margin({ top: this.controlTop })
          }
          .width('100%')
          .height(this.sheetHeightValue())
          .clip(true)
          .border({ width: { left: 1, right: 1, top: 1, bottom: this.wideControlDock() ? 0 : 1 }, color: ColorTokens.border })
          .borderRadius({
            topLeft: DemoAliasTokens.radiusXl,
            topRight: DemoAliasTokens.radiusXl,
            bottomLeft: this.wideControlDock() ? 0 : DemoAliasTokens.radiusXl,
            bottomRight: this.wideControlDock() ? 0 : DemoAliasTokens.radiusXl,
          })
          .backgroundColor(ColorTokens.floatingControlBg)
          .shadow({ radius: 8, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 2 })
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

  private readonly dockWidth: number = 340;
  private readonly dockRight: number = 24;
  private readonly navBottom: number = 32;
  private readonly navHeight: number = 79;

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
    return this.wideControlDock() ? this.dockWidth : Math.max(0, this.viewportWidth - this.dockRight * 2);
  }

  private navBottomValue(): number {
    return this.wideControlDock() ? this.safeAreaBottom + this.navBottom : this.navBottom;
  }

  private moduleIcon(kind: string, active: boolean): Resource {
    switch (kind) {
      case 'directory':
        return active ? $r('app.media.reader_icon_reader_module_directory_white') : $r('app.media.reader_icon_reader_module_directory_primary');
      case 'appearance':
        return active ? $r('app.media.reader_icon_reader_module_appearance_white') : $r('app.media.reader_icon_reader_module_appearance_primary');
      case 'tts':
        return active ? $r('app.media.reader_icon_reader_module_tts_white') : $r('app.media.reader_icon_reader_module_tts_primary');
      case 'settings':
        return active ? $r('app.media.reader_icon_reader_module_settings_white') : $r('app.media.reader_icon_reader_module_settings_primary');
      default:
        return $r('app.media.reader_icon_reader_module_directory_primary');
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
              Column({ space: 4 }) {
                Stack({ alignContent: Alignment.Center }) {
                  Image(this.moduleIcon(it[0], this.active(it[0]))).width(26).height(26)
                }
                .width(42)
                .height(42)
                .borderRadius(DemoAliasTokens.radiusPill)
                .backgroundColor(this.active(it[0]) ? ColorTokens.primaryDark : ColorTokens.surfaceSoft)

                Text(it[1])
                  .fontSize(12)
                  .fontWeight(800)
                  .fontColor(this.active(it[0]) ? ColorTokens.primaryDark : ColorTokens.controlInk)
                  .maxLines(1)
                  .textOverflow({ overflow: TextOverflow.Ellipsis })
              }
              .width('100%')
              .height(62)
              .justifyContent(FlexAlign.Center)
              .alignItems(HorizontalAlign.Center)
              .onClick(() => this.selectModule(it[0]))
              InteractionDebugBadge({ label: this.moduleDebugLabel(it[0]), tone: 'action', offsetTop: 24 })
            }
            .layoutWeight(1)
            .height(62)
          }, (it: [string, string, string]) => it[2])
        }
        .width(this.navWidth())
        .height(this.navHeight)
        .padding({ left: 8, right: 8, top: 8, bottom: 8 })
        .backgroundColor(ColorTokens.bottomBarBg)
        .border({ width: { left: 1, right: 1, top: this.wideControlDock() ? 0 : 1, bottom: 1 }, color: ColorTokens.border })
        .borderRadius({
          topLeft: this.wideControlDock() ? 0 : DemoAliasTokens.radiusLg,
          topRight: this.wideControlDock() ? 0 : DemoAliasTokens.radiusLg,
          bottomLeft: DemoAliasTokens.radiusLg,
          bottomRight: DemoAliasTokens.radiusLg,
        })
        InteractionDebugFrame({ label: 'readerModuleNav', tone: 'sheet' })
      }
      .width(this.navWidth())
      .height(this.navHeight)
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
      .shadow({ radius: 8, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 2 })
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
  @BuilderParam content: () => void;

  private readonly dockWidth: number = 340;
  private readonly dockRight: number = 24;
  private readonly mobileSheetInset: number = 12;
  private readonly navBottom: number = 32;
  private readonly navHeight: number = 79;
  private readonly dockGap: number = -1;
  private readonly mobileSheetBottom: number = 18;
  private readonly wideSheetHeight: number = 252;
  private readonly mobileSheetHeight: number = 330;
  private readonly controlTop: number = 28;
  private readonly wideQuickBottom: number = 32;
  private readonly mobileQuickBottom: number = 105;
  private readonly sheetPaddingX: number = 12;
  private readonly railWidth: number = 38;
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

  private sheetBottom(): number {
    if (this.wideControlDock()) {
      return this.safeAreaBottom + this.navBottom + this.navHeight + this.dockGap;
    }
    return this.mobileSheetBottom;
  }

  private sheetRight(): number {
    return this.wideControlDock() ? this.dockRight : this.mobileSheetInset;
  }

  private quickHeight(): number {
    return this.sheetHeightValue() - this.controlTop - (this.wideControlDock() ? this.wideQuickBottom : this.mobileQuickBottom);
  }

  build() {
    Stack({ alignContent: Alignment.BottomEnd }) {
      Column() {
        Stack({ alignContent: Alignment.TopStart }) {
          Column()
            .width(42)
            .height(4)
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(ColorTokens.muted)
            .margin({ top: 9, left: '50%' })
            .translate({ x: -21 })

          Row({ space: this.railGap }) {
            Column() {
              this.content()
            }
            .layoutWeight(1)
            .height('100%')
            .padding({ left: 10, right: 10, top: 12, bottom: 12 })
            .border({ width: 1, color: ColorTokens.border })
            .borderRadius(DemoAliasTokens.radiusMd)
            .backgroundColor(ColorTokens.surfaceSoft)

            ReaderBrightnessRail()
            .width(this.railWidth)
            .height('100%')
          }
          .width('100%')
          .height(this.quickHeight())
          .padding({ left: this.sheetPaddingX, right: this.sheetPaddingX })
          .margin({ top: this.controlTop })
          InteractionDebugFrame({ label: this.debugLabel, tone: 'sheet' })
        }
        .width('100%')
        .height(this.sheetHeightValue())
        .clip(true)
        .border({ width: { left: 1, right: 1, top: 1, bottom: this.wideControlDock() ? 0 : 1 }, color: ColorTokens.border })
        .borderRadius({
          topLeft: DemoAliasTokens.radiusXl,
          topRight: DemoAliasTokens.radiusXl,
          bottomLeft: this.wideControlDock() ? 0 : DemoAliasTokens.radiusXl,
          bottomRight: this.wideControlDock() ? 0 : DemoAliasTokens.radiusXl,
        })
        .backgroundColor(ColorTokens.floatingControlBg)
        .shadow({ radius: 8, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 2 })
      }
      .width(this.sheetWidth())
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
  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row({ space: 4 }) {
        Image($r('app.media.reader_icon_back_dark')).width(12).height(12)
        Text('返回')
          .fontSize(10)
          .fontWeight(750)
          .fontColor(ColorTokens.primaryDark)
      }
      .height(24)
      .padding({ left: 9, right: 9 })
      .border({ width: 1, color: ColorTokens.primary })
      .borderRadius(DemoAliasTokens.radiusMd)
      .backgroundColor(DemoAliasTokens.surface)
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
          .fontSize(11)
          .fontWeight(760)
          .fontColor(ColorTokens.controlInk)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(this.detail)
          .fontSize(9)
          .fontColor(ColorTokens.muted)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .width('100%')
      .height('100%')
      .justifyContent(FlexAlign.Center)
      .alignItems(HorizontalAlign.Start)
      InteractionDebugBadge({ label: 'result', tone: 'state' })
    }
    .width('100%')
    .height(42)
    .padding({ left: 8, right: 8, top: 4, bottom: 4 })
    .border({ width: { top: 1 }, color: ColorTokens.border })
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
  @BuilderParam content: () => void;

  private readonly dockWidth: number = 340;
  private readonly dockRight: number = 24;
  private readonly mobileSheetInset: number = 12;
  private readonly navBottom: number = 32;
  private readonly navHeight: number = 79;
  private readonly dockGap: number = -1;
  private readonly mobileSheetBottom: number = 18;
  private readonly wideSheetHeight: number = 252;
  private readonly mobileSheetHeight: number = 330;
  private readonly moduleTop: number = 28;
  private readonly mobileModuleBottom: number = 110;
  private readonly wideModuleBottom: number = 32;
  private readonly sheetPaddingX: number = 12;
  private readonly railWidth: number = 38;
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

  private sheetBottom(): number {
    if (this.wideControlDock()) {
      return this.safeAreaBottom + this.navBottom + this.navHeight + this.dockGap;
    }
    return this.mobileSheetBottom;
  }

  private sheetRight(): number {
    return this.wideControlDock() ? this.dockRight : this.mobileSheetInset;
  }

  private moduleBottom(): number {
    return this.wideControlDock() ? this.wideModuleBottom : this.mobileModuleBottom;
  }

  private moduleHeight(): number {
    return this.sheetHeightValue() - this.moduleTop - this.moduleBottom();
  }

  build() {
    Stack({ alignContent: Alignment.BottomEnd }) {
      Column() {
        Stack({ alignContent: Alignment.TopStart }) {
          Column()
            .width(42)
            .height(4)
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(ColorTokens.muted)
            .margin({ top: 9, left: '50%' })
            .translate({ x: -21 })
            .onClick(() => {
              if (this.closeEvent.length > 0) ReaderUiStore.dispatch({ type: this.closeEvent });
            })

          Row({ space: this.railGap }) {
            Column() {
              this.content()
            }
            .layoutWeight(1)
            .height('100%')
            .padding({ left: 10, right: 10, top: 12, bottom: 12 })
            .border({ width: 1, color: ColorTokens.border })
            .borderRadius(DemoAliasTokens.radiusMd)
            .backgroundColor(ColorTokens.surfaceSoft)

            ReaderBrightnessRail()
            .width(this.railWidth)
            .height('100%')
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
        .border({ width: { left: 1, right: 1, top: 1, bottom: this.wideControlDock() ? 0 : 1 }, color: ColorTokens.border })
        .borderRadius({
          topLeft: DemoAliasTokens.radiusXl,
          topRight: DemoAliasTokens.radiusXl,
          bottomLeft: this.wideControlDock() ? 0 : DemoAliasTokens.radiusXl,
          bottomRight: this.wideControlDock() ? 0 : DemoAliasTokens.radiusXl,
        })
        .backgroundColor(ColorTokens.floatingControlBg)
        .shadow({ radius: 8, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 2 })
      }
      .width(this.sheetWidth())
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
    Column({ space: 5 }) {
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
    ReaderUiStore.dispatch({ type: 'reader.directory.close' });
  }

  build() {
    Row({ space: 6 }) {
      Text(this.title)
        .fontSize(11)
        .fontWeight(500)
        .fontColor(this.current ? ColorTokens.primaryDark : ColorTokens.controlInk)
        .layoutWeight(1)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
      if (this.current) {
        Text('当前')
          .fontSize(9)
          .fontWeight(800)
          .fontColor(ColorTokens.primaryDark)
          .height(22)
          .padding({ left: 7, right: 7 })
          .borderRadius(DemoAliasTokens.radiusSm)
          .backgroundColor(ColorTokens.floatingControlBgAlt)
          .textAlign(TextAlign.Center)
      }
    }
    .width('100%')
    .height(32)
    .padding({ left: 7, right: 7 })
    .border({ width: { top: 1 }, color: ColorTokens.border })
    .backgroundColor(this.current ? ColorTokens.surfaceSoft : 'transparent')
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
  private choices: Array<[string, ReaderFontFamily]> = [
    ['系统', 'system'],
    ['宋体', 'serif'],
    ['黑体', 'sans'],
  ];

  build() {
    Row({ space: 4 }) {
      ForEach(this.choices, (item: [string, ReaderFontFamily], i: number) => {
        Text(item[0])
          .fontSize(8).fontWeight(700).fontColor(item[1] === this.fontFamily ? DemoAliasTokens.onPrimary : ColorTokens.controlInk)
          .layoutWeight(1).height(22).textAlign(TextAlign.Center)
          .borderRadius(DemoAliasTokens.radiusSm).backgroundColor(item[1] === this.fontFamily ? ColorTokens.primaryDark : ColorTokens.floatingControlBgAlt)
          .onClick(() => ReaderUiStore.dispatch({ type: 'set-reader-font-family', fontFamily: item[1] }))
      }, (item: [string, ReaderFontFamily], i: number) => `${item[1]}-${i}`)
    }
    .width('100%')
    .height(27)
    .padding({ top: 4 })
    .border({ width: { top: 1 }, color: ColorTokens.border })
  }
}

@Component
struct ReaderThemeSwatches {
  @StorageProp('reader.readerTheme') currentTheme: string = 'paper';
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;
  private options: ReaderThemeOption[] = ReaderThemeResolver.QUICK_OPTIONS;

  private isActive(value: string): boolean {
    return this.currentTheme === value;
  }

  build() {
    Row({ space: 4 }) {
      ForEach(this.options, (item: ReaderThemeOption, i: number) => {
        Column() {
          Column()
            .width(46)
            .height(18)
            .borderRadius(DemoAliasTokens.radiusSm)
            .backgroundColor(item.swatch)
            .border({ width: 1, color: this.isActive(item.value) ? ColorTokens.primary : ColorTokens.border })
        }
        .layoutWeight(1)
        .height(24)
        .padding({ left: 3, right: 3, top: 2, bottom: 2 })
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
        .borderRadius(DemoAliasTokens.radiusMd)
        .backgroundColor(this.isActive(item.value) ? ColorTokens.surfaceSoft : ColorTokens.floatingControlBgAlt)
        .onClick(() => {
          MotionAdapter.apply('segment.item.switch', this.reducedMotion, this.getUIContext(), () => {
            ReaderUiStore.dispatch({ type: 'set-reader-theme', theme: item.value });
          });
        })
      }, (item: ReaderThemeOption, i: number) => `${item.value}-${i}`)
    }
    .width('100%')
    .height(24)
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
export struct ReaderDirectoryPanel {
  @Prop standalone: boolean = false;
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

  private closeEvent(): string {
    return this.standalone ? 'route-pop' : 'reader.directory.close';
  }

  build() {
    ReaderModulePanelShell({ debugLabel: 'ReaderModulePanel', closeEvent: this.closeEvent() }) {
      Column() {
        Row({ space: 4 }) {
          Text('目录')
            .fontSize(10).fontWeight(600).fontColor(this.tocMode === 'directory' ? DemoAliasTokens.onPrimary : ColorTokens.controlInk)
            .layoutWeight(1).height(30).textAlign(TextAlign.Center)
            .borderRadius(DemoAliasTokens.radiusMd).backgroundColor(this.tocMode === 'directory' ? ColorTokens.primaryDark : ColorTokens.floatingControlBgAlt)
            .onClick(() => ReaderUiStore.dispatch({ type: 'set-toc-mode', tocMode: 'directory' }))
          Text('书签')
            .fontSize(10).fontWeight(600).fontColor(this.tocMode === 'bookmark' ? DemoAliasTokens.onPrimary : ColorTokens.controlInk)
            .layoutWeight(1).height(30).textAlign(TextAlign.Center)
            .borderRadius(DemoAliasTokens.radiusMd).backgroundColor(this.tocMode === 'bookmark' ? ColorTokens.primaryDark : ColorTokens.floatingControlBgAlt)
            .onClick(() => ReaderUiStore.dispatch({ type: 'set-toc-mode', tocMode: 'bookmark' }))
        }
        .width('100%')
        .height(36)
        .padding({ top: 3, bottom: 3 })
        .margin({ bottom: 5 })

        if (this.tocMode === 'bookmark') {
          if (this.currentBook === null) {
            Text('尚未打开书籍，无法读取 Core 书签。')
              .fontSize(11).fontColor(ColorTokens.muted).lineHeight(17)
              .width('100%').padding({ left: 8, right: 8, top: 12, bottom: 12 })
          } else if (this.bookmarksLoading || !this.bookmarksLoaded) {
            Text('正在从 Core 读取当前书的书签…')
              .fontSize(11).fontColor(ColorTokens.muted).lineHeight(17)
              .width('100%').padding({ left: 8, right: 8, top: 12, bottom: 12 })
          } else if (this.bookmarksError.length > 0) {
            Text(`书签操作失败：${this.bookmarksError}`)
              .fontSize(11).fontColor(ColorTokens.accent).lineHeight(17)
              .width('100%').padding({ left: 8, right: 8, top: 12, bottom: 12 })
          } else if (this.bookmarks.length === 0) {
            Text('当前书在 Core 中还没有书签。可在阅读器控制栏添加当前位置书签。')
              .fontSize(11).fontColor(ColorTokens.muted).lineHeight(17)
              .width('100%').padding({ left: 8, right: 8, top: 12, bottom: 12 })
          } else {
            Scroll() {
              Column() {
                ForEach(this.bookmarks, (bookmark: CoreBookmark, i: number) => {
                  ReaderBookmarkLiveRow({ bookmark: bookmark })
                }, (bookmark: CoreBookmark, i: number) => `${bookmark.time}-${i}`)
              }
              .width('100%')
            }
            .width('100%')
            .layoutWeight(1)
            .scrollBar(BarState.Auto)
          }
        } else if (this.currentBook === null || this.chapterToc.length === 0) {
          Text(this.statusMessage())
            .fontSize(11)
            .fontColor(ColorTokens.muted)
            .lineHeight(17)
            .width('100%')
            .padding({ left: 8, right: 8, top: 12, bottom: 12 })
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
      .borderRadius(DemoAliasTokens.radiusMd)
      .backgroundColor(DemoAliasTokens.surface)
    }
  }
}

// ── Appearance panel (.fd-reader-appearance-panel) ────────────────────────
@Component
export struct ReaderAppearancePanel {
  @StorageProp('reader.typography.fontSize') fontSize: number = 18;
  @StorageProp('reader.typography.lineHeight') lineHeightRatio: number = 1.96;

  private whole(value: number): string {
    return `${Math.round(value)}`;
  }

  private two(value: number): string {
    return `${Math.round(value * 100) / 100}`;
  }

  build() {
    ReaderModulePanelShell({ debugLabel: 'ReaderModulePanel' }) {
      Column() {
        Column({ space: 3 }) {
          Row() {
            Text('阅读主题').fontSize(9).fontWeight(700).fontColor(ColorTokens.controlInk)
          }.width('100%').height(10)
          ReaderThemeSwatches()
        }
        .width('100%')
        .height(42)
        .padding({ top: 3, bottom: 2 })
        .border({ width: { bottom: 1 }, color: ColorTokens.border })

        Column({ space: 3 }) {
          Row() {
            Text('文字排版').fontSize(9).fontWeight(700).fontColor(ColorTokens.controlInk)
          }.width('100%').height(10)
          ReaderLiveStepperRow({ label: '字号', value: this.whole(this.fontSize), metric: 'fontSize' })
          ReaderLiveStepperRow({ label: '行距', value: this.two(this.lineHeightRatio), metric: 'lineHeight', divider: true })
          ReaderFontChoices()
        }
        .width('100%')
        .height(106)
        .padding({ top: 3, bottom: 2 })
      }
      .width('100%')
      .height(148)
      .padding({ left: 1, right: 1 })
      .alignItems(HorizontalAlign.Start)
    }
  }
}

// ── TTS panel (.fd-reader-tts-panel) ──────────────────────────────────────
@Component
export struct ReaderTtsPanel {
  @StorageProp('reader.ttsSession.playback') playback: string = 'idle';
  @StorageProp('reader.ttsSession.currentSegment') currentSegment: number = 0;
  @StorageProp('reader.ttsSession.totalSegments') totalSegments: number = 0;
  @StorageProp('reader.chapterContent') chapterContent: string[] = [];

  private canStart(): boolean {
    return this.chapterContent.length > 0;
  }

  private hasQueue(): boolean {
    return this.totalSegments > 0;
  }

  private playbackLabel(): string {
    if (this.playback === 'playing') return '暂停朗读';
    if (this.playback === 'paused') return '继续朗读';
    return '开始朗读';
  }

  build() {
    ReaderModulePanelShell({ debugLabel: 'ReaderModulePanel' }) {
      Scroll() {
        Column() {
          Row() {
            Text('朗读')
              .fontSize(12)
              .fontWeight(800)
              .fontColor(ColorTokens.controlInk)
              .layoutWeight(1)
            ReaderQuickPillButton({ label: this.playbackLabel(), disabled: !this.canStart(), tapEvent: 'tts-toggle' })
          }
          .width('100%')
          .height(28)
          .alignItems(VerticalAlign.Center)

          Row({ space: 9 }) {
            Image($r('app.media.reader_icon_reader_module_tts_primary'))
              .width(18)
              .height(18)
              .margin({ left: 1, right: 1 })
            Text('播放控制')
              .fontSize(11)
              .fontWeight(500)
              .fontColor(ColorTokens.controlInk)
              .layoutWeight(1)
            Row() {
              Stack({ alignContent: Alignment.Center }) {
                Image($r('app.media.reader_icon_chevron_left_chapter')).width(13).height(13)
              }
              .width(28)
              .height(25)
              .opacity(this.hasQueue() ? 1 : 0.5)
              .enabled(this.hasQueue())
              .onClick(() => ReaderUiStore.dispatch({ type: 'tts-prev' }))
              Stack({ alignContent: Alignment.Center }) {
                Image($r('app.media.reader_icon_play_white')).width(13).height(13)
              }
              .width(34)
              .height(25)
              .borderRadius(DemoAliasTokens.radiusMd)
              .backgroundColor(ColorTokens.primaryDark)
              .opacity(this.canStart() ? 1 : 0.5)
              .enabled(this.canStart())
              .onClick(() => ReaderUiStore.dispatch({ type: 'tts-toggle' }))
              Stack({ alignContent: Alignment.Center }) {
                Image($r('app.media.reader_icon_chevron_chapter')).width(13).height(13)
              }
              .width(28)
              .height(25)
              .opacity(this.hasQueue() ? 1 : 0.5)
              .enabled(this.hasQueue())
              .onClick(() => ReaderUiStore.dispatch({ type: 'tts-next' }))
            }
            .height(25)
            .borderRadius(DemoAliasTokens.radiusMd)
            .backgroundColor(ColorTokens.floatingControlBgAlt)
          }
          .width('100%')
          .height(32)
          .padding({ left: 9, right: 9 })
          .border({ width: { top: 1 }, color: ColorTokens.border })
          .alignItems(VerticalAlign.Center)

          ReaderLiveOptionRow({ icon: $r('app.media.ui_icon_motion_dark'), title: '语速', value: 'TextReader Host 未提供程序化语速', disabled: true, unavailableReason: 'TextReader Host 未提供程序化语速' })
          ReaderLiveOptionRow({ icon: $r('app.media.ui_icon_volume_dark'), title: '音色', value: 'Host 未提供音色映射', disabled: true, unavailableReason: 'Host 未提供音色映射' })
          ReaderLiveOptionRow({ icon: $r('app.media.ui_icon_current_location_dark'), title: '范围', value: 'Core 仅当前章节', disabled: true, unavailableReason: 'Core 仅当前章节' })
          ReaderLiveOptionRow({ icon: $r('app.media.reader_icon_globe'), title: '在线语音区域', value: 'HttpTTS 合同缺失', disabled: true, unavailableReason: 'HttpTTS 合同缺失' })
          ReaderLiveOptionRow({ icon: $r('app.media.reader_icon_globe'), title: '在线语音语言', value: 'HttpTTS 合同缺失', disabled: true, unavailableReason: 'HttpTTS 合同缺失' })
          ReaderLiveOptionRow({ icon: $r('app.media.reader_icon_assist'), title: '在线语音模型', value: 'HttpTTS 合同缺失', disabled: true, unavailableReason: 'HttpTTS 合同缺失' })
          ReaderLiveOptionRow({ icon: $r('app.media.ui_icon_clock_dark'), title: '定时', value: 'Core/Host 未接入', disabled: true, unavailableReason: 'Core/Host 未接入' })
        }
        .width('100%')
      }
      .width('100%')
      .height('100%')
      .clip(true)
      .scrollBar(BarState.Off)
      .borderRadius(DemoAliasTokens.radiusMd)
      .backgroundColor(DemoAliasTokens.surface)
    }
  }
}

// ── Settings panel (.fd-reader-settings-panel) ────────────────────────────
@Component
export struct ReaderSettingsPanel {
  @StorageProp('reader.readerToggles.autoPage') autoPage: boolean = false;
  @StorageProp('reader.readerToggles.volumePage') volumePage: boolean = false;
  @StorageProp('reader.readerToggles.landscapeLock') landscapeLock: boolean = false;
  @StorageProp('reader.readerToggles.keepScreenOn') keepScreenOn: boolean = false;
  @StorageProp('reader.readerToggles.statusInfo') statusInfo: boolean = false;
  @StorageProp('reader.readerToggles.hapticFeedback') hapticFeedback: boolean = false;
  @StorageProp('reader.readerToggles.hideStatusBar') hideStatusBar: boolean = false;
  @StorageProp('reader.readerSettingOptions.tapMode') tapMode: string = '左右区域';
  @StorageProp('reader.readerSettingOptions.pageAnimation') pageAnimation: string = ReaderAppearanceSpecRegistry.select('pageAnimation')!.defaultValue;
  @StorageProp('reader.readerHostMessage') readerHostMessage: string = '';

  private pageAnimationLabel(): string {
    if (this.pageAnimation === 'cover' || this.pageAnimation === '覆盖') return '覆盖';
    if (this.pageAnimation === 'none' || this.pageAnimation === '无' || this.pageAnimation === '无动画') return '无动画';
    return '平滑';
  }

  build() {
    ReaderModulePanelShell({ debugLabel: 'ReaderModulePanel' }) {
      Scroll() {
        Column() {
          if (this.readerHostMessage.length > 0) {
            Text(this.readerHostMessage)
              .fontSize(9)
              .fontWeight(650)
              .fontColor(ColorTokens.accent)
              .lineHeight(14)
              .width('100%')
              .padding({ left: 9, right: 9, top: 7, bottom: 7 })
              .border({ width: { bottom: 1 }, color: ColorTokens.border })
          }
          ReaderLiveOptionRow({ icon: $r('app.media.ui_icon_refresh_dark'), title: '自动翻页', active: this.autoPage, switchRow: true, toggleKey: 'autoPage' })
          ReaderLiveOptionRow({ icon: $r('app.media.ui_icon_gesture_dark'), title: '点击翻页方式', value: this.tapMode, optionKey: 'tapMode', optionChoices: ['左右区域', '中间', '边缘'] })
          ReaderLiveOptionRow({ icon: $r('app.media.ui_icon_volume_dark'), title: '音量键翻页', active: this.volumePage, switchRow: true, toggleKey: 'volumePage', disabled: true, unavailableReason: '未接入按键监听' })
          ReaderLiveOptionRow({
            icon: $r('app.media.ui_icon_file_dark'),
            title: '翻页动画',
            value: this.pageAnimationLabel(),
            optionKey: 'pageAnimation',
            optionChoices: ['平滑', '覆盖', '无动画'],
          })
          ReaderLiveOptionRow({ icon: $r('app.media.ui_icon_permission_dark'), title: '横屏锁定', active: this.landscapeLock, switchRow: true, toggleKey: 'landscapeLock', disabled: true, unavailableReason: '未接入方向 Host' })
          ReaderLiveOptionRow({ icon: $r('app.media.ui_icon_sun_dark'), title: '屏幕常亮', active: this.keepScreenOn, switchRow: true, toggleKey: 'keepScreenOn' })
          ReaderLiveOptionRow({ icon: $r('app.media.ui_icon_progress_dark'), title: '页脚进度信息', active: this.statusInfo, switchRow: true, toggleKey: 'statusInfo' })
          ReaderLiveOptionRow({ icon: $r('app.media.ui_icon_gesture_dark'), title: '触摸反馈', active: this.hapticFeedback, switchRow: true, toggleKey: 'hapticFeedback' })
          ReaderLiveOptionRow({ icon: $r('app.media.ui_icon_download_dark'), title: '阅读缓存预取', value: 'Core command 未接入', disabled: true })
          ReaderLiveOptionRow({ icon: $r('app.media.ui_icon_info_dark'), title: '隐藏状态栏', active: this.hideStatusBar, switchRow: true, toggleKey: 'hideStatusBar' })
        }
        .width('100%')
      }
      .width('100%')
      .height('100%')
      .clip(true)
      .scrollBar(BarState.Off)
      .borderRadius(DemoAliasTokens.radiusMd)
      .backgroundColor(DemoAliasTokens.surface)
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
  @StorageProp(SafeAreaAdapter.K_BOTTOM) safeAreaBottom: number = SafeAreaAdapter.DEFAULT_BOTTOM;
  @StorageProp(ViewportAdapter.K_WIDTH) viewportWidth: number = ViewportAdapter.DEFAULT_WIDTH;
  @StorageProp(ViewportAdapter.K_HEIGHT) viewportHeight: number = ViewportAdapter.DEFAULT_HEIGHT;
  @Prop title: string = '';
  @Prop quickRoute: string = 'reader';
  @Prop debugLabel: string = 'ReaderExpandedPanel';
  @Prop utility: boolean = false;
  @BuilderParam content: () => void;

  private panelWidth(): number {
    return Math.max(0, this.viewportWidth - 24);
  }

  private panelHeight(): number {
    return Math.max(320, this.viewportHeight - this.safeAreaBottom - 106);
  }

  private iconLabel(): string {
    if (this.title === '目录') return '目';
    if (this.title === '朗读') return '朗';
    if (this.title === '界面') return 'A';
    if (this.title === '书籍缓存') return '缓';
    if (this.title === '调试信息') return '调';
    return '设';
  }

  private closeLabel(): string {
    return this.utility ? '完成' : '收起';
  }

  private closeRoute(): RouteId {
    return this.quickRoute as RouteId;
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack({ alignContent: Alignment.TopStart }) {
        Column({ space: 8 }) {
          Column()
            .width(42)
            .height(4)
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(ColorTokens.muted)
            .margin({ top: 9, left: '50%' })
            .translate({ x: -21 })
            .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))

          Row({ space: 10 }) {
            Row({ space: 8 }) {
              Text(this.iconLabel())
                .fontSize(11)
                .fontWeight(900)
                .fontColor(DemoAliasTokens.onPrimary)
                .width(22)
                .height(22)
                .borderRadius(DemoAliasTokens.radiusPill)
                .backgroundColor(ColorTokens.primaryDark)
                .textAlign(TextAlign.Center)
              Text(this.title)
                .fontSize(14)
                .fontWeight(760)
                .fontColor(ColorTokens.controlInk)
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis })
            }
            .layoutWeight(1)
            .height(30)
            .alignItems(VerticalAlign.Center)

            Text(this.closeLabel())
              .fontSize(10)
              .fontWeight(760)
              .fontColor(ColorTokens.primaryDark)
              .height(26)
              .padding({ left: 10, right: 10 })
              .borderRadius(DemoAliasTokens.radiusMd)
              .backgroundColor(ColorTokens.floatingControlBgAlt)
              .textAlign(TextAlign.Center)
              .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))
            InteractionDebugBadge({ label: 'close', tone: 'action' })
          }
          .width('100%')
          .height(30)

          Column() {
            this.content()
          }
          .width('100%')
          .layoutWeight(1)
          .justifyContent(FlexAlign.Start)
          .alignItems(HorizontalAlign.Start)
          .clip(true)
          .border({ width: 1, color: ColorTokens.border })
          .borderRadius(DemoAliasTokens.radiusLg)
          .backgroundColor(ColorTokens.surfaceSoft)
        }
        .width('100%')
        .height('100%')
        .padding({ left: 12, right: 12, top: 18, bottom: 12 })
        .border({ width: 1, color: ColorTokens.border })
        .borderRadius(DemoAliasTokens.radiusXl)
        .backgroundColor(ColorTokens.paperBright)
        .shadow({ radius: 8, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 2 })
        InteractionDebugFrame({ label: this.debugLabel, tone: 'sheet' })
      }
      .width(this.panelWidth())
      .height(this.panelHeight())
      .margin({ left: 12, top: 88 })
    }
    .width('100%')
    .height('100%')
    .hitTestBehavior(HitTestMode.Transparent)
    .zIndex(ZIndexTokens.bottomSheet)
  }
}

@Component
struct ReaderFullBlock {
  @Prop title: string = '';
  @Prop meta: string = '';
  @BuilderParam content: () => void;

  build() {
    Column({ space: 8 }) {
      Row() {
        Text(this.title)
          .fontSize(13)
          .fontWeight(800)
          .fontColor(ColorTokens.controlInk)
          .layoutWeight(1)
        if (this.meta !== '') {
          Text(this.meta)
            .fontSize(10)
            .fontWeight(600)
            .fontColor(ColorTokens.muted)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
      }
      .width('100%')
      .height(18)
      this.content()
    }
    .width('100%')
    .padding({ left: 10, right: 10, top: 10, bottom: 10 })
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
  }
}

@Component
struct ReaderFullChoiceRow {
  @Prop values: string[] = [];
  @Prop active: string = '';
  @Prop choiceKey: string = '';
  @Prop disabled: boolean = false;

  private select(value: string): void {
    if (this.disabled) return;
    if (this.choiceKey === 'tapMode') {
      ReaderUiStore.dispatch({ type: 'set-reader-setting-option', optionKey: 'tapMode', optionValue: value });
    } else if (this.choiceKey === 'pageAnimation') {
      ReaderUiStore.dispatch({ type: 'set-reader-setting-option', optionKey: 'pageAnimation', optionValue: this.pageAnimationValue(value) });
    } else if (this.choiceKey === 'ttsRate') {
      ReaderUiStore.dispatch({ type: 'tts-set-rate', ttsRate: parseFloat(value) });
    }
  }

  private pageAnimationValue(value: string): string {
    if (value === '覆盖' || value === 'cover') return 'cover';
    if (value === '无' || value === '无动画' || value === 'none') return 'none';
    return 'slide';
  }

  private isActive(value: string): boolean {
    if (this.choiceKey !== 'pageAnimation') return value === this.active;
    return this.pageAnimationValue(value) === this.pageAnimationValue(this.active);
  }

  build() {
    Row({ space: 6 }) {
      ForEach(this.values, (value: string, i: number) => {
        Text(value)
          .fontSize(10)
          .fontWeight(760)
          .fontColor(this.disabled ? ColorTokens.muted : (this.isActive(value) ? DemoAliasTokens.onPrimary : ColorTokens.controlInk))
          .height(30)
          .layoutWeight(1)
          .borderRadius(DemoAliasTokens.radiusMd)
          .backgroundColor(!this.disabled && this.isActive(value) ? ColorTokens.primaryDark : ColorTokens.floatingControlBgAlt)
          .textAlign(TextAlign.Center)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .opacity(this.disabled ? 0.56 : 1)
          .enabled(!this.disabled)
          .onClick(() => this.select(value))
      }, (value: string, i: number) => `${value}-${i}`)
    }
    .width('100%')
  }
}

@Component
struct ReaderFullFontChoiceRow {
  @StorageProp('reader.typography.fontFamily') fontFamily: string = 'serif';
  private values: Array<[string, ReaderFontFamily]> = ReaderAppearanceSpecRegistry.fonts
    .filter((item: ReaderAppearanceFont) => !item.importAction)
    .map((item: ReaderAppearanceFont): [string, ReaderFontFamily] => [item.label, appearanceReaderFontFamily(item.arktsValue)]);

  build() {
    Column({ space: 8 }) {
      ForEach([0, 1], (row: number) => {
        Row({ space: 8 }) {
          ForEach(this.values.slice(row * 4, row * 4 + 4), (item: [string, ReaderFontFamily], i: number) => {
            Text(item[0])
              .fontSize(9)
              .fontWeight(760)
              .fontColor(item[1] === this.fontFamily ? DemoAliasTokens.onPrimary : ColorTokens.controlInk)
              .height(30)
              .layoutWeight(1)
              .borderRadius(12)
              .border({ width: 1, color: item[1] === this.fontFamily ? ColorTokens.primary : ColorTokens.border })
              .backgroundColor(item[1] === this.fontFamily ? ColorTokens.primaryDark : ColorTokens.floatingControlBgAlt)
              .textAlign(TextAlign.Center)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
              .onClick(() => ReaderUiStore.dispatch({ type: 'set-reader-font-family', fontFamily: item[1] }))
          }, (item: [string, ReaderFontFamily], i: number) => `${item[1]}-${row}-${i}`)
        }
        .width('100%')
      }, (row: number) => `${row}`)
      Row() {
        Text(ReaderAppearanceSpecRegistry.fonts.find((item: ReaderAppearanceFont) => item.importAction)?.label ?? '+ 导入')
          .fontSize(9)
          .fontWeight(760)
          .fontColor(ColorTokens.controlInk)
          .width('23%')
          .height(30)
          .borderRadius(12)
          .border({ width: 1, color: ColorTokens.muted, style: BorderStyle.Dashed })
          .textAlign(TextAlign.Center)
          .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'reader-font-import-confirm' }))
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
                .width(46)
                .height(18)
                .borderRadius(6)
                .backgroundColor(item.swatch)
                .border({ width: this.isActive(item) ? 2 : 1, color: this.isActive(item) ? ColorTokens.primary : ColorTokens.border })
              Text(item.label)
                .fontSize(9)
                .fontWeight(700)
                .fontColor(this.isActive(item) ? ColorTokens.primary : ColorTokens.muted)
                .maxLines(1)
            }
            .layoutWeight(1)
            .height(59)
            .justifyContent(FlexAlign.Center)
            .alignItems(HorizontalAlign.Center)
            .borderRadius(DemoAliasTokens.radiusMd)
            .border({ width: this.isActive(item) ? 1 : 0, color: ColorTokens.primary })
            .backgroundColor(this.isActive(item) ? ColorTokens.floatingControlBgAlt : DemoAliasTokens.surface)
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
      .fontWeight(760)
      .fontColor(ColorTokens.controlInk)
      .width(74)
      .height(28)
      .borderRadius(6)
      .border({ width: 1, color: ColorTokens.border })
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
        .fontSize(11)
        .fontWeight(760)
        .fontColor(ColorTokens.controlInk)
        .layoutWeight(1)
      Text(this.currentLabel())
        .fontSize(10)
        .fontWeight(650)
        .fontColor(ColorTokens.muted)
      Text('⌄')
        .fontSize(11)
        .fontColor(ColorTokens.muted)
        .margin({ left: 8 })
    }
    .width('100%')
    .height(34)
    .padding({ left: 10, right: 10 })
    .borderRadius(8)
    .border({ width: 1, color: ColorTokens.border })
    .backgroundColor(ColorTokens.floatingControlBgAlt)
    .alignItems(VerticalAlign.Center)
    .onClick(() => this.select())
  }
}

@Component
struct ReaderFullStepperRow {
  @Prop label: string = '';
  @Prop value: string = '';
  @Prop metric: ReaderRenderMetric = 'fontSize';

  private title(): string {
    return ReaderAppearanceSpecRegistry.stepper(this.metric)?.label ?? this.label;
  }

  build() {
    Row() {
      Text(this.title())
        .fontSize(12)
        .fontWeight(760)
        .fontColor(ColorTokens.controlInk)
        .layoutWeight(1)
      Row({ space: 6 }) {
        Text('-')
          .fontSize(15)
          .fontWeight(900)
          .fontColor(ColorTokens.controlInk)
          .width(28)
          .height(26)
          .borderRadius(DemoAliasTokens.radiusMd)
          .backgroundColor(ColorTokens.floatingControlBgAlt)
          .textAlign(TextAlign.Center)
          .onClick(() => ReaderUiStore.dispatch({ type: 'step-reader-render-metric', readerMetric: this.metric, delta: -1 }))
        Text(this.value)
          .fontSize(11)
          .fontWeight(800)
          .fontColor(ColorTokens.controlInk)
          .width(42)
          .textAlign(TextAlign.Center)
        Text('+')
          .fontSize(15)
          .fontWeight(900)
          .fontColor(ColorTokens.controlInk)
          .width(28)
          .height(26)
          .borderRadius(DemoAliasTokens.radiusMd)
          .backgroundColor(ColorTokens.floatingControlBgAlt)
          .textAlign(TextAlign.Center)
          .onClick(() => ReaderUiStore.dispatch({ type: 'step-reader-render-metric', readerMetric: this.metric, delta: 1 }))
      }
    }
    .width('100%')
    .height(32)
    .alignItems(VerticalAlign.Center)
  }
}

@Component
struct ReaderFullToggleRow {
  @Prop icon: string = '';
  @Prop title: string = '';
  @Prop active: boolean = false;
  @Prop toggleKey: string = '';
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
      } else {
        ReaderCompactSwitch({ active: this.active, toggleKey: this.toggleKey })
      }
    }
    .width('100%')
    .height(38)
    .padding({ left: 9, right: 9 })
    .border({ width: { top: 1 }, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
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
      Row({ space: 8 }) {
        Text(this.title)
          .fontSize(13)
          .fontWeight(this.current ? 800 : 650)
          .fontColor(this.current ? ColorTokens.primaryDark : ColorTokens.controlInk)
          .layoutWeight(1)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        if (this.current) {
          Text('当前')
            .fontSize(9)
            .fontWeight(760)
            .fontColor(ColorTokens.primaryDark)
            .height(22)
            .padding({ left: 7, right: 7 })
            .borderRadius(DemoAliasTokens.radiusSm)
            .backgroundColor(ColorTokens.floatingControlBgAlt)
            .textAlign(TextAlign.Center)
        }
      }
      .width('100%')
      .height(42)
      .padding({ left: 10, right: 10 })
      .border({ width: { top: 1 }, color: ColorTokens.border })
      .alignItems(VerticalAlign.Center)
      .onClick(() => this.openChapter())
      InteractionDebugBadge({ label: 'row', tone: 'action' })
    }
    .width('100%')
    .height(42)
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

  private statusMessage(): string {
    if (this.currentBook === null) return '尚未选择书籍，无法显示目录。';
    return this.loading ? '正在从 Core 加载章节目录…' : '暂无从 Core 返回的章节目录。';
  }

  private isCurrent(chapter: ChapterTocEntry): boolean {
    return this.currentChapterTitle.length > 0 && this.currentChapterTitle === chapter.title;
  }

  build() {
    ReaderFullPanelShell({ title: '目录', quickRoute: 'toc-bookmarks', debugLabel: 'ReaderExpandedPanel' }) {
      Column() {
        Row({ space: 6 }) {
          Text('目录')
            .fontSize(12)
            .fontWeight(800)
            .fontColor(this.tocMode === 'directory' ? DemoAliasTokens.onPrimary : ColorTokens.controlInk)
            .layoutWeight(1)
            .height(32)
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(this.tocMode === 'directory' ? ColorTokens.primaryDark : ColorTokens.floatingControlBgAlt)
            .textAlign(TextAlign.Center)
            .onClick(() => ReaderUiStore.dispatch({ type: 'set-toc-mode', tocMode: 'directory' }))
          Text('书签')
            .fontSize(12)
            .fontWeight(800)
            .fontColor(this.tocMode === 'bookmark' ? DemoAliasTokens.onPrimary : ColorTokens.controlInk)
            .layoutWeight(1)
            .height(32)
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(this.tocMode === 'bookmark' ? ColorTokens.primaryDark : ColorTokens.floatingControlBgAlt)
            .textAlign(TextAlign.Center)
            .onClick(() => ReaderUiStore.dispatch({ type: 'set-toc-mode', tocMode: 'bookmark' }))
        }
        .width('100%')
        .padding({ left: 10, right: 10, top: 10, bottom: 8 })

        if (this.tocMode === 'bookmark') {
          if (this.currentBook === null) {
            Text('尚未打开书籍，无法读取 Core 书签。')
              .fontSize(12).fontColor(ColorTokens.muted).lineHeight(19)
              .width('100%').padding({ left: 10, right: 10, top: 16, bottom: 16 })
          } else if (this.bookmarksLoading || !this.bookmarksLoaded) {
            Text('正在从 Core 读取当前书的书签…')
              .fontSize(12).fontColor(ColorTokens.muted).lineHeight(19)
              .width('100%').padding({ left: 10, right: 10, top: 16, bottom: 16 })
          } else if (this.bookmarksError.length > 0) {
            Text(`书签操作失败：${this.bookmarksError}`)
              .fontSize(12).fontColor(ColorTokens.accent).lineHeight(19)
              .width('100%').padding({ left: 10, right: 10, top: 16, bottom: 16 })
          } else if (this.bookmarks.length === 0) {
            Text('当前书在 Core 中还没有书签。可在阅读器控制栏添加当前位置书签。')
              .fontSize(12).fontColor(ColorTokens.muted).lineHeight(19)
              .width('100%').padding({ left: 10, right: 10, top: 16, bottom: 16 })
          } else {
            Scroll() {
              Column() {
                ForEach(this.bookmarks, (bookmark: CoreBookmark, i: number) => {
                  ReaderBookmarkLiveRow({ bookmark: bookmark, expanded: true })
                }, (bookmark: CoreBookmark, i: number) => `${bookmark.time}-${i}`)
              }
              .width('100%')
            }
            .width('100%')
            .layoutWeight(1)
            .scrollBar(BarState.Auto)
          }
        } else if (this.currentBook === null || this.chapterToc.length === 0) {
          Text(this.statusMessage())
            .fontSize(12)
            .fontColor(ColorTokens.muted)
            .lineHeight(19)
            .width('100%')
            .padding({ left: 10, right: 10, top: 16, bottom: 16 })
        } else {
          Scroll() {
            Column() {
              ForEach(this.chapterToc, (chapter: ChapterTocEntry, i: number) => {
                ReaderFullTocRow({
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
      .backgroundColor(DemoAliasTokens.surface)
    }
  }
}

@Component
export struct ReaderFullTtsPage {
  @StorageProp('reader.ttsSession.playback') playback: string = 'idle';
  @StorageProp('reader.ttsSession.currentSegment') currentSegment: number = 0;
  @StorageProp('reader.ttsSession.totalSegments') totalSegments: number = 0;
  @StorageProp('reader.chapterContent') chapterContent: string[] = [];

  private canStart(): boolean {
    return this.chapterContent.length > 0;
  }

  private hasQueue(): boolean {
    return this.totalSegments > 0;
  }

  private playbackIcon(): string {
    return this.playback === 'playing' ? 'Ⅱ' : '▶';
  }

  private playbackLabel(): string {
    if (this.playback === 'playing') return '暂停';
    if (this.playback === 'paused') return '继续';
    return '播放';
  }

  private segmentLabel(): string {
    if (!this.hasQueue()) return '等待 Core 切分当前正文';
    return `片段 ${this.currentSegment + 1}/${this.totalSegments}`;
  }

  build() {
    ReaderFullPanelShell({ title: '朗读', quickRoute: 'tts', debugLabel: 'ReaderExpandedPanel' }) {
      Scroll() {
        Column({ space: 10 }) {
          Row({ space: 12 }) {
          Text('‹')
            .fontSize(24)
            .fontWeight(800)
            .fontColor(ColorTokens.controlInk)
            .width(44)
            .height(44)
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(ColorTokens.floatingControlBgAlt)
            .textAlign(TextAlign.Center)
            .opacity(this.hasQueue() ? 1 : 0.5)
            .enabled(this.hasQueue())
            .onClick(() => ReaderUiStore.dispatch({ type: 'tts-prev' }))
          Text(this.playbackIcon())
            .fontSize(18)
            .fontWeight(800)
            .fontColor(DemoAliasTokens.onPrimary)
            .width(52)
            .height(52)
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(ColorTokens.primaryDark)
            .textAlign(TextAlign.Center)
            .opacity(this.canStart() ? 1 : 0.5)
            .enabled(this.canStart())
            .onClick(() => ReaderUiStore.dispatch({ type: 'tts-toggle' }))
          Text('›')
            .fontSize(24)
            .fontWeight(800)
            .fontColor(ColorTokens.controlInk)
            .width(44)
            .height(44)
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(ColorTokens.floatingControlBgAlt)
            .textAlign(TextAlign.Center)
            .opacity(this.hasQueue() ? 1 : 0.5)
            .enabled(this.hasQueue())
            .onClick(() => ReaderUiStore.dispatch({ type: 'tts-next' }))
        }
        .width('100%')
        .height(64)
        .justifyContent(FlexAlign.Center)
        .alignItems(VerticalAlign.Center)

          Text(this.canStart() ? `${this.playbackLabel()} · ${this.segmentLabel()}` : '正文尚未从 Core 加载，无法开始朗读。')
          .fontSize(10)
          .fontWeight(650)
          .fontColor(ColorTokens.muted)
          .width('100%')
          .textAlign(TextAlign.Center)

          ReaderFullBlock({ title: '语速', meta: 'TextReader Host 未提供程序化速率' }) {
            ReaderFullChoiceRow({ values: ['0.5x', '1.0x', '1.5x', '2.0x'], active: '', choiceKey: 'ttsRate', disabled: true })
          }
          ReaderFullBlock({ title: '音色', meta: 'Host 未提供映射' }) {
            ReaderFullChoiceRow({ values: ['系统默认', '清晰女声', '沉稳男声'], active: '', disabled: true })
          }
          ReaderFullBlock({ title: '朗读范围', meta: 'Core 仅当前章节' }) {
            ReaderFullChoiceRow({ values: ['当前章节', '本书剩余', '循环朗读'], active: '当前章节', disabled: true })
          }
          ReaderFullBlock({ title: '在线语音', meta: 'HttpTTS 合同与凭据/播放闭环未接入' }) {
            Column() {
              ReaderFullToggleRow({ icon: '区', title: '区域', disabled: true, unavailableReason: '合同缺失' })
              ReaderFullToggleRow({ icon: '语', title: '语言', disabled: true, unavailableReason: '合同缺失' })
              ReaderFullToggleRow({ icon: '模', title: '模型', disabled: true, unavailableReason: '合同缺失' })
            }
            .width('100%')
          }
          ReaderFullBlock({ title: '定时关闭', meta: 'Core/Host 未接入' }) {
            ReaderFullChoiceRow({ values: ['不定时', '15 分钟', '30 分钟'], active: '', disabled: true })
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
export struct ReaderFullAppearancePage {
  @StorageProp('reader.typography.fontSize') fontSize: number = ReaderAppearanceSpecRegistry.stepper('fontSize')!.defaultValue;
  @StorageProp('reader.typography.lineHeight') lineHeightRatio: number = ReaderAppearanceSpecRegistry.stepper('lineHeight')!.defaultValue;
  @StorageProp('reader.typography.paragraphGap') paragraphGap: number = ReaderAppearanceSpecRegistry.stepper('paragraphGap')!.defaultValue;
  @StorageProp('reader.typography.letterSpacing') letterSpacing: number = ReaderAppearanceSpecRegistry.stepper('letterSpacing')!.defaultValue;
  @StorageProp('reader.pageSpace.topMargin') topMargin: number = 72;
  @StorageProp('reader.pageSpace.sideMargin') sideMargin: number = 32;
  @StorageProp('reader.pageSpace.paragraphIndent') paragraphIndent: number = 2;
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
        Column({ space: 10 }) {
          ReaderFullBlock({ title: '主题库', meta: '日间：纸纹 · 夜间：夜纹' }) {
            ReaderFullThemeGrid()
          }
          ReaderFullBlock({ title: '字形选择', meta: '使用已接入的本地字形' }) {
            ReaderFullFontChoiceRow()
          }
          ReaderFullBlock({ title: '排版' }) {
            Column({ space: 4 }) {
              ReaderFullAppearanceSelectRow({ label: '缩进', value: this.paragraphIndentMode, optionKey: 'paragraphIndentMode' })
              ReaderFullAppearanceSelectRow({ label: '简繁', value: this.textConversion, optionKey: 'textConversion' })
              ReaderFullAppearanceSelectRow({ label: '翻页动画', value: this.pageAnimation, optionKey: 'pageAnimation' })
              ReaderFullAppearanceSelectRow({ label: '文字对齐', value: this.textAlignment, optionKey: 'textAlignment' })
              ReaderFullStepperRow({ label: '字号', value: this.whole(this.fontSize), metric: 'fontSize' })
              ReaderFullStepperRow({ label: '行距', value: this.two(this.lineHeightRatio), metric: 'lineHeight' })
              ReaderFullStepperRow({ label: '段距', value: this.whole(this.paragraphGap), metric: 'paragraphGap' })
              ReaderFullStepperRow({ label: '字距', value: this.one(this.letterSpacing), metric: 'letterSpacing' })
            }
            .width('100%')
          }
          ReaderFullBlock({ title: '页面空间', meta: '边距 / 缩进' }) {
            Column({ space: 4 }) {
              ReaderFullStepperRow({ label: '上下边距', value: this.whole(this.topMargin), metric: 'topMargin' })
              ReaderFullStepperRow({ label: '左右边距', value: this.whole(this.sideMargin), metric: 'sideMargin' })
              ReaderFullStepperRow({ label: '段首缩进', value: this.one(this.paragraphIndent), metric: 'paragraphIndent' })
            }
            .width('100%')
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
export struct ReaderFullSettingsPage {
  @StorageProp('reader.readerToggles.autoPage') autoPage: boolean = false;
  @StorageProp('reader.readerToggles.volumePage') volumePage: boolean = false;
  @StorageProp('reader.readerToggles.landscapeLock') landscapeLock: boolean = false;
  @StorageProp('reader.readerToggles.keepScreenOn') keepScreenOn: boolean = false;
  @StorageProp('reader.readerToggles.statusInfo') statusInfo: boolean = true;
  @StorageProp('reader.readerToggles.hapticFeedback') hapticFeedback: boolean = true;
  @StorageProp('reader.readerToggles.hideStatusBar') hideStatusBar: boolean = false;
  @StorageProp('reader.readerSettingOptions.tapMode') tapMode: string = '左右区域';
  @StorageProp('reader.readerSettingOptions.pageAnimation') pageAnimation: string = ReaderAppearanceSpecRegistry.select('pageAnimation')!.defaultValue;
  @StorageProp('reader.readerHostMessage') readerHostMessage: string = '';

  build() {
    ReaderFullPanelShell({ title: '设置', quickRoute: 'reader-settings', debugLabel: 'ReaderExpandedPanel' }) {
      Scroll() {
        Column({ space: 10 }) {
          if (this.readerHostMessage.length > 0) {
            Text(this.readerHostMessage)
            .fontSize(10)
            .fontWeight(650)
            .fontColor(ColorTokens.accent)
            .lineHeight(16)
            .width('100%')
            .padding({ left: 10, right: 10, top: 8, bottom: 8 })
            .border({ width: 1, color: ColorTokens.border })
            .borderRadius(DemoAliasTokens.radiusMd)
            .backgroundColor(ColorTokens.surfaceSoft)
        }
          ReaderFullBlock({ title: '点击翻页方式', meta: this.tapMode }) {
            ReaderFullChoiceRow({ values: ['左右区域', '中间', '边缘'], active: this.tapMode, choiceKey: 'tapMode' })
          }
          ReaderFullBlock({ title: '翻页动画', meta: '当前 Reader Pager 未接入仿真/滚动；可用平滑/覆盖/无动画' }) {
            ReaderFullChoiceRow({ values: ['平滑', '覆盖', '无动画'], active: this.pageAnimation, choiceKey: 'pageAnimation' })
          }
          ReaderFullBlock({ title: '阅读行为', meta: '开关项' }) {
            Column() {
              ReaderFullToggleRow({ icon: '翻', title: '自动翻页', active: this.autoPage, toggleKey: 'autoPage' })
              ReaderFullToggleRow({ icon: '音', title: '音量键翻页', active: this.volumePage, toggleKey: 'volumePage', disabled: true, unavailableReason: '未接入按键监听' })
              ReaderFullToggleRow({ icon: '横', title: '横屏锁定', active: this.landscapeLock, toggleKey: 'landscapeLock', disabled: true, unavailableReason: '未接入方向 Host' })
              ReaderFullToggleRow({ icon: '亮', title: '屏幕常亮', active: this.keepScreenOn, toggleKey: 'keepScreenOn' })
              ReaderFullToggleRow({ icon: '页', title: '页脚进度信息', active: this.statusInfo, toggleKey: 'statusInfo' })
              ReaderFullToggleRow({ icon: '触', title: '触摸反馈', active: this.hapticFeedback, toggleKey: 'hapticFeedback' })
              ReaderFullToggleRow({ icon: '栏', title: '隐藏状态栏', active: this.hideStatusBar, toggleKey: 'hideStatusBar' })
            }
            .width('100%')
            .borderRadius(DemoAliasTokens.radiusMd)
            .backgroundColor(ColorTokens.surfaceSoft)
          }
          ReaderFullBlock({ title: '阅读缓存预取', meta: 'Core command 未接入' }) {
            Text('当前 Core 未接入阅读缓存预取命令，设置页不能开启、关闭或显示预取结果。')
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
            ReaderUtilitySummaryCard({ value: `${this.loadedParagraphs().length}`, label: '本地已加载段落' })
            ReaderUtilitySummaryCard({ value: this.chapterLabel(), label: '当前章节' })
            ReaderUtilitySummaryCard({ value: '未接入', label: 'Core 阅读缓存 command' })
          }
          .width('100%')

          ReaderFullBlock({ title: '缓存能力', meta: 'Core 阅读缓存 command 未接入；操作已禁用' }) {
            Column({ space: 8 }) {
              Text('当前 Core 未接入阅读缓存命令，不能显示已缓存章节、容量、预取或清理结果。')
                .fontSize(10)
                .fontColor(ColorTokens.muted)
                .lineHeight(16)
              Row({ space: 8 }) {
                ReaderUtilityActionButton({ title: '缓存当前章节', detail: 'Core command 未接入', disabled: true })
                ReaderUtilityActionButton({ title: '预取后续章节', detail: 'Core command 未接入', disabled: true })
              }
              .width('100%')
              Row({ space: 8 }) {
                ReaderUtilityActionButton({ title: '查看缓存目录', detail: 'Core command 未接入', disabled: true })
                ReaderUtilityActionButton({ title: '清理阅读缓存', detail: 'Core command 未接入', danger: true, disabled: true })
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
      ['阅读缓存', 'reader-cache', '未接入', 'Core 阅读缓存 command 未接入'],
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

          ReaderFullBlock({ title: '命令可用性', meta: '未接入 command 已禁用' }) {
            Text('该页只展示当前 UI 已收到的阅读状态。正文全文搜索已接入 Core search.content，并且只查询当前书源、当前书籍的已缓存章节；阅读缓存管理和调试导出 command 仍未接入。')
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
    ReaderQuickPanelShell({ debugLabel: 'ReaderQuickPanel' }) {
      Column({ space: 5 }) {
        Row() {
          ReaderQuickBackButton()
          Blank()
          ReaderQuickPillButton({ label: 'Core 全文已接入', disabled: true })
        }
        .width('100%')
        .height(24)
        .alignItems(VerticalAlign.Center)

        Row({ space: 6 }) {
          Image($r('app.media.ui_icon_search_primary')).width(13).height(13)
          TextInput({ text: this.query, placeholder: '搜索当前书籍的已缓存正文' })
            .fontSize(11)
            .fontWeight(760)
            .fontColor(ColorTokens.controlInk)
            .layoutWeight(1)
            .enabled(this.hasCoreSearchScope() && !this.contentSearchLoading)
            .onChange((value: string) => { this.query = value; })
            .onSubmit(() => this.submitSearch())
          Text('搜索')
            .fontSize(10)
            .fontWeight(760)
            .fontColor(this.canSubmit() ? DemoAliasTokens.onPrimary : ColorTokens.muted)
            .height(22)
            .padding({ left: 8, right: 8 })
            .borderRadius(DemoAliasTokens.radiusSm)
            .backgroundColor(this.canSubmit() ? ColorTokens.primary : ColorTokens.metaBg)
            .opacity(this.canSubmit() ? 1 : 0.7)
            .enabled(this.canSubmit())
            .textAlign(TextAlign.Center)
            .onClick(() => this.submitSearch())
        }
        .width('100%')
        .height(32)
        .padding({ left: 8, right: 8 })
        .border({ width: 1, color: ColorTokens.border })
        .borderRadius(DemoAliasTokens.radiusMd)
        .backgroundColor(DemoAliasTokens.surface)
        .alignItems(VerticalAlign.Center)

        Column({ space: 4 }) {
          Text('Core search.content 只查询当前书源、当前书籍的已缓存章节；点击结果会按 Core 目录跳转并写入返回的正文偏移。')
            .fontSize(9)
            .fontColor(ColorTokens.muted)
            .lineHeight(14)
            .padding({ left: 8, right: 8, top: 6 })
          if (this.contentSearchMessage.length > 0) {
            Text(this.contentSearchMessage)
              .fontSize(9)
              .fontColor(ColorTokens.primaryDark)
              .lineHeight(14)
              .padding({ left: 8, right: 8 })
          }
          if (this.contentSearchResults.length > 0) {
            ForEach(this.contentSearchResults, (result: CoreContentSearchResult, i: number) => {
              ReaderSearchResultRow({
                title: this.resultTitle(result),
                detail: this.resultDetail(result),
                contentSearchResultIndex: i,
              })
            }, (result: CoreContentSearchResult, i: number) =>
              `${result.sourceId}-${result.bookId}-${result.chapterIndex}-${result.chapterOffset}-${i}`)
          } else {
            Text(this.statusMessage())
              .fontSize(10)
              .fontColor(ColorTokens.muted)
              .lineHeight(16)
              .padding(8)
          }
        }
        .width('100%')
        .layoutWeight(1)
        .clip(true)
        .border({ width: 1, color: ColorTokens.border })
        .borderRadius(DemoAliasTokens.radiusMd)
        .backgroundColor(DemoAliasTokens.surface)
      }
      .width('100%')
      .height('100%')
    }
  }
}

// ── Replace panel (.fd-replace-quick-panel) ───────────────────────────────
//   Live demo quick panel bound to state.replaceRules. Each row shows
//   pattern -> replacement, an enabled toggle, edit and delete buttons.
//   "新增规则" opens an inline form (pattern / replacement / scope) that
//   dispatches replace-rule-add / replace-rule-edit; the toggle dispatches
//   replace-rule-toggle; delete first opens an inline confirmation bound to a
//   persisted Core rule, then the second tap dispatches the Core write.
@Component
export struct ReaderReplacePanel {
  @StorageProp('reader.replaceRules') rules: ReplaceRule[] = [];
  @StorageProp('reader.pendingReplaceRuleDeleteId') pendingReplaceRuleDeleteId: string = '';
  @State formVisible: boolean = false;
  @State editingId: string = '';
  @State patternInput: string = '';
  @State replacementInput: string = '';
  @State scopeInput: string = 'chapter';

  private openAddForm(): void {
    this.editingId = '';
    this.patternInput = '';
    this.replacementInput = '';
    this.scopeInput = 'chapter';
    this.formVisible = true;
  }

  private openEditForm(rule: ReplaceRule): void {
    this.editingId = rule.id;
    this.patternInput = rule.pattern;
    this.replacementInput = rule.replacement;
    this.scopeInput = rule.scope;
    this.formVisible = true;
  }

  private closeForm(): void {
    this.formVisible = false;
    this.editingId = '';
  }

  private pendingDeleteRule(): ReplaceRule | null {
    const id = this.pendingReplaceRuleDeleteId;
    for (let i = 0; i < this.rules.length; i++) {
      if (this.rules[i].id === id) return this.rules[i];
    }
    return null;
  }

  private submitForm(): void {
    if (this.patternInput.length === 0) {
      return;
    }
    if (this.editingId.length > 0) {
      ReaderUiStore.dispatch({
        type: 'replace-rule-edit',
        replaceRuleId: this.editingId,
        replaceRulePattern: this.patternInput,
        replaceRuleReplacement: this.replacementInput,
        replaceRuleScope: this.scopeInput,
      });
    } else {
      ReaderUiStore.dispatch({
        type: 'replace-rule-add',
        replaceRulePattern: this.patternInput,
        replaceRuleReplacement: this.replacementInput,
        replaceRuleScope: this.scopeInput,
      });
    }
    this.closeForm();
  }

  build() {
    ReaderQuickPanelShell({ debugLabel: 'ReaderQuickPanel' }) {
      Column({ space: 5 }) {
        Row() {
          ReaderQuickBackButton()
          Blank()
          Text('新增规则')
            .fontSize(10)
            .fontWeight(750)
            .fontColor(ColorTokens.primaryDark)
            .height(24)
            .padding({ left: 9, right: 9 })
            .border({ width: 1, color: ColorTokens.primary })
            .borderRadius(DemoAliasTokens.radiusMd)
            .backgroundColor(DemoAliasTokens.surface)
            .textAlign(TextAlign.Center)
            .onClick(() => this.openAddForm())
        }
        .width('100%')
        .height(24)
        .alignItems(VerticalAlign.Center)

        // Preset rule category labels (live demo copy)
        Row({ space: 8 }) {
          Text('雨容称呼').fontSize(9).fontColor(ColorTokens.muted)
          Text('旧称统一').fontSize(9).fontColor(ColorTokens.muted)
          Text('标点清理').fontSize(9).fontColor(ColorTokens.muted)
          Text('广告过滤').fontSize(9).fontColor(ColorTokens.muted)
        }
        .width('100%')
        .height(18)
        .alignItems(VerticalAlign.Center)

        if (this.formVisible) {
          Column({ space: 6 }) {
            Text(this.editingId.length > 0 ? '编辑规则' : '新增规则')
              .fontSize(11)
              .fontWeight(700)
              .fontColor(ColorTokens.controlInk)

            TextInput({ text: this.patternInput, placeholder: '匹配内容' })
              .fontSize(11)
              .fontColor(ColorTokens.ink)
              .height(32)
              .padding({ left: 8, right: 8 })
              .borderRadius(DemoAliasTokens.radiusSm)
              .backgroundColor(ColorTokens.metaBg)
              .border({ width: 1, color: ColorTokens.border })
              .onChange((v: string) => { this.patternInput = v; })

            TextInput({ text: this.replacementInput, placeholder: '替换为（可空）' })
              .fontSize(11)
              .fontColor(ColorTokens.ink)
              .height(32)
              .padding({ left: 8, right: 8 })
              .borderRadius(DemoAliasTokens.radiusSm)
              .backgroundColor(ColorTokens.metaBg)
              .border({ width: 1, color: ColorTokens.border })
              .onChange((v: string) => { this.replacementInput = v; })

            Row({ space: 4 }) {
              Text('本章')
                .fontSize(11)
                .fontWeight(760)
                .fontColor(this.scopeInput === 'chapter' ? DemoAliasTokens.onPrimary : ColorTokens.controlInk)
                .layoutWeight(1)
                .height(24)
                .textAlign(TextAlign.Center)
                .borderRadius(DemoAliasTokens.radiusSm)
                .backgroundColor(this.scopeInput === 'chapter' ? ColorTokens.primaryDark : 'transparent')
                .onClick(() => { this.scopeInput = 'chapter'; })
              Text('全书')
                .fontSize(11)
                .fontWeight(760)
                .fontColor(this.scopeInput === 'book' ? DemoAliasTokens.onPrimary : ColorTokens.controlInk)
                .layoutWeight(1)
                .height(24)
                .textAlign(TextAlign.Center)
                .borderRadius(DemoAliasTokens.radiusSm)
                .backgroundColor(this.scopeInput === 'book' ? ColorTokens.primaryDark : 'transparent')
                .onClick(() => { this.scopeInput = 'book'; })
            }
            .width('100%')
            .height(24)

            Row({ space: 8 }) {
              Text('保存')
                .fontSize(11)
                .fontWeight(760)
                .fontColor(DemoAliasTokens.onPrimary)
                .height(26)
                .padding({ left: 14, right: 14 })
                .borderRadius(DemoAliasTokens.radiusPill)
                .backgroundColor(ColorTokens.primary)
                .textAlign(TextAlign.Center)
                .onClick(() => this.submitForm())
              Text('取消')
                .fontSize(11)
                .fontWeight(760)
                .fontColor(ColorTokens.primaryDark)
                .height(26)
                .padding({ left: 14, right: 14 })
                .borderRadius(DemoAliasTokens.radiusPill)
                .border({ width: 1, color: ColorTokens.primary })
                .backgroundColor(DemoAliasTokens.surface)
                .textAlign(TextAlign.Center)
                .onClick(() => this.closeForm())
            }
            .width('100%')
            .alignItems(VerticalAlign.Center)
          }
          .width('100%')
          .padding(8)
          .border({ width: 1, color: ColorTokens.border })
          .borderRadius(DemoAliasTokens.radiusMd)
          .backgroundColor(DemoAliasTokens.surface)
        }

        if (this.pendingReplaceRuleDeleteId.length > 0) {
          Column({ space: 6 }) {
            Text('确认删除这条替换规则？')
              .fontSize(11)
              .fontWeight(760)
              .fontColor(ColorTokens.controlInk)
            Text(this.pendingDeleteRule()?.pattern ?? '该规则已不在当前 Core 列表中')
              .fontSize(10)
              .fontColor(ColorTokens.muted)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
            Row({ space: 8 }) {
              Text('取消')
                .fontSize(10)
                .fontWeight(760)
                .fontColor(ColorTokens.primaryDark)
                .height(26)
                .padding({ left: 12, right: 12 })
                .border({ width: 1, color: ColorTokens.primary })
                .borderRadius(DemoAliasTokens.radiusPill)
                .backgroundColor(DemoAliasTokens.surface)
                .textAlign(TextAlign.Center)
                .onClick(() => ReaderUiStore.dispatch({ type: 'replace-rule-delete-cancel' }))
              Text('确认删除')
                .fontSize(10)
                .fontWeight(760)
                .fontColor(DemoAliasTokens.onPrimary)
                .height(26)
                .padding({ left: 12, right: 12 })
                .borderRadius(DemoAliasTokens.radiusPill)
                .backgroundColor(ColorTokens.border)
                .textAlign(TextAlign.Center)
                .onClick(() => ReaderUiStore.dispatch({ type: 'replace-rule-delete-confirm' }))
            }
            .width('100%')
            .alignItems(VerticalAlign.Center)
          }
          .width('100%')
          .padding(8)
          .border({ width: 1, color: ColorTokens.border })
          .borderRadius(DemoAliasTokens.radiusMd)
          .backgroundColor(ColorTokens.metaBg)
        }

        Column() {
          ForEach(this.rules, (rule: ReplaceRule, i: number) => {
            Row({ space: 6 }) {
              Column() {
                Text(rule.pattern)
                  .fontSize(11)
                  .fontWeight(600)
                  .fontColor(ColorTokens.controlInk)
                  .maxLines(1)
                  .textOverflow({ overflow: TextOverflow.Ellipsis })
                if (rule.replacement.length > 0) {
                  Text(`→ ${rule.replacement}`)
                    .fontSize(9)
                    .fontColor(ColorTokens.muted)
                    .maxLines(1)
                    .textOverflow({ overflow: TextOverflow.Ellipsis })
                }
              }
              .layoutWeight(1)
              .alignItems(HorizontalAlign.Start)

              Toggle({ type: ToggleType.Switch, isOn: rule.enabled })
                .selectedColor(ColorTokens.primary)
                .onChange((on: boolean) => ReaderUiStore.dispatch({ type: 'replace-rule-toggle', replaceRuleId: rule.id }))

              Text('编辑')
                .fontSize(10)
                .fontWeight(750)
                .fontColor(ColorTokens.primaryDark)
                .height(24)
                .padding({ left: 8, right: 8 })
                .border({ width: 1, color: ColorTokens.primary })
                .borderRadius(DemoAliasTokens.radiusMd)
                .backgroundColor(DemoAliasTokens.surface)
                .textAlign(TextAlign.Center)
                .onClick(() => this.openEditForm(rule))

              Text('删除')
                .fontSize(10)
                .fontWeight(750)
                .fontColor(DemoAliasTokens.onPrimary)
                .height(24)
                .padding({ left: 8, right: 8 })
                .borderRadius(DemoAliasTokens.radiusMd)
                .backgroundColor(ColorTokens.border)
                .textAlign(TextAlign.Center)
                .onClick(() => ReaderUiStore.dispatch({ type: 'replace-rule-delete-request', replaceRuleId: rule.id }))
            }
            .width('100%')
            .height(40)
            .padding({ left: 10, right: 10 })
            .border({ width: { top: 1 }, color: ColorTokens.border })
            .alignItems(VerticalAlign.Center)
          }, (rule: ReplaceRule, i: number) => `${rule.id}|${rule.pattern}|${rule.replacement}|${rule.enabled}`)
        }
        .width('100%')
        .layoutWeight(1)
        .clip(true)
        .border({ width: 1, color: ColorTokens.border })
        .borderRadius(DemoAliasTokens.radiusMd)
        .backgroundColor(DemoAliasTokens.surface)
      }
      .width('100%')
      .height('100%')
    }
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
    ReaderQuickPanelShell({ debugLabel: 'ReaderQuickPanel' }) {
      Column({ space: 5 }) {
        Row() {
          ReaderQuickBackButton()
          Blank()
          ReaderQuickPillButton({ label: this.toggleLabel(), tapEvent: 'auto-page-toggle' })
        }
        .width('100%')
        .height(24)
        .alignItems(VerticalAlign.Center)

        Row({ space: 0 }) {
          Column({ space: 3 }) {
            Row() {
              Image($r('app.media.reader_icon_chevron_left_chapter')).width(14).height(14)
              Image($r('app.media.reader_icon_chevron_left_chapter')).width(14).height(14).margin({ left: -7 })
            }
            .width(30)
            .height(26)
            .justifyContent(FlexAlign.Center)
            .alignItems(VerticalAlign.Center)
            .border({ width: 1, color: ColorTokens.border })
            .borderRadius(DemoAliasTokens.radiusMd)
            .backgroundColor(DemoAliasTokens.surface)
            Text('上一章')
              .fontSize(9)
              .fontWeight(700)
              .fontColor(ColorTokens.controlInk)
          }
          .width(46)
          .height('100%')
          .justifyContent(FlexAlign.Center)
          .alignItems(HorizontalAlign.Center)
          .onClick(() => ReaderUiStore.dispatch({ type: 'chapter-prev' }))

          Column({ space: 4 }) {
            Stack({ alignContent: Alignment.Center }) {
              Image($r('app.media.reader_icon_play_white')).width(15).height(15)
            }
            .width(38)
            .height(38)
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(ColorTokens.primaryDark)
            Text('自动翻页')
              .fontSize(12)
              .fontWeight(800)
              .fontColor(ColorTokens.controlInk)
              .maxLines(1)
          }
          .layoutWeight(1)
          .height('100%')
          .justifyContent(FlexAlign.Center)
          .alignItems(HorizontalAlign.Center)
          .onClick(() => ReaderUiStore.dispatch({ type: 'auto-page-toggle' }))

          Column({ space: 3 }) {
            Row() {
              Image($r('app.media.reader_icon_chevron_chapter')).width(14).height(14)
              Image($r('app.media.reader_icon_chevron_chapter')).width(14).height(14).margin({ left: -7 })
            }
            .width(30)
            .height(26)
            .justifyContent(FlexAlign.Center)
            .alignItems(VerticalAlign.Center)
            .border({ width: 1, color: ColorTokens.border })
            .borderRadius(DemoAliasTokens.radiusMd)
            .backgroundColor(DemoAliasTokens.surface)
            Text('下一章')
              .fontSize(9)
              .fontWeight(700)
              .fontColor(ColorTokens.controlInk)
          }
          .width(46)
          .height('100%')
          .justifyContent(FlexAlign.Center)
          .alignItems(HorizontalAlign.Center)
          .onClick(() => ReaderUiStore.dispatch({ type: 'chapter-next' }))
        }
        .width('100%')
        .height(73)
        .padding({ left: 8, right: 8, top: 4, bottom: 4 })
        .border({ width: 1, color: ColorTokens.border })
        .borderRadius(DemoAliasTokens.radiusMd)
        .backgroundColor(DemoAliasTokens.surface)

        Row() {
          Text('翻页速度')
            .fontSize(12)
            .fontWeight(760)
            .fontColor(ColorTokens.controlInk)
            .layoutWeight(1)
          Row({ space: 5 }) {
            Text('-').fontSize(18).fontWeight(800).fontColor(ColorTokens.controlInk)
              .width(24).height(24).textAlign(TextAlign.Center)
              .borderRadius(DemoAliasTokens.radiusPill).backgroundColor(ColorTokens.floatingControlBgAlt)
              .onClick(() => ReaderUiStore.dispatch({ type: 'auto-page-step-interval', delta: -1 }))
            Text(`${this.intervalSeconds} 秒`).fontSize(15).fontWeight(780).fontColor(ColorTokens.controlInk)
              .width(46).textAlign(TextAlign.Center)
            Text('+').fontSize(18).fontWeight(800).fontColor(ColorTokens.controlInk)
              .width(24).height(24).textAlign(TextAlign.Center)
              .borderRadius(DemoAliasTokens.radiusPill).backgroundColor(ColorTokens.floatingControlBgAlt)
              .onClick(() => ReaderUiStore.dispatch({ type: 'auto-page-step-interval', delta: 1 }))
          }
        }
        .width('100%')
        .height(32)
        .padding({ left: 7, right: 7 })
        .border({ width: 1, color: ColorTokens.border })
        .borderRadius(DemoAliasTokens.radiusMd)
        .backgroundColor(DemoAliasTokens.surface)
        .alignItems(VerticalAlign.Center)

        Row({ space: 4 }) {
          Text('连续')
            .fontSize(12).fontWeight(760)
            .fontColor(this.autoPageMode === 'continuous' ? DemoAliasTokens.onPrimary : ColorTokens.controlInk)
            .layoutWeight(1).height(20).textAlign(TextAlign.Center)
            .borderRadius(DemoAliasTokens.radiusSm)
            .backgroundColor(this.autoPageMode === 'continuous' ? ColorTokens.primaryDark : 'transparent')
            .onClick(() => ReaderUiStore.dispatch({ type: 'auto-page-set-mode', autoPageMode: 'continuous' }))
          Text('单页')
            .fontSize(12).fontWeight(760)
            .fontColor(this.autoPageMode === 'single' ? DemoAliasTokens.onPrimary : ColorTokens.controlInk)
            .layoutWeight(1).height(20).textAlign(TextAlign.Center)
            .borderRadius(DemoAliasTokens.radiusSm)
            .backgroundColor(this.autoPageMode === 'single' ? ColorTokens.primaryDark : 'transparent')
            .onClick(() => ReaderUiStore.dispatch({ type: 'auto-page-set-mode', autoPageMode: 'single' }))
        }
        .width('100%')
        .height(28)
        .padding(3)
        .border({ width: 1, color: ColorTokens.border })
        .borderRadius(DemoAliasTokens.radiusMd)
        .backgroundColor(DemoAliasTokens.surface)
      }
      .width('100%')
      .height('100%')
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
        .shadow({ radius: 8, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 2 })
        .margin({ bottom: SizeTokens.bottomBarHeight + 152 })
    }
    .width('100%')
    .height('100%')
  }
}
