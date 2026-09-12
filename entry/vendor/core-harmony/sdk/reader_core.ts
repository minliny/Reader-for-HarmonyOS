export type JsonObject = { [key: string]: unknown };

export type NativeRuntimeHandle = unknown;

export type NativeReaderCoreModule = {
  abiVersion(): number;
  lastError(): { code: number; message: string };
  readEpubEntry(archivePath: string, entryPath: string, maxBytes: number): Uint8Array;
  readEpubEntryAsync(archivePath: string, entryPath: string, maxBytes: number): Promise<Uint8Array>;
  encodeText(text: string, charset: string, maxBytes: number): Uint8Array;
  createRuntime(config?: JsonObject | string): NativeRuntimeHandle;
  releaseRuntime(runtime: NativeRuntimeHandle): void;
  sendCommand(runtime: NativeRuntimeHandle, command: JsonObject | string): void;
  cancelRequest(runtime: NativeRuntimeHandle, requestId: number): void;
  readEvent(runtime: NativeRuntimeHandle, timeoutMs?: number): string | null;
  pendingEventCount(runtime: NativeRuntimeHandle): number;
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

export type ReaderCoreLastError = { code: number; message: string };

export type ReaderCoreCommand = {
  protocolVersion: 1;
  requestId: number;
  method: string;
  params?: JsonObject;
};

export type ReaderCoreResultEvent = {
  protocolVersion: 1;
  requestId: number;
  type: "result";
  data: JsonObject;
};

export type ReaderCoreError = {
  code: string;
  message: string;
  retryable: boolean;
  details?: JsonObject;
};

export type ReaderCoreErrorEvent = {
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
export interface HttpFetch {
  fetch(request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
  }): Promise<JsonObject>;
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
    return this.httpFetch.fetch({ url, method, headers, body });
  }
}

type QueuedReaderCoreEvent = {
  event: ReaderCoreEvent;
};

export class ReaderCoreRuntime {
  static readonly protocolVersion = 1;

  private readonly native: NativeReaderCoreModule;
  private readonly runtime: NativeRuntimeHandle;
  // Both indexes own only unread events. Ordered sets let either reader remove
  // a payload from both indexes immediately, without scans or retained tombstones.
  private readonly pendingEvents = new Set<QueuedReaderCoreEvent>();
  private readonly pendingEventsByRequest = new Map<number, Set<QueuedReaderCoreEvent>>();
  private pendingEventCountValue = 0;
  /** One shared native-event poll lane for all concurrent request waiters. */
  private pollTail: Promise<void> = Promise.resolve();
  /** Requests whose waiter has already returned after timeout/cancellation. */
  private readonly abandonedRequestIds = new Set<number>();
  private nextRequestId = 1;
  private closed = false;
  private capabilityRouter: CapabilityRouter | null = null;
  private readonly activeHostRequests = new Map<number, ReaderCoreHostRequestEvent>();

  constructor(nativeModule: NativeReaderCoreModule, config: JsonObject = {}) {
    this.native = nativeModule;
    this.runtime = nativeModule.createRuntime(config);
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

  get pendingEventCount(): number {
    this.discardAbandonedPendingEvents();
    return this.pendingEventCountValue + this.native.pendingEventCount(this.runtime);
  }

  close(): void {
    if (this.closed) {
      return;
    }
    for (const event of this.activeHostRequests.values()) {
      this.capabilityRouter?.cancel(event);
    }
    this.native.releaseRuntime(this.runtime);
    this.pendingEvents.clear();
    this.pendingEventsByRequest.clear();
    this.pendingEventCountValue = 0;
    this.activeHostRequests.clear();
    this.abandonedRequestIds.clear();
    this.closed = true;
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
    this.abandonedRequestIds.delete(requestId);
    this.native.sendCommand(this.runtime, command);
    return requestId;
  }

  cancel(requestId: number): void {
    this.ensureOpen();
    assertNonNegativeSafeInteger(requestId, "requestId");
    const active = this.activeHostRequests.get(requestId);
    if (active !== undefined) {
      this.capabilityRouter?.cancel(active);
    }
    this.native.cancelRequest(this.runtime, requestId);
  }

  readEvent(timeoutMs = 0): ReaderCoreEvent | null {
    this.ensureOpen();
    assertNonNegativeSafeInteger(timeoutMs, "timeoutMs");
    this.discardAbandonedPendingEvents();
    const queued = this.takeNextPendingEvent();
    if (queued !== undefined) {
      return queued;
    }

    return this.readNativeEvent(timeoutMs);
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
    const deadline = Date.now() + timeoutMs;

    while (Date.now() <= deadline) {
      this.ensureOpen();
      if (options.shouldCancel?.()) {
        this.cancelPendingRequest(requestId);
        throw new Error(`Reader-Core request cancelled by caller: ${requestId}`);
      }
      const event = this.takePendingForRequest(requestId);
      if (event === null) {
        await this.pollNativeQueue(Math.min(pollMs, Math.max(0, deadline - Date.now())));
        continue;
      }

      if (event.type === "host.request") {
        if (event.requestId !== requestId) {
          this.enqueuePendingEvent(event);
          await delay(0);
          continue;
        }
        const routerHandler = this.capabilityRouter?.has(event.capability)
          ? this.capabilityRouter
          : undefined;
        const inlineHandler = options.hostRequest;
        if (routerHandler === undefined && inlineHandler === undefined) {
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
            options.shouldCancel
          );
          if (options.shouldCancel?.()) {
            this.cancelPendingRequest(requestId);
            throw new Error(`Reader-Core request cancelled by caller: ${requestId}`);
          }
          this.completeHostRequest(event, result);
        } catch (error) {
          if (this.abandonedRequestIds.has(requestId)) {
            throw error;
          }
          this.failHostRequest(event, normalizeHostError(error));
        }
        continue;
      }

      if (event.requestId === requestId) {
        if (event.type === "error") {
          throw new ReaderCoreRequestError(event);
        }
        return event;
      }

      this.enqueuePendingEvent(event);
      await delay(0);
    }

    this.cancelPendingRequest(requestId);
    throw new Error(`Reader-Core request timed out: ${requestId}`);
  }

  private async awaitHostHandler(
    event: ReaderCoreHostRequestEvent,
    handler: () => JsonObject | Promise<JsonObject>,
    deadline: number,
    pollMs: number,
    shouldCancel: (() => boolean) | undefined
  ): Promise<JsonObject> {
    let settled = false;
    let rejected = false;
    let result: JsonObject | undefined;
    let failure: unknown;
    this.activeHostRequests.set(event.requestId, event);
    Promise.resolve()
      .then(handler)
      .then(
        (value) => {
          result = value;
          settled = true;
        },
        (error) => {
          failure = error;
          rejected = true;
          settled = true;
        }
      );
    try {
      while (!settled) {
        this.ensureOpen();
        if (shouldCancel?.()) {
          this.cancelPendingRequest(event.requestId);
          throw new Error(`Reader-Core request cancelled by caller: ${event.requestId}`);
        }
        const remaining = deadline - Date.now();
        if (remaining <= 0) {
          this.cancelPendingRequest(event.requestId);
          throw new Error(`Reader-Core request timed out: ${event.requestId}`);
        }
        await delay(Math.min(pollMs, remaining));
      }
      if (rejected) {
        throw failure;
      }
      return result as JsonObject;
    } finally {
      if (this.activeHostRequests.get(event.requestId) === event) {
        this.activeHostRequests.delete(event.requestId);
      }
    }
  }

  private cancelPendingRequest(requestId: number): void {
    this.abandonedRequestIds.add(requestId);
    this.discardAbandonedPendingEvents();
    try {
      this.cancel(requestId);
    } catch (_) {
      if (this.closed) {
        this.abandonedRequestIds.delete(requestId);
      }
    }
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
    const event = parseReaderCoreEvent(raw);
    return this.discardAbandonedEvent(event) ? null : event;
  }

  /** Serialize only the native non-blocking read. The retry delay deliberately
   * stays outside this lane so one empty waiter cannot hold every concurrent
   * request behind its timer. */
  private async pollNativeQueue(waitMs: number): Promise<void> {
    if (await this.pollNativeOnce()) {
      return;
    }
    if (waitMs > 0) {
      await delay(waitMs);
    }
    await this.pollNativeOnce();
  }

  private async pollNativeOnce(): Promise<boolean> {
    const predecessor = this.pollTail;
    let release: (() => void) | undefined;
    this.pollTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await predecessor;
    try {
      const event = this.readNativeEvent(0);
      if (event !== null) {
        this.enqueuePendingEvent(event);
        return true;
      }
      return false;
    } finally {
      release?.();
    }
  }

  private takePendingForRequest(requestId: number): ReaderCoreEvent | null {
    this.discardAbandonedPendingEvents();
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

  private discardAbandonedPendingEvents(): void {
    for (const requestId of Array.from(this.abandonedRequestIds)) {
      const requestQueue = this.pendingEventsByRequest.get(requestId);
      if (requestQueue === undefined) {
        continue;
      }
      let terminalSeen = false;
      for (const queued of requestQueue) {
        this.consumePendingEvent(queued);
        terminalSeen = terminalSeen || this.isTerminalEvent(queued.event);
      }
      this.pendingEventsByRequest.delete(requestId);
      if (terminalSeen) {
        this.abandonedRequestIds.delete(requestId);
      }
    }
  }

  private enqueuePendingEvent(event: ReaderCoreEvent): void {
    const queued: QueuedReaderCoreEvent = { event };
    this.pendingEvents.add(queued);
    const requestQueue = this.pendingEventsByRequest.get(event.requestId) ?? new Set<QueuedReaderCoreEvent>();
    requestQueue.add(queued);
    this.pendingEventsByRequest.set(event.requestId, requestQueue);
    this.pendingEventCountValue += 1;
  }

  private takeNextPendingEvent(): ReaderCoreEvent | undefined {
    for (const queued of this.pendingEvents) {
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
    if (this.isTerminalEvent(event)) {
      this.abandonedRequestIds.delete(event.requestId);
    }
    return true;
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
  if (isReaderCoreError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return {
      code: "INTERNAL",
      message: error.message,
      retryable: false,
      details: { name: error.name },
    };
  }

  const normalized: ReaderCoreError = {
    code: "INTERNAL",
    message: typeof error === "string" ? error : "host request failed",
    retryable: false,
  };
  if (typeof error === "object" && error !== null) {
    normalized.details = { cause: error };
  }
  return normalized;
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
