# Reader 审计问题修复与交付方案

> 状态更新：以下为 Host `641be0ab`／候选 `0511` 的审计基线与原计划，保留历史事实。用户随后要求“全量修复”的当前实施与逐层结果见[遗留修复实施记录](/home/administrator/Reader/Reader-for-HarmonyOS/docs/architecture/reader-residual-repair-implementation-20261111.md)。

日期：2026-11-11。输入是[本轮全量审计报告](/home/administrator/Reader/Reader-for-HarmonyOS/docs/architecture/reader-delivery-full-audit-20261111.md)，基线 Host `641be0ab`，候选 `0511` 未安装。本文件是可审阅的实施计划；**除文档一致性补正外，以下修复和设备动作均未执行。**

遗留深化后的执行优先级见[详细遗留分析与解决方案](/home/administrator/Reader/Reader-for-HarmonyOS/docs/architecture/reader-open-issues-analysis-and-resolution-20261111.md)。指纹域升级已从所有交付的共同前置解耦；被动owner通信需先证明可行，不能把字段设计当成已有端口；新增明确的Host页码水合修复单独实施。这里的B路线是可选模块集合，不要求全部串行完成才处理其他遗留。

## 1. 先分开两个交付目标

**推荐优先修永久合同，再交付后续候选；0511 作为已冻结、可审计的回退交付选项保留。** 当前没有发布期限迫使重复停启原应用；先做源码侧修复能同时处理日志依赖、解析边界和身份复核。若明确要求先把已经完成的 framework／capacity 修复交给原 VM，则采用短期 A 路线，不直接修改冻结控制器。

| 路线 | 目的 | 允许改动 | 代价与边界 |
| --- | --- | --- | --- |
| A：交付冻结 0511 | 不重建现有应用包，先交付已完成修复 | 独立计划、证明生产工具和私有证据；绑定的两个 controller 字节保持不变 | 需要新停态快照＋正式 clone 兼容性证明、独立保数据安装与启动范围；正式控制器的遗留缺口需外层硬检查弥补 |
| B：后续候选 | 永久修准入／诊断／生命周期合同 | 新控制器、必要 Core/Host 窄端口、精确局部测试及新候选 | 当前 a443 没有新端口；不能让新 CLI 假装旧进程已提供观测；必须用合法证明先准入新包 |

两条路线的证据不混用。修改 `hap-pipeline.mjs` 或 `hap-storage-admission.mjs` 会使 **0511 `--storage-transition`** 的 controller 指纹比较失败；不得修改旧 controller-snapshot、manifest 或旧回执来迁就新代码。普通 inspect 没有同样的当前 controller hash 条件，也不能借此把新逻辑伪装成冻结路径。

## 2. 所有批次的执行合同

每批只有一个修改 owner。Core、Host、工具边界顺序提交；并行 agent 可只读审阅，不同时改同一合同。保留现有 dirty WIP；本轮不 reset/stash/清库、不改 count/schema/migration、不重开视觉设计或分页算法。

每项检查执行前必须写入该批清单：**实际入口、嵌套调用、触发范围、具体风险、本次必要理由**。下表测试名为待实现的情景说明，未登记为现成 gate ID，不能直接报 PASS。已有索引只按精确叶子选择；普通修复不跑 full，不因失败扩大集合，也不把本地测试挂入构建／签名默认入口。

任何设备动作先形成具体可审阅方案，记录源码侧已排除范围、待回答问题、精确目标、动作总额和失败恢复规则，再确认当时有效授权。已结束的复制、安装、只读诊断范围不续期。本报告／方案本身不授予新停启或安装额度。

## 3. B 路线：永久修复批次

| 批次／唯一 owner | 输入与动作 | 本批必要检查 | 退出条件／停止点 |
| --- | --- | --- | --- |
| B0 证据 owner | 冻结 0511 的应用／Native／controller hash；汇总 12 项 finding、现有 FAIL 和开放项；修当前摘要链接 | 文档和有限 identity／链接一致性读取 | 摘要明确正式 inspect FAIL、0511 未装、scope 关闭；历史原件不改。本批文档补正已做 |
| B1 协议 owner | 先定义当前 owner 观测、版本缺失、会话时效、指纹域和启动前后身份合同 | 只读现有接口／固定依赖／目标 SDK 能力审阅；不先写新 IPC 框架 | 一份字段、状态、认证、预算、错误、关闭失效协议；现有能力不足写出具体差距后才选薄适配 |
| B2a Core 声明 owner | 修改 reader-runtime/build.rs 的指纹域、声明协议／Native provenance；若需要，提供实际版本 unavailable 的窄状态；处理 F08 及 F04 的 Core 部分 | 生产格式相关依赖／flags 改变触发指纹，纯测试噪声按已定域处理；新旧声明比较与未知域拒绝；可用／不可用版本分开 | 新旧域兼容合同明确；不改 schema/count/migration；Core输入、Native重建及候选绑定可核对，不把Host日志改名当成Core修复 |
| B2b Host Runtime owner | 先证明可信且不激活应用的通信可行性，再复用已 ready 的 ReaderRuntimeOwner／现有core.info字段；处理 F01/F03/F04 的 Host 部分 | 真实方法：未 ready／closing／await 后换代拒绝；版本 unavailable；同 owner 可用；请求身份及预算 | 不 start/recover、不新建 Runtime、不新开原库 SQL 连接、不读 UNKNOWN；缺少事实仍拒绝；使用当前正式协议，若采用B2a再同步 |
| B3 部署控制器 owner | 严格消息起点及会话校验，结构化子原因、统一 validation handle、ABI 和安装后 UID fence；独占修改正式共享 header 读取边界；处理 F02/F05/F06/F07/F09 | 正常可信记录接受；嵌入／旧会话／跨 PID 拒绝；所有使用事实重验；ABI/UID 缺失和变化拒绝；不安全路径读前拒绝 | 新控制器的全部必要正反例通过；替换前重验，启动前 UID／签名／版本相符；不放宽保护 |
| B4 诊断工具 owner | client/remote 状态协议与读前路径安全合同；处理 F09/F10，明确工具／ledger／异常终止边界 | 假 remote runner／合成文件情景；不得执行真实 HDC 或开真实库 | remote unknown 不变成功；unsafe/unknown 路径读前拒绝；无 raw payload 落盘；冻结旧模式不被偷偷改写 |
| B5 TTS owner | 先验证 F11 的精确任务退休情景；成立才改最小监听顺序 | 实际类情景：stop 失败→off／迟到 exact cancel→新 owner；SDK 不存在 task 语义 | 旧 task 结算有权威证据，新 owner 可继续；不丢 exact ID、不 stop-all；若风险被 SDK 契约排除则记录依据不改生产 |
| B6 候选 owner | 绑定最终生产输入、编译 iteration 目标、指定证书签名；选择合法准入证明 | 仅触达的精确检查及构建直接必要输入／签名／包名检查 | 新 immutable manifest/HAP/controller/source 身份一致；旧失败保留；未安装状态准确 |
| B7 验收 owner | 新准入后的有界安装、启动、阅读像素；漫画按真实 candidate 决定是否可进入 | 新具体范围内的 canonical inspect、保数据安装和必要生产入口；不默认全量 | 代码／本地／构建／安装／像素／物理／用户分层记账；剩余未执行明确列出 |

依赖按实际选择分开：B0→B1→B3→B6→B7可先沿正式proof完成控制器修复／交付；若采用被动owner观测，B1证明通信可行后才加入B2b，再由B3消费。B2a指纹域升级及Core缺值原因细分不是F01/F04、B4、B5或历史调查的强前置；只有确需新增Core字段／改变有效存储输入时才纳入并重建绑定Native。B4可依固定合同独立开发，与B3不改同一读取器；B5与准入解耦。B6先完成确定纳入本候选的生产改动，避免连续重建。

目前尚未证明存在供CLI被动查询当前owner的既有入口；普通Want／aa start可能激活应用，不作为只读替代。nonce/TTL/generation只定义响应合同，不能自行证明通信认证和不激活。通信不可行时保留正式停态proof路径，不强装启用新端口。若日志退出正式准入权，移除其正式调用链，不为收口再维护第二套正式会话解析器；若保留则严格修复其消息和当前性合同。

当前 a443 不具备 B2b 的新观测端口，B6/B7 的**第一次安装不能依赖尚未安装的新端口自证**。需要沿正式停态 clone 兼容边为新候选生成绑定证明，或另有当时真实有效的既有正式路径；新指纹域若改变须先定义并实现显式兼容边。不存在有效路径就停止交付，不强装来“启用诊断”。

### B1/B2a/B2b：当前 owner 观测与 Core 声明合同

优先检查项目已有 RuntimeOwner／诊断端口与依赖，复用已有能力；不另造通用 RPC、SQL 探针或日志数据库。实现选择必须符合当前平台认证及权限边界，不能只凭字符串 nonce 就称可信来源。

建议的最小响应包括：协议版本、请求 nonce、生成时间／短有效期、boot/process instance、数字 PID、appBuildId、owner generation、ready/closing、Core buildId、storage declaration、实际 userVersion 或 unavailable。控制器同时绑定现场 BMS、签名摘要、UID、updateTime、ABI 和准确 target。字段以真正可验证能力为准，不能填猜测常量。

时序应是：

1. 入口确认**既有** RuntimeOwner 已 ready；若未运行／未 ready，立即返回 unavailable，不启动应用。
2. 固定 owner／generation，调用同一 Runtime 的只读 core.info；不调用 ensure/start/recovery，不打开第二条原库连接。
3. await 后再确认 owner、generation、closing 和请求有效期；任一变化拒绝本响应。
4. 替换前验证 handle 的全部实际依据；如果应用已停，使用明确审定的停态证明路径，而不是保留旧 ready。

`try_user_version` 的 None 目前混合锁竞争和读取失败；能区分才输出 busy/error，不能区分则 unavailable/unknown。有界重读必须固定次数和 owner，不能轮询至成功。日志仅保留诊断用途，旧匹配坏 JSON 不再承担当前事实的唯一否决权，但这需要严格的新会话合同支持。

存储指纹先确定语义：生产格式相关源码、有效 SQLite 依赖版本及影响格式的编译选项，或明确的已验证兼容边；排除纯测试噪声。固定现有上游版本和许可，不开发新的通用算法。V1 声明如何比较、新旧混合时如何拒绝、何时必须 clone 证明要写明；不能把旧 source hash 直接改名宣称覆盖了新域。

### B3：正式解析与部署重验的最小情景

执行前给以下情景绑定真实测试入口和准确 selector；测试真实生产方法，避免只测复制实现：

| 情景 | 预期 | 保护风险 |
| --- | --- | --- |
| 可信 OS 前缀、精确消息体、当前会话 identity＋ready | 接受；版本／source 相符才允许 | 正常路径不因修复失效 |
| 普通消息嵌入 identity／ready 后缀、跨 PID、截断、非法 schema | 拒绝 | F02 假正式记录 |
| 旧 ready、closing、新 native-open 未 ready、owner 换代／PID 实例变化 | 拒绝 | F03 旧会话重放 |
| header 47、lineage 缺失；header 空、lineage 有效；header 48 | 分别拒绝／按合同允许／拒绝 | 不把 header 或 max 当来源 |
| header 成功但 lineage 在替换前变化；BMS 或版本重读失败 | 拒绝并给脱敏子原因 | F05/F06 不对称复核 |
| 目标 ABI 缺失／不同；安装后 UID 缺失／改变 | 替换前或启动前停止 | F07 硬身份合同 |
| transition 的候选、快照、controller 任一不匹配 | 拒绝 | 不借新实现冒用旧证明 |

重验 handle 不只包含允许标志；要记录所用依据及其身份，避免 header 成功时遗漏 lineage。命令级 lease、目标锁、run 锁的职责分开；新增锁必须评审等待顺序，不能在持有同一 server lease 时再申请自己。安装成功而后置身份失败应明确“包已安装、未启动”，不能写回滚成功或自动卸载。

### B4：诊断修复的读前隐私与远端状态

client 与 remote 使用两个字段，unknown 必须保留。nonce 收尾只解析完整且匹配当前调用的固定帧，原 payload 长度按原 Buffer 统计；不把帧本身算日志，不保存原输出。需要的情景包括 client0＋remote1、client0＋remote0＋空、缺帧／伪帧／截断、timeout／output-limit 的部分输出。

header no-follow 必须在读取发生前实现，且覆盖路径归属及并发假设，包括 **canonical 首次 header 读取及诊断补充读取**。晚到 marker 不是前置条件；前后 `test -L` 不是原子安全证明。B3 owner 独占修改正式共享读取边界；B4 owner 只修改诊断适配、状态协议及调用准入，不并行修改同一读取器。若现有平台不能提供可信原子边界，所有相关读取在该条件下均不执行，明确记录 canonical header 未执行／无版本，转 owner 或正式停态复制路径；不能只禁用 marker 而先运行旧的不安全 header 调用，也不能编造其原判定。不得为了诊断去打开原库。合成 canary/临时文件验证“不安全路径无法到达读字节”，不用真实 DB／意图作为样本。

保留单次授权 ledger 与直接原生 HDC 的现有改进，同时写明可信工具路径、固定 host/namespace 的前提。跨 host 防重、SIGKILL 清理若成为实际需求，再单列最小本地进程情景；不把它们当成已经发生的设备事件，也不顺带追加现场诊断。

## 4. A 路线：冻结 0511 的短期交付

本路线只解决已冻结包的合法准入和交付，不关闭未来控制器的全部问题。新授权前，先准备脚本、目标清单、文件接收方式、proof 输出结构及明确停止条件；不先停应用再补方案。

| 批次／唯一 owner | 动作 | 退出条件 | 失败退出 |
| --- | --- | --- | --- |
| A0 产物 owner | 核对 manifest/HAP/Native、应用输入及两个 controller；补外层 ABI／UID 检查计划；停应用前确认冻结 Core 输入归档、3 个测试定义、工具链及证明组装器能够合法产证 | 所有身份精确相同，目标仍是原 VM；测试定义／输入关联和工具可用，不修改冻结文件 | 任何不一致或缺工具先停，不换“最新包”或目标；不在停态后补环境或新增定义冒充旧候选 |
| A1 快照 owner | 新范围内确认空闲，按固定额度停止；无 app UID 进程时只复制 DB/WAL，使用已验证 file recv -b；本地长度/hash 对照 | 精确源 pair、复制前后 stat/hash／无 journal／路径合同成立；原文件不写；UID/签名/updateTime/ABI 绑定 | 传输／身份／稳定性失败不自动重试；保留状态，按预先约定恢复额度处理 |
| A2 兼容性 owner | 核定与候选关联的 Core 输入闭包，在私有 disposable clone 上经正式 FFI constructor 生成既有 Library47 证明，记录实际本地工具链／profile | 5 项合同事实有真实执行依据；所有资源、结果、快照、目标和 0511 HAP/controller 绑定 | debug 三方法观察、旧 a443 整份证明不能替代；任一缺失为 FAIL，不能删弱 case |
| A3 安装 owner | 新范围下 canonical inspect 和 canonical install 都携带同一准确 transition proof；建议明确请求分段 install --no-launch，实际 -r 由 canonical install 发出 | 正式 allowed；包安装后 UID 保留、签名／版本／build 相符；尚未启动时 receipt launch=NOT_RUN | 9568332／9568320、目标／UID 不一致立即停；不卸载、不清数据、不重新签其他证书 |
| A4 验收 owner | 仅身份核验后按额度正常启动最多一轮；分开记录 start 接受、书架／文字可见、published 是否可观测；本地文字书一次、面板开关一次、最多两张阅读图，回书架 | 精确 0511 的分层回执和图片；有实际 published 观测才确认该层；漫画仅真实 offline candidate 准入后另定范围 | published 不可观测就保留未确认并结束本轮设备动作，不重复启动；没有 candidate 不进漫画，不旁路／重下／改计数 |

**A1 成功复制后直至 A3 替换前最后校验，原应用必须保持停态。** 需重新核对无 app UID 进程、BMS 身份及源 DB/WAL pair 与证明完全一致。中途恢复启动、出现应用进程或源 pair 改变，都使该 proof 不能继续用于安装；保留旧证据，重新规划具体范围，不在旧额度里补复制／重试。证明生成可能耗时，停态时间及占用上限应在 A1 之前写入新计划。

`inspect` 与 `install` 各自都会重新 `resolveDeployment`，所以两者均须通过 `scripts/hap-pipeline.mjs` 并携带同一 `--manifest <0511准确manifest>`、`--artifact signed`、`--target <准确目标>`、`--target-kind vm`、`--vm-log <现场实例日志>` 及 `--storage-transition <新receipt>`。安装命令按明确分段范围再加 `--no-launch`。不能只给 inspect 传 proof，然后直接发裸 HDC install 或漏掉 install 的 transition 参数；后者会重新落回当前空日志路径。

A4 不预设重启会恢复 hilog。若发布态证据被选为硬性退出条件，须在新设备计划里先定义该包实际支持的观测入口、查询上限和失败停止点；缺少可用入口则该层继续未确认。aa start 成功只证明系统接受启动，书架／正文可见证明相应生产路径，二者不能替代未观测到的 published。诊断和取图的只读命令数也需纳入新范围，不能藏在“一次启动”额度中。

两个冻结 controller 的 SHA256：

- `scripts/hap-pipeline.mjs`：`3df8327c509030cda8f5ad67e4ace46cadff06fee7827970efa8ba4445768bae`
- `scripts/lib/hap-storage-admission.mjs`：`a1e618f43c8aaf76ed76dcbec51a061edd0d8ea0fb51700b42c3bfe6db54f4c9`

正式合同为 `reader-library47-compatible-open-v1`，既有准确 case 为：`format-admission`、`formal-runtime-bootstrap`、`l0-writer-preservation`、`cold-reopen`、`whole-snapshot-rejection`。执行前还需列出其实际生产入口、嵌套与固定 ABI 工具链；这五项只保护此兼容边，不授权跑全量套件。当前没有 0511 的新绑定 proof，不得把本方案当成 proof。

当前源码中对应的是 **3 个唯一 Rust 测试入口、5 个合同事实**，不是机械执行 5 遍同一程序：

| 合同事实 | 既有精确入口 | 嵌套及必要性 |
| --- | --- | --- |
| format-admission | `reader-storage --lib --features sqlite` 的 `sqlite_backend::compatibility::tests::known47_real_open_retains_layout_and_rejects_whole_snapshot` | SqliteStorage 真实已知格式打开／快照拒绝，保护格式准入 |
| l0-writer-preservation | 同 target 的 `sqlite_backend::compatibility::tests::known47_metadata_progress_cache_queue_and_receipt_writers_survive_reopen` | 真实 metadata/progress/cache/queue/receipt 写入和 reopen，保护不破坏既有写语义 |
| formal-runtime-bootstrap／cold-reopen／whole-snapshot-rejection | `reader-ffi --test storage47_compatibility` 的 `known47_formal_ffi_bootstrap_cold_reopen_and_whole_snapshot_rejection` | 正式 rc_runtime_create/send/destroy、两次打开、core.info 和拒绝无效完整快照；本次当前数据必须新执行 |

`cargo test --locked` 后使用上述准确 target、完整名字及 `-- --exact --nocapture`，执行前固定 dependency/feature/工具链/profile 和资源。第三项必须先核验 `READER_STORAGE47_DISPOSABLE_CLONE` 指向准确私有副本，且 `.reader-disposable-clone.json` 的 purpose/copyPath/sourcePath 正确；变量缺失时测试会回退为 synthetic fixture，**这种 PASS 不能证明当前目标快照**，所以操作脚本应在调用前拒绝缺配置。禁止把原应用目录传入。

前两项若已有执行日志，只有定义及所依赖 Core 输入闭包逐项完全一致、原绑定可核对且 validator 接受时才可复用该精确日志，并明确标记历史复用；否则按必要性新执行。不能直接复用旧 a443 整份 receipt，也不自动附加历史 supplementary case。本地正式 FFI 验证仍不是在 VM 直接执行包内 `.so`，该边界需与 Native/候选绑定一并写入新回执。

`--no-launch` 分段方案需后续用户明确要求“先安装不自动启动”，再在同一具体范围中规定身份通过后的一次正常启动。它用于补充旧控制器缺少的 post-UID fence。保留 canonical install 的 launch=NOT_RUN，再追加独立启动证据，不篡改安装回执。若用户选择原子默认安装启动，应先解决无法在旧控制器内部插入 UID fence 的风险，不能在事后才宣称已保护。

**恢复规则必须先定：** 停止后的证明失败、安装成功但后置校验失败、启动失败分别处理。总启动预算包含失败恢复；不能凭空追加一次旧 a443 启动。保留安全停态时写明实际状态；如需恢复旧应用，该动作及可能自动维护／核对 UNKNOWN 的正常写入必须包含在新明确范围内。不得承诺应用正常启动完全不写数据库，也不得承诺原 UNKNOWN 已结算；agent 不读取其 payload。

## 5. 漫画与阅读验收独立收口

### 漫画

当前数据没有有效 candidate，0/2 与复制事实一致；先交付 Host 修复并不会自动恢复旧 heads/receipts。历史因果调查与恢复离线能力是两个目标：

- 历史调查只读既有日志／快照／owner 回执，找不到时间和责任链就保留 unknown；不为追一个不可恢复的因果结论重复停启、刷机或开原库。
- 如需恢复漫画离线业务，先定义用户选定内容、源身份、可用性、下载／重建范围、失败恢复和存储预算，再用既有 Core/Host 流程执行。该业务是另一个明确变更，不能隐含在准入诊断或修复计数里。
- 完成候选必须经过 Core state/version、manga.entry 身份、Host manifest／登记文件完整性链；正常生产入口才能做冷续读。没有候选时，冷续读继续 NOT_RUN 或由用户明确接受该开放项。

### 阅读与页面

只选择修改真正触达且本地不能关闭的风险：新候选原生文字正文／面板一次开关的静态证据；若几何／TTS／IME／旋转仍有具体未决，再逐项列证据问题和最小范围。当前 19 行行为矩阵不是默认执行清单。减少动效、动画中断、夜间和其他字号没有证据就保留未验证，不用旧图／参考 Stage 验证页顶替。

## 6. 交付完成的判定

| 层级 | 判定条件 |
| --- | --- |
| 代码 | 选中 finding 有明确修改或有充分证据关闭；未纳入项列风险和 owner |
| 本地 | 逐项必要的真实方法／SDK／负对照通过，失败原件保留；未选项 NOT_RUN |
| 构建产物 | 精确 commit／输入、Native、manifest、HAP、controller、指定证书可核对 |
| VM 交付 | 新合法准入；保数据安装身份／UID 通过；必要启动和像素有候选身份绑定 |
| 物理机 | 只有正式计划选择且有实际回执才能 PASS |
| 用户验收 | 用户对可见结果明确确认；不能由 agent 自签 |

在没有正式发布／整体验收决定前，不自动安排完整产品回归。若未来进入正式验收，先按 GATE_INDEX 形成审定集合，再执行该集合；历史 `--full` 目录不能代替发布计划。漫画历史因果、当前业务恢复、阅读像素和 UNKNOWN 原操作结果继续各自记账，不为凑“全闭合”而合并事实。
