# 漫画完整目录工具区落地记录

参考为冻结的复杂目录 demo：`/private/tmp/reader-complex-directory-history-20261006/src/Prototype.tsx` 与 `prototype.css`。本记录对应独立 `manga-directory-native-20261006` 工作区的当前待交付源码，不表示主线、HAP、设备或用户验收。

- `BookDirectoryPage.mangaPage` 使用既有 52vp 浮动返回栏及整本下载菜单；书名为 24fp/34fp，计数为 11fp/17fp。
- 工具区不再套旧 126vp 卡片。共享 `ReaderSearchField` 新增有限 `mangaDirectory` 变体，提供 44vp 输入、13fp 思源黑体、17vp 搜索图标、清除和 IME 行为；定位及正倒序工具行保留 38vp 高、11fp 字号。
- 原生仍使用固定工具区和实测高度避让，demo 的摘要、搜索与工具随正文一起滚动。`mangaToolsHeight` 是可观察状态，v2 Grid 与回退 List 使用同一个 `safeTop + 80 + 实测工具区高度`。基准工具区为 175vp，对应 `safeTop + 255vp`。
- 当前章节底栏保留 48vp 与底部安全区；章节内容下避让为 `safeBottom + 72vp`。

代码侧预算测试发现：在 480vp 窗口、顶部安全区 48vp、底部安全区 34vp、双行书名导致工具区 209vp 的条件下，只剩 37vp 章节可视空间，不足以完整展示 44vp 网格。现将安全区以内可用高度不足 413vp 的书名限定单行，保留原字号和操作；完整书名保留在无障碍文本和详情页。较大窗口最多两行，实际文字和系统字号变化继续通过工具区高度测量更新避让。

`tools/test-manga-book-directory-chrome.mjs` 已通过真实 SDK Builder 与属性运行时探针：完整页面输入/定位/排序/下载入口可达，动态测量同步更新分页与回退避让，移除测量状态的负控失败；测试的 480/640/800vp 窗口及安全区组合保留至少一行 44vp 章节与间隔。既有 bookPage/sourceManagement/readerDirectory/readerQuick 输入变体的字体、几何和 AUTO 行高保持不变。`test-search-native-focus.mjs`、`test-manga-directory-entry-row.mjs` 亦通过。

该证据是源码、真实 SDK 转换及属性请求证据，不是原生像素、键盘实际遮挡或设备交互证明。固定工具区与 demo 滚动正文的上述差异，以及设备视觉效果，仍待后续验收。

完整项目门禁首轮发现一般书籍详情探针未注册新增共享漫画行，导致 SDK 报 `10905204`；`BookDirectoryPage` 老方法探针也未带入新的漫画布局方法。修复统一复用既有 `manga-directory-entry-row-probe.mjs` 的真实 SDK 子组件，在一般 Builder 和详情 SDK 组合入口接入，不为空子组件跳过验证。小说目录的 `publishProjection` 只在 `contentKind === 'manga'` 时计算漫画布局，新增负向断言确认小说的出现、搜索与排序不触发该计算；详情空书籍状态进入普通分支。

一般 BookDirectoryPage、详情滚动/操作稳定性、删除、书架物理反馈、加入/取消回执、获取返回稳定性、阅读 Entry/Index SDK、阅读路由、漫画进度投影、元数据、主题与错误消息的针对性回归通过。详情 SDK 还实际挂载共享漫画行，验证角标、原始章节索引以及目录事实更新后旧回调失效。完整项目门禁和产物结果仍由总交付记录独立记账。
