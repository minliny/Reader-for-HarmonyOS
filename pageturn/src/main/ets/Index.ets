// Index - public API of the pageturn HAR module.
//
// The page-turn pure-logic subsystem: contract read-surface, host-private
// provider registry, transaction coordinator, surface transformer, and the
// two host-private providers (scroll anchor-commit, real3d page-turn).
//
// This module is deliberately self-contained - it depends only on the synced
// contract artifact (./contract/Motion.ets) and consumes nothing from the
// app entry module (no NAPI, no HAR, no @Component). That isolation is what
// lets it compile + test independently of the full app's C++/HAR build graph.
export * from './PageTurnContract';
export * from './PageTurnProviderRegistry';
export * from './PageTurnCoordinator';
export * from './PageTurnSurfaceTransformer';
export * from './ScrollAnchorCommitProvider';
export * from './Real3dPageTurnProvider';
