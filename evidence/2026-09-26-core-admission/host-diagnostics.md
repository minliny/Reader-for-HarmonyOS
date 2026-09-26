# Core admission rejection: Host evidence and narrow diagnostic repair

- Observed artifact: `20260926T135120Z-895e7f1e-3a008504`, Core `1c4` as recorded in the VM investigation. This document does not establish a newly deployed artifact.
- Trigger: real 青春 search across 109 sources. At 22:08:20 on 2026-09-26, subsequent search requests failed with `Reader-Core command was not admitted`; later detail and source-switch requests also failed.
- Original evidence retained: workspace `evidence/2026-09-24-epub-navigation-tree/real-books/qingchun-admission-hilog.txt` and `vm-observations.jsonl`. No device retries, reset, source edits or data removal were used for this investigation.

## Host code findings

`SearchOrchestrator.performSearch` invokes the existing worker runner with `MAX_SEARCH_CONCURRENCY = 4`; a worker awaits its source request before advancing. 109 sources are not 109 simultaneous requests. The failure is preserved as a failed source outcome, contributes to failure counts, and the search UI labels it as a failed request. Existing successful results are not recategorized as successful requests for failed sources.

The exact text originates in the Harmony NAPI send boundary for either `RC_SEND_BUSY` or `RC_SEND_RESOURCE_EXHAUSTED`. Previously `errorMessageOf` retained the message but logs did not preserve the native `code`. Consequently the original log cannot distinguish the two. `transport=none` only means no structured HTTP transport evidence; it does not attribute this failure to an external source.

Core investigation is separate: the Core agent identified missing result reservation in the mutating `book.search` path, which can trip the explicit-ack delivery contract fault for a large terminal result. Core repair and Runtime proof are owned and recorded separately; this Host change is diagnostic and does not repair that capacity path by itself.

## Change and proof

The central `requestDirect` catch now records only method and the native BUSY/RESOURCE_EXHAUSTED code, gated on the exact native admission message. Invalid method text is replaced with `unknown`. Params, source URLs, response data and error details are excluded. The original thrown object is propagated unchanged. No retry, restart, recovery state machine or capacity increase was added. There is no existing SDK public delivery-contract-fault getter; this patch does not add one.

Local commands passed:

- `node tools/test-core-admission-diagnostics.mjs`: both native codes; Error and plain NAPI envelope; unrelated/nested errors excluded; actual production requestDirect runs once, preserves thrown identity and finally cleanup, excludes private data.
- `node tools/test-error-message-conformance.mjs`: existing error behavior and 135-source-file sweep.
- `node tools/test-reader-preparation-runtime.mjs`: existing deferred preparation and invalidation behavior.
- `git diff --check`.

The new `tools/test-*.mjs` test is included by the existing full local test glob. No HAP, Native build, VM rerun or physical-device verification was performed for this Host patch. Final package and real online-route acceptance remain separate open gates.

## Unified gate follow-up

The first unified gate after this change failed in `tools/test-source-content-correction.mjs:147`: its extracted production `requestDirect` lacked the new `coreAdmissionFailureSummary` binding, masking the intended `receipt lost` rejection with a ReferenceError. Original failure retained in `/private/tmp/ph42-search-admission-workspace-acceptance.log` (around line 5890). This is a test harness dependency omission, not evidence of a product recovery failure. All requestDirect extraction sites were searched; the preparation and source-content probes now inject the real helper. Existing rejection assertions are unchanged.
