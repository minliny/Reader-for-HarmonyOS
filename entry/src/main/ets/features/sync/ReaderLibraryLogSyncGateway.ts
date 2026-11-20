import util from '@ohos.util';
import hilog from '@ohos.hilog';
import { ReaderCoreRequestError, type JsonObject } from '@reader/core-harmony';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { NetworkEnvironmentError } from '../../app/NetworkRoutePolicy';
import { ReaderWebDavStorageConnection, type ReaderWebDavStorageBinding } from './ReaderWebDavStorageConnection';
import { WebDavCredentialStore } from './WebDavCredentialStore';
import { ReaderLibraryLogSyncJournal, readerLibraryLogObject, type ReaderLibraryLogSyncIntent,
  type ReaderLibraryLogObject, type ReaderLibraryLogSyncPhase } from './ReaderLibraryLogSyncJournal';
import { ReaderLibraryLogSyncTransport, type ReaderLibraryLogListing, type ReaderLibraryLogReadback,
  type ReaderLibraryLogReadPhase } from './ReaderLibraryLogSyncTransport';
import { READER_LIBRARY_SYNC_MAX_BYTES } from './ReaderLibrarySyncJournal';
import { readerLibrarySyncConflictViews, type ReaderLibrarySyncRawConflict } from './ReaderLibrarySyncProjection';
import type { ReaderLibrarySyncSnapshot, ReaderLibrarySyncChannel, ReaderLibrarySyncCounts,
  ReaderLibrarySyncConflict, ReaderLibrarySyncCandidate } from './ReaderLibrarySyncTypes';

interface ReaderLibraryLogPlan {
  protocolVersion: 2;
  operationId: string;
  status: 'collecting' | 'review' | 'ready' | 'needsRebase' | 'committed' | 'retired' | 'missing' | 'pending';
  channelId?: string;
  channelHash?: string;
  planToken?: string;
  localBasis?: string;
  counts?: ReaderLibrarySyncCounts;
  conflicts?: ReaderLibrarySyncRawConflict[];
  joinRequired?: boolean;
  publishContent?: string;
  publishSha256?: string;
  publishBytes?: number;
  objectId?: string;
  retireObjects?: string[];
  expectedObjects?: number;
  acceptedObjects?: number;
  publication?: 'included' | 'absent' | 'unknown';
  restartRequired?: boolean;
}
interface ReaderLibraryLogDecision { key: string; choice: string; }
interface ReaderLibraryLogCapabilities { currentChannelId?: string; currentChannelHash?: string; lastPublishedObjectId?: string; }
const empty = (): ReaderLibrarySyncSnapshot => ({ status: 'idle', supported: false, conflicts: [], joinRequired: false,
  reviewRevision: 0, canRebase: false, canContinueCommit: false, transport: 'immutableLogV2', channels: [], canCleanup: false, message: '' });

/** Foreground immutable storage adapter. Core owns every authenticated merge,
 * conflict decision and SQL application; this owner only binds remote objects,
 * original operation receipts and the previously approved exact cleanup. */
export class ReaderLibraryLogSyncGateway {
  private readonly storage: ReaderWebDavStorageConnection;
  private readonly journal: ReaderLibraryLogSyncJournal;
  private readonly transport: ReaderLibraryLogSyncTransport;
  private state: ReaderLibrarySyncSnapshot = empty();
  private active: boolean = false;
  private generation: number = 0;
  private revision: number = 0;
  private plan: ReaderLibraryLogPlan | undefined;
  private password: string = '';
  private decisions: ReaderLibraryLogDecision[] = [];
  private listeners: Array<() => void> = [];
  private capabilities: ReaderLibraryLogCapabilities = {};
  private diagnosticPhase: string = 'idle';
  private traceFailure(error: Object, phase: string = this.diagnosticPhase): void {
    // Only source-owned phase names and enumerated codes leave this boundary.
    // Native messages may contain a path, URL, header or user text: never log them.
    try {
      const known = new Set<string>([
        'LIBRARY_LOG_CLEANUP_NOT_AUTHORIZED', 'LIBRARY_LOG_COMMIT_FACT_INVALID', 'LIBRARY_LOG_CONNECTION_CHANGED',
        'LIBRARY_LOG_COVERING_VERSION_UNCONFIRMED', 'LIBRARY_LOG_DISCOVERY_BUDGET', 'LIBRARY_LOG_DISCOVERY_INVALID',
        'LIBRARY_LOG_DISCOVERY_UNCONFIRMED', 'LIBRARY_LOG_LIST_CHANGED', 'LIBRARY_LOG_NOT_DISPATCHED',
        'LIBRARY_LOG_OBJECT_INVALID', 'LIBRARY_LOG_OBJECT_CHANGED', 'LIBRARY_LOG_OPERATION_INVALID',
        'LIBRARY_LOG_ORIGINAL_OPERATION_CHANGED', 'LIBRARY_LOG_ORIGINAL_OPERATION_PENDING', 'LIBRARY_LOG_ORIGINAL_SOURCE_CHANGED',
        'LIBRARY_LOG_PUBLICATION_NOT_PREPARED', 'LIBRARY_LOG_REPLY_INVALID', 'LIBRARY_LOG_RESULT_PENDING',
        'LIBRARY_LOG_REVIEW_REQUIRED', 'LIBRARY_LOG_UNSUPPORTED', 'LIBRARY_LOG_READ_UNCONFIRMED',
        'LIBRARY_LOG_JOURNAL_CHANGED', 'LIBRARY_LOG_JOURNAL_INVALID', 'LIBRARY_LOG_JOURNAL_RETIRED',
        'LIBRARY_LOG_JOURNAL_UNCONFIRMED', 'LIBRARY_LOG_SOURCE_CHANGED', 'LIBRARY_LOG_SOURCE_INVALID',
        'LIBRARY_LOG_REBASE_STATE_UNCONFIRMED', 'LIBRARY_LOG_REBASE_INPUT_CHANGED',
        'LIBRARY_LOG_CLEANUP_UNCONFIRMED', 'LIBRARY_LOG_CAPABILITIES_INVALID',
        'STORAGE_NETWORK_URI_INVALID', 'STORAGE_NETWORK_AUTHORITY_RETIRED', 'STORAGE_NETWORK_CONNECTION_CHANGED',
        'STORAGE_NETWORK_DIRECTORY_INVALID', 'STORAGE_NETWORK_METHOD_INVALID', 'STORAGE_NETWORK_ORIGIN_CHANGED',
        'STORAGE_NETWORK_DIRECTORY_CHANGED', 'BACKUP_STORAGE_RUNTIME_RETIRED', 'BACKUP_STORAGE_CONNECTION_CHANGED',
        'BACKUP_STORAGE_PROBE_BODY_INVALID', 'BACKUP_STORAGE_PLAN_INVALID', 'BACKUP_STORAGE_PROBE_PENDING',
        'BACKUP_PACKAGE_ORIGINAL_OPERATION_PENDING', 'BACKUP_PACKAGE_CONNECTION_REQUIRED', 'BACKUP_PACKAGE_CONNECTION_INVALID',
      ]);
      // Exact literals from Core, SDK and this Host path only. Dynamic causes
      // cannot enter this map and remain OTHER; log the fixed code, never text.
      const reasons = new Map<string, string>([
        ['library sync log password required', 'LIBRARY_LOG_CORE_PASSWORD_REQUIRED'],
        ['library sync log operation identity invalid', 'LIBRARY_LOG_CORE_OPERATION_IDENTITY_INVALID'],
        ['library sync log object name invalid', 'LIBRARY_LOG_CORE_OBJECT_NAME_INVALID'],
        ['library sync log object hash or budget invalid', 'LIBRARY_LOG_CORE_OBJECT_HASH_OR_BUDGET_INVALID'],
        ['library sync log envelope invalid', 'LIBRARY_LOG_CORE_ENVELOPE_INVALID'],
        ['library sync log protocol unsupported', 'LIBRARY_LOG_CORE_PROTOCOL_UNSUPPORTED'],
        ['library sync log authentication failed', 'LIBRARY_LOG_CORE_AUTHENTICATION_FAILED'],
        ['library sync log metadata budget exceeded', 'LIBRARY_LOG_CORE_METADATA_BUDGET_EXCEEDED'],
        ['library sync log metadata invalid', 'LIBRARY_LOG_CORE_METADATA_INVALID'],
        ['library sync log object channel or operation invalid', 'LIBRARY_LOG_CORE_OBJECT_CHANNEL_OR_OPERATION_INVALID'],
        ['library sync log encryption failed', 'LIBRARY_LOG_CORE_ENCRYPTION_FAILED'],
        ['library sync log wire budget exceeded', 'LIBRARY_LOG_CORE_WIRE_BUDGET_EXCEEDED'],
        ['library sync log original CAS operation unresolved', 'LIBRARY_LOG_CORE_ORIGINAL_CAS_OPERATION_UNRESOLVED'],
        ['library sync log operation missing', 'LIBRARY_LOG_CORE_OPERATION_MISSING'],
        ['library sync log plan changed', 'LIBRARY_LOG_CORE_PLAN_CHANGED'],
        ['library sync log durable storage required', 'LIBRARY_LOG_CORE_DURABLE_STORAGE_REQUIRED'],
        ['library sync log parameters invalid', 'LIBRARY_LOG_CORE_PARAMETERS_INVALID'],
        ['library sync log object missing', 'LIBRARY_LOG_CORE_OBJECT_MISSING'],
        ['library sync log content missing', 'LIBRARY_LOG_CORE_CONTENT_MISSING'],
        ['library sync log discovery incomplete or budget exceeded', 'LIBRARY_LOG_CORE_DISCOVERY_INCOMPLETE_OR_BUDGET_EXCEEDED'],
        ['library sync log original operation unresolved', 'LIBRARY_LOG_CORE_ORIGINAL_OPERATION_UNRESOLVED'],
        ['library sync log operation identity reused', 'LIBRARY_LOG_CORE_OPERATION_IDENTITY_REUSED'],
        ['library sync log rebase requires unresolved original generation and confirmation', 'LIBRARY_LOG_CORE_REBASE_ORIGINAL_GENERATION_REQUIRED'],
        ['library sync log foreign selected channel', 'LIBRARY_LOG_CORE_FOREIGN_SELECTED_CHANNEL'],
        ['library sync log channel changed', 'LIBRARY_LOG_CORE_CHANNEL_CHANGED'],
        ['library sync log discovery object channel or duplicate invalid', 'LIBRARY_LOG_CORE_DISCOVERY_OBJECT_CHANNEL_OR_DUPLICATE_INVALID'],
        ['library sync log empty foreign channel unauthenticated', 'LIBRARY_LOG_CORE_EMPTY_FOREIGN_CHANNEL_UNAUTHENTICATED'],
        ['library sync log collection changed; rebase required', 'LIBRARY_LOG_CORE_COLLECTION_CHANGED'],
        ['library sync log object outside discovery', 'LIBRARY_LOG_CORE_OBJECT_OUTSIDE_DISCOVERY'],
        ['library sync log foreign object channel', 'LIBRARY_LOG_CORE_FOREIGN_OBJECT_CHANNEL'],
        ['library sync log review changed; rebase required', 'LIBRARY_LOG_CORE_REVIEW_CHANGED'],
        ['library sync log ingest incomplete', 'LIBRARY_LOG_CORE_INGEST_INCOMPLETE'],
        ['library sync log review unavailable', 'LIBRARY_LOG_CORE_REVIEW_UNAVAILABLE'],
        ['library sync log not ready for publication', 'LIBRARY_LOG_CORE_NOT_READY_FOR_PUBLICATION'],
        ['library sync log unknown publication cannot retire', 'LIBRARY_LOG_CORE_UNKNOWN_PUBLICATION_CANNOT_RETIRE'],
        ['library sync log readback proof required', 'LIBRARY_LOG_CORE_READBACK_PROOF_REQUIRED'],
        ['library sync log readback proof changed', 'LIBRARY_LOG_CORE_READBACK_PROOF_CHANGED'],
        ['library sync log exact dispatched publication required', 'LIBRARY_LOG_CORE_EXACT_DISPATCHED_PUBLICATION_REQUIRED'],
        ['library sync log original publication changed', 'LIBRARY_LOG_CORE_ORIGINAL_PUBLICATION_CHANGED'],
        ['library sync log original receipt changed', 'LIBRARY_LOG_CORE_ORIGINAL_RECEIPT_CHANGED'],
        ['library sync log foreign publication proof', 'LIBRARY_LOG_CORE_FOREIGN_PUBLICATION_PROOF'],
        ['Reader-Core runtime is closed', 'LIBRARY_LOG_SDK_RUNTIME_CLOSED'],
        ['request was not admitted by this SDK runtime', 'LIBRARY_LOG_SDK_REQUEST_NOT_ADMITTED'],
        ['request already has a result consumer', 'LIBRARY_LOG_SDK_RESULT_CONSUMER_EXISTS'],
        ['invalid Reader-Core event envelope', 'LIBRARY_LOG_SDK_EVENT_ENVELOPE_INVALID'],
        ['invalid Reader-Core delivery receipt', 'LIBRARY_LOG_SDK_DELIVERY_RECEIPT_INVALID'],
        ['invalid Reader-Core result event', 'LIBRARY_LOG_SDK_RESULT_EVENT_INVALID'],
        ['invalid Reader-Core error event', 'LIBRARY_LOG_SDK_ERROR_EVENT_INVALID'],
        ['invalid Reader-Core host.request event', 'LIBRARY_LOG_SDK_HOST_EVENT_INVALID'],
        ['Reader Core request was not dispatched', 'LIBRARY_LOG_RUNTIME_NOT_DISPATCHED'],
        ['Reader Runtime is retiring; no new request was dispatched', 'LIBRARY_LOG_RUNTIME_RETIRING'],
        ['Reader Core runtime was closed during capability negotiation', 'LIBRARY_LOG_RUNTIME_CAPABILITY_CLOSED'],
        ['Reader Core runtime was closed before successor startup', 'LIBRARY_LOG_RUNTIME_SUCCESSOR_CLOSED'],
        ['Reader Core runtime was closed during restore reconciliation', 'LIBRARY_LOG_RUNTIME_RESTORE_CLOSED'],
        ['Reader Core runtime was closed during startup', 'LIBRARY_LOG_RUNTIME_STARTUP_CLOSED'],
        ['书籍任务已关闭', 'LIBRARY_LOG_RUNTIME_BOOK_TASK_CLOSED'],
        ['书籍请求已取消', 'LIBRARY_LOG_RUNTIME_BOOK_REQUEST_CANCELLED'],
        ['http.execute: invalid response limit', 'LIBRARY_LOG_HTTP_RESPONSE_LIMIT_INVALID'],
        ['http.execute requires non-empty url', 'LIBRARY_LOG_HTTP_URL_REQUIRED'],
        ['http.execute: httpsOnly must be a boolean', 'LIBRARY_LOG_HTTP_HTTPS_ONLY_INVALID'],
        ['http.execute: sameOriginRedirectsOnly must be a boolean', 'LIBRARY_LOG_HTTP_SAME_ORIGIN_INVALID'],
        ['http.execute: user storage host override is not allowed', 'LIBRARY_LOG_HTTP_STORAGE_HOST_OVERRIDE'],
        ['http.execute: user storage forbids redirects and shared cookies', 'LIBRARY_LOG_HTTP_STORAGE_POLICY_INVALID'],
        ['http.execute: usePlatformCookieJar must be a boolean', 'LIBRARY_LOG_HTTP_COOKIE_POLICY_INVALID'],
        ['http.execute: platform cookie jar requires opaque session.id', 'LIBRARY_LOG_HTTP_COOKIE_SESSION_REQUIRED'],
        ['http.execute: timeoutMs must be a positive integer', 'LIBRARY_LOG_HTTP_TIMEOUT_INVALID'],
        ['http.execute: method must be a non-empty HTTP token', 'LIBRARY_LOG_HTTP_METHOD_REQUIRED'],
        ['http.execute: method must be a valid HTTP token', 'LIBRARY_LOG_HTTP_METHOD_INVALID'],
        ['http.execute: headers must be an object', 'LIBRARY_LOG_HTTP_HEADERS_INVALID'],
        ['http.execute: unsupported body shape', 'LIBRARY_LOG_HTTP_BODY_INVALID'],
        ['http.execute: charset must be a non-empty string', 'LIBRARY_LOG_HTTP_CHARSET_INVALID'],
        ['http.execute: retry must be an object', 'LIBRARY_LOG_HTTP_RETRY_INVALID'],
        ['http.execute: session must be an object', 'LIBRARY_LOG_HTTP_SESSION_INVALID'],
        ['http.execute: session.id must be a non-empty string', 'LIBRARY_LOG_HTTP_SESSION_ID_INVALID'],
        ['http.execute: followRedirects must be a boolean', 'LIBRARY_LOG_HTTP_REDIRECT_INVALID'],
        ['http.execute: followRedirects=false conflicts with maxRedirects > 0', 'LIBRARY_LOG_HTTP_REDIRECT_CONFLICT'],
        ['http.execute: cancelled', 'LIBRARY_LOG_HTTP_CANCELLED'],
        ['http.execute: cancelled by caller', 'LIBRARY_LOG_HTTP_CANCELLED_BY_CALLER'],
        ['http.execute: cancelled by Core request', 'LIBRARY_LOG_HTTP_CANCELLED_BY_CORE'],
        ['http.execute: exceeded total deadline', 'LIBRARY_LOG_HTTP_DEADLINE'],
        ['http.execute request failed', 'LIBRARY_LOG_HTTP_REQUEST_FAILED'],
        ['http.execute: url must use http or https', 'LIBRARY_LOG_HTTP_URL_SCHEME_INVALID'],
        ['http.execute: HTTPS is required for this request and its redirects', 'LIBRARY_LOG_HTTP_HTTPS_REQUIRED'],
        ['http.execute: user storage redirect is not allowed', 'LIBRARY_LOG_HTTP_STORAGE_REDIRECT'],
        ['http.execute: cross-origin redirect is not allowed for this request', 'LIBRARY_LOG_HTTP_CROSS_ORIGIN_REDIRECT'],
      ]);
      const message = error instanceof Error ? error.message : '';
      const sdkCancellation = /^Reader-Core request cancelled by caller: [0-9]+$/.test(message) ? 'LIBRARY_LOG_SDK_CANCELLED' :
        /^Reader-Core request timed out: [0-9]+$/.test(message) ? 'LIBRARY_LOG_SDK_TIMEOUT' : undefined;
      const code = known.has(message) ? message : reasons.get(message) ?? sdkCancellation ?? 'LIBRARY_LOG_OTHER';
      const value = (error as { code?: unknown }).code;
      const numeric = typeof value === 'string' && /^-?\d{1,15}$/.test(value) ? Number(value) : value;
      const native = typeof numeric === 'number' && Number.isSafeInteger(numeric) ? numeric : 0;
      const admissionCode = value === 'BUSY' || value === 'RESOURCE_EXHAUSTED' ? value : 'OTHER';
      const admissionReasons = new Map<string, string>([
        ['Reader-Core command was not admitted: command exceeds the wire byte limit', 'wire_limit'],
        ['Reader-Core command was not admitted: runtime input byte budget is occupied', 'input_budget'],
        ['Reader-Core command was not admitted: runtime result reservation contract failed; drain and recreate', 'contract_fault'],
        ['Reader-Core command was not admitted: runtime input class byte budget is occupied', 'input_class_budget'],
        ['Reader-Core command was not admitted: runtime request or terminal budget is occupied', 'terminal_budget'],
        ['Reader-Core command was not admitted: runtime lane is occupied', 'lane'],
      ]);
      const admissionReason = admissionCode === 'OTHER' ? 'OTHER' : admissionReasons.get(message) ?? 'OTHER';
      const names = new Set<string>(['Error', 'TypeError', 'SyntaxError', 'RangeError', 'ReaderCoreRequestError']);
      const errorName = error instanceof Error && names.has(error.name) ? error.name : 'OTHER';
      const coreCodes = new Set<string>(['UNKNOWN_METHOD', 'INVALID_PARAMS', 'INVALID_PROTOCOL_VERSION', 'CANCELLED',
        'TIMEOUT', 'INVALID_MESSAGE', 'INTERNAL', 'TRANSACTION_PENDING', 'BUSY', 'RESOURCE_EXHAUSTED', 'BOOK_ALREADY_ON_SHELF']);
      const coreCode = error instanceof ReaderCoreRequestError && coreCodes.has(error.event.error.code) ? error.event.error.code : 'OTHER';
      const networkPhase = error instanceof NetworkEnvironmentError && ['dns', 'route', 'transport'].includes(error.details.phase) ?
        error.details.phase : 'OTHER';
      const networkNative = error instanceof NetworkEnvironmentError && typeof error.details.platformCode === 'number' &&
        Number.isSafeInteger(error.details.platformCode) ? error.details.platformCode : 0;
      hilog.warn(0x5244, 'Reader', 'library.log.failure phase=%{public}s code=%{public}s native=%{public}d errorName=%{public}s coreCode=%{public}s networkPhase=%{public}s networkNative=%{public}d admissionCode=%{public}s admissionReason=%{public}s',
        phase, code, native, errorName, coreCode, networkPhase, networkNative, admissionCode, admissionReason);
    } catch (_) { /* Diagnostics cannot alter the original business outcome. */ }
  }
  constructor(private readonly owner: ReaderRuntimeOwner,
    private readonly credentials: WebDavCredentialStore = WebDavCredentialStore.instance,
    storage?: ReaderWebDavStorageConnection, journal?: ReaderLibraryLogSyncJournal, transport?: ReaderLibraryLogSyncTransport) {
    const context = owner.getUIAbilityContext(); credentials.attachContext(context);
    this.storage = storage ?? new ReaderWebDavStorageConnection(owner, credentials);
    this.journal = journal ?? new ReaderLibraryLogSyncJournal(context.filesDir);
    this.transport = transport ?? new ReaderLibraryLogSyncTransport(owner, this.storage);
  }
  private current(): boolean { return ReaderRuntimeOwner.isCurrent(this.owner) && this.owner.canConfigureBackupStorage(); }
  private admitted(current: () => boolean): boolean { try { return this.current() && current(); } catch (_) { return false; } }
  private publish(value: ReaderLibrarySyncSnapshot): void {
    this.state = value;
    if (!this.current() && !this.owner.canRecoverLibraryRestoreFailure()) return;
    for (const listener of this.listeners) { try { listener(); } catch (_) {} }
  }
  snapshot(): ReaderLibrarySyncSnapshot {
    return { ...this.state, channels: this.state.channels?.map((row: ReaderLibrarySyncChannel): ReaderLibrarySyncChannel => ({ ...row })),
      counts: this.state.counts === undefined ? undefined : { ...this.state.counts },
      conflicts: this.state.conflicts.map((row): ReaderLibrarySyncConflict => ({ ...row,
        candidates: row.candidates.map((candidate): ReaderLibrarySyncCandidate => ({ ...candidate })),
        decision: this.decisions.find((value: ReaderLibraryLogDecision): boolean => value.key === row.key)?.choice })) };
  }
  subscribe(listener: () => void): () => void {
    this.listeners.push(listener); return (): void => { this.listeners = this.listeners.filter((value): boolean => value !== listener); };
  }
  busy(): boolean { return this.active; }
  needsPassword(): boolean { return this.plan?.status !== 'ready' && this.password.length === 0; }
  // This maintenance surface can only continue an existing durable operation.
  canPrepare(): boolean { return false; }
  canConfirm(operationId: string, revision: number = this.state.reviewRevision, suppliedPassword: boolean = false): boolean {
    return this.current() && !this.active && this.state.status === 'review' && this.state.operationId === operationId &&
      this.state.reviewRevision === revision && this.plan?.operationId === operationId &&
      (!this.needsPassword() || suppliedPassword) && this.state.conflicts.every((row): boolean => this.decisions.some((value): boolean => value.key === row.key));
  }
  chooseChannel(id: string, current: () => boolean, revision: number = this.state.reviewRevision): void {
    if (!this.admitted(current) || !this.canPrepare() || revision !== this.state.reviewRevision ||
      !this.state.channels?.some((row: ReaderLibrarySyncChannel): boolean => row.id === id)) return;
    this.password = ''; this.publish({ ...this.state, selectedChannel: id, reviewRevision: ++this.revision, message: '已选择共享书库，请输入加密密码后读取并核对。' });
  }
  choose(operationId: string, key: string, choice: string, current: () => boolean, revision: number = this.state.reviewRevision): void {
    if (!this.admitted(current) || this.active || this.state.status !== 'review' || this.state.operationId !== operationId ||
      revision !== this.state.reviewRevision || !this.state.conflicts.some((row): boolean =>
        row.key === key && row.candidates.some((candidate): boolean => candidate.choice === choice))) return;
    this.decisions = this.decisions.filter((value): boolean => value.key !== key).concat([{ key, choice }]);
    this.publish({ ...this.state, reviewRevision: ++this.revision });
  }
  private decode(value: JsonObject, operationId: string): ReaderLibraryLogPlan {
    const copy: JsonObject = { ...value };
    for (const key of ['channelId', 'channelHash', 'planToken', 'localBasis', 'counts', 'conflicts', 'joinRequired',
      'publishContent', 'publishSha256', 'publishBytes', 'objectId', 'retireObjects', 'expectedObjects', 'acceptedObjects',
      'publication', 'restartRequired']) if (copy[key] === null) delete copy[key];
    const plan = copy as unknown as ReaderLibraryLogPlan;
    if (plan.protocolVersion !== 2 || plan.operationId !== operationId ||
      !['collecting', 'review', 'ready', 'needsRebase', 'committed', 'retired', 'missing', 'pending'].includes(plan.status) ||
      plan.channelHash !== undefined && !/^[0-9a-f]{64}$/.test(plan.channelHash) ||
      plan.channelId !== undefined && (typeof plan.channelId !== 'string' || plan.channelId.length < 1 || plan.channelId.length > 128) ||
      plan.publishContent !== undefined && (typeof plan.publishContent !== 'string' || plan.publishContent.length > READER_LIBRARY_SYNC_MAX_BYTES) ||
      plan.publishSha256 !== undefined && !/^[0-9a-f]{64}$/.test(plan.publishSha256) ||
      plan.publishBytes !== undefined && (!Number.isSafeInteger(plan.publishBytes) || plan.publishBytes < 1 || plan.publishBytes > READER_LIBRARY_SYNC_MAX_BYTES))
      throw new Error('LIBRARY_LOG_REPLY_INVALID');
    for (const count of [plan.expectedObjects, plan.acceptedObjects]) {
      if (count !== undefined && (!Number.isSafeInteger(count) || count < 0 || count > 4096)) throw new Error('LIBRARY_LOG_REPLY_INVALID');
    }
    if (plan.expectedObjects !== undefined && plan.acceptedObjects !== undefined && plan.acceptedObjects > plan.expectedObjects)
      throw new Error('LIBRARY_LOG_REPLY_INVALID');
    if (['collecting', 'review', 'ready', 'needsRebase'].includes(plan.status) &&
      (typeof plan.planToken !== 'string' || plan.planToken.length < 1 || plan.planToken.length > 256 ||
       typeof plan.localBasis !== 'string' || plan.localBasis.length < 1 || plan.localBasis.length > 256 || plan.channelHash === undefined || plan.channelId === undefined))
      throw new Error('LIBRARY_LOG_REPLY_INVALID');
    if (['review', 'ready', 'needsRebase'].includes(plan.status)) {
      if (plan.counts === undefined || !Array.isArray(plan.conflicts) ||
        ['records', 'deleted', 'conflicts', 'books', 'positions', 'marks'].some((key: string): boolean => {
          const count = (plan.counts as unknown as Record<string, unknown>)[key];
          return typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0 || count > 100000;
        })) throw new Error('LIBRARY_LOG_REPLY_INVALID');
    }
    if (plan.objectId !== undefined) {
      const object = readerLibraryLogObject(plan.objectId);
      // Core retains the retired object's identity after erasing its candidate
      // bytes and hash. This terminal receipt only permits retiring local intent;
      // live and committed frames still require the exact publication hash.
      const retiredWithoutSha = plan.status === 'retired' && plan.publishSha256 === undefined;
      if (object === undefined || object.operationId !== operationId ||
        !retiredWithoutSha && object.sha256 !== plan.publishSha256 || object.channelHash !== plan.channelHash)
        throw new Error('LIBRARY_LOG_REPLY_INVALID');
    }
    if (plan.retireObjects !== undefined && (!Array.isArray(plan.retireObjects) || plan.retireObjects.length > 4096 ||
      new Set(plan.retireObjects).size !== plan.retireObjects.length || plan.retireObjects.some((key: string): boolean => {
        const object = typeof key === 'string' ? readerLibraryLogObject(key) : undefined;
        return object === undefined || object.channelHash !== plan.channelHash || key === plan.objectId;
      }))) throw new Error('LIBRARY_LOG_REPLY_INVALID');
    return plan;
  }
  private async request(method: string, params: JsonObject, operationId: string): Promise<ReaderLibraryLogPlan> {
    const phase = this.diagnosticPhase;
    const value = (await this.owner.request(`library.sync.log.${method}`, params)).data;
    this.diagnosticPhase = `${phase}.decode`;
    const result = this.decode(value, operationId);
    this.diagnosticPhase = phase;
    return result;
  }
  private requireBinding(intent: ReaderLibraryLogSyncIntent, binding: ReaderWebDavStorageBinding): void {
    if (intent.configOperationId !== binding.operationId || intent.configPayloadHash !== binding.payloadHash || intent.directory !== binding.config.directory)
      throw new Error('LIBRARY_LOG_CONNECTION_CHANGED');
  }
  private redact(binding?: ReaderWebDavStorageBinding): void {
    if (binding !== undefined) { binding.config.password = ''; binding.config.backupPassword = ''; }
  }
  private async readObject(binding: ReaderWebDavStorageBinding, objectId: string): Promise<ReaderLibraryLogReadback | undefined> {
    const phase = this.diagnosticPhase;
    const result = await this.transport.read(binding, objectId, (step: ReaderLibraryLogReadPhase): void => { this.diagnosticPhase = `${phase}.${step}`; });
    this.diagnosticPhase = phase;
    return result;
  }
  private show(plan: ReaderLibraryLogPlan, message: string = ''): void {
    this.plan = plan; this.decisions = [];
    this.publish({ ...empty(), status: 'review', supported: true, operationId: plan.operationId, counts: plan.counts, channels: this.state.channels,
      conflicts: readerLibrarySyncConflictViews(plan.conflicts ?? []), joinRequired: plan.joinRequired === true,
      selectedChannel: plan.channelHash, reviewRevision: ++this.revision,
      message: message || (plan.joinRequired ? '将加入所选共享书库并合并本机数据，请核对内容及每一项冲突。' :
        '请核对本次发现的共享版本及本机变更。确认前不会修改本机书库或发布新记录。') });
  }
  async open(current: () => boolean): Promise<void> {
    if (this.active || !this.admitted(current)) return;
    this.active = true; this.publish({ ...empty(), status: 'loading' });
    try {
      this.diagnosticPhase = 'open.capabilities';
      const value = (await this.owner.request('library.sync.log.capabilities', {})).data;
      if (value['protocolVersion'] !== 2 || value['metadata'] !== true || value['durable'] !== true || value['immutableLog'] !== true)
        throw new Error('LIBRARY_LOG_UNSUPPORTED');
      this.capabilities = { currentChannelId: typeof value['currentChannelId'] === 'string' ? value['currentChannelId'] : undefined,
        currentChannelHash: typeof value['currentChannelHash'] === 'string' ? value['currentChannelHash'] : undefined,
        lastPublishedObjectId: typeof value['lastPublishedObjectId'] === 'string' ? value['lastPublishedObjectId'] : undefined };
      this.diagnosticPhase = 'open.journal';
      const pending = await this.journal.load();
      if (!this.admitted(current)) return;
      this.publish(pending === undefined ? { ...empty(), status: 'unavailable', supported: false, message: '没有待核对的原同步操作。' } : {
        ...empty(), status: 'pending', supported: true, operationId: pending.operationId, selectedChannel: pending.channelHash,
        canRebase: pending.phase === 'needsRebase', canCleanup: ['cleanup', 'committing'].includes(pending.phase),
        message: '原同步或已确认的旧记录整理尚未结束，请先核对原操作；不会盲目重新上传。' });
    } catch (error) { await this.failed(error); }
    finally { this.active = false; this.publish({ ...this.state }); }
  }
  private async discover(binding: ReaderWebDavStorageBinding): Promise<ReaderLibraryLogListing> {
    const listing = await this.transport.list(binding), known = this.capabilities.lastPublishedObjectId;
    if (known !== undefined && readerLibraryLogObject(known) !== undefined && !listing.objects.some((object): boolean => object.objectId === known)) {
      const read = await this.readObject(binding, known);
      if (read !== undefined) {
        listing.objects.push({ ...readerLibraryLogObject(known)!, contentBytes: read.bytes });
        listing.channels = Array.from(new Set(listing.objects.map((object): string => object.channelHash))).sort();
      } else if (!listing.objects.some((object): boolean => object.channelHash === this.capabilities.currentChannelHash))
        throw new Error('LIBRARY_LOG_LIST_CHANGED');
    }
    return listing;
  }
  async prepare(_password: string, _current: () => boolean): Promise<void> {
    // This recovery surface cannot create a new operation or join a channel.
    return;
  }
  private async collect(binding: ReaderWebDavStorageBinding, intent: ReaderLibraryLogSyncIntent, password: string): Promise<ReaderLibraryLogPlan> {
    let total = 0;
    for (const objectId of intent.objectIds) {
      const read = await this.readObject(binding, objectId);
      if (read === undefined) throw new Error('LIBRARY_LOG_LIST_CHANGED');
      total += read.bytes; if (total > 128 * 1024 * 1024) throw new Error('LIBRARY_LOG_DISCOVERY_BUDGET');
      const payload: JsonObject = { operationId: intent.operationId, planToken: intent.planToken!, password,
        objectId, remoteContent: read.content };
      try { await this.request('ingest', payload, intent.operationId); }
      finally { payload['remoteContent'] = ''; read.content = ''; }
    }
    return this.request('finish', { operationId: intent.operationId, planToken: intent.planToken!, password }, intent.operationId);
  }
  async confirm(operationId: string, revision: number, password: string, current: () => boolean): Promise<void> {
    if (!this.canConfirm(operationId, revision, password.length > 0) || !this.admitted(current)) return;
    password = password || this.password; this.password = ''; this.active = true;
    let binding: ReaderWebDavStorageBinding | undefined;
    this.publish({ ...this.state, status: 'publishing', message: '正在发布并读回核对同步记录…' });
    try {
      this.diagnosticPhase = 'confirm.openStorage';
      binding = await this.storage.open();
      this.diagnosticPhase = 'confirm.loadJournal';
      let intent = await this.journal.load();
      this.diagnosticPhase = 'confirm.validateOriginal';
      if (intent?.operationId !== operationId || intent.planToken !== this.plan?.planToken || !['review', 'prepared'].includes(intent.phase))
        throw new Error('LIBRARY_LOG_ORIGINAL_OPERATION_CHANGED');
      this.requireBinding(intent, binding);
      this.diagnosticPhase = 'confirm.resolve';
      const plan = this.plan?.status !== 'ready' || this.decisions.length > 0 ? await this.request('resolve', {
        operationId, planToken: this.plan!.planToken!, password, decisions: this.decisions as unknown as JsonObject[] }, operationId) : this.plan;
      this.diagnosticPhase = 'confirm.validatePlan';
      if (plan?.status !== 'ready' || plan.objectId === undefined || plan.publishContent === undefined || plan.publishSha256 === undefined ||
        plan.planToken === undefined || plan.localBasis === undefined || plan.channelHash !== intent.channelHash ||
        plan.retireObjects === undefined || plan.retireObjects.some((key: string): boolean => !intent!.objectIds.includes(key)))
        throw new Error('LIBRARY_LOG_REVIEW_REQUIRED');
      this.diagnosticPhase = 'confirm.prepareSource';
      const bytes = await this.journal.prepareSource(operationId, plan.publishContent, plan.publishSha256);
      if (plan.publishBytes !== undefined && plan.publishBytes !== bytes) throw new Error('LIBRARY_LOG_REPLY_INVALID');
      intent = { ...intent, phase: 'prepared', planToken: plan.planToken, localBasis: plan.localBasis, objectId: plan.objectId,
        publishSha256: plan.publishSha256, publishBytes: bytes, retireObjects: [...plan.retireObjects],
        cleanupRemaining: [...plan.retireObjects], cleanupAuthorized: true };
      this.diagnosticPhase = 'confirm.savePrepared';
      await this.journal.save(intent); this.plan = plan;
      this.diagnosticPhase = 'confirm.publishOriginal';
      await this.publishOriginal(binding, intent);
    } catch (error) { await this.failed(error, operationId); }
    finally { password = ''; this.redact(binding); this.active = false; this.publish({ ...this.state }); }
  }
  private async publishOriginal(binding: ReaderWebDavStorageBinding, intent: ReaderLibraryLogSyncIntent): Promise<void> {
    this.requireBinding(intent, binding);
    this.diagnosticPhase = 'publish.verifySource';
    const path = await this.journal.verifySource(intent.operationId, intent.publishSha256!, intent.publishBytes!);
    const willDispatch = async (): Promise<void> => {
      this.diagnosticPhase = 'publish.saveDispatch';
      await this.journal.save({ ...intent, phase: 'mayPublish' });
      this.diagnosticPhase = 'publish.coreFence';
      const frame = await this.request('publish', { operationId: intent.operationId, planToken: intent.planToken! }, intent.operationId);
      if (frame.status !== 'ready' || frame.planToken !== intent.planToken || frame.publication !== 'unknown')
        throw new Error('LIBRARY_LOG_PUBLICATION_NOT_PREPARED');
      if (!await this.storage.isCurrent(binding)) throw new Error('LIBRARY_LOG_CONNECTION_CHANGED');
    };
    this.diagnosticPhase = 'publish.readOriginal';
    let read = await this.readObject(binding, intent.objectId!);
    if (read === undefined) {
      this.diagnosticPhase = 'publish.transport';
      try { await this.transport.put(binding, intent.objectId!, path, intent.publishBytes!, willDispatch); }
      catch (error) { this.traceFailure(error); /* Query the original unique object; never blindly resend. */ }
      this.diagnosticPhase = 'publish.loadDispatched';
      const observed = await this.journal.load();
      if (observed?.operationId !== intent.operationId) throw new Error('LIBRARY_LOG_ORIGINAL_OPERATION_CHANGED');
      if (observed.phase === 'prepared') throw new Error('LIBRARY_LOG_NOT_DISPATCHED');
      this.diagnosticPhase = 'publish.readback';
      read = await this.readObject(binding, intent.objectId!);
    } else await willDispatch();
    if (read === undefined || read.sha256 !== intent.publishSha256 || read.bytes !== intent.publishBytes)
      throw new Error('LIBRARY_LOG_RESULT_PENDING');
    const published = { ...intent, phase: 'published' as ReaderLibraryLogSyncPhase };
    this.diagnosticPhase = 'publish.saveReadback';
    await this.journal.save(published); await this.commit(published);
  }
  private proof(intent: ReaderLibraryLogSyncIntent): JsonObject {
    return { kind: 'immutableReadbackV2', objectId: intent.objectId!, sha256: intent.publishSha256!, bytes: intent.publishBytes! };
  }
  private async commit(intent: ReaderLibraryLogSyncIntent): Promise<void> {
    this.diagnosticPhase = 'commit.saveIntent';
    await this.journal.save({ ...intent, phase: 'committing' });
    this.diagnosticPhase = 'commit.applyRuntime';
    const frame = this.decode(await this.owner.applyLibraryLogSyncCommit(intent.operationId, intent.planToken!, this.proof(intent), intent.publishSha256!), intent.operationId);
    this.plan = undefined; this.decisions = [];
    if (frame.status === 'committed') {
      // The production apply retires this Runtime. Its successor owns HTTP;
      // the durable journal and Core receipt carry cleanup across the handoff.
      this.publish({ ...empty(), supported: true, status: 'pending', operationId: intent.operationId,
        canCleanup: true, restartRequired: frame.restartRequired,
        message: '书库已同步。重新进入同步后将核对并整理本次已合并的旧记录，不会重新上传。' });
    } else {
      if (this.current()) await this.journal.save({ ...intent, phase: 'needsRebase' });
      this.publish({ ...empty(), supported: true, status: 'pending', operationId: intent.operationId,
        canRebase: frame.status === 'needsRebase', restartRequired: frame.restartRequired,
        message: frame.status === 'needsRebase' ? '本机在同步期间发生了变化，原发布仍保留。请输入密码后重新合并并核对。' :
          '原发布和本机应用结果尚待核对，请保留原连接；不会重新上传。' });
    }
  }
  private committedKeys(frame: ReaderLibraryLogPlan, intent: ReaderLibraryLogSyncIntent): void {
    if (frame.status !== 'committed' || frame.objectId !== intent.objectId || frame.publishSha256 !== intent.publishSha256 ||
      frame.retireObjects === undefined || JSON.stringify([...frame.retireObjects].sort()) !== JSON.stringify([...intent.retireObjects].sort()))
      throw new Error('LIBRARY_LOG_COMMIT_FACT_INVALID');
  }
  private async cleanup(binding: ReaderWebDavStorageBinding, intent: ReaderLibraryLogSyncIntent,
    frame: ReaderLibraryLogPlan, password: string): Promise<void> {
    this.committedKeys(frame, intent);
    if (!intent.cleanupAuthorized) throw new Error('LIBRARY_LOG_CLEANUP_NOT_AUTHORIZED');
    let live = await this.readObject(binding, intent.objectId!);
    let covered = live !== undefined && live.sha256 === intent.publishSha256 && live.bytes === intent.publishBytes;
    if (!covered && password.length > 0) {
      const listing = await this.transport.list(binding);
      for (const object of listing.objects.filter((object: ReaderLibraryLogObject): boolean => object.channelHash === intent.channelHash)) {
        live = await this.readObject(binding, object.objectId);
        if (live === undefined) throw new Error('LIBRARY_LOG_LIST_CHANGED');
        const descendant = await this.request('status', { operationId: intent.operationId, planToken: intent.planToken!,
          publishSha256: intent.publishSha256!, password, objectId: object.objectId, remoteContent: live.content }, intent.operationId);
        if (descendant.publication === 'included') { covered = true; break; }
      }
    }
    let pending: ReaderLibraryLogSyncIntent = { ...intent, phase: 'cleanup' };
    await this.journal.save(pending);
    for (const objectId of pending.cleanupRemaining) {
      // A missing exact parent needs no deletion. A still-present parent is
      // removed only while a live authenticated covering publication exists.
      const parent = await this.readObject(binding, objectId);
      if (parent !== undefined) {
        if (!covered) throw new Error('LIBRARY_LOG_COVERING_VERSION_UNCONFIRMED');
        await this.transport.remove(binding, objectId);
      }
      pending = { ...pending, cleanupRemaining: pending.cleanupRemaining.filter((key: string): boolean => key !== objectId) };
      await this.journal.save(pending);
    }
    await this.journal.clear(intent.operationId);
    this.publish({ ...empty(), supported: true, status: 'completed', message: '书库已同步，本次已合并的旧同步记录已整理。' });
  }
  async reconcile(operationId: string, password: string, current: () => boolean): Promise<void> {
    if (this.active || !this.admitted(current)) return;
    this.active = true; let binding: ReaderWebDavStorageBinding | undefined;
    try {
      this.diagnosticPhase = 'reconcile.loadJournal';
      const intent = await this.journal.load();
      if (intent?.operationId !== operationId) throw new Error('LIBRARY_LOG_ORIGINAL_OPERATION_CHANGED');
      this.diagnosticPhase = 'reconcile.openStorage';
      binding = await this.storage.open(); this.requireBinding(intent, binding);
      if (intent.phase === 'rebasing') { await this.recoverRebase(binding, intent, password, current); return; }
      this.diagnosticPhase = 'reconcile.status';
      const frame = await this.request('status', { operationId, planToken: intent.planToken ?? null,
        publishSha256: intent.publishSha256 ?? null }, operationId);
      if (frame.status === 'committed') { this.diagnosticPhase = 'reconcile.cleanup'; await this.cleanup(binding, intent, frame, password); return; }
      if (['collecting', 'review', 'prepared'].includes(intent.phase) && frame.publication !== 'unknown') {
        if (frame.status === 'missing' || frame.status === 'retired') {
          await this.journal.clear(operationId); this.publish({ ...empty(), supported: true, message: '原准备尚未发布，可以重新读取并核对。' }); return;
        }
        if (frame.status === 'collecting') {
          await this.retireUnsent(intent); this.publish({ ...empty(), supported: true, message: '原读取尚未发布，可以重新读取并核对。' }); return;
        }
        if (frame.status === 'review' || frame.status === 'ready') {
          this.diagnosticPhase = 'reconcile.saveReview';
          await this.journal.save({ ...intent, phase: 'review', planToken: frame.planToken!, localBasis: frame.localBasis!,
            channelId: frame.channelId!, channelHash: frame.channelHash! });
          this.password = password; this.show(frame); return;
        }
      }
      if (intent.objectId !== undefined && intent.publishSha256 !== undefined) {
        this.diagnosticPhase = 'reconcile.readOriginal';
        const read = await this.readObject(binding, intent.objectId);
        if (read !== undefined && read.sha256 === intent.publishSha256 && read.bytes === intent.publishBytes && frame.status !== 'needsRebase') {
          await this.journal.save({ ...intent, phase: 'published' });
          this.publish({ ...empty(), supported: true, status: 'pending', operationId, reviewRevision: ++this.revision,
            canContinueCommit: true, message: '原同步文件已完整核对，请明确继续应用原同步；不会重新上传。' }); return;
        }
      }
      this.publish({ ...empty(), supported: true, status: 'pending', operationId, canRebase: true,
        reviewRevision: ++this.revision, message: '原发布尚未完成本机应用。原候选保留，请输入密码后明确重新合并；不会重发旧文件。' });
    } catch (error) { await this.failed(error, operationId); }
    finally { password = ''; this.redact(binding); this.active = false; this.publish({ ...this.state }); }
  }
  async continueCommit(operationId: string, revision: number, current: () => boolean): Promise<void> {
    if (this.active || !this.admitted(current) || !this.state.canContinueCommit || this.state.operationId !== operationId || this.state.reviewRevision !== revision) return;
    this.active = true;
    try {
      const intent = await this.journal.load();
      if (intent?.operationId !== operationId || !['published', 'committing'].includes(intent.phase)) throw new Error('LIBRARY_LOG_RESULT_PENDING');
      await this.commit(intent);
    } catch (error) { await this.failed(error, operationId); }
    finally { this.active = false; this.publish({ ...this.state }); }
  }
  private rebaseInputs(intent: ReaderLibraryLogSyncIntent, frame: ReaderLibraryLogPlan, complete: boolean): void {
    const ids = intent.rebaseObjectIds;
    if (ids === undefined || frame.operationId !== intent.operationId || frame.channelId !== intent.channelId ||
      frame.channelHash !== intent.channelHash || frame.expectedObjects !== ids.length || frame.retireObjects === undefined ||
      frame.acceptedObjects !== frame.retireObjects.length || frame.retireObjects.some((id: string): boolean => !ids.includes(id)) ||
      complete && (frame.acceptedObjects !== ids.length ||
        JSON.stringify([...frame.retireObjects].sort()) !== JSON.stringify([...ids].sort())))
      throw new Error('LIBRARY_LOG_REBASE_INPUT_CHANGED');
  }
  private async recoverRebase(binding: ReaderWebDavStorageBinding, intent: ReaderLibraryLogSyncIntent,
    password: string, current: () => boolean): Promise<void> {
    // The durable authorization precedes rebase. A lost reply may already have
    // changed Core's generation, so never send that mutation again implicitly.
    this.diagnosticPhase = 'rebase.recoverStatus';
    const frame = await this.request('status', { operationId: intent.operationId }, intent.operationId);
    await this.completeRebase(binding, intent, frame, password, current);
  }
  private async completeRebase(binding: ReaderWebDavStorageBinding, intent: ReaderLibraryLogSyncIntent,
    frame: ReaderLibraryLogPlan, password: string, current: () => boolean): Promise<void> {
    if (intent.phase !== 'rebasing' || intent.rebaseFromToken === undefined || intent.rebaseObjectIds === undefined ||
      frame.channelId !== intent.channelId || frame.channelHash !== intent.channelHash)
      throw new Error('LIBRARY_LOG_REBASE_STATE_UNCONFIRMED');
    if (frame.planToken === intent.rebaseFromToken) {
      if (intent.planToken !== intent.rebaseFromToken ||
        !['collecting', 'review', 'ready', 'needsRebase'].includes(frame.status) ||
        intent.publishSha256 !== undefined && frame.publishSha256 !== intent.publishSha256)
        throw new Error('LIBRARY_LOG_REBASE_STATE_UNCONFIRMED');
      this.plan = undefined;
      this.publish({ ...this.state, status: 'pending', operationId: intent.operationId, canRebase: true,
        canContinueCommit: false, canCleanup: false, reviewRevision: ++this.revision,
        message: '原候选仍在，尚未确认新的重合并代次。请输入密码并再次明确选择重新合并；不会自动重发原请求或文件。' });
      return;
    }
    if (intent.planToken !== intent.rebaseFromToken && frame.planToken !== intent.planToken ||
      !['collecting', 'review', 'ready'].includes(frame.status) || frame.publication === 'unknown')
      throw new Error('LIBRARY_LOG_REBASE_STATE_UNCONFIRMED');
    this.rebaseInputs(intent, frame, frame.status !== 'collecting');
    const adopted: ReaderLibraryLogSyncIntent = { ...intent, phase: 'rebasing', planToken: frame.planToken!,
      localBasis: frame.localBasis!, objectIds: [...intent.rebaseObjectIds], objectId: undefined,
      publishSha256: undefined, publishBytes: undefined, retireObjects: [], cleanupRemaining: [], cleanupAuthorized: false };
    this.diagnosticPhase = 'rebase.saveCollecting';
    await this.journal.save(adopted);
    if (!this.admitted(current)) return;
    let finished = frame;
    if (frame.status === 'collecting') {
      if (password.length === 0) {
        this.plan = undefined;
        this.publish({ ...this.state, status: 'pending', operationId: intent.operationId, canRebase: false,
          canContinueCommit: false, canCleanup: false, reviewRevision: ++this.revision,
          message: '已找到本次重合并的新代次。请输入同步加密密码后核对原操作，将继续读取已确认的版本，不会重复发起重合并或上传。' });
        return;
      }
      this.diagnosticPhase = 'rebase.collect';
      finished = await this.collect(binding, adopted, password);
    }
    if (!this.admitted(current)) return;
    if (!['review', 'ready'].includes(finished.status) || finished.publication === 'unknown' ||
      finished.planToken !== adopted.planToken || finished.localBasis !== adopted.localBasis)
      throw new Error('LIBRARY_LOG_REBASE_STATE_UNCONFIRMED');
    this.rebaseInputs(adopted, finished, true);
    this.diagnosticPhase = 'rebase.saveReview';
    await this.journal.save({ ...adopted, phase: 'review', rebaseFromToken: undefined, rebaseObjectIds: undefined });
    this.password = password; this.show(finished, '已恢复本次确认的重合并，请核对后确认新发布。');
  }
  async rebase(operationId: string, password: string, current: () => boolean): Promise<void> {
    if (this.active || !this.admitted(current) || !this.state.canRebase || this.state.operationId !== operationId || password.length === 0) return;
    this.active = true; let binding: ReaderWebDavStorageBinding | undefined;
    this.publish({ ...this.state, status: 'loading' });
    try {
      this.diagnosticPhase = 'rebase.loadJournal';
      const original = await this.journal.load();
      if (original?.operationId !== operationId || original.channelId === undefined || original.channelHash === undefined || original.planToken === undefined)
        throw new Error('LIBRARY_LOG_ORIGINAL_OPERATION_CHANGED');
      this.diagnosticPhase = 'rebase.openStorage';
      binding = await this.storage.open(); this.requireBinding(original, binding);
      this.diagnosticPhase = 'rebase.discover';
      const listing = await this.discover(binding), ids = listing.objects.filter((object): boolean => object.channelHash === original.channelHash)
        .map((object): string => object.objectId);
      if (original.phase === 'rebasing' && original.planToken !== original.rebaseFromToken)
        throw new Error('LIBRARY_LOG_REBASE_STATE_UNCONFIRMED');
      const rebasing: ReaderLibraryLogSyncIntent = { ...original, phase: 'rebasing',
        rebaseFromToken: original.planToken, rebaseObjectIds: ids };
      this.diagnosticPhase = 'rebase.saveIntent';
      await this.journal.save(rebasing);
      if (!this.admitted(current)) return;
      this.diagnosticPhase = 'rebase.coreRebase';
      const frame = await this.request('rebase', { operationId, planToken: original.planToken, password, channelId: original.channelId,
        objectIds: ids, discoveryComplete: true, acknowledgeUnconfirmed: true }, operationId);
      if (frame.status !== 'collecting') throw new Error('LIBRARY_LOG_REVIEW_REQUIRED');
      await this.completeRebase(binding, rebasing, frame, password, current);
    } catch (error) { await this.failed(error, operationId); }
    finally { password = ''; this.redact(binding); this.active = false; this.publish({ ...this.state }); }
  }
  private async retireUnsent(intent: ReaderLibraryLogSyncIntent): Promise<void> {
    this.diagnosticPhase = 'retire.core';
    const frame = await this.request('retire', { operationId: intent.operationId, planToken: intent.planToken ?? null }, intent.operationId);
    if (frame.status !== 'retired' && frame.status !== 'missing') throw new Error('LIBRARY_LOG_RESULT_PENDING');
    this.diagnosticPhase = 'retire.clearJournal';
    await this.journal.clear(intent.operationId);
  }
  canRecoverHandoff(): boolean { return !this.active && this.owner.canRecoverLibraryRestoreFailure(); }
  async recoverHandoff(current: () => boolean): Promise<void> {
    let visible = false; try { visible = current(); } catch (_) {}
    if (!visible || !this.canRecoverHandoff()) return;
    this.active = true;
    try { await this.owner.recoverAfterLibraryRestoreFailure(); }
    finally { this.active = false; }
  }
  retire(): void {
    // Closing the recovery surface retires only presentation. The durable
    // original operation is never cancelled or cleared by dialog teardown.
    this.generation += 1; this.password = '';
  }
  private async failed(error: Object, operationId?: string): Promise<void> {
    this.traceFailure(error);
    let intent: ReaderLibraryLogSyncIntent | undefined;
    try { intent = await this.journal.load(); } catch (_) {
      this.publish({ ...empty(), supported: true, status: 'pending', operationId, message: '原同步记录尚未读清，请保留原连接后核对。' }); return;
    }
    const code = error instanceof Error ? error.message : '';
    const message = code.includes('BUDGET') || code.includes('budget') ? '共享版本超过本次安全读取容量，未截断或跳过版本，也未应用书库。请先整理存储后重试。' :
      code === 'LIBRARY_LOG_LIST_CHANGED' ? '读取期间共享版本发生了变化，本次尚未完成核对；请保留原操作后重新读取。' :
      code === 'LIBRARY_LOG_COVERING_VERSION_UNCONFIRMED' ? '书库已应用，旧记录整理尚未确认。请输入同步加密密码后核对后续共享版本；已有文件保留。' :
      code === 'LIBRARY_LOG_REBASE_STATE_UNCONFIRMED' || code === 'LIBRARY_LOG_REBASE_INPUT_CHANGED' ?
        '本次重合并的代次或输入与已确认记录不一致，原操作已保留；未应用书库或删除共享版本。' :
      code.includes('CLEANUP') ? '书库已应用，原旧记录整理尚未确认；请核对原操作，不会删除未合并版本或备份文件。' :
      code.includes('OBJECT') || code.includes('authentication') || code.includes('decrypt') ? '无法核对共享版本，请确认加密密码或文件完整性；未跳过异常文件。' :
      code.includes('PROBE_PENDING') ? '原存储检查尚未结束，请先在存储读写检查中核对或结束原操作。' :
      code.includes('CONNECTION') ? '原同步所用存储连接尚未确认，请保留原连接后核对。' :
      code.includes('UNSUPPORTED') ? '当前运行环境尚不支持此同步方式，请使用已有备份恢复。' :
      '原同步尚未核对完成，请保留原连接并核对原操作；不会盲目重新上传。';
    this.publish({ ...this.state, supported: !code.includes('UNSUPPORTED'), status: intent === undefined ? 'failed' : 'pending',
      operationId: intent?.operationId ?? operationId, canCleanup: intent !== undefined && ['committing', 'cleanup'].includes(intent.phase),
      canContinueCommit: false, canRebase: intent?.phase === 'needsRebase', message });
  }
}
