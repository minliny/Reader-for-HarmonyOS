# 搜索至试读实施记录

本轮执行 READER_REPAIR_SPEC §16；基准 Harmony 99cdeb02、Core 316ed836。当前 Core 官方完整门禁 PASS、Harmony 本地 250 项 PASS；最终 Native、HAP、VM 待完成，不代表已交付或设备验收。

## 当前证据状态

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
