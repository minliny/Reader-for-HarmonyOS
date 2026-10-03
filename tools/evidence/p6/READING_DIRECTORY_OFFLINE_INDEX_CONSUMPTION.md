# Directory / Offline actual Index consumption (2026-10-03)

This slice consumes the existing finite ReaderDirectoryHost / ReadingOfflineHost and their exact operation-intent authorities. It does not change normal directory typography, toolbar dimensions, rows, sorting, scroll identities, reader body or persistent ReaderShell tree.

## Real ownership and removal

- Index no longer owns bookmark/offline mutation generations, mutexes, asynchronous write algorithms, Core bookmark/clear/prefetch gateways, bookmark merge algorithms or the duplicate remote availability loader.
- Bookmark create chapter start / exact reader position / bounded batch deletion / control read call the shared ReaderDirectoryHost. The exact ReaderPageBookmarkToggleRequest and onSettled admission are retained.
- Manual chapter/book downloads and clear call the shared ReadingOfflineHost. Existing progress/toast strings are presentation-only; queue/progress/partial facts and ACKs remain in the owner.
- All production factories now install BookmarkOperationIntentStore or CacheClearOperationIntentStore as the fourth argument, including source-switch retired-source cleanup. Readonly-first ReadingEntry factories can install this authority later on the same owner.
- Directory/offline emissions update display DTOs and call ReadingEntryHost.replaceDirectory in the existing scope; they do not create another acquisition/session or remount the reader.
- Captured exact Runtime/mount/navigation/book/session scope protects domain delivery. A separate temporary-directory presentation generation protects recovery actions across close/reopen, without retiring the still-mounted reader's legitimate bookmark settlement callback.

## Actual consumers

Index → BookDirectoryPage.recoveryContent, and Index → ReaderShell → ReaderFullDirectory.recoveryContent consume ReadingDirectoryRecovery. ReaderDirectoryRecoverySurface is a finite business composition, using the existing ReaderRecoveryNotice and 36vp ReaderRecoveryAction; it defines no new fonts, backgrounds, radii, native overlays or generic error bus.

Normal state creates no recovery actor. Fault-only content participates in the existing detail toolbar measurement / full-directory panel bounds. Native layout measurement, clipping and animation still need the target gate; local SDK checks prove emitted closures/property payloads and modifiers, not device pixels.

The projection keeps these facts separate:

- confirmed bookmark write vs failed canonical list read;
- unknown write vs exact readback / explicit continuation permission;
- partial batch count vs complete batch (a refreshed partial list does not lock the persistent bookmark control as if the list failed);
- confirmed Core cache operation vs physical image cleanup failure;
- available existing chapters/bookmarks vs pending prior operation (availability is not an ACK).

Read actions call only reconcile/load. Only the explicit **继续原操作** actor calls continueOriginal, and only the owner can authorize it after an exact query. Actor keys bind original presentation + family + generation. Actual V1 retained observer replay cannot promote an old actor to a new token. Whole reader/page remount is not used.

## Warm reconstruction defect fixed

The old owner.load returned immediately while an accepted operation was active. Recreated UI retained a mutex/receipt but never received the late result, because the accepted operation's original delivery lease was retired.

Each owner now retains at most one latest captured pure-read request. After the accepted operation releases, it drains only a still-current Runtime/entity/UI binding. Replaced/retired reads settle without dispatch; the accepted write/receipt/generation are never reset. No polling, mutation replay, global subscription manager or unbounded task queue is introduced.

## Evidence

- `tools/test-reading-directory-index-sdk.mjs`: 12 full-chain groups with production owners/stores emitted by the installed SDK, actual CLI/Core SQLite cold reads, actual Index methods, actual leaf recovery Builders and native shared action callbacks. Includes confirmed-write/read-failure, lost ACK, exact original continuation, double tap, close/reopen, retained V1 update, Runtime unset, cold partial batch, image failure, same-Runtime new Index late ACK and two mutation-negative controls (removed read drain / removed presentation guard).
- `tools/lib/reading-directory-sdk-consumer.mjs`: reusable actual consumer fixture for legacy test migration. The leaf recovery Builders are actual production methods; native list/layout/removal is deliberately not simulated.
- Existing exact durable suite: 46 production Host/Gateway/atomic-IO/Core SQLite scenarios through Node and installed SDK whole-source emission pass with matching Core CLI.
- Existing BookDirectoryPage methods/SDK, contract tiers, architecture shared producer and unchanged private-budget registration checks pass.
- Existing ReadingEntry 12 strong SDK consumer groups continue to pass.

Matching Core probe command for this lane:

`READER_READING_RECEIPT_CORE_ROOT=/Users/minliny/Documents/Reader/.reader-isolated/p6-backup-publisher-20261003/Reader-Core-Native node tools/test-reading-directory-index-sdk.mjs`

The final canonical build must use its matching sibling Core, SDK, source and manifest. This candidate does not make HAP/target/visual/user-acceptance claims.

## Legacy fixture audit, retained without waiving failures

Read-only capture: `/private/tmp/reader-directory-consumer-legacy-audit/RESULTS.json` and per-test logs. Nine affected suites: two PASS, seven FAIL in this pre-integration lane. These are retained as open integration work, not called a full local PASS.

Failures currently point to removed method/field-location extraction or missing newly required actual dependency:

- reader-control-bookmark-load: expects Index-owned mutation generation;
- reader-control-bookmark-mutation-recovery: slices obsolete Index perform methods into the following Builder;
- reader-directory-markers: expects exact-position mutation algorithm in Index;
- reader-physical-window-bookmark-refresh: extracts removed Index perform methods;
- reading-offline-completion and reader-controls-ph104-108: construct a pre-owner fake offline gateway/Index fixture;
- source-switch-index-owner-sdk: existing fixture omits mandatory CacheClearOperationIntentStore for the newly actual cleanup factory.

Preserve all functional/ACK/old-callback assertions while moving probes to the actual owner/consumer fixture; do not restore duplicate production algorithms or stub the durable authority. `test-local-directory-download-projection` and `test-reader-directory-business-boundaries` pass unchanged. The already delegated Entry legacy fixtures are owned by their respective reviewers.
