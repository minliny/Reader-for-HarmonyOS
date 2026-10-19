# 日夜图标覆盖与可读性补审

2026-10-20。发现时为重复清理后的429 SVG，只读审阅498个ETS/TS消费者；随后在原修复授权内仅改两处调用并生成对应三项资源，当前432 SVG。本子任务没有运行门禁、测试、构建或设备操作。

**两项明确低对比配色组合已在源码与资源层修复；当前432 SVG、20个无独立night的基础资源均为已列出的正常例外或非当前消费者，孤儿night为0。** 发现时21个无night资源保留在下表，新增规则加号已补night；不能把源码修复推定原生像素或用户验收通过。

| 盘点 | 数量 |
|---|---:|
| 当前SVG | 432（发现时429） |
| 基础文件 | 226（发现时225） |
| night文件/完整配对族 | 206（发现时204） |
| 基础有、同名night无 | 20（发现时21） |
| night有、对应基础无 | 0 |

`bookshelf_library` 已作为相同字节别名合并到 `bookshelf_library_active`，动态MainTabBar返回也同步，不能仍拿被退役的旧名配对判缺图。21项完整名单及每个完整/裸名消费者、所在方法、条件、SHA和当前/保留/关闭分类见[机器清单](night-coverage.json)。当前可达性仍是静态接线，不代表原生所有像素状态已验收。

## 发现时问题与已完成的最小修复

**NIGHT-01：完整替换控制栏“新增规则”图标和文字在夜间为白字/白加号配浅金底。**

`ReaderControlReplaceContent.ruleToolbar:365` 传固定 `reader_control_replace_add`；SVG为white描边且没有night。`toolbarButton:355–358` 的文字也沿固定白色角色，背景采用 `TOK_READ_PRIMARY`，其night值为 `#D2BD96`。该内容由当前 `ReaderControlPanel:1455` 构造。白/浅金的颜色对比测算约 **1.83:1**，这是当前源色组合的可读性缺口；不能简单补一个仍为白色的night文件算修复。

已修：新增规则图按appThemeScheme选择原day/新增night；现有特定文字role夜间同步为既有前景#302B25，日白保留。夜间源色对比约7.65:1；加号、尺寸、布局和openEditor准入不变。对比值是源色计算，不冒充真机合成像素测量。

**NIGHT-02：在线TTS尚未配置的“立即配置”箭头借用了普通下一级灰色。**

发现时`onlineServiceInfoRow`把普通`reader_appearance_make_chevron`放在实色TTS主操作底：日#857C70配#2F6373约1.62:1；夜#BAAD9C配#D2BD96约1.20:1。

已修：只在`httpEngines.length===0`使用新`reader_tts_configure_chevron`日夜资源，沿现有按钮文字前景日#FFFAF4/夜#302B25，源色对比约6.42/7.65:1；已配置分支保留原appearance chevron，12×12、布局和`openConfiguration('manage')`不变。两项均只到源码/资源完成，构建、原生呈现和用户验收另记。

## 发现时全部21个无独立night基础图（修复后剩20个）

| 资源 | 当前消费者/范围 | 判定 |
|---|---|---|
| `bookshelf_compass_active` | L0关闭：MainTabBar.tabIconResource@195 | L0关闭发现tab；固定浅色仅用于选中深底。 |
| `bookshelf_library_active` | 当前静态构造链：MainTabBar.tabIconResource@186；MainTabBar.tabIconResource@192 | 当前书架tab（含原bookshelf_library别名合并）；24vp，选中/侧栏深底TOK_PRIMARY_DARK夜间#7A684F，与浅色前景约5.16。 |
| `bookshelf_multiselect_trash` | 无生产消费者 | 当前生产没有资源字面/裸名消费者，多选移除已用有night的reader_danger_trash；未删除的历史资源不算当前夜间缺失。 |
| `bookshelf_rss_active` | L0关闭：MainTabBar.tabIconResource@198 | L0关闭RSS tab；选中深底的浅色前景。 |
| `bookshelf_settings_active` | 当前静态构造链：MainTabBar.tabIconResource@201 | 当前设置tab选中深底；不是普通未选中状态，未选中另用outline/night。 |
| `discover_apply` | L0关闭：DiscoverPage.filterRow@271 | L0关闭发现主操作，白色onPrimary，保留实现不冒充当前可见。 |
| `import_choose_file` | 当前静态构造链：ReaderBoundedSurfaceActions.fileAction@74 | 当前选择文件主操作15vp，app.action.fill夜间#7A684F，与浅色前景约5.16。 |
| `import_done` | 当前静态构造链：ReaderBoundedSurfaceActions.fileAction@74 | 当前导入结果完成主操作14vp，沿相同action.fill和TOK_ON_PRIMARY文本。 |
| `import_summary` | 无绘制消费者的helper：LocalImportDialog.summaryIcon@465 | 仅LocalImportDialog.summaryIcon声明引用；当前render未调用该helper，结果头部为文字。固定红不能证明当前屏幕错色。 |
| `manga_sheet_horizontal_active` | 当前静态构造链：MangaReadingSurface.choiceIcon@1764 | 当前漫画横向选择18vp，选中深绿；非选中有独立day/night资源。 |
| `manga_sheet_moon_active` | 当前静态构造链：MangaReadingSurface.choiceIcon@1766 | 当前漫画深墨选择18vp，选中背景#324C37，浅色前景约9.09；不是漏夜版。 |
| `manga_sheet_sun_active` | 当前静态构造链：MangaReadingSurface.choiceIcon@1765 | 当前漫画暖纸选择18vp，选中深绿；不由应用主题判断选中图。 |
| `manga_sheet_vertical_active` | 当前静态构造链：MangaReadingSurface.choiceIcon@1763 | 当前漫画竖向选择18vp，选中深绿；非选中有独立day/night资源。 |
| `reader_auto_stop` | 保留未挂载：ReaderAutoPagePanel.stopControl@274 | 仅未挂载ReaderAutoPagePanel.stopControl固定#8C3D36；当前ReaderControlAutoPageContent采用有night的reader_auto_full_stop。 |
| `reader_control_replace_add` | 当前静态构造链：ReaderControlReplaceContent.ruleToolbar@365 | 发现时固定white无night，浅金底约1.83；已补reader_control_replace_add_theme_night并沿既有前景role修复，当前不再计入20个未配对例外。 |
| `reading_paper_phone_highlight` | 当前静态构造链：ReaderPaperBackground.paperHighlight@54 | 纸面光照渐变，sourcePaperLighting准入；不按操作图标日夜配对。 |
| `reading_paper_phone_shade` | 当前静态构造链：ReaderPaperBackground.paperShade@58 | 纸面阴影渐变，sourcePaperLighting准入；不是缺图。 |
| `reading_paper_tablet_highlight` | 当前静态构造链：ReaderPaperBackground.paperHighlight@53 | 展开纸面光照渐变；由实际阅读主题决定显示。 |
| `reading_paper_tablet_shade` | 当前静态构造链：ReaderPaperBackground.paperShade@58 | 展开纸面阴影渐变；由实际阅读主题决定显示。 |
| `rss_manage_delete` | L0关闭：RssSubscriptionManagementPage.actionBar@325 | 仅L0关闭RSS管理，固定#AB2E28；保留夜间角色风险，不算当前主界面缺失。 |
| `source_add` | 当前静态构造链：SourceManagementPage.bottomActionBar@710；SourceManagementPage.searchField@298 | 当前书源导入/新增，18vp顶部或公共leading；深主操作底与固定浅前景，文字同onPrimary。 |

## 为什么固定浅色不等于缺夜版

- 导航选中、导入主动作、书源新增采用深操作底；night `TOK_PRIMARY_DARK` / `app.action.fill` 为 `#7A684F`，固定浅前景 `#FFFAF4` 的源色对比约5.16:1。未选中图另有普通/night分支，不能拿选中白图去要求普通状态同色。
- 漫画选态始终落在深绿选中底；深墨时 `#324C37` 与浅前景的源色对比约9.09:1。非选中图有自身night资源，选择状态和应用主题分开。
- 光照/阴影SVG是阅读纸面内容primitive，受实际阅读主题的 `sourcePaperLighting` 控制，不应按交互图标补night；纸纹PNG不纳入本429 SVG统计。
- 固定危险色旧图有的未引用、有的只剩未挂载或L0关闭消费者；它们保留将来恢复前的夜间风险，但不能混入当前可见缺失数量。

## 位图与应用图标补充

SVG计数不包括 entry 媒体的6个PNG及AppScope应用图标。另核对这7项：

| 位图 | 尺寸 / 消费 | 结论 |
|---|---|---|
| `bookshelf_title`、`import_dialog_title`、`import_result_title` | 56×28、107×17、71×17；当前静态源码未见这些完整名字的绘制消费，现页面标题使用文字 | 低像素旧标题资源不计成当前正在模糊的图标；不以没有night文件判当前缺失。 |
| `reading_paper_phone`、`reading_paper_tablet` | 均200×200，ReaderPaperBackground按实际阅读主题的paperTexture准入，重复100vp纸纹 | 内容纹理，不是操作图标；显示与否由纸面主题控制。 |
| `start_icon` | 256×256，不透明位图，module.json5的startWindowIcon | 固定启动品牌图，无night本身不代表失败。实际启动图标物理显示尺寸未采集；若系统放大超过256px存在位图放大风险，未宣称已经发生。 |
| AppScope `app_icon` | 1254×1254，不透明位图，AppScope/app.json5的应用图标 | 桌面品牌图有自身底，不按应用普通操作图的日夜配对处理；没有以普通SVG统计冒充它的清晰度证据。 |

## 清晰度与证据边界

21项均为SVG，文件没有night后缀本身不降低设备绘制分辨率。导入14/15vp、书源18vp、漫画选择18vp、导航24vp是现有有限图形尺寸；矢量不意味着这些细小符号天然可读。NIGHT-01是低对比，不应靠提高采样尺寸掩盖。

本补审没有逐帧原生缩放、按下、辅助服务或不同屏幕密度验收；不能由206配对族或静态颜色直接宣称所有清晰度都合格。正在交付包的实际构建和安装结果由主任务单独记账。
