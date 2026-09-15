# PH92：网络代理下书源全部不可用

2026-09-15 用户真机反馈。通用代理选路、无PAC兼容、请求编码、取消与搜索链路修复已落地，既有VM已能真实搜索和试读；6cf PH76两个原生样本均PASS。最终状态以[当前修复记录](search-flow-implementation/CURRENT_STATUS_20260915.md)为准。未操作手机，手机代理具体模式不阻塞通用实现，但也不冒称已逐种验收。

## 定位与实施

原先HTTP与ArkWeb均把本地DNS结果直接当成最终公网目标；198.18/15合成地址在发请求前即被拒绝。有效HTTP代理远端解析时，本地DNS失败也会误拦全部源。原定位见[平台审计](PH92-platform-audit.md)、[修复前探针](PH92-proxy-admission-probe.json)。

当前由 `NetworkRoutePolicy.ts` 统一拆分原始URL准入、系统代理选路、DNS和网络路由：

| 场景 | 实施行为 |
|---|---|
| 系统HTTP代理 | 读取有效系统代理，复用平台PAC；按固定OpenHarmony上游语法处理排除。实际走代理时保留原URL/Host/TLS，交给系统代理解析，不先要求本地DNS成功。代理地址/凭据不来自书源。 |
| PAC DIRECT / 排除命中 | HTTP显式不使用HTTP代理，保留VPN路由；ArkWeb使用平台DIRECT配置，等待配置ACK后再加载，确保本地DNS固定实际生效。 |
| VPN或透明网关的合成DNS | 不以“发现任意VPN”为依据。使用系统当前已绑定/默认数据网络，确认其接口有覆盖198.18/15答案且未排除的路由，请求期间固定原合成地址。涵盖VM宿主或路由器代理、设备内无VPN标识的情况。 |
| 普通直连 | 公网DNS验证及请求期固定继续保留，URL字面私网/回环/链路本地/合成地址、DNS真实私网答案仍拒绝。 |
| 网络变更 | 解析/路由准入前后复核选中网络身份；变更、无路由、代理未就绪归可重试环境错误。重试重新选路，不偷偷切网或指定外部DNS。 |
| 代理认证/故障 | HTTP 407及确定的代理连接错误、ArkWeb SDK明确代理错误归环境问题；普通源站TLS、404、正文格式失败保留其分类和候选回退。 |
| 取消与资源释放 | 即使系统destroy不结束请求Promise，HTTP内部deadline也释放DNS锁；取消排队者不越过前序请求。ArkWeb路由配置/清理均等待原生ACK，旧回调不能污染新job。 |

系统网络信任边界是明确的：应用信任用户配置的系统HTTP代理及系统当前选用的数据网络。路由证据证明该网络承接合成地址，**不证明合成映射或代理最终目标的真实性**，也不把198.18/15宣布为普通公网。自定义Fake-IP私网段/IPv6 ULA不自动放行；源规则不能自带跳过准入选项。

复用平台HTTP/DNS/PAC/ArkWeb能力；只移植OpenHarmony代理排除语法薄适配，固定提交 `76e2ca18189c86d46203cca227afe6947292ee30`，Apache-2.0许可证与NOTICE随包保留。没有新增HTTP/DNS/PAC引擎。

## 搜索链路中的错误归属

Host内部语义为 `NETWORK_ERROR`；SDK通过NAPI发送时规范为Rust可接受的 `INTERNAL`，并在 `details.hostErrorCode` 保留原Host码、`details.category=NETWORK_ENVIRONMENT` 保留环境归属，phase为dns/route/transport、retryable=true。SDK总构造plain wire对象，保留Error.message。真实SDK→JSON→Rust HostErrorParams共用fixture验证24种输入，51项SDK测试通过；不能只验证JSON字段存在就宣称协议通过。JS Host桥继续透传结构化证据。

环境故障停止无效候选轮转，不写永久候选失败或把source.check所有源逐个标坏；下载任务仍完成失败收尾，避免长期Running。已有缓存/进度继续保护，不清数据。源码修复还覆盖搜索正文失败后尝试下一可靠候选、前台抢占后台，以及最后一个有效消费者离开后取消旧Core请求；同书仍有有效消费者时保留共享请求。旧缓存必须经过当前正文准入，显式受保护刷新保留续读位置。见[实施进展](minglong-full-assessment/REPORT.md#7-并行修复的实际状态2026-09-15-实施更新)。

## 验证账

当前门禁/源码/Native/签名包身份统一见[当前状态](search-flow-implementation/CURRENT_STATUS_20260915.md)。[6cf原生与搜索](search-flow-implementation/vm-6cf9705d/ONLINE_RUN.md)、[c56真实完整动线](search-flow-implementation/vm-c56ad545/ONLINE_RUN.md)分别绑定各包。c56请求编码异常不再出现，HTTP400/403错误语义准确；原生2300999底层细因仍不能由聚合码推定。URL规范化与跨域Host修复见[PH94](PH94-c56-http-url-audit.md)。

下方是操作前范围与历史失败原件，其“最新/正在/尚未”只属于记录时点，不能覆盖上述后续结果。HTTP/ArkWeb、实际来源、手机/帧率/用户验收分层保留。

原始影响范围见[PH92-scope-audit.md](PH92-scope-audit.md)。WebDAV、在线导入、HTTP朗读与正文图片复用统一HTTP Host；ArkUI封面使用系统自身图像网络，不冒称由同一Host逐项设备验收。

## 本轮 VM 取证范围（操作前记录）

代码侧已经覆盖选路、DNS 固定、取消锁释放、代理配置 ACK、旧 WebView 事件隔离、搜索候选失败回退、正文准入和 SDK→Rust 错误协议。纯本地模拟不能证明系统实际代理配置回调时序、原生 WebView 的资源事件顺序，也不能证明当前网络的合成 DNS 映射实际可访问；本轮仅使用既有 `Mate 80 Pro` VM（targetRef `6460677a198b`），不操作 Offline 手机，不改代理、DNS 或用户数据。

最小验证范围：正式 manifest 保数据更新后，先跑内存夹具 PH76 early/cancel 各一次，要求真实回调与匹配顺序通过；再使用现有书源搜索《鸣龙》，观察搜索结果到详情、目录和首章正文是否能正常读取，以及搜索中的交互是否仍阻塞。每次失败先保留事件与包身份并返回代码审计，不通过重复点击覆盖失败。该范围不证明全部书源或手机代理模式均已验收，也不把运行耗时当成流畅度帧率。

打包中曾发现旧测试夹具未适配网络 API/候选入口，修正后通过；正式 ArkTS 编译又发现 Index 对象展开语法不支持，已用显式字段构造修复（`4cb17d89`），定向回归通过。失败日志保留，失败尝试未产生安装回执。

首个修复包 `20260915T050708Z-4cb17d89-b685b051` 已构建/签名/保数据 VM 安装通过。PH76 early 在 `runToken=1789449118344-1` 失败：真实 start→15ms 后 end，错误为 NETWORK_ERROR，未到任何资源回调。当时停止 cancel 与联网验证并返回代码检查；不能把这次结果计为代理兼容通过。该阶段复核发现 ML05 长认证正文兜底、replaceRegex/V1 输出类型校验及旧前台孤立任务取消遗漏，后续已经补齐并包含于90bc包，不能倒写为4cb已覆盖。

补漏后 `20260915T053510Z-90bcfc78-581499bd` 已完整构建、签名和保数据更新 VM。Core 全量最终 `3856/3856`、210协议、clippy、ABI门禁通过；Native生产冻结于 `90573a0f5`，当前Core `e4cd32851` 比它仅有三个测试数据文件五行更新，生产代码相同。Harmony `faefce1d`/`90bcfc78` 覆盖正文及旧缓存，`b2c68c80` 覆盖孤立前台取消，新增实际方法回归均通过。

`90bcfc78` 新诊断确定 PH76 early 失败点是系统 `getPacUrl` getter 本身抛 Error（无数字码），`phase=route`，`operation=getPacUrl`，真实 start→8ms后end，仍无资源回调，runToken `1789450729782-1`。当时停止 cancel 并返回代码审计，没有把网络故障当书源坏。[本包结果](search-flow-implementation/vm-90bcfc78/ph76-native-results.json)仅直接证明getter失败；后续结合官方API语义确认旧getter在无PAC时会抛错，已由 `af406d49` 改用只读启用PAC配置的 `getPacFileUrl`，保留真实查询失败，不将异常一律伪装成直连。

最新包 **`20260915T054939Z-af406d49-11c64cbe`** 已正式构建、签名并保数据安装/启动于同一VM。HAP SHA-256 `912e6682b8ea83516ca34214568d1b6ecc038c81ad86b18decabd276860487f4`；[manifest](search-flow-implementation/vm-af406d49/manifest.json)、[部署回执](search-flow-implementation/vm-af406d49/deploy-vm-6460677a198b-20260915T055029Z.json)绑定本次产物。

af406 PH76 early `runToken=1789451540764-1` 的[原生日志](search-flow-implementation/vm-af406d49/ph76-native-results.log)确认 `early.css` 资源回调和匹配实际出现，`callbackToMatchMs=6`；`about-blank` 的 `pageEnd` 位于任务 `start` 之前。runner仍输出 **`pass=false / matchedBeforePageEnd=false`**，初始化空白页事件计入判定的问题正在独立代码审计，不能擅改PASS。当前只证明所测内存文档恢复资源回调，**cancel尚未运行、实际HTTP搜索仍在验证**；不证明所有代理场景、真实书源吞吐或UI帧率。
