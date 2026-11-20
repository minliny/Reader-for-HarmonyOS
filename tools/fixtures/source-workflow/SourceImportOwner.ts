import type { JsonObject } from '@reader/core-harmony';
import { ReaderRuntimeOwner } from '../../../entry/src/main/ets/app/ReaderRuntimeOwner';
import { ReaderWriteEvidence } from '../../../entry/src/main/ets/app/ReaderWriteEvidence';
import { SourceGateway } from '../../../entry/src/main/ets/features/source/SourceGateway';
import { SourceGroupGateway } from '../../../entry/src/main/ets/features/source/SourceGroupGateway';
import type { SourceGroupCatalog, SourceGroupedImportReceipt } from '../../../entry/src/main/ets/features/source/SourceGroupTypes';
import type { RulesMutationSnapshot } from '../../../entry/src/main/ets/features/settings/RulesMutationOwner';
import { SourceImportModel, type SourceImportIntent, type SourceImportPlan, type SourceImportSnapshot } from '../../../entry/src/main/ets/features/source/SourceImportModel';

export type SourceImportReceiptObserver = (snapshot: SourceImportSnapshot) => void;

/** Runtime-owned finite import. UI detachment retires its reads and callbacks;
 * an accepted fixed write remains owned until its exact Core receipt settles. */
export class SourceImportOwner {
  private static readonly owners: WeakMap<ReaderRuntimeOwner, SourceImportOwner> = new WeakMap();
  static forRuntime(runtime: ReaderRuntimeOwner): SourceImportOwner | undefined {
    if (!ReaderRuntimeOwner.isCurrent(runtime)) return undefined;
    let owner = SourceImportOwner.owners.get(runtime);
    if (owner === undefined) { owner = new SourceImportOwner(runtime); SourceImportOwner.owners.set(runtime, owner); }
    return owner;
  }
  private readonly runtime: ReaderRuntimeOwner;
  private readonly sourceGateway: SourceGateway;
  private readonly gateway: SourceGroupGateway;
  private readonly model: SourceImportModel = new SourceImportModel();
  private presentationIdentity: string = '';
  private presentationCurrent: () => boolean = (): boolean => false;
  private emitSnapshot: (snapshot: SourceImportSnapshot) => void = (_snapshot: SourceImportSnapshot): void => {};
  private readGeneration: number = 0;
  private catalogReadGeneration: number = 0;
  private writeGeneration: number = 0;
  private pendingPlan: SourceImportPlan | undefined = undefined;
  private lastAppliedOperationId: string = '';
  private readonly receiptObservers: Set<SourceImportReceiptObserver> = new Set();

  private constructor(runtime: ReaderRuntimeOwner) {
    this.runtime = runtime; this.sourceGateway = new SourceGateway(runtime); this.gateway = new SourceGroupGateway(runtime);
  }
  attachPresentation(identity: string, emit: (snapshot: SourceImportSnapshot) => void, current: () => boolean): boolean {
    if (identity.length === 0 || !this.runtimeCurrent() || !current()) return false;
    if (this.presentationIdentity !== identity) { this.readGeneration += 1; this.catalogReadGeneration += 1; }
    this.presentationIdentity = identity; this.presentationCurrent = current; this.emitSnapshot = emit;
    this.syncOriginal(); this.publish(); return true;
  }
  detachPresentation(identity: string): void {
    if (this.presentationIdentity !== identity) return;
    this.presentationIdentity = ''; this.presentationCurrent = (): boolean => false;
    this.emitSnapshot = (_snapshot: SourceImportSnapshot): void => {};
    this.readGeneration += 1; this.catalogReadGeneration += 1;
    // A system picker/network read has no accepted Core write to preserve.
    if (this.model.snapshot().stage !== 'submitting' && this.gateway.snapshot().busy !== true) this.model.setBusy(false);
  }
  current(): SourceImportSnapshot { return this.model.snapshot(); }
  /** Runtime facts outlive a route. This emits only exact accepted receipts;
   * ordinary edits/catalog reads never notify it. */
  subscribeReceipt(observer: SourceImportReceiptObserver): () => void {
    this.receiptObservers.add(observer);
    const snapshot = this.model.snapshot();
    if (snapshot.receipt !== undefined && snapshot.receiptGeneration > 0) {
      try { observer(snapshot); } catch (_) { /* An observer cannot undo a receipt. */ }
    }
    return (): void => { this.receiptObservers.delete(observer); };
  }
  private notifyReceipt(): void {
    const snapshot = this.model.snapshot();
    for (const observer of this.receiptObservers) {
      try { observer(snapshot); } catch (_) { /* Preserve the accepted business fact. */ }
    }
  }
  isPresentationCurrent(identity: string): boolean {
    return identity.length > 0 && identity === this.presentationIdentity && this.runtimeCurrent() && this.presentationCurrent();
  }
  setCatalog(catalog: SourceGroupCatalog): void {
    if (!this.runtimeCurrent()) return;
    this.model.setCatalog(catalog); this.publish();
  }
  open(identity: string): void {
    if (!this.isPresentationCurrent(identity)) return;
    this.syncOriginal();
    const retained = SourceGroupGateway.catalogSnapshot(this.runtime);
    if (retained !== undefined) this.model.setCatalog(retained);
    this.publish();
    if (!this.model.snapshot().busy) void this.refreshCatalog(identity);
  }
  dispatch(intent: SourceImportIntent, identity: string): void {
    if (!this.isPresentationCurrent(identity)) return;
    if (intent.kind === 'reconcile' || intent.kind === 'continueOriginal') {
      void this.reconcile(identity, intent.kind === 'continueOriginal'); return;
    }
    if (!this.model.editable()) return;
    if (intent.kind === 'method' || intent.kind === 'url' || intent.kind === 'text') this.model.editInput(intent.kind, intent.value);
    else if (intent.kind === 'strategy') this.model.setStrategy(intent.value);
    else if (intent.kind === 'target') this.model.setTarget(intent.targetKind, intent.groupId, intent.name);
    else if (intent.kind === 'confirm') this.model.confirm(intent.scope, intent.checked);
    else if (intent.kind === 'select') this.model.select(intent.index, intent.selected);
    else if (intent.kind === 'selectAll') this.model.selectAll(intent.selected);
    else if (intent.kind === 'newDocument') this.model.newDocument();
    else if (intent.kind === 'acquire') { void this.acquire(identity); return; }
    else if (intent.kind === 'refresh') { void this.refreshCatalog(identity); return; }
    else if (intent.kind === 'retryFailed') {
      this.model.retryFailed(); this.publish();
      if (this.model.snapshot().refreshRequired) void this.refreshCatalog(identity);
      return;
    } else if (intent.kind === 'submit') { void this.submit(identity, intent.scope); return; }
    this.publish();
  }

  private runtimeCurrent(): boolean {
    try { return ReaderRuntimeOwner.isCurrent(this.runtime); } catch (_) { return false; }
  }
  private publish(): void {
    if (!this.isPresentationCurrent(this.presentationIdentity)) return;
    try { this.emitSnapshot(this.model.snapshot()); } catch (_) { /* A view cannot undo an accepted import. */ }
  }
  private syncOriginal(): RulesMutationSnapshot {
    const original = this.gateway.snapshot();
    if ((original.blocked || original.confirmation === 'unknown') && original.method === 'source.import.grouped' && original.original !== undefined) {
      const params = original.original.params;
      if (this.pendingPlan === undefined || JSON.stringify(this.pendingPlan.params) !== JSON.stringify(params))
        this.pendingPlan = this.model.restoreOriginal(params);
    }
    this.model.setOriginal(original); return original;
  }
  private async refreshCatalog(identity: string): Promise<void> {
    if (!this.isPresentationCurrent(identity) || this.model.snapshot().stage === 'submitting') return;
    const read = ++this.catalogReadGeneration;
    const current = (): boolean => this.isPresentationCurrent(identity) && read === this.catalogReadGeneration;
    this.model.setCatalogState('loading'); this.publish();
    try {
      const catalog = await this.gateway.loadCatalog(current);
      if (!current()) return;
      this.model.setCatalog(catalog); this.model.setError('');
    } catch (_) {
      if (!current()) return;
      this.model.setCatalogState('error', '分组目录暂时无法读取，请重试。');
    }
    this.publish();
  }
  private async acquire(identity: string): Promise<void> {
    if (!this.isPresentationCurrent(identity) || !this.model.editable()) return;
    const input = this.model.snapshot(); const read = ++this.readGeneration;
    const current = (): boolean => this.isPresentationCurrent(identity) && read === this.readGeneration;
    if ((input.method === 'url' || input.method === 'subscription') && !/^https?:\/\//i.test(input.url.trim())) {
      this.model.setError('请输入 HTTP/HTTPS 书源 JSON 链接。'); this.publish(); return;
    }
    if (input.method === 'paste' && input.text.trim().length === 0) {
      this.model.setError('请先粘贴书源 JSON。'); this.publish(); return;
    }
    this.model.setBusy(true); this.model.setError(''); this.publish();
    try {
      const document = input.method === 'local' ? await this.runtime.selectBookSourceJson() :
        (input.method === 'url' || input.method === 'subscription') ? await this.runtime.loadOnlineJsonDocument(input.url.trim()) :
          { fileName: '粘贴的书源 JSON', text: input.text };
      if (!current()) return;
      if (document !== undefined) {
        const prepared = this.sourceGateway.prepareSubscriptionDocument(document.text);
        this.model.acceptDocument(document.fileName, document.text, prepared);
      }
      this.model.setBusy(false);
    } catch (_) {
      if (!current()) return;
      this.model.setBusy(false); this.model.setError('无法读取或解析书源，请检查文件和链接后重试。');
    }
    this.publish();
  }
  private applyReceipt(receipt: SourceGroupedImportReceipt, plan: SourceImportPlan, operationId: string): boolean {
    if (operationId.length > 0 && operationId === this.lastAppliedOperationId) return false;
    this.lastAppliedOperationId = operationId;
    this.model.applyReceipt(receipt, plan); return true;
  }
  private async submit(identity: string, scope: string): Promise<void> {
    if (!this.isPresentationCurrent(identity)) return;
    const plan = this.model.plan(scope);
    if (plan === undefined) { this.model.setError(this.model.snapshot().blockingMessage || '导入条件已变化，请重新核对。'); this.publish(); return; }
    const operation = ++this.writeGeneration;
    // This is the accepted business operation's lease, not a page bool.
    const current = (): boolean => this.runtimeCurrent() && operation === this.writeGeneration;
    this.pendingPlan = plan; this.model.setBusy(true, 'submitting'); this.model.setError(''); this.publish();
    const evidence = new ReaderWriteEvidence();
    try {
      const receipt = await this.gateway.importGrouped(plan.params, current, evidence);
      if (!current()) return;
      const original = this.gateway.snapshot();
      const applied = this.applyReceipt(receipt, plan, original.operationId ?? `import:${operation}`);
      this.model.setOriginal(original);
      if (applied) this.notifyReceipt();
    } catch (_) {
      if (!current()) return;
      const original = this.syncOriginal();
      if ((original.confirmation === 'unknown' || original.blocked) && this.pendingPlan !== undefined) this.model.markUnknown(this.pendingPlan);
      this.model.setBusy(false, original.confirmation === 'unknown' || original.blocked ? 'results' : 'preview');
      this.model.setError(original.confirmation === 'unknown' || original.blocked ? '' : '导入未完成，请核对条目和分组后重试。');
      if (!original.blocked && original.confirmation !== 'unknown') this.model.setCatalogState('error');
    }
    this.publish();
  }
  private async reconcile(identity: string, retryOriginal: boolean): Promise<void> {
    if (!this.isPresentationCurrent(identity) || this.model.snapshot().busy) return;
    const original = this.syncOriginal();
    if (original.method !== 'source.import.grouped' || original.operationId === undefined ||
      (!original.blocked && original.confirmation !== 'unknown') || original.busy || (retryOriginal && !original.canRetryOriginal)) { this.publish(); return; }
    const plan = this.pendingPlan;
    if (plan === undefined) { this.model.setError('原导入内容尚不可用，请返回书源管理核对。'); this.publish(); return; }
    const operation = ++this.writeGeneration;
    const current = (): boolean => this.runtimeCurrent() && operation === this.writeGeneration;
    this.model.setBusy(true); this.publish();
    let received: SourceGroupedImportReceipt | undefined = undefined;
    try {
      const recovered = await this.gateway.recover(current, retryOriginal, original.operationId,
        (receipt: SourceGroupedImportReceipt): void => { if (current()) received = receipt; });
      if (!current()) return;
      this.model.setOriginal(recovered); this.model.setBusy(false);
      if (received !== undefined && this.applyReceipt(received, plan, original.operationId)) this.notifyReceipt();
      // Only the callback above may retire imported rows. A plain readback or
      // an unexecuted original never substitutes for the exact original ACK.
    } catch (_) {
      if (!current()) return;
      this.syncOriginal(); this.model.setBusy(false);
      // Cleanup can fail after the exact original ACK was qualified. Retain
      // that committed import separately from its still-pending record cleanup.
      if (received !== undefined && this.applyReceipt(received, plan, original.operationId)) this.notifyReceipt();
    }
    this.publish();
  }
}
