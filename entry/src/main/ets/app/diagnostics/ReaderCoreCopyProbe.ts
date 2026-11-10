import fileIo from '@ohos.file.fs';
import { createReaderCoreRuntimeAsync, ReaderCoreRuntime, ReaderCoreRequestError,
  type JsonObject, type ReaderCoreResultEvent } from '@reader/core-harmony';
import { replaceReaderAtomicSnapshot } from '../ReaderAtomicSnapshotFile';
import { MangaSessionGateway } from '../../features/manga/application/MangaSessionGateway';
import type { MangaLocation } from '../../features/manga/application/MangaContract';

export interface ReaderCoreCopyProbeSample {
  phase: 'prepare' | 'query' | 'close';
  code: string;
  count: number;
}

interface ReaderCoreCopyCommand {
  method: string;
  params: JsonObject;
}

/** Explicit cold diagnostic: no product owner or main SQLite handle starts. */
export function readerCoreCopyOnlyEnabled(debug: boolean, buildMode: string,
  enabled: Object | undefined, copyOnly: Object | undefined,
  mode: Object | undefined, id: Object | undefined): boolean {
  return debug === true && buildMode === 'debug' && enabled === true && copyOnly === true &&
    mode === 'manga-progress' && typeof id === 'string' && /^[0-9a-f]{32}$/.test(id);
}

/** Cold debug diagnostic only. The SDK owns a distinct native runtime handle;
 * no business Host, main Runtime, Preferences or pending intent is attached. */
export async function probeReaderCoreCopy(debug: boolean, buildMode: string,
  enabled: Object | undefined, mode: Object | undefined, id: Object | undefined,
  filesDir: string, current: () => boolean,
  record: (sample: ReaderCoreCopyProbeSample) => void): Promise<void> {
  if (debug !== true || buildMode !== 'debug' || enabled !== true ||
    (mode !== 'prepare' && mode !== 'query' && mode !== 'manga-progress') || typeof id !== 'string' || !/^[0-9a-f]{32}$/.test(id)) return;
  if (!current()) return;
  const scratch = `${filesDir}/reader-core-copy-probe-${id}`;
  const marker = `reader-core-copy-probe-v1:${id}\n`;
  let runtime: ReaderCoreRuntime | undefined = undefined;
  let count = 0;
  let safeScratch = false;
  try {
    if (mode === 'prepare') {
      ensureDirectory(scratch);
      safeScratch = true;
      ensureDirectory(`${scratch}/data`);
      ensureDirectory(`${scratch}/cache`);
      const markerPath = `${scratch}/marker.txt`;
      if (fileIo.accessSync(markerPath)) {
        requireFile(markerPath);
        if (await fileIo.readText(markerPath) !== marker) throw new Error('COPY_MARKER_MISMATCH');
      } else {
        await replaceReaderAtomicSnapshot(markerPath, scratch, marker);
      }
      if (current()) report({ phase: 'prepare', code: 'READY', count: 0 }, record);
      return;
    }
    requireDirectory(scratch);
    safeScratch = true;
    requireDirectory(`${scratch}/data`);
    requireDirectory(`${scratch}/cache`);
    requireFile(`${scratch}/marker.txt`);
    if (await fileIo.readText(`${scratch}/marker.txt`) !== marker) throw new Error('COPY_MARKER_MISMATCH');
    requireFile(`${scratch}/data/reader-core.sqlite3`);
    for (const suffix of ['-wal', '-shm', '-journal']) {
      const path = `${scratch}/data/reader-core.sqlite3${suffix}`;
      if (fileIo.accessSync(path)) requireFile(path);
    }
    const inputPath = `${scratch}/${mode === 'query' ? 'commands.ndjson' : 'manga-target.json'}`;
    requireFile(inputPath);
    if (fileIo.statSync(inputPath).size > 4 * 1024 * 1024) throw new Error('COPY_COMMANDS_TOO_LARGE');
    // Stat cannot report nlink on this API. Reject all known main-file aliases;
    // the driver additionally stages fresh ordinary files into a new UUID tree.
    requireDistinctStorage(filesDir, scratch, inputPath);
    // A unique ID keeps prior results intact; never silently rerun a query copy.
    if (fileIo.accessSync(`${scratch}/query-results.json`) || fileIo.accessSync(`${scratch}/query-error.json`)) {
      throw new Error('COPY_RESULT_ALREADY_EXISTS');
    }
    const commands = mode === 'query' ? readCommands(await fileIo.readText(inputPath)) : [];
    const target = mode === 'manga-progress' ? readMangaTarget(await fileIo.readText(inputPath)) : undefined;
    if (!current()) return;
    // Claim this finite run before native initialization, including failures.
    await replaceReaderAtomicSnapshot(`${scratch}/query-results.json`, scratch,
      JSON.stringify({ mode, results: [] }));
    runtime = await createReaderCoreRuntimeAsync({ dataDirectory: `${scratch}/data`,
      cacheDirectory: `${scratch}/cache` }, current);
    if (target !== undefined) {
      await runMangaProgressCopy(runtime, target, scratch, current, (value: number): void => { count = value; }, record);
      return;
    }
    const results: JsonObject[] = [];
    for (const command of commands) {
      if (!current()) return;
      try {
        // The SDK creates fresh envelope IDs. Parsed params, including the
        // complete expected.params value, are passed unchanged to Core.
        const event = await runtime.request(command.method, command.params,
          { timeoutMs: 15000, shouldCancel: (): boolean => !current() });
        results.push({ method: command.method, result: event });
        count += 1;
        if (current()) report({ phase: 'query', code: 'RESULT', count }, record);
      } catch (error) {
        results.push({ method: command.method, error: privateError(error) });
        count += 1;
        if (current()) report({ phase: 'query', code: 'REQUEST_ERROR', count }, record);
      }
      if (!current()) return;
      await replaceReaderAtomicSnapshot(`${scratch}/query-results.json`, scratch, JSON.stringify({ results }));
    }
  } catch (error) {
    if (mode !== 'prepare' && safeScratch && current() && !fileIo.accessSync(`${scratch}/query-error.json`)) {
      try { await replaceReaderAtomicSnapshot(`${scratch}/query-error.json`, scratch,
        JSON.stringify(privateError(error))); } catch (_) { /* Private IO failure has no main-runtime effect. */ }
    }
    if (current()) report({ phase: mode === 'prepare' ? 'prepare' : 'query', code: 'PROBE_ERROR', count }, record);
  } finally {
    if (runtime !== undefined) {
      try {
        runtime.close();
        if (current()) report({ phase: 'close', code: 'CLOSED', count }, record);
      } catch (_) {
        if (current()) report({ phase: 'close', code: 'CLOSE_ERROR', count }, record);
      }
    }
  }
}

interface MangaCopyTarget { sourceId: string; bookId: string; chapterIndex: number; }

function readMangaTarget(raw: string): MangaCopyTarget {
  const target = JSON.parse(raw) as MangaCopyTarget;
  if (!isObject(target) || typeof target.sourceId !== 'string' || target.sourceId.trim().length === 0 ||
    typeof target.bookId !== 'string' || target.bookId.trim().length === 0 ||
    !Number.isSafeInteger(target.chapterIndex) || target.chapterIndex < 0 ||
    Object.keys(target).some(key => !['sourceId', 'bookId', 'chapterIndex'].includes(key))) {
    throw new Error('COPY_MANGA_TARGET_INVALID');
  }
  return target;
}

/** Exactly two dependent saves on the copy. The production gateway retains
 * entry/manifest and strict ACK validation. No Host, media or main owner joins. */
async function runMangaProgressCopy(runtime: ReaderCoreRuntime, target: MangaCopyTarget, scratch: string,
  current: () => boolean, setCount: (count: number) => void,
  record: (sample: ReaderCoreCopyProbeSample) => void): Promise<void> {
  const results: JsonObject[] = [];
  const request = async (method: string, params: JsonObject = {}): Promise<ReaderCoreResultEvent> => {
    if (!current()) throw new Error('COPY_PROBE_CANCELLED');
    let result: ReaderCoreResultEvent;
    try {
      result = await runtime.request(method, params, { timeoutMs: 15000, shouldCancel: (): boolean => !current() });
    } catch (error) {
      results.push({ method, params, error: privateError(error) });
      if (current()) {
        await replaceReaderAtomicSnapshot(`${scratch}/query-results.json`, scratch, JSON.stringify({ mode: 'manga-progress', results }));
        setCount(results.length);
        report({ phase: 'query', code: 'REQUEST_ERROR', count: results.length }, record);
      }
      throw error;
    }
    results.push({ method, params, result });
    if (!current()) throw new Error('COPY_PROBE_CANCELLED');
    await replaceReaderAtomicSnapshot(`${scratch}/query-results.json`, scratch, JSON.stringify({ mode: 'manga-progress', results }));
    setCount(results.length);
    report({ phase: 'query', code: 'RESULT', count: results.length }, record);
    return result;
  };
  const info = await request('core.info');
  const capabilities = info.data['capabilities'];
  const gateway = new MangaSessionGateway({ request,
    supportsCoreCapability: (capability: string): boolean => Array.isArray(capabilities) && capabilities.includes(capability) });
  const entry = await gateway.entry(target.sourceId, target.bookId, target.chapterIndex, current);
  if (entry === null || entry.recoveryRequired) throw new Error('COPY_MANGA_ENTRY_UNAVAILABLE');
  const manifest = entry.chapter.manifest;
  const page = manifest.pages.find(value => value.ordinal === entry.targetOrdinal);
  if (page === undefined) throw new Error('COPY_MANGA_PAGE_UNAVAILABLE');
  let expected = entry.progress.token;
  for (let index = 0; index < 2; index += 1) {
    const location: MangaLocation = { kind: 'manga', chapter: manifest.chapter,
      manifestVersion: manifest.manifestVersion, pageId: page.pageId, pageOrdinalFallback: page.ordinal,
      x: 0, y: 0, progressRevision: expected.revision + 1 };
    const ack = await gateway.save(location, expected, current);
    expected = ack.token;
  }
  const readBack = await gateway.progress(target.sourceId, target.bookId, current);
  if (readBack.token.epoch !== expected.epoch || readBack.token.revision !== expected.revision) {
    throw new Error('COPY_MANGA_READBACK_MISMATCH');
  }
  report({ phase: 'query', code: 'TWO_SAVES_CONFIRMED', count: results.length }, record);
}

function requireDistinctStorage(filesDir: string, scratch: string, inputPath: string): void {
  const main: bigint[] = [];
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    const path = `${filesDir}/reader-core/reader-core.sqlite3${suffix}`;
    if (fileIo.accessSync(path)) { requireFile(path); main.push(fileIo.lstatSync(path).ino); }
  }
  const seen: bigint[] = [];
  for (const path of [`${scratch}/marker.txt`, inputPath, ...['', '-wal', '-shm', '-journal']
    .map(suffix => `${scratch}/data/reader-core.sqlite3${suffix}`)]) {
    if (!fileIo.accessSync(path)) continue;
    requireFile(path);
    const ino = fileIo.lstatSync(path).ino;
    if (main.includes(ino) || seen.includes(ino)) throw new Error('COPY_STORAGE_ALIAS_REJECTED');
    seen.push(ino);
  }
}

function readCommands(raw: string): ReaderCoreCopyCommand[] {
  const lines = raw.trim().split(/\r?\n/);
  if (lines.length !== 2) throw new Error('COPY_QUERY_PAIR_REQUIRED');
  const expected = ['core.info', 'bookmark.operation.query'];
  const commands: ReaderCoreCopyCommand[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const value = JSON.parse(lines[index]) as JsonObject;
    if (!isObject(value) || value.protocolVersion !== 1 || value.method !== expected[index] ||
      !isObject(value.params)) throw new Error('COPY_QUERY_NOT_ALLOWED');
    commands.push({ method: expected[index], params: value.params as JsonObject });
  }
  return commands;
}

function isObject(value: unknown): boolean {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireDirectory(path: string): void {
  const stat = fileIo.lstatSync(path);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('COPY_DIRECTORY_REQUIRED');
}

function ensureDirectory(path: string): void {
  if (!fileIo.accessSync(path)) fileIo.mkdirSync(path);
  requireDirectory(path);
}

function requireFile(path: string): void {
  const stat = fileIo.lstatSync(path);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('COPY_FILE_REQUIRED');
}

function privateError(error: unknown): JsonObject {
  if (error instanceof ReaderCoreRequestError) return { event: error.event };
  return { message: error instanceof Error ? error.message : 'COPY_PROBE_FAILURE' };
}

function report(sample: ReaderCoreCopyProbeSample, record: (sample: ReaderCoreCopyProbeSample) => void): void {
  try { record(sample); } catch (_) { /* Diagnostics never change normal startup. */ }
}
