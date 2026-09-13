# 全量规格有限只读复核（2026-09-13）

范围：`docs/READER_REPAIR_SPEC.md` 全文映射；重点核对导入 picker/实测结果/动效、搜索简介与缓存 TOC、亮度实时链、五种翻页。初始只读授权；root 在两项实际探针失败后追加授权，仅修 `ReaderBrightnessWriter.ts` 与其正式测试。其余保持只读；不访问 HDC/VM、不提交、不重跑 Core 全套。

## 新增代码审计线索（先记录，再本地复现）

1. `ReaderBrightnessWriter.drain` 在窗口查找异常的 catch 中无 `windowEpoch` 校验，会直接取并拒绝当前 pending；旧窗口查询异常可能误拒绝 reset 后新窗口的新请求。成功查询分支已有 epoch 校验，此处不对称。尚未将其认定为真实设备复现；下一步注入旧查询失败与新窗口请求，执行实际生产 writer。
2. 同方法的 `win.getWindowProperties()` 在 native write 的 try 外；若窗口在 await 后失效、同步属性读取抛错，已从 pending 取出的任务可能不能 resolve/reject。下一步本地注入属性读取异常，确认 Promise 与后续队列行为。

## 两项新增缺陷的闭环

- 上述两线索均由实际生产 Writer 复现，原始结果 `readonly-brightness-failure-probe.json`：旧窗口错误误拒新 owner 的 .8 请求，实际 writes=[]；属性读取同步错误导致 firstSettled=false、未处理拒绝 `WINDOW_PROPERTIES_UNAVAILABLE`，后续 .7 虽成功，首请求仍丢失。
- 修改：lookup 捕获 `windowEpoch` 和 `lookupOwner`，旧所有者的失败不能消费新 pending；属性读取移入任务 try/catch/finally，保证 reject 和 inFlight 清理，后续队列继续。没有改连续拖动合并、自动策略、Cancel 或阅读进度。
- 正式回归扩充于 `tools/test-reader-brightness-writer.mjs`：跨窗口与同窗口换 reader owner、当前 owner 的真实 lookup 失败、同步属性失败后的新请求及 baseline 恢复。`brightness-boundary-before.log` 失败；`brightness-boundary-after.log` 全部通过。
- 原独立两探针修后 2/2 通过，见 `brightness-failure-probe-after.json`：新请求 writes=[.8]；首请求正常 settle，unhandled=[]，后续 .7 正常。关联 brightness-control、brightness-cancel-ui、surface-repair 三组通过（`brightness-related-checks.json`）。
- 截至此报告，这两项没有 VM/硬件发生次数证据；这是已确认代码故障边界及本地回归，不包装成设备验证。

## 原 21 条完整覆盖映射

“未新增缺陷”仅表示本轮有限复核未发现可确定的新实现错误，不能据此关闭视觉/设备/用户验收。非重点项复核生产接线、现有测试及最近证据，由对应集成 owner 继续完整验收。

| ID | 当前生产承接及本轮核对结果 | 仍须独立保留的证据层 |
|---|---|---|
| U01、U07 | ReaderSettingsState V5 单 extendIntoCutout；ReaderWindowCoordinator/ReaderStatusBarMeasurement、LRE 同一窗口/顶部信息策略。最新 `cutout-anchor-footer-audit.md` 已分析有效槽与模式重排，不能读隐藏 reserve 槽误报页码 | 当前 root 的刘海/锚点复核，以及同包旋转、返回、系统着色；不是等待用户重新定义开关 |
| U02、U03 | ShelfBookPresentation 与 ShelfBookListDetails 供普通/批量共用；source 名称/第四行居中和空作者最小行高已有代码与 SDK 回归 | 新包普通/批量、长 source/窄屏、源删除/改名画面 |
| U04 | BookshelfPage 筛选展开/小更新按钮与三点 More 分离，30vp 视觉/44vp 命中已有合同 | 同包展开/收起/主题和筛选实际操作 |
| U05 | ReaderSessionLaunchTimeline/Stage、LRE 与 Panel 四入口；原 3500ms 轨道及故障恢复由 capsule owner 当前专项继续复核。没有把 5 张抽样截图视为流畅度证明 | 四入口完整视频/连续帧、打断、真实输入/GPU成本 |
| U06 | ReaderThemeRegistry 两 app/八 reader、ReaderThemeSelection 单 reducer 和 ID 备份；同类型保留 system、异类型才固定模式，默认主题切换规则存在 | 同包全应用与阅读主题合成、跨平台消费验收 |
| U08 | 全模块高度预算及内部滚动已有实现；本轮先前确诊 Header 祖先 Block 禁止子节点，已改 Default 并跑七模块 SDK/Runtime 回归，见 `vm-full-auto-collapse-observation.md` | 修复包“收起”按钮原生命中、短屏/IME/旋转可达性 |
| U09 | Index→ReaderShell→LRE 书籍信息导航/保存/失败取消目的地链已补齐，More 菜单真实动作与系统 Back 分开 | 同包四动作、保存失败重试/继续及普通退出 |
| U10 | LocalImportDialog 摘要/行状态、created/existing/recoveryPending、清理旋转资源、测量真实行高、超高 Scroll、footer=width−32；没有继续 count×61 估高 | 系统选文件后的 1/多/混合失败、字体放大、横屏实际布局 |
| U11 | Index.beginImport 在 fileSelection 才准入，先写 pickerOpening 再调系统选择，准备返回后才 importing；每 await 的 attempt/navigation/runtime 检查及 stale selection 清理存在 | 系统 picker 首次/取消/权限、慢 staging 的真实提示与资源回收 |
| U12 | 同 shell importing→result；arc 1000ms linear，真实结果测量后 120/220ms 淡出/壳变形、80–220ms淡入；ReduceMotion/foreground/motionGeneration 条件存在。时值仍标注方案候选来源 | 实际页面交接、快任务、失败/后台/减动画观感；不能仅凭 animateTo 字符串宣称视觉通过 |
| U13 | BookshelfMoreMenu 三入口、工具栏默认分组轻量选择、BookshelfSettingsPage 与返回 viewState 接线存在；不误回 CRUD | 同包设置实际保存/返回、历史非默认分组保留 |
| U14 | SearchPage measureHistory 使用原生字体宽度+padding/border；SearchHistoryLayout 两行、固定尾行开合按钮；已监听 readerWindowMetricsRevision，因此字体配置变更不是新的遗漏 | 原生字体/长词/旋转后的实际两行与固定按钮位置 |
| U15 | Core normalization::normalize_display_intro 复用 scraper/html5ever；remote 的搜索/详情/书架输出边界调用；Host BookIntroText 仅处理 plain text，不把显示清理写回原始事实 | 现场失败文本显示；本轮未以 Host whitespace 测试冒充 Core 实体解析复测 |
| U16 | SearchPage 整安全视口常驻 SearchSpinner；query revision 控制新轴，1000ms linear/13和36两尺寸、后台/停止/减动画控制存在 | 流式搜索跨首批/停止/完成时的真实帧连续性 |
| U17、U18 | BookAcquisitionCoordinator.openBook 对所有非强刷先查持久目录；旧/缺/过期 acquisition 不再剥夺缓存。Core toc_with_next 写 canonical book_url；Gateway 分类、卷标题不重编、删源离线及诊断消费存在 | 同包五入口/真实站点/离线/换源；历史每个 TOC 失败响应归因仍开放 |
| U19 | ReaderLayoutGeometry 单事实 profile；LRE 测量/2D/Native/continuous 使用共享宽度与语义锚；本轮五模式回归未见默认32下限回退 | 实际版心、字体/图片重排；旧《绍宋》P08原 hash/scalar/layout仍不能凭新例关闭 |
| U20、U21 | Panel 每次 changed MOVE 即发出；LRE UI ACK generation 与唯一 Writer owner 分离；持续输入/停指/最终UP/Cancel/自动/恢复已实现。本轮新增并修复两个窗口异常边界 | 统一构建/新包 VM 策略与交互；物理亮度/系统环境光行为只由硬件回答 |

## 重点链深入复核结论

### 导入

`Index.ets:5283` 起 `beginImport` → BookshelfFlowGateway → LocalBookImportGateway → ReaderHostRegistry.selectLocalBookInputs。用户看到 importing 以前系统 picker 已打开；Host 会先恢复 stage，再选 URI、限量并发 staging，随后开始 Core parse/persist/asset/bookshelf/finalize。保存成功不因离页回滚；同路由 close/reopen 也递增 attempt。当前“待确认”和新增/已在书架不混算。

`LocalImportDialog` 的 resultItemsNatural 自然高度回调是布局来源，Header/Summary/Footer 分别测量；超短视口合并头部进入 Scroll，Footer 独立。结果阶段读取实测高度驱动同一 shell。此处未发现可确定的新状态链漏洞；已有测试仍有一部分仅查结构，所以保留实际 SDK/VM 排版与动效验收，不写成全部动态效果已通过。

### 搜索/TOC

重新执行 `toc-repair-regressions`、`book-acquisition-coordinator`、`book-metadata-presentation` 均通过。覆盖旧/缺/过期 acquisition 的持久 TOC、删源离线、身份隔离、旧变量不混入新规则、卷标题、错误链保留、请求和响应 digest 脱敏及来源分组守恒。`test-search-detail-cache-first` 本身主要是接线断言，不能单独当缓存业务证明；本次采用上述实际 Coordinator/Gateway 执行补足。

Core 标准实体函数及 `remote.rs` 四个输出消费者已只读核对；没有重新跑 Core 全套，也没有新的真实站点请求。已有 Core 完整门禁归原 manifest，不将本地显示层测试换算成未知站点均正常。

### 五种翻页和旧性能范围

| 模式 | 本轮确认的生产路径 | 本轮定点证据 |
|---|---|---|
| 仿真 | LRE usesBookTurnSimulation/shouldMountBookTurnSurface；Native surface 失败降 none，常驻2D/终帧保留；target revision/丢ACK安全交接 | preparation/settlement/presentation-recovery 实际方法通过；本轮不重编或宣称新 Native/GPU验收 |
| 平移 | ReaderPageInteractionLayer 物理首指与最新样本；Stage A/B固定槽、current/adjacent镜像几何；准备/保存/收尾边界 | page-input/stage/preparation/settlement/progress 通过 |
| 覆盖 | 与平移共用首指/准备/事务，Stage 独立层级及遮挡方向，保留五模式集合 | stage 的 slide/cover 正反向角色与同槽回归通过 |
| 滚动 | ReaderContinuousReadingStage List 首指、多指、图片重排分数锚、程序滚动与单 drain 保存 | continuous-input/continuous-reading/progress-observation 通过 |
| 无动画 | effectivePageTurnStyle 无额外视觉时间，仍走内容/持久准入；Cancel复位，不伪造无需读取/测量 | stage/settlement/page-input/page-progress 通过 |

本轮读取旧 `implementation-prior-gap-matrix.md` 52 ID + Make七组。原14项保护链、52项和12类性能没有因这次回归移除；原 P08 原文/位置证据、原生 attach/detach、真正 display fence 能力边界、持续资源/GC/GPU、120Hz/输入到屏幕、温升功耗、真实音频均保留。`postFrameCallback` 仍只称调度事件；没有把它换名为实际送显证明。

## 检查与交付边界

- 新增修复：两项亮度异常路径，正式 writer 测试红→绿；其余重点路径未发现另一个可确定的新实现缺陷。此结论是有限审计结果，不是“所有代码没有缺陷”的保证。
- 此次新增执行13个现有 TOC/元数据/翻页相关测试文件，全部成功，原输出在 `spec-audit-related-checks.json`。另外 writer+brightness-control/cancel-ui/surface 共4个文件通过（其中 writer 含新增行为回归）；独立诊断探针另计，不混入正式合同组数。
- `spec-audit-source-sha256.json` 记录本次关键源字节，不替代 root 的 commit/manifest。原 observation、失败记录、前包/二包截图保持原归属。
- 代码在亮度补修后冻结，后续只写此报告和证据。统一构建、签名、安装、同包 VM、最小硬件、用户验收由 root 分层记账。没有新增要求用户重新决定的产品规则或提供资料。
