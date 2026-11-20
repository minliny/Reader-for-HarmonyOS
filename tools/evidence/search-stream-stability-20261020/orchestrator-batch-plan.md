# Search publication batching - 2026-10-20

User-authorized scope: avoid rapid list flashing while retaining search results,
source warmup, stop, retry, and exact identity guards. Source owner for this task
is `SearchOrchestrator.ets`; baseline HEAD is `6b1bd7534b61a8ebfac10150fd308eae8430606e`.

## Code finding and implementation

`refreshSharedBooks` publishes each completed metadata refresh immediately,
while network results already share `SearchQueryRun.timer` (100 ms interval,
200 ms maximum budget). This permits extra UI publications between network
batches. A cache refresh can change relation grouping, representative metadata,
and row geometry even without another network result.

Stage accepted metadata changes on the current run with their captured object
identity. Reuse the same run timer for metadata-only flushes, including after
the sweep settles. At the existing publication boundary merge network rows and
metadata changes, compute one delta against the last published index, and
avoid the unchanged-raw-input fast path while staged changes exist. No new
timer or search engine is introduced. First results, stop and source settlement
still flush immediately. A stopped run remains stopped during later metadata
publications. Keep source-version/request/captured checks and retire stale
session, work, query and result-generation callbacks.

## Selected verification, before execution

Only `node tools/evidence/search-stream-stability-20261020/orchestrator-batch-probe.mjs`.
The probe reads and type-strips the actual production orchestrator and shared
operation fact projection. It uses an isolated VM, deterministic gateway
responses and virtual timers; it does not import historical suites, load SDK
tooling, execute Core/network IO, build, sign, or touch a device.

Necessary risks checked: immediate first result; shared network/warmup timer;
same raw-array reference with new metadata; coalescing after completion;
immediate stop/settlement; stale query/close/work/captured/source-version
rejection; removals and relation-discovered rows; retry and latest counters.
A negative control executes the former source and must detect immediate
metadata publication. Source parse and patch whitespace inspection apply only
to this file and this local probe. Full and unrelated gates remain NOT_RUN.

These are production-method scheduling/data tests, not ArkUI pixel, gesture,
device, or user acceptance evidence.

## Preparation failures retained

- First probe run failed before source evaluation: this Node 26 runtime accepts
  only `stripTypeScriptTypes` strip mode, not transform mode. Changed the probe
  to its supported default stripping mode; this is not a production-source
  pass/failure and does not justify any additional suite.

## Local result

- Former production source negative control reproduced immediate metadata
  publication before the scheduled network batch.
- Updated production ordinary methods passed the selected single probe,
  including same-array fast-path, current counters, coalescing after completion,
  immediate stop/settlement/retry with prepared metadata, pending timer retirement,
  old query/work/result-generation rejection, captured-object reread,
  source-version replacement, confirmed removal/new relation membership, and the
  existing `refreshBooks` fallback.
- `git diff --check -- entry/src/main/ets/features/search/SearchOrchestrator.ets`
  produced no whitespace diagnostics. Node source stripping/VM evaluation passed
  as part of the same probe. The runtime emits its existing experimental API
  warning for `stripTypeScriptTypes`; this is not an assertion failure.
- Results and exact source/negative-control SHA256 are in
  `orchestrator-batch-result.json`. This proves the tested data/publication
  boundaries only. Native row flicker, scroll, touch targeting, build and device
  acceptance remain separate and were not executed in this lane.
