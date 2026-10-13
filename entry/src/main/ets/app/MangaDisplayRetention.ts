import fs from '@ohos.file.fs';
import util from '@ohos.util';
import type { ReadingBodyImagePayload } from './ReadingBodyImageHost';
import type { MangaStorageChapter } from './ReadingImageDiskCache';
import { readMangaAtomicPayload } from './MangaAtomicPayloadPort';

interface MangaDisplayRecord {
  format: number;
  key: string;
  owner: MangaStorageChapter;
  payload: ReadingBodyImagePayload;
  fileHash: string;
  fileBytes: number;
}

export interface MangaDisplayInventoryFile { path: string; owners: MangaStorageChapter[]; live: boolean; }

/** Reader's versioned display facts; platform LRU stores metadata, never pixels.
 * The shared disk owner decides retention and eviction. This adapter only
 * validates immutable display files and their geometry for subsequent reads. */
export class MangaDisplayRetention {
  private readonly records: util.LRUCache<string, MangaDisplayRecord> = new util.LRUCache<string, MangaDisplayRecord>(256);
  private readonly recordFingerprints: util.LRUCache<string, string> = new util.LRUCache<string, string>(256);
  private readonly knownFiles = new Set<string>();
  /** Payload files proven during prewarm/store. Scroll lookups consult this
   * in-memory scope first; a miss schedules the normal asynchronous proof. */
  private readonly validatedFiles = new Set<string>();
  private readonly writes = new Set<string>();
  // Serialize publication of one immutable Reader display proof, including
  // its fixed temporary sidecar; this is an I/O ownership lane, not a cache.
  private readonly recordWrites: Map<string, Promise<void>> = new Map<string, Promise<void>>();
  private readonly temporaryOwners: Map<string, MangaStorageChapter> = new Map<string, MangaStorageChapter>();
  private readonly directory: string;
  private readonly hash: (bytes: Uint8Array) => Promise<string>;
  private readonly live: (path: string) => boolean;
  private readonly reads: Map<string, number> = new Map<string, number>();
  private readonly validationTasks = new Set<string>();
  private readonly removals: Set<string> = new Set<string>();
  constructor(directory: string, hash: (bytes: Uint8Array) => Promise<string>, live: (path: string) => boolean) {
    this.directory = directory; this.hash = hash; this.live = live;
  }

  async key(owner: MangaStorageChapter, sourceHash: string, position?: number, preview: boolean = false): Promise<string> {
    // Versioned decode/display profile and exact regional selection are part
    // of identity. New original bytes cannot reuse an old display proof.
    return this.hash(new util.TextEncoder().encodeInto(JSON.stringify([
      'manga-display-v1', owner.sourceId, owner.bookId, owner.chapterId,
      owner.contentVersion, sourceHash, position ?? null, preview,
    ])));
  }

  isRetained(path: string): boolean { return this.knownFiles.has(path); }

  async lookup(key: string, owner: MangaStorageChapter, current: () => boolean,
    acquire?: (payload: ReadingBodyImagePayload) => void): Promise<ReadingBodyImagePayload | undefined> {
    if (!current()) throw new Error('MANGA_RESOURCE_CANCELLED');
    const recordPath = `${this.directory}/manga-display-${key}.json`;
    if (this.removals.has(recordPath)) return undefined;
    this.reads.set(recordPath, (this.reads.get(recordPath) ?? 0) + 1);
    let activePath: string | undefined;
    try {
    const record = this.records.get(key) ?? await this.readRecord(key);
    if (record === undefined || !this.sameOwner(record.owner, owner)) return undefined;
    const path = this.payloadPath(record.payload, key);
    if (path === undefined || this.removals.has(path)) return undefined;
    // A live display lease is expected during backscroll. It is an in-memory
    // ownership fact and must not force another stat/hash on the scroll path.
    // Writes/removals are the only fences that invalidate this fast path;
    // read pins can overlap because the payload is immutable once published.
    if (this.validatedFiles.has(path) && !this.writes.has(path) && !this.removals.has(path)) {
      const payload = { ...record.payload, pixelMap: undefined };
      acquire?.(payload);
      // The record was proven when it entered the in-memory retention set.
      // Keep this scroll path entirely in memory; maintenance/prewarm callers
      // can perform the asynchronous recheck without adding a hash or file
      // read to every backscroll hit.
      this.scheduleValidatedFileCheck(key, record, path, current);
      return payload;
    }
    activePath = path; this.reads.set(path, (this.reads.get(path) ?? 0) + 1);
    if (!(await fs.access(path))) return undefined;
    const stat = await fs.stat(path);
    if (stat.isDirectory() || stat.size !== record.fileBytes || stat.size > 32 * 1024 * 1024) return undefined;
    const bytes = await readMangaAtomicPayload(path, stat.size, 32 * 1024 * 1024, current);
    if (!current()) throw new Error('MANGA_RESOURCE_CANCELLED');
    if (bytes.byteLength !== record.fileBytes || await this.hash(bytes) !== record.fileHash) return undefined;
    if (!current()) throw new Error('MANGA_RESOURCE_CANCELLED');
    this.records.put(key, record); this.knownFiles.add(path); this.validatedFiles.add(path);
    const payload = { ...record.payload, pixelMap: undefined };
    acquire?.(payload);
    return payload;
    } finally {
      this.releaseRead(recordPath);
      if (activePath !== undefined) this.releaseRead(activePath);
    }
  }

  private releaseRead(path: string): void {
    const count = (this.reads.get(path) ?? 1) - 1;
    if (count === 0) this.reads.delete(path); else this.reads.set(path, count);
  }

  /** Recheck a fast-path file off the caller's scroll await. A replacement or
   * deletion is marked invalid for the next request; the current lease remains
   * valid until its normal owner release. */
  private scheduleValidatedFileCheck(key: string, record: MangaDisplayRecord, path: string,
    current: () => boolean): void {
    if (this.validationTasks.has(path)) return;
    this.validationTasks.add(path);
    // Keep the immutable payload pinned while the background proof is in
    // flight. This prevents a maintenance trim from unlinking the file
    // between access/stat and the atomic read, while keeping the caller's
    // scroll await free of filesystem work.
    this.reads.set(path, (this.reads.get(path) ?? 0) + 1);
    // Let the current interaction settle before doing the proof. The delay
    // keeps the caller's scroll burst free of a competing checksum while still
    // surfacing an externally replaced file promptly on the next frame.
    setTimeout((): void => { void (async (): Promise<void> => {
      try {
        if (!current() || !(await fs.access(path))) { this.validatedFiles.delete(path); return; }
        const stat = await fs.stat(path);
        if (stat.isDirectory() || stat.size !== record.fileBytes || stat.size > 32 * 1024 * 1024) {
          this.validatedFiles.delete(path); return;
        }
        const bytes = await readMangaAtomicPayload(path, stat.size, 32 * 1024 * 1024, current);
        if (current() && (bytes.byteLength !== record.fileBytes || await this.hash(bytes) !== record.fileHash)) {
          this.validatedFiles.delete(path);
        }
      } catch (_) { this.validatedFiles.delete(path); }
      finally {
        this.releaseRead(path);
        this.validationTasks.delete(path);
      }
    })(); }, 10);
  }

  private fileBusy(path: string): boolean {
    return this.live(path) || this.writes.has(path) || this.reads.has(path) || this.removals.has(path);
  }

  async store(key: string, owner: MangaStorageChapter, payload: ReadingBodyImagePayload, current: () => boolean): Promise<void> {
    const recordPath = `${this.directory}/manga-display-${key}.json`;
    const previous = this.recordWrites.get(recordPath) ?? Promise.resolve();
    const work = previous.catch((): void => {}).then((): Promise<void> => this.storeRecord(key, owner, payload, current));
    this.recordWrites.set(recordPath, work);
    try { await work; }
    finally { if (this.recordWrites.get(recordPath) === work) this.recordWrites.delete(recordPath); }
  }

  private async storeRecord(key: string, owner: MangaStorageChapter, payload: ReadingBodyImagePayload, current: () => boolean): Promise<void> {
    const path = this.payloadPath(payload, key);
    if (path === undefined) throw new Error('MANGA_DISPLAY_IDENTITY');
    const recordPath = `${this.directory}/manga-display-${key}.json`;
    const temp = `${this.directory}/.manga-display-${key}.tmp`;
    if (!current()) throw new Error('MANGA_RESOURCE_CANCELLED');
    if (this.removals.has(path) || this.removals.has(recordPath) || this.removals.has(temp)) throw new Error('MANGA_CACHE_EVICTING');
    this.writes.add(path); this.writes.add(recordPath); this.writes.add(temp);
    let ownsTemp = false;
    try {
      const stat = await fs.stat(path);
      if (stat.size <= 0 || stat.size > 32 * 1024 * 1024) throw new Error('MANGA_DISPLAY_BUDGET');
      const bytes = await readMangaAtomicPayload(path, stat.size, 32 * 1024 * 1024, current);
      if (!current()) throw new Error('MANGA_RESOURCE_CANCELLED');
      const record: MangaDisplayRecord = { format: 1, key, owner: { ...owner }, payload: { ...payload, pixelMap: undefined },
        fileHash: await this.hash(bytes), fileBytes: bytes.byteLength };
      if (!current()) throw new Error('MANGA_RESOURCE_CANCELLED');
      const encoded = new util.TextEncoder().encodeInto(JSON.stringify(record));
      const file = await fs.open(temp, fs.OpenMode.CREATE | fs.OpenMode.READ_WRITE | fs.OpenMode.TRUNC);
      ownsTemp = true; this.temporaryOwners.set(temp, { ...owner });
      try {
        let offset = 0;
        while (offset < encoded.byteLength) {
          const part = encoded.slice(offset);
          const written = await fs.write(file.fd, part.buffer);
          if (!Number.isSafeInteger(written) || written <= 0 || written > part.byteLength) throw new Error('MANGA_DISPLAY_WRITE');
          offset += written;
        }
      } finally { await fs.close(file); }
      if (!current()) throw new Error('MANGA_RESOURCE_CANCELLED');
      await fs.rename(temp, recordPath);
      ownsTemp = false; this.temporaryOwners.delete(temp);
      this.records.put(key, record); this.knownFiles.add(path); this.validatedFiles.add(path);
      this.recordFingerprints.remove(key);
    } finally {
      // Remove only the temporary file this call opened. Failed unlink stays
      // inventoried; cold unknown leftovers are counted without invented ownership.
      if (ownsTemp) {
        try { if (await fs.access(temp)) await fs.unlink(temp); this.temporaryOwners.delete(temp); }
        catch (_) { /* Disk policy can retry a still-owned temporary file. */ }
      }
      this.writes.delete(path); this.writes.delete(recordPath); this.writes.delete(temp);
    }
  }

  async inventory(): Promise<MangaDisplayInventoryFile[]> {
    const result: MangaDisplayInventoryFile[] = [];
    if (!(await fs.access(this.directory))) return result;
    const owners = new Map<string, MangaStorageChapter[]>();
    for (const name of await fs.listFile(this.directory)) {
      const match = /^manga-display-([0-9a-f]{64})\.json$/.exec(name);
      if (match === null) continue;
      const record = await this.readRecord(match[1]);
      if (record === undefined) continue;
      const path = this.payloadPath(record.payload, match[1]);
      if (path !== undefined) { owners.set(path, [record.owner]); owners.set(`${this.directory}/${name}`, [record.owner]); this.knownFiles.add(path); }
    }
    for (const name of await fs.listFile(this.directory)) {
      if (!/^(reading-body-manga-|manga-display-|\.manga-display-|\.reading-body-tmp-)/.test(name)) continue;
      const path = `${this.directory}/${name}`;
      const temporaryOwner = this.temporaryOwners.get(path);
      result.push({ path, owners: owners.get(path) ?? (temporaryOwner === undefined ? [] : [temporaryOwner]), live: this.fileBusy(path) });
    }
    return result;
  }

  async remove(owner: MangaStorageChapter, files: MangaDisplayInventoryFile[],
    current?: () => Promise<boolean>): Promise<boolean> {
    const selected = files.filter(file => file.owners.some(candidate => this.sameOwner(candidate, owner)))
      .sort((a, b): number => Number(a.path.endsWith('.json')) - Number(b.path.endsWith('.json')));
    // The caller holds a Core grant and the disk mutation fence. A newer view
    // may acquire a file while inventory awaits I/O: recheck actual live leases.
    if (selected.some(file => this.fileBusy(file.path) || file.owners.some(candidate => !this.sameOwner(candidate, owner)))) return false;
    for (const file of selected) this.removals.add(file.path);
    try {
    for (const file of selected) {
      if (!file.path.startsWith(`${this.directory}/`) || file.path.slice(this.directory.length + 1).includes('/')) return false;
      if (current !== undefined && !(await current())) return false;
      if (this.live(file.path) || this.writes.has(file.path) || this.reads.has(file.path)) return false;
      if (await fs.access(file.path)) {
        if (current !== undefined && !(await current())) return false;
        if (this.live(file.path) || this.writes.has(file.path) || this.reads.has(file.path)) return false;
        await fs.unlink(file.path);
      }
      this.knownFiles.delete(file.path); this.temporaryOwners.delete(file.path);
      this.validatedFiles.delete(file.path);
      const match = /manga-display-([0-9a-f]{64})\.json$/.exec(file.path);
      if (match !== null) { this.records.remove(match[1]); this.recordFingerprints.remove(match[1]); }
    }
    return true;
    } finally { for (const file of selected) this.removals.delete(file.path); }
  }

  /**
   * Remove only rebuildable display derivatives that are currently idle.
   *
   * This is intentionally separate from the Core-owned manga eviction grant:
   * a VM maintenance run may reclaim derived display files to recover space,
   * while downloaded originals, manifests and reading progress remain owned by
   * their normal authorities. Live leases, writes and reads are skipped so a
   * maintenance request cannot invalidate an on-screen image.
   */
  async clearRebuildable(current: () => boolean = (): boolean => true): Promise<number> {
    const files = await this.inventory();
    // A cold/partial sidecar has no proven chapter owner. Keep it for the
    // normal inventory/recovery path rather than inferring that an unknown
    // file is disposable merely from its filename.
    const selected = files.filter(file => file.owners.length > 0 && !this.fileBusy(file.path));
    for (const file of selected) this.removals.add(file.path);
    let removed = 0;
    try {
      for (const file of selected) {
        if (!current() || this.live(file.path) || this.writes.has(file.path) || this.reads.has(file.path)) continue;
        if (!file.path.startsWith(`${this.directory}/`) || file.path.slice(this.directory.length + 1).includes('/')) continue;
        if (await fs.access(file.path)) {
          if (!current() || this.live(file.path) || this.writes.has(file.path) || this.reads.has(file.path)) continue;
          await fs.unlink(file.path);
        }
        this.knownFiles.delete(file.path); this.temporaryOwners.delete(file.path);
        this.validatedFiles.delete(file.path);
        const match = /manga-display-([0-9a-f]{64})\.json$/.exec(file.path);
        if (match !== null) { this.records.remove(match[1]); this.recordFingerprints.remove(match[1]); }
        removed++;
      }
    } finally { for (const file of selected) this.removals.delete(file.path); }
    return removed;
  }

  private sameOwner(a: MangaStorageChapter, b: MangaStorageChapter): boolean {
    return a.sourceId === b.sourceId && a.bookId === b.bookId && a.chapterId === b.chapterId && a.contentVersion === b.contentVersion;
  }

  private payloadPath(payload: ReadingBodyImagePayload, key: string): string | undefined {
    const prefix = `file://${this.directory}/reading-body-manga-${key}-`;
    if (typeof payload.fileUri !== 'string' || !payload.fileUri.startsWith(prefix) || payload.fileUri.slice(prefix.length).includes('/')) return undefined;
    return payload.fileUri.slice('file://'.length);
  }

  private async readRecord(key: string): Promise<MangaDisplayRecord | undefined> {
    const path = `${this.directory}/manga-display-${key}.json`;
    try {
      if (!(await fs.access(path))) return undefined;
      const stat = await fs.stat(path);
      if (stat.size <= 0 || stat.size > 65536 || stat.isDirectory()) return undefined;
      const fingerprint = this.recordFingerprint(stat);
      const cached = this.records.get(key);
      if (fingerprint !== undefined && fingerprint === this.recordFingerprints.get(key) && cached !== undefined) return cached;
      const bytes = await readMangaAtomicPayload(path, stat.size, 65536, (): boolean => !this.removals.has(path), true);
      const record = JSON.parse(new util.TextDecoder().decodeWithStream(bytes)) as MangaDisplayRecord;
      const p = record.payload;
      if (record.format !== 1 || record.key !== key || !/^[0-9a-f]{64}$/.test(record.fileHash) ||
        !Number.isSafeInteger(record.fileBytes) || record.fileBytes <= 0 || record.fileBytes > 32 * 1024 * 1024 ||
        record.owner === undefined || [record.owner.sourceId, record.owner.bookId, record.owner.chapterId, record.owner.contentVersion].some(value => typeof value !== 'string' || value.trim().length === 0) ||
        p === undefined || [p.width, p.height, p.intrinsicWidth, p.intrinsicHeight].some(value => !Number.isSafeInteger(value) || value <= 0) ||
        typeof p.revision !== 'string' || this.payloadPath(p, key) === undefined) return undefined;
      const after = await fs.stat(path);
      if (fingerprint !== undefined && this.recordFingerprint(after) !== fingerprint) return undefined;
      this.records.put(key, record);
      if (fingerprint !== undefined) this.recordFingerprints.put(key, fingerprint);
      else this.recordFingerprints.remove(key);
      return record;
    } catch (_) { return undefined; }
  }

  /** Reuse the existing platform metadata LRU only for an unchanged inode and
   * nanosecond clocks. Coarse clocks or same-size writes must reread the proof. */
  private recordFingerprint(stat: fs.Stat): string | undefined {
    if (typeof stat.mtimeNs !== 'bigint' || typeof stat.ctimeNs !== 'bigint') return undefined;
    return `${stat.ino}:${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}`;
  }
}
