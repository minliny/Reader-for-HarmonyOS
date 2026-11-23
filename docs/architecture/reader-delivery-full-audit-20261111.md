# Reader 本轮框架与交付全量审计报告

> 状态更新：以下为 Host `641be0ab`／候选 `0511` 的审计基线与原计划，保留历史事实。用户随后要求“全量修复”的当前实施与逐层结果见[遗留修复实施记录](/home/administrator/Reader/Reader-for-HarmonyOS/docs/architecture/reader-residual-repair-implementation-20261111.md)。

日期：2026-11-11。审计基线：HarmonyOS Host `641be0ab54f29333a3e2d20eb4520b5d27c043dc`；Core `d3eb49729be9b1e8ae54102520a892178023b1d5`，既有治理 WIP 保留。修复执行见[分批修复方案](/home/administrator/Reader/Reader-for-HarmonyOS/docs/architecture/reader-delivery-remediation-plan-20261111.md)。

后续仅针对未完成项的深化分析见[遗留专题报告](/home/administrator/Reader/Reader-for-HarmonyOS/docs/architecture/reader-open-issues-analysis-and-resolution-20261111.md)：进一步定位页码水合的失败去重／事实状态问题，并将指纹演进与被动通信设计从其他事项的共同前置解耦。本文12项原审计编号及历史证据边界保留。

## 1. 审计结论

**本轮代码、本地验证及签名产物有可核对证据，设备交付仍未完成。最终候选 `0.2.0.DEV.0511f567914d` 从未安装；原 VM 仍是 `a443`。** 唯一一次选中的正式安装前 `inspect` 实际 `FAIL / exit 3 / target-sqlite-version-unresolved`，随后安装、启动和阅读取证均为零。它必须保留为失败，不能改成可选检查未执行。

新一次只读诊断已经把**当前直接阻断**定位到：原读取器没有取得可接受的 live lineage 日志输入。按 PID 与去掉 PID 过滤的 Reader 日志均返回零字节；header 同次没有取得版本。日志为什么为空、远端 hilog 自身是否成功，尚未建立。没有证据证明坏库、当前 Core 不兼容、签名错误或已经发生误安装。

准入源码另有两个需要优先处理的合同问题：正式路径依赖可丢失、可关闭的启动日志；旧解析器没有约束消息体起点，可能把普通消息中嵌入的身份文本认作正式记录。前者与当前阻断直接相关；后者是确定的解析边界缺口，实际业务输入可控性和误放行未证实。

本报告登记 **12 项问题：2 项 P1、9 项 P2、1 项 P3 文档问题**；P3 的当前摘要披露缺口随本报告修订关闭。另列交付、历史因果和验收开放项，不把它们都包装成新增代码缺陷。

## 2. 覆盖范围与证据强度

“全量”覆盖本轮 P0–P6、阅读职责与动效取舍、平台警告、页面几何、下载／漫画恢复、存储准入、HAP 安装控制器和新诊断工具。Android、iOS、所有历史业务模块及全部门禁不在本次覆盖内。

本次审计由主审和三个并行只读审阅组成：准入调用链、诊断工具、P1–P5 框架与证据绑定。审计只读取源码和已有回执，并对有限输入做 hash 对照；**本次没有执行产品测试、门禁、构建、验签、设备命令、SQL、FFI 或意图内容读取，也没有修改生产代码。** 下文测试 PASS 均引用此前真实执行记录。

| 证据层 | 本报告使用方式 | 不支持的结论 |
| --- | --- | --- |
| 源码定位 | 调用链、条件分支、身份和生命周期合同；静态构造反例 | 未执行反例不称复现；不能证明设备已触发 |
| 既有本地回执 | 精确方法、SDK、变异负对照、索引叶子、构建签名 | 不扩展为整个业务或所有旧 sibling PASS |
| Linux debug 克隆 | 停态复制数据的目标事实、三方法读取与前后对照 | 不等于包内 release 二进制或当前原进程读取 |
| 原 VM 既有回执 | 指定候选、指定授权及时间点的观测 | 旧 a443 截图不能验收 0511；后时点不能追认前时点原因 |
| 物理机／用户 | 本轮未执行 | 不由 VM 或局部测试替代 |

独立审阅原件位于私有目录：[准入审阅](/home/administrator/Reader/.local/framework-closure-implementation-20261111/full-audit-20261111/admission-review.json)、[诊断审阅](/home/administrator/Reader/.local/framework-closure-implementation-20261111/full-audit-20261111/diagnostics-review.json)、[框架审阅](/home/administrator/Reader/.local/framework-closure-implementation-20261111/full-audit-20261111/framework-review.json)。这些是源码及既有证据复核，不是另一次独立设备执行。

## 3. 源码与产物身份

| 项目 | 已核对身份 |
| --- | --- |
| 最终候选 | `0.2.0.DEV.0511f567914d`；iteration；`x86_64` |
| 构建源码 | Host `def50fbc5c1d53252b103441420ef9e4fb55c18a`；构建时 Host clean |
| run | `20261111T034526Z-def50fbc-02199dc7` |
| manifest SHA256 | `d1dcb23e487f4002b111b507d7f50ad7aff85dc44e2ab9817334bbaf54f2d895` |
| HAP SHA256 | `d808ff60a48a863f8f7784b546a806c70c5f061e3c86798487978bca2387feb3`；227259884 bytes |
| 签名证书 | 指定 `minliny_HarmonyOS`；`3A563778E5BF17CD3EAD0218E13B4A5030DE3F5D7D4E21E0336D8EB37B676DC4` |
| 包内 Native SHA256 | `a8af9056205722d679638bb69f591f20cae8864b1a158635413f6fd3636b81dd` |
| release Core buildId | `f1fb293ab4b89eb8da52f3a5ca657491efa0350b55ab74ce3fadbe8e551096bf` |
| 存储声明 | max `47`；source `382b571b2057da12772096bad363e02b4b684da7e12e623f0c794301e0273deb` |
| 有效应用输入 | 既有完整对照 2153 项零缺失／不匹配；本次有限复核 38 个生产文件与冻结快照一致 |
| 实际构建警告 | 322＝313 throws＋7 capability＋2 native；missing-type/member 和 deprecated 均为 0 |

依据：[候选记录](/home/administrator/Reader/.local/framework-closure-implementation-20261111/candidate.json)、[manifest](/home/administrator/Reader/Reader-for-HarmonyOS/.reader-artifacts/hap/20261111T034526Z-def50fbc-02199dc7/manifest.json)、[应用输入身份](/home/administrator/Reader/.local/framework-closure-implementation-20261111/candidate-input-identity.json)、[诊断提交后的产物保全](/home/administrator/Reader/.local/framework-closure-implementation-20261111/storage-admission-diagnostics/candidate-preservation.json)、[实际警告](/home/administrator/Reader/.local/framework-closure-implementation-20261111/warnings-current.json)。

后续文档及隔离诊断提交不意味着已经重建或安装新 HAP。Core 仍有 `governance/workspace/DEVELOPMENT_BACKLOG.md`、`HAP_BUILD_SYSTEM.md` 及 `.local` 的既有 WIP；本报告不把它说成全仓 clean 或 Native 全工具链可逐字节重建。

## 4. 已实施部分逐批审计

| 批次 | 已证实完成的内容 | 尚未覆盖／保留条件 |
| --- | --- | --- |
| P0 | 生产链为 ReaderShell → ReadingExperience → Panel → ReaderControlRuntime；19 项行为清单与职责决定已形成 | 19 项是清单，不是 19 项全部运行通过 |
| P1 | 测量事实／Native 适配、retained／presentation、翻页准备与 minimum seam 已抽取；LRE 15131→14746 行，Panel 2561→2479 行；6 个必要 case、其中 2 个重新审定索引叶子 PASS | 拆分保持原算法；未审旧 fixture/sibling 不自动续期；原生时序和新包像素未验证 |
| P2 | 已选择 `REFERENCE_ONLY`；Stage 验证页从 cold-start/main_pages 关闭，生产继续只有 Panel/Runtime 时钟；3 个索引 case＋5 个真实负对照 PASS | Stage 未接管是已选合法退出分支；未来采用需另建等价证据 |
| P3 | 20 个 missing 和 32 个 deprecated 清零；TTS 能力守卫及降级、精确 task 释放保留；CoreCopyProbe 二次 I/O 边界修复；4 个新 case＋原 TTS 索引及必要 SDK／vendor patch 验证 PASS | 322 个警告仍在；7 capability 静态警告不因有守卫而消失；TTS 迟到取消条件风险见 F11 |
| P4 | 10 个 direct Scaffold、14 个 Standard 调用／13 文件、13 个 resolver 消费者已列合同；MainTabShell 重复正文求解及 4 页旧代回调修复；方法、清单、navigation 叶子 PASS | 16 个 layout 文件各有保留理由；不以凑到 10–12 个作为成功标准；原生布局／旋转未全验 |
| P5 Host | 未确认漫画候选的负结果可重新验证；迟到 R1 负结果不能删除新 R2 完整索引；17 组恢复性方法／真实回退反例 PASS | 源码修复在 0511，尚未在原 VM 生效；不恢复既有 evicted 数据 |
| P5 capacity | 自动容量维护无压力时停止新 claim；显式写入谓词、pending、expiry/clear、Core 保护和顺序保留；17 组行为＋2 组 SDK PASS，真实旧源码 FAIL 保留 | 新 DiskCache SHA `552915bbf2b141f9b582b37ae3e6bb87fddd52345e4e05ee2edb10282418929f`；不能据此倒推历史 0/2 成因 |
| P6 | 最终编译、指定签名、产物输入绑定 PASS；失败的正式准入及停止执行有完整记录 | 新包安装／启动／像素、完整产品回归、物理机及用户验收未完成 |

框架依据见[实施总表](/home/administrator/Reader/Reader-for-HarmonyOS/docs/architecture/framework-closure-implementation-20261111.md)、[阅读决定](/home/administrator/Reader/Reader-for-HarmonyOS/docs/architecture/reading-renderer-decision-20261111.md)、[恢复与 revision 回执](/home/administrator/Reader/.local/p5-negative-revision-result.json)、[capacity 回执](/home/administrator/Reader/.local/framework-closure-implementation-20261111/p5-capacity-eviction-result.json)。恢复用例旧记录的 DiskCache 整文件 SHA 早于 capacity 修改，但所提取 `readValidManifest` 方法字节一致；不能把旧整文件 SHA 冒充最终文件身份。

**隔离诊断的本地实现也有独立证据。** `641be0ab` 新增纯分类器和严格手动 CLI，没有改两个冻结 controller；此前精确选择的原读取器 4 个 case、新诊断 24 个 case、CLI 7 个 case PASS。默认／list 在工具发现、租约和设备读取之前退出为 NOT_RUN，未挂构建、签名、CI 或 full。跨文件复制授权复用已由同一私有 grant ledger 防重；原生 HDC 类型／SHA、原 VM／guest、现场确认、预算和脱敏约束有有限验证。较后 marker／宽日志／routePrediction 均不拥有正式准入。原审批超时、测试装配失败及修正记录保留；F09/F10 和可信环境边界仍开放。依据：[本地诊断结果](/home/administrator/Reader/.local/framework-closure-implementation-20261111/storage-admission-diagnostics/result.json)。

## 5. 当前准入阻断：已查明到哪一层

### 5.1 正式 inspect 与后续只读诊断必须分开

| 事项 | 正式更新尝试 | 后续新指令“查清楚”的只读诊断 |
| --- | --- | --- |
| 结果 | `FAIL / STOP / exit 3` | `DIAGNOSTIC_COMPLETE`，当前直接阻断已定位 |
| 路由 | `target-sqlite-version-unresolved`；三个关键值均 null | 初读预测仍相同拒绝；不是再次正式 inspect |
| 应用动作 | stop/install/start/UI/截图全 0 | stop/install/start/DB copy/SQL/FFI/intent read 全 0 |
| 目标 | 原 VM、a443、UID 和书架身份通过 | 原 VM／guest／BMS 通过；读日志前后单一数字 PID 稳定 |
| 授权 | 准入失败即停；已关闭 | 新指令授权的一次只读范围；已消费并关闭 |

诊断实际记账：HDC 19 条＝现场发现 1＋CLI 前置 10＋业务 8，另有宿主 CIM 1。没有保存原始 Reader 日志或意图内容。按 PID 与宽 Reader 两次日志的 HDC 客户端均 exit 0、stdout/stderr 各 0 bytes；header canonical 读取输出为 0 bytes，未取得 100-byte 样本。较后 marker 确认当时 WAL 非空、journal 非空否。

因此：

- `header-output-malformed` 描述的是读取器收到的输出形状，不是已经读到损坏的 SQLite header。
- 后续 WAL 非空符合运行中 header 拒绝的设计，但不能追认为前一条复合命令的确定退出原因。
- HDC 客户端 exit 0 不能证明远端 hilog 的退出码；空日志的具体机制仍未确定。
- 去掉 PID 过滤仍空，说明只改 PID 选择不能从这份观察得到身份记录。
- header 即使读出 47，同来源路径仍需要有效的 lineage/source/max；单读 header 不能放行。
- 本次细分不能追认旧 inspect 的所有子原因，也不能替代正式重验或复用已经结束的安装授权。

历史 a443 启动日志确有 identity/userVersion47 和 ready；同一旧数字 PID 后来已有成功返回零字节的记录。这证明历史启动成功与以后日志缺失可以并存，不能把旧日志当成当前运行实例的来源证明。没有证据把空输出唯一归因于日志轮转、配置关闭或权限。

依据：[正式失败](/home/administrator/Reader/.local/framework-closure-implementation-20261111/final-vm-0511/result.json)、[只读 observation](/home/administrator/Reader/.local/framework-closure-implementation-20261111/storage-admission-live-20261111/observation.json)、[脱敏报告](/home/administrator/Reader/.local/framework-closure-implementation-20261111/storage-admission-live-20261111/diagnostic/report.json)、[解释复核](/home/administrator/Reader/.local/framework-closure-implementation-20261111/storage-admission-live-20261111/diagnostic/interpretation-review.json)。

## 6. 问题清单与影响

优先级是修复顺序：P1 为交付主阻断或可能改变正式准入真实性的缺口；P2 为状态、兼容性、隐私或生命周期合同问题；P3 为文档／运维边界。静态条件风险不等于实际发生事故。

### F01 · P1 · 正式来源证明依赖可丢失的启动日志

**状态：代码合同缺口确定；当前空输入实际发生。** [readInstalledStorageLineage](/home/administrator/Reader/Reader-for-HarmonyOS/scripts/lib/hap-storage-admission.mjs:48) 只从 hilog 中组合 identity＋ready。Host 的启动 trace 由 debug 配置控制，日志写入也有失败隔离；健康进程并不保证永远能查询到这两条记录。header 可因正常 WAL 拒绝，此时缺日志就连版本也无法建立。

影响是合法保数据更新长期卡住；当前表现符合这一失败模式。永久修复应复用**当前已 ready 的 RuntimeOwner** 做有界只读 `core.info` 观测，绑定当前 owner 和请求身份。禁止为了查询而 start/recover、新建 Runtime 或另开原库 SQLite 连接。短期 0511 可另走候选绑定的停态快照＋正式 clone 证明。

### F02 · P1 · canonical 解析器接受嵌入式身份文本

**状态：解析边界缺口确定；未发现实际误放行，输入可控性未证实。** [旧正则](/home/administrator/Reader/Reader-for-HarmonyOS/scripts/lib/hap-storage-admission.mjs:58) 在整行中搜索 `/Reader: Core build identity: {...}` 和 `/Reader: READER_STARTUP {...}`，只约束末尾。普通 Reader 消息中若嵌入该后缀，可在静态构造输入下被当作真实 identity/ready。

新诊断的**宽日志计数器**已经约束 OS 前缀及消息起点，但没有修复旧正式解析器。后续控制器必须先解析可信 OS 前缀／PID，再要求消息体从固定 token 开始，并校验 schema、会话、事件顺序及当前 owner 身份；嵌入、拼接、跨 PID 和旧会话负例必须拒绝。不能用旧日志重放提供当前来源。

### F03 · P2 · 数字 PID 与旧 ready 不能充分证明当前会话

**状态：源码时效合同缺口；本次没有证明 PID 复用或旧 ready 误用。** 读取前后只比较数字 PID，没有进程出生标识、owner generation、关闭状态或请求 nonce。同 PID 内旧 runtime 的 ready 在关闭后仍可能留在日志中；任意历史匹配坏 JSON 又会使后来正常会话整次返回 null。

修复应定义 boot／process instance／owner generation 和 closing 失效合同，读前读后校验；用挑战 nonce 和有效期证明当次响应。旧会话坏记录能否隔离必须依赖已审定的会话边界，不能简单跳过坏行来变绿。

### F04 · P2 · `sqliteUserVersion` 的一次可选采样可能永久缺失

**状态：源码分支确定；不是当前零字节日志的已证实原因。** [core.info](/home/administrator/Reader/Reader-Core/crates/reader-runtime/src/runtime.rs:1690) 取值经过 [try_user_version](/home/administrator/Reader/Reader-Core/crates/reader-storage/src/sqlite_backend.rs:1825) 的 `try_lock().ok()?` 和 SQL `.ok()`；忙或读取失败会得到 None。Host 只在启动身份输出时采一次，日志即使存在也可能没有版本。

永久端口应返回明确的 unavailable；仅在已 ready 的同一 owner 内允许有界重读，实际无法区分原因时仍写 unknown。不得用 max、历史 47 或编译常量填充当前值。

### F05 · P2 · 查询失败与解析无事实被折叠成空字符串

**状态：canonical 诊断能力缺口确定，隔离工具已部分缓解。** [optionalQuery](/home/administrator/Reader/Reader-for-HarmonyOS/scripts/hap-pipeline.mjs:2068) 把异常统一变成 `''`，旧解析器再返回 null。重读失败和真正内容变化也可能同报 `target-storage-evidence-changed`。

未来控制器应保留 transport／parse／currentness 的脱敏子原因，不保存原日志或业务 payload，不让诊断字段改变原准入结果。已完成的新工具证明了本次缺输入，不能倒填旧失败的细节。

### F06 · P2 · 同来源路径二次校验不对称，替换前缺统一重验

**状态：源码窗口确定；未发现本次竞态。** [现有复核](/home/administrator/Reader/Reader-for-HarmonyOS/scripts/hap-pipeline.mjs:2083) 在 header 成功时只重读 header，不重读实际用于来源判断的 lineage；header 空时才重读 lineage。只有 transition 路径提供[替换前 callback](/home/administrator/Reader/Reader-for-HarmonyOS/scripts/hap-pipeline.mjs:2157)。server lease 为命令级，不能阻止全部外部行为。

应返回统一 validation handle，在替换前重验所有已用事实：BMS、进程／owner 实例、generation、版本与来源。锁范围、失效和外部操作者边界要明确，不能叠加会自锁的 server lease，也不能声称消除了 OS 替换全过程的全部竞态。

### F07 · P2 · same-source 缺 ABI 硬校验；安装后缺 UID 保留校验

**状态：两个源码检查缺口确定；当前双方均 x86_64，没有 ABI／UID 异常事实。** [deploymentRoute](/home/administrator/Reader/Reader-for-HarmonyOS/scripts/hap-pipeline.mjs:1939) 同来源路径未比 installed.cpuAbi 与 candidate ABI，transition 分支则有此条件。[postInstall](/home/administrator/Reader/Reader-for-HarmonyOS/scripts/hap-pipeline.mjs:2167) 检查签名和版本后可直接启动，未显式要求 UID 等于安装前 UID。

后续控制器应在替换前检查精确 ABI 或已验证兼容边，安装后启动前检查 UID、签名、版本／build 及包身份。缺失或不一致即停，保留已安装状态与失败回执，不卸载／清数据／自动重试。

### F08 · P2 · 存储来源指纹的等价域不等于完整兼容域

**状态：指纹覆盖边界确定；未证明实际不兼容。** [build.rs](/home/administrator/Reader/Reader-Core/crates/reader-runtime/build.rs:128) 哈希 reader-storage 的 Cargo.toml 和 src（含测试代码），未覆盖 workspace Cargo.lock 及实际 SQLite 依赖闭包。测试代码变更可能制造假不一致，依赖闭包变化也可能不改变该 source hash。

应版本化定义“生产格式／有效存储输入”的指纹域，纳入相关依赖版本及影响格式的 flags，或登记真实验证过的兼容边。不能把 source 相同说成 Native／依赖全等价，也不宜用整个 Native hash 迫使每次无关重编译都重做迁移证明。

### F09 · P2 · 后置 marker 的防符号链接检查保护不了前置 header 读取

**状态：读取边界缺口确定；未建立本次不安全读取或 UNKNOWN 泄露。** [diagnostics 顺序](/home/administrator/Reader/Reader-for-HarmonyOS/scripts/lib/hap-storage-admission-diagnostics.mjs:321) 先调用旧 header 读取；[旧命令](/home/administrator/Reader/Reader-for-HarmonyOS/scripts/lib/hap-storage-admission.mjs:25) 的 od 前没有 DB leaf 的 no-follow 条件。较后 marker 才检查 `test -L`。若静态构造 leaf symlink、无同名 WAL/journal，读字节可能早于拒绝发生；最终 UID／格式拒绝不能撤回已发生的读取。

必须在读边界先建立安全路径和普通文件条件；仅加前后 `test -L` 仍有并发换链窗口，不能称为原子 no-follow。优先复用现成 owner 观测；若必须读 header，采用能证明安全的受信原子适配，否则不读并保留 NOT_RUN／unknown。修改旧 canonical 需进入新控制器，不能偷偷改 0511 冻结文件。

### F10 · P2 · 客户端 exit 不能区分远端失败与成功空输出

**状态：诊断能力缺口确定；本次远端状态未观测。** [summarizeProbeResult](/home/administrator/Reader/Reader-for-HarmonyOS/scripts/lib/hap-storage-admission-diagnostics.mjs:27) 的 exitCode 来自 HDC 客户端；[执行器](/home/administrator/Reader/Reader-for-HarmonyOS/tools/diagnose-storage-admission.mjs:154) 未单独封装远端程序退出状态。

新协议应区分 clientExitCode 与 remoteExitCode/unknown。确需观测远端时，用固定、有界、随机 nonce 收尾协议验证完整 trailer；保留原 payload 字节语义、只输出元数据，缺帧／伪造／截断均 unknown。它不能回填本次远端结果，也不应因诊断成功而开放安装。

### F11 · P2 · TTS 释放失败后的监听退役存在条件性活性风险

**状态：分支确定，后果待 SDK 语义与局部用例验证；不是 P3 新引入。** [close](/home/administrator/Reader/Reader-for-HarmonyOS/entry/src/main/ets/platform/tts/HarmonyTtsBackgroundSession.ts:172) 捕获 stopOwnedTask 失败后仍可成功 off，将 observing 设 false，但保留 taskId／retiring。如果平台随后取消旧 task，而后续 stop 对不存在 task 继续拒绝，旧 owner 收不到迟到取消证明；[新 owner activate](/home/administrator/Reader/Reader-for-HarmonyOS/entry/src/main/ets/platform/tts/HarmonyTtsBackgroundSession.ts:69) 可能持续被旧退休状态挡住。

先补实际类的单个有限情景及目标 SDK 语义确认，再决定最小修复：未结算前保留取消监听，或以权威的精确 task 不存在证明结算。保留 ID／失败证据，不能使用 stop-all 或吞异常来放开新任务。

### F12 · P3 · 当前摘要未突出正式失败与后来诊断

**状态：本报告同步修订关闭。** 框架总表原本正确写了未安装，但没有直接展示选中 inspect FAIL；诊断指南仍停留于“本地实现、无实际新原因”。现补精确失败、新诊断和本报告链接。原始计划、旧 pending/FAIL、旧组数和原始回执不改写；新结论只在当前摘要和新索引追加。

## 7. 漫画 0/2：当前事实与历史因果

1. **源自 09:07 安装前复制的后继工作副本**：该副本已经被 Runtime 打开过，不能冒充原始停态快照；在这份旧谱系数据中，第 0 章没有选择事实／正文／metrics，第 1 章 cached 且 version/entry 匹配。它不是现在设备的直接读数。
2. **新停态复制的克隆**：在 Linux debug bootstrap 之前，目标书 heads／retention／receipts 已为 0；manifest 3 与 evicted 3 的身份集合一致，chapter_cache／metrics／INNER JOIN 均为 0。三方法观察两章 missing，无 version/candidate；目标事实前后未变。
3. **Host**：先前只读范围确认旧第 1 章 manifest 与 6 个登记文件完整。文件存在不恢复 Core 有效版本准入，也不能使无 candidate 的章计成完成。
4. **旧／新 Core 差分**：旧 `2a301653` 上限 38，当前后继快照为 47，旧 dirty 输入闭包也未核定，不能在此数据上构造公平内容差分 PASS。Linux debug buildId `b86db899` 与包内 release `f1fb293a` 不同。

**当前复制数据与 0/2 一致，未发现计数层必须改成 2/2 的依据。历史 2/2→0/2 的撤销者、时间及调用仍未建立。** URL 身份漂移、metrics 缺行最初是合理待查假设；现在目标数据连有效选择事实都缺失，不能继续把初始假设写成已证实原因。此前正常已授权恢复启动可能运行原 a443 的维护路径，不能据 agent 未执行 SQL 就排除应用写入。

负缓存、迟到 revision 和无压力 capacity 缺口已独立修复，但没有证据证明它们创建了这些历史 evicted 行。0511 未上设备，既有 evicted 未恢复。漫画冷续读继续 `NOT_RUN_NO_ADMISSION`；若需要恢复离线能力，另行定义数据恢复／重新下载的业务方案，不能改 Core count、迁移、LEFT JOIN、标题旁路或直接补 heads 来制造通过。

依据：[当前克隆解释](/home/administrator/Reader/.local/framework-closure-implementation-20261111/current-core-observation/interpretation.json)、[Host 有界观察](/home/administrator/Reader/.local/framework-closure-implementation-20261111/p5-host-readonly-bound/result.json)、[当前总账](/home/administrator/Reader/.local/framework-closure-implementation-20261111/final-results.json)。

## 8. 必须保留的保护与非问题

- 非空 WAL/journal 时拒绝直接 header 是数据保护，不是需要删除的障碍；不清 WAL、不 checkpoint 原库、不临时打开原库 SQLite 来求版本。
- 同来源要求 source/max 和当前版本，单一 47 不够；正式 transition 必须候选、目标、快照和正式结果全部绑定。
- 0511 的两个 controller 文件未变；旧 a443 transition 只属于旧包／旧快照／旧 updateTime，不能复用。
- 单次授权 ledger 对同一可信 host/namespace 防重有效，不是跨主机、可改环境变量／可删 ledger 的全局权限系统。
- HDC hash 是被核对的工具字节快照；若可信工具路径能被并发替换，稍后 pathname spawn 仍有窗口。未观察到本次替换。
- 正常 timeout/finally 的 lease 释放有边界；SIGKILL／主机崩溃的孤儿进程清理未被证明。未观察到本次异常终止。
- UNKNOWN 只按历次明确范围做 stat/hash，agent 未读取内容。相同 hash 不证明原业务操作已确认，也不证明整个数据库不变。

## 9. 交付开放项与可接受结论

| 编号 | 当前状态 | 关闭所需证据 |
| --- | --- | --- |
| D01 0511 安装 | 阻断；正式 inspect FAIL，未安装 | 新的候选绑定正式准入＋保数据安装回执；启动前身份／UID 复核 |
| D02 新包阅读像素 | NOT_RUN | 同一已准入候选的真实生产入口、有界控件开关与画面；旧 a443 图不替代 |
| D03 阅读广域行为 | 按行部分未执行 | 按改动风险选择必要矩阵项，逐项说明入口／嵌套／必要性；不默认扫全 19 行 |
| D04 漫画当前冷续读 | NOT_RUN_NO_ADMISSION | 合法可用 candidate；无 candidate 时只能继续未执行或另立恢复业务范围 |
| D05 漫画历史因果 | 未建立 | 能绑定时间、owner、调用和撤销事实的证据；证据不可得时保留未知，不承诺强行查成结论 |
| D06 完整回归／物理机／用户验收 | NOT_RUN | 明确正式发布或整体验收集合、对应环境与用户实际确认 |
| D07 UNKNOWN 原操作结果 | 未证明 | 原业务 owner 的正式事实；本次审计不扩大读取／重放范围 |

本次允许的最终表述是：**本轮代码与产物可信、当前准入阻断已缩到缺少 live lineage 输入、后续修复边界已明确；设备交付和整体用户验收仍开放。** 实施顺序、最小检查集合、失败停止点及两条交付路线详见[可执行修复方案](/home/administrator/Reader/Reader-for-HarmonyOS/docs/architecture/reader-delivery-remediation-plan-20261111.md)。
