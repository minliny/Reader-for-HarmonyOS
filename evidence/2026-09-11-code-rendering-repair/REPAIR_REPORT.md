# 页面渲染定位问题：本轮修复结果

后续 9 月 12 日已继续修复目录/Native 生命周期及事务恢复五项问题，最新源码/产物与仍未关闭的范围见[续修报告](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/evidence/2026-09-12-rendering-residual-repair/REPAIR_REPORT.md)。下文保留 9 月 11 日这一轮的原始结果，不作为后续设备状态。

2026-09-11。本轮已完成代码审计中证实的重复工作修复，并通过本地回归、ArkTS/Native 隔离构建和包校验。控制栏历史长帧的实际改善、整条翻页链的视觉与性能验收仍未关闭。

## 已修复

| 问题与触发条件 | 实现与保护 | 本地结果 |
|---|---|---|
| 仿真页面多个片段同时报告空/相同高亮，引发重复整页工作 | ReadingSurface 统一排队，在同一帧先收集文字矩形、再绘制一次；空片段无有效旧矩形时跳过；缓存有效片段集合；Canvas 和发布结果分别去重 | 24 个空片段从 24 次 clear、576 次 id 读取、24 次发布降到首次 1 次 clear、0 次 id 读取、1 次发布。24 个活动片段合并为 1 个测量/绘制帧；相同结果不清屏、不再发布 |
| 相同动态高亮重复跨入 Native 并唤醒渲染线程 | ArkTS 只缓存 Native 已接受的结果；拒绝后允许重试。Native 在同一 Surface 序号内按身份、矩形、颜色去重 | 停指时变化仍重绘；24 次重复数据不增加 mock swap；清除执行一次；Surface 重建后相同内容重新同步 |
| 设置动效的六处裁剪重复求端点/当前几何、生成 PathShape | 复用当前及端点几何；完整可见源使用共享相对矩形；部分可见仍用原路径；每个 actor 只缓存最近结果，最多 32 项 | 120 个普通未滚动姿态 × 6 处裁剪，从 720 次复杂路径构造降到 0 次，复用 1 个 RectShape。短视口、滚动、反向、尺寸和 density 变化的部分裁剪仍保持原结果 |
| 其他模块重复创建相同裁剪和 paint 结果 | 朗读、自动翻页按完整输入缓存路径与 paint；外观只复用相同路径的 Shape，保留实时排序几何 | 保留朗读计时器排除区域、自动翻页控制溢出、外观字体顺序变化；相关生产方法/Builder 回归通过 |
| 目录行高动画每帧都发送滚动定位 | 第 0 行顶部直接跳过；深处读取实际行矩形，只有偏离锚点才补偿；读取失败仍走原定位，异步换序和卸载保留保护 | 120 次顶部更新或原生已维持锚点的更新均为 0 次定位；实际偏移仍纠正。测量异常、深滚部分行、反向和过期回调回归通过 |
| 高亮 prefix/body/suffix 反复扫描同一文本 | 一个有界文本切分缓存，单次遍历定位两个 scalar 边界，保留 TTS 优先级 | 1000 个汉字、高亮 500～700 的原调用序列，从 7200 次 codePointAt 循环降到 700 次；补充字符、emoji、CRLF、孤立代理项、空/越界/小数边界通过 |
| 七个模块为获取进度/尺寸而读取控制栏复合 frame，session 重复向外发布 | 模块观察专用进度、宽、高标量，只在值变化时写入；session 只在变化时发布 | 七模块 × 101 个姿态验证发布值；原完整进度轴、端点、交互门禁和业务事件回归通过 |

这些数字是执行生产方法的本地边界计数，不能换算成设备毫秒、GPU 帧数或实际观感。Native swap 用例使用模拟 GL/SDK 边界，不是实际显示确认。

## 代码和回归入口

- [页面级高亮合并](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReadingSurface.ets:517)、[Unicode 切分缓存](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDynamicHighlight.ts:24)、[Native 接受结果去重](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/BookTurnPresentationSession.ets:70)。
- [有界裁剪缓存](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlMotionPresentation.ts:73)、[设置完整矩形快捷路径](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlSettingsContent.ets:125)、[目录实际锚点判断](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlDirectoryContent.ets:152)、[模块专用状态发布](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlPanel.ets:432)。
- [渲染工作回归](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/tools/test-reader-render-work.mjs)、[Native Host 回归入口](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/tools/test-reader-book-turn-present-barrier.mjs)、[Native 场景](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/cpp/tests/bookturn_present_barrier_test.cpp)。

## 验证与产物

- **最终核对候选：`20260911T142756Z-35f2f99a-af695aa8`。** 并行朗读配置的后续变化已包含其中，185 组本地检查、234 项 Native 呈现回归、ArkTS/Native 构建再次通过；本任务独立包校验 PASS。14:33:38 UTC 重新遍历所有构建输入，518 个源码、227 个控制文件、15 个规范文件的完整指纹均与此候选相同。签名 HAP SHA-256：`468003b72d6fe1525dedfd5097d5fdf75a3763efc8dbcca1fc1717168378e4a4`。[最终 manifest](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-artifacts/hap/20260911T142756Z-35f2f99a-af695aa8/manifest.json)、[完整输入核对](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/evidence/2026-09-11-code-rendering-repair/final-input-match-af695aa8.json)、[包复验](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/evidence/2026-09-11-code-rendering-repair/package-verify-af695aa8.log)、[最终构建日志](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/evidence/2026-09-11-tts-config-interaction/build-5.log)。下列保留较早一次通过以及随后输入变化的过程记录。
- 完整本地检查 **185 组通过**；其中 Native 呈现/高亮回归 **234 项、0 失败**。ArkTS 类型检查、Native 编译、非增量 HAP 构建、包内源集合检查通过。
- 使用共享工作区已经完成的正式构建，并独立校验其输入及产物。候选 `20260911T142055Z-35f2f99a-5dc18ed4`；[manifest](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-artifacts/hap/20260911T142055Z-35f2f99a-5dc18ed4/manifest.json)。签名 HAP SHA-256：`14073a3ed774b55ad8b1bd4bcb1495bc10dd928000cbe66eb262450cbf32fe56`。
- 14:21:47 UTC 对比记录的 518 个源码文件、227 个控制文件和 15 个工作区规范文件，均无变化。构建时源码指纹 `5dc18ed47636fdaa4d651dec60d78b69a853d7c1012aa5684c3bbe2c1fadff39`。[身份核对](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/evidence/2026-09-11-code-rendering-repair/verified-build-identity.json)、[独立包校验 PASS](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/evidence/2026-09-11-code-rendering-repair/package-verify.log)、[成功构建与全量检查日志](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/evidence/2026-09-11-tts-config-interaction/build-4.log)。
- 14:27 UTC 收尾复核发现并行任务随后修改了 `ReaderTtsConfigOptions.ts` 和 `test-reader-tts-config-interaction.mjs`，因此不能把上述候选声称为整个工作区此后持续一致的最新产物。本轮渲染修复文件没有因此变化。[后续变化](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/evidence/2026-09-11-code-rendering-repair/post-build-drift.json)、[全输入指纹复核](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/evidence/2026-09-11-code-rendering-repair/final-input-match.json)。
- 工作区为共享 dirty 状态，Harmony HEAD `35f2f99a8d635615475fde75120bf8629f944565`，Core HEAD `6b2a9d87048e3da812bec08b7c2b3fff1c16e2e2`。这是一份 iteration 产物，不是 clean acceptance。本轮没有提交、暂存、覆盖并行改动，也没有执行设备安装、启动、交互或抓取；并行任务的设备操作不作为本轮渲染验收。
- 开工快照和差异保留在本目录。差异包含并行朗读配置改动，不能全部归因给本任务；本任务主要修改上表渲染路径，并同步了受接口变化影响的旧测试。共享构建发现的显式 boolean 类型问题已修正并复验。

最初 185 组中的 13 组失败、SDK 探针失败、ArkTS 编译失败及构建锁占用均保留于 [验证问题记录](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/evidence/2026-09-11-code-rendering-repair/VALIDATION_ISSUES.md)，没有用最终通过覆盖失败历史。

## 仍然保留的问题和验证出口

1. 历史 a11 设置展开 UI 任务 57.926ms（Settings 28.515ms、Panel 12.338ms、触摸分发 11.445ms；这些片段不能与父级累计相加）是旧候选证据。本轮消除了确定重复工作，没有新的 VM trace，不能宣布该峰值消失。
2. 设置仍有 20 处运行时模糊属性，宽高变化仍需要布局。它们的各自时间尚未分离；共享父层滤镜的视觉等价也未证实，故没有通过删除滤镜、冻结文字布局或改成交叉淡入淡出来替换原动效。下一步先审计响应式更新、布局和合成成本；必要的 VM 比较须使用同内容、同操作，并分开记录首开/暖开、输入、组件更新、布局、RS/GPU。
3. 高亮仍需 SDK 字符矩形、卷曲和终帧像素验证；裁剪仍需短视口、滚动及各模块中途反向的实际合成效果；目录仍需动画中远程数据/排序/删除及再抓组合。现有本地边界测试不能代替这些行为层。
4. 原 52 项总账及未验证项全部保留：N08 实际显示 fence；Native/ArkUI 首终帧和失败交接；强制 Surface 丢失、迟到回执和真实系统 CANCEL；冷页/冷远程章双向首响应；未知写入结果；高亮、图片、日夜、全字体主题像素矩阵；超长章尾部冷定位；原《绍宋》第 34 章 6/11 页 44% 当时缺失的 scalar/layout 证据；连续 MOVE 再抓十轮及字号/中间像素补测；分配峰值、GPU 完成、真实触控到显示、120Hz、温升和功耗。历史 Native 27.118ms 等数据没有被本次计数替代。
5. 本轮没有关闭任何 VM/真机验收项，原总账仍为 37 IMPLEMENTED、10 PARTIAL、3 RETAINED、1 VALIDATION、1 SEMANTIC；VM 42 PARTIAL、10 OPEN。上表是新增的代码修复补充，不是全部 52 项验收完成。后续发现问题仍先记录、先代码定位；只有代码无法定位剩余问题并明确最小目的时，才允许真机取证，已释放设备不自动重新授权。

[原定位报告](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/evidence/2026-09-11-code-rendering-audit/CODE_RENDERING_FINDINGS.md) · [完整历史问题总账](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/evidence/2026-09-10-page-turn-physical-b1f20b88963d/CURRENT_ISSUES_AND_REPAIR_PLAN.md)
