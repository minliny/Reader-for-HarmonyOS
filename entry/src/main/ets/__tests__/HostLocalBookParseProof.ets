// HostLocalBookParseProof — headless proof for local_book.parse (item 6).
//
// Tier: HANDLER/ROUTER (NAPI). Unlike HostAntiBotProof / HostWebViewRenderProof
// which call handler-layer code directly with stub executors, this proof
// exercises the REAL Core via the NAPI bridge (ReaderCoreClient.sendCommand +
// awaitResult). Core receives the JSON command, dispatches to
// parse_txt_text_with_txt_toc_rules, and returns LocalBookParseData.
//
// (1) This is NAPI-router tier proof — verifies the full round-trip:
//     ArkTS params → NAPI sendCommand → Core JSON protocol → Core local book
//     parser → Core result event → ArkTS awaitResult. The proof level matches
//     the task spec: handler/router (NAPI → Core JSON protocol → Core local
//     book parser).
//
// (2) Device-headless/App tier (real file picker → file read → Core parse)
//     requires @ohos.file.fs + FilePicker UI + DevEco Studio emulator —
//     pending device proof, out of scope for this increment.
//
// (3) Mirrors iOS LocalBookCoreImportBridgeTests pattern: TXT input with
//     "Chapter 1\nBody\nChapter 2\nMore" → 2 chapters detected by the Auto
//     heuristic's is_english_chapter detector (txt.rs:333).
//
// (4) Core contract note: the request/response field names follow the Rust
//     Core contract (crates/reader-contract/src/remote.rs:2168
//     LocalBookParseParams / LocalBookParseData), NOT the iOS App-level
//     wrapper (CoreLocalBookImportSummary). Request fields: bookId (required,
//     non-blank), text, fileName, format. Response fields: book {bookId,
//     title, author, ...}, format, encoding, byteLen, charLen, chapterCount.
//     There is no top-level chapters array, no detectedFormat/detectedEncoding,
//     no inputByteCount, no sourceChecksum in the raw Core response — those
//     are iOS App-wrapper concepts. The assertions below target the actual
//     Core response fields.
//
// (5) Closes the gap noted in UnifiedEvidenceRunner.ets:16 —
//     "local_book.parse → blocked (not yet wired via NAPI)". The NAPI bridge
//     (ReaderCoreClient.sendCommand + awaitResult) successfully dispatches
//     local_book.parse to Core and receives parsed book + chapterCount.

import { ReaderCoreClient } from '../api/ReaderCoreClient';

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

// TXT input: two English "Chapter N" headings, each followed by a body line.
// The Core Auto heuristic (txt.rs is_english_chapter) detects "Chapter 1" and
// "Chapter 2" as chapter headings, producing 2 chapters. Matches the iOS
// LocalBookCoreImportBridgeTests input pattern.
const TXT_CONTENT: string = 'Chapter 1\nBody line\nChapter 2\nMore body';
const TXT_BOOK_ID: string = 'localbook:harmonyos-proof-txt';
const TXT_FILE_NAME: string = 'test.txt';
const TXT_FORMAT: string = 'txt';
const CORE_TIMEOUT_MS: number = 10000;

// Build local_book.parse request params for the TXT text path.
// Core contract (LocalBookParseParams): bookId (required), text, fileName,
// format. Note: declaredFilename/declaredExtension/declaredMIMEType from the
// task spec are iOS-wrapper concepts — Core uses fileName + format instead.
function buildTxtParams(bookId: string): Record<string, Object> {
  const params: Record<string, Object> = {} as Record<string, Object>;
  params['bookId'] = bookId;
  params['text'] = TXT_CONTENT;
  params['fileName'] = TXT_FILE_NAME;
  params['format'] = TXT_FORMAT;
  return params;
}

// Build local_book.parse request params with empty text (for rejection test).
// Core validate_local_book_parse_params returns INVALID_PARAMS when both text
// and bytesBase64 are empty/blank.
function buildBlankTxtParams(bookId: string): Record<string, Object> {
  const params: Record<string, Object> = {} as Record<string, Object>;
  params['bookId'] = bookId;
  params['text'] = '';
  return params;
}

// Safely extract a string field from a Record, returning '' for non-strings.
function stringField(obj: Record<string, Object>, key: string): string {
  const v = obj[key];
  return typeof v === 'string' ? (v as string) : '';
}

// Safely extract a number field from a Record, returning -1 for non-numbers.
function numberField(obj: Record<string, Object>, key: string): number {
  const v = obj[key];
  return typeof v === 'number' ? (v as number) : -1;
}

export async function runHostLocalBookParseProofTests(): Promise<TestRunner> {
  const r = new TestRunner();

  // Ensure ReaderCoreClient is initialized. In production this is done by
  // EntryAbility.onCreate(); for headless proof we init defensively. If the
  // NAPI native library (libreader_core_napi.so) is not loaded, init() will
  // throw and all tests are recorded as failed.
  if (!ReaderCoreClient.isInitialized()) {
    try {
      ReaderCoreClient.init();
    } catch (e) {
      const msg = e instanceof Error ? e.message : `${e}`;
      r.assert(false, 'setup: ReaderCoreClient.init()',
        `init failed (NAPI native library may not be loaded): ${msg}`);
      return r;
    }
  }

  const client: ReaderCoreClient = ReaderCoreClient.get();

  // ---------- Proof 1: txtParseReturnsBookWithChapters ----------
  // Send TXT content with two "Chapter N" headings. Core's parse_txt_text
  // auto-heuristic (is_english_chapter) splits into 2 chapters.
  // Assert: response.book.title non-empty, response.chapterCount === 2,
  // response.format === "txt".
  {
    const params = buildTxtParams(TXT_BOOK_ID);
    let data: object;
    try {
      const requestId = client.sendCommand('local_book.parse', params);
      data = await client.awaitResult(requestId, CORE_TIMEOUT_MS);
    } catch (e) {
      const msg = e instanceof Error ? e.message : `${e}`;
      r.assert(false, 'proof1: local_book.parse round-trip',
        `sendCommand/awaitResult failed: ${msg}`);
      r.assert(false, 'proof1: book.title non-empty', 'round-trip failed');
      r.assert(false, 'proof1: chapterCount === 2', 'round-trip failed');
      r.assert(false, 'proof1: format === "txt"', 'round-trip failed');
      return r;
    }
    const obj = data as Record<string, Object>;
    const bookValue = obj['book'];
    const chapterCount = numberField(obj, 'chapterCount');
    const format = stringField(obj, 'format');

    r.assert(
      bookValue !== null && bookValue !== undefined && typeof bookValue === 'object',
      'proof1: response.book is object',
      `got ${bookValue}`
    );
    if (bookValue !== null && bookValue !== undefined && typeof bookValue === 'object') {
      const bookObj = bookValue as Record<string, Object>;
      const title = stringField(bookObj, 'title');
      r.assert(
        title.length > 0,
        'proof1: book.title non-empty',
        `got "${title}"`
      );
    } else {
      r.assert(false, 'proof1: book.title non-empty', 'book object missing');
    }
    r.assert(
      chapterCount === 2,
      'proof1: chapterCount === 2',
      `got ${chapterCount}`
    );
    r.assert(
      format === 'txt',
      'proof1: format === "txt"',
      `got "${format}"`
    );
  }

  // ---------- Proof 2: txtParseDetectsEncoding ----------
  // Same TXT input. Core detects UTF-8 encoding. Assert encoding === "utf8".
  // (LocalBookEncoding::Utf8 serializes to "utf8" via serde camelCase —
  // crates/reader-local-book/src/lib.rs:810-812.)
  {
    const params = buildTxtParams(TXT_BOOK_ID);
    let data: object;
    try {
      const requestId = client.sendCommand('local_book.parse', params);
      data = await client.awaitResult(requestId, CORE_TIMEOUT_MS);
    } catch (e) {
      const msg = e instanceof Error ? e.message : `${e}`;
      r.assert(false, 'proof2: local_book.parse round-trip',
        `sendCommand/awaitResult failed: ${msg}`);
      r.assert(false, 'proof2: encoding === "utf8"', 'round-trip failed');
      return r;
    }
    const obj = data as Record<string, Object>;
    const encoding = stringField(obj, 'encoding');
    r.assert(
      encoding === 'utf8',
      'proof2: encoding === "utf8" (LocalBookEncoding::Utf8)',
      `got "${encoding}"`
    );
  }

  // ---------- Proof 3: txtParseRejectsBlankText ----------
  // Send empty text with no bytesBase64. Core's validate_local_book_parse_params
  // (crates/reader-contract/src/remote.rs:2200) returns INVALID_PARAMS.
  // ReaderCoreClient.awaitResult throws Error('Core error: INVALID_PARAMS — ...').
  // Assert the error is a structured Core error (message starts with
  // "Core error:"), NOT a timeout.
  {
    const params = buildBlankTxtParams('localbook:harmonyos-proof-blank');
    let caughtError: Error | null = null;
    try {
      const requestId = client.sendCommand('local_book.parse', params);
      await client.awaitResult(requestId, CORE_TIMEOUT_MS);
    } catch (e) {
      caughtError = e instanceof Error ? e : new Error(`${e}`);
    }
    r.assert(
      caughtError !== null,
      'proof3: blank text rejected (error thrown)',
      'no error thrown for empty text'
    );
    if (caughtError !== null) {
      const msg = caughtError.message;
      r.assert(
        msg.indexOf('Core error:') === 0,
        'proof3: error is structured Core error (not timeout)',
        `got: ${msg}`
      );
    } else {
      r.assert(false, 'proof3: error is structured Core error (not timeout)',
        'no error thrown');
    }
  }

  // ---------- Proof 4: txtParseReturnsNonEmptyBookId ----------
  // Same TXT input as #1. Assert book.bookId non-empty and byteLen > 0.
  // (sourceChecksum is an iOS App-wrapper concept; the raw Core response has
  // byteLen/charLen instead — assert byteLen > 0 as input-processed proof.)
  {
    const params = buildTxtParams(TXT_BOOK_ID);
    let data: object;
    try {
      const requestId = client.sendCommand('local_book.parse', params);
      data = await client.awaitResult(requestId, CORE_TIMEOUT_MS);
    } catch (e) {
      const msg = e instanceof Error ? e.message : `${e}`;
      r.assert(false, 'proof4: local_book.parse round-trip',
        `sendCommand/awaitResult failed: ${msg}`);
      r.assert(false, 'proof4: book.bookId non-empty', 'round-trip failed');
      r.assert(false, 'proof4: byteLen > 0', 'round-trip failed');
      return r;
    }
    const obj = data as Record<string, Object>;
    const bookValue = obj['book'];
    const byteLen = numberField(obj, 'byteLen');

    r.assert(
      bookValue !== null && bookValue !== undefined && typeof bookValue === 'object',
      'proof4: response.book is object',
      `got ${bookValue}`
    );
    if (bookValue !== null && bookValue !== undefined && typeof bookValue === 'object') {
      const bookObj = bookValue as Record<string, Object>;
      const bookId = stringField(bookObj, 'bookId');
      r.assert(
        bookId.length > 0,
        'proof4: book.bookId non-empty',
        `got "${bookId}"`
      );
    } else {
      r.assert(false, 'proof4: book.bookId non-empty', 'book object missing');
    }
    r.assert(
      byteLen > 0,
      'proof4: byteLen > 0 (input bytes processed)',
      `got ${byteLen}`
    );
  }

  return r;
}
