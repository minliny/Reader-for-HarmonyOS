import { ReaderBoundedSurface } from '../common/ReaderBoundedSurface';
import { ReaderBoundedSurfaceHeader } from '../common/ReaderBoundedSurfaceHeader';
import { TYPE_APP_LOADING_BODY, TYPE_SOURCE_STATE_TITLE, TYPE_SOURCE_SWITCH_COLUMN, TYPE_SOURCE_SWITCH_FOOTER, TYPE_SOURCE_SWITCH_HEADING, TYPE_SOURCE_SWITCH_MESSAGE, TYPE_SOURCE_SWITCH_RECOVERY, TYPE_SOURCE_SWITCH_SORT } from '../common/ReaderTypography';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { CandidateRow } from './CandidateRow';
import { sourceSwitchCandidateKey, sourceSwitchSourceCount } from './SourceSwitchGateway';
import type { SourceSwitchCandidate } from './SourceSwitchGateway';
import {
  TOK_BORDER,
  TOK_BORDER_W,
  TOK_CARD_BG,
  TOK_INK,
  TOK_LINE,
  TOK_MUTED,
  TOK_READ_HANDLE,
  TOK_READ_INK,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
  TOK_SS_CLOSE_BG,
  TOK_SS_COLUMN_HEADER_BG,
  TOK_SS_FOOTER_TEXT,
  TOK_SS_MUTED,
  TOK_SS_SORT_PILL_BG,
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
import { PopupSurfaceSpec, resolvePopupSpec } from '../common/ReaderSurfaceSpecs';

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
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @StorageLink('readerWindowMetricsRevision') readerWindowMetricsRevision: number = 0;
  @Prop state: SourceSwitchPanelState;
  @Prop currentSourceId: string = '';
  onClose: () => void = (): void => {};
  onRetry: () => void = (): void => {};
  onRefresh: () => void = (): void => {};
  onSelectCandidate: (candidate: SourceSwitchCandidate) => void =
    (_candidate: SourceSwitchCandidate): void => {};
  onRollback: () => void = (): void => {};

  private surfaceSpec(): PopupSurfaceSpec {
    return resolvePopupSpec('source-switch-window');
  }

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    ReaderBoundedSurface({ specId: 'source-switch-window', width: this.windowWidth(), height: this.windowHeight(),
      header: this.header, body: this.windowBody, actions: this.footer })
      .translate({ x: this.windowTranslateX(), y: this.windowTranslateY() });
  }

  @Builder
  private header() {
    ReaderBoundedSurfaceHeader({ specId: 'source-switch-window', title: '换源', width: this.windowWidth(),
      accessory: this.sortPill, onClose: (): void => this.onClose() });
  }

  @Builder
  private windowBody() { this.columnHeader(); this.body(); }

  // Figma SortPillBg 60×20 rgba(155,132,102,0.10) r10 with centered 9px
  // label (text spans 50px, centered on the pill midpoint 225).
  @Builder
  private sortPill() {
    Stack({ alignContent: Alignment.Center }) {
      Text('按延迟排序')
        .fontFamily(TYPE_SOURCE_SWITCH_SORT.fontFamily)
        .fontWeight(TYPE_SOURCE_SWITCH_SORT.fontWeight)
        .fontSize(TYPE_SOURCE_SWITCH_SORT.fontSizeFp)
        .lineHeight(TYPE_SOURCE_SWITCH_SORT.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_SS_MUTED', this.appThemeScheme))
        .textAlign(TextAlign.Center);
    }
    .width(60)
    .height(20)
    .borderRadius(10)
    .backgroundColor(readerAppColor('TOK_SS_SORT_PILL_BG', this.appThemeScheme))
    .margin({ left: 0 });
  }

  @Builder
  private columnHeader() {
    Row() {
      Text('书源')
        .width(this.sourceHeaderWidth())
        .height(12)
        .fontFamily(TYPE_SOURCE_SWITCH_COLUMN.fontFamily)
        .fontWeight(TYPE_SOURCE_SWITCH_COLUMN.fontWeight)
        .fontSize(TYPE_SOURCE_SWITCH_COLUMN.fontSizeFp)
        .fontColor(readerAppColor('TOK_READ_HANDLE', this.appThemeScheme))
        .margin({ left: 10 });

      Text('延迟')
        .width(72)
        .height(12)
        .fontFamily(TYPE_SOURCE_SWITCH_COLUMN.fontFamily)
        .fontWeight(TYPE_SOURCE_SWITCH_COLUMN.fontWeight)
        .fontSize(TYPE_SOURCE_SWITCH_COLUMN.fontSizeFp)
        .fontColor(readerAppColor('TOK_READ_HANDLE', this.appThemeScheme));

      Text('当前章节')
        .width(100)
        .height(12)
        .fontFamily(TYPE_SOURCE_SWITCH_COLUMN.fontFamily)
        .fontWeight(TYPE_SOURCE_SWITCH_COLUMN.fontWeight)
        .fontSize(TYPE_SOURCE_SWITCH_COLUMN.fontSizeFp)
        .fontColor(readerAppColor('TOK_READ_HANDLE', this.appThemeScheme))
        .textAlign(TextAlign.End);
    }
    .width('100%')
    .height(20)
    .alignItems(VerticalAlign.Center)
    .backgroundColor(readerAppColor('TOK_SS_COLUMN_HEADER_BG', this.appThemeScheme));
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
        .color(readerAppColor('TOK_READ_INK', this.appThemeScheme))
        .enableLoading(true);
      Text(isSwitching ? '正在切换书源…' : '正在搜索书源…')
        .margin({ top: 20 })
        .fontFamily(TYPE_APP_LOADING_BODY.fontFamily)
        .fontWeight(TYPE_APP_LOADING_BODY.fontWeight)
        .fontSize(TYPE_APP_LOADING_BODY.fontSizeFp)
        .lineHeight(TYPE_APP_LOADING_BODY.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
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
        .fontFamily(TYPE_SOURCE_STATE_TITLE.fontFamily)
        .fontWeight(TYPE_SOURCE_STATE_TITLE.fontWeight)
        .fontSize(TYPE_SOURCE_STATE_TITLE.fontSizeFp)
        .lineHeight(TYPE_SOURCE_STATE_TITLE.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .textAlign(TextAlign.Center);
      if (subtitle.length > 0) {
        Text(subtitle)
          .margin({ top: TOK_SPACE_XS })
          .fontFamily(TYPE_SOURCE_SWITCH_MESSAGE.fontFamily)
          .fontWeight(TYPE_SOURCE_SWITCH_MESSAGE.fontWeight)
          .fontSize(TYPE_SOURCE_SWITCH_MESSAGE.fontSizeFp)
          .lineHeight(TYPE_SOURCE_SWITCH_MESSAGE.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
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
        .fontFamily(TYPE_SOURCE_STATE_TITLE.fontFamily)
        .fontWeight(TYPE_SOURCE_STATE_TITLE.fontWeight)
        .fontSize(TYPE_SOURCE_STATE_TITLE.fontSizeFp)
        .lineHeight(TYPE_SOURCE_STATE_TITLE.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .textAlign(TextAlign.Center);
      Text(message)
        .margin({ top: TOK_SPACE_XS })
        .width(this.messageWidth())
        .fontFamily(TYPE_SOURCE_SWITCH_MESSAGE.fontFamily)
        .fontWeight(TYPE_SOURCE_SWITCH_MESSAGE.fontWeight)
        .fontSize(TYPE_SOURCE_SWITCH_MESSAGE.fontSizeFp)
        .lineHeight(TYPE_SOURCE_SWITCH_MESSAGE.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .textAlign(TextAlign.Center);
      Text('重试')
        .margin({ top: 18 })
        .fontFamily(TYPE_SOURCE_SWITCH_RECOVERY.fontFamily)
        .fontWeight(TYPE_SOURCE_SWITCH_RECOVERY.fontWeight)
        .fontSize(TYPE_SOURCE_SWITCH_RECOVERY.fontSizeFp)
        .lineHeight(TYPE_SOURCE_SWITCH_RECOVERY.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
        .padding({ left: 26, right: 26, top: TOK_SPACE_SM, bottom: TOK_SPACE_SM })
        .backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme))
        .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
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
        .fontFamily(TYPE_SOURCE_STATE_TITLE.fontFamily)
        .fontWeight(TYPE_SOURCE_STATE_TITLE.fontWeight)
        .fontSize(TYPE_SOURCE_STATE_TITLE.fontSizeFp)
        .lineHeight(TYPE_SOURCE_STATE_TITLE.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .textAlign(TextAlign.Center);
      Text(message)
        .margin({ top: TOK_SPACE_XS })
        .width(this.messageWidth())
        .fontFamily(TYPE_SOURCE_SWITCH_MESSAGE.fontFamily)
        .fontWeight(TYPE_SOURCE_SWITCH_MESSAGE.fontWeight)
        .fontSize(TYPE_SOURCE_SWITCH_MESSAGE.fontSizeFp)
        .lineHeight(TYPE_SOURCE_SWITCH_MESSAGE.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .textAlign(TextAlign.Center);
      if (canRollback) {
        Text('撤销切换')
          .margin({ top: 18 })
          .fontFamily(TYPE_SOURCE_SWITCH_RECOVERY.fontFamily)
          .fontWeight(TYPE_SOURCE_SWITCH_RECOVERY.fontWeight)
          .fontSize(TYPE_SOURCE_SWITCH_RECOVERY.fontSizeFp)
          .lineHeight(TYPE_SOURCE_SWITCH_RECOVERY.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
          .padding({ left: 26, right: 26, top: TOK_SPACE_SM, bottom: TOK_SPACE_SM })
          .backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme))
          .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
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
              acquisitionState: repeatItem.item.acquisitionState,
              acquisitionMessage: repeatItem.item.acquisitionMessage,
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
      .fontFamily(TYPE_SOURCE_SWITCH_FOOTER.fontFamily)
      .fontWeight(TYPE_SOURCE_SWITCH_FOOTER.fontWeight)
      .fontSize(TYPE_SOURCE_SWITCH_FOOTER.fontSizeFp)
      .lineHeight(TYPE_SOURCE_SWITCH_FOOTER.lineHeightFp as number)
      .fontColor(readerAppColor('TOK_SS_FOOTER_TEXT', this.appThemeScheme))
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
    const sourceCount = sourceSwitchSourceCount(this.state.candidates);
    return this.state.refreshing === true
      ? `正在刷新 · 已有 ${sourceCount} 个书源`
      : `共 ${sourceCount} 个书源`;
  }

  private horizontalFrame(): SurfaceHorizontalFrame {
    const metrics = ReaderWindowCoordinator.metrics();
    return resolveHorizontalFrame(
      this.liveWindowWidth(),
      readerInteractiveSafeLeft(metrics),
      readerInteractiveSafeRight(metrics),
      new SurfaceWidthSpec(this.surfaceSpec().width, 0, 0, 'center'),
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
    return Math.min(this.surfaceSpec().height, available);
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
