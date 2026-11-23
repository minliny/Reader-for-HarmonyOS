# 存储准入诊断 v2

此工具只解释当前查询的观察结果。日志和 header 的正式准入权威已经退役：报告中的 `canonical.status` 为 `NOT_RUN`、`installAuthority` 为 `false`，`routePrediction` 只是 transition-only 策略的拒绝预览。有效日志、相同来源或版本 47 都不能据此允许安装；正式准入由绑定的真实 transition proof 及规范 pipeline 决定。

诊断不执行安装、应用停启、数据库复制、SQL、PRAGMA、FFI 或意图文件读取。实现见 [CLI](/home/administrator/Reader/Reader-for-HarmonyOS/tools/diagnose-storage-admission.mjs)、[诊断模块](/home/administrator/Reader/Reader-for-HarmonyOS/scripts/lib/hap-storage-admission-diagnostics.mjs)和[传输边界](/home/administrator/Reader/Reader-for-HarmonyOS/scripts/lib/hap-diagnostic-transport.mjs)。

## 手动选择与授权

```sh
node tools/diagnose-storage-admission.mjs
node tools/diagnose-storage-admission.mjs --list
```

默认和 `--list` 只输出 `NOT_RUN`，不导入运行期端口、不发现工具、不消费授权、不申请租约、不查询设备。此入口没有接入默认检查、合同索引、CI、full、构建或签名。

唯一支持的实际观察范围必须显式选择 `--lineage-only`。下列模板仅供取得新授权后填写，不是重复执行授权：

```sh
node tools/diagnose-storage-admission.mjs --run --lineage-only \
  --target '<现场确认的准确 loopback VM target>' \
  --hdc '<已绑定原生 hdc 的绝对路径>' \
  --server-key '<明确的共享 HDC server>' \
  --vm-log '<本实例 Emulator.log 的绝对路径>' \
  --manifest '<已审候选 manifest.json 的绝对路径>' \
  --authorization '<新 v2 授权回执的绝对路径>' \
  --output-dir '<尚不存在的私有输出目录>'
```

只有新范围明确包含补充查询时才加 `--include-fallbacks`，回执中的选择必须一致。CLI 不自动选包、切换目标、重试、启动应用或扩大观察范围。

旧的 header 选择已经停止支持。参数语法成立但缺少 `--lineage-only` 时，CLI 在读取本地工具和回执、导入运行期端口、消费 grant、申请租约以及查询设备之前返回 `FAIL_INCOMPLETE_HEADER`；`authorizationConsumed: false`，两类查询计数均为 0。不能把这项已选失败降为可省略的 `NOT_RUN`，也不能改用字节读取命令补齐。

## 报告与来源边界

报告 schema 是 `reader.hap-storage-admission-diagnostic.v2`。当前 CLI 的 `header.selected` 为 `false`，`selectedHeader.status` 为 `NOT_SELECTED`，`query.header` 和 header marker 查询均为空，版本不由 header 补入。模块保留的低层合成 fixture 可观察 `pwd` 和固定 `test` flags，但没有 header 字节查询 API；该路径仍报告已选 header 失败，不是 CLI 的替代操作入口。`parseSyntheticSqliteHeader` 只处理测试提供的 100 字节 Buffer，没有设备读取或准入权威。

lineage 观察调用真实读取器处理本次内存结果。只有可识别的标准 hilog 时间戳、OS PID/TID、Reader 前缀以及消息正文开头的 identity/startup 才参与对应 PID 的观察。普通消息中复制的 identity 文本、其他 PID、JSON 内的 `processId` 都不能冒充请求 PID 的记录。成功远端 payload 按 UTF-8 解码并 `trim()`；查询统计保留 trim 前的字节数。stderr 非空本身不否定成功 stdout。

匹配 identity/startup 的坏 JSON 仍拒绝；它即使出现在后来正常会话之前，也不被诊断清除。后继 native-open 会使先前 ready 失效。未匹配但疑似损坏的行只产生固定 warning，不替换真实读取器的判定。`observedVersion: null` 和没有 lineage 是不同事实；完整 lineage 缺少可选当前版本时可报告 `lineage-version-unresolved`，仍不能提供安装许可。

PID 前后查询失败只记 `lineage-pid-query-failed / unavailable`；仅后查询成功且数值不同才记 `changed`。数字相同也不证明进程生命周期相同或排除了 PID 复用。

补充查询严格受限：

- 补充 `ps` 只在初次 PID 查询成功但为空或多 PID 时发生。初次传输失败、后查询失败或 PID 已变更都不因此扩大查询。只有列名的 `UID PID` 输出是格式不完整，不能记匹配数 0。
- 宽 Reader 日志只在按 PID 日志查询成功、远端退出码为 0 且 payload 为空时发生。超时、输出超限、远端非零、坏帧、坏 JSON 或缺 ready 都不触发宽查。
- 宽日志始终标记 `pidBound: false`、`timeSeparated: true`、`pidReuseExcluded: false`。请求 PID 的计数只来自可靠 OS 前缀；无前缀时计数为 `null`，部分归属中的正数只是已观察下界。其他 PID、缺字段或计数大于 0 均不等于有效当前 lineage，更不能升级准入。

## 客户端、远端帧和隐私

每个远端 shell 查询使用随机 nonce 的固定 `RSD_REMOTE_V2` 尾帧，分别记录本地 HDC 客户端和远端命令状态。只有客户端成功且唯一、完整、匹配 nonce、规范编码的 0–255 退出码帧才被接受。错误 nonce、重复帧、截断帧、非法编码或缺帧均为远端状态未知。客户端 status 0 同时带 `EPERM` 等 error 仍是失败；timeout、output-limit 和 spawn-error 也不能变成成功空日志。远端非零不把正文提供给 lineage 读取器。

| 字段 | 含义 |
| --- | --- |
| `clientExitCode / clientOutcome` | 本地客户端退出状态与错误分类 |
| `remoteExitCode / remoteState / frameState` | 固定 nonce 帧提供的远端状态，未取得时明确未知 |
| `stdoutBytes / stderrBytes` | UTF-8 解码和 trim 前的原始客户端字节数；stdout 包含帧 |
| `payloadStdoutBytes` | 有效帧之前的 payload 字节数；无有效帧时为 0 |
| `lineage.logBytes` | payload 字节数，不把 nonce 帧计作日志正文 |

正式 readiness 已有的 VM 备用路径保持原样：只对 `cat /proc/sys/kernel/random/boot_id` 和 `cat /proc/uptime` 的客户端成功、有效唯一帧、远端非零且单一通道整串匹配的权限拒绝，转回固定 Error 供原 `procRead` 处理。readiness 真正通过后才标记 `handledByCanonicalReadiness`；仍保留 `remoteExitCode=1 / remote-nonzero`，不把失败正文变成成功 payload。错误路径、额外文本、双通道、坏帧和其他命令不获得此适配。

原始 stdout/stderr、nonce、PID、完整日志、身份 DTO、路径和任意错误 message/stack 只在内存使用，不写进诊断报告。报告、执行回执和 grant 记录只保存约定的枚举、计数、布尔值及绑定摘要。输出为空时可以确认相应计数，不能据此猜测日志轮转、远端权限或历史失败机制。

## 一次性 v2 回执与工具身份

回执 schema 为 `reader.storage-admission-diagnostic-authorization.v2`，必须有新用户批准对应的 `AUTHORIZED`、`scopeClosed: false` 和 `READ_ONLY_STORAGE_ADMISSION_DIAGNOSTIC_ONCE`。它绑定批准引用、bundle、target/server 摘要、manifest/HAP/HDC SHA、固定 ledger namespace、当前已装包 UID/appBuildId/appIdSha256/updateTime，以及两分钟内现场确认的 VM 名称、实例摘要、准确 target 和 VM log。`observation` 必须精确匹配 `{ lineageOnly: true, headerBytes: false, includeFallbacks: <明确选择> }`。

limits 精确要求：业务查询 9、前置查询 10，应用 start/stop、install、数据库复制、SQL、intentReads 均为 0。模板不能靠复制旧 scope 或刷新现场时间获得新额度；回执形状本身不替代用户授权。

正常 CLI 使用固定的 `~/.reader-state/storage-admission-diagnostic-claims-v2`，不接受 `READER_LOCK_DIR` 改换授权 ledger。namespace 绑定平台及规范绝对根目录。独占消费标记在 SDK/部署运行期端口导入、租约及设备 IO 之前落盘；同一批准改文件名、JSON 排版、输出目录或 VM 确认时间均不能重放。已有输出与 consumed 文件不被覆盖。测试可注入私有 ledger，仅供本地夹具；正常 CLI 不提供该参数。

这是一台受信宿主上的防误用与防重复消费约束，不是跨宿主的密码学授权系统。原生 HDC 拒绝 JS/CMD/BAT launcher，以不跟随叶 symlink 的文件描述符校验 ELF/PE、hash 及 stat 身份，并在每次 dispatch 前重查。随后仍按 pathname 执行，`atomicExecIdentity: false`；使用期间必须避免并发替换工具，不能宣称原子执行身份已经实现。

## 查询预算、取消和租约

单个共享 server lease 内串行查询。每条 HDC 最多 10 秒、1 MiB，不通过丢失传输状态的 capture 来分类。

| 部分 | 最大命令数 | 内容 |
| --- | ---: | --- |
| CLI 前置 | 10 | 精确 target 连接确认 1，加既有 VM readiness 最多 9 |
| 业务诊断 | 9 | BMS 1，加诊断模块最多 8；lineage-only 通常更少 |
| 操作者现场确认 | 独立列入新执行计划 | VM 宿主实例和准确 target 确认，不隐入业务 9 条 |

异步命令在 timeout、输出超限或取消时终止自己持有的本地直接子进程，等待该 child 的 `close` 后才结束 await，CLI 随后在 finally 释放 lease。此保证不等于远端命令或任意子孙进程树已终止。

既有 readiness 是同步调用。SIGINT/SIGTERM 的 JavaScript 处理可能延迟到当前整段有界同步 readiness 观察返回后；实现随后 drain signal，并在 BMS 或下一业务 dispatch 前停止。不能承诺同步期间立即取消。SIGKILL、宿主崩溃或断电也没有 finally 清理保证。signal scope 只移除自己注册的监听，不清除其他 owner 的监听。

成功收集只记 `DIAGNOSTIC_COMPLETE / observation-only-authority-retired`。传输或远端失败保留 `FAIL_QUERY`，取消保留失败状态。消费后的 scope 成功或失败均关闭；重试需要新授权，诊断完成不续期原安装范围。

## 本地证据与历史观察

本轮实际本地证据为 module 10、transport 8、CLI 9，共 27 个唯一 case。module 后续把旧字节/错误优先级、PID 失败、归属、缺字段、隐私、可选版本与 warning 负例补进原 case；它们不是增加设备执行。范围只包括内存查询 fixture 与私有原生 Node 子进程，没有 HDC、设备、实际 SQL/FFI 或 UNKNOWN 读取。具体 source/test SHA、逐 case 日志与失败记录见 [诊断结果](/home/administrator/Reader/.local/framework-residual-repair-20261111/diagnostics/result.json)。

初轮 EPERM 或 file-level wrapper 失败、未取得结果而中断的旧执行、transport 重复 SIGTERM 的夹具失败，以及 CLI driver 写错路径导致 0 case 执行的失败全部保留。单次 signal 修正没有删去 `CANCEL_BEFORE_BMS` 和禁止 `BAD_BMS` 的断言。不能把 file-level exit 或未完成调用当成逐 case 通过。

旧24个标题与最初25项入口的逐项迁移见 [迁移记录](/home/administrator/Reader/.local/framework-residual-repair-20261111/diagnostics/legacy-case-migration.json)。旧 header 字节读取、同 source 日志放行和旧 source-only revalidation 分支属于明确退役能力；不能为让旧用例变绿重新开放。最初25项映射和后续新增2项回归，也不自动表示旧24项的每个子断言均等价重放，迁移记录分别列出保留、替代、退役和未单独重放的子例。

此前 `0511` 候选 canonical inspect 的 `FAIL / exit 3 / target-sqlite-version-unresolved` 保持原结论，新包没有因此安装，原 VM 仍是此前 a443。旧一次授权诊断中，按 PID 及宽 Reader 日志的 HDC 客户端 exit 0、stdout/stderr 0 字节，只证明当时客户端观察；该轮没有 v2 远端 nonce 帧，不能追认为远端成功空日志。较后 marker 见非空 WAL，也不能追认前一命令或旧 inspect 的原因。原安装和旧诊断 scope 均已关闭。见[原实际观察](/home/administrator/Reader/.local/framework-closure-implementation-20261111/storage-admission-live-20261111/observation.json)。

v2 本地修复没有重新占用设备，也没有证明旧空日志的具体原因或取得当前安装准入。未来任何设备诊断、正式 inspect 或安装仍须另按当前源码、产物和授权范围处理。

后续补正两处正夹具装配失败（混入通用PRIVATE_STDERR、旧fake端口禁止所有cat）亦保留；只允许两条精确OS proc命令，原header零动作和其他SQL/cat禁用断言均在。最新27项source/test SHA与实际逐项日志以当前诊断结果为准，旧25项冻结记录保留为历史。
