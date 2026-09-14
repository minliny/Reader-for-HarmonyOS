# PH48 / PH49 / PH55 阅读控制栏追加修复

日期：2026-09-14。源码审计起点：Harmony `9a8ef9a1`；用户最新实际安装版本仍是 `643bcaf5`。`14e814fa` 已构建但本轮开始时未安装。以下是本次工作树的代码与本地回归记录，不把当前源码或旧 VM 图当作已安装包的验收。

本任务未操作设备、HDC、VM、构建、安装或 Git 提交。问题总账由主任务维护。本范围生产与测试已冻结，等待统一构建。

## 结论

|问题|定位与本次处理|仍需保留的证据边界|
|---|---|---|
|PH48 小横条相对高度偏移|Figma 抓手顶距为 8.99/9vp、42×4；当前模型也是 shell 顶部 +9。原 Builder 另用 Stack 的 top 对齐及 margin9，存在两处几何来源。本次改为直接消费同一 grabber actor 的位置和尺寸，命中框保持 72×28、zIndex3。|没有用户所看 `643bcaf5` 的对应像素/布局证据，**实际设备偏移的具体根因未证明**。本项是明确消除几何双源，不能声称物理视觉偏移已验收。|
|PH49 Full 下拉不能关闭|承接横条触摸的整个 dock 在视觉 visibility 到 0 时立即 disabled / HitTestMode.None，彼时同一指针尚未 Up/Cancel。修为 heldPointer 存续时保持祖先可接收事件，终结后再失活；另修 Quick 关闭反向时过早跨入 morph 的同引擎边界错误。|生产方法、SDK 生成的祖先属性和事件回调闭环通过；原生触摸派发与实际手感是新包交付后证据，不冒称本地测试等同设备。|
|PH55 快捷章节进度条应连续调节|Slider 的提交复用列表选择的 close-on-commit 事务规则，导致成功换章即关闭。现在滑条事务显式携带 `closeOnCommit=false`；保留所有权、失败恢复、延迟提交和旧请求失效规则，End 与 Click 都可提交，Moving 只预览。|设备连续调节待交付后验证；目录条目/书签/搜索结果的原“提交后关闭”行为保留。|

## PH48：原稿与绘制位置

参考 `docs/READER_CONTROL_BAR_EXECUTION_REFERENCE_2026-09-05.md`，原始层级数据 `tools/fixtures/reader-directory-toolbar-hierarchy-20260905.json` 的 `I1689:1682;770:5330` 抓手为 top8.99、42×4；`tools/fixtures/reader-control-search-settings-live-20260905.json` 的 `I1692:3140;770:5330` 为 top8.99，`1938:5112` 对应收起按钮为 top9、42×4。

当前 `ReaderControlMotionGeometry.ts:76` 的输入轴 Full 为 screenTop+9，Quick 为 screenTop+fullHeight−quickHeight+9；`:123` 的绘制 actor 为 shellY+9。此次未更改顶距、轨迹、圆角、颜色、alpha、命中尺寸或展开时长。`ReaderControlPanel.ets:913` 起将可见条的局部位置设为 actor 减其命中父节点位置，绘制与触摸轴使用同一个几何模型；加入 `reader-control-motion-grabber-bar` 和 dock ID 便于后续准确测量。

已读取的旧 VM Full 图是 `implementation-vm-followup-20260913/reader-control-b17f29a4-20260913-auto-full.png/json`。JSON 的 dock 与抓手命中框同顶，图中可见条距顶约9vp。它仅能排除“所有版本/所有场景的顶距都已经偏移”这一笼统判断，不能解释当前已安装包的用户反馈。没有因此新增高度，也没有把命中框中心误认成可见条位置。

## PH49：输入链与反向边界

历史定义已经明确：执行参考第96–107行规定 Full 点击横条/收起按钮回 Quick，Full 下拉直接关闭整个控制栏，不先停 Quick、不要求第二次下拉。G-03 要求手指移出抓手后仍连续跟手，并允许同一指针反向。本次保留该定义。

实际调用链是 Panel grabber `onTouch` → `handleControlTouch` → 单一 `ReaderControlRuntime` → `ReaderControlGestureDriver` → `ReaderControlSessionState`；`acceptRuntime` 发布视图标量，只有合法终态通过 `commitVisualSession` 交还 Host。

1. `ReaderControlPanel.ets:944` 原 dock gate 为 `inputEnabled && frame.visibility > 0`。MR1 关闭轨道只有18vp；手指下拉超过18vp时，视觉已隐藏，但逻辑会话和 heldPointer 仍须等 Up/Cancel。旧父树却先禁用，使正常终结事件失去可达路径。本次条件改为 `inputEnabled && (visibility > 0 || heldPointerId >= 0)`，视觉 opacity 继续跟原轨道，结束后立即恢复隐藏态不可交互。
2. 父链复核：Panel 最外层 `:974` 的 visibility 由 `controlObscured` 控制，hitTest 为 Transparent，按视觉 v 设置的 accessibilityLevel 只管无障碍子树，不是触摸 disabled；LRE `:1728` 的 inputEnabled 来自生命周期/窗口/临时层与胶囊资源所有权，`:1899` 为 zIndex7 / Transparent；LRE 根部没有 v 的 enabled gate。`isControlInputEnabled():8487` → `ReaderControlHostSession.ts:26` 仅检查 mounted、exit、foreground、windowChrome、interactionBlocked、controlObscured。`ReaderShell.ets:169/220` 的祖先按真实路由 visible 管理，不按控制栏动画 v。因此未发现另一个按 v=0 提前禁用的祖先，且真实退出/遮挡的所有权禁用仍保留。
3. 新测试还定位同一引擎的反向缺陷：Quick 下拉22vp → 回到12vp → 再到25vp。旧 `closeIntoMorph` 只检查 expansion==0，不检查 MR1 是否已返回原捕获点，于是提前创建 hidden→Full 混合段，第二次下拉可生成 from/to 都隐藏的退化 dismiss，Up 反而恢复 Quick。`ReaderControlSessionState.ts:469` 现在要求 visibility 返回 `transition.from.visibilityProgress` 才跨入 morph。使用真实捕获值而非固定1，可保留从半隐藏恢复目标继续拖动的既有能力。关闭先被反向重走，不改触摸引擎、时长或速度算法。

本地红→绿依据：新增 SDK 根 Builder 探针直接读取生产 dock.enabled，并只在父树允许时转发真实生成的 onTouch；回放旧 gate 会在 held hidden 处失败。实际 Runtime 的旧反向序列也先失败（最后 location 为 Quick），更改跨段条件后通过。不是只调用裸 onTouch 绕过父树。

## PH55：提交事务保留控制栏

`ReaderControlPanel.ets:1659` 的 Slider 在 Moving 只写局部预览，End/Click 才执行 `onProgressChange`；没有每帧向父层提交章节。LRE `seekControlProgress():9249` 的精确全书页码和降级章节比例两条分支均进入现有 `selectChapterAnchor(..., closeControlOnCommit=false)`。

`ReaderControlSelectionTransaction.ts:10/54` 增加可选 closeOnCommit；只有明确 false 时禁止关闭，未提供字段的原消费者行为不变。该标记贯穿 `ReaderDeferredChapterSelection`、pending ticket、自动延迟重试、显式失败重试，仍使用原 controlOwnerRevision、选择 token、会话和正文 revision，未通过取消事务所有权来规避关闭。旧提交不能清除新 ticket，连续25→75→40的选章仍可独立完成；翻页结算期间延迟提交也保留不关闭语义。列表选章、书签和搜索成功后的关闭规则未改。

按协作要求另外只做 PH54 一处参数接线：LRE `openQuickReplace():8634` 将真实 `bookTitle/sourceId` 传入另一任务维护的 `createReaderControlReplaceState`；不修改其范围规则或编辑器。

## 本地验证与交付门禁

14组定向回归全部 exit0，原始回执见 `PH48-49-55-local-regression.json`：

- `test-reader-control-grabber-input.mjs`：真实 SDK 根 Builder、实际 Panel adapter + Runtime；7模块×Quick/Full反向；28条隐藏后停住2秒仍按着再 Up/Cancel；捕获可见度0.2/0.7/1下的真实 driver 回溯、原点跨段和剩余位移承接；Full点击回Quick；Moving/End/Click；真实 LRE admission；旧 gate / margin 两项负向变异被拒绝。原有 spatial 回归覆盖了这些数值的几何反算，新补 driver 用例覆盖的是不同的跨段策略，局部复跑通过。
- `test-reader-control-internal-selection.mjs` 与 `test-reader-control-selection-transaction.mjs`：真实 Host 提交方法、连续选择/旧回执/延迟事务、不关闭滑条、仍关闭显式列表选择、重试字段保留。
- `gesture-driver`、`gesture-continuation`、`spatial-path`、`resume-timing`、`runtime`、`input-routing`、`integration-events`、`session-state`、`host-session`、`stage-composition`、`stage-lifecycle`：原手势、混合恢复、CANCEL、速度只影响延续时间、七模块路由/点击收起与生命周期回归未退化。

SDK Builder 探针验证的是生成属性和回调，以及明确 disabled 父树下不派发子触摸的约束；它不模拟原生布局引擎、像素合成和系统触摸派发。PH48 实际像素偏移继续保留未证明边界。统一构建和安装由主任务完成；代码、本地、设备、用户验收分别记账。

生产冻结：`ReaderControlPanel.ets`、`LocalReadingExperience.ets`、`ReaderControlSessionState.ts`、`ReaderControlSelectionTransaction.ts`。测试冻结：新增 `test-reader-control-grabber-input.mjs`、更新 `test-reader-control-internal-selection.mjs` / `test-reader-control-selection-transaction.mjs`。本报告不宣称全量历史问题或设备验收完成。
