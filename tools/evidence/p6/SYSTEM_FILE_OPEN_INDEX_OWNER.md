# System file opening: actual Index consumer closure

Source baseline: readable admission `0a2b8ef3` plus navigation leaf `cd9db4a6`, information projection `88a4915a`, exact exit ticket `56b8ce87`. This slice only integrates the navigation leaf and its real reader exit consumers; source selection/RSS delegation is a following slice.

## Production ownership

`ReaderSystemFileOpenNavigationHost` owns queue admission, checking/checked identity, saved-file notice identity, applying exclusion, request-exit ticket and subscription lifecycle. Index no longer has the seven independent owner fields or the asynchronous queue/query implementation.

Index provides an exact Runtime/mount lease, current foreground/route/book/reader-identity DTO, the existing source-switch transaction query, current notification surface and existing navigation intent. The saved import and progress belong to the original queue/Core owners; this adapter never reimports or changes the saved progress.

ReaderShell forwards its existing immutable `[sourceId,bookId,readingReadyGeneration]` ForEach identity to Index for exit and cancellation. Index rejects retired Runtime/mount and mismatched tuples before changing navigation intent. The navigation Host further binds settlement to the same queued result id and requested reader entry. Same-book reopening therefore cannot borrow an earlier physical exit/cancel callback.

Directory backfill had used the removed unrelated `systemFileOpenMounted` flag. It now uses the existing Index retirement flag alongside the original exact Runtime/nav/reader/book guards.

## Verification

- Actual bounded queue → actual navigation Host → SDK-parsed Index methods → SDK-emitted exact shipped ReaderShell callback payload → SDK-emitted actual retained ReaderShell/ReadingExperience ForEach.
- Foreground deferral; local saved progress unchanged; exit registration, serialized exit and cancellation; queued remote transaction check; exact mutable and replaced book/navigation/Runtime; Runtime unavailable, disappeared and reappeared Index; same-book new reader generation; stale physical and directly delivered old tuple callbacks; source-switch deferral; notification throw; open intent throw followed by safe retry; Index reconstruction.
- Existing real Info exit chain still exercises Panel → LocalReadingExperience → ReaderShell → Index, serialized stop/record/progress, save failure/retry and layered Back. Search trial return, retained reader errors, directory after-frame backfill and TTS exit ownership remain covered.
- SDK extraction proves emitted callback/identity contracts, not native scheduling or compositor layout. No full HAP, device, visual or user acceptance is claimed here.

Tests: `test-system-file-open-navigation-owner`, `test-system-file-open-index-owner`, `test-system-file-open`, `test-bookshelf-reading-entry`, `test-search-trial-reading-return`, `test-reader-source-failure-p0`, `test-reader-recoverable-entry`, `test-reader-directory-backfill-after-frame`, `test-reading-session-routing`, `test-reader-tts-exit-progress`, `test-contract-test-tiers`.

Known boundary: the transaction resolver currently delegates to the existing Index source-switch projection. It will become a thin SourceSwitchHost delegation in the separate SourceSwitch owner slice. Native exit delivery, file URI permission/platform failure and signed paired Core/Host HAP remain parent integration/target gates.
