# 悬浮栏、下拉控件与书籍操作统一调整（2026-10-20）

本次基线：`codex/message-ui-unification-20261019`，HEAD `8a8328822d9002a8f6fb044ed508a7cc6b000bac`。工作树已有文档与工具链修改，保留其内容。用户确认的是现有 UI 上的尺寸调整与减法，禁止将 Demo 中曾额外加入的任务分组、阅读入口、状态面板迁入应用。

## 已确认范围

- 书籍入口的下载管理页：区分可见轮廓、背景绘制、布局占位与命中边界；顶部略宽于正文，底部轻量栏略窄，保留明确内边距和可滚动尾距。
- 下拉控件：闭合宽度根据当前值；展开菜单独立约束；短文案不截断，长书源折行，不能由最长值无限撑宽菜单。
- 单书操作：下载与取消下载共用原有操作行；全部下载后同一位置显示禁用的“已下载”；保留删除本地内容，不能加入任务选项或阅读章节入口。
- 书籍操作弹窗采用书名单标题，安全区间距只计一次，不能叠加多层空白。
- 章节多选继续使用原有“下载所选／暂停所选／更多”、原有快速选择和原始选中目标，不修改其业务逻辑。

## 发现与代码定位

| 编号 | 现象／触发 | 当前代码证据 | 结论与边界 |
| --- | --- | --- | --- |
| FC01 | 下载底栏轮廓、正文宽度及外部占位混淆 | `SharedDownloadPage` 把 footer 与 header 都接到 `leftInset/rightInset`；原生 List 自身上下 padding 缩小了可绘制滚动视口；Scaffold 透明 footer Column 默认命中覆盖外部空隙 | 分离顶部/底部 inset；List 净空改为内容 start/end offset，透明定位列放行空隙触摸；实际绘制栏同节点 clip。源码修复与原生渲染验收分别记录。 |
| FC02 | 筛选短值空白过大，长书源菜单宽或截断 | `selectClosedWidth` 用 `[value,...options]` 测最长值；`ReaderInlineSelect` 把相同 controlWidth 传给 trigger 和 panel；panel 固定行高 | 触发器与菜单分开量测、约束与折行高度。 |
| FC03 | 下载、取消被拆为两行 | `operationsActions` 返回 download/pause、cancel、deleteLocal 三项，书籍与章节共用 | 只改变 book-actions 分支；chapter-actions 分支、`selectionDock`、`quickSelectChapters`、`captureSelection/sendAction` 保留。 |
| FC04 | 操作弹窗底部大空白及标题重复 | `operationsBody` 的 Scroll 原只有 maxHeight、缺少内容高度回执；body 的 contentInset 与外层 safeInsets 分开叠加；单书标题含“书籍操作”。当前 shared minimumContentHeight 已为0，不能归因于固定最小高度 | 仅书籍分支按真实行内容回执定高，首帧用现有 action-sheet 行规格；底部统一 `max(20,safeBottom)` 一处；章节与其他 action-sheet 不变。 |
| FC05 | 漫画完整目录整书弹窗也可能同时展示下载、暂停/继续、取消 | `BookDirectoryPage` 顶栏无chapterIndex打开 `ReaderMangaDownloadPopup`，经 `ReadingOfflineHost` 消费 `MangaDownloadActionsGateway.actions` | 只合并整书主操作槽并减去该层的pause/resume，保留存储动作；本话分支与实际执行器不改。完成态必须对应当前完整canonical目录，不能由局部下载行推断。详见阅读分项回执。 |
| FC06 | 夜间页面、卡片、面板和控件表面明暗接近；部分菜单普通项与选中项实际同色 | 唯一 App registry 已正确按主题生成，但大量 surface role 使用相近底色加低 Alpha；Select/appearance/sourceGroup 复用的选中底与菜单底一致。漫画另有 canonical visual palette | 保留各模块当前暖灰/灰绿色系和强调色，只修改 canonical night 颜色；区分凹入字段、面板、凸起控件与选中态；日间、8套阅读纸色和消息类别原配色保留。配色/源代码与设备视觉验收分层。 |
| FC07 | 书架“更多”进入书籍下载管理后，底栏文字与图标不齐且有空白 | `BookshelfMoreMenu` downloads→`Index.openDownloads()` 默认书籍页→`SharedDownloadPage.storageDock`，不属于主导航；空提示仍占固定20vp，字体行高21fp；图标槽36vp却扩展命中到44vp | 无提示不创建行，提示自然高度；文字左对齐与自然换行；图标使用真实44×44vp槽并居中。不改章节多选和操作结构。 |

## 分项清单

- [普通页面与共享浮动标题](floating-controls-pages-20261020.md)
- [阅读与漫画目录](floating-controls-reading-20261020.md)
- [共享选择控件与调用点](floating-controls-selects-20261020.md)

## 本次验证选择

按工作区 `GATE_INDEX.md` 只选择保护实际变更的行为检查。索引查询不执行测试。执行前逐项补充准确入口、实际子调用、触发范围、必要依据与结果；不运行全量，不为 UI 调整构建或占用设备。

### 根任务选择

| 实际入口 | 嵌套调用／范围 | 保护风险与本次必要依据 | 结果 |
| --- | --- | --- | --- |
| `node tools/gate-index.mjs --id H-shared-download-ui#page-actions --run --change ...` | 唯一 `test-shared-download-ui.mjs --case page-actions`；已安装ETS SDK对实际方法lowering、显式IO端口；nestedCalls=[]，无Core/网络/构建/设备 | 书籍下载行改为cancel/download切换，核对发出的书/章节target、确认作用域与保留行为，不运行其他业务case | FAIL：既有阅读入口断言失配，见下 |
| `node tools/gate-index.mjs --id H-shared-download-visual-contract#native-bindings --run --change ...` | 唯一 `test-shared-download-visual-contract.mjs --case native-bindings`；实际SDK header/row方法与测量端口；nestedCalls=[] | 头栏padding/clip改变，核对原header测量delta与长书名行不被固定高截断 | FAIL：既有重试文案断言失配，见下 |
| `node tools/evidence/floating-controls-20261020/probe.mjs` | 现有 `createReaderBuilderProbe` 对实际Page方法lowering；用原生DTO/图标边界；只核对本次book行、完整/部分/未知状态、最新target、章节入口未变及Scroll内容offset | 现有准入case未覆盖新合并行与透明wrapper，补当前局部证据；不是新增默认门禁，不更新任何封存定义指纹 | PASS，当前共享树下进程exit0；不替代失败门禁 |
| `node tools/evidence/floating-controls-20261020/syntax.mjs` | 已安装ETS SDK的parser；显式列出本次17个ETS和1个TS，无子门禁/运行时/构建 | 本轮存在并行自绘框组件集成，局部复核直接改动文件的ArkTS语法，避免新Builder集成错误；不是全项目语义检查 | PASS，18个直接改动源文件 |
| `node tools/evidence/floating-controls-20261020/manga-book-actions-probe.mjs` | 实际Gateway纯模块及实际Panel builder的已安装SDK探针，固定起始提交单章对照；不发网络/RPC、不调用旧门禁 | 补漏漫画整书行，验证真实目录完整性、禁用分发与单章不变 | PASS：10整书状态、完整性负例、64组单章基线对照及实际Panel禁用 |
| `node tools/evidence/floating-controls-20261020/syntax.mjs manga/MangaDownloadActionsGateway.ts manga/MangaDownloadOperationsPanel.ets reading/ReadingOfflineHost.ts` | 只解析后补的3个生产源文件，不重跑已通过18文件或其他套件 | 整书展示事实/可选enabled字段和Panel新增禁用分支的语法风险 | PASS，3个后补源码文件 |

源码实现已按确认版落实。精确本地回归按上表及分项记录执行。HAP、安装、原生交互与用户验收：未执行，不能由 Demo 或源码结果替代。

### 执行中发现的既有检查失配

- `H-shared-download-ui#page-actions` 本次实际执行619ms后 FAIL：原测试第238行要求 `showReadTarget` 后 `consumeBack()===true`，但当前 `showReadTarget` 已经直接发布 `onReadTarget`，不再打开旧阅读入口sheet；`sendAction` 先前已关闭sheet，因此返回false。相关两个方法本次未改，失败不等于本次下载行故障，也不能降记NOT_RUN。保留原测试与失败日志，不修改断言伪装通过。日志：`/var/folders/53/6tc2ktbd19dbwxd5pmbp0d_w0000gn/T/reader-contract-run-FqxQiM/test-shared-download-ui.mjs.log`。
- 根局部探针实际入口：`node tools/evidence/floating-controls-20261020/probe.mjs`。只加载实际Page/Action DTO/图标/共享frame与SDK lowering，使用受控原生measurement边界，无网络/Core/构建/设备；比较章节关键方法与HEAD（允许仅几何clip差异）并验证本次合并行，补当前回归所缺的直接证据，不替代上述失败回执或申请门禁准入。
- `H-shared-download-visual-contract#native-bindings` 本次实际执行1219ms后 FAIL：原测试第177行查找“下载失败”按钮文字，当前未改的 `statusButton` 原本已把失败按钮显示为“重试”。保留该旧合同失配，不更改产品恢复错误文案，也不把门禁结果改PASS。日志：`/var/folders/53/6tc2ktbd19dbwxd5pmbp0d_w0000gn/T/reader-contract-run-K9lU1h/test-shared-download-visual-contract.mjs.log`。
- 根局部探针首轮业务/几何断言已执行，但异步Watch收尾因测试端口遗漏 `ReaderWindowChromeStyle` 而 FAIL；补入实际Chrome DTO与显式window写入边界后重验。首次输出的局部PASS文字不作为成功回执，最终以进程退出码及收尾完整结果为准。
- 共享工作树集成复核时发现并行 UI 修改：新增 `ReaderTransientFeedback`、`ReaderDialogSurface` 等不属于本次浮栏改动；保留其内容。下载确认框把 `Scroll(){...}` 直接写在对象属性的箭头函数中，当前ETS parser在1299行报首个语法错误并产生736项连带诊断。本次仅将同一确认框内容提取到具名 `@Builder`，不撤回并行UI、字段、文案或业务回调。局部探针补入实际新增Feedback类，并绑定固定起始提交，避免把并行改动或移动HEAD混作本次证明。
- 上述局部探针第二次集成准备时，因漏注册新增 `ReaderDialogSurface` 的SDK组件schema而拒绝组件语法。补注册其实际源码schema后，当前Page完整成员lowering及业务/尺寸断言全部完成，进程exit0。该探针不渲染该并行确认框，不把其内容作为原生视觉证据。
- 新文件独立格式检查首轮发现 `ReaderSelectGeometry.ts` 文件末尾多一个空行，`git diff --no-index --check` 状态3；已仅移除该多余空行，再检查全部8个新增文件。此前普通 `git diff --check` 对未跟踪文件不构成格式证据。

## 当前结果与保留边界

- 手机轻量栏：下载/书架/小说详情/漫画目录及阅读轻量栏按确认版处理外框层级；复杂阅读控制面板、书架紧凑导航及固定直角操作条按原有合同保留，完整页面/子状态清单见分项报告。
- 下拉选择：审计包含共享控件、书源分组、阅读排版和独立 TTS。闭合值只占当前文案所需宽，菜单独立限宽，长项原生折行并按真实高度滚动。关闭的产品范围和旧兼容实现单列，未冒充当前可达页面已验收。
- 书籍操作：保持原有列表结构、书名单标题和删除本地内容；第一行在下载/取消下载/已下载之间切换。独立复核将章节相关17个方法与固定起始提交比较，业务一致，`selectionDock`仅增加圆角裁剪。
- 已选择的历史门禁共5项：1项PASS；2项实际执行后因既有断言失配FAIL；2项目录用例因定义待复审被拒绝，记FAIL/未完成。均未绕过、未更新封存指纹、未改断言掩盖失败。局部SDK/纯几何/生产方法证据分别列出，不覆盖这些结果。
- 最后补丁格式检查仅针对本次18个ETS、3个TS、2个调整的测试、4份记录及本次证据脚本，不对并行dirty文件做清理；该检查没有嵌套业务测试。已跟踪文件的 `git diff --check` PASS；8个新文件另以 `git diff --no-index --check /dev/null <文件>` 检查，差异状态1且无格式错误输出视为格式通过。
- 原生像素、圆角外触摸、短窗大字与popup焦点仍须后续交付阶段验收；本次未构建、签名、生成HAP、安装或占用设备。

### 下载/取消同类操作入口清单

| 当前实现/入口 | 处理 |
| --- | --- |
| `SharedDownloadPage` 单书与所选书籍操作 | 共用同一主操作行；当前目标与操作准入仍在点击时重验。 |
| `BookDirectoryPage` 漫画完整目录顶栏整书下载popup | 同类问题一并处理；真实目录完整性经Host传递，已下载禁用，清理/保留相关原动作保留。 |
| `SharedDownloadPage` 章节操作/多选dock | 用户明确保留的完整UI，下载、暂停、更多及快速选择照旧；不把多个章节操作误合并为一个整书按钮。 |
| 漫画目录行、阅读内目录行的本话下载popup | 保留现有downloadChapter/pause/resume/cancel/updateChapter与canonical index，不改变章节管理。 |
| `MangaReadingSurface` 更多菜单下载全部、下载管理 | 前者走现有整书下载回调，后者导航全局页；其`本书下载`面板标题分支在当前正常入口没有无index调用，不冒充一个新增可达整书弹窗。 |
| `BookshelfBookActionSheet` | 当前只有多选、分组、书籍信息和移出书架，没有下载/取消成对按钮；无需改造。 |

## 真机开发安装（2026-10-20，用户后续授权）

用户明确指定当前物理设备安装。本轮使用当前dirty源码的iteration包，保留并行WIP及应用数据；不附带业务测试、设备UI取证或全量验收。此前“未构建/设备未执行”是UI源码实施阶段的时点结果，本节单独记录后续交付。

| 选择入口 | 实际嵌套动作/必要依据 | 当前结果 |
| --- | --- | --- |
| `hap-pipeline.mjs build --class iteration --contracts-scope none` | 唯一流水线的输入快照、Native/SDK配套、官方依赖解析、隔离非增量ArkTS/Hvigor编译、指定签名和包内资源核验；本次安装必须得到来自当前源码的可验签HAP，不运行业务门禁 | PASS，第三轮；前两次失败与修复见下 |
| `hap-pipeline.mjs verify --manifest <本次manifest>` | 离线核对本次manifest绑定包字节/Native/签名，防止安装错误或被替换产物；无业务子测试 | PASS |
| `hap-pipeline.mjs inspect/install --artifact signed --target <用户指定且本轮发现的准确目标> --target-kind physical` | 序列化HDC、当前boot/SceneBoard、已装身份与Profile、保数据更新及安装后身份/启动回执；不切换目标、不卸载、不清数据 | PASS，安装/启动均PASS；初次掉线与重连见下 |

首轮build失败：生产provenance预检报告 `Core build identity does not match the Core worktree used for the manifest`。当前Core为`091fe0e9389815f469c82f969b14e9f9576fe48a`，既有SO配套绑定旧`f882e792`；输入快照也包含当前已删除的旧文件。问题发生在编译/安装前，未改设备数据。失败回执：`.reader-artifacts/hap-attempts/1792471197214-116e44ce-b824-45f3-b6d8-5383cd70a400/stages.json`。

必要修复选择：Core `bash scripts/build-harmony-napi.sh` → 当前源码的`build-ohos.sh`/Cargo release静态库、CMake/Ninja NAPI、SDK/SO/身份及包清单生成；不传`--host-probe/--sdk-smoke`，二者NOT_RUN。然后Host `hap-pipeline.mjs sync-native`，由同一provenance预检核验并同步SDK/SO，再重试iteration构建。依据是本次实际Native身份错配；不修改身份文件伪装、不清理dirty源码，不附带业务回归。

Native重建PASS（release编译4m07s，输入快照核验通过）；NAPI SHA256 `4829ff31ee313341ff9b59d5064d83309d28904bed617f65329b5aaa02736708`。随后`sync-native` PASS，原配套恢复副本保存在`.reader-local/native-sync/sync-JHWmOH`；host_probe和sdk_smoke均NOT_RUN。进入本次HAP重构建。

第二轮HAP在CompileArkTS失败（46s506ms）：`ReaderSelect.ets:278` 的`MeasureOptions`未声明；并行消息UI现有`SearchPage.ets:769`在联合类型`SearchPresentation`上直接读`historyStatus`而未收窄。局部lowering不能替代本次完整工程编译；记录这次新发现，不计构建通过。必要修复限定为选项度量使用已注册的SDK类型、搜索历史分支的类型收窄，不改文案、UI结构或业务，然后重构建；不因此补跑全量。设备仍未安装。

第二轮失败回执：`.reader-artifacts/hap-attempts/1792471531967-a9b6b83c-c0e1-4612-ab15-e8829eddf8b4/stages.json`。并行提交已推进Harmony/Core HEAD到`098f7407`/`25fc8d78`，当前包来源以最终manifest为准，不沿用早前HEAD标签。已补`MeasureOptions`的既有SDK type import；Search新增`SearchHistoryStatus`收窄helper，仅替换Builder闭包内一次读取，保留直接@State跟踪、公共消息组件及原回调。重试实际工程编译，不附加新的业务测试。

第三轮HAP构建PASS（完整Hvigor 51s378ms），runId `20261020T044910Z-098f7407-412342b4`；immutable manifest位于`.reader-artifacts/hap/20261020T044910Z-098f7407-412342b4/manifest.json`。离线verify PASS；signed HAP SHA256 `a94dbfd8328bbad4a894a3ef3710316b4816fa6ee84da654c30c95ea0c2a7f94`，debug Profile，证书SHA256为指定`3A563778...B676DC4`。本轮业务合同为NOT_RUN，无全量或原生交互验收。

第一次设备inspect失败：`the exact HDC target is not connected`。本轮初始发现目标存在、无传输错误，但构建结束后连接已断；失败发生在Bundle Manager/安装前。只尝试重连用户指定的同一endpoint，不更换端口/设备，不重启HDC服务，不改设备数据。

同一endpoint经一次串行`tconn`返回Connect OK。再次inspect PASS：目标引用`fcd0dc18a65b`，物理机boot完成、SceneBoard稳定，已装`io.reader.minliny`的appId/appIdentifier SHA与本次signed debug Profile一致，路由`matching-identity-signed-update-candidate`、preservesData=true。

随后规范install PASS，2026-10-20T04:51:24Z完成；部署回执`.reader-artifacts/hap/20261020T044910Z-098f7407-412342b4/deploy-physical-fcd0dc18a65b-20261020T045124Z.json`。回执install=PASS、launch=PASS、dataPolicy=preserve，安装后身份复核通过。本包来源Harmony `098f74074c3e4c1a1136893405e9d2d34fc6abec` / Core `25fc8d78beb6336450043c5fe96625a4e7d072e6`，均dirty；内容fingerprint `412342b4acc41db3beaaf208d21bc442575cf855ff65469b3a79766ce63a66ca`。immutable构建manifest的设备字段保持发布时OPEN，实际安装/启动证据由独立部署回执提供；featureInteraction与userAcceptance仍OPEN，本轮未做真机UI取证/验收。

## 夜间层级和书籍下载底栏后续实施

用户在说明“拉开明度”的效果后授权实施，并澄清底栏属于书架“更多”进入的书籍下载管理。当前实现维持原有模块色系与布局，不采用此前未认可的统一绿色方案。颜色仍唯一来自 `Reader-UI/theme/registry.json` 与漫画 `design/manga-directory/visual.json`，组件只引用主题角色。

当前层次：App 页面保持 `#1C1E1A`；卡片 `#30342D`；暖灰面板 `#36322E`；凹入字段 `#282420`；凸起控件 `#443C34`；阅读选中底 `#514536`。漫画使用原有灰绿色差：卡片 `#30342D`、次层 `#3F433C`、选中 `#4A5647`；次级文字同步提亮到 `#C8C6BB`，防止亮面上的小字失去可读性。消息family、强调色、日间和8套阅读正文底色保持。具体角色、局部SDK结果在共享选择/阅读/页面分项中登记。

本轮根任务额外选择：最终差异与实际theme消费者的只读核对、仅本次新增/改动文件的补丁格式核对；无嵌套门禁，目的是确认无硬编码色、没有扩入章节操作逻辑或并行WIP。源码／局部SDK／工程编译／安装启动／设备像素与用户验收分别记账，不把旧安装回执用于本次夜间修改。

### 本轮开发交付的必要输入与动作选择

当前只读审计确认：Host 的六个 Core SDK 文件为未暂存删除，依赖仍指向原路径，没有发现迁移到替代目录；删除来源无法从 Git 确认。当前 Core `2a301653c140eef457e786fd6ab3bb9b8e3045c8` clean，而本地 Native identity 仍绑定旧 `25fc8d78` dirty，生产预检明确不允许用 allow-dirty 豁免。原 SO 两侧相同不能替代输入身份。不得修改identity或git restore来伪造当前配套。

| 选定入口 | 实际嵌套与范围 | 本次不可省略依据 | 结果 |
| --- | --- | --- | --- |
| Core `bash scripts/build-harmony-napi.sh`，不传probe/smoke参数 | 现有build-ohos/Cargo release、CMake/Ninja NAPI、实际SDK及身份清单生成；复用build lease，host_probe/sdk_smoke均NOT_RUN | 用户延续已指定真机的UI迭代，必须生成来自当前Core源码的可验证配套 | PASS，首次资源占用拒绝如实保留 |
| Host `hap-pipeline.mjs sync-native` | 生产provenance预检、SDK/SO原子同步与私有恢复副本；无业务门禁 | 本地SDK缺失且旧Native身份失配，不能从历史Git回填或绕过 | PASS |
| `hap-pipeline.mjs build --class iteration --contracts-scope none` → `verify --manifest` | 当前dirty内容快照、官方依赖解析、隔离非增量ArkTS工程编译、指定证书签名、包内资源/字节验签 | 将本轮主题及底栏调整形成可安装包；局部SDK不替代实际工程编译 | PASS |
| 当前准确物理目标的 `inspect` → `install` | 只发现此前用户指定endpoint；精确target、boot/SceneBoard、已装身份/Profile与保数据更新、安装后身份和启动回执；不做UI抓取 | 沿用本任务明确物理目标授权，让用户查看本轮实际实现；不清数据、不改签名、不切换设备 | inspect/安装/安装后身份PASS；启动因锁屏FAIL，组合OPEN |

上述安装是开发更新，不扩大为设备UI取证或用户验收；旧门禁失配仍按前文保留，本轮未选业务门禁记NOT_RUN。

首次Native入口在取得构建lease前停止（exit1）：共享Reader build resource被另一存活owner占用。只读核对owner启动于2026-10-20T11:05:04Z、PID存活；未删除锁、终止进程或借用其token。当前未开始本轮Native编译，不将该尝试记PASS；先完成独立源码/预览核对，再在资源释放后重新判断输入身份。

源码实施结果：App canonical SHA256 `6c3e9320a361de5e41e36da28d5a1b18d9a7c2ca6ad727e498b4128b87ca000d`，36个既有night角色与6个专属角色（包含共享分段底/选中底），与Host投影绑定；漫画canonical SHA256 `8536368e70fcb68449c882e28fa818686155ebd56b7bcb141b5155893ba91bf8`。各分项的精确颜色/真实SDK/底栏探针均PASS，根任务对本轮文件的定向补丁检查PASS；未重跑前期失配业务门禁。日间、8正文主题、消息family及主色/图标保持核对PASS。

既有已确认界面预览另存为 `reader-night-controls-preview.html`，只按当前canonical提取四个模块色族并展示底栏自然单行，没有将其脚本或布局当成产品实现；本地浏览器已查看书籍底栏、筛选Sheet与菜单选中态，脚本解析与实际打开/收起通过。这是浏览器示意，不是ArkUI渲染或设备验收。正文/章节操作沿用既有预览，不新增产品操作。

构建资源自然释放后重新核对，Native仍旧绑定且SDK仍缺失。第二次Native构建PASS（release 3m26s），当前SO SHA256 `3c9ab79e6280105fc9020a2e062229d577c722145f7d9d5b6fd1ba4f2f94b99d`，host_probe与sdk_smoke均NOT_RUN；随后规范sync-native PASS，私有恢复副本位于`.reader-local/native-sync/sync-BHUAgx`。开始当前dirty UI源码的iteration构建（contracts-scope none）。

本轮HAP工程编译与签名PASS（Hvigor 41s454ms，含现有编译警告，不将警告伪记为消失）。runId `20261020T111343Z-33f7c7b2-32fe32c5`；manifest：`.reader-artifacts/hap/20261020T111343Z-33f7c7b2-32fe32c5/manifest.json`。signed HAP SHA256 `ac6ba700ac9a400b60b4fd3876177f0ab3d43b127eb2de2d24d699e30a408bf2`；指定证书 `3A563778...B676DC4`、debug Profile验签PASS。来源Harmony `33f7c7b21474a76a042ebda911c5f0ff2d73cf54` dirty；Core `2a301653c140eef457e786fd6ab3bb9b8e3045c8` clean；实际输入fingerprint `32fe32c5a26fb8779dce5761d23a8659c4f6f8c7ea97121d10ca7eaee57cbfbc`。业务合同、完整套件与Core probe/smoke均NOT_RUN。

离线manifest verify PASS。用户此前指定的同一endpoint本轮发现为已列出但未连接，经一次串行tconn返回Connect OK；未换端口或重启HDC。随后本轮inspect PASS：目标引用`fcd0dc18a65b`，boot完成、SceneBoard稳定、已装appId/appIdentifier与signed Profile一致，route为matching-identity-signed-update-candidate，preservesData=true。开始同一manifest的保数据安装与启动；设备UI像素/交互/用户验收仍OPEN。

本轮安装结果：HAP安装成功、数据保留、安装后身份复核完成，但自动启动FAIL，流水线exit3。系统报10106102：设备屏幕锁定且开发模式不能自动解锁。未重装、卸载、清数据、关闭开发模式或尝试绕过锁屏；已向用户说明解锁后打开Reader或回复继续启动。安装与启动分开记账，不将安装成功写成启动成功。最终问题记录自身作为未跟踪文件，另以`git diff --no-index --check /dev/null`核对，差异exit1且无格式错误。

当前控制器在启动失败时尚未写正式deploy回执；run目录保留`retention-install-physical-fcd0dc18a65b.json`保护标记，不能删除该标记或编造deploy PASS。安装/身份结论来自规范流水线先后分支与实际exit3错误，启动、交互和用户验收继续OPEN。用户解锁后只需在同一目标启动应用，无须再次安装。

用户随后明确回复已解锁，授权继续启动。此次只选择共享HDC lease下同一准确目标的`aa start -a EntryAbility -b io.reader.minliny -m entry`，随后只读`pidof io.reader.minliny`确认进程；嵌套仅HDC命令，不构建/重装、不运行门禁、不抓UI。当前目标已重新发现为Connected。必要依据是完成此前被锁屏阻断的启动；启动记录独立写入私有launch-records，不改immutable manifest或伪造正式deploy回执。

解锁后独立启动PASS：2026-10-20 19:22:11（Asia/Shanghai），同一目标返回`start ability successfully.`且进程查询确认运行；未重新安装，无数据操作。私有启动回执`.reader-local/launch-records/launch-fcd0dc18a65b-2026-10-20T11-22-11-589Z.json`绑定本次manifest哈希与runId。此前锁屏FAIL保留为首次尝试；当前启动已完成，正式deploy回执仍未创建、原保护标记保留，功能交互与用户视觉验收仍OPEN。
