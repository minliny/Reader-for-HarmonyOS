# Current reading-chrome Typography audit

Pinned baseline: cf9dadef. Real ETS AST: 297 private-size candidates in 37 files. Scope after explicit owner/runtime exclusions: 291 chrome carriers in 33 files (280 literal sizes, 11 dynamic sizes). Persistent actors are migration candidates, not a blanket exception.

|File under entry/src/main/ets/features/reading/|Private-size carriers at baseline|
|---|---:|
|FullDirectoryPanel.ets|8|
|ReaderAppearanceFullPanel.ets|18|
|ReaderAppearanceModulePanel.ets|4|
|ReaderAppearanceSharedActors.ets|4|
|ReaderAutoPageFullPanel.ets|21|
|ReaderAutoPagePanel.ets|7|
|ReaderBookmarkEmptyState.ets|3|
|ReaderBookmarkErrorState.ets|2|
|ReaderBookmarkLoadingState.ets|1|
|ReaderBookmarkRow.ets|10|
|ReaderControlAppearanceContent.ets|16|
|ReaderControlAutoPageContent.ets|18|
|ReaderControlDirectoryContent.ets|6|
|ReaderControlPanel.ets|9|
|ReaderControlReplaceContent.ets|25|
|ReaderControlSearchContent.ets|6|
|ReaderControlSettingsContent.ets|6|
|ReaderControlTimerWheel.ets|2|
|ReaderControlTtsContent.ets|27|
|ReaderDirectoryChapterRow.ets|1|
|ReaderDirectoryModulePanel.ets|3|
|ReaderDirectoryNavigationList.ets|3|
|ReaderDirectoryNavigationSurface.ets|1|
|ReaderDirectoryRules.ets|7|
|ReaderFullDirectory.ets|5|
|ReaderQuickSearchPanel.ets|5|
|ReaderReplaceQuickPanel.ets|4|
|ReaderSearchFullPanel.ets|5|
|ReaderSettingsFullPanel.ets|7|
|ReaderSettingsModulePanel.ets|2|
|ReaderTtsConfigOverlay.ets|22|
|ReaderTtsFullPanel.ets|28|
|ReaderTtsModulePanel.ets|5|

Owner/runtime exclusions: LocalReadingExperience 2 failure texts are currently leased by P3; ReadingSurface one user-body tuple and ReaderNativeTextMeasurement one matched measure recipe retain their actual appearance/measurement owner; ReaderPageChrome two consumers already use the calibrated ReaderTextStyle returned by readerPageChromeTopTextStyle, and are shared contracts incorrectly excluded by the generic helper-name recognizer. Do not force fixed chrome roles onto device-calibrated measurement contracts.

Four appearance font-preview families must retain the user-selected registered physical face, while their UI size/weight/line box still migrate to public preview roles. The eleven dynamic chrome sizes require central bounded variants/interpolation endpoints and preserved p/selected/header branch expressions. Timer-wheel input props remain geometry-driven during morphs, but their defaults/allowed contracts and physical family/weight must be central; they are not body-text exceptions.

First implemented batch: all 12 directory/bookmark/rules/full-directory files, 50 carriers and 126 font arguments; 30 semantic roles, 22 new physical contracts, 5 aliases to existing immutable contracts. Source SHA restoration and 50 × three real SDK states/6 shared-role propagation consumers PASS. This leaves 241 scope candidates. ReaderSelect five trigger variants already consume shared fontFamily and fontWeight; no additional private weight was found.
