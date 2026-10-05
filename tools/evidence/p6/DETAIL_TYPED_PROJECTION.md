# Exact cached detail projection — P2/P6 slice

## Located defect and change

Baseline d1274e57 kept the visible detail on exceptions but decoded a raw `search-book.get` row inside Index without checking its source/book tuple. A wrong row could replace metadata and advertise another row's acquisition facts. Its navigation predicate also omitted the captured Runtime, and the coalesced retry could reacquire an owner after retirement.

`BookAcquisitionProjectionGateway` now owns the read-only protocol boundary. It requires exact origin + bookUrl, validates present metadata/boolean/version/timestamp fields, and returns a typed projection. Absent, legacy identity-less, malformed or other-book data preserves the admitted detail. Missing optional evidence cannot certify readability. This is Reader protocol adaptation; no generic parser/algorithm is reimplemented and the existing Core/acquisition/ArkUI implementations are reused.

Index retains route/session/presentation decisions. The read captures its Runtime once, combines exact Runtime, navigation, remote session and entity identity, and only coalesces another read while that identity is current. A surviving old request does not resolve a new Runtime in its finally. Existing schema-2 + source/catalog/context exact readable evidence rules remain.

## Verification

PASS `test-detail-acquisition-return-stability.mjs`: real production Gateway + Coordinator + Index, actual SDK Index payload and LocalBookDetail hero nodes. Includes all previous stable return/catalog/processing/source races plus 10 absent/malformed/wrong/partial tuples, valid title/author propagation, Runtime unset/replacement, navigation/entity/session changes, deferred replies and coalesced retirement. Wrong/absent replies preserve the exact admitted book/session; no body/network mutation is invented.

PASS `test-search-candidate-acquisition.mjs`, `test-remote-reading-evidence.mjs`, `test-search-trial-reading-return.mjs` with real production boundaries.

Initial local probe issues were test/runtime setup, corrected before PASS: Node strip-only rejected a constructor parameter property (changed to normal class field); new SDK probe needed real custom-component metadata and native constructor owner field; deferred new-navigation synthetic retry exposed a real overbroad finally admission and was fixed to the original full current predicate. No assertion was removed to pass.

The SDK proof covers emitted component payload/attributes, not native layout/focus/target behavior. HAP, target, visual and user acceptance were not run by this lane. Catalog updater, shelf read/refresh and settings cache ownership remain separate OPEN slices.

## Coalesced intent correction

Independent review found that suppressing a stale request's rerun also lost a separately issued, still-current B intent when A remained in flight. Corrected with finite active/pending leases: every actual call captures its own Runtime/navigation/session/exact book before queuing. Only the active lease releases busy state; it drains the latest pending lease only if that lease remains current. The drain passes the captured lease and does not call current() again. There is no global request owner.

PASS actual production + SDK metadata chain A→B and Runtime replacement with old success/failure, a separately deferred B reply proving A finally does not clear B's active loading, plus pending navigation/entity/Runtime retirement. Both previous test files remain PASS. This correction supersedes the earlier current-only coalesced finally.
