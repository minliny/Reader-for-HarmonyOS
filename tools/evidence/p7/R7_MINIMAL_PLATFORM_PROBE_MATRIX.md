# R7：最小平台核定矩阵与既有命令

状态：**PLANNED / NOT_RUN**。本文件只读审计已有生产代码、debug Want 入口与规范脚本；没有占用目标、调用 HDC、构建、安装或启动。审计 Host 锚点为 `4957ded129403c63b79c10e7c00703d1fbeaf1b2`，执行前必须改用整合者最终冻结的三仓/HAP 身份。本文不能充当目标通过记录。

## 1. 本轮要回答的问题

本地生产方法、实际 Gateway/Owner、SDK 编译后的组件与负对照已能验证业务身份和状态合同；它们无法决定实际 OS 的文件持久化 ACK、Asset 能力、WindowStage 回调、ArkUI 原生层寿命、临时 URI grant 或音频资源资格。R7 只为这些未决点取证。视觉精调和用户验收仍单列，不将页面截图、定时器数据或诊断页成功当作全应用验收。

按当前代码，RSS/Discover/Sync 在 `app/ReaderProductScope.ts` 固定 `l0` 产品门禁下不可达。R3 的五个 RSS 消费者有真实代码/SDK/冷 Core 证据，但目前**没有正常应用目标入口**。不得为测试修改门禁，不得把 `ReaderControlMotionVerification` 冒充 RSS 生产页面。该缺口记为目标承载未提供，而非通过或 OS 限制。

## 2. 核定矩阵

全部目标结果初值为 **NOT_RUN**。只有相应实际记录齐全时，才能将某个具体问题改为已观察/通过；其余列不随之关闭。

| ID / 优先顺序 | 当前生产承载及代码侧已核定内容 | 代码仍不能回答的最小问题 | VM 能回答 | 需要物理能力或尚无承载 | 退出证据 / 不能外推的结果 |
| --- | --- | --- | --- | --- | --- |
| R7-01 / 第一批 | `ReaderAtomicSnapshotProbe.ts` → 唯一生产 `ReaderAtomicSnapshotFile.ts`；debug 冷 Want `readerAtomicSnapshotProbe`。实际 6000 项完整 DTO，UUID scratch，原子替换、base/父目录 fsync、关闭与精确读回。 | 当前 OS 能否实际打开/fsync 父目录，完成大于 8192 字符的原始形状写入和空替换 ACK？ | 同一包/同一 OS 上 write/read/clear/cleanup 四阶段实际回执及耗时。 | 物理目标若文件系统/OS 不同必须单独核定。断电、kill 恰好发生在 finish/fsync 边界、掉盘的精确故障点没有现成注入器；不对用户数据做破坏性试验。 | 四阶段均为该次 `pass`，对应新进程时间窗；失败/未知保留 scratch 并记 `unverified`。正常完成不证明崩溃耐久、业务 Core 事务或所有存储故障。 |
| R7-02 / 第一批 | `ReaderAssetInventoryProbe.ts`；debug 冷 Want `readerAssetInventoryProbe`。真实 `asset.query(ATTRIBUTES)`，64 行/页、每次最多 64 页、两次扫描；不读取 SECRET，不 add/remove/update。 | 当前 OS 是否提供分页元数据枚举，稳定业务状态下两次扫描是否同一组别名？ | API 可用时可观察别名数量与元数据字节；API 不可用时只能记录该 VM 的 unavailable/unverified。 | 真实安全存储、认证策略及实际存储配额必须在具有该能力的物理目标观察。枚举不是原子快照；别名元数据字节不是 secret/storage 字节。 | `observed` 仅是有限观察，绝不标持久 inventory PASS；caps/重复/损坏/变动/IPC 不结算均 unverified。不能由名字判断 orphan、授权清理、解锁 unknown 或宣称物理记录最多 3 个。 |
| R7-03 / 第一批 | `EntryAbility.loadMainContent` + `ReaderStartupContentOwner` + `ReaderStartupRecovery.ets`；冷 Want `readerStartupMainLoadFailure` 请求真实未注册页面一次。 | 真正 `windowStage.loadContent` 失败是否交回错误，恢复内容是否可挂载，重试是否进入原 Index？ | 主加载失败→恢复页→真实重试→正常页；系统 Back/退出；不重复启动原 storage recovery。 | 原生 loadContent 永不回调、恢复页也不结算没有现成 OS 注入器。15 秒状态/退出合同的本地受控 driver 不等于目标能人为制造这些故障。 | 新进程 `READER_STARTUP` 的 fault/load-failed 与同时间窗原生恢复页面、重试结果；恢复页不可挂载必须保留 platform-unavailable，不能伪造继续。loadContent callback 本身不证明首帧。 |
| R7-04 / 第二批 | 正常 Index 可达的 Settings 选择器、Source 分组选择器、Bookshelf More / BookActionSheet、Dialog；现有有限 presentation ID + Back bridge + 公共组件。诊断页 `ReaderControlMotionVerification` 另含真实阅读控制组件。 | ArkUI 原生 host 真正更新/移除/重建时，按压、关闭、系统 Back、焦点/键盘、快速关闭重开是否遵守现合同？ | 正常应用三处临时层按矩阵打开→Back/遮罩→重开；输入草稿+键盘→取消→重开；Reader 诊断组件的原生调度/中断。 | 老物理节点在移除后被平台再次派发，现 SDK 能控制重放但现目标脚本没有任意 stale-handler 注入能力；不得据此宣称已经在设备强制证明。RSS 五页目标没有产品入口。 | 实际正常 Page/host 操作日志、layout、必要调度图像与当前/旧层状态。只取消涉及真实用户书籍的删除/分组写；确认分支只在预先批准的可丢弃夹具执行。诊断页结果仅归其包含的组件，不能归整个持久 Reader/RSS。 |
| R7-05 / 第二批 | `EntryAbility.onCreate/onNewWant` → `ReaderSystemFileOpenHost` → 有界队列 → 私有复制/原导入；module 注册 `ohos.want.action.viewData`。 | 系统文件提供者给出的临时 URI 授权能否在冷/暖 Want 中被实际复制，读取失败如何回到现页面？ | 若 VM 有真实文件提供者，可用新建的非用户 TXT/EPUB 夹具走“打开方式”；冷打开、暖阅读中打开、重复同字节打开、取消阅读退出。 | shell 字符串 URI 不包含实际授权证据；无文件提供者的 VM 不能回答。授权回收时点/瞬时 read failure 没有现成注入器，必须在有真实 grant 的物理系统提供者核定。 | 原文件 hash 不变、同内容书籍不重置原位置、正确 Queue/reader exit identity 与页面结果；隐藏 URI/文件名不进入公开日志。临时 grant 成功不代表故障注入覆盖。 |
| R7-06 / 第三批 | `HarmonySystemTtsHost`、`HarmonyTtsAudioSessionLease`、`HarmonyTtsMediaSession`、`HarmonyTtsBackgroundSession` 与原 TTS coordinator；module 已有 KEEP_BACKGROUND_RUNNING/audioPlayback 声明。 | 系统中文音色、实际音频焦点、连续任务真实 ID/取消 ACK、媒体 session 销毁及切换设备是否可用/结算？ | 有音色/音频能力时可核前台 probe/播放/停止；缺能力时观察明确 unavailable，不能拿 VM 合成 callback 当物理音频。 | 后台持续播放、锁屏媒体、电话/其他应用中断、耳机/蓝牙换路依赖物理平台及系统资源竞争。现脚本没有这些事件的可信注入器。 | 使用合成短文本/可丢弃夹具，记录 capability 的 admitted/unavailable/denied/unverified、精确 native task/session 生命周期和 UI 不冒称播放；权限声明或 API 存在不证明资格。未知 native 任务不得以重启/新建覆盖。 |
| R7-07 / 第二批合并 | `ReaderEventLoopProbe.ts`；冷 Want `readerEventLoopProbe`，真正主页面 ready 后启动 50ms timer、1s 记录、最长 120s，background/window-destroyed/destroy 停止。 | 实际主循环是否出现长空窗，退后台/窗口释放后 timer 是否停止？ | 当前 VM 的定时器可用性和 stop reason；与正常三页临时层操作一起观察，减少重复启动。 | 物理性能/耗电/低端设备预算、GPU/FPS、输入到显示时延没有本探针承载，需独立标准 profiling。 | 只报 samples/maxDelay/delayedOver50 与 stop 时间；没有约定预算不判性能 PASS。该单次探针后台 stop 后不在 foreground 自动重启，新冷启动才有新样本；不能把无样本解释为页面不卡。 |
| R7-08 / 后续独立核定 | 三仓 actual journal/receipt 代码已有受控 lost-ACK、SQLite 冷进程和 Atomic 生产方法测试。 | 真实平台断网/IPC 中断/存储满/进程崩溃恰好位于 write 与 ACK 之间是否被正确观测？ | 只有已经存在且有 dispatch 证据的真实承载才可测；VM NAT 不能假定等于断网。 | 目前没有统一可信目标故障注入入口，不新增“万能 executor”或命令端点，不修改系统网络/库/真实数据制造故障。 | 记 **NO_CURRENT_INJECTION_CARRIER**；代码 proof 保留、目标矩阵 OPEN。普通取消、成功重启、当前列表相等都不能补写 exact ACK。 |

## 3. 最小执行次序

1. 整合者冻结最终三仓和 canonical signed manifest，先取得完整 ArkTS/产物证据；本计划不选旧 HAP 作为替代。
2. 取得当前唯一目标 lease 与系统就绪证据。一轮新冷 debug 启动选择一个主页面故障/诊断 flag；不要并行启动能力，也不要把多个路由诊断 flag 组合。
3. 第一批只有 R7-01、02、03。每个失败停止该场景并保留原始记录；先回代码定位，不反复操作目标替代修复。
4. 第二批正常 L0 页面可把 R7-04、07 合成一轮；R7-05 仅有真实文件提供者时追加，文件夹具没有真实授权则保持 OPEN。
5. 第三批 R7-06 只核目标实际拥有的能力；物理资源竞争另预约独立范围。R7-08 不为赶进度捏造注入或放宽验收。

所有 debug opt-in 都只读取 `onCreate` 的原始 boolean `true`，还要求 `DEBUG === true` 和 `BUILD_MODE_NAME === 'debug'`；暖 `aa start`/onNewWant 不会启用。已存活进程不能作为冷探针启动。若需要 force-stop 现应用，必须由目标负责人在本次操作确认任务已 settle、保数据及当前动作权限，使用现 wrapper 的 `explicitPermit`；本计划没有执行或扩大该授权。

## 4. 可直接复用的命令模板（未执行）

在最终冻结的 Host checkout 运行；占位符必须由本次现场填写，不能复用历史端口或 manifest。没有使用 `$HOME`/`$CODEX_HOME` 等系统变量。

```sh
R7_MANIFEST='<本次最终冻结 absolute schemaV2 manifest>'
R7_TARGET='<本次确认唯一 HDC serial/endpoint>'
R7_SERVER='<本次显式 HDC server IP:port>'
R7_HDC='<本次 absolute hdc binary>'
R7_EVIDENCE='<本次独立 absolute evidence directory>'

node scripts/hap-pipeline.mjs verify --manifest "$R7_MANIFEST"
node scripts/hap-pipeline.mjs inspect --manifest "$R7_MANIFEST" --artifact signed --target "$R7_TARGET" --target-kind vm
```

仅当最终包尚未按该 manifest 成功安装时，整合者用规范保数据安装入口；物理目标用 `--target-kind physical`，须确认 Profile 允许该目标。不得卸载、清数据、另签名或改 VM。

```sh
node scripts/hap-pipeline.mjs install --manifest "$R7_MANIFEST" --artifact signed --target "$R7_TARGET" --target-kind vm
```

所有 HDC 传输须持当前共享 server/target lease。wrapper 的 `--target`/`--server-key` 是锁身份，**不自动添加 HDC argv 中的 `-s/-t`**，所以两处必须相同。以下是四个独立冷 debug 场景的实际已有入口；每次选择一条，不能批量盲执行。

```sh
node tools/reader-hdc-lease.mjs --target "$R7_TARGET" --hdc "$R7_HDC" --server-key "$R7_SERVER" --wait-ms 30000 --agent-id reader-r7 -- -s "$R7_SERVER" -t "$R7_TARGET" shell aa start -a EntryAbility -b io.reader.minliny -m entry --pb readerAtomicSnapshotProbe true
node tools/reader-hdc-lease.mjs --target "$R7_TARGET" --hdc "$R7_HDC" --server-key "$R7_SERVER" --wait-ms 30000 --agent-id reader-r7 -- -s "$R7_SERVER" -t "$R7_TARGET" shell aa start -a EntryAbility -b io.reader.minliny -m entry --pb readerAssetInventoryProbe true
node tools/reader-hdc-lease.mjs --target "$R7_TARGET" --hdc "$R7_HDC" --server-key "$R7_SERVER" --wait-ms 30000 --agent-id reader-r7 -- -s "$R7_SERVER" -t "$R7_TARGET" shell aa start -a EntryAbility -b io.reader.minliny -m entry --pb readerStartupMainLoadFailure true
node tools/reader-hdc-lease.mjs --target "$R7_TARGET" --hdc "$R7_HDC" --server-key "$R7_SERVER" --wait-ms 30000 --agent-id reader-r7 -- -s "$R7_SERVER" -t "$R7_TARGET" shell aa start -a EntryAbility -b io.reader.minliny -m entry --pb readerEventLoopProbe true
```

每次先保存启动前时间/进程身份、后保存本次日志原始数据。用新 `READER_STARTUP` 的 processId/sequence/uptime 与 hilog 进程/时间窗关联；这里的 `processId` 是生产 trace token，不是 OS PID。atomic/asset/event-loop 本身不带独立 run ID，不能凭历史同名 marker 判本次成功。不清空 hilog。

```sh
node tools/reader-hdc-lease.mjs --target "$R7_TARGET" --hdc "$R7_HDC" --server-key "$R7_SERVER" --wait-ms 30000 --agent-id reader-r7 -- -s "$R7_SERVER" -t "$R7_TARGET" shell hilog -x -e READER_ATOMIC_SNAPSHOT
node tools/reader-hdc-lease.mjs --target "$R7_TARGET" --hdc "$R7_HDC" --server-key "$R7_SERVER" --wait-ms 30000 --agent-id reader-r7 -- -s "$R7_SERVER" -t "$R7_TARGET" shell hilog -x -e READER_ASSET_INVENTORY
node tools/reader-hdc-lease.mjs --target "$R7_TARGET" --hdc "$R7_HDC" --server-key "$R7_SERVER" --wait-ms 30000 --agent-id reader-r7 -- -s "$R7_SERVER" -t "$R7_TARGET" shell hilog -x -e READER_STARTUP
node tools/reader-hdc-lease.mjs --target "$R7_TARGET" --hdc "$R7_HDC" --server-key "$R7_SERVER" --wait-ms 30000 --agent-id reader-r7 -- -s "$R7_SERVER" -t "$R7_TARGET" shell hilog -x -e READER_EVENT_LOOP
```

原生操作只用已有有限 whitelist；下面启动 wrapper 本身不自动确认系统就绪。JSON 中 `preflightConfirmed:true` 是操作者声明，必须有下节原始证据支持。

```sh
node tools/reader-control-device-probe.mjs --target "$R7_TARGET" --hdc "$R7_HDC" --server "$R7_SERVER" --output-dir "$R7_EVIDENCE"
```

在上述独立进程的 stdin 按场景逐条发送（不要一次粘贴全部）：

```json
{"op":"startNormal","preflightConfirmed":true}
{"op":"dumpLayout","path":"/data/local/tmp/reader-control-r7-layout.json","preflightConfirmed":true}
{"op":"recv","path":"/data/local/tmp/reader-control-r7-layout.json","preflightConfirmed":true}
{"op":"keyEvent","key":"Back","preflightConfirmed":true}
{"op":"keyEvent","key":"Home","preflightConfirmed":true}
{"op":"motionLog","preflightConfirmed":true}
{"op":"listGeometryLog","preflightConfirmed":true}
```

`click`/`drag` 坐标由该次 layout/安全目标确认，不能硬编码旧截图坐标。wrapper `start` 只启动 `readerControlMotionVerification`，不是 Atomic/Asset/Startup 的通用入口；`startColdEntryMemoryMiss` 只关闭可选 RAM 复用，不能模拟崩溃或清 journal。诊断页的 `start` 与普通页的 `startNormal` 分开记账。需要当前动作明确授权的冷进程停止仅接受现有 `{"op":"force-stop","explicitPermit":true,"preflightConfirmed":true}`；该字段不能替代授权/任务已 settle 的证据。

URI 与 TTS 不提供虚构自动命令：R7-05 必须真实系统文件提供者操作，R7-06 必须实际阅读/TTS 页面及平台音频能力。现 wrapper 没有凭字符串制造 grant、电话、蓝牙或后台资格的合法等价操作。

## 5. 每个场景的最小回执

执行者为每个 ID 单独保存以下事实，不以同一总 PASS 代替：

- 最终 Host/Core/Native SHA 与内容 fingerprint、完整 canonical ArkTS 结果、immutable manifest/HAP SHA、`io.reader.minliny`、authority 证书 SHA256 `3A563778E5BF17CD3EAD0218E13B4A5030DE3F5D7D4E21E0336D8EB37B676DC4`、Profile 与部署回执；缺一项保持对应层 OPEN。
- 目标类型/当前实例路径/OS/精确 HDC target/server、现 lease；VM 要同时有 `bootevent.boot.completed=true`、Emulator `Guest OS Boot Completed!!` 与稳定 SceneBoard，HDC Connected 不等于就绪。此计划不提供伪造的 boot preflight command。
- 新进程/Ability 生命周期、开始结束时间、场景输入类别、适用 debug flag、当前路由、真实 capability、原始 command 退出码/输出与 logger marker。不记录凭据/内容/用户 URI。
- 观察值与严格结论：Atomic 单次 helper ACK、Asset observed、WindowStage recovery、正常 UI 临时层、TTS capability、timer jitter 分别填；不扩大为业务全部正确、性能预算、视觉或用户接受。
- 未验证原因必须写具体：产品 gate 无入口、目标缺能力、没有可信故障注入承载、系统不就绪、日志缺当前身份、调度未结算。平台 denied/unavailable 可以证明诚实反馈，却不能证明目标能力存在。

出现 SceneBoard 连续退出/LIFECYCLE_TIMEOUT、guest reset/kernel panic、HDC 掉线或资源身份未知时，停止应用层操作并留原始证据；不重建 VM、不自动重试安装、不清数据。代码已能定位的新问题先修复/回归后再决定是否还需目标核定。

## 6. 本次资料与证据边界

已读取当前 `EntryAbility`、所有上述平台 probe、Startup owner/recovery、SystemFileOpen host/queue、实际 TTS background/media/audio/system bridge、`ReaderProductScope`、module 权限/skills、HDC lease/有限 device-probe 的实际 argv 及以下规范：

- 工作区 `AGENTS.md` 与 `Reader-for-HarmonyOS/AGENTS.md`。
- `/Users/minliny/Documents/Reader/.agents/skills/reader-harmonyos-hap-pipeline/SKILL.md`、其 `references/deploy.md` 与 `HAP_BUILD_SYSTEM.md`。
- `tools/evidence/p8/ATOMIC_SNAPSHOT_TARGET_QUESTION.md`、`ASSET_INVENTORY_TARGET_QUESTION.md`。

没有新增平台探针、UI 入口、权限、故障注入器或部署实现。**R7 目标执行仍为 NOT_RUN，visualAcceptance/userAcceptance 未执行。**
