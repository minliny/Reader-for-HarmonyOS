// HostMediaDownloadProof — headless proof for the media.download lane (item 5b).
//
// Tier: HANDLER/ROUTER. Mirrors HostAntiBotProof.ets / HostWebViewRenderProof.ets
// pattern: calls the capability handler directly with StubMediaDownloadExecutor
// (no libreader_core_napi.so, no HostRuntime/HostAdapter dispatch, no real
// @ohos.net.http runtime).
//
// (1) This is handler/router tier proof — verifies the handler-layer plumbing
//     (request parsing, scheme/method/range validation, executor delegation,
//     response building) against the Core contract in
//     crates/reader-contract/src/host.rs (HostMediaDownloadRequest /
//     HostMediaDownloadResponse, commit 3e4fcb7b).
//
// (2) Device-headless/App tier (real media.download L1-L5) requires
//     @ohos.net.http + filesystem cache + DevEco Studio emulator — pending
//     device proof, out of scope for this increment.
//
// (3) Mirrors iOS/Android proof structure: media.download handler parity
//     target (3/3) uses the same stub-executor + canned-response approach for
//     handler/router proof.
//
// (4) WHY stub executor (not real @ohos.net.http): headless proof verifies
//     handler-layer plumbing (param parsing, validation rules, executor
//     delegation, response field threading) without depending on the device
//     network/filesystem runtime. The ArkMediaDownloadExecutor (production)
//     throws not_implemented — the real backend will be wired in a future
//     increment. The stub executor lets us prove the handler honours the JSON
//     contract (camelCase keys, 200/206/304 status mapping, fromCache flag,
//     rangeStart/rangeEnd threading) the same way StubWebViewExecutor proves
//     the webview.evaluateJavaScript handler without real ArkWeb I/O.

import { makeMediaDownloadHandler } from '../host/MediaDownloadHandler';
import {
  MediaDownloadExecutor,
  MediaDownloadResult,
  StubMediaDownloadExecutor
} from '../host/MediaDownloadHandler';
import { HostReply } from '../host/HostReply';
import { CapabilityHandler } from '../host/CapabilityHandler';

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

export async function runHostMediaDownloadProofTests(): Promise<TestRunner> {
  const r = new TestRunner();

  // ---------- Proof 1: fullGetDownloadReturnsResponse ----------
  // StubMediaDownloadExecutor returns 200 + content-type + sha256. Handler is
  // called with url only (default GET). Assert reply ok, result.resourceId,
  // result.statusCode === 200, result.byteLength > 0, result.fromCache === false.
  {
    const stubResult: MediaDownloadResult = {
      resourceId: 'res-001',
      tempPath: '/cache/media/res-001.png',
      statusCode: 200,
      contentType: 'image/png',
      contentLength: 4096,
      sha256: 'abc123def4567890abcdef1234567890abcdef1234567890abcdef1234567890',
      byteLength: 4096,
      fromCache: false,
      finalUrl: 'https://cdn.example.test/file.png'
    } as MediaDownloadResult;
    const executor: MediaDownloadExecutor = new StubMediaDownloadExecutor(stubResult);
    const handler: CapabilityHandler = makeMediaDownloadHandler(executor);

    const params: Record<string, Object> = {} as Record<string, Object>;
    params['url'] = 'https://cdn.example.test/file.png';
    const reply: HostReply = await handler(params);

    r.assert(reply.ok === true, 'proof1: media.download full GET reply ok');
    if (!reply.ok || reply.result === undefined) {
      r.assert(false, 'proof1: result present', 'reply not ok or missing result');
    } else {
      const result = reply.result as Record<string, Object>;
      const resourceIdVal = result['resourceId'];
      const statusCodeVal = result['statusCode'];
      const byteLengthVal = result['byteLength'];
      const fromCacheVal = result['fromCache'];
      r.assert(
        typeof resourceIdVal === 'string' && resourceIdVal === 'res-001',
        'proof1: resourceId === "res-001"',
        `got ${resourceIdVal}`
      );
      r.assert(
        typeof statusCodeVal === 'number' && statusCodeVal === 200,
        'proof1: statusCode === 200',
        `got ${statusCodeVal}`
      );
      r.assert(
        typeof byteLengthVal === 'number' && byteLengthVal === 4096,
        'proof1: byteLength === 4096',
        `got ${byteLengthVal}`
      );
      r.assert(
        fromCacheVal === false,
        'proof1: fromCache === false',
        `got ${fromCacheVal}`
      );
    }
  }

  // ---------- Proof 2: rangeDownloadWithRangeStartAndRangeEnd ----------
  // Handler is called with rangeStart=1024 + rangeEnd=8191. Stub returns 206
  // and captures the parsed request. Assert reply ok, result.statusCode === 206,
  // stub.capturedRequests[0].rangeStart === 1024, rangeEnd === 8191.
  {
    const stubResult: MediaDownloadResult = {
      resourceId: 'res-002',
      statusCode: 206,
      contentType: 'application/octet-stream',
      contentLength: 7168,
      byteLength: 7168,
      fromCache: false
    } as MediaDownloadResult;
    const executor: StubMediaDownloadExecutor = new StubMediaDownloadExecutor(stubResult);
    const handler: CapabilityHandler = makeMediaDownloadHandler(executor);

    const params: Record<string, Object> = {} as Record<string, Object>;
    params['url'] = 'https://cdn.example.test/large.bin';
    params['rangeStart'] = 1024;
    params['rangeEnd'] = 8191;
    const reply: HostReply = await handler(params);

    r.assert(reply.ok === true, 'proof2: media.download range request reply ok');
    if (!reply.ok || reply.result === undefined) {
      r.assert(false, 'proof2: result present', 'reply not ok or missing result');
    } else {
      const result = reply.result as Record<string, Object>;
      const statusCodeVal = result['statusCode'];
      r.assert(
        typeof statusCodeVal === 'number' && statusCodeVal === 206,
        'proof2: statusCode === 206 (Partial Content)',
        `got ${statusCodeVal}`
      );
    }
    // Verify the executor received the parsed range params.
    r.assert(
      executor.capturedRequests.length === 1,
      'proof2: stub captured exactly 1 request',
      `got ${executor.capturedRequests.length}`
    );
    if (executor.capturedRequests.length === 1) {
      const captured = executor.capturedRequests[0];
      r.assert(
        captured.rangeStart === 1024,
        'proof2: captured rangeStart === 1024',
        `got ${captured.rangeStart}`
      );
      r.assert(
        captured.rangeEnd === 8191,
        'proof2: captured rangeEnd === 8191',
        `got ${captured.rangeEnd}`
      );
    }
  }

  // ---------- Proof 3: headProbeReturnsMetadataOnly ----------
  // Handler is called with method=HEAD. Stub returns 200 + contentLength but no
  // tempPath (HEAD probes metadata, no body downloaded). Assert reply ok,
  // result.statusCode === 200, result.tempPath === undefined.
  {
    const stubResult: MediaDownloadResult = {
      resourceId: 'res-003',
      statusCode: 200,
      contentType: 'video/mp4',
      contentLength: 1048576,
      byteLength: 0,
      fromCache: false
    } as MediaDownloadResult;
    const executor: MediaDownloadExecutor = new StubMediaDownloadExecutor(stubResult);
    const handler: CapabilityHandler = makeMediaDownloadHandler(executor);

    const params: Record<string, Object> = {} as Record<string, Object>;
    params['url'] = 'https://cdn.example.test/video.mp4';
    params['method'] = 'HEAD';
    const reply: HostReply = await handler(params);

    r.assert(reply.ok === true, 'proof3: media.download HEAD probe reply ok');
    if (!reply.ok || reply.result === undefined) {
      r.assert(false, 'proof3: result present', 'reply not ok or missing result');
    } else {
      const result = reply.result as Record<string, Object>;
      const statusCodeVal = result['statusCode'];
      const tempPathVal = result['tempPath'];
      const contentLengthVal = result['contentLength'];
      r.assert(
        typeof statusCodeVal === 'number' && statusCodeVal === 200,
        'proof3: statusCode === 200',
        `got ${statusCodeVal}`
      );
      r.assert(
        tempPathVal === undefined,
        'proof3: tempPath === undefined (HEAD probe, no body downloaded)',
        `got ${tempPathVal}`
      );
      r.assert(
        typeof contentLengthVal === 'number' && contentLengthVal === 1048576,
        'proof3: contentLength === 1048576 (metadata preserved)',
        `got ${contentLengthVal}`
      );
    }
  }

  // ---------- Proof 4: cachedResponseReturnsFromCacheTrue ----------
  // Handler is called with cacheKey set. Stub returns fromCache=true +
  // statusCode=304 (Not Modified). Assert reply ok, result.fromCache === true,
  // result.statusCode === 304, result.byteLength === 0.
  {
    const stubResult: MediaDownloadResult = {
      resourceId: 'res-004',
      statusCode: 304,
      byteLength: 0,
      fromCache: true,
      etag: '"etag-abc"'
    } as MediaDownloadResult;
    const executor: MediaDownloadExecutor = new StubMediaDownloadExecutor(stubResult);
    const handler: CapabilityHandler = makeMediaDownloadHandler(executor);

    const params: Record<string, Object> = {} as Record<string, Object>;
    params['url'] = 'https://cdn.example.test/cached.json';
    params['cacheKey'] = 'cache-key-001';
    const reply: HostReply = await handler(params);

    r.assert(reply.ok === true, 'proof4: media.download cached response reply ok');
    if (!reply.ok || reply.result === undefined) {
      r.assert(false, 'proof4: result present', 'reply not ok or missing result');
    } else {
      const result = reply.result as Record<string, Object>;
      const fromCacheVal = result['fromCache'];
      const statusCodeVal = result['statusCode'];
      const byteLengthVal = result['byteLength'];
      r.assert(
        fromCacheVal === true,
        'proof4: fromCache === true',
        `got ${fromCacheVal}`
      );
      r.assert(
        typeof statusCodeVal === 'number' && statusCodeVal === 304,
        'proof4: statusCode === 304 (Not Modified)',
        `got ${statusCodeVal}`
      );
      r.assert(
        typeof byteLengthVal === 'number' && byteLengthVal === 0,
        'proof4: byteLength === 0 (no body re-downloaded)',
        `got ${byteLengthVal}`
      );
    }
  }

  // ---------- Proof 5: rejectsNonHttpScheme ----------
  // url="file:///etc/passwd" must be rejected (Core/Host boundary — no local
  // file access via media.download). Assert reply is error + message contains
  // "http or https scheme".
  {
    const executor: MediaDownloadExecutor = new StubMediaDownloadExecutor();
    const handler: CapabilityHandler = makeMediaDownloadHandler(executor);

    const params: Record<string, Object> = {} as Record<string, Object>;
    params['url'] = 'file:///etc/passwd';
    const reply: HostReply = await handler(params);

    r.assert(
      reply.ok === false,
      'proof5: non-http scheme rejected (not ok)'
    );
    if (!reply.ok) {
      const msg = reply.message ?? '';
      r.assert(
        typeof msg === 'string' && msg.includes('http or https scheme'),
        'proof5: message contains "http or https scheme"',
        `got ${msg}`
      );
    }
  }

  // ---------- Proof 6: rejectsPostMethod ----------
  // method="POST" must be rejected (media.download only supports GET/HEAD — no
  // upload semantics). Assert reply is error + message contains
  // "must be GET or HEAD".
  {
    const executor: MediaDownloadExecutor = new StubMediaDownloadExecutor();
    const handler: CapabilityHandler = makeMediaDownloadHandler(executor);

    const params: Record<string, Object> = {} as Record<string, Object>;
    params['url'] = 'https://cdn.example.test/upload';
    params['method'] = 'POST';
    const reply: HostReply = await handler(params);

    r.assert(
      reply.ok === false,
      'proof6: POST method rejected (not ok)'
    );
    if (!reply.ok) {
      const msg = reply.message ?? '';
      r.assert(
        typeof msg === 'string' && msg.includes('must be GET or HEAD'),
        'proof6: message contains "must be GET or HEAD"',
        `got ${msg}`
      );
    }
  }

  // ---------- Proof 7: rejectsRangeEndWithoutRangeStart ----------
  // rangeEnd=1024 without rangeStart must be rejected (a range end is
  // meaningless without a start). Assert reply is error + message contains
  // "rangeEnd requires rangeStart".
  {
    const executor: MediaDownloadExecutor = new StubMediaDownloadExecutor();
    const handler: CapabilityHandler = makeMediaDownloadHandler(executor);

    const params: Record<string, Object> = {} as Record<string, Object>;
    params['url'] = 'https://cdn.example.test/file.bin';
    params['rangeEnd'] = 1024;
    const reply: HostReply = await handler(params);

    r.assert(
      reply.ok === false,
      'proof7: rangeEnd without rangeStart rejected (not ok)'
    );
    if (!reply.ok) {
      const msg = reply.message ?? '';
      r.assert(
        typeof msg === 'string' && msg.includes('rangeEnd requires rangeStart'),
        'proof7: message contains "rangeEnd requires rangeStart"',
        `got ${msg}`
      );
    }
  }

  // ---------- Proof 8: rejectsRangeEndBelowRangeStart ----------
  // rangeStart=2048 + rangeEnd=1024 (end < start) must be rejected as an
  // invalid range. Assert reply is error + message contains
  // "rangeEnd (1024) must be >= rangeStart (2048)".
  {
    const executor: MediaDownloadExecutor = new StubMediaDownloadExecutor();
    const handler: CapabilityHandler = makeMediaDownloadHandler(executor);

    const params: Record<string, Object> = {} as Record<string, Object>;
    params['url'] = 'https://cdn.example.test/file.bin';
    params['rangeStart'] = 2048;
    params['rangeEnd'] = 1024;
    const reply: HostReply = await handler(params);

    r.assert(
      reply.ok === false,
      'proof8: rangeEnd < rangeStart rejected (not ok)'
    );
    if (!reply.ok) {
      const msg = reply.message ?? '';
      r.assert(
        typeof msg === 'string' && msg.includes('rangeEnd (1024) must be >= rangeStart (2048)'),
        'proof8: message contains "rangeEnd (1024) must be >= rangeStart (2048)"',
        `got ${msg}`
      );
    }
  }

  return r;
}
