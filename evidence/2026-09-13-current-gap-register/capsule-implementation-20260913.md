# 胶囊、控制栏恢复及相关生产接线 — 2026-09-13

范围：落实 `docs/READER_REPAIR_SPEC.md` §4，并在同一生产阅读入口补 §3.3 / §5.3 / §6 的必要接线。本文件记代码与本地证据；未操作设备，不宣称像素、音频或用户验收通过。变更仍由 root 按修改内容分组提交。

## 权威输入与替换边界

- `capsule-figma-live.json` 包含 C/D/E/F 四场景、48 个完整动效 actor 的原始返回；成功路径严格采样 3500ms。
- 12 个 actor 组保持：ImmersiveInfo、PageLabel、TopBar、DockShell/FullPanel、TriggerMorphProxy、MorphSurface、SourceRegion、sharp content、blurred content、CapsuleContent、CapsuleTransitionContent、CircleState。原始准确命名保留在 JSON，各组不是以阶段挂载/卸载。
- 废弃生产 `ReaderSessionMorphTimeline.ts`，`ReaderSessionMorphState.ts` 仅留身份/测量。`ReaderSessionCapsule.ets` 保留静态业务入口，生产成功启动使用一个稳定 `ReaderSessionLaunchStage`，2300–3500ms 及其后保持同一终态，不切换静态 shell。
- 原有通用曲线/时钟/控制 Runtime 继续复用；新增模型仅处理 Reader 的 Figma 轨道、源身份及业务呈现交接，不新增通用动画引擎。

## 生产变更与根因对应

1. **点击当帧启动**：LRE 在 TTS availability/start/whenStarted 或自动翻页的 TTS stop 屏障前同步创建 launch。初态是真实 preparing；ACK 只更新播放投影。准备时暂停意图通过 `setDesiredPlaying` 和 `start(input, desiredPlaying)` 到首个 speak 前的闸门。
2. **真实稳定源**：Panel 的一个纯源 Builder 工厂供 sharp/blur 两份固定内容使用。原交互内容始终挂载，播放区域只交出可见性和输入。源克隆无 Scroll/modal 主体、无业务 callback，生命周期/测量/滚动回调均被 sourceOnly 闸门禁止。
3. **独立轨道**：信息100–500、控制壳100–700、flight200–1400、sharp700–1100、blur600–900–1200、surface/pause1100–1400、dot1400–1700、expansion/leading1700–2300、hold2300–3500。Quick/Full 与 Auto/TTS 的源几何、94/96 目标宽度、Pause 固定右缘、Quick TTS 页码中点72/终点2保留原数据。
4. **源几何和样式**：所有测量统一为阅读 viewport 坐标；保存 book/lifecycle/module/scroll/layout/font/palette/revision。使用实际源尺寸、已滚动的完整模块位置、控制壳退出距离、Scroll viewport 交集；无可见交集或非法测量不制造飞行。首帧保留真实裁剪，随原 flight 连续释放。当前 Make 源的真实圆角可随测量传入，纯 nominal 比对仍采用 Figma 值。
5. **源表面复用当前效果**：Quick TTS 的155度渐变及原alpha，Full TTS 的27vp透明标题区/1vp顶高光，其他源卡片边框与圆角均保持当前来源；不以全框纯色填充整个 Full TTS 标题区。源区域只画一次颜色，不叠同色 alpha。
6. **页码共享时间轴**：LRE 单独挂 PageChrome overlay，接同一 sample 的两段页码轨道。只在接管/完成边界改变正文纹理键；每帧不分页、读取 Core、创建 PixelMap 或清分页缓存。标签只在章/字符锚/时钟变化时更新。
7. **失败/唤起恢复**：冻结当前 sample；控制 Runtime 从当前 top/dock 偏移沿现有打开曲线回位，不跳到普通隐藏偏移。原模块及 Scroll 保留。源可见/测量通知与 Runtime 打开终点联合确认当前 generation，之后旧 Stage 才执行200ms现有退出。输入和恢复时钟分开：禁止点击期间仍允许 Runtime 继续恢复，避免互相等待的死锁。
8. **停止与资源**：停止取消未开始业务，从现有姿态淡出；页码同时回无胶囊实际位置，保留末帧文字。source资源最迟1400ms释放，可选已准备snapshot验证尺寸/像素预算/所有revision，迟到或失效即释放。后台/离页/切书撤销视觉callback；Reduce Motion立即静态终态，不重播业务。
9. **主题/状态栏**：源、控制、胶囊用动态 App 角色/固定 Day-Night SVG，保留原alpha；PageChrome 用阅读主题 `chromeMeta`。系统栏 owner 保留至700ms。LRE 订阅共享appearance revision，并在用户外观改动前等恢复屏障；每个已接受字段更新仍按Store队列合并，generation仅控制视图，生命周期撤销未进入的写入。
10. **控制栏与 More**：完整壳高度不超过实际预算和手机736/平板852；零预算不退回736；IME已经压缩viewport时不重复扣。More打开应用主题操作菜单：书籍信息、已知当前页书签添加/移除、目录、仅网络书换源；Back/外部点击关闭临时层。信息由 ReaderShell/Index 使用原退出与原书身份返回已有信息数据，不重搜/重取TOC。
11. **Make 波形与试听**：替换旧静态24柱和额外0.7 alpha为独立共享driver的Make波形组件。两份源冻结同一次采样，不各起时钟。语音试听回调从TTSContent→Panel→LRE→Coordinator；离页/背景/关闭停止试听，不写阅读进度。

## 已运行本地验证

- `test-reader-session-launch.mjs`：48个原始CSS actor，54000次独立属性比对；关键节点±1ms；身份/ACK/旧callback/duplicate/Reduce Motion/资源释放/部分裁剪。
- `test-reader-control-playback-host-intents.mjs`：执行真实 LRE 方法；点击先于异步业务，0/100/1000ms准备、准备暂停、stop屏障失败、旧意图；700/3500窗口/页面边界及Stage保留。
- `test-reader-session-launch-recovery.mjs`：真实控制偏移回位、代际ready门禁、恢复时钟与输入分离；SDK实际纯源 Builder无Scroll；More四动作门禁；SDK实际播放按钮Day/Night+播放/暂停组合。
- `test-reader-control-playback-content.mjs`：真实SDK闭包、Quick/Full可逆位置、滚动保留、当前业务值、5种mutation失败门禁。
- `test-reader-auto-page-full.mjs`、`test-reader-tts-product-surface.mjs`、`test-reader-control-morph-scroll.mjs`、`test-reader-motion-repair.mjs`、`test-reader-control-motion-geometry.mjs`、`test-reader-layout-architecture.mjs`、`test-reader-control-runtime.mjs`、`test-reader-control-stage-lifecycle.mjs`、`test-reading-record-accumulation.mjs` 等已逐项运行；root最终全量回归记录为最终口径。
- root第3次实际ArkTS编译已通过当时本范围；之后新增波形/More/主题屏障/裁剪收尾需以 root 最终编译为准，不把本文件代替最终编译产物。

## 剩余证据层与异常行为

- VM需要同一manifest逐帧覆盖四入口、0/700/1400/1700/2300/3500ms、滚动后入口、失败/停止/唤起/旋转/Reduce Motion；源边框/字体渲染与实际OS栏变化不是Node或SDK闭包测试能证明的像素结论。
- 缺失或失效源测量时保留控制源并显示真实业务准备/播放态，不先隐藏、不等待截图、不从旧坐标飞；该路径会记警告。若实际VM触发，需要先据测量revision日志定位，不能将降级称作动效验收通过。
- 原始页面顶部信息的出现受系统状态栏 owner 约束，避免控制唤起时与系统文字重叠；VM应对照该平台合成边界。
- 未使用、安装或占用真机；音频和设备帧时证据仍由总计划独立处理。

## 主路径冻结后的代码闭环复查

复查基线 HEAD `3ea5efb8e178200d1b8f98513169ddbd0a06a139` 加当前工作树，范围严格限于规格 §3/§6/§10 与 root 指派的注册表扩展。以下均先通过生产代码定位，再做本地探针；无设备复测。

| ID / 原反馈 | 当前实际覆盖 | 本次追加发现与处理 | 尚需证据 |
|---|---|---|---|
| U01 / 1、U07 / 7 | 只显示/落盘 extendIntoCutout；V5迁移按明确旧字段优先；纯阅读/控制显示通过唯一policy；controlsPresented由实际控制呈现与胶囊0–700ms决定；Reader纸色/ink写给window，顶部信息用Reader chromeMeta | WindowCoordinator仅按长宽判断保留status高度会丢竖→横→竖隐藏样本/误保留分屏样本。已将具体根因与位置交root定点修，不在本分支重复编辑 | 同包OS栏高度、颜色、切换合成像素 |
| U05 / 5 | 四入口3500ms、稳定actor树、同步launch、独立页码、准备暂停、失败/取消/恢复、Make动态波形及资源释放已接生产 | 当前8组重点回归通过；未发现未接业务回调 | 同包VM逐帧/触控、用户视觉确认 |
| U06 / 6 | 控制/胶囊/源使用App作用域；阅读信息Reader作用域，所有源角色保留alpha | 主题几何固定8导致第9个theme越界已修：按registry数量生成所有卡片，额外行顺延默认动作/字体/排版；8个主题不变，9/12/24均测试。超过8同一Scroll支持快捷/完整两端，复用已有scroll path保持反向拖动 | 默认仍8；将来增加配置时颜色合法性由registry负责；新数量的实际像素属于扩展配置验收 |
| U08 / 8a、旧“收起无效” | 所有主模块使用共享可用高度；外观/设置/TTS/自动/替换为实际Scroll，目录List/搜索Scroll；独立header收起命中、视觉shell不截获 | TTS窗口≤166vp时header58+footer76溢出已复现：160/140/120vp分别6/26/46vp。已改极短窗口整个header+表单+footer滚动，保留44vp保存/取消，外边距自适应。普通尺寸仍原固定header/footer | IME、横屏/分屏原生布局与实际点击 |
| U09 / 8b | More四真实动作及仅网络书换源、未知书签禁写、原信息退出链已接 | 与单书75%菜单分离，不把书签toggle当More全量 | 同包菜单动作旅程 |
| U19 / 18 | 已核实生产readingLayout不再传旧32vp为硬下限，采用320/360/390/430自适应；正文/测量/翻页纹理/连续阅读共享layout；签名含所有inset | 本轮只读确认，无额外修订默认建议 | 新正文宽度样张/历史锚位置与同包图像正文 |
| U20 / 19、U21 / 20 | 自动选中具有边框/前景/背景，不仅opacity；自动状态来自成功ACK；MOVE直接进入共享单writer，UP保留preview至ACK | Cancel A已发/B待发导致A最终ACK因B代次被丢而UI停旧值，已定点修：writer.cancelAndSettle + LRE独立cancel generation，Panel保留preview直到writer确认；新自动/手动意图优先于旧cancel | 物理亮度、实际系统自动响应；代码/VM不冒充物理指标 |
| 旧TTS副文案/0.50x/试听 | 副文案独立行；五速度预设含0.50x；音色行→Overlay→Content→Panel→LRE→Coordinator的试听/停止可达，离页/关闭取消，不写进度 | 普通配置及独立试听事务由root实现，回调本范围确认；短屏表单上述fallback已完成 | 系统/HTTP音频播放与权限回执 |

新增本地证据：

- `test-reader-brightness-cancel-ui.mjs`：执行LRE/Panel真实方法，A在途/B待发→Cancel、旧ACK拒绝/最终ACK准入、失败confirmed、新自动意图胜出及无手势不发取消均PASS。
- `test-reader-appearance-theme-extension.mjs`：8主题精确不变；9/12/24全部actor有限且无数组越界；默认动作/字体不覆盖新增行；缓存按数量失效；Quick/Full滚动与反向；SDK实际第9/12卡片点击回调PASS。
- `test-reader-tts-short-window.mjs`：0–844vp预算不溢出，≤166vp整个表单滚动，SDK保存/取消44vp真实调用PASS。
- 追加后原 `reader-control-appearance-geometry`（独立设计端点及810排序场景）、`reader-control-morph-scroll`、`reader-appearance-motion-tree`、`reader-tts-config-interaction`、`reader-tts-product-surface` 重新运行PASS。`git diff --check` PASS。最终ArkTS/全量回归以root后续统一日志为准。
