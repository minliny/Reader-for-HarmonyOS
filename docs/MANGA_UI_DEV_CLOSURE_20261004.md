# 漫画 UI 开发接线审计与修复

范围：当前 `codex/manga-completion-20261004` 隔离候选，MANGA-01～05。只审计生产接线和本地回归；不占用 VM、不构建 HAP、不改变授权视觉稿。

## 已定位开发问题（修复前）

1. **详情目录丢失 Core 层级。** `Index.openRemoteBookDetail` 最终目录发布及 `refreshCachedSearchDetailInBackground` 将 `session.entries` 转为 `detailToc` 时未保留 `level`。同样丢弃 level 的路径还有下载投影失败回退、书签合并、单章下载状态更新、近章末目录刷新、reader 标题投影。下载／书签投影尚未返回或失败时，目录卷层级退化；同一目录的预览和阅读接线不一致。
2. **详情预览与完整目录旧回退分支错误折叠。** `LocalBookDetail.visibleToc` 只记一个布尔值；`BookDirectoryPage.mangaGroupFor` 以“前一条不可读行”为父组。明确多级目录中折叠外卷仍显示子卷，卷外可读条目被错误归组，定位只展开最近一层。不可读无子节点也被当作卷组。已有阅读内 `MangaReadingDirectoryFallback.preparePresentation` 正确使用 Core 的 `level/navigable`，应复用这一业务展示适配，禁止按标题或顺序猜身份。

最小反例：外卷(level 1)、内卷(level 2)、话(level 3)、卷外话(level 1)。折叠外卷应仅保留外卷和卷外话；定位内卷的话应展开全部明确祖先。没有显式层级／子节点的不可读行不能折叠后面的章节。

代码定位与本地方法回归不能证明 VM 字形、手势调度或最终用户验收。修复结果与定向测试将在下方续记。

3. **未入架漫画换源提前替换上下文。** `onPickSource` 在漫画分支之前将所有未入架场景送入 `switchPreviewSource`；该方法只获取目录就切换，未验证目标首图，试读中的章映射与无匹配手选也被绕过。复用现有首图 admission 和换源 preparation，试读不隐式入架、不调用书架移动提交；首图失败／取消保持原来源与位置。

4. **准备阶段不可取消。** 漫画可靠匹配及未开读详情换源的 `SourceSwitchWindow` 返回按钮和 `Index.closeSourceSwitch` 都无条件阻止 switching 关闭；等待首图时无法取消。手选目录已有提交锁，而自动匹配尚无相同锁。允许仅漫画准备阶段关闭，导航代次取消迟到结果；进入书架 Core 提交及提交回执核对后继续锁定。小说事务门槛保持现有语义。

## 修复落点

- 三处目录回退统一使用 `MangaDirectoryPresentation.ts`：仅采用 Core 明确的 `level/navigable`，保存原始稀疏 chapter index；不按标题、URL、排列位置推断卷。外层折叠隐藏全部明确后代，卷外章节独立，定位展开全部明确祖先，无子节点的不可读行不产生折叠动作。详情的预览上限在明确折叠后应用；来源／目录事实改变后清除失效折叠状态和陈旧点击权限。
- Index 目录发布、背景刷新、可选离线投影失败、书签合并、单章下载状态、标题投影、近章末目录刷新均保留 level，不改变目录 index。
- 试读漫画走既有匹配／手选 preparation，首图可用后传入目标章节开头；不隐式入架、不调用书架换源提交、不预写目标进度。`mangaChapterStartRequestGeneration` 将一次进入意图经 Index→ReaderShell→Surface `startAtChapterFirst` 传递；后续选章改变代次，普通续读保持原 saved-location 入口。Surface/Controller 的可见页确认、CAS 及实际进度写入由 root 修改／独立回归，本子任务未编辑它们。
- 未开读详情换源首图 admission 成功后才替换 detail；失败、登录取消、关闭、换路由、换来源均保留原详情及目录。失败只呈现既有换源失败状态，不自动启动阅读。
- 准备可取消端口经 Index（详情／阅读）→Shell→SourceSwitchPanel→SourceSwitchWindow，只有漫画准备阶段允许关闭；本轮 `mangaSourceSwitchCommitGeneration` 锁覆盖自动匹配的 Core 提交与不确定响应核对。手选既有 commitStarted 门槛、小说事务锁保持原语义。关闭推进现有导航代次，拒绝迟到结果。

## 完整功能接线清单（本次审计范围）

| 页面／组件 | 生产调用链与行为 | 本轮状态 |
| --- | --- | --- |
| 书源与搜索入口 | SearchPage／SearchGateway 使用 comic 类别，拒绝漫画／小说类型误接，搜索结果进入现有 acquisition 详情流程 | 已有接线；未重设计 |
| 书架封面／列表／筛选 | BookshelfPage 复用既定漫画／小说、类型／来源两标签及进度行；阅读入口传 contentKind 与精确身份 | 已有接线；关联反馈回归 |
| 漫画详情／首图准入 | Index acquisition → MangaAdmissionGateway.verify；入架复用 admission，首图失败不误入架 | 已有接线；本轮补未开读换源验证 |
| 详情目录预览 | LocalBookDetail → Index 选章；Core 显式章／卷事实、稀疏 index、禁用行、折叠后限量、陈旧事实回调拒绝 | 本轮修复层级与折叠 |
| 完整目录 | BookDirectoryPage v2 原生目录／同一明确层级回退，选章传精确 index／proof；搜索、定位保持原身份 | 本轮修复明确祖先、折叠、定位 |
| 阅读内快速目录 | 原生目录保持 existing Core navigation；MangaReadingDirectoryFallback 与前两处共享业务展示适配 | 本轮抽取共享适配；既有点击／下载接线保留 |
| 小说／漫画换源发现 | 既有 SourceSwitchWindow 持续发现、延迟更新排序、触摸期间保持命中身份、失败／停止／重查状态 | 已有接线；关联生命周期回归 |
| 入架漫画换源 | MangaSourceSwitchGateway.prepare → 首图验证 → 双 CAS commitPrepared → 书架事实核对 → reader seam | 已有事务；本轮补准备取消及自动提交锁 |
| 未入架漫画试读换源 | 复用唯一可靠匹配、无匹配／重名手选；验证目标首图后一次进入本章开头；无书架移动／预写进度 | 本轮补齐 |
| 未开读漫画详情换源 | acquire target catalog → 既有 first-image admission → 保持详情返回来源 | 本轮补齐；失败／取消保留原详情 |
| 下载与下载管理 | Index → MangaDownloadActionsGateway／ReadingOfflineGateway；章节／整书下载、暂停／继续／取消、释放持久归属、删除下载、明确单章更新 | 已有完整生产接线；本轮保留目录 level 并回归，无新增引擎 |
| 阅读更多菜单 | ReaderShell→Surface 的下载本话／整书／管理、详情、换源、目录、入架动作 | 已有接线；实际 SDK 菜单回归 |
| 漫画阅读偏好 | 既有 MangaSettingsGateway／ReaderSettingsGateway、Surface 方向／适配／背景／页码／亮度／恢复默认 | 已有接线；既定 SDK 控件／回调回归 |
| 返回／上下文恢复 | Index detailReturnRoute／书架与搜索入口；失败／取消保持原详情或 reader；目标进入 intent 仅当前代次 | 已有接线；本轮加强换源身份／路由／代次 |

此表只给入口、目录、换源、下载动作、偏好及返回的生产接线结论。Host 存储预算、调度、Surface 原生滚动及系统栏由其他并行责任人处理；不能用本表替代他们的代码回归或目标验收。

## 本地回归（2026-10-05）

已通过的本轮专门反例：

- `test-manga-directory-shared-hierarchy.mjs`：明确多级组、卷外根节点、未知层级、禁用行、搜索／全部祖先定位、陈旧卷事实、三处共享模型及 Index 多个 level 保留路径。
- `test-manga-source-switch.mjs`：未入架可靠匹配／手选成功、首图失败／取消、无进度／书架预写；自动匹配 trial／shelf 准备 Back 可取消且迟到不替换，Core 提交锁及旧事务门槛。
- `test-manga-admission.mjs`：未开读详情换源成功／首图失败／实际关闭／换路由／换身份／登录取消，不写小说进度、不误入架，详情与目录保持。
- `test-manga-preview-entry-sdk.mjs`：实际 SDK Builder Index→Shell→Surface 的首图进入代次、下一章失效、普通续读；阅读／详情两入口到 Window 的准备取消与提交锁按钮状态。
- `test-manga-ui-assembly-sdk.mjs`：当前 364 个生产 ETS／TS 文件 SDK 解析、740 个真实字段绑定、11 个关联组件变换通过，既定漫画设置控件及回调通过。此项不是项目完整语义编译。
- `test-manga-download-actions.mjs`：实际目录下载控件及 Index／Shell 接线、下载管理范围、暂停／继续／取消、释放／删除／明确更新及旧身份回调拒绝通过。卷组测试改为真实 level 与明确子节点 fixture，未用强制 group stub 掩盖折叠错误。

以下 10 项关联既有回归收尾全部通过：`test-manga-reading-directory-fallback`、`test-book-directory-page`、`test-manga-metadata-ui`、`test-manga-directory-demo-parity-sdk`、`test-manga-ui-source-switch-window`、`test-bookshelf-physical-feedback`、`test-detail-acquisition-return-stability`、`test-remote-reading-evidence`、`test-source-switch-transaction`、`test-search-trial-reading-return`。

本子任务未执行 fullgate、HAP、HDC、VM、提交或暂存。原生排版、设备行为和用户验收仍是独立验证事项，不记为未实现开发代码。

## 联合 gate 位置投影回归登记修复（2026-10-05）

- 初始失败：root 的 `development-r34-joint-build/build-keep3.log` 中 canonical Host gate 在 `test-manga-ui-position-hydration.mjs:276` 读到 `01`，原断言要求已确认新章节 `02`；本地原测试同样复现，exit 1。Native 在联合流程已通过，HAP 尚未到语义编译。
- 代码定位：此测试没有挂载 MangaReadingSurface、没有 viewport geometry 或 frame callback；其 SDK child Prop 预登记使用 `@Prop\s+(\w+)` 正则，不能识别现有 `@Prop @Watch('onBookChanged') book` 与 toc 的同类组合。SDK 因被测试预登记漏字段而不生成 retained child book 更新载荷。实际生产 SDK frontend 使用 decorator AST 预登记，没有该正则遗漏；本次不修改 Surface／任何生产逻辑。
- 修复计划：只将本测试的 LocalBookDetail／BookDirectoryPage 两组件 Prop 登记改用已安装 SDK AST decorators，断言 book、toc 被识别及实际 emitted updateStateVars payload 包含 book/toc。保留原 `01→02`、页序／总页数、迟到响应／多代次／owner／空位置反例；不改期望、不加入几何或假帧。

- 定向结果：`node tools/test-manga-ui-position-hydration.mjs` exit 0，原章节／页码断言及全部原反例通过，新增真实 SDK book/toc 更新载荷断言通过。已通知 root 继续一次 canonical Host gate；未自行启动第二条构建／Native。

## 联合 gate 原始 TTS 输入恢复（2026-10-05）

- 第二次 canonical Host gate 在 `test-reader-tts-waveform.mjs:8` 缺少 `evidence/2026-09-11-make-style-parity/tts-reference/src/PhoneScreen.tsx` 失败（root 记录 202.806s）；本地原测试同样 ENOENT。此次是 ignored 测试输入缺失，不是 TTS 生产退化，原断言不改。
- 唯一现存原件：`/private/tmp/reader-manga-sheet-ui-delivery-20261003-1913/Reader-for-HarmonyOS/evidence/2026-09-11-make-style-parity/tts-reference/src/PhoneScreen.tsx`。临时交付目录 `copied-source-inventory.json` 的 Reader-for-HarmonyOS 项登记该路径为 64397 bytes，SHA256 `731582c1ac493d48f1ebdaae1e5527de5dfe3f391d37d8c85a51643ce72b4a3c`；恢复前实读原件与登记完全匹配。
- r33 旁证：同一候选 `.reader-artifacts/hap/20261004T150643Z-568ec4e3-47609321/manifest.json` 的 harmonyContracts=PASS、Host 444 项（r33-build-stack-evidence.json）；这是旧 gate 通行记录，不能替代当前完整 gate。旧登记不单独绑定此 ignored 文件，精确字节来源由前述复制清单证明。

- 定向結果：恢复后 waveform 原测试 PASS；排序其后的 83 项一批执行（单项 30 秒超时，3 个进程，批次 27.436s）：82 PASS，唯一 `test-reading-directory-fixture` 因沙箱 `listen EPERM 127.0.0.1` 失败；获本地豁免后单项真实 Core＋loopback 回归 PASS。后续无新增缺 fixture／断言失败。逐项原日志及首次失败保存 `/Users/minliny/Documents/Reader/evidence/2026-10-04-manga-completion/development-r34-joint-build/fixture-input-suffix-20261005/result.json`；补跑结论记录在 `docs/MANGA_GATE_FIXTURE_RESTORE_20261005.json`。
- 恢复目录一度在并行期间消失，尚未归因；同一原件再次恢复并核对，不删除首次缺失记录、不重设计或合成来源。root 已获知并行刷新疑点。

- root 明确授权固化测试输入：将上述原字节固定到 `tools/fixtures/tts-reference/PhoneScreen.tsx`，waveform 改读稳定 fixture 并先断言原 SHA256；全部原样式／运动断言保留。未修改生产 TTS。删除来源限定 tools/scripts 未定位，不因该未决点扩大开发范围。后续测试日志已移出 Host repo，放在现有联合构建证据目录的 fixture-input-suffix-20261005 内。
