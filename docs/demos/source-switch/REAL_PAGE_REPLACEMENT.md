# 换源真实页面替换：根因与纠偏记录

日期：2026-09-30 至 2026-10-01。当前状态：真实页面已替换并安装到 VM，详情和阅读两个原入口均已实测；Core 搜索准入修复已安装。最后一项 DNS 分类修复仅在分支通过定向回归，全量门禁超时，尚未打包/安装。动态刷新完整 VM 验证、正文成功和用户验收保持 OPEN。

## 问题与根因

用户在换源页面设计讨论后要求在本地分支生成 demo，并随后要求安装到当前 VM。此前实现把这一要求错误收窄为单独的模拟展示页：另建页面、虚构书名与来源、定时发出模拟结果，通过专用 debug 冷启动入口直接打开。Reader 原有换源入口仍使用原页面，因此用户从正常应用进入换源时，看不到拟定的新界面。

根因是实现对象和验证入口选错：将模拟页的可编译、可安装和可启动作为了进展重点，没有落实“替换应用内已有换源页面”的实际目标。旧截图只能证明独立模拟页显示，不能证明真实换源入口、真实发现结果或换源事务已经接入新界面。

## 源码与旧产物身份

- 纠偏开始时分支 HEAD：`f625f42c`（VM 安装与独立入口启动记录）。该提交是本轮变更的源码基线，不是旧 HAP 的构建提交。
- 旧 HAP 源码提交：`85bd874af3978fc254b476774a27a16e99c92b4c`。
- 旧 run：`20260930T134349Z-85bd874a-be8b8f52`。
- 旧 signed HAP SHA-256：`f8bc451fb306ad095d0c93b4b9ff580974cd1dbc7c9b61640b45b0382b628559`。
- 旧构建与安装证据：[signed-build-result.json](signed-build-result.json)、[vm-install-result.json](vm-install-result.json)、[vm-demo.jpeg](vm-demo.jpeg)。这些记录保留为历史事实，不升级为真实页面替换后的验证证据。
- 工作分支仍为 `codex/source-switch-demo-20260930`；分支名称不改变当前真实页面替换范围。

## 当前实现目标

保留 Reader 正常启动和实际业务状态，在两个现有入口中共享新的 `SourceSwitchWindow`：

1. 详情/书架上下文中的入口：`Index` → `SourceSwitchPanel` → `SourceSwitchWindow`。
2. 阅读中的入口：`Index` → `ReaderShell` → `SourceSwitchPanel` → `SourceSwitchWindow`。

页面读取真实书名、作者、当前来源及阅读上下文；候选来自已有 `SourceSwitchGateway` 和书籍获取协调器。首次没有候选时显示“正在查找”，结果持续增量发布；查找结束仍为零才进入无结果状态。刷新保留已有候选，使用稳定来源/书籍身份更新和点选，避免重排造成点错。

延迟采用真实搜索请求耗时，当前语义包含调度等待；标识为搜索耗时，不称为正文首段或漫画首图打开时间。候选出现并不证明正文或首图已成功读取。缺少本轮可比较耗时的候选不伪装为零毫秒。

点选沿用实际获取、章节解析、换源提交、首帧确认及失败恢复事务，不新增模拟成功回调，也不绕开原有阅读数据保护。持续搜索过程中允许点选，随后撤销本轮发现所有权，迟到结果不得改变当前选择。

新页面复用搜索页的 `SearchSpinner` 原生加载效果。页面不提供 DEMO 场景按钮，不使用虚构书名、来源或延迟，不设置专用 debug 路由。小说与漫画信息来自实际媒体上下文，不能靠模拟按钮冒充真实漫画业务已经交付。

## 已撤回的独立入口

已移除本分支新增的 `SourceSwitchDemo.ets`、`SourceSwitchDemoFixture.ts` 及其专用入口测试。`EntryAbility.ets`、`ReaderControlVerificationLaunch.ts`、`main_pages.json` 和原入口测试已准确恢复到 `ed0b03c2` 父提交内容。原有 motion/renderer 诊断入口保留，正常启动继续进入 `Index` 并初始化真实业务。

浏览器设计稿可以保留用于回顾动态过程，不能作为应用内替换完成的证明。

## 全页宿主与系统栏接线审计

以下是当前宿主代码的只读结论与实施要求；在完成接线前不记为通过。

- **顶部安全区只消费一次。** `Index` 在非阅读路由的根 Stack 已增加 `appContentTopInset()`；`ReaderShell` 则边到边绘制、不继承该 padding。共享全页组件若无条件再次增加 safe-top，详情入口会产生双重顶部空隙。应统一宿主几何，或显式传入顶部安全区是否已由宿主消费；不要写固定 VM 像素值。
- **移除旧居中弹窗宿主。** 两处入口原来都有居中容器和可点击遮罩。全页换源需要覆盖内容区的实色背景与明确返回行为；旧遮罩点击关闭逻辑不能继续覆盖列表。阅读组件保持挂载，关闭换源恢复同一阅读会话，不重新创建阅读页。
- **系统栏颜色与新页面一致。** `ReaderShell.overlayStatusBarUnderlay()` 原来在换源显示时也以阅读主题重画状态栏，且位于 zIndex 10；这会盖住新应用纸色页面顶部。全页换源时应退出这条阅读主题 underlay，目录自身的既有行为继续保留。
- **临时系统栏所有权需连同策略切换。** 当前 `ReadingExperience.windowChromeActive` 跟随 Shell 可见性，换源仅切到继承阅读主题的 overlay chrome。建议换源显示时令阅读 chrome 暂时不活跃，复用既有 `onWindowChromeActiveChanged()` 路径申请 App chrome 与 App window policy；关闭后恢复阅读所有权。不要永久改写用户的沉浸阅读或隐藏导航栏设置，也不要只改图标明暗而遗漏其下方纸色。
- **底部和横向安全区来自同一快照。** 共享页面应读取 `ReaderWindowCoordinator.metrics()`，消费当前交互底部安全区及左右安全区。观察 metrics revision，适应状态栏恢复、旋转与窗口变化；避免把原居中弹窗的 translate 偏移保留下来。
- **返回和事务边界继续由 Index 管理。** 原 `onBackPress()` 优先处理 `sourceSwitchVisible`，`closeSourceSwitch()` 对正在提交或需回滚的事务已有约束。页面返回按钮继续走此回调，不自行调用独立页面 router 返回或清空真实阅读状态。

## 本轮验证及未决项

撤回独立入口后，以下 6 项定向本地回归通过：`test-reader-control-verification-launch`、`test-reader-optional-entry-memory-launch`、`test-reader-startup-selected-font`、`test-reader-startup-reading-settings`、`test-reader-startup-boundaries`、`test-system-file-open`；相关 diff 空白检查通过。生产 entry、tools、scripts 和 AppScope 已无撤回的专用入口及 fixture 引用。

这些结果只覆盖入口恢复和原启动边界。真实共享 UI、流式候选、搜索耗时排序、点选事务及全页系统栏接线，需要以本轮最终源码继续进行对应定向验证。HAP 构建、VM 覆盖安装、两个真实入口交互、阅读数据保留和用户验收分别保持 OPEN；旧 `85bd874a` 产物及独立页截图不能证明新源码。

## 首轮全量门禁（fd8a78b3）

385 个合同在 90.70 秒内执行，383 通过、2 失败，未进入打包。已定位为本次页面替换后的两处旧结构约束：`test-reader-control-p0` 仍要求 Shell 只有 2 处 reduceMotion 透传，新换源页成为第 3 处；`test-svg-provenance` 检出旧弹窗专用 close 图标已无生产引用。处理方式是更新第三个真实消费方断言、移除无用生产图标与对应配方/清单，不降低资源来源门禁。修复后需重新执行整批合同和正式构建。

## 编译检查（99849860）

修复上述两项后，385 个合同全部通过（92.96 秒）。正式 ArkTS 编译发现 Index 新增的两处候选对象 spread 不符合 `.ets` 的 `arkts-no-spread` 限制（4896、4907），32.31 秒后终止，未发布产物。修复为由既有 Gateway 的 `.ts` 层复制并清空搜索计时，Index 仅消费该结果；不修改原候选对象和其它上下文字段。需重跑定向语义检查、合同及规范打包。

## 真实页面构建与入口验证（7b921b74）

385 个合同全部通过（93.49 秒），正式编译和签名完成（32.879 秒）。产物 run 为 `20260930T151426Z-7b921b74-1c1ed497`，signed HAP SHA-256 为 `426fc4e029bb071cb400d406f7f3494c76c3ba5b54009d6cb7faf2f100bc9b50`；详见 [real-page-build-result.json](real-page-build-result.json)。Harmony 输入 clean；Core 为 `e2a2db0b1f6b2d9a4300c2577eaae4155bddef2f` 的既有 dirty 快照，属于 iteration，不能作为 acceptance。

规范 inspect 确认签名身份匹配，随后覆盖安装及普通启动成功，回执记录保留应用数据。没有使用独立 demo 启动参数。VM 普通搜索“斗破苍穹”→真实结果详情→原有“更换书源”入口，打开新的全页界面并显示 12 个真实候选。该证据只证明真实入口和数据展示接线；尚未证明刷新、选源、进入正文的完整旅程。

## 真实链路故障：Core command was not admitted

- 现象：搜索返回部分真实结果后，详情目录与换源候选更新出现 `Reader-Core command was not admitted`，后续请求持续失败。
- 触发及版本：上述 `7b921b74` manifest-bound HAP 的正常搜索和详情入口；日志从 23:20:14 起连续出现拒绝，23:20:32 详情、23:21:18 候选更新仍失败。
- 已有证据：当前包内 Core build ID 为 `40d7f66d9e8cd24448ceb2accc9e903eda9f37230951353b78155b53cc4fa1d7`。错误原文仅由 NAPI 对 `RC_SEND_BUSY` / `RC_SEND_RESOURCE_EXHAUSTED` 的映射产生，不是 SDK 方法白名单拒绝。原始日志含网络 URL 和头字段，只保留于忽略目录。
- 代码定位：容量管理在 explicitAck 模式发现终端事件超过预留预算时会将 runtime 隔离，之后非控制请求持续 BUSY。`book.search` 发布存储结果之前没有为任意大小终端结果预留预算，存在可由大搜索结果触发的缺口。需通过本地行为回归复现，再修复发布前预算；单纯重试 BUSY 不能修复隔离状态。
- 未决点：VM 旧日志没有记录具体 Core lastError，尚不能把上述缺口等同为该次 VM 的已证根因。修复还需新 Native/HAP 身份链及同一正常入口的最小 VM 验证。完整换源、正文和用户验收保持 OPEN。

## Core 定向修复及本地回归

`book.search` 先组装完整结果、预留结果及 HTTP diagnostics 预算，再发布搜索事实，继续保留原始存储字段和展示归一化的差别。新行为测试覆盖大于 64 KiB 的搜索结果消费与 ack 后仍可准入，以及预算不足时不发布任何搜索书数据。修复前两项均失败；修复后在隔离 target 内运行搜索相关 5 项测试全部通过（15.2 秒）。一次加强断言时漏传 `export_snapshot` 的时间参数导致编译失败，补为 `0` 后重新编译通过，未跳过测试。

SDK 对同步发送拒绝立即读取 Core `lastError`，只附加已审计的固定容量原因，保留原错误对象及 code。没有自动重试、没有重发已受理写入、没有记录请求参数。整份 SDK 测试 40 项通过。相对于恢复用 WIP 快照 `98a0df4a6984b3e35e86566fd1a46fe4845365d5` 的本轮四文件改动保存于 [core-admission-fix.patch](core-admission-fix.patch)，原 Core dirty 输入保持不变。

构建使用 Rust/Cargo 1.97.1。首次红测曾写入主 Core 的 Cargo target 缓存（没有改主 Core 源码）；之后将其 `deps`、`build`、`.fingerprint` 以独立 CoW 副本复制到隔离 Core，绿测和后续 Native 构建均使用隔离 target。缓存不是新的产物证据，正式 Native 必须重新通过构建和源码身份校验。

窄审计确认 `book.toc` 已有发布前预留；`book.detail` 的大返回结果仍有同类预算缺口，本轮尚未复现或修复，作为独立未决记录，不将正常小详情一次成功升级为该边界通过。

## 修复包的有界门禁阻塞

Core Native 重新构建通过（ARM64 release 编译 4 分 07 秒；Host 真 NAPI 检查通过；65 项 SDK 测试通过）。`sync-core` 校验新源码 fingerprint `4c77f6b85e0e3c2e17d1a96f48d8e0ca1763620f213d9acd1a8669e0e8c42f98` 与 NAPI SHA-256 `6b09806856bcae6260cb5bfc3bbe57775134813c7f8f358d9038bd735e8c5707` 后成功。旧版 build ID 不含 dirty 内容，因此相同 build ID 不能替代该 fingerprint/二进制哈希。

Harmony `13e59f1b` 的两轮 gate 均在 120 秒硬上限取消，分别为 264 PASS / 121 cancelled、338 PASS / 47 cancelled，断言失败均为 0；两轮均未打包或发布 HAP。首次耗时突增后已只读检查系统负载，第二次后停止原执行方式。

代码审计找到 `test-reader-book-turn-host-runtime.mjs` 与专门的 `test-reader-book-turn-present-barrier.mjs` 重复编译执行完全相同的 7 个 C++ 源文件、编译选项和 23 场景/754 断言。保留专门测试，删除前者重复执行；motion/render_state 的 1435 项断言定向验证通过。根据 10 物理核、当时仍有空闲 CPU 且 4 worker 持续饱和的证据，把并发上限调整为 6，继续保留 process isolation、全部 385 文件和 120 秒硬上限，不提升为 8/10，也不延长截止时间。低余量内存仍可能影响耗时，不能预先宣称修正后的门禁通过。

## 修复包正常入口验证及查源失败分类

调整后 385 项全部通过，耗时 108.999 秒；ArkTS 编译/签名通过（51.344 秒）。`0acd14d4` run `20260930T155652Z-0acd14d4-6ca438f9` 的 signed HAP SHA-256 为 `8c57da04f6ac8521f357d8c69fbfc316c4d7b10065834bae09629257b77e698f`。预检、保数据覆盖安装和普通启动通过，详见 [real-page-fixed-build-result.json](real-page-fixed-build-result.json)。

同一 VM 正常搜索“斗破苍穹”后打开详情，目录成功显示第一章“陨落的天才”等真实章节，没有再出现此前的准入失败；原“更换书源”入口显示 21 个真实候选。

2026-10-01 00:02:56 发现刷新立即终止并提示域名无法解析，旧候选保留、延迟显示待重测。源码确认原本已处理单源 DNS 隔离，但 `ErrorMessage` 的结构化遍历遗漏了 Core `host_error_with_identity` 实际使用的 `details.cause`：外层只保留 category，phase 在 cause 内，因此 DNS 被误判成整机网络环境失败。现场版本为上述 `0acd14d4` HAP，记录于本地 `fixed-switch-searching.json` 和受限 `fixed-process-log.txt`；待补真实 Core 包装形状的回归及该受信字段的最小修复，不依赖中文文本匹配。

该分类缺口已由真实 SDK `ReaderCoreRequestError` 加 Core `details.cause` 形状在本地复现。修复只增加受信 `cause` 遍历，保持深度 6、有 category 与 phase 的同对象证据，不遍历任意响应体、不匹配中文文案。ErrorMessage 与 Gateway 两项回归先失败再通过，覆盖单源 DNS 后继续全部 12 个来源、全部 DNS、DNS 混合空结果、晚到 DNS，以及代理路由错误仍停止未调度来源。Native 输入未改，需再构建最终 Harmony 包。

此前 `0acd14d4` VM 点选真实“66书吧-起点”候选后进入阅读流程，该源正文返回 HTTP 403；从阅读错误页“切换书源”成功进入同一全页组件。两个真实入口已实测接线，正文成功仍 OPEN，不能把进入阅读路由等同于第一屏正文成功。

DNS 修复后的 `0d2402ce` 门禁再次在 120 秒停止，361 PASS / 24 cancelled / 0 failed，未发布或安装该源码的包。6 worker 不是此机器负载下稳定的时间保证。保留默认 6，增加仅用于显式本次运行的 `READER_HARMONY_TEST_CONCURRENCY`（整数 1–8，打印实际值），本轮选择 8 个执行槽；全部文件、断言、进程隔离和 120 秒截止时间不变。这个调整修正了前面暂不采用 8 的保守选择，仍不保证通过；不停止其它应用或修改 VM 资源来加速。运行器的完整发现、错误传播和超时子进程清理回归通过。

## 本轮最终边界

8 worker 的 `686bc89b` 全量门禁仍在 120 秒截止：355 PASS / 30 cancelled / 0 failed。停止重复该门禁，不延长时限，不跳过未执行检查，不从共享输出挑包。最后 DNS 修复尚无对应新 manifest/HAP，VM 仍为 `0acd14d4` 的上述 signed run；不能把本地修复当作已安装。

- 已安装：真实换源页面、原有两个入口接线、真实候选列表、Core 大搜索结果预算修复；该安装版本有 385 项门禁通过、正式编译和 debug 签名、身份匹配的保数据覆盖安装/启动证据。
- 当前 VM 实景：[real-page-vm.jpeg](real-page-vm.jpeg)，原始 1280×2832 像素，从阅读页原换源入口打开，21 个真实来源。
- 尚未交付：DNS 分类修复（定向回归通过，正式门禁因时限取消）；因此动态查源、延迟更新/排序和停止只记录代码/本地回归，不记录最终 VM 通过。
- 正文：选源后进入阅读路由，测试源 HTTP 403；成功正文首帧、真机和用户验收仍 OPEN。
- 工作仍在 `codex/source-switch-demo-20260930`，没有合并到主工作区。

完整安装身份、HAP 哈希、source dirty 状态、回执和未决边界见 [real-page-vm-result.json](real-page-vm-result.json)。遵循 [reader-harmonyos-hap-pipeline](/Users/minliny/Documents/Reader/.agents/skills/reader-harmonyos-hap-pipeline/SKILL.md) 的规则：“The pipeline output is valid only after an immutable schema v2 `manifest.json` exists.” 最后失败构建没有满足此条件，因此未继续安装。

## 书架旧问题再次出现：空态遗漏共享顶栏与顶部对齐

2026-10-01 用户报告：书架顶部标题模糊且位置偏移，顶部与书架列表之间出现不明空隙。开始审计时分支为 `208de7b8`，本任务最后安装的包为上述 `0acd14d4` run；没有把历史部署回执视为当前 VM 身份的独立核验。

代码与历史审计排除了已修提交被换源分支覆盖：安装源码、当前分支与主工作区 `2a21ed02` 的 `BookshelfPage`、`BookshelfEmptyPage`、`AppTopBar`、`MainTabShell`、窗口安全区和字体输入一致。非空书架的共享文本顶栏与固定背景/分隔线修复仍在；遗漏的是空书架独立路径。

- 标题：`BookshelfEmptyPage.topBar` 仍使用 56×28 物理像素的 `bookshelf_title.png`，显示为 56×28 vp；已有 VM 的 3.5 密度会将其放大为 196×98 像素。`layoutWeight(1)` 将图片容器撑宽，Contain 又将标题居中，造成模糊和右移。
- 空隙：空态 Scroll 没有明确顶部对齐。已有 `real-home.jpeg`、`fixed-home.json`、`real-layout.json` 均属于空书架；Scroll 范围 `[0,339][1280,2496]`，子 Column 范围 `[67,506][1214,2330]`，剩余高度被上下等分，各约 167 px（47.7 vp）。这是短内容居中，不是重复消费 safe-top。
- 修复范围：空书架复用非空页已有 `AppTopBar` 和按钮组件，Scroll 显式顶部对齐；保留书架数据、菜单回调、空态卡片和导航。补实际 SDK Builder 回归以覆盖空态，避免仅非空书架测试通过掩盖遗漏。
- 验证边界：当前根因来自现有截图/布局与源码审计。定向回归、新 HAP 和安装后实际像素核验仍待执行；不据此宣称新包已安装或当前非空书架表现通过。

生产修复后，真实 SDK Builder 回归由 18 PASS / 2 FAIL 转为 20/20 PASS（0.76 秒）：空态确实挂载共享原生文字顶栏，Scroll 显式顶部对齐；非空顶栏、58 vp 高度、20 vp 边距、分隔线及两个 44 vp 搜索/更多按钮的实际回调同时保留。`phone-layout-figma-regressions`、`app-shell-safe-geometry`、`bookshelf-more-layout`、`reader-font-demand`、`reader-typography-architecture` 五项通过，diff 空白检查通过。没有修改公共 Builder probe，也没有模拟原生几何来声称像素通过。

本次最小 VM 取证只回答代码无法单独证明的原生字体像素、标题最终坐标及空态 Scroll 实际布局。现有 Mate 80 Pro 实例只读预检：唯一 HDC target、guest boot completed、Emulator 的 Guest OS Boot Completed 日志、SceneBoard PID 1450/start tick 1022 均成立，当前 2000 行日志未发现已知启动循环风险。保持现有实例和数据，构建后按同一签名覆盖安装。
