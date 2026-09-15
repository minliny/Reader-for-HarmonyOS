# 原生 HTTP 失败归因和搜索关联补齐

- Harmony commit: e5483b93522daa1468b1349327221c15e8698b7a
- 源码冻结；仅提交自身 4 个生产文件及 5 个测试文件。Core、证据总账、VM/HDC、Native/HAP 均未操作。
- 背景证据：968a8b57 VM 的 36 条 Internal error 无法逐条绑定原生码。进程级有码清单会对重复码去重，且不在原有七码清单的 native request reject 未保留 HTTP 分类和数码；SearchGateway 又只保存文案。

## 修复边界

1. HttpExecuteHost 中只在真实 request.request 拒绝边界包装 SourceHttpTransportError。code=INTERNAL；details.category=SOURCE_HTTP_FAILED、phase=transport、stage=request.dispatch，数码为安全整数时保存 platformCode，无码省略；原文案保留。
2. 原有 2300006/2300007/2300028/2300052/2300055/2300056/2300999 保持 transient=true/retryable=true。其余原生拒绝 transient=false/retryable=false；不推测其底层原因、不改全局网络故障、不扩大自动重试。
3. 已确定代理故障仍 NetworkEnvironmentError，复用已有 fromPlatform 保留 code/固定 operation；HTTP 407 语义不变。取消先检查 deadline.cancelled，不把 destroy 引起的拒绝记成源 HTTP 故障。
4. execute 最终失败一次记录安全关联：requestId、固定 stage、code/none、elapsedMs、transient。复用既有请求生命周期，不新增日志注册表；重复码不再丢失逐请求关联。旧进程级 TypeError/native-code 去重清单保留。
5. ErrorMessage 现有模块新增严格字段提取：只接当前 SOURCE_HTTP_FAILED 的标准 SDK/Core envelope，提取安全数值/固定 token。Core 当前类别为规则错误、取消、超时时，不读取嵌套旧 HTTP cause。
6. SearchGateway 返回 diagnostic；SearchOrchestrator 将其留在该源 failure 状态并附到现有日志。额外字段不进入用户文案，不输出 URL、请求体、headers、认证值。

## 实际本地验证

- 修前生产探针失败：/private/tmp/reader-native-failure-before.log（真实 request reject TypeError 丢 HTTP 来源，符合缺陷）。
- node tools/test-http-response-bytes.mjs：PASS，/private/tmp/reader-native-failure-http-after.log。生产 execute → SDK 双重 normalize → CoreError 输入 → reading classifier / 安全摘要；TLS/23/无码、重复操作、显式两次 retry 单条最终摘要、取消后继续、独立后续规则错误负例。既有空响应、403、重定向、TypeError 白名单/上限用例继续通过。
- node tools/test-search-gateway.mjs：PASS，/private/tmp/reader-native-failure-search-gateway.log。
- node tools/test-search-orchestrator.mjs：PASS，/private/tmp/reader-native-failure-search-orchestrator.log。
- node tools/test-transient-transport-acquisition.mjs：PASS，/private/tmp/reader-native-failure-acquisition.log。新增 TLS/23/无码 non-transient 不写 parser verdict 且先前成功 facts 原样保留。
- node tools/test-network-route-policy.mjs：PASS，/private/tmp/reader-native-failure-network-policy-after.log。含真实代理分类/数码、TLS 独立、取消释放 DNS lease、等待者不清前序 lease。第一次 /private/tmp/reader-native-failure-network-policy.log 为旧 harness 未注入 errorMessageOf/仍要求同一 Error 实例，已按新错误契约迁移后通过。
- node tools/test-search-publication-state.mjs：PASS，/private/tmp/reader-native-failure-publication-state.log。
- node tools/test-search-publication-boundary.mjs：PASS，/private/tmp/reader-native-failure-publication-boundary.log。
- node tools/test-http-url-normalization.mjs：PASS，/private/tmp/reader-native-failure-url.log。
- git diff --check：PASS；提交后 entry/src/tools 无 dirty，index 空。

## 尚待根任务统一验证

Core 真实 QuickJS/原 66 catch 后必要结果错误恢复由 content agent 的 cfb0208f4 提供；本报告的 Host 回归未冒充真实 Core 执行。全量 Core、Native、ArkTS/HAP、同 VM 新包行为由 root 统一运行。本次不声称 36 条旧 Internal 已逐条定位；新包后可用 requestId + operationId + platformCode + elapsedMs 关联实际失败，平台内部错误的更深细因仍须按证据判断。没有证据支持“DNS 固定或取消死锁造成这 36 条错误”。
