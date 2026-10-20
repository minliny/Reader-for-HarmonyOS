# PH42 directory display depth

## Recorded before the fix

- Host baseline: `677430b0`; Core: `bf2aab24`.
- The v2 directory protocol exposes zero-based `depth`; the legacy v1 view remains one-based. Core `remote/local_navigation/v2.rs::echo` performs that protocol conversion, and the Host gateway adds a verified `identity` only for v2 views.
- `ReaderDirectoryNavigationList.ets` still subtracts one for visual indentation and announces raw depth. The actual SDK-transformed production `row` reproduced root depth 0 as left padding 9 / `第0级分组`, child depth 1 as left padding 9 / `第1级`, and grandchild depth 2 as left padding 21 / `第2级`.
- This affects the shared tree row used by Quick, Full and detail. It does not change readable counts, chapter identities, targets, or legacy flat `TocEntry.level`.
- The existing row tests begin at depth 1 and therefore miss the v2 root/child boundary.

## Narrow correction and evidence boundary

Translate v2 depth to a human-facing one-based level in the row only, using the existing view identity to preserve v1 behavior. Keep indentation capped at three 12vp steps. Add an actual SDK Builder regression for v2 0/1/2/deep levels, v1 1/2/3, full title accessibility, and separate target/disclosure actions.

Status: code and focused regressions PASS. The actual SDK row test first failed on root `第0级` (`red.log`), then passed the v2 0/1/2/32 and v1 1/2/3/32 boundaries (`green.log`). Existing navigation UI tests (`navigation-ui.log`), viewport tests (`viewport.log`) and legacy flat hierarchy tests (`legacy-hierarchy.log`) also pass. Existing row probes now extract the real `displayLevel` dependency; no stub replaces it. `git diff --check` passes.

The same SDK test confirms the emitted row requests an 11fp title, one line, ellipsis and remaining-width layout, does not set a `maxFontScale` cap, and exposes the full title and separate disclosure action. The existing SDK layout probes record emitted properties and geometry; they do not execute ArkUI native text measurement. Therefore these assertions do **not** establish legibility/clipping at large system font sizes or narrow widths, nor native screen-reader focus/action order. Those checks remain OPEN. No font sizing policy was changed.

For an actual v2 EPUB directory such as 宰执天下/晚唐浮生: a root heading at depth 0 retains left text padding 9vp and announces level 1; a direct child at depth 1 uses 21vp and announces level 2; depth 2 uses 33vp. Depth 3 and deeper are capped at 45vp while accessibility retains the full level. These padding values are relative to each title box, not absolute screen coordinates; the current-row marker can add 3vp separately. A linked parent title still selects the original canonical chapter, and its arrow only folds/unfolds.

The readable-rank follow-up found no further canonical-ID change in previous/next, automatic page turning, TTS next-chapter or slider selection. All use the admitted readable ChapterWindow/order; unknown partial catalog edges retain the existing guarded hydrate path. The focused navigation suite additionally covers superseded query, sort during debounce, motion/scroll cancellation, source/target rejection and empty-query results. No new search-concurrency defect was established.

No VM/HAP/user-data operations. Full ArkTS/HAP and installed-pixel acceptance remain with the root task.
