# 《鸣龙》搜索、分组、候选与换源只读审计

审计时间：2026-09-15。Harmony 当前提交 3843792a；本子任务未修改生产文件、未 HDC、未提交。

## 版本先分开

最后真机交付记录：`.reader-artifacts/hap/20260914T154527Z-1d1f47e5-41357e27/manifest.json`，Harmony `1d1f47e5be4ca57ace8d8028551fef6e627932e6`、Core `61a2f86e7287fb276757706ba436a8103dcb3d37`，dirty=false。这是交付记录，不能当作此刻真机包的实时读取结果。

已使用 `git show` 读取旧版本，不能拿当前代码直接解释旧包：

- 旧 SearchPage.ets:351 为 `@Prop @Watch('refreshVisibleResults') presentation: SearchPresentation`，每次父层发布会递归复制结果对象，破坏按对象身份更新的增量路径。修复为 SearchPublication 常驻 owner + 数值 revision 的 `3143b85a` 在旧包之后。当前 `SearchPage.ets:266–272,328–331`、`SearchPublication.ts:4–15`。
- 旧 Core runtime.rs:451–454 为每 worker 独立队列，:645–646 为 round-robin 投递。慢 worker 后面排队的书源无法被其他空闲 worker 接管。当前共享 FIFO 在 `28369db94`，也在旧包之后；当前 runtime.rs:450–470、:725–730。
- ReaderSourceCategory、SearchGateway、SearchResultProjection、SourceSwitchGateway 在 `git diff 1d1f47e5..HEAD -- <这些路径>` 无差异；这些部分可以确认旧包和当前审计一致。

## 已确认的现存工程问题 / 能解释的范围

### A. 搜索“发现”没有等于正文可读，自动候选尝试有明显上限

`app/BookAcquisitionCoordinator.ts:178–189` 仅为可见最多 6 组预取目录，明确 never fetch bodies；`pages/Index.ets:2387–2397` 接入同一规则。

`BookAcquisitionCoordinator.ts:201–225`：按目录成功/未知/失败排序；已失败候选默认跳过；最多尝试 3 个未知候选，任一取得 detail+TOC 就返回。第 4 个未知候选即使可以解析，也不会被本次自动尝试。`:228–230` 对任意 capability 或 unsupportedHostCapability 错误终止整组，而非继续独立的下一书源。

本次重跑 `tools/test-search-candidate-acquisition.mjs` 16 项生产方法探针通过，恰好证明上述当前行为，包括“仅 selected body probe”“能力失败停止组”“最多 3 未知”。这些测试通过不能证明用户要求的所有候选已经可读。

影响：可以解释“列表有许多源，进详情仍失败；明明手动选择后面的源能读”。正文失败是否自动换下一个由 root 审计 Index 的 body probe，不能只依据本文件宣布已闭环。

### B. 换源主动搜索仍有批屏障，空闲额度浪费

`features/source/SourceSwitchGateway.ts:17` 并发常量实际 **8**；`:429–443` 每批 await Promise.all，整批结束才启动下一批。实际生产 `discoverCandidates` 离线 probe 已复现：9 个源，第 1 个挂起，第 2–8 个完成，第 9 个仍未发出；释放第 1 个后才发出第 9 个。

探针 `/private/tmp/minglong-search-probe.mjs`：只替换边界 `discoverFromSource` 为可控 promise，实际遍历和调度代码原样执行。不是设备性能结果。

影响空缓存补搜、主动刷新。普通搜索 `SearchOrchestrator.ets:671–696` 是连续取源 worker，没有这个每批屏障。

### C. Host 为前台保留槽，不等于 Core 保留前台执行能力

`app/BookRequestScheduler.ts:124–137` 总计 6、非前台最多 5，允许前台入 Core；但 Core `runtime.rs:62,450–470,899–910` 为 4 个共享 source worker，搜索/detail/TOC/正文及正常 host completion 共用 FIFO，没有前台优先字段/执行保留位。

需要准确限制结论：`host_callback_bridge.rs:24–37,131–148` 证实 **JS 内 java.get/ajax 等** 同步等待会占 worker；普通非 JS HTTP 是 continuation，不保持 worker。故“四个 JS 型慢源同时等 HTTP 时，前台虽然已从 Host 派发，却仍在 Core 排队”是代码成立的竞争风险；没有本次《鸣龙》真机 trace，不能说它必然占满了四条或量化其时间。共享 FIFO 只修复空闲 worker 无法接管，不解决所有 worker 均忙。

## 不应重复声称为当前未实现的部分

### 换源列表复用已经接入

`pages/Index.ets:2424–2428` 保留点击时同书候选和源身份；`:4267–4269` 立即展示 known；`:4320–4327` 默认读缓存，有候选即返回，不重搜；只有空缓存才补查尚未搜索过的源。主动刷新明确走 refreshCandidates。

`SourceSwitchGateway.ts:201–274` 读取同书已持久化候选，校验源版本并补入尚未持久化的本次搜索候选；`:277–340` `search-book.related` 基于源身份/书名作者读取数据库关系闭包，不是源 HTTP。`Index:4273–4313` 串行归并变更，避免初始慢快照覆盖新候选。

因此“点击换源必然重新全搜、完全不复用搜索结果”不符合当前或旧 1d1f 的实现。若用户仍见此现象，需核对具体是否点击了刷新、缓存被判不一致/为空，或等待的是缓存 RPC 排队。

### 百度图片明确元数据已经挡在小说搜索前

`ReaderSourceCategory.ts:30–54`：非文本类型权威拒绝，type0 仍识别名称/分组的“图片/图库/图集/壁纸”等。`SearchOrchestrator.ets:651–653` 仅 enabled + novel；`SearchGateway.ts:180–182` 再拒绝非 novel。

本次实际 classify probe：`{type:0,name:'百度图片（优）'}`→other；`{type:0,name:'默认',baseUrl:'https://image.baidu.com/'}`→novel。这是**源元数据分类**，没有单条结果的内容类型校验；不能只看到百度图片域名就误封普通小说使用的图片 CDN。当前只凭用户现象不能确认到底哪个源导入属性、旧版本或响应结构漏了。

`tools/test-reader-source-category.mjs` 本次 PASS：随包 1046 源分类 novel875/comic107/music22/download25/other3/external14，不代表用户实际启用列表是同一版本/同一组，也不代表875源全部可读。

## 分组/排序审计：可证明的规则与风险

- `SearchGateway.ts:361–374` 保留源 id + 原始书籍 URL；标题必须非空、作者允许空。初始 groupKey 是书名作者 trim + 折叠空白 + 小写。
- `SearchResultProjection.ts:39–41,79–83,127–150` 按 Core groupKey 或规范化书名+作者分组，保留每个源候选。优先标题/作者相关度，同分再比较实际 acquisition 等级，平分保持原加入次序。`SearchResultRelevance.ts:3–13` 精确书名优先，其次作者/前缀/包含；不删除无关结果，分数5排在末尾。
- Core `reader-storage/src/sqlite_backend/scoped_search.rs:28–58,182–200` 以规范化书名/作者及 detail 证实的历史别名建立关系闭包，保留最多16别名，SQLite索引遍历。不是按书名就把所有作者粗暴合并。
- **条件风险**：两份错误结果同名且作者都空会合并；有的书源作者写“作者：关关公子”、另一个“关关公子”，或繁简/标点不同，初始不会合并，只有详情校正到同一名字或已记录别名后才可能合并。未保留用户此次原始候选，不能断言《鸣龙》具体错误合并发生在哪两条。
- 排序没有“66书吧”硬编码或站名优先：同分同验证等级按返回次序。它先被选中可由该源先返回解释，但只能拿具体返回序列核实，不能说已经找到用户那次默认选择的唯一原因。
- `BookAcquisitionPresentation.ts:19–38` 整书失败仅 detail/catalog 范围；某章失败不令整书失败。这保护正确书源其他章节，但也意味着一个正文有问题的目录成功候选仍可能作为 rank1 保留。应补目标章节层面的选择/回退，不能简单将其全部永久拉黑。

## 本地验证与边界

本轮读取了当前及旧真机提交，执行以下现有生产探针，均 exit0：

- `tools/test-search-gateway.mjs`：1000 当前查询 + 9000无关缓存只读取实际变更1条；源分区失败隔离、关系分页、稳定合并/拆分 PASS。
- `tools/test-search-view-state.mjs`：4000保留行+1新增/修改，exact title晚到排序、稳定平分、元数据变更1条更新、读写验证等级 PASS。
- `tools/test-search-candidate-acquisition.mjs`：16项，含上文预解析限制。
- `tools/test-reader-source-category.mjs`：类型隔离和随包元数据覆盖 PASS。
- 新 `/private/tmp/minglong-search-probe.mjs`：实际换源8源批屏障复现；显式图片分类与误标来源分类边界复现。

未进行新构建/安装/网络抓取/真机/VM操作。没有此次全部《鸣龙》 sourceId、规则版本、各阶段响应，所以不能给出“X个坏源/Y个客户端问题”的真实数量。优先修可成立的候选控制/正文判定/执行隔离与换源调度；之后仅对剩余具体源补最小样本矩阵，不应反复全量手机抓取。

## 补充：单条畸形结果会拒绝该源整批（已复现契约粒度）

`SearchGateway.ts:191–219` 一个 try 包含完整 rawBooks 解码；`:213` 任一 decode 抛错，直接返回 `{ok:false,error}`，先前合法兄弟记录不会返回。`:361–374,395–446` 包含 title/bookId/变量/可选字段类型拒绝。

追加实际 `SearchGateway.searchBySource` 探针：输入一个合法《鸣龙》+一个空白书名，结果 `ok:false,error:'search protocol returned blank title'`，合法那条也消失。日志 `/private/tmp/minglong-search-probe.log`。

这是**Core→Host 契约拒绝粒度**的已确认行为；不证明真实 Core 会在此次《鸣龙》响应产生空标题/错类型，更不证明它就是用户“搜不到”的原因。整改可对可独立的 malformed item 记录隔离错误并继续合法项，而 envelope/sourceId/sourceVersion 的身份错误仍应整批拒绝。
