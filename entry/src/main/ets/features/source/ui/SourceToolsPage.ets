import { ReaderEditingVisibility } from '../../../ui/layout/ReaderEditingVisibility';
import hilog from '@ohos.hilog';
import inputMethod from '@ohos.inputMethod';
import { LengthMetrics } from '@kit.ArkUI';
import { ReaderTransientFeedback } from '../../../ui/feedback/ReaderTransientFeedback';
import { ReaderStandardPage } from '../../../ui/layout/ReaderStandardPage';
import { ReaderPostLayoutFrame } from '../../../ui/layout/ReaderPostLayoutFrame';
import { ReaderButton } from '../../../ui/controls/ReaderButton';
import { ReaderSearchField } from '../../../ui/controls/ReaderSearchField';
import { resolveReaderButtonMatrixSize, resolveReaderButtonSpec } from '../../../ui/controls/ReaderControlSpecs';
import { readerPageAreaLength, readerStandardPageSpec } from '../../../ui/layout/ReaderPageShell';
import { readerReadableFontScale, readerScaledControlHeight } from '../../../ui/foundation/ReaderSurfaceResolvers';
import { resolveSourceToolsRowLayout, type SourceToolsRowLayout } from '../presentation/SourceToolsLayout';
import { ReaderCard } from '../../../ui/surfaces/ReaderCard';
import { ReaderCardSpecId, resolveReaderCardSpec } from '../../../ui/surfaces/ReaderCardSpecs';
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
  TYPE_APP_ROW_DETAIL,
  TYPE_APP_ROW_LABEL,
  TYPE_SOURCE_TOOLS_ACTION,
  TYPE_SOURCE_TOOLS_BODY,
  TYPE_SOURCE_TOOLS_CAPTION,
  TYPE_SOURCE_TOOLS_CODE_INPUT,
  TYPE_SOURCE_TOOLS_COMPACT_ACTION,
  TYPE_SOURCE_TOOLS_DEBUG_ID,
  TYPE_SOURCE_TOOLS_DEBUG_LOG,
  TYPE_SOURCE_TOOLS_DESCRIPTION,
  TYPE_SOURCE_TOOLS_HINT,
  TYPE_SOURCE_TOOLS_STATUS,
  TYPE_SOURCE_TOOLS_URL,
} from '../../../ui/foundation/ReaderTypography';
import {
  TOK_BORDER_W,
  TOK_RADIUS_PILL,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
} from '../../../ui/foundation/ReaderTokens';
import type { BookSource, SourceDebugLog } from '../application/SourceGateway';
import {
  type SourceBatchCheckProgress,
  type SourceBatchCheckResult,
  type SourceToolsSelection,
  type SourceToolsSnapshot,
  EMPTY_SOURCE_TOOLS_SNAPSHOT,
  filterSourceTools,
  sourceEditorReadbackPending,
} from '../application/SourceToolsOrchestrator';

let nextSourceToolsBackIdentity: number = 0;
type SourceToolsBatchAction = 'selectAll' | 'exportSelected' | 'check' | 'stop' | 'enable' | 'disable' | 'delete';
type SourceToolsRowAction = 'select' | 'edit' | 'debug';
type SourceToolsEditorAction = 'cancel' | 'save' | 'reconcile';

class SourceToolsListCard implements AttributeModifier<ListItemGroupAttribute> {
  private readonly specId: ReaderCardSpecId;
  private readonly scheme: string;

  constructor(specId: ReaderCardSpecId, scheme: string) {
    this.specId = specId;
    this.scheme = scheme;
  }

  applyNormalAttribute(instance: ListItemGroupAttribute): void {
    const spec = resolveReaderCardSpec(this.specId);
    instance.padding(spec.contentPadding ?? 0);
    instance.margin({ bottom: readerStandardPageSpec('tools').space });
    instance.backgroundColor(readerAppColor(spec.backgroundRole, this.scheme));
    instance.border({ width: spec.borderWidth, color: readerAppColor(spec.borderRole, this.scheme) });
    instance.borderRadius(spec.radius);
  }
}

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
  @Prop embeddedWide: boolean = false;
  private readonly editingHost: ReaderEditingVisibility = new ReaderEditingVisibility();
  private readonly pageScroller: Scroller = new Scroller();
  @Prop reduceMotion: boolean = false;
  private readonly transientFeedback: ReaderTransientFeedback = new ReaderTransientFeedback();
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerAppForeground') private appForeground: boolean = true;
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @State private sourceListWidth: number = 0;
  @State private overlayHostWidth: number = 0;
  @State private recoveryLeadingReserve: number = 0;
  @State private sourceQuery: string = '';
  private sourceQueryRevision: number = 0;
  private projectedSourceQuery: string = '';

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
  onSetVisibleSelection: (query: string, selected: boolean) => void = (_query: string, _selected: boolean): void => {};
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
  private observedEditorRevision: number = -1;
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
    this.observedEditorRevision = this.snapshot.editorRevision;
    this.onTemporaryBackBridge?.((): boolean => this.consumeKeyboardBack(identity), identity);
  }

  private toolsOpeningIsCurrent(identity: string): boolean {
    return this.appForeground && this.mounted && identity.length > 0 && identity === this.temporaryBackIdentity &&
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
    ReaderStandardPage({ floatingHeader: true, embeddedWide: this.embeddedWide, editingHost: this.editingHost,
      scroller: this.pageScroller,
      variant: 'tools',
      scrollOwner: 'native-list',
      header: (): void => { this.pageHeader(); },
      nativeListItems: (): void => { this.pageContent(); },
      boundedOverlayVisible: this.recoveryOverlayVisible(),
      boundedOverlayLeadingReserve: this.recoveryLeadingReserve,
      boundedOverlayContent: (): void => { this.recoveryAction(); },
    }).onAreaChange((_old: Area, next: Area): void => {
      if (!this.mounted) return;
      this.overlayHostWidth = readerPageAreaLength(next.width);
    });
  }

  @Builder
  private pageHeader() {
    PageBackBar({ floating: true, centered: true, elevation: 'floating', title: '批量管理与书源工具', backFocusId: 'reader-source-tools-back',
      onBack: this.toolsBackAction(this.temporaryBackIdentity) });
  }

  @Builder
  private pageContent() {
    ListItem() {
      Column({ space: readerStandardPageSpec('tools').space }) {
        Column({ space: readerStandardPageSpec('tools').space }) {
          this.statusCard();
          if (this.showsInlineRecovery()) { this.recoveryAction(); }
          this.exportCard();
        }.width('100%').onAreaChange((_old: Area, next: Area): void => {
          const height = readerPageAreaLength(next.height);
          if (this.mounted && Number.isFinite(height) && height > 0 && height !== this.recoveryLeadingReserve) {
            this.recoveryLeadingReserve = height;
          }
        });
        this.batchCard();
      }.width('100%');
    }.padding({ bottom: readerStandardPageSpec('tools').space });
    if (this.showsBatchProgress()) {
      ForEach([this.batchProgressRenderKey()], (_key: string): void => {
        ListItem() { this.batchCheckCard(); }.padding({ bottom: readerStandardPageSpec('tools').space });
      }, (key: string): string => `source-batch-progress:${key}`);
      if (this.showsBatchResults()) {
        this.batchResultsCard();
      }
    }
    this.sourceCard();
    if (this.snapshot.editorSourceId.length > 0) {
      // Retire the old native input and capture this editor's identity in its callbacks.
      ForEach([this.snapshot.editorRevision], (revision: number): void => {
        ListItem() { this.editorCard(revision); }.padding({ bottom: readerStandardPageSpec('tools').space });
      }, (revision: number): string => `source-editor:${revision}`);
    }
    this.debugCard();
  }

  private showsBatchProgress(): boolean {
    return this.snapshot.batchCheck.phase !== 'idle';
  }

  private showsBatchResults(): boolean {
    return this.showsBatchProgress() && this.snapshot.batchCheck.results.length > 0;
  }

  private revealNewEditor(): void {
    const revision = this.snapshot.editorRevision;
    if (this.observedEditorRevision === revision) return;
    this.observedEditorRevision = revision;
    if (!this.toolsInputIsCurrent() || this.snapshot.editorSourceId.length === 0) return;
    const opening = this.temporaryBackIdentity;
    const context = this.getUIContext();
    context.postFrameCallback(new ReaderPostLayoutFrame(context, (): void => {
      if (!this.toolsInputIsCurrent(opening) || revision !== this.snapshot.editorRevision ||
        this.snapshot.editorSourceId.length === 0) return;
      // The main actions and source list each occupy one outer list slot.
      // Only mounted progress and result sections can precede the editor.
      const index = 2 + Number(this.showsBatchProgress()) + Number(this.showsBatchResults());
      this.pageScroller.scrollToIndex(index, false, ScrollAlign.START);
    }));
  }

  @Builder
  private batchCard() {
    ReaderCard({ specId: 'editor-section' }) {
      ReaderSectionHeading({ variant: 'tool-card', title: `批量管理（已选 ${this.visibleSelectedIds().length}/${this.visibleSources().length}）` });
      ForEach([this.temporaryBackIdentity], (opening: string): void => {
        this.sourceSearch(opening);
      }, (opening: string): string => opening);
      Flex({ wrap: FlexWrap.Wrap, space: { main: LengthMetrics.vp(TOK_SPACE_XS), cross: LengthMetrics.vp(TOK_SPACE_XS) } }) {
        this.batchButton('selectAll');
        this.batchButton('exportSelected');
      }
      .width('100%');
      Flex({ wrap: FlexWrap.Wrap, space: { main: LengthMetrics.vp(TOK_SPACE_XS), cross: LengthMetrics.vp(TOK_SPACE_XS) } }) {
        if (this.snapshot.batchCheck.phase === 'running' || this.snapshot.batchCheck.phase === 'stopping') {
          this.batchButton('stop');
        } else {
          this.batchButton('check');
        }
        this.batchButton('enable');
        this.batchButton('disable');
        this.batchButton('delete');
      }
      .width('100%');
    }
  }

  @Builder
  private sourceSearch(opening: string) {
    ReaderSearchField({ editingHost: this.editingHost, variant: 'sourceManagement', mode: 'live', text: this.sourceQuery,
      editingCurrent: (): boolean => this.toolsInputIsCurrent(opening),
      placeholder: '搜索书源名称、域名或分组', accessibilityLabel: '筛选书源工具列表',
      onTextChange: (query: string): void => this.changeSourceQuery(opening, query) });
  }

  private visibleSources(): BookSource[] { return filterSourceTools(this.snapshot.sources, this.sourceQuery); }

  private visibleSelectedIds(): string[] {
    const visible = new Set<string>(this.visibleSources().map((source: BookSource): string => source.sourceId));
    return this.snapshot.selectedSourceIds.filter((sourceId: string): boolean => visible.has(sourceId));
  }

  private allVisibleSelected(): boolean {
    const count = this.visibleSources().length;
    return count > 0 && this.visibleSelectedIds().length === count;
  }

  private changeSourceQuery(opening: string, query: string): void {
    if (!this.toolsInputIsCurrent(opening) || query === this.sourceQuery) return;
    this.sourceQuery = query;
    this.sourceQueryRevision += 1;
    this.syncListDataSources();
  }

  @Builder
  private batchButton(action: SourceToolsBatchAction) {
    ReaderButton({ scheme: this.appThemeScheme, specId: 'source-tools-action',
      variant: action === 'delete' ? 'danger' : 'tonal', visualSize: 'medium',
      label: this.batchButtonLabel(action), actionEnabled: this.batchButtonEnabled(action),
      onAction: this.batchButtonAction(action) })
      .constraintSize({ minWidth: this.actionMinimumWidth(this.batchButtonLabel(action)), maxWidth: '100%' });
  }

  private batchButtonLabel(action: SourceToolsBatchAction): string {
    switch (action) {
      case 'selectAll': return this.allVisibleSelected() ? '取消全选' : '全选';
      case 'exportSelected': return '导出所选';
      case 'check': return '检测所选';
      case 'stop': return this.snapshot.batchCheck.phase === 'stopping' ? '停止中…' : '停止检测';
      case 'enable': return '启用';
      case 'disable': return '停用';
      case 'delete': return '删除';
    }
  }

  private batchButtonEnabled(action: SourceToolsBatchAction): boolean {
    const phase = this.snapshot.batchCheck.phase;
    if (action === 'stop') return phase === 'running';
    if (this.snapshot.busy) return false;
    if (action === 'selectAll') return this.visibleSources().length > 0;
    if (this.visibleSelectedIds().length === 0) return false;
    if (action === 'enable' || action === 'disable' || action === 'delete') return this.canWriteSources();
    return action !== 'check' || (phase !== 'running' && phase !== 'stopping');
  }

  private batchButtonAction(action: SourceToolsBatchAction): () => void {
    const opening = this.temporaryBackIdentity;
    return (): void => {
      if (!this.toolsInputIsCurrent(opening) || !this.batchButtonEnabled(action)) return;
      switch (action) {
        case 'selectAll': this.onSetVisibleSelection(this.sourceQuery, !this.allVisibleSelected()); break;
        case 'stop': this.onStopCheck(); break;
        case 'exportSelected':
          this.batchSelectionAction(this.batchControlsRenderKey(), (selection: SourceToolsSelection): void =>
            this.confirmExportThen((): void => this.onExportSelected(selection)))();
          break;
        case 'check': this.batchSelectionAction(this.batchControlsRenderKey(), this.onCheckSelected)(); break;
        case 'enable':
          this.batchSelectionAction(this.batchControlsRenderKey(), (selection: SourceToolsSelection): void =>
            this.onSetSelectedEnabled(selection, true))();
          break;
        case 'disable':
          this.batchSelectionAction(this.batchControlsRenderKey(), (selection: SourceToolsSelection): void =>
            this.onSetSelectedEnabled(selection, false))();
          break;
        case 'delete': this.batchSelectionAction(this.batchControlsRenderKey(), this.onDeleteSelected)(); break;
      }
    };
  }

  private batchSelectionAction(key: string, action: (selection: SourceToolsSelection) => void): () => void {
    const opening = this.temporaryBackIdentity;
    const revision = this.sourceQueryRevision;
    const selection: SourceToolsSelection = { sourceIds: this.visibleSelectedIds(), query: this.sourceQuery,
      sourceListRevision: this.snapshot.sourceListRevision, selectionRevision: this.snapshot.selectionRevision,
      isScopeCurrent: (): boolean => this.toolsInputIsCurrent(opening) && revision === this.sourceQueryRevision };
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
          .borderRadius(TOK_RADIUS_PILL);
      }
      .width('100%')
      .height(8)
      .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme))
      .borderRadius(TOK_RADIUS_PILL);
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
      Flex({ wrap: FlexWrap.Wrap, space: { main: LengthMetrics.vp(TOK_SPACE_XS), cross: LengthMetrics.vp(TOK_SPACE_XS) } }) {
        this.batchCounter((): string => `所选项通过 ${this.snapshot.batchCheck.passed}`, (): string => readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme));
        this.batchCounter((): string => `所选项未通过 ${this.snapshot.batchCheck.failed}`, (): string => readerAppColor('app.status.checkError', this.appThemeScheme));
        this.batchCounter((): string => `检测错误 ${this.snapshot.batchCheck.errors}`, (): string => readerAppColor('app.status.checkWarning', this.appThemeScheme));
        this.batchCounter((): string => `剩余 ${Math.max(0,
          this.snapshot.batchCheck.total - this.snapshot.batchCheck.completed)}`, (): string => readerAppColor('TOK_MUTED', this.appThemeScheme));
      }
      .width('100%');
      if (this.snapshot.batchCheck.phase === 'running' && this.snapshot.batchCheck.results.length === 0) {
        Text('每个书源完成后，结果会立即出现在这里。')
          .width('100%')
          .fontFamily(TYPE_SOURCE_TOOLS_HINT.fontFamily as string)
          .fontSize(TYPE_SOURCE_TOOLS_HINT.fontSizeFp)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
      }
    }
  }

  private batchResultKey(result: SourceBatchCheckResult): string {
    return JSON.stringify([result.sourceId, result.traceId, result.state]);
  }

  @Builder
  private batchResultsCard() {
    ListItemGroup({ header: (): void => { this.batchResultsHeader(); } }) {
      LazyForEach(this.batchResultDataSource, (result: SourceBatchCheckResult) => {
        ListItem() { this.batchResultRow(result); }
      }, (result: SourceBatchCheckResult): string => this.batchResultKey(result));
    }.attributeModifier(new SourceToolsListCard('task-diagnostics', this.appThemeScheme));
  }

  @Builder
  private batchResultsHeader() {
    ReaderSectionHeading({ variant: 'tool-card', title: '实时结果（最新在前）' });
  }

  @Builder
  private batchCounter(label: () => string, color: () => string) {
    Text(label())
      .constraintSize({ maxWidth: '100%' })
      .padding({ left: 8, right: 8, top: 4, bottom: 4 })
      .textAlign(TextAlign.Center)
      .fontFamily(TYPE_SOURCE_TOOLS_COMPACT_ACTION.fontFamily)
      .fontSize(TYPE_SOURCE_TOOLS_COMPACT_ACTION.fontSizeFp)
      .wordBreak(WordBreak.BREAK_WORD)
      .fontWeight(TYPE_SOURCE_TOOLS_COMPACT_ACTION.fontWeight)
      .fontColor(color())
      .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme))
      .borderRadius(TOK_RADIUS_PILL);
  }

  @Builder
  private batchResultRow(result: SourceBatchCheckResult) {
    Flex({ direction: this.toolsFontScale() > 1 ? FlexDirection.Column : FlexDirection.Row,
      alignItems: ItemAlign.Start,
      space: { main: LengthMetrics.vp(TOK_SPACE_XS) } }) {
      Column({ space: 3 }) {
        Text(result.sourceName)
          .width('100%')
          .fontFamily(TYPE_APP_ROW_LABEL.fontFamily)
          .fontSize(TYPE_APP_ROW_LABEL.fontSizeFp)
          .fontWeight(TYPE_APP_ROW_LABEL.fontWeight)
          .lineHeight(TYPE_APP_ROW_LABEL.lineHeightFp as number)
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
      .width(this.toolsFontScale() > 1 ? '100%' : undefined)
      .layoutWeight(this.toolsFontScale() > 1 ? 0 : 1)
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
    .padding({ top: 13, bottom: 13, left: TOK_SPACE_XS, right: TOK_SPACE_XS });
  }

  private recovery(): ReaderRecoveryView { return readerRecoveryView(this.snapshot.receipt, this.snapshot.readFacts, this.snapshot.confirmedParts ?? 0); }

  private hasPendingRecovery(): boolean {
    return this.snapshot.original?.blocked === true || this.snapshot.receipt?.receipt.confirmation === 'unknown';
  }

  private recoveryOverlayVisible(): boolean {
    return this.appForeground && this.snapshot.editorSourceId.length === 0 &&
      this.toolsInputIsCurrent() && this.hasPendingRecovery();
  }

  private hasDedicatedReadFailure(): boolean {
    const fact = this.snapshot.readFacts?.fact;
    return this.snapshot.sources.length === 0 && (fact === 'failed' || fact === 'refreshFailed');
  }

  private showsInlineRecovery(): boolean {
    if (this.hasPendingRecovery()) return false;
    const recovery = this.recovery();
    return recovery.canRetry && (!this.hasDedicatedReadFailure() || recovery.generation !== this.snapshot.readFacts?.generation);
  }

  private retryEmptyReadAction(opening: string): (generation: number) => void {
    return (generation: number): void => {
      const read = this.snapshot.readFacts;
      if (this.toolsInputIsCurrent(opening) && !this.snapshot.busy && !this.hasPendingRecovery() &&
        this.hasDedicatedReadFailure() && read?.generation === generation && read.canRetry) {
        this.onReconcile(generation);
      }
    };
  }
  private originalRecoveryIdentity(): string {
    const original = this.snapshot.original;
    return original === undefined ? '' :
      JSON.stringify([this.temporaryBackIdentity, original.operationId ?? '', original.generation]);
  }
  private isCurrentOriginalRecovery(identity: string, generation: number): boolean {
    const original = this.snapshot.original;
    return this.recoveryOverlayVisible() && original !== undefined && original.blocked &&
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
    ReaderRecoveryNotice({ layoutWidthVp: this.overlayWidth(), view: { visible: true, message: this.snapshot.original?.message ?? '', canRetry: true, generation },
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
      ReaderRecoveryNotice({ layoutWidthVp: this.overlayWidth(), view: this.recovery(), actionLabel: '核对',
        busy: this.snapshot.busy, onReconcile: this.unknownReceiptAction(this.temporaryBackIdentity) });
    } else if (this.recovery().canRetry) {
      ReaderRecoveryAction({ label: '刷新列表', generation: this.recovery().generation, onReconcile: this.onReconcile });
    }
  }
  private unknownReceiptAction(opening: string): (generation: number) => void {
    return (generation: number): void => {
      const receipt = this.snapshot.receipt;
      if (this.toolsInputIsCurrent(opening) && this.recoveryOverlayVisible() &&
        !this.snapshot.busy && this.snapshot.original?.blocked !== true &&
        receipt?.receipt.confirmation === 'unknown' && receipt.facts.canRetry && receipt.facts.generation === generation) {
        this.onReconcile(generation);
      }
    };
  }

  private overlayWidth(): number {
    return Math.max(0, (this.overlayHostWidth > 0 ? this.overlayHostWidth : ReaderWindowCoordinator.metrics().windowRect.width) - 40);
  }

  @Builder
  private statusCard() {
    if (!this.hasPendingRecovery()) {
      if (this.snapshot.sources.length === 0 && (this.snapshot.busy || this.hasDedicatedReadFailure() ||
        this.snapshot.readFacts?.fact === 'current' || this.snapshot.readFacts?.fact === 'empty')) {
        ReaderPageState({ title: this.snapshot.busy ? '正在读取书源' :
          (this.hasDedicatedReadFailure() ? '书源读取失败' : '暂无书源'),
          message: this.snapshot.busy ? '请稍候' :
            (this.hasDedicatedReadFailure() ? '请稍后重试。' : '返回书源管理后，可导入书源 JSON。'),
          loading: this.snapshot.busy,
          loadingActive: !this.reduceMotion,
          actionLabel: this.hasDedicatedReadFailure() && this.snapshot.readFacts?.canRetry ? '重试' : '',
          actionGeneration: this.snapshot.readFacts?.generation ?? 0,
          onAction: this.retryEmptyReadAction(this.temporaryBackIdentity) });
      } else if (this.snapshot.busy && this.snapshot.batchCheck.phase !== 'running' && this.snapshot.batchCheck.phase !== 'stopping') {
        ReaderPageState({ variant: 'inline', padded: false, loading: true,
          loadingActive: !this.reduceMotion, message: this.snapshot.statusMessage }).padding(17);
      }
    }
  }

  @Builder
  private exportCard() {
    ReaderCard({ specId: 'editor-section' }) {
      ReaderSectionHeading({ variant: 'tool-card', title: '书源导出' });
      Text('将书源备份为 Legado 兼容的 JSON 文件。')
        .width('100%')
        .fontFamily(TYPE_SOURCE_TOOLS_DESCRIPTION.fontFamily as string)
        .fontSize(TYPE_SOURCE_TOOLS_DESCRIPTION.fontSizeFp)
        .lineHeight(TYPE_SOURCE_TOOLS_DESCRIPTION.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
      this.fullWidthActionButton(`导出全部书源（${this.snapshot.sources.length}）`, true,
        (): void => this.confirmExportThen((): void => this.onExportAll()));
    }
  }

  @Builder
  private sourceCard() {
    ListItemGroup({ header: (): void => { this.sourceCardHeader(); } }) {
      LazyForEach(this.sourceDataSource, (row: SourceToolListRow) => {
        ListItem() { this.sourceRow(row); }
      }, (row: SourceToolListRow): string => this.sourceRowKey(row));
    }.attributeModifier(new SourceToolsListCard('bordered-list-section', this.appThemeScheme));
  }

  @Builder
  private sourceCardHeader() {
    Column({ space: TOK_SPACE_XS }) {
      ReaderSectionHeading({ variant: 'tool-card', title: `书源编辑（${this.visibleSources().length}）` });
      if (this.snapshot.sources.length > 0 && this.visibleSources().length === 0) {
        ForEach([this.temporaryBackIdentity], (opening: string): void => {
          ReaderPageState({ title: '没有匹配的书源', message: '更换关键词或清除筛选后重试。',
            actionLabel: '清除筛选', onAction: (): void => this.changeSourceQuery(opening, '') });
        }, (opening: string): string => opening);
      }
    }.width('100%').alignItems(HorizontalAlign.Start)
      .onAreaChange((_old: Area, next: Area): void => this.recordSourceListWidth(next));
  }

  @Builder
  private sourceRow(row: SourceToolListRow) {
        Flex({ direction: this.sourceRowLayout(this.currentSourceForRow(row)).inline ? FlexDirection.Row : FlexDirection.Column,
          space: { main: LengthMetrics.vp(TOK_SPACE_XS) } }) {
          this.sourceRowInfo(row);
          this.sourceRowButtons(row);
        }
        .width('100%')
        .constraintSize({ minHeight: this.sourceRowLayout(this.currentSourceForRow(row)).rowMinHeight })
        .padding(TOK_SPACE_XS)
        .border({ width: { bottom: TOK_BORDER_W }, color: readerAppColor('TOK_BORDER', this.appThemeScheme) });
  }

  @Builder
  private sourceRowInfo(row: SourceToolListRow) {
          Column({ space: 3 }) {
            Text(this.currentSourceForRow(row).name)
              .width('100%')
              .fontFamily(TYPE_APP_ROW_LABEL.fontFamily)
              .fontSize(TYPE_APP_ROW_LABEL.fontSizeFp)
              .fontWeight(TYPE_APP_ROW_LABEL.fontWeight)
              .lineHeight(TYPE_APP_ROW_LABEL.lineHeightFp as number)
              .maxFontScale(this.toolsFontScale())
              .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis });
            Text(this.currentSourceForRow(row).baseUrl)
              .width('100%')
              .fontFamily(TYPE_SOURCE_TOOLS_URL.fontFamily as string)
              .fontSize(TYPE_SOURCE_TOOLS_URL.fontSizeFp)
              .lineHeight(TYPE_SOURCE_TOOLS_URL.lineHeightFp ?? TYPE_SOURCE_TOOLS_URL.fontSizeFp * 1.5)
              .maxFontScale(this.toolsFontScale())
              .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
              .wordBreak(WordBreak.BREAK_ALL)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis });
            if (this.currentSourceForRow(row).lastCheckSummary !== undefined) {
              Text(this.currentSourceForRow(row).lastCheckSummary ?? '')
                .width('100%')
                .fontFamily(TYPE_APP_ROW_DETAIL.fontFamily)
                .fontWeight(TYPE_APP_ROW_DETAIL.fontWeight)
                .fontSize(TYPE_APP_ROW_DETAIL.fontSizeFp)
                .lineHeight(TYPE_APP_ROW_DETAIL.lineHeightFp as number)
                .maxFontScale(this.toolsFontScale())
                .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis });
            }
          }
          .layoutWeight(this.sourceRowLayout(this.currentSourceForRow(row)).inline ? 1 : 0)
          .width(this.sourceRowLayout(this.currentSourceForRow(row)).inline ? undefined : '100%')
          .constraintSize({ minWidth: this.sourceRowLayout(this.currentSourceForRow(row)).inline ?
            this.sourceRowLayout(this.currentSourceForRow(row)).textMinWidth : 0 })
          .alignItems(HorizontalAlign.Start);
  }

  @Builder
  private sourceRowButtons(row: SourceToolListRow) {
        Flex({ direction: FlexDirection.Row, wrap: FlexWrap.Wrap,
          space: { main: LengthMetrics.vp(TOK_SPACE_XS), cross: LengthMetrics.vp(TOK_SPACE_XS) } }) {
          this.sourceRowButton(row, 'select');
          this.sourceRowButton(row, 'edit');
          this.sourceRowButton(row, 'debug');
        }
        .width(this.sourceRowLayout(this.currentSourceForRow(row)).actionsWidth)
        .constraintSize({ minHeight: this.sourceRowLayout(this.currentSourceForRow(row)).actionsMinHeight })
        .flexShrink(0);
  }

  private sourceRowKey(row: SourceToolListRow): string {
    return row.source.sourceId;
  }

  private currentSourceForRow(row: SourceToolListRow): BookSource {
    return this.snapshot.sources.find((source: BookSource): boolean => source.sourceId === row.source.sourceId) ?? row.source;
  }

  private currentSourceToolRow(row: SourceToolListRow): SourceToolListRow | undefined {
    const source = this.visibleSources().find((value: BookSource): boolean => value.sourceId === row.source.sourceId);
    return source === undefined ? undefined : new SourceToolListRow(source, this.snapshot.sourceListRevision,
      this.snapshot.selectedSourceIds.includes(source.sourceId), !this.snapshot.busy);
  }

  @Builder
  private sourceRowButton(row: SourceToolListRow, action: SourceToolsRowAction) {
    ReaderButton({ scheme: this.appThemeScheme, specId: 'source-tools-compact',
      variant: action === 'select' && this.snapshot.selectedSourceIds.includes(row.source.sourceId) ? 'tonal' : 'subtle',
      visualSize: 'small',
      label: this.sourceRowButtonLabel(row, action), actionEnabled: this.sourceRowButtonEnabled(row, action),
      onAction: this.currentSourceRowAction(row, action) });
  }

  private sourceRowButtonLabel(row: SourceToolListRow, action: SourceToolsRowAction): string {
    if (action === 'select') return this.snapshot.selectedSourceIds.includes(row.source.sourceId) ? '已选' : '选择';
    return action === 'edit' ? '编辑' : '调试';
  }

  private sourceRowButtonEnabled(row: SourceToolListRow, action: SourceToolsRowAction): boolean {
    return this.currentSourceToolRow(row)?.actionsEnabled === true && (action !== 'edit' || this.canWriteSources());
  }

  private currentSourceRowAction(row: SourceToolListRow, action: SourceToolsRowAction): () => void {
    const opening = this.temporaryBackIdentity;
    return (): void => {
      if (!this.toolsInputIsCurrent(opening)) return;
      const current = this.currentSourceToolRow(row);
      if (current !== undefined) this.sourceRowAction(current, action)();
    };
  }

  private toolsFontScale(): number {
    if (this.readerWindowMetricsRevision < 0) return 1;
    return readerReadableFontScale(ReaderWindowCoordinator.metrics().systemFontScale);
  }

  private sourceRowLayout(source: BookSource): SourceToolsRowLayout {
    const action = resolveReaderButtonSpec('source-tools-compact');
    const compact = resolveReaderButtonMatrixSize('small');
    const scale = this.toolsFontScale();
    const titleHeight = TYPE_APP_ROW_LABEL.lineHeightFp as number;
    const urlHeight = TYPE_SOURCE_TOOLS_URL.lineHeightFp ?? TYPE_SOURCE_TOOLS_URL.fontSizeFp * 1.5;
    const summaryHeight = source.lastCheckSummary === undefined ? 0 :
      (TYPE_APP_ROW_DETAIL.lineHeightFp as number) * scale + 3;
    return resolveSourceToolsRowLayout({ listWidth: this.sourceListWidth, fontScale: scale,
      actionWidth: action.fixedWidth * scale,
      actionHeight: Math.max(44, readerScaledControlHeight(compact.height, compact.lineHeight, scale)),
      infoHeight: (titleHeight + urlHeight) * scale + 3 + summaryHeight,
      rowPadding: TOK_SPACE_XS, bottomBorderWidth: TOK_BORDER_W, gap: TOK_SPACE_XS });
  }

  private recordSourceListWidth(area: Area): void {
    if (!this.mounted) return;
    const width = readerPageAreaLength(area.width);
    if (Number.isFinite(width) && width > 0 && Math.abs(width - this.sourceListWidth) > 0.1)
      this.sourceListWidth = width;
  }

  private sourceRowAction(row: SourceToolListRow, action: SourceToolsRowAction): () => void {
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
        ReaderFormField({ editingHost: this.editingHost, scheme: this.appThemeScheme, specId: 'source-code', text: this.snapshot.editorText,
          placeholder: 'BookSource JSON', isEditable: this.editorDraftIsEditable(revision),
          onTextChange: this.editorDraftChange(revision, inputRevision) });
      }, (inputRevision: number): string => `source-editor-input:${revision}:${inputRevision}`);
      Flex({ wrap: FlexWrap.Wrap, space: { main: LengthMetrics.vp(TOK_SPACE_XS), cross: LengthMetrics.vp(TOK_SPACE_XS) } }) {
        this.editorButton(revision, 'cancel');
        this.editorButton(revision, 'save');
      }.width('100%');
      if (sourceEditorReadbackPending(this.snapshot.editorReadback)) {
        this.editorButton(revision, 'reconcile');
      }
    }
  }

  private debugOptionsCurrent(): boolean {
    return this.toolsInputIsCurrent() && !this.snapshot.busy;
  }

  @Builder
  private debugCard() {
    ListItemGroup({ header: (): void => { this.debugCardHeader(); } }) {
      LazyForEach(this.debugLogDataSource, (log: SourceDebugLog, index: number) => {
        ListItem() { this.debugLogRow(log, index); }
      }, (log: SourceDebugLog): string =>
        `debug-${log.sourceId ?? ''}-${log.traceId ?? ''}-${log.requestId ?? 0}-` +
          `${log.timestampMs}-${log.state}-${log.message}`);
    }.attributeModifier(new SourceToolsListCard('task-diagnostics', this.appThemeScheme));
  }

  @Builder
  private debugCardHeader() {
    Column({ space: TOK_SPACE_SM }) {
      Text(this.snapshot.debugSourceId.length > 0 ? '最近一次检测详情' : '书源调试')
        .width('100%').fontFamily(MESSAGE_TITLE.fontFamily).fontWeight(MESSAGE_TITLE.fontWeight)
        .fontSize(MESSAGE_TITLE.fontSizeFp).lineHeight(MESSAGE_TITLE.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_MESSAGE_INK', this.appThemeScheme));
      // Retire the previous native edit and its open choices when a task
      // takes ownership. Keep the log actors and the accepted text intact.
      ForEach([this.snapshot.busy], (busy: boolean): void => {
        Row({ space: TOK_SPACE_SM }) {
          ReaderInlineSelect({ reduceMotion: this.reduceMotion,
            value: this.snapshot.checkMode === 'explore' ? '发现' : '搜索',
            options: ['搜索', '发现'],
            selectedIndex: this.snapshot.checkMode === 'explore' ? 1 : 0,
            actionEnabled: !busy,
            onSelect: (index: number, _value: string): void => {
              if (!busy && this.debugOptionsCurrent())
                this.onCheckSelectionChanged(index === 1 ? 'explore' : 'search', this.snapshot.checkDepth);
            },
          });
          ReaderInlineSelect({ reduceMotion: this.reduceMotion,
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
          ReaderFormField({ editingHost: this.editingHost, scheme: this.appThemeScheme, specId: 'source-debug', text: this.snapshot.debugKey,
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
    }.width('100%').alignItems(HorizontalAlign.Start);
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
  private editorButton(revision: number, action: SourceToolsEditorAction) {
    ReaderButton({ scheme: this.appThemeScheme, specId: 'source-tools-action',
      label: this.editorButtonLabel(action), variant: action === 'save' ? 'primary' : 'subtle', visualSize: 'medium',
      actionEnabled: this.editorButtonEnabled(revision, action), layout: action === 'reconcile' ? 'full' : 'intrinsic',
      onAction: this.editorAction(revision, action) })
      .constraintSize({ minWidth: action === 'reconcile' ? undefined : this.actionMinimumWidth(this.editorButtonLabel(action)), maxWidth: '100%' });
  }

  private editorButtonLabel(action: SourceToolsEditorAction): string {
    switch (action) {
      case 'cancel': return '取消';
      case 'save': return '校验并保存';
      case 'reconcile': return '重新读取已保存书源';
    }
  }

  private editorButtonEnabled(revision: number, action: SourceToolsEditorAction): boolean {
    if (!this.toolsInputIsCurrent() || revision !== this.snapshot.editorRevision ||
      this.snapshot.editorSourceId.length === 0 || this.snapshot.busy) return false;
    if (action === 'save') return this.canWriteSources();
    const pending = sourceEditorReadbackPending(this.snapshot.editorReadback);
    if (action === 'reconcile') return pending;
    return !pending && this.snapshot.editorReadback?.confirmation !== 'unknown' && this.snapshot.original?.blocked !== true;
  }

  private actionMinimumWidth(label: string): number {
    const size = resolveReaderButtonMatrixSize('medium');
    const context = this.getUIContext();
    const width = context.px2vp(context.getMeasureUtils().measureText({
      textContent: label, fontSize: `${size.fontSize * this.toolsFontScale()}vp`,
      fontFamily: TYPE_SOURCE_TOOLS_ACTION.fontFamily, fontWeight: TYPE_SOURCE_TOOLS_ACTION.fontWeight }));
    return Math.max(44, Math.ceil(width) + size.horizontalPadding * 2);
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

  private editorAction(revision: number, action: SourceToolsEditorAction): () => void {
    const opening = this.temporaryBackIdentity;
    return (): void => {
      if (!this.toolsInputIsCurrent(opening) || !this.editorButtonEnabled(revision, action)) return;
      switch (action) {
        case 'reconcile': this.onReconcileEditor(revision); break;
        case 'save': this.onSaveEditor(revision); break;
        case 'cancel': this.onCancelEditor(revision); break;
      }
    };
  }

  @Builder
  private fullWidthActionButton(label: string, primary: boolean, action: () => void) {
    ReaderButton({ scheme: this.appThemeScheme, specId: 'source-tools-action', label,
      variant: primary ? 'primary' : 'tonal', visualSize: 'large',
      actionEnabled: !this.snapshot.busy && this.snapshot.sources.length > 0, layout: 'full', onAction: action });
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
    this.revealNewEditor();
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
      this.projectedSourceQuery !== this.sourceQuery ||
      this.projectedSelectionRevision !== this.snapshot.selectionRevision ||
      this.projectedBusy !== this.snapshot.busy || this.projectedCanWrite !== this.canWriteSources()) {
      this.sourceDataSource.replace(
        this.visibleSources(),
        this.snapshot.sourceListRevision,
        this.snapshot.selectedSourceIds,
        !this.snapshot.busy,
      );
      this.projectedSourceListRevision = this.snapshot.sourceListRevision;
      this.projectedSourceQuery = this.sourceQuery;
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
    return `${this.snapshot.sourceListRevision}:${this.snapshot.selectionRevision}:${this.sourceQueryRevision}:` +
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
