# Bookshelf settings actual recovery consumer — 2026-10-03

## Production change

`Index.bookshelfSettingsContent` supplies the actual captured SettingsHost, Runtime, navigation, mounting and `bookshelfSettings` route. The previous inline branch referenced undeclared generation/owner/mounting/host and supplied cache callbacks that this page does not define; the new finite builder removes these actual wiring faults. The general Settings owner and durable file writer are unchanged.

`BookshelfSettingsPage` consumes the existing `SettingsOperationProjection`. `onReconcile` stays read-only. `canRetryAccepted` produces the explicit **重试保存当前设置** action, which calls `SettingsHost.retryAccepted` for the same accepted generation. The original auto-update choice remains visible after an unconfirmed flush; no old-choice compensation is added. The common notice and 36px action keep their established specs. The action appears only in the necessary failure state and is recorded for later visual fine tuning.

The page exposes the actual navigation Prop; only the small recovery actors are keyed by navigation, appearance revision and operation generation. Their closures capture that immutable key. A retained V1 ordinary callback cannot borrow the new generation, and native disablement is backed by the original owner/current guards. No settings page, bookshelf page, cover or persistent reader tree is remounted for this recovery.

## Proof

- `test-general-settings-write-confirmation.mjs`: all **13 original** IO/unknown/retry/queue cases are preserved. Only its unchanged compiler/fixture was extracted to `lib/general-settings-persistence-probe.mjs` for reuse; this test does not become a second settings implementation.
- `test-bookshelf-settings-operation-sdk.mjs`: three actual native Preferences → actual Gateway/Orchestrator/Host → actual Index builder → SDK-emitted decorated page → actual shared Notice/Action groups pass. They include before/after flush lost ACK, accepted current choice, read-only recovery with zero extra write, one explicit same-generation full four-flag write, old physical callback rejection after V1 Prop delivery, teardown/remount and retired Runtime.
- Existing bookshelf settings layout and view-mode receipt matrices remain required and pass with the new actual builder methods selected.

The SDK probe executes installed SDK transforms and actual production consumers. It does not simulate native branch destruction, layout pixels or device performance. Terminal state is delivered by replaying the real parent observer and actual V1 Props; no branch-removal claim is inferred from that probe.

Status: code + targeted local/SDK-emitted contracts proven in this candidate. Full canonical gates, full ArkTS/HAP, artifact, target, visual and user acceptance are separate root exits.
