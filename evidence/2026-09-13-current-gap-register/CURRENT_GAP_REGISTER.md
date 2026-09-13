> 历史快照说明（2026-09-13复核）：本文保留当时日志/判断，不维护当前待办。当前实施合同见 [READER_REPAIR_SPEC](../../docs/READER_REPAIR_SPEC.md)，实时状态见工作区 DEVELOPMENT_BACKLOG §11。下文旧“CODE FIXED/未实现/需决定”不自动继承；尤其胶囊时值、Night不存在/强改不透明、More=书签/整理=CRUD、201固定按钮宽及整组翻页缺实现已被当前源码/Figma/原始用户决定纠正。

# Reader 当前缺口总账与修复方案

审计日期：2026-09-13。范围覆盖当前对话中已发现的阅读控制栏、自动翻页、书架、翻页状态机、Make 对照、性能和交付证据。结论以当前源码、已保存的 Figma/Make 证据及既有探针为准；代码定位、本地回归、VM、真机和用户验收分开记账。

## A. 当前控制栏与书架

| ID | 状态 | 缺口与代码定位 | 修复方案 | 关闭条件 |
|---|---|---|---|---|
| A01 | CODE FIXED / LOCAL-PASS / DEVICE-OPEN | 快捷自动翻页速度布局已按共享进度收敛到 262/286/312/338 宽度，±、数值和滑条子轨道随端点插值。 | 新 HAP 做 VM/设备中间态视觉确认。 | 本地几何/渲染回归通过，设备仍待证据。 |
| A02 | CODE FIXED / LOCAL-PASS / DEVICE-OPEN | 快捷自动翻页移除返回按钮视觉与命中区。 | 新 HAP 做系统返回/完整栏收起操作确认。 | 代码和静态回归通过。 |
| A03 | CODE FIXED / LOCAL-PASS / DEVICE-OPEN | 快捷播放区补独立背景、边线和圆角。 | 新 HAP 核对静态与中间态合成。 | 代码和静态回归通过。 |
| A04 | CODE FIXED / LOCAL-PASS / DEVICE-OPEN | 快捷恢复 ± 控件并绑定现有 2–20 秒状态，中心值改为实时速度。 | 新 HAP 核对触摸与反向形变。 | 代码和静态回归通过。 |
| A05 | CODE FIXED / LOCAL-PASS / DEVICE-OPEN | 批量页按当前封面/列表模式、分组筛选和顺序投影，全选限制当前可见集。 | VM 做两种模式与筛选组合验证。 | 代码静态回归通过。 |
| A06 | CODE FIXED / LOCAL-PASS / VM-OPEN | 列表固定四行，章节最新优先，书源标签使用 sourceName/sourceId，不再显示“网络书”。 | 用真实 source.list 注册表和混合书籍验证。 | 代码静态回归通过，真实注册表待 VM。 |
| A07 | CODE FIXED / LOCAL-PASS / DEVICE-OPEN | Phone/Tablet 列表行高调整为 80/104vp，四行详情不裁切。 | 新 HAP 核对往返动效与窄屏。 | 代码静态回归通过。 |
| A08 | CODE FIXED / VM-OPEN | 阅读页返回、批量页和筛选均读取同一 `readerBookshelfViewMode`；模式选择现在同步写入 `WebDavCredentialStore` 的同一份本机 WebDAV 安全配置，保存 WebDAV 表单会保留该字段。无 WebDAV 配置时不创建伪造凭据记录。 | 以真实安全存储重启读取作为 VM/设备证据；确认重启不回到封面且其他 WebDAV 字段不变。 | 代码/静态回归已通过，跨进程和真实安全存储仍待 VM/真机。 |
| A09 | CODE FIXED / LOCAL-OPEN | 分组投影使用 Core `book.group`，批量全选只作用于当前可见投影；列表源标签优先使用实际书源名称，章节改为最新章节优先。 | 用非默认分组和已登记书源做 VM 验证，确认刷新、切换和删除边界。 | 代码/静态回归已通过，真实书源注册表覆盖仍待 VM。 |
| A10 | CODE FIXED / VISUAL-OPEN | 单书更多/长按统一为约75%宽、居中、不透明浮层；顶部更多仍保留独立的176宽不透明菜单。 | 在 VM/真机核对75%等比例、圆角、边框、阴影和关闭语义。 | 代码规格已固定，设备合成效果待验证。 |
| A11 | DESIGN MATCH / DEVICE OPEN | 筛选图标 `271:220` 是描边漏斗；当前 SVG 路径、20px图标、34px视觉区、44px点击区和实例颜色与 Figma 一致。设备实际显示仍未验证。 | 暂不换图形；若设备显示异常，先核对安装资源身份、active 状态及原生 SVG 渲染。 | 资源身份+设备截图/树证据。 |
| A12 | CODE FIXED / LOCAL-PASS / DEVICE-OPEN | 快捷设置标题、标签和选项条端点已整体下移并保持完整态 Figma 端点，消除中间态相交。 | 新 HAP 核对静态与展开中间态。 | 本地几何回归通过。 |
| A13 | PREVIOUS FIX / ACCEPTANCE OPEN | 设置容器/选项边框、TTS副标题宽度、0.50x按钮、胶囊 reveal、状态栏安全区、收起命中层级已有代码修复；旧 VM 局部通过，但未完成新产物的完整视觉/用户验收。 | 使用最新 HAP 按字段、状态和动效逐项验收，不用旧截图覆盖新代码。 | VM/真机与逐帧视觉验收。 |

## B. Make v17/v9 遗留

以下项目来自 `evidence/2026-09-12-make-full-audit/AUDIT.md`，此前没有被 A13 的局部控制栏修复关闭：

- **TTS 配置 P1**：在线配置缺 API 密钥、发音人、音频格式；当前两字段管理器不能代替 Make 五字段表单；取消/保存草稿、回填、秘密字段遮蔽和请求合同未闭合。
- **TTS 选项 P1**：跟随高亮、来电自动暂停、后台播放、屏幕常亮开关不完整；章节结束定时被固定时长替代；语速预设、步长和精度不一致；音色没有独立试听，失败切换不回滚。
- **主题 P1/P2**：快捷/完整色块与真实正文背景、纹理、系统栏没有统一主题身份映射；不能只改色块。
- **翻页样式 P2**：Make 的顺序为平移、仿真、淡入、无；当前选项集合和命名仍不同。该项不能与底层翻页状态机修复混为一个补丁。
- **播放视觉 P2**：波形动画、暂停/空闲颜色、快捷状态点/左线、图标尺寸和阴影仍未完全按 Make 对齐。
- **输入/交互 P2**：键盘遮挡、冷进入快捷导航首击未切换等旧问题没有新的完整版本证据。
- **交付判定 P2**：旧测试主要验证实现形状，不足以覆盖 Make 字段、开关、章节定时、试听和状态完整性。

这些项目的修复顺序是：先补设计字段与状态合同，再接 Core/Host 真实能力，最后做状态视觉；不能只加静态控件。

## C. 翻页状态机、方向和性能

`evidence/2026-09-10-page-turn-physical-b1f20b88963d` 的代码审计仍登记以下缺口。已有 8 条 mock 情景复现并不代表产品验收通过；当前工作树需在修复后重新跑同一探针：

1. slide/cover 冷准备期间 pointer 不能重新取得呈现权。
2. 收尾中重新抓住仍等待旧事务，不能从当前屏上姿态接管。
3. 最终 UP 样本没有原子地参与呈现坐标和方向判断。
4. tracking 状态下 UP 可能被误判为点击，导致方向错误。
5. 纯纵向上一页认可手势但按压期间没有连续呈现。
6. none/减动态效果取消后所有权、结算和延后操作没有收敛。
7. rapid 到达已知边界后留下不可达净目标，反向请求会被吞掉。
8. continuous 保存 Promise 不等于目标进度已落盘；超时后可能出现结果未知的 UI/Core 分歧。
9. 2 秒呈现超时不能证明 Core 未写入，需 queued/dispatched/durable/unknown 对账状态。
10. scroll 图片占位高度变化没有可见 canonical anchor 补偿。
11. scroll 多指未稳定锁定首个 pointer。
12. none 仍等待排版/进度保存，未做到真实结果就绪后的零视觉延迟。
13. scroll 上一章仍可能逐物理页扫描，等待时间随页数增长。
14. slide/cover 的 A/B 槽位在不同条件分支中重挂载，注释中的“常驻槽位”尚未被实例生命周期证据证明。

代码已修复“手指停住仍按着、准备完成后才触发”的 readiness 重放：保留 DOWN 原点并用最新物理样本立即更新展示层；相关 drag-follow、分页和管线回归通过。其余 1、2、3、7、8、14 仍需继续代码审计或设备证据，不得因该修复宣称整组关闭。

## D. 交付和验收缺口

- 上一个已校验 HAP：`.reader-artifacts/hap/20260912T153716Z-50cad401-19101b50/manifest.json`，签名校验通过；它不包含本批书架和 WebDAV 持久化改动，必须以新产物重新验证。
- VM 曾完成旧候选的安装、启动及控制栏收起/展开定点；这不能证明本批新增页面视觉通过。
- 真机证据仍不能覆盖本批，因为当前多数问题已经可从代码定位；只有原生 SVG/Sheet 合成、VSync 长帧、触摸到屏幕延迟等代码无法分离的问题，才进入最小真机取证。
- HDC 传输恢复不等于 UI 验收；重新测试必须确认 exact target、guest boot、SceneBoard 稳定和保数据部署回执。
- 用户验收仍需单独覆盖：自动翻页快捷/完整、列表/封面往返、阅读页返回书架、批量管理、长按/更多、筛选 active/default、TTS 状态和各种翻页方向。

## 推荐修复顺序

1. A01–A07、A12 的代码修复和本地回归已完成；下一步以新产物做 VM/设备视觉验收。
2. A08–A11 的真实安全存储、源注册表和原生浮层/SVG合成仍按设备证据单独验收。
3. 按 B 的数据合同补齐 Make TTS 与主题状态，避免静态视觉先于真实状态。
4. 按 C 的事务/指针/槽位顺序修复不跟手和方向差异，同时补齐性能 trace。
5. 生成新的 immutable HAP，先 VM 再真机；每层分别记录证据，最后才做用户验收。

## 需要特别注意

- N12/A08 的 AppStorage 与 WebDAV 安全存储接线已完成；当前仍只有代码/静态证据，不能把它说成跨进程真实设备已通过。
- A06 的“四行”和真实书源是用户新要求，和 Figma 当前三行“网络书/已缓存”示例不同，需保留该产品变更记录。
- A10 的75%浮层没有在当前 Figma 节点中得到证据；先确认目标稿，避免把设计冲突误修成视觉回归。
- A11 的筛选图标形状已确认匹配；看到设备异常时先查资源身份和渲染，不要直接替换图标。
- 页面代码、本地测试、HAP、VM、真机和用户验收必须分别标记，不能用构建成功或旧截图关闭缺口。

## 2026-09-13 执行记录

- WebDAV 本机配置新增 `bookshelfViewMode` 字段；模式切换通过安全存储读改写，保留 URL、账号、密码、备份密码和目录。无已有 WebDAV 配置时不创建伪造凭据记录。
- 冷启动在首个页面挂载前读取该字段并写入 `readerBookshelfViewMode`，避免先显示封面再异步跳到列表。
- WebDAV、书架、控制栏、布局和性能静态回归通过；HAP 全量构建及校验通过。
- 新产物：`.reader-artifacts/hap/20260912T165214Z-50cad401-ea3dd1c8/manifest.json`；签名 SHA256 `284ed566b3a791d6294c5971f5904cae14aa3495709b9afe766504f82cca3206`。
- 尚未宣称 VM/真机通过；跨进程安全存储实际读取、书架视觉合成、控制栏中间态和翻页跟手性仍需按授权目标单独验收。
- 翻页 readiness 重放修复已纳入本产物：保留 DOWN 原点并用最新物理样本立即更新展示层；drag-follow、page-input、分页和管线回归通过。
- 最终产物：`.reader-artifacts/hap/20260912T172720Z-50cad401-d0124b45/manifest.json`；签名 SHA256 `fbf581b95e204962c40772288f19251fc31f1ec8eaf684f5575530e6bb1cddef`，verify PASS。
- VM 重试（2026-09-13）：DevEco Device Manager 中已对 Mate 80 Pro 执行停止→启动，状态从“停止”切换到“正在获取模拟器运行状态”后回到“启动”；同时仍显示“找不到系统镜像文件，请重新下载”。HDC `list targets` 与 `127.0.0.1:5555` boot 查询各自 5 秒超时，未发现可用 exact target，未执行 inspect/install，也未清理或重装数据。当前结论：VM 被系统镜像缺失阻塞，保数据部署证据未产生。
- 最新待部署产物：`.reader-artifacts/hap/20260912T180456Z-50cad401-d0124b45/manifest.json`；签名 SHA256 `cd14dfd7262400e53abf8879dad86f830b0f794b9c5dc3f9c2e6d1e5040b50a9`，verify PASS，等待 VM 恢复后再按 exact target 安装。
- 对上述 VM 重试结论的更正：设备管理器的“启动/停止”状态不能作为 VM 已拉起证据。当前 CUA 应用清单没有模拟器窗口；HDC `list targets`、`127.0.0.1:5555` boot 查询、`checkserver` 和 `version` 均超时。虽然 `Emulator.log` 曾写入 Guest OS Boot Completed 且 5555 处于监听，但 HDC 未连接、应用窗口未出现，因此当前只能判定为半启动/失联，不能进行 HAP inspect/install 或 UI 验收。
- 操作原因复核：受限终端直接调用 HDC 时未使用可访问的提升权限通道，且 DevEco 持有共享 HDC 会话；因此出现命令超时，之前把超时误判为 VM 未启动。使用项目 HDC 服务端配置 `::ffff:127.0.0.1:8710`、提升权限重新发现后，exact target `127.0.0.1:5555` 返回，boot completed=`true`。
- VM 部署重试（2026-09-13）：最新签名 HAP inspect PASS，install PASS，launch PASS，部署回执 `.reader-artifacts/hap/20260912T180456Z-50cad401-d0124b45/deploy-vm-6460677a198b-20260912T182137Z.json`，`dataPreserved=true`。`aa dump -a` 确认 `io.reader.harmonyos` / `EntryAbility` 为 `FOREGROUND`。交互功能、视觉和用户验收仍保持 OPEN。
- VM 交互取证：书架列表模式切换后可见四行信息（书名、作者、最新章节、书源+进度），筛选展开态显示“全部/默认”状态；更多菜单为居中约 75% 宽的不透明圆角面板。证据图：`evidence/2026-09-13-vm-retry/reader-control-filter-open.png`、`reader-control-more.png`。
- 阅读页控制栏稳定态仍存在视觉缺口：控制栏顶部标题与正文标题重叠，底部控制面板和正文之间有明显文字穿透。证据图：`evidence/2026-09-13-vm-retry/reader-control-stable.png`；该现象已从“仅动效中间帧”升级为稳定态视觉 OPEN，需回到代码核对图层 alpha/裁剪与 Figma 表面定义后修复。

## 2026-09-13 VM follow-up (final HAP 20260912T185215Z)

- Code-side finding: `BookshelfPage.setViewMode()` previously only changed AppStorage; the WebDAV persistence method was never called. This caused list mode to reset after a cold process restart.
- Fix: `WebDavCredentialStore` now stores the non-secret bookshelf mode in Preferences (`reader_webdav_local_v1`) when no WebDAV credential envelope exists, and mirrors the field into the existing AssetStore envelope when configured. `BookshelfPage.setViewMode()` calls the persistence path before visual transition.
- VM evidence: signed HAP `2606bea127ad556bcd35a84aa394259050d6dc5811b37d9d44388007dbb56b9d`; install receipt `deploy-vm-6460677a198b-20260912T185243Z.json`; `dataPreserved=true`. After selecting list mode, `aa force-stop` + `aa start` and 3s settle, `reader-control-cold-persist2.png` remained in list mode. A08 cold-start persistence is now VM-PASS.
- Code-side finding: page slots used `renderGroup(hasLiveTurnWidth())`, which kept the slide compositor group active while idle. This could let a native reading layer outrank sibling controls. Fix limits `renderGroup` to `hasActiveTurn()`; local contracts and HAP build pass.
- VM stable control screenshot `reader-control-stable2.png` shows the control shell and panels above the reading page with the Figma/Make translucent surface tokens (0.98 top surface / 0.62 content surface). Remaining faint text through the panels is consistent with those reference alpha tokens; no claim of opaque-surface acceptance is made.
- HDC evidence: exact target `127.0.0.1:5555`, server `::ffff:127.0.0.1:8710`; probe closed cleanly after capture. No data clear/uninstall performed.

## 2026-09-13 user gap audit (control chrome / capsule / brightness)

以下结论来自当前工作树源码调用链审计，未以真机截图替代代码定位：

- **沉浸阅读收起后的状态栏（OPEN）**：`ReaderShell` 将 `windowChromeActive` 绑定到 `visible`，而不是控制栏 session；`LocalReadingExperience.applyWindowPolicyForChromeOwner()` 在该值为 true 时强制 `forceStatusBarVisible=true`。因此阅读页控制栏收起后仍会保持系统状态栏，无法满足沉浸态不渲染。
- **胶囊首次出现/动效（OPEN）**：自动翻页路径在 `startAutoPageSession()` 后才进入 `beginSessionCapsuleMorph()`，该函数还要等待 `getComponentSnapshot()` 与下一帧；TTS 路径额外等待 `coordinator.start().whenStarted()`。异步失败会直接结束 morph。`ReaderSessionMorphTimeline` 使用代码自补的 480/120/240/160ms（`MotionSpec` 明确标注 C/D/E/F 为 review-only），不是 Figma 产品动效时序。胶囊文字/图标只做整体 clip+translate，未按设计分段出现；正文右下角信息不读取 morph progress，故与展开不同步。
- **控制栏主题（OPEN）**：阅读主题仅传入正文、胶囊和 WindowChrome；控制栏及子模块仍固定使用 `TOK_READ_*`、`TOK_SURFACE_PANEL` 与 TTS 专用日间色，未按 `activeTheme` 派生 surface/ink/line/primary。
- **拓展到刘海（OPEN）**：`ReaderWindowPolicy.extendIntoCutout` 在 Coordinator 的实际 Window 写入中未被使用；仅 `ReaderLayoutGeometry` 调整内容 inset。状态栏显示又错误地由 `windowChromeActive` 全局强制，尚未实现“关闭时只绘背景和系统图标、开启时仅控制栏调出才渲染状态栏”的两态逻辑。
- **完整控制栏高度（OPEN）**：`resolveReaderControlLayout()` 以 `height - fullPanelTop(>=88) - bottomGap(>=20)` 计算预算，但 shell/header/子模块仍有固定高度；短窗口没有 topbar-bottom 与 full panel 的显式防重叠约束，Scroll clip 不能保证顶部控制栏不被覆盖。
- **自动亮度图标（OPEN）**：`ReaderControlPanel.brightnessRail()` 始终绘制静态 `A`、固定背景和边框；`brightnessAutomatic` 只用于 accessibility 文案。异步 Window 写入完成前也没有 pending/失败视觉状态。
- **亮度实时跟手（OPEN）**：`updateBrightnessDrag()` 仅更新 `brightnessPreviewPercent`，`onBrightnessChange()` 仅在 `finishBrightnessDrag()` 的 End 调用，实际 Window 亮度在脱手后才改变；需在 MOVE 采样节流写入，并保持串行队列。
- **顶部更多按钮（OPEN）**：`ReaderControlPanel.topBar()` 的 More actor 没有 `onClick`；生产挂载传入 `onMore: (): void => {}`，当前无业务功能。

## 2026-09-13 全量执行批次（当前工作树）

- 代码侧已落地：控制栏收起时的 WindowChrome 状态栏策略、完整面板顶部预算与安全区、亮度拖拽 MOVE 实时写入、书架列表四行投影（真实书源左对齐/进度居中）、筛选 active 状态、检查更新紧凑按钮、更多菜单不透明 75% 面板、导入文件选择与导入执行解耦、导入结果按数量自适应、搜索历史收起入口与单实例加载指示、简介方向控制字符清理、已上架搜索结果复用本地书架快照、ShelfBook 源名称显式复制、正文 inset 配置入口。
- 本地证据：`./scripts/check-local.sh` 全量通过，Harmony contract tests `198` 项通过；ArkTS type check 与非增量 HAP 构建通过。
- 最新不可变产物：`.reader-artifacts/hap/20260913T022053Z-50cad401-5f2d2263/manifest.json`；signed SHA-256 `27c2a6c85b0ea3c40b7495691daf692e87391269da9aa00f6ebc7d8e4a46ace9`；verify PASS。
- VM 证据：exact target 已完成 inspect 与保数据覆盖安装/启动，回执 `.reader-artifacts/hap/20260913T022053Z-50cad401-5f2d2263/deploy-vm-6460677a198b-20260913T022150Z.json`，`dataPreserved=true`。
- 真机证据：当前 HDC 只发现 VM `127.0.0.1:5555`，没有物理 target；未执行物理机安装，避免用历史 target 或猜测目标越过前提。
- 保持 OPEN 的项目：Figma 胶囊/导入完整动效逐帧时序与分段 reveal、控制栏主题到应用主题的完整映射、`extendIntoCutout` 原生 Window 两态实现、顶部更多按钮的产品动作定义、完整控制栏短屏自适应原生视觉、真实 `book.toc` 空目录调用链与正文左右间距的像素对照、自动亮度图标的 Figma 状态样式、搜索加载动效连续性与原生触摸/VSync 跟手性。这些需要设计稿/平台 API 或明确的原生证据，不能以合同测试或安装结果宣称关闭。

### 执行后代码复核更正

- 阅读页顶部“更多”已接入当前页书签切换（`LocalReadingExperience` → `toggleCurrentPageBookmark`），不再是空回调。
- 书架页右上角设置与列表管理设置均已接入 `openSettings()`；先前“无实际功能”的记录仅适用于旧快照，需以当前 HAP 重新做用户验收。

### 20 项问题执行状态矩阵

| 编号 | 当前状态 | 代码/证据结论 |
|---|---|---|
| 1 | CODE FIXED / VM-OPEN | 收起控制栏的状态栏策略已绑定控制 session；仍需原生视觉确认。 |
| 2 | CODE FIXED / LOCAL-PASS | 列表显示真实书源名称，不显示链接。 |
| 3 | CODE FIXED / LOCAL-PASS | 书源左对齐、进度居中，四行文本投影保持原字号。 |
| 4 | CODE FIXED / VM-OPEN | 筛选 active 资源与检查更新紧凑 chip 已修复；需逐稿视觉验收。 |
| 5 | CODE PARTIAL / OPEN | 胶囊首帧触发与 morph 生命周期已修复；Figma 分段 reveal、右下角同步和失败回退时序仍缺精确设计证据。 |
| 6 | CODE SCAFFOLD / OPEN | 已建立控制栏主题 prop 接口；无可靠 Figma 主题令牌映射，未臆造颜色。 |
| 7 | CODE PARTIAL / OPEN | 状态栏 session 策略已修复；SDK 无独立拓展到刘海 API，需平台方案后实现。 |
| 8 | CODE PARTIAL / OPEN | fullPanelTop 已避让顶栏；短屏自适应的原生布局仍需验证。 |
| 9 | CODE FIXED / VM-OPEN | 顶部更多接入当前页书签切换，书架设置接入设置路由；需用户验收动作语义。 |
| 10 | CODE FIXED / LOCAL-PASS | 导入结果图标、列表高度和底部按钮尺寸已按状态/数量投影。 |
| 11 | CODE FIXED / LOCAL-PASS | 系统文件选择先返回 URI，再进入导入态，避免先显示错误导入弹窗。 |
| 12 | CODE PARTIAL / OPEN | 导入过程/完成/切换的完整 Figma 动效时间轴尚未取得。 |
| 13 | CODE FIXED / LOCAL-PASS | 搜索历史可展开/收起，按钮固定在尾行。 |
| 14 | CODE FIXED / LOCAL-PASS | 方向控制字符与实体分隔符已清理。 |
| 15 | CODE PARTIAL / OPEN | 加载指示已改单实例，动态图标连续性仍需原生帧证据。 |
| 16 | CODE DIAGNOSTIC / OPEN | 已保留 sourceId/bookId/tocUrl/entryCount 诊断；底层 book.toc 空目录来源仍需真实调用链证据。 |
| 17 | CODE FIXED / LOCAL-PASS | 已加入书架结果优先复用本地 snapshot。 |
| 18 | CODE SCAFFOLD / OPEN | 新增可配置 content inset profile；具体左右像素值需按设备/Figma 对照确定。 |
| 19 | CODE PARTIAL / OPEN | 自动亮度状态已有可见状态通道；图标最终样式仍需 Figma/原生确认。 |
| 20 | CODE FIXED / LOCAL-PASS | 亮度 MOVE 按约 16ms 节流实时写入，End 做最终提交。 |
