import type { SourceSwitchCandidate } from '../source/SourceSwitchGateway';

/**
 * Source-switch overlay state. `candidates` is the only state with a Figma
 * V2 drawing (SourceSwitch/Window 3572:41345); the remaining result states
 * are the code-side definition of SS-SOURCE-SWITCH-01 (switching / success /
 * failure / discovery failure), following the app's existing loading/error
 * idioms. The owning Index drives every transition via a real gateway.
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
 * Presentational overlay for the source-switch window. Figma `3572:41345`
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
    const font = this.getUIContext().getFont();
    font.registerFont({
      familyName: 'ReaderNotoSerifSCRegular',
      familySrc: $rawfile('NotoSerifSC-Regular.ttf'),
    });
    font.registerFont({
      familyName: 'ReaderNotoSerifSCBold',
      familySrc: $rawfile('NotoSerifSC-Bold.ttf'),
    });
    font.registerFont({
      familyName: 'ReaderInter',
      familySrc: $rawfile('InterVariable.ttf'),
    });
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
    Stack({ alignContent: Alignment.TopStart }) {
      Image($r('app.media.reader_directory_switch'))
        .width(18)
        .height(18)
        .position({ x: 9, y: 8 });

      Text('换源')
        .width(120)
        .height(16)
        .fontFamily('ReaderNotoSerifSCRegular')
        .fontWeight(FontWeight.Medium)
        .fontSize(11)
        .fontColor('#332C25')
        .position({ x: 34, y: 10.5 });

      Text('按延迟排序')
        .width(60)
        .height(20)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(9)
        .lineHeight(12)
        .fontColor('#8D8378')
        .textAlign(TextAlign.Center)
        .backgroundColor('#1A9B8466')
        .borderRadius(10)
        .position({ x: 195, y: 7 });

      // Close target: 22×22 pill centered inside a 44×44 interaction target
      // (Figma SourceSwitch/CloseButton, ActionId sourceSwitch.close).
      Stack({ alignContent: Alignment.Center }) {
        Text('✕')
          .fontSize(14)
          .fontColor('#8D8378');
      }
      .width(44)
      .height(44)
      .position({ x: 256, y: -5 })
      .onClick((): void => this.onClose());

      Text('')
        .width(300)
        .height(1)
        .backgroundColor('#2E9B8466')
        .position({ x: 0, y: 33.5 });
    }
    .width(300)
    .height(34);
  }

  @Builder
  private columnHeader() {
    Stack({ alignContent: Alignment.TopStart }) {
      Text('书源')
        .width(107)
        .height(12)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(8)
        .fontColor('#B9AD9F')
        .position({ x: 10, y: 4 });

      Text('延迟')
        .width(72)
        .height(12)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(8)
        .fontColor('#B9AD9F')
        .position({ x: 117, y: 4 });

      Text('当前章节')
        .width(100)
        .height(12)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(8)
        .fontColor('#B9AD9F')
        .textAlign(TextAlign.End)
        .position({ x: 190, y: 4 });
    }
    .width(300)
    .height(20)
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
        .fontColor('#756F69')
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
        .fontColor('#1F1B17')
        .textAlign(TextAlign.Center);
      if (subtitle.length > 0) {
        Text(subtitle)
          .margin({ top: 8 })
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(11)
          .lineHeight(16)
          .fontColor('#756F69')
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
        .fontColor('#1F1B17')
        .textAlign(TextAlign.Center);
      Text(message)
        .margin({ top: 8 })
        .width(240)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(11)
        .lineHeight(16)
        .fontColor('#756F69')
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .textAlign(TextAlign.Center);
      Text('重试')
        .margin({ top: 18 })
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(12)
        .lineHeight(12)
        .fontColor('#756F69')
        .padding({ left: 26, right: 26, top: 12, bottom: 12 })
        .backgroundColor('#E6FFFCF8')
        .border({ width: 0.5, color: '#C1C7CD' })
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
        .fontColor('#1F1B17')
        .textAlign(TextAlign.Center);
      Text(message)
        .margin({ top: 8 })
        .width(240)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(11)
        .lineHeight(16)
        .fontColor('#756F69')
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
          .fontColor('#756F69')
          .padding({ left: 26, right: 26, top: 12, bottom: 12 })
          .backgroundColor('#E6FFFCF8')
          .border({ width: 0.5, color: '#C1C7CD' })
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
    Stack({ alignContent: Alignment.TopStart }) {
      Text('')
        .width(5)
        .height(5)
        .borderRadius(2.5)
        .backgroundColor(this.dotColor(candidate))
        .position({ x: 10, y: 11.5 });

      Text(candidate.bookName)
        .width(110)
        .height(15)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Medium)
        .fontSize(10)
        .lineHeight(12)
        .fontColor(this.nameColor(candidate))
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .position({ x: 21, y: 6.5 });

      Text(this.latencyText(candidate))
        .width(28)
        .height(10)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(9)
        .lineHeight(10)
        .fontColor(this.latencyColor(candidate))
        .textAlign(TextAlign.End)
        .position({ x: 157, y: 9 });

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
        .position({ x: 190, y: 9 });
    }
    .width(300)
    .height(28)
    .backgroundColor(this.rowBackground(candidate))
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
    const kind = this.candidateKind(candidate);
    if (kind === 'current') {
      return '#2A7A5A';
    }
    if (kind === 'offline') {
      return '#C8BFB5';
    }
    return '#2B241D';
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
      return '#B9AD9F';
    }
    return '#5B5046';
  }
}
