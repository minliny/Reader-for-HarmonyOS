# Reader 统一动作弹窗实现（2026-10-14）

本 worktree 在现有弹窗框架内扩展动作样式：`ReaderActionMenuSurface` 是唯一动作渲染器，支持原有 `menu` 以及 `grouped`、`quick` 三种有限变体。`ReaderActionSheetContent` 只保留兼容入口和业务数据类型，实际委托给该渲染器，不再绘制另一套行、文字和背景。

动作内容的尺寸节奏由 `ReaderSurfaceSpecs.ets` 的 `resolveActionSheetSpec()` 管理；漫画动作弹窗的外框和标题栏接入现有 `ReaderBoundedSurface`／`ReaderBoundedSurfaceHeader`，通过 `reader-action-sheet` 规格统一。宿主继续负责位置、唯一遮罩、返回、动效与关闭生命周期，业务 owner 继续负责动作准入和回调。

## 两种样式评估与实现

| 样式 | 适用场景 | 优点 | 代价 | 当前接入 |
| --- | --- | --- | --- | --- |
| 1. 分组列表 `grouped` | 阅读页动作较多、下载与书架动作同时出现 | 扫描路径清楚，危险动作可以独立分组，状态说明有稳定位置 | 高度更长，低频动作需要滚动 | 漫画阅读页默认 |
| 2. 快捷首行 `quick` | 书架和阅读页的高频入口 | 首屏可直接触达前三个动作，适合更换书源、刷新、详情 | 首行横排文字空间更窄，动作超过三项仍需列表 | 书架图书操作弹窗；阅读页可由 `ReaderShell.mangaMoreMenuVariant` 显式切换 |

两种样式共用动作数据、图标槽位、禁用语义、状态文案、危险色、箭头和可访问性文本。推荐默认使用分组列表；快捷首行保留给动作顺序稳定、前三项使用频率明显更高的入口。

## 当前接入

漫画阅读页「更多」保留现有业务能力：

- 更换书源、重新打开本话／本卷、漫画详情；
- 下载本话、下载全部章节、下载管理；
- 移出书架或加入书架。

「下载管理」是一级导航动作，带箭头并进入现有下载操作面板；面板内部仍显示当前书籍／章节的任务状态。「移出书架」继续显示“退出阅读，前往详情确认”，沿用既有详情确认流程。刷新在离线或章节未打开时显示原因并禁用，回调前还会重新检查当前弹窗和动作状态，避免陈旧点击绕过准入。

书架图书操作弹窗复用同一个内容层的 `quick` 变体，保留原生 `bindSheet` 的宿主尺寸和身份门禁；多选、书籍信息、编辑分组、移除书架仍由书架 owner 派发，并保持一次派发、陈旧 presentation 和卸载拦截。

漫画下载操作面板与目录中的下载操作入口复用 `grouped`，动作来自现有 Gateway 的真实状态，区分下载任务与存储清理，删除与清缓存采用危险色；加载、失败、重试和任务业务约束由原 owner 保留。

书源切换实际调用链 `ReaderShell → SourceSwitchPanel → SourceSwitchWindow.novelDrawer()` 的外框接入同一个 `ReaderBoundedSurface`，使用 `source-switch-drawer` 规格，保留现有宽度上限、抽屉高度、圆角、主题色和转场。换源列表、搜索／进度状态、选择事务和安全区仍由原组件负责。旧的 `source-switch-window` 入口继续兼容原消费者，实际抽屉不回退到旧的 300×385 小弹窗。

更多面板使用内容自然高度，手机上限为可用视口的 0.75；更多与下载操作显示滚动提示并使用 44vp 的关闭触达区域。书架的固定原生宿主中增加有界滚动，分组标题和操作行使用最小高度，允许系统字体放大。

## 本地验证与问题记录

基线提交为 `493e631560088f342daef6a8f2535b2cfeec2907`。本次代码审查发现并修复：

| 现象／触发 | 定位与修复 | 证据与边界 |
| --- | --- | --- |
| 同一动作 ID 的状态替换后仍显示旧文案、旧按钮可点击 | ForEach 行读取当前动作；提交时重新查 enabled | SDK 属性 runtime 验证同 ID 文案、禁用原因与旧回调拒绝；真实原生节点移除不在此探针范围 |
| 应用或阅读背景切到深色时，文字和箭头仍按日间显示 | 封闭 scheme 统一色彩角色与箭头资源 | 书架日／夜实际 SDK Text 色彩和字体断言通过 |
| 轻微下拉回弹后，更多动作全部被拒 | 分离打开 token 与动画 generation；准入用打开 token | 实际 openPanel → 20vp 拖动回弹 → 动作派发，以及重新打开后的旧 token 拒绝通过 |
| 离线、未打开章节、保存等待中身份替换，仍可能触发旧动作 | 明确不可用说明；关闭／保存前后校验当前阅读身份 | 更多真实按钮、章节／整书／管理入口、退出和身份撤销测试通过 |
| 分隔线超出宽度、标题和内容缩进不齐 | 有界分隔线宽度和宿主水平 inset | SDK 几何属性验证通过；物理像素布局待独立验收 |
| 独立 worktree 的邻接 Reader-UI 路径不存在；新 producer 未登记 | 只读邻接引用及精确 producer／consumer／spec 注册 | 架构和 Typography 门禁通过；历史 witness 与业务预算未改写 |
| Scroll 直接包含 ForEach 不满足 SDK 单子节点要求 | 增加一层 Column | 官方 SDK 转换无诊断，书架内容与身份回归通过 |
| 新动作内容与已有菜单渲染重复，漫画和实际换源抽屉仍自绘外框 | 收敛到现有菜单 renderer 和公共 bounded frame；兼容 facade 不再拥有样式 | 精确 producer／consumer／spec／delegate 注册；历史字体 witness 与业务预算保持不变 |
| 迁移到共享标题栏时遗漏原漫画标题 0～2 倍字体缩放边界 | 把缩放范围移入 drawer 规格，手机／侧栏标题统一读取 | 漫画 More／下载共享标题的实际 SDK 属性断言；物理大字布局仍属原生视觉边界 |
| 规格 registry 新增生产实值 import，旧 new Function 探针不能解析；共享标题栏手势端口缺失 | 测试辅助显式传入 `SOURCE_SWITCH_VISUAL`、SDK Gesture／PanGesture 端口；不修改生产行为和既有断言语义 | actions、书架和确认对话框探针能继续执行；漫画共享标题栏实际 SDK 回调转发验证 |
| 换源测试在嵌套 worktree 寻找邻接 Core 路径失败，Index owner 回归因此没有正确清理证据 | 显式绑定现有 Reader-Core-Native 根目录；保留原断言 | 两个 Core root 环境端口绑定后重跑通过；不是换源生产逻辑失败 |
| 漫画下载探针遗漏迁移后的外框方法，仍按旧顶层 child 查询下载内容 | 挂载真实公共容器／标题栏／下载组件／动作 renderer，并按实际子树定位 | 下载任务、清理与原 owner 业务断言全部保留并通过；`@Prop` 数组代理按公开业务投影核验 |

相关本地验证通过：共享动作内容、书架组合与原生宿主身份、漫画面板几何与动效生命周期、漫画下载动作与目录 Popup、换源实际抽屉组合，以及架构注册、Typography 与原生默认控件契约。当前框架收敛的命令与源码指纹见 `docs/architecture/popup-framework-reuse-registration-20261014.md`；首次实现记录见 `docs/architecture/unified-action-sheet-registration-20261014.md`。

本次框架收敛另外运行并通过以下定向检查：

- `node tools/test-action-menu-surface.mjs`
- `node tools/test-reader-action-sheet-content.mjs`
- `node tools/test-bookshelf-more-layout.mjs`
- `node tools/test-bookshelf-sheet-shared-composition.mjs`
- `node tools/test-bookshelf-native-sheet-owner.mjs`
- `node tools/test-manga-surface-sdk.mjs`（包含 More／下载共享外框、单次安全区、唯一遮罩、标题缩放边界）
- `node tools/test-manga-sheet-motion-sdk.mjs`（包含实际共享标题栏手势回调到原 owner）
- `node tools/test-manga-download-actions.mjs`
- `node tools/test-manga-download-popup-sdk.mjs`
- `node tools/test-book-removal-dialog.mjs`
- `node tools/test-json-import-dialog-real.mjs`
- `node tools/test-source-switch-visual-sdk.mjs`
- `node tools/test-source-switch-host.mjs`

换源检查显式设置 `READER_SOURCE_SWITCH_CORE_ROOT` 和 `READER_READING_RECEIPT_CORE_ROOT` 为 `/Users/minliny/Documents/Reader/Reader-Core-Native`。测试探针使用现有生产代码与已安装的官方 ETS SDK；原生排版、焦点、手势仲裁、实际合成帧和设备字体渲染仍不属于这些本地断言。

## 统一边界

统一的是公共容器、标题／关闭结构、主题与动作渲染规则，具体弹窗通过有限规格保留场景差异。恢复确认 Alert、书籍移除 Dialog、全屏目录和下载任务页面分别承载确认、长列表和任务进度语义，继续使用各自宿主。后续动作选择弹窗应新增动作数据和宿主绑定，复用 `ReaderActionMenuSurface` 和已有容器，不另建全局 ModalHost 或第二套样式框架。

本 worktree 从 Harmony 子仓库基线提交创建，未复制原 checkout 的未提交改动；没有执行 HAP、安装或设备验收。设备视觉仍需在目标产物绑定后单独验证。
