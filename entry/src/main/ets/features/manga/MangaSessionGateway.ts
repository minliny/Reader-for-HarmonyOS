import type { JsonObject, ReaderCoreResultEvent } from '@reader/core-harmony';
import type { ReadingGatewayRuntime } from '../reading/ReadingGatewayRuntime';
import type { MangaChapterWindow, MangaPreparedEntry, MangaChapterIdentity, MangaChapterResult, MangaLocation, MangaManifest, MangaManifestPage, MangaResourceRequest, MangaProgressState, MangaProgressToken, MangaProgressMapping, MangaAnchorMapping, MangaChapterAnchor } from './MangaContract';

export type { MangaChapterWindow, MangaPreparedEntry } from './MangaContract';

export interface MangaMaterializationToken { token: string; chapter: MangaChapterIdentity; manifestVersion: string; intent: 'cache' | 'download'; }

/** Same Runtime and source/network owner as novel reading. */
export class MangaSessionGateway {
  private readonly runtime: ReadingGatewayRuntime;
  constructor(runtime: ReadingGatewayRuntime) { this.runtime = runtime; }

  async chapter(sourceId: string, bookId: string, chapterIndex: number,
    policy: 'cacheOnly' | 'cacheFirst' | 'refresh', isCurrent: () => boolean,
    expectedManifestVersion?: string, preparationRevision?: number, anchor?: MangaChapterAnchor,
    directoryTargetProof?: JsonObject, priority: 'foreground' | 'background' = 'foreground'): Promise<MangaChapterResult> {
    this.current(isCurrent);
    if (this.runtime.supportsCoreCapability?.('manga.chapter.v1') !== true) throw new Error('MANGA_CORE_CAPABILITY_REQUIRED');
    const params: JsonObject = { sourceId, bookId, chapterIndex, policy };
    if (expectedManifestVersion !== undefined) params['expectedManifestVersion'] = expectedManifestVersion;
    if (preparationRevision !== undefined) params['preparationRevision'] = preparationRevision;
    if (anchor !== undefined) params['anchor'] = { pageId: anchor.pageId, ordinal: anchor.ordinal };
    if (directoryTargetProof !== undefined) params['directoryTargetProof'] = directoryTargetProof;
    const result = await this.request('manga.chapter.get', params, isCurrent, priority);
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
    const result = await this.request('manga.entry.get', params, isCurrent);
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

  async window(chapter: MangaChapterResult, start: number, limit: number, isCurrent: () => boolean,
    priority: 'foreground' | 'background' = 'foreground'): Promise<MangaChapterWindow> {
    this.current(isCurrent);
    const identity = chapter.manifest.chapter;
    const result = await this.request('manga.pages.window', { sourceId: identity.sourceId, bookId: identity.bookId,
      chapterId: identity.chapterId, manifestVersion: chapter.manifest.manifestVersion, start, limit }, isCurrent, priority);
    this.current(isCurrent);
    const data = result.data as unknown as MangaChapterWindow;
    this.validateWindow(data, identity.sourceId, identity.bookId, chapter.chapterIndex);
    if (data.manifest.chapter.chapterId !== identity.chapterId || data.manifest.manifestVersion !== chapter.manifest.manifestVersion ||
      data.manifest.sourceRuleVersion !== chapter.manifest.sourceRuleVersion || data.manifest.decodeRevision !== chapter.manifest.decodeRevision ||
      data.pageStart !== start || data.manifest.pages.length > limit) throw new Error('MANGA_WINDOW_IDENTITY_MISMATCH');
    return data;
  }

  /** Prepared entries deliberately carry at most 32 page facts. Background
   * preparation obtains the remaining immutable windows from Core; it never
   * reparses a chapter or treats the entry's window as a complete manifest. */
  async fullChapter(chapter: MangaChapterResult, totalPages: number,
    isCurrent: () => boolean, onWindow?: (window: MangaChapterWindow) => void): Promise<MangaChapterResult> {
    this.current(isCurrent);
    if (!Number.isSafeInteger(totalPages) || totalPages < 1 || totalPages > 10000) throw new Error('MANGA_WINDOW_INVALID');
    const pages = new Map<number, MangaManifestPage>();
    const resources = new Map<string, MangaResourceRequest>();
    for (const page of chapter.manifest.pages) pages.set(page.ordinal, page);
    for (const resource of chapter.resources) resources.set(resource.resourceRef, resource);
    for (let start = 0; start < totalPages; start += 32) {
      const limit = Math.min(32, totalPages - start);
      const missing = Array.from({ length: limit }, (_value, index) => start + index).some(index => !pages.has(index));
      if (!missing) continue;
      const window = await this.window(chapter, start, limit, isCurrent, 'background');
      this.current(isCurrent);
      if (window.totalPages !== totalPages || window.manifest.pages.length !== limit) throw new Error('MANGA_WINDOW_INCOMPLETE');
      for (const page of window.manifest.pages) pages.set(page.ordinal, page);
      for (const resource of window.resources) resources.set(resource.resourceRef, resource);
      onWindow?.(window);
    }
    this.current(isCurrent);
    const complete: MangaChapterResult = { ...chapter,
      manifest: { ...chapter.manifest, pages: Array.from(pages.values()).sort((a, b) => a.ordinal - b.ordinal) },
      resources: Array.from(resources.values()) };
    if (complete.manifest.pages.length !== totalPages) throw new Error('MANGA_WINDOW_INCOMPLETE');
    return this.validateChapter(complete, chapter.manifest.chapter.sourceId, chapter.manifest.chapter.bookId, chapter.chapterIndex);
  }

  async sessionRuntime(isCurrent: () => boolean): Promise<number> {
    const result = await this.request('manga.session.runtime', {}, isCurrent);
    const epoch = result.data['runtimeEpoch'];
    if (typeof epoch !== 'number' || !Number.isSafeInteger(epoch) || epoch < 1) throw new Error('MANGA_SESSION_RUNTIME_INVALID');
    return Number(epoch);
  }

  async replaceProtection(chapters: MangaChapterIdentity[], sessionEpoch: number, runtimeEpoch: number,
    isCurrent: () => boolean): Promise<void> {
    if (chapters.length > 3 || new Set(chapters.map(chapter => JSON.stringify([chapter.sourceId, chapter.bookId, chapter.chapterId]))).size !== chapters.length) throw new Error('MANGA_SESSION_WINDOW_INVALID');
    const result = await this.request('manga.session.replace', { chapters: chapters as unknown as JsonObject[],
      sessionEpoch, expectedRuntimeEpoch: runtimeEpoch }, isCurrent);
    if (result.data['protected'] !== chapters.length || result.data['runtimeEpoch'] !== runtimeEpoch) throw new Error('MANGA_SESSION_PROTECTION_INVALID');
  }

  async releaseProtection(sessionEpoch: number, runtimeEpoch: number): Promise<void> {
    const result = await this.runtime.request('manga.session.release', { sessionEpoch, expectedRuntimeEpoch: runtimeEpoch });
    if (typeof result.data['released'] !== 'boolean') throw new Error('MANGA_SESSION_RELEASE_INVALID');
  }

  async recordRead(chapter: MangaChapterResult, isCurrent: () => boolean): Promise<void> {
    const result = await this.request('manga.cache.recordRead', { chapter: chapter.manifest.chapter as unknown as JsonObject,
      manifestVersion: chapter.manifest.manifestVersion, readAt: Math.floor(Date.now() / 1000) }, isCurrent);
    if (result.data['recorded'] !== true) throw new Error('MANGA_CACHE_READ_INVALID');
  }

  async prepareMaterialization(chapter: MangaChapterResult, intent: 'cache' | 'download',
    isCurrent: () => boolean): Promise<MangaMaterializationToken> {
    this.current(isCurrent);
    const params: JsonObject = { chapter: chapter.manifest.chapter as unknown as JsonObject,
      manifestVersion: chapter.manifest.manifestVersion, intent };
    // This command acquires a lease. Drain its receipt even if the consumer
    // becomes stale, so the caller can abort that exact token in finally.
    const result = this.runtime.requestBook === undefined ? await this.runtime.request('manga.cache.materialization.prepare', params) :
      await this.runtime.requestBook('manga.cache.materialization.prepare', params, {}, 'background');
    const receipt = result.data as unknown as MangaMaterializationToken;
    if (typeof receipt.token !== 'string' || receipt.token.trim().length === 0 || receipt.intent !== intent ||
      receipt.manifestVersion !== chapter.manifest.manifestVersion || !this.sameChapter(receipt.chapter, chapter.manifest.chapter)) throw new Error('MANGA_MATERIALIZATION_TOKEN_INVALID');
    return receipt;
  }

  async completeMaterialization(receipt: MangaMaterializationToken, resourceRefs: string[], isCurrent: () => boolean): Promise<void> {
    const result = await this.request('manga.cache.materialization.complete', {
      chapter: receipt.chapter as unknown as JsonObject, manifestVersion: receipt.manifestVersion,
      token: receipt.token, resourceRefs }, isCurrent, 'background');
    if (result.data['completed'] !== true || result.data['manifestVersion'] !== receipt.manifestVersion) throw new Error('MANGA_MATERIALIZATION_RECEIPT_INVALID');
  }

  async abortMaterialization(receipt: MangaMaterializationToken): Promise<void> {
    // Release the preparation lease, preserving all successfully acquired bytes.
    const result = await this.runtime.request('manga.cache.materialization.abort', { token: receipt.token });
    if (typeof result.data['aborted'] !== 'boolean') throw new Error('MANGA_MATERIALIZATION_ABORT_INVALID');
  }

  private sameChapter(left: MangaChapterIdentity, right: MangaChapterIdentity): boolean {
    return left !== undefined && left.sourceId === right.sourceId && left.bookId === right.bookId && left.chapterId === right.chapterId;
  }

  private async request(method: string, params: JsonObject, isCurrent: () => boolean,
    priority: 'foreground' | 'background' = 'foreground'): Promise<ReaderCoreResultEvent> {
    this.current(isCurrent);
    const options = { shouldCancel: (): boolean => !isCurrent() };
    const result = this.runtime.requestBook === undefined ? await this.runtime.request(method, params, options) :
      await this.runtime.requestBook(method, params, options, priority);
    this.current(isCurrent);
    return result;
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
