import fs from '@ohos.file.fs';
import util from '@ohos.util';
import { hiAppEvent, hilog } from '@kit.PerformanceAnalysisKit';
import type { MangaProbeSelectionMode } from './MangaOfflineNetworkProbe';

const DOMAIN = 0x5244;
const TAG = 'ReaderMangaDfx';
const BUNDLE = 'io.reader.minliny';
const OUTPUT_LIMIT = 1024 * 1024;
const READ_LIMIT = 1024 * 1024;
const EVENT_LIMIT = 16;
const LOG_ROOT = '/data/storage/el2/log/';

interface PlatformDiagnosticEvent {
  name: string;
  time: number;
  pid: number;
  uid: number;
  beginTime: number;
  endTime: number;
  logOverLimit: boolean;
  paths: string[];
  heaviestStack: string;
}

/** Narrow debug adapter over the official OS sampler. It never samples,
 * disables the watchdog, accepts a Want path, or changes reader scheduling.
 * HiAppEvent can replay pending subscribed events after a restart; it does not
 * guarantee recovery of an event that predates the first registration. */
export class ReaderMangaPlatformDiagnostic {
  private active: boolean = true;
  private emittedBytes: number = 0;
  private readBytes: number = 0;
  private readonly seen: Set<string> = new Set<string>();
  private tail: Promise<void> = Promise.resolve();
  private configuration: Promise<void> = Promise.resolve();
  private historyDraining: boolean = false;
  private readonly watchers: hiAppEvent.Watcher[] = [];
  private readonly encoder: util.TextEncoder = new util.TextEncoder();

  static install(mode: MangaProbeSelectionMode | undefined,
    recordedJankR31: boolean = false): ReaderMangaPlatformDiagnostic | undefined {
    if (mode !== 'reading') return undefined;
    const diagnostic = new ReaderMangaPlatformDiagnostic();
    diagnostic.start();
    if (recordedJankR31 === true) diagnostic.exportRecordedJankR31();
    return diagnostic;
  }

  private exportRecordedJankR31(): void {
    // The exact historical filename was recorded in r31's public faultlog.
    // This is a fixed diagnostic receipt, never a new OS event or Want path.
    const event: PlatformDiagnosticEvent = { name: hiAppEvent.event.MAIN_THREAD_JANK,
      time: 1791122350000, pid: 2598, uid: -1, beginTime: -1, endTime: -1,
      logOverLimit: false, paths: [], heaviestStack: '' };
    this.tail = this.tail.then(async (): Promise<void> => {
      if (!this.active) return;
      this.emit('known-r31-history', event, 'fixed-r31-file-not-new-os-event');
      await this.exportLog('/data/storage/el2/log/watchdog/MAIN_THREAD_JANK_20261004215910_2598.txt', event);
    }).catch((): void => { this.emit('log-unavailable', event); });
  }

  private start(): void {
    const filters: hiAppEvent.AppEventFilter[] = [{ domain: hiAppEvent.domain.OS,
      names: [hiAppEvent.event.MAIN_THREAD_JANK, hiAppEvent.event.APP_FREEZE] }];
    // onReceive takes precedence over onTrigger on one Watcher. Separate fixed
    // watchers keep both official delivery paths; one bounded identity set
    // joins duplicates without retaining arbitrary event parameters.
    const live: hiAppEvent.Watcher = { name: 'ReaderMangaDfxLive', appEventFilters: filters,
      onReceive: (domain: string, groups: hiAppEvent.AppEventGroup[]): void => {
        if (!this.active || domain !== hiAppEvent.domain.OS) return;
        for (const group of groups.slice(0, EVENT_LIMIT)) {
          for (const info of group.appEventInfos.slice(0, EVENT_LIMIT)) this.admit(info);
        }
      } };
    const history: hiAppEvent.Watcher = { name: 'ReaderMangaDfxHistory', appEventFilters: filters,
      triggerCondition: { row: 1 },
      onTrigger: (_rows: number, _size: number, holder: hiAppEvent.AppEventPackageHolder): void => {
        this.drainHistory(holder);
      } };
    try {
      this.watchers.push(live);
      const liveHolder = hiAppEvent.addWatcher(live);
      if (liveHolder === undefined || liveHolder === null) throw new Error('DIAGNOSTIC_SUBSCRIPTION_FAILED');
      this.watchers.push(history);
      const holder = hiAppEvent.addWatcher(history);
      if (holder === undefined || holder === null) throw new Error('DIAGNOSTIC_SUBSCRIPTION_FAILED');
      // Read already-held subscription packages without waiting for a trigger.
      this.drainHistory(holder);
      this.emit('watching', undefined, 'pending-subscribed-history-only');
      const config: Record<string, hiAppEvent.ParamType> = { log_type: '1', sample_interval: '100',
        ignore_startup_time: '10', sample_count: '21', report_times_per_app: '3' };
      this.configuration = hiAppEvent.setEventConfig(hiAppEvent.event.MAIN_THREAD_JANK, config)
        .then((): void => { this.emit('configured', undefined, 'official-stack-only'); })
        .catch((): void => { this.emit('configuration-failed'); });
    } catch (_) { this.emit('subscription-failed'); this.stop(); }
  }

  private drainHistory(holder: hiAppEvent.AppEventPackageHolder): void {
    if (!this.active || this.historyDraining || holder === undefined || holder === null) return;
    this.historyDraining = true;
    try {
      holder.setRow(1);
      for (let index = 0; this.active && index < EVENT_LIMIT; index++) {
        const packet = holder.takeNext();
        if (packet === undefined || packet === null) return;
        for (const info of packet.appEventInfos.slice(0, EVENT_LIMIT)) this.admit(info);
      }
      this.emit('history-package-limit');
    } catch (_) { this.emit('history-unavailable'); }
    finally { this.historyDraining = false; }
  }

  private number(value: Object | undefined): number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : -1;
  }

  private admit(info: hiAppEvent.AppEventInfo): void {
    if (!this.active || info.domain !== hiAppEvent.domain.OS ||
      (info.name !== hiAppEvent.event.MAIN_THREAD_JANK && info.name !== hiAppEvent.event.APP_FREEZE) ||
      info.params['bundle_name'] !== BUNDLE) return;
    const time = this.number(info.params['time']), pid = this.number(info.params['pid']);
    if (time < 0 || pid <= 0) return;
    const key = `${info.name}:${time}:${pid}`;
    if (this.seen.has(key) || this.seen.size >= EVENT_LIMIT) return;
    this.seen.add(key);
    const paths: string[] = [];
    const external = info.params['external_log'];
    // Only the OS event's actual string[] is eligible, never String(value),
    // a callback-log field, a custom param, or a Want-provided descriptor.
    if (Array.isArray(external)) {
      for (let index = 0; index < Math.min(external.length, 4); index++) {
        const path = external[index];
        if (typeof path === 'string' && this.allowedPath(path, info.name, pid)) paths.push(path);
      }
    }
    const heaviest = info.params['heaviest_stack'];
    const event: PlatformDiagnosticEvent = { name: info.name, time, pid, uid: this.number(info.params['uid']),
      beginTime: this.number(info.params['begin_time']), endTime: this.number(info.params['end_time']),
      logOverLimit: info.params['log_over_limit'] === true, paths,
      heaviestStack: typeof heaviest === 'string' ? heaviest.slice(0, 65536) : '' };
    this.tail = this.tail.then(async (): Promise<void> => {
      if (!this.active) return;
      this.emit('event', event);
      this.exportStackText(event.heaviestStack, event);
      for (const path of event.paths) {
        if (!this.active) return;
        await this.exportLog(path, event);
      }
    }).catch((): void => { this.emit('export-failed', event); });
  }

  private allowedPath(path: string, name: string, pid: number): boolean {
    // This fixed sandbox alias is resolved by the OS in Reader's own process.
    // Do not accept physical paths, traversal, symlinks or binary traces.
    if (!path.startsWith(LOG_ROOT) || path.length > 512) return false;
    const relative = path.slice(LOG_ROOT.length);
    const expected = name === hiAppEvent.event.MAIN_THREAD_JANK ? 'MAIN_THREAD_JANK' : 'APP_FREEZE';
    return new RegExp(`^(watchdog|hiappevent)/${expected}_[0-9]{10,20}_${pid}\\.(txt|log)$`).test(relative);
  }

  private async exportLog(path: string, event: PlatformDiagnosticEvent): Promise<void> {
    if (!this.active || this.readBytes >= READ_LIMIT || !this.allowedPath(path, event.name, event.pid)) return;
    let file: fs.File | undefined;
    try {
      const stat = await fs.lstat(path);
      if (!this.active) return;
      if (!stat.isFile() || stat.isSymbolicLink() || !Number.isSafeInteger(stat.size) || stat.size < 0) {
        this.emit('log-unavailable', event); return;
      }
      this.emit('log-present', event);
      if (stat.size === 0) { this.emit('log-complete', event); return; }
      file = await fs.open(path, fs.OpenMode.READ_ONLY);
      const decoder = new util.TextDecoder();
      let position = 0, pending = '';
      const limit = Math.min(stat.size, READ_LIMIT - this.readBytes);
      while (this.active && position < limit && this.emittedBytes < OUTPUT_LIMIT) {
        const length = Math.min(32768, limit - position);
        const bytes = new ArrayBuffer(length);
        const count = await fs.read(file.fd, bytes, { length });
        if (!Number.isSafeInteger(count) || count <= 0 || count > length) break;
        position += count; this.readBytes += count;
        const text = pending + decoder.decodeWithStream(new Uint8Array(bytes, 0, count), { stream: true });
        const lines = text.split('\n'); pending = lines.pop() ?? '';
        for (const line of lines) this.exportStackLine(line, event);
        if (pending.length > 4096) pending = '';
      }
      this.exportStackLine(pending, event);
      this.emit(position < stat.size ? 'log-truncated' : 'log-complete', event);
    } catch (_) { this.emit('log-unavailable', event); }
    finally { if (file !== undefined) { try { await fs.close(file); } catch (_) {} } }
  }

  private exportStackText(text: string, event: PlatformDiagnosticEvent): void {
    for (const line of text.split('\n').slice(0, 512)) this.exportStackLine(line, event);
  }

  private exportStackLine(line: string, event: PlatformDiagnosticEvent): void {
    if (line.length > 2048 || /[\u0000-\u0008\u000b-\u001f\u007f]|https?:\/\/|file:\/\/|(?:password|token|cookie|authorization|secret)\s*[:=]/i.test(line)) return;
    // Export only stack frames/thread headings, not faultlog's embedded hilog,
    // arbitrary params, request URLs, memory maps, or page-switch/user data.
    if (/^\s*(?:(?:[1-9][0-9]*\s+)?#[0-9]{1,3}\s+(?:pc|at)\s|at\s+[A-Za-z_$]|Tid:\s*[0-9]+,\s*Name:|Thread\s+[0-9]+\b)/.test(line))
      this.emit('stack', event, line);
  }

  private emit(kind: string, event?: PlatformDiagnosticEvent, text: string = ''): void {
    if (!this.active) return;
    const row = { kind, event: event?.name ?? '', time: event?.time ?? -1, pid: event?.pid ?? -1,
      uid: event?.uid ?? -1, beginTime: event?.beginTime ?? -1, endTime: event?.endTime ?? -1,
      logOverLimit: event?.logOverLimit ?? false, text };
    const encoded = JSON.stringify(row);
    const bytes = this.encoder.encodeInto(`MANGA_PLATFORM_DIAGNOSTIC ${encoded}`).byteLength;
    if (this.emittedBytes + bytes > OUTPUT_LIMIT) return;
    this.emittedBytes += bytes;
    hilog.info(DOMAIN, TAG, 'MANGA_PLATFORM_DIAGNOSTIC %{public}s', encoded);
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    for (const watcher of this.watchers) { try { hiAppEvent.removeWatcher(watcher); } catch (_) {} }
    this.watchers.length = 0;
    // Join the configuration completion before restoring platform defaults;
    // a late stack-only ACK cannot outlive this debug Ability's owner.
    void this.configuration.then((): Promise<void> => hiAppEvent.setEventConfig(
      hiAppEvent.event.MAIN_THREAD_JANK, { log_type: '0' })).catch((): void => {});
  }
}
