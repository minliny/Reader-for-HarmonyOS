# 阅读渲染器职责与实施决定

2026-11-11，源码基线 `14444eac0feb182d38f16ef8ffb40c43cb749434`。

**决定：先执行 B，保留生产 `ReaderShell → ReadingExperience → ReaderControlPanel → ReaderControlRuntime`，按职责抽 seam。本轮 P2 已选择 `REFERENCE_ONLY`，不采用 Stage 接管。未来如重开采用，需另行补齐等价证据。** `ReadingExperience` 是 `LocalReadingExperience.ets:896` 导出的组件，没有独立的 `ReadingExperience.ets`。随后用户明确要求全量实施，现已完成 P1 seam 与 P2 参考分支：生产继续使用同一 Panel/Runtime，旧 Stage 验证页已归档并从冷启动/页面注册入口关闭。

## 当前职责

| 唯一 owner | 保留的职责 | 本次确认的边界 |
| --- | --- | --- |
| ReadingExperience | 阅读身份、会话、正文测量准入、相邻页准备、可见页发布、进度与正常退出 | 已有段落和物理分页 owner；不能通过拆分另造算法或进度 producer |
| ReaderControlPanel | 稳定内容 actor、真实模块 minimum、临时层与播放胶囊接线 | 生产装配在 LocalReadingExperience:2233；25 个 Builder 不一次拆完 |
| ReaderControlRuntime | 生产控制栏命令、手势、时钟、采样、失效 ticket 与 endpoint | 当前生产已有一个控制动效时钟；不能把验证组件存在写成生产双时钟故障 |
| ReaderControlMotionStage | 保留为REFERENCE_ONLY参考输入/帧适配 | 原验证页已归档，cold-start与页面注册入口关闭；不作为生产宿主或交付验收入口 |

[职责与函数清单](reading-renderer-responsibilities-20261111.json)记录精确行号和源码摘要；[19 项行为矩阵](reading-renderer-behavior-matrix-20261111.json)覆盖开关、快捷/完整、展开/收起、手势、临时层、IME、TTS/自动翻页、换源、目录、返回、减少动效、旋转、前后台、卸载、亮度及设置。矩阵不是本轮执行清单；本轮实际选中的局部case及结果另按回执记录，未选项保持NOT_RUN。

## P1 可执行子批次

每批由主代理固定唯一文件修改者；不得覆盖并行 WIP。先核对该批源码身份，退出条件不满足则停在本批。

| 子批次 | 单一风险与改动边界 | 退出条件 |
| --- | --- | --- |
| P1.1 测量事实 | 抽纯 anchor/layout/context DTO；SDK 测量转换留在 UI/platform | application 无 ArkUI 类型或 UI 反向依赖；同一内容/布局身份的 scalar、Native 对象归属及迟到回调准入不变 |
| P1.2 呈现状态 | 抽 retained/playback/selection 呈现类型及稀疏 host 端口 | 纯 display 与带 Native 页/lease 的适配分层；一份语义 session；Back 顺序与局部帧状态不变 |
| P1.3 翻页准备 | 抽 request/result/context lease 与准备协调 seam | application 只接纯请求/身份；Native prepared/context 留 UI 适配；准入、取消、可见页与进度 owner 不变 |
| P1.4 minimum 与面板适配 | 在前两批后分离 provider、测量回执和 shell 渲染适配 | 字体、viewport、module visit 与 lifecycle 仍准入；旧 provider 不能解锁新实例；List/TextInput 保持身份 |

只选择被实际改动触达的 method/SDK case；每批先列入口、嵌套、范围、风险与必要性。退出还要求导入无环、提取对象只有一份定义、原文件相应职责实质下降；行数下降本身不算行为等价。Native 测量、持久化和用户像素分别记账。

## P2 已选参考分支与未来采用条件

Stage 若进入生产，优先改成现有 `ReaderControlRuntime` 的窄适配器。必须先补齐真实 minimum 身份、临时层触摸拦截、ReaderPageInputClock 与速度续程、IME/Back、播放胶囊、open 期输入、减少动效热切换、旋转和卸载的合同；端点、反向、seek、重定向、零时长、中断均需当前证据。同一 actor 只能有一个 clock/gesture owner，切换时退役重复适配。

若这些条件不能关闭，保留原生产 Runtime，Stage 收为明确的参考用途并处理其验证入口；不能把两个完整实现长期维护记成收口。本轮全量收口采用 REFERENCE_ONLY 分支，不进行 Stage 生产接管。参考用途和重开条件见 reading-control-reference-retirement-20261111.json。

## P5 数据与恢复性结论

旧 `2a301653` 的SQLite上限为38，现有47后继快照不能用于正式旧/新内容差分；旧dirty包的Linux输入闭包也未核定。两个Git提交中的三个读取函数片段一致，仅排除这些片段直接改变，不排除历史数据或其他调用变化；本轮没有改Core计数、schema或迁移。

新只读Host取证确认，第1章旧scope的manifest及6个登记文件存在且身份/digest匹配。随后经两次分别明确授权的停启范围取得新停态数据：第一次shell传输超时，应用已恢复；第二次专用传输成功，主库只在SHA完全匹配当前源时复用已验证字节，WAL取自当前源。原pair在复制前后不变，原UNKNOWN只stat/hash且前后一致，未取回/解析内容；应用已恢复书架，额度和租约均结束。

新数据在独立Linuxdebug Core上，两章均missing、无version、无candidate，按条件没有继续调用entry。SQL在Runtime打开前已见head/retention/receipt全0，manifest3、evicted3身份行集合一致；目标事实在bootstrap前后不变。这些当前克隆事实与0/2一致，不能用旧副本cached推导当前应1/2，也不能追溯证明历史0/2的原因。没有证明谁/何时撤销Core记录，也不等同安装中release或当前进程的直接查询。Core准入不满足，漫画冷续读保持NOT_RUN，不通过标题或下载修复绕过。

另一个独立问题已在实际Host/Gateway/DiskCache方法上复现并修复：含Core候选但Host/entry未确认完整的负结果不再长期缓存，普通reload可重验；旧R1负结果也不能越过revision栅栏删掉新R2完整索引。恢复性17组场景及真实旧source回退反例通过，完整漫画、小说和Core明确缺失复用保留。它不被追认为历史VM0/2的已证实成因。

随后又定位并修复可由正常startup触达的预算合同缺口：`SharedDownloadStorageGateway.maintainAutomaticStorage`的capacity维护没有传入写入专用`enough`，旧Disk实现会无压力继续claim普通缓存。新默认谓词只消费既有inventory/buckets/capacity，在公共总缓存预算与系统物理余量均充足时停止新回收，并在每候选后和derived阶段复用停止判断。ordinary预留不重复加original/derived子计数；物理余量计入allReserved。写入自定义谓词继续拥有分区、新增bytes和优先级headroom，pending grant先恢复，expiry/clear、Core候选/LRU与保护栅栏不变；没有新增队列、actor或通用淘汰算法。

该capacity源码SHA256固定为`552915bbf2b141f9b582b37ae3e6bb87fddd52345e4e05ee2edb10282418929f`，本机`.local/framework-closure-implementation-20261111/p5-capacity-eviction-result.json`分别记录旧源码失败、17组行为及2组SDK通过；SDK工具解析失败保留，最后规范HAP语义编译及指定签名已通过，见最终候选记录。正常startup可达旧错误路径，只证明当前源码缺口；未证明它创建既有evicted记录，历史owner/time仍未建立，修复也没有恢复既有evicted数据。

## 实际交付状态

当前补充：最终0511的正式inspect实际FAIL（exit3，target-sqlite-version-unresolved），新包未安装、原VM仍a443。后续新范围只读诊断定位当前lineage日志输入为空，不构成正式准入。新包原生像素仍未执行；19项矩阵保持逐项证据边界。最新结论和可执行退出条件见[全量审计报告](/home/administrator/Reader/Reader-for-HarmonyOS/docs/architecture/reader-delivery-full-audit-20261111.md)与[分批修复方案](/home/administrator/Reader/Reader-for-HarmonyOS/docs/architecture/reader-delivery-remediation-plan-20261111.md)。

P1四个职责seam已抽取；LocalReadingExperience从15131行降至14746行，Panel从2561行降至2479行。六个必要局部case通过，其中两个原case独立叶子重审后经索引通过；未执行的旧case不追认为通过。Stage入口三个索引case、TTS单项和页面navigation索引也通过。

20missing及32deprecated已在成功ArkTS构建中归零，警告374→322；313throws按边界登记，7模块能力及2native提示保留。包含最后capacity修复的最终规范候选`0.2.0.DEV.0511f567914d`已通过编译和指定证书验签，2153应用输入零不匹配，实际警告仍322。代码构建提交为`def50fbc`；后续文档绑定不改变应用输入。最后源码/规范签名身份由工作区`.local/framework-closure-implementation-20261111/candidate.json`及对应不可变HAPmanifest登记。新包未安装，物理机、完整产品回归和用户验收不由这些分项PASS替代。
