# P4 conventional application Typography batch

Baseline: `ceec1eed`; isolated branch `codex/p4-source-tools-typography-20261003`.

28 complete consumer files / 248 actual modifier carriers / 818 changed font arguments. Covers all remaining baseline private font-size consumers in bookshelf, conventional common controls, Search, Discover, Settings/Rules, source-management/switch, Sync, and the four non-management RSS pages. SourceTools was closed in the previous batch. ArkUI AUTO omissions, state-dependent weights, phone/tablet variants, cover-width scaling and all modifier options retain the current application values.

Central owner: ReaderTypography. 125 semantic roles consumed; 105 additional physical contracts and 16 semantic aliases reuse identical immutable contracts rather than copying their numeric values. Two additional bounded library-choice roles are provided for the integrator's independent ReaderChoiceRow migration.

Validation:

- Host source contracts: 191/191 PASS.
- Immutable original-source restoration: 28/28 SHA256 exact after reverting only new role imports and the 818 modified arguments. All content/layout/callbacks/business guards are therefore unchanged.
- Actual SDK transformation and native modifier closure execution: 248 consumers × three responsive/selection/cover scenarios, exact original tuple and AUTO/extra modifier arguments. One shared role update propagates to 11 real consumers, leaving 237 other variants unchanged.
- New coverage gate scans all 74 non-reading feature ETS files and all five typography modifiers, including Marquee/input/style carriers. No future filename whitelist: newly added files are scanned too. Explicitly OPEN concurrent migration debt is bounded by file/method/property/expression/max occurrences; it does not mean full P4 acceptance.
- Relevant integration contract selection: 64/66 initially PASS; Bookshelf physical-feedback enum-string assertions were corrected to physical numeric equivalence, then PASS. The sole environment-blocked cross-repository check is test-theme-dynamic-icons: SDK states run, then the generator's ../Reader-UI input is absent in this standalone worktree. Root's complete three-repository gate must run it. Shared-theme-local/primary-text and all remaining selected contracts PASS.
- diff --check PASS. HAP, device, native pixels and user acceptance are not established by this batch.

Remaining in this branch at this receipt: seven private font-size calls (six RSS-management calls awaiting its new owner baseline, one appearance-library choice call owned by integrator); five private weight-only calls within otherwise shared specs (Dialog header twice, Sheet title/action, MoreMenu label). Reader body/native/persistent-control/compat families are outside this non-reading batch and remain separately owned. On the integrator's newer RSS baseline, the added feedback brings management font-size calls to eight and must be migrated without raising the original private-style budget.
