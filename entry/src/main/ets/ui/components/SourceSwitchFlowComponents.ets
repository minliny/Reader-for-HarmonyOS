// SourceSwitchFlowComponents — live demo source-switch route.
// Truth source: frontend-demo/render-runtime.js flowScreen() + styles/05-flow-adaptive.css.
// This is a Reader-plane flow: ReaderBase + control dock stay visible, and the
// source switch window floats inline above the control sheet. It is not a
// full-screen BackTopBar/List page.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { ZIndexTokens } from '../../contract/generated/DimensionTokens';
import { RouteId } from '../../contract/generated/RouteTable';
import { SafeAreaAdapter } from '../adapters/SafeAreaAdapter';
import { ViewportAdapter } from '../adapters/ViewportAdapter';
import { ReaderBase } from './ReaderComponents';
import { ReaderBottomBar, ReaderControlSheet } from './ReaderOverlayComponents';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { InteractionDebugFrame } from './InteractionDebugComponents';

interface SourceSwitchCandidate {
  source: string;
  speed: string;
  chapter: string;
  current: boolean;
}

@Component
struct SourceSwitchCandidateRow {
  @Prop candidate: SourceSwitchCandidate = { source: '优书网', speed: '120 ms', chapter: '第 32 章 雨夜', current: true };

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row({ space: 7 }) {
        Text(this.candidate.source)
          .fontSize(10)
          .fontWeight(550)
          .fontColor(ColorTokens.ink)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .layoutWeight(1)
        Text(this.candidate.speed)
          .fontSize(8)
          .fontWeight(450)
          .fontColor(ColorTokens.muted)
          .textAlign(TextAlign.End)
          .width(45)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(this.candidate.chapter)
          .fontSize(9)
          .fontWeight(500)
          .fontColor(ColorTokens.controlInk)
          .textAlign(TextAlign.End)
          .width(86)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .width('100%')
      .height(32)
      .padding({ left: 9, right: 9, top: 2, bottom: 2 })
      .backgroundColor(this.candidate.current ? ColorTokens.surfaceSoft : Color.Transparent)
      .border({ width: { top: this.candidate.current ? 0 : 1 }, color: ColorTokens.border })
      .alignItems(VerticalAlign.Center)
      InteractionDebugFrame({ label: 'SOURCE_ROW', tone: 'action' })
    }
    .width('100%')
    .height(32)
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
