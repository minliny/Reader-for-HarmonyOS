# 2300999 临时失败归因与 acquisition 记录修复交接

## 现象、证据与边界

- 输入证据：c56ad545 保数据 VM 包，PID 2810，`/private/tmp/reader-proxy-vm-c56-search/reader-network.log`。多源 `2300999 / Internal error`；现存平台日志未提供底层 CURL 细码，不能认定这些书源本身已坏。
- 修前 Core HEAD 为 c28f0f792；本次 Harmony 改动基于 URL 修复 6f486cfa 之后的共享工作树。所有代码先审计/本地验证，无本 agent 设备操作。
- 修前真实 SDK+classifier+Coordinator 探针：`/private/tmp/reader-unknown-transport-health-probe.mjs`、同名 `.log`。普通 Error 被归 INTERNAL/retryable=false，详情失败写入 acquisition.failed，UI 在 24 小时内降权并跳过背景预解析，前台仍能重试；不是永久禁用书源。
- 详细 Core 只读证据：`/private/tmp/reader-core-unknown-transport-health-audit.md`。普通搜索失败只影响当前搜索；搜索/换源入口仅按 enabled，不根据 acquisition.failed 永久禁用。SourceGateway/SourceOrchestrator 的手动检测结果只写内存 checkResults 展示；enabled 更新是独立显式操作。

## 已实现的最小闭环

1. HttpExecuteHost 的真实 native request catch 将已知 DNS/连接/超时/空响应/发送/接收错误 2300006/2300007/2300028/2300052/2300055/2300056 及未知 2300999 包成合法 wire `code=INTERNAL, retryable=true, details={category:SOURCE_HTTP_FAILED,phase:transport,transient:true,platformCode:原数值}`。数值/数字字符串兼容；保留原消息、数值诊断；取消不包装。已识别代理环境错误仍走原环境分类。TLS、URL、安全准入不改变；不凭这些码断定平台/源站故障细因。
2. 复用 SDK 现有 normalizeHostError，双次规范化仍保留 details/retryable；不新增协议枚举。
3. Core 普通 Host 与 JavaScript bridge 保留 SOURCE_HTTP_FAILED 顶层分类及原始 cause/Host 身份，TOC/正文 wrapper 不再把已恢复的真实 HTTP 分类覆盖成规则错误。
4. 对 source JS 已 catch 的失败，只允许本次真实 HTTP 证据解释 typed 必需结果准入失败。reader-rule 新内部 RequiredResult 类型；reader-content accessor 仅识别 MissingField/JsResult/RequiredResult（含规则链递归）。普通 JS throw、JSON/selector/regex 等规则错误不是此类型。每次新 Host 调用清旧证据、成功结果不应用证据。
5. 原 66 完整脚本继续仅运行一次，原有精确脚本适配在不满足 data.content 文本形状时返回 undefined 给 typed 终点准入；不靠固定异常字符串伪造类型。replacement 模板必需结果也保留此类型；有效文本及字符串数组不变。
6. RemoteReadingContract 仅由上述结构化 transient 标记产生 transientTransport；Coordinator 仍记录有界本次失败（最多 32 条），只有明确 SOURCE_RULE_FAILED/SOURCE_RESPONSE_FORMAT/SOURCE_TOC_EMPTY/SOURCE_CONTENT_EMPTY 写 acquisition.failed 并携带 failureCategory。因此其他超时/连接中断/HTTP400/404/5xx 同样不冒充解析事实。缓存诊断包装保留 transientTransport。候选失败继续其他同书书源，下次请求仍尝试失败源；之前成功目录/正文事实保留。
7. 正文请求失败不会到达渲染质量 reportVerdict；新增实际 readable-candidate 回归验证目录保留、fallback 成功、没有 failed 正文写入。真正规则错误与明确 HTTP 状态错误保持不同分类。
8. 相邻代码缺口：普通 search/detail/chapter 没有 TOC 已有的 HTTP 状态前置保护，错误页可能误解析。现有三个普通源 continuation 对400–599返回SOURCE_HTTP_FAILED+httpStatus（5xx/408/429可重试）；JS java.ajax/get仍获得原response，HTTP错误状态仅作为后续 typed 必要结果失败的证据，成功正文或独立throw不受它影响。
9. 历史误降权恢复：Core给AcquisitionVerdictV2新增可选failureCategory；保留原failureCurrent的scope/版本/时间意义，另投影failureConfirmed（仅当前且明确四类）。旧无category、已存HTTP/环境/未知类保留raw facts但unconfirmed。Host搜索和换源共用的ranking只对confirmed降权；旧失败展示“上次读取失败 · 可重试”，恢复一次可见组预解析机会，原prepareGroups每搜索attempted上限继续生效。Core related SQL不按failed权重排序，已回归其顺序不受失败事实影响。没有批量清数据。

## 文件所有权 / 未提交内容

Core（由 root/content agent 统一提交；同文件其他作者修复不得回滚）：
- crates/reader-rule/src/lib.rs：typed RuleError/RuleJsEvaluator 终点。
- crates/reader-content/src/lib.rs：typed accessor/evaluate/模板错误保留。
- crates/reader-content/src/source_adapters.rs：原66终点适配。
- crates/reader-content/tests/chapter_typed_admission.rs、tests/remote_content_finalization.rs：真实生产准入正负分类。
- crates/reader-runtime/src/host_callback_bridge.rs：HTTP 失败与必需结果的窄因果恢复。
- crates/reader-runtime/src/runtime.rs：host_error_with_identity 分类保留与 transient_ 三项测试；其余 hunks 属其他任务。
- crates/reader-runtime/src/remote.rs：仅 content_internal/toc_content_error/chapter_content_error；作者输出 hunks 属 content agent。
- 上项另含普通search/detail/chapter HTTP rejection和对应 source_fetch_and_catalog_tests 定向测试。
- crates/reader-contract/src/remote.rs：仅AcquisitionVerdictV2的failureCategory+其DTO test；作者proof类型属content agent。
- crates/reader-runtime/src/remote/acquisition.rs：仅failureCategory验证/failureConfirmed投影/因果回归；作者policy和其他测试属content agent。
- protocol/reader-command.schema.json：BookAcquisitionVerdict兼容V1|V2及可选failureCategory；此前schema仅V1但runtime已V2的既有遗漏同步修复。此任务不改数据库schema。

Harmony（未单独提交，root 可统一提交）：
- entry/src/main/ets/app/HttpExecuteHost.ts：仅 SourceHttpTransportError 与 native catch。
- entry/src/main/ets/features/reading/RemoteReadingContract.ts：transientTransport 类型/分类。
- entry/src/main/ets/app/BookAcquisitionCoordinator.ts：仅约 600 行错误包装及 failed writer 条件；作者 proof hunks 属 content agent。
- tools/test-http-response-bytes.mjs：native 2300999 分类控制。
- tools/test-transient-transport-acquisition.mjs：新 SDK/Coordinator 生产探针。
- entry/src/main/ets/features/common/BookAcquisitionPresentation.ts：confirmed分类、旧attempt与解析事实拆分；搜索/换源共用。
- entry/src/main/ets/features/source/SourceSwitchGateway.ts：仅failure投影/attemptFailed；作者proof其余hunk属content agent。
- entry/src/main/ets/features/source/CandidateRow.ets：旧unknown失败的通用文案。
- tools/test-search-view-state.mjs、tools/test-book-metadata-presentation.mjs：旧/新失败投影与排序断言。

## 验证结果

- 最终 `cargo test -p reader-runtime transient_ --lib`：5/5 PASS，`/private/tmp/reader-transient-core-status-final.log`。
  - 普通 HTTP Host 回送保持 category/cause/platformCode/retryable。
  - 真实 QuickJS 的传播错误、catch 后必要终点失败、独立后续 throw、catch 后有效正文、后续成功 HTTP 清除旧证据五个分支。
  - 完整原66脚本的 java.ajax 失败被 catch 后仍通过 typed 必需终点归为 per-source HTTP。
  - 普通search/detail/chapter × 400/404/503九例前置HTTP归因；JS HTTP响应的400/404/503必要失败与503后有效正文/独立异常五个分支。
- `cargo test -p reader-runtime required_chapter_admission_tests --lib`：2/2 PASS，`/private/tmp/reader-transient-core-compile.log`。
- `cargo test -p reader-content --test chapter_typed_admission --test remote_content_finalization`：6+7 PASS，`/private/tmp/reader-transient-content-after.log`；有效文本/数组、原66多种端点、模板以及独立异常控制。
- 最终 `node tools/test-transient-transport-acquisition.mjs`：3组PASS，`/private/tmp/reader-transient-acquisition-legacy-final.log`。实际SDK/分类/failed writer、可读候选fallback、旧raw/新parse/HTTP facts到真实prepareGroups+CandidateRow文案。
- 最终 `node tools/test-http-response-bytes.mjs`：PASS，`/private/tmp/reader-transient-http-status-final.log`；新增7类native码，原重定向/空响应/错误诊断控制也通过。
- `node tools/test-search-candidate-acquisition.mjs`：PASS，`/private/tmp/reader-transient-search-regression-final.log`。
- `node tools/test-book-metadata-presentation.mjs`及`test-search-view-state.mjs`：PASS，`/private/tmp/reader-transient-metadata-final.log`和`/private/tmp/reader-transient-view-state-final.log`。
- child的Corefailure模块11/11、DTO1/1、schema9例PASS，见`/private/tmp/reader-core-failure-confirmed-report.md`，未新增设备验证。
- `node tools/test-remote-reading-flow-gateway.mjs`：PASS，`/private/tmp/reader-transient-gateway-regression.log`。
- 两仓 git diff --check PASS。
- 初次新增文案探针把函数外return送入stripTypeScriptTypes导致测试抽取器语法失败，生产代码未失败；改为先strip类体再拼return，最终PASS。保留`/private/tmp/reader-transient-acquisition-legacy-harness-failure.log`。
- 只读 cargo fmt --check 曾指出本轮双方新 hunk 待统一格式化；`/private/tmp/reader-transient-fmt-preview.log`。已通知 content agent 在全员冻结后统一 cargo fmt，已授权其格式化本 agent Rust 文件。本 agent 未为此改其他 owner 代码。

## 冻结及剩余证据边界

- 本 agent 源码冻结；未单独提交共享文件。全量 Core gate、Native、正式 HAP、VM 由 root 统一执行。
- 本次修复并未定位每个 2300999 底层原因：解决的是已证实的错误身份丢失、错写长期失败和错误降权，不声称源站/平台故障已治愈。
- 历史失败记录未保留native code，不凭文本反推其原因、不批量删除；原记录被保留为未确认的上次失败，已去除误降权并恢复正常预解析。新明确规则事实仍按既有时效/版本规则影响候选。未修改原始书籍/章节/阅读位置/用户配置；作者变更由并行owner单独交接。
- c56 VM 曾验证的 HTTP 编码缺陷消失与原66/松鹤阅读行为，不等于当前新增分类代码已在 VM 验证。新包需要按既有计划确认搜索失败展示、候选继续与正常阅读；不需要新增用户决策。
