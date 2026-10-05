import fileIo from '@ohos.file.fs';
import util from '@ohos.util';
import type { BusinessError } from '@ohos.base';
import { replaceReaderAtomicSnapshot } from './ReaderAtomicSnapshotFile';
import type { SourceSwitchNewTocEntry } from '../features/source/SourceSwitchGateway';

export interface ReaderAtomicSnapshotSample {
  phase: 'write' | 'read' | 'clear' | 'cleanup';
  status: 'pass' | 'unverified';
  characters: number;
  elapsedMs: number;
  errorCode?: number;
}

/** Debug cold-start diagnostic of the production IO primitive, using one
 * UUID-named synthetic scratch file. It never opens the business intent,
 * user books, Core storage or Preferences. A successful API/readback result
 * does not prove crash durability or any reader workflow/visual acceptance. */
export async function probeReaderAtomicSnapshot(debug: boolean, mode: string,
  requested: Object | undefined, parent: string, current: () => boolean,
  now: () => number, record: (sample: ReaderAtomicSnapshotSample) => void): Promise<void> {
  if (debug !== true || mode !== 'debug' || requested !== true) return;
  try { if (!current()) return; } catch (_) { return; }
  let phase: ReaderAtomicSnapshotSample['phase'] = 'write';
  let characters = 0, started = 0;
  try {
    const id = util.generateRandomUUID();
    const path = `${parent}/reader-platform-atomic-${id}.json`;
    const entries: SourceSwitchNewTocEntry[] = [];
    for (let index = 0; index < 6000; index += 1) entries.push({ chapterId: `synthetic/${index}`,
      chapterTitle: `第${index}章：合成原子文件能力探针`, chapterUrl: `https://probe.invalid/chapter/${index}`, order: index });
    const raw = JSON.stringify({ version: 1, diagnosticId: id, params: { operationId: `${id}/1`, sequence: 1,
      from: { sourceId: 'synthetic-old', bookId: id }, target: { sourceId: 'synthetic-new', bookId: id, title: '合成探针' },
      newToc: entries, currentChapterTitle: entries[0].chapterTitle, currentChapterIndex: 0, updatedAt: 1 } });
    characters = raw.length;
    started = now();
    await replaceReaderAtomicSnapshot(path, parent, raw);
    report({ phase, status: 'pass', characters, elapsedMs: now() - started }, record);
    phase = 'read'; started = now();
    if (await fileIo.readText(path) !== raw) throw new Error('synthetic snapshot readback differs');
    report({ phase, status: 'pass', characters, elapsedMs: now() - started }, record);
    phase = 'clear'; started = now();
    await replaceReaderAtomicSnapshot(path, parent, '');
    if (await fileIo.readText(path) !== '') throw new Error('synthetic snapshot clear readback differs');
    report({ phase, status: 'pass', characters, elapsedMs: now() - started }, record);
    phase = 'cleanup'; started = now();
    // Delete only this invocation's synthetic file after its exact clear ACK.
    // A failed/unknown write retains its scratch, never triggers compensation.
    await fileIo.unlink(path);
    report({ phase, status: 'pass', characters, elapsedMs: now() - started }, record);
  } catch (error) {
    const code = error === null || error === undefined ? undefined : (error as BusinessError).code;
    let elapsed = 0;
    try { elapsed = Math.max(0, now() - started); } catch (_) {}
    report({ phase, status: 'unverified', characters, elapsedMs: elapsed,
      errorCode: typeof code === 'number' && Number.isFinite(code) ? code : undefined }, record);
  }
}

function report(sample: ReaderAtomicSnapshotSample, record: (sample: ReaderAtomicSnapshotSample) => void): void {
  try { record(sample); } catch (_) { /* Diagnostic delivery cannot change IO or startup. */ }
}
