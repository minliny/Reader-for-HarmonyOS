# 页面图标修复记录（2026-10-20）

本轮只修改下列四个页面的图标、颜色角色、声明的触控区域及可访问性属性。既有业务回调、选择范围、排序实现、下载动作准入及生命周期保护保持原样。没有在该子任务中构建、执行测试/门禁或操作设备；源码修改不能代替原生交互验收。

## 书架多选

文件：`entry/src/main/ets/features/bookshelf/BookshelfMultiSelectPage.ets`。

- 封面模式、列表模式各一个字体 `✓` 改成 `readerActionIcon('check', scheme)`，使用 14 vp SVG 与 `Contain`，继续放在原 22 vp 圆形中。图标前景复用公共 action 的 day/night `GREEN_INK`，选中圆底改为公共 `TOK_GREEN`。
- 未选底色/描边、封面和条目布局不改；两处选择事件仍由原条目处理，不给内层图标添加重复事件。
- 移除栏垃圾桶使用明确的 `reader_danger_trash` day/night 资源，文字同步 `TOK_DOWNLOAD_DANGER`。忙碌时原生 LoadingProgress、透明度及删除前重新校对可见选择集合的逻辑不改。

## 下载管理

文件：`entry/src/main/ets/features/downloads/SharedDownloadPage.ets`。

- 书籍、章节两处原生 Checkbox：选中底色继续 `green`；补充 `unselectedColor(muted)` 与 `mark({ strokeColor: greenInk })`。未选框用 muted 保持在普通 surface 上可辨识；greenInk 是强调底前景，不能同时拿来画普通底上的未选框。
- SDK `component/checkbox.d.ts` 声明 `unselectedColor` 控制未选边框；`component/units.d.ts` 的 `MarkStyle.strokeColor` 控制勾选笔画。未改变原生勾选形状、尺寸及 onChange 处理。
- `operationsActions()` 的暂停/下载、关闭、删除图改为 typed `readerActionIcon`；列表自身 `visualIcon`、状态图、失败说明、retry/range/confirmation 流程保留。
- `presentationIsCurrent`、book/chapter captured identity 和 `actionAvailable` 等准入不改。

## 书源管理导入按钮

文件：`entry/src/main/ets/features/source/SourceManagementPage.ets`。

- 保留原 40 × 40 vp 视觉、18 vp `source_add`、12 vp 圆角及原背景角色。
- 复用 `ReaderPressFeedback` 提供原生按下/释放反馈，声明居中 44 × 44 vp `responseRegion`，补 `focusable(true)` 和 `BUTTON` role。
- 原 `onAddSource()` 回调保持原样，没有增加第二个提交入口。
- 既有 `source_add` 为强调底上的 onPrimary 资源，本项不把它误染成普通菜单前景。

## 漫画书籍目录排序

文件：`entry/src/main/ets/features/bookshelf/BookDirectoryPage.ets`。

- 改用 `manga_directory_sort_ascending/descending` day/night 资源；原 Figma 排序轮廓不变，前景沿 `mangaDirectoryColor('accent', scheme)`：日 `#425D45`、夜 `#B9CEB1`。
- 保留 16 vp 图形、32 × 32 vp 可见底和 8 vp 圆角，声明 44 × 44 vp 触区；复用 `MangaDirectoryPressFeedback`，补焦点和按钮 role。
- `ascending`、`toggleSort()` 及其列表位置/过滤逻辑不改。
- 相邻搜索框原间距为 5 vp，触区水平使用 `x=-5,width=44`，避免居中 `x=-6` 侵入搜索框 1 vp。纵向 `y=-6,height=44`；不扩大父级布局。该声明的边界与父级外命中仍需区分源码规则与原生实际行为，不能仅凭 responseRegion 属性宣称设备已通过。

## 资源协作与证据边界

公共 `ReaderActionIconResources.ets` 由根任务维护，有限 typed 图标种类供动作面板和选中勾使用；这四页没有复制另一套动态染色器。

资源任务生成 `reader_danger_trash` 两项与漫画排序四项，并记录对应配色/路径来源。本子任务仅消费资源，不覆盖其生成器、主题登记或 provenance。

原图精度、颜色矩阵问题和 SVG 参数边界见 [precision-analysis.md](precision-analysis.md)。这里不把新源码、旧真机图或未执行的检查混写为通过结果。
