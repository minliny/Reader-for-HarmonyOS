# Reading runtime P3 / P7 / P8 exit audit

Audit inputs: integration Host `cf56c662`,
`evidence/2026-10-03-full-architecture-execution/AUDIT_GAPS.md` (A02/A10/A14/A15/A16),
and that directory's `EXECUTION_MATRIX.md`. Implementation uses the isolated
`codex/p3-tts-configuration-20261003` branch. Current app appearance and the
retained reading tree are the baseline; no target device was occupied here.

## P3 resulting producer chains

| Responsibility | Actual producer / owner | Persistent component's remaining work |
|---|---|---|
| Paragraph layout | `ReaderParagraphLayoutOwner`: forward bounded batches, reverse paragraph choice, whole original shaping context, current batch/cursor | Supplies existing native TextController/resource factory, converts actual native metrics, retains reactive measurement epoch |
| Physical pagination | `ReaderPhysicalPaginationOwner`: forward/reverse fit, paragraph gap, append/prepend state transition, immutable receipt admission, existing exact `ReadingPaginationIndex` | Supplies native line/image heights, observed chapter/title capacity, prepared transaction seam; publishes the admitted page |
| Progress producers | `ReaderProgressProducerHost`: continuous demand/drain, captured TTS/exit-visible intent, exact receipt publication | Captures current source/book/content/selection/lifecycle, provides the real gateway and publishes current facts |
| Durable progress | Existing `ReadingSessionProgressOwner` through `ReadingSessionFlowGateway`: one serial/CAS owner, latest unsent intent, unknown predecessor, content validity | UI admission only before first dispatch; no UI cancellation of dispatched durability; strong control/source-switch transaction outcome stays atomic |
| TTS configuration | `ReaderTtsConfigurationHost`: durable config write, independent metadata/activation facts, operation generation and safe credential cleanup; existing coordinator transport probe | Captures lifecycle/book/coordinator identity, projects config facts and keeps drafts |
| TTS playback | Existing `ReaderTtsSessionCoordinator` and native/router resource owners | Publishes admitted playback/follow/highlight projections; configuration failures never become playback errors |
| Lifecycle | Existing Ability `ReaderRuntimeOwner` and native/measurement/system/window lease owners; component identity guards and dispose hooks | Retains UI-owned timers, state publication, prepared/visible tree transitions and semantic close/exit orchestration |

These are live LRE consumers, including reverse pages and all three ordinary
progress producers. The classes own the actual planning/admission mutations;
they are not an unused registry beside a second component implementation.
Generic text shaping and Core CAS algorithms continue to use their existing
platform/Core implementations. Reader adds business/platform boundaries only.

LRE remains a large persistent UI orchestrator. Its native measurement adapter,
resource transfer, reactive state, exact strong transaction publication and
control/appearance composition remain substantial. This change does not claim
that the file became small, or that moving fields alone proves A02. A further
split must preserve ArkUI V1 member lowering, one page/selection outcome and
retained node identity; fragmenting those writes among independent producers
would weaken the transaction boundary. No whole-tree remount is introduced.

## P7 code/contract exits addressed here

* A reduce-motion change before the visual endpoint rolls the old turn back.
  Dispatched progress is retained; a promoted endpoint settles against the
  resident static content revision. Preference changes do not declare native
  book-turn capability failed.
* Slot frame ACKs require mounted/lifecycle/frame-generation/revision/page/slot
  identity; destroy/re-entry or a newer revision retires old scheduled ACKs.
  That ACK proves scheduling admission, not physical scanout.
* Background lease revocation is a mandatory coordinator pause/stop-audition
  event, independent of the optional interruption preference. Root owns the
  native resource and background adapter/router evidence and integration.
* Configuration operations distinguish predispatch refusal, dispatched unknown,
  confirmed durable write, metadata refresh and engine activation. Old lifecycle,
  book, coordinator or operation generation cannot activate a new session.
* Progress admission is checked after native baseline read. Once dispatched,
  an accepted exit-visible write/unknown survives UI retirement. With missing
  Core CAS, unknown results remain read-only (`CAS_REQUIRED`); an origin read
  does not authorize rewriting an old in-flight write.

## Real remaining exits

P3 requires integration with the root's concurrent runtime/audio/menu work,
complete integrated contracts and current ArkTS/HAP evidence. A historical
`cf56c662` package does not prove this branch. P7 has app-wide window, popup,
audio/background/startup paths outside this subtask; root must reconcile their
actual producer and release contracts before closing the package.

P8 is still open: actual native paragraph metrics/readiness, XComponent frame
handoff/scanout, native speech availability and native error/late-ACK behavior,
OS background task grant/revocation, Ability/window load failure and recovery
need target-bound evidence or a precise capability limitation. Controlled I/O
tests prove code decisions, not that the platform delivers/denies those events.
Performance/device-tier budgets, immutable final HAP provenance, visual baseline
and user acceptance are separate P9/P10 exits. They are not silently closed by
source or SDK-method tests.

## Validation and rollback

Each production slice has directed real-owner/LRE/SDK-probe tests and omission
controls. Progress includes actual local/remote gateway admission, retirement,
lost ACK and CAS tests; packing includes complete native forward/reverse chains,
giant paragraphs, Unicode, title/gap geometry, images, retained-prefix admission
and an omitted-append negative control. Existing fake storage adapters expose
real receipt/version fields and execute the production session owner.

Fresh final packing validation: 189 source scripts passed, 246 integration
scripts classified; 18 selected integration scripts passed. Logs are
`/private/tmp/p3-reader-packing-final-source.log` and
`/private/tmp/p3-reader-packing-final-directed.log`. The complete classified
integration suite and integrated ArkTS/HAP are root's subsequent gate, not a
result claimed by those counts.

Commits form reviewable rollback units: configuration (`9cd6362b`), motion/slot
retirement (`665f1995`), mandatory background event (`ad66d769`), initial layout
owners (`dad737bf`), unified durable progress (`172a76d8`), then forward/reverse
packing/planning ownership. Revert dependent commits in reverse order. No data
schema, reset, credential transfer, native engine replacement or visual values
were changed. Root's audio/runtime commits are separate rollback units.
