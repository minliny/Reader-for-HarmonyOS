// SourceSwitchFlowComponents — the one Figma-backed source-switch surface.
//
// A source row is an immediate action: it starts the Core-backed replacement
// transaction directly.  There is deliberately no candidate-selection state,
// confirmation action bar, result matrix, or desktop-only workbench.  Those
// older shapes made the interaction differ from the approved source list.
import { ZIndexTokens } from '../../contract/generated/DimensionTokens';
import { ReaderUiVisualTokens } from '../../contract/reader_ui/VisualAdmission';
import { ViewportAdapter } from '../adapters/ViewportAdapter';
import { MotionAdapter } from '../adapters/MotionAdapter';
import { ReaderBase, ReaderTopArea } from './ReaderComponents';
import { ReaderBottomBar, ReaderControlSheet } from './ReaderOverlayComponents';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { BookDetail, CoreSourceEntry } from '../store/ReaderUiState';

interface SourceSwitchCandidate {
  id: string;
  source: string;
  current: boolean;
  // Core's source.list projection has no latency or source-specific chapter
  // field. Keep these values absent rather than inventing the static Figma
  // sample values. The dense three-column geometry remains source-led.
  latency: string;
  chapter: string;
}

@Component
struct SourceSwitchCandidateRow {
  @Prop candidate: SourceSwitchCandidate = {
    id: '', source: '', current: false, latency: '', chapter: '',
  };
  @Prop showDivider: boolean = false;

  build() {
    Row() {
      Row({ space: 6 }) {
        Column()
          .width(5)
          .height(5)
          .borderRadius(2.5)
          .backgroundColor(this.candidate.current ? ReaderUiVisualTokens.sourceSwitchStatusGood : Color.Transparent)
        Text(this.candidate.source)
          .width(96)
          .fontSize(10)
          .fontWeight(500)
          .fontFamily(ReaderUiVisualTokens.sourceSwitchControlFontFamily)
          .fontColor(this.candidate.current ? ReaderUiVisualTokens.sourceSwitchSelectedInk : ReaderUiVisualTokens.sourceSwitchInk)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .width(108)
      .height('100%')
      .alignItems(VerticalAlign.Center)

      // These two columns are intentionally empty until Core exposes their
      // live projections. Showing a made-up latency/current chapter would
      // turn the Figma sample data into a false runtime claim.
      Text(this.candidate.latency)
        .width(72)
        .fontSize(9)
        .fontWeight(400)
        .fontFamily(ReaderUiVisualTokens.sourceSwitchControlFontFamily)
        .fontColor(ReaderUiVisualTokens.sourceSwitchMuted)
        .textAlign(TextAlign.End)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
      Text(this.candidate.chapter)
        .width(100)
        .fontSize(9)
        .fontWeight(500)
        .fontFamily(ReaderUiVisualTokens.sourceSwitchControlFontFamily)
        .fontColor(ReaderUiVisualTokens.sourceSwitchChapterInk)
        .textAlign(TextAlign.End)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
    }
      .width('100%')
      .height(ReaderUiVisualTokens.sourceSwitchCandidateHeight)
      .padding({ left: 9, right: 9 })
      .backgroundColor(this.candidate.current ? ReaderUiVisualTokens.sourceSwitchSelectedSurface : Color.Transparent)
      .border({ width: { bottom: this.showDivider ? 1 : 0 }, color: ReaderUiVisualTokens.sourceSwitchDivider })
      .alignItems(VerticalAlign.Center)
      .onClick(() => ReaderUiStore.requestSourceSwitch(this.candidate.id))
      .accessibilityText(this.candidate.current ? `${this.candidate.source}，当前书源` : `切换到${this.candidate.source}`)
  }
}

@Component
struct SourceSwitchWindow {
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;
  @StorageProp(ViewportAdapter.K_WIDTH) viewportWidth: number = ViewportAdapter.DEFAULT_WIDTH;
  @StorageProp(ViewportAdapter.K_HEIGHT) viewportHeight: number = ViewportAdapter.DEFAULT_HEIGHT;
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;
  @StorageProp('reader.availableSources') availableSources: CoreSourceEntry[] = [];

  private getCandidates(): SourceSwitchCandidate[] {
    const currentSource = this.currentBook !== null ? this.currentBook.sourceName : '';
    const currentSourceId = this.currentBook !== null ? (this.currentBook.sourceId ?? '') : '';
    const list: SourceSwitchCandidate[] = [];
    for (let index = 0; index < this.availableSources.length; index += 1) {
      const source = this.availableSources[index];
      if (!source.enabled) continue;
      list.push({
        id: source.sourceId,
        source: source.name,
        current: currentSourceId === source.sourceId || currentSource === source.name,
        latency: '',
        chapter: '',
      });
    }
    return list;
  }

  private isTabletLayout(): boolean {
    return ViewportAdapter.isWide(this.viewportWidth, this.viewportHeight);
  }

  private windowLeft(): number {
    if (this.isTabletLayout()) {
      return Math.max(0, this.viewportWidth - ReaderUiVisualTokens.sourceSwitchWindowWidth -
        ReaderUiVisualTokens.sourceSwitchTabletRightInset);
    }
    return Math.max(0, (this.viewportWidth - ReaderUiVisualTokens.sourceSwitchWindowWidth) / 2);
  }

  private close(): void {
    MotionAdapter.apply('source.switch.route.pop', this.reducedMotion, this.getUIContext(), () => {
      ReaderUiStore.dispatch({ type: 'source-switch-cancel' });
    });
  }

  build() {
    Column() {
      Row() {
        Image($r('app.media.reader_icon_source_switch_primary'))
          .width(20)
          .height(20)
        Text('换源')
          .width(161)
          .fontSize(11)
          .fontWeight(500)
          .fontFamily(ReaderUiVisualTokens.sourceSwitchControlFontFamily)
          .fontColor(ReaderUiVisualTokens.sourceSwitchHeaderInk)
          .margin({ left: 5 })
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text('按延迟排序')
          .width(60)
          .height(20)
          .fontSize(9)
          .fontWeight(400)
          .fontFamily(ReaderUiVisualTokens.sourceSwitchControlFontFamily)
          .fontColor(ReaderUiVisualTokens.sourceSwitchMuted)
          .textAlign(TextAlign.Center)
          .backgroundColor(ReaderUiVisualTokens.sourceSwitchSortSurface)
          .borderRadius(10)
          .margin({ right: 12 })
        Stack() {
          Image($r('app.media.reader_icon_close_dark'))
            .width(20)
            .height(20)
        }
          .width(22)
          .height(22)
          .borderRadius(8)
          .backgroundColor(ReaderUiVisualTokens.sourceSwitchCloseSurface)
          .alignContent(Alignment.Center)
          .onClick(() => this.close())
          .accessibilityText('关闭换源')
      }
      .width('100%')
      .height(ReaderUiVisualTokens.sourceSwitchHeaderHeight)
      .padding({ left: 9, right: 10 })
      .border({ width: { bottom: 1 }, color: ReaderUiVisualTokens.sourceSwitchDivider })
      .alignItems(VerticalAlign.Center)

      Row() {
        Text('书源')
          .width(107)
          .fontSize(8)
          .fontWeight(400)
          .fontFamily(ReaderUiVisualTokens.sourceSwitchControlFontFamily)
          .fontColor(ReaderUiVisualTokens.sourceSwitchMuted)
        Text('延迟')
          .width(72)
          .fontSize(8)
          .fontWeight(400)
          .fontFamily(ReaderUiVisualTokens.sourceSwitchControlFontFamily)
          .fontColor(ReaderUiVisualTokens.sourceSwitchMuted)
        Text('当前章节')
          .width(100)
          .fontSize(8)
          .fontWeight(400)
          .fontFamily(ReaderUiVisualTokens.sourceSwitchControlFontFamily)
          .fontColor(ReaderUiVisualTokens.sourceSwitchMuted)
      }
      .width('100%')
      .height(ReaderUiVisualTokens.sourceSwitchColumnHeaderHeight)
      .padding({ left: 10, right: 10 })
      .backgroundColor(ReaderUiVisualTokens.sourceSwitchHeaderSurface)
      .alignItems(VerticalAlign.Center)

      Scroll() {
        Column() {
          ForEach(this.getCandidates(), (candidate: SourceSwitchCandidate, index: number) => {
            SourceSwitchCandidateRow({ candidate: candidate, showDivider: index < this.getCandidates().length - 1 })
          }, (candidate: SourceSwitchCandidate) => candidate.id)
        }
        .width('100%')
      }
      .height(308)
      .scrollBar(BarState.Off)

      Text(`共 ${this.getCandidates().length} 个书源`)
        .width('100%')
        .height(ReaderUiVisualTokens.sourceSwitchFooterHeight)
        .fontSize(8)
        .fontWeight(400)
        .fontFamily(ReaderUiVisualTokens.sourceSwitchControlFontFamily)
        .fontColor(ReaderUiVisualTokens.sourceSwitchFooterMuted)
        .textAlign(TextAlign.Center)
    }
    .width(ReaderUiVisualTokens.sourceSwitchWindowWidth)
    .height(ReaderUiVisualTokens.sourceSwitchWindowHeight)
    .borderRadius(ReaderUiVisualTokens.sourceSwitchWindowRadius)
    .border({ width: 1, color: ReaderUiVisualTokens.sourceSwitchWindowBorder })
    .backgroundColor(ReaderUiVisualTokens.sourceSwitchWindowSurface)
    .margin({ top: ReaderUiVisualTokens.sourceSwitchPhoneTop, left: this.windowLeft() })
    .clip(true)
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
    .expandSafeArea([SafeAreaType.SYSTEM, SafeAreaType.CUTOUT],
      [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END])
  }
}
