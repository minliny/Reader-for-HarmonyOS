# 页面结构契约框架与书源页修复实施方案（2026-11-02）

> 当前执行入口已转入2026-11-12的[框架合流实施记录](../architecture/framework-confluence-20261112.md)。本文件以下内容保留2026-11-02至11-04的原时点代码、候选和失败；本轮当前状态、登记修订和统一候选以合流记录及实际JSON为准。

> 当前状态：Stage 1–3已按本轮范围完成；Stage 4共享规格/预算、完整目标代码清单与本地定向验证已落地，原生验收仍OPEN，见14.13。19项消息扫描/登记差异已独立收口，运行生命周期不因此通过；下载页D3常态列表已实现并通过SDK验证，见14.15；Stage 5目录/下载已完成本批active登记与引用校验，已知FAIL/NOT_RUN保留，见14.16。Stage 3字体证据限制已追加纠正，历史冻结产物不覆写。页面全层合规、设备与用户验收未完成。
> 依据：[`../architecture/PAGE_STRUCTURE_CONTRACT.md`](../architecture/PAGE_STRUCTURE_CONTRACT.md) v0.2。
> 上游依赖：契约地图与路由/控件/平台宿主登记（已落地 `tools/contracts/*`）、消息框架 [`../message-ui/FRAMEWORK.md`](../message-ui/FRAMEWORK.md) 与 `tools/message-entrypoints.json`、导航矩阵 [`../architecture/interaction-wiring-20261019/navigation-comparison.md`](../architecture/interaction-wiring-20261019/navigation-comparison.md)、控件规格 `ReaderControlSpecs.ets`、操作事实 `ReaderOperationFacts.ts`。只引用 ID 和事实源，不重定义。
> 总目标：建立页面结构契约框架，并以书源管理页完成首轮闭环。
> 范围：Stage 1–2建设最小治理框架；Stage 3书源试点；后续获授权的共享能力、下载页和书源准入/过滤保留见14.9–14.13、14.15、14.17–14.18。首轮只改书源页不代表当前累计生产范围。
> 基线：App `0.2.0` / `versionCode 1000000`；366×844；不改版本号。
> 执行：当前进度见下表。D1保留入口、D2移除prop、D3常态列表均已裁决；原始分阶段准入与历史结果保留，构建/设备另行记账。

## 当前进度总览（2026-11-03，当前HAP9已保数据安装，原生分支进行中）

本轮框架、书源试点、目录/下载扩展、SourceTools首个增量及发现的代码侧缺口已完成定向修复。短内容区不再以固定chrome挤掉列表：Tabs/查询/定位/排序进入同一Native List的ScrollAway prefix，查询仍primary。当前仍不能声明页面全层/原生/产品通过。

| 阶段 | 当前范围结果 | 证据边界 |
|---|---|---|
| Stage 0 | 分批基线/实际输入/精确diff/原始失败均保留 | dirty WIP不清理、不代为提交；源码ZIP可还原 |
| Stage 1–2 | 16层schema、六原型/直接单选、数值queryViewport、决策与检查增量完成 | 模型/引用/具名正反例通过，不等于全应用页面迁移 |
| Stage 3 | 原16条修复登记闭环完成；Source保留四条件+锚点、诊断任务/定义身份和陈旧编辑准入补齐 | D1入口按用户要求保留；Core无CAS，不能声称外部并发原子隔离 |
| Stage 4 | Source32行/40局部目标/24预算；34模板、200SDK+48恢复样本通过 | §14.37父预算修复后matrix17/interaction22输入报告均fresh；旧报告保留历史，不代替Native命中 |
| Stage 5 | 四类目录宿主/Tree及fallback、私有工具栏、D3常态List/管理态、SourceTools与响应短模式完成本地修复登记 | 21登记的E2/E3/人工项继续按证据保留；不制造整页PASS |
| Stage 6 | Source死statusBanner/originalActionGeneration与retained依赖移除；SourceTools17控件/10操作/3平台集成登记 | 其余真实路由已inventory，不宣称整应用全部迁移 |

### 当前正式登记与局部证据

- **4个页面族、21个登记主体、107项控件**；Source14、Directory7、Downloads5、SourceTools1；control10、navigation3、platform2。最终schema/refs/host变体检查PASS，source/ref/model/queryViewport无漂移或解析错误。
- Source16层为**5 PASS / 3 FAIL / 8 NOT_RUN**。NAV-07按同Runtime保留四条件及sourceId锚点/项内位置，fresh进入默认；NAV-08按现有Tools owner保留草稿/选择/参数/结果，Tools外层Scroll不承诺保留。S8方法级政策通过，真实Back/位置仍独立。
- B4按用户裁决允许blocked/unknown下诊断，仍受当前实体/单飞/任务token及版本/定义前后校对；旧resolve/reject/finally不写后继。编辑基线拒绝已观察到的启停/删除/定义变化；不假造Core expected-version/CAS。
- 下载排序方向为44真实carrier保留24paint，相邻目标预算通过；普通List与章节恢复各自epoch，定位/筛选/触摸/退场/后继opening取消旧idle，管理锚点回归通过。
- 短Control目录/书签分别登记真实预算：目录fixed146/min64，书签fixed147/min180；122/168/190真实模块视口均单List自然滚动。180书签卡允许分段看全，不声称122一次塞下。正常portrait/Quick保原glyph和装配。
- prefix与Core/data index显式映射，header/状态行不充当章节；同Surface/Port不重开，Tree锚点唯一交NavList，flat才做自身修正。empty/error/loading header与clear/retry可达；新高度回执不拉回旧data。
- 焦点id/语义宿主与测量epoch分离；迁移仅当前loaded/mounted/id/revision/owner有效，一次布局后恢复；保留IME显示意图，Back隐藏后程序恢复不重弹。真实Native焦点/IME仍待验证。
- ReaderSearchField Source/RSS/Book/defaultDirectory 10个默认SDK上下文前后等价，Book原keyboard=true保留，wrong-variant不能泄漏新id/focus/Area/keyboard端口；原行为场景精确REUSED，不把复用写新运行。

### 当前交付与未关闭层

| 项目 | 当前事实 |
|---|---|
| check-register | E2 FAIL21、E3 FAIL5；G03 NOT_RUN8、SCOPE NOT_RUN3、B1 NOT_RUN2；是规则/登记主体计数，不是独立bug数。短模式代码欠预算已修，原生缺证没有改成PASS |
| 消息 | 前批201/201关闭原19项静态差异；后续新增debug字体/前缀状态走原框架并selected检查通过。全树本轮未重跑，不报新的全局计数或消息生命周期通过 |
| 当前signed HAP | run **20261103T124950Z-fce869a1-3e312522**，SHA **12db667b0b189cb79a2d5c58f7eef159313916e99e84999ac54f6738b7293b74**；指定minliny_HarmonyOS证书/包身份验签、完整ArkTS与非增量构建PASS；contracts none、acceptanceEligible=false |
| 历史构建 | attempt1 sandbox优先级阻止；attempt2 17源码诊断；HAP3 PASS但不含后续短模式；HAP4唯一TextOverflowOptions API错误；准确修复后HAP5通过。旧失败/manifest不覆写 |
| 原生授权 | 用户明确回复允许现有模拟器保数据更新、启动、截图/触摸/Back/焦点、真实字号并恢复；不卸载清数据/重置VM/真实登录提交/导出写入。同范围不再问 |
| 当前原生动作 | HAP5–9保数据安装/普通启动各留独立回执；HAP6后带PID退出屏障已到达Pilot。HAP7真字形基线及Root安全区修复像素已确认；系统1.45而App未增长的实缺陷已由followSystem+真实configuration修复，HAP8下OS/Coordinator/settled fp-vp均约1.45、字形实际增长。HAP9已安装，正在逐目标命中；系统临时1.45待最终恢复，不把前一次恢复记录冒充当前已恢复 |

### 剩余执行

继续HAP9的Source完整模板、目录真实行carrier、下载/Tools及短内容区目标与Back/焦点取证。所有已发现缺口先代码定位/定向验证，原失败回执不覆写；当前系统设置字体最大档读回1.45，1.6/2.0未有Native证据，不由SDK/注入补齐。短视口现有三个scene会重建presentation，不能证明同实例迁移焦点；§14.38最小动态高度夹具只为补此观测，不改生产actor。系统字号必须恢复并独立核对后才能结束本分支。

HAP成功、SDK数值、组件夹具均不代替设备或用户验收。夹具只让组件回调为内存意图，原EntryAbility启动仍安装Runtime并走原恢复/主题等流程；不宣称整个App启动零存储访问。平台loginWeb/真实文件结果及Core外部并发能力仍按实际证据开放，不用假身份或空JSON伪造无副作用。

入口：[长期契约](../architecture/PAGE_STRUCTURE_CONTRACT.md)、[原生计划](page-structure-native-host-plan-20261103.md)、[当前manifest](../../.reader-artifacts/page-structure-final-20261103/hap/20261103T112329Z-fce869a1-29af95b2/manifest.json)。§14保留全部历史执行、明确REUSED与原始失败。

### 当前Native逐目标执行入口

实际入口为`.reader-artifacts/page-structure-native-final-20261103/run-source-reviewed.mjs <reviewed-name>`；每批执行前冻结单独reviewed JSON，明确HAP9、deploy receipt SHA、Root SHA、准确targetRef/PID、scene/目标/期望回执。嵌套仅r2 driver的同server lease及Connected/pidof、UITree/PNG/recv/hilog和审定click/Back/swipe；无App启动、字号修改或业务RPC。540秒派发截止/590秒总边界、命令30秒/传输120秒，首次失败保存并停止。每批只为SDK不能证明的Native父裁切/边缘/唯一owner派发取证，不补其他业务门禁。

首批`source-a-145`在当前365.714vp/真实系统1.45下已完成8步观察：菜单进入、页头工具、导入、两个页脚、首行toggle/login、页头返回。原始树/PNG/日志/坐标及新回执已保存；OBSERVATIONS_COMPLETED不等于页面E2/E3 PASS。后续筛选、query、覆盖层与恢复状态用独立reviewed plan列明步骤，不重复准确通过且Scope未变的目标。当前系统字号仍待恢复，旧HAP7恢复回执不可当成当前恢复。

## 0. 与设计文档的分工

| 文档 | 职责 |
|---|---|
| `PAGE_STRUCTURE_CONTRACT.md` | 长期开发指导：16 层、原型、语法、决策、不变量、登记、例外、上下游契约引用 |
| 本文档 | 本轮执行计划：先建设框架 Stage 1–2，再用书源页完成首轮闭环 Stage 3，之后按批扩展 |

设计文档定义“什么算合规”；本文档定义“本轮建设哪些框架资产、用哪个页面校准、如何验证、何时停止”。本文档不重新解释模型。

Stage 1–2 不是为修书源页临时编写的测试脚本，而是后续新建页面、代码评审和跨页审计共同依赖的生产级治理资产。书源页是第一个校准样本，不是框架的唯一目的；框架文件、登记和验证工具属于本轮正常改动，不受“首轮生产代码只改书源页”的限制。

上游框架不在本轮重新设计。页面结构登记只绑定入口 ID 和契约 ID：

- 消息：类别、宿主准入、退休规则和业务 owner 由 `FRAMEWORK.md` 与 `message-entrypoints.json` 维护；页面只决定放置位置和避让。
- 路由：父级、返回、保留由 navigation registry 与导航矩阵维护；页面只声明 `RouteContract` 引用。
- 控件：状态集、命中区和可访问名称由 `ReaderControlSpecs` 与 control registry 维护；页面只引用 `controlId`。
- 操作：写入事实、busy/disabled、未知回执由 Host/Orchestrator 与 `ReaderOperationFacts` 维护；页面只引用 `operationId`。
- 平台：宿主生命周期、关闭和结果由平台适配 owner 维护；页面只登记 `hostId`、intent 和回程。

契约地图 `tools/contracts/contract-map.json` 是这些上游契约的索引，不是第二套事实源；同一事实出现两个 owner 时标记 `UNRESOLVED`，不在页面结构里另建一份。

## 1. 基线

以下是工作树字节基线，不要求干净 commit。每阶段只冻结实际消费和修改的输入闭包；目标文件漂移时暂停受影响项、协调 writer 并重审相关差异。未进入本阶段依赖闭包的目录/下载页和无关 dirty WIP 不阻塞书源框架建设，不得为满足基线清理工作树。

| 文件 | 行数 | SHA-256 | 角色 |
|---|---:|---|---|
| `entry/src/main/ets/features/source/SourceManagementPage.ets` | 881 | `d50af10b856c1de9673b644f4827ce9529fde4d642abbf120b66f782ff6cb359` | 首轮修复对象 |
| `entry/src/main/ets/features/bookshelf/BookDirectoryPage.ets` | 1060 | `8c7f033d9eb8bb326e118ba97ed5f5852b2b3b2c61ef6b7d183ed88de0e14872` | 第二阶段登记 |
| `entry/src/main/ets/features/downloads/SharedDownloadPage.ets` | 2195 | `6956765fa749c2fdb5a5e71efb6d9d4bc9a5faef4fb23253e25f73a83fcd1f08` | 第二阶段登记 |
| `entry/src/main/ets/features/common/PageBackBar.ets` | 164 | `db250f624c916134a460d2179c1561dacdef45927af308dc9bfe5051696b070a` | 页头 owner |
| `entry/src/main/ets/features/common/ReaderPageScaffold.ets` | 85 | `179f2851ef04274f0e0c90c88949cbf1c6ecb428c880b8d49f74f5106f0893a1` | 骨架 owner |
| `entry/src/main/ets/features/common/ReaderPageState.ets` | 80 | `4c9108665fa5eb920a1e58d0a33d28b34cdcfcfc85a94347a56ac604e9e0e7bd` | 状态 owner |

上游只读事实源（本轮不修改；变化时重跑引用检查，不自动停止）：

| 文件 | 行数 | SHA-256 | 用途 | 漂移处理 |
|---|---:|---|---|---|
| `entry/src/main/ets/features/source/SourceOrchestrator.ets` | 728 | `b466a9ea1daee27ade0b86a3b7f993b0aa32849084c52a99e529608967b34884` | toggle/login/check owner | 重核 `operationRefs` 和 `loginWeb` 调用链 |
| `entry/src/main/ets/features/common/ReaderControlSpecs.ets` | 382 | `632bcd353d7881685115652a62a3995591ac461578a2949eebcf51e77095b17d` | 控件 spec | 重核 `control-registry` 和命中区 |
| `entry/src/main/ets/app/ReaderOperationFacts.ts` | 261 | `296e4890d751cb6dd3de805b9549303f97f0635f733571009e6a879c0ccad187` | 操作事实/回执投影 | 重核 `operationRefs` 的 `factSource` |
| `entry/src/main/ets/features/settings/RulesMutationOwner.ts` | 392 | `56e1abdfb56804ac0169e567ff3ac9e0970552ba8afc7c07ee606781d67c49a5` | 原写快照/busy 投影 | 重核 toggle 的 `factSource`/`unknownPolicy` |
| `entry/src/main/ets/app/ReaderSystemFileOpenHost.ts` | 89 | `1d0d3b2f25b015b6e806ad4534aef9dc1e311e470fb42ea970b3eb7eb5f8fb09` | 外部打开宿主 | 重核平台宿主边界；书源页当前不用 |
| `tools/message-entrypoints.json` | 2280 | `edcf03fe5481f2699e914cc1e36cbb33f336019aa8e857714e91aa8e6684f58e` | 消息入口事实源 | 重核 `messageSurfaces`；变更时单独跑消息入口检查 |
| `docs/architecture/interaction-wiring-20261019/navigation-comparison.md` | 154 | `5e62b26e0490b8c52568c2679fe5371d5d64821e5c08f9a330c185d9d7e9a763` | 路由/返回叙述矩阵 | 重核 `navigation-registry` |
| `docs/message-ui/FRAMEWORK.md` | 41 | `cd5e541cec746ec2cb290e869c563819440664344eb6643f36016d6f6a986b7d` | 消息分类与生命周期 | 重核消息引用；不在页面登记复写 |

## 2. 问题清单

只列结构问题；视觉偏好、功能新增不在本次范围。

| ID | 问题 | 证据 | 规则 | 性质 |
|---|---|---|---|---|
| P1 | 同一业务动作多入口：页头工具与页脚“批量管理”都开 SourceTools；搜索行添加与页脚“新增书源”都导入 | `SourceManagementPage.ets:281-289`、`:311-321`、`:718-731` | B1 | D1 已定本轮保留；主次/上下文仍未冻结，FIX-01 `DEFERRED`，验证 `NOT_RUN`；不据此宣称 B1 PASS 或有效例外 |
| P2 | 筛选无结果时页面空白；现有空态只处理 `sources.length === 0` | `:571-584` | B3 | 违规，必须修 |
| P3 | “未检测”筛选不含 `checking`，检测中的行会消失 | `:796-807` | B3 / 状态矩阵 | 违规，必须修 |
| P4 | 分组筛选用原始 `source.group` 比较，选项却按 trim 生成 | `:780`、`:809-824` | B3 | 违规，必须修 |
| P5 | 统计中的“启用”始终是全局，与“显示 X/Y”不一致 | `:768-773` | B1 / 信息架构 | 语义不一致，建议修 |
| P6 | 登录按钮无 busy/disabled，可重复提交 | `:688-692` | B4 | 违规，必须修 |
| P7 | 状态徽标只有颜色，没有可读文本 | `:694-697` | E1 | 违规，页面内可修 |
| P8 | 检测/登录触控高度 44×28，低于 44×44 | `ReaderControlSpecs.ets:217-228` | E2 | 共享 spec 问题，延后 |
| P9 | 字体放大后 chip/行/页脚预算溢出 | 行 76、chip 32、页脚 48 固定 | E3 | 需校准，延后 |
| P10 | `groups` prop 未被 Index 传入，分组选项只来自现有 sources | `:107`、`:809-824`；Index `:2729-2762` 未传 `groups` | 数据边界 | 建议清理 |
| P11 | 死代码 `statusBanner`、未使用 `originalActionGeneration` | `:409-439`、`:356` | 测量/维护 | 清理项，延后 |
| P12 | 固定页脚与 contentEndInset 无显式断言 | `:838-849` | S2 / S5 | 缺检查，补测试 |
| P13 | 消息框架已作为上游依赖写入契约，但书源页 4 个消息入口尚未在机器登记中绑定；页面仍只以组件名出现 | 契约层 9/10、`tools/message-entrypoints.json` | B5 / 登记 | 框架缺口，Stage 1–2 修 |
| P14 | 路由/返回/保留只有叙述矩阵，没有机器可读的路由登记；Source → Tools → Back 会重挂页面并复位查询/状态/分类/分组，NAV-07/08 未冻结 | `navigation-comparison.md` §3、§6；`Index.ets:1010-1011`、`:1498-1499`、`:2682-2699`；`SourceManagementPage.ets:107-121` | S6 / S8 / 层 1 | 框架缺口；本轮登记为 `unresolved`，不改行为 |
| P15 | 控件状态分散：`ReaderControlSpecs` 只覆盖图标按钮、按钮、表单字段；书源行、chip、开关、状态徽标没有统一控件登记，busy/disabled 由页面局部状态决定 | `ReaderControlSpecs.ets` 导出；`SourceManagementPage.ets:660-697`、`:711-715` | B4 / 层 6/8/12 | 框架缺口，Stage 1–2 建最小登记 |
| P16 | 无障碍只有零散规则：无 `a11y` 登记块、无页面焦点顺序、无浮层焦点返回、无 2.0× 证据；状态徽标和图标动作缺少可读名称 | `SourceManagementPage.ets:684-697`；契约 E1/E2/E4；E5/E6 刚补 | E5 / E6 / 层 14 | 框架缺口；生产修复只做徽标标签，L3 记 `NOT_RUN` |
| P17 | 写操作未按 `operationId` 统一绑定：login/detect 的 busy 来自行内 `checkState`，toggle 来自 `operation.original`；三者没有统一引用 `ReaderOperationFacts`，刷新失败与写入失败也没有在页面上明确分离 | `SourceManagementPage.ets:684-692`、`:711-715`；`ReaderOperationFacts.ts`、`RulesMutationOwner.ts` | B7 / B8 / 层 10/16 | 框架缺口；FIX-06 只保证登录不重复提交 |
| P18 | 平台宿主没有登记：`loginWeb` 由 `SourceOrchestrator.loginSource → ReaderRuntimeOwner.openSourceLogin → ArkWebExecutor.openInteractive` 发起，但没有 hostId、identity、returnContext、backPolicy | 源码调用链；契约 §0.5 | B6 / 层 1/9 | 框架缺口；本轮只登记，不改登录实现 |

不作为违规处理的差异：

- 书源页筛选在滚动内容里，目录页筛选在固定复合页头里。两者 `queryPriority` 不同，是合法变体，先登记，不改代码。
- 下载页 `overflow ? inline : overlay` 是混合 chrome。它必须登记为响应式变体并写清条件；在登记完成前，不按第三种契约处理。
- 页头家族存在标准、浮动、漫画、书架/搜索自建、RSS、下载、多选、阅读器等多种形态。先登记和裁决，不在本轮统一。

## 3. 总目标、分期目标与完成标准

### 3.1 总目标

建立页面结构契约框架，并以书源管理页完成首轮闭环：同一 PageBrief 能推导出同一原型与结构选择；16 层 schema 无省略项；至少一个真实页面能完成“登记 → 发现违规 → 裁决 → 修复 → 验证”，并明确记录未冻结的路由项。

### 3.2 框架目标（Stage 1–2）

建立可独立于书源页复用的最小框架：

- PageBrief（含 `stateSet` / `messageSet` / `platformSet`）与六个原型定义；三个详细原型具备可执行决策表，其余三个具备合法组合语法和必填实现字段；
- 16 层正式 schema，每层都有类型、必填项和取值域；
- 契约地图：P0–P6 上下游契约的 `contractId`、owner、source、machine source、status、consumedBy、referenceRule；只索引，不复制；
- 路由登记：11 条可见路由 + 2 条保留路由的 `RouteContract` 字段；NAV-07/08 显式 `unresolved`；
- 控件登记（最小集）：书源页实际使用的控件 ID、状态集、命中区、可访问名称；只登记实际用到的控件，不建全量控件表；
- 平台宿主登记（最小集）：书源页实际存在的 `loginWeb`，含 intent、identity、returnContext、resultPolicy、`backPolicy: unknown`；没有入口的宿主不建空项；
- 操作引用：写动作绑定 `operationId`、owner、事实源、identity/generation、busy/disabled 投影、`bindingStatus`、`unknownPolicy`、`refreshPolicy`；`partial` 必须有 `knownGap`；
- 无障碍登记：`a11y` block（ruleRefs、semantics、focusOrder、touchTargets、contrast、fontScaleMax、reduceMotion、screenReaderLabels）；
- 消息表面绑定：层 9/10 的每个消息类表面（短反馈/恢复/页态/确认/任务）引用 `tools/message-entrypoints.json` 入口 ID，不复制分类和生命周期；
- 合规结果模型（`PASS / FAIL / EXCEPTION / NOT_RUN`）与证据边界；
- validator、正反夹具、确定性测试和跨契约引用完整性检查；
- 组合语法与非法组合可被机器检查，或明确标注为人工检查项。

框架完成必须同时满足四个价值条件：

1. **确定性**：同一 Brief 对同一模型版本产生同一原型、同一结构选择和同一判定；输入不变时输出不漂移。
2. **表达完整**：schema 真正覆盖 16 层，而不是只有七八个自由文本字段；每层都能写入可判定事实，而不是审美描述。
3. **引用完整**：`routeContractRef`、`controlRefs`、`operationRefs`、`platformHosts`、`messageSurfaces`、`a11y.ruleRefs` 全部解析；悬空引用记 `FAIL`，不降为 `NOT_RUN`。
4. **可验证**：validator 能在书源页真实登记上运行，发现真实违规和断链，而不只是检查 JSON 格式；完整“修复 → 验证”闭环由 Stage 3 证明，不并入 Stage 1–2 完成。

### 3.3 书源试点目标（Stage 3）

首轮生产代码只改 `SourceManagementPage.ets`，完成：

- P2、P3、P4、P6、P7、P10、P12 修复或补检查；P1 按 D1 本轮保留入口，不影响其他项执行；
- P5 统一统计语义；
- P8、P9、P11 登记例外或延后项，写清 owner 和复审条件；
- 不改页面骨架，不改页头/页脚/滚动结构，不做视觉重设计；
- 用真实页面校准 schema、决策函数和 validator：登记能描述现状，规则能推出修复，检查能发现违规。

### 3.4 框架完成标准

1. `model.json`、`register.json`、`exceptions.json` 通过 schema 校验。
2. 书源页在 16 层均有登记，无空项；不适用项显式写 `not_applicable` 及理由。
3. 同一 PageBrief 重复推导结果一致；确定性测试通过。
4. 每个非法组合至少有一个反例夹具；正例夹具通过，反例夹具按预期失败。
5. validator 能定位到页面、层、字段和规则 ID，不只返回“失败”；它能对书源页登记实际运行并输出可定位结果，试点修复前允许为 `FAIL`。
6. 例外记录包含 owner、原因、补偿控制、起始版本、到期或复审触发条件。
7. 规则不可判定时明确标 `UNRESOLVED`，不得用自由文本冒充通过。
8. 书源页 4 个已登记消息入口在 `messageSurfaces` 中引用一致；`messageSet` 与 `stateSet` 对齐；页面登记不复制或改写消息类别、`effectiveHost`、`retireRule`。
9. `contract-map.json` 覆盖书源页实际消费的上游契约；每项有 owner、source、status、machine source、consumedBy；没有机器事实源的项标 `manual`，不冒充 L1 自动通过。
10. `navigation-registry.json` 覆盖 11 条可见路由 + 2 条保留路由；每条有 `parentRoutes`、`entrySources`、`backPolicy` 集合、`retention`、`systemBackOwner`、`restorePolicy`；NAV-07/08 标 `unresolved` 并写 `unresolvedRefs`。
11. `control-registry.json` 覆盖书源页实际控件；每项有 `controlId`、owner、状态集、命中区、可访问名称来源和 `status`（`spec`/`manual`/`partial`）；未登记控件不得进入页面 `controlRefs`。
12. `platform-host-registry.json` 只登记实际存在的宿主；书源页 `loginWeb` 有 `hostId`、owner、intent、identity、returnContext、resultPolicy、`backPolicy`；无空宿主、无“以后可能用”的项。
13. 书源页登记含 `routeContractRef`、`controlRefs`、`operationRefs`、`platformHosts`、`layers.accessibility.facts`；`brief.platformSet` 与 `platformHosts[].hostId` 一一对应，`layers.route.facts.platformHostRefs` 与 `platformHosts[].hostRef` 一致；所有引用可解析。
14. `check-contract-refs.mjs` 能对缺失、悬空、重复 owner、未登记宿主、未绑定写动作输出页面/层/字段/引用 ID；每个 `operationRef` 有 `bindingStatus`，`partial` 必须写 `knownGap`，`unbound` 不得进入 `PASS`；正反夹具按预期通过或失败。

### 3.5 书源试点完成标准

Stage 3 的“完成”指本轮修复、登记和定向测试闭环，不等于全层结构验收通过。层 1 因 NAV-07/08 记 `FAIL`（原因 `unresolved`），书源页整体不宣称 `PASS`；若要求全层通过，需先执行 D4 的路由修复，另立阶段并取得 Index 授权。

1. D1 已确认本轮暂不修改入口：登记实际入口及 owner，FIX-01 为 `DEFERRED`、验证为 `NOT_RUN`；本轮不要求 B1 PASS，不为缺少主次/上下文依据擅自建立有效例外。
2. 筛选为空有独立状态和“清除筛选”。
3. “未检测”的语义在代码和登记中一致。
4. 分组筛选的选项与比较使用同一 trim 规则。
5. 统计数字与当前筛选结果一致，或明确标注全局。
6. 登录按钮在操作进行中不可重复提交。
7. 状态徽标有可读文本。
8. 固定页脚与 contentEndInset 有静态断言。
9. 定向测试通过；366×844 demo 已出；设备对比执行或记 `NOT_RUN`。
10. 书源页登记 revision 与实际源码一致，validator 无新增 `FAIL` 或未登记例外。
11. 改动页面清单只包含声明的文件；框架完成与试点完成分别记账，不合并为一个 `PASS`。
12. 路由：书源页父级从设置/搜索入口捕获，返回消费同一上下文；NAV-07/08 以 `unresolved` 登记，S8 记 `FAIL`，层 1 不记 `PASS`；本轮不改 Index 路由行为。
13. 平台：登录仍走 `loginWeb`，登记 `hostId`、intent、identity、returnContext、resultPolicy；页面不直接打开 Web、不画平台外框；返回结果核对发起时身份，旧 session 丢弃；`backPolicy` 记 `unknown`。
14. 控件/操作：书源页实际控件在 `controlRefs` 中可解析；写动作在 `operationRefs` 中有 owner、事实源、`bindingStatus` 和 unknown 策略，`partial` 有 `knownGap`；登录 busy/disabled 来自原 owner 的行状态投影或操作事实，不重复提交；已确认写后的刷新失败只重读。
15. 无障碍：状态徽标、登录/检测动作有可读名称；`a11y` block 完整；焦点顺序已登记；读屏与 2.0× 检查执行或明确 `NOT_RUN`，不用源码断言冒充 L3。
16. 跨契约引用全部可解析；页面 `registryRevisions` 与各自实际 registry revision 逐项一致（不同 registry 不要求相同数字）；无悬空引用、无重复 owner。

## 4. 修复原则

- 先修违规，不做顺手重设计。
- 一次只改一个页面；共享组件改动后置。
- 页面内能解决的，不先改共享组件。
- 每个修复必须绑定规则 ID、测试和回滚方式。
- 删除入口前先确认真实使用路径，不能凭“看起来重复”删除。
- 视觉 gate 与代码 gate 分开记账；没有实际 demo 不宣称视觉通过。
- 消息类修复不新增出口；分类和生命周期以消息框架为准，页面只改呈现位置和状态。
- 路由/平台宿主/控件/操作/无障碍变更先更新对应上游登记，再回写页面引用；页面不复制上游状态机。
- 本轮不改 `Index.ets` 路由，不修 NAV-07/08 的保留行为；相关页面层 1 只能记 `FAIL`（原因 `unresolved`）。
- 平台宿主不是路由；不画平台外框，不猜 Back 顺序，不把平台成功当业务成功。
- 契约地图和 registry 只做索引与校验，不替代 `navigation-comparison.md`、`ReaderControlSpecs.ets`、`ReaderOperationFacts.ts` 或消息框架。
- 不改 `ReaderThemeRegistry.ts`；不新增未登记的消息出口、控件 spec 或平台宿主。

## 5. 阶段计划

| Stage | 目标 | 产物 | 门禁 | 停止条件 |
|---|---|---|---|---|
| 0 | 冻结当前输入 | 本文档工作树字节基线 | 实际输入哈希及 writer 协调；保留无关 dirty WIP | 本阶段实际输入漂移则重审受影响项 |
| 1 | 最小框架 | `model.json`、16 层 schema、契约地图/导航/控件/平台登记及 schema、书源页登记、例外账本 | 人工对照契约 §9.1 检查字段类型、必填项、事实来源、已知差异和引用清单；机器复验在 Stage 2 | 上游无 owner 或模型输入不可表达时先补模型；目标待决登记为 knownGap，不伪造通过 |
| 2 | 检查与确定性 | `derive-structure.mjs`、`validate-model.mjs`、`check-register.mjs`、`check-contract-refs.mjs`、共享 `lib.mjs`、正反夹具、确定性测试 | 对 Stage 1 产物机器复验；框架完成标准 1–14；同输入同结果、反例按预期失败、断链可定位 | 只能查格式不能查结构时显式标人工边界；框架本身FAIL先修，不把页面已登记FAIL当工具故障 |
| 3 | 书源页修复与登记闭环（层 1 记 `FAIL`，原因 `unresolved`） | P2–P7、P10、P12 修复；P1 按 D1 延后；P14–P18 登记与最小绑定；登记更新；定向测试 | 书源试点完成标准 1–16；层 1 不记 `PASS`，B1 不要求本轮 PASS | 需改共享组件、Index 路由或超两页则拆 Stage 4；框架缺口先回 Stage 1–2 |
| 4 | 共享能力与预算接入 | 既有共享控件的触控/字体规格、书源行与容器预算、可核验的预算证据 | 精确消费者影响分析、控件与页面定向测试、四个字号点原生测量 | 新建通用行组件须有两个以上真实页面消费者；单页预算留在该 feature，不据此阻止修复既有共享规格 |
| 5 | 目录/下载登记 | 两页登记（含消息、路由、控件、操作、平台、无障碍引用）与差异裁决 | 差异可解释、无未登记变体、全部引用存在 | 需要结构重写则停下重新评审 |
| 6 | 清理与扩展 | 死代码清理、其余页面分批 | 每批登记 + 检查 | 超出 v0.2 范围则停 |

以上保留各阶段准入顺序。当前Stage 1–3已完成本轮范围；D1已裁决本轮保留入口、FIX-01延期，D2已移除prop，D3已裁决常态列表并完成14.15代码/SDK验证。D4/D5仍按`unresolved`/`unknown`落账；D6按实际页面增量登记执行，正式跨页登记尚未完成。

## 6. 书源页逐项修复

### FIX-01（P1 / B1）去掉重复入口

用户已裁决 D1：“暂不修改这些入口”。本轮保留页头工具、搜索行添加及页脚两个入口；本项状态为 `DEFERRED`，执行/验证为 `NOT_RUN`。下列收敛方案保留作后续评审，不在本轮执行。入口主次/上下文仍未冻结，B1 不得因延期或保持现状而改记 PASS/EXCEPTION。

**现状**

- 页头尾部 `ReaderIconButton` 打开 SourceTools：`SourceManagementPage.ets:281-289`。
- 搜索行右侧添加按钮打开导入：`:311-321`。
- 页脚“批量管理”也打开 SourceTools，“新增书源”也打开导入：`:718-731`。

**推荐方案**

保留页脚两个主操作，删除页头尾部和搜索行添加：

1. `backBar()` 只保留 `PageBackBar({ title, onBack })`，删除 `ReaderIconButton` 子节点。
2. `searchField()` 只保留 `ReaderSearchField`，删除右侧 40×40 Stack；搜索行高度仍为 44。
3. 页脚 `bottomActionBar()` 不变。
4. 删除不再使用的 `ReaderIconButton`、`ReaderPressFeedback` import。
5. `onOpenTools`、`onAddSource` 仍由页脚使用，保留 prop。

**理由**

- 两个动作都作用于整个集合，按决策表应放在 Footer。
- 页脚常驻，删除页头/搜索行入口不降低可达性。
- 不新增交互，不改业务行为，只消除重复。

**备选**

保留页头工具、删除页脚“批量管理”；页脚只保留“新增书源”。若确认双入口有主次或上下文差异并共享 owner，也可保留并登记理由；不能以页面作者偏好自行选型。

**测试**

- 按 D1 确认的动作语义集合检查页头、搜索区和页脚入口及 callback owner；不全局禁止某个合法组件。
- 手工：页头返回、页脚批量管理、页脚新增三条路径分别可达。

**风险**

- 页头工具入口消失，用户需要改从页脚进入 SourceTools；用 demo 检查可发现性。

### FIX-02（P2 / B3）筛选为空状态

**现状**

`sourceList()` 只在 `sources.length === 0` 时显示空态；`projectedSources.length === 0` 且原始 sources 非空时，列表只剩筛选区，没有结果说明。

**修复**

在 `sourceList()` 的 `sources.length === 0` 空态之后增加：

```ts
if (this.sources.length > 0 && this.projectedSources.length === 0 &&
  this.statusKind !== 'loading' &&
  this.operation.original?.blocked !== true &&
  this.operation.receipt?.receipt.confirmation !== 'unknown') {
  ListItem() {
    ReaderPageState({
      title: '没有匹配的书源',
      message: '调整搜索、状态、分类或分组',
      actionLabel: '清除筛选',
      onAction: (): void => this.clearFilters()
    });
  }
}
```

加载中不显示筛选空态，避免刷新时闪烁；未知回执/原操作阻断由 recovery 浮层负责。该空态仍属于 `sourceList::shared.page-state`，不新增消息 family 或宿主。

新增：

```ts
private clearFilters(): void {
  this.searchQuery = '';
  this.statusValue = '全部';
  this.categoryValue = 'all';
  this.groupValue = '全部分组';
  this.rebuildSourceProjection();
}
```

要求：

- 不清空业务数据，只清筛选。
- 不触发网络读取。
- 清除后若仍为空，回到“暂无书源”状态。
- 未知回执/原操作阻断时，不覆盖 recovery 浮层；按现有优先级处理。

**测试**

- 有 sources、无匹配结果 → 显示筛选空态。
- 点击“清除筛选” → 四个条件归零、列表恢复。
- 原始 sources 为空 → 仍显示“暂无书源”，不显示筛选空态。

### FIX-03（P3 / B3）统一“未检测”语义

**现状**

`matchesStatus` 的“未检测”只匹配 `undefined` 和 `unchecked`；`checking` 行会从该筛选中消失。

**修复**

将“未检测”定义为“尚未得到首次检测结果”：

```ts
if (this.statusValue === '未检测') {
  return source.checkState === undefined ||
    source.checkState === 'unchecked' ||
    source.checkState === 'checking';
}
```

在登记中写明：`未检测 = undefined | unchecked | checking`。如果后续要单独筛“检测中”，新增独立状态，不改变本条语义。

**测试**

- `unchecked` 行出现。
- `checking` 行出现，且检测按钮显示“检测中”。
- `passed`/`failed` 行不出现。

### FIX-04（P4 / B3）分组比较统一 trim

**现状**

`groupOptions()` 对 `source.group` 做 `trim()`，`filteredSources()` 却直接比较原始值；带空格的分组可能选不中。

**修复**

```ts
const sourceGroup = (source.group ?? '').trim();
const matchesGroup = this.groupValue === '全部分组' || sourceGroup === this.groupValue;
```

要求：选项生成与过滤比较共用同一规则；不再在别处重复实现。

**测试**

- `group = " 玄幻 "`，选择“玄幻”能命中。
- 空字符串、`全部分组` 不进入选项。
- 重复分组只出现一次。

### FIX-05（P5）统计与筛选一致

**现状**

`statsText()` 的“显示 X/Y”是筛选结果，但“N 个启用”始终统计全部 sources。

**修复**

新增：

```ts
private filteredEnabledCount(): number {
  return this.projectedSources.filter((source) => source.enabled).length;
}
```

`statsText()` 改为：

- 未筛选：`${this.sources.length} 个书源 · ${this.filteredEnabledCount()} 个启用`
- 已筛选：`显示 ${filteredCount}/${this.sources.length} 个书源 · ${this.filteredEnabledCount()} 个启用`

不再使用全局 `enabledCount()`；如保留，改名 `globalEnabledCount()` 并只在明确标注“全局”时使用。

**测试**

- 无筛选时数字与全量一致。
- 筛选后“启用”数只统计当前结果。
- 空结果时数字为 0，不显示全局启用数。

### FIX-06（P6 / B4）登录按钮 busy/disabled

**现状**

`loginButton()` 只有 `label` 和 `onAction`，没有忙碌/禁用状态。

**修复**

复用已有的行状态和操作投影，不新建页面私有 busy 布尔：

- `SourceOrchestrator.loginSource()` 已把该行的 `checkState` 置为 `checking`（`:278-300`），登录按钮直接读这个事实；
- `loginButton` 增加 `isBusy: source.checkState === 'checking'`、`actionEnabled: this.sourceActionEnabled() && source.checkState !== 'checking'`；
- `sourceActionEnabled()` 继续负责 blocked/unknown 的全局禁用；
- 不改 `sourceToggleBusy()` 的语义；开关仍读 `operation.original`，登录/检测读该行 `checkState`；
- 在登记中新增 `operationRefs` 项 `source.login`，owner 指向实际登录 owner，`factSource: {path, symbol}` 指向实际 `SourceOrchestrator.setCheckProjection`，`busyProjection` 为 `source.checkState==='checking'`，`disabledProjection` 引用该行状态和全局禁用，`unknownPolicy: recovery`，`refreshPolicy: read-only`。

要求：

- 同一行登录进行中不可重复提交；按钮显示 busy。
- 原操作阻断或回执未知时禁用。
- busy/disabled 来自 orchestrator 的行状态或操作投影，不从按钮文案或局部点击状态推断。
- 不改变登录业务逻辑。

**风险**

登录/检测的忙碌是行级 `checkState`，开关是 `operation.original`；两者成熟度不同，登记必须如实写。若未来需要统一到单一操作事实，Stage 4 再做，不在本轮把两种投影伪装成一种。

**测试**

- `checkState === 'checking'` 时点击登录不触发回调。
- blocked/unknown 时禁用。
- idle 时可触发一次。
- 源码断言 busy/disabled 读取该行 `checkState` 和 `sourceActionEnabled()`，不存在新的页面私有 submitting 布尔。

### FIX-07（P7 / E1）状态徽标可读文本

**现状**

`statusBadge()` 只传背景色和色点，没有可访问文本。

**修复**

新增：

```ts
private statusBadgeLabel(source: BookSource): string {
  if (source.checkState === 'checking') return '正在检测';
  if (source.checkState === 'passed') return '检测通过';
  if (source.checkState === 'failed') return '检测失败';
  return '未检测';
}
```

在行内用零额外间距的容器包裹徽标：

```ts
Row() {
  this.statusBadge(this.statusBadgeBackground(source), this.statusBadgeDot(source));
}
.accessibilityText(this.statusBadgeLabel(source))
.accessibilityGroup(true)
```

要求：

- 不改变徽标尺寸和位置。
- 读屏能读出状态，不再只依赖颜色。
- 若包裹导致布局变化，改用 `StatusBadge` 的可选 `label` 参数，但该共享改动放 Stage 4。
- 登记 `a11y.screenReaderLabels` 包含 `statusBadgeLabel`；状态徽标不得只用颜色编码。

**测试**

- 四种状态标签正确。
- 视觉尺寸与基线一致。
- 读屏文本存在（静态断言或人工）。
- `a11y.screenReaderLabels` 与源码标签函数一致；L3 未执行时记 `NOT_RUN`。

### FIX-08（P8 / E2）触控目标

**现状**

`ReaderControlSpecs.ets:217-228` 的检测/登录为 44×28。低于 44×44。

**本轮处理**

- 不在 Stage 3 改共享 spec。
- 登记 `EX-E2-01` 例外候选：owner `harmony-ui`，到期为 Stage 4 完成或 2026-12-31。“扩大纵向 response region 待修”属于未来修复，不能充当现行补偿；补偿尚未落实时 E2 保持 FAIL，不能改记 EXCEPTION。
- Stage 4 先确认 `ReaderButton` 是否已有 response region；没有则在共享 spec 或包装层补 44×44，并跑所有消费者页面。

### FIX-09（P9 / E3）字体缩放预算

**现状**

chip 高 32、行高 76、页脚 48 是固定值；字体放大后存在溢出风险。

**本轮处理**

- 不在 Stage 3 拍数字。
- 登记 `EX-E3-01` 例外候选：owner `harmony-ui`，到期为行预算 resolver 落地或 2026-12-31。“1.6× 下允许纵向滚动，状态与操作不裁切”需先有实际证据；未验证时 E3 保持 FAIL/相关 L3 NOT_RUN，不把补偿目标写为已生效。
- Stage 4 用 1.0 / 1.3 / 1.6 / 2.0 四个字号点做实际测量，生成行预算 spec；若某字号无合法行形态，停止并请求设计决策。

### FIX-10（P10）移除未使用的 groups prop

**现状**

`@Prop groups: string[] = []`（`:107`），Index 未传；`groupOptions()` 仍遍历该 prop（`:811-816`）。

**修复**

- 删除 `groups` prop。
- 删除 `groupOptions()` 中的 `this.groups` 循环。
- 分组选项只来自当前 `sources` 的 `group`。
- 若未来需要 catalog 中“尚无书源的分组”，新增显式 `catalogGroups` prop，并写清数据 owner；不要恢复一个永远为空的隐式 prop。

**测试**

- 分组选项只来自 sources。
- 空 sources 时只有“全部分组”。
- 不再出现 `this.groups` 引用。

### FIX-11（P11）死代码清理

**本轮处理**

- 不在 Stage 3 删除；`statusBanner` 仍被 `tools/test-source-index-presentation-consumers.mjs` 引用，删除需要同步改测试。
- Stage 6 统一清理：删除 `statusBanner`（`:409-439`）和 `originalActionGeneration`（`:356`），更新引用测试。
- 清理前确认没有运行时挂载或测试依赖。

### FIX-12（P12 / S2、S5）补固定页脚与 inset 断言

**现状**

`pageGeometry()` 中有 `input.contentEndInset = input.footerHeight`（`:838-849`），但没有测试断言；固定页脚存在时，状态页/末行可见性也没有检查。

**修复**

只加测试，不改布局：

- 源码断言：`contentEndInset` 来自 `footerHeight`，不是常量。
- 源码断言：footer 通过 `ReaderPageScaffold` 的 footer slot 挂载，不是页面私有 overlay。
- 状态测试：原始空、筛选空、错误态都位于 List 内，且 List 使用 `contentEndOffset`。
- 测量测试：header/footer 测量键与 revision 存在。

若测试无法稳定读取 ArkUI 运行时，降级为 L1 静态断言并注明边界；不伪造运行时通过。

### FIX-13（P14–P18）跨契约绑定与登记

**现状**

书源页已有 recovery/readFacts 绑定和 `operation.original` 串行状态，但页面登记缺少路由、控件、操作、平台宿主和无障碍引用；路由/返回只有叙述矩阵，平台登录没有 host 登记。

**修复**

只补登记、引用和定向断言，不改页面结构，不改 Index 路由：

1. `routeContractRef: "nav.source"` 解析上游的父级、入口、返回、保留、systemBackOwner 和恢复策略；`layers.route.facts` 保存对应 revision 的策略检查快照与 `platformHostRefs: ["platform.loginWeb"]`。Source 上游 `status: "unresolved"`、`unresolvedRefs: ["NAV-07"]`；NAV-08 属于 Tools 路由，可在原因中记录关联，但不能冒充 Source 的保留契约。草稿未冻结时 `retention.draft: "unknown"`，不能用目标 keep 冒充已定；当前 Source → Tools 返回仍会复位。
2. `brief.platformSet: ["loginWeb"]`；`platformHosts` 只登记 `loginWeb`，写 `hostRef`、`intent: "source.login"`、`identity: "sourceId+sessionId"`、`returnContext: "source"`、`resultPolicy`、`backPolicy: "unknown"`、`stalePolicy: "discard-old-session"`。
3. `controlRefs` 按当前字节列实际控件：页头返回/工具、搜索/添加、筛选 chip、分组选择、行、登录、检测、徽标、开关和页脚动作；D1 本轮保留，相关引用均保留。每项解析到 `control-registry.json`；没有现成 spec 的控件标 `manual`/`partial`，不伪造命中区通过。
4. `operationRefs` 绑定 toggle、login、detect；每项写 `bindingStatus`：toggle 为 `bound`，login/detect 为 `partial` 并在 `knownGap` 说明 busy 仍读行 `checkState`。页脚导入/批量是导航或选择入口，不伪装成写操作；导入的实际写操作由 import owner 在其页面/对话框登记。owner 和事实源必须指向真实 Host/Orchestrator/Projection，不用页面方法名冒充 owner。
5. `layers.accessibility.facts` 写 `ruleRefs`、`semantics`、`focusOrder`、`touchTargets`、`contrast`、`fontScaleMax`、`reduceMotion`、`screenReaderLabels`；未验证字号上限填 `null`，E5/E6 的 L3 证据单独记。
6. `messageSurfaces` 保持现有 4 个入口；筛选空态仍归 `sourceList::shared.page-state`。

**不做的**

- 不改 `Index.ets` 路由；不修 NAV-07/08 的保留行为；因此层 1 记 `FAIL`（原因 `unresolved`），不记 `PASS`。
- 不改 `SourceOrchestrator` / `ReaderRuntimeOwner` / `ArkWebExecutor` 的登录实现；只登记现有 `loginWeb` 路径。
- 不新增控件 spec、不新增消息 family、不新增平台宿主。
- 不把 `sourceActionBusy()` 之外的状态机复制到页面。

**测试**

- 源码断言：书源页不直接实例化 Web/登录页，不画平台外框；登录回调只调用 `onLoginSource`。
- 登记断言：`brief.platformSet` 与 `platformHosts[].hostId` 一一对应；`layers.route.facts.platformHostRefs` 与 `platformHosts[].hostRef` 一致；`hostRef`、`controlRefs`、`operationRefs`、`layers.accessibility.facts.ruleRefs`、`messageSurfaces` 全部可解析。
- 路由断言：`routeContractRef` 指向 navigation registry；`status: unresolved` 时非空 `unresolvedRefs` 存在。
- 操作断言：登录 busy 读取该行 `checkState`，blocked/unknown 禁用读取 `sourceActionEnabled()`；开关仍读 `operation.original`，不要求 login/detect 冒充统一绑定。已确认写后的刷新路径不重新调用写方法。
- B6 单独检查平台结果回到捕获 identity/session；S7 单独记录平台 Back 顺序。未验证的项各记 `NOT_RUN`，不能互代。
- 引用完整性：`check-contract-refs.mjs` 对书源页登记运行通过；反例（删一个 hostRef/controlRef）按预期失败。

## 7. 跨页登记与裁决（不改代码）

### 7.1 书源页 vs 目录页

- 书源页：查询次级、集合浏览为主 → Inline 查询。
- 目录页：章节查询是主任务 → HeaderSlot 查询。
- 两者差异是合法变体，登记 `queryPriority` 即可；不把目录页改成 Inline，也不把书源页改成固定复合页头。

### 7.2 下载页

- 原始基线使用`overflow ? inline : overlay`同时决定头尾归属；该基线与评审过程保留在14.14。
- 用户已裁决常态列表，按14.15实现：header恒在List，普通dock为尾项；管理态仅在最低内容预算足够时固定footer。头尾位置分别登记，不再把导航与操作的生命周期绑在同一高度开关上。
- 目录/下载完整上游引用和16层事实仍按Stage 5补齐；当前代码/SDK通过不等于全页或原生合规。

### 7.3 页头家族

- PageBackBar 标准/浮动、AppTopBar home、书架/搜索自建浮动头、RSS、下载、多选、阅读器 chrome：先登记角色/呈现/表面。
- 本轮不做页头统一；只在 Stage 5 处理“同一角色、同一呈现、两个实现”的重复。
- 书源页只保留标准固定 PageBackBar，不新增变体。

### 7.4 消息表面

- Stage 5 登记目录/下载时，为各自消息入口建立 `messageSurfaces` 引用；不复制消息框架的分类和生命周期。
- 本轮不改两页的生产代码和消息入口描述；登记时发现过期入口只记录，不在 Stage 3 顺手修改。

### 7.5 跨页契约引用

- Stage 5 为目录/下载登记 `routeContractRef`、`controlRefs`、`operationRefs`、`platformHosts`、`a11y`；缺上游登记先补 registry，不先写页面。
- 目录页的返回目标（详情/阅读控制）和下载页的父级（书架/设置/阅读/详情/目录）必须来自捕获上下文；不在页面登记里复写 Index 分支。
- 只有实际存在的平台宿主才登记；目录/下载当前若没有文件选择、分享等入口，不建空项。
- 控件登记按页面实际使用增量添加；不因为“以后可能用”预建控件。
- 发现上游文档过期时记录到对应 owner，不在页面登记里静默改语义。

## 8. 测试与证据

### 8.1 框架文件（Stage 1–2）

Stage 1（模型、契约索引与治理）：

```text
Reader-for-HarmonyOS/tools/contracts/contract-map.json
Reader-for-HarmonyOS/tools/contracts/navigation-registry.json
Reader-for-HarmonyOS/tools/contracts/control-registry.json
Reader-for-HarmonyOS/tools/contracts/platform-host-registry.json
Reader-for-HarmonyOS/tools/contracts/schema/contract-map.schema.json
Reader-for-HarmonyOS/tools/contracts/schema/navigation-registry.schema.json
Reader-for-HarmonyOS/tools/contracts/schema/control-registry.schema.json
Reader-for-HarmonyOS/tools/contracts/schema/platform-host-registry.schema.json
Reader-for-HarmonyOS/tools/page-structure/model.json
Reader-for-HarmonyOS/tools/page-structure/register.json
Reader-for-HarmonyOS/tools/page-structure/exceptions.json
Reader-for-HarmonyOS/tools/page-structure/schema/model.schema.json
Reader-for-HarmonyOS/tools/page-structure/schema/register.schema.json
Reader-for-HarmonyOS/tools/page-structure/schema/exceptions.schema.json
```

Stage 2（推导与检查）：

```text
Reader-for-HarmonyOS/tools/page-structure/derive-structure.mjs
Reader-for-HarmonyOS/tools/page-structure/validate-model.mjs
Reader-for-HarmonyOS/tools/page-structure/check-register.mjs
Reader-for-HarmonyOS/tools/page-structure/check-contract-refs.mjs
Reader-for-HarmonyOS/tools/page-structure/lib.mjs
Reader-for-HarmonyOS/tools/page-structure/test-page-structure-model.mjs
Reader-for-HarmonyOS/tools/page-structure/fixtures/*.json
```

| 文件 | 职责 |
|---|---|
| `contract-map.json` | P0–P6 上下游契约索引：`contractId`、owner、source、machine source、status、consumedBy、referenceRule；不复制契约正文 |
| `navigation-registry.json` | 11 条可见路由 + 2 条保留路由的 `RouteContract`；NAV-07/08 标 `unresolved`；不定义新的返回逻辑 |
| `control-registry.json` | 书源页最小控件集：`controlId`、owner、状态集、命中区、可访问名称来源、`status: spec / manual / partial`；不建全量控件表 |
| `platform-host-registry.json` | 实际存在的平台宿主：`hostId`、owner、平台表面、结果策略、默认 `backPolicy`；无空宿主 |
| `model.json` | 机器可读的原型、16 层字段、决策表、非法组合、不变量、结果枚举；与设计文档同版本 |
| `register.json` | 页面实例 → 原型 → 16 层选择 → 组件 owner → 例外 → 检查方式；Stage 1 先登记书源页，含 `messageSurfaces`、`routeContractRef`、`controlRefs`、`operationRefs`、`platformHosts`、`a11y` |
| `exceptions.json` | 例外账本：owner、原因、补偿控制、起始版本、到期或复审触发条件 |
| `schema/*.json` | 页面结构与契约索引的结构约束；必填项、枚举、引用完整性 |
| `derive-structure.mjs` | 输入 PageBrief 与同版 model/RouteContract context，输出可推导的原型、页头、查询与主操作选择；纯函数、无 I/O、无随机；不生成16层实际实现或证据 |
| `lib.mjs` | 共享 JSON 读取、结构化诊断和 Ajv 适配；复用已有安装的 Ajv 8.17.1（MIT），不自研 JSON Schema 校验器；运行时记录实际解析位置 |
| `validate-model.mjs` | 校验页面结构 JSON 和契约索引的 schema、版本、枚举、16 层完整性和引用字段存在/层级一致；跨文件解析由 `check-contract-refs.mjs` 负责 |
| `check-register.mjs` | 校验登记与源码事实的绑定：文件/组件存在、revision 与哈希一致、可静态检查的结构断言；不能机器检查的项显式标 manual |
| `check-contract-refs.mjs` | 解析页面登记中的 `routeContractRef`、`controlRefs`、`operationRefs`、`platformHosts`、`messageSurfaces`、`a11y.ruleRefs`；悬空、重复 owner、未登记宿主、未绑定写动作按 FAIL 输出 |
| `tools/message-entrypoints.json`（只读依赖） | 消息入口 ID、family、`effectiveHost`、`retireRule` 的事实源；本框架不写入，变更只由 Stage 3 按实际消息行为更新对应入口 |
| `test-page-structure-model.mjs` | 确定性、正反夹具、非法组合、边界 Brief、`messageSet`/`stateSet` 一致性；失败必须指向规则 ID |
| `fixtures/*.json` | 仅测试输入/输出；不进入生产 import；含契约引用正反例 |

`navigation-registry.json` 的登记范围：`bookshelf`、`settings`、`bookshelfSettings`、`bookshelfMultiSelect`、`search`、`source`、`sourceTools`、`downloads`、`detail`、`directory`、`reading`；保留路由 `bookshelfManagement`、`rulesManagement`。只写 `RouteContract` 字段，不复写 `navigation-comparison.md` §3/§3.1 的行为描述。

上游事实源（只读依赖，不在本框架写入）：`navigation-comparison.md`、`ReaderControlSpecs.ets`、`ReaderOperationFacts.ts`、`RulesMutationOwner.ts`、`message-entrypoints.json`、`ReaderSystemFileOpenHost.ts` 与登录 Web 宿主调用链。

Stage 1 与 Stage 2 分开验收：模型、契约索引和 schema 不依赖 validator 才能成立；validator 通过也不代表模型完整。

### 8.2 书源页定向测试（Stage 3）

```text
Reader-for-HarmonyOS/tools/test-source-management-contract.mjs
```

`test-source-management-contract.mjs` 覆盖：

- FIX-01：按 D1 保持 `DEFERRED / NOT_RUN`，本轮不执行删除入口断言；登记应与保留的实际入口一致。
- FIX-02：筛选空态与清除筛选。
- FIX-03：未检测含 checking。
- FIX-04：分组 trim。
- FIX-05：统计与筛选一致。
- FIX-06：登录 busy/disabled，且 busy 来自该行 `checkState === 'checking'` 与 `sourceActionEnabled()`。
- FIX-07：状态标签与 `a11y.screenReaderLabels`。
- FIX-10：无 `this.groups`。
- FIX-12：contentEndInset 与 footer slot 断言。
- FIX-13：`routeContractRef`、`controlRefs`、`operationRefs`、`platformHosts`、`layers.accessibility.facts`、`messageSurfaces` 引用可解析；`brief.platformSet` 与 `platformHosts` 一一对应；`status: unresolved` 有非空 `unresolvedRefs`。
- FIX-13：书源页不直接打开 Web 登录页、不画平台外框；登录只调用 `onLoginSource`。
- FIX-13：写动作绑定 owner/事实源；已确认写后的刷新路径不重新调用写方法。

消息入口断言：

- 书源页现有 4 个已登记入口：`onMessageChanged`（transient）、`originalRecovery` / `pendingOverlay`（recovery）、`sourceList`（page-state）。
- FIX-02 的筛选空态仍属于 `sourceList::shared.page-state`，不新增 family、不新增消息出口；若 `effectiveHost` 描述需要补充 `filteredEmpty`，只更新该入口描述。
- FIX-11 若执行，删除 `statusBanner` 后同步更新消息入口描述；未执行时不改 `message-entrypoints.json`。

复用现有测试的 builder/harness 方式；不引入新的测试框架。

### 8.3 现有测试

- `tools/test-source-management-typography.mjs`：只有行布局变化才更新；本轮不计划改行高，默认不动。
- `tools/test-source-index-presentation-consumers.mjs`：FIX-11 前不动；FIX-11 时同步更新 `statusBanner` 引用。

### 8.4 门禁

2026-11-03 P0复验以§14.16与最新followup manifest为准：六个筛选case的准确入口为`node tools/test-reader-filter-controls.mjs --case specs,filter-font-budget,controls,search-draft,source-panel,filter-sheet-exit`，该批已同进程通过，当前输入未变，记REUSED。旧的五项加exit分批回执保留为历史，不再据此宣称仍有ID隔离缺口。compact-sheet的SearchPage/ReaderFilterControls与未跟踪测试已有SHA绑定，本批追加可恢复的内容归档；不操作Git index。

| 阶段 | 命令/证据 | 通过标准 |
|---|---|---|
| Stage 1 | 人工对照契约 §9.1 与源码 | 16层固定键、逐层封闭类型、事实来源、NOT_RUN/FAIL与待决项可审阅；本阶段不依赖尚未创建的 validator |
| Stage 2 | `node tools/page-structure/validate-model.mjs` | 机器复验 Stage 1 schema、版本、枚举、16层完整性和引用字段；不自动 import 业务测试、SDK或构建 |
| Stage 2 | `node tools/page-structure/test-page-structure-model.mjs` | 同一 Brief 同结果；正例通过；每个非法组合的反例按预期失败 |
| Stage 2 | `node tools/page-structure/check-register.mjs` | 登记与源码绑定一致；manual 项已逐条列出，未冒充自动通过 |
| Stage 2 | `node tools/page-structure/check-contract-refs.mjs` | 所有引用可解析；悬空/重复 owner/未登记宿主/未绑定写动作按预期失败 |
| Stage 3 | `node tools/test-source-management-contract.mjs --case filter-projection,list-state,login-status,footer-geometry` | 方法/SDK层覆盖FIX-02–07、10、12；FIX-13引用由独立引用检查证明，B6/B8运行行为未测；FIX-01延后且NOT_RUN |
| Stage 3 | 书源页登记 revision 校验 | 登记与修复后源码一致；无新增未登记 `FAIL` 或例外 |
| Stage 3（条件） | `node tools/check-message-entrypoints.mjs --check --file entry/src/main/ets/features/source/SourceManagementPage.ets` | 仅当书源页消息入口变更时执行准确文件的AST/登记检查；不触发全树扫描，见§14.3 |
| Stage 3 | 366×844 demo | 实际截图/录屏，非文字说明 |
| Stage 3 | 设备对比 | 有授权才执行；否则 `NOT_RUN` |
| Stage 3 | 读屏/2.0× 检查 | 有授权才执行；否则 `NOT_RUN`，不得用静态断言替代 |
| Stage 4 | 共享改动影响分析 + 消费者测试 | 全部受影响页面通过 |
| Stage 5 | 目录/下载登记 | 差异可解释、无未登记变体；消息、路由、控件、操作、平台、无障碍引用全部存在 |

Stage 3 的层 1 因 NAV-07/08 未冻结，记 `FAIL`（原因 `unresolved`），不能记 `PASS`；S6 只按实际父级捕获证据判断，S8 为 `FAIL`，本轮不登记 S8 例外。平台 Back 顺序归 S7，未实测记 `NOT_RUN` 且 `backPolicy: unknown`；B6 独立核验发起 identity/session，未做定向验证记 `NOT_RUN`。

Stage 1–2 全部通过只证明“框架完成”；Stage 3 定向项通过只证明“书源页修复与登记闭环完成”，不证明全层结构验收通过。层 1 的 `FAIL` 和 `unresolved` 原因必须与 Stage 3 结果一起记录，不能以单个 `PASS` 代替。

只跑本次刚需，不跑全量套件。结果只能是 `PASS / FAIL / EXCEPTION / NOT_RUN`。

## 9. 文件白名单

### Stage 1 允许新增（框架模型、契约索引与登记）

```text
Reader-for-HarmonyOS/tools/contracts/contract-map.json
Reader-for-HarmonyOS/tools/contracts/navigation-registry.json
Reader-for-HarmonyOS/tools/contracts/control-registry.json
Reader-for-HarmonyOS/tools/contracts/platform-host-registry.json
Reader-for-HarmonyOS/tools/contracts/schema/contract-map.schema.json
Reader-for-HarmonyOS/tools/contracts/schema/navigation-registry.schema.json
Reader-for-HarmonyOS/tools/contracts/schema/control-registry.schema.json
Reader-for-HarmonyOS/tools/contracts/schema/platform-host-registry.schema.json
Reader-for-HarmonyOS/tools/page-structure/model.json
Reader-for-HarmonyOS/tools/page-structure/register.json
Reader-for-HarmonyOS/tools/page-structure/exceptions.json
Reader-for-HarmonyOS/tools/page-structure/schema/model.schema.json
Reader-for-HarmonyOS/tools/page-structure/schema/register.schema.json
Reader-for-HarmonyOS/tools/page-structure/schema/exceptions.schema.json
```

### Stage 2 允许新增（推导与检查）

```text
Reader-for-HarmonyOS/tools/page-structure/derive-structure.mjs
Reader-for-HarmonyOS/tools/page-structure/validate-model.mjs
Reader-for-HarmonyOS/tools/page-structure/check-register.mjs
Reader-for-HarmonyOS/tools/page-structure/check-contract-refs.mjs
Reader-for-HarmonyOS/tools/page-structure/lib.mjs
Reader-for-HarmonyOS/tools/page-structure/test-page-structure-model.mjs
Reader-for-HarmonyOS/tools/page-structure/fixtures/*.json
```

Stage 1–2 不修改生产代码；`fixtures/*.json` 仅测试夹具，不进入生产 import。`tools/contracts/*` 只做索引和引用校验，不复制 `navigation-comparison.md`、`ReaderControlSpecs.ets`、`ReaderOperationFacts.ts`、`message-entrypoints.json` 的正文或行为。

### Stage 3 允许修改（生产代码、登记与定向测试）

```text
Reader-for-HarmonyOS/entry/src/main/ets/features/source/SourceManagementPage.ets
Reader-for-HarmonyOS/tools/test-source-management-contract.mjs（新增）
Reader-for-HarmonyOS/tools/page-structure/register.json
Reader-for-HarmonyOS/tools/page-structure/exceptions.json
```

条件性修改：

```text
Reader-for-HarmonyOS/tools/test-source-management-typography.mjs
Reader-for-HarmonyOS/tools/test-source-index-presentation-consumers.mjs
Reader-for-HarmonyOS/tools/test-switch-enum-shared-contract.mjs
Reader-for-HarmonyOS/tools/check-message-entrypoints.mjs
Reader-for-HarmonyOS/tools/message-entrypoints.json
Reader-for-HarmonyOS/tools/contracts/control-registry.json
Reader-for-HarmonyOS/tools/contracts/platform-host-registry.json
```

只有实际行为变化、测试引用失效或 `check-contract-refs` 暴露登记遗漏时才改；否则不动。`message-entrypoints.json` 只在书源页已登记消息表面的实际行为变化时更新对应入口，不新增 family、不新增宿主、不改消息框架规范。`control-registry.json` / `platform-host-registry.json` 只允许修正书源页实际引用的项，不允许借机扩成全量登记，也不允许修改上游行为。

Stage 3本机原生demo允许新增的私有产物范围：`.reader-artifacts/page-structure-stage3-20261102/` 下的有限fixture生成器、ETS适配loader、Previewer采样器、证据冻结器及各次独立输入/字节码/原始帧/日志/manifest。不修改旧artifact，不导入生产工程，不新增HAP/设备入口；具体调用和失败记录见14.7–14.8。

### Stage 4 才考虑

```text
Reader-for-HarmonyOS/entry/src/main/ets/features/common/ReaderControlSpecs.ets
Reader-for-HarmonyOS/entry/src/main/ets/features/common/ReaderButton.ets
Reader-for-HarmonyOS/entry/src/main/ets/features/common/ReaderLabeledIconActionSpecs.ets
Reader-for-HarmonyOS/entry/src/main/ets/features/common/ReaderLabeledIconAction.ets
Reader-for-HarmonyOS/entry/src/main/ets/features/common/StatusBadge.ets
Reader-for-HarmonyOS/entry/src/main/ets/features/source/SourceManagementPage.ets
Reader-for-HarmonyOS/entry/src/main/ets/features/source/SourceManagementLayout.ts（新增，单页预算）
Reader-for-HarmonyOS/tools/test-source-management-layout.mjs（新增，实际SDK控件/页面预算探针）
Reader-for-HarmonyOS/tools/page-structure/schema/register.schema.json
Reader-for-HarmonyOS/tools/page-structure/check-register.mjs
Reader-for-HarmonyOS/tools/page-structure/test-page-structure-model.mjs
Reader-for-HarmonyOS/tools/page-structure/source-layout-evidence.json（新增，输入绑定证据）
Reader-for-HarmonyOS/tools/page-structure/register.json
Reader-for-HarmonyOS/tools/contracts/control-registry.json
```

Stage 4仅在实际选中方法/组件引用失效时调整现有书源定向测试、Index消费者probe与typography probe；不扩展其执行集合。新增私有预览输入/原始帧/日志使用`.reader-artifacts/page-structure-stage4-20261102/`，复用Stage 3适配代码但不修改其冻结输入和证据。

### 明确不碰

- `ReaderThemeRegistry.ts`
- 消息框架规范与组件；仅允许更新书源页已登记入口的描述，不新增 family/宿主
- `Index.ets`（FIX-10 选择移除 prop 后不需要改 Index；路由/返回/保留也不在本轮修改）
- 其他页面（Stage 5 前）
- 版本文件、签名/构建配置

## 10. 回滚

| 变更 | 回滚 |
|---|---|
| 书源页 | 恢复基线哈希 `d50af10b...`，回退新增测试；无数据变更 |
| 共享组件 | 组件与所有消费者一起回退；保留登记 diff 作为记录 |
| 框架文件 | 回退本轮新增的 model/schema/工具/夹具；登记和例外保留历史记录 |
| 契约索引 | 回退新增的 `tools/contracts/*`；页面登记中的对应引用一并回退；上游文档和源码不动 |
| 消息入口 | 恢复对应 entry 的 `effectiveHost` / `retireRule`；不删除入口，保留 diff |
| 文档/登记 | 保留；revision 标记回退，不删除历史 |
| 例外 | 保留到期记录；不静默删除 |

回滚前先记录当前文件哈希和改动清单；不做 `git reset --hard` 等破坏性操作。

## 11. 风险

| 风险 | 处理 |
|---|---|
| 删除页头/搜索行入口降低可发现性 | 页脚常驻；demo 检查三条路径 |
| 筛选空态与原始空态顺序冲突 | 先判原始空，再判筛选空；测试两种路径 |
| “未检测”含 checking 改变筛选结果 | 登记写清语义；需要“检测中”时新增独立筛选 |
| 统计改为筛选内启用数 | 测试空结果、部分筛选、全量三种情况 |
| 登录/检测行 checkState 与开关操作事实成熟度不同 | 原 owner 行投影如实登记为 partial；不从页面级状态伪造统一操作绑定 |
| a11y 包裹改变布局 | 用零间距容器；demo 对比徽标位置 |
| 移除 groups prop 丢失 catalog 分组 | 当前本来未传；未来用显式 `catalogGroups` |
| 页面结构覆盖消息分类/生命周期 | 消息框架为上游；登记只引用入口 ID；冲突时以 `FRAMEWORK.md` 为准，结构 validator 不判定消息类别 |
| 筛选空态新增 page-state 被当成新消息出口 | 复用 `sourceList::shared.page-state`；不新增 family；仅在描述变化时更新入口 |
| 共享 spec 改动影响其他页面 | Stage 4 单独影响分析，不与 Stage 3 混合 |
| 路由登记变成第二套返回逻辑 | registry 只索引路由 ID、父级、策略和 owner；不写实现；冲突时以 `navigation-comparison.md` 和源码 owner 为准；NAV-07/08 保持 `unresolved` |
| Stage 3 未修 NAV-07/08，层 1 的 S8 无法 PASS | 明确记 `FAIL`（原因 `unresolved`）；不在书源页内伪造保留行为；路由修复另立阶段并需 Index 授权 |
| 平台登录 Back 顺序未实测 | `backPolicy: unknown`；不宣称平台先行或应用先行；需要时单独做平台证据 |
| 控件登记膨胀成全量控件表 | 只登记书源页实际控件；其余页面 Stage 5 按批扩展；无消费者的控件不建 |
| 操作引用复制 owner 状态机 | `operationRefs` 只引用 `operationId`、owner、事实源和投影；页面不复制 Host/Orchestrator 状态机 |
| 无障碍静态断言冒充 L3 | 读屏、焦点、2.0× 未执行时记 `NOT_RUN`；结构测试只证明标签和引用存在 |
| 契约地图随源码漂移 | 每次 Stage 2/3 门禁跑 `check-contract-refs`；owner/source 变化必须更新 registry revision；不能以“文档存在”代替解析 |

## 12. 需确认的决策

| ID | 决策 | 推荐 | 备选 |
|---|---|---|---|
| D1（已确认） | 书源页重复入口如何收敛 | 用户裁决：暂不修改这些入口；FIX-01 本轮 DEFERRED / NOT_RUN | 后续冻结主次/上下文再评审；本轮不自动建立有效例外 |
| D2（已确认） | `groups` prop | 用户裁决：移除未使用 prop，分组只来自 sources；执行 FIX-10 | catalog 空分组能力另立明确 owner 后再评审 |
| D3 | 下载页结构 | 用户已选常态列表，按14.15实现；管理态底部操作按预算固定 | 原始hybrid两种模式仅作历史基线，未沿用为当前裁决 |
| D4 | Source → Tools → Back 的筛选保留 | Stage 3 只登记 NAV-07/08 为 `unresolved`，不改 Index/页面行为；路由修复另立阶段 | 本轮把 Source 查询/筛选状态上提到 Index/Runtime，返回时恢复；需要 Index 授权和额外测试 |
| D5 | 平台登录 Back 顺序 | 登记 `backPolicy: unknown`；有授权时做一次平台证据 | 假定平台先消费 Back 并写入契约；没有平台证据不采用 |
| D6 | 控件登记范围 | 只登记书源页实际控件，Stage 5 按页扩展 | 本轮建全量控件表；范围过大，容易变成第二套组件规范 |

D1 已定本轮保留，不阻其他项；D2 已定移除，FIX-10 可执行。D3 已选常态列表，执行见14.15；D4 未确认不改 Index；D5 保持 unknown（“无证据假定平台先行”不属于可采用备选）；D6 按已授权最小集推进。

## 13. 执行边界

- §0–13是实施方案；§14是本轮执行记录。计划与实际结果分别保留。
- Stage 0–2 只涉及基线盘点、登记、文档和工具，不动生产代码；Stage 1–2 产物是长期治理资产，不随书源页回滚删除。
- 用户“先修改方案，然后开始执行”首先授权框架及书源试点，Stage 3生产范围限`SourceManagementPage.ets`。后续共享能力与下载常态列表另按14.9–14.13、14.15获授权范围和白名单执行，不能将本条首轮范围误读为当前只改书源页。D1保留入口，D2已移除prop，D3已落地；未授权的设备/UI动作不因源码实现自动开放。
- 消息框架不在本轮重定义；`message-entrypoints.json` 只在书源页消息表面实际变化时同步，消息入口检查单独执行、单独记账。
- 契约地图是索引，不是上游事实源；同一事实以原 owner 为准，冲突时先修 registry 或标 `UNRESOLVED`，不在页面内新建第二套登记。
- 平台宿主不是路由；不把 `loginWeb` 画进返回栈、不画平台外框、不猜 Back 顺序。平台成功不等于业务成功。
- 路由登记不授权修改 `Index.ets`；NAV-07/08 保持 `unresolved`，层 1 不得记 `PASS`。
- 无障碍只登记页面事实；没有读屏/焦点/2.0× 证据时记 `NOT_RUN`，不用静态断言冒充 L3。
- 构建、签名、安装、设备对比、读屏检查分别授权；没有授权时对应门禁记 `NOT_RUN`。
- 版本保持 `0.2.0` / `versionCode 1000000`；不修改大/中版本。
- 不手改主题注册表；不新增未登记的消息出口、控件 spec 或平台宿主；不写发布说明。

## 14. 本轮执行记录

2026-11-02 用户授权“先修改方案，然后开始执行”。D1 已选择保留当前入口，FIX-01 延后；D2 已确认删除未使用的 `groups` prop。D6 按书源页实际最小控件集执行。

### 14.1 本轮必要验证（执行前范围）

| 入口 | 嵌套调用与触发范围 | 具体风险与不可省略依据 |
|---|---|---|
| `node tools/page-structure/validate-model.mjs` | 读取本轮7组JSON/schema，复用SDK内Ajv 8.17.1；不派发其他套件 | 本轮首次实现正式schema，必须确认必填项、枚举、严格schema和模型版本有效 |
| `node tools/page-structure/test-page-structure-model.mjs` | 仅调用本轮纯推导、schema、登记和引用函数及本地正反夹具；声明解析复用现有SDK AST | 验证原型/页头分支、16层必填、G-01–16反例、真实断链和确定性，防止框架只查格式或错误洗绿 |
| `node tools/page-structure/check-contract-refs.mjs` | 只读解析登记与所引用源码声明/消息ID；无子进程、网络或设备 | 首轮跨契约引用必须确认闭合；manual上游的行为仍不由该结果证明 |
| `node tools/page-structure/check-register.mjs` | 本轮页面typed facts、源码哈希及已声明的少量静态绑定 | 必须确认能识别真实未修缺口；预期页面仍FAIL，不能把它转成PASS |

以上入口均显式调用，不接入构建、签名、CI或历史全量门禁。Ajv来源是现有DevEco SDK `ets/build-tools/ets-loader/node_modules/ajv`，固定8.17.1、MIT；版本漂移时失败并要求复审，不另写JSON Schema校验算法。

### 14.2 初次工具验证问题

- `check-contract-refs` 初次运行 FAIL：工作区权威 `../VERSION_POLICY.md` 与 `../GATE_INDEX.md` 被仅允许Host仓内路径的保护拒绝。代码定位为读取边界过窄；只增加这两个准确只读上游路径，不放开任意父目录或私有签名目录。原失败保留，修正后仅复验受影响引用与框架测试。
- 修复前 `check-register` 如预期发现 G-07、S8、B4、E1、E2；D1 两动作记 B1/NOT_RUN；原生返回/焦点等 manual 项仍 NOT_RUN。该结果说明真实页面缺口被保留，不代表页面通过。

### 14.3 消息入口的最小补充范围（执行前）

FIX-02 修改了 `sourceList::shared.page-state` 的业务场景，须更新其现有 `effectiveHost` / `retireRule`，不新增 ID 或 family。现有消息入口工具只支持全树扫描；为遵守只验本次入口的要求，条件性白名单增加 `tools/check-message-entrypoints.mjs` 的显式 `--file <准确仓内文件>` 选择参数，保持无参/原有模式行为。只增加文件选择，不改分类、准入或消息框架规范。

新增实际入口为 `node tools/check-message-entrypoints.mjs --check --file entry/src/main/ets/features/source/SourceManagementPage.ets`：仅解析此文件的SDK AST，比较该文件4个现有入口和对应专用登记；无其他套件、构建、网络或设备调用。测试该选择不接受越界/空范围，并以删入口登记的负对照确认不会跳过检查。原全树 `--check` 不在本轮运行。

### 14.4 首批实际结果与证据边界（后续纠正见14.5–14.6）

| 交付/检查 | 实际结果 | 证据范围 |
|---|---|---|
| Stage 1 模型/登记 | 已落地并完成字段/来源审读 | 21个框架文件：7组schema/JSON、纯推导、检查器、夹具；13路由、13控件、1平台宿主、书源16层 |
| Stage 2 框架定向测试 | **PASS，41 case** | 六原型与页头已知输出、确定性、16层与必填事实、N/A、G-01–16正反例、断链、路由冲突、消费revision、不可例外/过期、缺证据假PASS、选定消息入口；不证明设备行为 |
| JSON Schema与引用闭合 | **PASS** | 同一41-case批次实际调用7组Ajv schema、真实源码AST声明和消息ID引用检查；不再为单独回执重复运行同函数 |
| Stage 3 `filter-projection` | **PASS** | 真实页面方法执行trim、checking成员、清四条件与筛选内启用统计，无网络 |
| Stage 3 `list-state` | 首次FAIL，定位后复验 **PASS** | 首次SDK探针未展开惰性ListItem，随后缺ViewStackProcessor端口；复用现有SDK seam执行真实deepRender后，加载/恢复/空/筛选空优先级与reset转发通过；原失败不抹除 |
| Stage 3 `login-status` | **PASS** | 实际SDK sourceRow→徽标标签→StatusBadge属性链，登录按钮busy/blocked/unknown准入；仅属性/回调层，不能当读屏或像素验收 |
| Stage 3 `footer-geometry` | **PASS** | 真实pageGeometry与共享resolver，测量footer高度进入content end inset及List尾偏移，revision/keys保持 |
| 受影响原有测试 | **PASS / REUSED** | `node tools/test-source-management-typography.mjs --case metadata-carriers`；仅新增被sourceRow调用的真实标签方法选择，其余原行布局维持；不附带其他case |
| 消息登记选定文件检查 | **PASS** | `--check --file .../SourceManagementPage.ets`，4个已登记/观察入口一致；只更新sourceList场景描述，未新增ID/family/宿主 |
| 当前页面合规检查 | **FAIL（保留）** | S8/NAV-07、E2/44×28、E3/字体预算；D1/B1为NOT_RUN；G-07、登录busy与徽标属性缺口已补。B4整页结论后来因覆盖不足撤回，见14.5–14.6 |
| demo/设备/读屏/焦点/2.0× | **NOT_RUN** | 未生成真实渲染demo，未占用设备；Stage 3仍未达到其demo完成条款，不宣称试点整体验收完成 |
| 构建/签名/安装/用户验收 | **NOT_RUN** | 本轮未执行，不由方法/SDK测试替代 |

框架最终41-case与选定消息检查串行命令合计约7.2秒（工具wall time）；生产4 case与metadata的逐case耗时未单独采集，不补造计时。没有执行历史全量套件。复验只发生于新增规则、schema修正、测试seam修正和实际受影响case；未更改的已通过方法结果直接复用。

最终整合又补入原型的页头角色/呈现与查询位置准入字段；推导结果违背原型语法时明确失败。加入搜索Floating/详情ScrollAway的矛盾Brief负对照后，41-case批次复验PASS，约4.7秒。生产源码无变化，4个SDK/方法结果复用。

源码交付：`SourceManagementPage.ets` 904行，SHA-256 `6aa9546a5808256fb86ff2897a0346d24ec9c9402378a439f51b6e800fa324c3`；定向测试SHA-256 `c7f394ee140febaedf1b0f1fab1f4adcc728fa340771bbc31050577f274aecff`；模型SHA-256 `25fe18c13238cb5660142803d09d9a12b9a2fab7b1434c2e644d3ce5dee7dc79`。登记revision=2，消费control revision=2，其余registry revision=1。基线表保留修复前输入，不追溯重写。

Stage 3实际只修改该生产页面；此外修改两份文档、2个消息登记/选择工具、受影响typography probe，并新增框架文件和定向测试。没有改Index、共享UI组件、版本或签名配置。后续入口：先做366×844真实渲染demo，Stage 4再审触控/字体增长共享能力；NAV-07路由行为需要按D4另立范围，D1入口继续保留。

### 14.5 外部审计后的纠正与本次验证范围

用户提交审计文本后继续修复。两个既有消费者仍选择 `sourceToggleEnabled`，被本轮重命名破坏，是本轮漏查的影响面。用户审计已运行并报告两项 FAIL，保留该失败，不以重复运行旧失败代替定位。§14.4的原有通过项只覆盖其注明层；不能据此标记 Stage 3 完成，B4的整页PASS也需撤回并补分项证据。

消息登记的相对HEAD累计差异与本轮修改已核清：当前校正前SHA-256为 `391b1ad4ce47324207e06859dfc68f91a01d9fb1b55a566414e1330648eadd74`；在内存中仅将sourceList的effectiveHost/retireRule恢复为任务起始原文，按原格式序列化后精确得到起始SHA `edcf03fe5481f2699e914cc1e36cbb33f336019aa8e857714e91aa8e6684f58e`。因此55新增、4删除、2保留项新增及statusBanner保留项删除属于任务开始前的dirty WIP；不能由HEAD diff归给本任务，也不能据此确定修改人。此次只补回当前仍存在、生产未调用的statusBanner保留登记，其他前置WIP保持。

外部审计批次的全树消息检查为FAIL/19项（7未登记、7过期、3Alert旁路、1Dialog旁路、1过期专用例外），覆盖其他页面；该结果以用户提供报告为来源，并非本次新运行。未将全树结果降为PASS，也未为消除这些跨任务失败改动其他页面。精确文件PASS始终只证明选定文件的登记，不能代替全树状态。

本次执行前选定：

| 入口 | 必要性与实际嵌套范围 |
|---|---|
| `node tools/test-source-index-presentation-consumers.mjs` | 文件内有限Source→Index→SDK消费者场景共用被重命名的方法选择，均受本次probe回归影响；不派发其他套件、构建或设备 |
| `node tools/test-switch-enum-shared-contract.mjs --case source` | 仅修复Source开关消费者选择，其他case不运行 |
| `node tools/test-source-management-contract.mjs --case action-admission,list-state` | 新增toggle/detect真实SDK准入分项，补旧内容读取失败且筛选空的显示优先级；其余未变方法结果复用 |
| `node tools/page-structure/test-page-structure-model.mjs` | 只复验本次schema枚举/必填/语义来源、retained引用、FAIL跟进责任与对应反例；沿用原本地模型/SDK AST闭包 |
| 消息选定文件检查加 `--require-retained SourceManagementPage.statusBanner` | 按authority保留并检查当前文件的retainedScopes；独立预期scope引用用于发现登记整行删除，单靠过滤现有表不能证明无丢失 |

E2/E3不创建没有现行补偿证据的例外，继续FAIL；以typed `followUp` 记录owner、复审触发与退出条件。`exceptions.json`为空是有意保留失败，不等同于缺口已获豁免。S8同样记录跟进入口。通用 `not-exposed` 明确为partial操作绑定的真实缺口，不伪装成Recovery。

### 14.6 审计纠正后的阶段结果（Stage 3收尾前）

| 项目 | 结果与限制 |
|---|---|
| 两个消费者回归 | 旧方法选择改为真实 `sourceActionEnabled`，补入sourceRow实际调用的 `statusBadgeLabel`；Source→Index有限消费者11个场景PASS，switch仅`--case source` PASS。保留原工作树已有expandedLayout等修改 |
| consumer的旧recovery测试 | 当前仍直接注入retained `statusBanner`，已加注释和结果边界；该部分只证明直接调用handler，不证明当前页面挂载、用户可达或消息整合 |
| 新增动作分项与读取失败边界 | `--case action-admission,list-state` 2/2 PASS：toggle忙/blocked/unknown/refreshing拒绝，detect checking防重复；sources仍可用且读回失败、筛选无结果时显示filteredEmpty并发一次Toast，不叠全页error，不新增网络读取 |
| B4 | **NOT_RUN（整体）**：登录与开关有分项证据，detect全局blocked/unknown仍会转发，是现存未绑定缺口，不能据局部PASS升级整页B4；已列followUp责任与退出条件 |
| 框架/schema与引用 | **PASS，55 case**：新增14个schema/字段来源与保留引用负对照；严格unknown/refresh/result枚举、businessOwner、retention.basis、partial knownGap、retainedScopeRefs及followUp；7组schema与真实引用闭合在同批执行 |
| 消息selected模式 | **PASS，4个现有入口＋statusBanner保留声明**；按authority筛选保留表，不清空；显式独立expected scope可检测整行删除。已通过删除保留登记的负例 |
| 原全树消息19项失败 | **OPEN / 本次未重跑**：保留用户审计批次的19项FAIL及范围，不用本次selected PASS替代，不改其他页面的前置dirty WIP |
| E2/E3/S8 | **FAIL继续保留**；typed followUp明确owner、reviewTrigger、exitCriteria，没有伪造例外或当前补偿证据 |
| Stage 3整体 | **未完成**：demo、设备、读屏、焦点、2.0×和剩余行为未验，未构建/签名/安装/用户验收 |

最终消息检查命令为：`node tools/check-message-entrypoints.mjs --check --file entry/src/main/ets/features/source/SourceManagementPage.ets --require-retained SourceManagementPage.statusBanner`，仅选定文件，约1.0秒。switch Source case约3.8秒，新增动作/状态2-case批次约7.6秒；55框架批次首次yield约10秒后完成，不补造精确总耗时。其他不受影响的已通过生产方法/typography用例保持REUSED。

最新输入绑定：

| 文件/登记 | 当前SHA-256 / revision |
|---|---|
| `tools/message-entrypoints.json` | `5c45869e698420727cdbbd87df1351a7516a5eb0b9568a5521662a2b439ed3a7`；相对任务起点仅sourceList两字段和本次补回statusBanner保留项，未覆盖前置WIP |
| `tools/page-structure/register.json` | `5abc4b6892752afc81e53740575ea4df88fdf72650ea4b7cbfe1832ee49b9682`；revision=3，仍消费control revision=2 |
| `tools/test-source-management-contract.mjs` | `7cbb5f7b98ab59457ff331089aafc9cbcca9c633d2cc0b65c26feadc219b869a` |
| `tools/page-structure/test-page-structure-model.mjs` | `dc04eda0fb259d3afe5daf715da76b96fd8102e72bf0f82ac6c6c57a341a6279` |
| `SourceManagementPage.ets` | 仍为`6aa9546a5808256fb86ff2897a0346d24ec9c9402378a439f51b6e800fa324c3`；本次纠正没有再改生产源码 |

§9现已显式列出 `test-switch-enum-shared-contract.mjs` 和 `check-message-entrypoints.mjs` 的条件性修改；`lib.mjs` 原本已在Stage 2白名单，不属于新增遗漏。基线表中的起始消息哈希保留历史意义，当前输入以上表为准。

### 14.7 Stage 3 收尾执行计划（2026-11-02）

用户要求继续Stage 3到完成。完成仍以§3.5本阶段闭环为准；D1入口继续保留，NAV-07/08、E2/E3、全局B4等已登记延后/未决项不拉入新的跨页修复，也不升级为合规PASS。

剩余唯一强制视觉产物是366×844实际demo；第13条还缺“平台登录已发起后旧session的异步结果被拒绝”的方法证据。第14条toggle confirmed写后刷新失败只读已由前轮11消费者场景的实际Host/Orchestrator/Gateway计数覆盖，输入未变，直接REUSED；其recovery由legacy builder注入，只证明handler→owner，不当UI挂载证据。

执行前范围：

| 入口/动作 | 嵌套调用、具体风险与必要性 | 停止条件 |
|---|---|---|
| `node tools/test-source-management-contract.mjs --case login-session` | actualSourceManagementTypes真实Host/Orchestrator/Gateway与Runtime身份；仅平台Promise和Core DTO用有限内存端口。正例登录1次/检测1次，旧resolve/reject不得派发检测或污染新页。无Core CLI/网络/构建/设备 | 失败先审本次调用链，不扩大套件 |
| 本机native demo生成 | 复用现有SDK lowering→es2abc API23→本机CPU Previewer范式；在新`.reader-artifacts/page-structure-stage3-20261102/`隔离目录生成fixture，不修改旧产物。真实SourceManagementPage、共享组件/规格/主题/几何来自当前源码；仅样本数据、WindowMetrics、字体/资源加载和业务回调作为明确端口 | 缺依赖或无法保持实际组件闭包时停止该入口并记录；不能用手绘HTML/旧截图替代native结果 |
| Previewer有限采样 | 目标366×844，默认列表/筛选空/登录busy三个状态；每次独立本机进程、临时socket和输出目录，单次20秒截止，按实际子进程回收 | 不接触HDC/手机/VM/HAP；不恢复共享服务；无有效framebuffer不能记demo通过 |

本机SDK Previewer、libace与es2abc已只读确认arm64；经只读进程筛选没有活跃Previewer/es2abc/hvigor。现有历史demo/截图仅用于路由与脚本范式，不作为当前`6aa9546a…`源码证据。使用reader-cross-platform-delivery技能核对本机工具与证据边界；本次是本机隔离预览fixture编译/像素证据，不是产品HAP构建或设备交付。没有新增全量门禁。

实际预览入口细化：`node ../Reader-Core/scripts/lib/build-resource-lock.mjs -- node .reader-artifacts/page-structure-stage3-20261102/compile-native.mjs normal`（随后按已成功闭包选择filtered-empty/login-busy），统一构建租约只降低本worker优先级、设置单worker预算并执行本次命令，不派发测试。复用已安装webpack5.72.1/MIT处理模块图，薄loader只做真实SDK ETS lowering与TypeScript emit；es2abc API23单次30秒截止。每个场景字节码与源码/实际SVG/font文件指纹绑定。

初次执行错误保留：资源入口在sandbox内降低worker优先级被拒，未进入fixture编译，租约finally释放；获准外执行后进入脚本，发现生成window端口的准确仓内绝对import被依赖审查拒绝。当前从代码修正路径准入，仅允许该仓内路径，不放开未知外部模块；在新原因解决后才安排下一次编译。没有以改生产页面或删除实际组件绕过失败。

`login-session` 已实际PASS（约1.64秒）；B6只记录调用方sourceId/session方法边界，不扩大为ArkWeb内部request/surface或平台Back；B8局部toggle只读恢复记录REUSED。登记revision=4，schema复验PASS；其余55框架用例/已过生产场景输入未改，保持REUSED。

### 14.8 Stage 3完成记录

**结论：Stage 3修复与登记闭环完成。** 此结论逐项对应3.5的本阶段标准；不等于页面全层合规PASS、Stage 4共享能力完成或产品交付/用户验收。

本轮没有再改生产页面。新增并实际执行唯一业务方法case `login-session`，补齐调用方在登录Promise返回时拒绝旧sourceId/session的验证；B8仅复用当前toggle原owner只读恢复路径。默认列表、筛选空、登录busy三态均由当前完整SourceManagementPage及真实共享组件/规格/主题/几何经SDK lowering、webpack模块打包、es2abc API23和本机CPU Previewer生成原生JPEG帧；主agent和独立agent均已逐帧目视核对。没有用HTML或旧图替代。

| 3.5条款 | 完成依据与保留边界 |
|---|---|
| 1 D1入口 | 按用户明确决定保留；FIX-01 DEFERRED，B1 NOT_RUN，不因延期洗绿 |
| 2 筛选空态/清除 | 原方法/SDK证据REUSED；native空态帧可见“没有匹配的书源 / 清除筛选” |
| 3 未检测语义 | 真实matchesStatus方法包含checking的结果REUSED；忙碌帧显示“检测中” |
| 4 分组trim | 选项/过滤共用真实normalizedSourceGroup，原方法证据REUSED |
| 5 统计口径 | 原方法证据REUSED；native正常2/1、空态0/2及0启用可见 |
| 6 登录防重复 | 原登录按钮准入用例REUSED；新增login-session同session双点仅一次login/check。图片不当点击证明 |
| 7 可读状态 | 源码标签/SDK属性证据REUSED；busy帧显示等待登录/验证与检测中；读屏仍NOT_RUN |
| 8 页脚inset | pageGeometry真实方法/resolver及List偏移证据REUSED，不外推所有长列表状态 |
| 9 定向测试/demo | 已有准确case REUSED＋新login-session PASS；三态366×844 native demo已出。设备对比按标准记NOT_RUN |
| 10 登记/源码一致 | register revision=5绑定原6aa9546a源码，最新schema PASS；无新增未登记FAIL/假例外 |
| 11 改动范围 | 生产仍仅Source页；本次只增测试/登记证据和私有demo夹具，范围已在§9与14.7列出 |
| 12 路由 | S8/NAV-07仍FAIL，NAV-08仍归Tools；不改Index、不宣称已保留；符合本阶段明确允许的未决边界 |
| 13 平台身份 | login-session正例/旧resolve/旧reject均PASS；平台宿主仍loginWeb，Back仍unknown，未进行真实登录 |
| 14 操作/投影 | 引用闭合结果REUSED；login/detect保持partial及knownGap；B8只标当前toggle owner恢复方法REUSED/PASS；B4整体仍NOT_RUN |
| 15 无障碍 | 标签、焦点顺序和实际字段登记完整；读屏/焦点旅程/2.0×按标准明确NOT_RUN |
| 16 引用/版本 | 上游引用、owner和消费revision未变，既有引用检查REUSED；新demo证据只追加于query层，不提高平台/业务证据层 |

成功demo与摘要SHA-256：

| 场景 | 本机原生帧 | JPEG SHA-256 |
|---|---|---|
| 默认列表 | `.reader-artifacts/page-structure-stage3-20261102/normal-native-02/frame-000.jpg` | `b944bc5f94506353ac6e13df2a223d26daeed3251bfc2d9dc044864108e73dee` |
| 筛选无结果 | `.reader-artifacts/page-structure-stage3-20261102/filtered-empty-native-01/frame-001.jpg` | `a342ad3c1b89c3202b641263287b9c4aab6fa5ba7f71061e08fa6888453959a8` |
| 登录busy投影 | `.reader-artifacts/page-structure-stage3-20261102/login-busy-native-01/frame-000.jpg` | `69a881ba38e9bae36154b55298471fc674c175259ffad334839aebac808cb8b5` |

冻结证据：`.reader-artifacts/page-structure-stage3-20261102/evidence.json`，SHA-256 `249f470070a8da6e28293ed1bad59c91375c6482b423e979992a35c7795e6be7`。该manifest核验每次字节码/JS/fixture输入、实际SVG/字体文件未漂移，记录Node/TypeScript/webpack版本、es2abc/Previewer/libace字节指纹、三帧原始传输和JPEG指纹及全部端口。每帧由sips实际核为366×844；真实ReaderFonts/ReaderFontLoadHost的checked回执先于native Text.create。

三次编译的58个生产模块内容指纹逐项比对一致，差异仅限各场景的私有输入端口；不是只凭Source页单文件哈希声称同一组件闭包。继续阅读旧预览须先看[当前阅读说明](page-structure-stage3-preview-notice-20261102.md)，以14.9字体证据纠正为准；原`.reader-artifacts/page-structure-stage3-20261102/native-demo.md`仅保留历史汇总意义。

本机preview输入边界：样本source DTO，366×844、density=1、fontScale=1、零OS inset；业务callbacks仅记录，不发网络或打开登录；WindowCoordinator只提供有限metrics DTO；资源host将实际资源ID指向同字节SVG/rawfont文件；inactive FrameCallback基类是预览端口。actual页面、共享组件、字体owner、规格和几何逻辑未改。图片证明原生预览状态投影，不证明手机系统栏、安全区、实际触摸、真实Web宿主、字体放大或读屏。

失败保留与代码定位：

- 原路径准入、BuilderParam Map/Set类型错误、预处理先clone AST造成SDK源位置缺失，均仅发生在新私有适配器；按owning SDK代码修正后才复编，所有尝试保留在compile-attempts和ledger。
- 首次normal-native-01虽收到帧，文字缺失/乱码，未计demo通过。根因定位为私有字体端口仅异步register、未等待生产checked回执；改为真实prepareReaderFonts完成后创建页面，normal-native-02及两新态文字恢复。未用系统字体替换生产字体。
- 首次采样退出清理期间的WebSocket错误覆盖了已完成reason；采样器已区分cleanup标记并要求成功终态才exit0。原第一次结果不追改。
- 成功三次本机采样分别约6.71/6.72/5.56秒；新login-session约1.64秒。编译和人工/审批空档没有单独可靠计时，不补造。实际耗时主要在一次性预览适配和失败归因，已过业务方法未重复运行。

最终绑定：生产源码仍`6aa9546a5808256fb86ff2897a0346d24ec9c9402378a439f51b6e800fa324c3`；定向测试SHA `5997ed365fbc0afdf525e77d328f749cd98d35dc119c288aa32b8e23b404f5c5`；register revision=5/SHA `9b1a36a98ce16569d7e93cd97e80c16398086bf2d4b8f363d52192ccf026dc34`。本轮HAP构建、签名、安装、设备、系统Back、读屏/焦点/2.0×及用户验收均NOT_RUN。S8/E2/E3、B4/partial、D1及跨页消息审计19项开放状态继续保留，进入各自已登记后续阶段，不改变判定。

### 14.9 Stage 4执行计划（2026-11-02，执行前登记）

Stage 3结论保留。其原生Previewer日志含`apply legacy property failed`、`GenerateBackgroundFilter failed`；原有三帧只证明状态/布局投影，阴影、模糊与设备材质一致性仍OPEN。本轮不修改Stage 3冻结manifest，后续证据单独追加该限制。消息全树19项失败继续OPEN，不运行或修复跨页消息集合。

代码侧定位：source专用检测/登录spec未设置response region，视觉框44×28；status/category本体会增长而父行仍32/40，页脚Manage增长而Add固定44且父行48；源行76固定且登录操作挤占文字列。既有`readerScaledControlHeight`可复用，不新增通用文字测量算法。所有source-management命名spec的实际生产消费者仅SourceManagementPage；新建通用row没有第二页需求，因此预算置于source feature。

执行顺序：先改既有命名spec与共享modifier的显式字体宽度策略，再接入书源页的行形态、横向筛选和页脚高度预算；不改业务筛选模型、入口、路由、消息或字体角色。文字列声明120vp×fontScale最低预算，空间不足时操作移到第二行；控件不靠压缩或限制系统字体来容纳。1.0/1.3/1.6/2.0四点和320/366宽度必须有方法/SDK预算数据；原生字形是否确实放大另由Previewer配置与测量确认，不以仅改变metrics DTO冒充系统字号。

本轮必要验证入口与嵌套范围：

| 入口 | 精确范围与必要性 |
|---|---|
| `node tools/test-source-management-layout.mjs --case matrix --write-evidence` | 新预算resolver、实际SDK ReaderButton/LabeledIconAction modifier、书源行/筛选/footer；两宽四字号；生成输入指纹证据。无业务网络、HAP或其他门禁 |
| `node tools/test-source-management-contract.mjs --case login-status,action-admission,footer-geometry` | 行拆分后SDK选择成员、触控布局与原有登录/检测准入、动态footer fallback受影响；其他业务case输入未变REUSED |
| `node tools/test-source-index-presentation-consumers.mjs` | 仅既有11个有限Source→Index消费者场景，确认行builder提取变化未丢操作；不运行Index全量 |
| `node tools/test-switch-enum-shared-contract.mjs --case source` | sourceRow重排会改变选中的builder闭包；仅该case |
| `node tools/test-source-management-typography.mjs --case metadata-carriers` | 行文字builder提取后保留同一字号角色，防止只改测试断言 |
| `node tools/page-structure/validate-model.mjs`、`check-contract-refs.mjs`、`check-register.mjs` | 新预算证据/登记revision必须与实际源码和共享依赖一致；页面未修项继续FAIL/NOT_RUN |
| 框架新增预算正反case | 检查伪PASS、证据漂移与缺字号必须拒绝；仅选择新增/受影响case，不附带全量 |
| `node tools/page-structure/test-layout-evidence.mjs --case layout-evidence` | 只执行新预算报告正反夹具；不嵌套55个旧框架case |
| 本机CPU Previewer四字号测量 | 复用Stage 3闭包/真实字体加载；每次有界20秒，原始输入、帧、日志和失败独立保留；只回答原生字体与容器预算，不操作设备 |

共享modifier只对明确选中的spec启用新策略，默认分支保持原行为；测试需包含至少一个未选择spec的对照。E2/E3在实际证据完成前继续FAIL，不因声明boolean或截图存在就洗绿。B4、S8、D1、平台Back、读屏/焦点、设备和用户验收保持原边界。

条件性probe白名单追加`tools/lib/reader-labeled-icon-action-probe.mjs`（原probe遗漏未激活的高度增长依赖，SourceAdd启用该分支后必须注入真实依赖）及`tools/lib/source-layout-control-probe.mjs`（新控件SDK数据采集），框架预算解析器`layout-evidence.mjs`、其schema与独立test。文字列120×scale为业务最小可读宽策略；最窄大字号无法同时容纳图标时使用stacked-leading，保留图标、完整文字列和同一动作组。原生文本度量用于校准，不把120当测得字宽。

首批执行：既有login-status/action-admission/footer-geometry三case实际PASS。新矩阵初次在选择器入口失败，未执行测试；原因是新`--write-evidence`未在调用共享case selector前剥离，已在新脚本局部处理（不放宽共享selector、不扩默认执行）。保留此失败，再重跑唯一matrix。

第二批：11消费者、source开关、metadata-carriers均实际PASS。新matrix继续发现1.6×状态条总宽浮点求和与父宽公式存在微小差异，严格不等式失败；父容器改为向上取整，保留控件真实分数宽，不放宽断言或缩字。补充失败信息含region/width/scale与所需/可用尺寸后，仅重跑matrix。

原生证据追加纠正：scale1.6能力探针真实调用平台setter但9次`fp2px(1)/vp2px(1)`均为1，判UNSUPPORTED，未保存伪放大图。首次真实Text节点测量虽有156条数据，日志出现`loadFontWithCheck mocked implementation`且没有原生LoadFontFromList/Load Success；故本批仅作fallback节点数据，不认实际Reader字体。回查Stage 3：normal-native-01（已判失败）有原生字体异步Load Success但晚于部分Text创建；成功normal-native-02及另两态checked-owner路径只有mock回执，实际Reader字体未证。更正14.8中“checked回执先于Text即证明实际字体”的推断：它只证明调用次序；三态内容仍保留，不能用于字体/字形预算验收。旧manifest不覆写，后续实际register+原生日志证据另立新批次。

预算证据负例第一次通过后，register新增真实layoutEvidence引用；再次验证新scope负例时，“无报告”夹具仍从当前register克隆，已不再无报告，导致该断言FAIL。定位在夹具构造，现显式删除该字段再测缺证据，不改validator或降低预期。框架其他55case未选/未重复执行。

独立源码复核补正：无summary、1×的stacked-actions第一排包含40vp图标，旧预算只计35.84vp文字栈，少约4vp；父为minHeight本可撑开，未构成已观察裁切，但预算不精确。现按max(40,文字栈)计算，并加“40vp图标+动作行+24vp留白”的独立最低不等式。复核未发现递归、动作丢失/重复或本轮ArkTS阻断。因helper/回归断言变化只重跑matrix和其指纹绑定。

### 14.10 Stage 4本批结果

**代码与本地验证完成，Stage 4原生验收未闭环。** 没有把“预算有实现”“节点有数值”或局部SDK通过升级为页面E2/E3通过。

落地的共享规格与页面接入：

- 既有ReaderButton新增显式`scaleWidth`轴，仅source状态/检测/登录变体启用。分类、状态、检测、登录由44vp基高按真实字体角色行高增长；检测/登录44×scale宽，状态58/72×scale宽，不再用窄屏压缩承载字体增长。
- SourceAdd复用LabeledIconAction既有高度增长能力，并显式放开当前系统字号上限；页脚父高取48与两按钮动态高度的最大值，fallback也同步且不再经contentFrame递归。
- SourceManagementLayout留在source feature；声明文字最小列并选择inline / stacked-actions / stacked-leading。控件保留同一动作与owner，行采用minHeight允许真实文本撑开。筛选位置仍随内容，状态与分类的横向Scroll父高同步增长，分组选择宽度扣除放大后的标签预算。
- 不新增通用row，不改字体角色、路由、业务筛选模型或消息。D1入口全部保留。共享规格的静态生产消费者只定位到书源页；未启用新轴的spec保留原分支并有对照。

| 实际验证 | 结果与范围 |
|---|---|
| 新matrix | PASS；320/366×1/1.3/1.6/2，32个行组合、40个目标样本、24个区域预算；实际SDK控件/父builder、行动作唯一性、40vp图标最低预算和footer非递归均覆盖 |
| 原书源定向 | login-status、action-admission、footer-geometry 3/3 PASS；检测全局准入缺口仍如实characterize，不升级B4 |
| 消费者 | Source→Index原11个有限场景PASS；retained statusBanner恢复注入仍只证明handler，非当前挂载 |
| 共享开关/字体角色 | source case、metadata-carriers PASS；未执行其他cases |
| 预算证据检查负例 | `test-layout-evidence --case layout-evidence` PASS；拒绝报告/生产输入漂移、缺宽度/字号矩阵、局部目标冒充整页、SDK标native、缺原生manifest及来源/样本错配 |
| 框架 | validate-model、check-contract-refs PASS；既有55个框架case未重复执行，未选择的全量仍NOT_RUN |
| check-register最终 | FAIL保留S8、E2、E3；B1与B4仍NOT_RUN。没有新增来源漂移/预算报告错误；原始输出在Stage4私有目录`check-register-final.json` |

框架同时补上optional `layoutEvidence`引用与严格报告schema：绑定真实生产与probe输入指纹、producer/case、宽度/字号完整矩阵。E2局部目标可声明`targets.controlRefs`，不足以关闭全页；E3 PASS必须另有冻结nativeEvidence且核对生产输入与样本。哈希只证明关联，不证明采集真实发生，provider仍须审核。

本机原生实验与停止原因：

1. 系统scale1.6 setter调用后9次fp/vp比值仍1，判UNSUPPORTED，未捕伪字号矩阵。
2. 首次156节点测量只有mock字体回执，作fallback级数据保留；第二次经真实register并核8个Load Success先于measurement，完成156条Text节点测量。该路径复用生产ReaderNativeTextMeasurement，显式px字号端口不是实际系统字体缩放。
3. 366首次页面尝试因异步加载晚于FA根准入而deadline，未产帧；私有FontGate修正只影响fixture。第二次正式366帧确认真实字体先加载，能观察到拆行/44高/页脚结构，但NotoSansSC-VF、InterVariable字形空白/乱码，故页面帧FAIL。
4. 唯一最小font-paint对照在同一文本/字号/400与700字重下复现：两个variable家族异常，已有static UI/Serif及平台default正常。由此将问题限定于本机Previewer的可变字体绘制路径，未声称设备正常，也未改生产字体。主agent已独立看图；停止同原因320页面采样，320原生页为NOT_RUN。

由于可变字体paint失败，第二批节点测量的“加载已确认/数据已返回”不等于正确字形验收，不能用其33/66等尺寸关闭E3。Previewer的legacy property/background-filter材质警告继续OPEN；19项全树消息失败也继续OPEN，本批未重跑或修改全树消息集合。

本批登记为register revision6、control registry revision3。源码SHA `818a4584ad447329855c3fa6441bb0a808e135291fc6b8db695772b1f5d04a8f`；预算resolver SHA `d4431e6856fbfe216e2b2b4a7937eec35d148da229f8e463f7ee7e84da8cf3bb`；SDK预算报告SHA `0fbaa21bdc58da812e4db4e7ead5ac711d57a9ec41ecdf1c2bbd88b038753272`。报告包含本次实际共享规格、字体角色、resolver与SDK probe输入指纹。

冻结原生记录为[Stage 4证据说明](../../.reader-artifacts/page-structure-stage4-20261102/README.md)与同目录`native-evidence.json`。主agent独立核对manifest SHA `a9dbf4059055a2dcc8813e6f4edf2f365620a90f6a02e447507513e8ac56b156`、README SHA `6ae4dd0e4bef526617656df570ca3c92e57f0b9b173d1f5d25900322e68ac514`，并目视366失败帧与最小字体对照。清单冻结167个文件及65个源输入快照；保留每次JS/ABC/日志/帧、实际SDK与资源字节。`normal-366-native-02/result.json`旧firstUseIndex=-1诊断锚未追改，manifest单独按原始PAGE_READY时间线记录8字体先加载的派生观察。

剩余出口：E2补齐其余交互控件的目标覆盖与原生命中；E3在可证明实际系统字号与正确生产字形的宿主完成四字号整页校准。当前Previewer不能回答这两项，不用替换字体、仅改metrics或重复同故障制造通过。NAV-07/08、B4、D1与其余未审计层不并入Stage 4的局部PASS。HAP构建、签名、安装、HDC/设备、读屏/焦点与用户验收均NOT_RUN。

### 14.11 共享影响面复核与probe修复（执行前登记）

外部审计指出外观`retained-lifecycle`初始化FAIL（`ReaderTransientFeedback is not defined`）、1.6字号上限与共享消费者记录不足。先定位来源，不将累计HEAD dirty diff等同于本批修改；不借测试失败扩为全量门禁。

冻结输入核对结果：

- `ReaderSelectPanel.ets`在Stage 3 compile输入、Stage 4源快照、当前工作区均SHA `ac16f22be60d28ac6c69eb91f4a523e58cb41ad795fddd6cc51c4c907ce8bce1`，没有本批修改。Stage 4快照路径为`.reader-artifacts/page-structure-stage4-20261102/input-snapshots/entry/src/main/ets/features/common/ReaderSelectPanel.ets`。
- `SOURCE_FILTER_OPTION`完整19行与`FILTER_ACTION`完整5行在Stage 3/4冻结JS中相同，定义段SHA分别`bfbe632651559c02cd7e0ab54e101b0eb8a4da30b3e12633719c7d1be0f60591` / `68426d89bcf2fb29368b9910d52ceb3380f52d0649d3d6de22493d650e5876b4`。Stage 3 normal批次`fixture/pages/SourcePage.js`已有1.6上限。
- 整个Specs/Button编译模块仅消除webpack模块编号后对比：本批差异为source-management专用规格、可选scaleWidth复制/分支及source-management字体分支；source-filter-option先走既有maxFontScale分支且fixedWidth=0，filter-action仍走原有分支，不进入新增策略。上述旧共享差异不属于本批，不归因给Stage 4。

共享影响登记按实际分支补全：

| 组件/规格 | 消费者 | 本批作用与证据边界 |
|---|---|---|
| source-management命名规格 | SourceManagementPage | 发生本批行为变化，已有32组合/40目标/24预算及11消费者证据 |
| source-filter-option | ReaderSearchFilterPanel、保留ReaderSourceFilterPanel、SourceGroupManagementPage | 原规格/分支未变；补选specs回归以验证ReaderButton旧分支。不能称三页已完成2×验收 |
| filter-action / ReaderFilterFooter | 搜索筛选、保留书源筛选及搜索“前往书源管理” | 原分支未变；specs覆盖实际modifier1/1.6/2高度和命中区；外部controls/search-draft/source-panel及compact-sheet通过结果按其原边界REUSED |
| ReaderSelectPanel | 当前阅读外观appearanceLibrary、ReaderInlineSelect | 文件未变；补修外观probe并选实际Panel/InlineSelect消费者。生命周期测试的NativeChild替身不充当Panel实现通过 |

`SHARED-FONT-CAP-01`（当时OPEN，不是EXCEPTION；当前为代码已修复 / SDK通过 / 原生仍OPEN，见14.12）：owner `harmony-ui`；本节历史基线为source-filter-option maxFontScale=1.6及搜索Math.min(1.6)，旧测试明确断言但无用户认可设计理由。14.12已同步修复spec、ReaderButton动态scale分支、搜索父预算和三类消费者SDK检查；长标签真实换行、2×系统字号/生产字形仍需合格原生宿主。E3继续FAIL，不将历史未修状态误作当前代码状态。

新增必要入口（不附带其他case、CLI/Core、构建或设备操作）：

| 入口 | 必要性与嵌套边界 |
|---|---|
| `node tools/test-reader-filter-controls.mjs --case specs` | 实际ReaderButton旧分支及filter-action增长/禁用/命中区；记录1.6旧策略而非合规通过 |
| `node tools/test-reader-appearance-lifecycle.mjs --case retained-lifecycle` | 修复完整外观组件缺实际消息/动作可访问依赖，验证原生命周期目的；子渲染仍为既有NativeChild边界 |
| `node tools/test-reader-chinese-conversion-sdk-actors.mjs --case library-identity` | 实际appearanceLibrary→ReaderSelectPanel→ChoiceRow的身份、关闭、退出与陈旧回调；不执行durable-recovery或legacy full |
| `node tools/test-source-tools-typography-sdk.mjs --case input-selection` | 实际InlineSelect→trigger→Panel→ChoiceRow；只验证当前/旧identity、disabled/retired准入与输入，不执行工具其他场景 |

条件性白名单仅增上述前两个外观test文件与`tools/lib/reader-choice-row-probe.mjs`。代码定位发现：外观完整组件新增ReaderTransientFeedback和动作可访问依赖，probe未注入；choice-row共享probe成员清单落后于实际字段/Builder，并缺WordBreak等当前SDK依赖。修复必须使用真实生产类/modifier与完整成员，只有AppStorage、字体、测量/动画等平台服务保持有限端口，不以noop替代业务owner。旧失败保留，修后只跑上列四入口。

Stage 3旧manifest继续冻结。旧预览的继续引用须先展示“以14.9字体证据纠正为准”的阅读提示；采用新增说明页/索引承接旧预览，不覆写manifest、JPEG、JS/ABC或原始日志。E2仍只是五引用的局部SDK PASS，页面E2/E3与19项全树消息失败判定不变。

补测第一批：`specs`与`library-identity`实际PASS，后者为5个实际parent→appearanceLibrary→Panel→ChoiceRow身份旅程。`retained-lifecycle`已越过缺依赖初始化，但在custom分支96vp offset断言实际0而FAIL；先核当前分支前提，不改预期凑绿。`input-selection`在PageBackBar的实际ReaderRaisedSurface SDK组件依赖登记缺失而FAIL；该测试此前只注入旧Header依赖。本批条件性白名单追加`tools/test-source-tools-typography-sdk.mjs`，补当前真实RaisedSurface及其平台Canvas端口，不删节点/放宽SDK diagnostics。修后只重跑这两个失败case，已通过两case不重复。

补测第二批：外观fixture原Quick预算190使当前默认目录也进入extended路径，原“按custom决定分支”的前提失效。改为真实几何函数得到默认目录264vp，显式验证默认canonical/custom extended两个分支和Quick/Full端点，native offset仍要求96，四组合实际PASS。InlineSelect已通过真实Header lowering，随后因测量端口只有measureText而缺当前ReaderSelect使用的measureTextSize而FAIL；新增明确px单位的固定有限回执，不计算/伪造通用文字测量，测试仍只证明输入/identity准入，非字形/触控几何。仅重跑input-selection。

最终补证结果：

外观四组合的输入同时明确`quickContentHeight=264`与Quick/Full的`availableHeight=264/666`，并在发出native offset前先断言实际滚动分支；不是只改预期输出。两个输入前提共同修正，未做逐项A/B归因，也未据此推断生产滚动缺陷。

| 精确case | 结果 | 实际证明范围 |
|---|---|---|
| filter-controls / specs | PASS | filter-action实际modifier在1/1.6/2的高度、禁用与responseRegion；source-filter-option仍保留旧1.6策略，不作E3通过 |
| appearance / retained-lifecycle | PASS，4组合 | 当前153个完整生产成员、canonical/extended两路径×Quick/Full端点、未知offset不写入、有效offset96、销毁后拒绝；Select/Panel子渲染仍为NativeChild |
| chinese-conversion / library-identity | PASS，5旅程 | 实际parent→appearanceLibrary→ReaderSelectPanel→ChoiceRow的当前/旧identity、关闭与退出准入；非原生布局/移除验收 |
| source-tools / input-selection | PASS | 实际InlineSelect→ReaderSelect→Panel→ChoiceRow选择回调、旧identity、disabled/retired准入；有限平台测量/Canvas回执不作字形或像素证明 |

因此本批实际source-management共享差异的影响补证已完成；旧共享代码的全量正确性、1.6策略裁决和所有页面2×验收没有被合并为PASS。外部审计已通过的controls/search-draft/source-panel、compact-sheet按原输入未变和原证明范围REUSED，本批没有重复派发。Source原32/40/24、11消费者、3原用例与框架检查也未因无关probe补修而重跑。

本次只修改四个test/probe与文档/阅读索引，没有再改任何生产源码。补修后的SHA：

| 文件 | SHA-256 |
|---|---|
| test-reader-appearance-lifecycle.mjs | `f732b5a3d9f91f7fd0fefd9362f70c3c8080e42462521f0e232c6d7f8b07d78a` |
| test-reader-chinese-conversion-sdk-actors.mjs | `d2e626e226fe8238d641883959577297c0c2c0b63c98c7434effc5ac36606ac3` |
| test-source-tools-typography-sdk.mjs | `3b7a08281380637d839d49c16f87f5926d1c5e5d5d0cd41787b1cc77d6a9751c` |
| lib/reader-choice-row-probe.mjs | `1d9954fffe4d7152a2a8264e388344cb682c85b3b4142e25120001d9bf52fef7` |

旧native-demo.md未被列入Stage 3冻结manifest输入/输出，本次仅在顶部补充可见阅读更正，使此前旧链接也会先显示“以14.9为准”。该索引SHA由`0d1b3ccf4d60c7168ce1f7f63360319f46a0b1e9a1d126711f4ce696c8a42053`变为`c17ce0bae79283f9a0f3b108753efbcc97b983c0d9b9851bfdee736c00b0564c`，原历史段落保留；另有[当前说明](page-structure-stage3-preview-notice-20261102.md)。冻结Stage 3/4 manifest仍分别为`249f4700…` / `a9dbf405…`，原帧、JS/ABC和日志不变。

收尾只核当前输入指纹：SDK预算报告17个输入全部仍匹配，页面登记revision6/control revision3不变；E2/E3继续FAIL，B1/B4与原生/设备/用户验收边界不变。19项消息失败保持外部审计OPEN，本批未再执行全树消息检查、HAP、签名、安装或设备操作。

### 14.12 共享字体上限修复（2026-11-03，执行前登记）

用户要求继续推进。本批处理`SHARED-FONT-CAP-01`的生产缺口：取消source-filter-option与搜索filterFontScale的1.6硬上限，接入当前系统字号，并同步父容器/fallback预算。沿用既有ReaderButton多行Text、ReaderFilterFooter及readerSheetBodyBudget，不自研文字测量/换行。保持draft/Apply策略、选择语义、消息、入口和路由；D1仍保留。不进行HAP、签名、设备或同原因Previewer重试。

执行前输入SHA：ReaderControlSpecs `44984c00…`、ReaderButton `cc5f2edc…`、ReaderSearchFilterPanel `6ca32689…`、ReaderSourceFilterPanel `3bf7611f…`、SourceGroupManagementPage `ceac187d…`、test-reader-filter-controls `244f32de…`。这些是接续14.11的当前工作区，不将累计HEAD差异重置为本轮成果。

白名单：生产先限`ReaderControlSpecs.ets`、`ReaderButton.ets`、`ReaderSearchFilterPanel.ets`；SourceFilter/Group目标行先审，只有实际父预算不能容纳时才最小修改，不能借机改业务。测试限`tools/test-reader-filter-controls.mjs`新case/旧spec预期；预算输入变更后重生成`tools/page-structure/source-layout-evidence.json`并更新register引用/revision。两份设计/实施文档同步结果；其他dirty WIP、旧冻结artifact不动。

先移除spec上限，再让ReaderButton该ID显式采用当前scale；仅删spec会落回平台默认分支。搜索父预算须对齐实际minHeight公式、固定边距与文字行盒，而非用旧1.6计算。长分组/“其他书源”允许自然多行，父级不得固定高裁切。先核320/366×1/1.3/1.6/2的实际SDK装配与预算，再决定是否需要额外形态；不以缩字、缩目标或假文字测量制造通过。

本批精确验证计划：

| 入口 | 触发范围与必要性 |
|---|---|
| `node tools/test-reader-filter-controls.mjs --case specs,filter-font-budget,controls,search-draft,source-panel` | actual modifier四字号、搜索/保留SourceFilter/Group目标行三消费者SDK预算、既有选择/草稿/Apply/关闭准入；只选这五case，无Core/网络/设备 |
| `node tools/test-search-static-implementation.mjs --case compact-sheet` | 搜索父容器与滚动关系/即时结果和草稿提交语义的既有准确检查；不执行其他搜索场景 |
| `node tools/test-source-management-layout.mjs --case matrix --write-evidence` | common Button/Specs字节变化使旧17输入报告失配；重验未改source-management分支并绑定新输入，不把旧数据直接重签 |
| `node tools/page-structure/validate-model.mjs`、`check-contract-refs.mjs`、`check-register.mjs` | 新报告/register引用与实际输入一致；S8/E2/E3等已开放项继续如实FAIL/NOT_RUN |

不重复14.11已通过且未受影响的外观/InlineSelect、Source→Index与55框架case。既有native manifest保留历史字节；common源码变化后，它不再代表当前全组件闭包，只复用工具链/字体未变的Previewer限制定位，不伪装新渲染通过。代码取消上限不等于2×原生/设备验收，`SHARED-FONT-CAP-01`最终须拆“代码/SDK修复”与“真实字形/系统字号验收”，页面E3仍不得据此升级。

首批结果与定位：Source原matrix已实际PASS（32/40/24）并生成新17输入报告。compact-sheet在当前Search构造时因probe缺`ReaderMeasurementStore`而FAIL，原始输出保留为本批私有目录`search-compact-attempt1.log`。条件性测试白名单增加`tools/test-search-static-implementation.mjs`：仅注入真实Store/高度函数，去掉已删除私有字段的fixture赋值，保留实际header60vp、草稿/reset/apply/旧回调断言；不改生产或删断言。修后仅重跑compact-sheet。

搜索实现同时复用ReaderMeasurementStore，按part的真实宽/字号/必要内容与opening/action定义测量key，generation0仅用于已包含完整身份的opaque key；@State measurementRevision驱动已接受回执的重算。footer/notice未知时只令对应选项/列表视窗归零，测量宿主位于限高Scroll之外并按key重建；不因同高度而永久等待。windowHeight、垂直safearea及无关状态不使notice缓存失效。独立源码审读核对了旧回调拒绝、初次Area恢复、退出身份，以及header margin12/body bottom20/groups两段12间距各扣一次；原生调度仍未验收。

补测第一批：compact-sheet修复实际依赖后PASS。五case批次中specs（含同一actor live1→2）PASS；新filter-font-budget因有限RenderedPart端口把SDK elmtId存为elementId、而ViewPU.create要求child.id，第二次replay报native child retained而FAIL。定位为新测试端口登记错误，已仅改为id，未改生产、runtime断言或移除节点；后三case尚未运行。本次原始日志保留`filter-controls-attempt1.log`，仅重跑budget及尚未运行的controls/search-draft/source-panel。

条件性必要入口追加：`node tools/test-reader-filter-controls.mjs --case filter-sheet-exit`。本批实际更改了actions槽中footer的ForEach测量宿主与拆卸清理，需验证退出中slots保留、native closed唯一与销毁后无Prop读取；不选同工具其他四个无关case。另因groupsContent中的ReaderPageState增加了尺寸key宿主，其既有消息入口的effectiveHost/retireRule需明确“读取事实由父owner持有，尺寸key不拥有业务”；只更新这一ID的两个说明字段，白名单条件性增加`tools/message-entrypoints.json`。执行准确`node tools/check-message-entrypoints.mjs --check --file entry/src/main/ets/features/search/ReaderSearchFilterPanel.ets`，无全树扫描、不新增family/ID/原生消息出口。消息文字和业务Owner不变，仍归已有页面/局部读取状态类别。

补测第二批保留两项失败：budget在hint跨分支时遇到通用probe“不模拟原生If移除”的明确边界，改为不同hint独立SDK挂载，原owner保存的旧Area callback仍须被新key拒绝，同hint下的width/font真实ForEach新宿主与同高回执检查保留；未改runtime或宣称原生reconciliation通过。退出case发现真实新observer约束缺口：新嵌套ForEach可独立于外slot guard响应Props，旧opening会生成新opening的footer。生产已补retained action约束到ForEach的key数组及子回调，允许当前opening关闭动画中继续渲染，但closed/旧opening/旧step均不给新节点；notice同样修复。仅重跑受影响budget、退出与compact-sheet，未执行的三个旧case继续准确选择。

消息登记本批仅改groupsContent既有ID两个说明字段；修改前SHA `5c45869e…`、修改后`d14ae283…`，逆向恢复这两个字段能精确重建原字节（记录在`message-entry-change.json`）。其余入口、retained scopes与19项开放问题不借此调整。

#### 本批最终结果

`SHARED-FONT-CAP-01`现为**代码已修复 / SDK验证通过 / 原生验收仍OPEN**。source-filter-option和搜索局部1.6上限均已取消，实际当前scale驱动label与minHeight；四点检查范围为1/1.3/1.6/2，没有声明所有字号/设备全层通过。

本批生产只改三个文件：ReaderControlSpecs删除旧固定上限；ReaderButton为该ID显式接入当前字号；ReaderSearchFilterPanel对齐真实search44、filter-action增长和footer预算，复用测量Store并补当前/旧action的observer身份边界。ReaderSourceFilterPanel与SourceGroupManagementPage源码仍分别为`3bf7611f…` / `ceac187d…`，未改、未新增接线。保留SourceFilter只计组件SDK覆盖，分组目标行测试也不作为路由/写入验收。

| 必要检查 | 最终结果 |
|---|---|
| specs | PASS并REUSED；四字号及同一actor live1→2，原Text/节点数保留，minHeight随scale更新 |
| filter-font-budget | PASS；8宽度/字号组合×搜索/保留SourceFilter/分组目标行，实际父布局和Shared Button属性；Source状态4→2列、类型三列/其他全宽、长标签均保留自然高度 |
| controls / search-draft / source-panel | 3/3 PASS；没有改变草稿、reset、Apply和关闭准入 |
| filter-sheet-exit | PASS；本轮发现的旧observer越界已修；仍验证关闭动画中内容保留、closed唯一、旧opening/slot拒绝及销毁后无Prop读取 |
| compact-sheet | PASS；真实header预算及Search→filter的原子提交、旧回调规则保留 |
| Source matrix | PASS；32/40/24，当前17输入已重新采样，不直接给旧结果换哈希 |
| validate-model / check-contract-refs | PASS |
| check-register | FAIL保留S8/E2/E3；B1/B4仍NOT_RUN，没有新增证据漂移或格式/引用失败 |
| Search消息selected | PASS；两个registered/observed入口一致，仅AST接入一致性，不代表全树消息语义/生命周期验收 |

budget中的原生移除模拟边界已明确：所有变化key的SDK快照独立挂载，保留生产ForEach的实际key/Area工厂、旧owner回调拒绝与同高新key回执恢复；不调用退役树的全量replay、不放宽通用runtime断言。原生ForEach/If reconciliation、文字换行/字形、系统字号和设备调度均不由这些SDK数字证明。失败attempt1–3和首次exit失败均保留；后来退出专用回归真实通过，不将SDK端口修复当生产缺陷。

完整记录为[本批验证说明](../../.reader-artifacts/page-structure-stage4-20261103/README.md)和同目录`verification.json`，后者SHA `dffebd55e3ec44f023b1292b310c33346d063f7bd41ae7ac3747fbe4959ff786`。记录逐项退出码、精确case回执、原始日志SHA、当前输入和全部失败尝试；specs来自后续失败的首进程，单case PASS复用与进程FAIL分别记录。为复用旧Previewer限制诊断，额外只核3个相关SDK二进制与8个字体文件，11项SHA仍与旧记录一致；不是当前页面闭包或新native运行证明。未可靠测得的总耗时不补造，主要定位发生在旧probe依赖/模拟边界及新增observer身份，不是重复构建或设备等待。

当前输入摘要：ReaderButton `bace8890…`、ReaderControlSpecs `002e49d8…`、ReaderSearchFilterPanel `4256c208…`。页面register revision7 / SHA `c96b7e8b…`；Source SDK报告SHA `988a01f1169d3b5aef3d8f33ea4ef2bb54afd3f5e7101920dc620e53d58ca19b`。SourceManagementPage自身仍`818a4584…`；control/nav/platform/contract-map行为事实未变，control revision3沿用，不扩为全量登记。

本批没有新的Previewer/HAP/签名/安装/HDC/设备/读屏/用户验收。旧native manifest `a9dbf405…`保持历史字节，但common源码已变，不能再称当前65模块闭包匹配；其同字体/同SDK的系统scale不支持、variable paint失败定位仅REUSED诊断。Stage 4原生与页面全层合规仍未闭环，19项全树消息失败仍OPEN（本批未重跑全树）。下一步按剩余E2完整目标覆盖、E3正确系统字号/字形，以及各自未决项继续，不用本次共享修复替代它们。

### 14.13 证据卫生、完整目标清单与后续分流（2026-11-03，执行前登记）

用户要求先落实本次审计，再完成后续当前可做事项。保留14.12及其verification.json的历史字节，新回执放`.reader-artifacts/page-structure-stage4-followup-20261103/`，不追改旧PASS/FAIL。生产本批原则上不变；SearchPage等前置dirty WIP固定为外部输入，不算本批修改。

执行顺序：先定位/修复六case同进程probe ID冲突并绑定compact-sheet实际输入；再列出书源整页所有交互目标及状态/宿主，代码侧补SDK覆盖。E2整页原生命中与E3正确生产字形/真实系统字号仍须另取证，不因SDK覆盖变全就关闭。消息19项单独建立owner/精确入口/开放账本；Stage 5只准备静态登记草案，不接线、不迁移共享规格，也不把未验收行为写成通过。

本批白名单：测试`tools/test-reader-filter-controls.mjs`及确需修复的局部probe；`tools/page-structure/`中的书源目标清单/定向检查/证据引用；本方案、架构说明及独立消息问题账本/Stage 5草案；新私有证据目录。共享probe只有定位证实问题且不放宽断言时才改。不会编辑SearchPage、Index、ReaderSearchFilterPanel或旧冻结artifact来迁就测试；消息生产修复若需展开，先在独立账本写明实际入口/生命周期/范围。

精确验证计划（先读入口和实际嵌套范围，不附带其他套件）：

| 入口 | 本次必要问题与范围 |
|---|---|
| `node tools/test-reader-filter-controls.mjs --case specs,filter-font-budget,controls,search-draft,source-panel,filter-sheet-exit` | 同进程六case ID隔离与既有断言能否共同复现；无设备/Core/网络，不跑其他case |
| `node tools/test-search-static-implementation.mjs --case compact-sheet` | SearchPage等前置dirty输入已绑定后的实际搜索布局/草稿回归，只此case |
| 书源完整目标清单的定向SDK入口（实施前追加准确命令） | 与实际builder/事件/共享组件一一对应，覆盖静态与条件态；不证明原生命中/读屏 |
| `node tools/check-message-entrypoints.mjs --check` | 独立消息账本只做一次当前全树诊断，固定19项或实际差异；脚本不调用其他业务门禁，后续只按受影响文件检查 |
| `node tools/page-structure/validate-model.mjs`、`check-contract-refs.mjs`、`check-register.mjs` | 仅实际登记/schema/报告变化后运行；未变化则复用14.12，不为新文档重跑 |

E3只先审本机已有工具链/已存在宿主记录和支持能力，不启动/安装/操作设备，也不重试同一CPU Previewer。若需要HAP、设备或系统字号变更，准备具体候选宿主、取证步骤、数据保护与停止条件，再申请该动作授权。消息与Stage 5各自登记，不并入Stage 4局部PASS。

条件性白名单与精确入口补充（定位后执行）：

- 六case失败确认为官方SDK编译器进程级ID登记残留，按case保存/清空/恢复该登记，保留SDK重复ID断言；仅修改本测试的隔离边界，不改生产组件ID或共享probe。
- compact-sheet使用`node --import ./.reader-artifacts/page-structure-stage4-followup-20261103/observe-compact-inputs.mjs tools/test-search-static-implementation.mjs --case compact-sheet`，只读观察并转发原fs/ESM调用，固定实际SearchPage/ReaderFilterControls与probe输入；不扩展case或改变断言。
- 完整E2审读发现ReaderRecoveryAction的notice变体minHeight28/minWidth30，且同Flex相邻动作无间距。白名单扩大到`ReaderRecoveryAction.ets`和`ReaderRecoveryNotice.ets`：真实布局minWidth/minHeight至少44，不采用相邻重叠的外扩responseRegion；Notice初始actionsHeight/文字预留宽度同步，native Area继续校准。约27文件/38 Notice调用及其他Action消费者列入影响账本，复用统一共享装配而非逐页改业务。新增准确入口`node tools/test-source-management-targets.mjs --case inventory,targets,recovery-targets`（如实现拆文件，先追加更正入口），只覆盖实际目标树、四字号、短长标签/多动作、忙碌/禁用/旧generation及父槽预算，不调用字体资产扫描或其他业务套件。原生实际换行/命中仍OPEN。

E2准确入口更正：实现采用`node tools/page-structure/test-source-interaction-inventory.mjs --case inventory,sdk-targets,recovery-targets`，替代上文尚未创建的`test-source-management-targets.mjs`；不运行两套。另审读证实sourceManagement SearchField的TextInput仅42vp，外Row44并不转发编辑命中：条件性白名单增加`ReaderSearchField.ets`，仅sourceManagement分支复用已有`readerActionTouchRegion`显式声明44纵向目标，其他variant不动；42vp输入字形与原生边缘点击仍不因此通过E3/E2。恢复动作和输入修复在定向SDK入口覆盖，报告若实际依赖字节变化才重生成matrix并更新register。

独立消息分流的可执行范围：首次全树仍19 FAIL。代码审读确认ReaderRecoveryAction漏入scanner components表，两个有效入口被误报stale；三处native Alert实际已在ReaderNativeAlertOwner.present回调内，仅缺明确bridge登记。独立账本据此允许最小修复`tools/check-message-entrypoints.mjs`及`tools/message-entrypoints.json`、该工具的准确负例case；不改消息生产出口、不机械删有效登记。补识别后新增组必须逐项记录事实owner/身份/retire与retained范围，不能自动刷表。工具/登记变化后只做该工具最终全树校验和选定负例，不运行全业务门禁；19初始失败回执保留。具体case/真实新增组由独立消息账本执行前登记。

完整目标独立审读新增生命周期缺口：ReaderRecoveryNotice展开/收起Action未传generation（默认0），旧展开回调可在view.generation切换后修改新notice的expanded。本项并非44尺寸改变引入，但当前完整目标审查不能遗漏。仍限已授权Notice文件，显式传view.generation且仅visible/当前generation接受展开意图；`recovery-targets`追加当前/旧/隐藏notice断言。消息工具全树结果若先于此修复，仅作历史该次回执，最终对该变动文件执行selected检查并组合未变文件复用，不把旧全树哈希伪装当前。

清单新增交互族同步到`tools/contracts/control-registry.json`与书源page controlRefs/层12证据，原13项内容含source-row/source-status仍作为非交互内容引用；outside dismiss不按44按钮计。control registry独立revision递增，page登记同步消费revision，不影响消息或导航revision。layout证据适配器的书源有限交互集合补齐新增真实按钮族，并执行`node tools/page-structure/test-layout-evidence.mjs --case layout-evidence`验证漏目标不能伪造全页PASS；不运行55个框架case。原五控件SDK预算继续保留为局部报告，页面E2/E3仍FAIL。

完整E2定向入口最终使用只读依赖观察器：`node --import ./.reader-artifacts/page-structure-stage4-followup-20261103/observe-target-inputs.mjs tools/page-structure/test-source-interaction-inventory.mjs --case inventory,sdk-targets,recovery-targets`。原因是新增测试原局部inputPaths未列全probes/重导出/颜色等实际输入；最终guard/清单/registry已经变化，选择这一次准确同批回执并绑定真实fs/ESM读取。观察器原样转发调用，不改变测试，不证明系统文件或native依赖闭包；各读取与退出哈希一致也不等于文件系统原子快照。此前失败/局部通过原样保留。Notice展开还在可见、current generation之外核clipped，避免原展开按钮在内容已不截断后改写隐藏状态。

SourceSearch复审补充：对其他auto variant调用responseRegion(undefined)不能证明与原来无setter等价。因此用本文件有限AttributeModifier，只有sourceManagement才调用已有readerActionTouchRegion/responseRegion；其他variant完全无setter。新增SDK对照按属性是否存在验证，不只比较undefined值。该变更仍限原有已授权文件与准确目标case；先前同批回执作为中间候选保留，定稿后只补真实受影响的目标/compact入口，六case的SearchField端口不证明此原生分支。

共享输入影响面核对追加一个实际消费者：`tools/test-search-native-focus.mjs --case field-clip`直接调用autoLineHeightField，需给probe注入同文件真实有限modifier；仅把它加入测试白名单并运行此case，不执行web-focus、其他漫画测试或设备。该入口是SDK字段裁切/属性probe，名字含native不代表本轮设备；新modifier新增实际依赖后补必要probe，不把缺依赖当生产失败。Source最终字段modifier定稿后，compact（实际模板依赖）补一次，之前回执保存pre-modifier；六case用端口读取字段Prop并不验证该modifier行为，其余结果保留，新增实际响应区由E2定向case/field-clip负责。

最终候选绑定：三个共享生产文件已定稿，readerSearch响应区由真实有限modifier提供；为使六case同进程复现回执也绑定这份最终共享输入，再按原六case准确命令运行一次，不增加case。该批仍不证明Port未执行的原生分支，实际modifier由sdk-targets/field-clip覆盖。此前所有中间候选和失败日志保留。

#### 14.13 最终结果与复用边界

**本批可在代码侧完成的修复、完整目标登记和证据卫生已完成；Stage 4原生与页面合规仍未完成。** 没有HAP、签名、安装、HDC、设备或读屏操作。

生产实际只改`ReaderRecoveryAction.ets`、`ReaderRecoveryNotice.ets`、`ReaderSearchField.ets`：动作真实布局至少44×44，Notice预留同步；展开/收起核对visible/clipped/current generation；只有sourceManagement输入应用44vp响应区，其他variant完全不调用responseRegion setter。最终SHA依次`9b2a08b5…`、`4fd6d938…`、`747b1e6a…`。原书源页`818a4584…`及SearchPage前置dirty WIP `abaec480…`均未改。40个Notice调用/27文件、40个Action调用/22文件、5个sourceManagement Search调用/5文件只作为共享影响清单；公共组件SDK验证不等于这些页面全部原生验收。

| 准确检查/产物 | 结论与边界 |
|---|---|
| 六case同一条`--case specs,filter-font-budget,controls,search-draft,source-panel,filter-sheet-exit` | 最终候选6/6 PASS，exit0；修SDK ID_ATTRS进程登记隔离，不放宽SDK重复ID诊断。原六case批次FAIL保留 |
| compact-sheet / field-clip | 最终各PASS/exit0；前者真实读取81项，补固定SearchPage、ReaderFilterControls及既有未跟踪probe；后者保留原caret断言并注入真实modifier/样式依赖，未选web-focus |
| 完整目标inventory | PASS：34模板、19可达站点、4手势另列；当前无query clear，retained statusBanner/非交互行/徽标不冒充目标。全部controlRef解析到page/control registry |
| sdk-targets / recovery-targets | PASS：200 SDK属性样本、48 Recovery框/回调样本；含5状态/7类别、空动作/忙碌/secondary-only/0 Area与旧展开拒绝。Recovery没有注入系统scale，只证明min44等不随循环tag改变的属性，不称四字号原生布局 |
| 输入闭包 | compact观察+六case补充共85项，E2实际观察78项；最终读取/退出/当前指纹一致。SDK系统依赖不在该workspace观察闭包内，非原子快照；观察器本体另绑定 |
| 旧Source矩阵 | REUSED：17输入无变化，32组合/40目标/24预算仍有效；这是旧五控件局部报告，不扩大成34模板原生命中结果 |
| 页面/控件登记 | page revision8、control revision4（25引用）；新增12实际交互族。source-row/status仍内容引用，outside dismiss为区域交互，不当44按钮；layout有限适配器与漏恢复动作负例同步 |
| validate-model / check-contract-refs / layout-evidence准确case | PASS；未运行55框架case或业务全量 |
| check-register | 仅保留S8/E2/E3 FAIL；B1/B4及其他既有manual NOT_RUN照旧。E2原因已区分“代码清单/SDK已做”与“原生命中/裁切/焦点/字号未验” |
| 独立消息修复 | 初始19 FAIL保留；checker补已有RecoveryAction识别，逐项审新增组和过期项，最终全树201/201、0失败。随后两个源码变化用Notice selected 1/1、SearchField selected 0/0补验，其余574个源码指纹与检查后清单一致；不把后采集指纹冒充检查前原子快照 |
| Stage 5 / E3 | 目录/下载16层准备稿与21输入已固定，PREPARATION_ONLY；E3宿主计划PLAN_ONLY。未新增Stage 5 active page、未裁决D3、未把API/镜像存在算宿主Ready |

失败和中间证据没有覆写：六case ID冲突、E2新probe依赖/端口缺口、一次register在E2读取期间变化，以及field-clip首次FAIL均保存。field-clip曾因shell尾部hash命令exit0被误读为测试PASS，该声明已撤回；最终测试单独进程实际exit0。稳定E2三case重新执行，78项无漂移；主要耗时是局部probe/依赖修复，没有构建/设备等待，不补造未实测总耗时。

本批完整回执为[证据说明](../../.reader-artifacts/page-structure-stage4-followup-20261103/README.md)与同目录`verification.json`（SHA `e25a001e0a195b2ec8b6714083ea918d002572499eb24a123fdcfc2c82c12113`）。page register SHA `013af35d…`、control registry SHA `d8d5e742…`；14.12旧verification仍为`dffebd55…`，未改写。消息登记一致性问题的owner与逐项结果见[独立消息账本](message-entrypoints-followup-20261103.md)，不是所有跨页消息运行行为已验收。

后续可审阅输入已备好：[Stage 5准备稿](page-structure-stage5-preparation-20261103.md)、[原生宿主计划](page-structure-native-host-plan-20261103.md)。原生按用户本轮要求单独授权后执行；当前仅发现已有模拟器配置指向缺失镜像，没有已确认可用的替代宿主。D1继续保留入口；NAV-07/08、B4、D3、读屏/焦点和E2/E3各自维持未决，不借文档/SDK/消息检查升级为PASS。

### 14.14 用户裁决与现有模拟器只读核对（2026-11-03）

用户选择：仅只读核对现有模拟器实例、镜像、可用性，暂不安装或交互；D3要求详细解释，未裁决。不会启动/重启/停止VM或HDC服务，不更换镜像、创建实例、构建/签装、操作界面或修改系统字号。

唯一待答问题：现有实例是否有真实可用镜像/活跃宿主及已Ready的准确VM目标，而非仅有配置文件。已检查源码侧路径解释：config.ini的sdkPath与hardware-qemu.ini实际分区路径不同，后者指向用户SDK目录，发现该处HarmonyOS7.0.0目录存在。因此前一轮按config拼路径得出“镜像缺失”的结论撤回，改为待核实际分区文件与运行宿主。

最小只读入口（无业务测试/全量门禁）：实例INI和镜像sdk-pkg/info及文件stat；当前Emulator/HDC进程、镜像打开文件、本地8710 listener与loopback路由；存在可用listener且无活动租约时，经reader-hdc-lease对127.0.0.1:8710一次`list targets -v`，禁自动拉起、直连清代理。仅发现并由宿主/当前日志确认的VM目标才可在同server租约读取boot完成/bootId与SceneBoard进程；不对物理目标派发命令，不做tconn/reconnect/服务恢复。目标缺失、Offline、租约占用或已知SceneBoard故障即停止该分支，保留原输出，不循环重试。普通命令上限30秒，发现/本地连通检查采用更短有界等待。

D3同时只读审代码：说明高度阈值、fixed与inline实际滚动归属、安全区/测量/恢复，以及两种裁决的产品影响；未经用户选择不改SharedDownloadPage或把变体记为合规。新结果单独保存，14.13冻结manifest不覆写。

只读发现首尝试保留：HDC客户端10秒超时exit124、无输出，租约已释放；随后最小host TCP诊断明确返回`connect EPERM 127.0.0.1:8710`，定位为sandbox网络准入，不能归因为VM Offline。实际lsof显示当前HDC listener仍在，且server→127.0.0.1:5555为ESTABLISHED；route为lo0直连。基于这个新原因，只在已授权只读范围下以受审的非sandbox执行相同租约发现一次，不启动/恢复服务、不做tconn；原失败日志不覆写。

#### 14.14 只读结果与D3解释

现有模拟器基础运行可用性通过：hardware-qemu实际指向用户SDK的HarmonyOS7.0.0镜像，当前Emulator持有这些镜像和实例qcow2；HDC本地listener与VM端口均已对应实际进程，回环路由lo0，准确VM Connected。6个只读guest命令取得bootCompleted=true、bootId/uptime和间隔1秒两次稳定SceneBoard PID/bootId；当前宿主日志有本次启动后的Guest OS Boot Completed，最新boot之后未发现该日志中的已知reset/崩溃标记。仅记BASIC_GUEST_READINESS_PASS，不是E2/E3或Reader验收。最初sandbox连接被EPERM阻断、受审直连发现与最后租约释放分别保留。没有构建/安装/启动App或UI/字号操作，也没有触碰其他发现目标；原生页面取证仍未授权。详见原生宿主计划的新结果节。

D3继续未决。它决定下载页是否保留“头尾预算占满窗口时，将同一头尾放进主列表滚动”的高度降级策略：正常overlay模式为独立固定头/底dock，列表offset避让；inline模式不挂固定槽，而在List首尾插入compactHeader/compactDock，额外start/end inset清零。触发式为contentTop+contentBottom>=availableHeight，依据真实测量与安全区，不按手机/平板或宽度直接切换。源码fallback在header52、dock68、底部safe不大于44的假设下预算208vp；这是代码算例，不是设备或字号实测阈值。

保留条件变体意味着登记明确触发条件、唯一滚动owner、头尾只挂一份、inset归属和跨模式状态恢复，并把临界点/字体/键盘resize/焦点的未验项保留。统一模式还需选“始终固定”或“始终随列表”：前者在极短窗口必须另设计可访问降级，后者在普通长列表会使返回/管理/存储dock滚离视口或落在列表末尾，均涉及实际产品行为改变。当前更有依据的建议是保留高度降级条件并纳入契约；正式裁决仍由用户选择，未改SharedDownloadPage、未登记为合规。现有topBar自测跨placement保留已防一种测量振荡；任意高度切换的滚动/焦点稳定尚无原生证据，不能借管理模式已有锚点保护宣称全通过。

### 14.15 D3裁决：常态列表实现（2026-11-03，执行前登记）

用户明确指示“那就按常态列表实现”。按紧邻讨论落实：普通浏览时页头、搜索/筛选、书籍/章节、容量或章节操作均在同一个List；进入管理/选择态后，固定底部批量操作区；极短窗口不足以同时容纳操作区与有效内容时，操作区回到同List尾部保证可访问。切换由任务状态与空间预算决定，不增加按滚动方向隐藏的状态机。返回/管理/存储/选择章节/定位当前/下载/暂停/更多入口及业务意图保留，不改Index、Core、版本或字体。D3从未决进入本项实现；不把实现记为原生验收或Stage 5全层合规。

本批白名单：生产只`entry/src/main/ets/features/downloads/SharedDownloadPage.ets`，复用既有ReaderPageScaffold/PageGeometry/MeasurementStore。测试只`tools/test-shared-download-visual-contract.mjs`新增list-layout与受影响准确case必要依赖适配；已存在`test-shared-download-ui-sdk.mjs`只读page-assembly。消息入口若布局owner描述确实失配，仅改SharedDownloadPage现存登记的说明字段，不新增出口/类别。文档更新本方案、Stage 5准备稿与必要架构说明。前置dirty和全部旧manifest/原始artifact保持；新回执放`.reader-artifacts/download-list-layout-20261103/`，已有页面原字节已留baseline。

必须满足：header恒为书籍/章节List首项；普通dock只在List尾部，管理dock固定和inflow两种宿主最多一份；没有固定header的额外startOffset，普通inflow不再双扣footer inset；固定footer时只避让实际footer与安全区。测量按真实dock种类/管理状态/宽度/字号/上下文捕获，旧inflow Area不覆盖新fixed预算；管理进出保持当前List/scroll owner，保留既有用户触摸/筛选/身份/字体/窗口取消旧恢复的准入。locateCurrent索引计入恒定header首项。字体准备和pending消息不能保留一个不存在的固定页头空白；sheet/dialog仍走既有宿主与返回顺序。

精确验证计划（本批不跑业务全量、Core或原生）：

| 入口 | 范围/必要性 |
|---|---|
| `node tools/test-shared-download-visual-contract.mjs --case list-layout,native-bindings,management-scroll` | 真实SDK builder/方法的新常态列表、book/chapter×浏览/管理、320/366四字号上下文、dock唯一归属/inset/短窗口、当前章节定位和旧测量准入；保留既有header/cover/正常Button约束、管理恢复准入与负例。有限原生端口只证明方法/声明，不是原生文字/点击/像素验收 |
| `node tools/test-shared-download-ui-sdk.mjs --case page-assembly` | 官方SDK parse/真实initializer字段和component lowering，避免新helper/BuilderParam装配缺陷；不构建HAP、不作完整语义typecheck |
| `node tools/check-message-entrypoints.mjs --check --file entry/src/main/ets/features/downloads/SharedDownloadPage.ets` | 现存消息owner布局仍可解析；本页准确AST/登记检查，不重跑201全树 |

先从代码和SDK定位失败，原始日志保存后只重跑实际受影响case。既有仅获授权的模拟器只读范围保持不变，本批不安装、不启动App、不截图/触摸或改字号；本次生产字节变化后旧native结果不代表当前候选。若需要新增测试入口/文件或扩大生产范围，先记录具体依赖与必要性。

14.15框架对齐补充：SecondaryCollection原型已允许ScrollAway，但header决策仅在contentImmersive=true时命中，无法如实推导用户选定的普通列表。白名单增加`tools/page-structure/model.json`及新的精确`tools/page-structure/test-download-list-structure.mjs`：仅新增navigationPersistence=optional、titleCanExit=true、contentImmersive=false时推导ScrollAway；required仍优先Fixed，标题不能离场的默认/immersive分支保持原结果。使用已有brief轴，不谎报下载为immersive、不新增产品版本或全局UI行为。预登记`node tools/page-structure/test-download-list-structure.mjs --case browse-list`覆盖下载普通列表正例、required/default/immersive对照和Selection非法组合；随后`node tools/page-structure/validate-model.mjs`只核真实model/schema。不会运行55case整套框架，也不追加下载active register半张表。

14.15可达性补充：页头常态入List后，原managing=true的“完成”会随页头滚离。将该已有动作迁到selectionDock摘要区（与所选数/全选同一语义组，允许换行、真实目标至少44），管理态页头原右槽留空保留标题居中；普通态“管理”入口不变，避免同态重复“完成”。完成继续调用既有setManaging(false)，捕获当前presentation拒绝旧回调；原Back顺序照旧。此为完成既有管理旅程所需入口迁位，不新增业务操作或消息，list-layout验证空选择/完成/旧身份拒绝和摘要父预算。

最终准确三case命令使用只读依赖观察器：`node --import ./.reader-artifacts/download-list-layout-20261103/observe-inputs.mjs tools/test-shared-download-visual-contract.mjs --case list-layout,native-bindings,management-scroll`。观察器原样转发workspace fs/ESM读取，固定SharedDownloadPage及实际probe/规格输入，不改变断言；循环标签不冒充原生系统字号，读取/退出一致不宣称原子文件系统快照。原无观察器命令的检查范围相同，不额外重复一套。

14.15既有消费者补充：同一visual测试中的reactive-metrics直接要求固定header slot，新结构必须改为观察同一List首项的reactive safe边/字号；area-receipts仍断言旧headerMeasuredHeight/dockMeasuredHeight与List.padding，已与本轮输入中的MeasurementStore/contentOffset接线漂移。它们与本次header/dock测量契约直接相关，允许在同一测试文件最小适配为真实store/捕获key与List offset，保留原numeric/vp/负例及其余未改字段断言。准确case集合增为`list-layout,native-bindings,management-scroll,reactive-metrics,area-receipts`（同观察器命令，只这五项）；不因旧probe漂移扩大到其他case。

14.15验证中间记录：五case首批因新测试以圆角/onArea全树选择dock，把同圆角页头误计为第二个dock，实际唯一性无生产双挂；修局部selector，保留visual-attempt1。随后retained epoch/key全owner flush遇通用SDK probe不模拟原生If/ForEach移除的既知边界，保持严格runtime不改；静态宿主唯一性使用独立当前挂载，跨key仅执行实际SDK ForEach工厂并保存旧closure验证拒绝/新动作准入，不宣称原生树移除/焦点已通过。

新实际pageWidth审查发现几何/恢复owner未完全同源：父布局宽度可变而全局metrics revision不变，旧管理恢复anchor仍可能被接纳。仅在本生产文件补实际页面宽度的anchor捕获/比较或等价失效；新增同scaffold Area 366→320且globalrevision不变的旧恢复拒绝、首次0→global同宽不误取消。此为本次新增实测宽度需要的生命周期修复，未扩大动作或测试集合；最终源定稿后再补page-assembly/selected，早先通过保留中间候选。

#### 14.15 最终结果

**常态列表已实现，代码与本轮SDK定向验证完成。** 普通浏览的页头、查询/内容和普通dock均在同一List；管理态只在“实际footer预算+最低任务内容预算”可容纳时固定selectionDock，短窗口退回List尾。管理态完成动作已迁到底部摘要，原页头右槽留空保持标题居中，非管理仍显示管理入口。没有按滚动方向自动隐藏。

生产只改`SharedDownloadPage.ets`，基线SHA `6956765f…`，最终SHA `0c0f14a7b511dd34ac1912997def84d85b7c3cfd890a6904b249afc41477f7b9`。新实测pageWidth同时进入几何/测量key/管理恢复anchor；初次同宽测量不使旧anchor失效，真实宽度变化拒绝旧恢复。header恒首项后章节定位为3+实际章节序号；固定footer之外不预留幽灵页头/尾部空间。完成/全选使用当前presentation、managing和捕获context准入，真实目标至少44。计数/容量同context不重挂，width/font/session/mode真变化才重建测量宿主；fixed/inflow只复用几何缓存，不宣称原生节点/焦点跨父宿主保留。

| 精确入口 | 最终结论 |
|---|---|
| visual五case同一进程 | PASS/exit0：list-layout、native-bindings、management-scroll、reactive-metrics、area-receipts；64布局上下文、13类Area转换numeric/vp正例及逐Number退化负例；当前/旧完成回调、真context/同高计数、窗口宽度与恢复准入 |
| page-assembly | PASS/exit0；官方SDK parse/initializer/lowering，未作完整ArkTS语义检查或HAP构建；最终源重验后回执在page-assembly.log |
| browse-list + validate-model | PASS；普通非沉浸列表可显式ScrollAway，required优先Fixed，非法Selection组合仍拒绝；未跑55个框架case |
| 下载页消息selected | PASS/exit0，7 registered/7 observed，无新增/删除消息入口或登记；本轮未重跑201组全树 |
| 输入与历史 | 最终visual观察97项workspace读取全部稳定、当前匹配；assembly源审计30项直接依赖/34个直接media存在性；新Stage5准备21输入独立固定，旧冻结manifest不覆写 |

首批失败均保留：相同圆角的页头被测试误计为第二dock；严格SDK probe不模拟原生If移除；管理负例历史source.replace失配；旧Area测试中的共享ActionMenu helper缺真实readerScaledControlHeight依赖。均先定位，仅局部修测试/组合真实组件，不改通用runtime、不中途删除断言或用空桩绕过内容。完整五case最终在定稿生产/测试上重新同批执行，原局部PASS与失败不追改；详情见testing-notes。原生树移除/像素、列表真实clamp/可视位置、焦点、系统字号和字形仍NOT_RUN，不把scrollTo实参或循环字号标签当作这些证据。

新回执`.reader-artifacts/download-list-layout-20261103/verification.json` SHA `58e77fc13d273bb4b5fe9a6973b7a77c0afa52d6dca20b145cf3ebe858145145`；测试SHA `55600df5…`，model SHA `8310f210…`。源码/观察器/原始日志与前后基线分开绑定，读取/退出相同不等于文件系统原子快照。未可靠记录的总耗时不补造；主要定位开销是既有probe漂移和有限runtime边界，没有构建或设备等待。

D3当前为实现/SDK完成；两页正式16层登记/上游引用及全页原生合规仍未完成。active register与消息registry字节均未因本批修改。既有模拟器授权仅只读基础核对，本批没有HDC调用、HAP构建、签名、安装、App启动、截图、触摸、读屏或字号操作，模拟器中的App没有更新。

### 14.16 P0证据固定与Stage 5正式登记（2026-11-03，执行前登记）

用户指示按P0→P1推进。P0先核最新followup回执而非旧manifest：六case同进程及compact-sheet实际输入已固定，相关生产/测试字节未变，复用原PASS；新增85输入内容归档、逐项摘要和恢复说明，使untracked文件也可在独立目录恢复，不stage/commit、不覆盖dirty WIP。

Stage 5只建设登记与必要模型表达，不改生产代码。目录区分详情完整目录、阅读中完整目录、阅读控制目录模块、漫画换源选择目录四类真实宿主，并细分实际text/manga及父级；控制模块不是独立路由。下载按已裁决D3登记book/chapter与普通浏览、管理固定底栏、极短窗口管理底栏入流的变体。已有SDK结果仅REUSED，不升级原生。路由未知保留策略使用上游null，操作未完成端到端绑定时用partial+knownGap，不能填bound或PASS。

当前schema不能表达同页多宿主，routeFacts也错误拒绝上游nullable retention；本批增加有限variants（完整16层、host、条件，无递归）、sourceInputs摘要、footer placement，并让schema/引用/源码校验逐变体执行。embedded模块只校适用层，整页原型推导明确NOT_RUN；选源整页与现有Selection原型的真实差异仍FAIL，不为登记新画外框或改业务。固定/入流footer分别校避让，presence不再等价于fixed。新增控制引用按两页实际消费者增量合入上游；不改变控件实现或导航保留语义。

白名单：tools/page-structure/schema/register.schema.json、lib.mjs、validate-model.mjs、check-register.mjs、check-contract-refs.mjs、新的test-stage5-register.mjs、register.json与stage5/登记输入；tools/contracts/control-registry.json；长期契约、本方案、Stage 5登记说明；新私有artifact目录。navigation registry、Index、生产源码、旧冻结artifact、版本/字体/签名均不修改。

只执行以下本批刚需入口，不嵌套业务/构建/消息全树：

| 准确入口 | 保护风险与必要依据 |
|---|---|
| node tools/page-structure/test-stage5-register.mjs --case host-variants,footer-placement | 新增多宿主不能绕过未知/重复引用、输入漂移、递归禁令；固定/入流footer规则必须保留正反对照 |
| node tools/page-structure/validate-model.mjs | schema与新增完整16层/22不变量的登记一致；仅加载现有七schema及SDK固定Ajv，不执行业务 |
| node tools/page-structure/check-contract-refs.mjs | 本批新增控制、宿主、路由、操作/消息声明及摘要引用可解析；仅SDK AST声明检查，无业务或设备 |
| node tools/page-structure/check-register.mjs | 真实原型差异、已知FAIL及源码漂移不得被登记吞掉；读取现有局部SDK布局报告，不生成新原生证据 |

B4检测准入和D4/S8往返保留是两个独立产品决策，已分别询问，未收到答复不修改对应代码/语义。E2/E3与原生生命周期仍开放；当前模拟器只读授权不扩展为构建、签名、安装、字号或交互。待答部分不阻塞上述P0/P1。

14.16登记自审补充：初稿已通过schema/引用检查，但不能据此停止事实审查。发现并收紧footer presence/placement矛盾可绕过避让、embedded标签可跳过整页语法、宿主声明源未强制SHA覆盖三项边界，新增负例；局部G09/E2仍必须命中。未知动态补偿null记NOT_RUN，不误报为无补偿。目录漫画footer固定/入流必须拆typed分支，不能只在condition字符串写混合；下载base即book-browse，不重复登记同一默认变体。文字书签1.1/1.07上限只在embedded motionBody，完整目录legacyBody不能被连带判FAIL，按真实调用分支修登记。已知不变量FAIL与所属层结果同步，防止被全层NOT_RUN掩盖。原始attempt回执保留，最终候选另写。

#### 14.16 最终结果

P0：旧两项可复用PASS已核实（followup verification `e25a001e…`；六case同进程日志`dbec4fd8…`）；SearchPage、ReaderFilterControls及两测试均绑定。新增`p0/sources.zip`保存85项内容，SHA `10ffc24c236ecb8c1d12f93604c47e8f4d85c49e12ab857c49e19ae80d255440`；manifest `924cfd99…`，归档逐项字节/长度/CRC及restore verify均通过。85项是81运行观察+4源码审读，不是完整SDK/全部项目闭包。Git状态保持，untracked内容可恢复但不宣称已跟踪。此为Stage 5登记改动前的冻结点，后续新候选另有inputs清单，历史回执不覆写。

Stage 5：active register当前3页面族、15额外变体（18主体）。directory基页+10变体覆盖四类宿主及全部manga fixed/inflow分支；downloads基页+5变体覆盖book/chapter普通/管理fixed/管理inflow，默认book-browse不重复。目录40、下载33个实际源码输入分别绑定；新增27+36控件族，control revision5共88项，目录/下载page revision1。Source revision8→9只同步消费control5，生产SHA `818a4584…`及4PASS/4FAIL/8NOT_RUN事实不变，不使既有布局SDK结果变成原生PASS。

| 本批准确入口 | 结果 | 边界 |
|---|---|---|
| validate-model | PASS，最终候选 | 固定Ajv8.17.1 MIT；schema、16层、22不变量、宿主范围/结果一致性 |
| check-contract-refs | PASS，最终候选 | 所有逐变体路由/控件/操作/消息/宿主声明与源摘要可解析，不证明运行可达性 |
| test-stage5-register --case host-variants,footer-placement | 2/2 PASS | 错误/重复/递归变体、未绑定宿主、输入漂移、nullable伪PASS、embedded绕过、局部G09/E2、footer正反例；不验证生产交互 |
| check-register | FAIL，退出1，如实保留 | 31条FAIL、11条NOT_RUN诊断，342条manual；无源码/布局报告漂移或INPUT失败；上下文重复诊断不等于31个独立缺陷 |
| 六case/compact-sheet/下载D3准确SDK项 | REUSED | 没有新跑，相关生产/测试字节未变；旧冻结回执保持 |
| 消息201/201 | REUSED，未新执行 | 本批未改消息生产/登记；只沿用入口一致性，运行生命周期未通过 |
| HAP/构建/签名/安装/设备/读屏/真实系统字号 | NOT_RUN | 当前授权未扩展 |

新增问题按源码事实留账：

- DIR-E2：目录真实部分控件/父子行预算不足44，interaction FAIL；需逐控件修复和原生命中。
- DIR-E3-CONTROL：仅文字控制模块ReaderBookmarkRow.motionBody 1.1/1.07及controlHeader1.1上限，adaptation FAIL；完整text目录legacyBody的E3仍NOT_RUN，不连带归因。
- DIR-SELECTION-GRAMMAR：漫画换源即时点行/Back与现有SelectionPage Contextual-only语法有冲突，header FAIL；需独立决定模型是否增加直接选择变体，不能为过门禁改业务或伪报browse。
- DOWNLOAD-B3：book筛选空有，但无一键清全部筛选，query FAIL；逐项all/清搜索不伪称统一重置。
- DOWNLOAD-STORAGE-BINDING：两个存储InlineSelect只写draft，Host.configureStorage保留API可解析但当前UI无派发（源码确认，未设备复现）；operation partial，不能宣称设置已保存。

上述记录owner分别为现有ReaderControl/Directory、SharedDownloadPage/Host维护者；复审触发为对应源码/模型修复或原生授权，退出标准为定向行为及适用层证据，不使用空补偿例外。B4与D4/S8仍等待各自裁决；本批未改Index/生产/版本/字体、未构建或占用设备。Stage 6尚未开始。

### 14.17 B4裁决：诊断动作独立准入（2026-11-03，执行前登记）

用户选择“允许只读检测，单独定义准入规则”。落实为诊断意图独立于书源写操作准入：当前挂载、当前presentation、当前sourceId仍存在且未checking时允许；原写操作blocked/unknown不参与此诊断按钮禁用。检查当前实体而非旧row快照，拒绝卸载/旧presentation/已删除实体/检测中回调；不新增并发通道或越过Core事务门禁。既有Index/Host presentation守卫与Orchestrator checkingSourceIds/same operationChain继续归原owner，不改Index/Core。

“只读”只限不改书源配置、不确认或重放原写操作。现有source.check.run默认search/L1,L2/180000ms，会写诊断历史及阅读流水线的书籍/目录/章节缓存，Core明确列为durable storage mutation；不能称零持久化。实际TRANSACTION_PENDING/网络/持久化失败仍由既有检测链呈现，不得因UI允许准入改写原未知回执。完整sourceVersion变化后的异步结果隔离未覆盖，B4整页不据此直接PASS。

生产白名单仅SourceManagementPage.detectButton及独立sourceDetectEnabled方法；测试仅test-source-management-contract的action-admission case；control registry中source-detect状态/来源/准入说明；source页面登记、目标inventory和必要的新SDK布局报告；长期契约/本方案与新artifact。control revision变更只同步全部登记主体消费修订，不改变目录/下载事实或生产。旧Stage 5/P0归档与final回执完整保留，新baseline已固定当前source `818a4584…`、Source revision9/control5及测试/报告字节。消息方法、文字、入口/生命周期均不变，不跑消息全树或无关业务case。

| 精确入口 | 本次不可省略的依据/范围 |
|---|---|
| node tools/test-source-management-contract.mjs --case action-admission | 真实SDK按钮/开关准入：blocked/unknown允许诊断；检测中/卸载/旧presentation/实体删除拒绝，写开关既有禁用不放宽 |
| node tools/test-source-management-layout.mjs --case matrix --write-evidence | 原布局报告绑定整页SHA，生产callback改变后不能直接改旧报告输入指纹；重新生成32/40/24的局部SDK报告，仍不关闭E2/E3 |
| node tools/page-structure/test-source-interaction-inventory.mjs --case inventory | 本批新增ForEach身份宿主，检查row-detect可达装配/源符号与准入说明，其他sdk/recovery-targets场景不因本次变化重跑 |
| node tools/page-structure/validate-model.mjs / check-contract-refs.mjs / check-register.mjs | 检查真实新source/report、控制/消费修订及已知FAIL；不运行55case或其他页面测试 |

D4用户本轮只要求解释，尚未裁决；四个本地查询/筛选状态与滚动恢复均不在此代码批次。无构建/签名/安装/设备操作。

### 14.18 D4裁决：书源与工具往返保留四项筛选（2026-11-03，执行前登记）

用户随后明确选择“保留”。本批仅将书源页searchQuery/status/category/group这四项视图条件交给Index持有；Source→Tools→Back在同一Runtime owner下恢复，其他入口fresh open Source仍用默认值。恢复时基于最新sources重新投影，不缓存旧列表或操作结果。滚动锚点/位置恢复及Tools普通草稿NAV-08另列，不因这四项实现假关整条S8。

生产范围：Index.ets、SourceManagementPage.ets（由组件批次接initialFilters/onFiltersChange）与既有SourceManagementPresentation.ts的薄状态适配。旧SourceManagementViewState是保留分支，kind/groupId语义不等于当前实际category/group名，不能硬复用导致music/download/external/other丢失或把缺失分组放宽成全部。新增当前生产FilterState只复制/规范化4状态与全部7分类，保留搜索原文和分组名；不是新过滤/查询引擎。Index接收回调核对generation、Runtime owner、mount、SourceHost与presentation lease，旧页不能发布到后继。来源搜索页的returnTarget/searchKeyword保持独立语义。

SourcePage新增`initialFilters: SourceManagementFilterState`与`onFiltersChange`。`restoreInitialFilters()`仅aboutToAppear恢复一次，外部prop更新不覆盖正在输入；`rebuildSourceProjection()`继续按当前sources执行原过滤，末尾`publishFilters()`只在mounted且temporaryBackIdentity有效时发布四字段clone。组名已不存在也保留该条件并得到0结果，不擅自切回全部；清除筛选沿用原clearFilters并同步owner。新增测试会调用这些实际方法，不重写过滤实现。

准确验证，仅在Source props定稿后执行：

| 入口 | 实际触发/必要依据 |
|---|---|
| node tools/test-source-filter-retention.mjs --case filter-roundtrip | 新增局部消费者：实际Index方法及SDK Builder传参，四条件往返、fresh重置、最新sources回算、缺失group保持0结果、所有分类、旧generation/owner/mount/lease发布拒绝；不运行设备/滚动 |
| node tools/test-source-index-presentation-consumers.mjs | 文件本身仅11个Source→Index相关场景，无其他父套件；新增props helper需真实依赖注入，复验其当前/旧物理动作、未知回执、late picker/回程未被状态接线破坏 |

不运行其他全量测试、不构建/签名/安装/设备。根登记/路由证据在Index与Source合并定稿后另统一更新，旧冻结manifest不覆写。

14.18组件接线补充：SourcePage.restoreInitialFilters在aboutToAppear首次投影前恢复；publishFilters从现有rebuildSourceProjection发布四字符串快照，只有mounted且当前temporaryBackIdentity有效时可发布。Index再核原presentation；不把初始空投影或旧页卸载当新筛选。原filter-projection方法probe必须提取新增实际publish方法，不伪造stub。最终准确入口追加`node tools/test-source-management-contract.mjs --case action-admission,filter-projection`，核对D4新挂载/发布接线与B4准入共存；由于整页SHA再次变化，按14.17的相同matrix入口重新生成最终报告，而不是直接改B4旧报告指纹。Source→Index两项定向测试由同一组件定稿后执行，不重复设备或其他用例。

14.18取证副作用定位：inventory入口尾部无条件写入已冻结Stage 4 followup/source-interaction-evidence.json，会覆盖旧回执。执行前白名单补test-source-interaction-inventory.mjs，仅增加显式`--evidence-path`（限定新repo artifact路径）；默认不写报告，不变断言或选定case。当前准确入口改为`node tools/page-structure/test-source-interaction-inventory.mjs --case inventory --evidence-path=.reader-artifacts/page-structure-b4-20261103/inventory-final.json`；没有执行会覆写旧文件的原入口。

14.18首轮验证记录：新filter-roundtrip在有限SourceChild捕获器遗漏owner/id，SDK ViewPU.create无法保存子实例；生产Index尚未触发断言失败，修局部捕获器字段，不改SDK runtime。既有11消费者因B4新增真实sourceDetectEnabled方法未被选入SDK probe而失败，补该实际方法名，保留现成sources/mounted/temporaryBackIdentity输入及所有业务断言。两份attempt1原始日志保留在`.reader-artifacts/source-filter-retention-20261103/`，仅修后重跑这两个准确入口。

#### 14.18 定向结果（Index/Source四项筛选）

新`filter-roundtrip`修后PASS/exit0：实际Index导航方法与SDK Source initializer传参、实际Source restore/publish/投影/清除方法，覆盖同owner往返四条件、fresh入口默认、7分类/4状态、旧数据不缓存、缺失分组保持0结果、payload clone、旧generation/mount/runtime/host/lease/identity/retired回调拒绝、卸载页不发布。原搜索页关键词与returnTarget保持独立。`test-source-index-presentation-consumers.mjs`修后11场景PASS/exit0，未放宽原业务/回执/身份断言；retained statusBanner注入仍不证明当前UI挂载，cold receipt边界照旧。

基线：Index旧字节从Stage5冻结archive提取（SHA `1eb5eaa0…`），Presentation旧字节从P0冻结archive提取（`ccd0e24c…`）；都未覆盖工作树，不用累计Git dirty diff当本批改动。既有11消费者测试未在改前独立冻结，不能伪造baseline；其本批仅补真实filter helper/Index方法/B4 detect方法依赖，原断言不变。新旧生产精确字节与bounded diff、两次原始日志及声明输入SHA在`.reader-artifacts/source-filter-retention-20261103/verification.json`；该清单是直接声明输入，不冒充完整SDK动态闭包。

本批实现不保存滚动、不开工具草稿策略，也不缓存源列表/操作结果。NAV-07四条件子项可记代码/SDK完成，滚动仍待补，NAV-08另列，不能据此宣称S8整条PASS。最终Source/Index/登记SHA由合并批次统一核验；无HAP、构建、签名、安装或设备操作。

14.18登记同步边界：NAV-07的四项查询/筛选已按用户裁决实现，但原nav.source.retention.scroll=true仍是未实现目标，本次不静默改false以换取S8 PASS；basis由target改mixed，knownGap只记录剩余边界。NAV-08和平台Back不动。navigation registry递增并同步所有登记消费修订；Index字节变化导致目录/下载已声明sourceInputs需复审摘要，已核精确baseline diff只涉及书源过滤快照接线，不重跑无关下载/目录SDK。tools/page-structure/stage5/是14.16作者输入快照，当前唯一active事实源是register.json，上述旧输入不当成第二套当前登记。

14.18框架复验首轮：schema PASS，refs/register额外报6个downloads上下文的navigation-registry输入摘要过期；这是本批nav.source修订后尚未同步其显式sourceInputs，非下载路由/生产变化。已保留refs/register-attempt1.json；核对nav.downloads条目未改后只刷新该已声明依赖SHA，保留其他FAIL，不改旧SDK/native回执。随后只重跑本批schema/refs/register三个准确入口。

#### 14.17–14.18 组件与登记最终闭环

用户裁决均已落实，无需再确认“工具页”：该页可见标题为“批量管理与书源工具”，由Source底部“批量管理”与页头工具入口打开。D4仅Source→该页→Back的四项搜索/状态/分类/分组，首次其他入口默认；不保存旧sources数据，也不自动承诺滚动或Tools草稿。B4诊断按独立方法准入，拒检测中/实体删除/卸载/旧presentation，允许原写blocked/unknown，底层缓存/事务权限保持。

最终生产范围恰为3文件：SourceManagementPage（诊断守卫、恢复/发布filters）、Index（same-owner四项快照与旧回调准入）、SourceManagementPresentation（适配现有实际字段的薄copy/default）。Index精确基线来自14.16冻结zip，差异只含两import、2私有字段、Source props、initial helper和fresh入口重置；不以累计dirty diff冒充本批。未改Host/Orchestrator/Core、其他页面、业务写入或版本。

| 当前准确验证 | 结果 | 证明边界 |
|---|---|---|
| action-admission + filter-projection | 2/2 PASS | 当前Source SDK按钮与真实方法，含诊断例外/旧身份/旧实体拒绝及原筛选语义 |
| matrix --write-evidence | PASS，32行/40目标/24预算 | 当前Source SHA局部SDK布局报告；B4旧报告另冻结，不重签旧输入 |
| inventory（显式新evidence-path） | PASS，34模板 | 可达组件/源声明与引用；records为空，不伪称重跑sdk-targets/native |
| filter-roundtrip | PASS | 四条件/7分类/4状态、新数据回算、缺失group不放宽、fresh重置、7类旧owner路径拒绝 |
| Source→Index原消费者 | PASS，11场景 | 既有真实Host/Gateway/共享runtime接线与局部SDK动作，不是设备或cold Core回执 |
| validate-model / check-contract-refs | PASS | 当前schema/控件/导航/源码摘要可解析；首轮遗漏nav摘要失败已保留 |
| check-register | FAIL，如实保留 | 仍31 FAIL诊断/11 NOT_RUN诊断/342 manual；无INPUT/源码或布局报告漂移 |

当前Source revision11、control6（仍88项）、navigation2；目录/下载及其变体revision3只同步消费修订与已审输入，不新增页面生产改动。Source仍4PASS/4FAIL/8NOT_RUN；S8保留scroll目标未实现的FAIL，E2/E3仍FAIL，B4整体NOT_RUN（缺完整实体版本结果隔离），未用空例外关闭。NAV-08与平台Back未动；消息入口/文字/生命周期未变，不追加全树扫描。旧消息201/201只保留原入口一致性边界。

产物证据：B4历史SDK切片位于`.reader-artifacts/page-structure-b4-20261103/sdk-receipt.json`；D4定向回执位于`.reader-artifacts/source-filter-retention-20261103/verification.json`，最终组合输入/报告另存该目录`final-verification.json`。前两批probe失败/框架摘要失败与修复均保留，没有删断言或放宽SDK。当前仍未构建、签名、安装、调用HDC或操作设备；滚动、原生字形/系统字号、触摸/焦点、读屏、消息/操作生命周期与用户验收均未完成。

### 执行补充：下载页剩余代码闭环（2026-11-03，执行前登记）

用户要求全部完成。本分项只处理下载页已登记B3、存储设置意图未接线及页内E2目标/父预算缺口，不改D3常态List/管理固定+短高入流、不改Core/Index/版本/字体或共享组件。当前SharedDownloadPage/Host与两个准确测试、消息登记原字节已保存到`.reader-artifacts/download-closure-20261103/baseline/`，不以累计git diff当本批。

生产首选仅SharedDownloadPage：复用现有filterDownloadBooks/ReaderPageState提供一键清query/type/state/source（排序保留），重算最新books并清掉不再适用的选择；复用既有configureStorage/onIntent→Host操作发送存储设置，不造新的存储队列。动作核对当前presentation/当前sheet；底层回执与事务继续归Host/Runtime。页内小于44的明确目标保留图标/checkbox视觉，补不重叠的真实父预算/响应区域，直接文本动作补语义；未证明原生命中仍保持OPEN。

准确门禁（本分项显式执行，无全量/构建/设备）：

| 入口 | 作用与不可省略理由 |
|---|---|
| node tools/test-shared-download-visual-contract.mjs --case filter-reset,inline-settings,touch-targets | 新增B3实际空态入口/清四过滤及旧presentation拒绝；实际共享InlineSelect提交两字段与旧sheet/旧presentation拒绝；实际SDK页内44目标和父预算。只为本次新增/修改路径 |
| node tools/test-shared-download-visual-contract.mjs --case list-layout | 页内目标增高会影响管理fixed/inflow最低内容预算，必须复核D3边界；不重跑其余未变case |
| node tools/test-shared-download-ui-sdk.mjs --case page-assembly | 本次修改ArkUI Builder和ReaderPageState props，需真实SDK initializer/lowering，不代表全语义编译或HAP |
| node tools/check-message-entrypoints.mjs --check --file entry/src/main/ets/features/downloads/SharedDownloadPage.ets | 仅新空态动作与该现有PageState入口；消息分类/宿主/退役说明按FRAMEWORK复用，禁止新增Toast/Alert |

未变的Host/存储事务已有关联源码，除非发现接口不足不改Host；现有其他SDK通过项复用，不扩为字体/原生/全树消息。失败先留log并修本地原因，不放宽断言。

### 14.19 全部剩余项执行（2026-11-03，执行前登记）

用户要求全部完成。保持既有D1入口、D3常态List、B4独立诊断与D4保留四条件；不以更改目标或空例外消除FAIL。代码分为下载、目录、Source owner与root装配四个互斥范围；各分项独立冻结/定向验证，最终统一重绑主登记/上游修订和原生候选。阶段6受v0.2范围限制：清理本批Source死statusBanner/originalActionGeneration及其保留消息/测试依赖，不无边界改全应用外观。

root范围：SourceManagementPage/Presentation/Index滚动快照，模型/封闭schema/推导中直接单选装配规则，dead builder及相关准确消费者适配，最终登记/证据和构建取证。滚动只同Runtime的Source→Tools→Back：原生Scroller首个可见sourceId+项内位置，记录filter/layout身份，数据变化按当前id定位，删除时相邻序位fallback；字体/宽度变化放弃旧项内像素，用户触摸/筛选改变/旧presentation退役后不再回拉。复用ArkUI原生scrollToIndex/getItemRect/scrollBy与既有postFrame模式，不另写滚动引擎。fresh进入默认顶部，不保存旧业务行。

直接单选模型需表达真实漫画换源即时点行/Back，无确认页脚；将SelectionPage区分single+perItem与multi/global，不把实际页面伪报browse或改变用户旅程，非法组合仍拒绝。新增具名精确fixtures保护多选原规则不被放宽。

root精确验证计划：`test-source-filter-retention --case filter-roundtrip,scroll-roundtrip`（实际Index/Source方法与有限SDK滚动port，边界不作native）；`test-source-index-presentation-consumers.mjs`文件自身11场景（dead statusBanner改为真实挂载originalRecovery/ReaderRecoveryAction，不再注入死UI）；`test-source-management-contract --case action-admission,filter-projection,footer-geometry`；`test-source-management-layout --case matrix --write-evidence`（最终三方生产稳定后一次）；`test-page-selection-grammar --case direct-selection`；schema/refs/register以及必要selected消息检查（删除真实dead retained入口需更新scope，不全树）。新问题先保存失败并源码定位，不扩大用例。不同子批共享输入变化后只补实际受影响项。

构建采用既有iteration/signed pipeline、contracts none，不清理dirty WIP。先做代码侧修复与候选准备，真实系统字号/字形/命中/焦点只使用已存在模拟器，保数据，不重置/卸载；具体设备安装/交互仍按原生计划授权边界独立记账，用户验收不由agent代签。未执行证据不伪PASS。

### 14.19-SOURCE 检测身份与工具草稿保留（2026-11-03，执行前登记）

本分项归属source owner，不改Index/SourceManagementPage/Presentation或主register。先核当前源码：SourceToolsOrchestrator.open已有initialized分支保留普通editor/selection/check settings/results并只刷新库事实，不能把历史“NAV-08必重置”当当前事实再重写。需要补当前保留证据，并阻止保留的旧JSON覆盖后来启停/删除/改规则。

白名单：SourceOrchestrator.ets（捕获检测实体/版本及当次任务身份，旧queue/result/error/finally拒绝污染后继）、SourceGateway.ts（复用source.list读定义快照，check RPC加既有canDispatch/canContinue，编辑load/save前后基线校对）、SourceToolsOrchestrator只在定向证明显示必要时改；新tools/test-source-owner-retention.mjs。消息事实继续由现有Tools状态/反馈入口展示，不新增Toast/Alert或外框；已读消息框架。Current sources/rule version未确认时不得把旧检查当新版本成功；诊断仍走既有串行链/单飞/Core事务门禁，不确认或重放原写。

新编辑基线仅保存在Gateway同Runtime内，比较sourceId/可用sourceVersion/启用字段及完整原始JSON；Core source.import当前没有expectedVersion/CAS参数（只复用现有协议）。因此这是阻止已观察到的stale draft、已删除/disable覆盖的准入校对，不宣称读取与import之间原子CAS或对外部并发写实现序列化；该并发边界须单独保留，不能虚构新协议。

精确门禁：`node tools/test-source-owner-retention.mjs --case check-identity,tools-retention,editor-conflict`，仅真实SourceHost/Orchestrator/Gateway/Tools方法+有限RPC port，覆盖当前检测/单飞/排队前后规则变化/删除/旧session、普通草稿/选择/检查设置与结果往返、确认/未知回执、旧编辑对新定义/启停/删除未派发；无Core进程/构建/网络/设备。另`node tools/test-source-management-contract.mjs --case login-session`：同一capture守卫会经过登录后检测，必须保持当前session登录一次与旧resolve/reject拒绝，其他case不因改owner重跑。实际原字节已固定在`.reader-artifacts/source-owner-completion-20261103/baseline/`，不用累计dirty diff；失败先保留并定位，当前生产范围外的测试/设备不自动触发。

### 14.20 目录四宿主目标与字体预算补齐（2026-11-03，执行前登记）

用户要求继续全部完成。目录批次先修源码已确认问题：控制目录父ListItem32→40小于子行44；bookmark motion 1.1/1.07上限与父card/虚拟extent未增长；控制header1.1上限/40×26收起目标；所有实际readerDirectory查询输入32/24与父行预算，漫画定位缺button角色/最小命中。保持默认文字/图标/色与既有motion唯一时钟，字体增长用当前系统scale并同步真实父预算，固定/入流和即时选择业务不改。不用更小字体/相邻重叠responseRegion或伪原生验收换绿。

白名单：ReaderControlBookmarkGeometry、ReaderBookmarkRow/List、ReaderControlDirectoryContent、ReaderControlPanel/HeaderGeometry、ReaderDirectoryToolbar、FullDirectoryPanel、ReaderPanelChrome、BookDirectoryPage；根agent已授权共享ReaderSearchField仅readerDirectory分支的必要真实44/字体预算，sourceManagement/rss/其他分支行为保持。测试仅上述直接消费者必要probe依赖和新directory预算定向入口。当前字节已逐项冻结于directory-structure-completion-20261103/baseline，不使用累计dirty diff。主register/control/nav由根agent统一，不在本批并行编辑。

| 准确入口 | 风险与本次必要性 |
|---|---|
| node tools/test-directory-structure-budgets.mjs --case scale-targets | 新真实SDK叶/父预算在320/366×1/1.3/1.6/2，确认章行/书签/查询/收起/定位目标，不证明native hit/glyph |
| node tools/test-reader-control-directory-content.mjs --case current-row-hit,current-toolbar | 当前控制父/子Row与查询Toolbar实际consumer，替换已确认32/40父clip事实，保留动作回执与原几何来源 |
| node tools/test-reader-control-bookmark-content.mjs --case row-geometry,list-extent,row-scope | 书签几何默认源轨迹、真实extent与旧生命周期、业务位置scope；增大字号预算不能破坏原锚点 |
| node tools/test-reader-control-header-content.mjs | 本文件仅七模块共享header源轨迹/SDK，directory条件适配不能改变其他六模块 |
| node tools/test-manga-book-directory-chrome.mjs --case chrome-current,adaptive-footer | 当前manga toolbar/定位target父预算变化，与D3无关；保留该页已有fixed/inflow footer契约 |

执行只选择以上与实际改动一致的入口；需改caller或失真probe先记录原因，不增加全树/全量/设备。消息文字/宿主和业务owner未变，accessibility名称/角色不新建消息出口。构建、签名、安装、设备仍由根agent协调。

14.19 root首轮scroll fixture：filter-roundtrip已PASS，scroll-roundtrip在selectedProductionClasses拒绝extends时初始化失败（既有helper刻意只支持simple class）。保留source-scroll-attempt1.log；不放宽通用helper，局部fixture改用官方SDK AST选取实际FrameCallback子类声明，再注入有限FrameCallback原生port，仅重跑scroll-roundtrip。

下载分项补充：存储selector回调同时核对当前option label与index，防止外部policy更新后把旧custom option索引解释成新容量；重复/无效值不派发写。configurePolicy已由既有SharedDownloadStorageGateway.serialized持有，Index既有markDownloadIntentPending处理原Host回执与刷新；本批没有第二个队列或页面成功推断。选择器本身保留settings面板，两个字段提交的是当时最新完整pair。

14.19-SOURCE补充定位：工具批量检查当前已使用isAcceptedCheckSession/isBatchCheckCurrent，普通离页不停止任务；前述历史风险只纳入定向证明，不改已正确逻辑。新增必要生产范围SourceToolsPage.editorCard/既有canWriteSources，只同步原owner的busy/unknown/confirmed-readback未决编辑准入；否则原控件看似可编辑，但owner可能忽略输入，或confirmed后重按保存把原事实覆盖。错误仍走现有SourceTools状态/feedback，不改消息登记family/ID。SourceToolsPage原字节另存baseline，editor-conflict增加真实SDK参数/owner拒绝证据。

14.19候选构建准备：只核当前Native/SDK与Core内容配对这一打包硬条件，使用pipeline导出的requireAcceptanceInputs解析实际缓存路径，再调用同一generate-build-provenance-manifest.mjs --preflight --allow-dirty。不会调用preflightIdeNative（该入口可自动重建Native），不跑Core测试或隐式构建；先保留失败以决定规范Native生成是否必要。私有签名只确认文件存在/0600，材料内容不打印或归档。生产尚在合入时不建HAP；最终稳定后只运行pipeline iteration、contracts none、指定签名体系。

下载目标精度补充：44最低框只应用真实可交互book主列表目标；章节页secondary书籍摘要继续保持原非交互密度，source/count是TEXT语义。管理态章节标题也为TEXT，不把guard内no-op假登记成按钮；浏览态标题才是阅读动作。checkbox保留17视觉、44实际父槽与44响应区，more的响应坐标跟真实44框重新居中，避免沿用旧小框负坐标相互覆盖。章节标题/当前阅读标记允许换行，最低有效任务预算同步。此为新属性修正，最终重跑本批相同4case与assembly/selected消息，上一通过回执另名保留。

14.19-SOURCE首次定向：check-identity/tools-retention已PASS；editor-conflict的owner成功/冲突/确认/未知分支已到达，SDK参数段失败于局部probe未将ReaderFormField声明传入childSources，不能称生产ArkUI语法回归。保留owner-attempt1.log，修新test局部composer hook，不改SDK/生产/断言；只重跑editor-conflict未完成case，已过两case保留复用。

14.20第一次预算入口未进入断言：Node直接加载ReaderSurfaceResolvers.ts遇到其工程extensionless ReaderWindowMetrics import；不是生产回归。改为现有SDK pureModuleProbe提取实际resolver函数（不复制公式/不改生产imports），保留budget-attempt1。相同必要helper依赖在当前目录/漫画消费者probe显式注入，随后仅重跑本批入口。

14.19 dead-builder消费者首轮失败：confirmed写入但读回失败时当前UI是sourceList内“刷新列表”，不是pendingOverlay；旧statusBanner把两类恢复混在同按钮，删除后需按真实事实选当前宿主。保留source-consumer-attempt1.log，不重新挂死builder；局部SDK fixture将加载真实sourceList/ReaderRecoveryAction或pendingOverlay/ReaderRecoveryNotice，并对无关搜索/行仅注入有限绘制port，原Host/Gateway与回执断言保持。此为修正原消费者证据边界，不改生产恢复路径。

下载分项最终结果：生产仅SharedDownloadPage，SHA `f13e5f58ce7058b247facb2d015600e74355b2fd45fbc753c23f12fa057ceceb`；Host保持baseline原字节。filter-reset/inline-settings/touch-targets/list-layout四case同进程PASS，8宽度/字号上下文的明确目标及64个D3结构上下文均通过；page-assembly PASS（真实SDK initializer/lowering，非全语义/HAP）；下载selected消息7/7、0failures。首次三个case即通过，随后只因新增label/index安全校验与角色/secondary密度精度修正而重验同一必要集合，旧通过回执另名保留，没有删除失败或放宽断言。

B3代码闭环：筛选为空提供“清除筛选”，只清query/type/state/source、保留排序，清旧选择并将列表offset归0；重新使用当前books，旧呈现不能清后继视图。存储绑定代码闭环：两个共享InlineSelect提交当时完整pair到既有configureStorage意图→Index既有Host/Runtime路径，面板保持可继续设置另一项；无效/未变/旧sheet/旧presentation/被替换custom选项不写。Runtime既有StorageGateway.serialized拥有持久化与维护，页面没有第二个队列或本地成功推断。

E2选定代码缺口已修：交互tab/title/source/count/chapter/group至少44；checkbox保留17视觉并由44真实槽/44响应区承载；more真实框44且响应坐标随真实框居中；选项内Radio不再拥有第二个回调/焦点。章节标记换行及管理最低内容预算同步，secondary摘要不人为增高。此结果仍不是整页原生命中、字体/读屏/焦点PASS，不擅自关闭E2/E3。当前SDK证明记录在`.reader-artifacts/download-closure-20261103/verification.json`（SHA `5e6ecbfa…`）；原字节、精确diff、17个直接/审读输入快照与raw日志同目录。登记更新建议为`register-updates.json`，交由主任务统一修改control/register；消息文件写权限已交还root，root的statusBanner retained-scope删除保持。

14.20第二次预算入口到SDK父装配后失败：probe直接调用build，但官方SDK已将组件build降为initialRender；改为实际lowered入口，不调整生产/尺寸断言，原budget-attempt2保留。

14.20第三次预算入口为局部fixture遗漏Toolbar常量；使用selectedProductionValues读取当前READER_DIRECTORY_TOOLBAR_HEIGHT，而不是复制50常量，补齐真实依赖并保留原失败。

14.19-SOURCE异常分支补全：不仅resolve，检测reject/登录取消也先核当前完整定义；版本变化后旧错误不投影到替代书源。定义核对本身不可用时清除busy为unchecked，不伪报当前规则通过或失败。新增Core变化后reject负例；Map迭代改为typed forEach避免ArkTS解构约束，故只重跑受影响check-identity及login-session。Tools两项已过代码未变，按范围复用。

14.20第四次预算已到1.6×书签分行，但该有限SDK recorder不提供parentId；两个undefined不能证明分行。改为断言实际独立metadata Row的坐标/最小高度，以及四个文本各出现一次；该分支删除或回到同一标题Row会失败。不宣称原生父子/命中已证，原失败日志保留。另查询TextInput仅readerDirectory显式随系统maxFontScale，防止原生默认上限与父预算不一致，其他variant不增加字体setter。

14.20完整文字目录预算核对补充：实际tabs=45、query=51、目录footer=48，旧heights扣143少1；bookmarks实际45+51，旧扣93少3。新44收起header与放大query均由同一body扣除，另修1/3vp超额；新预算case读取实际heights并核各真实槽位之和≤body，不靠裁切。完整text的书签仍走legacyBody，不归因为motion caps；本批只同步其真实字体/虚拟extent增长。

14.20当前control-row/toolbar两个case已PASS。旧bookmark row-geometry入口首次在既有ReaderActionAccessibility/readerActionTouchRegion缺依赖处失败（baseline已有调用，不归因为本批）；probe改为SDK pureModuleProbe加载当前真实公共可访问函数/类，保留原scope/原轨迹/负例断言，不用stub。首次日志保留。

14.19-SOURCE执行版本补充：SourceCheckRunParams同样没有expectedSourceVersion字段；可用结构化report.ruleDigest必须与捕获定义sourceVersion一致，否则结果归unchecked，不能把中间版本执行结果印在当前版本。新增实际owner的typed report边界负例；无report/版本的旧Core仍只具前后完整定义读边界，不宣称该旧协议有服务端CAS/实体世代。当前已读代码事实与设备配套Core能力仍须分层。

14.20header/manga首轮失败归因：旧header probe未给ReaderPanelCollapseButton登记真实child Props，新增合法props被SDK当未知component拒绝；补真实child source的有限initializer capture（实际叶目标已由新budget case另证），不放宽SDK诊断。旧manga fieldNames还选择已不存在的isTablet，删失效提取名并保留现有尺寸/动作断言。两条原log保留，未更改生产迁就。

### Native前置差异只读定位补充（2026-11-03）

默认Core target/harmony-napi缓存是混配输入：snapshot已为当前4a52内容，但SO/package/evidence仍be87/ed0旧配套，故首轮native-preflight失败；不更新SHA伪造证据。已有不可变成功provenance指向`.reader-local/storage-compatibility-20261030/native-archive-4a52/`现成producer输入，原snapshot/identity/evidence/package manifest/07e9 SO与原SHA逐项相同，package8项全部字节匹配，Host SO及vendor companion同配套。无需重编或sync-native。

本分项只运行root已审native-preflight.mjs的精确复制（仅output改native-preflight-current.json），显式CARGO_TARGET_DIR指该archive供nativeInputPaths读取，再调用既有generate-build-provenance-manifest --preflight校当前Core fingerprint、Git身份、Native/SDK与storage companion/bootstrap；不运行preflightIdeNative、不触发Cargo/CMake/Hvigor/签名/设备。该archive仅做既有producer输入读取，绝不作为Cargo编译输出目录；实际HAP构建由root在生产稳定后另按canonical pipeline执行。首轮失败日志保持，新结果单独保存。

14.19消费者SDK定位：sourceList首个ListItem使用官方SDK生成的deepRenderFunction，有限native port只登记factory、不自动挂载，所以首轮actors没有共享恢复控件。已保存source-list-lowered.txt；fixture仅在该准确ListItem显式调用SDK原factory并提供ViewStackProcessor有限port，不修改通用runtime、不伪造恢复组件。confirmed-readback与unknown仍各自走真实当前宿主，原写入不得重发的断言不变。

14.19-SOURCE返回新事实补充：已选实体在Tools离页期间被删除时，reloadManagement保留草稿/检查设置与结果，但移除不存在的selectedSourceIds并同步selectedSourceCount，避免幽灵选择计数；未改变实体仍保留选择，未保存JSON不丢。tools-retention新增该分支，只重跑这一实际受影响case；editor save/readonly分支未变，其已有结果保留复用。

14.20bookmark第二轮到原先excerpt.height断言时失败：当前生产从基线就用constraintSize.minHeight，原probe却读未设置height。改为断言实际minHeight，并仍以独立几何轨迹/父card边界和固定高度负例验证，不把SDK min当字形实测。manga第二轮转到PageBackBar旧child/schema失配：注册当前未执行的raised-surface分支真实Props，并选择当前panel/height方法，保留manga自身所有正反断言；不改公共页头生产。

#### 14.19-SOURCE结果

实际生产只改四文件：SourceOrchestrator（检测捕获token、实体/版本与完整定义前后读边界、旧reject/finally隔离、report digest核对）、SourceGateway（最终dispatch/continue守卫、单编辑定义基线与stale保存拒绝）、SourceToolsOrchestrator（confirmed/unknown编辑保存准入及返回新数据删除幽灵选择）、SourceToolsPage（同owner readonly投影）。SourceHost、Tools.open普通保留/批量任务离页存活逻辑原本已正确，未为历史结论重复改写。没有改Core、Index或SourceManagementPage。

定向结果：check-identity PASS（当前/单飞、前后版本及原始规则变化/删除、旧reject、排队替代与旧finally、readiness后退役不派发、typed report digest不匹配）；tools-retention PASS（普通草稿/选择/设置/结果往返、当前数据刷新、删除实体只退休选择不丢草稿、离页任务继续、显式停止、新Runtime默认）；editor-conflict PASS（不变可保存，规则/enable/delete冲突零import，确认后读回失败/未知事实不可被再保存或编辑覆盖，真实SDK输入只读参数）；login-session PASS（当前一次与旧resolve/reject隔离）。editor SDK首轮漏childSources失败原样保留，修局部test hook后仅重跑未完成项；新改异常/Map/选择分支只重跑实际受影响case，其他按未变分支复用，不补全量。

SourceOrchestrator SHA `929e864f…`、Gateway `93dbc4d7…`、ToolsOrchestrator `f236ebc7…`、ToolsPage `75ea774e…`。完整输入/日志/精确before-after diff位于`.reader-artifacts/source-owner-completion-20261103/`。没有更改消息family/ID或新增出口，新冲突原因复用已登记SourceTools状态/反馈owner；无需改另一任务正在维护的message-entrypoints。

边界：Core source.import和source.check.run均无expected-version入参。现有Host守卫证明已观察到的定义/删除漂移不写入/投影、当前结构化report digest匹配，不是跨进程原子CAS。无report/版本的旧Core只有前后定义读边界，不宣称服务端实体世代；当前配套Native能力须另核。未运行Core、构建、HAP、签名、安装或设备/原生/读屏验证。

14.20追加完整text顶栏：进一步源码定位ReaderFullDirectory书名/章名/换源文字固定22/17/15高，header54且measure key仅top；control/menu真实42和more34虽外扩44，但自身/相邻预算不足。该实际宿主加入本批白名单并先冻结原字节：按系统scale增长文字/真实父header，control/menu至少44，menu宽高与锚点一起增长，header回执核当前metrics revision、缓存key含width/scale/top。新budget case额外核实际topBar控件/文本/测量key与过期回执边界。仅a11y/预算，不改书源选择、离线业务或消息出口。

14.20漫画consumer进一步适配按根agent要求继续：旧case选择public variant/headerKind而当前唯一事实为frameStyle/geometry；补当前mangaContent/Header/Footer/geometry/scrollLayout实际方法与真实公共函数，不重写Scaffold。原fixed/inflow、实测delta、唯一footer、全viewport、Insets、fallback signed offset和源mutant意图保留；mutant替换点更新为当前赋值语法并仍要求非空变更。未因旧probe改生产页面框架。

14.20漫画当前Scaffold接线第四轮已进入真实PageBackBar.panel，缺既有readerSurfaceElevation公共依赖；补当前readerSurfaceSpecsForProbe(metrics)实际函数，不伪造shadow或改页头生产。继续保留原失败并仅重跑两个consumer。

14.20漫画第五轮已通过当前Scaffold/Header/Toolbar装配并到真实输入点击，旧field probe遗漏changeText与mounted lifecycle。补生产changeText/aboutToAppear字段并在交互前执行真实出现方法，不直接绕过mounted守卫。原失败保留；没有修改输入提交/导航业务。

### 14.19-SOURCE-A11Y 当前表达与语义修复（2026-11-03，执行前登记）

在root新滚动/过滤/B4基础上逐项核当前Source页：metadata仍是10/12.5fp和TOK_MUTED；day实际117/111/105对Paper242/238/229，旧低对比需当前有限WCAG复核，不能照抄历史数字。全局TYPE_SOURCE_MANAGEMENT_META还被RSS/retained分组使用，本批不改全局role，而本页改引用既有TYPE_SOURCE_TOOLS_STATUS（Noto 12/18，normal weight400），统计行同样复用；layoutBudget从同一实际role取lineHeight并对title/category共行取max，避免只放大字不改预算。前景复用现有TOK_CONTROL_INK，不新增颜色或字体。

ReaderButton已有actionAccessibilityLabel与source-filter-option RADIO/selected，本页status/category却用普通source-management spec。白名单仅SourceManagementPage、ReaderButton新增默认false的显式selectionSemantic（仅本页status/category传true，沿既有Radio分支，无共享视觉变化）、对应定向测试。Toggle复用既有SWITCH/checked，仅本页名称加当前实体；检测/登录复用actionAccessibilityLabel暴露实体和busy/不可用，保留原准入与callback逻辑；装饰图隐藏，信息文本合并分组但不把行级操作隐藏。Back/工具/新增已有角色和名称，核声明而不扩共享外框。ReaderLabeledIconAction、ReaderSearchField、ReaderPanelChrome均不改。

精确门禁：新`node tools/test-source-expression-a11y.mjs --case source-semantics,contrast`覆盖实际SDK参数/ReaderButton默认和显式Radio分支、entity/busy/disabled、已有返回/工具名称、动态checked声明以及当前day/night色值。WCAG公式复用既有tools/evidence/night-colors-20261020/reading-manga-probe.mjs的rgb/luminance/contrast三个声明，selectedProductionValues抽取，不import其整套测试、不造生产颜色引擎。`node tools/test-source-management-typography.mjs --case metadata-carriers`验证改用角色的真实三个Text与role mutation；`node tools/test-source-management-contract.mjs --case action-admission,login-status`只核新a11y helper接线未放宽写/诊断准入；`node tools/test-source-management-layout.mjs --case matrix --write-evidence`因实际文字角色/预算与Source/ReaderButton SHA变化重生成局部SDK报告。无其他默认消费者套件/全量/构建/设备。当前原字节已保存新baseline；真实读屏、焦点、字形/字号与原生命中仍单列。

14.19 Stage6首批扩展选SourceTools：该页已是本轮实际修复/测试消费者，需完整登记其系统导出确认、删除确认和文件保存宿主，不能把两个nativeAlert使用点隐为一个操作。schema已允许多个host ref，checker的brief.platformSet应比较hostId集合而非多重列表；最小修复并扩`node tools/page-structure/test-stage5-register.mjs --case host-variants`真实正反fixture，不放宽host引用/身份/operation owner要求。其他v0.2外页面先做实际挂载清单，后续扩展仍遵守每批16层/引用门禁，不为填满清单造半张表。

14.20完整header预算新测量回执probe：共享builder工具会自动保留ReaderPageScaffold真实slot生产builder，故即便finite initializer不执行目录内容，仍需FullDirectoryPanel/RecoverySurface真实Props登记。补真实child源而不删除自动保留/不改SDK；只验证header数字revision回执，不宣称内容或消息已运行。

14.20漫画第六轮chrome-current及全部原负例PASS；adaptive真实谓词在当前3.2×footer预算下480vp已不属于flow，旧fixture把480标签硬当short。改用360vp/800vp两真实窗口分别验证flow/fixed，不从待测谓词推导期望，也不改生产阈值；继续原唯一footer/安全inset/offset负例。

14.20完整顶栏菜单a11y/准入同步：已有offlineBookOperationActive/offlineBlocked owner事实现在同时接入菜单enabled与可访问disabled，不仅顶栏入口禁用；旧菜单回调在busy/blocked/卸载后拒绝，使用既有业务owner，不新建操作事实。新budget case覆盖真实菜单目标/父高度及守卫，消息文本/类别不变。

14.20漫画第七轮flow/fixed均到真实native viewport断言；旧selector按zIndex0误选同zIndex的页面root（window clip=true）。改按当前TopStart内容host的真实结构区分root，继续断言该native viewport full-height/clip=false；不按期望clip值筛选，页脚cutoff负例仍须失败。

14.19-SOURCE-A11Y首次定向失败在新test直接调用SDK组件build：真实SDK已把它降为initialRender，并非生产字段/语法错误。保留semantics-attempt1.log，局部fixture改调用实际initialRender，不改生产/SDK/断言；本批尚无语义case通过，修后运行原两项。

14.19-SOURCE-A11Y第二轮：metadata-carriers、action-admission/login-status均PASS；selection语义case发现foundationControls固定成员清单尚未提取新增selectionSemantic，导致SDK actor里该值undefined，不能据此否定生产新Prop。白名单补tools/lib/reader-foundation-control-probe.mjs仅加入真实声明名，不改SDK/默认值或断言；原字节已存。复跑未完成语义/contrast，并按原计划生成当前17输入布局报告。

14.20第八轮定位：manga fixture仍给已删除的interactiveSafeInsets字段，当前ReaderWindowMetrics只从system/cutout/gesture/navigation读，导致safeBottom实际0、flow scroll tail0；现按真实ReaderInsetsVp写systemInsets，不改生产safe逻辑。新header菜单probe局部补Native Divider构造/颜色/stroke有限port并记录真实strokeWidth1（不改通用SDK helper，不模拟布局），实际menu父高仍由真实Text高度相加核对。

14.20漫画第九轮正例到真正Grid消费scrollLayout：旧grid提取集缺当前build使用的mangaColor。仅加入该真实方法；它使用当前mangaScheme/visual registry，不做颜色stub。flow安全区现在是真ReaderInsetsVp；继续验证Grid实际endOffset而非只看声明。

#### 14.19-SOURCE-A11Y结果

当前低对比已复现：TOK_MUTED对day纸面为4.28344:1；本页复用TOK_CONTROL_INK后纸面day8.03906/night12.75583，Card/Solid六组均>=4.5（最小8.03906）。metadata与统计复用现有12/18角色，布局title/category行取真实max并用同一meta role增长，未改全局10fp旧角色/其他页字号或添加颜色。Source status/category显式Radio/selected，普通primary动作默认仍BUTTON；登录/检测含实体及busy/不可用，Toggle实体+原checked，装饰图隐藏、信息单元分组，未改原Source滚动/过滤/准入。

source-semantics/contrast 2/2、metadata-carriers、action-admission/login-status 2/2、layout matrix32/40/24均PASS。两次新test局部接线失败（build已被SDK降为initialRender、基础probe未提取新Prop）原样留存，修局部composer/真实成员清单后通过，未改SDK/放宽断言。新增shared selectionSemantic默认false，仅Source两个筛选调用显式开启，Source-filter-option原Radio分支对照与默认BUTTON对照已执行；没有扩跑其他消费者。

SourcePage SHA fe71764c…、ReaderButton744d2e1d…、foundation probe3adf13a8…、当前layout report2b26bd95…；原字节/diff/输入及日志见`.reader-artifacts/source-expression-a11y-20261103/verification.json`。只证明SDK语义属性/当前生成角色对比度与局部布局预算，真实读屏/焦点/系统字号/字形/触摸仍未验收；未设备/构建。

14.20Grid路径静态复核后：当前build立即调用mangaGridLayoutOptions→prepareMangaGridProjection及start/end offsets、mangaColor；真实grid集合已覆盖。第十轮已经越过Grid到fallback producer，独立adaptive入口未先跑chrome，因此其未执行下载popup分支也缺SDK child Props登记；一次补齐该case所有实际child源（query、header、popup、footer、navigation、fallback），不依赖前case全局元数据。保留该次FAIL，不改通用probe或业务。行级LazyForEach在此仅为空native槽，原Grid endOffset消费断言与signed fallback负例继续。

14.20第十一轮adaptive所有布局/回执/offset正例到night尾部：旧fixture软表面硬码#30342D，而当前公共MangaDirectoryVisual soft角色为#3F433C。只验证实际Footer消耗公共soft角色（换成surface仍失败），不把旧无当前批准的色板重新当视觉验收，不修改任何生产颜色。已保留原失败，root视觉/native边界仍OPEN。

### 14.19-NATIVE-FIXTURE Source原生安全夹具（2026-11-03，执行前登记）

本分项只写可审阅代码/本地定向验证，不构建或操作设备。新增debug-only pages/ReaderPageStructureVerification.ets，main_pages登记，ReaderRendererPilot菜单仅DEBUG&&BUILD_MODE_NAME=debug时加router.pushUrl按钮；沿EntryAbility既有readerOpenSourcePilot=true精确debug冷启动gate，不改EntryAbility/Want协议，release进入新页即回Index且不得准备字体或挂Source actor。Root实际Source生产与ReaderButton保持本分项前字节，不借夹具替换生产字体或加外框。

只有prepareReaderFonts真实checked Promise成功且当前生命周期仍有效后才挂真实SourceManagementPage；菜单选default/empty/recovery/busy四场景。纯内存BookSource样本与现有纯projection helper；toggle/login/detect/add/tools/recovery等回调只记fixture hilog并改内存，不接Core/Host、Web、网络、文件选择器或用户书源。Source本身全屏独立宿主，诊断导航只在menu，Source Back先消费原temporary bridge再回menu，不画第二页头遮挡目标。宽度只约束真实外层320/366vp并实测Area，日志区分requested/actual；系统字体只读WindowCoordinator真实值，不注入fontScale/改AppStorage或替换字体。内存回执只能证明组件投影/原生操作意图，不能称原写入/ArkWeb/平台Back/业务owner通过。

白名单仅新页、RendererPilot新增入口、main_pages、新tools/test-page-structure-native-fixture.mjs与新artifact。ReaderRendererPilot/main_pages原字节已冻。精确门禁`node tools/test-page-structure-native-fixture.mjs --case admission,font-gate,source-callbacks`：实际方法+SDK initializer验证debug/release、真实字体await前不得挂actor/旧Promise不得进入后继、四场景回调纯内存/代际拒绝/临时Back先消费；有限平台端口不作native帧证明。另`node tools/test-reader-control-verification-launch.mjs --case admission,registration`仅核既有debug冷启入口不被新内部页面扩大；不跑ability/device或其他诊断套件。当前只先Source骨架，目录/下载后续由root协调。

14.20第十二轮adaptive所有正例PASS，旧“viewport cutoff”mutant写contentEndInset已只影响scroll而非native viewport，不能再当原生裁切负例；改当前contentNativeEndInset保留原意。静态复核其余mutant：增加独立行为断言“inflow footer原生高度变化不再增加tail，fixed恰好增加实测delta一次”，避免仅producer/helper自比较放过double-clearance；保留四个尾部/两个fallback等原风险，不弱化负例。

14.20adaptive独立入口第十三轮PASS，包含现有Scaffold/Geometry、true systemInsets、真实Grid endOffset及全部原语义负例。最后只按最初登记的双case同进程命令核对定稿脚本（独立adaptive已证不借前case schema）；其余已经通过的control/bookmark/header/budget不重复运行。
### 14.19-TOOLS-A11Y SourceTools 有限目标与父预算（2026-11-03，执行前登记）

本批只修改 SourceToolsPage.ets、ReaderControlSpecs.ets 两个仅 Tools 使用的按钮 spec、ReaderButton.ets 对新 Tools ID 的系统字号/自然最小高度 opt-in，以及定向 test-source-tools-typography-sdk.mjs。当前字节已冻结于 `.reader-artifacts/source-tools-accessibility-20261103/baseline/`，不以累计 dirty diff 认领前序 owner 修复。旧 source-action/source-compact 和 SourceManagement 分支原行为保留。

代码缺口是 30/42vp 实际按钮、58vp 固定书源行、横排四动作/四计数和小字 TOK_MUTED；按真实卡片宽度/系统字号为实体文字与动作预留预算，紧宽/大字切为上下两层，动作/计数有界换行，行与父 List 最小 extent 同步增长。复用既有文字 role 与 TOK_CONTROL_INK；选择/编辑/调试及编辑字段带实际实体标签。原 operation owner、editor unknown/confirmed 只读准入和导出确认身份全部保留；不改 Index/Core/Directory/SourceManagement、主 register/platform/nav/message 登记，不新增业务引擎、消息出口或外扩重叠命中区。检测关键词复用现成 44vp form-body。

仅执行 `node tools/test-source-tools-typography-sdk.mjs --case layout-matrix,entity-admission,legacy-isolation,guard-admission,input-selection`。前三项新增准确 case：320/366/720vp × 1/1.3/1.6/2/3.2× 的 SDK 实际组件/父 Builder、实体准入、旧 spec/SourceManagement 分支 before-byte 对照；后两项保护受影响编辑/选择消费者。沿用现有有限 platform ports，不改通用 SDK runtime，不调用 Core、HDC、构建或设备。失败先保留 log、定位后只复跑受影响 case。SDK 不证明原生字形、真实系统字号、读屏或命中，不用它关闭 E2/E3。完成提供 SHA、精确 diff、日志和 registry-updates 给 root。


#### 14.20 最终结果

目录12个生产文件已稳定，完整路径/最终SHA见`directory-structure-completion-20261103/production-inputs.json`。原字节、精确diff和失败均保留，不用累计dirty diff归因。已落实：真实query/排序/定位/collapse/完整header/menu目标与父预算；控制章行从父32→40改为真实≥44；motion/legacy书签随scale增长并在>1.3时分离元信息、同步虚拟extent；directory控制header去1.1硬限并用原空隙容纳透明44carrier；完整text顶栏随scale增长，缓存键含top/width/scale且只接当前metrics revision。章节/书签/下载/换源/即时选择仍由原owner处理，无新消息/存储/导航体系。

| 准确入口 | 当前结果 | 范围 |
|---|---|---|
| test-directory-structure-budgets --case scale-targets | PASS，8上下文 | 320/366×1/1.3/1.6/2实际SDKfield/toolbar/bookmark/collapse/full-header/menu与父预算；真实测量store旧revision拒绝；finite native端口，不证明字形/命中 |
| test-reader-control-directory-content --case current-row-hit,current-toolbar | 2/2 PASS | 当前父/子章行44一致、保留当前toolbar几何与回调 |
| test-reader-control-bookmark-content --case row-geometry,list-extent,row-scope | 3/3 PASS | 默认独立源轨迹、同Native虚拟extent、精确bookmark anchor/scope与旧生命周期拒绝 |
| test-reader-control-header-content | PASS，7模块 | directory新carrier默认图文位置与其他模块原默认值；原源轨迹仍审阅 |
| test-manga-book-directory-chrome --case chrome-current,adaptive-footer | 2/2 PASS，同进程最终批 | 实际当前Scaffold/Geometry/Header/Query及vp area、fixed/inflow唯一footer、正确native viewport、真安全inset、Grid tail、signed fallback及全部原语义负例 |

manga adaptive另有独立入口PASS，不依赖前case的SDK child schema。旧consumer的问题为框架迁移后提取集/Props/指标字段/selector/旧mutant位置/无当前依据硬码色板漂移，逐项实际定位并保留attempt1–13；没有改生产迁就，没有把错误归因成产品回归，也没有删除正反风险。menu新增native Divider仅是局部构造/stroke port，真实parent高度由实际文本SDK值验证。旧header/bookmark probe也补实际公共函数与当前minHeight语义，原业务位置与负例保留。

本批不改主register/control/nav，根agent按当前真实来源统一重绑；不把上述SDK局部结果直接关闭页面E2/E3。仍需原生真实系统字号/生产字形、边缘命中/裁剪、焦点/读屏/系统Back与用户验收。未构建、签名、安装、HDC或设备操作，未更换生产字体或修改Core/业务回执。

14.19-NATIVE-FIXTURE首轮本地三case均PASS；随后菜单加独立Scroll以保证大字号时四场景按钮仍可达（Source场景不挂该Scroll，不增加被测页滚动owner）。新test编译ID隔离改为复用既有clear/restore对象模式，仍保留同组件内SDK重复ID诊断。因这两处新改动只重跑本分项三个case；既有cold-start admission/registration按原计划首次执行。

#### 14.19-NATIVE-FIXTURE Source-only交接结果

最终 `admission,font-gate,source-callbacks` 3/3 PASS；既有 cold-start `admission,registration` 2/2 PASS。最后补 menu 返回回调的 current/scene 门禁，旧菜单回调不能在 Source 场景 router.back；已在同一准确三case批次复验。菜单滚动只在 menu 挂载，Source 场景仍仅真实 actor 的主 List；无第二页头。真实 prepareReaderFonts checked 等待、当前代际/退场拒绝、release 先回 Index、纯内存24实体/四场景、temporary Back 优先、请求与 actualArea 区分均有 SDK/方法级证据。

Source-only 页 SHA `f1fc2e22…`，RendererPilot `9ec72594…`，main_pages `ae6f593c…`，新测试 `61245bfa…`；本分项前后 Source actor 保持 `fe71764c…`。73 个选定本地输入、外部 SDK 位置/四个模块指纹、原字节与精确 diff、日志归档于 `.reader-artifacts/page-structure-native-fixture-20261103/verification.json`，SHA `6ac0309e…`。这不是完整 App/SDK 闭包；目录/下载后续增量不能复用本 Source-only manifest 冒充当前候选。

唯一新增消息入口为 `ReaderPageStructureVerification.fontPreparationState::shared.page-state`，业务 owner 是 debug 页面字体/准入 attempt，卸载/attempt 改变/拒绝准入失效，交由 root 统一接入登记。SDK 的字体 Promise/router 是有限端口，只证明真实生产等待与生命周期门禁；真实生产 prepareReaderFonts 未替换，系统字号只读 WindowCoordinator。合成 receipt 只证明组件投影，不能证明真实写入、平台登录/Back 或原生字体/触摸/焦点。未构建、签名、安装、HDC 或操作设备，原生 E2/E3 仍开放。

### 14.22-DOWNLOAD-NATIVE-FIXTURE 下载隔离原生夹具（执行前登记）

本分项白名单仅新增非Entry组件 `pages/ReaderDownloadStructureFixture.ets`、定向 `tools/test-download-native-fixture.mjs` 与独立 artifact，基线均为 NEW。不修改主harness/Renderer/profile/Source或任何下载生产actor，不构建、签装或操作设备。组件接 `fontsReady/onBack/onAction` 及标准 `onTemporaryBackBridge`，父级已checked字体后仍等待真实 `prepareSharedDownloadFonts()` 布尔ready，再挂真实 `SharedDownloadPage`；独立校验精确debug。纯内存 typed DownloadBookView/Chapter/StoragePolicy，小说/漫画/长标题/状态样本；所有意图、阅读、刷新和打开只记录或改内存，不接Core/Host、网络、文件或用户书架。

不注入真实页面private managing/detail/sheet，管理/章节/设置均由真实UI进入；只转发真实 temporary Back，经夹具当前代际守卫发布给root消费。组件不画第二页头；actualArea与真实WindowCoordinator systemFontScale分别记录，不设系统字号或替换字体。新字体等待/失败沿ReaderPageState，由root统一接消息登记；不新增消息外框。

唯一精确入口 `node tools/test-download-native-fixture.mjs --case initializer-safety,no-business,callback-retire`：真实SDK降级/子组件initializer核debug与双字体gate、纯projection样本和无私有状态注入；AST核非Entry及runtime import无Core/Host/网络/文件；当前/旧回调、真实桥接消费/清理和实际Area/只读scale。有限child/router/font端口只证明本地接线与生命周期，不能当下载任务、原生字号/字形/命中/焦点或系统Back验收；不扩跑下载actor已存在门禁。失败保留并先定位。

#### 14.22-DOWNLOAD-NATIVE-FIXTURE 结果

准确三case首轮与最终批均3/3 PASS。新非Entry组件 SHA `e0232ccb…`，新测试 `de4fc5d8…`；57个选定本地输入/NEW基线、SDK metadata引用、原日志与archive见 `.reader-artifacts/download-native-fixture-20261103/verification.json`。新接口为 `ReaderDownloadStructureFixture({fontsReady,onBack,onAction,onTemporaryBackBridge})`；root标准bridge可直接消费真实页面handler，退出/父字体撤销/代际变更清理，旧回调不能改新投影。管理/章节/设置完全由真实SharedDownloadPage UI进入，initializer未传private状态或initialViewState；内存12本×18章，9类队列态/3类书状态，configureStorage只改内存policy，其他业务出口仅log，未触发Core/Host。

字体实际准备仍由现有helper处理且等待布尔true，pending/false/reject/旧Promise均拒挂；actualArea与真实系统scale分开记录。新增 `ReaderDownloadStructureFixture.fontPreparationState::shared.page-state` 的owner/失效条件已交root统一登记。SDK只执行真实夹具与child initializer有限port，不执行下载actor子树或native渲染，原生字形/字号/命中/焦点/读屏/系统Back、真实下载/存储/阅读业务和构建/签装/设备均未运行。未修改任何已有生产actor或主harness三文件。


### 14.23-TOOLS-NATIVE-FIXTURE 书源工具隔离夹具（执行前登记）

白名单仅新增非Entry `pages/ReaderSourceToolsStructureFixture.ets`、`tools/test-source-tools-native-fixture.mjs` 和独立artifact（NEW基线）。不改旧actor/主harness/Index，也不构建、签装或设备操作。真实SourceToolsPage仅接typed内存snapshot、BookSource行、JSON草稿、检查参数/样例结果与日志；所有动作仅记录或修改夹具内存，不调Core/Host/网络/文件。父级真实prepareReaderFonts checked后的fontsReady与组件精确debug/lifecycle共同准入，不注入字号/替换字体。真实编辑入口展开JSON，保留实体标签；原confirmExportThen可打开既有NativeAlertOwner，但onExport只log，未执行不得写平台PASS。

SourceToolsPage无temporaryBackBridge；夹具只守当前场景onBack，接口可接标准bridge但不伪造关闭editor/原生Dialog。actualArea及WindowCoordinator真实systemFontScale独立记录。唯一准确门禁 `node tools/test-source-tools-native-fixture.mjs --case initializer-safety,no-runtime,callback-retire`：SDK真实child initializer与debug/font gate、typed样本/JSON/检查参数、AST无Entry/运行时业务port、当前/退场/旧generation/实体回调隔离。有限child端口不执行工具页子树或原生confirm，不证明平台/业务owner完成；不扩跑已过工具页布局/准入门禁。

额外只读核现有ReaderRuntimeOwner/ArkWebExecutor/CookieSessionStore与ReaderHostRegistry保存服务，记录公开example.com/fake export的实际API及副作用边界。不在夹具调用服务、不新增raw平台适配、不运行网络或文件测试；平台取证由root另行按授权执行。

14.23首轮在initializer安全断言失败：真实SourceToolsPage共20个callback加snapshot=21，本地test误数22；原日志保留。逐项对照声明后只更正数量21，20个真实callback逐项类型断言保留，不改生产initializer/actor，也不删端口或放宽为下限。原三case仍是本批唯一计划，修后执行完整准确批次。

#### 14.23-TOOLS-NATIVE-FIXTURE 结果

`initializer-safety,no-runtime,callback-retire` 最终3/3 PASS。新组件 `aaad4c91…`、新测试 `d5237951…`；114个选定本地输入（含只读服务源码）与NEW基线/初次失败/最终日志见 `.reader-artifacts/source-tools-native-fixture-20261103/verification.json`，SHA `ed3ab9ad…`。接口为 `ReaderSourceToolsStructureFixture({fontsReady,onBack,onAction,onTemporaryBackBridge})`。12实体/3预选/样例结果与日志，真实编辑入口后内存JSON展开，draft/检查参数/选择/启停只在内存；save/export/delete仅log，未造Core回执。真实SourceToolsPage的NativeAlertOwner保留，SDK未执行其原生确认；现有页面没有临时Back接口，bridge只发undefined退役，当前场景Back交root。

只读服务报告 `.reader-artifacts/source-tools-native-fixture-20261103/platform-service-review.json`，SHA `a5b259dd…`：登录实际API为ReaderRuntimeOwner.openSourceLogin→ArkWebExecutor.openInteractive，不是Registry；公开example.com+fake profile仍在加载前调用CookieSessionStore.arkWebSeeds，读取共享AssetStore并可能清过期/持久化，因此不符合本夹具零用户数据边界。必须独立平台pilot并核唯一Web host/共享store边界，不能用fake profile宣称全隔离。文件saveBookSourceJson构造Host本身不启动Core，`[]`及reader-fixture-export.json可作假数据；但收到任一URI立即CREATE/TRUNC/write/fsync，没有picker-only或程序取消API，只能真实取消且保留空返回/抛错事实。两类服务本分项都未调用，也未新增平台适配。

新增字体准入PageState entry owner/retire已交root统一登记。父checked字体/精确debug/场景代际/实体及退场守卫有方法和SDK initializer证据；真实工具actor子树、原生确认/系统Back、字形/字号/触摸/焦点/读屏、登录/文件/检测/写入和构建/签装/设备均NOT_RUN。未改旧actors/主harness或用户数据。


#### 14.23-ARKTS-COPY 编译失败后的最小修复（执行前登记）

canonical HAP attempt2 的真实CompileArkTS报告 `ReaderSourceToolsStructureFixture.ets` 10处对象spread违反 `arkts-no-spread`（原132/150/151/161/167/173/179/185/190/196）；既有SDK lowering没有执行完整ArkTS语义检查，原三case不能代表HAP编译。原始失败保留 `.reader-artifacts/page-structure-final-20261103/hap-build-attempt2.log`。本批只改该新夹具及其定向test，不改真实SourceToolsPage/Orchestrator/业务/主harness/消息；现字节与test已另存 `.reader-artifacts/source-tools-native-fixture-arkts-copy-20261103/baseline/`。

按当前typed接口显式copySnapshot/rowEnabled，替换spread后逐字段更新，不引入通用patch引擎、JSON往返或改写回执；SourceToolsSnapshot原optional事实和BookSource全部metadata保持。准确只执行 `node tools/test-source-tools-native-fixture.mjs --case initializer-safety,no-runtime,callback-retire` 三case，新增仅本fixture AST不得含SpreadAssignment约束，防止再次被SDK-only漏检；原行为/实体/旧回调断言不变。主harness引用接口同字节，4case可明确复用，不重跑；消息入口和family同字节，不跑消息/全树。HAP重编与Native交root，本子任务不设备/构建。

14.23-ARKTS-COPY结果：准确3/3 PASS；组件 `1f478ccd…`、test `bce4eb63…` 已稳定交root。原114个scope输入比较，仅这两文件变化，overlay+原base archive可还原本次实际输入；精确diff/原编译失败引用/日志见 `.reader-artifacts/source-tools-native-fixture-arkts-copy-20261103/verification.json`，SHA `c2b215fc…`。没有改共享ReaderButton/ReaderControlSpecs、主harness、实际actor/owner或消息；未宣称修后HAP/Native通过，等待root新的canonical编译。原SourceTools NativeAlertOwner按钮未点击，导出仍只log。


### 14.24-NATIVE-FIXTURE-INTEGRATION 主验证页集成（执行前登记）

本批独占并只修改 `ReaderPageStructureVerification.ets`、`tools/test-page-structure-native-fixture.mjs` 与 `tools/message-entrypoints.json`；原字节冻结于 `.reader-artifacts/page-structure-fixture-integration-20261103/baseline/`。三个已冻结子夹具及所有生产actor不改。主menu增加目录text-detail/text-reader/manga/control-expanded/control-compact、下载与工具场景；按真实props挂子组件，保留checked prepareReaderFonts、真实metrics、320/366外层与actualArea分账，无第二页头。父scene/presentation守卫覆盖新旧menu/action/Back；下载真实bridge、工具retire-only bridge，目录无bridge，系统Back退当前scene，子action只记fixture意图。

依据 `docs/message-ui/FRAMEWORK.md`，本批新增主页/下载/工具三个现存字体准入 `ReaderPageState` 入口登记，owner分别是主fontAttempt、下载shared-font attempt/父ready、工具父ready/scene；目录组件没有PageState，不补假登记。只增条目，不恢复已移除statusBanner scope，不改旧消息业务owner。三条状态皆组件debug字体事实，不接写入/恢复事实，也不新建外框。

唯一主SDK命令 `node tools/test-page-structure-native-fixture.mjs --case admission,font-gate,source-callbacks,fixture-scenes`：原三case受主build/scene/bridge分支改动，必须复验；新增case核七个新场景真实initializer参数、checked gate、宽度/实际Area、临时Back与旧代际/同identity cleanup拒绝及menu回调退役。仅有限child/font/router端口，不执行子actor或Native。消息只执行四条准确 `node tools/check-message-entrypoints.mjs --check --file <ReaderPageStructureVerification / ReaderDirectoryStructureFixture / ReaderDownloadStructureFixture / ReaderSourceToolsStructureFixture>`，各自留log；目录预期0/0，其余各1/1。不上全树、不加构建门禁，不构建/签装/设备。失败先保存定位，只复跑受影响case；产物交root canonical构建前再绑定。

14.24初次四case及四文件selected消息均PASS。构建前追加只读审查发现旧menu跨后继menu的重放仍缺真实UI回调证据：当前launchSource已menu-only，但menu条件不能识别前一轮menu；旧字体失败retry也未捕获fontAttempt，可能在新scene重新触发字体准备。本地基线仍保留初次60bb…/49d9…与原PASS；最小修复为menu ForEach捕获presentation，四个菜单入口显式核对expected，并使retry同时核对原fontAttempt/scene。新增实际SDK旧Button/重试closure负例，不用直接调用方法冒充旧UI。只执行 `--case font-gate,source-callbacks,fixture-scenes` 三项：分别保护新增字体重试、Source显式菜单代次、七场景旧menu/Back/宽度生命周期；原admission及四selected-message输入行为未改，复用其已有PASS，不重新执行。

#### 14.24-NATIVE-FIXTURE-INTEGRATION 结果

主harness最终 `0d97a188…`、test `40e70425…`、message登记 `8af0e280…` 已稳定交root构建。初次4/4 PASS；增强后准确三case再次3/3 PASS，覆盖实际旧SDK Source/Download/宽度/返回Button在active scene及后继menu的重放拒绝、当前menu正例、旧字体失败retry在pending/新scene/后继menu的拒绝，同identity旧bridge cleanup也受presentation守卫。七个新scene×320/366实际initializer均通过；目录text detail/reader、manga、control expanded/compact按真实props，下载/工具仍由各自真实actor管理模式，未注入private状态。

消息仅增三个实际字体PageState入口；四文件选定检查为主1/1、Download1/1、Tools1/1、Directory0/0 PASS，未跑全树。最终guard变更后主入口ID/family/owner和registry相同，其消息结果记REUSED_PASS而非新运行；其他三个文件及registry同字节复用。旧entries及所有非entries字段与本批基线语义相同，statusBanner scope未恢复。admission也保留初次证据/明确复用，不把它写成本轮最终三case的新结果。

72个选定输入、原字节/精确diff、全部本地log、仅新增三entry清单与SDK metadata引用见 `.reader-artifacts/page-structure-fixture-integration-20261103/verification.json`，SHA `9c618bac…`。scoped archive不是完整App/SDK闭包，canonical HAP须由root另冻输入。SourceToolsPage原生导出确认仍经真实ReaderNativeAlertOwner；本子任务未打开、未点击任何确认按钮或采平台证据，onExport仅夹具log不存文件。字体/实际Area/系统scale分账，无第二页头；仅SDK initializer/回调证据，原生字形/触摸/焦点/读屏/系统Back、业务owner与构建/签装/设备不由本分项判PASS。


### 14.21-DIRECTORY-NATIVE-FIXTURE 目录隔离原生夹具（2026-11-03，执行前登记）

白名单仅新增 pages/ReaderDirectoryStructureFixture.ets、同目录纯内存数据 ReaderDirectoryStructureFixtureData.ts，以及 tools/test-directory-native-fixture.mjs；三文件基线记 NEW，保存在 `.reader-artifacts/directory-native-fixture-20261103/baseline/inputs.json`。不修改前批12个生产actor、Index/Core/Host、Source主harness/Renderer/main_pages，不构建、不签装、不HDC。由root主debug验证页在prepareReaderFonts真实checked完成后挂载；组件自身同时要求debug与fontsReady，不自行注入字号、替换字体或访问用户数据。

text场景直接ReaderFullDirectory，catalogContext分别允许detail/reader，书签身份不传以使用真实flat目录/书签分支；control直接ReaderControlDirectoryContent，父尺寸复用resolveReaderControlLayout、sampleReaderControlMotionComposition与readerControlDirectoryFrame，不借retained FullDirectoryPanel.embedded。control fixture只覆盖内容slot（章节/书签/query及行标记），未挂生产header/手势Stage，不能声称control完整外壳/动效/route通过。全屏不再绘第二页头或消息框。60条内存章节含长中英文、已下载/失败/排队/未知与书签样本；全部动作只写内存并回调标识/hilog，生命周期退场拒绝旧callback；实际Area与系统scale分别记录，不把请求宽度冒充实际。

漫画真实BookDirectoryPage目前无条件挂ReaderDirectoryNavigationSurface，后者出现时无条件取得RuntimeOwner与NavigationGateway。当前scope禁止改12个actor且禁止Core/Host，因此manga分支先拒绝；已向root报告必要最小默认关闭的catalog-only opt-in，未经裁决不以替代画面或空sourceId伪造隔离。选源选择不新造route，所有选择仅原组件callback意图。

唯一精确门禁 `node tools/test-directory-native-fixture.mjs --case initializer-safety,memory-actions`：复用真实SDK lowering/Props initializer，核text/control真实actor参数与父预算、debug/font admission、actualArea/真实scale记录、纯内存60行和退场/旧generation回调拒绝；漫画隔离结论依裁决测试。有限native ports不执行真正production children，不代表原生字形/命中/焦点、业务回执或整页route验收；不跑其它默认套件。失败先保留日志并代码定位。


#### 14.19-TOOLS-A11Y 结果

本批生产三文件已稳定：SourceToolsPage SHA dcce2eb5…、ReaderControlSpecs a42f2a5d…、ReaderButton d3f5c0fd…。两项新Tools spec有真实44vp最小目标及系统字号增长；窄宽/大字改为实体文字在上、动作在下并按宽度换行。实体文字、结果和日志自然增长，三个内List的最小viewport按本身行预算同步，保留420/320/360滚动上限；源列表不再固定58行。全局批量动作和计数有界换行，关键词复用44vp form-body，选择/编辑/调试及JSON/关键词有实体标签。没有修改原canWriteSources、owner回执、导出确认身份或新建业务/消息出口。

准确SDK命令五case通过：layout-matrix / entity-admission / legacy-isolation / guard-admission / input-selection。共30个行组合（320/366/720×1/1.3/1.6/2/3.2，summary有无）、9组批量动作/计数、8个实体准入上下文；43个旧spec与258个实际modifier上下文和before字节一致，ReaderButton除两个Tools谓词opt-in外与Source-a11y完成字节744d…相同。随后按实际结果/错误日志行修正父List最小预算，只重跑受影响layout-matrix并PASS；其他准入/输入/旧分支证据未受影响，复用run-02。3.2只作SDK额外边界，不是Native支持点。

首轮run-01在case进入前因Node直接导入含extensionless依赖的ArkTS resolver失败；保留原log，改为沿用pureModuleProbe读取原生产resolver，未改SDK或生产以迁就测试。run-02五项PASS，run-03布局PASS。仅移除TOK_MUTED未用import不改变行为。

完整当前字节、baseline、精确diff、原始日志和verification位于 `.reader-artifacts/source-tools-accessibility-20261103/`；verification SHA 902b0e08…，source-tools-sdk-evidence 77637ae0…，registry-updates 710a3caa…。legacy-isolation准确case依赖该包附带的immutable baseline；它不作为默认门禁。登记修正交给root：旧fixed58/30/42事实应更换，控件仍partial，原生E2/E3/字形/读屏/焦点/真实触摸及操作绑定不能据此PASS。本批未改主register/platform/nav/messages、SourceManagement/Index/Core，未构建/签名/安装/HDC/设备。

14.21 scope裁决：root确认保留当前生产Tree，取消前述flat替代计划；Index正常detail非空标题注入bookmarkIdentity，ReaderShell透传同identity。新增Port仅现有NavigationGateway的open/page/resolveTarget三签名；默认undefined保留原Runtime/Gateway路径，fixture factory仅传固定typed内存投影，Surface/List原generation/identity/selection guards不改。新增冻结7个生产文件及准确grid测试于baseline/seam-inputs.json；Root等待本批定稿后再拍build，不构建本批。fixture sourceId/bookId/session均进程专用，不混用户book scope。

真实Tree E2核查：当前downloadGridWidth已44（不改公共visual），但gridHeight44减两侧1vp border使实际下载carrier仅42高；本List cell最小高需46，父子同源，不继续外扩response。group disclosure仍是16×16点击Image；改44×44透明Stack承载原16图，父row自然增长。清除搜索min36也改真实min44，原response仍44。文字/图标/颜色不统一。grid规划需同时为下载44+独立阅读44与实际padding/border留预算，选最小Tree规划callback补足padding；不改公共Manga visual或flat renderer。

精确新增门禁：`test-directory-native-fixture --case initializer-safety,memory-actions,default-vs-fixture,no-runtime,captured-retire`，核默认/注入两条真实创建路径、无Runtime端口、旧callback与port退场；`test-reader-directory-navigation-ui --case surface-admission,actions`保留当前Tree读取/页准备与选择/下载/viewport原守卫；`test-manga-directory-grid-sdk --case current-grid-geometry`核实际Tree grid child目标和parent/new-group carrier及既有正反预算，不跑paged-data/retained-paint或其它目录已过case。默认路径type-only和factory转发不改变12actor布局/业务分支，fixture首次真实构建/原生证据由root单独执行。

14.21首轮三个准确入口均在旧/新probe初始化失败而非生产行为：新fixture的Node ESM读取ReaderLayoutGeometry普通type import报无导出（实际ETS合法），改复用pureModuleProbe执行该纯模块；旧surface consumer遗漏既有notifyReadFailure/feedback闭包，旧grid遗漏共用readerActionTouchRegion/ReaderActionAccessibility。先追加冻结准确ui测试原字节，再补真实公共声明/有限消息展示port，保留失败log。grid脚本还有旧24vp下载/32vp fold和contentStartInset字段，已静态逐项改现有44目标/scrollLayout；不删原场景/负例、不修改通用probe、不跑其它case。

14.21第二轮：新fixture五case全部PASS；旧Tree消费者继续在既有有限消息port缺reset（identity retire调用）与grid提取清单缺mangaEmptyActions失败。静态复核选中Grid所有this方法闭包后，只补真实mangaEmptyActions和消息展示port.reset，不扩通用composer，不删empty/retry或旧guard断言；原失败保留。

14.21第三轮旧consumer已到SDK消息呈现：两个脚本仍只查root.nodes，但当前ReaderPageState的Text位于真实child树；旧grid同时硬断私有12/18fp而当前已迁移公共MESSAGE_BODY13/21，无maxFontScale硬限。改递归查实际SDK child树并核当前公共role，clear动作仍原12/18及系统scale；Surface按当前“保留条目+retry/正在加载”实际类别核对（错误短反馈由原owner另处处理），不把已删除私有错误文字当产品规则。保留原FAIL，不修改生产消息。

14.21第四轮：旧surface-admission/actions两case均PASS；grid empty action到了现有mounted守卫，旧fixture未进入出现态，故正确拒绝clear；只在empty场景设mounted=true，继续原interaction关闭负例，不删除守卫或直接调用callback。

14.21第五轮grid已进入新的真实group44 carrier；旧probe未提供SDK降级animation所需Context.animation，故在原Image rotate的动效声明处停止。补有限Context动画提交port并执行当前MotionSpec真实公共函数（复用现有pureModuleProbe/曲线端口模式，不改动画生产参数），Native动效仍不验收。首次five-case fixture PASS和surface/actions PASS不再重复。

#### 14.21-DIRECTORY-NATIVE-FIXTURE 结果

新fixture五项initializer-safety/memory-actions/default-vs-fixture/no-runtime/captured-retire为5/5 PASS；旧Tree消费者surface-admission/actions为2/2 PASS；真实manga current-grid-geometry PASS，包含下载inner44、独立阅读lane44、group44carrier、border预算反例及原content-offset/viewport/target/fold负例。static64节点（60章节+4显式group）通过当前同Tree renderer，不实现Core过滤/排序/折叠/resolve算法；sample回执仅组件意图。新fixture无@Entry/main_pages/冷启动协议，由root父debug页checked字体后挂载；text context detail/reader，manga full，controlExpanded Quick/Full内容slot可分别选择，control未挂生产header/Stage动效不作为其证据。

生产范围7个既有薄Port/Tree文件+2个NEW fixture/data，当前SHA见`.reader-artifacts/directory-native-fixture-20261103/production-inputs.json`；原字节/精确diff、NEW清单、全部失败与最终日志及输入zip见同目录verification.json。默认factory undefined的Runtime/Gateway分支及原身份/世代/selection守卫保留，无伪RuntimeOwner；显式factory只在fixture生命周期内取得捕获实例，退场/旧factory/旧target resolve拒绝。未改公共MangaVisual及其其他消费者，未动Source/download/主harness/主登记。

首次失败为ESM纯type导入、旧consumer漏现有消息/动画/公共accessibility闭包、旧24/32目标/旧scroll字段和消息私有树层级；逐项代码定位后只修准确测试composer与实际公共类型，保留每轮FAIL；不改通用probe、不删风险断言、不继续跑已PASS子项。当前验证共三条命令8case，不代表页面/原生E2/E3通过。Root后续绑定新源码并独立执行构建/原生文字、命中、系统字号、焦点和读屏；本分项无build/签装/HDC/设备，也不声称Core树/业务回执/整页route验收。

14.19独立集成审计发现并修复两帧窗口竞态：Source第1帧按id求index后，两帧之间source投影可重排；第2帧不得拿旧index校正新实体。修为第2帧重新按原anchorId/当前相邻序位定位，若目标或索引变化只重定位、放弃旧项内像素校正；空列表回顶部，不引入无界重试。精确scroll-roundtrip追加重排/清空帧间负例；此前PASS保持原时点证据。Downloads旧restoreListOffset的touch/filter失效问题已交其owner独立修复与定向验证。


### 14.19-DOWNLOAD-LIST-RESTORE 普通列表旧idle恢复竞态（2026-11-03，执行前登记）

独立review发现restoreListOffset旧idle仅核mounted/font/identity/detail空；排队后touch或筛选不取消，可把用户新位置拉回。仅改SharedDownloadPage.ets与test-shared-download-visual-contract.mjs；当前字节已存.reader-artifacts/download-list-restore-20261103/baseline。为普通列表独立epoch/pending捕获offset、presentation、字体代次与几何；touch/filter/退场/新opening/字体准备/实际geometry或管理态转换退役，不重发旧帧、不重复回拉。既有managingScrollRestore/anchor严格逻辑保留，不借其状态给普通恢复。

只执行node tools/test-shared-download-visual-contract.mjs --case list-restore,management-scroll：新增list-restore准确覆盖排队→touch/filter/new opening/窗口/字号/退场/异常native controller旧帧拒绝，正常帧执行一次与重复排队仅当前epoch；现有management-scroll保护同页调用点新增取消不会改变管理切换anchor、旧Area及恢复次序。SDK沿原probe，不改主harness/其他actor/register/messages，不构建或设备。先保留失败log并从代码定位；属性/回调测试不能证明设备滚动。


#### 14.19-DOWNLOAD-LIST-RESTORE 结果

普通列表已独立epoch/pending，捕获offset、presentation、fontGeneration、windowRevision、实际宽高/system scale/管理态；touch、六个filter/sort Watch、同值keyboard/reset、退场/新opening/prepareFonts/实际geometry及管理态切换取消。初次0→同resolved宽高不误取消；当前idle在native调用前消费pending，重复idle或异常unbound不能重排/反复拉回。managingScrollRestore/anchor算法未改。

`node tools/test-shared-download-visual-contract.mjs --case list-restore,management-scroll`首轮两项PASS：6个filter字段、13个退役边界、真实List touch、正常帧一次、最新epoch唯一恢复及缺touch cancel负例；原管理态Area/frame/anchor次序全部PASS。生产SHA907a37d6…、测试eca30493…；baseline/current/diff/原log/verification已固定于.reader-artifacts/download-list-restore-20261103，已通知登记owner绑定最终字节。本批仅该页与其定向测试；无失败、无register/messages/build/HDC/device操作，SDK回调不能代替设备滚动证据。

### 14.25 当前签名候选构建（2026-11-03，执行前登记）

唯一待答问题：本轮生产改动与安全取证组件能否完整ArkTS语义编译、打包并用指定身份签名。方法/有限SDK probe不能回答这个问题。待生产、tools与active登记writer稳定后执行唯一入口：`CARGO_TARGET_DIR=<本仓 .reader-local/storage-compatibility-20261030/native-archive-4a52> node scripts/hap-pipeline.mjs build --class iteration --contracts-scope none --signing local --artifact-root .reader-artifacts/page-structure-final-20261103/hap`。这是dirty WIP隔离非增量候选；不清理/提交工作区，不改版本，不构建Core，不运行合同或消息全量。Native归档只读，禁止向它执行Cargo编译。

嵌套刚需：pipeline唯一build resource lease/降优先级、Native provenance preflight与Host/SDK/storage companion匹配、source/controller/workspace前后快照、私有Profile和证书authority校验、隔离ohpm本地解析、Hvigor非增量assembleHap、HAP内嵌Native/资源/构建身份/签名核验、不可变manifest发布。它们分别防止错Native、错签名、源码漂移与残留增量产物，是候选本身不可省略的组成；scope none不派发业务/Core套件，结果NOT_RUN、acceptanceEligible=false。独立artifact-root不清历史证据；保留失败journal/log。

只读现场未发现Hvigor/es2abc/Cargo/rustc编译进程，现有Emulator仍运行；sandbox ps曾返回EPERM，后使用受审只读进程检查，不由空输出推断无占用。构建仍以规范锁实际准入为准，争用停止协调。Native preflight已用匹配4a52归档PASS；既有宿主inspector与Native contract匹配，分动作环境绑定见deployment-dependency-preparation.json。无变化Core测试复用，不使用默认target的混合旧Native。

此入口不调用HDC，不停止/安装/启动App、不截图触摸或改字号。得到可审阅manifest/HAP后，设备动作按原生计划中已有只读授权的边界单列；签名成功不等于E2/E3或设备通过。失败先留日志、从代码定位准确原因，只改已授权范围，不删门禁、清WIP或换证书。两次尝试用本机Python追加中文计划在解释器编码阶段失败，均未写文件；改用apply_patch，不改变执行范围。

### 14.24-ACTIVE-REGISTER 四类正式登记收尾（2026-11-03，执行前登记）

根agent分派中央登记：仅tools/page-structure/register.json和实际tools/contracts/{contract-map,navigation-registry,control-registry,platform-host-registry}.json五active JSON，当前字节独立冻于`.reader-artifacts/page-structure-active-final-20261103/baseline/`。不动model/schema/derive/check/test生产脚本、历史stage5 authoring JSON、production或root新harness。按当前真实代码及source-owner/source-expression/Tools-accessibility/Downloads-closure/Directory-final manifests逐项审阅事实，不把候选旧固定58/30/42或“未实现scroll”文字靠刷新hash伪装成当前事实。Source保留同Runtime四filters+anchor/offset、fresh reset及帧间投影fix；Tools只登记当前sameRuntime draft/selection/results owner事实，不捏造滚动保留；platform Back仍unknown。删除已移除statusBanner retained scope，E2/E3及读屏/平台/原生FAIL或NOT_RUN继续保留。

只执行四条当前刚需入口：`node tools/page-structure/validate-model.mjs`（新four-family/typed事实与upstream JSON schema、revision/显式FAIL跟进一致）；`node tools/page-structure/check-contract-refs.mjs`（当前symbols、4family/variants控件/操作/消息/三独立平台host引用与owner）；`node tools/page-structure/check-register.mjs`（实际sourceInputs/推导装配/非法组合与既知native开放状态；不要求整体绿）；`node tools/page-structure/test-stage5-register.mjs --case host-variants`（root刚修改的同类平台host不同owner与真实宿主正反fixture，防止新Tools三个host被错误合并）。这些入口不嵌套业务/构建/设备门禁，不跑footer-placement或其它旧套件。Source旧局部layout报告输入已漂移，先请root裁决重生或移除live绑定保留历史证据，不能改旧结果作新验证。失败原日志封存，修数据引用/事实后仅复跑受影响入口；脚本问题交root，不在此越权改validator。


### 14.19-SOURCE-FINAL 最终Source字节与SDK证据刷新（2026-11-03，执行前登记）

最后Source帧间投影重排/空列表fix已由root运行scroll-roundtrip PASS（source-scroll-projection-final.log）；当前SourcePage 5cd8615d…、Index0e3b8bdd…、Presentation f6f09c5d…及该测试53c0eedb…在该log完成后未改，对应准确场景REUSED，不重复运行。11 Source→Index消费者source-consumer-a11y-final.log PASS按root确认复用：后续源页delta只涉scroll目标第2帧再定位/空fallback，Tools ReaderButton仅新ID opt-in且43旧spec/258modifier已证明旧Source分支未改；不把旧结果写成新运行。

本批不改生产；只按最后共享spec/Source字节刷新必要证据。准确case核对后执行：test-source-filter-retention --case filter-roundtrip（实际投影更新与四条件owner）；test-source-management-contract --case filter-projection,action-admission,footer-geometry（真实ID是filter-projection，不是projection；当前投影、旧诊断准入、footer）；test-source-management-layout --case matrix --write-evidence --evidence-path=.reader-artifacts/page-structure-final-20261103/source-final-layout-evidence.json；test-source-interaction-inventory --case inventory,sdk-targets,recovery-targets --evidence-path=.reader-artifacts/page-structure-final-20261103/source-final-interaction-evidence.json。最后全目标enumeration是当前模板/真实SDK叶/恢复控制覆盖，不是原生命中。

布局producer原仅--write-evidence且固定覆盖旧tools报告；最小增加同inventory的显式artifact输出参数，参数只重定向写入，不改SDK或预算。先已冻结其当前字节和历史报告，严禁覆盖历史。新的实际报告用checkLayoutEvidence准确本地读入做正例及hash/input drift反例，只回答这份报告是否绑定当前输入；既有synthetic门禁不因存在而重跑。所有失败保留并定位，缺probe依赖仅局部补；没有全量、Core、build或device。Source-facts/报告交登记owner合入，原生E2/E3与读屏边界不据SDK关闭。

14.24 root夹具校正：host-variants不再依赖当前Source必须持续S8 FAIL；unknown retention正例先显式NOT_RUN，再故意宣称PASS作为反例，parent S8/E2/E3保留测试在隔离clone中显式注入FAIL。真实滚动修复不能要求生产继续谎报未实现；原负例意图和三项失败传播断言保留，不降低validator规则。该脚本交中央登记owner按原准确host-variants入口执行。

14.19 root直接单选最终复核：除了multi+perItem非法，single+none同样不能推导无提交动作的SelectionPage；derive统一要求single/perItem或global commit，追加single/none负例。只复跑已登记准确direct-selection，模型原型数/合法实际登记/多选footer断言不变，结果另存selection-grammar-final.log，不扩框架套件。


#### 14.19-SOURCE-FINAL 结果

生产保持Source5cd8615d…、Index0e3b8bdd…；本批无生产修改。filter-roundtrip PASS；准确filter-projection/action-admission/footer-geometry各PASS；matrix32行组合/40目标/24预算PASS，新source-final-layout-evidence.json SHA15a079ca…，17输入全部匹配、仅5个controlRefs局部SDK尺寸，E3 NOT_RUN。历史tools/page-structure/source-layout-evidence.json与本批冻结baseline同字节，未覆盖。新producer仅增加显式artifact输出flag。

interaction最终inventory/sdk-targets/recovery-targets各PASS：34目标模板、19实际暴露点、4手势；8上下文200 SDK叶样本+48恢复样本=248记录。新source-final-interaction-evidence.json SHAed70f5ec…，19输入全匹配；nativeHit/nativeFont NOT_RUN、pageE2/pageE3仍FAIL。恢复样本没有向ambient-fp注入四档字号，不能当四档原生恢复布局证明。

原两次interaction FAIL保留：attempt1旧局部fixture未注入当前ReaderSearchField.directoryFontScale/sizing/metrics依赖；attempt2旧directory不设置response的断言过期，当前Directory修复明确拥有真实增长44+目标与零外扩response。仅补该局部probe真实依赖，改为核当前Directory增长高度/零外扩，并用实际ReaderSearchInputTarget.rssPassive无setter负例保留范围隔离；未改生产或SDK。第三次准确3case通过并发布完整原子报告，两次首轮inventory PASS与未跑recovery状态照录。

直接使用原checkLayoutEvidence校验这份实际新报告：正例无诊断、错误report SHA/错误ReaderButton输入SHA均拒绝、把5controlRefs局部SDK报告冒充整页E2 PASS亦被拒绝。binding-check SHA42256f69…。没有为此重复既有synthetic全套。scroll-roundtrip复用root最后log：10个命名实际Source/Index/Presentation/测试/probe文件mtime均早于该PASS log，固定当前SHA；11消费者依root明确作用域复用，单独声明整文件字节已有scroll-only/Tools-ID差异，不写成新运行或同字节。reuse-bindings SHA07ef4a16…。

完整source-final-verification.json SHAbc4baf99…记录42项联合输入、全部命令/log/失败、复用和证据边界；source-final-sdk-inputs.zip保存本批精确文件及报告。已通知finish_directory将Source登记改绑新layout/interaction路径与SHA。后续本agent停止生产/tools修改，仅artifact/MD冻结；没有构建、签名、安装、HDC或设备动作，原生/读屏/焦点及用户验收不据SDK关闭。

14.25首次构建在规范resource lease的lowerOwnPriority阶段被sandbox限制，尚未开始编译/签名，原FAIL journal及hap-build-attempt1.log保留。不能删除降优先级保护或绕开lease；按原授权同一canonical命令申请受审非sandbox执行，独立attempt2日志。生产/工具/登记输入稳定，不增加合同或设备动作。

14.25完整工程尝试2：规范非增量编译约61秒，17条明确源码错误（汇总ERROR18）阻止签名/HAP发布；原494 warning未当通过或悄悄清理。root漏导入SourceManagementLayoutFrame所需@kit.ArkUI FrameCallback，有限probe显式提供该port因此此前未发现；添加官方导入，不改方法/Builder。Directory fixture与Tools fixture对象spread不符合ArkTS，及ReaderFullDirectory两个同步准入后的冗余窄化比较分别交原owner；同批补FullDirectoryPanel私有32响应区重叠。修复与准确回归另存新artifact，不覆盖旧manifest/report。构建已退出、lease释放后才开放writer；待源码/工具/登记稳定再次运行原canonical范围，不增加门禁。


### 14.19-SOURCE-COMPILE-REBIND 官方FrameCallback导入与报告重绑（2026-11-03，执行前登记）

HAP2完整编译FAIL已保存。root仅为SourceManagementPage增加官方`import { FrameCallback } from @kit.ArkUI`；当前f7fc4a39…，对比前次source-final-sdk-inputs.zip中的5cd8615d…，去除此一行后所有其余字节逐字相同（方法/Builder无变化），证据source-import-only-proof.json。旧行为/SDK结果保留为原时点有效证据，但完整source hash变动使旧layout/inventory不能直接作当前active输入绑定。

不改生产或tools，仅在.reader-artifacts/page-structure-compile-fix-20261103全新目录执行两个准确producer：`node tools/test-source-management-layout.mjs --case matrix --write-evidence --evidence-path=.reader-artifacts/page-structure-compile-fix-20261103/source-layout-evidence.json`；`node tools/page-structure/test-source-interaction-inventory.mjs --case inventory,sdk-targets,recovery-targets --evidence-path=.reader-artifacts/page-structure-compile-fix-20261103/source-interaction-evidence.json`。目的只为真实完整输入字节重发报告、验证现行生产器可复现；旧报告不覆盖，失败照录。scroll/filter/contract/11消费者依import-only作用域精确REUSED，不重复，原native E2/E3/读屏/触摸与产品接受边界不变。报告生成前协调其他writer的ReaderButton/ControlSpecs依赖定稿；两份报告完成交finish_directory绑active/sourceInputs，本agent不改主register，不build/device。


#### 14.19-SOURCE-COMPILE-REBIND 结果

两份准确producer首轮PASS，未改生产/tools。Source当前f7fc4a39885fef22d62aa4e47863c27df76344108f84cc7cd9144f585455bfff；官方FrameCallback导入以外全文件字节与旧5cd8615d相同。新的.reader-artifacts/page-structure-compile-fix-20261103/source-layout-evidence.json SHAce3526f73408e979ead7cbde97718e0f155cf9bc1f78b603a0088e28845d8401；source-interaction-evidence.json SHA5d0666d749daa2c4e022a3011df06db13fa0764acc7d8e00f786fd8d0ccf2461。layout17/inventory19输入各仅SourceSHA一处变动，其余所有输入与全部非input报告字段与前次输出相同，32项联合输入现行SHA全部匹配。32行/40目标/24预算、34templates/19site/4gesture、200SDK+48恢复样本维持原边界，不作Native或整页E2/E3 PASS。

source-report-regeneration-proof.json、source-import-only-proof.json、原log、当前精确32输入及source-compile-fix-inputs.zip已冻结；verification SHA4902618630349104628aa64aa45f02fd79b727c8d09011b5d1ad69142041cd31。scroll/filter/contract/11consumer仅引用前次准确PASS与import-only证明，未重复运行。Dir与SourceOwner确认后续目录私有actor修复不碰Source报告公共依赖；已将新路径/SHA/SourceSHA交finish_directory最终active重绑。历史source-final报告原样保留。没有build/签名/HDC/设备操作。

### 14.25-DIRECTORY-TARGET-CLOSURE actual private/fallback target budget (before execution)

HAP attempt2 failed before deployment: DirectoryFixture four object spreads violate ArkTS, and two redundant synchronous blocked comparisons in ReaderFullDirectory are narrowed. Root authorized this bounded correction, with original bytes frozen in directory-target-closure-20261103/baseline. Actual FullDirectoryPanel private32 controls at gap5 overlap expanded44 regions by7; its44 tab parent with top5 lacks child budget. Actual unsupported-Core fallback uses shared MangaDirectoryEntryRow:44 border cell leaves42 inner download;16/32 branch actors expand outside parents. Shared row consumers are BookDirectoryPage fallback, MangaReadingDirectoryFallback and LocalBookDetail preview. Other root/fold controls were source-audited; ControlDirectory tab overlap is owned separately by source-owner agent.

White list: FullDirectoryPanel, ReaderFullDirectory, DirectoryFixture + pure data, MangaDirectoryEntryRow/MangaDirectoryVisual, TreeList, the exact directory budget test and NEW test-directory-target-closure.mjs. Keep32/16 paint but use actual44 carriers; full tabs pay44+top5+divider; query budgets consume actor innerWidth/panelWidthOverride (actual parent Area), with separate query/tools rows only when44 input +4x44 tools/gaps do not fit. Vertical list extents pay the same extra height. Shared existing manga columns formula pays independent44 reading + download + padding/borders; remove Tree local padding workaround to count once. No new algorithm or business owner. Static fixture copies become explicit typed copies; keep admission guards.

Only precise necessary checks: test-directory-target-closure --case private-toolbar,fallback-carriers (actual SDK private/shared carriers, no overlap and three real consumers using the one public planner); test-directory-structure-budgets --case scale-targets (changed full tab/body budgets and original header admission); test-directory-native-fixture --case memory-actions,no-runtime,captured-retire (typed copy and lifecycle); test-manga-directory-grid-sdk --case current-grid-geometry (shared width/Tree compensation and existing negative cases). Existing untouched native/owner cases are reused. Final central active JSON fingerprints and source ce3526f7/5d0666d7 fresh reports are rebound, then original four structural validators only. No native E2/E3 PASS, no build/HDC by this agent. Failures are preserved and diagnosed before rerun.

14.25 generated-source correction: MangaDirectoryVisual.ts is emitted by tools/generate-manga-directory-visual.mjs from Reader-UI/design/manga-directory/visual.json. This minimum-target capacity rule is in the generator function template, not a palette/metric change. Root authorizes its exact source update and regeneration of only its three outputs (Harmony TS + Reader-UI generated JS/CSS); original cross-repo bytes frozen. No Reader-UI JSON/approved colors/timing/metrics change. Exact node generator and --check are necessary source/output consistency checks, not whole UI generation/test.

14.25 first new SDK script failed before execution due one missing object brace in its local dependency argument; raw targets-attempt1 retained. Corrected only this syntax, without changing assertions/production. Family generator/check both PASS; three output delta/source identities remain separately frozen.

14.25 controlled-source audit found prior manual generated TS44/44/44 was not reflected by visual.json26/36/24. First canonical regeneration correctly exposed this stale authority and made the exact Tree44 assertion FAIL. Freeze this delta; root authorized only those three existing production target values back into controlled JSON. All other224 metrics/palette/fonts/timing remain byte-equivalent values. Existing generator schemaVersion/static-font/numeric-metric/palette validation is the finite family validation entry; no separate visual JSON schema exists in this family. New private-toolbar assertion also used unrounded51.2 while actual shared resolver ceil returns52; only expected pixel rounding is corrected.

14.25 target attempt3 private-toolbar PASS, fallback probe incorrectly interpreted native layoutWeight minWidth0 as a measured target width. Corrected to assert explicit carriers plus independently calculated actual parent cell width; minimum0 is a shrink constraint, not pixel evidence. Third consumer now executes exact LocalBookDetail.prepareMangaPreview, with its actual branchControlsEnabled=false, alongside exact BookPage/Fallback projections. No production assertion/target removal.

14.25 root原生安全边界复核：EntryAbility原debug冷启动选择页之后仍无条件ReaderRuntimeOwner.install，故夹具only-memory只证明组件及其callbacks不发业务RPC，不证明整个App启动零用户存储访问/后台事实；已将此补入native-host-plan，不改EntryAbility或新建空DB/旁路包名。平台Cookie/file真实服务仍不调用；后续安装/启动必须按规范停写备份/兼容准入和既有用户授权边界分别记录。

### 14.26-CONTROL-DIRECTORY-BUDGET Tab与真实父边界（执行前登记）

当前ReaderControlDirectoryContent的44vp Tab在Quick目录bottom57/书签56而ListTop48/47，重叠9；Full Tab.bottom50而ToolbarTop43，重叠7。中途Toolbar仍完整52vp且无父clip、List只给过渡部分空间；底部48vp非交互摘要也只按48*p扣List，p=.5实际覆盖List12vp。上游ReaderControlPanel直接传contentMotionHeight，布局由实时window扣fullPanelTop/bottom、Motion内容reserve70和directory字号Header增长，Full无>=195的隐藏保证；fixture复用同链，不能用190仅Quick作假前提。

白名单仅ReaderControlDirectoryContent.ets、新私有ReaderControlDirectoryGeometry.ts、独立tools/test-control-directory-tab-budget.mjs及artifact；原字节/NEW基线已冻结。Tab文字保留原role与icon，只把真实字体scale、native高度/response和父下边界同源。保留原Tab x/y、Toolbar原61→43加必要7*p/Tab增长，query child自然高度不缩放；Toolbar真实父viewport按p揭开且clip，ListTop原轨迹仅加14→7及字体增长，divider放实际Tab下边界。底部摘要同一viewport/reveal预算，内内容保留原绝对glyph轨迹，reservation按实际可用headroom连续退让，不能占掉完整一行；极矮slot无完整行时如实记录真实List viewport，不宣称整行或E2/E3通过。未改Panel/Header、业务回调、消息或共享resolver。

精确仅运行 `node tools/test-control-directory-tab-budget.mjs --case sdk-budget,short-slots,negative-budget`。sdk-budget核320/366×1/1.3/1.6/2的directory/bookmarks Quick/Full及中途p，真实SDK Tab/Text/Toolbar/父List/footer extent与pure budget、原轨迹修正、全可见边界不重叠与parent exactsum；额外3.2只为真实16fp行高超过44的必要SDK增长边界，不当Native支持点。short-slots核Full190与真实上游landscape实参，摘要退让/隐藏、Toolbar不完整时禁用、viewport不足一整row要明确短缺，不用Math.max0掩盖。negative-budget拒绝旧Tab/List/Toolbar坐标、缺clip、半露Toolbar仍可交互、父footer扣量不一致和丢失字号增长。沿现有interactionEnabled&&progress===1统一父disabled/hitTest/a11y，所有Toolbar意图重复核当前owner，不靠clip隔绝键盘。有限platform端口仅源参数/SDK回调证据；原glyph/动作无关用例REUSED，不跑旧硬码current-toolbar或全目录门禁，Native过渡/字形/焦点/触摸与HAP均交root另证。

14.26首次准确批次未进入case：Node直接导入ReaderLayoutGeometry保留了其历史普通type import ReaderWidthClass，而该类型没有运行时导出。原attempt-01保留；按既有pureModuleProbe读取真实布局源码并显式接实际WindowMetrics/WidthClass函数，避免把Node模块兼容问题误判为生产几何错误。补测试本身有限HitTestMode端口，真实Native属性仍由SDK执行记录；不改生产布局或弱化预算断言，再运行原唯一三case。

14.26第二轮仍在case构造初期失败：局部parent树recorder把Native Image叶节点也当成有pop的容器，SDK Image无需pop导致错误的stack mismatch。保留attempt-02，只把Image交回既有有限native叶端口，Stack/Row/Column/Text真实SDK父链仍逐项平衡并保留所有预算断言；不改通用reader-control-native-tree helper或生产源码。继续原准确三case。

14.26第三轮sdk-budget真实140样本PASS。short-slots在零高slot处失败：test把高度0、已禁用/完全不可见的Toolbar原始top也当作占用区域，误报与y0空List相交；可见extent为0时没有可见交集。本地只把非重叠比较限定为正extent，同时要求零extent确定为0且enabled=false；极短headerShortfall/rowShortfall事实和所有非零可见边界断言保留。生产代码未改，140样本PASS复用，不重新跑；只续跑未通过的short-slots与未执行的negative-budget。


### 14.19-DOWNLOAD-PRIVATE-FINAL 排序命中重叠与章节定位旧idle（2026-11-03，执行前登记）

最后独立只读审计报告已固定final-source-review-findings.json：listControls方向实际24、response44在x-10..34，下一排序字段24+gap3=27起，两个真实不同动作重叠7vp；父工具行min38亦未支付44。selectionDock定位当前→locateCurrent只取消managing，而冷章节restoreChapterOffset已排idle/pendingtrue，dock不经List触摸，立即scrollToIndex之后旧idle仍可scrollTo旧offset。root明确授权关闭这两具体阻断后再候选。

本批只改SharedDownloadPage.ets与其test-shared-download-visual-contract.mjs准确case，baseline保存在.reader-artifacts/download-private-final-20261103。排序方向保留24paint，实际44carrier居中；工具行按真实page宽/scale支付目标、gap及相邻计数，必要换行，不外扩命中区。章节沿既有pending/scheduled状态加一次性epoch取消helper，在定位及同类不经List触摸的明确位置/列表意图与退场/切换前退役，不改currentChapterIndex语义、不重复回拉。没有其它生产actor/harness/JSON/message修改。

只执行node tools/test-shared-download-visual-contract.mjs --case private-tool-budget,chapter-locate-restore,management-scroll：前两新case为320/366/720×1/1.3/1.6/2/3.2工具真实SDK与父预算/7vp重叠负例，以及真实dock定位→旧idle拒绝/正常恢复一次/同类明确意图和取消负例；既有management-scroll保护helper调用点不改变严格anchor行为。不跑其它准确已通过场景、Source producer、全量、HAP或设备；失败原log保留、先源码定位。


#### 14.25 Directory target closure results (2026-11-03)

Actual FullDirectory private toolbar now keeps the authored32 paint inside44 action carriers (spacing5, zero outward response), pays50 for44 tabs plus top5/divider1, and stacks the query into a separate row only when actual actor innerWidth cannot hold the44 input and four tools. Native fixture requested widths cannot be overridden by global WindowCoordinator width. Chapter/bookmark List extents deduct the same real extra rows/height. Shared manga fallback cells pay both borders above44 inner download; branch controls use actual44. The existing public column planner pays independent44 reading plus download, padding/borders once, and the Tree-only compensation is removed. The three selected actual parents remain BookDirectoryPage fallback, MangaReadingDirectoryFallback and LocalBookDetail preview.

Controlled generation exposed historical output/source drift: the first canonical generation reverted three old visual-definition targets to24/26/36 and Tree SDK failed; that original failure is retained. Root authorized only clearWidth/clearHeight/downloadGridWidth back to production44 in Reader-UI visual.json, plus the existing generator column minimum formula. All other controlled values remain identical. Only the generator three outputs were produced; no --demo/whole UI generation. Definition SHA69ca1cd1..., generator73c987bd..., generated production48505a16....

The bounded HAP-attempt2 corrections replace four fixture object spreads by typed explicit copies and remove two redundant blocked comparisons after the existing mounted/busy/blocked guard. No admission or identity guard is removed. Compile acceptance belongs to the next root candidate; local method probes do not establish ArkTS/HAP success.

Exact final checks: private-toolbar+fallback-carriers together2PASS; scale-targets PASS8 width/scale contexts; fixture memory-actions/no-runtime/captured-retire3PASS; current-grid-geometry PASS; family generation and --check PASS. Private/fallback first attempts and the source-authority failure remain in the artifact with causes; only finite probe closure/rounding mistakes were corrected. Control tab/reveal/list/footer separately has140 SDK samples and short-slot/negative cases through its own owner. Full190 at2x cannot fit row64 into List44 (shortfall20); no full-row or E2/E3 PASS is asserted.

Exact baseline/current14-input manifest, frozen candidate ZIP, per-file diffs and original/final logs: .reader-artifacts/directory-target-closure-20261103/. verification.json SHA3071db922a51e71407d843ea6ea0fd6b7ac0c9204e09a748b3ff2e6eec103706; ZIP SHA3ad37f314a4f8f1479f61c16c64291ac9260bbdc4142cb5b195c20e6232cc92b. No build/HDC/device by this agent. Native glyph/clip/hit/focus/screenreader and Core tree business acceptance remain separate NOT_RUN; unchanged exact business/default-renderer cases REUSED.

14.24 active rebind after directory corrections: Source revision13, Directory5, control-registry8; four families/19 registrations/106 controls. Source fresh compile-fix reports ce3526f7.../5d0666d7... bound without overwriting history. validate-model/check-contract-refs/host-variants PASS; check-register retains only E2 FAIL19/E3 FAIL3, G-03 NOT_RUN8/B1 NOT_RUN2/SCOPE NOT_RUN1, zero stale/model/reference errors. Source/Directory/Tools semantics stable. Root then discovered and separately authorized two real Download action/restore gaps; central final manifest waits for that actor final SHA and only its necessary rebind, without rerunning Directory SDK.

#### 14.26-CONTROL-DIRECTORY-BUDGET 结果

Content `89e2f51c…`、新Geometry `f63cc1f3…`、独立test `e50984de…` 已稳定交root/目录登记owner。sdk-budget在attempt03真实140样本PASS（320/366×5 scale×2 tab×7 p，3.2只作行高超过44的SDK边界）；该批后续short0错误不改写，零extent修正后只跑short-slots/negative-budget并在attempt04 2/2 PASS。三个本地probe问题原样留存，未改生产迁就断言；SDK样本对应同字节生产明确REUSED_PASS，不冒充最终整批新运行。8个负例分别拒绝旧List/Toolbar坐标、缺Toolbar clip、半露enabled、无search当前守卫、List扣量错误、固定44无字体增长、缺摘要clip。

父预算已同源：Tab真实字号/高度/response与分割线边界一致；Toolbar完整子glyph与原路径只加必要clearance，父viewport按真实p/可用高度clip；父disabled+HitNone+隐藏AT和全部意图的mounted/interactionEnabled/p/完整fit守卫同时生效。摘要父viewport与List reservation共享连续headroom，内部48vp内容绝对glyph路径仍等于原坐标。Quick/Full及中途可见区不交叠，parent exactsum；进度0Toolbar确定0高且禁用。原Tab x/y、图标/字体角色、query/sort/定位业务与滚动owner保留。旧current-toolbar硬码坐标几何证据被本新准确门禁取代，不能继续写当前PASS；无关动作/字形来源证据可按原范围复用。

未隐藏真实短缺：Full190、2×为List44而row64，rowShortfall20/wholeRowFits=false；真实上游320×366 landscape为slot168/List22/短缺42，366×320为slot122/List0、headerShortfall24、Toolbar不完整禁用。这些只证明边界/退让和真实不足，不代表整行容纳、E2/E3或短窗口页面合规。正常320/366×844经真实上游2×后slot646/List451，无整行短缺。超小slot的header/row缺口仍明确；没有仅靠max0假造预算满足。

63个选定输入（含实际Panel/窗口/motion上游及Reader-UI registry）、原字节/精确diff、attempt01–04与准确复用边界见 `.reader-artifacts/control-directory-tab-budget-20261103/verification.json`，SHA `67898f41…`。不改Panel/Header/shared resolver/Button/Specs/SearchField、消息/注册或真实owner；目录agent已独立适配并执行原scale-targets到真实helper，Source报告不受该私有actor影响。SDK父属性/回调不等于Native键盘焦点、真实disabled继承、动效字形或触控通过；HAP、签装、设备与这些原生证据交root，未在本分项运行。

14.25准备最终公开源码归档：freeze-current-scope.mjs仅从本轮分批manifest、active输入与显式白名单收集当前源码/测试/登记/文档及Reader-UI该family三个受控输出，保留原分批版本与失败；不把旧PASS重新认定为新PASS，不复制私有签名/Native缓存/用户数据。所有候选稳定后标准zip压缩，并逐文件unzip还原核SHA与当前输入无漂移，用于untracked测试/跨repo受控源的可恢复性；它不是HAP/SDK全依赖或原生验收门禁。


#### 14.19-DOWNLOAD-PRIVATE-FINAL 结果

两具体阻断代码/SDK已关闭。排序方向真实width44、minHeight至少44并随当前字号增长，内部旧24paint及原sortIcon不变；排序字段在44+gap3后开始，无外扩response重叠。filter/sort/count按当前page可用宽度和字号声明宽度，正常单排，不足时父Flex/Column换行支付目标和间隙，旧38工具父最小预算已由真实增长目标替换。

章节复用原pending/scheduled并新增独立epoch取消helper；selectionDock定位当前先取消旧restore再按currentChapter既有3+ordinal定位。touch、common filter/sort Watch、manage/open/back、presentation和退场也退役旧章恢复；定位是唯一不经restore的chapterScroller.scrollToIndex生产点。quick-select仅改变selected indices并不移动scroller，不混作位置动作；普通list epoch原逻辑保留。

private-tool-budget首轮PASS，320/366/720×1/1.3/1.6/2/3.2共15组合及旧7vp overlap负例。chapter-locate-restore首轮新fixture误找原actionButton不存在的显式accessibilityText setter，原log保留，未达生产断言；仅改为取真实子Text对应的SDK Button，第二轮真实dock定位→旧idle不回拉/正常一次/7明确意图边界/缺cancel负例均PASS，management-scroll原严格anchor/frame/Area回归PASS。已PASS工具预算代码/body未变，run01证据复用，不重写成第二轮运行。

最终SharedDownloadPage fa5e4775c9c3699e6b8a56ec34e171515acb9521c6b39c8dfd99a9c6228e8ce2，测试d510d63103d54564e40d1fb78f733091145589c8792223b85e36ebaf7b0d3e58；root和finish_directory已先收到stable SHA与准确log，之后仅归档。全部before/current/diff/log/verification/registry-updates及source-inputs.zip位于.reader-artifacts/download-private-final-20261103。未改其它actor/harness/主register/messages，无build/HDC/设备；native字号/命中/滚动仍NOT_RUN，不以本轮SDK关闭原生E2/E3。


#### 14.24 Final active register after private Download closure and explicit Control shortfall (2026-11-03)

Final active scope remains the same five JSON: page-structure/register and contracts/{contract-map,navigation-registry,control-registry,platform-host-registry}. Four families,19 registrations,106 registered controls; Source13/Directory6/Downloads5/Tools1, contractMap2/navigation3/control9/platform2. Historical stage5 authoring files and root model/schema/derive/check scripts were not modified by this registry owner. Source fresh compile-fix report paths bind ce3526f7.../5d0666d7..., with native acceptance unchanged.

Control-text is explicitly a current SDK adaptation/content failure: real upstream2x320x366 slot168/List22/row64 shortfall42;366x320 slot122/List0/incomplete toolbar disabled; Full190 gives List44/row64 shortfall20. Continuous overlap is repaired; normal844 gives slot646/List451. Owning adaptation/interaction/content remain FAIL, E3 FAIL now states the actual code-side shortage plus typed owner/reviewTrigger/exitCriteria. The record requires a deliberate compatible Panel/Header/slot allocation decision before short-landscape acceptance; it does not invent another shell, use a font cap, or treat failure as native NOT_RUN. Unrelated private/fallback test evidence was removed from this variant.

Download fa5e4775... and accurate testd510d631... are final bindings. Actual listSortControls44 carrier contains approved24 paint without overflow, actual sort pair pays44+gap3+field, and filter/count/inline-or-wrapped parent reserve width/scale. Existing selectionDock locator cancels pending chapter idle epoch before unchanged index3+ordinal action. Actual15 SDK combinations/old-overlap negative and locator/7 retirement boundaries/missing-cancel negative/management anchor checks passed in the independent Download artifact. Existing controls are extended with the real Builder/locator source symbols; no new operation or fake native result was added.

Final necessary checks after these typed facts: validate-model PASS; check-contract-refs PASS; check-register FAIL with only E2 FAIL19/E3 FAIL3/G-03 NOT_RUN8/B1 NOT_RUN2/SCOPE NOT_RUN1. No stale byte, schema, owner-reference or model assembly error remains. host-variants is REUSED from host-variants-target-final.log PASS by root instruction: final changes are source/budget/failure-reason bindings, not route/platform-host ownership, variant grammar or its fixture rules. Native glyph/system scale/hit/clipping/focus/screenreader, business receipts and known Control short-landscape budget are not promoted by schema/SDK PASS.

All98 unique active source/report/test bindings match current SHA. Exact active JSON/current gate-input manifests, per-file before/current diffs, original attempts and final logs: .reader-artifacts/page-structure-active-final-20261103/. Final verification SHA446fd9984b13fed1072c273a3a3b4fc3348eb6427016f91d170233f43e3ba585; active/gate candidate ZIP SHA4455a1becbe653927d571ffc6f1707dabe7f4e20259ce3c16b083eb6c491a6f2. Register SHA cdbefd0361cf40555d109ec62bda215284e43f637b6b804dd98e8450d0134ff6; control-registry SHA abb1a08ed556ee4be71f0f70261b864f518b2ebb9f8782240335455398998a88. Production/tools/active JSON stable notice delivered to root before archiving; subsequent writes here only docs/artifacts, with no build/sign/install/HDC/device action by this agent.

#### 14.25 签名候选结果

第三次规范构建PASS：run `20261103T100047Z-fce869a1-5edae333`，signed HAP SHA-256 `f6be4a9f64da92e98046a664ef5f2232e5342b75ea7a6d0a02f2beb2e092b905`，214529825 bytes；指定证书SHA `3a563778e5bf17cd3ead0218e13b4a5030de3f5d7d4e21e0336d8eb37b676dc4`、debug Profile和包身份验签通过。完整ArkTS语义、非增量assemble、资源/Native/构建身份与前后input fence均PASS；contracts scope none/Core/业务全量未运行、acceptanceEligible=false。原attempt1/2 FAIL及其准确原因不追改，编译成功不是设备/读屏/字形通过。

不可变manifest：`.reader-artifacts/page-structure-final-20261103/hap/20261103T100047Z-fce869a1-5edae333/manifest.json`；当前可审阅摘要signed-candidate.json含Harmony/Core commit与dirty、source/controller绑定、精确HAP和证书/门禁结果。未安装/启动/截图/交互/修改系统字号；后续部署只消费这次signed artifact和匹配storage companion。


### 14.28-DIRECTORY-PREFIX short-content A: Native-only Tree prefix (before execution)

User requires completing the known short2x code gap. Parent authorizes A from control-directory-short-landscape-plan: Content/Geometry/focus/flat-bookmark owner is finish_source_owner; this scope owns only NavigationSurface/List optional headerCount0/1(default0), prefixBuilder(defaultempty), measured/fallback prefixHeight and prefixIdentity, plus exact new SDK test and current active facts. Original bytes in .reader-artifacts/directory-scroll-away-prefix-20261103/baseline. No Core protocol/rank/cache/page offset, navigation owner, extra Scroll or global motion changes. Default callers must retain exact no-prefix mapping. Prefix is one real Native ListItem, and every getItemRect/scrollToIndex/first-visible/anchor path maps only Native indices. A visible prefix produces no chapter anchor; Core data counts/pages remain unchanged. Loading/error/query-empty must keep prefix/query-clear reachable through the same main List and existing PageState/Recovery categories.

New precise check: node tools/test-directory-scroll-away-prefix.mjs --case indices,anchors,states,default-consumer. It covers Native index+1/rect/START/CENTER and original default0, header0 not written as chapter, same dataSource counts/paging/proof, current-view/prefix switch retirement, Tree filtered-empty and Surface loading/error with prefix and existing message owners. Reuse unchanged manga business/target/fixture cases, only one accurate default current-position consumer if extraction itself changed. SourceOwner runs its exact Content/focus/flat cases independently. Any moved message source entry updates its existing owner registry and runs checker only selected Surface/List files; no full message tree. Parent owns constrained model/schema/derive extension for primary Inline+ScrollAway; no false secondary priority and no invariant PASS from SDK alone. Final typed active/schema/reference/check-register rebind is bounded after source stability; no build/HDC/device by this agent.

### 14.27-CONTROL-DIRECTORY-SHORT 可执行短内容区装配（执行前登记）

用户要求全部完成，按已审只读推荐A补当前可定位修复的短横屏。HAP3继续保留为中间签名候选，本地改动不代表安装/交互授权，Native仍pending。本分项独占ReaderControlDirectoryContent/Geometry、必要的ReaderSearchField目录opt-in focus与独立具名test；原三文件字节及NEW test已冻于 `.reader-artifacts/control-directory-short-content-20261103/baseline/`。目录agent独占NavSurface/NavList prefix与索引映射及中央JSON，root独占model/schema/derive。不得修改旧冻结报告或为本工作扩跑HAP/设备。

接口已约定headerCount=0/1(default0)、prefixBuilder默认empty、prefixHeight=0、prefixIdentity=''；short只在稳定Full端点由未clamp fixedChromeHeight+minUnitHeight>availableHeight/完整Toolbar不足选择。Quick和正常纵屏原glyph/装配保留，短Header/查询/定位/排序/摘要进入现有唯一List一个prefix，不包第二Scroll；empty/error/loading亦保prefix可清query，Tree由Nav接口接，flat章节/书签需同Native index映射。切换/字号/窗口/旧idle/焦点代次同presentation，prefix不能作第0章，业务proof/缓存原义不动。

Geometry输出未clamp fixedChromeHeight/minUnitHeight，root用数值Brief.queryViewport推导constrained→Inline，不谎改queryPriority。SearchField新增目录专用focusId/allowed/revision/callback默认关；仅当前id真实布局完成、mounted/loaded/current的一次有限idle可程序恢复，旧请求/取消/退场拒绝，无轮询。查询与按钮用现有field/字体/图标/44carrier，short模式不沿用旧toolbarComplete=false而永远禁用query，callback仍回本owner。

仅本分项新增 `node tools/test-control-directory-short-content.mjs --case short-sdk,prefix-anchors,directory-focus`：真实SDK短header/flat List prefix、122/168/190 2×完整64章行与44 actions/清筛选/章节书签/原query动作构造及native命令接线；full↔short默认轨迹、数据index↔Nativeindex/锚点及旧idle退役；实际SearchField opt-in Native id/布局/一次idle current focus、旧id/取消/退场负例与默认book/source未开启对照。有限native/Scroller端口不证明真正平台滚动物理、键盘/触摸；后续与Nav新prefix消费者精确联调，不跑全应用。新SourceReport受SearchField字节影响由root安排downloads定向补，不重复不相关回归。失败保留先定位，只续受影响case；新canonical HAP由root单独执行。

### 14.29 主查询在真实矮视口的响应契约（执行前登记）

用户要求全部完成，继续修真实短2.0×缺口，HAP3保留中间候选。root仅改model/schema/derive和新增test-query-height-fallback.mjs，不改两agent的production/active。PageBrief optional queryViewport仅允许availableHeight/fixedChromeHeight/minimumContentHeight三个有限数值，来源为当前Geometry未clamp预算；derive内部计算queryHeightClass，不接受作者手填constrained布尔。priority仍primary，required chrome+最小单元超过当前视口时模型返回Inline，实际唯一主List的prefix随滚动离场。未给viewport的所有既有页面仍按原规则；CompoundSearch不支持Inline时仍GRAMMAR拒绝。不得通过改priority或新增外层Scroll关闭失败。

只跑node tools/page-structure/test-query-height-fallback.mjs --case query-height（SDK固定Ajv校验新Brief，原normal/足够/边界/短预算确定性、无效/缺失/伪class输入、复合搜索非法组合与真实primary保持）；中央active变体完成后由既定validate/refs/register精确入口核完整绑定。没有全量/Core/设备；新schema/derive已在新artifact baseline冻结，失败先留log定位，不覆盖HAP3/旧PASS。

14.29首次准确query-height在SDK固定Ajv strictRequired编译schema阶段FAIL：allOf if.required声明queryViewport但该if子scope没有properties。补if内显式property/type，不关闭strict、不削非法预算断言；原attempt1保留，再跑同一准确case。

14.29范围补充：embedded只豁免整页header/prototype推导，不豁免真实queryViewport决策。check-register对显式预算嵌入宿主单独计算query选择并核实际placement；仍留SCOPE NOT_RUN，不伪整页PASS。新query-height同一准确case追加真实embedded基线fixture的Inline正例、HeaderSlot/伪预算反例与双scroll-owner负例，不跑其它框架套件。checker当前原字节另冻baseline。

14.27 root补充授权最薄ReaderDirectoryToolbar焦点透传：正常Content的input由它持有，若不透传就无法normal→short捕获/short→normal恢复；本批增加该单文件baseline，四个目录focus端口默认关闭原样转发，不改其图标、尺寸或动作。Nav共同约定再增prefixRevealRevision=0，仅取消旧Native pending/layout epoch，不取消Core query/opening；显式header/focus reveal前由当前Content递增，empty/state始终保header。

14.29可复验性复核：新具名framework case去掉对ignored历史artifact的直接运行依赖，改从正式register抽取当前真实control clone；baseline字节仍只作记录，不是测试入口。准确case框架可随源码/active恢复运行，不需本机私有缓存；同一query-height最终补验一次，不扩用例。


### 14.19-SOURCE-SHORT-FINAL 目录focus opt-in的默认隔离与Source证据（2026-11-03，执行前登记）

新短高修复仍归Directory/SourceOwner。当前Source相关实际受影响文件仅ReaderSearchField.ets（inventory19输入之一）；ReaderDirectoryToolbar/ControlDirectoryContent/Geometry/NavSurface/List不是Source producer输入。ReaderButton/Specs/SurfaceResolvers/SourcePage均不改。ReaderSearchField before已从前次immutable ZIP恢复，SHA4ade02f07ac5c0182ae0ac87679595b32aaea62c74ac60c15a0d6b930fac3ed1、24173B，与成功HAP3 source-snapshot精确匹配；before-binding.json记录来源，不取中途dirty字节冒充before。

按root最新范围，等Field/Toolbar与登记owner稳定后才执行：新增准确`tools/test-source-search-defaults-sdk.mjs --case defaults --before-field=.reader-artifacts/page-structure-short-final-20261103/ReaderSearchField.before.ets --evidence-path=.reader-artifacts/page-structure-short-final-20261103/source-search-defaults-evidence.json`，通过真实SDK lowering比较before/current的Source live、RSS passive、BookPage/BookPanel默认native attrs/事件准入，Directory默认不开焦点，显式错误variant的focus端口不得产生id/焦点/Area setter或focus请求；必要Book路径仅默认attrs及原guard对照，不扩业务。Native focus/controller是有限端口，不能声明键盘/VM Focus成立。若Source库存probe缺新Focus闭包，仅选入真实方法/props/FrameCallback依赖，不改SDK或生产迁就。

随后仅执行inventory/sdk-targets/recovery-targets准确完整原子producer，输出新short-final/source-interaction-evidence.json，旧证据不覆盖；inventory19不读主control/register，登记owner修订不需并发重跑。matrix17全部SHA若仍同即REUSED原ce3526f7报告与真实log，不复制伪fresh、不重跑。Owner/filter/scroll/contract/11消费者用作用域与默认隔离证据精确复用；不build/device，当前签名HAP3原样保留、短高修复另候选。失败原log保留，最终报告绑定root/Directory当前稳定字节。

### 14.30 短viewport原生组件路线（执行前登记）

用户已明确授权现有模拟器保数据更新/启动/截图触摸Back焦点/真实字号并恢复；不卸载清数据重置VM、不提交登录或写导出文件。同范围不再重复询问。先完成当前ShortFlow代码和新签名候选再部署，HAP3作为冻结中间证据保留。

root仅补debug ReaderDirectoryStructureFixture可选controlViewportHeight（default0保原实际Frame，显式仅122/168/190）及真实innerArea日志；mainharness新增3场景。它约束真实原生组件视口，不注入系统字号、不冒充系统横屏FullStage。源码不新建Runtime/Host/数据；原EntryAbility启动仍按规范准入。冻结4个当前fixture/harness/test字节在short-native-fixture baseline。

准确门禁只：test-directory-native-fixture --case short-control-viewport（实际SDK child initializer default/122/168/190与错误值、checked字体/debug准入、真实innerArea vs请求值）；test-page-structure-native-fixture --case fixture-scenes（新3场景×2宽、当前/旧菜单callback生命周期），原font/admission/source callbacks未改按源码明确复用。无Core/全量/设备；随后新canonical HAP验证完整ArkTS。

14.28 prefix SDK closure and exact shared-focus consumer: first new probe lacked declared BuilderParam metadata, then lacked ArkUI lazy ListItem materialization; both retained as FAIL before correcting only the finite native deep-render seam. A genuine forbidden const in build/@Builder was caught and replaced by ordinary captured-action factories, preserving guarded page-state owner. New default Grid/Port probes required the actual nativeHeaderCount/nativeDisplayIndex/bindPrefixScrollIntent thin helpers; existing behavior assertions remain. Root now owns its fixture test additions; no overwrite from this agent. SourceOwner opt-in Toolbar focus refactor changes its real build closure, so only existing test-directory-structure-budgets --case scale-targets is added as an essential consumer check after that source owner declares stable. Freeze current test before adding real toolbarBody/currentDirectoryInput and default focus fields; do not run during partial edits or broaden to other directory cases.


#### 14.28 Native-only prefix local result (2026-11-03)

Surface/List optional headerCount0/1, prefixHeight/Identity/Builder and prefixRevealRevision are implemented; default0 and every manga path add no item/rank. Native-only mapping covers getItemRect, scrollToIndex START/CENTER, first visible callbacks and semantic anchors. Header visible means no chapter anchor; zero-data header/status indices0/1 both yield no data rank and no RPC. Core count600 and actual page request256 remain600/256; pending Core pages and selection generation survive UI-only layout changes.

Three property watches in one reconciliation capture the old native coordinate space once. Prefix layout epoch is separate from business generation. Explicit reveal/focus owns a UI intent across later Area receipts before Native scroll acknowledgment, rather than restoring a stale chapter; native drag, explicit Top/Bottom intent or a new Core view retire it. Prefix-enabled positive viewport Area receipts continue reaching the layout owner; default0 remains first-layout-only. Optional-prefix post-retirement Area/index/stop callbacks are ignored.

Loading/error and filtered-empty keep prefix and state on one native List. State items have natural/minimum44 extent even for prefix180 versus viewport122, without percentage item height or viewport-minus-prefix zero. Clear/retry actions use existing ReaderPageState, with captured mounted/source/book/generation/view guards. Added one Surface.treePrefixEmptyState registration and amended only original Surface.build owner text; all other message/scope/exception structures and root three debug-font entries are preserved. Selected Surface4/List1 checks PASS; later only non-message Area guards changed. No full-tree message check.

New exact same-process indices/anchors/states/default-consumer4case PASS in prefix-retire-final.log. Current default Grid selected case passed; after that only text opt-in Area/retirement changed, so its receipt is REUSED, not rerun. Default Gateway-versus-Port/no-runtime2case passed after actual helper extraction adaptation; root now owns its separate debug fixture test and final SHA. All first FAILs are retained: omitted BuilderParam metadata/lazy native materialization/child declaration in new probe, missing thin helpers in old capture-only probe, and a real forbidden const in ArkUI build caught before HAP (replaced by captured ordinary action factories).

Own five-input candidate and exact before/current diffs frozen at .reader-artifacts/directory-scroll-away-prefix-20261103/; verification SHA6e9e349f00a7b822bbf10b3b530938ffbee246b6b8d32824b06807fd68842fa3, ZIP b941d625f98357c65e4ff0112bcc4cb5f6e174916ac0db670371c86c04af7285. SourceOwner joint Content/Geometry/Field/Toolbar proof and central responsive variant still follow its actual stability. This local result does not claim native glyph/system-scale/scroll/focus, Core tree business, build/sign/install/HDC or product acceptance.

14.27首次定向执行short-sdk在查询动作selector处失败（0个预期label）；保留attempt01，先核真实SDK构造出的prefix/44工具与modifier观测，不把缺label直接当生产控件不存在。期间共同只读审明确的Tree flat双owner与If重挂问题已按Root要求修为唯一List宿主、Tree锚点只归NavList；仍未声称本批测试通过。新增IME真Insets迁移语义采用仅Directory opt-in enableKeyboardOnFocus flag：Back隐藏后程序恢复不再重新弹键盘，其余默认路径无setter。所有变化继续在本批原准确三case复验，不扩全量。

14.27 selector定位：SDK把普通prefix/state ListItem内容编成传给Native ListItem.create的deferred renderer，现有限SDK port只记录它、不会主动渲染；原61个ListItem/64高行已实际构造，但header body未被调用。attempt02保留，不改生产迁就缺label；测试在实际Native create参数中取出renderer并仅各调用一次，执行真实已编译闭包后再断言控件。不是手写header或Scroll模拟，不声称Native滚动物理通过。

14.27第三次失败在实际deferred renderer入口缺ViewStackProcessor记录端口；沿现有Source/目录SDK consumer的精确StartGetAccessRecordingFor/StopGetAccessRecording有限空端口补齐，不模拟layout或改通用helper。attempt03保留。后续同批还核Root发现的IME hide→program focus重开风险，目录explicit flag的native setter与一次请求/重复Area负例一并纳入原directory-focus case；默认路径仍无该setter。

14.27第四次已构造真实prefix与五个44工具，执行真实query onSubmit进入原search后发现局部Native端口缺全局Edge（不是业务/布局错误）。补与ScrollAlign/ScrollSource相同有限枚举记录，deferred renderer同时按SDK真实签名传(elmtId,true)；attempt04原样留存。不手写搜索/排序实现，不用mock action替代owner；继续原三case。

### 14.31 已授权原生分支：准确目标/直连准备

用户已允许原范围，先在A本地SDK收尾期间并行做只读准确目标准备。唯一HDC入口reader-hdc-lease --target discovery --server-key127.0.0.1:8710 --hdc当前SDK绝对路径 --agent-id reader-page-structure-final -- list targets -v；禁用自动服务拉起，清除8项大小写代理变量并NO_PROXY/no_proxy=*。独立ps/lsof/route只读确认现有Emulator/SDK listener及实际回环路径，防错server/错设备/代理；不安装、启动、截图、触摸、改字号或恢复服务。原始私有target列表在ignored artifact保存，公开只用targetRef。

此步只证明当次discovery/host路径，boot/SceneBoard/安装App/Native/fonts仍NOT_RUN；规范install会在当前新候选manifest就绪后同租约完成新鲜boot+身份+停写备份+inspector+保数据更新，不把本步历史JSON当permit。Discovery失败有界保留/源码host排查，不循环重连。其它3agent不碰HDC，Node源码/SDK准备可独立继续。

14.27 attempt05的short-sdk已PASS。prefix-anchors下一断言FAIL：有限Scroller观测端口在首次restore native5后仍固定报告旧native6，第二次capture合法读取6，故不能期待6。保留该失败，测试显式提供首次定位后的观测index5再验证后续5→6，不用改生产或放松断言。另补当前Content predicate穿过薄Toolbar传至Field：props异步尚未刷新/旧节点尚未卸载时，旧idle也必须被实际presentation拒绝；默认predicate为true且无新增Native setter，不影响默认消费者。现有Book路径原有enableKeyboardOnFocus(true)保持，Source/RSS默认无新增该setter。准确门禁仍为本批short-sdk/prefix-anchors/directory-focus三case；Toolbar opt-in的旧回调/默认命中一并用实际SDK构造核验。

14.27 attempt06的prefix-anchors已PASS；directory-focus默认路径断言FAIL实际3是SDK记录node自身elementId，不是Native.id setter。用原attributeCalls明确检查没有id/键盘/focus listener属性，不改生产迁就记录字段。目录联审同时发现真实意图冲突：syncContentLayout不能无条件递增prefixRevealRevision，否则NavList把普通resize误当用户显示查询。移除该递增，只在focused restore/显式clear时发送header意图；新负例核无focus Tree resize的revision不变及chapter owner不被覆盖。该真实修复仅重跑本批受影响原case；attempt06保持原失败。

14.27 attempt07 short-sdk与prefix-anchors均PASS；新增Toolbar真实SDK组合失败因有限Child构造端口未保留owner/id，ViewPU.create无法挂载。补该记录端口的构造字段，不改生产Toolbar/Field、不模拟focus/layout。只复验仍失败directory-focus，前两case源码与输入均无新变化，保留同批PASS而非重复运行。

14.27 attempt08 Toolbar实际SDK回调/卸载/当前owner负例已走过；后续默认RSS断言端口错误：rssPassive真实构造Text而非TextInput，不能读取不存在input的onFocus。改成对原Native attributeCalls统一断言无新增id/目录focus/键盘setter，并仅在实际存在TextInput时核字段；不伪造RSS输入或改variant分支。继续只复验directory-focus。

14.27原准确三case已分段全部PASS（attempt07前两case、attempt09 focus）；生产四文件稳定。为最终short-sdk覆盖真实320/366两种Full内宽（既有Layout/Motion闭包给268/314）以及已有top/bottom/sort/load动作，追加同case输入与实际回调断言，不改生产；这使原short-sdk的窄268样本证据待该准确case复验，其他两case保留REUSED。不得把有限Scroller记录命令称为真实物理命中/滚动/IME通过。原14.25短slot关Toolbar的报告保留历史，当前A只以新short-sdk和Nav prefix映射报告证明替代装配。

14.27生产/tools稳定通知已发：三case分段最终PASS。最后只按Root要求运行同进程准确三case一次，唯一待答问题是最终脚本新增Toolbar/两宽输入后跨case SDK id/child记录是否相互污染；分段PASS不能回答同进程组合，故旧通过不能替代此项。执行前冻结这五个当前文件及实际静态依赖快照/输入SHA，命令仅node tools/test-control-directory-short-content.mjs --case short-sdk,prefix-anchors,directory-focus，无嵌套业务/Core/HAP/设备门禁。失败立即保留/定位，不自动补全量或安装。

#### 14.27 本地装配/焦点完成记录（2026-11-03）

最终同进程准确short-sdk/prefix-anchors/directory-focus三case均PASS。冻结244静态依赖输入到control-directory-short-content-20261103/candidate.zip（5772155d49953173ad2b76c74eef9eb37d1c225dbf4a87992663c9f1b550c9a8），四生产文件与新test的原字节/当前字节/diff独立保存，不靠累计dirty diff。此前全部失败日志保留，分段通过不改写成一次执行。

Full短槽位采用同一List的一个scroll-away prefix；唯一List宿主置于响应式If之外，SDK记录同一个Surface对象/Port reference且Port构造一次。Tree rank/node/fraction不再被Content的flat snapshot.rows覆盖；flat native/data ±header和header非第0章、旧idle/真实用户取消有准确负例。普通width/height/font更新不发显式showHeader意图；focused restore/clear才递增prefixRevealRevision。

真实320/366 Full内容内宽268/314、2x的122/168/190三slot均触发短结构：目录raw fixedChrome146/minimumContent64；书签147/180。新List viewport为实际122/168/190，前缀目录完整271/未完整320、书签201，所有44目标与64章行可在prefix滚走后完整进入；180书签卡在122允许自然滚动看完，不称一次容纳。查询/清除/定位头尾/排序/完整目录请求沿原owner，loading/error/empty不丢prefix与清查询。

目录Focus opt-in默认关闭，Source/RSS/defaultDirectory无新native focus/Area/keyboard setter；Book保留原enableKeyboardOnFocus(true)，其before/after消费者由独立精确报告负责。Field/Toolbar真实SDK已核一次有限after-layout请求、currentId/revision/mounted/ticket/live parent predicate，以及旧回调/取消/卸载；parent predicate在props尚未同步时仍拒旧presentation。恢复键盘flag来自真实WindowCoordinator Insets，Back隐藏IME后迁移不再由程序restore重开；普通用户点击不受该non-click setter限制。该证据不是原生IME/焦点时序PASS。

ReaderSearchField c8f8cfd88a598d14c0b6140d4a562712a0e81581e91c077221548cb73b699070；ReaderDirectoryToolbar d71cc076fbca8fb53d81b557569a8966d17eaed0a3e66f6b867f9414fc6f88d5；Content c5ce580092b957b07b398391f87fb721eb8f137d788c0c118c39fd95965266ed；Geometry f535382c115e345fb226ebd7bbd85f99e285f6d20833f33d8f79a7aa0aa97366；新test d034bebe789bd98c2c534c15867a7f4acdc63a56def47b575f111c7abf392669。此后仅artifact/docs整理。Directory负责active/model引用与真实Nav prefix证据，Downloads负责默认共享消费者及Source报告重绑。未构建/签名/安装/HDC/设备；原生glyph/OS2x/滚动/命中/焦点/返回/产品验收仍由Root新canonical分支分别验证，不能用本SDK报告关闭整页E2/E3。

14.29最终fixture语义校准：146+64预算例子来自2.0×章节角色，显式把抽取brief与隔离embedded fixture的fontScale置2，避免以1.0验收点误称其为真实采样；预算推导本身不从字体猜高度。只重跑同一准确query-height，保留早期log。


#### 14.19-SOURCE-SHORT-FINAL 结果

共享Field c8f8cfd88a598d14c0b6140d4a562712a0e81581e91c077221548cb73b699070、Toolbar d71cc076fbca8fb53d81b557569a8966d17eaed0a3e66f6b867f9414fc6f88d5定稿后执行。默认隔离defaults PASS：Source live/RSS passive/BookPage/BookPanel/defaultDirectory×1/2共10组真实SDK，Native属性和callback渠道一致，edit/submit与retired guard行为相同；Book五个原声明逐字相同、Book原native id及enableKeyboardOnFocus(true)保留。Source/RSS/Book误传Directory Focus允许/id/revision仍不接入新id/onFocus/onBlur/onArea/keyboard setters，三错误variant负例及去掉variant fence的泄漏mutant被拒绝。默认Directory FocusAllowed false/id空/revision0，keyboardOnFocus默认true但关闭opt-in不触发新setter。

首次defaults在比较前因官方SDK静态Book input ID map跨before/current独立编译单元残留而FAIL；原log保留。沿现成fixture模式在每个独立unit save/clear/finally restore该ID registry，保留unit内官方diagnostics，不改SDK或生产；第二次准确defaults PASS。快照只规范化SDK生成numeric element id和attributeModifier recipe内部对象；真实modifier输出setter另逐项对比、字符串native id保留，不把闭包身份当行为。

受Field输入影响的inventory/sdk-targets/recovery-targets首轮全部PASS，short-final/source-interaction-evidence.json SHAb142fdab0bc2b261baefe8d18a1f71feda505b678273f73ee72d21cc45b3ef0b；34templates/19暴露点/4手势，200SDK+48恢复样本，21个当前输入无drift。Source库存probe仅补真实Directory方法/props/Area parser闭包；新增实际读取的ReaderPageShell与SurfaceResolvers也加入报告输入，19→21不是控件数变化。Native focus/keyboard/hit/font仍NOT_RUN，整页E2/E3保留FAIL。

Matrix17全部字节仍同原ce3526f7报告，直接REUSED其原report/log，没有重新执行或复制伪fresh。SourcePage/Owner/filter/scroll/contract/11消费者亦按不变作用域+默认隔离证据精确复用。Root/Directory已先收到当前report路径SHA和稳定tools（defaults381ac108…、inventoryce15820f…），本agent停止生产/tools写入。完整before(HAP3快照匹配)、current输入、首次失败/修后log、helper diff、复用证明和source-short-final-inputs.zip位于.reader-artifacts/page-structure-short-final-20261103；verification SHA9e1733d3db8c58f1e3c3eeb4f6b4e44aa6b4800543fdc50151163d21422731f8，39项联合显式输入。没有本agent构建、签名或设备动作；已签HAP3保留，新增短高代码由root另建候选。

#### 14.27-HAP4 API形状修复（执行前）

Root canonical HAP4在全工程CompileArkTS阶段FAIL（汇总ERROR2/WARN493；唯一源码error为ControlDirectoryContent.ets594）：Text.textOverflow传TextOverflow enum而当前SDK要求TextOverflowOptions。先冻结当前Content c5ce5800…及定向test d034bebe…原字节和原HAP4错误片段到control-directory-short-content-sdk-api-20261103/baseline，旧HAP4/三case报告均不覆写。最小生产修改仅把short summary参数改为{overflow:TextOverflow.Ellipsis}，不动布局、callback/focus/Tree映射、消息或其他actor。原short-sdk增加实际SDK Text modifier对象形状断言，只执行该准确case；旧prefix-anchors/directory-focus行为未改，精确REUSED。SourceReport21实际输入不含Content，不重生。Directory负责后续active哈希/最小refs/register重绑，Root新canonical HAP5另记；本分项不构建/设备。

14.25/14.29 HAP4完整编译FAIL：唯一源码诊断为ReaderControlDirectoryContent摘要textOverflow枚举不符合当前TextOverflowOptions对象参数，汇总ERROR2/WARN493；原log与dedup JSON保留。没有发布新HAP或安装旧HAP3。只修API调用形状/实际modifier断言，short-sdk精确补验；prefix/focus/defaultSource/21inputreport不因未影响参数重复运行。数据/S8/框架状态不伪PASS，active重绑真实新字节后同canonical HAP5。

14.27-HAP4最小修复完成：仅TextOverflowOptions参数对象及原short-sdk实际modifier断言，准确short-sdk PASS。Content新SHA ac605184c589c3856e193176447224447bd6728f6bd648b2f9a7bad2e29f9a0a；test b288c493ca9e0de50d85aff0578dccbb149e345aafb38bdbff26df69cf231ee2。原prefix-anchors/directory-focus方法和对应生产owner完全未改，精确REUSED；SourceReport21输入不含Content且Field/Toolbar无漂移。新artifact control-directory-short-content-sdk-api-20261103保留baseline/diffs、原HAP4错误、实际SDK log及244输入+前次snapshot的两文件overlay。生产/tools已稳定通知Root/Directory；旧报告不覆写，Root后续HAP5/原生各自记账，本分项未构建或操作设备。


### 14.28-HAP5 binding correction (before final checks)

Root HAP4 found one actual compiler error: Content textOverflow requires an options object, not the scalar enum. SourceOwner changed only that API shape and added an actual SDK modifier-object assertion; exact short-sdk PASS. Current Content ac605184... and testb288c493... replace previous pins. No Geometry/Field/Toolbar/Nav/source-report input changes, no budget/decision/registration meaning change. Freeze old register in .reader-artifacts/page-structure-hap5-binding-20261103 before updating only matching source/sourceInputs SHA fields. Necessary checks are check-contract-refs and check-register (current source pins); previous schema/host/query-height and unaffected prefix/focus/Source reports are REUSED, not re-run. No native PASS and no production/tool edits by this registry owner. Root owns next canonical HAP and authorized device actions.


#### 14.28 final responsive register and compiler-correction result

Four families/21 registrations/107 controls are active: Source14/Directory7/Downloads5/Tools1, control10. Normal control registration is conditional on authored geometry fitting. Two short variants retain primary query and actual distinct numeric witnesses: directory available122/fixed146/min64, bookmark122/fixed147/min180. Both168/190 remain constrained; H320 differs by tab (directory fits210, bookmark327 does not), so one generic witness is not reused for all tabs. Canonical prefix extents are271 complete directory/320 incomplete directory/201 bookmark. The prefix scrolls in the one real Native List; bookmark180 may be read in portions, never claimed wholly visible in122/168. Actual source/geometry samples e8065d16... bind these numbers.

The unique Content listBody Stack stays outside chrome If, preserving the same Tree/Port owner; Tree canonical anchors stay in NavigationList and are never interpreted as flat snapshot ranks. Retained Builder callbacks read current responsive owner; only semantic/structure presentation keys rebind short header/query controls, not each Area/font receipt. Opt-in Field/Toolbar focus has current-owner/mounted/foreground/Area/frame guards; Source/RSS defaults preserve native attrs. Old scale-targets consumer was adapted to exact new real helpers/default fields and passed8 contexts, with no font/height expectation change.

Initial final four exact structural gates: validate-model/refs/host-variants PASS; check-register retains only E2 FAIL21/E3 FAIL5/G-03 NOT_RUN8/SCOPE NOT_RUN3/B1 NOT_RUN2, with zero stale/model/reference/queryViewport errors. All101 unique active source/report/test bindings matched. Source fresh interactionb142fdab... binds21 inputs/34templates/248 SDK records; matrixce3526f7... is REUSED at its original path/log because all17 inputs are unchanged. Source producer verification.json is preserved; central artifact is separately active-verification.json SHA4f65ca0e4ec0b34561ab6185e6d02bf439990d0f328e61516e72c05b3a11cb93, candidate ZIP d3588c15....

Root HAP4 then found the one TextOverflowOptions API-shape compiler error. SourceOwner corrected only that object form and added an actual SDK assertion; short-sdk PASS. Central final29 source/test pins were rebound to Contentac605184... and testb288c493..., without changing facts/semantic revisions. Current register SHA bef758767a2d60054a9c32a38065adff596afab76c4242486d1a181d760cb05b; control-registry still0f89b1ee.... Exact refs PASS and check-register same known statuses; schema/host/query-height and unchanged behavior evidence are REUSED. New before/current/diff/log/zip at .reader-artifacts/page-structure-hap5-binding-20261103/. Root received stable notice before further artifacts; no production/tools/active edits after it. Native/system-scale/glyph/focus/IME/Back/readout, Core tree business and user acceptance remain separate, not a local SDK PASS.

14.31部署入口预登记：新签名候选就绪后，artifact编排deploy-current.mjs只调用原hap-pipeline inspect/install，显式signed/preserve/local VM/current target，CARGO_TARGET_DIR仅绑定已核匹配的Reader-Core/target/storage-inspector；不编译Core、不改Native identity或签名材料、不自建install实现。当前发现target与实际HDC/Emulator sockets匹配lo0，guest/App Ready尚未由此证明。规范inspect先作只读观测；install独立新鲜准入、停写备份/DB-WAL及boot/身份复核、replace -r后签名复核，默认普通启动亦单独记账。若需诊断冷启动，普通启动后只对本包做一次获授权force-stop+既有readerOpenSourcePilot=true冷启动，不重置/卸载/清数据。任何签名/保数据/目标/宿主前提失败停止对应分支，不能拿历史inspect JSON强行许可。UI probe按准确相同server租约，空闲60秒/总10分钟，有界查找/采样，首次字形/真实字号失败立即保留原始帧/日志先代码定位。

14.31当前HAP5规范inspect在VM guest/host clock or observation is inconsistent处FAIL，尚未进入App保数据/安装/启动；原stdout/stderr与invocation保留。先从targetReadiness时间解析/本机与guest只读时间、uptime/VM日志排查，不改门禁阈值、不直接继续install、不重启或重置VM、不自动改系统时间。字体/交互仍NOT_RUN；候选HAP本身保持通过。


### 14.31-VM-CLOCK-PRECISION controller-only correction (before execution)

HAP5 signed App passed. Its first canonical VM readiness failed clock/observation before BM/App; a later original-function diagnostic passed25 queries/two388/411ms batches/2010ms observation and log/boot/milestone/SceneBoard. That does not identify the first failure. Root leased precise VM date supports.%N and bounded skew -151..-99ms, inside existing1s. VM still truncates to integer seconds while physical already preserves fractions after an Oct26 documented false rejection. Root authorizes only extracting that same strict fractional epoch reader and using it in VM, plus NEW named VM precision test; original monolith VM fixture query/output format may be updated, never executed wholesale.

Freeze current exact controller/physical-test/monolith/pipeline bytes in .reader-artifacts/vm-clock-precision-20261103/baseline. Keep every1s/10s/observation/boot/milestone/log/PID condition byte-equivalent. No VM clock/config/service/App action. Only execute node tools/test-vm-clock-precision.mjs --case vm-clock-precision (actual production targetReadiness with bounded time/query/log ports, cross-second valid drift/floor false rejection and genuine invalid/changed witness failures); node tools/test-physical-clock-precision.mjs --case clock-precision (extracted shared reader keeps its established physical behavior). No monolith, build or other gate. Root will consume HAP5 only with explicit controller delta; read-only audit verifyManifest compatibility, no protection edits or manifest rewriting.

14.31精准读取修复完成：VM复用原physical guestEpochMs .%N解析，原±1s/10s/里程碑/日志/PID守卫逐字不动；vm-clock-precision与原physical clock-precision各准确PASS，monolith仅mock格式同步未执行。当前HAP5整个App source fingerprint仍同字节，控制器修复另记controller-delta-binding，不重编App/不改旧manifest。以新采样实现重新canonical inspect（attempt2独立日志）；原第一次失败原因unknown与原instrumented PASS均保留，不把新校准冒充旧运行。

14.31 inspect attempt2：精准采样下boot/VM实例日志/SceneBoard稳定与签名身份PASS，现有App0.2.0/versionCode1000000/debug身份匹配。只读存储检查因application UID still has a writer process STOP，没有形成permit。下一动作按既定已授权canonical install（不是复用STOP或手工杀App）：install自身建立UID停写屏障、官方sandbox备份/inspector、DB-WAL/boot/身份/HAP字节新鲜复核，全部满足才replace -r。保留此STOP原始结果；无卸载、清数据、重置或旁路准入。


#### 14.31 controller precision result (2026-11-03)

Existing physical strict fractional epoch parsing is now one guestEpochMs helper; VM also reads actual date -u +%s.%N. Fractional format/finite/safe-range validation stays strict, no integer fallback. Every VM1s/10s/milestone guard, vmInstance log check, physical guard, boot witness and targetReadiness observation/PID condition remains mechanically byte-identical (unchanged-guards-proof.json). Pipeline and old physical test unchanged. Source monolith gets only one VM fixture date format line, and is NOT_RUN.

Only two planned exact cases ran, both first-attempt PASS: test-vm-clock-precision --case vm-clock-precision; test-physical-clock-precision --case clock-precision. The synthetic real production VM function proves old floor can reject a valid -450ms cross-second offset, while genuine±5s, jump/freeze, host jump,>10s sample, unsupported precision and changed PID/milestone/log remain rejected. It is not evidence that the initial real inspect failed for this reason. Root later original-function diagnostic PASS and leased fractional capability/skew bounds remain separate original receipts. No VM clock or threshold was changed.

Helper SHA055b5ff7651888fd9bc1b44f75eb31fc3adb25b3674d441370adb808c48ddd22, new VM case538ab94f..., one-line monolith6b53d930.... All exact before/current inputs/diffs/logs/unchanged-guard proof and controller candidate ZIP are under .reader-artifacts/vm-clock-precision-20261103/. Root received stable notice before archiving; no script/tool edits since. Read-only verifyManifest audit permits unchanged HAP5 with separately recorded live controller delta: verification checks archive descriptors and actual signed HAP/Native/resources/storage, not live controller equality. Do not rewrite old manifests or treat saved readiness PASS as an install permit. Root must still perform fresh canonical readiness/retained-data admission. This agent ran no HDC/device/build/install/launch action.

14.31 install结果PASS：HAP5 signed ac33d1d…，VM原0.2.0/versionCode1000000身份匹配；规范停写/备份/存储inspector/最终重核/replace与postInstall身份/普通启动均PASS，receipt deploy-vm-6460677a198b-20261103T113814Z.json，dataPreserved=true。正常启动本身不证明Runtime/字形/交互。随后仅同包一次force-stop并带既有readerOpenSourcePilot=true冷启动（warm flag会被原代码拒绝，不重复安装）；新同server session先完整只读readiness，再dump/recv现诊断UI。具体命令与回执由open-diagnostics编排记录，仍全走reader-hdc-lease API，30/120秒边界，保留异常即停。

14.31 诊断路由观测缺口：force-stop/start命令成功后1500ms的原始布局仍为Index书架，不能把diagnostic-cold-launch的命令PASS称为诊断页面PASS。源码及HAP5官方离线ABC反汇编确认DEBUG=true/buildMode=debug、exact bool参数与Pilot页面注册一致，没有普通loadMainContent覆盖；singleton暖启动仅onNewWant，不改coldStartPage。原脚本未记录force-stop后PID退出屏障，当前只把暖实例/启动延迟列为候选原因，未判定。最小下一入口observe-route.mjs仅一次读取当前PID、READER_STARTUP日志、ability dump与settled UI，回答是否已稳定到Pilot或仍为Index；同server租约、有界、不再次重启/安装/改参数，不扩大门禁。

#### 14.32 冷启动诊断路由的安全可观测性（执行前）

HAP5已签名、保数据安装/普通启动PASS；但同次--pb readerOpenSourcePilot true启动后UI仍为Index，route FAIL。Root route-observation-attempt2已有PID26211、19:41:18.972 sequence1/tokenreader-117298350的全新ability.create，随后单次正常startup.load-content和shelf.query，排除仅旧暖实例/1500ms延迟。离线官方ark_disasm闭合EntryAbility import槽0/2→同一BuildProfile record→'debug'/true以及gate的5实参，pages登记正确；官方aa文档/源码与设备当前help均支持--pb key true，整串shell参数符合官方用法。上述证据仍不能观察当次onCreate收到的参数类型/===true及selectedPage；公开Ability dump无该值，不能用命令success冒充路由success，也不凭猜测重编修路由。

先冻结EntryAbility fd466814…原字节到cold-route-telemetry-20261103/baseline。唯一生产增量：gate完成后仅DEBUG===true&&BUILD_MODE_NAME==='debug'打印固定READER_COLD_ROUTE，安全对象只含generated debug/buildmode、selectedpage、motion/renderer/fault三参数的typeof与===true；不序列化整个Want、不输出URI/身份/secret、不改gate/route/Runtime或引入新Want。日志失败也不能改变启动。新具名最小on-create-telemetry case用实际EntryAbility.onCreate/原gate，平台/Runtime边界仅有限pending port；检查normaldebug/primitive与非primitive/冲突/release/无泄漏/日志异常，不执行Core/文件/窗口/设备。旧框架/焦点/Source报告未受影响精确REUSED，无隐式嵌套门禁；Root负责后续新canonical构建与同授权安装观察。

14.32最小实现已稳定：EntryAbility b21a64222172e42eb31805bdc83a6ce46807c235aa38ea617bfd0ce77ea0bd58；具名test b0ed52785ca8dde2dd810f96d0c8e7d6c5d082a865c41148efc9d0b47c15cdf9。准确on-create-telemetry首轮PASS，实际onCreate/原gate执行9组默认/primitive/string/boxed/object/motion/fault/conflict、5组release/nonexactdebug及1组logger throw；额外9个warm Want回调不发cold记录/不改路由。安全9字段allowlist及URI/entity/token/对象secret哨兵均验证；有限pending平台端口从未执行Core/文件/窗口。异常日志被捕获，不改变原启动继续。旧HAP5/路线失败与离线初审不覆写，新artifact保留基线、单文件diff、输入快照与首轮log；HAP6/安装/实际Want类型/可见Pilot仍由Root分别验证，不能用方法测试关闭routeFAIL。此后仅artifact/docs，不再改生产/tools。

#### 14.33 原生夹具宿主top safe-area修复（执行前）

HAP6在真实冷PID empty屏障后，安全日志已证明primitive renderer=true并实际进入Pilot/组件菜单；HAP5原因仍UNKNOWN，不追溯伪造通过。Source默认baseline原生生产字形正确，实测365.714×809.143vp/systemScale1，但source-baseline.png显示页头被statusbar遮挡，故当前Native布局分支FAIL并停止后续字号。源码定位：Main fixture Root未复用Index的App内容top inset；Source/PageBackBar自身不消费top，而Footer已有自身safeBottom。不是生产Actor排版/字体问题。

先冻结Root及准确fixture测试原字节到page-fixture-safe-area-20261103/baseline。只改ReaderPageStructureVerification.ets与其现有test的新具名safe-area case：Source/Tools/Downloads/menu及directory-detail按Index使用真实WindowCoordinator+readerContentSafeTop单次top padding；directory-reader ReaderFullDirectory.topBarTop已消费visualSafeTop、manga BookDirectoryPage.topInset已消费interactiveSafeTop、control ReaderLayoutGeometry已有safeTop分配，外层为0并复用相应edge-to-edge边界，不双算top。不新增页头/导航/字体/Native Want，不改任何生产Actor或Directory fixture；122/168/190是明示component viewport，不能被宿主padding再压缩。revision读与原Index一致以响应真实Window回调。

唯一新门禁node tools/test-page-structure-native-fixture.mjs --case safe-area：实际Root SDK modifiers/child initializers，320/366、真实metrics port变更与revision、App/top单次/reader零top/菜单可达、三短slot props不变、default/releaseguard。有限Native记录端口不模拟padding像素/绘制；原Font/旧callback/业务owner未改证据精确REUSED。旧source-baseline失败和包字节不覆写，Root后续新canonical/安装/Native另记，本分项无HDC。

14.33局部SDK完成：safe-area首轮PASS，320/366×15scene共30组实际Root SDK modifiers/child initializers。App scene初始systemTop39/cutout43按max只付43一次，revision2变systemTop51后同Root更新51；reader/manga/control保持0宿主top，三短slot props仍122/168/190。菜单当前launch按钮回调可达，默认零metrics不造inset，release不挂actor。Root fa365dc0b6dd807c08428187af70d88c84b9557dc6aa3adf8f1dcaebb969a330；test15e0a605556f7992e71f2faf9ec1fe0bb264c7575fa25af4eabaa03b2f1f6c12，已稳定通知。新增contentTopInsetVp日志字段供后续Native核对，只记真实几何事实。原source-baseline图片/布局/receipt按SHA引用保留FAIL；新snapshot/diff/log在page-fixture-safe-area-20261103，Root新候选及Native实际像素验收另记。此分项未构建/HDC/设备，未改生产Actor/Directory fixture/消息/注册；之后仅artifact/docs。


14.33 delivery-index final wording correction: current Download settings two real InlineSelect controls now dispatch configureStorage through existing intent/Host/StorageGateway owner, with the scoped inline-settings SDK case already passed. Root authorizes correcting the stale no-UI-dispatch knownGap in downloads and its same implementation variants only. Preserve every NOT_RUN/partial result and all facts/operations/source pins; no behavior/model gate rerun. One check-contract-refs is necessary for changed active documentation integrity, then freeze current public scope against immutable HAP7. This is a registry/controller text delta, not an App source change or native acceptance. Before bytes and exact field delta preserved in new delivery-index directory.

#### 14.34 全App平台系统字号继承与预算事实源修复（执行前）

HAP7原生Source baseline字形/页头PASS。Settings标准2→特大5（weight/zoom仍1）后AAFwk真实fontSizeScale1.450000，但Source152节点、6ListItem的type/text/id/bounds/origBounds全部无差异，10个同文字crop RGB差异0（comparison.json e5eb4a33…）；不是单凭没有metrics-change日志推断。Root已把Settings恢复标准2并离开，AAFwk全部config1.000000/菜单metrics1，font-restoration-required.json记录RESTORED_CONFIRMED；原大字失败帧和回执保留，不继续矩阵。

代码两缺口：AppScope/app.json5未声明configuration，profile不存在，官方schema默认nonFollowSystem；Entry.onConfigurationUpdate丢弃fontSizeScale，Coordinator无参重读display.scaledDensity/density，该显示比值不等于当前App配置字体系数，equal snapshot可静默不广播。官方app-configuration-file.md§configuration声明followSystem且max可省略默认3.2；UIContext实际fp转换需loadContent完成后，display与Configuration为不同事实域。readerReadableFontScale真实源码仅Math.max(1,scale)，没有上限。契约fontScaleMax2是已验范围，不是产品cap，本批不得新增cap2或替换生产字体。

先冻结AppScope/app.json5/新configuration资源/Entry/Coordinator/fixture Root及新test状态到system-font-configuration-20261103/baseline。生产白名单：app.json5引用新profile（仅fontSizeScale followSystem、不写max）；Coordinator.install接当前Configuration初始fontSizeScale，refreshConfiguration接当前window身份与真实配置更新，有限正数校验/缺项保留/旧window拒绝，未有配置事实时才兼容display比值，density/insets不乘字体系数；Entry仅接线初始与update，保原theme/阅读字号业务；loaded Root fixture只记录liveUIContext following/max/fp2px(1)/vp2px(1)对照，不写入metrics。此为全App平台继承修复，不宣称所有路由大字合规；当前4family/共享预算已有局部证明，其余visible路由只inventory，2×/3.2原生仍待分别验证。

精确门禁：新test-reader-window-font-configuration.mjs --case configuration,entry-consumer,native-context执行实际Coordinator/Entry方法/Root record（Directory agent只写此新test）；既有test-window-flicker-dedup.mjs --case metrics-dedup仅保护无config时旧display/density/等值广播兼容。无嵌套业务/Core/HAP/设备套件。现有App布局/Source/filter/focus逻辑不改，未受影响证据精确REUSED；如probe缺新字段只补准确依赖，保留失败，不改业务迁就测试。Root负责新canonical/保数据安装/原生观察。


14.34 exact font-configuration tests delegated to Directory owner: only NEW tools/test-reader-window-font-configuration.mjs. Reuse actual createWindowCoordinatorFixture real class and selected actual Entry methods/fixture record, finite no-device ports. One precise command --case configuration,entry-consumer,native-context verifies config initial/update/dedup/invalid retention/window ownership/late install/noncapped3.2/density-insets, actual Entry initial/update wiring+retirement/theme, actual native following/max/fp-vp ratio observation and unavailable/invalid ports, plus exact followSystem JSON without a max override. No old window suite, build/HDC or device action; SourceOwner alone runs existing metrics-dedup. Snapshot source inputs before test authoring; run only after production stable. Native-context finite ports do not establish real native following or glyph acceptance.

#### 14.35 Source Native E2场景暴露与有界取证准备（执行前）

当前四个Source场景缺少status-action、retained read-refresh、empty-read-retry、original continue/cleanup。Root字体观测99a7c2e…已明确handoff；保留14.34真实UIContext观测和safe-area所有权。先冻结Root与现有fixture test原字节到source-e2-scene-coverage-20261103/baseline，仅Root新增4内存scene：read-error（有行+refreshFailed+statusAction）、read-empty-error（无行+failed）、original-unknown（blocked+canRetryOriginal）、original-cleanup（confirmed+cleanup+canRetryOriginal）。复用projectOperationFacts与既有RulesMutationSnapshot形状、生产Source/Recovery/PageState组件，无Host/RPC/网络/文件/业务写入；回调必须核当前presentation与准确generation，意图区分reconcile/continue/status，旧回调拒绝后继场景。

唯一刚需门禁node tools/test-page-structure-native-fixture.mjs --case source-states,safe-area：准确场景props/facts/动作及旧generation/退场拒绝，实际Root SDK 320/366×19scene safe-area和当前菜单可达。无全量、构建、HDC。另在artifact准备动态UITree typed selector/visible clipping/44vp边缘+intent回执driver，复用withHdcCommandSession和native-batch命令语义；首次失败停止、finally原始回执、租约≤10min，无自动启动/改字体/业务登录。driver仅PREPARED，Root独占后续真实执行/目视，SDK不能关闭E2/E3。

14.34共享影响补审：全App followSystem也影响阅读正文Native fp。当前LocalReadingExperience967的StorageLink经4687/4694 reflow读取windowMetricsLayoutKey（含systemFontScale），变更会invalidateBook/resetPaginationDraft并按已提交anchor重测；paginationLayoutSignature7186含appearance fontScale×layout.systemFontScale。ReaderNativeTextWindow ctor54保存vp2px(1)/fp2px(1)，matchesGeometry135核二者；ParagraphView.prepare60的真实geometry key也含两比值；NativeTextMeasurement50仍直接base fp fontSize/lineHeight，无本批手工乘第二遍。Reader appearance业务设置未写。

旧test-reader-native-paragraph-view.mjs有最后一个现有1→1.5字体失效块，但旧PASS的当前整源SHA已漂移且入口无case选择，不跑全monolith/不冒充REUSED。唯一补测为artifact/reading-font-compatibility.mjs：用官方SDK AST提取该现有最后断言块与原Controller/style，执行当前实际View.prepare/aboutToAppear/disappear，有限非绘制Controller/feedback端口。只答相同key/color不重塑、font tuple/context fp转换变更必须重建；不证明实际glyph/分页/阅读业务Native。无生产/tools输入变化，不阻塞Downloads的Root接手或扩大门禁。


#### 14.36 原生 Tree 章标题命中 carrier 修复（执行前）

HAP7 DirectoryDetailTree 的 settled JSON 显示 chapter17 Text bounds[128,1322][855,1378]，约16vp高；真实父Row范围1273..1427约44vp。Root点父44vp目标上沿内1px (491,1274)无当前回调，点文字中心(491,1350)则 fixture-action-select-chapter count0→1。第一次hilog误用-t返回Invalid log type保留；有效READER_PAGE_STRUCTURE完整缓冲及edge/center receipts作为实际行为证据，不能用命令exit0称命中通过。冻结源码/登记原字节与4份原receipt哈希到directory-native-row-hit-20261103/baseline及before.json。

源码定位NavigationList.row的文字仅layoutWeight、自然文字高，responseRegion从文字原点向下44，未填满父44上半目标，且下沿可能跨邻行。唯一生产修改该Text加height(Math.max(44,rowHeight))，response高度取同一值；保留字形居中、原行高/布局/动作及全局readerActionTouchRegion。共享影响只限文本Tree row（详情/阅读完整目录/Control实际同Tree），漫画分支及prefix/Port/Core/队列无变。

唯一新SDK门禁node tools/test-directory-native-row-target.mjs --case text-row-target：真实SDK降低row Builder，实际FullDirectoryPanel.directoryRowHeight和同源readerScaledControlHeight提供1/1.3/1.45/2行预算，target/group/current/disabled、附属44下载/书签/展开槽位与相邻声明行边界；原carrier删除负例必须失败，不把SDK声明当Native像素或命中验收。随后仅check-contract-refs和check-register重绑必要当前actor/test pins；schema/host/prefix/focus等未改场景REUSED。Root独占HDC，新HAP及真实edge/center/字体分别取证，本分项不构建或操作设备。

14.36 baseline-case准确FAIL于Text.height undefined !==44，复现原声明缺口。修复后attempt01继续到附件数量断言：夹具在accessories=false仍给真实bookmarks空数组，生产正确展示章首书签槽位，测试却期待0；只把该夹具chapterByIndex按accessories参数区分，保留失败log，不改生产条件。

14.34本地完成：新configuration/entry-consumer/native-context三case同进程首轮PASS（Root99a7完整输入已冻结）；Root交Downloads后增filterfacts，最小probe补实际defaultSourceManagementFilters，仅native-context当前Root8c09再PASS，前两case精确REUSED，新test最终8fc64f6c3fd0c702da9dbaa305f63228777bce1bc7bbffdc8f2fc6f50eae96b7。既有metrics-dedup PASS；阅读正文现有末尾font identity断言块单独AST执行当前prepare/lifecycle PASS，未跑monolith/Native shaping。有效初始1.45、live1.6、相同事实不广播、无效/缺项保留、无expected/旧window整批拒绝、during/late install隔离、detach与display兼容fallback、3.2无新增cap、density/insets不乘font均有当前方法证据；Entry真实initial/update/theme/retired Stage与liveUIContext有限正反例已验证。

五生产分项稳定：AppScope/app.json5 64c0d9ed…、configuration.json030553f7…、Entry1ad8afae…、Coordinator5234e475…、font-only Root99a7c2e1…；Root现8c09ff6a…为Downloads后续4场景增量，字体观察块保留且当前probe可复验，不把两批累计diff混成本批。SourceReport21不含本批Coordinator/App配置，精确REUSED；新Native仍必须重新证明实际平台following/max/fp转换与glyph/layout增长。此为全App平台继承修复，其余visible路由仅inventory/knownGap，不能由四family局部SDK或阅读兼容方法通过推全App2×/3.2合规。Root已确认恢复系统标准；本分项无HDC/构建/签装/设备操作。原失败帧/原报告未覆写；system-font-configuration-20261103保留baseline/分项diff/完整tested Root与最终候选/日志/官方依据。之后仅artifact/docs。

14.34 test当前可复验收尾：三case在Root99a7原字节首轮PASS；后续debug4Scene record增加filters字段，准确probe只接真实defaultSourceManagementFilters并仅复验native-context PASS。configuration/entry-consumer实现与断言不变精确REUSED。test最终8fc64f6c…；原Root99a7完整字节和原test e2dc…均保存在window-font-configuration-20261103/first-pass，新Root8c09及当前test在current，日志区分两次输入，不把新完整record说成旧运行。未构建或HDC；真实平台字号/字形由Root后续新包验证。

14.36局部修复完成：SDK16组合PASS，1/1.3/1.45/2实际父/文字carrier/response高度同为44/50/53/64，group展开、target三附件及disabled角色不改；去除carrier负例必须FAIL。原baseline natural-height FAIL和夹具附件条件attempt01 FAIL均保留，attempt02为最终PASS。NavList dde0aa2b…只两行carrier/response变更，严格还原后与baseline逐字一致，prefix/manga/Core/Port/focus无变化精确REUSED。主登记13个Directory sourceInputs重绑当前NavList并绑定新具名测试，层/不变量结果未升PASS；control row knownGap明确原Native edge失败及待复验。refs PASS，register仍原39已知诊断(E2FAIL21/E3FAIL5/G03NT8/SCOPENT3/B1NT2)，无stale/model新错。register2e509a35…/control2264178b…，已先通知Root稳定；新artifact directory-native-row-hit-20261103保存before/current/diffs/原Native receipt哈希/全部失败与最终日志/verification/候选ZIP。Root独占新HAP及Native真实上沿、中心、生产字形与实际字号取证，本项SDK不能关闭整页E2/E3。

#### 14.37 Source导入目标父预算（执行前）

Downloads只读实际NativeTree已定位：searchField父Row[67,367][1214,521]、导入paint[1074,374][1214,514]，现40paint的44 response(-2,-2)对应[1067,367][1221,521]，右越父2vp。尚未发该Native点击，不能称真实命中失败；已经证明父布局未付足目标预算。源码事实：此支是自有40×40 Stack+18px source_add，而非ReaderIconButton（后者toolbar-compact在header tools）；不能为迁就描述替换控件/spec或撤用户保留的D1入口。

先冻结当前Source/test-inventory/layout producer原字节到source-import-parent-carrier-20261103/baseline。唯一生产增量：在searchField原40Stack外包44×44非交互居中Stack，原paint/response/feedback/Icon/onAddSource原样；横向Row真实保留44，不扩clip/改共享spec。Parent SDK要核实际创建树里的Row→44carrier→40interactivepaint父子关系、2vp居中后response恰好[0,0,44,44]，而非只看leaf尺寸。只补现有sdk-targets的这个断言与报告字段，复用既有有限Native父子记录helper并把它作为真实输入。

必要准确门禁/producer：test-source-management-layout.mjs --case matrix --write-evidence（新artifact路径，原32行/40目标/24预算）；test-source-interaction-inventory.mjs --case inventory,sdk-targets,recovery-targets --evidence-path=新artifact。后者需重新绑定当前Source/source测试/helper输入，旧hash不称fresh；不自动跑其它框架门禁/业务Owner/过滤/滚动/Index消费者，其实际方法未改均精确REUSED。Native命中/字形/全页E2/E3仍OPEN，Root后续新candidate读取实时NativeTree后执行；本分项不HDC。字体五生产不再修改。


14.37 HAP9前统一当前事实源绑定（执行前）：Root批准active21subjects/4families sourceInputs新增唯一ReaderWindowCoordinator.refreshConfiguration、Entry.onConfigurationUpdate及AppScopeapp/followSystem配置精确字节和font测试/封存receipt；不新造metricsowner、不改层事实/result，不提升NativePASS。SourceOwner14.37真实Source导入目标44父carrier已stable dd69ee1d…，fresh matrix5544aa2f…/interaction55685eb3…（实际22inputs，新增既有reader-control-native-tree helper），旧ce3526/b142报告保持历史。冻结当前两个active JSON到page-structure-hap9-binding-20261103/baseline后，统一替换Source source/report/producer路径SHA，实际已读取报告输入去重绑定；source-add-inline登记保留40paint/44真实父与response几何，增加准确SDKproducer引用，Native重测仍pending。NavList dde0aa carrier已绑定，不再改生产。仅refs与register一次保护新引用/当前输入完整性；纯pin/说明增量不重跑schema/derive/host/行为全量。Root独占HAP/设备，新包前先发stable；旧已过精确方法REUSED。

14.37局部完成：唯一生产searchField44非交互居中carrier已实装，Source dd69ee1db70ec59782f88ea0ce0aed3f4e12e61a62a3a66e64019a2d20520c70。实际SDK父树Row→44carrier→40interactivepaint，wrapper无onClick/focusablefalse，原40paint/18图标/反馈/44response/callback保持；offset2加response(-2)恰好carrier[0,0,44,44]。用户保留D1入口和header/shared spec不动。未发旧Native点击，原发现仍只叫父预算越界，不叫命中失败。

当前Source fresh matrix32/40/24首轮PASS，source-layout-evidence.json SHA5544aa2fc03f595cd0db35100ce0bc2c4ce697930d4bc37eb0e260d0aec5df84（17输入）；fresh inventory34/SDK200/recovery48首轮PASS，source-interaction-evidence.json SHA55685eb3958bfb329456d3af9df96e4b11c67e27a460718338d20a6e3454bfa1（22输入，新增既有Native父树helper）。两报告共39条输入SHA逐项与当前字节匹配，旧报告不覆写。inventory producer test54134b0d3c6e1a478af571478e64de10500127a5641bcce3ce82b36c9a50ea2f；matrix producer未改。NativeHit/Font仍NOT_RUN、整页E2/E3仍FAIL；Owner/过滤/滚动/Index与字体五生产全未改，精确REUSED，无额外全量。Root/Directory已收到稳定SHA/path作最后active绑定及HAP9；新Native必须重读当前树，不能用旧coords。原字节/diff/候选/报告与日志见source-import-parent-carrier-20261103，本分项无构建/HDC/设备；之后只artifact/docs。

14.37 binding文字纠正：source-add-inline只在NativeTree已证明父预算右越2vp，尚无该Source点击尝试；不同的Directory Text才有真实edge miss+center counterproof。控制登记移除误套的HAP7 upper-edge miss句，替换上述准确事实，结果/来源/引用/预算不变；Root确认HAP9尚未snapshot后执行。前次refs/register精确REUSED，不为纯文字重复门禁；新control SHA 193a92b5923d99e709a4c43199029ba72b9caf01073709c42c152c9cec1829e7。

14.37统一绑定完成：21subjects均加真实全局font配置/Window事实源与当前精确font receipt；Source dd69ee1d…两fresh报告5544aa2f…/55685eb3…及22inputs真实producer54134b0d…/既有NativeTree helper均当前。refs PASS；register保持39原诊断无stale/ref/model新错。最终register c45b4e78…/control193a92b5…已通知Root稳定，随后只归档。source-add文案明确只是原NativeTree父预算overflow、未发hit；Directory才有edge实际失败/center成功，未混淆。本批不重复行为/Schema/host，也不操作设备；page-structure-hap9-binding-20261103记录before/current/diff/准确命令/纯文案更正与ZIP。当前Root的HAP8真实1.45增长、raw getter ratio1/max2147483648、系统尚待恢复是独立进行中事实；不由登记关闭E2/E3或假造3.2Native验收。

14.35已完成夹具本地部分并冻结：Root8c09ff6ae141d759a366ef6a135031edcc64a2454e3d7b09791f8c01c0f57301；test4070648d8847dd45ef93975546cf54f4b0b32e37dddb21c67a250be64710bf29。source-states/safe-area attempt02 PASS：4新scene真实facts/status/continue/cleanup、准确世代与retired拒绝；320/366×19scene共38组实际Root SDK安全区。attempt01仅test选了旧菜单节点closure，生产presentation guard正确拒绝；改为当前findLast后通过，原FAILlog保留。Root字体观测try块与readerOwnsWindowEdges/appContentTopInset方法与99a7基线逐字相等，未改Actor/Host/字号事实源。

Native driver与34模板/19暴露点mapping已准备，未执行HDC：source-e2-scene-coverage-20261103/source-e2-driver.mjs SHA6ceb2c19e98c2d41173f809cee942e84b9ebede722404e0fa32c400723cc7376；coverage-plan c2a1d3241d052c4a1f950e94b1825a0a3e09264b094d196efb2c08776061a3ad。真实UITree唯一typed target、bounds/origBounds完整可见、祖先clip/真实44响应父预算、分岔兄弟明确zIndex、邻近点击区及当前intent/filter回执均须满足才发下一步。没有CLI自启；只Root绑定准确HAP/保数据deploy receipt/Root源码/target后显式调用；540s停止派发、各命令截止session590s、租约600s、首次失败finally保存raw。

冻结HAP7树6几何解析+裁切/歧义/旧导入2vp父预算/z层负例最终本地PASS，零HDC；首个z层负例暴露了祖先zIndex相加不足以证明兄弟优先，现按共同祖先分岔兄弟的明确native z比较，同层/未知拒绝，原日志保留。顺带发现的导入40paint右flush、44response右越父2vp由SourceOwner另批完成44非交互父支付，最终Source dd69ee1d…及fresh matrix5544aa2f…/inventory55685eb3…已绑定prepared plan，未用旧树冒充新候选Native通过。当前四新scene首Native装配、query实际输入/IME、横滚/新recovery typed selectors、全目标原生命中和2×字形仍OPEN；driver只有PREPARED。完整回执verification.json SHA0dab09d6565f2041e635a3e9a07d54c00f9b2230a3b6eaf3d615d755adf148e5，未构建/签名/安装/设备。此后仅交接，生产/tools已稳定。

14.38 当前交付源范围冻结：读取Root已签HAP9 run20261103T124950Z-fce869a1-3e312522 immutable manifest（signed12db667b…），仅artifact freeze236公共源码/测试/登记/四个精确SDK模型JSON；所有AppScope+entry/src按candidate source-snapshot逐字绑定，每项ZIP恢复SHA核对236/236、drift0。新目录page-structure-delivery-current-20261103/public-scope.zip SHA8b75b09d27f08a8944d297142889e8b4d2548e00d0eb9526a8658e63e095582b，current-scope.json/delivery-index.json给出当前包与边界；旧HAP7 ZIP cff5123e…保留不覆写。源范围包不含HAP/SDK/字体Native二进制、私有签名/DB/target/Native日志帧或可变最终文档；不是完整环境归档。Root继续保数据安装/原生与最终恢复系统字号，当前index明确Native IN_PROGRESS，未用freeze或签名成功关闭E2/E3/用户验收。此打包未重跑门禁、未改App/tools/active、未HDC。


#### 14.38 Same-instance dynamic Control viewport fixture (before execution)

HAP9 build and preserve-data install passed. The original122/168/190 menu scenes create a new fixture presentation, so they do not prove same-Content/Port fixed-to-ScrollAway focus, IME or anchor transfer. Freeze only ReaderDirectoryStructureFixture and its exact test in directory-dynamic-native-viewport-20261103/baseline. Root8c09, SourceNativeScope, production actors/layout/font policy remain unchanged.

Only admitted debug+fontsReady+expanded control with original explicit122/168/190 admits a HUD. It is a sibling of the actor in the existing root Stack, aligned to content left at controlLayout.topBarTop (already pays actual safeTop). At1.45 four56x44 buttons with8gap use248vp; actual metrics grow the HUD at larger fonts without a font cap. Hide if real width, actor-top gap (HUDheight+8), or clear space above IME cannot fit it. Never overlay or subtract from actor height. The four122/168/190/320 actions modify only fixture State, log initial/current request and actualControlArea, preserve presentation/factory/session/ForEach key, and dispatch no business intent or program focus. Native focus retention is an observation, not guaranteed by focusable(false)/focusOnTouch(false).

Only command: node tools/test-directory-native-fixture.mjs --case dynamic-control-viewport,short-control-viewport. Actual SDK lowering with finite child-constructor ports verifies same Content object, real memory Port/session/presentation, retired HUD rejection, exact un-deducted viewport, defaults/reader/manga without HUD, and insufficient width/IME hiding. Selected actual Content budget at1.45 bookmark320 stays fixed; at2 bookmark320 remains constrained. No injected Native scale or production algorithm changes. The old short case is rerun only because its requested-height helper changes. Unaffected Port/Core/action cases are REUSED. Root owns HDC, HAP10 and Native; HAP9 Source work can proceed independently.

14.38 dynamic fixture SDK result: initial exact dynamic-control-viewport+short-control-viewport2/2PASS. Before archive, source review found HUD metric budgets lacked a read of the existing published revision; Root confirmed HAP10 had not started. Only HUD font helper now reads the existing StorageLink (no new owner/state, no scale cap). Only dynamic-control-viewport was re-run and passed; it verifies actual SDK revision subscribers and1.45-to2 width56-to60 delivery without Area or manual replay, retaining the same Content/Port/presentation. Legacy short case body/dependencies are unchanged by that HUD-only delta, so the original precise PASS is REUSED rather than repeated. Final fixture da0a2ae2.../test1168d629... stable sent before Root HAP10; Root8c09/production actors/active remain unchanged.

Four dynamic width/scale contexts cover20 exact height transitions, current/initial/measured distinction,8 no-HUD admission variants, hidden/retired callbacks, real parent budget320 fixed at1.45/bookmarks constrained at2, and safe geometry/IME predicates. SDK native modifier declarations are not a real focus/IME/anchor PASS; Root must capture the same-instance Native transition and preserve failure if HUD touch blurs. Snapshot/diff/log/verification and scoped ZIP are in directory-dynamic-native-viewport-20261103; baseline fixture matches immutable HAP9, previous SDK-pass01 bytes retained. No build/HDC here. Final HAP10 source recovery should use a new explicit candidate or two-file overlay, never overwrite HAP9 public ZIP.


#### 14.40 Source filter selected projection repair (before execution)

HAP9 source-b-145 at real system scale1.45/PID10935 changes current filter facts and rows (enable16/24, error6/24), but both original native trees retain 全部 selected=true and the actual error PNG keeps 全部 dark green. The source-a seven-target native observations remain scoped PASS; source-b is preserved FAIL. Independent original bindings are source-native-audit-20261103/audit.json. Separately, the step3 Scroll selector using descendant 自定义 failed before swipe dispatch: that offscreen label is absent from dump. The planned gesture was the **status** Scroll (current visible 异常), not the category Scroll; the earlier audit's category identification did not establish the intended gesture. Neither means a hit failure.

Scope: SourceManagementPage statusFilter/chip only, plus a new explicitly selected SDK case. ReaderButton primary is already @Prop; no shared API/style/spec or control remount workaround. Freeze full original Source and exact compiler/probe/ReaderButton inputs in source-filter-live-selection-20261103/baseline before changes, then save the SDK-lowered original status/category observer closures. Directory independently owns only Source scroll/copy edits; no whole-file overwrite or premature report production.

Necessary gate: node tools/test-source-filter-live-selection.mjs --case sdk-selection. It compiles the actual statusFilter/chip/categoryFilter and actual ReaderButton, captures existing observeComponentCreation2 child updaters, changes owner status/category and replays **only those retained child update closures**, then uses actual ReaderButton updateStateVars plus the installed SDK property runtime to check primary/native selected and actual modifier surface. It must not re-run the complete Builder or recreate controls. Keep the frozen old-active implementation as a negative proving stale status selection; directly-bound category is checked unchanged as a comparison. Also verify disabled 自定义 remains unselected, callbacks and child identity/count are retained. No Core, build, HDC or native repeat here.

After both Source editing owners declare stable, regenerate only source matrix (32/40/24) and interaction inventory/sdk-targets/recovery-targets because those reports bind full Source bytes. All unchanged business/session/filter semantics and Index consumer evidence are REUSED. New native validation, once Root rebuilds, remains necessary for the selected projection; local SDK evidence cannot overwrite HAP9 native FAIL or close E2/E3.

14.40 exact first diagnostic invocation: `node tools/test-source-filter-live-selection.mjs --case sdk-selection --evidence-path=.reader-artifacts/source-filter-live-selection-20261103/before-sdk-selection.json`. It must fail the current-source positive assertion if the frozen defect is reproduced; preserve that log/generated observer snippet before the two-method repair. This uses no nested tests, Core, build or device commands.

14.40 diagnostic attempt01 failed in the probe before stale-selection assertion: expected surface used a non-existent generic TOK_CONTROL_BG instead of each actual ReaderButton spec secondarySurface. Original Source was not changed, and generated/observed old SDK bytes were saved. Correct the assertion to resolve the actual selected spec surfaces, preserve this failure, then rerun the same exact diagnostic entry to establish the production defect.

14.40 attempt02 now accurately reproduces the production defect: actual old chip child updater/paramsLambda close over active; same retained child updates after owner enable/error/unchecked all keep 全部 selected. Actual category direct binding independently yields all→novel→comic→all correctly with the same retained child updaters. Save before-sdk-selection-02-actual-sdk.js and observed JSON/FAIL log unchanged. Apply only statusFilter calls and chip signature/primary expression; final exact gate is `node tools/test-source-filter-live-selection.mjs --case sdk-selection --evidence-path=.reader-artifacts/source-filter-live-selection-20261103/sdk-selection-evidence.json`.


#### 14.41 Source signed Native top/reset correction (before execution)

Root HAP9 Native source-b-145/004-after-1 and006-after-2 show enabled/error filters update stats but statusScroll y667 becomes465:203px is58vp header clearance and the search row is hidden. Source rebuild changed used scrollTo0, capture clamped native offset to nonnegative, DTO rejected negative, and empty/no-anchor restore used0. Existing authoritative BookshelfPage740-790 already defines signed Native top=-contentStartInset, fresh/reset scrollEdge(Edge.Top), saved raw signed scrollTo with animationfalse. Reuse that contract, no replacement scroll algorithm. Freeze current inputs/Native hashes in source-scroll-native-top-20261103. SourceOwner concurrently owns only chip/statusFilter; use apply_patch only on mutually exclusive scroll blocks.

Only Source scroll/List-onAppear and SourceManagementPresentation copy DTO change. Filter/clear/empty fallback uses Edge.Top; reset snapshot publishes known top=-readerScrollStartOffset. Capture stores finite raw signed yOffset; copy accepts finite signed native coordinates. Same-layout captured header/no-anchor restores raw signed offset animationfalse; changed-layout header/empty uses Edge.Top. Valid entity anchor/two frames/new-inset correction, ordinal fallback, projection revalidation, epoch/current guards and user cancellation stay as already defined S8. Fresh List.onAppear with no pending top uses Edge.Top once; Area without pending never resets user scroll. No Index interface/owner/data mutation.

Exact command node tools/test-source-filter-retention.mjs --case scroll-roundtrip,filter-roundtrip: actual Source/DTO/Index methods and SDK List event forwarding with finite Edge/scroller ports; negative58/partial30 offsets, invalid sampling/DTO, matching/changed layout, empty/fallback/filterclear/fresh, both frame guards, and default fresh retention. Recorded Native commands are not simulated pixels or device PASS. Existing11 Source-Index consumers have no scroll snapshot/offset/List-onAppear assertions and no changed positive/undefined semantics; REUSED, not rerun merely for module bytes. Fresh matrix/inventory waits for both Source owners stable and runs once by SourceOwner, then final active refs/register once. No HDC/build here.

14.40 repaired two-method SDK gate PASS: five status owner states, four category states,12 retained child/updater identities, actual shared primary/native selected/spec surfaces, disabled custom and old primitive negative. Category remains unchanged. Three existing focused SDK consumers directly call old private chip(label,width,active,enabled), so synchronize only those calls to current owner.statusValue plus chip(label,width,enabled); their original bytes are frozen. Necessary exact consumers: `node tools/test-source-foundation-specs.mjs --case action-admission,responsive-chip` (the two cases containing direct chip calls; do not run trailing-tools); `node tools/test-source-expression-a11y.mjs --case source-semantics` (current selected/disabled declaration setup; contrast unaffected REUSED); `node tools/test-theme-local-consumers.mjs --case source` (same finite Source selected palette consumer, no other pages). No nested test expansion or business/Index regression is required.

14.40 consumer attempt01: source-semantics PASS. foundation action-admission FAILS on obsolete removed statusBanner before the modified chip consumer; its combined responsive-chip did not execute. theme/source FAILS because its old finite fixture lacks now-required layoutBudget, before any palette assertion. Preserve both logs and exact attempted test bytes; neither failure proves a production regression, and neither is relabeled PASS. Scope the eight needed existing chip golden consumers as an explicit new `chip-admission` case (the old broad action-admission is not silently skipped/passed); select only `chip-admission,responsive-chip`. Theme source gets only its measured footer geometry port (44vp at this fixture's unchanged scale1); the case asserts palette/admission, not layout. Exact reruns: `node tools/test-source-foundation-specs.mjs --case chip-admission,responsive-chip`; `node tools/test-theme-local-consumers.mjs --case source`. Other old broad tests are not invoked.

14.40 consumer attempt02: chip-admission PASS8, theme/source PASS; responsive-chip FAILS its obsolete pre-Stage4 width<=viewport assertion at 32vp. Current unchanged status specs explicitly responsiveStatusWidth=false and parent statusFilter is a horizontal Scroll with a paid wider content Row; the Stage4/current matrix already preserves 44 targets instead of squeezing to32. No production width changes are authorized or made. Update only that stale case to assert current unit invariants: finite width >=44 and unchanged unit width across narrow viewport inputs; parent clipping/scroll budget remains the actual matrix's responsibility. Preserve failure and tested old bytes, do not rewrite old expected geometry artifact. Also replace that script's historical hardcoded “12 widths” success text with actual selected counts. Rerun only responsive-chip because chip-admission body/calls are unchanged (PASS8 REUSED).

14.40 both Source owners now declare stable: final Source de09bf9f91b16e0613f23eea345e312783f2cbf8b3d754aba5b58d274486ec0d includes selected fix plus Directory's separate scroll/DTO fix (that owner's scroll-roundtrip/filter-roundtrip PASS). Freeze final bytes in this artifact without overwriting either baseline. Only regenerate full-Source-bound evidence once: `node tools/test-source-management-layout.mjs --case matrix --write-evidence --evidence-path=.reader-artifacts/source-filter-live-selection-20261103/source-layout-evidence.json` (32/40/24 budget/carrier binding); `node tools/page-structure/test-source-interaction-inventory.mjs --case inventory,sdk-targets,recovery-targets --evidence-path=.reader-artifacts/source-filter-live-selection-20261103/source-interaction-evidence.json` (actual reachable template/SDK carrier/recovery binding). Independent producers may run in parallel; they do not invoke business tests, build or device actions. The selected case's exact Source members are checked identical between tested aab7c2f4 and final de09bf9f to reuse the already-passed actual same-child SDK evidence, rather than repeating it for unrelated scroll bytes.

14.40 final: selected repair gate PASS (5status/4category/12 same child/updater identities/old primitive negative); exact chip/selected semantic/theme/finite width consumers PASS with failed diagnostic attempts preserved. Category/shared ReaderButton/spec/colors remain unchanged. Directory separately reports scroll-roundtrip/filter-roundtrip PASS for final Source de09bf9f…/DTO0b258e73…. Fresh Source matrix32/40/24 PASS (f7b2202fbb6327cbd9a6333d8132c54b5f11cf59ee7639dc7a96382398075e57) and inventory34/SDK200/recovery48 PASS (56b08b8c5cbc3be82f1da9aecabaf99d7fc86c3ae2e6fad6b415ca18113279b0);39/39 report input bindings match. Artifacts: source-filter-live-selection-20261103, including before/after actual SDK, exact tested whole Source aab7c2f4… and five-declaration AST scope reuse to current final Source (all six other listed SDK dependencies identical). Production/tools stable sent to Root and centralized register owner before candidate build; no business/Index/native repeats. HAP9 source-b remains FAIL, and repaired Native selected/scroll evidence is still NOT_RUN until Root's new candidate; E2/E3 not closed by these SDK reports.

14.41 signed scroll local result: exact scroll-roundtrip+filter-roundtrip2/2PASS on Source de09bf9f.../DTO0b258e73.../test7ba48250.... Actual signed58/30-negative,zero,positive capture survives DTO and Index; invalid nonfinite sampling does not overwrite a complete capture. Same-layout header offset restores raw with animationfalse; changed-width/font or empty header fallback and empty replacement between frames invoke Edge.Top. Real SDK List callbacks prove fresh Top, pending dispatch, nonresetting Area and TouchDown cancellation. Filter/clear publishes known target offset-58. Existing entity/two-frame/ordinal/current/epoch semantics preserved, with AST source proof of four changed scroll methods only, every other member exact; SourceOwner chip/status were already final in this frozen baseline and not attributed to scroll work.

Index interface unchanged.11 existing Source-Index consumers do not execute signed snapshots or List.onAppear; unchanged positive/undefined scenarios REUSED. Global font case imports unchanged defaultSourceManagementFilters, not the modified scroll copy; default function AST is byte-identical and scoped font evidence REUSED. SourceOwner received stable Source for one fresh matrix/inventory batch; this owner did not duplicate producers. Source-scroll-native-top-20261103 preserves exact before/current/method proof/Native input hashes/first-pass log/verification/ZIP. Real Native filter search/header alignment remains pending new candidate; SDK API recordings are not device PASS.

14.41 final active binding before new HAP: both Source owners are stable and SourceOwner fresh matrix/inventory passed once,39 input hashes current. Update only Source current source/report/direct modified test and DTO pins, source-filter control live-state producer pointer, and existing scroll restore description to signed Native coordinates/Edge.Top. Record HAP9 import single-point Native observation separately from whole-target acceptance; no result/owner/schema decision changes. Freeze active before bytes in page-structure-hap11-binding-20261103, then only check-contract-refs and check-register. No behavioral/producer/model repeat; HAP10 public bytes remain historical and Source-Index11 unchanged scenarios REUSED.

14.41 active final: register290ac1c6.../control36e95813... stable notified. Source de09bf9f.../DTO0b258e73.../scrolltest7ba48250... plus live test e3b9dcc5... and exact consumer scripts bind current bytes. SourceOwner alone ran fresh matrixf7b2202f.../inventory56b08b8c...,39 actual inputs match. refs PASS; register keeps only prior39 diagnostics (E2FAIL21/E3FAIL5/G03NT8/SCOPENT3/B1NT2), no stale/model/reference error. Existing scroll string documents signed Native/reset Top, chip entry references live-state SDK test, and HAP9 import partial point counterproof is separate from current-candidate Native regression. No whole-page result, owner or rule promoted; no extra schema/model/behavior/producer/full suite. All Source production/tools/active frozen after stable; only artifact/docs remain. New binding-scope evidence in page-structure-hap11-binding-20261103 preserves prior active bytes and exact deltas/logs/receipts/ZIP; Root owns new canonical HAP and Native.

14.41 HAP11 public-source overlay packaging (before freeze): Root HAP11 build/sign PASS, canonical preserve install in progress. Preserve HAP9 base236 ZIP8b75b09d... exactly. Compare each base record to current:9 replacements, no missing path. New active tests/reports plus statically imported support modules and two selected golden JSON fixtures require25 public additions (including palette registry and the theme module unconditional SyncPage text read; no Sync case runs). Merge261 records. Overlay script checks every AppScope/entrysrc input against immutable HAP11 snapshot, then verifies recovery from old base plus overlay and current hashes. No tests/gates/HDC/build or production/tools/active changes. Preview01 stopped on too-narrow artifact helper scope excluding its actual scripts/lib toolchain imports; preview02 permits only those public module sources and passes inventory. Keep both logs. No private target/data/signing/native frames or mutable final docs in overlay. Native9 SourceA partial7 templates and SourceB callback/projection success but selected/clearance FAIL remain separate; Native11 pending and system1.45 restoration still PENDING.

14.41 HAP11 source overlay frozen: source-overlay.zip SHA30d7e77e66ddd714192238ab8cdb4b7a5d8564b0b858857d6ddaa2b3dcd779bb,9 replacements+25 required public additions over unchanged HAP9 base236. Merged261/261 ZIP recovery SHA checks passed,drift0; every scoped AppScope/entrysrc matches HAP11 immutable snapshot. New delivery-index/source-overlay manifest in page-structure-delivery-hap11-20261103 binds signed5e2d02f8... and canonical preserve install/ordinary launchPASS, active290ac1c6.../36e95813..., long contract1c149b19... and current SDK/source receipts. No source/gates/device actions by packaging. Native11 and final restoration of this last1.45 session remain PENDING; old restored-standard receipt is not reused. SourceA9 partial observations, SourceB9 trueFAIL and HAP10 menu-only history are retained. Final Native/doc overlay waits Root results; frozen base/overlay are not overwritten.

#### 14.42 HAP11 Native continuation — Source current-candidate checks

Current immutable candidate: run20261103T140111Z-fce869a1-969ad8b0, signed5e2d02f8a60e86023d1629bc73b9b4bae11d575c4720749089177f61088e31ba. Canonical preserve-data install/ordinary start passed; observed cold Pilot PID10786. Source de09bf9f..., Root8c09..., active290ac1c6.../control36e95813... remain frozen. User approved only existing VM preserve install/start/screenshots/touch/Back/focus and temporary real system font changes with restoration; no uninstall/reset/real login/export file. System font currently1.45 and restoration is REQUIRED before final delivery.

Necessary Native entry is the explicit reviewed Source memory-fixture driver, not a test/build umbrella. Nested scope is same-server leased pid/tree/PNG/hilog plus bounded actual UI input, no business RPC. It answers whether actual current carrier/selected/filter/overlay behavior agrees with the already-passed SDK model; exact unchanged HAP9 A7 scenarios are REUSED by independent source/AST/shared-input and native initial-bounds proof. HAP11 B10 steps close the two observed HAP9 defects only for this scene: selected state/green follows live filter; Edge.Top reset keeps search below the fixed header. C1 six new targets and C2 external/other two new targets have actual edge clicks and current PID/presentation filter receipts. C1/C2 intermediate visibility FAILs are preserved: one swipe left All19px or Music24px clipped. Root inspected actual tree and executed only necessary tail, without repeating successful target actions. Those preparation assertions are not product failures.

D nine group actions passed including same-option close, changed group, outside dismissal and fresh temporary-back without leaving Source. Query edge click dispatched; first immediate tree contained only transient statusbar despite retained Source screenshot, so original driver FAIL remains. One settled read-only observation confirmed samePID10786 foreground, actual TextInput focused=true and real inputmethod window; entering English produced queryLength7/current group and actual text. Single Back removed IME, cleared focus and retained query/Source; separately observed route Back returned menu. Do not count the first transient dump as a missing control or native hit failure. Evidence lives in page-structure-native-final-20261103/source-{b-fixed,c1-fixed,c1-tail,c2-tail,d-fixed,query-*}-145 (query auxiliary receipts use descriptive filenames). Independent delta audits preserve original failures. E recovery/error, Directory, Downloads and Tools Native remain IN_PROGRESS. Full-page E2/E3 and unsupported real1.6/2.0 are not closed by these points; no full suite is invoked.

14.42 E5 original plan stopped before any expand input: actual unknown notice is short “等待核对”, so no expand target. Code audit found fixture custom long message lacks the real standardized receipt message and ReaderRecoveryProjection intentionally chooses standardized message, discarding that fixture description. This is an uncovered conditional fixture state, not a missing production expand button. Preserve E5 FAIL; Root now only reconciles the actual short notice and returns menu. SourceOwner is fixing ONLY the DEBUG long-message input and its exact source-states case through the real receipt/recovery projection. Other production behavior/methods and already-observed Native scopes remain unchanged and REUSED. A new immutable HAP is required solely because that fixture input changes; unknown/clipped remains OPEN until it runs. No public recovery policy or font injection is changed to force PASS.


#### 14.43 DEBUG recovery message fixture correction (before execution)

HAP11 E5 enters recovery but stops before any expand input: actual text is standardized 等待核对, not the intended long fixture explanation. Source.pendingOverlay → Source.recovery → readerRecoveryView preserves a facts.message only when it contains the actual receipt.message. The fixture's prior long text did not contain that standard message, so the existing projection correctly chose the standard short message. This is a fixture input gap; preserve the E5 FAIL and all other actual Native observations.

Only production scope is DEBUG ReaderPageStructureVerification.fixtureOperation recovery message plus the existing pure standard-message import from ReaderOperationFacts. Build the safe long input around actual projectCommitReadback('unknown','failed').message; keep confirmation=unknown, failed readback, same value/canRetry/generation and all busy/other scene branches. No public projection, Notice, Source actor, owner/RPC/platform or message family changes. Freeze Root8c09…/test and actual projection/Notice inputs in source-recovery-fixture-message-20261103/baseline.

The sole necessary gate is `node tools/test-page-structure-native-fixture.mjs --case source-states`. Extend that actual Root initializer case to include recovery through real persisted/recovery projection and actual Source.recovery method, proving the long full message survives with the canonical standard text and original unknown facts. A negative old long input must be reduced to the actual standard message by the real projection, proving the cause. Length only establishes a clipped opportunity; no fake native measure/scale or expand PASS. Safe-area/other initializers are not rerun: the changed payload/import does not alter their exact Root geometry methods/defaults; record AST reuse and actual dependency availability. Root owns a new immutable HAP12 and the only E5 native repeat. No build/HDC here.

14.42 Directory same-instance Native: initial122 and requested320 each produced actual313.714×122/320 controlArea within one mounted control presentation1, no remount, real HUD outside actor. However current fixed query input id `reader-control-directory-query:directory-fixture:1:directory:4` at[235,833][435,1026] stayed textempty/focusedfalse with no IME after `inputText335930English` and after a separate exact center click plus2400ms. Commands returned No Error, which is not focus success. Preserve both receipts and screenshot; do not proceed with presumed keyboard/restore/IME tests. Code-side audit of fixed-toolbar focus ancestor, actual modifier and native focus rules is now required. Other family tests can continue without this unresolved focus claim.

14.43 result: exact source-states case first-attemptPASS. Actual canonical message prefix from existing pure projectCommitReadback now survives real persisted→Source.recovery→readerRecoveryView with the long safe fixture explanation; original unknown/failed/value/retry/generation are asserted. The old input is a real-projection negative that reduces to the short standard message. Native clipped/expand remains NOT_RUN for this changed fixture, and HAP11 E5 FAIL is preserved. AST proves50 other Root members and all other selected case bodies identical; the sole existing fixture dependency addition is the already-imported module's pure projectCommitReadback function. Safe-area/admission/other actor evidence reused, no rerun. Root ec27b00a0f9ef226da9a34fde7ae4f5225a3e1a776dad638fa7f2b47939ff1b8 / test2923d69a1faaa013d0e0af1bf311ff56f212a280722642f8d3650d624ed2163d stable sent before Root HAP12. Artifact source-recovery-fixture-message-20261103 includes before/final bytes, exact diffs/inputs/AST and log; no public projection, Notice, Source actor, business, Core, signing or HDC action here.

#### 14.44 DEBUG下载真实短viewport入口（执行前）

唯一待验证问题：当前Root只有全高downloads，无法在真实Native组件高度下进入D3管理inflow；普通尾部storageDock不构成该分支证据。当前ReaderDownloadStructureFixture无viewport prop，它自身SharedDownloadPage100%根节点onArea只读实际宽高，Actor的实际ReaderPageScaffold.onArea写pageHeight并由readerAvailableWindowHeight优先使用；不得改metrics/注入pageHeight模拟。Root ec27b00a…（canonical recovery消息新修）与test2923…已明确handoff冻结，保存到download-short-native-fixture-20261103/baseline。

只改Root和现有fixture test：新增typed downloads-short scene/menu，在独立真实Stack中约束ReaderDownloadStructureFixture宽100%/高168vp并clip，已有downloads分支所有成员原样保留。沿用原fontsReady/内存数据/临时Back回调，没有新业务端口；根App safe-top仍只付一次，168是child真实viewport，不从168再扣safe-top，也不冒充整Window高度。原SharedDownloadPage/ReaderDownloadFixture/共享规格/active均不改。

唯一刚需入口node tools/test-page-structure-native-fixture.mjs --case downloads-short。只检查新菜单准入/320与366 actualSDK wrapper height168与子初始化/现有callback守卫，新scene App top43单付且child仍168，真实DownloadFixture onArea与Actor实际build中ReaderPageScaffold.onArea→availableHeight方法的有限Area回调链（numeric/vp），无pageHeight/metrics绑定注入。以AST证明普通downloads initializer、recovery operation和其他成员逐字等价；旧safe-area/全场景不重复跑。SDK仅证明装配与回调，不证明Native实际高度/管理inflow/anchor，Root统一新canonical构建和真实短场景观察；本分项无HDC/签装/设备。


#### 14.42 Fixed directory toolbar Native ancestor focusability (before execution)

HAP11 same-instance122-to320 has enabled/clickable TextInput id reader-control-directory-query:directory-fixture:1:directory:4, bounds[235,833][435,1026]. inputText exit0 and directcenter335930+2400ms leave Native focusedfalse/textempty/noIME. Native Tree rules out HUD sibling coverage ([91,171][959,325]), clipping, disabled/None ancestors and re-mounted id/bounds. Command success is not input success.

Code points to fixed toolbar native Stack.focusable(false), absent from the short prefix. Actual installed UIContext.d.ts3256 specifies unfocusable-ancestor error150002; native_interface_focus.h states the same. Official OpenHarmony6 FocusHub whole-path check supports the mechanism, without claiming binary equivalence to this Harmony build. Field modifier sets no Native focusablefalse/disabled; current/load guards only govern recovery/callback acceptance, and keyboardOnFocusfalse controls non-click IME rather than manual focus.

Freeze exact Content/Toolbar/Field/register bytes in control-directory-focus-ancestor-20261103. Unique production delta removes this one fixed-Stack focusablefalse; keep enabled/hitTest/a11y noninteractive guards, layout and all focus algorithms. Exact new SDK case test-control-directory-focus-path.mjs --case toolbar-focus-path records actual SDK component hierarchy through real Toolbar/Field and compares explicit-false old ancestor, repaired normal, short prefix and fixed noninteractive paths. This is declared-path eligibility, not a Native focus engine or physical touch simulation. Only current Content/newtest pins bind, refs/register once; no Source report/producer or unchanged field/prefix full suite rerun. Root owns new HAP12 and realclick/IME/text/transfer; no HDC/sign/install by this owner.

#### 14.43 Candidate HAP12 — only remaining Native prerequisites

Native HAP11 found fixed Control query blocked by its actual enabled toolbar ancestor Stack.focusable(false). All native ancestors have paid clip/default hit-test and no overlapping HUD. Local official focus rules reject a non-focusable ancestor; real SDK Content→Toolbar→Field reproduces that blocked path. Remove ONLY that ancestor false; short-prefix default path and fixed noninteractive enabled=false/HitTestNone/a11y hidden guards remain. Exact positive/old-path negative case passed; current Content38813330.../test46588bba..., refsPASS and register622bd472... retains prior39 diagnoses. No automatic Native PASS from SDK.

Root eaab5155... includes two DEBUG-only prerequisites: unknown recovery long message now includes the real standardized unknown receipt prefix, validated through actual Source.recovery/ReaderRecoveryProjection (source-states PASS); new downloads-short scene constrains actual wrapper/child to168vp with unchanged live Window metrics and existing Area→pageHeight owner (downloads-short PASS). No fake font/geometry injection or business ports changed. Ordinary Download branch/methods and all Source production bytes are unchanged; earlier exact Native targets are REUSED according to actual impacted paths. New true Native evidence still required for unknown expand, fixed query click/focus/IME and actual short management inflow.

Only new build entry is canonical `scripts/hap-pipeline.mjs build --class iteration --contracts-scope none --signing local`, isolated immutable run, pinned existing native cache; nested build/sign identity and package inputs are necessary to execute changed bytecode, not umbrella business gates. Existing Source/Download/Tools behavior checks unaffected by these scoped changes are not re-run. Then canonical inspect/preserve install/start and observed process-exit/cold-route barrier, same exact local VM. No uninstall/data clearing/reset, no real login/export or product version change. Font remains temporary1.45; restore standard with this final session's actual Settings sliders + post-foreground OS readback before ending. Old candidates/FAILs remain immutable.

14.44局部SDK完成并稳定：Root eaab5155f2bbb1f766a805f92c174e73287be088415f82bbf1bc743918b1e618 / test4f2bdc2931dffdf2903db7630f5f6b4d4a2895f1160533861b54b97cf421fdf2。唯一downloads-short首轮PASS，320/366真实SDK wrapper168/child端口、App43单top不扣168、pending/release拒绝及退场callback；真实Fixture Area与Actor原build.Scaffold Area原回调→真实SDK初始pageHeight0→测量168→原availableHeight168，window844/scale1.45未改。有限Area端口只证明线路，Native实际168/短管理inflow/anchor仍NOT_RUN，Root统一HAP12后观察Child READER_DOWNLOAD_FIXTURE actual-area；Root外层stage仍全高，不可拿其770…替代短值。

AST确认仅launchFixture/menu/fixtureStage3成员变化，其余48（ec27 canonical recovery、live font观测与safe-top均含）逐字相等，旧完整downloads initializer逐字相等，新短initializer仅缩进不同、保留字符串/名称的token相等。ReaderDownloadFixture e0232ccb…/SharedDownloadPage fa5e4775…未改。现有safe-area仅补newScene/168点，未全跑；执行case AST在补点前后相同，首轮精确REUSED。首个AST准备断言误把新嵌套clone缩进也要求逐字相等，保留FAIL_PREPARATION_ASSERTION_ONLY（非SDK/产品失败），校正为ordinary byte-equal+clone token-equal后通过。artifact download-short-native-fixture-20261103/verification.json SHA307383dcb11c72862b6d1d64648890b95d0b0b20f30de06e4255cddfb69c5332，含基线/当前、diff、首轮log、AST、明确反向重建run-input来源与Native待执行短顺序；无HDC/构建/签装/active写。此后仅交接，不再生产/tools writer。

14.42 local correction stable: Content38813330... differs from baseline by only removal of native fixed-toolbar focusablefalse. New test46588bba... first needed exact Bookmark child metadata and Toolbar module constant; those probe failures retained. With full real dependencies the before-source case correctly failed declared focus ancestry. After the one deletion, toolbar-focus-path PASS using actual SDK Content/Toolbar/Field/native parent objects and actual shipping NavigationList prefix Builder at a finite business port. Old nativeStackfalse is a meaningful compiled negative; normal/short have no explicit focus blocker; normal noninteractive enabledfalse/HitTestNone/no-hide-descendants remains. No program focus/Native engine is simulated.

Current Content/newtest pins only rebound in active (register622bd472...), refs PASS and register same prior39 diagnostics. No other behavior/model/consumer suite repeated; Field/Toolbar/focus algorithms/budgets unchanged. Root received stable before HAP12, then canonical HAP12 build/sign passed independently. control-directory-focus-ancestor-20261103 preserves before/current/diff/failures/final log/official basis/verification/ZIP. The exact test requires its public historical before-source fixture; next recovery overlay must include that file. Actual post-fix manual click/focus/IME/transfer and final current-session font restoration remain Root-owned pending; all product/whole-page boundaries stay separate.


#### 14.45 Source E2 complete target evidence (before execution)

Unique question: can current E2 actual44/equivalent-response evidence cover its22 interactive controlRefs instead of leaving the original five-control packaging gap forever? deriveStructure has no E2 decision. check-register evaluates declared minima; layout-evidence separately requires all22 refs across320/366 ×1/1.3/1.6/2 when claiming E2 PASS. The full Native font matrix is required by its E3 branch, not automatically an E2 prerequisite. Row/status are noninteractive; outside-dismiss is an independently observed region, not a labelled44 button. Native template completion and SDK size coverage still require truthful input/level binding. No active PASS will be written here.

Existing outputs: matrix40 targets/24 budgets and interaction200 SDK +48 Recovery records. Many records contain intrinsic/null/100% sizes or real min44 constraints; do not replace unknown font widths with fabricated44. Preserve numeric dimensions, explicit native response coordinates/parent payment, actual minima and font-context-only boundaries. Recovery's ambient-fp constraints are lower bounds, not four-font glyph measurements.

Actual source-category Text has fixed grown height but no minimum width. Source's custom ReaderButton wrapper cannot place a constraint on the real interactive Text, and no caller width hook exists. Root authorized the sole finite shared drawing-owner fix: ReaderButtonFrameModifier applies native minWidth44 only for source-management-category, preserving all other ids/specs/style/paint/action behavior. No generic API or Source production changes. A separate sourceGroup menu-parent width possibility (text measurement absent leaves chrome42) is recorded for Root decision before assigning any percentage width floor.

Freeze current production/producers/checker/schema/reports in source-e2-full-targets-20261103/baseline. Necessary checks: new `node tools/test-source-category-minimum.mjs --case category-minimum,style-isolation` uses actual Source category→ReaderButton→Text SDK leaf, old no-floor negative, eight width/font contexts, and the existing registered spec enum for finite style setter differential (no business consumers/full suite). A pure E2 evidence adapter/test will preserve actual dimension/minimum/parent authority and reject missingref/<44/stale/matrix mistakes; record exact command before execution. After the authorized ReaderButton bytes stabilize, run matrix and inventory/sdk-targets/recovery-targets producers exactly once to bind current full bytes; no FontFilter/Switch/Index/business repeats. Root owns HAP13 and any necessary new Native point; HAP12 evidence stays on old host bytes.


#### 14.46 Directory keyboard observation: unknown is not hidden (before execution)

HAP12 fixes the actual native focus path: same fixed query id/bounds now becomes focused=true after a real center click. A settled observation remains focused=true but no inputmethod window/IME; retain that separate unresolved Native result. Code/installed SDK audit confirms Content → Toolbar → Field → ReaderSearchInputTarget really calls enableKeyboardOnFocus with the prop. Its documented scope is non-click acquisition, so the following recovery-state error is not claimed as the sole cause of the first click without IME.

Current syncContentLayout samples keyboardInsets.bottom before the unchanged-layout-key early return. After a fresh onFocus, any metrics callback with bottom0 overwrites the default restoration true as if the user hid IME, even though this opening has never observed a visible keyboard. Exact initial/focused/current-session facts are frozen in control-directory-keyboard-observation-20261103/baseline. Only ReaderControlDirectoryContent gains an opening-scoped seen-visible tracker: >0 records visible and restoretrue; 0 may set restorefalse only after visible has been observed. New opening/tab and retirement clear the tracker/default as appropriate; existing current-id/epoch/cancel guards and all Native focus/IME service calls remain unchanged.

Sole necessary entry is `node tools/test-control-directory-short-content.mjs --case keyboard-observation`: actual SDK Content and actual Field native modifier expose the policy. Compile the true before-source as a negative for onFocus + zero inset + identical key; current pending-zero stays true, observed-visible/Back-zero stays false through same-instance authored/prefix migration, and old input/old frame/retired opening cannot leak into a new tab/session. No umbrella case or behavior suite is called. Existing fixed ancestor/native-path proof is precise REUSED because this change adds no Native ancestor/focus setter or geometry; the prior Field/Toolbar guard cases remain scoped evidence. SourceE2/shared widths are in a parallel disjoint owner; active Content/test pins will bind together after both scopes stabilize, then refs/register once. Root owns any new immutable HAP/Native continuation; this owner does no HDC/build/sign/install.

14.43 HAP12 Native: unknown long-notice expand/collapse/reconcile completed5steps with actual currentPID11240 and paid targets; Source templates now34/34 across exact scoped HAP9/11/12 observations (not whole-page/multi-font acceptance). Fixed directory input singleclick335930 now focused=true at same original bounds, retained after settled read. No inputmethod window/extension appeared; this is focus PASS and IME NOT_OBSERVED, not IME PASS. `syncContentLayout` has a separate proven pending-visibility bug (initialzero overwritten as hidden); exact SDK negative then seen-visible tracker fix is being included in final candidate, without claiming it already proves first-click IME causality.

Native draft17 was genuinely entered. Search click produced a new tree-open-static-snapshot, but the diagnostic memory NavigationPort deliberately ignores query filtering and returns a static full tree. Actual tree showed chapter1/2, not unique17. Root's generated refocus plan purpose mistakenly says unique17 observed and search stole focus; neither is supported (actual input remainedfocusedtrue). Preserve that historical plan/receipt and correct its interpretation here: the extra input click was an unnecessary repeat; only literal input/draft preservation and callback are evidenced. This diagnostic scope cannot close Core query result correctness; no production matcher is invented or changed. Same-instance height transfer will be judged on actual text/focus/identity/anchor, with static-port boundary explicit.

14.46 local policy correction stable: Content58d4c977… and short-content test7484702b…. The sole keyboard-observation case first failed against actual old Content at fresh onFocus + same-key0; after the minimal tracker fix it passed first attempt. Actual SDK Field emits enableKeyboardOnFocus(true) for pending-zero and false only for observed-visible→zero; same-instance authored/prefix restore, old input/queued frame, new tab/opening and retirement boundaries are asserted. This is a restoration-policy/Native modifier proof, not an IME service or physical keyboard simulation, and does not label first-click-noIME cause as proven.

Exact AST/input reuse confirms119 unrelated Content members, all Field/Toolbar/Geometry/Coordinator bytes and four existing case bodies unchanged. No existing focus/short/prefix suite rerun. The changed test's default actor remains the same Content; an optional explicit before-source is used only by the meaningful old-state negative, and Field helper adds Native modifier replay. control-directory-keyboard-observation-20261103 preserves baseline/current/diffs/old failure/fix PASS/scope proof; its public before Content38813330… is required by this exact case and must be included in recovery packaging. Joint active Content/test pins and refs/register wait for the separate Source E2 owner; Root owns final new immutable package and Native continuation.

14.45 scope amendment before the width fixes: actual SourceToolsPage compactActionButton/actionButton/fullActionButton bind source-tools-compact/source-tools-action. HAP11 clickable Text widths43.1429vp for 全选/清空/取消 are distinct from the wider custom-component Common wrapper; this is an actual minimum contract gap, not an observed edge click failure. Root authorizes the same finite ReaderButton native-owner minWidth44 for these two ids, preserving their existing grown minHeight in the same constraint call. All other button ids remain exact setter no-op. Root also authorizes sourceGroup resolvedWidth to request at least44 only when actual available width>=44, then retain existing menu/viewport clamp; other variants do not change. No shared spec, generic API, paint, action or Source production edits. The exact additional checks in the new minimum test are tools-consumer (actual three SourceTools action builders) and group-parent (actual Source geometry/Panel resolver, old42 negative, supported320/366 x1/1.3/1.6/2, insufficient viewport clamp and default variant equivalence). Runtime negative inputs are public tools/fixtures/design snapshots, explicitly included in recovery input lists.

14.45 precise evidence-tool execution plan: extend only inventory sdk-targets recording with real Source groupSelectWidth/filterControlWidth and real Panel resolvedWidth/Chrome lower-bound input (zero native text width is a minimum port, never a measured font), plus actual searchField Row/ReaderSearchField Row/child allocation for its percentage response. Existing200 SDK and48 Recovery samples remain their same cases; fresh production bindings require their one necessary run after shared fixes. Add pure tools/page-structure/source-e2-evidence.mjs composition and node tools/page-structure/test-source-e2-evidence.mjs --case complete-targets,rejection-boundaries. The adapter must retain exact numeric paint separately from minimum/percentage-parent constraints; add schema/checker support for nullable unknown intrinsic paint with a required real minimum. Reject missing any22ref, target<44, stale inputs, duplicate/wrong matrix and missing parent payment. It does not alter E2 threshold or E3 Native requirements; source/invariants remain for the independent central owner to adjudicate. Minimum probe attempt01 failed only because its explicit Source category consumer omitted contentFrame; corrected dependency attempt02 all4casesPASS, old-floor negatives remain meaningful.

#### 14.47 Final runtime candidate HAP13 — explicit minimum widths and keyboard unknown policy

Native Tools audit found actual clickable two-character Text width151px/density3.5=43.14vp; its206px Common wrapper is not the native click carrier. Source category also lacked an explicit numeric width lower bound; source-group percentage options depended on a parent that could fall back42vp when measurement was unavailable. Current observed category/group frames exceed44, but that observation alone does not prove every supported SDK context. Fix only ReaderButton's actual Text for source-management-category/source-tools-action/source-tools-compact with minWidth44 (preserving Tools minHeight in the same constraint), and only sourceGroup SelectPanel resolved parent floor44 within actual available-width clamp. No wrapper substitute, new generic override or unrelated button-family change. Source itself remains de09. Exact leaf/old-negative,45styles2160tuples differential, Tools12actual leaves and group24contexts passed; E2 complete22ref report adapter is a separate metadata task, not invented font measurements.

Directory pending keyboard state is separately repaired with seen-visible tracking: an initial zero inset is unknown and preserves the default request; only zero after observed visible can mean hidden for restoration. Current Content58d4c977... exact SDK negative/positive passed without platform keyboard service calls. Native12 already proves actual fixed focus and literal17 through320→122→320/presentation1; IME was not observed. The static memory tree does not implement Core filtering, and the generated refocus-plan erroneous prose is explicitly corrected in14.43. New13 must test actual changed keyboard policy, not reuse absent IME as PASS.

All runtime production owners declared stable before this build. Only canonical isolated iteration/signed build with contracts none and existing native cache is necessary to install these changed bytes. No repeated full suite or unaffected business cases. E2 adapter/tests/active facts may finish after the immutable runtime snapshot; they do not alter ArkTS bytecode, and final delivery must bind those metadata revisions separately instead of rebuilding unchanged App. Same exact VM, preserve-data update, observed process-exit/cold-route barrier and targeted changed paths only. System font remains1.45 and must be restored with current-session evidence. Historical candidates and failures stay frozen.

14.47 Build attempt13 FAIL preserved: canonical controller detected build/gate tool inputs changed during build (40213b52...→a0ded73c...) while Source E2 adapter work was still writing. Root started this build before all build-bound tooling was frozen; production-stable alone was insufficient for this controller's input guard. No new candidate is published/admitted and no staging HAP is consumed. Installed candidate remains HAP12. Wait for Source tools/reports/active metadata stable and its final checks, then one bounded new canonical build; do not bypass provenance guard, roll back WIP or repeat unchanged business suites. This is build-input coordination failure, not a Native/VM failure.

14.45 results: all production/tools are now STABLE. ReaderButton cffcabb8… native three-id width floor preserves Tools grown minHeight; ReaderSelectPanel5babe7c3… only sourceGroup parent floor. Source remains de09. Actual category112 leaf observations including old no-floor counterexample,45 registered specs/2160 setter tuples with all other ids exact equivalence,12 actual Tools leaf targets and24 parent contexts pass. The two existing producers each ran once on final production: matrix32/40/24 and inventory200+Recovery48 PASS. New complete E2 evidence has22refs×8=176 targets/24 budgets, SHA12ceeb03…; actual checkLayoutEvidence accepts it when the current page explicitly claims full22ref scope. Nine rejection boundaries pass. These are dimensions/minimum constraints, not Native glyph measurements; intrinsic visual remains null where unknown. E3 stays NOT_RUN. Minimum attempt01 dependency failure and adapter attempt01 AJV strict schema failure are preserved with their fixes; neither was hidden or converted to NOT_RUN. Exact inputs/commands/dynamic public before-source fixtures are listed in source-e2-full-targets-20261103/verification.json. Central active binding and final Native/category/Tools edge point remain separate Root/Directory work; this owner makes no package/device claims.


#### 14.47 Final current-E2 and directory keyboard binding (before execution)

Root adjudicates Source E2 by its actual current44×44 minimum/equivalent-response/paid-parent predicate. Fresh complete report covers all22 interactive references in320/366 ×1/1.3/1.6/2, preserving exactSDK, native-constraint lower bound and percentage-parent evidence levels; it does not manufacture four-font glyph measurements. SourceE2 may PASS under that predicate. Native34 scoped in-memory templates have separately completed across historical/current scopes; new shared category/Tools/group minimum floor still has a separately pending current-host native point. E3/native full font matrix/readout are not extra E2 thresholds and are not promoted by this report.

Only active register/control JSON change: bind current ReaderButton/ReaderSelectPanel, DirectoryContent58d4c977…/short test7484702b…, complete176-target/24-budget report and its exact producer/test/fixture inputs. Source targets explicitly enumerate all22 refs. E2 source invariant becomes PASS, while independent interaction obligations remain NOT_RUN and E3/content/adaptation retain actual unresolved Native matrix status; D1/B1 and all other family results remain unchanged. Root Native focus/migration points stay separated from IME/Core query/route acceptance. Navigation/platform registries and production/tools remain unchanged. Freeze prior active JSON and dependency pins in final-e2-keyboard-binding-20261103.

Only necessary commands after this binding are `node tools/page-structure/check-contract-refs.mjs` for current references/hashes and `node tools/page-structure/check-register.mjs` for complete E2 support plus known diagnostics. SourceOwner already executed exact complete adapter schema positive/negative checks and current matrix/inventory once. Legal model/schema/derive/host case behavior has not changed here and is REUSED, not rerun. Expected register delta is removal of exactly one Source E2 FAIL, not globalPASS. No business suite/build/HDC/device action belongs to this binding; all production/tools/active freeze immediately after current gates.

14.47 current active stable: register679c0f36… / controlRegistry308c32cf…rev11; Source15/Directory8/Downloads6/Tools2 are registration revisions, not subject counts. There remain4 families/21 registered subjects/107 controls. Source layers are5PASS/2FAIL/9NOT_RUN: E2 invariant alone becomesPASS by the complete176 targets/24 budgets, independent interaction obligations becomeNOT_RUN rather than retaining an obsolete E2 failure, content/adaptation E3 remainFAIL. Navigation/platform registry bytes, D1/B1 and all other invariant results are unchanged.

Refs initially detected one identical interaction report pin duplicated by redirecting the old pointer after unioning complete report inputs. Preserve that metadataFAIL; remove exactly the identical duplicate, then final refsPASS. Final register retains38 known diagnoses only:20E2FAIL,5E3FAIL,8G-03NOT_RUN,3SCOPENOT_RUN,2B1NOT_RUN. Exact set difference from prior39 is only SourceE2 removed, with no new stale/model/reference issue. SourceOwner schema/adapter cases and unchanged behavior/model/host ranges areREUSED; no extra suite. All production/tools/active frozen and Root notified before canonical final HAP14. final-e2-keyboard-binding-20261103 holds before/current/diffs/all attempts/final manifest and public activeZIP. Package/Native/current-session font restoration remain independent Root-owned results.

14.47 Final build14 entry after complete freeze: all runtime production, tooling/schema/checker/adapter and active JSON owners now STABLE. Register679c0f36... / control308c32cf... revision11 bind actual current Buttoncffc/Panel5bab/Content58d and Source de09. Full Source E2 minimum-size evidence176/22refs passes its actual definition; formal E2 PASS, independent interaction NOT_RUN and E3FAIL remain. Source16layers now5PASS/2FAIL/9NOT_RUN, not an invented whole-layer upgrade. Final refsPASS/register preserves38diagnoses(E2FAIL20/E3FAIL5/G03NT8/SCOPENT3/B1NT2), no stale/ref/model errors. The intermediate duplicate input pin was diagnosed and precisely removed; preserve both check logs. All repository docs are frozen during canonical build14 too; owners may only archive artifacts. Do not consume failed attempt13 staging bytes.

14.47 Independent raw-parent review rejected one E2 minimum proof after HAP14 was published but before install: real group selected Row is386px while its outer PanelColumn392px atdensity3.5, so row content excludes two border widths. The new outer floor44 therefore only guarantees inner42; the176 report12ce and central E2PASS were wrong for its eight group-option samples. Preserve those artifacts and historical PASS, explicitly revoke their use for this proof. SourceOwner agreed and is changing only sourceGroup outer floor to44+2*TOK_BORDER_W, and group-option evidence to actual content lower bound outer−2border, adding the actual Column→Scroll→Column→Row chain and old44→42 negative. Exactly eight group-option samples are affected; the other168 samples remain supported. HAP14 is signed/buildPASS but will not be installed; installed remains12. Wait for corrected tooling/report/active freeze before one new canonical candidate15. This is an evidence/parent-payment defect caught by independent review, not a VM failure or justification to bypass guards.

14.45 border-budget correction (before execution; supersedes the group-option part of earlier PASS): Root independently read actual Native Source D selected Row386px inside Panel392px, density3.5, exactly2*1vp border less. Our previous report12ceeb03 used the Panel outer44 minimum as the100% leaf content width; real Row would be42. The original report and central PASS679c/308c are retained as historical unsupported evidence for those8 group-option samples, not silently overwritten. HAP14 published but not installed; new byte changes require the next Root candidate.

Minimal scope: only sourceGroup Panel requested outer minimum becomes44+2*TOK_BORDER_W=46 when available>=46, retaining existing viewport clamp and every other variant. sdk-targets records actual content minimum outer minus the real Panel border. No ReaderButton/Source/trigger/query production changes. Add node tools/test-source-group-border-budget.mjs --case parent-chain with actual SDK Panel Column(border) -> Scroll100% -> innerColumn100% -> real ChoiceRow100% and old44/content42 negative, new46/content44,320/366×1/1.3/1.6/2 plus insufficient viewport clamp. Existing group-parent case must reflect the correctedouter46 claim; only that changed exact case runs. Fresh matrix and inventory/sdk-targets/recovery-targets once each because full ReaderSelectPanel producer inputs changed; write new source-e2-border-correction-20261103 reports, compose and run complete-targets/rejection-boundaries with explicit new paths. Adapter must independently debit the recorded border to reject stale outer-as-content metadata. No unrelated business/Native suite; query actual allocation already debits its own field border and group-trigger clickStack is itself bordered inside an unbordered parent, so this specific outer-content debt does not apply there.

14.47 Corrected final freeze for candidate15: SourceGroup outer46−two1vp borders pays actual inner44; new proof176/22refs has independent old44→42 rejection, actualSDK16 parent-chain contexts and10adapter negatives. Final register1230f585.../control9272482f...rev12, Panel6f639352... and report47e0699c... bind current code/proofs; refsPASS and exact38old diagnostics remain with no stale/ref/model/new error. Prior12ce formalPASS boundary stays revoked for its eight group-option samples. All repository production/tools/active/docs freeze during canonical15; artifacts only. Candidate14 remains published/uninstalled history, never silently substituted.

Current-session original system font has been restored: actual Settings sliders2/1/1, followed by foreground App and aa config readback1.000000. New receipts font-final-restore-ui/font-final-verify bind this session (not older HAP7 restoration); mutable font-restoration-required ledger is RESTORED_CONFIRMED. Large1.45 Native scopes remain retained; final changed-host/policy tests will run at original1.0, no more system setting changes. Raw restore evidence remains local/private.


## 全量 UI 对比修复补充（2026-11-13）

当前代码侧实施与独立审修详见[全应用UI对比修复](../architecture/ui-design-full-fix-20261113.md)。审计15个当前条目及1个保留条目已完成源侧修复，包含共享恢复表面、阅读/目录/TTS、下载/导入/徽标、主题行与书源统计，另补旧书签元数据兼容和精确原记录核对。独立审修发现的装配、目标归属、回执分类与测量代次遗漏已纳入对应准确回归。完整页批准、Native尺寸/字形/触摸/焦点/系统返回及用户接受继续按各层记录。

2026-11-13 最终进度补记。代码侧15个当前项与1个保留项、通用圆角40个入口及16个规格、同类clip库存和阅读两处补修均完成开发与独立审修。最终冻结生产973ec49a，App18805b72930f已指定证书签名并在现有远程VM保数据安装启动。Home亮度和快捷到完整目录的四步最小原生核对完成，当前帧未出现自动恢复卡占位。详细候选SHA、失败假设、复用范围及证据见[全应用UI对比修复](../architecture/ui-design-full-fix-20261113.md)。21个全页visual继续NOT_RUN，Source E2/E3与完整页来源批准、大字号、读屏、全页交互及用户接受继续开放。


## 控制栏全元素后继执行补充（2026-11-13）

用户在App18805b指出Home进入目录时外壳变化，并扩大要求到控制栏全部元素。本批继承全量UI修复，重新登记共享51项、目录/书签/TTS105项和其余模块48项。共壳、独立paint/target、旧回调准入、短窗自然流、备用预算与字体真实覆盖的代码原因及逐域修复见[全应用UI对比修复](../architecture/ui-design-full-fix-20261113.md)。三域开发后交叉独审，全部冻结后才进入新候选实际编译、保数据更新与原生画面核对。

当前登记source/sourceInputs按最终字节刷新，历史证据各守原输入。Source E2/E3、全页visual、整页来源批准与未执行原生维度维持原判定。具体候选和原生执行追加于同一修复记录。原书签未决记录本批未核对、未继续，所有业务数据沿原owner保留。


## 体系性重审状态（2026-11-14）

控制栏全量完成结论重新开放。当前明确两组框架问题，包括模块/profile两阶段交付及测量代际耦合，以及31536cfb将44响应预算映射进默认paint/slot。此前目录调整随全部模块共同重审，代码原因、七域量化、历史合流契约与同包Tab原生边界见[全应用UI对比修复](../architecture/ui-design-full-fix-20261113.md)最新补充。204项清单和既有局部SDK只在原准确范围内保留。后续先完成统一语义及生命周期修复、默认macro与中间帧代码验收和独立审修，再绑定一个实际源码候选。当前原生Tab根因仍OPEN，当前候选全页visual与Source E2/E3维持原判定。

2026-11-14 体系性修复已完成代码与选定SDK独立审修。七模块的paint/slot/response和父支付已分离，默认比例恢复冻结原稿。Host预先准备只读facts与profile，原子提交目标模块，元信息采用保留原logical pair。Runtime形态及时钟继续由原owner持有。共享Header、Home、Pan及Search/Directory恢复动作通过当前身份交接保留实例回调。Recovery14覆盖真实SDK代理与装饰器，源码范围、失败历史和复用结果详见同一修复文档。

正式控制登记已从19更新到20，四族21项source/sourceInputs绑定266个唯一当前文件，各项revision本批递增一次。最终refs03通过，register03保留39项既有开放诊断。紧凑目录部分响应小于44，E2继续FAIL，旧44绘制证据保留历史判定并退出当前证明。全页visual、Source E2/E3及原生大字号等范围各守原判定。当前仅书架Tab首测量0宽原生材料缺陷在代码侧闭合，523首帧扇形原因继续OPEN。下次必要候选复用实际安装机会取得首次书架同期帧与RS，所有agent开发和独审完成后才进入该阶段。

后继实际编译类型缺口已补齐，34ea候选完成指定证书签名和远程VM保数据安装。其ready Tab当前正常，历史扇形归因继续OPEN。已采Home/Directory/TTS Quick具有相同外壳与内容边界。新增原生中间帧同时定位嵌套目录加载行使旧章节位移88px，以及Full TTS秒数加号仅2px可见。暂停后续Native后，已从共享Surface私有状态和真实子组合预算修复两条链，并补Search/Replace/AutoPage三处真实扣款。准确回归、独审、控制登记21及21页面当前绑定均已完成，269唯一源/2311pin，refsPASS/register39开放结果保持。当前安装34ea为本补修之前的候选，后继交付及原生端点另记。[全应用UI对比修复](../architecture/ui-design-full-fix-20261113.md)
## 控制栏体系重审的边框组合后继收口

2026-11-14。全量重审已进一步定位d8ad88ef原生包装的父边框与子Text外盒重复、31536cfb有限宽度扣款缺边框，以及Replace旧行外壳和自然增长预算的复合欠付。八个模块及三个嵌套宿主的46个border站点、共享57文件与34个原生Button构造、AutoPage/Replace全部38个Builder链已完成源侧逐项审读。五类私有模板缺口分别修复，默认原稿角色保持，真实文字增长沿实际内容盒计算。逐项历史、准确回归和独立审修见[控制栏体系修复记录](../architecture/ui-design-full-fix-20261113.md)。

本批正式register为9c96a9e0，九登记各revision22→23，274唯一输入、2356处pin，control21保持。refs单次PASS0，register单次保留原39项完整诊断，Primary独审23881e00接受。此前App081已在现有远程VM保数据更新，Home真实657px内容和视口相等且Scroll为false，首次ready Tab正常。该包Appearance两枚主题动作Text越界继续保留FAIL，后继已修源码须由新准确候选另行记录。全部生产与独立审修冻结后才继续安装或设备步骤，历史Tab扇形因果、全页visual和Source E2/E3仍按原开放判定。

全应用原生Button顺序后继批已完成代码与独立审修。当前SDK要求显式borderRadius位于border之后，268ETS/207构造及66modifier闭包内九坏序模板已按原值调整，八生产文件保持其他几何和业务。373TS无对应构造或modifier声明，207构造的内容盒同型账本没有额外精确outer重复。正式72fee70d/control21为当前冻结，16受影响own登记各递增一次，277唯一输入、2388pin，refsPASS0/register原39项保持，Primary终核9bc073c4接受。Appb5e6的两个主题Text已实际完整包含并获独审，圆角材质与尚未采样的AutoPage/Replace端点由后继候选单列核对。[完整修复与历史归因记录](../architecture/ui-design-full-fix-20261113.md)

共同绘制owner及导航提交副作用后继批已完成独立审修。公共Quick框仅Dir/Appearance/Settings，Search/Auto/Replace保原child单框；独立上层Full描边严格使用FullSurface原矩形与透明度，41Panel与41参考Stage合法样本、五负例通过。Replace读取接到完整receipt/ready后，真实入口及busy解除、metadata/环境快径、Recovery、旧请求和去重经准确叶05与独审接受。当前正式da88a15f/control21为冻结结果，13own递增、282唯一输入、2453pin，refsPASS0/register原39项保持，Primary终核4498870c接受。App6e已证明主题圆角与内容盒、设置端点，旧Quick双框与Replace idle帧保留，当前新字节Native单独核对。


2026-11-14 当前候选为源码4ca0d6af / App16f2c3829b3b，signed HAP46889b6e07e8039706c74bed3b58b1801d9ee51ae8719e7ffb7605a1030e4a20。所有开发及独立代码审修完成后，实际ArkTS编译、指定证书签名、现有远程x86_64 VM保数据更新和启动通过。选定AutoPage Quick/Full、Replace Quick/Full、Search Quick及返回Home已完成原PNG与树核对，Replace当前真实空集合读取完成，ready Tab正常。原首装动画保持原判定，历史Tab扇形物理因果继续OPEN。完整记录见[体系修复当前交付](../architecture/ui-design-full-fix-20261113.md)。正式登记da88a15f/control21、原39诊断、Source E2/E3和21visual NOT_RUN均保持，当前全动作连续闪烁、大字号/窄宽原生、全目标命中和整页接受继续开放。原书签未决核对及继续本批为0。
