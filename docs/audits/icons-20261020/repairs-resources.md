# 图标资源修复记录

本页记录 2026-10-20 本轮资源修复；状态为源码及生成资源已修改，构建、设备显示及用户验收不由本记录代替。以原审计编号对应，不将所有规则风险写成已通过。

## 已修复的确定问题

| 编号 | 本轮处理 | 证据位置及边界 |
| --- | --- | --- |
| ICON-01 | 书架更多菜单新增专用 `bookshelf_more_download` 日夜资源，普通动作墨色 `#1F1B17 / #EADFCE`。 | `BookshelfMoreMenu.ets`；复用已有 Figma `Icon/Download`（Tabler 3.44.0 / MIT）48 坐标、3.5 描边，折算 24 坐标为 1.75，与同组一致。下载列表原 `download_visual_download` 未修改。 |
| ICON-02 | 设置下载入口改用专用 `settings_row_download`，设置导航色 `#2D4A3E / #D2BD96`。 | `SettingsPage.ets`；同一 Download 上游轮廓，阅读目录 `reader_directory_marker_download` 原色及原用途未修改。 |
| ICON-03 | 书架检查更新改用 `bookshelf_more_update` 普通菜单墨色资源。 | `BookshelfMoreMenu.ets`；复用已有 Figma `Icon/Refresh`，不再借用设置绿/金色图标。 |
| ICON-04 | TTS 停止按 app scheme 选择日夜资源；夜间 `#DC9E53`，与文字、同控件 clay 主题一致。 | `ReaderControlTtsContent.ets`；沿 Make 原停止轮廓，canonical 图标色角色明确 `sourceRole: TOK_TTS_CLAY`，主题生成读取该既有角色。 |
| ICON-05 | 动作名称、返回及漫画翻页可访问性不属于资源配方，由并行组件修复统一登记。 | 本页不将该项标记通过；见本轮组件修复记录。 |

## 相关规则问题

| 编号 | 资源侧结果 |
| --- | --- |
| RULE-01 | 新增有限场景配方，不再跨菜单/设置/下载状态/目录标记借色。公共组件角色约束由本轮公共组件改动登记，不能仅凭这些资源认定所有调用已收口。 |
| RULE-02 | TTS stop/cycle 与设置恢复默认三个有限图标的 canonical icon role 记录 `sourceRole`；生成器沿现有 clay、teal、danger 主题取色。其他历史图标独立主题链未在本子任务重拍。 |
| RULE-03 | 阅读纸面书签上下文由并行阅读组件修复处理。 |
| RULE-04 | 漫画按下反馈主题由并行公共/阅读组件修复处理。 |
| RULE-05 | 已生成 `reader_danger_trash` 日夜资源，沿原书架 Figma Trash 轮廓及 1.75 等效描边，使用既有 `TOK_DOWNLOAD_DANGER`（`#A53D32 / #EFB4A8`）；页面图字消费由并行组件修复处理，不改变原橙色选中基线。 |
| RULE-06 | 已生成 `manga_directory_sort_ascending/descending` 各日夜资源，沿原 Figma SortAsc/SortDesc 路径，改用漫画目录既有 accent（`#425D45 / #B9CEB1`）；页面消费由并行组件修复处理，原阅读目录排序资源保留原色。 |
| RULE-07 | 可见尺寸、触区、enabled 状态属于有限组件家族协议；本页没有统一放大、修改所有透明度。 |
| RULE-08 | 原生 Checkbox 的 mark/unselected 协议由并行组件修复处理；本页没有设备结果。 |
| RULE-09 | 设置恢复默认新增 `settings_reset_defaults`，图、字同用现有 `TOK_DANGER`（当前日夜 `#D62222`）；圆底新语义 `TOK_SETTING_DANGER_ICON_BG`，沿既有危险色和原圆底日/夜透明度 0.09/0.16，不再混蓝色普通底。保留 15vp 图及 28vp 触点内圆底比例，不改恢复业务动作。关闭的 RSS 不由本子任务扩改。 |
| RULE-10 | 换源加载图例外由并行阅读组件修复处理。 |
| RULE-11 | 目录重复图节点由并行阅读组件修复处理。 |
| RULE-12 | 新增 `reader_tts_timer_cycle` 日夜资源，复用已有 Refresh 上游轮廓，绑定 `TOK_TTS_TEAL`（`#2F6373 / #D2BD96`）；快捷定时消费及可访问性由阅读组件修复处理，循环行为没有新增流程。 |
| RULE-13 | 旧文档来源、现有变体数量由主修复文档统一更新，本页不是历史文档全量合格证明。 |

## 生成入口与执行范围

仅扩充既有生成器的可点名范围，未引入第二套渲染器。`tools/sync-svg-assets.mjs --files <准确配方列表>` 继续使用原 `renderRecipe`，仅读取选中配方及其必要原始来源（夜版读取其 day 配方），生成字节和对应 provenance 项；未选条目原样合并保留。有限模式不跑完整 Figma/Radix catalog 检查、不作全资源集相等检查；生产引用仅断言点名资源存在消费。

执行次序为：生成 5 个新 day 配方 → `generate-theme-icons.mjs --files` 生成 6 个点名家族的 night 资源并合并 manifest → `generate-theme-registry.mjs` 将 canonical registry 投影到现有两个运行时副本 → 最终生成/登记 11 个 SVG。`generate-theme-registry` 的完整输出是运行时源码投影，不运行测试；没有调用 contract、全量 gate、HAP、设备入口。

11 项为：`bookshelf_more_download`、`bookshelf_more_update`、`settings_row_download`、`reader_tts_timer_cycle`、`settings_reset_defaults` 各日夜 2 项，加 `reader_tts_make_stop_theme_night`。原停止 day 图不变；原列表状态图及目录下载标记不变。来源、许可证、上游几何和哈希写入 `docs/ui-design/SVG_PROVENANCE.json`。

现有 provenance 对夜版记录整个生成主题源码的 hash。此次只更新点名资源条目，其他历史条目仍保留生成当时 hash，不以重新写它们来伪装整套资源已复验；后续全量一致性检查不能从本页推出已通过。

## 操作面板前景资源与清晰度修复

原生截图的局部像素诊断表明，运行时 ColorFilter 路径需要单独处理。操作面板改用 SVG 栅格化之前即确定前景色的有限资源，公共组件取消滤镜的接线与像素对比由主任务登记；本节只记录资源准备及生成。

新增 `reader_action_<kind>` 与 `reader_action_<kind>_theme_night` 共 26 项，全部直接沿既有 `TOK_DOWNLOAD_GREEN_INK`：日间 `#FFFCF8`、夜间 `#1C1E1A`。原图、源路径、viewBox、圆角、端点及接合保持不变；仅操作面板 trash 配方将 Lucide 根描边 2 调为 1.75，使该小尺寸删除动作与同组主要 Figma 动作等效线重一致。原下载列表 Trash2 保持 2，不受该派生影响。

| kind | 原资源 | 既有来源 |
| --- | --- | --- |
| check | bookshelf_more_batch | Figma 页面导出的 Tabler Check |
| info | settings_row_about | Figma Icon/Info |
| folder | source_group_folder | Figma Icon/Folder |
| trash | download_visual_trash | 已固定 Lucide Trash2 |
| pause | download_visual_pause | 已固定 Lucide Pause |
| play | download_visual_play | 已固定 Lucide Play |
| close | download_visual_close | 已固定 Lucide X |
| refresh | download_visual_retry | 已固定 Lucide RotateCw |
| download | download_visual_download | 已固定 Lucide Download |
| storage | download_visual_storage | 已固定 Lucide Settings2 |
| more | download_visual_more | 已固定 Lucide Ellipsis |
| source | reader_directory_switch | Figma Icon/SourceSwitch |
| import | bookshelf_more_import | Figma 页面导出的 Tabler Download |

继续使用同一 `theme-palette-derived` 渲染分支：显式配方登记 kind、原资源、日夜 scheme 和既有前景角色；只允许这 26 项采用有限前景角色覆盖。`--files` 指定准确 26 项后递归读取各自原配方的可信来源，生成 SVG 与 provenance，不扩充主题表，也不重生成其他图标。

26 项已一次有限生成完成。通用 `generate-theme-icons` 的 discovery 会跳过这 13 个已具显式日夜配方的家族；若显式点名它们会说明应使用 `sync-svg-assets --files`，防止通用 reader 白图映射把既定 `#1C1E1A` 再变成其他夜色或制造重复 recipe。另 6 项多选危险图/漫画排序图以原 Figma 来源配方独立有限生成，不依赖夜色的近似颜色查找表。以上生成过程未运行测试、构建或设备操作。

## TTS 上一项 / 下一项：用户选定 C

用户明确选择候选 **C：折角 + 单竖线，增加间距**。按 `tts-options/index.html` 中 C 的 SVG 落实：26 × 26 viewBox、1.9 描边、折角 `M19 7 12 13l7 6`、竖线 `M6 7v12`；下一项严格采用 `translate(26 0) scale(-1 1)` 水平镜像。没有采用 A/B 的三角形，也没有增加第二根竖线。

| 原资源家族 | 本轮范围 | 尺寸与颜色 |
| --- | --- | --- |
| `reader_tts_make_previous` / `reader_tts_make_next` | 当前统一 TTS 完整态所用，两项各日夜。 | 保留 intrinsic 26；日色 `#332C25`、夜色沿原角色 `#EADFCE`。 |
| `reader_tts_make_previous_quick` / `reader_tts_make_next_quick` | 当前统一 TTS 快捷态所用，两项各日夜。 | 保留 intrinsic 17；日色 `#4D463F`、夜色沿原角色 `#EADFCE`。实际组件宽高及快捷/完整态插值不改。 |
| `reader_tts_previous` / `reader_tts_next` | 仍有 `ReaderTtsModulePanel` / `ReaderTtsFullPanel` 源码引用的保留分支，两项各日夜；不将这些引用说成当前主流程已挂载。 | 保留 intrinsic 48；日色 `#332C25`、夜色沿原角色 `#EADFCE`。 |

6 个 day 配方与其既有 6 个 night 配方，共 **12 个原资源文件**，已经一次 `sync-svg-assets --files` 有限生成；资源名没有增加或删除。组件大小、可点击范围、上一段/下一段动作、enabled 状态及朗读服务接线均未在本子任务修改。

选定几何存于 `docs/ui-design/svg-provenance/tts-selected-c/transport-previous.svg`，`SOURCE.json` 同时记录选 C 的依据、demo 单个 C SVG 的哈希、原 6 个资源的来源及原哈希。新来源类别 `user-selected-icon-adapted` 只接纳这 6 个有限配方，明确登记 `TTS-TRANSPORT-C` 适配例外，不冒充原 Figma/Tabler 未修改导出。旧 Make v17/Figma 输入仍保存，不改写历史源，也不盲删其他阅读/章节左右箭头。资源最终哈希见 `tts-options/selection-c-resources.json`。

本次 C 仅完成源码、生成资源及来源记录；没有运行测试、构建或设备操作。

构建前的有限兼容修正：C 的两条 open path 均显式声明 `fill="none"`，避免依赖 Harmony 对 root fill 的继承；未改几何、线宽、颜色、尺寸或动作。已有限重生同 12 个文件并更新选定资源哈希记录。

## 已执行重复别名清理

按唯一冻结的 `duplicate-cleanup-map.json`，消费方先完成 14 个文件中 35 处实际资源字符串/裸名迁移，随后实际删除 **27 个同字节 SVG 别名**，媒体 SVG 从 **456 减为 429**。同步退役 13 条 Figma day 配方、1 条 Lucide clear 日夜配方、12 个 theme variant base 和 13 个旧 `app.icon` 角色，运行时主题副本已由 canonical registry 投影；来源、旧/目标哈希与逐组保留依据随同映射记录保留。并未删除同形换色、不同方向、必要 day/night 主题角色或 normal/selected 状态角色；下载筛选原 sliders 保持原状。未运行测试、构建或设备操作。
