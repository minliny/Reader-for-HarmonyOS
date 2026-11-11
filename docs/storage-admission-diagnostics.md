# 存储准入诊断

此工具解释现有读取器为什么不能给出当前版本或存储来源。它不拥有安装准入，也不执行安装、应用停启、数据库复制、SQL、PRAGMA、FFI 或意图文件读取。

当前 `0511` 候选之前的 canonical inspect 为 `FAIL / target-sqlite-version-unresolved`。该失败和已关闭的设备范围保持原记录。本轮只完成本地实现及 fixture 检查，没有取得新设备原因码。

## 手动入口与默认状态

```sh
node tools/diagnose-storage-admission.mjs
node tools/diagnose-storage-admission.mjs --list
```

两种调用均只列 `NOT_RUN`，在导入部署实现、发现工具、申请租约或读取目标之前退出。此工具未接入默认检查、合同索引、CI、full、构建或签名入口。

未来执行需要新的明确只读授权和一次性私有授权回执；前次复制、安装额度均不能复用。由操作者先现场确认原 VM 名称、实例、当前 target 和运行状态，再填写两分钟内的 `vmConfirmation`。该回执是防止误执行和重复消费的本地约束，本身不能替代用户授权。

以下是未来调用模板，本轮不运行：

```sh
node tools/diagnose-storage-admission.mjs --run \
  --target '<现场确认的准确 loopback VM target>' \
  --hdc '<已确认 hdc 的绝对路径>' \
  --server-key '<明确的共享 HDC server>' \
  --vm-log '<本实例 Emulator.log 的绝对路径>' \
  --manifest '<已审候选 manifest.json 的绝对路径>' \
  --authorization '<新授权回执的绝对路径>' \
  --output-dir '<尚不存在的私有输出目录>'
```

只有新范围明确包含补充查询时才加 `--include-fallbacks`，且授权回执中的 `includeFallbacks` 必须相同。CLI 不支持省略目标、自动选最新包、重试、隐式启动或切换目标。

## 证据与原准入的关系

`scripts/lib/hap-storage-admission-diagnostics.mjs` 以记录型 query 调用原有 `readInstalledSqliteVersion`、`readInstalledStorageLineage` 和 `storageUpdateRoute`。成功输出先按原 `capture()` 的 UTF-8 解码及 `trim()` 语义传入；失败仍传空字符串。stderr 非空不改变 status 0 的成功语义。输出长度使用 trim 前的原始 Buffer 字节数。

两个候选绑定的文件保持原样：

- `scripts/hap-pipeline.mjs`
- `scripts/lib/hap-storage-admission.mjs`

因此没有通过修改解析行为使旧失败变为通过，也没有重写候选 controller snapshot。header 成功仍不足以放行，当前 lineage 有效及 source/max 一致仍是同来源路径的必要条件。

报告 schema 为 `reader.hap-storage-admission-diagnostic.v1`：

- `query.header / lineage / extra` 仅保留 outcome、exitCode、timedOut、stdoutBytes、stderrBytes。
- `header.reason / canonicalReason` 来自原 header 读取；`version` 只取原读取器返回值。
- header 失败且沙箱上下文有效时，最多追加一条固定只读 marker 查询。它的 `markerReason`、WAL/journal 布尔值属于**后续时点**，`markerTimeSeparated` 明确标示；它们不补齐版本，也不追认原失败原因。
- `lineage` 只记录固定原因码、PID 状态枚举、日志字节数、身份/ready 数量和白名单 stage/status，不输出 PID、身份原文或任意日志文本。
- `routePrediction` 只使用首次原读取器的返回值，是初读路由预测。它未执行正式 `resolveDeployment` 的 BMS/版本/lineage 再确认，不是完整 canonical inspect 的结果或安装许可。初读即使允许，正式复核仍可拒绝。

匹配日志中的坏 JSON 即使位于后来正常会话之前，原读取器仍会拒绝。诊断可以指出 `historicalMalformedBeforeLatestOpen`，但不忽略该行或放宽准入。未匹配正则的异常行仅作为观察告警，不能据其外观重新定义原判定。

补充 `ps` 只解释初次 PID 不可用/多 PID；宽 Reader 日志只在 canonical 日志成功返回空输出时查询。补充结果不会替代原 PID、日志或存储来源。宽日志标为 `pidBound: false`，不能将其他进程的 identity/ready 认作当前进程事实。

## 查询预算与隐私

单个共享 server lease 内串行调用已确认的原生 HDC，直接取得 `portableSpawnSync` 的结构结果。拒绝 JS/CMD/BAT launcher，并核对 ELF/PE 文件标记及新授权绑定的 HDC SHA256，避免 timeout 只终止中间脚本。每次最多 10 秒、1 MiB；不通过会丢失错误状态的 `capture()` 做分类。租约 command 只保存枚举动作标签，必要宿主进程和目标元资料沿用私有租约协议。

预算分开统计：

| 部分 | 最大命令数 | 内容 |
| --- | ---: | --- |
| CLI 前置 | 10 | 连接目标确认 1，加既有 VM readiness 最多 9 |
| 业务诊断 | 9 | BMS 1，加原读取/marker/可选补充合计最多 8 |
| 操作者现场确认 | 单独列入未来执行计划 | VM 宿主进程/实例与目标发现，不藏入上述 9 条业务预算 |

原始 stdout/stderr、Reader 日志、header bytes、数据库内容和意图数据不写入报告；错误 message/stack/argv 也不输出。只读 marker 不读整库、不哈希、不清 WAL/journal、不修改权限。发现进程不存在不能据此推断数据异常，发现记录缺失不能据此断言日志已经轮转。

执行完成或失败都会关闭本次 scope。非成功查询保留 `FAIL_QUERY` 和非零退出码；分类到失败原因不冒充业务通过。共享私有 ledger 以批准记录、准确目标/server 和候选摘要的确定性摘要做独占消费标记；复制回执、改变 JSON 排版、刷新现场确认或改输出目录都不产生新额度。输出目录和 `<authorization>.consumed.json` 也不覆盖旧文件。

## 私有授权回执形状

以下示例故意为 `DRAFT_NOT_AUTHORIZED`，不能运行；实际内容只能在新的明确批准及现场确认后填写，文件应为普通文件、权限 `0600`。字段中的摘要需按真实候选和当前目标计算。

```json
{
  "schema": "reader.storage-admission-diagnostic-authorization.v1",
  "status": "DRAFT_NOT_AUTHORIZED",
  "action": "READ_ONLY_STORAGE_ADMISSION_DIAGNOSTIC_ONCE",
  "approvalReference": "<新用户批准记录>",
  "scopeClosed": false,
  "bundleName": "io.reader.minliny",
  "targetRef": "<target SHA256 前12位>",
  "serverRef": "<canonical server SHA256 前12位>",
  "manifestSha256": "<已审 manifest SHA256>",
  "hapSha256": "<已审 signed HAP SHA256>",
  "hdcSha256": "<已确认原生 HDC SHA256>",
  "incumbent": {
    "uid": 0,
    "appBuildId": "<现装 appBuildId>",
    "appIdSha256": "<现装 appId SHA256>",
    "updateTime": 0
  },
  "includeFallbacks": false,
  "limits": {
    "businessQueries": 9,
    "preflightQueries": 10,
    "appStarts": 0,
    "appStops": 0,
    "installs": 0,
    "databaseCopies": 0,
    "sql": 0,
    "intentReads": 0
  },
  "vmConfirmation": {
    "vmName": "<现场确认的原VM>",
    "confirmedAt": "<现场确认UTC时间>",
    "instanceRef": "<实例路径SHA256>",
    "targetRef": "<相同target摘要>",
    "vmLog": "<该实例日志的绝对路径>"
  }
}
```

诊断成功后，原来的安装授权不会恢复。后续 canonical inspect、安装或应用生命周期动作仍按当时新的具体范围执行。漫画 `0/2` 与存储准入分别记账。
