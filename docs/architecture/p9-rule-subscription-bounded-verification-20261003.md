# P9 订阅两文件整改：独立资源差分与故障复核（2026-10-03）

**裁定：本代表语料的正常连续旅程从 O(N²) 变为 O(N) 总 IO/SHA，代码与受控 SDK 调用链出口通过。HarmonyOS 目标 AtomicFile/设备预算及 BB01–09 仍 OPEN。** 本轮无生产、Core、UI、HAP/VM/真机改动。

## 输入与证据身份

生产候选：P3 clean `49e1b12dfa0a4e04b683382febb58286848e4d71`。实际 Store SHA256 `54cfdfae2d1c1362f9d8e007d5ae82d4c3e8f201dbb48cd6e62a6946192facf0`，实际 Owner SHA256 `8c247c4bf5b0cc69bcf931d200f7a90a729addfc1662c7b3b4f97444df62d493`。输入按字节冻结成 `tools/evidence/p9-subscription-bounded-capacity/{store-candidate,owner-candidate}.txt`，完整编译运行这些实际方法；不是复制算法的替身。其他实际 Gateway/Atomic/SHA/SourceGateway 依赖使用3df16be1独立 lane并在INPUTS登记hash；P3 Store/Owner通过明确源override组合。SDK TypeScript `4.9.5`、Node `v26.0.0`，darwin/arm64。

沿用整改前8aeddd5f同样50/500/5000书源语料：完整中文/emoji/对象规则/字符串规则/嵌套扩展/原URL与名称，无删减、截断或新5000上限。实际 SourceGateway对全部5000 DTO做深相等准入，5001依原产品5000准入拒绝；每个实际Owner RPC mutation与原冻结step的method/params深相等。原最后rule-sub.put更新时间只在首次计划生成时冻结。

平台为受控内存路径file API＋Node原生SHA薄适配；SHA入口/Atomic适配/全部Store、Owner、Gateway逻辑采用实际生产方法和已安装SDK转译器。两个物理路径分别计账，不以单raw假扮两文件。Core RPC只提供原typed receipt/query observations，**真实Core数据库mutation=0**；不替代P3真实SQLite/SDK 21负例与原24旅程。CPU/RSS是含编译器/多fixture的Mac进程观察，不是HarmonyOS执行时间、目标RSS、OS断电持久性或性能预算合格证据。

## 正常连续完整 Host 链实测

本次由于整改后成本下降，**50、500、5000都实际完整执行Host控制链**，没有外推5000时长或派生5000 IO。每组source.import原DTO逐项验证，末尾元数据确认与Atomic终态清理通过。

| 源数 | 累计read B | 累计write B | SHA总次数 | latest receipt SHA次数 | SHA输入 B | bounded current最大B | 单轮Mac seam ms |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 50 | 92600 | 172517 | 204 | 100 | 269156 | 1841 | 10.192 |
| 500 | 924260 | 1710577 | 2004 | 1000 | 2677576 | 1849 | 72.112 |
| 5000 | 9276770 | 17136087 | 20004 | 10000 | 26842596 | 1857 | 624.279 |

- immutable plan每组只写 **1次**、warm连续链 **0次读取**；5000 plan为3,929,184B。current每步只带原当前完整DTO、plan identity/hash、cursor、aggregate和最新1个精确prior receipt。
- 原full intent → immutable plan → bounded current，初始化3次Atomic ACK后才允许第一步Core派发。5000最大transient full intent为3,930,133B；不能把1857B current写成应用总内存/总存储小于2KB。
- 5000共有5001typed mutation observations/5004 Atomic finish/10008 base+parent fsync。checksum总计20,004次，其中latest receipt10,000次，公式为receipt=2N、其余record/plan=2N+4，每步不随历史长度增长。
- 原SHA full-snapshot候选5000 **派生**read/write各27,836,144,800B、SHA25,015,002次；新5000 **实际**总read+write26,412,857B、SHA20,004次。按相同语料旧/新总IO比约2107.8，SHA调用比1250.5；这不是任意数据/任何设备的统一加速比。
- old5000派生公式已逐个对50/500实际snapshot验证，出处为8aeddd5f的独立报告与完整日志。不同证据层在此明确分开。
- 这里证明一次正常连续journey累计量线性。若每一步都发生冷进程重建，每次仍须读取/验证完整plan；这类重复冷启动总成本另算，不能宣称全生命周期所有调度都无条件O(N)。原合法单源DTO/失败详情字节容量未增加限制；current尺寸自然取决于当前原DTO和最新ACK的实际长度。

## 5000真实冷checkpoint

以合法typed prior history fixture创建cursor0/2500/5000；不是实际5000 DB mutation历史。新SDK Store/Owner类从两个持久raw冷加载，原计划所有未来DTO与冻结timestamp深相等，confirmedParts/cursor/metadataConfirmed保真。pure recovery保持unknown并0后续mutation/0本地write，明确用户继续才可原ID重交。

| cursor | current B | plan B | cold read调用 | latest receipt SHA | RPC mutation | local write |
|---:|---:|---:|---:|---:|---:|---:|
| 0 | 1190 | 3929184 | 2 | 0 | 0 | 0 |
| 2500 | 1860 | 3929187 | 2 | 2 | 0 | 0 |
| 5000 | 1290 | 3929187 | 2 | 2 | 0 | 0 |

每个cold只读1个plan与1个current，plan全SHA一次；最新receipt至多2次验证。plan的qualification缓存仅本runtime，冷read存在不代表durable ACK，明确继续时仍按原IO合同核定。消费方法hydrate出的完整steps与原输入逐项深相等；没有通过删history之外的DTO来缩小输入。

## 独立发现的格式过渡缺口与复测

最初两文件WIP中，plan finish已完成但ACK丢失会留下legacy同cursor current＋modern warm tuple；实际纯恢复报“规则原记录与暖状态冲突”，canRetryOriginal=false。红证据保存在PRE_FIX_RESULTS/RUN及pre-fix精确Store/Owner源，不覆盖或隐藏。

P3 clean49e1b12d已补有限samecursor legacy↔modern资格：同ID/seq/fullmutation/label、原plan raw对应、累计事实及最新fact一致；跨runtime不能借旧plan IO资格。独立验证 **12案例通过**：finish ACK或parent fsync ACK丢失×full intent/plan/current三个初始化阶段×暖/冷恢复。每例：初次0RPC → pure exact query保原sameID unknown、canRetryOriginal=true且仍0RPC → 显式继续原4步骤并确认元数据，终态原intent清理。不是盲新ID重试。

## 两文件损坏与非鉴权边界

五项实际冷负对照：future plan DTO改但保旧hash→阻断；latest receipt body改但保旧hash→阻断；只重算current outer摘要仍坏latestACK→阻断。均0RPC mutation/0localwrite。

两个预期非鉴权案例也保留：有私有文件写入能力者可改future plan并重算plan+current摘要，或改prior body并重算ACK+current摘要；结构校验可通过，仍只执行pure query。SHA是损坏检测，**不能称历史Native真实性/作者鉴权**；当前original由实际Core expected query/qualified receipt独立核定。本复核不引入自研密码算法/全局TaskStore。

## 可关闭与保留出口

可以登记：固定代表语料正常完整Host链的二次snapshot/hash问题已由最小有限plan/current改造解除；保原5000准入、payload、冷cursor、计数与sameID初始化ACK恢复。证据为实际生产方法SDK转译/受控平台测试。

继续OPEN：HarmonyOS真实AtomicFile/base/parent fsync适用性、目标崩溃/存储耗尽/功耗/IO延迟、全合法语料字节预算、实际UI/Core/native BB01–09性能、签名候选包/设备表现/用户接受。本轮没有目标设备操作，不能用Mac毫秒替代任何一项。

## 复现与完整材料

```sh
READER_SUBSCRIPTION_CANDIDATE_COMMIT=49e1b12d node --expose-gc tools/probe-rule-subscription-bounded-capacity.mjs
```

默认读取仓内冻结实际Store/Owner；可用READER_SUBSCRIPTION_STORE_SOURCE/READER_SUBSCRIPTION_OWNER_SOURCE显式给下一候选，INPUTS记录实际源hash。输出 `/private/tmp/reader-subscription-bounded-capacity-20261003`。完整RUN.log、INPUTS/RESULTS、50/500/5000与cold矩阵、12ACK负例、5损坏/非鉴权场景均在 `tools/evidence/p9-subscription-bounded-capacity/`，并保整改中红证据。脚本与全部材料都是test/evidence，生产文件未改。
