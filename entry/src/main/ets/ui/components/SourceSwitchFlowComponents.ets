// SourceSwitchFlowComponents — live demo source-switch route.
// Truth source: frontend-demo/render-runtime.js flowScreen() + styles/05-flow-adaptive.css.
// This is a Reader-plane flow: ReaderBase + control dock stay visible, and the
// source switch window floats inline above the control sheet. It is not a
// full-screen BackTopBar/List page.
//
// B-spec 3-column workbench (.fd-flow-frame): SourceSwitchFlowFrame composes
// SourceSwitchContextWindow (300px) | SourceSwitchWindow (1fr) |
// SourceSwitchResultPanel (320px) — used by FlowShell for source-switch routes.
// SourceSwitchFlowPage remains as the legacy Reader-plane variant.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { ZIndexTokens } from '../../contract/generated/DimensionTokens';
import { RouteId } from '../../contract/generated/RouteTable';
import { SafeAreaAdapter } from '../adapters/SafeAreaAdapter';
import { ViewportAdapter } from '../adapters/ViewportAdapter';
import { ReaderBase, ReaderTopArea } from './ReaderComponents';
import { ReaderBottomBar, ReaderControlSheet } from './ReaderOverlayComponents';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { InteractionDebugFrame } from './InteractionDebugComponents';
import { ReaderTypography } from '../tokens/ReaderTypography';

interface SourceSwitchCandidate {
  source: string;
  speed: string;
  chapter: string;
  current: boolean;
}

@Component
struct SourceSwitchCandidateRow {
  @Prop candidate: SourceSwitchCandidate = { source: '优书网', speed: '120 ms', chapter: '第 32 章 雨夜', current: true };
  @StorageProp('reader.sourceSelection') sourceSelection: string[] = [];

  private isSelected(): boolean {
    return this.sourceSelection.indexOf(this.candidate.source) >= 0;
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      // 当前源左侧 accent 竖条（对齐 B 的 .is-current accent 高亮）
      if (this.candidate.current) {
        Column()
          .width(3)
          .height('100%')
          .backgroundColor(ColorTokens.accent)
      }
      Row({ space: 7 }) {
        // Selection checkbox — reflects reader.sourceSelection state.
        Stack() {
          if (this.isSelected()) {
            Image($r('app.media.ui_icon_check_white'))
              .width(12)
              .height(12)
          }
        }
        .width(18)
        .height(18)
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(this.isSelected() ? ColorTokens.primary : Color.Transparent)
        .border({ width: 1, color: this.isSelected() ? ColorTokens.primary : ColorTokens.border })
        Text(this.candidate.source)
          .fontSize(12)
          .fontWeight(650)
          .fontColor(this.candidate.current ? ColorTokens.accent : ColorTokens.ink)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .layoutWeight(1)
        Text(this.candidate.speed)
          .fontSize(9)
          .fontWeight(500)
          .fontColor(this.candidate.current ? ColorTokens.accent : ColorTokens.muted)
          .textAlign(TextAlign.End)
          .width(48)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(this.candidate.chapter)
          .fontSize(10)
          .fontWeight(550)
          .fontColor(ColorTokens.controlInk)
          .textAlign(TextAlign.End)
          .width(96)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .width('100%')
      .height(44)
      .padding({ left: 10, right: 10, top: 4, bottom: 4 })
      .backgroundColor(this.candidate.current ? ColorTokens.surfaceSoft : Color.Transparent)
      .border({ width: { top: this.candidate.current ? 0 : 1 }, color: ColorTokens.border })
      .alignItems(VerticalAlign.Center)
      .onClick(() => {
        ReaderUiStore.dispatch({ type: 'source-toggle', sourceId: this.candidate.source });
      })
      InteractionDebugFrame({ label: 'SOURCE_ROW', tone: 'action' })
    }
    .width('100%')
    .height(44)
  }
}

@Component
struct SourceSwitchWindow {
  @StorageProp(SafeAreaAdapter.K_TOP) safeAreaTop: number = SafeAreaAdapter.DEFAULT_TOP;
  @StorageProp(SafeAreaAdapter.K_BOTTOM) safeAreaBottom: number = SafeAreaAdapter.DEFAULT_BOTTOM;
  @StorageProp(ViewportAdapter.K_WIDTH) viewportWidth: number = ViewportAdapter.DEFAULT_WIDTH;
  @StorageProp(ViewportAdapter.K_HEIGHT) viewportHeight: number = ViewportAdapter.DEFAULT_HEIGHT;

  private readonly inset: number = 12;
  private readonly topAfterReaderBar: number = 86;
  private readonly controlReserve: number = 330;
  private candidates: SourceSwitchCandidate[] = [
    { source: '优书网', speed: '120 ms', chapter: '第 32 章 雨夜', current: true },
    { source: '笔趣阁镜像', speed: '180 ms', chapter: '第 32 章 雨夜', current: false },
    { source: '轻小说书站', speed: '210 ms', chapter: '第 32 章 雨夜', current: false },
    { source: '云端书库', speed: '260 ms', chapter: '第 32 章 雨夜', current: false },
    { source: '聚合书源一', speed: '320 ms', chapter: '第 32 章 雨夜', current: false },
    { source: '聚合书源二', speed: '390 ms', chapter: '第 32 章 雨夜', current: false },
    { source: '备用线路 A', speed: '510 ms', chapter: '第 32 章 雨夜', current: false },
    { source: '备用线路 B', speed: '680 ms', chapter: '第 32 章 雨夜', current: false },
    { source: '章节同步源', speed: '760 ms', chapter: '第 32 章 雨夜', current: false },
    { source: '本地缓存', speed: '离线', chapter: '第 32 章 雨夜', current: false },
    { source: '旧源备份', speed: '超时', chapter: '第 31 章 归途', current: false },
  ];

  private windowWidth(): number {
    return Math.max(0, this.viewportWidth - this.inset * 2);
  }

  private windowHeight(): number {
    const available = this.viewportHeight - this.safeAreaTop - this.safeAreaBottom - this.controlReserve - this.topAfterReaderBar;
    return Math.max(260, available);
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Column() {
        Row({ space: 8 }) {
          Image($r('app.media.reader_icon_source_switch_primary'))
            .width(20)
            .height(20)
          Text('换源')
            .fontSize(13)
            .fontWeight(800)
            .fontColor(ColorTokens.controlInk)
            .layoutWeight(1)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
          Text('按延迟排序')
            .fontSize(11)
            .fontWeight(700)
            .fontColor(ColorTokens.muted)
          Text('全选')
            .fontSize(11)
            .fontWeight(700)
            .fontColor(ColorTokens.primaryDark)
            .margin({ left: 8 })
            .onClick(() => ReaderUiStore.dispatch({ type: 'source-select-all' }))
          Text('清除')
            .fontSize(11)
            .fontWeight(700)
            .fontColor(ColorTokens.primaryDark)
            .margin({ left: 8 })
            .onClick(() => ReaderUiStore.dispatch({ type: 'source-clear' }))
          Stack({ alignContent: Alignment.TopStart }) {
            Image($r('app.media.reader_icon_close_dark'))
              .width(24)
              .height(24)
              .onClick(() => ReaderUiStore.dispatch({ type: 'route-replace', id: 'reader' as RouteId }))
            InteractionDebugFrame({ label: 'CLOSE', tone: 'action' })
          }
          .width(24)
          .height(24)
        }
        .width('100%')
        .height(32)
        .padding({ left: 9, right: 6 })
        .border({ width: { bottom: 1 }, color: ColorTokens.border })
        .alignItems(VerticalAlign.Center)

        Scroll() {
          Column() {
            ForEach(this.candidates, (candidate: SourceSwitchCandidate) => {
              SourceSwitchCandidateRow({ candidate: candidate })
            }, (candidate: SourceSwitchCandidate) => candidate.source)
          }
          .width('100%')
        }
        .layoutWeight(1)
        .scrollBar(BarState.Off)
      }
      .width('100%')
      .height('100%')
      InteractionDebugFrame({ label: 'SOURCE_SWITCH_WINDOW', tone: 'route' })
    }
    .width(this.windowWidth())
    .height(this.windowHeight())
    .padding({ left: 9, right: 9, top: 7, bottom: 7 })
    .borderRadius(DemoAliasTokens.radiusXl)
    .border({ width: 1, color: ColorTokens.border })
    .backgroundColor(ColorTokens.paperBright)
    .margin({ top: this.safeAreaTop + this.topAfterReaderBar, left: this.inset, right: this.inset })
    .zIndex(ZIndexTokens.dialog)
  }
}

@Component
export struct SourceSwitchFlowPage {
  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      ReaderBase()
      ReaderTopArea()
      ReaderControlSheet()
      ReaderBottomBar()
      SourceSwitchWindow()
    }
    .width('100%')
    .height('100%')
    .backgroundColor(ColorTokens.paper)
    .expandSafeArea([SafeAreaType.SYSTEM, SafeAreaType.CUTOUT],
      [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END])
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// B-spec 3-column source-switch workbench (.fd-flow-frame)
// Grid: 300px | 1fr | 320px, gap 16px, padding 18px. Right column hides below
// viewportWidth 1100 (adaptive). Used by FlowShell for source-switch routes.
// ─────────────────────────────────────────────────────────────────────────────

// Left column (300px) — original chapter context + current source info.
@Component
export struct SourceSwitchContextWindow {
  @Prop bookTitle: string = '';
  @Prop chapterTitle: string = '';
  @Prop currentSource: string = '';

  build() {
    Column({ space: 16 }) {
      // 标题区
      Column({ space: 6 }) {
        Text('换源上下文')
          .fontSize(11)
          .fontWeight(900)
          .fontColor(ColorTokens.muted)
        Text(this.bookTitle)
          .fontSize(16)
          .fontWeight(700)
          .fontColor(ColorTokens.controlInk)
          .fontFamily(ReaderTypography.serifFamily())
        Text(this.chapterTitle)
          .fontSize(13)
          .fontColor(ColorTokens.muted)
      }
      .alignItems(HorizontalAlign.Start)
      .width('100%')

      // 当前源信息
      Column({ space: 8 }) {
        Text('当前来源')
          .fontSize(11)
          .fontWeight(900)
          .fontColor(ColorTokens.muted)
        Row({ space: 8 }) {
          Circle().width(8).height(8).fill(ColorTokens.accent)
          Text(this.currentSource)
            .fontSize(13)
            .fontWeight(700)
            .fontColor(ColorTokens.controlInk)
            .layoutWeight(1)
        }
        .width('100%')
        .padding({ left: 10, right: 10, top: 8, bottom: 8 })
        .borderRadius(DemoAliasTokens.radiusMd)
        .backgroundColor(ColorTokens.surfaceSoft)
      }
      .alignItems(HorizontalAlign.Start)
      .width('100%')
    }
    .width('100%')
    .height('100%')
    .padding(18)
    .alignItems(HorizontalAlign.Start)
  }
}

// Right column (320px) — selected source detail + action buttons.
@Component
export struct SourceSwitchResultPanel {
  @Prop selectedSource: string = '';
  @Prop speed: string = '';
  @Prop chapter: string = '';

  build() {
    Column({ space: 16 }) {
      Text('换源结果')
        .fontSize(11)
        .fontWeight(900)
        .fontColor(ColorTokens.muted)
        .alignSelf(ItemAlign.Start)

      Column({ space: 10 }) {
        Row() {
          Text('来源').fontSize(11).fontColor(ColorTokens.muted).width(60)
          Text(this.selectedSource).fontSize(13).fontWeight(700).fontColor(ColorTokens.controlInk).layoutWeight(1)
        }.width('100%')
        Row() {
          Text('速度').fontSize(11).fontColor(ColorTokens.muted).width(60)
          Text(this.speed).fontSize(13).fontColor(ColorTokens.controlInk).layoutWeight(1)
        }.width('100%')
        Row() {
          Text('章节').fontSize(11).fontColor(ColorTokens.muted).width(60)
          Text(this.chapter).fontSize(13).fontColor(ColorTokens.controlInk).layoutWeight(1).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
        }.width('100%')
      }
      .width('100%')
      .padding(14)
      .borderRadius(DemoAliasTokens.radiusMd)
      .backgroundColor(ColorTokens.surfaceSoft)
      .alignItems(HorizontalAlign.Start)

      Blank()

      // 操作按钮
      Column({ space: 8 }) {
        Text('确认换源')
          .fontSize(13)
          .fontWeight(700)
          .fontColor(DemoAliasTokens.onPrimary)
          .height(44)
          .width('100%')
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(ColorTokens.primaryDark)
          .textAlign(TextAlign.Center)
        Text('取消')
          .fontSize(13)
          .fontWeight(700)
          .fontColor(ColorTokens.primary)
          .height(44)
          .width('100%')
          .borderRadius(DemoAliasTokens.radiusPill)
          .border({ width: 1, color: ColorTokens.border })
          .textAlign(TextAlign.Center)
      }
      .width('100%')
    }
    .width('100%')
    .height('100%')
    .padding(18)
    .alignItems(HorizontalAlign.Start)
  }
}

// 3-column container — 300px context | 1fr candidate list | 320px result panel.
// Right column hides below viewportWidth 1100 (B adaptive behavior).
@Component
export struct SourceSwitchFlowFrame {
  @StorageProp(SafeAreaAdapter.K_TOP) safeAreaTop: number = SafeAreaAdapter.DEFAULT_TOP;
  @StorageProp(SafeAreaAdapter.K_BOTTOM) safeAreaBottom: number = SafeAreaAdapter.DEFAULT_BOTTOM;
  @StorageProp(ViewportAdapter.K_WIDTH) viewportWidth: number = ViewportAdapter.DEFAULT_WIDTH;

  build() {
    Column() {
      Row({ space: 16 }) {
        // 左栏 300px
        Column() {
          SourceSwitchContextWindow({
            bookTitle: '长夜难明',
            chapterTitle: '第 32 章 雨夜',
            currentSource: '优书网'
          })
        }
        .width(300)
        .height('100%')
        .borderRadius(DemoAliasTokens.radiusXl)
        .backgroundColor(ColorTokens.floatingControlBg)

        // 中栏 1fr
        Column() {
          SourceSwitchWindow()
        }
        .layoutWeight(1)
        .height('100%')
        .borderRadius(DemoAliasTokens.radiusXl)
        .backgroundColor(ColorTokens.floatingControlBg)

        // 右栏 320px（仅在宽屏显示）
        if (this.viewportWidth >= 1100) {
          Column() {
            SourceSwitchResultPanel({
              selectedSource: '优书网',
              speed: '120 ms',
              chapter: '第 32 章 雨夜'
            })
          }
          .width(320)
          .height('100%')
          .borderRadius(DemoAliasTokens.radiusXl)
          .backgroundColor(ColorTokens.floatingControlBg)
        }
      }
      .width('100%')
      .layoutWeight(1)
      .padding(18)
    }
    .width('100%')
    .height('100%')
    .padding({ top: this.safeAreaTop, bottom: this.safeAreaBottom })
    .backgroundColor(ColorTokens.surface)
  }
}
