import type { ReadingBodyImagePayload } from '../platform/reading-resources/ReadingBodyImageHost';

interface MangaDisplayAlias {
  resourceRef: string;
  regionY: number;
  payload: ReadingBodyImagePayload;
}

interface MangaPreparedDisplayPage {
  intrinsicHeight: number;
  tileHeight: number;
  regions: Map<number, MangaDisplayAlias>;
}

/** One optional retained display lease per physical URI. A caller that acquires
 * a prepared region borrows its own lease and can outlive the alias. */
export class MangaDisplayLeaseCache {
  private readonly pages = new Map<string, MangaPreparedDisplayPage>();
  private readonly aliases = new Map<MangaDisplayAlias, boolean>();
  private readonly files = new Map<string, number>();
  private readonly retain: (payload: ReadingBodyImagePayload) => ReadingBodyImagePayload | undefined;
  private readonly release: (uri: string) => void;
  private readonly maximumAliases: number;

  constructor(retain: (payload: ReadingBodyImagePayload) => ReadingBodyImagePayload | undefined,
    release: (uri: string) => void, maximumAliases: number = 64) {
    this.retain = retain;
    this.release = release;
    this.maximumAliases = maximumAliases;
  }

  publish(resourceRef: string, payload: ReadingBodyImagePayload, preview: boolean = false): void {
    if (payload.pixelMap !== undefined) return;
    const regionY = preview ? 0 : payload.regionY ?? 0;
    let page = this.pages.get(resourceRef);
    const previous = page?.regions.get(regionY);
    if (previous?.payload.fileUri === payload.fileUri) {
      this.touch(previous);
      return;
    }
    const count = this.files.get(payload.fileUri);
    if (count === undefined && this.retain(payload) === undefined) return;
    this.files.set(payload.fileUri, (count ?? 0) + 1);
    if (previous !== undefined) this.remove(previous);
    page = this.pages.get(resourceRef);
    if (page === undefined) {
      page = { intrinsicHeight: payload.intrinsicHeight,
        tileHeight: Math.min(payload.intrinsicHeight, 2048, Math.max(1, Math.floor(1024 * 1024 / payload.intrinsicWidth))),
        regions: new Map<number, MangaDisplayAlias>() };
      this.pages.set(resourceRef, page);
    }
    const alias: MangaDisplayAlias = { resourceRef, regionY, payload };
    page.regions.set(regionY, alias);
    this.touch(alias);
    if (this.aliases.size > this.maximumAliases) {
      for (const oldest of this.aliases.keys()) { this.remove(oldest); break; }
    }
  }

  acquire(resourceRef: string, mangaPosition: number, preview: boolean): ReadingBodyImagePayload | undefined {
    const page = this.pages.get(resourceRef);
    if (page === undefined) return undefined;
    const targetY = Math.min(page.intrinsicHeight - 1, Math.floor(mangaPosition * page.intrinsicHeight + 0.000001));
    const regionY = preview ? 0 : Math.floor(targetY / page.tileHeight) * page.tileHeight;
    const alias = page.regions.get(regionY);
    if (alias === undefined || (!preview && (targetY < alias.regionY || targetY >= alias.regionY + alias.payload.height))) return undefined;
    const acquired = this.retain(alias.payload);
    if (acquired === undefined) {
      this.remove(alias);
      return undefined;
    }
    this.touch(alias);
    return acquired;
  }

  close(): void {
    for (const uri of this.files.keys()) this.release(uri);
    this.files.clear();
    this.pages.clear();
    this.aliases.clear();
  }

  private touch(alias: MangaDisplayAlias): void {
    this.aliases.delete(alias);
    this.aliases.set(alias, true);
  }

  private remove(alias: MangaDisplayAlias): void {
    const page = this.pages.get(alias.resourceRef);
    page?.regions.delete(alias.regionY);
    if (page?.regions.size === 0) this.pages.delete(alias.resourceRef);
    this.aliases.delete(alias);
    const uri = alias.payload.fileUri;
    const count = this.files.get(uri) ?? 0;
    if (count > 1) this.files.set(uri, count - 1);
    else if (count === 1) { this.files.delete(uri); this.release(uri); }
  }
}
