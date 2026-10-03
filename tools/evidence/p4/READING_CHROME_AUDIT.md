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

Second implemented batch: 21 remaining panel/chrome files, 230 literal-size carriers and 753 typography arguments. The public compatibility catalogue has 215 semantic exports (84 physical contracts plus 131 aliases); all divergent currently rendered tuples and native AUTO omissions remain intact. Exact pre-migration source restoration and 230 × three actual SDK native tuple scenes / five same-role consumers PASS. Of 43 targeted reading regressions, 41 now PASS; two original LRE replace fixtures still refer to the superseded paginationIndex owner and are outside this typography slice. This closes 280 / 291 original chrome-size carriers, leaving exactly eleven dynamic-size carriers. A fresh five-property audit also finds nine inherited-size snippet Span emphasis carriers plus partial dynamic family/weight/line-box expressions; these are explicitly owed by the next bounded-motion batch. Four user-selected physical preview faces remain legitimate runtime contracts, not arbitrary chrome styling. HAP/device/pixel/user acceptance is not claimed by this local/SDK batch.

Third implemented batch closes the eleven dynamic-size candidates, nine inherited-size snippet Span emphasis carriers, two retained-header variants, selected option weights, and the now released LRE failure text (two Text / three original font arguments). Fifteen production files, 26 changed carriers and 72 font arguments use central finite contracts. Quick/Full speed endpoints still interpolate through the existing readerControlLerp and one resolved p; the variable value weight still rounds once. Settings' exact spatial actor continues supplying its 12→16vp line box, while 10→11fp glyph size endpoints belong to public roles. Replace's duplicate fixed nameSize is removed from geometry; its actual mounted text stays12fp with the original four mutation tests. The wheel's unused per-call selectedSize/neighbourSize overrides are removed because there is exactly one production caller and both existing values are finite shared17/11fp contracts. Range, row geometry, onStep and input gating stay unchanged.

Whole reading scan at this branch: 65 ETS files / 315 typography modifier carriers / 999 arguments. 983 are public roles or the already shared calibrated top chrome. Exactly16 remaining arguments have narrow required runtime contracts: four physical font-preview families; five transferred native measure attributes; five actual persisted-body appearance attributes; one title line box from pagination layout; one Settings line box from its spatial actor. Zero arbitrary private chrome arguments remain. The new five-property actual ETS AST gate verifies real public imports/exports, both calibrated consumers, exact path/method/property/expression/count for each runtime allowance and role-endpoint interpolation; it rejects mixed numeric endpoints, shifted p, TYPE+2 and copied exceptions. Native defaults without explicit typography are a separate element-level audit question, not included in the315 modifier-carrier claim.

Validation: 26 changed carriers ×28 categorical/progress scenes =728 actual SDK tuple comparisons PASS (including forwards/reverse p samples), four independent real inline consumers follow one shared role while22 other variants remain unchanged. Explicit --verify-migration-source reconstructs the predecessor source exactly on this isolated baseline. Normal CI checks actual styles/contracts without freezing unrelated future business edits. Static230 and directory50 proof suites remain compatible with the registered successor; all affected settings/search/replace/timer mounted geometry/callback/mutation probes PASS. The local targeted43-test sweep has41 PASS; the two old pagination-owner fixture failures are already corrected by P3 commits172a76d8/c4694889 in the parent integration, and are not silently counted as local PASS. No HAP/native-pixel/user-acceptance claim is made.
