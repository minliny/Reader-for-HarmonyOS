# 开发者模式组件边界修复（2026-10-13）

用户反馈：开关打开后曾只有顶端横线并拦截交互；修复全屏布局及点击透传后的截图仍只标出了几个公共壳层，没有展示页面内文字、图标、按钮及列表行的边界。当前 HarmonyOS/Core 为未提交并行工作树，历史安装不能证明本次改动。

代码侧定位：旧 overlay 只消费手工 registry；新增扫描使用 API 24 的 `getPageRootNode()`，但项目最低与目标 SDK 是 API 23。异常后回退到 registry 仍只显示几个外壳。另有几何异常中断整个子树、忽略 1vp 细组件、错误扣除显示器原点、默认 `getChild()` 展开虚拟列表的问题。

修复使用 API 12 的 `getAttachedFrameNodeById()` 从 overlay 向上找根，按 API 15 的 `getFirstChildIndexWithoutExpand()` / `getLastChildIndexWithoutExpand()` 与 `getChild(..., NOT_EXPAND)` 扫描当前已挂载树。几何不可查询的节点继续检查后代；排除 overlay 自身；有正尺寸的可见节点均绘制。坐标为节点窗口 vp 坐标减 overlay 窗口 vp 坐标，尺寸从 px 转 vp。单层 Canvas 绘制边界，避免创建数百个调试布局节点；关闭开关停止定时扫描。异常安全限制为 10000 个访问节点或 128 层，命中时明确显示“扫描未完整”。

手工 registry 与六个公共壳层/顶栏的登记注入已经移除，组件无需逐个接线。新增精确诊断架构策略只准入本文件的调试 Text 与测量线，旧业务字号/背景预算和共享 producer 契约未提高。开关默认、存储回读、未知写入恢复、旧四字段数据兼容、恢复默认与跨页面返回的 fixture 同步覆盖第五个设置字段。

可覆盖范围是同一 ArkUI 树中已挂载、有实体布局矩形的组件。纯逻辑/零尺寸节点没有独立矩形；Canvas/XComponent 内部绘制、独立系统窗口不属于当前树，不据此宣称已覆盖。

最小运行时未决点：API 23 上查找/向上遍历实际是否可获取页面内节点；边界坐标是否对齐；启用时点击和滚动能否透传。代码不能证明 SDK 运行时的实际树形和输入派发，仅在当前已连接 VM 核对这三个问题。当前只读发现目标产品 model=emulator、phone、boot.completed=true，未发现物理机，不把 VM 结果记作真机验收。

本地生产方法探针通过：API 23 入口；不可测量 wrapper 后代；1vp Divider；隐藏及调试子树排除；窗口原点/px-vp 转换；稳定节点移动重绘；1601 个子节点完整绘制；关闭开关取消 timer。架构登记、共享 producer、常规字体、阅读布局、页面 Chrome 与详情 SDK 定向合同通过。

第一次完整流水线保留 FAIL：29 个合同在当时的手工登记版本或旧四字段设置 fixture 上失败，完整运行日志 `/tmp/reader-developer-bounds-20261013-pipeline.log`，未发布 HAP。后续移除登记并修复新增字段 fixture；第二次完整门禁另记，不把局部重跑提升为全量通过。

第二次完整门禁发现遗漏的书架设置 SDK 五字段写入期望仍为四字段，已停止本轮自有进程组，保留 `/tmp/reader-developer-bounds-20261013-pipeline-final.log` 及逐项日志；没有发布产物或复用已通过项。补齐书架/Index/书源设置 fixtures 后，额外5项定向均通过。旧切口合同仍期待正文紧贴完整 cutout 边界，已按当前动态信息栏占满实测 lane 的要求，精确核对 lane=cutout bottom、contentTop=lane+8vp（同时覆盖非零 cutout top），200几何及真实 reader cache/signature/reflow 场景通过。生产几何未在本次重新放宽。

DevEco 原生开发构建签名校验通过，HAP SHA256 `62eed1e5d982bae536ddb2283d5be3f46511fc1ee50a05496d2be2777ae5a105`，输出来自本次 Hvigor signer hook，不是 immutable 交付产物。当前 VM 保数据覆盖安装与启动通过。书架截图扫描到92个节点，设置页43个节点，通用设置60个节点，均显示文字、图片、按钮及容器边界；开发模式开启时点击底部设置及进入通用设置成功。截图 `/tmp/reader-full-bounds.jpeg`、`/tmp/reader-settings-bounds.jpeg`、`/tmp/reader-general-bounds.jpeg`。路由切换后扫描更新间隔250ms；初始即时抓取的旧边界截图不计稳定几何证据。

以上仅是当前 DevEco 开发包的 VM 绘制/点击证据；当前物理机未连接、用户验收开放，不能称真机安装或全应用全状态视觉验收。第二次 canonical 产物和安装待完成后追加。
