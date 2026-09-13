# 设置面板更新开销修复（2026-09-12）

本轮已完成设置选项的原子代码修改和必要本地回归。13 个选项继续使用原来的 Text 节点与层级，改为通过 ArkUI AttributeModifier 更新属性；选项绑定的回调对象保留，点击仍读取当前 Host 状态。动态宽高、位置、透明度、模糊、选中态、能力限制和无障碍文本均保持实时更新。

## 可证明的结果

- 修复前，真实 SDK 编译出的生产闭包在 120 个连续姿态中，对 13 个选项下发 24,960 次属性调用，16 类属性各 1,560 次。见 legacy-sdk-calls.json。
- 修复后，固定版本官方 ArkUI 差分实现运行生产 Modifier，向原生记录器下发 9,000 次，减少 63.94%。20 个模糊作用节点及既有裁剪关系没有删减、合并或换层；没有用位图替换文字。
- 静态样式拆分后，生产 Modifier 的实际动态调用进一步为 7,440 次（相对原始 24,960 次减少 70.19%）；同一姿态不再产生动态属性调用。字体、字号、圆角、对齐和最大行数由 Text 节点初始化，动态 Modifier 只保留姿态和交互属性。
- 每个姿态均比较真实几何/透明度/模糊/选中/启用值，并验证反向、停住、窄宽/宽屏变化和业务状态切换。官方 5.0 版本仍会重复设置 fontWeight，统计保留了这部分开销。
- SDK 挂载闭包回归、render-work、HttpTTS Gateway 定点回归通过；完整本地门禁最终 **196 组通过，退出码 0**。前两次失败是测试探针没有初始化新增的稳定 `dockRect` 字段，已修正后通过；这不代表 VM 或像素验收。
- `ReaderControlPanel.reportBackdropRegions()` 改为复用两项区域对象，避免每个 runtime frame 新建数组/矩形；背景触摸区域独立回归通过。
- 上述调用削减不是帧耗时提升百分比。实际 VM API 23 的布局/滤镜开销、当前长帧峰值尚无本轮结果。

采用系统现有 API 23 的属性差分，Reader 只保留选项样式与业务绑定。测试使用 Apache-2.0 官方 5.0 固定版本原文件，blob、SHA-256、LICENSE 在 tools/fixtures/openharmony 中；这些测试文件不进入 HAP。SDK 接口与[官方属性修改器说明](https://github.com/openharmony/docs/blob/master/zh-cn/application-dev/ui/arkts-user-defined-extension-attributeModifier.md)均已检查。

## 本轮构建与 VM 定点验证

第一轮停在在线朗读旧合同断言：当前 Core 与 Gateway 已允许 POST，而旧测试仍期望拒绝。仅修正该测试，补充合法 POST 请求体/头透传和非法 PATCH/body 拒绝，没有更改朗读生产逻辑。

第二轮 188 组门禁和隔离编译通过，但发布前检测到共享源码在构建过程中变化；随后当前源码的独立本地门禁为 196 组通过：

```
883809dc4356c2a044247bd044205bc65609ca5742c4daace5c121e2cf074b58
→ 2c75dfff3b69e0c2fca4f4d856f1c89867c5fbadf8b882c7599d0cbfab34d648
```

此前流水线以退出码 1 拒绝发布，这是有效保护。本轮在两个仓库稳定、无未提交改动时重新生成 immutable iteration 候选并通过独立 verify：manifest 为 `.reader-artifacts/hap/20260912T095612Z-9abd21a7-7eab6704/manifest.json`，signed HAP SHA-256 为 `296f6638b646a75f31c03a2c49ed0e20a4415eb28b4a38b0ebcb843bd22fcdf5`，签名状态为 verified/debug。未绕过门禁或选用旧包。

## 设备与交接状态

只读确认现有 Mate 80 Pro VM，实例路径 /Users/minliny/.Huawei/Emulator/deployed/Mate 80 Pro、HDC 127.0.0.1:5555；boot completed=true，SceneBoard PID 2458 两次一致，Emulator 日志有 Guest OS Boot Completed!!。保存的系统日志没有连续生命周期超时/重启标记。第一次 hilog 参数错误也保留并纠正，见 ISSUES.md。

重新发现的 VM HDC 为 `127.0.0.1:5555`；boot completed=true，foundation/SceneBoard 均在运行，Reader 前台能力为 FOREGROUND。pipeline inspect 确认已安装包与候选 appId/identifier 一致，install/launch PASS 且 preserve-data。

已完成两条最小 VM 采样：阅读页中心点击的展开采样在约 160ms 画面出现完整控制栏，约 640–1000ms 稳定；收起采样发现 `uitest uiInput click` 在此 VM 上约 1.4s 才返回，因此 0–1000ms 截图发生在输入命令返回前，不能作为应用收起动效证据。原始布局、截图、probe JSONL 与边界记录见 `vm-20260912/`。该证据只关闭 HAP 交付和局部 VM 运行路径，不关闭 Figma、原生 VSync/滤镜长帧、反向翻页、连续 MOVE 或用户验收。

probe 结束后保留了本任务创建的 stale target lock；owner PID 已退出，但工具明确拒绝接管或删除已有锁，因此没有绕过锁继续操作。真机未使用。构建和本轮采样进程均已退出。

## 真机定点验证（2026-09-12）

使用同一 verified signed HAP 在物理设备上执行保留数据安装和最小路径验证。targetRef 为 `b1f20b88963d`，pipeline inspect/install/launch 均 PASS。

- 书架点击进入正文：输入命令约 3.27 秒返回，约 800ms 采样已进入正文，后续画面稳定。
- 正文中心点击展开控制栏：约 150ms 采样已出现完整控制栏，约 300ms、1000ms 保持稳定。
- 收起控制栏：真机 UI 树确认按钮中心约 `(1120,1698)`；点击命令约 7.1 秒返回。采样期间出现系统来电浮层，控制栏保持可见，因此无法把结果归因于应用；本项保持 OPEN。
- 前两次 probe 因 `Connect server failed` 停止；重新确认目标在线后，使用 8710 server 端点完成成功采样。原始 JSONL、布局和截图见 `physical-20260912/`。

这批真机证据只证明候选可安装、正文路径可运行以及展开局部时序；不关闭收起卡顿、Figma、VSync/滤镜长帧、反向翻页或用户验收。

收到其他任务要求收尾并交接后，未扩大生产修改范围。尝试回复修改清单被自动审批拒绝（缺少跨任务发送授权）；未绕过该拒绝，授权问题已留在当前会话。

## 保留的主线

- C01/C03/C07：本轮只关闭设置选项重复属性下发这一确定的开销来源；Panel、原生布局、20 个模糊节点内部耗时仍需从同一有效候选的 VM trace 分离。历史 57.926ms 不能当成本轮值。
- 原 N08 display fence、F03/N14/N15 故障矩阵、C04/C05 动画期间的数据变更组合、冷页/冷远程章、未知写入结果、高亮/图片/字体/主题像素矩阵、超长章节、连续 MOVE 再抓、GPU/120Hz/温升功耗与 C08 语义项全部继承，不因本轮测试通过而关闭。
- 下步在无系统浮层、输入通道稳定且重新建立合法 target lock 后，用同一候选补做收起采样或 trace；无法以本地属性计数、HDC 命令耗时或单次截图替代运行时 VSync/滤镜测量。

完整前情：[上一批五处残留修复](../2026-09-12-rendering-residual-repair/REPAIR_REPORT.md)、[代码渲染审计](../2026-09-11-code-rendering-audit/CODE_RENDERING_FINDINGS.md)、[原 52 项总账](../2026-09-10-page-turn-physical-b1f20b88963d/CURRENT_ISSUES_AND_REPAIR_PLAN.md)。

## 真机收起重测（2026-09-12）

在无系统浮层、控制栏已展开的前提下复测。收起按钮父容器和文字节点的 UI 树边界已确认；第一次点击返回约 4.62 秒且 0–4000ms 画面哈希完全相同，控制栏保持展开。第二次相邻坐标点击被 `uiInput` 接受并在约 422ms 返回，但设备随后无法提供 UI 树（`Connect server failed`），所以不能证明状态已改变。该项继续 OPEN，代码侧审计重点为 `controlHeader` 的 hit-test/z-index 与 `collapseControl()` 路由。原始证据见 `physical-20260912/retest-20260912/`。

## 控制栏收起命中链路修复（代码侧）

代码审计确认纯视觉 `reader-control-motion-shell` 的 `HitTestMode.Block` 覆盖了 Header/内容层，Header 又处于同级 `zIndex(0)` 的透明命中链路；这解释了真机命令被接受但收起回调未产生状态变化的现象。现已将 shell 设为 `HitTestMode.None`，Header 提升到 `zIndex(2)`/`HitTestMode.Block`，并给收起按钮增加稳定 id 与显式阻塞命中。新增输入路由回归，完整本地门禁由 196 组增至 **197 组，全部通过**。设备证据仍保持 OPEN，需用新产物做一次最小收起验证。

## 修复后候选与真机前置

修复后的 iteration 候选已生成并通过离线 manifest verify：run `20260912T103957Z-50cad401-bacf9041`，signed HAP SHA-256 为 `7b81ead7eb7dcb738097534f2ec2cbcc087023ce7863eae0b70cd054745d281a`。尝试重新发现物理 HDC 目标时，客户端连续收到 `Connect server failed`；由于无法建立当前 exact target，本轮没有 inspect/install/launch，也没有复用旧设备证据。修复后真机验证保持 OPEN，待 HDC 服务恢复后只执行最小收起验证。

## HDC 传输层处理（2026-09-12）

断联已从传输证据定位为共享 HDC session/channel 竞争：8710 server 同时承载 VM TCP 通道、物理 USB 目标和 DevEco Studio 的多个长期客户端，日志出现 `No target channelId` / `BindChannelToSession failed`。这不归因 Reader 代码或 HAP。停止 probe 后执行本机 `hdc kill -r`，再做 5 次目标发现与 10 次只读设备命令，全部通过且无超时；等待 30 秒后再做 5 次目标发现仍全部通过。记录见 `physical-20260912/hdc-stability-20260912T110500Z.json`。

该动作只重启本机 HDC 服务，不卸载应用、不清理数据、不重启设备。由于 DevEco 客户端仍保持共享连接，恢复属于“当前会话稳定”，不是永久隔离；后续物理验证需维持单一 probe owner，断联即先恢复 HDC 再继续取证。页面收起及动效结论仍保持 OPEN。

## VM 重启复验（2026-09-12）

DevEco 重启后从设备管理器启动现有 Mate 80 Pro VM；Emulator 日志出现 `Guest OS Boot Completed!!`，`127.0.0.1:5555` 连续发现为 Connected，SceneBoard 与 Reader 均处于 FOREGROUND。对同一 verified signed HAP 执行 manifest inspect、保数据覆盖安装和启动均 PASS，receipt 为 `.reader-artifacts/hap/20260912T103957Z-50cad401-bacf9041/deploy-vm-6460677a198b-20260912T113048Z.json`。

PTY probe 的首次布局/截图命令受 HDC 断联影响；在本机 HDC 重启后，改用非 PTY 串行 harness，布局和截图回读全部成功。控制栏收起点击约 195ms 返回，约 270ms 截图已隐藏；中心展开的 0/160/640/1000ms 采样全部成功，约 345ms 出现完整控制栏，640ms 后稳定。原始证据位于 `vm-20260912/retest-20260912-collapse/`、`vm-20260912/retest-20260912-expand/` 和 `vm-20260912/retest-20260912-harness2/`。

这关闭了本轮 VM 交付、启动、HDC 当前会话和局部控制栏路径证据；采样触发时间不等同 VSync/原生事件时间，不能据此关闭长帧、连续 MOVE、反向翻页、Figma 或用户验收项。物理设备验证仍 OPEN。

## 全量执行收口（2026-09-12）

前述审计中确认的代码项已全部实现并纳入同一轮 iteration 构建：设置页外边框、选项圆角/边框、快速播放文案宽度、完整朗读页 `0.50x` 速度按钮、速度按钮响应式布局、播放胶囊内容提前揭示、状态栏与控制栏安全区、控制栏收起命中层级，以及非朗读状态的播放区域视觉回退。动效仍由同一共享时间轴驱动，没有新增独立时钟或交叉淡化路径。

当前候选：manifest `.reader-artifacts/hap/20260912T133915Z-50cad401-8508d764/manifest.json`；signed HAP SHA-256 `700fe49b3ee4f2b9921c94ce79d619ff1b0487985da14d964a85dee626e49200`；离线 verify PASS，197 组本地门禁 PASS，`git diff --check` PASS。

本候选尚未完成 VM 安装：精确 HDC 目标重新发现时返回 `the exact HDC target is not connected`，随后 `hdc list targets -v`/只读 shell 持续超时。按验证原则未复用旧回执、未切换目标、未清数据、未重复执行 UI 操作；因此本候选的 VM/真机验收保持 OPEN。已有旧候选的 VM 局部收起/展开证据继续作为历史证据，不能冒充本候选结果。
