# 本书目录层级规则：原写入与当前投影分账

## 原问题与边界

WF-F06.3/.5/.6 的原可达消费者是 `BookDirectoryPage` 挂载的 `ReaderDirectoryRules`。旧页直接派发 `reading.directory.rules.apply.v2`；Core 已发布规则与目录缓存后丢失 ACK，旧页仍提示“现有目录保持原样”，并允许预览后再次写入。开始新预览时还会保留上一轮“已应用”的提示。真实 Core888 SQLite 的红反例已保存在外部 `r0-r8-closeout/independent-code-audit/delta-1b516e94`，不能用新绿覆盖它。

本切片保留原 TXT 规则推导、0–31 层级、32 条准入、默认规则、草稿、预览列表截取、正文与分章、字号、间距和测量。只替换写入合同及必要恢复表面；不做 Host 正则/目录算法、不改 Index、阅读持久树、SDK 或 Core。

## 唯一事实来源

`ReaderDirectoryRulesGateway` 捕获实际 Runtime。读取与预览仍使用原纯接口及末端 `canDispatch`；写入只调用既有 `RulesMutationOwner.forRuntime`，消费一个完整 `RulesMutationIntentStore` Atomic 原记录和 Core 的一个规则域 head。目录、设置规则、书源、RSS、订阅共享这个已存在的写事实屏障，不创建第二个日志或队列。

新 Core 能力为 `rules.mutation.directory-rules.v1`；固定 mutation 为：

```json
{"method":"reading.directory.rules.apply.v2","params":{"sourceId":"local","bookId":"local:<hash>","rules":[{"pattern":"第一卷.*","level":0,"boundary":"title"}]}}
```

原 UUID/sequence、完整 DTO、指纹及 query 沿用既有 `rules.mutation.apply/query` 合同。Core 配对切片 `4ec34499` 已合入规范 Core `9a8a4a14`，schema34/protocol1 不变。规则推导的四个缓存与精确 receipt/head 由 Core 原 SQLite 事务统一提交，Host 不从当前规则或目录行推断历史 ACK。

有限 `directory-rules` 恢复资格仅属于这个 method；书籍还须精确匹配。另一规则、订阅、书源或 RSS 的原记录可以只读核对，但不能由此页面继续、清理或替换。`inspectOnly` 对页面初读和“核对原操作回执”均生效：零 apply、零 cleanup、零 journal clear。用户明确“继续原操作”时才允许同 ID/原完整 DTO 安全继续或清理精确终态，空 query、高 head、错绑或损坏记录保持阻断。

## 页面表现与恢复

| 真实事实 | 页面行为 |
| --- | --- |
| 规则读取失败 | 保留草稿；禁止把未载入的空表当默认规则保存；提供纯“重新读取规则” |
| 当前预览进行中或失败 | 明确本次未应用；撤销预览资格；保留草稿 |
| apply 派发前实际品牌拒绝 | 明确未执行；不会冒称 durable unknown |
| apply 已派发且 ACK 未确认 | 原完整草稿与 ID 保留，禁新写；只读核对或按资格明确继续原操作 |
| 精确 rejected/unavailable | 原 `status/reason` 保留为未执行；不发布“写入已确认”，不调用目录刷新 |
| Core 已确认但 Atomic 原记录清理 ACK 丢失 | 保留 confirmed 与 blocked/cleanup；核对不会重新应用，显式继续只清理原记录 |
| 写入/清理已确认但 `onApplied` 同步失败 | 独立 `directoryRefreshFailed`；提示当前目录刷新尚未完成；“刷新当前目录”只重试原投影回调，不重写 Core |
| 迟到结果、旧 Runtime、旧书或旧 opening 回调 | 拒绝发布到新页面；已派发的 durable 写不会被 UI 退役假取消 |

返回恢复成功后只触发当前父页已有 `onApplied` 刷新合同；历史 ACK 的 `nodes` 不直接安装成当前目录。该回调成功仅证明请求刷新已送达，不证明原生页面已经显示完毕。

控件小分支按 opening/book identity 捕获闭包，整页与阅读树不重挂；已删除 rule ID 的旧字段、Select、删除回调也不能撤销后来有效预览。恢复控件按 opening/book/operation ID 捕获闭包。共有消费者是一个 `ReaderRecoveryNotice` 和四个有限 `ReaderRecoveryAction`（核对原操作、继续原操作、重新读取规则、刷新当前目录）；无自由样式覆写，登记由 P4 唯一维护。

## 验证与兼容

`tools/test-reader-directory-rules.mjs` 使用真实整份 Rules Owner/Store、现成 AtomicFile 适配、实际 Core CLI/冷 SQLite、SDK 编译后的完整 Editor/共有 Notice/Action/字段与原 V1 property 方法。覆盖原完整规则列表、边界值、默认规则、非 TXT、预览准入、无迟到发布，以及丢 ACK、冷恢复、foreign/high-head/corrupt、清理失败、末端拒绝、回调刷新失败与旧 physical actor/guard-removal 负控。控制的 OS 边界并非真 OS rename/fsync 取证。

原 Core888 的独立 `--read-only-old-core` 结果仅证明纯读/预览、SDK 控件与旧能力停写；不作为新版写入验收。新版 CLI 为 debug `1fb8099970922adfc64311dd4dabbaa9a786b214a7c51c5b92a15c0d839f5915`，来源 `9a8a4a14f778d3db3c71ab4748011debafbe9cb3`。旧 Core 缺少新能力时此页只可预览，无直接写入 fallback。

既有 Core 直接接口仍兼容。新 Host 不能为改造前无 caller ID 的旧直写追溯捏造精确回执；不能以读取匹配值解除这种未知。新 Atomic 原记录存在时不可自动降级旧 Native、删除 intent 或允许另一写覆盖它。代码/本地真实方法、SDK 接线、严格 ArkTS/HAP、OS 调度/耐久 ACK、设备表现与视觉验收分层登记；本提交不操作设备或构建 HAP。
