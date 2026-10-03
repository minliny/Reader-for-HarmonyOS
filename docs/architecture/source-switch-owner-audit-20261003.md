# SourceSwitch feature owner: production candidate and outstanding integration

Baseline: clean Host `3b390cd6c2b3c0a91ceda78c3a1ddcfcbdf001e2`. Independent branch/worktree; no Index, reader component tree, typography, UI geometry, Core schema, HAP or device changed in this candidate. Runtime admission prerequisite is Root's `2190deda` (local cherry-pick `e6a567cc`).

## Actual problem and resulting ownership

Index previously owned the candidate subscription, dirty projection queue, generation, transaction bookkeeping, prior pending compensation, per-book progress serialization, canonical anchor election, commit/error reconciliation, rollback, cold pending discovery, close/Back safety and failed candidate retry. `SourceSwitchGateway` validated wire data and acquired the existing shared book coordinator's target session. Core owned chapter matching and the atomic shelf/progress/before-image journal; the reader gateway finalized the journal with its first confirmed canonical anchor. These latter owners remain unchanged.

`SourceSwitchHost` now owns the complete feature journey listed above. It is a real finite feature owner, with its state, subscription, asynchronous work, admission and recovery retained together. It uses the actual existing Gateway, progress producer lane, canonical progress Gateway and shelf Gateway. Page navigation and retained reader seam stay in Index as finite effects. Discovery/acquisition retain cancellation; storage writes receive dispatch-before-send admission and retain their actual late ACK independent of UI retirement. An observer throwing does not convert a confirmed write into failure or cause compensation.

## Exact Index integration contract (P5 sole writer)

Construct one Host with the captured `ReaderRuntimeOwner`; retire it on page teardown or navigation replacement. `open(context, lease)` gets the original probe query, shelf membership, admitted TOC anchors (`{chapterIndex,chapterTitle}`), matching shelf DTO, known Search candidates and already searched source IDs. No matching or normalization algorithm is moved into Index.

The lease checks captured runtime/navigation/lifecycle and the book identity supplied by the Host. `changed(snapshot)` projects the DTO into page fields. `effect(effect)` guards again, then performs the original route/reader seam. Effects are `previewReady`, `targetReady`, `restoredForNextChoice`, `rollbackReady`, `acquisitionFailed`, `closed`. `restoredForNextChoice` updates only the current reader origin DTO/seed, clears the old session/TOC on identity change and refreshes shelf, exactly as the previous helper; it must not increment the captured navigation generation. Host updates its own identity immediately after that synchronous effect. `targetReady` retains the exact pending transaction before replacing the old reader; target session and matched chapter are reused.

Every temporary-layer callback captures the emitted `snapshot.scopeId` lexically:

- `pick(candidate, scopeId)`, `retry(scopeId)`, `refresh(scopeId)`.
- `close(scopeId): boolean`, `consumeBack(scopeId): boolean` (consumes a live overlay even if a storage safety rule refuses closing).
- `rollback(scopeId)`, `retryFailed(scopeId)`, `dismissFailure(scopeId)`.

Do not obtain a fresh scope ID when an old callback is clicked. A new open/rebind increments scope; old callbacks cannot operate the reopened overlay. Pick also admits only the current candidate's exact composite identity/version and uses its canonical metadata.

Reader/route bridge: `blocksExit(identity)`, `currentTransactionId(identity)`, `resolveTransaction(identity,current)`, `inspectPending(current)` and `targetCommitted(identity,capturedTransactionId)`. The last method is called only after the existing Core-confirmed first canonical anchor callback; pass the transaction captured by that reader, never read a newer ID inside a late callback. It returns the prior pending DTO so Index may perform the existing old-identity cache cleanup. Startup inspect is read-only. Source-switch journal contents never enter ArkUI storage.

## Honest unknown boundary and remaining protocol work

Core's legacy `source_switch_transaction_id` combines SDK request ID, timestamp/nanos and nonce, producing a fresh ID for each commit attempt. `source.switch.pending.list` has only transaction/from/target identity. The old Index code matched from/target after a lost commit ACK and automatically rolled that journal back. This is not proof that the journal belongs to this request. The candidate never confirms an unknown write from a matching shelf or pending snapshot, automatically compensates it, or blindly repeats commit. Matching pending records are a separate observed fact. Explicit rollback selects the exact Core-owned journal and still relies on Core's finalized/stale protection.

`snapshot.write` separates action, generation, confirmation (`undispatched` / `confirmed` / `unknown`), optional opaque transaction ID and observed pending records from the visible panel state. Local validation and Root's branded pre-send refusal remain undispatched; malformed/partial post-send envelopes retain unknown (including any opaque ID already decoded). Unknown blocks a conflicting new write or exit. A retired accepted write settles in the owner without reopening the old reader. Same-book unknown may rebind for read-only recovery.

This is a code candidate, not the family exit. P4 owns the required additive Core exact caller lineage contract: stable operation ID + safe sequence, one protected head and bounded settled journals, same ID/different payload rejection, pure exact query with actual phase/outcome. P3 must add one durable fixed intent before dispatch and consume exact query proof; absent query alone never proves undispatched. This protocol gap is not a permanent platform limitation. P5 must integrate the Host, remove the old transaction/discovery owner implementation, and prove the actual Index→Host→SDK callbacks. The unknown display must use truthful wording and a real read-only recovery action in the existing bounded surface tuple before integration closes. Current panel title is still the legacy failure title; this candidate does not claim final unknown UI admission.

## Verified and not verified

`node tools/test-source-switch-host.mjs` runs the actual full Host and Gateway source, actual progress lane/Gateway and real Core error brands with controlled native/startup IO. Eleven positive journeys cover real discovery/commit/session seam, exact transaction release, commit Back safety, late ACK retirement, pre-send route/book refusal, lost ACK observation without rollback/replay, partial envelope, preview without a shelf transaction, close/reopen old scope, serialized dirty projection, observer exceptions and the same per-book producer lane. Two production-method negative controls reproduce identity-only automatic compensation and reopened-scope mutation. Installed ETS compiler parses the actual owner; no native rendering claim is made.

Existing Gateway, presented-progress, catalog-seam and transaction regressions pass. Root's actual Runtime→SDK send test proves the real dispatch seam separately. Full ArkTS/HAP, actual Index delivery, native scheduling/focus, target, visual and user acceptance remain separately open. No shared target was occupied.

Rollback unit: remove the new Host and its integration together; preserve Core's journals and the fixed intent authority once introduced. Never clear authority to make an unknown look resolved. The existing Gateway's optional evidence parameter is additive, so pre-integration legacy callers remain compatible.
