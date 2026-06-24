// ReaderCoreNapiBridge - Phase 3 C ABI/NAPI POC ArkTS 绑定骨架。
//
// HOS-ADR-001: C ABI/NAPI 为长期可选轨道，先做 POC。
// 本文件为 NAPI 绑定骨架，不包含实际 native module 加载（POC 阶段）。
//
// 硬性门槛: 只有 Toolchain/ABI/Memory/Threading/Security/CI 全部通过才能进入主线。
import readerCoreNapi from 'libreader_core_napi.so';

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

export interface ReplaceRulesRequest {
  content: string;
  rules: Array<{
    id: string;
    pattern: string;
    replacement: string;
    isRegex: boolean;
  }>;
}

export interface ReplaceRulesResponse {
  result: string;
  appliedCount: number;
  error: string | null;
}

export interface RuleChainRequest {
  rules: Array<{
    kind: 'css' | 'xpath' | 'jsonpath' | 'template' | 'regex';
    expression: string;
    input: string;
  }>;
}

export interface RuleChainResponse {
  results: Array<{
    values: string[];
    matchedCount: number;
    diagnostics: string[];
  }>;
  error: string | null;
}

// MARK: - NAPI 绑定接口（POC 骨架）

export interface ReaderCoreNapiModule {
  reader_core_version(): string;
  reader_core_apply_replace_rules(jsonRequest: string): { errorCode: ReaderCoreError; jsonResponse: string | null };
  reader_core_parse_rule_chain(jsonRequest: string): { errorCode: ReaderCoreError; jsonResponse: string | null };
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
  const command = JSON.stringify({ protocolVersion: 1, requestId, method, params });
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
  let parsed: ESObject;
  try {
    parsed = JSON.parse(raw);
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
    const err = parsed['error'];
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
  const resp = sendJsonCommand('core.info', {}, 1);
  if (resp.error !== null || !resp.ok || resp.data === null) {
    return { abiVersion: 0, protocolVersion: 0, buildVersion: '', capabilities: [], raw: resp.raw, error: resp.error ?? `core.info did not return a result (type=${resp.type})` };
  }
  const data = resp.data as ESObject;
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
  const resp = sendJsonCommand('runtime.ping', {}, 2);
  if (resp.error !== null || !resp.ok || resp.data === null) {
    return { pong: false, method: '', raw: resp.raw, error: resp.error ?? `runtime.ping did not return a result (type=${resp.type})` };
  }
  const data = resp.data as ESObject;
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
  const resp = sendJsonCommand('definitely.not.a.method', {}, 3);
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
  const resp = sendJsonCommand('runtime.hostSmoke', { capability: 'host.smoke.echo', params: { url: 'https://example.invalid' } }, 4);
  if (resp.error !== null) {
    return { isHostRequest: false, capability: null, operationId: null, paramsEcho: null, raw: resp.raw, error: resp.error };
  }
  // The host.request event is captured as the first event; resp.data is null
  // and hostCapability/hostOperationId are populated when type === 'host.request'.
  let paramsEcho: string | null = null;
  try {
    const parsed: ESObject = JSON.parse(resp.raw);
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

// MARK: - 模拟绑定（POC 阶段，不加载真实 native module）

export function createPocSimulatedModule(): ReaderCoreNapiModule {
  return {
    reader_core_version(): string {
      return JSON.stringify({ abiVersion: READER_CORE_ABI_VERSION, coreVersion: 'simulated-poc' });
    },
    reader_core_apply_replace_rules(jsonRequest: string): { errorCode: ReaderCoreError; jsonResponse: string | null } {
      try {
        const request: ReplaceRulesRequest = JSON.parse(jsonRequest);
        let result = request.content;
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
        return { errorCode: ReaderCoreError.OK, jsonResponse: JSON.stringify(response) };
      } catch (e) {
        return { errorCode: ReaderCoreError.INVALID_JSON, jsonResponse: null };
      }
    },
    reader_core_parse_rule_chain(jsonRequest: string): { errorCode: ReaderCoreError; jsonResponse: string | null } {
      try {
        const request: RuleChainRequest = JSON.parse(jsonRequest);
        const results = request.rules.map(rule => {
          // 简化: POC 模拟，不实际调用 Core
          return { values: [], matchedCount: 0, diagnostics: [`simulated:${rule.kind}`] };
        });
        const response: RuleChainResponse = { results, error: null };
        return { errorCode: ReaderCoreError.OK, jsonResponse: JSON.stringify(response) };
      } catch (e) {
        return { errorCode: ReaderCoreError.INVALID_JSON, jsonResponse: null };
      }
    },
    reader_core_free(_ptr: number): void {
      // 模拟: 无操作
    }
  };
}
