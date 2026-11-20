import { ReaderPageScaffold } from '../../../entry/src/main/ets/features/common/ReaderPageScaffold';
import { ReaderMeasurementStore } from '../../../entry/src/main/ets/features/common/ReaderMeasurements';
import { ReaderPageGeometry, ReaderPageGeometryInput, resolveReaderPageGeometry } from '../../../entry/src/main/ets/features/common/ReaderPageGeometry';
import { ReaderFrameStyle, readerFrameStyle } from '../../../entry/src/main/ets/features/common/ReaderFrameStyle';
import { readerScrollLayout, readerScrollStartOffset, readerScrollEndOffset } from '../../../entry/src/main/ets/features/common/ReaderScrollLayout';
import { registerReaderFonts } from '../../../entry/src/main/ets/features/common/ReaderFonts';
import { PageBackBar } from '../../../entry/src/main/ets/features/common/PageBackBar';
import { ReaderButton } from '../../../entry/src/main/ets/features/common/ReaderButton';
import { ReaderFormField } from '../../../entry/src/main/ets/features/common/ReaderFormField';
import { ReaderSearchField } from '../../../entry/src/main/ets/features/common/ReaderSearchField';
import { ReaderChoiceRow } from '../../../entry/src/main/ets/features/common/ReaderChoiceRow';
import { ReaderBoundedSurface } from '../../../entry/src/main/ets/features/common/ReaderBoundedSurface';
import { ReaderBoundedSurfaceHeader } from '../../../entry/src/main/ets/features/common/ReaderBoundedSurfaceHeader';
import { ReaderPageState } from '../../../entry/src/main/ets/features/common/ReaderPageState';
import { ReaderRecoveryNotice } from '../../../entry/src/main/ets/features/common/ReaderRecoveryNotice';
import { ReaderTransientFeedback } from '../../../entry/src/main/ets/features/common/ReaderTransientFeedback';
import { MESSAGE_BODY, MESSAGE_META, MESSAGE_TITLE } from '../../../entry/src/main/ets/features/common/ReaderMessageStyle';
import { readerAppColor } from '../../../entry/src/main/ets/features/common/ReaderThemeRegistry';
import { readerSheetWidth, readerSheetChrome } from '../../../entry/src/main/ets/features/common/ReaderSheetChrome';
import { readerVisualSafeLeft, readerVisualSafeRight } from '../../../entry/src/main/ets/features/common/ReaderWindowMetrics';
import { readerPageAreaLength, readerPageContentStartInset, readerStandardPageSpec } from '../../../entry/src/main/ets/features/common/ReaderPageShell';
import { readerFloatingBarBottomInset } from '../../../entry/src/main/ets/features/common/ReaderFloatingBarMetrics';
import { ReaderWindowCoordinator } from '../../../entry/src/main/ets/app/ReaderWindowCoordinator';
import { emptySourceImportSnapshot, sourceImportGroupLabel, type SourceImportSnapshot,
  type SourceImportIntent, type SourceImportMethod, type SourceImportRow } from '../../../entry/src/main/ets/features/source/SourceImportModel';
import type { SourceGroupRecord, SourceImportGroupStrategy } from '../../../entry/src/main/ets/features/source/SourceGroupTypes';
import { sourceGroupNameError } from '../../../entry/src/main/ets/features/source/SourceGroupManagementModel';

let sourceImportTemporarySequence: number = 0;

class SourceImportPageDataSource implements IDataSource {
  private rows: SourceImportRow[] = [];
  private listeners: DataChangeListener[] = [];
  totalCount(): number { return this.rows.length; }
  getData(index: number): SourceImportRow { return this.rows[index]; }
  registerDataChangeListener(listener: DataChangeListener): void { if (!this.listeners.includes(listener)) this.listeners.push(listener); }
  unregisterDataChangeListener(listener: DataChangeListener): void {
    const index = this.listeners.indexOf(listener); if (index >= 0) this.listeners.splice(index, 1);
  }
  replace(rows: SourceImportRow[]): void {
    this.rows = rows; this.listeners.forEach((listener: DataChangeListener): void => listener.onDataReloaded());
  }
}
class SourceImportTargetDataSource implements IDataSource {
  private rows: SourceGroupRecord[] = [];
  private listeners: DataChangeListener[] = [];
  totalCount(): number { return this.rows.length; }
  getData(index: number): SourceGroupRecord { return this.rows[index]; }
  registerDataChangeListener(listener: DataChangeListener): void { if (!this.listeners.includes(listener)) this.listeners.push(listener); }
  unregisterDataChangeListener(listener: DataChangeListener): void {
    const index = this.listeners.indexOf(listener); if (index >= 0) this.listeners.splice(index, 1);
  }
  replace(rows: SourceGroupRecord[]): void {
    this.rows = rows; this.listeners.forEach((listener: DataChangeListener): void => listener.onDataReloaded());
  }
}

/** Import presentation only. Reads, fixed DTOs, group policy and original
 * write confirmation remain with SourceImportOwner. */
@Component
export struct SourceImportPage {
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') private metricsRevision: number = 0;
  @Prop @Watch('snapshotChanged') snapshot: SourceImportSnapshot = emptySourceImportSnapshot();
  @Prop expandedLayout: boolean = false;
  @Prop reduceMotion: boolean = false;
  onBack: () => void = (): void => {};
  onIntent: (intent: SourceImportIntent) => void = (_intent: SourceImportIntent): void => {};
  onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string) => void =
    (_handler: (() => boolean) | undefined, _identity: string): void => {};
  private mounted: boolean = false;
  private temporaryIdentity: string = '';
  private readonly feedback: ReaderTransientFeedback = new ReaderTransientFeedback();
  private lastFeedback: string = '';
  @State private footerHeight: number = 120;
  @State private viewportWidth: number = 0;
  @State private measurementRevision: number = 0;
  @State private recoveryHeight: number = 0;
  @State private visibleRowCount: number = 0;
  private readonly measurements: ReaderMeasurementStore = new ReaderMeasurementStore();
  private readonly rows: SourceImportPageDataSource = new SourceImportPageDataSource();
  private readonly targetRows: SourceImportTargetDataSource = new SourceImportTargetDataSource();
  @State private targetOpen: boolean = false;
  @State @Watch('targetQueryChanged') private targetQuery: string = '';
  @State private draftName: string = '';
  private targetGeneration: number = 0;

  aboutToAppear(): void {
    this.mounted = true;
    registerReaderFonts(this.getUIContext().getFont());
    this.rows.replace(this.snapshot.rows); this.visibleRowCount = this.snapshot.rows.length;
    const identity = `source-import-back:${++sourceImportTemporarySequence}`;
    this.temporaryIdentity = identity;
    this.onTemporaryBackBridge((): boolean => this.consumeBack(identity), identity);
  }
  aboutToDisappear(): void {
    this.mounted = false; this.feedback.reset();
    this.targetGeneration += 1; this.targetOpen = false;
    this.onTemporaryBackBridge(undefined, this.temporaryIdentity); this.temporaryIdentity = '';
  }
  private snapshotChanged(): void {
    if (this.snapshot.error.length === 0) this.lastFeedback = '';
    this.rows.replace(this.snapshot.rows); this.visibleRowCount = this.snapshot.rows.length;
    if (this.targetOpen) this.targetRows.replace(this.targetGroups());
    if (!this.blocked()) this.recoveryHeight = 0;
    if (!this.mounted || this.snapshot.error.length === 0 || this.snapshot.rows.length === 0 || this.lastFeedback === this.snapshot.error) return;
    const generation = this.snapshot.generation;
    this.lastFeedback = this.snapshot.error;
    this.feedback.show((): UIContext => this.getUIContext(), { message: this.snapshot.error, key: `source-import:${generation}` },
      (): boolean => this.mounted && this.snapshot.generation === generation);
  }
  private blocked(): boolean { return this.snapshot.original?.blocked === true || this.snapshot.original?.confirmation === 'unknown'; }
  private targetQueryChanged(): void { this.targetRows.replace(this.targetGroups()); }
  private locked(): boolean {
    return this.snapshot.busy || this.snapshot.original?.busy === true || this.snapshot.original?.blocked === true || this.snapshot.original?.confirmation === 'unknown';
  }
  private send(intent: SourceImportIntent): void { if (this.mounted) this.onIntent(intent); }
  private consumeBack(identity: string): boolean {
    if (!this.mounted || identity !== this.temporaryIdentity) return false;
    if (this.targetOpen) { this.closeTarget(); return true; }
    if (this.snapshot.stage === 'preview' && !this.locked()) { this.send({ kind: 'newDocument' }); return true; }
    return false;
  }
  private back(): void {
    if (!this.consumeBack(this.temporaryIdentity) && this.mounted) this.onBack();
  }
  private title(): string {
    return this.snapshot.stage === 'input' ? '导入书源' : this.snapshot.stage === 'preview' ? '导入预览' : '导入结果';
  }
  private frameStyle(): ReaderFrameStyle {
    const paper = readerAppColor('TOK_PAPER', this.scheme);
    return readerFrameStyle({ backgroundColor: paper,
      headerBackground: readerAppColor('TOK_SURFACE_SOLID', this.scheme), footerBackground: paper });
  }
  private geometry(): ReaderPageGeometry {
    const metrics = ReaderWindowCoordinator.metrics();
    const input = new ReaderPageGeometryInput(metrics);
    input.viewportWidth = this.viewportWidth; input.measurementRevision = this.measurementRevision;
    input.headerHeight = this.measurements.read('source-import:header', readerPageContentStartInset());
    input.footerHeight = this.footerHeight;
    input.contentGap = 8 + (this.blocked() ? this.recoveryHeight : 0);
    input.contentEndInset = this.footerHeight + 16;
    input.contentMaxWidth = readerStandardPageSpec('sourceManagement').maxWidth;
    input.contentHorizontalPadding = 20;
    return resolveReaderPageGeometry(input);
  }
  build() {
    ReaderPageScaffold({ frameStyle: this.frameStyle(), geometry: this.geometry(),
      headerMeasurementKey: this.metricsRevision, footerMeasurementKey: this.metricsRevision,
      header: (): void => { PageBackBar({ title: this.title(), onBack: (): void => this.back() }); },
      content: (): void => { this.content(); }, footer: (): void => { this.footer(); },
      overlayContent: (): void => { this.recoveryOverlay(); },
      onHeaderHeightChange: (height: number, generation: number): void => {
        if (this.measurements.record('source-import:header', height, generation)) this.measurementRevision += 1;
      }, onFooterHeightChange: (height: number): void => { if (Math.abs(height - this.footerHeight) > .1) this.footerHeight = height; }
    }).onAreaChange((_old: Area, next: Area): void => {
      const width = readerPageAreaLength(next.width);
      if (Number.isFinite(width) && width > 0 && Math.abs(width - this.viewportWidth) > .1) this.viewportWidth = width;
    });
  }
  @Builder private heading(label: string) {
    Text(label).fontFamily(MESSAGE_TITLE.fontFamily).fontSize(MESSAGE_TITLE.fontSizeFp)
      .fontWeight(MESSAGE_TITLE.fontWeight).fontColor(readerAppColor('TOK_INK', this.scheme)).width('100%');
  }
  @Builder private hint(label: string) {
    Text(label).fontFamily(MESSAGE_META.fontFamily).fontSize(MESSAGE_META.fontSizeFp)
      .lineHeight(MESSAGE_META.lineHeightFp as number).fontColor(readerAppColor('TOK_MUTED', this.scheme)).width('100%');
  }
  @Builder private content() {
    List() {
      ListItem() {
        Column({ space: 16 }) {
          if (this.snapshot.stage === 'input') this.inputContent();
          else this.previewContent();
        }.width('100%').alignItems(HorizontalAlign.Start).padding({ top: 12, bottom: 16 });
      }
      if (this.snapshot.stage !== 'input' && this.visibleRowCount > 0) {
        LazyForEach(this.rows, (row: SourceImportRow): void => {
          ListItem() { this.importRow(row); }
        }, (row: SourceImportRow): string => `source-import:${row.index}:${row.sourceId}:${row.status}:${row.selected}:${row.finalGroup}:${this.locked()}`);
      }
    }.width('100%').height('100%')
      .padding({ left: this.geometry().content.frame.left, right: this.geometry().content.frame.right })
      .contentStartOffset(readerScrollStartOffset(readerScrollLayout(this.geometry(), { mode: 'contentOffset' })))
      .contentEndOffset(readerScrollEndOffset(readerScrollLayout(this.geometry(), { mode: 'contentOffset' }))).scrollBar(BarState.Auto);
  }
  @Builder private recoveryOverlay() {
    if (this.blocked()) {
      Column() { this.originalNotice(); }.width(this.geometry().content.frame.width)
        .margin({ left: this.geometry().content.frame.left, top: this.geometry().header.bottom + 8 })
        .onAreaChange((_old: Area, next: Area): void => {
          const height = readerPageAreaLength(next.height);
          if (Number.isFinite(height) && Math.abs(height - this.recoveryHeight) > .1) this.recoveryHeight = height;
        });
    }
  }
  @Builder private originalNotice() {
    if (this.snapshot.original?.blocked || this.snapshot.original?.confirmation === 'unknown') {
      ForEach([this.snapshot.original?.generation ?? 0], (generation: number): void => {
        ReaderRecoveryNotice({ view: { visible: true, canRetry: true, generation,
          message: this.snapshot.original?.message || '原导入操作仍需核对。' },
          actionLabel: this.snapshot.original?.method === 'source.import.grouped' ? '核对' : '返回书源管理',
          secondaryActionLabel: this.snapshot.original?.method === 'source.import.grouped' && this.snapshot.original?.canRetryOriginal ? '继续原操作' : '',
          busy: this.snapshot.busy,
          onReconcile: (value: number): void => {
            if (!this.mounted || value !== this.snapshot.original?.generation) return;
            if (this.snapshot.original?.method === 'source.import.grouped') this.send({ kind: 'reconcile' }); else this.onBack();
          },
          onSecondaryAction: (value: number): void => {
            if (this.mounted && value === this.snapshot.original?.generation && this.snapshot.original?.canRetryOriginal)
              this.send({ kind: 'continueOriginal' });
          } });
      }, (generation: number): string => `source-import-original:${generation}`);
    }
  }
  @Builder private methodButton(method: SourceImportMethod, label: string) {
    ReaderButton({ scheme: this.scheme, specId: 'rules-compact', label, primary: this.snapshot.method === method,
      actionEnabled: !this.locked(), onAction: (): void => this.send({ kind: 'method', value: method }) }).layoutWeight(1);
  }
  @Builder private inputContent() {
    Row({ space: 8 }) {
      this.methodButton('local', '本地文件'); this.methodButton('url', '在线链接');
    }.width('100%');
    Row({ space: 8 }) {
      this.methodButton('paste', '粘贴 JSON'); this.methodButton('subscription', '订阅拉取');
    }.width('100%');
    if (this.snapshot.method === 'local') {
      this.hint('选择设备中的 Legado 书源 JSON，读取后先核对条目与分组。');
    } else if (this.snapshot.method === 'url' || this.snapshot.method === 'subscription') {
      this.heading(this.snapshot.method === 'subscription' ? '订阅地址' : '书源 JSON 链接');
      if (this.snapshot.method === 'subscription') this.hint('仅拉取这一次，预览确认后导入。已有订阅及刷新计划请前往“管理已有订阅”。');
      ReaderFormField({ scheme: this.scheme, specId: 'form-url', text: this.snapshot.url,
        placeholder: 'https://example.com/books.json', fieldAccessibilityLabel: this.snapshot.method === 'subscription' ? '本次拉取的订阅 JSON 地址' : '在线书源 JSON 链接', isEditable: !this.locked(),
        onTextChange: (value: string): void => this.send({ kind: 'url', value }) });
      this.hint('GitHub 文件请使用 Raw 链接。');
    } else {
      this.heading('书源 JSON');
      ReaderFormField({ scheme: this.scheme, specId: 'source-code', text: this.snapshot.text,
        placeholder: '粘贴单个书源对象或书源数组', fieldAccessibilityLabel: '粘贴书源 JSON', isEditable: !this.locked(),
        onTextChange: (value: string): void => this.send({ kind: 'text', value }) });
    }
    if (this.snapshot.error.length > 0) {
      ReaderPageState({ message: this.snapshot.error, padded: false });
    }
    if (this.snapshot.busy) ReaderPageState({ loading: true, message: this.snapshot.method === 'subscription' ? '正在拉取书源…' : '正在读取书源…', padded: false });
    ReaderButton({ scheme: this.scheme, specId: 'search-error-source', label: '管理已有订阅', actionEnabled: !this.locked(),
      onAction: (): void => this.send({ kind: 'subscriptions' }) });
  }
  @Builder private strategyChoice(value: SourceImportGroupStrategy, label: string, detail: string) {
    Column({ space: 2 }) {
      ReaderChoiceRow({ scheme: this.scheme, specId: 'default-option', label,
        selected: this.snapshot.strategy === value, actionEnabled: !this.locked(), wrapLabel: true,
        onChoose: (): void => this.send({ kind: 'strategy', value }) });
      this.hint(detail);
    }.width('100%');
  }
  @Builder private previewContent() {
    if (this.snapshot.documentName.length > 0) this.hint(this.snapshot.documentName);
    if (this.snapshot.receipt !== undefined) {
      this.heading(`已导入 ${this.snapshot.receipt.importedCount} 项 · 失败 ${this.snapshot.receipt.failedCount} 项`);
    }
    if (this.snapshot.catalogState !== 'ready' || this.snapshot.refreshRequired) {
      ReaderPageState({ loading: this.snapshot.catalogState === 'loading',
        message: this.snapshot.catalogState === 'loading' ? '正在读取分组目录…' : '请刷新分组目录后继续核对。',
        actionLabel: this.snapshot.catalogState === 'loading' ? '' : '刷新目录', padded: false,
        onAction: (): void => this.send({ kind: 'refresh' }) });
    }
    if (this.snapshot.stage !== 'submitting' && this.snapshot.stage !== 'results') {
      this.heading('分组处理');
      this.strategyChoice('preserve', '保留已有书源分组', '已有书源保留本地归属，新增书源采用文件分组。');
      this.strategyChoice('fill', '为新增无分组项归组', '只处理新增且文件未提供分组的书源。');
      this.strategyChoice('all', '统一指定分组', '将本次勾选的书源放入同一个目标分组。');
      if (this.snapshot.strategy !== 'preserve') this.targetTrigger();
    }
    Row() {
      Text(`已选 ${this.snapshot.selectedCount} 项`).fontFamily(MESSAGE_BODY.fontFamily).fontSize(MESSAGE_BODY.fontSizeFp)
        .fontColor(readerAppColor('TOK_INK', this.scheme)).layoutWeight(1);
      ReaderButton({ scheme: this.scheme, specId: 'rules-compact', label: '全选', actionEnabled: !this.locked(),
        onAction: (): void => this.send({ kind: 'selectAll', selected: true }) });
      ReaderButton({ scheme: this.scheme, specId: 'rules-compact', label: '清空选择', actionEnabled: !this.locked(),
        onAction: (): void => this.send({ kind: 'selectAll', selected: false }) });
    }.width('100%');
  }
  private status(row: SourceImportRow): string {
    if (this.snapshot.busy && row.selected) return '正在处理';
    return row.status === 'imported' ? '已导入' : row.status === 'failed' ? '导入失败' :
      row.status === 'invalid' ? '无效条目' : row.status === 'unknown' ? '待核对' : row.existing ? '已有书源' : '新增书源';
  }
  @Builder private importRow(row: SourceImportRow) {
    Row({ space: 12 }) {
      Checkbox({ name: `${row.index}`, group: 'source-import-selection' }).select(row.selected)
        .enabled(!this.locked() && row.valid && row.status !== 'imported')
        .selectedColor(readerAppColor('TOK_GREEN', this.scheme)).width(22).height(22)
        .responseRegion({ x: -11, y: -11, width: 44, height: 44 })
        .accessibilityText(`选择${row.name}`)
        .onChange((selected: boolean): void => this.send({ kind: 'select', index: row.index, selected }));
      Column({ space: 5 }) {
        Text(row.name).fontFamily(MESSAGE_BODY.fontFamily).fontWeight(500).fontSize(MESSAGE_BODY.fontSizeFp)
          .fontColor(readerAppColor('TOK_INK', this.scheme)).width('100%');
        this.hint(this.status(row));
        if (row.sourceId.length > 0) this.hint(row.sourceId);
        if (row.valid) this.hint(`导入后：${row.finalGroup}${row.existing && this.snapshot.strategy !== 'all' ? ' · 保留本地' : ''}`);
        if (row.error.length > 0) this.hint(row.error);
      }.layoutWeight(1).alignItems(HorizontalAlign.Start);
    }.width('100%').alignItems(VerticalAlign.Top).padding({ top: 14, bottom: 14 })
      .borderWidth({ bottom: 1 }).borderColor(readerAppColor('TOK_LINE', this.scheme));
  }
  @Builder private overwriteConfirmation(scope: string) {
    Row({ space: 10 }) {
      Checkbox({ name: 'source-import-overwrite', group: 'source-import-confirmation' }).select(this.snapshot.overwriteConfirmed)
        .selectedColor(readerAppColor('TOK_GREEN', this.scheme)).width(22).height(22)
        .responseRegion({ x: -11, y: -11, width: 44, height: 44 }).enabled(!this.locked())
        .accessibilityText('确认覆盖所选已有书源的分组归属')
        .onChange((checked: boolean): void => this.send({ kind: 'confirm', scope, checked }));
      Text(`确认覆盖 ${this.snapshot.updatedCount} 个已有书源的分组归属`).fontFamily(MESSAGE_META.fontFamily)
        .fontSize(MESSAGE_META.fontSizeFp).fontColor(readerAppColor('TOK_INK', this.scheme)).layoutWeight(1);
    }.width('100%').alignItems(VerticalAlign.Center).constraintSize({ minHeight: 44 });
  }
  @Builder private submitFooter(scope: string) {
    if (this.snapshot.confirmationRequired) this.overwriteConfirmation(scope);
    if (!this.snapshot.canSubmit && this.snapshot.blockingMessage.length > 0 && !this.snapshot.busy) this.hint(this.snapshot.blockingMessage);
    ReaderButton({ scheme: this.scheme, specId: 'form-action', label: `导入所选 · ${this.snapshot.selectedCount}`, primary: true,
      layout: 'full', actionEnabled: this.snapshot.canSubmit,
      onAction: (): void => this.send({ kind: 'submit', scope }) });
  }
  @Builder private footer() {
    Column({ space: 8 }) {
      if (this.snapshot.stage === 'input') {
        ReaderButton({ scheme: this.scheme, specId: 'form-action', primary: true, layout: 'full', actionEnabled: !this.locked(),
          label: this.snapshot.method === 'local' ? '选择本地 JSON 文件' : this.snapshot.method === 'subscription' ? '拉取并预览' : '读取并预览',
          onAction: (): void => this.send({ kind: 'acquire' }) });
      } else if (this.snapshot.busy) {
        Row({ space: 10 }) { LoadingProgress().width(22).height(22); Text('正在处理，请稍候…').fontFamily(MESSAGE_META.fontFamily).fontSize(MESSAGE_META.fontSizeFp).fontColor(readerAppColor('TOK_MUTED', this.scheme)).layoutWeight(1); }.width('100%');
      } else if (this.snapshot.stage === 'results') {
        if (this.snapshot.rows.some((row: SourceImportRow): boolean => row.status === 'failed') && !this.locked()) {
          ReaderButton({ scheme: this.scheme, specId: 'form-action', label: '仅重试失败项', primary: true, layout: 'full',
            onAction: (): void => this.send({ kind: 'retryFailed' }) });
        }
        ReaderButton({ scheme: this.scheme, specId: 'form-action', label: this.locked() ? '返回书源管理' : '完成', layout: 'full',
          onAction: (): void => { if (this.mounted) this.onBack(); } });
      } else {
        ForEach([this.snapshot.generation], (generation: number): void => { this.submitFooter(this.snapshot.confirmationScope); }, (generation: number): string => `source-import-submit:${generation}`);
      }
    }.width('100%').padding({ left: 20, right: 20, top: 12,
      bottom: readerFloatingBarBottomInset(ReaderWindowCoordinator.metrics(), 12) })
      .backgroundColor(readerAppColor('TOK_SURFACE_SOLID', this.scheme));
  }
  private closeTarget(): void {
    this.getUIContext().getFocusController().clearFocus(); this.targetOpen = false; this.targetGeneration += 1;
  }
  private acceptsTarget(generation: number): boolean { return this.mounted && this.targetOpen && !this.locked() && generation === this.targetGeneration; }
  private chooseTarget(groupId: string, generation: number): void {
    if (!this.acceptsTarget(generation)) return;
    this.send({ kind: 'target', targetKind: 'existing', groupId, name: '' }); this.closeTarget();
  }
  private targetLabel(): string {
    return this.snapshot.targetKind === 'new' ? `新建：${this.snapshot.targetGroupName}` : sourceImportGroupLabel(this.snapshot.catalog, this.snapshot.targetGroupId);
  }
  private targetGroups(): SourceGroupRecord[] {
    const query = this.targetQuery.trim().toLocaleLowerCase();
    return this.snapshot.catalog.groups.filter((group: SourceGroupRecord): boolean => query.length === 0 || group.name.toLocaleLowerCase().includes(query));
  }
  @Builder private targetTrigger() {
    ReaderButton({ scheme: this.scheme, specId: 'form-action', label: `目标分组：${this.targetLabel()}`, layout: 'full',
      actionEnabled: !this.locked(), onAction: (): void => {
        if (!this.mounted || this.locked()) return;
        this.targetGeneration += 1; this.targetQuery = ''; this.draftName = ''; this.targetOpen = true; this.targetRows.replace(this.targetGroups());
      } }).bindSheet(this.targetOpen, this.targetSheet, this.targetOptions(this.targetGeneration));
  }
  @Builder private targetBody(generation: number) {
    Column({ space: 12 }) {
      ReaderSearchField({ variant: 'sourceManagement', mode: 'live', text: this.targetQuery, placeholder: '查找目标分组',
        onTextChange: (value: string): void => { if (this.acceptsTarget(generation)) this.targetQuery = value; } });
      List() {
        if ('未分组'.includes(this.targetQuery.trim())) {
          ListItem() { ReaderChoiceRow({ label: '未分组', scheme: this.scheme,
            selected: this.snapshot.targetKind === 'existing' && this.snapshot.targetGroupId === '',
            onChoose: (): void => this.chooseTarget('', generation) }); }
        }
        LazyForEach(this.targetRows, (group: SourceGroupRecord): void => {
          ListItem() { ReaderChoiceRow({ label: sourceImportGroupLabel(this.snapshot.catalog, group.groupId), scheme: this.scheme, wrapLabel: true,
            selected: this.snapshot.targetKind === 'existing' && this.snapshot.targetGroupId === group.groupId,
            onChoose: (): void => this.chooseTarget(group.groupId, generation) }); }
        }, (group: SourceGroupRecord): string => `${generation}:${group.groupId}:${group.name}:${this.snapshot.targetGroupId}`);
      }.width('100%').height(240).scrollBar(BarState.Auto);
      this.hint('也可为本次导入创建新分组');
      ReaderFormField({ scheme: this.scheme, specId: 'rules-input', text: this.draftName, placeholder: '新分组名称',
        onTextChange: (value: string): void => { if (this.acceptsTarget(generation)) this.draftName = value; } });
      ReaderButton({ scheme: this.scheme, specId: 'form-action', label: '使用新分组', layout: 'full',
        actionEnabled: sourceGroupNameError(this.snapshot.catalog, this.draftName).length === 0,
        onAction: (): void => {
          if (!this.acceptsTarget(generation)) return;
          this.send({ kind: 'target', targetKind: 'new', groupId: '', name: this.draftName.trim() }); this.closeTarget();
        } });
    }.width('100%').padding({ left: 20, right: 20, bottom: 20 });
  }
  @Builder private targetSheet() {
    ForEach([this.targetGeneration], (generation: number): void => {
      ReaderBoundedSurface({ specId: 'source-management-filter',
        header: (): void => { ReaderBoundedSurfaceHeader({ specId: 'source-management-filter', title: '选择目标分组',
          onClose: (): void => { if (this.acceptsTarget(generation)) this.closeTarget(); } }); },
        body: (): void => { this.targetBody(generation); } });
    }, (generation: number): string => `source-import-target:${generation}`);
  }
  private targetOptions(generation: number): SheetOptions {
    const metrics = ReaderWindowCoordinator.metrics();
    const chrome = readerSheetChrome('source-management-filter', this.scheme,
      readerSheetWidth('source-management-filter', metrics.windowRect.width,
        readerVisualSafeLeft(metrics), readerVisualSafeRight(metrics)));
    return { height: SheetSize.FIT_CONTENT, width: chrome.width, preferType: SheetType.BOTTOM, dragBar: false, showClose: false,
      backgroundColor: chrome.backgroundColor, maskColor: chrome.maskColor,
      radius: chrome.radius, shadow: chrome.shadow, borderWidth: chrome.borderWidth, borderColor: chrome.borderColor,
      enableOutsideInteractive: false,
      onWillDismiss: (action: DismissSheetAction): void => {
        if (!this.acceptsTarget(generation)) return;
        this.closeTarget(); action.dismiss();
      }, onDisappear: (): void => { if (this.acceptsTarget(generation)) this.closeTarget(); } };
  }
}
