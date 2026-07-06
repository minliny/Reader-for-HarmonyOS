// HostMediaRealDownloadProof — headless proof for the media.download lane with
// the REAL ArkMediaDownloadExecutor (Phase 2).
//
// Tier: REAL EXECUTOR. Unlike HostMediaDownloadProof (which uses
// StubMediaDownloadExecutor for handler-layer plumbing), this proof exercises
// the production ArkMediaDownloadExecutor that makes real HTTP requests via
// @ohos.net.http and computes SHA-256 via @kit.CryptoArchitectureKit.
//
// This is the proof that the media.download lane executes REAL network I/O on a
// physical HarmonyOS device — not a stub, not a synthetic-param test. The
// executor is wired in the ReaderCoreClient constructor (replaces the
// device-headless beta stub). Dispatching media.download through the HostAdapter
// reaches the real executor.
//
// Test cases:
//   1. init                — ReaderCoreClient initialized (NAPI + handlers)
//   2. download.success    — real URL returns non-zero byteLength + sha256 + contentType
//   3. download.hash       — sha256 is 64-char lowercase hex string
//   4. download.contentType — contentType is non-empty (image/png expected)
//   5. download.statusCode — statusCode is 2xx (200 expected)
//   6. download.error      — .invalid URL returns structured error (not throw)
//
// canEnterMainline remains false — this is executor layer proof, not App-level.
// Real network I/O targets stable public URLs (w3.org); .invalid TLD is used
// for the error case to ensure DNS resolution failure without hitting any real
// server.

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

// Stable small public URLs for real download verification.
//   - w3c_main.png: 2.6KB PNG, content-type image/png, well-known stable URL.
//   - example.invalid: RFC 6761 reserved TLD, DNS resolution always fails.
const REAL_DOWNLOAD_URL = 'https://www.w3.org/Icons/w3c_main.png';
const INVALID_URL = 'https://example.invalid/media-real-download-proof.png';

function isHex64(s: string): boolean {
  if (s.length !== 64) { return false; }
  for (let i = 0; i < 64; i++) {
    const c = s.charCodeAt(i);
    // 0-9 (48-57) or a-f (97-102)
    if (!((c >= 48 && c <= 57) || (c >= 97 && c <= 102))) {
      return false;
    }
  }
  return true;
}

export async function runHostMediaRealDownloadProofTests(): Promise<TestRunner> {
  const r = new TestRunner();

  // ---------- Step 1: Initialize ReaderCoreClient ----------
  // ReaderCoreClient.init() creates a ReaderCoreRuntime via the NAPI bridge
  // (libreader_core_napi.so) and registers all 6 host capability handlers in
  // its HostAdapter, including media.download -> ArkMediaDownloadExecutor (real).
  // Idempotent: if EntryAbility already initialized the singleton, reuse it.
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

  // ---------- Step 2: Real download — success ----------
  // Dispatch media.download to a real public URL. The production
  // ArkMediaDownloadExecutor makes a real HTTP GET via @ohos.net.http, reads
  // the response body as ARRAY_BUFFER, computes SHA-256 via
  // @kit.CryptoArchitectureKit, and returns a MediaDownloadResult. The handler
  // wraps it as hostReplySuccess.
  let downloadReply: HostReply;
  try {
    const params: Record<string, Object> = {} as Record<string, Object>;
    params['url'] = REAL_DOWNLOAD_URL;
    params['method'] = 'GET';
    downloadReply = await adapter.dispatch('media.download', params);
  } catch (e) {
    const msg = e instanceof Error ? (e as Error).message : String(e);
    r.assert(
      false,
      'download.success: media.download to real URL does not throw',
      `dispatch threw: ${msg}`
    );
    return r;
  }

  r.assert(
    downloadReply.ok === true,
    'download.success: media.download to real URL returns ok',
    `expected ok=true, got ok=${downloadReply.ok} code=${downloadReply.code} message=${downloadReply.message}`
  );

  if (downloadReply.ok && downloadReply.result !== undefined) {
    const result = downloadReply.result as Record<string, Object>;
    const byteLengthVal = result['byteLength'];
    const sha256Val = result['sha256'];
    const contentTypeVal = result['contentType'];
    const statusCodeVal = result['statusCode'];

    r.assert(
      typeof byteLengthVal === 'number' && (byteLengthVal as number) > 0,
      'download.success: byteLength > 0 (real bytes downloaded)',
      `got ${byteLengthVal}`
    );

    r.assert(
      typeof sha256Val === 'string' && (sha256Val as string).length === 64,
      'download.hash: sha256 is 64-char hex string',
      `got ${sha256Val} (type=${typeof sha256Val})`
    );

    if (typeof sha256Val === 'string') {
      r.assert(
        isHex64(sha256Val as string),
        'download.hash: sha256 is lowercase hex [0-9a-f]{64}',
        `got ${sha256Val}`
      );
    }

    r.assert(
      typeof contentTypeVal === 'string' && (contentTypeVal as string).length > 0,
      'download.contentType: contentType is non-empty',
      `got ${contentTypeVal}`
    );

    r.assert(
      typeof statusCodeVal === 'number' &&
      (statusCodeVal as number) >= 200 && (statusCodeVal as number) < 300,
      'download.statusCode: statusCode is 2xx (200 expected)',
      `got ${statusCodeVal}`
    );
  } else if (downloadReply.ok) {
    r.assert(false, 'download.success: result present', 'ok=true but result undefined');
  }

  // ---------- Step 3: Error case — .invalid URL returns structured error ----------
  // Dispatch media.download to a .invalid URL. The production executor attempts
  // a real HTTP GET; DNS resolution fails for .invalid TLD (RFC 6761). The
  // executor catches the network error and throws Error("media.download network
  // error: ..."). The handler catches the throw and returns a structured
  // HostReply error (ok=false, code=INTERNAL). The proof verifies dispatch
  // DOES NOT throw (structured error, not unhandled exception) and the reply
  // carries a non-empty code + message.
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
      'download.error: .invalid URL returns structured error (not throw)',
      `dispatch threw: ${msg}`
    );
    return r;
  }

  r.assert(
    errorReply.ok === false,
    'download.error: .invalid URL returns structured error (not throw)',
    `expected ok=false, got ok=${errorReply.ok}`
  );

  if (!errorReply.ok) {
    r.assert(
      typeof errorReply.code === 'string' && (errorReply.code as string).length > 0,
      'download.error: error reply has non-empty code',
      `got ${errorReply.code}`
    );
    r.assert(
      typeof errorReply.message === 'string' && (errorReply.message as string).length > 0,
      'download.error: error reply has non-empty message',
      `got ${errorReply.message}`
    );
  }

  // NOTE: do NOT call client.close() — the singleton lifecycle is owned by
  // EntryAbility. Closing here would break subsequent app code that calls
  // ReaderCoreClient.get(). The NAPI runtime is released when the app exits.

  return r;
}
