# Reader 能力开发状态全量审计

> 本文件是 2026-08-14 的历史证据快照。当前开发入口与实时门禁见根 `README.md`；本文中的
> HAP、VM 和“全绿”结论不得转移到后续工作树或重新打包的产物。
> 当前 HAP 构建、签名、选择与保数据安装只以 [`HAP_BUILD_SYSTEM.md`](HAP_BUILD_SYSTEM.md) 为准；
> 本文中的命令、哈希、端口、设备和构建方式均不可执行性继承。
>
> 当前审计日：2026-08-14。文件名作为根目录稳定入口保留。结论只来自当前源码、当前 Git、当前构建和本轮 Phone/Tablet VM；旧报告不得叠加。
>
> 本文是历史证据快照，不维护当前待开发状态。文中的冲突项、开放问题和建议不得直接作为当前任务；
> 唯一待开发清单见 [`DEVELOPMENT_BACKLOG.md`](DEVELOPMENT_BACKLOG.md)。

## 1. 当前结论

本轮已补齐所有已发现、且不需要产品取舍的 Legado 式书架阅读逻辑。最初“继续阅读长时间灰色”的根因
不是按钮样式，而是详情页把完整远程目录和网络正文准备当成按钮前置条件；当前已改为缓存优先：目录和
当前正文命中即可读，联网只负责未缓存章节和后台刷新。

当前状态分层如下：

| 层级 | 结论 |
|---|---|
| 代码与自动化 | Core/Harmony 两仓干净；Core、Clippy、Harmony 契约全绿 |
| 构建 | 干净 Core → NAPI → stripped NAPI → 无增量 HAP 身份链闭合 |
| L0 旧 9 旅程 | Phone P1–P6、Tablet T1–T3 的已知失败均关闭；T1 修复，T2 纠正误判 |
| 本轮远程核心逻辑 | Tablet VM 已验证坏源隔离、显式入架预缓存、离线直读、离线冷启直读 |
| 真机/用户 | 均为 0；不能称 release ready |
| 冲突项 | 5 项保留，等待用户决策 |

## 2. 应有能力与当前实现

### 2.1 搜索与入架

| 应有逻辑 | 当前实现 | 状态 |
|---|---|---|
| 搜索结果只是预览 | 打开详情不自动入架，必须显式点击“加入书架” | 已实现 |
| 坏源不拖死全局搜索 | 最多 4 并发；单源失败隔离，健康源继续；仅全部失败时显示整体错误 | 已实现并由 VM 发现后补修 |
| 同书多源聚合 | 按规范化书名+作者分组，显示来源数，多源优先 | 已实现 |
| 大量来源仍可见 | 来源标签横向滚动；Tablet VM 已滑到后半段来源 | 已实现 |
| 入架后立即准备阅读 | 持久化目录、续传变量、当前章节前后各 2 章 | 已实现 |

### 2.2 详情与继续阅读

| 应有逻辑 | 当前实现 | 状态 |
|---|---|---|
| “继续阅读”不等待完整目录联网 | 活跃会话 → 持久目录 → 网络目录依次降级；缓存目录可立即进入 | 已实现 |
| 按钮只在真实事务中短暂 pending | 加入/移除进行中显示明确原因，不再用不透明长灰态代替加载 | 已实现 |
| 正文缓存是主路径 | 当前章节先读持久缓存，未命中才请求 Host 网络 | 已实现，离线 VM 0 请求 |
| 书架卡直接续读 | 本地/远程书籍均不再强制停在详情页 | 已实现 |

### 2.3 目录、进度与更新

| 应有逻辑 | 当前实现 | 状态 |
|---|---|---|
| 临时目录不破坏已有阅读 | 最终目录写入时保留正文缓存，按规范化标题、数字、原索引、首章顺序重映射 | 已实现 |
| 进度位置尽量保持 | 保留章内 offset/fraction；阅读后清除已读更新高亮 | 已实现 |
| 目录有更新提示 | 书架投影持久化 unreadCount、lastCheckAt、当前章标题/索引/进度 | 已实现 |
| 阅读时滚动缓存 | 每次进度提交维护当前章节前后各 2 章 | 已实现 |
| 临近末尾刷新 | 距目录末尾 3 章内触发，10 分钟节流 | 已实现 |
| 书架批量检查更新 | 前台/冷启时每批 2 本并发，单本失败隔离并重投影 | 已实现 |

### 2.4 缓存、续传与换源

| 应有逻辑 | 当前实现 | 状态 |
|---|---|---|
| 冷启可续跑规则 | 搜索、目录、正文、预取、Harmony 会话均持久化/恢复规则变量 | 已实现 |
| 清理普通缓存不毁书架事实 | `cache.clear` 保留书架目录产品态并修正计数 | 已实现 |
| 缓存不设过小硬上限 | 仅在超过 10,000 条或 1 GiB 时保护 | 已实现 |
| 换源后尽量落回原章节 | 精确标题 → 规范化标题 → 数字 → 原索引 → 首章 | 已实现 |
| 阅读失败自动恢复 | 尝试第一排名候选，失败后保留人工换源面板 | 已实现；多候选策略属待决冲突 |

### 2.5 本地阅读与 Tablet 收口

- TXT/EPUB 导入结果层已从 Phone 绝对坐标改为按实际安全视口居中。最终源上的 Tablet T1 结果为
  `1 本已导入 · 0 本失败`，“完成”父行 bounds `[922,1408][1374,1498]`，在 1600 高视口内并点击成功。
- Tablet EPUB 图片并未缺失。90,913-byte 两章 EPUB 的第一章在横屏被分成两个物理页；第二页正常显示
  内嵌 PNG。没有为错误诊断新增图片协议或双重渲染回退。

## 3. 关键实现位置

- Core 书架目录/缓存/进度：`Reader-Core-Native/crates/reader-runtime/src/remote.rs`
- Core 持久化投影：`Reader-Core-Native/crates/reader-storage/src/lib.rs`
- Core 换源章节匹配：`Reader-Core-Native/crates/reader-runtime/src/reader_ui_source_switch.rs`
- Harmony 书架、预取、更新和冷启编排：`Reader-for-HarmonyOS/entry/src/main/ets/pages/Index.ets`
- Harmony 缓存目录会话：`Reader-for-HarmonyOS/entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts`
- Harmony 搜索失败隔离：`Reader-for-HarmonyOS/entry/src/main/ets/features/search/SearchOrchestrator.ets`
- Harmony 搜索聚合/来源滚动：`Reader-for-HarmonyOS/entry/src/main/ets/features/search/SearchPage.ets`
- Tablet 导入结果布局：`Reader-for-HarmonyOS/entry/src/main/ets/features/bookshelf/LocalImportDialog.ets`

## 4. 提交与四段身份链

### 4.1 当前提交

- Core：`8336e501debcc68019ffbd44bf040effb7a8d80f`（`feat(core): align shelf reading lifecycle with Legado`）。
- Harmony 主逻辑：`746c23ca15080272f09b1bffd1c7ef127e03a4e2`。
- Tablet 导入修复：`f25695c4a21aa4dc118467de1ae6edb60da04a19`。
- 搜索失败隔离：`ac69753cd80c13244b656774a751558ba0c68b04`。
- 搜索来源可达：`ca7f9a5b617d3aba41eb20bdeff7f1ff0f4163d5`。
- Harmony 当前 HEAD：`cdad9ff9d14c3c6be8a50708f800266b3f7ae6ea`；`ca7f9a5…` 之后仅 README 落账。

### 4.2 身份链

| 段 | 当前事实 |
|---|---|
| Core 源码 | commit `8336e501…`；`gitDirty=false`；buildId `08f64b16c2b166c0d7eed5a9656e913749e55a1e68a34c53e3bbe1436d54115c` |
| OHOS staticlib | SHA-256 `5308870286045b71efb68b0600877c6a84d378862c7e44802eed1cbda1c00dd8`；32,565,472 bytes |
| 原始 NAPI | SHA-256 `4fee99bcf931e429c35e313acc6819bd15af3633909ced7ae07187004c2d6298`；16,719,848 bytes |
| stripped NAPI | SHA-256 `39dfddddd15f481b240214b60262c8b6a2f866d255c9b8a681ef9da0838f7caa`；12,810,112 bytes |
| ELF | 原始/stripped Build ID 均为 `29dc513769e4cd92b1cec3f0e00731772619a03c` |
| 无增量 unsigned HAP | 最后一次干净构建 SHA-256 `02dafc8e21a8dd105d9585c83bb0750d41e0655a33f913431fc46ac344ca969e`；80,396,248 bytes |

## 5. 自动化与构建

| 门禁 | 当前结果 |
|---|---|
| `cargo fmt --all` | 通过 |
| `cargo test --workspace` | 通过；`runtime_integration` 541 passed，其余 targets/doc tests 通过 |
| `cargo clippy --workspace --all-targets -- -D warnings` | 通过 |
| Harmony 非服务型契约 | 52/52 通过；fixture server 不算测试 |
| Harmony 类型检查 | 通过 |
| 无增量 HAP | `BUILD SUCCESSFUL` |

构建仍输出既有 ArkTS 异常提示、deprecated API、NAPI 校验和未签名警告；它们不是本轮新增逻辑失败，
也不能被“构建成功”掩盖为已治理。

HAP 容器包含构建时元数据；相同产品源码重复无增量打包时 NAPI/ELF 哈希保持不变，但 HAP SHA 会变化。
本表固定最后一次干净构建的交付文件，不把它描述为字节级可复现构建。

## 6. VM 证据

### 6.1 安装与启动

- Tablet `127.0.0.1:5555`：最终 HAP 安装成功，进程 PID `14940`。
- Phone `127.0.0.1:5557`：最终 HAP 安装成功，进程 PID `1783`。

### 6.2 受控远程纵切

Tablet 上共启用 10 个书源，其中多个旧 fixture 不在线。修复前任一早期失败会让整体“搜索失败”，受控
健康源没有请求；修复后健康 A/B 源仍被请求，页面展示 `VM 纯文字书`，聚合为 `共 3 个书源`。

对未在该代表源入架的同书点击“加入书架”后，重置过的受控服务记录到 2 个相邻章节正文请求；详情按钮
切换为“移除书架”。随后服务切离线：

- 详情点击“继续阅读”显示 `〔纯文字源 A〕离线文字已缓存`，服务端 `requests=0`、`offlineRejectedRequests=0`。
- 强停并离线冷启后，从书架“继续阅读”再次显示同一缓存正文，服务端仍为 0 请求。

这证明正文缓存是主路径，不是网络失败后的备用回退。受控请求数不是性能基准；没有 p95、CPU、内存的
before/after，因此不声明性能提升百分比。

### 6.3 旧 L0 旅程边界

Phone P1–P6 与 Tablet T3 的完整生命周期证据来自本轮当前主线的前一精确 HAP；T1/T2 缺陷已在本轮
源链上关闭。之后的改动只触及搜索编排/来源栏，并已由最终 HAP 的远程纵切覆盖；没有机械重跑全部 9 个
旅程。因此可以说“原 9 个已知旅程问题已处理”，不能说“最终 HAP 重新逐项执行了 9/9”。

## 7. 历史时点保留给用户处理的冲突

以下不是遗漏，而是存在两个合理产品方向，工程侧未静默选择：

1. **缓存窗口可配置**：当前固定当前章前后各 2 章。是否提供类似 Legado 的用户设置、以及“后几章”
   是否包含书末章节，需要确定设置模型与默认值。
2. **多源聚合的代表来源**：组级“已在书架”表示任一来源已入架，但打开的第一代表来源可能仍显示“加入书架”。
   可选方案是来源选择器、优先打开已入架来源，或把书架身份提升为跨源书籍身份。
3. **自动换源深度**：当前自动尝试第一排名候选，失败后交还人工面板。是否自动串行尝试全部候选涉及流量、
   登录态和错误可见性。
4. **更新调度**：当前在应用前台/冷启检查更新；真正 OS 后台定时任务需要生命周期、权限和耗电策略。
5. **目录产品态存储模型**：当前用保留型 cache namespace 持久化目录产品态。是否迁移到专用 schema/table
   涉及原子迁移和回滚策略。

此外，Tablet VM 当前保留本轮 T1/T2、受控书源和远程书籍 fixture，便于复验；未删除或重置既有用户数据。

## 8. 最终证据边界

| 证据层 | 状态 |
|---|---|
| Core 实现 | 完成 |
| Harmony 产品接线 | 完成，5 个冲突项除外 |
| 自动化 | 通过 |
| 构建与身份链 | 通过 |
| Phone/Tablet VM | 安装启动通过；关键新增远程链路在 Tablet 通过 |
| 真机 | 0 |
| 用户验收 | 0 |

当前准确结论是：**非冲突逻辑缺口已补齐并形成可追溯 HAP；产品发布仍需用户先决定 5 个冲突项，并完成真机与用户验收。**


## 9. 2026-09-09 Demo 修复时点证据

本节是本轮执行的时点记录，不重新解释前文历史产物或设备结论；当前任务只维护在
[DEVELOPMENT_BACKLOG.md §8](DEVELOPMENT_BACKLOG.md#8-demo-修复现场更新2026-09-09)。

### 9.1 实现身份与审计项对应

- Core：`6b2a9d87048e3da812bec08b7c2b3fff1c16e2e2`，17 个文件；从干净 `d2d661dd` 修复并提交。
- Harmony：`35f2f99a8d635615475fde75120bf8629f944565` 上的共享工作树。初次同步 38 个文件均通过
  基线哈希校验；此后 Cookie/ArkWeb、阅读错误日志、分组更新动作和门禁证据标签只打小补丁，没有回填整份旧共享文件。
- 初次同步回执：[integration-receipt.json](evidence/demo-repair-20260909/integration-receipt.json)。
- 原生库：[core-build-identity.json](evidence/demo-repair-20260909/core-build-identity.json)；raw NAPI SHA-256
  `c8d80e309735451ec3f06ef475f2eab2c6477ef95be5beef8782ac92ce41a2c6`，已同步到 Harmony entry/libs。
  raw 与 HAP 内 strip 后 SHA 是不同证据，包内哈希必须以本轮 manifest 为准。

| 9 月 8 日审计项 | 本轮代码与行为证据 |
|---|---|
| 01 目录缓存 | 新旧数组/envelope 统一解码，损坏派生缓存按 miss 恢复，混合书架回归通过 |
| 02 EPUB 缺章 | 必需 spine/nav 正文读取错误和全空书明确拒绝；缺文件/缺 manifest/空章节回归通过 |
| 03 JS 取消 | 请求级 token 与绝对期限贯穿回调和恢复执行；catch 后循环、纯循环、shutdown 回归通过 |
| 04 Cookie | 分代块+提交索引+恢复 journal，空 jar 提交；18 个中断写点、清除失败、旧格式迁移、迟到 HTTP/WebView 写回均回归通过 |
| 05 入架后返回 | 页面订阅与事务完成分离，退出后仍刷新和预取，gate 在成功/失败终态释放；实际方法故障注入通过 |
| 06 来源版本 | 主搜索/详情/目录/正文及 source.check 持有不可变规则；更新/删除和发布共用原子边界；来源漂移回归通过。未将该结果扩展到全部高级来源工作流 |
| 07 正文缓存 | SQLite 条件 UPSERT 与持久逻辑时钟，同毫秒、乱序并发、重启/恢复回归通过 |
| 08 ArkWeb | 主文档 DNS pin 与字面私网拦截回归通过；后续新域名 DNS 和全引擎请求覆盖未证明，保持部分完成 |
| 09 资源预算 | 本地 Host/Core 64 MiB、磁盘余量和 stage 恢复；HTTP maxLimit 64 MiB；GZIP 32 MiB/取消检查。平台配置不等于设备内存峰值实测 |
| 10 DNS 期限 | 第一段 DNS 前建立 25 秒 deadline 与取消；DNS 挂起取消、同域串行绑定/释放、私网反弹拒绝回归通过 |
| 11 详情刷新 | 缓存先返回后，后台复用已启动的同一请求；不再不可达或重复请求，身份检查保留 |
| 12 WindowStage | install 返回有效结果与 generation，过期成功/失败均不加载旧 stage；实际方法故障注入通过 |
| 13 分页末页 | 自然 49/50/51 份响应完整；有第 52 页时明确预算错误，不缓存悄然截断的目录/正文 |
| 14 日志 | UI/Host/阅读页字符串改用系统私密字段；纯业务 gateway/TTS 的 console 只输出固定错误分类，保留脱敏诊断；未证明关闭隐私遮蔽后的特权日志完全无原文 |
| 15 CLI 门禁 | 移除 NoVerifier，读取上限/读取错误/charset 优先级收口；manifest 明示 CLI 诊断不代表 Harmony Host，通过不再暗示设备旅程通过 |
| 16 导入反馈 | 大小/空间/损坏/读取/恢复待处理分类可见；rollback 失败或 import.persist 回执丢失保留可恢复资源并显示待确认，完整 EPUB stage 崩溃恢复不删除惰性图片来源 |

同时按现有产品决定落实统一本地+在线搜索、结果标签及默认分组；最小书源校验兼容内置 1951 条。
完整结构化书源编辑、WebView 引擎网络隔离及真机验收没有由这轮静态修复替代。

### 9.2 验证与边界

[verification.json](evidence/demo-repair-20260909/verification.json) 绑定本轮日志哈希。
Core 全量 `--workspace --all-targets --locked --offline` 为 **3588 passed / 0 failed，91 个目标**。
首次沙箱测试的三个本地 WebDAV socket 绑定 EPERM 在获得命令执行许可后复测通过，不隐藏为代码失败。
fmt、clippy（-D warnings）、210 项 conformance、严格协议漂移、C/C++ FFI 和 Harmony Native SDK smoke 通过。

Harmony 在并行动效继续变动前通过 162 个本地合同；后加 Cookie/ArkWeb 定向回归通过。
20:00 的共享工作树全测停在 continuous-reading 旧 animation:true 断言；已通知动效负责人处理其
reduced-motion 变动对应的合同，本轮未改回动效代码。最终 HAP/设备证据待双方稳定后统一记录。

本轮修正原审计的一处事实：API 23 HTTP `maxLimit` 默认 5 MiB、最大 100 MiB，原“平台响应无上限”
表述过强；新的 64 MiB 显式上限和 GZIP/输入约束仍各有独立意义。

SQLite schema 已从 15 升至 16。旧二进制不能直接假定可回退；所有设备操作仍必须保留用户数据，
不得以卸载/清数据处理升级或验证故障。


### 9.3 统一候选构建结果（2026-09-09 20:24）

双方冻结后生成同一 signed iteration 候选，包含业务修复及并行动效代码：

- [manifest.json](Reader-for-HarmonyOS/.reader-artifacts/hap/20260909T122341Z-35f2f99a-8afc29e6/manifest.json)
- [签名 HAP](Reader-for-HarmonyOS/.reader-artifacts/hap/20260909T122341Z-35f2f99a-8afc29e6/entry-default-signed.hap)
- HAP SHA-256：`d169da45a1f902ddbbc3ee66b939ec599a794b8976cf981963b5b2dbd81f61df`。
- 包内 Core NAPI SHA-256：`43363d1286453492ee73afeb81e5d830154406ae3951cb9e7afe3f25ae7d69e5`；
  pipeline 已验证它等于输入 raw NAPI 经当前 strip 工具处理的结果。
- 构建输入指纹：`8afc29e6037602a1344d1d50d7fd990973c34642107938a2830657697363c708`。
- 165 项 Harmony 合同通过；ArkTS、隔离无增量编译、debug 签名与独立 manifest verify 通过。
- 包内源集合字节验证为 1951 条、1737 个唯一身份；未运行批量 live 源检查，不代表当前全部可联网。
- 两次先前失败日志与第三次成功日志保留在本节证据目录：第一轮旧动效断言；第二轮四处 SDK 兼容
  问题（两处参数属性、WebView nullable 声明、Button Text 属性）；均修正后重新执行完整 pipeline。

Harmony 仍含多任务共享未提交内容，因此 `acceptanceEligible=false`，不伪造干净候选。
已将这个 manifest 交给动效任务先行保数据安装/定点验证；此时尚未收到部署回执。设备交还后业务旅程
继续使用同一候选。构建成功不关闭 ArkWeb 全引擎网络边界、真机或用户验收。


### 9.4 同一候选 VM 安装回执（2026-09-09 20:27）

已读取流水线产生的
[部署回执](Reader-for-HarmonyOS/.reader-artifacts/hap/20260909T122341Z-35f2f99a-8afc29e6/deploy-vm-6460677a198b-20260909T122705Z.json)：
`targetRef=6460677a198b`，signed HAP SHA 与 §9.3 完全相同，`dataPolicy=preserve`，install/launch 均 PASS。
此操作由持有目标锁的动效任务执行；回执只证明覆盖安装和启动，不关闭业务交互、真机或用户验收。


协作反馈：新 VM 中 schema 已为 16，书架/书源/阅读进度数量与安装前一致（1/1737/2）。
该数量反馈来自动效任务，业务任务尚未独立复核。动效定点的 Full 朗读滚动未通过，正在由原负责人
定位；该现象不因本轮业务单测或安装通过而关闭。CLI 另外完成本地可执行文件重建，旧 NoVerifier
标记已消失，构建及二进制 SHA 记在本轮 verification.json，仍不替代 Harmony Host 旅程。


### 9.5 交接时共享候选（控制层定点修正后，最终候选见 §9.6）

当前交接候选为
[manifest](Reader-for-HarmonyOS/.reader-artifacts/hap/20260909T131829Z-35f2f99a-20999210/manifest.json)，
signed HAP SHA-256 为 `fe44fa2fd8c3677781218970b3ebc6d50d942250cf705a6983fce9c78608852d`。
本任务重新执行 manifest verify 为 PASS，并读取该候选
[保数据部署回执](Reader-for-HarmonyOS/.reader-artifacts/hap/20260909T131829Z-35f2f99a-20999210/deploy-vm-6460677a198b-20260909T132010Z.json)，install/launch PASS。

逐文件对比原 d169 候选与本候选，构建输入差异只有 `ReaderControlPanel.ets`，全部业务文件和 Core NAPI
相同，结果存于 [candidate-source-comparison.json](evidence/demo-repair-20260909/candidate-source-comparison.json)。
动效任务报告已经去除临时诊断，修复淡出后仍命中的导航/亮度层，底部起滑、深滚动收起、重新展开顶部
定点通过。这不是本任务的 Figma 连续视觉验收。本任务将后续业务交互单独绑定本候选，不使用中间诊断包
拼接其他候选的验收。

### 9.6 最终迭代包与业务 VM 验证（2026-09-09 23:01）

本轮最终产物为
[manifest](Reader-for-HarmonyOS/.reader-artifacts/hap/20260909T144521Z-35f2f99a-cb6bfc9f/manifest.json)
及 [signed HAP](Reader-for-HarmonyOS/.reader-artifacts/hap/20260909T144521Z-35f2f99a-cb6bfc9f/entry-default-signed.hap)。
signed SHA-256：`7fc3af9adc82c33a5ebf3a5193c6bd6844677eeccc118080e64b60376f4911ac`。
165 项 Harmony 合同、ArkTS、无增量构建、debug 签名及独立 manifest verify 均通过。
Core 仍为干净提交 `6b2a9d87`，包内 NAPI SHA 仍为 §9.3 的 `43363d12…69e5`；Core 全量结果仍为
3588 passed / 0 failed。Harmony 含共享未提交工作，故继续是 `iteration / acceptanceEligible=false`。

本任务在确认原 Mate 80 Pro 实例、boot completed 和稳定 SceneBoard 后，通过唯一流水线完成
inspect 与保数据覆盖安装；[最终部署回执](Reader-for-HarmonyOS/.reader-artifacts/hap/20260909T144521Z-35f2f99a-cb6bfc9f/deploy-vm-6460677a198b-20260909T145831Z.json)
记录 `targetRef=6460677a198b`，install/launch PASS、dataPolicy=preserve。
没有卸载、清数据、重启或替换 VM。23:01:32 已返回书架并退出 probe，确认目标锁释放。

设备验证发现并实际补修了静态检查未覆盖的两个问题：

- 书架封面中心长按不响应，标题长按可用。封面纯视觉子树参与命中；由原动效负责人仅补
  `enabled(false) + HitTestMode.None`，不改变位置、缩放和动画。该修改在 e39d 候选验证封面中心点击
  进入正文、中心长按、标题长按及列表/宫格端点通过。
- 搜索页的普通 Builder 参数保留旧状态；改为直接读取状态后，选中样式、数量与停止图标恢复，
  但 API 23 的 Repeat 仍保留旧可点击条目，改成状态数组也未关闭。最终采用显式通知的
  `IDataSource + LazyForEach`，保留按需加载，并在投影替换时刷新条目及其选择回调。
  e39d、8f01 两个未完整修复候选均保留为失败/部分证据，不计为搜索通过。

最终包的实际业务结果：

| 检查 | 结果及证据边界 |
|---|---|
| 搜索与停止 | 在线返回结果，停止时保留 354 个聚合结果；已搜索 34/190，失败 4。结果只代表该次部分搜索，不能解释为 190 个源全部可用 |
| 全部→本地→在线 | 本地为 0，截图及布局均确认没有残留结果或可点击旧行；在线恢复 354，停止状态及 34/190 计数不变；该次 VM 没有本地书，不证明本地命中旅程 |
| 在线已入架标记 | “已在书架”可见，聚合来源数随真实结果更新；选择结果能进入对应来源详情并返回搜索 |
| 默认分组 | 整理入口和长按“编辑分组”均打开仅有默认的选择栏；详情在书源下显示“分组：默认”；“检查更新”单独成行。这组入口在 fe44 验证，最终详情显示再次验证 |
| 书架封面交互 | e39d 上中心点击、封面长按、标题长按和列表/宫格端点通过；最终包与 e39d 仅 SearchPage 不同，其他 478 个输入相同 |

最终源码 479 个输入逐文件哈希全部匹配包快照；比较见
[final-source-comparison.json](evidence/demo-repair-20260909/final-source-comparison.json)。
运行截图、原生布局和带文件哈希的 probe 日志位于 [vm](evidence/demo-repair-20260909/vm)，
汇总及哈希索引见 [verification.json](evidence/demo-repair-20260909/verification.json)。
控制层由原任务维护，参见其 [执行记录](Reader-for-HarmonyOS/docs/qa/MOTION_REPAIR_EXECUTION_2026-09-09.md)。

仍开放：ArkWeb 新子请求/重定向域名 DNS 和全引擎网络限制；平台 DNS pin、HTTP 上限的设备故障注入；
本地文件选择器、低空间、杀进程恢复及本地匹配结果的完整设备旅程；登录、多源正文、离线/换源及物理真机；
结构化书源编辑器；动效连续画面、Figma 逐帧和用户验收。现有单测及本轮局部 VM 通过不关闭这些任务。

## 10. 本地书格式能力与完整性审计（2026-09-10）

本轮由“所有本地格式统一解析书名/作者”和“MOBI/AZW3 为什么不可用”继续展开，用户要求详细分析并进入能力缺口补全。
结论：限制来自应用的静态准入规则，但扩展格式解析器本身也有实质缺口；TXT/EPUB 基线还存在目录与正文完整性问题。
因此应围绕统一的书籍识别、完整正文、目录、资源与生命周期补齐能力。
当前开发顺序及关闭条件仅维护在 [DEVELOPMENT_BACKLOG.md §6.5](DEVELOPMENT_BACKLOG.md#65-阅读离线与本地书)，任务为 LOC-001/002/004；本节仅记录本次证据与工程判断。

### 10.1 证据范围

- 当前 Core：`main / 6b2a9d87048e3da812bec08b7c2b3fff1c16e2e2`，包含本任务上一轮统一元数据解析的未提交修改。
- 当前 Harmony：`codex/appearance-progress-axis-20260904 / 35f2f99a8d635615475fde75120bf8629f944565`，含其他任务共享未提交修改；本轮未修改应用源码。
- 使用当前本地 CLI 的同一 Core JSON 命令入口，读取 Downloads 与 iCloud Downloads 中 13 个实际文件路径（12 个不同内容身份）。其中 MOBI/AZW3 为 9 个路径、8 个不同内容身份。
- 9 个独立合成探针覆盖错误导入和 EPUB 导航；成功导入的探针经过独立临时数据库持久化，并启动新 CLI 进程读取正文和全书进度长度。它们证明 Core 存储/重启路径，不是 Harmony 应用冷启动证据。
- [原始结果及源码哈希](evidence/local-format-capability-audit/results.json)、[结构核对](evidence/local-format-capability-audit/structure-checks.json)、[可重放探针](evidence/local-format-capability-audit/probe.py)。用户书籍只保存名称、哈希、头信息和统计，不复制正文或封面图像；合成输入可完整保存。
- CLI 已从当前源码重新构建，并重放上述 13+9 个输入；[核验记录](evidence/local-format-capability-audit/verification.json) 确认 CLI 与结果哈希一致、关注源码未漂移。8 个合成输入成功提交并跨进程读取，其中包含本次要修复的错误成功，不能记为产品验收通过。
- 未构建、安装或验收新 HAP。本轮没有将源码或 Core 结果升级为 VM/真机可用结论。

### 10.2 “不可用”的规则来源

`Reader-for-HarmonyOS/entry/src/main/ets/app/ReaderLocalBookFormatAdmission.ts` 把 TXT/EPUB 标为 `l0`，
MOBI/AZW/UMD 标为 `deferred-partial`，PDF/HTML/Archive/WebDAV 标为 `not-admitted`。
选择器常量固定为 `TXT、EPUB|.txt,.epub`。
`tools/test-local-book-format-entry.mjs` 验证这个固定范围，主要检查列表、文案和导入接线；它不动态证明各格式正文是否完整。

Git 记录显示，2026-08-27 的 `ae708c8362165bc7429c189e3caca14c1609050f`（`fix(scope): admit only L0 local formats`）
将原来包含 MOBI/AZW/AZW3/KF8/UMD 的入口收窄为 TXT/EPUB。
这是工程实现中的阶段范围规则；不能据此推导为 HarmonyOS 不支持这些字节格式，也不能从提交者身份推导用户明确批准了每个范围决定。
本轮用户已要求分析补全，LOC-002 不再仅以历史 LATER 状态搁置。

### 10.3 真实文件结果

| 文件 | 输入字节 | 当前 Core 返回字符 / 章节 | 可成立的结论 |
|---|---:|---:|---|
| 覆汉 MOBI | 8,522,384 | 2,951 / 1 | 书名作者可识别，但只有正文片段 |
| 从红月开始 MOBI | 8,916,557 | 3,814 / 1 | 两个不同文件名的文件内容 hash 相同；内部 MOBI 版本为 8，不能按后缀当作旧 MOBI |
| 绍宋 MOBI | 7,507,202 | 8,192 / 1 | 碰到预览字符上限 |
| 凡人修仙传仙界篇 MOBI | 13,330,897 | 8,192 / 1 | 碰到预览字符上限 |
| 国家意志 MOBI | 8,784,359 | 8,192 / 1 | 碰到预览字符上限 |
| 三体全集 MOBI | 3,267,272 | 8,006 / 1 | 多册内容只产生单章片段 |
| 重生后才发现我有青梅 MOBI | 6,810,239 | 6,716 / 1 | 单章片段 |
| 《问道红尘+[仙子请自重]》+作者：姬叉.azw3 | 17,805,183 | 7,347 / 1 | 内部版本为 8，返回 `format=azw`，Book.kind 仍为 MOBI；未形成 KF8 全书读取 |
| 湛蓝权杖 TXT | 3,131,250 | 1,066,896 / 3 | 正文规模已读入，数字点号标题识别不足 |
| 朱门风流 TXT | 6,780,654 | 3,390,939 / 944 | 实际长书可分章；本轮未人工逐章核对 |
| 苟在妖武乱世修仙 EPUB | 6,255,978 | 3,813,601 / 1,101 | 可解析实际长书，末目录为第 1100 章大结局；不是所有 EPUB 兼容性的证明 |
| 终宋 EPUB | 10,303,562 | 导入解析失败 | 目录指向不存在的 `OEBPS/Text/banquan.xhtml` |

MOBI 头里声明的未压缩正文量在数百万至一千多万字节，与返回数千字符明显不相称；这两种单位不能直接计算“读了百分之几”。
这组实际 MOBI/AZW3 文件的记录头 `encryptionType=0`，压缩方式均为 PalmDOC（2）；它们的失败现象不能归因于“全是加密书”或 HUFF/CDIC。
本轮没有独立解出它们的完整正文作为基准，因此不声称已核定每本书的真实总字数和目录数。

《湛蓝权杖》出现 `1.倒计时`、`2.河狸镇` 等标题。启发式搜索找到 390 个相似短行，其中也包含作者说明等，不能直接当作 390 章；
当前默认检测以“第…章/卷”和 Chapter 等为主，需建立少量人工标注的目录基准，再补规则与误判测试。
《终宋》实际 spine 列出 1,369 个文件，逐项检查都在包中；NCX 有 1 个失效目标。这里只证明文件存在，尚未逐篇验证内容可解码。

### 10.4 解析器缺口与严重程度

**MOBI：完整正文缺失，且存在头字段错误。**

`crates/reader-local-book/src/mobi.rs` 的“full”路径实际调用 `extract_text_preview`：
原始解压文本累计约 32 KiB 后停止，再截断到最多 8,192 字符，最后构建单章。
目录、内嵌图像和链接结构不会成为可读书籍资源；MOBI 标签被剥离。某条记录范围无效时直接跳过，未进行全书完整性核验。
`PalmDocHeader.record_count` 未用于限定正确正文记录范围，压缩记录尾部附加数据等兼容行为也缺少完整处理。

独立对照解析库发布的结构文档，当前字段宽度/坐标有基础错误。下表统一使用 Record 0 起点为 0：

| 字段 | 当前代码读取 | 公开结构文档 |
|---|---|---|
| text record count | offset 8，32 位 | offset 8，16 位 |
| text record size | offset 12，32 位 | offset 10，16 位 |
| encryption type | 没有对应读取 | offset 12，16 位 |
| full name offset / length | 64 / 68 | 84 / 88 |
| EXTH flags | 108 | 128 |
| DRM offset / count / size | 116 / 120 / 124 | 168 / 172 / 176 |
| 旧格式 first / last text index | 136 / 140，32 位 | 192 / 194，16 位；KF8 对应位置有不同语义 |

坐标依据：[Record 0 文档](https://www.fabiszewski.net/libmobi/structMOBIRecord0Header.html)、
[MOBI header 文档](https://www.fabiszewski.net/libmobi/structMOBIMobiHeader.html)。这只是字段契约核对，未复制库实现。
真实样本的“title offset”被当前代码读成 `0xffffffff`，随后靠 EXTH 搜索等路径仍能取到部分元数据。
内置 `craft_mobi_with_metadata` 却按上述错误位置生成数据，所以该测试通过不能证明真实格式契约正确。

**AZW3/KF8：缺少独立的内容重建能力。**

`parse_local_book` 将 AZW 家族也交给同一 MOBI parser，只改格式分类。
现有代码没有将 KF8 的正文片段、骨架、流索引和资源映射还原为完整阅读顺序，也没有 HUFF/CDIC 解压。
因此补旧版 MOBI 后仍不能直接放开所有 `.mobi` 文件；本轮《从红月开始》的 `.mobi` 实际就是 v8。
未来准入要同时判断容器、内部版本、压缩和保护状态。

**失败被转换为成功：必须优先修复的公共问题。**

MOBI `Err(_)` 捕获所有结构、压缩、DRM 失败，转为二进制可读片段或固定诊断文字。
UMD 截断块通过 `break` 提前结束；无正文时同样返回固定文字。PDF 无文本返回 OCR 诊断占位文字。
正常 `LocalBook` 和导入 preview/summary 没有能够阻止这些结果被当成完整正文提交的完整性字段。

本轮在临时数据库验证了完整的 Core 提交与重启读取：

| 合成输入 | 现有结果 |
|---|---|
| 只有签名、没有有效记录的 78 字节 MOBI | `import.parse`、`import.persist` 成功；重启读取 `mobi metadata-only local book entry`，全书长度也按该占位计算 |
| 声明未支持压缩方式的 MOBI | 成功提交二进制中的可读碎片，包含 MOBI/HTML 标记 |
| encryption type 标为 2 的合成 MOBI | 没有因保护标记拒绝；此样本只有标记，未实际加密，不代表解密能力 |
| 内容块长度超出输入的 UMD | 成功提交 `umd metadata-only local book entry` |
| 只有 PDF 签名和 EOF 的 15 字节输入 | 成功提交 `text_unavailable_without_ocr` |
| 简单 HTML 文档 | 被按 TXT 导入，原始 HTML 标签和 head 内容进入正文 |

这解释了为什么“有 parser、导入返回成功、可以进阅读页”不能作为支持规则。

**EPUB：已有可复用基础，但阅读顺序与导航混用。**

已经具备 ZIP/OPF、spine、EPUB2 NCX、EPUB3 nav、段落和图片定位符、显式封面、解压预算等基础。
但有 nav/NCX 时直接用目录项构建正文，spine 只作为目录缺失/为空时的后备。
导航内容读取还扫描所有 `<a>`，没有限定 `epub:type=toc`；路径统一相对 OPF 目录解析。
对照 [W3C EPUB 3.3](https://www.w3.org/TR/epub-33/)，spine 的阅读顺序、目录导航与其他导航应分别处理。

三个独立小样本给出可重放的结果：

1. spine 有两个正文文件，目录只链接第一文件：导入成功，只保存第一段；重启读取第二章报不存在，第二文件末段未被纳入全书长度。
2. nav 放在子目录并使用正确的相对链接：当前解析成 `OEBPS/../Text/one.xhtml`，导入失败。
3. 额外加入 landmarks 指向第一文件：生成两章，但两章都是第一段；第二段仍缺失。

因此既要阻止漏正文的成功，也要允许有依据的恢复：如全部 spine 正文可验证，而某条目录链接失效，可以重建目录并记录警告。
不能通过一律忽略坏链接来掩盖实际正文缺失，也不能把一条导航错误等同于整本正文损坏。
当前文本投影会移除 CSS 和多数标签；完整排版、脚注和链接语义仍需明确目标和验收，不能宣称完整 EPUB 渲染系统。

**UMD/PDF/HTML 与入口型能力。**

UMD 当前读取自定块布局、GBK 字节与 XOR 元数据，无 zlib 正文处理；fixture 生成器明确说明按当前 parser 布局生成、与其所述历史格式不一致。
这足以说明测试不独立；生成器对历史规范的具体描述本身也未经本轮独立核实，不能照抄成修复规范。本轮未找到真实 UMD，真实兼容性保持未证明。
PDF 是扫描文本操作符的单页文本提取器，缺字库映射、真实页树、压缩流完整处理和页面显示体系。应归为独立固定版式工作流。
HTML 当前只是 TXT 路由，需要真正正文、标题、链接和资源解析。
Archive 是容器入口，WebDAV 是取得文件的方式，应复用取得字节后的格式解析；它们不应被当作两种新的正文格式解码器。

### 10.5 公共链路中可复用与需补齐的部分

| 环节 | 已有基础 | 实际缺口 |
|---|---|---|
| 书名/作者 | 上一轮已统一显式值、有效内嵌元数据和结构化文件名候选 | 目前结果主要是书名/作者二元组；版本/章节范围、候选出处、原始名称与手动修改保护没有完整迁移合同 |
| 文件身份 | Host 按原始字节 SHA-256 建立 `local:<hash>`，Core 验证身份 | 身份应保留；重建解析缓存不能因分章或标题变化另建同一本书 |
| 导入事务 | Core 具备 commit/rollback，Host 有 staging、校验和恢复 | 需要完整性合同；`parse` 与 `persist` 重复解析，整个 `LocalBook` 还会序列化和复制章节正文，不能直接解除预览上限 |
| 原文件 | Host 复制校验、限额、EPUB 原包保留与恢复 | `assetKind` 只有 epub/none；其他格式成功后暂存文件被丢弃。扩展图片和按需解码必须补通用原文件保留/删除/恢复 |
| 资源读取 | `LocalEpubResourceHost` 可按受限 locator 读取包内图片 | 路径固定 `<hash>.epub`，RuntimeOwner 识别 `reader-local-epub://`；MOBI 等还未接统一资源读取 |
| 章节/资源模型 | Core 已有 catalog、chapter/resource index、parserVersion、缓存状态等结构与纯计划函数 | 当前导入主链仍直接写章节正文缓存；`local_book.catalog` 返回更新后的值、并未接入这一提交链。应收敛现有模型，避免新增平行实现 |
| 阅读与进度 | `local_book.chapter.content` 和 metrics 共用处理后的正文，已有目录、进度、书签等消费者 | 上游只有片段或重复正文时，长度、100% 进度、搜索范围和书签位置都会失真；重解析要做位置迁移 |
| 错误 | Host 已区分大小、空间、读文件、解析和恢复问题 | 部分 Core 格式错误被标 INTERNAL/retryable，Host 主要用字符串分类；需要可区分且可恢复的稳定错误码 |

现有 Host/Core 原始文件上限为 64 MiB，EPUB 单项/累计解压文本预算为 32/256 MiB。
这些是具体实现上限，并非“文件在上限以内即可完整导入”的保证。
完全解码长篇时，原字节、解压正文、JSON 投影、章节缓存与导入日志会叠加；需要实际峰值内存和耗时测量，再决定流式处理、按章物化和缓存策略。

### 10.6 实现路线的判断依据

优先建议把格式解码输出收敛到已有 Core 的书籍、阅读顺序、目录定位与资源模型，Host 承担文件生命周期和系统图像读取。
“统一”意味着元数据优先级、错误、资源访问、位置语义和验收一致，各格式仍使用自己的解码器。
不必为了共用规则，把每个格式先重打包成 EPUB；尤其当前 EPUB 导航模型本身需要修复。

| 方案 | 适用性与待验证事项 |
|---|---|
| 延续自有 Rust 解码器 | 容易维持当前所有权和构建方式；先修字段/完整性，再处理压缩、KF8 索引与资源。复杂度主要在真实变体和完整性，不能视为几个正则或提高常量 |
| 引入解码库，外层仍使用 Core 公共模型 | libmobi 官方说明支持旧 MOBI/KF8 及结构重建，为 C 库、LGPL-3.0-or-later；值得做小规模语料和 Harmony 交叉构建试验，许可证与交付方式须核验。本轮未引入、未证明其在本项目可用 |
| 使用 Rust MOBI 库 | mobi-rs 是候选，但其 HUFF/CDIC 问题仍开放；不能仅凭库名假设完整 AZW3/KF8 支持，仍需能力试验 |
| 外部转换工具 | 可用于用户自愿转换或作为独立比对工具；不是手机端原生导入闭环，转换后的字数/目录也不能未经检查就当唯一真值 |

外部资料：[libmobi 官方说明与许可证](https://github.com/bfabiszewski/libmobi)、
[mobi-rs](https://github.com/vv9k/mobi-rs)、[HUFF/CDIC 未完成项](https://github.com/vv9k/mobi-rs/issues/27)。
工程推荐先确定公共完整性合同、修复已有 TXT/EPUB 基线，再以真实 v6/v8 语料验证解码路线。
在 KF8 结构重建、资源读取和 Harmony 性能试验前，不给出缺乏依据的精确工期。

### 10.7 何时可以宣称支持

每种拟开放的格式应有独立真实样本和可控长书样本，并覆盖以下证据，而不是累计测试数量：

- 书名、作者、版本信息正确；书籍原始身份不变，手动修改不被重新解析覆盖。
- 首段、中段、末段均可读；完整阅读顺序无漏段、重复、异常二进制碎片，目录跳到正确位置。
- 封面、正文图片和约定支持的链接/脚注可用；正文缺失与非关键资源缺失区别处理。
- 搜索可以命中末段；全书长度、进度、书签、重启后恢复和重新导入位置一致。
- 截断文件、未支持版本/压缩和受保护内容得到准确失败；导入失败不留下正常可读假书。
- 大文件、中断/取消、低空间和进程退出可恢复；峰值内存/耗时在目标设备上有数据。
- 更新选择器、格式说明与合同测试后，分别取得 Core、Host、manifest 绑定 HAP、VM 和真机旅程证据。

本轮仅完成分析、重放证据和唯一清单更新；上述缺口尚未实现修复，也没有扩大产品选择器范围。

### 10.8 本地书链路修复与真实样本重放（2026-09-10）

本节是 §10.1–10.7 后续的实施证据；此前“尚未修复/未引入依赖”描述仅代表审计时点。
实际修改落在 `Reader-Core-Native` 和 `Reader-for-HarmonyOS` 共享工作树中，保留了原有并行修改。
旧 Swift `Reader-Core` 不在运行链；`Reader-UI` 本轮只参与协议漂移验证，无需新增第三套解析。

**职责与实现。** Core 负责格式/内部版本识别、解码、完整性、目录正文位置、元数据、缓存事务
和旧进度保护；Harmony Host 负责选择/复制、hash 身份对应的原文件、资源访问和恢复；ArkUI
消费结果和失败状态。没有将 MOBI/KF8 解码复制到 ArkTS。复杂解码采用上游
[libmobi v0.12](https://github.com/bfabiszewski/libmobi/tree/v0.12)，删除旧预览/二进制扫描兜底。
上游源码原样保存，Reader C 适配层独立存放；使用内部 XML writer 和系统 zlib，不启用解密。

| 修复面 | 当前代码行为 |
|---|---|
| 完整性 | `LocalBookIntegrity` 包含 schema/parser 版本、complete/recoverable/metadataOnly/unreadable/unverified、正文文件数和警告。旧反序列化结果默认 unverified；正常导入必须明确可读且非空。失败不再以占位文字入库 |
| EPUB | spine 决定完整正文；nav/NCX 决定标题和锚点；正文路径、锚点前缀、重复/乱序目标与子目录路径统一处理。必需正文缺失/不能解码会失败；导航损坏在正文可验证时变为警告 |
| TXT | 共享分章规则增加短数字点号标题，结合连续编号、空行和正文间距，排除小数/密集编号说明。真实目录准确率仍需人工基准，不将章节数增长当作全对 |
| MOBI/KF8 | libmobi 完整重建正文记录、骨架/片段、HUFF/CDIC 和资源；共享 EPUB 投影产生目录、正文和图片 locator。内部版本来自解码结果，`.mobi` 可以为 KF8。无导航的单流可用共享文本分章，并标明推断警告 |
| 导入/大书 | summary 不再序列化整个 LocalBook 正文；内容摘要采用流式 hash。同进程 parse/persist 有受原文件/rules hash 校验的一槽缓存；新进程可重新解析。大书回滚日志与提交同事务持久化，只向 Host 返回小引用；旧入口也走原子提交 |
| Host 文件/图片 | 新导入各格式统一保留 `<hash>.source`，读取兼容旧 `.epub`；提交/删除/失败恢复接入通用原文件。`reader-local-mobi://` 与 EPUB 共用受限资源 Host，按原文件内部签名选择资源解码 |
| 升级保护 | 同一原文件的唯一原文锚点可自动迁移进度、旧版进度和书签，和正文同事务提交/回滚；找不到、存在歧义或无法证明原文件身份时保留旧状态。后续真实旧解析器升级验证见 §10.9 |
| UMD/PDF | 截断 UMD、无正文文件和无可提取文本的 PDF 拒绝；现有 UMD/PDF 提取结果未取得完整性依据时不进入正常书架，诊断不作为正文 |

**真实语料重放。** 原始结果与可重复脚本见
[`results.json`](evidence/local-book-chain-repair/results.json) 和
[`replay.py`](evidence/local-book-chain-repair/replay.py)。重新构建的 CLI SHA-256 为
`a5ad82a4367c72ff468131218a0922c58be8da8d828dccb236f70b0d0140311b`。
13 文件、12 个 SHA-256 身份全部成功解析/持久化，每次读取、搜索、回滚均启动独立进程。
记录只含计数/hash，不复制用户书籍正文和封面到证据。

| 代表样本 | 本次字符数 | 章节数 | 关键结果 |
|---|---:|---:|---|
| 从红月开始 MOBI | 3,281,048 | 918 | 内部 KF8；918份正文重建，冷读后记/末段搜索通过 |
| 覆汉 MOBI | 3,285,576 | 560 | 原来2951字符预览已替换；末尾封面可读，搜索回退到最后有可检索正文的章节 |
| 凡人修仙传仙界篇 MOBI | 4,585,802 | 1,397 | 超过8192字符的完整长书已持久化/冷读 |
| 绍宋 MOBI | 2,659,259 | 442 | 完整单流解码后推断目录，readability=recoverable；不宣称原生导航已恢复 |
| 问道红尘 AZW3 | 3,315,840 | 1,200 | 内部KF8；1200份正文，冷读/末段搜索通过 |
| 湛蓝权杖 TXT | 1,066,896 | 352 | 原来3章的自动目录已改善；编号清单不作章节，作者说明误判已修复；不宣称所有标题均正确 |
| 终宋 EPUB | 4,691,217 | 1,369 | 全部1369份spine正文可解码；失效版权页导航一条警告，整本可读 |
| 苟在妖武乱世修仙 EPUB | 3,825,535 | 1,102 | 正文完整读取，导航前缀也保留 |

13/13 样本均能搜索命中所选尾部正文；如果末章是纯封面，脚本退到最近的可检索正文，
`searchedChapter` 明确记录，不能等同于逐字人工比对全书。冷回滚13/13恢复成功。
另对TXT、EPUB、旧MOBI、KF8 `.mobi` 与AZW3各一本真实书，在独立进程创建并冷读末章进度和
书签，再重新导入同一原文件；5/5均保留章节、字符偏移和书签原文，证据见
[`positions.json`](evidence/local-book-chain-repair/positions.json) 与
[`positions.py`](evidence/local-book-chain-repair/positions.py)。该证据不代表旧预览到新分章的迁移。
8个合成场景中，只有签名MOBI、无效压缩合成MOBI、加密标记MOBI、截断UMD、空PDF全部拒绝；
导航只覆盖首文件、导航子目录和附加导航3本EPUB均保留两份正文并可冷读末段。
无效压缩的旧合成样本同时存在其他头字段缺陷，不能单独作为压缩分支覆盖证据；HUFF/CDIC
成功路径使用上游独立 fixture `sample-unicode-huffdic.mobi` 验证。

**验证与性能边界。** 本地书包237项通过，导入事务13项通过（含大书日志引用回滚、PDF拒绝、
旧进度/书签保护），本地书运行时专项19项通过。FFI包内Runtime分发专项3项通过，成功路径换用
独立上游样本；PDF/UMD可检查unverified提取结果，但提交被拒绝。该专项不等于平台C ABI验收。
4个相关crate的Clippy通过；Host资源架构和
异步恢复测试通过（包括persist已提交但回复丢失时保留原文件）。OHOS arm64 C适配层语法检查
通过，CMake增加zlib链接；完整Core/NAPI/HAP由现有统一交付任务继续验证，不把语法检查写成
Harmony构建成功或设备支持。测试日志位于 `evidence/local-book-chain-repair/`。

macOS `/usr/bin/time -l` 对每个命令测进程峰值，包含CLI启动和冷进程重解析：真实书解析
0.329–3.291秒、最大RSS198,754,304字节（约190MiB）；提交最大238,256,128字节（约227MiB）。
冷末章读取最大14,204,928字节、最慢10毫秒。当前仍存在临时内存package、正文缓存/日志副本；
MOBI图片冷请求会重建原包，取消不能在libmobi内部解码中途生效。不能据此宣称低内存手机、
连续图片、低空间或取消延迟已达标，也没有扩大64MiB输入/256MiB解码预算。

**未关闭项目。** 不能自动定位的恢复入口、手动元数据和历史来源迁移、catalog/index持久化收敛、成功导入日志/孤儿文件回收、
链接/脚注和完整排版、混合容器及HUFF/CDIC真实长书、目标设备图片和内存旅程仍开放。
libmobi来源/原文许可证/替换重建说明和Host包内NOTICE已落地，但公开二进制发布仍须绑定
对应源码、构建/安装材料并验证用户替换库流程，不以“已附许可证文本”宣称发行验收完成。

用户指出下载目录有测试文档后，重新查看本地及iCloud下载目录与 `小说.zip`（19份TXT），
未找到真实UMD。另评估MIT开源候选 [all2epub](https://github.com/zbf1009/all2epub)：其UMD
路径含缺索引返回空内容、超出声明长度时截短及有损UTF-16等行为，当前未直接移植；独立真实
UMD验证仍缺，不能通过自制fixture声称该格式支持。格式选择器保持TXT/EPUB，尚无本任务的
新HAP安装或设备验收结论。当前排期只维护在 `DEVELOPMENT_BACKLOG.md` §6.5。

**统一门禁后续结果。** 现有交付任务完成最终 Core 门禁，3,609/3,609 项测试、210项conformance、
严格契约漂移、格式/Clippy及C/C++实际链接smoke全部通过，日志见
[`full-delivery-core.log`](evidence/paragraph-indent-audit/full-delivery-core.log)。过程中纠正了旧DTO
缺省字段往返、旧数据库fixture缺少历史表、伪MOBI作为成功fixture等测试假设；独立上游样本和
损坏/未验证内容拒绝断言保留。新增zlib静态依赖同时接入C/C++检查脚本、Harmony/Android的
CMake和iOS module map；macOS Swift实链验证通过，静态库SHA-256
`2f7c892c20033788dceb2d2e014af7269abfa4b04e0f8fb31f23f8dc9c0697be`，见
[`swift-zlib-link.log`](evidence/local-book-chain-repair/swift-zlib-link.log)。Swift检查仅证明链接与
C符号调用，未运行iOS/Android产品；其默认macOS链接目标低于库构建目标的警告仍记录在日志中。
Harmony原生库最终构建与38项SDK smoke通过，产物SHA-256为
`7551947ee98fc5079b2b715aaa9f0f4742901d767450e888c69a955d33fed2ac`，18,222,488字节。
Core全部3,119项输入在构建前后保持一致，fingerprint为
`3acf014bef59d0e5185d26c7cf3b48e7a2efce5d19cca72070e13ff93c503761`；该快照包含新增libmobi
源码和所有最终绑定声明，不以仅含commit/dirty的旧buildId替代内容身份。
规范iteration流水线曾在SignHap因`11014003`停止（本地口令与重新生成的keystore不匹配）。
同步自动签名配置后该阻断已解除，最终产物为
[`20260909T184759Z-35f2f99a-3c834980/manifest.json`](Reader-for-HarmonyOS/.reader-artifacts/hap/20260909T184759Z-35f2f99a-3c834980/manifest.json)：
schema v2、signed debug、独立verify通过，HAP SHA-256
`1aa3110e12da47ab64c20cf499fa19757a2ebe4281f65aa9c394e155470573a1`，148,012,116字节。
Core/Harmony均dirty，`acceptanceEligible=false`；Core最终3,119项输入在HAP构建后仍一致，
统一交付证据绑定原始NAPI、strip后NAPI与包内NAPI。该iteration包不自动成为格式验收完成的发布包。

上述签名身份冲突已由统一交付任务在用户专项授权后解决。该任务只重装 Reader 并恢复备份，
未重置 VM；10 个持久文件与 31 张表的原有数据核验一致。已完成交付的包为
[`20260910T013945Z-35f2f99a-9821e2a2/manifest.json`](Reader-for-HarmonyOS/.reader-artifacts/hap/20260910T013945Z-35f2f99a-9821e2a2/manifest.json)，
HAP SHA-256 `31cae9eff9914325edeadf474ae9e28365f778b97a6ee914869ff7cd044df8ad`。
证据见 [`full-delivery-verification.json`](evidence/paragraph-indent-audit/full-delivery-verification.json)
与其中绑定的部署回执。21 项 VM 交互验证属于缩进/搜索等交付范围，不替代本地书格式验收。
本节早期包和“未安装”的记载为历史时点；§10.9 的新增 Native 代码不在上述包内。
完整门禁和原生构建不替代本节列出的格式准入、完整迁移、UMD及设备旅程关闭条件。


### 10.9 旧解析正文升级时的位置迁移（2026-09-10）

本批继续实现 §10.8 的 G/C 工作包，修改限于 Core Runtime/Storage 及其测试；未编辑
Harmony 业务代码、vendored SDK 或已交付 NAPI，也未占用 VM。Core 保持解析和位置事实源，
Host 仍负责原文件及导入完成后的书架流程。所有改动均在原 dirty 工作树上保留，未提交或重置。

**已实现。** 对需要移动的位置，先确认原文件 SHA-256 一致（旧库缺此字段时只接受已验证的
`local:<sha256>` 身份），复用阅读正文投影和已有 regex 库的多模式匹配，在新全文中查找旧位置
附近的唯一原文。匹配只忽略空白，按 Unicode scalar 还原章节内偏移；重复、缺失、短片段、
越界、原文件身份不明或可见的书签身份冲突会返回明确原因，保留旧正文和全部原记录。
不使用全书百分比或原章节号猜测。位置数量和匹配器内存有界，每次扫描仅保留一个新章的投影。

进度、legacy progress、书签位置/章节名及所属书名作者，以及既有书架元数据和目录摘要，
与正文在同一事务提交；书签的时间、
原文和用户批注不变，阅读时间/设备不变，变化后的章节百分比重新计算，旧位置 revision 清除。
历史阅读事件保持为历史记录，不将迁移计为一次新阅读。提交前校验锚点依赖的旧书、章节、
当前进度、书签、书架和目录摘要；回滚也核对提交后的这些状态。后来翻页、改批注或改缓存时，旧计划/回滚
不能覆盖新数据。两种存储后端共用校验，旧无迁移字段的回滚 token 保持兼容。

回滚成功和删除本地书时，清理对应的持久大书日志；删除也清理 legacy progress。
完整日志 hash 与大小预算检查改为流式写入，避免为校验再生成整本书的 JSON 字节副本。
成功导入但尚未结束补偿周期的日志回收，仍是 C 工作包的独立未完成部分。

**真实旧版本升级回放。** 保留的修复前六个解析源文件与当时共用的 metadata 模块重新编译为
独立旧解析探针；其输出写入临时 SQLite，然后用当前 CLI 解析/提交并在各自新进程中读位置、
读原文、读书签、读书架和回滚。不是把新解析器结果人工裁短来冒充旧数据，不接触 VM/真实应用库。
可复验脚本、旧探针源码归档和原始结果分别为
[`migration-replay.py`](evidence/local-book-chain-repair/migration-replay.py)、
[`migration-legacy-parser.tar.gz`](evidence/local-book-chain-repair/migration-legacy-parser.tar.gz) 和
[`migration-results.json`](evidence/local-book-chain-repair/migration-results.json)。结果绑定当前 CLI、
旧探针及源文件 SHA-256，只记录书名、字符数、位置和原文摘要，不保留小说正文。

| 真实文件 | 旧解析 → 新解析 | 选定旧位置 → 新位置（章节从1计数） | 冷进程结果 |
|---|---|---|---|
| 湛蓝权杖 TXT | 1,066,896 字符，3 → 352 章 | 第1章/315523 → 第110章/2054 | 原文、进度、书签一致；完整回滚 |
| 覆汉 MOBI | 2,951 → 3,285,576 字符，1 → 560 章 | 第1章/1475 → 第1章/1639 | 原文、进度、书签一致；完整回滚 |
| 从红月开始 MOBI（内部KF8） | 3,814 → 3,281,048 字符，1 → 918 章 | 第1章/1907 → 第1章/2001 | 原文、进度、书签一致；完整回滚 |
| 问道红尘 AZW3 | 7,347 → 3,315,840 字符，1 → 1200 章 | 第1章/3673 → 第6章/972 | 原文、进度、书签一致；完整回滚 |
| 苟在妖武乱世修仙 EPUB | 3,813,601 → 3,825,535 字符，1101 → 1102 章 | 第1101章/4992 → 第1102章/4992 | 原文、进度、书签一致；完整回滚 |

每本是一个明确的旧位置及同位置书签，不能外推为所有旧位置均可映射。每本回滚引用只有
255 字节；原书、目录、正文、书架、进度、历史和书签的业务值在回滚后完全一致（JSON 存储字符串的
空白/键序不作为差异）。同一内容改分章后，原书签文本与批注保持不变。

**重启才暴露的修复。** 首轮实际回放中，覆汉和从红月开始迁移成功但冷回滚失败。
最小测试定位到 JSON 浮点解析：`0.23637150274012114` 被读为 `0.23637150274012111`，
改变了事务摘要。启用既有 serde_json 的 `float_roundtrip` 功能后，两后端的精度回归以及
五本冷回滚均通过。完整复现保存在 `migration-float-reproduction.log`；这是修复前失败证据，
不能作为当前失败计数，也未通过放宽摘要校验绕过。

**书架摘要补线。** 在第一轮3615项全量测试通过后，追加真实书架重启检查，复现了位置已迁移
但书架仍用旧章节数的问题：湛蓝权杖实际352章，旧摘要仍是3章，进度被夹到100%。
该复现见 `migration-catalog-reproduction.log`。修复将既有书架元数据、目录总数、当前章名
和位置共同纳入提交/回滚，并复用现有 catalog 写锁防止与阅读更新交错。18项导入专项已通过，
五本真实冷书架均返回新的章节数和章名，无须依赖 Host 后续 `bookshelf.add` 才修正。
本段覆盖书架现有按章节投影的进度，不宣称其已变为按全书字符数精确加权。

**验证层次。** 两存储后端的迁移/回滚/并发修改检查通过，导入专项18项通过；真实五书的冷位置、
书签、书架摘要和完整回滚5/5通过。最终完整 Core 门禁 **3616/3616 测试、210/210 conformance、格式、Clippy、严格协议漂移及
C/C++实际链接检查全部通过**，日志见 `migration-core-gate.log`。机器汇总与源码清单见
[`migration-verification.json`](evidence/local-book-chain-repair/migration-verification.json) 和
`migration-source-snapshot.json`；该源码清单算法与HAP pipeline输入算法不同，不混用指纹。
前一轮完整门禁保存在 `migration-core-gate-before-catalog.log`，不与最终代码混用。
先前分包测试中3项本机WebDAV测试曾受沙盒端口权限限制，已在允许本机回环的环境3/3复验通过；
该环境失败不计作产品缺陷。

**仍需交付。** 本批不处理历史手动元数据的判别、其他位置实体的完整迁移、无法匹配时的用户
恢复入口、成功导入日志/孤儿资源回收和MOBI图片缓存。也没有扩大文件选择器。
需要在新的 Native/HAP 中验证真实导入、书架恢复、目录定位、图片、进度/书签、低空间与中断。
已有统一交付包只包含先前解码修复，不包含本批新位置迁移；格式与真机准入仍开放。

### 10.10 本地格式重新审计（2026-09-12）

**结论。** §10.3–10.4 的旧 MOBI 预览截断、EPUB 漏读 spine、损坏文件冒充正文等问题，
已不能作为当前实现的结论。当前 Core 已能完整解码本轮 MOBI/KF8/AZW3、TXT、EPUB 样本，
统一名称解析与进度/书签迁移也有当前重放证据。但本地书能力尚未整体关闭：重新导入会覆盖
手动元数据，划线位置没有随正文迁移，首次导入中断缺少书架补偿，MOBI 图片仍同步重建全书，
成功导入日志持续累积。本轮是重新审计，新增审计探针并回填既有总账，未修改生产实现或扩大格式入口。

**源码与证据边界。** Core 为 `main@6b2a9d87048e3da812bec08b7c2b3fff1c16e2e2` 的 dirty 工作树；
Harmony 为 `codex/appearance-progress-axis-20260904@35f2f99a8d635615475fde75120bf8629f944565` 的 dirty 工作树。
以 [`baseline.json`](evidence/local-format-capability-audit/recheck-20260912/baseline.json) 的文件摘要为准，
不能单独用 HEAD 代表实现。CLI 本轮重新构建，SHA-256 为
`1a5c65c37cdd95b56d12caa3e4a987ebe804497b1f7584bdd986e6b40077b209`。
审计范围覆盖解析/完整性、统一元数据、导入/回滚、位置迁移、文件暂存与恢复、图片调用链、
错误提示及产品格式表。全部重放使用临时数据库，原下载文件只读；未操作应用数据、HAP、VM 或真机。
逐项现象、触发、版本、证据和未决点见
[`observations.jsonl`](evidence/local-format-capability-audit/recheck-20260912/observations.jsonl)，
当前验证汇总见 [`verification.json`](evidence/local-format-capability-audit/recheck-20260912/verification.json)。

**当前格式矩阵。** “选择器不可选”与“Core 无法解码”是不同状态。

| 格式 | 当前代码及本地重放 | 产品入口与剩余边界 |
|---|---|---|
| TXT | 共用书名/作者解析；数字点号目录规则已修复；2 个真实文件通过正文、末段搜索和冷回滚 | 已开放；人工目录基准、手动元数据保护、完整位置迁移和中断恢复未关闭 |
| EPUB | 正文按 spine；导航用于名称/定位；2 个真实文件和3种导航异常构造通过 | 已开放；完整样式、脚注/链接和本轮 Host 旅程未验收；共同导入问题仍适用 |
| MOBI、KF8、AZW3 | libmobi 0.12 重建正文后共用 EPUB 管线；9 个实际路径、8 个内容身份具备成功读取证据 | 仍为 `deferred-partial`；资源性能、恢复、格式细分和交付验证未关闭，不能再笼统解释成只能解析预览 |
| UMD | 可探测；本轮合成正文被标为 `unverified`，提交拒绝；截断结构解析失败 | 仍暂缓；本轮下载目录无独立真实 UMD，既有自制结构不能证明真实格式兼容 |
| PDF | 可提取部分文本；合成文本输出为 `unverified`，提交拒绝；无文本样本解析失败 | 不准入，继续遵守已有 PDF 范围决定；没有渲染/OCR验收 |
| HTML | 仍走 TXT 路由；本轮原始 HTML 被标成 `complete/txt` 并可提交，标签、head 和 script 文本留在正文 | 选择器未开放；这是 Core 能力边界未完成，不应把 `complete` 当作 HTML 正确解析证明 |
| Archive | 有独立索引/提取能力声明；实际 `import.parse` 对 ZIP 返回 `Archive_no_parser` | 未接通通用书籍导入；不能从能力表推断可入架 |
| WebDAV 文件 | 当前本地书边界提供描述信息，远程取字节、鉴权及离线生命周期是另一条链 | 未准入本地书选择器；本轮未作远程服务验证 |

当前准入规则来自 `ReaderLocalBookFormatAdmission.ts:26`，选择器只使用
`TXT、EPUB|.txt,.epub`，对应合同测试还明确锁定了这个集合。这是静态产品准入表，
没有根据单本文件内部版本、压缩、保护状态及资源需求动态判定可用性。
后续应把每种能力的证据和剩余条件写清楚；不能仅因 Core 可探测而开放，也不能继续沿用已修复的旧缺陷解释暂缓。

**真实文件复验。** 本轮扫描既有授权的本地及 iCloud 下载目录，共13个文件路径、12个内容身份。
其中两个《从红月开始》文件内容相同，不能当作两份独立兼容性证据。

| 重点样本 | 当前书名 / 作者 | 字符数 / 章节数 | 当前结果 |
|---|---|---|---|
| 从红月开始，复杂 Z-Library 文件名，内部 KF8 | 从红月开始 / 黑山老鬼 | 3,281,048 / 918 | 解析、提交、冷读、末段搜索、冷回滚成功 |
| 覆汉，校对版全本及多个来源后缀 | 覆汉 / 榴弹怕水 | 3,285,576 / 560 | 同上 |
| 绍宋 MOBI | 绍宋 / 榴弹怕水 | 2,659,259 / 442 | 同上；目录由文本推断，标记 `recoverable` |
| 问道红尘 AZW3，书名内别名和显式作者 | 问道红尘 / 姬叉 | 3,315,840 / 1200 | 同上；当前可用内嵌标题优先于文件名别名 |
| 湛蓝权杖 TXT | 湛蓝权杖 / 躺摆混 | 1,066,896 / 352 | 同上 |
| 终宋 EPUB | 终宋 / 怪诞的表哥 | 4,691,217 / 1369 | 同上；导航含spine外版权页，仍保留完整正文，标记 `recoverable` |
| 凡人修仙传仙界篇 MOBI | 凡人修仙传仙界篇 / 忘语 | 4,585,802 / 1397 | 一次提交超时，单独重试完整通过；性能稳定性保持开放 |

其余为《国家意志》《三体全集》《重生后才发现我有青梅》《朱门风流》《苟在妖武乱世修仙》。
当前规则是显式 title/author 分别优先，其后是可用内嵌值和结构化文件名；未知内嵌值允许回退，
未识别的书名限定词保留，原文件内容 hash 身份不变。实际《三体全集》仍保留内嵌标题里的营销文字；
这说明已有共用规则并不等于任意标题的语义清洗完成。原始文件名虽保留在解析输入中，
字段来源、版本/章节范围及手动修改标记尚未形成持久模型。

完整结果见 [`results.json`](evidence/local-format-capability-audit/recheck-20260912/results.json)。
第一次直接 CLI 复跑是 **12/13 条完整链路成功**：《凡人修仙传仙界篇》在并行审计期间的冷提交
触发 `timed out waiting for runtime event`，耗时约34.1秒。代码定位到 CLI 固定30秒事件等待，
但本轮没有把迟延的具体分配/CPU/I/O来源完全量化。停止其他大书重放后，同一 CLI、同一输入的
单独重试解析4.887秒、提交5.482秒，末章/搜索/回滚通过，结果另存
[`large-book-retry-results.json`](evidence/local-format-capability-audit/recheck-20260912/large-book-retry-results.json)。
不覆盖原失败，不把它记成零失败的13/13一次通过。Host 默认请求也为30秒，且回复不确定会进入
恢复待处理分支；是否在实际包中触发仍未知，不能从这次桌面迟延推断设备结果。

**仍存在的可定位问题。** P1 表示可能损害用户数据/恢复或阻塞主要阅读链；P2 表示需补齐的生命周期或能力合同。

| 优先级 / 关联 | 现象、触发与直接证据 | 定位与关闭条件 |
|---|---|---|
| P1 / LOC-004：手动元数据丢失 | 用公开 API 导入“绍宋 作者：榴弹怕水.txt”，修改书名、作者、简介、封面后重导入。书名/作者恢复成解析值，简介和封面变 null | `remote/local_book_positions.rs:331` 无条件重写既有书架元数据；Host 重导入也只传文件信息。需要持久字段来源/手动覆盖标记，并在预览、提交、书架更新及回滚中统一合并规则 |
| P1 / LOC-002、004：划线位置遗漏 | 旧《湛蓝权杖》3章升级352章；同一原文的进度和书签从第1章/315523移到第110章/2054，划线仍是第1章/315523，超过新章长度，批注文本本身尚在 | `LocalBookPositionState` 仅纳入进度、旧进度、书签及书架/目录投影，没有划线。需按实体盘点、迁移首尾锚点并同事务保护；无法映射的条目要有保留和恢复入口 |
| P1 / LOC-001、002：中断恢复未协调书架 | 首次 `import.persist` 后、`bookshelf.add` 前结束进程；下一进程可读取35,000字符正文，但 `bookshelf.get` 返回 null | Gateway 顺序为提交正文→提交原文件→加入书架；Host `recoverAbandonedStages` 仅移动/删除文件，Runtime 启动只恢复换源事务。需持久导入状态及启动时继续/回滚/用户可恢复的协调；当前“重启后检查书架”不足以闭环 |
| P1 / LOC-002：MOBI 图片同步重建全书 | 每次进入本地 MOBI 资源读取分支，Core 读整个源文件并重构整个包，再取目标图片。NAPI 直接同步调用；解码内没有取消点 | `epub.rs:115`、`reader_napi.cpp:352`、`LocalEpubResourceHost.ts:45`。有展示图片缓存不等于有重构包缓存；需后台解码、共享有界缓存/索引、取消及资源预算回归。当前只确认代码风险，未宣称测得设备卡顿 |
| P2 / LOC-002：成功日志不回收 | 同一个105,017字节合成TXT正常完成导入及3次重导入，Core持久回滚日志1→2→3→4份，合计106,625→321,278→535,697→750,116字节 | 超64KiB正文的日志落Core；回滚/删书有清理，成功路径无 finalize。需成功确认/恢复之后回收旧日志，同时清理未被业务引用的原文件，不能直接删除尚可恢复事务 |
| P2 / LOC-001、002：警告和错误合同不足 | `recoverable` 导入成功时 Gateway 只返回文件名和 success，警告丢失；libmobi 状态码大多压成通用“损坏或格式不支持” | 保留可恢复警告、稳定错误分类与实际处理建议。内存输入64MiB、解码输出256MiB是上限检查，不等于全过程峰值内存预算 |
| P2 / LOC-003：HTML 被错误标为完整TXT | 独立HTML经公开导入可提交，原始标签和script文本进入正文 | 当前选择器阻止常规进入，但 Core 通用导入仍未实现HTML正文和元数据语义；见格式边界探针，不能与TXT正确解析混计 |

上述数据丢失、缺书架和日志增长重放见
[`extra-results.json`](evidence/local-format-capability-audit/recheck-20260912/extra-results.json)；
划线位置越界见 [`highlight-migration-results.json`](evidence/local-format-capability-audit/recheck-20260912/highlight-migration-results.json)；
PDF/UMD拒绝和HTML/Archive边界见 [`format-boundary-results.json`](evidence/local-format-capability-audit/recheck-20260912/format-boundary-results.json)。
中断场景是公开Core命令的阶段切断加当前Host启动代码审计，没有冒充真实系统杀进程验证。

**已修复与部分修复的区分。**

- 已修复并复验：共同名称规则；旧MOBI正文预览截断；spine正文遗漏；本轮非法/无正文输入的假书提交；
  原文件保留和本地图片路由接线；本轮可唯一定位的进度/书签及书架目录投影迁移。
- 部分修复：元数据首次识别已完成但重导入保护未完成；进度/书签可迁移但划线等实体未完整纳入；
  文件可恢复但书架业务未恢复；图片可取出但成本/取消未关闭；失败可回滚但成功日志未回收。
- 未修复或未实现：HTML正确正文路由、UMD独立真实格式验证、通用Archive/WebDAV书籍导入，
  以及上述数据保护和生命周期缺口。PDF仍是既有范围决定，不能混成待承诺的已支持格式。
- 证据不足：TXT目录人工基准；混合MOBI容器、HUFF/CDIC真实长书、富资源/固定版式矩阵；
  当前Native/HAP下的本地书整条旅程、取消、低空间、进程中断及设备性能。

**测试与审计本身的限制。** 本轮解析包246项、Runtime导入/本地书33个去重用例、
Storage两后端9项，共 **288个去重测试通过**；三个Host相关脚本通过。
Host脚本分别检查格式入口、资源架构和特定异步恢复场景，不能抵消上面的真实公开API缺口。
真实旧解析器迁移重放5/5通过，分别验证一个选定原文位置、书签、冷书架及回滚，
见 [`migration-results.json`](evidence/local-format-capability-audit/recheck-20260912/migration-results.json)。
旧探针摘要与既有归档记录一致；没有用手工裁短的新正文冒充旧解析器。
8个沿用构造中，5个无效输入拒绝、3个EPUB导航场景完整保留正文；其中名为
`unsupported_compression.mobi` 的旧fixture实际命中 `-6`（词典/replica拒绝），
只能证明该输入被拒绝，不能算“不支持压缩分支”已覆盖。独立上游HUFF/CDIC样本测试通过，仍不代表真实长书矩阵齐全。

首次测试命令沿用了已经合并的Runtime目标名而失败，已按 `runtime_integration` 正确重跑。
首次 `/usr/bin/time -l` 受沙盒 `sysctl kern.clockrate` 权限限制，包装进程退出1；
原结果保存在 `results-with-measurement-error.json`，随后去掉测量包装完成直接CLI重跑。
**本轮没有有效峰值RSS**，不沿用§10.8的历史数值作为当前性能结论。
本轮未跑全Core发布门禁、构建/安装HAP或取设备证据；当前CLI、本地测试、历史包和用户验收分别记账。

**后续顺序。** 先完成G中的手动元数据保护和完整位置实体迁移，随后完成C中的导入恢复/成功收尾及资源回收，
再收敛MOBI资源后台解码、缓存和预算。A继续补稳定错误/可恢复提示，F按独立语料决定UMD路线，
最后由H按具体能力绑定新产物准入。以上继续使用LOC-001/002/004及既有A–H工作包，不另建平行计划。
这些剩余原因已经能从代码侧定位；不以重复真机抓取替代实现与本地回归。

### 10.11 开源复用占比与缺口补齐评估（2026-09-12）

**开发原则。** 用户本轮明确要求：能够使用开源项目能力完整实现的，禁止造轮子，必须使用开源项目能力。
该约束已写入根 `AGENTS.md`，同时适用于新增能力和现有自研替换。完整覆盖以本项目真实需求、兼容语料、
目标平台、数据保护、资源约束及许可可用性为准；必要的业务规则/平台桥接可以保留，通用引擎不重复实现。
“已写好”“已有实现可用”“迁移收益不明显”不能单独成为永久保留重复实现的理由。

**统计口径。** 本轮数量针对刚审计的本地书链路，按16个已落地实现分项的主要机制统计，
不按代码行数、Cargo依赖数、测试数或整项目页面数统计；不把部分实现计作产品验收完成。
这16项中，**6项由开源核心直接承担，6项为开源引擎加Reader规则，3项主要是Reader自有实现，1项为系统文件适配**。
因此按这份清单有12/16项直接或组合复用开源，但不能把75%解释为全Reader的开源代码占比或功能完成度。
逐项可复核清单及来源见
[`inventory.json`](evidence/local-format-capability-audit/oss-assessment-20260912/inventory.json)。

| 项 | 已落地能力分项 | 主要实现 | 当前判定 |
|---|---|---|---|
| C01 | 字符编码解码 | encoding_rs 0.8.35 | 开源核心；“解码”与自有编码选择策略分开 |
| C02 | EPUB ZIP/Deflate读取 | zip 2.4.2 | 开源核心；Reader加输入/条目预算 |
| C03 | EPUB结构XML语法与树 | sxd-document 0.3.2，畸形旧导航用scraper | 开源核心；包结构业务映射在C09 |
| C04 | MOBI/KF8、PalmDOC、HUFF/CDIC解码重建 | libmobi 0.12及zlib | 开源核心；不能再开发第二套解码器 |
| C05 | 内容/事务SHA-256 | RustCrypto sha2 0.10.9；Host系统密码接口 | 开源核心；内容身份规则由Reader定义 |
| C06 | 数据库持久化和原子事务 | rusqlite 0.31.0 / SQLite | 开源核心；不自动覆盖独立文件操作 |
| C07 | 统一文件名、书名、作者规则 | regex及格式元数据引擎 + Reader规则 | 混合；需要补来源、版本和手动覆盖 |
| C08 | TXT目录识别与分章 | regex、encoding_rs + Reader分章规则 | 混合；未发现可无回归替代全部中文规则的独立库 |
| C09 | EPUB manifest/spine/nav/NCX业务映射 | zip、sxd、scraper + Reader映射 | 混合；rbook进入重新评估 |
| C10 | XHTML标签、实体、正文和图片投影 | Reader手工标签扫描为主 | 自有实现；解析核心应替换成已有HTML库，图片/段落/位置适配保留 |
| C11 | 可读性、完整性与提交准入 | Reader规则 | 自有实现；这是跨格式业务合同，通用解析库无法替项目决定 |
| C12 | 导入/回滚业务事务 | SQLite、sha2 + Reader事务模型 | 混合；需补跨文件/书架恢复与成功收尾 |
| C13 | 原文件暂存、移动、保留和恢复 | Harmony fileIo/statvfs等 + Reader文件归属 | 系统适配；不将系统API算成移植第三方库 |
| C14 | 旧进度、书签的原文定位迁移 | 现有RegexSet + SQLite + Reader映射 | 混合；已经复用多模式匹配引擎，问题是划线等实体没有接入 |
| C15 | 本地图片定位与资源提取 | libmobi、zip + Reader/Core/Host适配 | 混合；重建缓存、后台执行及取消未闭环 |
| C16 | 格式选择器及导入结果策略 | Reader准入表和文案规则 | 自有实现；不能用库的supported列表替代本项目准入 |

表中“自有实现”不等于一律违规：C10的通用解析机制有现成替代；C11/C16是项目必须明确的业务决定。
“混合”也不等于可无限扩写：允许保留书名优先级、旧数据映射与事务边界，不允许再写正则引擎、解压器或通用缓存淘汰算法。
当前源码指纹见 [`baseline.json`](evidence/local-format-capability-audit/oss-assessment-20260912/baseline.json)；
65个聚焦文件包含既有解析、Runtime、Storage及Host链。本轮不把过去试点结论冒充新设备证据。
收尾时Runtime、SQLite后端及合同的三个共享文件发生外部在途变化，已复查当前导入仍使用SQLite和既有事务模型，
并将结束摘要另存于[`verification.json`](evidence/local-format-capability-audit/oss-assessment-20260912/verification.json)。
本轮XHTML探针依赖的local-book解析源码未漂移；不将上轮288项测试当作这三个新文件的回归结果。

**当前已有能力，多少可替换。** 在这16项中，明确应替换通用核心的有 **1项（C10）**；
另有 **1项（C09）** 应继续验证能否完整替换。不是已经证实有2个完整模块可直接无适配替换。
其他项目规则没有找到可直接接管本项目数据和用户行为的完整库；其底层已有开源的继续复用，缺口用有限业务适配补齐。

1. **C10：采用当前已有scraper 0.19.1 / html5ever 0.27.0的解析机制。** 不新增一套HTML引擎。
   上游提供HTML树、属性和文本访问；本轮使用项目锁文件与工具链做5个原创XHTML对照，当前结果2/5正确，
   候选5/5正确。新增复现为：属性值含`>`时正文混入属性残片；大写SCRIPT未被剔除；一般命名实体及十六进制实体未正确还原。
   证据见 [`dom-results.json`](evidence/local-format-capability-audit/oss-assessment-20260912/dom-results.json)。
   采用范围是词法/树/实体机制，随后将Reader的段落、图片U+FFFC占位及Unicode位置投影接到DOM遍历上；
   本轮小样本不能替代全书、图片/链接、目录锚点和旧位置差分。scraper当前固定版本许可为ISC，html5ever为MIT/Apache-2.0。
   来源：[scraper上游](https://github.com/rust-scraper/scraper)，固定版本以本地Cargo.lock及缓存源码为准。
2. **C09：rbook 0.7.10（Apache-2.0）由历史No-Go调整为REASSESS。** 历史4个现有EPUB均可读spine；
   其中3个不完整XML夹具未返回目录。3个libmobi重构包原本拒绝，但只规范化container声明即可读取全部spine资源。
   因此不能把container问题描述为无法适配，也不能再以迁移收益不足退出。剩余需证明：畸形旧导航的有限规范化、
   结构解析分配前预算、Reader锚点/正文投影和真实语料无回归，最终删除手写包结构核心且不长期保留两套完整解析器。
   历史差分仍绑定原输入，见 `evidence/opensource-completion/rbook-existing-epub-fixtures.json`、`rbook-libmobi.json`；
   当前本地缓存版本源码已复查，不把它说成最新版本或本轮新跑的迁移验收。
   来源：[rbook上游](https://github.com/DevinSterling/rbook)。

**缺口如何补齐。** 下列是现有能力的延伸或新缺口，不与上面“已落地实现替换数量”重复相加。

| 缺口 | 必须复用的能力 | Reader需要补的最小职责 | 完成依据 |
|---|---|---|---|
| 重导入覆盖手动信息 | 已有元数据解析、regex、SQLite | 对书名/作者/简介/封面逐字段持久化来源和手动覆盖；预览、提交、书架更新共用合并规则 | 首次导入、手改、再次导入、回滚和重启均保留用户值；章节/版本信息单列 |
| 划线及其他位置遗漏 | 已有RegexSet、当前位置迁移、SQLite事务 | 盘点划线、阅读历史等实体；为范围保留起止两端，统一纳入事务；歧义保留原记录并提供恢复入口 | 本轮“第1章越界划线”回归，首尾跨段/跨章、重复原文和冷回滚通过 |
| 首次导入中断缺书架 | 已有SQLite事务与文件持久化接口 | 持久导入阶段/回执，协调已落盘原文件；书籍/章节/书架/位置在一个业务提交内发布，启动继续或回滚未终结事务 | 对每个中断点做本地故障注入；既不丢已确认书籍，也不产生无文件的书架项 |
| 成功日志、孤儿文件累积 | 已有SQLite索引/事务与Host文件接口 | 确认成功后的finalize；按事务状态和真实引用回收，区分用户可撤销与内部补偿记录 | 多次成功重导入后存储占用收敛，未确认事务仍可恢复 |
| MOBI图片反复重建、同步阻塞 | 保留libmobi及其资源访问API、zip和现有资源索引 | 原文件hash+解析版本作为缓存身份，后台进行一次重建；Host异步桥接、取消、资源租期及预算 | 多图/同图不重复全书重建；低预算/取消不阻塞；资源仍可冷恢复 |
| 内存缓存若需新增 | 成熟缓存库Moka为候选，避免自写淘汰/同键并发初始化 | 选择具体字节权重、缓存键、活动引用和释放策略；先确认现有缓存/索引不能覆盖 | Moka自身权重不等于全进程峰值；OHOS构建、并发初始化和内存上限必须另验 |
| HTML误按TXT入库 | 复用C10同一个scraper/html5ever通路 | 提取标题/作者/正文/资源，接入共同metadata及integrity，禁止另一套HTML扫描器 | 标签和script不进入正文；与EPUB段落、图片和位置语义一致 |
| UMD缺完整解码 | 优先评估现有UMD开源Importer，通过后移植/依赖 | 映射到现有LocalBook/EPUB公共链，保持原文件身份、严格拒绝损坏数据 | 必须有固定源码、许可证、独立真实UMD、章节与封面/压缩块对照；自制夹具不足 |
| 警告丢失、错误粗糙 | 复用解析器的结构化错误/警告 | 将完整性、错误原因、可恢复处理传到产品层；按能力登记准入 | recoverable成功仍可见原因；受保护、超限、损坏及未实现可区分 |

SQLite提供数据库原子提交，不能自动让独立Host文件和数据库成为同一个事务；因此仍需上述协调，
不应为了它引入另一个数据库或通用工作流引擎。
来源：[SQLite原子提交说明](https://www.sqlite.org/atomiccommit.html)。
Moka支持容量权重、过期和同键初始化；本轮核对到文档版本0.12.16，仍是待固定/构建的候选，未加入生产依赖。
来源：[Moka Cache](https://docs.rs/moka/latest/moka/sync/struct.Cache.html)。

Readium Locator的`href`、位置及`before/highlight/after`适合统一未来位置描述，已覆盖进度、书签、批注等用途；
它不是能直接读取Reader旧数据库并迁移历史划线的现成算法。当前先复用已有RegexSet修复实体遗漏，
若正文引擎采用Readium，再接其Locator/范围模型，不能单为修复一个字段遗漏把匹配搬进WebView。
来源：[Readium Locator](https://readium.org/architecture/models/locators/)、
[HTML范围扩展](https://readium.org/architecture/models/locators/extensions/html.html)。

UMD的all2epub检索缓存显示纯Rust、MIT和文本UMD→EPUB Importer，但本轮上游直接抓取出现404/cache miss，
尚未重新取得可固定源码；这些工具返回不能证明仓库已经删除，也不能证明现在可直接采用。
仍需独立真实UMD和损坏数据策略验证，保持候选状态，不把上游README中的993章声明当作Reader验证结果。
候选线索：[all2epub](https://github.com/zbf1009/all2epub)。PDF继续执行原有范围决定，未因评估引入PDF/OCR工程。

**项目其他区域的复用。** 当前Core源码还已接入QuickJS/rquickjs、scraper的HTML/CSS查询、sxd-xpath、
RustCrypto/base64、flate2、zhhz、serde_json、url/idna。它们是补充机制视图，部分与本地链共用，不能再加到16项分母。
近期专项中的密码/Base64和EPUB XML替换已经落地；Foliate/Readium只是隔离试点，不算生产正文已采用。
当前自写WebDAV multistatus标签提取可转到已有sxd-document；标准RSS/Atom/JSON Feed可优先试验feed-rs，
但要保持既有字段、分页、规则型RSS语义，不能把换解析库当成已开放完整RSS产品。
来源：[feed-rs](https://github.com/feed-rs/feed-rs)、[sxd-document](https://github.com/shepmaster/sxd-document)。
这些不在本轮本地书替换数量内，当前没有对全Reader用户功能逐项重新统计完成度。

此前两个候选继续有具体暂缓依据：serde_json_path在实际方言/离线响应中仍有不兼容；
chardetng的已标注片段对照为候选80/88、现策略82/88，存在5项退化。两者不能算当前已证明全面可替代。
这些数字来自已读取的固定历史差分，本轮没有重跑，不能当作当前自然书库准确率。
Foliate/Readium生产替换仍缺既有计划中的资源、位置、原生交互与产物行为条件；标准API与桌面试点不是完整采用证据。

**执行顺序与记录。** G先保护手动元数据并补齐划线；C补导入恢复和成功收尾；B将XHTML核心交给已引入的HTML库；
C/D/E复用libmobi完成资源索引、后台重建与缓存；OSS-004按新原则复评；F取得独立UMD证据后决定Importer；H最终按能力准入。
本轮只更新原则、评估和待办，新增隔离对照探针，未修改生产解析/存储代码。
探针首次构建遇到外部锁文件选择未解包cc及默认工具链版本不符，已通过复用Core锁文件和项目工具链解决；
过程日志保留，不计作产品失败。新增XHTML失败及证据限制记录于
[`observations.jsonl`](evidence/local-format-capability-audit/oss-assessment-20260912/observations.jsonl)。

**后续实现记录：手动元数据保护。** 上述评估之后，已为 `bookshelf.book.update` 的六个可编辑字段
随 Book 写入 `localBookMetadataSource.<field>=manual`；公共本地解析、重导入预览和提交采用同一合并方法。
保留显式清空值，缓存预览之后发生编辑时拒绝过期提交。采用现有 rusqlite 0.31.0 / libsqlite3-sys 0.28.0
与 SQLite 事务、既有序列化回滚记录；字段优先级是 Reader 业务适配，不宣称开源库实现整个导入闭环。
源码基线和本次测试见 `evidence/local-book-oss-implementation/`；导入链 20 项回归通过，包含磁盘 SQLite
冷重启、重导入、回滚及预览后编辑。未进行 Native/HAP/VM/真机验收。
未决：旧数据没有手动标记，无法可靠追溯所有历史修改；解析器逐字段来源、书签名称身份随手动改名的联动、
划线迁移及其余 §10.14 工作包仍需继续。本步完成后按全量修复任务的共享文件协调请求交接，未回滚平行修改。

**后续实现记录：XHTML DOM。** EPUB正文投影已采用现有 `scraper 0.19.1`（ISC）及其底层
`html5ever 0.27.0`（MIT OR Apache-2.0），固定版本和来源记录于
`Reader-Core-Native/third_party/oss-reuse-licenses/README.md`。DOM承担通用HTML边界、实体和属性解析，
Reader保留spine/body、段落/换行、图片 locator 与字符偏移适配；旧手写标签/实体扫描已从正文路径移除。
新增引号 `>`、大写 SCRIPT、命名/数字实体、段落/BR及图片定位回归，49项EPUB单元通过。
同文档导航锚点仍依赖原始偏移兼容代码，后续需在不破坏导航差分和历史位置的前提下继续迁移；本步仍只有Core本地证据，
没有Native/HAP/VM/真机验收结论。

**后续实现记录：划线位置实体。** `LocalBookPositionState` 现包含 `BookHighlight`，读取和写回沿用现有
SQLite/内存事务；起点和终点共享 RegexSet 文本锚点，验证书签/划线身份、章节存在性及范围合法性，跨章节或歧义时保留原记录并返回可恢复迁移错误。
新增回归覆盖起止位置映射、书名更新、备注保留及回滚恢复；没有引入新的通用匹配器或位置数据库。本步仍为 Core 本地证据，未做 Native/HAP/VM/真机验收。

## 11. 2026-09-13 当前工作树整理与修复规格审计

本节为本轮事实快照；当前任务见DEVELOPMENT_BACKLOG §11，专项实施合同为Reader-for-HarmonyOS/docs/READER_REPAIR_SPEC.md。没有新实施整套方案、构建或设备操作；原生产修改按业务内容保存，不能把WIP提交当修复验收。

本轮实际发现并复现：Core TOC缺bookUrl；旧acquisition元数据阻止已有持久目录准入；导入中离页后旧bool仍回写；书架模式两介质写反序；正文profile24仍被32钳制；Window lookup24ms配MOVE16ms令拖动期间零次亮度写。Core流式大XHTML额外4探针全部失败（br、script/textarea语义、4097+锚点），与远程TOC独立。

现场Figma：四个胶囊入口均3500ms完整轨道；暂停钮在1100–1400ms与壳交接，文字/壳/页码1700–2300ms同步，当前源码偏离。App Color确有88项Day/Night、37不同；旧“Night没有”的判断错误，剩余局部浅表面仍需补色。导入完成按钮实际318×40，201是flex权重误读。搜索Make Version5源码及实际CSS证明1000ms linear旋转，1800ms只是演示等待，不进入生产。

历史用户原文确认整理按钮仅默认单选分组栏、详情分组行/单书编辑分组，不开放CRUD；9张历史图存在，但探索内容不能覆盖后续收窄。阅读More直接改书签和顶More业务名单未找到用户最终授权；具体收口提案已标清。

验证：Harmony当前198组本地检查通过；Core安全前置c42af9a1f独立252项通过；含streaming WIP的普通253项通过而新增4阈值探针全失败。旧C段14项/Make7组已按现代码复核，原52ID与12类性能/未验证继承到规格；无新VM/真机/视觉/用户接受结论。原始证据、输入hash与提交回执在Reader-for-HarmonyOS/evidence/2026-09-13-current-gap-register，根local-book-oss-implementation保留原始parser审查材料。
