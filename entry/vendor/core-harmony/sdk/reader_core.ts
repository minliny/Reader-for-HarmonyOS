export type JsonObject = { [key: string]: unknown };
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export const SOURCE_CHECK_KEYWORD_OVERRIDE_V1 = "source.check.keyword_override.v1";
export const SOURCE_CHECK_EPHEMERAL_V1 = "source.check.ephemeral.v1";
export const SOURCE_CHECK_REPORT_CLEAR_V1 = "source.check.report.clear.v1";

export type SourceCheckMode = "legacy" | "search" | "explore";
export type SourceCheckLevel = "L1" | "L2" | "L3" | "L4" | "L5";

type SourceCheckOptions = {
  /** Core uses "我的" when no keyword is provided. */
  keyword?: string;
  /** A nonblank keyword takes precedence over the source's checkKeyWord in search or legacy mode. */
  keywordOverride?: boolean;
  /** Whole-command Core budget. The SDK wait budget can be set separately. */
  timeoutMs?: number;
  /** Reporting subset. Omission or an empty array selects L1–L5. */
  levels?: SourceCheckLevel[];
};

export type SourceCheckRunParams = SourceCheckOptions & {
  sourceIds: string[];
  /** Defaults to legacy. */
  mode?: SourceCheckMode;
  reportVersion?: 1 | 2;
};

export type SourceCheckEphemeralRunParams = SourceCheckOptions & {
  /** One to 100 raw Legado BookSource candidates. Each entry is validated independently by Core. */
  sources: JsonValue[];
  /** Defaults to search. */
  mode?: SourceCheckMode;
  reportVersion?: 2;
};

export type SourceCheckExecutionOptions = { timeoutMs: number };

export type SourceCheckStep = {
  level: SourceCheckLevel;
  requested: boolean;
  executed: boolean;
  status: "pass" | "fail" | "not_requested" | "not_supported" | "blocked" | "cancelled";
  durationMs: number;
  reason?: string;
};

export type SourceCheckReport = {
  mode: SourceCheckMode;
  traceId: string;
  ruleDigest?: string;
  inputDigest: string;
  steps: SourceCheckStep[];
  contentKind?: "text" | "url_only" | "image" | "audio" | "empty" | "unsupported";
} & (
  | { version: 1; executionOptions?: never; executionOptionsDigest?: never }
  | { version: 2; executionOptions: SourceCheckExecutionOptions; executionOptionsDigest: string }
);

export type SourceCheckDebugLog = {
  state: number;
  msg: string;
  timestampMs: number;
  step?: string;
  rule?: string;
  extractedCount?: number;
  errorKind?: string;
};

export type SourceCheckResult = {
  sourceId: string;
  available: boolean;
  levelsPassed: SourceCheckLevel[];
  failureReason?: string;
  durationMs: number;
  debugLogs?: SourceCheckDebugLog[];
  report?: SourceCheckReport;
};

export type SourceCheckResultData = { results: SourceCheckResult[]; traceId?: string };

export type SourceCheckReportClearParams = {
  /** Surrounding whitespace is trimmed unless it is part of an exact stored legacy ID. */
  sourceIds: string[];
};

export type SourceCheckReportClearData = {
  /** Number of report records removed across both history versions. */
  clearedCount: number;
  /** Unique resolved IDs in request order, including IDs with no reports. */
  sourceIds: string[];
};

/** Reader-owned source organization, separate from executable BookSource rules. */
export type SourceGroupRecord = { groupId: string; name: string };
export type SourceGroupMembership = { sourceId: string; groupId: string; locallyAssigned: boolean };
export type SourceGroupCatalogData = { version: 1; revision: number; groups: SourceGroupRecord[]; memberships: SourceGroupMembership[] };
export type SourceGroupMutateParams = {
  expectedRevision: number; action: "create" | "rename" | "delete" | "assign";
  groupId?: string; name?: string; targetGroupId?: string; sourceIds?: string[];
};
export type SourceGroupMutateData = { version: 1; revision: number; action: SourceGroupMutateParams["action"]; groupId: string; affectedSourceIds: string[] };
export type SourceGroupedImportParams = {
  expectedRevision: number; strategy: "preserve" | "fill" | "all";
  targetGroupId?: string; targetGroupName?: string;
  items: { sourceId: string; name?: string; baseUrl?: string; rules?: JsonObject | null; bookSource?: JsonObject | null; useSourceReplacement?: boolean }[];
};
export type SourceGroupedImportResult = { index: number; sourceId: string; status: "imported" | "failed"; name?: string; groupId?: string; locallyAssigned?: boolean; error?: string };
export type SourceGroupedImportData = { version: 1; revision: number; importedCount: number; failedCount: number; results: SourceGroupedImportResult[] };

export type ReaderCoreStorageMigration = { sourceSchemaVersion: number; targetSchemaVersion: number };
export type ReaderCoreRuntimeConfig = JsonObject & {
  dataDirectory?: string; cacheDirectory?: string; storageMigration?: ReaderCoreStorageMigration;
};

/** Core-owned local recovery only. No path, nonce or remote URL is accepted. */
export type RuntimeStorageBackupCreateParams = Record<string, never>;
export type RuntimeStorageBackupCreateData = {
  backupId: string;
  sha256: string;
  bytes: number;
  format: "library47";
  schemaUserVersion: 47;
};
export type RuntimeStorageBackupRestoreParams = {
  backupId: string;
  expectedSha256: string;
};
export type RuntimeStorageBackupRestoreData = {
  restored: boolean;
  backupId: string;
  sha256: string;
  format: "library47";
  schemaUserVersion: 47;
  revokedResourceGrants: number;
  resourceEvidenceRequiringValidation: number;
};

/** Compiled operation support; concrete data still needs Core preflight. */
export type CoreStorageCapabilities = {
  logicalExport: boolean;
  logicalRestore: boolean;
  legacyHostImport: boolean;
  physicalBackup: boolean;
  physicalRestore: boolean;
  webdavConfigRestore: boolean;
  activeLibrarySync: false;
  logicalExportRequiresDataPreflight: true;
  /** Always true for Library47; both values are accepted for Legacy declarations. */
  logicalRestoreRequiresCompleteCoverage: boolean;
  resourceEvidenceOnly: true;
  externalFilesIncluded: false;
};
/** Missing matrix is an old declaration, not permission for new operations. */
export type CoreStorageFormatInfo = {
  format: "legacy" | "library47";
  /** Equals logicalExport && logicalRestore && legacyHostImport when matrix is present. */
  portableSnapshotSupported: boolean;
  capabilities?: CoreStorageCapabilities;
};

export type NativeRuntimeHandle = unknown;

/** Bounded Core-owned bytes used by Host responses that exceed JSON comfort. */
export type ReaderCoreAssetBridge = {
  begin(requestId: number, operationId: number, declaredBytes: number): number;
  write(requestId: number, operationId: number, assetId: number, chunk: Uint8Array): number;
  commit(requestId: number, operationId: number, assetId: number): number;
  read?(requestId: number, operationId: number, assetId: number, offset: number, limit: number): Promise<Uint8Array>;
  release(requestId: number, operationId: number, assetId: number): void;
};

export type NativeReaderCoreModule = {
  abiVersion(): number;
  lastError(): { code: number; message: string };
  readEpubEntry(archivePath: string, entryPath: string, maxBytes: number): Uint8Array;
  readEpubEntryAsync(archivePath: string, entryPath: string, maxBytes: number): Promise<Uint8Array>;
  encodeText(text: string, charset: string, maxBytes: number): Uint8Array;
  probeStorageAsync?(dataDirectory: string): Promise<string>;
  exportLibraryReadOnlyAsync?(dataDirectory: string, password: string): Promise<string>;
  readLibraryBackupIdentityAsync?(dataDirectory: string): Promise<string>;
  createRuntime(config?: JsonObject | string): NativeRuntimeHandle;
  createRuntimeAsync?(config?: JsonObject | string): Promise<NativeRuntimeHandle>;
  releaseRuntime(runtime: NativeRuntimeHandle): void;
  sendCommand(runtime: NativeRuntimeHandle, command: JsonObject | string): void;
  readPreparedEntry?(runtime: NativeRuntimeHandle, paramsJson: string): string;
  cancelRequest(runtime: NativeRuntimeHandle, requestId: number): void;
  readEvent(runtime: NativeRuntimeHandle, timeoutMs?: number): string | null;
  pendingEventCount(runtime: NativeRuntimeHandle): number;
  /** Both functions must be present before selecting receipt-based delivery. */
  enableEventAcknowledgements?(runtime: NativeRuntimeHandle): void;
  acknowledgeEvent?(runtime: NativeRuntimeHandle, deliveryId: number): void;
  beginAsset?(runtime: NativeRuntimeHandle, requestId: number, operationId: number, declaredBytes: number): number;
  writeAsset?(runtime: NativeRuntimeHandle, requestId: number, operationId: number, assetId: number, chunk: Uint8Array): number;
  readAssetAsync?(runtime: NativeRuntimeHandle, requestId: number, operationId: number, assetId: number, offset: number, limit: number): Promise<Uint8Array>;
  commitAsset?(runtime: NativeRuntimeHandle, requestId: number, operationId: number, assetId: number): number;
  releaseAsset?(runtime: NativeRuntimeHandle, requestId: number, operationId: number, assetId: number): void;
  completeHostRequest(
    runtime: NativeRuntimeHandle,
    operationId: number,
    result: JsonObject | string,
    requestId?: number
  ): void;
  failHostRequest(
    runtime: NativeRuntimeHandle,
    operationId: number,
    error: ReaderCoreError | JsonObject | string,
    requestId?: number
  ): void;
  pingSmoke(): string;
  hostSmoke(): string;
  lifecycleSmoke(iterations?: number): string;
};

/** Independent maintenance v1; never an extension of the closed core.info DTO. */
export type ReaderCoreStorageProbe = {
  schemaVersion: number;
  buildIdentity: JsonObject;
  contractSha256: string;
  coreInputFingerprint: string | null;
  observation: {
    freshStorage: boolean;
    layout: JsonObject | null;
    requiresMigration: boolean;
    explicitMigration: JsonObject | null;
    observedDataFormatGeneration: number | null;
  };
};

export type ReaderCoreReadOnlyLibraryExport = {
  content: string;
  packageSha256: string;
  localOriginals: JsonValue[];
};

export type ReaderCoreLibraryBackupIdentity = {
  libraryId: string;
  writerInstanceId: string;
};

export async function readReaderCoreLibraryBackupIdentityWithModule(native: NativeReaderCoreModule,
  dataDirectory: string, isCurrent: () => boolean = () => true): Promise<ReaderCoreLibraryBackupIdentity | undefined> {
  if (!isCurrent()) throw new Error('Reader Core library identity read cancelled');
  if (native.readLibraryBackupIdentityAsync === undefined) throw new Error('Reader Core library identity read is unavailable');
  const raw = await native.readLibraryBackupIdentityAsync(dataDirectory);
  if (!isCurrent()) throw new Error('Reader Core library identity read cancelled');
  if (raw.length === 0 || raw.length > 4096) throw new Error('Reader Core library identity response exceeds budget');
  const value: unknown = JSON.parse(raw);
  if (!isJsonObject(value) || value['schemaVersion'] !== 1) throw new Error('Reader Core library identity is invalid');
  const libraryId = value['libraryId'], writerInstanceId = value['writerInstanceId'];
  if (libraryId === null && writerInstanceId === null) return undefined;
  if (typeof libraryId !== 'string' || !/^[0-9a-f]{32}$/.test(libraryId) ||
    typeof writerInstanceId !== 'string' || !/^[0-9a-f]{64}$/.test(writerInstanceId)) {
    throw new Error('Reader Core library identity is invalid');
  }
  return { libraryId, writerInstanceId };
}

/** A bounded maintenance call. No Runtime handle or callback bridge is used. */
export async function exportReaderCoreLibraryReadOnlyWithModule(native: NativeReaderCoreModule,
  dataDirectory: string, password: string, isCurrent: () => boolean = () => true): Promise<ReaderCoreReadOnlyLibraryExport> {
  if (!isCurrent()) throw new Error('Reader Core library export cancelled');
  if (native.exportLibraryReadOnlyAsync === undefined) throw new Error('Reader Core read-only library export is unavailable');
  const raw = await native.exportLibraryReadOnlyAsync(dataDirectory, password);
  if (!isCurrent()) throw new Error('Reader Core library export cancelled');
  if (raw.length === 0 || raw.length > 28 * 1024 * 1024) throw new Error('Reader Core library export response exceeds budget');
  const value: unknown = JSON.parse(raw);
  if (!isJsonObject(value) || value['schemaVersion'] !== 1 || value['scope'] !== 'coreLibraryMetadata') {
    throw new Error('Reader Core library export response is invalid');
  }
  const content = value['content'], hash = value['packageSha256'], originals = value['localOriginals'];
  if (typeof content !== 'string' || content.length === 0 || content.length > 24 * 1024 * 1024 ||
    typeof hash !== 'string' || !/^[0-9a-f]{64}$/.test(hash) || !Array.isArray(originals) || originals.length > 10000) {
    throw new Error('Reader Core library export metadata is invalid');
  }
  return { content, packageSha256: hash, localOriginals: originals };
}

export async function probeReaderCoreStorageWithModule(native: NativeReaderCoreModule,
  dataDirectory: string, isCurrent: () => boolean = () => true): Promise<ReaderCoreStorageProbe> {
  if (!isCurrent()) throw new Error('Reader Core storage admission cancelled');
  if (native.probeStorageAsync === undefined) throw new Error('Reader Core storage admission API is unavailable');
  const raw = await native.probeStorageAsync(dataDirectory);
  if (!isCurrent()) throw new Error('Reader Core storage admission cancelled');
  if (raw.length === 0 || raw.length > 64 * 1024) throw new Error('Reader Core storage admission response exceeds budget');
  const value: unknown = JSON.parse(raw);
  if (!isJsonObject(value) || value['schemaVersion'] !== 1 || !isJsonObject(value['buildIdentity']) ||
    typeof value['contractSha256'] !== 'string' || !/^[0-9a-f]{64}$/.test(value['contractSha256']) ||
    !(value['coreInputFingerprint'] === null || (typeof value['coreInputFingerprint'] === 'string' && /^[0-9a-f]{64}$/.test(value['coreInputFingerprint']))) ||
    !isJsonObject(value['observation'])) throw new Error('Reader Core storage admission response is invalid');
  const observed = value['observation'];
  if (typeof observed['freshStorage'] !== 'boolean' || typeof observed['requiresMigration'] !== 'boolean' ||
    !(observed['layout'] === null || isJsonObject(observed['layout'])) ||
    !(observed['explicitMigration'] === null || isJsonObject(observed['explicitMigration'])) ||
    !(observed['observedDataFormatGeneration'] === null || isNonNegativeSafeInteger(observed['observedDataFormatGeneration'])) ||
    (observed['requiresMigration'] && observed['explicitMigration'] === null) ||
    (!observed['freshStorage'] && !observed['requiresMigration'] && observed['layout'] === null)) {
    throw new Error('Reader Core storage admission observation is invalid');
  }
  // Core owns the supported layout and explicit migration table. The Host does
  // not reproduce schema bounds or infer compatibility from the cursor.
  return value as unknown as ReaderCoreStorageProbe;
}

export type ReaderCoreLastError = { code: number; message: string };

/** Content-free native terminal observation, never a result or wire copy. */
export type ReaderCoreTerminalMetadata = {
  requestId: number;
  method: string;
  type: "result" | "error";
  wireUtf16Units: number;
};

// Only literal protocol names may enter public diagnostic metadata. Unknown
// extension methods must not expose caller-controlled strings.
const TERMINAL_DIAGNOSTIC_METHODS = new Set<string>([
  "core.info", "runtime.ping", "runtime.hostSmoke", "runtime.status",
  "runtime.storage.restore", "runtime.storage.flush", "runtime.storage.export", "runtime.storage.apply",
  "runtime.storage.backup.create", "runtime.storage.backup.restore",
  "source.group.catalog", "source.list", "source.import", "source.supply", "source.update", "source.delete",
  "source.check.run", "source.check.ephemeral.run", "source.check.report.clear",
  "book.search", "book.detail", "book.toc", "chapter.content",
  "bookshelf.list", "bookshelf.get", "bookshelf.add", "bookshelf.book.update",
  "local_book.toc", "local_book.content.metrics", "local_book.chapter.content",
  "local_book.navigation.backfill.v1", "reading.preparation", "reading.entry.prepare",
  "reading.entry.snapshot", "reading.document.window", "reading.catalog.page",
  "reading.directory.view.open.v1", "reading.directory.view.page.v1", "reading.directory.view.target.resolve.v1",
  "reading.directory.view.open.v2", "reading.directory.view.page.v2", "reading.directory.target.resolve.v2",
  "reading.directory.rules.get.v2", "reading.directory.rules.prepare.v2",
  "reading.directory.rules.preview.v2", "reading.directory.rules.apply.v2",
  "reading.progress.get", "reading.progress.update", "reader.location.resolve",
  "cache.book.status", "cache.book.prefetch", "read-record.accumulate", "read-record.accumulate-receipt",
  "tts.slice", "tts.chapter.plan", "tts.queue.status", "tts.queue.play", "tts.queue.pause",
  "tts.queue.resume", "tts.queue.stop", "tts.queue.next", "tts.queue.prev", "tts.queue.seek",
  "tts.queue.skip", "tts.queue.set-rate", "tts.queue.report-status", "tts.queue.report-callback",
  "tts.config.get", "tts.config.put",
]);

// Fixed, non-content-bearing admission diagnostics from capacity.rs/runtime.rs.
// Do not forward arbitrary native error text: it can contain command data.
const SAFE_ADMISSION_REASONS = new Set<string>([
  // Fixed direct-Runtime/legacy bridge reason; current NAPI rejects the wire
  // length before FFI send, with a different error which must remain unchanged.
  "command exceeds the wire byte limit",
  "runtime input byte budget is occupied",
  "runtime result reservation contract failed; drain and recreate",
  "runtime input class byte budget is occupied",
  "runtime request or terminal budget is occupied",
  "runtime lane is occupied",
]);

export type ReaderCoreCommand = {
  protocolVersion: 1;
  requestId: number;
  method: string;
  params?: JsonObject;
};

export type ReaderCoreResultEvent<TData extends JsonObject = JsonObject> = {
  deliveryId?: number;
  protocolVersion: 1;
  requestId: number;
  type: "result";
  data: TData;
};

export type ReaderCoreError = {
  code: string;
  message: string;
  retryable: boolean;
  details?: JsonObject;
};

export type ReaderCoreErrorEvent = {
  deliveryId?: number;
  protocolVersion: 1;
  requestId: number;
  type: "error";
  error: ReaderCoreError;
};

export type ReaderCoreTransactionKind =
  | "storageApply"
  | "persistenceMutation"
  | "hostOperationDrain";

export type ReaderCoreTransactionPendingDetails = {
  transactionKind: ReaderCoreTransactionKind;
  pendingHostOperationCount: number;
  retryAfterMillis: number;
};

export type ReaderCoreHostRequestEvent = {
  deliveryId?: number;
  protocolVersion: 1;
  requestId: number;
  type: "host.request";
  operationId: number;
  capability: string;
  params: JsonObject;
};

export type ReaderCoreEvent =
  | ReaderCoreResultEvent
  | ReaderCoreErrorEvent
  | ReaderCoreHostRequestEvent;

export type HostRequestHandler = (
  event: ReaderCoreHostRequestEvent
) => JsonObject | Promise<JsonObject>;

export type RequestOptions = {
  timeoutMs?: number;
  pollMs?: number;
  hostRequest?: HostRequestHandler;
  /**
   * Polled while waiting for Core or an active Host capability. Returning
   * true cancels both layers before this Promise rejects, so obsolete route,
   * source, or chapter work cannot continue behind the replacement request.
   */
  shouldCancel?: () => boolean;
};

export type CapabilityHandler = (
  event: ReaderCoreHostRequestEvent
) => JsonObject | Promise<JsonObject>;

export type CapabilityCancellationHandler = (
  event: ReaderCoreHostRequestEvent
) => void;

/**
 * Host-owned HTTP fetch mechanism. The adapter calls this to actually perform
 * the network operation for an `http.execute` host request.
 *
 * Response contract:
 *   - `status` (number, required): HTTP status code.
 *   - `body` (string, required): response body as UTF-8 text.
 *   - `headers` (Record<string, string>, optional): response headers.
 *   - `finalUrl` (string, optional): resolved URL after redirects. Core's
 *     `HostHttpResponse.final_url` reads this key (camelCase) to back the
 *     Legado idiom `resp.raw().request().url()`. Omit when no redirect was
 *     observed and Core will fall back to the request URL.
 */
export interface HttpFetchRequest {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
    /** Shared transport ceiling, including redirects and retries. */
    timeoutMs?: number;
}

export interface HttpFetch {
  fetch(request: HttpFetchRequest): Promise<JsonObject>;
}

export class CapabilityRouter {
  static readonly httpExecuteCapability = "http.execute";

  private readonly handlers = new Map<string, CapabilityHandler>();
  private readonly cancellationHandlers = new Map<string, CapabilityCancellationHandler>();
  private readonly httpFetch: HttpFetch | null;

  constructor(options: { httpFetch?: HttpFetch } = {}) {
    this.httpFetch = options.httpFetch ?? null;
    if (this.httpFetch !== null) {
      this.register(
        CapabilityRouter.httpExecuteCapability,
        this.handleHttpExecute.bind(this)
      );
    }
  }

  register(
    capability: string,
    handler: CapabilityHandler,
    cancellationHandler?: CapabilityCancellationHandler
  ): void {
    if (typeof capability !== "string" || capability.length === 0) {
      throw new Error("capability must be a non-empty string");
    }
    if (typeof handler !== "function") {
      throw new Error("handler must be a function");
    }
    if (cancellationHandler !== undefined && typeof cancellationHandler !== "function") {
      throw new Error("cancellationHandler must be a function");
    }
    this.handlers.set(capability, handler);
    if (cancellationHandler === undefined) {
      this.cancellationHandlers.delete(capability);
    } else {
      this.cancellationHandlers.set(capability, cancellationHandler);
    }
  }

  has(capability: string): boolean {
    return this.handlers.has(capability);
  }

  async route(event: ReaderCoreHostRequestEvent): Promise<JsonObject> {
    const handler = this.handlers.get(event.capability);
    if (handler === undefined) {
      throw new Error(`no handler registered for capability: ${event.capability}`);
    }
    return handler(event);
  }

  cancel(event: ReaderCoreHostRequestEvent): void {
    this.cancellationHandlers.get(event.capability)?.(event);
  }

  private async handleHttpExecute(
    event: ReaderCoreHostRequestEvent
  ): Promise<JsonObject> {
    if (this.httpFetch === null) {
      throw new Error("http.execute requested but no httpFetch configured");
    }
    const params = event.params;
    const url = typeof params.url === "string" ? params.url : "";
    if (url.length === 0) {
      throw new Error("http.execute requires non-empty url");
    }
    const method = typeof params.method === "string" ? params.method : "GET";
    const headers: Record<string, string> = {};
    if (isJsonObject(params.headers)) {
      for (const [key, value] of Object.entries(params.headers)) {
        headers[key] = typeof value === "string" ? value : String(value);
      }
    }
    const body = typeof params.body === "string" ? params.body : undefined;
    const request: HttpFetchRequest = { url, method, headers, body };
    if (params.timeoutMs !== undefined) {
      if (typeof params.timeoutMs !== "number" || !Number.isSafeInteger(params.timeoutMs) || params.timeoutMs <= 0) {
        throw new Error("http.execute timeoutMs must be a positive integer");
      }
      request.timeoutMs = params.timeoutMs;
    }
    return this.httpFetch.fetch(request);
  }
}

const NATIVE_EVENT_READ_LIMIT = 64;
const RESULT_EVENT_YIELD_LIMIT = 16;

type QueuedReaderCoreEvent = {
  event: ReaderCoreEvent;
};

type ResultWaiter = {
  requestId: number;
  interruption?: Error;
  wake?: () => void;
};

type NativePollWait = {
  wakeAt: number;
  finish: () => void;
};

export class ReaderCoreRuntime {
  static readonly protocolVersion = 1;

  private readonly native: NativeReaderCoreModule;
  private readonly runtime: NativeRuntimeHandle;
  readonly deliveryMode: "explicitAck" | "legacyCallback";
  private readonly consumedDeliveries = new WeakSet<object>();
  private readonly acceptedRequestIds = new Set<number>();
  private readonly diagnosticRequestMethods = new Map<number, string>();
  private readonly terminalMetadata: ReaderCoreTerminalMetadata[] = [];
  // Both indexes own only unread events. Ordered sets let either reader remove
  // a payload from both indexes immediately, without scans or retained tombstones.
  private readonly pendingEvents = new Set<QueuedReaderCoreEvent>();
  private readonly pendingEventsByRequest = new Map<number, Set<QueuedReaderCoreEvent>>();
  private pendingEventCountValue = 0;
  /** Only parked result consumers drive the shared nonblocking native reader. */
  private readonly nativePollWaits = new Map<ResultWaiter, NativePollWait>();
  private nativePollQueued = false;
  private nativePollBacklog = false;
  private nativePollTimer: ReturnType<typeof setTimeout> | undefined;
  private nativePollTimerAt = 0;
  /** Cancelled admissions whose terminal delivery still belongs to this runtime. */
  private readonly abandonedRequestIds = new Set<number>();
  private nextRequestId = 1;
  private closed = false;
  private capabilityRouter: CapabilityRouter | null = null;
  private readonly activeHostRequests = new Map<number, ReaderCoreHostRequestEvent>();
  private readonly resultWaiters = new Map<number, Set<ResultWaiter>>();

  constructor(nativeModule: NativeReaderCoreModule, config: ReaderCoreRuntimeConfig = {}, initializedHandle?: NativeRuntimeHandle) {
    this.native = nativeModule;
    this.runtime = initializedHandle === undefined ? nativeModule.createRuntime(config) : initializedHandle;
    this.deliveryMode = nativeModule.enableEventAcknowledgements !== undefined && nativeModule.acknowledgeEvent !== undefined
      ? "explicitAck" : "legacyCallback";
    if (this.deliveryMode === "explicitAck") {
      try { nativeModule.enableEventAcknowledgements!(this.runtime); }
      catch (error) { nativeModule.releaseRuntime(this.runtime); throw error; }
    }
  }

  static async createAsync(nativeModule: NativeReaderCoreModule, config: ReaderCoreRuntimeConfig = {},
    isCurrent: () => boolean = () => true): Promise<ReaderCoreRuntime> {
    if (!isCurrent()) throw new Error('Reader Core startup cancelled');
    const handle = nativeModule.createRuntimeAsync === undefined ? nativeModule.createRuntime(config) :
      await nativeModule.createRuntimeAsync(config);
    // A close/successor may have won while native initialization was running.
    if (!isCurrent()) {
      nativeModule.releaseRuntime(handle);
      throw new Error('Reader Core startup cancelled');
    }
    return new ReaderCoreRuntime(nativeModule, {}, handle);
  }

  setCapabilityRouter(router: CapabilityRouter | null): void {
    this.capabilityRouter = router;
  }

  get abiVersion(): number {
    return this.native.abiVersion();
  }

  lastError(): ReaderCoreLastError {
    return this.native.lastError();
  }

  /**
   * Return the capability-backed asset writer for a Host capability handler.
   * The returned methods keep the runtime handle private and fail closed when
   * an older native module has no asset ABI.
   */
  assetBridge(): ReaderCoreAssetBridge {
    const native = this.native;
    const runtime = this.runtime;
    if (native.beginAsset === undefined || native.writeAsset === undefined ||
      native.commitAsset === undefined || native.releaseAsset === undefined) {
      throw new Error('Reader-Core native module does not support response assets');
    }
    return {
      begin: (requestId, operationId, declaredBytes): number =>
        native.beginAsset!(runtime, requestId, operationId, declaredBytes),
      write: (requestId, operationId, assetId, chunk): number =>
        native.writeAsset!(runtime, requestId, operationId, assetId, chunk),
      commit: (requestId, operationId, assetId): number =>
        native.commitAsset!(runtime, requestId, operationId, assetId),
      read: native.readAssetAsync === undefined ? undefined : (requestId, operationId, assetId, offset, limit): Promise<Uint8Array> => {
        if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit <= 0 || limit > 1048576) return Promise.reject(new Error('Invalid asset read range'));
        return native.readAssetAsync!(runtime, requestId, operationId, assetId, offset, limit);
      },
      release: (requestId, operationId, assetId): void =>
        native.releaseAsset!(runtime, requestId, operationId, assetId),
    };
  }

  get pendingEventCount(): number {
    return this.pendingEventCountValue + this.native.pendingEventCount(this.runtime);
  }

  /** Fresh bounded values only; callers cannot mutate or retain Core payloads. */
  get recentTerminalMetadata(): ReaderCoreTerminalMetadata[] {
    return this.terminalMetadata.map((item) => ({ ...item }));
  }

  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.clearNativePollTimer();
    const active = Array.from(this.activeHostRequests.values());
    for (const waiters of this.resultWaiters.values()) {
      for (const waiter of waiters) {
        this.interruptWaiter(waiter, new Error("Reader-Core runtime is closed"));
      }
    }
    this.resultWaiters.clear();
    this.nativePollWaits.clear();
    for (const event of active) {
      try {
        this.capabilityRouter?.cancel(event);
      } catch (_) {
        // A failed platform abort must not retain the other waiters/runtime.
      }
    }
    this.pendingEvents.clear();
    this.pendingEventsByRequest.clear();
    this.pendingEventCountValue = 0;
    this.activeHostRequests.clear();
    this.abandonedRequestIds.clear();
    this.acceptedRequestIds.clear();
    this.diagnosticRequestMethods.clear();
    this.terminalMetadata.length = 0;
    this.native.releaseRuntime(this.runtime);
  }

  /** Prepared-only synchronous lane; never dispatches or polls ordinary requests. */
  readPreparedEntry(params: JsonObject): JsonObject {
    this.ensureOpen();
    const read = this.native.readPreparedEntry;
    if (read === undefined) return { kind: "unavailable", sourceId: params["sourceId"],
      bookId: params["bookId"], reason: "storageUnsupported" };
    const encoded = JSON.stringify(params);
    // Native validates UTF-8 bytes before copying. This cheap check also rejects
    // large ASCII payloads before crossing the bridge.
    if (encoded.length > 8192) throw new Error("prepared entry params exceed limit");
    let raw: string;
    try { raw = this.native.readPreparedEntry!(this.runtime, encoded); }
    catch (error) {
      if (error !== null && typeof error === "object" && (error as JsonObject)["code"] === "READING_ENTRY_BUSY")
        return { kind: "unavailable", sourceId: params["sourceId"], bookId: params["bookId"], reason: "storageBusy" };
      throw error;
    }
    if (typeof raw !== "string" || raw.length > 1024 * 1024) throw new Error("invalid prepared entry result");
    const result: unknown = JSON.parse(raw);
    if (result === null || typeof result !== "object" || Array.isArray(result)) throw new Error("invalid prepared entry result");
    const data = result as JsonObject;
    if (data["sourceId"] !== params["sourceId"] || data["bookId"] !== params["bookId"] ||
        (data["kind"] !== "ready" && data["kind"] !== "unavailable")) throw new Error("invalid prepared entry identity or outcome");
    if (data["kind"] === "unavailable" && !["storageUnsupported", "storageBusy", "runtimeClosed", "catalogMissing",
      "documentMissing", "sourceSwitchPending", "positionUnresolved", "resourceLimit", "corruptDocument"].includes(data["reason"] as string))
      throw new Error("unknown prepared entry outcome");
    return data;
  }

  send(method: string, params: JsonObject = {}, requestId = this.allocateRequestId()): number {
    this.ensureOpen();
    assertCommandMethod(method);
    assertJsonObjectValue(params, "params");
    assertNonNegativeSafeInteger(requestId, "requestId");
    const command: ReaderCoreCommand = {
      protocolVersion: ReaderCoreRuntime.protocolVersion,
      requestId,
      method,
      params,
    };
    this.drainAbandonedEvents();
    if (this.abandonedRequestIds.has(requestId) || this.resultWaiters.has(requestId) ||
        (this.deliveryMode === "legacyCallback" && this.acceptedRequestIds.has(requestId))) {
      throw new Error("requestId is still owned by an earlier request");
    }
    try {
      this.native.sendCommand(this.runtime, command);
    } catch (error) {
      if (error instanceof Error && error.message === "Reader-Core command was not admitted") {
        const code = (error as Error & { code?: string }).code;
        if (code === "BUSY" || code === "RESOURCE_EXHAUSTED") {
          try {
            // Peek immediately, on the throwing thread, before any other
            // native call can clear its errno-style diagnostic slot.
            const detail = this.native.lastError();
            // ABI v1 structured error codes, not RC_SEND_* return statuses.
            if (detail.code === (code === "BUSY" ? 9 : 10) && SAFE_ADMISSION_REASONS.has(detail.message)) {
              error.message += `: ${detail.message}`;
            }
          } catch (_) {
            // Older/malformed bridges and failed diagnostics keep the exact
            // original error. No retry and no fabricated acceptance/result.
          }
        }
      }
      throw error;
    }
    this.acceptedRequestIds.add(requestId);
    this.diagnosticRequestMethods.set(requestId, TERMINAL_DIAGNOSTIC_METHODS.has(method) ? method : "unknown");
    if (this.diagnosticRequestMethods.size > 256) {
      for (const oldest of this.diagnosticRequestMethods.keys()) {
        this.diagnosticRequestMethods.delete(oldest);
        break;
      }
    }
    this.kickNativePoll();
    return requestId;
  }

  cancel(requestId: number): void {
    this.ensureOpen();
    assertNonNegativeSafeInteger(requestId, "requestId");
    this.cancelPendingRequest(requestId);
  }

  readEvent(timeoutMs = 0): ReaderCoreEvent | null {
    this.ensureOpen();
    assertNonNegativeSafeInteger(timeoutMs, "timeoutMs");
    const queued = this.takeNextPendingEvent();
    if (queued !== undefined) {
      this.acknowledgeConsumedEvent(queued);
      return queued;
    }

    for (let read = 0; read < NATIVE_EVENT_READ_LIMIT; read++) {
      const event = this.readNativeEvent(read === 0 ? timeoutMs : 0);
      if (event === null) return null;
      if (this.discardAbandonedEvent(event)) continue;
      if (this.resultWaiters.has(event.requestId)) {
        this.enqueuePendingEvent(event);
        continue;
      }
      this.acknowledgeConsumedEvent(event);
      return event;
    }
    return null;
  }

  completeHostRequest(
    eventOrOperationId: ReaderCoreHostRequestEvent | number,
    result: JsonObject,
    requestId?: number
  ): void {
    this.ensureOpen();
    const operationId =
      typeof eventOrOperationId === "number"
        ? eventOrOperationId
        : eventOrOperationId.operationId;
    assertNonNegativeSafeInteger(operationId, "operationId");
    if (requestId !== undefined) {
      assertNonNegativeSafeInteger(requestId, "requestId");
    }
    assertJsonObjectValue(result, "host.complete result");
    this.native.completeHostRequest(this.runtime, operationId, result, requestId);
    this.kickNativePoll();
  }

  failHostRequest(
    eventOrOperationId: ReaderCoreHostRequestEvent | number,
    error: ReaderCoreError | Error | string,
    requestId?: number
  ): void {
    this.ensureOpen();
    const operationId =
      typeof eventOrOperationId === "number"
        ? eventOrOperationId
        : eventOrOperationId.operationId;
    assertNonNegativeSafeInteger(operationId, "operationId");
    if (requestId !== undefined) {
      assertNonNegativeSafeInteger(requestId, "requestId");
    }
    this.native.failHostRequest(this.runtime, operationId, normalizeHostError(error), requestId);
    this.kickNativePoll();
  }

  async request(
    method: string,
    params: JsonObject = {},
    options: RequestOptions = {}
  ): Promise<ReaderCoreResultEvent> {
    const requestId = this.send(method, params);
    return this.waitForResult(requestId, options);
  }

  async waitForResult(
    requestId: number,
    options: RequestOptions = {}
  ): Promise<ReaderCoreResultEvent> {
    this.ensureOpen();
    const timeoutMs = readTimeoutMs(options.timeoutMs);
    const pollMs = readPollMs(options.pollMs);
    if (this.abandonedRequestIds.has(requestId)) throw new Error(`Reader-Core request cancelled by caller: ${requestId}`);
    if (this.deliveryMode === "explicitAck") {
      if (!this.acceptedRequestIds.has(requestId)) throw new Error("request was not admitted by this SDK runtime");
      if (this.resultWaiters.has(requestId)) throw new Error("request already has a result consumer");
    }
    const deadline = Date.now() + timeoutMs;
    const waiter: ResultWaiter = { requestId };
    const waiters = this.resultWaiters.get(requestId) ?? new Set<ResultWaiter>();
    waiters.add(waiter);
    this.resultWaiters.set(requestId, waiters);
    let immediateTurns = 0;
    let parkedForNative = false;

    try {
      while (Date.now() <= deadline) {
        this.checkWaiter(waiter);
        // A long chain of immediately available events/Host results must still
        // let UI timers and cancellation producers run. This is not Host polling.
        if (immediateTurns >= RESULT_EVENT_YIELD_LIMIT) {
          await this.waitForWake(waiter, 0);
          immediateTurns = 0;
          this.checkWaiter(waiter);
        }
        if (options.shouldCancel?.()) {
          this.cancelPendingRequest(requestId);
          throw new Error(`Reader-Core request cancelled by caller: ${requestId}`);
        }
        const event = this.takePendingForRequest(requestId);
        if (event === null) {
          if (parkedForNative && Date.now() >= deadline) break;
          await this.waitForNativePoll(waiter, Math.min(Date.now() + pollMs, deadline), !parkedForNative);
          parkedForNative = true;
          continue;
        }
        parkedForNative = false;
        immediateTurns++;

        if (event.type === "host.request") {
          const routerHandler = this.capabilityRouter?.has(event.capability)
            ? this.capabilityRouter
            : undefined;
          const inlineHandler = options.hostRequest;
          if (routerHandler === undefined && inlineHandler === undefined) {
            this.acknowledgeConsumedEvent(event);
            this.cancelPendingRequest(requestId);
            throw new Error(`Reader-Core host.request requires a handler: ${event.operationId}`);
          }
          try {
            const result = await this.awaitHostHandler(
              event,
              routerHandler !== undefined
                ? () => routerHandler.route(event)
                : () => inlineHandler!(event),
              deadline,
              pollMs,
              options.shouldCancel,
              waiter
            );
            this.checkWaiter(waiter);
            if (Date.now() >= deadline) {
              const error = new Error(`Reader-Core request timed out: ${requestId}`);
              this.cancelPendingRequest(requestId, error);
              throw error;
            }
            if (options.shouldCancel?.()) {
              this.cancelPendingRequest(requestId);
              throw new Error(`Reader-Core request cancelled by caller: ${requestId}`);
            }
            this.completeHostRequest(event, result);
          } catch (error) {
            if (this.closed || waiter.interruption !== undefined || this.abandonedRequestIds.has(requestId)) {
              throw error;
            }
            this.failHostRequest(event, normalizeHostError(error));
          } finally {
            this.acknowledgeConsumedEvent(event);
          }
          continue;
        }

        this.acknowledgeConsumedEvent(event);
        if (event.type === "error") throw new ReaderCoreRequestError(event);
        return event;
      }

      const error = new Error(`Reader-Core request timed out: ${requestId}`);
      this.cancelPendingRequest(requestId, error);
      throw error;
    } finally {
      waiters.delete(waiter);
      if (waiters.size === 0 && this.resultWaiters.get(requestId) === waiters) {
        this.resultWaiters.delete(requestId);
      }
    }
  }

  private async awaitHostHandler(
    event: ReaderCoreHostRequestEvent,
    handler: () => JsonObject | Promise<JsonObject>,
    deadline: number,
    pollMs: number,
    shouldCancel: (() => boolean) | undefined,
    waiter: ResultWaiter
  ): Promise<JsonObject> {
    this.activeHostRequests.set(event.requestId, event);
    try {
      return await new Promise<JsonObject>((resolve, reject) => {
        let settled = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const finish = (value: JsonObject | undefined, error?: unknown, failed = false): void => {
          if (settled) return;
          settled = true;
          if (timer !== undefined) clearTimeout(timer);
          if (waiter.wake === checkInterruption) waiter.wake = undefined;
          if (failed) reject(error);
          else resolve(value as JsonObject);
        };
        const checkInterruption = (): boolean => {
          if (settled) return true;
          try {
            this.checkWaiter(waiter);
            if (shouldCancel?.()) {
              this.cancelPendingRequest(event.requestId);
              this.checkWaiter(waiter);
            }
            if (Date.now() >= deadline) {
              const error = new Error(`Reader-Core request timed out: ${event.requestId}`);
              this.cancelPendingRequest(event.requestId, error);
              throw error;
            }
            return false;
          } catch (error) {
            finish(undefined, error, true);
            return true;
          }
        };
        const scheduleCheck = (): void => {
          const remaining = Math.max(0, deadline - Date.now());
          // setTimeout accepts a signed 32-bit delay on supported JS hosts.
          timer = setTimeout(() => {
            timer = undefined;
            if (!checkInterruption()) scheduleCheck();
          }, Math.min(0x7fffffff, shouldCancel === undefined ? remaining : Math.min(pollMs, remaining)));
        };
        // Install cancellation/close wakeup before invoking even a synchronous
        // handler. Completion uses this same once-only finish, never a poll tick.
        waiter.wake = checkInterruption;
        if (checkInterruption()) return;
        scheduleCheck();
        Promise.resolve().then(() => checkInterruption() ? undefined : handler()).then(
          (value) => {
            if (!checkInterruption()) finish(value);
          },
          (error) => {
            if (!checkInterruption()) finish(undefined, error, true);
          }
        );
      });
    } finally {
      if (this.activeHostRequests.get(event.requestId) === event) {
        this.activeHostRequests.delete(event.requestId);
      }
    }
  }

  private cancelPendingRequest(
    requestId: number,
    error = new Error(`Reader-Core request cancelled by caller: ${requestId}`)
  ): void {
    const active = this.activeHostRequests.get(requestId);
    const waiters = this.resultWaiters.get(requestId);
    const alreadyCancelled = this.abandonedRequestIds.has(requestId) ||
      (waiters !== undefined && Array.from(waiters).every((waiter) => waiter.interruption !== undefined));
    if (!alreadyCancelled && (this.acceptedRequestIds.has(requestId) || active !== undefined)) {
      this.abandonedRequestIds.add(requestId);
    }
    if (waiters !== undefined) {
      for (const waiter of waiters) this.interruptWaiter(waiter, error);
    }
    if (alreadyCancelled || this.closed) return;
    try {
      this.discardAbandonedPendingEvents(requestId);
      if (active !== undefined) this.capabilityRouter?.cancel(active);
    } finally {
      if (!this.closed) {
        try { this.native.cancelRequest(this.runtime, requestId); }
        finally { if (!this.closed) this.drainAbandonedEvents(); }
      }
    }
  }

  private interruptWaiter(waiter: ResultWaiter, error: Error): void {
    if (waiter.interruption !== undefined) return;
    waiter.interruption = error;
    waiter.wake?.();
  }

  private checkWaiter(waiter: ResultWaiter): void {
    this.ensureOpen();
    if (waiter.interruption !== undefined) throw waiter.interruption;
  }

  private waitForWake(waiter: ResultWaiter, waitMs: number): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = (): void => {
        if (settled) return;
        settled = true;
        if (timer !== undefined) clearTimeout(timer);
        if (waiter.wake === finish) waiter.wake = undefined;
        resolve();
      };
      waiter.wake = finish;
      if (this.closed || waiter.interruption !== undefined) finish();
      else timer = setTimeout(finish, waitMs);
    });
  }

  runSourceCheck(
    params: SourceCheckRunParams, options: RequestOptions = {}
  ): Promise<ReaderCoreResultEvent<SourceCheckResultData>> {
    return this.requestSourceCheck("source.check.run", params, options);
  }

  /**
   * Results align with the input array, including duplicate candidates.
   * Each sourceId is its normalized bookSourceUrl when available, or
   * `ephemeral:<one-based input index>` when the URL is unusable.
   */
  runEphemeralSourceCheck(
    params: SourceCheckEphemeralRunParams, options: RequestOptions = {}
  ): Promise<ReaderCoreResultEvent<SourceCheckResultData>> {
    return this.requestSourceCheck("source.check.ephemeral.run", params, options);
  }

  clearSourceCheckReports(
    params: SourceCheckReportClearParams, options: RequestOptions = {}
  ): Promise<ReaderCoreResultEvent<SourceCheckReportClearData>> {
    return this.request("source.check.report.clear", params, options) as Promise<ReaderCoreResultEvent<SourceCheckReportClearData>>;
  }

  private requestSourceCheck(
    method: "source.check.run" | "source.check.ephemeral.run",
    params: SourceCheckRunParams | SourceCheckEphemeralRunParams,
    options: RequestOptions
  ): Promise<ReaderCoreResultEvent<SourceCheckResultData>> {
    return this.request(method, params, {
      ...options,
      // Give Core time to publish a terminal result after its own budget expires.
      timeoutMs: options.timeoutMs ?? (params.timeoutMs ?? 180_000) + 5_000,
    }) as Promise<ReaderCoreResultEvent<SourceCheckResultData>>;
  }

  async sourceGroupCatalog(timeoutMs = 5000): Promise<ReaderCoreResultEvent> {
    return this.request("source.group.catalog", { reportVersion: 1 }, { timeoutMs });
  }

  async sourceGroupMutate(operationId: string, sequence: number, params: SourceGroupMutateParams,
    options: RequestOptions = {}): Promise<ReaderCoreResultEvent> {
    return this.request("rules.mutation.apply", { operationId, sequence,
      mutation: { method: "source.group.mutate", params } }, options);
  }

  async sourceImportGrouped(operationId: string, sequence: number, params: SourceGroupedImportParams,
    options: RequestOptions = {}): Promise<ReaderCoreResultEvent> {
    return this.request("rules.mutation.apply", { operationId, sequence,
      mutation: { method: "source.import.grouped", params } }, options);
  }

  async coreInfo(timeoutMs = 2000): Promise<ReaderCoreResultEvent> {
    return this.request("core.info", {}, { timeoutMs });
  }

  async ping(timeoutMs = 2000): Promise<ReaderCoreResultEvent> {
    return this.request("runtime.ping", {}, { timeoutMs });
  }

  async hostSmoke(timeoutMs = 2000): Promise<ReaderCoreResultEvent> {
    return this.request(
      "runtime.hostSmoke",
      { capability: "host.smoke.echo", params: { source: "harmony-sdk" } },
      {
        timeoutMs,
        hostRequest: (event) => ({
          status: "ok",
          capability: event.capability,
          params: event.params,
        }),
      }
    );
  }

  private allocateRequestId(): number {
    return this.nextRequestId++;
  }

  private readNativeEvent(timeoutMs: number): ReaderCoreEvent | null {
    const raw = this.native.readEvent(this.runtime, timeoutMs);
    if (raw === null) {
      return null;
    }
    let event: ReaderCoreEvent;
    try { event = parseReaderCoreEvent(raw); }
    catch (error) {
      // A malformed negotiated envelope cannot be acknowledged safely.
      // Closing settles waiters and releases the runtime-owned quota.
      if (this.deliveryMode === "explicitAck") this.close();
      throw error;
    }
    if (event.type === "result" || event.type === "error") {
      this.terminalMetadata.push({ requestId: event.requestId,
        method: this.diagnosticRequestMethods.get(event.requestId) ?? "unknown",
        type: event.type, wireUtf16Units: raw.length });
      this.diagnosticRequestMethods.delete(event.requestId);
      if (this.terminalMetadata.length > 16) this.terminalMetadata.shift();
    }
    return event;
  }

  private waitForNativePoll(waiter: ResultWaiter, wakeAt: number, readNow: boolean): Promise<void> {
    return new Promise((resolve) => {
      const finish = (): void => {
        if (!this.nativePollWaits.delete(waiter)) return;
        if (waiter.wake === finish) waiter.wake = undefined;
        if (this.nativePollWaits.size === 0) this.clearNativePollTimer();
        resolve();
      };
      this.nativePollWaits.set(waiter, { wakeAt, finish });
      waiter.wake = finish;
      if (this.closed || waiter.interruption !== undefined || this.pendingEventsByRequest.has(waiter.requestId)) finish();
      else if (readNow) this.kickNativePoll();
      else this.scheduleNativePoll();
    });
  }

  private kickNativePoll(): void {
    if (this.closed || this.nativePollWaits.size === 0 || this.nativePollQueued ||
        (this.nativePollTimer !== undefined && this.nativePollTimerAt <= Date.now())) return;
    if (this.nativePollBacklog) {
      this.scheduleNativePoll();
      return;
    }
    this.clearNativePollTimer();
    this.nativePollQueued = true;
    void Promise.resolve().then(() => {
      this.nativePollQueued = false;
      this.driveNativePoll();
    });
  }

  private driveNativePoll(): void {
    if (this.closed) return;
    let empty = false;
    let read = 0;
    try {
      for (; read < NATIVE_EVENT_READ_LIMIT && this.nativePollWaits.size > 0; read++) {
        if (this.pollNativeOnce() === "empty") {
          empty = true;
          break;
        }
      }
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      for (const waiter of this.nativePollWaits.keys()) this.interruptWaiter(waiter, error);
      return;
    }

    this.nativePollBacklog = !empty && read === NATIVE_EVENT_READ_LIMIT;
    const now = Date.now();
    for (const parked of this.nativePollWaits.values()) {
      if (parked.wakeAt <= now) parked.finish();
    }
    // Only real emptiness delays the next read. A full slice yields once to
    // timers even when it contained nothing but abandoned deliveries.
    this.scheduleNativePoll();
  }

  private scheduleNativePoll(): void {
    if (this.closed || this.nativePollWaits.size === 0 || this.nativePollQueued) return;
    let at = this.nativePollBacklog ? Date.now() : Infinity;
    for (const parked of this.nativePollWaits.values()) at = Math.min(at, parked.wakeAt);
    if (this.nativePollTimer !== undefined && this.nativePollTimerAt <= at) return;
    this.clearNativePollTimer();
    this.nativePollTimerAt = at;
    this.nativePollTimer = setTimeout(() => {
      this.nativePollTimer = undefined;
      this.driveNativePoll();
    }, Math.min(0x7fffffff, Math.max(0, at - Date.now())));
  }

  private clearNativePollTimer(): void {
    if (this.nativePollTimer === undefined) return;
    clearTimeout(this.nativePollTimer);
    this.nativePollTimer = undefined;
  }

  private pollNativeOnce(): "empty" | "discarded" | "queued" {
    const event = this.readNativeEvent(0);
    if (event === null) return "empty";
    if (this.discardAbandonedEvent(event)) return "discarded";
    this.enqueuePendingEvent(event);
    return "queued";
  }

  /** Drain ready receipts only. Live events keep their original unread order. */
  private drainAbandonedEvents(limit = NATIVE_EVENT_READ_LIMIT): void {
    for (let read = 0; read < limit && this.abandonedRequestIds.size > 0; read++) {
      if (this.pollNativeOnce() === "empty") return;
    }
  }

  private takePendingForRequest(requestId: number): ReaderCoreEvent | null {
    const requestQueue = this.pendingEventsByRequest.get(requestId);
    if (requestQueue === undefined) {
      return null;
    }
    for (const queued of requestQueue) {
      this.consumePendingEvent(queued);
      return queued.event;
    }
    this.pendingEventsByRequest.delete(requestId);
    return null;
  }

  private discardAbandonedPendingEvents(requestId: number): void {
    if (!this.abandonedRequestIds.has(requestId)) return;
    const requestQueue = this.pendingEventsByRequest.get(requestId);
    if (requestQueue === undefined) return;
    for (const queued of requestQueue) {
      this.consumePendingEvent(queued);
      this.discardAbandonedEvent(queued.event);
    }
  }

  private enqueuePendingEvent(event: ReaderCoreEvent): void {
    const queued: QueuedReaderCoreEvent = { event };
    this.pendingEvents.add(queued);
    const requestQueue = this.pendingEventsByRequest.get(event.requestId) ?? new Set<QueuedReaderCoreEvent>();
    requestQueue.add(queued);
    this.pendingEventsByRequest.set(event.requestId, requestQueue);
    this.pendingEventCountValue += 1;
    this.resultWaiters.get(event.requestId)?.forEach((waiter) => this.nativePollWaits.get(waiter)?.finish());
  }

  private takeNextPendingEvent(): ReaderCoreEvent | undefined {
    for (const queued of this.pendingEvents) {
      if (this.resultWaiters.has(queued.event.requestId)) continue;
      this.consumePendingEvent(queued);
      return queued.event;
    }
    return undefined;
  }

  private consumePendingEvent(queued: QueuedReaderCoreEvent): void {
    if (!this.pendingEvents.delete(queued)) {
      return;
    }
    const requestId = queued.event.requestId;
    const requestQueue = this.pendingEventsByRequest.get(requestId);
    requestQueue?.delete(queued);
    if (requestQueue?.size === 0) {
      this.pendingEventsByRequest.delete(requestId);
    }
    this.pendingEventCountValue = Math.max(0, this.pendingEventCountValue - 1);
  }

  private discardAbandonedEvent(event: ReaderCoreEvent): boolean {
    if (!this.abandonedRequestIds.has(event.requestId)) {
      return false;
    }
    this.acknowledgeConsumedEvent(event);
    if (this.isTerminalEvent(event)) {
      this.abandonedRequestIds.delete(event.requestId);
    }
    return true;
  }

  private acknowledgeConsumedEvent(event: ReaderCoreEvent): void {
    if (this.closed || this.consumedDeliveries.has(event)) return;
    if (this.deliveryMode === "explicitAck") {
      if (!Number.isSafeInteger(event.deliveryId) || event.deliveryId! <= 0) {
        throw new Error("negotiated Reader-Core event is missing a delivery receipt");
      }
      this.native.acknowledgeEvent!(this.runtime, event.deliveryId!);
    }
    if (this.isTerminalEvent(event)) this.acceptedRequestIds.delete(event.requestId);
    this.consumedDeliveries.add(event);
  }

  private isTerminalEvent(event: ReaderCoreEvent): boolean {
    return event.type === "result" || event.type === "error";
  }

  private ensureOpen(): void {
    if (this.closed) {
      throw new Error("Reader-Core runtime is closed");
    }
  }
}

export class ReaderCoreRequestError extends Error {
  readonly event: ReaderCoreErrorEvent;

  constructor(event: ReaderCoreErrorEvent) {
    super(event.error.message);
    this.name = "ReaderCoreRequestError";
    this.event = event;
  }

  get transactionPendingDetails(): ReaderCoreTransactionPendingDetails | undefined {
    return readTransactionPendingDetails(this.event.error);
  }
}

export function isReaderCoreTransactionPendingError(
  error: unknown
): error is ReaderCoreRequestError {
  return error instanceof ReaderCoreRequestError &&
    error.transactionPendingDetails !== undefined;
}

export function parseReaderCoreEvent(raw: string): ReaderCoreEvent {
  const value = JSON.parse(raw) as unknown;
  if (!isJsonObject(value)) {
    throw new Error("invalid Reader-Core event envelope");
  }

  const requestId = value.requestId;
  if (value.protocolVersion !== 1 || !isNonNegativeSafeInteger(requestId)) {
    throw new Error("invalid Reader-Core event envelope");
  }
  if (value.deliveryId !== undefined && (!isNonNegativeSafeInteger(value.deliveryId) || value.deliveryId === 0)) {
    throw new Error("invalid Reader-Core delivery receipt");
  }

  if (value.type === "result") {
    if (!isJsonObject(value.data)) {
      throw new Error("invalid Reader-Core result event");
    }
    return value as ReaderCoreResultEvent;
  }

  if (value.type === "error") {
    if (!isReaderCoreError(value.error)) {
      throw new Error("invalid Reader-Core error event");
    }
    return value as ReaderCoreErrorEvent;
  }

  if (value.type === "host.request") {
    if (
      !isNonNegativeSafeInteger(value.operationId) ||
      typeof value.capability !== "string" ||
      value.capability.length === 0 ||
      !isJsonObject(value.params)
    ) {
      throw new Error("invalid Reader-Core host.request event");
    }
    return value as ReaderCoreHostRequestEvent;
  }

  throw new Error(`unknown Reader-Core event type: ${String(value.type)}`);
}

function assertNonNegativeSafeInteger(value: number, name: string): void {
  if (!isNonNegativeSafeInteger(value)) {
    throw new Error(`${name} must be a non-negative safe integer`);
  }
}

function assertCommandMethod(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("method must be a non-empty string");
  }
}

function assertJsonObjectValue(value: unknown, name: string): asserts value is JsonObject {
  if (!isJsonObject(value)) {
    throw new Error(`${name} must be a JSON object`);
  }
}

function readTimeoutMs(value: number | undefined): number {
  const timeoutMs = value ?? 2000;
  assertNonNegativeSafeInteger(timeoutMs, "timeoutMs");
  return timeoutMs;
}

function readPollMs(value: number | undefined): number {
  const pollMs = value ?? 10;
  if (!isNonNegativeSafeInteger(pollMs) || pollMs === 0) {
    throw new Error("pollMs must be a positive safe integer");
  }
  return pollMs;
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function normalizeHostError(error: unknown): ReaderCoreError {
  const candidate = isJsonObject(error) ? error : undefined;
  const sourceCode = typeof candidate?.code === "string" ? candidate.code : undefined;
  // HostErrorCode belongs to diagnostics, while NAPI's error argument is a
  // CoreError. Never forward a platform code as the enclosing protocol code.
  // Rebuild even valid Error subclasses: Error.message is non-enumerable and
  // would disappear when NAPI serializes the original instance to JSON.
  const normalized: ReaderCoreError = {
    code: sourceCode !== undefined && isCoreErrorCode(sourceCode) ? sourceCode : "INTERNAL",
    message: typeof candidate?.message === "string"
      ? candidate.message
      : typeof error === "string" ? error : "host request failed",
    retryable: typeof candidate?.retryable === "boolean" ? candidate.retryable : false,
  };
  if (isJsonObject(candidate?.details)) {
    normalized.details = { ...candidate.details };
  } else if (error instanceof Error) {
    normalized.details = { name: error.name };
  } else if (candidate !== undefined && sourceCode === undefined) {
    normalized.details = { cause: error };
  }
  if (sourceCode !== undefined && !isCoreErrorCode(sourceCode)) {
    normalized.details = { ...normalized.details, hostErrorCode: sourceCode };
  }
  return normalized;
}

function isCoreErrorCode(code: string): boolean {
  switch (code) {
    case "UNKNOWN_METHOD":
    case "INVALID_PARAMS":
    case "INVALID_PROTOCOL_VERSION":
    case "CANCELLED":
    case "TIMEOUT":
    case "INVALID_MESSAGE":
    case "INTERNAL":
    case "TRANSACTION_PENDING":
      return true;
    default:
      return false;
  }
}

function isReaderCoreError(value: unknown): value is ReaderCoreError {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<ReaderCoreError>;
  return (
    typeof candidate.code === "string" &&
    typeof candidate.message === "string" &&
    typeof candidate.retryable === "boolean" &&
    (candidate.details === undefined || isJsonObject(candidate.details))
  );
}

function readTransactionPendingDetails(
  error: ReaderCoreError
): ReaderCoreTransactionPendingDetails | undefined {
  if (error.code !== "TRANSACTION_PENDING" || !isJsonObject(error.details)) {
    return undefined;
  }
  const transactionKind = error.details.transactionKind;
  const pendingHostOperationCount = error.details.pendingHostOperationCount;
  const retryAfterMillis = error.details.retryAfterMillis;
  if (
    transactionKind !== "storageApply" &&
    transactionKind !== "persistenceMutation" &&
    transactionKind !== "hostOperationDrain"
  ) {
    return undefined;
  }
  if (
    !isNonNegativeSafeInteger(pendingHostOperationCount) ||
    !isNonNegativeSafeInteger(retryAfterMillis)
  ) {
    return undefined;
  }
  return {
    transactionKind,
    pendingHostOperationCount,
    retryAfterMillis,
  };
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
