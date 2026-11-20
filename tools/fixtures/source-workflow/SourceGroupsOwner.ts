import { ReaderRuntimeOwner } from '../../../entry/src/main/ets/app/ReaderRuntimeOwner';
import { errorMessageOf } from '../../../entry/src/main/ets/app/ErrorMessage';
import { SourceGateway } from '../../../entry/src/main/ets/features/source/SourceGateway';
import { SourceGroupGateway } from '../../../entry/src/main/ets/features/source/SourceGroupGateway';
import type { SourceGroupMutation, SourceGroupReceipt } from '../../../entry/src/main/ets/features/source/SourceGroupTypes';
import { emptySourceGroupManagement, sourceGroupCommand, sourceGroupName, sourceGroupNameError,
  type SourceGroupManagementSnapshot, type SourceGroupIntent } from '../../../entry/src/main/ets/features/source/SourceGroupManagementModel';

/** Presentation state survives its views. All persistence/ACK ownership stays in Core and RulesMutationOwner. */
export class SourceGroupsOwner {
  private static readonly owners: WeakMap<ReaderRuntimeOwner, SourceGroupsOwner> = new WeakMap();
  static forRuntime(runtime: ReaderRuntimeOwner): SourceGroupsOwner | undefined {
    if (!ReaderRuntimeOwner.isCurrent(runtime)) return undefined;
    let owner = SourceGroupsOwner.owners.get(runtime);
    if (owner === undefined) { owner = new SourceGroupsOwner(runtime); SourceGroupsOwner.owners.set(runtime, owner); }
    return owner;
  }
  private readonly runtime: ReaderRuntimeOwner;
  private readonly gateway: SourceGroupGateway;
  private readonly sources: SourceGateway;
  private state: SourceGroupManagementSnapshot = emptySourceGroupManagement();
  private identity: string = '';
  private emit: (snapshot: SourceGroupManagementSnapshot) => void = (): void => {};
  private admitted: () => boolean = (): boolean => false;
  private readGeneration: number = 0;
  private writeGeneration: number = 0;
  private readonly receiptListeners: Set<(snapshot: SourceGroupManagementSnapshot) => void> = new Set();
  private constructor(runtime: ReaderRuntimeOwner) { this.runtime = runtime; this.gateway = new SourceGroupGateway(runtime); this.sources = new SourceGateway(runtime); }
  current(): SourceGroupManagementSnapshot { return { ...this.state, sourceIds: this.state.sourceIds.slice(), sources: this.state.sources.slice() }; }
  subscribeReceipt(listener: (snapshot: SourceGroupManagementSnapshot) => void): () => void {
    this.receiptListeners.add(listener);
    if (this.state.receipt !== undefined) listener(this.current());
    return (): void => { this.receiptListeners.delete(listener); };
  }
  attachPresentation(identity: string, emit: (snapshot: SourceGroupManagementSnapshot) => void, current: () => boolean): boolean {
    if (identity.length === 0 || !ReaderRuntimeOwner.isCurrent(this.runtime) || !current()) return false;
    this.identity = identity; this.emit = emit; this.admitted = current;
    this.patch({ original: this.gateway.snapshot() }); return true;
  }
  detachPresentation(identity: string): void { if (this.identity !== identity) return; this.identity = ''; this.emit = (): void => {}; this.admitted = (): boolean => false; }
  open(identity: string): void { if (this.accepts(identity)) void this.refresh(); }
  beginAssignment(sourceIds: string[], identity: string): void {
    if (!this.accepts(identity) || this.state.busy || this.gateway.snapshot().blocked) return;
    const ids = [...new Set(sourceIds)];
    this.patch({ view: 'assign', sourceIds: ids, targetGroupId: this.commonGroup(ids), query: '', error: '', receipt: undefined });
    const target = this.state.targetGroupId;
    void this.refresh().then((): void => {
      if (this.state.view === 'assign' && this.state.targetGroupId === target &&
        JSON.stringify(this.state.sourceIds) === JSON.stringify(ids)) this.patch({ targetGroupId: this.commonGroup(ids) });
    });
  }
  dispatch(intent: SourceGroupIntent, identity: string): void {
    if (!this.accepts(identity)) return;
    if (intent.type === 'refresh') { void this.refresh(); return; }
    if (intent.type === 'reconcile') { if (intent.generation === this.state.original?.generation) void this.reconcile(intent.continueOriginal); return; }
    if (this.state.busy) return;
    if (intent.type === 'back') { this.patch({ view: 'directory', error: '', query: '', receipt: undefined }); return; }
    if (intent.type === 'query') { this.patch({ query: intent.value }); return; }
    if (intent.type === 'name') { this.patch({ name: intent.value, error: '' }); return; }
    if (intent.type === 'target') { this.patch({ targetGroupId: intent.groupId, error: '' }); return; }
    if (intent.type === 'create') { this.patch({ view: 'create', name: '', groupId: '', error: '' }); return; }
    if (intent.type === 'rename' || intent.type === 'delete') {
      if (!this.state.catalog.groups.some(group => group.groupId === intent.groupId)) { this.patch({ error: '该分组已不存在，请刷新后重选' }); return; }
      this.patch({ view: intent.type, groupId: intent.groupId, name: sourceGroupName(this.state.catalog, intent.groupId), targetGroupId: '', error: '' }); return;
    }
    if (intent.type === 'addMembers') { this.patch({ view: 'addMembers', groupId: intent.groupId, targetGroupId: intent.groupId, sourceIds: [], query: '', error: '' }); return; }
    if (intent.type === 'toggleSource') {
      if (this.state.view !== 'addMembers' || !this.state.sources.some(source => source.sourceId === intent.sourceId)) return;
      const selected = this.state.sourceIds;
      this.patch({ sourceIds: selected.includes(intent.sourceId) ? selected.filter(id => id !== intent.sourceId) : selected.concat([intent.sourceId]) }); return;
    }
    if (intent.type === 'deleteConfirmed') {
      const command = sourceGroupCommand(this.state);
      if (command?.action === 'delete' && command.groupId === intent.groupId && command.targetGroupId === intent.targetGroupId && command.expectedRevision === intent.expectedRevision)
        void this.mutate(command);
      return;
    }
    if (intent.type === 'submit') {
      if (this.state.view === 'delete') return; // A public confirmation owner must dispatch deleteConfirmed.
      const command = sourceGroupCommand(this.state);
      if (command !== undefined) void this.mutate(command);
      else this.patch({ error: this.state.view === 'create' || this.state.view === 'rename' ? sourceGroupNameError(this.state.catalog, this.state.name, this.state.view === 'rename' ? this.state.groupId : undefined) : '目标或书源已变化，请刷新后重选' });
    }
  }
  private async refresh(): Promise<void> {
    const generation = ++this.readGeneration;
    this.patch({ read: 'loading', readError: '' });
    try {
      const current = (): boolean => ReaderRuntimeOwner.isCurrent(this.runtime) && generation === this.readGeneration;
      const sources = await this.sources.loadSources(undefined, true, current);
      const catalog = SourceGroupGateway.catalogSnapshot(this.runtime) ?? await this.gateway.loadCatalog(current);
      if (!current()) return;
      this.patch({ catalog, sources, read: 'ready', readError: '', original: this.gateway.snapshot() });
    } catch (error) {
      if (ReaderRuntimeOwner.isCurrent(this.runtime) && generation === this.readGeneration)
        this.patch({ read: 'error', readError: errorMessageOf(error), original: this.gateway.snapshot() });
    }
  }
  private async mutate(command: SourceGroupMutation): Promise<void> {
    if (this.state.busy || this.gateway.snapshot().blocked) return;
    const generation = ++this.writeGeneration;
    this.patch({ busy: true, error: '', receipt: undefined });
    try {
      const receipt = await this.gateway.mutate(command, command.action === 'assign' ? '更改书源分组' : command.action === 'delete' ? '删除分组并迁移书源' : command.action === 'rename' ? '重命名分组' : '新建分组',
        (): boolean => ReaderRuntimeOwner.isCurrent(this.runtime) && generation === this.writeGeneration);
      if (!ReaderRuntimeOwner.isCurrent(this.runtime) || generation !== this.writeGeneration) return;
      this.patch({ view: 'result', busy: false, receipt, receiptGeneration: this.state.receiptGeneration + 1, original: this.gateway.snapshot() });
      await this.refresh();
    } catch (error) {
      if (ReaderRuntimeOwner.isCurrent(this.runtime) && generation === this.writeGeneration)
        this.patch({ view: 'result', busy: false, error: errorMessageOf(error), original: this.gateway.snapshot() });
    }
  }
  private async reconcile(continueOriginal: boolean): Promise<void> {
    if (this.state.busy) return;
    const operationId = this.state.original?.operationId;
    const originalName = this.state.original?.original?.params['name'];
    const requestedName = typeof originalName === 'string' ? originalName : this.state.name;
    this.patch({ busy: true, error: '' });
    let received: SourceGroupReceipt | undefined;
    try {
      const current = (): boolean => ReaderRuntimeOwner.isCurrent(this.runtime);
      const original = await this.gateway.recover(current, continueOriginal, operationId, undefined, (receipt: SourceGroupReceipt): void => { received = receipt; });
      if (!current()) return;
      this.patch({ busy: false, original, receipt: received ?? this.state.receipt,
        view: received === undefined ? this.state.view : 'result', name: received === undefined ? this.state.name : requestedName,
        receiptGeneration: received === undefined ? this.state.receiptGeneration : this.state.receiptGeneration + 1 });
      await this.refresh();
    } catch (error) { if (ReaderRuntimeOwner.isCurrent(this.runtime)) this.patch({ busy: false, error: errorMessageOf(error), original: this.gateway.snapshot() }); }
  }
  private commonGroup(sourceIds: string[]): string {
    const matches = this.state.catalog.memberships.filter(member => sourceIds.includes(member.sourceId));
    return matches.length === sourceIds.length && matches.length > 0 && matches.every(member => member.groupId === matches[0].groupId) ? matches[0].groupId : '';
  }
  private accepts(identity: string): boolean { try { return identity === this.identity && identity.length > 0 && ReaderRuntimeOwner.isCurrent(this.runtime) && this.admitted(); } catch (_) { return false; } }
  private patch(patch: Partial<SourceGroupManagementSnapshot>): void {
    const previousReceipt = this.state.receiptGeneration;
    this.state = { ...this.state, ...patch, revision: this.state.revision + 1 };
    if (this.accepts(this.identity)) this.emit(this.current());
    if (this.state.receiptGeneration > previousReceipt && this.state.receipt !== undefined) {
      for (const listener of this.receiptListeners) {
        try { listener(this.current()); } catch (_) { /* Presentation failure cannot undo the accepted ACK. */ }
      }
    }
  }
}
