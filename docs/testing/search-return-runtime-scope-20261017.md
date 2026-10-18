> 2026-10-18 撤回后补记：五类消息框架及 search-message-ui 范围已撤回。当前实际测试库存为 699，独立 search-return-runtime 仍为 7 selected / 692 omitted；120000ms 预算及 180000ms 上限保留。以下正文是 2026-10-17 当时的实施记录，其中 704 库存、保留 UI50 及旧路径均属历史事实，不表示撤回后仍启用该消息范围。原正文精确字节已另存 ignored original-design，历史回执未改。

# 搜索返回运行期定向范围（2026-10-17）

本范围仅覆盖新发现的搜索返回 `THREAD_BLOCK_6S`：`SearchResultRelevance` 逐结果重复调用默认 locale 的 `toLocaleLowerCase()`；本轮修复涉及 `SearchResultRelevance.ts`、`SearchResultProjection.ts`、`SearchViewState.ts`，直接回归仍使用既有 `test-search-view-state.mjs`。缓存由保留的查询状态拥有，不能改成非 locale 小写、改变评分/作者证明或伪造结果与滚动身份。

本页是独立追加记录。既有 `search-message-ui` 的50项选择、360000ms policy及其已执行历史回执原样保留；本轮不重跑50或full。此前40个消息UI生产文件的冻结身份保持，但旧50不能被描述为已经验证这次新增的3个逻辑文件变化。

## 严格具名选择

`tools/contract-test-tiers.json` 新增且仅新增 `search-return-runtime`：**7 selected / 697 omitted / 704 inventory**，所有项沿用既有source/integration分类。执行顺序与回执顺序均按下列层声明，不能退回字母顺序或未知scope的full回退。

| 层 | 测试 | 本轮证明边界 |
| --- | --- | --- |
| runner-policy | test-contract-scope-development | 严格scope/policy、真实tiny child的分层顺序、fail-fast/unrun、omitted、PARTIAL状态及未知/acceptance/source-tier拒绝 |
| runner-policy | test-contract-test-tiers | 既有完整分类、选择/遗漏、单项与scope截止、自有进程组回收和失败凭证负控 |
| runner-policy | test-hap-pipeline-contract | 既有iteration入口、不可变选择/结果/日志/源码/控制器/工具链凭证及篡改拒绝；新增scope仍不能成为acceptance |
| return-runtime | test-search-view-state | 既有评分/投影/筛选/保留语义，加默认及tr/az/lt Unicode oracle、大批结果归一化调用数、同query新Projection冷返回零重复locale调用、失效与真实DataSource/anchor边界 |
| return-runtime | test-search-publication-state | 查询发布revision、进度、停止与部分结果事实的既有语义 |
| return-runtime | test-search-host-wiring | SearchHost保留状态及单一orchestrator/来源刷新publication接线 |
| return-runtime | test-search-orchestrator | 搜索代际、停止、重试、过期异步事件与结果归属 |

作者/书架身份的另两个已有直接回归由生产修复分工单独执行；不机械重复纳入本scope。没有新增测试名，也不迁移或放宽任何旧断言。

## 预算和失败处理

总预算 **120000ms**，包含现有pipeline前置/执行/输入复核所用的剩余预算；runner还为这个具名scope设置180000ms绝对上限。正式单项110000ms和TERM/KILL宽限1000ms原值保留，环境/调用参数只能缩短声明预算。历史搜索逻辑四项约数秒，主要余量留给runner-policy小型进程夹具及前置复核；这是预算依据，实际本轮结果另记。

`failFast:true` 必须存在。首个已结算失败停止派发后续项，已运行peer继续结算，结果必须保留failureStopped/unrun与进程树状态。未运行项或超时不得写PASS；选择集合与每层必须一一对应；缺policy、重复、漏项、孤儿policy、未知scope和超预算均拒绝。旧full/manga模式及旧50policy行为不变。

## 唯一现有入口与凭证

```sh
READER_CONTRACT_TEST_WORKERS=2 node tools/run-contract-tests.mjs --scope search-return-runtime --results-file <new-results.json>
READER_CONTRACT_TEST_WORKERS=2 node scripts/check-local.mjs --contracts-scope search-return-runtime
READER_CONTRACT_TEST_WORKERS=2 node scripts/hap-pipeline.mjs build --class iteration --contracts-scope search-return-runtime --signing local
```

这些是现有runner/check-local/pipeline的同一具名选择，不创建另一套构建脚本。仅iteration允许scope，acceptance仍须原有完整证据。当前分工只修改scope/控制器/必要policy测试并执行三个policy单项；实际7项canonical scope、HAP及设备操作由根任务分别授权执行，不能据本页声称完成。

通过时只能记录 `harmonyContracts:PARTIAL`、`selectedStatus:PASS`、`fullSuite:NOT_RUN`、`acceptanceEligible:false`。report与immutable receipt继续绑定完整inventory、精确selected/omitted、层信息、声明deadline、逐项日志和源码/控制器/工具链输入；未知scope或伪造full/acceptance/输入/日志/预算不得获得有效回执。

## 实际验证与剩余项

本次scope接线的定向policy原始结果与旧50身份对比位于 ignored `scoped-repair/search-return-runtime-scope/`，生产直接回归在 `scoped-repair/search-return-appfreeze-repair/`。完整scope结果由根任务另外填写，未运行不能补写PASS。

逻辑调用计数及SDK/方法断言不能证明原生ICU实际wall time、VM已消除THREAD_BLOCK_6S、合成帧时序、真实书源正确性或用户体验。搜索返回的原生复验、后续HAP/安装和用户验收仍分别OPEN；既有漫画设置比例视觉FAIL也不因本次逻辑修复或合同通过而改变。
