// Generated from Reader-UI/contracts/manga.ts. Do not edit.
// SHA256 61b740ee06f2dc14fd457e95641448f383e7bc4c93c9ba86350d36c77f25cb8f
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
/** Core reader-storage::manga::MangaProgressState: durable token and nullable location. */
export interface MangaProgressState { token: MangaProgressToken; location: MangaLocation | null; }
/** Core reader-contract::remote::MangaResourceData with reader-domain::MangaPage.
 * Request material is Core-admitted; an empty resource list does not grant a fetch. */
export interface MangaResourceRequest {
  resourceRef: string;
  request: { url: string; sourcePageId?: string; requestRule?: string; referrer?: string; headers?: Record<string, string> };
}
/** Core reader-contract::remote::MangaChapterData; mapping fields retain distinct identities. */
export interface MangaChapterResult {
  manifest: MangaManifest; chapterIndex: number; chapterTitle: string;
  resources: MangaResourceRequest[]; cached: boolean; progressMapping?: MangaProgressMapping; anchorMapping?: MangaAnchorMapping;
}

/** Every original page is validated and durable before this receipt is sent. */
export interface MangaOfflineReceipt { chapter: MangaChapterIdentity; manifestVersion: string; resourceRefs: string[]; }

/** Core SqliteStorage::manga_pages_window / manga_entry::window.
 * pageStart is an original-image ordinal; totalPages is the full manifest size.
 * resumeOnly can restore historical content without authorizing resource requests. */
export interface MangaChapterWindow extends MangaChapterResult { resumeOnly?: boolean; pageStart: number; totalPages: number; }
/** Core SqliteStorage::manga_prepared_entry / manga_prepared_entry_with_admission.
 * Exact mapping alone selects targetOrdinal; unresolved identity requires recovery.
 * Neither targetOrdinal nor chapter window replaces the durable progress token/location. */
export interface MangaPreparedEntry { resumeOnly?: boolean; chapter: MangaChapterWindow; progress: MangaProgressState; targetOrdinal: number; recoveryRequired: boolean; progressMapping?: MangaProgressMapping; }

/** Exact business identity evidence; coordinates remain in the saved location. */
export interface MangaChapterAnchor { pageId: string; ordinal: number; }
export interface MangaAnchorMapping {
  status: 'exact' | 'approximate' | 'unresolved'; reason: string;
  fromManifestVersion: string; fromPageId: string;
  targetPageId?: string; targetOrdinal?: number;
}
export interface MangaProgressMapping extends MangaAnchorMapping { progressRevision: number; }
