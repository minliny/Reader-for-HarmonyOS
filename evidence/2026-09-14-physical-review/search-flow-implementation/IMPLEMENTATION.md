# 搜索至试读实施记录

## 最新已验证安装：d5f13a96

**`20260914T185653Z-d5f13a96-803a4b82`** 已在 **2026-09-14 18:58:57.400 UTC** 保数据安装到 VM `6460677a198b` 并启动，install/launch PASS。Harmony `d5f13a965adf07e6c36fd8ad7e7315cf2ae7d686`、Core `0c5a3956274197578554f36b1a7fed9e1977ea78`，manifest两仓clean；261项Harmony检查、ArkTS、签名与安装身份准入通过。签名HAP **167841969 bytes**，SHA-256 `325cdd424b9dea2bb90ced607d87c5d3299f8248e8aa2376ac56ac76041d3004`。

[Manifest](vm-d5f13a96/manifest.json)、[部署回执](vm-d5f13a96/deployment.json)、[构建](vm-d5f13a96/build.log)、[身份检查](vm-d5f13a96/inspect.log)、[安装](vm-d5f13a96/install.log)及[副本校验索引](vm-d5f13a96/receipt.json)已归档。新Core正式门禁3837/3837、0 skipped、无LEAK，210 conformance/0 failed、drift0和C/C++smoke通过；首次因localhost端口权限失败的运行仍保留在下方Core门禁证据，不能冒称该次也通过。

**本包新书签日期尚未VM验证，PH76实际回调结果仍OPEN。** 6863的书签保存/删除与PH88几何、aa387的胶囊及其他交互均保留原包身份，不因安装d5就算重复验证。此包仍为iteration / `acceptanceEligible=false`；在线动线、真机与用户验收不因此通过。

启动预检曾误用`sys.boot_completed`，返回参数错误1002；随后使用规范`bootevent.boot.completed`确认`true`，SceneBoard仍为PID1529。三份原始回执在上述索引中；这是操作参数错误，不登记为VM启动故障或HDC断联。

[后续Core门禁与Native证据](ph86-time-final-gates/receipt.json)、[正式全量](ph86-time-final-gates/ph86-time-core-final-unrestricted.log)、[环境失败原件](ph86-time-final-gates/ph86-time-core-final.log)。

## 6863af5d 阶段产物与边界（历史包）

本轮执行 READER_REPAIR_SPEC §16 及 PH77–91。最近取得正式部署回执的是 **`20260914T182625Z-6863af5d-ded2e152`**：Harmony `6863af5d4e9c5dac34e3ca74b120a7d5daa2952e`、Core `28369db9405822f4b8277eb95ad94057f177b7bb`，构建时两仓 clean。该包 **261 项 Harmony 检查、ArkTS、签名、内置源字节检查及 VM 保数据安装/启动通过**。日期修复可能产生后续包，当前不能提前把待构建源码记为已安装。

| 层级 | 当前证据 | 限定 |
|---|---|---|
| Core/Native | 沿用同 Core 的3832/3832官方检查（1 leaky、0 skipped）及已验 Native | Core 未变化；不是这次 Harmony 包重新执行了一次 Core 全量。原日志和 LEAK 边界保留在下方阶段记录。 |
| Harmony/HAP | [本包构建](vm-6863af5d/build.log)261项 PASS；[manifest](vm-6863af5d/manifest.json) | `iteration`、`acceptanceEligible=false`；警告原样保留，不声称零警告或验收包。 |
| VM 安装与启动 | 18:28:21.450 UTC，[保数据回执](vm-6863af5d/deployment.json)，targetRef `6460677a198b` | HAP SHA `3df455f5b6f0d13bafd09f2d15c3e3c456efc1642eb54ba6b8ccc103db2e0b8f`，与 manifest/安装输入一致。 |
| PH86 本包实证 | 新增后填充书签、39.790秒后仍在；列表17+18章；删除后图标消失、重开列表只剩17章 | [完整时序/原图/节点摘要](VM_VALIDATION.md)、[回执](vm-6863af5d/receipt.json)。通过所测保存/删除闭环；未证明连续动效、重启后持久性或真机行为。 |
| PH86 日期 | **6863仍错误显示01-01 08:00**；独立负责人已在后续源码处理 | [日期专项](ph86-bookmark-time-audit.json)；新日期规则不在6863，不把本地修复当该包VM验收。 |
| 其他 VM 项 | aa387 的既有功能/胶囊采样分包保留 | 安装更新不等于所有旧项目在6863重新验证；PH90精确中途paint、PH89首次交接/全程帧率仍未验。 |
| 在线闭环/PH76 | **OPEN** | 旧在线109源失败已定位106次非公网地址准入、3次缺searchUrl；详见末节。新包PH76实际回调结果未归档前不标通过。 |
| 真机/用户验收 | **OPEN** | 仅有本包VM回执；不能沿用旧真机包的身份，不能声称完整计划验收完成。 |

最新逐项事实统一见 [VM_VALIDATION.md](VM_VALIDATION.md)。下方 aa387 与更早记录保留其原阶段状态，不混作当前包结果；后续新产物必须另绑 manifest、源码、部署回执及实际验证。

## aa387f08 阶段快照（历史包，不代表6863重复验证）

本轮执行 READER_REPAIR_SPEC §16 及 PH77–91 反馈修复。当前绑定产物为 `20260914T171802Z-aa387f08-71c7172c`：Harmony `aa387f08`、Core `28369db94`，构建时两仓 clean；Core 官方 **3832 项 PASS（1 leaky）/0 skipped**，本次 HAP 入口 Harmony **260 项 PASS**，Native、HAP 编译/签名/校验及 VM 保数据安装与启动通过。**PH90 收起回首条的终态符合用户原约定，初判“位置丢失”已撤回；精确中途 paint 未验。在线搜索 109 源约 3 秒全部失败正在定位，不能记为速度 PASS；当前不是全部交付或用户验收通过。**

## aa387 阶段证据状态

| 层级 | 当前状态 | 证据边界 |
|---|---|---|
| Core 官方完整检查 | 3832/3832 PASS，0 skipped，含 1 leaky | 210 conformance、0 drift、C/C++ ABI smoke；[最终日志](ph77-91-core-official-final2.log)与[管道 LEAK 审计](ph77-91-leak-summary.json)。不隐去 leaky，也未把它定为应用内存泄漏 |
| Harmony 本地检查 | 本次 HAP 入口 260 项 PASS | [本次完整日志](ph77-91-hap-build-second.log)；旧 250 项属于早期历史 |
| 最终 Native 输入 | PASS，与 manifest 输入 SHA 一致 | Core `28369db94`；[Native 日志](ph77-91-native.log)、[HAP manifest](ph77-91-hap-manifest.json) |
| HAP 编译/签名/校验 | PASS，iteration | ArkTS、非增量、签名、内置源字节检查通过；[verify](ph77-91-hap-verify.log)。`acceptanceEligible=false`，编译警告保留 |
| VM 安装与启动 | PASS，保留数据 | 2026-09-14 17:20:51 UTC，[同 run 部署回执](ph77-91-vm-deployment.json)，签名包 SHA `720e4709979005f8dc785c768bcb76208a8ea6ebcc250a05dfa88a818861cc98` |
| VM 本地功能 | 已列操作与 PH90 收起终态符合约定；精确中途 paint 未验 | PH80 现场历史、PH81 重入键盘、PH82 光标、PH83 20 章预览、PH84 外部目录/返回、PH87 稳定菜单、PH91 图标及 PH90 输入/加载/滚动已有事实；范围与初判撤回说明见 [VM_VALIDATION.md](VM_VALIDATION.md) |
| PH86 追加书签审计 | 独立中间反转已修、本地回归通过；旧 VM 稳定缺图标原因 OPEN | 6 种 ACK/投影/正常回弹顺序、12 次添加删除全程无反转；不把该瞬态修复归因为旧 54 秒缺图标。[专项记录](ph86-bookmark-native-audit.json)、[回归](ph86-bookmark-top-info-fixed.log)；新修复尚无设备验收 |
| 在线闭环与 PH76 | 未通过，原因定位中 | 本次在线搜索 109 源约 3 秒全部失败，不是速度 PASS；停止重试/详情/换源/试读/返回、松鹤响应及资源捕获仍未通过 |
| 本包真机行为/用户验收 | OPEN | 本记录无同 run 真机部署回执；旧包安装、VM 安装及桌面测试均不替代最终真机行为或用户验收 |

当前记录截至 2026-09-14 17:46:30 UTC 的本地书 VM 操作。构建 manifest 的安装 OPEN 是生成时快照；后续安装以部署回执为准，不修改不可变 manifest。PH90 经执行参考第 196–214 行和真实方法探针复核，Quick 回首条是既定终态，已撤回“锚点丢失”初判；未改生产，也不新增保锚需求。中途 paint 和动态帧仍未验。随后在线搜索全失败已由根任务另行定位，不将其耗时记为性能通过。

## 早期状态快照（保留历史，不代表当前状态）

下文保留此前 250/3811 门禁和构建/安装进度的原始记录；早期“最终”“正在”“待完成”均按当时阶段理解。当前状态仅以上表和 VM_VALIDATION.md 为准。

本轮执行 READER_REPAIR_SPEC §16；基准 Harmony 99cdeb02、Core 316ed836。当前 Core 官方完整门禁 PASS、Harmony 本地 250 项 PASS；最终 Native、HAP、VM 待完成，不代表已交付或设备验收。

### 当时证据状态（旧表）

| 层级 | 当前状态 | 证据边界 |
|---|---|---|
| Core 官方完整检查 | PASS，退出码 0 | fmt、workspace/all-targets Clippy、3811/3811 nextest、210/0 conformance、strict drift、C/C++ ABI smoke；见 [最终日志](core-official-final.log) 与 [检查回执](core-official-final.receipt.json) |
| Harmony 本地检查 | 250 项 PASS | [SDK 同步后最终日志](check-local-sdk-final.log)；不是 ArkTS/HAP 编译或设备行为证据 |
| 最终 Native | 构建中，待完成 | Core `61a2f86e7`已提交且clean；Root正在重建此提交，旧提交构建记录不作为最终输入 |
| HAP 编译/签名 | 待完成 | 首次预检失败历史保留，尚不宣称最终产物通过 |
| 真机/VM 安装与交互 | 最终新包待完成 | 用户更新顺序为先真机、后VM；Root正在对真机保数据覆盖旧最新完成包`3399326a`，最终新包还须再按此顺序部署；安装与交互分别以回执确认 |
| 真机行为/用户验收 | OPEN | 旧完成包安装进行中不等于最终新包行为或用户验收通过 |

## 集成中发现并处理的缺口

| 现象与触发 | 代码定位 | 处理与证据 | 状态 |
|---|---|---|---|
| v1/旧目录的 readableAt 仍能提高搜索/换源排序，单章失败可影响整书 | SearchCandidatePolicy 与 SourceSwitchGateway 仅时间排序 | 共用 BookAcquisitionPresentation；Core 投影 verificationCurrent/failureCurrent；限定 schema2/证据范围/失败阶段 | 生产回归通过 |
| 章节进内存窗口后 Core bodyVersion/processingVersion 丢失 | ReadingChapterWindow.copyChapter 未复制两字段 | PH75 gateway owner 补齐复制并测试 | 生产回归通过 |
| 换源查询范围变化后旧 Search seed 可复活已删除候选 | SourceSwitchGateway 原 known 直接追加 | related 完整关系+仅缺失身份 batch；已确认持久身份不得被旧seed复活 | 实际 Gateway 回归通过 |
| PH76 被错误描述为要求资源响应体 | 对照固定 Legado 提交的 BackstageWebView.onLoadResource 与 JsExtensions.webViewGetSource，实为匹配资源URL | 改用目标 SDK 真实 onResourceLoad 回调；不使用 performance URL 或自建响应代理；Core/Host定向回归已通过 | VM真实回调待验证 |

## 回归边界

- R1/R2/R9：实际生产方法测试覆盖强刷共享/失败保留/23h跨期/排队停止零网络/前台接管/旧probe晚到/元数据不重复验证/实际第二章交接。
- R5 SourceSwitch：完整多页、游标失效有界重试、分页循环拒绝、混合快照/规则版本拒绝、续传变量原样保留、明确删除不复活。
- 修改公共方法后的旧文本断言和 Node fixture 注入失败属于测试适配；原始错误保留在本轮工具回执，不计为设备故障。
- 上述早期回归记录时尚未进行完整冻结检查、Native重建、HAP、VM和用户验收；当前状态以本文顶部表格为准。该早期记录最后确认的真机安装包为 84cdc4ef；后来安装进展按本文“最终提交与安装顺序更新”单列，不能用本轮源码倒写早期安装事实。

## 最后集成的数据保护检查

- 目录添加章首书签原来没有传远程身份，迁移后会被Core写入门禁拒绝。现仅对这次明确的新位置0，从Core既有缓存取得body/processing scope；无网络补取，创建时仍由Core版本CAS。取消、缓存消失、scope不完整或处理配置冲突均不写入。
- 远程持久书签/正文搜索的非零偏移缺少scope时，Reader不再拿当前chapterWindow的版本给旧偏移补证明。保留旧位置并提示，合法scope与本地既有位置路径仍可用。
- 修改替换/简繁配置后，旧持久位置不能标为新processing版本。Core已补封存及PROCESSING_CONTEXT_STALE保护；恢复此前处理设置可重试，不声称已自动迁移任意跨配置位置。
- 历史bookmark/highlight的书名/作者唯一命中不足以证明原body归属。Core已补mark专属坐标hash+scope与位置原子写入；无事实历史记录保留为legacy，禁止由改名后的当前正文伪造证明。

## VM前置检查

已重新确认现有Mate 80 Pro实例、127.0.0.1:5555连接；boot参数true、Emulator日志09-13 02:10:59出现Guest OS Boot Completed，SceneBoard PID1529已连续运行1天20小时以上，当前系统日志无LIFECYCLE_TIMEOUT/退出循环。受限环境的首次HDC枚举失败，经同命令正常权限只读重试通过，属于操作环境权限问题；未重启、重置或清数据。首次日志读取误用了该VM不支持的`-d`，读取本机帮助后改用`hilog -x`成功，未将命令错误算作VM故障。

## 已完成的Host门禁与提交

- 官方 `./scripts/check-local.sh` 早期完整运行：249入口PASS（新增PH76诊断runner前）；SDK同步后的完整重跑已达250入口PASS，见 [最终日志](check-local-sdk-final.log)。前三次旧fixture注入/接线断言失败分别保留，不隐藏失败。最终pipeline仍须以冻结源码和绑定产物作为交付输入。
- Core SDK：`0a5244d28`；Harmony ArkWeb真实捕获/独立诊断：`a2ccea72`、`b81e2762`；搜索至阅读与scope交接：`23bedae0`；位置冲突分类与中文恢复说明：`d282c9d1`。
- `requiresPositionMigration`不再归类网络失败，不允许自动旧缓存回退/误推荐换源；原始Core错误仍保留于cause。
- 清理正文缓存后的相同正文恢复补充回归已通过，不把只验证删除条数的旧测试当作该流程通过。

## Core冻结与门禁历史

Core 首次冻结时 `585cd0e00`已提交并clean；定向最终18项位置runtime、4项cache.clear、28项source/catalog、9项位置storage，以及联合Clippy均通过，原始日志已附。随后进入统一门禁并暴露下列格式、回放和旧fixture问题；这些早期冻结/构建记录不作为包含最终修复的交付输入。

PH75的保守边界是明确的失败合同：历史mark无原始fact不猜归属；清缓存后正文已变化且旧锚点不存在不猜位移；处理配置改变后无法证明旧坐标时保留数据并要求恢复此前设置。只把这些保护机制的实现/测试记为完成，不把跨配置自动迁移或所有旧缓存升级列为已完成。

统一Core门禁首轮在新增测试夹具格式处失败（runtime.rs与pagination.rs），未执行后续测试；已统一格式并提交`5c4506737`，随后重跑完整门禁并为新提交重新生成Native身份。首轮Native构建通过但不作为最终交付输入，保留源身份边界。

## 统一门禁追加发现

- Core完整no-fail-fast诊断3809项全部执行，3796通过/13失败。3项CLI回放、7项数据库迁移旧fixture、3项WebDAV本地端口权限；不把端口PermissionDenied算作应用或VM故障。
- 越过旧TOC回放断言后又暴露实际R4回归：无bookId搜索条目导致整个响应事务失败。现已在持久/inline两条publication入口跳过不可持久身份，原解析响应仍完整返回；新增混合空身份与有效条目、末项写入故障回滚回归，保持有效记录的整响应原子提交。见 [事务回归](core-search-empty-identity-final.log)。
- SDK同步后首次HAP预检在旧pollNativeQueue必须delay的断言失败，尚未进入ArkTS编译，见 [失败日志](hap-attempt1-sdk-fixture-failure.log)。已按完成唤醒机制修复测试并重跑Harmony250项通过；Core SDK已有50项实际时序测试。最终Native/HAP/VM仍待完成。


## Core 官方完整门禁收尾

- 检查源码是 `5c4506737827c5c387236fe74804d93ddc6b35d4` 加已冻结的10项修复文件；检查期间未修改源码。具体文件SHA-256见 [检查回执](core-official-final.receipt.json)。Root已分项提交`66074edda`（空身份搜索事务修复）、`20c938711`（历史SQLite样本）、`61a2f86e7`（严格回放与动态时间）；已核验最终commit的10项修复文件hash与检查回执一致，Core工作区clean。Root正在从`61a2f86e7`重建最终Native。
- 官方命令：`CARGO_NET_OFFLINE=true CARGO_TARGET_DIR=target/check ./scripts/check-local.sh`。使用已许可的本机loopback执行边界运行原WebDAV测试；不访问外部网络或设备。脚本最终退出0，3811项全部通过且没有跳过；210项conformance通过，strict drift无结构漂移/发布阻塞，C及C++ ABI smoke均为ok。
- 首轮格式失败、次轮fail-fast只运行16/3809、第三次完整诊断3796通过/13失败（退出100）的历史日志均保留。13项分别是：CLI三个回放样例；storage v12/v13/v14/v15、TTS v17、search v16、旧正文格式升级共七个迁移fixture；WebDAV conflict/restore/upload-download三个loopback权限失败。本次官方门禁已覆盖并通过这些原失败测试。
- CLI两份静态样本先逐字段核验旧 `expectResult` 与当前输出一致，再补确定性的目录、上下文、正文证据字段。录制/回放只为 `book.toc.catalogAt` 加显式 `positiveUnixMillis` 规则，其余字段保持整对象相等。正式回归验证旧字段/版本变化、额外字段、缺失/零/负数/浮点/字符串时间均不能蒙混通过；见 [原回放5项](core-replay-fixtures-final.log)、[时间规则1项](core-replay-timestamp-final.log)。
- 七个旧迁移fixture改为从空数据库按历史DDL向前建立完整旧schema，不再把当前库降低user_version，也不使用缺少无关历史表的残缺手建库。未放宽生产迁移要求，保留原行、正文和用户字段断言；见 [unit15项](core-legacy-fixtures-unit-final.log)、[TTS](core-legacy-fixtures-tts-final.log)、[search](core-legacy-fixtures-search-final.log)、[旧正文](core-legacy-fixtures-body-final.log)。
- 本地门禁完成不等于最终Native身份、HAP产物、VM行为或用户验收完成；这些状态仍按顶部表格单独记账。


## 最终提交与安装顺序更新

- Core 最终修复提交为 `61a2f86e7287fb276757706ba436a8103dcb3d37`，与已通过官方门禁的冻结修复文件逐一SHA-256一致；未用新提交号代替源码内容核验。
- Harmony 的 `entry/libs/arm64-v8a/libreader_core_napi.so` 是 **tracked 文件**，当前工作区状态为 `M`，不是ignored产物。Root正在重建最终Native，待按实际构建身份和HAP manifest完成绑定，本文不提前标记成功。
- 用户已将安装顺序调整为先真机、后VM。Root报告旧最新完成包 `3399326a` 正在保数据覆盖真机；这不是最终 `61a2f86e7` 修复源码的交付证明。最终新包完成后仍需再次先真机、后VM，保留用户数据，不以旧包安装或系统前置检查替代新包回执。

## 先行真机安装

按用户追加顺序，2026-09-14 15:33:08 UTC 已将当时最新已完成包 `20260914T115844Z-3399326a-fde4dfee` 保数据覆盖到真机并启动。签名/已安装身份相符，install/launch PASS，数据保留；包 SHA-256 `64b9167ed72de28177f420f50466f00dfedd1b9a557dfb71253a9416d2b7c2df`。此包早于本轮 §16 修复，不能记为本轮修复交付。最终新包完成后仍按真机先安装、VM后测试执行。

## 最终 Native 输入

Core `61a2f86e7` clean 的 Native/SDK 构建通过，50 项 SDK smoke 通过；已从 canonical package 同步 SDK/facade 和未剥离 Native，并核对字节一致。身份与构建日志见 native-final-identity.json / native-final.log。HAP 流水线将自行剥离并绑定 manifest，尚不代表安装或 VM 通过。

## 最终 ArkTS 编译发现

250 个本地入口全通过后，首次最终 ArkTS 编译拒绝 ETS 中的对象展开、Map 解构声明，以及 List 的 onDisappear 拼写。未发布 HAP。保留 hap-attempt2-arkts-failure.log；Index 会话浅拷贝移入既有 TypeScript 证据模块，LRE 显式保留完整进度字段，搜索组件由其 owner 修复。R1/R9、PH75 reader、候选16场景、书架入口及试读9条生产方法回归已通过。收尾复核另确认 R3 本地/来源清单错误原因仅保留布尔值，正在补原因生命周期与 stop/重试回归；未把旧250 PASS当作该补丁已验证。

## PH77–79 新包 VM 在线搜索：地址准入拒绝（2026-09-15）

Root 在本轮新包 VM 搜索109个书源，最终明确以 `hdc -t 127.0.0.1:5555` 绑定目标重读的[hilog](ph77-91-online-reader-hilog-targeted.log)包含109条来源失败：**106条 DNS 解析后地址准入拒绝，3条 `source.searchUrl is empty`**；日志从01:50:52.249至01:50:55.606，跨度3.357秒。该时间是失败日志区间，不是109源成功联网搜索的耗时，不能作为PH77–79性能PASS或来源能力PASS。

Root 在同一明确绑定目标执行的[解析回执](ph7791-vm-dns-targeted.txt)显示 `www.zongheng.com → 198.18.0.189`。这里只用其解析结果；36秒ICMP往返不代表Reader HTTP延迟。该地址落在Host明确拒绝的198.18/15范围，支持VM解析受fake-IP环境影响的判断；本回执只直接证明此域名，不虚构其余105个请求的具体IP，也不从日志猜代理软件身份或配置。

确证调用链为 `HttpExecuteHost.singleHop` → `rejectPrivateNetworkTarget`：`HttpExecuteHost.ts:985` 调用平台 `connection.getAddressesByName`，`:994–1002`检查**所有**返回地址，任何一个非公网/不合法地址即拒绝；`HttpTransportPolicy.ts:234`明确拒绝198.18与198.19。拒绝发生在 `addCustomDnsRule` 和 `singleHopTransport` 前，未执行目标HTTP传输；重定向同样先过门禁。公网地址通过后才在每host互斥租期内固定已验DNS地址，并保持原URL、Host与TLS身份。ArkWeb的顶层文档域名也经同一字节判定后才 `setHostIP`，不能把切换网页模式作为这个顶层目标被拒绝的绕过办法。

未修改生产的[实际方法探针](ph77-91-dns-admission-probe.jsonl)用合成DNS答案验证：198.18.0.1、198.19.255.254、10.0.2.2以及“公网+198.18”混合答案均被原 `rejectPrivateNetworkTarget` 拒绝；纯公网IPv4/IPv6通过。探针未联网，不能代替VM真实解析；它证明已观测198.18地址的拒绝符合现有安全合同。本次不放宽198.18、不修改代理或全局DNS，也不以关闭安全检查恢复测试。

诊断边界：HTTP抛出的当前文本笼统称private/loopback/link-local，也覆盖198.18等非公网保留范围；未附具体解析IP或typed地址分类。`recordSourceDiagnostic`按需保留经过脱敏的请求host/阶段/时长/错误，但没有resolved-address字段。SearchOrchestrator保留逐源原因并在私密hilog记录；SearchPage呈现失败数量和通用“可重试或检查书源状态”，未把这批共享网络准入原因单独呈现。因此用户界面本身不能区分109源失效与统一解析环境被拒绝；当前结论来自明确目标的hilog、单域名解析回执和代码核对，不把缺少UI解释误判为搜索调度失败。

取证归属更正：前两个本地wrapper的 `--target` 仅用于锁，不会自动向其内部hdc补 `-t`；初始hilog/ping曾漏传设备目标，另一次小写 `-t` 被hilog解释为日志类型。[初始hilog](ph77-91-online-reader-hilog.log)、[未明确绑定重读](ph77-91-online-reader-hilog-correct.log)、[初始解析](ph7791-vm-dns.txt)与[hilog帮助](ph7791-hilog-help.txt)保留，**不作为最终设备事实**；本节只采用上面带 `targeted` 的两份明确绑定目标重读。设备操作均由root执行，本审计只读既有回执/代码并写证据，没有新增设备或环境操作。后续是否继续联网性能验证由root基于现有环境处理；在环境不变时重复整批搜索只会重复准入拒绝，没有必要据此继续测网络性能。
