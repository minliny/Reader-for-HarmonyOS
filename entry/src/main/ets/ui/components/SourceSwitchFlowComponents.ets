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
import { BookDetail, CoreSourceEntry } from '../store/ReaderUiState';
import { MotionAdapter } from '../adapters/MotionAdapter';
import { InteractionDebugFrame } from './InteractionDebugComponents';
import { ReaderTypography } from '../tokens/ReaderTypography';

interface SourceSwitchCandidate {
  id: string;
  source: string;
  current: boolean;
}

@Component
struct SourceSwitchCandidateRow {
  @Prop candidate: SourceSwitchCandidate = { id: '', source: '', current: false };
  @StorageProp('reader.sourceSelection') sourceSelection: string[] = [];

  private isSelected(): boolean {
    return this.sourceSelection.indexOf(this.candidate.id) >= 0;
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
        // One source can be confirmed at a time. Use a radio indicator rather
        // than a checkbox so the visual model cannot promise multi-source
        // selection while the Core flow only consumes one source id.
        Stack({ alignContent: Alignment.Center }) {
          if (this.isSelected()) {
            Circle()
              .width(8)
              .height(8)
              .fill(ColorTokens.primary)
          }
        }
        .width(18)
        .height(18)
        .borderRadius(DemoAliasTokens.radiusPill)
        .border({ width: 1, color: this.isSelected() ? ColorTokens.primary : ColorTokens.border })
        Text(this.candidate.source)
          .fontSize(12)
          .fontWeight(650)
          .fontColor(this.candidate.current ? ColorTokens.accent : ColorTokens.ink)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .layoutWeight(1)
        if (this.candidate.current) {
          Text('当前')
            .fontSize(10)
            .fontWeight(700)
            .fontColor(ColorTokens.accent)
        }
      }
      .width('100%')
      .height(44)
      .padding({ left: 10, right: 10, top: 4, bottom: 4 })
      .backgroundColor(this.candidate.current ? ColorTokens.surfaceSoft : Color.Transparent)
      .border({ width: { top: this.candidate.current ? 0 : 1 }, color: ColorTokens.border })
      .alignItems(VerticalAlign.Center)
      .onClick(() => {
        ReaderUiStore.dispatch({ type: 'source-toggle', sourceId: this.candidate.id });
      })
      InteractionDebugFrame({ label: 'SOURCE_ROW', tone: 'action' })
    }
    .width('100%')
    .height(44)
  }
}

@Component
struct SourceSwitchWindow {
  // B1 P0：关闭换源用 MotionAdapter.apply 包裹，motionId 取 FlowShell 的 source.switch.route.pop
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;
  @StorageProp(SafeAreaAdapter.K_TOP) safeAreaTop: number = SafeAreaAdapter.DEFAULT_TOP;
  @StorageProp(SafeAreaAdapter.K_BOTTOM) safeAreaBottom: number = SafeAreaAdapter.DEFAULT_BOTTOM;
  @StorageProp(ViewportAdapter.K_WIDTH) viewportWidth: number = ViewportAdapter.DEFAULT_WIDTH;
  @StorageProp(ViewportAdapter.K_HEIGHT) viewportHeight: number = ViewportAdapter.DEFAULT_HEIGHT;
  // Bind current book from store to mark the active source in the candidate list.
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;
  @StorageProp('reader.availableSources') availableSources: CoreSourceEntry[] = [];
  @StorageProp('reader.errorCode') errorCode: string = '';
  @StorageProp('reader.errorMessage') errorMessage: string = '';

  private readonly inset: number = 12;
  private readonly topAfterReaderBar: number = 86;
  private readonly controlReserve: number = 330;

  // Candidate source list comes exclusively from Core source.list. A missing
  // Core list renders an honest empty state instead of demo source fixtures.
  private getCandidates(): SourceSwitchCandidate[] {
    const currentSource = this.currentBook !== null ? this.currentBook.sourceName : '';
    const currentSourceId = this.currentBook !== null ? (this.currentBook.sourceId ?? '') : '';
    const list: SourceSwitchCandidate[] = [];
    for (let i = 0; i < this.availableSources.length; i++) {
      const source = this.availableSources[i];
      if (!source.enabled) continue;
      list.push({
        id: source.sourceId,
        source: source.name,
        current: currentSourceId === source.sourceId || currentSource === source.name,
      });
    }
    return list;
  }

  private windowWidth(): number {
    return Math.max(0, this.viewportWidth - this.inset * 2);
  }

  private windowHeight(): number {
    const available = this.viewportHeight - this.safeAreaTop - this.safeAreaBottom - this.controlReserve - this.topAfterReaderBar;
    return Math.max(260, available);
  }

  private validationMessage(): string {
    return this.errorCode.startsWith('SOURCE_SWITCH') ? this.errorMessage : '';
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
          Text('请选择一个书源')
            .fontSize(11)
            .fontWeight(700)
            .fontColor(ColorTokens.muted)
          Stack({ alignContent: Alignment.TopStart }) {
            Image($r('app.media.reader_icon_close_dark'))
              .width(24)
              .height(24)
              .onClick(() => {
              // 关闭换源：route-pop 回到阅读器，用 FlowShell 的 pop 动效包裹
              MotionAdapter.apply('source.switch.route.pop', this.reducedMotion, this.getUIContext(), () => {
                ReaderUiStore.dispatch({ type: 'source-switch-cancel' });
              });
            })
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

        if (this.validationMessage().length > 0) {
          Text(this.validationMessage())
            .fontSize(11)
            .fontColor(ColorTokens.statusWarn)
            .lineHeight(17)
            .padding({ left: 10, right: 10, top: 7, bottom: 4 })
            .width('100%')
        }

        Scroll() {
          Column() {
            if (this.getCandidates().length === 0) {
              Text('暂无已启用书源，请先在书源管理中导入并启用书源')
                .fontSize(13)
                .fontColor(ColorTokens.muted)
                .lineHeight(20)
                .padding(20)
            } else {
              ForEach(this.getCandidates(), (candidate: SourceSwitchCandidate) => {
                SourceSwitchCandidateRow({ candidate: candidate })
              }, (candidate: SourceSwitchCandidate) => candidate.id)
            }
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
struct SourceSwitchPhoneActions {
  @StorageProp('reader.sourceSelection') sourceSelection: string[] = [];
  @StorageProp('reader.loading') loading: boolean = false;
  @StorageProp(SafeAreaAdapter.K_BOTTOM) safeAreaBottom: number = SafeAreaAdapter.DEFAULT_BOTTOM;
  @StorageProp(ViewportAdapter.K_HEIGHT) viewportHeight: number = ViewportAdapter.DEFAULT_HEIGHT;

  build() {
    Row({ space: 12 }) {
      Text('取消')
        .fontSize(13)
        .fontWeight(700)
        .fontColor(ColorTokens.primary)
        .height(44)
        .layoutWeight(1)
        .borderRadius(DemoAliasTokens.radiusPill)
        .border({ width: 1, color: ColorTokens.border })
        .textAlign(TextAlign.Center)
        .onClick(() => ReaderUiStore.dispatch({ type: 'source-switch-cancel' }))
      Text('确认换源')
        .fontSize(13)
        .fontWeight(700)
        .fontColor(DemoAliasTokens.onPrimary)
        .height(44)
        .layoutWeight(1)
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(this.sourceSelection.length === 1 && !this.loading ? ColorTokens.primaryDark : ColorTokens.border)
        .textAlign(TextAlign.Center)
        // Always dispatch: an empty confirmation is surfaced by the reducer
        // as an actionable validation message instead of doing nothing.
        .onClick(() => ReaderUiStore.dispatch({ type: 'source-switch-confirm' }))
    }
    .width('100%')
    .padding({ left: 12, right: 12, top: 10, bottom: 10 })
    .backgroundColor(ColorTokens.floatingControlBg)
    .borderRadius(DemoAliasTokens.radiusXl)
    .position({ x: 0, y: Math.max(0, this.viewportHeight - this.safeAreaBottom - 144) })
    .zIndex(ZIndexTokens.dialog + 1)
  }
}

@Component
export struct SourceSwitchFlowPage {
  @StorageProp(ViewportAdapter.K_WIDTH) viewportWidth: number = ViewportAdapter.DEFAULT_WIDTH;

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      ReaderBase()
      ReaderTopArea()
      if (this.viewportWidth >= 1100) {
        SourceSwitchFlowFrame()
      } else {
        ReaderControlSheet()
        ReaderBottomBar()
        SourceSwitchWindow()
        SourceSwitchPhoneActions()
      }
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
  @Prop hasSelection: boolean = false;
  @Prop loading: boolean = false;

  build() {
    Column({ space: 16 }) {
      Text('已选择来源')
        .fontSize(11)
        .fontWeight(900)
        .fontColor(ColorTokens.muted)
        .alignSelf(ItemAlign.Start)

      Column({ space: 10 }) {
        Row() {
          Text('来源').fontSize(11).fontColor(ColorTokens.muted).width(60)
          Text(this.selectedSource.length > 0 ? this.selectedSource : '请选择一个书源')
            .fontSize(13).fontWeight(700).fontColor(ColorTokens.controlInk).layoutWeight(1)
        }.width('100%')
        Row() {
          Text('说明').fontSize(11).fontColor(ColorTokens.muted).width(60)
          Text(this.hasSelection ? '确认后由 Core 搜索同名书并完成切换' : '选择后才能确认换源')
            .fontSize(12).fontColor(ColorTokens.controlInk).layoutWeight(1).maxLines(2)
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
        Text(this.loading ? '正在切换…' : '确认换源')
          .fontSize(13)
          .fontWeight(700)
          .fontColor(DemoAliasTokens.onPrimary)
          .height(44)
          .width('100%')
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(this.hasSelection && !this.loading ? ColorTokens.primaryDark : ColorTokens.border)
          .textAlign(TextAlign.Center)
          .onClick(() => ReaderUiStore.dispatch({ type: 'source-switch-confirm' }))
        Text('取消')
          .fontSize(13)
          .fontWeight(700)
          .fontColor(ColorTokens.primary)
          .height(44)
          .width('100%')
          .borderRadius(DemoAliasTokens.radiusPill)
          .border({ width: 1, color: ColorTokens.border })
          .textAlign(TextAlign.Center)
          .onClick(() => ReaderUiStore.dispatch({ type: 'source-switch-cancel' }))
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
// Right column hides below viewportWidth 1100 (B adaptive behavior). On narrow
// screens, the confirm/cancel action bar moves into the middle column bottom.
@Component
export struct SourceSwitchFlowFrame {
  @StorageProp(SafeAreaAdapter.K_TOP) safeAreaTop: number = SafeAreaAdapter.DEFAULT_TOP;
  @StorageProp(SafeAreaAdapter.K_BOTTOM) safeAreaBottom: number = SafeAreaAdapter.DEFAULT_BOTTOM;
  @StorageProp(ViewportAdapter.K_WIDTH) viewportWidth: number = ViewportAdapter.DEFAULT_WIDTH;
  // Bind real store state for context window and result panel.
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;
  @StorageProp('reader.sourceSelection') sourceSelection: string[] = [];
  @StorageProp('reader.availableSources') availableSources: CoreSourceEntry[] = [];
  @StorageProp('reader.loading') loading: boolean = false;

  private bookTitle(): string {
    return this.currentBook !== null ? this.currentBook.title : '未选择书籍';
  }

  private chapterTitle(): string {
    return this.currentBook !== null ? this.currentBook.latestChapter : '';
  }

  private currentSourceName(): string {
    return this.currentBook !== null ? this.currentBook.sourceName : '未知来源';
  }

  private selectedSource(): string {
    const selectedId = this.sourceSelection.length === 1 ? this.sourceSelection[0] : '';
    for (let i = 0; i < this.availableSources.length; i++) {
      if (this.availableSources[i].sourceId === selectedId) return this.availableSources[i].name;
    }
    return '';
  }

  private hasSelection(): boolean {
    return this.sourceSelection.length === 1;
  }

  build() {
    Column() {
      Row({ space: 16 }) {
        // 左栏 300px — context window bound to store currentBook
        Column() {
          SourceSwitchContextWindow({
            bookTitle: this.bookTitle(),
            chapterTitle: this.chapterTitle(),
            currentSource: this.currentSourceName()
          })
        }
        .width(300)
        .height('100%')
        .borderRadius(DemoAliasTokens.radiusXl)
        .backgroundColor(ColorTokens.floatingControlBg)

        // 中栏 1fr — candidate list + narrow-screen action bar
        Column() {
          SourceSwitchWindow()
          // Narrow-screen bottom action bar (replaces right column's
          // confirm/cancel when viewportWidth < 1100).
          if (this.viewportWidth < 1100) {
            Row({ space: 12 }) {
              Text('取消')
                .fontSize(13)
                .fontWeight(700)
                .fontColor(ColorTokens.primary)
                .height(44)
                .layoutWeight(1)
                .borderRadius(DemoAliasTokens.radiusPill)
                .border({ width: 1, color: ColorTokens.border })
                .textAlign(TextAlign.Center)
                .onClick(() => ReaderUiStore.dispatch({ type: 'source-switch-cancel' }))
              Text('确认换源')
                .fontSize(13)
                .fontWeight(700)
                .fontColor(DemoAliasTokens.onPrimary)
                .height(44)
                .layoutWeight(1)
                .borderRadius(DemoAliasTokens.radiusPill)
                .backgroundColor(this.hasSelection() && !this.loading ? ColorTokens.primaryDark : ColorTokens.border)
                .textAlign(TextAlign.Center)
                .onClick(() => ReaderUiStore.dispatch({ type: 'source-switch-confirm' }))
            }
            .width('100%')
            .padding({ top: 8, bottom: 4 })
          }
        }
        .layoutWeight(1)
        .height('100%')
        .borderRadius(DemoAliasTokens.radiusXl)
        .backgroundColor(ColorTokens.floatingControlBg)

        // 右栏 320px — result panel bound to selected source (wide screen only)
        if (this.viewportWidth >= 1100) {
          Column() {
            SourceSwitchResultPanel({
              selectedSource: this.selectedSource(),
              hasSelection: this.hasSelection(),
              loading: this.loading,
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
