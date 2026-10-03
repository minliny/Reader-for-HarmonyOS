# Exact config save receipts

Baseline: e51 display-mode Store + 80 config physical dispatch/ACK + cc83 leaf + 5375 safe Runtime admission + P5 1971 actual Index consumer. No UI tuple, product gate, source/reading/native-alert entry or Core WebDAV protocol is altered.

## Effect and truth

A save obtains one SDK-generated UUID. The same existing AssetStore alias/FORMAT_VERSION=2 payload contains sanitized config plus optional non-secret saveOperationId; one actual add commits them together. No new global store, secret log or generic task bus is introduced. Old v2 payloads with no ID are still readable, and all legacy mode migration/serialized queues remain.

After lost add ACK, the foreground owner preserves unknown and the exact ID. The real shared recovery action queries only that ID in the secure record. A true match confirms this save, keeps its writeGeneration and never replays add. Failed receipt reads, absence, old envelopes, or identical fields with another ID remain unknown and block replacement. Query uses no migration/write path. Dispatch before commit cannot be called undispatched merely because the provider throws.

A new owner/process reads config and committed ID in one Asset query and can project that actual committed save, including after old delivery was retired. It does not invent an uncommitted/lost in-memory intent. If a process died before a save committed and no persisted intent exists, startup can only show current durable config and its actual existing ID; it cannot claim recovery of that absent intent. No automatic replay occurs.

Clear continues the real remove boundary. A lost remove ACK remains clear's own unknown evidence; NOT_FOUND confirms absence for clear only, never a save receipt. Once removed, no previous save ID is recoverable. Failed/denied clear does not poison the next explicitly admitted save queue.

Secrets remain in the secure envelope/internal Gateway. ArkUI receives safe identity/facts only; password clearing still keys off stable writeGeneration, preserving later drafts across read-only retries.

## Verification

PASS test-sync-config-durable-receipts.mjs: actual Store/Gateway/owner + SDK Page/Notice/Action, exact-ID atomic payload, lost ACK, no/wrong/legacy ID, matching later config rejection, failed query then retry, retired delivery, owner/process reconstruction, clear unknown/NOT_FOUND/undispatched, queue continuity, malformed metadata and no secret snapshot. Provider doubles model only platform IO; business classes are production source.

PASS test-sync-config-durable-sdk.mjs: whole production Store and receipt projection semantically compile against installed DevEco SDK, including actual UUID/Asset/decoder/Preferences APIs and typed fields. PASS complete actual Index→SDK Page recovery and existing Sync owner/WebDAV product/Host restore/credential queue/teardown contracts. These prove source contracts and SDK consumers; complete app ArkTS, signed HAP, install/target behavior, visual and user acceptance remain distinct and OPEN.

## Remaining protocol work

Core remote backup completion still has no durable publisher receipt/query. This is an implementation/protocol gap, not an inherent OS constraint. No new native/Core protocol was invented in this bounded config slice.
