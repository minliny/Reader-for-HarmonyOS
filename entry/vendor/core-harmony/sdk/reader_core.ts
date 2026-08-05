export type JsonObject = { [key: string]: unknown };

export type NativeRuntimeHandle = unknown;

export type NativeReaderCoreModule = {
  abiVersion(): number;
  lastError(): { code: number; message: string };
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
   * Polled while waiting for the matching Core event. Returning true cancels
   * the native request before this Promise rejects, so an obsolete page intent
   * cannot keep executing behind a newer route or chapter selection.
   */
  shouldCancel?: () => boolean;
};

export type CapabilityHandler = (
  event: ReaderCoreHostRequestEvent
) => JsonObject | Promise<JsonObject>;

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

  register(capability: string, handler: CapabilityHandler): void {
    if (typeof capability !== "string" || capability.length === 0) {
      throw new Error("capability must be a non-empty string");
    }
    if (typeof handler !== "function") {
      throw new Error("handler must be a function");
    }
    this.handlers.set(capability, handler);
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

export class ReaderCoreRuntime {
  static readonly protocolVersion = 1;

  private readonly native: NativeReaderCoreModule;
  private readonly runtime: NativeRuntimeHandle;
  private readonly pendingEvents: ReaderCoreEvent[] = [];
  /**
   * Request ids abandoned by `waitForResult` itself. They are deliberately
   * distinct from the public `cancel()` API: an external caller can still
   * cancel a request and observe its terminal CANCELLED event through the
   * normal event APIs.
   */
  private readonly abandonedRequestIds: Set<number> = new Set<number>();
  private nextRequestId = 1;
  private closed = false;
  private capabilityRouter: CapabilityRouter | null = null;

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
    return this.pendingEvents.length + this.native.pendingEventCount(this.runtime);
  }

  close(): void {
    if (this.closed) {
      return;
    }
    this.native.releaseRuntime(this.runtime);
    this.pendingEvents.length = 0;
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
    this.native.sendCommand(this.runtime, command);
    return requestId;
  }

  cancel(requestId: number): void {
    this.ensureOpen();
    assertNonNegativeSafeInteger(requestId, "requestId");
    this.native.cancelRequest(this.runtime, requestId);
  }

  readEvent(timeoutMs = 0): ReaderCoreEvent | null {
    this.ensureOpen();
    assertNonNegativeSafeInteger(timeoutMs, "timeoutMs");
    this.discardAbandonedPendingEvents();
    const queued = this.pendingEvents.shift();
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
      // `close()` can run while this async wait yielded. Never read from a
      // released native runtime on the next poll iteration.
      this.ensureOpen();
      if (options.shouldCancel?.()) {
        this.cancelPendingRequest(requestId);
        throw new Error(`Reader-Core request cancelled by caller: ${requestId}`);
      }
      const event =
        this.takePendingForRequest(requestId) ??
        this.readNativeEvent(Math.min(pollMs, Math.max(0, deadline - Date.now())));
      if (event === null) {
        await delay(0);
        continue;
      }

      if (event.type === "host.request") {
        if (event.requestId !== requestId) {
          this.pendingEvents.push(event);
          await delay(0);
          continue;
        }
        const routerHandler = this.capabilityRouter?.has(event.capability)
          ? this.capabilityRouter
          : undefined;
        const inlineHandler = options.hostRequest;
        if (routerHandler === undefined && inlineHandler === undefined) {
          // This host operation belongs to the request currently being waited
          // on. Re-queueing it and throwing leaves the native Core request
          // pending forever; cancel it before returning the actionable error.
          this.cancelPendingRequest(requestId);
          throw new Error(`Reader-Core host.request requires a handler: ${event.operationId}`);
        }
        let result: JsonObject;
        try {
          result = routerHandler !== undefined
            ? await routerHandler.route(event)
            : await inlineHandler!(event);
        } catch (error) {
          this.failHostRequest(event, normalizeHostError(error));
          continue;
        }
        // A page/selection can become obsolete while its Host handler awaited
        // I/O. Do not complete that old Core continuation after the caller has
        // cancelled it; a completion here could revive stale remote work.
        if (options.shouldCancel?.()) {
          this.cancelPendingRequest(requestId);
          throw new Error(`Reader-Core request cancelled by caller: ${requestId}`);
        }
        try {
          this.completeHostRequest(event, result);
        } catch (error) {
          if (options.shouldCancel?.()) {
            this.cancelPendingRequest(requestId);
            throw new Error(`Reader-Core request cancelled by caller: ${requestId}`);
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

      this.pendingEvents.push(event);
      await delay(0);
    }

    this.cancelPendingRequest(requestId);
    throw new Error(`Reader-Core request timed out: ${requestId}`);
  }

  private cancelPendingRequest(requestId: number): void {
    // `cancelRequest` causes Core to emit a terminal CANCELLED error on the
    // original request id. This path is used only after this SDK has already
    // rejected a wait because its page intent became obsolete, timed out, or
    // lacked a required Host handler; the terminal event must not be retained
    // and later surface as an unrelated queued event.
    this.abandonedRequestIds.add(requestId);
    this.discardAbandonedPendingEvents();
    // A close may race an abandoned page request. Preserve the caller's
    // cancellation/timeout error even when the runtime has just been released.
    try {
      this.cancel(requestId);
    } catch (_) {
      // `cancel` is best effort for an already completed or closed request.
      // A closed runtime cannot emit the terminal event that would otherwise
      // retire this id.
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

  private takePendingForRequest(requestId: number): ReaderCoreEvent | null {
    this.discardAbandonedPendingEvents();
    const index = this.pendingEvents.findIndex((event) => event.requestId === requestId);
    if (index < 0) {
      return null;
    }

    const event = this.pendingEvents[index] as ReaderCoreEvent;
    this.pendingEvents.splice(index, 1);
    return event;
  }

  private discardAbandonedPendingEvents(): void {
    const terminalRequestIds: number[] = [];
    // Keep the abandoned-id set unchanged until this scan finishes. If a
    // queued host.request and its terminal event are both present, deleting
    // the id at the terminal event must not let the earlier event survive.
    for (let index = this.pendingEvents.length - 1; index >= 0; index--) {
      const event = this.pendingEvents[index] as ReaderCoreEvent;
      if (!this.abandonedRequestIds.has(event.requestId)) {
        continue;
      }
      this.pendingEvents.splice(index, 1);
      if (this.isTerminalEvent(event)) {
        terminalRequestIds.push(event.requestId);
      }
    }
    for (const requestId of terminalRequestIds) {
      this.abandonedRequestIds.delete(requestId);
    }
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

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
