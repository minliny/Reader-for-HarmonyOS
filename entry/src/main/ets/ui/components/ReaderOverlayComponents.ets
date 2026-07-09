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
import { SafeAreaAdapter } from '../adapters/SafeAreaAdapter';
import { ViewportAdapter } from '../adapters/ViewportAdapter';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { ReaderFontFamily, ReaderRenderMetric } from '../store/ReaderUiState';
import { InteractionDebugBadge, InteractionDebugFrame } from './InteractionDebugComponents';

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
  ];

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
                        .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: item[2] as RouteId }))
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
                      .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))
                      InteractionDebugBadge({ label: 'P', tone: 'action' })
                    }
                    .width(34)
                    .height(52)
                    Text('第 32 章 雨夜')
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
                      InteractionDebugBadge({ label: 'N', tone: 'action' })
                    }
                    .width(34)
                    .height(52)
                  }
                  .height(52)
                  .alignItems(VerticalAlign.Center)

                  Row({ space: 6 }) {
                    Text('38%')
                      .fontSize(9)
                      .fontColor(ColorTokens.muted)
                      .fontWeight(700)
                    Stack({ alignContent: Alignment.TopStart }) {
                      Column()
                        .width('100%')
                        .height(5)
                        .borderRadius(DemoAliasTokens.radiusPill)
                        .backgroundColor(ColorTokens.border)
                        .margin({ top: 13 })
                      Column()
                        .width('38%')
                        .height(5)
                        .borderRadius(DemoAliasTokens.radiusPill)
                        .backgroundColor(ColorTokens.primary)
                        .margin({ top: 13 })
                      Column()
                        .width(12)
                        .height(12)
                        .border({ width: 3, color: ColorTokens.primary })
                        .borderRadius(DemoAliasTokens.radiusPill)
                        .backgroundColor(ColorTokens.floatingControlBg)
                        .shadow({ radius: 8, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 4 })
                        .margin({ left: '38%', top: 6 })
                        .translate({ x: -9 })
                      InteractionDebugBadge({ label: 'progress', tone: 'action' })
                    }
                    .layoutWeight(1)
                    .height(30)
                    Text('共 128 章')
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

            Stack({ alignContent: Alignment.TopStart }) {
              Column({ space: 10 }) {
                Image($r('app.media.reader_icon_sun_primary')).width(18).height(18)
                Stack({ alignContent: Alignment.Bottom }) {
                  Column()
                    .width(4)
                    .height('100%')
                    .borderRadius(DemoAliasTokens.radiusPill)
                    .backgroundColor(ColorTokens.border)
                  Column()
                    .width(4)
                    .height('42%')
                    .borderRadius(DemoAliasTokens.radiusPill)
                    .backgroundColor(ColorTokens.primary)
                }
                .width(4)
                .layoutWeight(1)
                Text('A')
                  .fontSize(12)
                  .fontWeight(800)
                  .fontColor(ColorTokens.primary)
              }
              .width(this.railWidth)
              .height('100%')
              .padding({ top: 12, bottom: 12 })
              .justifyContent(FlexAlign.Center)
              .alignItems(HorizontalAlign.Center)
              .backgroundColor(ColorTokens.floatingControlBg)
              .borderRadius(DemoAliasTokens.radiusLg)
              InteractionDebugBadge({ label: 'B', tone: 'action', offsetTop: 22 })
              InteractionDebugFrame({ label: 'BrightnessRail', tone: 'module' })
            }
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
          .backgroundColor(ColorTokens.paperBright)
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
              .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: it[2] as RouteId }))
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

            Stack({ alignContent: Alignment.TopStart }) {
              Column({ space: 10 }) {
                Image($r('app.media.reader_icon_sun_primary')).width(18).height(18)
                Stack({ alignContent: Alignment.Bottom }) {
                  Column()
                    .width(4)
                    .height('100%')
                    .borderRadius(DemoAliasTokens.radiusPill)
                    .backgroundColor(ColorTokens.border)
                  Column()
                    .width(4)
                    .height('42%')
                    .borderRadius(DemoAliasTokens.radiusPill)
                    .backgroundColor(ColorTokens.primary)
                }
                .width(4)
                .layoutWeight(1)
                Text('A')
                  .fontSize(12)
                  .fontWeight(800)
                  .fontColor(ColorTokens.primary)
              }
              .width(this.railWidth)
              .height('100%')
              .padding({ top: 12, bottom: 12 })
              .justifyContent(FlexAlign.Center)
              .alignItems(HorizontalAlign.Center)
              .backgroundColor(ColorTokens.floatingControlBg)
              .borderRadius(DemoAliasTokens.radiusLg)
              InteractionDebugFrame({ label: 'BrightnessRail', tone: 'module' })
            }
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
        .backgroundColor(ColorTokens.paperBright)
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
      .onClick(() => ReaderUiStore.dispatch({ type: 'route-replace', id: 'reader' as RouteId }))
      InteractionDebugBadge({ label: 'back', tone: 'action' })
    }
  }
}

@Component
struct ReaderQuickPillButton {
  @Prop label: string = '';
  @Prop disabled: boolean = false;

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
      .textAlign(TextAlign.Center)
  }
}

@Component
struct ReaderSearchResultRow {
  @Prop title: string = '';
  @Prop detail: string = '';

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
      .height(42)
      .padding({ left: 8, right: 8, top: 4, bottom: 4 })
      .justifyContent(FlexAlign.Center)
      .alignItems(HorizontalAlign.Start)
      .border({ width: { top: 1 }, color: ColorTokens.border })
      .onClick(() => ReaderUiStore.dispatch({ type: 'route-replace', id: 'immersive-reading' as RouteId }))
      InteractionDebugBadge({ label: 'result', tone: 'action' })
    }
    .width('100%')
    .height(42)
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

            Stack({ alignContent: Alignment.TopStart }) {
              Column({ space: 10 }) {
                Image($r('app.media.reader_icon_sun_primary')).width(18).height(18)
                Stack({ alignContent: Alignment.Bottom }) {
                  Column()
                    .width(4)
                    .height('100%')
                    .borderRadius(DemoAliasTokens.radiusPill)
                    .backgroundColor(ColorTokens.border)
                  Column()
                    .width(4)
                    .height('42%')
                    .borderRadius(DemoAliasTokens.radiusPill)
                    .backgroundColor(ColorTokens.primary)
                }
                .width(4)
                .layoutWeight(1)
                Text('A')
                  .fontSize(12)
                  .fontWeight(800)
                  .fontColor(ColorTokens.primary)
              }
              .width(this.railWidth)
              .height('100%')
              .padding({ top: 12, bottom: 12 })
              .justifyContent(FlexAlign.Center)
              .alignItems(HorizontalAlign.Center)
              .backgroundColor(ColorTokens.floatingControlBg)
              .borderRadius(DemoAliasTokens.radiusLg)
              InteractionDebugFrame({ label: 'BrightnessRail', tone: 'module' })
            }
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
        .backgroundColor(ColorTokens.paperBright)
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
  }
}

@Component
struct ReaderTocLiveRow {
  @Prop title: string = '';
  @Prop cached: boolean = false;
  @Prop bookmarked: boolean = false;
  @Prop current: boolean = false;

  @Builder
  private markerIcon(icon: Resource, active: boolean) {
    Stack({ alignContent: Alignment.Center }) {
      Image(icon)
        .width(14)
        .height(14)
        .opacity(active ? 1 : 0.28)
    }
    .width(24)
    .height(24)
    .borderRadius(DemoAliasTokens.radiusSm)
    .backgroundColor(active ? ColorTokens.floatingControlBgAlt : 'transparent')
  }

  build() {
    Row({ space: 4 }) {
      Text(this.title)
        .fontSize(11)
        .fontWeight(500)
        .fontColor(this.current ? ColorTokens.primaryDark : ColorTokens.controlInk)
        .layoutWeight(1)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
      Row({ space: 5 }) {
        this.markerIcon(this.cached ? $r('app.media.ui_icon_check_primary') : $r('app.media.ui_icon_download_dark'), this.cached)
        this.markerIcon($r('app.media.ui_icon_bookmark_primary'), this.bookmarked)
      }
      .width(58)
      .height(24)
    }
    .width('100%')
    .height(32)
    .padding({ left: 7, right: 7 })
    .border({ width: { top: 1 }, color: ColorTokens.border })
    .backgroundColor(this.current ? ColorTokens.surfaceSoft : 'transparent')
    .alignItems(VerticalAlign.Center)
    .onClick(() => ReaderUiStore.dispatch({ type: 'route-replace', id: 'immersive-reading' as RouteId }))
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
  private swatches: Array<[string, string]> = [
    ['纸纹', ColorTokens.paperBright],
    ['暖白', ColorTokens.paper],
    ['青绿', ColorTokens.floatingControlBgAlt],
    ['雾蓝', ColorTokens.surface],
  ];

  build() {
    Row({ space: 4 }) {
      ForEach(this.swatches, (item: [string, string], i: number) => {
        Column() {
          Column()
            .width(46)
            .height(18)
            .borderRadius(DemoAliasTokens.radiusSm)
            .backgroundColor(item[1])
            .border({ width: 1, color: ColorTokens.border })
        }
        .layoutWeight(1)
        .height(24)
        .padding({ left: 3, right: 3, top: 2, bottom: 2 })
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
        .borderRadius(DemoAliasTokens.radiusMd)
        .backgroundColor(i === 0 ? ColorTokens.surfaceSoft : ColorTokens.floatingControlBgAlt)
      }, (item: [string, string], i: number) => `${item[0]}-${i}`)
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

  build() {
    Row({ space: 9 }) {
      Image(this.icon)
        .width(18)
        .height(18)
        .margin({ left: 1, right: 1 })
      Text(this.title)
        .fontSize(11)
        .fontWeight(500)
        .fontColor(ColorTokens.controlInk)
        .layoutWeight(1)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
      if (this.switchRow) {
        ReaderCompactSwitch({ active: this.active })
      } else {
        Text(this.value)
          .fontSize(10)
          .fontWeight(500)
          .fontColor(ColorTokens.muted)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Image($r('app.media.ui_icon_chevron_dark')).width(13).height(13)
      }
    }
    .width('100%')
    .height(34)
    .padding({ left: 9, right: 9 })
    .border({ width: { top: 1 }, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
  }
}

// ── Directory panel (.fd-reader-toc-panel) ────────────────────────────────
@Component
export struct ReaderDirectoryPanel {
  private tocRows: Array<[string, boolean, boolean, boolean]> = [
    ['第 30 章 旧日', true, false, false],
    ['第 31 章 归途', true, true, false],
    ['第 32 章 雨夜', false, true, true],
    ['第 33 章 灯塔', false, false, false],
  ];

  build() {
    ReaderModulePanelShell({ debugLabel: 'ReaderModulePanel' }) {
      Column() {
        Row({ space: 4 }) {
          Text('目录')
            .fontSize(10).fontWeight(600).fontColor(DemoAliasTokens.onPrimary)
            .layoutWeight(1).height(30).textAlign(TextAlign.Center)
            .borderRadius(DemoAliasTokens.radiusMd).backgroundColor(ColorTokens.primaryDark)
          Text('书签')
            .fontSize(10).fontWeight(600).fontColor(ColorTokens.controlInk)
            .layoutWeight(1).height(30).textAlign(TextAlign.Center)
            .borderRadius(DemoAliasTokens.radiusMd).backgroundColor(ColorTokens.floatingControlBgAlt)
        }
        .width('100%')
        .height(36)
        .padding({ top: 3, bottom: 3 })
        .margin({ bottom: 5 })

        ForEach(this.tocRows, (row: [string, boolean, boolean, boolean], i: number) => {
          ReaderTocLiveRow({ title: row[0], cached: row[1], bookmarked: row[2], current: row[3] })
        }, (row: [string, boolean, boolean, boolean], i: number) => `${row[0]}-${i}`)
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
            ReaderQuickPillButton({ label: '停止朗读', disabled: true })
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
              Stack({ alignContent: Alignment.Center }) {
                Image($r('app.media.reader_icon_play_white')).width(13).height(13)
              }
              .width(34)
              .height(25)
              .borderRadius(DemoAliasTokens.radiusMd)
              .backgroundColor(ColorTokens.primaryDark)
              Stack({ alignContent: Alignment.Center }) {
                Image($r('app.media.reader_icon_chevron_chapter')).width(13).height(13)
              }
              .width(28)
              .height(25)
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

          ReaderLiveOptionRow({ icon: $r('app.media.ui_icon_motion_dark'), title: '语速', value: '1.0x' })
          ReaderLiveOptionRow({ icon: $r('app.media.ui_icon_volume_dark'), title: '音色', value: '清晰女声' })
          ReaderLiveOptionRow({ icon: $r('app.media.ui_icon_current_location_dark'), title: '范围', value: '当前章节' })
          ReaderLiveOptionRow({ icon: $r('app.media.ui_icon_clock_dark'), title: '定时', value: '15 分钟' })
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
  build() {
    ReaderModulePanelShell({ debugLabel: 'ReaderModulePanel' }) {
      Scroll() {
        Column() {
          ReaderLiveOptionRow({ icon: $r('app.media.ui_icon_refresh_dark'), title: '自动翻页', active: false, switchRow: true })
          ReaderLiveOptionRow({ icon: $r('app.media.ui_icon_gesture_dark'), title: '点击翻页方式', value: '左右区域' })
          ReaderLiveOptionRow({ icon: $r('app.media.ui_icon_volume_dark'), title: '音量键翻页', active: true, switchRow: true })
          ReaderLiveOptionRow({ icon: $r('app.media.ui_icon_file_dark'), title: '翻页动画', value: '平滑' })
          ReaderLiveOptionRow({ icon: $r('app.media.ui_icon_permission_dark'), title: '横屏锁定', active: false, switchRow: true })
          ReaderLiveOptionRow({ icon: $r('app.media.ui_icon_sun_dark'), title: '屏幕常亮', active: true, switchRow: true })
          ReaderLiveOptionRow({ icon: $r('app.media.ui_icon_progress_dark'), title: '页脚进度信息', active: true, switchRow: true })
          ReaderLiveOptionRow({ icon: $r('app.media.ui_icon_gesture_dark'), title: '触摸反馈', active: false, switchRow: true })
          ReaderLiveOptionRow({ icon: $r('app.media.ui_icon_download_dark'), title: '自动缓存后续章节', active: true, switchRow: true })
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
            .onClick(() => ReaderUiStore.dispatch({ type: 'route-replace', id: this.closeRoute() }))

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
              .onClick(() => ReaderUiStore.dispatch({ type: 'route-replace', id: this.closeRoute() }))
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

  build() {
    Row({ space: 6 }) {
      ForEach(this.values, (value: string, i: number) => {
        Text(value)
          .fontSize(10)
          .fontWeight(760)
          .fontColor(value === this.active ? DemoAliasTokens.onPrimary : ColorTokens.controlInk)
          .height(30)
          .layoutWeight(1)
          .borderRadius(DemoAliasTokens.radiusMd)
          .backgroundColor(value === this.active ? ColorTokens.primaryDark : ColorTokens.floatingControlBgAlt)
          .textAlign(TextAlign.Center)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }, (value: string, i: number) => `${value}-${i}`)
    }
    .width('100%')
  }
}

@Component
struct ReaderFullFontChoiceRow {
  @StorageProp('reader.typography.fontFamily') fontFamily: string = 'serif';
  private values: Array<[string, ReaderFontFamily]> = [
    ['系统', 'system'],
    ['宋体', 'serif'],
    ['黑体', 'sans'],
    ['楷体', 'kai'],
    ['仿宋', 'fangsong'],
    ['等宽', 'mono'],
  ];

  build() {
    Row({ space: 6 }) {
      ForEach(this.values, (item: [string, ReaderFontFamily], i: number) => {
        Text(item[0])
          .fontSize(10)
          .fontWeight(760)
          .fontColor(item[1] === this.fontFamily ? DemoAliasTokens.onPrimary : ColorTokens.controlInk)
          .height(30)
          .layoutWeight(1)
          .borderRadius(DemoAliasTokens.radiusMd)
          .backgroundColor(item[1] === this.fontFamily ? ColorTokens.primaryDark : ColorTokens.floatingControlBgAlt)
          .textAlign(TextAlign.Center)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .onClick(() => ReaderUiStore.dispatch({ type: 'set-reader-font-family', fontFamily: item[1] }))
      }, (item: [string, ReaderFontFamily], i: number) => `${item[1]}-${i}`)
    }
    .width('100%')
  }
}

@Component
struct ReaderFullThemeGrid {
  private swatches: Array<[string, string]> = [
    ['纸纹', ColorTokens.paperBright],
    ['暖白', ColorTokens.paper],
    ['浅灰', ColorTokens.surface],
    ['米色', ColorTokens.floatingControlBg],
    ['夜间', ColorTokens.paperNight],
    ['雾蓝', ColorTokens.floatingControlBgAltNight],
    ['墨黑', ColorTokens.controlInk],
    ['冷色', ColorTokens.primaryDark],
  ];

  build() {
    Column({ space: 7 }) {
      ForEach([0, 1], (row: number) => {
        Row({ space: 7 }) {
          ForEach(this.swatches.slice(row * 4, row * 4 + 4), (item: [string, string], i: number) => {
            Column({ space: 4 }) {
              Column()
                .width('100%')
                .height(30)
                .borderRadius(DemoAliasTokens.radiusMd)
                .backgroundColor(item[1])
                .border({ width: row === 0 && i === 0 ? 2 : 1, color: row === 0 && i === 0 ? ColorTokens.primary : ColorTokens.border })
              Text(item[0])
                .fontSize(9)
                .fontWeight(700)
                .fontColor(ColorTokens.muted)
                .maxLines(1)
            }
            .layoutWeight(1)
            .alignItems(HorizontalAlign.Center)
          }, (item: [string, string], i: number) => `${item[0]}-${row}-${i}`)
        }
        .width('100%')
      }, (row: number) => `${row}`)
    }
    .width('100%')
  }
}

@Component
struct ReaderFullStepperRow {
  @Prop label: string = '';
  @Prop value: string = '';
  @Prop metric: ReaderRenderMetric = 'fontSize';

  build() {
    Row() {
      Text(this.label)
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
        .fontColor(ColorTokens.controlInk)
        .layoutWeight(1)
      ReaderCompactSwitch({ active: this.active })
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
  @Prop title: string = '';
  @Prop markerA: string = '';
  @Prop markerB: string = '';
  @Prop current: boolean = false;

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
        if (this.markerA !== '') {
          Text(this.markerA)
            .fontSize(9)
            .fontWeight(760)
            .fontColor(ColorTokens.primaryDark)
            .height(22)
            .padding({ left: 7, right: 7 })
            .borderRadius(DemoAliasTokens.radiusSm)
            .backgroundColor(ColorTokens.floatingControlBgAlt)
            .textAlign(TextAlign.Center)
        }
        if (this.markerB !== '') {
          Text(this.markerB)
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
      .onClick(() => ReaderUiStore.dispatch({ type: 'route-replace', id: 'immersive-reading' as RouteId }))
      InteractionDebugBadge({ label: 'row', tone: 'action' })
    }
    .width('100%')
    .height(42)
  }
}

@Component
export struct ReaderFullDirectoryPage {
  private rows: Array<[string, string, string, boolean]> = [
    ['第 28 章 雨幕', '已缓存', '', false],
    ['第 29 章 来信', '', '', false],
    ['第 30 章 旧日', '已缓存', '', false],
    ['第 31 章 归途', '已缓存', '书签', false],
    ['第 32 章 雨夜', '书签', '', true],
    ['第 33 章 灯塔', '', '', false],
    ['第 34 章 远行', '', '', false],
    ['第 35 章 风声', '', '书签', false],
  ];

  build() {
    ReaderFullPanelShell({ title: '目录', quickRoute: 'toc-bookmarks', debugLabel: 'ReaderExpandedPanel' }) {
      Column() {
        Row({ space: 6 }) {
          Text('目录')
            .fontSize(12)
            .fontWeight(800)
            .fontColor(DemoAliasTokens.onPrimary)
            .layoutWeight(1)
            .height(32)
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(ColorTokens.primaryDark)
            .textAlign(TextAlign.Center)
          Text('书签')
            .fontSize(12)
            .fontWeight(800)
            .fontColor(ColorTokens.controlInk)
            .layoutWeight(1)
            .height(32)
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(ColorTokens.floatingControlBgAlt)
            .textAlign(TextAlign.Center)
        }
        .width('100%')
        .padding({ left: 10, right: 10, top: 10, bottom: 8 })

        ForEach(this.rows, (row: [string, string, string, boolean], i: number) => {
          ReaderFullTocRow({ title: row[0], markerA: row[1], markerB: row[2], current: row[3] })
        }, (row: [string, string, string, boolean], i: number) => `${row[0]}-${i}`)
      }
      .width('100%')
      .height('100%')
      .backgroundColor(DemoAliasTokens.surface)
    }
  }
}

@Component
export struct ReaderFullTtsPage {
  build() {
    ReaderFullPanelShell({ title: '朗读', quickRoute: 'tts', debugLabel: 'ReaderExpandedPanel' }) {
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
          Text('▶')
            .fontSize(18)
            .fontWeight(800)
            .fontColor(DemoAliasTokens.onPrimary)
            .width(52)
            .height(52)
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(ColorTokens.primaryDark)
            .textAlign(TextAlign.Center)
          Text('›')
            .fontSize(24)
            .fontWeight(800)
            .fontColor(ColorTokens.controlInk)
            .width(44)
            .height(44)
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(ColorTokens.floatingControlBgAlt)
            .textAlign(TextAlign.Center)
        }
        .width('100%')
        .height(64)
        .justifyContent(FlexAlign.Center)
        .alignItems(VerticalAlign.Center)

        ReaderFullBlock({ title: '语速', meta: '1.0x' }) {
          ReaderFullChoiceRow({ values: ['0.8x', '1.0x', '1.25x', '1.5x'], active: '1.0x' })
        }
        ReaderFullBlock({ title: '音色', meta: '清晰女声' }) {
          ReaderFullChoiceRow({ values: ['系统默认', '清晰女声', '沉稳男声'], active: '清晰女声' })
        }
        ReaderFullBlock({ title: '朗读范围', meta: '当前章节' }) {
          ReaderFullChoiceRow({ values: ['当前章节', '本书剩余', '循环朗读'], active: '当前章节' })
        }
        ReaderFullBlock({ title: '定时关闭', meta: '15 分钟' }) {
          ReaderFullChoiceRow({ values: ['不定时', '15 分钟', '30 分钟'], active: '15 分钟' })
        }
      }
      .width('100%')
      .height('100%')
      .padding(10)
    }
  }
}

@Component
export struct ReaderFullAppearancePage {
  @StorageProp('reader.typography.fontSize') fontSize: number = 18;
  @StorageProp('reader.typography.lineHeight') lineHeightRatio: number = 1.96;
  @StorageProp('reader.typography.paragraphGap') paragraphGap: number = 16;
  @StorageProp('reader.typography.letterSpacing') letterSpacing: number = 0;
  @StorageProp('reader.pageSpace.topMargin') topMargin: number = 72;
  @StorageProp('reader.pageSpace.sideMargin') sideMargin: number = 32;
  @StorageProp('reader.pageSpace.bottomMargin') bottomMargin: number = 48;
  @StorageProp('reader.pageSpace.paragraphIndent') paragraphIndent: number = 2;

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
          ReaderFullBlock({ title: '阅读主题' }) {
            ReaderFullThemeGrid()
          }
          ReaderFullBlock({ title: '文字排版' }) {
            Column({ space: 4 }) {
              ReaderFullStepperRow({ label: '字号', value: this.whole(this.fontSize), metric: 'fontSize' })
              ReaderFullStepperRow({ label: '行距', value: this.two(this.lineHeightRatio), metric: 'lineHeight' })
              ReaderFullStepperRow({ label: '段距', value: this.whole(this.paragraphGap), metric: 'paragraphGap' })
              ReaderFullStepperRow({ label: '字距', value: this.one(this.letterSpacing), metric: 'letterSpacing' })
              ReaderFullFontChoiceRow()
            }
            .width('100%')
          }
          ReaderFullBlock({ title: '页面空间', meta: '边距 / 缩进' }) {
            Column({ space: 4 }) {
              ReaderFullStepperRow({ label: '顶部边距', value: this.whole(this.topMargin), metric: 'topMargin' })
              ReaderFullStepperRow({ label: '左右边距', value: this.whole(this.sideMargin), metric: 'sideMargin' })
              ReaderFullStepperRow({ label: '下边距', value: this.whole(this.bottomMargin), metric: 'bottomMargin' })
              ReaderFullStepperRow({ label: '段首缩进', value: `${this.one(this.paragraphIndent)}em`, metric: 'paragraphIndent' })
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
  private toggles: Array<[string, string, boolean]> = [
    ['翻', '自动翻页', false],
    ['音', '音量键翻页', true],
    ['横', '横屏锁定', false],
    ['亮', '屏幕常亮', true],
    ['页', '页脚进度信息', true],
    ['触', '触摸反馈', false],
    ['缓', '自动缓存后续章节', true],
  ];

  build() {
    ReaderFullPanelShell({ title: '设置', quickRoute: 'reader-settings', debugLabel: 'ReaderExpandedPanel' }) {
      Column({ space: 10 }) {
        ReaderFullBlock({ title: '点击翻页方式', meta: '左右区域' }) {
          ReaderFullChoiceRow({ values: ['左右区域', '上下区域', '全屏点击'], active: '左右区域' })
        }
        ReaderFullBlock({ title: '翻页动画', meta: '平滑' }) {
          ReaderFullChoiceRow({ values: ['平滑', '覆盖', '无动画'], active: '平滑' })
        }
        ReaderFullBlock({ title: '阅读行为', meta: '开关项' }) {
          Column() {
            ForEach(this.toggles, (item: [string, string, boolean], i: number) => {
              ReaderFullToggleRow({ icon: item[0], title: item[1], active: item[2] })
            }, (item: [string, string, boolean], i: number) => `${item[1]}-${i}`)
          }
          .width('100%')
          .borderRadius(DemoAliasTokens.radiusMd)
          .backgroundColor(ColorTokens.surfaceSoft)
        }
      }
      .width('100%')
      .height('100%')
      .padding(10)
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
  }
}

@Component
struct ReaderCacheListRow {
  @Prop title: string = '';
  @Prop detail: string = '';
  @Prop cached: boolean = false;
  @Prop current: boolean = false;

  build() {
    Row({ space: 8 }) {
      Column({ space: 2 }) {
        Text(this.title)
          .fontSize(12)
          .fontWeight(this.current ? 820 : 700)
          .fontColor(this.current ? ColorTokens.primaryDark : ColorTokens.controlInk)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(this.detail)
          .fontSize(9)
          .fontColor(ColorTokens.muted)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)
      Text(this.cached ? '已缓存' : '缓存')
        .fontSize(9)
        .fontWeight(760)
        .fontColor(this.cached ? ColorTokens.primaryDark : DemoAliasTokens.onPrimary)
        .height(24)
        .padding({ left: 8, right: 8 })
        .borderRadius(DemoAliasTokens.radiusSm)
        .backgroundColor(this.cached ? ColorTokens.floatingControlBgAlt : ColorTokens.primaryDark)
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
  private cacheRows: Array<[string, string, boolean, boolean]> = [
    ['第 30 章 旧日', '已下载到本地', true, false],
    ['第 31 章 归途', '已下载到本地', true, false],
    ['第 32 章 雨夜', '当前章节', false, true],
    ['第 33 章 灯塔', '尚未缓存', false, false],
    ['第 34 章 远行', '尚未缓存', false, false],
    ['第 35 章 风声', '尚未缓存', false, false],
  ];

  build() {
    ReaderFullPanelShell({ title: '书籍缓存', quickRoute: 'reader', debugLabel: 'ReaderUtilityPage', utility: true }) {
      Scroll() {
        Column({ space: 10 }) {
          Row({ space: 8 }) {
            ReaderUtilitySummaryCard({ value: '32/128', label: '已缓存章节' })
            ReaderUtilitySummaryCard({ value: '128 MB', label: '当前书籍缓存' })
            ReaderUtilitySummaryCard({ value: '已开启', label: '自动缓存后续章节' })
          }
          .width('100%')

          ReaderFullBlock({ title: '缓存动作', meta: '只作用于当前书籍' }) {
            Column({ space: 8 }) {
              Row({ space: 8 }) {
                ReaderUtilityActionButton({ title: '缓存当前章节', detail: '第 32 章 雨夜' })
                ReaderUtilityActionButton({ title: '缓存后续章节', detail: '从当前章节继续 20 章' })
              }
              .width('100%')
              Row({ space: 8 }) {
                ReaderUtilityActionButton({ title: '更新缓存目录', detail: '刷新章节列表和缓存标记' })
                ReaderUtilityActionButton({ title: '清理本书缓存', detail: '保留阅读进度和书签', danger: true })
              }
              .width('100%')
            }
            .width('100%')
          }

          ReaderFullBlock({ title: '章节缓存', meta: '右侧固定显示缓存状态和操作' }) {
            Column() {
              ForEach(this.cacheRows, (row: [string, string, boolean, boolean], i: number) => {
                ReaderCacheListRow({ title: row[0], detail: row[1], cached: row[2], current: row[3] })
              }, (row: [string, string, boolean, boolean], i: number) => `${row[0]}-${i}`)
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
  private logs: Array<[string, string, string, string]> = [
    ['正文渲染', 'page-measure', '完成', '按容器高度切分分页'],
    ['章节缓存', 'cache-status', '可用', '前序章节已缓存'],
    ['换源窗口', 'source-switch', '完成', '候选书源按延迟升序排列'],
    ['控制层', 'overlay-state', '完成', '顶栏、快捷窗、亮度条同层结构'],
  ];

  build() {
    ReaderFullPanelShell({ title: '调试信息', quickRoute: 'reader', debugLabel: 'ReaderUtilityPage', utility: true }) {
      Scroll() {
        Column({ space: 10 }) {
          Row({ space: 8 }) {
            ReaderUtilitySummaryCard({ value: '1/8', label: '当前页' })
            ReaderUtilitySummaryCard({ value: '32/128', label: '当前章节' })
            ReaderUtilitySummaryCard({ value: '0', label: '当前错误' })
          }
          .width('100%')

          ReaderFullBlock({ title: '渲染状态', meta: '用于核对页面结构和正文渲染链路' }) {
            Column({ space: 8 }) {
              Row({ space: 8 }) {
                ReaderDebugMetric({ label: '当前路由', value: 'reader / immersive-reading' })
                ReaderDebugMetric({ label: '当前章节', value: '32/128 · 第 32 章 雨夜' })
              }
              .width('100%')
              Row({ space: 8 }) {
                ReaderDebugMetric({ label: '分页状态', value: '1/8 · 流式测量分页' })
                ReaderDebugMetric({ label: '正文排版', value: '字号 18 · 行距 1.96' })
              }
              .width('100%')
              Row({ space: 8 }) {
                ReaderDebugMetric({ label: '阅读主题', value: '纸纹 · default' })
                ReaderDebugMetric({ label: '书源', value: '优书网 · 128ms' })
              }
              .width('100%')
            }
            .width('100%')
          }

          ReaderFullBlock({ title: '调试日志', meta: '当前阅读链路关键节点' }) {
            Column() {
              ForEach(this.logs, (row: [string, string, string, string], i: number) => {
                ReaderDebugLogRow({ scope: row[0], code: row[1], state: row[2], message: row[3] })
              }, (row: [string, string, string, string], i: number) => `${row[0]}-${i}`)
            }
            .width('100%')
            .borderRadius(DemoAliasTokens.radiusMd)
            .backgroundColor(ColorTokens.surfaceSoft)
          }

          ReaderFullBlock({ title: '调试动作', meta: '不改变正文，只导出或刷新诊断信息' }) {
            Column({ space: 8 }) {
              Row({ space: 8 }) {
                ReaderUtilityActionButton({ title: '复制调试信息', detail: '复制路由、章节、分页和排版参数' })
                ReaderUtilityActionButton({ title: '导出阅读日志', detail: '生成当前书籍调试记录' })
              }
              .width('100%')
              Row({ space: 8 }) {
                ReaderUtilityActionButton({ title: '重新测量分页', detail: '刷新正文容器和分页结果' })
                ReaderUtilityActionButton({ title: '回到阅读控制层', detail: '完成调试查看' })
              }
              .width('100%')
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

// ── Search panel (.fd-reader-search-quick-panel) ──────────────────────────
//   Live demo quick panel: back/search toolbar + "雨夜" search field + result
//   list. No legacy header, no clear/apply action row.
@Component
export struct ReaderSearchPanel {
  private results: Array<[string, string]> = [
    ['第 32 章 雨夜', '雨夜的风格外冷 · 当前结果 1/2'],
    ['第 33 章 灯塔', '雨夜之后，远处灯塔亮起 · 结果 2/2'],
  ];

  build() {
    ReaderQuickPanelShell({ debugLabel: 'ReaderQuickPanel' }) {
      Column({ space: 5 }) {
        Row() {
          ReaderQuickBackButton()
          Blank()
          ReaderQuickPillButton({ label: '搜索' })
        }
        .width('100%')
        .height(24)
        .alignItems(VerticalAlign.Center)

        Row({ space: 6 }) {
          Image($r('app.media.ui_icon_search_primary')).width(13).height(13)
          Text('雨夜')
            .fontSize(11)
            .fontWeight(760)
            .fontColor(ColorTokens.controlInk)
            .layoutWeight(1)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        .width('100%')
        .height(32)
        .padding({ left: 8, right: 8 })
        .border({ width: 1, color: ColorTokens.border })
        .borderRadius(DemoAliasTokens.radiusMd)
        .backgroundColor(DemoAliasTokens.surface)
        .alignItems(VerticalAlign.Center)

        Column() {
          ForEach(this.results, (r: [string, string], i: number) => {
            ReaderSearchResultRow({ title: r[0], detail: r[1] })
          }, (r: [string, string], i: number) => `${r[0]}-${i}`)
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
//   Live demo quick panel: back toolbar + compact toggle list. No obsolete
//   current-book summary or apply/cancel/restore footer.
@Component
export struct ReaderReplacePanel {
  private rules: Array<[string, boolean]> = [
    ['雨容称呼', true],
    ['旧称统一', true],
    ['标点清理', false],
    ['广告过滤', true],
  ];

  build() {
    ReaderQuickPanelShell({ debugLabel: 'ReaderQuickPanel' }) {
      Column({ space: 5 }) {
        Row() {
          ReaderQuickBackButton()
          Blank()
        }
        .width('100%')
        .height(24)
        .alignItems(VerticalAlign.Center)

        Column() {
          ForEach(this.rules, (rule: [string, boolean], i: number) => {
            ReaderReplaceRuleRow({ title: rule[0], active: rule[1] })
          }, (rule: [string, boolean], i: number) => `${rule[0]}-${i}`)
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
  build() {
    ReaderQuickPanelShell({ debugLabel: 'ReaderQuickPanel' }) {
      Column({ space: 5 }) {
        Row() {
          ReaderQuickBackButton()
          Blank()
          ReaderQuickPillButton({ label: '停止自动翻页', disabled: true })
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
          .opacity(0.42)

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
            Text('8 秒').fontSize(15).fontWeight(780).fontColor(ColorTokens.controlInk)
              .width(46).textAlign(TextAlign.Center)
            Text('+').fontSize(18).fontWeight(800).fontColor(ColorTokens.controlInk)
              .width(24).height(24).textAlign(TextAlign.Center)
              .borderRadius(DemoAliasTokens.radiusPill).backgroundColor(ColorTokens.floatingControlBgAlt)
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
            .fontSize(12).fontWeight(760).fontColor(DemoAliasTokens.onPrimary)
            .layoutWeight(1).height(20).textAlign(TextAlign.Center)
            .borderRadius(DemoAliasTokens.radiusSm).backgroundColor(ColorTokens.primaryDark)
          Text('单页')
            .fontSize(12).fontWeight(760).fontColor(ColorTokens.controlInk)
            .layoutWeight(1).height(20).textAlign(TextAlign.Center)
            .borderRadius(DemoAliasTokens.radiusSm)
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
