# 阅读更多“书籍信息”未跳转 · VM 发现记录

- 候选：`20260913T125821Z-2df5cfa6-7c0928b6`；Harmony `2df5cfa6e34b0a7f62570cf9d48f229d5e457f21`，Core `952704bd57518af530a948dfd3408a119c20e276`。签名 HAP SHA256 `a13af1f730f718198f6a82b3f90aea5028f526e8a8430d05446123683150d345`。
- 触发：测试书 `ReaderPagingAudit20260911` 第 150 章第 3/4 页，自动翻页暂停，唤起控制栏，右上更多，点击“书籍信息”。
- 已有操作证据：`reader-control-probe-1789307041779-27bd5f28-37ac-427d-b8ad-bb312339fdc2.jsonl` 中 `2026-09-13T13:53:42.496Z` 点击 `(830,480)`，命令成功。此前布局中该文案范围 `[632,441][843,517]`，坐标正确命中。
- 现象：更多关闭后仍为正文，未进入书籍详情；`13:54:16.989Z` 再次截图仍停留相同正文。该间隔约 34 秒，不归因于 HDC 命令耗时。
- 原始证据：`reader-control-reader-more-open.{json,png}`、`reader-control-reader-book-info.{json,png}`、`reader-control-reader-book-info-settled.png`。布局可包含常驻隐藏控制子树，不把布局仍有文字直接解释为可见像素。
- 当前处理：先审计 `ReaderControlPanel.performMoreAction` → LRE 回调 → `Index.requestReaderBookInfo` → 注册退出闭包 → `requestExit/beginExit/finishExit` → `Index.onReaderExited`。本 agent 只读既有 VM 证据，不进行设备操作。
- 初始未决：点击后究竟被控制栏 Back 消费，还是已开始退出而被保存/清理阻塞；必须用实际生产方法回归区分，再修明确原因。

## 代码结论

根因已在生产方法链复现：`Index.requestReaderBookInfo()` 先保存详情目标身份，然后调用通用 `readingExitRequest()`；LRE 实际注册的是 `requestExit()`，其语义为**系统 Back**，会先由 `backReaderControlHostSession` 消费控制层级并 return。此时根本没有进入 `beginExit()`、`finishExit()`、保存和 `onReaderExited()`。因此等待 34 秒也不会完成详情跳转，不是保存慢、清理 Promise 卡住或 TOC 重新加载。

原有 `test-bookshelf-reading-entry.mjs` 把退出注册成空 stub，确认调用次数后手工调用 `onReaderExited()`，只能验证目标路由，漏过这段真实调用接缝。

## 修复范围

- 注册退出闭包增加可选 `navigation` 意图；不传参数仍进入现有系统 Back 层级处理。
- 仅“书籍信息”传入 `navigation`，由 LRE 直接进入现有 `beginExit()`。不直接修改 route，不跳过翻页结算/撤回、TTS 停止、阅读记录与可见页进度持久化。
- 原有 `finishExit()` 仍唯一交付 `onExit()`；保存失败仍留在阅读，显示“阅读进度尚未保存”，允许继续阅读或重试；重试成功后保留正确详情目标。
- 不改 More 菜单、其他导航动作或退出清理实现；不重取同书目录和正文。

## 本地生产回归

`tools/test-bookshelf-reading-entry.mjs` 新增真实 Panel More 方法 → LRE UI 回调 → Index 请求 → LRE 实际注册闭包 → `beginExit/finishExit` → Index 路由的组合回归。外部异步边界用可控 Promise 分别阻塞；入口包括 Home、自动翻页 Quick、自动翻页 Full，自动翻页状态为 paused。

- 修前 `vm-reader-info-regression-before.log`：原有断言通过，新组合在 `Info must enter durable exit immediately, not be consumed as control Back` 失败，实值 `exitRequested=false`。
- 修后 `vm-reader-info-regression-after.log`：上述三入口通过；分别确认等待 TTS、阅读记录、进度 ACK 时仍在阅读，三者完成后只交付一次详情；同一 session/TOC 实例保持不变，无额外正文获取。
- 同一组合测试确认保存失败不跳转、提示内容正确、继续阅读时恢复记录时钟、重试保存成功后进入详情。
- 新组合同时通过注册闭包不带参数的系统 Back 检查；`vm-reader-info-accessibility.log` 的既有真实系统 Back/临时层/无障碍回归通过，`vm-reader-info-keyboard.log` 的键盘层级与布局回归通过。
- SDK AST 提取/运行生产方法；这些不是原生布局或 VM 修复后证据。完整 ArkTS/签名产物及同包 VM 复验由集成 owner 后续执行。

状态：代码修复及上述本地回归完成；未提交，未访问设备，未改根总账。修复后 VM 行为仍 OPEN。

## 集成复核追加失败：继续阅读后残留目的地

集成 agent 在本次未提交补修上复现：Info → 保存失败 → 继续阅读 → 稍后普通退出，实际进入详情，预期回原书架。原始记录见 `info-cancel-integration-review.md` 和 `/private/tmp/reader-info-cancel-review.log`。这是本地生产链失败，没有新增设备操作。

此前组合测试错误地先调用“继续阅读”，再调用同一旧弹窗的“重试”并期待详情，混淆了两个互斥动作。`bookInfoAfterReaderExit` 仅在成功退出回执清除，“继续阅读”没有通知 Host 撤销目的地；旧弹窗按钮也没有失效保护。此处明确撤回此前“继续阅读/重试生命周期已覆盖完整”的结论。

处理：增加显式退出取消通知；仅“继续阅读/关闭失败弹窗”取消一次性导航目的地。重试不取消，保存成功仍由原 `onReaderExited` 消费。为旧弹窗、后续退出请求和生命周期变化增加失效保护，拆成独立的取消后普通退出、直接重试成功回归。修复结果待后续记录。

追加修复已完成：LRE `onExitCancelled` 由失败弹窗的继续阅读和取消回调触发，Index `cancelReaderExitDestination` 撤销 Info、失败后重试/换源、规则管理、退出详情入口等一次性退出目的地，保留当前书/session/退出注册与阅读来源。重试及成功不发取消通知。`exitAttemptGeneration`、当前 lifecycle、单次决策和 `exitDelivered` 共同拒绝过期弹窗动作；同一个弹窗的成功按钮不能在继续阅读后复活，旧取消不能撤销后续新请求。SDK `component/alert_dialog.d.ts` 中 `AlertDialogParam.cancel` 已核实，用于系统取消/外部关闭的一致收尾。

实际生产链现独立验证：

1. 保存失败后直接重试，保存 ACK 前留阅读，成功进入详情，整个流程没有取消通知。
2. 保存失败后继续阅读，稍后无参普通退出回原书架，取消通知和恢复阅读记录各一次。
3. 保存失败后关闭弹窗，与继续阅读语义一致，稍后普通退出回原书架。
4. 已取消/重试成功的旧弹窗按钮不再执行；新的显式退出已开始时，旧弹窗不能撤销目的地；旧 lifecycle 卸载后不再触发动作。

`vm-reader-info-cancel-before.log` 保存本 agent 新回归修前失败（直接重试成功后，旧 secondary 仍错误恢复阅读记录）；集成 agent 原取消→书架失败继续保留。`vm-reader-info-cancel-after.log` 为修改后整份实际生产链通过。现有原始 before/after 日志未覆写。代码和本地回归完成；完整构建与 VM 复验仍由 root 统一执行。
