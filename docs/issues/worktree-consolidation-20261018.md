# HarmonyOS worktree consolidation — 2026-10-18

The main, message-framework and runtime-reservation source/index snapshots and branch bundles were retained under the workspace private `.reader-retained/worktree-consolidation-20261018/` before integration. Source commits and targeted local checks do not establish HAP, VM, physical-device or user acceptance. This task runs no complete suite, build or device operation.

## Merge validation findings

- During the message merge, the first delivery-admission fixture run rejected the existing VM thrown permission form `/proc/sys/kernel/random/boot_id: Permission denied`. The merged parser had incorrectly applied the physical shell's stricter `cat:` grammar to that VM-only error path. Preserve exact path-bounded bare-path errors for VM while retaining the physical strict grammar. No arbitrary permission text or unrelated procfs path is admitted. The corrected delivery-admission rerun passed; log: `.reader-local/worktree-consolidation-20261018/delivery-admission-r2.log`.
- Both independently checked readiness fallbacks remain: physical boot milestones and current-instance VM startup fingerprint. Both Native recovery/lease child ownership assertions and the message branch's late-admission generation cancellation assertions remain.

## Runtime reconciliation

- Keep the main progress journal, TTS capture, immediate exit, inline owner-scoped recovery and subsequent bookmark/window/directory repairs. The older branch's sequential exit and repeated Toast assertions are superseded by those actual main behaviors, while its new duration lifetime/size/diagnostic assertions are retained.
- Git's structural merge inserted a second `getReadingRecordGateway` and a second full outbox method block without marking those insertions as conflicting. The duplicate blocks were identified in the source diff and removed before validation. The duration Gateway is the branch's strict enhancement of the shared main implementation; original sequence/receipt/assigned-intent safeguards remain.
- Vendored `reader_core.ts` from the runtime merge is byte-identical to the newly integrated Core canonical SDK (44020 bytes, SHA256 `347d194aa48201f7104cb794b1a233f512e47ece68d68fd14a656cdecda466b6`); no Native build/sync or packaging was performed.
- `test-reader-reading-record-receipt.mjs` passed with the merged main exit and the added UTF8/1MiB, late-retirement successor, repeated-object, exact receipt and finite-diagnostic cases. Log: `.reader-local/worktree-consolidation-20261018/reading-record-r1.log`.
