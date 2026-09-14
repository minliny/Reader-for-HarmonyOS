# 首页 ready 与呈现发布顺序：只读变更建议

复核当前 `aa387f08dceef4592c6bf642ca7bd351de1b0f8c`。没有编辑生产文件，没有设备/Git操作。本记录只讨论可以独立证明的调用顺序合同；**不认定这是此前 VM 空正文瞬态的根因，也不声称可由普通方法探针证明最终画面同帧。**

## 结论

应明确两层边界：

1. **发布顺序**：真实测量、Core anchor 提交、当前正文/标题/进度及对应呈现 revision 全部写到 owner 后，才允许调用 onReadingReady。这个合同可用生产方法独立证明，可以小范围修正。
2. **实际交付/绘制**：新 revision 已到 resident slot、以及画面真正完成绘制。这需要对应回执；把赋值挪前面不能自动满足。现有 `ReaderPageTurnSurface.onContentReady` 及 postFrameCallback 也明确不是物理 scanout。当前不能把顺序修复称作像素屏障或此次截图根因修复。

不建议将 ready 简单放到 `completeFirstPage` 整段末尾：其 `drainRapidPageTurn:11322` 可调用下一次 performPageTurn，`resumeDeferredMeasurement:5434` 可同步进入下一轮 measuring。也不能把 ready 加进 `schedulePageTurnPreparation` 方法末尾——此方法也被设置切换/失败回滚 `:7775/:7807` 等调用，会凭空增加无对应新持久提交的就绪通知。

## 最小安全位置

`LocalReadingExperience.ets:4385 completeFirstPage`：

- 保持 resolveAndUpdateProgress 前后 current generation 检查、返回 anchor 严格核对、位置保护、visiblePage/visibleFragments 写入顺序。
- 当前成功尾部顺序为：admitCommittedProgress → completeControlSelectionAfterCommit → ready observers → prefetchNextChapter → schedulePageTurnPreparation → rapid/auto/remeasure。
- 建议在 visiblePage/visibleFragments、showChapterTitle、phase、chapterTitle 等当前页数据全部就绪后，**将本次既有 schedulePageTurnPreparation 调用移到 observers 前面**；不另增一遍 preparation，不增加一个假的帧延时。可放在 chapterTitle 赋值后、admitCommittedProgress 前，使 commit observer/控制栏选择关闭也不会先看到旧呈现 revision。
- 后续顺序保留：commit observer/选中交易处理 → guarded ready observers → 下一章 prefetch → rapid/auto/remeasure。就绪通知不依赖预取或 TTS 的完成；有 pending reflow 时先合法公布本次已保存页，再按原规则重测。
- 对外 observer 可能同步触发退出/新选择，通知前以及 onChapterCommitted 返回后应重验已捕获 lifecycle/selection/visiblePage/chapter 是否仍归当前会话。复用 isSessionActive/isVisiblePageCurrent 或 isStableVisiblePageOwner + phase=ready，不使用只适用于 phase=measuring 的 isMeasurementCurrent。退出/换页后不再向 Index 发旧 ready，也不为旧页追加后台工作。observer 抛错仍按既有隔离原则处理，不能把已经成功的 Core 写入误报成失败。
- `schedulePageTurnPreparation` 包含递增 pageTurnGeneration、清旧预备页和投递 timer，不是纯 revision setter；保持原定向/失效 timer 合同。必要回归必须注入 optional preparation/TTS/observer 失败，确认不回滚已保存位置、不二次写进度、不遗留持久待完成状态。是否需要把 optional timer 投递异常单独隔离，由实现时根据真实可抛边界处理，不能用吞掉所有异常替代验证。

## 其他 ready 发出点

| 路径 | 当前次序 | 最小影响判断 |
| --- | --- | --- |
| `completeFirstPage:4440` | notify 在 schedule 前 | 初始详情/书架 reveal 的直接目标，适用上面的调整 |
| `reconcileFailedControlSelection:9674` | 恢复已核实显示页后 notify，再 schedule | 与首屏存在同一个发布先后问题；按原目标/原页恢复和所选 token 后先发布，再通知。保留失败对话框和用户 retry，不把保留原页当跳转成功 |
| `promotePreparedPageTurn:11243` | 直接 onChapterCommitted/onReadingReady，之后 schedule、reverse prepared、logicalPromoted、slot toggle、revision++ | Index 已在 reading 时通常忽略路由通知，但同名回调不能宣称具备统一发布合同。若要全局统一，应在 slot/反向预备页/最终 revision 都完成后再发通知，复用保护型 notifier；不能仅把它挪到 schedule 之后，因为最终 slot toggle 在更后面。这涉及现有翻页交接测试，不宜悄悄夹进“只修首屏”的小改 |

ReaderShell 只转发 `:139`；Index `presentPreparedReading:3661` 只在可准入的 detail/directory/书架准备路由切换。它不知道 page identity 或 revision，不能从父层证明子树已接收。当前没有其他名为 onChapterMaterialized 的准入路径。

## 实际探针与额外确定的 generation 顺序问题

`reader-entry-order-candidates.mjs` 将当前源和两个有限候选副本写到 /private/tmp，只对 `completeFirstPage` 已有调用排序，依旧执行原普通生产方法；未改工作树：

| 候选 | ready 当下 owner revision | phase | Stage 尚未收到新 scalar 时 |
| --- | ---: | --- | --- |
| 当前原序 | 5 | ready | 旧空缓存 |
| schedule 移到 notify 前 | 6 | ready | 仍旧空缓存，证明赋值不是原生交付屏障 |
| ready 移到整个方法末尾（有 pending remeasure） | 6 | measuring | 已进入新测量，再报旧 ready |

三项 probe 都按预期通过；它们是当前/候选差分，不是已经实施修复的绿色回归。输出 `reader-entry-order-{baseline,publish-first,ready-at-tail}.log`。现有 `resumeDeferredMeasurement` 正文不变，beginMeasurement 的测试边界只记录同步启动新测量；不声称该探针跑了原生 Text 布局。

另外，调整前后顺序会影响真实下一章预取：`prefetchNextChapter:3270` → `requestPageTurnChapter:3286` 捕获 pageTurnGeneration；当前随后 schedule 将其递增，故刚派出的请求 isCurrent 立刻从 true 变 false。`reader-entry-prefetch-generation-probe.mjs/.log` 执行原三个方法，真实保留该 guard：prefetch→prepare 结果 false；prepare→prefetch 结果 true。没有网络、没有正文回包。这个 generation 失效是独立可证明的代码顺序问题，不能借此断言当前 VM 初屏时长或空白因果。

## 实施时正式回归要求

1. 真正 completeFirstPage：Core 写未完成时 route 留原页；成功后 ready 观察到完整正文及新 revision，恰好一次 Core 写；失败、anchor mismatch、写回迟到或 generation 失效不发 ready。
2. Data/prop 两层分开：普通方法证明发布先于通知；用真实 SDK LRE→Stage→resident slot 链证明送出的 revision 确实更新当前片段，旧空缓存不再被当成新页。该测试仍不替代设备像素。
3. 冷启动两种顺序（viewport-first/chapter-first）、分页/连续两种模式、连续重测、错误恢复的 target/origin 分支；pending reflow 时不得在 measuring 后发旧 ready。
4. observer 抛错、observer 同步退出、onChapterCommitted 同步新选章、ready 后窗口重排；保留已提交数据，不发旧会话 ready，不残留/重复预取。TTS warmup 仍晚于业务 observers，生命周期与幂等规则保持。
5. 当前章 prefetch 持有最终 preparation generation；故意推进新 generation 或退出后旧请求仍被拒绝。不通过删除 guard 让旧请求“成功”。
6. 若同时统一 prepared promotion 的合同：reverse-page 复用、slot identity、Native opaque terminal/回执等待、回滚、快速反向、observer 抛错分别保持，不增加 remount。

可复用现有 `test-reader-first-page-sdk.mjs`、`test-bookshelf-reading-entry.mjs`、`test-reader-page-preparation-runtime.mjs`、`test-reader-control-selection-transaction.mjs`、`test-reader-tts-quick-preparation.mjs` 及真实 SDK page chrome 链。原方法探针仅补序列与状态，不引入 UI 全局 sleep 或新渲染引擎。


## 已授权实施回执

root 随后明确授权本切片，已修改 LRE 三个调用点和两项正式测试，未改其他生产模块。上述“只读建议”保留为决策记录；此节说明实际完成范围。

- `completeFirstPage`：真实 Core 提交/anchor 核对和页数据就位后，先调用原有 schedulePageTurnPreparation 发布 revision，再通知 observers；随后才预取/消费 rapid、auto、deferred remeasure。既有 preparation 只执行一次。
- `reconcileFailedControlSelection`：在已核实 target/origin 显示页恢复后先发布，再保留原选中交易/失败说明及通知。不重写 Core，不把原页恢复变成目标跳转成功。
- `promotePreparedPageTurn`：先完成 preparation generation、反向预备页、logicalPromoted、物理 slot 交换及最终 revision，再发通知和下一章预取。保留双 slot 身份和现有 Native 终帧回执协议。
- notifier 接收调用者捕获的 page/selection/lifecycle，检查 phase=ready 和现有稳定页面归属。commit observer 或 chapter observer 同步退出、换选择或启动重测时，不发旧 ready，也不再为旧页预取/启动后台工作。各 observer 及可选 TTS warmup 调度抛错继续隔离，已提交正文/位置不会因此被标成失败。
- 现有 onReadingReady 注释已明确“owner 已发布 page/slot revision”，没有把它提升为 native delivery/paint fence。

正式新增 `tools/test-reader-reading-ready-publication.mjs` 执行当前未改写生产方法、从源码读取的真实 DTO 类及现有 selection policy，**44 个场景通过**：分页/连续首屏、target/origin 恢复、正反向 prepared promotion、Core 未返回/拒绝/anchor 不符/过期、三路径各 observer/TTS 异常、commit/chapter 回调退出/换章/重测，以及三个旧顺序负对照。预取的真实 requestPageTurnChapter guard 现在拿到最终 generation，后续真正换代仍拒绝旧请求。三个负对照只写 /private/tmp，分别证明旧 first/recovery 顺序和提前 slot ready 不满足原断言。

既有回归通过：`test-reader-first-page-sdk.mjs`、`test-reader-cold-entry-recovery.mjs`、`test-reader-page-preparation-runtime.mjs`、`test-reader-page-turn-pipeline.mjs`、`test-reader-control-selection-transaction.mjs`、`test-bookshelf-reading-entry.mjs`、`test-reader-tts-quick-preparation.mjs`。最后一项保持实际 SDK 首帧/真实准备链，fixture 补充与生产一致的当前 page/selection 身份；第一次旧负对照仅匹配原独立调用行，新增 try 包装后没有删掉目标调用，错误注入未生效导致测试失败。已改为删除唯一的精确调用并断言唯一性，没有放宽期待失败的断言；原失败日志 `reader-ready-tts-negative-fixture-failure.log` 保留。

代码/测试哈希、范围、44 场景数及边界在 `reader-ready-publication-repair-receipt.json`。最终输出 `reader-ready-publication-final.log`、`reader-ready-tts-final.log` 及对应七项日志。`git diff --check` 通过。

**此次闭环仅为可独立证明的发布、通知和预取顺序。没有声称前述 VM PNG 的根因被确认，没有执行新的 VM/真机验证、Native/HAP 构建或 Git 提交。** 原生实际接收/绘制与该瞬态是否相关仍保留原证据边界。
