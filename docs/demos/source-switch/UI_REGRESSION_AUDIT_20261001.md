# 旧 UI 问题再次出现的原因与同类路径审计

日期：2026-10-01。这是源码和既有证据审计记录，不是另一份开发待办。

## 现象、版本和范围

用户报告书架标题再次模糊、偏移，顶栏与内容有异常空隙。该问题已在本地换源分支的 `c6ac46d3` 修复并由对应 manifest-bound HAP 覆盖安装到既有 VM，385 项检查及该空书架像素/布局核验通过。证据见 [bookshelf-empty-fix-result.json](bookshelf-empty-fix-result.json)。

本次追因以主工作区 Harmony `2a21ed02` 与隔离分支 `bf8df662` 为固定源码时点，检查书架状态路由、旧修复历史、标题组件/资源、滚动布局及回归覆盖。主工作区未合并隔离分支的新修复，不能把当前 VM 修复当作主工作区也已修复。

## 已确认的根因

- 非空书架已使用共享原生文字 `AppTopBar`，空书架仍保留独立的位图标题和 Scroll 布局。两条路径的修复覆盖不一致。
- 空书架的旧标题为 56×28 px PNG，显示为 56×28 vp；在既有 VM 3.5 密度上放大，并由 `layoutWeight(1)`/Contain 放在膨胀容器中间。空态 Scroll 没有显式顶部对齐，短内容余量被上下等分。
- 旧布局检查覆盖 `BookshelfPage` 和共享顶栏本身，没有执行 `BookshelfEmptyPage` 的实际顶栏/Scroll。全量检查通过不能证明未覆盖状态也通过。
- 本轮换源交付留存的普通启动截图已经包含上述空态异常，但当时没有识别并记录；直到用户指出才进入修复。这是此次交付检查的遗漏。

## 修复历史为什么没有覆盖空态

| 北京时间 | 提交 | 实际修改范围 |
|---|---|---|
| 2026-08-10 01:06 | `4d6543a2` | 非空 `BookshelfPage` 接入 `AppTopBar`；空页只更换 `MainTabShell`，保留图片标题 |
| 2026-08-23 17:42 | `dcc7eb62` | 空页补动态宽度和左右安全区，仍没有替换图片或 Scroll 对齐 |
| 2026-09-14 02:18 | `18686852` | 非空顶栏增加固定背景/分隔线；空页不在变更清单 |
| 2026-09-23 23:22 | `11371a39` | 两页字体准入均覆盖，但图片标题本身不会使用注册字体 |
| 2026-10-01 00:37 | `c6ac46d3` | 空页才接入共享文本顶栏并明确顶部对齐 |

`evidence/2026-09-14-physical-review/bookshelf-source-audit.md:57` 将正确修复对象限定为 `BookshelfPage.topBar`；同目录 `FEEDBACK.md:347` 泛称“书架顶栏”，没有说明空态范围，也没有空态验收证据。不能把该措辞作为空态早已修复的证明。

`Index.ets:852` 仅在 `isCoreShelfEmpty` 时进入空页；`BookshelfFlowGateway.ts:195` 以 `unfilteredTotal ?? total === 0` 分类。加载尚未完成时这两个可显示状态均为 false；过滤为零而全库非空仍走非空书架；首次加载失败走错误页。因此这次是实际空库命中长期未修路径，并非“加载时先闪空态”导致，也没有证据表明换源改动把书架旧修复覆盖掉。

旧 `test-phone-layout-figma-regressions.mjs:6` 只读取 `BookshelfPage`；`test-app-shell-safe-geometry.mjs:6` 检查共享顶栏安全边距，未检查谁实际调用它；旧 `test-bookshelf-physical-feedback` 空态用例只执行 `sectionHeader/headerAction`。这些均未执行空态实际 topBar/Scroll。新空态生产 Builder 用例修前准确失败、修后通过，补上了本次缺口。

## 同类布局缺口

遍历 33 个 ETS 文件的 45 处 Scroll：21 处竖向明确顶部对齐、4 处横向；其余 20 处逐一检查结构，16 处属于固定或形变阅读面板、按内容测高的弹窗/菜单，1 处诊断页，3 处为详情、搜索空态及阅读失败态。搜索空态和阅读失败态可能按设计居中，未将它们判为已证缺陷。

确认 `LocalBookDetail.ets:136–147` 与旧空书架具有同机制缺口：生产 SDK Builder 发出 `layoutWeight(1)`、`width('100%')`、隐藏滚动条，却没有发出 align；本机 SDK `openharmony/ets/component/common.d.ts:25222` 的默认值为 `Alignment.Center`。该 Scroll 位于返回栏与正常流底部操作区之间，不是居中弹窗。一章时生产尺寸方法计算内容高约 495–516 vp，只要所分配的滚动区更高，内容就会整体下移；目录条数变化还会改变起始位置。两仓此代码一致，当前回归测试覆盖章节数量/横向尺寸，却没有覆盖详情滚动区顶部对齐。此结论为源码、SDK 输出和尺寸约束确认，不声称在当前 VM 再次实测详情像素。

空书架 116 vp、详情 112 vp 底部 padding 是另外的遗留占位，外部导航/操作区已经参与正常流布局；其设计意图仍需核对，暂不将“有两段空间”直接当作缺陷。

## 分支遗漏了已经做过的其他修复

主工作区与本地换源分支共同基线是 `d6c3213c`。主工作区经 `9b8fa909`（09-30 13:48 北京时间）等整合提交保留了此前侧线修复，本地分支没有带入对应代码和专项测试。最新 VM 包源码为 `c6ac46d3`；审计分支 `bf8df662` 此后的变化只有交付记录，因此这些生产代码缺口同样存在于已安装包的源码中。

| 旧修复 | 当前本地分支缺口与触发条件 | 本次证据 |
|---|---|---|
| `313ab577` 标题主题色 | `PageBackBar.ets:24,46` 在构造阶段固定日间标题色；保留节点切到夜间后不更新 | 复用主工作区专项 SDK 回归：主 PASS，分支 FAIL，仍为 `#FF1F1B17` 而非 `#FFEADFCE` |
| `cb408c1a` 设置图标主题 | `SettingsPage.ets:137,168,181` 把已求值 Resource 跨 Builder 传入；保留节点切换主题后仍用旧图标 | 相同专项 SDK 回归：主 PASS，分支 FAIL；主题/自动更新/减少动态效果三个图标仍为日间资源 |
| `e8f044e3` 翻页标题投影 | `ReadingSurface.ets:357,609` 标题读旧 `pageFragments`，正文读 live provider；晋升时两者不一致 | 同一章首标题专项 SDK 回归：主 PASS，分支 FAIL；发出的首 recipe 为正文而非预留空间的章节标题 |
| `54b15e0f` 驻留窗口章首判定 | `LocalReadingExperience.ets:3387` 把窗口第一段当作章首，缺少 documentRange 起点为零的条件 | 同一预备页回归：主 PASS，分支 FAIL；窗口从 scalar 600 开始仍错误设置 showChapterTitle=true |
| `d4354753` 末尾逻辑换行 | `ReadingParagraphProjection.ts:80` 没有排除末尾单个逻辑换行，可能把终端空行传给原生测量 | 同步/异步生产函数对比：分支末尾 LF/CR/CRLF 与尾空格变体 6/6 将终端换行纳入范围，主 6/6 正确；段内换行 6 组对照两边通过 |

前四个专项测试在主工作区存在而在本地分支不存在。原 385 项全过只代表该分支已有检查全过，不能证明没有进入该分支的历史回归也通过。这是另一个可导致旧问题再次出现的具体原因：交付前缺少对已有修复及其专项回归是否随分支保留的核对。

以上五项均有主绿/分支红的本地行为证据。标题专项保留原有断言，仅重定向生产源码路径，反向还原与原测试逐字一致；失败是具体行为断言，不是缺依赖或超时。每次验证均在 120 秒内；未把首个失败后没有继续执行的场景算作独立失败，也未升级为这五项在当前 VM 上的像素复现。

上述主工作区代码的本地通过不升级为主工作区 HAP/设备验收。`ReadingMeasurementModels.ets` 的四个 DTO 外提与分支内联定义逐块一致，未发现这里有测量算法回退。

反方向也存在交付范围差异：主 `2a21ed02` 尚未包含本次 `c6ac46d3` 空书架修复；未来直接从该主源码构建，空态旧问题仍在。当前 VM 已修不代表所有工作区都已修。

## 样式分叉与暂未证实的风险

- `Index.ets:868` 的首次书架加载失败页直接显示错误 Column，绕过 `AppTopBar/MainTabShell`；两仓逐字相同。这是已确认的状态壳不一致，没有把它称为本次代码回滚或已实测视觉缺陷。
- `BookshelfSettingsPage.ets:24` 私有返回按钮与 20 fp 标题未使用共享 `PageBackBar`，属于样式统一风险；两仓相同。
- 平板导航、导入结果行、目录按钮仍有同一多实例 Builder 内条件 Image 的形状。真实 SDK 多实例日/夜/日回放完整，不能单凭历史形状断言当前会丢图标。
- 两仓生产代码均无 `.fillColor()`；本地分支无 PNG 文字标题引用，主工作区唯一剩余引用正是尚未合入修复的空书架。没有找到另一处已证实的位图标题模糊问题。
- RSS 私有顶栏有既有 Figma 例外，且当前 L0 不开放，未当作共享组件遗漏缺陷。
- 未找到 App 安全区重复消费；Index、App/PageBackBar、平板 rail、换源页顶栏所有权与现有检查一致。

## 审计结束边界

本轮没有修改生产 UI、重新构建或操作 VM/真机。书架修复的已安装结果沿用其精确 manifest；新增发现由本轮固定版本的提交历史、源码、生产 SDK 输出及定向行为对比支持。完整逐文件 SHA、主题红绿日志、详情探针及 Scroll 清单见 [ui-regression-audit-evidence.json](ui-regression-audit-evidence.json)。

防止重现需要同时覆盖状态和修复传播：同一页面的有数据/空态/失败态应使用统一页面骨架；每个已修问题保留能执行对应生产路径的回归；交付分支核对已有修复及其测试的保留情况，再绑定构建和安装身份。该措施本身不代表本次所有新发现已修复。

## 全量执行开始

用户于 2026-10-01 明确要求“全量执行”上述修复方案。实施基线：隔离 Harmony `2c04738c` clean，主 Harmony `2a21ed02` clean；Core 沿用既有配套 dirty 快照，不新增协议/Native 改动。并行处理旧修复窄迁移、书架共享状态骨架、详情与设置页；逐组回归后统一提交和规范 signed iteration 构建。新包在同一现有 VM 保数据覆盖安装，并记录限定场景的视觉证据；新增修正整理为主工作区可审阅且 `git apply --check` 通过的补丁。此节只记录授权与执行起点，尚不代表修复/构建/安装完成。

## 实施与定向回归（构建前）

五项遗漏旧修复及 offscreen 属性发布闭环按生产 hunk 迁回隔离分支；8 项目标行为先红后绿，另 7 项相关控制通过。新增章节 EOF LF/CR/CRLF、尾空格、段内换行和未完整窗口反例。未迁入无关诊断日志或覆盖阅读整文件。

书架通过 Index 单一 BookshelfShell 挂载，共享 AppTopBar、MainTabShell、More 与锚点；只在内容 slot 切换加载、空库、已准入列表、失败重试。首批 SDK 四状态保壳断言修前失败，修后新增 14 项状态/响应属性/菜单/导航行为通过；原列表、过滤、可见窗口、滚动 anchor、单书动作及 600 vp 平板 rail 保留。独立源码复核未发现新增实质阻塞。空态 Scroll 顶部对齐，底116改为共享16 vp内容间距，这是 normal-flow导航的宿主适配，未将未收录的空态页面稿宣称为Figma错误。

详情 Scroll 显式顶部对齐；设置页复用 PageBackBar、响应式安全边距和可滚动正文。两项 SDK 回归先红后绿，五项相关回归通过。设置保存/回滚/自动更新回调逐方法保持不变。受控 Phone/Tablet Figma fixture 中详情 bottom=112 明确存在，本轮保留；SDK声明验证不等于原生短/长窗口像素验证。

代码修复和本地行为结果尚不代表新 HAP、安装或用户验收。现有 Mate80Pro VM fresh preflight：target127.0.0.1:5555、Emulator40666、boot=true、SceneBoard1450/start1022、日志末段0风险；安装前正常书架为空。原数据不清除；后续通过正常系统导入使用两本明确标记的UI回归书，记录内容hash及本次新增数据，禁止直接注入Core存储。

## 第一次全量检查（未交付）

源码 `cf5d9c02`：394 文件，391 通过、3 失败、0 skip/cancel；耗时117.714秒，未超120秒且尚未构建HAP。失败分别为旧阅读入口测试的全文件转译未过滤新@Builder、SHF03更新intent断言仍读旧Page owner、window-chrome测试仍计数Index旧失败根。记录见ui-regression-full-gate-first-result.json；只迁移对应测试的生产定位与新共享壳证据，不能删除原产品断言或按局部绿跳过全量失败。

三项测试已分别先复现原失败，再按真实生产owner调整并通过，未改产品：精确SDK AST普通方法提取；真实More→Shell→Index更新intent及并发保护；实际Index根palette与MainTabShell日/夜/日observer及失败slot归属。原阅读/退出、窗口安全区和更新队列断言保留。定向证据见ui-regression-owner-tests-result.json。为实际中段窗口场景另外准备单章37,211 scalar测试TXT，仍只通过正常文件导入、进度拖动及退出重开验证，三本fixture的内容hash分别记录。

## 第二次全量检查（超时，未交付）

源码 `1b03aae5`：394文件，283通过、0行为失败、111取消，120秒预算触发，耗时120.020秒。该轮整体失败，不将取消项算通过，未生成HAP。详见ui-regression-full-gate-second-result.json。代码已修且全量未过不能作为设备交付依据。

主机只读资源快照：10逻辑CPU/16GiB内存，空闲约274MiB，压缩器占约6GiB；同时存在其他rustc/clippy编译进程。本任务不停止/占用这些外部工作。保持120秒预算和全部394检查，先校准允许的测试并发、等待代表性探针释放资源，再重跑规范流程。累计swap计数不是本轮峰值，不能据此断言唯一原因。

代表性SDK校准采用同8个文件顺序测6/4/3并发，分别6.594/8.058/9.354秒，均8/8通过；当前证据不支持降并发提速，因此保持既有6。子进程峰值RSS不是同时总RSS，子集通过也不升级为全部394项通过；第三轮仍完整运行并保留原120秒预算。校准证据见ui-regression-concurrency-profile.json。

## VM受控文件入口边界

新包 `86fce31f`/run `20260930T175802Z-86fce31f-6a4cab9e` 已正常启动、保数据覆盖安装。主题日/夜/日与书架设置实图正常。第一次测试书读取尝试使用未带系统URI授权的shell `/data/local/tmp` viewData URI，正常入口回报“导入失败，请重试”，未打开阅读，不能算导入通过或阅读验证。此前代码已明确文件只能按平台可读取URI只读stage，下一步改走既有DocumentViewPicker获得系统授权，不用私有Core存储注入或关闭sandbox绕过。

后续只读确认公共 Download 路径存在，但 HDC send 被平台拒绝；未更改权限或创建文件。改用 HDC 官方 `file send -b io.reader.minliny` 调试应用文件通道，将三个受控 TXT 放入独立 `ui-regression-input-20261001` 目录，再通过正常 `viewData` 自身 file URI 进入 SystemFileOpenHost、只读 stage/hash、LocalBookImportGateway 正常事务。首个错误文件名尝试也记录为导入失败；正确文件的 roundtrip SHA 匹配，短书和长目录书随后导入成功。没有写入 Core 存储。临时本地 HTTP 服务未使用且已停止。

## VM新增发现：继续阅读卡保留旧书

现象：源码 `86fce31f`、signed HAP SHA `7e5fd7f83ab7bbbed9b4fdca49011397c2189a2ebf013ece31c32a0f87ce7937`，先正常导入并阅读短书 A，再导入长目录书 B，翻到第二章后退出。书架 B 已排序第一且显示 4% 进度，而继续阅读卡仍显示 A。证据 `.reader-local/ui-regression-full-vm/ui-full-populated-two.{jpeg,json}`。两书均为本轮受控 fixture，未操作原用户书籍。

代码审计：Index 先返回书架再异步 refresh 可解释短暂旧卡；但同一 applyBookshelfState 已更新列表/进度时，该解释不足。BookshelfFlowGateway/Core 排序与主工作区一致，新共享壳没有保存或转发 continueReading。进一步真实 SDK 专项确切失败：Index @State A→B 自动触发父 Observer，BookshelfPage @Prop 实际已为 B，页面只 mount 一次、21 个 native actor ID 不变，卡标题/作者/封面及点击目标仍为 A。定位到既有 `continueReadingCard(book, isTablet)` 按值 Builder 闭包，主工作区也有相同路径；不是共享壳遗漏数据。

先红证据 `/private/tmp/source-demo-continue-reading-publication-20261001.red.log`，新增专项 `tools/test-bookshelf-continue-reading-publication.mjs`；修复采用现有实时 provider 读取模式，保留 actor 复用，完成后重新全量检查、签名构建和覆盖安装。此节记录新增缺陷与定位，不把尚未修复或重装的结果算通过。

## VM新增发现：长章进度拖动后退出

同一 `86fce31f` 包，正常导入单章 37,211 scalar fixture，在 Reader 原生 Slider 从0%拖至约50%，应用退出至桌面；之后 app-filter dump 只有420 bytes空根，不能算中段恢复成功。已有落盘 `jscrash-io.reader.minliny-20020074-20261001024520927.log` (41,535 bytes) 已只读保存至 `.reader-local/ui-regression-full-vm`，先审计进度回调/异步 seek 和异常栈，暂停该场景的重复设备操作。

取证操作失误单独记录：原拟读取 hilog 尾部的 `hilog -r -n 500` 实际触发了 core/app/only_prerelease 环形 buffer clear；这是错误命令，不是读取，不将此轮 buffer 作为完整历史证据。已先存在的独立 faultlogger 崩溃文件仍保留并成功取回；未清除应用数据、未删除故障文件。后续以本机 SDK/help 明确的只读日志参数取证，禁止继续使用 `-r`。

继续阅读卡本地修复已完成：provider 从实际 @Prop 读取当前书籍，封面/标题/作者/点击实时切换；无书籍时保留点击 no-op。A→B 两种封面变体、同21个 native observer ID/一次挂载、A→undefined→B 合并发布均通过，8项专项及相关回归3.83秒通过，目标SDK semantic/ArkTS0错误（两个既有未解析native/HMS导入仍明确记录，不升级为HAP编译）。完整结果 `continue-reading-publication-red-green.json`。新的设备结果仍须重建重装。

崩溃进一步定位：`ReadingSurface` 标题子 actor 在标题消失后、真实卸载前仍收到属性更新；参数直接取已转为中段的 live fragments，因此给 recipe 传入 undefined，真实 SDK Prop reset 同步触发 production @Watch prepare，读取 key 抛错。`ReaderContinuousReadingStage` 的 titleRecipeProvider 路径存在同类问题。仓库原生 paragraph actor 调用只在这两份生产文件；正文已有按 fragment 绑定的 ForEach，没有本次直接读取可消失标题的路径。

分页和连续模式均用真实 SDK 精确先红（0.47秒/0.45秒、相同 key undefined 栈）后绿；窄修把标题 actor 与有效的自身 recipe/key 绑定，保留 live provider 对当前列表的权威，允许旧 actor 在卸载完成前读自己的有效数据。没有向 ReaderNativeParagraphView.prepare 添加吞错/可空 guard，没有改 seek 或 Core 算法。原有两项标题回归按当前 actor 与历史 actor 的边界增强，相关检查及新包/VM复验结果另记。

## 第四次全量检查（旧签名断言，未交付）

两处新修复提交 `ac2a5c19` 后，397文件中396通过、1失败、0取消/skip，40.622秒；未生成HAP。唯一失败为 `test-phone-layout-figma-regressions` 写死按值 Builder 签名，宽度表达式仍为原来的响应式 shelfContentWidth。测试改为提取实际方法，明确检查 live provider 签名并保留方法内同一宽度断言；定向通过。证据 `ui-regression-full-gate-fourth-result.json`。

该轮发现一份来源未确定的较旧 untracked `tools/test-reader-paragraph-indent 2.mjs`（9,113 bytes，mtime 09-30 20:58，SHA239d3053…）；不擅自编辑、删除、提交或排除，全量发现397中包含此文件。当前分支源码与控制器快照将精确记账为迭代产物，原配套 Core dirty 同样保留。此前394 +两项新专项 +这份额外输入=397，不把额外输入当作新增功能测试。

安装前只读预检第一次使用不存在的 sys.boot_completed 参数及空 pidof，不算通过；第二次进程表列位置解析错误也不算通过。最终使用 `param get bootevent.boot.completed`=true，SceneBoard数字PID1450且stat start tick1022，现有Emulator40666。失败查询记录与正确记录分别保留；未重建VM、修改权限或清除数据。
