# Legacy / 遗留问题文档 (Legacy Issues)

Documented known-open issues, deferred decisions, and blocked verification items for
the Reader HarmonyOS surface. Each entry records: 状态、根因、决策、解锁条件。
配套 `PRODUCTION_SURFACE_LEDGER.md` (冻结基线 + 批次日志)。

更新规则: 每条写明日期 + 状态 (OPEN / DEFERRED / BLOCKED / CLOSED)。关闭时在条目末尾注明关闭原因，
不删除历史。

---

## L1 · Figma F1 Shell 未接线 (0 实例) — OPEN/DEFERRED

**状态**: OPEN (2026-08-08 决策 DEFER — 暂不修复, 待本地应用完成后以本地为模板修 Figma)

**问题**: F1 (2026-08-08) 把三个 Figma Shell master 转为 auto-layout, 当时 ledger 声称
"propagates to 23 Final instances"。复核发现此说法**过申**:

- `Shell/MainTabShell` (277:6) / `Shell/ReaderShell` (277:34) / `Shell/SettingsShell` (277:49)
  均为 VERTICAL auto-layout, **但全文件 0 实例** — 没有任何 Final 页引用它们。
- Final 页 master 各自手绘 shell 结构。例: 书架 Phone master (941:3) = 手绘状态栏 (940:4)
  + `AppTopBar/Phone` instance (2236:1502) + 手写内容 Container (940:47) + `BottomNav/Phone`
  instance (2236:1583), 不走 `Shell/MainTabShell`。
- 因此 F1 的 "改共享组件可更新全部生产实例" 门禁**未兑现**。转换发生在孤立 master 上。

**根因**: F1 转换对象是设计系统侧的独立 Shell 组件, 而 Final 生产页是从更早的整页结构一路构建,
从未接线到这些 Shell。F1 未验证实例引用就宣称传播。

**影响**: 仅影响 Figma 文件内部架构卫生。**不影响 HarmonyOS 运行** — 代码侧自有
`MainTabShell`/`SettingsShell`/`ReaderShell` (features/shell/*.ets) 为真正的运行时消费方,
已独立实现且与 Final 视觉对齐。

**决策 (2026-08-08)**: 用户拍板**暂不重接**。先把本地 HarmonyOS 应用开发完毕, 之后
**以本地应用为模板修复 Figma** — 届时按本地真实结构重排 Final 页 + 接线 Shell。

**解锁条件**: 本地应用开发完成 → 以本地为模板, 重接 Final 页 master 到 Shell 实例, 视觉须一像素不变。

---

## L2 · H4 换源 6 态视觉验证 — BLOCKED

**状态**: BLOCKED (2026-08-08)

**问题**: H4 本地组件 (SourceSwitchWindow/CandidateRow/LatencyBar) + 换源状态机 (discovering/
switch/rollback) 已实现, 但 6 态视觉未在真机/模拟器核验。

**根因**: 模拟器书架唯一书为本地书, 换源入口被设计性阻断 (Index.ets:766, local 无远程源);
模拟器 http.execute/source 不可用, 无法导入在线书。

**解锁条件**: 在线书源可用环境 (真机联网 / http.execute 修复) → 开远程书触发换源, 逐态截图。

---

## L3 · 四视口验证未穷尽 — BLOCKED

**状态**: BLOCKED (2026-08-08)

**问题**: V 门禁仅覆盖两个离散宽度: Phone 竖屏 (Pura 90, 1320×2856) + Tablet 横屏
(2560×1600)。Compact Landscape / 中间宽度未验证。

**根因**: 手机模拟器固定竖屏 (无旋转命令), 平板固定横屏 2560; 设备集有限。

**解锁条件**: 多尺寸设备集 → 逐视口截图核对无溢出、安全区正确。

---

## 已关条目

- (无)