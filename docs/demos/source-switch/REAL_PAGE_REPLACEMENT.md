# 换源真实页面替换：根因与纠偏记录

日期：2026-09-30。状态：本地分支纠偏实施中；真实页面尚未获得本轮 HAP、VM 或用户验收。

## 问题与根因

用户在换源页面设计讨论后要求在本地分支生成 demo，并随后要求安装到当前 VM。此前实现把这一要求错误收窄为单独的模拟展示页：另建页面、虚构书名与来源、定时发出模拟结果，通过专用 debug 冷启动入口直接打开。Reader 原有换源入口仍使用原页面，因此用户从正常应用进入换源时，看不到拟定的新界面。

根因是实现对象和验证入口选错：将模拟页的可编译、可安装和可启动作为了进展重点，没有落实“替换应用内已有换源页面”的实际目标。旧截图只能证明独立模拟页显示，不能证明真实换源入口、真实发现结果或换源事务已经接入新界面。

## 源码与旧产物身份

- 纠偏开始时分支 HEAD：`f625f42c`（VM 安装与独立入口启动记录）。该提交是本轮变更的源码基线，不是旧 HAP 的构建提交。
- 旧 HAP 源码提交：`85bd874af3978fc254b476774a27a16e99c92b4c`。
- 旧 run：`20260930T134349Z-85bd874a-be8b8f52`。
- 旧 signed HAP SHA-256：`f8bc451fb306ad095d0c93b4b9ff580974cd1dbc7c9b61640b45b0382b628559`。
- 旧构建与安装证据：[signed-build-result.json](signed-build-result.json)、[vm-install-result.json](vm-install-result.json)、[vm-demo.jpeg](vm-demo.jpeg)。这些记录保留为历史事实，不升级为真实页面替换后的验证证据。
- 工作分支仍为 `codex/source-switch-demo-20260930`；分支名称不改变当前真实页面替换范围。

## 当前实现目标

保留 Reader 正常启动和实际业务状态，在两个现有入口中共享新的 `SourceSwitchWindow`：

1. 详情/书架上下文中的入口：`Index` → `SourceSwitchPanel` → `SourceSwitchWindow`。
2. 阅读中的入口：`Index` → `ReaderShell` → `SourceSwitchPanel` → `SourceSwitchWindow`。

页面读取真实书名、作者、当前来源及阅读上下文；候选来自已有 `SourceSwitchGateway` 和书籍获取协调器。首次没有候选时显示“正在查找”，结果持续增量发布；查找结束仍为零才进入无结果状态。刷新保留已有候选，使用稳定来源/书籍身份更新和点选，避免重排造成点错。

延迟采用真实搜索请求耗时，当前语义包含调度等待；标识为搜索耗时，不称为正文首段或漫画首图打开时间。候选出现并不证明正文或首图已成功读取。缺少本轮可比较耗时的候选不伪装为零毫秒。

点选沿用实际获取、章节解析、换源提交、首帧确认及失败恢复事务，不新增模拟成功回调，也不绕开原有阅读数据保护。持续搜索过程中允许点选，随后撤销本轮发现所有权，迟到结果不得改变当前选择。

新页面复用搜索页的 `SearchSpinner` 原生加载效果。页面不提供 DEMO 场景按钮，不使用虚构书名、来源或延迟，不设置专用 debug 路由。小说与漫画信息来自实际媒体上下文，不能靠模拟按钮冒充真实漫画业务已经交付。

## 已撤回的独立入口

已移除本分支新增的 `SourceSwitchDemo.ets`、`SourceSwitchDemoFixture.ts` 及其专用入口测试。`EntryAbility.ets`、`ReaderControlVerificationLaunch.ts`、`main_pages.json` 和原入口测试已准确恢复到 `ed0b03c2` 父提交内容。原有 motion/renderer 诊断入口保留，正常启动继续进入 `Index` 并初始化真实业务。

浏览器设计稿可以保留用于回顾动态过程，不能作为应用内替换完成的证明。

## 全页宿主与系统栏接线审计

以下是当前宿主代码的只读结论与实施要求；在完成接线前不记为通过。

- **顶部安全区只消费一次。** `Index` 在非阅读路由的根 Stack 已增加 `appContentTopInset()`；`ReaderShell` 则边到边绘制、不继承该 padding。共享全页组件若无条件再次增加 safe-top，详情入口会产生双重顶部空隙。应统一宿主几何，或显式传入顶部安全区是否已由宿主消费；不要写固定 VM 像素值。
- **移除旧居中弹窗宿主。** 两处入口原来都有居中容器和可点击遮罩。全页换源需要覆盖内容区的实色背景与明确返回行为；旧遮罩点击关闭逻辑不能继续覆盖列表。阅读组件保持挂载，关闭换源恢复同一阅读会话，不重新创建阅读页。
- **系统栏颜色与新页面一致。** `ReaderShell.overlayStatusBarUnderlay()` 原来在换源显示时也以阅读主题重画状态栏，且位于 zIndex 10；这会盖住新应用纸色页面顶部。全页换源时应退出这条阅读主题 underlay，目录自身的既有行为继续保留。
- **临时系统栏所有权需连同策略切换。** 当前 `ReadingExperience.windowChromeActive` 跟随 Shell 可见性，换源仅切到继承阅读主题的 overlay chrome。建议换源显示时令阅读 chrome 暂时不活跃，复用既有 `onWindowChromeActiveChanged()` 路径申请 App chrome 与 App window policy；关闭后恢复阅读所有权。不要永久改写用户的沉浸阅读或隐藏导航栏设置，也不要只改图标明暗而遗漏其下方纸色。
- **底部和横向安全区来自同一快照。** 共享页面应读取 `ReaderWindowCoordinator.metrics()`，消费当前交互底部安全区及左右安全区。观察 metrics revision，适应状态栏恢复、旋转与窗口变化；避免把原居中弹窗的 translate 偏移保留下来。
- **返回和事务边界继续由 Index 管理。** 原 `onBackPress()` 优先处理 `sourceSwitchVisible`，`closeSourceSwitch()` 对正在提交或需回滚的事务已有约束。页面返回按钮继续走此回调，不自行调用独立页面 router 返回或清空真实阅读状态。

## 本轮验证及未决项

撤回独立入口后，以下 6 项定向本地回归通过：`test-reader-control-verification-launch`、`test-reader-optional-entry-memory-launch`、`test-reader-startup-selected-font`、`test-reader-startup-reading-settings`、`test-reader-startup-boundaries`、`test-system-file-open`；相关 diff 空白检查通过。生产 entry、tools、scripts 和 AppScope 已无撤回的专用入口及 fixture 引用。

这些结果只覆盖入口恢复和原启动边界。真实共享 UI、流式候选、搜索耗时排序、点选事务及全页系统栏接线，需要以本轮最终源码继续进行对应定向验证。HAP 构建、VM 覆盖安装、两个真实入口交互、阅读数据保留和用户验收分别保持 OPEN；旧 `85bd874a` 产物及独立页截图不能证明新源码。

## 首轮全量门禁（fd8a78b3）

385 个合同在 90.70 秒内执行，383 通过、2 失败，未进入打包。已定位为本次页面替换后的两处旧结构约束：`test-reader-control-p0` 仍要求 Shell 只有 2 处 reduceMotion 透传，新换源页成为第 3 处；`test-svg-provenance` 检出旧弹窗专用 close 图标已无生产引用。处理方式是更新第三个真实消费方断言、移除无用生产图标与对应配方/清单，不降低资源来源门禁。修复后需重新执行整批合同和正式构建。

## 编译检查（99849860）

修复上述两项后，385 个合同全部通过（92.96 秒）。正式 ArkTS 编译发现 Index 新增的两处候选对象 spread 不符合 `.ets` 的 `arkts-no-spread` 限制（4896、4907），32.31 秒后终止，未发布产物。修复为由既有 Gateway 的 `.ts` 层复制并清空搜索计时，Index 仅消费该结果；不修改原候选对象和其它上下文字段。需重跑定向语义检查、合同及规范打包。
