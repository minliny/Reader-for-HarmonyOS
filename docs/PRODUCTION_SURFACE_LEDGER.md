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
- 2026-08-07: **H4 (Batch 4 source-switch local components) done** — new `features/source/{SourceSwitchWindow,CandidateRow,LatencyBar}.ets`; whole-window copy in `features/reading/SourceSwitchPanel.ets` removed → thin shell re-exporting the relocated `SourceSwitchPanelState` union (so `import ... from '../reading/SourceSwitchPanel'` callers keep working) and mounting the shared window. Candidate rows: adaptive name column (layoutWeight) + semantic-width latency (28) + chapter (100) columns. `SourceSwitchGateway.ts`/Core/business state machine untouched (frozen per plan). Compile-verified (assembleHap).
- 2026-08-08: **P (Batch 5/6 remaining pages) border-token convergence done** — 46 `.border({ width: 1, ... })` → `.border({ width: TOK_BORDER_W, ... })` across 11 files (SourceManagementPage 4 / DiscoverPage 4 / RssPage 9 / LocalBookDetail 6 / BookshelfPage 2 / BookshelfEmptyCard 5 / LocalImportDialog 3 / SyncPage 9 / FullDirectoryPanel 2 / ReaderFullDirectory 1 / ReaderSelect 1), each with `TOK_BORDER_W` added to its ReaderTokens import. `TOK_BORDER_W` (HarmonyOS calibration: Figma 0.556px → 1vp) now uniformly applied to every page + shared component. Compile-verified (assembleHap). Content-width two-tier consts (page-private Figma-measured 350/350.903/620/720/722) kept per H3 policy — not forced to canonical tokens (would regress VM-verified layouts). Fixed-position backlog (NoCoverCover / BookshelfEmptyCard / LocalImportDialog / LocalBookDetail:315) all legitimate (cover-proportion decorations, empty-state illustration, fixed Phone-only dialog, contentWidth-derived badge) — left as-is. PageBackBar trailing-slot gap: SourceManagementPage's extra trailing decorative more-button (no onClick) kept hand-rolled — shared PageBackBar has no optional @BuilderParam precedent (all callers pass required content), adding one would plumb empty builders through 4 verified pages for zero functional gain.
- 2026-08-08: **F1 (Figma Shells → Auto Layout) done** via `use_figma` (plugin:figma MCP — the working write path; manual-plugin/GUI-automation approach retired). All three production Shell masters converted from inert absolute-positioned layouts to real auto-layout:
  - **MainTabShell 277:6** (root was already VERTICAL but 5 children were absolute-positioned leftovers): statusBar/appTopBar → FILL width + fixed 48/58; contentRegion → FILL both (stretches); mainNav → FIXED 362 centered (counterAxisAlignItems=CENTER) + bottom-anchored; stateHost → ABSOLUTE overlay covering 0,0,390,844. Root counterAxisAlignItems=CENTER, paddingBottom=14, 1px stroke bound to var 256:8.
  - **SettingsShell 277:49** (root NONE): converted to VERTICAL; statusBar/backTopBar FILL+48/58; settingsContent FILL both (stretches 642→684); bottomActionHost FIXED 352 centered + bottom-anchored (paddingBottom 14 → stays y=790); sheetHost/toastHost/dialogHost/settingsStateHost → ABSOLUTE covering 0,0,390,878.
  - **ReaderShell 277:34** (root NONE): converted to VERTICAL; readingSurface FILL both (full-bleed background stretches); readerStateHost ABSOLUTE 0,0,390,844; readerOverlayHost/bottomSheetHost/readerAccessoryHost/readerModuleNav → ABSOLUTE at their designed anchors (reader overlays allowed per ledger).
  - **Adaptivity verified** by resize test: at 500×900/960 each shell's content slot stretches, main nav/bottom action bottom-anchor + center, status/top bars FILL width; restore to native size returns exact original geometry. No detach / no instance override touched (shared masters; propagates to 23 Final instances as intended).
- 2026-08-07: **V (verification gate) PARTIAL** — vivo 手机模拟器 (Pura 90, 1320×2856 portrait, API 23) + 新建 6.0.31 tablet 模拟器 (2560×1600 landscape, downloaded image, API 23) 实机截图 via hdc snapshot_display + uinput.
  - **Phone 视口核验 PASS**: Bookshelf 空态 / Discover / RSS / Settings 首页 / Settings 子页 (书源管理、同步、阅读子页) 全部渲染正常、无溢出、MainTabBar 各 tab 正常。H2/H3 改动页面均验证。
  - **Tablet 视口核验 PASS**: 书架首页平板布局 (左导轨) + 底部导航切换 + 页面渲染正常，无崩溃。
  - **未覆盖 (诚实记录)**: (1) 阅读面 (H1 几何表 + 安全区) 与换源窗口 (H4 6 态) 需书库有书才能触发，模拟器书架为空、无样书；Core 快照 (filesDir/reader-core/snapshot-v1.json) schema 在私有 reader-core 仓库，注入书需逆向且风险高，故未注入。(2) Compact Landscape / 中间宽度: 手机为固定竖屏 (无旋转命令)，平板为固定横屏 2560；仅覆盖两个离散宽度，未穷尽四视口。→ H1/H4 视觉 + 四视口门禁标记 pending，需样书 + 多尺寸设备。
  - 证据: `/tmp/vshots/` (phone 01-19, tablet 20-24 jpeg)。
- 2026-08-08: **V 门禁续跑 (H1 PASS + 真实崩溃修复)** — 样书定位到 (~/Downloads, 已上架模拟器书架), 用 `uitest dumpLayout` (JSON 布局树, 非截图) + `snapshot_display .jpeg` 驱动。
  - **H1 阅读面 (几何表 + 安全区) Phone 视口 PASS**: 控制层 TopBar 锚于状态栏下方 (y=202), Dock 锚于底部安全区上方 (y bottom=2741), 无溢出; 进度条百分比映射到活跃 slider 宽度。ReaderControlGeometry 双尺寸表删除后几何正确。
  - **V 门禁抓到真实回归 (H2 @Builder 崩溃)**: 点 Settings 底部 tab 确定性崩溃 `TypeError: Cannot read property bind of undefined` (SettingsPage:88 → CategorySection:24 → ReaderCard:20)。根因=H2 收敛把 @Builder **方法引用** (`homeContent: this.buildHome`) 作 @BuilderParam 传入, 方法内部再建 @Builder 闭包 (CategorySection content → navRow/switchRow) 丢 this 绑定。修复=改**内联箭头闭包**词法捕获 this (`homeContent: (): void => { this.buildHome(); }`, 同 BookshelfPage 尾随闭包 pattern)。编译验证 + 实机复验: Settings 首页 5 行 → 通用设置子页 (基础偏好/行为与反馈/系统权限) 全部渲染正常, 无新崩溃日志。此例证明编译门禁无法捕获 @Builder 绑定类运行时崩, V 门禁价值确认。
  - **H4 换源 6 态仍 BLOCKED (诚实记录)**: 书架唯一书为本地书, 换源入口被 Index.ets:766 设计性阻断 (local 无远程源); 模拟器 http.execute/source 不可用, 无法导入在线书。H4 视觉 6 态验证标记 pending, 需在线书源可用环境。
  - 证据: `/tmp/v_gen.jpeg` (通用设置子页渲染)。屏幕截图无法直接读, 以布局树为准。
- 2026-08-08: **F2 (控制层 + 换源唯一源) 架构验证 — 已满足, 无需变异** — 计划 F2 基于 2026-08-07 过时审计, 当前文件已兑现唯一源架构, 逐节点核对:
  - **控制层**: 不存在 monolithic ControlDock master (仅 6 个 INSTANCE 用于 QA 矩阵/页面装配)。`Reader/Responsive/ControlSheet` COMPONENT_SET (1023:18713) = Grabber + `ControlMain`(instance) + `BrightnessRail`(instance); `ControlMain` (1023:18704) = `QuickActionPanel` + `ChapterProgress` 两 instance; `Reader/ModuleNav` (1023:17718) = `ModuleButton` instance (Active=None/Directory/TTS/Appearance/Settings 五变体共享同一 4 按钮源)。Phone/TabletExpanded 双视口同构。
  - **换源**: `SourceSwitch/Window` COMPONENT_SET (3665:2850) 7 态 (Default/Discovering/Switching/Success/Failure/Empty/DiscoveryError) 共享同一 WindowHeader/CandidateList/ColumnHeader/FooterMeta instance, 仅 StateBody 逐态不同 → 无每态复制整窗。`SourceSwitch/CandidateRow` (568:78) 25 变体 (State=Current/Available/Selected/Unavailable/Timeout × Interaction)。
  - **判定**: F2 核心交付 (唯一主源、无整窗复制) 已兑现。控制 masters 内部仍 NONE layout (绝对定位), 转换 auto-layout 为高风险 polish (会传播到 23 Final 实例、破坏底部锚定), 且 HarmonyOS 侧控制层自适应已由 H1 完成 (40→0 position), 故不改。F2 关闭, 不硬撑。
- 2026-08-08: **F1 过申修正 + Batch 6 Final 真实缺口** — 复核发现 F1 (2026-08-08) 的 "propagates to 23 Final instances" **过申**:
  - 三个 F1 转换的 Shell master (`Shell/MainTabShell` 277:6 / `Shell/ReaderShell` 277:34 / `Shell/SettingsShell` 277:49) 均为 VERTICAL auto-layout, **但全文件 0 实例 (unwired)** — 没有任何 Final 页引用它们。
  - Final 页 master 各自手绘 shell 结构 (例: Bookshelf Phone master 941:3 = 手绘状态栏 + AppTopBar/Phone instance + 内容 Container + BottomNav/Phone instance), 不走 `Shell/MainTabShell`。
  - 结论: F1 转换发生在孤立 master 上, 未达生产实例; "改共享组件可更新全部生产实例" 门禁未兑现。HarmonyOS 侧代码自有 MainTabShell/SettingsShell/ReaderShell (真正的运行时消费方), 已独立实现且与 Final 视觉对齐, 不受此影响。
  - **待决**: (a) 把 F1 Shell 实例接入 7+ 个 Final 页 master (大而高风险, 回归已验收视觉 spec, 纯设计卫生收益), 或 (b) 声明 Shell 为 reference-only, Final 页为权威逐页 spec, 把未接线记为已知缺口。见对话决策。
  - **2026-08-08 决策**: 用户拍板**暂不重接 F1 壳层** (不选 a/b/c 三选一中的重接)。方向: 先把本地 HarmonyOS 应用开发完毕, 之后**以本地应用为模板修复 Figma**。故: F1 壳层未接线记为已知缺口, ledger 过申已修正; Figma Final 修复整体 defer 到本地应用完成后, 届时按本地真实结构重排。HarmonyOS 侧不受影响 (代码自有壳层且已与 Final 视觉对齐)。
- 2026-08-08: **内容列宽 2 token 收敛 (rail 620 / 子页 720)** — 用 use_figma 逐页实测 12 个 760 平板 Final master 的内容列宽, 推翻原方案 ("620=书架特例、722=默认") 的 scoping, 改按**有无左 rail** 分档:
  - **实测真值 (Figma 760 平板)**: 主 tab 页书架/发现/RSS 均为 rail 结构 (左侧垂直 BottomNav rail 82 @x=17 + 内容列 620 @x=19 于 658 容器), 内容列 **620**; 书搜索 (无 rail 居中) 亦 620; 子页 书源管理 **722** / 同步·书详情·WebDAV **720** (无 rail, 19px 边距)。
  - **修掉真 bug**: DiscoverPage.ets:30 原 `TABLET_CONTENT_WIDTH = 722`, Figma 实测 620 → 改 620 (Discover 平板内容曾比设计宽 102px)。**与用户原始方案方向相反** — 原方案会把 bug 固化。
  - **token 落地**: 新增 `TOK_CONTENT_RAIL_W_TABLET = 620` (rail 档: 书架/发现/RSS/搜索); `TOK_CONTENT_MAX_W_TABLET 722 → 720` (子页档: 书源管理 722→720、同步、书详情; 兼大屏 maxWidth cap, Settings/ReaderCard 自动跟随); `TOK_CONTENT_MAX_W_PHONE = 352` (手机档: 350/350.903→352, 空态页 352 归并)。8 页全部删页私有 const 改直引 token。Search 手机 390 全宽保留特例。
  - Compile-verified (assembleHap API). **视觉回归待 V 门禁** (Discover 620、子页 720、手机 352 均需平板/手机 VM 逐视口复核, 尤其 Discover rail 对齐)。
- 2026-08-08: **内容列宽收敛 V 门禁复核结果** — 平板上 (Reader Tablet 31, 2560×1600, density 2.25, 1138vp) 用 uinput 点击导航 + uitest dumpLayout 布局树测量:
  - **isTablet 检测复核 PASS**: 平板模拟器 `deviceInfo.deviceType` 正确返回 `'tablet'` (hilog 实测 `deviceType=tablet`), 原 `deviceInfo.deviceType === 'tablet'` 判定有效。诊断中曾怀疑 `const.build.characteristics=default` 会致 deviceType 返回 'default' (依据 SDK 文档 "phone (or default for phones)"), 但实测该模拟器 deviceType 仍为 'tablet' — 假设证伪, 无改动。曾临时加 display 宽度回退的 isTabletDevice() 辅助函数, 因实为死代码(action), 已整体回退, Index.ets 恢复原判定。
  - **Discover 平板 620 PASS (真 bug 修复验证)**: 点击底部 发现 tab 后布局树显示内容列 `[581,236][1976,367]` = 1395px = **620vp**, 居中 (屏中 1280px)。DiscoverPage `contentWidth()` 现返回 `TOK_CONTENT_RAIL_W_TABLET` (620)。**722→620 bug fix 实机确认**。
  - **子页 720 PASS**: 设置首页 → 同步与备份 子页, 自动备份卡片 `[470,1346][2090,1600]` = 1620px = **720vp**, 居中。SyncPage `contentWidth()` 现返回 `TOK_CONTENT_MAX_W_TABLET` (720)。
  - **手机 352 PASS (先前已验)**: 手机 (Pura 90, density 3.5) 书架内容 1232px = 352vp = `TOK_CONTENT_MAX_W_PHONE`。
  - **遗留发现 (pre-existing, 非本次收敛引入, 未改)**: (a) Figma 平板 主 tab 页 (Discover/RSS/书架) 均为左 rail 结构, 但 HarmonyOS 仅 **BookshelfPage** 实现了左 rail (自带 `tabletNavigation()` @Builder + `showBottomNav:!isTablet`); **DiscoverPage/RssPage** 用 MainTabShell 时不传 showBottomNav (默认 true), 平板仍显示底部栏而非左 rail。MainTabShell 的 `showBottomNav=false` 只移除底部栏、不渲染 rail, rail 是逐页代码。620 内容宽度不受此影响 (rail 或底部栏均对应 620 内容列)。(b) SyncPage 平板 WebDAV 配置卡 `.width('100%')` 全宽 (2424px), 而同页自动备份/历史卡为 720 — Figma 子页档含 WebDAV 720, 全宽为 pre-existing 不一致。两遗留点记录待本地应用模板化修复 Figma 时一并评估。- 2026-08-08: **P1/P2/P3 静态页漂移收敛 (commit 3270ebf)** — 承接 2026-08-08 审计的 D1/D2/D3 缺陷 + SourceSwitchWindow 内联色, 逐项直引 token / 加语义 token, 编译 (assembleHap) BUILD SUCCESSFUL:
  - **P1/D1-D2 (Figma 真值已验)**: RssPage 行分隔 `#33B4A697`(0.2, 漂移) → `TOK_ROW_DIVIDER`(0.22); SyncPage `EXPAND_BG #A3EEE7DB`(漂移) → `TOK_SURFACE_PANEL_SOFT`(#A3EEE6DB)、`ICON_BG` → `TOK_SETTING_ICON_BG`(无漂移, 去重复定义)。见 commit 9a36c12 增 token 后直引。
  - **P2/D3 (方向分隔线宽度)**: 原方案 hairline 0.5 被 Figma 真值推翻 (实测分隔线 stroke 宽 = 1), 统一到 `TOK_BORDER_W`=1, 覆盖 Discover/SourceMgmt/RSS/Settings/CategoryRow/Search/Sync/CandidateRow 共 12 处 `{top/bottom: 0.5|1}`。LocalBookDetail 新增 2 语义 token: `TOK_CHAPTER_DIVIDER`=#47B4A697(0.28, 章节行顶分隔)、`TOK_ACTION_DIVIDER`=#6BB4A697(0.42, 操作栏按钮边)。
  - **P3 (SourceSwitchWindow)**: 7 处内联色 → 新增 source-switch token 组 (`TOK_SS_WINDOW_BG/BORDER/MUTED/FOOTER_TEXT/CLOSE_BG/SORT_PILL_BG/COLUMN_HEADER_BG`), 全部经 use_figma 与 Final 节点真值核对。
  - **门禁**: assembleHap BUILD SUCCESSFUL (仅 pre-existing 警告: SettingsGateway throw、px2vp deprecated)。**视觉回归待 V 门禁** (Changed 页: Discover/SourceMgmt/RSS/Settings/Search/Sync/LocalBookDetail/CandidateRow 需 VM 布局树复核)。
  - **范围澄清**: 提交仅含 P1/P2/P3 的 11 文件; `ReaderSelect.ets` + `reader_chevron_down.svg` 为独立遗留 (设置下拉 chevron 对齐 Motion), 未纳入本提交, 留待单独提交。
