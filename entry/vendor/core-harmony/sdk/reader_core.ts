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

type ResultWaiter = {
  requestId: number;
  interruption?: Error;
  wake?: () => void;
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
  private readonly resultWaiters = new Map<number, Set<ResultWaiter>>();

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
    this.closed = true;
    const active = Array.from(this.activeHostRequests.values());
    for (const waiters of this.resultWaiters.values()) {
      for (const waiter of waiters) {
        this.interruptWaiter(waiter, new Error("Reader-Core runtime is closed"));
      }
    }
    this.resultWaiters.clear();
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
    this.native.releaseRuntime(this.runtime);
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
    this.cancelPendingRequest(requestId);
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
    const waiter: ResultWaiter = { requestId };
    const waiters = this.resultWaiters.get(requestId) ?? new Set<ResultWaiter>();
    waiters.add(waiter);
    this.resultWaiters.set(requestId, waiters);
    let immediateTurns = 0;

    try {
      while (Date.now() <= deadline) {
        this.checkWaiter(waiter);
        // A long chain of immediately available events/Host results must still
        // let UI timers and cancellation producers run. This is not Host polling.
        if (++immediateTurns >= 32) {
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
          await this.pollNativeQueue(waiter, Math.min(pollMs, Math.max(0, deadline - Date.now())));
          continue;
        }

        if (event.type === "host.request") {
          if (event.requestId !== requestId) {
            this.enqueuePendingEvent(event);
            await this.waitForWake(waiter, 0);
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
        await this.waitForWake(waiter, 0);
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
    const alreadyCancelled = this.abandonedRequestIds.has(requestId);
    if (active !== undefined || waiters !== undefined) {
      this.abandonedRequestIds.add(requestId);
      this.discardAbandonedPendingEvents();
    }
    if (waiters !== undefined) {
      for (const waiter of waiters) this.interruptWaiter(waiter, error);
    }
    if (alreadyCancelled || this.closed) return;
    try {
      if (active !== undefined) this.capabilityRouter?.cancel(active);
    } finally {
      this.native.cancelRequest(this.runtime, requestId);
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
  private async pollNativeQueue(waiter: ResultWaiter, waitMs: number): Promise<void> {
    if (await this.pollNativeOnce()) {
      return;
    }
    if (waitMs > 0) {
      await this.waitForWake(waiter, waitMs);
    }
    this.checkWaiter(waiter);
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
      this.ensureOpen();
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
