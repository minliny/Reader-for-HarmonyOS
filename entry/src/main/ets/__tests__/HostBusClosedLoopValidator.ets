// HostBusClosedLoopValidator — headless-only validation of the closed-loop
// host bus payload parser (parseHostSmokePayload).
//
// Tier: HEADLESS. This validator does NOT load libreader_core_napi.so. It feeds
// canned native payloads through the pure ArkTS parser to prove the
// host.request -> host.complete round-trip result is parsed correctly: both
// events present, completion is a `result`, operationId threads through, and
// malformed payloads are rejected. The real native hostSmoke() execution
// (which actually drives rc_runtime_send host.complete) is a separate
// emulator/real-device tier concern — see runHostSmokeClosedLoop().

import { parseHostSmokePayload, ReaderHostSmokeClosedLoopResult } from '../cabi/ReaderCoreNapiBridge';

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

function makePayload(hostRequest: string, completion: string): string {
  // SDK-COMPAT: build JSON string directly to avoid arkts-no-untyped-obj-literals
  return `{"hostRequest":${JSON.stringify(hostRequest)},"completion":${JSON.stringify(completion)}}`;
}

// A well-formed closed loop: Core emits host.request with operationId=7, the
// host replies via host.complete, Core emits a final result event echoing the
// host-provided result payload. Kept as raw JSON strings to satisfy ArkTS
// strict object-literal typing.
const OK_HOST_REQUEST = '{"type":"host.request","requestId":10,"operationId":7,"capability":"host.smoke.echo","params":{"status":"ok"}}';
const OK_COMPLETION = '{"type":"result","requestId":10,"data":{"status":"ok","source":"harmony-napi"}}';

export function runHostBusClosedLoopTests(): TestRunner {
  const r = new TestRunner();

  // ---------- well-formed closed loop ----------
  const ok = parseHostSmokePayload(makePayload(OK_HOST_REQUEST, OK_COMPLETION));
  r.assert(ok.error === null, `ok no error (${ok.error})`);
  r.assert(ok.hasHostRequest === true, 'ok hasHostRequest true');
  r.assert(ok.hasCompletion === true, 'ok hasCompletion true');
  r.assert(ok.hostOperationId === 7, `ok operationId 7 (got ${ok.hostOperationId})`);
  r.assert(ok.completionType === 'result', `ok completionType result (got ${ok.completionType})`);
  r.assert(ok.completionOk === true, 'ok completionOk true');

  // ---------- host.error path: host replies with host.error -> error event ----------
  // SDK-COMPAT: raw JSON string to satisfy arkts-no-untyped-obj-literals.
  const errCompletion = '{"type":"error","requestId":10,"error":{"code":"HOST_FAILED","message":"boom"}}';
  const errRes = parseHostSmokePayload(makePayload(OK_HOST_REQUEST, errCompletion));
  r.assert(errRes.error === null, `err no parse error (${errRes.error})`);
  r.assert(errRes.hasHostRequest === true, 'err hasHostRequest true');
  r.assert(errRes.hasCompletion === true, 'err hasCompletion true (error is a completion)');
  r.assert(errRes.completionType === 'error', `err completionType error (got ${errRes.completionType})`);
  r.assert(errRes.completionOk === false, 'err completionOk false (error is not a result)');

  // ---------- missing completion ----------
  // SDK-COMPAT: raw JSON string to satisfy arkts-no-untyped-obj-literals.
  const missingCompletion = parseHostSmokePayload(`{"hostRequest":${JSON.stringify(OK_HOST_REQUEST)}}`);
  r.assert(missingCompletion.error !== null, `missing completion reports error (${missingCompletion.error})`);
  r.assert(missingCompletion.hasHostRequest === false, 'missing completion hasHostRequest false (payload rejected)');

  // ---------- missing hostRequest ----------
  const missingHost = parseHostSmokePayload(`{"completion":${JSON.stringify(OK_COMPLETION)}}`);
  r.assert(missingHost.error !== null, `missing hostRequest reports error (${missingHost.error})`);
  r.assert(missingHost.hasHostRequest === false, 'missing hostRequest hasHostRequest false');

  // ---------- malformed top-level payload ----------
  const badTop = parseHostSmokePayload('not json');
  r.assert(badTop.error !== null, `malformed top-level reports error (${badTop.error})`);
  r.assert(badTop.hasHostRequest === false, 'malformed top-level hasHostRequest false');

  // ---------- malformed inner event ----------
  const badInner = parseHostSmokePayload(makePayload('{ not json', OK_COMPLETION));
  r.assert(badInner.error !== null, `malformed inner event reports error (${badInner.error})`);
  r.assert(badInner.hasHostRequest === false, 'malformed inner event hasHostRequest false');

  // ---------- host.request missing operationId ----------
  // SDK-COMPAT: raw JSON string to satisfy arkts-no-untyped-obj-literals.
  const noOpIdHost = '{"type":"host.request","requestId":10,"capability":"host.smoke.echo","params":{}}';
  const noOpId = parseHostSmokePayload(makePayload(noOpIdHost, OK_COMPLETION));
  r.assert(noOpId.hasHostRequest === true, 'no-opId host still recognized as host.request');
  r.assert(noOpId.hostOperationId === null, `no-opId operationId null (got ${noOpId.hostOperationId})`);

  return r;
}
