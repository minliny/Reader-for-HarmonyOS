# 书架、下载与启动消息实施验证（2026-10-19）

> 2026-10-20 门禁退出说明：本文保留当时的执行记录，其中已列入 `tools/retired-contract-tests.json` 的旧测试命令已退役，不能重跑或恢复为当前入口。现需回归时按工作区 `GATE_INDEX.md` 选准确项；历史 PASS 不转移为当前源码结论。

实施依据：用户已确认并授权全量执行的 `message-style-scope.json`，参考目录为 `/Users/minliny/.codex/visualizations/2026/10/18/01a14e0a-6884-7931-abb7-8d5acd48848d`。本记录只覆盖本代理负责的书架、下载页与启动恢复页；公共组件、Index、阅读和书源设置的结果由相应负责人另记。

## 覆盖

| 范围 | 文件 | 结果与边界 |
| --- | --- | --- |
| B01 | `BookshelfStatusContent.ets` | 首次等待、无内容失败统一 `ReaderPageState`；原生 32vp LoadingProgress 与原重试入口。 |
| B02 | `BookshelfEmptyCard.ets`、`BookshelfEmptyPage.ets` | 确认空书架沿页面状态呈现，保留导入、搜索入口；不再使用固定坐标插画卡。EmptyPage 原导航和页面框架保留。 |
| B03 | `BookshelfPage.ets` | 筛选无匹配及清除条件采用页面状态；更新数、封面、书籍类型和来源等内容事实不改。 |
| B04 | `BookshelfMoreMenu.ets`、`BookshelfMultiSelectPage.ets` | 检查使用真实完成量；无总量时不输出伪造比例。多选移除保持原动作与稳定文字、在原图标槽使用 18vp 原生忙态，不增加进度弹层。 |
| B05 | `BookshelfManagementPage.ets` | 初读无数据失败与空分组、空记录分开；已读数据与草稿保留。普通完成/刷新失败改短反馈，真实原分组未决事项在顶部浮层合并核对、继续动作。 |
| B06 | `LocalBookDetail.ets` | 字体准备加载/失败、局部目录等待/空态与本地书已移除说明分开；已有详情上的一般操作失败用短反馈，原按钮槽内使用 18vp 原生忙态。未新增导入、重试或入架业务。 |
| B19 | `BookDirectoryPage.ets` | 字体准备与目录内容状态区分；无匹配保留清除搜索，原目录重试仍调用原回调，不把字体重试当作目录数据读取。 |
| A12 | `ReaderStartupRecovery.ets` | 启动等待/失败统一页面状态，原重试、退出准入与数据保留文案不变。 |
| 本地导入 | `LocalImportDialog.ets` | 选择表单受可用高度约束并可滚动；真实导入等待使用 32vp 原生加载；结果保留逐文件事实、成功/已在书架/失败/待确认及完整长文件名和错误原因。待确认恢复入口位于遮罩内顶部，不被 Dialog 遮住；原有持久结果壳及测量/交接生命周期保留。 |
| 操作确认 | `BookRemovalDialog.ets` | 接入共同 17/13 字体与共同确认规格，标题为“移出书架”，调用者的破坏性动作准入、物理打开身份及回调不改。 |
| 下载及 B15 | `SharedDownloadPage.ets` | 无内容加载/失败与确认空列表互斥；已有列表/章节普通读取失败短反馈，原列表保留；待处理信息只在顶部呈现。取消、删除、清理确认统一 17vp 内边距、12vp 圆角、17/13 文案与至少 44vp 动作。原容量、设备空间、清理范围及保留说明不变。 |
| B18 | `BookshelfSettingsPage.ets`、`BookshelfPage.ets` | 无可用设置内容采用局部状态；有旧设置的普通读回失败短反馈；unknown/blocked/仍可明确重试当前设置的事项保留顶部入口。核对只读与显式保存继续分开。 |
| 书架浮层宿主 | `BookshelfShell.ets` | 恢复信息移出页头，内容不位移；普通 readRecovery 不常驻。`onNoticeHeightChange` 回报实际卡高、隐藏/卸载回 0；`BookshelfPage.noticeTopInset` 接收同屏事项高度，Index 负责组合，避免叠卡。 |

统一消息采用公共 `ReaderMessageStyle` 与 `TOK_MESSAGE_*` 角色，没有修改全应用原有主题和字体。B16/B17、阅读进度、更新数、状态点、无封面及正常导航/阅读控件均保持原用途。没有恢复关闭的 RSS、同步、权限或旧模块。

## 已完成验证

以下命令均在 `Reader-for-HarmonyOS` 目录执行。最后一次反馈去重修正后重跑了受影响的模式回执、本地导入组合及全组件 SDK 检查。

| 命令 | 结果 | 证明范围 |
| --- | --- | --- |
| `node tools/test-shared-download-ui-sdk.mjs` | PASS | 已安装 SDK 解析 496 个生产 ETS/TS、登记 154 个组件；1049 个真实组件字段绑定通过；Index、Settings、下载及本代理全部 14 个生产组件完成真实 SDK component transform 与资源存在性检查。只证明 parser/绑定/降级转换，不代替完整语义编译或原生布局。 |
| `node tools/test-bounded-local-import-composition.mjs` | PASS | 真实 SDK 选择/导入/结果组成、Props、禁用动作、持久结果壳、测量、短视口、退休/重开、同键结果 DTO 更新与负对照。确认原生加载，保留原本异步任务生命周期。 |
| `node tools/test-manga-directory-empty-sdk.mjs` | PASS | 页面→共享 List→原生延迟 ListItem→真实 PageState/Action；日夜与字体比例、滚动留白、清除搜索业务回调，小说不增加漫画空槽，四个负对照均拒绝。 |
| `node tools/test-bookshelf-settings-operation-sdk.mjs` | PASS | 三组真实 Preferences→Host→Index→SDK Page/Notice/Action；unknown、纯读取核对、显式保存、旧导航/挂载动作退休及 Runtime 准入。 |
| `node tools/test-bookshelf-view-mode-receipts.mjs` | PASS | 实际偏好网关→共享 feature owner→两处页面方法；写入/flush ACK、读回失败短反馈、只读核对、关闭/重开/消费者/Runtime 切换仍保留 unknown，以及旧 generation 不可执行。浮层图形绑定由前述 SDK assembly 单独检查。 |
| `node tools/test-bookshelf-dialog-presentation-sdk.mjs` | PASS | 18 例实际 Index Controller→BookRemovalDialog→共享确认按钮及分组选择；当前一次执行、旧确认/取消/迟到关闭、精确 runtime/nav/mount、迟到分组提交。 |
| `node tools/test-bookshelf-detail-removal.mjs` | PASS | 详情入架/移除准入、Core/Host 通道与本地/在线数据保护文案。 |
| `node tools/test-local-import-finalize-recovery.mjs` | PASS | 普通、旧或不匹配读取不能证明缺失写 ACK；导入完成结果仍服从原确认事实。 |
| `git diff --check` | PASS | 本轮变更无空白差错。 |

## 初始失败、定位与后继处理

1. 下载空态替换时一处旧嵌套闭括号多余，SDK parser 定位到 `SharedDownloadPage.ets` 的列表尾部；已移除，后续全项目解析通过。
2. 初次全项目 SDK 检查遇到并行修改中的 `ReaderFullDirectory.ets:178` 语法错误；已报告阅读负责人，未越权修改。负责人修复后最后一次全项目 parser/assembly 通过。
3. 旧书架设置 SDK probe 手工枚举旧 Builder，首次报缺 `settingsRecovery`。保留业务 Builder 分离并更新测试依赖，继续通过原有纯读/显式写入和旧动作身份断言。Notice 的保存动作使用捕获的导航、挂载、generation 身份，不能在点击时借用当前新身份。
4. 旧本地导入组合测试固定断言 20vp 圆角、旧 Header/Actions、40vp 完成动作、手绘旋转字段及 280vp 老边距；按已确认的 12vp/44vp/原生加载和共同规格适配。保留真实禁用、回调、测量、交接、重开、同键 DTO 与反例断言，未因改样式放宽写入边界。
5. 旧目录空态 probe 未登记 `ReaderPageState`、仍检查旧漫画小字与专用焦点按钮；改为真实 PageState/Action 组合，保留真实空槽与清除搜索回调和四个负对照。
6. 旧显示方式回执测试把“写入已确认，读回失败”强制当作常驻 Notice。现改为检查实际页面方法的短反馈及原只读核对/写 ACK 安全；页面图形组合另外由完整 SDK assembly 检查，测试输出也已明确此证据范围。
7. 新增短反馈初稿只按文本去重，可能漏掉“错误解除后同文案再次出现”。已在恢复清除、重新读取与空错误时重置去重缓存；本地导入同时避免重复对象投影造成重复 Toast，并且不把正在读取当成失败反馈。修正后受影响回归与全部 14 组件 SDK 检查再次通过。
8. 额外运行 `tools/test-bookshelf-write-receipt-consumers.mjs`，仍停在旧 Index 常驻断言（原第 167 行预期 confirmedRefreshFailed 出现在 shelfRecovery）。这与已批准的短反馈分流冲突；其 importRender 也只渲染旧 resultFooter 恢复入口。已报告 Index 负责人适配，未修改该跨域脚本，不能将此项标为通过。
9. 曾调用不存在的 `tools/test-bookshelf-management-receipts.mjs`，属于命令名选择错误，不计入任何验证结果；没有据此声明管理页业务测试通过。

## 证据与冻结边界

此记录完成后，本代理的生产代码、专属测试与本文件全部冻结，不提交。完整 ArkTS/HAP 编译、签名、安装与设备原生视觉/交互由主流程另记；本代理未运行 VM 或真机，也未声称设计预览等同原生验收。

## 后继：书架写回执消费者验证已通过

主代理重新授权适配旧 `tools/test-bookshelf-write-receipt-consumers.mjs`，以及显式 `originalPending` 事实对应的本地导入组合测试。本节替代上文第 8 项“尚未适配”的状态。本轮只改这两项测试与本记录，没有修改生产代码或公共 probe。

| 命令 | 最终结果 | 新样式后继 |
| --- | --- | --- |
| `node tools/test-bookshelf-write-receipt-consumers.mjs` | PASS：52 个独立 SDK render actors、58 个独立 durable 场景目录、2 个真实 Index 图、3 个共享 visual factory | 已确认读回失败无常驻；保留原 Index 绑定的纯读 delegate，不造已不存在的物理刷新按钮；unknown、原清理未完成仍经真实顶部 Notice 的 28vp Stack 核对。导入结果与待处理浮层独立，已确认读回失败真实 Props 可触发短反馈，选择/取消仍走原 44vp Stack。 |
| `node tools/test-bounded-local-import-composition.mjs` | PASS，含新增负对照 | 明确设置 `originalPending`；普通 confirmed 读回 busy 禁用选择时仍不得成为 unknown；真实 SDK 更新 Props 的次序不能让未知原操作先触发 Toast。将显式原事实故意放在 recovery Watch 之后的变体被拒绝。 |

原测试中全部 SQLite/AtomicFile、原写命令/资产释放次数、旧 generation、同 Runtime 重构、关闭重开、退休 Runtime、重复点击、互斥/重入、旧物理选择回调及反例保留。详情仍检查同一 book/toc 引用、同一原生 Scroll 实例与原偏移、一次原生确认和一次真实数据库移除；unknown 改为检查同详情的顶部恢复投影，正文不重新嵌入 unknown 提示。

适配中发现并报告了真实呈现问题：`LocalImportDialog.pendingImport()` 原来用 `!selectionEnabled` 识别未决，会把已确认结果重新读取时的 `reconcileBusy` 错当“导入待确认”。主代理已新增显式 `originalPending` 并由 Index 按真实 unknown/blocked 传入，禁用选择不再证明结果未知。完整 recovery 投影继续传入导入面板供已确认读回失败短反馈；声明次序使实际 SDK reset recovery 触发 Watch 前先收到当前显式原操作事实。上述两项测试在主代理修正之后通过，未放宽为接受错误的 pending 状态。

CPU probe 明确不模拟非空原生分支的移除。本项测试仅跳过单个装饰性 LoadingProgress teardown observer 的 CPU 回放，仍检查忙态原生 18vp 指示和所有实际控制、DTO、滚动及操作准入观察者。该限制已显式断言，不代表原生 loader 卸载/布局/像素已验收。其余初次失败属于新 UI 后继与测试依赖：补入完整导入结果布局函数、真实 recovery 投影及安全区 adapter；更新旧 Text/36vp、正文 unknown 和 Footer Notice 假设。

两项测试与本记录再次冻结，交主流程绑定最终指纹；没有提交、构建、签名或设备操作。

### 最终物理回调身份复核

公共 `ReaderRecoveryAction` 后继增加了按 generation 捕获的物理动作身份，本代理没有修改公共或生产代码。相应更新导入组合测试：7 代旧 native hit 在 Props 更新为 8 后仍只保留先前的 `[7]`，不能借用新代次；重绘后的当前真实 native hit 才能追加 8，得到 `[7, 8]`，其余 Props、结果与原操作断言保留。

- `node tools/test-bounded-local-import-composition.mjs`：PASS，包含上述旧/新物理回调区别。
- `node tools/test-bookshelf-write-receipt-consumers.mjs`：新公共身份 fence 下再次 PASS，仍为 52 个独立 SDK actor、58 个 durable 目录、2 个 Index 图、3 个 visual factory，无须改动该脚本。

验证记录及本代理测试修改再次最终冻结，等待主流程规范构建。

## 后继：取消的全量门禁中书架与页面旧测试适配

本节记录主代理再次授权的测试后继，取代此前本代理文件冻结状态。输入失败日志为 `/var/folders/53/6tc2ktbd19dbwxd5pmbp0d_w0000gn/T/reader-contract-run-j6YGjB`；针对当前共享工作目录的消息样式实现，只修改下表测试、其专属 projection probe 与本记录。没有改生产代码、构建、签名或设备操作。

初始失败先从代码和实际 SDK 发射结果定位：

- `projection-index-owner`、`read-owner-closure`、`manual-update`、部分管理测试仍强制已确认刷新失败挂在旧 Header Notice，并寻找旧 36vp Text 点击。实际批准行为是短 Toast；测试现在检查实际短反馈与无常驻 Notice。原 Index 绑定的只读 delegate 仍独立验证，不伪造已不存在的物理按钮。unknown、原操作清理未完成则继续通过实际顶部 Notice/28vp Stack 点击验证。
- 管理分组的已确认保存但读回失败已由 Index 关闭选择框、触发稳定书架读取并短反馈。测试改为断言真实关闭、`confirmedRefreshFailed`、正确 Toast、只写一次；未知原操作仍保留原实体和可核对入口。五种写命令、原 DTO/operationId、完整事务屏障、冷启动/同 Runtime 重构、旧回调和负对照均保留。
- 显式 SDK 成员列表漏新 `detailPendingNoticeVisible`、`viewModePending`、`modeFeedback`、Recovery Watch 方法、`onNoticeHeightChange`；Source 元数据旧局部 fixture 同样漏 Watch 依赖。补入实际生产方法/字段。新 `ReaderPageState` 等真实共用子组件注册由主代理更新公共探针；没有逐文件造消息 stub 或忽略 SDK diagnostics。
- 状态和导入测试仍期待自转 SVG、旧装饰 summary 图、旧 38vp 按钮或 20vp 圆角。后继检查实际原生 LoadingProgress 32/18、共用状态组件和 17vp padding/12vp 圆角/44vp 动作、17/24 标题与 13/21 正文、13/20 动作。原布局测量、原滚动/引用身份及按钮准入不变。历史 `import_refresh.svg` 仍做原始路径/调色来源检查，但明确它已不在结果消息中绘制。
- `viewport-return` 仅因 Index 新增 `noticeTopInset` 使旧相邻字段正则失效；后继明确检查其计算，继续验证原 List/Scroller、锚点身份、偏移与迟到回调。`more-layout` / `view-and-menu` 还覆盖其实际导入的 shell / surface-repair / sheet 组合依赖。

| 命令 | 最终结果 | 保留及后继覆盖 |
| --- | --- | --- |
| `node tools/test-bookshelf-management-shared-owner.mjs` | PASS，20 组 | 实际 Host→Orchestrator→Gateway/Core→Index→SDK；已确认关闭+Toast、未知/清理未决真实核对及显式继续、DTO/operationId、原写次数、Runtime/实体/代次和负对照。 |
| `node tools/test-bookshelf-management-typography.mjs` | PASS | 普通内容保留旧有限字体 tuple；状态消息明确使用共用 MESSAGE_BODY 与原生 18vp loader，实际公共动作字体继续检查。 |
| `node tools/test-bookshelf-manual-update.mjs` | PASS，31 组 | 原强制刷新、缓存隔离、并发上限、部分成功、读回失败、任务事实、诊断故障、Runtime/导航及重构屏障全部保留；结果 Toast 与原只读 delegate 分开检查。 |
| `node tools/test-bookshelf-more-layout.mjs` | PASS | 原四项菜单、锚点、指针、几何、进度、禁用/重复点击及依赖 shell 15 项。 |
| `node tools/test-bookshelf-native-sheet-owner.mjs` | PASS | 原四动作、真实 State/Prop/raw proxy、Sheet Builder、同/异实体、重开、导航/Runtime/挂载退休与原始 guard 负对照保留；本项无待处理显示方式。 |
| `node tools/test-bookshelf-physical-feedback.mjs` | PASS，19 项 | 实际 SDK 详情及目录空/加载/失败跨共用子组件查找；书源名称/类别/URL、真实动作、简介/目录/元数据不变。此脚本名称不代表真机像素验收。 |
| `node tools/test-bookshelf-projection-index-owner.mjs` | PASS | 原 Core/Flow/ReadOwner/Projection/Index 读取、分页窗口、锚点、来源事实与退休检查保留；真实 Shell Toast+无 Notice，并保留原只读重试及旧页面动作失效。 |
| `node tools/test-bookshelf-read-owner-closure.mjs` | PASS | 空白首次失败重试、旧内容保留、空读/坏读/筛选、发布失败、迟到成功/失败及无写入断言保留；普通读失败为 Toast。 |
| `node tools/test-bookshelf-removal-index-consumers.mjs` | PASS，11 组 | 真实 unknown/cleanup blocked 顶部 Notice 的 28vp native Stack；核对只读，继续原删除/清理保留原 operationId/DTO，一次提交、冷导入与退休代次保留。 |
| `node tools/test-bookshelf-search-action-owner.mjs` | PASS，8 组 | 实际 Index→Shell→TopBar 搜索动作；重复、路由/导航/挂载/Runtime 退休、保留 reader 与新 actor 准入。此脚本无需本代理改动，主代理公共 Props probe 修复后通过。 |
| `node tools/test-bookshelf-shell-states.mjs` | PASS，15 项 | 同一 shell/槽位、Header/内容身份、Core 空/初读失败分支、主题、稳定动作、更新及宽屏导航不变；真实 PageState/Action/原生 loader。 |
| `node tools/test-bookshelf-startup-readiness.mjs` | PASS | 原权威首屏、延迟/失败读取、显示方式 ACK 复用、写入/恢复上下文与无重复投影；补实际反馈方法依赖。 |
| `node tools/test-bookshelf-view-and-menu.mjs` | PASS | 普通列表和菜单/Sheet 不变；导入保留自然测量和交接动画，载入明确为原生指示而非旧无限旋转。 |
| `node tools/test-bookshelf-viewport-return.mjs` | PASS | 原锚点/偏移/List/Scroller/过滤迁移/重排/迟到隔离，增加顶部待处理避让输入的接线断言。 |
| `node tools/test-book-removal-dialog.mjs` | PASS | “移出书架”文案；确认/取消/旧意图/一次准入、长后果全文滚动、真实 SDK 共用 Surface、统一字体/几何及有限规格传播保留。 |
| `node tools/test-import-refresh-geometry.mjs` | PASS | 真实结果 count 为 13/21、无装饰刷新图、保留测量回调和 Day/Night/Day；旧 SVG 仅作历史资源来源检查。 |
| `node tools/test-surface-repair.mjs` | PASS（亦由 view-and-menu 实际导入执行） | 原本地导入 lifecycle、序列化显示方式/失败恢复、布局与历史/Spinner 断言；补新实际 mode 方法依赖。 |

`git diff --check` 对上述本代理测试与专属 probe 通过。没有删掉事务、动作身份、generation 或原反例来规避失败；已不存在的旧物理 UI 断言被真实呈现断言替代，原纯读业务回调验证单独标明。SDK CPU 探针不等于原生布局、调度、HAP/设备或用户视觉验收。

本节写入后，归属测试、专属 probe 与本记录再次冻结，交主流程运行完整规范门禁并绑定最终内容指纹；不提交。

## 后继：目录加载使用明确事实，避免中文失败文案冒充忙态

只读收口发现 `BookDirectoryPage` / `LocalBookDetail` 按“正在/加载/读取”前缀猜忙态，而 `ReadingEntryHost` 的失败分支直接投影实际错误文本。本次全量执行授权内，主代理安排修复：类似“读取失败…”的已失败目录会因此持续显示 loader，完整目录还隐藏原有重试入口。本节是该真实呈现问题的代码修复，不新增目录获取、重试或写入流程。

`ReadingEntrySnapshot` 新增可选展示事实 `catalogLoading`：实际目录 admission 的 `begin` 为 true；成功、失败、退休置 false；绑定已有 reader/TOC 显式为 false；已有后台读失败保留 TOC 与已就绪状态。Index 使用 `detailCatalogBusy = snapshot.catalogLoading === true`，手工错误/清空消息同步置 false。`LocalBookDetail`、`BookDirectoryPage`、`ReaderShell`、`ReaderFullDirectory`、`FullDirectoryPanel` 统一使用/传递 `catalogBusy`，不再从文案判断加载或重试。Index 其余换源恢复和普通错误分流由主代理独立处理，本代理未改那些流程。

新增 `tools/test-directory-catalog-busy-sdk.mjs` 运行真实 Host、Index 和 SDK 发射组件：

- “读取失败：本地目录暂不可用”与“加载失败：目录内容暂不可用”从真实 Local Gateway 错误经 Host→Index→详情 Prop 到 SDK；均无加载动画，外部目录和完整面板保留原 native 重试。
- 核对实际 Index 外部目录→ReaderFullDirectory→FullDirectoryPanel，以及 ReaderShell 的 text/manga 目录两条 busy 透传；不是只对源码字段名做检查。
- 正常未完成目录仍为 true，详情和目录实际原生 32vp loader；成功空目录为 false。
- 绑定现有 reader/TOC 不冒充首次加载；实际后台投影读取失败保留原 TOC 引用和 false；retire 清 false；远程 catch 清 false。
- 将旧文案前缀判断恢复到隔离的实际 SDK 编译变体时，新反例拒绝该变体。

当前通过：新测试 6 组及旧 heuristic 负对照；`test-reading-entry-host` 的原 46 个 checkpoint；`test-reading-entry-snapshot`；`test-manga-directory-empty-sdk`；`test-bookshelf-physical-feedback` 19 项；`test-reader-directory-host`；`test-reader-direct-entry-recovery`。未运行构建/签名/VM/设备。

既有 `test-reading-entry-index-sdk` 另暴露与本修复无关的旧消费者断言和真实取消竞态：unknown 入架已迁至顶部投影，因此其正文断言改为检查真实顶部 Notice，原 book/toc/Scroll、身份与回调断言保留；随后 cancelled 分支显示 `BookshelfReadableAdmissionOwner` 在取消已确认后收到原 add 的迟到 reject，仍将 confirmation 改回 unknown，导致成功取消文案被 pending 分流隐藏。该真实 owner 问题已报告主代理，由阅读负责人另行完成最小 owner 修复：已确认取消不被迟到 add error 降级；取消严格成功且无 add receipt 时恢复 none，有 receipt 时保留 confirmed，不伪造 add ACK。

owner 修复之后，`node tools/test-reading-entry-index-sdk.mjs` 最终 PASS（28 组），保留原“已取消加入书架”断言以及入架 confirmed/unknown/cancelled 三种实际 native 动作、同一书籍/TOC/Scroll 引用和偏移、旧回调、导航/Runtime 与负对照。其余本节所列通过项仍有效，`git diff --check` 通过。本代理所有目录生产文件、专属测试/probe 和本记录现再次冻结，交完整规范门禁；未提交、构建、签名或操作设备。

## 最终后继：核对动作的原位忙态

主代理安排收口已批准的小动作忙态。原 BookshelfShell 没有收到真实 `reconcileBusy`，未知原操作核对期间 `view.canRetry=false` 会让核对按钮消失。本轮只改书架范围与 `Index.bookshelfShellContent`：Index 明确透传 `recoveryBusy = shelfOperation.reconcileBusy`，Shell 将它给实际顶部 Notice，不以 `!canRetry` 推断忙态。

书架设置的核对读取使用已有 `receipt.receipt.readback === 'reading'`；unknown 的 `facts.fact` 仍是 pendingReconciliation，不能假定它会变成 refreshing。没有动作归属事实时不伪造 secondaryBusy。显示方式 owner 不发布核对中的中间 snapshot，因此两页各以局部 `modeReconcileBusy` 表示实际 reconcile Promise 生命周期：调用前设 true，同 mounted/revision 的 finally 清除，退出清除；接受新的显示方式意图并换 revision 时也清旧展示忙态。原 owner、generation、读写准入和 ACK 语义保持，静止 unknown 本身不代表 busy。

| 验证 | 最终结果 |
| --- | --- |
| `node tools/test-bookshelf-removal-index-consumers.mjs` | PASS，12 组。新增真实 durable unknown→原操作查询 gate→reconcileBusy→查询后仍 unknown：Index 的实际 Prop 为 true、canRetry 为 false 时仍有 native 核对动作，标签 opacity 0、18×18 原生 loader、28vp 目标，忙态禁点；没有重复 query、写入或资产清理，静止未确认无 loader。 |
| `node tools/test-bookshelf-view-mode-receipts.mjs` | PASS。保留全部原真实偏好/共享 owner/ACK/关闭重开/Runtime/代次检查，新增两页实际 SDK→Notice→native 动作及真实读取 gate：相同 generation 的原 actor 和 native hit 不换，标签透明占位、18vp loader、禁用、重复点击仅一个纯读；Promise 完成后局部 busy false，未知回执仍未知，重新静止呈现无 loader。 |
| `node tools/test-bookshelf-settings-operation-sdk.mjs` | PASS，4 组。新增真实 Settings Host→Index→SDK 的 unknown readback reading 过程：原 label 保留、opacity 0、18vp loader、28vp 动作且禁用；读取不派发设置写入，核对后仍不冒充 ACK。 |
| `node tools/test-bookshelf-shell-states.mjs` | PASS，15 项。 |
| `node tools/test-bookshelf-startup-readiness.mjs` | PASS。 |

SDK fixture 适配中先补入该局部模式测试不执行的 Sheet Builder 入口；偏好 get 使用真实异步边界，待进入 gate 后才统计一次读取，未放宽重复读取断言。CPU 探针不模拟原生分支卸载：本次明确验证忙态进入时原 hit 保留，结束检查实际 Promise 状态清除及静止组件无 loader；原生调度、布局和像素仍由交付/设备证据单独记账。

`git diff --check` 通过。本代理生产、测试、专属 probe 与文档全部再次冻结，可进入主流程完整门禁；未提交、构建或操作设备。

## 完整门禁后继：13 项页面与关闭模块测试适配

主流程完整门禁运行 703 项后报告 60 项失败。本次全量执行授权内，主代理安排本代理定向修复下表 13 项；本轮仅修改归属测试、专属 fixture 和本记录，生产保持冻结。原失败证据保留于 `/tmp/reader-message-full-pipeline-20261019.log` 及 `/var/folders/53/6tc2ktbd19dbwxd5pmbp0d_w0000gn/T/reader-contract-run-yb7R5L`，本批最终复跑日志为 `/tmp/pages-followup-tests-20261019/<测试名>.log`。

初始失败与后继处理如下：

- `bookshelf-settings-layout` 的局部 retry fixture 省略真实 snapshot 中 `facts`，新增 busy 展示读取它时抛错；补完整 receipt/readback/facts，SDK 构造传入真实参数容器。原 async mode commit/rollback、迟到 admission 和自动更新回调断言保留。
- 搜索设置及次级页面的局部 SDK 编译列表缺新增真实 `hasReadData` / `originalPending` 方法与 readFacts。补入生产实际方法及 focused snapshot，未用空函数替代。缓存清理沿实际 `ReaderNativeAlertOwner` 先显式确认，再执行原清理；重复点击未确认不得派发的断言保留。主代理随后修复 management 已确认读回失败的实际纯刷新入口，本批两项再复跑仍通过。
- 3 项返回/详情目录脚本经主代理公共 Builder probe 补真实 Watch 和有限消息依赖后恢复通过，本代理未改脚本。原返回优先级、临时层租约、Runtime/导航/实例身份、旧回调退休和目录准入断言保留。
- Sync 的旧探针只局部编译消息 build，漏共享组件新 Prop/Watch 初始化；并查找已退役的 36vp Text 点击目标。专属 fixture 接入完整实际 `boundedSurfaceSdk` 消息组件，选取真实 44vp Stack 动作；Index 消费者同样穿透实际 Notice/Action。标签从实际组件 actionLabel 或 native accessibilityText 读取，不再把 Stack.create 当 Text。原 Atomic 文件、冷恢复、operationId/hash/secure ID、纯 GET 核对、显式继续、不得重放 PUT/DELETE、旧 owner/generation/Runtime、秘密不出 snapshot、清理退出与 skipped/completed 区分全部保留。关闭模块只在原测试 harness 内执行；应用入口仍关闭，未修改 Sync 生产或恢复功能。
- 生产 SVG 清理后，导入测试仍读取已退役 `import_refresh` 文件。改核对保留的历史 Figma 输入 SHA256 `a8a686586b905ec6131260c535ba68d9896f3afda9816e338178164e4877ff5a` 和原 24×24/path/stroke/旋转几何，同时断言旧生产资源不存在。当前展示用实际 `LocalImportDialog.fileSelectionActions`→共享动作→native 18×18 loader，标签 opacity 0、禁用且不位移；结果 count 的 13/21、无装饰图片、实际测量回调与 Day/Night/Day 保留。

| 命令 | 最终结果与实际覆盖 |
| --- | --- |
| `node tools/test-bookshelf-settings-layout.mjs` | PASS；浮动共用 Header、完整视口、内容避让、宽度/主题及原异步模式提交/回滚/退休。 |
| `node tools/test-search-settings-physical-feedback.mjs` | PASS，7 组；实际 SDK 操作反馈、缓存清理确认与原动作/内在几何。 |
| `node tools/test-secondary-floating-bars.mjs` | PASS，8 个次级页面；窄/短/非对称/宽帧、安全区、透明覆盖层及原路由/编辑回调；保留 RSS/Sync 入口关闭断言。 |
| `node tools/test-temporary-back-leaf-sdk.mjs` | PASS；真实设置选择/书源折叠/书架菜单、同实例重入、迟到回调/ACK 拒绝及无临时层不消费返回。 |
| `node tools/test-temporary-back-index-sdk.mjs` | PASS；实际 Index→SDK 返回桥接、临时层优先级/路由回退、身份 fence 与保留 Prop/Watch 租约。 |
| `node tools/test-text-detail-directory-sdk.mjs` | PASS；实际 Index→Full→Scaffold/Header→Panel→native List，独立/嵌入/reader 等待、定位/退休、safe-top Area 及四项准入。 |
| `node tools/test-sync-backup-durable-receipts.mjs` | PASS；实际文件 Preferences→Store→Gateway→owner→SDK，精确冷 ID/纯读核对、部分事实、来源/信封拒绝、无重放及 Runtime 退休。 |
| `node tools/test-sync-backup-retention-exit.mjs` | PASS；真实 journal/原回执核对后显式退出、unknown/404/旧身份拒绝、无写重放、冷终态及 skipped 不冒充 completed。 |
| `node tools/test-sync-config-cold-intent.mjs` | PASS，14 组；实际 Atomic 文件与冷实例、同文件队列、原 hash/ID、显式继续、迟到 add/remove、清理屏障和保留 actor。 |
| `node tools/test-sync-config-durable-receipts.mjs` | PASS；不可变 secure ID、丢 ACK、旧/错 ID 拒绝、纯查询+显式继续、重启屏障、清理 unknown/NOT_FOUND 与无秘密 snapshot。 |
| `node tools/test-sync-receipt-owner-closure.mjs` | PASS；真实 AssetStore→Gateway→owner→SDK 的读/写/未知/备份/部分恢复、持久回执、重入/代次/owner/队列/秘密边界。 |
| `node tools/test-sync-index-operation-consumers.mjs` | PASS；真实 AssetStore→Gateway→owner→Index→SDK，首读失败、ACK/读回/未知、无重复保存/备份及退休回调。 |
| `node tools/test-import-refresh-geometry.mjs` | PASS；历史 Figma hash/几何及生产孤儿资源退役、当前真实 native18 动作加载与结果测量/主题保留。 |

13 项均退出码 0，日志均含 PASS。`git diff --check` 对本批归属测试、fixture 和本记录通过。没有删除原事务、身份、数据保护、只读或旧回调断言来规避失败。SDK/CPU 证据不代表原生像素、手势、目标持久性、HAP/VM/设备或用户视觉验收；本轮未提交、构建、签名或操作设备。

本批归属测试、专属 fixture 与本记录再次冻结，交主代理重新运行完整规范门禁；703 项完整门禁的最终结果由主流程另记。

## 后继：书架设置读取状态不再由重试资格推断

主代理只读复核发现 `BookshelfSettingsPage.pageContent` 的两处状态使用 `canRetry !== true` 或 `!recovery.canRetry` 显示 loader。共享 fact vocabulary 中，静止的 blocked/cancelled/idle/notDispatched 也可以不可重试，不能因此表示有读取在执行。此次仅安排修复该页的展示；owner、事务与样式规格保持。另已代码定位 `BookshelfViewModeHost.load` 不发布 loading 中间 snapshot，页面首次实际 load Promise 需要最小局部 `modeLoadBusy`，按挂载/revision 生命周期清除，以保留真实首次加载。

两处页面 loading 现仅使用 `readFacts.fact === 'loading' || 'refreshing'`；显示方式再合并真实 `modeLoadBusy` 与已有 `modeReconcileBusy`。非忙态标题区分读取失败、读取已取消、暂不可用及尚未读取；原 message 保留，不把 recovery 对非失败事实的通用“正在读取”兜底带入静止页。`canRetry` 只决定原重试动作是否存在。实际首次 `loadMode` 调用开始设置 busy，同 mounted/revision finally 清除；退出和新显示方式意图清除旧 busy，旧 revision 不得清新请求。重开 unknown 由 load→reconcile 时顶部原动作同样使用该真实忙态。

`test-bookshelf-settings-layout` 新增实际 SDK→PageState→Action/native 11 组：静止 idle/cancelled/failed/refreshFailed/notDispatched/blocked 且不可重试均无 loader；loading/refreshing 有原生 32vp loader；首次失败可重试保留真实 44vp 动作及原 generation/navigation 回调；只有真正的 mode reconcile 忙态影响其局部状态。实际 `BookshelfViewModeHost` 首次 Promise 无中间 readFacts 时仍显示 loader，完成后清除；退出后不回填，旧 revision 完成不清新请求。隔离 SDK 变体恢复旧 canRetry heuristic 时，同一 cancelled 反例明确拒绝旧实现。

最终复跑均退出码 0：

| 验证 | 结果 |
| --- | --- |
| `node tools/test-bookshelf-settings-layout.mjs` | PASS，11 组读取状态/真实 Promise 和两处旧 heuristic 负对照，原布局/主题/异步提交回滚及退休断言保留。 |
| `node tools/test-bookshelf-view-mode-receipts.mjs` | PASS，原真实 Preferences/Host/两页 ACK、unknown、纯读核对、重开/Runtime、原位 busy 和 restore gate 保留。 |
| `node tools/test-bookshelf-settings-operation-sdk.mjs` | PASS，4 组，原真实 Host→Index→SDK 的未知写入、纯读核对、显式有限重试、物理退休与精确 Runtime 保留。 |
| 实际 `approvedTypographyContract`（`features/bookshelf/BookshelfSettingsPage.ets`） | PASS，registered=true、count=4；既有精确 typography snapshot 无需改动。 |

日志仍为 `/tmp/pages-followup-tests-20261019/` 下对应测试名，精确字体契约为 `bookshelf-settings-typography-contract.log`。本节仅生产 `BookshelfSettingsPage.ets`、归属 layout 测试及本记录由本代理修改；公共探针的有限字段接线由主代理负责。`git diff --check` 通过；未运行构建、签名或设备操作。全部写入现再次冻结，交主流程完整门禁。

## 后继：r5 书架 Shell 真实 Watch 的回调初值

r5 完整门禁 703 项中 694 PASS / 9 FAIL。主代理指定本代理只处理 `test-bookshelf-shell-states` 及其 importer `test-bookshelf-more-layout`。两份原日志位于 `/var/folders/53/6tc2ktbd19dbwxd5pmbp0d_w0000gn/T/reader-contract-run-QzCcfS/`：同一 Shell 的 3 组场景在真实 recovery Watch 执行时抛出 `this.onNoticeHeightChange is not a function`。代码定位为专属 fixture 选择了 Watch 方法却遗漏原回调字段声明/初值，随后 Object.assign 的 recovery Prop 先触发 Watch、回调尚未赋值；生产原字段已声明。本轮仅补测试的实际字段与 Index Prop/测量接线证明，生产冻结，原业务断言保留。

专属 SDK 成员列表现选入生产 `onNoticeHeightChange` 字段，保留 SDK 发射的真实默认初值，未抑制 Watch 或替换业务恢复方法。测试记录回调，并继续检查实际 Watch/appear 将隐藏提醒归零；新增原 Index `onNoticeHeightChange(76)`→`shelfPendingNoticeHeight`→保留 BookshelfPage 的 `noticeTopInset=84`，同一回调传 0 释放避让，页面 actor 不变。原 15 组 Shell 的布局、主题、导航、More 锚点/进度/动作准入、首次加载/失败和 opaque Scaffold 负对照均保留。

最终 `node tools/test-bookshelf-shell-states.mjs` PASS（15 组），`node tools/test-bookshelf-more-layout.mjs` PASS（包括实际 import 的 15 组 Shell 与 PH60 的四行/滚动/指针/进度/主题/禁用/一次更新）。两项均退出码 0，日志 `/tmp/pages-followup-tests-20261019/bookshelf-shell-states-r5.log` 与 `bookshelf-more-layout-r5.log`。本轮实际只需改 Shell-state 专属测试，importer 无独立漂移。`git diff --check` 对该测试与本记录通过；生产未改，未构建/签名/操作设备。归属测试与本记录现再次冻结，交主流程最终门禁。
