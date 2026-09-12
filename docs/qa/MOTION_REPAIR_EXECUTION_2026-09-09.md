# 全局动效修复执行结果 · 2026-09-09

结论：已实施本轮批准的公共时钟、输入交接、菜单、字体排序、书架和胶囊动效修正；通过源码检查、完整构建、签名校验与下述 VM 定点交互。**连续画面、物理真机和 Figma 逐帧视觉验收仍未关闭。** 不把安装或端点截图当作全帧无闪烁证明。

交接后的追加发现：另一任务在 fe44 候选发现封面长按无效、标题长按有效。封面双层纯视觉子树仍参加命中；此结构在接手前已存在，不能归因于本轮新增。已禁用该纯视觉子树，让父卡片独占点击/长按，未改变几何和轨迹。**追加补丁已在 e39d 候选保数据安装，封面长按、点击进入正文、标题长按及列表/宫格终态复验通过。**

## 1. 协作与范围

- 保留原有脏工作区；本任务未提交、重置、整文件回退或删除其他任务源码。
- 本任务修改控制栏与通用动效、菜单、字体排序、书架投影、会话胶囊及相应检查。
- BookshelfPage、LocalReadingExperience、SourceManagementPage 是共享文件，按局部方法/属性合并；另一任务的默认分组、检查更新入口、Host/日志隐私等改动保留。
- Core/书源/搜索/业务修理由任务“审计 HarmonyOS Demo 缺陷”负责。本轮未修改 Core、Figma 或 Native 翻页轨迹。
- 构建与 VM 交互串行持锁。最后于 2026-09-09 13:47:27 UTC 退出本任务探针，明确交接另一任务；此后不再发出设备输入。

## 2. 实施内容

| 动效族 | 本轮实施 | 保持不变的设计边界 |
| --- | --- | --- |
| 阅读页唤出控制栏 | 唤出 220ms；命令和帧回调共用单调时钟；首个回调从命令时刻推进，旧票据不阻塞新回调；唤出中的独立入口可响应且不重置当前进度 | 初始快捷页小横条不展开；指针拖动不是缓动追赶 |
| 快捷/完整控制栏 | 展开 320ms、收起 260ms、整体关闭 200ms、恢复 220ms；共同进度和输入所有权；停用/减弱动画的收尾保护 | 各组件原有独立几何、层级与柔化保留；不是整体淡切；收起取当前位置，再展开回顶部，目录/书签定位规则不变 |
| 退出组件输入 | 已淡出的亮度条、底部导航连同子节点禁用，不再留下隐形触摸区域 | 组件仍保留在同一变形树中，不靠卸载内容消除占位 |
| 下拉/更多菜单 | 业务选择与视觉关闭分离，捕获选项身份且只提交一次；旧完成回调不能关闭新菜单；离页失效 | 展开 160ms、关闭 120ms |
| 字体排序 | 被拖项直接跟手；相邻项 120ms 换位、松手 160ms 落位；从当前采样位置重抓，离开完整态/生命周期变化取消 | 导入字体为独立栏位，默认最后；不改变实际字体业务选择 |
| 书架视图切换 | 用一条可反向时间轴驱动原分层轨迹，连续点击接续当前采样值，清除残留隐式动画 | 保留原 1000ms 时间轴、各层偏移/曲线/错峰 |
| 会话胶囊 | 共用单调时钟；截图完成、离页、后台和业务结束均核对同一代次；终态释放截图 | 保留 480+120+240+160ms 四段 |
| 减少动态效果 | 控制栏/书架/菜单/字体/胶囊/书签回弹/连续翻页各自正确收尾；旧回调不能回写 | 不改平移/覆盖/仿真翻页合同 |

实现入口：`features/common/{ProductMotionTiming,ReaderMotionClock,MotionTimeline,MotionPointTrack}`、`ReaderControlRuntime`、`ReaderControlPanel`、`ReaderSelectPanel`、`ReaderControlAppearanceContent`、`BookshelfPage`、`LocalReadingExperience`、`ReaderSessionMorphTimeline`。

## 3. 设备发现的实际根因与修正

完整朗读页从底部起滑不动，最初怀疑末端状态交接。诊断证据已否定这个猜测：运行时达到 `p=1`、`needsFrame=false`，内容 `input=true`；延迟提交末端的试改也无效，已经撤除。

真正差异是起滑位置：

- 修复前，从 `1030,2550` 起滑，朗读内容没有收到触摸；同一完整页从 `700,2300` 起滑，收到 DOWN/UP，原生滚动偏移到约 394.86vp。
- SDK 的 `HitTestMode.None` 仅排除容器自身，**子节点仍参加命中测试**。淡出导航容器仅切换 None，却仍 enabled，子节点继续阻挡下面的完整内容。亮度条同样缺少退场后的子树禁用条件。
- 修正为内容输入许可与对应组件可见性共同控制整个子树的 enabled，保持形变树和轨迹不变。
- 最终包同样从 `1030,2550` 起滑：详细配置标题从 y=2580 移至 y=600，底部设置可以到达。随后收起、再次展开，播放控制区恢复 y=601、详细配置恢复 y=2580。
- 临时 ReaderMotionEndpoint/ReaderMotionScroll 诊断以及无效试改已从最终源码移除。

本地 SDK 依据：`/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/component/enums.d.ts` 的 HitTestMode.None 定义。相关回归断言已加入 `tools/test-reader-motion-repair.mjs`；实际区域命中结果由 VM 对照补足，不能只靠字符串断言证明。

## 4. 已完成的验证与边界

| 项目 | 已获得的证据 | 未覆盖的部分 |
| --- | --- | --- |
| 源码和构建 | 57 项相关检查通过；统一流水线 165 项本地检查通过；完整 ArkTS 编译、无增量隔离构建、签名/Native/内置源字节校验通过 | 不等于设备效果验收；Core 全量测试由另一任务负责，本任务未重跑 |
| 控制页入口 | 朗读、目录、书签、界面、设置、搜索、自动翻页、替换的快捷/完整端点与返回路径有本次布局记录 | 空搜索/空替换/无书签是当前数据状态，不代表有数据时所有业务分支通过 |
| 滚动与返回 | 朗读/设置底部起滑通过；朗读深滚动收起/重开顶部通过；系统返回完整→对应快捷→初始快捷通过 | 目录在当前章节可见；书签无数据，未做实机等距选靠前用例 |
| 整体关闭 | 完整态和快捷态下拉后关闭；重新打开为初始快捷页 | 未用连续视频计算关闭每帧的明暗变化 |
| 小横条 | 初始页点击未误展开；快捷态长按不动时 150/650ms 两次采样图像完全相同，释放后仍快捷；点击/甩动路线执行 | 多指取消、自动动画中反向重抓的连续物理轨迹仍需真机/连续采样验证 |
| 菜单 | 下拉选择当前项关闭、再次打开后点击外部关闭；书架更多菜单开关通过 | 旧完成回调/跨身份竞争由方法级测试覆盖，未对所有菜单组合做设备矩阵 |
| 字体 | 系统字体从第一槽拖到第三槽，邻项顺移；反向拖回后原顺序恢复；导入栏仍最后 | 连续重抓中每帧的邻项轨迹未逐帧验收 |
| 书架 | 四次快速列表/宫格反向输入后回到宫格终态，截图无残留列表叠层 | 1000ms 内全帧曲线/错峰未录屏验收 |
| 书架追加补丁 | e39d 包封面中心长按、点击进入正文、标题长按均通过；列表/宫格端点截图通过。由另一任务执行，本任务读取布局/截图与部署回执复核 | 不把端点检查当作运动中每帧手势验收 |
| 胶囊 | 自动翻页启动后控制栏收进胶囊，采到过渡画面与有内容的胶囊终态；已停止会话并退出阅读 | 未把自动翻页胶囊的结果冒充 TTS 引擎/音频播放验证；全帧/后台真机矩阵仍开放 |
| 减少动态效果 | 实际打开开关后，书架切换和朗读展开/收起通过，最后恢复 off | 没有逐项重跑所有系统级无障碍组合 |

Mac 锁屏时宿主连续录屏不可用；串行截图的实际间隔无法覆盖全部 260/320ms 帧。旧多指 ELF 在新 VM 的 dry-run 阶段系统库链接失败，未注入触摸，未绕过重试。继续使用正常官方触摸入口；工具失败不算应用失败。

测试数据处理：字体顺序、书架宫格模式、减少动态效果 off 已恢复；自动翻页已停止。自动翻页验证实际推进了同一章节的页码，这段是本任务操作，未将其归因于用户。没有卸载、清空数据或恢复旧数据库。

## 5. 候选身份与证据分层

### 最终合并候选（当前交付链接）

- Run ID：`20260909T144521Z-35f2f99a-cb6bfc9f`。
- [最终 Manifest](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-artifacts/hap/20260909T144521Z-35f2f99a-cb6bfc9f/manifest.json)；[最终签名 HAP](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-artifacts/hap/20260909T144521Z-35f2f99a-cb6bfc9f/entry-default-signed.hap)。
- SHA256：`7fc3af9adc82c33a5ebf3a5193c6bd6844677eeccc118080e64b60376f4911ac`；verified signed debug；iteration，非 clean acceptance。
- [最终部署回执](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-artifacts/hap/20260909T144521Z-35f2f99a-cb6bfc9f/deploy-vm-6460677a198b-20260909T145831Z.json)：2026-09-09 14:58:31 UTC，同一 VM targetRef 6460677a198b，preserve，install/launch PASS。
- 本任务离线 verify 再次 PASS。479 个当前构建输入全部与 manifest 快照匹配；与已验证封面补丁的 e39d 候选相比，只有 SearchPage 变化，另外 478 个输入完全相同。
- Harmony commit/dirty、Core commit/clean、包内 Native 集合与 Core NAPI 身份均与下述 e39d/fe44 候选相同。
- 另一任务在此包追加完成搜索专项：停止会话 354 条结果，本地筛选 0 条且旧可点击行消失，在线恢复 354 条；停止状态保持 34/190 源、失败 4 源；已在书架标记、详情及返回通过。证据 `evidence/demo-repair-20260909/vm/reader-control-searchlazy-*`，本任务只读核对布局和回执，不冒充重新执行了该旅程。
- 本轮动效设备证据沿用未改变输入的 fe44 主体检查和 e39d 封面检查；不重跑整套，不扩展为所有业务、所有真机或全帧视觉 PASS。

### 追加修正候选（已构建验签、保数据部署及封面定点复验）

- Run ID：`20260909T141251Z-35f2f99a-e2a265f1`。
- [新候选 Manifest](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-artifacts/hap/20260909T141251Z-35f2f99a-e2a265f1/manifest.json)；[新签名 HAP](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-artifacts/hap/20260909T141251Z-35f2f99a-e2a265f1/entry-default-signed.hap)。
- SHA256：`e39dfbb9cac9dd8be90e57688ea159cece664377b96b76b959c1d00a3bab0b2b`；verified signed debug；iteration。
- 两包 source-snapshot 对照：构建输入只改变 BookshelfPage（封面输入门禁）和 SearchPage（另一任务的搜索状态读取）；控制栏和 Native 输入完全相同。
- 构建日志：`/Users/minliny/Documents/Reader/evidence/demo-repair-20260909/hap-device-followup-build-2.log`。由另一任务唯一构建，本任务只读核对身份。
- [e39d 部署回执](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-artifacts/hap/20260909T141251Z-35f2f99a-e2a265f1/deploy-vm-6460677a198b-20260909T143437Z.json)：2026-09-09 14:34:37 UTC，同一 VM targetRef 6460677a198b，preserve，install/launch PASS。
- 封面追加复验：`/Users/minliny/Documents/Reader/evidence/demo-repair-20260909/vm/reader-control-final-{cover-long,cover-click,title-long}.json`；`reader-control-final-{list,grid}-end.png`。长按布局均出现操作菜单，点击布局进入 reader-page-slot-a 正文；两张端点截图人工复核。
- 主体控制栏运行证据来自 fe44；新候选只复验改变的书架部分，不冒充再次运行过整套控制栏矩阵。

### 已安装的主体候选（不含上述追加补丁）

- Run ID：`20260909T131829Z-35f2f99a-20999210`。
- [Manifest](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-artifacts/hap/20260909T131829Z-35f2f99a-20999210/manifest.json)
- [Signed HAP](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-artifacts/hap/20260909T131829Z-35f2f99a-20999210/entry-default-signed.hap)
- Signed SHA256：`fe44fa2fd8c3677781218970b3ebc6d50d942250cf705a6983fce9c78608852d`；签名 verified，Profile 为 debug。
- Harmony：`35f2f99a8d635615475fde75120bf8629f944565`，dirty；Core：`6b2a9d87048e3da812bec08b7c2b3fff1c16e2e2`，clean。
- 包内 Core NAPI SHA256：`43363d1286453492ee73afeb81e5d830154406ae3951cb9e7afe3f25ae7d69e5`。
- 安装目标：现有 Mate 80 Pro VM，targetRef `6460677a198b`，保数据覆盖安装并启动。[部署回执](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-artifacts/hap/20260909T131829Z-35f2f99a-20999210/deploy-vm-6460677a198b-20260909T132010Z.json)
- 首次收尾逐文件检查：manifest 记录的 479 个构建输入当时与源码没有内容不匹配；随后追加了上述封面输入修正，因此当前源码比此包多这项未打包改动。本报告不改变包输入。
- 等级为 iteration，`acceptanceEligible=false`；未为了验收等级清理并行任务的脏工作区。

## 6. 本地证据与后续验收

- 设备布局/截图/有序输入记录：`/private/tmp/reader-motion-repair-2QrAby/device/`，最终包记录文件前缀 `reader-control-final-`。
- [交接门禁](/private/tmp/reader-motion-repair-2QrAby/device/handoff-preflight-final.md)：boot=true、SceneBoard PID 2458、无生命周期超时、当前实例 PID 59198 绑定同一端点；已释放探针锁。
- [安装前备份说明](/private/tmp/reader-motion-repair-2QrAby/device/pre-schema16-backup.md)：schema15 DB/WAL/SHM 一致性备份、完整性 ok；不是完整应用沙箱备份。新包已迁移 schema16，不自动降级。
- 尚需真实连续画面验证：短按甩动、自动运动中重抓反向、多指取消、深滚动过程的柔化与裁切、每帧无闪烁/黑屏及与 Figma 轨迹的一致性。
- 另一任务的短业务旅程独立进行，不纳入本任务已经通过的动效证据。

当前协调状态：封面补丁及其约束检查已完成，并在 e39d 保数据部署及定点复验通过；另一任务完成最终合并候选 7fc3 的部署和搜索专项，并返回书架、退出探针。本任务源码保持冻结，没有并发构建或重新占用 VM。最终候选及不同阶段的实际运行证据已在上文分开绑定。

交付结论限定为：**本轮动效修复及封面追加补丁已落地、签名包已保数据安装、上述定点交互通过；仍非全量逐帧视觉验收，也不代表另一任务的全部业务缺陷已经关闭。**
