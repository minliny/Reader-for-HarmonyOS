# Replace regression carrier closure (2026-10-03)

## Frozen evidence and actual defect

The assigned five failures came from the frozen `6e9af0e5-2020/contracts` capture. This test-only lane starts at `f26985bab45a0ae975659a95d03d51f668df1d39`; production remains owned by P3.

Three former imports pulled RulesManagement/Runtime bootstrap into Node strip-only execution, which fails on BundledSourceLedger parameter properties. The tests now reuse the existing complete Rules owner/Gateway/AtomicFile fixture and installed HarmonyOS SDK emitter. No dummy domain owner, TypeScript syntax suppression or persistence algorithm has been added. The partial-update function is selected from the real Gateway AST and compiled with that SDK. Readonly preview DTO injection remains an explicit transport seam; this fixture does not claim to qualify Core preview rendering.

The content test incorrectly expected unknown-write reconciliation to close the editor. Current behavior preserves the same draft/editor and submits its captured exact operation identity. Both status and editor now call the same finite keyed recovery Builder. All previous draft/error/confirmation/session/preview, geometry, row identity, scroll/clip, typography, footer, flag/input and CRUD/bundle scenarios remain.

A new real defect was reproduced before any production change: complete Rules SDK Owner/Gateway -> actual AtomicFile thin seam -> actual SQLite Core `rules.mutation.apply` lost ACK leaves a valid retained operation ID in the domain owner, but LRE `runControlReplaceMutation` only calls `failReaderControlReplaceRequest` in its catch. The current editor received `writeUncertain=true` and `writeOperationId=undefined`. Its physical recovery actor called `onReload(undefined)`, which `reloadControlReplace(true, undefined)` rejected against the actual original ID. Closing/reopening was required to acquire the missing identity.

P3 supplied the one-line production fix `188b7958bf874f1d3487c5d0f829a1f25ac4872c`: project the actual owner facts within the existing still-owns catch. This lane only cherry-picked that dependency as `b0a1bd24`; it does not re-author it. The new Host assertion fails on the original production body and passes with that dependency. Root must integrate P3's production fix separately from this test-only commit.

## Verification

The five directed gates pass on the patched production dependency. Raw logs and selected-input before/after hashes are at `/private/tmp/reader-p4-replace-legacy-20261003-gates/RESULTS.json` (selected inputs stable). The observed actual CLI SHA256 is `656e0abfba92154203cbcdcf91bd0735891f2e802344813312df3b4b5cacf3cb`. This identifies the executable used, not a signed HarmonyOS library/package.

- `test-reader-control-replace-content.mjs`: original async/draft/preview/session matrix; unknown retains original draft and blocks resubmit; removed original identity rejected; actual SDK row/morph/clip/font negative controls unchanged.
- `test-reader-control-replace-gateway.mjs`: complete installed-SDK Owner/Gateway, actual Atomic IO and cold SQLite Core; lossless partial fields, unchanged-field concurrent update, validation/admission, confirmed write after UI closure, actual lost ACK, malformed original receipts, shared-owner replacement barrier, exact-query recovery, preview bounds, replacement-only bundle, duplicates and no-op remain. The old hand-written mutation/receipt implementation is removed. Repeated updates use different actual fields, because a real Core correctly rejects updates with no change.
- `test-reader-control-replace-geometry.mjs`: all endpoint/midpoint/width/row/reversal/one-tree assertions remain; the finite recovery carrier additionally executes actual SDK native callbacks. Old operation A cannot act on B, pending callbacks reject, and settled old callbacks cannot resubmit. Removing only the real identity guard makes the retained-callback assertion fail. Archived motion capture remains an explicitly optional source-value comparison and was absent here.
- `test-reader-control-replace-host.mjs`: all previous reopened/import/stale-read/write-owner/content-refresh/failure/retirement cases remain. New complete SDK+SQLite before/after-ACK loss cases prove current editor identity, actual cold rebuild, pure null query preserving unknown, no new mutation, explicit same-ID/same-sequence/same-DTO continuation through the real SDK physical recovery actor, exact receipt qualification and only then Atomic intent cleanup. Each compiled realm uses its own real production error class.
- `test-reader-replace-editor-feedback.mjs`: all six original SDK groups pass, including real compact input tuple/theme, bounded frame/footer, scope defaults, draft preservation, pending cancellation and standalone settings.

Unchanged independent strong checks also pass: `test-rules-mutation-durable-intent.mjs` (29 real Owner/SDK/Atomic/cold SQLite chains), `test-rules-reading-invalidation-sdk.mjs` (all original families plus actual SDK fence and unwrap negative control).

Use the matching Core CLI root in isolated layouts:

```sh
READER_RULES_RECEIPT_CORE_ROOT=/private/tmp/reader-full-architecture-delivery-20261003-1845/Reader-Core-Native node tools/test-reader-control-replace-host.mjs
```

The existing fixture defaults to the immediate sibling Core in normal paired workspaces. No Index, Rules owner, shared SDK helper, layout, colour, font tuple, deployment or target file is changed by this test commit. Installed-SDK emission/Builder callbacks and controlled IO are not native HarmonyOS scheduling, OS crash durability, pixels or user acceptance.

## Readonly Asset inventory pre-review

The installed official `@ohos.security.asset.d.ts` exposes `query(AssetMap)`, metadata-only `ReturnType.ATTRIBUTES=1`, and `RETURN_LIMIT`/`RETURN_OFFSET`. WebDavCredentialStore currently uses `ALL` only for exact-alias normal credential reads; it has no metadata-only inventory. Current immutable configuration records do not have a common DATA_LABEL, so querying a future label would miss existing orphan UUID records.

A thin diagnostic can use the official metadata-only query, bounded pagination, in-memory prefix filtering for `reader.webdav.config-save.` plus the legacy fixed alias, and aggregate count/truncation/elapsed output. CookieSessionStore and ReaderTtsCredentialStore also use Asset: never log broad aliases, labels, credential URLs or SECRET bytes. No new library, parser, task store or cleanup algorithm is required. A result unexpectedly containing SECRET must be rejected without decoding/output. NOT_FOUND/service/permission/partial pagination must be distinguished. The finite page budget bounds observation work; reaching it reports partial evidence rather than inventing a complete physical count.

This diagnostic cannot prove pending native add/remove settlement, permanently cap physical UUID count, authorize alias reuse/deletion, or unlock an unknown intent because an alias is absent. Pagination under concurrent late native changes is observational, not an atomic snapshot. Target questions remain: actual ATTRIBUTES excludes SECRET; app-token namespace and pagination behave as documented; aggregate own-prefix count and observation latency/memory are measurable under the signed candidate. No device operation or inventory implementation was performed in this lane.
