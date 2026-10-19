# 原工作流与当前交互接线对照

本分册对照 [2026-10-02 工作流登记](../../../../evidence/2026-10-02-complete-app-architecture/workflow-registry.json) 及其 [WORKFLOWS_AND_COVERAGE.md](../../../../evidence/2026-10-02-complete-app-architecture/WORKFLOWS_AND_COVERAGE.md)，补充本轮直接读取的当前生产入口、任务 owner、返回和失败恢复接线。原有 **28 个工作流 ID、211 个步骤**保持原样；没有把旧 `implemented`、旧评估或本轮源码存在升级为交互通过。

本轮是文档及静态接线核对，没有逐一重验 211 步，没有执行测试、门禁、构建或设备操作。当前修复的产物、设备和用户验收由主记录分别记账。本文件不修改原登记的统计、旧结论或验收状态。

## 判定含义

- **已核定**：仅指此处明确列出的当前入口、回调、owner 或返回分支已在生产源码中找到并追踪；不表示整个工作流通过。
- **规则缺失**：既有工作流没有明确覆盖当前已开放的旅程或上下文；需要补入交互规则，并不直接证明当前代码错误。
- **代码偏差**：有明确的规则、事实或用户目标与实现不符；区分本轮已改源码与仍未交互确认。
- **仅历史待查**：旧文档有要求或旧证据，本轮没有追踪到足以更新该项的完整路径，继续保持未决。

表中的“入口/owner/返回已核定”是逐项限定的静态结论。失败恢复若只核到 `retry/reconcile/continue` 的存在，会明确注明尚未走完提交、重读及退役交错；不能据此宣称恢复闭环通过。旧登记中跨进程保留搜索、目录视口、批次历史和外观整组撤销等可选产品决定，也没有在本轮自动变为新增开发任务。

## 当前功能范围

当前 [ReaderProductScope.ts](../../../entry/src/main/ets/app/ReaderProductScope.ts) 返回 `l0`。书架、本地和在线文字阅读、当前漫画阅读路径、书源管理、实际生效的设置及下载管理有当前接线；`discover`、`rss`、`sync`、`unimplementedSettings` 仍由产品范围关闭。后四类虽有组件、owner 和 Index 分支，**不属于当前可达入口**，不能据“源码存在”计为用户已开放功能。

同理，底部操作面板、目录、阅读快捷控制栏、完整控制栏是不同的呈现层。共用样式不意味着共用返回目标、持久任务或关闭语义；返回来源必须由实际调用入口传递。

另有两个保留的根分支不应计为当前可见旅程：独立 `BookshelfManagement` 仅保留 Index 路由/定义，书架更多“批量管理”实际进入 `BookshelfMultiSelectPage`；独立 `RulesManagement` 虽在 Settings/Reader 定义回调并由 Index 配置 owner/返回，当前 Settings 没有可见导航行，ReaderControlPanel 也未消费该回调。阅读替换的“完整管理”实际走 `onExpand → expandReaderControlSession`，没有打开独立 RulesManagement 路由。可见入口与未被 UI 消费的保留回调必须分开。

## 原 28 个工作流逐项对照

### 应用与平台：3 个

| 原 ID / 目标 | 当前入口及 owner | 当前返回 / 生命周期 | 本轮判定及失败恢复边界 |
|---|---|---|---|
| **WF-A01** 打开应用并到达可用书架 | `EntryAbility.onCreate/onWindowStageCreate` → `ReaderRuntimeOwner` 恢复屏障 → `ReaderStartupContentOwner` → Index/书架。 | 未挂载 Index 时由 `ReaderStartupRecovery` 自身承接重试和退出；不是调用书架内部按钮恢复。 | **已核定**：启动及独立恢复页面接线。旧记录“loadContent 失败只有日志”不能继续当作当前事实；当前已有 `loadRecovery`、`retry`、`exit`。所有平台 Promise 不结束、恢复页面自身挂载失败等边界仍 **仅历史待查**，未运行故障注入。 |
| **WF-A02** 中断应用后安全继续原任务 | `EntryAbility` 前后台、窗口及销毁 → Runtime/各域 owner；TTS 另有平台后台租约 owner；下载现由 Runtime 协调器持有。 | 页面展示退役与任务受理分开；`nextNavigationGeneration`、presentation identity、runtime identity 拦截旧展示回调。 | **已核定**：当前 owner 分层和局部退役入口。**规则缺失**：旧旅程未具体列下载任务离页、进程恢复及重进投影，补 WF-D04。全域旧回调交错、平台撤销仍 **仅历史待查**；不由一域的 guard 推断全应用安全。 |
| **WF-A03** 从系统文件打开进入正确书籍 | 系统 Want → `ReaderSystemFileOpenHost/Queue` → `LocalBookImportGateway` → 现有书架/阅读准入。 | 系统队列等待恢复屏障；导入成功但导航未准入可以保留已保存书并回书架打开；host dispose 不等于回滚已导入书。 | **已核定**：当前系统入口、导入 owner、排队/释放路径存在。连续外部文件、部分成功、阅读中切换及迟到回执的完整恢复 **仅历史待查**，未重演原 6 步。 |

### 书架、搜索、详情及目录：10 个

| 原 ID / 目标 | 当前入口及 owner | 当前返回 / 生命周期 | 本轮判定及失败恢复边界 |
|---|---|---|---|
| **WF-L01** 从书架找到书并继续阅读 | `BookshelfShell/Page` → Index `openShelfBook` → 阅读准入；书架列表由 `BookshelfFlowGateway`/书架 host 提供，空/失败由 Core 事实准入。 | 过滤/滚动/显示方式由书架 view state 和其持久 owner 分别持有；阅读完成退出后回实际来源。 | **已核定**：书架回调、空/失败重试、导航 guard。**规则缺失**：书架“更多→下载管理”不是旧旅程的阅读分支，补 WF-D01；本轮新增该入口。分页 cursor、动态过滤等原 8 步不是本轮已验。 |
| **WF-L02** 多选后准确批量移除并核对结果 | 书籍长按/书架批量管理 → `BookshelfMultiSelectPage` → 书架操作 host / `BookshelfManagementGateway` → Core。 | Index 在批量忙时阻止退出；页面选择不充当持久删除任务；结果通过原书架 owner 核对。 | **已核定**：入口、批量 owner、忙态返回分支及恢复入口存在。部分成功、资产清理后半段和重进选择退役 **仅历史待查**。 |
| **WF-L03** 搜索找到可读书并返回原结果继续筛选 | 书架搜索 → `SearchPage` → `SearchHost/SearchOrchestrator`；结果 → Index 详情准入。 | `returnToSearch` 调 `searchHost.resume()`，不 `open()` 重置原结果；从书源管理普通返回只刷新源并恢复查询，明确“导入后搜索”才重搜。 | **已核定**：查询/结果 owner 与普通返回、主动重搜分流。搜索失败/停止/历史读取重试有对应回调；源版本、cursor 及所有旧响应交错 **仅历史待查**。 |
| **WF-L04** 查看详情、加入书架并判断最终保存事实 | 书架长按“书籍信息”、搜索结果、阅读页“更多→书籍信息” → `LocalBookDetail` / 远程详情准入；保存仍由原书架/详情 owner。 | 原登记只写 search/shelf 返回。本轮 Index 记录 `DetailReturnRoute='reader'` 和 `ReaderReturnContext`；详情系统返回可恢复同书阅读及其原来路。 | **代码偏差（本轮源码已修）**：阅读→详情之前丢失阅读父上下文而回书架。**规则缺失**：旧 WF-L04.7 未覆盖 reader 父节点，现按实际来源补齐。加入书架提交/unknown/重读等原有细节 **仅历史待查**，不随路由修复自动通过。 |
| **WF-L05** 目录内定位章节并安全返回阅读 | 详情目录/外部目录 → `BookDirectoryPage` → 共用目录导航投影；阅读内目录由 LRE/漫画表面承接。 | `directoryReturnTarget` 区分详情与阅读控制；Index `closeDirectory`，页内规则或下载 popup 先自行收起。 | **已核定**：两类入口及返回目标分流。目录重试及 bookmark/offline reconcile 回调存在。树结构失败、当前 revision、长目录定位及卸载资源的整条恢复 **仅历史待查**；漫画与文字的目录路径不能混作一个通过项。 |
| **WF-L06** 移除单本书并确认保留/清理范围 | 书架长按“移除”/详情移除 → 原书架操作 host → `BookshelfManagementGateway` / Core 资产 owner。 | 确认框是临时层；回书架重读成员事实。`continueShelfRemoval` 与 reconcile 入口保留原操作，未新造第二份删除队列。 | **已核定**：用户入口及原删除/核对 owner。删除已经提交但清理失败、重新导入引用保护与跨进程回执 **仅历史待查**，本轮没有扩大移除范围。 |
| **WF-L07** 将本地文件导入成可继续阅读的书 | 书架更多/空书架 → `LocalImportDialog` → 书架操作 host → `LocalBookImportGateway`。 | `closeImportDialog` 仅关闭当前展示；文案明确关闭不取消已开始导入；结果待核对时阻止新的冲突写。 | **已核定**：入口、批次结果/原操作核对接线。TXT/EPUB 实际语料、部分成功、未知项恢复、资源释放仍 **仅历史待查**；本轮没有重测解析器。 |
| **WF-L08** 更换在线来源并继续正确位置阅读 | 详情/文字阅读/漫画阅读换源 → `SourceSwitchWindow/Gateway`、Index、原 canonical 进度与换源 owner。 | `sourceSwitch` scope/transaction、reading presentation、failed retry 各有独立身份；文字与漫画准入后回各自阅读路径。 | **已核定**：当前入口和根回调存在。强进度迁移、已 finalized 读回、pending 未知态恢复和旧响应隔离 **仅历史待查**；旧 9 步及其他换源专项记录未在此重新验收。 |
| **WF-L09** 切换书架显示方式并保持可靠设置 | 书架显示切换及书架设置 → 同一 `BookshelfViewModeHost` → 既有偏好 store。 | 页面 motion/revision 属展示；保存 ACK/canonical 属 Host。重进读取确认值，unknown 时走 `reconcile`。 | **已核定**：两个消费者共用持久 owner、读/写/核对接口及页面恢复入口。原生持久失败、卸载中写入等原 7 步 **仅历史待查**。 |
| **WF-L10** 从书籍操作面板编辑当前书的默认分组 | 书架长按面板 → Index `openShelfGroup` → 原书架分组管理 owner / `BookshelfManagementGateway`。 | 长按面板关闭、分组编辑、已确认写与书架重读分开；面板身份不能由旧 disappear 清新目标。 | **已核定**：当前长按菜单与分组 owner 回调。**规则缺失**：旧登记中的原生 CENTER/270、单消费者宿主只是 10-02 的当时审计，不能作为当前所有底部/侧边面板的规格。分组的完整冷恢复和新旧 presentation 交错 **仅历史待查**。 |

### 表单、书源及设置：7 个

| 原 ID / 目标 | 当前入口及 owner | 当前返回 / 生命周期 | 本轮判定及失败恢复边界 |
|---|---|---|---|
| **WF-F01** 导入书源并继续原来的找书任务 | 设置/搜索管理源 → `SourceManagementPage` / JSON 导入 → `SourceOrchestrator/SourceGateway`。 | `sourceManagementReturnTarget` 与关键词记录来路；普通返回不触发搜索，“导入后继续搜索”才刷新源并重新提交查询。 | **已核定**：入口、原导入 owner、搜索/设置来路和重搜分流。partial import、original write 与重读分别有核对/继续入口；完整提交/清理和退役交错 **仅历史待查**。 |
| **WF-F02** 管理单个书源，检测或登录后回到阅读准备 | 源管理行启停、检测、登录 → `SourceOrchestrator`，登录仍由原 ArkWeb/platform 路径处理。 | 返回使用源管理来路；展示 identity/session 不拥有已接受原写入。`retryLoad/reconcile/continueOriginal` 各有原 owner 接线。 | **已核定**：当前 UI 回调到 owner 及返回；登录 cookies/系统 Web 生命周期、检查结果与读取故障等完整恢复 **仅历史待查**。没有把开关显示值当成服务端或持久状态。 |
| **WF-F03** 批量检测和维护一组书源 | 源管理→工具 → `SourceToolsPage/SourceToolsOrchestrator`：选择、检测、启停、删除、导出。 | Index 返回 `returnToSourceManagement`；批量检测 `stopCheckSelected`，selection 通过 owner 消费，旧 presentation 不能操作新选择。 | **已核定**：当前入口、选择消费、停止和返回接线；`reconcile/continueOriginal` 有实际回调。批量部分结果、导出平台失败和跨路由旧回执 **仅历史待查**。 |
| **WF-F04** 编辑原始书源 JSON 并确认保存 | Source Tools 编辑动作 → `openEditor/updateEditorDraft/saveEditor` → `SourceGateway` 原写入。 | `cancelEditor` 只退编辑；保存确认/unknown 由 `reconcileEditor` 读取原操作处理，不把重进当自动保存。 | **已核定**：入口、草稿/保存/取消/核对的同一 owner。校验失败、确认后重读失败及冷恢复细节 **仅历史待查**。 |
| **WF-F05** 修改设置并相信重进后的确认值 | 设置/书架设置 → `SettingsOrchestrator`；书架显示方式另由 `BookshelfViewModeHost`；主题、恢复默认、缓存操作保留各原 authority。 | 设置子区先返回设置首页，设置页再回书架；`onReconcile/onRetryAccepted` 分离读回与继续原已受理操作。 | **已核定**：当前设置入口及 owner/返回；设置 readback 与确认回调存在。**规则缺失**：下载存储、任务取消与本地删除不能被“设置清缓存”一行覆盖，补 WF-D05/D06。旧可选/未开放设置不纳入可达功能。 |
| **WF-F06** 调整本书目录层级后继续导航 | `BookDirectoryPage` 展开 `ReaderDirectoryRules` → `ReaderDirectoryRulesGateway` / Core 原 regex/目录规则 owner。 | 预览与应用分开；`onApplied` 触发目录 revision；应用已确认但刷新失败有 `retryDirectoryRefresh`，不重复提交 apply。 | **已核定**：真实入口、预览/应用 owner、确认后刷新恢复。所有规则语料/未知提交/换书并发 **仅历史待查**，未把仅 SDK 能力当当前每书支持。 |
| **WF-F07** 维护阅读替换规则并继续阅读 | 当前可见的阅读快捷替换入口 → `ReaderControlReplaceContent/State/Gateway`；“完整管理”走 `onExpand → expandReaderControlSession`。独立 `RulesManagementPage/Orchestrator` 属保留分支，Settings 仅声明 callback、无可见导航行，ReaderControlPanel 也未调用对应 callback。 | 当前阅读替换表面收起回阅读控制。独立路由虽有 settings/reader 返回配置，本轮确认不存在消费它的可见入口，不能计作已开放。写入仍走原规则 authority。 | **已核定**：阅读内替换入口和完整控制展开；**仅历史待查**：保留的独立管理分支，不纳入开放旅程。原替换的原始写回执、导入导出及冷恢复仍未重新验证。不能从组件/回调定义推断两种入口都可达。 |

### 阅读及控制：8 个

| 原 ID / 目标 | 当前入口及 owner | 当前返回 / 生命周期 | 本轮判定及失败恢复边界 |
|---|---|---|---|
| **WF-R01** 打开一本书、持续阅读并可靠返回 | 书架/详情/下载章节 → Index 阅读准入 → `LocalReadingExperience` 或 `MangaSessionController/MangaReadingSurface`；原进度 owner 保存位置。 | LRE `requestExit/beginExit` 先保存/关闭会话后 `onExit`，Index 再执行详情、下载等目的地；系统返回与页内返回共用根路径。 | **代码偏差（本轮源码已修）**：阅读→书籍信息→系统返回丢失阅读上下文，见 WF-L04。**规则缺失**：原入口清单缺下载来源及其 retained page，补 WF-D03；漫画图片/章节边界/整页错误需要细分 WF-X01。全域退出保存、正文定位和设备表现未在此验收。 |
| **WF-R02** 查找章节、跳转并返回原阅读上下文 | 阅读目录 → `ReaderDirectoryNavigationSurface/List` → LRE `selectChapterAnchor`；漫画由当前 manga session/directory target proof 准入。 | 目录表面先关闭自身；章节真正准入后改当前正文，失败留原阅读上下文；外部目录根返回见 L05。 | **已核定**：文字/漫画目录与章节选择 owner 分流及根返回接口。目录 revision、树失效、失败后原位置和旧选择退役完整序列 **仅历史待查**。 |
| **WF-R03** 创建、查阅、删除书签并回到原文 | 页面书签手势、控制栏书签目录 → LRE bookmark methods / 原 Core bookmark owner；外部目录另有 bookmark reconcile 回调。 | 列表读取、创建/删除原操作和章节 anchor 跳转分开；失败核对不是重复创建。 | **已核定**：真实入口、bookmark 读取/核对和跳转回调。手势动效、精确原文 offset、unknown 写及跨进程 canonical 核对 **仅历史待查**。 |
| **WF-R04** 调整外观、导入字体并保留可靠设置 | 阅读外观/字体入口 → `ReaderAppearanceGateway/Store`、字体 Host 及平台亮度 owner。 | 外观控制表面关闭回阅读；即时外观应用与持久确认不是“关闭即提交”的新事务。 | **已核定**：现有控制表面及原外观/字体 authority 被保留。字体导入/缺失/原生加载失败、亮度平台拒绝、已应用但未保存等边界 **仅历史待查**；旧整组可撤销事务仍是可选规格，未擅自实现。 |
| **WF-R05** 配置朗读、开始播放、处理中恢复与继续阅读 | 阅读朗读控制及配置层 → `ReaderTtsSessionCoordinator` / config owner → `HarmonyTtsHostRouter`、后台租约/媒体平台 owner。 | `start/pause/resume/stop/dispose` 属同一 TTS 会话 owner；控制层显示/关闭不替代后台 ACK 或引擎停止。当前源码有媒体控制、平台中断、lease revoke 和 retryable error 分支。 | **已核定**：入口及业务/平台 owner 分层和当前恢复函数存在。真实后台授权、迟到 grant、媒体 ACK、重进配置保存与中断恢复仍 **仅历史待查**；原 R05.10 未变成设备通过。 |
| **WF-R06** 开始自动翻页、暂停继续、结束并手动阅读 | 阅读自动翻页控制 → `ReaderAutoPageCoordinator` → 原 page-turn / chapter navigation owner。 | start/resume/pause/stop/dispose 分开；目录不可用停止为 `catalogUnavailable`，不会用下一次 timer 伪装跨章成功。 | **已核定**：当前 owner、timer 生命周期及 catalog fail/turn retry 接口。全场景倒计时、切后台、正文异步翻页和手动控制交错 **仅历史待查**。持续显示停止原因仍按旧可选规格处理。 |
| **WF-R07** 搜索正文、浏览全部可得结果并跳到命中处 | 阅读正文搜索 → `ReaderControlSearchContent` / search publication → LRE `selectSearchResult/selectChapterAnchor`。 | 搜索查询/结果/cursor 与当前正文位置分开；收起控制层不由 UI 创造新的搜索任务；命中跳转经过原 anchor 准入。 | **已核定**：当前入口、结果选择与阅读 owner 接线。流式/分页结果完整性、cursor 失效、失败后继续及跨显式关闭保留政策 **仅历史待查**。 |
| **WF-R08** 控制面板与会话胶囊交接，并安全处理平台打断 | 阅读快捷/完整控制栏及会话胶囊 → LRE motion state / `ReaderSessionLaunchController`；朗读/自动翻页仍归各业务 owner。 | 快捷↔完整层级变化、退出控制表面与停止业务是不同操作；launch transaction 有 `handoffPending/exitPending/released`，平台资源由 lease owner 释放。 | **已核定**：呈现/业务/平台分层及当前 handoff owner。用户此前反馈的完整→快捷手感修复只属已改源码，不等于真机手感通过。**规则缺失**：通用底部操作面板开/收、mask/系统栏及先关层再导航，不能仅靠会话胶囊规则代替；由主交互规则集中登记。 |

## 原登记缺少的下载旅程

下列 ID 是本分册的补充登记，**不回填原 28/211 计数，也不据此宣称新增 6 项功能或已完成验收**。它们把当前已存在而原登记遗漏的业务接线拆成可核对边界。

| 新 ID / 用户目标 | 实际入口、owner、返回 | 当前核定结果及待补规则 |
|---|---|---|
| **WF-D01** 从来处进入下载管理并回到同一来处 | 书架更多、设置、书籍详情/目录、阅读下载动作 → Index `openDownloads/requestReaderDownloads` → `SharedDownloadPage/Host`。根返回保存 bookshelf/settings/detail/directory/reading 来路；页面内部先关闭确认层、操作层、管理模式、单书页，再离开下载路由。 | **已核定**：多入口及 `consumeBack` 的局部层级；**代码偏差（本轮源码已修）**：原通用入口把非 detail/directory 一律当 settings，新增书架入口后必须明确 bookshelf。阅读父上下文经 `ReaderReturnContext` 传递；原登记对该来源矩阵 **规则缺失**。 |
| **WF-D02** 在单书章节下载列表辨认当前阅读章节并选择范围 | `SharedDownloadPage` 单书章节列表/定位/快选/“从当前章节往后” → 同一 `currentDownloadReadingChapterIndex`。真实 `readingPosition` 优先；漫画需 `lastReadAt` 才允许映射 index；必须命中同书可导航条目。 | **代码偏差（本轮源码已修）**：过去用 legacy `currentChapterIndex` 与真实 readingPosition 混解释，可能把目录元数据当当前阅读。现标记/定位/快选/默认阅读目标共用 helper；未知位置保持未知，不能标第一章为“当前”。当前章被筛出或目录变化时的可见提示仍须在规则中明确，未做设备可见性验收。 |
| **WF-D03** 点击可阅读章节直接阅读，退出回原章节列表 | Page `requestRead` → `describeDownloadReadingTarget` → Index `openDownloadReadingTarget` 验同书/章节身份 → 原阅读准入；保存退出后 `openDownloads(...resumeLoaded=true)` / Host `resume`。 | **已核定**：当前章点击的直接路由、catalog-only 读、retained snapshot 与受影响书阅读元数据刷新。上轮闪 read sheet、普通往返整表重读已有源码修正，不能把“只跳转一次”当理由重建所有行；未知/失效目录走反馈，不能先丢列表。滚动/过滤实际设备保留尚未在本分册复验。 |
| **WF-D04** 受理下载后离页，任务继续并重进读真实进度 | Runtime `getDownloadCoordinator` / `SharedDownloadCoordinator` 持久意图、Core queue 与原 Host materializer；Page/Host 订阅下载状态和意图 revision。 | **已核定**：受理后任务不归临时页面 generation；restore 重建意图，队列进度按变更书合并。**规则缺失**：原 A02 泛化的“后台任务”未列受理 ACK、Core 队列、物化、本地完整性、展示加载五种事实。进程终止/恢复及大范围下载未在此执行。 |
| **WF-D05** 暂停、继续/重试、取消、删除本地内容并理解失败 | 书籍/章节/多选操作 → Page 目标 DTO → Host `runAction` → Coordinator 串行 `operate/submitBook` → 原队列/内容 owner。删除有确认并保留阅读保护；已确认控制后投影读失败抛独立 `SharedDownloadProjectionRefreshError`。 | **代码偏差（本轮源码已修）**：`job.error` 被当 `stateLabel`，整段“请稍后重试”进入按钮且失去失败 icon/color。现有限状态、操作短词、`downloadError` 分离；`projectionError` 只表示信息读失败。任务 fail-fast 后未开始章节不伪造 failed；旧失败记录不盖住后来已证明完成的内容。**已核定**这些静态语义；原现场具体异常未有证据，保留未决，不能从兜底文案断言网络/存储故障。 |
| **WF-D06** 看懂存储、调整策略并安全清理可重建内容 | 下载存储管理 → `SharedDownloadStorageGateway` / Runtime 存储 owner；容量、永久下载、自动缓存、可清理和 active reading 保护分开。`canCleanDownloadStorage` 只承认已知、非负且可清理不超过自动缓存的真实测量。 | **已核定**：入口与存储 owner、unknown 不填 0、清理资格及独立 policy 事实。底栏容量未知不应让整栏控件内容空白；清理不等于取消任务，也不等于删除永久下载。底层清理失败、protected versions、恢复中等待等完整行为 **仅历史待查**。 |

## 其他原登记粒度不足的当前旅程

| 补充 ID | 当前事实与原覆盖关系 | 判定 / 后续边界 |
|---|---|---|
| **WF-X01** 漫画阅读与图片/章节恢复 | 当前 `MangaSessionController/MangaReadingSurface` 已有单图占位、整章/书源准入失败、目录、阅读模式、更多及下载操作。旧 R01.8 只概括内嵌图片失败，L05/R02/L08 也只粗覆盖漫画目录和换源。 | **规则缺失**：需要单独记录“单图不可用保持 cell 几何”“章/源加载不了走页面错误”“多图失败各 cell 居中”“已缓存图片回滚不二次加载”“释放达到阈值才翻章”等已确认规则对应的 owner 和触发条件。本文只确认当前分支存在，不重开产品方案或宣布这些规则已在设备通过。 |
| **WF-X02** 书架手动/自动检查更新与结果回到书架 | `BookshelfShell.onCheckUpdatesRequested` / 自动刷新条件 → Index `getBookshelfCatalogOwner` → `BookshelfCatalogOwner.manual/automatic/reconcile`。旧 L01 目标找书阅读，没有把“查更新”受理、后台继续、部分结果、离页和重进作为独立旅程。 | **已核定**：入口、前台条件、独立 owner 和核对函数。**规则缺失**：不能用列表加载 spinner/刷新失败替代更新任务结果，也不能在普通跳转自动再发一轮。完整更新/投影失败界线 **仅历史待查**。 |
| **WF-X03** 独立规则管理保留分支 | `RulesManagementPage/Orchestrator` 和 Index `rulesManagementReturnTarget` 的路由/owner/返回代码存在；Settings 仅声明并传递回调，没有可见导航行。ReaderControlPanel 声明 `onOpenRulesManagement` 但未调用；阅读替换“完整管理”走控制栏展开。 | **仅历史待查 / 当前无可见入口**，不计为已开放旅程，也不把恢复入口本身当当前缺陷。本轮只确认保留分支与未消费 callback，未验证其写/批次/冷恢复。若日后明确开放，再登记独立页的打开、关闭、返回和原任务规则；不能因组件及原 owner 存在就宣称当前可达。 |

发现/RSS/同步不新增当前工作流 ID：它们在当前 l0 被关闭。若后续开放，应先恢复其实际产品范围及完整来路/任务/失败规则，不能直接沿用旧源码里的按钮或路由作为交付证明。

## 本轮可以确定的共性问题

1. **工作流旧目录没有跟随新入口更新。** 下载管理虽有完整任务 owner，旧文档没有记录其多来源、单书层级和阅读往返；原 L04 仍只列 search/shelf，导致阅读作为详情父节点遗漏。
2. **返回目标、任务 owner 与展示层混在一起。** 一次导航会卸载临时页面，但不能推导为任务取消、整表重载或丢失 reader 父上下文。点击关闭和任务停止需要不同接线。
3. **同一个状态字段被用于多种职责。** 本轮 `stateLabel` 同时承担下载状态、失败原因和按钮 caption 是明确例子；metadata read failure、accepted task failure、进度未更新也不能合成一个“重试”。
4. **横向 UI 统一不能替代纵向旅程对照。** 共用面板改善外观，仍需逐入口核对目标 identity、正确 owner、先关闭层还是先导航、返回是否复用读模型、错误是否重读或继续原任务。
5. **旧台账不能直接升级为当前完成度。** 本轮可以明确指出已找到或修正的连线；对其余 211 步、设备几何、动效手感及平台授权只保留原证据边界，不能宣称全应用已验完。

## 本轮定位使用的当前源码入口

以下是本分册实际查询和阅读的入口索引。引用某文件不表示已审完该文件所有状态、每个回调或全部依赖。

- 应用范围/启动：[ReaderProductScope](../../../entry/src/main/ets/app/ReaderProductScope.ts)、[EntryAbility](../../../entry/src/main/ets/entryability/EntryAbility.ets)、[ReaderStartupRecovery](../../../entry/src/main/ets/pages/ReaderStartupRecovery.ets)、[ReaderSystemFileOpenHost](../../../entry/src/main/ets/app/ReaderSystemFileOpenHost.ts)、[ReaderRuntimeOwner](../../../entry/src/main/ets/app/ReaderRuntimeOwner.ts)。
- 根导航及回调：[Index](../../../entry/src/main/ets/pages/Index.ets) 的 `onBackPress`、`bookshelfShellContent`、`searchPageSurface`、`openDownloads/returnFromDownloads`、`captureReaderReturnContext/restoreReaderReturnContext`、`requestReaderBookInfo/returnFromDetail`、`openSourceManagement/returnFromSourceManagement`、`sourceToolsSurface`、`openRulesManagement/presentRulesManagementFromReader`、`startManualBookshelfUpdate`。
- 书架及来源：[BookshelfFlowGateway](../../../entry/src/main/ets/features/bookshelf/BookshelfFlowGateway.ts)、[BookshelfPage](../../../entry/src/main/ets/features/bookshelf/BookshelfPage.ets)、[BookshelfManagementGateway](../../../entry/src/main/ets/features/bookshelf/BookshelfManagementGateway.ts)、[BookshelfViewModeHost](../../../entry/src/main/ets/features/bookshelf/BookshelfViewModeHost.ts)、[BookshelfSettingsPage](../../../entry/src/main/ets/features/bookshelf/BookshelfSettingsPage.ets)、[SearchHost](../../../entry/src/main/ets/features/search/SearchHost.ets)。
- 源/设置原 owner：[SourceManagementPage](../../../entry/src/main/ets/features/source/SourceManagementPage.ets)、[SourceOrchestrator](../../../entry/src/main/ets/features/source/SourceOrchestrator.ets)、[SourceToolsOrchestrator](../../../entry/src/main/ets/features/source/SourceToolsOrchestrator.ets)、[SettingsOrchestrator](../../../entry/src/main/ets/features/settings/SettingsOrchestrator.ets)、[RulesManagementOrchestrator](../../../entry/src/main/ets/features/settings/RulesManagementOrchestrator.ets)。
- 目录/阅读：[BookDirectoryPage](../../../entry/src/main/ets/features/bookshelf/BookDirectoryPage.ets)、[ReaderDirectoryRules](../../../entry/src/main/ets/features/reading/ReaderDirectoryRules.ets)、[LocalReadingExperience](../../../entry/src/main/ets/features/reading/LocalReadingExperience.ets)、[ReaderTtsSessionCoordinator](../../../entry/src/main/ets/features/reading/ReaderTtsSessionCoordinator.ts)、[ReaderAutoPageCoordinator](../../../entry/src/main/ets/features/reading/ReaderAutoPageCoordinator.ts)、[ReaderSessionLaunchController](../../../entry/src/main/ets/features/reading/ReaderSessionLaunchController.ts)。
- 下载：[SharedDownloadPage](../../../entry/src/main/ets/features/downloads/SharedDownloadPage.ets)、[SharedDownloadHost](../../../entry/src/main/ets/features/downloads/SharedDownloadHost.ts)、[SharedDownloadGateway](../../../entry/src/main/ets/features/downloads/SharedDownloadGateway.ts)、[SharedDownloadProjection](../../../entry/src/main/ets/features/downloads/SharedDownloadProjection.ts)、[SharedDownloadCoordinator](../../../entry/src/main/ets/features/downloads/SharedDownloadCoordinator.ts)、[ReadingOfflineFailurePresentation](../../../entry/src/main/ets/features/reading/ReadingOfflineFailurePresentation.ts)。

主交互规则与本轮根接线修正应引用本表的具体 ID，后续按实际用户旅程核对；不新增默认全门禁或以重新执行全部 211 步作为本次文档工作的前置。
