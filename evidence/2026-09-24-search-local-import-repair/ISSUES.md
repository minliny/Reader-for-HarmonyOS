# 搜索与本地导入路线问题总账（2026-09-24）

本轮基线：Harmony `codex/appearance-progress-axis-20260904` / `be940f2268f3`，Core `codex/ph112-remote-position-open-cost` / `d2c63cd6913d`。审计对象是当时的当前源码；以下修复工作树在基线上继续演进，最终身份以本轮构建 manifest 为准。未使用旧 HAP 或旧设备结果证明这些问题已修复。

| ID | 现象与触发条件 | 代码侧定位及证据 | 当前结论 | 未决点 |
|---|---|---|---|---|
| SLI-01 | 搜索命中的本地书不在当前 48 本书架窗口时，详情显示未加入书架、目录为空，“加入书架”按钮无效 | `Index.ets:onSearchResultSelected` 原先仅查 `shelfBooks`；`SearchGateway.searchLocalBooks` 查询全部本地书；`openLocalBookDetail` 才会读取本地目录 | **代码/本地回归已修复**：使用已发布的完整书架身份，必要时以 `bookshelf.get` 精确查询；缺失、读取失败和旧导航结果不制造错误详情 | HAP 已构建验证；设备交互与用户验收未执行 |
| SLI-02 | 没有可用在线书源时搜索初始页缺少添加/启用入口；书源列表读取失败也可能停留在普通初始页 | `SearchOrchestrator.entryPresentationForSources` 原先总返回 `undefined`；`SearchPage` 的 `sourceRequired` 与 `sourceLoadError` UI 已有入口但不可达 | **代码/本地回归已修复**：空、全禁用和仅非文本书源显示管理入口；加载失败显示重试；本地搜索框和最近搜索仍可用 | HAP 已构建验证；设备交互与用户验收未执行 |
| SLI-03 | 文件提供方忽略后缀过滤并返回 `.html` 等未准入文件时，选择器路线仍暂存并尝试导入 | `ReaderHostRegistry.selectLocalBookInputs` 原先只依赖 picker 过滤；系统文件打开路线已用 `isReaderLocalBookFileName` 逐项检查；Core 会把普通 HTML 文本当作 TXT 解析 | **代码/本地回归已修复**：复用格式准入函数逐项拒绝，未准入文件不暂存，混合批次保留合法文件 | HAP 已构建验证；文件提供方设备行为与用户验收未执行 |
| SLI-04 | 每次本地搜索查询及跨 Core/Host 边界传输整张混合书架，规模增长后延迟和内存成本随之增长 | `SearchGateway.searchLocalBooks` 原先调用 `bookshelf.list {}`；Core 空参数明确是全书架 Full DTO；Core 已有 `sourceKind`、`keyword`、分页能力，但 SQLite `lower()` 与 Host Unicode 小写语义不完全相同 | **代码/本地回归已修复**：当前 Core 仅查询本地书，每页最多 128 条；安全汉字段下推，无安全汉字段时用轻量身份页筛选，低命中逐项读取完整 DTO，高命中改用同页完整 DTO；首尾修订校验和有界重试；旧 Core 保留原行为 | 无安全汉字段的查询仍须扫描全部本地标题/作者以保持 Unicode 匹配；Core 分页重复计数和 `OFFSET` 成本、设备规模下耗时均未量测 |

## 提交后独立复查

对 Harmony `4472d425b4eddf53a250a47ba5122c046d1ea967` 的独立代码复查继续发现下列问题；以下代码修正均须以本轮最终提交及新 manifest 重新验证。

| ID | 现象与触发条件 | 代码侧定位及证据 | 当前结论 | 未决点 |
|---|---|---|---|---|
| SLI-05 | 从可用书源的搜索初始页进入书源管理，禁用全部书源后返回，页面仍显示普通初始态，没有管理入口 | `SearchOrchestrator.refreshSources()` 成功回调只重算 `sourceRequired/sourceLoadError`，遗漏 `initial` | 已补 `initial` 回跳状态重算及回归；Harmony 全量合同通过 | 设备交互与用户验收未执行 |
| SLI-06 | 搜索命中离屏本地书且书架身份来自 `membershipOnly` 投影时，详情缺失封面、简介等完整书架元数据 | `Index.onSearchResultSelected` 把稀疏身份记录直接传给 `openLocalBookDetail`；Core 的 membership 投影有意省略这些字段 | 已改为准确 `bookshelf.get` 读取完整 DTO 后打开，并覆盖稀疏投影回归；Harmony 全量合同通过 | 设备交互与用户验收未执行 |
| SLI-07 | 搜索初始加载与从书源管理返回的重新加载乱序时，旧请求的失败可覆盖新成功状态 | `SearchOrchestrator.open/refreshSources/retrySourceLoad` 回调只检查 session，没有检查其请求是否仍是当前 source load | 已补请求身份检查及晚到失败回归；Harmony 全量合同通过 | 设备时序未复现 |
| SLI-08 | 停止或提交新搜索后，旧大书架本地查询仍持续翻页占用 Core/Host 资源 | `SearchOrchestrator.performSearch` 未向 `searchLocalBooks` 传工作有效性，`SearchGateway` 页间只让出事件循环 | 已向本地请求传工作有效性与 `shouldCancel`，并在页间、补全详情前后检查；stop→新查询回归及 Harmony 全量合同通过 | 设备规模下耗时未量测 |

## 证据层

- 代码侧：四条调用链和触发条件已复核；不更改 Core 持久数据或导入内容。对离屏本地书还覆盖 Core 查找失败、书已移除、导航晚到和下一结果已选中的竞态。
- 本地回归：`test-search-shelf-identity.mjs`、`test-reader-direct-entry-recovery.mjs`、`test-reader-host-selection-boundary.mjs`、`test-search-orchestrator.mjs`、`test-search-history-layout-lifecycle.mjs` 均通过；Harmony 全量合同 **365/365** 通过。Core 全量测试 **4141/4141** 通过、5 项跳过，协议 conformance **210/210** 通过。
- 门禁问题记录：首次沙箱运行在模拟 WebDAV 本机端口绑定处报 `PermissionDenied`；允许本机测试端口后 Core 全量通过，但系统 Git 因 Xcode 许可状态退出。设置已安装的 Command Line Tools 后继续执行，发现旧 `test-reader-direct-entry-recovery.mjs` 仍断言 SLI-01 的错误详情行为；更新为正常本地目录和书架身份断言后，Harmony 全量合同通过。复查修正 SLI-06 后，同一旧测试又断言离屏详情同步打开；改为等待完整 Core 记录后重新执行，Harmony 全量合同 **365/365** 通过。以上失败均保留在本记录，不作为应用运行成功证据。
- 构建/签名：`hap-pipeline.mjs build --class iteration --signing local` 完成合同、ArkTS 类型检查、非增量构建、内置书源字节与签名校验；manifest `.reader-artifacts/hap/20260923T162044Z-be940f22-ab6feec4/manifest.json`，源码 fingerprint `ab6feec48e488de49662f6a542165f71e67d889e1f5e4a92e095a066e5df73db`；signed debug HAP SHA-256 `9b65077b8e83df9f5bdb69c6d18d856b4ad55df338a4fc3a2572d5f83521f6f8`，`verify` PASS。此为 dirty 源码快照的 iteration 产物，`acceptanceEligible=false`。
- VM、真机、功能交互、用户验收：均为 `OPEN`；本轮未执行 HDC、安装或启动，也不自动重新占用设备。当前源码足以定位并修复四项问题，设备操作不能替代代码验收。
