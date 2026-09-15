# 旧前台请求失去消费者后仍占执行线程

2026-09-15 代码复核。修复前 Harmony 源码为 `4cb17d895f0696fccc023b63714d9cf84c466f71`。

触发：搜索新书进入详情，`book.detail` 的 JS/Host 请求尚未结束时退出详情或候选整体预算耗尽；随后打开另一书籍。

现象与证据：实际 Coordinator/Scheduler 生产方法探针先使页面 `isCurrent=false`，再打开异书前台。两次读取已提交给 Core 的 `shouldCancel()` 均为 `false`，旧前台作业仍在任务表。原始输出为 `{"cancelledAfterUiReturn":false,"cancelledAfterOtherForeground":false,"oldForegroundStillOwned":true}`。探针使用受控 RPC 等待，不是设备时延或帧率证据。

定位：Coordinator 的已启动 detail→TOC 链把 `job.started` 当作独立消费者，Scheduler 对已启动 detail/TOC/content 忽略消费者取消；现有抢占仅覆盖后台预热。唯一阅读 worker 若在等待旧前台 JS Host 回调，不能立即服务后续阅读。

修复约束：所有真实消费者离开后将取消传给 Core；同书仍有有效前台或后台消费者时保持共享。候选超时与显式取消使用同一执行取消路径，不写来源失败或正文可读证据。已向 Core 发出的取消不可因迟到 join 撤销；同书后续请求重新排队。隐藏但仍有效的消费者只暂停未发出的预热，不能等同于取消。

本记录在生产修改前建立。修复已完成：Coordinator 根据实际消费者判断作业寿命，用户取消与候选整体预算均进入同一 Core `shouldCancel`；Scheduler 按每个消费者合并 `shouldCancel/canContinue`，并锁定已经发出的取消，后续同书请求不加入正在取消的旧操作。已有来源的同书 join 在让出执行前注册，避免同一事件轮内另一个调用者退出造成误取消。

定向回归：`test-search-candidate-acquisition.mjs` 30 场景通过；`test-book-acquisition-coordinator.mjs` 的共享、缓存、生命周期及新增三类请求取消回归通过。覆盖用户取消、整体预算耗尽、前台与后台有效共享消费者、同书取消后重新打开，以及 detail/TOC/content 中首个消费者失效但另一个有效时不取消。取消后不继续 TOC、不发布可读或坏源事实；受控 Core 取消回执后调度槽回到零，后续异书正常执行。

原始证据：[修复前信号](orphan-foreground-before.json)、[修复后信号](orphan-foreground-after.json)、[候选30场景](orphan-candidate-regression.log)、[共享与调度回归](orphan-coordinator-regression.log)。修复后两次 `shouldCancel` 均为 `true`；探针刻意未回应取消前任务表仍保留旧作业，避免在 Core 实际释放前虚报可用槽位。

验证边界：新回归执行实际 Coordinator/Scheduler 与受控 RPC 取消边界，不是原生线程耗时或像素证据。Core 已有 `source_reading_prewarm_cancel_releases_actual_js_wait_for_content` 生产回归覆盖收到取消后的 JS 等待释放；本轮按主任务优先级未重复该 Core 测试。最新包上的原生时延与交互帧率仍需独立验证。
