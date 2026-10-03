# Reader progress producer ownership

Baseline: `dad737bf`, after TTS configuration, motion retirement and
paragraph/physical-page owners on Host `cf56c662`.

## Resulting ownership

`ReaderProgressProducerHost` owns continuous sample coalescing, the real drain
promise, uncertain target/origin classification, admitted TTS and exit-visible
intents, and ordinary presented-page receipt admission. All durable dispatches
continue through `ReadingSessionFlowGateway` and the existing
`ReadingSessionProgressOwner`. No second CAS/serial persistence engine was added.

LRE captures source/book/chapter/selection/lifecycle/content versions, layouts
and UI presentation admission. It supplies the real gateway and projects
confirmed receipts. Strong source-switch/control-selection/page-turn transactions
still keep their existing atomic UI outcome/reconciliation orchestration and use
the same session durable owner. Presentation and durable facts remain distinct.

A UI observer timeout cannot release the continuous lane. New samples update
one demand; the original real promise finishes the oldest request then the latest
sample. Retirement clears unsent demand, preserves the real promise and unknown
receipt, and makes callbacks inert. A new lifecycle joins that lane without an
overlapping writer. Disappearing ordinary pages retain the Gateway's durable
intent while their own publisher is retired.

Continuous, TTS and exit-visible intents now all dispatch through the existing
`persistPresentedProgress` CAS owner. Its optional UI admission applies before
the first dispatch and is checked again after the native baseline read. The
source/book/runtime/content validity guard is separate: once a request has been
dispatched, UI retirement cannot cancel its write or discard an uncertain result.
Local and remote gateways both forward that admission without changing defaults.

Unknown continuous results pass the durable owner's reconciliation boundary
before the producer's serialized read or another write.
A target must match book, chapter, scalar and requested content versions. The
origin must retain the exact original row receipt (updatedAt/locationRevision).
Neither a foreign row nor a matching scalar for another content version can
prove the old target. Origin reads alone cannot prove an old dispatched request
has finished. With advertised CAS, only the Core operation revision permits
safe reconciliation/retry; without CAS, dispatched unknown stays read-only with
`READING_PRESENTED_PROGRESS_CAS_REQUIRED`. The producer captures the pre-write origin and its original
source/book scope; it cannot reconcile an old uncertainty against a new book.

Confirmed target reads can publish durability for the same chapter owner without
reinstalling a displayed page. A later scalar receives its own new write. TTS
callbacks lose unsent admission/publication ownership when chapter/selection/lifecycle
retires, including a callback waiting for a baseline in the real serial lane.
Exit may flush a completed speech scalar under the existing mounted exit contract;
an accepted exit-visible write remains durable work after the UI retires.

## Local verification and boundaries

The new test runs the real Host and real session durable owner, with controlled
storage replies and a missing-receipt-check negative control. It checks admitted
TTS retirement during baseline read, exit-visible dispatched retirement with
success/lost ACK, read-confirmed CAS recovery without repeated write, and legacy
unknown read-only behavior. Actual `ReadingSessionFlowGateway` tests cover both
local and remote I/O with six added admission/retirement cases (25 scenarios total).
Existing real
LRE/SDK tests now run through the production Host: held/unknown receipts, direct
and prepared page presentation, cold-entry ready delivery, appearance reflow,
continuous exit coalescing, TTS exit flushing and strict versioned TTS gateway.
Static source contracts were retargeted to the real pagination owner; old empty
or unversioned fake receipt DTOs now use the actual protocol fields.

Fresh validation on this branch: 189 source contracts passed, 246 integration
scripts classified, and 18 selected production/SDK-probe integration scripts
passed (logs `/private/tmp/p3-reader-progress-final-source.log` and
`/private/tmp/p3-reader-progress-final-directed-v2.log`). Initial older probes
failed when they supplied no baseline/CAS revision, no owner initialization or
an empty receipt; explicit real-owner adapters and protocol receipts corrected
those fixtures. A foreign progress row must expose its changed operation
revision; otherwise the fake contradicts the CAS storage contract.

Full integrated ArkTS/HAP, native fault injection, performance and user/visual
acceptance remain independent exits. A source contract runner is verification
of declared code contracts, not proof of platform callback scheduling.

Rollback unit: progress producer Host, LRE delegation, the optional predispatch
admission in FlowGateway/session progress owner and matching tests/fixtures.
No schema, data reset, native transport or UI layout value changes are included.
