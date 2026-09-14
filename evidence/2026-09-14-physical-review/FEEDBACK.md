# 2026-09-14 真机人工审视反馈

追加输入见 [PH43–PH47](FOLLOWUP_43_47.md)：用户在643bcaf5上纠正主题修复方向，并补充朗读预备、终宋书源和详情几何。原PH01–41及PH42编号保留；PH31旧处理明确撤回，新的代码/验证结论不与旧报告混用。

本轮反馈对应已安装的 `9509d4feb410ce559d67b77785e2248e88485f4e`，不是当前工作树 `4802ef4b`。安装 run `20260913T160039Z-9509d4fe-25529e1f`，signed SHA256 `b9ef64ece51c02c865ca1740fee52ca7efebe162495fb784fa000fae1aacf2fd`；[保数据安装及启动回执](../../.reader-artifacts/hap/20260913T160039Z-9509d4fe-25529e1f/deploy-physical-b1f20b88963d-20260913T170111Z.json)。用户人工审视提出39号编号，17和19各出现两次，合计41项，全部分别保留。

本文件是发现记录，不是修复或验收证明。优先审计现行代码、9509包对应代码、已有Figma/Make和历史约定；本轮不操作设备。代码修复、本地回归、新包、VM、真机、用户验收分开记账。旧未验证项继续保留在根 DEVELOPMENT_BACKLOG §11，本批不替代全量实施方案。

## 用户反馈原意与逐项归属

| ID | 原编号 | 现象/要求 | 审计归属 |
|---|---|---|---|
| PH01 | 1 | 亮度分配不均：亮度条上方四分之三过量，只有四分之一适合人眼，难以精准调整。 | root / brightness |
| PH02 | 2 | 自动亮度按钮只有手动状态能点击；已自动时点击无反应。 | root / brightness |
| PH03 | 3 | 能否先读取系统亮度范围，自适应将大部分条段分配给人眼舒适范围。 | root / brightness |
| PH04 | 4 | 亮度填充未严格裁切在圆弧内，极低值形成超出圆弧的横线。 | root / brightness |
| PH05 | 5 | 快捷控制栏设置页标题与选项重叠，标题显示不全。 | reading |
| PH06 | 6 | 除朗读外，其他所有快捷控制页外轮廓丢失。 | reading |
| PH07 | 7 | 主题库设置默认日夜阅读主题没有成功反馈。 | search/settings |
| PH08 | 8 | 快捷设置的小横条展开失效。 | reading |
| PH09 | 9 | 自动翻页和朗读实际动画时长过长。 | reading |
| PH10 | 10 | 胶囊展开与页数左移动作重叠。 | reading |
| PH11 | 11 | 胶囊出现时页数位置不稳定，有时回原右下角被覆盖。 | reading |
| PH12 | 12 | 胶囊与正文不同步，关控制栏后先正文再闪现胶囊。 | reading |
| PH13 | 13 | 下拉添加书签无反馈；原规划要求右上角书签动画。 | reading |
| PH14 | 14 | 书签列表没有正文内容，出现“偏移***”不明字段。 | reading |
| PH15 | 15 | 完整控制页底部边框不完整，内容与边框融合。 | reading |
| PH16 | 16 | 完整控制栏小横条收起失效。 | reading |
| PH17 | 17a | 书架列表右上设置图标功能接错。 | bookshelf/source |
| PH18 | 17b | 本地TXT标签错误显示为本地local。 | bookshelf/source |
| PH19 | 18 | 进度适当右移，与右侧更多保留间距，给书源名称留空间。 | bookshelf/source |
| PH20 | 19a | 书架列表更多图标过小。 | bookshelf/source |
| PH21 | 19b | 更多弹窗宽度按书籍封面到屏幕外侧的边距；底部圆角与直边并存，删除圆角部分。 | bookshelf/source |
| PH22 | 20 | 搜索历史居中，应该顶部对齐。 | search/settings |
| PH23 | 21 | 默认完整显示前两行历史，超过两行才折叠；按钮固定使用“展开”，不是“*条更多”。 | search/settings |
| PH24 | 22 | 搜索进行中样式和动效绘制错误，参考当前修改前版本，仅优化渲染。 | search/settings |
| PH25 | 23 | 搜索关联排序异常，“诡秘之主”搜索不到准确原版书籍。 | search/settings |
| PH26 | 24 | 详情最新章节/书源/分组高度字体统一为书源样式；实际章节字体错误；优先完整显示书源名称，换源按钮随名称长度在同一行移动并保留右边距，放不下才尾省略。 | bookshelf/source |
| PH27 | 25 | 简介/章节无内容或加载失败时提供文字说明。 | bookshelf/source |
| PH28 | 26 | 作者带“作者：”标注。 | bookshelf/source |
| PH29 | 27 | 书架标题与右侧按钮整行固定置顶，但缺乏明显轮廓。 | bookshelf/source |
| PH30 | 28 | 列表顶部下拉应刷新全部在线书籍最新章节；记录为规划/功能缺口。 | bookshelf/source |
| PH31 | 29 | 阅读主题色块与实际正文背景颜色不一致。 | search/settings |
| PH32 | 30 | 完整控制界面不应重复出现设置页的翻页动画和文本对齐；追溯错误修改来源。 | search/settings → reading |
| PH33 | 31 | 夜间字号/行距等控件的交互内容未做深色适配。 | root / control colors |
| PH34 | 32 | 通用设置内容居中；扩查同类页面滚动容器。 | search/settings |
| PH35 | 33 | 清理文字缓存文字超出按钮，核查宽度自适应。 | search/settings |
| PH36 | 34 | 通用设置返回应回主设置，实际回到书架。 | search/settings |
| PH37 | 35 | 深色开关关闭状态下滑块与轨道对比不足。 | search/settings |
| PH38 | 36 | 书源管理（原文“书院管理”）登录放在检测左侧，修正排版。 | bookshelf/source |
| PH39 | 37 | 书源标签不要与URL同行；小字标签放标题右侧，布局与换源按钮的约束一致。 | bookshelf/source |
| PH40 | 38 | 换源按钮控件和文字没有居中。 | bookshelf/source |
| PH41 | 39 | 完整目录文字颜色与正常文字不一致。 | search/settings |

## 已知包与源码差异

- PH22：`c398cafe`已改历史测量启动依赖和顶对齐，但未装入本次9509包；新提出的“展开”文案另行落实。
- PH41：`05c39cf7`及共享主题`aaaa0c53`已修强调文字误用夜间实体填充色，未装入本次包；仍需核查本次期望对应角色。
- 目录尾部锚`a0374fcc`与导入图标绘制比例`1921b84d`也未装入本次包，不从后续计划删除。
- 最新候选`4802ef4b`门禁失败：`test-reader-render-work.mjs:165`预期纠偏1次实际0次。只读定位为测试提取遗漏新增helper，尚未修复或重跑，不能记新包交付完成。

## 审计输出

分项报告：[亮度与控件主题](brightness-theme-audit.md)、[阅读控制、胶囊与书签](reading-audit.md)、[书架、详情与书源](bookshelf-source-audit.md)、[搜索与设置](search-settings-audit.md)。尚未定位的项维持OPEN，不以用户反馈本身猜测实现原因；不将既定设计要求再次归为用户待决。

4802打包阻断现已定位并修复为测试提取遗漏 `leadingAnchorIsAligned`，原纠偏断言保留并通过，见 [回归](render-work-gate-after.log)。上面的初始发现记录保留，不再代表当前状态。

## 顶栏边界的默认实施选择

PH29已向用户提出“保留固定加底部分隔线/整行随列表滚动”的可选澄清；等待期间未收到不同选择后，按已说明的建议实现：仅书架顶栏启用1vp底部分隔线，日夜使用已有App纸色/lineStrong，原58vp高度与固定归属不变；二级“我的书架”仍在List内。此为本轮用户轮廓反馈驱动的修改，不伪称Figma原有边框。

## 当前整合结果

以 [实施状态与新包回执](IMPLEMENTATION_STATUS.md) 为最终本地状态：232组检查、实际编译、签名和复验通过；仍有5项明确边界，新包未安装。初始发现及分报告冻结时点不再代替当前状态。

## 独立追加：PH42 多级目录适配

用户最新要求将“多级目录适配”登记为功能缺口。独立编号 **PH42**，不并入前述原41项反馈，也不改变PH01–PH41及其5项边界的历史统计。

- 状态：**功能缺口OPEN，未实施**。
- 范围：按用户“多级目录适配”的原始表述保留，待后续代码侧审计明确当前目录数据、呈现与交互的具体适配范围；本次不扩展审计，不预设折叠层级或实现细节。
- 产物边界：本项不包含在本次新包`20260913T182027Z-643bcaf5-1c85dc16`，不能因该包本地检查/编译/签名通过或后续真机安装而标完成。
- 本次仅登记文档；不修改生产/测试，不构建、不提交、不操作设备。真机安装由root独占执行，以其正式回执另行更新，登记不阻塞安装。原完整实施计划所有OPEN继续保留。

最新安装状态见 [实施状态末节](IMPLEMENTATION_STATUS.md)：643bcaf5已保数据安装并启动；PH42仅登记，未实施。

## 最新真机反馈：PH77–PH91（2026-09-14）

用户在本轮安装后报告以下15项。已确认最终真机安装包 run `20260914T154527Z-1d1f47e5-41357e27`，Harmony `1d1f47e5` / Core `61a2f86e7`，签名HAP SHA `1771b5ad75b42c6f56704adbf1f722788816dd840163ff5cda69adab99aa5def`；真机15:46:24 UTC安装/启动PASS，VM同包15:47:03 UTC安装/启动PASS，均保数据。现象来源是用户人工反馈，未取得逐帧/请求trace，不将其虚构为独立复现或唯一根因。先记录和代码审计，暂停原计划VM交互，待确定最小验证问题后继续；真机操作已释放。

| ID | 用户序号 | 现象/要求 | 范围 | 当前状态 |
|---|---|---|---|---|
| PH77 | 1 | 搜索加载缓慢，底部搜索动效数秒才变化一次 | 搜索/SDK/主线程 | 已去除大对象跨 Prop 深复制；真实 SDK 边界回归通过，设备耗时/帧率待验证 |
| PH78 | 2 | 约30秒完成30个书源，目标书2分钟未展示 | 搜索调度/来源/候选发布 | Core 私有轮转队列改共享 FIFO，慢 worker 不阻塞其他空闲 worker；正式回归通过，真实来源耗时待验证 |
| PH79 | 3 | 正在搜索时全应用卡顿，翻页等数秒 | 共享执行/锁/渲染 | 已修 Prop 复制及 PH90 全局锁阻塞路径，本地通过；不能宣称解释全部物理设备卡顿 |
| PH80 | 4 | 删除历史搜索展开功能 | 全部历史直接展示；保留滚动 | 已删除折叠和测宽，全部历史可滚动；生命周期/Builder 回归通过，新 VM 待验 |
| PH81 | 5 | 进入搜索时直接唤起输入法 | 搜索入口焦点/键盘生命周期 | 已接一次性布局后焦点，离屏/返回不抢焦点；本地通过，新 VM 待验 |
| PH82 | 6 | 搜索框光标像左括号而非竖线 | 输入控件/绘制与焦点 | 旧包 VM 已复现原生圆角裁切及隐藏 Web 抢焦点；修复/SDK 回归完成，新包像素待验 |
| PH83 | 7 | 详情目录预览不应仅4章，历史为20或30且可翻动 | 已确认历史20章及内部滚动 | 已恢复20章 Scroll；本地回归通过，新 VM 待验 |
| PH84 | 8 | 详情完整目录误接阅读完整控制栏目录 | 已定外部完整目录入口 | 已直接挂外部目录，不先解析正文；精确章节点击后才阅读，关闭回详情；实际 Index/Builder 回归通过，新 VM 待验 |
| PH85 | 9 | 《鸣龙》松鹤阅读正文残留方括号及字面反斜杠r/n等 | 原始数据类型/源规则/规范化 | 已修 JSONPath 数组文本提取，正文格式升2并沿 PH75 保护位置；Core 回归通过，原书呈现待验 |
| PH86 | 10 | 常态无书签不显示图标；已有书签才显示填充；镂空仅下拉反馈且不入正文 | 沉浸顶层书签反馈 | 已落实状态/ACK与顶栏独立槽，保留时钟并避开正文/安全区；实际 Builder/手势回归通过，新 VM 待验 |
| PH87 | 11 | 阅读更多新增下载全部章节；弹窗缺指向凸起、应右对齐且宽度适应文本 | 复用离线下载；对照Figma菜单 | 已接下载全部、右锚菜单/凸起/文本宽度，本地禁用下载；正式回归通过，新包交互待验 |
| PH88 | 12 | 亮度/自动按钮没有对齐轨道上下圆角圆心，轨道偏短 | 几何共享/用户明确增长轨道 | 已改38×190、轨道104、间隔14及圆心19/171，扣除原生边框内缩；实际 SDK/公式通过，新包像素待验 |
| PH89 | 13 | 自动翻页胶囊内部元素高度不齐，倒计时圆形轮廓形变/尺寸和文字高度错误 | 胶囊布局/用户明确16×16圆 | 已改圆与数字16×16、标签高16、24高行居中；字号8/10与motion不变，实际 SDK通过，新包像素待验 |
| PH90 | 14 | 完整内容搜索打开后卡顿，键盘延迟，后续点击无响应 | 内容搜索扫描/共享锁/原生列表/输入 | 一致快照分批扫描释放全局锁；去二次方查找/Prop复制；List+LazyForEach代码及50/2000/10000回归完成，原生paint待VM |
| PH91 | 15 | 内容搜索快/完整两处重复搜索图标；输入框内不应有图标；右侧按钮颜色和轮廓异常 | 共享搜索输入和按钮主题/Figma | 已删除框内重复图标、恢复右侧单图标及青色资源角色；实际 SDK通过，新包像素待验 |

本次用户明确删除展开，覆盖旧“两行+展开”规则；书签显示按本次明确状态规则执行。目录数量/外部入口查已有规划；视觉问题先对照Figma，不把过去错误实现当设计基准。不关闭§16联合VM/帧率/用户验收。

PH82 的初始代码审计无法区分 caret、选择手柄与圆角裁切，随后在已安装旧 run `20260914T154527Z-1d1f47e5-41357e27` 做了最小 VM 取证：空输入左边界 caret 被原生默认圆角裁成月牙，非空末尾为直线；同时发现隐藏 Web 可抢焦点。见[空输入截图](search-flow-implementation/ph82-focused.png)、[有文字截图](search-flow-implementation/ph82-text.png)、[固定上游绘制源码](search-flow-implementation/ph82-text-field-overlay.cpp)。修复为 ReaderSearchField 两个 TextInput 及内容搜索唯一 TextInput 内部 `borderRadius(0)`，外层圆角不变；ArkWeb 的 `focusable/focusOnTouch` 仅随 interactive 开启。[SDK 回归](search-flow-implementation/ph82-native-focus-test.log)通过，新包原生像素/输入法仍待 VM，旧包复现不代替修复验收。

### PH77–91 当前整合身份与证据边界（2026-09-15）

Core 已提交 `28369db9405822f4b8277eb95ad94057f177b7bb`；[官方检查](search-flow-implementation/ph77-91-core-official-final2.log)3832项测试通过，其中1项标记 leaky，为退出后输出管道未及时关闭的警告，非应用堆泄漏证明；[独立复核及未决边界](search-flow-implementation/ph77-91-leak-summary.json)保留，未放宽超时。新 Native [构建](search-flow-implementation/ph77-91-native.log)完成，[身份](search-flow-implementation/ph77-91-core-build-identity.json)为 clean/release，buildId `5ffa51028024982bce9a607e5c3c88b69126d709e980a2823e1e7d2888f6c3fd`，已同步 Harmony 受版本管理的 `.so`。

Root 已完成分项提交，Harmony 当前代码 `1b6328c8`，仅证据文档尚未提交；早先“生产工作树未提交”的阶段已结束。Root 确认 Harmony 全部门禁 **260项 PASS**。此时尚不宣称本轮后续 HAP 构建、签名、新安装或新 VM 通过。各分报告旧基线保留为历史，不替代本节当前身份。

原因与正式回归入口：PH77/79 的 `SearchPublication` 稳定 holder + revision 修复真实 ArkUI Prop 深复制，见[属性边界证据](search-flow-implementation/ph77-79-publication-boundary.json)及 `test-search-publication-boundary.mjs`；PH78 的源 worker 共享队列见[阻塞回归](search-flow-implementation/ph78-shared-source-queue.log)。R8 空队列有等待、连续即时轮有让出，未发现无等待 busy-loop；FIFO不保证来源完成顺序或网络耗时。PH80/81 见 `test-search-history-layout-lifecycle.mjs`；PH83/84 见 `LocalBookDetail`、Index外部目录分支及 `test-detail-external-directory.mjs`；PH85 见[规则与格式升级报告](PH85/REPORT.md)，普通旧缓存不自动升级、歧义保留旧文旧位置。PH86 的顶栏槽/手势/ACK见 `test-reader-bookmark-top-info.mjs`；PH87见 `test-reader-more-popup.mjs`；PH88见 `test-reader-brightness-perception.mjs`；PH89/91见 `test-reader-physical-control-details.mjs`。16×16圆覆盖旧 Figma 1164:10275 的18×16椭圆，增长亮度条也是用户明确要求，不重新列为产品待决。

PH90 Core 在源/正文/处理配置一致快照后释放全局 publication 锁，分批扫描、取消并返回前校验，防止错误 positionScope。桌面生产 C ABI 探针中并发进度等待约293ms降至约0.7ms，只证明该锁链解除，不证明真机全部卡顿消失。Host 去二次方查找、稳定发布与焦点修复及原生 List 主链详见[专项证据](search-flow-implementation/ph90-content-open.md)。72vp仅为内部坐标标尺，实际54→72行高及14/10字号不变；完整数据源不截短，使用真实 native offset 回执补偿并复用既有 scroll policy，每侧缓存2行。`test-reader-content-search-native-list.mjs`覆盖50/2000/10000、深偏移往返、负origin、追加/替换、迟到回执和用户中断；SDK探针注入8个请求索引只证明按需生成，不能当Ace可见范围或native paint验证。新包真实 materialization/回执/paint同帧、触摸和帧率仍待VM；[最小清单](search-flow-implementation/ph77-91-vm-minimal-checklist.md)明确现有pilot不是2000行内容搜索样本。

失败历史继续保留：Core [初轮](search-flow-implementation/ph77-91-core-official.log)/[中间轮](search-flow-implementation/ph77-91-core-official-final.log)、[旧迁移fixture失败](search-flow-implementation/ph77-91-migration-fixture-failure.json)、[回放字段差异](search-flow-implementation/ph77-91-host-replay-fixture-delta.json)，Harmony [第一轮](search-flow-implementation/ph77-91-harmony-check-first.log)/[第二轮](search-flow-implementation/ph77-91-harmony-check-second.log)/[第三轮](search-flow-implementation/ph77-91-harmony-check-third.log)。第三轮旧探针引用已移除的 `resultRowsHeight`，最终探针已接List主链，未用无效方法兼容测试。以上本地检查与旧包VM复现均不关闭新包VM、真机或用户验收。

PH77–91 首次 HAP 编译失败：260 组本地检查通过后，正式 ArkTS 编译拒绝新增 TS 文件导入 ETS 类型（SearchPublication、ReaderContentSearchPublication、ReaderPageChromeTextMeasurement）；新增 List DataSource 的 ArkUI 全局接口在 TS 文件中也不可见。正在纠正模块归属/共享类型，不放宽编译或测试，不改功能要求。原始日志 `search-flow-implementation/ph77-91-hap-build-first-failure.log` 已保留；本次没有生成发布 manifest、没有安装。
