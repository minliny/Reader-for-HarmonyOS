# 重复资源生产引用迁移

2026-10-20。用户要求实际清理后，按已冻结的[唯一映射](duplicate-cleanup-map.json)执行，原只读[重复审计](duplicate-audit.md)保留为清理前基线。

**本子任务已实际修改生产引用：498个ETS/TS中14个文件、35处资源字面/裸名替换，覆盖27个精确资源别名、14个基础族。** 颜色、轮廓、方向、尺寸、可用条件和业务回调均未改。资源子任务随后已实际删除27个SVG并退役对应recipe、theme角色和来源登记，媒体由456降至429个SVG；不能仅凭本报告宣称构建或原生验收通过。

按官方ETS AST定位实际字符串节点，只替换完整资源名或已登记裸名，不做子串全局替换；生成的app.icon色角色键没有在本迁移里手改。改完的源码库存中，27个退役别名的精确资源/裸名字面消费者为0。该库存核对是资源迁移事实，不是应用测试或门禁。

## 实际迁移全表

| 退役别名 | 统一资源 | 生产字面落点数 |
|---|---|---:|
| `rc_arrow_left` | `book_detail_back` | 1 |
| `rc_arrow_left_theme_night` | `book_detail_back_theme_night` | 1 |
| `search_back` | `book_detail_back` | 3 |
| `search_back_theme_night` | `book_detail_back_theme_night` | 3 |
| `bookshelf_compass` | `bookshelf_compass_outline` | 1 |
| `bookshelf_compass_theme_night` | `bookshelf_compass_outline_theme_night` | 1 |
| `bookshelf_library` | `bookshelf_library_active` | 1 |
| `bookshelf_rss` | `bookshelf_rss_outline` | 1 |
| `bookshelf_rss_theme_night` | `bookshelf_rss_outline_theme_night` | 1 |
| `download_visual_clear` | `download_visual_close` | 1 |
| `download_visual_clear_theme_night` | `download_visual_close_theme_night` | 1 |
| `reader_auto_full_header` | `rc_autopage` | 2 |
| `reader_auto_full_header_theme_night` | `rc_autopage_theme_night` | 2 |
| `reader_auto_play` | `reader_auto_full_play` | 1 |
| `reader_auto_play_theme_night` | `reader_auto_full_play_theme_night` | 1 |
| `reader_tts_play` | `reader_auto_full_play` | 2 |
| `reader_tts_play_theme_night` | `reader_auto_full_play_theme_night` | 2 |
| `reader_quick_search` | `reader_directory_search` | 1 |
| `reader_quick_search_theme_night` | `reader_directory_search_theme_night` | 1 |
| `settings_gen_motion` | `settings_gen_animation` | 1 |
| `settings_gen_motion_theme_night` | `settings_gen_animation_theme_night` | 1 |
| `settings_gen_update` | `settings_row_download` | 1 |
| `settings_gen_update_theme_night` | `settings_row_download_theme_night` | 1 |
| `sync_folder` | `source_group_folder` | 1 |
| `sync_folder_theme_night` | `source_group_folder_theme_night` | 1 |
| `rss_manage_refresh` | `discover_refresh` | 1 |
| `rss_manage_refresh_theme_night` | `discover_refresh_theme_night` | 1 |

## 动态和保留消费者

- `MainTabBar.tabIconResource` 的完整day/night/active返回值已迁移，最终仍由模板Image消费。书架、发现与RSS的业务key不变；L0关闭的代码也纳入。
- `ReaderControlPanel` 的动态标题资源及旧/完整自动翻页头部已迁移，原quickAction/module模板选择器保留业务含义。
- `ReaderChoiceSpecs→ReaderChoiceRow.$r`、公共返回/搜索、下载visualIcon、原生章节载入页返回均按同一映射审阅。
- `FullDirectoryPanel` / `ReaderDirectoryModulePanel` 将下载marker基础名拼接夜间后缀；这两个基础名未退役，不会动态产生本27项中的旧别名。
- 旧AutoPage、TTS，关闭RSS/Sync同样已迁移；不能仅改当前可见页而让保留分支悬空。

完整逐文件、逐行变更和源码哈希见[引用回执](duplicate-cleanup-references.json)。`PageBackBar` 的默认资源注释同步为 `book_detail_back`。

## 仍保留的相同字节及依据

本次按“整族同颜色角色”合并，取消原先把所有夜间巧合同色也强行合并的提议。清理前34个字节组中20组可消去；实际剩14组、15份额外物理副本，均明确留在下表，不伪称字节重复已归零。

| 原组ID | 保留内容 | 保留依据 |
|---|---|---|
| B002 | `book_detail_back_theme_night` / `reader_directory_back_theme_night` | 完整返回族与目录ink族日间分别#1F1B17/#332C25，不能只因夜间相等拆开主题族。 |
| B008 | `bookshelf_settings_active` / `reader_replace_manage` | 导航选中onPrimary与管理CTA前景为不同状态家族，暂保持独立角色。 |
| B009 | `bookshelf_settings_outline` / `rss_manage` | 导航未选中与RSS管理动作是不同角色族；RSS关闭不意味着可删其声明。 |
| B010 | Discover筛选/书源chevron夜版 | 日间分别#3F372F/#1F1B17，只夜间相同；保留成对族，两个域当前关闭。 |
| B017 | `rc_dots_theme_night` / `reader_directory_more_theme_night` | 日间顶栏ink与目录ink不同，只夜间相同。 |
| B018 | `rc_switch_horizontal_theme_night` / `reader_directory_switch_theme_night` | 同上，保留阅读顶栏与目录表面角色。 |
| B021 | 目录输入搜索 / 通用搜索夜版 | 日间#5B5046/#756F69为输入提示与通用muted角色。 |
| B022 | 目录check / 设置check夜版 | 目录teal与设置green日间不同，状态/选择语义保持。 |
| B024 | 目录搜索 / 设置书架入口夜版 | 目录动作teal与设置导航green日间不同。 |
| B025 | 目录到顶 / 设置点顶夜版 | 目录动作teal与设置leading green日间不同。 |
| B026 | TTS rate / Settings animation夜版 | TTS teal与设置green日间不同；`settings_gen_motion`整族已经并入animation，不再额外保留。 |
| B027 | TTS timer cycle / RSS refresh / Settings refresh夜版 | 三个日间角色不同，不以夜间统一金色反推日间应共享资源。 |
| B028 | RSS filter/item chevron夜版 | 日间普通筛选文字色与前往ink不同，保留角色；RSS当前关闭。 |
| B032 | 恢复默认day/night | 同一基础名成对主题资源，当前危险色恰好一致；本次不拆同族日夜结构。 |

同形不同颜色、不同方向、不同线宽和不同图形不在本27项映射中。书架漏斗与下载sliders经用户确认不是重复图标，分别保留条件筛选与调节/配置表达，不再列待统一缺陷；TTS C由前一授权实施，本轮清理不再改其轮廓。其他几何共用候选仍见清理前审计，不能把“118归一样式组”误当118项可删资源。

本子任务未运行测试、应用门禁、构建、签名、安装或设备操作；未改测试/视觉基线。
