# 消息样式实施对照

批准依据：`approved-scope-20261019.json`。源码起点 `5a01ec1cdbd5ec864046e1b9202963ead23a513a`；实施分支 `codex/message-ui-unification-20261019`。此表区分源码实施与原生验收。

| 原编号 | 已接入的呈现 | 主要宿主/组件 |
| --- | --- | --- |
| A01 | 有旧内容的刷新失败短反馈，保留原刷新入口 | BookshelfShell、DiscoverPage、SourceManagementPage、各设置页 |
| A02 | 原操作顶部浮层；核对、继续分开且保留原身份 | ReaderRecoveryNotice、SourceManagementPage、SourceToolsPage |
| A03 | 已确认写入后的普通读回失败短反馈，含漫画换源；保留原读取入口 | Index、LocalImportDialog、SourceToolsPage |
| A04 | 阅读/TTS真实待处理浮层，正常保存过程静默 | LocalReadingExperience |
| A08 | 分组共用表单框；原分组未决浮层在遮罩上方 | Index.shelfGroupSurface、ReaderDialogSurface |
| A12 | 启动等待/失败页态，保留重试/退出 | ReaderStartupRecovery |
| A13 | 书签/离线分别保留原事项、部分完成与待处理事实 | ReaderDirectoryRecoverySurface、ReaderFullDirectory |
| A14 | 动作随宿主选软色按钮、浮层小动作或局部文字动作 | ReaderRecoveryAction |
| B01 | 首次载入/失败页态、原生32vp加载 | BookshelfStatusContent、ReaderPageState |
| B02 | 真空书架与导入/搜索入口 | BookshelfEmptyCard、ReaderPageState |
| B03 | 筛选无匹配及真实清除筛选 | BookshelfPage |
| B04 | 原菜单/动作位置的忙态，保留原范围 | BookshelfMoreMenu、BookshelfMultiSelectPage |
| B05 | 分组页空/失败、短反馈与原事项浮层分别呈现 | BookshelfManagementPage |
| B06 | 详情/目录局部页态；移除后的本地书说明；原动作忙态 | LocalBookDetail、BookDirectoryPage、Index |
| B09 | 来源首读/空态、真实导入等待、普通短反馈与待处理浮层 | SourceManagementPage |
| B10 | 真实计数/当前项/停止与实时结果 | SourceToolsPage |
| B11 | 原写入待处理与普通读回分流；JSON原位校验；完整检测对象、独立序号、原日志及状态码 | JsonImportDialog、SourceToolsPage |
| B12 | 清理/恢复的等待、明确结果与未决事实分别呈现 | SettingsPage、Index |
| B15 | 保留清理范围、保护内容、书架/记录及容量事实 | SharedDownloadPage、SettingsPage |
| B18 | 设置首读局部失败、普通读回短反馈、真实保存待处理 | BookshelfSettingsPage、BookshelfPage |
| B19 | 筛选空/无章节/目录准备失败分别处理 | BookDirectoryPage、ReaderFullDirectory |

| 阅读补充 | 已接入的呈现 |
| --- | --- |
| C01 | 正文就绪后换源完成短反馈，保留2200ms生命周期 |
| C03 | 书签内容区32vp原生加载、原位空/失败，返回目录只切当前标签 |
| C06 | 同纸色书签图标、方向箭头、原阈值/释放/ACK |
| C07 | 已有搜索结果保留；同游标安全重放；明确失效仅提供重新搜索 |
| C15 | 上拉随手、未达阈值回弹，达标松手后翻章 |
| C17 | 透明轻边框、32vp图片失效图标；未知尺寸短单元格；已知几何保留；整张长图只在逻辑中点绘一次 |
| C18 | 书源/章节获取失败使用页面级状态，依据真实阶段区分；已有可读内容的普通失败短反馈 |

公共消息色板从 `Reader-UI/theme/registry.json` 生成，普通页面原色不改。标题17、正文/动作13、标签12；待处理标题14、内距10×12、圆角14，小动作靠右并测量换行。对话框内距17、圆角12、动作最小44。忙态保留标签尺寸并居中使用18vp原生加载，禁止用忙态冒充未知回执。

排除的类型/来源标签、已在书架、更新章数、阅读进度、状态点、无封面、正常播放器与换源候选卡保持原样；关闭模块不恢复。检测、导入和回执仍沿用原owner/generation/operationId/CAS及数据保护范围。

## 验证记录

- 页面与导入：`pages-verification-20261019.md`。
- 来源/设置/发现与框架后继：`source-settings-verification-20261019.md`。
- 阅读与漫画：`reading-verification-20261019.md`。
- 公共消息、主题、来源登记与完整门禁：`shared-verification-20261019.md`。
- 公共新增检查：`tools/test-reader-message-style-sdk.mjs`，含两动作、日夜色、18/32原生加载、忙态固定占位、旧动作不能借新代次，以及详情原位核对的runtime/nav/mount身份。
- 原视觉fixture保留；`message-style-typography-successor-20261019.json`锁定本次精确字体/原生属性，逐个保留普通控件的历史元组和出现次数，不把源码快照当原生视觉通过。

完整703/703、全工程编译、非增量构建、指定证书签名及manifest离线复验均PASS；成功run为 `20261018T182618Z-5a01ec1c-ffaa901e`。本次改动尚未提交，是iteration产物；未进行设备安装/原生交互或用户验收。完整身份与证据边界见 `shared-verification-20261019.md` 最终交付结果。
