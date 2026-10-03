# Source management original recovery

Source Management and Source Tools use the original Runtime-owned Rules authority and its existing single AtomicFile journal. `source.update` and `source.delete` need `rules.mutation.source-management.v1`; ordinary document import uses the existing exact source import protocol and a finite kind-3 plan. It never fabricates subscription metadata.

The document is admitted before its first Core effect. The immutable complete plan, cursor, newest exact predecessor and bounded aggregate reuse the existing subscription IO implementation. Local invalid rows and definite Core rejection remain partial results. An unknown current ACK stops all later rows. Cold query uses the original complete DTO and ID; only an explicit continuation advances the remaining original steps. Another family cannot borrow a Source callback to execute its tuple.

Source disable/delete retain their qualified Core terminal ACK in the same complete journal before Host cookie cleanup. If local persistence or cookie cleanup fails, the Core fact remains confirmed and the original is blocked in cleanup phase. A pure query performs no Core mutation and no cookie cleanup. Explicit continuation either submits the same uncommitted ID/DTO or completes only the idempotent Host cleanup for an already committed tuple. A current empty source list never proves its old deletion ACK.

Modern single-operation journals now have the same complete-record SHA-256 guard as subscription journals. Stored terminal identity, method and actual ACK hash are checked. Legacy unchecked terminal data is ignored while its original DTO remains available for a real exact query. Corrupt records remain blocked; no new draft overwrites them.

Source Orchestrator and Source Tools expose `original?: RulesMutationSnapshot`, preserve original generation, and provide separate `continueOriginal(generation)` APIs. SourceHost admits the exact physical identity. Open/reconcile perform a pure original query before canonical list reads; independent list failure cannot erase the original confirmation. Unknown or cleanup-pending originals block replacement editor/management writes. Index and leaf continuation are separately owned migration consumers, not inferred from these APIs.

## Verification

- `test-source-management-exact-intents`: 10 groups through actual installed SDK emission, real AtomicFile/fsync adapter and fresh-per-RPC SQLite Core; before/after commit lost ACK, fixed three-row document, local partial rejection, foreign head, persisted cleanup, corrupt DTO/terminal and unchecked legacy terminal.
- `test-source-management-cold-owner`: 5 groups through full actual SourceGateway/Orchestrator/Host and SourceTools owner; cold replacement, stale physical identity, no new mutation, exact continuation, cleanup, first retained attach DTO and batch cleanup barrier.
- All 10 original Rules/subscription/Source/Tools consumer contracts pass against paired frozen Core. Preparation invalidation test also covers actual typed single/batch removal versus original direct commands, original SDK envelope preserved.

These are code/local SDK/Core evidence. New HAP, target behavior, performance, visual and user acceptance remain separately required.
