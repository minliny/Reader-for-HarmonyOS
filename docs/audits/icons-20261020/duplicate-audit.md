# 重复图标与同功能多风格审计

> 后续实际清理已完成：14个基础族、27个相同字节别名及其生产消费者已退役，清理完成时429 SVG；剩14组为明确保留的主题/状态角色。其后[日夜可读性补修](night-coverage.md)新增3项专用资源，当前432 SVG。详见[实际清理及保留依据](duplicate-cleanup-references.md)。下文456 SVG与34字节组为清理前审计快照，保留用于映射来源。

2026-10-20。本次是对“重复图标、尤其箭头和筛选”的只读补审。沿原 `resource-index.json` 重新读取当前 SVG 字节与源码；只新增本报告和 `duplicate-audit*.json`，不改生产代码、资源、测试，不构建或操作设备。TTS 上一/下一项候选已由用户选择 C，资源 agent 已完成更新。本补审记录最终字节，不实施额外生产修改。

**存在资源别名重复，也存在同功能多风格；两者与同位置叠绘不同。** 当前456个SVG中，原413个里401个保持、12个按用户选定TTS C更新，另有本轮角色修复新增43个；新增角色图不能为“去重”而重新借用原场景错色资源。已确认的目录工具栏叠绘已由本轮授权修复移除。

## 全量盘点与判定方法

| 层级 | 当前结果 | 含义 |
|---|---:|---|
| 原索引 / 当前资源 | 413 / 456 SVG | 最终快照，不含6个PNG；PNG标题/纸纹等不当成重复交互图标。 |
| 源码 | 498 ETS/TS | 官方ETS AST读取；677个完整app.media字符串、420个资源名，另有68个裸名候选；含动态条件及已核对模板helper。 |
| 完全相同字节 | 34组、76文件、42份额外拷贝 | 33组跨基础名；额外原始SVG约34,755字节，不是签名HAP压缩后收益或性能测量。 |
| 忽略颜色和根尺寸、保留线宽/端点及方向 | 118组 | 57组跨基础名、61组仅同基础名变体；保守XML候选，不是像素等价判定。 |
| 另忽略线宽/端点 | 116组 | 57组跨基础名；trash/close等线宽差异单列。 |

使用标准XML解析，将同viewBox比例的坐标按宽度归一至24；忽略paint具体色与root width/height，但保留fill/stroke是否存在、透明度、元素顺序及方向transform。忽略clip/defs仅用于候选分组，渐变和裁剪不能因此判为等价。未做任意路径拓扑、旋转/镜像等价算法或截图像素比较；不同写法的相同轮廓可能未自动归组。完整路径、SHA256、配色、线宽、每个引用及分类见[机器清单](duplicate-audit.json)，当前AST快照见[源码清单](duplicate-audit-source.json)。

“当前”沿Index的组件静态构造链及实际消费者判断，仍不等于每个运行时分支原生通过；RSS/Discover/Sync按L0关闭，旧阅读模块按未挂载链单列。公共资源选择函数的声明与其消费者分开，不把有字符串当屏幕已经显示。

## 箭头：哪些可以收敛，哪些必须区分

| 当前图形家族 | 位置与动作 | 判断与建议 |
|---|---|---|
| 完整返回箭头：`book_detail_back`、`rc_arrow_left`、`reader_directory_back`、`reader_quick_back`、`search_back` | 详情、阅读、目录、控制子模块、搜索；48坐标/等效1.75 | 多个名称共享同几何，部分字节完全相同。可共用上游返回几何和有限ink/teal角色；小11vp返回、22/24vp顶部返回仍由各有限载体决定。 |
| 描边单chevron：`rc_chevron_left/right`、`reader_auto_full_chevron_*`、`reader_chevron_right/down`、`reader_appearance_make_chevron`、`source_group_chevron` | 上下章、前往、展开/收起、真实Select；48坐标/等效1.75 | 方向、语义与颜色角色要分开。right/down之间有真实90度transform，不是同方向重复；不要把“下一章”和“展开选项”合成同一个动作。资源可由一份上游几何+方向+角色产出。 |
| 下载chevron：`download_visual_chevron` | 下载管理自己的状态/来源/范围等入口；24坐标/2 | 与上组线重不同；适合统一形状/线宽候选比较，不能凭名称判成同一字节。部分实际下拉箭头已来自公共ReaderSelect；本地闲置helper不算新增可见一套。 |
| 漫画填充chevron：`manga_directory_*accent`、`manga_sheet_chevron_*`；返回`manga_directory_back/previous` | 独立目录、章节组折叠、下一章；15坐标filled | active/muted/显示箭头是颜色角色，原始filled与小说outline是不同风格家族。可共用漫画源几何；跨家族替换先按真实尺寸预览，不能只删同名相近图。 |
| TTS skip：`reader_tts_make_previous/next`与`*_quick` | 当前朗读快捷/完整，最终C为描边折角＋单根边界竖线，中间留白；当前名字沿用 | 原quick/完整有细微轮廓差异，旧单chevron又在保留组件。**用户已选择C，当前及保留共12个day/night文件已按同一选定几何更新；quick/full保留尺寸和颜色角色，本补审未再改生产。** |
| 双chevron组合 | 当前自动翻页上一/下一章；两个16vp图分别x=3/8 | 是相距5vp的有意双箭头，不是同位重复。可后续用已登记成熟double-chevron源实现单节点，但它不是必须为去重立刻修改的问题。 |
| 排序箭头：`reader_directory_sort_ascending/descending`、`manga_directory_sort_ascending/descending`、`download_visual_sort_asc/desc` | 小说目录工具、漫画独立完整目录、下载排序 | 阅读/漫画目录共享48坐标1.75几何但采用各承载表面的强调色；下载24坐标2为另一族。正/倒序必须保留状态，不能只因为上下箭头同属“箭头”而合并。漫画新增配方修复的是同组色源，不应去重回小说强调色。 |
| 到顶部/底部：`reader_directory_top/bottom`、`settings_gen_tap_top`；换源：`rc_switch_horizontal`、`reader_directory_switch`、`reader_action_source` | 当前目录滚动、设置入口显示、阅读及面板换源 | 同几何可共用上游源；滚动到边缘、设置说明、切换来源是不同业务，保留各自动作和有限颜色角色。 |
| `‹/›`、书签`↓/↑`、漫画章末`↑` | 漫画翻页为文字按钮；书签拖动反馈、章末释放翻章为手势提示 | 字形和SVG是另一条表现路径。翻页已有明确名称；手势箭头跟动作方向变化，不能全部统一为下拉。字体光学形状可列候选；不擅自改现有交互。 |

## 筛选：两种不同表达，用户确认保留

| 资源/家族 | 当前可达性 | 几何、颜色与状态 | 建议 |
|---|---|---|---|
| `bookshelf_filter` + active/night | 当前书架；真空书架使用普通态 | 漏斗，48坐标，等效1.75；muted普通态、green选态；当前单一Image按状态换src | 条件筛选的漏斗表达，保留正常/active/day/night。用户指出它与下载滑杆不重合，已撤回跨场景强行合并建议。 |
| `download_visual_filter` + night | 当前下载管理 | sliders横向调节图，24坐标，2；普通ink，与书架不是相同轮廓 | 更偏调节/条件配置，用户确认它与漏斗不是重复图标。保持原形和原入口，不列待统一缺陷。 |
| `discover_filter`、`rss_filter` + night | L0关闭 | 与书架漏斗同几何、1.75，分别配普通文字色 | 属历史别名，不能算当前三个页面都在显示。未来重新开放沿选定筛选几何/角色迁移。 |
| 书源状态chips、分组Select | 当前书源 | 文字chips及folder+真实下拉，不存在额外“漏斗图标” | 功能上都筛选，但并非重复图标；不为了统一图形强加装饰图标。 |

## 同处叠绘逐项复核

| 位置 | 本轮判断 |
|---|---|
| `ReaderDirectoryToolbar.tool` | 原helper Image +显式fallback的同位叠绘已删除；现每分支一个可靠显式资源Image。没有为旧probe留下第二层。 |
| `ReaderControlAutoPageContent.chapterButton` | 两图x=3和x=8，为双chevron组合；不是同位叠绘缺陷。旧AutoPagePanel/FullPanel也有同结构但未挂载。 |
| `SharedDownloadPage.statusButton` | 已下载展示Row与其他状态Button处于if/else；同资源两处代码不同时显示。 |
| `MangaReadingSurface.panelOverlay` | 宽屏close与非宽屏close条件互斥，不能按源码两次引用判重影。 |
| `MangaReadingSurface.directoryTools` | “完整目录”和“下一章节”各自一个右箭头，位于两个不同控件；不是同位叠绘。若收敛动作语义，可讨论前往/下章的不同图形，但不直接删掉某一项。 |
| 控制栏 morph/sourceOnly actor | 通过owner、opacity、clip及hitTest分工交接；允许同源在不同actor出现。静态引用数不能证明同像素重叠，未据此宣称所有运动帧已通过。 |

## 收敛原则

1. 一份固定上游几何允许多个有限颜色/状态角色产出；保留来源、许可证、主题配方和消费者映射。避免新手绘或全局单色tint覆盖多色图。
2. 同字节别名优先通过统一资源选择器/来源登记收口，确认全部动态模板和保留消费者后才退役旧名。先有迁移清单，再删除文件；不能仅因无直接`$r`就删图。
3. day/night、normal/selected、onPrimary、危险与muted状态保留；颜色相同恰巧字节相同也不意味着业务语义应合并。书架下载/设置下载/目录下载状态继续使用各自正确角色。
4. 箭头先按返回、前往、展开、上一/下一章、skip、手势反馈分语义，再统一各家族几何。书架漏斗与下载sliders经用户确认保留，不因同含“筛选”概念就判重复。TTS已按用户选择C实施，其余形状不擅自替换。
5. 去重主要收益是减少维护分叉；当前完全重复原始字节约33.9KiB，不能据此承诺明显帧率/内存改善。真正同位多节点可能增加绘制工作，但目录叠绘已修，其他不能仅凭相似图形推定开销。

## 附表A：全部完全相同字节组

34组完整列出，包含必要变体及关闭/保留代码；候选不是可直接删除清单。

| ID | 完全相同文件名 | 可达性 / 建议 |
|---|---|---|
| B001 | `book_detail_back`, `rc_arrow_left`, `search_back` | 当前静态构造链。返回共用源几何及有限角色；逐消费者迁移，不改返回逻辑。 |
| B002 | `book_detail_back_theme_night`, `rc_arrow_left_theme_night`, `reader_directory_back_theme_night`, `search_back_theme_night` | 当前静态构造链。返回共用源几何及有限角色；逐消费者迁移，不改返回逻辑。 |
| B003 | `bookshelf_compass`, `bookshelf_compass_outline` | L0关闭。导航/选择active与outline，onPrimary和muted保留；同字节别名先迁移消费者后退役。 |
| B004 | `bookshelf_compass_outline_theme_night`, `bookshelf_compass_theme_night` | L0关闭。导航/选择active与outline，onPrimary和muted保留；同字节别名先迁移消费者后退役。 |
| B005 | `bookshelf_library`, `bookshelf_library_active` | 当前静态构造链。导航/选择active与outline，onPrimary和muted保留；同字节别名先迁移消费者后退役。 |
| B006 | `bookshelf_rss`, `bookshelf_rss_outline` | L0关闭。导航/选择active与outline，onPrimary和muted保留；同字节别名先迁移消费者后退役。 |
| B007 | `bookshelf_rss_outline_theme_night`, `bookshelf_rss_theme_night` | L0关闭。导航/选择active与outline，onPrimary和muted保留；同字节别名先迁移消费者后退役。 |
| B008 | `bookshelf_settings_active`, `reader_replace_manage` | 保留未挂载、当前静态构造链。导航/选择active与outline，onPrimary和muted保留；同字节别名先迁移消费者后退役。 |
| B009 | `bookshelf_settings_outline`, `rss_manage` | L0关闭、当前静态构造链。导航/选择active与outline，onPrimary和muted保留；同字节别名先迁移消费者后退役。 |
| B010 | `discover_filter_chevron_theme_night`, `discover_source_chevron_theme_night` | L0关闭。同方向轮廓的不同角色；共用方向+有限角色配方，上一/下一章、前往、展开仍为不同动作。 |
| B011 | `discover_refresh`, `rss_manage_refresh` | L0关闭。刷新/循环共用Refresh几何而动作不同，保留teal/green/ink/danger角色，只共用上游源。 |
| B012 | `discover_refresh_theme_night`, `rss_manage_refresh_theme_night` | L0关闭。刷新/循环共用Refresh几何而动作不同，保留teal/green/ink/danger角色，只共用上游源。 |
| B013 | `download_visual_clear`, `download_visual_close` | 当前静态构造链。跨名同图候选；固定上游源可复用，逐消费者/recipe迁移后再退役别名，禁止直接删文件。 |
| B014 | `download_visual_clear_theme_night`, `download_visual_close_theme_night` | 当前静态构造链。跨名同图候选；固定上游源可复用，逐消费者/recipe迁移后再退役别名，禁止直接删文件。 |
| B015 | `rc_autopage`, `reader_auto_full_header` | 保留未挂载、当前静态构造链。跨名同图候选；固定上游源可复用，逐消费者/recipe迁移后再退役别名，禁止直接删文件。 |
| B016 | `rc_autopage_theme_night`, `reader_auto_full_header_theme_night` | 保留未挂载、当前静态构造链。跨名同图候选；固定上游源可复用，逐消费者/recipe迁移后再退役别名，禁止直接删文件。 |
| B017 | `rc_dots_theme_night`, `reader_directory_more_theme_night` | 当前静态构造链。跨名同图候选；固定上游源可复用，逐消费者/recipe迁移后再退役别名，禁止直接删文件。 |
| B018 | `rc_switch_horizontal_theme_night`, `reader_directory_switch_theme_night` | 当前静态构造链。跨名同图候选；固定上游源可复用，逐消费者/recipe迁移后再退役别名，禁止直接删文件。 |
| B019 | `reader_auto_full_play`, `reader_auto_play`, `reader_tts_play` | 保留未挂载、当前静态构造链。跨名同图候选；固定上游源可复用，逐消费者/recipe迁移后再退役别名，禁止直接删文件。 |
| B020 | `reader_auto_full_play_theme_night`, `reader_auto_play_theme_night`, `reader_tts_play_theme_night` | 保留未挂载、当前静态构造链。跨名同图候选；固定上游源可复用，逐消费者/recipe迁移后再退役别名，禁止直接删文件。 |
| B021 | `reader_directory_input_search_theme_night`, `search_mag_theme_night` | 保留未挂载、当前静态构造链。跨名同图候选；固定上游源可复用，逐消费者/recipe迁移后再退役别名，禁止直接删文件。 |
| B022 | `reader_directory_marker_check_theme_night`, `settings_select_check_theme_night` | 保留未挂载、当前公共配方、当前静态构造链。跨名同图候选；固定上游源可复用，逐消费者/recipe迁移后再退役别名，禁止直接删文件。 |
| B023 | `reader_directory_search`, `reader_quick_search` | 当前静态构造链。跨名同图候选；固定上游源可复用，逐消费者/recipe迁移后再退役别名，禁止直接删文件。 |
| B024 | `reader_directory_search_theme_night`, `reader_quick_search_theme_night`, `settings_row_shelf_search_theme_night` | 当前静态构造链。跨名同图候选；固定上游源可复用，逐消费者/recipe迁移后再退役别名，禁止直接删文件。 |
| B025 | `reader_directory_top_theme_night`, `settings_gen_tap_top_theme_night` | L0关闭、当前静态构造链。跨名同图候选；固定上游源可复用，逐消费者/recipe迁移后再退役别名，禁止直接删文件。 |
| B026 | `reader_tts_rate_theme_night`, `settings_gen_animation_theme_night`, `settings_gen_motion_theme_night` | L0关闭、保留未挂载、当前静态构造链。跨名同图候选；固定上游源可复用，逐消费者/recipe迁移后再退役别名，禁止直接删文件。 |
| B027 | `reader_tts_timer_cycle_theme_night`, `rss_refresh_theme_night`, `settings_gen_refresh_theme_night` | L0关闭、当前静态构造链。刷新/循环共用Refresh几何而动作不同，保留teal/green/ink/danger角色，只共用上游源。 |
| B028 | `rss_filter_chevron_theme_night`, `rss_item_chevron_theme_night` | L0关闭。同方向轮廓的不同角色；共用方向+有限角色配方，上一/下一章、前往、展开仍为不同动作。 |
| B029 | `settings_gen_animation`, `settings_gen_motion` | L0关闭、当前静态构造链。跨名同图候选；固定上游源可复用，逐消费者/recipe迁移后再退役别名，禁止直接删文件。 |
| B030 | `settings_gen_update`, `settings_row_download` | 当前静态构造链。菜单、设置、目录状态共享下载源几何但颜色角色不同，保留本轮正确角色资源。 |
| B031 | `settings_gen_update_theme_night`, `settings_row_download_theme_night` | 当前静态构造链。菜单、设置、目录状态共享下载源几何但颜色角色不同，保留本轮正确角色资源。 |
| B032 | `settings_reset_defaults`, `settings_reset_defaults_theme_night` | 当前静态构造链。仅day/night当前恰为同危险色，可复用同资源；保留主题角色。 |
| B033 | `source_group_folder`, `sync_folder` | L0关闭、当前静态构造链。跨名同图候选；固定上游源可复用，逐消费者/recipe迁移后再退役别名，禁止直接删文件。 |
| B034 | `source_group_folder_theme_night`, `sync_folder_theme_night` | L0关闭、当前静态构造链。跨名同图候选；固定上游源可复用，逐消费者/recipe迁移后再退役别名，禁止直接删文件。 |

## 附表B：全部跨基础名的归一样式候选

57组；基础名省略同名夜间后缀，文件数含所有成员；完整文件/引用/入口分类见JSON。

| ID | 基础名 / 文件数 | 可达性 | 收敛判断 |
|---|---|---|---|
| S001 | `book_detail_back`, `rc_arrow_left`, `reader_directory_back`, `reader_quick_back`, `search_back` / 10 | 保留未挂载、当前静态构造链 | 返回共用源几何及有限角色；逐消费者迁移，不改返回逻辑。 |
| S002 | `book_detail_directory`, `reader_directory_directory` / 4 | 当前静态构造链 | 跨名同图候选；固定上游源可复用，逐消费者/recipe迁移后再退役别名，禁止直接删文件。 |
| S003 | `bookshelf_compass`, `bookshelf_compass_active`, `bookshelf_compass_outline` / 5 | L0关闭 | 导航/选择active与outline，onPrimary和muted保留；同字节别名先迁移消费者后退役。 |
| S004 | `bookshelf_filter`, `bookshelf_filter_active`, `discover_filter`, `rss_filter` / 8 | L0关闭、当前静态构造链 | 共用漏斗几何；书架active/night保留，Discover/RSS关闭。共用几何源，不合并运行态。 |
| S005 | `bookshelf_grid`, `bookshelf_grid_outline` / 4 | 当前静态构造链 | 导航/选择active与outline，onPrimary和muted保留；同字节别名先迁移消费者后退役。 |
| S006 | `bookshelf_library`, `bookshelf_library_active`, `bookshelf_library_outline` / 4 | 当前静态构造链 | 导航/选择active与outline，onPrimary和muted保留；同字节别名先迁移消费者后退役。 |
| S007 | `bookshelf_list`, `bookshelf_list_active`, `rc_list`, `reader_directory_list_active`, `rss_manage_view_all`, `rss_view_all` / 12 | L0关闭、当前静态构造链 | 导航/选择active与outline，onPrimary和muted保留；同字节别名先迁移消费者后退役。 |
| S009 | `bookshelf_more_batch`, `discover_apply`, `reader_action_check`, `reader_directory_marker_check`, `settings_select_check` / 9 | L0关闭、保留未挂载、当前公共配方、当前静态构造链 | 面板前景与原页面/状态角色不同；保留编译期有限色/线宽配方，避免退回借图错色。 |
| S010 | `bookshelf_more_download`, `reader_directory_marker_download`, `settings_gen_update`, `settings_row_download` / 8 | 当前静态构造链 | 菜单、设置、目录状态共享下载源几何但颜色角色不同，保留本轮正确角色资源。 |
| S011 | `bookshelf_more_import`, `reader_action_import` / 4 | 当前公共配方、当前静态构造链 | 面板前景与原页面/状态角色不同；保留编译期有限色/线宽配方，避免退回借图错色。 |
| S013 | `bookshelf_more_update`, `discover_refresh`, `reader_tts_timer_cycle`, `rss_manage_refresh`, `rss_refresh`, `settings_gen_refresh`, `settings_reset_defaults`, `settings_row_sync` / 16 | L0关闭、当前静态构造链 | 刷新/循环共用Refresh几何而动作不同，保留teal/green/ink/danger角色，只共用上游源。 |
| S014 | `bookshelf_multiselect_trash`, `reader_danger_trash`, `rss_manage_delete` / 4 | L0关闭、当前静态构造链 | 跨名同图候选；固定上游源可复用，逐消费者/recipe迁移后再退役别名，禁止直接删文件。 |
| S015 | `bookshelf_rss`, `bookshelf_rss_active`, `bookshelf_rss_outline`, `rss_empty`, `rss_source` / 9 | L0关闭 | 导航/选择active与outline，onPrimary和muted保留；同字节别名先迁移消费者后退役。 |
| S016 | `bookshelf_search`, `rc_search`, `reader_directory_input_search`, `reader_directory_search`, `reader_quick_search`, `search_mag`, `settings_row_shelf_search` / 14 | 保留未挂载、当前静态构造链 | 跨名同图候选；固定上游源可复用，逐消费者/recipe迁移后再退役别名，禁止直接删文件。 |
| S017 | `bookshelf_settings`, `bookshelf_settings_active`, `bookshelf_settings_outline`, `rc_settings`, `reader_replace_manage`, `reader_settings_header`, `reader_settings_nav_active`, `rss_manage`, `settings_row_general` / 17 | L0关闭、保留未挂载、当前静态构造链 | 导航/选择active与outline，onPrimary和muted保留；同字节别名先迁移消费者后退役。 |
| S018 | `discover_filter_chevron`, `discover_source_chevron`, `rc_chevron_right`, `reader_appearance_make_chevron`, `reader_auto_full_chevron_right`, `reader_chevron_right`, `rss_filter_chevron`, `rss_item_chevron` / 16 | L0关闭、保留未挂载、当前静态构造链 | 同方向轮廓的不同角色；共用方向+有限角色配方，上一/下一章、前往、展开仍为不同动作。 |
| S023 | `download_visual_clear`, `download_visual_close`, `reader_action_close` / 6 | 当前公共配方、当前静态构造链 | 面板前景与原页面/状态角色不同；保留编译期有限色/线宽配方，避免退回借图错色。 |
| S024 | `download_visual_download`, `reader_action_download` / 4 | 当前公共配方、当前静态构造链 | 面板前景与原页面/状态角色不同；保留编译期有限色/线宽配方，避免退回借图错色。 |
| S027 | `download_visual_more`, `reader_action_more` / 4 | 当前公共配方、当前静态构造链 | 面板前景与原页面/状态角色不同；保留编译期有限色/线宽配方，避免退回借图错色。 |
| S028 | `download_visual_pause`, `reader_action_pause` / 4 | 当前公共配方、当前静态构造链 | 面板前景与原页面/状态角色不同；保留编译期有限色/线宽配方，避免退回借图错色。 |
| S029 | `download_visual_play`, `reader_action_play` / 4 | 当前公共配方、当前静态构造链 | 面板前景与原页面/状态角色不同；保留编译期有限色/线宽配方，避免退回借图错色。 |
| S030 | `download_visual_retry`, `reader_action_refresh` / 4 | 当前公共配方、当前静态构造链 | 刷新/循环共用Refresh几何而动作不同，保留teal/green/ink/danger角色，只共用上游源。 |
| S034 | `download_visual_storage`, `reader_action_storage` / 4 | 当前公共配方、当前静态构造链 | 面板前景与原页面/状态角色不同；保留编译期有限色/线宽配方，避免退回借图错色。 |
| S035 | `download_visual_trash`, `download_visual_trash_disabled` / 4 | 当前静态构造链 | 跨名同图候选；固定上游源可复用，逐消费者/recipe迁移后再退役别名，禁止直接删文件。 |
| S041 | `manga_directory_back`, `manga_directory_previous` / 4 | 当前静态构造链 | 返回共用源几何及有限角色；逐消费者迁移，不改返回逻辑。 |
| S042 | `manga_directory_chevron_down_accent`, `manga_sheet_chevron_down` / 4 | 当前静态构造链 | 同方向轮廓的不同角色；共用方向+有限角色配方，上一/下一章、前往、展开仍为不同动作。 |
| S043 | `manga_directory_chevron_right_accent`, `manga_sheet_chevron_right` / 4 | 当前静态构造链 | 同方向轮廓的不同角色；共用方向+有限角色配方，上一/下一章、前往、展开仍为不同动作。 |
| S044 | `manga_directory_clear`, `manga_sheet_close` / 4 | 当前静态构造链 | 跨名同图候选；固定上游源可复用，逐消费者/recipe迁移后再退役别名，禁止直接删文件。 |
| S045 | `manga_directory_sort_ascending`, `reader_directory_sort_ascending` / 4 | 当前静态构造链 | 跨名同图候选；固定上游源可复用，逐消费者/recipe迁移后再退役别名，禁止直接删文件。 |
| S046 | `manga_directory_sort_descending`, `reader_directory_sort_descending` / 4 | 当前静态构造链 | 跨名同图候选；固定上游源可复用，逐消费者/recipe迁移后再退役别名，禁止直接删文件。 |
| S048 | `manga_sheet_horizontal`, `manga_sheet_horizontal_active` / 3 | 当前静态构造链 | 导航/选择active与outline，onPrimary和muted保留；同字节别名先迁移消费者后退役。 |
| S050 | `manga_sheet_moon`, `manga_sheet_moon_active` / 3 | 当前静态构造链 | 导航/选择active与outline，onPrimary和muted保留；同字节别名先迁移消费者后退役。 |
| S052 | `manga_sheet_sun`, `manga_sheet_sun_active` / 3 | 当前静态构造链 | 导航/选择active与outline，onPrimary和muted保留；同字节别名先迁移消费者后退役。 |
| S053 | `manga_sheet_vertical`, `manga_sheet_vertical_active` / 3 | 当前静态构造链 | 导航/选择active与outline，onPrimary和muted保留；同字节别名先迁移消费者后退役。 |
| S054 | `rc_autopage`, `reader_auto_full_header` / 4 | 保留未挂载、当前静态构造链 | 跨名同图候选；固定上游源可复用，逐消费者/recipe迁移后再退役别名，禁止直接删文件。 |
| S055 | `rc_chevron_left`, `reader_auto_full_chevron_left` / 4 | 保留未挂载、当前静态构造链 | 同方向轮廓的不同角色；共用方向+有限角色配方，上一/下一章、前往、展开仍为不同动作。 |
| S056 | `rc_dots`, `reader_directory_more` / 4 | 当前静态构造链 | 跨名同图候选；固定上游源可复用，逐消费者/recipe迁移后再退役别名，禁止直接删文件。 |
| S057 | `rc_headphones`, `reader_tts_header`, `reader_tts_headphones`, `reader_tts_nav_active` / 8 | 保留未挂载、当前静态构造链 | 导航/选择active与outline，onPrimary和muted保留；同字节别名先迁移消费者后退役。 |
| S058 | `rc_palette`, `reader_appearance_header`, `reader_appearance_nav_active`, `settings_gen_theme` / 8 | 保留未挂载、当前静态构造链 | 导航/选择active与outline，onPrimary和muted保留；同字节别名先迁移消费者后退役。 |
| S061 | `rc_switch_horizontal`, `reader_action_source`, `reader_directory_switch` / 6 | 当前公共配方、当前静态构造链 | 面板前景与原页面/状态角色不同；保留编译期有限色/线宽配方，避免退回借图错色。 |
| S062 | `reader_action_folder`, `source_group_folder`, `sync_folder` / 6 | L0关闭、当前公共配方、当前静态构造链 | 面板前景与原页面/状态角色不同；保留编译期有限色/线宽配方，避免退回借图错色。 |
| S063 | `reader_action_info`, `settings_row_about` / 4 | L0关闭、当前公共配方 | 面板前景与原页面/状态角色不同；保留编译期有限色/线宽配方，避免退回借图错色。 |
| S066 | `reader_auto_full_clock`, `reader_tts_clock` / 4 | 保留未挂载、当前静态构造链 | 跨名同图候选；固定上游源可复用，逐消费者/recipe迁移后再退役别名，禁止直接删文件。 |
| S067 | `reader_auto_full_play`, `reader_auto_play`, `reader_tts_play` / 6 | 保留未挂载、当前静态构造链 | 跨名同图候选；固定上游源可复用，逐消费者/recipe迁移后再退役别名，禁止直接删文件。 |
| S068 | `reader_auto_full_stop`, `reader_auto_stop`, `reader_tts_stop` / 5 | 保留未挂载、当前静态构造链 | 跨名同图候选；固定上游源可复用，逐消费者/recipe迁移后再退役别名，禁止直接删文件。 |
| S069 | `reader_chevron_down`, `reader_chevron_down_primary`, `source_group_chevron`, `sync_scope_chevron` / 8 | L0关闭、保留未挂载、当前公共配方、当前静态构造链 | 同方向轮廓的不同角色；共用方向+有限角色配方，上一/下一章、前往、展开仍为不同动作。 |
| S077 | `reader_directory_marker_bookmark`, `reader_directory_marker_bookmark_active`, `rss_bookmark`, `rss_bookmark_active` / 8 | L0关闭、保留未挂载、当前静态构造链 | 导航/选择active与outline，onPrimary和muted保留；同字节别名先迁移消费者后退役。 |
| S078 | `reader_directory_top`, `settings_gen_tap_top` / 4 | L0关闭、当前静态构造链 | 跨名同图候选；固定上游源可复用，逐消费者/recipe迁移后再退役别名，禁止直接删文件。 |
| S081 | `reader_replace_close`, `source_switch_close` / 4 | 保留未挂载、当前静态构造链 | 跨名同图候选；固定上游源可复用，逐消费者/recipe迁移后再退役别名，禁止直接删文件。 |
| S088 | `reader_tts_make_next`, `reader_tts_make_next_quick`, `reader_tts_next` / 6 | 保留未挂载、当前静态构造链 | 用户已选择C播放器图形；当前/保留、quick/full共用选定几何，仍保留颜色与尺寸角色。 |
| S092 | `reader_tts_make_previous`, `reader_tts_make_previous_quick`, `reader_tts_previous` / 6 | 保留未挂载、当前静态构造链 | 用户已选择C播放器图形；当前/保留、quick/full共用选定几何，仍保留颜色与尺寸角色。 |
| S095 | `reader_tts_rate`, `settings_gen_animation`, `settings_gen_motion` / 6 | L0关闭、保留未挂载、当前静态构造链 | 跨名同图候选；固定上游源可复用，逐消费者/recipe迁移后再退役别名，禁止直接删文件。 |
| S098 | `reading_paper_phone_highlight`, `reading_paper_phone_shade` / 2 | 当前静态构造链 | 纸面光照/阴影背景，非交互图标；gradient/paint语义不同，排除删图候选。 |
| S099 | `reading_paper_tablet_highlight`, `reading_paper_tablet_shade` / 2 | 当前静态构造链 | 纸面光照/阴影背景，非交互图标；gradient/paint语义不同，排除删图候选。 |
| S100 | `rss_add`, `source_add` / 3 | L0关闭、当前静态构造链 | 跨名同图候选；固定上游源可复用，逐消费者/recipe迁移后再退役别名，禁止直接删文件。 |
| S101 | `rss_edit`, `rss_manage_edit` / 4 | L0关闭 | 跨名同图候选；固定上游源可复用，逐消费者/recipe迁移后再退役别名，禁止直接删文件。 |
| S104 | `rss_link`, `sync_server` / 4 | L0关闭 | 跨名同图候选；固定上游源可复用，逐消费者/recipe迁移后再退役别名，禁止直接删文件。 |

另忽略线宽后的跨名扩展：

- G035：`download_visual_trash` (2.0vp@24), `download_visual_trash_disabled` (2.0vp@24), `download_visual_trash_disabled_theme_night` (2.0vp@24), `download_visual_trash_theme_night` (2.0vp@24), `reader_action_trash` (1.75vp@24), `reader_action_trash_theme_night` (1.75vp@24)。按承载家族决定，不全局改同色同粗。
- G036：`import_cancel` (1.99999vp@24), `import_cancel_theme_night` (1.99999vp@24), `reader_replace_close` (1.75vp@24), `reader_replace_close_theme_night` (1.75vp@24), `source_switch_close` (1.75vp@24), `source_switch_close_theme_night` (1.75vp@24)。按承载家族决定，不全局改同色同粗。

## 附表C：仅同一基础名的归一样式组

61组，主要为日夜几何复用；不能据此删除夜间配方。

| ID | 基础名 | 文件数 |
|---|---|---:|
| S008 | `bookshelf_more` | 2 |
| S012 | `bookshelf_more_settings` | 2 |
| S019 | `discover_source_stack` | 2 |
| S020 | `download_visual_back` | 2 |
| S021 | `download_visual_check` | 2 |
| S022 | `download_visual_chevron` | 2 |
| S025 | `download_visual_empty` | 2 |
| S026 | `download_visual_filter` | 2 |
| S031 | `download_visual_search` | 2 |
| S032 | `download_visual_sort_asc` | 2 |
| S033 | `download_visual_sort_desc` | 2 |
| S036 | `import_cancel` | 2 |
| S037 | `import_doc` | 2 |
| S038 | `import_info` | 2 |
| S039 | `import_select_system` | 2 |
| S040 | `import_success` | 2 |
| S047 | `manga_sheet_check` | 2 |
| S049 | `manga_sheet_locate` | 2 |
| S051 | `manga_sheet_search` | 2 |
| S059 | `rc_replace` | 2 |
| S060 | `rc_sun` | 2 |
| S064 | `reader_action_trash` | 2 |
| S065 | `reader_appearance_make_check` | 2 |
| S070 | `reader_control_replace_back` | 2 |
| S071 | `reader_control_replace_delete` | 2 |
| S072 | `reader_control_replace_edit` | 2 |
| S073 | `reader_control_replace_export` | 2 |
| S074 | `reader_control_replace_header` | 2 |
| S075 | `reader_control_replace_import` | 2 |
| S076 | `reader_directory_bottom` | 2 |
| S079 | `reader_image_unavailable` | 2 |
| S080 | `reader_page_bookmark_filled` | 2 |
| S082 | `reader_replace_preview` | 2 |
| S083 | `reader_session_pause` | 2 |
| S084 | `reader_session_play` | 2 |
| S085 | `reader_tts_make_close` | 2 |
| S086 | `reader_tts_make_engine_check` | 2 |
| S087 | `reader_tts_make_minus` | 2 |
| S089 | `reader_tts_make_pause` | 2 |
| S090 | `reader_tts_make_play` | 2 |
| S091 | `reader_tts_make_plus` | 2 |
| S093 | `reader_tts_make_stop` | 2 |
| S094 | `reader_tts_online_engine` | 2 |
| S096 | `reader_tts_speed_thumb` | 2 |
| S097 | `reader_tts_system_engine` | 2 |
| S102 | `rss_error` | 2 |
| S103 | `rss_external` | 2 |
| S105 | `search_clear` | 2 |
| S106 | `search_empty` | 2 |
| S107 | `search_error` | 2 |
| S108 | `settings_gen_battery` | 2 |
| S109 | `settings_gen_cache` | 2 |
| S110 | `settings_gen_crash` | 2 |
| S111 | `settings_gen_file` | 2 |
| S112 | `settings_gen_language` | 2 |
| S113 | `settings_gen_notification` | 2 |
| S114 | `settings_gen_startup` | 2 |
| S115 | `settings_row_source` | 2 |
| S116 | `sync_account` | 2 |
| S117 | `sync_backup_password` | 2 |
| S118 | `sync_password` | 2 |

本补审未运行应用门禁、测试、构建、安装或设备操作，未直接改生产资源。旧审计保留；本轮角色修复和用户选择C的字节变化独立记账，不把静态构造链当原生验收。
