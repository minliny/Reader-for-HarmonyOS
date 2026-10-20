# 书源原操作恢复的真实页面闭环

基于中央 `664eb005` 的既有冷回执 owner，不新增业务队列、store 或通用 executor。当前应用正常布局、筛选、列表、开关、检测和入口均保留；故障态复用已有 `ReaderRecoveryNotice` / `ReaderRecoveryAction` 有限规格。待全量执行完成后再做视觉细调。

## 所有权和调用链

`Core rules.mutation.apply/query → RulesMutationOwner/Atomic 原完整意图 → SourceGateway → 原 SourceOrchestrator / SourceToolsOrchestrator → SourceHost / Index 的实际字段 initializer → 实际 Builder 参数 → 全装饰 SourceManagementPage / SourceToolsPage → 公共恢复组件 native callback`。

- `Index.sourceManagementSurface` 的明确继续捕获原 Runtime、mount、navigation、SourceHost 和 presentationIdentity；原 `onReconcile` 继续只读。
- `Index.sourceToolsSurface` 也捕获原 presentationIdentity。`isCurrentSourceToolsPresentation` 现在分别核 base scope 与真正已附着的 leaf lease。
- Tools 增加只读 `isPresentationCurrent(identity)`，查询原 owner/runtime/lease；原 tail、dispatch、intent、草稿及确认事实不变。其 factory 的 `current` 谓词只用 base scope，避免递归准入；已有相同 binding getter 不再附着，旧 alive Index 不能抢回 successor lease。
- SourceHost 的既有同步 attach 修正由原 owner 提供。本消费测试实际执行 Index initializer，证明新 Index 在 attach 内第一次 DTO 就能收到尚未完成或尚未确认的原操作，不依赖随后 open/read 完成掩盖漏投影。

## 故障效果和动作

1. 原写未确认：显示原 operation message，“核对原操作回执”只 query；仅原 owner 明确 `canRetryOriginal` 时显示“继续原操作”，保留同 ID/sequence/完整 DTO。
2. Core 已确认、登录会话清理未完成：仍 confirmed，显示清理未完成；“继续原清理”只完成原 Host 清理，零 Core 重写。普通核对不会清理 Cookie，也不会把 unknown/current-list 匹配变成 ACK。
3. 外域规则/订阅 intent：页面可显示原阻断事实并纯核对，不显示可以代跑外域的 Source 继续动作。
4. 新原操作 generation、阶段或 mounted identity 改变时，只重建恢复小 actor；旧物理回调保留原词法 identity。V1 Prop 更新、A→B 同 Runtime/同 navigation 重开、旧解除订阅均不得借新 state 继续。
5. 原书源列表仍可用。未知写阻断新的相关 mutation；检测和非写页面能力依原 owner 合同保留，未开放隐藏入口。

## 验证

`test-source-cold-index-consumers.mjs` 使用实际 AtomicFile 文件 IO/SHA、实际 Core capability 读取、每 RPC 新 CLI 进程和同 SQLite、完整原域类以及安装 SDK emit。编译完整 decorated Page，执行实际恢复子树和公共 native actions；辅助控件采用其真实源码元数据。布局、虚拟列表原生绘制、焦点与目标表现不在 Node 探针内冒称完成。

14 组覆盖 before/after ACK loss、同原 ID 明确继续、confirmed cleanup、纯 query、双击、旧 recovery generation / retained Prop、navigation/mount/route/runtime/unmount、旧 alive Index 与 getter、同 Runtime accepted 未 settle 的第一 DTO、Tools successor first DTO /旧 detach、foreign 原意图；移除 Tools attachment guard 的真实反例证明仅 Runtime/nav/mount/host 相同会允许旧物理动作借新 lease。实际原生删除确认也核原 Tools attachment，旧 A 确认不得借 B lease，当前 B 可正常删除。

原 SourceCold 5、SourceExact 10、SourceTools actual SDK 4 及 Source/Settings 和 Tools 的旧完整矩阵继续运行，未缩减旧断言。100 条既有样式预算保持不变。全应用 ArkTS/HAP、设备、视觉和用户验收由整合出口分层核定。
