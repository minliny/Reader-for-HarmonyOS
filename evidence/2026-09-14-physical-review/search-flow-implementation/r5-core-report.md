# R5 Core scoped search implementation receipt

Scope: Reader-Core-Native current shared working tree based on 316ed8362; no commits, Native builds, HAPs, devices or network book fetches performed by this agent. R1/R4 and PH75 edits are owned separately by engineering_acquisition.

## Implemented

- `search-book.batch.get`: exact `{sourceId,bookId}` identities, up to 128 per call (empty valid), explicit requested missing rows; no source/list or whole-library fallback.
- `search-book.related`: exact identity, or exact normalized name/author only when identity does not exist. Empty author is exact empty. Existing disabled/orphan identity does not silently fall back to a different online relation.
- Typed contracts, command/event schemas, dispatch, method registry and Core-only UI contract classification. `SearchBookData` optionally adds relationKey/relationRevision to preserve legacy calls; scoped methods always populate both.
- SQLite v19 -> v20 transaction builds derived alias table/index. Existing `rusqlite 0.31` functions + SQLite recursive CTE perform indexed closure; scalar adapter applies ECMAScript whitespace and Rust maintained Unicode default lowercasing. No new parser/matching engine/dependency.
- Current alias plus at most 16 historical aliases; original labels, `variable` bytes, acquisition facts and extra data remain untouched. No fuzzy match or author completion. Source disabled/removed nodes cannot bridge otherwise unrelated online components.
- SQL insert/update/delete triggers keep derived aliases and snapshot revision in the same transaction as every search/source write, including direct SQL snapshot restore. Existing R4 transaction fault tests were re-run by their owner with these triggers (5 PASS).
- Normalization version includes actual standard-library Unicode version. On compatible DB reopen, a changed normalization version atomically rebuilds only derived index data and invalidates the snapshot. Future unsupported DB schemas are not rewritten.
- relationKey is a component identity, not a presentation/card identity; relationRevision is a digest of normalized aliases and members (metadata updates do not change it).
- Cursor binds scope/limit, database epoch+revision and relation revision. Stale returns INVALID_PARAMS with `details.reason=CURSOR_STALE` and restartScope=true. Response includes complete/nextCursor. Arbitrarily large same-book groups page in 128-book chunks, not a total 128 cap.
- Batch sourceVersions covers all requested sources, including missing sources as enabled=false and SHA256(empty). Related sourceVersions covers only the current page sources plus requested identity source, avoiding hashing/returning whole component definitions on each page. Host must accumulate pages only under equal snapshotRevision and must not infer deletion from absence in a partial page.
- Source fingerprint is computed once per scoped source and shared with existing acquisition projection; canonical catalog/body processing proof validation stays per book when required.

## Verification

- SQLite 11 formal production-path regressions PASS: `/private/tmp/r5-storage-tests-final3.log`.
  Command: `cargo test -p reader-storage --features sqlite --lib --offline scoped_search -- --nocapture`.
- Runtime 3 scoped regressions PASS, including 128 requested identities, exact missing, source versions, 129-book pagination, structured stale, empty/invalid boundaries: `/private/tmp/r5-runtime-tests-final2.log`.
- Existing+new real dispatch suite 9 PASS: `/private/tmp/r5-dispatch-tests-final.log`.
  Command: `cargo test -p reader-runtime --offline --test runtime_integration search_book_commands`.
- Contract crate 511 tests across 13 suites PASS: `/private/tmp/r5-contract-tests-final.log` (before unrelated PH75 contract additions).
- Protocol fixture lint: 269 cases, unexpected_invalid=0, unexpected_valid=0: `/private/tmp/r5-schema-lint.log`.
- Strict Core/UI drift PASS: `/private/tmp/r5-contract-drift-final.log`.
- SDK 50 tests PASS, 284 expects, including previously frozen R8 wakeup suite: `/private/tmp/r5-sdk-contract-regression.log`. SDK is generic `request(method:string,...)`; no generated method-specific bindings exist to regenerate.
- SQL performance probe in formal test: library 1 -> 2049 books; target relation VM steps 110 -> 113; full-scan steps 0 -> 0. EXPLAIN uses alias/identity indexes. This demonstrates bounded unrelated-data work, not device frame/network latency.

## Preserved failures / limits

- First performance test demanded identical VM instruction counts; actual B-tree search added 3 instructions as the index grew. Kept red receipt `/private/tmp/r5-storage-tests.log`; revised test checks identical returned relation/fullscan count and bounded constant instruction overhead, not wall-clock or whole-table scan tolerance.
- Initial contract test found schema/method enum ordering mismatch; fixed registry order, final full contract PASS. Initial strict drift found the two new methods unclassified; classification now maps actual Core handlers and tests (not a placeholder).
- Initial dispatch command used nonexistent individual test target; corrected to repository's aggregate runtime_integration target; 9 PASS.
- Initial storage clippy flagged R4 extracted helpers after test module; owner relocated them, no lint suppression. Final scoped clippy receipt: `/private/tmp/r5-clippy-final.log`.
- Snapshot invalidation is intentionally conservative: any committed search/source change invalidates pagination, including unrelated changes. Host must bound stale-scope restarts. RelationRevision itself remains stable for metadata-only changes.
- Recursive closure work scales with the actual connected same-book component and its aliases; it does not scan unrelated library books. Very large components are still traversed to compute a complete relation fingerprint; returned books and source definitions are bounded per page.
- Unicode default casing is explicit and stable across platforms; locale-specific Turkish casing is not inferred from device locale. Differential fixtures cover ECMAScript whitespace exclusions, FEFF/NBSP, Chinese, Greek final sigma, İ, sharp-s, Kelvin, combining marks. No NFC/fuzzy normalization is introduced.
- No network, installed app, frame timing or user-acceptance claim is made here.
