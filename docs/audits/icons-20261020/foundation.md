# 图标全量审计：公共体系、资源与主题

审计日期：2026-10-20。源码基线为 `5a01ec1cdbd5ec864046e1b9202963ead23a513a` 之上的当前 dirty 工作区。本分册只读源码与资源，仅新增本文件；未修改生产图标、未运行门禁/测试、未构建或操作设备。

## 直接结论

书架“更多 → 下载管理”使用了**下载列表未下载状态的弱色图标**，没有使用该菜单的普通操作图标颜色。不是系统主题随机失效，也不是下载状态把按钮禁用了：

- `BookshelfMoreMenu.ets:149–152` 为五个菜单项使用同一个公共渲染器；`:177–182` 分别传入资源。
- `ReaderActionMenuSurface.ets:77–104` 的菜单分支只统一尺寸、布局与禁用透明度，**不会改写 SVG 颜色**。
- `tools/svg-provenance.config.mjs:31–44` 将 `download_visual_download` 明确定义为下载 demo 的 `muted` 色。将它放进普通菜单后，该弱色会原样保留。
- 同一菜单还存在既有的“检查更新”强调色。这意味着当前一组普通操作混用了三套色，而不是只有新增项存在问题。

| 菜单项 | 实际资源 | 日间描边 | 夜间描边 | 24 vp 显示时的线宽 | 结论 |
|---|---|---|---|---|---|
| 批量管理 | `bookshelf_more_batch` | `#1F1B17` | `#EADFCE` | 1.75 vp | 菜单普通操作基线 |
| 本地导入 | `bookshelf_more_import` | `#1F1B17` | `#EADFCE` | 1.75 vp | 同基线 |
| 检查更新 | `settings_gen_refresh` | `#2D4A3E` | `#D2BD96` | 1.75 vp（48 坐标缩为 24） | 同组普通操作使用设置强调色；无该菜单独立强调规则 |
| 下载管理 | `download_visual_download` | `#756F69` | `#ABA99F` | 2 vp | 确定的跨场景弱色误用；同时混入较重的 Lucide 线宽 |
| 书架设置 | `bookshelf_more_settings` | `#1F1B17` | `#EADFCE` | 1.75 vp | 同基线 |

原始 SVG 可直接支持上表；`ReaderSurfaceSpecs.ets:412–430` 将这五项固定为相同的 24 vp 图标与 50 vp 行高。下载列表中的 `download_visual_download` 本身仍符合其 `muted` 状态语义，不能为了修菜单而全局修改该资源。

## 公共能力和真实责任边界

当前源码没有独立的 `ReaderIcon` 组件。`tools/svg-provenance.config.mjs:66` 中的 `ReaderIcon` 是 Radix 上游图形名，不是 Reader 的统一 UI 组件。公共图标能力分散在以下入口。

| 公共入口 | 实际图标/状态责任 | 尺寸与交互责任 | 颜色、背景与主题如何进入 |
|---|---|---|---|
| `ReaderIconButton.ets:8–37` | 接收任意 `Resource`，不选择资源，不染色 | 6 个有限 spec；挂载、非空无障碍名、enabled 同时成立才派发；按钮 role/focus/按压反馈 | 调用方选择日夜资源；组件的 `readerAppScheme` 只给按压反馈，不会自动更换已传入的 icon |
| `ReaderControlSpecs.ets:14–37` | 工具栏/返回/浮动更多/漫画动作的有限尺寸 | 标准 44/24、宽图 44/44、返回 32/20、紧凑 44/20、浮动 44/24、漫画 44/22（命中框/图标）；按压半径 12 | spec 没有 icon semantic role、颜色或资源配对字段 |
| `ReaderLabeledIconAction.ets:99–133` | 接收 `Resource`；8 个有限按钮/动作类型 | 标签+图标、不同外层命中框/边界/响应区；挂载与 enabled 派发 | 标签/背景/边框来自 spec role；图标仍由调用方选资源，不随 `isDanger` 自动染色 |
| `ReaderLabeledIconActionSpecs.ets:6–85` | RSS 6 类 + source add + discover apply | 图标 16/18/20；不同 pill、分割线、渐变等已保留的类型 | `textRole`/`dangerRole`/`surfaceRole` 与 icon Resource 无类型关联；相同 spec 无法保证传入图标同色 |
| `ReaderActionMenuSurface.ets:77–104` 菜单分支 | 普通锚点菜单的传入 Resource | 图标尺寸、行高、文字与分割线由 popup spec；禁用可只弱化内容或弱化整行 | SVG 固有色；文字有 role；图标没有对应 role/tone 染色 |
| `ReaderActionMenuSurface.ets:116–179` 操作面板分支 | 可选 Resource + tone + trailing chevron | 所有 grouped/quick/bookshelf 使用同一行配方 | 主图标用 color matrix 统一前景；默认背景 `TOK_GREEN`，危险背景 `TOK_DOWNLOAD_DANGER`；前景均为 `TOK_DOWNLOAD_GREEN_INK`；箭头使用独立日夜资源 |
| `ReaderActionSheetContent.ets:9–36` | DTO/兼容 facade | 将已有业务项转发给同一个 ActionMenu renderer | 透传 `scheme`（默认 auto），不另做图标处理 |
| `ReaderSheetActionList.ets:35–45,66–74` | 书架单书多选/信息/分组/移除四项 | token + presentation/current/mounted/once 守卫 | 四个历史来源不同的 Resource 经过上述面板 tint 后主图前景一致；移除的危险背景与标签保留 |
| `ReaderChoiceRow.ets:63–107` / `ReaderChoiceSpecs.ets` | 配方内拥有 day/night 资源、选中勾、箭头与旋转 | 8 种有限 row，selected/always/never、selected 背景 | 比任意 Resource 接口更完整；文字 role 与图标资源仍分别定义，没有自动同色假设 |
| `ReaderSelect.ets:89–208` | 外观、设置、书源分组、默认触发器箭头 | 各 variant 的尺寸和打开角度；手机设置右箭头，平板下箭头 | 每个 variant 显式选日夜 SVG；背景/标签通过 role；方向差异是不同交互用途，不能统一成全部下箭头 |
| `ReaderSearchField.ets:27–43,107–258,289–299` | 6 个有限搜索场景；搜索图及清空图 | 输入前导图为显示图；清空是操作图，命中/输入逻辑在组件内 | readerQuick、readerDirectory、mangaDirectory 等分别选日夜资源；小图不同尺寸与颜色是场景配方，并非全部普通工具栏动作 |
| `PageBackBar.ets:43–54` | 默认搜索返回资源，允许调用方传 `backIcon` | 标准 44 命中/24 图；漫画目录用自己的已定视觉参数 | 默认资源响应 app scheme；显式传入 Resource 仍由调用方处理主题 |
| `AppTopBar.ets:45` | 书架搜索资源 | 顶部操作框负责命中 | 显式日夜配对，不走 ReaderIconButton |
| `ReaderBoundedSurfaceHeader.ets:102–109,152–185` | 抽屉、换源窗、TTS 头图与关闭图 | 抽屉/换源/TTS 有既有不同的尺寸与响应区 | 各类型显式日夜配对；关闭、头图、把手不属于同一个视觉角色 |
| `ReaderBoundedSurfaceActions.ets:62–82` | 导入主按钮和取消图 | 主按钮、取消按钮的整体动作框负责命中 | 取消显式日夜；主图 `import_done` / `import_choose_file` 固定 on-primary，与标签白色一致，背景用 `app.action.fill` |
| `ReaderMangaDownloadPopup.ets:25` | 漫画下载弹窗更多图 | 由有限漫画下载弹窗内容负责 | 显式 day/night，未被全局 tint |
| `ReaderPageState.ets:21–26` | 页面状态原生载入中 | `LoadingProgress` 32×32 | 默认 `TOK_MESSAGE_SOFT_INK`；允许外部 mutedColor 适配具体页面 |
| `ReaderRecoveryAction.ets:15–35` | 动作忙状态原生载入中 | `LoadingProgress` 18×18，忙时替换文字并禁止重复操作 | 与当前动作文字共用 `TOK_MESSAGE_NOTICE_INK` / `TOK_MESSAGE_SOFT_INK` |
| `ReaderPressFeedback.ets:23–57` | 不是图标染色器 | 正常/按下/禁用背景，原生 press/release/cancel | 当前 surface 上叠加 `TOK_ACCENT` 12%；不改变 icon 像素 |

因此“已用公共组件”只证明某一部分由公共层渲染。当前 `ReaderIconButton`/`ReaderLabeledIconAction`/顶部 menu 都没有完整接管图标的语义颜色，不能据此声称全应用图标已经统一。

## 两种主题颜色链

### 运行时 role 颜色

`ReaderThemeRegistry.ts:1–2` 是 `Reader-UI/theme/registry.json` 的生成副本。`:1238–1239` 只根据 day/night 返回具体 role 的 ARGB。文本、背景、原生 loading 和操作面板 tint 消费这一条链。

| 颜色角色 | 日间 | 夜间 | 当前用途 |
|---|---|---|---|
| `TOK_INK` | `#1F1B17` | `#EAE7DE` | 应用文字/普通内容 |
| `TOK_MUTED` | `#756F69` | `#ABA99F` | 应用次要信息 |
| `TOK_GREEN` | `#2D4A3E` | `#D2BD96` | 既有应用强调色；公共操作面板默认图标背景 |
| `TOK_DOWNLOAD_GREEN` | `#1F3528` | `#B9CEB1` | 下载 demo 强调色 |
| `TOK_DOWNLOAD_GREEN_INK` | `#FFFCF8` | `#1C1E1A` | 公共面板图标 tint 的前景以及下载强调面内容 |
| `TOK_DOWNLOAD_DANGER` | `#A53D32` | `#EFB4A8` | 公共面板危险背景/文字等 |
| `TOK_READ_ICON` | `#4D463F` | `#EADFCE` | 阅读控制图标角色 |
| `TOK_READ_PRIMARY` | `#2F6373` | `#D2BD96` | 阅读强调角色 |

上述不同色族来自已存在的页面/已确认 demo，不因为颜色不相同就判为缺陷。公共面板当前有意将 app `TOK_GREEN` 与 download `GREEN_INK` 配成一对；它不是顶部菜单的配色规则，也不是下载页全部场景的配色规则。

### 固定 SVG 颜色

SVG 内存具体 stroke/fill 值，ArkUI `Image` 不会因为旁边文字的 `.fontColor(...)` 改色。当前资源中没有 `currentColor`。

- 通用日夜生成器 `tools/generate-theme-icons.mjs:9,21–31` 将旧十六进制映射到 `app.icon.<资源>.<原色>`，生成 `_theme_night`。这些 `app.icon` role 的效果发生在**资源生成时**，不是 Image 的运行时绑定。
- 通用迁移中 `#756F69 → #BAAD9C`，而当前 app/download `muted` 夜色是 `#ABA99F`。`#1F1B17 → #EADFCE`，而当前 `TOK_INK` 夜色是 `#EAE7DE`。因此“SVG role 名已登记”也不能证明它与相邻运行时文字 role 完全相同。
- 下载图标另走 `svgDownloadLucideRecipes`，由 `SharedDownloadVisualSpec` 的每个语义 role 生成 day/night 文件。
- 漫画目录/面板的 Radix 资源、不可用图片的 Lucide 静态资源也有单独的明确 day/night 配方。
- App 的有效 scheme 与阅读主题 ID 是两类选择。`ReaderThemeSelection.ts:61–62,68–95` 负责既有联动；本次没有扩大为修改主题策略。

### fillColor 与多色边界

`tools/svg-provenance.config.mjs:115–117` 记录过 HarmonyOS 的 SVG fill 继承及 `Image.fillColor` 造成闭合描边变实心的问题；`tools/test-icon-design-contract.mjs:143–147` 也有针对性禁用约束。本轮源码静态搜索未发现 `.fillColor(`；这只是当前源码事实，未运行该门禁。

全应用唯一 `.colorFilter(...)` 调用在 `ReaderActionMenuSurface.ets:122–123`，对应的矩阵 `:169–178` 替换 RGB 并保留原像素 coverage，专门让重用的描边资源在操作面板上统一为 on-color。不能把它无差别推广到以下多色资源：

| 多色基础资源 | 多色的实际含义 | 一刀切 tint 的损失 |
|---|---|---|
| `bookshelf_more.svg` | 背景圆和前景点 | 背景/前景分层 |
| `reader_tts_make_engine_check.svg` | 勾/容器等不同颜色 | 选中标记的层次 |
| `reader_tts_speed_thumb.svg` | 速度拖拽控件的前景与底色 | 滑块层次 |
| `search_clear.svg` | 半透明 `#756F69` 圆与命名颜色 `white` 的 X 描边 | 清空按钮的圆/X 对比 |
| `search_empty.svg` | 空态插画多层灰/纸色 | 插画明暗层次 |
| `search_error.svg` | 错误插画多层灰/纸色 | 插画明暗层次 |

这六项是排除 `defs` / `clipPath` 后，包含命名颜色在内的显式多色基础 SVG 集合，不等同于“六个缺陷”。只筛 hex 会遗漏 `search_clear` 的白色 X。clipPath 内的 white 蒙版不是额外可见图色，不能混计为多色设计。

`reader_tts_make_close`、`reader_tts_make_minus`、`reader_tts_make_plus` 的开放直线路径存在隐式默认 fill 黑的属性候选，但对应路径没有可见填充面积，不能据此再算一种可见颜色。资源索引分别记录 `paintDeclarations` 与 `implicitFillCandidates`；属性盘点和路径审阅不替代设备像素验收。

## SVG 全集和来源覆盖

只读文件集合清点：`base/media` 共 **413 个 SVG**，其中 **218 个基础文件、195 个 `_theme_night` 文件**。`tools/svg-provenance.config.mjs` 恰有 **413 个唯一 recipe**；两个集合一致，没有 recipe 指向的缺文件、也没有未登记的 SVG。此处只核对存在性、名称和 recipe 分类，未运行来源 hash/几何一致性验证。

| recipe 来源类型 | 文件数 |
|---|---:|
| Figma 组件派生 | 136 |
| 既有主题色板派生 | 161 |
| Figma 节点导出 | 27 |
| Lucide 组件派生 | 36 |
| Radix 组件派生 | 34 |
| Figma Make DOM 导出 | 7 |
| Lucide 静态 SVG 派生（图片不可用） | 2 |
| Figma Make source 导出 | 6 |
| Figma CSS primitive | 4 |
| 合计 | **413** |

来源版本与许可证是当前配置事实：Figma 图标族以 Tabler `3.44.0` / MIT 记录；下载 demo 为 Lucide `1.8.0` / ISC；图片不可用为 lucide-static `0.468.0` / ISC；漫画面板/目录为 Radix `1.3.2` / MIT。不同上游不自动构成问题，但**同一个菜单动作层级**仍需保持一致的视觉配方。

通用 `theme-svg-variants.json` 仅登记 161 个生成变体；它不是全部 195 个夜间资源的全集。其余还有独立配方。因此不能用“总夜图数不等于通用 manifest 数”判定资源遗漏。

### 23 个没有同名 night 文件的基础 SVG

下表完整列出无 night 对应文件的基础资源，避免把“未配对”偷换成“主题错误”。本分册没有替这些例外补做日夜视觉验收；具体页面中若角色/背景不匹配仍应单独列问题。

| 资源 | 当前类型/固定色 | 静态判断 |
|---|---|---|
| `bookshelf_compass_active`、`bookshelf_library`、`bookshelf_library_active`、`bookshelf_rss_active`、`bookshelf_settings_active` | `#FFFAF4` | 导航选中 on-primary 图；固定前景是有意的形态 |
| `discover_apply` | `#FFFFFF` | 主操作 on-primary 图 |
| `import_choose_file`、`import_done` | `#FFFAF4` | 导入主操作 on-primary 图，公共消费者与标签一致 |
| `manga_sheet_horizontal_active`、`manga_sheet_moon_active`、`manga_sheet_sun_active`、`manga_sheet_vertical_active` | `#FFFAF4` | 漫画面板选中 on-primary 图 |
| `source_add` | `#FFFAF4` | 书源添加主操作 on-primary 图 |
| `bookshelf_multiselect_trash` | `#D7473E` | 既有危险动作固定色；属于日夜危险色策略审查项，不能只因缺 night 断言资源缺失 |
| `import_summary` | `#C0392B` | 导入未全部成功状态的既有固定红色 |
| `reader_auto_stop` | `#8C3D36` | 自动翻页停止的既有固定危险色 |
| `reader_tts_make_stop` | `#A8543A` | TTS 停止既有固定色 |
| `rss_manage_delete` | `#AB2E28` | RSS 删除既有固定危险色；当前产品开关需与可见页面清点分开 |
| `reader_control_replace_add` | `stroke="white"` | 固定白色 on-primary 图，不是缺失描边颜色；六位 hex 扫描不会把它当成可替换色 |
| `reading_paper_phone_highlight`、`reading_paper_phone_shade`、`reading_paper_tablet_highlight`、`reading_paper_tablet_shade` | 无 hex 固定 paints | 纸张光照/阴影 primitive，不是交互图标，不应按按钮资源补配对 |

## 已确认问题与规则缺口

| ID | 分类 | 位置与原因 | 影响边界/处理依据 |
|---|---|---|---|
| FND-01 | 确定不一致 | `BookshelfMoreMenu.ets:181` 将下载列表 muted 图直接用于普通菜单入口；菜单分支不染色 | 五项菜单中的下载项，day/night 都成立。应按菜单普通动作基线选独立语义资源/有限菜单配方，不全局改下载列表状态图 |
| FND-02 | 既有同组不一致 | `BookshelfMoreMenu.ets:180` 使用设置强调色的 refresh 资源；同组其他普通操作是 ink | 更新正常态已混色；enabled/disabled 仅改变透明度，不能解释正常态强调。与 FND-01 一起梳理菜单规范 |
| FND-03 | 统一责任缺口 | `ReaderIconButton.icon`、`ReaderLabeledIconAction.icon` 和 `ReaderMenuActionView.icon` 都是任意 Resource；spec 控制几何/文字，缺少 icon role/资源族关联 | 公共组件复用不等于颜色统一。有限组合需明确“普通/次要/强调/on-primary/危险/显示状态”及资源变体，避免相似图形跨场景直接借用 |
| FND-04 | 状态规则缺口 | `ReaderIconButton.ets:22–30` 与 `ReaderLabeledIconAction.ets:113–129` 的 enabled 控制准入，但未定义图标的独立禁用色/透明度；菜单有 0.45，面板有 0.48 | 静态确定实现不同；是否需要全家族统一弱化尚无当前统一约束。本轮不凭视觉偏好修改 |
| FND-05 | 主题语义关联缺口 | 固定 SVG 的旧原色映射与运行时 role 分别存在，例如 night `#BAAD9C`/`#ABA99F`、`#EADFCE`/`#EAE7DE` | 不是全应用主题坏了；存在同语义前景难以自动保持一致的结构性风险。应逐场景决定继承基线或改配方，不能全局替换近似色 |
| FND-06 | 发现范围约束 | `generate-theme-icons.mjs:16` 只扫描 `.ets` 中受支持的完整字面量，拒绝推断任意动态字符串；computed consumer 另有明确专项来源 | 新增动态 icon name 或 `.ts` 资源映射后，仅运行通用生成器不保证自动纳入。当前已有固定配方和专门消费者处理，不等于本次发现缺文件 |
| FND-07 | 历史文档范围漂移 | `foundation-controls-icon-20261003.md` 描述 6 个 RSS variant；`f01-finite-icon-owner-20261004.md` 描述 5 个声明/4 个 spec；当前为 8 个 labeled variant / 6 个 button spec | 旧文档证明当时有限切片与历史本地结果，不覆盖本次新增菜单，也不是当前全量审计/视觉验收 |

## 正常例外与验收边界

- 普通工具栏动作、主按钮白色前景、危险动作、选中导航、次要章节状态、空态插画、漫画不可用图片图形、原生 loading 是不同角色，不能要求全部同色或同尺寸。
- 图片可见尺寸与实际命中框是两件事。公共 toolbar 的 44 vp 命中框可以放 20/22/24 vp 图，有限“返回”配方仍是 32/20；本次未自行扩大所有按钮。
- 顶部 menu 与底部 action sheet 复用同一个文件，却是不同渲染分支、不同 tint 行为。将其统称“统一框架，所以颜色会相同”不成立。
- 本轮对下载菜单色差有源码与 SVG 直接证据，不需要为定位它先做真机复测。其余“是否视觉过淡、线重是否合格、按下和原生禁用效果”等设备像素问题，本分册没有标为已验收。
- 历史测试文件只作为规则与覆盖范围资料阅读，没有执行，也没有把旧 PASS 转写成当前 PASS。
