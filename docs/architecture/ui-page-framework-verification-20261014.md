# 分类页面框架验证记录

实施工作树：`codex/ui-framework-completion-20261014`。基线 `4764886e` 是主工作树已存在修改的独立快照，新增补全仅按相对基线 diff 统计。

## 初轮本地验证

- `test-reader-layout-architecture.mjs`：PASS，阅读几何/安全区合同保持。
- `test-floating-page-content.mjs`：FAIL，旧 SDK fixture 未挂入新公共高度计算的真实方法；在更新真实方法接线，保留原滚动断言。
- `test-book-directory-page.mjs`：FAIL，测试枚举新增公共子组件时直接访问不存在的 params；将修正遍历并保留目录语义断言。
- `test-shared-download-ui-sdk.mjs`：FAIL，BookshelfShell 的 trailing Builder 后属性链被实际 SDK 拒绝。复测确认不是临时编辑状态；已改成 props 内显式 content Builder，并保持原 onAreaChange 回调。所有编辑停止后重新全源扫描。

## 证据边界

实际 SDK lowering、业务留存回归、完整 ArkTS 编译、HAP、VM/设备行为和视觉/用户验收分开记账。当前尚未构建、安装或执行设备验收。

独立审查另发现：浮动卡片若重复应用帧 Modifier 会覆盖卡片背景/clip，现已删除卡片层的重复 Modifier，仅公共宿主使用；书架恢复消息成为固定区后缺不透明背景，现交公共 HeaderHost 单独绘制消息区，外浮动胶囊保持原有视觉。最终回归结果待填。

## 补全后的本地结果

以下实际执行通过，不能替代设备像素结论：

- 公共页框架门禁：20 个生产路由、22 个实际分类绑定；日夜不透明遮罩、真实 Builder 槽委托、展开头部高度传递、窄宿主 vp 字符串、窗口阅读纸底及阅读可见性留存；缺遮罩、缺壳、新增未登记路由及内联裸 UI 构造调用负例均拒绝。
- 架构门禁：19 个精确公共生产者及 1 个有限页策略；93 条原私有预算及 7 个已有批准迁移的原始哈希保持，未抬高旧预算。144 个实际 UI 文件均有明确登记。
- 阅读几何、刘海正文、纸面和状态栏组合、入场 handoff、详情完整目录入口及漫画目录路由。
- 搜索历史生命周期及真实卡片布局；标准目录和漫画目录栏；详情 Scroll/dock、下载视觉合同。
- 主页面、RSS/发现、设置、书架状态、二级页避让和安全区 7 项回归。二级页实测 96→58vp 时正文避让 104→66vp，原 Scroll 保留；书架实测 header 经 Index 更新原列表 actor。

Native 与当前 Core 的 1140 文件输入指纹匹配；隔离配套 Core/UI、19 项工作区投影通过身份门禁，规范 sync-native/sync-signing 已通过。完整 HAP 编译结果另行填入。

## 第一轮规范 HAP 门禁失败及修复

`node scripts/hap-pipeline.mjs build --class iteration` 的 Native、工作区身份、签名输入和主题预检通过；完整合同门禁未通过，未发布 HAP。日志位于私有 `.reader-local/ui-framework/hap-build.log`。该轮运行在已出现失败后停止，合同阶段约 193 秒；不能将已执行的部分视为全套通过。

- 隔离 Core 尚无当前快照的 `reader-cli`，七项集成用例出现 ENOENT。已在隔离 Core 执行 `cargo build --locked -p reader-cli`，书源导入、管理共享 owner 和持久删除三项随后复测通过；其余交由第二轮完整门禁核验。
- 迁移后的真实公共 Builder 路径需要原 SDK fixture 同步。已接入真实 Scaffold/HeaderHost 方法，保留原 Scroll、回调、路由和负控断言；临时返回 leaf/index、反馈及产品范围四项通过，38 个原路由守卫保留。
- 合同回归发现实际导航缺陷：旧导航控件可能借用新的回调代号。公共导航控件现在按 presentation generation 轮换，MainTabShell、BookshelfShell 和 Index 校验代号、挂载生命周期与 Runtime。真实 SDK 用例验证旧回调拒绝、新代可用、卸载后拒绝和跨 Runtime 重建；读取 live generation 的 mutation 被拒绝。目录 List/Scroller 未随导航代号重建。
- 字体 carrier 的 Builder owner 迁移已逐项证明，五项字体门禁通过。有限 successor 证明 11 个样式、4 个 AUTO 的同文件 owner 迁移及书架 rail 的唯一共享委托；书架 18 个逻辑 occurrence 保留，真实 wide SDK 验证四个标题/回调和原 UIBold 700/11/18 字体元组。九个新增负控拒绝历史字节、计数、slot、vertical、variant 或私有预算篡改。四个历史 fixture 未修改。
- 搜索/发现/同步 30 项实际 SDK 布局及交互对比、两个复合头负控通过；正文列表、Scroller、原回调和几何保持。

当前尚无本次修改的成功 HAP、安装、VM 或视觉验收证据。

## 第二轮门禁及最后测量复查

冻结提交 `92c21831` 的第二轮规范构建采用合同 runner 已支持的四个 worker。先前失败的 Core CLI、书架导航、字体及公共壳相关用例均通过；运行约 230 秒后因只读末审发现的 Area 单位缺口主动停止，未生成可交付 HAP。日志为私有 `.reader-local/ui-framework/hap-build-r2.log`，不能将部分执行记录当作完整合同通过。

末审限定到 22 个实际页绑定及直接相连的目录 dock/书架菜单叶组件：残留 `Number(area.width/height)` 无法接受合法 `vp` 字符串，导致窄宿主尺寸、底栏高度或菜单锚点失效。明确调用点改为已有公共 `readerPageAreaLength`，保留原数值几何、状态、布局角色和 actor，实际 SDK 正常值/单位值对照及 Number mutation 复现另行记录。阅读器内部业务面板的测量不在本次页框架迁移范围内。

该轮还发现 `test-reader-card-finite-specs` 将 SyncPage 的原整页 body 作为不可变 Card witness，公共框架迁移后产生结构差异。绑定原 SHA 的有限 layout successor 已证明 build、正文槽位、内容 frame 与底部预算迁移；原 48 组 Card/body/state/callback 比较及原 fixture 字节继续保留，三组真实 SDK 场景与丢 slot/section/variant/业务变更负控通过。完整 metrics 平台 seam 修正后四项直接 Sync 集成测试通过。下一轮完整门禁将核验最终冻结输入。

Area 补测结果均通过：

- 标准目录实际 132vp 头部传播到原导航避让 137vp；1280vp 窗口中测得 365vp 宿主，左右安全区 32/24vp 后正文为 309vp，导航/Scroller/规范条目身份保持。
- 漫画目录实际 320vp×480vp 宿主触发原 short-flow 模式，453vp 工具栏、201vp dock 高度均传递；真实 footer 叶组件复用公共解析器。旧 Number 恢复负控拒绝。
- 详情、搜索、下载三页共十四处 native Area 回调逐点正常值/单位值对照通过，十四个 Number 恢复负控拒绝；详情 Scroll、搜索 List/scroller/chip、下载 List/scroller 和 sheet Scroll 保持原实例。
- 书架 More 原点/触发尺寸及实际菜单 overlay viewport、设置页实际 ReaderSelect 触发框和 SettingsShell 原点转换通过；原几何、选择身份、回调及两组旧策略负控保留。

VM 只读预检已确认既有 Mate 80 Pro 实例路径与当前进程一致、guest boot completed 为 true、Emulator 同实例已记录 Guest OS Boot Completed、SceneBoard PID 稳定，近期日志无连续超时循环；当前 /data 可用约 2.6GiB。尚未安装候选包，预检不能记为应用行为或视觉验收。

最终登记只更新漫画 footer 当前 implementation 的一个 import 和两次公共 parser 调用，types/declarations/styles 及整表其它字段逐项不变；其它私有预算和历史字体/Card witness 未刷新。两个架构门禁与 Typography coverage/registry/SDK 共五项再次通过。第三轮规范构建及后续部署回执另存私有 `.reader-local/ui-framework/`，以冻结提交、manifest 和实际回执为准；本记录本身不预报其通过。

## 第三轮完整结果

提交 `68c07539` 在第三轮完整执行 675 项，655 PASS、20 FAIL、unrun 为空，约 576 秒。报告为 `/var/folders/53/6tc2ktbd19dbwxd5pmbp0d_w0000gn/T/reader-contract-run-ax7sOT/results.json`，流水线日志为私有 `.reader-local/ui-framework/hap-build-r3.log`。没有构建或发布 HAP。

第二轮停止后未完整梳理其失败清单，遗漏的项目在第三轮再次命中；本轮所有失败都保留，不作完整通过声明。当前正在按完整清单修复：

- 真实生产 SDK 缺陷：`ignoreLayoutSafeArea` 不属于自定义组件允许的 COMMON_ATTRS，ReaderShell 将原 native Stack 的属性外链到 Scaffold 调用后被 SDK 拒绝。原安全区逻辑必须移到公共 Scaffold 的 native 根 Stack，ReaderShell 只提供文本/漫画事实；不能删除该属性或改用假宿主绕过。
- 隔离 UI 依赖缺失：按原 package-lock 离线 `npm ci --ignore-scripts --no-audit --no-fund` 恢复五个 ignored 包，PostCSS 8.5.29/TypeScript 5.9.3 锁定及包/锁文件字节保持。
- 旧消费者 fixture：导航生命周期、Header/Scaffold 注册、真实完整 metrics、RssPage 固定头初值、共享宿主 descendants 查找与原生控件 carrier owner 需按实际生产接线更新。
- 旧私有布局断言：固定 74vp、逐页 StorageLink/Scroll、详情 Number(Area)、ReaderShell 私有 opacity 及 RSS 字体 build owner 已迁到明确公共 owner，需要保留原行为并证明真实委托，不得刷新历史 witness 或降低计数。

完整修复冻结后必须重新执行 675 项全量门禁及 ArkTS/HAP 编译。第三轮 PASS 项只属于上述冻结提交。

## 第四轮冻结前复测

第三轮 20 个失败项全部针对性复测通过；新增 reader-layout-architecture 与精确两个架构门禁、公共头框架合同也通过。原 13 类/14 个原生控件、历史 witness、字体 tuple、业务/身份/旧物理回调及原负控保留。

安全区由 Scaffold 的 actual native Stack 执行，唯一 ReaderShell caller 传入 `this.contentKind` 和 `this.visible`；text/manga、reader/ordinary 切换清理旧 native 属性并保持阅读 actor。原书架 74vp 初值及实测 96vp HeaderHost 经 8vp top gap 后传播 118vp List 避让，原 List/Scroller/items 保持。

响应式门禁保留原八种宽度、720vp 上限、19vp 边距及全宽分支；新增十个实际 standard variant caller→StandardPage→Scaffold 的数值/vp、对称/非对称安全区回放，保留各页原 Scroller。搜索进度和失败控制沿实际 compound header 查找，停止/重试/出版 fence 及 1000 条引用复用断言保留。

这些针对性结果仍不替代第四轮全量与 HAP。后续结果绑定本次冻结提交及私有 `.reader-local/ui-framework/hap-build-r4.log`、不可变 manifest、部署回执和 VM 原始取证。

## 第四轮全量通过与完整编译缺陷

冻结提交 `aa3eeac2` 的第四轮规范流水线完整执行 675 项合同，675 PASS、0 FAIL、unrun 为空，其中 470 项为 integration，约 514 秒。合同报告为 `/var/folders/53/6tc2ktbd19dbwxd5pmbp0d_w0000gn/T/reader-contract-run-HdpjWD/results.json`。随后真实 ArkTS 编译失败，未发布 HAP、manifest，也未安装候选包；合同通过不能替代完整编译。

完整编译明确定位两类生产接口缺陷：Scaffold、StandardPage、MainTabShell 的 `@BuilderParam overlay` 与 ArkUI `CustomComponent.overlay` 基类方法同名；Discover/RSS 调用 MainTabShell 时仍使用只允许单 Builder 槽的尾随 lambda。修复限定到三个公共声明及精确实际调用点：业务叠层槽更名为 `overlayContent`，两页显式传入原内容 Builder。业务状态、native overlay API、Scroller、安全区和路由对象不变。

测试登记随实际公共接口精确迁移，历史 witness、预算及业务负控保留。公共槽位检查从已安装 SDK 的 COMMON_ATTRS 读取基类方法名，三组恢复旧 `overlay` 槽的负控必须拒绝。第五轮仍须完整执行规范合同、ArkTS、签名、发布与产物核验；其结果存入私有 `.reader-local/ui-framework/hap-build-r5.log` 及后续绑定证据。

## 第五轮产物与 VM 暴露的实际分支遗漏

冻结提交 `83807832` 完整 675 项 PASS、ArkTS/HAP 编译及指定签名通过。不可变 run `20261013T184443Z-83807832-bf6b8fb3` 的 signed SHA-256 为 `f00bf5d2d7d2676d8b53fb2fed880e5c5f569ac1894228a495981ed8deb657d8`。VM 的 inspect、保留数据安装及启动 PASS；该产物为 iteration，配套 Core 仍包含继承 dirty 状态，`acceptanceEligible:false`。

真实 VM 搜索返回 591 项，停止搜索后滑动结果：筛选/统计固定头部遮住了下方列表，未见列表透出。长搜索进度/失败文案在右侧截断，单独记录为未处理页面文本布局现象；不计为顶栏透明问题通过，也不据此声称全部视觉验收。

详情 `诡秘之主` →「完整目录」实际走 `Index.externalDirectory` 的 text 分支 → `ReaderFullDirectory` → `FullDirectoryPanel`，与漫画 `BookDirectoryPage` 分支不同。先前 22 项覆盖只登记了 BookDirectoryPage 的标准/漫画 Builder，漏审了真实 text 分支；因此第五轮全绿不能证明这条路径统一。ReaderFullDirectory 相对继承基线仍为私有根 Stack，无 Scaffold 接线。该覆盖结论过早，须按实际条件分支补逆向覆盖门禁。

该目录在 VM 三次取证及两次滑动后保持章节 1..10。原始 dump 显示 native List 为 enabled/scrollable，但共同祖先 Stack 为 `enabled=false`、`HitTestMode.None`。代码定位：详情 currentChapterIndex=-1，FullDirectoryPanel 在 canonicalOrdinal<0 时结束定位命令但永久保留 initialListPositionReady=false；不是公共 Scaffold 遮罩或截图时机。此路径和锁均继承自 `4764886e`。修复应允许独立详情目录无锚点浏览，保留未知位置且不写阅读进度；阅读内嵌模式继续遵守有效锚点准入。

下一冻结轮需将真实 ReaderFullDirectory 迁入公共 frame，保留原卡片、目录 sheet、motion 和 actor，明确 detail/reader 上下文以保留各自纸底；补精确分支、上下文与初始化负控。随后重新执行完整规范构建及 VM 目录滚动取证。第五轮候选当前不作为框架完整交付。

## 实际条件分支补全与第六轮前提

逐分支复查还发现同步路由在 `syncSnapshotReady=false` 时使用裸 Column，虽产品入口当前关闭，也应遵守统一页框架。该初载状态接入 Scaffold 的 standard 类别，原居中消息进入具名 syncPreparingContent Builder；初始日间纸底保持，夜间从原私有 `#FF24211E` 改为公共 window paper `#FF1C1E1A`，属于统一框架策略，不宣称两主题像素完全不变。

ReaderFullDirectory 使用明确 `catalogContext:detail/reader`：详情保留窗口纸底，阅读来源使用有限 readerDirectory 类别、窗口阅读纸色及 clip，不新增系统安全区避让。原 54vp 标题卡、16vp sheet 间距、恢复栏、motion 和离线菜单分别进入真实公共槽；目录页不改路由、样式选择或业务对象。详情来源将 allowUnanchoredBrowse 传入 FullDirectoryPanel，无锚点时解除原 native 列表祖先禁用；reader/embedded 默认继续等待锚点。

公共 HeaderHost 使用 @Prop measurementKey 创建实际 native Area 闭包，捕获该帧 key 并拒绝旧 key；普通 callback 成员保持稳定，但以第二参数传递实际测量 key，FullDirectory 校验对应 safeTop 后更新避让。避免仅更换父 callback、ArkUI 普通成员仍保留旧 callback 导致后续测量失效，也不轮换 header/body/list actor。第六轮前需验证真实 SDK Prop 更新、过期测量拒绝、有效测量、目录初始化及每个路由条件分支；之后完整 HAP 与 VM 分别记录。

安全区末审补充：Index 对 text 详情目录已消费系统 top，原 FullDirectory 的 topBarTop 又取 visualSafeTop。第五轮 VM 标题顶端约 273px，等于 39vp 状态栏的两次 136.5px 避让。新 detail 上下文只保留设计 18vp 间距；reader 上下文的父 inset 为零，继续处理 max(18, visualSafeTop)。原卡片 54vp 和 sheet 间距 16vp 保持，此处明确纠正历史重复避让，不把旧 VM 几何当正确基线。

最终冻结前 15 项定向门禁全部 PASS，包含真实 Index 详情/阅读分支 → FullDirectory → Scaffold/Header → Panel/native List；320/390/800 宽度、两主题、无锚点浏览/embedded 等待/已知稀疏章节定位、旧 Area 拒绝/新 vp 测量、同 actor、54vp 卡与 16vp gap。真实 Index StorageLink revision 更新后 detail 父 canvas padding 更新、reader 父保持零，body/list 未重建。主链及侧挂裸/未知分支、失去实际 Source/Context/Key/字体物理承载等负控均拒绝；三架构门禁及字体门禁通过，旧预算与历史 witness 不变。当前覆盖为 20 路由、25 项明确绑定（包含标明的 component fallback 与侧挂入口），全量库存 676、integration 471。

第六轮结果绑定本次冻结提交、私有 `.reader-local/ui-framework/hap-build-r6.log`、不可变 manifest 与新 VM 回执。上述定向 PASS 不代替完整编译、安装或本轮目录滚动像素结论。
