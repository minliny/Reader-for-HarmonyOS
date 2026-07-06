// HostMediaMultiResourceProof — headless proof for the media.download lane
// with the REAL ArkMediaDownloadExecutor across multiple resource types
// (Phase 2 step 4b).
//
// Tier: REAL EXECUTOR. Extends HostMediaRealDownloadProof with multiple
// resource types (PNG image, HTML page, larger PNG) to verify the executor
// handles different content types and sizes correctly. All cases exercise
// the production ArkMediaDownloadExecutor that makes real HTTP requests via
// @ohos.net.http and computes SHA-256 via @kit.CryptoArchitectureKit.
//
// Test cases:
//   1. init    — ReaderCoreClient initialized (NAPI + handlers)
//   2. png     — w3c_main.png (2.6KB PNG, image/png) — small binary
//   3. html    — w3.org homepage (HTML, text/html) — text content
//   4. large   — larger PNG resource (byteLength > 1000)
//   5. error   — .invalid URL returns structured error (not throw)
//
// For each success case: verify ok=true, statusCode 2xx, byteLength > 0,
// contentType non-empty, sha256 is 64-char lowercase hex.
//
// canEnterMainline remains false — this is executor layer proof, not App-level.
// Real network I/O targets stable public URLs (w3.org); .invalid TLD is used
// for the error case to ensure DNS resolution failure without hitting any
// real server.

import { ReaderCoreClient } from '../api/ReaderCoreClient';
import { HostAdapter } from '../host/HostAdapter';
import { HostReply } from '../host/HostReply';

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

function isHex64(s: string): boolean {
  if (s.length !== 64) { return false; }
  for (let i = 0; i < 64; i++) {
    const c = s.charCodeAt(i);
    if (!((c >= 48 && c <= 57) || (c >= 97 && c <= 102))) {
      return false;
    }
  }
  return true;
}

// Stable public URLs for real multi-resource download verification.
const PNG_URL = 'https://www.w3.org/Icons/w3c_main.png';
const HTML_URL = 'https://www.w3.org/';
const LARGE_PNG_URL = 'https://www.w3.org/StyleSheets/TR/2016/logos/W3C.png';
const INVALID_URL = 'https://example.invalid/media-multi-resource-proof.png';

// Helper: dispatch a media.download and verify the standard success shape.
// Returns the result record on success, or null on failure (assertions recorded).
async function verifyDownloadSuccess(
  r: TestRunner,
  adapter: HostAdapter,
  url: string,
  label: string,
  minByteLength: number
): Promise<Record<string, Object> | null> {
  let reply: HostReply;
  try {
    const params: Record<string, Object> = {} as Record<string, Object>;
    params['url'] = url;
    params['method'] = 'GET';
    reply = await adapter.dispatch('media.download', params);
  } catch (e) {
    const msg = e instanceof Error ? (e as Error).message : String(e);
    r.assert(
      false,
      `${label}: media.download does not throw`,
      `dispatch threw: ${msg}`
    );
    return null;
  }

  r.assert(
    reply.ok === true,
    `${label}: media.download returns ok`,
    `expected ok=true, got ok=${reply.ok} code=${reply.code} message=${reply.message}`
  );

  if (!reply.ok || reply.result === undefined) {
    if (reply.ok) {
      r.assert(false, `${label}: result present`, 'ok=true but result undefined');
    }
    return null;
  }

  const result = reply.result as Record<string, Object>;
  const byteLengthVal = result['byteLength'];
  const sha256Val = result['sha256'];
  const contentTypeVal = result['contentType'];
  const statusCodeVal = result['statusCode'];

  r.assert(
    typeof byteLengthVal === 'number' && (byteLengthVal as number) > 0,
    `${label}: byteLength > 0`,
    `got ${byteLengthVal}`
  );

  if (typeof byteLengthVal === 'number') {
    r.assert(
      (byteLengthVal as number) >= minByteLength,
      `${label}: byteLength >= ${minByteLength}`,
      `got ${byteLengthVal}`
    );
  }

  r.assert(
    typeof sha256Val === 'string' && (sha256Val as string).length === 64,
    `${label}: sha256 is 64-char hex string`,
    `got ${sha256Val} (type=${typeof sha256Val})`
  );

  if (typeof sha256Val === 'string') {
    r.assert(
      isHex64(sha256Val as string),
      `${label}: sha256 is lowercase hex [0-9a-f]{64}`,
      `got ${sha256Val}`
    );
  }

  r.assert(
    typeof contentTypeVal === 'string' && (contentTypeVal as string).length > 0,
    `${label}: contentType is non-empty`,
    `got ${contentTypeVal}`
  );

  r.assert(
    typeof statusCodeVal === 'number' &&
    (statusCodeVal as number) >= 200 && (statusCodeVal as number) < 300,
    `${label}: statusCode is 2xx`,
    `got ${statusCodeVal}`
  );

  return result;
}

export async function runHostMediaMultiResourceProofTests(): Promise<TestRunner> {
  const r = new TestRunner();

  // ---------- Step 1: Initialize ReaderCoreClient ----------
  let client: ReaderCoreClient;
  try {
    if (ReaderCoreClient.isInitialized()) {
      client = ReaderCoreClient.get();
    } else {
      client = ReaderCoreClient.init();
    }
  } catch (e) {
    const msg = e instanceof Error ? (e as Error).message : String(e);
    r.assert(
      false,
      'init: ReaderCoreClient initialized (NAPI + handlers wired)',
      `init threw (NAPI module not loaded? requires DevEco Studio): ${msg}`
    );
    return r;
  }
  r.assert(true, 'init: ReaderCoreClient initialized (NAPI + handlers wired)');
  const adapter: HostAdapter = client.hostAdapter;

  // ---------- Step 2: PNG — small binary image ----------
  // w3c_main.png is a 2.6KB PNG at a well-known stable URL. Verifies the
  // executor downloads binary content correctly (ARRAY_BUFFER path), computes
  // SHA-256, and returns image/png contentType.
  const pngResult = await verifyDownloadSuccess(r, adapter, PNG_URL, 'png', 100);
  if (pngResult !== null) {
    const contentType = pngResult['contentType'];
    if (typeof contentType === 'string') {
      r.assert(
        (contentType as string).toLowerCase().indexOf('image/png') !== -1,
        'png: contentType contains "image/png"',
        `got ${contentType}`
      );
    }
  }

  // ---------- Step 3: HTML — text content ----------
  // w3.org homepage returns HTML (text/html). Verifies the executor handles
  // text content (still returned as ARRAY_BUFFER, then SHA-256 computed on
  // the raw bytes — charset is not the executor's concern).
  const htmlResult = await verifyDownloadSuccess(r, adapter, HTML_URL, 'html', 100);
  if (htmlResult !== null) {
    const contentType = htmlResult['contentType'];
    if (typeof contentType === 'string') {
      r.assert(
        (contentType as string).toLowerCase().indexOf('text/html') !== -1,
        'html: contentType contains "text/html"',
        `got ${contentType}`
      );
    }
  }

  // ---------- Step 4: Large resource — byteLength > 1000 ----------
  // W3C.png is a larger logo. Verifies the executor handles larger downloads
  // and the byteLength reflects the actual download size.
  const largeResult = await verifyDownloadSuccess(r, adapter, LARGE_PNG_URL, 'large', 1000);
  if (largeResult !== null) {
    const contentType = largeResult['contentType'];
    if (typeof contentType === 'string') {
      r.assert(
        (contentType as string).toLowerCase().indexOf('image') !== -1,
        'large: contentType contains "image"',
        `got ${contentType}`
      );
    }
  }

  // ---------- Step 5: Error case — .invalid URL returns structured error ----------
  let errorReply: HostReply;
  try {
    const params: Record<string, Object> = {} as Record<string, Object>;
    params['url'] = INVALID_URL;
    params['method'] = 'GET';
    errorReply = await adapter.dispatch('media.download', params);
  } catch (e) {
    const msg = e instanceof Error ? (e as Error).message : String(e);
    r.assert(
      false,
      'error: .invalid URL returns structured error (not throw)',
      `dispatch threw: ${msg}`
    );
    return r;
  }

  r.assert(
    errorReply.ok === false,
    'error: .invalid URL returns structured error (not throw)',
    `expected ok=false, got ok=${errorReply.ok}`
  );

  if (!errorReply.ok) {
    r.assert(
      typeof errorReply.code === 'string' && (errorReply.code as string).length > 0,
      'error: error reply has non-empty code',
      `got ${errorReply.code}`
    );
    r.assert(
      typeof errorReply.message === 'string' && (errorReply.message as string).length > 0,
      'error: error reply has non-empty message',
      `got ${errorReply.message}`
    );
  }

  // NOTE: do NOT call client.close() — the singleton lifecycle is owned by
  // EntryAbility. Closing here would break subsequent app code that calls
  // ReaderCoreClient.get(). The NAPI runtime is released when the app exits.

  return r;
}
