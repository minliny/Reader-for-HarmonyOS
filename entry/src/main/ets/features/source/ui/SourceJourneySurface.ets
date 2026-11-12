import type { ReaderNativeAlertOptions } from '../../../ui/platform/ReaderNativeAlertOwner';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { SourceManagementPage } from './SourceManagementPage';
import { SourceToolsPage } from './SourceToolsPage';
import type { SourceToolsSelection } from '../application/SourceToolsOrchestrator';
import { EMPTY_SOURCE_JOURNEY, SourceJourneyPresentation, type SourceJourneySnapshot,
  type SourceManagementViewState } from '../presentation/SourceJourneyPresentation';

@Component
export struct SourceJourneySurface {
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @Prop expandedLayout: boolean = false;
  @Prop reduceMotion: boolean = false;
  presentation: SourceJourneyPresentation = new SourceJourneyPresentation();
  /** Captured by the opening's keyed root builder. Stale nodes keep the old lease. */
  identity: string = '';
  showingTools: boolean = false;
  isInputAllowed: (() => boolean) | undefined = undefined;
  onBack: () => void = (): void => {};
  onOpenTools: () => void = (): void => {};
  onImport: (preferred?: string, fallback?: string) => void = (): void => {};
  onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string) => void =
    (_handler: (() => boolean) | undefined, _identity: string): void => {};
  onToolsTemporaryBackBridge: ((handler: (() => boolean) | undefined, identity: string) => void) | undefined = undefined;
  onShowDeleteAlert: (options: ReaderNativeAlertOptions, current: () => boolean) => void =
    (_options: ReaderNativeAlertOptions, _current: () => boolean): void => {};
  @State private view: SourceJourneySnapshot = EMPTY_SOURCE_JOURNEY;
  private unsubscribe: (() => void) | undefined;
  private mounted: boolean = false;

  aboutToAppear(): void {
    this.mounted = true;
    this.unsubscribe = this.presentation.observe((view: SourceJourneySnapshot): void => {
      if (this.showingTools ? this.presentation.tools(this.identity) !== undefined : this.presentation.isManagementCurrent(this.identity))
        this.view = view;
    });
  }

  aboutToDisappear(): void { this.mounted = false; this.unsubscribe?.(); this.unsubscribe = undefined; }

  private managementInputIsCurrent(): boolean {
    return this.mounted && (this.isInputAllowed?.() ?? true) && this.presentation.isManagementCurrent(this.identity);
  }

  private toolsInputIsCurrent(): boolean {
    return this.mounted && (this.isInputAllowed?.() ?? true) && this.presentation.tools(this.identity) !== undefined;
  }

  build() {
    if (this.showingTools) {
      this.toolsPage();
    } else {
      this.managementPage();
    }
  }

  @Builder
  private managementPage() {
    SourceManagementPage({
      isOpeningCurrent: (): boolean => this.presentation.isManagementCurrent(this.identity),
      isInputAllowed: (): boolean => this.managementInputIsCurrent(),
      onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string): void => {
        if (this.presentation.isManagementCurrent(this.identity)) this.onTemporaryBackBridge(handler, identity);
      },
      sources: this.view.sources,
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
        if (this.managementInputIsCurrent()) this.presentation.management(this.identity)?.checkSource(id, this.identity);
      },
      onLoginSource: (id: string, loginUrl: string): void => {
        if (this.managementInputIsCurrent()) this.presentation.management(this.identity)?.loginSource(id, loginUrl, this.identity);
      },
      onAddSource: (preferred?: string, fallback?: string): void => {
        if (this.managementInputIsCurrent()) this.onImport(preferred, fallback);
      },
      onOpenTools: (viewState: SourceManagementViewState): void => {
        if (this.managementInputIsCurrent() && this.presentation.retainManagementViewForTools(this.identity, viewState)) this.onOpenTools();
      },
      onRetryLoad: (): void => {
        if (this.managementInputIsCurrent()) this.presentation.management(this.identity)?.retryLoad(this.identity);
      },
    });
  }

  @Builder
  private toolsPage() {
    SourceToolsPage({
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
      onSelectAll: (): void => { if (this.toolsInputIsCurrent()) this.presentation.tools(this.identity)?.selectAll(); },
      onClearSelection: (): void => { if (this.toolsInputIsCurrent()) this.presentation.tools(this.identity)?.setSelection([]); },
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
