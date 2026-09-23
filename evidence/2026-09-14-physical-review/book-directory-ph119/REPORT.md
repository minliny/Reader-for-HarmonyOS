# PH119 按用户新决定建立独立完整目录页

日期：2026-09-17。用户在PH118只读审计后提出新方案：“完整控制栏的书签页，从搜索栏到下方章节列表的部分单独做成一个页面，不包含章节/书签，当前章节等内容”。澄清已确认：**展示全部章节，保留搜索栏旁的工具按钮**。

## 本轮合同

- 详情“完整目录”打开普通独立目录页，保留普通返回导航。
- 内容采用完整控制栏的搜索栏、搜索/到顶/到底/排序按钮、章节列表；显示完整TOC，不截取详情20条预览。
- 不含章节/书签切换标签、当前章节栏、书名/换源/更多控制栏、拖拽柄、收起按钮或阅读背景。
- 普通返回回详情并保留原详情滚动；点击可读章节沿原准入进入阅读。保留真实章节index、卷标题不可跳、缓存/书签行操作的原业务回调。
- 此为用户最新明确决定，覆盖PH118关于寻找历史BookDirectory样式的未决点；不恢复废弃HTML实现，不将旧稿当新样式。

## 设计与代码范围

- 实时读取Figma `klhs2jMM4MncaJFqZMfqEK` / `781:2260 Reader/Full/DirectoryContent`的design context及截图：工具条52高、输入/按钮32高、4个工具按钮、章节行40高/文字11/左右10。源组件包含的tabs和CurrentChapterFooter按用户决定移除。
- 复用现有资源、token、ReaderSearchField、ReaderDirectoryList和projectReaderDirectoryEntries。提取ReaderDirectoryToolbar与ReaderDirectoryChapterRow两个展示叶子，现ReaderControlDirectoryContent保留List/DataSource/形变锚点/生命周期。
- 新BookDirectoryPage使用普通PageBackBar；Index负责应用顶安全区，页面底部负责交互安全区。详情目录不再继承阅读控制器全窗口布局。
- 旧目录测试只验外部路由壳的问题，本轮用实际新页面Builder及工具条/章节行交互补证，不能以空子组件mock证明样式。

起点为Harmony HEAD `5fb96de4cf322c9b4f35c558051ba1fea5196ad5`加PH104–117既有dirty工作；Core 9个dirty文件及PH117原生库保留，不改Core。本轮尚未构建或操作设备；实施、本地回归、样式预览、产物和设备层结果分别续记。

## 实施与本地复核

- 新`BookDirectoryPage.ets`使用普通`PageBackBar`，复用共享工具条、章节行、`ReaderDirectoryList`和既有目录投影；不发起新的目录获取或阅读会话。
- `Index.ets`详情来源目录改用新页；阅读来源仍由`ReaderShell`负责。详情和其目录处于同一渲染分支，保留原详情实例，覆盖期间隐藏并禁止点击、焦点和无障碍进入；返回只关闭目录。
- 原`ReaderControlDirectoryContent`只提取工具条和章节行展示叶子，保留原虚拟列表、数据源、滚动锚点和控制窗形变生命周期。
- 本地SDK Builder和生产方法专项覆盖3000章不截断、筛选/倒序保留真实index、卷头禁点、下载/书签门禁、空与错误内容、左右/底安全区及同一详情实例返回。详情仍为20章预览，独立目录使用全部TOC。

### 实施中发现的问题与处理

1. 共享工具条最初将资源值传入Builder，观察者可能保留旧排序图标。改为组件内部根据排序和主题实时解析；retained Builder更新回归通过。
2. 新页最初依赖章节对象引用相等，跨ArkUI `@Prop`复制可能拒绝正常点击。独立审阅定位后改为显式书源/书籍身份和既有目录事实比较；深拷贝对象正常点击，旧书源同index/同内容回调被拒绝。
3. 首次List绑定前调用滚动存在生命周期风险，增加首次布局门禁；进一步发现同批有→空→有可能让等待门无法恢复，改为List持续挂载，空态文字覆盖，只有书籍身份变化重建。方法和实际Builder证明同批/跨帧空→有保持同一List且首尾工具继续工作。

以上为代码和SDK本地证据，不视为真机视觉或操作验收。另有一次测试命令路径笔误和未设置CommandLineTools环境的命令退出69，纠正后执行成功，未产生产品改动。

## 新样式预览

[BookDirectory独立目录页](https://www.figma.com/design/klhs2jMM4MncaJFqZMfqEK?node-id=4889-201)

- 新建页面`4889:200` / 画板`4889:201`，原详情和阅读控制窗节点及原型连线未改。
- 390×844手机样例：普通48系统状态区、58返回栏，左右20内容外距；350宽工具区，搜索及4个32高工具；章节行40高、Noto Sans SC Medium 11，列表内左右10、上下5，底部安全区34。
- 复用详情状态栏`860:4`、返回栏`860:27`、控制目录工具条`781:2275`与分隔线`781:2314`；章节行主组件`1023:18050/18058/18062`复制为新页局部宽度适配组件`4892:131`，保留原图标/绑定颜色；旧组件不改。
- 新列表`4892:132`含32个样例行，纵向滚动。无章节/书签标签、当前章节栏、拖拽柄、收起按钮或阅读背景。已读取最终节点结构并查看截图；这是样式预览，章名/下载/书签状态为设计样例，不是真机数据。
- Figma制作中两个API限制（滚动枚举值、不能覆盖实例内部位置）导致未完成调用回滚；重读画布确认无残留后，使用合法枚举及局部宽度适配主组件完成。最终截图及字体/工具数量检查通过。

## 交付状态

源码与测试已冻结，官方iteration构建进行中。无本轮设备操作；此前PH117搜索修复将一并进入新包。构建、manifest复验与设备/用户验收分别续记。

### 最终本地与产物结果

- 冻结源码后，官方pipeline的296项Harmony检查全部PASS；完整ArkTS编译、隔离无增量构建、本地debug签名PASS，`git diff --check` PASS。
- run：`20260917T120215Z-5fb96de4-61c06cf2`。
- immutable manifest（原始证据仅本地保留）。正式复验`hap-pipeline.mjs verify --manifest` PASS；签名已验证，Profile为debug。
- signed HAP SHA-256：`476410ea57d45a8020b27d246b3b4ca00f36554197d9abd4e783f5295ea55a91`。
- Harmony HEAD `5fb96de4cf322c9b4f35c558051ba1fea5196ad5` / Core HEAD `bf49495317798f68b98928712eb6e106af02bed1`，均为保留既有未提交工作的iteration，`acceptanceEligible=false`。
- PH117的9个Core源码输入重新逐项校验一致；Core生成原生库→Host原生库→HAP内剥离库溯源验证PASS。raw SHA `71c84f7d172a18b0d2a92be219f7a325209ba51dbcb75495013b44c70506abd5`；embedded SHA `8510666f3586adf09a8b59f6d315c42560f6b45cbad90a7ae1851abdf62134d0`。
- 本轮没有连接、安装、启动或操作设备，用户数据未动。真机仍为此前PH116版本；本轮PH119包已包含PH117搜索修复，但尚未安装。VM/真机行为、视觉与用户验收均OPEN。
- 原始证据：`hap-build.log`、`hap-verify.log`、`iteration-provenance.json`、`final-delivery-verification.json`及`figma-preview.json`。

### 用户授权后的VM安装（2026-09-17）

- 用户明确要求“完成后安装到 VM 中”。现场重新确认唯一在线VM：Mate 80 Pro，实例为原目标设备，回执仅本地保留；Emulator进程99447，运行参数指向该实例；本次HDC发现在线，qemu当前启动日志确认bridge处于监听状态。物理机未操作。
- 主机沙箱首次`ps`权限受限，首次HDC发现输出`Connect server failed`，立即停止设备请求并只读核查：原HDC服务PID2483正常监听8710、无其他租约占用。在允许本机通信的执行环境中重新发现成功；没有重启HDC、VM或反复探测。
- 当前启动门禁：`bootevent.boot.completed=true`；本次Emulator启动日志2026-09-16 08:45:16.131记录`Guest OS Boot Completed!!`；SceneBoard PID1538和Engine PID1955已稳定运行约1天9小时；当前系统日志对退出循环/生命周期超时/panic扫描无结果。所有HDC操作经共享租约顺序执行，安装另持pipeline目标锁。
- 独立产物审阅再次确认：源码742文件、controller363文件、工作区合同15文件当前指纹均匹配manifest；PH117 Core 9文件、HEAD/dirty状态及Native输入未变。不需重建。
- 官方`inspect` PASS：现有应用与signed debug包身份匹配，允许保数据覆盖更新。随后`install`、安装后身份复核及`EntryAbility`启动均PASS。完成时间北京时间**2026-09-17 20:29:13**，原目标设备，回执仅本地保留。
- 安装仍为run `20260917T120215Z-5fb96de4-61c06cf2`，signed SHA `476410ea57d45a8020b27d246b3b4ca00f36554197d9abd4e783f5295ea55a91`；原目标设备，回执仅本地保留。原始预检/安装输出为`vm-inspect.log`和`vm-install.log`。
- 本次只安装并启动，保留应用数据，没有卸载、清数据、新建/替换VM或额外功能操作。**VM安装/启动PASS；目录交互、视觉与用户验收仍OPEN**。租约及安装目标锁均已由工具正常释放。
