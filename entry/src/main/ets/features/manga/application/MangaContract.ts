/** Core domain wire facts; definitions mirrored by protocol/reader-command.schema.json. */
export interface MangaChapterIdentity { sourceId: string; bookId: string; chapterId: string; }
/** Host decoded first region; does not certify whole-chapter offline completion. */
export interface MangaFirstImageReceipt {
  chapter: MangaChapterIdentity; chapterIndex: number;
  manifestVersion: string; sourceRuleVersion: string; decodeRevision: string;
  pageId: string; resourceRef: string; imageRevision: string; width: number; height: number;
}
export interface MangaPageIdentity { kind: 'sourceId' | 'request'; value: string; }
export interface MangaDisplayHints { sourceImageStyle: string; fit?: 'width' | 'contain'; }
export interface MangaManifestPage { pageId: string; ordinal: number; resourceRef: string; identity?: MangaPageIdentity; }
export interface MangaManifest {
  chapter: MangaChapterIdentity;
  sourceRuleVersion: string;
  manifestVersion: string;
  decodeRevision: string;
  pages: MangaManifestPage[]; displayHints?: MangaDisplayHints;
}
export interface MangaLocation {
  kind: 'manga'; chapter: MangaChapterIdentity; manifestVersion: string; pageId: string;
  pageOrdinalFallback: number; x: number; y: number; progressRevision: number;
}
export interface MangaProgressToken { epoch: number; revision: number; }
export interface MangaProgressState { token: MangaProgressToken; location: MangaLocation | null; }
export interface MangaResourceRequest {
  resourceRef: string;
  request: { url: string; sourcePageId?: string; requestRule?: string; referrer?: string; headers?: Record<string, string> };
}
export interface MangaChapterResult {
  manifest: MangaManifest; chapterIndex: number; chapterTitle: string;
  resources: MangaResourceRequest[]; cached: boolean; progressMapping?: MangaProgressMapping; anchorMapping?: MangaAnchorMapping;
}

/** Every original page is validated and durable before this receipt is sent. */
export interface MangaOfflineReceipt { chapter: MangaChapterIdentity; manifestVersion: string; resourceRefs: string[]; }

export interface MangaChapterWindow extends MangaChapterResult { resumeOnly?: boolean; pageStart: number; totalPages: number; }
export interface MangaPreparedEntry { resumeOnly?: boolean; chapter: MangaChapterWindow; progress: MangaProgressState; targetOrdinal: number; recoveryRequired: boolean; progressMapping?: MangaProgressMapping; }

/** Exact business identity evidence; coordinates remain in the saved location. */
export interface MangaChapterAnchor { pageId: string; ordinal: number; }
export interface MangaAnchorMapping {
  status: 'exact' | 'approximate' | 'unresolved'; reason: string;
  fromManifestVersion: string; fromPageId: string;
  targetPageId?: string; targetOrdinal?: number;
}
export interface MangaProgressMapping extends MangaAnchorMapping { progressRevision: number; }
