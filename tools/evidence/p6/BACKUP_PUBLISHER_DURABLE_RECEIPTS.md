# Backup publication recovery

Host base: `df14ecea9ed230a73b6f5dd54eb9ba4f270104ac`; isolated lane
`p6-backup-publisher-20261003/Reader-for-HarmonyOS`. Paired Core lane first carries
P3's four dedicated read-record modules (`4e119089`, same files as `eaca3dea`),
then the shared durable protocol/backup implementation `8521669a`.

## Production behavior

- One platform UUID is journaled and flushed before backup start. Core receives
  that exact identity; a lost start ACK cannot leave an unidentifiable publisher.
- The journal retains the atomic secure-envelope save identity and moves from
  prepared to mayDispatch before the real first mutable HTTP dispatch. It stores
  neither credentials, Authorization nor encrypted payload bytes.
- The real dispatch counter, not an exception message, qualifies undispatched
  cleanup. Unknown IO blocks another backup, restore or config replacement.
- Cold Store/runtime/owner loads the same journal and exact Core receipt. Page
  opening only reads. The actual shared native recovery action may execute only
  the Core-provided original HTTPS GET after original configuration/origin
  checks; it never replays PUT/DELETE/start or asks for a new latest backup.
- Exact ciphertext GET qualification confirms upload only. Incomplete retention
  remains visibly partial and blocks mutation. A later absent GET cannot erase
  the owner’s already observed positive upload fact; it also cannot qualify an
  unknown upload. Only the real durable Core completion receipt closes retention.
- Runtime/route retirement suppresses late UI publication without erasing an
  already accepted durable receipt. An independent read can restore that fact.
- Current UI layout, styles, shared Notice/Action structure, hidden Sync entry
  policy, restore conflict consent and secure Asset envelope remain unchanged.

## Verification performed

`test-sync-backup-durable-receipts.mjs` uses actual file-backed Preferences IO,
production Store/Gateway/owner methods and installed SDK transformed Page plus
the shared native Notice/Action handler. It covers cold journal identity, pure
GET recovery, upload-versus-retention, new-origin/new-envelope rejection,
monotone observed ACK, mutation admission, two genuine pre-dispatch flush
failures followed by a new explicit intent, and Runtime absence/late ACK.

The Host test injects typed Core result DTOs; it does not reproduce Core hash or
publisher behavior. Separate actual Core file-SQLite/cold-RemoteState tests prove
exact generated encrypted body SHA/length/origin/path, negative controls, cache
clear/config restore/import authority, lost upload/final/retention ACK separation
and 2 unsettled/8 settled bounded admission.

Also passed: existing exact config receipt tests, full installed SDK Store and
projection semantic compilation, actual Sync owner→Index→SDK Page recovery,
legacy Host configuration/restore recovery, queue/migration regression and the
product WebDAV contract test. Test-tier registration remains explicit.

Complete Native rebuild, protocol/source `.so` identity pairing, full app ArkTS,
signed HAP and VM/device acceptance are the integrator's remaining evidence.
These local/SDK results do not claim those exits.
