# Bookshelf catalog updater — P2/P6 bounded family

Baseline 2a48ffb5: Index owned target scans, two-book iteration, source admission and swallowed per-book failures. Manual updater treated its predicate as always current, final read reacquired current Runtime, and attempted count was the only outcome. No user-visible partial result survived completion.

The existing BookshelfHost now owns catalogTargets and refreshCatalogs; BookshelfCatalogUpdate delegates actual IO and forced acquisition to the existing BookAcquisitionCoordinator. Index keeps its route/navigation lease, body-window presentation adapter and actual snapshots. All work carries one exact mounted Runtime, navigation and operation epoch. Auto/manual epochs are distinct; accepted completion cannot clear a newer flag, and navigation/teardown immediately retire those leases. No scheduler, global owner, executor or error bus was added.

Preserved: all-network-book scan for filtered/paged shelf; exact revision seeds shared with durable preparation; one bounded revision retry; maximum two books in flight; ten-minute auto throttle; manual force bypass of prepared/nonforce results; automatic catalogs only; manual independent readable body window; existing progress/selection/body records; existing Shell/RecoveryNotice/RecoveryAction styles.

Outcome distinguishes attempted, catalog succeeded, catalog failed, and body preparation failed. Per-book errors/empty TOC do not stop healthy books; a successful catalog is never described as failed solely because body preparation failed. Final shelf-read failure retains the current shelf and successful acquisition facts. The physical recovery action reads only the shelf with the original Runtime; it does not replay source acquisition, import or removal. Checking failures do not infer undispatched writes/rollback.

PASS current real production updater -> existing Host -> Coordinator/Gateway -> Index -> SDK Shell/Notice/Action test: previous manual/cache/force/revision/auto cases plus partial failures, empty catalog, body failure, manual+auto deferred unset/replacement/navigation/close, failed readback, duplicate read-only recovery and old physical callback. SDK proof is actual emitted payload/attributes, not native pixels/lifecycle scheduling.

PASS shared-scan exact revision/fallback/bounded retry, readable prefetch business boundaries, Legado product logic, Host wiring, bookshelf/import receipt chain, Index Runtime retirement, temporary-back actual SDK chain, private Typography budget and test tiers.

Probe setup failures were recorded and fixed without relaxing production guards: missing declared shelfRevision in the legacy manual fixture, standalone Host import adaptation, custom-builder metadata registration. One accidental local test loop was stopped before re-run; no production or device side effects.

HAP, target, visual and user acceptance are OPEN in this lane. First/refresh/retry bookshelf read ownership and Settings cache remain separate next slices; this commit does not close the whole Index responsibility map.
