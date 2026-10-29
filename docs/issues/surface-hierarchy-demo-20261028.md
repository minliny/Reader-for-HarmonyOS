# 内嵌与悬浮表面的区分（2026-10-28）

用户反馈内嵌卡片/组件与悬浮组件看起来没有区别。本轮先核对已有demo与App表面规格，不操作设备、不修改App，仅改静态评审demo。

## 定位与唯一owner（修改前）

新跨页稿的continue-card与bottom-nav都使用同一surface的88%填色；导航阴影约3% alpha，历史面约2%。group-card/source-card/page-header/history-frame/sheet也共用surface，角色表甚至将“工具栏/实体卡片”和“弹层”直接写成同一层。内嵌卡边界比导航更强，形成视觉权重倒置。旧完整动线demo也有相近的填色/细边/弱阴影，但该文件继续作为历史动效参考，本轮不改其时序或几何。

| 角色 | 消费者 | 静态承载关系 | 新唯一角色 |
|---|---|---|---|
| 页面 | screen/phone/list行 | 基底 | paper |
| 内嵌 | continue-card/group-card/source-card | 内容流中，随页面滚动 | embedded-surface/border，无投影 |
| 固定栏 | page-header/search-bar | 预留布局空间，固定不自动代表悬浮 | toolbar-surface/border，无投影 |
| 非模态悬浮 | bottom-nav | 四周留空，覆盖内容上方 | floating-surface/border/shadow |
| 模态浮层 | history-frame/sheet | 遮挡背景，背景不可操作，显式关闭 | modal-surface/border/scrim + popover/sheet影 |
| 阅读控制 | reader-controls | 专用表面，继承模态空间关系 | 专用暖白/青蓝保持，只复用浮层边缘与影 |

所有demo颜色/边界/影参数归`reader-warm-palette-20261028.css`；新的`reader-surface-hierarchy-20261028.css`只映射角色到组件，不另写一套色值。跨页主稿与结果iframe/独立稿共用两文件。比较模式通过同一owner切换“角色分层/同底对照”，不改变尺寸、圆角、排版、筛选或路由。颜色可共用，承载关系与视觉线索必须独立；不按position:absolute/fixed批量加投影。

## 最小验证计划（执行前）

本次待回答：内嵌、固定栏、悬浮与模态是否由不同角色绘制，iframe是否同步比较模式，阅读专用表面是否保留。使用已有本地Chromium，仅检查computed样式、同底/分层切换、典型书架/历史/底部弹层渲染和窄屏大字号包含；旧业务交互和未变页面结构REUSED。除sheet顶部1px边缘外不改布局，仍要检查该浮层与历史完整行。独立搜索只补共享样式依赖和模态绘制，不重复既有筛选全套；不运行App门禁、HAP、HDC或设备采样。

实现采用sheet顶部1px内高光，不增加box高度。核对模态承载关系时另发现跨页demo的历史背景仅有指针遮罩，仍可Tab进入底层书架。已为该背景增加inert与AX隐藏，为历史面登记dialog身份并增加内部焦点循环/Escape回退；只补本地键盘归属及真实查询传递这一条新交互，其余旧路由/筛选REUSED。该修正限demo，不能推断生产实现已有同一问题。

## 实施与验证结果

- 四种承载关系已经由同一色板中的独立角色提供。分层模式下内嵌为#F8F4EC、无影，固定栏保持#FFFCF8与完整边界、无影；悬浮导航为亮暖白、独立边缘和两层轻影；历史面由清晰外缘/阴影/32%遮罩形成前景，底部弹层使用顶部内高光与上沿轻影。阅读控制专用#FFFAF4及青蓝保留。
- “角色分层/同底对照”两种模式可切换；同底是用于解释层级的对照状态，不是真机原图或历史像素复刻。颜色相同也可由边缘、抬升、遮挡和关闭方式区分，不为四个角色强行配四种色相。
- 实际computed样式、内嵌/导航模式差异、固定栏不抬升、内嵌几何切换前后相同、设置/来源卡消费者、父子iframe模式传播、独立搜索URL依赖，PASS。典型历史面及阅读弹层在366/100%与320/160%档位包含/完整历史行/专用背景/浮层影，PASS。无新增JS或资源错误，手机宽外部控制区无横向溢出。
- 新增历史背景inert、Tab/Shift+Tab归属、Escape回到书架并恢复搜索入口焦点、输入查询传递，PASS。其余既有业务交互与未变布局证据REUSED，不扩大门禁。
- 证据在`.reader-artifacts/surface-hierarchy-demo-20261028/`：`browser-check.json`、`history-focus-check.json`、典型页面与`comparison.html/comparison.png`。对照图是浏览器demo绘制，不是设备截图。未修改旧完整动线参考、App、HAP或设备；生产接入与用户认可仍OPEN。

## 顶栏 A1 · vellum（已否）/ A2 · 静默（当前，2026-10-29）

用户否定了“不透明药丸+加重投影”的顶栏悬浮表达，要求先按主流悬浮栏做法重做。核对 iOS 26 Liquid Glass、Material 3 floating toolbar、HarmonyOS `backgroundBlurStyle` 和常见 glassmorphism 后，共同点是：导航层采样身后内容、内容真实从栏下穿过；投影只做很轻的 ambient，不承担悬浮语义。只加重影仍属于卡片抬升，不是悬浮栏。

A1 用 62%/78% 暖纸、blur 18/24、saturate、亮边内高光与 14vp 栏下渐隐。截图后用户判定“有点太过拟物了，质感很诡异”，因此不再作为候选；问题不在压栏，而在玻璃材质本身。A1 证据保留为`one-366-a1-vellum-*.png`。

A2 保留 A1 的 8vp 压栏与滚动截断，只把材质降为静默纸面：

| 项 | 静止 | 滚动 |
|---|---|---|
| 内容压栏 | 首卡/详情封面压入栏下 8vp，首行文字在栏下 12vp | 内容继续从栏下穿过 |
| 栏体 | 88% `--panel-surface` + blur 10px | 94% + blur 14px |
| 边缘 | 1px 常规边、无内高光、无饱和度、无外描边 | 同上 |
| 投影 | full 三层：`0 1px 0 10%` + `0 3px 8px 8%` + `0 12px 28px 3px 15%` | 同一 full 三层（与底栏/rail/dock 同） |
| 栏下 | 无额外渐隐/雾带；内容在栏底直接截断 | 同上 |

用户随后反馈“顶栏的边缘阴影感觉有点淡”，A2 先把投影从 4–5% 提高；再于 2026-10-29 因顶/底影不统一，统一为同一套三层浮影（见下节）。栏体透明度、模糊和几何不变。

demo 实现只在`reader-warm-surfaces-demo-20261028.html`增加 `veil` 模式、滚动状态和首卡/详情顶距，样式在`reader-surface-hierarchy-20261028.css`；色板文件未加值。docked 与旧 raised 影保留作对照，默认选中 A2。

静态读数（366 / 日间 / 100% / warm / layered / veil）：首屏压栏 8vp、文字安全，computed backdrop blur 10px→14px，内容滚动时压在栏下（page top 39vp），搜索面 53vp，书架首屏无溢出，详情 dock 尾部余量 28vp，无 console 错误；切回 docked 时 start 避让 15vp 仍 PASS。

证据：`one-366-a2-shelf-rest.png`、`one-366-a2-shelf-60.png`、`one-366-a2-detail-rest.png`、`one-366-a2-detail-bottom.png`。静止时首卡上沿/详情封面顶部被栏体截断；滚动时封面与标题在栏底被截断，栏面保持干净。旧 raised 对照仍为`one-366-top-lift-*`与`one-366-top-underlap-*-raised.png`。

状态：A2 是 demo 视觉候选，等待用户判断；表面角色、契约文档、生产几何/材质/token、HAP 与设备均未改。若 A2 仍不足以表达悬浮，下一步只加深压栏（8→16vp）或增加一档轻接触影，不回到玻璃材质；B（静止透明、滚动才获得材质）保留为另一条路线。

## 浮影统一（2026-10-29）

用户问“现在阴影是统一的吗？尤其顶栏与底部 Tab 栏；浮动质感够了，但底部平，边距/阴影呈现不明显；应加颜色、范围还是高度？”

核对结果：不统一。A2 顶栏是三层（1px 接触影 + 2px 近影 + 8px/20px ambient），底栏/rail/dock 仍是色板的旧两层（2px/4px 8% + 8px/20px 12%），没有接触影。底栏距底 25vp、dock 15vp，ambient 在视口底被裁掉一部分；浅纸面上 12% 的大范围影几乎不可见，所以底栏读成平贴。

处理：统一为同一套三层、同一光向，补接触影；主要增加范围（ambient blur 20→28、spread 0→3、offset 8→12），颜色只从 12% 提到 15%。顶栏不再单独取轻影，直接与底栏/rail/dock 共用同一个 full token，避免顶/底两套强度。不先加边距：底栏 25/dock 15 是为了内容避让和 home indicator 关系，改边距会同时改 end inset；当前阴影已能把底栏拉起来。若仍不足，下一档是 +4–5vp 边距，而不是继续加暗。

| 角色 | 阴影 |
|---|---|
| 顶栏/底栏/rail/dock（full） | `0 1px 0 10%` + `0 3px 8px 8%` + `0 12px 28px 3px 15%` |
| legacy 对照 | 色板旧两层 `0 2px 4px 8%` + `0 8px 20px 12%` |

demo 的“浮影”切换默认“统一 · 三层”，可切“旧 · 双层”对照；night 只登记了对应 token，未作为本轮 366 基线证据。

静态读数（366 / 日间 / 100% / warm / layered / veil / unified）：首屏压栏 8vp、文字安全，顶栏材质 blur 10→14，搜索面 53vp，nav 尾部余量 11vp，dock 尾部余量 28vp，浮影层数 顶 3 / 底 3，无文本溢出、无 console 错误；legacy 对照顶 2 / 底 2。证据：`one-366-a2u-shelf-rest.png`、`one-366-a2u-shelf-60.png`、`one-366-a2u-detail-rest.png`、`one-366-a2u-detail-bottom.png`；legacy：`one-366-a2u-legacy-shelf-rest.png`、`one-366-a2u-legacy-detail-rest.png`。

状态：demo 视觉候选，等待用户判断；未改表面角色、契约文档、生产 token/几何、HAP 或设备。生产迁移需要把 `ReaderSurfaceSpecs` 的单层 `floating` 影升级为多层，或由表面 owner 组合三层；该决定留到用户认可后。

## 生产移植 P0（2026-10-29）

用户提供完整生产方案，以 366 / 日间的 A2 统一三层效果为定稿；夜间、600/840、1.6 字号仍未验收。附件原文和本轮源码指纹保存在 `.reader-artifacts/raised-surface-p0-20261029/`。当前生产仍为单层 shadow，无 `ReaderRaisedSurface` 或 veil token；并行 dirty WIP 保留。

本轮先回答唯一问题：本机原生 ArkUI 能否实现 demo 的 tint/blur、三层 Canvas 阴影（含 spread 近似）、不占布局的越界绘制，以及滚动时的正确合成。旧浏览器证据及现有 SDK property/lowering probe 没有原生像素、裁剪或性能证据，不能复用为 P0 通过。

最小验证入口：安装 SDK 的声明与隔离 ETS 编译（只核 API/单位），再用 SDK Previewer 运行隔离 fixture（只核原生绘制）；不触发合同全量、Core 编译、生产 HAP 或手机操作。每次 native 子进程有界执行，若原生运行不可用、与 demo 有明显差异、父裁剪不成立或产生错误则记录并停止 P1。后续三个指定门禁和静态测试仅在相应生产改动发生后选择，目前 `NOT_RUN`。

代码侧已发现 Canvas `shadowBlur` 单位是 px，`shadowOffsetX/Y` 默认 vp；不能照搬 native `.shadow()` 的全部乘 density 逻辑。现有 `arkui-property-runtime-probe` 只执行 SDK property classes，明确无 renderer/layout/pixels，因此不作为 P0 图形验证入口。Previewer 不支持 `--help`：一次有界调用因未传 `-j` app path 返回 11；这属于入口参数诊断，不是材质失败或 P0 通过。

当前状态：P0 `OPEN`；P1–P5 `NOT_RUN`。生产 token、组件、几何、版本及设备尚未因本方案修改。

### P0 首轮原生发现

隔离 Hello、SurfaceP0 和 SurfaceScrollP0 均已由 SDK API23 lowering/es2abc 编译并在本机原生 Previewer 实际运行；取得 366vp、density 1/2 的 framebuffer。Canvas 外移 caster 后投影回画布，避免 spread 3 留下实心黑环；外部阴影可见、宿主尺寸未被扩大，dock 底缘 12 点相对纸底的暗度与 CSS 相差最多 2/255。真实 Scroll 完成 40 次/80vp 滚动（660ms），阈值只在 y=6 时发布 true；面板点击 1 次、阴影区与普通内容各 1 次命中 underlay，未穿透面板。

未通过项：`backgroundEffect({ radius: 0, color: opaque })` 没有产生实色面板，背景文字直接透出；在静态和真实滚动 fixture 的 solid 阶段均复现。原生截图 `surface-attempt-1/frame-002.png` 与 `scroll-density2-attempt-1/frame-016.png` 保留。该差异必须在 P0 修复：结束 veil 时清除 effect 并显式设置不透明 `backgroundColor`，再做准确的切换验证。此时不进入 P1/token 改造。

传输记录：首次 RGBA 接收器曾在原始像素内搜索 JPEG 起始标记，误导出无效 JPEG；保留全部原始 `.bin`，按实际 40 字节 header + RGBA 解码为 PNG，只删除本次无效派生 JPEG。后续接收器固定检查 payload 起始标记，并在启动前记录每个 fixture 输入 SHA。早期 fixture 的页面描述曾被复用生成器覆盖，原脚本/abc 源字节未变且运行日志可证明加载页面；后续各页面改为独立输入目录，不将早期原型回执当不可变交付证据。

验证清单审计：附件所列 `H-reader-layout-architecture#geometry` 实际覆盖阅读正文/控制几何，不覆盖 `ReaderPageGeometry`，本次不应执行。`H-theme-local-consumers#role-registry` 仅覆盖历史 local-role，不能证明新颜色角色；`H-bookshelf-detail-scroll-layout#header-frame` 也不能覆盖标准详情/书架 underlap。旧 shadow 断言实际仅在导航 `sdk-navigation` 与下载 `native-bindings` 两处，尚无第三个详情 dock shadow 断言。三个既有 gate 共享 helper 指纹与封存不符，需要按实际变更审读，不能刷新 SHA 或改跑全量来取得通过。当前均未执行。

### P0 修正通过，进入 P1–P4

独立 `SurfaceSolidP0` 清除 effect 并显式恢复实色后，density 2 原生实色截图的栏内空白采样为恒定 `#FFFCF8`；原失败区域仍能看见的背景文字已完全遮住。同次运行保留真实 40 次/80vp 滚动（660ms）、y=6 单次阈值变化，以及 header 1 / underlay 2 次准确点击回执。输入在启动前逐文件冻结，旧失败不改判；P0 在**本机 CPU Previewer 的原语、单位、布局、材质切换和命中范围**通过，生产集成、设备 FPS 和用户验收仍 OPEN。

独立 ListOffsetP0 原生样本：`contentStartOffset=80` 时首项 y=80、currentYOffset=-80；`scrollBy(0,8)` 后首项 y=72、offset=-72。生产以首项相对静止锚点的位移判断 4vp 阈值，不用 offset>4；恢复中的中间帧不发布材质状态。

后续验证按实际改动选择：主题生成器 `--check`（输出一致性，无业务嵌套）；准确 underlap resolver/首项与 hero 保位验证（不运行正文几何）；导航 `sdk-navigation`、下载 `native-bindings` 保留尺寸/避让断言并迁移绘制宿主；新 Canvas/veil 使用隔离原生渲染及准确 SDK 编译，不拿旧字符串断言替代。共享 helper 指纹审读未完成前不宣布相关 gate 通过。正式签名发布/版本升级及设备操作不因本轮原生 harness 通过而自动发生。

### 生产组件集成发现：自然高度测量循环

P1–P4 首轮源码接入后，使用**原样生产 `ReaderRaisedSurface`** 的 `RaisedOwnerP0` 验证自然高度宿主（只有 width334、内部 Row53，Canvas尺寸由 onArea 回执更新）。原始 P0 显式指定宿主高度，不能覆盖这条新路径。

`owner-attempt-1` 真实原生回执显示：宿主高度 96→192→288→384→480→576→672；有无外部 `position(0,0)` 均复现，fixture 的 6 次反馈上限终止了循环。说明 `.position()` 没有让 Canvas 从自定义组件测量中退出，首轮生产包装尚不可用。原始输入与截图保留，P2 集成记 FAIL，不提升为通过。

修复方向：`ReaderRaisedSurface` 自身使用明确零宽高的绘制宿主，Canvas 在其内部越界绘制且禁止命中；消费者继续自然高度和现有回执，不用写死高度或增加 padding 掩盖循环。需同一自然高度/外部定位两分支原生复验后才进入打包。几何 resolver 的准确 `geometry-underlap` 已独立 PASS；它不证明此绘制包装正确。

修正回执 `owner-fixed-attempt-1`：两种宿主均稳定为 334×53，onArea 各仅一次，3 秒后仍无尺寸增长；两层圆角底缘与三层外影对齐。原样生产子组件源码 SHA `03703ae92a9f69af2e316fa4d48588a10948e23c1eff0792775c0e8cd6964cbe`。零尺寸绘制宿主同时保留内部 Canvas 的 -48 偏移，外部 position modifier 不再覆盖它。P2 的此项自然测量集成复验 PASS，旧失败保留。

### 本轮准确检查选择

1. `test-raised-surface-layout.mjs --case geometry-underlap`：只执行真实 `ReaderPageGeometry`，保护安全线/underlap 分离、默认与无效输入、inline 和 footer 既有避让；已 PASS（0.07s）。
2. `test-main-navigation-audit.mjs --case sdk-navigation`：本轮开发探针，嵌套实际 SDK lowering、property runtime 和导航/spec 模块；保留原尺寸、字体、44vp/focus/动作断言，改核测量回执传给零布局绘制子组件、margin/translate 的唯一 owner 和无重复 shadow。子组件在此只记录真实 SDK 传入参数，原生绘制另由上面的原样生产组件回执证明。
3. `test-shared-download-visual-contract.mjs --case native-bindings`：本轮开发探针，保留该 case 原 header/row/cover/semantic/Button 及既有控件准备；只迁移两个 dock 的绘制宿主断言，核同一高度仍进入原内容避让测量。不会调用网络、HDC、HAP 或原生 renderer。

第 2/3 项以资源租约串行执行。这里审读并执行的是本轮明确修改的开发探针；封存 gate catalog 的共享 helper 定义审读未完成，索引 gate 仍不宣称通过，也不刷新 SHA、改跑父项或全量。

第 2/3 项执行结果均 PASS，日志分别为 `navigation-sdk.log`、`download-sdk.log`。主题生成与 `--check` PASS（495 App roles×2、8 Reader palettes）；几何 probe PASS。均不代替生产工程类型检查或设备像素。

下一项必要验证是 `hap-pipeline.mjs build --class iteration --contracts-scope none --signing local`：嵌套只含本次打包直接需要的源码快照/Native-SDK 配对、指定证书/Profile 准入、隔离依赖解析、完整 ArkTS 编译、签名和 HAP 内容校验；不调用合同全量、业务网络、HDC、安装或启动。新增 Canvas/公共参数与三个页面 owner 之间存在真实 ArkTS 类型/生命周期接口风险，准确 SDK probe 不能取代完整工程编译。开发版本保持 0.2.0/code1000000，不是 0.3.0 正式发布。

首次 iteration 构建 PASS：`20261029T003651Z-3b297fdc-be96bebe`，完整 ArkTS 编译、指定证书/Profile、Native-SDK 配对和 signed HAP 内容校验均通过。此后发现下述零 offset 恢复边界并修正，首次包保持原判定，但不作为最终源码包。

### 书架零 offset 恢复边界

原 `BookshelfViewState` 默认 `anchorKey='' / anchorOffset=0 / anchorItemY=0`，与已经滚到原生 offset=0 的有效位置无法区分。旧恢复会把后者归顶；新 underlap 没扩大触发集合，但材质预判会继承这条歧义，不能算作返回无跳动通过。

修正为 route-owned 内存 `anchorCaptured`：原生 offset/itemY 完整且 finite 后才原子保存；有效 offset=0 走精确恢复；明确回顶/过滤清锚点时清标记；不新增持久化。准确回归只选旧 viewport-return 的真实生产 save/restore 路径，并增加新旧两种零值反例；原正常有符号位置、晚到回调和不改排序/过滤等断言保留。该修正影响生产源码，因此需要一次最终 iteration 重新编译；其他未变 Canvas/角色/几何/导航/下载证据 REUSED。

准确执行入口为 `test-bookshelf-viewport-return.mjs --case route-anchor-capture`。此开发 case 只动态加载 `productionMotionMethods` 和 `pureModuleProbe`，从实际生产 Page/Spec 提取 save/restore/lifecycle 与阈值，用受控 Scroller/postFrame 事实端口核零值、完整采样和晚到帧；无 native/HDC/Hvigor，也不运行兄弟 case。旧 header/Scroller/item 框架断言保留为 `header-scroller-identity`，本次 NOT_RUN。无参和 --list 仅列 NOT_RUN。封存 gate 指纹仍待审读，不把本轮开发 probe 说成索引 gate 通过。

`route-anchor-capture` 实际执行 PASS（0.63s），日志 `viewport-anchor-attempt-1.log`。最终 iteration 仅补编入此生产修正；未变的 geometry、navigation、download、原生绘制和矩阵证据复用，不重复相同场景。

### 夜间与宽屏原语矩阵

第一版 Matrix 的 `Text('•••')` 占位图标在44vp里换成2/3行，造成 header58/137vp，600/1.6 下与卡片重叠；这是隔离 fixture 错误，生产更多图标是固定图形，不能从此判 App 故障或将矩阵记 PASS。旧输入/截图保留。修正 fixture 使用固定44×44槽内三圆点，并让 header 消费真实 veil helper/描边、dock 保留原 floatingSurface；只重跑366/night与600/day/1.6这两档的新绘制原语，不重跑其他场景。这仍不代替完整生产页面、600 rail、下载页或真机验收。

修正两档原生结果：366/night 为 header334×52、dock260×64；600/day/1.6 为 header568×53、dock260×65，均各一次自然尺寸回执并稳定3秒。原样生产 Canvas、实际生成 registry/veil helper 在这两档下无裁影/硬边或尺寸反馈循环，截图已目视检查。范围为新绘制原语 PASS；完整标准详情/书架/rail/下载页的 P5 场景及用户对夜间的认可仍 OPEN。

## 本轮最终状态（2026-10-29）

- P0 本地原生原语、P1–P4 源码接入及完整生产工程编译 PASS；发现的实色恢复、自然高度循环与零 offset 归顶均已修正并保留失败证据。
- 最终开发构建：`20261029T004318Z-3b297fdc-1d180fbc`，清单 `.reader-artifacts/hap/20261029T004318Z-3b297fdc-1d180fbc/manifest.json`；signed HAP SHA-256 `fb7f492a52290530068bd65e535ec3a00684cf66fc2f3b6468097d3afe932964`。指定 `minliny_HarmonyOS` 证书及当前 Debug Profile 验证通过；完整 ArkTS 编译/Native-SDK 配对/包内容验证通过。
- Harmony `3b297fdc7e724cf655eca3bac2a8efeda2001c56`、Core `80d614e929ae9e320ab767a1dc04579363c361d7`，均保留 dirty WIP，实际构建输入由不可变清单绑定。产品版本仍 0.2.0/code1000000。
- 4 个准确开发 probe（geometry、navigation、download、route-anchor）通过；最后一项生产修正后，仅重建必要 HAP，其余未变场景 REUSED。封存 gate 定义审读未完成的条目及全量均 NOT_RUN。
- P5 仅新绘制原语的夜间/600/1.6 检查通过；完整生产页面、600 rail、下载页、搜索/详情返回的视觉动线、设备性能与用户验收仍 OPEN。未使用 HDC、未安装/启动新包、未触及设备数据，未作正式发布或版本升级。
- 完整本地回执与源码哈希在 `.reader-artifacts/raised-surface-p0-20261029/delivery-state.json`；最终构建日志 `hap-build-attempt-2.log`，首次构建与全部失败输入继续保留。

### 用户授权真机安装（2026-10-29）

用户在本轮明确要求安装到真机，消费上述最终不可变 signed HAP，不重编译。准确动作仅为 pipeline `inspect` → `install`（默认覆盖、保数据并启动）；嵌套包字节/指定签名身份、精确 Connected target、boot/SceneBoard 就绪、已安装身份匹配及安装后身份核验，均为本次更新直接必要条件；不跑 UI 场景/全量测试。

本机 server 的既有真机最初 Offline；一次有界租约 tconn 返回 Connect OK，随后列表核对准确 target 为 Connected。复用现有本机 listener PID38557，未重启服务；本机 route 为 en0，HDC 进程 socket 直接从本机 LAN 地址连接手机无线调试端口且 ESTABLISHED。所有客户端/pipeline 调用清除大小写 HTTP/HTTPS/ALL/SOCKS 代理变量并设 NO_PROXY/no_proxy=*；不经远程 VM server。原始端点只用于必要本地命令，文档/回执使用 pipeline targetRef。read-only `launchctl procinfo` 因需要 root 不可用，未用空结果推断责任 PID；当前服务真实直连和握手成功，无须恢复服务。

本轮结果：pipeline inspect PASS（boot completed、SceneBoard稳定、当前已安装身份与指定 signed Profile 匹配）；覆盖安装 PASS、安装后身份核验 PASS、启动 PASS，dataPreserved=true。消费的 signed HAP 仍为上述最终 SHA-256，未重编译/卸载/清数据。部署回执 `.reader-artifacts/hap/20261029T004318Z-3b297fdc-1d180fbc/deploy-physical-2a10c2b26b06-20261029T041632Z.json`；本地路径/安装摘要 `physical-route-install-20261029.json` 和 `delivery-state.json` 已更新。设备交互、生产整页视觉动线与用户验收仍 OPEN，不从安装启动成功提升为已验收。

### 真机安装后无法交互（用户反馈，2026-10-29）

用户在上述 signed HAP 安装启动后反馈“没办法进行任何交互”。该场景记 FAIL/待定位；安装和启动回执仍为 PASS，不替代触摸验收。先核当前源码与安装输入的相关文件哈希，再审书架/搜索全屏 overlay、面板实际布局尺寸与 hitTest、Canvas 回调和帧状态，使用本机原生隔离命中探针验证；代码侧未明确剩余问题前不操作真机。

待答问题：本轮 header 从单 Column 改为 Stack+Column 后，内层面板是否撑满可用高度，新增 Default 命中是否遮挡书架/底栏；或 Canvas/滚动发布链是否造成主线程循环。现有 Row53 自然宿主原生证据没有覆盖生产 header 的 Column 布局和整页命中范围，不能复用为本场景通过。

代码侧核对：当前 RaisedSurface/SurfaceSpecs/BookshelfPage/MainTabBar/LibrarySearchSurface/Index 六个文件哈希均与已安装包输入一致。idle results host 为0高/None，scrim 为None，开书动效隐藏时None，Canvas和零宿主均None；draw没有State写入，新增书架帧采样无自递归，尺寸回执和布尔发布有去重。尚不能从代码判明面板实际大小或主线程是否阻塞。安排一次最小只读取证：当前窗口/Reader进程状态、UI树/截图；不触摸、不重新搜索、不重启或清数据。本地同时用完整 header 约束链做原生命中复现；取证只回答实际遮挡范围和卡死/非卡死的区分。

一次设备只读结果：Reader进程存在，ps采样CPU=0；UI树属于其他前台应用，不能用于判断Reader命中层，已停止设备采样，无触摸/启动/切换应用。截图因该目标 `snapshot_display` 要求 `.jpeg` 而请求 `.png` 失败，后续recv无文件；两步虽exit0，实际均记FAIL并保留输出，不重试外部前台截图。此轮不具备Reader截图/命中证据，继续本地原生复现。

用户已停回Reader后，一次真实截图/树采样成功（`interaction-20261029/reader-current/`）。Reader PID存活且CPU0，日志没有本次异常/ANR，顶栏188物理px（约53.7vp）、书架和Tab正常布局，按钮enabled/clickable均true。用户手动点搜索和设置后，页面仍在书架；现有应用日志继续处理查询/系统窗口事件，不能把无响应归因为已证明主线程卡死。

本地分层复现锁定命中宿主：仅 header() 的完整Stack/Column/FixedHeaderHost为53vp，不撑全屏；加入实际完整LibrarySearchSurface.build()及父`.enabled(true)`后，SDK生成的**全屏`__Common__`仍是Default**，内部root Transparent不足以放行底层。旧完整复现只有header-button回执，下面两次点击未到underlay。只在父custom调用追加`hitTestBehavior(Transparent)`的单一差分，header-button保留且两次underlay均收到；不改业务guard、不移除历史/结果组件。生产Index只修该宿主的命中属性。

准确回归选择：`test-library-search-surface-binding.mjs --case common-hit-test,retained-inputs`，资源租约下执行实际SDK lowering，核生成Common的bookshelf/search/禁用route及replay输入；旧缺失Transparent的负对照必须被拒绝，保留原runtime/host/navigation/identity失效回调隔离。原生另测真实44vp左搜索槽、内容和底部Tab的准确派发，不把此前加onClick的header原型当作真实空白命中证据。

结果：两SDK case PASS，旧缺失modifier负对照被拒绝。准确原生 `interaction-full-actions-attempt-1` 在(26,75)/(180,420)/(260,740)分别得到 left-search-button / underlay1 / tab-button，53vp栏高不变，原生编译/派发证据通过。该问题的共享外宿主已在源码定位修复；用户所述真机搜索回调和设置导航仍需新包后准确复验，不能把本地点击日志升为设备通过。

后续只做本次修复的 iteration 打包（contracts none；完整ArkTS、指定签名/Profile、Native-SDK配对和包内容校验为必要嵌套），然后精确本机真机保数据 inspect/install/launch。旧浮影/颜色/几何场景未变均REUSED，不补全量，不更改产品版本。

修复产物：`20261029T043947Z-3b297fdc-a387659a`，signed HAP SHA-256 `7b7e07d391f09f0fcfdcc74250c9121ab6863678e520a0c1f52a6cbd9c9fcfba`；完整编译/指定签名/Profile/包校验 PASS。本机直连真机 inspect、保数据覆盖安装、安装后身份及启动均PASS，部署回执 `deploy-physical-2a10c2b26b06-20261029T044039Z.json`（位于该run目录）。已请用户手动完成“展开搜索→返回→打开设置”的两项准确交互，等待实际回执；不代点，不将安装PASS提升为交互已修复。

新包真机界面树回读：`reader-library-search-surface` 与其全屏父 `__Common__` 均为 `HitTestMode.Transparent`，enabled=true；已确认实际运行宿主改为透明（`fixed-layout.json`、`fixed-hit-summary.json`），并非仅源码或隔离原型修改。

用户对新包准确交互复验回复“**两项都恢复正常**”：顶部搜索可展开，返回后底部设置可打开。此次无法交互问题按这两项真实场景关闭，`physicalInteraction=PASS_USER_CONFIRMED`、`userAcceptance=PASS_FOR_SEARCH_AND_SETTINGS`；不扩展为全部页面、P5视觉或性能验收。完整过程/负对照/部署和确认回执在 `interaction-20261029/interaction-fix-state.json`。

### 书架顶栏双轮廓与底缘重叠（2026-10-29，OPEN）

用户在交互恢复后反馈顶栏像有两道外轮廓，底部明显重叠。当前安装输入为 `20261029T043947Z-3b297fdc-a387659a`；此前两项触摸确认保持原判定。本次先审生产 header/FrameModifier/Canvas 三层绘制，复用既有真实截图和布局树（相关视觉源码与本包相同），不重新操作手机。

已排除重复的原生 border/shadow：header 只有面板 Column 一处 1vp 描边，外 Stack 的 idle elevation 为透明零阴影，FixedHeaderHost 只负责透明框架/测量。实际树中 bar 为182px（52vp），原生上下边框各取整3px，面板外框高188px；Canvas 却由 `barHeight + 2*borderWidth` 得到54vp/189px，底缘比真实面板低1px。旧真实截图中央底缘的亮描边后出现1px纸底，再出现黑硬带，与这条错位一致。接触阴影本身为 radius0/offsetY1，夜间黑30%，又与 near/ambient 叠加；它构成第二道硬轮廓，不能只靠修正1px尺寸消除。

修正范围：阴影使用实际面板 Column 的宽高回执，首帧未测量不推算；保留零布局/不可命中 Canvas 与已修复的外层 Common Transparent。接触阴影先做隔离原生差分，再选择消除硬边的最小参数修正，不盲调整组颜色。

本次准确验证清单：
1. 独立 outline fixture：仅 SDK lowering/es2abc 和本机 Previewer，原样 Canvas、真实 veil/边框、density3.5，面板1168×188物理px；比较当前接触层、1vp/2vp模糊与无接触层负对照，保留夜间及日间底缘像素剖面。编译经统一构建资源租约，renderer 串行/有界，不涉及HDC、HAP或业务网络。旧 density1/2 证据未覆盖本次像素取整和硬边问题，故需此差分。
2. `test-library-search-surface-binding.mjs --case measured-shadow`（待新增/审读）：只核实际SDK降级后的面板测量绑定、实测分数vp参数到Canvas的传递及退回公式的负对照，不执行兄弟case。该项保护测量owner与阴影唯一几何输入；首帧零尺寸和无效回执必须保持无错误阴影。

当前生产修正及上述新验证尚未完成，设备视觉验收仍OPEN；不据旧P0或安装成功宣称本问题已修复。

本地原生差分结果：日间/夜间均取得 density3.5、1280×2730 framebuffer，四面板严格同为1168×188px。接触层 radius0 的外缘保留独立硬条，radius1vp 消除硬阶并保留贴近面板的影，radius2vp 扩散超过本次所需；无接触层为负对照。日间外缘相邻亮度最大跳变由9.502降至3.0，夜间由3.0降至1.0。已选最小修正：公共接触层半径0→1vp，offset、alpha、near/ambient、面板描边及色板均不变。比较图/原始帧/输入哈希/像素剖面存于 `outline-20261029/`；这是本机原生差分证据，尚非新包真机视觉验收。

几何修正已落生产：Column 实测宽高驱动影，只有历史呈现高度严格为0才接受/绘制；同输入key复用已确认的收起框，避免 results→idle 无尺寸事件时永久无影。宽度/水平inset/barHeight/density 变更失效，键盘与继续阅读卡片变化不无谓清除缓存。独立只读复核确认零宿主不引入测量循环，Index 外层 Common Transparent 仍在。新增准确SDK case已含188/3.5传递、展开不污染、.005残余高度不画、返回复用、输入变化及生命周期拒绝，并保留移除绑定/回退公式两个负对照。

`measured-shadow-attempt-1.log`：首次请求在统一资源租约入口被活动 Android 构建owner拒绝，检查未进入，不能计PASS；未删除/更改租约或打断owner，等待其自然结束后补跑同一项。

后续唯一必要构建仍为 `hap-pipeline.mjs build --class iteration --contracts-scope none --signing local`：本次新增测量State/Builder绑定和公共阴影参数必须经完整ArkTS编译；嵌套仅源码/Native-SDK配对、依赖解析、指定证书/Profile、隔离编译、签名与包校验，无合同全量/HDC。随后 pipeline inspect/install/launch 仅验证准确本机真机、签名与保数据更新；颜色/underlap/导航/下载/外层触摸等未改场景REUSED，不重复业务测试。设备视觉仍需用户实际确认，安装成功不会替代此确认。

准确SDK检查：attempt2已进入SDK，但新增隔离fixture的build直接调用Builder，缺少SDK要求的根容器，记fixture FAIL（不归因生产）。仅补fixture的Stack根容器后，attempt3的 `measured-shadow` PASS（0.82s），两个负对照均被拒绝；原失败日志保留。未运行兄弟case/全量。

修复包构建/完整ArkTS/签名/包校验 PASS：run `20261029T061756Z-3b297fdc-f4e9b48a`，signed SHA-256 `ee22dd12e186cb3e61a847efe6e068eac67150631a28d5ffa5dbf2cb32551494`，指定minliny_HarmonyOS证书及Debug Profile验证通过。Harmony/Core commit与前包相同且dirty WIP均保留；关键四文件与新包source-snapshot再次精确匹配。版本仍0.2.0/code1000000。

安装尚未开始：本机server的准确target初始Offline。一次租约tconn在30秒超时，HDC socket SYN_SENT；同目标普通TCP检查亦在3秒超时。保留旧listener/日志/进程与上下文，已核无活动租约及server活跃session后，在同一有界链进行一次受控kill→旧listener退出→前台-m恢复，唯一新listener PID74437。新服务下唯一比较tconn仍30秒超时。nettop明确client↔server为lo0、server↔target为en0/SynSent；调用链清除全部代理环境，系统PAC的LAN例外存在，无代理中转socket。不能将此结果归因手机授权、签名或包错误，也不能声称旧启动上下文故障已在本次复现。`launchctl procinfo`因root权限不足无法读取责任PID；未从同名active coalition推断责任关系。

已停止连接重试/维护并释放客户端租约，新正常监听服务保留。等待用户提供无线调试页当前连接地址后，继续消费本次不可变signed包；未卸载/清数据/触摸手机。状态及完整本地证据索引：`outline-20261029/outline-fix-state.json`。当前结论：代码修复/本地原生差分/准确SDK/签名包PASS，安装与新包真机视觉验收OPEN。

用户随后明确要求“先不安装，commit并push”。本次安装状态改为 `DEFERRED_BY_USER`，不再等待地址或执行设备动作；保留上述连接诊断历史和已签名包，进入本轮UI变更与必要依赖的选择性提交。Core及其他并行WIP保留，设备视觉验收仍OPEN。
