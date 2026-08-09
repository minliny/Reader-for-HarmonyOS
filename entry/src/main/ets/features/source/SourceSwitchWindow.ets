import { CandidateRow } from './CandidateRow';
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
  TOK_SS_WINDOW_BG,
  TOK_SS_WINDOW_BORDER,
} from '../common/ReaderTokens';

import { registerReaderFonts } from '../common/ReaderFonts';

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
  rollbackToken?: string;
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
 * render "—" today because `change.bookSource` candidates carry no such data.
 */
@Component
export struct SourceSwitchWindow {
  @Prop state: SourceSwitchPanelState;
  @Prop currentSourceId: string = '';
  @Prop isTablet: boolean = false;
  onClose: () => void = (): void => {};
  onRetry: () => void = (): void => {};
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
    .width(300)
    .height(385)
    .backgroundColor(TOK_SS_WINDOW_BG)
    .border({ width: TOK_BORDER_W, color: TOK_SS_WINDOW_BORDER })
    .borderRadius(20);
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
          .width(120)
          .height(16)
          .fontFamily('ReaderNotoSerifSCRegular')
          .fontWeight(FontWeight.Medium)
          .fontSize(11)
          .lineHeight(12.32)
          .fontColor(TOK_READ_INK)
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
          .backgroundColor(TOK_SS_CLOSE_BG);
        }
        .width(44)
        .height(44)
        .margin({ left: 1 })
        .onClick((): void => this.onClose());
      }
      .width(300)
      .height(33)
      .alignItems(VerticalAlign.Center);

      Text('')
        .width(299)
        .height(1)
        .backgroundColor(TOK_LINE);
    }
    .width(300)
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
        .fontColor(TOK_SS_MUTED)
        .textAlign(TextAlign.Center);
    }
    .width(60)
    .height(20)
    .borderRadius(10)
    .backgroundColor(TOK_SS_SORT_PILL_BG)
    .margin({ left: 41 });
  }

  @Builder
  private columnHeader() {
    Row() {
      Text('书源')
        .width(107)
        .height(12)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(8)
        .fontColor(TOK_READ_HANDLE)
        .margin({ left: 10 });

      Text('延迟')
        .width(72)
        .height(12)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(8)
        .fontColor(TOK_READ_HANDLE);

      Text('当前章节')
        .width(100)
        .height(12)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(8)
        .fontColor(TOK_READ_HANDLE)
        .textAlign(TextAlign.End);
    }
    .width(300)
    .height(20)
    .alignItems(VerticalAlign.Center)
    .backgroundColor(TOK_SS_COLUMN_HEADER_BG);
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
      this.failureBody(this.state.message, this.state.rollbackToken !== undefined);
    }
  }

  @Builder
  private loadingBody(isSwitching: boolean) {
    Column({ space: 0 }) {
      Blank().layoutWeight(1);
      Image($r('app.media.importing_spinner_track')).width(36).height(36);
      Image($r('app.media.importing_spinner_arc')).width(36).height(36);
      Text(isSwitching ? '正在切换书源…' : '正在搜索书源…')
        .margin({ top: 20 })
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(13)
        .lineHeight(20)
        .fontColor(TOK_MUTED)
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
        .fontColor(TOK_INK)
        .textAlign(TextAlign.Center);
      if (subtitle.length > 0) {
        Text(subtitle)
          .margin({ top: TOK_SPACE_XS })
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(11)
          .lineHeight(16)
          .fontColor(TOK_MUTED)
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
        .fontColor(TOK_INK)
        .textAlign(TextAlign.Center);
      Text(message)
        .margin({ top: TOK_SPACE_XS })
        .width(240)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(11)
        .lineHeight(16)
        .fontColor(TOK_MUTED)
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .textAlign(TextAlign.Center);
      Text('重试')
        .margin({ top: 18 })
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(12)
        .lineHeight(12)
        .fontColor(TOK_MUTED)
        .padding({ left: 26, right: 26, top: TOK_SPACE_SM, bottom: TOK_SPACE_SM })
        .backgroundColor(TOK_CARD_BG)
        .border({ width: TOK_BORDER_W, color: TOK_BORDER })
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
        .fontColor(TOK_INK)
        .textAlign(TextAlign.Center);
      Text(message)
        .margin({ top: TOK_SPACE_XS })
        .width(240)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(11)
        .lineHeight(16)
        .fontColor(TOK_MUTED)
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
          .fontColor(TOK_MUTED)
          .padding({ left: 26, right: 26, top: TOK_SPACE_SM, bottom: TOK_SPACE_SM })
          .backgroundColor(TOK_CARD_BG)
          .border({ width: TOK_BORDER_W, color: TOK_BORDER })
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
    List({ space: 0 }) {
      ForEach(this.candidates(),
        (candidate: SourceSwitchCandidate): void => {
          CandidateRow({
            sourceId: candidate.sourceId,
            bookName: candidate.bookName,
            latencyMs: candidate.latencyMs,
            offline: candidate.offline === true,
            timeout: candidate.timeout === true,
            currentSourceId: this.currentSourceId,
            onSelect: (): void => this.onSelectCandidate(candidate),
          });
        },
        (candidate: SourceSwitchCandidate): string => candidate.sourceId);
    }
    .width('100%')
    .layoutWeight(1)
    .scrollBar(BarState.Off);
  }

  @Builder
  private footer() {
    Text(`共 ${this.count()} 个书源`)
      .width(300)
      .height(22)
      .fontFamily('ReaderInter')
      .fontWeight(FontWeight.Regular)
      .fontSize(8)
      .lineHeight(12)
      .fontColor(TOK_SS_FOOTER_TEXT)
      .textAlign(TextAlign.Center);
  }

  private candidates(): SourceSwitchCandidate[] {
    return this.state.kind === 'candidates' ? this.state.candidates : [];
  }

  private count(): number {
    return this.state.kind === 'candidates' ? this.state.candidates.length : 0;
  }
}
