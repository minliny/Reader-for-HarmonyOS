# Backup retention explicit exit

Input Core f9982eee, Host 11ae0e3c. This closes the cold publisher whose upload
can be qualified but original retention workflow cannot resume. The existing
unknown guard remains until exact upload proof plus explicit user termination.
No visual token/geometry, hidden Sync entry policy, global bus, new encryption,
cache algorithm, SQLite schema or ABI/protocol version changes.

## Actual states and action

- Unknown: no terminal action; original-path GET may qualify upload only.
- Qualified upload / cleanup unconfirmed: public `ReaderRecoveryAction` offers
  `保留备份，结束清理`; generation/owner/session/route and exact operation ID admit it.
- Explicit terminal: durable `retentionSkipped=true`, `completed=false`. UI says
  the backup was kept and cleanup ended; previously dispatched remote requests
  will not be withdrawn. It does not add a successful backup history entry.
- Actual completion remains `retentionCompleted=true`, `retentionSkipped=false`.
- Failed local terminal persistence or lost ACK: retain journal and blocking
  partial fact; only exact local receipt query can resolve it. Do not infer local
  terminal receipt from GET or clear the journal automatically.

Core accepts `sync.webdav.backup.retention.skip {transactionId,response?}`.
It verifies existing durable upload ACK or exact original URL/ciphertext GET,
then CAS-writes the existing 2-unsettled/8-settled ledger and retires only the
exact pending publisher. Native restart, cache clear and configuration restore
preserve local authority; export/backup cannot transfer it. No PUT/DELETE is sent.
Gateway rechecks real secure envelope/origin and caller admission after each
await; a prior UI qualified flag is not sufficient if current GET is absent.

The actual V1 retained child proof first exposed an unsafe reuse: a retired
Action's native callback reads its updated generation from the actor. The
consent action now keys only that small shared actor by exact operation ID plus
receipt generation, and obtains its generation from the immutable ForEach item,
not current snapshot state. Even replaying a retired SDK observer cannot promote
its old token. Actual decorated Action updateStateVars keeps ordinary callbacks
construction-bound, updates enabled Props, and rejects the old physical handler;
only one successor action is admitted, with the existing Page retained.

Index is exclusively integrated by P5 with the existing captured Runtime,
route/navigation and product guard. Leaf candidate does not edit Index.

## Evidence boundary

`test-sync-backup-retention-exit.mjs` executes actual file Preferences/journal,
Gateway, owner, SDK-generated Page/shared action callbacks and complete decorated
Page. Typed Core results there are not Rust IO evidence. Separate real Core
SQLite/hash/Runtime tests cover exact GET negatives, consent separation, failed
local SQL mutation, cold terminal receipt, stale continuation and fixed capacity.
Original Sync config/owner/WebDAV regressions are required. Native rebuild,
HAP/signature, installed target, visual and user acceptance remain integrator
exits; this lane does not occupy HDC/HAP.

Local result: 7 actual Core publisher tests (including failed SQLite UPDATE
trigger, cold query/cache/restore and late continuation) PASS; original 8 WebDAV
product tests PASS; full reader-contract tests PASS; scoped runtime strict clippy
PASS. Host exit/owner/backups/config/SDK semantic/family gates PASS. SDK values
and source consumer private budgets unchanged. P5 Index integration, final paired
Native/HAP and target evidence remain separate.
