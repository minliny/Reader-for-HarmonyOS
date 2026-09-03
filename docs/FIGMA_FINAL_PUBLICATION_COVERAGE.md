# Figma Final 静态出版覆盖矩阵

记录日期：2026-08-10（审计纠正后；A 组真实书源 Phone VM 回归）
唯一视觉来源：[Reader UI - Phase 2 Design System](https://www.figma.com/design/klhs2jMM4MncaJFqZMfqEK)（file key `klhs2jMM4MncaJFqZMfqEK`）
本表只记录来源与实施状态，不是设计稿、导出物、Token 或生成输入。所有坐标以实时 Figma 节点为准。

## 图例

- **实现层**（三列独立勾选，禁止合并成单一 VERIFIED；这是审计纠正后的核心）：
  - **视觉** = 页面按 Figma 节点属性/尺寸/字体/颜色/资源实现。
  - **真实 Core** = 接 Core 命令并改变真实 Core 状态（不是只读缓存 + 记录 GAP）。
  - **VM** = 在 127.0.0.1:5555 设备上用本会话构建产物回归。
- **状态汇总**：`✅` = 三层都实现；`⊘视觉壳` = 仅视觉；`⊘Core阻塞` = 视觉就绪但真实 Core 流阻塞（需 host 能力或 GAP 补齐）；`⊘缺口` = Figma 状态缺失。
- **验证层**：`static` = 源码静态审计；`HAP` = 编译通过；`VM` = 虚拟机点击路由/返回验证；`device` = 真机。

## 1. 覆盖矩阵（21 Final 页面族 + Search）

| 页面族 | Figma 页面/节点 | 视口 | 内容模式 | 核心命令 / Host 能力 | 路由入口与返回 | 视觉 | 真实 Core | VM | 状态 | Gap ID | 原生代码路径 | 验证层 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Bookshelf（populated）** | `23 · Pages · Final` `943:11`(Phone) `943:437`(Tablet) | Phone/Tablet | CORE | `bookshelf.add/list/get`、`reading.progress.get` | 首页；返回=退出 | ✅ | ✅（本地/远程复合身份书架与进度） | ✅(Phone，本地+真实远程源、重启) | ✅（Phone）/⊘(Tablet) | — | `features/bookshelf/BookshelfPage.ets`、`app/ReaderCoreGateway.ts` | HAP+VM(Phone) |
| Bookshelf（ReadingProgress=None） | `3579:11530`/`3579:11575` | Phone/Tablet | CORE | `bookshelf.list`(hasReadingProgress) | 同上 | ✅ | ✅ | ✅(Phone) | ✅（Phone）/⊘(Tablet) | — | `BookshelfPage.ets`（`continueReading === undefined`） | HAP+VM(Phone) |
| Bookshelf（empty） | `07 States` `286:31`（参考） | Phone | CORE | `bookshelf.list` | 导入入口 | ✅（Phone） | ✅ | ✅（Phone） | ✅（Phone） | 缺 Tablet Final Empty 节点（`H-NOTE-1` ✅已关闭：Tablet 复用 Phone 空态，见缺口登记 §7.2） | `BookshelfEmptyPage.ets` | HAP+VM(Phone) |
| **Book Detail（local）** | `23 · Pages · Final` `943:651`(Phone) `943:855`(Tablet) | Phone/Tablet | CORE | `bookshelf.get`、`local_book.toc`、`reading.progress.get` | 书架→详情；返回=书架 | ✅ | ✅ | ✅（Phone） | ✅（Phone）/⊘(Tablet) | NoCover：书架卡基准（96.66×145.44）已对齐 Figma `3612:1796`；62×93/Tablet 缩放实例无 Figma 规则（子元素为 MIN/MIN 非比例缩放）；Hero 无 NoCover 变体（`N-COVER-HERO-01` ✅已关闭：复用卡片 NoCover 缩放 86×122，代码已改待验）；Songti `B-DETAIL-01` 桥接 | `LocalBookDetail.ets` | HAP+VM(Phone,真实书) |
| **ReadingSurface** | `15 · Reader 2` `1023:18355`(Phone) `1023:18371`(TabletExpanded) | Phone/TabletExpanded | CORE | `local_book.chapter.content` / `chapter.content`、`reading.progress.get/update`、`reader.location.resolve` | 详情→阅读；返回=详情 | ✅ | ✅（本地/在线共用分页与 canonical scalar anchor） | ✅(Phone，本地+真实远程源；章内/跨章/重启) | ✅（Phone）/⊘(TabletExpanded) | 翻页动效按 `M-REVIEW-01` 暂停 | `LocalReadingExperience.ets`、`ReadingSurface.ets`、`ReadingPaginationIndex.ts` | HAP+VM(Phone) |
| **Full Directory** | `23 · Pages · Final` `943:11617`(Phone)/`943:11949`(Tablet)（当前无本地目录动态字段映射或 prototype reaction） | Phone/Tablet | CORE | `local_book.toc`、`local_book.chapter.content`、`reader.location.resolve`、`reading.progress.update` | 详情→目录；选章保持现有 Directory 终态→新章首屏真实提交后正文；返回=详情 | ✅（静态终态） | ✅（选章 token 覆盖 load/测量/提交，进度写入串行；EPUB 同文档 fragment 正确切章） | ✅（Phone，当前 HAP + 新导入 EPUB） | ⚠️（本地业务/VM 已闭环；`R-LOCAL-TOC-01` 的 Figma 动态字段/原型仍缺） | `R-LOCAL-TOC-01` | `ReaderFullDirectory.ets` + `FullDirectoryPanel.ets` + `LocalReadingExperience.ets` | HAP+VM(Phone,当前) |
| **Import** | `23 · Pages · Final` + `08 Library&Import` | Phone | CORE | `local_book.import`、`bookshelf.add`（Host picker + rollback） | 书架→导入 | ✅ | ✅ | ✅(Phone) | ✅（Phone） | 格式支持：txt/epub 完整（IndexedText）；mobi/azw 无 DRM PalmDOC 已修复——正确书名/作者/真实文本预览（2026-08-05 Core 修解压变体+DRM误判+EXTH定位）；KF8/AZW3/DRM/HUFF 需外部解码器 | `LocalImportDialog.ets` | HAP+VM(Phone,真实书) |
| **Search / Remote Reading** | `11 · Search` `2635:58749`~`2635:59599` + 既有 Detail/Reading Surface | Phone/Tablet | CORE | `source.import/list`、`book.search`、`book.detail`、`book.toc`、`chapter.content`、`bookshelf.add`、`reading.progress.*`；Host JSON picker、`http.execute` | 书源管理正式导入→书架搜索→结果→远程详情→目录/正文→共用阅读页；返回按既有详情/阅读链 | ✅（既有页面复用） | ✅（A 组真实源；远程书通过 Core upsert 进入共用书架） | ✅（Phone：实时搜索 10 本、详情、1449 章目录、正文、跨章、重启恢复） | ✅（Phone A 组）/⚠️（B/C、Tablet、真机） | B/C Host 能力与设备证据 | `SourceManagementPage.ets`、`SourceGateway.ts`、`RemoteReadingFlowGateway.ts`、`ReaderCoreGateway.ts`、`Index.ets` | static+HAP+VM(Phone,A组) |
| **RSS** | `10 · Reference · RSS`：Shell `2305:530`、SourceFeed `4054:65492`、EntryDetail `4087:2674`、Prototype `4105:3588` | Phone/Tablet | CORE | `rss.subscription.list/items` 只读缓存；刷新/写入未接 | 书架→RSS；订阅源→SourceFeed；条目→EntryDetail；按入口上下文返回 | ✅（Figma 基础链路） | ⚠️（缓存读取与真子路由已接；刷新、管理、已读/收藏、源设置、外链打开仍记录 GAP） | ⊘（无设备目标） | ⚠️（Phone/Tablet Flow Prototype + static/HAP；未验真实交互） | Partial/FatalError、SubscriptionManagement、RuleEdit、Host 写入/外链合同 | `RssPage.ets`、`RssSourceFeedPage.ets`、`RssEntryDetailPage.ets`、`RssGateway.ts` | Figma+static+HAP（无 VM） |
| **Settings General** | `23 · Pages · Final` `943:2897`(Phone) `943:3369`(Tablet) | Phone/Tablet | CORE | `persistence.put`（preferences 设置持久化，`SettingsGateway`）、`source.list` 入口 | 书架底部导航→设置；返回=书架 | ✅ | ✅（4 开关经 `SettingsGateway` 持久化） | ✅(Phone) | ✅（Phone）/⊘(Tablet) | 其余 Select/InlineAction 仍静态 | `SettingsPage.ets`、`SettingsGateway.ts` | HAP+VM(Phone) |
| **Source Management** | `23 · Pages · Final` `943:4281`(Phone) `943:4745`(Tablet) | Phone/Tablet | CORE | `source.import/list/update`；Host JSON picker + 有界 UTF-8 读取 | 设置→书源管理→新增书源；返回=设置 | ✅ | ✅（稳定 `bookSourceUrl` 身份逐项导入；Core 确认后刷新列表；开关不乐观更新） | ✅（Phone：正式 picker 导入；重复导入仍 1 个） | ✅（Phone）/⊘(Tablet) | `SS-SOURCE-TOGGLE-01` 仅剩视觉/Tablet 边界 | `SourceManagementPage.ets`、`SourceGateway.ts`、`SourceOrchestrator.ets`、`ReaderHostRegistry.ts` | static+HAP+VM(Phone,真实JSON) |
| **Sync Backup** | `23 · Pages · Final` `943:4982`(Phone) `943:5462`(Tablet) | Phone/Tablet | CORE | `sync.backup`、`sync.webdav.plan`（均为纯计划命令；执行需 executor + Core 回传） | 设置→同步与备份；返回=设置 | ✅ | ⊘（Host 已有受限 `http.execute`，但 planner 未被执行、响应未解析；不伪装成功） | ⊘（当前构建未回归） | ⊘Core阻塞（缺执行编排/结果页面合同） | 执行编排 + 结果回传/状态 | `SyncPage.ets`、`SyncGateway.ts` | HAP(static) |
| **WebDAV Config** | `23 · Pages · Final` `943:5704`(Phone) `943:6116`(Tablet) | Phone/Tablet | CORE | `sync.webdav.*`（需 http） | 同步→WebDAV | ⊘ | ⊘ | ⊘ | ⊘缺口 | 需 http host（Figma Final 节点已存在 943:5704/942:42-44，非缺画稿） | — | — |
| **Discover** | `23 · Pages · Final` `943:1312`(Phone) `943:1684`(Tablet) + `09 · Reference · Discover` | Phone/Tablet | CORE | `source.exploreKinds`、`source.explore` | 书架底部导航→发现 | ⊘ | ⊘ | ⊘ | 占位-only（缺口登记 §7.1） | `D-DISCOVER-STATES-01`（占位-only） | — | — |
| **Source Switch** | `23 · Pages · Final` `943:15215`(Phone) `943:15705`(Tablet) | Phone/Tablet | CORE | `change.bookSource`、`book.detail`、`book.toc`、`source.switch.commit`、`source.switch.rollback` | 完整目录顶栏「换源」→overlay；本地书置灰不可点；返回=✕/遮罩点击/系统返回 | ⊘（Figma 缺换源按钮 Disabled 变体 + overlay 结果态画稿 + 延迟/当前章节数据契约） | ⚠️（Gateway/事务和在线阅读入口已接；真实候选/提交依赖已导入远程书源与 VM 网络） | ✅（Phone：仅本地置灰与历史 dev-seed 视觉，不代证真实候选） | ⚠️（真实远程换源旅程未验收） | `SS-SOURCE-SWITCH-01` + 真实源 VM 证据 | `SourceSwitchPanel.ets`、`SourceSwitchGateway.ts`、`ReaderFullDirectory.ets`、`Index.ets` | static+HAP+VM(Phone,local-only) |
| **Reader Control Home** | `23 · Pages · Final` `943:6848`(Phone) `943:8028`(Tablet) | Phone/Tablet | CORE | reader control 静态终态 | 阅读→控制 | ⊘ | ⊘ | ⊘ | ⊘缺口 | `RC-READER-CONTROL-01` | — | — |
| **Reader Quick/Module/Full** | `23 · Pages · Final` `943:8625`~`943:15055` | Phone/Tablet | CORE/静态终态 | 目录/TTS/排版/设置/替换/搜索 | 阅读→Quick/Module/Full | ⊘ | ⊘ | ⊘ | ⊘缺口 | `RC-READER-CONTROL-01`、`PT-*` | — | — |

## 2. 已交付（按三层标记，见 §1）

**三层都 ✅（真实业务闭环）**：
1. **Bookshelf → 本地 Book Detail → TOC → 真实章节正文 → ReadingSurface**：`local_book.import`（真实 EPUB/TXT）、`bookshelf.get`、`local_book.toc`、`local_book.chapter.content`、`reading.progress.get/update`、`reader.location.resolve`。重启恢复同一位置。
2. **Bookshelf ReadingProgress=None**：`continueReading === undefined` 时整块不渲染，书架自然上移（Figma 已补 `3579:11530`/`3579:11575`）。
3. **空书架**（Phone 参考；Tablet 复用 Phone 350.903 宽内容、靠左对齐）：空 Core 书架显示空态与导入入口（`H-NOTE-1`，Tablet 无 Figma 终态）。
4. **Book Detail（local）**：真实 `bookshelf.get` + `local_book.toc`；无封面书按 `N-COVER-REMAP-01` 放行（Figma `3612:1796` NoCover）。
5. **Full Directory 选章**：`FullDirectoryPanel.chapterRow.onClick` → `ReaderFullDirectory.onSelectChapter` → `Index.onDirectoryChapterSelected` → `LocalReadingExperience.onRequestedChapterChanged`（@Watch）→ `openChapter`。当前代码以 selection token 隔离旧 load/测量/提交，并把同书进度写入串行化；当前 HAP 在 VM 新导入 Gutenberg EPUB `18174` 后，选择 `I. THE WOODLANDS IN JANUARY` 的正文从该 fragment 的 `Humanity has always…` 开始，退出后恢复同章位置。`R-LOCAL-TOC-01` 仍存：Phone/Tablet 实例无 prototype reaction，章节行固定样例，无本地目录字段→正文映射。
6. **Settings General**：`SettingsGateway` 经 `@ohos.data.preferences` 持久化 4 开关；`Index` 读写 `settingsSnapshot`。

**已接 Core、但仍有分层边界的页面**：
7. **Search / Remote Reading**：五态视觉完整；2026-08-10 Phone VM 通过正式 JSON picker 导入 A 组真实源，关键词 `魔女` 实时返回 10 本，《诡秘：善魔女》详情、1449 章目录和真实正文进入共用阅读会话。章内 A→B→A、跨章第 3 章章首→第 2 章末页→第 3 章章首、进程重启恢复均通过。搜索选书复用 Core `bookshelf.add` upsert，远程书卡与继续阅读卡重启后仍存在。B/C、Tablet、真机与三端 parity 未验。
8. **RSS**：2026-08-09 范围更新为只读缓存页与真子路由：`subscription.list/items` 可展示，SourceFeed/EntryDetail 可导航；F3 提供 `RSS · Phone` / `RSS · Tablet` 两个 Flow Starting Point，覆盖 Main→SourceFeed/EntryDetail→返回及 inline filter，10 个独立紧凑控件有 44vp 响应区并通过 HAP 编译。"刷新"、管理、写动作和外链宿主仍不接，只记录 `FIGMA_VISUAL_GAP`。
9. **Source Management**：真实 `source.import/list/update` 已接。新增按钮只通过 Host 有界读取 JSON，原始 `bookSourceUrl` 作为稳定 `sourceId`，raw BookSource 交给 Rust Core；导入和开关都只在 Core 确认后重载列表。2026-08-10 Phone VM 正式 picker 导入成功，重复导入同一文件后仍为 `1 个书源 · 1 个启用`。
10. **Sync Backup**：`SyncGateway` 参数已按 Core 合约修正；`sync.backup`/`webdav.plan` 均为纯计划命令，`triggerBackup` 不插入 0 字节假历史。`连接测试` 结果**仅写 hilog，页面无可见成功/失败状态**；WebDAV 配置未持久化。**当前不可用**，须先接 Host HTTP 执行与结果回传。

## 3. 阻塞项（Figma 缺口 / 需 host 能力）

- **Discover**（占位-only，见缺口登记 §7.1）：`D-DISCOVER-STATES-01` 并入占位，不推进。
- **Reader Control Home/Quick/Module/Full** `RC-READER-CONTROL-01`：控制层触发/返回契约已定（点击沉浸阅读页中间竖栏唤起，见缺口登记 §7.2）；面板装配、Quick↔Module↔Full 切换契约未定义；TTS/AutoPage/翻页受 `PT-*`、`M-REVIEW-01` 动效暂停。
- **Source Switch** `SS-SOURCE-SWITCH-01`：换源 Gateway/事务、在线阅读入口和正式书源导入代码已接；真实切换验收待 VM 导入远程书源、产生远程书架条目并跑网络旅程。
- **WebDAV**：Host 已注册 API-23 `http.execute` 子集（含 `customMethod`/`maxRedirects`），但 Sync planner 仍缺执行编排、响应解析与 Figma 结果态；Figma Final 节点已存在。
- **Search 复杂源与设备边界**：A 组真实源 Phone VM 成功旅程已通过；B/C 组 charset、Cookie/session、redirect/finalUrl、WebView/challenge，以及 Tablet/真机/三端 parity 仍缺证据。
- **响应式**：Tablet/TabletExpanded 布局未做运行验收（`R-COMPACT-01` 折叠屏降级已 out-of-scope，见缺口登记 §7.2）。

## 4. 实施顺序

1. **批次 A（已实现，分层验收）**：Bookshelf、Book Detail、ReadingSurface、Import、Full Directory、空书架；Full Directory 已在当前 HAP + 新导入 EPUB VM 回归。
2. **批次 B（分层）**：Search 五态已接真实多书源调用（成功结果待设备网络验收）；RSS 已接只读缓存查询与 SourceFeed/EntryDetail 真子路由，刷新/写入仍阻塞。
3. **批次 C（✅ 真实闭环或壳）**：Settings 持久化、Source Management、Sync 网关。
4. **批次 D（部分闭合）**：正式书源导入和 A 组远程阅读 Phone VM 已闭合；当前剩余 Source Switch 真实远程验收、B/C Host 能力、WebDAV 执行编排，以及 RSS 错误态/管理/规则/写入/外链宿主——分别待设备证据、业务接线或 Figma 合同。（Discover 仍为占位-only；RSS 的只读范围已于 2026-08-09 解冻。）

## 5. 每次改动的防越界检查

每项实施开始前记录：本次 Figma 节点、目标页面/状态、所用 Core 命令、所需 Host capability、本次不触碰的暂停项。出现以下任一情况即停止该局部：

- Figma 没有可见元素、状态、素材、响应式规则或动效轨迹；
- 需要从 Phone 推断 Tablet，或从 next 推断 previous/拖动/取消/提交；
- 需要把 Review 时间线、演示像素或示例内容提升为生产规则；
- 需要新建通用页面引擎、设计系统、跨端抽象或第二套路由壳。

## 6. 审计纠正记录（2026-08-05）

独立审计（只读源码/Figma/构建/VM 原生树，不用截图）指出此前把"静态页存在"写成 `VERIFIED` 是过度声明。已全量纠正：

1. **三层标记**（§1）：视觉 / 真实 Core / VM 三列独立勾选，不再混写。
2. **Tablet 空书架与导入（`H-NOTE-1`）**：`Index` 不再按 `!isTablet` 跳过空书架；`BookshelfEmptyPage` 复用 Phone 参考布局（固定 350.903 宽、靠左对齐，**未居中**——非推断）；导入弹窗不再被排除。
3. **无封面重映射（`N-COVER-REMAP-01`）**：`applyBookshelfState` 删除 `hasDeclaredCoverUrl` 全体拒绝；无封面书软警告并放行。
4. **Full Directory 选章（`R-LOCAL-TOC-01`）**：章节行 → `onSelectChapter` → 该章正文路由。
5. **Settings 持久化**：`SettingsGateway`（`@ohos.data.preferences`）+ `Index` 读写。
6. **Sync 网关**：`SyncGateway` 参数按 Core 合约（baseUrl+PROPFIND / package+policy）；`sync.backup`/`webdav.plan` 为纯计划命令，不伪装成功。
7. **ReaderRuntimeOwner.close()**：close 后清空静态单例，避免重建 Ability 复用 closed runtime。

## 6.1 第二轮审计纠正（2026-08-05，复核"纠正已完成"声明）

第二轮独立审计复核后再次指出过度声明，已修复：

1. **NoCover 视觉重映射（防崩溃已修，视觉部分闭合）**：书架 `bookCard`/`continueReadingCard` 用 Figma `3612:1796` NoCover（奶油 `#F5ECE6` + 两条横线 + "暂无封面"），不再 `Image(undefined as string)` 也不再绿色渐变。**BookDetail Hero 无 NoCover 变体（`N-COVER-HERO-01`），不补画**，空封面槽只显示文字列。（2026-08-05 用户决策改为复用书架卡 NoCover 缩放至 86×122，见 §6.3）
2. **Full Directory 选章**：`requestedChapterIndex` @Watch → `openChapter`；selection token 现覆盖 load、隐藏测量、首屏 resolve/update 的成功与错误路径，同书进度写入串行化。**代码级并发修复待真实书 VM 回归，Figma 视觉合同仍未闭合（`R-LOCAL-TOC-01`）**。
3. **Sync 参数修正**：`sync.webdav.plan` → `{baseUrl, requests:[PROPFIND]}`；`sync.backup` → `{package, policy}`。**但两者均为纯计划命令，不执行网络**；`triggerBackup` 不再插入 0 字节"备份成功"假历史，连接测试结果仅写 hilog、页面没有可见结果状态。**Sync 当前不可用**，须补 planner 执行编排、Core 响应回传与结果页面合同。
4. **Source 开关诚实化（`SS-SOURCE-TOGGLE-01`）**：Core 现提供 `source.update {sourceId, enabled}`（幂等、只改 `bookSource.enabled`、保留规则/未知字段；V1-only 源 fail closed）。`SourceGateway.updateSource` 发真实 RPC；`onSourceToggled` 不乐观切换——成功（含快照持久化确认）后重载列表，失败保持行原状并记录日志。（2026-08-05）
5. **Tablet 空书架**：撤销 720px 推断，Tablet 复用 Phone 350 参考布局；导入弹窗不再被排除。**入口可用、视觉缺口未关闭**（Figma 无 Tablet Empty）。
6. **`close()` 异常路径**：flush 抛错时 `finally` 仍清理单例。
7. **VM 列诚实化**：Phone-only VM → `VM(Phone)`；Tablet 未运行验收。

## 6.2 第三轮审计收敛（2026-08-05）

复核后正确状态收敛为（不再声称"修复完成"）：

- `close()`：✅ 已修。
- NoCover：**防崩溃已修、视觉未闭合**（书架已按 Figma NoCover；Detail Hero 无变体）。
- 目录：**选章代码路径存在；当前 selection token + 串行进度写入为代码级修复，尚无当前构建设备回归；Figma 视觉合同未闭合**。
- Tablet：**入口可用、视觉缺口未关闭**。
- Sync：**不可用，必须先接 Host HTTP 执行与结果回传**。
- Source Toggle：**不可持久化，不应伪装成功**（已不乐观切换）。

## 6.3 用户范围决策（2026-08-05）

用户拍板范围决定（详见缺口登记 §7）：

- **Discover / RSS 原占位-only 决策**：这是 2026-08-05 的历史范围。Discover 仍保持占位；RSS 于 2026-08-09 解冻 `subscription.list/items` 只读缓存展示、SourceFeed/EntryDetail 真子路由和对应基础 Prototype；刷新、管理、规则编辑、已读/收藏与外链宿主仍不在已交付范围。
- **`N-COVER-HERO-01` 已关闭**：Hero 无封面复用书架卡 NoCover 缩放至 86×122（`LocalBookDetail.ets` 已改，待编译/VM 验证）。
- **`H-NOTE-1` 已关闭**：Tablet 空书架复用 Phone 空态组件。
- **`B-BOOKSHELF-LIST-02` 已关闭**：Tablet List 与 Phone 样式一致。
- **`S-SEARCH-EMPTY-HISTORY-01` 已关闭**：空历史整体隐藏最近搜索区。
- **`R-COMPACT-01` 已关闭**：折叠屏降级，暂不做（out-of-scope）。
- **`S-SEARCH-RESULT-COVER-01` 已关闭**：无封面结果卡用单一占位色。
- **`RC-READER-CONTROL-01` 触发/返回已定**：控制层点击沉浸阅读页中间竖栏唤起；返回按钮/系统返回/点击正文退出（面板装配/切换契约仍开放）。
- **Search/Sync/WebDAV 为真实功能**（非占位）：Search 的查询命令已接通；Sync/WebDAV 仍缺 planner 执行编排、响应回传与结果页面状态。

## 8. 2026-08-06 静态页像素级重建记录

用户审计发现静态壳页面与 live Figma 大面积不匹配（此前"视觉✅"仅代表页面存在，未逐像素对照）。本轮对除已确认忠实的 Bookshelf populated / ReadingSurface 之外的全部交付页面做了像素级重建（Phone+Tablet），逐页 `get_design_context` 对照，VM 用原生布局树+文字度量验收（符合 §4 阶段 E，不用截图作结论）。

| 页面 | 重建前 | 重建后 | VM 验收 |
|---|---|---|---|
| Settings General | MAJOR 漂移（无分节卡片/行高48/控件简化/绿图标底色/文案错） | 分节卡片、行58、switch 44×24、Segmented 3段、Select 字段+chevron、InlineAction、StatusBadge、蓝图标底色、文案对齐 | ✅ |
| Source Management | MAJOR（行高48/搜索框/3chip/缺分组/缺徽标/底栏错） | 行70、搜索框 h38 r8、5 chip、GroupFilter、StatusBadge、44×24 switch、批量管理/新增书源 | ✅ |
| Sync Backup | MAJOR（WebDAV 单按钮/输入框/文案/历史卡） | WebDAV 双按钮+连接信息+4行、Auto/History 卡、85h 历史卡+徽标+展开 | ✅ |
| RSS | MAJOR（标题/无 pill/搜索框/缺筛选/状态态错） | Songti 29 标题、刷新/管理/导入 pill、筛选栏、卡片+分隔线、状态态 back-bar | ✅ |
| Search | MODERATE（透明度/缺 border/缩进/N条更多） | 字段透明度、3 处 border-b、最近搜索缩进、N 条更多、按钮态色、loading 13px 文案 | ✅ |
| Book Detail | MODERATE（缺 Hero 书源行/ActionBar 渐隐） | 补 书源：优书网 + 更换书源 pill + ActionBar 渐隐 | ✅ |
| Bookshelf Empty | 重漂移（字体/颜色/文案/结构） | Noto Sans SC、绿图标底色(286:35)、文案、双按钮、352×350 r12 | ✅ |
| Import Dialog | 未对照 | 标题改真实文字、drop zone、选择文件 211 宽、结果行 61、完成按钮 | ✅ |
| Full Directory | ~95% 已对齐 | 顶栏/面板/grip/tab 字重/章行字重微调（静态容器） | ✅ |
| Source Switch | 未对照 | Window 静态对齐（sortPill/列头/延迟条/行分隔）；结果态保留代码定义 | ⊘ 需远程书 |

**仍存偏差（诚实记录，非伪装）：**
- Sync「保存配置」：无 host 侧 WebDAV 配置持久化回调，已改**惰性按钮**（不触发备份，注释说明）。**发现并修复**了初版把保存配置接到 onTriggerBackup 的行为违规。
- Sync 备份频率显示真实 snapshot 值「12小时」（Figma 示例「12h」由 SyncGateway 默认值持有，不改 gateway）；历史 scope 行无 `SyncHistoryEntry.scope` 字段，以真实 ok 状态替代。
- Settings 已按 Figma `301:2` 重建入口页：设置标题(无返回)+5 行菜单(通用设置/书架与搜索设置/书源管理/同步与备份/关于与反馈)+公共底栏(设置选中)；通用设置(943:2897)为子页(返回栏+四节)。书架与搜索设置/关于与反馈 无目标页，行保持惰性。`S-SETTINGS-NAV-01` 闭合。
- Source Mgmt 统计省略「N 个异常 · 检测时间」（BookSource 无字段）；Book Detail 更换书源 pill 无回调保持惰性；Search「N 条更多」chip 无回调。
- Bookshelf Empty 图标底色为绿色 rgba(45,74,62,0.09)（实时 Figma 节点 286:35，非蓝）。
- Full Directory 章节行仍绑定真实 TOC 数据（R-LOCAL-TOC-01 动态字段契约仍开放）；Source Switch 结果态 Figma 未画全，保留代码定义。
- 字体：Songti SC 不可再分发，统一 ReaderNotoSerifSCBold 桥（既有 B-DETAIL-01 约定）；Inter 字重用数值（Black 900/ExtraBold 800）。

**执行合规：** 每个页面组件独立 agent 重建，仅改分配文件；props/callback 接口全部保留（Index.ets 调用点未变）；无新共享组件/设计系统（§5 防越界）；无新 SVG 资源（全部复用现有 media）；每批 hvigor 编译通过。

## 9. 2026-08-06 四个主页面按重绘版重建

用户指出四个主页面（书架/发现/RSS/设置）需按 Figma 重绘版（`19 · Reference · Phone` 等 Reference 区）实现，而非旧 `23 · Pages · Final` 节点。已用 use_figma 全量遍历找到各节点并重建：

| 主页面 | 重绘版节点 | 现状 |
|---|---|---|
| 书架 | `287:9` Reference/Phone/bookshelf | 已对齐：书架 Songti 29 + 搜索/更多、继续阅读卡、我的书架+5操作按钮、3列封面网格、底栏书架选中 |
| 发现 | `376:2` Reference/Discover/Phone | **新建 DiscoverPage**：发现+刷新、书源卡、6分类chips(排行榜选中)、筛选/应用、排行榜header、结果列表、底栏发现选中。数据态（source.explore）未接，书源卡/列表为空态占位（诚实） |
| RSS | `378:2` Reference/RSS/Phone | 已对齐：RSS+刷新/管理pill、搜索栏、状态tab、订阅源+导入/新建、筛选、最近未读+查看全部、底栏RSS选中；新增 onSettingsRequested/onDiscoverRequested 接线 |
| 设置 | `301:2` Reference/Phone/settings | ✅（此前已完成） |

四页均为顶栏 Songti 29 无返回 + 公共底栏（当前项选中）。Index 新增 `discover` 路由 + `openDiscover()`；书架/空书架/设置/RSS 底栏「发现」均接 onDiscoverRequested。

**公共底栏组件化（同日）：** 用户指出 tab 栏写死四个按钮。已抽共享 `features/shell/MainTabBar.ets`：tab 列表来自单一 `MAIN_TABS` 配置数组，`layoutWeight(1)` 按数量自适应平分宽度，选中态由 `current` prop 驱动，点击非当前 tab 回调 `onSelect(key)` 由宿主页映射。五个主页面（书架/空书架/发现/RSS/设置）统一复用，删除了各自的 bottomNav/navItem/phoneNavigationItem/navigation 重复代码。增删 tab 只改 MAIN_TABS 一处。

**设置页修复（同日）：** ① Scroll 短内容被垂直居中导致卡片下沉 → 各主页面 Scroll 加 `.align(Alignment.Top)`；② 设置页行图标原为同一 `bookshelf_settings` 齿轮，已从 Figma 下载 18 个 Tabler 图标 SVG 入 media（`settings_row_*` 5 个入口页 + `settings_gen_*` 13 个基础设置页），每行传各自 icon；③ 下拉修复：App主题 由分段控件改为**下拉选择框**显示「跟随系统」（重绘版 299:2），四个下拉（App主题/语言/启动时打开/动画效果）改为自定义下拉（点开选项、选中回显），值符合 Figma（跟随系统/简体中文/书架/标准）。

## 7. 已知限制（审计披露）

- **产品范围**：PDF 阅读/OCR/renderer 明确 out-of-scope，不列入本地导入或阅读缺口；在线阅读与 RSS 仍是核心能力。

- **构建产物**：unsigned HAP（无 signingConfig）；回归以 VM 最新安装为准。
- **NAPI 库**：本轮 Core 重编译后，`entry/libs` 与 Core target 同为 `b72f6c9821fb6ae02c400613366aaa353b64b4c8aac3da693a2e6e5f63ff4bf1`；HAP 内唯一经 Strip 的库为 `069f94b1cb9d7c4a7e52310f206c9ab09794dd5d8726d9a94fec5a80a6df1f68`（与本次 build intermediate 一致）。
- **Git 可追溯性**：`Reader-for-HarmonyOS` 已纳入 git（分支 `feat/reader-module-directory-a2`，含源码/资源/文档/NAPI 库）；Reader-UI 与 Reader-Core-Native 有各自未提交/已提交改动。可回溯性以各仓库 git 为准。
- **VM 时间线**：已安装本轮 HAP、清空旧测试应用数据并新导入 Gutenberg EPUB `18174`。文本原生树证明 Bookshelf → Detail → Full Directory → `I. THE WOODLANDS IN JANUARY` → 正确 fragment 正文；系统返回后继续阅读恢复同章。Search 验到真实 Error，RSS 验到占位刷新不变。Tablet 未验。
- **字体**：BookDetail 标题 Figma 指定 Songti SC，当前以 Noto Serif SC 临时桥接（`B-DETAIL-01`）。
- **VM 为 Phone 形态**：Tablet/TabletExpanded 布局未做运行验收。
- **阅读核心边界（非 Figma 缺口）**：
  1. Directory 选章不再暴露空 PaperLayer：Index 保持既有 Directory 终态直至新章首屏提交；Host 异步调用本身仍无跨 Host 的取消/CAS 合约。
  2. `lineCount === 0` 会等待测量 deadline；已取得 metrics 后的 Unicode 索引异常会 fail-closed。两条路径缺独立 ArkTS/ohosTest 回归，不应写成已证实无限空白故障。
  3. 普通 `A\\n\\n`/CRLF EOF 恢复会被可渲染段落 clamp；仍缺专项回归。全章 Unicode 边界/段落范围在首屏前同步建表，超大章节与超长单段落仍是性能/容量边界。
