# RSS original read-only recovery

R2 closes the cold initial route projection gap and keeps Core confirmation independent from journal/Host cleanup. The existing RulesMutationOwner, its one Atomic intent, query and receipt validator remain the authority. Core protocol/schema and UI values are unchanged.

## Contract

- RSS Gateway recovery defaults to inspection whenever `retryOriginal=false`. Management open/read/reconcile, Editor read/reconcile, Source/Entry route read/reconcile and Feed read/reconcile do not apply mutations, run Host cleanup, advance subscription state or clear the intent. Explicit original continuation alone can finish it. Existing non-RSS Owner callers retain the compatible `inspectOnly=false` default.
- An exact terminal ACK may be projected as confirmed while the original stays blocked. Own RSS qualification returns historical typed data without installing it as current state. A foreign family can inspect the exact original Core envelope and preserve confirmed truth; it cannot obtain continuation permission, qualify another family's business result or clear its record. Null/higher-head and damaged records remain blocked.
- `RssRouteBinding.emitOriginal?(original|undefined)` carries the shared original separately from a source/entry receipt. Cold initial Source has no fabricated entity receipt. Four old route methods accept optional `emitOriginal` as their final argument. `loadFeed` accepts it after `expectedGeneration`.
- `reconcileSourceOriginal(expected,binding,subscriptionId)`, `reconcileEntryOriginal(expected,binding,subscriptionId,guid)` and `reconcileFeedOriginal(expected,emit,emitRead,current,emitOriginal)` query only the captured original identity. `isPresentationCurrent(identity)` checks exact shared attachment and actual Runtime; physical route/entity admission remains in the captured binding.
- Continuation must retain the complete accepted Core operation ID, sequence and original mutation DTO. Old generation, wrong family/entity, retired presentation/Runtime and damaged absence cannot borrow a new identity.

## Evidence and remaining gates

`/private/tmp/reader-rss-r2-original-recovery-20261003/RESULTS.json`: 10 directed tests PASS, production inputs stable. New cross-domain test has 14 actual production SDK/Atomic/cold SQLite groups; existing owner 17 and Gateway 32 groups remain covered. It checks foreign Source confirmed-cookie-cleanup, foreign Rules lost ACK, exact pure query, zero apply/cleanup/journal-clear, explicit original continuation, malformed hashes/terminal records, stale callbacks and Runtime retirement. An omission control executes the actual Gateway with inspection disabled and detects journal cleanup. The first old assertion failure is retained in `first-run/` and replaced with the required inspection-plus-explicit-continuation journey.

P5 owns Index and five actual UI consumers. Their integration, full strict ArkTS/HAP, native Atomic durability and target/visual/user acceptance remain separate gates; this slice does not claim them.
