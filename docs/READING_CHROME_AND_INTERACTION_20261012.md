# 阅读状态栏与交互响应重新打开（2026-10-12）

## 反馈与证据边界

用户在上一轮安装后明确反馈状态栏完全未修，确认现象是沉浸阅读时系统状态栏仍显示。原要求：沉浸时隐藏系统栏，顶部信息位于系统状态栏位置；控制栏唤起时系统栏恢复并覆盖顶部信息。上轮源码/合同通过不能替代该反馈，状态栏设备验收重新打开。

用户追加：详情加入/移除书架使整页闪烁重建；《大明望族》首次入架后跳第325章有延迟及卡顿。要求点击立即进入目标章节阅读页，即使正文未缓存，也显示动态加载和可返回/取消的交互，不能等待正文后才导航。

上一轮安装回执绑定 `20261012T130551Z-493e6315-ff0cd5ff`，本轮尚未现场核对用户反馈时的应用产物或复测设备，不将该历史绑定作为当前实时设备证据。Core/Host dirty 并行工作树不重置、不提交、不清用户数据。

## 当前代码侧定位

- `windowPolicyFor` 将 hideStatusBar 绑定到 extendIntoCutout；默认和显式false配置会主动显示沉浸系统栏。旧SDK合同还把关闭control后继续显示当正确行为，是上一轮漏检的直接原因。主路径已改为 `!forceStatusBarVisible`，保存的cutout设置不改。
- 顶部信息在cutout=false时额外下移完整statusHeight；现在信息轨道始终从实测statusRect.top开始，正文仍避让cutout安全区与完整字体高度。
- 普通continuous模式遗漏共享ReaderPageChrome，已补List旁唯一同级信息层；真实SDK验证百分比变化只更新header，stage、dataSource和fragment对象保持同一身份。
- `onDirectoryChapterSelected` 已挂载reader时刻意等待 onReadingReady 才改route；控制目录 `selectChapterAnchor` 也等待真实进度提交才关闭面板。旧设计不满足新的即时导航要求；需要把显示加载与Core真实提交分开，保持进度/缓存/取消边界。
- `applyDetailBookRemoval` 原来直接离开详情；加入时Host和Index又重发同版本整份元数据、TOC和session。已在membership pending阶段阻止完整projection重发，同身份/版本对象复用；移除回执只更新membership，保留详情与滚动。Local书籍实际内容删除后就地提示重新导入并禁用已不可用的加入、阅读及章条目。
- 冷正文`readingChapterLayoutMap`与整章段落扫描同步占主线程。现在复用已有异步字符映射/段落准备和512行转换批次；私有准备完成、内容epoch/selection/lifecycle仍有效后统一发布并排版。预制首帧保持既有有界快路；本轮没有改Core/Native。
- 离散目录/书签/搜索选章立即露出不透明目标章节加载态，使用原生LoadingProgress与共享返回按钮；slider仍保留当前控制栏。已经存在当前token可见page的同章reflow/邻页测量不遮挡。选章进度无法核实时明确进入failed，关闭提示后保留错误页，重试使用原请求而非猜测恢复章节。

## 本地证据与未决项

政策负对照21例中10例沉浸仍显示，修后全部隐藏→显示→隐藏；永久方法矩阵22例覆盖默认、保存配置、旧版本和失败fallback。真实SDK窗口合同34场景及几何128场景已通过。设备实际表现仍待当前产物复核。

详情真实Host→Index→SDK覆盖加入及移除confirmed/unknown/cancelled、完整projection负对照和本地删除后禁用。冷选章18组相关合同通过，真实timer可响应且三个阶段取消/后续选章胜出；这是响应性证据，不等同网络/总耗时缩短。

第325章路由合同覆盖500章目录、已挂载reader的章节/书签选择；真实SDK加载态覆盖32vp原生动画、标题、主题、返回触发真实beginExit与迟到正文不发布、两种位置核实失败后原请求重试。进度仍只由真实已排版并持久化的页面提交。漫画已挂载目录更章保持原first-ready切换边界，避免把文本loading改动误施加到漫画空List。

独立审阅发现相邻章预备仍有同步全文投影，Native单个巨大语义段落shape也有同步边界；这两项不属于本次冷选章改动的通过范围，后续可用现有异步预热投影+正文窗口生命周期复用补齐，不能据本轮合同声称所有UI热路径已无阻塞。最终全量合同、ArkTS、HAP及保数据安装结果另行追加；设备像素/帧耗时与用户验收仍开放。

## 第一次完整门禁

完整674项：671 PASS，3 FAIL，未进入HAP构建/安装。两项架构合同发现新ReaderChapterLoadingState未登记，已明确登记唯一阅读loading页面策略及实际共享navigation-back消费边，原93项业务预算保持不变；新增唯一返回按钮也纳入全部非法输入/私有尺寸负对照。另一项漫画position hydration SDK fixture缺新增详情方法，已捕获真实方法与admission/recovery生产依赖，删除旧stub。三项分别重跑通过，第二次完整门禁继续使用全量合同，无scope跳过或历史通过复用。

## 最终产物与安装

- 第二次完整674合同全部PASS，无省略；ArkTS、非增量构建、包内源集合、Native/SDK provenance和签名检查PASS。构建日志 `/tmp/reader-chrome-interaction-hap-final-20261012.log`。
- Run：`20261012T140936Z-493e6315-0a151d55`；manifest `.reader-artifacts/hap/20261012T140936Z-493e6315-0a151d55/manifest.json`。
- Signed HAP SHA256：`c283febd099ff191529db674497cdc7f8c149b0bc5bd32cf0828e57f5b6a77e7`；debug Profile已验，证书精确匹配唯一minliny_HarmonyOS权威SHA256 `3A563778E5BF17CD3EAD0218E13B4A5030DE3F5D7D4E21E0336D8EB37B676DC4`。
- Harmony commit `493e631560088f342daef6a8f2535b2cfeec2907`、Core commit `2166576ff5f2091b1d921c9a018cd7c7b536fdd4`，均dirty且没有提交。本轮Core/Native无修改，SO仍为 `d547455b6ca2d5647fbcfc5f4d1ddaf5d6acbe3fa456ecff26f306f282c92fbc`。
- 本轮重新发现连接的physical目标，与已安装bundle签名身份核对，inspect允许matching-identity-signed-update-candidate且preservesData=true。精确目标保数据替换安装PASS，`--no-launch`未启动/自动交互，未卸载、未清空应用数据，也未替换VM。
- 安装回执 `.reader-artifacts/hap/20261012T140936Z-493e6315-0a151d55/deploy-physical-b1f20b88963d-20261012T141114Z.json`；设备匿名reference `physical-b1f20b88963d`。
- manifest不可变原始设备门禁保持OPEN；独立deployment receipt证明当前physical安装PASS，不能改写为功能验收。VM安装、当前HAP真机像素/状态栏/首帧及帧耗时、用户验收仍OPEN，`acceptanceEligible:false`。

## 信息栏顶栏与底栏语义复核（2026-10-12）

用户反馈：阅读页顶部信息行视觉高度小于系统状态栏，要求先使用真实状态栏高度，再按信息文字实测高度动态布局；底栏左侧显示当前章节，右侧显示全书阅读百分比。

代码侧定位确认：`ReaderWindowCoordinator` 已将 `getWindowAvoidAreaIgnoringVisibility(TYPE_SYSTEM)` 转换为 vp，状态栏测量链本身不是固定机型常量；问题在 `resolveReaderReadingLayout` 只把 `statusBarHeight` 当作完整顶栏 lane，`ReaderPageChrome` 仅定位一行 Text，文字实测没有回写 lane。Legado 的 `view_book_page.xml`/`PageView.kt` 使用独立动态状态栏 inset 加 `wrap_content` header，作为本次修复参照。

本次源码修复：`pageChromeTopRegionHeight` 改为 `max(statusBarRect.height, statusBarHeight, measuredTextHeight + 2×8vp)`，正文 `contentTop` 同步避让该 lane；Chrome 顶部文字在同一动态 lane 中垂直居中，避免大字体或小状态栏下出现短栏/裁剪。`LocalReadingExperience.pageChromeSnapshot` 将 page-owned `chapterTitle` 绑定到底栏左槽，将既有全书 `formatReaderPageProgress(...)` 绑定右槽；连续阅读进度刷新同步读取右槽，`ReaderPageChrome` 的测量与渲染样式也已交换。

本地合同验证：上述针对性测试通过，随后 `node tools/run-contract-tests.mjs --full` 全量 674 项通过。以上证明代码几何、字段绑定和 SDK Builder 组合，不证明当前 HAP 的真机像素或用户验收；未在本次改动后重新构建/安装设备包。

## 顶部文字比例定位再次修复（2026-10-13）

用户指出顶部信息文字与系统状态栏时间的位置不匹配，明确要求按文字高度和状态栏高度的比例调整。现有 VM 原图（1280×2832）的时间暗色字形范围约 x=56..189px、y=59..97px；这是截图字形边界，不是系统 Text 的布局框或 baseline，也不是用户真机坐标。

代码侧定位：`ReaderPageChromeLayout` 将文字放在 `max(statusBarRect.height, pageChromeTopRegionHeight)` 中居中；后者包含刘海和字体上下留白，能把文字推低。书签分支还会用所有元素的最大行高再次覆盖两个文字的 y。现有合同大多只覆盖安全区与状态栏同高，遗漏了安全区扩大而文字仍应留在状态栏内的场景。

本轮拟采用已转为 vp 的实测状态栏高度 H 和各 Text 的实测行高 h，位置为 `statusBarRect.top + H × max(0, 1 - h/H) / 2`。标题和时间各自定位，书签不再推动文字；刘海和大字体的正文避让预算保留。无有效实测状态栏时沿用未知/横屏 fallback。源码、本地回归和设备像素结论分别追加，不以历史安装证明本轮修复。

源码已按该比例完成：计算以等价的 `(H-h)/2` 避免除法再乘法的舍入漂移；超出状态栏的文字从状态栏 top 向下完整展开，仍由原正文预算避让。书签高度限制在实测状态栏内，其分支不再覆盖文字 y；刘海与圆角避让使用上移后的完整元素范围。字号和正文几何生产代码未修改。

本地7项定向合同全部通过：系统状态字体与144组比例坐标；真实SDK Text 160组坐标；200组正文/刘海几何与真实reflow；cutout设置恢复；page/status组合与控制栏抑制；布局架构；状态栏背景响应性。`git diff --check` 通过。未在本轮进行HAP构建、安装或设备取证，不能称系统时间字形或用户真机像素已经验收。

用户再次反馈高度未变化。本轮补齐构建/安装；重新发现启动完成的 VYG-AL30 物理机及已有 VM（model=emulator），不把两者混称。代码侧已确认新位置仅在扩展 lane 或书签改变原文字坐标时产生差异；如果设备原 lane 就等于状态栏高度，新旧公式可能等价。代码不能决定 OEM 的字形中心、实际行高或当前页面截图中的偏差。最小物理机取证范围为当前阅读页的顶部字形及显示/隐藏系统栏两个状态，核对信息文字和系统时间的位置、字号与当前安装版本；不读取书籍正文/书架数据库，不进行换源、下载、删除或清数据。

本轮最小取证确认：同阅读页、同分辨率1280×2832、无拖动，系统时间字形中性暗色范围 y=59..98px（中心78.5px，高40px）；沉浸信息时间 y=48..85px（中心66.5px，高38px）。实际信息 Text 的布局框 y=40..97px（高57px），状态栏137px、density3.5，调试展示四舍五入39vp。截图 `/tmp/reader-status-before-20261013.jpeg` 与 `/tmp/reader-status-immersive-before-20261013.jpeg`；布局只提取顶部 Text 框，不读取 Core 数据库。这证明当前误差主要为12px位置偏高，而非明显字号差异，也证明纯数学居中公式不足。

比例调整追加：在 `(H-h)/2` 基础上下移 `0.2×h`，并夹在 `[0,max(0,H-h)]` 内；以本次实测57px行高计算下移11.4px，理论字形中心77.9px，与系统78.5px相差0.6px。标题与时间同实测字体布局、各按自身h计算；书签仍独立居中，不参与文字下移。该系数是当前设备/字体取证得到的光学比例，不宣称为所有OEM或无障碍设置的系统基线API。零高/未知状态栏 fallback 不变。实际新包像素仍须安装后核对。

第一次本轮完整门禁保留FAIL：675项中674 PASS、1 FAIL，未生成或安装新HAP。唯一失败为 `test-reader-physical-window-bookmark-refresh.mjs` 固定旧居中坐标；按新的比例要求精确更新期望并增加完整文字不越状态栏边界断言，其原窗口测量、隐藏状态、刘海、SDK和书签恢复检查保留。定向重跑通过。日志 `/tmp/reader-status-optical-hap-20261013.log`；继续重新执行完整门禁，不复用旧PASS或跳过该测试。

第二轮675合同全部PASS，ArkTS、隔离非增量构建、Native/SDK与HAP字节/签名校验PASS。run=`20261013T132056Z-493e6315-ec2c35f4`，signed SHA256=`ce0eb6b23c1ad4da9758b08525fac6118804b05e759486a4fffb2ae97e67d49f`，唯一指定minliny_HarmonyOS证书验证通过，日志 `/tmp/reader-status-optical-hap-final-20261013.log`。同源码DevEco原生增量打包另行通过（5.930s），Hvigor hook验签的开发输出SHA256=`23e1e70908392a6bbd397c682e52460a558dc7a31817fb980b1ea8b6b5dc4a33`，没有把canonical HAP复制进entry/build。

物理机inspect PASS，同一签名身份允许保数据更新。首次install已完成Bundle Manager覆盖安装及postInstall身份核对，但launch被系统拒绝：10106102，设备锁屏且开发者模式禁止自动解锁。未关闭设备开发者模式、未尝试绕过锁屏、未清数据。该次组合流程退出3，没有最终deployment receipt，install-protection保留新包；启动与新包视觉核对保持OPEN，已请求用户解锁后继续同一产物的规范部署。
