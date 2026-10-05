# Bookshelf catalog and retained presentation actual owner — 2026-10-03

## Ownership and reuse

The existing `BookshelfHost.catalog(exactRuntime)` returns one feature-local `BookshelfCatalogOwner`. This owner owns the manual/automatic sweep mutex, accepted task, latest automatic intent, catalog generation, actual per-book counts, preparation seeds, final shelf readback status and pure-read reconciliation. The implementation reuses the existing `BookshelfCatalogUpdate`, `BookAcquisitionCoordinator`, `BookshelfFlowGateway` and `ReadingPrefetchHost`; no matching, acquisition, cache, parsing or scheduling algorithm is duplicated.

`Index` captures Runtime/navigation/mount/instance once and attaches a finite presentation binding. Its catalog methods now publish display DTOs or dispatch those intents. Old Index epochs, manual async batch and its separate readback transaction are deleted. `nextNavigationGeneration`/disappear detach only the original binding; accepted task truth settles in its original owner. A same-Runtime reconstructed Index reattaches to the same mutex/receipt; a new Runtime cannot replace a current owner's cache through a retired lookup.

Normal UI, 10-minute automatic interval, concurrency two, current cover/list animation, native hit targets, progress retention and existing shared reading preparation remain the baseline. `BookshelfCatalogUpdate` now counts an actual successfully returned acquisition before the presentation guard, while generic throws never become confirmed success.

## Truth and recovery

Target-read failure before execution may say **未启动检查**. After execution starts, attempted/succeeded/failed/preparationFailed/cancelled stay distinct; progress or diagnostic failure cannot replace accepted facts. A final shelf reload failure retains usable old shelf content and the real successful catalog counts. The shared notice exposes one pure-read refresh; repeat clicks do not run another catalog refresh. Unknown acquisition outcomes are not synthesized as ACK, and cancelled work is not labelled complete.

Automatic work retains at most one latest intent with that intent's original binding. After the old accepted read releases, a new current same-Runtime presentation can drain its one intent even with the same revision. Old bindings cannot reacquire a new Runtime. The existing single bounded revision retry remains; the owner's own published revision does not trigger a scan loop.

## Persistent UI

`Index.navigationGeneration` is now actual observable state. The existing `BookshelfPage` receives the Prop. During the real SDK observer render, native handler factories capture that primitive navigation. Current retained native actors receive fresh handlers; saved old handlers keep their old navigation and are refused. Optional navigation arguments bridge V1 constructor-only ordinary callbacks without borrowing mutable current state.

Only the small shared recovery Notice is keyed by navigation plus receipt generation. Its ordinary and physical recovery callbacks capture that immutable identity. Page, List, covers, NoCover, native book actors and persistent Reader tree remain their original instances. Viewport and geometry remain page responsibilities; Core cursor/window/revision/source-name/membership ownership remains the already introduced BookshelfProjectionOwner.

## Proof and old regressions

- `test-bookshelf-manual-update.mjs`: **30** actual Gateway/Coordinator → whole SDK-emitted BookshelfHost/CatalogOwner → actual Index → real shared Notice/Action cases. The added cases cover real Host/Index same-Runtime reconstruction, accepted task/mutex settlement to the successor consumer, retained warm readback failure with one pure read, V1 retained Shell navigation with old physical/ordinary callbacks, and latest automatic intent drain. All original failure/cancellation/Runtime/native admission cases remain.
- `test-bookshelf-continue-reading-publication.mjs`: actual Index state → decorated Page Prop delivery; current physical click works after navigation, old physical and original ordinary callbacks refuse; one Page and 21 existing native actor IDs/NoCover actors remain unchanged.
- Existing single shared full scan, revision fallback, bounded retry, source-name eight matrices, immutable source-name copy/progress, 14 Shell state matrices, accepted write/import receipts, physical surface repair, view/list handoff, Tablet rail and viewport return are migrated to the actual new owner/methods. Original IO, ACK, failure and UI assertions are preserved rather than replaced by the new 30 cases.
- Source tests select new real handler methods; no lifecycle/receipt/dispatch predicate is stubbed. The SourceSwitch and Entry shared harness needs the actual optional `retireBookshelfCatalogPresentation` selector when it executes the actual new navigation method.

Scope: targeted code/local/installed-SDK emitted consumers in this candidate. Full canonical root capture, full ArkTS/HAP, artifact/target behavior, native pixels, performance and user acceptance are separate exits. Necessary partial/cancelled feedback is recorded for later visual fine tuning; normal visual specs and private-style budgets are unchanged.
