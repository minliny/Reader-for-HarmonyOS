// ReaderAutoSearchComponents — auto-page / search / replace quick panels.
// 对应 B 的 02c-reader-auto-search.css (自动翻页/搜索/替换 quick panel).
// Split from ReaderOverlayComponents.ets; barrel re-exports kept for back-compat.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { ZIndexTokens } from '../../contract/generated/DimensionTokens';
import { RouteId } from '../../contract/generated/RouteTable';
import { SafeAreaAdapter } from '../adapters/SafeAreaAdapter';
import { ViewportAdapter } from '../adapters/ViewportAdapter';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { InteractionDebugBadge, InteractionDebugFrame } from './InteractionDebugComponents';
import { ToggleSwitch } from './ReaderControlComponents';

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
export struct ReaderQuickPillButton {
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
