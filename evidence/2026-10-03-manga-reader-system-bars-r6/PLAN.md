# R6 independent source preservation plan

This evidence is append-only for R6. R4 and R5 source, artifacts and evidence remain frozen. No source copy is authorized until the parent confirms the exact R6 source and test paths and hashes are frozen.

1. Use the exact R4 full source archive and R5 two-file delta as the parent chain. Verify both archives and their inventories byte-for-byte and mode-for-mode before applying the new R6 delta.
2. Compare all parent source records against the frozen independent delivery workspace. Reject changes outside the parent's final R6 allowlist and reject unexpected production or tool additions. Check Core's canonical input fingerprint and the preserved Native SDK package remain identical.
3. Copy only the explicitly frozen R6 changes to the persistent manga worktree. Preserve file modes and confirm bytes match. New source additions, if authorized, are represented as `add` operations rather than silently omitted from the parent inventory.
4. Archive R6 changes independently. Reconstruct R4 plus R5 plus R6 in a new temporary directory and verify every source file's path, type, mode, length and SHA-256 against the resulting effective inventory. Also recheck the frozen delivery files and parent archive hashes after reconstruction.
5. After the parent supplies the newly published canonical manifest, preserve its public manifest, canonical input snapshots and Native provenance without private signing material. Match every canonical input record to the reconstructed source inventory, and read back actual HAP and embedded Native bytes.
6. Keep build, device, visual and user acceptance claims separate. Source preservation alone does not establish device or visual acceptance. The final R6 evidence inventory is created only after the parent confirms VM records are complete.

Scope: this agent may write new R6 preservation records and copy approved frozen source changes. It does not change production code or tests, run builds, use VM or physical devices, stage or commit files, or rewrite R4/R5 evidence.
