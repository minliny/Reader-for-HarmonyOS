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

## Targeted regression reconciliation

Static comparison found that the message branch deliberately makes automatic progress/render recovery silent, while main's `test-reader-page-progress-runtime.mjs`, `test-reader-presentation-recovery.mjs` and `test-reader-progress-observation.mjs` still assert a newly visible inline notice. The message regression `test-reader-nonblocking-recovery.mjs` instead requires no automatic notice and preservation of any existing user-operation notice. Their local rerun and alignment must retain the same handoff, current-page preservation, pointer release, no write replay and stale ACK checks. No device inference follows from these method probes.

The first serialized targeted batch (`targeted-1792310082421.json`) executed 25 items: 22 PASS and the three statically identified old-notice assertions FAIL with `TypeError` reading `.visible` on an uncreated `readerRecoveryView`. The merged production behavior and dedicated silent-recovery regression both behaved as intended. Align those fixtures with a frozen existing user-operation notice and assert the same object survives background progress/render recovery, retaining every original ownership and stale-completion assertion. This is a presentation-contract update, not a fabricated persistence ACK or removal of recovery checks.

## Final local verification

All 30 distinct targeted checks passed at their final run: the 25-item reading/window/directory/search/SDK-cache/controller batch (the three stale notice fixtures passed after the recorded alignment), plus actual control-selection, presented-page-turn and BookTurn presentation-owner checks, delivery-admission fixtures, and the enhanced duration receipt/lifetime regression. The six-item focused rerun is `targeted-1792310160957.json`; the complete local accounting is `.reader-local/worktree-consolidation-20261018/summary.json`. Earlier failed attempts remain recorded separately. No full-suite PASS, acceptance eligibility, HAP build, Native rebuild or device result is claimed.

Two automatic merges had also replaced the main control-selection retry assertions with older Toast-only expectations and inserted an obsolete Toast fixture port into the presented-page-turn probe. Restore those main assertions/ports to match the retained inline owner implementation. Both actual production-method checks passed in the focused rerun.
