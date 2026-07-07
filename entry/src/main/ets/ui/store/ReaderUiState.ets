// ReaderUiState — mirrors Reader UI/contracts/ui-state.schema.json (Phase 1 core fields).
// Owner: Platform Interaction Reducer. Durable UI state lives here, never inside page components.
import { RouteId } from '../../contract/generated/RouteTable';

export type MainTab = 'bookshelf' | 'discover' | 'rss' | 'settings';
export type ReaderMode = 'default' | 'loading' | 'empty' | 'error' | 'offline' | 'permission';
export type PageState =
  | '' | 'default' | 'loading' | 'empty' | 'error' | 'offline' | 'permission'
  | 'cover-mode' | 'list-mode' | 'shelf-empty' | 'refreshing' | 'no-subscription' | 'no-unread';
// Overlay = generic transient overlays only. Reader overlays (directory /
// appearance / tts / settings / search / replace / auto-scroll / night-state /
// reader-control) are ROUTES now (Batch 1) — not this field. Retired kinds
// removed; kept: source-switch (live) + the generic transient kinds for
// future Batch 2+ overlays.
export type Overlay =
  | '' | 'source-switch' | 'book-action' | 'sort-filter' | 'group-management'
  | 'local-import' | 'dialog' | 'sheet' | 'toast';
export type ActiveSession = '' | 'reading' | 'tts' | 'auto-page';

export interface ReaderError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface RouteEntry {
  id: RouteId;
}

export interface ReaderUiState {
  routeId: RouteId;
  tab: MainTab;
  readerMode: ReaderMode;
  overlay: Overlay;
  activeSession: ActiveSession;
  focusTarget: string;
  loading: boolean;
  error: ReaderError | null;
  reducedMotion: boolean;
  pageState: PageState;
  firstOpenPlayed: boolean;
  stack: RouteEntry[];
  // Minimal visible reading chain data fields (Phase 2 extension).
  // Hold real data fetched via Host HTTP, replacing hardcoded fixtures in
  // components. Durable UI state — owned by reducer, not page components.
  searchQuery: string;
  searchResults: SearchResultEntry[];
  currentBook: BookDetail | null;
  chapterContent: string[];
}

// UiEvent is a tagged record; the reducer switches on `type` and reads the relevant
// optional field. Kept as one interface (rather than a discriminated union) for
// ArkTS-narrowing safety.
export interface UiEvent {
  type: string;
  id?: RouteId;
  tab?: MainTab;
  overlay?: Overlay;
  pageState?: PageState;
  mode?: ReaderMode;
  enabled?: boolean;
  loading?: boolean;
  error?: ReaderError | null;
  // Minimal visible reading chain event fields.
  query?: string;
  searchResults?: SearchResultEntry[];
  book?: BookDetail | null;
  chapterParagraphs?: string[];
  bookId?: string;
  chapterId?: string;
}

// ── Minimal visible reading chain data types ──
export interface SearchResultEntry {
  title: string;
  author: string;
  bookId: string;
  sourceName: string;
  sourceUrl: string;
  latestChapter?: string;
}

export interface BookDetail {
  bookId: string;
  title: string;
  author: string;
  coverUrl?: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  latestChapter: string;
  chapterListUrl: string;
}

export interface ChapterContent {
  bookId: string;
  chapterId: string;
  title: string;
  paragraphs: string[];
}
