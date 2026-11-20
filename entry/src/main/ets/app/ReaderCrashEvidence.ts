import fs from '@ohos.file.fs';
import util from '@ohos.util';
import { hiAppEvent } from '@kit.PerformanceAnalysisKit';
import { AbilityConstant } from '@kit.AbilityKit';

const BUNDLE = 'io.reader.minliny';
const LIMIT = 65536;
interface CrashException { name?: string; message?: string; stack?: string; }
interface CrashParameters {
  bundle_name?: string;
  time?: number;
  pid?: number;
  crash_type?: string;
  exception?: CrashException;
}
interface EvidenceRecord {
  source: string;
  receivedAt: number;
  eventTime: number;
  pid: number;
  reason: number;
  message: string;
  exceptionName: string;
  stack: string;
}
interface EvidenceDocument { version: number; records: EvidenceRecord[]; }

/** Debug evidence only. No runtime exception handler, external log reads,
 * business state, networking, OS event configuration, or app restart. */
export class ReaderCrashEvidence {
  private active: boolean = true;
  private tail: Promise<void> = Promise.resolve();
  private readonly directory: string;
  private readonly encoder: util.TextEncoder = new util.TextEncoder();
  private watcher: hiAppEvent.Watcher | undefined = undefined;
  private readonly seen: Set<string> = new Set<string>();

  private constructor(filesDir: string) { this.directory = `${filesDir}/reader-diagnostics`; }

  static install(debugBuild: boolean, filesDir: string,
    launch: AbilityConstant.LaunchParam): ReaderCrashEvidence | undefined {
    if (!debugBuild) return undefined;
    const evidence = new ReaderCrashEvidence(filesDir);
    evidence.enqueue({ source: 'launch', receivedAt: Date.now(), eventTime: 0, pid: 0,
      reason: launch.lastExitReason, message: evidence.text(launch.lastExitMessage, 1024),
      exceptionName: '', stack: '' });
    evidence.subscribe();
    return evidence;
  }

  private text(value: string | undefined, limit: number): string {
    return typeof value === 'string' ? value.slice(0, limit) : '';
  }
  private number(value: number | undefined): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }
  private subscribe(): void {
    const watcher: hiAppEvent.Watcher = { name: 'ReaderCrashEvidence',
      appEventFilters: [{ domain: hiAppEvent.domain.OS, names: [hiAppEvent.event.APP_CRASH] }],
      onReceive: (domain: string, groups: hiAppEvent.AppEventGroup[]): void => {
        if (!this.active || domain !== hiAppEvent.domain.OS) return;
        for (const group of groups.slice(0, 4)) {
          for (const event of group.appEventInfos.slice(0, 4)) this.admit(event);
        }
      } };
    // Catch diagnostic subscription failure only; application exceptions are
    // neither intercepted nor swallowed by this adapter.
    try { hiAppEvent.addWatcher(watcher); this.watcher = watcher; } catch (_) {}
  }
  private admit(event: hiAppEvent.AppEventInfo): void {
    if (!this.active || event.domain !== hiAppEvent.domain.OS || event.name !== hiAppEvent.event.APP_CRASH) return;
    const params = event.params as CrashParameters;
    if (params.bundle_name !== BUNDLE || typeof params.time !== 'number' || !Number.isFinite(params.time) ||
      typeof params.pid !== 'number' || !Number.isFinite(params.pid) || params.pid <= 0) return;
    const key = `${params.time}:${params.pid}`;
    if (this.seen.has(key) || this.seen.size >= 4) return;
    this.seen.add(key);
    const exception = params.exception;
    this.enqueue({ source: 'APP_CRASH', receivedAt: Date.now(), eventTime: params.time, pid: params.pid,
      reason: 0, message: this.text(exception?.message, 1024),
      exceptionName: this.text(exception?.name, 128), stack: this.text(exception?.stack, 4096) });
  }
  private enqueue(record: EvidenceRecord): void {
    // The normal application startup does not await diagnostic disk work.
    this.tail = this.tail.then((): Promise<void> => this.persist(record)).catch((): void => {});
  }
  private sanitize(record: EvidenceRecord): EvidenceRecord {
    return { source: record.source === 'APP_CRASH' ? 'APP_CRASH' : 'launch',
      receivedAt: this.number(record.receivedAt), eventTime: this.number(record.eventTime), pid: this.number(record.pid),
      reason: this.number(record.reason), message: this.text(record.message, 1024),
      exceptionName: this.text(record.exceptionName, 128), stack: this.text(record.stack, 4096) };
  }
  private async persist(record: EvidenceRecord): Promise<void> {
    const target = `${this.directory}/crash-evidence.json`;
    let records: EvidenceRecord[] = [];
    // Only our own fixed file is read, with a byte bound before parsing.
    try {
      if ((await fs.stat(target)).size <= LIMIT) {
        const previous = JSON.parse(await fs.readText(target, { length: LIMIT })) as EvidenceDocument;
        if (previous.version === 1 && Array.isArray(previous.records))
          records = previous.records.slice(-3).map((row: EvidenceRecord): EvidenceRecord => this.sanitize(row));
      }
    } catch (_) {}
    records.push(this.sanitize(record));
    let document: EvidenceDocument = { version: 1, records };
    let bytes = this.encoder.encodeInto(JSON.stringify(document));
    while (bytes.length > LIMIT && records.length > 1) {
      records.shift(); document = { version: 1, records };
      bytes = this.encoder.encodeInto(JSON.stringify(document));
    }
    if (bytes.length > LIMIT) return;
    await fs.mkdir(this.directory, true);
    const temp = `${this.directory}/crash-evidence.json.tmp`;
    const file = await fs.open(temp, fs.OpenMode.WRITE_ONLY | fs.OpenMode.CREATE | fs.OpenMode.TRUNC);
    try {
      const written = await fs.write(file.fd, bytes.buffer);
      if (written !== bytes.length) throw new Error('DIAGNOSTIC_SHORT_WRITE');
      await fs.fsync(file.fd);
    } finally { await fs.close(file); }
    await fs.rename(temp, target);
  }
  stop(): void {
    this.active = false;
    if (this.watcher !== undefined) {
      try { hiAppEvent.removeWatcher(this.watcher); } catch (_) {}
      this.watcher = undefined;
    }
  }
}
