# VM 详情进入阅读的空正文瞬态：代码只读复核

本条记录新观察窗口，不称稳定白屏，也不把“17:34:17 已有正文”解释成空白持续了 17 秒。root 提供点击时间 17:33:59.679、截图调用窗口 17:33:59.852—17:34:00.042，前后相对点击约 173—363ms；PNG 只是这一调用中某一时刻的图像，不能证明整个 190ms 区间都为空。17:34:17 控制栏图已有正常正文，中间无连续帧。

当前源提交 `aa387f08dceef4592c6bf642ca7bd351de1b0f8c`，HAP run `20260914T171802Z-aa387f08-71c7172c`，signed SHA256 `720e4709979005f8dc785c768bcb76208a8ea6ebcc250a05dfa88a818861cc98`。源/图像哈希和原始路径见 `reader-entry-transient-receipt.json`。本 agent 只读取已存在截图和源码，并运行普通生产方法探针；没有操作 VM、Git、HAP 或生产文件。

## 准入链：正文测量/持久提交没有被跳过

- `Index.ets:3554 openReading` 只设置 `readingSessionActive=true`，明确保留详情/书架原路由，没有直接赋 reading。
- `Index.ets:984` 开始挂载 ReaderShell；`visible` 仅 reading 或合法阅读目录路由成立，Shell `:223` 以 opacity 0 隐藏。`ReaderShell.ets:110` 说明隐藏仍须真实 viewport/TextController 测量，不能改 Visibility 让测量失效。
- `LocalReadingExperience.ets:2947 loadInitialChapter` 等 TOC、进度和布局快照后调用 openChapter；`:3163 openChapter` 等实际非空正文、版本/位置保护与内容指标，再开始真实 viewport 对应的分页测量。当前没有名为 `onChapterMaterialized` 的对外准入回调。
- `:4391 completeFirstPage` 必须先完成 `resolveAndUpdateProgress` 并核对 Core 章节/offset；随后设置 visiblePage、visibleFragments、ready，再调用 `:9679 notifyControlSelectionReadingReady`。
- `Index.ets:3661 presentPreparedReading` 才把路由改为 reading。因此不能将此图解释为“还没拿正文/还没分页或持久提交就直接进入阅读”的现有业务路径。

## 确认的时序边界：业务 ready 先于呈现版本交付

`completeFirstPage:4440` 先发 onChapterCommitted/onReadingReady；其后 `:4442 schedulePageTurnPreparation` 才在 `:9937` 增加 `pageTurnRenderRevision`。注意这个递增在**同一任务的后续同步调用**内完成，不能遗漏它并宣称正文只能等下次时钟/打开控制栏才更新。

`ReaderPageTurnStage.ets:377 refreshRenderPages` 只在 `contentRevision` 变化时重新读取 provider；旧版本已经缓存空 page 时，在新版本交付前会继续返回旧空 page。`onReadingReady` 当前没有等待这个新版本实际到达 resident slot，亦未等待任何 frame 回执。`:155 onRenderRevisionChanged` 的 slot content callback 和 postFrameCallback 是另一个阶段；源码明确其不是物理 scanout 证明。LRE `:11069/:11091` 的回调服务翻页/Native 交接，并不阻挡初次 route ready。

本机探针调用未改写的 `Index.openReading/presentPreparedReading`、`LRE.completeFirstPage/notifyControlSelectionReadingReady/schedulePageTurnPreparation` 与 `Stage.refreshRenderPages/currentRenderPage`：

- ready 回调瞬间：Core 模拟提交 1 次、phase=ready、owner 有 1 段正文；路由=reading，owner revision=5，Stage 仍缓存 revision=5 的 0 段旧 page。
- completeFirstPage 返回时：revision 已变为 6；显式交付数字 revision 后 Stage 立即取得 1 段，无需再次取章或读 Core。

原始探针及输出为 `reader-entry-transient-probe.mjs/.log`。它确认调用先后、缓存合同与缺少首屏呈现交付屏障；Core 持久请求由有界 fixture 返回，响应式 scalar 交付由 probe 明确驱动。**它不模拟真实 ArkUI 批处理、父子刷新时机或 compositor，所以还不能单独证明本次 PNG 就是该竞争造成。** 通常同任务合批可能消除可见间隙，本次缺少最终 source revision 与 frame 时间的对应日志。

## 既有登记及结论范围

既有 `READER_REPAIR_SPEC.md:411` 要求无可读缓存失败时保留详情，`:594/:732` 保留真实首屏提交门禁；LRE `:993` 已写明只有测量+Core 写入后才允许 reveal，`:891/:914/:1649` 明确没有 Figma 批准的新视觉 loading/error 状态。工程存在 6 秒测量、30 秒初始 ready watchdog，但它们是失败恢复边界，不能作为允许提前露出空阅读页的设计依据。

`test-bookshelf-reading-entry.mjs:112/:166` 检查准备时保留原路由和迟到 ready 不覆盖 Back；`test-reader-first-page-sdk.mjs` 验证 viewport/章节到达顺序、失效选择和真实 SDK 成员转换。这些测试不是初始路由与 native 首屏同帧的证明。此次有限检索未找到把“ready 先于 native page revision 到达”单独登记的条目，建议 root 将本观察并入初次呈现交付缺口，保留本窗口与后续正文恢复事实。

若后续修复，最小方向是首先让当前正文呈现版本在 ready 通知前发布，并把初次 reveal 绑定到同 lifecycle/selection/page/revision 的现有内容交付回执，而非固定延时、重挂载或自行设计加载界面。翻页模式的 resident slot 回执与连续滚动模式的就绪合同必须分别核对。当前授权仅审计，本轮没有改动实现；是否存在可见帧竞争及真实持续时间仍是此次 VM 捕获未能回答的边界。
