# 漫画退出后的详情与书架投影

日期：2026-10-03。范围：Host 详情位置、书架章节百分比与继续阅读投影；不改已定 UI，不操作 VM。

## 发现记录

- 候选 Harmony HEAD：`568ec4e32a2bdce01f62724cfb04a3f6b5a63a60`，隔离目录 `manga-ui-20261002`。定位前 Index.ets SHA-256：`4d2032b12fb217fef364b737ce5861482f8bfa52c9565a77581170d40ac54163`。该目录另有本轮书源、正文和目录修复未提交。
- 父任务提供的同一已安装 HAP 现场：腾讯漫画 `斗破苍穹`，01（36 页）读到第 2 页，经阅读目录进入完整目录选 02（24 页），读到第 2 页后普通返回。`/private/tmp/manga-after-exit.json` 中详情仍为 01、2 / 36 页，详情目录高亮 01。
- 退出应用后冷启动，`/private/tmp/manga-cold-shelf.json` 中书架漫画位置为 02 · 第 2 页 / 24 页，证明该漫画位置已持久保存；同屏章进度为 `*%`，继续阅读卡仍为刚才之前阅读的小说第四章。腾讯目录为 681 个可读条目。这里只引用父任务现场，不声称本子任务重新获取了 VM 证据。

## 代码定位

- MR-17：Surface 在已确认位置保存之后更新 `MangaBookPresentation`，但 Index.detailBook.mangaPosition 是进入详情时的对象快照。普通 `returnToReadingOrigin` 只刷新 acquisition，只有“阅读内书籍信息”特殊出口执行漫画 hydration。并且 `projectMangaPosition` 以全局 revision 是否变化判断是否更新详情：Surface 已发布新位置后，相同 entry 不再改变 revision，详情旧快照仍被遗漏。
- MR-18：`ShelfBookPresentation` 对所有漫画无条件返回 `*%` 与空轨道。Core `remote.rs::enrich_bookshelf_positions` 又将 admitted manga 的 readProgress/currentChapterIndex/currentChapterTitle 清空；Host 需要只接 Core 真实目录可读顺序/总数的章节比例，不能用 manifest 页数或原始稀疏目录 index 推算。
- MR-19：Core 漫画 CAS 仅写 manga_progress，不更新 bookshelf.last_read_at；SQLite/InMemory 的 hasReadingProgress 只认文本 reading_progress；书架时钟不监听漫画位置。Host 继续阅读卡明确支持漫画，但选卡依赖这些 Core 共用事实。Core 修复由父任务另行分配；Host 不写伪造的小说进度。

## 修复边界

普通返回与书籍信息返回共用漫画位置刷新；先同步已确认的会话显示事实，再以现有 entry/progress 准入补全。详情更新独立于共享 map revision，沿用现有 owner/source/book/route/generation fencing。漫画百分比接 Core 提供的已知章节比例，缺总数或不可对应则保留 `*%`；章内页数只用于阅读位置文本。

## 本地结果

- MR-17 已修：新增 `refreshDetailMangaPosition`，hydratation 在去重/发请求前同步已确认 map；entry 准入后的详情刷新不再依赖全局 revision 变化；普通 Back 和阅读内 Info 共用出口。保留既有元数据、来源隔离、owner、navigation、shelf generation 和 route 准入。
- MR-18 Host 已修：仅在 Core 提供合法 `chapterCount > 0` 和 `readProgress` 时显示漫画章节比例。已知 0 显示 `已读 0%`，末章 100%，缺总数/映射/合法比例为 `*%`。不读取章内页数，不以稀疏 chapterIndex 作可读序号，不更改漫画“全书完成”的判断。
- 定向回归六组通过：`test-manga-ui-position-hydration.mjs`、`test-manga-book-presentation.mjs`、`test-detail-acquisition-return-stability.mjs`、`test-detail-external-directory.mjs`、`test-bookshelf-reading-entry.mjs`、`test-search-trial-reading-return.mjs`。其中前两组补齐实际旧快照复现、相同全局 revision、普通/Info 返回、清空/迟到响应、合法/未知章节比例、文本隔离、稀疏 index 和页比例隔离。
- 安装 SDK 实际生成的 Index Builder observer closure 验证：同一 detail child ID 在返回后收到新 book snapshot，目录 child 收到新的 currentChapterIndex/pageOrdinal/pageTotal；实际 LocalBookDetail readingFacts Builder 显示 `02` 与 `2 / 24 页`，其生产 isCurrentChapter 方法只高亮 02。
- 新 SDK 探针首次运行因 fixture 未提供 detailToc，无法按 entries 查找目录 child，断言失败；补齐已定目录输入后通过。失败来自测试输入，不是生产渲染失败。
- `git diff --check` 通过。这里只执行本地生产方法与 SDK closure 回归，不模拟 ArkUI 原生布局或依赖调度。

当前边界：Host 代码与定向回归完成；MR-18/19 Core 同步实现另行交付。未构建、未安装、未操作 VM；修复后的设备行为待父任务交付验证。

## 未知目录映射的继续阅读边界

Core 查询复核发现并由父任务授权补齐：当前 all-filter 首页快路径只查 currentChapterIndex/readingPosition。最新漫画的章节 URL 缺失或重复时，Core 正确省略目录映射，但 Host 因此跳过该漫画并直接选后面的旧小说；只有未知漫画且首屏已完整时也会误判无卡。`BookshelfFlowGateway` 现在将漫画的 lastReadAt 视为需要全局进度记录查询的候选，仍由既有 loadContinueReading 做最终选择；读时本身不证明位置，也不构造文本坐标。

新增定向场景：最新未知映射漫画＋旧小说、仅该漫画、漫画/小说同 bookId 不同源、只有读时但 Core 返回小说、旧未知漫画不拖延最新有确切进度小说、没有读时的漫画保持原快路径。`test-bookshelf-startup-readiness.mjs`、`test-bookshelf-paged-projection.mjs`（含 1001 本书窗口及深目录 anchor）、`test-manga-book-presentation.mjs` 三组通过，diff check 通过；其余生产文件保持冻结。新增生产 BookshelfFlowGateway SHA-256：`c3fe32107596ebe9e09bd0bf8bc77d9c0ba8c5f102528bcc43b28f4e2b3d02c6`，测试 SHA-256：`74e18060e0dfc65cb49671b26cb64ec5a8705281bce7c7845f2b1d9897e8fa83`。

## Core 查询只读复核

- 从当前 Rust `progress_expression` 原始 SQL 模板提取并在 SQLite 内存数据库复核 9 类输入：重复可读 URL、缺 URL、缺目录、空目录为 NULL；非可读分卷行不参与总数/唯一 URL 计数；稀疏源 index 按 readable_position 计算；同 bookId 在不同 UTF-8 source 下隔离；漫画残留的文本 reading_progress 不污染章节比例；小说原有 75% 投影保持 7500；已知未读漫画为 0。排序验证 DESC 将 NULL 读时放最后，同值按 sourceId/bookId 稳定排序，与 InMemory comparator 一致。
- 复核发现新漫画 CAS 时间函数初版使用毫秒，而既有 lastReadAt/text progress 使用并归一为 Unix 秒，导致后来读小说也无法排到漫画前。已立即通知父任务与 Core owner；当前源码已改为 as_secs，Core owner 补齐漫画后读小说排序回归。生产 Core 未由本子任务修改或构建。
- 初次 SQL 临时探针受 Core owner 正在格式化源码影响，模板正则未识别新的换行格式，未执行 SQL；调整只读提取后上述 9 类通过。这是工具解析输入问题，不是 Core 查询失败。
