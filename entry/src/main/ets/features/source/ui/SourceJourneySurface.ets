import type { ReaderNativeAlertOptions } from '../../../ui/platform/ReaderNativeAlertOwner';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { SourceManagementPage } from './SourceManagementPage';
import { SourceToolsPage } from './SourceToolsPage';
import { SourceV9TransferPage } from './SourceV9TransferPage';
import { SourceV9GroupsPage } from './SourceV9GroupsPage';
import { SourceV9CheckDialog } from './SourceV9CheckDialog';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { errorMessageOf } from '../../../app/ErrorMessage';
import type { BookSource, SourceCheckOutcome, SourceGroupCatalogData,
  SourceGroupMutateParams, SourceGroupRecord } from '../application/SourceGateway';
import type { SourceV9CheckOptions } from '../application/SourceOrchestrator';
import type { SourceV9ImportedReport } from '../application/SourceV9TransferState';
import type { SourceV9ConfirmedImport } from '../application/SourceV9TransferOwner';
import { sourceV9GroupRows, sourceV9ParentView, sourceV9Supports, type SourceV9ListAction,
  type SourceV9View } from '../presentation/SourceManagementV9';
import type { SourceToolsSelection } from '../application/SourceToolsOrchestrator';
import { EMPTY_SOURCE_JOURNEY, SourceJourneyPresentation, type SourceJourneySnapshot,
  type SourceManagementViewState } from '../presentation/SourceJourneyPresentation';

@Component
export struct SourceJourneySurface {
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @Prop expandedLayout: boolean = false;
  @Prop embeddedWide: boolean = false;
  @Prop reduceMotion: boolean = false;
  @Prop inputEnabled: boolean = true;
  presentation: SourceJourneyPresentation = new SourceJourneyPresentation();
  /** Captured by the opening's keyed root builder. Stale nodes keep the old lease. */
  identity: string = '';
  showingTools: boolean = false;
  isInputAllowed: (() => boolean) | undefined = undefined;
  onBack: () => void = (): void => {};
  onOpenTools: () => void = (): void => {};
  captureImportSearchAction: (() => (() => void) | undefined) | undefined = undefined;
  onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string) => void =
    (_handler: (() => boolean) | undefined, _identity: string): void => {};
  onToolsTemporaryBackBridge: ((handler: (() => boolean) | undefined, identity: string) => void) | undefined = undefined;
  onShowDeleteAlert: (options: ReaderNativeAlertOptions, current: () => boolean) => void =
    (_options: ReaderNativeAlertOptions, _current: () => boolean): void => {};
  @State private view: SourceJourneySnapshot = EMPTY_SOURCE_JOURNEY;
  @State private pane: SourceV9View = 'list';
  @State private catalog: SourceGroupCatalogData | undefined = undefined;
  @State private catalogError: string = '';
  @State private projectedRows: BookSource[] = [];
  @State private detailGroupId: string | undefined = undefined;
  @State private moveSourceIds: string[] = [];
  @State private checkSourceIds: string[] = [];
  @State private checkTitle: string = '';
  @State private checkBatch: boolean = false;
  @State private batchApplied: number = 0;
  @State private ungroupedBatchIds: string[] = [];
  private catalogGeneration: number = 0;
  private importSearchAction: (() => void) | undefined = undefined;
  private listBack: (() => boolean) | undefined = undefined;
  private paneBack: (() => boolean) | undefined = undefined;
  private checkBack: (() => boolean) | undefined = undefined;
  private unsubscribe: (() => void) | undefined;
  private mounted: boolean = false;

  aboutToAppear(): void {
    this.mounted = true;
    this.unsubscribe = this.presentation.observe((view: SourceJourneySnapshot): void => {
      if (this.showingTools ? this.presentation.tools(this.identity) !== undefined : this.presentation.isManagementCurrent(this.identity)) {
        this.view = view;
        this.projectedRows = sourceV9GroupRows(view.sources, this.catalog);
      }
    });
    if (!this.showingTools) {
      this.onTemporaryBackBridge((): boolean => this.consumeBack(), this.identity);
      void this.refreshCatalog();
    }
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    if (!this.showingTools) this.onTemporaryBackBridge(undefined, this.identity);
  }

  private async refreshCatalog(): Promise<void> {
    const generation = ++this.catalogGeneration;
    const host = this.presentation.management(this.identity);
    if (host === undefined) return;
    try {
      const catalog = await host.loadGroups(this.identity);
      if (!this.mounted || generation !== this.catalogGeneration) return;
      this.catalogError = '';
      this.publishCatalog(catalog);
    } catch (error) {
      if (this.mounted && generation === this.catalogGeneration) this.catalogError = errorMessageOf(error);
    }
  }

  private publishCatalog(catalog: SourceGroupCatalogData): void {
    if (this.catalog !== undefined && catalog.revision < this.catalog.revision) return;
    this.catalog = catalog;
    this.projectedRows = sourceV9GroupRows(this.view.sources, catalog);
  }

  private async mutateGroup(params: SourceGroupMutateParams): Promise<void> {
    const host = this.presentation.management(this.identity);
    if (!this.managementInputIsCurrent() || host === undefined) throw new Error('书源页面已关闭');
    try {
      const catalog = await host.mutateGroup(params, this.identity);
      if (!this.mounted || this.presentation.management(this.identity) !== host) return;
      this.catalogError = '';
      this.publishCatalog(catalog);
    } catch (error) {
      if (this.mounted && this.presentation.management(this.identity) === host) await this.refreshCatalog();
      throw error as Error;
    }
  }

  private consumeBack(): boolean {
    if (!this.managementInputIsCurrent()) return false;
    if (this.checkSourceIds.length > 0) {
      if (this.checkBack?.() !== true) this.checkSourceIds = [];
      return true;
    }
    if (this.paneBack?.() === true) return true;
    if (this.moveSourceIds.length > 0) {
      this.moveSourceIds = [];
      return true;
    }
    const parent = sourceV9ParentView(this.pane);
    if (parent !== undefined) {
      this.openPane(parent);
      return true;
    }
    return this.listBack?.() === true;
  }

  private openPane(pane: SourceV9View): void {
    if (!this.managementInputIsCurrent()) return;
    if (pane !== 'group-detail') this.detailGroupId = undefined;
    if (pane === 'import') {
      this.presentation.retireImportSearchAction(this.identity);
      this.importSearchAction = this.captureImportSearchAction?.();
    }
    this.pane = pane;
    if (pane === 'groups' || pane === 'import') void this.refreshCatalog();
  }

  private openCheck(ids: string[], title: string, batch: boolean): void {
    if (!this.managementInputIsCurrent()) return;
    const selected = new Set(ids);
    this.checkTitle = title;
    this.checkBatch = batch;
    this.checkSourceIds = this.projectedRows.filter((source: BookSource): boolean =>
      sourceV9Supports(source) && selected.has(source.sourceId)).map((source: BookSource): string => source.sourceId);
  }

  private listAction(action: SourceV9ListAction, ids: string[]): void {
    if (!this.managementInputIsCurrent()) return;
    const host = this.presentation.management(this.identity);
    if (action === 'subscriptions' || action === 'groups') this.openPane(action);
    else if (action === 'detect') this.openCheck(ids, '批量检测', true);
    else if (action === 'export') host?.exportAll(this.identity);
    else if (action === 'enable' || action === 'disable') host?.toggleSources(ids, action === 'enable', this.identity);
    else if (action === 'move') {
      this.moveSourceIds = ids.slice();
      void this.refreshCatalog();
    } else if (action === 'delete') {
      this.confirmSourceDeletion(ids);
    }
  }

  private confirmSourceDeletion(ids: string[]): void {
    const current = (): boolean => this.managementInputIsCurrent() && this.pane === 'list';
    this.onShowDeleteAlert({
      title: '删除书源', message: `确定删除所选 ${ids.length} 个书源吗？`,
      primaryButton: { value: '取消', action: (): void => {} },
      secondaryButton: { value: '删除', fontColor: readerAppColor('app.action.nativeDestructive', this.scheme),
        action: (): void => {
          if (current()) this.presentation.management(this.identity)?.deleteSources(ids, this.identity);
        } },
    }, current);
  }

  private listIsInteractive(): boolean {
    return this.pane === 'list' && this.checkSourceIds.length === 0 && this.moveSourceIds.length === 0;
  }

  private managementInputIsCurrent(): boolean {
    return this.mounted && this.inputEnabled && (this.isInputAllowed?.() ?? true) && this.presentation.isManagementCurrent(this.identity);
  }

  private toolsInputIsCurrent(): boolean {
    return this.mounted && (this.isInputAllowed?.() ?? true) && this.presentation.tools(this.identity) !== undefined;
  }

  build() {
    if (this.showingTools) {
      this.toolsPage();
    } else {
      this.managementJourney();
    }
  }

  @Builder
  private managementJourney() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.managementPage();
      if (this.pane === 'import' || this.pane === 'subscriptions') {
        SourceV9TransferPage({
          pane: this.pane === 'import' ? 'import' : 'subscriptions', embeddedWide: this.embeddedWide,
          owner: this.presentation.runtime(this.identity), groups: this.catalog?.groups ?? [],
          isInputAllowed: (): boolean => this.managementInputIsCurrent(),
          onTemporaryBackBridge: (handler: (() => boolean) | undefined): void => { this.paneBack = handler; },
          onBack: (): void => this.openPane('list'),
          onReadBack: (reports: SourceV9ImportedReport[], imported?: SourceV9ConfirmedImport): void => {
            void this.presentation.readBackTransfer(this.identity, reports, imported,
              imported === undefined ? undefined : this.importSearchAction);
            void this.refreshCatalog();
          },
        });
      }
      if (this.pane === 'groups' || this.pane === 'group-detail' || this.moveSourceIds.length > 0) {
        if (this.catalogError.length > 0 && this.catalog === undefined) {
          Column() {
            ReaderPageState({ title: '书源分组读取失败', message: this.catalogError,
              actionLabel: '重试', onAction: (_generation: number): void => { void this.refreshCatalog(); },
              secondaryActionLabel: '返回', onSecondaryAction: (_generation: number): void => { this.consumeBack(); } });
          }.width('100%').height('100%').justifyContent(FlexAlign.Center)
            .backgroundColor(readerAppColor('TOK_PAPER', this.scheme));
        } else {
          this.groupsPage();
        }
      }
      if (this.checkSourceIds.length > 0) {
        SourceV9CheckDialog({
          sources: this.checkRows(), title: this.checkTitle, batch: this.checkBatch,
          inputEnabled: this.inputEnabled,
          onCheck: (id: string, options: SourceV9CheckOptions, current: () => boolean,
            onStage: (stage: string) => void): Promise<SourceCheckOutcome | undefined> =>
            this.presentation.management(this.identity)?.runSourceCheck(id, options,
              (): boolean => this.mounted && current(), onStage, this.identity) ?? Promise.resolve(undefined),
          onClose: (): void => { this.checkSourceIds = []; },
          onTemporaryBackBridge: (handler: (() => boolean) | undefined): void => { this.checkBack = handler; },
        });
      }
    }.width('100%').height('100%');
  }

  private checkRows(): BookSource[] {
    return this.projectedRows.filter((row: BookSource): boolean => this.checkSourceIds.includes(row.sourceId));
  }

  private catalogGroupNames(): string[] {
    return (this.catalog?.groups ?? []).map((group: SourceGroupRecord): string => group.name);
  }

  @Builder
  private groupsPage() {
    SourceV9GroupsPage({
      catalog: this.catalog, sources: this.projectedRows, detailGroupId: this.detailGroupId,
      moveOnly: this.pane === 'list', moveSourceIds: this.moveSourceIds,
      inputEnabled: this.inputEnabled && this.checkSourceIds.length === 0,
      isInputAllowed: (): boolean => this.managementInputIsCurrent() && this.checkSourceIds.length === 0,
      onBack: (): void => { this.consumeBack(); },
      onOpenGroup: (groupId: string): void => {
        if (this.managementInputIsCurrent()) {
          this.detailGroupId = groupId;
          this.openPane('group-detail');
        }
      },
      onCloseMove: (applied?: boolean): void => {
        this.moveSourceIds = [];
        if (applied === true) this.batchApplied += 1;
      },
      statusKind: this.view.statusKind, statusMessage: this.view.statusMessage,
      onMutate: (params: SourceGroupMutateParams): Promise<void> => this.mutateGroup(params),
      onToggle: (ids: string[], enabled: boolean): void => {
        if (this.managementInputIsCurrent())
          this.presentation.management(this.identity)?.toggleSources(ids, enabled, this.identity);
      },
      onCheck: (ids: string[], group?: boolean): void => this.openCheck(ids, group === true ? '整组检测' : '书源检测报告', group === true),
      onLogin: (id: string, url: string): void => {
        if (this.managementInputIsCurrent()) this.presentation.management(this.identity)?.loginSource(id, url, this.identity);
      },
      onBatchUngrouped: (ids: string[]): void => {
        if (!this.managementInputIsCurrent()) return;
        this.ungroupedBatchIds = ids.slice();
        this.openPane('list');
      },
      onTemporaryBackBridge: (handler: (() => boolean) | undefined): void => { this.paneBack = handler; },
    });
  }

  @Builder
  private managementPage() {
    SourceManagementPage({
      embeddedWide: this.embeddedWide,
      v9Pane: this.pane,
      verificationOpening: this.identity,
      inputEnabled: this.inputEnabled && this.listIsInteractive(),
      isOpeningCurrent: (): boolean => this.presentation.isManagementCurrent(this.identity),
      isInputAllowed: (): boolean => this.managementInputIsCurrent() && this.listIsInteractive(),
      onTemporaryBackBridge: (handler: (() => boolean) | undefined, _identity: string): void => { this.listBack = handler; },
      sources: this.projectedRows, catalogGroupNames: this.catalogGroupNames(), ungroupedBatchIds: this.ungroupedBatchIds, batchApplied: this.batchApplied,
      initialViewState: this.presentation.initialManagementViewState(this.identity),
      operation: this.view.operation,
      statusKind: this.view.statusKind,
      statusMessage: this.view.statusMessage,
      statusActionLabel: this.view.searchActionLabel,
      statusActionGeneration: this.view.searchActionRevision,
      expandedLayout: this.expandedLayout,
      reduceMotion: this.reduceMotion,
      onReconcile: (expected: number): void => {
        if (this.managementInputIsCurrent()) this.presentation.management(this.identity)?.reconcile(expected, this.identity);
      },
      onContinueOriginal: (expected: number): void => {
        if (this.managementInputIsCurrent()) this.presentation.management(this.identity)?.continueOriginal(expected, this.identity);
      },
      onStatusAction: (revision: number): void => {
        if (this.managementInputIsCurrent()) this.presentation.runSearchAction(this.identity, revision);
      },
      onBack: (): void => { if (this.managementInputIsCurrent()) this.onBack(); },
      onToggleSource: (id: string, enabled: boolean): void => {
        if (this.managementInputIsCurrent()) this.presentation.management(this.identity)?.toggleSource(id, enabled, this.identity);
      },
      onDetectSource: (id: string): void => {
        this.openCheck([id], '书源检测报告', false);
      },
      onLoginSource: (id: string, loginUrl: string): void => {
        if (this.managementInputIsCurrent()) this.presentation.management(this.identity)?.loginSource(id, loginUrl, this.identity);
      },
      onAddSource: (): void => this.openPane('import'),
      onV9Action: (action: SourceV9ListAction, ids: string[]): void => this.listAction(action, ids),
      onOpenTools: (viewState: SourceManagementViewState): void => {
        if (this.managementInputIsCurrent() && this.presentation.retainManagementViewForTools(this.identity, viewState)) this.onOpenTools();
      },
      onRetryLoad: (): void => {
        if (this.managementInputIsCurrent()) this.presentation.management(this.identity)?.retryLoad(this.identity);
      },
    }).visibility(this.pane === 'list' ? Visibility.Visible : Visibility.Hidden)
      .accessibilityLevel(this.listIsInteractive() ? 'auto' : 'no-hide-descendants');
  }

  @Builder
  private toolsPage() {
    SourceToolsPage({ reduceMotion: this.reduceMotion, embeddedWide: this.embeddedWide,
      snapshot: this.view.tools,
      isOpeningCurrent: (): boolean => this.presentation.tools(this.identity) !== undefined,
      isInputAllowed: (): boolean => this.toolsInputIsCurrent(),
      onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string): void => {
        if (handler === undefined || this.presentation.tools(this.identity) !== undefined)
          this.onToolsTemporaryBackBridge?.(handler, identity);
      },
      onReconcile: (expected: number): void => {
        if (this.toolsInputIsCurrent()) this.presentation.tools(this.identity)?.reconcile(expected);
      },
      onContinueOriginal: (expected: number): void => {
        if (this.toolsInputIsCurrent()) this.presentation.tools(this.identity)?.continueOriginal(expected);
      },
      onSetVisibleSelection: (query: string, selected: boolean): void => {
        if (this.toolsInputIsCurrent()) this.presentation.tools(this.identity)?.setVisibleSelection(query, selected);
      },
      onToggleSelection: (sourceId: string): void => {
        if (this.toolsInputIsCurrent()) this.presentation.tools(this.identity)?.toggleSelection(sourceId);
      },
      onBack: (): void => { if (this.toolsInputIsCurrent()) this.onBack(); },
      onExportAll: (): void => { if (this.toolsInputIsCurrent()) this.presentation.tools(this.identity)?.exportAll(); },
      onExportSelected: (selection: SourceToolsSelection): void => {
        if (!this.toolsInputIsCurrent()) return;
        const host = this.presentation.toolsForSelection(this.identity, selection);
        host?.exportSelected(host.consumeSelection(selection.sourceIds));
      },
      onCheckSelected: (selection: SourceToolsSelection): void => {
        if (this.toolsInputIsCurrent()) this.presentation.toolsForSelection(this.identity, selection)?.checkSelected(selection.sourceIds);
      },
      onStopCheck: (): void => { if (this.toolsInputIsCurrent()) this.presentation.tools(this.identity)?.stopCheckSelected(); },
      onSetSelectedEnabled: (selection: SourceToolsSelection, enabled: boolean): void => {
        if (!this.toolsInputIsCurrent()) return;
        const host = this.presentation.toolsForSelection(this.identity, selection);
        host?.setSelectedEnabled(host.consumeSelection(selection.sourceIds), enabled);
      },
      onDeleteSelected: (selection: SourceToolsSelection): void => {
        if (this.toolsInputIsCurrent()) this.presentation.requestDelete(this.identity, selection,
          (count: number, confirm: () => void, current: () => boolean): void => this.confirmDeletion(count, confirm, current));
      },
      onOpenEditor: (sourceId: string): void => {
        if (this.toolsInputIsCurrent()) this.presentation.tools(this.identity)?.openEditor(sourceId);
      },
      onEditorDraftChanged: (value: string, revision: number): void => {
        if (this.toolsInputIsCurrent()) this.presentation.tools(this.identity)?.updateEditorDraft(value, revision);
      },
      onSaveEditor: (revision: number): void => {
        if (this.toolsInputIsCurrent()) this.presentation.tools(this.identity)?.saveEditor(revision);
      },
      onReconcileEditor: (revision: number): void => {
        if (this.toolsInputIsCurrent()) this.presentation.tools(this.identity)?.reconcileEditor(revision);
      },
      onCancelEditor: (revision: number): void => {
        if (this.toolsInputIsCurrent()) this.presentation.tools(this.identity)?.cancelEditor(revision);
      },
      onDebugKeyChanged: (value: string): void => {
        if (this.toolsInputIsCurrent()) this.presentation.tools(this.identity)?.updateDebugKey(value);
      },
      onCheckSelectionChanged: (mode: 'search' | 'explore', depth: number): void => {
        if (this.toolsInputIsCurrent()) this.presentation.tools(this.identity)?.updateCheckSelection(mode, depth);
      },
      onDebugSource: (sourceId: string): void => {
        if (this.toolsInputIsCurrent()) this.presentation.tools(this.identity)?.debugSource(sourceId);
      },
    });
  }

  private confirmDeletion(count: number, confirm: () => void, current: () => boolean): void {
    const inputCurrent = (): boolean => this.toolsInputIsCurrent() && current();
    if (!inputCurrent()) return;
    this.onShowDeleteAlert({
      title: '删除书源',
      message: `确定删除所选 ${count} 个书源吗？相关 Host 登录会话也会清除，删除后无法恢复。`,
      primaryButton: { value: '取消', action: (): void => {} },
      secondaryButton: { value: '删除', fontColor: readerAppColor('app.action.nativeDestructive', this.scheme),
        action: (): void => { if (inputCurrent()) confirm(); } },
    }, inputCurrent);
  }
}
