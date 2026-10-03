# 换源首屏 canonical 与同一进度 owner

基线 Host `996589dd`，Core 合同来源 `f8faeb0c`。本提交保持 UI、正文测量、持久阅读树和唯一动效进度；不操作 HAP 或目标设备。

## 真实缺口与最终归属

换源首屏原来直接 `resolveAndUpdateProgress(transactionId)`，未登记到普通/控制选择/预备页共用的 `ReadingSessionProgressOwner`。失 ACK 后串行 Promise 结束不能证明 Native 请求停止，读取匹配位置也不能证明本次 source finalize 被确认。普通 owner 的匹配当前位置恢复规则不能用于精确换源终结。

LRE 的 `persistMeasuredCanonicalProgress` 现统一进入同一 owner。无换源事务仍用普通 CAS；有事务需要 `reading.progress.sourceFinalizeReceipt.v1` 与 CAS 能力，并固定首次 transactionId、完整 anchor/layout 和 baseline revision。实际 Runtime/SDK 派发前 admission 与 `onDispatch` 分账；派发后的未知写不会被 UI/内容退休清除。旧 Native 不自动退回无保护写。

换源未知恢复只能重发同一原完整 tuple，由 Core journal 中的精确首写 receipt 去重。匹配当前位置、纯 transaction phase、读取失败都不能解除该未知。历史原 ACK 可以确认原写；如果纯读不能证明该 receipt 仍是当前位置，或原 UI/book/content 已退休，则不安装历史位置、不发布旧页面、不再发送旧 anchor。暖重入同 Runtime/book 复用原 owner，原 receipt 仅清除对应 transactionId，不能清 successor。

## 来源、验证与删旧

删除 LRE 换源路径中的未拥有 `runSerial → resolveAndUpdateProgress`。复用现有 owner、Runtime direct admission、Remote DTO 与原 Core SQLite journal，无新增全局总线或任务系统。

`test-source-canonical-progress-owner.mjs` 是 integration tier：执行整份真实 Gateway/ProgressOwner/Remote Gateway 与 SDK 提取的实际 LRE 方法。15 个场景覆盖派发前退休、实际 branded 未派发拒绝、CAS 原子拒绝、丢 ACK、匹配当前位置负对照、精确重发、历史 receipt、错误事务 ACK、内容退休、暖重入、旧 Native 及预备页迟到结果。有限 Core IO fixture 只控制调度与 ACK；Native 去重/CAS 由独立 Rust SQLite/Runtime 用例证明，不能混称设备证据。

既有 presented owner 25 例、strong producer 14 例、source ACK scoped SDK、routing/ownership、source presented 6 例通过。新测试应登记为 integration。完整 SDK/HAP、Native 配对、目标行为、视觉和用户验收仍各自 OPEN。

## 兼容与回退边界

Host 回退单位为本提交；回退恢复已定位的未知写缺口。Core journal 的新增 exact receipt 不能由旧 Native 的 `deny_unknown_fields` 安全读取，schema34 不代表可直接保数据降级。Core `f8faeb0c` 的 prepared-document 必需条件另有已定位兼容缺口：合法缓存换源首屏未必存在 prepared header，必须补实际 document clock admission 后重新构建 Native；本 Host 通过不代表该目标配对已经通过。
