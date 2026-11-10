import hilog from '@ohos.hilog';
import inputMethod from '@ohos.inputMethod';
import { ReaderTransientFeedback } from '../../../ui/feedback/ReaderTransientFeedback';
import { ReaderStandardPage } from '../../../ui/layout/ReaderStandardPage';
import { ReaderButton } from '../../../ui/controls/ReaderButton';
import { ReaderCard } from '../../../ui/surfaces/ReaderCard';
import { ReaderInlineSelect } from '../../../ui/controls/ReaderInlineSelect';
import { ReaderFormField } from '../../../ui/controls/ReaderFormField';
import { ReaderSectionHeading } from '../../../ui/controls/ReaderSectionHeading';
import { ReaderRecoveryAction } from '../../../ui/feedback/ReaderRecoveryAction';
import { ReaderRecoveryNotice } from '../../../ui/feedback/ReaderRecoveryNotice';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { MESSAGE_TITLE, MESSAGE_BODY, MESSAGE_META } from '../../../ui/foundation/ReaderMessageStyle';
import { readerRecoveryView } from '../../../app/ReaderRecoveryProjection';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';
import { ReaderNativeAlertOwner, type ReaderNativeAlertOptions } from '../../../ui/platform/ReaderNativeAlertOwner';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import { consumeReaderControlKeyboardBack } from '../../../ui/foundation/ReaderKeyboardBack';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { registerReaderFonts } from '../../../ui/foundation/ReaderFonts';
import { PageBackBar } from '../../../ui/chrome/PageBackBar';
import {
  TYPE_SOURCE_TOOLS_ACTION,
  TYPE_SOURCE_TOOLS_BODY,
  TYPE_SOURCE_TOOLS_CAPTION,
  TYPE_SOURCE_TOOLS_CODE_INPUT,
  TYPE_SOURCE_TOOLS_COMPACT_ACTION,
  TYPE_SOURCE_TOOLS_DEBUG_ID,
  TYPE_SOURCE_TOOLS_DEBUG_LOG,
  TYPE_SOURCE_TOOLS_DESCRIPTION,
  TYPE_SOURCE_TOOLS_HINT,
  TYPE_SOURCE_TOOLS_INHERITED_META,
  TYPE_SOURCE_TOOLS_NOTE,
  TYPE_SOURCE_TOOLS_STATUS,
  TYPE_SOURCE_TOOLS_URL,
} from '../../../ui/foundation/ReaderTypography';
import {
  TOK_BORDER,
  TOK_BORDER_W,
  TOK_INK,
  TOK_MUTED,
  TOK_PRIMARY_DARK,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
  TOK_SURFACE_PANEL_SOFT,
} from '../../../ui/foundation/ReaderTokens';
import type { BookSource, SourceDebugLog } from '../application/SourceGateway';
import {
  type SourceBatchCheckProgress,
  type SourceBatchCheckResult,
  type SourceToolsSelection,
  type SourceToolsSnapshot,
  EMPTY_SOURCE_TOOLS_SNAPSHOT,
  sourceEditorReadbackPending,
} from '../application/SourceToolsOrchestrator';

let nextSourceToolsBackIdentity: number = 0;

class SourceToolListRow {
  readonly source: BookSource;
  readonly sourceListRevision: number;
  readonly selected: boolean;
  readonly actionsEnabled: boolean;

  constructor(source: BookSource, sourceListRevision: number, selected: boolean, actionsEnabled: boolean) {
    this.source = source;
    this.sourceListRevision = sourceListRevision;
    this.selected = selected;
    this.actionsEnabled = actionsEnabled;
  }
}

class SourceToolListDataSource implements IDataSource {
  private items: SourceToolListRow[] = [];
  private listeners: DataChangeListener[] = [];

  totalCount(): number {
    return this.items.length;
  }

  getData(index: number): SourceToolListRow {
    return this.items[index];
  }

  registerDataChangeListener(listener: DataChangeListener): void {
    if (this.listeners.indexOf(listener) < 0) {
      this.listeners.push(listener);
    }
  }

  unregisterDataChangeListener(listener: DataChangeListener): void {
    const index = this.listeners.indexOf(listener);
    if (index >= 0) {
      this.listeners.splice(index, 1);
    }
  }

  replace(sources: BookSource[], sourceListRevision: number, selectedSourceIds: string[], actionsEnabled: boolean): void {
    const selected = new Set<string>();
    for (const sourceId of selectedSourceIds) {
      selected.add(sourceId);
    }
    const next: SourceToolListRow[] = [];
    for (const source of sources) {
      next.push(new SourceToolListRow(source, sourceListRevision, selected.has(source.sourceId), actionsEnabled));
    }
    this.items = next;
    for (const listener of this.listeners) {
      listener.onDataReloaded();
    }
  }
}

class SourceCheckResultDataSource implements IDataSource {
  private items: SourceBatchCheckResult[] = [];
  private listeners: DataChangeListener[] = [];

  totalCount(): number {
    return this.items.length;
  }

  getData(index: number): SourceBatchCheckResult {
    return this.items[index];
  }

  registerDataChangeListener(listener: DataChangeListener): void {
    if (this.listeners.indexOf(listener) < 0) {
      this.listeners.push(listener);
    }
  }

  unregisterDataChangeListener(listener: DataChangeListener): void {
    const index = this.listeners.indexOf(listener);
    if (index >= 0) {
      this.listeners.splice(index, 1);
    }
  }

  replace(items: SourceBatchCheckResult[]): void {
    this.items = items.slice();
    for (const listener of this.listeners) {
      listener.onDataReloaded();
    }
  }
}

class SourceDebugLogDataSource implements IDataSource {
  private items: SourceDebugLog[] = [];
  private listeners: DataChangeListener[] = [];

  totalCount(): number {
    return this.items.length;
  }

  getData(index: number): SourceDebugLog {
    return this.items[index];
  }

  registerDataChangeListener(listener: DataChangeListener): void {
    if (this.listeners.indexOf(listener) < 0) {
      this.listeners.push(listener);
    }
  }

  unregisterDataChangeListener(listener: DataChangeListener): void {
    const index = this.listeners.indexOf(listener);
    if (index >= 0) {
      this.listeners.splice(index, 1);
    }
  }

  replace(items: SourceDebugLog[]): void {
    this.items = items.slice();
    for (const listener of this.listeners) {
      listener.onDataReloaded();
    }
  }
}

@Component
export struct SourceToolsPage {
  private readonly transientFeedback: ReaderTransientFeedback = new ReaderTransientFeedback();
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @Prop @Watch('onSnapshotChanged') snapshot: SourceToolsSnapshot = EMPTY_SOURCE_TOOLS_SNAPSHOT;
  isOpeningCurrent: (() => boolean) | undefined = undefined;
  isInputAllowed: (() => boolean) | undefined = undefined;
  onReconcile: (generation: number) => void = (_generation: number): void => {};
  onContinueOriginal: (generation: number) => void = (_generation: number): void => {};
  onBack: () => void = (): void => {};
  onTemporaryBackBridge: ((handler: (() => boolean) | undefined, identity: string) => void) | undefined = undefined;
  onExportAll: () => void = (): void => {};
  onExportSelected: (selection: SourceToolsSelection) => void = (_selection: SourceToolsSelection): void => {};
  onCheckSelected: (selection: SourceToolsSelection) => void = (_selection: SourceToolsSelection): void => {};
  onStopCheck: () => void = (): void => {};
  onCheckSelectionChanged: (mode: 'search' | 'explore', depth: number) => void = (): void => {};
  onSetSelectedEnabled: (selection: SourceToolsSelection, enabled: boolean) => void =
    (_selection: SourceToolsSelection, _enabled: boolean): void => {};
  onDeleteSelected: (selection: SourceToolsSelection) => void = (_selection: SourceToolsSelection): void => {};
  onOpenEditor: (sourceId: string) => void = (_sourceId: string): void => {};
  onEditorDraftChanged: (text: string, revision: number) => void = (_text: string, _revision: number): void => {};
  onSaveEditor: (revision: number) => void = (_revision: number): void => {};
  onReconcileEditor: (revision: number) => void = (_revision: number): void => {};
  onCancelEditor: (revision: number) => void = (_revision: number): void => {};
  onDebugKeyChanged: (value: string) => void = (_value: string): void => {};
  onDebugSource: (sourceId: string) => void = (_sourceId: string): void => {};
  onSelectAll: () => void = (): void => {};
  onClearSelection: () => void = (): void => {};
  onToggleSelection: (sourceId: string) => void = (_sourceId: string): void => {};
  private readonly sourceDataSource: SourceToolListDataSource = new SourceToolListDataSource();
  private readonly batchResultDataSource: SourceCheckResultDataSource = new SourceCheckResultDataSource();
  private readonly debugLogDataSource: SourceDebugLogDataSource = new SourceDebugLogDataSource();
  private projectedSourceListRevision: number = -1;
  private projectedSelectionRevision: number = -1;
  private projectedBusy: boolean = false;
  private projectedCanWrite: boolean = false;
  private projectedBatchResultsIdentity: string = '';
  private projectedDebugLogsIdentity: string = '';

  private readonly nativeAlertOwner: ReaderNativeAlertOwner = new ReaderNativeAlertOwner();
  private mounted: boolean = false;
  private temporaryBackIdentity: string = '';
  private exportRevision: number = 0;
  private lastFeedbackIdentity: string = '';
  @State private editorInputRevision: number = 0;
  @State private debugInputRevision: number = 0;

  aboutToDisappear(): void {
    this.transientFeedback.reset();
    this.mounted = false;
    this.exportRevision += 1;
    this.nativeAlertOwner.retire();
    const identity = this.temporaryBackIdentity;
    this.temporaryBackIdentity = '';
    this.onTemporaryBackBridge?.(undefined, identity);
  }

  aboutToAppear(): void {
    this.mounted = true; this.exportRevision += 1;
    registerReaderFonts(this.getUIContext().getFont());
    this.projectedSourceListRevision = -1;
    this.projectedSelectionRevision = -1;
    this.projectedBusy = !this.snapshot.busy;
    this.projectedBatchResultsIdentity = '';
    this.projectedDebugLogsIdentity = '';
    this.lastFeedbackIdentity = this.feedbackIdentity();
    this.syncListDataSources();
    const identity = `source-tools-back:${++nextSourceToolsBackIdentity}`;
    this.temporaryBackIdentity = identity;
    this.onTemporaryBackBridge?.((): boolean => this.consumeKeyboardBack(identity), identity);
  }

  private toolsOpeningIsCurrent(identity: string): boolean {
    return this.mounted && identity.length > 0 && identity === this.temporaryBackIdentity &&
      (this.isOpeningCurrent?.() ?? true) && AppStorage.get<boolean>('readerAppForeground') !== false;
  }

  private toolsInputIsCurrent(identity: string = this.temporaryBackIdentity): boolean {
    return this.toolsOpeningIsCurrent(identity) && (this.isInputAllowed?.() ?? true);
  }

  private consumeKeyboardBack(identity: string): boolean {
    if (!this.toolsOpeningIsCurrent(identity)) return false;
    return consumeReaderControlKeyboardBack(ReaderWindowCoordinator.metrics(), {
      hideTextInput: (): Promise<void> => inputMethod.getController().hideTextInput(),
      onFailure: (error: Error): void => {
        if (this.toolsOpeningIsCurrent(identity)) hilog.warn(0x5244, 'Reader', 'Source tools keyboard dismissal: %{private}s', error.message);
      },
    });
  }

  private toolsBackAction(identity: string): () => void {
    return (): void => {
      if (this.toolsOpeningIsCurrent(identity) && !this.consumeKeyboardBack(identity)) this.onBack();
    };
  }

  build() {
    ReaderStandardPage({
      variant: 'tools',
      header: (): void => { this.pageHeader(); },
      content: (): void => { this.pageContent(); },
      overlayContent: (contentStartInset: number): void => { this.pendingOverlay(contentStartInset); },
    });
  }

  @Builder
  private pageHeader() {
    PageBackBar({ title: '批量管理与书源工具', onBack: this.toolsBackAction(this.temporaryBackIdentity) });
  }

  @Builder
  private pageContent() {
    this.statusCard();
    if (this.snapshot.original?.blocked !== true && this.snapshot.receipt?.receipt.confirmation !== 'unknown' && this.recovery().canRetry) {
      this.recoveryAction();
    }
    this.exportCard();
    // V1 @Builder parameters are captured when the builder subtree is
    // mounted. Rebuild only this small controls card when its primitive
    // inputs change so enabled guards and selected IDs never remain at
    // the initial loading snapshot. The 1,777-row LazyForEach below is
    // deliberately outside this keyed subtree.
    ForEach([this.batchControlsRenderKey()], (key: string) => {
      this.batchCard(key);
    }, (key: string): string => `source-batch-controls:${key}`);
    if (this.snapshot.batchCheck.phase !== 'idle') {
      // The progress card has the same V1 builder-capture boundary.
      // Its compact subtree is keyed independently so every source
      // completion updates counters/current item/results without
      // remounting the source catalog.
      ForEach([this.batchProgressRenderKey()], (_key: string) => {
        this.batchCheckCard();
      }, (key: string): string => `source-batch-progress:${key}`);
    }
    this.sourceCard();
    if (this.snapshot.editorSourceId.length > 0) {
      // Retire the old native input and capture this editor's identity in its callbacks.
      ForEach([this.snapshot.editorRevision], (revision: number) => {
        this.editorCard(revision);
      }, (revision: number): string => `source-editor:${revision}`);
    }
    this.debugCard();
  }


  @Builder
  private batchCard(key: string) {
    ReaderCard({ specId: 'editor-section' }) {
      ReaderSectionHeading({ variant: 'tool-card', title: `批量管理（已选 ${this.snapshot.selectedSourceCount}/${this.snapshot.sources.length}）` });
      Row({ space: TOK_SPACE_XS }) {
        this.actionButton('全选', false, !this.snapshot.busy, (): void => this.onSelectAll());
        this.actionButton('清空', false, !this.snapshot.busy && this.snapshot.selectedSourceCount > 0,
          (): void => this.onClearSelection());
        this.actionButton('导出所选', false,
          !this.snapshot.busy && this.snapshot.selectedSourceCount > 0,
          this.batchSelectionAction(key, (selection: SourceToolsSelection): void =>
            this.confirmExportThen((): void => this.onExportSelected(selection))));
      }
      .width('100%');
      Row({ space: TOK_SPACE_XS }) {
        if (this.snapshot.batchCheck.phase === 'running' || this.snapshot.batchCheck.phase === 'stopping') {
          this.actionButton(this.snapshot.batchCheck.phase === 'stopping' ? '停止中…' : '停止检测', false,
            this.snapshot.batchCheck.phase === 'running', (): void => this.onStopCheck());
        } else {
          this.actionButton('检测所选', false,
            !this.snapshot.busy && this.snapshot.selectedSourceCount > 0,
            this.batchSelectionAction(key, this.onCheckSelected));
        }
        this.actionButton('启用', false,
          this.canWriteSources() && this.snapshot.selectedSourceCount > 0,
          this.batchSelectionAction(key, (selection: SourceToolsSelection): void => this.onSetSelectedEnabled(selection, true)));
        this.actionButton('停用', false,
          this.canWriteSources() && this.snapshot.selectedSourceCount > 0,
          this.batchSelectionAction(key, (selection: SourceToolsSelection): void => this.onSetSelectedEnabled(selection, false)));
        this.actionButton('删除', false,
          this.canWriteSources() && this.snapshot.selectedSourceCount > 0,
          this.batchSelectionAction(key, this.onDeleteSelected));
      }
      .width('100%');
      Text('批量操作复用 source.export / source.check.run / source.update / source.delete；删除由系统确认框二次确认。')
        .width('100%')
        .fontFamily(TYPE_SOURCE_TOOLS_NOTE.fontFamily as string)
        .fontSize(TYPE_SOURCE_TOOLS_NOTE.fontSizeFp)
        .lineHeight(TYPE_SOURCE_TOOLS_NOTE.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
    }
  }

  private batchSelectionAction(key: string, action: (selection: SourceToolsSelection) => void): () => void {
    const opening = this.temporaryBackIdentity;
    const selection: SourceToolsSelection = { sourceIds: this.snapshot.selectedSourceIds.slice(),
      sourceListRevision: this.snapshot.sourceListRevision, selectionRevision: this.snapshot.selectionRevision };
    return (): void => {
      if (selection.sourceIds.length === 0 || !this.toolsInputIsCurrent(opening) || key !== this.batchControlsRenderKey()) return;
      action(selection);
    };
  }

  @Builder
  private batchCheckCard() {
    ReaderCard({ specId: 'task-diagnostics' }) {
      Row({ space: TOK_SPACE_XS }) {
        Text(`检测进度 ${this.snapshot.batchCheck.completed}/${this.snapshot.batchCheck.total}` +
          `（${this.batchCheckPercent(this.snapshot.batchCheck)}%）`)
          .layoutWeight(1)
          .fontFamily(MESSAGE_TITLE.fontFamily)
          .fontWeight(MESSAGE_TITLE.fontWeight)
          .fontSize(MESSAGE_TITLE.fontSizeFp).lineHeight(MESSAGE_TITLE.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_MESSAGE_INK', this.appThemeScheme));
        Text(this.batchCheckPhaseLabel(this.snapshot.batchCheck))
          .fontFamily(TYPE_SOURCE_TOOLS_COMPACT_ACTION.fontFamily)
          .fontSize(TYPE_SOURCE_TOOLS_COMPACT_ACTION.fontSizeFp)
          .fontWeight(TYPE_SOURCE_TOOLS_COMPACT_ACTION.fontWeight)
          .fontColor(this.snapshot.batchCheck.phase === 'failed' ? readerAppColor('app.status.checkError', this.appThemeScheme) : readerAppColor('TOK_PRIMARY_TEXT', this.appThemeScheme));
      }
      .width('100%');
      Row() {
        Row()
          .width(`${this.batchCheckPercent(this.snapshot.batchCheck)}%`)
          .height(8)
          .backgroundColor(readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme))
          .borderRadius(4);
      }
      .width('100%')
      .height(8)
      .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme))
      .borderRadius(4);
      if (this.snapshot.batchCheck.currentSourceName.length > 0) {
        Text(`当前 ${this.snapshot.batchCheck.currentIndex}/${this.snapshot.batchCheck.total}：` +
          `${this.snapshot.batchCheck.currentSourceName}（检测所选能力）`)
          .width('100%')
          .fontFamily(MESSAGE_BODY.fontFamily as string)
          .fontSize(MESSAGE_BODY.fontSizeFp)
          .lineHeight(MESSAGE_BODY.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_MESSAGE_INK', this.appThemeScheme))
          .wordBreak(WordBreak.BREAK_ALL);
      }
      Row({ space: TOK_SPACE_XS }) {
        this.batchCounter(`所选项通过 ${this.snapshot.batchCheck.passed}`, readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme));
        this.batchCounter(`所选项未通过 ${this.snapshot.batchCheck.failed}`, readerAppColor('app.status.checkError', this.appThemeScheme));
        this.batchCounter(`检测错误 ${this.snapshot.batchCheck.errors}`, readerAppColor('app.status.checkWarning', this.appThemeScheme));
        this.batchCounter(`剩余 ${Math.max(0,
          this.snapshot.batchCheck.total - this.snapshot.batchCheck.completed)}`, readerAppColor('TOK_MUTED', this.appThemeScheme));
      }
      .width('100%');
      if (this.snapshot.batchCheck.results.length === 0) {
        Text('每个书源完成后，结果会立即出现在这里。')
          .width('100%')
          .fontFamily(TYPE_SOURCE_TOOLS_HINT.fontFamily as string)
          .fontSize(TYPE_SOURCE_TOOLS_HINT.fontSizeFp)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
      } else {
        Text('实时结果（最新在前）')
          .width('100%')
          .fontFamily(TYPE_SOURCE_TOOLS_COMPACT_ACTION.fontFamily)
          .fontSize(TYPE_SOURCE_TOOLS_COMPACT_ACTION.fontSizeFp)
          .fontWeight(TYPE_SOURCE_TOOLS_COMPACT_ACTION.fontWeight)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
        List() {
          LazyForEach(this.batchResultDataSource, (result: SourceBatchCheckResult) => {
            ListItem() {
              this.batchResultRow(result);
            }
          }, (result: SourceBatchCheckResult): string =>
            `source-check-${result.sourceId}-${result.traceId}-${result.state}`);
        }
        .width('100%')
        .height(Math.min(320, Math.max(58, this.snapshot.batchCheck.results.length * 58)))
        .scrollBar(BarState.Off);
      }
    }
  }

  @Builder
  private batchCounter(label: string, color: string) {
    Text(label)
      .layoutWeight(1)
      .height(32)
      .textAlign(TextAlign.Center)
      .fontFamily(TYPE_SOURCE_TOOLS_COMPACT_ACTION.fontFamily)
      .fontSize(TYPE_SOURCE_TOOLS_COMPACT_ACTION.fontSizeFp)
      .fontWeight(TYPE_SOURCE_TOOLS_COMPACT_ACTION.fontWeight)
      .fontColor(color)
      .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme))
      .borderRadius(7);
  }

  @Builder
  private batchResultRow(result: SourceBatchCheckResult) {
    Row({ space: TOK_SPACE_XS }) {
      Column({ space: 3 }) {
        Text(result.sourceName)
          .width('100%')
          .fontFamily(TYPE_SOURCE_TOOLS_ACTION.fontFamily)
          .fontSize(TYPE_SOURCE_TOOLS_ACTION.fontSizeFp)
          .fontWeight(TYPE_SOURCE_TOOLS_ACTION.fontWeight)
          .fontColor(readerAppColor('TOK_MESSAGE_INK', this.appThemeScheme))
          .wordBreak(WordBreak.BREAK_ALL);
        Text(result.sourceId)
          .width('100%').fontFamily(MESSAGE_META.fontFamily as string)
          .fontSize(MESSAGE_META.fontSizeFp).lineHeight(MESSAGE_META.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_MESSAGE_MUTED', this.appThemeScheme))
          .wordBreak(WordBreak.BREAK_ALL);
        Text(result.message)
          .width('100%')
          .fontFamily(MESSAGE_BODY.fontFamily as string)
          .fontSize(MESSAGE_BODY.fontSizeFp).lineHeight(MESSAGE_BODY.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_MESSAGE_INK', this.appThemeScheme))
          .wordBreak(WordBreak.BREAK_ALL);
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start);
      Text(this.batchResultLabel(result))
        .fontFamily(TYPE_SOURCE_TOOLS_COMPACT_ACTION.fontFamily)
        .fontSize(TYPE_SOURCE_TOOLS_COMPACT_ACTION.fontSizeFp)
        .fontWeight(TYPE_SOURCE_TOOLS_COMPACT_ACTION.fontWeight)
        .fontColor(result.state === 'passed' ? readerAppColor('TOK_PRIMARY_TEXT', this.appThemeScheme) :
          (result.state === 'failed' ? readerAppColor('app.status.checkError', this.appThemeScheme) : readerAppColor('app.status.checkWarning', this.appThemeScheme)));
    }
    .width('100%')
    .constraintSize({ minHeight: 58 })
    .alignItems(VerticalAlign.Top)
    .padding({ top: 13, bottom: 13, left: TOK_SPACE_XS, right: TOK_SPACE_XS })
    .border({ width: { bottom: TOK_BORDER_W }, color: readerAppColor('TOK_BORDER', this.appThemeScheme) });
  }

  private recovery(): ReaderRecoveryView { return readerRecoveryView(this.snapshot.receipt, this.snapshot.readFacts, this.snapshot.confirmedParts ?? 0); }
  private originalRecoveryIdentity(): string {
    const original = this.snapshot.original;
    return original === undefined ? '' : `${original.generation}:${original.operationId ?? ''}:` +
      `${original.confirmation}:${original.writeStage}:${original.blocked ? 1 : 0}:` +
      `${original.canRetryOriginal ? 1 : 0}:${original.busy || this.snapshot.busy ? 1 : 0}`;
  }
  private isCurrentOriginalRecovery(identity: string, generation: number): boolean {
    const original = this.snapshot.original;
    return this.mounted && original !== undefined && original.blocked &&
      original.generation === generation && this.originalRecoveryIdentity() === identity &&
      !original.busy && !this.snapshot.busy;
  }
  private reconcileOriginal(identity: string, generation: number): void {
    if (this.isCurrentOriginalRecovery(identity, generation)) this.onReconcile(generation);
  }
  private continueOriginal(identity: string, generation: number): void {
    if (this.isCurrentOriginalRecovery(identity, generation) && this.snapshot.original?.canRetryOriginal) {
      this.onContinueOriginal(generation);
    }
  }
  @Builder
  private originalRecoveryActions(identity: string, generation: number) {
    ReaderRecoveryNotice({ view: { visible: true, message: this.snapshot.original?.message ?? '', canRetry: true, generation },
      actionLabel: '核对', busy: this.snapshot.busy || this.snapshot.original?.busy === true,
      secondaryActionLabel: this.snapshot.original?.canRetryOriginal ?
        (this.snapshot.original.confirmation === 'confirmed' && this.snapshot.original.writeStage === 'cleanup' ? '继续清理' : '继续') : '',
      onReconcile: (value: number): void => this.reconcileOriginal(identity, value),
      onSecondaryAction: (value: number): void => this.continueOriginal(identity, value) });
  }
  @Builder
  private recoveryAction() {
    if (this.snapshot.original?.blocked) {
      ForEach([this.originalRecoveryIdentity()], (identity: string) => {
        this.originalRecoveryActions(identity, this.snapshot.original?.generation ?? 0);
      }, (identity: string): string => `source-original-recovery:${identity}`);
    } else if (this.snapshot.receipt?.receipt.confirmation === 'unknown') {
      ReaderRecoveryNotice({ view: this.recovery(), actionLabel: '核对', busy: this.snapshot.busy, onReconcile: this.onReconcile });
    } else if (this.recovery().canRetry) {
      ReaderRecoveryAction({ label: '刷新列表', generation: this.recovery().generation, onReconcile: this.onReconcile });
    }
  }
  @Builder
  private pendingOverlay(contentStartInset: number) {
    Column() {
      if (this.snapshot.original?.blocked || this.snapshot.receipt?.receipt.confirmation === 'unknown') {
        this.recoveryAction();
      }
    }
      .width('100%').padding({ left: 20, right: 20, top: contentStartInset })
      .alignItems(HorizontalAlign.Start).hitTestBehavior(HitTestMode.Transparent);
  }
  @Builder
  private statusCard() {
    if (this.snapshot.sources.length === 0 && this.snapshot.original?.blocked !== true) {
      ReaderPageState({ title: this.snapshot.readFacts?.fact === 'failed' ? '书源读取失败' :
        (this.snapshot.busy ? '正在读取书源' : '暂无书源'),
        message: this.snapshot.readFacts?.fact === 'failed' ? '请稍后重试。' :
          (this.snapshot.busy ? '请稍候' : '返回书源管理后，可导入书源 JSON。'),
        loading: this.snapshot.busy,
        actionLabel: this.snapshot.readFacts?.canRetry ? '重试' : '',
        onAction: (): void => this.onReconcile(this.snapshot.readFacts?.generation ?? 0) });
    } else if (this.snapshot.busy && this.snapshot.batchCheck.phase !== 'running' && this.snapshot.batchCheck.phase !== 'stopping' && this.snapshot.original?.blocked !== true) {
      Row({ space: 10 }) {
        LoadingProgress().width(32).height(32).color(readerAppColor('TOK_MESSAGE_SOFT_INK', this.appThemeScheme));
        Text(this.snapshot.statusMessage).layoutWeight(1)
          .fontFamily(MESSAGE_BODY.fontFamily as string).fontSize(MESSAGE_BODY.fontSizeFp)
          .lineHeight(MESSAGE_BODY.lineHeightFp as number).fontColor(readerAppColor('TOK_MESSAGE_MUTED', this.appThemeScheme));
      }.width('100%').padding(17);
    }
  }

  @Builder
  private exportCard() {
    ReaderCard({ specId: 'editor-section' }) {
      ReaderSectionHeading({ variant: 'tool-card', title: '书源导出' });
      Text('Core 生成 Legado 兼容 JSON；Host 只通过系统文件选择器写入。')
        .width('100%')
        .fontFamily(TYPE_SOURCE_TOOLS_DESCRIPTION.fontFamily as string)
        .fontSize(TYPE_SOURCE_TOOLS_DESCRIPTION.fontSizeFp)
        .lineHeight(TYPE_SOURCE_TOOLS_DESCRIPTION.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
      this.fullWidthActionButton('导出全部书源', true,
        (): void => this.confirmExportThen((): void => this.onExportAll()));
    }
  }

  @Builder
  private sourceCard() {
    ReaderCard({ specId: 'bordered-list-section' }) {
      ReaderSectionHeading({ variant: 'tool-card', title: `书源编辑（${this.snapshot.sources.length}）` });
      List() {
        LazyForEach(this.sourceDataSource, (row: SourceToolListRow) => {
          ListItem() {
            this.sourceRow(row);
          }
        }, (row: SourceToolListRow): string =>
          `source-tool-${row.sourceListRevision}-${row.source.sourceId}-${row.selected ? 1 : 0}-${row.actionsEnabled ? 1 : 0}`);
      }
      .width('100%')
      .height(Math.min(420, Math.max(58, this.snapshot.sources.length * 58)))
      .scrollBar(BarState.Off);
    }
  }

  @Builder
  private sourceRow(row: SourceToolListRow) {
        Row({ space: TOK_SPACE_XS }) {
          Column({ space: 3 }) {
            Text(row.source.name)
              .width('100%')
              .fontFamily(TYPE_SOURCE_TOOLS_ACTION.fontFamily)
              .fontSize(TYPE_SOURCE_TOOLS_ACTION.fontSizeFp)
              .fontWeight(TYPE_SOURCE_TOOLS_ACTION.fontWeight)
              .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis });
            Text(row.source.baseUrl)
              .width('100%')
              .fontFamily(TYPE_SOURCE_TOOLS_URL.fontFamily as string)
              .fontSize(TYPE_SOURCE_TOOLS_URL.fontSizeFp)
              .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis });
            if (row.source.lastCheckSummary !== undefined) {
              Text(row.source.lastCheckSummary)
                .width('100%')
                .fontSize(TYPE_SOURCE_TOOLS_INHERITED_META.fontSizeFp)
                .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis });
            }
          }
          .layoutWeight(1)
          .alignItems(HorizontalAlign.Start);
          this.smallButton(row.selected ? '已选' : '选择', row.actionsEnabled,
            this.sourceRowAction(row, 'select'));
          this.smallButton('编辑', row.actionsEnabled && this.canWriteSources(), this.sourceRowAction(row, 'edit'));
          this.smallButton('调试', row.actionsEnabled, this.sourceRowAction(row, 'debug'));
        }
        .width('100%')
        .height(58)
        .padding({ left: TOK_SPACE_XS, right: TOK_SPACE_XS })
        .border({ width: { bottom: TOK_BORDER_W }, color: readerAppColor('TOK_BORDER', this.appThemeScheme) });
  }

  private sourceRowAction(row: SourceToolListRow, action: 'select' | 'edit' | 'debug'): () => void {
    const opening = this.temporaryBackIdentity;
    const sourceId = row.source.sourceId;
    return (): void => {
      if (!row.actionsEnabled || !this.toolsInputIsCurrent(opening) || this.snapshot.busy ||
        row.sourceListRevision !== this.snapshot.sourceListRevision) return;
      switch (action) {
        case 'select':
          if (row.selected === this.snapshot.selectedSourceIds.includes(sourceId)) this.onToggleSelection(sourceId);
          break;
        case 'edit':
          if (this.canWriteSources()) this.onOpenEditor(sourceId);
          break;
        case 'debug': this.onDebugSource(sourceId); break;
      }
    };
  }

  @Builder
  private editorCard(revision: number) {
    ReaderCard({ specId: 'editor-section' }) {
      ReaderSectionHeading({ variant: 'tool-card', title: `编辑：${this.snapshot.editorSourceId}` });
      Text('bookSourceUrl 是主键；本页不执行隐式迁移。保存时由 Core source.import 校验并持久化。')
        .width('100%')
        .fontFamily(TYPE_SOURCE_TOOLS_DESCRIPTION.fontFamily as string)
        .fontSize(TYPE_SOURCE_TOOLS_DESCRIPTION.fontSizeFp)
        .lineHeight(TYPE_SOURCE_TOOLS_DESCRIPTION.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
      ForEach([this.editorInputRevision], (inputRevision: number): void => {
        ReaderFormField({ scheme: this.appThemeScheme, specId: 'source-code', text: this.snapshot.editorText,
          placeholder: 'BookSource JSON', isEditable: this.editorDraftIsEditable(revision),
          onTextChange: this.editorDraftChange(revision, inputRevision) });
      }, (inputRevision: number): string => `source-editor-input:${revision}:${inputRevision}`);
      // The retained draft keeps its identity. Only the action row needs a new
      // V1 Builder capture when recovery changes write admission.
      ForEach([sourceEditorReadbackPending(this.snapshot.editorReadback)], (recovering: boolean): void => {
        Row({ space: TOK_SPACE_XS }) {
          this.actionButton('取消', false, !recovering && !this.snapshot.busy &&
            this.snapshot.editorReadback?.confirmation !== 'unknown' && this.snapshot.original?.blocked !== true,
            this.editorAction(revision, 'cancel'));
          this.actionButton('校验并保存', true, this.canWriteSources(), this.editorAction(revision, 'save'));
        }.width('100%');
      }, (recovering: boolean): string => recovering ? 'source-editor-recovery' : 'source-editor-edit');
      if (sourceEditorReadbackPending(this.snapshot.editorReadback)) {
        this.actionButton('重新读取已保存书源', false, !this.snapshot.busy,
          this.editorAction(revision, 'reconcile'));
      }
    }
  }

  private debugOptionsCurrent(): boolean {
    return this.toolsInputIsCurrent() && !this.snapshot.busy;
  }

  @Builder
  private debugCard() {
    ReaderCard({ specId: 'task-diagnostics' }) {
      Text(this.snapshot.debugSourceId.length > 0 ? '最近一次检测详情' : '书源调试')
        .width('100%').fontFamily(MESSAGE_TITLE.fontFamily).fontWeight(MESSAGE_TITLE.fontWeight)
        .fontSize(MESSAGE_TITLE.fontSizeFp).lineHeight(MESSAGE_TITLE.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_MESSAGE_INK', this.appThemeScheme));
      // Retire the previous native edit and its open choices when a task
      // takes ownership. Keep the log actors and the accepted text intact.
      ForEach([this.snapshot.busy], (busy: boolean): void => {
        Row({ space: TOK_SPACE_SM }) {
          ReaderInlineSelect({
            value: this.snapshot.checkMode === 'explore' ? '发现' : '搜索',
            options: ['搜索', '发现'],
            selectedIndex: this.snapshot.checkMode === 'explore' ? 1 : 0,
            actionEnabled: !busy,
            onSelect: (index: number, _value: string): void => {
              if (!busy && this.debugOptionsCurrent())
                this.onCheckSelectionChanged(index === 1 ? 'explore' : 'search', this.snapshot.checkDepth);
            },
          });
          ReaderInlineSelect({
            value: ['列表', '详情', '目录', '正文'][this.snapshot.checkDepth - 2] ?? '列表',
            options: ['列表', '详情', '目录', '正文'],
            selectedIndex: Math.max(0, this.snapshot.checkDepth - 2),
            actionEnabled: !busy,
            onSelect: (index: number, _value: string): void => {
              if (!busy && this.debugOptionsCurrent()) this.onCheckSelectionChanged(this.snapshot.checkMode, index + 2);
            },
          });
        }.width('100%');
        ForEach([this.debugInputRevision], (inputRevision: number): void => {
          ReaderFormField({ scheme: this.appThemeScheme, specId: 'source-debug', text: this.snapshot.debugKey,
            placeholder: '检测关键词（留空时使用 Core 默认“我的”）', isEditable: !busy,
            onTextChange: this.debugKeyChange(busy, inputRevision) });
        }, (inputRevision: number): string => `source-debug-input:${inputRevision}`);
      }, (busy: boolean): string => busy ? 'source-debug-busy' : 'source-debug-edit');
      if (this.snapshot.debugSourceId.length > 0) {
        Text('检测对象')
          .width('100%').fontFamily(MESSAGE_META.fontFamily as string)
          .fontSize(MESSAGE_META.fontSizeFp).lineHeight(MESSAGE_META.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_MESSAGE_MUTED', this.appThemeScheme));
        Text(this.snapshot.debugSourceId)
          .width('100%')
          .fontFamily(MESSAGE_META.fontFamily as string)
          .fontSize(MESSAGE_META.fontSizeFp).lineHeight(MESSAGE_META.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_MESSAGE_INK', this.appThemeScheme))
          .wordBreak(WordBreak.BREAK_ALL);
      }
      if (this.snapshot.debugLogs.length === 0) {
        Text('暂无检测记录').width('100%').padding({ top: 28, bottom: 28 }).textAlign(TextAlign.Center)
          .fontFamily(MESSAGE_BODY.fontFamily as string).fontSize(MESSAGE_BODY.fontSizeFp)
          .lineHeight(MESSAGE_BODY.lineHeightFp as number).fontColor(readerAppColor('TOK_MESSAGE_MUTED', this.appThemeScheme));
      }
      List() {
        LazyForEach(this.debugLogDataSource, (log: SourceDebugLog, index: number) => {
          ListItem() {
            this.debugLogRow(log, index);
          }
        }, (log: SourceDebugLog): string =>
          `debug-${log.sourceId ?? ''}-${log.traceId ?? ''}-${log.requestId ?? 0}-` +
            `${log.timestampMs}-${log.state}-${log.message}`);
      }
      .width('100%')
      .height(Math.min(360, Math.max(32, this.snapshot.debugLogs.length * 32)))
      .scrollBar(BarState.Off);
    }
  }

  @Builder
  private debugLogRow(log: SourceDebugLog, index: number) {
    Row({ space: 9 }) {
      Text(`${index + 1}`).width(22).fontFamily(MESSAGE_META.fontFamily as string)
        .fontSize(MESSAGE_META.fontSizeFp).lineHeight(MESSAGE_META.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_MESSAGE_MUTED', this.appThemeScheme));
      Column({ space: 4 }) {
        if (log.state === -1) {
          Text('检测失败').fontFamily(MESSAGE_META.fontFamily as string).fontSize(MESSAGE_META.fontSizeFp)
            .lineHeight(MESSAGE_META.lineHeightFp as number).fontColor(readerAppColor('TOK_MESSAGE_DANGER', this.appThemeScheme));
        }
        Text(log.message).width('100%').fontFamily(MESSAGE_BODY.fontFamily as string)
          .fontSize(MESSAGE_BODY.fontSizeFp).lineHeight(MESSAGE_BODY.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_MESSAGE_INK', this.appThemeScheme)).wordBreak(WordBreak.BREAK_ALL);
        Text(`状态码 ${log.state}`).width('100%').fontFamily(MESSAGE_META.fontFamily as string)
          .fontSize(MESSAGE_META.fontSizeFp).lineHeight(MESSAGE_META.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_MESSAGE_MUTED', this.appThemeScheme));
      }.layoutWeight(1).alignItems(HorizontalAlign.Start);
    }.width('100%').alignItems(VerticalAlign.Top).padding({ top: 13, bottom: 13 })
      .border({ width: { top: TOK_BORDER_W }, color: readerAppColor('TOK_MESSAGE_BORDER', this.appThemeScheme) });
  }

  @Builder
  private smallButton(label: string, enabled: boolean, action: () => void) {
    ReaderButton({ scheme: this.appThemeScheme, specId: 'source-compact', label, actionEnabled: enabled, onAction: action });
  }

  @Builder
  private actionButton(label: string, primary: boolean, enabled: boolean, action: () => void) {
    ReaderButton({ scheme: this.appThemeScheme, specId: 'source-action', label, primary, actionEnabled: enabled, layout: 'equal', onAction: action });
  }

  private canWriteSources(): boolean {
    return !this.snapshot.busy && this.snapshot.original?.blocked !== true && this.snapshot.receipt?.receipt.confirmation !== 'unknown' &&
      this.snapshot.editorReadback?.confirmation !== 'unknown' && !sourceEditorReadbackPending(this.snapshot.editorReadback);
  }

  private editorDraftIsEditable(revision: number): boolean {
    return this.toolsInputIsCurrent() && this.snapshot.editorSourceId.length > 0 &&
      revision === this.snapshot.editorRevision && this.canWriteSources();
  }

  private editorDraftChange(revision: number, inputRevision: number): (value: string) => void {
    const opening = this.temporaryBackIdentity;
    return (value: string): void => {
      if (!this.mounted || opening !== this.temporaryBackIdentity || !(this.isOpeningCurrent?.() ?? true) ||
        revision !== this.snapshot.editorRevision || inputRevision !== this.editorInputRevision ||
        this.snapshot.editorSourceId.length === 0) return;
      if (this.editorDraftIsEditable(revision)) this.onEditorDraftChanged(value, revision);
      else if (!this.toolsInputIsCurrent(opening) && value !== this.snapshot.editorText) this.editorInputRevision += 1;
    };
  }

  private debugKeyChange(busy: boolean, inputRevision: number): (value: string) => void {
    const opening = this.temporaryBackIdentity;
    return (value: string): void => {
      if (!this.mounted || opening !== this.temporaryBackIdentity || !(this.isOpeningCurrent?.() ?? true) ||
        inputRevision !== this.debugInputRevision) return;
      if (!busy && this.debugOptionsCurrent()) this.onDebugKeyChanged(value);
      else if (!this.toolsInputIsCurrent(opening) && value !== this.snapshot.debugKey) this.debugInputRevision += 1;
    };
  }

  private editorAction(revision: number, action: 'cancel' | 'save' | 'reconcile'): () => void {
    const opening = this.temporaryBackIdentity;
    return (): void => {
      if (!this.toolsInputIsCurrent(opening) || revision !== this.snapshot.editorRevision ||
        this.snapshot.editorSourceId.length === 0 || this.snapshot.busy) return;
      if (action === 'reconcile') {
        if (sourceEditorReadbackPending(this.snapshot.editorReadback)) this.onReconcileEditor(revision);
      } else if (action === 'save') {
        if (this.canWriteSources()) this.onSaveEditor(revision);
      } else if (!sourceEditorReadbackPending(this.snapshot.editorReadback) &&
        this.snapshot.editorReadback?.confirmation !== 'unknown' && this.snapshot.original?.blocked !== true)
        this.onCancelEditor(revision);
    };
  }

  @Builder
  private fullWidthActionButton(label: string, primary: boolean, action: () => void) {
    ReaderButton({ scheme: this.appThemeScheme, specId: 'source-action', label, primary, actionEnabled: !this.snapshot.busy, layout: 'full', onAction: action });
  }

  /**
   * P2-10: exported Legado JSON keeps each source's static Cookie /
   * Authorization headers verbatim, so every export run first confirms the
   * credential exposure once, in the same system-dialog style the app uses
   * elsewhere (e.g. delete confirmation).
   */
  private confirmExportThen(action: () => void): void {
    const openingCurrent = (): boolean => this.mounted && (this.isOpeningCurrent?.() ?? true) &&
      AppStorage.get<boolean>('readerAppForeground') !== false;
    if (!openingCurrent() || this.snapshot.busy) return;
    const revision = this.exportRevision;
    const sourceRevision = this.snapshot.sourceListRevision;
    const selectionRevision = this.snapshot.selectionRevision;
    this.nativeAlertOwner.present((native: ReaderNativeAlertOptions): void => this.getUIContext().showAlertDialog(native), 'confirmation-cancelable', {
      title: '导出文件含登录凭据',
      message: '导出的书源 JSON 会原样保留 Cookie、Authorization 等登录凭据，' +
        '请勿转发给不可信的对象或公开渠道。是否继续导出？',
      primaryButton: {
        value: '继续导出',
        action: (): void => action(),
      },
      secondaryButton: {
        value: '取消',
        action: (): void => {},
      },
    }, (): boolean => openingCurrent() && !this.snapshot.busy && revision === this.exportRevision &&
      sourceRevision === this.snapshot.sourceListRevision && selectionRevision === this.snapshot.selectionRevision);
  }


  private onSnapshotChanged(): void {
    this.syncListDataSources();
    this.showTransientFeedback();
  }

  private feedbackIdentity(): string {
    return `${this.snapshot.receipt?.facts.generation ?? 0}:${this.snapshot.readFacts?.generation ?? 0}:` +
      `${this.snapshot.busy ? 1 : 0}:${this.snapshot.statusEvent}:${this.snapshot.statusMessage}`;
  }

  private showTransientFeedback(): void {
    const identity = this.feedbackIdentity();
    if (!this.mounted || identity === this.lastFeedbackIdentity) return;
    this.lastFeedbackIdentity = identity;
    if (this.snapshot.busy || this.snapshot.original?.blocked || this.snapshot.receipt?.receipt.confirmation === 'unknown' ||
      this.snapshot.statusEvent === 'batch' || this.snapshot.statusEvent === 'state') return;
    const read = this.snapshot.readFacts;
    if (read?.fact === 'failed' && !read.hasValue) return;
    const message = this.snapshot.statusMessage;
    if (message.length === 0) return;
    try {
      this.transientFeedback.show(() => this.getUIContext(), { message, duration: 2200 },
        (): boolean => this.mounted && (this.isOpeningCurrent?.() ?? true));
    } catch (_) {}
  }

  private syncListDataSources(): void {
    if (this.projectedSourceListRevision !== this.snapshot.sourceListRevision ||
      this.projectedSelectionRevision !== this.snapshot.selectionRevision ||
      this.projectedBusy !== this.snapshot.busy || this.projectedCanWrite !== this.canWriteSources()) {
      this.sourceDataSource.replace(
        this.snapshot.sources,
        this.snapshot.sourceListRevision,
        this.snapshot.selectedSourceIds,
        !this.snapshot.busy,
      );
      this.projectedSourceListRevision = this.snapshot.sourceListRevision;
      this.projectedSelectionRevision = this.snapshot.selectionRevision;
      this.projectedBusy = this.snapshot.busy;
      this.projectedCanWrite = this.canWriteSources();
    }

    const batchIdentity = this.batchResultsIdentity();
    if (batchIdentity !== this.projectedBatchResultsIdentity) {
      this.batchResultDataSource.replace(this.snapshot.batchCheck.results);
      this.projectedBatchResultsIdentity = batchIdentity;
    }

    const debugIdentity = this.debugLogsIdentity();
    if (debugIdentity !== this.projectedDebugLogsIdentity) {
      this.debugLogDataSource.replace(this.snapshot.debugLogs);
      this.projectedDebugLogsIdentity = debugIdentity;
    }
  }

  private batchResultsIdentity(): string {
    const results = this.snapshot.batchCheck.results;
    if (results.length === 0) {
      return '0';
    }
    const newest = results[0];
    return `${results.length}:${newest.sourceId}:${newest.traceId}:${newest.state}:${newest.message}`;
  }

  private batchControlsRenderKey(): string {
    return `${this.snapshot.sourceListRevision}:${this.snapshot.selectionRevision}:${this.snapshot.selectedSourceCount}:` +
      `${this.snapshot.busy ? 1 : 0}:${this.snapshot.batchCheck.phase}:${this.canWriteSources() ? 1 : 0}`;
  }

  private batchProgressRenderKey(): string {
    const progress = this.snapshot.batchCheck;
    return `${progress.phase}:${progress.total}:${progress.completed}:${progress.passed}:` +
      `${progress.failed}:${progress.errors}:${progress.currentIndex}:${progress.currentSourceId}:` +
      `${this.batchResultsIdentity()}`;
  }

  private debugLogsIdentity(): string {
    const logs = this.snapshot.debugLogs;
    if (logs.length === 0) {
      return `0:${this.snapshot.debugSourceId}`;
    }
    const first = logs[0];
    const last = logs[logs.length - 1];
    return `${this.snapshot.debugSourceId}:${logs.length}:${first.timestampMs}:${last.timestampMs}:` +
      `${last.state}:${last.message}`;
  }

  private batchCheckPercent(progress: SourceBatchCheckProgress): number {
    if (progress.total <= 0) {
      return 0;
    }
    return Math.min(100, Math.max(0, Math.round(progress.completed * 100 / progress.total)));
  }

  private batchCheckPhaseLabel(progress: SourceBatchCheckProgress): string {
    switch (progress.phase) {
      case 'running': return '检测中';
      case 'stopping': return '停止中';
      case 'completed': return '已完成';
      case 'stopped': return '已停止';
      case 'failed': return '已中断';
      default: return '';
    }
  }

  private batchResultLabel(result: SourceBatchCheckResult): string {
    if (result.state === 'passed') {
      return '所选项通过';
    }
    return result.state === 'failed' ? '所选项未通过' : '检测错误';
  }

}
