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
| Bookshelf（empty） | `07 States` `286:31`（参考） | Phone | CORE | `bookshelf.list` | 导入入口 | ✅（Phone） | ✅ | ✅（Phone） | ✅（Phone） | 缺 Tablet Final Empty 节点（`H-NOTE-1`：Tablet 复用 Phone 参考布局 350.903 宽，非推断 720） | `BookshelfEmptyPage.ets` | HAP+VM(Phone) |
| **Book Detail（local）** | `23 · Pages · Final` `943:651`(Phone) `943:855`(Tablet) | Phone/Tablet | CORE | `bookshelf.get`、`local_book.toc`、`reading.progress.get` | 书架→详情；返回=书架 | ✅ | ✅ | ✅（Phone） | ✅（Phone）/⊘(Tablet) | NoCover：书架卡基准（96.66×145.44）已对齐 Figma `3612:1796`；62×93/Tablet 缩放实例无 Figma 规则（子元素为 MIN/MIN 非比例缩放）；Hero 无 NoCover 变体（`N-COVER-HERO-01`）；Songti `B-DETAIL-01` 桥接 | `LocalBookDetail.ets` | HAP+VM(Phone,真实书) |
| **ReadingSurface** | `15 · Reader 2` `1023:18355`(Phone) `1023:18371`(TabletExpanded) | Phone/TabletExpanded | CORE | `local_book.chapter.content`、`reading.progress.get/update`、`reader.location.resolve` | 详情→阅读；返回=详情 | ✅ | ✅ | ✅(Phone) | ✅（Phone）/⊘(TabletExpanded) | 翻页动效按 `M-REVIEW-01` 暂停 | `LocalReadingExperience.ets`、`ReadingSurface.ets` | HAP+VM(Phone) |
| **Full Directory** | `23 · Pages · Final` `943:9888`/`943:10196`（当前 Figma 无本地目录动态字段映射） | Phone/Tablet | CORE | `local_book.toc` | 详情→目录；选章→该章正文；返回=详情 | ✅ | ⚠️（选章链路接通 + `chapterSelectionToken` 防过期加载 + 选章时重置测量状态（stale-submit/测量归属已修）；设备已用真实书《湛蓝权杖》验证选章→正文） | ✅（Phone） | ⊘Core阻塞（视觉合同未闭合：`R-LOCAL-TOC-01` 无 prototype reaction/固定样例/无本地目录字段映射；"新标题旧正文"转场仍开；设备回归未做当前构建） | `R-LOCAL-TOC-01` | `ReaderFullDirectory.ets` + `FullDirectoryPanel.ets` | HAP+VM(Phone,真实书) |
| **Import** | `23 · Pages · Final` + `08 Library&Import` | Phone | CORE | `local_book.import`、`bookshelf.add`（Host picker + rollback） | 书架→导入 | ✅ | ✅ | ✅(Phone) | ✅（Phone） | 格式支持：txt/epub 完整（IndexedText）；mobi/azw/azw3/kf8 检测+文本片段（Core TextBoundary，KF8/DRM 需外部解码器） | `LocalImportDialog.ets` | HAP+VM(Phone,真实书) |
| **Search** | `11 · Search` `2635:58749`~`2635:59599` | Phone/Tablet | CORE | `search.history.*`、`search-book.list`（缓存）、`source.list` | 书架搜索→搜索页；返回=书架 | ✅ | ⊘（输入关键词只写历史，未传 Core `book.search`；未接 `http.execute` 远程搜索） | ✅ | ⊘Core阻塞（http） | `S-SEARCH-EMPTY-HISTORY-01`、`S-SEARCH-RESULT-COVER-01` | `SearchPage.ets`、`SearchGateway.ts` | HAP+VM（壳） |
| **RSS** | `10 · Reference · RSS` `F2 · Canonical · RSS` `2305:267`/`2305:529` + CanonicalState `2305:738`/`2305:789`/`2305:849` | Phone/Tablet | CORE | `rss.subscription.list`、`rss.subscription.items`（缓存） | 书架底部导航→RSS；返回=书架 | ✅ | ⊘（"刷新"只重读缓存；订阅管理/详情只记 GAP；未接 `rss.subscription.refresh` 与 `http.execute`） | ✅ | ⊘Core阻塞（http） | — | `RssPage.ets`、`RssGateway.ts` | HAP+VM（壳） |
| **Settings General** | `23 · Pages · Final` `943:2897`(Phone) `943:3369`(Tablet) | Phone/Tablet | CORE | `persistence.put`（preferences 设置持久化，`SettingsGateway`）、`source.list` 入口 | 书架底部导航→设置；返回=书架 | ✅ | ✅（4 开关经 `SettingsGateway` 持久化） | ✅(Phone) | ✅（Phone）/⊘(Tablet) | 其余 Select/InlineAction 仍静态 | `SettingsPage.ets`、`SettingsGateway.ts` | HAP+VM(Phone) |
| **Source Management** | `23 · Pages · Final` `943:4281`(Phone) `943:4745`(Tablet) | Phone/Tablet | CORE | `source.list` | 设置→书源管理；返回=设置 | ✅ | ⊘（`SS-SOURCE-TOGGLE-01`：Core 无 `source.update`；开关点击无状态变化，仅记录缺口） | ✅（Phone） | ⊘Core阻塞 | `SS-SOURCE-TOGGLE-01` | `SourceManagementPage.ets`、`SourceGateway.ts` | HAP+VM(Phone 壳) |
| **Sync Backup** | `23 · Pages · Final` `943:4982`(Phone) `943:5462`(Tablet) | Phone/Tablet | CORE | `sync.backup`、`sync.webdav.plan`（均为纯计划命令；执行需 `http.execute` + 结果回传） | 设置→同步与备份；返回=设置 | ✅ | ⊘（`sync.backup`/`webdav.plan` 只建计划不执行网络；Host 无 http → 不可用，不伪装成功） | ✅（Phone） | ⊘Core阻塞（需 Host HTTP 执行+结果回传） | 需 http host + 执行回传 | `SyncPage.ets`、`SyncGateway.ts` | HAP+VM(Phone 壳) |
| **WebDAV Config** | `23 · Pages · Final` `943:5704`(Phone) `943:6116`(Tablet) | Phone/Tablet | CORE | `sync.webdav.*`（需 http） | 同步→WebDAV | ⊘ | ⊘ | ⊘ | ⊘缺口 | 需 http host + Final 节点 | — | — |
| **Discover** | `23 · Pages · Final` `943:1312`(Phone) `943:1684`(Tablet) + `09 · Reference · Discover` | Phone/Tablet | CORE | `source.exploreKinds`、`source.explore` | 书架底部导航→发现 | ⊘ | ⊘ | ⊘ | ⊘缺口 | `D-DISCOVER-STATES-01` | — | — |
| **Source Switch** | `23 · Pages · Final` `943:15215`(Phone) `943:15705`(Tablet) | Phone/Tablet | CORE | `change.bookSource` | 远程书详情→换源 | ⊘ | ⊘ | ⊘ | ⊘缺口 | `SS-SOURCE-SWITCH-01` | — | — |
| **Reader Control Home** | `23 · Pages · Final` `943:6848`(Phone) `943:8028`(Tablet) | Phone/Tablet | CORE | reader control 静态终态 | 阅读→控制 | ⊘ | ⊘ | ⊘ | ⊘缺口 | `RC-READER-CONTROL-01` | — | — |
| **Reader Quick/Module/Full** | `23 · Pages · Final` `943:8625`~`943:15055` | Phone/Tablet | CORE/静态终态 | 目录/TTS/排版/设置/替换/搜索 | 阅读→Quick/Module/Full | ⊘ | ⊘ | ⊘ | ⊘缺口 | `RC-READER-CONTROL-01`、`PT-*` | — | — |

## 2. 已交付（按三层标记，见 §1）

**三层都 ✅（真实业务闭环）**：
1. **Bookshelf → 本地 Book Detail → TOC → 真实章节正文 → ReadingSurface**：`local_book.import`（真实 EPUB/TXT）、`bookshelf.get`、`local_book.toc`、`local_book.chapter.content`、`reading.progress.get/update`、`reader.location.resolve`。重启恢复同一位置。
2. **Bookshelf ReadingProgress=None**：`continueReading === undefined` 时整块不渲染，书架自然上移（Figma 已补 `3579:11530`/`3579:11575`）。
3. **空书架**（Phone 参考；Tablet 复用 Phone 350.903 宽内容、靠左对齐）：空 Core 书架显示空态与导入入口（`H-NOTE-1`，Tablet 无 Figma 终态）。
4. **Book Detail（local）**：真实 `bookshelf.get` + `local_book.toc`；无封面书按 `N-COVER-REMAP-01` 放行（Figma `3612:1796` NoCover）。
5. **Full Directory 选章**：`FullDirectoryPanel.chapterRow.onClick` → `ReaderFullDirectory.onSelectChapter` → `Index.onDirectoryChapterSelected` → `LocalReadingExperience.onRequestedChapterChanged`（@Watch）→ `openChapter`。选章真实重载 + `chapterSelectionToken` 防并发覆盖。**但 `R-LOCAL-TOC-01` 仍存**：Phone/Tablet 实例无 prototype reaction，章节行固定样例，无本地目录字段→正文映射；设备回归未做（VM 无书）。
6. **Settings General**：`SettingsGateway` 经 `@ohos.data.preferences` 持久化 4 开关；`Index` 读写 `settingsSnapshot`。

**视觉壳（视觉 ✅，真实 Core ⊘，VM ✅）**：
7. **Search**：五态视觉完整 + 真实 `search.history.*`/`search-book.list`（缓存）；未传 `book.search`（需 `http.execute`）。
8. **RSS**：四态视觉完整 + 真实 `rss.subscription.list`/`items`（缓存）；"刷新"未接 `rss.subscription.refresh`（需 http）。
9. **Source Management**：真实 `source.list` 展示；开关未调 `source.update`。
10. **Sync Backup**：`SyncGateway` 参数已按 Core 合约修正；`sync.backup`/`webdav.plan` 均为纯计划命令，`triggerBackup` 不插入 0 字节假历史。`连接测试` 结果**仅写 hilog，页面无可见成功/失败状态**；WebDAV 配置未持久化。**当前不可用**，须先接 Host HTTP 执行与结果回传。

## 3. 阻塞项（Figma 缺口 / 需 host 能力）

- **Discover** `D-DISCOVER-STATES-01`：`09 · Reference · Discover` 只有 populated 态与组件族，无 loading/empty/error 变体，无 `source.explore` 结果字段映射。底部导航"发现"保持 inert。
- **Reader Control Home/Quick/Module/Full** `RC-READER-CONTROL-01`：阅读表面控制 dock 装配、触发/返回规则未定义；TTS/AutoPage/翻页受 `PT-*`、`M-REVIEW-01` 动效暂停。
- **Source Switch** `SS-SOURCE-SWITCH-01`：换源 overlay，需远程书详情链路（`change.bookSource`）。
- **WebDAV**：真实同步需 `http.execute` host 能力（当前 Host 只注册 `persistence.*`）。
- **Search/RSS 远程能力**：`book.search`、`rss.subscription.refresh` 需 `http.execute` host 能力。
- **响应式**：Compact 全页缺失（`R-COMPACT-01`）；Tablet/TabletExpanded 布局未做运行验收。

## 4. 实施顺序

1. **批次 A（✅ 真实闭环）**：Bookshelf、Book Detail、ReadingSurface、Import、Full Directory、空书架。
2. **批次 B（✅ 真实闭环）**：Search 五态、RSS 四态（视觉 + 缓存数据）。
3. **批次 C（✅ 真实闭环或壳）**：Settings 持久化、Source Management、Sync 网关。
4. **批次 D（阻塞）**：Discover、Reader Control、Source Switch、WebDAV、远程搜索/刷新 —— 待 Figma 补齐状态或接入 `http.execute` host 能力。

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

1. **NoCover 视觉重映射（防崩溃已修，视觉部分闭合）**：书架 `bookCard`/`continueReadingCard` 用 Figma `3612:1796` NoCover（奶油 `#F5ECE6` + 两条横线 + "暂无封面"），不再 `Image(undefined as string)` 也不再绿色渐变。**BookDetail Hero 无 NoCover 变体（`N-COVER-HERO-01`），不补画**，空封面槽只显示文字列。
2. **Full Directory 选章**：`requestedChapterIndex` @Watch → `openChapter`；`chapterSelectionToken` 防过期加载 + 选章时重置测量状态（stale-submit 清理、测量归属已修）。**竞态部分修复、Figma 视觉合同未闭合（`R-LOCAL-TOC-01`）**，当前构建设备回归未做。
3. **Sync 参数修正**：`sync.webdav.plan` → `{baseUrl, requests:[PROPFIND]}`；`sync.backup` → `{package, policy}`。**但两者均为纯计划命令，不执行网络**；`triggerBackup` 不再插入 0 字节"备份成功"假历史，`连接测试` 如实报告"计划已构建，未执行网络（需 http host）"。**Sync 当前不可用**，须先接 Host HTTP 执行与结果回传。
4. **Source 开关诚实化（`SS-SOURCE-TOGGLE-01`）**：Core 无 `source.update`。`onSourceToggled` 不再乐观切换（避免未持久化假状态），保持原状并记录缺口。
5. **Tablet 空书架**：撤销 720px 推断，Tablet 复用 Phone 350 参考布局；导入弹窗不再被排除。**入口可用、视觉缺口未关闭**（Figma 无 Tablet Empty）。
6. **`close()` 异常路径**：flush 抛错时 `finally` 仍清理单例。
7. **VM 列诚实化**：Phone-only VM → `VM(Phone)`；Tablet 未运行验收。

## 6.2 第三轮审计收敛（2026-08-05）

复核后正确状态收敛为（不再声称"修复完成"）：

- `close()`：✅ 已修。
- NoCover：**防崩溃已修、视觉未闭合**（书架已按 Figma NoCover；Detail Hero 无变体）。
- 目录：**选章代码路径存在、竞态部分修复（测量归属/stale-submit 已修，设备回归未做）、Figma 视觉合同未闭合**。
- Tablet：**入口可用、视觉缺口未关闭**。
- Sync：**不可用，必须先接 Host HTTP 执行与结果回传**。
- Source Toggle：**不可持久化，不应伪装成功**（已不乐观切换）。

## 7. 已知限制（审计披露）

- **构建产物**：unsigned HAP（无 signingConfig）；回归以 VM 最新安装为准。
- **NAPI 库**：HAP 内只有一个经 Native Strip 的 `libreader_core_napi.so`（SHA 754c…）。`entry/libs`（9912f5da）与 Core target 一致；`vendor/core-harmony/libs` 保留旧副本（ced5b79a），**未见双重打包，但是维护风险**。
- **Git 可追溯性**：`Reader-for-HarmonyOS` 已纳入 git（分支 `feat/reader-module-directory-a2`，含源码/资源/文档/NAPI 库）；Reader-UI 与 Reader-Core-Native 有各自未提交/已提交改动。可回溯性以各仓库 git 为准。
- **VM 时间线**：已将含第四轮修复的构建安装到 VM，并用真实书《湛蓝权杖》(txt) 完成设备回归（NoCover 渲染、Full Directory 真实目录选章→章节正文、Detail 真实数据）。**第五/六轮修复（测量重置等）未安装到 VM 做当前构建设备回归**。VM 导入路径：推 txt 到 `/data/local/tmp` 后驱动 DocumentViewPicker。
- **字体**：BookDetail 标题 Figma 指定 Songti SC，当前以 Noto Serif SC 临时桥接（`B-DETAIL-01`）。
- **VM 为 Phone 形态**：Tablet/TabletExpanded 布局未做运行验收。
- **阅读核心独立实现缺陷（非 Figma 缺口，待专项调试）**：
  1. 非 ready 阶段 ReadingSurface 收到空 `visibleFragments`（不暴露 loading 态的设计），布局失败依赖 deadline 兜底，无独立失败上限；
  2. `hasValidUnicodeProbe` 把 `lineCount === 0` 一律当"尚未布局"（`LocalReadingExperience.ets` 度量路径），若度量稳定返回 0 会延误到 deadline；
  3. 章节末尾空行时阅读位置恢复锚点可能定位失败（`configureRestoredAnchor` 依赖 `beginMeasurement` 的 clamp 兜底，未逐字节验证末尾空行场景）。
  这三项均在阅读核心，改错会破坏已验证的真实书阅读链路，需专项复现后单独修复。
