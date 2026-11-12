# 页面几何宿主合同（2026-11-11）

P4 已修正普通 MainTabShell 的第二次正文解析，并修复详情、漫画目录、发现和下载页的测量代次读取/回调。几何、Scaffold 与 StandardPage 三个角色保留。当前有 10 个直接 Scaffold 页面，另一个 Scaffold 调用属于 StandardPage；StandardPage 有 14 处调用、分布在 13 个文件。

本表记录源码与本地方法证据；构建、设备像素和用户验收分别记账。精确导航门禁在独立重审及有限测试前置修复后 PASS；原准入/旧前置失败均保留，不追认历史结果。统一构建与设备结果仍独立记账。

## 直接宿主

| 页面 | 唯一正文几何 owner | 测量代次 | 头尾与 rail 预算 |
| --- | --- | --- | --- |
| MainTabShell | Active child body owner; StandardPage when standardScroll=true | Caller headerMeasurementKey/footerMeasurementKey + mounted/navigationGeneration footer guard | Header: Authored top/insets; measured presented bottom forwarded to child owner; Footer/end: Zero content/native end budget here; child owns it; Rail: MainNavigationOverlay owns rail paint; active child owns content rail clearance |
| SearchPage | SearchPage.pageGeometry | searchHeaderMeasurementKey + ownsPageQuery; measurementRevision; external ReaderLibrarySearchSurface header retains same query owner | Header: Scaffold headerVisible=false; external shared fixed-header receipt is sole height source; Footer/end: readerScrollLayout(contentOffset); full-height native List/Scroll consumes internal start/end; Rail: No main navigation rail |
| SourceManagementPage | SourceManagementPage.refreshGeometry | mounted + measurementKey; readForGeneration source:header/source:footer; viewport/window inputs advance key | Header: Current measured header, authored default until current receipt; Footer/end: Content end equals occupied footer extent; List contentOffset; Rail: None |
| BookshelfMultiSelectPage | BookshelfMultiSelectPage.refreshGeometry | mounted + measurementKey; current header/footer reads; viewport/window change invalidates | Header: Current selection topbar measured height; Footer/end: removeBarClearance +20; native List contentOffset; Rail: None |
| LocalBookDetail | LocalBookDetail.refreshGeometry | mounted + measurementKey; invalidateFrame on geometry/entity/font inputs; readForGeneration detail:header/detail:dock | Header: Top from headerSpec and safe top; current receipt bounded below by authored minimum; Footer/end: Footer bottom + height + content gap; full-height detail Scroll; Rail: None |
| BookDirectoryPage | BookDirectoryPage.refreshGeometry | mounted + measurementKey; invalidateFrame; current-generation mangaHeader; separate admittedIdentity/font generation for async work | Header: Safe top + headerSafeGap + current header height; tools height contributes content gap; Footer/end: mangaListBottomClearance; ReaderDirectoryNavigationSurface receives one scroll layout; Rail: None |
| ReaderFullDirectory | ReaderFullDirectory.refreshGeometry | mounted + measurementKey; readForGeneration fullDirectory:header; book/open/layout inputs invalidate | Header: topBarTop/insets + current measured header + panelGap; Footer/end: No separate scroll end budget at Scaffold; directory panel consumes available native height; Rail: No main rail; expanded right-aligned panel remains one directory owner |
| SharedDownloadPage | SharedDownloadPage.pageGeometry | Environment-keyed readForGeneration; store cleared on mount/retire; header callback captures presentation/window/detail/managing; dock receipt checks exact raisedDockShapeIdentity | Header: PageBackBar owns measured height; headerTop is inside fixed header material once; Footer/end: contentBottom includes dock/safe clearance; inline overflow puts chrome in flow and resolver zeroes overlay insets; Rail: No main rail; dock inset is local bounded rail |
| ReaderShell | ReadingExperience text layout or MangaReadingSurface manga layout | Inner reader owns source/book/session, layout/viewport generation and retained actor identity | Header: No scaffold header slot; reading/control chrome belongs inner reader; Footer/end: No scaffold insets; inner reader owns complete frame; Rail: No app navigation rail |
| SyncSurface | Centered pending configuration placeholder, then SyncPage→StandardPage when ready | presentation.ready/operations(identity) switch controls business ownership; no asynchronous size receipts | Header: No header slot in pending branch; Footer/end: Full-frame centered placeholder, no scrolling or budgets; Rail: None |

ReaderShell 的空几何只用于保留的全帧阅读 actor；正文和阅读 chrome 由内层阅读布局拥有。SyncSurface 的空几何只用于未 ready 的居中配置占位；ready 后进入 SyncPage/StandardPage。任何新增 Scaffold 固定头尾、滚动体或局部避让都必须退出空几何例外。

## StandardPage 调用

所有调用共用 StandardPage 的 mounted/measurementKey、当前代 header/footer、局部视口回执和 Scroll inset 合同。MainTabShell 只在 standardScroll 分支采用它；rail 代替底部导航占位。

| 消费者 | 分支 | variant | footer / rail |
| --- | --- | --- | --- |
| MainTabShell | standardScroll | standardPageVariant | bottomNavigation / Conditional main rail |
| SettingsShell | general | settingsGeneral | None / None |
| SettingsPage | about | settingsGeneral | None / None |
| SettingsPage | developer | settingsGeneral | None / None |
| ReaderMessagePreviewPage | build | settingsGeneral | None / None |
| RulesManagementPage | build | management | None / None |
| BookshelfManagementPage | build | management | None / None |
| BookshelfSettingsPage | build | settings | None / None |
| SourceToolsPage | build | tools | None / None |
| RssSubscriptionEditorPage | build | rssEditor | None / None |
| RssSubscriptionManagementPage | build | rssManagement | None / None |
| RssSourceFeedPage | build | rssFeed | None / None |
| RssEntryDetailPage | build | rssDetail | bottomActions; measured / None |
| SyncPage | build | sync | None / None |

书架 populated、empty、status 是互斥的正文分支，各自拥有一个 content frame；发现与 RSS 是 MainTabShell chrome 下的独立正文 owner。原直接宿主的 8 个 resolver 中，MainTabShell 已改为 chrome-only；其余 7 个、StandardPage 以及 5 个分支正文 owner 共 13 个当前消费者全部列于配套 JSON。禁用产品模块的合同记录不构成开放授权。

## 布局文件决定

16 个文件逐一检查职责和实际消费者后保留。没有一对同时具备相同变更原因和消费者集合；本次不强凑 10–12 文件。

| 文件 | 决定与理由 |
| --- | --- |
| ReaderLayoutCapability.ts | RETAIN — Index-only window capability policy; merging with frame/rendering geometry would make route composition depend on unrelated rendering roles. |
| ReaderSurfaceRectMeasurement.ets | RETAIN — SDK-native node measurement and coordinate conversion; cannot fold into pure Rect types without TS→ETS dependency. Search presentation consumes pure rect identities without SDK. |
| ReaderFixedHeaderHost.ets | RETAIN — Native measured header shared by Scaffold and external ReaderLibrarySearchSurface. Folding into Scaffold duplicates the external host or changes consumer lifecycle. |
| ReaderPageShell.ts | RETAIN — Pure standard-page variants/inset policy and Area numeric conversion consumed by many independent chrome/pages; distinct from frame rendering and resolved geometry. |
| ReaderSurfaceRect.ts | RETAIN — Pure window-space rect/owner/generation contract shared by navigation presentation, Index and search; distinct from page layout arithmetic. |
| ReaderPageGeometry.ts | RETAIN — Sole general page intent→geometry arithmetic plus explicit empty/chrome-only constructors; Scaffold consumes results and Standard authors inputs. |
| ReaderFloatingBarMetrics.ts | RETAIN — Navigation label/bar/bottom occupied-extent policy shared by navigation and many body owners; different consumer set and change cause from standard-page variants. |
| SurfaceHorizontalGeometry.ts | RETAIN — General bounded horizontal-frame algorithm used by dialogs, reading chrome and pages; cannot merge into page geometry without coupling non-page surfaces. |
| ReaderPageScrollHost.ets | RETAIN — Native Scroll inset application only; Standard owns geometry/measurements and arbitrary callers retain scroller. Keep native application separate from pure shared Scroll/List offset model. |
| ReaderMeasurements.ts | RETAIN — Reusable current-generation measurement store used by ten owners; no page-specific policy or SDK. Folding into one owner duplicates state or expands imports. |
| ReaderStandardPage.ets | RETAIN — Measured standard-page composition shared by13 files; distinct from low-level Scaffold and pure resolver. Owns mounted viewport/measurement lifecycle. |
| ReaderRaisedShape.ts | RETAIN — Pure measured material border-box validation shared by panels/chrome/download/search; distinct from page content geometry and measurement storage. |
| ReaderScrollLayout.ts | RETAIN — Pure inset projection shared by native Scroll/List/Grid/directory and source-switch callers; cannot fold into its single Scroll renderer or page geometry without coupling consumers. |
| ReaderPageScaffold.ets | RETAIN — Native common layer ordering, safe-area, header/footer measurement dispatch and visibility; owns no business geometry resolution. Unique consumer/result boundary. |
| ReaderPageNativeAttributes.ets | RETAIN — Actual ArkUI AttributeModifier classes shared by Scaffold/Header. Required ETS boundary; TypeScript re-export is forbidden by actual compiler semantics. |
| ReaderFrameStyle.ts | RETAIN — Pure resolved visual policy shared by all finite host categories and native modifiers. Keep policy DTO independent of SDK rendering. |

完整输入表达式、rail/end inset、头尾 fallback、例外开放条件及每个布局文件的实际 import 消费者见 [机器可核对宿主表](page-geometry-host-contracts-20261111.json)。
