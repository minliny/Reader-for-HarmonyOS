# Candidate policy local verification - 2026-10-21

Scope is the user-authorized continuation recorded in
`docs/issues/floating-controls-pages-20261020.md`. This lane does not change
production source. Root owns the Coordinator policy change and another lane
owns ArkUI/SDK scenarios.

## Exact entries, nesting and necessity

1. `node tools/evidence/search-selection-stability-20261020/candidate-policy-probe.mjs`
   reads the actual Coordinator source and the exact pre-change HEAD snapshot,
   strips types and evaluates their unchanged method bodies in an isolated VM.
   It executes actual acquireCandidateGroup/canTryAnotherCandidate/
   assertCandidateCurrent/waitForCandidate/acquireBookWithBackgroundRefresh.
   Only acquireBook and verifyCandidateBody are controlled business effect
   ports; author identity and failure taxonomy dependencies use actual pure TS
   modules. Virtual time is an explicit scheduling port. No SDK, suite, Core
   request, network, build, signing, installation, or device child is loaded.
   Needed because this change alters foreground source identity and the moment
   that provisional catalogs become visible.
2. Exact audited IDs `H-search-candidate-acquisition#fatal-fallback`,
   `#environment`, `#deadline`, `#unknown-author` via gate-index --run --change.
   Actual selected cases import Coordinator/Gateway and controlled Core DTO
   boundaries; deadline also installs controlled-timers and Date.now. The
   Index/visible-range SDK owners are lazy imports and are not selected here.
   These protect cancellation/identity/version/storage refusal, environment
   errors, whole-selection deadline and author substitution respectively.
   No sibling case, candidate-budget, Index SDK, full suite or build runs.

Read-only preparation referenced one nonexistent historical fixture filename.
No check was executed through that path; the selected cases define their own
controlled Core fixture directly in the current test file.

## Required local scenarios

Primary success wins even with a prior failed flag and a ready fallback;
only an allowed actual failure opens fallback. An unverified/failed fallback
catalog does not publish; all body failures retain only the primary catalog.
Background retains readiness ordering, failed skip, three-unverified budget
and exact identity deduplication. Catalog-only calls do not verify bodies.
Cancellation in either callback and late verification cannot admit another
identity. Negative controls execute former production code and must fail the
primary-priority and premature-fallback-publication assertions.

Method evidence is separate from native detail UI, retained device data and
user acceptance. Only the specifically selected gateway tests prove their
controlled request/contract boundaries.

## Executed result

The independent production-method probe passed on its first execution, with
two negative controls rejecting former production primary ordering and early
fallback publication. It exercised all selected local scenarios; exact source
and former-source SHA256 and fifteen receipts are in candidate-policy-result.json.

All four exact audited gate IDs passed individually: fatal-fallback,
environment, deadline, unknown-author. Wrapper receipts, exit codes and log
locations are retained in candidate-gate-results.json. The wrapper's classified
integration count is an inventory count, not additional tests executed.

No assertion/check failure occurred in this lane. The read-only missing legacy
fixture path above is a preparation lookup miss. Node emitted its existing
stripTypeScriptTypes experimental warning; it did not fail execution. No old
test definition or production source was edited by this lane, and candidate-
budget or any brother case was not run.
