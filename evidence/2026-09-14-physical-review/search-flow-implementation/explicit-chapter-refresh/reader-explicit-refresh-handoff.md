# Explicit chapter refresh — Core handoff

Base: Core cfb0208f4; reported physical build Harmony e5483b93. No device action performed. Changes are uncommitted, Core only.

## Trigger and confirmed defect
User refreshed a chapter but did not see a replacement. The existing real chapter_content → Pending → complete_remote_host test seeded OLD BODY and reading offset 3, supplied NEW BODY over the HTTP continuation, and required the old body to remain after strict anchor failure. The new desired assertion failed before the fix: preserved instead of committed. This proves the production branch, not that this physical sample's response was observed.

## Behavior
- Keep non-user replacement's strict matching behavior and the original local-import adapter contract.
- For explicit forceRefresh, gather positions once and reuse the existing regex anchor adapter's one batch matching pass. Resolve independent valid entries; unresolved reading progress/history and supplied Host positions fall back to chapter start.
- Proven bookmarks/highlights map only on reliable positions. Unproven or unmappable marks retain their original records and proof bytes. An unresolved highlight retains BOTH endpoints. No new version proof is minted for an unresolved mark.
- Publish valid new body, mapped positions and proof updates atomically through the existing SQLite CAS. A partial recovery returns committed / positions_partially_restored, with actual new body/version.
- Storage errors now propagate as errors for both explicit and strict paths. Cancellation, timeout, source/identity changes and concurrent edits preserve prior data.
- Existing read_mark_scope rejects a retained old mark's proof against the new body revision. Normal cache reads and repeated explicit refresh remain usable.

## Files
- crates/reader-runtime/src/remote/remote_content_positions.rs: planner/publisher and actual production-path regressions.
- crates/reader-runtime/src/remote/text_position_anchors.rs: optional partial resolution shares strict implementation and one batch scan.
- crates/reader-runtime/src/remote.rs: existing HTTP refresh regression now verifies new body and offset 0.

## Verification
- /private/tmp/reader-explicit-refresh-before.log: required production assertion fails before fix.
- /private/tmp/reader-explicit-refresh-http-final.log: same real OLD BODY → HTTP NEW BODY regression passes on the final source (after-first.log also records its first green run).
- /private/tmp/reader-explicit-refresh-position-final-v4.log: 25 position tests pass. Includes mixed valid/invalid/missing-proof bookmarks and highlights, ordinary cached read/repeated refresh, HTTP Pending transport/parse/status/concurrent progress/source/identity failures, and injected transaction rollback/cancellation/timeout.
- /private/tmp/reader-explicit-refresh-local-strict-final.log: 3 original local-import preview upgrade tests pass, including repeated/missing anchors and invalid positions.
- cargo fmt --all -- --check and git diff --check pass.
- First position matrix showed five old expectations that encoded the obsolete explicit-refresh preservation behavior. Strict test cases now explicitly exercise forceRefresh=false; the explicit legacy-array case expects replacement/reset. The next run exposed one test-only missed conditional after expanding storage/cancellation cases; corrected, final 24 pass.
- One initial integration invocation used a source module name as a Cargo target and did not run; corrected to runtime_integration with the reader_ui_import_commands::preview_upgrade filter.

## Preserved boundaries requiring root decision
- A changed response finalUrl currently still fails chapter_identity_conflict. The cache stores final URL, not the logical request URL; safe acceptance needs proof against frozen TOC identity plus CAS semantics, not relaxed string identity checks. No URL/identity protections were loosened.
- Root subsequently authorized missing old bytes with valid detached provenance: implemented. Different new body commits in format 3, resetting chapter progress/history/Host positions to 0 and preserving all mark records and old proofs. Previous body/processing versions come from the validated detached proof. Same body reconstruction preserves offsets and old format behavior. Missing/malformed proof and capture mismatch still fail. The actual HTTP regression has five branches: changed, same, missing proof, malformed proof, capture mismatch.
- /private/tmp/reader-explicit-refresh-detached-before-v2.log proves the added path rejected valid NEW BODY before this fix. Initial detached-before.log was a test-only compile error from a nonexistent convenience delete method; corrected using the existing snapshot restoration method and not counted as reproduction.

No all-workspace gate, Native build, HAP build/install, or device acceptance claimed. Root owns Host UI integration and combined validation.

## Remaining redirected chapter URL boundary
SourceFetchMeta (remote.rs:1350) contains expected_source_version, serialized position_basis, initiated_at_millis, but no original logical chapter URL. Captured RemoteChapterPositionState does include the cached TOC snapshot. That TOC envelope has logical chapter URLs, source/catalog/context versions; however the body cache stores final URL and no catalog-version/logical-URL provenance tying the old body to the current TOC entry. Thus current TOC by itself is insufficient for a general transparent redirect update when an old cache predates a changed directory. A minimally evidenced path could retain the pre-response request URL and accept a final-URL change when that exact request equals the old cached URL; general TOC-only acceptance needs bound body logical identity. Updating the stored final URL also needs transactional handling of highlights' chapter_url and their proofs: current storage protects that field and subsequent planner checks it. No such identity contract was improvised in this change. Redirect changes continue to return a real error with old data retained, and remain an explicitly open adjacent case rather than a claimed full refresh closure.

Final state: 3 Core files modified, no commits. No Harmony changes. Production frozen for root integration.

## Final single-highlight URL correction
Root identified the remaining all-chapter rejection from an old highlight with chapter_url different from the cached chapter URL. The mixed real HTTP test was extended with a scoped wrong-URL highlight and failed before the production change with highlight_chapter_identity_conflict (/private/tmp/reader-explicit-refresh-highlight-url-before.log). Explicit refresh now treats only that highlight as unproven: both endpoints and original proof/quote/note remain unchanged, other marks and valid new body can publish, and repeated refresh remains usable. Non-user strict mode retains the original conflict outcome. read_mark_scope uses its already-loaded basis to reject a conflicting highlight URL even for an identical current bodyVersion, with no added DB query. A new strict/same-body test covers both behaviors.

Final delta validation (no repeated all-workspace suite):
- /private/tmp/reader-explicit-refresh-highlight-url-final.log: 26/26 position tests pass.
- /private/tmp/reader-explicit-refresh-highlight-url-http.log: original actual HTTP OLD BODY to NEW BODY test passes.
- /private/tmp/reader-explicit-refresh-highlight-url-clippy.log: cargo clippy -p reader-runtime --lib --locked --offline -- -D warnings passes.
- fmt --check and diff --check pass.

This final delta affects only remote/remote_content_positions.rs; the total task still owns the same three uncommitted Core files. Actual response redirect/cache URL change remains an independent identity error; it was not loosened. Source remains frozen for parent integration.
