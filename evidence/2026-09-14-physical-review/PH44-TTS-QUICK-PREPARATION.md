# PH44 朗读快捷控制页进入后才初始化

## 现象和证据边界

- 用户审视的已安装包：`643bcaf5`，安装回执 `20260914T002543Z`；原话“朗读快捷控制栏，点击进去后播放组件才初始化”，登记于 `FOLLOWUP_43_47.md`。
- 本轮先检查当前生产源码、实际调用链和既有测试。未操作真机、VM、HDC，未构建、安装或提交。本文不把本地方法/SDK 通过写成真机通过。
- 有依据的直接原因是业务状态和资料在进入朗读模块后才开始准备。尚无画面/trace 能把用户看到的每一帧归因于引擎初始化耗时；不声称平台引擎错误或图像解码错误。

## 当前源码定位

1. 修复前 `LocalReadingExperience.prepareControlPage` 只有在模块进入 `moduleTts/fullTts` 时才调用 `initializeTtsSession`。`aboutToAppear` 和首个正文持久提交/ready 均没有 TTS 预备。父层初值是 `createReaderTtsState(false)`、默认 1.00x、空音色/HTTP 列表。
2. `ReaderTtsSessionCoordinator.probeAvailabilityInternal` 发布 `uninitialized → probing → idle/unavailable`，读取保存配置并选择/检查 Host；LRE 直到 probe 完成才投影保存引擎和语速。`ReaderControlTtsContent.playbackLabel` 因此在已经显示的 Quick 内经历“未开始 → 检查中 → 未开始/不可用”，保存语速也随后更新。
3. `loadTtsPresentationMetadata` 原先串行 `HTTP list → Preferences → system voices`，最后才一次投影全部资料。慢 HTTP 或音色枚举会让已经取得的保存偏好继续等待。
4. `ReaderControlPanel.controlContent/ttsModuleContent` 的确按业务模块挂载 TTS，但 `ReaderControlTtsContent.normalContent/playback` 在第一次 Builder 内直接包含播放区、波形和四个按钮，没有等待可用性或 Promise 才创建它们的分支。不能把本问题描述成“音频引擎准备后才创建播放组件”；进入模块时正常创建树，与进入后才读取界面状态是两个事实。
5. 原始业务链的静默检查：`HarmonySystemTtsHost.probe` 只到 `ensureEngine`；音频竞争/媒体会话在 `activateAudioSession`，声音在 `speak`，Core 队列在明确 `start` 后。预备允许静默创建引擎对象，不允许播放、抢音频、改变系统音量。

## 已实施

- `LocalReadingExperience.ets:5818` 新增 `scheduleTtsPresentationWarmup`：已持久提交的正文 ready observer 返回后，在下一次平台 FrameCallback 仅安排一次预备。初始正文获取/分页/持久提交不 await TTS；100 次 ready/翻页通知也只产生一个待执行回调。普通首屏入口通过 `notifyControlSelectionReadingReady` 接线（约 9506 行）。
- 已有 TTS coordinator 或已合并的 initialization Promise 直接复用。活跃、暂停中的朗读会话不会因新 ready 通知重新 probe、重建 coordinator、清空队列或改变状态。Quick/Full/再次进入模块共用同一初始化结果，不创建第二套播放业务路径。
- `initializeTtsSession` 及其回调同时检查生命周期、sourceId、bookId、coordinator 身份；退出/换书/旧回调不发布状态。进入 TTS 与后台回调相遇时仍由同一个 Promise 合并。
- `loadTtsPresentationMetadata` 的三个独立读取同时开始，结果分别及时投影；音色可后到，已读取的偏好不用等待在线服务列表。仍在途的资料请求在显式重试时复用。
- 初始配置读取捕获 `ttsConfigMutationGeneration`，真实语速/引擎修改递增；后到初始化配置不覆盖用户新选择。偏好读取使用已有 preference generation；HTTP 列表只覆盖原列表身份，不能抹掉在途读取期间已保存的新服务。
- 预备失败停在可见“不可用”，不自动循环重试；Quick/Full 同一播放按钮有“重试朗读”可访问语义。只有用户明确点击才重试可用性并继续原 `toggleTts` 意图链，胶囊仍即时接收显式意图，音频仍等待真实准入。
- `ReaderControlTtsContent.ets:600` 仅改变 unavailable 的重试可达性，不改播放卡几何、颜色、动画、波形计时，不在每帧写父状态，不在后台挂载一套隐藏完整播放树。

## 回归与失败记录

新增 `tools/test-reader-tts-quick-preparation.mjs` 使用 SDK AST 提取的原样 LRE 方法、真实 `ReaderTtsSessionCoordinator`、边界 fake Host/Core，以及 SDK 实际生成的 Builder observer：

- ready observer 先完成，下一帧预备；100 次通知只一份任务；反向删除 ready 接线的负例必须失败，能够捕获原遗漏。
- 预备 Core 调用只有 config；Host 只有 engine select/probe；没有 activate、speak、stop、媒体发布或 queue.play。
- HTTP/偏好/音色同时起读；其中两个仍挂起时另一个已发布；模块重入不重读配置。
- 在途 frame、config、metadata 的退出/换书/换生命周期/换 coordinator 禁止旧发布。
- 真实 changeTtsRate 抢先执行后保留 1.50x，不被旧 0.75x 覆盖；旧偏好和服务列表不覆盖新选择。
- 已有真实 playing coordinator 不被 ready 重置；失败显式重试复用 coordinator 与仍在途 metadata。
- SDK 首次 Quick Builder 已有状态文字、播放图标和可点击按钮；probing/idle/unavailable 通过保留的 observer 更新，观察节点数不增加；失败状态可点击重试。

既有 Host 意图测试补上“失败预备 → 显式播放重试 → 成功后只 start 一次”，保留 7 个异步准备点取消/暂停测试。原 product/preference 静态断言要求串行 `await load`，本次改为验证独立 Promise 读取，并用上述实际方法测试保证行为；未删保存偏好契约。新 SDK 探针首次因遗漏注入已有常量/geometry 函数失败，补齐真实依赖后通过，非生产故障。

最终 11 组定向测试均通过，完整 stdout/stderr、文件摘要及记录时间见 `ph44-local-regression.json`。包括新 PH44、product surface、playback content、Host intents、config interaction、navigation performance、coordinator、7 点 launch intent、preferences、waveform、audition。

## 剩余证据

- 生产修复和本地回归已完成、生产冻结。整合 ArkTS 编译/HAP/安装由主任务执行，本子任务没有这些证据。
- “用户迅速打开朗读页时平台尚未返回”仍应显示真实检查中/不可用，不能伪造已准备。后台预备减少可见后的初始化等待，不承诺外部平台可用性调用为零耗时。
- 真机首入的实际可见时序、音频硬件表现和用户验收未验证；不能把 fake Host 的零音频调用检查等同于平台音频验收。
