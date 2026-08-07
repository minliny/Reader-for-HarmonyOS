import type { SourceSwitchCandidate } from '../source/SourceSwitchGateway';
import {
  TOK_BORDER,
  TOK_CARD_BG,
  TOK_INK,
  TOK_LINE,
  TOK_MUTED,
  TOK_READ_HANDLE,
  TOK_READ_INK,
  TOK_READ_MUTED,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
} from '../common/ReaderTokens';

import { registerReaderFonts } from '../common/ReaderFonts';

/**
 * Source-switch overlay state. `candidates` is the only state with a Figma
 * V2 drawing (SourceSwitch/Window, Phone 943:15215 / Tablet 943:15705 — both
 * mount the same 568:656 window instance); the remaining result states are the
 * code-side definition of SS-SOURCE-SWITCH-01 (switching / success / failure /
 * discovery failure), following the app's existing loading/error idioms. The
 * owning Index drives every transition via a real gateway.
 *
 * Rebuilt 2026-08-05 against live Figma: window 300×385 r20 border 0.556
 * #3D9B8466; 34px header (switch icon 18px @9,8, "换源" @34,9, 60×20 sort pill
 * @195,7 + centered 9px label, 22×22 close pill rgba(238,230,219,0.42) r8
 * inside a 44×44 hit target, divider @33); 20px column header (bg
 * rgba(155,132,102,0.05), labels 书源/延迟/当前章节); 28px candidate rows with
 * 5px status dot @10,11.5, 96px name @21,6.5, 36×3 latency bar @117,12.5
 * (data-driven fill, empty today) + right-aligned 延迟 text ending @185, 100px
 * right-aligned 当前章节 text ending @289, and a 1px rgba(155,132,102,0.18)
 * row divider; 22px footer. Latency and current-chapter columns render "—"
 * today because `change.bookSource` candidates carry no such data.
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

type SourceSwitchRowKind = 'current' | 'available' | 'offline' | 'timeout';

/**
 * Presentational overlay for the source-switch window. Figma `568:656`
 * (Window 300×385: 34px header, 20px column header, 28px candidate rows,
 * 22px footer). Candidate rows switch directly on tap — no confirmation
 * footer. Latency and current-chapter columns render "—" today because
 * `change.bookSource` candidates carry no such data.
 */
@Component
export struct SourceSwitchPanel {
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
    .border({ width: 0.556, color: '#3D9B8466' })
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
          this.candidateRow(candidate);
        },
        (candidate: SourceSwitchCandidate): string => candidate.sourceId);
    }
    .width('100%')
    .layoutWeight(1)
    .scrollBar(BarState.Off);
  }

  @Builder
  private candidateRow(candidate: SourceSwitchCandidate) {
    Row() {
      Text('')
        .width(5)
        .height(5)
        .borderRadius(2.5)
        .backgroundColor(this.dotColor(candidate))
        .margin({ left: 10 });

      Text(candidate.bookName)
        .width(96)
        .height(15)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Medium)
        .fontSize(10)
        .lineHeight(12)
        .fontColor(this.nameColor(candidate))
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .margin({ left: 6 });

      // Figma LatencyBar: 36×3 track rgba(155,132,102,0.18) r1.5 at
      // (117,12.5). The fill width is data-driven from `latencyMs`; candidates
      // carry no latency today so the track renders empty (consistent with the
      // "—" placeholder).
      Stack({ alignContent: Alignment.TopStart }) {
        Text('')
          .width(36)
          .height(3)
          .borderRadius(1.5)
          .backgroundColor(TOK_LINE);
        Text('')
          .width(this.latencyBarFillWidth(candidate))
          .height(3)
          .borderRadius(1.5)
          .backgroundColor(this.dotColor(candidate));
      }
      .width(36)
      .height(3);

      Text(this.latencyText(candidate))
        .width(28)
        .height(10)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(9)
        .lineHeight(10)
        .fontColor(this.latencyColor(candidate))
        .textAlign(TextAlign.End)
        .margin({ left: 4 });

      Text(this.chapterText(candidate))
        .width(100)
        .height(10)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Medium)
        .fontSize(9)
        .lineHeight(10)
        .fontColor(this.chapterColor(candidate))
        .textAlign(TextAlign.End)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .margin({ left: 4 });
    }
    .width(300)
    .height(28)
    .alignItems(VerticalAlign.Center)
    .backgroundColor(this.rowBackground(candidate))
    .border({ width: { bottom: 1 }, color: TOK_LINE })
    .onClick((): void => {
      if (this.candidateKind(candidate) === 'available') {
        this.onSelectCandidate(candidate);
      }
    });
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

  private candidateKind(candidate: SourceSwitchCandidate): SourceSwitchRowKind {
    if (candidate.sourceId === this.currentSourceId) {
      return 'current';
    }
    if (candidate.offline === true) {
      return 'offline';
    }
    if (candidate.timeout === true) {
      return 'timeout';
    }
    return 'available';
  }

  private rowBackground(candidate: SourceSwitchCandidate): string {
    return this.candidateKind(candidate) === 'current' ? '#142D4A3E' : '#00000000';
  }

  private nameColor(candidate: SourceSwitchCandidate): string {
    // Figma: only the current row is green; every other row (available /
    // offline / timeout) uses the ink #2B241D.
    return this.candidateKind(candidate) === 'current' ? '#2A7A5A' : '#2B241D';
  }

  private dotColor(candidate: SourceSwitchCandidate): string {
    const kind = this.candidateKind(candidate);
    if (kind === 'current') {
      return '#2A7A5A';
    }
    if (kind === 'offline') {
      return '#C8BFB5';
    }
    if (kind === 'timeout') {
      return '#B04020';
    }
    return '#C08020';
  }

  private latencyText(candidate: SourceSwitchCandidate): string {
    const kind = this.candidateKind(candidate);
    if (kind === 'offline') {
      return '离线';
    }
    if (kind === 'timeout') {
      return '超时';
    }
    return candidate.latencyMs === undefined ? '—' : `${candidate.latencyMs}ms`;
  }

  private latencyColor(candidate: SourceSwitchCandidate): string {
    const kind = this.candidateKind(candidate);
    if (kind === 'current') {
      return '#2A7A5A';
    }
    if (kind === 'offline') {
      return '#C8BFB5';
    }
    if (kind === 'timeout') {
      return '#C05030';
    }
    return '#C08020';
  }

  private latencyBarFillWidth(candidate: SourceSwitchCandidate): number {
    const kind = this.candidateKind(candidate);
    if (kind === 'offline' || kind === 'timeout') {
      return 0;
    }
    const latency = candidate.latencyMs;
    if (latency === undefined) {
      return 0;
    }
    // 36px track; linear ms→px scale (≈5.4px @27ms … 36px cap).
    return Math.min(36, Math.round(latency / 5));
  }

  private chapterText(_candidate: SourceSwitchCandidate): string {
    // `change.bookSource` candidates carry no per-source chapter; render "—"
    // until a data contract exists (user decision 2026-08-05).
    return '—';
  }

  private chapterColor(candidate: SourceSwitchCandidate): string {
    const kind = this.candidateKind(candidate);
    if (kind === 'offline') {
      return '#C8BFB5';
    }
    if (kind === 'timeout') {
      return TOK_READ_HANDLE;
    }
    return TOK_READ_MUTED;
  }
}
