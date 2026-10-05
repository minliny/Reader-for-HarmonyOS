# Readable chapter ordinal/count in reading controls

Observed on d93be35d after the real Qidian TOC fix: 青春 first real chapter displayed `2 / 54` in Quick, with one group at canonical index 0 and 53 readable targets. Root retained reader-control-real-d93b-qingchun-quick.json/png and vm-observations. No VM action was performed for this patch.

Quick model and legacy Full count used raw entry ordinal/length. The reader passed raw parent TOC length into the “共 N 章” control, and automatic-page boundary controls compared canonical IDs to that count. The actual slider target selection already filters navigable entries, but percentage fallback used ChapterWindow order, which can deliberately retain a historical resumeOnly group.

Fix: display count/rank uses admitted readable metadata for bounded first-entry windows, or the existing filtered full catalog for complete views. Raw catalog position/count remain separate for list geometry/completeness. A rank map is rebuilt only with the existing immutable TOC-array projection. Quick/Full counts exclude group/disabled entries; resumeOnly has no fabricated ordinal. Boundary controls use readable rank/count or scan the available rows for a real target. Slider selection still maps readable position to canonical chapter ID. No first-frame catalog acquisition, Core field, stored ID, progress record, content or source changes were added.

Core review confirmed snapshot/prepared expose readableChapterCount/current.readablePosition; fresh book.toc readableChapterIndexes already drives Host navigable. Persisted chapterProgress is chapter-local, while bookshelf SQL aggregate already uses readable_position/readable_count. Core remains unchanged.

Local proof: test-reader-readable-progress exercises actual Quick projection, Full count, control step methods, owner percentage/page chrome and slider methods with groups, disabled rows, sparse canonical IDs, historical group and a bounded entry window. It verifies reused rank-map identity and slider canonical IDs. Existing window-publication fixture now provides real readable metadata while retaining raw catalog fields and all prior search/sort/lifecycle assertions. Focused model/window/historical-resume/auto-page/content gates also pass. Device first-frame and new package `1 / 53`/boundary controls remain separate acceptance gates.

## Full Host gate follow-up

The first unified gate failed at `tools/test-reader-auto-page-full.mjs:156`: the old regex required the previous canonical-ID comparison (`currentChapterIndex > 0`). Failure retained in `/private/tmp/ph42-readable-progress-workspace-acceptance.log`. The test now checks the actual `canStepChapter` binding and executes that production method against first-readable-after-group, bounded global count, sparse final ID and disabled tail. Existing form, geometry, timer and callback assertions remain. No production changes were needed for this gate correction.

The full Host rerun then reached the existing `test-reading-directory-fixture.mjs` but sandbox denied its loopback listener (`listen EPERM 127.0.0.1`). This environment failure is retained in `/private/tmp/ph42-readable-progress-host-full.log`; the unmodified complete script was restarted with approved local-server permissions, logging to `/private/tmp/ph42-readable-progress-host-full-permitted.log`.

Approved complete Host rerun exited 0: **384 contract tests passed**. The test file list was captured before the parallel depth-contract addition, so that new test's own focused result and the final frozen canonical gate must be reported separately; this run does not claim a final HAP identity. No further production change was made to repair the obsolete auto-page assertion.
