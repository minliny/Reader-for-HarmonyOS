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
} from '../common/ReaderTokens';

import { registerReaderFonts } from '../common/ReaderFonts';

/**
 * SourceSwitch overlay window state (Window State 7态, SS-SOURCE-SWITCH-01).
 * `candidates` is the only state with a Figma V2 drawing (SourceSwitch/Window,
 * Phone 943:15215 / Tablet 943:15705 — both mount the same 568:656 window
 * instance); the remaining result states are the code-side definition of
 * switching / success / failure / discovery failure, following the app's
 * existing loading/error idioms. The owning Index drives every transition via
 * a real gateway.
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
    .backgroundColor('#FFFCF8')
    .border({ width: TOK_BORDER_W, color: '#3D9B8466' })
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

        // Close: Figma SourceSwitch/CloseButton — visible 22×22 pill
        // rgba(238,230,219,0.42) r8 centered inside a 44×44 hit target
        // (ActionId sourceSwitch.close). No close glyph asset exists, so the
        // Tabler x is approximated with the '✕' glyph.
        Stack({ alignContent: Alignment.Center }) {
          Stack({ alignContent: Alignment.Center }) {
            Text('✕')
              .fontSize(14)
              .fontColor('#8D8378');
          }
          .width(22)
          .height(22)
          .borderRadius(8)
          .backgroundColor('#6BEEE6DB');
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
        .fontColor('#8D8378')
        .textAlign(TextAlign.Center);
    }
    .width(60)
    .height(20)
    .borderRadius(10)
    .backgroundColor('#1A9B8466')
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
    .backgroundColor('#0D9B8466');
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
        .border({ width: 0.5, color: TOK_BORDER })
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
          .border({ width: 0.5, color: TOK_BORDER })
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
      .fontColor('#C8BFB5')
      .textAlign(TextAlign.Center);
  }

  private candidates(): SourceSwitchCandidate[] {
    return this.state.kind === 'candidates' ? this.state.candidates : [];
  }

  private count(): number {
    return this.state.kind === 'candidates' ? this.state.candidates.length : 0;
  }
}