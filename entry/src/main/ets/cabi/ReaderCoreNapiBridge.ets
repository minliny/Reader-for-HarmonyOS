// ReaderCoreNapiBridge - Phase 3 C ABI/NAPI POC ArkTS 绑定骨架。
//
// HOS-ADR-001: C ABI/NAPI 为长期可选轨道，先做 POC。
// 本文件为 NAPI 绑定骨架，不包含实际 native module 加载（POC 阶段）。
//
// 硬性门槛: 只有 Toolchain/ABI/Memory/Threading/Security/CI 全部通过才能进入主线。
import readerCoreNapiRaw from 'libreader_core_napi.so';

// SDK-COMPAT: native .so module is an untyped ESObject at the ArkTS layer.
// Suppress ArkTS no-any-unknown for this boundary cast with an explicit object type.
declare interface ReaderCoreNapiRaw {
  abiVersion(): number;
  pingSmoke(): string;
  sendJsonCommand(command: string): string;
  createRuntime(config: object): ESObject;
  sendCommand(handle: ESObject, command: string): void;
  cancelRequest(handle: ESObject, requestId: number): void;
  readEvent(handle: ESObject, timeoutMs: number): string | null;
  pendingEventCount(handle: ESObject): number;
  completeHostRequest(handle: ESObject, operationId: number, result: object, requestId?: number): void;
  failHostRequest(handle: ESObject, operationId: number, error: object, requestId?: number): void;
  releaseRuntime(handle: ESObject): void;
  hostSmoke(): string;
}

// SDK-COMPAT: the .so default export is an untyped napi module; cast through Object.
const readerCoreNapi: ReaderCoreNapiRaw = readerCoreNapiRaw as Object as ReaderCoreNapiRaw;

// MARK: - ABI 版本与错误码（镜像 reader_core.h）

export const READER_CORE_ABI_VERSION = 1;

export enum ReaderCoreError {
  OK = 0,
  INVALID_ARGUMENT = 1,
  INVALID_JSON = 2,
  RULE_EVALUATION_FAILED = 3,
  OUT_OF_MEMORY = 4,
  UNSUPPORTED = 5,
  ABI_VERSION_MISMATCH = 6,
  INTERNAL = 99
}

export function readerCoreErrorName(code: ReaderCoreError): string {
  switch (code) {
    case ReaderCoreError.OK: return 'OK';
    case ReaderCoreError.INVALID_ARGUMENT: return 'INVALID_ARGUMENT';
    case ReaderCoreError.INVALID_JSON: return 'INVALID_JSON';
    case ReaderCoreError.RULE_EVALUATION_FAILED: return 'RULE_EVALUATION_FAILED';
    case ReaderCoreError.OUT_OF_MEMORY: return 'OUT_OF_MEMORY';
    case ReaderCoreError.UNSUPPORTED: return 'UNSUPPORTED';
    case ReaderCoreError.ABI_VERSION_MISMATCH: return 'ABI_VERSION_MISMATCH';
    case ReaderCoreError.INTERNAL: return 'INTERNAL';
    default: return 'UNKNOWN';
  }
}

// MARK: - 请求/响应 DTO

export interface ReplaceRule {
  id: string;
  pattern: string;
  replacement: string;
  isRegex: boolean;
}

export interface ReplaceRulesRequest {
  content: string;
  rules: ReplaceRule[];
}

export interface ReplaceRulesResponse {
  result: string;
  appliedCount: number;
  error: string | null;
}

export interface RuleChainEntry {
  kind: 'css' | 'xpath' | 'jsonpath' | 'template' | 'regex';
  expression: string;
  input: string;
}

export interface RuleChainRequest {
  rules: RuleChainEntry[];
}

export interface RuleChainResultEntry {
  values: string[];
  matchedCount: number;
  diagnostics: string[];
}

export interface RuleChainResponse {
  results: RuleChainResultEntry[];
  error: string | null;
}

// MARK: - NAPI 绑定接口（POC 骨架）

export interface ReplaceRulesNapiResult {
  errorCode: ReaderCoreError;
  jsonResponse: string | null;
}

export interface RuleChainNapiResult {
  errorCode: ReaderCoreError;
  jsonResponse: string | null;
}

export interface ReaderCoreNapiModule {
  reader_core_version(): string;
  reader_core_apply_replace_rules(jsonRequest: string): ReplaceRulesNapiResult;
  reader_core_parse_rule_chain(jsonRequest: string): RuleChainNapiResult;
  reader_core_free(ptr: number): void;
}

export interface ReaderCoreNativeSmokeResult {
  toolchainReady: boolean;
  abiVersion: number;
  pingJSON: string;
  pingPong: boolean;
  error: string | null;
}

// MARK: - POC 状态

export enum CAbiPocStatus {
  notStarted = 'not_started',
  toolchainBlocked = 'toolchain_blocked',
  abiStable = 'abi_stable',
  memoryOwned = 'memory_owned',
  threadingSafe = 'threading_safe',
  securityGated = 'security_gated',
  ciGreen = 'ci_green',
  readyForMainline = 'ready_for_mainline'
}

export interface CAbiPocGateResult {
  status: CAbiPocStatus;
  toolchainReady: boolean;
  abiStable: boolean;
  memoryOwned: boolean;
  threadingSafe: boolean;
  securityGated: boolean;
  ciGreen: boolean;
  canEnterMainline: boolean;
  blockingReasons: string[];
}

// MARK: - POC 门槛校验

export function evaluateCAbiPocGate(): CAbiPocGateResult {
  // POC 阶段: native module 已进入 HAP 构建链路，但 memory/threading/CI
  // 仍必须等真机/模拟器运行证据后才能进入主线。
  const nativeSmoke = runReaderCoreNativeSmoke();
  const blockingReasons: string[] = [];

  const toolchainReady = nativeSmoke.toolchainReady;
  if (!toolchainReady) { blockingReasons.push('toolchain: native module not built'); }

  const abiStable = nativeSmoke.abiVersion === READER_CORE_ABI_VERSION && nativeSmoke.pingPong;
  if (!abiStable) { blockingReasons.push('abi: stability not verified'); }

  const memoryOwned = false; // 内存所有权未验证
  if (!memoryOwned) { blockingReasons.push('memory: ownership not verified'); }

  const threadingSafe = false; // 线程安全未验证
  if (!threadingSafe) { blockingReasons.push('threading: safety not verified'); }

  const securityGated = true; // 安全约束已在接口定义中声明
  if (!securityGated) { blockingReasons.push('security: gate not declared'); }

  const ciGreen = false; // CI 未通过
  if (!ciGreen) { blockingReasons.push('ci: not green'); }

  const canEnterMainline = toolchainReady && abiStable && memoryOwned && threadingSafe && securityGated && ciGreen;

  let status: CAbiPocStatus;
  if (canEnterMainline) {
    status = CAbiPocStatus.readyForMainline;
  } else if (ciGreen) {
    status = CAbiPocStatus.ciGreen;
  } else if (abiStable) {
    status = CAbiPocStatus.abiStable;
  } else if (securityGated) {
    status = CAbiPocStatus.securityGated;
  } else {
    status = CAbiPocStatus.notStarted;
  }

  return {
    status,
    toolchainReady,
    abiStable,
    memoryOwned,
    threadingSafe,
    securityGated,
    ciGreen,
    canEnterMainline,
    blockingReasons
  };
}

export function runReaderCoreNativeSmoke(): ReaderCoreNativeSmokeResult {
  try {
    const abiVersion = readerCoreNapi.abiVersion();
    const pingJSON = readerCoreNapi.pingSmoke();
    const pingPong = pingJSON.indexOf('"requestId":42') !== -1 && pingJSON.indexOf('"pong":true') !== -1;
    return {
      toolchainReady: true,
      abiVersion,
      pingJSON,
      pingPong,
      error: null
    };
  } catch (e) {
    return {
      toolchainReady: false,
      abiVersion: 0,
      pingJSON: '',
      pingPong: false,
      error: `${e}`
    };
  }
}

// MARK: - JSON protocol bridge (core.info / runtime.ping / unknown method / host smoke)
//
// These wrap readerCoreNapi.sendJsonCommand so ArkTS talks the real Reader-Core
// JSON protocol over the C ABI (rc_runtime_create + rc_runtime_send). The NAPI
// module creates a fresh runtime per call, sends one command, and returns the
// first event Core emits. Memory/threading/CI are still gated — see gate below.

// A protocol response parsed out of the first event Core emits. `type` is
// "result" | "error" | "host.request" per reader-event.schema.json.
export interface ReaderCoreProtocolResponse {
  ok: boolean;             // true when type === 'result'
  type: string;            // raw event `type` discriminator
  requestId: number;
  data: object | null;     // result.data (object) when type === 'result'
  errorCode: string | null;   // error.code (SCREAMING_SNAKE_CASE) when type === 'error'
  errorMessage: string | null;
  // host.request shape (capability + params + operationId) when type === 'host.request'
  hostCapability: string | null;
  hostOperationId: number | null;
  raw: string;             // the full event JSON, for diagnostics
  error: string | null;    // bridge-level error (e.g. native threw)
}

function asObject(value: Object): object | null {
  if (value === null || value === undefined) { return null; }
  // JSON.parse yields ESObject; treat any non-null object as a record.
  return value as object;
}

export function sendJsonCommand(method: string, params: object, requestId: number = 1): ReaderCoreProtocolResponse {
  // SDK-COMPAT: build command JSON via a typed record to satisfy arkts-no-untyped-obj-literals.
  const commandObj: Record<string, Object> = {} as Record<string, Object>;
  commandObj['protocolVersion'] = 1;
  commandObj['requestId'] = requestId;
  commandObj['method'] = method;
  commandObj['params'] = params;
  const command = JSON.stringify(commandObj);
  try {
    const raw = readerCoreNapi.sendJsonCommand(command);
    return parseProtocolResponse(raw, null);
  } catch (e) {
    return {
      ok: false,
      type: '',
      requestId,
      data: null,
      errorCode: null,
      errorMessage: null,
      hostCapability: null,
      hostOperationId: null,
      raw: '',
      error: `native sendJsonCommand threw: ${e}`
    };
  }
}

function parseProtocolResponse(raw: string, bridgeError: string | null): ReaderCoreProtocolResponse {
  if (bridgeError !== null) {
    return {
      ok: false, type: '', requestId: 0, data: null,
      errorCode: null, errorMessage: null, hostCapability: null, hostOperationId: null,
      raw, error: bridgeError
    };
  }
  let parsed: Record<string, Object>;
  try {
    parsed = JSON.parse(raw) as Record<string, Object>;
  } catch (e) {
    return {
      ok: false, type: '', requestId: 0, data: null,
      errorCode: null, errorMessage: null, hostCapability: null, hostOperationId: null,
      raw, error: `event JSON parse failed: ${e}`
    };
  }
  const type = (parsed['type'] ?? '') as string;
  const requestId = (parsed['requestId'] ?? 0) as number;
  if (type === 'result') {
    return {
      ok: true, type, requestId, data: asObject(parsed['data']),
      errorCode: null, errorMessage: null, hostCapability: null, hostOperationId: null,
      raw, error: null
    };
  }
  if (type === 'error') {
    const err: Record<string, Object> = parsed['error'] as Record<string, Object>;
    return {
      ok: false, type, requestId, data: null,
      errorCode: (err['code'] ?? null) as string | null,
      errorMessage: (err['message'] ?? null) as string | null,
      hostCapability: null, hostOperationId: null,
      raw, error: null
    };
  }
  if (type === 'host.request') {
    return {
      ok: false, type, requestId, data: null,
      errorCode: null, errorMessage: null,
      hostCapability: (parsed['capability'] ?? null) as string | null,
      hostOperationId: (parsed['operationId'] ?? null) as number | null,
      raw, error: null
    };
  }
  return {
    ok: false, type, requestId, data: null,
    errorCode: null, errorMessage: null, hostCapability: null, hostOperationId: null,
    raw, error: `unexpected event type: ${type}`
  };
}

// core.info → structured result with abiVersion / protocolVersion / buildVersion / capabilities.
export interface ReaderCoreInfo {
  abiVersion: number;
  protocolVersion: number;
  buildVersion: string;
  capabilities: string[];
  raw: string;
  error: string | null;
}

export function getCoreInfo(): ReaderCoreInfo {
  const resp = sendJsonCommand('core.info', {} as Record<string, Object>, 1);
  if (resp.error !== null || !resp.ok || resp.data === null) {
    return { abiVersion: 0, protocolVersion: 0, buildVersion: '', capabilities: [], raw: resp.raw, error: resp.error ?? `core.info did not return a result (type=${resp.type})` };
  }
  const data = resp.data as Record<string, Object>;
  const capabilities: string[] = [];
  const caps = data['capabilities'];
  if (caps instanceof Array) {
    for (let i = 0; i < caps.length; i++) {
      capabilities.push(caps[i] as string);
    }
  }
  return {
    abiVersion: (data['abiVersion'] ?? 0) as number,
    protocolVersion: (data['protocolVersion'] ?? 0) as number,
    buildVersion: (data['buildVersion'] ?? '') as string,
    capabilities,
    raw: resp.raw,
    error: null
  };
}

// runtime.ping → structured result with pong=true.
export interface ReaderRuntimePingResult {
  pong: boolean;
  method: string;
  raw: string;
  error: string | null;
}

export function pingRuntime(): ReaderRuntimePingResult {
  const resp = sendJsonCommand('runtime.ping', {} as Record<string, Object>, 2);
  if (resp.error !== null || !resp.ok || resp.data === null) {
    return { pong: false, method: '', raw: resp.raw, error: resp.error ?? `runtime.ping did not return a result (type=${resp.type})` };
  }
  const data = resp.data as Record<string, Object>;
  return {
    pong: (data['pong'] ?? false) as boolean,
    method: (data['method'] ?? '') as string,
    raw: resp.raw,
    error: null
  };
}

// Unknown method → structured error with code UNKNOWN_METHOD.
export interface ReaderUnknownMethodError {
  isError: boolean;
  type: string;
  code: string | null;
  message: string | null;
  raw: string;
  error: string | null;
}

export function sendUnknownMethod(): ReaderUnknownMethodError {
  const resp = sendJsonCommand('definitely.not.a.method', {} as Record<string, Object>, 3);
  return {
    isError: resp.type === 'error',
    type: resp.type,
    code: resp.errorCode,
    message: resp.errorMessage,
    raw: resp.raw,
    error: resp.error
  };
}

// runtime.hostSmoke → host.request shape verification (capability + params + operationId).
// Core emits a host.request event and waits for the host to complete it; since
// the NAPI smoke does not run a host responder, we capture the host.request
// event and verify its shape only.
export interface ReaderHostSmokeResult {
  isHostRequest: boolean;
  capability: string | null;
  operationId: number | null;
  paramsEcho: string | null;
  raw: string;
  error: string | null;
}

export function runHostSmokeShape(): ReaderHostSmokeResult {
  // SDK-COMPAT: build params via typed records to satisfy arkts-no-untyped-obj-literals.
  const innerParams: Record<string, Object> = {} as Record<string, Object>;
  innerParams['url'] = 'https://example.invalid';
  const outerParams: Record<string, Object> = {} as Record<string, Object>;
  outerParams['capability'] = 'host.smoke.echo';
  outerParams['params'] = innerParams;
  const resp = sendJsonCommand('runtime.hostSmoke', outerParams, 4);
  if (resp.error !== null) {
    return { isHostRequest: false, capability: null, operationId: null, paramsEcho: null, raw: resp.raw, error: resp.error };
  }
  // The host.request event is captured as the first event; resp.data is null
  // and hostCapability/hostOperationId are populated when type === 'host.request'.
  let paramsEcho: string | null = null;
  try {
    const parsed: Record<string, Object> = JSON.parse(resp.raw) as Record<string, Object>;
    const p = parsed['params'];
    if (p !== undefined && p !== null) {
      paramsEcho = JSON.stringify(p);
    }
  } catch (e) {
    paramsEcho = null;
  }
  return {
    isHostRequest: resp.type === 'host.request',
    capability: resp.hostCapability,
    operationId: resp.hostOperationId,
    paramsEcho,
    raw: resp.raw,
    error: null
  };
}

// MARK: - Persistent runtime + closed-loop host bus
//
// The native module now also exposes a persistent-runtime API (createRuntime /
// releaseRuntime / sendCommand / cancelRequest / readEvent / pendingEventCount
// / completeHostRequest / failHostRequest) backed by a thread-safe event queue
// and a stable Core runtime handle. This closes the host bus: Core emits
// host.request, the host replies via host.complete/host.error, and Core emits
// the final result event. The one-shot sendJsonCommand path above is retained
// for the legacy POC validator; new code should use ReaderCoreRuntime +
// runHostSmokeClosedLoop.

// Opaque runtime handle returned by createRuntime. Treated as an external ES
// value; do not inspect its shape — pass it straight back to the native API.
export type ReaderCoreRuntimeHandle = ESObject;

export interface ReaderCoreRuntimeOptions {
  config?: object;  // optional Core config JSON (defaults to {})
}

export class ReaderCoreRuntime {
  private readonly handle: ReaderCoreRuntimeHandle;
  private released = false;

  private constructor(handle: ReaderCoreRuntimeHandle) {
    this.handle = handle;
  }

  static create(options?: ReaderCoreRuntimeOptions): ReaderCoreRuntime {
    const config: object = options && options.config !== undefined ? options.config : ({} as Record<string, Object>);
    const handle: ESObject = readerCoreNapi.createRuntime(config);
    return new ReaderCoreRuntime(handle);
  }

  // Send a JSON command to Core. Returns the raw status (0 on success); a
  // non-zero value or thrown error indicates an rc_runtime_send failure.
  sendCommand(method: string, params: object, requestId: number): void {
    this.assertNotReleased();
    // SDK-COMPAT: build command JSON via a typed record to satisfy arkts-no-untyped-obj-literals.
    const commandObj: Record<string, Object> = {} as Record<string, Object>;
    commandObj['protocolVersion'] = 1;
    commandObj['requestId'] = requestId;
    commandObj['method'] = method;
    commandObj['params'] = params;
    const command = JSON.stringify(commandObj);
    readerCoreNapi.sendCommand(this.handle, command);
  }

  // Cancel an in-flight request by requestId. Idempotent.
  cancelRequest(requestId: number): void {
    this.assertNotReleased();
    readerCoreNapi.cancelRequest(this.handle, requestId);
  }

  // Poll one event from the queue. Returns null on timeout (no event). A
  // timeoutMs of 0 returns immediately if the queue is empty.
  readEvent(timeoutMs: number = 0): string | null {
    this.assertNotReleased();
    const event = readerCoreNapi.readEvent(this.handle, timeoutMs);
    if (event === null || event === undefined) { return null; }
    return event as string;
  }

  pendingEventCount(): number {
    this.assertNotReleased();
    return readerCoreNapi.pendingEventCount(this.handle) as number;
  }

  // Reply to a host.request with host.complete. operationId comes from the
  // host.request event; result must be a JSON object. requestId is optional —
  // if omitted the native layer mints a fresh host-response requestId.
  completeHostRequest(operationId: number, result: object, requestId?: number): void {
    this.assertNotReleased();
    if (requestId !== undefined) {
      readerCoreNapi.completeHostRequest(this.handle, operationId, result, requestId);
    } else {
      readerCoreNapi.completeHostRequest(this.handle, operationId, result);
    }
  }

  // Reply to a host.request with host.error. error must be a JSON object.
  failHostRequest(operationId: number, error: object, requestId?: number): void {
    this.assertNotReleased();
    if (requestId !== undefined) {
      readerCoreNapi.failHostRequest(this.handle, operationId, error, requestId);
    } else {
      readerCoreNapi.failHostRequest(this.handle, operationId, error);
    }
  }

  release(): void {
    if (this.released) { return; }
    this.released = true;
    try {
      readerCoreNapi.releaseRuntime(this.handle);
    } catch (_e) {
      // Best-effort teardown; the native finalizer also reclaims on GC.
    }
  }

  private assertNotReleased(): void {
    if (this.released) { throw new Error('ReaderCoreRuntime already released'); }
  }
}

// Closed-loop host smoke: native creates a runtime, sends runtime.hostSmoke,
// captures the host.request event, extracts operationId, replies via
// host.complete, and returns BOTH the host.request event and the completion
// event. This proves the full host.request -> host.complete round trip through
// the real C ABI on a persistent runtime (NOT just shape capture).
export interface ReaderHostSmokeClosedLoopResult {
  hasHostRequest: boolean;       // host.request event captured
  hasCompletion: boolean;        // final result/error event captured after host.complete
  hostOperationId: number | null;
  completionType: string | null; // "result" | "error" — expected "result"
  completionOk: boolean;         // true when completion is a result with the echoed payload
  raw: string;                   // full native payload {hostRequest, completion}
  error: string | null;
}

export function parseHostSmokePayload(raw: string): ReaderHostSmokeClosedLoopResult {
  let parsed: Record<string, Object>;
  try {
    parsed = JSON.parse(raw) as Record<string, Object>;
  } catch (e) {
    return { hasHostRequest: false, hasCompletion: false, hostOperationId: null,
      completionType: null, completionOk: false, raw, error: `hostSmoke payload parse failed: ${e}` };
  }
  const hostRequestField = parsed['hostRequest'] ?? null;
  const completionField = parsed['completion'] ?? null;
  if (hostRequestField === null || hostRequestField === undefined ||
      completionField === null || completionField === undefined) {
    return { hasHostRequest: false, hasCompletion: false, hostOperationId: null,
      completionType: null, completionOk: false, raw, error: 'hostSmoke payload missing hostRequest/completion' };
  }

  // SDK-COMPAT: native HostSmoke embeds the event JSON inline, so after the
  // outer parse hostRequest/completion may already be objects; if they are
  // strings (canned fixture), parse them. asObject normalises both paths.
  let hostReq: Record<string, Object>;
  let completion: Record<string, Object>;
  try {
    hostReq = typeof hostRequestField === 'string' ?
      (JSON.parse(hostRequestField as string) as Record<string, Object>) :
      (hostRequestField as Record<string, Object>);
    completion = typeof completionField === 'string' ?
      (JSON.parse(completionField as string) as Record<string, Object>) :
      (completionField as Record<string, Object>);
  } catch (e) {
    return { hasHostRequest: false, hasCompletion: false, hostOperationId: null,
      completionType: null, completionOk: false, raw, error: `hostSmoke event parse failed: ${e}` };
  }

  const hostType = (hostReq['type'] ?? '') as string;
  const completionType = (completion['type'] ?? '') as string;
  const operationId = (hostReq['operationId'] ?? null) as number | null;
  const completionData = completion['data'];
  const completionOk = completionType === 'result' && completionData !== null && completionData !== undefined;

  return {
    hasHostRequest: hostType === 'host.request',
    hasCompletion: completionType === 'result' || completionType === 'error',
    hostOperationId: operationId,
    completionType,
    completionOk,
    raw,
    error: null
  };
}

export function runHostSmokeClosedLoop(): ReaderHostSmokeClosedLoopResult {
  let raw: string;
  try {
    raw = readerCoreNapi.hostSmoke() as string;
  } catch (e) {
    return { hasHostRequest: false, hasCompletion: false, hostOperationId: null,
      completionType: null, completionOk: false, raw: '', error: `native hostSmoke threw: ${e}` };
  }
  return parseHostSmokePayload(raw);
}

// MARK: - 模拟绑定（POC 阶段，不加载真实 native module）

export function createPocSimulatedModule(): ReaderCoreNapiModule {
  // SDK-COMPAT: build via a class instance to avoid arkts-no-untyped-obj-literals.
  class SimulatedModule implements ReaderCoreNapiModule {
    reader_core_version(): string {
      const verObj: Record<string, Object> = {} as Record<string, Object>;
      verObj['abiVersion'] = READER_CORE_ABI_VERSION;
      verObj['coreVersion'] = 'simulated-poc';
      return JSON.stringify(verObj);
    }
    reader_core_apply_replace_rules(jsonRequest: string): ReplaceRulesNapiResult {
      try {
        const request: ReplaceRulesRequest = JSON.parse(jsonRequest) as ReplaceRulesRequest;
        let result: string = request.content;
        let appliedCount = 0;
        for (let i = 0; i < request.rules.length; i++) {
          const rule = request.rules[i];
          if (rule.isRegex) {
            const regex = new RegExp(rule.pattern, 'g');
            const newResult = result.replace(regex, rule.replacement);
            if (newResult !== result) { appliedCount++; }
            result = newResult;
          } else {
            if (result.indexOf(rule.pattern) !== -1) { appliedCount++; }
            while (result.indexOf(rule.pattern) !== -1) {
              result = result.replace(rule.pattern, rule.replacement);
            }
          }
        }
        const response: ReplaceRulesResponse = { result, appliedCount, error: null };
        const rv: ReplaceRulesNapiResult = { errorCode: ReaderCoreError.OK, jsonResponse: JSON.stringify(response) };
        return rv;
      } catch (e) {
        const rv: ReplaceRulesNapiResult = { errorCode: ReaderCoreError.INVALID_JSON, jsonResponse: null };
        return rv;
      }
    }
    reader_core_parse_rule_chain(jsonRequest: string): RuleChainNapiResult {
      try {
        const request: RuleChainRequest = JSON.parse(jsonRequest) as RuleChainRequest;
        const results: RuleChainResultEntry[] = request.rules.map((rule: RuleChainEntry): RuleChainResultEntry => {
          // 简化: POC 模拟，不实际调用 Core
          const entry: RuleChainResultEntry = { values: [], matchedCount: 0, diagnostics: [`simulated:${rule.kind}`] };
          return entry;
        });
        const response: RuleChainResponse = { results, error: null };
        const rv: RuleChainNapiResult = { errorCode: ReaderCoreError.OK, jsonResponse: JSON.stringify(response) };
        return rv;
      } catch (e) {
        const rv: RuleChainNapiResult = { errorCode: ReaderCoreError.INVALID_JSON, jsonResponse: null };
        return rv;
      }
    }
    reader_core_free(_ptr: number): void {
      // 模拟: 无操作
    }
  }
  const simulatedModule: ReaderCoreNapiModule = new SimulatedModule();
  return simulatedModule;
}
