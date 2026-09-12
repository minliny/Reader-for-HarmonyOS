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

## 构建未发布的原因

第一轮停在在线朗读旧合同断言：当前 Core 与 Gateway 已允许 POST，而旧测试仍期望拒绝。仅修正该测试，补充合法 POST 请求体/头透传和非法 PATCH/body 拒绝，没有更改朗读生产逻辑。

第二轮 188 组门禁和隔离编译通过，但发布前检测到共享源码在构建过程中变化；随后当前源码的独立本地门禁为 196 组通过：

```
883809dc4356c2a044247bd044205bc65609ca5742c4daace5c121e2cf074b58
→ 2c75dfff3b69e0c2fca4f4d856f1c89867c5fbadf8b882c7599d0cbfab34d648
```

流水线以退出码 1 拒绝发布。这是有效保护：**本轮没有新的 immutable manifest 或可安装候选**，不能把临时编译/签名成功当成正式交付。build-1.log、build-2.log 保留失败与成功步骤；未绕过门禁或选用旧包。没有把源码变化归因给未确认的具体写入者。

## 设备与交接状态

只读确认现有 Mate 80 Pro VM，实例路径 /Users/minliny/.Huawei/Emulator/deployed/Mate 80 Pro、HDC 127.0.0.1:5555；boot completed=true，SceneBoard PID 2458 两次一致，Emulator 日志有 Guest OS Boot Completed!!。保存的系统日志没有连续生命周期超时/重启标记。第一次 hilog 参数错误也保留并纠正，见 ISSUES.md。

本任务未获取 VM 锁，未安装、启动、操作或截图应用；真机未使用。构建已经退出，本轮没有仍运行的构建或测试进程。当前原子修改可以交接，具体文件及哈希见 repair-source.json。

收到其他任务要求收尾并交接后，未扩大生产修改范围。尝试回复修改清单被自动审批拒绝（缺少跨任务发送授权）；未绕过该拒绝，授权问题已留在当前会话。

## 保留的主线

- C01/C03/C07：本轮只关闭设置选项重复属性下发这一确定的开销来源；Panel、原生布局、20 个模糊节点内部耗时仍需从同一有效候选的 VM trace 分离。历史 57.926ms 不能当成本轮值。
- 原 N08 display fence、F03/N14/N15 故障矩阵、C04/C05 动画期间的数据变更组合、冷页/冷远程章、未知写入结果、高亮/图片/字体/主题像素矩阵、超长章节、连续 MOVE 再抓、GPU/120Hz/温升功耗与 C08 语义项全部继承，不因本轮测试通过而关闭。
- 下步先在共享修改协调完成后产生有效签名候选，再进行设置面板同路线的 VM 对比；无法以本地属性计数替代运行时测量。

完整前情：[上一批五处残留修复](../2026-09-12-rendering-residual-repair/REPAIR_REPORT.md)、[代码渲染审计](../2026-09-11-code-rendering-audit/CODE_RENDERING_FINDINGS.md)、[原 52 项总账](../2026-09-10-page-turn-physical-b1f20b88963d/CURRENT_ISSUES_AND_REPAIR_PLAN.md)。
