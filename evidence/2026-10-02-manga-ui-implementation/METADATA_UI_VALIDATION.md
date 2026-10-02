# 漫画 UI 展示与目录增量

设计输入：Reader-UI 中保留的 `design/manga-ui-20261002`，原预览 `evidence/2026-10-02-manga-ui-demo/DESIGN_PLAN.md`；用户于 2026-10-02 明确要求保存设计、创建独立 worktree 并落实。

## 实施

- 共享详情全页面 Scroll，内容内部避让浮动 52px 居中返回栏与 68px 操作 dock；84×122 封面、24/34 两行书名、三行简介及展开收起。
- 书架列表只保留内容类型／本地在线两个元数据标签，11/14 同色阅读位置与最新条目；漫画位置独立来自 Core 已确认图片位置。没有漫画整书分母时固定 `*%` 与空进度轨道，不读小说 scalar basis points。
- 共用树目录的漫画展示按 Core `group`／`target`／`disabled` 显示；44／58 最小行高，长标题自然增高。当前可读条目浅绿底及“正在读”；分组仅展开，目标继续经过 Core target proof 再导航。
- 独立漫画目录沿用树查询／搜索／顺序／虚拟窗口；Core 缺少树视图时复用现有虚拟平面列表，不全量创建 3000+ 原生行。局部漫画深色通过 `mangaScheme` 进入目录，仅影响展示。
- “定位当前”只忽略本书旧浏览 anchor，并按 Core 提供的当前祖先逐层展开，保留其他组／其他书折叠；不把卷组当正在阅读的条目。
- `MangaBookPresentation` 只缓存 session 展示投影，严验 source/book/chapter/manifest/page identity；远页可使用 controller 已接纳的 bounded page-map 事实。持久化仍由现有漫画引擎负责。

## 本地验证

每项均在 120 秒预算内完成，2026-10-02 最近一轮 exit 0：

- `node tools/test-manga-book-presentation.mjs`
- `node tools/test-manga-metadata-ui.mjs`
- `node tools/test-reader-directory-navigation.mjs`
- `node tools/test-reader-directory-viewport.mjs`
- `node tools/test-reader-directory-navigation-ui.mjs`
- `node tools/test-book-directory-page.mjs`
- `node tools/test-reader-directory-extent.mjs`
- `node tools/test-manga-ui-floating-bars.mjs`
- `node tools/test-manga-ui-position-hydration.mjs`
- `node tools/test-bookshelf-filter-responsibilities.mjs`
- `node tools/test-bookshelf-view-and-menu.mjs`
- `node tools/test-detail-external-directory.mjs`
- `node tools/test-app-shell-safe-geometry.mjs`
- `node tools/test-reader-feedback-regressions.mjs`
- `node tools/test-bookshelf-physical-feedback.mjs`

新增测试执行生产 TS 方法与真实 SDK emitted Builder，包含错误来源、过期 manifest、错误页、Core 清除位置、远页、独立文字进度、当前 ancestry、不可读目标、自然行高、详情 fullviewport 与浮动参数。浮动栏测试以 2/3/4 个主 Tab、手机／平板宽度、左右非对称 cutout、安全底边、68/R34 tab、52/R18 标题栏、透明容器和 44vp 对称槽覆盖实际 Builder；它验证的是 SDK observer 与属性／回调几何，不等同于原生像素截图。

位置 hydration 测试调用 Index 的生产 `hydrateMangaPositions`、`pumpMangaPositionProjections`、`projectMangaPosition` 和当前性 fence，覆盖全局 2 worker／latest 24 队列、批次替换、同批去重、路由／来源／owner 失效、重复事实无 revision churn、Core 无位置清除、entry 缺失时的 progress fallback、source-switch 中止以及 bounded shelf window。`MangaBookPresentation` 单元回归补充 144 个保留 identity 与新 Runtime owner 清理，避免旧 session 展示事实复活。

列表安全区回归确认漫画自然行高分支将上下留白写入 List 的 `contentStartOffset`／`contentEndOffset`，自身 `.padding` 保持 0；文字固定行高分支继续使用原有显式 padding 与 extent。书架回归确认 74vp 顶部和 floating tab 底部留白同样属于 native List content offset，避免把视觉安全区再次扣减到 viewport。

BookDirectoryPage 的 SDK Builder 回归在 390vp 宽、左 50vp／右 32vp 非对称 cutout 下读取漫画分支 header Row 的实际 emitted padding，确认左右值来自 `contentFrame()`，且标题栏不会覆盖 cutout。

首次 BookDirectory SDK probe 报两个新增 Builder 未被 probe 选取，代码侧定位为测试 harness 成员清单遗漏；清单补全新 Builder 后原有标准目录所有断言继续通过。共享 ReaderDirectoryList 固定文字行高断言更新为可选漫画自然行高表达式，仍保留丢失 extent／初始行高错误的 negative controls。

额外 source-name-resolution 当时前 7 条通过，第 8 条在 root 并行编辑 BookshelfPage 时报告 ETS parse 1 diagnostic；该文件由 root 接管，最终集成轮次需重跑，不能把本记录当它已通过。

本轮旧书架测试保留业务断言并迁移到批准设计：筛选同时覆盖 content type 与 origin、空作者仍预留 14vp、漫画位置不借用文字百分比、48×72 手机封面／64×104 平板封面、四个菜单动作、导入结果测量和进度轨道。detail external directory 预期同步到 full-viewport manga owner；普通文本目录仍由 App 保持单一 safe-top owner。

## 明确证据边界

这里是源码、方法与 SDK Builder 输出证据，不是 HAP、VM／真机可见渲染、原生虚拟 List 测量或用户验收。主线未合并，旧 demo 未改写。

“整卷可读”专门事实字段未由当前 Core 目录提供，因此生产 UI 不依据标题含“卷”或任意 target 伪造该标签。已准备保留三类目录语言，但整卷标签须在可靠来源／格式事实可投影时接入。
