# Fixed subscription plan and finite current receipt

The first complete-history candidate was not acceptable for the original 5000
source limit. Independent P4 actual SDK Store/Owner/Gateway probes measured 500
items at 278,678,291 bytes in each read/write direction; the 5000-item derivation
was 27,836,144,800 bytes in each direction and 25,005,000 historical-receipt SHA
calls. No lower source-count or byte limit is introduced to hide this regression.

## Finite domain contract

Only the existing Rules intent Store changes, with two existing AtomicFile
snapshots in Ability `filesDir`:

- `reader-rule-subscription-plan-v1.json`: one original immutable full admitted
  plan `{version,id,kind,steps,localFailures}` with the original fixed timestamp.
  The current intent binds its ID and SHA-256 damage checksum. The original raw
  bytes and per-step parameter JSON are qualified once and retained in a cache
  bound to the exact Runtime/plan ID/checksum. A cold Runtime reads and qualifies
  the complete plan once. Cached original parameter bytes guard the next fixed
  DTO; modified warm parameters cannot become a new accepted mutation.
- `reader-rules-mutation-intent-v1.json`: the current full DTO/ID/sequence/label,
  plan reference, cursor, finite applied/rejected totals and latest one qualified
  predecessor fact. Each advance updates this small snapshot only. The existing
  Core fixed Rules head and exact original query still own durable write truth.

The plan file is retained after the current intent is cleared and overwritten
only after there is no previous current/warm intent. Capacity is two files, not
5000 files, an append log, a new generic queue or another receipt ledger. All
original parsing, Source/RSS/bundle imports and Core transaction semantics remain.
Core `e1bb21327920710ee67a903b614b2debba2557fa` and schema/protocol are unchanged.

Acceptance ACK order is: complete original intent → immutable full plan → finite
current snapshot → actual Core dispatch. Each original ID/full DTO survives a
lost plan/current ACK. A successor with qualified warm original raw must actually
re-persist it; matching filesystem reads never claim durable ACK. Same-cursor
legacy/finite comparisons and next-cursor predecessor comparisons require exact
original identity/DTO, original plan and consistent finite totals/latest fact.
They permit recovery of the accepted tuple and cannot substitute a new draft.

Old complete v1 records remain until migration is qualified. Pure open/query does
not rewrite them. Their full prior fact sequence/method/binding/data/ACK digest
and finite plan shape are checked once; the actual current Core expected query
or explicit same-ID retry still gates further progress. Explicit migration first
preserves the complete v1 snapshot, then ACKs plan and finite current snapshots.
Any failed stage preserves a recoverable original, including warm same-Runtime
retry. New finite snapshots must not be read through an older Host over an
unresolved intent; do not delete the plan/intent to force downgrade.

SHA-256 reuses the actual bundled platform cryptoFramework adapter. These local
hashes detect damage; they do not authenticate historical Native ACKs. A person
who forges data and recomputes every checksum is outside this damage contract.
Only actual Core original receipt/query qualification can confirm the current
write. Historical totals/receipts do not assert that every source still equals its
earlier state after a later legitimate edit/restore.

## Executed evidence and limits

- Existing `test-rule-subscription-durable-journey.mjs`: 24 original journeys
  retained, actual whole Gateway/Owner/Atomic/Orchestrator via both emitters and
  cold SQLite. Partial outcomes, unknown, fixed timestamp, actual same-ID retry,
  pure recovery, higher head and local advance ACK loss remain covered.
- New `test-rule-subscription-intent-integrity.mjs`: 21 actual SDK/SQLite cases
  for current/latest fact/plan corruption, wrong counters/binding, immutable
  scalar plan mutation, warm/cold initial three ACK stages and legacy v1
  migration. Failure cannot publish counterfeit confirmed parts or dispatch a
  later step. Same-Runtime recovery does not require restarting the app.
- P4 independently reruns full 50/500/5000 controlled API journeys through the
  actual SDK classes, with zero database writes for the capacity probe. At 5000:
  read 9,276,770 bytes, write 17,136,087 bytes, hash 26,842,596 bytes, 20,004 SHA
  calls; one normal plan write; largest current snapshot 1857 bytes for that
  fixture. Cold cursors 0/2500/5000 each read one plan and one current snapshot,
  keep all original future DTOs and totals, and hash at most two receipts.
  Independent 12 finish/fsync ACK-loss warm/cold stage probes preserve same ID,
  pure recovery performs no mutation, and explicit continuation completes the
  original metadata. Exact final source hashes are bound by P4's separate result.

These capacity numbers are fixture-specific code/SDK evidence, not a phone RAM,
disk durability, latency or performance-budget claim. Large legitimate individual
DTOs retain their original support; no 1857-byte production cap is imposed.
Native scheduler/AtomicFile power loss, HAP provenance, target behavior, visuals
and user acceptance remain separate. This lane used no HAP, VM or device.
