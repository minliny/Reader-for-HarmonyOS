# Bookshelf read/recovery and catalog feedback boundary — 2026-10-03

This is an additive implementation slice on the existing Host and retained Shell.
The healthy bookshelf layout, membership identities, visible-book anchor, current
blank-loading/failed content and existing persisted-write recovery retain their
contracts. No deployment, device use, Core protocol or font specification changes.

## Production chain and ownership

`Index` captures its mounted Runtime, navigation/route, filter and monotonic read
identity. The existing `BookshelfHost.readShelf` owns a finite read/recovery flow;
`BookshelfReadOwner` supplies loading/refreshing/failed/retained facts and the one
existing blank-first-read automatic retry. The `BookshelfFlowGateway` and real
`ReaderCoreGateway` carry the same admission predicate into every first-page or
continue-reading Core request. The final SDK Shell consumes `readRecovery` using
the existing shared `ReaderRecoveryNotice` and physical readonly action. Persisted
write/catalog recovery keeps precedence and separate callback tokens.

A retained refresh failure keeps the actual books, selection/anchor and Page
Props. A valid empty refresh keeps the established hysteresis, but exposes both
its empty read and retained content as a partial fact. Filtered zero matches with
a nonempty global count do not claim an empty bookshelf. Malformed payloads do
not replace known rows. A manual retry queries only, cannot replay an import,
removal or catalog refresh, and rejects duplicate/old physical callbacks.

Read, Runtime, navigation, route and unmount identities are checked before queued
IO admission and publication. Blank automatic retry cannot reacquire another
Runtime. A projection callback failure is recorded separately from the known Core
read and cannot cause an automatic second read. A partial visible feedback (or
the existing blank failed content) offers an explicit readonly retry.

## Catalog corrections carried with this slice

Final catalog projection and its retry go through `BookshelfHost` and pass the
exact captured predicate into `Flow.load`. Progress publication failures cannot
abort accepted catalog work or erase its succeeded/failed/preparation counts.
Readback diagnostics cannot throw away those results. The manual catch separates
actual target-read failure (no check started) from execution/feedback failure;
the latter retains the latest known counts and never says a dispatched sweep did
not start.

## Verification

- `test-bookshelf-read-owner-closure.mjs`: actual CoreGateway → Flow → actual
  existing Host → Index → SDK Page/Shell/shared Notice/36vp physical recovery.
  Covers blank retry, terminal failed retry, retained failure, malformed/empty and
  filtered payloads, six retirement axes × delayed success/failure, unavailable
  Runtime before automatic retry, queued cancellation and projection failure.
- `test-bookshelf-manual-update.mjs`: all 26 cases pass, including real
  Coordinator/acquisition IO and Host; three new cases distinguish target-read,
  progress publication and executed/diagnostic failure. Catalog writes are never
  repeated by readonly final-projection recovery.
- Shared scan, Host wiring, bookshelf write/import real SDK consumers, paged
  projection, retained Shell states, window-chrome P0, private Typography and
  contract-test-tier checks pass.

These are source/local and actual SDK-transpilation/consumer probes. A complete
ArkTS/HAP build, platform scheduling, physical compositor/layout, device behavior,
visual and user acceptance are separate exits and were not run by this lane.
