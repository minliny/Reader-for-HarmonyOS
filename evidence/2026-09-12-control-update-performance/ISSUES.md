# 控制栏重复属性更新修复

## CU-01 设置选项的每帧重复属性下发

- 现象：用户报告控制栏展开/收起中段卡顿、停留。历史 a11ccc84 Settings expand UI VSync 57.926ms，Settings 更新 28.515ms；这些不是当前版本的耗时。
- 触发：设置面板共享进度变化；13 个选项 Text 的同一更新闭包同时读取进度、宽度、设置快照，并重复设置字体、颜色、圆角、事件等未变化属性。
- 源码身份：本目录 baseline.json；共享 dirty 树，不回退其他任务修改。
- 代码结论：真实 SDK 编译闭包可证明重复下发；不能由调用次数直接推出原生布局/滤镜耗时。
- 修复：复用 ArkUI AttributeModifier 的原生属性差分，保留 Text 节点、真实尺寸重排、原模糊/透明度和裁剪层级。仅新增 Reader 的选项样式适配，不自研通用属性缓存或渲染引擎。
- 上游：已安装 SDK API 23 提供接口；OpenHarmony arkui_ace_engine 5.0.0 Release 官方实现（Apache-2.0，blob db887af84f29a4b7a4b26e6e25e80af753eaa344）确认 ModifierWithKey.applyStage 的标量/对象差分。实际 VM API 23 效果仍须单独测量。
- 本地回归：已完成；真实 SDK 挂载闭包、反向/停住/宽度/能力/业务切换和稳定回调均通过，完整门禁 196 组通过。
- VM：已使用本轮 immutable signed HAP 安装并启动，数据保留。中心点击展开采样在约 160ms 已出现面板，约 640–1000ms 稳定；这证明 VM 路径可运行，不等同于 Figma/用户验收。
- VM 收起尚未形成有效动效时序：`uitest uiInput click` 在该目标上命令返回约 1.4s，0–1000ms 截图均发生在命令返回前；原始证据及边界记录见 `vm-20260912/`。
- 真机：不使用；此前释放状态保持。

## 仍需追踪

- CU-02：Panel 更新、原生布局、20 个运行时模糊作用节点的各自耗时，尚未证明仅靠 CU-01 可消除长帧。
- 继承 2026-09-12-rendering-residual-repair、2026-09-11-code-rendering-audit 与原 52 项总账的未决点；不以本批次替换或清空。

## CU-03 日志查询参数错误（已代码侧修正）

- 首次就绪检查使用 hilog -x -t 150；该工具的 -t 表示日志类型，返回 Invalid log type，不能作为稳定性证据。
- 改用 hilog -x，保存 vm-system-log.txt：6283 行、822891 字节，未出现 LIFECYCLE_TIMEOUT / SceneBoard exits 4times / kernel panic / guest reset。
- VM boot completed=true；本轮 pipeline inspect/install/launch 均通过，Reader 前台能力保持 FOREGROUND。原生布局/滤镜各自耗时仍未从 VM trace 分离。

## CU-04 全量门禁中的在线朗读旧断言（已定位）

- build-1.log：test-reader-http-tts-gateway.mjs:58 期望 POST 被拒绝，但返回成功；隔离编译未开始、未产包。
- 当前 ReaderHttpTtsGateway.ts 的描述符已允许 GET/POST；Core http_tts_profile.rs 的 speech-json、Azure SSML 分支明确生成 POST，并有请求体测试。旧断言与现行接口冲突。
- 修正旧测试：增加合法 POST 请求体/头透传，使用 PATCH 检查非法方法，并保留非法 body 拒绝；没有更改正在扩展的朗读生产逻辑，不声明 Host 传输/播放已验收。

## 本地结果

- 真实 SDK 已挂载闭包：反向、宽度、业务选中、能力禁用、开关和保留回调回归 PASS。
- 官方固定版本差分 + 生产 Modifier：13 节点，120 个姿态，原生属性调用 24960 → 9000（63.94%）；逐项比较真实几何、模糊、透明度、选中态。5.0 fontWeight 对象仍会重复下发，停住时不宣称零调用。
- 这些结果不换算为 VM 帧耗时，也不证明 CU-02 已关闭。

## CU-06 背景触摸区域每帧分配（已代码侧修正）

- `ReaderControlPanel.reportBackdropRegions()` 原先每次姿态新建区域数组和顶部矩形；动效期间该路径随 runtime frame 重复执行。
- 现在复用稳定的两项区域数组和矩形对象，只更新坐标/尺寸/ready；Host 仍接收同样的两个排除区域，隐藏和布局未改变。
- `test-reader-control-backdrop-publication.mjs` 验证连续姿态保持数组/矩形身份、坐标实时更新和 ready 状态。

## CU-05 构建中共享源码发生变化（未发布候选）

- build-2.log：188 组合同通过，ArkTS/Native 和签名步骤完成；发布前 source fingerprint 883809dc… 变成 2c75dfff…，流水线退出 1。
- 本轮没有新的 manifest，不准选择临时 HAP。构建已退出，没有持续占用构建锁或 VM。
- 当前原子改动回归已完成，等待共享源码交接协调后的统一构建；不归因给未确认的写入者，不回滚或覆盖其他修改。
- 之后的完整本地门禁（含本轮新增测试）最终为 196 组通过、退出码 0；该结果仍只属于代码/本地证据层。
- 后续稳定构建已完成并发布 immutable iteration manifest（见 CU-07）；本条“未发布候选”仅保留此前失败记录，不再阻塞本轮候选。

## CU-07 本轮 immutable HAP 与 VM 定点验证

- manifest：`.reader-artifacts/hap/20260912T095612Z-9abd21a7-7eab6704/manifest.json`；signed HAP SHA-256：`296f6638b646a75f31c03a2c49ed0e20a4415eb28b4a38b0ebcb843bd22fcdf5`。
- pipeline verify、inspect、install、launch 均 PASS；部署 receipt 标记 `dataPolicy=preserve`，VM targetRef 为 `6460677a198b`。
- 展开：中心点击后的受限 probe 采样记录了约 160ms 出现完整控制栏、约 1000ms 稳定；截图触发时间不是 VSync/native 事件时间。
- 收起：第一次点击发生在面板出现前，第二次采样命令本身延迟约 1.4s，采样点未覆盖命令完成后的应用状态；不能据此声称收起流畅或卡顿已关闭。
- probe 结束后留下本任务自己的 stale lock（owner PID 已退出）；工具设计拒绝接管任何已有锁，因此未删除/强行接管，也未继续扩大设备操作。证据目录为 `vm-20260912/`。

## CU-08 真机控制栏定点验证（展开局部通过，收起保持未决）

- 目标：targetRef `b1f20b88963d`；使用本轮 verified signed HAP，pipeline inspect/install/launch PASS，数据保留。
- 传输：前两次 probe 在首次截图前返回 `Connect server failed`，工具按规则停止；重新确认设备在线并使用已验证的 8710 server 端点后，截图与点击采样成功。
- 书架→正文：点击命令约 3.27 秒返回，约 800ms 已进入正文，后续画面稳定。
- 展开：正文中心点击后约 150ms 采样已出现完整控制栏，约 300ms、1000ms 稳定；截图触发时间不是精确 VSync 帧。
- 收起：UI 树确认按钮中心约 `(1120,1698)`，点击命令约 7.1 秒返回；采样期间出现系统来电浮层，控制栏保持可见，无法区分系统浮层/输入服务延迟与应用收起逻辑，因此不关闭 CU-02。
- 证据目录：`physical-20260912/`。真机收起需要在无系统浮层且输入通道稳定时补测；不以本次污染采样声称修复或回归。

## CU-09 真机收起重测（2026-09-12，仍未闭环）

- 前提：沿用同一 verified signed HAP；正文已在无系统浮层状态，UI 树确认收起父容器 `[1050,1653]-[1190,1744]`、文字节点 `[1085,1674]-[1155,1723]`，透明度为 1。
- 第一次无浮层采样的收起点击（中心约 `(1120,1698)`）命令返回约 4.62 秒，0/800/1500/2500/4000ms 截图哈希完全相同，控制栏仍展开；这已排除“仅因截图早于命令返回”的解释。
- 第二次相邻坐标点击 `(1120,1705)` 被设备端 `uiInput` 接受，约 422ms 返回 `No Error`。随后设备 HDC 回读通道返回 `Connect server failed`，未能取得点击后的 UI 树，因此不能把该次命令成功等同于收起成功。
- 当前结论：收起路径仍 OPEN；已定位到“设备输入命令接受”和“应用收起状态变化”之间存在未证实断点。代码侧下一步应审计 header 的命中层级与 `collapseControl()` 事件路由；不得以 HDC 命令耗时或连接中断宣称修复。
- 证据：`physical-20260912/retest-20260912/`；本次未清数据、未卸载、未切换目标。

## CU-10 控制栏收起命中链路（代码侧已修复）

- 定位：`reader-control-motion-shell` 是纯视觉层，却使用 `HitTestMode.Block` 覆盖整个控制栏；Header 同级仍为 `zIndex(0)`/`Transparent`。物理 UI 树确认该 shell 的 bounds 覆盖收起按钮区域，形成点击路由竞争。
- 修复：视觉 shell 改为 `HitTestMode.None`；Header 提升为 `zIndex(2)` 并使用 `HitTestMode.Block`；收起 Stack 增加稳定 id `reader-control-collapse` 和显式 `HitTestMode.Block`。
- 代码回归：新增 `test-reader-control-input-routing.mjs`，验证命中层级、显式收起 target、Runtime quick 目标和单次命令提交；完整本地门禁 **197 组通过，退出码 0**。
- 边界：本修复已在代码/本地层闭合，但尚未以新 HAP 在 VM/真机确认原生命中；原真机收起 OPEN 证据仍保留，下一次设备验证只回答“点击是否进入收起状态及动效是否正常”。

## CU-11 修复后真机复验前置（2026-09-12，HDC 阻塞）

- 修复后候选：manifest `.reader-artifacts/hap/20260912T103957Z-50cad401-bacf9041/manifest.json`，signed HAP SHA-256 `7b81ead7eb7dcb738097534f2ec2cbcc087023ce7863eae0b70cd054745d281a`，签名/Profile verified debug；构建、197 组合同、本地类型检查和离线 verify 均 PASS。
- 设备前置：本轮多次重新发现 HDC 均返回 `Connect server failed`；本地 8710 监听存在但服务无响应，无法获得当前精确 target，也未执行 inspect/install/launch。
- 结论：修复后真机证据仍 OPEN；没有复用上一轮 target、安装回执或截图。阻塞属于设备传输层，尚不能归因应用或 HAP。

## CU-12 HDC 断联（2026-09-12，传输层已定位并暂时恢复）

- 现象：本地 8710 HDC 监听存在，但连续命令间歇返回 `Connect server failed`；日志累计出现 `No target channelId` 和 `BindChannelToSession failed`。重启前后 `lsof` 显示 DevEco Studio 的多个长期客户端连接与 VM TCP 通道共用同一 HDC server。
- 代码/环境审计结论：故障发生在 HDC server 的 session/channel 管理和客户端竞争，未发现 Reader 源码、HAP 签名、设备数据或应用进程是断联根因。将 HDC 切到 8711 的隔离 server 不能直接接管 USB 目标，目标仍由 8710 所属 server 持有，因此不能靠第二端口绕过。
- 修复动作：停止当前 probe 后执行本机 `hdc kill -r`，不卸载、不清数据、不重启设备；随后用同一 targetRef 连续执行 5 次目标发现和 10 次只读 shell/窗口/任务查询。
- 结果：重启后即时 5/5 `list targets -v`、10/10 只读命令通过，均无超时；等待 30 秒后再次 5/5 目标发现通过。稳定性记录见 `physical-20260912/hdc-stability-20260912T110500Z.json`。这是 HDC 传输恢复证据，不是页面交互通过证据。
- 遗留：DevEco 客户端仍保持共享连接，故障有复发风险。后续物理验证必须使用单一 probe owner；若再次出现同类错误，先停止 probe、重启本机 HDC 并重做连续性检查，不能重试页面操作或把命令成功当作 UI 状态成功。

## CU-13 VM 重启与 HDC/Probe 通道（2026-09-12，VM 复验完成）

- 触发：DevEco 重启后 VM 停止。直接启动时先出现一次实例路径参数错误、一次非法 HDC 端口参数（Emulator 要求 10000–16555），均未改动 userdata；随后从 DevEco 设备管理器启动现有 Mate 80 Pro 实例。
- 启动证据：Emulator 日志记录 `Guest OS Boot Completed!!`；HDC 精确目标 `127.0.0.1:5555` 连续 5 次为 Connected；`aa dump -a` 显示 Reader 与 SceneBoard 均 FOREGROUND；manifest inspect PASS，覆盖安装/启动 PASS，receipt 为 `.reader-artifacts/hap/20260912T103957Z-50cad401-bacf9041/deploy-vm-6460677a198b-20260912T113048Z.json`。
- HDC 细节：PTY 中 probe 的首条 `dumpLayout/screenCap` 会间歇返回 `Connect server failed`；同一 HDC 参数在非 PTY Node 管道中成功。后续改用非 PTY 串行 harness，避免终端会话干扰，并保留失败 JSONL 与成功 JSONL。
- 页面结果：收起点击 `(1120,1761)` 返回约 195ms，约 270ms 截图已隐藏控制栏；随后中心点击展开采样的 0/160/640/1000ms 四帧均成功，约 345ms 已出现控制栏，640ms 后画面哈希稳定。截图/布局与 probe JSONL 见 `physical-20260912` 同级的 `vm-20260912/retest-20260912-collapse`、`retest-20260912-expand`、`retest-20260912-harness2`。
- 结论：本轮 VM 的安装、启动、HDC 稳定传输和控制栏收起/展开路径均获得可复现证据；采样时间是 HDC 命令触发时间，不等同 VSync/原生事件时间，因此不能关闭原生长帧、连续 MOVE、反向翻页、Figma 和用户验收缺口。物理设备验证仍保持 OPEN。

## 新增自动翻页与书架问题（2026-09-12）

本批 N01–N11 已完成当前代码、Figma 原稿及既有 Make 覆盖范围审计，详见 [新增问题总账与修复提案](../2026-09-12-new-ui-audit/ISSUES.md)。包含速度溢出/快捷播放框遗漏、移除返回的新要求、速度操作差异、批量继承模式、四行信息/真实来源、行高与动效耦合、路由状态与默认分组硬编码、单书菜单规格冲突、筛选图标原稿确认。此次仅审计，生产修复、回归、产物、VM、真机与用户验收均未关闭；不以之前197项检查或旧包结果覆盖本批要求。

新增 N12（2026-09-12）：从阅读页返回书架时列表模式恢复为封面模式。代码定位为 `BookshelfPage.viewMode` 仅是页面本地 State，路由重建时默认 `cover`；已在 `BookshelfPage.ets` 接入 `readerBookshelfViewMode` StorageLink，进入页面先恢复模式并再生成投影，模式切换先提交存储后运行可逆动效。书架专项本地回归待执行；VM/真机不属于当前定位前置。
