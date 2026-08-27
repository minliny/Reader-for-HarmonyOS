import type { image } from '@kit.ImageKit';

/** One composed CPU-side page snapshot awaiting or backing GPU residency. */
export class ReaderPageRasterRecord {
  key: string;
  componentId: string;
  pixelMap: image.PixelMap;
  generation: number;

  constructor(
    key: string,
    componentId: string,
    pixelMap: image.PixelMap,
    generation: number,
  ) {
    this.key = key;
    this.componentId = componentId;
    this.pixelMap = pixelMap;
    this.generation = generation;
  }
}

/**
 * Bounded previous/current/next CPU raster window.
 *
 * The composed key still contains independent body and chrome identities, but
 * the mounted page is captured once. This avoids six full-screen snapshots,
 * two native PixelMap copies and a CPU RGBA blend for every three-page window.
 */
export class ReaderPageRasterCache {
  private generation: number = 0;
  private records: Map<string, ReaderPageRasterRecord> = new Map();

  beginGeneration(generation: number): void {
    if (!Number.isSafeInteger(generation) || generation < 0 || generation === this.generation) {
      return;
    }
    this.generation = generation;
    this.clear();
  }

  currentGeneration(): number {
    return this.generation;
  }

  admit(record: ReaderPageRasterRecord): boolean {
    if (record.generation !== this.generation || record.key.length === 0) {
      this.releaseRecord(record);
      return false;
    }
    const previous = this.records.get(record.key);
    if (previous !== undefined && previous.pixelMap !== record.pixelMap) {
      this.releaseRecord(previous);
    }
    this.records.set(record.key, record);
    return true;
  }

  has(key: string): boolean {
    return this.fresh(this.records.get(key));
  }

  get(key: string): ReaderPageRasterRecord | undefined {
    const record = this.records.get(key);
    return this.fresh(record) ? record : undefined;
  }

  retain(keys: string[]): void {
    this.retainRecords(new Set(keys));
  }

  clear(): void {
    this.releaseAll();
  }

  size(): number {
    return this.records.size;
  }

  private fresh(record: ReaderPageRasterRecord | undefined): boolean {
    return record !== undefined && record.generation === this.generation;
  }

  private retainRecords(retained: Set<string>): void {
    const obsolete: string[] = [];
    this.records.forEach((_record: ReaderPageRasterRecord, key: string): void => {
      if (!retained.has(key)) obsolete.push(key);
    });
    obsolete.forEach((key: string): void => {
      const record = this.records.get(key);
      if (record !== undefined) this.releaseRecord(record);
      this.records.delete(key);
    });
  }

  private releaseAll(): void {
    this.records.forEach((record: ReaderPageRasterRecord): void => this.releaseRecord(record));
    this.records.clear();
  }

  private releaseRecord(record: ReaderPageRasterRecord): void {
    void record.pixelMap.release().catch((_error: Error): void => {});
  }
}
