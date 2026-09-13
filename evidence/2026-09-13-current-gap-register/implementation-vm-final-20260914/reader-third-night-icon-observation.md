# 第三包 Night 图标与强调文字观察

记录时间：2026-09-13T16:37:39.464123+00:00。截图产物前缀：`reader-control-r9509-1789315814956`。

此记录仅使用已采集的 PNG/JSON，不含 HDC、点击、安装或设备操作。输入 SHA256、实际原图 bounds、祖先有效 opacity、ROI 色彩统计均在同名 JSON。

## 已观察的可见态

- 阅读导航：5 个页面 × 4 个图标，20 个 ROI 全部符合角色。选中深色 `#1C1A18`，未选中金色 `#D2BD96`；没有旧 `#2F6373` 像素。有效父 opacity=0.999557，主要实际颜色 `#1D1B19` / `#D1BC95`，与 SVG 每通道偏差≤1。
- Home 三快捷动作：搜索、自动翻页、替换均为 ink `#EADFCE`，每通道≤1；无旧青色。
- App 书架/设置：各两个导航图标共4个 ROI，选中浅色 `#FFFAF4` 配原 `#7A684F` 填充，未选中 `#BAAD9C`；三设置行图标均为 `#D2BD96`。这些既定实心按钮配色不修改。
- 独立 FullDirectory：11 个完整可见空书签图标符合 muted `#BAAD9C`。本地书截图没有下载标记、已有书签状态，不能推断这些状态通过；保留其生产方法/SVG回归证据层。
- 换源与书内搜索：Full→Quick 后 native shell 由 `[46,388][1235,2734]` 变为 `[46,1579][1235,2734]`；收起事件端点可达。collapsed PNG 未采，不能用端点布局证明过程流畅。树中 retained 的收起按钮自身 opacity=1，但祖先有效opacity=0，不能算可见残留。

## 发现并代码定位的问题

`LocalBookDetail.chapterSection` 的“完整目录”是94×30描边/卡片动作，文字原用 `TOK_PRIMARY_DARK`，Night为填充色 `#7A684F`；同一按钮图标为Night primary `#D2BD96`。截图文字bounds `[969,1442][1138,1491]` 有3061个精确 `#7A684F` 像素。合同 `READER_REPAIR_SPEC.md:114` 已规定 Night 强调文字/描边用 primary，实心底用 primaryDark，因此是角色用途误接，不是新增主观换色。

先失败后修复的实际SDK Builder：Night字体色原 `#FF7A684F`，预期 `#FFD2BD96`；修改后通过 Day→Night→Day，字体12/900/ReaderInter、94×30圆角999绘制区与94×44点击区、原背景/边框均保持。

## 定点修复与完整同类清单

统一新增共享角色 `TOK_PRIMARY_TEXT`：Day复用当前文字 `TOK_PRIMARY_DARK` (`#1F3528`)，Night复用既定App primary (`#D2BD96`)；alpha均1。来源写入 `Reader-UI/theme/registry.json`；两个生成TS镜像同步为577完整App角色。41个生产fontColor只改消费此角色；没有逐处scheme三元表达式，没有修改原primaryDark的定义、背景、边框、OnPrimary或其他状态分支。

审计所有生产 `.fontColor` 参数（SDK AST，含跨行与嵌套状态条件），得到14文件41处；表内各项均为卡片/软底上的强调文字，或条件实心按钮中的非primary前景。

| 文件（entry/src/main/ets/features 下） | 行号：生产方法 | 数量 |
|---|---|---|
| `bookshelf/BookshelfEmptyCard.ets` | 114：`build` | 1 |
| `bookshelf/BookshelfManagementPage.ets` | 100：`statusCard`；184：`groupRow`；243：`assignmentBookRow`；299：`actionButton`；307：`smallAction` | 5 |
| `bookshelf/LocalBookDetail.ets` | 319：`chapterSection` | 1 |
| `common/ReaderSelect.ets` | 113：`appearanceTrigger`；202：`defaultTrigger` | 2 |
| `common/ReaderSelectPanel.ets` | 188：`appearanceSelectedRow`；212：`defaultSelectedRow` | 2 |
| `rss/RssEntryDetailPage.ets` | 178：`sourceCard`；314：`originalLinkCard`；350：`bottomActions` | 3 |
| `rss/RssPage.ets` | 171：`topBar`；202：`refreshPill`；217：`refreshPill`；243：`managePill`；504：`sourceItem`；566：`recentUnreadHeader`；802：`stateButtons` | 7 |
| `rss/RssSourceFeedPage.ets` | 195：`entrySectionHeader` | 1 |
| `rss/RssSubscriptionEditorPage.ets` | 68：`build`；201：`sectionTitle` | 2 |
| `rss/RssSubscriptionManagementPage.ets` | 121：`backBar`；166：`sourceDocumentAction` | 2 |
| `settings/RulesManagementPage.ets` | 136：`statusCard`；308：`actionButton`；352：`smallButton` | 3 |
| `source/SourceManagementPage.ets` | 255：`statusBanner`；507：`loginButton` | 2 |
| `source/SourceToolsPage.ets` | 307：`batchCheckCard`；413：`batchResultRow`；429：`statusCard`；619：`smallButton`；640：`actionButton`；661：`fullWidthActionButton` | 6 |
| `sync/SyncPage.ets` | 282：`configActions`；325：`manualActionsSection`；350：`manualActionButton`；447：`scopeRow` | 4 |

条件边界：busy 状态只修改 busy 分支；SourceTools 的 failed/warning 语义色原样；passed 状态原 dark-primary 强调文字改用 primary-text，未重新定义成功色。selected/primary 为真时仍用原OnPrimary和primaryDark填充，未选中/非实心文字使用新角色。

## 本地门禁与边界

- `test-theme-primary-text.mjs`：41个实际生产AST前景调用、21个实际SDK保留Builder状态通过，覆盖文字/图标与绘制区、Day→Night→Day、主/次按钮、busy分支。原生产失败证据为 `reader-third-night-icon-primary-builder-before.json`，通过证据为 `reader-third-night-icon-primary-builder-after.json`。
- 受影响的15组本地测试通过：新增primary-text、dynamic-icons、theme-selection、theme-local-consumers、theme-host、RSS subscription/page/responsive、bookshelf-management/detail-removal/reading-entry、source-product-tools、sync-webdav、rule-entity-management、select-semantics。
- 注册表生成检查通过（577×2、8阅读主题），SVG生成漂移检查通过（165变体未变）。首次误调用不存在的 `test-theme-registry.mjs` 是检查脚本名称错误，未执行测试；已改为存在的 theme-local-consumers / theme-selection / theme-host，加真实generator `--check`，未把缺失脚本当通过。
- 当前新文字修复未再次编译/HAP/安装/采图：这些门禁由root统一执行。上述第三包截图只证明已有图标修复；不证明本轮新文字色已在VM通过。
- 所有观察输出仅 `/private/tmp/reader-third-night-icon-*`；未改根总账、目录锚定文件、HDC或Git。
