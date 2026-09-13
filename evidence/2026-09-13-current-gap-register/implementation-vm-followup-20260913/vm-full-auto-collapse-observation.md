# VM FullAuto 收起按钮无响应（2026-09-13）

- 现象：完整自动翻页页停止播放后，点击标题右侧“收起”，面板仍为 FullAuto；之后系统 Back 一次成功退回 QuickAuto。
- 版本：root 记录本轮安装包为 `a91af09f`；截图前缀 `reader-control-b17f29a4-20260913-`。此文件记录现有证据，不据此前缀猜测源码身份；最终产物身份以 root 部署回执为准。
- 触发：`auto-full-149` / `home-after-auto` 所示 FullAuto → 停止自动翻页 → 点击 `(1118, 510)` → `auto-collapsed` 仍 FullAuto。
- 已有证据：同目录上述前缀的 PNG/JSON，以及 `reader-control-probe-1789311106320-01fc958a-a378-43c2-8788-ced530e5a834.jsonl`。点击开始 `2026-09-13T15:01:08.521Z`，命令成功；`reader-control-collapse` 边界 `[1046,465][1186,556]`，点击在按钮内部，布局显示 enabled/clickable/visible 均为 true。`back-from-full` PNG/JSON 记录系统 Back 能够收起。
- 初步排除：不是坐标偏离可见按钮；Full→Quick 的系统 Back 通路有效。命令成功仅说明输入命令已送达，不能证明组件 onClick 执行。
- 代码审计范围：Header 原生命中层、子节点与祖先触摸策略、覆盖层、SDK 编译后的点击闭包、Panel 语义命令与本地 Runtime 同步链。
- 定位结论：生产 `ReaderControlPanel.build` 的 Header 父 Stack 被设置为 `HitTestMode.Block`。当前安装 SDK 的 `ets/component/enums.d.ts:8257` 起明确该模式会阻断子节点；OpenHarmony `FrameNode::TouchTest` 在遍历 children 前检查 Block 并直接退出遍历。VM JSON 中此祖先为 `ROOT37,0,0,0,0,0,2,0,1,3`、bounds `[92,455][1190,560]`、zIndex 2、enabled true、Block。它没有点击动作，却禁止内部收起按钮进入触摸收集。因此子按钮的 clickable 标记不等于可被触摸命中，系统 Back 可用也不能覆盖按钮路径。
- 参考：[OpenHarmony 触摸策略枚举](https://github.com/openharmony/docs/blob/master/zh-cn/application-dev/reference/apis-arkui/arkui-ts/ts-appendix-enums.md#hittestmode9)、[FrameNode TouchTest](https://github.com/openharmony/arkui_ace_engine/blob/master/frameworks/core/components_ng/base/frame_node.cpp)；本次以已安装 SDK 枚举定义及已捕获 VM 原生树互相印证，未以线上 master 版本冒充 VM 固件源码。
- 排除结果：已有布局中按钮路径全部祖先均 enabled true；Header 以上没有其他 Block 祖先。点击处只有正文、惰性页面槽、无命中 Canvas/XComponent、控制 Header 与无命中辅助 Row，不存在启动胶囊或 More 菜单覆盖此点。Button 回调和 Full→Quick 状态链通过下述真实生产方法检查。

## 最小修复及本地证据

- `ReaderControlPanel.ets` 仅将 Header 父层改为 `HitTestMode.Default`，保留 zIndex 2；Default 允许子节点参与命中，同时遮挡较低兄弟。收起动作自己的叶子 Stack 继续为 Block，文字子节点不需要事件。保留 Figma 40×26、圆角 8、字体、位置、原有透明度与动效时长；不修改播放器、计时器或状态机。
- 现有 `test-reader-control-input-routing.mjs` 取消错误的“Header 必须 Block”字符串约束。新增探针提取生产 Header 外层原文，用现有 SDK Builder probe 编译父层和真实子 Builder，检查编译结果的实际属性，再执行 SDK 生成的真实 onClick → `collapseControl` → `applySemanticSession` → Runtime → `acceptRuntime` → Link watcher/endpoint。
- 红灯：`full-collapse-sdk-before.log`，旧生产码明确失败 `autoPage: production Header ancestor must admit its child button; Block suppresses descendants`（actual Block / expected Default）。
- 绿灯：`full-collapse-sdk-after.log`，7 个模块 × 正常/减弱动效覆盖已稳定 Full 的点击、一次业务动作、保持当前模块、收敛 Quick、同一 Header 节点更新、失能和拖拽期间禁用；实际收起按钮仍 40×26/圆角8。另保留旧的动画途中回退 production method 用例。
- 相关检查：Header Figma 几何/挂载闭包、辅助功能及系统 Back、Runtime、Session、Gesture Driver 共 5 组均通过，记录于 `full-collapse-related-checks.json`。本项总计 6 个本地检查文件；未重新构建或访问 HDC。
- 探针准备阶段修正了两处测试适配问题：Replace 几何的无后缀 import 沿用该模块现有 registerHooks；收起进行中应断言 target 为 Quick、结算后断言 location 为 Quick。它们不是新的生产缺陷。最终红绿日志对应的是 Header 父层缺陷。

## 验收边界

- 代码根因已定位，本地失败→修复回归完成；本地探针不模拟原生触摸收集/合成器，所以不声称 VM 已修复或流畅度通过。
- root 后续在 manifest 绑定新包保数据安装后，沿 FullAuto（停止/暂停）→点击“收起”确认 QuickAuto，比较真实按钮边界、一次动作和系统 Back 逐层行为；其他模块共享同一个 Header 修复，不改用户产品定义。
- 仍开放：修复包的统一构建/签名/VM 行为及用户验收，由 root 独占设备完成。
