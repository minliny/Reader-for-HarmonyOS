# SC01 / WF-F07：规则冷恢复与订阅更新的 required 合同缺口

只读核定来源：Host `6f158a46`（共享规则 authority 原提交 `6011edfe`），Core `0b6e51f4`（基 `ca8120ef`）。本文件是待整合者裁定的最小域合同，不代表以下新合同已经实现，不涉及 Index/P4 Settings Host 写入。

## 实际调用范围

当前应用的规则写命令为九种：`replace.persist`；`txt-toc-rule.create/update/delete`；`dict-rule.put/delete`；`rule-sub.put/delete`；`rule-bundle.import`。Reader Full/Quick 走前者和规则包导入；Settings Gateway 覆盖九种。旧 Core 的 `replace-rule.create/update/delete` 是兼容命令，不能因本轮迁移被改变业务语义。

RulesMutationOwner 是同 Runtime 的 WeakMap；它可阻断暖生命周期未知，但没有持久 intent。Core 九种命令没有 caller sequence/hash/exact ACK query，冷重启只能读取当前数据。替换规则的现有 transactionId 属于 undo journal：重复 persist 报 duplicate_transaction，issuedAt/自动 ruleId 在 Core 生成；无原输入 fingerprint/精确成功回执查询。它保护撤销 ABA，不能代替 mutation receipt。不得用修改 transactionId、匹配列表或总数证明旧操作。

`rule-bundle.import` 在 Runtime 中导出候选快照、合并四规则集合、投影本地处理位置后调用既有 `replace_with_snapshot`。这是已有原子提交边界，receipt 必须与该原子提交一起保存；在返回后另 put cache 是半事务，不能接受。Replace 原来有 rule/undo/local positions 同事务；新增 receipt 也必须加入这同一事务。字典/TXT/订阅原单语句 mutation 同样需与 receipt 处于一个 SQLite transaction/memory mutex。

## 订阅更新是独立旅程缺口

`refreshRuleSubscription` 先获取线上 JSON，再按 type 路由：0 经 SourceGateway 逐条 `source.import`，每条 catch 后继续；1 经一条 `rss-source.import`；2 经一条 `rule-bundle.import`。导入后另发 `rule-sub.put` 保存 Date.now 更新时间。当前 ReaderWriteEvidence 汇总已确认步数，但 Source/RSS unknown 没有写入 RulesMutationOwner；Orchestrator latestReceipt 仅实例字段。新 Orchestrator 的 `open` 看不到前实例 Source/RSS 未知，可重做全导入，且成功导入后时间戳 unknown 易被描述成整个旅程失败。

这里至少三类事实必须分开：导入各项已确认/未确认/明确拒绝；订阅时间戳是否被确认；当前列表刷新是否可用。不得用一个 boolean 或 rules list ACK 代替。type0 保留原准入与可证明的部分结果；明确验证失败项可继续，已派发 unknown 不能假失败后盲发下一 mutation。不能自动补偿已经确认的导入。

## 建议的有限域 API

建议新增 `rules.mutation.exact.v1` 能力与两个有限命令，复用现有 typed DTO、SQLite、serde/sha2。避免改九种旧 DTO 的大量构造点，也不把任意 RPC 包进一个通用执行器：

```
rules.mutation.apply {
  operationId: UUID/sequence, sequence: safeUInt,
  mutation: tagged enum of the existing nine rule operations
}
→ { operationId, sequence, payloadFingerprint, mutationKind, data: original ACK }

rules.mutation.query { operationId, expected?: same original typed mutation }
→ { head: {operationId, sequence} | null, receipt: exact stored ACK | null }
```

核心是原规则域的固定一个 head/最新 exact receipt，而非无限日志。新序列仅 head+1；safe integer/溢出检查；相同 ID/seq 不同原输入拒绝；同 tuple 重试只返历史 ACK，不重新分配自动 ruleId/undo token，不改当前行。旧 seq 即使 receipt 被最新一次替代也不能再写。查询缺失不能宣称未派发；head 高于本地 pending 且精确 receipt 不可取得时 blocked，不能猜成功。外部备份/缓存清理保留本机 authority 并拒外来 authority；原 exact-before-image rollback 保持既有用途。schema34 与 protocol1 不变，旧 API 保持兼容。

Host 在同 preferences/domain 的实际 Runtime owner 之外，复用原 `ReaderAtomicSnapshotFile` 维护一个完整固定 pending mutation；持久化确认后才进入 actual Runtime。跨 Ability/Runtime 同一域串行，原 owner 退休不清 successor intent。不拿缓存 get 当 durable ACK；本地 journal 写前失败可在 head 只读核对后重持久同 ID，不重新分配。原 Core receipt 确認和列表刷新分账；原确认后的刷新失败只读重试。

### 订阅的配对资格

只补九种规则命令不能关闭 type0/1。推荐沿原 Rules subscription 域增加有限 journey owner 和同一个持久 intent：冻结订阅身份、完整文档、固定更新时间、逐项 cursor/确认记录；每项实际 Core ACK 后持久 checkpoint，再允许下一项。最后时间戳写为独立 mutation，须核对捕获的订阅 URL/type/元数据，避免旧下载覆盖新订阅。Source/RSS import 必须有对应 exact receipt（可限定为 subscription 导入 enum 分支，不能在通用 Rule CRUD enum 接受任意 method）；复用它们原解析、逐项准入、原持久化和 qualified ACK，不自研 parser。完整文档可能大于 Preferences 8192，使用现有 AtomicFile，不分片/压缩。

另一可行实现是有限 `rule-sub.refresh.apply` 将原导入和时间戳置于既有 SQLite 同一事务，但必须证明原 Source 逐项语义、partial 结果、本地位置/处理规则以及 RSS 源语义完全保持，不能为省 journey 而改为全失败。具体选项由整合者结合范围裁定；本次不冒称九命令 receipt 已经能覆盖它。

## 文件、接口与验证范围

Core 可独立新增 `reader-contract` 的有限 DTO、`reader-storage/rules_mutation_receipt.rs` 与对应 SQLite 子模块、Runtime `remote/rules_mutation.rs`。必要共用 mod/router/schema/capability 和原 SQL mutation receipt hook 由一个 writer 串行写；沿原既有 SQL helper/mutex，不复制一套规则处理。Host 复用 RulesMutationOwner + AtomicFile intent；Reader Gateway 只消费 qualified original ACK；P4 Settings Host/Gateway 与 P5 Index 仍分别唯一接线者。

必要反例：真实 memory/SQLite 两连接/cold Runtime；Core commit 后丢 ACK；新位置/规则修改后历史 retry 不覆盖当前行；同 ID 异参拒绝；自动 ruleId 不重复；undo token/本地 positions 与 receipt 原子；bundle import 与 receipt 同提交且保其他数据；cache.clear/外部 restore 不丢 authority；journal 未落盘/flush unknown 可恢复但不分配新 ID；head 越过旧 intent 诚实 blocked；Source type0 部分导入 unknown、type1 import ACK + timestamp lost ACK、type2 cold import，旧 session/nav/Runtime 回调不写新草稿；实际 SDK save/recovery callbacks 与读取不解除 unknown。完整 Native 重新绑定、目标 IO/容量/调度属于随后独立出口。

## 裁定前仍 OPEN

LRE 的暖共享 authority 消费已交叶提交，但 cold rule CRUD/import 和订阅 import→timestamp 全旅程没有上述 exact receipt，必须记录为 required，不能转成 OS 平台限制或永久例外。只读审计没有运行新生产迁移、HAP 或设备测试。
