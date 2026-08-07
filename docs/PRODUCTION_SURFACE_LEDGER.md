# Production Surface Ledger

Frozen baseline for the Tokens → Shared → Shell → Pages migration.
Source of truth for "new abstractions must be consumed by the current production surface" (FIGMA_NATIVE_UI_EXECUTION_PLAN Batch 0).

## Baseline

- Commit: `594530d` chore(harmony): baseline committed production UI files
- Branch: `feat/reader-module-directory-a2`
- Frozen: 2026-08-07
- Production source files: 47 (ArkTS/TS under `entry/src/main/ets`)
- Icon assets: 110 (`entry/src/main/resources/base/media/*.svg`)
- Fixed `position/offset` occurrences: 20 across 9 files (migration backlog)

## Source files

### app (4)
- HttpExecuteHost.ts
- ReaderCoreGateway.ts
- ReaderHostRegistry.ts
- ReaderRuntimeOwner.ts

### entryability (1)
- EntryAbility.ets

### pages (1)
- Index.ets

### features/common (9)
- PageBackBar.ets · ReaderCard.ets · ReaderFonts.ets · ReaderIconButton.ets
- ReaderSectionHeading.ets · ReaderSelect.ets · ReaderToggle.ets · ReaderTokens.ets · StatusBadge.ets

### features/shell (4)
- MainTabBar.ets · ReaderShell.ets · MainTabShell.ets · SettingsShell.ets

### features/bookshelf (7)
- BookshelfEmptyCard.ets · BookshelfEmptyPage.ets · BookshelfFlowGateway.ts · BookshelfPage.ets
- LocalBookDetail.ets · LocalBookImportGateway.ts · LocalImportDialog.ets · NoCoverCover.ets

### features/reading (7)
- FullDirectoryPanel.ets · LocalReadingExperience.ets · LocalReadingFlowGateway.ts
- ReaderControlPanel.ets · ReaderFullDirectory.ets · ReadingSurface.ets · ReadingSurfaceLayoutMap.ts · SourceSwitchPanel.ets

### features/discover (2)
- DiscoverGateway.ts · DiscoverPage.ets

### features/rss (2)
- RssGateway.ts · RssPage.ets

### features/search (3)
- SearchGateway.ts · SearchOrchestrator.ets · SearchPage.ets

### features/settings (3)
- SettingsGateway.ts · SettingsOrchestrator.ets · SettingsPage.ets

### features/source (5)
- SourceGateway.ts · SourceManagementPage.ets · SourceOrchestrator.ets · SourceSwitchGateway.ts

### features/sync (3)
- SyncGateway.ts · SyncOrchestrator.ets · SyncPage.ets

## Fixed position/offset backlog (20 / 9 files)

| File | Batch | Note |
|---|---|---|
| SettingsPage.ets | 3 | selectRow `.position` → adaptive |
| FullDirectoryPanel.ets | 2 | reader overlay (allowed) |
| ReaderFullDirectory.ets | 2 | reader overlay (allowed) |
| LocalReadingExperience.ets | 2 | reader overlay (allowed) |
| BookshelfEmptyCard.ets | 5 | |
| LocalBookDetail.ets | 5 | |
| LocalImportDialog.ets | 5 | |
| NoCoverCover.ets | 5 | |
| ReaderToggle.ets | 1/3 | tooltip positioning |

## Update log

- 2026-08-07: baseline frozen (594530d).
- 2026-08-07: Batch 1 done (56e1df1) — ReaderTokens 13 categories + Figma source markers + 3 new tokens; ReaderControlPanel RC_* → TOK_*; SettingsPage aliases purged. Compile-verified (assembleHap API 23).
  - Deferred to Batch 3/5: page aliases in RssPage/SearchPage/SyncPage/DiscoverPage/SourceManagementPage migrate with each page (avoid double-touch).
  - Resolved: ReaderCard `.border({ width: 0.556 })` + SourceSwitchPanel window border calibrated to TOK_BORDER_W (1vp, §八 platform calibration).
- 2026-08-07: Batch 2 local side done (5fd612a + 54dc15a) — ReaderControlGeometry fixed-canvas widths (dockW/sheetW/mainW/progressW/chapterRowW/sliderW/actionW) removed; Dock/Sheet/ModuleNav adaptive via width 100% + constraintSize(maxWidth) + bottom-center, Main layoutWeight(1), progress fill/thumb percentage-mapped to live slider width. New features/shell/ReaderShell.ets composes LocalReadingExperience + directory + source-switch overlays; Index reading route now a single ReaderShell call (business state + gateways stay in Index). Compile-verified (assembleHap).
  - Deferred: state bar / safe-area separation for Reader (shares Index root Stack padding to avoid double-padding); three-viewport visual verification requires device/VM (marked pending).
- 2026-08-07: Batch 3 Task 3 done — SettingsPage converged to CategorySection (Card+Heading+rows) + CategoryRow (icon盒+label+trailing via @BuilderParam content); `.position({x,y})` select placement removed. selectRow stays page-private (dropdown grows the row → generic CategoryRow can't express; left label fixed 57 centered + right ReaderSelect top + margin (57-36)/2 keeps trigger aligned with label center); dangerRow stays page-private (standalone card). Compile-verified (assembleHap), LEDGER pending VM visual.
- 2026-08-07: Batch 3 Tasks 4+5 done — new features/shell/MainTabShell.ets (page bg + content area layoutWeight(1) + MainTabBar + showBottomNav prop for Tablet bookshelf left-rail) and SettingsShell.ets (Home TopBar / BackTopBar + Scroll content + BottomNav + home/general subpage switch via activeSection prop + responsive margins). Bookshelf/Discover/Rss/Settings pages now render their shell internally (page-as-host: pages are structs, can't be passed up as @BuilderParam content slots to Index, so the page hosts the shell — same "页面不复制公共骨架" outcome, Index routing unchanged). Status bar padding + bottom safe area stay in Index root Stack (Batch 2 deferred, avoids double-padding); overlay host stays in Index root (import dialog). Compile-verified.
- 2026-08-07: **Figma Auto Layout conversion DEFERRED** (audit F0-F2). Attempted to drive the logged-in Figma desktop app via GUI automation (osascript/System Events) per user directive; blocked at multiple levels: (1) canvas/panels are Electron webview, not native AX controls — Design-panel Auto Layout controls unreachable; (2) `screencapture` denied (no Screen Recording permission) — no visual ground truth; (3) "Import plugin from manifest…" opens a webview-internal dialog (AppleEvent timeout, no native NSOpenPanel); (4) all existing plugin registrations are stale (`/private/tmp/reader-figma-local-writer` tmp-cleared, `Reader-UI/tools/design|reader-surface-proof` dirs deleted) — a diagnostic plugin (sentinel `F0_PROOF`) never loaded, confirming the registered path doesn't execute. File verified safe via get_figma_data (Shell/MainTabShell 277:6 layoutMode still NONE, no partial writes). Unblock requires: Screen Recording permission + properly installed plugin, or a web-plugin-dashboard install. Per user decision 2026-08-07: proceed with H1 (HarmonyOS convergence) first; Figma Auto Layout (F1: 277:6/277:34/277:49 Shells, F2: ControlDock + SourceSwitch masters) recorded deferred until a reliable write path exists.
- 2026-08-07: **H1 (Batch 2 convergence) done** — (3-1) ReaderControlGeometry width table purged: `textW` (170/512 chapter-title column) → `layoutWeight(1)`; `topBarW` (360/702) → `width('100%') + constraintSize(maxWidth topBarMaxW)`. `sheetH`/radii/gaps kept as design heights/anchors (sheetH carries the bottom ModuleNav zone, not a fixed-canvas width — Hug would sever sheet↔moduleNav). (4-1) Reader top inset moved into ReaderShell: `@StorageLink('statusBarHeightPx')` + content Stack `.padding({top: px2vp(statusBarHeightPx)})`; Index root Stack `.padding({top: readingSessionActive ? 0 : px2vp(statusBarHeightPx)})` (no double-pad). Non-immersive look preserved (no full-bleed under status bar — deferred pending VM/design confirmation). Compile-verified (assembleHap).
- 2026-08-07: **H2 (Batch 3 convergence) done** — Settings params centered: `TOK_SETTING_ICON_BG`/`TOK_SETTING_ACTION_BG` (deduped SettingsPage `ICON_BG` = CategoryRow `ROW_ICON_BG` `#172379A4` → single token) + `TOK_SETTINGS_TOP_BAR_INSET`; permissionRow manual `Row().width(55)/width(6)` spacers removed → fit-content cluster `Row({space:6})` (matches Figma Article trailing `fit-content(100%)` grid col); `contentWidth()` two-tier (352/722) removed → cards Fill + `ReaderCard.constraintSize({maxWidth: TOK_CONTENT_MAX_W_TABLET})` single-point; dangerRow `width('100%') + constraintSize`. MainTabBar 5 `MAIN_TAB_*` aliases → direct TOK_*; `.border({width:1})` → `TOK_BORDER_W`. Compile-verified (assembleHap).
- 2026-08-07: **H3 (Batch 1 convergence) done** — 29 page-level token aliases → direct TOK_* (Discover 5 / Source Mgmt 6 / RSS 9 / Sync 4 / Search 5). Page-private hardcoded leaf colors (RSS CARD_BORDER/*_BG, Source FIELD_BG, Discover CHIP_BG) kept — not token re-exports. `TOK_SCREEN_INSET` annotation corrected: node-measured 19 re-marked as HarmonyOS calibration (distinct from formal Figma Variable sources). Compile-verified (assembleHap).