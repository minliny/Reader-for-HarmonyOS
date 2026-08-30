import { CandidateRow } from './CandidateRow';
import { sourceSwitchCandidateKey } from './SourceSwitchGateway';
import type { ReaderAppearanceTheme } from '../reading/ReaderAppearanceState';
import { readerThemePalette, type ReaderThemePalette } from '../reading/ReaderThemePalettes';
import type { SourceSwitchCandidate } from './SourceSwitchGateway';
import {
  TOK_BORDER_W,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
} from '../common/ReaderTokens';

import { registerReaderFonts } from '../common/ReaderFonts';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import {
  readerInteractiveSafeBottom,
  readerInteractiveSafeLeft,
  readerInteractiveSafeRight,
  readerVisualSafeTop,
} from '../common/ReaderWindowMetrics';
import {
  SurfaceHorizontalFrame,
  SurfaceWidthSpec,
  resolveHorizontalFrame,
} from '../common/SurfaceHorizontalGeometry';

/**
 * SourceSwitch overlay window state (Window State 7态, SS-SOURCE-SWITCH-01).
 * The seven states follow the Source Switch state contract. Candidate-state
 * geometry comes from SourceSwitch/Window (Phone 943:15215 / Tablet 943:15705,
 * both mounting 568:656). States without a dedicated visible Figma frame stay
 * fail-closed for visual acceptance; the owning Index still drives the real
 * gateway transitions.
 */
export interface SourceSwitchDiscoveringState {
  kind: 'discovering';
}

export interface SourceSwitchCandidatesState {
  kind: 'candidates';
  candidates: SourceSwitchCandidate[];
  refreshing?: boolean;
  refreshError?: string;
}

export interface SourceSwitchEmptyState {
  kind: 'empty';
}

export interface SourceSwitchDiscoveryErrorState {
  kind: 'discoveryError';
  message: string;
}

export interface SourceSwitchSwitchingState {
  kind: 'switching';
  targetSourceId: string;
}

export interface SourceSwitchSuccessState {
  kind: 'success';
}

export interface SourceSwitchFailureState {
  kind: 'failure';
  message: string;
  transactionId?: string;
}

export type SourceSwitchPanelState =
  | SourceSwitchDiscoveringState
  | SourceSwitchCandidatesState
  | SourceSwitchEmptyState
  | SourceSwitchDiscoveryErrorState
  | SourceSwitchSwitchingState
  | SourceSwitchSuccessState
  | SourceSwitchFailureState;

/**
 * Source-switch window (Figma `568:656`, 300×385 r20): 34px header, 20px column
 * header, 28px candidate rows (CandidateRow), 22px footer. Candidate rows switch
 * directly on tap — no confirmation footer. Latency and current-chapter columns
 * render the durable SearchBook probe projection when one is available.
 */
@Component
export struct SourceSwitchWindow {
  @StorageLink('readerWindowMetricsRevision') readerWindowMetricsRevision: number = 0;
  @Prop state: SourceSwitchPanelState;
  @Prop currentSourceId: string = '';
  @Prop theme: ReaderAppearanceTheme = 'day';

  private palette(): ReaderThemePalette {
    return readerThemePalette(this.theme);
  }
  onClose: () => void = (): void => {};
  onRetry: () => void = (): void => {};
  onRefresh: () => void = (): void => {};
  onSelectCandidate: (candidate: SourceSwitchCandidate) => void =
    (_candidate: SourceSwitchCandidate): void => {};
  onRollback: () => void = (): void => {};

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    Column({ space: 0 }) {
      this.header();
      this.columnHeader();
      this.body();
      this.footer();
    }
    .width(this.windowWidth())
    .height(this.windowHeight())
    .backgroundColor(this.palette().surface)
    .border({ width: TOK_BORDER_W, color: this.palette().lineStrong })
    .borderRadius(20)
    .translate({ x: this.windowTranslateX(), y: this.windowTranslateY() });
  }

  @Builder
  private header() {
    Column({ space: 0 }) {
      Row() {
        Image($r('app.media.reader_directory_switch'))
          .width(18)
          .height(18)
          .margin({ left: 9 });

        Text('换源')
          .layoutWeight(1)
          .constraintSize({ minWidth: 0 })
          .height(16)
          .fontFamily('ReaderNotoSerifSCRegular')
          .fontWeight(FontWeight.Medium)
          .fontSize(11)
          .lineHeight(12.32)
          .fontColor(this.palette().ink)
          .margin({ left: 7 });

        this.sortPill();

        // Figma SourceSwitch/CloseButton 568:40: 22×22 pill with the exact
        // 20×20 Icon/Close asset, centered inside its 44×44 hit target.
        Stack({ alignContent: Alignment.Center }) {
          Stack({ alignContent: Alignment.Center }) {
            Image($r('app.media.source_switch_close'))
              .width(20)
              .height(20);
          }
          .width(22)
          .height(22)
          .borderRadius(8)
          .backgroundColor(this.palette().disabledBg);
        }
        .width(44)
        .height(44)
        .margin({ left: 1 })
        .onClick((): void => this.onClose());
      }
      .width('100%')
      .height(33)
      .alignItems(VerticalAlign.Center);

      Text('')
        .width(Math.max(0, this.windowWidth() - 1))
        .height(1)
        .backgroundColor(this.palette().borderSoft);
    }
    .width('100%')
    .height(34);
  }

  // Figma SortPillBg 60×20 rgba(155,132,102,0.10) r10 with centered 9px
  // label (text spans 50px, centered on the pill midpoint 225).
  @Builder
  private sortPill() {
    Stack({ alignContent: Alignment.Center }) {
      Text('按延迟排序')
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(9)
        .lineHeight(12)
        .fontColor(this.palette().inkSecondary)
        .textAlign(TextAlign.Center);
    }
    .width(60)
    .height(20)
    .borderRadius(10)
    .backgroundColor(this.palette().surfacePanelSoft)
    .margin({ left: 0 });
  }

  @Builder
  private columnHeader() {
    Row() {
      Text('书源')
        .width(this.sourceHeaderWidth())
        .height(12)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(8)
        .fontColor(this.palette().handle)
        .margin({ left: 10 });

      Text('延迟')
        .width(72)
        .height(12)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(8)
        .fontColor(this.palette().handle);

      Text('当前章节')
        .width(100)
        .height(12)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(8)
        .fontColor(this.palette().handle)
        .textAlign(TextAlign.End);
    }
    .width('100%')
    .height(20)
    .alignItems(VerticalAlign.Center)
    .backgroundColor(this.palette().surfacePanelSoft);
  }

  @Builder
  private body() {
    if (this.state.kind === 'discovering' || this.state.kind === 'switching') {
      this.loadingBody(this.state.kind === 'switching');
    } else if (this.state.kind === 'candidates') {
      this.candidateList();
    } else if (this.state.kind === 'empty') {
      this.messageBody('未找到其他书源', '可检查书源是否启用后重试');
    } else if (this.state.kind === 'discoveryError') {
      this.errorBody(this.state.message);
    } else if (this.state.kind === 'success') {
      this.messageBody('已切换书源', '');
    } else if (this.state.kind === 'failure') {
      this.failureBody(this.state.message, this.state.transactionId !== undefined);
    }
  }

  @Builder
  private loadingBody(isSwitching: boolean) {
    Column({ space: 0 }) {
      Blank().layoutWeight(1);
      LoadingProgress()
        .width(36)
        .height(36)
        .color(this.palette().ink)
        .enableLoading(true);
      Text(isSwitching ? '正在切换书源…' : '正在搜索书源…')
        .margin({ top: 20 })
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(13)
        .lineHeight(20)
        .fontColor(this.palette().inkSecondary)
        .textAlign(TextAlign.Center);
      Blank().layoutWeight(1);
    }
    .width('100%')
    .layoutWeight(1);
  }

  @Builder
  private messageBody(title: string, subtitle: string) {
    Column({ space: 0 }) {
      Blank().layoutWeight(1);
      Text(title)
        .fontFamily('ReaderNotoSerifSCBold')
        .fontWeight(FontWeight.Bold)
        .fontSize(15)
        .lineHeight(22)
        .fontColor(this.palette().ink)
        .textAlign(TextAlign.Center);
      if (subtitle.length > 0) {
        Text(subtitle)
          .margin({ top: TOK_SPACE_XS })
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(11)
          .lineHeight(16)
          .fontColor(this.palette().inkSecondary)
          .textAlign(TextAlign.Center);
      }
      Blank().layoutWeight(1);
    }
    .width('100%')
    .layoutWeight(1);
  }

  @Builder
  private errorBody(message: string) {
    Column({ space: 0 }) {
      Blank().layoutWeight(1);
      Text('书源搜索失败')
        .fontFamily('ReaderNotoSerifSCBold')
        .fontWeight(FontWeight.Bold)
        .fontSize(15)
        .lineHeight(22)
        .fontColor(this.palette().ink)
        .textAlign(TextAlign.Center);
      Text(message)
        .margin({ top: TOK_SPACE_XS })
        .width(this.messageWidth())
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(11)
        .lineHeight(16)
        .fontColor(this.palette().inkSecondary)
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .textAlign(TextAlign.Center);
      Text('重试')
        .margin({ top: 18 })
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(12)
        .lineHeight(12)
        .fontColor(this.palette().inkSecondary)
        .padding({ left: 26, right: 26, top: TOK_SPACE_SM, bottom: TOK_SPACE_SM })
        .backgroundColor(this.palette().surfaceElevated)
        .border({ width: TOK_BORDER_W, color: this.palette().lineStrong })
        .borderRadius(999)
        .onClick((): void => this.onRetry());
      Blank().layoutWeight(1);
    }
    .width('100%')
    .layoutWeight(1);
  }

  @Builder
  private failureBody(message: string, canRollback: boolean) {
    Column({ space: 0 }) {
      Blank().layoutWeight(1);
      Text('换源失败')
        .fontFamily('ReaderNotoSerifSCBold')
        .fontWeight(FontWeight.Bold)
        .fontSize(15)
        .lineHeight(22)
        .fontColor(this.palette().ink)
        .textAlign(TextAlign.Center);
      Text(message)
        .margin({ top: TOK_SPACE_XS })
        .width(this.messageWidth())
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(11)
        .lineHeight(16)
        .fontColor(this.palette().inkSecondary)
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .textAlign(TextAlign.Center);
      if (canRollback) {
        Text('撤销切换')
          .margin({ top: 18 })
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(12)
          .lineHeight(12)
          .fontColor(this.palette().inkSecondary)
          .padding({ left: 26, right: 26, top: TOK_SPACE_SM, bottom: TOK_SPACE_SM })
          .backgroundColor(this.palette().surfaceElevated)
          .border({ width: TOK_BORDER_W, color: this.palette().lineStrong })
          .borderRadius(999)
          .onClick((): void => this.onRollback());
      }
      Blank().layoutWeight(1);
    }
    .width('100%')
    .layoutWeight(1);
  }

  @Builder
  private candidateList() {
    Refresh({ refreshing: this.isRefreshing(), promptText: '正在刷新书源…' }) {
      List({ space: 0 }) {
        Repeat(this.candidates())
          .each((repeatItem: RepeatItem<SourceSwitchCandidate>) => {
            ListItem() {
            CandidateRow({
              sourceId: repeatItem.item.sourceId,
              sourceName: repeatItem.item.sourceName ?? repeatItem.item.sourceId,
              bookName: repeatItem.item.bookName,
              theme: this.theme,
              currentChapterTitle: repeatItem.item.currentChapterTitle ??
                repeatItem.item.latestChapterTitle ?? '',
              latencyMs: repeatItem.item.latencyMs,
              offline: repeatItem.item.offline === true,
              timeout: repeatItem.item.timeout === true,
              isCurrent: repeatItem.item.isCurrent === true,
              onSelect: (): void => this.onSelectCandidate(repeatItem.item),
            });
            }
          })
          .key((candidate: SourceSwitchCandidate): string =>
            sourceSwitchCandidateKey(candidate.sourceId, candidate.bookUrl))
          .virtualScroll({ reusable: true });
      }
      .width('100%')
      .height('100%')
      .scrollBar(BarState.Off);
    }
    .onRefreshing((): void => {
      if (!this.isRefreshing()) {
        this.onRefresh();
      }
    })
    .width('100%')
    .layoutWeight(1)
    .pullToRefresh(true);
  }

  @Builder
  private footer() {
    Text(this.footerText())
      .width('100%')
      .height(22)
      .fontFamily('ReaderInter')
      .fontWeight(FontWeight.Regular)
      .fontSize(8)
      .lineHeight(12)
      .fontColor(this.palette().inkTertiary)
      .textAlign(TextAlign.Center);
  }

  private candidates(): SourceSwitchCandidate[] {
    return this.state.kind === 'candidates' ? this.state.candidates : [];
  }

  private isRefreshing(): boolean {
    return this.state.kind === 'candidates' && this.state.refreshing === true;
  }

  private footerText(): string {
    if (this.state.kind !== 'candidates') {
      return '共 0 个书源';
    }
    if (this.state.refreshError !== undefined && this.state.refreshError.length > 0) {
      return `刷新失败 · 已保留 ${this.state.candidates.length} 个本地记录`;
    }
    return this.state.refreshing === true
      ? `正在刷新 · 已有 ${this.state.candidates.length} 个书源`
      : `共 ${this.state.candidates.length} 个书源`;
  }

  private horizontalFrame(): SurfaceHorizontalFrame {
    const metrics = ReaderWindowCoordinator.metrics();
    return resolveHorizontalFrame(
      this.liveWindowWidth(),
      readerInteractiveSafeLeft(metrics),
      readerInteractiveSafeRight(metrics),
      new SurfaceWidthSpec(300, 0, 0, 'center'),
    );
  }

  private windowWidth(): number {
    return this.horizontalFrame().width;
  }

  private windowHeight(): number {
    const metrics = ReaderWindowCoordinator.metrics();
    const available = Math.max(
      0,
      this.liveWindowHeight() - readerVisualSafeTop(metrics) - readerInteractiveSafeBottom(metrics, true),
    );
    return Math.min(385, available);
  }

  private windowTranslateX(): number {
    const frame = this.horizontalFrame();
    return (frame.left - frame.right) / 2;
  }

  private windowTranslateY(): number {
    const metrics = ReaderWindowCoordinator.metrics();
    const height = this.windowHeight();
    const windowHeight = this.liveWindowHeight();
    const safeTop = readerVisualSafeTop(metrics);
    const safeBottom = readerInteractiveSafeBottom(metrics, true);
    const available = Math.max(0, windowHeight - safeTop - safeBottom);
    const top = safeTop + Math.max(0, (available - height) / 2);
    return top + height / 2 - windowHeight / 2;
  }

  private messageWidth(): number {
    return Math.min(240, Math.max(0, this.windowWidth() - 32));
  }

  private sourceHeaderWidth(): number {
    // Preserve the 107vp Figma column at 300vp while allowing only the name
    // column to contract on a narrower safe window. The trailing 11vp remains
    // the source component's reference right padding.
    return Math.min(107, Math.max(0, this.windowWidth() - 193));
  }

  private liveWindowWidth(): number {
    if (this.readerWindowMetricsRevision < 0) {
      return 0;
    }
    const width = ReaderWindowCoordinator.metrics().windowRect.width;
    return Number.isFinite(width) && width > 0 ? width : 0;
  }

  private liveWindowHeight(): number {
    if (this.readerWindowMetricsRevision < 0) {
      return 0;
    }
    const height = ReaderWindowCoordinator.metrics().windowRect.height;
    return Number.isFinite(height) && height > 0 ? height : 0;
  }
}
