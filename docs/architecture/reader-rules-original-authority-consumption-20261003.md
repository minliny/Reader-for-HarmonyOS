# 阅读替换面板消费原规则写入 authority

来源：共享规则 owner/Gateway `6011edfe`（本分支 cherry 副本 `d847bf5c`），LRE 基线 `d8bfef29`。不改布局、字号、持久树或 Index；不操作设备。

## 已定位问题

Quick 先等待当前位置持久化，再发送 `setRuleEnabled`，没有将面板/book/source/lifecycle/Runtime/位置准入传至实际 Runtime 启动后的派发点。等待启动期间关闭面板后，旧回调仍可能发送规则写。Quick catch 只释放局部锁，没有呈现未知写；新 LRE 或换书后读取当前规则列表也没有消费同 Runtime 的全规则集合 authority。局部 list/read 成功不能证明原 mutation ACK。

## 本提交

LRE 同步捕获实际 Runtime，并消费该 Runtime 的既有 `RulesMutationOwner`。开面板、列表更新和写前将 shared unknown 投影到现有 `controlReplaceState`；状态保留真实列表和草稿，禁止将纯读解释成确认。Full、Quick 和设置仍由原域同一个 authority 决定是否可以写，局部 mutation ticket 只保护阅读 presentation。

Quick 的实际 Gateway 第三参数包含原 Runtime/source/book/lifecycle/panel 和持久位置准入。未派发退休请求可拒绝；已派发写仍由共享 owner 接收 qualified ACK 或保留 unknown。关闭面板后的原确认可以使原书内容失效，但退休 source/book/Runtime 不更新 successor。Quick 的异常沿现有 native notice 显示，不乐观切换、不补偿旧规则、不自动重发。新 panel 通过原 state 看到未知结果。

## 验证、删旧与边界

`test-reader-lre-rules-authority.mjs` 登记 integration：真实 SDK footer → 原 LRE 方法 → 完整 Gateway/shared owner → 原 Runtime direct method。六条场景包含实际 startup 延迟关闭、丢 ACK 后重新进入/新 LRE/list match、迟到原 ACK、相同 bookId 的 successor source、Runtime 退休、草稿/弹层/保存按钮。删除 Quick 第三参数的实际源码负对照会在相同场景错误派发，证明 guard 必要。

旧 `test-reader-control-replace-host`、`test-reader-replace-quick` 与 `test-rules-mutation-owner` 通过。旧 Host 的“列表读取解除 unknown”断言改为保留未知并拒绝后续写；其原 pending/close/reopen/late/refresh/Promise 断言保留。删除原吞掉异常的 Quick catch 行为。共享 helper/registry 由整合者按新增实际 constructor 字段接线。

本提交只能守住同 Runtime 暖生命周期。Core 原规则 CRUD/import 没有 caller identity 或 durable exact receipt，冷启动不能由匹配列表解除原 unknown，规则订阅 Source/RSS import 和时间戳更新也有半程事实。这是 required Core/domain contract 缺口，下一步需要有限持久 intent 与原事务精确 receipt，不是 OS 限制；本提交不把它当已闭合。Native/完整 SDK/HAP/目标/视觉/用户验收分层保持 OPEN。

回退单位为本 LRE 叶提交，依赖原共享规则 owner。回退会恢复已证实的派发准入与未知投影缺口，不丢弃 Core 数据或操作新的 journal。
