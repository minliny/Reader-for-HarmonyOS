# Prepared resident-window title boundary

Found during read-only audit of user-reported next-chapter flash/downshift on final09ce VM. This is a separate confirmed boundary defect, not a proven cause of that downshift: a nonzero document window incorrectly showed a chapter title in the prepared slot, then promotion correctly removed it (the expected movement direction would be upward).

Production preparedPageTurnRenderPage checked only first resident paragraph. Promoted isChapterFirstPageStart also required documentRange.startScalar=0. The narrow fix adds that same full-chapter condition, leaving canonical targets, layout and publication unchanged.

Actual production-method probe uses the real RenderPage class and tests next/previous, full start0, resident start600, legacy absent range, fragment ownership and equality with promoted title admission. Correct baseline red is actual=true expected=false; green and existing appearance-page-publication suite pass. Initial probe class extraction accidentally included a following exported const and failed parsing; corrected before the recorded product red. Existing check-local test glob includes the new test.

Promotion audit: restoreMaterializedChapterContext precedes visible page/fragments and title admission; physical slot ownership and renderRevision change later in the same synchronous function, with no await. Stage refreshes current/adjacent render objects for one contentRevision. No second confirmed asynchronous title publication defect was established. Safe-area contentTop has no chapter-index dependency; metrics/viewport changes remain separately handled. Native paint/VM timing is not proven by these local probes.
