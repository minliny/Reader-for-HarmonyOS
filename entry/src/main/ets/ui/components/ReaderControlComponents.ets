// ReaderControlComponents — control layer base primitives + control sheet.
// 对应 B 的 02a-reader-control.css (控制层基础).
// Split from ReaderOverlayComponents.ets; barrel re-exports kept for back-compat.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { SizeTokens, ZIndexTokens } from '../../contract/generated/DimensionTokens';
import { RouteId } from '../../contract/generated/RouteTable';
import { SafeAreaAdapter } from '../adapters/SafeAreaAdapter';
import { ViewportAdapter } from '../adapters/ViewportAdapter';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { ReaderFontFamily, ReaderRenderMetric } from '../store/ReaderUiState';
import { MotionAdapter } from '../adapters/MotionAdapter';
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
  @Prop actionType: string = '';
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;

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
          if (this.actionType.length > 0) {
            MotionAdapter.apply('button.activate', this.reducedMotion, () => {
              ReaderUiStore.dispatch({ type: this.actionType });
            });
          } else if (this.dismiss) {
            ReaderUiStore.dispatch({ type: 'route-pop' });
          }
        })
      InteractionDebugBadge({ label: 'button', tone: 'action' })
    }
  }
}

// ── Slider (.reader-slider) ───────────────────────────────────────────────
//   height 24, 4px track (muted), fill % + 16px thumb (primary). Batch 2:
//   PanGesture-driven; dispatches to ReaderUiStore based on sliderId. The
//   track width is captured via onAreaChange so PanGesture offsets (relative
//   to gesture start) can be mapped to a value delta.
@Component
export struct ReaderSlider {
  @Prop sliderId: string = '';
  @Prop currentValue: number = 0;
  @Prop minValue: number = 0;
  @Prop maxValue: number = 100;
  @State dragValue: number = 0;
  @State isDragging: boolean = false;
  @State trackWidth: number = 200;
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;
  onSeek: ((value: number) => void) | undefined = undefined;
  private startValue: number = 0;

  aboutToAppear() {
    this.dragValue = this.currentValue;
  }

  build() {
    Stack({ alignContent: Alignment.Start }) {
      // track
      Column().width('100%').height(4).borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.border)
      // fill
      Column().width(this.fillPercentage() + '%').height(4).borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.primary)
      // thumb
      Column().width(16).height(16).borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.primary)
        .border({ width: 2, color: ColorTokens.floatingControlBg })
        .margin({ left: this.fillPercentage() + '%' })
    }
    .width('100%')
    .height(24)
    .alignContent(Alignment.Start)
    .onAreaChange((_oldValue: Area, newValue: Area) => {
      const w = newValue.width;
      // Area.width is typed as Length (number | string | Resource) but is
      // always a number at runtime (in vp). Fall back to default for type safety.
      this.trackWidth = typeof w === 'number' ? w : 200;
    })
    .gesture(
      PanGesture()
        .onActionStart((e: GestureEvent) => {
          this.isDragging = true;
          this.startValue = this.currentValue;
          MotionAdapter.apply('slider.drag.start', this.reducedMotion, () => {});
        })
        .onActionUpdate((e: GestureEvent) => {
          const v = this.computeValueFromOffset(e.offsetX);
          this.dragValue = v;
          if (this.onSeek !== undefined) {
            this.onSeek(v);
          }
        })
        .onActionEnd((e: GestureEvent) => {
          const v = this.computeValueFromOffset(e.offsetX);
          this.dragValue = v;
          this.isDragging = false;
          MotionAdapter.apply('slider.drag.release', this.reducedMotion, () => {
            this.dispatchSeek(v);
          });
        })
    )
  }

  private fillPercentage(): number {
    const v = this.isDragging ? this.dragValue : this.currentValue;
    const range = this.maxValue - this.minValue;
    if (range <= 0) return 0;
    return Math.min(100, Math.max(0, ((v - this.minValue) / range) * 100));
  }

  private computeValueFromOffset(x: number): number {
    const range = this.maxValue - this.minValue;
    if (range <= 0 || this.trackWidth <= 0) return this.startValue;
    const delta = (x / this.trackWidth) * range;
    return Math.min(this.maxValue, Math.max(this.minValue, this.startValue + delta));
  }

  private dispatchSeek(v: number) {
    switch (this.sliderId) {
      case 'font-size':
        ReaderUiStore.dispatch({ type: 'set-reader-render-metric', readerMetric: 'fontSize', value: v });
        break;
      case 'line-height':
        ReaderUiStore.dispatch({ type: 'set-reader-render-metric', readerMetric: 'lineHeight', value: v });
        break;
      case 'brightness':
        ReaderUiStore.dispatch({ type: 'set-brightness', value: v });
        break;
      case 'chapter-progress':
        ReaderUiStore.dispatch({ type: 'chapter-progress-seek', value: v });
        break;
      default:
        if (this.onSeek !== undefined) {
          this.onSeek(v);
        }
        break;
    }
  }
}

// ── Segmented control (.reader-segmented) ─────────────────────────────────
//   grid auto 1fr, gap 6. segment min-height 34, radius pill, 12/600. active:
//   primary bg + on-primary. Local @State active (D13).
@Component
export struct SegmentedControl {
  @Prop options: string[] = [];
  @Prop @Watch('onActiveIndexChange') activeIndex: number = 0;
  @State active: number = 0;
  onSegmentChange: ((index: number) => void) | undefined = undefined;
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;

  aboutToAppear() {
    this.active = this.activeIndex;
  }

  onActiveIndexChange(): void {
    this.active = this.activeIndex;
  }

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
            .onClick(() => {
              this.active = i;
              MotionAdapter.apply('segment.item.switch', this.reducedMotion, () => {
                if (this.onSegmentChange !== undefined) {
                  this.onSegmentChange!(i);
                }
              });
            })
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
//   primary bg + knob offset 18. Batch 1.6: optional onToggleChange callback
//   + @Watch sync so external state changes propagate to the local @State.
@Component
export struct ToggleSwitch {
  @Prop @Watch('onInitialChange') initialOn: boolean = false;
  @State on: boolean = false;
  onToggleChange: ((on: boolean) => void) | undefined = undefined;
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;

  aboutToAppear() {
    this.on = this.initialOn;
  }

  onInitialChange(): void {
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
    .onClick(() => {
      this.on = !this.on;
      if (this.onToggleChange !== undefined) {
        MotionAdapter.apply('toggle.switch', this.reducedMotion, () => {
          this.onToggleChange!(this.on);
        });
      }
    })
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
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;

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
                        .constraintSize({ minHeight: 50 })
                        .justifyContent(FlexAlign.Center)
                        .alignItems(HorizontalAlign.Center)
                        .backgroundColor(ColorTokens.surfaceSoft)
                        .borderRadius(DemoAliasTokens.radiusLg)
                        .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: item[2] as RouteId }))
                        InteractionDebugBadge({ label: this.quickDebugLabel(item[2]), tone: 'action', offsetTop: 22 })
                      }
                      .layoutWeight(1)
                      .constraintSize({ minHeight: 50 })
                    }, (item: [string, string, string]) => item[2])
                  }
                  .height(this.quickHeight)
                  .padding({ left: 8, right: 8, top: 9, bottom: 9 })
                  .border({ width: 1, color: ColorTokens.border })
                  .borderRadius(DemoAliasTokens.radiusLg)
                  .backgroundColor(ColorTokens.surfaceSoft)
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
                      .onClick(() => {
                        MotionAdapter.apply('reader.chapter.jump', this.reducedMotion, () => {
                          ReaderUiStore.dispatch({ type: 'chapter-prev' });
                        });
                      })
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
                      .onClick(() => {
                        MotionAdapter.apply('reader.chapter.jump', this.reducedMotion, () => {
                          ReaderUiStore.dispatch({ type: 'chapter-next' });
                        });
                      })
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
                        .backgroundColor(ColorTokens.accent)
                        .margin({ top: 13 })
                      Column()
                        .width(12)
                        .height(12)
                        .border({ width: 3, color: ColorTokens.accent })
                        .borderRadius(DemoAliasTokens.radiusPill)
                        .backgroundColor(ColorTokens.surfaceSoft)
                        .shadow({ radius: 8, color: ColorTokens.accent, offsetX: 0, offsetY: 4 })
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
                  .backgroundColor(ColorTokens.surfaceSoft)
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
                    .backgroundColor(ColorTokens.accent)
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
              .backgroundColor(ColorTokens.surfaceSoft)
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
          .backgroundColor(DemoAliasTokens.surface)
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

// ── Module sheet shell (.fd-reader-module-panel) ─────────────────────────
// Live reader modules are not old standalone overlay cards. They render inside
// the same sheet frame as the control layer, keep the right brightness rail,
// and reserve the lower 110vp for module navigation.
@Component
export struct ReaderModulePanelShell {
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
                    .backgroundColor(ColorTokens.accent)
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
              .backgroundColor(ColorTokens.surfaceSoft)
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
        .backgroundColor(DemoAliasTokens.surface)
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
export struct ReaderCompactSwitch {
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
export struct ReaderLiveStepperRow {
  @Prop label: string = '';
  @Prop value: string = '';
  @Prop metric: ReaderRenderMetric = 'fontSize';
  @Prop divider: boolean = false;
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;

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
          .onClick(() => {
            MotionAdapter.apply('stepper.press', this.reducedMotion, () => {
              ReaderUiStore.dispatch({ type: 'step-reader-render-metric', readerMetric: this.metric, delta: -1 });
            });
          })
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
          .onClick(() => {
            MotionAdapter.apply('stepper.press', this.reducedMotion, () => {
              ReaderUiStore.dispatch({ type: 'step-reader-render-metric', readerMetric: this.metric, delta: 1 });
            });
          })
      }
    }
    .width('100%')
    .height(27)
    .border({ width: { top: this.divider ? 1 : 0 }, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
  }
}

@Component
export struct ReaderFontChoices {
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
export struct ReaderThemeSwatches {
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
export struct ReaderLiveOptionRow {
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
