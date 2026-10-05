# 继续阅读卡保留旧小说与冷启动位置未刷新

日期：2026-10-03。输入现场：最终规范 HAP manifest `20261003T072625Z-568ec4e3-0320176a`，Native 已含 MR18。

- 父任务提供 `/private/tmp/manga-final2-updated-shelf.json/.jpeg`：漫画 04、第 3/24 页，已排书架第一、章节比例约 0.59% 显示已读 <1%，继续阅读卡仍为旧小说第四章。
- 冷启动 `/private/tmp/manga-final2-cold-shelf.json`：继续卡选到漫画且作者正确，但位置显示尚未阅读，同屏漫画列表正确 04、第 3/24 页。证明 Core 持久选卡正确；这里不新增设备取证。
- 代码定位一：`continueReadingCard(book)` 的 SDK observer closure 捕获首次 book 参数。实际安装 SDK lowering + 首次执行 ListItem deepRender + 保留 ListItem，替换 owner.continueReading 为漫画后，即使重放全部 observer，标题/作者/第四章和点击回调仍指向首次小说。
- 代码定位二：BookshelfPage 未订阅 readerMangaPresentationRevision，冷 map 尚未就绪时的卡位置不会更新；ShelfBookListDetails 已订阅并显式读取 revision，因此列表更新而卡不更新。

修复只在 BookshelfPage：卡 Builder 从每个 observer/点击回调读取当前 continueReading Prop；正文位置读取共享 StorageLink revision；undefined 清空文字并忽略迟到点击。依照本对话已确认的缺字段规则，继续卡已由进度记录查询选中，漫画位置未准入时留空，Text 保留最小 15vp 行高，避免闪尚未阅读；不改其他场景的 MangaBookPresentation.label。保留卡片布局、尺寸、颜色、单一 Row 点击动作与 ListItem。

验证已完成并冻结：新增实际 SDK closure + observer 依赖探针，覆盖 mounted ListItem 的小说→漫画、封面/作者/标题/位置/点击身份、仅 hydration revision 变化、同 bookId 不同源、漫画→小说、删除后的迟到点击。位置 observer 的实际 storage getter 依赖被记录；cold 位置由空串更新为 `04 · 3 页 / 24 页` 时，仅重放该依赖 observer，不改变书 Prop 或重新构建 ListItem；Text/卡片 actor ID 保持。卡背景与阅读按钮保留既有唯一 Row 点击动作，当前书与 undefined 安全保护均经实际生成回调验证；没有声称模拟原生触摸冒泡。

- 新 `test-bookshelf-continue-card-sdk.mjs` 通过。其余相关回归：`test-bookshelf-detail-control-stability.mjs`（52 个 timeline/Builder 样例）、`test-bookshelf-view-and-menu.mjs`、`test-bookshelf-startup-readiness.mjs`、`test-manga-ui-position-hydration.mjs`、`test-manga-ui-assembly-sdk.mjs` 均通过。
- assembly 检查实际安装 SDK 解析 356 个生产 ETS/TS 文件、668 个字段绑定及组件 lowering，包含 BookshelfPage。本检查明确不执行项目完整 ArkTS 语义/语法规则编译，HAP 交付仍待规范流水线。
- `git diff --check` 通过。BookshelfPage SHA-256：`d1fd2c6dfaacc4c35fc85d27ab2cfa0146249abd307ea1c6e34c70239363a0b9`，新增测试 SHA-256：`e2e0bffab79bebedb742decfe1468ea2a7f069668cc215d80d78a4df18321435`。
- 初次只读闭包探针未注册 NoCoverCover、随后缺失 ViewStackProcessor 平台依赖，未完成执行；补齐 fixture 后实际旧源码成功重现保留小说现象。此为探针环境缺失，不是新生产错误。

未改 Core/Index/设计，不构建或操作设备；新 HAP 与实际设备验证由父任务进行。缺字段行高沿用本对话设计记录；SDK lowering 与本地探针不等同完整 ArkTS 编译或设备布局验证。
