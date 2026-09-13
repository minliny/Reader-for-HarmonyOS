# 远程 TOC 当前源码审计与完整修复规格

日期：2026-09-13。只读审计和临时本地生产方法探针；没有修改生产源码、没有提交、没有操作 VM/真机。

## 基线与结论边界

- Harmony HEAD：`50cad401ffc6d235f4ac388136ee5213b9b736ad`，工作树包含既有未提交修改；本次审计按实际工作树，不按 HEAD 原文。
- Core 起始 HEAD：`e0e4b550bcffd3b959d7b90fa599c1df713f479e`，已有 reader-local-book 等平行修改。根 agent 正整理提交，不把并行提交当作本探针新增修复。
- 相关输入 SHA-256：`harmony-source-sha256.txt`、`core-source-sha256.txt`。
- 已用当前生产代码本地复现两类缺陷：TOC 缺 bookUrl 上下文；有持久目录但缺新 acquisition 字段的旧行跳过缓存。
- 不能把两类缺陷说成已经解释用户全部失败书源。历史反馈没有绑定具体 sourceId、ruleVersion、响应快照和请求回执，不能从一个通用错误反推每个现场根因。

## 当前实际调用链，纠正此前错误口径

1. 搜索结果点击：`Index.ets:onSearchResultSelected` 保留点击的 `(sourceId, bookId)`，给精确命中的书架行传 `shelfSnapshot`；不会自动选择另一个同名源。
2. `openRemoteBookDetail` 先挂详情/保留书架准备态；已入架时复用同身份会话，或 `openCachedCatalogSession`；缓存异常才回 `openSession`。
3. 非书架入口通过 `BookAcquisitionCoordinator.acquireBookWithBackgroundRefresh`，主任务以 `(sourceId, bookId, sourceVersion)` 去重；同一书的搜索预取、详情和换源加入同一任务；不是从零缺少缓存/身份机制。
4. Coordinator 的 `openBook` 读取 `search-book.get` 的 acquisition 和 variables；只有 sourceVersion 相同、variables 可解码、catalogAt 存在且不超过 24 小时时才尝试持久目录；否则执行网络详情+TOC。
5. `RemoteReadingFlowGateway.openSession`：`book.detail` → 检查 sourceId/bookId → 读取 tocUrl → 合并搜索/详情 continuation variables → `book.toc` → 检查身份/连续 index/非空 title/url；数组为空才抛确切英文错误。
6. Core `remote.rs:book_toc` 冻结规则版本，产生 HTTP/Host continuation；实际 finalUrl 进入 `book_toc_from_params`；`toc_with_next` 调现有 Reader 规则管线和 QuickJS；分页聚合后 `finish_toc_result` 统一重编连续 index 并发布。
7. Core 持久 TOC 使用时间戳 envelope，读取同时兼容 envelope 和旧裸数组；空 TOC 不覆盖旧非空目录，书目写锁+源版本/启动时序保护仍存在。
8. 章节通过 `loadChapter → chapter.content`，Core 缓存优先；前置正文可读性检查与 TOC 非空是两个门禁，不能把 TOC 成功当正文可读。
9. 换源 `SourceSwitchGateway.fetchTargetToc`/`Index.loadSourceSwitchCurrentToc` 也用同一 Coordinator；匹配章节、候选验证、事务提交和首屏确认仍需保持原源位置和回滚。

## 已确诊缺口及复现

### T1：TOC 标准 bookUrl 上下文缺失，可令正常章节规则返回空

- `Core/crates/reader-runtime/src/remote.rs:1637` 的 `toc_with_next` 仅收 current_url 和 variables，创建 context 后只写 current_url，没有把 `BookTocParams.book_id` 注入 `context.book_url`。
- `reader-content/src/lib.rs:234` 的 context 默认 book_url 为空；JS bridge 仅在非空时注入 globalThis.bookUrl（1586）；detail 导出 continuation 时 `user_variables` 又删除 bookUrl（4114）。因此不能指望 continuation 自动补回来。
- 临时探针直接调用当前 `dispatch_remote("book.toc",...)`，HTML 均为 `<a href='/chapter/1'>Chapter one</a>`，bookId 是 `/book/1` 的绝对 URL，tocUrl 是 `/toc/1` 的绝对 URL。
- 规则条件依赖正确 bookUrl 时，Core Result 的 toc=[]；只换成依赖正确 baseUrl 的正对照时，返回 1 章。原始输出：`core-probe.log`；源码 `src/main.rs`。这是实际 Core 缺陷，不是单纯代码猜测。
- 该探针使用受控本地规则，证明缺陷类别存在；未证明用户哪几个源属于此类别。

### T2：旧 acquisition 元数据阻止持久目录准入

- `BookAcquisitionCoordinator.ts:241` 将 durable TOC 准入绑到 acquisition.sourceVersion/catalogAt/24 小时。
- `legacy-cache.mjs` 注入一个 `cache.book.status` 可返回完整非空 TOC 的当前生产 Coordinator，search-book 行是无 acquisition 的旧数据。真实调用序列却为 source.list → search-book.get → book.detail → book.toc；没有 cache.book.status，远程空返回后 emptyToc。
- 这不意味着所有书架点击都走坏路径：已命中内存 shelfSnapshot 的页面有更直接缓存路径。受影响入口包括 search 预准备/普通 Coordinator/换源、未命中当前内存书架投影时的打开；必须在精确持久事实处判断书架身份，不能只依赖页面内存是否已有该行。
- 对 catalogAt 过期的组合也有相同结构问题；24 小时仅应决定后台刷新，不应剥夺已有非空目录的阅读资格。

### T3：缓存错误全部被吞，掩盖真正故障并触发无意义网络请求

- Index.ets:2486 的 `.catch(() => gateway.openSession(...))`，Coordinator openBook:246 的 catch-all 把取消、identityMismatch、连续 index 错误、storage 错误都当作普通缓存未命中。
- 因此之后的空 TOC 可能只是二次失败，第一次缓存故障完全丢失。只能对明确的缺失/可重建派生损坏进入恢复分支；取消、身份错配、规则版本变动、存储不可用须保留分类和原始 cause。
- Index 在读取持久目录前先要求书源仍存在。删源后虽然保留书架/缓存，页面入口仍可能阻止缓存阅读；这属于同一路径的附加缺口，不能通过重新添加书源作为唯一恢复。

### T4：新增 diagnostic 是死字段，尚未形成诊断闭环

- RemoteReadingContract 和 RemoteReadingFlowGateway 的既有未提交改动增加 sourceId/bookId/tocUrl/returnedEntryCount；当前全树检索只有定义/赋值，没有读取/记录/关联请求的消费方。
- Index catch 仅记 error.message 和 admission 耗时，然后统一设 parseFailed；prepareOne 也只持久 message。返回类型/HTTP 状态/finalUrl/缓存准入原因/规则版本/提取数量没有关联起来。
- 不能再说“诊断已完成”或“需要等设备日志”。应先复用当前 requestId、SourceHttpDiagnostic/规则回放设施，在 Core/Host/Coordinator 之间保留同一 trace identity。

### T5：空结果原因和可读章节语义不充分

- Core `toc_book_source` 中正则 list 编译错误有转空分支；原始规则 JSON 解析错误按兼容语义转空；无规则/零匹配也最终返回空。错误页面 HTML 被 JSON 规则处理后可能与真正无章节不可区分。
- 不能简单删除兼容逻辑：保留现有外部语义时增加结构化失败原因/提取计数；规则错误和响应格式不符不得再仅靠同一英文提示判断。
- Core 当前保留有标题无 URL 的目录卷标题等条目；Harmony `decodeToc` 对所有行要求非空 URL。此类结果会报 invalidResponse（不是 exact emptyToc）；也需统一“目录条目”和“可读章节”的区分，禁止把整本合法卷标题目录判坏。
- 空首个目录页当前跳过 nextTocUrl；需以受控空第一页+后续有效页语料确定有限继续策略，保留周期检测、请求/耗时/页数限制，不能为避免成本把后页全丢。

## 旧问题排除

- envelope map/array 不一致：当前已兼容两种格式，bookshelf.list 也使用统一 reader；禁止再把它列为当前已确诊根因。
- 650ms 同名源抢先赢：当前搜索选中身份固定，不再有旧页面 hedge 路径；禁止拿旧记忆说当前自动换源。
- EPUB 大章遗漏：本地 `local-book.toc` 和远程 `book.toc` 分路，当前本地使用 spine 内容清单和 required read 失败传播；不能作为远程英文错误的直接候选根因。仍可独立做本地格式回归。

## 完整实施规格

### A. 上下文修复

1. 在 Core 统一构造 detail/TOC/content 的业务上下文，明确 sourceId、bookId/真实 detailUrl、tocUrl/currentUrl、chapterUrl、book metadata、continuation variables 的来源和优先级。
2. 至少将当前 BookTocParams.bookId 送到 toc_with_next 的 context.book_url；首目录页与后续目录页使用同一 canonical book 身份，current_url 单独随重定向/分页更新。
3. 章节规则路径同步检查 book/chapter 对象的真实值，不能靠默认空对象冒充；若需要新增合同字段，必须同时更新 contract/fixture/Harmony binding，不能直接在 UI 塞未声明字段。
4. continuation 用户变量允许其业务值流转，source/book/chapter 身份等内建上下文由 Core 注入，不允许用户变量无意覆盖。
5. 复用现有规则引擎、QuickJS、URL 解析和缓存，不建立第二套 TOC 解析器。

### B. 缓存准入和恢复

1. 所有入口统一先查询当前 Core 书架身份/非空持久目录；禁止 UI 内存 shelfBooks 是否已加载成为唯一开关。
2. 目录有效但 acquisition 字段缺失/过期：允许用缓存目录打开；补齐派生 acquisition 元数据可后台做，不能要求在线详情成功才能阅读。
3. 当前规则同版本：目录/章节变量可用于缺失正文联网。旧版本/无法判定版本：保留已缓存正文可读，联网前用当前规则重取需要的上下文，不混用旧 continuation。
4. 删源/停源：已有目录和正文仍可离线阅读；缺正文明确提示不可联网；不改变书架、进度、书签。
5. 缓存缺失：一次受控同源在线获取；缓存派生损坏：记录原因并受控重建，保留书架/进度；存储不可用/取消/身份错配：不伪装 miss，不自动重试其他源。
6. 在线空目录：不覆盖旧非空目录/正文/进度；有安全旧缓存时保留可读状态并提示刷新失败；无缓存时保留可操作详情、错误类别、重试当前源和用户主动换源入口。
7. 后台刷新不能清空当前 visible TOC/重置滚动；活动阅读页不被迟到目录替换。结果使用 sourceVersion + generation + initiatedAt 保护发布，继续使用既有去重调度。

### C. 错误与诊断

1. 统一分类：CACHE_MISSING / CACHE_DERIVED_CORRUPT / STORAGE_FAILURE / CANCELLED / IDENTITY_MISMATCH / SOURCE_VERSION_CHANGED / SOURCE_HTTP_FAILED / SOURCE_RESPONSE_FORMAT / SOURCE_RULE_FAILED / SOURCE_TOC_EMPTY / SOURCE_CONTENT_EMPTY。
2. 记录 attemptId/requestId、匿名化 source/book 身份、规则版本/hash、入口、cacheDecision、stage、HTTP status、response类型/长度、finalUrl摘要、列表原始数量/最终可读数量、失败类别/耗时；不把完整含令牌 URL、cookie、变量、正文公开入日志。
3. 受控本地复放材料单独保存来源/规则快照/响应 hash，验证时才读取原始内容。diagnostic 从 error 传到 ledger/呈现层，不再只拼 message。
4. 不修改书源健康状态来掩盖 Reader 上下文错误；同源失败不静默换别源，不将空目录写成“书源正常但无章节”的永久事实。

### D. 目录行与可读项

1. 合同明确卷标题/非跳转行与可读章节；稳定保存源目录顺序/身份，显示卷标题但禁跳转，不因一行无 URL 拒整本书。
2. 只有可读项数量为 0 才做 empty-readable-catalog 分类；章节 index 与进度引用必须统一迁移，不可由 UI 过滤后私自重编。
3. 空第一页且有 nextUrl 的合法目录继续有限分页；在总预算、去重、周期/最大页数门禁内完成，错误/取消时不发布残缺目录覆盖旧有效目录。

## 必须满足的验证门禁

本次已运行三个既有生产方法 Node 回归全部通过：acquisition-tests.log、remote-runtime-tests.log、offline-gateway-tests.log。它们不覆盖本次新缺陷；两个新临时探针已复现缺陷，修复后须转成失败转成功的正式回归。

1. T1 探针：bookUrl/baseUrl 两个版本都解析出同一章；含 book 对象/continuation/重定向/第二页的 fixture 证明身份和 currentUrl 分离正确。
2. 持久非空目录 × 新版/旧版/缺失/过期 acquisition，全部缓存先行；至少无额外 book.detail/book.toc；旧规则变量不参与新规则网络请求。
3. 搜索点击、搜索预取、详情重入、书架点击、换源候选五入口对同一 source+book 使用相同身份；同名异源不能串；sourceVersion 变动不能复用旧网络任务。
4. 缓存 miss/损坏/存储故障/取消/身份错配分别注入，断言只有允许分支联网；第一次错误 cause 保留。
5. 冷重启 SQLite 旧裸数组/envelope 两种目录均可读；删除书源仍能打开已缓存正文；目录/进度/书签不丢失。
6. 旧非空目录后在线空/HTTP 错误/无效 JSON/规则失败/迟到旧响应，不能覆盖旧有效目录；UI 保持可操作，无白屏。
7. 有卷标题、无 URL 行、首个空目录页、第二页有效、循环 nextUrl、取消和预算耗尽组合，检验完整性/可读性/顺序/index 语义。
8. 动态日志验证 trace 贯通且敏感字段脱敏；diagnostic 的所有分支有消费者，不再只测试字段存在。
9. 真实失败源验收需要可重放的失败样本：绑定 sourceId+ruleVersion、点击书身份、请求链、响应；在代码侧重放后逐个确认修复效果。当前没有足够证据统计现场频次，不能宣称出现一次或仅一个源。
10. 此后才生成 manifest 绑定 HAP，进行 VM 的入口/缓存/错误恢复行为验证；本次没有设备结论。真机只在代码/本地证据无法回答具体剩余问题时申请最小范围取证。

## 不再需要用户决定的内容

无新产品决策：缓存保留、同源身份、手动换源、错误可恢复、进度保护均由已有要求约束。这里剩余的真实线上失败样本归因是证据门禁，不能把它写成“用户需要决定是否回退/重新解析”。

## 产物索引

- `legacy-cache.mjs` / `legacy-cache.log`：当前 Harmony Coordinator 的旧数据缓存绕过复现。
- `src/main.rs` / `Cargo.toml` / `Cargo.lock` / `core-probe.log`：以当前 Core 和项目已有 patched rquickjs 构建的 bookUrl 缺失与 baseUrl 正对照；首次临时构建缺 root patch 导致离线解包错误，添加同一 root patch 后完成，非产品测试失败。
- 三份 `*-tests.log`：本轮既有方法回归。
- 两份 `*-source-sha256.txt`：审计输入身份。
