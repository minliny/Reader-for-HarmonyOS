# Original consumer regressions after owner migration

Frozen Host cd18dca1 / Core e5518d77 / UI 2c3e4e4 full capture ran 543 tests:
535 passed, eight failed, with stable before/after source inventories. Raw
results remain unchanged. This patch repairs seven original consumer fixtures;
the eighth is the unchanged directory server test, blocked by sandbox loopback
EPERM and subsequently passed with the authorized local-listen permission.

- Legado's aggregate catalog contract follows BookshelfHost.catalog and the
  actual bounded CatalogOwner sweep, attempted counts and shared exclusion. It
  also executes the existing complete manual catalog consumer regression.
- Make and motion selection probes select the actual selectionActorIdentity
  method and preserve stale-menu, invalid-value, finite geometry and motion
  assertions. Conversion identity is checked as the third callback argument.
- The content-search regression replaces its obsolete putMode-only substitute
  with complete installed-SDK conversion Gateway/RulesOwner/AtomicFile/cold
  SQLite. Actual native dispatch is paused before ACK for the original success,
  failure, stale-generation and unmount cases. Unknown keeps search results;
  qualified ACK invalidates them. Original late page and retained query tests
  remain. No conversion state machine is copied into the test.
- RSS retained-page tests select actual defined zero-IO retirement methods after
  navigation changes, retaining old physical callback and late ACK assertions.
- Rule entity structure follows the original typed Source per-item, RSS snapshot
  and rule-bundle steps, with one fixed original timestamp. Portable bundle
  validation/serialization remains Core-owned.
- Reading invalidation includes the newly registered typed source.import method:
  its original direct source mutation invalidates preparation and acquisition,
  while RSS and subscription metadata do not. Typed envelopes stay unchanged.

Seven directed tests passed with these changes. This is test-only migration,
not a rewritten full-capture result or application/target acceptance. Final
source changes require the canonical complete gate.
