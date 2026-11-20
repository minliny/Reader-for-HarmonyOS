# HarmonyOS 全页面尺寸源码审计（2026-11-01）

状态：原尺寸源码审计完成；A方案Phase1–6已实施，定向测试补齐、新签名HAP构建及验签通过。真机无线保数据覆盖安装及启动PASS；最新原生核对确认打开书源筛选后Reader进程退出，该步骤FAIL，原因待定位。精确字体矩阵与用户验收未完成。用户要求在书源管理页尺寸核对后，审计其它页面是否有同类问题。结论：同类问题跨书架、搜索、设置和阅读控制页存在，不能只修书源管理。

## 范围与证据

- 本轮范围为 HarmonyOS 当前工作树的全部 223 个 ETS 文件，包括生产页面、弹层、共用组件、非布局 owner 和开发诊断页；同时跟踪直接参与布局计算的 TS owner。不是 Android/iOS 审计，也不等于审读全部业务函数。
- HEAD `fce869a10399fd6feec4c9a8178808f43d55e31d`，工作树有大量既有 dirty/untracked WIP。证据绑定逐文件 SHA-256，不能仅用 HEAD 复现。
- 当前 `ReaderProductScope.ts` 固定 `l0`：Discover、RSS、Sync、unimplementedSettings 入口关闭。关闭入口的源码缺陷单列；保留兼容组件和开发诊断页也不混为当前可达产品问题。
- 当前主页面注册包括 Index、ReaderStartupRecovery、ReaderRendererPilot、ReaderControlMotionVerification；后两者属于开发入口，其子诊断画布的固定尺寸不自动作为产品缺陷。
- 本轮只做源代码尺寸审计，没有修改生产/测试源码，没有新运行测试、探针、构建、签名、安装、启动、HDC 或截图。原书源预算普通方法算例明确标为 REUSED。
- 下文的确定问题指尺寸约束、预算公式或声明的几何关系可由源码证明；不代表真机已发生裁字、误触或遮挡。字体算例中的 1.6 指有效 fp 比例为 1.6 的理论行框；真实字形和系统最终缩放由平台决定。本地 SDK `ets/component/text.d.ts:397` 明确数值 `lineHeight` 的单位为 fp。

## 当前可达路径的主要发现

### P1：独立全文字目录在宽屏忽略实际高度

`ReaderFullDirectory.ets:231` 已传入按窗口、标题和安全底部计算的 `panelHeightOverride`，并在 `:246` 用较小 `panelViewportHeight` 限高、`:249` 裁切。`FullDirectoryPanel.ets:1443` 却只在 embedded 或非 expanded 时接受 override；宽屏独立分支仍返回 852。

当宿主只剩 460vp 可用高时，子内容仍按 852vp 分配列表/底部区域，外层只显示 460vp。两层 viewport 不一致是确定问题，最后的可见范围、列表滚动和底部操作需修复后原生核对。另外 `contentHeight/bodyContentHeight/listHeight` 的 298/260/117 下限也需一起服从短窗预算，避免修 override 后仍被下限撑大。

修复边界：所有分支尊重有效 override；窗口预算统一为非负可用高，保留正文目录业务和现有动画身份。

### P2：搜索任务与书源弹层测量后漏算外部占高

|入口|源码位置|确定的预算差异|
|---|---|---|
|搜索结果 → 搜索进度|`ReaderSearchTaskPanel.ets:68`|fallback 包含 titleBottom12，实测 header 分支遗漏12；长任务内容填满上限时最大总流高多12vp。|
|书源管理 → 筛选 / 更多（含工具页更多）|`ReaderSourceFilterPanel.ets:112`、`SourceManagementMoreMenu.ets:122`|遗漏 BoundedSurface 的 contentBottom20；实测后又遗漏 Header 的外 margin12，合计最多32vp。|

共用 Header 的 `onAreaChange` 回执是自身 frame，`:167` 的外 margin 不在其中；`ReaderBoundedSurface.ets:68` 另外增加 contentBottom20。搜索筛选已修的 header 预算不能替这些调用者兜底。

- 搜索进度理论例：窗高844、安全边各24、header frame44、contentBottom20；测前 body720，测后732。实测路径总量 `44+12+732+20=808`，大于可用796，差12。
- 书源旧算例 REUSED：safeTop/bottom24、footer72、header frame44；844×366 或 240×360 命中剩余高分支时多32。366×844 命中64%上限仍有余量，不能声称该竖屏算例已溢出。

修复边界：明确相加 header frame、titleBottom、contentBottom、footer 的完整占高，保留原有64%上限和滚动业务。

### P2：TTS 配置管理的父预算没有跟随共用 footer 增高

`ReaderTtsConfigOverlay.ets:249` 给 manager body 仍扣固定 `58+76`；实际 footer 使用 `ReaderBoundedSurfaceActions.ets:56` 的 scaledHeight。该角色行高为 AUTO，resolver 回退20；systemFontScale1.6 时 footer 从76变88，但 owner 仍扣76，差12vp。紧凑模式阈值也未计这段增长。

修复边界：owner 与实际 footer 使用同一高度推导或实测值，同时更新紧凑阈值；不能通过删除公共字体增长策略掩盖父预算错误。

### P2：书架与设置中仍有固定文字框

|入口|源码位置|源码约束冲突及理论例|
|---|---|---|
|书架列表 / 多选列表|`ShelfBookListDetails.ets:28`、`:51`、`:56`|标题行18、整体72、tag16固定；文字为 system fp。有效fp比例1.6时，18fp标题行框28.8仍装在18vp内；四行文字加进度/间距理论107，对比整体72。消费行也有72/80固定高。|
|书架多选标题|`BookshelfMultiSelectPage.ets:176`|58高减上下7 padding仅44；34.49fp行高在1.6比例下为55.184。|
|设置分类标题|`ReaderSectionHeading.ets:18`、`:22`；`CategorySection.ets:18`|固定16vp，行高15.6fp，无相同缩放约束；1.6比例理论24.96vp。外层 Card 无修改此标题 frame 的兜底。|
|漫画 → 阅读方式 / 设置选择项|`MangaReadingSurface.ets:2669`|选择行44高、上下padding8；即不扣border也只剩28，18fp在1.6比例下为28.8。|

以上确认的是系统文字与固定 vp 容器的契约冲突，未观察真机最终裁字。纯图标、固定封面、正文分页画布和图像 tile 不因固定尺寸自动列错。

修复边界：由文字角色、实际行框及 padding 推导自然高/最小高，并同步消费者；保留固定封面和图标目标的语义。

### P2：当前阅读控制栏的文字轨道与系统缩放脱节

当前生产 `LocalReadingExperience → ReaderControlPanel` 路径也存在同类文字契约，而非只出现在 retained 兼容组件：

- `ReaderControlSearchContent.ets:546`：结果标题 frame高13，行高角色13.2fp；有效fp比例1.6时理论21.12。
- `ReaderControlSettingsContent.ets:216`：Quick标签的vp高度与数值fp行高直接使用同一个几何数12；1.6时理论行框19.2，frame仍12。
- `ReaderControlAppearanceContent.ets:732`：步进标签高18、行高18fp；1.6时理论28.8。
- `ReaderSessionCapsule.ets:50`：标签高16、行高12.5fp；1.6时理论20。

书签行、替换规则行、控制栏标题和计时滚轮的固定文字轨道也列在逐项证据中。这里需要统一的是阅读器 chrome 各角色的缩放政策，与用户设置的正文阅读字号分开。若采用系统缩放，就同时调整 actor邻接位置、列表尺和滚动内容范围；若某角色明确采用固定策略，应显式编码有限的 min/max scale。不能仅删必要的分页、图片或动画裁切来掩盖不一致。原生裁字结果仍未验证。

### P2：书源底栏的同排动作增长策略不同

REUSED 并重读当前消费：`ReaderButton` 的批量管理 base44、13fp、AUTO行高回退19.5，在 systemFontScale1.6 时框高56；`ReaderLabeledIconAction.ets:83` 的新增书源仍固定44。该同排框高差可直接计算，实际字形裁切未证。检测/登录固定宽44则属于横向文字容纳待证风险。

修复边界：同排使用相同高度与字体约束；不要全局放大所有图标或改全部字体规格。

### P2：阅读外观快捷主题声明的点击区相邻重叠

`ReaderControlAppearanceGeometry.ts:60` 的 Quick 横向步长是 `(quickSectionWidth-64.5)/3`，`ReaderControlAppearanceContent.ets:468–476` 却仍给每项宽62.5的 responseRegion。按当前宽度传递，366vp窗口的步长58.5，相邻声明响应区重叠4vp；320vp窗口的步长约43.167，重叠约19.333vp。`sharedClip` 在 Quick 端点保留62.5宽，未见按stride横向裁小的兜底。

这是声明几何重叠；不据此断言手机已经误触，也不推断 ArkUI 的命中优先级。修复应同时满足响应区不重叠和最小目标；空间不够时调整列数/行布局，保留主题身份及动画。

## 需要原生证据才能定性的风险

|范围|具体代码风险|边界|
|---|---|---|
|JSON 导入（书源、规则等共用）|`JsonImportDialog.ets:52` 未选择 `ReaderDialogSurface.scrollBody`，默认 autoHeight；中心全屏 Stack 无本地限高/滚动，Index无独立兜底。|短窗、键盘、长说明/校验文字下可能缺少操作空间；原生 resize/avoidance 未运行。应复用已存在的 boundedContent 分支。|
|书源导入 → 目标分组|`SourceImportPage.ets:370` 外表单含固定240列表、搜索、输入和动作，只有列表滚动，外表单无可用高度预算。|不把固定240本身判错；FIT_CONTENT、键盘和底部动作可达性待证。|
|阅读外观选择菜单|实际选项行测量增高，`ReaderSelectPanel.ets:368` 总高cap330；`ReaderSelectAppearanceStyle.ts:17` 定位却按44/项估算。|已有上下翻转/钳位，不能说完全没有；实测高增长后未同步锚点/剩余高度。当前3选项基础估计140。|
|书架管理阅读记录|`BookshelfManagementPage.ets:329`、`:340` 固定44行，标题无maxLines，列表上限也按44/条。|长名称、窄窗、放大字体的真实换行未测。|
|详情目录胶囊|`LocalBookDetail.ets:580`、`:583` 固定94，扣左右padding22、icon20、gap6后文字预算46。|四字12fp是否容纳由真实字形决定，不以名义字宽当测量结果。|
|共用紧凑控件|source/directory/quick输入固定内外高、主题segment固定168×36/item30、交互Web工具栏固定56。|文字AUTO行高或最终字体缩放未测；作为后续验证观察点，不认定全部有视觉故障。|

## 关闭入口、保留实现和边缘条件

- 当前关闭的 Discover：分类 Row/Scroll固定32，真实 ReaderButton 在systemFontScale1.6时高42，父子约束不一致（`DiscoverPage.ets:250`、`:255`）。
- 当前关闭的 RSS：详情底栏62减上下8仅46，按钮由46增至58；首页statusTabs固定30，按钮由30增至41。其余固定 metadata/header 行、设置选择面板的无界高度为待证风险。
- Settings 的 selectRow/SettingsSelectOverlay 入口受 unimplementedSettings gate 控制；当前主题 segment 仍可达，二者不能混算。
- retained `ReaderAppearanceFullPanel` 使用 appearanceCompact，固定Text14与14.4fp行高有冲突，但当前只见保留 MotionStage 消费，无当前生产 ETS 调用链；不算现用页面故障。
- P3边缘项：本地导入结果 footer 的 `ReaderRecoveryAction` 最小44加外padding17×2，至少78vp；若可用高仅60，body缩到0仍多18vp。未证明当前设备可达60vp可用高，不作为正常窗口主问题。
- 现有 `SourceManagementPage` 在内容宽<400或任何systemFontScale>1时把动作整组换到第二行，是确定的结构分支；当前13/10/11fp紧凑字号也是现行配方。设计是否需要改动另行评估，不伪装成已复现异常。

## 已排除的错误归因

- 当前搜索/书源分组行的选中标记已经是 DrawModifier，不再以百分比高度子项反撑自动高行；不把旧根因重新报为全站问题。
- 普通页面 Index 与 PageGeometry/Scaffold 的代码未证明重复 safeTop。source 行只有 minHeight76，不能按旧分组百分比根因处理。
- Scaffold 的全屏 footer/overlay 外容器使用透明命中；不能仅凭100%尺寸断言返回键被整屏 footer 拦截。
- 动画 actor、绘制画布、测量节点和图像页的专用几何已与普通表单、选项、列表文字框分开；开发诊断画布也不计生产问题。

## 覆盖与交付

|范围|ETS数量|本地尺寸范围未审读|说明|
|---|---:|---:|---|
|书架|24|0|列表、网格、详情、导入、管理、多选和子组件|
|搜索|9|0|共享搜索栏、结果、历史、筛选、任务弹层及宿主|
|发现 / 下载|2 / 1|0|发现当前关闭；下载按当前入口审读|
|设置|10|0|当前分类/主题与被关闭的选择入口分开|
|书源|15|0|管理、分组、导入、工具、换源及非布局owner|
|RSS / Sync|8 / 2|0|当前关闭，源码发现另记|
|Shell|6|0|导航、阅读宿主、换源宿主及组合边界|
|文字阅读 / 漫画|69 / 9|0|当前控制栏、目录、TTS、漫画设置；保留/诊断/绘制例外单列|
|共用组件 / App / 页面入口 / EntryAbility|57 / 3 / 7 / 1|0|含有限规格、非布局适配器和开发入口|
|合计|223|0|不是223个独立产品页面，也不是223个native PASS|

[完整覆盖与发现记录](ui-dimensions-coverage-20261101.json) 保存223个文件的状态、审读范围、内容指纹、准入边界和发现ID，以及48个相关布局源的范围/指纹。共23组记录，包含确定预算、缩放契约、待证风险、当前关闭入口和P3边缘项，不能当作23个已复现故障。

覆盖核对：0遗漏、0重复、0本地尺寸范围pending、0已审输入漂移；原生已验证页面数为0。目录、任务弹层、TTS、书架/设置文字框等主要结论已由汇总owner重读相关源码，不能仅把并行审读回执当作运行证据。

原始分区清单与审读回执位于本聊天私有目录 `all-page-dimension-audit-20261101/`；源指纹及完整发现已并入上述仓内JSON。书源旧算例出处见 [书源管理尺寸问题](source-management-layout-20261101.md)。

实施顺序建议：先修目录与各弹层的高度预算，再统一具体文字角色/同行动作/命中区域的约束；随后才按仍未决的问题选择最小原生验证。此次没有执行新的门禁或设备操作。修复、原生观察和用户验收仍分别为 OPEN；本报告不自动授权新设备取证。

## 2026-11-01 追加：A 方案实施、测试补全与交付状态

本节是内部实施总账。上文保留原审计时点的源码判断、223个ETS/48个相关源的指纹和历史状态；其中“未改/未跑”描述原审计，不代表本节后的实施状态。未将历史审计哈希刷新成新源码，也未将源码/SDK探针结果当作原生验收。

用户在本聊天明确批准：

> 确认演示，采用书签修正，继续 Phase 1–6

> 允许补这 2 行测试依赖并复跑原检查

第二项仅对应Header测试的两行实际预算依赖注入和原检查复跑。后续“补全未完成内容”授权用于本轮定向测试补齐及构建/保数据安装交付，交付结果仍按实际回执记账。

### 已实施的源改动

A方案Phase1–6已落地：22个既有生产文件、1个新增预算模块，共23个生产文件；初批另有3个既有测试、1个新测试和2份demo，共29文件。精确归属来自私有before副本与 `implementation-delta.patch`，不以dirty工作树整份git diff认领既有WIP。后续测试补齐单独记账，无新增生产改动。

目录统一override（默认-1，含0）和非负预算；搜索/书源弹层显式扣header外margin与surface底部；TTS父与footer共用76/82/88预算；书架详情与五处列表投影同步72/89/107而封面不变；多选/分节/漫画选项采用最小高；chrome采用批准的角色cap，书签摘要1.07、标题及同行信息1.1；Quick主题366响应宽58.5，新增书源与同排按钮44/50/56。AUTO行高仍不保证原生像素边界。

初批15项PASS、4项既有FAIL记录保留；本轮不重跑已通过15项。以下9个准确入口新增实际回执：

|入口|case|结果|证明范围|
|---|---|---|---|
|tools/test-ui-dimension-budgets.mjs|directory-mount|PASS / exit0|Actual ReaderFullDirectory SDK Builder and viewport methods pass admitted height to actual FullDirectoryPanel Prop schema; parent clip/width and entries update+flush retained. Child full native render not asserted.|
|tools/test-reader-directory-typography.mjs|panel-roles|PASS / exit0|Actual SDK Panel header/tab plus actual ReaderPanelCollapseButton/spec; semantic roles and close/bookmark callbacks.|
|tools/test-reader-control-directory-content.mjs|current-row-hit|PASS / exit0|Actual current parent32/36/40 input to actual shared ChapterRow; SDK attribute recording visual/response44 and canonical chapter callback. No native touch/raster proof.|
|tools/test-book-directory-page.mjs|measured-frame|PASS / exit0|Actual Scaffold/FixedHeaderHost/SearchField; native TextInputController I/O adapter;132 to179 header delta propagates47 to current scrollLayout while retaining actor/scroller/targets.|
|tools/test-shelf-progress-projection.mjs|retained-list|PASS / exit0|Actual SDK retained Page→List, original label/Progress node identity, current More, stale navigation/unmounted negatives; actor height72 and cover+sharedGap translation asserted. Current production GridSpec import replaces four removed Page grid constants; four List constants remain current Page owner.|
|tools/test-detail-external-directory.mjs|explicit finite script|PASS / exit0|Existing external directory/retained detail/initial bookmark/SDK wiring assertions and old-code negative retained. Actual traceShelfMotion/currentReaderPresentationIdentity selected; actual clock through uptime platform port, recorded hilog back-entry asserted.|
|tools/test-reader-tts-short-window.mjs|sdk-scales|PASS / exit0|Actual SDK shared Actions at1.3/1.6 footer82/88, action/hit50/56, original physical callbacks reject current busy. Earlier1x+budget scope reused and not rerun.|
|tools/test-reader-control-appearance-geometry.mjs|current-geometry|PASS / exit0|Actual SDK Quick shell62.5x44/paint46x18;366 lane58.5 and hitx2;320 unresolved and Full/morph admission.|
|tools/test-reader-control-search-settings-content.mjs|settings-sdk|PASS / exit0|Actual SDK current settings builder with real action dependencies; current semantic callbacks and typography assertions retained.|

目录真实挂载case验证的是实际父Builder、实际子Prop元数据和父clip/更新链；不声称完整子树原生渲染。TTS sdk-scales补1.3/1.6真实Actions footer82/88和动作50/56，原busy/旧回调拒绝保留。历史legacy-embedded32/40诊断未改成44，仍作为历史FAIL；当前入口current-row-hit单独证明父输入32/36/40与共享子最小44，未更改生产。appearance历史24期望未冒充当前44策略通过；用current-geometry单独验证。所有中间FAIL、具体依赖归因和定向补跑日志保留。

### 构建与安装过程记录

首个signed构建尝试 **FAIL**：`1793528274323-9b12f976-9fc9-4e34-b3c4-33ca2434bc57`，2026-11-01T10:17:54.323Z开始、10:17:55.993Z结束。回执 `.reader-artifacts/hap-attempts/1793528274323-9b12f976-9fc9-4e34-b3c4-33ca2434bc57/stages.json` 的stage数组为空，失败为 `Core build evidence does not bind the actual source input snapshot`。该失败发生在ArkTS编译之前，不能据此判断UI编译通过或失败；本次尝试没有新签名产物或安装。

当时总交付状态为NOT_COMPLETE；后续结果见下节。首失败回执保留，不追溯改写。精确设备标识仅存私有回执，不写本报告。

Phase7风险、320主题、目录<214和本地导入P3边缘项仍保留，未声称全页原生完成。本文件不是发布说明。

私有证据根：`/Users/minliny/.codex/visualizations/2026/11/01/01a19364-dddb-7832-bf04-d7e6150b3fd5`；初批 `ui-dimension-A-implementation/implementation-results.json` / `implementation-report.md`，本轮 `ui-dimension-A-test-completion/`、`ui-dimension-unfinished-tests/results.json` 和 `ui-dimension-A-implementation/test-completion-appearance-settings/`。JSON新增 `implementationCompletion20261101` 单独保存批准、初批指纹/状态、9项回执和待填交付字段，原审计内容保留。

### 本轮追加结果：新签名产物PASS，设备传输待恢复

- 新规范迭代构建runId：`20261101T102430Z-fce869a1-43ef0192`；2026-11-01T10:24:00.134Z–10:24:29.674Z。全项目ArkTS检查、非增量打包、签名和后续canonical verify均PASS；contracts scope为none，完整合同与Core门禁NOT_RUN，acceptanceEligible=false。
- [不可变manifest](../../.reader-artifacts/hap/20261101T102430Z-fce869a1-43ef0192/manifest.json)；signed HAP为同目录`entry-default-signed.hap`，214789175bytes，SHA256 `301b1f7599c2691e33cd7a680f46e9a3f573f407edc8e0b0c03fda226be8e795`。指定minliny_HarmonyOS证书SHA256 `3a563778e5bf17cd3ead0218e13b4a5030de3f5d7d4e21e0336d8eb37b676dc4`，debug Profile，验签通过。产品版本0.2.0/安装计数1000000未改。
- Harmony HEAD `fce869a10399fd6feec4c9a8178808f43d55e31d`、Core HEAD `80d614e929ae9e320ab767a1dc04579363c361d7`，均dirty；证据以manifest内容指纹绑定，未把HEAD当完整输入。23个A生产文件均与前次精确after-hash一致，原15项相关检查记REUSED，本轮9项新入口记PASS。
- 首次失败来自默认Native缓存混配旧evidence与较新source snapshot。尝试规范Native重建时，现有dirty Core同步模块出现3处类型不匹配、1处不存在字段；未改这些并行源码，也未消费失败产物。随后核实原始生产字节归档满足规范入口全部六项输入，原配快照/Core输入指纹、SDK、SO和宿主字节配对通过，直接只读复用；未手改evidence或伪造资源。归档只是Native消费输入，不是新Cargo编译缓存；保数据只读inspector复用原始Reader-Core/target中的同输入构建。
- 真机准确目标、直连en0 socket和本机HDC服务已核验；签名/启动准入PASS。只读inspect因App仍有写入进程STOP，未将它作为安装许可。实际install随后完成停止应用、DB/WAL/SHM保留备份、同输入inspector准入与安装前复核，`hdc install -r`在180秒超时，无成功安装或启动回执。
- 超时后bundle仍存在，观察到的更新时间仍为2026-11-01T06:54:00.541Z；不能声称新候选已安装。未卸载、清数据、改证书或重启设备；没有盲目重复安装。HDC服务实际responsible PID与当前宿主一致，没有据此例行重启服务。传输日志出现持续TCP发送回压，已请求USB连接或进一步定位无线传输。
- 当前新候选的RuntimeReady、9场景原生观察、366×844下1.0/1.3/1.6精确矩阵及用户验收均NOT_RUN/OPEN。仅抓取一次当前系统画面核查是否有安装确认，不作为候选原生UI证据。安装恢复前不扩大截图或操作其它应用。

当前状态：**等待设备传输恢复；源码/定向测试/新HAP及签名已完成，真机安装和原生验收未完成。** 本轮私有交付证据目录为`ui-dimension-completion-20261101/`，含首次失败、Native重建失败、归档成功构建、verify、inspect、保数据安装超时和备份引用；原始失败未改写。

传输补充：单次1MiB普通文件上传350ms完成，远端SHA256与本地一致，已删除本次自有临时样本；含校验/清理总计1576ms。它证明普通上传路径可用，不证明215MB安装通道可用，也未把回压日志直接归因为手机、签名或网络配置故障。两次私有诊断适配器在实际操作前因跨CLI时钟比较被拒；修正为官方当前两次采样准入后完成本次样本，没有放宽生产安装准入或重复安装。

### 用户选择继续定位无线传输（后续批次）

用户明确选择“继续定位无线传输”。现场准确目标仍Connected；实际socket的nettop接口与route均为en0，HDC server的responsible PID与当前宿主进程一致，没有例行重启服务。一次同体量对照把同份214789175byte不可变signed HAP经普通FILE上传，47920ms完成，远端字节数与SHA256均匹配，已删除本次自有临时样本；未触发安装或访问App数据。它证明当前普通大文件通路可用，仍未解释上次安装超时。

随后仅安排一次带host TCP/服务端阶段观测的规范保数据安装；同一manifest和原始inspector缓存复用，无新构建或业务套件，HDC安装仍限180秒。新批次结果见后文实际回执。err35只作背压线索；APP_FINISH可晚于上传结束，不能用其缺席单独认定上传未完。该机制仅参考[官方固定提交8efffcf2](https://github.com/openharmony/developtools_hdc/blob/8efffcf2fa2f5d4f997f2de8eb287432959417c8/src/daemon/daemon_app.cpp#L155-L175)，尚未建立其与本机SDK二进制的commit映射。

### 无线后续批次实际结果：保数据安装与启动PASS

规范部署回执：[deploy-physical-20261101T113701Z](../../.reader-artifacts/hap/20261101T102430Z-fce869a1-43ef0192/deploy-physical-929ff1c0644b-20261101T113701Z.json)。同一signed HAP SHA256 `301b1f7599c2691e33cd7a680f46e9a3f573f407edc8e0b0c03fda226be8e795`，2026-11-01T11:37:01.668Z完成；install/launch/dataRecheck均PASS，真实写入屏障、保留备份和候选身份绑定均由规范流水线记录。指定证书/debug Profile复核通过；版本仍0.2.0/1000000，无卸载、清数据或证书变更。

完整动作含准入/备份约79.29秒，APP_CHECK至APP_FINISH约53.56秒。127个有效TCP采样中，累计发送增量214849338bytes，发送队列最大1046528、结束为0，连接仍ESTABLISHED。没有重启服务、重连设备、修改代理/网络规则、扩大180秒时限或重构建。旧180秒超时保留FAIL；本次独立尝试记PASS。原超时未复现，根因仍OPEN，不能声称已由某个配置/源码修复。

后续只读启动观察得到Reader PID及生产Index布局树。系统Display诊断为1280×2832、density3.5、virtual365×809（按density约365.71×809.14vp），不能重标为演示366×844。现有Reader日志本次未取得显式RuntimeReady/Native身份记录，布局也不导出systemFontScale。

准备首次候选截图时，新的布局显示Reader已不在前台；前台检查在截图前停止，本轮候选截图和UI点击均为0，没有继续操作其它应用。随后只读检查仍有Reader进程，未将前台变化归因为崩溃或用户操作。已询问手机是否空闲约3分钟进行可达页面核对，等待现场条件。

当前交付：**新HAP构建/验签、真机保数据安装、启动PASS；精确字体矩阵、RuntimeReady直接证据和用户验收仍OPEN。** 原未完成/超时段落保留为历史过程，不代表本节后的安装状态。私有后续证据位于 `ui-dimension-completion-20261101/wireless-20261101T1127/`。

旧客户端日志收束：当前TMPDIR/hdc.log中原安装channel仅保留CHECK/BEGIN以及约182秒后客户端EOF，没有足够的上传字节进度、bm启动或完成记录；已将准确channel行保留至私有证据。EOF发生在超时终止本次客户端之后，不能当作设备独立断连或签名失败证据。后续检查仍见Reader同一PID存活；当前只等待手机可用于剩余界面观察，不再派发无线重试。

### 新原生验证异常：书源筛选打开后失去Reader前台

状态更新：系统Info日志在2026-11-01 19:59:57.609记录PID44994的Ability terminated，19:59:57.618记录onProcessDied；后续pidof确认进程不存在。已确认点击的是当前筛选44vp Stack，不是新增或更多。点击完成11:59:58.041Z、失败布局12:00:04.118Z，均在11:57:21.250Z起180秒观察窗内。该步骤记FAIL_PROCESS_EXIT，底层JS/native/系统终止原因仍无栈证据。

三份已取得的候选截图仅支持当前窗口/当前字体下：书架前五个完整可见列表行未见明显文字跨行/裁切；设置分节和四入口对齐；书源管理主页面与底栏可见。源文件和截图SHA保存在私有native-current-20261101T1157/native-observation-results.json。未执行滤层关闭、更多菜单或三档字体矩阵；未改书源、书架或阅读进度。

全局faultlogger目录PermissionDenied；已知应用自身日志目录受限路径不重试。可读系统日志只有生命周期死亡和SceneBoard退场，无异常栈。旧SearchFilter requestFocus150003不属于本次SourceFilter的clearFocus入口，未将旧原因套用于当前故障。新增纯数值预算/实际DTO传递/DrawModifier可用性也没有提供可证退出根因。最后一次历史持久日志查询在派发前因系统guest/host时钟采样不一致被阻止，实际query未运行；保留该失败观察，不放宽正式App操作准入。

剩余诊断需要应用生命周期退出原因和本应用APP_CRASH事件记录。A方案第11节明确“只允许改以下文件；任何额外文件需重新批准”，EntryAbility及新增诊断适配/测试文件不在该白名单。本轮先准备独立私有补丁供审阅，尚未应用到这些生产文件、构建或再次占用真机。

用户确认手机空闲后，当前字体/窗口下书架、设置和书源管理主页面已取得截图及布局树。点击书源筛选触发Stack（从当次布局读取bounds[892,367][1046,521]）后，下一份布局仅有SceneBoard，Reader不在前台，截图保护停止。尚不能判断崩溃还是其它前台转换，不将此步计PASS。已停止3分钟UI观察，不再点击/截图/启动；先核对准确触发链、当前进程及已有异常日志。准确候选仍为20261101T102430Z-fce869a1-43ef0192。私有事件记录：native-current-20261101T1157/filter-foreground-loss.json。

## 2026-11-01 追加：诊断交付、实际异常栈与Builder修复

以下为新增历史，不覆盖前次已安装UI候选的原生退出失败，也不追溯改写23文件复用记录。23/23字节复用结论属于其当时快照；之后Filter/More两文件的Builder修复另记delta。

用户明确批准“允许诊断补丁并交付（推荐）”后，EntryAbility、ReaderCrashEvidence及对应测试三文件已应用；`launch-gate`、`crash-bounds` 两个准确case PASS。诊断only候选 `20261101T124304Z-fce869a1-7131a9e2` 构建和verify均PASS，signed HAP SHA256为 `0c390c959e335ea3fe9f3bf84392cef4bbc2345bd399819868cd69dcea02905d`。无线保数据安装180秒超时FAIL，未取得成功安装回执，仍为此前UI包；不声称诊断包已运行或已读到它新增的私有记录。

既有持久HiLog经官方字典解码PASS，确认2026-11-01T11:59:57.599Z、PID44994的RuntimeError：`TypeError class constructor cannot called without new`，栈为 `ReaderSourceFilterPanel.ets:263 → ReaderBoundedSurface.ets:107`。这不是从空日志推断的原因，也不是修复包的真机通过证据。

源码与真实SDK输出相符：Filter/More内联header箭头中的 `ReaderBoundedSurfaceHeader({...})` 被保留为裸class函数call；两owner已改为 `@Builder sheetHeader(identity)`，原身份、close、测量和预算守卫保留。SearchTask原本使用Builder，字节不变；受保护的共用Surface/Header/Spec等未改。新增 `test-ui-dimension-budgets.mjs --case sheet-header-mount` 使用实际SDK三owner及修前负对照，结果PASS；本地挂载通过不替代原生验收。

**修复候选尚未产出，未安装、未真机验证。** canonical es2abc三次FAIL，出现550个program预期/实际549与 `Unimplemented code path[index.js:0:0]`；已捕获的相关输入为 `font-archive/index.js` 中 `import.meta.url`，该输入来源正在调查，尚不据此宣称修复UI源码编译错误或完整根因。停止盲目重试，保留三次失败与编译输入回执。

当前状态：`SOURCE_FIX_BUILD_BLOCKED_PRIOR_UI_INSTALLED`。既有原生filter退出仍为FAIL，修复包build/sign/install/native均未完成；九项测试补全与早期15项通过仍按原证据保留，不重写成原生PASS。新成功候选、保数据安装回执和同场景修复后原生验证均待实际追加。

私有证据：`ui-dimension-completion-20261101/diagnostic-delivery-20261101/{plan.json,timeout-analysis.json,compiler-input-capture/result.json}`；修复归属见 `diagnostic-delivery/source-filter-builder-fix/changes.md`，完整最新状态同步至私有 `completion-delivery.json`。本次只更新两份内部总账及该私有状态文件，无测试/构建/HDC动作。

## 2026-11-01 追加：当前源码修复候选构建通过，等待亮屏

canonical current-source build **PASS**，run `20261101T133504Z-fce869a1-37e4ef21`，signed HAP SHA256 `904cb3737e86c152fdc86020ce766fb8b4cd1ffa5ced4035ad1db3d91bdbf7a4`，manifest `.reader-artifacts/hap/20261101T133504Z-fce869a1-37e4ef21/manifest.json`。这是新的成功回执，前述三次es2abc失败保持历史FAIL，不追溯改写。

只读字体来源核对确认：捕获输入确实来自当时App源码 `ReaderFonts → ReaderDownloadableFontHost → font-archive`；当前源码已不存在这条链，当前四个字体文件SHA与124304成功诊断候选相同，当前 `entry/src` 与该诊断候选仅Filter/More两文件不同。没有cache污染证据；无法确认引入者或机制。证据为私有 `diagnostic-delivery-20261101/compiler-input-capture/font-origin-readonly.json`。

13:36:21Z准确目标fresh preflight为Connected，但screenPowerState=3（OFF）；**尚未启动安装**。已异步请用户亮屏，正在等待回复，历史OFF回执 `fixed-delivery-20261101T1335/preflight-screen-off-first.json`。当时阶段为 `FIXED_SIGNED_BUILD_PASS_INSTALL_WAITING_SCREEN`，保数据安装及修复后原生验证尚无结果；此处不作最终交付结论。既有安装超时和原生退出FAIL仍保留。

## 2026-11-01 追加：修复候选保数据安装及启动通过

用户再次明确已亮屏解锁并要求立即安装。13:38:21.698Z fresh preflight Connected、screenPowerState=0；唯一实际server、已建立target socket及en0 route/nettop证据留在私有回执，不公开设备标识。

canonical signed修复候选 `20261101T133504Z-fce869a1-37e4ef21` 安装耗时45.86秒，exit0；**install PASS、launch PASS、dataRecheck PASS、dataPreserved=true**。回执 `.reader-artifacts/hap/20261101T133504Z-fce869a1-37e4ef21/deploy-physical-929ff1c0644b-20261101T133907Z.json`；候选SHA256 `904cb3737e86c152fdc86020ce766fb8b4cd1ffa5ced4035ad1db3d91bdbf7a4`。版本仍0.2.0、versionCode1000000，未变更。

当前状态 `FIXED_CANDIDATE_INSTALLED_LAUNCHED_NATIVE_RECHECK_OPEN`。诊断文件正在只读收集，等待root实际结果，尚不记PASS。未点击筛选、无截图；原崩溃历史FAIL保留，修复后实际入口native复验仍NOT_RUN，全页面验收OPEN，字体/窗口矩阵NOT_RUN。构建、安装、启动通过分别记账，不据此宣称原异常已在设备验收通过。

## 2026-11-01 追加：启动诊断收集通过，原生验收仍开放

13:39:29.706–13:39:36.171Z只读收集PASS：固定私有文件157bytes，SHA256 `0cf6044d1a68ce49799089256123a27d9fdcf78d02a4886e88e83375933d005b`，Reader PID present=true，1条记录与新启动相关。回执 `fixed-delivery-20261101T1335/private-evidence-result.json`。

记录source=launch、receivedAt=1793540347334、reason=4、message=TypeError，无stack。官方SDK `LastExitReason.JS_ERROR=4`，这是本次启动携带的**上次退出信息**，不表示新包刚发生JS错误；APP_CRASH记录数0，不能宣称旧崩溃堆栈已回补。此次PASS证明启动诊断记录和只读采集工作，不是筛选修复原生验收。

当前交付状态收束为 `FIXED_SIGNED_INSTALLED_STARTUP_DIAGNOSTICS_PASS_NATIVE_ACCEPTANCE_OPEN`。修复候选签名构建、保数据安装/启动及启动诊断PASS；筛选实际入口native复验NOT_RUN，全页面/字体窗口矩阵仍OPEN/NOT_RUN，原崩溃及安装/构建失败历史全部保留。没有cache污染证据；字体相关输入的引入者或机制仍无法确认。
