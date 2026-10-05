# 漫画整体方案实施设计（本轮活动记录）

日期：2026-10-03。范围：MANGA-01～05 在 `.reader-isolated/manga-ui-20261002` 的落地。本文是本轮活动的实施记录，不是不可变设计归档；行为合同以 `DEVELOPMENT_BACKLOG.md` MANGA-OVERALL 为准。

## 现状基线（均有源码证据，详见会话审计）

已具备、必须复用：
- Host `ReadingImageDiskCache`：原子写、manifest 校验、按书互斥锁、16MiB/图上限、16MiB 写入余量。阅读与下载共用同一实例与 `images-v2` 目录。
- Host `BookRequestScheduler`：foreground/search/background 三级 + 后台 5s 公平提升，可复用为整章调度底座。
- Core `chapter_download_queue`：pending/in_progress/completed/failed/cancelled 完整状态机 + `idx_download_claim`。
- Core `manga_offline_receipts`：下载完成回执（区分"完成"与"可淘汰缓存"的扩展点）。
- Core manifest 版本化 + head 指针 + 原子 publish；progress token/epoch。
- 换源 `MangaSourceSwitchGateway`：直接提交无二次确认、首图验证。

确认缺口（本设计要补）：
1. 无整章补齐：SessionController 只做视口 ±1 页 + 8 块 tile。
2. 无缓存策略：2GiB 总预算、7 天过期、会话保护、32MiB 前台窗口、512MiB 余量全缺。
3. 无保留归属：reading 与 download 未统一归属；无缓存↔下载转换；无暂停/取消/解除保留/删除语义分离。
4. 换源落点：标题不唯一时按章节序号兜底 + 继承旧页序（方案禁止）。

## 架构边界

- Core（Rust）：内容身份、版本、保留归属（pinned/cache）、7 天过期事实、会话保护意图、缓存↔下载转换事务、删除代次。新增 schema v35。
- Host（ArkTS）：真实文件、磁盘空间预约、整章补齐调度、显示资源、网络。预算执行与淘汰扫描。
- UI：用户意图与状态展示（目录下载态、章末、换源落点）。

## Core schema v35 设计

新增表（forward-only，`current < 35` → `user_version=35`，保持既有数据不动）：

- `manga_retention(source_id, book_id, chapter_id, version, kind, created_at, updated_at, PRIMARY KEY(source_id,book_id,chapter_id))`
  - `kind`: `'download'`（用户保留，不参与淘汰）/ `'cache'`（普通缓存，可淘汰）。
  - 记录每章当前 head 版本的保留归属。版本原子替换时随 head 迁移。
- `manga_cache_access(source_id, book_id, chapter_id, version, last_read_at, PRIMARY KEY(...))`
  - `last_read_at`：最后一次实际阅读访问（Unix 秒）。预取/校验/补齐不续期——只有 `save_manga_progress` 与显式阅读命中才更新。
- `manga_session_protection(source_id, book_id, chapter_id, session_epoch, PRIMARY KEY(...))`
  - 当前章 + 最近离开两章的会话内保护意图；退出阅读解除。

复用：`chapter_download_queue` 增加操作语义（不新增表），`manga_offline_receipts` 作为下载完成事实。

## 新增 Core 方法（契约）

- `manga.retention.set` { sourceId, bookId, chapterId, kind } — 设置保留归属（缓存转下载=download；解除保留=cache）。认领现有有效内容，只补缺项由 Host 补齐。
- `manga.retention.get` / `manga.retention.list` — 查询归属。
- `manga.cache.evict` { budgetBytes, nowSeconds, protectedSessionEpoch } — Core 计算可淘汰集合（普通缓存、超 7 天未读、非会话保护、非下载保留），返回待删身份；Host 执行物理删除并回报。预算/过期数值由 Core 持有。
- `manga.session.protect` { entries[], sessionEpoch } / `manga.session.releaseProtection` — 会话保护意图登记/解除。
- 下载队列操作扩展：`cache.download.pause` / `cache.download.resume` / `cache.download.cancel`（区分"取消任务"与"删除内容"）。

## Host 设计

- `ReadingImageDiskCache` 增加：按 Core 返回身份物理删除、统计实际字节（2GiB 预算计账）、32MiB 前台临时窗口、512MiB 真实余量（替换 16MiB）、24h 过期巡检驱动。
- `MangaChapterBackfillScheduler`（新）：整章补齐。复用 `BookRequestScheduler` 优先级与 `ReadingImageDiskCache` 字节。目标页优先 → 当前章补缺 → 显式下载 → 刚离开章低优先 → 邻章预取。只维持当前章+最近两章意图；退出暂停；迟到结果不复活。
- 换源落点：`MangaSourceSwitchGateway` 移除序号兜底与页序继承；可靠对应（唯一标题/可读卷身份）从章首进入（ordinal=0），无可靠对应返回目录手选意图。

## 实施顺序（对应 BACKLOG MANGA-07）

1. Core schema v35 + retention/access/protection 表 + 契约方法 + 单测。
2. Host 磁盘预算/淘汰/余量/巡检 + 整章补齐调度器 + 跨章接续。
3. 下载转换/清理/低空间/故障恢复（Host API + UI 接线）。
4. 换源落点/章节原子更新/手势导航。
5. 已批准 UI 剩余差异。
6. MA-01～10 对同一签名产物验收。

## 数值默认（与 BACKLOG MANGA-02 一致）

2GiB 总预算；32MiB 前台临时窗口；7 天阅读过期；24h 巡检；当前+最近两章会话保护；512MiB 写入余量；单图 16MiB 保留。
