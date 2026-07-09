// ReaderFullpageComponents — full-page framework shell + utility full pages.
// 对应 B 的 03d-reader-fullpage.css (全页承载).
// Split from ReaderOverlayComponents.ets; barrel re-exports kept for back-compat.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { ZIndexTokens } from '../../contract/generated/DimensionTokens';
import { RouteId } from '../../contract/generated/RouteTable';
import { SafeAreaAdapter } from '../adapters/SafeAreaAdapter';
import { ViewportAdapter } from '../adapters/ViewportAdapter';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { InteractionDebugBadge, InteractionDebugFrame } from './InteractionDebugComponents';
import { ReaderCompactSwitch } from './ReaderControlComponents';

// ── Full reader pages (.fd-reader-full-page-panel) ───────────────────────
// Live demo truth for reader-full-* / reader-book-cache / reader-debug-info:
// these are expanded full panels in the reader full host. They do not render
// ReaderBottomBar or the module nav; the grabber/header collapses back to the
// corresponding quick/module route.
@Component
export struct ReaderFullPanelShell {
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

  // Top/bottom 约束模型：显式 top inset (header) + bottom inset (footer + safe area)
  private panelTopInset(): number {
    return 88;
  }
  private panelBottomInset(): number {
    return this.safeAreaBottom + 18;
  }
  private panelHeight(): number {
    return Math.max(320, this.viewportHeight - this.panelTopInset() - this.panelBottomInset());
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
      .position({ x: 12, y: this.panelTopInset() })
    }
    .width('100%')
    .height('100%')
    .hitTestBehavior(HitTestMode.Transparent)
    .zIndex(ZIndexTokens.bottomSheet)
  }
}

@Component
export struct ReaderFullBlock {
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
export struct ReaderFullChoiceRow {
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
export struct ReaderFullToggleRow {
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
