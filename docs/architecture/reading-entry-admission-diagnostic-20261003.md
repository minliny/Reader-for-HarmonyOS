# A54 reading admission diagnostic carrier

Located in the full audit: migration of Index acquisition orchestration to ReadingEntryHost removed the original `PERF search-detail-admission` and failure log, although the performance gate still expected it. Source `886963cc^` shows the original timer before actual detail admission and success log after current acquired session, plus failure log after current failure. This was a production diagnostic gap, not evidence that timing meets a budget.

ReadingEntryHost now captures real Date.now immediately before actual remote acquisition and records the original key/source/book/mode/duration on current success, or failure key on current failure. The bounded owner scope is appended. Scope/lease/current Runtime guard rejects retired completion; diagnostic exceptions cannot change acquired session/catalog/body truth. Resume without detail admission produces no manufactured timing. No UI, acquisition algorithm, task scheduler or device budget changes.

`test-reading-entry-admission-diagnostic.mjs` uses the installed SDK emitter for the complete actual Host and existing actual coordinator fixture. Current success/failure, retired scope and throwing logger pass. The complete original ReadingEntry host test also passes. Native logging and target elapsed percentiles remain OPEN and must use current source/artifact/target bindings.
