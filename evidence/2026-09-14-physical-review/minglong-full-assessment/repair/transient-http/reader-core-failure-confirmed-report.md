# Core confirmed acquisition failures

Scope: bounded contract/runtime projection change atop current main c28f0f7927f107a37ff5963637240cb0885bcc9e and concurrent authorized author work. No commit, device work, Native/HAP build, network requests, or raw cache rewrite.

Phenomenon: old scoped failed verdicts have no classified cause. Core previously supplied failureCurrent as a scope/time fact; Host treated this as evidence sufficient for a 24-hour candidate penalty, including unknown transport errors. The original reported native 2300999 remains unbound to a specific permanent source error.

Change:
- AcquisitionVerdictV2 has an optional failureCategory, omitted when absent. Missing categories remain accepted for older clients.
- Read projection preserves failureCurrent scope/version/ordering semantics and adds failureConfirmed. Only current SOURCE_RULE_FAILED, SOURCE_RESPONSE_FORMAT, SOURCE_TOC_EMPTY and SOURCE_CONTENT_EMPTY are confirmed.
- Historical absent, HTTP, NETWORK_ENVIRONMENT and unknown string categories remain unconfirmed. Reading does not modify persisted facts or manufacture a category.
- New patches accept only the existing 13 RemoteReadingFailureCategory names. Unknown values and failure causes attached to readable verdicts are rejected. Existing unknown stored JSON is read conservatively without revalidation as new input.
- Reader command schema had an existing v1-only acquisition definition despite runtime v2. The definition now selects legacy v1 or v2; v2 includes existing scoped fields and the optional category. No wire error-code enum or database schema change was made for this failure task.

Storage review:
- scoped_search.rs relation SQL orders by origin/book_url/alias; related paging uses the resulting identity order. No failed/category/checkedAt weighting exists. No storage/author implementation was changed for this task.

Local validation:
- reader-contract acquisition_verdict_contract: 1 passed (optional omission, explicit category round trip, numeric category rejection).
- reader-runtime acquisition failure-specific regressions: 2 passed (old/raw preservation, four confirmed causes, HTTP/environment/future unknown unconfirmed, obsolete source unconfirmed, new input admission, stable related ordering).
- reader-runtime entire remote::acquisition::tests module: 11 passed, including existing catalog/version/body freshness and the content agent's full-source author integration regression.
- JSON Schema Draft 2020-12 schema check and 9 directed valid/invalid cases passed using the existing Python jsonschema package.
- Owned-hunk git diff --check passed.

Evidence:
- /private/tmp/reader-failure-category-contract-tests.log
- /private/tmp/reader-failure-confirmed-runtime-tests.log
- /private/tmp/reader-acquisition-projection-regression.log
- /private/tmp/reader-failure-category-schema-tests.json

Remaining integration boundary: Host must consume failureConfirmed for candidate penalties and attach classified causes only to new confirmed detail/catalog failures. Parent owns this work. No VM, device or user acceptance claim.
