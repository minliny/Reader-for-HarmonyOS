import util from '@ohos.util';
import { readerLibrarySyncConflictViews } from './ReaderLibrarySyncProjection';
import { ReaderLibraryLogSyncGateway } from './ReaderLibraryLogSyncGateway';
import fileIo from '@ohos.file.fs';
import type { JsonObject } from '@reader/core-harmony';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { HttpExecuteHost } from '../../app/HttpExecuteHost';
import { WebDavCredentialStore } from './WebDavCredentialStore';
import { ReaderWebDavStorageConnection, type ReaderWebDavStorageBinding } from './ReaderWebDavStorageConnection';
import { ReaderLibrarySyncJournal, type ReaderLibrarySyncIntent, readerLibrarySyncHash,
  readerLibrarySyncStrongRevision, READER_LIBRARY_SYNC_MAX_BYTES } from './ReaderLibrarySyncJournal';

import type { ReaderLibrarySyncCounts, ReaderLibrarySyncCandidate, ReaderLibrarySyncConflict, ReaderLibrarySyncChannel, ReaderLibrarySyncSnapshot } from './ReaderLibrarySyncTypes';
export type { ReaderLibrarySyncCounts, ReaderLibrarySyncCandidate, ReaderLibrarySyncConflict, ReaderLibrarySyncChannel, ReaderLibrarySyncSnapshot } from './ReaderLibrarySyncTypes';
interface LibrarySyncRecord { key: string; operationId: string; writerId: string; deleted: boolean; value: JsonObject; }
interface LibrarySyncConflictRecord { key: string; kind: string; local?: LibrarySyncRecord; remote?: LibrarySyncRecord; candidates?: LibrarySyncRecord[]; }
interface LibrarySyncPlan {
  protocolVersion: 1;
  operationId: string;
  status: 'review' | 'ready' | 'needsRebase' | 'committed' | 'retired' | 'missing' | 'pending';
  planToken?: string;
  localBasis?: string;
  remoteRevision?: string;
  counts?: ReaderLibrarySyncCounts;
  conflicts?: LibrarySyncConflictRecord[];
  publishContent?: string;
  publishSha256?: string;
  joinRequired?: boolean;
  publication?: 'included' | 'absent' | 'unknown';
  restartRequired?: boolean;
}
interface LibrarySyncHead { missing: boolean; revision?: string; content?: string; sha256?: string; }
interface LibrarySyncDecision { key: string; choice: string; }

const HEAD_NAME = 'library-sync-v1.reader';
const emptySnapshot = (): ReaderLibrarySyncSnapshot => ({ status: 'idle', supported: false, conflicts: [], joinRequired: false, reviewRevision: 0, canRebase: false, canContinueCommit: false, message: '' });

/** Foreground library synchronization only. Core owns causal merge and local
 * transactions; this owner retains exact conditional publication and UI facts. */
export class ReaderLibrarySyncGateway {
  private static retained: WeakMap<ReaderRuntimeOwner, ReaderLibrarySyncGateway> = new WeakMap();
  static forRuntime(owner: ReaderRuntimeOwner): ReaderLibrarySyncGateway {
    let value = this.retained.get(owner);
    if (value === undefined) { value = new ReaderLibrarySyncGateway(owner); this.retained.set(owner, value); }
    return value;
  }
  private readonly storage: ReaderWebDavStorageConnection;
  private readonly journal: ReaderLibrarySyncJournal;
  private logGateway: ReaderLibraryLogSyncGateway | undefined;
  private logMode: boolean = false;
  private state: ReaderLibrarySyncSnapshot = emptySnapshot();
  private active: boolean = false;
  private generation: number = 0;
  private reviewRevision: number = 0;
  private plan: LibrarySyncPlan | undefined;
  private reviewPassword: string = '';
  private decisions: LibrarySyncDecision[] = [];
  private listeners: Array<() => void> = [];
  constructor(private readonly owner: ReaderRuntimeOwner,
    private readonly credentials: WebDavCredentialStore = WebDavCredentialStore.instance,
    storage?: ReaderWebDavStorageConnection, journal?: ReaderLibrarySyncJournal) {
    const context = owner.getUIAbilityContext(); credentials.attachContext(context);
    this.storage = storage ?? new ReaderWebDavStorageConnection(owner, credentials);
    this.journal = journal ?? new ReaderLibrarySyncJournal(context.filesDir);
  }
  private log(): ReaderLibraryLogSyncGateway {
    if (this.logGateway === undefined) {
      this.logGateway = new ReaderLibraryLogSyncGateway(this.owner, this.credentials, this.storage);
      this.logGateway.subscribe((): void => { for (const listener of this.listeners) { try { listener(); } catch (_) {} } });
    }
    return this.logGateway;
  }
  private supportsLog(): boolean {
    return typeof this.owner.supportsCoreCapability === 'function' && this.owner.supportsCoreCapability('library.sync.log.v2');
  }
  chooseChannel(id: string, current: () => boolean, revision: number = this.snapshot().reviewRevision): void {
    if (this.logMode) this.log().chooseChannel(id, current, revision);
  }
  snapshot(): ReaderLibrarySyncSnapshot {
    if (this.logMode) return this.log().snapshot();
    return { ...this.state, transport: 'casV1', counts: this.state.counts === undefined ? undefined : { ...this.state.counts },
      conflicts: this.state.conflicts.map((row): ReaderLibrarySyncConflict => ({ ...row,
        candidates: row.candidates.map((candidate): ReaderLibrarySyncCandidate => ({ ...candidate })),
        decision: this.decisions.find((value): boolean => value.key === row.key)?.choice })) };
  }
  subscribe(listener: () => void): () => void {
    this.listeners.push(listener); return (): void => { this.listeners = this.listeners.filter((value): boolean => value !== listener); };
  }
  private current(): boolean { return ReaderRuntimeOwner.isCurrent(this.owner) && this.owner.canConfigureBackupStorage(); }
  private admitted(current: () => boolean): boolean { try { return this.current() && current(); } catch (_) { return false; } }
  private requireCurrent(): void { if (!this.current()) throw new Error('LIBRARY_SYNC_RUNTIME_RETIRED'); }
  private publish(value: ReaderLibrarySyncSnapshot): void {
    if (!this.current() && !this.owner.canRecoverLibraryRestoreFailure()) return;
    this.state = value; for (const listener of this.listeners) { try { listener(); } catch (_) {} }
  }
  busy(): boolean { return this.logMode ? this.log().busy() : this.active; }
  canPrepare(): boolean { return false; }
  needsPassword(): boolean { return this.logMode ? this.log().needsPassword() : this.plan?.status !== 'ready' && this.reviewPassword.length === 0; }
  canConfirm(operationId: string, reviewRevision: number = this.snapshot().reviewRevision, suppliedPassword: boolean = false): boolean {
    if (this.logMode) return this.log().canConfirm(operationId, reviewRevision, suppliedPassword);
    return this.current() && !this.active && this.state.status === 'review' && this.state.operationId === operationId &&
      this.state.reviewRevision === reviewRevision &&
      (!this.needsPassword() || suppliedPassword) &&
      this.plan?.operationId === operationId && this.state.conflicts.every((row): boolean => this.decisions.some((value): boolean => value.key === row.key));
  }
  private async capability(): Promise<boolean> {
    const value = (await this.owner.request('library.sync.capabilities', {})).data;
    this.requireCurrent();
    return value['protocolVersion'] === 1 && value['metadata'] === true;
  }
  private async qualifyStorage(binding: ReaderWebDavStorageBinding): Promise<void> {
    const probe = await this.credentials.loadStorageProbeIntent();
    if (!await this.storage.isCurrent(binding) || probe === undefined || probe.configSaveOperationId !== binding.operationId ||
      probe.configPayloadHash !== binding.payloadHash || probe.stage !== 'completed' ||
      probe.capabilities.conditionalCreate !== 'supported' || probe.capabilities.conditionalReplace !== 'supported' ||
      !probe.wrongPutQualified) throw new Error('LIBRARY_SYNC_CONDITIONAL_STORAGE_REQUIRED');
  }
  private requireBinding(intent: ReaderLibrarySyncIntent, binding: ReaderWebDavStorageBinding): void {
    if (intent.configOperationId !== binding.operationId || intent.configPayloadHash !== binding.payloadHash ||
      intent.remotePath !== this.remotePath(binding)) throw new Error('LIBRARY_SYNC_CONNECTION_CHANGED');
  }
  private remotePath(binding: ReaderWebDavStorageBinding): string { return `${binding.config.directory.replace(/\/+$/, '')}/${HEAD_NAME}`; }
  private redact(binding?: ReaderWebDavStorageBinding): void {
    if (binding !== undefined) { binding.config.password = ''; binding.config.backupPassword = ''; }
  }
  private decode(value: JsonObject, operationId: string): LibrarySyncPlan {
    // Rust's Option values are explicit JSON null on the protocol wire. Keep
    // absence distinct from a malformed present value before validating it.
    const decoded: JsonObject = { ...value };
    for (const key of ['planToken', 'localBasis', 'remoteRevision', 'counts', 'conflicts', 'publishContent',
      'publishSha256', 'joinRequired', 'publication', 'restartRequired']) if (decoded[key] === null) delete decoded[key];
    const plan = decoded as unknown as LibrarySyncPlan;
    if (plan.protocolVersion !== 1 || plan.operationId !== operationId ||
      !['review', 'ready', 'needsRebase', 'committed', 'retired', 'missing', 'pending'].includes(plan.status) ||
      plan.publishContent !== undefined && (typeof plan.publishContent !== 'string' || plan.publishContent.length > READER_LIBRARY_SYNC_MAX_BYTES) ||
      plan.publishSha256 !== undefined && !/^[0-9a-f]{64}$/.test(plan.publishSha256) ||
      plan.remoteRevision !== undefined && !readerLibrarySyncStrongRevision(plan.remoteRevision)) throw new Error('LIBRARY_SYNC_REPLY_INVALID');
    if (['review', 'ready', 'needsRebase'].includes(plan.status)) {
      if (typeof plan.planToken !== 'string' || plan.planToken.length < 1 || plan.planToken.length > 256 ||
        typeof plan.localBasis !== 'string' || plan.localBasis.length < 1 || plan.localBasis.length > 256 ||
        plan.counts === undefined || !Array.isArray(plan.conflicts) || plan.conflicts.length > 100000 ||
        ['records', 'deleted', 'conflicts', 'books', 'positions', 'marks'].some((key: string): boolean => {
          const count = (plan.counts as unknown as Record<string, unknown>)[key];
          return typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0 || count > 100000;
        })) throw new Error('LIBRARY_SYNC_REPLY_INVALID');
      const keys: Set<string> = new Set();
      for (const row of plan.conflicts) {
        if (typeof row.key !== 'string' || row.key.length < 1 || row.key.length > 4096 || keys.has(row.key) ||
          typeof row.kind !== 'string' || row.kind.length > 128 ||
          row.candidates !== undefined && (!Array.isArray(row.candidates) || row.candidates.length > 128))
          throw new Error('LIBRARY_SYNC_CONFLICT_INVALID');
        keys.add(row.key);
      }
    }
    return plan;
  }
  private conflictViews(plan: LibrarySyncPlan): ReaderLibrarySyncConflict[] {
    return readerLibrarySyncConflictViews(plan.conflicts ?? []);
  }
  private showPlan(plan: LibrarySyncPlan, message: string = ''): void {
    this.plan = plan; this.decisions = [];
    this.publish({ status: 'review', supported: true, operationId: plan.operationId, counts: plan.counts,
      conflicts: this.conflictViews(plan), joinRequired: plan.joinRequired === true,
      reviewRevision: ++this.reviewRevision,
      canRebase: false,
      canContinueCommit: false,
      message: message || (plan.joinRequired ? '另一端使用不同的书库身份。请确认是否加入该共享书库并合并本机数据。' :
        '请核对同步内容并处理每一项冲突。确认前不会修改本机书库或发布远端新版本。') });
  }
  choose(operationId: string, key: string, choice: string, current: () => boolean, reviewRevision: number = this.snapshot().reviewRevision): void {
    if (this.logMode) { this.log().choose(operationId, key, choice, current, reviewRevision); return; }
    if (!this.admitted(current) || this.active || this.state.status !== 'review' || this.state.operationId !== operationId ||
      reviewRevision !== this.state.reviewRevision ||
      !this.state.conflicts.some((row): boolean => row.key === key && row.candidates.some((candidate): boolean => candidate.choice === choice))) return;
    this.decisions = this.decisions.filter((value): boolean => value.key !== key).concat([{ key, choice }]);
    this.publish({ ...this.state, reviewRevision: ++this.reviewRevision });
  }
  async open(current: () => boolean): Promise<void> {
    if (this.logMode) { await this.log().open(current); return; }
    if (!this.active && this.admitted(current) && this.supportsLog()) {
      try {
        if (await this.journal.load() === undefined) { this.logMode = true; await this.log().open(current); return; }
      } catch (_) {
        this.publish({ ...emptySnapshot(), status: 'pending', supported: false, message: '原同步记录尚未读清，请保留原连接后核对。' }); return;
      }
    }
    if (this.active || !this.admitted(current)) return;
    this.active = true; this.publish({ ...emptySnapshot(), status: 'loading' });
    try {
      if (!await this.capability()) throw new Error('LIBRARY_SYNC_UNSUPPORTED');
      const pending = await this.journal.load();
      if (!this.admitted(current)) return;
      this.publish(pending === undefined ? { ...emptySnapshot(), status: 'unavailable', supported: false, message: '没有待核对的原同步操作。' } : {
        status: 'pending', supported: true, operationId: pending.operationId, conflicts: [], joinRequired: false, reviewRevision: 0,
        canRebase: pending.phase === 'needsRebase', canContinueCommit: false,
        message: '原同步尚未结束。请核对原操作；不会重新发送结果未确认的写入。' });
    } catch (_) { if (this.admitted(current)) this.publish({ ...emptySnapshot(), status: 'unavailable', message: '当前运行环境尚不支持完整书库同步，请使用已有备份恢复。' }); }
    finally { this.active = false; this.publish({ ...this.state }); }
  }
  async prepare(_password: string, _current: () => boolean): Promise<void> {
    // RecoveryOnly: this entry never creates a new operation or joins a channel.
    return;
  }
  private header(response: JsonObject, name: string): string | undefined {
    const headers = response['headers'];
    if (headers === null || typeof headers !== 'object' || Array.isArray(headers)) return undefined;
    const matches = Object.keys(headers).filter((key: string): boolean => key.toLowerCase() === name);
    return matches.length === 1 && typeof headers[matches[0]] === 'string' ? headers[matches[0]] as string : undefined;
  }
  private async readHead(binding: ReaderWebDavStorageBinding, path: string): Promise<LibrarySyncHead> {
    const request = await this.storage.planRequest(binding, 'GET', path, { 'Accept-Encoding': 'identity' });
    const response = await HttpExecuteHost.instance.executeBounded(request, READER_LIBRARY_SYNC_MAX_BYTES, undefined,
      (): boolean => !this.current(), await this.storage.networkAuthority(binding));
    if (!await this.storage.isCurrent(binding)) throw new Error('LIBRARY_SYNC_CONNECTION_CHANGED');
    if (response['status'] === 404) return { missing: true };
    const revision = this.header(response, 'etag');
    if (response['status'] !== 200 || revision === undefined || !readerLibrarySyncStrongRevision(revision) ||
      this.header(response, 'content-range') !== undefined || (this.header(response, 'content-encoding') ?? 'identity').toLowerCase() !== 'identity')
      throw new Error('LIBRARY_SYNC_HEAD_UNQUALIFIED');
    let bytes: Uint8Array;
    if (typeof response['bodyBase64'] === 'string') bytes = new util.Base64Helper().decodeSync(response['bodyBase64']);
    else if (typeof response['body'] === 'string') bytes = new util.TextEncoder().encodeInto(response['body']);
    else throw new Error('LIBRARY_SYNC_HEAD_INVALID');
    if (bytes.byteLength < 1 || bytes.byteLength > READER_LIBRARY_SYNC_MAX_BYTES) throw new Error('LIBRARY_SYNC_HEAD_INVALID');
    // The AES envelope is ASCII JSON. Reject a lossy response decoder rather
    // than authenticate bytes different from the remote head that was read.
    if (bytes.some((byte: number): boolean => byte > 127)) throw new Error('LIBRARY_SYNC_HEAD_INVALID');
    const content = new util.TextDecoder('utf-8', { fatal: true }).decodeWithStream(bytes);
    return { missing: false, revision, content, sha256: await readerLibrarySyncHash(bytes) };
  }
  async confirm(operationId: string, reviewRevision: number, password: string, current: () => boolean): Promise<void> {
    if (this.logMode) { await this.log().confirm(operationId, reviewRevision, password, current); return; }
    if (!this.canConfirm(operationId, reviewRevision, password.length > 0) || !this.admitted(current)) return;
    password = password || this.reviewPassword; this.reviewPassword = '';
    const original = this.plan!, decisions = this.decisions.map((value): LibrarySyncDecision => ({ ...value }));
    this.active = true; let binding: ReaderWebDavStorageBinding | undefined;
    this.publish({ ...this.state, status: 'publishing', message: '正在发布并核对同步结果…' });
    try {
      binding = await this.storage.open(); await this.qualifyStorage(binding);
      let intent = await this.journal.load();
      if (intent?.operationId !== operationId || intent.planToken !== original.planToken || !['review', 'needsRebase', 'prepared'].includes(intent.phase))
        throw new Error('LIBRARY_SYNC_ORIGINAL_OPERATION_CHANGED');
      this.requireBinding(intent, binding);
      const plan = original.status !== 'ready' || decisions.length > 0 ? this.decode((await this.owner.request('library.sync.resolve', {
        operationId, planToken: original.planToken!, password, decisions: decisions as unknown as JsonObject[],
      })).data, operationId) : original;
      if (plan.status !== 'ready' || plan.publishContent === undefined || plan.publishSha256 === undefined ||
        plan.planToken === undefined || plan.localBasis === undefined) throw new Error('LIBRARY_SYNC_REVIEW_REQUIRED');
      const bytes = await this.journal.prepareSource(operationId, plan.publishContent, plan.publishSha256);
      intent = { ...intent, planToken: plan.planToken, localBasis: plan.localBasis, publishSha256: plan.publishSha256, publishBytes: bytes, phase: 'prepared' };
      await this.journal.save(intent); this.plan = plan;
      await this.publishOriginal(intent, binding);
    } catch (error) { await this.failed(error, operationId); }
    finally { password = ''; this.redact(binding); this.active = false; this.publish({ ...this.state }); }
  }
  private async publishOriginal(intent: ReaderLibrarySyncIntent, binding: ReaderWebDavStorageBinding): Promise<void> {
    this.requireBinding(intent, binding);
    const path = await this.journal.verifySource(intent.operationId, intent.publishSha256!, intent.publishBytes!);
    const headers: Record<string, string> = { 'Content-Type': 'application/octet-stream', 'Content-Length': String(intent.publishBytes) };
    if (intent.expectedRevision === undefined) headers['If-None-Match'] = '*'; else headers['If-Match'] = intent.expectedRevision;
    const request = await this.storage.planRequest(binding, 'PUT', intent.remotePath, headers);
    const source = await fileIo.open(path, fileIo.OpenMode.READ_ONLY | fileIo.OpenMode.NOFOLLOW);
    let status: number | undefined;
    try {
      const response = await HttpExecuteHost.instance.executeLibraryPackagePutFromFile(request, source.fd, intent.publishBytes!,
        (): boolean => !this.current(), undefined, async (): Promise<void> => {
          await this.journal.save({ ...intent, phase: 'mayPublish' });
          const publication = this.decode((await this.owner.request('library.sync.publish', {
            operationId: intent.operationId, planToken: intent.planToken!,
          })).data, intent.operationId);
          if (publication.planToken !== intent.planToken || publication.status !== 'ready' || publication.publication !== 'unknown')
            throw new Error('LIBRARY_SYNC_PUBLICATION_NOT_PREPARED');
          if (!await this.storage.isCurrent(binding)) throw new Error('LIBRARY_SYNC_CONNECTION_CHANGED');
        }, await this.storage.networkAuthority(binding), intent.expectedRevision);
      status = response.status;
    } catch (_) { /* Reconcile this exact publication; never retry its PUT. */ }
    finally { await fileIo.close(source); }
    const actual = await this.journal.load();
    if (actual?.operationId !== intent.operationId) throw new Error('LIBRARY_SYNC_ORIGINAL_OPERATION_CHANGED');
    if (actual.phase === 'prepared') throw new Error('LIBRARY_SYNC_NOT_DISPATCHED');
    const head = await this.readHead(binding, intent.remotePath);
    if (head.sha256 === intent.publishSha256 && head.revision !== undefined) {
      await this.commitPublished({ ...actual, phase: 'published', publishedRevision: head.revision }); return;
    }
    if (status === 412) {
      this.plan = undefined;
      this.publish({ ...emptySnapshot(), supported: true, status: 'pending', operationId: intent.operationId,
        canRebase: !head.missing && head.revision !== undefined,
        message: '另一端已更新共享书库，本次条件写入没有覆盖新版本。原变更仍保留，请输入密码后明确与当前远端重新合并。' }); return;
    }
    throw new Error('LIBRARY_SYNC_RESULT_PENDING');
  }
  private async commitPublished(intent: ReaderLibrarySyncIntent): Promise<void> {
    await this.journal.save({ ...intent, phase: 'committing' });
    const data = await this.owner.applyLibrarySyncCommit(intent.operationId, intent.planToken!, intent.publishedRevision!, intent.publishSha256!);
    const result = this.decode(data, intent.operationId);
    if (result.status === 'committed') {
      await this.journal.clear(intent.operationId); this.plan = undefined; this.decisions = [];
      this.publish({ ...emptySnapshot(), supported: true, status: result.restartRequired === true ? 'pending' : 'completed',
        operationId: intent.operationId, counts: result.counts, restartRequired: result.restartRequired === true,
        message: result.restartRequired === true ? '同步数据已确认，书架尚未重新打开。请通过原入口重新打开书架。' :
          '书库同步已完成。本机原书、授权与单独保存的阅读偏好保留。' }); return;
    }
    if (result.status === 'needsRebase' || result.status === 'ready' || result.status === 'review') {
      await this.journal.save({ ...intent, phase: 'needsRebase' });
      this.plan = undefined; this.reviewPassword = '';
      this.publish({ ...emptySnapshot(), supported: true, status: 'pending', operationId: intent.operationId, canRebase: true,
        message: '原版本已发布；本机又有新变更，已全部保留。重新打开书架后，请输入密码并与当前远端重新合并。' }); return;
    }
    if (result.status === 'pending') {
      this.plan = undefined; this.reviewPassword = '';
      this.publish({ ...emptySnapshot(), supported: true, status: 'pending', operationId: intent.operationId,
        restartRequired: result.restartRequired === true,
        message: result.restartRequired === true ? '本机同步应用尚未确认，书架未能重新打开。请使用原恢复入口重新打开书架，再核对原同步。' :
          '本机同步应用尚未确认，原操作已保留。重新打开书架后请核对原同步，不会自动重复应用。' }); return;
    }
    throw new Error('LIBRARY_SYNC_RESULT_PENDING');
  }
  async reconcile(operationId: string, password: string, current: () => boolean): Promise<void> {
    if (this.logMode) { await this.log().reconcile(operationId, password, current); return; }
    if (this.active || !this.admitted(current) || this.state.operationId !== operationId) return;
    this.active = true; let binding: ReaderWebDavStorageBinding | undefined;
    try {
      const intent = await this.journal.load();
      if (intent?.operationId !== operationId) throw new Error('LIBRARY_SYNC_ORIGINAL_OPERATION_CHANGED');
      binding = await this.storage.open(); this.requireBinding(intent, binding);
      if (['published', 'committing'].includes(intent.phase) && intent.publishedRevision !== undefined && intent.publishSha256 !== undefined) {
        const receipt = (await this.owner.request('library.package.restore.status', {
          operationId, packageSha256: intent.publishSha256,
        }, { timeoutMs: 5000 })).data;
        if (receipt['operationId'] !== operationId || receipt['packageSha256'] !== intent.publishSha256 ||
          !['missing', 'committedCurrent', 'committedHistorical'].includes(receipt['status'] as string))
          throw new Error('LIBRARY_SYNC_COMMIT_FACT_INVALID');
        if (receipt['status'] !== 'missing') await this.commitPublished(intent);
        else {
          await this.journal.save({ ...intent, phase: 'published' });
          this.publish({ ...emptySnapshot(), status: 'pending', supported: true, operationId,
            reviewRevision: ++this.reviewRevision, canContinueCommit: true,
            message: '原版本已确认发布，本机尚未确认应用。可明确继续应用这一原同步；核对本身不会再次写入。' });
        }
        return;
      }
      if (['planning', 'review', 'prepared'].includes(intent.phase)) {
        const params: JsonObject = { operationId };
        if (intent.planToken !== undefined) params['planToken'] = intent.planToken;
        const frame = this.decode((await this.owner.request('library.sync.status', params)).data, operationId);
        if (['review', 'ready'].includes(frame.status)) {
          if (frame.planToken === undefined || frame.localBasis === undefined) throw new Error('LIBRARY_SYNC_REPLY_INVALID');
          await this.journal.save({ ...intent, planToken: frame.planToken, localBasis: frame.localBasis, phase: intent.phase === 'planning' ? 'review' : intent.phase });
          this.reviewPassword = password; this.showPlan(frame);
        }
        else if (frame.status === 'missing' || frame.status === 'retired') {
          await this.journal.clear(operationId); this.plan = undefined;
          this.publish({ ...emptySnapshot(), supported: true, message: '原准备尚未发布，已核对结束；可以重新读取并核对。' });
        }
        else if (frame.status === 'committed' && intent.publishedRevision !== undefined) await this.commitPublished(intent);
        else throw new Error('LIBRARY_SYNC_RESULT_PENDING');
        return;
      }
      const head = await this.readHead(binding, intent.remotePath);
      if (intent.phase !== 'needsRebase' && head.sha256 === intent.publishSha256 && head.revision !== undefined) {
        await this.journal.save({ ...intent, phase: 'published', publishedRevision: head.revision });
        this.publish({ ...emptySnapshot(), status: 'pending', supported: true, operationId,
          reviewRevision: ++this.reviewRevision, canContinueCommit: true,
          message: '原发布已由完整内容核对确认，本机应用尚未确认。请明确继续原同步，不会重发文件。' }); return;
      }
      if (head.missing) {
        this.publish({ ...this.state, status: 'pending', operationId, canRebase: true,
          reviewRevision: ++this.reviewRevision,
          message: '当前未见共享文件，不能据此判断原发布失败。可明确保留原候选并重新合并，再核对并尝试新建共享文件；原操作不会被丢弃。' });
        return;
      }
      if (password.length === 0) throw new Error('LIBRARY_SYNC_RESULT_PENDING');
      const result = this.decode((await this.owner.request('library.sync.status', { operationId, planToken: intent.planToken!,
        remoteContent: head.content!, remoteRevision: head.revision!, password })).data, operationId);
      if (['included', 'absent', 'unknown'].includes(result.publication ?? '')) {
        this.publish({ ...this.state, status: 'pending', operationId, canRebase: true,
          message: result.publication === 'included' ?
            '已确认原同步包含在另一端的新版本中。请明确与当前远端重新合并，再核对后续发布。' :
            '当前远端版本未能证明原发布已纳入。可以保留原未确认候选，并明确选择与当前远端重新合并；不会重发旧密文或丢弃原变更。' });
        return;
      }
      throw new Error('LIBRARY_SYNC_RESULT_PENDING');
    } catch (error) { await this.failed(error, operationId); }
    finally { password = ''; this.redact(binding); this.active = false; this.publish({ ...this.state }); }
  }
  async continueCommit(operationId: string, reviewRevision: number, current: () => boolean): Promise<void> {
    if (this.logMode) { await this.log().continueCommit(operationId, reviewRevision, current); return; }
    if (this.active || !this.admitted(current) || this.state.operationId !== operationId ||
      this.state.reviewRevision !== reviewRevision || !this.state.canContinueCommit) return;
    this.active = true; this.publish({ ...this.state, status: 'publishing', canContinueCommit: false });
    try {
      const intent = await this.journal.load();
      if (intent?.operationId !== operationId || !['published', 'committing'].includes(intent.phase) ||
        intent.publishedRevision === undefined || intent.publishSha256 === undefined) throw new Error('LIBRARY_SYNC_PUBLICATION_UNCONFIRMED');
      await this.commitPublished(intent);
    } catch (error) { await this.failed(error, operationId); }
    finally { this.active = false; this.publish({ ...this.state }); }
  }
  async rebase(operationId: string, password: string, current: () => boolean): Promise<void> {
    if (this.logMode) { await this.log().rebase(operationId, password, current); return; }
    if (this.active || !this.admitted(current) || !this.state.canRebase || this.state.operationId !== operationId || password.length === 0) return;
    this.active = true; let binding: ReaderWebDavStorageBinding | undefined;
    try {
      const intent = await this.journal.load();
      if (intent?.operationId !== operationId || !['mayPublish', 'published', 'committing', 'needsRebase'].includes(intent.phase))
        throw new Error('LIBRARY_SYNC_ORIGINAL_OPERATION_CHANGED');
      binding = await this.storage.open(); this.requireBinding(intent, binding);
      const head = await this.readHead(binding, intent.remotePath);
      const params: JsonObject = { operationId, planToken: intent.planToken!, password, acknowledgeUnconfirmed: true };
      if (head.missing) params['remoteMissing'] = true;
      else if (head.content !== undefined && head.revision !== undefined) {
        params['remoteContent'] = head.content; params['remoteRevision'] = head.revision;
      } else throw new Error('LIBRARY_SYNC_RESULT_PENDING');
      const result = this.decode((await this.owner.request('library.sync.rebase', params)).data, operationId);
      if (!this.admitted(current) || !await this.storage.isCurrent(binding) ||
        !['review', 'ready'].includes(result.status) || result.planToken === undefined || result.planToken === intent.planToken || result.localBasis === undefined)
        throw new Error('LIBRARY_SYNC_REVIEW_REQUIRED');
      await this.journal.save({ ...intent, phase: 'review', planToken: result.planToken, localBasis: result.localBasis,
        expectedRevision: head.revision, publishedRevision: undefined, publishSha256: undefined, publishBytes: undefined });
      this.reviewPassword = password;
      this.showPlan(result, head.missing ? '原候选已保留并重新合并。请核对后确认新建共享文件；若另一端已重新创建，本次条件写入不会覆盖它。' :
        '原未确认候选已保留，现已与当前远端重新合并。请逐项核对，确认后才会发布新的版本。');
    } catch (error) { await this.failed(error, operationId); }
    finally { password = ''; this.redact(binding); this.active = false; this.publish({ ...this.state }); }
  }
  canRecoverHandoff(): boolean { if (this.logMode) return this.log().canRecoverHandoff(); return !this.active && this.owner.canRecoverLibraryRestoreFailure(); }
  async recoverHandoff(current: () => boolean): Promise<void> {
    if (this.logMode) { await this.log().recoverHandoff(current); return; }
    let visible = false; try { visible = current(); } catch (_) {}
    if (!visible || !this.canRecoverHandoff()) return;
    this.active = true;
    try { await this.owner.recoverAfterLibraryRestoreFailure(); }
    catch (_) { this.publish({ ...this.state, status: 'pending', restartRequired: true, message: '书架尚未重新打开，请稍后通过原入口继续；原同步记录保留。' }); }
    finally { this.active = false; this.publish({ ...this.state }); }
  }
  retire(): void {
    this.generation += 1; this.reviewPassword = '';
    if (this.logMode) this.log().retire();
    // Presentation retirement does not cancel or clear a durable business intent.
  }
  private async failed(error: Object, operationId?: string): Promise<void> {
    if (!this.current()) {
      if (this.owner.canRecoverLibraryRestoreFailure()) this.publish({ ...this.state, status: 'pending', operationId,
        restartRequired: true, canContinueCommit: false, canRebase: false, message: '书架尚未重新打开，原同步结果保留。请先重新打开书架，再核对原操作。' });
      return;
    }
    let intent: ReaderLibrarySyncIntent | undefined;
    try { intent = await this.journal.load(); } catch (_) {
      this.publish({ ...this.state, status: 'pending', operationId, message: '原同步记录尚未读清，请保留当前连接后重新核对。' }); return;
    }
    const code = error instanceof Error ? error.message : '';
    this.publish({ ...this.state, operationId: intent?.operationId ?? operationId, status: intent === undefined ? 'failed' : 'pending',
      message: code === 'LIBRARY_SYNC_CONDITIONAL_STORAGE_REQUIRED' ?
        '此存储尚未确认可靠的条件创建和条件覆盖，暂不能多端同步。请先完成存储能力检查；已有备份恢复仍可使用。' :
        code === 'LIBRARY_SYNC_NOT_DISPATCHED' ? '本次文件尚未发送。请核对原操作后继续，不会自动重新发送。' :
        intent === undefined ? '书库同步尚未开始，请核对已保存的连接、密码及原存储操作。' :
        '原同步尚未确认，请保留当前存储连接后核对原操作。重新输入加密密码可核验另一端是否已纳入原同步；不会盲目重发。' });
  }
}
