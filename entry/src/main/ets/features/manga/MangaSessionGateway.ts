import type { JsonObject } from '@reader/core-harmony';
import type { ReadingGatewayRuntime } from '../reading/ReadingGatewayRuntime';
import type { MangaChapterWindow, MangaPreparedEntry, MangaChapterIdentity, MangaChapterResult, MangaLocation, MangaManifest, MangaProgressState, MangaProgressToken, MangaProgressMapping, MangaAnchorMapping, MangaChapterAnchor } from './MangaContract';

export type { MangaChapterWindow, MangaPreparedEntry } from './MangaContract';

/** Same Runtime and source/network owner as novel reading. */
export class MangaSessionGateway {
  private readonly runtime: ReadingGatewayRuntime;
  constructor(runtime: ReadingGatewayRuntime) { this.runtime = runtime; }

  async chapter(sourceId: string, bookId: string, chapterIndex: number,
    policy: 'cacheOnly' | 'cacheFirst' | 'refresh', isCurrent: () => boolean,
    expectedManifestVersion?: string, preparationRevision?: number, anchor?: MangaChapterAnchor,
    directoryTargetProof?: JsonObject): Promise<MangaChapterResult> {
    this.current(isCurrent);
    if (this.runtime.supportsCoreCapability?.('manga.chapter.v1') !== true) throw new Error('MANGA_CORE_CAPABILITY_REQUIRED');
    const params: JsonObject = { sourceId, bookId, chapterIndex, policy };
    if (expectedManifestVersion !== undefined) params['expectedManifestVersion'] = expectedManifestVersion;
    if (preparationRevision !== undefined) params['preparationRevision'] = preparationRevision;
    if (anchor !== undefined) params['anchor'] = { pageId: anchor.pageId, ordinal: anchor.ordinal };
    if (directoryTargetProof !== undefined) params['directoryTargetProof'] = directoryTargetProof;
    const result = await this.runtime.request('manga.chapter.get', params, { shouldCancel: (): boolean => !isCurrent() });
    this.current(isCurrent);
    const data = result.data as unknown as MangaChapterResult;
    return this.validateChapter(data, sourceId, bookId, chapterIndex);
  }

  async entry(sourceId: string, bookId: string, chapterIndex: number | undefined, isCurrent: () => boolean,
    directoryTargetProof?: JsonObject): Promise<MangaPreparedEntry | null> {
    this.current(isCurrent);
    if (this.runtime.supportsCoreCapability?.('manga.entry.v1') !== true) return null;
    const params: JsonObject = { sourceId, bookId };
    if (chapterIndex !== undefined) params['chapterIndex'] = chapterIndex;
    if (directoryTargetProof !== undefined) params['directoryTargetProof'] = directoryTargetProof;
    const result = await this.runtime.request('manga.entry.get', params, { shouldCancel: (): boolean => !isCurrent() });
    this.current(isCurrent);
    if (result.data['entry'] === null) return null;
    const entry = result.data['entry'] as unknown as MangaPreparedEntry;
    if (entry === undefined || entry === null) throw new Error('MANGA_ENTRY_INVALID');
    this.validateWindow(entry.chapter, sourceId, bookId, chapterIndex);
    if (!Number.isSafeInteger(entry.targetOrdinal) || entry.targetOrdinal < 0 || entry.targetOrdinal >= entry.chapter.totalPages ||
      !entry.chapter.manifest.pages.some(page => page.ordinal === entry.targetOrdinal) || typeof entry.recoveryRequired !== 'boolean') throw new Error('MANGA_ENTRY_INVALID');
    this.validateToken(entry.progress?.token);
    if (entry.progress.location !== null) {
      this.validateLocation(entry.progress.location);
      if (entry.progress.location.chapter.sourceId !== sourceId || entry.progress.location.chapter.bookId !== bookId ||
        entry.progress.location.progressRevision !== entry.progress.token.revision) throw new Error('MANGA_PROGRESS_IDENTITY_MISMATCH');
    }
    if (entry.progressMapping !== undefined) this.validateMapping(entry.progressMapping, entry.chapter);
    return entry;
  }

  async window(chapter: MangaChapterResult, start: number, limit: number, isCurrent: () => boolean): Promise<MangaChapterWindow> {
    this.current(isCurrent);
    const identity = chapter.manifest.chapter;
    const result = await this.runtime.request('manga.pages.window', { sourceId: identity.sourceId, bookId: identity.bookId,
      chapterId: identity.chapterId, manifestVersion: chapter.manifest.manifestVersion, start, limit }, { shouldCancel: (): boolean => !isCurrent() });
    this.current(isCurrent);
    const data = result.data as unknown as MangaChapterWindow;
    this.validateWindow(data, identity.sourceId, identity.bookId, chapter.chapterIndex);
    if (data.manifest.chapter.chapterId !== identity.chapterId || data.manifest.manifestVersion !== chapter.manifest.manifestVersion ||
      data.manifest.sourceRuleVersion !== chapter.manifest.sourceRuleVersion || data.manifest.decodeRevision !== chapter.manifest.decodeRevision ||
      data.pageStart !== start || data.manifest.pages.length > limit) throw new Error('MANGA_WINDOW_IDENTITY_MISMATCH');
    return data;
  }

  private validateWindow(data: MangaChapterWindow, sourceId: string, bookId: string, chapterIndex?: number): void {
    if (data === undefined || data === null || !Number.isSafeInteger(data.totalPages) || data.totalPages < 1 || data.totalPages > 10000 ||
      !Number.isSafeInteger(data.pageStart) || data.pageStart < 0 || !Array.isArray(data.manifest?.pages) || data.manifest.pages.length > 32 ||
      data.pageStart + data.manifest.pages.length > data.totalPages || !Number.isSafeInteger(data.chapterIndex) || data.chapterIndex < 0) throw new Error('MANGA_WINDOW_INVALID');
    this.validateChapter(data, sourceId, bookId, chapterIndex ?? data.chapterIndex, data.pageStart);
  }

  validateChapter(data: MangaChapterResult, sourceId: string, bookId: string, chapterIndex: number, pageStart: number = 0): MangaChapterResult {
    if (data === undefined || data === null) throw new Error('MANGA_CHAPTER_INVALID');
    this.validateManifest(data.manifest, pageStart);
    if (data.manifest.chapter.sourceId !== sourceId || data.manifest.chapter.bookId !== bookId ||
      data.chapterIndex !== chapterIndex || !Array.isArray(data.resources) || typeof data.cached !== 'boolean') {
      throw new Error('MANGA_CHAPTER_IDENTITY_MISMATCH');
    }
    const allowedRefs = new Set(data.manifest.pages.map(page => page.resourceRef));
    const refs = new Set<string>();
    for (const resource of data.resources) {
      if (refs.has(resource.resourceRef) || !allowedRefs.has(resource.resourceRef) ||
        typeof resource.request?.url !== 'string' || resource.request.url.length === 0) throw new Error('MANGA_RESOURCE_BINDING_INVALID');
      refs.add(resource.resourceRef);
    }
    if (!data.cached && refs.size !== data.manifest.pages.length) throw new Error('MANGA_RESOURCE_BINDING_INCOMPLETE');
    if (data.progressMapping !== undefined) this.validateMapping(data.progressMapping, data);
    if (data.anchorMapping !== undefined) this.validateAnchorMapping(data.anchorMapping, data);
    return data;
  }

  async progress(sourceId: string, bookId: string, isCurrent: () => boolean): Promise<MangaProgressState> {
    this.current(isCurrent);
    const result = await this.runtime.request('reading.progress.get', { kind: 'manga', sourceId, bookId });
    this.current(isCurrent);
    const data = result.data as unknown as MangaProgressState;
    this.validateToken(data.token);
    if (data.location !== null) this.validateLocation(data.location);
    if (data.location !== null && (data.location.kind !== 'manga' || data.location.chapter.sourceId !== sourceId ||
      data.location.chapter.bookId !== bookId || data.location.progressRevision !== data.token.revision)) throw new Error('MANGA_PROGRESS_IDENTITY_MISMATCH');
    return data;
  }

  async save(location: MangaLocation, expected: MangaProgressToken, isCurrent: () => boolean): Promise<MangaProgressState> {
    this.current(isCurrent);
    this.validateToken(expected);
    this.validateLocation(location);
    if (!Number.isFinite(location.x) || !Number.isFinite(location.y) || location.x < 0 || location.x > 1 ||
      location.y < 0 || location.y > 1 || location.progressRevision !== expected.revision + 1) throw new Error('MANGA_PROGRESS_INVALID');
    const result = await this.runtime.request('reading.progress.update', {
      kind: 'manga', location: location as unknown as JsonObject, expectedEpoch: expected.epoch, expectedRevision: expected.revision,
    }, { shouldCancel: (): boolean => !isCurrent() });
    this.current(isCurrent);
    const data = result.data as unknown as MangaProgressState;
    this.validateToken(data.token);
    if (data.location !== null) this.validateLocation(data.location);
    if (data.location === null || data.token.epoch !== expected.epoch || data.token.revision !== location.progressRevision ||
      data.location.pageId !== location.pageId || data.location.manifestVersion !== location.manifestVersion ||
      data.location.chapter.sourceId !== location.chapter.sourceId || data.location.chapter.bookId !== location.chapter.bookId ||
      data.location.chapter.chapterId !== location.chapter.chapterId || data.location.x !== location.x || data.location.y !== location.y ||
      data.location.pageOrdinalFallback !== location.pageOrdinalFallback || data.location.progressRevision !== location.progressRevision) throw new Error('MANGA_PROGRESS_RECEIPT_INVALID');
    return data;
  }

  private validateManifest(manifest: MangaManifest, pageStart: number = 0): void {
    if (manifest === undefined || typeof manifest.manifestVersion !== 'string' || manifest.manifestVersion.length === 0 ||
      typeof manifest.sourceRuleVersion !== 'string' || manifest.sourceRuleVersion.length === 0 ||
      !this.validIdentity(manifest.chapter) || !['identity-v1', 'bytes-v1'].includes(manifest.decodeRevision) || !Array.isArray(manifest.pages) || manifest.pages.length === 0 || manifest.pages.length > 10000) {
      throw new Error('MANGA_MANIFEST_INVALID');
    }
    const hints = manifest.displayHints;
    if (hints !== undefined && (typeof hints.sourceImageStyle !== 'string' || hints.sourceImageStyle.length > 4096 ||
      (hints.fit !== undefined && !['width', 'contain'].includes(hints.fit)))) throw new Error('MANGA_DISPLAY_HINT_INVALID');
    const ids = new Set<string>();
    manifest.pages.forEach((page, index): void => {
      if (page.ordinal !== index + pageStart || !/^mp1:[0-9a-f]{64}$/.test(page.pageId) || ids.has(page.pageId) ||
        page.resourceRef !== `manga:${page.pageId}`) throw new Error('MANGA_PAGE_IDENTITY_INVALID');
      if (page.identity !== undefined && (!['sourceId', 'request'].includes(page.identity.kind) ||
        !/^[0-9a-f]{64}$/.test(page.identity.value))) throw new Error('MANGA_PAGE_IDENTITY_INVALID');
      ids.add(page.pageId);
    });
  }
  private validateMapping(mapping: MangaProgressMapping, chapter: MangaChapterResult): void {
    if (!Number.isSafeInteger(mapping.progressRevision) || mapping.progressRevision < 1) throw new Error('MANGA_MAPPING_INVALID');
    this.validateAnchorMapping(mapping, chapter);
  }
  private validateAnchorMapping(mapping: MangaAnchorMapping, chapter: MangaChapterResult): void {
    if (!['exact', 'approximate', 'unresolved'].includes(mapping.status) || typeof mapping.reason !== 'string' ||
      typeof mapping.fromManifestVersion !== 'string' || !/^mp1:[0-9a-f]{64}$/.test(mapping.fromPageId)) throw new Error('MANGA_MAPPING_INVALID');
    if (mapping.status === 'exact' && (!Number.isSafeInteger(mapping.targetOrdinal) ||
      !chapter.manifest.pages.some(page => page.ordinal === mapping.targetOrdinal && page.pageId === mapping.targetPageId))) throw new Error('MANGA_MAPPING_INVALID');
    if (mapping.status !== 'exact' && (mapping.targetOrdinal !== undefined || mapping.targetPageId !== undefined)) throw new Error('MANGA_MAPPING_INVALID');
  }
  private validIdentity(chapter: MangaChapterIdentity): boolean {
    return chapter !== undefined && [chapter.sourceId, chapter.bookId, chapter.chapterId]
      .every(value => typeof value === 'string' && value.trim().length > 0);
  }
  private validateLocation(location: MangaLocation): void {
    if (location === undefined || location.kind !== 'manga' || !this.validIdentity(location.chapter) ||
      typeof location.manifestVersion !== 'string' || location.manifestVersion.length === 0 ||
      !/^mp1:[0-9a-f]{64}$/.test(location.pageId) || !Number.isSafeInteger(location.pageOrdinalFallback) ||
      location.pageOrdinalFallback < 0 || !Number.isSafeInteger(location.progressRevision) || location.progressRevision < 1 ||
      !Number.isFinite(location.x) || !Number.isFinite(location.y) || location.x < 0 || location.x > 1 || location.y < 0 || location.y > 1) {
      throw new Error('MANGA_PROGRESS_INVALID');
    }
  }
  private validateToken(token: MangaProgressToken): void {
    if (!Number.isSafeInteger(token?.epoch) || token.epoch <= 0 || !Number.isSafeInteger(token.revision) || token.revision < 0) throw new Error('MANGA_PROGRESS_TOKEN_INVALID');
  }
  private current(isCurrent: () => boolean): void { if (!isCurrent()) throw new Error('MANGA_SESSION_CANCELLED'); }
}
