// Runtime retirement registry for ScreenGraph component instances that belong
// to explicitly withdrawn generated routes. These routes remain part of the
// canonical Reader-UI ScreenGraph (the generated contract is immutable), but
// their historical children must not reach the native presentation path. Only
// the current in-place Figma states remain visible at runtime.
//
// The companion audit (scripts/sync_reader_ui_screen_graph.mjs) loads this
// registry and verifies:
//   1. every retired entry covers an explicitly withdrawn route,
//   2. every withdrawn generated component (including nested state/action
//      children) is explicitly retired,
//   3. the live 'source-switch/source-switch-flow' window is NOT retired.
//
// Do NOT add entries for routes outside the withdrawn set — the audit will
// reject them.  Do NOT remove the live source-switch flow entry from coverage;
// it must stay visible.

export interface ReaderUIScreenGraphRetiredComponentInstance {
  routeId: string;
  componentId: string;
  reason: string;
}

export const READER_SCREEN_GRAPH_RETIRED_COMPONENT_INSTANCES: ReaderUIScreenGraphRetiredComponentInstance[] = [
  { routeId: 'bookshelf-book-more-menu', componentId: 'topbar', reason: 'superseded-by-in-place-book-action-sheet' },
  { routeId: 'bookshelf-book-more-menu', componentId: 'book-more-menu-page', reason: 'superseded-by-in-place-book-action-sheet' },
  { routeId: 'bookshelf-book-more-menu', componentId: 'bottom-nav', reason: 'superseded-by-in-place-book-action-sheet' },
  { routeId: 'bookshelf-group-management', componentId: 'topbar', reason: 'group-management-withdrawn-from-v1' },
  { routeId: 'bookshelf-group-management', componentId: 'book-group-management-page', reason: 'group-management-withdrawn-from-v1' },
  { routeId: 'group-management', componentId: 'topbar', reason: 'group-management-withdrawn-from-v1' },
  { routeId: 'group-management', componentId: 'group-management-page', reason: 'group-management-withdrawn-from-v1' },
  { routeId: 'book-batch-management', componentId: 'topbar', reason: 'superseded-by-in-place-bookshelf-multiselect' },
  { routeId: 'book-batch-management', componentId: 'book-batch-management-page', reason: 'superseded-by-in-place-bookshelf-multiselect' },
  { routeId: 'local-import', componentId: 'local-import-topbar', reason: 'superseded-by-in-place-local-import-dialog' },
  { routeId: 'local-import', componentId: 'local-import-page', reason: 'superseded-by-in-place-local-import-dialog' },
  { routeId: 'source-switch-results', componentId: 'source-switch-results-flow', reason: 'withdrawn-source-switch-state-matrix' },
  { routeId: 'source-switch-empty', componentId: 'source_switch_empty-flow', reason: 'withdrawn-source-switch-state-matrix' },
  { routeId: 'source-switch-empty', componentId: 'source_switch_empty-state', reason: 'withdrawn-source-switch-state-matrix' },
  { routeId: 'source-switch-empty', componentId: 'source_switch_empty-action', reason: 'withdrawn-source-switch-state-matrix' },
  { routeId: 'source-switch-error', componentId: 'source_switch_error-flow', reason: 'withdrawn-source-switch-state-matrix' },
  { routeId: 'source-switch-error', componentId: 'source_switch_error-state', reason: 'withdrawn-source-switch-state-matrix' },
  { routeId: 'source-switch-error', componentId: 'source_switch_error-action', reason: 'withdrawn-source-switch-state-matrix' },
  { routeId: 'source-switch-timeout', componentId: 'source_switch_timeout-flow', reason: 'withdrawn-source-switch-state-matrix' },
  { routeId: 'source-switch-timeout', componentId: 'source_switch_timeout-state', reason: 'withdrawn-source-switch-state-matrix' },
  { routeId: 'source-switch-timeout', componentId: 'source_switch_timeout-action', reason: 'withdrawn-source-switch-state-matrix' },
  { routeId: 'source-switch-loading', componentId: 'source_switch_loading-flow', reason: 'withdrawn-source-switch-state-matrix' },
  { routeId: 'source-switch-loading', componentId: 'source_switch_loading-state', reason: 'withdrawn-source-switch-state-matrix' },
  { routeId: 'source-switch-loading', componentId: 'source_switch_loading-action', reason: 'withdrawn-source-switch-state-matrix' },
  { routeId: 'source-switch-rollback', componentId: 'source_switch_rollback-flow', reason: 'withdrawn-source-switch-state-matrix' },
  { routeId: 'source-switch-rollback', componentId: 'source_switch_rollback-state', reason: 'withdrawn-source-switch-state-matrix' },
  { routeId: 'source-switch-rollback', componentId: 'source_switch_rollback-action', reason: 'withdrawn-source-switch-state-matrix' },
  { routeId: 'source-switch-preview', componentId: 'source_switch_preview-flow', reason: 'withdrawn-source-switch-state-matrix' },
  { routeId: 'source-switch-preview', componentId: 'source_switch_preview-state', reason: 'withdrawn-source-switch-state-matrix' },
  { routeId: 'source-switch-preview', componentId: 'source_switch_preview-action', reason: 'withdrawn-source-switch-state-matrix' },
  { routeId: 'restore-scopes', componentId: 'topbar', reason: 'withdrawn-restore-state-matrix' },
  { routeId: 'restore-scopes', componentId: 'restore-scopes-page', reason: 'withdrawn-restore-state-matrix' },
  { routeId: 'restore-preview', componentId: 'topbar', reason: 'withdrawn-restore-state-matrix' },
  { routeId: 'restore-preview', componentId: 'restore-preview-page', reason: 'withdrawn-restore-state-matrix' },
  { routeId: 'restore-running', componentId: 'restore-running-topbar', reason: 'withdrawn-restore-state-matrix' },
  { routeId: 'restore-running', componentId: 'restore-running-page', reason: 'withdrawn-restore-state-matrix' },
  { routeId: 'restore-result', componentId: 'restore-result-topbar', reason: 'withdrawn-restore-state-matrix' },
  { routeId: 'restore-result', componentId: 'restore-result-page', reason: 'withdrawn-restore-state-matrix' },
  { routeId: 'restore-confirm', componentId: 'topbar', reason: 'withdrawn-restore-state-matrix' },
  { routeId: 'restore-confirm', componentId: 'restore-confirm-page', reason: 'withdrawn-restore-state-matrix' },
  { routeId: 'restore-progress', componentId: 'topbar', reason: 'withdrawn-restore-state-matrix' },
  { routeId: 'restore-progress', componentId: 'restore-progress-page', reason: 'withdrawn-restore-state-matrix' },
  { routeId: 'restore-conflict', componentId: 'topbar', reason: 'withdrawn-restore-state-matrix' },
  { routeId: 'restore-conflict', componentId: 'restore-conflict-page', reason: 'withdrawn-restore-state-matrix' },
];
