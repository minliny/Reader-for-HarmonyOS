# Sync durable receipt and recovery slice

Baseline: Host d6adb883 plus shared configuration-store dispatch/ACK commit 80af9e65 (local cherry 208a1844). Isolated worktree p6-sync-complete-20261003. Current UI sizes/font tuples, field structure, foreground-only admission and hidden product entry remain unchanged.

## Actual architecture

- AssetStore save/clear marks ReaderWriteEvidence at the actual platform call, after the serialized queue rechecks route and runtime admission. loadSerialized is a read-only queue boundary.
- SyncGateway owns secure secret reuse, Core WebDAV transactions and actual remote/apply ACK boundaries. It admits no new mutation while a restore journal exists. Accepted remote/apply work can finish after route close; an obsolete runtime cannot start Host restore work or publish into its successor.
- SyncOrchestrator retains the accepted operation and its receipt across remounts, uses a single task chain, and independently projects configuration read and committed mutation read-back. Failure retains the last valid configuration. An initial read failure has a mounted recovery surface.
- Lost save ACK initially retains unknown confirmation; the follow-up config receipt slice can confirm only the exact operation ID committed in the same Asset envelope. A matching-field read alone remains insufficient. Lost backup completion ACK still retains unknown confirmation after a matching read. New mutation intent cannot silently overwrite the unknown receipt. Recovery does not resend a config save, backup upload, latest restore selection, or overwrite consent.
- Core restore receipt is stronger evidence: atomic runtime.storage.apply is queried through the existing operation/checksum journal. Missing receipt proves no config application; present receipt permits idempotent continuation of Host choices and commit. Partial Core-applied/Host-unfinished facts remain visible, and Core apply is never replayed.
- SyncPage consumes shared ReaderRecoveryNotice/Action via the actual snapshot, with busy/unknown admission. A stable writeGeneration clears password drafts only for a newly acknowledged save; read-back refreshes retain later drafts. Prop @Watch and all five existing input tuples are preserved.

## Validation

PASS actual complete AssetStore -> Gateway -> owner execution plus installed SDK transform/emitted page/Notice/Action callbacks. Covers initial and retained read failure, confirmed save + failed refresh, read-only double retry, lost Asset ACK, undispatched validation, backup complete/lost completion/partial remote responses, restore conflict/explicit cancel/overwrite, lost apply/commit ACK, Host partial failure, durable receipt recovery, close/re-entry, stale token, queued pre-dispatch close, runtime retirement, and password/non-secret draft boundaries. Complete SyncPage decorated fields/Props/@Watch and all methods are SDK-transformed, not a handwritten page fixture.

PASS pre-existing sync WebDAV product boundary, WebDAV Host restore recovery, credential queue and private Typography budget. The old extracted Host-recovery probes explicitly stub only the newly introduced owner/admission guards; the complete production-owner test exercises those guards without stubs. Existing sizes, AUTO and role imports remain intact.

Index owns product admission and page integration in the separate P5 writer lane. Its binding must provide current ReaderRuntimeOwner, ownedBy replacement, route/product guard and generation callback. The subsequent P5 1971ffda binding and actual Index/complete SDK Page/shared native recovery test now pass on this candidate; source/SDK integration is proved, with artifact and target tiers still open.

## Current implementation and protocol boundaries

The original config implementation lacked a durable operation ID; that was a Reader implementation gap, not an OS impossibility. CONFIG_SAVE_DURABLE_RECEIPT.md records its repair: SDK UUID is committed atomically with the configuration in the existing secure envelope, enabling exact-ID read-only qualification and rehydrating actual committed IDs after process/runtime replacement. Old envelopes remain readable without fabricated historic receipts.

Core currently supplies a durable apply receipt for restore, but no durable remote-backup completion query. That is an open protocol implementation gap requiring a formal publisher-receipt design; it is not labeled an inherent platform limitation. Such backup unknown states stay pending, block replacement mutations and do not auto-upload again. An uncommitted save intent lost with the process has no persisted intent record; startup projects the real current secure record and does not pretend it recovered that missing intent. No network, HAP, VM, device, pixel or user-acceptance evidence is supplied by local probes. Sync remains product-hidden; no automatic/background backup capability is opened.
