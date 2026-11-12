# HarmonyOS UI 模块、状态与导航边界细化

日期：2026-11-05。状态：经本轮方案优化的规划附件，未实施生产代码。

本附件细化 [目标架构方案](ui-target-architecture-20261105.md) 的模块归属与接口边界。源码基线为 HarmonyOS `663c6ee59e65b6a6afe2d9fa4bb18919a63cbabe`、Core `2a301653c140eef457e786fd6ab3bb9b8e3045c8`。已有开源应用的可借鉴内容与限制见 [源码对照](ui-upstream-reference-review-20261105.md)。本次只编写方案，未执行测试、构建、签名、安装或设备操作；文中的目标接口和退出条件均不代表已实现或验证通过。

本文不是另一份长期待办。后续实施仍进入工作区唯一待办，并按具体纵切选择必要验证。本轮仅修改方案，不修改生产代码、检查工具、CI、设备或治理总账。模块归属调整不改变 Core 协议、持久化位置、事务确认、数据保留和产品准入。

## 1. 采用的结构及标记

采用逻辑上的三层：产品装配、业务功能、公共基础。业务功能内部区分 application、presentation、UI；公共基础区分设计基础、控件/模式、布局承载及平台能力。这些是依赖与所有权边界，不要求立即创建相同数量的 HAR/HSP，也不要求每个 feature 都建立一套空目录。

| 标记 | 含义 |
| --- | --- |
| 直接复用 | 已有模块继续承担同一职责；调整消费者不重新实现它。仅表示采用决定，不表示本轮验证或设备验收通过 |
| 适配 | 保留业务算法/状态 owner，收紧输入输出、生命周期或依赖方向 |
| 保留 | 专用宿主、平台实现或关闭模块有明确存在理由，不计作待消灭的重复 |
| 退役 | 同一职责的新路径已完整接管后删除旧生产入口；不是本轮立即删文件 |

物理去向统一采用总方案 §10 的唯一目录规范：产品装配为 `app/composition`，导航为 `app/navigation`；公共 UI 为 `ui/{foundation,layout,controls,patterns,messages,platform}`；业务功能为 `features/<feature>/{application,presentation,ui}`；非 UI 的文件、HTTP、媒体与资源 Host 为 `platform`。下文目标目录均是**拟定去向**，不表示已创建。当前仓库也没有通用 SceneManager、PresenterRegistry 或 ModalManager，本方案不新增这些框架。已有类名、方法与状态类型按当前源码列出；需提取的接口以描述形式声明，不假称已有实现。

建议的依赖图：

```text
app/composition：EntryAbility 装配、根组合、跨功能交接
    → app/navigation：既有 ReaderRoute 的唯一状态与有限返回/保留接线
    → features：业务用例 owner / 页面投影 / 业务 UI
    → platform、ui/platform 的能力实现（创建与注入）

features/<feature>/ui → 本 feature presentation 合同 + ui 公共控件/布局
features/<feature>/presentation → 本 feature application 的有界接口、纯投影
features/<feature>/application → Core 协议适配、既有平台能力接口
ui/layout、ui/controls、ui/patterns、ui/messages → ui/foundation、ArkUI、ui/platform
platform、ui/platform 的实现 → 对应能力合同、系统 API
```

`ReaderRuntimeOwner` 当前会装配下载、阅读准备、时长与进度恢复等 feature 能力，因此其装配部分归产品层，不能简单把整个文件搬入“纯平台公共层”再要求 feature 反向依赖它。也不为了消除一个 import 复制 runtime。

## 2. 产品装配：保留单一运行时，拆出业务接线

| 当前入口/文件 | 目标职责与去向 | 决定与旧路径退出条件 |
| --- | --- | --- |
| `entryability/EntryAbility.ets` | 原生入口保留薄接线；装配职责归 `app/composition/ability`：Want、WindowStage、前后台、运行时与环境安装、启动准入、系统文件入口 | **适配**。保留平台生命周期；业务配置恢复与阅读字体准备通过现有 owner 接线。不能把整个启动过程改成页面的 loading 布尔值 |
| `app/ReaderRuntimeOwner.ts` | `app/composition/runtime` 保留唯一 Core runtime、Ability lease、predecessor close、能力装配与回收；具体平台 I/O 继续委托 `platform` 的已有 Host | **保留+适配**。保留所有已受理工作与恢复链。仅在具体依赖已注入后拆出对应装配段，不重建第二个运行时 |
| `app/ReaderStartupContentOwner.ts`、`pages/ReaderStartupRecovery.ets` | `app/composition/startup`：WindowStage 的 admission、主内容/恢复内容加载与可重试状态；恢复页消费 `ui/messages` | **直接复用**。`retry()` 继续观察原 admission barrier，不重启一次 Core 恢复；`close()` 退休该窗口尝试 |
| `pages/Index.ets` | `app/composition/root` 消费当前 runtime、根展示及导航的只读输入并组合 UI；唯一 ReaderRoute 状态和有限交接归 `app/navigation` | **拆分适配**。下表的 feature 读写、快照投影和局部表面状态归回其 owner；按实际依赖、状态与调用消除原职责，不能整搬成巨型 RootController |
| `app/ReaderProductScope.ts` | `app/navigation/admission`：`isReaderProductSurfaceEnabled`、`isReaderMainTabEnabled` | **直接复用**。导航、深入口和实际动作消费相同准入；本轮保留原路由机制与关闭模块准入 |
| `app/ReaderSystemFileOpenHost.ts`、`ReaderSystemFileOpenQueue.ts` | `app/composition/system-open` 的文件 Want 受理与结果队列；文件读取仍由 `platform` 能力完成 | **直接复用**。队列是受理结果 owner，不归目标页面 |
| `app/ReaderSystemFileOpenNavigationHost.ts` | `app/navigation/system-open`：产品导航与队列之间的有限适配；保留 `SystemFileOpenNavigationAdapter` | **直接复用/适配**。继续使用 `mount/dispose/consume/readerExited/cancelExit`，队列 acknowledge 只表示消费导航结果，不证明导入、退出或可见帧完成 |
| `features/shell/MainTabShell.ets`、`MainTabBar.ets`、`MainNavigationOverlay.ets`、`MainNavigationSpec.ts` | 目的地和导航占位装配归 `app/navigation`；公共底栏/侧轨呈现归 `ui/patterns`；页级几何遵守 §4 的统一输入/输出合同 | **适配**。底栏与侧轨呈现同一导航事实；包装 StandardPage 时只提供导航占位，不再竞争页面求解/测量 |
| `features/settings/ui/SettingsShell.ets`、`ReaderShell.ets`、`features/bookshelf/ui/BookshelfShell.ets` | 分别归 `features/settings/ui`、`features/reading/ui`、`features/bookshelf/ui` 的组合 UI，不归全应用万能壳 | **保留+适配**。标准滚动由 StandardPage 负责几何；领域专用宿主由具名 feature 组合适配负责，均遵守同一协议且每实例只有一个 owner；不强制阅读/列表穿过 StandardPage |

### Index 内现有状态与方法的拆分去向

| 当前字段/方法族 | 目标归属 | 不得随之转移的权威 |
| --- | --- | --- |
| `shelfBooks/shelfProjectionRevision/continueReading`、分页与来源名称接线 | `features/bookshelf/presentation`，订阅 `BookshelfProjectionOwner` | Core 书架、游标、投影 revision 仍为原事实；不建立 ArkTS 书架 repository |
| `shelfOperation`、`beginImport/closeImportDialog/reconcileImportPresentation`、移除确认与结果呈现 | `features/bookshelf/ui`、`features/bookshelf/presentation`，动作仍回 `BookshelfOperationOwner` | 导入/移除受理、mutex、未知结果与恢复仍在原 operation owner |
| `librarySearchMode/identity/headerBottom`、搜索开合与书架共用顶栏动作 | `features/search/presentation` 与 `ReaderLibrarySearchModel/Surface` | `SearchHost` 的发布、`SearchOrchestrator` 的请求和停止语义不搬进动画宿主 |
| 设置、来源、工具、下载快照及页面筛选/选择 | `features/<feature>/presentation`；现有 Host 继续连接原用例 owner | 这些快照是只读投影；已受理写入与下载不变成页面任务 |
| `detailBook/detailToc/remoteReadingSession` 的页面接线、detail 返回上下文 | `features/reading/presentation` 的 entry/detail 展示，绑定 `ReadingEntryHost` | 目录、正文资格、获取与换源事实留在现有 Core/Host/coordinator |
| `directoryReturnTarget`、下载返回上下文、系统文件退出交接 | `app/navigation` 的有限目的地参数与 feature 返回适配 | 章节选择证明、原换源事务、当前阅读 session 仍由各业务 owner 判定 |
| 临时返回 lease、原生确认调用、局部恢复提示 | 触发该表面的 `features/<feature>/ui`；产品根仅接最高层返回 | 不建立跨页面消息队列；关闭消息不取得业务取消权 |
| 书架封面开合转场测量与 `BookshelfNavigationTransition` 接线 | `features/bookshelf/ui` 的 bookshelf→reader 专用过渡适配 | 不以转场结束代替阅读资格、进度 ACK 或已呈现正文的事实 |

“移出 Index”以实际调用链完成为准。只增加一个转发类、仍让 Index 写所有私有状态，不计作完成。

### Index 的残留职责与可核对边界

本源码基线的 Index 为 7,681 行、52 个 Builder、50 处 route 赋值，用于定位拆分范围，**不是目标行数预算或正确性阈值**。根只保留原生根声明与装配 scope 的获取/释放、按只读导航/根展示输入挂载页面及保留阅读层、根背景/既定安全区边界、捕获事件与 Back/生命周期转交。

每次迁出一项职责，应列出原字段/方法、实际后继 owner、输入输出和生命周期，并确认 Index 中对应的可变状态、请求构造、直接调用及路由写点已经消失。目标 Index 不直接调用 Core/I/O、不拥有 feature 私有可变投影、不写 route/返回上下文；这些依赖、状态与调用约束比行数更有意义。必要 import、类型或接线可以增加，不规定任意硬行数或机械“不许增长”；整体改名搬进一个巨大 Controller 也不构成拆分完成。

## 3. 业务模块：具体 owner、状态与输入输出

### 3.1 书架、导入与移除

| 现有文件 | 逻辑去向与决定 | 输入/输出和生命周期 |
| --- | --- | --- |
| `BookshelfHost.ets` | `features/bookshelf/application` façade，**适配** | 绑定当前 runtime；提供现有 projection/catalog/operations/readable-admission owner；不能让页面构造平行 owner |
| `BookshelfProjectionOwner.ts`、`BookshelfReadOwner.ts` | `features/bookshelf/application` 的 read projection，**直接复用** | `attach(BookshelfProjectionBinding)`、`refresh/page/accept` → `BookshelfProjectionSnapshot`。绑定含 identity、current、anchorKey；`detach(identity)` 只解除当前展示 |
| `BookshelfCatalogOwner.ts`、`BookshelfCatalogUpdate.ts` | `features/bookshelf/application` 的 catalog 协调，**直接复用** | 更新进度与目录事实投影；不由顶栏 spinner 推导任务完成 |
| `BookshelfOperationOwner.ts`、`BookshelfManagementIntentStore.ts` | `features/bookshelf/application` 的 mutation 协调，**保留** | `openImport/closeImport/importFiles/remove/reconcile` → `BookshelfOperationSnapshot`；runtime 级受理、mutex、receipt 与 recovery 持续存在 |
| `LocalImportPresentationOwner.ts` | `features/bookshelf/presentation` 的既有 opening 状态，**保留** | `fileSelection/pickerOpening/importing/result`、opening identity、恢复串；继续受 `BookshelfOperationOwner` 控制，不能在拆目录时另起独立导入执行器 |
| `LocalBookImportGateway.ts`、`BookshelfFlowGateway.ts` | `features/bookshelf/application` 的 Core-Host 适配，**直接复用** | picker preparation → `import.parse/import.persist` → 原资源提交与 bookshelf ACK → finalize/恢复；UI 只见 `LocalImportBatch/Item`，不见 URI、路径和 rollback token |
| `BookshelfViewState.ts`、`BookshelfViewModeHost.ts` | 前者归 `features/bookshelf/presentation`，后者保持既定偏好 owner 并归 `features/bookshelf/application`，**保留** | 锚点、展开和点击来源是展示状态；已持久化的视图模式/分组/筛选不因命名含 View 而改归属 |
| `BookshelfPage/EmptyPage/StatusContent/MultiSelectPage/LocalImportDialog.ets` | `features/bookshelf/ui`，**适配** | 只渲染真实投影并提交具名意图；保留 List/Grid、稳定实体 key 和锚点算法；普通动作/表面复用公共组件 |

书架跨页面展示身份当前有 `rssInstanceIdentity` 等历史命名。后续可以在明确绑定迁移时改为语义准确的 presentation instance 名称，但不能以改名重置导入 opening、退休原 receipt，或把序号改成可随意复用的布尔值。

### 3.2 书架搜索与详情入口

| 现有文件 | 逻辑去向与决定 | 输入/输出和生命周期 |
| --- | --- | --- |
| `SearchHost.ets` | `features/search/application` 与 `features/search/presentation` 的装配点，**适配** | 保留 `prepareEntry/open/close/visibilityChanged/search/stop/retry/refreshSources`；对 UI 输出 publication revision、presentation 与来源快照 |
| `SearchOrchestrator.ets`、`SearchGateway.ts` | `features/search/application`，**直接复用** | 关键词及来源范围 → 原请求/停止/阶段状态/增量结果；不迁移 Core 规则执行到 Presenter |
| `SearchPublication.ts`、`SearchPresentation.ts` | `features/search/presentation` 的合同与发布，**直接复用** | 大快照由稳定 owner 保存，只跨 ArkUI 传数值 revision；不得改成每个动画 tick 经 `@Prop` 深拷贝全部结果 |
| `SearchViewState.ts` | `features/search/presentation`，**直接复用** | 草稿、类型/分类、展开、显示顺序、滚动锚点和焦点请求；详情往返沿用原展示状态，新入口与新查询按现有 `prepareEntry/search` 的 `reset()` 语义重置，重挂载时局部面板按原合同关闭 |
| `ReaderLibrarySearchModel.ets`、`ReaderLibrarySearchSurface.ets` | `features/search/ui` 的 library/search 组合与 `features/search/presentation` 展示模型，**保留+适配** | `idle/input/results`、共用顶栏、历史与过渡插值；保留单宿主，绑定公共 Header/Action/Surface 几何端点，不再复制另一套按钮与抬升规则 |
| `SearchPage.ets`、结果/筛选/历史/task panel | `features/search/ui`，**适配** | 接受发布事实与有界展示状态；发查询、停止、选择结果等意图；不决定“已经入架”或业务 ACK |
| `features/reading/application/BookAcquisitionCoordinator.ts`、`BookAcquisitionProjectionGateway.ts` | `features/reading/application` 的 entry/acquisition 协调，生命周期由 `app/composition/runtime` 装配，**保留** | 候选身份与资格 → 获取/详情投影；搜索预览不自动成为书架写入 |

`SearchHost` 当前为获取 `SearchPresentation` 从 `SearchPage` 反向导入类型。目标是改从现有 `SearchPresentation.ts` 获取，其他实际页面文件导出业务类型的同类入口一并归回 feature 合同。这里是依赖方向修正，不是再增加一个公共泛型 ScreenState。

### 3.3 设置、书源管理与规则工具

| 现有文件 | 逻辑去向与决定 | 输入/输出和生命周期 |
| --- | --- | --- |
| `SettingsHost.ets`、`SettingsOrchestrator.ets`、`SettingsGateway.ts` | `features/settings/application`，**直接复用/适配** | `bindPresentation(owner, identity, current)`、`open/toggle/restoreDefaults/reconcile/retryAccepted` → `SettingsSnapshot` 与独立 `SettingsOperationProjection`；退休页面只 detach |
| `SettingsCacheCleanupOwner.ts` | `features/settings/application` 的原清理操作 owner，**保留** | `clear/reconcile/continueOriginal` → `SettingsCacheCleanupSnapshot`；清理反馈不重跑一笔新清理 |
| `LocalConfigurationReset.ts` | `features/settings/application` 的 reset 协调，**保留** | 已有恢复屏障、偏好重置和确认语义；不由通用设置行一次性改写多个独立存储 |
| `SettingsPage.ets`、`SettingsShell.ets`、`BookshelfSettingsPage.ets`、`ReaderMessagePreviewPage.ets` | 对应 `features/<feature>/ui` 与 `features/<feature>/presentation`，**适配** | home/general/developer/preview 返回与局部选择状态在展示层；开关值读取权威 snapshot，草稿不当已保存值 |
| `SourceHost.ets`、`SourceOrchestrator.ets`、`SourceGateway.ts` | `features/source/application`，**直接复用/适配** | `bindPresentation`、`open/retryLoad/toggleSource/checkSource/loginSource/importBookSources/reconcile/continueOriginal` → 来源投影/原操作投影；保留 attach 同步发布与当前绑定先设置的时序 |
| `SourceToolsOrchestrator.ets`、工具 Gateway | `features/source/application` 的 tools 协调，**保留** | `attachPresentation/detachPresentation`、选中/导出/检查/删除/编辑/调试/继续原操作 → `SourceToolsSnapshot`；编辑草稿可以留在该有界 owner，不能为“纯 MVVM”复制一份并行编辑状态 |
| `SourceManagementPage.ets`、`SourceToolsPage.ets`、`JsonImportDialog.ets` | `features/source/ui`；JSON 外框归 `ui/patterns`，导入上下文归该 feature，**适配** | 搜索/分组展示、暂选、字段编辑与任务结果；删除仍走 Core 原事务并保留书架/正文/进度 |
| `RulesManagementOrchestrator.ets`、`RulesMutationOwner.ts`、`RulesMutationIntentStore.ts`、`RulesManagementPage.ets` | `features/settings/{application,presentation,ui}` 的 rules 职责，**保留/适配** | 保留原写入 owner、冷恢复与精确 receipt；当前正式入口是否可达须独立核对，不凭文件存在宣布开放 |

来源列表是设置、搜索、书架需要的共享业务读模型，不是公共 UI 的状态。`SourceHost.loadSourcesForIds` 等现有有界接口可继续供业务协调使用；公共 `SelectPanel/TopBar` 不得因此直接 import `SourceGateway`。

### 3.4 下载与存储展示

| 现有文件 | 逻辑去向与决定 | 输入/输出和生命周期 |
| --- | --- | --- |
| `SharedDownloadCoordinator.ts`、`SharedDownloadIntentPreferences.ts` | `features/downloads/application` 的 runtime task，**保留** | `submit/submitBook/operate`，`snapshot/subscribe/restore`；原 Core 队列、Host 物化和既定持久意图分工保持，导航不拥有取消 |
| `SharedDownloadHost.ts`、`SharedDownloadProjection.ts` | `features/downloads/application` 的读适配与 `features/downloads/presentation` 的投影，**直接复用/适配** | `reload/resume/refreshBook/runAction` → `SharedDownloadSnapshot`；保留按下载 clock/catalog revision 的索引，不用 UI 组件复制缓存状态 |
| `SharedDownloadStorageGateway.ts` | `features/downloads/application` 的 storage-Host 适配，非 UI 存储执行归 `platform`，**保留** | 容量、清理、受保护阅读内容与资源事实，不能移入通用 bottom dock |
| `SharedDownloadPage.ets` | `features/downloads/ui` 与 `features/downloads/presentation`，**适配** | `SharedDownloadViewState` 的 query/type/state/选择/锚点与返回上下文留在该展示实例；传回 `SharedDownloadUiIntent`，页退出只停止展示订阅 |
| Index 中的 retained snapshot/owner/return context | `features/downloads/presentation` 与 `app/navigation` 的返回适配，**拆分适配** | 快照只能在相同 runtime、membership/catalog/status revision 有效时复用；不能因为返回页面就覆盖任务状态 |

`SharedDownloadProjectionRefreshError` 已区分任务动作完成与列表投影读取失败。新的 ScreenState 必须保留此区别，不能把一次刷新失败显示成“下载/删除失败”，再错误重放原动作。

### 3.5 阅读入口、正文、漫画、目录与附属能力

| 现有文件 | 逻辑去向与决定 | 输入/输出和生命周期 |
| --- | --- | --- |
| `ReadingEntryHost.ts` | `features/reading/application` 的 entry 协调，**直接复用** | `ReadingEntryLease` 提供当前性、投影准入、membership、changed、cacheDecision 等；输出 `ReadingEntrySnapshot`。候选/目录/正文资格仍由原 owner 决定 |
| `LocalBookDetail.ets`、`MangaBookPresentation.ts`、detail 页面接线 | `features/reading/ui` 与 `features/reading/presentation` 的 detail 职责，**适配** | 书籍身份、目录、资格、入架事实与动作可用性分开；详情往返来源由导航参数表达 |
| `ReaderShell.ets` | `features/reading/ui` 的组合 UI，**保留** | 当前文字/漫画宿主、目录、换源与控制层组合；按准确 `readingIdentityKey` 转发退出和回调。它不是所有页面都必须经过的通用 Scene |
| `LocalReadingExperience.ets` | `features/reading/ui` 的 experience 专用 UI 与会话接线，**拆分适配** | 保留文字分页、滚动、手势与可见页生命周期；将独立设置/目录/内容搜索/反馈投影和平台接线迁向各现有 owner。不能按行数平均切块，不能整文件搬成 ViewModel |
| `ReadingSurface.ets`、`ReaderNativeParagraph*`、`ReaderParagraphLayoutOwner.ts`、`ReaderPhysicalPaginationOwner.ts` | `features/reading/ui` 的 rendering 职责，**保留** | `ReadingSurface` 是纯正文绘制，不是业务阅读 session。排版、正文测量、选区、翻页与原生段落不放进公共页面 renderer |
| `ReadingSessionFlowGateway.ts`、`ReadingSessionProgressOwner.ts`、`ReadingProgressJournal.ts`、`ReadingProgressIntentFile.ts`、`ReaderReadingRecordHost.ts` | `features/reading/application` 的 progress 与既定恢复存储，**保留** | 位置/时长的精确原写入、CAS、handoff、receipt 和冷恢复；UI 不维护第二份已保存位置，不迁移 journal 格式或存储 |
| `MangaReadingSurface.ets`、`MangaSessionController.ts`、`MangaSessionGateway.ts`、`MangaResourceGateway.ts`、`MangaChapterPreparationCoordinator.ts` | `features/manga/ui` 与 `features/manga/application` 的 session policy/资源适配，**保留** | Controller 管 manifest/页/tile/显示位置与请求归属；Host 管调度/字节/解码。`close('exit'\|'chapter'\|'candidate')` 有不同语义，不能统一成页面 hidden 时全部销毁 |
| `BookDirectoryPage.ets`、`ReaderFullDirectory.ets`、`FullDirectoryPanel.ets`、`ReaderDirectoryProjection.ts` | `features/reading/ui`、`features/reading/presentation` 的 catalog 职责，**保留+适配** | 独立目录和阅读目录保留各自承载；共用章节行/工具/选择语义。实体身份、目录修订、目标证明与纯浏览上下文必须保留，不把整本目录复制为可写公共模型 |
| `ReaderDirectoryHost.ts`、`ReadingOfflineHost.ts`、`ReadingOperationIntents.ts` | `features/reading/application` 的书签/离线操作，**直接复用** | `ReaderDirectoryBinding/ReadingOfflineBinding` 的 session/entity/current 与操作快照；已有内容、排队 ACK、物化阶段及未知写入分别输出 |
| `SourceSwitchHost.ts`、`SourceSwitchWindow.ets`、`SourceSwitchCompletionPresentation.ts` | `features/source/{application,presentation,ui}` 的 source-switch 职责，**保留** | `SourceSwitchContext/Lease/Snapshot/Effect`、`blocksExit/resolveTransaction`；预览、目标目录选择、提交和最终呈现确认不变成普通 Select 组件的行为 |
| `ReaderContentSearchPublication.ets`、内容搜索面板 | `features/reading/presentation` 的内容搜索，**直接复用/适配** | generation、cursor、分页结果由既有 publication 持有；新查询/取消释放游标，退休后的旧结果不能发布；类型最终归独立合同，不反向依赖面板实现 |
| `ReaderTtsConfigurationHost.ts`、`ReaderTtsSessionCoordinator.ts`、TTS Gateway/媒体 Host | `features/reading/application` 与 `platform` 的媒体/TTS 实现，**保留** | 配置 draft、durable receipt、激活与语音播放 session 分离；凭据仍走既定 credential store，不能通过 ScreenState 向无关组件传播密钥 |
| `ReaderControlRuntime.ts`、`ReaderControlHostSession.ts`、`ReaderAutoPageCoordinator.ts`、外观/控制动效模块 | `features/reading/ui` 的 control 专用交互，**保留** | 手势采样、原生焦点、动画和自动翻页局部运行；不把每帧 pointer/velocity 提交全应用 reducer |

正文翻页、漫画页/tile、进度写入、下载和 TTS 不是同一个“播放状态”。共用基础控件不等于合并它们的状态机或持久化。

### 3.6 未开放与内部入口

`features/discover`、`features/rss`、`features/sync` 及未实现设置保持既定关闭状态。其 `RssOrchestrator/RssRouteOperationHost/RssPresentationProjection`、`RssSubscriptionEditorOrchestrator`、`SyncOrchestrator` 仍归各自 feature，原恢复与写入 owner 保留。不为了减少 Index 行数将其登记为“已接入当前产品”，也不为了统一模块物理删除用户数据或原恢复材料。

`BookshelfManagementPage`、`RulesManagementPage` 两个独立页登记为 `unconfirmed`：有文件、有回调或 Core 命令不等于可见准入，需核对实际入口。开发页与消息预览已有 SettingsPage 条件可见入口，登记为 `visible` 的内部入口；必须复用正式公共组件，但预览证据不计真实业务验收。共享基础组件改动需要维护这些现存消费方的编译/接口合同，未开放产品的开放仍是另一项决定。

## 4. 公共基础与平台边界

| 现有文件族 | 拟定逻辑去向 | 决定与边界 |
| --- | --- | --- |
| `ReaderTokens/ReaderLayoutTokens/ReaderTypography/ReaderFontFamilies/ReaderThemeRegistry/ReaderThemeSelection/MotionSpec` | `ui/foundation` | **直接复用+适配**。语义 role、字形与单位是公共合同；Reader 专用正文角色可保留在领域层，不能把漫画或来源 feature 的实现反向 import 为基础 |
| `ReaderIconButton/ReaderButton/ReaderPressFeedback/ReaderSearchField` 及 `ReaderControlSpecs` | `ui/controls` | **适配**。一个完整动作组件负责原生命中、焦点、按压、disabled、可访问语义；业务传 label/eligibility/intent，不在页面重画同类按钮 |
| `AppTopBar/PageBackBar/ReaderHeaderSpecs`、`ReaderRaisedSurface/ReaderSurfaceSpecs` | 顶栏/表面实现归 `ui/patterns`，共享语义规格归 `ui/foundation` | **适配**。有限顶栏家族共享实际几何与动作基座；floating、material、elevation 分别表达。漫画视觉变体通过有限 data recipe 接入，退出公共层对 `MangaDirectoryVisual/PressFeedback` 的实现依赖 |
| `ReaderPageScaffold/ReaderStandardPage/ReaderFixedHeaderHost/ReaderPageScrollHost`、geometry/frame/measurement 模块 | `ui/layout` 的共用协议/原生适配；领域组合仍归 feature | **直接复用+适配**。沿用唯一 `resolveReaderPageGeometry`；每页面实例只有一个输入/测量 owner，同一解析快照交给绘制和滚动消费者。StandardPage 服务标准 Scroll，领域宿主保留具名适配，不强制汇入一个万能页面 |
| `ReaderDialogSurface/ReaderSelectPanel`、既定 popup/sheet 外框 | `ui/patterns`；原生 UI 承载归 `ui/platform` | **适配**。外框、承载、动作区域、命中与焦点有单一 owner；内容槽不获得平台原生窗口的第二份阴影/遮罩权 |
| `ReaderTransientFeedback/ReaderRecoveryNotice/ReaderRecoveryAction/ReaderPageState`、`app/ReaderNativeAlertOwner.ets` | 消息呈现归 `ui/messages`，原生确认 adapter 归 `ui/platform` | **直接复用**。遵守已有消息分类；调用者提供原事实和捕获动作，不建设拥有业务重试权的全局提示中心 |
| `ReaderCoreGateway.ts`、`@reader/core-harmony`、`ReaderWriteEvidence` | Core bridge/通用执行证据归 `platform/core`，feature 命令适配归 `features/<feature>/application` | **保留**。协议与执行证据可共用；生产命令只从 feature application/平台适配进入，公共 View 不发原始 JSON RPC |
| `ReaderOperationFacts/ReaderPersistedReceiptProjection` | UI 消费的通用事实合同归 `ui/foundation`，具体业务投影归 `features/<feature>/presentation` | **保留**。只调整合同归属，不改变读取、写入确认和物化事实的原 owner |
| `HttpExecuteHost/ArkWebExecutor/ArkWebExecutionHost/CookieSessionStore/ReaderHostRegistry` | 非 UI 执行与能力装配归 `platform/network-web`；原生 ArkWeb UI 承载部分归 `ui/platform` | **保留**。Core request 的原始网络/会话/登录执行；不得把来源兼容解析再实现于 UI |
| `ReaderClipboardHost/ReaderCustomFontHost/LocalEpubResourceHost/ReaderBrightnessWriter`、各文件能力 | `platform` 下对应非 UI 能力 | **保留**。只通过窄接口调用；系统内部 UI 不由组件库复制 |
| `ReadingBodyImageHost/ReadingImageDiskCache/MangaImageMetadataHost/MangaImageDecodeHost/MangaImageGraphicsHost` | 资源实现归 `platform`；reading/manga 的业务能力接口归 `features/reading/application`、`features/manga/application` | **保留**。Host 预算、文件和 PixelMap lease 不归 ScreenState，不引入新的通用缓存/解码算法 |

`ReaderSurfaceSpecs` 当前引用来源切换视觉数据、公共控件规格中混合许多领域 recipe。目标是把业务配方留在该 feature、把确实共享的数据型视觉 role 归入 `ui/foundation`；不把所有现有常量强行拼成一个 global design object。只在真实消费方已绑定新 recipe 后退役原生产分支。

### 单一几何协议与每实例唯一 owner

采用 **同一宿主输入 → 同一纯求解器 → 同一解析输出** 的合同，沿用 `ReaderPageGeometryInput`、`resolveReaderPageGeometry`、`ReaderPageGeometry` 和 `ReaderScrollLayout`。统一的是输入含义、测量采纳、避让和快照消费，不要求所有页面经过同一个组件，也不新增 PageRuntime。当前 MainTabShell 与 StandardPage 已复用同一 resolver，不能根据七个布局文件推断存在七套算法。

| 输入/处理 | 唯一归属与输出规则 |
| --- | --- |
| 环境事实 | `ReaderWindowCoordinator` 发布只读窗口、avoid area、密度、字号、键盘与 revision；ThemeHost 保持主题发布。不得再建窗口 store |
| 宿主输入 | 指定页面 owner 汇合真实本地宽高、已消费安全区边界、导航占位、有限布局/表面配方及有身份的 header/footer 测量；坐标和单位明确，不能用屏幕全宽替代局部实测 |
| 导航占位 | MainTabShell/原 MainNavigationSpec 给出 bottom/rail 与 `contentLeadingRail/contentEndInset`；不把导航状态复制到几何 owner |
| 解析输出 | 只有指定 owner 闭合该实例输入并调用既有 resolver；header/content/footer/overlay 与原生滚动消费同一只读 geometry/ScrollLayout，不能各算一份或重复施加避让 |
| 绘制与实测回报 | Scaffold 只接收解析好的 geometry、有限 FrameStyle、槽和测量 key，执行 frame/层级/命中/裁剪；FixedHeaderHost/ScrollHost 执行原生承载。它们不再解析另一份几何；回报由原 owner 校验布局身份后采纳 |

两类消费者适配共用上述协议，不能在同一实例并存两套 owner：

- **标准 Scroll 页面**：`ReaderStandardPage` 拥有本地宽高、header/footer MeasurementStore 与布局 key。MainTabShell 包装它时只提交导航占位和槽；StandardPage 将同一快照交给 Scaffold、ScrollHost 和 overlay，并以 `onViewportChange(width,height)` 回报已采纳的真实宽高。SettingsShell 只负责 home/general 组合与返回。当前 `MainTabShell.ets:93–97` 传入该回报及两个占位字段，`ReaderStandardPage.ets:18–28` 未声明，`:81–84` 只测宽；UI-01 首先贯通真实设置链的声明、类型、宽高、占位和实际消费。
- **原生列表与领域专用页面**：指定已有 feature 组合适配为 owner，例如书架组合、ReaderLibrarySearchSurface、ReaderShell 及目录/来源/下载页面的组合职责；各自用同一纯 resolver/协议闭合本实例输入，再把同一快照交给 draw-only Scaffold、原 List/Grid/Scroller 或专用 viewport。领域组合直接接共同布局协议，保留锚点、正文树、资源/手势和高频采样。页面 owner 之外的子组件不能重算普通页级几何；正文排版、漫画图条和内部面板的领域布局仍归原实现。

`ReaderPageShell`、`ReaderFrameStyle` 保留必要纯规则/类型，公共层收紧任意外观和重复输入；内部化、合并或退役以真实消费者和职责去向为依据，不要求七个文件合成一个文件，也不一律禁止领域适配消费公共原生承载。应退出的是同一实例竞争的输入/测量 owner、页面私算的同类预算、重复外框和无消费者兼容出口；合法领域适配不是必须删除的旧债务。

## 5. 接口与状态所有权合同

### 5.1 展示 API

Feature UI 接受该 feature 已有 snapshot/publication、展示状态、环境事实及具名动作。复杂列表继续使用稳定 owner + 数值 revision；简单页面可直接接收小型不可变 snapshot，不要求全部通过统一 selector 框架。

| 边界 | 输入 | 输出 | owner 与禁止行为 |
| --- | --- | --- | --- |
| Bookshelf projection | `BookshelfFilter`、binding identity/current、锚点 key | `BookshelfProjectionSnapshot` | Core 决定书架和游标；页面拥有滚动；投影不能派发删除/导入 |
| Search publication | 原 `SearchPresentation`、来源/书架只读更新 | publication revision、稳定结果快照 | SearchHost 统一推进 revision；UI 不按另一份来源数组自行派发范围 |
| Settings/Source presentation binding | runtime、presentation identity、current | 对应 snapshot 与独立操作 projection | attach/detach 只改变展示归属；原 Orchestrator 的已受理工作保持 |
| Reading entry | `ReadingEntryLease`、实体/候选/session 上下文 | `ReadingEntrySnapshot`、有限 effect | 原 entry owner 决定资格；导航不以目录存在性或书架存在性替代 |
| Directory/offline | 原 binding、章节/书签身份、当前证明、操作意图 | 原操作 snapshot/receipt 与目录投影 | 继续原写入与重新读取分开；不把展示刷新当事务确认 |
| Download projection | runtime、current、原 action target/期望章节 | `SharedDownloadSnapshot` 与 action outcome | 任务在 coordinator；页面卸载不能取消下载 |
| 公共控件/表面 | label/value/enabled/busy/selected、有限视觉 recipe、内容槽 | tap/change/confirm/dismiss 等语义意图 | 不创建 gateway、事务、导航或自动重试 |

新增“完整 ScreenState”表示对已有合同进行有界组合，不再保存一份同字段可独立改写的业务模型。字段必须注明权威来源与 revision；本地草稿应与已保存值分离。回执的 confirmation、readback 和 materialization 不能被一个 `success:boolean` 压平。

### 5.2 身份与失效

不引入通用 token 生成框架。沿用现有 runtime、presentation identity、operation generation、book/source/session proof 和 layout revision，只在跨异步边界需要时捕获。

- runtime 退休：旧能力与新 UI 不能绑定；保留原清理/close 过程，前代结束后才安装后代。
- 页面/展示实例退休：detach 展示，失效焦点、原生 popup/alert、测量和局部动画回调；不把它当取消 Core 写入。
- 换书/换源/目录修订：旧实体及证明失效，保留原事务与资源清理职责；不能只比页面可见性。
- 窗口、字体或密度变化：只更新相关布局代次及测量，不重建搜索/导入/下载任务，不重置已保存偏好。
- 同步控件内部的按压、光标和拖动插值：本地处理；不机械附加所有身份或包装成 reducer action。

### 5.3 同会话保留与进程重建

同一 runtime 和有效实体内的返回/隐藏，沿用各 feature 原有的查询、筛选、锚点、草稿及局部表面保留规则；重新挂载时原本应关闭的菜单/筛选仍关闭，不承诺所有临时状态原样保持。进程死亡或新 runtime 冷启动后，未持久化查询、展开、暂选、草稿、滚动锚点、焦点和测量默认重置，不恢复旧 callback、Scroller、PixelMap 或目录证明。

原先已持久化的显示模式/筛选偏好、设置、Core 搜索历史、阅读位置/时长和已受理操作，仍由原存储、journal/receipt 与恢复 owner 恢复，再形成当前展示投影；不能按字段名称一律清空，也不能恢复 UI 时自动重发业务操作。本轮不新增 UI 数据库、跨进程路由栈或原始 View 状态序列化。新增持久展示状态须另列产品需求、字段/版本、有效身份、失效回退与唯一 owner。

## 6. 主题、窗口与环境传播

现有 `ReaderThemeHost` 是主题的唯一平台发布入口。它订阅 runtime 的 `ReaderAppearanceStore`，经既定保存链发布 `readerAppThemeMode/readerAppScheme/readerAppearanceRevision`，并通知窗口 chrome。`ReaderWindowCoordinator` 是窗口、avoid area、密度、字号、键盘与系统条观察/应用的权威入口。

目标传播路径：

```text
EntryAbility：系统 scheme / Configuration / WindowStage
  → ReaderThemeHost + ReaderWindowCoordinator
  → 只读 theme/appearance revision + ReaderWindowMetricsSnapshot
  → 本页指定 owner（StandardPage 或具名领域适配）/ 公共组件语义 token
  → 既有唯一几何 resolver → 同一只读快照 → 绘制/滚动消费者
  → ArkUI 实际绘制与带代次的测量回执
```

迁移期间保留现有 AppStorage 环境桥接，不另增全局可变 AppEnvironmentStore。可以提取只读环境合同使基础组件不必依赖产品 runtime，但写入端仍只有现有 publisher。所有 `@StorageLink` 消费者只观察；业务设置操作走原保存 owner，不能直接写一个 storage key 就宣称主题已持久保存。

App 与 Reader 的主题域分别消费：App 页面用应用语义 role；正文与阅读控制保留 `ReaderAppearanceSnapshot`、正文纹理、对比度和专用角色。统一组件行为不强制统一正文配色。

安全区由宿主声明是否已消费、消费哪个坐标边界；基础组件使用相同 snapshot，不从屏幕像素反推。普通顶栏、浮动栏及专用阅读宿主分别声明 padding owner，不能父壳和子栏同时补避让。Canvas/shadow 等物理像素转换仅在原生适配边界完成。

## 7. 保留当前导航机制，收拢有限接线

### 7.1 本轮采用决定

**本轮保留既有 ReaderRoute 与同级 retained reader，不迁移 Navigation/NavPathStack/NavDestination。** 将 route 状态、generation、有限返回上下文、退出后目的地和系统文件导航接线归入 `app/navigation` 的唯一写入 owner；Index 只消费只读根展示输入和转交捕获事件。此决定控制职责迁移范围，不证明原生 Navigation 无法支持保留阅读，也不新建通用路由引擎。

`Scene` 仅描述激活、隐藏、返回与保留关系，不新增同名通用 class、平行栈或全局弹层队列。目的地仍接受稳定实体标识、捕获的返回上下文及有界展示引用，不保存整份可写书籍模型。底栏与侧轨呈现同一导航事实；业务准入、写入 ACK、取消与 Core 目录判定留在原 owner。

按具体职责抽取导航接线，每个字段只有一个写入 owner；迁入后同步删除 Index 的对应写点，不能留下两份可写 route/返回上下文再双向同步。尚未迁出的接线如实登记，不把目录搬迁当成导航所有权已经收拢。

### 7.2 阅读保留与退出合同

`ReaderShell` 当前提供 `onExitRequestHandler`、`onExit(readerIdentity)`、`onExitCancelled(readerIdentity)`。产品导航只注册并调用这个有限退出入口，随后按相同阅读身份消费结果；不能直接改 route 销毁阅读树而绕过退出交接。

文字当前实现需要保留以下次序：

1. `LocalReadingExperience.requestExit()` 先处理真实 IME、临时控制层和控制面板返回。
2. `beginExit()` 收束尚未提交的拖动/settlement，停止不再适用的采样与局部计时。
3. `finishExit()` 在 unmount 前将时长及展示位置交接给现有 runtime/gateway owner，按当前合同处理 TTS，并交付 `onExit()`。
4. 原 `ReadingSessionProgressOwner`、journal 和对应网关继续完成已经受理的写入及恢复。**磁盘/Native ACK 不加入导航等待链**；交接不等于原写入已经确认，可选内存保留也不是退出前置。

因此本方案的“保存退出适配”是既有同步捕获/交接、手势收束与身份检查，不是新增一个等待所有持久化成功的全局保存屏障。不能把源码中的历史注释当成当前执行路径：需以实际 `requestExit/beginExit/finishExit/handoffExitProgress` 为准。

漫画继续按 `MangaSessionController` 的 session/progress lane 和 `close(intent)` 管理章节、候选及真正退出。隐藏、换章与候选取消不等价；PixelMap/tile lease 释放、尚未确认的进度和源切换事务不能合成一个 `onDisappear → cancelAll`。

保留层只在原合同允许的隐藏/准备路径保持同一实例并停用交互/焦点。当前阅读→详情/下载等明确调用 `exit('navigation')` 的路径仍先交接并退出，再由原返回上下文重新准入；不能为“保留会话”统一改成永久隐藏同一个活跃 reader。是否隐藏、显式退出或重新进入由实际路径决定，不由公共页面壳推断。

`ReaderSystemFileOpenNavigationHost` 继续检查当前 reader identity、`switchBlocked` 和原事务处理，再请求退出并等待相同身份的退出交付。`SourceSwitchHost.blocksExit/resolveTransaction` 的判定留在原业务边界，不由通用导航壳猜测。

### 7.3 有限导航适配必须保持的行为

将现有职责迁归 `app/navigation` 时，保持以下合同，不同时替换承载机制：

- 书架↔搜索保持同一个 `ReaderLibrarySearchSurface`、查询与锚点，不因抽取导航接线重建顶栏或发起第二次查询。
- 已隐藏但保留的 `ReaderShell` 有明确交互/焦点/可访问失活规则；显式退出路径继续退出，不能混为一种生命周期。
- 程序导航、系统返回、局部面板返回和系统文件 Want 都经过同一有限退出入口；旧 reader 的 onExit 不能改变新页面。
- 阅读→详情/目录/下载→返回的原有 parent、实体和 view state 可恢复；源切换未知写入、进度交接和资源保护不会因导航方案改变归属。
- 转场取消/减少动态效果/窗口变化能够终结旧测量和旧共享元素租约；动画回执不冒充业务成功。

出现差异时先定位原接线、身份与退出时序，不通过新增框架掩盖回归。未来若有导航替换需求，另列真实旅程等价与资源合同，本轮不据外部应用的 NavPathStack 用法推定必须迁移。

### 7.4 首批设置与早期复杂路径可行性复核

先形成设置首页/通用/书架设置的一条完整纵切，贯通本页几何、所需控件、原 owner、保存/未决/返回及被替代路径退出，再逐旅程扩展。在首批公共合同定型前，对书架搜索单宿主/共享头栏和阅读/漫画隐藏与显式退出、实际 viewport/资源寿命作一次有界可行性复核，提前发现合同不能表达的边界。复核限定为原源码路径、必要输入输出和具体缺口，不展开这两条完整迁移，也不把纸面复核当设备验收；发现缺口先修共用合同，避免直到全量迁移时才返工。

## 8. 三条实际旅程的数据流

### 8.1 从系统文件打开一本书，随后返回书架

```text
Want → ReaderSystemFileOpenHost/既有队列
     → LocalBookImportGateway → Host 文件准备 + Core parse/persist/书架 ACK/finalize
     → 队列结果（成功书籍或失败事实）
     → ReaderSystemFileOpenNavigationHost.consume()
     → 原阅读 session 检查/有限退出（若当前正在阅读）
     → ReadingEntryHost → ReaderShell → LocalReadingExperience 或 MangaReadingSurface
     → 原退出交接 → 书架投影刷新/原锚点恢复
```

队列 owner 不被新页面替换；导入失败/未知结果及已保存文件保留原恢复语义。导航 acknowledge 不证明导入或可见帧成功。书架内手动导入是另一合法入口：`BookshelfOperationOwner.importFiles → BookshelfFlowGateway → LocalBookImportGateway`，两者复用相同导入边界，不以合并入口为由另建导入事务。

### 8.2 从书架搜索，查看详情，加入并开始阅读

```text
Library 组合 UI：idle → input/results（草稿/动画/焦点）
  → SearchHost.search(keyword, scopeSourceIds)
  → SearchOrchestrator/Gateway → Core/Host → SearchPublication + revision
  → SearchPage 稳定结果/锚点
  → BookAcquisitionCoordinator + ReadingEntryHost：详情/目录/正文资格
  → 用户明确入架 → 原业务写入 owner/Core ACK → 对应事实投影
  → ReaderShell 的已准入阅读 session
```

搜索预览不自动写书架；详情返回保留当前查询/显示顺序/锚点。从来源管理返回后，`SearchHost` 的来源更新推进相同 publication revision，再决定下一次提交范围，不能让筛选显示与实际 source IDs 分叉。入架未决仍显示原操作恢复，后续书架读到同名书不代替 ACK。

### 8.3 从阅读目录下载章节，退出去下载页，再回同一本书

```text
目录的真实章节身份/证明 + 下载意图
  → ReadingOfflineHost / SharedDownloadCoordinator
  → Core 队列与 Host 物化 → 原操作 receipt/materialization/进度
  → 用户打开下载页 → ReaderShell 有限退出与 runtime 交接
  → SharedDownloadHost.reload/resume → SharedDownloadSnapshot
  → SharedDownloadPage（筛选/暂选/锚点）
  → 用户选择继续阅读 → 原章节准入 → ReadingEntryHost/ReaderShell
```

离开目录或下载页不取消已受理任务；暂停/取消/删除必须是针对真实 target 的显式业务意图。任务控制成功而列表投影失败分开显示。返回阅读不以旧 snapshot 覆盖 coordinator clock，也不让下载页销毁阅读进度恢复 owner。

## 9. 旧入口退出条件与完成边界

| 旧入口/职责 | 可退役的具体条件 | 必须继续保留的部分 |
| --- | --- | --- |
| Index 中某 feature 的快照写入、请求构造及局部表面状态 | 该 feature 的真实入口、返回、重建及未决态由现有 owner/有界 presentation 输出；Index 对应字段、方法、直接请求与私有状态已消失，只剩允许的根组合/转交 | 原已受理工作、精确 receipt、恢复记录与数据 |
| Index 中的 route 写点、返回上下文与系统文件导航接线 | 既有 ReaderRoute 的对应职责归 app/navigation 单一 owner，Index 只读；同批移除旧写点及无人消费兼容出口 | 原 route/retained reader 机制、有限退出/源切换/系统文件合同；本轮不换原生栈 |
| 同一实例重复的几何输入、测量与页面预算 | 明确该实例的 StandardPage 或具名领域 owner，绘制/滚动/overlay 已消费同一 resolver 输出，竞争写点与重复避让已退出 | 两类合法消费者适配、原生列表/Scroller 与领域渲染；必要纯规则/类型及原生承载文件可保留 |
| 页面自画顶栏、按钮、同类表面 | 动作、几何、测量、焦点、按压、可访问语义及真实状态均从共同实现接入，原分支无生产消费者 | 阅读正文、漫画、书架搜索变形等合法专用组合 |
| 公共组件反向导入具体 feature 实现 | 共享数据 recipe/合同已归基础或由 feature 明确注入，生产绘制真正消费；不只新增一个未使用 spec | 有依据的有限视觉差异和原业务 owner |
| Page 导出业务/presentation 类型供 Host 使用 | 独立 feature 合同成为唯一类型入口，页面和 owner 均消费它，所有旧 re-export 引用已消除 | 现有协议及 payload identity，不用迁移强制深拷贝大列表 |
| 静态旧占位或重复 renderer 分支 | 明确用户范围、可达性、恢复用途、实际接管者及兼容条件后再退出 | 未开放模块既定关闭状态、可恢复源代码和用户数据 |

规划完成仅表示职责、接口、数据流与退出条件已经明确。后续需分别记录源码接入、必要本地验证、构建/签名、设备行为与用户验收；本附件不提供任何这些执行结果，也不新增默认门禁。
