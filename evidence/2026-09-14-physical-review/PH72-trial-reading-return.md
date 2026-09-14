# PH72：换源后的试读返回链

2026-09-14。范围为 PH72 和 PH74 的导航对照部分，沿 P0 搜索/详情/阅读主流程、P1 多源恢复检查。使用 `reader-legado-harmony-stage-audit` 领域流程；Legado 仅用于产品语义对照，没有复制 GPL 实现。

## 现象与版本

用户完整路径为：搜索《鸣龙》（关关公子）→ 首源“66书吧-起点”目录失败 → 留在详情 → 更换书源 → 第二源成功 → 未加入书架直接阅读 → 退出后到书架，原详情/搜索动线丢失。第二源名称及响应未提供；本报告不猜测源身份，也不归因目录解析错误或正文内容。

最后确认安装的包为 `84cdc4ef`；本轮 PH60/67 的 `e39667ad` 包尚未安装。审计开始当前 Harmony HEAD 为 `29d1bb4a`，本次补丁前 HEAD 为 `71f431bd`（后续交付记录提交）；相关缺陷在两者及 `84cdc4ef` 一致。Core 为 `bf3e2682`；Legado 为 `6763d061bc92b2164ac274363a807e4ed4be34e2`。完整源码/测试哈希见 [receipt.json](ph72-trial-return/receipt.json)。

## 确定根因

1. `Index.ets:2341 onSearchResultSelected` 把结果作为详情预览打开，`resumeImmediately=false`。`openRemoteBookDetail` 原本根据进入前的 `route` 设置 `detailReturnRoute`：从 search 进入设 search，否则一律 bookshelf。
2. 首源准入失败后，`openRemoteBookDetail` 的失败分支保留 detail、元数据和错误，不自动入书架，原 `detailReturnRoute='search'` 此时仍正确。
3. `onPickSource`（现行约 4258）遇到 `!detailInBookshelf && !readingSessionActive` 走 `switchPreviewSource`。这是用户所述详情换源实际分支：它获取目标详情/目录并探测正文，不进入 `pendingSourceSwitch` 或 Core 换源交易。
4. `switchPreviewSource` 成功后又调用 `openRemoteBookDetail`。此时 `route='detail'`，旧实现便把 `detailReturnRoute='search'` 改成 `bookshelf`。它把“同一个预览换了源”误判为“新建一个来自书架的详情”。
5. `returnFromDetail` 随后执行 `returnToBookshelf`，关闭原搜索队列；再次从书架打开搜索调用 `openSearch`，会重置 SearchViewState。搜索结果丢失不是 SearchViewState 本身的存储错误，而是进入了错误的退出分支。

普通未换源的 search → detail → reading → detail → search 生产方法测试在修前已通过。不能把所有试读入口都称为错误，也不能把这次故障归因于 Core 换源交易。

## 实施结果与约束

只改 `entry/src/main/ets/pages/Index.ets` 两个方法：

- `switchPreviewSource:4340` 在第一次 await 前捕获当前 `detailReturnRoute`；只有现有 `isCurrent()` 准入仍成立时，才传给目标详情。
- `openRemoteBookDetail:2505` 新增可选 `retainedDetailReturnRoute` 参数。预览换源显式沿用原父页面；普通搜索、书架续读、书架信息等调用不传，保持原有入口语义。
- `readingOriginRoute` 仍为 detail：试读返回已准入的详情，不丢弃当前目标源的详情、目录和会话。详情再返回原搜索；用户可以先试读，再通过详情原有“加入书架”决定是否加入。
- 不改 Core 命令、书架成员状态、阅读锚点、进度持久化、换源事务或 SearchViewState；不增加导航栈/第二业务引擎，也不自动加入书架。
- 不用“凡是 route=detail 就沿用旧值”的全局推断。只有明确的同一预览换源调用传参，避免后续打开不相关书籍继承旧搜索来源。
- 旧请求迟到成功/失败仍受原 navigation generation 约束，不能把捕获的旧返回目标发布到已离开的页面。

这项补丁不删除缓存，也不更改既有实际阅读进度提交。Core/Host 串行退出、保存失败仍停留阅读页并可重试的已有规则保留。

## Legado 当前实现对照

| 能力 | Legado 代码与行为 | Harmony 对应与本次结果 |
|---|---|---|
| 搜索进入详情 | `ui/book/search/SearchActivity.kt:493 showBookInfo` 启动 BookInfoActivity，没有结束搜索页或清任务栈 | Index 保留 SearchViewState 与 SearchPresentation；返回时使用既有 orchestrator.resume，不重新搜索 |
| 详情进入试读 | `ui/book/info/BookInfoActivity.kt:1472 readBook` 标记 notShelf，`1487 startReadActivity` 通过 ActivityResult 启动阅读页，保留详情 | 未入架预览仍复用现有 ReaderShell/ReadingExperience；没有新增自动入架 |
| 试读返回 | `ui/book/read/ReadBookActivity.kt:2670 finish` 完成退出/按配置询问加入，然后结束阅读 Activity；`BookInfoActivity.kt:167` 接回结果，普通返回不会结束详情 | 当前普通退出 `onReaderExited→returnToReadingOrigin` 回 detail；本次恢复换源后详情的 search 父页面 |
| 显式加入 | `BookInfoActivity.kt:1055` 的书架按钮、`BookInfoViewModel.kt:538 addToBookshelf` 单独处理成员状态 | `Index.ets:3047 requestDetailShelfMutation→addDetailBook` 单独进行 upsert；本次不修改 |
| 预览换源 | `BookInfoActivity.kt:1537 changeTo` 调用 ViewModel；`BookInfoViewModel.kt:457 changeTo` 在同一详情中更新书/目录，仅 inBookshelf 时执行书架数据替换，不创建新的来源页面 | 原 Harmony 重新打开详情丢掉父页面；本次传递已捕获父页面，效果仍是同一预览更新来源 |

Legado 的 notShelf 行存储、退出删除和“是否询问加入”属于其独立实现；没有把其删除书籍策略或弹窗规则搬到 Reader。本轮用户要求是默认不自动入书架，退出试读可回详情再决定，已按 Reader 现有显式按钮实现该动线。

## 本地生产方法证据

新增 `tools/test-search-trial-reading-return.mjs`，通过项目 SDK parser 抽取、执行 Index 原始方法，未重写路由算法。替身只替代传输/Core 服务、搜索调度和提示，不使用网络或设备。

同一套 9 个用例：

1. 首源正常：搜索 → 详情 → 试读 → 同一详情 → 原搜索。
2. 首源 TOC 失败 → 详情换源 → 目标成功 → 试读 → 详情 → 原搜索。
3. 连续更换两次预览源，父页面保持原搜索。
4. 首源迟到失败，不覆盖新目标详情及父页面。
5. 换源过程中离开，目标迟到成功不能重开详情。
6. 换源过程中离开，目标迟到失败不能覆盖新页面。
7. 当前目标换源失败，保留原详情、会话和 search 父页面。
8. 书架直接续读仍回书架。
9. 书架显式信息 → 阅读仍回详情，再回书架。

第 2/3/4 项在 `84cdc4ef`、改前 `71f431bd` 均稳定红：期望 search，实际 bookshelf；其余 6 项通过。修后 9/9 通过。

测试还断言保留同一 SearchPresentation、SearchViewState、关键词、类别、展开状态、锚点索引/偏移/位置与稳定顺序；不调用 search.open/search.search，不执行 shelf.upsert/source-switch.commit。普通阅读退出时详情、目录和 remoteSession 对象保留。

已有针对性回归均通过：`test-bookshelf-reading-entry`（含实际 Panel→LRE→Shell→Index 退出接线、停止/记录/进度屏障、保存失败重试）、`test-search-view-state`、`test-search-detail-cache-first`、`test-source-switch-transaction`、`test-source-switch-gateway`。日志全部在 [ph72-trial-return](ph72-trial-return/receipt.json)，新 test 文件会被 `scripts/check-local.sh` 自动纳入正式门禁。

## 尚未证明的范围

- 上述红例证明“换源后详情返回父页面被覆写”，并解释搜索链丢失。对于已经稳定显示正文时仅一次退出便直接落书架，当前生产方法的 `onReaderExited` 仍先回 detail；没有复现用户动作序列是否包含第二次返回，也没有认定用户记错。不能把此补丁写成已解释那一帧的直接跳转。
- 这次没有 HAP 构建、安装、VM、真机或人工验收。源码/SDK 方法通过不等于设备导航或像素通过。
- 源目录失败、换源候选复用、正文转义字符与搜索卡顿由 PH68–71/73 单独审计，不在本导航补丁中宣称解决。

生产及测试已冻结；后续统一 ArkTS/HAP 门禁由根任务执行。本文件不修改总账，也不改变已经批准的其他主题/书架实现。
