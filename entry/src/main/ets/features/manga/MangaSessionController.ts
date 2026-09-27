import type { JsonObject } from '@reader/core-harmony';
import type { ReadingGatewayImage, ReadingGatewayRuntime } from '../reading/ReadingGatewayRuntime';
import type { MangaChapterResult, MangaLocation, MangaProgressState, MangaManifestPage, MangaResourceRequest, MangaProgressMapping, MangaAnchorMapping } from './MangaContract';
import { MangaSessionGateway, MangaPreparedEntry } from './MangaSessionGateway';
import { MangaResourceGateway, MangaResourcePage, MangaResourceScope } from './MangaResourceGateway';

interface MangaProgressCursor { state: MangaProgressState; }
interface MangaNextChapter { index: number; url: string; }
interface MangaNextImage { scope: MangaResourceScope; page: MangaResourcePage; }

export interface MangaTileRequest { ordinal: number; tileIndex: number; }
export interface MangaTile { ordinal: number; tileIndex: number; image?: ReadingGatewayImage; error?: string; }
export interface MangaPageGeometry { width: number; height: number; tileHeight: number; }

export interface MangaVisiblePage {
  ordinal: number; pageId: string; status: 'pending' | 'ready' | 'failed';
  image?: ReadingGatewayImage; error?: string;
}
/** Session policy only: Host continues to own scheduling, bytes and decoding. */
export class MangaSessionController {
  private static progressLanes: WeakMap<ReadingGatewayRuntime, Map<string, Promise<void>>> = new WeakMap();
  private readonly runtime: ReadingGatewayRuntime;
  private progressCursor: MangaProgressCursor | undefined;
  private readonly gateway: MangaSessionGateway;
  private readonly resources: MangaResourceGateway;
  private generation: number = 0;
  private visibilityRevision: number = 0;
  private chapterData: MangaChapterResult | undefined;
  private readonly facts: Map<number, MangaManifestPage> = new Map<number, MangaManifestPage>();
  private readonly requests: Map<string, MangaResourceRequest> = new Map<string, MangaResourceRequest>();
  private totalPageCount: number = 0;
  private displayOrdinal: number = 0;
  private selectionRevision: number = 0;
  private progressData: MangaProgressState | undefined;
  private readonly pages: Map<number, MangaVisiblePage> = new Map<number, MangaVisiblePage>();
  private readonly pageLoads: Map<number, Promise<void>> = new Map<number, Promise<void>>();
  private readonly geometry: Map<number, MangaPageGeometry> = new Map<number, MangaPageGeometry>();
  private readonly tiles: Map<string, MangaTile> = new Map<string, MangaTile>();
  private wantedTiles: Set<string> = new Set<string>();
  private sliced: boolean = false;
  private wanted: Set<number> = new Set<number>();
  private requiresRecovery: boolean = false;
  private allowNetwork: boolean = true;
  private previewMode: boolean = false;
  private mappedLocation: MangaLocation | undefined;
  private signatureRecoveryUsed: boolean = false;
  private sessionContentCurrent: () => boolean = (): boolean => false;
  private nextChapter: MangaNextChapter | undefined;
  private nextImage: MangaNextImage | undefined;
  private nextPreparationRevision: number = 0;
  private nextManifestAttempted: boolean = false;
  private nextImageAttempted: boolean = false;
  private nextImagePending: boolean = false;
  private foregroundImageWork: number = 0;
  private foregroundWindowWork: number = 0;
  onChange: (() => void) | undefined;

  constructor(runtime: ReadingGatewayRuntime) {
    this.runtime = runtime;
    this.gateway = new MangaSessionGateway(runtime);
    this.resources = new MangaResourceGateway(runtime);
  }
  pageGeometry(ordinal: number): MangaPageGeometry | undefined { return this.geometry.get(ordinal); }
  tile(ordinal: number, tileIndex: number): MangaTile | undefined { return this.tiles.get(`${ordinal}:${tileIndex}`); }
  get totalPages(): number { return this.totalPageCount; }
  get displayedOrdinal(): number { return this.displayOrdinal; }
  pageAt(ordinal: number): MangaManifestPage | undefined { return this.facts.get(ordinal); }
  get chapter(): MangaChapterResult | undefined { return this.chapterData; }
  get recoveryRequired(): boolean { return this.requiresRecovery; }
  get savedLocation(): MangaLocation | null { return this.mappedLocation ?? this.progressData?.location ?? null; }
  visiblePages(): MangaVisiblePage[] { return Array.from(this.pages.values()).sort((a, b) => a.ordinal - b.ordinal); }

  /** Canonical catalog supplies the next readable identity. No ordinal + 1
   * guess, automatic admission, progress write, or download queue mutation. */
  configureNextChapter(index?: number, url?: string): void {
    const chapter = this.chapterData;
    const valid = chapter !== undefined && Number.isSafeInteger(index) && index !== undefined && index >= 0 &&
      index !== chapter.chapterIndex && typeof url === 'string' && url.trim().length > 0 && url !== chapter.manifest.chapter.chapterId;
    const next: MangaNextChapter | undefined = valid ? { index: index!, url: url! } : undefined;
    if (this.nextChapter?.index === next?.index && this.nextChapter?.url === next?.url) return;
    this.resetAdjacentPreparation(); this.nextChapter = next;
    this.scheduleAdjacentPreparation();
  }

  private captureSessionContent(chapter: MangaChapterResult): void {
    this.sessionContentCurrent = this.runtime.captureReadingContentValidity?.(chapter.manifest.chapter.sourceId, chapter.manifest.chapter.bookId) ?? ((): boolean => true);
  }

  private resetAdjacentPreparation(): void {
    this.nextPreparationRevision++; this.nextImage = undefined;
    this.nextManifestAttempted = false; this.nextImageAttempted = false; this.nextImagePending = false;
  }
  private scheduleAdjacentPreparation(): void {
    const chapter = this.chapterData;
    const next = this.nextChapter;
    if (!this.allowNetwork || chapter === undefined || next === undefined || this.pages.get(this.displayOrdinal)?.status !== 'ready') return;
    const generation = this.generation;
    const revision = this.nextPreparationRevision;
    const validContent = this.sessionContentCurrent;
    const current = (): boolean => generation === this.generation && revision === this.nextPreparationRevision && this.chapterData === chapter && validContent();
    if (!this.nextManifestAttempted) {
      this.nextManifestAttempted = true;
      void this.gateway.chapter(chapter.manifest.chapter.sourceId, chapter.manifest.chapter.bookId, next.index, 'cacheFirst', current)
        .then((prepared: MangaChapterResult): void => {
          if (!current() || prepared.manifest.chapter.chapterId !== next.url || prepared.manifest.sourceRuleVersion !== chapter.manifest.sourceRuleVersion) return;
          const first = prepared.manifest.pages[0];
          const request = prepared.resources.find(resource => resource.resourceRef === first.resourceRef)?.request;
          if (request === undefined) return;
          // Canonical manifest remains in Core. Retain only the first resource.
          this.nextImage = { scope: { sourceId: prepared.manifest.chapter.sourceId, bookId: prepared.manifest.chapter.bookId,
            chapterIndex: prepared.chapterIndex, chapterUrl: prepared.manifest.chapter.chapterId,
            contentVersion: prepared.manifest.manifestVersion, sourceRuleVersion: prepared.manifest.sourceRuleVersion, decodeRevision: prepared.manifest.decodeRevision },
            page: { ...request, resourceRef: first.resourceRef } };
          this.scheduleAdjacentPreparation();
        }).catch((): void => { /* Optional neighbor errors never replace visible chapter state. */ });
      return;
    }
    const image = this.nextImage;
    const nearEnd = (): boolean => this.displayOrdinal >= Math.max(0, this.totalPageCount - 2);
    if (image === undefined || this.nextImageAttempted || this.nextImagePending || !nearEnd() || this.foregroundImageWork > 0 || this.foregroundWindowWork > 0) return;
    this.nextImageAttempted = true; this.nextImagePending = true;
    let revoked = false;
    const resourceCurrent = (): boolean => {
      const valid = current() && nearEnd() && this.foregroundImageWork === 0;
      if (!valid) revoked = true;
      return valid;
    };
    void this.resources.prefetchPage(image.scope, image.page, resourceCurrent).catch((): void => {
      // A real failure is attempted once. Cancellation may resume after the
      // newer foreground window finishes, using the same persistent cache.
    }).finally((): void => {
      if (!current()) return;
      this.nextImagePending = false;
      if (revoked) { this.nextImageAttempted = false; this.scheduleAdjacentPreparation(); }
    });
  }

  /** Presentation change only: keep facts, CAS and normalized location intact. */
  async setPreviewMode(preview: boolean, ordinal: number = 0): Promise<void> {
    if (this.previewMode === preview) return;
    this.previewMode = preview;
    this.resetAdjacentPreparation();
    this.generation++;
    for (const page of this.pages.values()) if (page.image !== undefined) this.resources.release(page.image);
    for (const tile of this.tiles.values()) if (tile.image !== undefined) this.resources.release(tile.image);
    this.pages.clear(); this.pageLoads.clear(); this.tiles.clear(); this.wantedTiles.clear(); this.geometry.clear(); this.wanted.clear(); this.sliced = false;
    if (this.chapterData !== undefined) await this.setVisible(ordinal);
  }

  private admitFacts(chapter: MangaChapterResult): void {
    for (const fact of chapter.manifest.pages) this.facts.set(fact.ordinal, fact);
    for (const request of chapter.resources) this.requests.set(request.resourceRef, request);
  }

  async openPrepared(entry: MangaPreparedEntry, offline: boolean = false): Promise<void> {
    this.close();
    this.allowNetwork = !offline;
    this.chapterData = entry.chapter;
    this.captureSessionContent(entry.chapter);
    this.totalPageCount = entry.chapter.totalPages;
    this.admitFacts(entry.chapter);
    this.progressData = entry.progress; this.progressCursor = { state: entry.progress };
    this.mappedLocation = this.mapLocation(entry.chapter, entry.progress, entry.progressMapping);
    this.requiresRecovery = entry.recoveryRequired;
    const admittedGeneration = await this.setVisible(entry.targetOrdinal);
    if (admittedGeneration !== this.generation) throw new Error('MANGA_SESSION_CANCELLED');
  }

  async open(sourceId: string, bookId: string, chapterIndex: number, offline: boolean = false, resumeIntent: boolean = false,
    directoryTargetProof?: JsonObject): Promise<void> {
    this.close();
    const generation = this.generation;
    const current = (): boolean => generation === this.generation;
    this.allowNetwork = !offline;
    await this.awaitPendingProgress(sourceId, bookId);
    if (!current()) throw new Error('MANGA_SESSION_CANCELLED');
    const values = await Promise.all([
      this.gateway.chapter(sourceId, bookId, chapterIndex, offline ? 'cacheOnly' : 'cacheFirst', current,
        undefined, undefined, undefined, directoryTargetProof),
      this.gateway.progress(sourceId, bookId, current),
    ]);
    if (!current()) throw new Error('MANGA_SESSION_CANCELLED');
    this.chapterData = values[0];
    this.captureSessionContent(values[0]);
    this.totalPageCount = values[0].manifest.pages.length;
    this.admitFacts(values[0]);
    this.progressData = values[1]; this.progressCursor = { state: values[1] };
    this.mappedLocation = this.mapLocation(values[0], values[1], values[0].progressMapping);
    const saved = this.mappedLocation ?? values[1].location;
    const manifest = values[0].manifest;
    const exact = saved !== null && saved.chapter.chapterId === manifest.chapter.chapterId &&
      saved.manifestVersion === manifest.manifestVersion && manifest.pages.some(page => page.pageId === saved.pageId);
    // An implicit resume may fall back to a different catalog chapter after
    // the original URL disappears. Showing that fallback cannot replace the
    // durable position until the user confirms it. Explicit chapter navigation
    // remains an intentional change of chapter.
    this.requiresRecovery = saved !== null && !exact && (resumeIntent || saved.chapter.chapterId === manifest.chapter.chapterId);
    const ordinal = exact ? saved!.pageOrdinalFallback : 0;
    const admittedGeneration = await this.setVisible(ordinal);
    if (admittedGeneration !== this.generation) throw new Error('MANGA_SESSION_CANCELLED');
  }

  /** User-requested reparse. Failed acquisition leaves the old view intact. */
  async refreshChapter(anchorOrdinal?: number): Promise<void> {
    const chapter = this.chapterData;
    if (chapter === undefined || !this.allowNetwork) throw new Error('MANGA_REFRESH_REQUIRES_NETWORK');
    const generation = this.generation;
    const selection = this.selectionRevision;
    const current = (): boolean => generation === this.generation && selection === this.selectionRevision;
    const pendingRecovery = this.requiresRecovery;
    const signatureRecoveryUsed = this.signatureRecoveryUsed;
    const nextChapter = this.nextChapter;
    const anchorPage = anchorOrdinal === undefined ? undefined : this.facts.get(anchorOrdinal);
    if (anchorOrdinal !== undefined && anchorPage === undefined) throw new Error('MANGA_REFRESH_ANCHOR_REQUIRED');
    const priorLocation = this.savedLocation;
    const anchorX = priorLocation?.manifestVersion === chapter.manifest.manifestVersion && priorLocation.pageId === anchorPage?.pageId ? priorLocation.x : 0;
    const anchorY = priorLocation?.manifestVersion === chapter.manifest.manifestVersion && priorLocation.pageId === anchorPage?.pageId ? priorLocation.y : 0;
    const replacement = await this.gateway.chapter(chapter.manifest.chapter.sourceId,
      chapter.manifest.chapter.bookId, chapter.chapterIndex, 'refresh', current, chapter.manifest.manifestVersion, undefined,
      anchorPage === undefined ? undefined : { pageId: anchorPage.pageId, ordinal: anchorPage.ordinal });
    const progress = await this.gateway.progress(chapter.manifest.chapter.sourceId, chapter.manifest.chapter.bookId, current);
    if (!current()) throw new Error('MANGA_SESSION_CANCELLED');
    this.close();
    this.signatureRecoveryUsed = signatureRecoveryUsed;
    this.chapterData = replacement; this.progressData = progress; this.progressCursor = { state: progress };
    this.captureSessionContent(replacement);
    this.totalPageCount = replacement.manifest.pages.length; this.admitFacts(replacement);
    this.mappedLocation = anchorPage === undefined ? this.mapLocation(replacement, progress, replacement.progressMapping) :
      this.mapAnchor(chapter, replacement, progress, anchorPage, anchorX, anchorY, replacement.anchorMapping);
    this.requiresRecovery = anchorPage === undefined ?
      this.mappedLocation === undefined && (pendingRecovery || (progress.location !== null && progress.location.chapter.chapterId === replacement.manifest.chapter.chapterId)) :
      pendingRecovery || this.mappedLocation === undefined;
    const target = this.mappedLocation?.pageOrdinalFallback ?? Math.min(anchorOrdinal ?? 0, this.totalPageCount - 1);
    const admittedGeneration = await this.setVisible(target);
    if (admittedGeneration !== this.generation) throw new Error('MANGA_SESSION_CANCELLED');
    if (nextChapter !== undefined) this.configureNextChapter(nextChapter.index, nextChapter.url);
  }

  private mapLocation(chapter: MangaChapterResult, progress: MangaProgressState, mapping?: MangaProgressMapping): MangaLocation | undefined {
    const saved = progress.location;
    if (saved === null || mapping?.status !== 'exact' || saved.chapter.sourceId !== chapter.manifest.chapter.sourceId ||
      saved.chapter.bookId !== chapter.manifest.chapter.bookId || saved.chapter.chapterId !== chapter.manifest.chapter.chapterId ||
      mapping.fromManifestVersion !== saved.manifestVersion || mapping.fromPageId !== saved.pageId ||
      mapping.progressRevision !== progress.token.revision || mapping.targetOrdinal === undefined || mapping.targetPageId === undefined ||
      !chapter.manifest.pages.some(page => page.pageId === mapping.targetPageId && page.ordinal === mapping.targetOrdinal)) return undefined;
    return { ...saved, manifestVersion: chapter.manifest.manifestVersion, pageId: mapping.targetPageId, pageOrdinalFallback: mapping.targetOrdinal };
  }

  private mapAnchor(previous: MangaChapterResult, replacement: MangaChapterResult, progress: MangaProgressState,
    anchor: MangaManifestPage, x: number, y: number, proof?: MangaAnchorMapping): MangaLocation | undefined {
    if (proof?.status !== 'exact' || proof.fromManifestVersion !== previous.manifest.manifestVersion || proof.fromPageId !== anchor.pageId ||
      proof.targetOrdinal === undefined || proof.targetPageId === undefined ||
      previous.manifest.chapter.chapterId !== replacement.manifest.chapter.chapterId ||
      !replacement.manifest.pages.some(page => page.pageId === proof.targetPageId && page.ordinal === proof.targetOrdinal)) return undefined;
    return { kind: 'manga', chapter: replacement.manifest.chapter, manifestVersion: replacement.manifest.manifestVersion,
      pageId: proof.targetPageId, pageOrdinalFallback: proof.targetOrdinal, x, y, progressRevision: progress.token.revision };
  }

  /** Explicit navigation acknowledges approximate/unresolved recovery. */
  async selectPage(ordinal: number): Promise<void> {
    const generation = this.generation;
    const admittedGeneration = await this.setVisible(ordinal);
    if (admittedGeneration !== this.generation) throw new Error('MANGA_SESSION_CANCELLED');
    // Selecting an old fact cannot acknowledge an unproven replacement.
    if (generation === this.generation) this.requiresRecovery = false;
  }

  async setVisible(ordinal: number): Promise<number> {
    const chapter = this.chapterData;
    if (chapter === undefined || !Number.isSafeInteger(ordinal) || ordinal < 0 || ordinal >= this.totalPageCount) throw new Error('MANGA_PAGE_OUT_OF_RANGE');
    this.foregroundWindowWork++;
    try {
      if (this.displayOrdinal !== ordinal) this.selectionRevision++;
      this.displayOrdinal = ordinal;
      const generation = this.generation;
      const visibility = ++this.visibilityRevision;
      const current = (): boolean => generation === this.generation && visibility === this.visibilityRevision;
      const start = Math.max(0, ordinal - 1);
      const limit = Math.min(3, this.totalPageCount - start);
      if (Array.from({ length: limit }, (_value, index) => start + index).some(index => !this.facts.has(index))) {
        const window = await this.gateway.window(chapter, start, limit, current);
        if (!current() || window.totalPages !== this.totalPageCount) throw new Error('MANGA_SESSION_CANCELLED');
        this.admitFacts(window);
      }
      const wanted = new Set<number>();
      for (let i = Math.max(0, ordinal - 1); i <= Math.min(this.totalPageCount - 1, ordinal + 1); i++) wanted.add(i);
      this.wanted = wanted;
      for (const [index, page] of this.pages) {
        if (!wanted.has(index)) {
          if (page.image !== undefined) this.resources.release(page.image);
          this.pages.delete(index);
        }
      }
      // Current page is admitted first; neighbors share the existing Host owner.
      await this.loadPage(ordinal, chapter, generation);
      if (!current()) {
        if (generation === this.generation && this.displayOrdinal !== ordinal) throw new Error('MANGA_SESSION_CANCELLED');
        return generation;
      }
      const failure = this.pages.get(ordinal);
      if (failure?.status === 'failed' && failure.error === 'READING_IMAGE_SIGNATURE_EXPIRED' &&
        this.allowNetwork && !this.signatureRecoveryUsed) {
        // The visible page alone may trigger one recovery. A refreshed manifest
        // cannot form an unbounded refresh loop if its credentials also expired.
        this.signatureRecoveryUsed = true;
        await this.refreshChapter(ordinal);
        return this.generation;
      }
      // The first readable region must not wait for optional neighbor traffic.
      void Promise.all(Array.from(wanted).filter(index => index !== ordinal)
        .map(index => this.loadPage(index, chapter, generation))).catch((): void => {});
      this.scheduleAdjacentPreparation();
      return generation;
    } finally { this.foregroundWindowWork--; this.scheduleAdjacentPreparation(); }
  }

  async retry(ordinal: number): Promise<void> {
    const existing = this.pages.get(ordinal);
    if (existing?.status !== 'failed' || !this.wanted.has(ordinal) || this.chapterData === undefined) return;
    this.pages.delete(ordinal);
    await this.loadPage(ordinal, this.chapterData, this.generation);
  }

  async awaitPendingProgress(sourceId: string, bookId: string): Promise<void> {
    const lanes = MangaSessionController.progressLanes.get(this.runtime);
    const key = JSON.stringify([sourceId, bookId]);
    const pending = lanes?.get(key);
    try { await pending; }
    finally { if (lanes?.get(key) === pending) lanes?.delete(key); }
  }

  /** Freeze the actually displayed fact before releasing the view's resources. */
  async savePosition(ordinal: number, x: number, y: number): Promise<void> {
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) throw new Error('MANGA_PROGRESS_INVALID');
    const chapter = this.chapterData;
    const cursor = this.progressCursor;
    const page = this.facts.get(ordinal);
    if (chapter === undefined || cursor === undefined || page === undefined || this.pages.get(ordinal)?.status !== 'ready') throw new Error('MANGA_POSITION_NOT_VISIBLE');
    if (this.sliced) {
      const geometry = this.geometry.get(ordinal);
      const tileIndex = geometry === undefined ? -1 : Math.floor(Math.min(geometry.height - 1, Math.floor(y * geometry.height)) / geometry.tileHeight);
      if (this.tiles.get(`${ordinal}:${tileIndex}`)?.image === undefined) throw new Error('MANGA_POSITION_NOT_VISIBLE');
    }
    if (this.requiresRecovery) throw new Error('MANGA_POSITION_RECOVERY_REQUIRED');
    const identity = chapter.manifest.chapter;
    const current = this.runtime.captureReadingContentValidity?.(identity.sourceId, identity.bookId) ?? ((): boolean => true);
    let lanes = MangaSessionController.progressLanes.get(this.runtime);
    if (lanes === undefined) { lanes = new Map<string, Promise<void>>(); MangaSessionController.progressLanes.set(this.runtime, lanes); }
    const key = JSON.stringify([identity.sourceId, identity.bookId]);
    const predecessor = lanes.get(key) ?? Promise.resolve();
    const task = predecessor.then(async (): Promise<void> => {
      if (!current()) throw new Error('MANGA_SESSION_CANCELLED');
      const progress = cursor.state;
      const location: MangaLocation = { kind: 'manga', chapter: identity,
        manifestVersion: chapter.manifest.manifestVersion, pageId: page.pageId, pageOrdinalFallback: ordinal,
        x, y, progressRevision: progress.token.revision + 1 };
      cursor.state = await this.gateway.save(location, progress.token, current);
      if (this.progressCursor === cursor) { this.progressData = cursor.state; this.mappedLocation = undefined; }
    });
    lanes.set(key, task);
    const ownedLanes = lanes;
    // Keep a failed tail until an explicit reopen observes the failure; never
    // silently replace an unknown write with an older read position.
    void task.then((): void => { if (ownedLanes.get(key) === task) ownedLanes.delete(key); }, (): void => {});
    await task;
  }

  close(): void {
    this.resetAdjacentPreparation(); this.nextChapter = undefined; this.sessionContentCurrent = (): boolean => false;
    this.generation++;
    for (const page of this.pages.values()) if (page.image !== undefined) this.resources.release(page.image);
    for (const tile of this.tiles.values()) if (tile.image !== undefined) this.resources.release(tile.image);
    this.tiles.clear(); this.wantedTiles.clear(); this.sliced = false; this.geometry.clear();
    this.pages.clear(); this.pageLoads.clear(); this.wanted.clear(); this.chapterData = undefined; this.progressData = undefined; this.progressCursor = undefined;
    this.requiresRecovery = false; this.mappedLocation = undefined; this.signatureRecoveryUsed = false; this.facts.clear(); this.requests.clear(); this.totalPageCount = 0; this.displayOrdinal = 0;
    this.onChange?.();
  }

  /** Viewport tiles are temporary and never become logical page identities. */
  async setTileWindow(requested: MangaTileRequest[]): Promise<void> {
    const chapter = this.chapterData;
    if (chapter === undefined) return;
    if (requested.length > 8) throw new Error('MANGA_TILE_WINDOW_BUDGET');
    const wanted = new Set(requested.map(item => `${item.ordinal}:${item.tileIndex}`));
    this.wantedTiles = wanted;
    this.sliced = true;
    for (const [key, tile] of this.tiles) {
      if (!wanted.has(key)) {
        if (tile.image !== undefined) this.resources.release(tile.image);
        this.tiles.delete(key);
      }
    }
    // Promote the already decoded first region without a second decode or a
    // queue wait behind optional neighbors. Transfer, rather than duplicate, its lease.
    for (const item of requested) {
      const key = `${item.ordinal}:${item.tileIndex}`;
      const page = this.pages.get(item.ordinal);
      if (item.tileIndex === 0 && page?.image !== undefined && !this.tiles.has(key)) {
        this.tiles.set(key, { ordinal: item.ordinal, tileIndex: 0, image: page.image });
        page.image = undefined;
      }
    }
    this.onChange?.();
    // Remaining metadata decode leases are no longer needed after switching to slices.
    for (const page of this.pages.values()) {
      if (page.image !== undefined) { this.resources.release(page.image); page.image = undefined; }
    }
    const generation = this.generation;
    for (const item of requested) {
      const geometry = this.geometry.get(item.ordinal);
      const fact = this.facts.get(item.ordinal);
      if (geometry === undefined || fact === undefined || !Number.isSafeInteger(item.tileIndex) || item.tileIndex < 0 || item.tileIndex * geometry.tileHeight >= geometry.height) continue;
      const key = `${item.ordinal}:${item.tileIndex}`;
      if (generation !== this.generation || !this.wantedTiles.has(key)) continue;
      if (this.tiles.has(key)) continue;
      const tile: MangaTile = { ordinal: item.ordinal, tileIndex: item.tileIndex };
      this.tiles.set(key, tile);
      const current = (): boolean => generation === this.generation && this.wantedTiles.has(key) && this.tiles.get(key) === tile;
      const request = this.requests.get(fact.resourceRef)?.request;
      this.foregroundImageWork++;
      try {
        const image = await this.resources.loadPage({ sourceRuleVersion: chapter.manifest.sourceRuleVersion, decodeRevision: chapter.manifest.decodeRevision, sourceId: chapter.manifest.chapter.sourceId,
          bookId: chapter.manifest.chapter.bookId, chapterIndex: chapter.chapterIndex,
          contentVersion: chapter.manifest.manifestVersion, chapterUrl: chapter.manifest.chapter.chapterId },
          { ...(request ?? { url: fact.resourceRef }), resourceRef: fact.resourceRef },
          this.allowNetwork && request !== undefined, current, (item.tileIndex * geometry.tileHeight) / geometry.height, this.previewMode);
        if (!current()) { this.resources.release(image); continue; }
        tile.image = image;
      } catch (error) { if (current()) tile.error = error instanceof Error ? error.message : 'MANGA_TILE_FAILED'; }
      finally { this.foregroundImageWork--; this.scheduleAdjacentPreparation(); }
      if (current()) this.onChange?.();
    }
  }

  async retryTile(ordinal: number, tileIndex: number): Promise<void> {
    const key = `${ordinal}:${tileIndex}`;
    if (!this.wantedTiles.has(key) || this.tiles.get(key)?.error === undefined) return;
    this.tiles.delete(key);
    await this.setTileWindow(Array.from(this.wantedTiles).map(value => {
      const parts = value.split(':');
      return { ordinal: Number(parts[0]), tileIndex: Number(parts[1]) };
    }));
  }

  private loadPage(ordinal: number, chapter: MangaChapterResult, generation: number): Promise<void> {
    if (generation !== this.generation || !this.wanted.has(ordinal)) return Promise.resolve();
    // A prefetched neighbor becoming current must join its actual decode.
    // A page evicted and reentered has a new attempt, even in the same chapter.
    if (this.pages.get(ordinal)?.status === 'pending') {
      const pending = this.pageLoads.get(ordinal);
      if (pending !== undefined) return pending;
    }
    const task = this.loadPageOwned(ordinal, chapter, generation);
    this.pageLoads.set(ordinal, task);
    const finish = (): void => {
      if (this.pageLoads.get(ordinal) === task) this.pageLoads.delete(ordinal);
    };
    void task.then(finish, finish);
    return task;
  }

  private async loadPageOwned(ordinal: number, chapter: MangaChapterResult, generation: number): Promise<void> {
    if (generation !== this.generation || !this.wanted.has(ordinal) || this.pages.has(ordinal)) return;
    const fact = this.facts.get(ordinal);
    if (fact === undefined) throw new Error('MANGA_PAGE_FACT_REQUIRED');
    const page: MangaVisiblePage = { ordinal, pageId: fact.pageId, status: 'pending' };
    this.pages.set(ordinal, page);
    const current = (): boolean => generation === this.generation && this.pages.get(ordinal) === page && this.wanted.has(ordinal);
    const request = this.requests.get(fact.resourceRef)?.request;
    this.onChange?.();
    this.foregroundImageWork++;
    try {
      const image = await this.resources.loadPage({ sourceRuleVersion: chapter.manifest.sourceRuleVersion, decodeRevision: chapter.manifest.decodeRevision, sourceId: chapter.manifest.chapter.sourceId,
        bookId: chapter.manifest.chapter.bookId, chapterIndex: chapter.chapterIndex,
        contentVersion: chapter.manifest.manifestVersion, chapterUrl: chapter.manifest.chapter.chapterId },
        { ...(request ?? { url: fact.resourceRef }), resourceRef: fact.resourceRef },
        this.allowNetwork && request !== undefined, current, 0, this.previewMode);
      if (!current()) { this.resources.release(image); return; }
      page.image = image; page.status = 'ready';
      const width = image.intrinsicWidth ?? image.width;
      const height = image.intrinsicHeight ?? image.height;
      this.geometry.set(ordinal, { width, height, tileHeight: this.previewMode ? height : image.height });
    } catch (error) {
      if (!current()) return;
      page.status = 'failed'; page.error = error instanceof Error ? error.message : 'MANGA_IMAGE_FAILED';
    } finally { this.foregroundImageWork--; this.scheduleAdjacentPreparation(); }
    if (current()) this.onChange?.();
  }
}
