# 既有修复重复出现审计（2026-10-10）

本次审计覆盖用户指出的搜索页筛选重叠和书籍详情完整目录接线，并沿着历史提交、当前调用链、SDK 回归与 VM 画面交叉核对。工作树有大量并行改动，源码、测试、产物、VM 和用户验收仍分开记账。

## 结论

- **确认有 2 条合并回归路径。** 第一条是搜索结果头部只预留一行筛选高度；第二条是漫画目录准入边界被旧版本覆盖，导致漫画详情显示壳存在但完整目录请求落入文本网关并返回 0 条目录。
- **详情页的目录 renderer 接线本身没有再次回归。** 历史 VP44（漏传漫画展示事实）和 VP46（漫画误用小说整页壳）仍保留现行分支；这次复现发生在更早的 acquisition/cache admission 链路。
- **另有 5 类历史修复已确认没有进入当前集成树，但本轮没有 VM 复现证据。** 它们是待补的集成遗漏，不计入本次用户可见回归数：漫画目录展示规则/状态投影、换源搜索耗时持久化与版本绑定、换源同键行可观察更新、只有当前源缓存时仍搜索其他源、漫画换源候选 `mangaCandidates` 作用域。
- **历史问题账本共 15 项，当前仅这 2 条有源码与现行 VM 证据同时闭合。** 其余账本条目保持原有 OPEN/观察状态，不能因为本次合并而推算为已重复。

## 为什么会在这次合并复现

当前集成基线是 `493e6315`。历史修复 `d870c647`、`8d2fb604` 和 `f107a7d2` 均不是该基线的祖先（`git merge-base --is-ancestor` 均返回否），所以这不是同一条主线上的修复被运行时回滚，而是修复提交所在的后续分支没有被带入本次集成，随后旧的 acquisition/UI 代码继续参与构建。目录问题因此在更早的“目录准入”阶段重新出现；筛选问题则是内容类型行的新增和旧高度公式分别进入了集成。

## 回归一：搜索结果筛选重叠

`SearchPage.build()` 在结果态同时绘制 `groupScopeRow()` 和 `contentTypeRow()`，每行约 41.5vp；`searchHeaderHeight()` 仍只加一行，统计条和列表以该高度定位，故第二行筛选被覆盖。合并时内容类型行（历史提交 `f107a7d2`）与旧头部高度分开进入，耦合修复没有作为同一变更保留。现已按实际行数计算高度，并在 `tools/test-search-physical-layout.mjs` 固定两行结构与几何断言。

## 回归二：漫画详情完整目录准入

详情 `Index.externalDirectory()` 和 `ReaderShell` 仍按 `contentKind` 选择漫画 `BookDirectoryPage`；因此 VP44/VP46 的最终 renderer 修复没有丢失。被合并覆盖的是历史提交 `d870c647`/`8d2fb604` 中的 `allowMangaCatalog` 边界、缓存目录证明刷新和来源绑定目录投影：`BookAcquisitionCoordinator` 重建 `actual` 书籍后只调用文本路径，漫画 `book.detail` 被 `nonTextChapter` 拒绝，最终留下漫画详情卡片、但目录为 0 条并显示“不支持此类阅读器”。现已恢复目录专用准入、缓存证明校验和漫画目录显示刷新；正文仍由漫画会话通道负责，未把漫画硬塞进文本正文缓存。

## 其他历史修复的集成遗漏（未计入本次复现）

源码对比确认以下修复分支当前仍未进入集成树：

- `be4804e7`/`26bde956`/`eb588c75` 的漫画目录展示规则、VIP/已购/下载状态和仅按准入节点投影；当前 `MangaDirectoryEntryRow` 仍主要按原始标题和 `chapterByIndex` 回填。
- `240dfa2a`/`10a8243a` 的换源耗时持久化与来源版本绑定；当前 `SourceSwitchGateway.withoutSearchTiming()` 仍清除旧耗时，实时样本仍缺测量时间和版本投影。
- `6edcc3c9`/`8b0096f8` 的换源同键行可观察字段更新；当前 `SourceSwitchWindow` 仍用普通 `@Prop` candidate 和普通 `onDataChange`。
- `fa34b7a9` 的“只有当前源缓存也继续查找其他来源”；当前 `SourceSwitchHost` 仍以 `cached.length > 0` 直接判定成功。
- `b1907768` 的漫画候选作用域；当前相关搜索请求没有 `mode: 'mangaCandidates'`，作者约束仍按文本候选规则执行。

这些是应进入下一轮集成的 5 类行为缺口；翻章边界提交 `d066bc92`、`5b888a27`、`38489f78`、`596b1572`、`e356c059` 属于后续分支，当前没有主线/VM 证据证明是本次合并回归。

## 验证与边界

以下源码/SDK 回归已通过：

- `test-search-physical-layout.mjs`
- `test-detail-external-directory.mjs`
- `test-manga-reader-full-entry-sdk.mjs`
- `test-reading-entry-host.mjs`
- `test-remote-reading-flow-runtime.mjs`
- `test-book-acquisition-coordinator.mjs`
- `test-reader-control-directory-content.mjs`
- `test-reader-control-directory-model.mjs`
- `test-reader-directory-data-snapshot.mjs`
- `test-reader-directory-navigation.mjs`
- `test-reader-directory-projection.mjs`
- `test-reader-directory-host.mjs`
- `test-reading-offline-gateway.mjs`
- `test-reading-offline-host.mjs`
- `test-remote-reading-flow-gateway.mjs`
- `test-reader-directory-shared-content.mjs`
- `test-manga-offline-network-probe.mjs`

此前 VM 已证明搜索结果两行筛选坐标不重叠，也证明漫画详情进入了正确的漫画目录壳；旧产物下目录仍为 0 条。恢复后的代码必须重新走规范迭代 HAP、保数据安装和同一 VM 入口，才能把这两项升级为产物/设备证据。全量合同门禁目前仍有既有 typography/default-control 基线失败，不能用绕过门禁的产物替代正式证据。

## 本轮产物与 VM 复核

- 规范迭代构建 `20261010T145147Z-493e6315-1992edd6`：selected contracts `PASS`（manga-image-cache，50 个合同、469 个集成测试分类），ArkTS 类型检查和签名 HAP 构建通过；全 suite 按 scope 未运行。
- 签名 HAP SHA-256：`a8309ad294c6d0b49945de4bf50cb4dd282a99c410c5b3ac91c58c8b5706b138`；证书指纹与 `minliny_HarmonyOS` 一致。保数据 VM 安装回执：`.reader-artifacts/hap/20261010T145147Z-493e6315-1992edd6/deploy-vm-6460677a198b-20261010T145258Z.json`，`dataPreserved:true`。
- 最新 VM 搜索结果页在真实结果下同时显示“来源”和“内容类型”两行；布局树坐标为来源 `[56,361][235,420]`、内容类型 `[56,506][235,565]`、统计条 `[63,630][1280,688]`，无覆盖。截图和布局：`/private/tmp/reader-vm-audit-20261010-final2/reader-control-final2-search-manga.png`、`reader-control-final2-search-manga.json`。
- 最新 VM 漫画详情显示“章节目录 · 28 个可读条目”；点击“完整目录”进入漫画目录壳，布局树显示“28 个可读条目”、搜索章名、定位当前条目、正序和 001、002、007 条目，未再出现“不支持此类阅读器”。截图和布局：`/private/tmp/reader-vm-audit-20261010-final2/reader-control-final2-manga-detail.png`、`reader-control-final2-manga-detail.json`、`reader-control-final2-manga-directory.png`、`reader-control-final2-manga-directory.json`。
- 磁盘不足/缓存清理的离线网关、下载宿主、设置缓存清理和 manga storage owner 合同均通过；本轮 VM 未触发真实 NO_SPACE，因此没有主动删除 VM 缓存。
