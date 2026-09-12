# 当前仿真翻页 Native / Host 审计

- 核查日期：2026-09-10。
- 核查范围：本地当前工作区源码与本地可执行测试；未访问设备，未安装 HAP，未修改业务代码。
- 仓库：`/Users/minliny/Documents/Reader/Reader-for-HarmonyOS`。
- HEAD：`35f2f99a8d635615475fde75120bf8629f944565`；分支：`codex/appearance-progress-axis-20260904`。
- Native、ArkUI Host 等文件有未提交修改，因此 HEAD 不能独立标识本次受检源码。以下行号以此次读取的工作区为准。
- 本文“已修”仅指源码修复与所列本地测试；没有将其等同于设备无闪烁或跟手验收。

## 1. 可直接纳入综合报告的结论

透明初始化帧、清理时提交透明 buffer、阴影混合降低 framebuffer alpha、提交后过早清理 Native 终帧等原始入口已有明确修复。当前代码仍未形成可证明的端到端呈现屏障：Native 的 `FRAME_PRESENTED` 只是成功提交 EGL buffer，ArkUI 的确认只是 Watch 后的帧回调，而且仍有按双帧数直接隐藏的并行路径。同一次拖动在松手提交、回滚时还会重复隐藏 Native。

跟手问题仍有确定的实现来源：24ms 主动回退时间线、非页缘起手追赶、准备失败后整次指针流拒绝呈现、最终 MOVE 与 Settle 不原子、240–600ms 收尾且禁止再抓取。这些均可由当前源码确认，但不能由源码直接给出设备触摸到显示的实际延迟。

下一轮应先修事务与交接语义，再修连续输入和准备链，最后按 trace 优化上传/GPU。不要继续用增加等待帧数处理残余闪烁。

## 2. 原透明帧修复状态

### 已修：明确的透明提交入口

1. `entry/src/main/cpp/bookturn/bookturn_renderer.cpp:352–361`：初始化只清 back buffer，不执行 `eglSwapBuffers`。不再在纹理尚未准备时提交透明/黑色初始化画面。
2. 同文件 `:530–540`：`ClearSurface()` 只清 back buffer，不 swap；下一次成功 Draw 覆盖后才提交。
3. 同文件 `:502–517`：全屏底页不混合，阴影使用 `glBlendFuncSeparate(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA, GL_ZERO, GL_ONE)`，保留目标 alpha；运动纸页最后绘制。`Draw` 的透明 clear 本身不是又一个独立透明可见帧，因为完整底页随后覆盖，且中途没有 swap。真正完整像素 alpha 仍需真实 GL/设备图像验证。
4. 同文件 `:488–490`：提前换槽后静态终帧关闭 Native 专用 gutter，减少其与 ArkUI 纸面的交接差异。

### 已修：释放与清理分离、终帧保留

1. `entry/src/main/cpp/bookturn/bookturn_host.cpp:213–247`：Release/Clear 是两个 API；都有 generation 相关门槛。
2. 同文件 `:703–745`：Release 仅关闭 hold，不直接清屏；Clear 在 worker 再次核对 generation、hold 已关闭后执行。
3. 同文件 `:1031–1042` 与 `:1051–1058`：提交和回滚端点都保留终帧。
4. 同文件 `:635–670`：正式槽提交不再清屏，处理早换槽与正式提交的重复旋转。
5. `entry/src/main/ets/features/reading/BookTurnPresentationSession.ets:105–122` 已有对应 retain/release/clear 桥。
6. `entry/src/main/ets/features/reading/ReaderBookTurnSurface.ets:8,21` 已有 surfaceOpacity，保持 XComponent 组件挂载。

### 部分修复：首帧可见性握手

1. `entry/src/main/ets/features/reading/LocalReadingExperience.ets:2009–2018`：只有匹配 surface generation 和活动 phase 的首帧事件才显示 Native。
2. `entry/src/main/cpp/bookturn/bookturn_host.cpp:925–944`、`:1021–1023`：首帧事件在 Draw 返回成功后发出。
3. `entry/src/main/cpp/bookturn/bookturn_renderer.cpp:491–495,518–522`：Draw 成功的依据是 `eglSwapBuffers` 成功。因此事件实际上证明“buffer 已提交”，不证明“屏幕已合成并显示”。建议修正事件语义名为 FRAME_SUBMITTED，真正 present 另以项目 SDK 实际可用信号验证。
4. `LocalReadingExperience.ets:9102` 与 `:8995`：提交、回滚收尾都设置 opacity=0，即使沿用同次已显示拖动的 generation。Native `bookturn_host.cpp:612` 同时重置首帧通知 latch，再发一轮回调才显示。该切换是确定的多余交接，不是已实测的某个毫秒值。

### 部分修复：ArkUI 终帧交接

1. `ReaderPageTurnStage.ets:141–147` 的 onPresented 只是 `@Watch` 后 `postFrameCallback`，没有图像/解码/合成器 present 证明。
2. `LocalReadingExperience.ets:9305–9309` 虽校验 render revision，但 `:9312–9325` 同时有双帧回调路径，不等待该 revision 回执就调用 confirm。因而不能声称已经完整替换固定帧数屏障。
3. `LocalReadingExperience.ets:9276–9295` 隐藏、下一帧 release/clear 的顺序已实现，但“该帧已真实显示”的语义仍依赖上述假设。
4. `LocalReadingExperience.ets:2036–2051` 在 SLOTS_COMMITTED 立即调用 finishSuccessful；`:9335–9346` 随即解除输入/settlement、恢复 deferred/rapid/preparation，而清理屏障尚未结束。部分旧回调有 generation 防护，但资源准备和显示事务仍不是一个不可分割交接。需要用新手势接管与旧清理同时到达的行为测试验证。

### 部分修复：generation 防护

旧 release/clear 和 surface 生命周期防护明确存在，现有 barrier 测试覆盖了迟到 release、detach/re-attach、重排等场景。不能因此概括为“所有命令已防陈旧”。`bookturn_host.cpp:158–166` 的 Settle 没有当前 transaction 所有权校验；`:183–195` 的 CommitSlots 只在入队前检查 retained generation，worker `:635–648` 实际旋转前没有相同的 generation 再验证。若 API 命令被接受后新输入先被消费，这一层缺乏最终门槛。当前 UI 是否能触发全部乱序组合需要专项测试；这是 Native 协议防御缺口，不是已复现用户故障。

## 3. 不跟手：未修或仅局部缓解的路径

### A. 主动滞后和起手追赶：未修

- `bookturn_motion.h:15–25`：页缘带 12vp；固定 `kPresentationDelayNs = 24'000'000`。
- `bookturn_motion.cpp:71–84`：以 frameTime 减 24ms 插值最近两个样本。
- 同文件 `:111–158`：只有页缘起手满足门槛后直接对齐；内部起手仍按 FAST/NEAR/LOCK 追赶。
- 结论：两层算法都可能增加手指与纸边的相位差。不能直接把常量相加当作真机端到端延迟。
- 修复：默认最新有效样本；抓取锚点+位移 1:1，中央起手不把纸边瞬移到触点，也不保留长距离追赶。若未来需要低采样率平滑，必须先取得基线，再评估有边界的短预测；不能用预测遮盖队列积压。

### B. 准备失败后整次拖动无呈现：未修

- `ReaderPageInteractionLayer.ets:243–256`：所有权首次判定时 canStartTurn 失败就 pointerRejected=true。
- 同文件 `:210–226`：之后 MOVE 仅更新内部手势状态，不再向呈现 Host 发状态。
- `LocalReadingExperience.ets:8519–8524`：邻页准备只在手势 idle 开始。
- `LocalReadingExperience.ets:2108–2136`：纹理捕获要求 page phase ready、无 pageTurnPreparation、翻页输入 idle，且同 identity 直接复用。
- 修复：pending gesture 保留唯一 pointer 的最新样本；资源准备完成、指针仍在时从当前样本接入，同次手势不能永久判失败。端点/取消到达后不得再复活。

### C. 最终输入与松手命令不原子：未修

- `bookturn_host.cpp:147–166`：UpdateInput 和 Settle 是两个 mailbox 命令。
- 同文件 `:530–537`：pendingSample 虽已取出，只要 pendingSettlement 不为 NONE 就被丢弃。
- 同文件 `:614–620`：收尾从旧 pose.tau / theta 开始。
- 修复：增加包含最终有效 sample 的 endGesture，render thread 在同一命令内先消费最终样本并求得交接姿态，再开始收尾。MOVE 可以合并，DOWN/UP/CANCEL 与事务命令不能被覆盖。

### D. 收尾与再抓取：未修

- `bookturn_motion.h:26–27`、`bookturn_motion.cpp:167–170`：600ms 全程，手动收尾最短240ms。
- `bookturn_host.cpp:534–537`：收尾期间输入被丢弃，当前不支持直接抓住运动中的纸页。
- `bookturn_host.cpp:982–997`：tau_swap 提前旋转槽并隐藏 sheet。
- `bookturn_renderer.cpp:566–575`：CommitSlots 同时 Invalidate 远端纹理；`:553–563` 的 Undo 仅逆交换，无法恢复已失效的 ready/identity。即使 GL 纹理字节仍在，也不等于事务资源可以可靠复原。
- 修复顺序：先固定本事务 source/destination 资源引用，几何过程只改绘制绑定，正式提交后再旋转ring与回收；再开放再抓取。提交前由当前 pose 继续，提交后新手势从新当前页开始，不能撤销已确认阅读进度。
- 保留普通点击600ms作为单独产品规则；手动收尾按剩余距离和可信释放速度另拟参数，不应为了减少停顿静默改变所有触发类型。

### E. 准备借用当前章节状态：部分隔离

- `LocalReadingExperience.ets:8673–8700`：捕获 origin 后，把 targetContext 恢复到共享的当前 materialized context，再启动测量。
- 同文件 `:8701–8708`：测量失败会恢复 origin；`:2455–2464` 当前页呈现投影也在准备时优先使用 origin。
- 这已经防了若干“目标章冒充当前章”问题，但仍通过全局状态借道，因此必须把准备限制为 idle，不能自然在拖动时完成。
- 修复：独立、不可变、按内容版本/布局版本键控的 preparation job；不通过修改 live chapter/phase 完成邻页测量。

## 4. 性能和资源：保留有效基础，补真实预算

### 已有基础

- 四 GPU 槽已经存在：`bookturn_renderer.h:16–20` 是 previous/current/next/staging；`bookturn_renderer.cpp:413–435` 在 staging 上传后换句柄。
- NAPI 像素上限已存在：`bookturn_napi.cpp:20,174–180`，每页不超过3,000,000像素；`LocalReadingExperience.ets:2210–2219` 在 ArkUI 快照缩放时预留了取整余量。
- EGL context 随 surface 生命周期保持，不是每帧创建：`bookturn_renderer.cpp:594–604`。
- 固定 mesh：`bookturn_renderer.h:90–93`；初始化时 `GL_STATIC_DRAW`：`bookturn_renderer.cpp:685–719`。
- 活动帧保持底页/阴影/运动页最多3次绘制：`bookturn_renderer.cpp:499–517`。现测 GL-state 测试通过。
- Native VSync 在手势期间持续推进：`bookturn_host.cpp:284–301`。不能把现在的问题简化为“渲染仍只跟随 MOVE 事件”。

### 待优化的确认机制

- `bookturn_napi.cpp:177–180` 同步 ReadPixels 到 CPU payload；发生于调用该 NAPI 的线程，当前 ArkUI 直接调用 uploadTexture。这是准备期同步复制，不是每次MOVE都会复制。
- `bookturn_host.cpp:500–511` 在处理输入/绘制之前批量上传所有 pending payload；`bookturn_renderer.cpp:281–329` RGB压缩与 GL上传占同一 render thread。若与活动帧重叠就会争抢，具体耗时需trace。
- `bookturn_host.cpp:141` 入队刷新就清 ready bit，已完成旧纹理和待上传新纹理未形成独立版本。应固定活动事务纹理，更新只影响后续事务。
- 36MiB是旧合同的四槽 RGB8 页面纹理探针，不是进程内存峰值。四张3M RGB8逻辑存储为36,000,000字节（约34.3MiB），还需计 GPU实际对齐/格式、EGL交换链、原始PixelMap、ReadPixels副本、待上传payload、离屏组件/图片解码。RGB565输入转RGB8还会分配另一buffer（renderer.cpp:290–304）。不能用四槽字节数证明内存通过。

### 文档矛盾：必须修订

- `docs/BOOK_PAGE_TURN_CONTRACT_V2_2026-08-29.md:212` 仍规定普通程序化完整翻页600ms。
- 同文档 `:309` 仍继承平均≥4.5页/秒。
- `docs/BOOK_PAGE_RAPID_TURN_CONTRACT_2026-08-31.md` 第1/2/3节不改时长、单页串行并等待完成屏障。
- 同类完整程序化页按600ms串行，纯动画理论上限约1.67页/秒，额外提交/准备只会降低；这不是设备测试值。必须明确 normal/rapid 分别适用的时长和吞吐规则，或正式废弃不兼容的旧吞吐目标。

## 5. 首终帧画面一致性：不能遗漏

1. gutter已在静态提交底页路径关闭，但首次卷页、回滚、反向、夜间主题、图文页是否与底层ArkUI逐像素一致，GL mock不能证明。
2. 当前上传把像素作为GL_RGB8，NAPI读取pixel format而未取得/约束颜色空间；EGL window surface使用空属性列表。没有端到端色彩空间一致性证据。不能因此直接断言发生色差；应以同页静态ArkUI与Native帧作差分。
3. `bookturn_renderer.cpp:846–855` 的 SetThemePaper 在生产Host/NAPI没有调用，当前只在render测试使用。应核对是否需要主题纸色fallback及其适用条件；不能把测试API存在当作主题链已接入。
4. 动态高亮存在确定的缓存语义不一致：`LocalReadingExperience.ets:2146` 对CURRENT捕获live组件；`ReaderPageTurnStage.ets:261–264` 的live组件含TTS/AutoPage高亮。邻页的 `BookTurnTextureBuilder.ets:15–17,43–59` 刻意不含动态高亮；`LocalReadingExperience.ets:2549–2570` 的textureIdentity也不含高亮revision。因此CURRENT可能冻结捕获时的高亮并被复用，与邻页及活跃ArkUI不一致。应统一静态纹理来源和高亮覆盖层策略，再做运行中翻页差分。设备上具体闪烁仍待证实。

## 6. 本轮现测结果

均针对当前工作区执行，均通过：

| 本地验证 | 结果 | 证明边界 |
|---|---:|---|
| `node tools/test-reader-book-turn-native-core.mjs` | 235 checks / 0 failures | 纯solver几何与连续性，不含设备输入与GL |
| 原生 `bookturn_motion_test.cpp` | 264 checks / 0 failures | 验证当前追赶/24ms/240–600ms等既定算法，不证明这些算法跟手 |
| 原生 `bookturn_render_state_test.cpp` + GL mock | 358 checks / 0 failures | GL命令状态、四槽、透明清理不swap等，不是像素渲染 |
| 原生 `bookturn_present_barrier_test.cpp` + Host/GL mocks | 131 checks / 0 failures | 提交/回滚、stale release、终帧保留、detach/re-attach、重排 |
| `node tools/test-reader-book-turn-motion.mjs` | PASS | ArkTS motion契约 |
| `node tools/test-reader-book-turn-architecture.mjs` | PASS | 架构/源码断言 |

本轮编译产物仅写入 `/tmp/bookturn_motion_report_test`、`/tmp/bookturn_render_report_test`、`/tmp/bookturn_barrier_report_test`。没有新HAP构建/安装、设备接触延迟、真机帧率或用户视觉验收结果。

## 7. 建议优化与验证顺序

1. 修订冲突合同并定义一个transaction边界，区分surfaceEpoch、transactionId、inputEpoch、textureRevision；业务提交结果未知不按失败强回滚，先对账。
2. 修首终帧语义与同次拖动不隐藏；保留已有效的终帧/透明清理防线，撤掉“固定多等帧就是已显示”的假设。
3. 固定事务纹理引用，修原子最终样本命令；允许提交前再抓取，从当前pose接续。
4. 默认最新样本与抓取锚点位移映射，手动收尾单独设计；普通点击时长与rapid吞吐分别定义。
5. 准备job不借live context，支持pointer仍在时接续；活动纹理与待上传版本分离，上传在帧预算之外限量执行。
6. 统一静态纹理、动态高亮、主题纸色/书沟/颜色空间交接，再进行图像与内存对照。
7. VM先验证功能和乱序场景；真机仅在后续明确安排时做最终触摸/帧率/视觉验收。本轮不接触设备。

必补行为用例：最后MOVE和END同轮；END之后迟到MOVE；中央/页缘起手；输入8/16/25ms间隔及抖动；停住/反向；慢准备后仍按住接续；收尾各阶段连续再抓取；早swap前后回滚；A事务清理与B事务首帧交叉；主题/尺寸/章节版本变更；反向连翻、跨章、首尾边界；TTS/AutoPage高亮移动中翻页；连续100页与内存峰值；持久化已成功但回包晚。

测量必须贯穿同一单调时钟/样本序号：输入接收→Native消费→求解→swap提交→实际present；分开报告input-to-submit与真实触摸到屏幕。旧合同p95≤25ms、p99≤33ms、首帧1VSync等只列为待测目标，不能由本轮测试宣称达到。现有Host wake/solve/draw诊断缺少完整输入样本关联与真实present，需补齐后再判断瓶颈和达标情况。
