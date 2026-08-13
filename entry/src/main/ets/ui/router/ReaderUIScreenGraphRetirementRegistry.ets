// Runtime retirement registry for ScreenGraph component instances that belong
// to withdrawn Source Switch / Restore generated state-matrix routes.  These
// routes remain part of the canonical Reader-UI ScreenGraph (the generated
// contract is immutable) but their generated state-matrix children must not
// reach the native presentation path.  Only the live Figma window — e.g. the
// real SourceSwitchFlowPage — remains visible at runtime.
//
// The companion audit (scripts/sync_reader_ui_screen_graph.mjs) loads this
// registry and verifies:
//   1. every retired entry covers a withdrawn Source Switch / Restore route,
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
