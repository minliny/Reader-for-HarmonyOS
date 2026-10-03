# 原书架删除与资源清理回执闭环

基线为当前应用效果；本切片保留删除确认 Dialog、原操作顺序、书架正常布局与列表/详情业务行为。新增反馈仅出现于原操作未确认或确认后资产清理未完成的故障态，视觉细调留待整体执行完成。

## 实际 owner 与单份 authority

- `BookshelfOperationOwner` 仍是既有 `BookshelfHost` 的有限任务/互斥/回执 owner，同 exact Runtime 的 Index/Host 重建复用它。
- `BookshelfRemovalGateway` 只处理原 `bookshelf.remove`、`bookshelf.removeBatch` 两个有限命令，生产 Flow 不再直接调用 legacy 删除 RPC。
- 删除与原五个分组意图共享 `BookshelfManagementIntentStore.forRuntime`、同一 `reader-bookshelf-management-intent-v1.json`、完整原 DTO、单 IO tail、原 Core head/sequence；没有第二删除 journal、序号来源或通用 task runner。
- 原 Core ACK decoder 从 `ReaderCoreGateway` 原方法提取为有限公共方法；legacy 原入口与 exact receipt 共用实际解码和 requested/unique/removed/missing/duplicate 集合核准。单删除 ACK 只有原 `{removed:boolean}`；原 tuple 由完整 intent 与 Core binding 证明，未编造返回字段。

## 事实与动作

1. fsync 原 ID/sequence/完整 DTO 后，actual Runtime 最后 `canDispatch/onDispatch` 才进入 Core；旧 UI 不取消已派发写。
2. Core 原 exact ACK 与 EPUB 释放是两种独立事实。Core 已删除、资源或记录清理失败时仍 `confirmed`；不会改为未写或重新删除。
3. 合格删除 terminal 保存后保留在同一原记录中，直到原 local tuple 清理完成。`Store.completeRemoval` 与分组/删除写使用同一个 IO lane，防清理和新操作并发覆盖原资产。
4. 挂载/刷新只做 `management.mutation.query` 加当前书架读取；精确 ACK 可确认 Core 删除，但不自动释放资产、不 apply 原命令。当前有/无该书不能充当本次 ACK。
5. 未获精确 ACK且 Core 资格允许时，明确“继续原删除操作”仅使用原 ID/sequence/完整 DTO；若已确认，则明确“完成原删除清理”仅处理原 local assets/metadata。
6. 分组面遇原删除仅显示 blocked；分组继续不能代跑删除或释放资产。书架遇原分组同样不会给错误的删除动作；现有可用内容保持可用。
7. 未知原删除/confirmed cleanup 阻断新的删除、分组或会复用资产的导入；离开页面只退役 delivery。Runtime 退休后旧 ACK仍是原事实，冷替代服务通过 exact query 接管，不借新 Runtime 释放资产。

## 实际消费者

`Gateway → OperationOwner → BookshelfHost 实际 emitter → Index 实际字段/Builder → BookshelfShell → ReaderRecoveryNotice/ReaderRecoveryAction`。

故障反馈沿既有 compact 公共控件规格。仅反馈小 actor 按 navigation/generation 重建；书架内容和阅读持久树不重挂。Shell 捕获 immutable identity，actual V1 Prop 更新不会让旧 physical action 借新操作 generation。Index 同时核 Runtime、mount、navigation、当前 receipt，owner 再核原 operation/generation。

## 配对 Core 与本地证据

Core `9c68471db5237e0cc9b7b9b44cb09883a818f3e7`，能力 `bookshelf.removalMutation.v1`；沿原管理 apply/query engine/head。schema 34、协议/ABI 保持原合同。

CLI：`/private/tmp/reader-bookshelf-removal-receipts-20261003/target/debug/reader-cli`，SHA256 `e5034869ba4c3041eddc1245b520a1cf541bf5186e098c2fc039d44c893fbf6f`。

测试环境优先 `READER_BOOKSHELF_MANAGEMENT_CORE_ROOT`，兼容 canonical `READER_CORE_ROOT`；每 RPC 独立 CLI 进程、同 SQLite 目录，冷测试重新编译全部实际类以清除暖态。capabilities 取实际 `core.info`，不声明所有能力都存在。

- `test-bookshelf-removal-durable-intent.mjs`：22 组 actual Atomic fsync/SDK emitted 全类/冷 Core SQLite，包括 before/after ACK loss、批量重复/缺失、部分/错误 tuple/hash、同值列表不确认、higher head、local admission、retired dispatch/late ACK、资源清理失败、跨族互斥与 foreign continuation。
- `test-bookshelf-removal-index-consumers.mjs`：11 组实际 Index→全装饰 Shell/Notice/Action，纯读/明确原继续、Core confirmed cleanup、双击唯一 write、old generation/nav/mount/Runtime、actual retained Prop 更新、same Runtime 新 Index 共享 busy/ACK、原分组 foreign blocked；冷记录读取期间导入 A 关闭再打开 B，旧 A 不得借 B 调起文件选择，当前 B 仍可正常选择。
- 原 24 分组 durable 场景、原管理共享 owner 与原删除 Dialog 场景继续保留，未用新用例替代原矩阵。

这些是代码与本地实际 SDK 组件编译/执行证据。全应用 ArkTS/HAP、目标设备、视觉和用户验收由整合出口分别确认，本文不把本地 PASS 宣称为全应用验收。

## 原夹具迁移

Root 负责 `test-bookshelf-write-receipt-consumers.mjs` 原完整矩阵迁真实 authority/Core/Atomic。`bookshelf-operation-owner-probe` 提供全生产类；缺平台 IO seam 明确失败，不能用成功空 journal 或假 ACK 绕过。
