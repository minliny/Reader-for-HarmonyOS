# R8 fixed session helper revision

The earlier frozen `sdk-runtime-review/REVIEW.md` binds helper SHA `5f4b676c6bd0b5da67a1011b2f27b7c486a1532bf37428cc19b11f4e801432f2`. Its exact historical bytes are preserved here as `numeric-vm-session-reviewed-v2.mjs`; they were recovered by reverting only `aSettled` and `normalReader` in the current fixed label list and verified against that pre-existing complete SHA. This is an explicitly recorded reconstruction, not a new runtime execution or a rewrite of the frozen review.

Current helper SHA `c59bcf322320b33847cbd17a66285dc47c686599c416b83293a828655bf402d2` has those two additional fixed UI-tree labels. Every other byte is identical. The labels permit separate, same-session-created tree receipts for settled A and the ordinary cold-launch reader with loaded Image nodes. The remote nonce, lease, time bound and command allowlist are unchanged; no arbitrary source/cache/pixel/read interface was added.

The actual R8 runtime sampled A/B/D, shelf exit and ordinary default-off loaded reader. The early A observation remains `vm/a.json`; settled A is a separate `vm/aSettled.json`. Directory C was not sampled in R8 and no directory acceptance is claimed from this stage. Neither helper was run for this historical preservation step.
