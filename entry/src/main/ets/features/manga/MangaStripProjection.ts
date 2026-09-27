import type { MangaManifest, MangaManifestPage } from './MangaContract';
import type { MangaPageGeometry } from './MangaSessionController';

export interface MangaStripRow {
  key: string; ordinal: number; tileIndex: number;
  width: number; height: number; sourceY: number; sourceHeight: number; known: boolean;
}
/** Only geometry and logical identity live here. ArkUI owns list virtualization. */
export class MangaStripProjection {
  private manifest: MangaManifest | undefined;
  private sizes: (MangaPageGeometry | undefined)[] = [];
  private starts: number[] = [];
  private count: number = 0;
  private pageAt: ((ordinal: number) => MangaManifestPage | undefined) | undefined;
  private selected: number | undefined;
  private ordinals: number[] = [];

  publish(manifest: MangaManifest, geometry: (ordinal: number) => MangaPageGeometry | undefined, selected?: number, totalPages: number = manifest.pages.length, pageAt?: (ordinal: number) => MangaManifestPage | undefined): boolean {
    if (selected !== undefined && (!Number.isSafeInteger(selected) || selected < 0 || selected >= totalPages)) throw new Error('MANGA_PAGE_OUT_OF_RANGE');
    if (!Number.isSafeInteger(totalPages) || totalPages < 1 || totalPages > 10000) throw new Error('MANGA_PAGE_COUNT_INVALID');
    const sizes = Array.from({ length: totalPages }, (_value, ordinal) => geometry(ordinal));
    const changed = this.manifest !== manifest || this.selected !== selected || sizes.length !== this.sizes.length || sizes.some((size, index) => size !== this.sizes[index]);
    this.pageAt = pageAt;
    if (!changed) return false;
    const starts: number[] = [];
    let count = 0;
    const ordinals: number[] = [];
    for (let ordinal = 0; ordinal < sizes.length; ordinal++) {
      if (selected !== undefined && selected !== ordinal) continue;
      const size = sizes[ordinal];
      ordinals.push(ordinal);
      starts.push(count);
      if (size !== undefined && (!Number.isFinite(size.width) || !Number.isFinite(size.height) ||
        !Number.isFinite(size.tileHeight) || size.width <= 0 || size.height <= 0 || size.tileHeight <= 0)) throw new Error('MANGA_GEOMETRY_INVALID');
      count += size === undefined ? 1 : Math.ceil(size.height / size.tileHeight);
      if (!Number.isSafeInteger(count) || count > 1000000) throw new Error('MANGA_STRIP_BUDGET');
    }
    this.manifest = manifest; this.sizes = sizes; this.starts = starts; this.count = count; this.selected = selected; this.ordinals = ordinals;
    return true;
  }
  totalCount(): number { return this.count; }
  row(index: number): MangaStripRow {
    if (!Number.isSafeInteger(index) || index < 0 || index >= this.count || this.manifest === undefined) throw new Error('MANGA_ROW_OUT_OF_RANGE');
    const next = this.starts.findIndex(start => start > index);
    const slot = next < 0 ? this.starts.length - 1 : next - 1;
    const ordinal = this.ordinals[slot];
    const tileIndex = index - this.starts[slot];
    const size = this.sizes[ordinal];
    const sourceY = size === undefined ? 0 : tileIndex * size.tileHeight;
    return { key: `${this.pageAt?.(ordinal)?.pageId ?? this.manifest.pages.find(page => page.ordinal === ordinal)?.pageId ?? `placeholder:${this.manifest.manifestVersion}:${ordinal}`}:${tileIndex}`, ordinal, tileIndex,
      width: size?.width ?? 600, height: size === undefined ? 800 : Math.min(size.tileHeight, size.height - sourceY),
      sourceY, sourceHeight: size?.height ?? 800, known: size !== undefined };
  }
  index(ordinal: number, y: number): number {
    const start = this.starts[this.ordinals.indexOf(ordinal)];
    if (start === undefined || !Number.isFinite(y) || y < 0 || y > 1) throw new Error('MANGA_ANCHOR_INVALID');
    const size = this.sizes[ordinal];
    return start + (size === undefined ? 0 : Math.floor(Math.min(size.height - 1, Math.floor(y * size.height)) / size.tileHeight));
  }
  position(index: number, clippedPixels: number, displayWidth: number): number {
    const row = this.row(index);
    if (!row.known || !Number.isFinite(clippedPixels) || !Number.isFinite(displayWidth) || displayWidth <= 0) throw new Error('MANGA_GEOMETRY_REQUIRED');
    return Math.max(0, Math.min(1, (row.sourceY + Math.max(0, clippedPixels) * row.width / displayWidth) / row.sourceHeight));
  }
}
