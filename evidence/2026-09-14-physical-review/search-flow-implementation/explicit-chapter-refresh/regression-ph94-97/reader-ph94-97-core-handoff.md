# Core PH94–97 repair handoff

Source base: 2e5a3504d. Production commit: 5c79799d5. Final HEAD: c86b6aaec (follow-up only fixes test constructors and a clippy assertion).
Scope: Core only. No Harmony modification or device operation. Root owns Native/HAP and device acceptance.

## Confirmed problems and fixes

1. Cached chapter reads with a positionContext performed a full position-migration capture, traversing/serializing all history and marks and repeatedly projecting the same body. Reuse one lightweight evidence snapshot and one document projection; validate context against that scope without a fetch stamp or write capture. Actual replacement still captures and compares all protected state. Probe with 1500 history rows and 300 long-note bookmarks: five context reads fell from 238.689 ms to 16.935 ms on local debug macOS; these are not phone timings. No-context reads were 19.492 ms before and 17.228 ms after, so this alone does not establish the user's initial shelf delay cause.

2. chapter.content's real HTTP continuation overwrote the original chapter URL with finalUrl; publication compared that finalUrl to the old cache URL and rejected normal same-chapter redirects as chapter_identity_conflict. Before probe is /private/tmp/reader-redirect-before.log. Freeze the caller's original chapterUrl (or explicit chapterRequest.url) before HTTP; preserve effective URLs for rule/image parsing; persist a separate reader-position-url-v1 binding alongside the body in the same SQLite transaction. Binding covers source/book/index, logical URL, stable cache URL, latest first-page response URL, canonical body fingerprint and source execution fingerprint. It participates in the existing full CAS.

3. New caches retain the logical chapter identity, while legacy cache URLs stay unchanged. Legacy compatibility requires an actual current request URL or returned URL exactly matching the old cache URL, or an already validated persisted binding. Current TOC entries alone cannot authorize an old body. Binding-only edits, source execution drift, body changes or missing/corrupt proofs prevent using the old relation. Cross-book/chapter identity is not relaxed. Source execution evidence excludes explicit display/grouping/health statistic fields, preserving rules, auth/header/JS and unknown raw source fields. The in-flight full-source CAS remains unchanged.

4. Scope checks and migration recognize the proven logical URL for highlights, retaining original highlight URLs/notes. Cache hits return the latest verified response URL for image base resolution. Cache clearing records internal detached proof v2 (reader accepts v1 and v2), preserving the stable URL and previously validated binding; same-body rebuilds retain marks, changed force refresh still follows the prior partial-position restoration policy. Unproven old cache histories remain protected, not silently remapped.

No public command/event schema, SQL schema, ChapterCacheEntry wire shape or migration version changed. New URL facts use the existing generic cache table and reader-position-* preservation. Existing backup snapshot round-trip preserves the facts. Failed binding writes and cancellation roll back the body, binding, progress and all marks together.

## Verification

- /private/tmp/reader-cache-position-before.log and /private/tmp/reader-cache-position-after.log: cache-path performance probe, real production methods.
- /private/tmp/reader-cache-progress-position-regressions.log: prior 28 position tests passed before the redirect delta.
- /private/tmp/reader-redirect-before.log: red same-chapter redirect probe, chapter_identity_conflict.
- /private/tmp/reader-redirect-all-position-final.log: final 32 runtime position tests + 10 SQLite position tests passed.
- /private/tmp/reader-redirect-images-final.log: pre-existing real redirect/relative-image cached reopen regression passed.
- /private/tmp/reader-refresh-progress-wire.log and /private/tmp/reader-refresh-progress-wire.json: four actual Pending→HTTP→SQLite→location.resolve→progress.update cases, same/different body and with/without stored progress. JSON provided to Root for Host integration, not a mocked Core reply.
- /private/tmp/reader-ph94-97-core-final.log: official whole-Core check-local run after commit; status to be reported separately when complete.

New regressions include continuous redirects, legacy positive/negative evidence, explicit chapterRequest without chapterUrl, snapshot reopen, source display/health metadata changes, actual rule changes, canonical body drift, corrupt binding, concurrent binding mutation, detached-cache rebuild and binding write/cancel rollback. Existing strict migration, unproven-highlight preservation and nonzero detached proof protection remain covered.

Files in commit: reader-runtime remote.rs; remote/remote_content_positions.rs; remote/acquisition.rs and runtime.rs initializer-only additions; reader-storage sqlite_backend.rs exports; sqlite_backend/remote_content_positions.rs evidence/snapshot/transaction plus tests.

Official gate attempt 1 stopped at test compilation/clippy (two pagination fixture constructors missed new fetch metadata fields; err().expect assertion style). Preserved at /private/tmp/reader-ph94-97-core-attempt1.log. Both fixed in c86b6aaec, production unchanged. Attempt 2 has passed fmt/clippy and finished all test-binary compilation; final runtime/protocol/ABI outcome is pending.

Final official gate: c86b6aaec, fmt/clippy PASS, 3890/3890 test assertions PASS with one separately retained CLI host_replay LEAK warning, conformance 210/210 PASS, strict drift PASS, C and C++ ABI smoke PASS. Full script exit status is in the tool receipt. The LEAK is host_record_outputs_replayable_single_step_fixture, the same fixture as the earlier standalone tool-layer investigation; it was not hidden or “fixed” by increasing timeouts.
