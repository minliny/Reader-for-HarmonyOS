# UI 目标架构：实际页面与表面迁移范围

日期：2026-11-05。状态：实施前范围附件，未修改生产代码，未执行测试、编译、打包或设备操作。

本附件细化[目标架构方案](ui-target-architecture-20261105.md)，以 HarmonyOS `663c6ee59e65b6a6afe2d9fa4bb18919a63cbabe` 的实际入口、组件挂载和产品准入为输入。当前 compatible/target 为 `6.1.0(23)`；未来 API 26 规划不作为本次已有能力。九类审查发现来源为 FnOS 上的 `docs/issues/ui-architecture-audit-20261105.md`（本地未提供该文件，仅标记来源），只提供问题证据，不构成本附件的全部范围。实施进度仍进入工作区唯一待办；本文件是范围与验收合同，不建立另一份长期问题总账。

首个可审阅候选限定为设置首页、通用设置与书架设置：UI-01 的 G-L1 宿主合同和最小依赖方向/API检查、设置所需的 UI-02 基础能力、UI-03 的真实消费者与同职责旧路径退出一起闭环。之后主消费者批次按书源/工具 → 下载 → 书架搜索与宽屏导航 → 阅读/漫画及其他可见路径串行展开。完整范围仍为下述 20 路由和 15 类非路由入口；三类代表纵切最终均须以自己的生产路径证明，不能由设置成功代替其余两类。

## 1. 登记规则与两个独立轴

产品可达性：

- `visible`：存在当前产品入口；包括条件进入、保留挂载以及当前产品流程中的失败/恢复表面，不表示所有用户每次都看见。
- `closed`：当前产品准入明确关闭。保留源码及其共用依赖，不能计入当前可见体验的迁移完成分母。
- `unconfirmed`：有分支或回调，但尚未证实当前可见触发链；不得凭路由存在认定可见，也不凭暂未发现入口删除实现。

接入方式：

- `common`：同类基础行为和绘制由公共家族实际实现。
- `domain`：保留具名领域宿主与内容实现，消费公共基础能力并满足共同合同。当前可见阅读、漫画、目录仍属于完整迁移范围。
- `platform`：复用系统窗口或平台能力；统一调用、身份、关闭、焦点与错误边界，不复制系统内部 UI。

两轴独立。一项可同时包含公共动作、领域内容和平台承载，下面按各自子项注明；不能把 `domain` 当成“不迁移”。迁移进度和验证结果另行记账，下面的处理决定均不是完成状态：

| 决定 | 含义 | 退出条件 |
| --- | --- | --- |
| `DIRECT` | 沿用已满足用途的平台/既有上游 API 或现有实现，不复制其通用能力 | 当前SDK/用途/配置适用，并有实际调用边界；不表示本次已验证 |
| `ADAPT` | 迁入目标家族或修正实际组合/承载合同 | 当前消费者、必要状态及旧路径退出均有证据 |
| `KEEP` | 保留有依据的领域实现或平台能力 | 明确输入/输出、身份与生命周期，并证明未被公共重构破坏；不是豁免验收 |
| `RETIRE` | 在替代消费者全部迁出后退出同职责旧路径 | 真实无消费者、替代能力及数据/生命周期保留已核对；未执行删除不能记成已退役 |
| `REFERENCE_ONLY` | 仅参考外部应用或历史设计，不纳入生产实现 | 不复制其数据库/运行时，不转移其测试/视觉结果；本文的当前生产开发预览不属于此类 |
| `DEFER` | 延后该关闭或未证实入口的产品体验迁移 | 保留关闭/入口核对条件；受本次公共 API 变化影响的源码依赖仍做最小适配，不开放产品 |

“目标家族”使用用途名称，不预先创建新类、统一 reducer、Scene 运行时或页面渲染器。实际类名、文件归属与公共家族合同以总方案及相应组件附件为准。

## 2. 全部 20 个 ReaderRoute

路由全集来自 [Index 的 ReaderRoute](../../entry/src/main/ets/pages/Index.ets#L262)，当前根分发为 [indexContent](../../entry/src/main/ets/pages/Index.ets#L1366)。当前分类为 11 个 `visible`、7 个 `closed`、2 个 `unconfirmed`；这是入口盘点，不是通过率。非路由表面另见第 4 节。

| ID / ReaderRoute | 可达性 | 接入 / 决定 | 实际文件、当前壳与顶栏 | 迁移组 |
| --- | --- | --- | --- | --- |
| R01 `bookshelf` | visible | domain + common / ADAPT | [Index.bookshelfShellContent](../../entry/src/main/ets/pages/Index.ets#L1112) → [BookshelfShell](../../entry/src/main/ets/features/bookshelf/ui/BookshelfShell.ets#L213) → MainTabShell/Scaffold；壳头隐藏，由同级 ReaderLibrarySearchSurface 画实际顶栏；内容为 BookshelfPage/EmptyPage/StatusContent | G1 |
| R02 `discover` | closed | domain + common / DEFER | [DiscoverPage](../../entry/src/main/ets/features/discover/ui/DiscoverPage.ets#L99) → MainTabShell；AppTopBar；Index 分支受产品开关约束 | G9 |
| R03 `detail` | visible | domain + common / ADAPT | [Index.detailSurface](../../entry/src/main/ets/pages/Index.ets#L1831) → [LocalBookDetail](../../entry/src/main/ets/features/reading/ui/LocalBookDetail.ets#L166) → Scaffold；PageBackBar 浮动变体；文字/漫画详情与字体准备分支 | G5 |
| R04 `reading` | visible | domain / ADAPT；正文引擎 KEEP | [Index 保留层](../../entry/src/main/ets/pages/Index.ets#L1432) → [ReaderShell](../../entry/src/main/ets/features/reading/ui/ReaderShell.ets#L182) → Scaffold；文字 LocalReadingExperience/ReadingSurface，漫画 MangaReadingSurface；专用控制栏 | G7 |
| R05 `directory` | visible | domain / ADAPT；目录目标与原 List KEEP | [Index.externalDirectory](../../entry/src/main/ets/pages/Index.ets#L1875) 与 [ReaderShell.readingOverlay](../../entry/src/main/ets/features/reading/ui/ReaderShell.ets#L319)；文字 ReaderFullDirectory，漫画 BookDirectoryPage；独立目录工具/浮动返回栏 | G6 |
| R06 `search` | visible | domain + common / ADAPT | [SearchPage](../../entry/src/main/ets/features/search/ui/SearchPage.ets#L584) 使用 Scaffold 且隐藏 header；[Index.librarySearchSurface](../../entry/src/main/ets/pages/Index.ets#L1305) 持有外置公共搜索面，结果仍是 SearchPage 原生 List | G1 |
| R07 `bookshelfManagement` | unconfirmed | common + domain / DEFER | [Index 保留分支](../../entry/src/main/ets/pages/Index.ets#L1507) → [BookshelfManagementPage](../../entry/src/main/ets/features/bookshelf/ui/BookshelfManagementPage.ets#L74) → StandardPage + PageBackBar。当前书架“批量管理”接入 R08 `bookshelfMultiSelect`，单书分组接入 N05；独立管理页打开方法未见生产触发器 | G10 |
| R08 `bookshelfMultiSelect` | visible | common + domain / ADAPT | [Index](../../entry/src/main/ets/pages/Index.ets#L1380) → [BookshelfMultiSelectPage](../../entry/src/main/ets/features/bookshelf/ui/BookshelfMultiSelectPage.ets#L70) → Scaffold；私有 selectionTopBar/removeBar | G2 |
| R09 `bookshelfSettings` | visible | common / ADAPT | [设置首页入口](../../entry/src/main/ets/features/settings/ui/SettingsPage.ets#L305) → [BookshelfSettingsPage](../../entry/src/main/ets/features/bookshelf/ui/BookshelfSettingsPage.ets#L142) → StandardPage + PageBackBar；开关、短枚举与内容卡 | G3 |
| R10 `rss` | closed | common + domain / DEFER | [RssPage](../../entry/src/main/ets/features/rss/ui/RssPage.ets#L104) → MainTabShell；复合 RSS 顶栏 | G9 |
| R11 `rssSubscriptionManagement` | closed | common + domain / DEFER | [RssSubscriptionManagementPage](../../entry/src/main/ets/features/rss/ui/RssSubscriptionManagementPage.ets#L81) → StandardPage + PageBackBar | G9 |
| R12 `rssSourceFeed` | closed | common + domain / DEFER | [RssSourceFeedPage](../../entry/src/main/ets/features/rss/ui/RssSourceFeedPage.ets#L61) → StandardPage + PageBackBar；需要已选订阅 | G9 |
| R13 `rssEntryDetail` | closed | common + domain / DEFER | [RssEntryDetailPage](../../entry/src/main/ets/features/rss/ui/RssEntryDetailPage.ets#L73) → StandardPage + PageBackBar；需要订阅及条目，保留原朗读/原文动作 | G9 |
| R14 `rssSubscriptionEditor` | closed | common + domain / DEFER | [RssSubscriptionEditorPage](../../entry/src/main/ets/features/rss/ui/RssSubscriptionEditorPage.ets#L53) → StandardPage + PageBackBar；创建/编辑两种输入上下文 | G9 |
| R15 `settings` | visible | common / ADAPT | [SettingsShell](../../entry/src/main/ets/features/settings/ui/SettingsShell.ets#L33)：首页 MainTabShell.standardScroll → StandardPage + AppTopBar；通用页 StandardPage + PageBackBar；开发/预览是内部模式 | G3 |
| R16 `rulesManagement` | unconfirmed | common + domain / DEFER | [Index 保留分支](../../entry/src/main/ets/pages/Index.ets#L1535) → [RulesManagementSurface](../../entry/src/main/ets/features/settings/ui/RulesManagementSurface.ets#L6) → [RulesManagementPage](../../entry/src/main/ets/features/settings/ui/RulesManagementPage.ets#L96) → StandardPage + PageBackBar。设置和阅读仍有回调接线，当前生产界面没有调用这些回调的可见动作 | G10 |
| R17 `source` | visible | common + domain / ADAPT | [设置首页入口](../../entry/src/main/ets/features/settings/ui/SettingsPage.ets#L301) → [SourceManagementPage](../../entry/src/main/ets/features/source/ui/SourceManagementPage.ets#L215) → Scaffold + PageBackBar；搜索、分组选择及原生 List | G4 |
| R18 `sourceTools` | visible | common + domain / ADAPT | [书源管理工具入口](../../entry/src/main/ets/features/source/ui/SourceManagementPage.ets#L282) → [SourceToolsPage](../../entry/src/main/ets/features/source/ui/SourceToolsPage.ets#L229) → StandardPage + PageBackBar；批量操作、表单与编辑/调试结果 | G4 |
| R19 `sync` | closed | common + domain / DEFER | [Index.syncContent](../../entry/src/main/ets/pages/Index.ets#L1601) → [SyncPage](../../entry/src/main/ets/features/sync/ui/SyncPage.ets#L89) → StandardPage + PageBackBar；未就绪分支显式 Scaffold 空几何 | G9 |
| R20 `downloads` | visible | common + domain / ADAPT | [Index.downloadsSurface](../../entry/src/main/ets/pages/Index.ets#L2239) → [SharedDownloadPage](../../entry/src/main/ets/features/downloads/ui/SharedDownloadPage.ets#L222) → Scaffold；页面复合 topBar/compactHeader、dock、自绘 sheet/确认 | G8 |

关闭依据是 [ReaderProductScope 的 l0 配置](../../entry/src/main/ets/app/ReaderProductScope.ts#L17) 与 Index 的受控分发，不是界面是否画完。`unconfirmed` 两项不自动变成 `closed`；实施核对发现真实入口时更新可达性，并将其有效用途加入当前迁移范围，不能沿用旧分母排除。

### 2.1 当前导航选择与 Index 的残留职责

本轮保留现有 `ReaderRoute` 与 retained reader 组合，**不迁移到 `NavPathStack`**。当前生产 ETS 没有 `Navigation/NavPathStack/NavDestination` 调用；此轮提取导航归属而不同时更换承载。这个选择不表示 ArkUI 无法支持阅读生命周期；后续若需要替换，须另定范围并证明当前可达旅程等价，不并存两套完整路由状态。

目标由 `app/navigation` 唯一写入当前 route、导航代次、有限返回上下文、保留层可见性与退出后目的地，并承接 `ReaderSystemFileOpenNavigationHost` 的有限接线。底栏与侧轨消费同一导航事实。Index 只保留原生根声明、产品装配 scope 的获取/释放、根组合挂载、Back 与生命周期转发；**迁出后的 Index 路由写入目标为 0**，不镜像业务快照或构造业务请求。不能把原单体整体搬成另一个通用 Coordinator。

当前 [Index](../../entry/src/main/ets/pages/Index.ets#L262) 为 7,681 行；按上述职责清单推导尺寸预算，审阅实际残留并记录尺寸/依赖/状态基线，不预设缺乏实现依据的统一行数门槛。每个迁移批次列清已迁出的导航/业务职责及剩余引用，最终以职责闭合、路由写入为零及可审阅的根组合为准，文件变短不能单独证明完成。

保留与退出分别处理。同一实体的隐藏层仍满足原测量、输入/焦点停用和旧回调退休合同；显式阅读到详情/下载仍经 [requestReaderBookInfo](../../entry/src/main/ets/pages/Index.ets#L2356) / [requestReaderDownloads](../../entry/src/main/ets/pages/Index.ets#L1343) 请求 `exit('navigation')`，由 [onReaderExited](../../entry/src/main/ets/pages/Index.ets#L2411) 核对 runtime 与 reader identity 后推进目的地，不改成所有目的地都永久隐藏保留同一 reader。文字进度/时长仍同步交接 Runtime，后台磁盘/Native ACK 不进入导航等待链；漫画退出按原控制器。系统文件的 [有限导航 Host](../../entry/src/main/ets/app/navigation/ReaderSystemFileOpenNavigationHost.ts) 保留换源判定、当前身份、同一退出交付及队列语义，不转移导入/事务事实。

## 3. 路由组的实际迁移合同

### G1：Library 的书架、搜索和共用顶栏（R01/R06）

- **当前生产链：**[bookshelfContent](../../entry/src/main/ets/pages/Index.ets#L1029) 分 populated/确认空/加载或失败；[searchPageSurface](../../entry/src/main/ets/pages/Index.ets#L1259) 绑定 SearchHost、Publication 与页面身份；[librarySearchSurface](../../entry/src/main/ets/pages/Index.ets#L1305) 是书架与搜索的同一个实际头面，不能重新拆成两个页面私有顶栏。
- **目标 / 决定：**ADAPT。首页/搜索顶栏基础、IconAction/TextAction、SearchField、内容卡/行、筛选/任务表面、页面几何和导航占位归公共家族；ReaderLibrarySearchSurface 的过渡编排、书架内容和结果 List 属 domain，KEEP 其具名宿主、原锚点与稳定 key。
- **保留 owner：**BookshelfOperationOwner/BookshelfHost，SearchHost/SearchOrchestrator/Publication，原入架/阅读准入及导航身份。输入草稿、筛选和暂选归展示状态；已提交查询及其执行身份不搬进基础控件。
- **必要有效状态：**真空书架与尚未读到不能混同；列表/网格、分组/内容筛选、分页、继续阅读卡、更新进行中；idle→输入历史→结果，历史加载/失败/清空、搜索进行中/停止/部分结果/零结果/无可用来源/失败、有旧结果刷新失败；进入详情返回、滚动中返回、过渡中断、前后台及被保留阅读覆盖。具体状态以原 owner 事实驱动，不新增搜索或更新业务。
- **退役路径：**替代真实头面中的重复基础动作、标题排版、材料/阴影和散落几何；不以 AppTopBar 未使用浮动分支代替真实消费者迁移。被替代的头面基础绘制分支、兼容测量入口及无消费者分支经正反向引用核对后 RETIRE；KEEP ReaderLibrarySearchSurface 的单宿主、原动画编排和结果 List。
- **验收：**修改公共家族参数能同时影响实际书架与搜索；展开历史、筛选/任务面板可关闭并恢复触发源；主内容和持续 chrome 按同一几何避让；旧查询/过渡/测量回执不操作新实例；返回查询、筛选与列表锚点仍在。画面、原生交互和源码接线分别记录。

### G2：选择管理（R08）

- **当前：**[BookshelfMultiSelectPage](../../entry/src/main/ets/features/bookshelf/ui/BookshelfMultiSelectPage.ets#L70) 的 Scaffold、selectionTopBar、removeBar 和原 List；入口来自书架长按/管理，Index 仍提供选择集合与删除意图。
- **目标 / 决定：**ADAPT 到选择型顶栏、勾选行/书籍展示、批量动作 dock 和确认家族；KEEP 原实体 key、列表及 BookshelfOperationOwner 的批量移除事务。
- **必要状态：**准备、空可选集合、零/部分/全选、选择对象刷新失效、删除 busy/未决/明确完成或失败、返回受阻；长标题、大字和底部动作不能遮掉最后一项。
- **退役与验收：**删除被替代的私有顶栏/按钮/移除栏绘制，不删除选择语义。选中状态、禁用/busy 和目标范围由事实显示；确认只提交一次意图；退出不伪造取消，旧选中集合不跨书架版本误删。

### G3：设置、书架设置及内部预览（R09/R15）

- **当前：**SettingsShell 首页/通用两条壳链；[BookshelfSettingsPage](../../entry/src/main/ets/features/bookshelf/ui/BookshelfSettingsPage.ets#L142)；SettingsPage 内部 [developerPage](../../entry/src/main/ets/features/settings/ui/SettingsPage.ets#L260) 和 ReaderMessagePreviewPage。真实首页入口见 [buildHome](../../entry/src/main/ets/features/settings/ui/SettingsPage.ets#L295)。
- **目标 / 决定：**ADAPT。公共首页/返回顶栏、导航/开关/选择/只读/危险操作行、字段组/卡、Toggle/短枚举/选择面板、确认与消息；标准滚动页由 ReaderStandardPage 接通真实 viewport、rail、头部测量及尾部预算，并拥有这一实例的滚动/几何解析。开发预览复用同一实现，不能成为第二套演示控件。
- **保留 owner：**SettingsHost/SettingsOrchestrator、已有设置 operation、持久偏好与凭据归属；页面只保留草稿、当前节及局部选择/预览身份。
- **必要状态：**首页/通用/书架设置返回；选择打开/关闭/暂选/确认；保存 busy、原写入未决、读回失败但原写入已确认、恢复默认确认；开发页/消息预览退出；窗口/rail切换与长文。受 unimplementedSettings 关闭的权限/关于内容仍 closed。
- **退役与验收：**退出普通开关与“封面/列表”的手绘平行路径、普通卡和恢复默认私有外框、同一行与内控件的双交互 owner。整行/内部控件只有明确责任；保存事实不由 UI 乐观猜测；导航轨道占位与视口回报实际贯通，原底栏预算不会在 rail 模式继续被错误套用。
- **首个宿主闭环 G-L1：**真实设置宿主的 viewport 输入/回报、头部测量、底栏与 rail 互斥占位、尾部/键盘预算须闭合，并选择与改动有关的短窗口/长文/字号组合验证。首个候选同时包含该宿主合同、最小方向/API检查、必要控件接线及旧路径退出；先提供限定源码与当前编译证据，再为代码无法回答的布局/交互问题选择有界设备证据。N14 仅支持定位与状态预览，不代替真实设置验收，也不另设产品纵切门禁。

### G4：书源管理、工具与任务详情（R17/R18）

- **当前：**SourceManagementPage 的 List/搜索/分组下拉、PageBackBar；SourceToolsPage 的 StandardPage、批量选择、导出/编辑/调试卡；[Index.sourceManagementSurface](../../entry/src/main/ets/pages/Index.ets#L2643) 与 [sourceToolsSurface](../../entry/src/main/ets/pages/Index.ets#L2604) 把意图交给原 owner。
- **目标 / 决定：**ADAPT 到返回/工具顶栏、公共动作、分组 SelectTrigger/Choice、搜索字段、设置/选项行、表单组/卡和任务表面。检查/调试日志内容及来源条目是 domain；系统登录和文件窗口是 platform。
- **保留 owner：**SourceHost/SourceOrchestrator、SourceToolsOrchestrator，原 Core 命令与 Host 登录/文件/网络能力。UI 不新增启停、删除、导入或检测状态机。
- **必要状态：**首次加载/确认空/有内容、检索与分组、单项/批量选中、启停/检测/登录忙态、导入和导出、字段无效/编辑/调试部分结果与完整日志；明确失败、旧内容仍可用、写入未决/继续原操作；返回与原生窗口关闭。
- **退役与验收：**替代紧凑按钮直接等于触控区域、无 selected/disabled 语义的选择项、每卡重复外框和普通顶栏漫画行为依赖；原 List、检测任务和导入/删除数据保护不变。长内容可达，日志不强行变 Toast，旧来源/操作回调失效，读回成功不等于重发写入。

### G5：文字/漫画详情（R03）

- **当前：**LocalBookDetail 的实际 Scaffold、浮动 PageBackBar、详情内容/dock；[detailSurface](../../entry/src/main/ets/pages/Index.ets#L1831) 在独立目录上方切换可见/输入/焦点，但保留同一详情实例。
- **目标 / 决定：**ADAPT 公共返回/工具动作、详情表面、信息行/卡、底部动作与页态；KEEP 文字/漫画信息结构、详情实体身份与保留滚动，不强制相同内容布局。
- **保留 owner：**原详情获取与目录读取、入架/取消准入、BookshelfOperationOwner、ReadingEntryHost、SourceSwitchHost 与移除事务。
- **必要状态：**字体/内容准备、失败或部分元信息、已入架/未入架、获取/入架 busy、取消请求/结果未决、阅读被阻、文字/漫画目录、换源、移除确认；目录返回恢复详情而不重建其操作。
- **退役与验收：**删除被公共家族替代的普通动作/外框/阴影和重复间距算式；不删除详情业务 Builder 或漫画目录入口。新书替换后旧回调无权更新；被目录隐藏时不接输入/焦点；继续阅读/入架意图遵守原准入而非控件推断。

### G6：目录的所有上下文（R05）

- **当前分支必须独立登记：**详情文字 [Index → ReaderFullDirectory](../../entry/src/main/ets/pages/Index.ets#L1910)；详情漫画 [Index → BookDirectoryPage](../../entry/src/main/ets/pages/Index.ets#L1875)；阅读文字/漫画 [ReaderShell.readingOverlay](../../entry/src/main/ets/features/reading/ui/ReaderShell.ets#L319)。另外，漫画换源候选目录是同级非路由表面 N07。BookDirectoryPage 的文字 standard 分支是保留 fallback，不可冒充当前生产文字详情目录。
- **目标 / 决定：**ADAPT 目录型顶栏基础、搜索/筛选/排序/选择控件、菜单/popup、通知和几何；KEEP ReaderFullDirectory、FullDirectoryPanel、BookDirectoryPage、ReaderDirectoryNavigationSurface 的领域组合、原 List/Grid/LazyForEach、可读卷组和目标解析。
- **保留 owner：**ReaderDirectoryHost/SessionState/规则 gateway、原目录 projection/target proof、书签/离线 operation 和当前阅读会话；界面不能把显示行序号当真实章节位置。
- **必要状态：**detail/reader 来源、文字/漫画、准备/空/失败/已有结果局部刷新失败、卷展开、检索/排序/筛选、锚点等待和定位、详情无已存锚点浏览、书签、离线进度/菜单与规则编辑未决。详情 top inset 和阅读窗口边缘的归属分别保留。
- **退役与验收：**替代重复工具钮、菜单框、行内普通选择、恢复外框和避让算式；不统一为普通返回页或大 Scroll。每个分支分别证明公共基础接入，不能用漫画成功代替文字；详情浏览不虚构阅读位置，阅读目录仍等有效锚点；下载 popup 与恢复提示的临时避让不丢操作身份。

### G7：小说/漫画阅读及保留会话（R04，关联 R05）

- **当前：**ReaderShell 在 Index 同级保留，`visible` 与是否挂载不同；[文字阅读](../../entry/src/main/ets/features/reading/ui/ReaderShell.ets#L222)、[漫画阅读](../../entry/src/main/ets/features/reading/ui/ReaderShell.ets#L414)、LocalReadingExperience、ReadingSurface 与专用控制/目录/换源层。
- **目标 / 决定：**ADAPT 控制栏的公共动作/选择/字段、Reader 域材料与主题入口、局部面板承载、页态/消息、可访问及几何合同。KEEP 正文分页/翻页、漫画缩放/平移/图条/tile、原资源占位几何、阅读启动过渡和会话 owner；禁止将整个阅读界面以“引擎不重构”为由排除。
- **保留 owner：**ReadingEntryHost、原 LocalReadingExperience/RemoteReadingSession、进度 producer/reading record、ReadingOfflineHost、MangaSession/Resource gateways、TTS session/background/media owner。公共控件不保存另一份位置或承担停止/重试权限。
- **必要状态：**本地/远程文字、漫画；准备/首次失败/资源局部失败/已有正文；控制收起/快捷/展开和中断；目录、正文搜索、外观、替换编辑、TTS 配置与更多；章节转换/章末/书签手势；退出保存未决、隐藏准备、保留会话/恢复可见、换书后旧回调、后台朗读。不可把打开面板或隐藏页面自动等同于暂停任务。
- **退出合同：**文字阅读沿用当前同步 Runtime handoff：手势/页面收束后同步交付进度与时长，随后交付 onExit；后台 ACK/恢复由原 owner 继续，不能改为等待磁盘或 Native ACK 才返回。漫画关闭与资源释放按 MangaSessionController 的原合同保留，不套用文字实现细节。
- **退役与验收：**移除被基础家族替代的重复动作/选项/字段/表面，不删除专用正文宿主、引擎或手势。App 主题不会覆盖 Reader 纸面；局部面板互斥/返回/焦点与原 session 身份一致；测量变化不新建任务，回退与退出保持原同步捕获/交接及身份合同，不新增等待磁盘/Native ACK 的屏障。

### G8：下载管理、章节、存储及操作表面（R20）

- **当前：**SharedDownloadPage 的 Scaffold、fixedHeader/topBar/compactHeader、原 List/dock、自绘 [sheetOverlay](../../entry/src/main/ets/features/downloads/ui/SharedDownloadPage.ets#L893) 与 ReaderDialogSurface 确认；来源可为设置、书架更多或阅读流程。
- **目标 / 决定：**ADAPT 复合/选择型顶栏基础、筛选/选择、Action/TextAction、任务行与状态、dock、表面标题/动作和 dialog/sheet 材料；KEEP 下载任务与内容 List 组合、原滚动/章节锚点。当前 sheet 是自绘，不能因文档旧表格写 native sheet 而误迁系统所有权。
- **保留 owner：**SharedDownloadHost/Gateway/StorageGateway、Core 下载/离线事实和资源租约；UI 选择是展示状态，暂停/继续/取消/清理仍归原任务 owner。
- **必要状态：**书籍/章节层级、加载/确认空/失败/有旧内容、搜索/筛选/选择管理、任务运行/暂停/失败/部分完成/取消结果与进度、存储投影和清理确认、操作面板开关；短窗口/大字下头栏迁内联与面板内部滚动、键盘 resize。
- **退役与验收：**退出重复普通按钮、卡/表面框与头栏材料计算，不取消原 topBar 在两位置间迁移的唯一测量语义。最后一行可读、头栏不压首项；关闭 UI 不取消任务；旧 presentation/任务回调不污染新列表；结果未决与普通失败不合并。

### G9：明确关闭的 7 个路由（R02/R10–R14/R19）

- **决定：**DEFER 当前产品体验；保留 Discover/RSS/Sync 各自 Orchestrator、任务、原数据与准入。共用 API 改动涉及它们时，做明确的源码兼容接线；不增加可见入口、不启动这些流程，也不把保留源码当体验完成。
- **未来目标：**Discover/RSS 首页消费主导航及有限复合顶栏；管理/编辑/Feed/详情/Sync 消费返回顶栏、行/表单/选择/任务、消息与原生窗口家族。保留订阅/条目、同步配置与恢复事务的领域差异。
- **开放前状态：**Discover 分类/榜单/加载/失败；RSS 订阅管理/创建编辑/Feed/条目、抓取/导入部分结果、朗读与条目动作；Sync 配置准备、字段/凭据、连接/备份/恢复冲突、结果未决。这些是既有路径的开放条件，不是本次授权开发的新能力。
- **退役与验收：**关闭源码仍引用的旧公共 API 必须有明确去向；不能为退役 API 私自删掉模块，也不能永久保留第二套公共 UI。开放时重新核对真实入口、动作槽预算、消息类别、平台承载和事务身份，并为当前候选单独选择验证；历史 PASS 不转移。

### G10：入口未证实的 2 个独立页（R07/R16）

- **决定：**DEFER 产品体验，保留 BookshelfHost/BookshelfManagementOrchestrator、RulesManagementOrchestrator 与数据。核对重点是“可见触发器 → 原回调 → 导航准入 → 真实组件”，而非仅有 open 方法、ReaderShell 回调或 route 分支。
- R07 的 [书架更多菜单](../../entry/src/main/ets/features/bookshelf/ui/BookshelfMoreActionSheet.ets#L36) 经 [BookshelfShell](../../entry/src/main/ets/features/bookshelf/ui/BookshelfShell.ets#L254) 和 [Index](../../entry/src/main/ets/pages/Index.ets#L783) 打开 R08。`openBookshelfManagement()` 只有保留定义；N05 直接从 [单书操作](../../entry/src/main/ets/features/bookshelf/ui/BookshelfPage.ets#L493) 绑定原管理操作，分组持久意图继续由原 owner 处理。
- R16 的 [设置装配](../../entry/src/main/ets/app/composition/SettingsScenes.ets#L57) 传入回调，[设置首页](../../entry/src/main/ets/features/settings/ui/SettingsPage.ets#L298) 未绘制对应行。阅读经 ReaderShell 保留保存退出桥，当前 [替换控制](../../entry/src/main/ets/features/reading/ui/ReaderControlPanel.ets#L1471) 在阅读场景内展开，直接执行该场景的替换规则操作。N04 `ruleBundle` 只由独立规则页发起；N12 的阅读内替换导入沿独立的读取和合并入口。
- [当前产品配置](../../entry/src/main/ets/app/ReaderProductScope.ts#L17) 为 `l0`，两页未各自定义产品开关，因可见触发器缺失仍按 `unconfirmed` 留档。重新纳入可见范围前应有明确的产品准入和实装触发器。R07 核对分组实体、书籍分配、未决操作及书架返回。R16 按开放入口核对规则编辑与导入、设置返回，或阅读保存交接与返回身份。
- **未来目标：**普通返回/工具栏、管理行/表单/选择、卡与任务/恢复家族。分组弹窗 N05 目前可见，它与独立 bookshelfManagement 页面不能互相替代；阅读内替换规则编辑 N12 也不能代替独立 rulesManagement 的可达性证据。
- **必要保留状态：**分组/书籍分配与规则实体编辑的选择、草稿、保存/导入/删除、busy/未决/继续原操作及返回上下文；未确认前不声称已执行交互。
- **退役与验收：**先裁定入口归属。确认可见则纳入相应批次；确认仅保留则登记开放条件。旧公共依赖随 API 变更最小适配；删除生产路径必须基于真实无消费者证据，不以“暂没用到”决定。

## 4. 非路由入口、覆盖层与原生窗口

这些入口与 20 路由分别登记。它们不能因为不属于 ReaderRoute 而漏迁，也不能被统一塞入一个全局弹窗管理器。

| ID / 可达性 / 接入 / 决定 | 实际入口与当前承载 | 目标家族及必须保留的 owner | 必要状态、退役与验收条件 |
| --- | --- | --- | --- |
| N01 启动与根恢复；visible / common + platform / ADAPT | [EntryAbility.onWindowStageCreate](../../entry/src/main/ets/entryability/EntryAbility.ets#L241) → ReaderStartupContentOwner；Index 无法挂载时用 [ReaderStartupRecovery](../../entry/src/main/ets/pages/ReaderStartupRecovery.ets#L23) 的 Scroll + ReaderPageState，无普通页面顶栏 | 根准备/失败页态、公共动作和环境几何；KEEP 启动 owner、runtime/恢复事务与系统窗口 loadContent 能力 | 初始化/恢复等待、主内容加载失败、重试、退出失败、旧 window stage 回执。恢复界面不能依赖尚未挂载的 Index；退出重复动作/几何计算，不清数据、不把恢复加载失败报成已显示成功 |
| N02 根保留层与书架阅读过渡；visible / domain / KEEP，基础能力 ADAPT | [Index.build](../../entry/src/main/ets/pages/Index.ets#L1350) 的 BookshelfNavigationTransition；indexContent 保留书架背景、LibrarySearchSurface、ReaderShell 同级挂载 | 既有过渡 compositor、测量和窗口合同；KEEP 导航 motion request、阅读准入/退出与实体身份 | 打开/返回、中断、隐藏准备、前后台/reduceMotion、切书和旧测量。基础动作/材料统一后退出重复来源，不删除共享顶栏或改为两套完整导航状态；隐藏层不能截输入/焦点 |
| N03 本地文件导入；visible / domain + platform / ADAPT | [Index.localImportSurface](../../entry/src/main/ets/pages/Index.ets#L1194) → LocalImportDialog；选择/进度/结果使用 ReaderBoundedSurface；系统 picker 另有平台 owner | 导入表面标题/动作、任务进度/逐项结果、恢复/反馈和文件能力边界；KEEP BookshelfOperationOwner、importIdentity、原批次与读回/清理事实 | 选择取消、导入进行/部分完成/明确失败、结果未知/核对、关闭后任务继续、重新打开与旧picker回调。退出重复外框/按钮，保留专用结果内容；关闭提示不取消批次，读回失败不重新导入 |
| N04 JSON 导入；bookSource visible，ruleBundle unconfirmed，rssMerge/rssReplace closed / common + domain + platform / ADAPT或DEFER按上下文 | [Index.jsonImportSurface](../../entry/src/main/ets/pages/Index.ets#L1794) → [JsonImportDialog](../../entry/src/main/ets/features/common/JsonImportDialog.ets#L50)。`ruleBundle` 由独立规则页的导入动作发起，并按该页身份交给 `RulesManagementPresentation` 关联的操作 owner | 表单/字段验证、Dialog标题/动作/遮罩与平台picker；KEEP 原 context、SourceHost/Rules/RSS owner 和导入命令 | URL草稿/无效值、键盘、提交/取消、选择返回及原业务结果。退出私有同层外框/不一致输入行为，不把不同上下文的事务合成通用import store；旧context回调不得导入到新页面 |
| N05 书籍分组；visible / common + domain / ADAPT | [单书操作](../../entry/src/main/ets/features/bookshelf/ui/BookshelfPage.ets#L493) → [BookshelfGroupDialog](../../entry/src/main/ets/features/bookshelf/ui/BookshelfGroupDialog.ets#L8) 与 [BookshelfGroupPresentation](../../entry/src/main/ets/features/bookshelf/presentation/BookshelfGroupPresentation.ets#L20)，按书籍和打开身份绑定原 `BookshelfHost` 管理操作 | Dialog/互斥选择/行与恢复家族；KEEP 原 BookshelfHost 的分配操作、book/presentation身份 | 当前/默认分组、选择提交、busy/未决/继续原操作、遮罩与返回。退出重复选择/动作绘制；关闭只退役展示，不伪造分配成功或取消；本项可见不证明R07可见 |
| N06 移除书籍确认；visible / common + platform / ADAPT | [Index.openBookRemovalDialog](../../entry/src/main/ets/pages/Index.ets#L5234) 的 CustomDialogController → [BookRemovalDialog](../../entry/src/main/ets/features/bookshelf/ui/BookRemovalDialog.ets#L24) → ReaderDialogSurface；单本/批量/详情共享 | 确认卡、危险动作与长文滚动；KEEP 原移除目标、一次确认与 BookshelfOperationOwner | 取消/确认、长书名/批量说明、忙态前后、旧controller回调、宿主退出。退出各处同类外框与独立尺寸补偿，不把 UI 关闭等于业务 ACK；不能卸载或清原始文件来简化流程 |
| N07 换源抽屉及漫画候选目录；visible / domain + common / ADAPT | [Index.sourceSwitchOverlayContent](../../entry/src/main/ets/pages/Index.ets#L6124)（详情/书架）；[ReaderShell.sourceSwitchOverlayContent](../../entry/src/main/ets/features/reading/ui/ReaderShell.ets#L382)（阅读）→ SourceSwitchPanel/SourceSwitchWindow；[Index.mangaSourceSwitchDirectory](../../entry/src/main/ets/pages/Index.ets#L1953) 为同级 BookDirectoryPage | 抽屉/标题动作/候选行/页态/恢复；KEEP SourceSwitchHost/Gateway、scopeId与事务，漫画首图验证和明确章节选择 | 搜索中/停止/候选/空/失败、准备/允许取消/提交、结果未知/回滚、候选目录返回。退出重复scrim/外框/普通按钮，保留两类来源宿主和原状态权限；临时目录不提前改写原来源/阅读位置 |
| N08 系统原生确认与预览；visible按原宿主 / platform + common / KEEP平台承载，ADAPT调用合同 | [SettingsPage](../../entry/src/main/ets/features/settings/ui/SettingsPage.ets#L707)、[SourceToolsPage](../../entry/src/main/ets/features/source/ui/SourceToolsPage.ets#L765)、[LocalReadingExperience](../../entry/src/main/ets/features/reading/ui/LocalReadingExperience.ets#L2019)、Index经 ReaderNativeAlertOwner 的已登记桥 | NativeAlertOwner/既定确认类别；KEEP 原 lease、确认/取消、业务 operation 与系统几何 | 可取消/不可重复决策、默认焦点、页面/实体退出、旧lease、展示失败。只迁已改变的入口；原生API留登记边界，不为了统一外观全部改自绘或额外画第二框 |
| N09 菜单、内联选择与popup；visible按消费者 / common + domain + platform / ADAPT | ReaderSelect/ReaderInlineSelect/ReaderSelectPanel；[ReaderControlPanel.bindPopup](../../entry/src/main/ets/features/reading/ui/ReaderControlPanel.ets#L1569)；[ReaderMangaDownloadPopup](../../entry/src/main/ets/features/manga/ui/ReaderMangaDownloadPopup.ets#L23)；BookshelfMoreMenu等保留实现按真实引用裁定，不靠名字认定活跃 | SelectTrigger/Choice、菜单行、有限popup宿主、公共动作；KEEP 触发Scene/实体、原选择提交与漫画下载gateway；漫画动作适配留feature | 展开/收起、选中/disabled/busy、位置溢出、自动关闭/返回、旧触发器和原生关闭回执。退出重复触发器/选项行为与同层外框；native窗口与内容分别拥有边缘，不双画；无当前消费的legacy菜单不计可见完成 |
| N10 native sheet；visible / common + domain + platform / ADAPT | [BookshelfShell.bindSheet](../../entry/src/main/ets/features/bookshelf/ui/BookshelfShell.ets#L226) 的更多；[BookshelfPage.bindSheet](../../entry/src/main/ets/features/bookshelf/ui/BookshelfPage.ets#L415) 的书籍操作；[SearchFilterPanel](../../entry/src/main/ets/features/search/ui/ReaderSearchFilterPanel.ets#L265) 和 [SearchTaskPanel](../../entry/src/main/ets/features/search/ui/ReaderSearchTaskPanel.ets#L193) | Sheet宿主/标题动作/行/任务内容；KEEP 当前presentationId、原书籍/搜索task owner、系统关闭与窗口chrome lease | 打开/关闭/返回、任务/筛选状态、旧onAppear/onDisappear、键盘/大字/内部滚动。内容退出第二个外框/阴影；不能把SearchTask关闭当停止搜索；图层暂隐藏不丢原任务投影 |
| N11 下载自绘sheet/dock/确认；visible / common + domain / ADAPT | [SharedDownloadPage.sheetOverlay](../../entry/src/main/ets/features/downloads/ui/SharedDownloadPage.ets#L893)、operationsSurface、confirmationOverlay/ReaderDialogSurface；不是native bindSheet | sheet/dialog内容与外框、遮罩、动作、测量/避让；KEEP SharedDownloadHost任务事实与该页局部返回顺序 | 操作/筛选面板、确认、短高/溢出、进出场中断、旧presentation。统一材料与动作后退出私有基础绘制；自绘宿主负责真正阻断/焦点恢复，不能拿子卡clip或demo截图代替 |
| N12 阅读控制子表面；visible / domain + common / ADAPT | [LocalReadingExperience → ReaderControlPanel](../../entry/src/main/ets/features/reading/ui/LocalReadingExperience.ets#L2278)；目录/搜索/外观/替换/自动翻页/设置/TTS；[ReaderAppearanceMotionStage](../../entry/src/main/ets/features/reading/ReaderAppearanceMotionStage.ets#L242)、[ReaderControlTtsContent](../../entry/src/main/ets/features/reading/ui/ReaderControlTtsContent.ets#L443)配置层；漫画更多/下载/持久目录 | Reader域动作/选择/字段、bounded表面、menu/dialog合同；KEEP 控制状态/动效、阅读位置、TTS/外观/替换gateway和原会话 | 快捷/全屏/收起、模块切换、草稿/保存未决、配置/测试busy、正文搜索有旧结果/空/失败、外观切换、面板中断/返回。退出重复基础控件和同层外框，不统一领域内容或再建全局panel store |
| N13 消息各业务入口；visible/closed/unconfirmed随原入口 / common + domain + platform / ADAPT，认可专用内容KEEP | Index恢复/ReaderTransientToast挂载、页面ReaderTransientFeedback/RecoveryNotice/PageState、确认，以及导入/检测/任务结果、漫画资源/章末/书签、OS媒体；以[消息规范](../message-ui/FRAMEWORK.md)与[入口清单](../../tools/message-entrypoints.json)裁定事实类别 | 原有短反馈、恢复、页态、确认公共家族；专用任务/资源/手势/系统媒体保持登记；KEEP 原业务owner，不按根宿主注释推导全局优先权 | 已完成/明确失败与未决分开，有旧内容不换整页失败；当前可见/前后台/实体/操作身份、去重/退休/展示失败；sheet/popup避让。旧消息框只在真实类别接线后退出，不建全局业务队列，不把关闭或读回成功当取消/原写入确认 |
| N14 开发页、消息预览与布局辅助；visible但条件进入 / common；调试辅助domain / ADAPT或KEEP | [SettingsPage 内部入口](../../entry/src/main/ets/features/settings/ui/SettingsPage.ets#L227) → developerPage/ReaderMessagePreviewPage；[Index](../../entry/src/main/ets/pages/Index.ets#L1568) 根ReaderLayoutDebugOverlay | 复用正式家族呈现状态样本；KEEP 独立预览身份、无副作用事实和不截输入的边界辅助 | 打开/返回、预览短反馈/确认的清理、页面失活、调试开关。退出演示专有平行控件；作为实际纵切的支持，不另设独立产品纵切门禁；预览通过不计真实页面或业务体验通过，也不新增普通用户入口 |
| N15 系统文件/分享/登录/媒体及执行宿主；visible按能力准入 / platform / KEEP能力，ADAPT UI边界 | [EntryAbility.onNewWant](../../entry/src/main/ets/entryability/EntryAbility.ets#L166)、picker/login回调、[Index.ArkWebExecutionHost](../../entry/src/main/ets/pages/Index.ets#L1572)、既有HarmonyTtsBackground/MediaSession与IME | 平台能力与当前页面事实的有限适配；KEEP Host文件/网络/凭据/ArkWeb/媒体owner | 首次/新Want、取消/权限拒绝/失败、后台/恢复、旧窗口/实体回调。系统内部UI不纳入重画；ArkWeb执行宿主不变正文渲染器；新外部请求不绕过原退出同步交接、换源准入与身份合同 |

本表按真实承载区分 native sheet、自绘 sheet、原生 popup 和自绘菜单。ArkUI 基础控件、List/Grid/Scroll、原生窗口和既有完整上游能力采用 DIRECT；表中的 ADAPT 仅指 Reader 语义、外观、身份、投影与平台桥，不授权复制其点击、焦点、虚拟化或通用算法。未来裁定某个当前保留实现已无消费者时，应记录它的引用与替代去向后 RETIRE，而不是把同名替代组件自动视为生产证据。

## 5. 状态、适配与合法例外

每个迁移组在实施时只展开自身真实可达状态，记录触发入口与原事实来源；上表所列状态是本轮范围义务，不表示都已实现或验证。新发现实际入口时补行，不靠锁定历史数量拒绝合理变化。

| 维度 | 实施必须说明 | 不成立的替代证明 |
| --- | --- | --- |
| 可用内容与操作 | 首次准备、确认空、无内容失败；已有内容刷新失败；busy/原写入未决/明确结果分别来自谁 | 统一一个loading/error字段吞掉原事实 |
| 控件状态 | enabled/busy/selected/expanded、互斥/多选、字段校验、一次意图和操作范围 | 换颜色或在文案里拼“已选择”代替完整语义 |
| 布局与环境 | 实际宿主宽高、compact/expanded、rail/底栏、分屏/旋转、安全区、键盘、字号/长文本、vp/px密度；App/Reader主题边界 | 只在366日间静态demo通过或把52/58等基准冻结成内容高度 |
| 返回与层级 | 背景隔离、焦点初始/恢复、IME/原生窗口/局部面板/页面退出顺序、原scroll上下文 | zIndex高、clip(true)或遮罩颜色就认定modal有效 |
| 身份与保留 | runtime/session/scene/entity/operation/layout中的相关身份，active/hidden/retired、订阅/资源释放和动画中断 | mounted等于可见；给所有回调机械附加同一全局generation |
| 性能 | 稳定key、原生虚拟化/锚点、测量去重、局部更新、隐藏态不做无用渲染 | 公共组件更少或文件更短就认定更快 |

明确保留的例外包括：正文分页/翻页、漫画缩放/图条/资源单元、复杂目录与真实目标、书架搜索与阅读启动过渡、任务逐项结果、阅读手势、OS媒体和系统窗口。它们仍要满足共同的基础动作、主题、可访问、层级/坐标和生命周期合同。自定义Reader纸面或必要领域布局不是任意styleBag；不得以例外名义复制同职责普通按钮/卡/消息外框。

不要求遍历上述全部维度的笛卡尔积。每个组选择能代表已改变生产路径和已知边界的组合，并为不适用项说明原因；无法界定影响时先补代码审计与范围裁定，不自动补跑全量。

### 5.1 同一几何合同与早期可行性核对

共享的是同一几何合同和 resolver，**每个页面实例只有一个解析 owner**。标准 Scroll 页面由 ReaderStandardPage 解析并承接原生滚动；原生 List/Grid、Library 搜索共用顶栏、阅读与漫画保留具名既有适配，使用同一个 resolver，并保留自己的 List/Scroller、原生 viewport 与测量回执。ReaderPageScaffold 只绘制已解析的 frame/geometry，不重算；其他壳是内部布局或 feature 组合。不得为“统一入口”强套全部页面到 StandardPage，也不因此引入一套 `external` 模式框架或第二套几何事实。

UI-00/UI-01 在首个设置合同定型前，做以下有界的源码与合同可行性核对：G1 的 ReaderLibrarySearchSurface 仍是单宿主，书架/搜索原 List 与公共顶栏的坐标/测量关系能表达；G7/N02 的 retained reader 在隐藏准备、覆盖层和显式退出间保持实体与 viewport；漫画原生视口、资源几何和手势坐标不会被标准 Scroll 预算二次收缩。记录实际入口、接口缺口和已有适配去向；必要时修正公共合同。这是防止按设置专用假设设计公共能力的早期审计，不是提前同时迁移书架与阅读，也不构成它们已经通过的生产证据。

### 5.2 同会话返回与冷重启

同一会话的展示保留由原 feature 的有界状态及导航返回上下文协作；导航不复制业务事实。本轮不新增跨进程 UI 路由栈/草稿/像素锚点存储。冷启动按原启动/恢复入口加载，纯展示状态初始化；新 Want 仍走原系统文件队列与有限导航适配。

| 当前状态与证据 | 同一会话内的规则 | 冷重启/进程死亡后的规则 |
| --- | --- | --- |
| [BookshelfViewState](../../entry/src/main/ets/features/bookshelf/presentation/BookshelfViewState.ts#L1) 的展开选择、书籍 key/Y/offset；content/source filter 的 AppStorage 桥接 | 复用原展示对象，按实体与当前数据恢复有效锚点，环境变化重新测量 | 未持久化筛选/选择/展开/锚点初始化；`@StorageLink` 不等于磁盘保存。已保存显示偏好仍由原 [BookshelfViewModeHost](../../entry/src/main/ets/features/bookshelf/application/BookshelfViewModeHost.ts#L18) 读取 |
| [SearchHost.viewState](../../entry/src/main/ets/features/search/application/SearchHost.ets#L17) / [SearchViewState](../../entry/src/main/ets/features/search/presentation/SearchViewState.ts#L6) 的草稿、分类、类型、顺序与锚点 | 详情往返沿用原查询并 resume；新入口/新查询按原 reset。[SearchPage 重挂载](../../entry/src/main/ets/features/search/ui/SearchPage.ets#L438) 明确关闭筛选/任务面板，不承诺所有临时层保留 | 草稿、未持久化查询/筛选/暂选/结果锚点初始化，不自动重放搜索；持久搜索历史由原 [SearchGateway](../../entry/src/main/ets/features/search/application/SearchGateway.ts#L166) 读取 Core |
| 下载 [SharedDownloadViewState](../../entry/src/main/ets/features/downloads/ui/SharedDownloadPage.ets#L58) 的查询/筛选/排序、列表/章节偏移、detail key；[Index 回传](../../entry/src/main/ets/pages/Index.ets#L2249) | 由该旅程展示状态和有限 return context 保留，按当前目标有效性恢复 | UI条件/暂选/偏移初始化；已受理下载/清理及未决事实仍归原任务 owner/Core，不能由导航重发 |
| 目录 [ReaderDirectorySessionState](../../entry/src/main/ets/features/reading/presentation/ReaderDirectorySessionState.ts#L3) 的 folds/viewport 与 [ReaderDirectoryViewport](../../entry/src/main/ets/features/reading/presentation/ReaderDirectoryViewport.ts#L2) | 保留现有有界会话状态，按目录 revision/实体消费有效锚点；原实现至多保留8个访问scope | 浏览折叠/锚点初始化；它们不是持久阅读位置，不据此改写 Core 进度 |
| 未提交表单；如 [SourceTools 编辑草稿](../../entry/src/main/ets/features/source/application/SourceToolsOrchestrator.ets#L492)、[RSS editor drafts Map](../../entry/src/main/ets/features/rss/application/RssSubscriptionEditorOrchestrator.ets#L93) | 沿用原 feature 生命周期和关闭/取消规则，公共字段不另建草稿 owner | 未持久化草稿初始化；已受理的原操作 payload/receipt 恢复另归原 owner，不混同任意未提交草稿 |
| 已保存设置/显示偏好、历史、阅读位置与写入未决 | 原 owner 持续投影；隐藏/退出不等于取消或 ACK | 原 Preferences/Core/operation journal 恢复；例如 [ReadingProgressJournal](../../entry/src/main/ets/features/reading/application/ReadingProgressJournal.ts#L24) 和 [ReadingSessionProgressOwner](../../entry/src/main/ets/features/reading/application/ReadingSessionProgressOwner.ts#L120)，不另建导航持久事实 |

需要跨进程恢复新的纯展示字段时，应另定字段、版本、实体有效性与失效策略，不能在职责提取时顺带序列化整个页面或 owner/callback。关闭产品模块的草稿示例只说明既有状态边界，不授权打开该模块。

## 6. 对齐唯一工作包的依赖批次与原路径退出

本节使用总提案 §15.4 及唯一待办已有 UI-00–UI-06，不新建第二套工作包或执行状态。G/R/N 是本附件的范围定位，不是另一份待办。

| 工作包 | 前置与本附件实际范围 | 必须形成的可审阅结果 |
| --- | --- | --- |
| UI-00：合同与当前入口对齐 | 全20路由、N01–N15、公共家族/环境/消息合同；明确closed/unconfirmed、原owner和平台原生能力；早期有界核对G1单宿主及G7/N02阅读/漫画的合同可行性 | 家族与真实消费者有双向映射；来源/许可、必要状态和合法例外已裁定；过期活动检查有修订去向。审计防止设置专用假设，不提前展开另外两条完整迁移。本次是方案交付，不把登记算作产品完成 |
| UI-01：宿主合同与最小检查绑定 | 依赖UI-00；首交付为G3设置宿主G-L1，同一几何合同/每实例唯一owner、最小依赖方向/API检查；对G1/G7的具名既有适配完成必要可行性核对 | 真实viewport/rail/头部/尾部预算及回执接通；StandardPage承接标准Scroll，领域原生内容用同一resolver，Scaffold只绘制。未来实施将所选轻量源码/API及编译检查接入源码/构建CI，遵守现有按需检查策略；当前没有实现 |
| UI-02：设置所需基础能力起步 | 依赖UI-00与相关UI-01合同；先补设置实际需要的动作/字段/选择/语义行 | DIRECT平台能力，只适配当前切片必要Reader语义/布局；必要依赖和消费者同批审阅。后续家族用途随下一实际消费者扩展，不先铺全部控件或全库平行迁移 |
| UI-03：代表纵切按序证明，设置先行 | 首个候选只含G3设置首页/通用/书架设置（R09/R15）及受影响N入口，并合入UI-01 G-L1、最小检查、所需UI-02和旧路径退出；N14仅支持 | 提交限定源码/API与当前编译证据，再按真实风险补必要的有界设备/交互证据。设置、Library动态单宿主、阅读/漫画保留会话三类最终各自证明；后两类随UI-04对应消费者批次完成，不能用设置或早期审计代替 |
| UI-04：串行扩展全部可见旅程 | 主消费者批次按G4书源/工具 → G8下载 → G1书架搜索与宽屏导航 → G7阅读/漫画 → G1–G8其余可见路径及N01–N15的visible入口展开 | 一批的必要依赖、真实消费者、原owner/返回/隐藏/未决合同与同职责旧路径退出一起落地。文字/漫画详情/目录/换源、选择/导入/确认、TTS等所有有效上下文仍须完成；不保留永久双实现 |
| UI-05：保留范围与治理收口 | N01/N13/N14要求贯穿前述各包；最后核对G9/G10及所有旧API消费者 | 可见入口与各有效状态无无主职责；closed保持关闭，unconfirmed已有入口结论或明确未决；共用API受影响的保留源码已兼容；过时活动规范/检查不再冒充当前保障 |
| UI-06：逐候选证据归并与缺口收口 | 按实际改动与交付目标归并每个固定候选的所选验证结果，处理必要剩余证据 | 源码/编译/运行交互/视觉/产物/用户验收分层可追溯。各早期候选需要的设备证据随实际批次取证，不全部拖到此包；必要证据缺失的候选仍未验收，历史PASS/预览/文档不能代替 |

批次表达依赖与串行主消费者顺序，不授权同时开展三条完整迁移。先收束当前批次的必要依赖、消费者及旧路径；下一批所需的有界独立审计、接口准备可推进，但不冒充下一旅程完成。验证按实际风险选取，不建立“每批都先跑设备、否则禁止一切后续工作”的统一关卡；某项必要证据受阻时保留候选未验收，并阻止依赖该结论的完成声明，同时允许不依赖它的有限准备。根、消息和临时入口随实际切片实施，不能等UI-05才补生命周期。当前仅细化方案，其他工作包的代码、检查或CI绑定均未在本次实施。

公共API退出需核对全部真实消费者，包括关闭/保留源码；若尚有有依据的保留消费者，记录最小适配和退出条件，不能把该API写成已退役。`DEFER`只延后其产品体验，不授权永久维持两套完整公共体系，也不授权删除业务模型或用户数据。

## 7. 完成定义与按需验证

一个组完成需同时满足：

1. 本组实际入口、子模式和临时表面已覆盖，当前可见的domain路径也计入；closed与unconfirmed结果单列，未知项不记PASS。
2. 需common的用途实际消费公共实现，参数和行为能传到真实页面；domain/platform用途满足具名共同合同，保留有依据的专用实现，不能只加spec/import/登记。
3. 每个外框/材料/阴影/遮罩/裁剪/显示关闭/焦点/测量有明确owner，常驻chrome有正确避让；原生宿主与内容不双画同层框。
4. 原事实、操作准入、实体/任务身份、锚点、隐藏保留、原生返回与失效回调保持；关闭展示不冒充取消，读取成功不冒充原写入ACK。
5. 被替代同职责生产路径与无消费者兼容入口已经退出；仍保留者有具体依据和后续处理条件，不能仅因迁移工作量保留完整平行实现。
6. 当前候选所需的必要验证有真实结果。首个设置候选先提供所选源码/API检查和当前ArkTS编译证据，再补代码侧无法回答问题所需的有界设备证据；后续批次按同样的实际风险选择。运行/交互、视觉、产物与用户验收分别记账；必要证据未取得就保留该候选未验收，不沿用历史PASS，也不因此一律冻结独立准备工作。本附件本次未执行这些验证。

验证入口按本批实际变更逐项裁定：公共控件选择真实方法/状态/语义，壳与几何选择实际输入/测量/导航及滚动消费，旅程选择原owner投影/当前身份/返回恢复，消息选择其事实类别和退休/去重。过期检查先修正生产绑定和反例，再决定是否执行；不锁历史总数、旧函数位置或设计基准数字来伪装架构保证。

执行前列清实际入口、嵌套调用、范围、具体风险及不可省略依据。未选项记NOT_RUN；已选项缺工具、失败或缺结果保持FAIL/未完成。UI-01后续实施须将选定的轻量依赖方向/API和编译检查接入源码/构建CI，使合并实际消费当前合同；沿用现有选择性检查策略，不默认扩成全量测试或重型门禁。本次只写明要求，没有改检查工具、CI或治理入口。

设备取证仍先完成代码侧定位及必要本地回归，再为代码侧无法回答的问题明确固定候选、准确设备和最小观察范围，沿用既有设备授权并保留用户数据。本文不自动授权部署、设备执行或开放closed模块，也不新增逐批重复审批流程。必要设备证据缺失的候选保持未验收，独立准备可继续；设备证据不是所有批次无条件相同的前置，也不能一律推迟到UI-06。

本次交付仅完成迁移范围、原路径去向、依赖批次及完成合同的细化；没有实现任何生产迁移，也没有把页面盘点当成原生视觉或用户验收。
