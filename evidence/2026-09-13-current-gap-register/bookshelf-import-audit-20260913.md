> 历史快照说明（2026-09-13复核）：本文保留当时日志/判断，不维护当前待办。当前实施合同见 [READER_REPAIR_SPEC](../../docs/READER_REPAIR_SPEC.md)，实时状态见工作区 DEVELOPMENT_BACKLOG §11。下文旧“CODE FIXED/未实现/需决定”不自动继承；尤其胶囊时值、Night不存在/强改不透明、More=书签/整理=CRUD、201固定按钮宽及整组翻页缺实现已被当前源码/Figma/原始用户决定纠正。

# 书架与导入页面代码审计（2026-09-13）

范围：书架列表书源/进度布局、筛选与检查更新、书架更多设置、导入文件选择/进行中/结果页面。先完成代码与历史设计文档审计，再实施本轮可定位修复；未进行设备取证。

## 已定位

- `BookshelfPage.ets` 列表第 4 行把书源和进度放在同一行的两个固定宽度 pill；书源名称已有 `sourceName` 优先逻辑，但未实现书源左对齐、进度居中，且有未读章时进度文本被替换为“更新 N 章”。`Index.sourceDisplayName()` 只查已加载的搜索/书源管理缓存，冷启动书架可能仍回退为 sourceId 链接。
- 筛选图标资源与历史 Figma `271:220` 路径一致，为空心描边漏斗；资源目录同时有 `bookshelf_filter_active.svg`（同路径、stroke 从 `#756F69` 变为 `#2D4A3E`），但 `sectionActionAsset()` 当前无条件返回默认资源，因此点击后 active 颜色不切换。这是代码已定位的问题，并非实心图标问题。
- “检查更新”使用 Button 最小高度 44vp，可能叠加平台默认 Button 内边距，造成视觉过大；filter 行的 `Blank()` 将其固定推到右侧。
- 导入结果面板固定高 636vp、结果列表 Scroll 固定高 410vp，导致单本导入仍占大半屏；结果项 success/failure 右侧图标已按状态绑定，左侧 `import_doc` 是文档图标。
- 文件选择面板中间 drop zone 没有点击回调，只有底部“选择文件”按钮触发 picker。
- `beginImport()` 先写 `importing` 状态再调用系统 picker，导致 picker 尚未返回时先显示“正在导入”；设计文档要求 picker 返回且实际导入未完成时才显示 importing。
- importing 面板只挂载三张静态 SVG，无旋转/入场动画；状态切换直接重挂载，无结果入场过渡。
- 顶部更多菜单“书架设置”走 `openSettings()`；列表右上齿轮和顶部更多的“分组管理”走 `openBookshelfManagement()`，但该方法目前只弹出一个“默认”ActionMenu 后刷新书架，**从未设置 `route='bookshelfManagement'`**，因此 `BookshelfManagementPage` 分支不可达。历史文档要求分组管理页可达，当前属于伪功能；设置页“书架与搜索设置”仍无目标页/具体功能，需产品决定。

## 建议方案

1. 列表第 4 行改成全宽四行布局：书源文本左对齐，进度独立居中；保留原字体与字号，进度不被 unreadCount 替换。
2. 检查更新改为显式高度约 40vp 的自绘 Row/Text，去掉 Button 默认最小高度和隐式 padding，并在窄宽度验证。
3. 结果面板高度按条目数计算并设置最大高度；仅超出可用高度时启用 Scroll。修正完成按钮为设计宽度与可用宽度 clamp。
4. drop zone 和底部按钮共享 picker 回调；拆分“选择文件”和“导入执行”时序，系统 picker 返回后再显示 importing。
5. 对 arc 做挂载期间连续旋转，结果页做一次性 opacity/scale/height 过渡，动画状态必须由真实导入 batch 驱动。
6. 书架两个设置入口暂保持分工，待确定“应用设置页”与“书架数据管理页”的产品定位后再实现具体子功能。

## 本轮已实施

- 已拆分 picker 选择与导入执行，选择器返回后才切换 importing；空选择直接关闭。
- 已接通中间选择区域点击，结果面板按条目数自适应并限制最大滚动高度。
- 已使分组管理路由可达、筛选 active 资源可切换、检查更新 chip 去除平台 Button 的隐式最小高度。
- 已将列表第 4 行 source / progress 独立定位，进度语义保持阅读进度；并增加书架 sourceName 异步预加载。

导入 spinner 的完整 Figma 时间轴仍未取得；当前保留静态素材作为低动效回退，需后续以明确时间轴补齐，不将其标为视觉验收通过。

## 设计依据

- `docs/IMPLEMENTATION_SLICE_A_B_001.md:283-292,359`：三态尺寸及 picker→importing 时序。
- `docs/FIGMA_FINAL_PUBLICATION_COVERAGE.md:30,152`：导入验证层级及设置页目标覆盖范围。
- `evidence/2026-09-12-new-ui-audit/ISSUES.md:N06,N08,N11`：列表四行/资源与筛选图标历史审计。
