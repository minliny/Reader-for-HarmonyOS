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

### features/shell (2)
- MainTabBar.ets · ReaderShell.ets

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