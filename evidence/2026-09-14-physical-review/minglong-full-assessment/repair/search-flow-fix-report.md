# Search acquisition repair — 2026-09-15

Owned production edits: BookAcquisitionCoordinator.ts, BookRequestScheduler.ts, SearchGateway.ts, SearchOrchestrator.ets, SourceSwitchGateway.ts, Index.ets. No HDC/install/commits, no central evidence document edits.

## Implemented
- ML-01/03: new search preview group now requires leading-body admission. `onCatalog` publishes detail/TOC immediately; only first three leading navigable chapters of that selected candidate are probed and only empty bodies allow trying another leading chapter. Source-local failures try next reliable same-book candidate. Success carries preparedChapter into normal Index flow, avoiding a second body call. Existing shelf/resume/manual source identities keep their old fixed-identity path and never silently switch/progress-update.
- Reliable automatic groups require matching normalized nonblank title and nonblank author. Empty authors cannot authorize another source; returned detail title/author are checked again. Contract identity/version/storage/cancel/position errors are not hidden by source fallback.
- ML-02: three unknown candidate cap applies only to background round, never foreground exhaustion. Foreground can reach fourth and later candidates inside a 45-second total budget including queueing and every stage. Foreground waiting cancellation observed within 100 ms; late process-owned completion does not publish old detail or launch another candidate. Background retains six visible groups/two acquisitions and no body preload.
- Source-local capability failure can try an independent same-book source. NETWORK_ENVIRONMENT immediately propagates and never writes bad-candidate facts. Existing source/chapter failure scope preserved.
- Foreground preempts unrelated, started acquisitions whose priority remains background. Core shouldCancel sees it; normalized cancelled means no failure health record, visible preparation is requeued. Foreground join of same book promotes and reuses it. Other preheats stay paused until foreground full chain/request ends, then resume.
- Index catalog notifications cannot start a duplicate body probe while group admission owns that generation, nor automatically retry a terminal failed selection. Successful normal metadata projection remains available.
- ML-10: extracted existing SearchOrchestrator continuous worker cursor into BookRequestScheduler `runBookSourceWorkers`, shared with SourceSwitchGateway. Fast lane immediately starts next source; registry output order and cancellation preserved. Structural environment failures propagate and stop later dispatch instead of becoming `noSources`.
- ML-13: per-item malformed rows are isolated, legitimate siblings retained. Optional discardedCount + bounded field-only reasons logged; all-invalid source remains failed. Mismatched envelope/sourceId/sourceVersion and invalid books envelope still fail the whole result.

## Verification
`/private/tmp/fix-test-search-candidate-acquisition.mjs.log`: 25 actual Coordinator/Gateway/SDK-extracted Index checks PASS. Includes fourth success; real body s1 fail→s2 success with exactly one content call per source; no shelf/progress mutation; immediate catalog before held body; storage stop; explicit/shelf identity; known-author guard; source capability fallback; proxy category stop/no health; total deadline and user cancellation; foreground preemption actual Core options, requeue, same-book join; catalog subscriber duplicate/retry guard.
Other PASS logs `/private/tmp/fix-<name>.log`:
- test-search-gateway.mjs (mixed valid+bad rows, identity/version envelope rejection)
- test-source-switch-gateway.mjs (12 sources advance before held s0; nested environment error propagates, no dispatch beyond initial 8)
- test-search-orchestrator.mjs
- test-search-publication-boundary.mjs
- test-book-metadata-presentation.mjs
- test-performance-regressions.mjs
- test-bookshelf-manual-update.mjs
- test-toc-repair-regressions.mjs
- test-reader-source-category.mjs
- test-book-acquisition-coordinator.mjs
- test-search-detail-cache-first.mjs
- test-search-publication-state.mjs
- test-reading-phone-tablet-shared-architecture.mjs
`git diff --check`: PASS.

Two mistyped/assumed test names did not exist (`test-book-request-scheduler.mjs`, `test-search-result-relevance.mjs`); these are command lookup failures, no product test failure, not included as passes. Scheduler behavior is exercised by actual Coordinator and orchestrator tests. No ArkTS/HAP/VM verification performed here; root owns final unified pipeline.
