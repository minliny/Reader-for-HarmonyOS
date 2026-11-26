import type { ReaderNavigationPreferences } from '../../../app/HarmonyCapabilityPolicy';
import { defaultNavigationPreferences, ReaderModalScrimModifier } from '../../../ui/surfaces/ReaderSurfaceMaterial';
import { errorMessageOf } from '../../../app/ErrorMessage';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { READER_FONT_NOTO_SANS_SC_UI_BOLD, READER_FONT_NOTO_SANS_SC_UI_MEDIUM,
  READER_FONT_NOTO_SANS_SC_UI_REGULAR } from '../../../ui/foundation/ReaderFontFamilies';
import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { readerReadableFontScale } from '../../../ui/foundation/ReaderSurfaceResolvers';
import { readerWindowMetrics } from '../../../ui/foundation/ReaderWindowEnvironment';
import { readerKeyboardHostBottom } from '../../../ui/layout/ReaderKeyboardGeometry';
import { readerPageAreaLength } from '../../../ui/layout/ReaderPageShell';
import { DialogActionView, ReaderDialogSurface, readerDialogCardTransition,
  readerDialogScrimTransition } from '../../../ui/surfaces/ReaderDialogSurface';
import type { BookSource, SourceCheckOutcome, SourceCheckReport, SourceCheckReportStep } from '../application/SourceGateway';
import type { SourceV9CheckOptions } from '../application/SourceOrchestrator';
import { sourceV9Levels, type SourceV9Depth, type SourceV9Mode } from '../application/SourceV9TransferState';
import { sourceV9CheckStepText, sourceV9LatestReport, sourceV9DiagnosticTone, sourceV9ReportFill } from '../presentation/SourceManagementV9';
import { recordSourceV9Check, runSourceV9Checks, SOURCE_V9_BATCH_CHECK_CONCURRENCY,
  type SourceV9CheckRow } from '../presentation/SourceV9CheckRun';
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
  @StorageProp('readerNavigationAppearancePreferences')
  private appearancePreferences: ReaderNavigationPreferences = defaultNavigationPreferences();
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @StorageLink('readerReduceMotion') private reduceMotion: boolean = false;
  @StorageLink('readerWindowMetricsRevision') private windowRevision: number = 0;
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
  @State private batchTotal: number = 0;
  @State private activeSources: BookSource[] = [];
  @State private stage: string = '';
  @State private paneWidth: number = 0;
  @State private paneHeight: number = 0;
  @State private paneLeft: number = 0;
  @State private paneTop: number = 0;
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
    if (this.drillId.length > 0 && single === undefined) return;
    const sources = single === undefined ? this.sources.slice() : [single];
    if (sources.length === 0) return;
    const generation = ++this.generation;
    const options: SourceV9CheckOptions = { mode: this.mode, levels: sourceV9Levels(this.depth), keyword: this.keyword };
    const current = (): boolean => this.mounted && this.generation === generation;
    this.running = true;
    this.stopped = false;
    this.completed = 0;
    this.runError = '';
    if (single === undefined) {
      this.rows = [];
      this.batchTotal = sources.length;
    }
    this.activeSources = [];
    const parallel = single === undefined && sources.length > 1;
    try {
      await runSourceV9Checks(sources, current, async (source: BookSource): Promise<SourceV9CheckRow> => {
        this.activeSources = this.activeSources.concat([source]);
        this.stage = '';
        try {
          const outcome = await this.onCheck(source.sourceId, options, current,
            (stage: string): void => { if (current() && !parallel) this.stage = stage; });
          return outcome === undefined ? { source, error: '书源已变化或检测暂不可用' } : { source, outcome };
        } catch (error) { return { source, error: errorMessageOf(error) }; }
      }, (row: SourceV9CheckRow): void => {
        this.activeSources = this.activeSources.filter((item: BookSource): boolean => item.sourceId !== row.source.sourceId);
        this.rows = recordSourceV9Check(this.rows, row);
        this.completed += 1;
        if (single !== undefined && row.error !== undefined) this.runError = row.error;
      }, parallel ? SOURCE_V9_BATCH_CHECK_CONCURRENCY : 1);
    } finally {
      if (current()) {
        this.running = false;
        this.activeSources = [];
        this.stage = '';
      }
    }
  }

  private stop(): void {
    this.generation += 1;
    this.running = false;
    this.stopped = true;
    this.activeSources = [];
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
      Stack().width('100%').height('100%')
        .attributeModifier(new ReaderModalScrimModifier(this.appearancePreferences, this.scheme,
          readerAppColor('app.scrim.modal', this.scheme)))
        .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM])
        .accessibilityLevel('no').onClick((): void => this.close());
      Column() {
        Scroll() {
          ReaderDialogSurface({
            specId: 'source-v9-check', containerWidthVp: this.paneWidth,
            title: this.batch && this.drillId.length === 0 ? this.title : '书源检测报告',
            showCloseButton: true, closeEnabled: this.inputEnabled, onClose: (): void => this.close(),
            body: (): void => { this.body(); },
            actions: [
              new DialogActionView('back', this.drillId.length > 0 ? '返回结果' : '关闭', 'default', this.inputEnabled,
                false, 'reader-source-v9-check-close'),
              new DialogActionView('run', this.running ? '停止检测' :
                (this.rows.length > 0 || this.report(this.singleSource()) !== undefined) ? '重新检测' : '开始检测',
              this.running ? 'danger' : 'primary', this.inputEnabled && (this.running || (this.drillId.length > 0 ?
                this.singleSource() !== undefined : this.sources.length > 0)), false, 'reader-source-v9-check-run'),
            ],
            onAction: (action: string): void => {
              if (action === 'back') this.close();
              else if (this.running) this.stop();
              else void this.start();
            },
          });
        }.width('100%').constraintSize({ maxHeight: this.paneHeight > 0 ? this.visibleDialogHeight() : undefined })
          .scrollBar(BarState.Auto).hitTestBehavior(HitTestMode.Transparent)
          .transition(readerDialogCardTransition(this.reduceMotion));
      }.width('100%').height('100%').justifyContent(FlexAlign.Center)
        .padding({ bottom: this.keyboardClearance() }).hitTestBehavior(HitTestMode.Transparent);
    }.width('100%').height('100%')
      .transition(readerDialogScrimTransition(this.reduceMotion))
      .onAreaChange((_old: Area, next: Area): void => this.recordPane(next));
  }

  private recordPane(area: Area): void {
    const width = readerPageAreaLength(area.width);
    const height = readerPageAreaLength(area.height);
    const left = readerPageAreaLength(area.globalPosition.x);
    const top = readerPageAreaLength(area.globalPosition.y);
    if (width > 0) this.paneWidth = width;
    if (height > 0) this.paneHeight = height;
    if (Number.isFinite(left)) this.paneLeft = left;
    if (Number.isFinite(top)) this.paneTop = top;
  }

  private keyboardClearance(): number {
    this.windowRevision;
    const metrics = readerWindowMetrics();
    if (!metrics.ready) return 0;
    return Math.max(0, this.paneHeight - readerKeyboardHostBottom(
      metrics, this.paneTop, this.paneHeight, this.paneLeft, this.paneWidth));
  }

  private visibleDialogHeight(): number {
    return this.paneHeight - this.keyboardClearance();
  }

  private bodyHeight(): number {
    this.windowRevision;
    if (this.paneHeight <= 0) return 400;
    const scale = readerReadableFontScale(readerWindowMetrics().systemFontScale);
    // The outer scroll keeps the actions reachable when the keyboard leaves too little room for the full card.
    return Math.max(72, Math.min(500, this.visibleDialogHeight() - Math.max(150, 100 * scale)));
  }

  @Builder
  private body() {
    Scroll() {
      Column({ space: 9 }) {
        if (this.singleSource() !== undefined) {
          Text(this.singleSource()?.name ?? '').fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM)
            .fontSize(14).width('100%').maxLines(1)
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
            .width('100%').height(38).borderRadius(10)
            .border({ width: 1, color: readerAppColor('TOK_LINE_STRONG', this.scheme) })
            .cancelButton({ style: CancelButtonStyle.INPUT })
            .enabled(!this.running && this.inputEnabled)
            .onChange((keyword: string): void => { this.keyword = keyword; });
          Text('留空时使用书源自带测试词或「我的」').width('100%').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR)
            .fontSize(11).fontColor(readerAppColor('TOK_MUTED', this.scheme));
          Row({ space: 6 }) {
            ForEach(QUICK_WORDS, (word: string): void => {
              this.choice(word);
            }, (word: string): string => word);
          }.width('100%');
        }
        if (this.running || this.stopped || this.completed > 0) this.progress();
        if (this.runError.length > 0) ReaderPageState({ variant: 'inline', message: this.runError, padded: false });
        if (this.singleSource() !== undefined) {
          SourceV9ReportSteps({ report: this.report(this.singleSource()),
            currentFailure: this.outcome(this.singleSource())?.failureReason,
            activeStage: this.running ? this.stage : '' });
        }
        else if (this.drillId.length > 0 || !this.batch) {
          ReaderPageState({ variant: 'inline', message: '此书源已不在当前列表', padded: false });
        } else this.batchRows();
      }.width('100%').alignItems(HorizontalAlign.Start);
    }.width('100%').constraintSize({ maxHeight: this.bodyHeight() }).scrollBar(BarState.Auto)
      .nestedScroll({ scrollForward: NestedScrollMode.SELF_FIRST, scrollBackward: NestedScrollMode.SELF_FIRST });
  }

  @Builder
  private choice(word: string) {
    Button(word, { type: ButtonType.Capsule, stateEffect: false }).height(32).padding({ left: 9, right: 9 })
      .fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM).fontSize(12)
      .fontColor(readerAppColor(word === this.keyword ? 'app.sourceUi.onPrimary' : 'TOK_INK', this.scheme))
      .attributeModifier(new ReaderPressFeedback(
        readerAppColor(word === this.keyword ? 'app.sourceUi.primary' : 'app.sourceUi.field', this.scheme),
        this.scheme, 16, 16, !this.running && this.inputEnabled))
      .responseRegion({ y: -6, height: 44 })
      .accessibilitySelected(word === this.keyword).enabled(!this.running && this.inputEnabled)
      .onClick((): void => {
        if (!this.running && this.inputEnabled) this.keyword = word === this.keyword ? '' : word;
      });
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
    return this.batch && this.drillId.length === 0 ? (this.batchTotal || this.sources.length) : 1;
  }

  private progressLabel(): string {
    const total = this.checkTotal();
    if (this.running) {
      const count = this.activeSources.length;
      const source = count > 0 ? ' · ' + this.activeSources[0].name : '';
      const others = count > 1 ? ` 等 ${count} 个` : '';
      const stage = this.stage.length > 0 ? ' · ' + this.stage : '';
      return `检测中 ${this.completed + count}/${total}${source}${others}${stage}`;
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
  private batchRows() {
    Column() {
      ForEach(this.rows, (row: SourceV9CheckRow, index: number): void => {
        Button({ type: ButtonType.Normal, stateEffect: false }) {
          Row({ space: 8 }) {
            Row().width(8).height(8).borderRadius(4).backgroundColor(sourceV9ReportFill(sourceV9DiagnosticTone(row.outcome?.report), this.scheme) ??
              readerAppColor('app.sourceUi.muted', this.scheme)).accessibilityLevel('no');
            Text(row.source.name).layoutWeight(1).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
              .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontSize(13).fontColor(readerAppColor('TOK_INK', this.scheme));
            Text(row.outcome === undefined ? '未取得报告' : row.outcome.available ? '通过' : '未通过')
              .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontSize(11)
              .fontColor(readerAppColor(row.outcome?.available ? 'TOK_PRIMARY_TEXT' : 'TOK_MUTED', this.scheme));
            Image(this.scheme === 'night' ? $r('app.media.reader_chevron_right_theme_night') :
              $r('app.media.reader_chevron_right')).width(14).height(14).accessibilityLevel('no');
          }.width('100%');
        }.width('100%').height(44).padding({ left: 10, right: 10 })
          .attributeModifier(new ReaderPressFeedback(readerAppColor('TOK_CARD_BG', this.scheme),
            this.scheme, 0, 0, !this.running && this.inputEnabled))
          .border({ width: { bottom: index === this.rows.length - 1 ? 0 : 1 },
            color: readerAppColor('TOK_LINE', this.scheme) })
          .enabled(!this.running && this.inputEnabled)
          .onClick((): void => {
            if (!this.mounted || this.running || !this.inputEnabled || this.drillId.length > 0) return;
            const current = this.rows.find((item: SourceV9CheckRow): boolean =>
              item.source.sourceId === row.source.sourceId);
            if (current === undefined) return;
            this.batchReturn = { mode: this.mode, depth: this.depth, keyword: this.keyword,
              completed: this.completed, stopped: this.stopped };
            this.drillId = current.source.sourceId;
            this.runError = current.error ?? '';
            this.stopped = false;
            this.completed = 0;
            this.mode = 'search';
            this.depth = 'L2';
            this.keyword = '';
            this.restoreOptions(this.singleSource());
          });
      }, (row: SourceV9CheckRow): string => JSON.stringify([row.source.sourceId, row.source.name, row.outcome?.available,
        row.outcome?.traceId, row.outcome?.report?.traceId, row.outcome?.durationMs, row.outcome?.failureReason,
        row.outcome?.report?.steps, row.error]));
    }.width('100%').borderRadius(14).clip(true);
  }
}

@Component
export struct SourceV9ReportSteps {
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @Prop report: SourceCheckReport | undefined = undefined;
  @Prop currentFailure: string | undefined = undefined;
  @Prop activeStage: string = '';

  private stepFor(level: string): SourceCheckReportStep | undefined {
    return this.report?.steps.find((step: SourceCheckReportStep): boolean => step.level === level);
  }

  build() {
    Column() {
      ForEach(STAGES, (stage: SourceV9CheckChoice): void => {
        this.step(stage, this.stepFor(stage.value));
      }, (stage: SourceV9CheckChoice): string => JSON.stringify([stage.value, this.stepFor(stage.value)]));
    }.width('100%').backgroundColor(readerAppColor('TOK_CARD_BG', this.scheme))
      .borderRadius(14).border({ width: 1, color: readerAppColor('TOK_LINE', this.scheme) });
  }

  @Builder
  private step(stage: SourceV9CheckChoice, step: SourceCheckReportStep | undefined) {
    Row({ space: 8 }) {
      Text(stage.value).width(29).height(24).borderRadius(6).textAlign(TextAlign.Center)
        .fontFamily(READER_FONT_NOTO_SANS_SC_UI_BOLD).fontSize(11)
        .fontColor(readerAppColor(step?.status === 'fail' ? 'app.sourceUi.danger' :
          step?.status === 'pass' ? 'TOK_PRIMARY_TEXT' : 'TOK_MUTED', this.scheme))
        .backgroundColor(readerAppColor(step?.status === 'fail' ? 'app.sourceUi.dangerSurface' :
          step?.status === 'pass' ? 'TOK_PRIMARY_SOFT' : 'app.sourceUi.field', this.scheme));
      Column({ space: 2 }) {
        Text(stage.title).width('100%').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontSize(13)
          .fontColor(readerAppColor('TOK_INK', this.scheme));
        Text(this.activeStage === stage.value ? '正在检测…' : sourceV9CheckStepText(step, this.currentFailure))
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
}
