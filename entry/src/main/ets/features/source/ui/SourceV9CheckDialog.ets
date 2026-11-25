import { errorMessageOf } from '../../../app/ErrorMessage';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { READER_FONT_NOTO_SANS_SC_UI_REGULAR } from '../../../ui/foundation/ReaderFontFamilies';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { DialogActionView, ReaderDialogSurface } from '../../../ui/surfaces/ReaderDialogSurface';
import type { BookSource, SourceCheckOutcome, SourceCheckReport, SourceCheckReportStep } from '../application/SourceGateway';
import type { SourceV9CheckOptions } from '../application/SourceOrchestrator';
import { sourceV9Levels, type SourceV9Depth, type SourceV9Mode } from '../application/SourceV9TransferState';
import { sourceV9CheckStepText, sourceV9LatestReport, sourceV9DiagnosticTone, sourceV9ReportFill } from '../presentation/SourceManagementV9';
import { recordSourceV9Check, runSourceV9Checks, type SourceV9CheckRow } from '../presentation/SourceV9CheckRun';
import { SourceV9SegmentedTrack, type SourceV9SegmentChoice } from './SourceV9Chrome';

interface SourceV9CheckChoice {
  value: string;
  title: string;
}

interface SourceV9BatchReturn {
  mode: SourceV9Mode;
  depth: SourceV9Depth;
  keyword: string;
  completed: number;
  stopped: boolean;
}

const MODES: SourceV9SegmentChoice[] = [{ id: 'search', label: '搜索' }, { id: 'explore', label: '发现' }];
const DEPTHS: SourceV9SegmentChoice[] = [
  { id: 'L2', label: 'L2 快速' }, { id: 'L4', label: 'L4 目录' }, { id: 'L5', label: 'L5 正文' },
];
const STAGES: SourceV9CheckChoice[] = [
  { value: 'L1', title: '规则校验' }, { value: 'L2', title: '搜索 / 发现' }, { value: 'L3', title: '书籍详情' },
  { value: 'L4', title: '目录' }, { value: 'L5', title: '正文' },
];
const QUICK_WORDS: string[] = ['我的', '斗破', '海贼'];

@Component
export struct SourceV9CheckDialog {
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @Prop sources: BookSource[] = [];
  @Prop title: string = '批量检测';
  @Prop batch: boolean = false;
  @Prop inputEnabled: boolean = true;
  onCheck: (id: string, options: SourceV9CheckOptions, current: () => boolean,
    onStage: (stage: string) => void) => Promise<SourceCheckOutcome | undefined> =
      (): Promise<SourceCheckOutcome | undefined> => Promise.resolve(undefined);
  onClose: () => void = (): void => {};
  @State private mode: SourceV9Mode = 'search';
  @State private depth: SourceV9Depth = 'L2';
  @State private keyword: string = '';
  @State private drillId: string = '';
  @State private rows: SourceV9CheckRow[] = [];
  @State private running: boolean = false;
  @State private stopped: boolean = false;
  @State private completed: number = 0;
  @State private currentName: string = '';
  @State private stage: string = '';
  @State private paneWidth: number = 0;
  @State private bodyHeight: number = 400;
  @State private runError: string = '';
  private batchReturn: SourceV9BatchReturn | undefined = undefined;
  private generation: number = 0;
  private mounted: boolean = false;

  aboutToAppear(): void {
    this.mounted = true;
    this.restoreOptions(this.singleSource());
    this.onTemporaryBackBridge((): boolean => this.consumeBack());
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.generation += 1;
    this.onTemporaryBackBridge(undefined);
  }

  private singleSource(): BookSource | undefined {
    if (this.drillId.length > 0) return this.sources.find((source: BookSource): boolean => source.sourceId === this.drillId);
    return !this.batch && this.sources.length === 1 ? this.sources[0] : undefined;
  }

  private report(source: BookSource | undefined): SourceCheckReport | undefined {
    if (source === undefined) return undefined;
    return this.outcome(source)?.report ?? sourceV9LatestReport(source);
  }

  private outcome(source: BookSource | undefined): SourceCheckOutcome | undefined {
    if (source === undefined) return undefined;
    return this.rows.find((row: SourceV9CheckRow): boolean => row.source.sourceId === source.sourceId)?.outcome;
  }

  private restoreOptions(source: BookSource | undefined): void {
    const report = this.report(source);
    if (report === undefined) return;
    this.mode = report.mode === 'explore' ? 'explore' : 'search';
    this.depth = report.steps.some((step: SourceCheckReportStep): boolean => step.level === 'L5' && step.requested) ? 'L5' :
      report.steps.some((step: SourceCheckReportStep): boolean => step.level === 'L4' && step.requested) ? 'L4' : 'L2';
  }

  private async start(): Promise<void> {
    if (this.running || !this.mounted || !this.inputEnabled) return;
    const single = this.singleSource();
    const sources = single === undefined ? this.sources.slice() : [single];
    if (sources.length === 0) return;
    const generation = ++this.generation;
    const options: SourceV9CheckOptions = { mode: this.mode, levels: sourceV9Levels(this.depth), keyword: this.keyword };
    const current = (): boolean => this.mounted && this.generation === generation;
    this.running = true;
    this.stopped = false;
    this.completed = 0;
    this.runError = '';
    if (single === undefined) this.rows = [];
    try {
      await runSourceV9Checks(sources, current, async (source: BookSource): Promise<SourceV9CheckRow> => {
        this.currentName = source.name;
        this.stage = '';
        try {
          const outcome = await this.onCheck(source.sourceId, options, current,
            (stage: string): void => { if (current()) this.stage = stage; });
          return outcome === undefined ? { source, error: '书源已变化或检测暂不可用' } : { source, outcome };
        } catch (error) { return { source, error: errorMessageOf(error) }; }
      }, (row: SourceV9CheckRow): void => {
        this.rows = recordSourceV9Check(this.rows, row);
        this.completed += 1;
        if (single !== undefined && row.error !== undefined) this.runError = row.error;
      });
    } finally {
      if (current()) {
        this.running = false;
        this.currentName = '';
        this.stage = '';
      }
    }
  }

  private stop(): void {
    this.generation += 1;
    this.running = false;
    this.stopped = true;
    this.currentName = '';
    this.stage = '';
  }

  private close(): void {
    if (!this.mounted || !this.inputEnabled) return;
    if (this.running) this.stop();
    if (this.drillId.length > 0) {
      const parent = this.batchReturn;
      this.drillId = '';
      this.runError = '';
      this.batchReturn = undefined;
      if (parent !== undefined) {
        this.mode = parent.mode;
        this.depth = parent.depth;
        this.keyword = parent.keyword;
        this.stopped = parent.stopped;
        this.completed = parent.completed;
      }
    } else this.onClose();
  }

  consumeBack(): boolean {
    this.close();
    return true;
  }

  // Rebind the temporary Back action while the result dialog is present.
  onTemporaryBackBridge: (handler: (() => boolean) | undefined) => void = (): void => {};

  build() {
    Stack({ alignContent: Alignment.Center }) {
      Column().width('100%').height('100%')
        .backgroundColor(readerAppColor('app.scrim.modal', this.scheme)).onClick((): void => this.close());
      ReaderDialogSurface({
        specId: 'source-v9-check', containerWidthVp: this.paneWidth, title: this.singleSource() === undefined ? this.title : '书源检测报告',
        showCloseButton: true, onClose: (): void => this.close(),
        body: (): void => { this.body(); },
        actions: [
          new DialogActionView('back', this.drillId.length > 0 ? '返回结果' : '关闭', 'default', this.inputEnabled,
            false, 'reader-source-v9-check-close'),
          new DialogActionView('run', this.running ? '停止检测' :
            (this.rows.length > 0 || this.report(this.singleSource()) !== undefined) ? '重新检测' : '开始检测',
          this.running ? 'danger' : 'primary', this.inputEnabled, false, 'reader-source-v9-check-run'),
        ],
        onAction: (action: string): void => {
          if (action === 'back') this.close();
          else if (this.running) this.stop();
          else void this.start();
        },
      });
    }.width('100%').height('100%')
      .onAreaChange((_old: Area, next: Area): void => {
        const width = typeof next.width === 'number' ? next.width : Number.parseFloat(next.width.toString());
        if (Number.isFinite(width) && width > 0) this.paneWidth = width;
        const height = typeof next.height === 'number' ? next.height : Number.parseFloat(next.height.toString());
        if (Number.isFinite(height) && height > 0) this.bodyHeight = Math.max(80, Math.min(500, height - 150));
      });
  }

  @Builder
  private body() {
    Scroll() {
      Column({ space: 9 }) {
        if (this.singleSource() !== undefined) {
          Text(this.singleSource()?.name ?? '').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR)
            .fontWeight(FontWeight.Medium).fontSize(14).width('100%').maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis }).fontColor(readerAppColor('TOK_INK', this.scheme));
        }
        SourceV9SegmentedTrack({ choices: MODES, selected: this.mode, actionEnabled: !this.running && this.inputEnabled,
          accessibilityLabel: '检测模式', idPrefix: 'reader-source-v9-check-mode',
          onSelect: (id: string): void => { this.mode = id as SourceV9Mode; } });
        SourceV9SegmentedTrack({ choices: DEPTHS, selected: this.depth, actionEnabled: !this.running && this.inputEnabled,
          accessibilityLabel: '检测深度', idPrefix: 'reader-source-v9-check-depth',
          onSelect: (id: string): void => { this.depth = id as SourceV9Depth; } });
        if (this.mode === 'search') {
          TextInput({ text: this.keyword, placeholder: '自定义测试词' })
            .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontSize(13)
            .fontColor(readerAppColor('TOK_INK', this.scheme)).backgroundColor(readerAppColor('app.sourceUi.field', this.scheme))
            .width('100%').height(38).borderRadius(10).enabled(!this.running && this.inputEnabled)
            .onChange((keyword: string): void => { this.keyword = keyword; });
          Text('留空时使用书源自带测试词或「我的」').width('100%').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR)
            .fontSize(11).fontColor(readerAppColor('TOK_MUTED', this.scheme));
          Row({ space: 6 }) {
            ForEach(QUICK_WORDS, (word: string): void => {
              this.choice(word, word === this.keyword, false, (): void => { this.keyword = word; });
            }, (word: string): string => word);
          }.width('100%');
        }
        if (this.running || this.stopped || this.completed > 0) this.progress();
        if (this.runError.length > 0) ReaderPageState({ variant: 'inline', message: this.runError, padded: false });
        if (this.singleSource() !== undefined) {
          this.reportSteps(this.report(this.singleSource()), this.outcome(this.singleSource())?.failureReason);
        }
        else this.batchRows();
      }.width('100%').alignItems(HorizontalAlign.Start);
    }.width('100%').constraintSize({ maxHeight: this.bodyHeight }).scrollBar(BarState.Auto);
  }

  @Builder
  private choice(title: string, selected: boolean, stretch: boolean, choose: () => void) {
    Button(title, { type: ButtonType.Capsule }).height(32).layoutWeight(stretch ? 1 : undefined).padding({ left: 9, right: 9 })
      .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontSize(12).fontWeight(FontWeight.Medium)
      .fontColor(readerAppColor(selected ? 'TOK_ON_PRIMARY' : 'TOK_INK', this.scheme))
      .backgroundColor(selected ? readerAppColor('app.sourceUi.primary', this.scheme) :
        readerAppColor('app.sourceUi.field', this.scheme))
      .accessibilitySelected(selected).enabled(!this.running && this.inputEnabled).onClick(choose);
  }

  @Builder
  private progress() {
    Column({ space: 4 }) {
      Text(this.progressLabel())
        .width('100%').maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
        .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontSize(12).fontColor(readerAppColor('TOK_INK', this.scheme));
      if (this.singleSource() === undefined && this.completed > 0) {
        Text(this.batchProgressCounts()).width('100%').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR)
          .fontSize(11).fontColor(readerAppColor('TOK_MUTED', this.scheme));
      }
      Progress({ value: this.completed, total: this.checkTotal(), type: ProgressType.Linear })
        .width('100%').color(readerAppColor('app.sourceUi.primary', this.scheme))
        .accessibilityText(`已完成 ${this.completed} 项检测，共 ${this.checkTotal()} 项`);
    }.width('100%');
  }

  private checkTotal(): number {
    return this.singleSource() === undefined ? this.sources.length : 1;
  }

  private progressLabel(): string {
    const total = this.checkTotal();
    if (this.running) {
      const source = this.currentName.length > 0 ? ' · ' + this.currentName : '';
      const stage = this.stage.length > 0 ? ' · ' + this.stage : '';
      return `检测中 ${Math.min(this.completed + 1, total)}/${total}${source}${stage}`;
    }
    return `${this.stopped ? '已停止检测' : '本轮检测结束'} · ${this.completed}/${total}`;
  }

  private batchProgressCounts(): string {
    const passed = this.rows.filter((row: SourceV9CheckRow): boolean => row.outcome?.available === true).length;
    const failed = this.rows.filter((row: SourceV9CheckRow): boolean => row.outcome?.available === false).length;
    const unavailable = this.rows.length - passed - failed;
    return `通过 ${passed} · 失败 ${failed}` + (unavailable > 0 ? ` · 未取得报告 ${unavailable}` : '');
  }

  @Builder
  private reportSteps(report: SourceCheckReport | undefined, currentFailure?: string) {
    Column() {
      ForEach(STAGES, (stage: SourceV9CheckChoice): void => {
        this.step(stage, report?.steps.find((step: SourceCheckReportStep): boolean => step.level === stage.value), currentFailure);
      }, (stage: SourceV9CheckChoice): string => stage.value);
    }.width('100%').backgroundColor(readerAppColor('TOK_CARD_BG', this.scheme))
      .borderRadius(14).border({ width: 1, color: readerAppColor('TOK_LINE', this.scheme) });
  }

  @Builder
  private step(stage: SourceV9CheckChoice, step: SourceCheckReportStep | undefined, currentFailure?: string) {
    Row({ space: 8 }) {
      Text(stage.value).width(29).height(24).borderRadius(6).textAlign(TextAlign.Center)
        .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontSize(11).fontWeight(FontWeight.Bold)
        .fontColor(readerAppColor(step?.status === 'fail' ? 'app.sourceUi.danger' :
          step?.status === 'pass' ? 'TOK_PRIMARY_TEXT' : 'TOK_MUTED', this.scheme))
        .backgroundColor(readerAppColor(step?.status === 'fail' ? 'app.sourceUi.dangerSurface' :
          step?.status === 'pass' ? 'TOK_PRIMARY_SOFT' : 'app.sourceUi.field', this.scheme));
      Column({ space: 2 }) {
        Text(stage.title).width('100%').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontSize(13)
          .fontColor(readerAppColor('TOK_INK', this.scheme));
        Text(this.stage === stage.value && this.running ? '正在检测…' : sourceV9CheckStepText(step, currentFailure))
          .width('100%').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontSize(11)
          .fontColor(readerAppColor('TOK_MUTED', this.scheme));
      }.layoutWeight(1);
      if (step?.executed) {
        Text(`${step.durationMs} ms`).fontSize(11).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR)
          .fontColor(readerAppColor('TOK_MUTED', this.scheme));
      }
    }.width('100%').padding({ left: 10, right: 10, top: 7, bottom: 7 })
      .border({ width: { top: stage.value === 'L1' ? 0 : 1 }, color: readerAppColor('TOK_LINE', this.scheme) });
  }

  @Builder
  private batchRows() {
    Column() {
      ForEach(this.rows, (row: SourceV9CheckRow): void => {
        Button({ type: ButtonType.Normal }) {
          Row({ space: 8 }) {
            Circle().width(8).height(8).fill(sourceV9ReportFill(sourceV9DiagnosticTone(row.outcome?.report), this.scheme) ??
              readerAppColor('app.sourceUi.muted', this.scheme)).accessibilityLevel('no');
            Text(row.source.name).layoutWeight(1).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
              .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontSize(13).fontColor(readerAppColor('TOK_INK', this.scheme));
            Text(row.outcome === undefined ? '未取得报告' : row.outcome.available ? '通过' : '未通过')
              .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontSize(11)
              .fontColor(readerAppColor(row.outcome?.available ? 'TOK_PRIMARY_TEXT' : 'TOK_MUTED', this.scheme));
            Image(this.scheme === 'night' ? $r('app.media.source_group_chevron_theme_night') :
              $r('app.media.source_group_chevron')).width(14).height(14).accessibilityLevel('no');
          }.width('100%');
        }.width('100%').height(44).borderRadius(0).padding({ left: 10, right: 10 })
          .backgroundColor(readerAppColor('TOK_CARD_BG', this.scheme))
          .border({ width: { bottom: 1 }, color: readerAppColor('TOK_LINE', this.scheme) })
          .enabled(!this.running && this.inputEnabled)
          .onClick((): void => {
            this.batchReturn = { mode: this.mode, depth: this.depth, keyword: this.keyword,
              completed: this.completed, stopped: this.stopped };
            this.drillId = row.source.sourceId;
            this.runError = row.error ?? '';
            this.stopped = false;
            this.completed = 0;
            this.mode = 'search';
            this.depth = 'L2';
            this.keyword = '';
            this.restoreOptions(this.singleSource());
          });
      }, (row: SourceV9CheckRow): string => row.source.sourceId);
    }.width('100%').borderRadius(14).clip(true);
  }
}
