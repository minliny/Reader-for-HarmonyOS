# P9 订阅资源审计：真实调用链与容量缺口（2026-10-03）

结论：**当前整页 snapshot 架构存在 O(N²) 累计 IO/序列化及历史回执哈希，P9 该出口 OPEN。** 已有 5000 原准入与完整 payload 得以保留，不能以降低准入/裁剪语料关闭问题。SHA 候选保护偶发损坏，不提供本地文件作者鉴权或历史 Core ACK 真实性。

## 固定输入与证据层

- Host 基线 `3df16be152bcb7701a08670a218cb90b964d6cca`，独立审计分支；没有生产、Core、UI、VM/HAP/真机修改。
- 原 Store SHA256 `e5e67705aabad289599603dd55765e4c1669e36989ced272ca0244c7af04d2c9`，SHA 候选真实源 SHA256 `365125d388bb180fafc7fe56bda07e7c6175d9251cb91b2bb22a832f786e180d`。两份精确 UTF-8 源快照在 `tools/evidence/p9-subscription-capacity/{base-store,whole-sha-store}.txt`，供实际 SDK 转译器直接编译；不是改写的生产替身。
- 使用已安装 DevEco SDK TypeScript 编译器转译完整实际 SourceGateway/RulesManagementGateway/RulesMutationOwner/Store/Atomic IO/sha256Hex；语义和循环未经替换。Runtime 身份、官方文件 API 与密码 API 是受控平台 seams；Node 原生 crypto 实现 SHA，无新算法。
- Core RPC 只提供原 typed terminal/query observations，没有实际 Native/SQLite mutation，5000 不是 5000 次数据库运行。Core 原子性/真实 SQL 由专门真实 Core tests 提供，不能以本资源 probe 代替。
- 记录实际内存后端 API 的 UTF-8 IO、SHA 输入和计数。Mac CPU/RSS 是 SDK probe 进程（包含编译器/多个冷 class）；不是 HarmonyOS AtomicFile 延迟、断电持久性、设备 RSS 或 BB01–09 预算验收。
- 原语料每源约 656 JSON bytes，包含中文/emoji/引号/反斜线/嵌套扩展、对象及字符串封装规则。原 SourceGateway 对所有字段做深相等；50/500/5000 准入无剪裁，5001 仍按原上限拒绝。它是固定代表语料，不声称所有合法源的最大字节尺寸。

## 50/500：完整原调用链实测

每个场景执行 actual Gateway.refreshSubscription → Owner → Store.accept/advance/clear，实际每个 original source.import DTO 和最后冻结 rule-sub.put。所有逐步 snapshot bytes 都与派生公式逐项相等；只在终态 ACK 后清 intent，元数据成功事实与 payload 保真已验证。

| 源数 | 输入 | Mac seam 耗时ms | 累计读B | 累计写B | whole SHA次数 | receipt SHA次数 | SHA累计输入B | 最大snapshot B |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 50 | baseline | 60.928 | 2881695 | 2881695 | 0 | 0 | 0 | 72142 |
| 50 | whole-sha | 98.677 | 2886132 | 2886132 | 102 | 2550 | 6094890 | 72229 |
| 500 | baseline | 5494.314 | 278634704 | 278634704 | 0 | 0 | 0 | 718549 |
| 500 | whole-sha | 7682.006 | 278678291 | 278678291 | 1002 | 250500 | 589834408 | 718636 |

以上 CPU 数值是单轮观察，无设备阈值/统计合格推断。内存 AtomicFile 的 finishWrite 是真实薄 IO 方法收到的 raw 字符串；实际观察额外 JSON.parse 采样有开销。

## 5000：真实 API 冷 checkpoint + 派生完整旅程

5000 源原 document 3,280,001B。checkpoint 历史来自合法精确 typed receipt fixture（不冒称实际执行过这些数据库 mutation），随后用新 SDK Store/Owner class 冷读实际持久 raw，纯 query head，不派后续写；全部原 future DTO 保真。

| cursor | 实际snapshot B | cold seam耗时ms | read次数 | RPC mutation次数 | 本地write次数 | wholeSHA次数 | receiptSHA次数 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 0 | 3930133 | 46.643 | 1 | 0 | 0 | 2 | 0 |
| 2500 | 5565713 | 93.174 | 1 | 0 | 0 | 2 | 5000 |
| 5000 | 7205143 | 109.607 | 1 | 0 | 0 | 2 | 10000 |

完整5000正常成功旅程的**派生量**，每个公式已对50/500所有真实snapshot校准：

- 5001实际步骤，5002 Atomic finish、10004 base+parent fsync；5003 read，其中5001非空。
- SHA候选累计读 **27,836,144,800B**、写 **27,836,144,800B**（总约55.7 GB十进制）；原无SHA版本分别27,835,709,713B。差异仅每非空snapshot新增87B fingerprint字段，原full snapshot IO本就O(N²)。
- whole SHA **10,002次 / 55,671,419,426B**；历史receipt SHA **25,005,000次 / 3,250,650,000B**；总58,922,069,426B SHA输入。
- 单个最大snapshot 7,205,143B，不能据此认为总体资源小。总量为每一步完整计划+累增回执之和。
- 不外推完整5000执行时间，不以Mac cold读取~百ms推断HarmonyOS恢复预算。

精确计数：源数N时，每个历史fact在后续write/read中反复验证，receiptSHA=N(N+1)，wholeSHA=2(N+1)。`same/previousOf/projectSubscription`另反复序列化/扫描full steps/facts，因此仅减少SHA常数无法消除二次增长。

## SHA 与故障边界实测

冷启动实际 Store/Owner 负对照：future DTO 改变但保留旧whole SHA→阻断；prior data/receipt改但摘要未改→阻断；只重算outer SHA仍改prior ack body→阻断。三个案例均0 RPC mutation、0后继派发，原文件保留。

两个预期非鉴权案例也实际执行：改变future DTO并重算whole SHA可通过结构与checksum；改变prior body并重算ack/whole SHA可通过。它们均只纯查询0写。SHA没有秘密/签名，合法文件写作者可重算；`ackFingerprint`是内容摘要，不能当历史Native签名。当前首次Core receipt的qualification和exact operation/head query仍是另一证据层。本审计不建议以新加自研密码框架修这条边界。

## 最小整改与可判定出口

必须继续沿有限订阅域，不降低5000、不造全局TaskStore：

1. 原 accepted完整 immutable plan（steps/localFailures/冻结更新时间）一次持久；唯一plan identity+SHA，当前/未来DTO保真。可用现有 AtomicFile/base+parent fsync 与官方 SHA。
2. 每步只写小current snapshot：精确原 ID/sequence/DTO或plan-index/当前qualified receipt、cursor和已确认/失败计数；当前uncertain不能被新draft替换。必要失败详情仍按业务完整保留，不能偷删用户可见原因。旧runtime/clear不能触及新plan/current。
3. plan在本warm域资格缓存一次，冷加载验证一次；每次transition只验当前精确receipt、原plan identity/cursor，避免all-prior重哈希/复制。同timestamp、partial、only-read recovery、exact continuation、terminal清理ACK语义保持。
4. 两文件提交/恢复必须有明确manifest/identity原子边界：先durable plan再current ACK才派Core；unknown plan/current切换不清、旧cleanup不删新plan。复用已存在IO薄适配；不能以readText存在/缓存get当durable ACK。
5. 独立差分出口：同50/500完整真实 SDK链；5000原准入+0/2500/5000冷checkpoint，完整DTO与metadata不重建；lost local finish/fsync ACK、lost Core ACK、旧owner迟到、sameID异参、query null/越head、partial失败+metadata保存失败均保原断言。证明累计IO近O(N)、每步constant receipt验证；若失败列表自然增长须单列原因/最坏成本，不能写“总量无条件常数”。
6. 之后才单列签名HAP/目标Atomic支持与BB预算出口；本文件不关闭这些层。

Root已授权P3的有限 immutable-plan/current整改，本报告仅是整改前基线。**性能问题未关闭。**

## 复现与工件

```sh
node --expose-gc tools/probe-rule-subscription-capacity.mjs
```

默认读仓内两个冻结真实源；可用READER_SUBSCRIPTION_BASE_STORE_SOURCE/READER_SUBSCRIPTION_STORE_SOURCE覆写明确候选输入，不能把不同生产结构误标本轮。输出默认 `/private/tmp/reader-subscription-capacity-20261003`。本轮完整RUN.log、INPUTS/RESULTS及每场景JSON都复制到 `tools/evidence/p9-subscription-capacity/`。INPUTS登记其余实际依赖源hash；冻结候选末尾再次核验稳定。
