# Shelf entry latency / refresh failure — bounded Core audit

Reported artifact: Core 2e5a3504d, which parent confirms is the Native installed on the physical device. No device operations in this audit. Core checkout was clean at start; current changes are uncommitted in remote.rs and remote/remote_content_positions.rs only.

## Confirmed duplicate cache work (fixed)
`cached_chapter_content_result` loaded current evidence/body/processor, projected for processing compatibility, then a supplied positionContext invoked `capture`: another snapshot including whole-book progress history, bookmarks, highlights, TOC, source and per-mark proofs, followed by serialization of that migration read set. It then fetched the body a second time, reloaded processor inputs and projected again. A normal cache read validates coordinates but never publishes a replacement, so this full migration capture was unnecessary.

The new cache path uses one current-chapter evidence snapshot and its projection for cache rendering/versions. A shared pure `validate_context` checks body and processing versions, duplicate IDs, bounds and anchor count; the full snapshot remains mandatory for actual publication/CAS. Inline diagnostic source origin rendering stays compatible. Old processing seals and stale coordinate errors remain enforced. No protocol fields changed and no persisted user data changed.

The real `chapter_content_from_input` probe restores 1500 history rows + 300 bookmark notes and a current chapter, then reads 5 times. Debug-build macOS timings:
- before: no context 19.492 ms; context 238.689 ms total for 5 reads.
- after: no context 17.228 ms; context 16.935 ms total for 5 reads.
- before /private/tmp/reader-cache-position-before.log; after /private/tmp/reader-cache-position-after.log.
This supports removing the measured redundant work. It does not prove this exact workload exists on the user's phone or explain all multi-second bookshelf entry delays, especially a first open that sends no positionContext.

## Refresh → position → progress contract
New production-method regression exercises actual force-refresh Pending → HTTP response → SQLite publish, parses the result as ChapterContentData, passes returned mapped coordinates through `reader.location.resolve`, then stores them through `reading.progress.update` with new expected body/processing versions and reads them again. Same/different content × existing/no existing progress = 4 cases pass. No remote metrics command exists in Core; local_book.content.metrics is local-only and Host owns remote page layout measurement.

The first draft of the test omitted required layout alongside the update anchor; its failure was INVALID_PARAMS (anchor and layout must be provided together), a test-fixture mistake, not attributed to production. The corrected protocol case passes in the final position module suite.

Potential causes that remain unproven for the reported phone failure: Host passing stale versions or a stale materialization generation; concurrent old-body progress writes during a refresh causing the intentional complete-state CAS to reject; original redirect/logical URL issue. None was assumed to be the physical root cause. No source/position CAS or redirect identity protection was loosened.

## Validation / handoff
- /private/tmp/reader-cache-progress-position-regressions.log: 28/28 position tests pass, including performance/data preservation, wrong versions/duplicate IDs/out-of-bounds cached context, and the four refresh/progress contract cases.
- /private/tmp/reader-cache-progress-http-regression.log: original real HTTP OLD BODY → NEW BODY refresh test passes.
- /private/tmp/reader-cache-progress-clippy.log: reader-runtime --lib clippy -D warnings passes.
- cargo fmt --check and git diff --check pass.
No full gate, Native rebuild, HAP or device acceptance claimed. Parent owns Host diagnosis, integration and shared feedback record. Current Core changes are ready for review and remain uncommitted.
