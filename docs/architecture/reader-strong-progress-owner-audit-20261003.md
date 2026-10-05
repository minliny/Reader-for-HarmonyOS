# P3 强进度 producer 与未知写边界

基线：Host `ebbf331b`。本轮保持当前 UI、持久阅读树、正文测量、动效与翻页终点；不占用 HAP/VM。

## 真实问题与调用链

`completeFirstPage` 的控制选择分支和 `persistPreparedPageTurn` 原来在 `runProgressCommitSerial` 内调用 `resolveAndUpdateProgress`。该调用直接发送 `reading.progress.update`，没有 `expectedProgressRevision`，也没有向已经存在的 `ReadingSessionProgressOwner` 登记未知写。Native 请求的观察 Promise 报错/超时后，普通串行队列继续运行并不能证明底层请求已经停止。恢复流程再次读取原位置后，可能宣称 origin confirmed；随后迟到的旧写仍能覆盖新位置。

预备页恢复还只比较 chapter/scalar，同位置的新 body/processing 会被当成旧预备页。实际生产方法负对照证明了两项反例：旧未登记路径在新页 CAS 提交后仍能写回旧 anchor；删除版本准入后，外来 body 被错误接纳为预备页。

## 本切片的实际收敛

两个 producer 调用一个薄 `persistMeasuredCanonicalProgress` 接口。无待终结换源事务时，它调用现有 `persistPresentedProgress`：同 Runtime/book 的唯一 `ReadingSessionProgressOwner` 拥有 baseline、Core CAS、已派发未知写、重试与串行屏障。UI admission 只控制首次派发；接受后的 durable 写不因 UI 退休被取消。原控制选择/预备页仍等待可证明的 durable 结果才发布，普通页面的独立 presentation 不变。

不再把上述 CAS 调用包在 `runProgressCommitSerial` 内，以免未知 owner 的 drain 与自己的 serial boundary 重入。恢复沿原 serial read 入口，入口现在会先 drain 同一个实际进度 owner；无法解决的未知（尤其无 CAS 的 legacy）仍 blocked。预备页 target/origin 比较包括 body/processing，不能用相同标量替代内容身份。

## 明确未闭合：换源 canonical 原子分支

Core `remote.rs` 的 `transactionId` 分支调用 `save_progress_and_finalize_source_switch`，没有把 `expectedProgressRevision`/版本 CAS 传入。SQLite 和 memory 实现仅拒 rolledBack，finalized 后重复调用仍可能再次保存旧位置。现有纯 transaction query 有 phase 和历史换源 commit，没有第一次 canonical 保存 receipt，phase alone 不能证明这次保存。

本独立提交暂保留原换源原子调用和只由实际匹配 ACK 产生的 `sourceSwitchTransactionId`，不伪造终结回执，也不声明该分支已经闭合。Root 已授权下一独立 Core/Host 切片：复用现 SQLite 事务与 journal，补 CAS-finalize 和精确保存 receipt；schema34、持久树和 Index 单写边界保持。新 Native 必须重新绑定后才能验收。

## 验证出口

`test-reader-strong-progress-owner.mjs`（integration tier）执行 SDK 提取的原 LRE 方法、整份真实 Gateway/ProgressOwner/Local/Remote Gateway，以有限 Core IO 控制覆盖 ACK、落盘后丢 ACK、旧请求迟到、UI 派发前/后退休、内容版本错配、legacy 未知阻断、控制选择后的真实 owner drain，并保留生产路由与版本门禁负对照。真实 SQLite/CAS-finalize、Native、目标调度/视觉仍分别验收。

回退单位是本 Host 提交；回退会恢复已证实的进度未知缺口，不应作为完成态。没有新增 owner、总线、算法或统计语义。
