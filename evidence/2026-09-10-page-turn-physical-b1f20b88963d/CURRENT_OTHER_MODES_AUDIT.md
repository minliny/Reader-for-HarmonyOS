# 其他翻页模式与共用状态机：当前遗留问题复核


> 并行修改后的复核已完成：本报告 14 项结论与证据等级未改变，现有 8 条本地 mock 情景仍全部复现。正文行号保留初查快照；当前源码请使用末尾“并行修改后的定点复核”方法定位表。

日期：2026-09-10。范围：slide、cover、none、continuous/scroll 及共用输入、快速翻页、进度保存状态。不访问任何设备，不修改业务源码。本文不重复仿真专属 Native 渲染问题。

## 证据边界

- **L：本地已复现**——从当前业务文件提取真实方法，在 Node 中使用受控 mock/fixture 执行。证明给定输入下的方法行为；不等于 ArkUI、Core 集成或设备复现。
- **S：源码已确认**——当前代码明确采用该行为；可见程度、耗时和平台后果仍需 VM 验证。
- **R：运行风险**——源码存在缺口，但平台可能提供部分补偿，或需要特定时序才能触发，尚不能声称已经复现。
- **V：录像独立症状**——来自本次原始录像/截图，不据此推断根因。

复跑入口：`node evidence/2026-09-10-page-turn-physical-b1f20b88963d/other-modes-probe.mjs`。主文件复制原安全提取 fixture，追加导入 `other-modes-extra-probe.mjs`。执行结果在 `other-modes-probe-output.log`，exitCode=0，8 条情景断言通过。断言通过表示缺陷情景如预期被复现，**不是产品验收通过**。当前受查文件摘要保存在 `other-modes-source-sha256.json`。探针没有启动或操作设备。

## 逐项结果、修复机制与验收

### 1. slide / cover 冷准备期间，本次手指不能重新取得呈现权

**等级 S。** [LocalReadingExperience.ets:8730](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:8730) 的 canStart 要求 canTurnPage 与 prepared 同时满足；canTurnPage 在准备或 Core 写入期间为 false（9823–9829）。[ReaderPageInteractionLayer.ets:243](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderPageInteractionLayer.ets:243) 一次门禁失败便置 pointerRejected，后续 MOVE 只更新内部状态（210–226），没有 readiness 改善后的重新准入。UP 才产生 onTurn（305–329）。Local 准备队列仅在 gesture idle 时执行（8519–8524）；其拖动 gate-miss 入队分支不能代表输入层所有拒绝情形均已立即触发准备。

复现：冷进入/改字体后立刻按下，邻页尚未准备；保持按压直到邻页准备完成，再继续拖动。当前行为仍不移动，UP 后可能开始程序翻页。修复：预热当前与相邻真实页；给 pending pointer 明确的 preparing 状态与唤醒条件，准备过程不得临时替换当前可见上下文。若允许同次手势迟到接入，只能在仍为静止当前页时以当前手指坐标重设阈值与原点，丢弃历史位移；进入运动后冻结可见页对，禁止中途换页。验收：冷/热准备、跨章、反向、准备失败分别记录 ready→准入→首个呈现时序；无占位书页、无接入跳变、取消不产生迟到翻页。

### 2. slide / cover 收尾中重新抓住，实际是等待旧事务完成

**等级 S；不支持重抓是当前确定行为。** [LocalReadingExperience.ets:7244](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:7244) 对整个 visual/Core settlement 设 tapOnly。[ReaderPageInteractionLayer.ets:158](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderPageInteractionLayer.ets:158) 把新手势作为 presentation-silent pending segment；旧事务结束后才在最新坐标重新 start（609–625）。平移动画与持久化并行启动（Local 9133–9134），并等待两者完成（9231–9234）。

复现：点击翻页，移动到一半时按住并反拖；旧动画继续，手指没有接管当前页面。修复：将可中断的呈现收尾与业务写入阶段分离；统一可读取当前呈现进度的控制器，DOWN 从实际呈现值接管，不能把 animateTo 已赋值的终点当作屏上位置。尚未派发持久化的事务可回退；已经确认写入的事务按已提交页开启下一事务；结果未知时执行第 9 项协调。验收：在收尾 10%/50%/90% 处重抓、反向、再次放手，位置和速度连续，提交恰好一次，不重放完整旧拖动。

### 3. slide / cover 最终 UP 参与方向判断，但没有应用到呈现坐标

**等级 L。** [ReaderPageGestureState.ts:118](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderPageGestureState.ts:118) 正确采样 UP；但 [LocalReadingExperience.ets:8796](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:8796) 仅 dragging 分支更新 offsetX。UP 已变为 settling，commit 和 rollback 均从上次 MOVE 的 offset 开始（8815、9155–9172）。本地探针：最后 MOVE=-80，UP=-200，decision.currentOffsetX=-200，而 presentationOffsetX 仍为 -80。

修复：在同一结束事件中先应用最终合法样本，再根据该样本启动收尾；方向、剩余距离和实际呈现位置使用同一值。验收：最后 MOVE 与 UP 大幅不同、UP 回原点、UP 反向越原点、缺少倒数 MOVE，结束时不得先跳回旧 MOVE 位置。

### 4. 共用输入层 tracking 的 UP 被误判为点击

**等级 L。** [ReaderPageInteractionLayer.ets:338](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderPageInteractionLayer.ets:338) 在 tracking 时，先用尚未包含 UP 的 maxDistance 判断 tap，再按 UP 所在区域触发点击；tapOnly 的 tracking 分支同样如此（281–284）。本地探针：宽 390，DOWN x=300，无越阈值 MOVE，60 ms 后 UP x=100。纯 reducer 判 next，输入层却触发 previous。

修复：所有 UP 路径先采样最终坐标，再分类 tap、drag、long press；不能仅以旧 phase 决定是否跳过 reducer。验收：DOWN→UP、大位移只出现在最后 UP、手势采样稀疏、左右/中区跨越，以及相同序列在 tapOnly 模式下均与完整 MOVE 序列一致。

### 5. slide / cover 纯纵向上一页没有拖动呈现

**等级 L。** [ReaderPageGestureState.ts:268](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderPageGestureState.ts:268) 将 |dx|<8、dy≤-24 的手势判为 verticalPrevious；Local 8799 / 8950 仍只把 currentOffsetX 映射到水平页面位置。本地探针 dy=-100、dx=0 已判 previous，页面 offsetX=0。

修复：为 verticalPrevious 定义一致的视觉映射，例如将归一化向上距离映射为上一页水平进度，并与点击/拖动共享收尾；不要保留“认可手势但按压期间完全静止”的隐式路径。验收：纯纵向、略带横向、24 vp 附近、纵向回撤均有连续且稳定的对应反馈，UP 不突然从零开始整页动画。

### 6. none / 减少动态效果：取消后所有权没有收敛

**等级 L。** [LocalReadingExperience.ets:8789](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:8789) 的 none 分支清 offset 后直接 return，先于 rollback 分支。gesture reducer 的 CANCEL 会返回 settling/rollback（ReaderPageGestureState 214–216），回拖 UP 也没有 direction，不会进入 onTurn→completeDirectPageTurnGesture。探针两种情况都留下 phase=settling、inputOwned=true。不是“已经验证永久锁死”：后续新手势或生命周期重置可能解除，但取消没有按契约归还所有权，退出与延后操作可能被卡住。

修复：无动画模式也必须完成 shared rollback transition，立即 complete settlement、释放所有权、排空延后退出/控制操作；视觉为零耗时，状态收尾不能省略。验收：回拖 UP、系统 CANCEL、watchdog、后台、Back 分别落到 idle，零提交，随后点击和退出立即可用。

### 7. rapid 到达已知书边界后留下不可达净目标，反向被吞掉

**等级 L。** [LocalReadingExperience.ets:9518](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:9518) 在调用 performPageTurn 及其 boundary 判断之前检查 prepared，缺页直接返回 preparing；prepare 队列对无 target 仅 continue（8540–8541），没有消费不可能的净目标。实际 reachReaderRapidPageBoundary 仅在 perform 返回 boundary 后调用（9528–9529）。

探针：已知书尾 next→preparing，pendingDelta=1；紧接 previous→busy，净目标归零，performCalls=0。修复：准备门禁前检查已知物理边界，并清除指向该边界之外的请求；边界发现回调也必须完成同一收敛路径，不能把 boundary 与 preparing 混为一类。验收：书首/书尾连点 1、10、100 次后反向一次，应立即移动一页；边界尚未知→异步确认为边界的路径也应一致。

### 8. continuous 保存的 Promise 不代表目标进度已经落盘

**等级 L（退出在途保存）+ S（其余回调语义）。** [LocalReadingExperience.ets:4187](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:4187) 发现 inFlight 后只置 pending 并立即 return；4233 的尾部保存使用 void。finishExit 虽 await 此方法（4114），却不能等待在途及最新尾部保存，探针证实 onExit 已触发而 inFlight/pending 仍为 true。方法 catch 只记日志（4227–4228），返回 Promise<void>，onContinuousScrollStopped 的 then 仍 complete rapid（2311–2319）。该 then 只捕获方向，没有 lifecycle/rapid generation，延迟返回同样不能证明仍属于当前事务。

修复：使用按 canonical anchor/revision 合并的单一保存队列，返回可等待的 drain/flush promise 与明确结果；退出必须等待最新目标已确认，失败/取消/结果未知不得当作成功消费 rapid。回调携带生命周期与事务 generation。验收：A 保存挂起时滚动到 B 并退出；延迟、失败、超时、换章/模式再返回，应恢复 B 或明确报告未保存，不能悄悄恢复 A；旧回调不得消耗新 rapid 请求。

### 9. 2 秒呈现超时不能证明 Core 尚未写入

**等级 S（超时处理逻辑）+ R（持久化结果未知导致 UI/Core 分歧，尚无设备故障注入）。** [LocalReadingExperience.ets:5016](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:5016) 设 2000 ms 截止（常量 874）；当 commitFinished=false 时清 prepared 并 rollback（5042–5048），注释声称“Persistence never started writing”，但实际在动画开始便派发保存（9133–9147、9186–9198）。宿主请求默认超时是 30000 ms（ReaderRuntimeOwner 48、141–155）。

[reader_core.ts:350](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/vendor/core-harmony/sdk/reader_core.ts:350) 先发送命令再等待；等待循环先查 shouldCancel（365），然后才读取已排队结果（369）。失效 guard 可以使宿主放弃接收，但不是已完成写入的撤销。[Core remote.rs:9099](/Users/minliny/Documents/Reader/Reader-Core-Native/crates/reader-runtime/src/remote.rs:9099) 先 save_reading_progress，再更新 catalog 并生成结果（9107–9121）；存在写入已完成而结果尚未收到，甚至后续 catalog 操作报错的独立窗口。当前 Host 迟到回调只因 prepared/generation 失效而返回 false，没有对账恢复。

修复：把 queued、dispatched、durable、failed-before-write、unknown 分开。只有确认未写入才直接回滚；派发后的超时进入对账，读取 canonical progress/revision 或可查询事务状态，再决定一致地完成目标页或恢复旧页。稳定操作 ID 与旧 generation 隔离应贯穿 Host/Core，补偿必须保护更新的用户目标，不能盲写旧页。验收：分别延迟派发、写入前、写入后结果、结果已排队、catalog 更新失败，确保可见页/已保存锚点/rapid 计数一致，重启恢复一致，零重复提交。

### 10. scroll 图片占位高度变化没有显式可见锚点补偿

**等级 S（高度和投影更新）+ R（实际跳动幅度）。** [LocalReadingExperience.ets:4529](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:4529) pending 图片仅占一行，ready 后按图片真实比例计算高度（4594–4614），并替换含 revision 的 fragment ID。[ReaderContinuousReadingStage.ets:356](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderContinuousReadingStage.ets:356) 只通知数据变化，没有记录首个可见文字及其像素位置后补偿。scheduleInitialScroll（369–417）针对初始锚点，不覆盖普通图片更新。ArkUI List 可能部分维护位置，不能仅凭源码宣称一定跳动。

修复：尽早取得图片尺寸并预留稳定比例；必要重排前后保持首个可见 canonical fragment + 像素偏移，对变高区域以上/穿过视口的情况做补偿；图片载入状态不应无谓改变逻辑行 identity。验收：慢加载大图位于视口上方、顶部和中间，手指按住、惯性滚动、静止三种状态分别验证文字锚点与进度不突变，使用连续视频及锚点日志。

### 11. scroll 多指输入没有锁定首个指针

**等级 L。** [ReaderContinuousReadingStage.ets:237](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderContinuousReadingStage.ets:237) 取 changedTouches[0]，每个 Down 重设起点，没有 activePointerId 或忽略后续 Down 的门禁；任意 Up 都可 reset 并判断 boundary（263–272）。探针首指 y=100 后第二指 Down y=500，记录起点直接变为 500。

修复：与 paged arena 一致锁定首个有效 pointer ID，后续手指不得覆盖或结束该段；UP 必须来自 active changedTouches；多指 Cancel 与 List 原生滚动的协调单独处理。验收：主指拖动中第二指点按/先抬、交换 changedTouches 顺序、主指先抬、三指序列，只有主指决定边界与点击；还需 VM 验证与 List 自身 pan 的组合效果。

### 12. none 仍需排版和进度保存完成后才能换页

**等级 S；耗时待测。** [LocalReadingExperience.ets:9572](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:9572) 排除 none 的 prepared 路径，转入 turnNext/Previous；同章 next 调 measureCommittedPageAt（9681、9832–9839），completeFirstPage 必须等 Core 保存返回（3987）后才替换 visiblePage（4002）。因此“无动画”并不等于点击即呈现，冷长章、图片及保存慢时仍可能等待。

修复：无动画共享预热的真实分页结果和稳定槽位，只让视觉过渡时间为零；持久化语义与第 9 项一致，不为了快而伪造成功。验收：热同章、冷跨章、超长段落/图片、Core 延迟分别记录点击→真实页首帧及持久化确认的分位数，避免只测空函数/动画时长。

### 13. scroll 到上一章仍复用逐物理页扫描

**等级 S；长章耗时待测。** [LocalReadingExperience.ets:9636](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:9636) continuous 上一章调用 turnToPreviousChapter；无完整末页缓存时，9757–9797 从上一章头部开始物理分页测量。continuePreviousChapterMeasurement 在非 EOF 时逐页 beginMeasurement（3798–3803），直到末页后 completeFirstPage（3814–3816）。对 live List 找章末而言，这条路线引入了整章逐页工作。

修复：scroll 用独立章节 fragment 投影和章末 canonical anchor，List 直接定位末尾，并在最终布局后校正；分页模式继续保留自身精确末页索引。验收：上一章 1 千/1 万/10 万字及大量图片、无分页缓存、返回前章末尾，验证等待时间不随物理页数逐页增长，最终文字/像素锚点正确。

### 14. slide / cover 槽位注释与真实分支生命周期仍有差距

**等级 S（条件分支与 promotion 顺序）+ R（平台重挂载/闪帧）。** [ReaderPageTurnStage.ets:266](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderPageTurnStage.ets:266) 的 cover、358/407 的 slide 与453的 idle 是不同条件构建分支；surface 的 `.id(slotIdentity)`（182）不能单独证明跨分支复用。Local promote 在9433先 schedulePageTurnPreparation 清双方准备页（8493–8498），随后只恢复反向页；原方向目标暂缺，而 pageTurnDirection/offset 到下一 postFrame 才清（9269–9273、9332–9333）。这些事实不足以证明“始终两棵真实子树常驻”，但本次录像没有确认由此产生闪帧。

修复：建立真正固定的 A/B 子树，事务内冻结 current/target 与布局；将逻辑 promotion、槽位交换和旧槽回收作为一次状态转换，目标实际呈现后再清理。验收：记录组件实例创建/销毁、slotId→pageId→revision 与帧确认；进入、回滚、提交、换方向不得意外销毁承载当前可见页的实例，并用原始连续视频验证内容/背景没有断层。

## 独立录像症状，不能强行归因

**等级 V。** slide 操作前后都为 6/11、44%，正文首行不同；详见 [analysis-slide.md](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/evidence/2026-09-10-page-turn-physical-b1f20b88963d/analysis-slide.md)。目前没有足够证据将它归因于 rapid、分页索引、槽位生命周期、Core 超时或其他单一环节。后续须同时记录 chapter/contentVersion/layoutSignature、start/endScalar、事务/slot generation 和屏上首行，验证 5 next + 5 previous 的实际锚点闭环，而不能仅比较页码。

## 建议执行顺序

1. 先修可本地稳定复现的错误：UP 点击误判、none 取消归还所有权、rapid 边界、continuous flush/退出；补真实方法级回归。
2. 把最终 UP 呈现、纵向映射、首指所有权与可中断收尾接入统一输入/呈现状态，禁止仅修 reducer 而遗漏 owner。
3. 明确 Host/Core 写入状态与超时对账后，再缩短或拆分完成屏障；不能以丢弃迟到结果代替持久化一致性。
4. 完成固定真实槽位和冷页预热；none 共享准备结果，scroll 采用独立章节边界定位与图片锚点补偿。
5. 仅在 VM 继续做事件/状态/原生连续视频对齐验证，分别报告逻辑正确性、显示连续性和性能分位数；不再占用本次真机。

## 并行修改后的定点复核

复核开始 UTC：2026-09-09T16:55:21.702695+00:00；对应北京时间 2026-09-10 00:55:21。仅重新执行已存探针并定点核对上述方法，未扩展测试、未访问设备、未修改业务源码。

8 条现有 mock 情景全部仍复现，exitCode=0。冷准备、收尾不可重抓、超时回滚、scroll 保存及尾提交、图片高度变化、none 排版等待、scroll 上一章逐页扫描、slot promotion 的关键逻辑仍成立；没有发现此次并行修改已修复任一报告项。R/V 项仍保留原证据边界，不提升为运行复现。

当前 LocalReadingExperience.ets SHA-256：`6dd7863cc7e54c7f40c8aee12b4aa246707f6f6eaff3f0cf7b7555ff1bc48c60`。初查摘要中的其他 7 个文件没有变化。复核日志为 `other-modes-probe-recheck-output.log`，复核指纹为 `other-modes-source-recheck-sha256.json`；原始日志和指纹保留以供比对。

| 当前方法 | 当前行号 |
| --- | ---: |
| `canStartReaderPageTurn` | [8787](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:8787) |
| `canTurnPage` | [9880](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:9880) |
| `drainPageTurnPreparationQueue` | [8576](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:8576) |
| `pageTurnTapOnlyInput` | [7301](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:7301) |
| `onReaderPageGestureStateChanged` | [8815](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:8815) |
| `clampedPageTurnOffset` | [9007](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:9007) |
| `onContinuousScrollStopped` | [2312](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:2312) |
| `finishExit` | [4107](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:4107) |
| `commitContinuousProgress` | [4182](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:4182) |
| `armPageTurnSettlementDeadline` | [5017](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:5017) |
| `startPreparedPageTurnSettlement` | [9138](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:9138) |
| `beginPreparedPageTurnPersistence` | [9196](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:9196) |
| `persistPreparedPageTurn` | [9232](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:9232) |
| `finishPreparedPageTurnSettlement` | [9288](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:9288) |
| `promotePreparedPageTurn` | [9468](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:9468) |
| `schedulePageTurnPreparation` | [8550](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:8550) |
| `finishSuccessfulPageTurnPresentation` | [9386](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:9386) |
| `drainRapidPageTurn` | [9547](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:9547) |
| `performPageTurn` | [9620](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:9620) |
| `performContinuousPageTurn` | [9685](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:9685) |
| `rebuildContinuousFragments` | [4517](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:4517) |
| `refreshContinuousImageFragment` | [4595](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:4595) |
| `turnToPreviousChapter` | [9814](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:9814) |
| `startPreviousChapterMeasurement` | [9833](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:9833) |
| `continuePreviousChapterMeasurement` | [3700](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:3700) |
| `measureCommittedPageAt` | [9889](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:9889) |
| `completeFirstPage` | [3969](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:3969) |
