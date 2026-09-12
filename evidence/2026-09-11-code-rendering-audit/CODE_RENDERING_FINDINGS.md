# 当前页面渲染定位与修复顺序

**后续修复补充（2026-09-11）：** 本报告定位的重复工作已进入代码并完成本地回归、ArkTS/Native 构建和包校验，详见[本轮修复结果及剩余项](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/evidence/2026-09-11-code-rendering-repair/REPAIR_REPORT.md)。下文保留修复前审计和旧候选的原始计数；其中“没有修改应用实现”描述的是审计阶段，不代表后续修复状态。旧 VM 性能数据没有因此变成新代码验收。

2026-09-11；本次按“从代码侧定位”执行。结论：已经定位到设置面板的实际 UI 长任务，以及正文高亮、动态裁剪、目录定位、文字切分中的重复工作。尚未测出每个内部操作各占多少毫秒，不能宣布这些就是全部卡顿来源，也不能宣布全量修复完成。

本次只新增本地探针和报告，没有修改应用实现、构建 HAP 或操作 VM/真机。探针执行生产文件中的普通方法，在系统接口处计数；它不运行 ArkUI 响应式更新、真实布局、GPU 或显示合成。

**源码与已有运行证据的对应关系**

- Harmony HEAD：`35f2f99a8d635615475fde75120bf8629f944565`，分支 `codex/appearance-progress-axis-20260904`；工作区存在并行改动，HEAD 不代表完整当前源码。
- 运行证据来自已安装候选 `20260911T120809Z-35f2f99a-a11ccc84`，签名 HAP SHA256：`8c689beb63f4306de2d8a5c8118aa1f6b32fea55ff7d39fa686ee1b78fcb462f`。
- 13:40 UTC 复核候选记录的 512 个输入文件：`ReaderSelect.ets`、`ReaderSelectPanel.ets`、`ReaderControlAppearanceContent.ets` 已变化；223 个控制文件中 `tools/svg-provenance.config.mjs` 已变化。没有覆盖这些并行改动。不能再声称整个工作区与候选完全一致。
- 本报告的 Settings、Directory、Panel、ReadingSurface、PageTurnStage、ContinuousStage、LocalReadingExperience 和三个 Native 文件仍匹配该候选。Appearance 的同类结构只作为当前源码观察，不套用该候选的性能结论。
- 完整文件哈希及差异见 [源码身份记录](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/evidence/2026-09-11-code-rendering-audit/source-evidence-identity.json)。

**1. 设置面板长任务：已经定位到组件更新，内部开销还需逐项分离**

已有 `final-settings-expand-trace.ftrace` 中，PID 2181 的一次 VSync UI 任务为 **57.926ms**，其中 guest 运行态 **55.903ms**、未被调度 **2.023ms**。同一任务内：

| 工作 | 耗时 | 含义 |
|---|---:|---|
| MOVE 触摸分发 | 11.445ms | 输入处理阶段已经偏重 |
| ReaderControlPanel 更新 | 12.338ms | 控制栏父组件更新 |
| ReaderControlSettingsContent 更新 | 28.515ms | 设置内容更新，是已命名的最大热点 |
| FlushDirtyNodeUpdate | 40.926ms | 包含上面两个组件更新，不能再次相加 |

该帧未见带 GC 名称的切片；Native 纹理上传记录也没有把这个峰值指向上传。证据不足以将它归为单纯 GC 或 VM 调度问题，但仍不能把 guest 运行态等同于每一段代码的真实物理 CPU 占用。

[Panel 的更新入口](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlPanel.ets:412) 每次接收 runtime 更新时写入进度等标量、发布 session、计算 dock 和背景区域。[设置内容入口](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlPanel.ets:992) 同时传递动画进度、宽高、可交互状态及业务快照。子组件中真实文字宽高、位置、裁剪与滤镜随进度变化。

当前 `visualSession` 已经是普通字段，父级保存 session/背景区域的字段也是普通字段；不能沿用“整份时钟 @State 每帧让整页重绘”的旧结论。同样，复杂 `snapshot @Prop` 的存在不直接证明它每帧都发生深复制；这项需要编译更新路径和实际复制计数，暂不列为已证实根因。

设置内容中有 20 处运行时模糊属性应用：屏幕样式标题 1、分组标签 3、选项文字 13、附加组 3。它们与逐项宽高布局构成明确的渲染成本路径，但 28.515ms 中布局、样式、复制、滤镜提交的各自占比尚未分离。

修复方向：先消除下述确定重复工作，再将稳定业务内容与每帧姿态的更新依赖分开。只在视觉等价的共同父层合并相同滤镜/透明度，保留各组件自己的显隐轨迹、文字重排和裁剪边界，不能删除动效或改成两张页面交叉淡入淡出来换取表面流畅。

**2. 设置裁剪绕过已有几何缓存，常见状态还在构造无必要的复杂路径**

[sharedClip](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlSettingsContent.ets:110) 每次新建 PathShape，重新求 Full/当前/Quick 三个矩形并生成路径字符串。三个设置行的标签和选项栏各调用一次，共 6 次。

生产方法计数结果：

| 输入 | 几何整帧采样 | PathShape / 路径构造 | 裁剪专用 actor 求值 | density 查询 |
|---|---:|---:|---:|---:|
| 相同姿态完整求值 120 次 | 1 | 720 | 2160 | 720 |
| 120 个不同姿态 | 120 | 720 | 2160 | 720 |

第一行证明已有 `geometry()` 缓存确实生效，但 `sharedClip()` 不复用它；这不是一次真实动画必然有 120 次完整 builder 执行的声明。

在 Full 视口 666vp、未滚动、进度 0～1 的 121 个采样 × 6 个 actor 中，**726/726 个源裁剪矩形已覆盖完整 actor**。这种情况下复杂路径的覆盖范围与普通完整矩形相同。另测短视口和滚动偏移，存在 2178 个非完整源矩形样本，因此不能全局删除裁剪。

修复方向：共享当前姿态及端点几何；加入完整矩形快捷路径；对仍需复杂裁剪的情况按进度、宽高、冻结滚动偏移、density、内容版本缓存，限制为当前/端点等有界条目，不能为连续浮点进度建立无限增长的全局 Map。density 变化必须失效。

同类 `new PathShape().commands(...)` 也存在于 [外观](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlAppearanceContent.ets:174)、[朗读](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlTtsContent.ets:141)、[自动翻页](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlAutoPageContent.ets:116)。这证明结构性成本不只在设置中；本次 720/2160 的定量结果只属于设置，不能套用其他模块。

**3. 仿真正文的空高亮回调被放大为整页工作，是已复现的重复工作缺陷**

触发条件：具有静态截图标识的仿真正文片段出现、布局区域变化或高亮属性变化；不要求当前真的有高亮。

调用链：

1. [每个文字片段分别安排帧回调](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReadingSurface.ets:172)，空范围也上报 `[]`。片段内部已经有排队去重，但页面级没有合并。
2. [每份结果立即调用整页绘制](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReadingSurface.ets:438)。
3. [drawDynamicHighlights](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReadingSurface.ets:526) 清空整页 Canvas，重新获取所有片段并建立 id Set，扫描高亮集合，再发布结果；没有空结果或相同结果去重。
4. 若当前页身份匹配且处于仿真，[LocalReadingExperience](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:2048) 重新检查当前页投影身份、转换数值并通知 Native。[Native Host](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/cpp/bookturn/bookturn_host.cpp:332) 无内容相等检查，每次写入邮箱并唤醒工作线程。

生产片段回调与整页方法联动，无活动高亮：

| 页内片段数 | 片段帧回调 | 整页 clear | 全片段 id 读取 | 空结果发布 |
|---:|---:|---:|---:|---:|
| 12 | 12 | 12 | 144 | 12 |
| 24 | 24 | 24 | 576 | 24 |
| 48 | 48 | 48 | 2304 | 48 |

这一轮的片段扫描成本随数量平方增长。它发生在片段回调密集到达时，不能描述成“每个 MOVE 必然触发”。上述发布次数是页面边界计数；只有通过 LRE 当前身份检查才继续进入 NAPI。

Native 邮箱会覆盖尚未消费的旧结果，因而 **24 次通知不等于 24 次 GPU 绘制**。但每次消费都会标记 `highlightFrameDirty_`，按手指状态/保留终帧状态请求后续工作，renderer 也没有相等去重。该路径是额外工作来源，尚未单独测出它对历史 Native 27.118ms UI 峰值的贡献。

修复方向：以 ReadingSurface 为唯一合并者，同一帧收集片段变化后只绘制一次；以内容 revision 缓存有效片段集合；没有活动高亮且已经为空时跳过。由非空变为空仍必须正确清除一次；页身份、视口或 Surface epoch 变化时必须重新同步。ArkTS 输出与 Native 消费都做有界的身份＋数值去重，并继续保留旧代次/旧 Surface 防护。不能通过关闭高亮或每次重新上传整页纹理绕过问题。

**4. 目录动画改变行高后，每帧又发一次滚动定位**

[onProgressChanged](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlDirectoryContent.ets:137) 在行高变化时安排帧回调，随后执行 `scrollToIndex`，补偿首可见行及行内比例。当前逻辑已经保证最多一个待执行回调，不能把“再加一个每帧合并器”当成修复。

生产方法驱动 120 个不同进度，并逐帧执行回调：章节和书签、顶部和深处半行四个组合，均产生 **120 次 scrollToIndex**；读取初始锚点各 1 次。即使位于第 0 行顶部，仍重复定位第 0 行＋偏移 0。

明确的成本是：布局属性在变，同时每帧还向原生 List 发定位命令。是否因此每次增加第二轮布局需要更细 trace；本次没有把调用数当布局次数。已有目录展开峰值 24.362ms、自动展开 28.051ms，尚未单独归因到这条调用。

修复方向：顶部不需要补偿时跳过；深处优先让行高更新与锚点偏移在同一布局事务中完成，或在实际位置偏离目标时才纠正。使用实际可见行及行内比例，不回退成估算总偏移，也不能只在结束时跳回锚点。验证中途反向、再抓、筛选/排序及动画中异步数据变化。

**5. 有高亮时，同一文字片段反复从头扫描字符**

[文字分支](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReadingSurface.ets:132) 先调用 prefix/body/suffix 判断长度，再调用一次绘制；各方法都重新执行 [highlightRange / utf16ForScalar](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReadingSurface.ets:227)。

按实际调用点求值，1000 个汉字、高亮第 500～700 字：一次构造产生 6 次范围求解、12 次从头扫描、7200 次字符循环。只计算一次范围即可降为 2 次扫描、1200 次循环。没有高亮时为 4 次空范围求解、0 次字符扫描，不能把这项说成普通阅读始终扫描 7200 次。

修复方向：按文本/范围/高亮来源计算一次可复用切分，或复用 scalar→UTF16 映射；必须保留 surrogate pair、跨片段范围、TTS 优先级、缩进原文偏移和复制行为。它是有条件的次级优化，不能替代上面几个更大的问题。

**已核对、不应重新当作未修根因的路径**

- `ReaderPageTurnStage` 的 a/b 两个物理组件调用点固定；内容以 revision/provider 更新，位移不直接替换整个正文数组。当前本地稳定槽位/角色晋升用例通过；同一 revision 反复读取 100 轮只调用三个页面 provider 各一次。此证据不等于所有真实设备组合都零重挂载。
- `readingLayout()` 已有尺寸/样式版本缓存，翻页事务期间使用冻结布局；当前页投影已有事务冻结和 stage 版本缓存。高亮回调在事务外重新查询投影的问题应单独优化，不能由此推成每个 MOVE 都重新分页。
- 设置 `geometry()` 与 `presentation()` 已缓存。普通未滚动的 120 个中间进度中，MorphScroll 读取偏移 120 次，但 **scrollTo 为 0**；不能误报为设置每帧强制滚动。目录是另一条明确调用路径。
- 平移/覆盖走稳定正文槽，仿真走 Native 纹理与独立高亮，滚动走 Lazy List；上述仿真高亮链不能直接解释另外四种模式的所有延迟。none 仍可能受准备和权威保存时延影响。

**执行顺序与保留事项**

| 顺序 | 改动 | 本地出口 | 后续 VM 出口 |
|---|---|---|---|
| 1 | 页面级高亮合并、空/相同结果去重，裁剪完整矩形快捷路径和有界缓存 | 本报告生产探针变成针对产出行为的回归；空高亮不重复通知；有效清除、身份变化仍同步；裁剪边界和逆向正确 | 相同内容及操作比较 ReadingSurface/Settings 更新和分配；检查高亮随卷曲与终帧的像素 |
| 2 | 控制栏姿态与业务内容依赖分开；仅在视觉等价处合并滤镜 | 不修改完整进度轴、端点几何、文字重排和业务事件；控制内容持续可见 | 重跑设置十段对应动作，分开报告首开/暖开、触摸、组件更新、布局、RS/GPU |
| 3 | 目录去掉无必要的重复定位，深滚锚点同步 | 顶部无需每帧定位；深处仍保留部分行；反向/数据变化不跳行 | 深目录、书签、搜索/排序/删除及再抓组合，观察是否减少布局和长帧 |
| 4 | 高亮文本单次切分；扩大同类裁剪/滤镜优化到其他模块 | Unicode、缩进和原文复制回归；几何缓存正确失效 | 外观、朗读、自动翻页等逐模块验证，不能以设置通过替代 |

以上是当前定位后的修复顺序，不是新的“全部验收已完成”声明。原 52 项总账仍维持 37 IMPLEMENTED、10 PARTIAL、3 RETAINED、1 VALIDATION、1 SEMANTIC；VM 42 PARTIAL、10 OPEN。本次没有因本地计数或源码审查关闭任何 VM/真机项目。

特别保留：N08 实际显示 fence 缺口；Native/ArkUI 首终帧及失败交接；强制 Surface 丢失/迟到回执/真实系统 CANCEL；冷页与冷远程章双向首响应；未知写入结果；高亮/图片/日夜/全字体主题像素矩阵；超长章尾部冷定位；原《绍宋》第 34 章 6/11 页 44% 缺失的当时 scalar/layout 证据；连续 MOVE 再抓十轮及未完成的字号/中间像素补测；分配峰值、GPU 完成、真实触控到显示、120Hz、温升和功耗。原 N11 的 4a09 数据不能称为新 a11 的 Native 性能测量。

证据索引：[生产方法探针](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/evidence/2026-09-11-code-rendering-audit/production-work-counts.mjs)、[计数结果](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/evidence/2026-09-11-code-rendering-audit/production-work-counts.json)、[已有 trace 定位摘录](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/evidence/2026-09-11-code-rendering-audit/existing-trace-localization.json)、[完整原问题与执行总账](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/evidence/2026-09-10-page-turn-physical-b1f20b88963d/CURRENT_ISSUES_AND_REPAIR_PLAN.md)。
