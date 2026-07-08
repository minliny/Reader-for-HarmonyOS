// ReaderOverlayComponents — shared reader overlay families + control bottom bar.
// Ported from docs/ui-handoff/normalized-html/*-overlay-v2.html (Batch 1 structure
// source) + reader-control-layer.css / reader-components.css / reader-design-tokens.css.
//
// Route-driven (Batch 1): render as body components of *-overlay-v2 view-state
// entries via ViewStateRenderer(stack). Colors flow through ColorTokens /
// DemoAliasTokens; sizes are bare vp (lint_tokens only forbids hex / px-unit
// strings — bare vp is allowed, same convention as ReaderComponents base structs).
//
// Slice scope (Step 2): the content families — panel header, setting/list rows,
// button row, slider, segmented, toggle. The ReaderOverlayPanel shell + floating
// controls (brightness / quick-actions / page-control) + night toast land with
// the routes that use them (Step 3).
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { SizeTokens } from '../../contract/generated/DimensionTokens';
import { RouteId } from '../../contract/generated/RouteTable';
import { SafeAreaAdapter } from '../adapters/SafeAreaAdapter';
import { ReaderUiStore } from '../store/ReaderUiStore';

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
        Text(opt)
          .fontSize(12).fontWeight(600)
          .fontColor(i === this.active ? DemoAliasTokens.onPrimary : ColorTokens.controlInk)
          .backgroundColor(i === this.active ? ColorTokens.primary : ColorTokens.floatingControlBgAlt)
          .border({ width: 1, color: i === this.active ? ColorTokens.primary : ColorTokens.border })
          .borderRadius(DemoAliasTokens.radiusPill)
          .height(34)
          .layoutWeight(1)
          .margin({ right: 6 })
          .textAlign(TextAlign.Center)
          .onClick(() => { this.active = i; })
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

  build() {
    Stack({ alignContent: this.on ? Alignment.End : Alignment.Start }) {
      Column()
        .width(20).height(20).borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(DemoAliasTokens.onPrimary)
        .margin({ left: 2, right: 2 })
    }
    .width(42)
    .height(24)
    .borderRadius(DemoAliasTokens.radiusPill)
    .backgroundColor(this.on ? ColorTokens.primary : ColorTokens.border)
    .onClick(() => { this.on = !this.on; })
  }
}

// ── Control sheet (.fd-reader-sheet + .fd-reader-control-main) ────────────
//   Demo truth for control-layer-base-v2 is one bottom sheet: grabber, 3 quick
//   action buttons, chapter row, progress row, and a brightness rail. It is not
//   three detached floating controls.
@Component
export struct ReaderControlSheet {
  @StorageProp(SafeAreaAdapter.K_BOTTOM) safeAreaBottom: number = SafeAreaAdapter.DEFAULT_BOTTOM;

  private readonly dockMaxWidth: number = 365;
  private readonly dockRight: number = 12;
  private readonly sheetHeight: number = 330;
  private readonly controlTop: number = 28;
  private readonly moduleReserve: number = 111;
  private readonly sheetPaddingX: number = 12;
  private readonly railWidth: number = 38;
  private readonly railGap: number = 14;
  private readonly quickHeight: number = 76;

  private quickActions: Array<[string, string, string]> = [
    ['搜索', 'reader_icon_reader_content_search_action', 'reader-search-overlay-v2'],
    ['自动翻页', 'reader_icon_reader_auto_page_action', 'reader-auto-scroll-overlay-v2'],
    ['替换', 'reader_icon_reader_content_replace_action', 'reader-replace-overlay-v2'],
  ];

  private sheetBottom(): number {
    return this.safeAreaBottom + 32;
  }

  private controlHeight(): number {
    return this.sheetHeight - this.controlTop - this.moduleReserve;
  }

  private chapterHeight(): number {
    return this.controlHeight() - this.quickHeight - 6;
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

          Row({ space: 14 }) {
            Column({ space: 6 }) {
              Row({ space: 8 }) {
                ForEach(this.quickActions, (item: [string, string, string]) => {
                  Column({ space: 6 }) {
                    Image($r(`app.media.${item[1]}`)).width(22).height(22)
                    Text(item[0])
                      .fontSize(11)
                      .fontWeight(800)
                      .fontColor(ColorTokens.controlInk)
                      .maxLines(1)
                      .textOverflow({ overflow: TextOverflow.Ellipsis })
                  }
                  .layoutWeight(1)
                  .height(70)
                  .justifyContent(FlexAlign.Center)
                  .alignItems(HorizontalAlign.Center)
                  .backgroundColor(ColorTokens.surfaceSoft)
                  .borderRadius(DemoAliasTokens.radiusLg)
                  .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: item[2] as RouteId }))
                }, (item: [string, string, string]) => item[2])
              }
              .height(this.quickHeight)
              .padding({ left: 8, right: 8, top: 9, bottom: 9 })
              .border({ width: 1, color: ColorTokens.border })
              .borderRadius(DemoAliasTokens.radiusLg)
              .backgroundColor(ColorTokens.floatingControlBg)

              Column({ space: 8 }) {
                Row() {
                  Image($r('app.media.reader_icon_chevron_left_chapter'))
                    .width(24)
                    .height(24)
                    .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))
                  Text('第 32 章 雨夜')
                    .fontSize(13)
                    .fontWeight(750)
                    .fontColor(ColorTokens.controlInk)
                    .textAlign(TextAlign.Center)
                    .layoutWeight(1)
                    .maxLines(2)
                    .textOverflow({ overflow: TextOverflow.Ellipsis })
                  Image($r('app.media.reader_icon_chevron_chapter')).width(24).height(24)
                }
                .height(52)
                .alignItems(VerticalAlign.Center)

                Row({ space: 6 }) {
                  Text('38%')
                    .fontSize(9)
                    .fontColor(ColorTokens.muted)
                    .fontWeight(700)
                  Stack({ alignContent: Alignment.Start }) {
                    Column()
                      .width('100%')
                      .height(5)
                      .borderRadius(DemoAliasTokens.radiusPill)
                      .backgroundColor(ColorTokens.border)
                    Column()
                      .width('38%')
                      .height(5)
                      .borderRadius(DemoAliasTokens.radiusPill)
                      .backgroundColor(ColorTokens.primary)
                  }
                  .layoutWeight(1)
                  .height(22)
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
            .layoutWeight(1)
            .height('100%')

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
          }
          .width('100%')
          .height(this.controlHeight())
          .padding({ left: this.sheetPaddingX, right: this.sheetPaddingX })
          .margin({ top: this.controlTop })
        }
        .width('100%')
        .height(this.sheetHeight)
        .clip(true)
        .border({ width: 1, color: ColorTokens.border })
        .borderRadius(22)
        .backgroundColor(ColorTokens.paperBright)
        .shadow({ radius: 8, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 2 })
      }
      .width('94%')
      .constraintSize({ maxWidth: this.dockMaxWidth })
      .margin({ right: this.dockRight, bottom: this.sheetBottom() })
    }
    .width('100%')
    .height('100%')
  }
}

// Legacy contract compatibility. Older generated tables used
// FloatingQuickActions for the control route; render the real control sheet
// there, and keep the old quick row for any stale non-control references.
@Component
export struct FloatingQuickActions {
  @StorageProp('reader.displayedRouteId') routeId: string = 'control-layer-base-v2';

  private items(): Array<[string, string, string]> {
    const nightState = this.routeId === 'reader-night-state-v2';
    return [
      ['search', 'reader_icon_reader_content_search_action', 'reader-search-overlay-v2'],
      ['auto', 'reader_icon_reader_auto_page_action', 'reader-auto-scroll-overlay-v2'],
      ['replace', 'reader_icon_reader_content_replace_action', 'reader-replace-overlay-v2'],
      ['night', nightState ? 'reader_icon_sun_primary' : 'reader_icon_moon_primary',
        nightState ? 'control-layer-base-v2' : 'reader-night-state-v2'],
    ];
  }

  build() {
    if (this.routeId === 'control-layer-base-v2') {
      ReaderControlSheet()
    } else {
      Stack({ alignContent: Alignment.Bottom }) {
        Row({ space: 20 }) {
          ForEach(this.items(), (it: [string, string, string]) => {
            Column() {
              Image($r(`app.media.${it[1]}`)).width(24).height(24)
            }
            .width(48).height(48)
            .justifyContent(FlexAlign.Center).alignItems(HorizontalAlign.Center)
            .backgroundColor(ColorTokens.floatingControlBg)
            .border({ width: 1, color: ColorTokens.border })
            .borderRadius(DemoAliasTokens.radiusPill)
            .shadow({ radius: 8, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 2 })
            .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: it[2] as RouteId }))
          }, (it: [string, string, string]) => it[0])
        }
        .margin({ bottom: SizeTokens.readerModuleNavHeight + 116 })
      }
      .width('100%')
      .height('100%')
    }
  }
}

// ── Floating page control (.reader-floating-page-control) ─────────────────
//   Pill (prev + progress track + next), centered, floating just above the
//   bottom bar. Progress is a 4px track with a 25% fill + 16px thumb.
@Component
export struct FloatingPageControl {
  @StorageProp('reader.displayedRouteId') routeId: string = 'control-layer-base-v2';

  build() {
    if (this.routeId !== 'control-layer-base-v2') {
      Stack({ alignContent: Alignment.Bottom }) {
        Row() {
          Image($r('app.media.reader_icon_chevron_left_chapter')).width(24).height(24)
            .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))
          Stack({ alignContent: Alignment.Start }) {
            Column().width('100%').height(4).borderRadius(DemoAliasTokens.radiusPill)
              .backgroundColor(ColorTokens.border)
            Column().width('25%').height(4).borderRadius(DemoAliasTokens.radiusPill)
              .backgroundColor(ColorTokens.primary)
          }
          .layoutWeight(1).height(4).margin({ left: 16, right: 16 })
          Image($r('app.media.reader_icon_chevron_chapter')).width(24).height(24)
        }
        .width(342).height(52).padding({ left: 24, right: 24 })
        .justifyContent(FlexAlign.Center).alignItems(VerticalAlign.Center)
        .backgroundColor(ColorTokens.floatingControlBg)
        .border({ width: 1, color: ColorTokens.border })
        .borderRadius(DemoAliasTokens.radiusPill)
        .shadow({ radius: 8, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 2 })
        .margin({ bottom: SizeTokens.readerModuleNavHeight + 54 })
      }
      .width('100%')
      .height('100%')
    }
  }
}

// ── Module nav (.fd-reader-module-nav) ────────────────────────────────────
@Component
export struct ReaderBottomBar {
  @StorageProp(SafeAreaAdapter.K_BOTTOM) safeAreaBottom: number = SafeAreaAdapter.DEFAULT_BOTTOM;
  @StorageProp('reader.displayedRouteId') routeId: string = 'control-layer-base-v2';

  private readonly dockMaxWidth: number = 340;
  private readonly dockRight: number = 24;

  private items: Array<[string, string, string]> = [
    ['directory', '目录', 'reader-directory-overlay-v2'],
    ['tts', '朗读', 'reader-tts-overlay-v2'],
    ['appearance', '界面', 'reader-appearance-overlay-v2'],
    ['settings', '设置', 'reader-settings-overlay-v2'],
  ];

  private moduleIcon(kind: string): Resource {
    switch (kind) {
      case 'directory':
        return $r('app.media.reader_icon_reader_module_directory_primary');
      case 'appearance':
        return $r('app.media.reader_icon_reader_module_appearance_primary');
      case 'tts':
        return $r('app.media.reader_icon_reader_module_tts_primary');
      case 'settings':
        return $r('app.media.reader_icon_reader_module_settings_primary');
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

  build() {
    Stack({ alignContent: Alignment.BottomEnd }) {
      Column() {
        Row({ space: 4 }) {
          ForEach(this.items, (it: [string, string, string]) => {
            Column({ space: 4 }) {
              Column() {
                Image(this.moduleIcon(it[0])).width(26).height(26)
              }
              .width(42)
              .height(42)
              .justifyContent(FlexAlign.Center)
              .alignItems(HorizontalAlign.Center)
              .backgroundColor(this.active(it[0]) ? ColorTokens.primaryDark : ColorTokens.floatingControlBgAlt)
              .borderRadius(DemoAliasTokens.radiusPill)
              Text(it[1])
                .fontSize(12)
                .fontWeight(800)
                .fontColor(this.active(it[0]) ? ColorTokens.primaryDark : ColorTokens.controlInk)
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis })
            }
            .layoutWeight(1)
            .height('100%')
            .justifyContent(FlexAlign.Center)
            .alignItems(HorizontalAlign.Center)
            .borderRadius(DemoAliasTokens.radiusLg)
            .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: it[2] as RouteId }))
          }, (it: [string, string, string]) => it[2])
        }
        .width('100%')
        .height(SizeTokens.readerModuleNavHeight)
        .padding({ left: 8, right: 8, top: 8, bottom: 8 })
        .backgroundColor(ColorTokens.paperBright)
        .border({ width: 1, color: ColorTokens.border })
        .borderRadius(DemoAliasTokens.radiusLg)
      }
      .width('90%')
      .constraintSize({ maxWidth: this.dockMaxWidth })
      .margin({ right: this.dockRight, bottom: this.safeAreaBottom + 32 })
    }
    .width('100%')
    .height('100%')
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
  @Prop panelHeight: number = 420;
  @BuilderParam content: () => void;

  build() {
    Stack({ alignContent: Alignment.Bottom }) {
      Column({ space: 14 }) {
        this.content()
      }
      .width('100%')
      .height(this.panelHeight)
      .padding(16)
      .backgroundColor(ColorTokens.floatingControlBg)
      .border({ width: 1, color: ColorTokens.border })
      .borderRadius(22)
      .shadow({ radius: 8, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 2 })
      .margin({ bottom: this.safeAreaBottom + 32 + SizeTokens.readerModuleNavHeight - 1 })
    }
    .width('100%')
    .height('100%')
  }
}

// ── Directory panel (.reader-toc-bookmark-overlay panel) ──────────────────
//   Uses the shared families: SegmentedControl (目录/书签) + ReaderListRow
//   chapter list. Self-contained chrome (reader-overlay-panel) inlined; the
//   shared ReaderOverlayPanel shell lands once @BuilderParam is validated.
//   Picking a chapter route-pops back to control-layer-base-v2.
@Component
export struct ReaderDirectoryPanel {
  private tocRows: Array<[string, string]> = [
    ['第一章：阿长与《山海经》', ''],
    ['深空信号', '当前阅读 · 书签'],
    ['第二节：寂静航线', ''],
    ['未知频段', ''],
    ['求救信号', '书签'],
    ['书签：深空信号', '那声音起初像是冰层断裂的脆响 · 25%'],
  ];

  build() {
    ReaderOverlayPanel({ panelHeight: 420 }) {
      SegmentedControl({ options: ['目录', '书签'] })
      Text('第一本 / 第一卷 /')
        .fontSize(12).fontColor(ColorTokens.muted)
        .width('100%')
      Scroll() {
        Column({ space: 8 }) {
          ForEach(this.tocRows, (row: [string, string], i: number) => {
            ReaderListRow({ title: row[0], detail: row[1] })
              .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))
          }, (row: [string, string], i: number) => `${row[0]}-${i}`)
        }
      }
      .layoutWeight(1)
      .align(Alignment.Top)
      Text('当前阅读章节：第一章：阿长与《山海经》')
        .fontSize(12).fontColor(ColorTokens.muted)
        .width('100%')
    }
  }
}

// ── Appearance panel (.reader-appearance-overlay) ──────────────────────────
//   3 groups (文字 / 段落 / 界面), each: group-title + setting-items (value |
//   disclosure). Ported from reader-appearance-overlay-v2.html.
@Component
export struct ReaderAppearancePanel {
  build() {
    ReaderOverlayPanel({ panelHeight: 480 }) {
      // group: 文字
      Column({ space: 8 }) {
        Text('文字').fontSize(13).fontWeight(700).fontColor(ColorTokens.controlInk)
        ReaderSettingRow({ name: '字体', value: '默认' })
        ReaderSettingRow({ name: '字号', value: '18' })
        ReaderSettingRow({ name: '字距', value: '标准' })
        ReaderSettingRow({ name: '繁简', value: '简体' })
      }.alignItems(HorizontalAlign.Start).width('100%')
      // group: 段落
      Column({ space: 8 }) {
        Text('段落').fontSize(13).fontWeight(700).fontColor(ColorTokens.controlInk)
        ReaderSettingRow({ name: '缩进', value: '2 字符' })
        ReaderSettingRow({ name: '行距', value: '标准' })
        ReaderSettingRow({ name: '段距', value: '标准' })
      }.alignItems(HorizontalAlign.Start).width('100%')
      // group: 界面
      Column({ space: 8 }) {
        Text('界面').fontSize(13).fontWeight(700).fontColor(ColorTokens.controlInk)
        ReaderSettingRow({ name: '信息', value: '四角信息' })
        ReaderSettingRow({ name: '翻页动画', value: '覆盖' })
        ReaderSettingRow({ name: '主题', value: '米色纸张' })
      }.alignItems(HorizontalAlign.Start).width('100%')
    }
  }
}

// ── TTS panel (.reader-tts-overlay) ────────────────────────────────────────
//   panel-header (朗读 / 正在朗读) + main control (暂停/停止) + progress
//   slider + voice param rows. Ported from reader-tts-overlay-v2.html.
@Component
export struct ReaderTtsPanel {
  build() {
    ReaderOverlayPanel({ panelHeight: 460 }) {
      ReaderPanelHeader({ title: '朗读', meta: '正在朗读' })
      Text('当前章节：第一章：阿长与《山海经》')
        .fontSize(12).fontColor(ColorTokens.muted)
        .width('100%')
      // 主播放控制
      Column({ space: 8 }) {
        Text('主播放控制').fontSize(13).fontWeight(700).fontColor(ColorTokens.controlInk)
        Row() {
          ReaderActionButton({ label: '暂停', primary: true })
          ReaderActionButton({ label: '停止', dismiss: true })
        }.width('100%')
      }.alignItems(HorizontalAlign.Start).width('100%')
      // progress
      Column({ space: 6 }) {
        Row() {
          Text('00:38').fontSize(12).fontColor(ColorTokens.muted).layoutWeight(1)
          Text('08:12').fontSize(12).fontColor(ColorTokens.muted)
        }.width('100%')
        ReaderSlider()
      }.alignItems(HorizontalAlign.Start).width('100%')
      // 朗读参数
      Column({ space: 8 }) {
        Text('朗读参数').fontSize(13).fontWeight(700).fontColor(ColorTokens.controlInk)
        ReaderListRow({ title: '语速' })
        ReaderSlider()
        ReaderListRow({ title: '音量' })
        ReaderSlider()
        ReaderSettingRow({ name: '定时关闭', value: '不开启', disclosure: true })
        ReaderSettingRow({ name: '朗读音色', value: '温和女声', disclosure: true })
      }.alignItems(HorizontalAlign.Start).width('100%')
    }
  }
}

// ── Settings panel (.reader-settings-overlay) ──────────────────────────────
//   panel-header (设置 / 阅读行为) + setting-list: value rows + switch rows.
//   Ported from reader-settings-overlay-v2.html.
@Component
export struct ReaderSettingsPanel {
  build() {
    ReaderOverlayPanel({ panelHeight: 480 }) {
      ReaderPanelHeader({ title: '设置', meta: '阅读行为' })
      Column({ space: 8 }) {
        ReaderSettingRow({ name: '屏幕方向', value: '竖屏', disclosure: true })
        ReaderSettingRow({ name: '屏幕超时', value: '5 分钟', disclosure: true })
        ReaderSettingRow({ name: '单双页', value: '单页', disclosure: true })
        ReaderSettingRow({ name: '进度条行为', value: '拖动', disclosure: true })
        ReaderSettingRow({ name: '隐藏状态栏', toggle: true })
        ReaderSettingRow({ name: '文字两端对齐', toggle: true })
        ReaderSettingRow({ name: '文字底部对齐', toggle: true })
        ReaderSettingRow({ name: '音量键翻页', toggle: true })
        ReaderSettingRow({ name: '单手翻页', toggle: true })
      }.width('100%')
    }
  }
}

// ── Search panel (.reader-search-overlay, quick-action variant) ────────────
//   header (搜索 / 共 N 处结果) + field + 清除 + result list + nav buttons.
//   Ported from reader-search-overlay-v2.html.
@Component
export struct ReaderSearchPanel {
  private results: Array<[string, string]> = [
    ['未知频段的跳动波形', '盯着那个代表未知频段的跳动'],
    ['不是随机的脉冲星信号', '“这不是随机的脉冲星信号，”领航员索菲亚说'],
    ['求救信号', '“求救信号。”艾伦打断了她'],
  ];

  build() {
    ReaderOverlayPanel({ panelHeight: 420 }) {
      ReaderPanelHeader({ title: '搜索', meta: '共 3 处结果' })
      Row() {
        TextInput({ placeholder: '搜索内容' })
          .layoutWeight(1)
          .height(42)
          .fontSize(14)
          .fontColor(ColorTokens.ink)
          .backgroundColor(ColorTokens.floatingControlBgAlt)
          .borderRadius(DemoAliasTokens.radiusLg)
          .border({ width: 1, color: ColorTokens.border })
        ReaderActionButton({ label: '清除' })
      }.width('100%')
      Scroll() {
        Column({ space: 8 }) {
          ForEach(this.results, (r: [string, string], i: number) => {
            ReaderListRow({ title: r[0], detail: r[1] })
          }, (r: [string, string], i: number) => `${r[0]}-${i}`)
        }
      }.layoutWeight(1).align(Alignment.Top)
      Row() {
        ReaderActionButton({ label: '上一个结果' })
        ReaderActionButton({ label: '下一个结果', primary: true })
      }.width('100%')
    }
  }
}

// ── Replace panel (.reader-replace-overlay, quick-action variant) ──────────
//   header (内容替换 / 匹配规则 N 条) + current book + rule list (toggles) +
//   apply / cancel / restore. Ported from reader-replace-overlay-v2.html.
@Component
export struct ReaderReplacePanel {
  build() {
    ReaderOverlayPanel({ panelHeight: 440 }) {
      ReaderPanelHeader({ title: '内容替换', meta: '匹配规则 3 条' })
      ReaderListRow({ title: '当前书籍：深空信号', detail: '仅显示当前书籍匹配到的替换规则' })
      Column({ space: 8 }) {
        ReaderListRow({ title: '净化广告段落', detail: '移除章节中异常推广段' })
        ReaderListRow({ title: '合并异常断行', detail: '修复不自然换行' })
        ReaderListRow({ title: '修正常见乱码', detail: '替换缺失或错码字符' })
      }.width('100%')
      Row() {
        ReaderActionButton({ label: '应用', primary: true })
        ReaderActionButton({ label: '取消', dismiss: true })
        ReaderActionButton({ label: '恢复原文' })
      }.width('100%')
    }
  }
}

// ── Auto-scroll panel (.reader-auto-scroll-overlay, quick-action variant) ─
//   header (自动翻页 / 状态) + start/pause/stop + speed list-item + slider +
//   翻页方式 segmented. Ported from reader-auto-scroll-overlay-v2.html.
@Component
export struct ReaderAutoScrollPanel {
  build() {
    ReaderOverlayPanel({ panelHeight: 420 }) {
      ReaderPanelHeader({ title: '自动翻页', meta: '状态：未开启' })
      Row() {
        ReaderActionButton({ label: '开始', primary: true })
        ReaderActionButton({ label: '暂停' })
        ReaderActionButton({ label: '停止', dismiss: true })
      }.width('100%')
      ReaderListRow({ title: '翻页速度', detail: '中速 · 适合连续阅读' })
      ReaderSlider()
      Text('翻页方式').fontSize(13).fontWeight(700).fontColor(ColorTokens.controlInk)
      SegmentedControl({ options: ['滚动', '点击翻页', '连续滚动'] })
      Text('开启后将在本章内按当前速度推进，不影响下方页内控制条。')
        .fontSize(12).fontColor(ColorTokens.muted)
        .width('100%')
    }
  }
}

// ── Floating brightness (.reader-floating-brightness) ────────────────────
//   Vertical pill rail at left-center: brightness icon + 4px vertical track
//   (fill %) + chevron. The brightness_auto icon asset is TBD — placeholder
//   icon for now. Positioned left-center via align(Start) + offset x:12.
@Component
export struct FloatingBrightness {
  @State value: number = 40;

  build() {
    Stack({ alignContent: Alignment.Start }) {
      Column({ space: 16 }) {
        Image($r('app.media.reader_icon_more_dark')).width(22).height(22)
        Stack({ alignContent: Alignment.Bottom }) {
          Column().width(4).height('100%').borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(ColorTokens.border)
          Column().width(4).height(`${this.value}%`).borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(ColorTokens.primary)
        }
        .width(4).layoutWeight(1)
        Image($r('app.media.ui_icon_chevron_dark')).width(20).height(20)
      }
      .width(40).height(256).padding({ top: 16, bottom: 16 })
      .justifyContent(FlexAlign.Center).alignItems(HorizontalAlign.Center)
      .backgroundColor(ColorTokens.floatingControlBg)
      .border({ width: 1, color: ColorTokens.border })
      .borderRadius(DemoAliasTokens.radiusPill)
      .shadow({ radius: 8, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 2 })
      .margin({ left: 12 })
    }
    .width('100%')
    .height('100%')
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
