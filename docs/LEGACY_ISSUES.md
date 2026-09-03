# Legacy / 遗留问题文档 (Legacy Issues)

> **已冻结，不再是当前遗留问题清单。** 本文保留 2026-08 时点的决策和阻塞证据，现有
> `OPEN / DEFERRED / BLOCKED` 不代表当前任务状态，也禁止继续追加条目。唯一待开发清单见
> [`../../DEVELOPMENT_BACKLOG.md`](../../DEVELOPMENT_BACKLOG.md)；旧条目如需继续，必须先按当前源码复核后迁入该文件。

Historically documented open issues, deferred decisions, and blocked verification items for
the Reader HarmonyOS surface. Each entry records its original 状态、根因、决策、解锁条件。
配套 `PRODUCTION_SURFACE_LEDGER.md` (冻结基线 + 批次日志)。

冻结规则：不再更新状态，不删除历史；当前变化只写入唯一待开发清单。

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

## L4 · 目录复用与全局布局/排版体系剩余优化 — PARTIAL / DEFERRED

**状态**: DEFERRED (2026-08-23 决策 DEFER — 先补全当前缺陷并保证基础功能可用)

**延期内容**:

- 将完整目录与快捷目录迁移为共享的 `ComponentV2 + @Param` 行/列表组件。
- 在完整绑定、固定行骨架和实机行为矩阵完成后，重新评估并开启
  `Repeat.virtualScroll({ reusable: true })`。
- 建立跨 Page/Panel/Dialog 的全局响应式布局上下文或统一宽度框架。
- 将剩余页面的散落文字声明逐步迁移到已建立的 Typography 语义角色，并同步绑定
  后续确认的 Figma text style/variable；不做一次性全仓替换。
- 建立 100/1000/5000 章的目录首屏、滚动帧率、峰值内存和 GC 性能基准。

**本次约束**:

- 目录继续保留 `virtualScroll`，但统一 `reusable:false` 并修正完整 `RepeatItem` 绑定。
- 宽度问题只在已确认风险的布局所有者中按真实 viewport 动态收缩，不做全局框架迁移。
- 搜索输入统一由 `ReaderSearchField` 管理行为语义；书籍搜索、书源、目录/书签、
  阅读正文搜索和 RSS 使用独立 typed variant，不强制共享字号或外层工作流按钮。
- 不修改 Core 目录事实、数据库排序或持久化协议。

**已落地基础**:

- `ReaderFontFamilies.ts` 隔离物理字体名，`ReaderTypography.ets` 定义 family/weight/size/
  AUTO line-height/letter-spacing/scale-policy/source 的完整角色契约。
- 首页标题、二级页标题、分节标题、主 Tab、Select 变体和阅读章标题已接入语义角色；
  `ReaderSelect` / `ReaderSelectPanel` 已由互相冲突的多个布尔参数收敛为单一 variant。
- 五个搜索入口已接入共享字段；目录/书签保持同一 10fp 搜索角色，行高恢复为 ArkUI AUTO，
  不再使用页面内 `10/12` 硬绑定。
- 阅读正文仍由 Appearance snapshot 动态驱动；字号等四项指标增加显式可用边界，Ability
  配置变化会刷新 system font scale 并推进分页签名重算。

**解锁条件**: 当前目录排序/书签/Figma/横向越界缺陷关闭，基础阅读链路可用，定向契约、
非增量 HAP 构建和 signed HAP 实机验收均完成；之后作为独立架构任务重新评估投入与收益。

---

## 已关条目

- (无)
