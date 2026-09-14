import type { SearchBook, SearchResultDelta } from './SearchGateway';

/**
 * The search page's full presentation. `initial` is the pre-search surface
 * (recent history); the remaining states are reached by a real search
 * attempt. `keyword` is the Figma Input text; results are real Core
 * `search-book` entries decoded by SearchGateway.
 */
export interface SearchInitialPresentation {
  kind: 'initial';
  history: string[];
}

export interface SearchLoadingPresentation {
  kind: 'loading';
  keyword: string;
}

export interface SearchResultsPresentation {
  kind: 'results';
  delta?: SearchResultDelta;
  localSearchFailed?: boolean;
  sourceListFailed?: boolean;
  /** Safe classified text only; raw causes remain with the query owner. */
  localFailureMessage?: string;
  sourceListFailureMessage?: string;
  keyword: string;
  results: SearchBook[];
  /**
   * True while the source sweep is still running: the list already shows
   * partial results plus a trailing in-progress slot, and keeps updating as
   * each source lands. False once every enabled source has finished.
   */
  searching: boolean;
  /** Enabled sources the sweep attempts in total. */
  totalSourceCount: number;
  /** Enabled sources finished (ok or failed) so far. */
  completedSourceCount: number;
  /** Enabled sources whose `book.search` failed so far. */
  failedSourceCount: number;
  /** True when the user stopped the sweep early (ACQ-02); partial results stay. */
  stopped?: boolean;
}

export interface SearchEmptyPresentation {
  kind: 'empty';
  localSearchFailed?: boolean;
  sourceListFailed?: boolean;
  /** Safe classified text only; raw causes remain with the query owner. */
  localFailureMessage?: string;
  sourceListFailureMessage?: string;
  keyword: string;
  /** Enabled sources the search actually attempted. */
  searchedSourceCount: number;
  /** Enabled sources whose `book.search` failed before this verdict. */
  failedSourceCount?: number;
  /** True when the sweep was stopped by the user before this verdict (ACQ-02). */
  stopped?: boolean;
}

export interface SearchErrorPresentation {
  kind: 'error';
  localSearchFailed?: boolean;
  sourceListFailed?: boolean;
  /** Safe classified text only; raw causes remain with the query owner. */
  localFailureMessage?: string;
  sourceListFailureMessage?: string;
  keyword: string;
  /** Enabled sources the search actually attempted. */
  searchedSourceCount: number;
  /** Enabled sources whose `book.search` failed; every source failed here. */
  failedSourceCount?: number;
}

/**
 * P0 add-source flow: zero or fully-disabled sources is a configuration gap,
 * not a search failure. Product-approved extension state (no Figma final
 * frame); it reuses the Empty layout.
 */
export interface SearchSourceRequiredPresentation {
  kind: 'sourceRequired';
  reason: 'noSources' | 'allDisabled';
}

/** `source.list` itself failed; the search chain never started. */
export interface SearchSourceLoadErrorPresentation {
  kind: 'sourceLoadError';
}

export type SearchPresentation =
  | SearchInitialPresentation
  | SearchLoadingPresentation
  | SearchResultsPresentation
  | SearchEmptyPresentation
  | SearchErrorPresentation
  | SearchSourceRequiredPresentation
  | SearchSourceLoadErrorPresentation;
