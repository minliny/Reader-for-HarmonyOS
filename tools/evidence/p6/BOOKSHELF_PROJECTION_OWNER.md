# 书架完整读取/窗口/名称投影纵切

基线：7b6039c4（Sync 明确继续原配置的实际 Index 消费者）。本切片保持现有页面规格，不新增全局 store。Core 继续拥有持久书架数据、分页 revision 与深锚点查询；已存在 BookshelfOperationOwner 继续拥有导入、删除、加入的写回执。本切片不将成功读取推断为某次写 ACK。

## 唯一职责与真实消费

- `BookshelfHost.projection(exactRuntime)` 提供一个本域有限共享 `BookshelfProjectionOwner`；同 Runtime Index 重建复用 window/value/read generation，退休 Runtime 查找不能替换新实例。旧展示 detach 只撤对应 identity。
- `BookshelfProjectionOwner.ts` 拥有刷新代际、窗口 revision/offset、单分页任务、48 步/144 行上限、Core 深锚点读取、全量 membership/管理选择读取以及 exact sourceId 名称补全。复用原 `BookshelfReadOwner` / `BookshelfFlowGateway` / `SourceGateway`，无新通用分页引擎。
- `BookshelfSourceNameProjection.ts` 是一份实际名称准入/优先级实现。Core 已删除哨兵、持久名、原 registry 顺序和旧缓存保留规则不变；复制所有现有可选字段，名称不能改变进度/位置证明。
- `Index.getBookshelfProjection` 只绑定 exact Runtime、实例、mount、nav、route，接入原消费者需求；`applyBookshelfProjection` 只赋 DTO。页面保留实际滚动、可见项/锚点输入、路由和临时呈现。BookShelfPage 的物理意图捕获原 mount/nav/Runtime；旧页不能借当前导航重放。
- `BookshelfShell` 继续消费原 ReaderRecoveryNotice/36px Action。首次空白读最多一次自动重试，已可用内容刷新失败保留旧值，真实 Core 空态和压扁显示失败分账，后续只读重试不导入/删除。
- 元数据/分页变更不重挂阅读持久树或整个书架页面。完整 membership 不由过滤页/部分窗口假冒。

## 原实现删除

Index 原 `loadShelfWindowPage` 算法、`applyBookshelfState` 名称/窗口算法、`hydrateShelfSourceNames` 与 `copyShelfBookWithSourceName` 已删除；剩同名方法是调用本域 owner 的薄意图。`openBookshelfMultiSelect` 不再直接创建 FlowGateway。`bookshelfLoadGeneration` 只是快照 DTO，不是第二权威。

## 本地验证

- 新 `test-bookshelf-projection-index-owner.mjs`：实际 Core/Flow/Source Gateway、SDK 编出的完整 Owner/Host、实际 Index 方法，首次/刷新/空读/部分/纯读重试、分页/快速换过滤、深锚点、精确名补全、same Runtime 重建、旧 detach、nav/route/mount/Runtime 退役、管理全量选择、诊断失败与显示失败。
- 真实 Index builder → SDK Page 参数 →真实 Shell → shared Notice/Action，保持书架/continueReading/viewState 引用与原触区规格；旧物理过滤、分页及页面动作回调拒绝。
- 原 `test-bookshelf-read-owner-closure` 保留 deferred 成功/失败退役、畸形/过滤空态、一次首次重试/只读恢复断言，探针迁到真实 Owner/Host。
- 原 `test-bookshelf-paged-projection` 保留 1001 本双向 35+ 窗口/不完整尾部/锚点/重复拒绝，通过实际 Flow→Owner→Index。
- 原 `test-bookshelf-source-name-durability` 保留 Core 名称 DTO、冷 registry 失败、rename/delete、同 bookId 不同 source、非法名称与进度保护，调用唯一生产 owner 的实际 hydration。
- `test-architecture-consumer-baseline` PASS，100 个既有业务预算未扩。此工作树 tiers 仍有上游 3 个已出现测试未登记（reader-settings-write-facts / reader-strong-progress-owner / rules-mutation-owner）；只为本新增 gate 登记 integration，不擅自重分他人测试。

## 仍需完成的真实范围

本切片不关闭整个 P2。Index 整轮 Catalog manual/automatic 的 running/epoch/progress/facts、全量 target+preparation 共享与有限重试还在页层，是下一条必须下沉纵切；不能用直接 RPC 为零代替完成。源/RSS规则订阅跨域旅程由其他 lane 收口。HAP/目标/视觉/用户验收未由此代码与 SDK 测试证明。

## 原四项书架回归复核

`detail-removal / reading-feedback / reading-entry / shared-scan` 旧回归已迁真实 owner。原移除禁用、已提交换源返回保护、local/remote/info/search/取消/迟到准入、一次全量 scan/preparation 共享与有限重试均保留。实际 source commit/unknown journey 证明 hidden/rebuilt owner 可持有 accepted intent 而旧页 pending DTO 尚空；Index detail 移除和 bookshelf preparation Back 现直接消费原 `SourceSwitchHost.blocksExit(book)`，不能因为 pending DTO 不在而放行。`offlineOperationActive` 仍来自实际 Offline owner，不恢复旧字段权威。准备重建旧 Runtime 时，实际 Core admission 在 RPC 前拒绝（0 次 membership IO），强于原薄假 Flow 的一次取消读取。
