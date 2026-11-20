# 书籍封面与正文转场交接（2026-10-24）

用户现象：打开书籍的后半段有明显卡顿；打开时封面突然切成正文，退出时先闪全屏封面再移动；希望阅读侧以封面翻开/合拢交接。基线为 `main` HEAD `6b1bd753` 的 dirty 工作树，保留同分支并行修改。上一轮安装包记录为 `20261023T180007Z-6b1bd753-576a397b`；本次用户报告为真机现象，尚无可归属帧时序/录屏，本次不重复取真机证据。

## 源码定位

- `BookshelfNavigationTransition.sample/setRect` 原来每个 `postFrameCallback` 都写 `actorWidth/actorHeight/actorX/actorY`，图片和标题布局取这些尺寸。它不是只提交图层变换，而是让整个封面内容逐帧重新布局；回调还要与阅读页首屏初始化共用 JS 线程。这是已确认的主线程和布局开销来源，不能据此给出未测量的丢帧数字。
- open 只是 360ms 封面矩形放大，最后 140ms 减 opacity；没有旋转、翻开或真实正文交接。`Index.openShelfBookWithMotion` 在同一调用中先同步挂载阅读页再创建 actor，`presentPreparedReading` 还会在首屏就绪时立即处理可选目录投影。这些任务可能与后半段 JS 帧循环重叠；实际哪一帧的耗时尚未测量。
- `Index.returnToReadingOrigin` 原来在创建 close actor 前设置 `readingSessionActive=false`、切到书架，正文被卸载；actor 紧接着用全屏封面等待新书架坐标。因此“先看到封面再缩回”是代码明确规定的顺序，不是手机加载偶发。

## 最小修复

- 固定封面 canvas 的尺寸，按原封面比例等比放大到覆盖阅读视口，溢出由窗口裁切；所有运动只改统一 scale、translate、rotate，避免强拉伸封面，也不逐帧改图片布局。
- open 两阶段在同一次原生 `keyframeAnimateTo` 中提交：220ms 从书卡飞至阅读视口，140ms 沿视口左边界翻开到 -90°，露出其后的实际阅读页。两阶段之间不依赖 JS 定时/帧回调，原生 actor 仍按 request id 隔离。
- close 先从 -90° 合到 0°，此时正文仍保持已批准退出后的静止子树。只有封面已完全遮住正文才发一次 `onCovered(id)`，由 Index 执行原有退出清理与路由切换。新书架可见封面测量返回后缩回；找不到目标则短淡出，绝不把旧书卡坐标当作新目标。非书架原 route 可沿用合拢后淡出的交接。
- actor 不拥有业务 readiness、保存、加载、导航。减少动效时先交付已批准的 covered，再 finished；旧原生 completion、旧 cover error 和旧初始帧不能影响新 request。
- Index 的可选目录投影建议延后至 open finished，并以原 runtime/book/navigation 身份约束；不延后正文业务首屏，不为动画再发请求，不用 model-ready 冒充实际像素已绘制。Index 由主任务集成，本子任务不修改共享文件。

## 本次验证计划与必要性

已查 `GATE_INDEX.md`，`gate-index --need '书架 阅读 动效'` 未找到合格匹配；查询只读，结果 `NOT_RUN`，不改跑其他集合。

唯一新增入口 `node tools/test-book-cover-handoff.mjs --case cover-geometry,native-opening,close-handoff,lifecycle`。该入口只导入真实几何函数，并通过已安装 SDK AST 提取本次 actor 的实际方法；原生 frame/animation owner 是明确受控的 API seam，不导入其他业务测试、HDC、存储、网络、Core 构建或 HAP 构建。四项分别防止错误封面比例/旋转轴、重新引入逐帧布局或阶段间 JS 等待、正文过早卸载与旧坐标、取消/旧完成回调影响新页面。这是本次改写 actor 状态机必须验证的范围。

另执行 `git diff --check -- <本次文件>`，只检查补丁空白，无嵌套检查。新增文件由 SDK AST parse 与上述实际方法回归覆盖语法；ArkTS 完整构建、原生合成观感/帧率、设备行为与用户验收另记，不以方法探针计为通过。

Index 集成后，追加同一入口的 `index-handoff,index-cancellation,index-projection` 三个精确 case。它们只用 SDK AST 提取实际 Index 的转场/返回/取消/目录投影方法，以明确 stub 隔离既有 runtime、UI 测量和目录业务入口，验证旋转完成前保留正文、fresh rectangle、重复 Back/过期回调、视觉取消与导航退休、不丢失首屏可选投影。不会调用真实业务请求或存储，不展开其他检查；新增必要性是这三个状态边界已由本轮共享 Index 修改。

## 结果

- `cover-geometry`、`native-opening`、`close-handoff`、`lifecycle` 四项均 PASS，退出码 0。首两次执行因测试把浮点乘法/边界当作精确整数比较而失败（`98.00000000000001` 与 `98`、约 `1e-14` 的边界差）；只修正测试为 `1e-10` 容差，生产几何算法未为测试改写，随后四项通过。
- Index 集成审查补出了并修复三个明确边界：返回非书架时原 visibility 条件会过早清封面；多次 ready 会以空目录闭包覆盖首次投影；取消 open 视觉但继续阅读会丢掉待投影目录。主任务已在共享 Index 修复，新增三个真实方法 case 随后 PASS。最终七项一起执行退出码 0。
- 合拢完成回调补充单次交付保护；没有测到 departure cover、导致固定 canvas 与新测 return cover 比例不一致时改短淡出，禁止等比缩到错误高度。上述负对照包含于最终七项。
- 这四项只证明实际方法向原生动画接口提交的几何、阶段和 owner/token 语义，不证明原生 API 已绘制中间像素或真实设备没有掉帧。
- Index 交接与可选目录投影由主任务集成，其限定方法逻辑已按上面三项确认。HAP/设备/用户验收均未由本子任务执行。

## 追加：已批准退出后的迟到 ready

保留正文约 140ms 等待封面合拢期间，`readingSessionActive` 仍为 true。已排队、身份和 generation 仍匹配的 `readingReadyCallback` 因而可能重新设置下载阅读保护、发布 ready 和调度目录回填；不能仅依赖 LRE 通常会检查 `exitRequested`。

主任务在 `readingReadyCallback` 和 `presentPreparedReading` 加入 pending cover exit 拒绝条件。本次只扩充 `index-handoff` 的实际 Index 方法闭包，验证退出前捕获的 ready 在 pending 时不会重设保护、消耗待目录投影或调度回填；直接 present 同样失效。另用未定义 pending 字段的正常夹具确认旧入口仍可按既有逻辑 ready。

必要执行仅 `node tools/test-book-cover-handoff.mjs --case index-handoff,index-projection`，只提取上述实际 Index 方法并复用已有受控 API seam，无新嵌套测试/HDC/构建；前项覆盖新增退出 fence，后项确认其未影响原来正常 open 的目录投影。两项均 PASS，退出码 0；未定义 pending 字段的正常 ready 夹具也通过。

## 用户纠正：移动、放大与翻开必须同时进行

用户明确指出：封面应沿可见轨迹移动并放大，同时翻开，完全展开时已经露出实际正文；不接受先移动放大完毕、再原地翻开的两段效果。上文 220ms 飞行 + 140ms 原地旋转是本任务对方向的错误实现，不能继续当作已认可设计。

当前实际偏差在 `BookshelfNavigationTransition.startOpening`：第一个原生 keyframe 只设置展开位置与比例，第二个才设置旋转角度。方案为一个 360ms 原生 `UIContext.animateTo`，同一 event 同时提交实测封面到阅读视口的 X/Y 轨迹、统一 scale、圆角和左侧铰链旋转角度；所有轨道共用同一曲线和起止时间。终点 scale=1、coverAngle=-90，actor 结束即移除；下层保持真正的阅读页，不以正文截图替换。

继续复用已安装 SDK 的 `@ohos.arkui.UIContext.d.ts` 中 `animateTo(AnimateParam,event)` 与现有 rotate/scale/translate。固定 canvas 与封面比例、close 的 onCovered/新目标、减少动效和 token 失效均保留；Index 由主任务单独集成，不在本子任务修改。

本次必要检查仅 `node tools/test-book-cover-handoff.mjs --case native-opening,lifecycle`。前项提取实际 actor 方法，断言只提交一次原生动画、同一 event 改变移动/等比缩放/旋转端点、恒定 canvas 与终点清除；后项验证更换原生动画入口后旧 completion/取消仍不能作用新 request。API seam 记录实际 event 前后状态，不模拟手机中间帧；不附带其他 case、业务门禁、Native/HAP 或 HDC。几何函数未变，不重复其独立 case。

本轮实现已把 open 的两段 keyframe 改成一次 `animateTo`，两个精确 case 均 PASS，退出码 0。`native-opening` 现在明确拒绝旧串行 keyframe 入口，并检查同一实际 event 前后 X/Y、统一 scale、旋转角度和圆角全部变化；固定 canvas 不变，原 360ms 总长/曲线保留，finish 单次清理。关闭的 covered/fresh-target 逻辑未修改；减少动效、旧 callback 和卸载仍由实际生命周期 case 验证。本子任务未改 Index、Native、HAP 或设备；下层实际阅读页挂载与打开起始遮挡由主任务独立审查，仍不能以方法端点检查冒充原生中间像素和帧率验收。

## 补齐打开起始的真实正文图层

追加代码审查确认：仅同步 cover 变换仍不完整。Index 在点书时已经挂载全屏 ReaderShell，封面运动范围外会提前露出正文，原书架路由同时卸载。因此本轮把实际 ReaderShell 的 compositor 变换纳入同一个原生事务，而不是把这个缺口留作待验收。

- ReaderShell 保持 indexContent 内原来同一 if、同一父节点、同一个实例，布局始终全窗口。同步创建 open request 时先初始化它的统一 scale 与 translate，使首帧正文处于书卡 cover canvas 内；actor 的同一原生 event 通过带 id 的 onPagePose 同时提交正文终点 1/0/0。没有正文截图、复制实例或逐帧 JS。
- 纯几何将页面放入固定 cover canvas：pageScale=coverScale，pageX=coverX-expandedX*coverScale，Y 同理。页面比例与 cover 比例不同也等比，终点是原正常阅读布局。
- 打开期间保留原书架分支为背景，reading 状态补偿原 app safe-top padding；整个背景禁用输入与可访问性。Shell 的 generation watch 只更新临时返回桥，Index 的真实 route 守卫拒绝背景注册；BookshelfPage 的可见书通知也被现有 route 守卫拒绝，不额外加载。另给原来三个直接分发的书架设置/批量/手动更新回调补充相同 route/owner/navigation 守卫，拒绝早先排队的点击。
- clear、finished、减少动效、窗口/导航取消恢复正文 normal pose。恢复通过 SDK 规定的 duration 0 原生事务提交新的 pose 对象，终止进行中的变换；旧 request id 或非 open 回调不能再写正文 pose。关闭逻辑仍保持 full-window 正文到 covered 后按原退出语义卸载。

本次只执行同一入口 `cover-geometry,native-opening,lifecycle,index-handoff,index-cancellation,index-projection,index-opening-surface` 七个精确 case：新增 helper 的几何包含关系、同一事务 cover/page 端点、共享结束/取消、已批准退出保护、原目录投影收口，以及实际 SDK lowering 的背景/ReaderShell 稳定 Builder 路径和 queued 背景点击准入。SDK/状态/native API 为明确边界，不调用真实业务/网络/存储，不展开其他门禁或 Native/HAP/HDC。所有结果只覆盖注明的源码/SDK方法层，中间原生像素和设备帧率仍不能由此推断。

背景追加审查：outer Stack 同时 hitTest None 与 accessibility 隐藏；header/notice 测量须经同一真实宿主准入。BookshelfPage 的离场与书籍 Sheet 退出原来会无条件恢复 App chrome，背景延后卸载可能覆盖 reader；增加 parent 提供的当前 route/runtime/navigation 回调，仅在当前书架宿主恢复，并保留原清理。该两处变更只追加 `shelf-chrome-lease` 一项真实方法 case；不因页面涉及窗口而跑其他窗口套件。Shell 三个业务事件携带当前 @Prop navigation，菜单 handler 同时捕获呈现世代，旧事件失效，新一代书架仍可响应；不改读 parent 当前 navigation 以绕过失效。实体左书脊随书卡移动，所以本轮 hingeX 固定 canvas 0，替换旧“视口左边界”断言，正文 pose 仍终点 0/1。

同一审查进一步发现下载入口也需要携带子组件当前世代，已经一并接入同一严格 guard；header/notice 与 chrome-host callback 同样携带当前子组件 @Prop 世代，避免普通 callback setInitially 后捕获旧 navigation 导致快速返回书架的新 UI 失活。

本轮最终准确执行 `cover-geometry,native-opening,lifecycle,index-handoff,index-cancellation,index-projection,index-opening-surface,shelf-chrome-lease`，八项 PASS，退出码 0。SDK 组合夹具提取实际 Index 的书架 if-then、独立 ReaderShell if 及 bookshelfShellContent 原码，仅移除无关路由/overlay，平台子组件为明确的构造 Slot。开书时原 ShelfSlot 保留，原本空的 Reader 分支仅准入一次；修改 page pose 后同一 Reader 槽 id 不变。regular handler 在保留 Slot 中故意不更新，只更新真实 @Prop navigation，新一代实际 Shell 菜单方法仍可分发，旧世代 menu/callback 拒绝；背景点击与测量均拒绝，返回书架新测量允许。没有编写通用 reconciler 或重实现生产 diff。

夹具初次执行依次遇到未登记 BookshelfShell 的实际 BuilderParam、缺 deviceInfo 窄端口，以及公共 SDK probe 明确不支持非空条件分支删除；均属于夹具边界失败，未据此改变生产逻辑。修正登记和端口后，快速返回检查只 replay 保留 Shell 的实际 child observer，并用真实状态方法核验分支条件/取消；不声称 probe 已模拟整棵原生树删除。最终八项联合通过。源码、SDK 方法、HAP、设备像素与用户验收仍分别记账。

最终边界补充：Sheet 的 `onWillAppear` 在子组件 Prop 尚未传播时也可能迟到，`claimBookActionChrome` 先使用该 Sheet 捕获的 `actionSheetNavigation` 校验当前 chrome host，旧书架不得重新覆盖 reader。header 测量的呈现 key 经 ReaderPageScaffold → MainTabShell → BookshelfShell 原样透传，不能在回调执行时重标为当前 navigation；MainTabShell 新参数默认 0，其他页面无需改接入。notice 的 onAreaChange 闭包同时捕获呈现 navigation 与 recovery generation，拒绝旧页面或旧提示的迟到尺寸。

以上只扩充同一个 `index-opening-surface` 的实际 SDK forwarding 槽和真实 notice 方法、以及 `shelf-chrome-lease` 的真实 claim 方法；没有新增套件或通用 reconciler。最终必要重跑仍为同一八个精确 case（`cover-geometry,native-opening,lifecycle,index-handoff,index-cancellation,index-projection,index-opening-surface,shelf-chrome-lease`）：前两项保护本轮 canvas/同事务轨道，生命周期与三项 Index 保护变换恢复/退出/投影，后两项保护新增保留背景引入的回调与 chrome 边界。唯一入口无额外嵌套业务套件、构建或设备动作；另执行本轮文件的 `git diff --check`。

最终 forwarding 夹具初次遇到两个明确边界失败：未提供只读 safe-left/right 端口、未登记实际 MainTabBar 子组件元数据；补齐窄端口和真实组件登记后，两个变更 case 先通过。随后上述八项再次联合 PASS，退出码 0。header 的旧 key=20 不得改写新页面高度，当前 key 经两层实际 SDK Builder 转发为原 key；notice 的旧 navigation/旧 recovery/已隐藏三个回调均无效，当前回调有效；旧 Sheet onWillAppear 不得申请 overlay chrome，正常书架仍可申请。没有修改生产逻辑以迎合上述夹具失败，也没有模拟无关底栏行为。

## Iteration package evidence

Run `20261023T194424Z-6b1bd753-50961b08`: build, Native pairing, prescribed signature/Profile and HAP byte verification PASS. Contracts none, no implicit business suite. Signed SHA256 `c2e94c166b01d2abb6bb49bc0cca1d534b8cdd6c45ebe8aea704a7bf0a71afd1`; certificate SHA256 `3a563778e5bf17cd3ead0218e13b4a5030de3f5d7d4e21e0336d8eb37b676dc4`, debug Profile. Host `6b1bd7534b61a8ebfac10150fd308eae8430606e` dirty; Core `9131ddcfeef1922620c6867f88fe82608e51a079` dirty. All 2035 snapshot files match current source bytes.

This new package was NOT installed; device interaction/pixels/frame rate and user acceptance remain OPEN. The device still has the previously installed/launched 191204 build. Canonical retention kept the limit at 10 and removed 191204 HAP bytes, preserving manifest/deployment history; the old HAP is no longer distributable. New manifest: `.reader-artifacts/hap/20261023T194424Z-6b1bd753-50961b08/manifest.json`.

## 2026-10-27：页面矩形与可逆时间轴接线（进行中）

用户本次确认固定书脊演示的完整方案：封面先抬到阅读页面矩形，再绕页面左缘翻转，交接时越轴淡出；阅读子树保持 1 倍缩放。该目标取代上文“移动、放大与翻开同时进行”和整窗等比 canvas 的历史方向。原 2026-10-24 探针仍代表当时输入下的旧方法结果，不能证明新行为：`tools/test-book-cover-handoff.mjs` 固定依赖旧 `bookshelfMotionCanvas` / `bookshelfMotionPagePose`、旧原生动画和旧注册项，本轮不执行或改写为通过。

当前改动针对同一 dirty 工作树：`BookshelfNavigationMotion.ts` 将书卡与页面矩形逐项插值；`BookshelfNavigationTransition.ets` 使用共享可逆时钟采样 carry/turn/handoff，close 在遮住正文后等待新书架目标，减少动效和缺源使用同一时钟的淡入淡出分支。`Index.ets` 保留 route/书籍/导航代际的实测回执守卫，初始页面矩形由现有阅读排版 resolver 提供。上述几何函数、阅读 slot 接线、actor 与 MotionSpec 均为本轮 WIP，不以历史包覆盖。

按本次待答问题只选择以下入口，不调用嵌套业务套件、构建或设备：

- `node tools/test-book-opening-timeline.mjs`：提取实际 actor 方法和真实矩形插值，检查分段端点、固定轴、同 ID 更新目标、close 覆盖与等待、同步回执、减少动效及取消。**PASS**；首跑断言区分 `-0` 与 `0` 导致夹具失败，调整为零容差判断后通过，生产代码未为断言修改。
- `node tools/test-book-opening-index.mjs`：提取实际 Index 方法与矩形读取、使用真实阅读排版 resolver；覆盖 fallback、坐标换算、读取前/读取中身份失效、带变换的读取拒绝、缺源与减少动效分支、close 请求。**PASS**；首次直接 Node 加载源码时因原源码普通 import 包含类型名而失败，测试改用 SDK TypeScript 转译保留实际 resolver，随后通过。
- `node scripts/check-header-geometry.mjs --checks bookshelf-opening-geometry-and-clock --rationale '核验开书 actor 的页面矩形与单时钟接线' --json`：仅检查开书几何/时钟的静态接线，**PASS**；其他 32 项 **NOT_RUN**。该命令不接构建或 CI。

这些结果限于源码和受控接口回归；ArkTS 编译、真实帧、中间像素、跨视口对齐、性能、签名安装和用户验收尚未由这些检查证明。逐帧宽高变化与 3D 翻转的主线程成本仍未知；复用上文旧原生 actor 的性能推断不适用于新模型。真机帧率取证需先满足工作区问题记录和授权前提。

### 首次开书阅读页的加载与正文交接（2026-10-27）

现象和待答问题：开书翻页进入阅读层时，首次正文尚未就绪可能出现整屏章节加载提示；若封面动效结束后仍未就绪，切换加载样式又会产生第二次视觉跳变。本次只处理首次开书的视觉交接，不改变章节读取、首屏位置提交、失败或返回的业务 owner；历史开书探针与 HAP 不能证明这一新行为。

`ReaderShell.openingHandoffActive` 由当前开书转场提供，透传给 `ReadingExperience`。首次接纳该标志后，页面使用 `ReaderPageState` 的内容插槽，在当前主题纸面及阅读布局的正文轨道显示骨架；动效结束不会撤销等待。骨架保留到既有可见页面 ready 回执、失败或阅读身份失效，随后复用原读取与失败语义；用户返回仍走原有退出入口。仅首次接纳开书标志，普通章节切换继续使用原章节加载界面。

实际页面 ready 后以现有 `bookshelf.open.fade` 和 `ReaderMotionPolicy` 驱动标题、正文文字透明度；纸面和图片不参与淡入。排队的帧回调复核挂载生命周期、阅读身份与章节选择代次；如果选择已变化，恢复文字可见而不对新选择启动旧动画。减少动效沿用公共策略的零时长分支。上述为源码接线与受控方法层结论；转场期间的真实像素、正文到达时机和视觉连续性尚待验证。

唯一新增定向入口 `node tools/test-opening-page-handoff.mjs`：提取实际 `ReadingExperience` 方法，以受控帧和动画接口覆盖动效结束仍等待、ready 淡入、失败清理、选择变化后的旧回调、减少动效分支和后续不重播；不运行其他业务套件、构建或设备动作。执行结果 **PASS**，退出码 0。相关受跟踪生产文件的 `git diff --check` **PASS**，不覆盖新文件的编译或运行。

本阅读交接改动的 ArkTS 编译、真机/模拟器交互和逐帧视觉对比均 **NOT_RUN**；探针不模拟 ArkUI 属性传递、布局或合成，不能证明页面观感、帧率或用户验收。编译和设备证据须绑定后续实际输入与动作单独记账。

追加集成审查发现：仅删除正文缩放会让全屏 ReaderShell 首帧盖住保留书架。现由同一 actor 时钟发出带 request ID 的阅读透明度轨道，Index 只消费透明度并在取消/完成时恢复 1；背景书架保持无命中和无障碍，阅读页始终不做缩放。常规 open 消费 carry 曲线，淡入分支消费 fade 曲线，close 等待新目标的 covered 握手不变；进行中开启减少动效从当前阅读可见度接续淡入。移除设置订阅中原先直接清除转场的旧分支。

同一轮将两处书架图像封面的既有阴影常量归并到 `BookshelfCoverVisual.ts`，转场封面复用，未引入第三份参数。再次运行上述 actor、Index 方法探针以及 `--checks bookshelf-opening-geometry-and-clock` 静态项，均 PASS；增加的断言覆盖 reader opacity 与旧 ID/NaN 拒绝、取消或完成后的复位、旧帧失效以及减少动效切换的连续性。该方法结果不验证实际绘制、阴影外观或设备帧率。


## 2026-10-30：执行冻结的整窗纸面与真反向方案

基线：main `fce869a1` 加现有 dirty WIP；本次只改 MotionSpec、BookshelfNavigationMotion/Transition、BookshelfPage、Index、两个开书探针和单个显式几何合同项，保留 LocalReadingExperience 及动画工作树。此前页面矩形/780ms 的方法结果不覆盖本轮 660ms 整窗与反向状态机，需重新回答：同一时间轴能否连续反向、正文/书架输入及退出身份是否正确、新原点不可用或迟到时是否可靠降级。

执行前已读 `GATE_INDEX.md`，本次必要验证范围固定如下，所有入口均无 HDC、网络、存储业务、Native/HAP 构建或其他测试套件：

1. `node tools/test-book-opening-timeline.mjs`：SDK AST 提取实际 Transition 方法，导入实际 MotionTimeline/矩形 helper，以受控帧和平台曲线接口验证 260/260/140 的分段端点、100/300/600ms 反向的姿态与 reader opacity 连续、旧帧失效、重复反向、fade/reduceMotion、covered 握手、取消及主题/阴影/字号状态。只测试本次改动的 actor 风险；每次进程上限 30 秒，失败停止并定位，不扩范围。
2. `node tools/test-book-opening-index.mjs`：SDK AST 提取实际 Index/BookshelfPage 相关方法，使用受控 UI 测量、runtime/store 和导航端口验证整窗坐标、主题快照/异常回退、返回拦截与反向会话收尾、原点不可用回报/去重、120ms 回报接受、150ms 截止、旧 id/generation 拒绝和输入禁用接线。删除旧页面矩形测量/回填断言，不执行历史 handoff 套件。每次上限 30 秒，失败先审生产调用链和夹具。
3. `node scripts/check-header-geometry.mjs --checks bookshelf-opening-geometry-and-clock --rationale '整窗纸面与真反向改动，需要核验唯一目标矩形和时间轴接线' --json`：只执行改动的静态几何合同项；其他项 NOT_RUN。脚本顶层只读现有源文件，不调用其他检查。上限 30 秒。
4. `git diff --check -- <本次文件>`：仅补丁空白检查，无嵌套操作。

源码核对发现两个冻结方案边界所需的补充：反向 retarget 使旧帧 generation 失效，避免重复回调链；`onSearchVisibilityChanged` 对正在反向的请求保留时间轴，否则后台清理会抢先取消。书卡点击还需同步请求守卫，以覆盖 native enabled 下一次 render 才生效的间隙。实现与检查结果另补；本节不是通过声明。

P5 按冻结方案属于需另行明确发起的可选包/设备阶段，本次不执行。编译、签名、安装、设备中间像素/帧时间及用户验收保持 NOT_RUN / OPEN。


### 2026-10-30 执行结果

P1–P4 已落地于上述 main dirty 工作树，未提交；原 Index 并行修改保留，LocalReadingExperience/动画工作树未改。本轮未修改产品版本、发布说明、签名配置或用户数据。

- 请求 target 统一为 host 本地整窗；carry/turn/handoff = 260/260/140ms，FADE = 180ms，沿用原曲线。阅读主题 paperStart/ink 在建请求时取快照，异常走 App token；标题宽度以 48vp 档位（96–384）变化，字号仍为 14–48，阴影随 carry 收束。
- open 返回只改变同一时钟方向并失效旧帧；100/300/600ms 反向、重复返回、切后台、首帧前请求合批都已接入。首帧前收到 reversed 请求从 0 直接完成；fade/reduceMotion 忽略反向。反向 finish 在原导航清理前捕获延后投影，清会话后一次交付。
- close 保留 covered 后的新原点握手；视口恢复后成功/不可用均按 key + navigation 去重回报，150ms 使用单调时钟截止。不可用回调读取交付时当前请求 ID，并同时核验呈现导航代次，避免保留书架的初始回调闭包捕获旧 ID。原点已接受后旧截止无效；等待和最后 carry 均阻止 Back/书卡点击。
- `node tools/test-book-opening-timeline.mjs` **PASS**，最终 0.580s / exit 0；在基础通过后只因追加首帧合批边界重跑一次。实际 Transition/MotionTimeline 方法配受控帧与线性曲线 seam；真实注册表时长另核，不模拟原生 cubic 曲线绘制。
- `node tools/test-book-opening-index.mjs` **PASS**，最终 0.373s / exit 0；使用实际 Index → completeReturn → nextNavigationGeneration 链、BookshelfPage 方法、实际主题 resolver。初次 0.915s 通过；仅因新增根 Back 门禁和旧 Page 帧不覆盖新 token 的负对照重跑。本轮无失败执行。
- `bookshelf-opening-geometry-and-clock` **PASS**，最终 0.174s / exit 0；其余 34 个合同项 **NOT_RUN**。`git diff --check` **PASS**；SDK AST 语法解析包含在两个方法探针中，不能代替 ArkTS 类型检查或构建。
- 编译、HAP、签名、安装、启动、设备像素/帧时间对比均 **NOT_RUN**；设备及用户验收 **OPEN**。未运行全量门禁，也未把历史包/设备结果记成本轮通过。后续 P5 仍须绑定本轮输入；待观察打开/合上、300ms 返回、四种纸色、reduceMotion 与帧时间。

以下 SHA-256 仅绑定本轮源码/探针文件，不是构建指纹或产物证明：

| 文件 | SHA-256 |
| --- | --- |
| `entry/src/main/ets/features/common/MotionSpec.ets` | `816c024dbfe4bd3b912b1e4f9a1e12bca79475d8bc86cee3b0e3884398eeae94` |
| `entry/src/main/ets/features/bookshelf/BookshelfNavigationMotion.ts` | `58527fbfb85705259a771af9cf30c0b5283c37c6923d808781e564745c62e132` |
| `entry/src/main/ets/features/bookshelf/BookshelfNavigationTransition.ets` | `cae1a8ad51cdb052a5288007a780ad9edb0f521b9d09a5a36ea401f373a8a64c` |
| `entry/src/main/ets/features/bookshelf/BookshelfPage.ets` | `05f149fd819195d33f71eba695d9771b28e94c7b7b13c6282f3d7c76f0b684f5` |
| `entry/src/main/ets/pages/Index.ets` | `2eb7d5214520166ebff9e62eaa4faaa7130ffcfe953345feae46e99caf88ce75` |
| `scripts/check-header-geometry.mjs` | `4a60c0bbfe08f39995e5b1a88cc4014ed2e1a9666b6d36de361162d87ab8ff13` |
| `tools/test-book-opening-timeline.mjs` | `b60c723ae8008064ce9b91c7e68cbc77c234a78d776820316d70942be84c1d55` |
| `tools/test-book-opening-index.mjs` | `f40da42c983ad634de885866a5592dcaad5360204582b2cb8eeb8f4f3c26018e` |

### 2026-10-30 交付审计

- 复现与绑定：上表 8 个受跟踪文件的当前 SHA-256 与记录逐一相同；本轮重新执行 `tools/test-book-opening-timeline.mjs`、`tools/test-book-opening-index.mjs` 和 `--checks bookshelf-opening-geometry-and-clock`，均 **PASS**。记录与实际工作树一致。
- 发现（已修复，见下）：open 在书卡原点未测量/不适配时不再降级淡入。`openShelfBookWithMotion` 的 `fadeOnly` 由 `!measured || this.readingContentKind !== 'text'` 改为仅判断内容类型；此时 `source.rect = viewport`，actor 首帧即无圆角、无阴影的整窗平铺封面，并保持到 520ms 才开始淡出，取代旧实现的 180ms 纸面淡入。触发条件：书卡被头部/浮动导航裁切、`viewSwitchRunning`、封面节点缺失；reduceMotion 仍由组件内 fade 分支处理，不受影响。`tools/test-book-opening-index.mjs:106` 已把这一行为写成合同（“text uses full-window turn even without a measured cover”），所以探针通过不能证明该回退符合冻结方案。已按建议恢复并同步断言，见下节。
- 已核非问题：反向 finish 的两次 `shelfOpeningReaderOpacity = 0` 有依据——`completeReturnToReadingOrigin` → `nextNavigationGeneration(false)` → `clearShelfNavigationMotion` 会把透明度归一为 1；且每次进入阅读都经 `openReading` → `nextNavigationGeneration`，不会把 0 残留到后续会话。`shelfPaperPalette` 使用静态 `ReaderRuntimeOwner.current()` 与同文件既有约定一致。`onSearchVisibilityChanged` 对反向请求保留时间轴是有意例外。
- 边界：审计只覆盖该动效范围；工作树共 1239 个变更文件，其他 WIP 不在结论内。ArkTS 编译、HAP、签名安装、设备帧/中间像素与用户验收仍 **NOT_RUN / OPEN**。

### 2026-10-30 未测量书卡回退修复

- 用户确认修复：`openShelfBookWithMotion` 的 `fadeOnly` 恢复为 `!measured || 内容类型非文本`。书卡不可测或不适配时不再从首帧整窗平铺封面并整屏翻转，改走 180ms 纸面淡入；fade 面不绘制封面图像。
- 探针同步：`tools/test-book-opening-index.mjs` 的“无测量原点”断言由 `fadeOnly === false` 改为 `true`，不再把整窗封面回退写成合同。
- 重跑 `tools/test-book-opening-timeline.mjs` **PASS**（Transition 本轮未改动，结果仍绑定原字节）、`tools/test-book-opening-index.mjs` **PASS**、`--checks bookshelf-opening-geometry-and-clock` **PASS**（其余 34 项 **NOT_RUN**）、`git diff --check` **PASS**。
- 本次变更文件 SHA-256：`entry/src/main/ets/pages/Index.ets` `2caa3f5a6634010d7c31edeaf43b2c5c27b015cc97169e6481e840d9b4c33b63`；`tools/test-book-opening-index.mjs` `8e995044edb6e3bbaf5495cb15cefcb814cf64bc7cea5798b1faf9de480952b8`。上方哈希表保留为修复前执行的绑定，不追溯改写。ArkTS 编译、HAP、签名安装、设备帧/像素与用户验收仍 **NOT_RUN / OPEN**。


### 2026-10-30 本机 VM 交付：构建前范围

用户明确发起本机已有 VM 启动、HAP 构建、安装与定向测试。构建使用 main `fce869a10399fd6feec4c9a8178808f43d55e31d` / Core `80d614e929ae9e320ab767a1dc04579363c361d7` 的当前 dirty 输入，包含上述未测量书卡淡入修复；不覆盖或清理并行 WIP。现场共享 build-resource lease 已自然释放，未接管或删除他人锁；本机未见活动 Hvigor/Cargo/Native 重型进程。

本次唯一构建入口：`CARGO_TARGET_DIR=/Users/minliny/Documents/Reader/Reader-Core/target READER_CONTRACT_TEST_WORKERS=2 node scripts/hap-pipeline.mjs build --class iteration --contracts-scope none --signing local`。显式复用已有 Native/Cargo 缓存路径；pipeline 自持规范共享资源租约和隔离构建目录。嵌套仅执行此次打包直接必需的当前 Core/Native/SDK provenance、源码与工具链快照、官方 OHPM 本地依赖解析、非增量 ArkTS/Native HAP 编译、指定 minliny_HarmonyOS 证书/Profile 及包内资源/Native/签名字节校验。必要风险分别是输入错配、声明依赖漂移、编译不兼容、签名错配与包内容缺失；合同 scope none，不附带已有方法探针、业务套件、书源联网验证或设备操作。默认滚动保留 10 次成功构建，不提高 keep-runs、不手工清理。构建结果及实际耗时待回执补记；失败保留原 attempts 日志，不用旧包替代。


### 2026-10-30 本机 VM 交付与取证计划（执行中）

用户明确要求启动本机 VM、构建 HAP 并安装测试。本次目标为现场 Emulator 列表唯一已有实例 Mate 90 Pro，实例路径 `/Users/minliny/.Huawei/Emulator/deployed/Mate 90 Pro`，API26/ARM64/4GB，启动前 isRunning=false，无 Emulator 进程。仅正常启动此实例，保留 userdata；不新建、克隆、重置、删盘或卸载。HDC server 绑定本机 `127.0.0.1:8710`，现场 target 在启动后重新发现；旧物理 Unknown 目标不用于本次。

必要动作与边界：启动现有实例并核当前日志 Guest OS Boot Completed、boot completed 与 SceneBoard 稳定；这些只读检查保护尚未就绪系统，不执行应用查询直到就绪。HDC 全链清除大小写 HTTP/HTTPS/ALL/SOCKS_PROXY，NO_PROXY=*；loopback 路由已核 lo0，当前本机 listener PID74437；VM 启动后再核实际 server/设备 socket。构建由规范 pipeline 独立记录签名/配套输入，合同 none，不重复前轮已绑定方法探针。安装前精确 manifest inspect，随后 install（覆盖保数据、启动与回执），绝不以 HDC Connected 代替系统或安装成功。

代码侧已定位并修复的反向、输入门禁与原点握手复用现有方法结果；本轮 VM 仅回答代码侧无法证明的原生整窗交接、稳定 route 结果及主题像素。使用现有生产书架与已有真实书籍，先看实际前提；开/合、返回、四主题和 reduceMotion 各限定一次必要场景，保留前后截图和操作记录。现有 sampledClick 是串行截图命令，无法证明准确300ms反向或帧时间；无合格录制/trace时这些保持OPEN，不将图像样本冒充精确时间。每个UI probe闲置≤60s/会话≤10min，失败立即停止后续采样并代码归因；设置测试后恢复原值。


构建首轮失败（attempt `1793348122848-d57f161b-f340-483a-8265-a0ed734e0288`，08:15:22Z–08:16:16Z，53.764s）：Native provenance 与 OHPM PASS；Hvigor 34/34 tasks 实际执行、CompileArkTS 37.484s、assemble/sign 45.606s 完成，但发布前 workspace 合同/skill 快照由 `0ae9f2f6...` 变成 `7f5fc6f8...`，pipeline 正确拒绝发布，故本轮 HAP 交付 **FAIL**、无成功 manifest。原始脱敏日志在 `.reader-artifacts/hap-attempts/1793348122848-d57f161b-f340-483a-8265-a0ed734e0288/`。既有 ArkTS API/type warnings 有输出，未据成功编译声明警告全清。

离线定位：snapshot 范围包含整份 Core governance workspace；本轮期间/之后唯一有更新时刻的输入是 `Reader-Core/governance/workspace/DEVELOPMENT_BACKLOG.md`，内容为并行 Android A3/A6 证据记录（最近 08:16:25Z）。原失败 attempt 未保存 workspace 逐文件前快照，不能把 mtime 线索写成逐文件字节差分证明；已额外保存当前 58 文件 workspace 快照供重试失配时精确对照。未修改控制器、未忽略文档身份、未恢复他人变更。当前输入静止约一分钟后仅按相同入口重试一次；旧失败保持原判定。


第二次构建（attempt `1793348295774-6c82a799-7730-401b-9de6-67ca69a87ee4`，08:18:15Z–08:19:25Z，69.305s）仍在编译/签名成功后因 workspace 快照变化拒绝发布，HAP 交付 **FAIL**、无 manifest。OHPM 0.568s、Hvigor 子进程 56.897s，均 exit 0；发布前 fence 失败。此次额外快照已逐文件证明唯一变化是 `Reader-Core/governance/workspace/DEVELOPMENT_BACKLOG.md`，SHA-256 `b125703059b336f38b602b585a8244a41a13ea298700104f9f7c775523e45169` → `38197d41e24c28316c68fd55a82cd8daf7d927afaabfed8f3ed1985e00d3e2d4`，新增并行 Android A3 reset 证据。不是本次产品源码、Native 或签名失败。停止第三次盲重试，先核支持的固定输入构建路线或协调稳定窗口；不禁用原输入 fence、不改写并行证据、不从失败临时目录挑包。


08:25Z 再派发依据：root 重新核实唯一漂移文件最近变更为 08:20:21Z，已静止 4 分 39 秒，现场无活动 Hvigor/pipeline；据新稳定窗口只派发一次相同规范入口。保留本次 58 文件前快照、复用既有 Cargo/Native 路径，所有 fence 保留。再次漂移则停止重试，先准备完整输入的隔离工作区方案，不改为忽略该文件。


第三次 attempt `1793348730331-fd8fa2bd-a44a-4547-8ebd-8fc55896b55e` 于 08:25:30Z–08:25:32Z 在取得共享构建资源时停止（2.086s，0 编译阶段）：瞬时活动 owner 占用 build lease。随后现场锁已由 owner 自然释放、无重型进程；未删除锁。用户此时明确批准协调 Android 聊天暂停 governance 写入与 sync 三分钟，root 已发出协调消息；利用这个已授权稳定窗口再派发同一入口，原失败保留。


### 2026-10-30 本机 VM 候选 HAP：构建完成

协调窗口内第四次 attempt `1793348772345-8138a48a-3867-4698-8372-d31ef7e4cac1` **PASS**（08:26:12Z–08:27:19Z，67.362s；前三次失败保留）。官方 OHPM 0.810s、Hvigor 子进程 44.087s；工具日志 CompileArkTS 36.485s、SignHap 2.590s、BUILD SUCCESSFUL 43.189s，34/34 tasks 实际执行。无 Core 重编译或 sync-native，已有 Native 当前输入预检通过。API可用性/过期API、ArkWeb诊断类型及 SearchPage ObjectLink 等 warnings 仍有输出；未做全仓 warning 差分或据此声明清零。

- Run：`20261030T082703Z-fce869a1-431b6d40`，不可变 [manifest](../../.reader-artifacts/hap/20261030T082703Z-fce869a1-431b6d40/manifest.json)。Harmony `fce869a10399fd6feec4c9a8178808f43d55e31d` / Core `80d614e929ae9e320ab767a1dc04579363c361d7`，两仓 dirty 如实记录。
- Signed HAP：`/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-artifacts/hap/20261030T082703Z-fce869a1-431b6d40/entry-default-signed.hap`，209,350,911 bytes，SHA-256 `247956b6bfb87cf186de47153e5fa455eb9ab00b45f61ad9e24bd25ff4e8dfa7`。
- 指定证书 SHA-256 `3a563778e5bf17cd3ead0218e13b4a5030de3f5d7d4e21e0336d8eb37b676dc4` 验签 **PASS**，debug Profile；包内三个 Native entry 集合与 required resources 字节均 **PASS**。嵌入 Core NAPI 为 21,376,816 bytes，SHA-256 `c50dc9f2d2a49e595bbcc1ff7e2eec28bd3243867353b9cef1c2c71772562448`。
- 1,321 文件 source fingerprint `431b6d4072a7cdbc12dd811bc37917aedf07784b727a50dfb496c8c434106690`；5个本轮生产动效文件与当前源码逐一同字节（Index 包含已确认的缺原点 fade 修复）。58 文件 workspace fingerprint `3987a03cb99a2a1a79ee86f7309f75dd6da5b4130619e059c514f46ff67e803d` 与额外前快照相同，前后 fence 全部通过。
- 实际工具：DevEco Hvigor 6.26.8，pnpm 10.34.5；`--no-daemon --no-incremental`。合同 scope none、Core套件、live书源行为 **NOT_RUN**，不重复已通过且源码未变的开书方法探针。
- 规范保留策略在发布成功后滚动淘汰旧 run `20261027T162940Z-3b297fdc-560000c9` 的已核哈希 HAP 共417,865,088 bytes；保留10次成功构建，未提高上限，旧manifest和部署证据保留，未操作用户应用数据。

本节只证明构建、包配套与签名；VM inspect/install/launch 和动效中间像素/帧时间由本次后续设备回执另记，不能由 build PASS 推断。

### 2026-10-30 本机 VM 安装后数据兼容阻塞（代码定位中）

08:28Z canonical inspect PASS，精确本机 target `127.0.0.1:5555` 的现有应用身份与指定签名一致；canonical install PASS、dataPreserved=true，部署回执 `20261030T082703Z-fce869a1-431b6d40/deploy-vm-6460677a198b-20261030T082815Z.json`。首次生产页面 dumpLayout 显示“本地数据版本过新”：数据 v46，当前支持 v44。书架/阅读进度/书源保持，未执行清数据、卸载、导入或设置变更；动效场景未进入，不能记为通过。原始布局、实屏及操作日志在 `.reader-artifacts/bookshelf-window-vm-20261030/installed-shelf/`。先定位当前 Core schema 与产物 pin，禁止仅提高支持版本或修改用户库游标绕过保护；兼容候选或独立验证实例须另核实际来源。

### 2026-10-30 同产品版本强兼容审计结论

用户拒绝新建 VM，并重申同产品版本必须强兼容；仅跨产品版本才可能讨论不兼容。新建/停止 VM 的请求已撤销，未执行。当前实例保留，停止后续安装与UI测试；本节只记录只读源码审计，没有兼容修复。

1. **版本定义与现场事实**：v44/v46 是 `PRAGMA user_version` 的 DDL 迁移游标。主 Core `crates/reader-storage/src/sqlite_backend.rs:178` 声明44、最小可读0、格式代际1；本次部署回执安装前后均为产品 `0.2.0` / 安装计数器 `1000000`。因此是同产品版本的能力退步，不属于已授权的跨产品版本不兼容。本次 Native 正确绑定 main dirty 输入，并非拿错旧包；主线与同步工作树的实际 dirty 存储实现不同。
2. **直接触发**：`reader-runtime/src/remote.rs:2102–2110` 用只读 `PRAGMA user_version` 得到实际游标并直接以 `actual > SQLITE_SCHEMA_VERSION` 拒绝整库；`reader-storage/src/sqlite_backend.rs:875–910` 还有相同上界保护。sidecar本身不直接产生此schema错误。该保护发生业务写连接/事务前；但 `remote.rs:2212–2218` 会写入拒绝诊断sidecar，所以不能声称整个沙箱零写入。
3. **实际兼容性**：同步分支 `library_sync_storage.rs:21` 的v45追加同步状态、标记身份表和SQL触发器；`:91` 的v46追加发布回执表/索引并把同步状态协议升为2。没有删除/改名v44业务表列，触发器仅用SQL内建；46>44本身不是基础书架读取不兼容的证明。普通CRUD有触发器维护基础，不能概括为所有旧写入均损坏新库。但main元数据恢复和全量快照缺少新同步pending准入、mark跟踪暂停、writer/baseline重置或协调：main `library_metadata_apply.rs:665–721` 与同步分支`:714/:735/:775–777`存在具体差异。因此直接取消guard或只抬到46仍不能满足完整强兼容。
4. **交付准入缺口**：`scripts/hap-pipeline.mjs:1858–1881`只依据签名/Profile/appId或appIdentifier放行；`:1921–1931`的inspect/install不读取存储元数据/实际库游标，manifest中的Native身份也未声明存储兼容能力。`install -r`保留文件但不证明新程序能使用它们。此行为违反 `../VERSION_POLICY.md:182–187` 中“不能读取设备当前数据代际的包，不得以保留数据方式覆盖安装”“签名身份不能替代数据兼容性校验”的既有要求。本次操作者未落实该校验也属于交付疏漏。
5. **重复事故与证据缺口**：`custom-action-audit-20261026.md:68–107`已记录同类44/38事故；当时补齐了39–44迁移与相应语义，没有建立同产品线完整兼容合同或安装前准入，故本次46/44再次出现。同步分支存在真实46实现，但旧部署回执多数缺server/location，`127.0.0.1:5555`的targetRef在远程/本机可能相同，不能据其认定当前本机VM的首次升级包。当前无业务数据损害证据，也未检查当前库的同步pending/tracking状态。
6. **附加证据问题**：`StorageCompatibilityMeta::new`会使用失败候选的supported/minReadable/dataFormat/coreBuildId，`block_storage`随后覆盖旧sidecar，只保留上次成功时间。最后成功写入者与失败尝试未分开，不可把当前sidecar当作历史写入者能力；该问题也需纳入统一修复。

修复必须分两层：恢复本次0.2.0的真实存储/同步读写兼容（覆盖未完成同步、恢复/快照、未知新增数据保留），并把DDL迁移游标与同产品线读写兼容合同分开；由同一Core权威能力描述驱动Native/manifest与覆盖前准入。只并入45/46能解除这一个样本，不能代替强兼容机制。不得通过新VM、清库、改PRAGMA、单纯抬常量或产品版本规避。后续验证应使用原库的受控副本与真实v44/v46生产实现，明确双向读写/冷重开/恢复不丢数据及安装前拒绝，先代码侧后原VM；本轮未执行这些修复/测试。

### 2026-10-30 强兼容方案获准实施：原库前证与执行范围

用户批准执行[存储强兼容方案](../architecture/storage-strong-compatibility-plan-20261030.md)。修改仍在原main两仓dirty输入上逐段整合；每个owner保留前像，不整树覆盖同步工作树。产品版本未变。原动效五个生产文件未改，其已通过的精确方法证据复用；存储变更不能据此推定VM动效已通过。

09:42Z现场确认原Mate 90 Pro、local HDC server `127.0.0.1:8710`与target `127.0.0.1:5555` Connected，原Emulator PID44900与HDC listener74437/socket仍在。官方`shell -b`可读取调试沙箱；实际模块filesDir位于`data/storage/el2/base/haps/entry/files`。设备SQLite只读打开原WAL库失败（无法open），两次备份尝试未生成目标，不能记Backup API成功。后续依计划仅正常force-stop Reader应用，未停止或更换VM；应用UID20020074的完整进程列表在捕获前后均无进程。停止后官方沙箱和文件传输仍可用。

09:46:58Z原DB、WAL、SHM及诊断sidecar完整捕获，设备前后与传输后哈希一致。私有原件在`.reader-local/storage-compatibility-20261030/original-raw/`，只在另一分析副本执行SQLite Backup API与quick_check，原件不打开为业务写库。得到134,512,640字节一致性v46副本，SHA-256 `b4801045b0163b8f89626e0d45ad833ab36436c40b3f7e73e579944098d75af5`；quick_check=ok。详细回执`original-backup.json`。Backup输出schema cookie=1仅属于新副本，原主文件header cookie=566，不能混用作同库代次。

副本实际含79表、275触发器、17条书架、7条阅读进度。同步payload约50MB，protocol2、active.status=publishing，local/merged各5860条records，待发布内容18,900,146字节；发布对象身份和SHA已持久、尚无readbackProof。上述是原未决操作，不清除、不新建操作替代，也不在本轮最小VM验证中擅自向远端重发。原业务数据未迁移，原App维持停止态；VM继续运行。

当前准备的必要验证只针对本次变化：storage的真实44/45/46/47布局、旧编辑归档、原46私有副本与pending/CAS；runtime的writer/restore补偿与独立只读bootstrap；Host的存储构建绑定、实时准入和签名分离。执行入口使用精确target/case与原Cargo缓存，嵌套仅编译对应依赖及调用当前生产方法；每批执行前补具体选择器和待答问题。Native、HAP、指定签名及原VM安装是后续动作，当前均未完成。没有全量门禁、没有清数据/卸载/改游标/更换实例。

第一批精确执行选择为`H-storage-deployment-admission`的五项case：`build-binding`（Node纯函数/私有文件，防合同、Core输入、Native/HAP配对被替换），`live-admission`（Node纯函数，防伪JSON、未知布局/协议、缺屏障和准入后WAL变化），`signing-separation`（仅import pipeline、不执行CLI，证明相同签名不代替数据许可），`snapshot-wal`（三个小Python/stdlib SQLite子进程，验证现用副本helper确实包含已提交WAL并保留raw字节），`lease-session`（两个假HDC Node子进程/独立测试锁，验证本次新增持续server租约、路由和代理清除）。入口为`tools/gate-index.mjs --id <上述准确ID#case> --run --change ...`，不调用真实设备或Cargo，也不展开旧pipeline整套；这些是新覆盖前准入实现必需的故障边界，不能由原签装成功记录替代。

下一最小步骤为显式 `Reader-Core/scripts/build-storage-inspector.sh`，使用既有 `Reader-Core/target` 与共享 build-resource-lock；嵌套只执行 input snapshot capture/verify、`cargo build --locked -p reader-storage --features sqlite --example storage_inspect --target aarch64-apple-darwin` 及 inspector identity。此构建用于用同一生产准入代码只读判定原 v46 副本，不能由旧版本号检查代替；不运行测试或设备操作。随后仅对冻结一致性副本执行 `storage_inspect`，不打开设备原库。

第一批5case实际PASS（1378ms，fullSuite NOT_RUN），原结果保存在私有`p4p5-node-first-pass/`。受控collector新增真实解析seam和恢复备份回执定位后，仅补`H-storage-deployment-admission#collector-parsing`（生产BM UID/完整ps/文件集合解析，无设备与子进程，覆盖后台writer、缺WAL观测、WAL消失和未知rollback journal）及受影响`#live-admission`（不可变恢复位置回执）；其余4项复用不重跑。inspector首次尝试被活动Android资源租约阻止，未编译；租约自然释放后第二次编译发现4处Rust适配类型/可见性错误，已分派修复，失败保留。

P4 SDK最小检查选择`check-local.mjs --stages sdk --select sdk:bindings/harmony/sdk/storage_probe.test.ts`。仅Bun执行新增3个生产SDK wrapper用例：Native API缺失不得创建Runtime、退役后的完成不得生效、Core显式旧迁移/未知代际原样保留且Host不复制schema表。无Cargo/Native/设备调用；该层验证不代表真实NAPI通过。

原v46一致性副本的首次新Core probe仍被拒：`directory_guard_chapter_cache_update`实际DDL与main reference不同，已定位为历史directory revision policy v2完整5-trigger集合，不是数字版本差异；修复将登记精确已知语义集合，不宽松忽略触发器。原失败记录保留，原库不改。

Host原操作恢复的本批最小入口为`tools/test-storage-compatibility-recovery.mjs --case recovery-only-admission,registry-physical-drain,original-commit-handoff,bootstrap-identity`。只选生产AST方法并显式替换平台端口，无嵌套测试/设备/Cargo：分别验证只打开本机原journal不自动联网/新建；真实文件finally结束前不越过封写屏障；同operation提交前物理排空、丢ACK只查原回执和失败不重复提交；实际Native bootstrap与包内期望build/contract/input三身份全等。该层不能代替真实Native或VM证据。

Ability/Index新增接线最小验证`tools/test-storage-ability-handoff.mjs --case ability-adoption,startup-feedback`：AST选择实际adopt/window-ready及startup事实方法、显式平台端口，无嵌套测试/设备/Cargo。待答：旧Runtime释放完成与配置恢复前不得认可新根页ready；窗口退役不得安装后继owner；未决原操作不因提示/导航被ACK，旧提示动作失效，完成事实只有实际展示后才标记通知。移除了phase1中无消费者的系统备份预备注册，不引入额外系统备份能力。

Core storage本批准确选择15个libtest case：storage_layout的existing_layout_reopens_without_migration、schema_change_after_admission_rejects_write、schema_change_after_lock_rejects_implicit_write、prepared_and_export_readers_share_admission、probe_missing_directory_is_read_only、higher_format_rejects_before_database_open、malformed_known_layout_is_not_admitted_by_number、schema46_preserves_reading_and_sync_facts；legacy_migration_preservation的legacy_edits_are_retained_before_source_migration、ambiguous_books_remain_recoverable；storage_compatibility的failed_open_preserves_producer_and_unknown_sidecar_bytes；library_sync_storage的schema45_pending_remains_unchanged_on_open、schema46_and_schema47_marks_and_epoch_are_atomic、sync_unknown_envelope_survives_save_and_restore_reset、unknown_sync_protocol_rejects_without_rewriting_payload（完整module前缀与清单在私有run-storage-cases.mjs）。分别保护已知布局/写前原子检查/隐藏只读入口、原46真实数据写入冷开、旧事实归档、成功writer事实与未知sidecar保留、原pending/时钟CAS/未知同步域与协议。
本批为避免逐case重复编译及全树哈希，使用canonical `build-resource-lock.mjs`包住一个私有明确编排：`cargo test --locked -p reader-storage --lib --features sqlite --no-run --message-format=json`只构建该target，再执行返回的唯一libtest binary `--exact <上述15个完整名称> --nocapture --test-threads=1`，逐名核15个回执。复用`Reader-Core/target`与已编译`aarch64-apple-darwin`子目标；一次Core输入capture/verify与binary SHA绑定。原P0完整副本只读，测试写其0700临时复制件。不执行其它crate测试、未选case、设备或全量套件。

原v46副本第二次只读Core probe PASS：schema46，reader-directory-visible-content-v2，协议2/state epoch/log receipts；没有迁到47。新增真实偏好封写/排空接口需验证`tools/test-storage-preferences-restore-barrier.mjs --case late-first-put,drain-in-flight,unknown-flush,appearance-seal`：读取编译6个实际生产owner，仅显式Preferences/runtime端口；前3项各覆盖reading/TTS/general/bookshelf的已过barrier悬挂读→seal拒第一put、已派发flush须等待、丢ACK拒恢复；最后覆盖Appearance已接受写排空及新change拒绝。无旧suite导入/网络/设备/Native构建，与Rust串行构建独立。

后续Runtime必要8case采用同一已记录的单target编译+Rust `--exact`私有编排（`run-runtime-cases.mjs`，canonical资源锁、相同target缓存，未展开其它case）：storage_maintenance两个bootstrap读前零创建/代际拒绝保字节；runtime的bootstrap_reopen_and_clone_keep_library_but_create_new_writers；sync::log_v2的immutable_log_two_sqlite_concurrent_publish_conflicts_and_tombstones及immutable_log_unknown_ack_cold_proof_epoch_and_legacy_pending；apply的authenticated_restore_rejects_old_book_source_owner_and_token_but_allows_fresh_import及authenticated_metadata_apply_reconciles_receipts_without_reactivating_old_runtime_state；status的restore_status_dispatch_reads_actual_receipts_without_reactivating_history_after_reopen。它们验证本次新增独立预检、writer身份代次、原同步pending/CAS/丢ACK与恢复只读查询/旧回调退休边界；生产Runtime源码及必要依赖为本批实际编译目标，不把Host方法端口测试代替Rust业务行为。

P4/P5资源与legacy合法迁移准入落地后，本批只补`H-storage-deployment-admission#build-binding/#live-admission/#legacy-admission`：实际bundle bootstrap resource三身份绑定、目录policy观察、Core显式legacy source/target计划（0/38/43→44）准入及伪布局/错误target/代际负例。其它采集/WAL/租约4case复用。另新增资源必需参数已改动实际provenance/preflight CLI调用链，点名`H-native-input-preflight`（私有tmp Git+Node假SO，验证调用者完整参数和替换拒绝）及`H-build-provenance-manifest`（两份小C合成ARM64 ELF、strip/ZIP与真实CLI，验证native/vendor/资源字节配对和错误输入拒绝）。后者仅工具链边界、在已有资源约束下执行，不构建Reader、不连设备、不替代签名/数据测试。没有扩大其它门禁。

Host结果追加：原操作恢复4case PASS（host-recovery-first.log），Ability/Index2case PASS（ability-handoff-first.log），偏好4case PASS（preferences-barrier-first.log），各自只证明上述生产方法+平台端口层。P4/P5第三批选择全部PASS：storage三case87ms、native-input-preflight7445ms、build-provenance-manifest10888ms；日志`reader-contract-run-itMJju`。SDK三case PASS（271ms），Core gate receipt `1793355881238-8be0b648-2044-4609-8827-2a416243632f`。治理先只读确认仅4个本轮受控文件漂移，再canonical sync-workspace --write：30 projections/4 updated。原Native/HAP尚未重建。
Storage15case第一次编译未进入测试：历史schema42测试构造缺新layout字段，正在按真实旧DDL夹具修正而非假标44。原失败log保留；后续attempt使用独立日志文件，不覆盖失败。

Storage下一attempt在原15case上仅追加本次实际修正的`sqlite_backend::library_resource_restore::book_resources::tests::v42_populated_resource_adoptions_upgrade_without_regranting_hidden_locators`，共16个准确名称：真实0→42 DDL与原列合成数据→显式升级44，核资源grant/trigger保护。删除了旧手工SqliteStorage构造，未引入test-only准入旁路；新增1项是本次夹具语义修改所需，未扩展其它历史迁移套件。剩余辅助writer清点只在现有BEGIN后复核/少数隐式写用现有短事务，不改变业务SQL；对应源码稳定后统一编译。

helper收口新增`sqlite_backend::storage_layout::tests::schema_change_after_lock_rejects_helper_writes`：在mutex检查后实际外部CREATE TABLE，目录source/book写与reading-preparation事务都必须拒绝且cache不增加。故storage本批最终17个准确case；新增项只保护刚改的helper原子边界。现在Core源已冻结，按私有明确编排先17个storage、成功后8个runtime，任一失败停止该链，均在同一实际build-resource租约与既有缓存内串行。

P6离线两代矩阵先显式构建真实旧代runner（不等main修复，也不占VM）：冻结phase1实际1359文件/27.6MB，生产输入fp `d039f379df2553fe53ed728e932b763010def52ce6f11aa9dab82c7a90465984`，保留原Cargo.lock，仅私有copy新增同一薄reader-storage example。入口为canonical build-resource-lock包住私有`p6/build-runner.py old`；嵌套`cargo build --locked --offline -p reader-storage --features sqlite --example storage_compat_matrix`，使用原phase1现有target/debug缓存，构建前后验证冻结源并保存binary SHA/嵌入fp/工具链。不是重打旧HAP、不安装VM、不backport当前owner伪造旧实现。后续新代需main最终稳定后独立冻结。已知旧typed同步decoder拒未知envelope字段，按真实结果保留失败，不能预先称全能力兼容。

Storage attempt2：17项实际运行，14 PASS/3 FAIL，44.429s。原46真实副本CRUD/冷开/未决payload保留、已知布局、旧事实归档、真实42显式升级、事务竞态等通过；3个sync夹具缺历史manga_runtime_epoch被正确拒绝，停止后未运行Runtime。另unknown-protocol旧断言只判断拒绝，可能被缺表错误遮蔽，需一起修真实前提和准确协议错误断言，不保留伪阳性。
下一attempt仅选这4个sync修复/复验case，加新unreviewed_extension_dependencies_reject_and_independent_rows_survive_restore（拒未知FK级联/未审trigger，保独立BLOB表/index/view跨生产restore）及原46正样本，共6项，完整名称在run-storage-followup.mjs。其它12项依据未变的行为/夹具保留REUSED原回执，不把旧运行称为新运行。通过后运行此前已列的Runtime8项。

Storage attempt3在编译阶段失败：新扩展域测试误用`put_cache(CachedEntry)`，实际生产签名为`put_cache(key, payload)`，未进入6项运行、Runtime亦未派发；日志`storage-cases-attempt3-build.log`保留。修正测试调用的同一窗口发现代际读取把超出u32的合法JSON整数变成未知，必须先按u64比较拒绝；现有higher_format精确case补此边界，下一批因此增加该1项，不扩大套件。

CAS v1恢复接线补齐后只运行`test-storage-compatibility-recovery.mjs --case cas-recovery-only-admission,cas-original-commit-handoff,original-commit-handoff`：前两项验证已有v1 journal准入、关闭不废弃原操作、强ETag事实与提交；第三项因共用Owner协议分派变化必须复验，未改bootstrap/Registry不重跑。仍仅实际生产AST方法与显式平台端口，不联网、不占设备、不编译Core。

P6旧代薄runner构建PASS（38.36s），不可变binary SHA `62cfb35847f6c4934281d45dbbe36283368701fbd0de1bde3d02ce390a7feecc`；真实旧生产输入fp仍为上述d039…，没有修订旧源码以抹去历史缺陷。矩阵尚未运行。原P0的marks/bookmarks/highlights均0，后续标记跨代证据必须由非空合成标记提供，不能称为已有真实标记保持。除原pending完整payload哈希外，矩阵已补原mark全行、合成mark身份/字段、typed同步事实与47后续DDL不变断言；旧decoder拒未知字段是兼容失败负例，不因采集进程exit0而算PASS。

Storage attempt4七项全部PASS（41.858s，含新增u64格式边界），日志`storage-cases-attempt4-*`。Runtime attempt1编译失败于已并入测试引用缺失的`protocol/fixtures/library-package/v1-text-metadata.json`，未进入8项运行；从同一phase1来源只补该2566字节合成协议夹具，不修改测试选择或用例断言。同时修正Native构建证据exports文字漏列probeStorageAsync，实际导出表原已包含。Runtime下一attempt仍只执行原8项；storage行为不变，复用其结果。

Runtime attempt2：编译PASS；8项实际运行6 PASS/2 FAIL（总81.088s，测试53.82s）。bootstrap只读两个case、writer冷开身份、两项authenticated restore与receipt status通过。两项log_v2在共同schema46夹具的RemoteState初始化即报storage failure，尚未进入同步行为；正在按实际启动访问链定位schema-only夹具缺失的历史单例初始行，不能将此失败归因为原VM数据。失败保留，修正后只重跑这两项。CAS Host前三项PASS；关闭后重开创建重复Gateway的实际竞态另行修复并点名单例复用case。

v46夹具初始化的确定失败点是manga_retention首次查询manga_session_runtime单例；补齐4项生产迁移原始单例，runtime_fetch_clock依生产optional冷启动语义保持合法空态。Runtime attempt3仍为0/2 PASS（42.472s，测试12.40s），已越过启动并进入命令分派，通用storage failure缺方法名/底层原因，未推定为同一根因。attempt4仅开启cfg(test)+显式环境变量诊断并在测试helper带实际method名，不改变生产错误输出或扩大选例，以定位下一处真实失败。

Host恢复Gateway单例修正后的`runtime-gateway-reuse,cas-recovery-only-admission`两项PASS；Settings采用已有forRuntime(owner)，关闭再打开同一Runtime继续共享busy和原操作身份。先前commit三项结果复用。P6首次prepare在创建case前因源分析副本已有空WAL/SHM拒绝；基库仍为P0已确认完整Backup字节b480…，WAL0字节，设备原件未变。保留这些协调文件，另核无当前reader和固定原件SHA后按已知完整基库复制，不通过删除sidecar规避。所有新分析只读immutable连接。

Runtime attempt4（54.791s）准确定位两项均在library.sync.log.commit拒绝`manga.clearRevision`，而非启动、解密或发布CAS失败。核生产迁移DML后补该空单例，并完整核schema-only单例缺口：reader_document_totals、chapter_cache_totals、search_relation_state按各自生产迁移的原始空值补齐；不是在业务open中修库。原2项下一次仍为唯一Runtime执行范围。

只读复核同时发现State/Journal/Log虽flatten保留未知字段，公共整形save仍可接受丢失未知字段的调用参数，terminal active被新operation替换也可失去旧未知事实。本轮补统一持久写事务内的原事实保护：同身份旧shape遗漏的未知字段从原事实补回；显式冲突值拒绝，旧operation未知事实不能嫁接新身份；新增1项准确storage case验证三层未知事实及拒绝后的原payload保持，涉及普通save/observed save和commit边界，不扩展整套同步测试。

Storage attempt5新增唯一case `sync_unknown_facts_survive_all_state_writers_or_reject_atomically` PASS（22.064s）；其内部覆盖46/47、三持久入口、committed/retired、三层遗漏/冲突/身份替换/删除、事务拒绝后payload/marks/epoch保持及冷开。普通路径Cow借用，只有遗漏需补才复制；observed复用原SHA检查raw，新增一次serde解析；install新增一次旧payload读/解析，encode前释放旧typed。性能成本没有用“无额外开销”掩盖。
Runtime attempt5两个准确log_v2 case全部PASS（127.641s），前6项REUSED。至此本轮19个不同storage case与8个不同Runtime case均有准确通过依据（各批时间/源码/旧失败分别保留，不冒称一次全量通过）。主线冻结后进入真实新旧维护构建矩阵；尚未构建新Native/HAP或进行原VM后证。

P6新代冻结Core输入fp `137ba2927c9df6c056de69e40c438818678d3761b2279a438cf02626c9846ef4`，真实new runner构建PASS（31.45s），不可变SHA `31b2a7c6ca7ff6669f720d64feebf538e21025ef1d0508075271f51cfb32a8cb`；与旧runner采用完全相同薄harness字节，生产源码/二进制不同。历史original第一attempt在旧进程完成第一轮写后被分析器“退出后必须无WAL”的错误前提中止，尚无往返兼容结论；原step stdout、case DB/WAL/SHM与失败日志保留。子进程退出不保证SQLite已checkpoint，观察必须按实际DB+WAL只读事务读取并验证DB/WAL前后字节，不删WAL/不只看base；修复分析器后用独立attempt输入，不覆盖已写case。

执行顺序调整仅用于利用主线回归完成后的资源空档：P6历史分析器和维护副本准备仍在进行，main生产输入已固定137b…，先构建该候选Native与同输入inspector；不将构建当作P6通过，原VM安装仍等真实维护矩阵结论。入口为既有`build-harmony-napi.sh`、随后`build-storage-inspector.sh`，分别使用规范共享资源锁/现有target及明确DevEco Native工具链；嵌套仅快照、实际arm64 Native编译/绑定证据和host inspector编译，无额外host smoke、全量门禁或HDC。若P6导致生产变更，本候选失效须如实另建，不能挪用旧字节。

Native attempt1 PASS：Rust release 9m07s，随后实际C++ NAPI编译/链接成功。Native未strip SHA `f2eb26f9245415fbb1e7bf18f9022ad01fd1eca25d857bc407f338608d736f72`，31,447,848 bytes；Core buildId `2462dbea6aff586ca32013bd433b84a661efb64d0b26f54651e270622686eee9`。最终inspector PASS（1.46s），binary SHA `e351bd4e67306fa96a9f149f5eebee74f4bd315711c0edc0c7e93ac397d1cef5`。Native/inspector/Host bootstrap均绑定Core fp137b…与原合同SHA `22d7e41722c66ff342ba4c21d52282c3df817ecc5aa012d201a328bae1e474be`（Native伴随合同文件自身SHA为另一层绑定，不混称原合同）。sync-native首次被本轮维护Cargo活动资源锁拦住，未覆盖；自然释放后attempt2 PASS，恢复前像在私有native-sync/sync-EYQFqx。无HDC操作。

独立旧维护runner构建PASS（33.96s），源码fp `ce9182f4b50beaa7a798bfae091e9c3354ac83d7a0bf89ae02bade7219b49b59`、binary SHA `5a1b6c91d4b9629754548ac48af6d1ce64c29255c71763d4ed21c9d24b8db25f`。可审阅派生补丁及来源记录在`docs/maintenance/storage-compatibility/`；历史源/bin保持。companion revision1误访问public observation的私有字段导致编译FAIL，保留原harness/manifest/log；revision2只用public typed state事实及独立只读SQL raw SHA，两代共享同字节harness SHA `4d1d3f69ed78628b12a5b57d22609a1f1912f23ca13fbfa4bed65df2dc37d33d`，分别编译PASS。未为测试公开生产私有字段或改变Native输入。

候选HAP attempt1 ArkTS编译FAIL（23.388s）：RecoveryDialog使用的scrollBody/viewportHeight接口未在main公共ReaderDialogSurface接入，其余出现既有warnings，未签名/发布。修复保持公共消息宿主，精确接入已有受限滚动实现，公共组件以WindowCoordinator安全区/键盘和既有spec计算高度，删除feature重复硬编码viewport；默认auto分支、main操作区测量/间距/可访问性保留。只重建HAP，不重编已固定Native、不扩展其它门禁。

候选HAP attempt2 PASS，run `20261030T115757Z-fce869a1-fcc6b246`；signed 213,495,668 bytes，SHA `2ae71b7c68d7cf566eb111e65bd6a2639b042c316dd53de349616501b0bd1217`，指定minliny_HarmonyOS证书验签PASS。包内strip Native SHA `65768bc5ce3f8e91f8fab5922241b9a3c390c50eff91aed689cb6467a7762eca`（24,773,120 bytes），bootstrap资源与候选合同/Native配对已绑定。全部构建fence通过，仍有ArkTS warnings；不称warnings清零，不把build当设备通过。不可变manifest在`.reader-artifacts/hap/20261030T115757Z-fce869a1-fcc6b246/manifest.json`。

历史original-attempt3完成旧写→新写→旧写→新冷开4轮PASS，旧真实首次46→47迁移如实记录。独立维护矩阵original-46亦4轮PASS：两代所有打开仍46，DDL/cookie、原pending字节及列明业务行保持、合成标记身份稳定；这才是维护构建正常open不迁移的证据。未知字段typed写入、fresh44和新先46/47入口仍在后续各独立case，不以这一个通过覆盖它们。

P7实际覆盖前已重新核原Emulator PID44900仍为Mate90Pro、本机HDC listener74437仍127.0.0.1:8710，实际socket至127.0.0.1:5555 ESTABLISHED、route为lo0；清8个代理环境并NO_PROXY=*后规范租约list确认目标Connected。无服务/VM重启，无其他目标动作。待P6完成后canonical install只消费上述准确manifest，内部一次停止态一致快照/准入及签名检查；后续仅启动前探针三身份、原46书架与位置一次保存/冷开、原pending保持及原动效必要场景。普通读写已代码侧通过，设备只回答Native/ArkUI/设备持久性边界；无真实远端同步或新导入。

维护new-first-46及fresh-44四轮均PASS；fresh44由生产open创建，随后两代普通打开都保持44，明确无sync表/mark/epoch，没有凭空造同步能力。历史unknown-attempt2完成4轮，普通CRUD/raw扩展域保留但原旧typed decoder明确两次拒绝librarySync.state，结果为PARTIAL_KNOWN_OLD_TYPED_REJECTION/compatibilityPassed=false；旧字节缺陷保留，未改写成维护通过。维护unknown46四轮CRUD通过，rev2附加restore断言失败；代码侧定位P0已有resource restore fence先拒libraryMetadataRestore.legacySnapshotAdapterRequired，而harness错误地期待后续pendingOriginalSync。rev3改为精确真实fence，并清楚标记后续pending guard未触达；其生产保护另有已过专用case。rev2失败case/bin保留，rev3独立命名，不重跑已过CRUD。

维护unknown47同样4轮CRUD通过、保持真实47与narrow clock。r3 companion旧维护进程在120s时限被回收；一次1s进程sample明确CPU在debug sha2::soft SHA256而非设备/SQL阻塞（unknown47-companion-sample.txt），Native为release，不能据此报告App性能。故r4保留同字节harness，只用Cargo原有profile覆盖将上游sha2包opt-level=3，独立binary/identity/完整命令；不改变production source/lock，不提高120s时限。失败的46/47各自4轮证据直接复用，完整DB+WAL Backup到独立companion-only输入后只补未过的typed两代写入。其输入完整sync语义与P0+准确三层unknown全等，payload.marks仅容许生产load派生前/后的两个精确合法形状；真实mark表及所有其它字段严格不变，输出必须与精确全表派生mark相同。无反复重跑CRUD、无删除原fence/改游标。

P6完成：维护original-46/new-first-46/fresh-44/unknown-46/unknown-47五项均有真实四轮CRUD/冷开通过依据；unknown46/47的附加两代typed写入分别由`case-companion-only-unknown-46-r4-attempt3/result.json`与`case-companion-only-unknown-47-r4/result.json`补齐PASS，原四轮REUSED。完整原sync已知字段、三层unknown、精确派生marks/原pending/实际恢复fence均保持；不存在以历史旧decoder失败冒充维护通过。中间Backup cookie跨物理库和Python tuple/JSON array的仪器化错误均保留失败attempt后修正；同一新副本内cookie/DDL/clock仍严格核对。r4旧维护/新companion binary SHA分别`0750b983fd1f67e38395b79793929884b0ff52af2f988ff2abd6dc0be331aabd`、`8bdd27a89aaf4ff9e07dbbbf26ff518aa8c19dbd27da03b5dc58d9111f6209f8`。这些是Storage公开API与真实数据副本证据；Runtime/Host原操作继续已由定向case另证，未发真实远端同步。VM的/data可用1,911,068 KiB，足够本次213MB候选；原VM未替换。

P7覆盖安装PASS（deploy-vm-6460677a198b-20261030T122157Z.json，dataPreserved=true），实际Reader hilog的Storage bootstrap identity三项与候选完全一致。普通书架、既有本地volume书第五章可读；一次实际翻页50%→56%，应用force-stop后UID进程确已消失，再普通启动与打开原书，实屏/布局仍56%及同段落。首个打开后过早截图仍是书架，后续实际阅读布局/稳定实屏才用于冷开判据；不把早图当失败或通过。日/暖/绿/夜纸色分别实际RGB F7F3EA/F2E8D3/E3EBDD/2B2823，切换须等异步准备完成再关闭，瞬时早图不作最终颜色判据。设置的继续原同步入口读取后显示原未决与核对入口，未点击远端核对/上传；原完整payload最终仍需后证快照核。

动效剩余待答仅为Native展开途中返回与减少动态效果。当前通用设置真实开关checked=false；已有方法级100/300/600ms证据复用。专用官方Emulator -instance Mate90Pro -screenshot -screenshotPath已实测请求约92ms、稍后写出完整1280×2832 PNG；此耗时不是帧时间。下一最小取证在同一本机server租约内执行一次设备uinput点击原书卡→sleep0.3→Back，专用VM截图有界5张（私有reverse-observe.mjs）；只按实际中间像素判可见运动/退场，脚本时刻/PNG完成不冒充设备输入间隔或GPU帧时。若未捕获中间态则保持相应视觉项OPEN，不循环换范围。没有新VM、实际远端同步或新导入。

本次有界reverse采样不能判PASS：HDC后台输入回执耗时1177ms，截图在其后才开始（receipt如实列1735–3464ms完成），五图先书架、后正文、后title纸面，后续稳定态为书架；没有同一request/设备时钟锚，不能由它反推300ms真正反向或生产race。源码核对：Index仅route=reading且open请求仍在才进入同id reverse；Transition在挂载时用ACTIVE uptime建timeline，host sleep不等于timeline时间。唯一未决问题是Back处理时open请求是否仍为同一未完成请求。
因此只新增content-free ReaderShelfMotion本地诊断：Index与Transition记录request数字ID、设备uptime、route/direction/reversed/fadeOnly/reduceMotion、局部generation及生命周期phase；无逐帧日志、无书名/URL/book/source ID，try/catch不得改变业务。现有Index/timeline两准确入口复验，随后仅重建/签装Host HAP，Core Native与存储/Runtime/P6证据全部REUSED，不重跑。新设备只补该未决动效，不重做已过原书位置/主题业务。减少动态效果已通过真实开关false→true及开启后普通开/合回原书架；后续恢复false再做原动效。精确帧时间/物理真机仍OPEN。

诊断HAP `20261030T124531Z-fce869a1-6c2e9990` 构建、指定验签及第二次保数据安装PASS（signed SHA `513cd45586b865b8a0af3f4b9b1484121a4b9420a2096eb58c5dc988eb7501c1`，deploy-vm-6460677a198b-20261030T124654Z.json）；同Native/Core证据复用。原reduceMotion已恢复false，纸色恢复DAY。probe首次因output-dir误用相对路径在执行HDC前拒绝，改绝对路径后普通启动/书架布局取得，失败log保留。

新关联采样定位真实终态竞争（vm-motion-request/motion-hilog.txt）：request4在ACTIVE uptime16387483开始；16388309（826ms后）Back命中同一未完成open、Root接受reverse；Actor没有same-id-retarget，16388532仍以reversed=false/generation2正向完成。Back到达时作者时长660ms虽已过去，Actor终态尚未执行；这不是精确300ms采样，也不足以断言ArkUI永久漏Watch。确定缺陷在异步Prop/Watch尚未传到子组件时，旧帧只比ID便完成，Root又只按自己的最新reversed将旧正向ACK当成反向终态。不得将本场景记PASS。

最小修复范围仅Index/Transition及原两方法probe：Actor每次采帧/完成前同步读取Root当前请求并复用同ID retarget/generation防护，不让异步Prop更新成为终态正确性的前提；完成回执带Actor实际反向标志，Root拒绝不匹配的open终态。增加“Root已反向、Prop/Watch尚旧、旧末帧先到”的准确交错回归，保留100/300/600ms、fade/close/旧帧用例；不引入新时间轴或重置轨道。先运行这两个准确Node入口（无设备/构建/嵌套套件），通过后只需重建Host HAP并在原VM补同一个终态问题；Geometry、Core/Runtime/P6和已过主题/位置场景继续REUSED。物理真机帧率与完整中间像素连续性仍OPEN。

修复后两准确Node入口PASS（timeline0.490s、Index0.599s，真实回执在私有shelf-motion-race-fix/verification.json），只增加上述交错和错误方向终态ACK拒绝用例。HAP attempt4 PASS，最终run `20261030T125246Z-fce869a1-36c6ae0a`，signed SHA `5ca5746dc902d0ab41280c0730750f50b273a553e621dca8a749810854af7761`；第三次保数据安装PASS（deploy-vm-6460677a198b-20261030T125347Z.json），仍同Native/Core、指定证书、0.2.0/1000000。

原VM唯一补验PASS：PID10827/request4，transition-start ACTIVE16670817；Back/accepted16671362（545ms后）；same-id-retarget16671399（37ms后）且generation2→3；transition-finished16672016为reversed=true/generation3。普通布局随后回到书架。证据vm-motion-request-fixed/{motion-hilog.txt,correlation.json,after.json}；未把host sleep0.3冒充设备300ms，没有逐帧像素/FPS结论。旧失败日志保留。

最终停止态后证只正常force-stop Reader应用，原VM继续运行。当前进程的bootstrap与最终HAP资源三身份全等；原Host同步journal/config head/18,900,146字节ciphertext三个SHA均与P0相同。canonical inspect得到私有storage-deployment/5d7204ea-64c7-4ae7-9297-94d1a9b66ca5一致性Backup，逻辑DB SHA `2f35cb6114c6361ef5a44f78d2b9a26f4f8f7c73cad4a754f1f92c6b958981b6`，schema46/DDL保持。final-post-comparison.json实际PASS：原17书架身份/7进度身份保留，仅已操作的一条位置有合法落盘变化；完整sync raw payload/原operation/publishContent、11个身份/恢复/receipt等表原行与零mark均保持。该比较不等于全库每字段相等。为补足书源/书籍/书签高亮/资源归属原行，接下来仅在同一已核验的前后Backup对补9个未检查事实表（sources/source_books/books/bookmarks/book_highlights/content_edits/book_groups/library_resource_adoptions/manga_retention）的精确原行保留；不再次抓设备、安装、整库哈希或运行业务套件。

上述9表第一次比较在sources项FAIL并停止（final-post-user-facts.json）：原919个ID没有删除，新增70个；846个原source_json发生语义变化，顶层为bookSource（846）与name（14）。此FAIL保留，不当作全行相等通过。源码确认普通启动本就执行installBundledBookSourceCollection，当前source.supply.v1分支允许随包供给更新；仍需按其实际业务owner核对原用户enabled/explore、自改规则及未知字段保护，不能因新增定义存在就直接放宽。剩8表尚未进入，下一步只补这些未执行项，并在已有停止态前后副本上定位sources，原VM保持停止App/运行VM，不重取证或恢复覆盖。

补8表原行比较：books/书签/高亮/编辑/分组/manga_retention保持；source_books 3677身份全保留，其中6条仅kind标签和lastChapter更新；资源adoptions54→47，其余47行逐字段相同，撤销为6个bookCover与1个toc，7个全部处于已变化的source定义范围（6个也有book metadata变化）。这是既有library_restore_sources_UPDATE等触发器的授权失效语义；不能将不再匹配新source的旧grant写回。原行全等FAIL保留，范围差异与真实用户事实分开记。

source-post-analysis.json直接核最终HAP内冻结index/item摘要，846变化精确为828退休+18升级，70新增全部匹配当前供给；原919身份无删除。退休中86个enabled true→false符合既有退休策略，18升级enabled不变、全部enabledExplore不变，既有RULE_FIELDS指纹未发现自改。此解释不能代替字段保留：18升级均没有content/metadataCorrection登记，普通candidate替换确实抹掉包内缺席的原字段（customButton3/eventListener3/variableComment2等）；未能证明这些字段是否用户自添，但已证未知字段保护有缺口。原值仍完整存在P0，不做整库回滚。

因此P3补一处最小业务owner修复，仅remote/source_supply.rs：provider拥有的规则字段保持原子替换、不盲深合并；已有分发元数据和显式previousUnfingerprintedFields控制的删除保持；其余原顶层candidate缺席的未知/兼容字段保留，退休政策不变。必要入口仅reader-runtime libtest target编译一次，执行remote::source_supply::tests::{source_supply_upgrade_preserves_unknown_and_compatibility_fields,source_supply_upgrade_explicit_old_value_controls_removal,source_supply_preserves_user_rules_disabled_state_and_deletions,source_content_correction_v6_to_v7_preserves_explore_edits_and_deletions,source_default_correction_preserves_user_document_and_source_fields}五个准确名称。两个新增覆盖未知/兼容字段、原子规则与显式删除/冲突，三个既有覆盖用户编辑/开关/删除、探索及仅默认值修订；共享build-resource-lock、既有Core/target与aarch64-apple-darwin缓存，无其他套件/设备。原存储/P6/Runtime存储场景行为未受此供给owner变化，保留REUSED；Native与HAP因真实Core输入变化需重建并重新签装，不能冒用旧身份。原VM缺失字段只拟通过现有source import补回非provider-owned字段，不回退新规则、不恢复失效grant。

恢复通道复用现有“从在线链接导入”→Host HTTP→Core source.import。只在本机127.0.0.1启临时单路径只读Node HTTP server，经官方HDC rport映射到准确VM的localhost；不向LAN/外网开放，不绕过HDC租约。SDK -h已确认rport支持；lease此前仅未登记此verb，现与fport同样绑定原server/target/禁自动服务/30秒预算，冲突server/target仍拒绝。仅执行`node tools/test-reader-hdc-lease.mjs --case command-policy`（纯command admission及假HDC拒绝子进程，无真实server/设备）；其它lease case REUSED、不扩测试集合。真实映射执行前后列已有tasks，仅移除本次准确task，server在导入后关闭；失败不重发import，不清应用数据。此HTTP文件通道不改变HDC客户端→server→设备的直连路线。

上述HTTP方案在真实执行前撤回：代码审计确认online JSON没有Provider私网authority，现有HttpExecuteHost/NetworkRoutePolicy明确拒loopback；不放宽网络策略。未启动server、未建立rport、未走网络导入。两个HDC文件的临时verb/测试改动已精确撤回，SHA与前像相同（3d32e11b…/44053bda…）；此前command-policy PASS只是该临时版本的历史工具证据，不当作产品新增功能。

source_supply 5/5准确case PASS：一次编译28.548s、总31.119s，Core fp `878c6ee5010d0dcb45fe755b988f32ca305d193abb462ea6b51e72b2e508fbe5`。独立私有冻结源码在P0 Backup副本执行实际公开RemoteState/dispatch_remote的18项source.supply再source.export PASS，薄example只调生产方法、不另写合并算法。失败的harness CoreError类型映射与“18项都必须需补”错误断言保留；复用缓存仅补未完成部分。实际16项补55字段，2项仅provider-owned缺席，不作补写。线上专用recovery-import-active-only.json为191,482 bytes，SHA `180e4af094a090b58f66d4abe2b386cbee3cbfeb7570f0bacdfe7be95a0c40a5`。每个补值来自真实新upgrade并与P0同值，所有当前post既有字段逐值锁同；原18产物/无补两项单列保留。旧phase1整份source_supply与修复前逐字节相同，附加维护补丁及provenance在docs/maintenance/storage-compatibility/phase1-source-supply-preservation.*，在临时副本应用后与新main同字节；没有改写旧P6证据或声称旧HAP已重编。

系统本地文件通道实测可用：真实目录/storage/media/100/local/files/Docs/Download；仅新增唯一Reader-source-field-recovery-20261030.json并核远端SHA一致。试图chgrp被文档文件系统拒绝，失败回执保留；随后只读stat确认系统自动赋FileManager UID20001006/GID1006/mode660，不再改权限、不重发文件。正常JsonImportDialog→DocumentViewPicker→浏览/我的手机/Download选择该文件，实际Reader日志21:16:01 PID11380明确Book-source import completed count=16。首次UITest screenCap取得pixelMap失败即停，已取得布局保留；一次官方Emulator实例截图确认当前页面，无循环采样或业务重发。数据是否冷开保持仍由最后候选后的同一准确副本检查回答。

新Native canonical build PASS（约8分钟），未strip SO SHA `aa9ef0663c9dd4468bf875289513a03ad33571c61e98b6bfa327c0d7cbca510c`、31,449,184 bytes；Core buildId仍2462dbea…，但真实输入fp由137b变878c，故必须同时核三身份，不能以buildId相同冒称旧Native同字节。合同SHA22d7…不变。inspector PASS（Cargo0.40s），其生产storage代码未变，binary SHA仍e351bd4e…，伴随身份重新绑定878c。下一步只canonical sync-native/HAP iteration/local-signing/contracts-scope none，之后原VM保数据安装、实际bootstrap、原56%读路径与16项字段冷开后证；存储/P6/其他Runtime、Host motion/纸色/reduce场景按实际未影响owner REUSED，精确300ms/帧率/真机验收仍OPEN。

最终交付：sync-native/HAP均PASS，run `20261030T132057Z-fce869a1-1971f2d3`，signed 213,495,088 bytes，SHA `a3e0bc1ed81efdcdab5d29431d1e645e521326819773c4601808d390f4a564aa`；包内Native SHA `58abb7fe38109c10d8558707dd62c6923478b0718d9fa3fb5af4cb9b6a28b34c`，指定证书验签PASS，0.2.0/1000000未变。第四次原VM保数据安装PASS，deploy-vm-6460677a198b-20261030T132208Z.json，实际Native三身份匹配878c候选，普通打开原书仍56%和原段落，没有再次翻页。contracts/SDK smoke/full NOT_RUN，warnings仍有，不称清零。临时Download恢复输入在实际count16完成后核SHA再精确删除，未动其他文件。

最终一次停止态canonical inspect目录为私有storage-deployment/1f704684-b84c-4490-bd81-1c59bb40cea4；final-source-post-comparison.json PASS：原v46/DDL、17书架/7进度、合法已保存位置、原完整sync payload/operation/publishContent、11个身份/回执等表原行、零marks保持；原Host同步3文件SHA同P0。source-import-recovery/final-active-post-comparison.json 18/18 PASS：16实际恢复+2无补项、55字段来源与预期全等。final-post-source-owner.json PASS：最终989身份全同供给后状态，恰16条只补55字段、其余973文档及所有已有字段不变；resource_adoptions47条全部逐字段相同，没有复活原先7条。原“全行相等”失败/已发生供给业务更新不改写为PASS。真实远端原同步未派发，原pending保留可继续的代码/本地证据与设备只读入口分别记账。

后证后只正常启动回书架：首次固定3秒后的布局仅见状态栏，不能记首屏就绪或启动耗时PASS，原日志保留；源码启动等待独立probe/业务Runtime，后续一次只读布局确认普通书架就绪，无新启动/重启/重装。原VM继续运行。当前闭环是实现、本地定向验证、签装与限定VM场景；精确300ms Native输入/逐帧视觉连续性、GPU帧时、物理真机、真实远端同步和用户验收仍OPEN。其余平台未构建/安装，main/其他dirty WIP保留，未提交。

### 用户反馈卡顿，转真机安装（2026-10-30）

用户明确反馈当前实际效果很卡，并要求在真机安装查看。这是性能问题反馈；前述VM流程/同ID反向PASS不等于流畅度通过。本轮复用已验签的run20261030T132057Z-fce869a1-1971f2d3，不因改目标重建或重跑本地已过方法/Storage/SDK套件；只执行交付实际需要的不可变包/指定签名、准确物理目标/boot、停止态数据准入与覆盖更新，安装后再独立核Native/普通书架与最小开合观察。

代码侧初审：Transition:179–199逐帧写尺寸/圆角/坐标/角度/透明度，:324–331同时使用clip/renderGroup/旋转及动态阴影；Index:4511–4515在carry变化期把reader opacity写到根State，turn后carry固定为1会被阈值去重，不能说660ms每帧全树重建。LocalReadingExperience:1612–1715挂载时并行恢复几何/字体/首屏读取，:2825–2832只门控正文显现。时间轴采样为常数算术无逐帧I/O，keyed actor按request ID保留，并非每帧新建Image。布局、首次准备和GPU合成均是待用实际目标区分的候选，尚无trace，不提前选根因。

真机取证唯一问题：同一现有文本书开一次、正常返回一次，卡顿集中carry扩张、turn旋转还是正文首次准备；采样时不并行循环dump/screenshot。需要数值结论时先核设备支持的官方Profiler，再短录同一动作，不用截图/阶段hilog推FPS。当前私有physical-bookshelf-motion-20261030记录现场：本机server74437监听127.0.0.1:8710、VM仍Connected；无活动HDC客户端/设备probe，未改服务或VM。物理无线候选ref2a10c2b26b06为Unknown，尚无Connected USB真机，先作一次有界直连TCP/实际路由诊断，不能据Unknown推断手机未授权或签名错误。

直连诊断：该候选TCP经en0路由，单次2503ms超时；本机server经lo0可列出现存VM，未重启HDC。已向用户请求接入/解锁USB真机或提供当前无线调试地址；之后一次新发现仍只有VM Connected、候选Unknown，没有对不可识别目标运行BM/安装/应用操作。当前physicalInstall/Native/interaction/performance均未完成，不能记真机PASS。已发布HAP复用，不重建、不改动画参数；设备连接是当前必需外部条件。

Profiler准备仅为后续最小取证，不作为当前安装前置：本机SDK的trace_streamer为x86_64 Mach-O，--help执行报bad CPU type，未安装系统组件或自动补工具。官方OpenHarmony hitrace文档支持有界文本trace；实际手机连接后仍需先核该目标的help/categories，再决定一次短录。没有在VM代跑真机Profiler，也没有从公开文档推断当前手机性能。

用户提供新无线地址后，按准确用户目标一次直连TCP219ms成功，route为en0；旧HDC listener74437的tconn在30s客户端时限到期，实际server→目标socket停SYN_SENT，尚未到HDC握手/授权/签名阶段。tconn客户端仍占租约时误派一次list，被入口在执行HDC前拒绝；拒绝log保留，没有将错误文本解析输出当目标状态。已确认该客户端退出后无其他HDC/probe活动；旧服务已运行约31小时，PPID1。普通procinfo权限不足，相关诊断保留；责任上下文未取得前不将其写作已证根因。下一动作只在同一8710锁域做一次有界kill→核旧listener退出→受控前台-m恢复，若其他listener抢先出现即停止；不改端口、不改VM或App数据、不循环重连。

服务恢复第一次kill已正常结束，确认旧listener退出，但foreground helper前被Emulator自动拉起的PID29599抢先占用；helper按合同拒覆盖，service-recovery.json真实记FAIL，没有再次杀服务。新进程监听相同8710、其代理环境只有NO_PROXY/no_proxy且为*；现场复用这个新服务再对准确用户目标tconn一次，62ms退出0，随后同租约list确认Connected。实际server→真机socket已ESTABLISHED，server→VM仍Connected，route en0，未重启/改变VM。新物理目标脱敏refa4b8b206176b；param核phone/boot.completed=true，设备身份回执私有保存。连接恢复不冒充安装/性能通过，责任PID/jetsam无权限取得，不能写为已证根因。接下来仅执行既有准确manifest的canonical physical install（内嵌验包、签名、boot/SceneBoard、停止态一致备份、candidate-matching inspector、紧前复核与覆盖/启动），不额外重复独立verify/inspect或已过业务套件。

physical install attempt1在数据采集阶段exit3：`storage shell did not return its success sentinel`，尚未执行HAP覆盖。普通shell的guarded ps/sentinel完整成功，排除普通shell换行问题；官方`hdc shell -b`却以exit0输出`[Fail][E003001] Invalid bundle name`。BM另证该包实际存在、debug=true、0.2.0/1000000，不能把错误标签当作包名或签名错误。OpenHarmony官方HDC文档列出的原因包含App未启动/调试沙箱目录未挂载；与本次force-stop后现象一致，具体卸载时机尚待确认。原collector的error regex未显式识别该Fail码，故最终报sentinel而非底层错误；没有放宽结束标记、UID停止态或快照要求。私有日志`install-physical-attempt1.log`、`sentinel-diagnosis.json`、`sandbox-diagnosis.json`及完整BM保留。

后续唯一待答问题是能否通过官方Native调试命令获得只读沙箱访问，而完全不启动Reader业务Runtime。先核`aa process -D ... -S`的官方实现和设备help；未证明前不以`aa start -D`推定业务暂停、不正常启动旧App来补前证、不安装辅助App、不绕过canonical准入。实际物理安装、启动、开合/帧时仍未完成；原数据未清除，原VM保持运行。

官方主源核得aa process的MSG_SPAWN_NATIVE_PROCESS分支只exec指定Native命令，普通分支才MainThread::Start；设备help已支持。拟唯一最小现场试验：系统`/system/bin/true`以Native调试方式进入沙箱，退出后再次严格核全App UID无进程，再读官方bundle sandbox。此命令不加载Reader代码/业务Runtime、不打开用户数据库；不维持helper、不改变原UID停止态准入。Huawei实际mount是否保留仍由本次观察回答；若不可访问即停。来源为OpenHarmony ability_command.cpp、app_mgr_service_inner.cpp、ace_adapter.cpp与sandbox_debug_mode.c，精确链接保存在私有试验回执。

只读Native试验完成：`aa process ... -D /system/bin/true -S`返回成功；命令退出后全UID进程清单严格通过，官方bundle sandbox可读。再执行与collector相同的force-stop、再次核全UID无进程，sandbox仍可读（native-sandbox-experiment.json：READ_ONLY_NATIVE_MOUNT_RETAINED）。没有保持Native helper或启动Reader业务Runtime；本次设备上的挂载事实已观察，不外推其他ROM。此前数据采集访问前提已恢复，下一次仍原样运行canonical install，所有数据/签名/兼容性条件保留。

physical attempt2 canonical install/launch PASS，receipt deploy-physical-929ff1c0644b-20261030T140807Z.json，dataRecheck PASS；pre为已知44、generation1、无需迁移，完整私有备份a71aeaa8-743c-45ed-91ce-7ec79175d70d。此前手写脱敏refa4b8b206176b与pipeline的SHA派生不一致，后续以canonical ref929ff1c0644b为准；准确目标始终为用户提供的同一目标，未改变路由。初次启动观察的tail80日志遗漏更早的bootstrap行，导致私有first-look判FAIL，不能称Native或App失败；现有同PID日志已证普通阅读ready，且存在未由本agent发起的三次tap/back。下一次只按同PID查询准确bootstrap行、读取当前静态布局和Profiler能力，不重装、不重启、不派发重复业务操作。

用户追加确认：多个步骤都卡，放大过程看不清，并明确要求放大后半程即开始翻转，覆盖原先串行carry→turn安排。已证源码TURN_START=CARRY.durationMs=260ms，确实是完全放大后才开始turn；这是确定的节奏缺陷。四次实际全动效开返都有终态，open665–667ms、close约750ms，但不是FPS通过；准备/持久化在开场并行，不证明其持续阻塞。现有证据不能区分UI布局与RS合成，因此只拟一次6秒ace/graphic/sched/app基线，开同一本书并正常Back，不做途中反向或多次采样，不并行dump/screenshot；若Profiler忙/失败即停。

第一次baseline前提检查发现当前前台已非Reader，按预定条件停止，未启动trace、未派发任何触摸。前台其它App内容不纳入Reader证据。后续仅正常将已安装Reader带到前台，再核可见书架准确卡片，采原计划唯一一次6秒trace；这是修正前台前提后首次实际采集，不重复已成功场景。

Foreground基线批次完成6秒trace，但shell的kill -0被权限拒绝，守卫在触摸前停止：只算空闲trace。保留失败；改用ps完整PID清单观察，不发signal，后续才首次派发动作。实现保持总660ms，carry延至520ms、采用对称(.4,0,.6,1)曲线；turn从260ms开始覆盖放大后半程，turn260/handoff140/fade180不变。固定target布局，以scale/translate和图片补偿维持等比Cover；圆角仅改渲染clip，固定阴影模糊半径以alpha收束。独立不旋转纸面在carryEnd520ms全窗且不透明，才允许close握手，保留同timeline反向及generation/FADE。

本次验证入口逐项限定：①test-book-opening-transform直接调用生产geometry，已PASS，保护双层scale净等比/裁切/端点；②test-book-opening-timeline提取真实actor方法及SDK parser，保护新重叠轨道、固定layout、全窗不旋转纸面covered边界、反向/旧回调/FADE；无构建/设备/其他测试嵌套；③check-header-geometry仅--checks bookshelf-opening-geometry-and-clock，保护整窗host及新渲染/owner连接，只读源码无业务套件。Index业务owner未改，其已有准确方法证据REUSED，不重跑。源码验证通过后仅canonical Host HAP iteration/contracts none/local签名；Core878c及Native字节不变，复用inspector与Core/P6/存储证据。

实际action trace已成功传回17.1MB，但继续卡片中部命中详情入口，motion仅back-entry route=detail；它不能算封面动效基线。保留真实slice分析，其中UIVsyncTask最长116ms/布局88ms只是该详情场景的wall时长，非FPS、非封面根因。下一次准确命中已观察到的“阅读”按钮文本bounds，进入阅读入口后以完整motion阶段核场景；不重复错误的卡片中部点击。日志包含历史业务failed时，采集器不应把成功读取本身写为失败，原批次FAIL保留且不重复安装。

定向验证：transform helper准确不变量PASS；timeline revision1/2均PASS，revision2补固定布局/字体不再逐帧发布、连续标题缩放及旧图片回调owner守卫；header仅bookshelf-opening-geometry-and-clock PASS，其余NOT_RUN。独立review指出clipShape仍逐帧更新，所以不宣称全程只有GPU合成；实际流畅度仍待证。原在线入口两份action均仅detail/back，没有开合phase，明确为CAPTURED_NON_MOTION，不当基线或改善数字。

Host修订包PASS：run20261030T142332Z-fce869a1-286f585c，signedSHA16d50fc3ac24f487d41e37be74e71064a1e35e3151d96bb19044743d170e790d，213516961 bytes；Native仍58abb7fe…/Core878c，0.2.0/1000000不变，指定证书验签通过。首次preflight因共享target的另构建配对覆盖FAIL；恢复6类原输入均逐字节匹配旧immutable provenance，独立只读reference/recovery-receipt保存，未改旧manifest、未覆盖共享target、未重编Core。第二次canonical HAP成功，contracts none，其它套件NOT_RUN。下一步只消费此manifest进行同一准确真机保数据安装。
