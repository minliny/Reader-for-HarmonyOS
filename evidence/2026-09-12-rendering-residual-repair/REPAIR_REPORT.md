# 遗留问题续修：目录与 Native 生命周期

2026-09-12。本轮从遗留总账继续检查当前代码，新增复现并修复五处缺陷。没有操作 VM/真机应用；构建与运行验收分开记录。

## 修复结果

| 编号 / 原总账关联 | 触发和修复 | 修复前后证据 |
|---|---|---|
| R01 / C04、C05 | 目录首帧定位尚在排队时切换书签，新请求被旧 positionQueued 挡住。改为按 placement ticket 排队；旧回调不能执行定位，也不能清掉新请求的排队标志 | 生产 openList → refreshData → queuePosition 链修复前漏掉新列表居中；修复后快速换页签只对当前列表定位一次，用户滚动仍能取消 |
| R02 / C04、C05 | 动效回到可交互端点仅释放 leadingRow，数据刷新又按旧 leadingKey 恢复锚点。端点现在同时释放两者 | 原先刷新后重新出现旧行号；修复后刷新不会恢复已释放锚点，深滚动动效中的有效锚点补偿仍通过 |
| R03 / F07、N09、N14 | 旧 GL 上传阻塞时依次收到销毁、新建和高亮；销毁丢弃待处理高亮，却留下新 Surface 序号对应的接受记录，导致同内容重发被吞。销毁现在同时清理待处理和已接受记录 | 受控阻塞真实 Host 上传以复现交错；修复前 243 项中 1 项失败。修复后连同事件 epoch 断言共 245 项、0 失败；静止手指的变化高亮重发有效，相同有效高亮仍不重复绘制 |
| R04 / F03、N14、N15 | Native 回执入 JS 队列后，Surface 或订阅已经替换，旧失败/就绪事件仍交付。Host 现在传出产生时的原始 epoch，JS 交付前核对 epoch、Host 与订阅；替换订阅先令旧订阅失效 | 生产 CallJsEvent 的 22 个边界场景由 12 失败变为全通过，覆盖 9 类旧 Surface 事件、订阅替换、对象失效和环境退出；当前有效回执正常交付 |
| R05 / F03、N14、N15、未知写入结果 | 新 Surface READY 恢复能力时，旧事务仍可能等待已不存在的 Native owner/槽位；已晋升后丢失 Native 时原失败处理也直接返回。新 READY 现在主动收敛旧事务：未写回滚，写入中保留对账，已晋升直接完成交接；旧事务释放后才启用新 Surface，后续新失败可取消恢复 | 生产 LRE 事件和完成方法覆盖 7 个场景通过；补上“过滤旧回执后，新 READY 仍负责旧事务恢复”的跨层责任，避免长期占用或重复执行未知写入 |

R03 的 Native 测试链接真实 Host/renderer/motion 与模拟 GL/SDK；R04 编译执行生产 EventPayload、CallbackBridge 和 CallJsEvent，在 NAPI/Host 系统边界使用 mock。它们证明上述代码路径，不是设备实际送显证据。C++ 内部回调增加 epoch，公开 ArkTS 的三个事件参数不变。

## 源码入口

- [目录定位请求与回调所有权](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlDirectoryContent.ets:127)、[端点锚点释放](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlDirectoryContent.ets:209)。
- [销毁时高亮接受记录失效](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/cpp/bookturn/bookturn_host.cpp:544)、[原始 Surface epoch 传递](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/cpp/bookturn/bookturn_host.cpp:1006)。
- [JS 交付时重新准入](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/cpp/bookturn/bookturn_napi.cpp:207)、[旧订阅失效](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/cpp/bookturn/bookturn_napi.cpp:637)。
- [旧事务结束后恢复 Surface](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/LocalReadingExperience.ets:2155)、[恢复生产链回归](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/tools/test-reader-book-turn-surface-recovery.mjs)。
- [目录生产链回归](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/tools/test-reader-control-directory-model.mjs)、[Native 回执交付回归](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/tools/test-reader-book-turn-event-dispatch.mjs)、[Native 交错场景](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/cpp/tests/bookturn_present_barrier_test.cpp:849)。

## 验证记录

最终 **187 组完整本地检查、ArkTS 类型检查、Native 编译、非增量隔离构建、包内源集合和独立包校验通过**。最终候选 `20260911T165233Z-35f2f99a-a1d93f93`，签名/debug Profile 已验证，signed HAP SHA-256：`7936051aa377243b7708f5744ad32d07bb00be6092aa8cba1ed8ed39274e0552`。这是 iteration 构建，不是 clean acceptance，也未由本任务安装。

在 2026-09-11 16:53:33 UTC（本地 9 月 12 日 00:53）重新遍历输入，526 个源码文件、229 个控制文件、15 个规范文件的完整指纹均与该候选一致。构建源码指纹 `a1d93f932c6f2b6893b5453a260dbece4112022bdaf4158126503b1010550124`。[manifest](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-artifacts/hap/20260911T165233Z-35f2f99a-a1d93f93/manifest.json)、[输入身份核对](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/evidence/2026-09-12-rendering-residual-repair/final-input-match.json)、[最终构建日志](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/evidence/2026-09-12-rendering-residual-repair/build-2.log)、[独立包复验](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/evidence/2026-09-12-rendering-residual-repair/package-verify.log)。第一轮 b4c66d95 构建虽通过，但不含后补 R05，明确不作为最终包。

定向回归已通过：目录、高亮批处理与计数、Native 呈现 245 项、回执交付 22 项、Surface 事务恢复 7 场景、仿真模式切换/恢复、翻页收尾、未知进度写入结果的对账。修复前失败和中间失败保留在 [ISSUES.md](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/evidence/2026-09-12-rendering-residual-repair/ISSUES.md) 及本目录日志；SDK 事件探针的短签名提取问题已定位为测试工具问题并修正，没有绕过生产代码检查。

Harmony HEAD `35f2f99a8d635615475fde75120bf8629f944565`，Core HEAD `6b2a9d87048e3da812bec08b7c2b3fff1c16e2e2`；开工环境为 Harmony 386、Core 58 个 dirty 路径。所有改动保留，未提交/暂存/重置。开工与修复文件哈希见 before-source.json / repair-source.json；HEAD 不能单独代表这份共享工作树。

本轮 HDC 仅进行一次只读目标枚举，5 秒超时后停止，没有重试，不据此推断设备故障。没有安装、启动、交互或抓取，既有部署证据不能当成本轮验收。

## 继续保留的范围

- C01/C03/C07：历史设置 57.926ms、Native 27.118ms 等长帧仍是原候选的数据；布局与 20 处模糊应用的内部占比尚未分离，本次五处修复不能宣称消除这些峰值。没有删除模糊、冻结文字重排或替换原动效。
- N08：本地 SDK 对 postFrameCallback 的定义仍是下一帧回调，不提供已被物理显示的确认；本次 epoch 检查解决旧回执准入，未补出实际 display fence。
- F03/N14/N15：旧回执与受控销毁重建的代码场景已加强，强制 Surface 丢失、回执丢失、系统 CANCEL、首终帧/失败交接的完整 VM 像素和故障矩阵仍保留。
- C04/C05：快速页签切换、数据刷新和端点锚点已覆盖本次缺陷；动画中的远程迟到数据、删除/筛选/排序与连续再抓仍需完整运行组合。
- 其他原有缺口不遗漏：冷页/冷远程章双向首响应；未知写入结果的真实异步组合；高亮、图片、日夜、全部字体/主题像素矩阵；超长章尾部；原《绍宋》第 34 章 6/11 页 44% 当时缺失的 scalar/layout；连续 MOVE 再抓十轮、字号及中间像素补测；分配峰值、GPU 完成、真实触控到显示、120Hz、温升、功耗；C08 最近书签语义。

本轮不据本地测试关闭 VM 或真机项目。原 52 项数量不变：代码 37 IMPLEMENTED、10 PARTIAL、3 RETAINED、1 VALIDATION、1 SEMANTIC；VM 42 PARTIAL、10 OPEN。后续问题继续先记录、先代码定位；已释放真机不自动重新授权。

[上一轮渲染修复](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/evidence/2026-09-11-code-rendering-repair/REPAIR_REPORT.md) · [原 52 项完整总账](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/evidence/2026-09-10-page-turn-physical-b1f20b88963d/CURRENT_ISSUES_AND_REPAIR_PLAN.md)

## 2026-09-12 ArkTS 构建续修

本次接手时 iteration HAP 的首个失败发生在 `CompileArkTS`：17 个错误集中在
`LocalReadingExperience.ets`，包括五处 TTS 偏好对象展开（6047/6069/6083/6095/6112）、在线
TTS profile 展开与 `delete`（6186/6193）、QuickSearch 联合状态展开（8774/8798）以及设置持久化
回调的 `Promise<void>` 返回（7227）。

修复方式保持业务语义不变：改为显式类型对象和可选字段复制，移除结构展开与 `delete`；搜索分页
状态显式构造 `kind: 'results'` 分支；设置窗口策略回调在 stale 分支返回已完成 Promise，并将网关
结果收敛为 `Promise<void>`。中间一次回归暴露 `@Builder` 内局部变量不满足真实 SDK Builder
语法约束，改为在闭包中重复做 `kind === 'results'` 收窄；定向真实 SDK probe 随后通过。

最终 iteration 流水线：

- `node scripts/hap-pipeline.mjs build --class iteration`：PASS；Harmony 合同测试 196，ArkTS
  type check PASS，Native/非增量构建、打包、签名和 bundled source 校验 PASS。
- `node scripts/hap-pipeline.mjs verify --manifest '/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-artifacts/hap/20260912T033057Z-35f2f99a-f3e5360d/manifest.json'`：PASS。
- manifest：`20260912T033057Z-35f2f99a-f3e5360d`；signed debug HAP SHA-256
  `e46fd2afc4e4b5155c80e8993b7cf056e6e0e0a7c882cf34c3ad216e3ebef59b`。

本轮只完成源码、合同、本地构建和包校验层；工作树仍为 dirty iteration，未安装、启动或操作
VM/真机，视觉、触控、音频和用户验收仍为 OPEN。此前失败日志来自流水线输出，未将失败构建临时目录
当成交付产物。
