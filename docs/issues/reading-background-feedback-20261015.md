# 阅读后台保存与消息提醒通道审计（2026-10-15）

## 范围与基线

- 候选独立工作区：`.reader-isolated/runtime-reservation-repair-20261015/Reader-for-HarmonyOS`，未操作主树。
- 静态统计基线：`6c09fdf804fadeeb82a745129d1bec251b6d27ce`（简称 `6c09fdf8`）。审计表行号指该基线；实施更新章节明确标注当前工作区行号，后续修复可能移动行号。
- 首轮为只读审计并新增本文，写文前 `git status --short` 为空。随后实施方修改候选源码；审计 agent 另按授权适配两份退出 UI 回归并执行 targeted。本次文档更新仅修改本文，不改源码或测试、不提交、不操作设备。
- 用户要求：后台保存等此类问题不得用弹窗阻碍使用，采用不需要交互、低干扰的消息提醒；先禁用此类弹窗，再并行定位原因。
- 阅读器 8 处与 Index 1 处纯错误/后台恢复 Alert 的低干扰替换及 targeted 已实施；新产物和物理验证仍 **OPEN**，不能把源码及本地回归等同设备通过。

## 已有物理证据与问题边界

已有物理证据位于候选 Host 私有目录：

- `.reader-local/runtime-reservation/physical/reappeared-error.jpeg`
- `.reader-local/runtime-reservation/physical/reappeared-error.json`

本轮读取已有 JSON，未重新抓取设备。布局包含《魂断大明》（SoulCut）及原生 Alert：标题“阅读时长尚未确认”，正文“阅读时长尚未确认保存。请重试核对后退出，或继续阅读；当前时长不会作为新记录重复累计。”，按钮“重试保存并退出”和“继续阅读”。证据说明退出受交互确认阻挡，不证明底层写入已失败或已成功。

对应代码为 `entry/src/main/ets/features/reading/LocalReadingExperience.ets:6633`：`finishExit` 捕获时长或进度保存异常后撤销退出请求，再显示确认框。时长异常文案来自 `features/reading/ReadingRecordGateway.ts:90`。

此前旧 Core 首次隔离问题与本次时长未确认现象必须分开记录。仅凭再次出现弹窗不能把两个问题判定为相同根因，也不能把前次隔离修复认定为本次时长持久化已修复。本次具体底层故障原因尚未捕获；代码侧发现与恢复改动不能代替这次物理失败的根因证据。

## 修复前生产消息与交互通道（6c09fdf8）

以下路径均相对 `entry/src/main/ets/`。统计为 `.ts` / `.ets` 中实际调用表达式数量，排除 import、函数定义、注释、主题注册字符串、测试；是静态调用点，不是运行次数或全部可见状态数量。

| 通道 | 实现及基线位置 | 数量与用途 |
| --- | --- | --- |
| 系统 Toast | `getUIContext().getPromptAction().showToast()` | 28 个调用点、7 文件；用于操作结果、保存待确认、复制失败等；当前没有独立共享 Toast 服务，可直接复用系统 API |
| 页内恢复提示 | `features/common/ReaderRecoveryNotice.ets:9`；`app/ReaderRecoveryProjection.ts:10` | 15 个渲染点、14 文件；书架、发现、目录、RSS、导入、同步等页内反馈；`canRetry:false` 时只有文字，没有交互要求 |
| 阅读换源完成胶囊 | `features/source/SourceSwitchCompletionOverlay.ets:29`；`features/reading/LocalReadingExperience.ets:2747` | 阅读器拥有生命周期与定时器，现有 2200ms；`HitTestMode.None` 不阻挡触摸；绑定换源成功语义，不能直接假定为通用后台消息服务 |
| 局部状态文字 | `features/source/SourceSwitchWindow.ets:555`；`features/manga/MangaReadingSurface.ets:1969,2054` | 换源错误、单图失败、漫画页面错误在所属区域显示；未做全项目状态文字总数统计 |
| 原生 Alert | `app/ReaderNativeAlertOwner.ets:4,59` | 4 个原生展示宿主；Index 9 个业务调用、LocalReadingExperience 10 个、SettingsPage 和 SourceToolsPage 各 1 个，共 21 个业务展示点；`notice` 也仍是需关闭的模态弹窗 |
| 自定义 Dialog | `features/common/ReaderDialogSurface.ets:52`；Index 分组编辑 `pages/Index.ets:2102`、JSON 导入 `features/common/JsonImportDialog.ets:51`、删除书籍 `features/bookshelf/BookRemovalDialog.ets:25` | 3 个共享表面渲染点；BookRemoval 使用唯一 `new CustomDialogController` 调用；适合主动编辑、导入与删除决策 |
| Sheet | `features/common/ReaderActionSheetContent.ets`、`ReaderSheetActionList.ets`；`features/bookshelf/BookshelfPage.ets:323` | ReaderActionSheetContent 有 3 个渲染点；书架动作由 ReaderSheetActionList 包装；用于书架动作、漫画更多、漫画下载操作，不是后台错误通知 |
| 系统持久通知 / Snackbar | 检索生产 `entry/src/main/ets` | 未发现通知发布 API 或 Snackbar 实现；`features/settings/SettingsPage.ets:296` 的通知权限行不等于通知发布能力 |

数量口径补充：ReaderRecoveryNotice 可以嵌在已有 Dialog 内，因此组件自身是内联反馈，不保证其父容器无模态；应选择正常页面宿主。本表计数保留修复前提交口径；实施后对比单列如下，避免覆盖基线。

## 已可复用的低干扰路径

1. `features/reading/LocalReadingExperience.ets:3499`：连续滚动进度保存失败已用 Toast，“阅读进度未保存，将在停止滚动或退出时重试”。本次可复用平台 API，不需要新增提示框或通用消息框架。新文案只有在确实保留并安排重试时才能承诺重试。
2. 同文件 `:4649` 的 `notifyPreservedContentRefresh`，在 `:4672` 使用 Toast，并捕获展示异常，确保通知失败不会把可读章节变成加载失败。
3. 同文件 `:12975`：普通已展示页面持久化异常只记录日志，不弹窗。静默日志适合重复后台尝试，但不能替代未确认事实与重试数据的保存。
4. `features/sync/SyncPage.ets:245` 使用 ReaderRecoveryNotice；`:265` 展示 `snapshot.statusMessage`。这是现有“前台手动备份”页的持续内联状态，不要求全局弹窗。未发现后台同步错误的专用阻塞 Alert，不宣称已有完整后台同步通知系统。
5. ReaderRecoveryNotice 可承载用户以后主动打开相关页时查看的未确认状态；如本轮只要求非交互提示，可用 `canRetry:false`，不要为了消息展示让用户先完成操作。

## 本轮处理的三类阻塞路径（修复前审计）

| 优先级与类型 | 基线位置 | 修复前行为 | 迁移约束 |
| --- | --- | --- | --- |
| P0 退出时后台时长/进度未确认 | `features/reading/LocalReadingExperience.ets:6633` | “重试保存并退出 / 继续阅读”决定是否退出 | 采用一次低干扰提示；后台保存结果与导航分离。不能只删 Alert 后继续提前 return，造成无提示的退出阻塞。保留未确认写入身份及待恢复事实，不虚报保存成功 |
| P0 翻页进度未确认 | 同文件 `:12987` | `retry-blocking`，“正在确认阅读进度”，唯一按钮“重新确认”，禁止外部取消 | 迁移为非模态提示并提供系统自身恢复路径；不能删掉唯一 reconciliation 入口后让状态永久停在 unknown；不以用户点按钮驱动每次后台恢复 |
| P1 页面渲染恢复 | 同文件 `:13240` | `retry-blocking`，“正在恢复页面”，唯一按钮“重新显示” | 属于实际渲染恢复，不能当作纯保存错误机械删除。复用所属页面状态/轻提示，保留自动恢复与返回能力，不暴露未准入页面 |

扩大实施范围后，上述纯错误提醒也已迁移：阅读器额外 5 处（预览不可用、规则未确认 2 处、规则后位置恢复失败、原始跳转/刷新失败），加上前三处共 8 处；Index 阅读失败聚合展示方法 1 处。这里按展示调用点计“8 + 1”，Index 方法有多个业务入口，不能把 1 误解成仅一个错误触发场景。

## 必须保留的真实决策边界

删除书籍/书源/订阅源、清除离线内容、导入覆盖、设置重置等影响数据的决策仍可使用确认 Dialog。主动打开的分组编辑、导入与 Sheet 操作也不属于应禁用的后台失败提醒。

缓存刷新与保留缓存是有实际行为差异的选择：`pages/Index.ets:6147` 及 `features/reading/LocalReadingExperience.ets:4622`。本轮不能以“取消所有弹窗”替代对这些用户决策的单独判断。

统一边界是：后台保存、后台恢复的待确认事实不能要求用户先关闭弹窗才能继续使用；明确的用户数据决策仍由用户选择。Toast、内联状态、原生 Alert、自定义 Dialog 和 Sheet 不应被混成一个提醒组件。

## 已实施更新（候选工作区）

以下当前行号来自本次文档更新时的工作区读取，不改变上面的 `6c09fdf8` 基线口径。

- `features/reading/LocalReadingExperience.ets:1959` 新增私有 `showReaderBackgroundNotice`，复用系统 Toast，持续 2000ms；连续相同文案在 5 秒内去重，展示异常被捕获，不拥有保存或导航状态。
- 三处原 Alert 已移除，分别改为 `:6635`“部分阅读记录保存尚未确认”、`:12959`“阅读进度正在后台核对”、`:13210`“正在恢复阅读页面”。此处“同文案去重”指每条消息重复出现的节流，不是三种情况共用同一句文案。
- 阅读器新增迁移的 5 处当前在 `:10798`（预览不可用）、`:10827,10861`（规则保存未确认）、`:11018`（位置恢复失败）、`:11687`（跳转/刷新失败）；复用同一 helper 的固定短文案。剩余 2 处 Alert 是 `:4635` 缓存刷新/保留的真实选择和 `:10808` 用户主动请求的规则预览。
- `pages/Index.ets:6175` 的 `showReadingFailure` 改为系统 Toast 2000ms，固定短文案“阅读暂未完成，请稍后重试”，不展示原始异常 message/title；捕获展示失败，不改导航与业务状态。缓存刷新/保留、删除、覆盖等其他方法未改。
- `finishExit` 保存异常只作安全日志与轻提醒；不取消原退出目标、不重启阅读时钟，不把未知保存改成成功 ACK，最终按原目的地退出。过期 lifecycle / attempt 与 once-only 导航门禁仍保留。原有正常 TTS stop → record handoff → progress 序列保留。
- 翻页进度未知时自动发起一次只读 reconcile，仍受原身份与 generation 门禁约束；没有凭空重放原写入，也不把未知结果升级为成功。若原 write 永不返回、串行通道持续被占用，一次 reconcile 不代表恢复活性已经完成。
- 页面恢复改为下一 frame 沿原 guard 尝试 `completeBookTurn2DFallback`，原 content-ready 路径仍在；若 ready 永不抵达，不能声称自动恢复最终一定完成。去掉模态交互与恢复活性是两项不同验收。
- 时长复用 Runtime 所有的 `ReadingRecordGateway` outbox-v2，并兼容既有 v1 journal：`features/reading/ReadingRecordGateway.ts:13`、`:14`、`:54`；`ReaderReadingRecordHost.ts:68` 的 flush 做 handoff 后立即 resolved，不等待 IO。handoff 只表示 Runtime 接管，不等于已落盘。磁盘满/写入失败、容量限制而仍留在内存的项目，以及落盘前强杀进程均有数据保护边界，不能承诺所有时长都已持久化；必须按实际 durable 状态和后续恢复证据记账。

### 实施后静态统计对比

仍统计生产 `.ts` / `.ets` 的实际调用表达式；辅助方法调用与系统 API 调用分开，不能把八个 helper 业务调用误计为八个新增系统 Toast 调用。

| 指标 | 6c09fdf8 基线 | 实施后工作区 |
| --- | --- | --- |
| 系统 `.showToast()` 调用点 / 文件数 | 28 / 7 | 30 / 7 |
| 原生 `.showAlertDialog()` 适配宿主调用点 / 文件数 | 4 / 4 | 4 / 4 |
| 阅读器 `this.showReaderAlert()` 业务调用 | 10 | 2 |
| Index `this.showIndexAlert()` 业务调用 | 9 | 8 |
| 全部原生 Alert 业务展示点（加 Settings/SourceTools 各 1） | 21 | 12 |
| `this.showReaderBackgroundNotice()` 业务调用 | 0 | 8 |

原生展示适配仍保留，因此宿主数量不变；真实删除/覆盖等决策确认未被一刀切删除。

## 验证状态与交付边界

- 生产通道与本次阻塞代码定位：完成，审计基线 `6c09fdf8`；修改后调用计数已重新核对。
- 已有物理布局中的弹窗文案核对：完成；23:30《魂断大明》截图/布局是真实旧包证据，不是新实现验证。
- 设备与旧包状态来自主任务现场记录：旧包此前已保数据安装，当前目标 `USBOffline`。本次文档更新未重新连接或抓取设备。
- 低干扰提醒实施、5 秒去重、Toast/日志异常不阻塞，以及原退出目标和非伪造 ACK 边界：下列本地 targeted 已通过。
  - `node tools/test-reader-native-alert-exit-faults.mjs`
  - `node tools/test-bookshelf-reading-entry.mjs`
  - `node tools/test-index-native-alert-consumers.mjs`（Index 迁移后通过；同轮重跑 bookshelf targeted 也通过）
- 上述测试执行实际生产方法；Index targeted 还覆盖固定短文案不泄露原始错误、Toast 抛错不改变业务/导航，以及剩余真实决策 Alert 门禁。退出 targeted 覆盖 record/progress 失败、无 modal、弱提示、stale lifecycle/attempt、once-only、原目的地与正常序列；不证明 ArkUI 视觉或设备行为，不代表全量回归完成。
- Runtime 时长接管与 outbox-v2/v1 兼容实现已接入；落盘故障、容量及强杀边界不能被“handoff 成功”抹去，完整恢复活性仍须单独验收。
- 新 HAP 构建/签名与 manifest 绑定：待进行，**OPEN**。
- 新包保数据物理安装与交互验证：待目标恢复连接后进行，**OPEN**。
- 原始时长失败的具体底层原因、写入永不完成/ready 永不到达的最终恢复活性、用户验收：**OPEN**；不能与旧 Core 首次隔离问题混同。
