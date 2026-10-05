# Sync 配置保存原 intent、不可变秘密记录与恢复合同

## 发现及代码证据

基线 Host `9ca00f1c`。实际 `SyncGateway.saveConfig → WebDavCredentialStore.save → asset.add` 派发后抛错会保留原 owner 的 unknown；但没有原身份的持久屏障，新 Store/Runtime/owner 会把旧安全 envelope 的 `saveOperationId` 投影为 confirmed、`canMutate=true`。实际原生 API 边界负对照已复现：新 add 未产生新 envelope，重建后原未知 ID 丢失，旧 ID 错误解锁新保存。测试/日志均不输出 URL、用户名、密码、操作 UUID。

原固定 `reader.webdav.config.v2` + OVERWRITE 还允许迟到的旧原生写覆盖新配置。两槽反复复用也不安全：旧 remove 的 ACK 未确认后，即使读到 absent，旧 native remove 若迟到，仍可删除槽位上的新 live 记录。本轮弃用这两种新写入方式；不靠提高重试次数或对比公共字段核定。

## 承载及输入边界

复用系统 AssetStore（独占 UUID alias、`ConflictResolution.THROW_ERROR`）、`@ohos.util.generateRandomUUID`、官方 `cryptoFramework` SHA256 和已有 `ReaderAtomicSnapshotFile.replaceReaderAtomicSnapshot`。依赖读取来自当前 SDK `@ohos.security.asset.d.ts` / `@ohos.security.cryptoFramework.d.ts` / `@ohos.util.d.ts`。没有新密码算法、存储引擎、通用 ledger 或任务总线。

完整输入是规范化 url / user / password / backupPassword / directory，沿用当前有效性、字段容量、旧秘密复用及独立备份密码规则。完整 DTO 的标准 SHA256 只绑定原操作，不用于猜测是否保存成功；秘密仍仅属于 AssetStore。新增文件只有 UUID、hash、phase 和被清理旧记录的非秘密身份。恢复时缺失原安全 payload 必须重新输入完整原 DTO；不能从不同旧 envelope 借密码。完整 hash 不一致保留原 intent，不新建 ID。

## 唯一职责与实际流程

`WebDavCredentialStore` 是该配置唯一持久 owner，共同静态 IO 队列跨 Store/暖 Runtime，原 context 路径与 generation 在准入时固定。`SyncGateway` 做输入、能力与精确恢复薄适配；`SyncOrchestrator` 保留 operation、read、busy、unknown、generation，`SyncPage` 只消费有限事实/操作。Index 原整体 snapshot 投影不拆业务事实；新增 callback 由 Index 唯一写者接线。

1. 固定 `reader-webdav-config-intent-v1.json` 保存 UUID、完整 hash、prepared、原 current-head 的 UUID/hash 或 legacy 标识，获得 Atomic ACK 后才准备秘密。
2. `reader.webdav.config-save.<UUID>` 保存原完整秘密 envelope，`THROW_ERROR`，从不 overwrite 或复用 alias。同 UUID 已存在时只有完整 ID/hash 一致才能供原操作继续；不同 payload 拒绝。
3. mayDispatch intent 获得 ACK 后，最后核 Runtime/UI/context admission，才 Atomic 发布 `reader-webdav-config-head-v1.json` 的 UUID/hash。实际 current 只由这个精确 head 指向的安全记录确定。
4. 发布后仍保留原 intent。confirmed metadata、同 exact head 再次 Atomic ACK、仅原 previous UUID / legacy alias 的 cleanup、固定 intent 清空 ACK，全部通过才解除屏障。
5. 清理/本地 ACK 失败保留原屏障。不能用 matching DTO、旧 envelope ID、缺失记录、读到 current-head 或 in-memory 缓存把 unknown 变为已完成。

秘密记录不会被业务配置备份/恢复、Core cache.clear 或 SQLite snapshot 移植；固定 Host metadata 位于 app filesDir，Root Atomic 薄适配保持 finish invoked 后失败不 failWrite/补偿。旧固定 alias 仅在尚无 head 时读兼容；新 current-head 到位后精确清理该 legacy alias，永不再写它。

## 状态及恢复效果

| 实际事实 | UI / 准入 | 唯一可用恢复 |
| --- | --- | --- |
| 未派发的输入/权限失败，无 intent | 原失败，仍可修改 | 修改输入，普通新保存 |
| prepared 原 intent 存在，原秘密记录缺失 | 原操作 unknown，禁止新保存/clear/backup/restore | 纯核对；重新完整输入本次配置后“继续原操作” |
| 原秘密不可变记录已读到，head 未确认 | 原操作 unknown，不自动提交 head | 纯核对；明确“继续原操作”仅用原 ID/hash/DTO 提交原 head |
| 原 head 已读到，ACK/cleanup 未闭合 | 原操作 unknown；保存或清理回执尚待核对 | “核对原配置保存”：重建同 exact head 的 Atomic ACK、精确 cleanup / 清 intent |
| 全部 exact head / cleanup / clear metadata ACK | 原保存 confirmed / completed，新操作解锁 | 刷新失败只纯读，不再保存 |
| ID/hash/metadata/head 损坏或 context/runtime 退役 | 失败/阻断，保留可用旧数据和原身份 | 当前 owner 的纯核对；不能补偿/改 ID/盲重放 |

`configReceiptQualified` 与 `ReaderWriteEvidence` 实际 dispatch/ACK 计数分离：后续 pure query 或原 immutable 记录资格不得伪造原 physical ACK。只有已核定原记录及 acknowledged head/cleanup 的有限 domain result 可以投影 confirmed。读取到旧安全 envelope 仅是当前可用数据，不是原未确认操作回执。

“继续原操作”是用户单独动作，不能由 GET/query 自动触发。两次点击共享 operation mutex；旧 Runtime、navigation / session、旧 generation、错误 full input 不得提交 head。已真正 dispatch 的 head 写保留事实，不能谎称取消。页面原布局、所有既有文字 tuple、输入草稿、隐藏 Sync 入口策略保留。新增有限恢复动作复用现有 `ReaderRecoveryAction`；只有原 ID/generation 的小 Action keyed，整个 Page 不重挂，普通 V1 callback 不借新的 Prop generation。

## 迟到原生 IO 与容量

旧 Asset add 只触碰旧 UUID；无论它比显式原操作继续先/后到达，不能覆写另一个 current-head 的 payload。cleanup remove 只触碰被原 intent 绑定的旧 UUID，不能删新 UUID 的 live config。不存在重新复用已删 alias 以压缩物理容量的代码。

逻辑被引用集合最多 current + 原 pending + previous cleanup（三个具名引用，首次 legacy 迁移计入 previous）；一次未清 intent 阻断下一保存。未知不会 TTL 淘汰或被新调用覆盖。每条秘密 envelope 沿用 64 KiB/4096 字段限制，intent ≤512 字符、head ≤256 字符。由于 OS native add ACK 丢失后可能在原 UUID cleanup 之后才生成旧记录，**不承诺平台实际 alias 总数永久 ≤3**；那是可能孤立的旧 UUID，不能用复用 alias 牺牲安全。进一步物理 orphan 枚举/清理需要真正的 Asset 请求 settlement / 目标证据与 P9 容量核定，当前不发明清理策略、不称目标预算已通过。

## 实际验证及证据边界

`test-sync-config-cold-intent.mjs` 运行完整生产 Store/Gateway/owner，系统 IO 是薄 Node 平台 adapter，仍使用原 `replaceReaderAtomicSnapshot`，metadata 使用真实临时文件。每次 cold 重建重新装载全部实际生产类，保留原文件/Asset，而非只清 UI 变量。

覆盖原 intent 压过旧 envelope、阻断新 save/backup/restore、纯 query 不提交、full original hash/秘密丢失、prepare before/after-effect、head lost ACK、cleanup lost ACK、跨 Store 同文件排序、context/route 退役、原 native add 迟到、旧 remove 迟到、错误新 ID、坏 hash/head/immutable envelope、完整装饰 SDK Page 与真实 `ReaderRecoveryAction` 的 retained V1 Props / busy /旧物理 callback /新 keyed actor。

既有 owner、config receipt、WebDAV queue、partial restore、backup unknown/retention 和实际 Index 消费者断言保留。过去“读取 staging 即自动确认 current”的期待修正为 unknown → 显式原操作继续 / acknowledged exact cleanup；未删历史旅程。新增 test 登记 contract tier。

本轮不改变 Core/native 协议，不触设备/Native/HAP。SDK Store 语义检查、实际 SDK Page/Action、真实本地文件故障均是代码/本地/SDK层证据；OS AtomicFile/base/parent fsync 实机适用性、进程杀死/断电 durability、Asset native 真实 settlement 与最终 HAP/目标验收仍需 Root 配套出口，不能由本地 Node fsync 宣称通过。公开生产 `clear()` 没有当前 UI 调用方；本轮保留其 normal/tombstone/精确 alias 清理和 unknown 证据，未声称把隐藏/未来 clear 产品旅程全部实现。
