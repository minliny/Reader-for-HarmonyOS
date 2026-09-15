# 待归档证据敏感字段只读复核

结论：本次检查没有发现需要删除或脱敏的真实密钥、代理订阅地址、账户认证请求头。无需因此阻塞当前证据归档。

范围：检查开始时 Harmony 仓库 `evidence/2026-09-14-physical-review/` 下 231 个未跟踪文件清单；229 个文本文件逐一扫描，并对网络日志、probe、JSON/JSONL 中的 headers/认证类字段/URL 查询参数做结构复核。另 2 个文件为书签列表 PNG，不属于本次网络日志与探针文本审计。未读取设备、未修改仓库文件。清单留在 `/private/tmp/reader-final-evidence-review-files.json`。本报告形成时 HEAD：`66b63f2d0aef25689981ee12c03b64cebf7cac22`。

## 已命中的具体内容及核对结果

以下 3 个日志确实保留完整 Cookie/Set-Cookie 字段，但全部是现有、已脱敏的本地 host replay 固定测试值。逐个字段与 Reader-Core-Native 已跟踪 fixture 比对，66 次字段/查询参数出现全部找到对应测试样例，无未匹配值；本报告不复制任何字段值。

|路径（相对待审目录）|出现字段|核对来源|应处理字段|
|---|---|---|---|
|`minglong-full-assessment/repair/format3-legado-replay.log`|`params.headers.Cookie`、`data.http.headers.set-cookie`、测试 URL 的 `key`|Core `tests/fixtures/host_replay/legado_desensitized_corpus_suite.json`|无：固定脱敏回放样例|
|`minglong-full-assessment/repair/format3-remote-replay.log`|`params.headers.Cookie`、`data.http.headers.set-cookie`|Core `tests/fixtures/host_replay/remote_reading_e2e_suite.json`|无：固定脱敏回放样例|
|`minglong-full-assessment/repair/ml-proxy-core-complete.log`|上述回放字段及失败对比中的 `actual/expected.http.headers.set-cookie`|上述两个 fixture 的回放与黄金回包差异|无：固定脱敏回放样例|

VM 实测 `reader-network.log`、`reader-control-probe*.jsonl` 和 PH76 网络/回调证据未检出真实 Authorization/Proxy-Authorization、订阅 URL、带凭据的 URL userinfo 或私钥。结构化非空请求头只有常规头、上述 fixture Cookie 和测试 `x-reader-step`。

PH76 日志/JSON 的 token 命中属于数值型回调生命周期标识；正文准入探针中的 token 命中属于固定错误响应文案；`SOURCE_CONTENT_AUDIT.md` 对 token 的描述为源规则的参数/错误行为说明。它们均未包含可归档之外的真实凭据。

原始候选只含路径/字段类型与位置（不含值）：`/private/tmp/reader-final-evidence-candidates.json`。脱敏 fixture 对照统计：`/private/tmp/reader-final-evidence-fixture-checks.json`。
