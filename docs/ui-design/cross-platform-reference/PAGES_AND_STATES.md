# 通用应用页面、状态与交互逻辑

## 采用范围与阅读方式

本文收敛 HarmonyOS 已提交基线 `33f7c7b21474a76a042ebda911c5f0ff2d73cf54` 的页面和交互资料，供 iOS 等平台复刻通用版本。
该输入不包含独立 `harmony-native-phase1-20261020` 分支后续的 HDS 导航、握姿和常驻 MiniBar 等扩展，也不吸收其他工作树的未提交 UI 修改。
这里的组件、方法和状态名是可追溯的现有实现标识；其他平台保留用户语义与状态边界，不要求照搬 ArkUI 类名。
本文描述规范及源码接线，不新增功能、产品决定或设备验收结论；历史截图未采集某状态，不表示该状态未实现。
`REFERENCE_GAP` 只标记本基线资料仍未冻结的规则，供阅读本参考时辨别边界；不是第二份待办或新的开发授权。

主要依据均可在当前仓库读取，无须先恢复私有截图、HAP 或设备记录：

- [交互主规则与状态保留](../../architecture/interaction-wiring-20261019/README.md)。
- [导航、返回及保留对照](../../architecture/interaction-wiring-20261019/navigation-comparison.md)。
- [主要动作、取消与恢复对照](../../architecture/interaction-wiring-20261019/action-comparison.md)。
- [工作流对照](../../architecture/interaction-wiring-20261019/workflow-comparison.md)：保留原 28 个工作流、211 个步骤的关联，另列下载及漫画等补充旅程；这些数量不代表完成率。
- [消息类别规范](../../message-ui/FRAMEWORK.md)、[页面框架职责](../../architecture/ui-page-framework-20261014.md)。
- [产品范围源码](../../../entry/src/main/ets/app/ReaderProductScope.ts)、[根导航与业务接线](../../../entry/src/main/ets/pages/Index.ets)。

## 1. 页面目录与可见范围

基线固定 `l0`，主 Tab 为书架、设置。下表的状态、Sheet 和模块不会因有独立视觉层就自动成为新路由。
页面框架共享安全区、固定头部、滚动避让和底部承载，业务状态仍归各领域 owner；系统顶部安全区只计一次。

| 路由 / 呈现家族 | 可见入口与页面组成 | 返回目的地及主要保留 |
|---|---|---|
| `bookshelf` 书架 | 主入口；列表/封面、继续阅读、筛选、更多、书籍操作 | 最外层返回交平台；视图、筛选和锚点归书架 owner |
| `settings` 设置 | 主 Tab；首页与通用设置是同路由两个 section | 通用设置先回首页，首页再回书架；已提交设置事实不随退页清除 |
| `bookshelfSettings` 书架设置 | 书架更多或设置首页 | 回进入时的书架/设置；显示方式使用同一持久 owner |
| `bookshelfMultiSelect` 书架多选 | 更多批量管理、书籍动作多选 | 回书架；批量删除忙时拦截退出，选择不冒充删除事实 |
| `search` 全局搜索 | 书架搜索或空书架入口 | 回书架；详情/书源回程恢复原查询、结果、筛选和视口 |
| `source` 书源管理 | 设置或搜索的管理书源 | 回保存的设置/搜索父级；分组下拉先关闭 |
| `sourceTools` 书源工具 | 书源管理工具入口；列表、JSON 编辑和调试在同一页 | 回书源；原已受理操作保留，普通草稿政策见 `REFERENCE_GAP` |
| `downloads` 下载管理 | 书架更多、设置、目录下载、阅读下载动作 | 内部逐层返回后回原父级；列表/章节视口和筛选分别保留 |
| `detail` 详情 | 搜索结果、书架书籍信息、阅读更多信息 | 回 bookshelf/search 或原 reader；简介、目录和成员变化不混作新页面 |
| `directory` 独立目录 | 详情完整目录或阅读控制来源 | 分别回 detail/reading；保留目录来源和原阅读会话 |
| `reading` 阅读 | 书架续读、详情/目录选章、下载阅读、换源准入 | 小说/漫画分别承接；保存退出后按原父级与明确目的地返回 |

`bookshelfManagement` 独立完整管理页及 `rulesManagement` 独立规则页有保留代码，但本基线未找到可见消费者。
书架“批量管理”实际进入多选；阅读替换“完整管理”实际展开同一阅读控制模块，不能借这两个保留路由实现。
`discover`、RSS 五路由和 `sync` 共七条路由被 L0 关闭，未开放设置同样不纳入通用版本的可见入口。
依据：[导航可见/保留矩阵](../../architecture/interaction-wiring-20261019/navigation-comparison.md)、[ReaderProductScope](../../../entry/src/main/ets/app/ReaderProductScope.ts)。

## 2. 所有页面共同遵守的状态与动作合同

| 事实 / UI 状态 | 呈现与允许动作 | 不可改变的业务边界 |
|---|---|---|
| 首次加载且无可用内容 | 原页面/局部内容区的 `ReaderPageState` 加载 | 加载由明确 busy fact 驱动，不从“正在/读取”等文案推断 |
| 确认空内容 | 空态说明及适用下一步，如搜索、导入、清筛选 | 空库、筛选无结果、缺书源、请求失败分别表达 |
| 无可用内容且读取失败 | 原范围错误态及读取重试/返回 | 重试读不重放先前写入 |
| 已有内容刷新中/失败 | 保留原内容和视口，局部进度或短反馈 | 不清空成功结果，也不整页重建来表示失败 |
| 普通完成/明确失败 | `ReaderTransientFeedback` 的短反馈 | 仅当前宿主/实体可见；后台、旧页面和旧回调不显示新消息 |
| 原写 unknown / 原清理未完 | `ReaderRecoveryNotice` / `ReaderRecoveryAction` | 原 owner 决定核对、继续、结束；不能定时伪造成功 |
| 确认 | 既定确认变体，明确目标与后果 | 取消不执行动作；确认时复查原目标与代次，不借新页面实体 |
| 持续任务/批次结果 | 专用任务宿主，真实进度、部分成功、失败和未执行项 | 关闭结果或页面不等于停止任务；停止也不撤销已完成项 |
| 图片失败/阅读手势提示 | 图片单元或纸面专用组件 | 不统一替换为 Toast、通用全屏错误或事务对话框 |

每个动作都绑定当前书/来源/章节、Runtime、导航或 presentation 身份；旧响应、旧动画 finish 和旧按钮只作用于原实例。
读取到了相同值不证明原写已确认；已确认写后的刷新失败只重读，不能再次保存/删除/导入来“刷新”。
“核对”不能一概解释为绝对无副作用：已确认删除后的剩余清理可由原 owner 继续，但不得重发未知删除。
公共消息只展示事实及转交允许动作，不建立新的持久 store、队列或导航 owner。
依据：[消息规范](../../message-ui/FRAMEWORK.md)、[操作事实源码](../../../entry/src/main/ets/app/ReaderOperationFacts.ts)、[回调对照](../../architecture/interaction-wiring-20261019/action-comparison.md)。

## 3. 导航、返回与临时层

进入详情、下载或书源时保存来源；离开时不能凭瞬时 route 猜父级。新书准入与已有子旅程返回分开。
普通返回恢复已有查询/筛选/滚动/内容；明确新搜索、刷新、冷进入或成员身份变化才触发相应读取。
Reader → 书籍信息/下载先经原退出和进度保存屏障，匹配本次 reader identity 后才进入目标。
`Reader A → 信息/目录 A → Downloads → Reader B` 回程为 B → Downloads → A 的信息/目录 → Reader A，继续保留 A 最初的来源。
确认换源导致下载成员身份变化时丢弃旧成员快照并读取 canonical，仍恢复父级及 view state。

| 宿主 | 返回/取消顺序与关闭语义 |
|---|---|
| 根 Index | 漫画换源选话 → 移除确认 → JSON 导入 → 换源 → 本地导入 → 单书分组 → leaf 临时层 → 页面 |
| 书架更多 | 关闭本次 opening，所选动作只派发一次；不取消检查更新 |
| 书籍动作 Sheet | 保持原书上下文至退场结束；选中动作在对应 finish 后派发一次 |
| 下载管理 | 确认 → Sheet → managing → chapters → books → 原父页面 |
| 小说普通系统返回 | 键盘 → 临时编辑/预览 → 控制栏退层 → reader 退出 |
| 小说明确导航/顶部退出 | 使用原 `beginExit` 路径；不能误当普通控制栏退层 |
| 漫画普通返回 | 章边界取消 → 面板 → 章末状态 → 缩放 → 关闭阅读/返回 |
| 文件选择、登录 Web、系统确认 | 由真实平台宿主完成关闭并回原业务实例；不能伪造应用新路由 |

原生窗口可能先于根页面消费 Back；上表不声称各平台 IME/窗口回调的实际调度顺序已经相同。
依据：[导航与临时层对照](../../architecture/interaction-wiring-20261019/navigation-comparison.md)、[temporary Back 合同](../../architecture/temporary-back-leaf-bridge-20261003.md)。

## 4. 启动、系统文件与生命周期

| UI 子状态 | 入口、动作及转移 |
|---|---|
| 启动准备/恢复屏障 | Entry → Runtime → Startup owner；未就绪不借用尚未挂载书架的按钮 |
| 启动失败 | `ReaderStartupRecovery` 承接重试/退出；重试属于当前 stage |
| 可用书架 | 展示真实 canonical 内容，再由用户进入其他旅程 |
| 外部文件排队/导入 | 系统文件 Host 等待恢复屏障，复用本地导入及既有阅读准入 |
| 导入成功但导航未准入 | 保留已保存书，可回书架打开；UI 退出不回滚导入 |
| 后台/窗口变化/页面退休 | 退役旧投影和回调，已受理任务仍归 Runtime/领域 owner |

依据：[WF-A01～A03](../../architecture/interaction-wiring-20261019/workflow-comparison.md)、[ReaderStartupRecovery](../../../entry/src/main/ets/pages/ReaderStartupRecovery.ets)、[ReaderSystemFileOpenHost](../../../entry/src/main/ets/app/ReaderSystemFileOpenHost.ts)。

## 5. 书架、书籍动作与本地导入

| UI 子状态 / 区域 | 动作与结果 | 返回/保留 |
|---|---|---|
| 列表/封面、继续阅读卡 | 点书进入原 ReadingEntry 准入；可见书预热不是第二次打开 | 阅读准备/active reader 时防叠加；回原阅读来源 |
| 筛选展开/收起、chips、分页 | 改筛选和锚点后读投影；清全部条件不删书 | 封面/列表是持久偏好，筛选展开是展示状态 |
| 空库/筛选空/首次失败 | 分别提供导入/搜索、清筛选、读取重试 | 保持原壳与安全区，不把失败当空库 |
| 更多菜单 | 批量管理、本地导入、检查更新、下载管理、书架设置 | 先关闭再派发；更新中或无在线书不重复派发 |
| 单书动作 | 多选、编辑分组、书籍信息、移出书架 | 保存原 actionBook；Sheet 消失不改目标 |
| 多选零选/有选/移除忙 | 选择、全选、取消、移除所选 | `!busy && ready` 才允许选择/取消；忙时 Back 留页 |
| 分组选择/写入/未决 | 选择默认分组；核对或继续原 `bookshelf.group.assign` | 确认保存后关闭；读回失败短反馈，不重发保存 |
| 移除确认/结果 | 单本与批量分别保存目标；本地/远程后果文案分别使用 | 取消不删；unknown/清理未完留原恢复入口 |
| 导入 selection/pickerOpening/importing/result | 选文件才开始受理；显示批次进度和逐项结果 | 关闭不取消已开始导入；unknown 禁止重新选文件重发 |
| 检查更新执行/部分结果/读回失败 | 手动/自动入口均归 BookshelfCatalogOwner | 离页不发第二轮；更新任务事实不同于列表加载 |

依据：[书架主要动作](../../architecture/interaction-wiring-20261019/action-comparison.md)、[BookshelfPage](../../../entry/src/main/ets/features/bookshelf/BookshelfPage.ets)、[LocalImportDialog](../../../entry/src/main/ets/features/bookshelf/LocalImportDialog.ets)、[BookshelfOperationOwner](../../../entry/src/main/ets/features/bookshelf/BookshelfOperationOwner.ts)。

## 6. 全局搜索与详情

| 搜索状态 / 子状态 | 内容与动作 |
|---|---|
| `initial` | 输入、历史记录；历史有 loading/ready/loadFailed/clearFailed 独立状态 |
| `sourceRequired` | noSources/allDisabled 是配置缺口，仍保留历史；进入书源管理 |
| `sourceLoadError` | 来源列表读取失败，搜索链尚未开始；不显示“搜索无结果” |
| `loading` | 当前关键词和真实进行中事实；运行中主动作是停止 |
| `results` + searching | 部分结果随来源完成更新；来源数、失败数、跳过项与卡片并存 |
| `results` + stopped/完成 | 停止保留已有结果与 session；重试失败/未完成来源，不无条件清空重搜 |
| `empty` / `error` | 确认无结果与全失败分开；本地/来源列表失败事实不能混掉 |
| 结果筛选/选卡 | 来源范围、内容类型只筛当前 session；结果准入原详情/阅读链 |

清历史是明确写/清理动作，并结束现 sweep；普通返回不会清历史或重搜。
搜索 → 书源管理保存关键词和 SearchPresentation；普通返回恢复，明确“用新书源搜索”才新发请求。

| 详情子状态 | 内容、动作及连续性 |
|---|---|
| 书籍资料、简介收起/展开、目录摘要 | 继续阅读、章节项、完整目录、换源、加入/移出书架、返回 |
| 目录 loading/empty/error/ready | 以 `catalogBusy` 等真实事实决定 loader/重试，不能按文案前缀猜忙态 |
| 成员写 pending/unknown/confirmed | busy 与原写屏障控制动作；加入/移出不重建整页及滚动 |
| 本地内容已删除 | 就地说明重新导入；禁用已不可用的加入、阅读和章节动作 |
| 来自 reader 的信息页 | 返回或继续阅读恢复原 reader 与最初来源，不默认退书架 |

依据：[SearchPresentation](../../../entry/src/main/ets/features/search/SearchPresentation.ts)、[SearchPage](../../../entry/src/main/ets/features/search/SearchPage.ets)、[LocalBookDetail](../../../entry/src/main/ets/features/bookshelf/LocalBookDetail.ets)、[阅读进入与详情连续性](../../READING_CHROME_AND_INTERACTION_20261012.md)。

## 7. 目录、章节与书签

详情独立目录、阅读内 Quick/Full 目录、漫画目录分别保留自己的入口/宿主；同名组件不代表相同返回目标。
目录依据 Core 的章节 identity、navigable、层级和真实位置投影，不从标题猜新章节或把分卷行当可阅读章节。

| 子状态 / 功能 | 内容与动作 | 边界 |
|---|---|---|
| 首载、目录失败、可用列表 | 重试、查询/清空、排序、折叠/展开、定位、选章 | 有旧目录时保留；重试不重放书签/下载写 |
| 目录/书签 Tab | 分别读取、空态、失败、当前项和选择 | 未知阅读位置不标第一章为“当前” |
| 书签选择、创建、删除/确认 | 当前书/章节/anchor 交 ReaderDirectoryHost | 核对与继续原操作分开；不以读回同值确认写 |
| 离线单章/全书/清理 | 原 ReadingOfflineHost；全书动作可进入下载管理 | 清理与取消下载、移出书架分别表达 |
| 本地 TXT 目录规则 | 当前书规则、编辑、预览、应用及失败恢复 | 保留原书/目录 owner；不能替换成全局独立规则管理页 |
| 小说离散选章/书签/搜索跳转 | 立即显示目标章节加载态及返回；成功后由真实排版/进度提交准入 | 位置核实失败留错误页；重试原请求；slider 不套此遮挡行为 |
| 漫画选话/更章 | 由漫画会话准备并按原 first-ready 边界交接 | 不把小说的目标 loading 直接施加到漫画空 List |

依据：[BookDirectoryPage](../../../entry/src/main/ets/features/bookshelf/BookDirectoryPage.ets)、[ReaderFullDirectory](../../../entry/src/main/ets/features/reading/ReaderFullDirectory.ets)、[MangaDirectoryPresentation](../../../entry/src/main/ets/features/manga/MangaDirectoryPresentation.ts)、[选章反馈说明](../../READING_CHROME_AND_INTERACTION_20261012.md)。

## 8. 小说阅读、控制栏与运行子状态

正文、阅读 chrome、控制栏、临时编辑和会话胶囊是同一阅读上下文中的不同层。亮度/外观预览、位置持久化和业务播放状态分别记账。
沉浸时隐藏系统栏，控制栏唤起时恢复；顶部信息与正文避让消费真实窗口尺寸。跨端不硬编码某台设备的状态栏坐标。

| 子状态 / 模块 | 动作与转换 | 保留与失败 |
|---|---|---|
| 正文可用/章节准备/失败 | 阅读翻页、滚动、选章、返回/重试 | 迟到章节不替换新目标；进度由真实 reader 提交 |
| 控制栏 hidden/home/secondary | 唤起、选模块、回首页、关闭 | secondary 包括目录、TTS、外观、设置、正文搜索、自动翻页、替换 |
| secondary quick/full | 同一 actor 展开/收回；Full 下拖先沿同帧轴回 Quick，再越过 Quick 关闭 | 连续反向/取消保留模块、草稿和采样进度，不另建业务会话 |
| 更多/换源 | 信息、刷新本章、下载全书；换源先隐藏控制表面 | 明确导航经退出保存屏障；关闭更多不代表动作成功 |
| 章节/进度/亮度 | 前后章、seek、亮度预览/自动/取消 | 亮度拖动取消丢弃未派发值并呈现已确认平台值，不发回滚写；阅读 owner 退出/release 才恢复进入前基线；UI 值不冒充已确认阅读位置 |
| 正文搜索 | 空输入、执行、结果、更多、失败、选择命中 | 使用当前书的搜索与 anchor，区别全局 SearchHost |
| 替换规则 | 列表/空、开关、editor、删除确认、导入确认、导出、preview/失败重试 | temporary revision 保留；恢复标签由 owner 提供，可能是继续原写而非纯读 |
| 外观 | 日夜、字体列表/排序/导入、字号/行距/缩进/对齐等 | 偏好写确认、排版完成和位置交接分别处理 |
| 阅读设置 | 繁简、开关、方向、超时、翻页方式等 | 使用原 gateway；未确认写保留原恢复事实 |
| 选文/书签手势 | 原选区及纸面手势宿主处理 | 不由通用页面错误、Toast 或新增路由接管 |

以下运行态是 UI 必须正确投影的事实，不要求每种内部状态都拥有独立全屏设计：

| 运行域 | 事实状态 | 用户动作与呈现边界 |
|---|---|---|
| TTS 能力 | uninitialized/probing/unavailable/idle | 探测或不可用有真实理由；不可把启动动画当已播放 |
| TTS 播放 | preparing/playing/paused/resuming/interrupted/stopping/completed/error/failed | 播放暂停、停止、前后段、seek；系统中断与用户暂停分开 |
| TTS 设置/试听 | 倍速、定时关闭/时长/章末、跟随、中断/混音、后台/常亮、失败策略、语言/声音、引擎/HTTP 配置 | 试听与正式播放是不同 session；失败/停止、引擎变更和迟到 ACK 受原身份保护 |
| 自动翻页 | stopped/running/paused；awaitingPageCommit 为独立在途事实 | 速度、定时/跟随、暂停恢复、停止；等 page commit 时不再启动倒计时 |
| 自动翻页终止 | manual/bookEnd/lifecycle/catalogUnavailable | 停止不退出书；恢复不会让旧 generation 继续翻页 |
| 会话启动/交接 | stage/handoffPending/exitPending/released | 动效完结、业务 ACK、停止业务、释放展示分别发生；TTS/自动翻页按真实 coordinator 互斥 |

依据：[控制栏执行参考](../../READER_CONTROL_BAR_EXECUTION_REFERENCE_2026-09-05.md)、[ReaderControlSessionState](../../../entry/src/main/ets/features/reading/ReaderControlSessionState.ts)、[ReaderTtsState](../../../entry/src/main/ets/features/reading/ReaderTtsState.ts)、[ReaderAutoPageState](../../../entry/src/main/ets/features/reading/ReaderAutoPageState.ts)、[ReaderSessionLaunchController](../../../entry/src/main/ets/features/reading/ReaderSessionLaunchController.ts)、[ReaderBrightnessWriter](../../../entry/src/main/ets/app/ReaderBrightnessWriter.ts)、[LocalReadingExperience](../../../entry/src/main/ets/features/reading/LocalReadingExperience.ets)。

## 9. 漫画阅读、资源与章末

| 子状态 / 层 | 内容与操作 | 不可丢失的语义 |
|---|---|---|
| 章节准备/准入失败/可用 | 原章节/来源事实驱动加载、错误与重试 | 无法取得整章/来源才走页面级错误，不按失败图片数量推断 |
| 单图 pending/ready/failed | 占位、真实图片、原位重试 | 失败保持单元几何及居中图标；多图失败分别显示 |
| 同章回看缓存图 | 复用已缓存/已就绪图片 | 不把已有缓存回看设计成必经二次加载；资源事实归原 controller |
| 顶底控制/进度/缩放 | 前后话、seek、目录、退出及缩放返回 | 当前真实话/页保持同一会话身份 |
| 目录面板 | 章节树/列表、当前话、过滤、排序、展开折叠、定位/选话 | 层级和可导航性来自显式目录事实，目录状态不重建正文 owner |
| 更多面板 | 换源、重开本话/卷、信息、下载本话/全书/管理、加移书架 | mounted/exiting/identity/opening/phase/enabled 都准入后，关闭再执行 |
| 模式/设置面板 | 阅读模式、适配、底色、亮度、常驻页码、恢复默认 | 原偏好 gateway 持久化；恢复偏好不等于重载整本书 |
| 本话下载操作面板（目录行入口） | load actions 的 loading/error/ready、重试与准入动作 | 正常入口携带章节 index；不用假进度替代实际 Promise，复用下载能力 owner |
| 章末上拉 | 到底后向上超拉随手指；距离不足回弹；达阈值后释放才进入下一章 | 不是碰到底立即翻章；提示为底部揭露的平面箭头/短文案 |
| 下一章准备/失败 | 保留旧章节像素直至新目标被准入；失败由原事务处理 | 旧准备、取消及新章节提交不可互相借用代次 |

无章节 index 的“本书下载”面板是保留分支，本基线没有正常可见入口。更多中的全书下载仍直接交原业务回调，管理入口打开下载管理页，不能据保留标题新建一个整书面板入口。

依据：[MangaReadingSurface](../../../entry/src/main/ets/features/manga/MangaReadingSurface.ets)、[MangaSessionController](../../../entry/src/main/ets/features/manga/MangaSessionController.ts)、[漫画面板运动](../../MANGA_SHEET_MOTION_20261003.md)、[章末合同及被替代方向](../../MANGA_BOUNDARY_TURN_UI_CONTRACT_20261008.md)。

## 10. 换源

小说详情/阅读、漫画详情/阅读共用候选窗口的视觉家族，内容准入及事务仍走各自原 owner；选择候选直接进入既有换源/阅读链，不增加比较或第二确认步骤。

| Panel 状态 | 内容与操作 | 连续性 |
|---|---|---|
| `discovering` | 首次查找，停止/关闭按 owner 准入 | 不造可选候选 |
| `candidates` | 可选列表；refreshing/refreshError/stopped 可与已有候选并存 | 重新搜索不以空白代替已可用候选 |
| `empty` | 正常无候选或停止后的空结果 | 区别 discoveryError |
| `discoveryError` | 查找失败及允许重试 | 不是换源提交失败 |
| `switching` | 当前 targetSourceId 的切换事实 | 退出受事务阶段约束，不提前声明成功 |
| `success` | 原 owner 确认的完成反馈 | 目标首屏与 canonical/位置确认不能由动画猜测 |
| `failure` | 保留 undispatched/confirmed/unknown 与 reconcile 信息 | 重试/核对/继续由原事务决定，不无条件重发 |
| 漫画候选选话/目标准备 | 选话、取消、准备/commit 边界 | 取消回原换源层；已 commit 不以 UI 关闭当回滚 |

preview、targetReady、canonical、rollback 是不同事务交接；恢复原阅读父级，旧 scope 不操作新面板。
依据：[SourceSwitchPresentationState](../../../entry/src/main/ets/features/source/SourceSwitchPresentationState.ts)、[SourceSwitchWindow](../../../entry/src/main/ets/features/source/SourceSwitchWindow.ets)、[共同视觉参考](../source-switch-reference/README.md)、[换源 owner 合同](../../architecture/source-switch-owner-audit-20261003.md)。

## 11. 下载管理

| 子状态 / 区域 | 动作与投影 | 返回/失败语义 |
|---|---|---|
| books 首载/空/失败/可用 | 查询、类型、状态、来源、排序/升降序 | 筛选是读投影；不创建下载 |
| chapters 加载/失败/可用 | 选书、章节列表、定位当前、阅读 | metadata 失败与任务失败分开；可用列表不被整页清空 |
| managing | 选择、全选、快速范围、下载/暂停/更多 | 管理切换保留原滚动；选择变化与任务队列分开 |
| 当前阅读标签 | 同书真实 readingPosition；漫画须有可映射真实记录 | 未知位置不标当前、不能以下载数量推当前章 |
| 直接阅读 | 复验书/章 ID/navigable，保存两级视口后进入 reader | 不插入 read Sheet；回程 warm completed snapshot 可 resume |
| 书/章动作、范围 Sheet | 下载、暂停、重试、更多 | 失败短动作先开范围，范围确认后才派发下载意图 |
| 取消/删除本地确认 | 捕获原目标，取消不操作，确认后交 coordinator | 取消下载保留已下载内容；删除本地不同于移出书架 |
| 存储设置/清理确认 | 容量、自动缓存、永久下载、上限/天数和可清理量 | 未知不填 0；无真实 cleanable 资格不能清理受保护内容 |
| 任务执行/失败/完成 | 状态、失败原因、短动作分别投影 | 旧失败不覆盖后来已证明完成；未开始项不伪造失败 |
| 写已确认但列表刷新失败 | 明示已保存及刷新失败，允许读取恢复 | 不重新派发已确认动作 |

读取返回例外：冷进入/部分未加载快照需 reload；确认换源改变成员时读取新成员；普通往返仅更新必要书籍进度 metadata。
依据：[下载六旅程](../../architecture/interaction-wiring-20261019/workflow-comparison.md)、[SharedDownloadPage](../../../entry/src/main/ets/features/downloads/SharedDownloadPage.ets)、[SharedDownloadHost](../../../entry/src/main/ets/features/downloads/SharedDownloadHost.ts)、[SharedDownloadProjection](../../../entry/src/main/ets/features/downloads/SharedDownloadProjection.ts)。

## 12. 书源、工具与设置

| 页面 / 子状态 | 可见内容与主要动作 | 保留/恢复 |
|---|---|---|
| 书源首载/空/失败/可用 | 新增、查询、状态/分类/分组筛选、工具 | 回搜索或设置；普通读取/原写未决分别反馈 |
| 书源行检测/登录/启停 | 当前 sourceId、健康/登录/启用事实 | 登录 Web 回原 session；检测忙不重复检测；开关显示不等于写确认 |
| 本地/在线 URL 导入 | 输入、校验、提交、批次结果及 Search 后续动作 | 关闭未提交表单不导入；已受理后读回失败不重新导入 |
| 工具选择/批检/停止/结果 | 全选/清空、关键词、模式、深度、单源调试 | 每次结果保留当次参数；停止不撤销已有结果 |
| 工具批量启停/删除 | 再消费有效选择；删除确认捕获 list/selection revision | 旧确认不删除新目标；核对/继续沿原 operationId |
| JSON editor/校验失败/保存/读回失败 | 受控草稿、校验保存、取消、reconcileEditor | unknown/blocked 时限制取消/新保存；普通离页草稿见下表 |
| 导出所选/全部 | 含登录凭据确认后系统保存 | 用户取消、保存成功、异常分别返回；不等同数据库写 |
| 设置首页/通用设置 | 日/夜/系统主题、自动检查更新、减少动态效果、开发者模式、清缓存、恢复默认 | General 先回 Home；偏好写事实由 Settings owner 保存 |
| 恢复默认/缓存清理确认 | 明示影响范围、取消/确认 | 恢复界面/阅读设置保留书籍、来源、进度、书签、凭据；缓存清理保留受保护内容 |
| 设置加载/待核对/重试保存 | reconcile 与 retryAccepted 使用不同动作 | 前者读回；后者明确重交保留完整 snapshot，不能统称纯读重试 |
| 书架设置显示方式 | 封面/列表、读取重试、核对 | 与书架切换共用 BookshelfViewModeHost；读到同值不清 unknown |

依据：[SourceManagementPage](../../../entry/src/main/ets/features/source/SourceManagementPage.ets)、[SourceToolsOrchestrator](../../../entry/src/main/ets/features/source/SourceToolsOrchestrator.ets)、[SettingsPage](../../../entry/src/main/ets/features/settings/SettingsPage.ets)、[主要动作对照](../../architecture/interaction-wiring-20261019/action-comparison.md)。

## 13. 参考资料边界

| 标记 | 尚未冻结的具体范围 | 已有依据与采用边界 |
|---|---|---|
| `REFERENCE_GAP:source-return` | Source 查询/状态/分类/分组，Tools selection/未保存 JSON，在页内子旅程、离开模块、重进/跨进程时的保留期限和显式丢弃条件 | [导航 NAV-07/08](../../architecture/interaction-wiring-20261019/navigation-comparison.md)；当前会重置部分本地状态，不把此事实写成用户批准的永久规则 |
| `REFERENCE_GAP:nested-retention` | 全部嵌套入口的统一 parent/retention 表尚未冻结 | [导航对照](../../architecture/interaction-wiring-20261019/navigation-comparison.md)；本文已收敛明确的 reader/detail/download/source 路径，其余不自行扩展为新历史栈 |
| `REFERENCE_GAP:download-current-filter` | 当前阅读章被筛除或目录变化后的具体可见提示 | [WF-D02](../../architecture/interaction-wiring-20261019/workflow-comparison.md)；真实当前章判定明确，提示样式/文案不在此臆定 |

旧 `app-baseline/LOGIC.md` 和分类账保留观察、方向与未观察范围，不能覆盖本基线后续明确的返回修复、目标加载态或消息类别。
例如旧截图观察“漫画详情 Back 回书架”不成为新的正确返回规范；原生图缺少 TTS 播放/书签终态也不使其实现自动降为缺失。
原 28/211 工作流及专项状态源用于追溯和核对，不把历史 `implemented`、PASS 或安装记录升级为当前跨端验收。
本文件只整理提交内可见页面与状态；精确视觉及运动参数继续由相应视觉/动效资料承接，不以页面清单推定像素或手感一致。
