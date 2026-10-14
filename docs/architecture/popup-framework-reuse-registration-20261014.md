# Existing popup framework reuse registration, 2026-10-14

User authorization: `那就按这个方案落地`.
Worktree: `codex/unified-reader-popups`, previous implementation commit `651f413c`.

## Code and validation boundary

The existing `ReaderActionMenuSurface` becomes the single action renderer for the original anchored `menu` and the finite `grouped`/`quick` variants. `ReaderActionSheetContent` remains a compatibility facade and business DTO; it owns no native text, backgrounds or action rows. Its real outgoing child binding is registered, rather than treating incoming callers alone as proof of reuse.

`ReaderBoundedSurface` and its header own the new `reader-action-sheet` frame. The real source picker delegates its outer drawer to the finite `source-switch-drawer` variant, retaining selected source-picker content, motion timing, business state and action admission in `SourceSwitchWindow`.

Historical manga, directory, selected novel source and initial unified action-sheet typography witnesses stay byte immutable. A new source frame successor retires exactly the one `TOK_SS_WINDOW_BG` carrier and moves its grip carrier's method ownership from `novelDrawer` to `novelDrawerBody`. All 21 source-picker typography tuples and native AUTO actors remain retained. The original existing action-menu shared-owner row is separately witnessed before its finite producer promotion. The original 100 business budget origins remain intact.

## Observed validation issues

- Existing exact physical producer shapes and actual consumer edges become stale when a legitimate finite variant or child binding changes. They must be refreshed for only the affected producer/interface/spec/delegate chain; arbitrary typography and appearance parameters remain forbidden.
- The previous action-sheet content getter must cease receiving typography admission when the facade delegates to the menu family. The existing menu family requires an exact second resolver binding for sheet text. Returning a private style bag, changing imported resolver modules, literal numeric overrides and deleted child bindings continue to reject.
- The source picker previously owned its drawer background. Its new selected-frame witness reduces the source actor budget by one background and preserves the original superseded business count witness. It does not transfer source content into the old unused `source-switch-window` variant.

## Final code-side correction

Final code review identified a fidelity issue: after moving the phone and side-panel title into the shared header, the original `minFontScale(0)` and `maxFontScale(2)` calls were omitted. The fix places both bounds in `DrawerSurfaceSpec` and makes both actual title branches read them. The exact header shape now records all four scale calls, and a same-call-count `maxFontScale(99)` mutation rejects. Caller scale overrides are forbidden. The shared producer descriptions now name all ten finite surface IDs, including the real source drawer and the action frame. Historical typography witnesses and original source business budgets remain unchanged.

## Verification

All nine checks below completed with exit code 0 using Node.js 26.0.0 and the installed DevEco ETS SDK.

| Command | Result and limit |
| --- | --- |
| `node tools/test-architecture-shared-producers.mjs` | PASS: 18 finite producers; exact source/spec/delegate edges, immutable owner origins and same-count private typography, missing delegate, unknown variant and arbitrary caller-style negatives. |
| `node tools/test-architecture-consumer-baseline.mjs` | PASS: 93 unchanged business budgets, seven original transfers, 17 bounded shared owners and 33 retained policies cover all 139 actual UI files. |
| `node tools/test-private-typography-budget.mjs` | PASS: one established menu family has exact popup/sheet resolver bindings; the retired facade getter and private resolver/import/literal bags reject. |
| `node tools/test-bounded-typography-carriers.mjs` | PASS: all 21 source tuples remain retained, immutable source frame origin binds the real drawer variant; copied/deleted typography, raised budget and old unused popup variant reject. |
| `node tools/test-conventional-typography-coverage.mjs` | PASS: 103 files, 487 real carriers, 1,246 public-role/spec arguments, 72 finite producer arguments and 291 retained approved arguments; no unregistered private typography. |
| `node tools/test-conventional-typography.mjs` | PASS: 28 files; 173 retained consumer contracts and 125 approved carriers replace 75 historical sites while retaining AUTO/dynamic choices. |
| `node tools/test-conventional-typography-sdk.mjs` | PASS: 262 actual SDK contracts across three states; 11 role propagation consumers and 251 bounded variants. |
| `node tools/test-conventional-typography-registry.mjs` | PASS: 248 consumers and 93 semantic roles retain the original public baseline and finite successors. |
| `node tools/test-native-default-control-contracts.mjs` | PASS: 13 native families, 14 actual actors and exact accessibility/bounded/inherited/AUTO actors; no fabricated physical font overrides. |

The actual MangaReadingSurface keeps its 35 remaining original typography tuples unchanged; the action frame/header is now a separate shared branch. The earlier manga action-content witness stays byte immutable. The compatibility facade has zero physical style calls and zero typography carriers. Its child contract proves that rendering happens inside the existing action-menu family.

Final registered production fingerprints:

- `entry/src/main/ets/features/common/ReaderActionMenuSurface.ets`: `e3086027699adf08a9c863038ec64d7e8272306a8c697955c9c9331768b36214`
- `entry/src/main/ets/features/common/ReaderActionSheetContent.ets`: `6c1e306a740de2642f31db6d419bb76a6bd6aee8a268c3b65c3c89bc1ceec47c`
- `entry/src/main/ets/features/common/ReaderBoundedSurface.ets`: `54434a4649babb9e00a4bc3117790321f735fddd9e18f74e7cfd411f8087d986`
- `entry/src/main/ets/features/common/ReaderBoundedSurfaceHeader.ets`: `ef5432111d9e1700dd72fb6b2bc28b2473f79b6d59893a83873e7d6fde2595bb`
- `entry/src/main/ets/features/common/ReaderSurfaceSpecs.ets`: `3860f0200daab4f57856247ed8a9d824805e4941ac13f6f0604f50ee3b61258f`

These are code and local SDK facts. HAP packaging, installation, native visual acceptance and user acceptance remain separate and unclaimed.

## ArkTS compile correction

The canonical build at 3261180a passed all 667 Host contracts and then reported three ArkTS errors. The action recipe registry now uses an explicit interface with grouped/quick fields instead of the mapped Record type; all recipe values and lookup behavior remain unchanged. The shared handle callbacks use onHandlePanStart/Update/End, avoiding CustomComponent drag API collisions. The Manga owner still receives the same start, offset update, offset/velocity end and cancellation events. Exact producer/spec/caller contracts were refreshed; packaging and device verification remain with the canonical pipeline.

Targeted local verification passed: bounded-surface-frame-header, reader-action-sheet-content, manga-sheet-motion-sdk and manga-surface-sdk. These include real lowered pan start/update/end/cancel forwarding and unchanged full owner motion/token fences. Formal whole-app ArkTS compilation remains pending the next canonical build.
