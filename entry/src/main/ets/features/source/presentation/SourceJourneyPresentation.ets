import type { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import type { BookSource } from '../application/SourceGateway';
import { SourceHost } from '../application/SourceHost';
import type { SourceImportCompletion, SourceManagementProjection,
  SourceManagementStatusKind } from '../application/SourceOrchestrator';
import { EMPTY_SOURCE_TOOLS_SNAPSHOT, SourceToolsOrchestrator, type SourceToolsSelection,
  type SourceToolsSnapshot } from '../application/SourceToolsOrchestrator';

export type SourceToolsEntry = 'header' | 'footer';

export interface SourceManagementViewState {
  searchQuery: string;
  status: string;
  category: string;
  group: string;
  anchorSourceId: string;
  anchorFallbackIndex?: number;
  toolsEntry?: SourceToolsEntry;
}

interface SourceToolsReturn {
  owner: ReaderRuntimeOwner;
  viewState: SourceManagementViewState;
  toolsOpened: boolean;
}

export interface SourceJourneySnapshot {
  readonly sources: BookSource[];
  readonly operation: SourceManagementProjection;
  readonly statusKind: SourceManagementStatusKind;
  readonly statusMessage: string;
  readonly searchActionLabel: string;
  readonly searchActionRevision: number;
  readonly tools: SourceToolsSnapshot;
}

export const EMPTY_SOURCE_JOURNEY: SourceJourneySnapshot = {
  sources: [], operation: { action: 'load', sourceId: '' }, statusKind: 'idle', statusMessage: '',
  searchActionLabel: '', searchActionRevision: 0, tools: EMPTY_SOURCE_TOOLS_SNAPSHOT,
};

interface SourceJourneyPatch {
  sources?: BookSource[];
  operation?: SourceManagementProjection;
  statusKind?: SourceManagementStatusKind;
  statusMessage?: string;
  searchActionLabel?: string;
  searchActionRevision?: number;
  tools?: SourceToolsSnapshot;
}

/** One presentation across source management and tools. Both Core operation
 * owners retain their existing transaction and recovery lifetimes. */
export class SourceJourneyPresentation {
  private view: SourceJourneySnapshot = EMPTY_SOURCE_JOURNEY;
  private observer: ((view: SourceJourneySnapshot) => void) | undefined;
  private managementOwner: ReaderRuntimeOwner | undefined;
  private managementLease: string = '';
  private toolsHost: SourceToolsOrchestrator | undefined;
  private toolsLease: string = '';
  private managementViewState: SourceManagementViewState | undefined;
  private toolsReturn: SourceToolsReturn | undefined;
  private searchAction: (() => void) | undefined;
  readonly registry: SourceHost = new SourceHost(
    (sources: BookSource[]): void => {
      if (this.isManagementCurrent(this.managementLease)) this.publish({ sources });
    },
    (statusKind: SourceManagementStatusKind, statusMessage: string): void => {
      if (this.isManagementCurrent(this.managementLease)) this.publish({ statusKind, statusMessage });
    },
    (operation: SourceManagementProjection): void => {
      if (this.isManagementCurrent(this.managementLease)) this.publish({ operation });
    },
  );

  snapshot(): SourceJourneySnapshot { return this.view; }

  observe(emit: (view: SourceJourneySnapshot) => void): () => void {
    this.observer = emit;
    emit(this.view);
    return (): void => { if (this.observer === emit) this.observer = undefined; };
  }

  managementIdentity(): string { return this.managementLease; }
  toolsIdentity(): string { return this.toolsLease; }

  isManagementCurrent(identity: string): boolean {
    const owner = this.managementOwner;
    return owner !== undefined && identity.length > 0 && this.managementLease === identity &&
      this.registry.isPresentationCurrent(owner, identity);
  }

  management(identity: string): SourceHost | undefined {
    return this.isManagementCurrent(identity) ? this.registry : undefined;
  }

  initialManagementViewState(identity: string): SourceManagementViewState | undefined {
    return this.isManagementCurrent(identity) ? this.managementViewState : undefined;
  }

  retainManagementViewForTools(identity: string, viewState: SourceManagementViewState): boolean {
    const owner = this.managementOwner;
    if (owner === undefined || !this.isManagementCurrent(identity)) return false;
    this.toolsReturn = { owner, viewState, toolsOpened: false };
    return true;
  }

  tools(identity: string): SourceToolsOrchestrator | undefined {
    const host = this.toolsHost;
    return this.toolsLease === identity && host?.isPresentationCurrent(identity) === true ? host : undefined;
  }

  openManagement(owner: ReaderRuntimeOwner, identity: string, current: () => boolean): void {
    if (!current() || this.managementLease === identity) return;
    this.retireManagement();
    const returning = this.toolsReturn;
    this.toolsReturn = undefined;
    this.managementViewState = returning?.owner === owner && returning.toolsOpened ? returning.viewState : undefined;
    // SourceHost emits its retained projection synchronously during binding.
    this.managementOwner = owner;
    this.managementLease = identity;
    if (this.registry.bindPresentation(owner, identity, current)) this.registry.open(identity);
  }

  openTools(owner: ReaderRuntimeOwner, identity: string, current: () => boolean): void {
    if (!current() || this.toolsLease === identity) return;
    const host = SourceToolsOrchestrator.forRuntime(owner);
    if (host === undefined) return;
    this.retireTools();
    const returning = this.toolsReturn;
    if (returning?.owner === owner) returning.toolsOpened = true;
    else this.toolsReturn = undefined;
    this.toolsHost = host;
    this.toolsLease = identity;
    const attached = (): boolean => this.toolsHost === host && this.toolsLease === identity && current();
    host.attachPresentation(identity, (tools: SourceToolsSnapshot): void => {
      if (attached()) this.publish({ tools });
    }, attached);
    host.open(this.view.sources);
  }

  retire(): void {
    // Root retires presentations at each navigation step. Keep a captured
    // handoff across Source → Tools → Source, and drop it if another route
    // takes an additional step before returning to this journey.
    if (this.managementOwner === undefined && this.toolsHost === undefined) this.toolsReturn = undefined;
    this.retireManagement();
    this.retireTools();
    this.searchAction = undefined;
    if (this.view.searchActionLabel.length > 0) this.publish({ searchActionLabel: '' });
  }

  importSources(identity: string, onlineUrl?: string, searchAction?: () => void): void {
    this.management(identity)?.importBookSources(onlineUrl, (completion: SourceImportCompletion): void => {
      if (!this.isManagementCurrent(identity)) return;
      const base = completion.refreshWarning ?? `Core 已导入 ${completion.importedCount} 个书源`;
      const message = completion.failureSummary === undefined ? `${base}。` : `${base}，${completion.failureSummary}`;
      this.setImportResult('书源导入完成', message, this.view.statusKind === 'warning' ? 'warning' : 'success', searchAction);
    }, (error: Error): void => {
      if (this.isManagementCurrent(identity)) this.setImportResult('书源导入失败', error.message, 'error');
    }, identity);
  }

  runSearchAction(identity: string, revision: number): void {
    if (!this.isManagementCurrent(identity) || revision !== this.view.searchActionRevision) return;
    const action = this.searchAction;
    this.searchAction = undefined;
    this.publish({ searchActionLabel: '', searchActionRevision: revision + 1 });
    action?.();
  }

  toolsForSelection(identity: string, selection: SourceToolsSelection): SourceToolsOrchestrator | undefined {
    const host = this.tools(identity);
    return host?.acceptsSelection(selection) === true ? host : undefined;
  }

  requestDelete(identity: string, selected: SourceToolsSelection, show: (count: number,
    confirm: () => void, current: () => boolean) => void): void {
    const host = this.toolsForSelection(identity, selected);
    if (host === undefined) return;
    const selection = host.consumeSelection(selected.sourceIds);
    if (selection.length === 0) return;
    const listRevision = this.view.tools.sourceListRevision;
    const selectionRevision = this.view.tools.selectionRevision;
    const current = (): boolean => this.tools(identity) === host && !this.view.tools.busy &&
      this.view.tools.sourceListRevision === listRevision && this.view.tools.selectionRevision === selectionRevision &&
      selection.every((id: string): boolean => this.view.tools.sources.some((source: BookSource): boolean => source.sourceId === id));
    show(selection.length, (): void => { if (current()) host.deleteSelected(selection); }, current);
  }

  private retireManagement(): void {
    this.registry.detachPresentation(this.managementLease);
    this.managementLease = '';
    this.managementOwner = undefined;
    this.managementViewState = undefined;
  }

  private retireTools(): void {
    this.toolsHost?.detachPresentation(this.toolsLease);
    this.toolsHost = undefined;
    this.toolsLease = '';
  }

  private setImportResult(title: string, message: string, statusKind: SourceManagementStatusKind,
    searchAction?: () => void): void {
    this.searchAction = searchAction;
    this.publish({ statusKind, statusMessage: `${title}：${message}`,
      searchActionLabel: searchAction === undefined ? '' : '重新搜索',
      searchActionRevision: this.view.searchActionRevision + (searchAction === undefined ? 1 : 2) });
  }

  private publish(patch: SourceJourneyPatch): void {
    const view = this.view;
    this.view = {
      sources: patch.sources ?? view.sources,
      operation: patch.operation ?? view.operation,
      statusKind: patch.statusKind ?? view.statusKind,
      statusMessage: patch.statusMessage ?? view.statusMessage,
      searchActionLabel: patch.searchActionLabel ?? view.searchActionLabel,
      searchActionRevision: patch.searchActionRevision ?? view.searchActionRevision,
      tools: patch.tools ?? view.tools,
    };
    this.observer?.(this.view);
  }
}
