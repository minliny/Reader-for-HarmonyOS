# Figma Final 静态出版覆盖矩阵

记录日期：2026-08-05（审计纠正后）
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
| **Bookshelf（populated）** | `23 · Pages · Final` `943:11`(Phone) `943:437`(Tablet) | Phone/Tablet | CORE | `bookshelf.list`、`bookshelf.get`、`reading.progress.get` | 首页；返回=退出 | ✅ | ✅（真实书架与进度） | ✅(Phone) | ✅（Phone）/⊘(Tablet) | — | `features/bookshelf/BookshelfPage.ets` | HAP+VM(Phone) |
| Bookshelf（ReadingProgress=None） | `3579:11530`/`3579:11575` | Phone/Tablet | CORE | `bookshelf.list`(hasReadingProgress) | 同上 | ✅ | ✅ | ✅(Phone) | ✅（Phone）/⊘(Tablet) | — | `BookshelfPage.ets`（`continueReading === undefined`） | HAP+VM(Phone) |
| Bookshelf（empty） | `07 States` `286:31`（参考） | Phone | CORE | `bookshelf.list` | 导入入口 | ✅（Phone） | ✅ | ✅（Phone） | ✅（Phone） | 缺 Tablet Final Empty 节点（`H-NOTE-1` ✅已关闭：Tablet 复用 Phone 空态，见缺口登记 §7.2） | `BookshelfEmptyPage.ets` | HAP+VM(Phone) |
| **Book Detail（local）** | `23 · Pages · Final` `943:651`(Phone) `943:855`(Tablet) | Phone/Tablet | CORE | `bookshelf.get`、`local_book.toc`、`reading.progress.get` | 书架→详情；返回=书架 | ✅ | ✅ | ✅（Phone） | ✅（Phone）/⊘(Tablet) | NoCover：书架卡基准（96.66×145.44）已对齐 Figma `3612:1796`；62×93/Tablet 缩放实例无 Figma 规则（子元素为 MIN/MIN 非比例缩放）；Hero 无 NoCover 变体（`N-COVER-HERO-01` ✅已关闭：复用卡片 NoCover 缩放 86×122，代码已改待验）；Songti `B-DETAIL-01` 桥接 | `LocalBookDetail.ets` | HAP+VM(Phone,真实书) |
| **ReadingSurface** | `15 · Reader 2` `1023:18355`(Phone) `1023:18371`(TabletExpanded) | Phone/TabletExpanded | CORE | `local_book.chapter.content`、`reading.progress.get/update`、`reader.location.resolve` | 详情→阅读；返回=详情 | ✅ | ✅ | ✅(Phone) | ✅（Phone）/⊘(TabletExpanded) | 翻页动效按 `M-REVIEW-01` 暂停 | `LocalReadingExperience.ets`、`ReadingSurface.ets` | HAP+VM(Phone) |
| **Full Directory** | `23 · Pages · Final` `943:11617`(Phone)/`943:11949`(Tablet)（当前无本地目录动态字段映射或 prototype reaction） | Phone/Tablet | CORE | `local_book.toc`、`local_book.chapter.content`、`reader.location.resolve`、`reading.progress.update` | 详情→目录；选章保持现有 Directory 终态→新章首屏真实提交后正文；返回=详情 | ✅（静态终态） | ✅（选章 token 覆盖 load/测量/提交，进度写入串行；EPUB 同文档 fragment 正确切章） | ✅（Phone，当前 HAP + 新导入 EPUB） | ⚠️（本地业务/VM 已闭环；`R-LOCAL-TOC-01` 的 Figma 动态字段/原型仍缺） | `R-LOCAL-TOC-01` | `ReaderFullDirectory.ets` + `FullDirectoryPanel.ets` + `LocalReadingExperience.ets` | HAP+VM(Phone,当前) |
| **Import** | `23 · Pages · Final` + `08 Library&Import` | Phone | CORE | `local_book.import`、`bookshelf.add`（Host picker + rollback） | 书架→导入 | ✅ | ✅ | ✅(Phone) | ✅（Phone） | 格式支持：txt/epub 完整（IndexedText）；mobi/azw 无 DRM PalmDOC 已修复——正确书名/作者/真实文本预览（2026-08-05 Core 修解压变体+DRM误判+EXTH定位）；KF8/AZW3/DRM/HUFF 需外部解码器 | `LocalImportDialog.ets` | HAP+VM(Phone,真实书) |
| **Search** | `11 · Search` `2635:58749`~`2635:59599` | Phone/Tablet | CORE | `search.history.*`、`source.list`、`book.search`；`http.execute` | 书架搜索→搜索页；返回=书架 | ✅ | ⚠️（所有 enabled 书源顺序真实查询、失败不伪装为全量结果） | ✅（Phone，真实错误态） | ⚠️（远程成功结果与远程 Detail 尚未设备验收） | 远程 Detail 未有 admitted route | `SearchPage.ets`、`SearchGateway.ts` | HAP+VM(Phone,error) |
| **RSS** | `10 · Reference · RSS` `F2 · Canonical · RSS` `2305:267`/`2305:529` + CanonicalState `2305:738`/`2305:789`/`2305:849` | Phone/Tablet | CORE | 无刷新命令（占位-only） | 书架底部导航→RSS；返回=书架 | ✅ | ⊘（按缺口登记 §7.1 冻结；刷新只记录 GAP、不触发 `rss.subscription.refresh`） | ✅（Phone，当前 HAP） | 占位-only（缺口登记 §7.1） | 占位-only | `RssPage.ets`、`RssGateway.ts` | HAP+VM(Phone,placeholder) |
| **Settings General** | `23 · Pages · Final` `943:2897`(Phone) `943:3369`(Tablet) | Phone/Tablet | CORE | `persistence.put`（preferences 设置持久化，`SettingsGateway`）、`source.list` 入口 | 书架底部导航→设置；返回=书架 | ✅ | ✅（4 开关经 `SettingsGateway` 持久化） | ✅(Phone) | ✅（Phone）/⊘(Tablet) | 其余 Select/InlineAction 仍静态 | `SettingsPage.ets`、`SettingsGateway.ts` | HAP+VM(Phone) |
| **Source Management** | `23 · Pages · Final` `943:4281`(Phone) `943:4745`(Tablet) | Phone/Tablet | CORE | `source.list` | 设置→书源管理；返回=设置 | ✅ | ✅（`source.update` RPC 真实持久化，不乐观切换；`book.search`/`source.explore` 拒绝 disabled，检测/调试不受影响） | ✅（Phone） | ✅ | `SS-SOURCE-TOGGLE-01` | `SourceManagementPage.ets`、`SourceGateway.ts` | HAP+VM(Phone 壳) |
| **Sync Backup** | `23 · Pages · Final` `943:4982`(Phone) `943:5462`(Tablet) | Phone/Tablet | CORE | `sync.backup`、`sync.webdav.plan`（均为纯计划命令；执行需 executor + Core 回传） | 设置→同步与备份；返回=设置 | ✅ | ⊘（Host 已有受限 `http.execute`，但 planner 未被执行、响应未解析；不伪装成功） | ⊘（当前构建未回归） | ⊘Core阻塞（缺执行编排/结果页面合同） | 执行编排 + 结果回传/状态 | `SyncPage.ets`、`SyncGateway.ts` | HAP(static) |
| **WebDAV Config** | `23 · Pages · Final` `943:5704`(Phone) `943:6116`(Tablet) | Phone/Tablet | CORE | `sync.webdav.*`（需 http） | 同步→WebDAV | ⊘ | ⊘ | ⊘ | ⊘缺口 | 需 http host（Figma Final 节点已存在 943:5704/942:42-44，非缺画稿） | — | — |
| **Discover** | `23 · Pages · Final` `943:1312`(Phone) `943:1684`(Tablet) + `09 · Reference · Discover` | Phone/Tablet | CORE | `source.exploreKinds`、`source.explore` | 书架底部导航→发现 | ⊘ | ⊘ | ⊘ | 占位-only（缺口登记 §7.1） | `D-DISCOVER-STATES-01`（占位-only） | — | — |
| **Source Switch** | `23 · Pages · Final` `943:15215`(Phone) `943:15705`(Tablet) | Phone/Tablet | CORE | `change.bookSource`、`book.toc`、`source.switch.commit`、`source.switch.rollback` | 完整目录顶栏「换源」→overlay；本地书置灰不可点；返回=✕/遮罩点击/系统返回 | ⊘（Figma 缺换源按钮 Disabled 变体 + overlay 结果态画稿 + 延迟/当前章节数据契约） | ⚠️（gateway 已按契约接通 4 命令；`change.bookSource`/`book.toc` 依赖 http（host 已注册），`source.switch.commit` 需远程 from 书架条目——真实链路待在线书路径） | ✅（Phone：置灰按钮 + dev-seed overlay 五候选行/结果态） | ⚠️（代码已定义触发/返回/结果态 + 本地置灰；真实切换链路未交付） | `SS-SOURCE-SWITCH-01` | `SourceSwitchPanel.ets`、`SourceSwitchGateway.ts`、`ReaderFullDirectory.ets`、`Index.ets` | HAP+VM(Phone) |
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

**视觉壳（视觉 ✅，真实 Core ⊘，VM ✅）**：
7. **Search**：五态视觉完整；`source.list` 与所有启用书源的真实 `book.search` 顺序执行，历史写入失败不阻断搜索，任一书源失败收敛到既有 Error（不伪装为“全部”结果）。当前 VM 已验真实错误态，未验远程成功结果。
8. **RSS**：按用户范围决定保持占位-only；"刷新"不接 `rss.subscription.refresh`，只记录 `FIGMA_VISUAL_GAP`。
9. **Source Management**：真实 `source.list` 展示 + 真实 `source.update` RPC 开关（`SourceGateway.updateSource`，不乐观切换，成功后才重载列表）。
10. **Sync Backup**：`SyncGateway` 参数已按 Core 合约修正；`sync.backup`/`webdav.plan` 均为纯计划命令，`triggerBackup` 不插入 0 字节假历史。`连接测试` 结果**仅写 hilog，页面无可见成功/失败状态**；WebDAV 配置未持久化。**当前不可用**，须先接 Host HTTP 执行与结果回传。

## 3. 阻塞项（Figma 缺口 / 需 host 能力）

- **Discover**（占位-only，见缺口登记 §7.1）：`D-DISCOVER-STATES-01` 并入占位，不推进。
- **Reader Control Home/Quick/Module/Full** `RC-READER-CONTROL-01`：控制层触发/返回契约已定（点击沉浸阅读页中间竖栏唤起，见缺口登记 §7.2）；面板装配、Quick↔Module↔Full 切换契约未定义；TTS/AutoPage/翻页受 `PT-*`、`M-REVIEW-01` 动效暂停。
- **Source Switch** `SS-SOURCE-SWITCH-01`：换源代码已交付（本地置灰 + overlay 全结果态，2026-08-05）；真实切换链路待远程书架条目 + 在线阅读路径（`change.bookSource`/`book.toc` 已走真实 http，host 已注册）。
- **WebDAV**：Host 已注册 API-23 `http.execute` 子集（含 `customMethod`/`maxRedirects`），但 Sync planner 仍缺执行编排、响应解析与 Figma 结果态；Figma Final 节点已存在。
- **Search 远程详情**：搜索命令已接通；远程 Book Detail/章节路由尚无 admitted Figma 流。
- **响应式**：Tablet/TabletExpanded 布局未做运行验收（`R-COMPACT-01` 折叠屏降级已 out-of-scope，见缺口登记 §7.2）。

## 4. 实施顺序

1. **批次 A（已实现，分层验收）**：Bookshelf、Book Detail、ReadingSurface、Import、Full Directory、空书架；Full Directory 已在当前 HAP + 新导入 EPUB VM 回归。
2. **批次 B（分层）**：Search 五态已接真实多书源调用（成功结果待设备网络验收）；RSS 保持占位-only。
3. **批次 C（✅ 真实闭环或壳）**：Settings 持久化、Source Management、Sync 网关。
4. **批次 D（阻塞）**：Reader Control、Source Switch（代码已交付，真实切换链路待在线书路径）、WebDAV 执行编排、远程 Search Detail——待补齐 Figma 契约或业务链路。（Discover/RSS 已按缺口登记 §7.1 占位-only 撤出。）

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

- **Discover / RSS 占位-only**：设计初期已定「暂时不做，仅保留占位」，不推进真实实现；本矩阵中两页的 `⊘Core阻塞（http）` / `⊘缺口` 记录修正为 out-of-scope 占位。
- **`N-COVER-HERO-01` 已关闭**：Hero 无封面复用书架卡 NoCover 缩放至 86×122（`LocalBookDetail.ets` 已改，待编译/VM 验证）。
- **`H-NOTE-1` 已关闭**：Tablet 空书架复用 Phone 空态组件。
- **`B-BOOKSHELF-LIST-02` 已关闭**：Tablet List 与 Phone 样式一致。
- **`S-SEARCH-EMPTY-HISTORY-01` 已关闭**：空历史整体隐藏最近搜索区。
- **`R-COMPACT-01` 已关闭**：折叠屏降级，暂不做（out-of-scope）。
- **`S-SEARCH-RESULT-COVER-01` 已关闭**：无封面结果卡用单一占位色。
- **`RC-READER-CONTROL-01` 触发/返回已定**：控制层点击沉浸阅读页中间竖栏唤起；返回按钮/系统返回/点击正文退出（面板装配/切换契约仍开放）。
- **Search/Sync/WebDAV 为真实功能**（非占位）：Search 的查询命令已接通；Sync/WebDAV 仍缺 planner 执行编排、响应回传与结果页面状态。

## 7. 已知限制（审计披露）

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
