# 阅读与漫画悬浮栏几何问题（2026-10-20）

## 范围与批准依据

用户确认的 `reader-controls-preview.html` 为本次几何方向：轻量页头外侧 8vp、正文 18vp、轻量底栏 30vp；详情仍按其正文 20vp、底栏 30vp。原型位于本机 `/Users/minliny/.codex/visualizations/2026/10/19/01a1550e-5116-73f1-b126-74ffb983bbd2/reader-controls-preview.html`。

本记录覆盖当前生产 `BookDirectoryPage`、`MangaDirectoryCurrentFooter`、`MangaReadingSurface` 与 `ReaderControlPanel`。复杂阅读 Quick/Full、漫画目录/阅读方式/设置/下载面板保持各自当前宽度与原控件；不引入原型额外按钮、状态分组、流程或业务行为。下载多选逻辑不属于本记录的修改。

## 代码侧定位与修复

| 页面与状态 | 原始问题/证据 | 本次处理 |
| --- | --- | --- |
| 完整漫画目录，固定当前章节底栏 | `mangaPage` 向 `ReaderPageScaffold` 传 `contentEndInset=mangaBottomClearance`，父级把全宽内容缩高并 clip；`footerSurface='solid'` 又把底栏外的区域铺成整条背景。该效果超出悬浮卡片轮廓。 | 改为透明 footer 宿主且保留完整内容 viewport；真实底栏高度、安全区与原有 Grid 尾部间距仅通过 `mangaListBottomClearance` 传入 Grid/List 的内容末端 offset。 |
| 完整漫画目录，当前章节卡片 | 原 footer 与 `contentFrame` 完全同宽，外轮廓和条目外缘重合。 | 正文 18vp，底栏在正文每侧额外内缩 12vp；大窗沿用正文上限并相应减窄。组件的 `availableWidth` 与实际外宽同源，字号/长位置触发堆叠与高度预估使用缩窄后的宽度。 |
| 完整漫画目录，浮动页头 | 旧头栏仅比正文每侧宽 4vp。 | 对应批准方向每侧宽出 10vp；按实际左右系统交互安全区夹限，保留现有返回与下载管理入口。 |
| 完整漫画目录，短窗/大字号的流式底栏 | 底栏进入随目录滚动的工具区；不能再把同一底栏高度算入固定尾部。 | 保持原 flow 判定、唯一 footer 生产者和有符号滚动原点；流式卡片居中并使用同一较窄宽度，尾部仅保留原安全区间距。 |
| 漫画阅读，轻量顶部/底部控制栏 | 顶栏每侧 16vp，底栏每侧 16vp；最大 18vp 阴影使轻量实体边界较模糊。原内容并未因底栏缩高。 | 顶部外侧 8vp，底部外侧 30vp；保留原进度与三个模块按钮及内边距，阴影半径收为 8vp。复杂操作面板宽度不变。 |
| 小说阅读 Home、目录/书签、界面、设置、搜索、朗读、自动翻页、替换，Quick/Full 与中间过渡 | 公共内容 viewport 只有矩形 clip；与内容同尺寸同坐标的描边是兄弟节点，描边圆角由 8vp 变到 12vp。Full 目录不透明当前章节底栏尤其容易填入圆角外区域。 | 公共内容 viewport 添加同一 `8+4*p` 圆角后再 clip；保留当前面板尺寸、兄弟层次、手势与输入开关。 |

`MangaDirectoryCurrentFooter` 的背景、描边和后代使用同一圆角裁切；它是当前阅读位置展示，未新增可点击语义。完整漫画目录原有 Grid/List、导航目标、当前章节定位、筛选排序和下载回调仍是原生产路径。

## 已审计但不改成正文宽的表面

- 小说 `ReaderControlPanel` 的复杂 Home/Quick/Full：保留当前布局轴和独立宽度；不通过缩窄正文、减小点击目标或裁掉控件来制造轮廓差异。
- 漫画阅读的目录、更多、下载、阅读方式、设置：属于复杂面板；保留原面板宽度、原安全区和滚动容器。
- 独立小说目录 `ReaderFullDirectory` / `FullDirectoryPanel`：现有外壳与内层内容已有圆角 clip；列表与工具/状态栏是面板内分区。
- 小说详情与漫画详情由普通页负责人处理/核对；漫画详情既有正文 20vp、底栏 30vp 已满足轻量宽度差异，本记录不覆盖并行修改。
- 常驻朗读/自动翻页胶囊的 24vp 视觉与 44vp 响应区属于独立可点性设计；额外响应区不等于实体背景扩张，本次不改。
- `ReaderControlMotionStage` 只属于验证页面，不作为生产控制栏修复入口。

## 验证入口与证据边界

仅选择以下本次必要检查；各入口无嵌套测试调用，不使用父项/兄弟 case 或全量回退，不构建项目、不生成/签名 HAP、不连接设备。

1. `H-floating-page-content#native-insets`：Node + 已安装 ETS SDK 的实际 List/Grid/Surface 属性探针；本次把末端避让迁入内容 offset，需要确认该通路仍单次发布并保持 native viewport。
2. `H-manga-book-directory-chrome#adaptive-footer`：当前实际 Page/Scaffold/Footer/Grid 的短窗、字号、底栏测量、固定/流式位置和原 Scroller 关系。原断言错误地要求旧的全宽 viewport 截短及 solid 背板，已按本次批准行为修正；保留重新引入旧缺陷的反例。
3. `H-book-directory-page#manga-header`：实际漫画页头对非对称系统安全区的边界，不扩大到普通目录或其它业务。
4. `node --check` 仅检查两处修改过的回归文件语法；`git diff --check -- <本次文件>` 仅检查本次补丁格式。

索引中已封存的测试定义不现场重拍指纹；定义变化导致调度器拒绝时记 FAIL/未完成，不绕过准入。源码修改、SDK 属性探针、HAP、设备像素/触摸、用户验收分层记录。

### 本次执行结果

| 入口 | 结果 | 边界 |
| --- | --- | --- |
| `H-floating-page-content#native-insets` | PASS，唯一所选 case，799ms | 实际 SDK List/Grid/Surface 的 offset 单次发布；运行日志 `/var/folders/53/6tc2ktbd19dbwxd5pmbp0d_w0000gn/T/reader-contract-run-1vIoAj`。不代表整页像素/手势通过。 |
| `H-manga-book-directory-chrome#adaptive-footer` | FAIL / 未完成：`REVIEW_NEEDED for changed definition tools/test-manga-book-directory-chrome.mjs` | 调度器在 case 执行前拒绝修改后的定义；不是生产断言失败。保留待复审的当前用例和旧缺陷负例，没有重拍指纹或绕过准入。 |
| `H-book-directory-page#manga-header` | FAIL / 未完成：`REVIEW_NEEDED for changed definition tools/test-book-directory-page.mjs` | 新增真实 `mangaFooterFrame` 方法已加入旧 probe 的方法依赖；定义指纹拒绝发生在 SDK 执行前，不误归因于生产几何。 |
| 两个回归文件的 `node --check` | PASS | JavaScript 语法检查；不冒充 case 运行。 |
| 本次文件 `git diff --check` | PASS | 补丁格式；不冒充产品功能测试。 |

源码检查已核对：正文/头栏/底栏的真实 width、padding、背景与圆角裁切归属；固定与流式 footer 均使用同一较窄宽度；父级不再通过高度或实体背板制造全宽遮挡；native Grid 与 fallback List 的尾部都从同一个测量来源取值；原始目录导航、当前定位、下载回调和 Scroller 身份不改。两个回归 fixture 补入新方法及完整默认 metrics 对象，避免旧测试 stub 缺依赖被误判成生产错误。

未执行 HAP、VM、真机或用户验收，不能从源码/SDK 属性推断实体像素与交互已经通过。

## 漫画整书下载操作补充审计与最小修复

完整漫画目录顶栏 `BookDirectoryPage.mangaDownloadMenuButton` 通过不带 chapterIndex 的 `openDownloadActions()` 打开现有 `ReaderMangaDownloadPopup`，`Index.loadMangaDownloadActions → ReadingOfflineHost.loadMangaActions → MangaDownloadActionsGateway.actions` 为真实生产接线。阅读内完整目录与详情完整目录复用该消费者。原 Gateway 在没有 paused 章节、Host 非忙且存在 maxAttempts>0 的 queued/inProgress/failed 章节时，同时返回“下载全部章节”与“取消下载”；活动章节还会附带“暂停下载”。现有 Panel 原样渲染全部 action，不做互斥。

`MangaReadingSurface` 虽有“本书下载”标题分支，当前正常 `openDownloadActions` 调用均来自目录章节并传入 index；更多菜单的整书下载直接调用既有提交入口、下载管理跳全局页，不能把该标题分支误计为可达整书面板。单章与章节多选入口、目标和 action 规则本次保持原样。

整书分支仅保留一个既有主操作行：真实完整目录中存在可取消任务时显示“取消下载”；无任务且全部章节为 completed 时显示禁用的“已下载”；其余状态显示“下载全部章节”，Host 忙时禁用。整书 pause/resume 从该弹框减去，不新增任务分组、按钮或流程；原存储清理操作保留。cached 仍不是 completed。

完整性来自当前 session.entries 的有效 canonical chapterIndices/url 与状态快照精确一一对应、非空且无重复，并随 Host 物理投影合并保留；部分/空/错目录快照不能被宣称为整书完成，主行保守禁用。DTO 仅增加可选 enabled，复用 ActionSheet 已有禁用能力；Panel 分发再次检查当前 enabled，阻止旧回调触发已禁用行。Core、队列执行、下载目标均不改。

### 补充验证选择（执行前记录）

仅执行 `tools/evidence/floating-controls-20261020/manga-book-actions-probe.mjs`：直接调用已安装 ETS SDK 编译的生产 Gateway/Host 方法与现有 Panel SDK builder；嵌套仅为现有 SDK 编译/属性探针工具，无历史测试、父套件、构建或设备。纯方法核对目录完整性、排他主槽、cached/completed、busy/unknown、存储保留与单章 action 原样；SDK 核对实际 ActionSheet enabled 和旧回调再验证。必要性是这三个生产文件新加入的状态与禁用边界不能由既有几何检查证明。另只做该脚本语法与三个新增源码/本文档的补丁格式检查；不更新封存门禁指纹。

补充执行结果：上述 issue-local probe PASS；以固定 `8a8328822d9002a8f6fb044ed508a7cc6b000bac` 的实际 Gateway 为基线，64 组单章状态/Host busy/任务资格/存储组合的 action 完全一致。整书十个状态组合、目录空集/缺章/多章/重复/URL 变化、外部空集+complete=true、Host 物理投影以及真实 SDK 禁用行和旧回调重验均通过；脚本语法与定向补丁格式通过。未调用历史下载门禁，未修改封存定义，未构建或连接设备；不因此改变上节两个几何用例的 FAIL/未完成记录。

## 夜间颜色层级补充（2026-10-20）

本轮仅处理用户授权的夜间层级，保留既有色调、日间配置、小说八种正文纸色和漫画强选中 accent/green；不把全应用改为绿色，不重做几何或业务。漫画仍使用既有灰绿体系；小说控制注册表由主负责人统一处理。本文件的实测与源码证据层级不变。

确定的局部源码问题：自动翻页“跟随高亮”行原有 enabled=false 时夜间颜色完全不变，现仅把同一 enabled 条件派生为 0.45 透明度，日间及已有输入条件不变；漫画阅读顶/底栏和章末卡片实体色跟 backgroundPreference，阴影却跟 appThemeScheme，现让阴影与真实阅读背景使用同一上下文。漫画目录 native Grid 与 List 分支中的既有漫画 scrollbar 表达式，以及详情 Scroll 不再写死黑色，改读既有 scrollbar 角色；不改变目录、章节、下载、Scroller 或几何。

主负责人确认的最终 night 矩阵：paper `#1C1E1A` 保持，surface `#30342D`、soft `#3F433C`、active `#4A5647`、line `#4E5349`、frame `#5B6255`、muted `#C8C6BB`、scrollbar `#99A6AD9F`。五个容器/边界角色均由原灰绿逐 RGB 通道等量增亮，色相不变、相对饱和度下降；较亮容器上的次级文字另提高亮度，保留主文字、green/accent、弱色和其它角色。该矩阵只进入 canonical visual.json，再由既有生成器投影。

### 本轮必要执行计划（执行前记录）

1. 漫画矩阵经主负责人确认后，执行 `node tools/generate-manga-directory-visual.mjs`：仅从 canonical `Reader-UI/design/manga-directory/visual.json` 投影 Host 的 `MangaDirectoryVisual.ts` 与 Reader-UI 的 `visual.generated.mjs/.css`；读取固定 Arrow SVG 和 provenance 做输入身份检查，无测试子调用、构建、设备或图标写入；不传 `--demo`，不更改历史原型。随后 `--check` 只核对三个投影及四个既有箭头资源（ink/accent 不变，防止生成输出与资源失配）。
2. `node tools/evidence/night-colors-20261020/reading-manga-probe.mjs`：新建 issue-local 生产 SDK/method 证据入口，仅调用现有 SDK 编译与属性探针，无旧门禁子调用。验证漫画日间/纸底/强选中色与全部 metrics 保持；夜间矩阵由真实生成函数输出；自动翻页跟随行 enabled 与夜间禁用透明度一致；漫画顶/底栏在应用/阅读方案不一致时仍选用阅读背景对应阴影；详情滚动条接同一矩阵。必要性分别是防止色相/范围漂移、生成失配与状态颜色不一致。
3. 已有 issue-local `syntax.mjs` 仅传本轮新增修改的准确 ETS/TS 文件；`node --check` 仅新 probe；`git diff --check -- <本轮文件>` 仅补丁格式。均不触发旧门禁/全量、HAP、VM 或设备，不改变前述 FAIL/未完成记录。

首次执行记录：canonical 生成与 `--check` PASS（224 metrics、16 paint roles），五个本轮 ETS/TS 的 SDK parse、probe 的 Node 语法及两个仓库定向补丁格式 PASS。issue-local probe 在 native 目录分支调用处 FAIL：SDK 将原 `build` lowering 为 `initialRender`，旧 fixture 错调 `owner.build()`；此前矩阵保护、自动翻页和三处漫画阴影断言已执行，目录/详情滚动条部分未完成。该失败归因于新证据 fixture，已改用 SDK 的实际 `initialRender` 入口，仅复跑这一 issue-local probe，不扩大套件。

修正 fixture 后该 issue-local probe 已 PASS；补充同范围的次级文字最低 4.5:1 配置计算与完整 enabled（含交互锁）/漫画显式 scheme 覆盖断言后，最终脚本亦 PASS（1.14s，最低 muted 对容器为 4.515:1）。不增加其它模块或历史用例。目录真实 manga 分支是 Grid，普通 List 保持原未指定 scrollbar 颜色；旧 List 分支中的 manga 条件表达式也改为同一角色，但不把当前不可进入的 manga List 子分支冒称为已观察到的生产状态。

本轮最终证据：canonical SHA256 `8536368e70fcb68449c882e28fa818686155ebd56b7bcb141b5155893ba91bf8` 的生成/一致性检查 PASS；本轮五个生产 ETS/TS 的 installed SDK parse PASS；issue-local 实际 SDK Builder 与矩阵保护 PASS；脚本 Node 语法、两仓定向补丁格式 PASS。以上属于源码/SDK 及配置对比计算，不证明真实屏幕、动态合成、VM、设备或用户验收通过；未执行任何构建或设备动作。
