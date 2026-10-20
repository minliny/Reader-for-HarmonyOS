# 交互接线：主要操作、取消与恢复对照（2026-10-19）

本文件是当前生产源码的只读接线审查，不是新产品规则、实现计划或动态通过记录。本轮仅创建本文；没有修改产品、运行测试／门禁、构建或操作设备。审查时 HEAD 为 `5a01ec1c`，工作树包含本任务既有修改，Index 仍由主代理整合；以下行号对应此次读取，同时保留方法名便于整合后复查。旧检查通过、旧 HAP 与设备结果不能自动转移到这批输入。

“已接线”仅表示找到了当前 UI 渲染的动作、实际调用及其业务 owner；不表示平台触摸、原生 Back、动画、文件选择、网络或持久化已在本轮动态执行。返回父级的专项对照见 [navigation-comparison.md](./navigation-comparison.md)；本文重点是按钮实际做什么，不以 Props 声明代替可达性。

## 1. 检索范围与引用索引

检索覆盖 `entry/src/main/ets/pages/Index.ets`、`app/ReaderProductScope.ts`，以及 `features/{bookshelf,search,source,settings,downloads,reading,manga,shell,common}` 中本表涉及的页面、渲染器、回调和 owner。使用 `rg` 检索组件消费者、`on…`／`.onClick`／`onAction`、入口方法、`reconcile`／`retryAccepted`／`continueOriginal`、临时层注册与 Back；对实际入口和恢复分支逐段读取。没有把全仓每一个装饰节点、内部运动采样函数或未启用扩展模块视作本轮用户操作清单。

下面短名都以仓库绝对路径 `/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/` 为根，表内 `短名:行` 是精确源码证据，不是测试用例编号。

| 短名 | 源文件 |
| --- | --- |
| I | `entry/src/main/ets/pages/Index.ets` |
| Scope | `entry/src/main/ets/app/ReaderProductScope.ts` |
| Shelf | `entry/src/main/ets/features/bookshelf/BookshelfPage.ets` |
| ShelfShell / More | `entry/src/main/ets/features/bookshelf/BookshelfShell.ets` / `BookshelfMoreMenu.ets` |
| Multi / Group / LocalImport | `entry/src/main/ets/features/bookshelf/BookshelfMultiSelectPage.ets` / `BookshelfGroupSelector.ets` / `LocalImportDialog.ets` |
| ShelfSettings / ModeHost | `entry/src/main/ets/features/bookshelf/BookshelfSettingsPage.ets` / `BookshelfViewModeHost.ts` |
| ShelfOps | `entry/src/main/ets/features/bookshelf/BookshelfOperationOwner.ts` |
| Detail | `entry/src/main/ets/features/bookshelf/LocalBookDetail.ets` |
| Search / SearchOwner | `entry/src/main/ets/features/search/SearchPage.ets` / `SearchOrchestrator.ets` |
| Source / SourceOwner | `entry/src/main/ets/features/source/SourceManagementPage.ets` / `SourceOrchestrator.ets` |
| Tools / ToolsOwner | `entry/src/main/ets/features/source/SourceToolsPage.ets` / `SourceToolsOrchestrator.ets` |
| RulesOwner | `entry/src/main/ets/features/settings/RulesMutationOwner.ts` |
| Settings / SettingsOwner | `entry/src/main/ets/features/settings/SettingsPage.ets` / `SettingsOrchestrator.ets` |
| CacheOwner | `entry/src/main/ets/features/settings/SettingsCacheCleanupOwner.ts` |
| Downloads / DownloadHost | `entry/src/main/ets/features/downloads/SharedDownloadPage.ets` / `SharedDownloadHost.ts` |
| DownloadProjection | `entry/src/main/ets/features/downloads/SharedDownloadProjection.ts` |
| ReaderShell | `entry/src/main/ets/features/shell/ReaderShell.ets` |
| Reading / Controls | `entry/src/main/ets/features/reading/LocalReadingExperience.ets` / `ReaderControlPanel.ets` |
| Replace | `entry/src/main/ets/features/reading/ReaderControlReplaceContent.ets` |
| FullDirectory / FullPanel | `entry/src/main/ets/features/reading/ReaderFullDirectory.ets` / `FullDirectoryPanel.ets` |
| Manga | `entry/src/main/ets/features/manga/MangaReadingSurface.ets` |

## 2. 当前产品准入与入口事实

`Scope:17–28` 固定 `l0`；只有书架、设置两个主 tab 直接准入（`Scope:31–41`）。本轮找到实际可见入口的路由家族为：书架、书架设置、书架多选、搜索、书源管理、书源工具、设置、下载管理、详情、目录、阅读器。普通读取失败、空态、待处理提醒和 native／自绘临时层属于这些页面的状态，不另算产品路由。

两条没有被 L0 明确禁用、但本次未找到当前可见产品入口的保留分支，不能混入上述按钮覆盖率：

| 保留分支 | 实际证据与边界 |
| --- | --- |
| `bookshelfManagement` 完整分组管理页 | `I:2619 openBookshelfManagement` 只有定义；More 的真实数组是 `batch/import/update/downloads/settings`（`More:149–161`），其中 batch 接 `openBookshelfMultiSelect`，不是完整管理页。独立管理页的名称／排序／新建／保存／显示／删除／分配／核对／继续 callbacks 仍在 `I:2519–2536`；**可达的单书“编辑分组”另见下表**。 |
| `rulesManagement` 独立规则管理页 | `Settings:122`、`Controls:350` 有 `onOpenRulesManagement` 声明，Index 也有对应 callback，但 Settings 当前可见行 `Settings:190–205` 不调用它。阅读替换的“完整管理”由 `Replace:436 → Controls:1462–1465` 展开同一 control actor；没有调用独立路由 callback。`Reading:2413/11013–11018` 的传入／方法链仍被保留，不能据此声称有可见入口。 |

## 3. 书架、更多、单书操作与导入

| 当前 UI 动作 | 实际 callback → owner／效果 | 返回、取消、失败恢复及状态边界 | 源码证据 |
| --- | --- | --- | --- |
| 继续阅读卡／书籍封面打开 | `onItemClick → openShelfBook`；Index 的 ReadingEntry admission 决定本地／远程、目录和 reader。可见书籍通知进入 `prepareVisibleReadingBooks`，是预热，不是另一次用户打开。 | 捕获 navigation／Runtime／mount；阅读准备或 active reader 不允许叠加打开。返回交 Index 原 reading context，不能从封面事件猜写入成功。 | `I:996–1019 bookshelfContent`；`Shelf:865–871` |
| 封面／列表、筛选展开、筛选 chips、清除全部条件、分页 | 封面／列表 `setViewMode → ModeHost.save`；筛选展开纯本地 State；筛选变化 `onFilterRequested → Index 更新 filter/anchor → refreshBookshelf`；分页走原 catalog owner。 | 外形模式是持久设置，不能当普通显示切换无写入；筛选／分页是读。筛选空态的“清除全部条件”不会删书。 | `Shelf:570–598`；`I:995–1006`；`ModeHost:65–118` |
| 搜索、顶部设置、主 tab | Shell／Page callbacks → `openSearch/openSettings`；书架 tab 当前页行为由 Shell，发现／RSS tab 查产品准入。 | route 回程由 Index；禁用 tab 不是空 callback。 | `I:1007/1074–1089`；`Scope:31–41` |
| 更多：批量管理／本地导入／检查更新／下载管理／书架设置 | `More.performMenuAction → commitAction`，Shell 捕获 opening identity；Index 分别 `openBookshelfMultiSelect/openImportDialog/startManualBookshelfUpdate/openDownloads/openBookshelfSettings`。 | 菜单先以本 opening 关闭并只派发一次；检查更新无在线书、手动或后台检查中不可再派发。关闭菜单不取消更新。**下载管理是本轮新增真实透传，不只菜单文字。** | `More:149–174/245`；`ShelfShell:191–215`；`I:1073–1085/7173` |
| 长按书籍：多选／编辑分组／书籍信息／移出书架 | `BookshelfBookActionSheet → ReaderSheetActionList → Shelf.performBookAction → Index`，分别进入多选、单书分组、详情或移除确认。 | native Sheet 独立 visible 与原 book context；动作保存到 pending callback，native `onDisappear → finishBookActionSheet` 后才派发；旧 presentation／实体不准入，不能用当前新书替代原 target。 | `Shelf:366–428/1042–1073`；`I:1015–1018` |
| 多选：选择／取消选择／全选／取消／移除所选 | 选择本地；移除经 Index `requestRemoveShelfBooks → BookRemovalDialog → ShelfOps.remove(targets,true)`。 | UI 取消和全选均要求 `!busy && ready`；系统 Back 在批量移除 busy 时留页。确认再次检查 route／busy；unknown 原写挡新删除。 | `Multi:108–145/214/242`；`I:1201–1208/922–926/4912–4938` |
| 单书分组：选择默认分组、关闭、核对、继续原分组操作 | 可见 selector 只派发 `assignShelfDefaultGroup → BookshelfHost.assignDefaultGroup`；核对 → `reconcileManagement`；继续 → `continueOriginalManagement`。 | 可继续必须同 method=`bookshelf.group.assign`、source/book、目标空 group、generation，非 busy。confirmed 且不 blocked 即关闭；confirmed 列表刷新失败给短反馈后关闭，不能再次保存冒充刷新。关闭只退役 UI，不撤销派发写。 | `I:2202–2253/2258–2329` |
| 移除确认：取消／确认 | 取消只 `dismissBookRemovalDialog`；确认先取得并清除原 action，再执行。单本／批量由 `BookshelfHost.operations(owner).remove` 持久化。 | 本地书／远程书的删除影响不同，文案和 target 各自保留。确认重查实体、route、busy 和 unknown 屏障；不是点击“移除”就直接删。 | `I:4853–4925/4939–4954` |
| 本地导入：选文件／关闭／结果关闭／核对 | `LocalImportDialog → onSelectFiles → beginImport → ShelfOps.importFiles`；关闭走 `ShelfOps.closeImport`；核对走 `reconcileShelfWrite`。 | pickerOpening/importing/result 属原 import presentation。关闭展示不取消已经开始的导入；unknown 禁止重新选文件重发。confirmed 普通读回失败使用短反馈；原未知／恢复未确认独立保留。不是打开一次导入就开始写。 | `I:1103–1118/7195–7239`；`ShelfOps:60–76/138–172` |
| 首次读取失败／旧列表刷新失败／原写待处理 | 首次读取与旧内容纯读重试分别经 catalog owner；原操作“核对” → `ShelfOps.reconcile`；明确“继续” → `continueRemoval`。 | `shelfRecovery` 只保留 unknown 或 blocked 原写；confirmed 普通 readback 不常驻。核对先历史回执／列表读，不删内容；只有显式继续且 owner 准入才 `recover(...,true)`。 | `I:4987–5029/7035`；`ShelfOps:138–214` |

## 4. 搜索与书源管理

| 当前 UI 动作 | 实际 callback → owner／效果 | 返回、取消与失败恢复边界 | 源码证据 |
| --- | --- | --- | --- |
| 搜索输入提交／搜索按钮／历史词 | `Search.submitSearch → onSearch → Index.performSearch → SearchHost.search → SearchOwner.search`；历史词写入输入再走同一 submit。 | 新提交创建 navigation journey；空／没有可用自定义来源不会盲发。搜索按钮在 live sweep 时改为“停止”，不是创建第二条 query。 | `Search:558–579/671–704/797–798`；`I:1165–1170/3936–3945` |
| 停止／重试失败来源／重新搜索 | `onStop → SearchHost.stop`；重试 → `SearchHost.retry → SearchOwner.retry`。 | 停止保留已得结果和 session；retry 对保留 run 的失败／未完成部分续跑，确定空态的“新搜索”可发新 query。不是所有 retry 都从头清空。搜索采集不等于加入书架。 | `Search:991–1030/1487–1489`；`SearchOwner:322/388–425` |
| 结果来源范围／内容类型 chips、列表滚动、结果卡 | chips 仅筛选本 search session；结果卡 `onSelectResult → Index.onSearchResultSelected` admission，保留 variants／cover；可见组只调预热。 | 筛选不发新搜索，不把本地空态当书源读取失败；选卡到详情／reader，Back 回原 SearchHost publication。 | `Search:360/825–910/1063/1726`；`I:1171–1177/4045` |
| 清空记录／历史读取重试 | `onClearHistory → Index.clearSearchHistory → SearchOwner.clearHistory → loadEntryHistory(true)`；retryHistory 是历史读取。 | 清历史是明确写／清理意图，并结束现 sweep；不能与普通返回恢复混为一类。历史读取失败不应清已得来源判定。 | `Search:787–799`；`I:1169–1170/3998–4002`；`SearchOwner:244/615–626` |
| 缺书源／错误页“检查书源”、返回 | `onManageSources → manageSourcesFromSearch → openSourceManagement('search',keyword)`；Back → bookshelf。 | 普通 Source Back 刷新 source snapshot／resume 原 query；导入后的明确“用新书源搜索”才自动搜索。 | `Search:1346–1429/1489`；`I:1178/2887/2964–2990/3203–3233` |
| Source 搜索／状态／分类／分组筛选 | Page 本地 query/filter 与 `rebuildSourceProjection`，不是 source mutation；分组下拉 captured selection identity。 | 关闭分组留 Source；Source→Tools→Back 重挂会重置本地筛选，事实确定、保留要求尚未完整约定，见 §9。 | `Source:120–129/180/286–290/461–515` |
| Source 新增书源／本地文件／在线 URL／导入结果动作 | `onAddSource → Index.openJsonImport('bookSource')`；dialog 提交 → `SourceHost.importBookSources`；导入结果可带 Search 显式后续 action。 | 关闭 JSON 表单不导入；提交后才退表单并交 host。回调捕获 Runtime/nav/mount/Source presentation；导入结果普通 readback 失败不改成重新导入。 | `Source:304`；`I:2486/3019–3044/3082–3133/3203–3233` |
| Source 每行：检测／登录／启停 | Page → SourceHost → SourceOwner 的 `checkSource/loginSource/toggleSource`；登录交 Runtime 的平台 Web 宿主，启停经既有 source 持久 owner。 | 检测中禁重复检测；启停用真实原操作屏障，不从圆点猜事务；登录完成后的采集仍由原 session 检查，未在本轮验证 Web Back／IME。 | `Source:643–687`；`I:2481–2485`；`SourceOwner:238/256/278` |
| Source 工具／Back／首次读取重试／刷新列表／核对／继续 | 工具进入 SourceTools；Back 按 settings/search 来源分流；read retry → SourceOwner.load；pending 核对 → recoverOriginal(false)，继续 → recoverOriginal(true)。 | 普通刷新只核对原回执／读列表；canRetryOriginal 需原 owner 明确开放，不由“有错误”推断。未知与 blocked 不能用列表相同清除。 | `Source:346–365/539–565`；`I:2465–2488/2964–2990`；`SourceOwner:151–195` |

## 5. 书源工具的全部主要动作

| 当前 UI 动作 | 实际 callback → owner | 取消／恢复／数据边界 | 源码证据 |
| --- | --- | --- | --- |
| 选择／全选／清空 | Index → `ToolsOwner.toggleSelection/selectAll/setSelection([])`。 | 只是选择；批量写再次 `consumeSelection`，不直接相信旧 UI 数组。 | `Tools:276–282/597–600`；`I:2423–2428` |
| 导出所选／导出全部 | 页面先“导出含登录凭据”确认 → Index → `exportSelected/exportAll` → Core JSON 与系统文件保存。 | 取消不导出；本轮未验证平台 picker、权限、取消回执。不能把文件保存和数据库写混为同一事实。 | `Tools:279–282/525–535/760`；`I:2427–2428`；`ToolsOwner:224/258` |
| 检测所选／停止检测、关键词／检测模式／深度、单源调试 | Index → `checkSelected/stopCheckSelected/updateDebugKey/updateCheckSelection/debugSource`。 | 检测任务有 running/stopping 事实；“停止”不是回滚已完成检测；关键词与参数草稿本身不更新书源正文。 | `Tools:285–292/597–600/648–661`；`I:2429–2430/2440–2444` |
| 批量启用／停用／删除 | Index → `setSelectedEnabled`；删除先 `requestSourceDelete` 原生确认，再 `deleteSelected(selection)`。 | 确认保存 listRevision/selectionRevision；旧确认、列表／选择变化不能删除新目标。取消空 action。写操作进入 RulesMutationOwner 原操作体系。 | `Tools:294–302`；`I:2431–2434/3236–3268`；`ToolsOwner:455` |
| 编辑／修改 JSON／取消／校验并保存 | `openEditor/updateEditorDraft/cancelEditor/saveEditor`；正文由 Core 校验持久化。 | unknown 或 original.blocked 时取消／新保存受阻；不是保存失败就丢输入。保存后普通 readback 走刷新，不重新导入。普通离开 Tools 的草稿保留规则尚未冻结，见 §9。 | `Tools:599/609–621`；`I:2435–2439`；`ToolsOwner:500–509` |
| 原操作核对／继续、编辑读回失败恢复、列表读取失败重试 | Index → `ToolsOwner.reconcile/continueOriginal/reconcileEditor`。 | reconcile 原 blocked 时 `recoverOriginalSource(false)`；显式继续且 canRetryOriginal 才 true。普通 receipt/readFacts 重试 `reloadManagement`，不重做启停／删除／导入。 | `Tools:476–513`；`ToolsOwner:759–815` |

原书源删除的精确限制在 `RulesOwner:221–271`：family／operationId／DTO 准入，查精确回执；无回执时须 head 与原 sequence 相邻才开放继续，只有 retryOriginal=true 才 apply 原记录；applied 后还要完成必要 source cleanup 才清 terminal。**纯核对可能继续已证实 applied 的清理阶段；它不能重新发送未知 Core 删除。**因此也不能笼统称所有“核对”绝对无任何副作用，更不能说普通列表刷新等于删除确认。

## 6. 设置与书架设置

| 当前 UI 动作 | 实际 callback → owner | 返回／取消／恢复边界 | 源码证据 |
| --- | --- | --- | --- |
| 首页：通用设置／书源管理／书架设置／下载管理／书架 tab | General 是同路由 section；其余 Index 路由入口。 | General 顶栏／系统 Back 先回 Home；Home 再回 bookshelf。ShelfSettings 保存 bookshelf/settings 原父级。 | `Settings:190–216`；`I:2372–2404/2192–2201/928–939` |
| App 主题（日／夜／系统） | Settings 本地 theme action → `AppThemeController`；不是 `onToggle` 的布尔设置。 | 写前后仍有原 Runtime/context guard，不能凭预览色推定持久成功；本轮未动态执行。 | `Settings:506–565` |
| 自动检查更新／减少动态效果／开发者模式 | `onToggle → Index → SettingsHost.toggle → SettingsOwner.toggle`。书架设置里的自动检查更新用同一 Host。 | 原 canonical／原 accepted snapshot 由 owner 保留，Page 退役不取消持久写。原未知通过 pending 处理，不允许普通 retry 冒充纯读。 | `Settings:368–379`；`I:2355–2358/2402–2403`；`SettingsOwner:136` |
| 恢复默认：取消／恢复 | 页面 native confirmation → `onRestoreDefaults → SettingsOwner.restoreDefaults → LocalConfigurationReset.request`。 | 文案明确恢复界面与阅读设置、保留书籍／来源／进度／书签／凭据。取消不写；readback 失败不能被当成未派发重新创建一次恢复。 | `Settings:775–834`；`I:2381`；`SettingsOwner:175–197` |
| 设置读取失败重试／核对设置／重试保存当前设置 | `onReconcile → SettingsOwner.reconcile` 与 `onRetryAccepted → retryAccepted` 是不同 callback。 | reconcile 只 reload；retryAccepted 才明确重交保留完整 settings snapshot，受 generation、queuedWrites、retrying 和 canRetryAccepted 约束。不能用同一句“重试”概括为无写入。 | `I:2347–2353/2385–2389`；`SettingsOwner:200–234` |
| 缓存清理：取消／清理／核对／继续原清理 | native confirm → Index.clearTextCache → SettingsHost.clearCache；pending 主／次动作分别走 reconcileCacheCleanup／continueOriginalCacheCleanup。 | unknown 时重复点击清理不派发新 clear；打开/刷新只查原回执；继续必须原 generation 且 owner canContinueOriginal。保留下载、受保护内容、书籍／阅读数据。 | `Settings:592–643`；`I:2391–2392/2746–2763`；`CacheOwner:45–84` |
| 书架显示方式：封面／列表／读取重试／核对显示方式 | Page 直接用 `ModeHost.load/save/reconcile`，不是 SettingsHost.toggle。 | save 有 store context／Runtime／revision 与 serialized tail；核对只重新 loadBookshelfViewMode(false)，保留 receipt.confirmation，不根据读回同值把 unknown 改 confirmed。完全冷 Host 的 Store 已知 canonical 初值已纳入当前源码；本轮不继承先前生命周期测试结果。 | `ShelfSettings:155–199/210–260`；`ModeHost:65–148` |

## 7. 详情、独立目录与阅读操作

| 当前 UI 家族／主要动作 | 实际接线／业务归属 | 返回、取消及失败恢复边界 | 源码证据 |
| --- | --- | --- | --- |
| 详情：继续阅读／章节项／打开目录／切换书源／加入或移出／取消加入／Back；简介展开 | 阅读／章节 → `openReading`；目录 → `openFullDirectory`；换源 → SourceSwitchHost；书架变更 → ReadingEntry/Bookshelf admission；简介是本地展开。 | target／Runtime／presentation 再检查；busy、未知写和换源阶段限制移除；取消加入是原 admission 的取消流程，不能假定已加入被回滚。来自 reader 的信息详情与 Search/shelf 父级分别保存。 | `Detail:243/366/433/456/515–620`；`I:1643–1681/4700` |
| 外部目录：查询／清空、章节／书签选择、书签选择与删除／章节起点书签、目录重试、下载单章／全书／清理离线、换源、退出 | `BookDirectoryPage/ReaderFullDirectory → Index`；章节带 navigation proof；书签 → ReaderDirectoryHost；离线 → ReadingOfflineHost；目录 retry → ReadingEntryHost；全书下载可进入 Downloads。 | bookmark/offline 核对与 continue 分别传 false/true；原 book＋presentation 身份；目录 retry 是加载事实，不重放书签写。详情目录、reading-control Full 目录来源不同，不替换 reading owner。 | `I:1687–1758/4500/4553/5239/5643–5662`；`FullDirectory:166–232`；`FullPanel:428–454/795` |
| 小说 controls：首页／目录／搜索／替换／自动翻页／外观／阅读设置／朗读模块；收起／展开／完成 | `Controls` 语义 session 自身切模块；`onPageChange → Reading.setControlPage`；顶部退出与收起分开。 | “完整管理／展开”多为原 actor Quick→Full，不是独立页面。Back 按 §8 层级退；顶部箭头直接 beginExit，有意不同。`onModuleSelect` 在 Reading 中是保留空 callback，当前模块选择不依赖该声明。 | `Reading:2357–2371`；`Controls:1461–1465` |
| 小说更多：书籍信息／刷新本章／下载全部章节；更换书源 | More actual menu → `onOpenBookInfo/onRefreshChapter/onDownloadBook`；Reading 刷章与 download request；换源先 hideControl，再 Index callback。 | 输入／obscured／chapterRefreshEnabled／bookDownloadEnabled 再准入；更多先关闭。信息/下载导航经 Index serialized reader exit，不把当前 route 推为永久父级。 | `Controls:1045–1052/1080–1102`；`Reading:2360–2369/11561`；`I:1320/1340–1356` |
| 小说章节前后／进度拖动、目录章节／书签、亮度调节／自动／取消 | callbacks → `stepControlChapter/seekControlProgress/selectControlChapter/selectBookmarkAnchor`；亮度→平台 adapter。 | 章节跳转与进度提交由同 reader gateway/actor；亮度取消回原平台亮度，不写书架位置。UI 值不替代 confirmed progress。 | `Reading:2372–2388` |
| 小说全文搜索：输入／搜索／加载更多／选择结果 | callbacks → `updateQuickSearchQuery/runQuickSearch/loadMoreQuickSearch/selectSearchResult`。 | 是当前书内容检索，与全局 SearchHost 分开；结果锚点仍由当前 reader 保护。未在本轮验证真实大书语料和滚动恢复。 | `Reading:2390–2393/11414–11439` |
| 小说替换：开关／新增／编辑／保存／删除确认／导入确认／导出／预览／重试预览／原操作恢复 | `Replace → Controls → Reading` 的 `save/toggle/delete/import/export/previewControlReplace` → ReaderReplaceQuickGateway 与 RulesMutationOwner。 | 临时 editor/delete/import-confirm/preview 保留 presentationRevision；关闭不是回滚写。原操作恢复 `reloadControlReplace(true,expectedOperationId)`：若 owner.canRetryOriginal=true 会继续原写，否则纯查原记录再 load；UI 用 state.recoveryLabel，不能把此恢复等同普通读重试。 | `Replace:191–218/286/364–388/444–447/517/592`；`Controls:1467–1473`；`Reading:2403–2415/10843–10878/10945–11010` |
| 小说自动翻页：启停／速度／定时／跟随 | Reading AutoPageCoordinator；启动与 TTS 互斥通过真实 session/coordinator 处理。 | 停止自动翻页不退出书；pending start／page-turn generation 保护旧 callback，不把动画结束当持久位置确认。 | `Reading:2394–2402/8882–8990` |
| 小说外观／阅读设置：日夜主题／字体／排序／导入字体／缩进／对齐／字号等 metrics、繁简、开关／方向／超时／翻页方式 | Reading → ReaderAppearanceGateway／ReaderSettingsGateway／繁简原操作 gateway；实际 callbacks 全部在同 reader。 | 写入与排版稳定、位置 handoff 分开；未知偏好恢复由 gateway 原事实决定，不能从预览恢复成功推定保存成功。自定义字体文件 picker 属平台边界。 | `Reading:2416–2442/9313–9380/9471–9589/9685–9868` |
| 小说朗读：播放暂停／停止／上下一段／seek／速率／定时／跟随／中断／混音／后台／常亮／失败策略／语言声音／试听停止／引擎／HTTP引擎保存删除 | Reading → 原 TTS coordinator、Runtime TTS Host 和设置 gateway；不是 Index 逐按钮重新建立 reader。 | 试听与正式朗读不同 session；退出／引擎变更和写事实保留各自 guard。音频焦点、后台权限和真实服务响应本轮未动态验证。 | `Reading:2443–2463/8622–8781` |
| 漫画：目录／选话／前后话／当前进度／返回、更多：换源／重新打开本话或卷／详情／下载本话或全书／下载管理／加移书架 | Manga controller 持有章节／阅读位置；ReaderShell 按 readingIdentity 向 Index 传选话、download、detail、shelf、switch。More 检查 mounted/exiting/identity/opening generation/panelPhase 与 action.enabled 后关闭再执行。 | refresh 在 offline／未打开／正在刷新时禁用；download本话需真实 opened/current index。书架操作仍经 Index 确认/admission；More 关闭不等于执行成功。 | `Manga:2610–2616/2697–2750`；`ReaderShell:409–458`；`I:1254–1356` |
| 漫画模式／适配／底色／亮度／常驻页码／恢复默认、下载操作面板／重试 | Manga 本地受控 presentation＋原偏好 gateway；下载面板 `onLoadDownloadActions/onDownloadAction` → Index 与 Runtime 原下载能力。 | loading／error 属真实 load actions Promise；不能把多图片失败数当书源不可用。默认恢复是偏好写，不等于重载整书。原位重试／图片状态另属阅读局部状态，未做设备效果结论。 | `Manga:885/1836–1904/2619–2684/2366`；`ReaderShell:422–427` |
| 换源：关闭／重新搜索／停止／重试／选候选／预览／canonical／rollback／漫画选话取消 | SourceSwitchHost 和 gateway 持有原 scope/lease；Index `sourceSwitchHost` callbacks + reading context admission。 | 状态可能阻止退出；关闭不回滚 committed 原事务；selected candidate、目标首屏、canonical 读回和导航恢复是不同阶段。旧 scope callback 不准入新 panel。导航 parent 组合修补的状态以 navigation 文档为准，本轮未执行换源网络或故障分支。 | `I:858–863/1260–1271/1356–1361/5665–5708`；`ReaderShell:393–398` |

## 8. 下载管理：从入口到原业务动作

| 当前 UI 动作 | 实际接线／效果 | 取消、返回和失败边界 | 源码证据 |
| --- | --- | --- | --- |
| 搜索／内容类型／筛选／排序／升降序／清除搜索 | Page 本地 view state／投影过滤；选项表单不派发下载。 | 条件变化按本地规则清选择；保存 view state 与业务队列分开。 | `Downloads:380–445/1649` |
| 点书进入章节／管理／退出管理／选择／全选／快速选择／定位当前 | `openBook → onOpenBook → DownloadHost.refreshBook`；管理与选择本地；当前章节统一用 `currentDownloadReadingChapterIndex`。 | current 需真实 readingPosition，或满足 manga lastReadAt 的合法 mapped index，且章节 navigable；下载进度不推断阅读位置。manage 切换保原 scroll anchor；未确认章节不标“当前阅读”、定位禁用。 | `Downloads:603/688–694/793–827/1555–1601/1687–1693/1787`；`I:2070–2073` |
| 点已下载章节／阅读入口 | `showReadTarget → describeDownloadReadingTarget → onReadTarget → Index.openDownloadReadingTarget`。 | 当前 projection/实体/目录ID/navigable 再验证；同cached catalog admission，不先显示 read Sheet。离开前 publish list/chapter scroll；不能仅凭“已下载”文字打开过期 chapter ID。 | `Downloads:687/715/1739–1750`；`I:2074–2076/2119–2163` |
| 状态短动作“重试”／下载／暂停；单书／单章更多；所选下载／暂停／更多 | Page 保原 target／enabled/once；失败按钮先打开下载范围，不立即重发；范围确认→`commitDownloadRange`；直接动作→`sendAction → onIntent → Index.markDownloadIntentPending → DownloadHost.runAction`。 | 确认范围后才是显式下载意图，**不是纯读**；失败说明 `downloadError` 与 metadata `projectionError` 分开。actionAvailable 要 ready/navigable/队列事实；只改 caption 不创造业务恢复。Host再次复验ready和精确章节索引／ID。 | `Downloads:530/569–585/809–827/1053–1077/1722–1729/1760–1785`；`DownloadHost:204/259–296`；`I:2078–2115` |
| 取消下载／删除本地内容：打开确认／取消／确认 | 更多先记录所选 target，confirm 后 `sendAction(cancel/deleteLocal)`。 | 取消确认只清 confirmation；取消任务保留已下载内容，deleteLocal 的范围另有文案；不同于移出书架。旧 presentation callback 不借新目标。 | `Downloads:1076–1077/1265–1335` |
| 存储设置／缓存上限／保留天数／保存、清理自动保存确认 | Page drafts → `configureStorage`；清理要 capacity事实→confirmation→`sendAction(cleanup)`→Index.clearDownloadRebuildableCache。 | 无 cleanable 事实不能清；保留下载、active reading/download protection。cleanup 属明确 destructive cache action；普通刷新不调用 cleanup。 | `Downloads:1081–1112/1177–1194/1344–1349`；`I:2166–2185` |
| 首次读取重试／metadata读取重试／动作后列表刷新 | `onRefresh → DownloadHost.reload`；单书metadata `onOpenBook → refreshBook`；runAction 成功后 reload。 | 持久动作已成功但 reload 失败时专门显示“下载状态已保存，列表刷新失败”，不是重新派发 runAction；用户下一次明确下载重试才新意图。 | `Downloads:340/625`；`I:2066–2073/2101–2115` |
| 顶栏／系统 Back | Page `consumeBack`：确认→Sheet→managing→chapters→books→Index.onBack。 | 内层 Back 留 Downloads；到最外层才交 Index 原父级。操作浮层 opening/closing 用实际 animation finish 持有chrome；收起不取消任务。保存 view state不代表已验证首帧无闪动。 | `Downloads:1398–1435/1564–1581`；`I:2056–2064/1917–2040` |

## 9. 临时层 Back、原操作恢复与当前待确认项

### 已在源码确认的共同边界

1. Index `onBackPress` 顺序为：漫画换源选话 → 移除确认 → JSON导入 → 换源 → 本地导入 → 单书分组 → leaf temporary bridge → route（`I:845–978`）。不能把 route Back 放在这些层前面。native Sheet／Alert／系统文件 picker 也可能先由平台消费，本文没有平台顺序证据。
2. `registerTemporaryBackBridge/consumeTemporaryBackBridge` 同查 Runtime、navigation、scope、leaf identity；旧注销只清原 lease；close 抛错会消费 Back 留原页，而不是假定已关层（`I:2801–2834`）。
3. 小说系统 Back：真实 keyboard inset → control temporary layer → control session退层 → beginExit（`Reading:6702–6719`）；顶部退出箭头直接 beginExit（`Reading:2357–2359`）。漫画普通 Back：章边界取消 → panel → chapterEnd → zoom → controller.close → onBack；navigation intent 可跳过普通退层（`Manga:1022–1042`）。这些差别是现有意图，不能为了“统一”擅自改成一条动作。
4. Page close／presentation retire 不等于 cancel durable operation。核对、继续原操作、重试 accepted snapshot、重新下载、读取重试有不同写入边界；上表没有将所有恢复按钮归为只读。

### 确认事实、规则缺口和未验证项

| 编号 | 当前结论 | 分类／处理边界 |
| --- | --- | --- |
| ACT-01 | 完整 BookshelfManagement、独立 RulesManagement 有接线但没有当前 visible 入口；读控制 Full replace 不跳独立 Rules route。 | **源码确定的可达性差异**。不计为启用按钮动态覆盖，也不自动开放它们；需产品明确是否应有入口。 |
| ACT-02 | Source 页面筛选是 local State；Tools 来回会重挂Source。Tools.open 在没有 pending/unknown 时重置普通 snapshot，包含普通 draft/selection。 | **代码确定，保留规则待明确**。原操作屏障仍保留；没有证据把普通 Back 定义成用户同意丢草稿，也没有擅改owner保存策略。`Source:120–129`、`ToolsOwner:189–220`、`I:2923–2932`。 |
| ACT-03 | 已确认书架／分组／下载写后的普通 readback失败走短反馈或读入口；unknown/blocked继续由原owner恢复。 | **源码分流已核对**。不是所有失败都常驻，更不是所有短反馈都能替代未决入口。§3、§8为实际路径；故障与旧回调交错没有在本轮执行。 |
| ACT-04 | 下载的“请稍后重试”原来来自任意 job.error 被当成stateLabel；当前Host有限状态与独立downloadError、UI短“重试”分离；读取元数据失败仍走refreshBook。 | **本任务既有源码修补，当前静态接线确认**。未执行新测试／HAP／设备，不宣称用户已验收caption、行高或状态实时更新。 |
| ACT-05 | 从下载进入阅读的target、当前阅读标签、定位／向后范围均消费同一reading fact；不以下载完成数推阅读章节。 | **本任务既有源码修补，当前静态接线确认**。真实读回时序、返回scroll首帧尚未动态证明。 |
| ACT-06 | reader信息、详情目录、downloads及换源canonical/preview/rollback存在嵌套父级组合，Index由主代理用有限context统一补齐。 | **整合中**。本文不冻结另一writer的未完成输入；具体问题与修后边界见 navigation文档，不把静态parent保存当全链动态通过。 |
| ACT-07 | 原生Alert/Sheet、IME、系统文件选择／导出、登录Web、TTS后台、平台窗口chrome与动画finish依赖原生调度。 | **本轮未验证**。源码guard存在不证明触摸不串层、动画不闪、平台取消与回调顺序正确；不因此新增设备任务或改产品规则。 |

## 10. L0 关闭的动作家族（不混入在用覆盖率）

| 关闭家族 | 当前门禁／保留内容 |
| --- | --- |
| Discover | `Scope:12/23–28`；Index open与dispatcher均门禁，分类／换一批／发现内容操作不列入本轮已启用按钮。 |
| RSS：列表、订阅管理／编辑、SourceFeed、EntryDetail | `Scope:13/23–28`；共五条保留路由。订阅导入导出／启停／删除／刷新／阅读原文／原操作恢复仍保留源码，不能据callback存在称可用。 |
| Sync与备份 | `Scope:14/23–28`；Settings入口门禁；Index.onSync…再次检查surface（`I:2766–2788`）。配置保存／连接测试／备份恢复／清理旧备份的保留事务不在本轮开启。 |
| unimplementedSettings | Settings语言／启动页／点击当前底栏回顶／崩溃日志／动画选项／系统权限卡／关于反馈受门禁（`Settings:197–203/212–214/359–376`）。其静态文案、空action或平台设置占位不得计为实际完成。 |

本文记录的是有限静态接线和待确认边界；没有“所有交互动态通过”的结论。最终生产输入、相应本地验证、HAP身份、平台交互与用户接受需分别记账。
