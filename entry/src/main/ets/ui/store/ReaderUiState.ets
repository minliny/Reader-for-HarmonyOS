// ReaderUiState — mirrors Reader UI/contracts/ui-state.schema.json (Phase 1 core fields).
// Owner: Platform Interaction Reducer. Durable UI state lives here, never inside page components.
import { RouteId } from '../../contract/generated/RouteTable';

export type MainTab = 'bookshelf' | 'discover' | 'rss' | 'settings';
export type ReaderMode = 'default' | 'loading' | 'empty' | 'error' | 'offline' | 'permission';
export type PageState =
  | '' | 'default' | 'loading' | 'empty' | 'error' | 'offline' | 'permission'
  | 'cover-mode' | 'list-mode' | 'shelf-empty' | 'refreshing' | 'no-subscription' | 'no-unread';
export type Overlay =
  | '' | 'settings' | 'reader-control' | 'directory' | 'tts' | 'appearance' | 'auto-page'
  | 'content-search' | 'content-replacement' | 'source-switch' | 'book-action'
  | 'sort-filter' | 'group-management' | 'local-import' | 'dialog' | 'sheet' | 'toast';
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
}
