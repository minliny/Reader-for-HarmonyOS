// CAbiPocValidator - Phase 3 C ABI/NAPI POC 门槛校验测试。
// 验证 POC 门槛判定正确，模拟绑定行为正确。

import {
  CAbiPocStatus,
  ReaderCoreError,
  ReplaceRulesRequest,
  ReplaceRulesResponse,
  RuleChainRequest,
  RuleChainResponse,
  createPocSimulatedModule,
  evaluateCAbiPocGate,
  getCoreInfo,
  pingRuntime,
  readerCoreErrorName,
  runHostSmokeShape,
  runReaderCoreNativeSmoke,
  sendUnknownMethod
} from '../cabi/ReaderCoreNapiBridge';

interface TestResult { name: string; passed: boolean; error?: string; }

class TestRunner {
  results: TestResult[] = [];
  passed: number = 0;
  failed: number = 0;
  assert(c: boolean, n: string, e?: string): void {
    this.results.push({ name: n, passed: c, error: c ? undefined : e });
    if (c) { this.passed++; } else { this.failed++; }
  }
  summary(): string { return `${this.passed}P ${this.failed}F / ${this.results.length}`; }
}

export function runCAbiPocValidatorTests(): TestRunner {
  const r = new TestRunner();

  // ---------- POC 门槛校验 ----------
  const gate = evaluateCAbiPocGate();
  r.assert(gate.status === CAbiPocStatus.abiStable || gate.status === CAbiPocStatus.securityGated, `poc status abiStable/securityGated (got ${gate.status})`);
  r.assert(gate.toolchainReady === true, 'poc toolchain ready');
  r.assert(gate.abiStable === true, 'poc abi smoke stable');
  r.assert(gate.memoryOwned === false, 'poc memory not owned');
  r.assert(gate.threadingSafe === false, 'poc threading not safe');
  r.assert(gate.securityGated === true, 'poc security gated (declared in interface)');
  r.assert(gate.ciGreen === false, 'poc ci not green');
  r.assert(gate.canEnterMainline === false, 'poc cannot enter mainline');
  r.assert(gate.blockingReasons.length >= 3, `poc has >=3 blocking reasons (got ${gate.blockingReasons.length})`);
  r.assert(gate.blockingReasons.indexOf('toolchain: native module not built') === -1, 'poc no longer blocking toolchain');
  r.assert(gate.blockingReasons.indexOf('abi: stability not verified') === -1, 'poc no longer blocking abi smoke');
  r.assert(gate.blockingReasons.indexOf('memory: ownership not verified') !== -1, 'poc blocking memory');
  r.assert(gate.blockingReasons.indexOf('threading: safety not verified') !== -1, 'poc blocking threading');
  r.assert(gate.blockingReasons.indexOf('ci: not green') !== -1, 'poc blocking ci');

  // ---------- Native smoke: real NAPI -> Rust C ABI ----------
  const nativeSmoke = runReaderCoreNativeSmoke();
  r.assert(nativeSmoke.toolchainReady === true, `native smoke toolchain ready (${nativeSmoke.error})`);
  r.assert(nativeSmoke.abiVersion === 1, `native smoke abiVersion 1 (got ${nativeSmoke.abiVersion})`);
  r.assert(nativeSmoke.pingPong === true, `native smoke core.ping result (${nativeSmoke.pingJSON})`);

  // ---------- NAPI runtime smoke: JSON protocol over C ABI ----------
  // These exercise the real Reader-Core JSON protocol (core.info, runtime.ping,
  // unknown method, runtime.hostSmoke host.request shape) through the NAPI
  // sendJsonCommand bridge. "so packaged into HAP" is verified separately by
  // unzipping the built HAP (see docs NAPI runtime smoke report); here we
  // prove the ArkTS side can import the native module, read abiVersion, and
  // receive structured results/errors.
  // core.info → structured result
  try {
    const info = getCoreInfo();
    r.assert(info.error === null, `core.info no error (${info.error})`);
    r.assert(info.abiVersion === 1, `core.info abiVersion 1 (got ${info.abiVersion})`);
    r.assert(info.protocolVersion === 1, `core.info protocolVersion 1 (got ${info.protocolVersion})`);
    r.assert(info.buildVersion.length > 0, `core.info buildVersion non-empty (got ${info.buildVersion})`);
    r.assert(info.capabilities.indexOf('core.info') !== -1, `core.info advertises core.info (got ${info.capabilities})`);
    r.assert(info.capabilities.indexOf('runtime.ping') !== -1, `core.info advertises runtime.ping`);
    r.assert(info.capabilities.indexOf('runtime.hostSmoke') !== -1, `core.info advertises runtime.hostSmoke`);
  } catch (e) {
    r.assert(false, `core.info threw: ${e}`);
  }

  // runtime.ping → structured result with pong=true
  try {
    const ping = pingRuntime();
    r.assert(ping.error === null, `runtime.ping no error (${ping.error})`);
    r.assert(ping.pong === true, `runtime.ping pong true (raw ${ping.raw})`);
    r.assert(ping.method === 'runtime.ping', `runtime.ping method runtime.ping (got ${ping.method})`);
  } catch (e) {
    r.assert(false, `runtime.ping threw: ${e}`);
  }

  // unknown method → structured error with code UNKNOWN_METHOD
  try {
    const unknown = sendUnknownMethod();
    r.assert(unknown.error === null, `unknown method bridge no error (${unknown.error})`);
    r.assert(unknown.isError === true, `unknown method is error event (type ${unknown.type})`);
    r.assert(unknown.code === 'UNKNOWN_METHOD', `unknown method code UNKNOWN_METHOD (got ${unknown.code})`);
    r.assert(unknown.message !== null && unknown.message.length > 0, `unknown method message non-null`);
  } catch (e) {
    r.assert(false, `unknown method threw: ${e}`);
  }

  // runtime.hostSmoke → host.request shape (capability + operationId + params)
  try {
    const host = runHostSmokeShape();
    r.assert(host.error === null, `host smoke no error (${host.error})`);
    r.assert(host.isHostRequest === true, `host smoke is host.request event (raw ${host.raw})`);
    r.assert(host.capability === 'host.smoke.echo', `host smoke capability echoed (got ${host.capability})`);
    r.assert(host.operationId !== null && host.operationId >= 1, `host smoke operationId >=1 (got ${host.operationId})`);
    r.assert(host.paramsEcho !== null && host.paramsEcho.indexOf('https://example.invalid') !== -1, `host smoke params echoed (got ${host.paramsEcho})`);
  } catch (e) {
    r.assert(false, `host smoke threw: ${e}`);
  }

  // ---------- 错误码命名 ----------
  r.assert(readerCoreErrorName(ReaderCoreError.OK) === 'OK', 'error name OK');
  r.assert(readerCoreErrorName(ReaderCoreError.INVALID_JSON) === 'INVALID_JSON', 'error name INVALID_JSON');
  r.assert(readerCoreErrorName(ReaderCoreError.RULE_EVALUATION_FAILED) === 'RULE_EVALUATION_FAILED', 'error name RULE_EVALUATION_FAILED');
  r.assert(readerCoreErrorName(ReaderCoreError.ABI_VERSION_MISMATCH) === 'ABI_VERSION_MISMATCH', 'error name ABI_VERSION_MISMATCH');

  // ---------- 模拟模块: version ----------
  const mod = createPocSimulatedModule();
  const versionStr = mod.reader_core_version();
  r.assert(versionStr.length > 0, 'version string non-empty');
  const versionObj = JSON.parse(versionStr);
  r.assert(versionObj.abiVersion === 1, 'version abiVersion 1');
  r.assert(versionObj.coreVersion === 'simulated-poc', 'version coreVersion simulated-poc');

  // ---------- 模拟模块: apply_replace_rules ----------
  const request: ReplaceRulesRequest = {
    content: '广告内容[img]123[/img]',
    rules: [
      { id: 'r1', pattern: '广告', replacement: '', isRegex: false },
      { id: 'r2', pattern: '\\[img\\]\\d+\\[/img\\]', replacement: '[图片]', isRegex: true }
    ]
  };
  const replaceResult = mod.reader_core_apply_replace_rules(JSON.stringify(request));
  r.assert(replaceResult.errorCode === ReaderCoreError.OK, 'replace rules OK');
  r.assert(replaceResult.jsonResponse !== null, 'replace rules response non-null');
  const replaceResponse: ReplaceRulesResponse = JSON.parse(replaceResult.jsonResponse!);
  r.assert(replaceResponse.error === null, 'replace rules no error');
  r.assert(replaceResponse.appliedCount === 2, `replace rules applied 2 (got ${replaceResponse.appliedCount})`);
  r.assert(replaceResponse.result === '内容[图片]', `replace rules result match (got ${replaceResponse.result})`);

  // ---------- 模拟模块: apply_replace_rules invalid JSON ----------
  const invalidResult = mod.reader_core_apply_replace_rules('not json');
  r.assert(invalidResult.errorCode === ReaderCoreError.INVALID_JSON, 'replace rules invalid JSON');
  r.assert(invalidResult.jsonResponse === null, 'replace rules invalid JSON null response');

  // ---------- 模拟模块: parse_rule_chain ----------
  const chainRequest: RuleChainRequest = {
    rules: [
      { kind: 'css', expression: '.body', input: '<p class="body">Text</p>' },
      { kind: 'regex', expression: '\\d+', input: 'abc123' }
    ]
  };
  const chainResult = mod.reader_core_parse_rule_chain(JSON.stringify(chainRequest));
  r.assert(chainResult.errorCode === ReaderCoreError.OK, 'rule chain OK');
  r.assert(chainResult.jsonResponse !== null, 'rule chain response non-null');
  const chainResponse: RuleChainResponse = JSON.parse(chainResult.jsonResponse!);
  r.assert(chainResponse.error === null, 'rule chain no error');
  r.assert(chainResponse.results.length === 2, `rule chain 2 results (got ${chainResponse.results.length})`);
  r.assert(chainResponse.results[0].diagnostics.length > 0, 'rule chain result 0 has diagnostics');

  // ---------- 模拟模块: parse_rule_chain invalid JSON ----------
  const invalidChainResult = mod.reader_core_parse_rule_chain('not json');
  r.assert(invalidChainResult.errorCode === ReaderCoreError.INVALID_JSON, 'rule chain invalid JSON');
  r.assert(invalidChainResult.jsonResponse === null, 'rule chain invalid JSON null response');

  // ---------- 模拟模块: free ----------
  mod.reader_core_free(0); // 不应崩溃
  r.assert(true, 'reader_core_free safe on 0');

  // ---------- 安全约束验证 ----------
  // ABI 层不应有网络/文件/cookie/credential 接口
  r.assert(!('reader_core_http_get' in mod), 'abi no http_get');
  r.assert(!('reader_core_file_read' in mod), 'abi no file_read');
  r.assert(!('reader_core_cookie_get' in mod), 'abi no cookie_get');
  r.assert(!('reader_core_credential_get' in mod), 'abi no credential_get');

  return r;
}
