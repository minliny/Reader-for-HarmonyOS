# Reader HarmonyOS 全应用 UI 框架审计报告

## 2026-11-15 VM 显示异常与正常重启恢复

本轮读屏和Toggle验证期间，11月15日04:14:13的RenderService绘制线程卡在模拟器DGLES的eglSwapBuffers，随后出现SERVICE_BLOCK和Watchdog退出。foundation、DMS及SceneBoard重建，OEM显示配置读取失败，保存DPI的user_set_dpi_value查询count为0，defaultDpi为0，实际显示密度回退到1.5。具体交互触发DGLES阻塞的直接因果继续保留。

此前通过系统设置切到大档再切回默认档，Reader比例及VirtualPixelRatio恢复3.5。用户再次指出系统显示无法恢复后，本轮确认DensityInCurResolution仍为1，状态栏窗口只有58px高，完整桌面图标和系统文字仍过小。此前只核对Reader比例及VirtualPixelRatio就继续验证，恢复结论不完整。

恢复期间另有4次临时原生适配尝试。01/02在动态库加载处失败，03/04已调用ScreenManagerAdapter.SetVirtualPixelRatio(screen0,3.5)，均返回100。此前将4次都表述为未进入密度写入不准确，现按原始源码和输出纠正。临时二进制及依赖副本的清理沿原记录保存。

用户明确授权正常重启VM并保留数据后，已执行一次正常重启。DMS启动时刻更新为16:53:33.897，SceneBoard从30321变为1426。物理分辨率保持1280×2832，VirtualPixelRatio和DensityInCurResolution均为3.5，屏幕挖孔信息恢复，状态栏窗口从58px恢复为136px。锁屏、完整桌面及Reader书架实屏均已查看。[重启、前后参数与实屏证据](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/display-recovery-after-reboot-20261115.json)

原安装包0.2.0.DEV.d61901614df1的版本、内容身份、UID及更新时间前后一致。正常启动后可见原四本书，Sample EPUB及Native Check保持未读，ReaderFramework显示27%，ReaderManga显示100%。本轮核验范围为正常重启、完整显示恢复、安装身份及可见书架数据，全部用户数据的逐字节审计沿其原范围保存。[完整原因与更正记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/display-density-incident-20261115.json)

最初DGLES阻塞的底层触发点以及再次异常恢复后的保持行为仍有各自证据缺口。全应用框架实施目标已恢复为active，后继验证沿完整恢复的系统显示配置推进。


## 2026年11月15日当前实施状态

全量实施目标已恢复为active。现有批准资料和紧凑布局保留决定继续有效，未完成工作保留在账本。此前把尚未完成的原稿检索、分支核对和原生场景提前写成待用户决定，现已纠正。当前运行代码提交为`c189905d`，已安装候选为`0.2.0.DEV.b2a0c9e4d9eb`。下文保留各批次当时的源码、失败及验证范围。正常重启后的完整系统显示已恢复，代码、原稿和准确原生入口的剩余工作继续由agent推进。


### 实际1.3倍系统字体与基础适配补证

**系统字号第4档已实测为1.3倍，前序环境缺口分类已纠正。** 前序仅测量第2档和第5档，就把1.3与1.6、2一并列入环境缺口，缺少中间档实测依据。当前ReaderWindowCoordinator接受有限正字体值，Ability配置优先，原生观察另读UIContext的fp2px与vp2px比值。实际系统滑块为4／1／1时，配置值为1.3，原生字体比值为1.2999999523162842，跟随系统为true。[实际字体能力与更正](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/font-intermediate-capability-aa.json)

当前b2a0候选完成Source默认内容、详情文字Full目录、下载书籍浏览和书源工具内容四个基础页面的八个初始状态样本。请求宽度分别为320vp和366vp，实际宽度为320vp和365.7143vp，高度均为770.2857vp，每个样本独立确认配置及原生字体为1.3。八张实屏已查看，目录窄宽查询及工具形成分行，下载长标题与元数据自然增高，Source保留其横向筛选条和既定省略，工具七项动作均有原始字形像素。[八个样本、原生树与准确范围](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-font13-aa.json) [原始像素复核](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/font13-aa-pixel-review.json)

Source的320vp样本实际选择“纪实样本”，显示12／24个书源、8个启用。系统字号恢复后，同一进程31278、presentation8继续持有原生输入4222及分组Button4239，分组值、计数和触发器焦点均保留。触发器范围从[438,884][1135,1038]变为[413,823][1134,977]，恢复后的范围在后继分组Back观察之前已取得。晚于配置回调的当前公开Back回执另确认配置与原生字体均回到1。两次工具初始化使内存owner的意图计数为2，分组动作及字号恢复保持该值。

恢复期间一次私有驱动检查失败。旧Source业务历史断言要求开场launch仍在当前日志中，该记录已退出返回范围，驱动因此停止。系统三个滑块当时已经恢复为2／1／1，原始FAIL保留。后继使用已核对的当前进程、页面身份、原生面板及公开Back回执完成续接，早期配置为1而原生读数仍为1.3的观察也按原值保存。[失败及准确续接](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/font-restoration-driver-aa-failure.json)

Source、Directory、Downloads及Tools四项基础登记分别修订为50、47、30和40，adaptation层追加本批准确证据。其他状态、变体、完整原生命中、读屏、方向及整页适配继续逐项处理。当前暴露的系统字号滑块最高第5档实测为1.45，实际1.6及2的系统字体输入路径仍未建立。完整21项逐层判定沿原条件保存，1.3的其余可执行状态继续由agent推进。[四项登记更新](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/registration-font13-aa.json) [当前剩余原生范围](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/remaining-native-entry-review-aa.json)

本批复用c189905d运行代码、原签装候选及保数据安装依据。系统字号、字重和显示缩放最终恢复2／1／1，正常启动返回原四本书架，原TXT27%、两本测试书未读、漫画100%。物理分辨率1280×2832，两个密度字段均为3.5，状态栏136px，SceneBoard1426。[本批收尾与完整证据](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-aa-delivery-review.json)

### 书源其余24目标的实际动作补证

当前b2a0候选在同一default内存宿主、同一presentation中完成其余24个交互目标。四个可用状态的原生selected与实际16/24、6/24、12/24及24项计数吻合，禁用“自定义”触摸后仍选择全部。七个分类逐项取得当前原生selected及投影计数，屏外项经真实横向Scroll到达，最后恢复全部类型。[24目标、34个断言点与完整原生范围](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-source-targets-z.json)

分组当前项、两项样本分组及回到全部分组均取得实际回执，面板外部触摸关闭后保留当前值。五个关闭捕获点均回到同一原生触发器289，focused=true。页头工具回调捕获“科幻样本”，页脚工具回调捕获“纪实样本”，同一owner记录了对应当前筛选元组。查询TextInput272在实际IME、Back及清除后保持同一实例，值为NoMatchZ73129、NoMatchZ73129及空值，焦点为true、false、false，清除后恢复24个书源、16个启用。实际输入法和最终书架实屏均已查看。

页头与页脚新增入口各接纳一次内存add意图，第一源登录和第三源检测分别接纳到准确实体。两项进入checking后，新原生按钮enabled=false，重复触摸后的业务意图总数仍为6。本批业务回执来自既有独立内存owner，实际导入、浏览器登录及网络检测沿各自业务范围使用。源码与回调准入先从当前入口核对，原签装候选继续复用。[当前入口及停止条件](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-target-native-plan-z.json)

34个目标的动作证据现已逐项齐备，包含本批24项、前批9项及准确复用的Toggle行1项。每项保留其原始候选、宽度、密度、状态和回执范围。Source登记修订为49，interaction追加本批准确证据。完整页面E2/E3的边缘命中、其余焦点、读屏语义、字号及方向条件继续逐项核对。[当前34目标对账](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-native-target-map-z.json) [登记更新](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/registration-source-targets-z.json)

六个会话均完成并释放租约，正常启动返回原四本书架。原TXT27%、两本测试书未读、漫画100%，两个显示密度字段均为3.5，状态栏136px，SceneBoard1426。全量目标继续处理剩余完整原生条件。[本批收尾与后继范围](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-z-delivery-review.json)

### 书源恢复动作与34目标原生对账

当前b2a0候选在实际366vp请求、365.7143vp宽、770.2857vp高、系统字号1的Source页面中完成六次场景打开。状态动作、保留列表刷新、空列表重试、未知回执核对、原操作核对、继续原操作及继续清理，共七次业务意图均取得当前进程和当前presentation的唯一回执。刷新后原恢复动作退出，空列表重试后呈现“暂无书源”，未知回执或原操作处理后提示退出，保留行Toggle恢复启用。实际页头返回Button触摸后取得夹具菜单回执。[完整原生动作与逐步断言](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-source-recovery-y.json)

未知回执与原操作长文均完成实际展开、收起及动作命中，两个展开实屏已查看。当前正文与动作在该完整Source视口内可见，原生文字范围和动作范围另存。该场景使用正常SourceManagementPage、公共Notice和公共动作控件，业务投影及回执来自现有独立内存owner。源码几何换代、短窗、大字号、实际业务写入及完整读屏继续沿各自条件验收。[入口、当前代次与有限回执范围](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-recovery-native-plan-y.json)

书源34个交互目标现已逐项对应当前证据。九项目标取得本批准确原生动作回执，一项Toggle行按已核对的源码范围复用，另24项继续逐项核对当前动作或准确复用依据。七个历史目标的原始局部回执保留在对应行。Source正式登记修订为48，仅interaction层追加本批证据，完整E2/E3判定沿原条件保存。[34目标对账](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-native-target-map-y.json) [正式登记更新](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/registration-source-recovery-y.json)

本批沿当前c189905d运行代码及原签装回执复用候选。五个原生会话均完成并释放租约，正常启动后回到原四本书架，原TXT27%、两本测试书未读、漫画100%。两个密度字段保持3.5，状态栏136px，SceneBoard1426。后继准确工作继续留在全量目标内。[当前收尾及剩余范围](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-y-delivery-review.json)

### Toggle消费者核对与正常设置补证

全树八处生产构造已按七个页面族核对。正常通用设置已有四次纯读屏及四次混合激活的原生证据。书源页已有两次键盘及两次纯读屏激活证据，本次核对共享Toggle完整字节、十二个实际行方法及LazyForEach行键和回调装配均未变化，按原范围复用。书源sourceList整段方法已有其他修改，其前缀、状态和完整页面布局继续沿各自证据范围验收。[八处消费者及入口](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/toggle-caller-audit-x.json) [书源准确复用依据](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/toggle-source-reuse-x.json)

当前b2a0候选从正常设置进入书架设置，一次Tab到达当前Toggle。两次受控Enter使原生代次0→1→2，值true→false→true，三个捕获点均enabled=true、focused=true。返回并重新打开后，新页面身份7:1:0仍读取原值true。开发者页面从正常通用设置进入，两次Tab到达“显示组件边界”，原生代次0→1→2，值false→true→false，换代后均保持启用和键盘焦点。重新打开的developer:7页面仍读取原值false。[正常书架设置](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-bookshelf-toggle-x.json) [正常开发者设置](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-developer-toggle-x.json)

两项新场景复用当前已签名安装候选，实际修改的是应用级偏好。书架与开发者原值均已恢复，最后回到原四本书架。两个DMS密度字段保持3.5，状态栏136px，SceneBoard1426。规则管理缺少当前正常设置触发，RSS两页面继续保留L0条件。新场景的结论限定于实际键盘焦点、受控值及重新打开读数，完整读屏语义、声音、异步时序与页面E2/E3保留各自范围。[消费者结果与收尾](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-toggle-consumers-x.json)

本批驱动有两项失败。底部导航隐藏了普通文字节点，按“设置”文字查找失败后，改用当前原生Button的实际范围进入。UITest再次拒绝accessibilityText扩展属性，私有驱动已将可选扩展属性限定为当前支持的uniqueId，后继使用默认原生树。两次失败均发生在偏好动作之前，原始输出保留。生产源码保持c189905d，本批增加准确原生证据和账本更新。

### 原始截图像素复核与误判撤销

**UIF-49已撤销，原始目录四行像素实际存在。** 原V批Back和后续静止态两张PNG的完整文件校验和分别保持f2b2a545245a0f13af36cf2c0f91a4039eb798dd56892870443ef84f8b51d875和6bcc0a04cf31fd4bd375cf5fc2b5a96f3b4e6c56b03d11c64f074844ff58c5d8。四行区域为[120,930,1160,1510]，含13163个深色像素，RGB像素SHA-256均为3a3cd1c6fd140d55c81e828029c90d18b669bf7130dccfda0c0c138cf46e9d9f，与W批可见四行截图完全一致。四个标题区域分别有892、4065、4078、4128个深色像素。原图、原生树和客户端文字命令相互吻合。[原始字节与逐区域比较](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/directory-back-paint-w-original-byte-review.json)

此前将该图像读成目录空白并登记FAIL，是agent的视觉复核错误。该误判引出了额外静止态和RS读取、空草稿与非空草稿的Back对照、3.658秒输入到Back节奏对照，以及一次正常应用冷启动和首个目录入口。W批双截图均可见四个条目，随后原始像素对照确认误判。UIF-49及相应应用或平台归因任务已撤销，原始记录另存供追溯，原生产修复候选继续复用。[更正与额外执行范围](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/directory-back-paint-w-correction.json)

当前目录编辑的源码修复c189905d、三个正常调度SDK回归和Search准确方法，以及实际草稿、Back和再次编辑的有限原生结论继续有效。独立首次Area缺口在原生场景中未触发，完整E2/E3、整页视觉、可听读屏及G05/G10沿原条件记录。后续执行转回真实的逐目标、状态与原稿对账。


本批当前b2a0候选继续沿c189905d及原不可变签装回执使用。正常收尾后已核对原四本书架，原TXT为27%，两本测试书保持未读，漫画为100%，两个密度字段均为3.5，状态栏136px，SceneBoard1426。当前正常Full目录查询的有限原生证据已补入directory::control-text的query和interaction层，完整层判定保留。[当前收尾与证据范围](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-w-delivery-review.json)

现有原稿引用已逐项展开到全部21项登记与194个声明状态。五份现有来源的SHA-256均匹配，其实际授权范围分别保留。当前权威登记没有这些页面与状态的独立整页批准组合，整页视觉继续沿用户接受的原条件保存。逐页逐状态的来源对账已完成，剩余原生命中、焦点和状态格继续按准确入口核对。[完整页面与状态来源映射](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/whole-page-reference-state-map-w.json)

### 正常目录编辑的同宿主重算修复与前序图像误判

**UIF-48已完成代码、准确回归、编译签名及当前目录编辑的有限原生验证。** 当前34f诊断候选实际进入原生焦点ACK和公开键盘请求，随后同一输入收到allowed=false，键盘显示后立即隐藏。完整Reader进程日志补齐了最初过滤日志采样之后的失效边沿。Parent已有当前Search编辑资格，Directory缺少对应接线。前序同型输入装配核对遗漏了这条目录链，本轮已修正。[原始事件与原因链](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/directory-keyboard-observation-v.json)

当前Panel复用同一按模块和语义作用域判定的编辑入口，Directory只在真实原生焦点回执后报告编辑活动。查询输入和草稿保留当前编辑资格，普通搜索、排序、章节及其他动作仍使用几何准入。Back、失焦、失败、卸载、换实体及新列表打开清理原编辑资格。四个普通工具发出实际enabled=false并拒绝其回调，Native Button继续使用平台焦点依赖。旧609源码负例复现准入失效，当前正常Panel装配和SDK回调通过。[准确用例复审](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/directory-method-review-v-reflow.json) [回归与失败尝试归档](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/directory-reflow-regression-v.json)

三个准确用例已重新审读并通过正常调度入口，keyboard-transfer、directory-focus、keyboard-ack-delay共三项PASS。搜索原有search-native-editor-scope准确方法也通过。首个新增断言错误地要求Native Button显式focusable=false，已按共享modifier实现改为检查无显式覆盖，并保留enabled=false和实际动作拒绝。一次资格发布脚本误选父项集合导致派发前拒绝，已改为只发布三个准确caseEntries后正常执行。其他用例及完整套件保持NOT_RUN。[正常调度结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/selected-directory-reflow-v/results.json)

当前候选0.2.0.DEV.b2a0c9e4d9eb绑定运行代码c189905d，不可变run为20261115T105219Z-c189905d-55212394，签名HAP的SHA-256为d34c3fa9c3c2431e482fc4747633ec88ba8e156999626c33911400a42b08a3c3。641个运行源码输入与候选逐字节匹配。指定minliny_HarmonyOS证书验签通过，当前停止态存储副本经正式FFI准入后保数据覆盖并启动。[当前源码与候选绑定](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-candidate-binding-v-reflow.json)

原正常TXT同一目录输入实际保持focused=true，重算后的allowed仍为true，实屏可见键盘，草稿晋江已进入输入。一次Back使focused=false并隐藏键盘，再次显式点击恢复focused=true、可见键盘和原草稿。原四个条目在键盘可见时均显示。UIF-47的显式再次编辑有了当前原生依据，独立首次Area缺口在本次loaded=true场景中未触发。[当前输入、Back及再次编辑](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-directory-reflow-v.json)

**UIF-49的目录空白判断已撤销。** W批对原始V截图完成像素复核，原文件SHA-256保持原值，四个标题区域均有字形像素，整块四行区域与当前已确认可见的截图逐像素完全一致。此前将图像读成空白是agent的视觉复核错误。原图、原生树、绘制命令及误判历史均保留，更正后的依据见下方W批记录。完整目录interaction及整页视觉继续沿原验收条件保存。[失败、已排除范围与后续准确问题](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/directory-ime-back-paint-v.json)

70处实际变化的登记源码及测试引用已按字节更新，原21项逐层结果保留，引用检查0诊断。[准确引用更新](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/registration-source-refresh-v.json) [引用检查](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-v-contract-refs-01.json)


本批最终沿正常Back依次退出输入、Full、Quick和控制栏，正文仍为原第一章段落4，随后返回原四本书架。原TXT显示27%，Sample EPUB及Native Check保持未读，原漫画显示第2页及100%。最终实际书架为native/1794740421722，前一份文件名带final-shelf的截图实际仍是正文，原文件名和回执保留。两个密度字段均为3.5，状态栏136px，SceneBoard1426。[当前签装、原生边界和最终实屏](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-v-delivery-review.json)

### 正常文字目录续接、入口归属与本书规则

**UIF-47补齐目录显式编辑和首个布局回执的续接。** Back会把键盘恢复偏好设为关闭，当前原输入的再次点击原先缺少重新表达编辑意图的接线。另一个旧源码负例复现首次Area在输入准入前被拒，同尺寸原生盒随后缺少新Area，显式点击仍因未载入布局而停止。当前固定工具栏和短页前缀均传递当前编辑意图，缺失回执时只安排一次同ID原生尺寸读取，再沿当前ticket和真实焦点ACK请求键盘。Back、卸载、旧身份、禁用及无效尺寸继续拒绝过期工作。[代码、旧源码负例和准确回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/directory-explicit-editing-u.json)

三个准确SDK用例直接运行通过，覆盖keyboard-transfer、directory-focus和keyboard-ack-delay。统一调度器因它们原有的REVIEW_NEEDED状态在派发前拒绝执行，原FAIL及原资格保留。本次证据使用实际生产Content、Toolbar、Field回调和显式属性重放，焦点与键盘服务由有限端口提供。后继完整ArkTS编译和指定证书签名通过。[当前输入与候选绑定](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-candidate-binding-u.json)

**U批原正常目录编辑当时为FAIL。** 首个后继27ca和当前ea174均保留原生失败。当前显式点击日志为enabled=true、loaded=true，随后原生onFocus回调为true，但采样树仍报告输入focused=false、收起Button focused=true，实屏及窗口记录均未出现IME。本次已有布局回执，首次Area缺口没有在该次触发。已查看的当前Reader日志没有blur或键盘恢复错误，继续追查ACK之后的revision、ticket及键盘请求准入。[原生回执和剩余问题](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-directory-normal-u.json)

正常文字阅读当前通过Quick/Full嵌入ReaderControlDirectoryContent。独立reading-text目录登记是保留的路由装配分支，当前ReaderShell的onOpenDirectory实际调用来自mangaSurface。文字通过书籍信息和详情进入独立完整目录。正式登记保留该分支及原层级判定，补充实际入口归属。[完整入口链核对](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/normal-directory-entry-source-u.json) [13项登记输入更新](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/registration-source-refresh-u.json)

正常原TXT已核对四个目录条目、空书签标签及拖动展开。实际搜索Button提交无匹配查询的旧回执按未改动的提交方法范围保存，首次Enter只递送草稿的观察继续保留。当前正常书籍信息进入同书详情和完整目录，本书规则显示默认卷规则，添加规则和预览可见，应用禁用。实际Back依次退出规则、返回目录及捕获的详情来源，再回到同书第一章段落4，最终正常返回四本原有书籍的书架。规则标题采样焦点仍为false，动态编辑、应用及其余容量状态沿各自条件验收。[正常宿主、默认规则与返回证据](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-directory-normal-u.json)

当前运行提交为1523faef，已安装候选为0.2.0.DEV.ea1747817c17。不可变run为20261115T101238Z-1523faef-4e65b794，签名HAP的SHA-256为e059c58774204602b9266bc0fc9fd40184881576633881bede7106c1e7552262。641个运行输入与候选逐字节匹配。两次覆盖均沿当前停止态存储准入及指定签名身份保留数据，Core和Reader-UI pin沿原值。本批一次pixelMap截图失败经现有显示、窗口和控制栏日志检查后，在同一静止界面补取成功，原始空值原因保留。最终两个密度字段均为3.5，状态栏136px，SceneBoard1426。[当前不可变manifest](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/hap/20261115T101238Z-1523faef-4e65b794/manifest.json)

完整原生编辑、21项登记的其余状态和整页视觉仍由agent推进，既有外部资料及环境能力缺口按原条件保留。当前没有等待用户作出的实施决断。[后继准确工作范围](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/remaining-native-entry-review-u.json)

### 深色主题原生补证与原偏好恢复

正常通用设置的深色Button已取得selected=true原生回执。实际外观偏好只改变appThemeMode和activeTheme，冷启动后继续使用保存的深色选择。四个320vp、默认系统字号1样本已查看实际书源页、详情完整目录、书源工具初始卡片及下载书籍列表，当前文字、图标、选中项和容器使用原有夜间角色。下载排序sheet的四选项、选中标记和完成按钮完整可见，Back返回同一列表。原生实际父高度为770.2857vp。[当前深色实屏及精确范围](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-night-theme-t.json)

初次诊断目标查找仅取得普通书架，该失败保留。旧辅助入口丢弃停应用输出，未观察实际进程退出。后继辅助入口记录停止输出及有界退出观察后，取得实际诊断页，随后只执行缺失样本。书源工具初始化另收到一次内存debug-key回调，原日志保留该计数，颜色取证沿实际初始卡片视口使用。完整宿主、其余状态、目标焦点及方向字号组合继续按各自条件验收。

验证后沿正常通用设置恢复跟随模式并返回原书架。完整外观快照逐字段与验证前相等，包含原四个主题选择、字体和排版项。两个DMS密度字段仍为3.5，状态栏窗口136px。四个页面族追加本次夜间适配局部证据，21项完整层级结果沿原判定保存。[原外观完整恢复](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/theme-t-restoration.json) [四项登记更新](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/registration-theme-evidence-t.json)

### 正常阅读父级接线与恢复后的宿主验证

本批新增准确用例normal-host-chain，通过正常单用例检查入口执行通过。实际RetainedReaderScene、ReaderShell文字ForEach及漫画根装配、readerDirectoryActions、ReaderDirectoryOperations和独立ReadingOfflineHost串联到共享Surface的Button回调。覆盖当前身份、遮挡、前景、旧书籍、忙态重复及原操作确认。属性递送由SDK测试显式重放，等待完成后的动作记录树重新装配，原生保留实例的绘制沿前批证据。当前641个生产输入沿已签名安装候选复用。[本批准确SDK与检查回执](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/normal-reader-recovery-code-s.json)

正常重启恢复后，现有Sample EPUB从正常书架进入，实际打开更多菜单及待处理事项。原书签未知提示的覆盖Scroll为378px高，两动作均为154px高，对应44vp。一次Tab将焦点送到重新载入核对书签Button。Back关闭请求的提示投影，保留同一本书的正文，随后正文触摸可再次打开当前控制栏。Back后的原生树只有根和保留宿主Stack报告焦点，显式阅读目标焦点恢复及完整键盘顺序仍待对应证据。本次保留原书签任务，未发送核对或继续动作。[正常入口、实屏、原生树及精确边界](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/normal-reader-recovery-native-s.json)

最终沿正常Back返回四本原有书籍的书架，两个DMS密度字段均保持3.5，状态栏窗口136px。两次驱动参数错误和一次书名简称断言失败保留原FAIL。后继按实际字段继续，书架完整标题由已取得的原生树离线核对，最后只补读显示参数。13项适用的目录登记更新本次测试指纹，层级判定沿原范围保存，本批沿当前安装候选完成验证。[登记输入更新](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/registration-source-refresh-s.json)

### 当前原离线恢复接线与消息文本修复

**UIF-44补齐原离线清理的恢复接线。** 正常ReadingOfflineHost在独立目录投影读取成功后，仍可能保留原清理结果未知的事实。当前文字阅读宿主复用现有恢复分组递送离线DTO及核对、继续回调，ReaderShell补齐文字和漫画两条装配。漫画继续使用已有下载popup和阅读内下载sheet的有界Scroll。回调复用原presentation、generation、前景和当前阅读或目录资格，漫画下载sheet另核对当前panel及opening。原操作确认与继续资格仍由ReadingOfflineHost拥有。[当前代码及准确回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/offline-recovery-code-r.json)

**UIF-45修正清理回读中的下载进度归因。** 首次原生样本显示未知清理提示被替换成部分下载结果，夹具还错误使用了空session条目。夹具已改用实际64条目录输入。有效session的真实Host负例另证实清理操作会取得章节下载进度，当前Host仅为下载操作更新进度，投影兼容旧清理快照中已有的progress。真实下载的部分完成文案继续通过准确用例核对。[原始失败与定位](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/offline-recovery-native-r-initial.json) [修复回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/offline-recovery-code-r.json)

**UIF-46修正动作预留行被三行上限截断。** 首次原生popup内，业务标题后的装饰预留空间被Text的maxLines3裁掉，正文与动作发生重叠。当前已适配的业务标题可绘制其真实动作预留行，长业务正文继续沿现有三行折叠和展开入口。准确SDK用例包含32个样本，冻结旧maxLines的行为负例保留失败。[当前源码与SDK结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/offline-recovery-code-r.json)

当前完整ArkTS编译、指定minliny_HarmonyOS证书签名及远程VM保数据覆盖安装通过。运行提交为20443d1b，候选为0.2.0.DEV.d61901614df1，不可变run为20261115T073103Z-20443d1b-3a66831a，已签名HAP的SHA-256为ccb23e54acc5e880800587a318f2894f2f10de70ddc1a749ed917e8f48e98074。641个运行输入与候选逐字节匹配，包含273个ETS和368个TS。Core及Reader-UI pin沿原值。首次两个编译前入口失败、首个原生布局失败和驱动入口失败均保留各自结果。[不可变manifest](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/hap/20261115T073103Z-20443d1b-3a66831a/manifest.json) [当前源码绑定](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-candidate-binding-r.json)

前批在重启前的VM上完成正常BookDirectoryPage下载popup的有限原清理场景。当时VirtualPixelRatio为3.5，DensityInCurResolution为1，状态栏窗口58px，布局结论保留该实际环境。两个原生恢复Button1452、1458高154px，对应44vp。原清理保持同一presentation和generation，独立可用内容回读成功后继续显示未知事实。实际核对进入忙态，两动作禁用，重复触摸后最终query计数只从2增到3。实际继续进入secondaryBusy，重复触摸后最终continue计数为1，准确有限回执将原操作推进为confirmed，rawOriginal清空，共享提示退休。正文及两动作实屏已查看。[当前原生按钮与原操作回执](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-offline-recovery-r.json)

一次驱动错误将同步发布的busy观察误作异步gateway计数已更新，原会话保留FAIL。源码确认Host先发布recoveryAction，再await pendingClearOperation，计数在后续gateway调用内递增。后继沿同一PID及同一原操作补齐重复触摸和确认步骤，当时正常启动回到书架，VirtualPixelRatio保持3.5，完整系统显示随后经授权正常重启恢复。该场景使用独立真实Host和有限公共回执端口，Core请求计数始终为0。正常文字阅读和漫画阅读宿主的完整原生动作、焦点及读屏矩阵继续由agent补齐。[观察顺序归因](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/offline-r-native-observation-failure.json)

21项登记更新本批实际变更的源码和测试指纹，原层级判定保持。引用检查0诊断，登记检查仍为37项既有诊断。完整E2/E3和整页visual保持各自原有条件。[登记输入更新](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/registration-source-refresh-r.json) [引用检查](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-r-contract-refs-01.json) [登记判定](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-r-register-01.json)

### 前一批空结果续读与短页查询滚动修复

**UIF-42修复已确认空结果后的读取装配。** 原Surface将visibleTotal为0视作无保留内容，再次搜索进入pending或failed时选择居中状态Column。短页查询已由真实Grid前缀承载，该分支会移走前缀消费者。当前保留已有view与native prefix的消费者分支，加载和失败继续通过原emptyBuilder进入Grid空态item，重试复用当前读取代次及拒旧能力。新鲜SDK分支见证确认旧实现缺少消费者，当前实际Grid Builder验证加载状态的递送。早期见证02使用的工具没有模拟分支移除，该次PASS没有作为保留演员依据。[当前10项准确回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/empty-query-code-q.json)

**UIF-43修复短页输入后的顶部滚动。** 首次VM输入发现查询被滚回视口之外，当前方法见证确认applySearch每次输入都会安排scrollEdge Top。短页流内查询现复用onListUserScroll取消旧顶部及当前行定位任务，保留用户正在编辑的位置。完整覆盖工具栏继续沿原顶部滚动入口。有限读取夹具还修正了不同查询复用viewId的错误，当前两个明确查询拥有不同的公共viewId。首次候选35c4的观察保留原输入边界。[当前10项准确回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/empty-query-code-q.json)

当前候选的完整ArkTS编译和指定证书签名通过，640个运行ETS/TS输入与不可变候选相同。远程VM保数据安装成功。10项准确代码与SDK用例通过，覆盖空态装配、当前重试、旧代次、卸载、短页滚动及原有忙态和Grid索引合同。[完整编译与签名](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-q-build-02.log) [当前源码候选绑定](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-candidate-binding-q.json)

当前原生证据在366×168vp、系统字号1的同一个有限语义目录演员内取得。TextInput285和Grid244跨过MissingA空结果、MissingB未完成读取、明确失败及输入法Back，焦点依次为true、true、true、false。原读取在14:19:53.534进入pending，14:20:05.537记录失败。当前原生重试随后得到Ready空结果，清除搜索恢复普通章节读取，原生headerBack回到菜单，普通启动恢复书架。当前owner的intentCount保持0。[当前原生状态与动作证据](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-empty-query-q.json)

查询可见时，读状态正文位于短页视口下方。失败正文、重试、后继空态正文和清除按钮按各自滚动位置核对可达，正文与动作的完整可见位置分别记录。原生字段与网格身份、读状态回执、正文动作可达及实际读屏继续沿各自证据范围保存。该场景使用明确有限公共读取回执，Core过滤和正常换源提交保留原范围。[当前原生状态与动作证据](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-empty-query-q.json)

本批前七个driver会话保留FAIL。它们包含初始未滚到查询、夹具viewId、追加输入、成功输出误匹配、隐藏Text选择器、返回查询方向及日志mount时效前提。各会话已有准确断言逐项复用，后继只补缺席步骤，最后会话PASS_SESSION并恢复书架。登记首次刷新漏了两个测试输入，共26条漂移诊断，当前已按原批次修订补齐。13项目录登记更新实际输入，8项Book消费者增加准确原生范围，现有整层判定保持，引用检查0诊断，登记继续保留37项原诊断。[当前登记引用检查](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-q-contract-refs-02.json) [当前登记判定检查](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-q-register-02.json)

### 当前换源目录忙态、短页首行与测量归属修复

**UIF-40修复漫画换源目录的忙态投影。** 正常MangaSourceSwitchPresentation已按当前selection合并章节准备请求，ReaderSourceSwitchSurfaces此前漏传该事实。当前沿原owner递送selectionBusy，语义及平面目录的原生行资格与保留回调同时读取当前忙态，提交前Back继续使用原取消入口。准确方法场景进入真实Gateway的一次有限未完成进度读取，检查当前页面演员更新、重复合并和Back，原书籍身份保持。[当前代码与9项准确用例](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-switch-code-p.json)

**UIF-41修复短页目录的偏移容量和滚动归属。** 当前168vp父槽不足以容纳首尾native offset，List接口约定和Grid的CalcContentOffset均会在容量条件下归零。原生观察中，目录行因此与覆盖摘要重叠。首次加入真实List留白后，独立覆盖工具栏仍在进入可见带时挡住下层拖动。当前短页平面List和语义Grid均沿原prefixBuilder装配实际摘要、工具、流内页脚及原生首尾item，页头继续固定。Grid只平移native索引及span，Core rank、目标与原证明入口保持原定义。当前行定位按实际剩余高度限制默认间距。[平台Grid偏移实现](https://raw.githubusercontent.com/openharmony/arkui_ace_engine/master/frameworks/core/components_ng/pattern/grid/grid_layout_base_algorithm.cpp)

平面、语义及固定槽分别持有当前工具和页脚测量owner。旧平面退出后，当前语义Grid的实际帧仍可发布工具和页脚高度。无当前章节的夹具已修正undefined误命中group的错误，显式chapter0继续定位实际章节。旧adaptive-footer用例在已删除的mangaToolHeight处提前失败，现已迁移到当前PageScaffold、geometry及原生Area回调，覆盖固定/流内唯一页脚及保留演员。当前9项准确选择用例形成通过记录，20个显式属性或行为失效负例被拒绝。全部测试范围沿各自真实生产方法、SDK和有限端口记录。[SDK、原夹具错误与旧用例修正](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-switch-code-p.json)

当前VM在366×168vp、系统字号1下补齐两条首章路径。语义Row309完整边界为[393,1449][888,1536]，平面Row1217为[393,1452][888,1539]，均位于当前页头下方。首次选择后保持各自原生身份，enabled变为false，重复触摸的owner意图计数均为0→1→1，两次页头Back均回到当前Root。流内页脚在真实GridItem及ListItem内有完整文本样本。此前全高语义/平面第4章，以及原生查询→筛空→共享清除→IME Back→页头返回，继续按各自91de/eac候选保存。该查询保持TextInput1181与List621，选择意图始终为0。[原生首行、忙态、流内归属及查询证据](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-source-switch-p.json)

当前运行代码提交为`db3cea00`，测试迁移提交为`2783854c`，已安装候选为`0.2.0.DEV.e204cd67520d`。完整ArkTS编译、指定minliny_HarmonyOS证书签名、保数据覆盖和启动通过。不可变run为`20261115T053552Z-db3cea00-edb16804`，HAP的SHA-256为`0b136de041581b26505b7024b9980561b6a99ac9fb23c3178a43952e554e4126`。640个运行ETS/TS输入与当前候选匹配，测试迁移发生在运行输入之外，沿用该包。VM已恢复普通书架，本批会话均已终止。[运行输入绑定](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-candidate-binding-p-final.json) [不可变manifest](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/hap/20261115T053552Z-db3cea00-edb16804/manifest.json)

本批保留初始夹具、首次偏移修复、工具覆盖命中、语义首行及驱动对齐失败。固定步长曾在首行的可见窄带两侧往返，后继按实际行、页头和viewport中点分配最后一段拖动，再补未派发动作。完整登记的E2/E3、视觉、读屏及正常原始业务条件继续保留。目录其余动态状态、实际可执行主题和方向格、正常宿主动作的缺席证据继续由agent核对。当前没有等待用户作出的实施决断。

### 前一批下载状态、布局与触摸边界补证

本批沿既有DEBUG入口增加9种下载状态输入，包含读取中、空书架、读取失败、保留内容失败、原操作待核对、核对读取中、筛选为空、章节投影读取中及章节投影失败。实际SharedDownloadPage消费正常公共props及initialViewState，管理、选择和弹层继续由页面拥有。有限内存owner按正常Host的loading/error、恢复generation和按书籍合并读取规则发布事实。9项准确选择用例通过，原菜单属性及测试提取器的两次失败按原日志保留。[代码与准确回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/download-state-code-o.json)

原VM已完成9种状态的准确观察。读取失败重试接纳一次，清除筛选恢复当前查询且没有新增业务意图，章节投影失败的两次实际重试合并为一个未完成读取。未决恢复保留原操作尚未确认的事实。普通及168vp父槽的书籍和章节浏览、固定管理栏、流内管理栏均已核对，实际全选分别从0到12本书及0到18个条目，Back回到当前菜单。该结果覆盖6个登记上下文的所列布局和当前状态输入。[状态、实际List归属与回调](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-download-states-and-layout-o.json)

**UIF-39修复忙态恢复提示的触摸穿透。** 基线10a5d58d已使用Transparent提示外框及覆盖祖先。实际168vp下载恢复提示中，禁用按钮拒绝重复业务动作，下层搜索框仍获得焦点。首次把提示及分组外框改为Default后，原生复验继续失败，两个Transparent祖先仍让下层参与命中。后继将层级命中边界放在拥有手势的有界Notice Scroll上，使用当前最低API23支持的BLOCK_HIERARCHY，子按钮及Scroll自身继续参与，命中结果向外阻断低优先级层。平台源码按子节点返回结果决定后续兄弟遍历，相关节点自行收集手势后再返回层级边界。[平台命中实现](https://raw.githubusercontent.com/openharmony/arkui_ace_engine/master/frameworks/core/components_ng/base/frame_node.cpp)

3项准确SDK用例通过，覆盖外框、分组、忙态回调、正文及动作容量、旧回执拒绝。恢复原Notice Transparent、Group Transparent和有界Scroll Default的3个负例分别失败。当前原生366×168vp父槽中的Notice Scroll高62vp，原正文可读，实际滚动后动作完整可达。原生按钮297首次刷新后禁用，意图计数0→1→1，下层输入在三次断言中均未获焦，捕获中均无IME面。随后一次实际Back返回当前Root。UITest对该Scroll的枚举字段仍输出Default，实际层级策略的依据沿编译输入及行为对照保存。[UIF-39原始失败、修复与原生回执](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/recovery-hit-boundary-o.json)

当前生产提交为`a3d84a63`，已安装候选为`0.2.0.DEV.6c87d094e03a`。完整ArkTS编译、指定minliny_HarmonyOS证书签名和保数据部署通过，HAP的SHA-256为`b8cd4e9fc0a258bf804f6430df92677dcb1bc284fdade95d5e24f071e4654bdb`。640个运行输入均匹配不可变候选，其中273个ETS、367个TS。与首个下载状态候选相比，只有Notice及Group两份运行源码变化，其余638份同字节。此前状态和布局结果按其实际输入范围复用。VM已恢复普通书架，所有本批会话均已终止并释放租约。[源码绑定](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-candidate-binding-o-recovery2.json) [实际输入复用](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/download-input-reuse-o.json)

本批保留了首次命中修复的原生失败，以及等待参数、启动后入口时序、Back参数和滚动查找方向的脚本失败。后继只补尚未派发或尚未获得的准确问题，已通过的状态和选择动作沿原回执复用。当前完整E2/E3及整页visual判据保持原结果。目录换源的准确装配和未覆盖状态继续由agent核对，原稿、声音、精确字号、真实窗口改高、连续像素和历史同期材料沿既有证据条件保留。当前没有等待用户作出的实施决断。

### 前一批书源编辑器回执恢复补证

本批生产提交为`852c2d2d`，沿既有DEBUG场景表补齐“保存已确认但回读失败”和“保存回执未知”两种编辑输入。输入按正常SourceToolsOrchestrator的readBackEditor/publish发布editorReadback、editorOperation、receipt、反馈事件及消息，正文使用实际共享SourceToolsPage。一次当前内存核对将读取阶段推进到reading、busy=true、回读代次加1，并保留原confirmation、草稿及编辑代次。6项准确选择用例通过，包含2种确认事实×2条恢复回调、旧编辑/操作代次、禁用编辑保存取消、重复及退休拒绝，既有菜单冻结输入负例也被拒绝。[代码与准确回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-tools-editor-recovery-code-n.json)

完整ArkTS编译、指定minliny_HarmonyOS证书签名及保数据部署通过。当前候选为`0.2.0.DEV.00d04806261d`，HAP的SHA-256为`d5bb1a2ba07dd4c0328af0c66228404da8b01a6ca0e727094c15e0e6d7bafc2b`。640个运行输入与不可变产物匹配。与前一候选的输入快照比较只有本批DEBUG夹具1个文件变化，其余639个运行输入字节匹配。此前8种准确原生状态按原b556身份和范围复用。[当前源码与候选绑定](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-candidate-binding-n.json)

当前VM在366vp宽、系统字号1下完成两种编辑恢复。已确认场景的原生重新读取按钮342接纳一次，进入reading后该恢复按钮退出，TextArea334、取消336、保存339保持原生身份。未知回执场景由共享核对提示接纳一次，TextArea917、取消919、保存922保持。两条场景的251字节草稿及编辑代次1保持，owner意图计数均为1→2→2，最后一步为实际点击禁用保存，增量0。回读代次均为1→2→2，confirmation分别保持confirmed和unknown。当前事实停在读取中，完整业务的最终读取及持久化结果继续使用各自证据。[两条实际恢复与禁用保存回执](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-source-tools-editor-recovery-n-00d0.json)

移除确认与More的现有源码和旧能力取证已复核。移除内容读取当前主窗口高度及安全区，metricsRevision驱动订阅已存在；More第二锚点由topBarVisible=false及home输入准入。此前WMS、UITest、DisplayManager帮助及实际最近任务路径尚未提供已达成的同宽主窗口改高操作。单独改变页面内容高度的已有样本按其实际父槽范围使用，准确主窗口高度及短窗口More条件继续保留。该项没有产生用户决断要求。

### 前一批书源工具八状态与停止回调补证

本批生产提交为`6323d632`，沿既有DEBUG页面结构入口增加8种有限内存输入。读取中、空列表、保留列表读取失败、空列表读取失败、未知回执、原操作未确认、原操作待清理及检测运行均使用现有fact投影器和实际共享SourceToolsPage。原默认内容与旧入口位置保留，菜单当前presentation、字体准入和退休回调继续受既有条件约束。6项准确选择用例及2个历史失效负例形成通过结果。[代码与准确回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-tools-state-code-m.json)

首次候选`0.2.0.DEV.56d54d918fda`暴露了本批夹具输入遗漏。4种读取状态缺少正常Orchestrator发布的loading/current事实或失败feedback事件及消息。当前按正常open/reloadManagement链补齐，旧截图只保留其实际正文和动作资格范围。后继完整ArkTS编译、指定证书签名和保数据安装通过，当前候选为`0.2.0.DEV.b556c020a81d`。640个运行源码输入与不可变候选逐字节匹配，其中273个ETS、367个TS。[源码与当前候选绑定](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-candidate-binding-m-corrected.json)

当前VM完成全部8种状态。保留列表的刷新列表及空列表失败的重试分别接纳一次当前内存核对意图。未知回执显示现有投影器的“等待核对”，核对动作接纳一次。原操作未确认和待清理的长提示均完成展开，全文及核对、继续或继续清理、收起在当前宽度和字号下可见。核对和继续分别各接纳一次当前owner意图。有限内存端口按设计继续保持未决事实，原业务写入、文件出口、真实取消及完整读屏语义沿各自条件验证。[8状态、原生目标及动作回执](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-source-tools-states-m-b556.json)

运行→停止中保持7个原生Button身份3152、3155、3158、3161、3164、3167、3170。运行时仅停止动作可用，实际点击原生3161后意图由0到1，7个按钮全部禁用；再次点击同一禁用按钮，计数保持1。实际根宽366vp，系统字号1。两类原操作长提示的展开范围限定于该当前高度，短瞬反馈在普通树及截图采样前已收起，其视觉和语音结果仍需对应证据。

原生脚本在进入最后运行场景前曾因菜单末项被平台树省略而失败，未派发运行或停止动作。已有树明确显示Root菜单及被裁切的前一项，脚本现允许在唯一当前Scroll内向下有界查找缺席项，保持4次滚动及45秒上限。随后只补缺失运行→停止及禁用重复点击，恢复普通启动入口并释放租约。首次脚本失败与补跑结果分别保存。完整E2/E3、整页视觉及其他高度/字号条件保持原判定。

### 前一批书源工具批量动作与导出确认补证

本批复用已安装的`0.2.0.DEV.d6005e1cdf9a`完成当前内存内容场景。启用→停用→检测的原owner意图依次为2、3、4，七个原生批量Button身份201、204、207、210、213、216、219保持。当前实际根宽549px对应owner回执366vp，六十六像素高的动作对应44vp。清空选择后，全选保持可用，六个依赖选择的按钮全部禁用；实际点击禁用的启用按钮，owner计数保持5。[本批原生动作证据](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-source-tools-actions-l-d600.json)

原生导出确认的取消保持计数5，后继准确焦点检查后Enter确认使计数到6。另一次当前场景取得删除内存意图、首行调试及导出全部的回执，均按各自一次实际接纳记账。删除及导出业务回调使用既有有限内存端口，正常业务持久化和文件出口继续保留各自范围。首次标题选择器因共享Button隐藏子Text而在点击前停止，已按实际七动作卡及源声明顺序定位。另一次外部焦点断言失败后编排仍发出了Enter，实际接纳一次内存导出，原截图cancelled命名失实。该次失配原样保留，后继按键派发入口增加当前原生确认框、准确焦点及enabled检查，真正取消和确认分别使用独立回执。

该批曾登记8种状态缺少准确DEBUG入口，本批已完成输入装配与当前VM的有界状态/动作补证。完整E2/E3及整页视觉、读屏和适配条件继续保留。[状态入口源码对账](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-tools-native-state-entry-review-l.json)

### 当前几何、重试与目录换代修复

当前生产提交为`0e55a34c`，本批修复代码提交为`fdf383b0`。本批修改4个生产UI文件，5项准确选择用例和4个历史失效负例取得通过结果。完整非增量ArkTS编译与指定`minliny_HarmonyOS`证书签名通过，当前候选`0.2.0.DEV.d6005e1cdf9a`已保数据安装并启动。640个运行源码输入与候选逐字节匹配，包含273个ETS和367个TS。[本批准确结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/ui-layout-retry-results-k.json) [当前源码与候选绑定](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-candidate-binding-k.json)

**UIF-36修正搜索筛选的窗口几何续接。** 原sheetBody把一次计算的SearchFilterGeometry对象传入六层Builder。相同布局分支下窗口缩窄时，两个已挂载分组继续保持284vp，当前应为264vp。当前消费处直接读取既有几何缓存方法。准确SDK覆盖inline/stacked及fit/scroll四种组合，检查八个当前分组宽度、四个堆叠标签宽度和四次当前筛选动作。冻结几何对象的旧实现负例被当前宽度断言拒绝。[原几何失效](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-k-witness-filter-geometry-01.log) [几何回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/live-layout-retry-k.json)

**UIF-37修正验证页连续字体失败后的重试。** 原attempt按值传入，第二次失败后仍携带第一次attempt，第三次重试被拒绝。当前fontAttempt使用State，并以当前attempt为实际PageState动作建立子树身份。两次有限失败后第三次准备成功，旧attempt、旧菜单及退休owner的回调继续被拒绝。[原字体重试失效](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-k-witness-fixture-font-retry-01.log) [当前重试与拒旧回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/fixture-font-retry-k-final.json)

**UIF-38修正Full目录的保留Tab。** 原默认参数捕获首次layoutPresentation，而tab的PropWatch每次调用openList都会换代，第一次切换后返回章节被拒绝。Full默认参数现读取当前代次，Short头部继续捕获自身ForEach代次。SDK检查三次切换及旧Short回调拒绝。当前VM的同一内存夹具完成章节→书签→章节→书签，两个原生Button身份110和119始终保持，三次原owner意图回执依次为1、2、3。该次内容实际宽315.33vp、高620vp，系统字号1。[原Tab失效](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-k-witness-directory-tabs-01.log) [SDK代次回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/directory-tab-renewal-k.json) [原生三次切换](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-directory-tab-renewal-d600.json)

完整编译另检出了前一批UIF-29徽标的类型错误，colorRole原声明为string，公共颜色接口要求ReaderAppColorRole。当前复用已有联合类型，四个注册角色与当前主题行为保持原合同，准确徽标回归及冻结日间色负例通过。首次编译失败原样保留，后继完整编译和签名成功。Short既有回归还使用旧固定prefix高度及64vp行断言，已按当前minHeight及40+20=60vp的大字回退配方修正，准确short-sdk通过。[首次完整编译失败](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-k-build-01.log) [类型修正回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/import-formats-k-typed.json) [完整编译与签名](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-k-build-02.log) [Short回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-k-short-sdk-03.log)

原343个显式原始参数候选现对账为32项修复、311项已有正常宿主/键/身份生命周期依据、0项待核对。额外37个有省略参数调用的默认参数完成核对，其中1项Full目录失效已修复，36项有固定角色、稳定对象、路由准入或原生打开代次依据。Index的runtime在EntryAbility中先安装，启动准入完成后才装配Index，SearchHost为只读实例。SourceTools日志由正常checkSource整批发布，每条均绑定source/trace/request身份。这些结论限定于逐项登记的当前生产入口。完整页面语义和原生矩阵继续按原条件关闭。[343项生命周期对账](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-parameter-lifetimes-k.json) [37项默认参数对账](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-default-parameters-k.json)

当前书源编辑器原生验证完成。TextArea540获焦后显示系统输入法，Back收起输入法并保留同一原生编辑器及251字节草稿，显式取消移除编辑器并保留批量已选3项。最后原owner记录cancel-editor、editorRevision2、intentCount4。此前过早启动采样、错误诊断枚举和已选0的前提失配均保留，前提失配在编辑动作前停止，后继沿实际已选3继续。[输入法返回与取消](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-source-tools-ime-cancel-d600.json)

13项正式登记的变更输入及一次修订已更新，引用检查0诊断，登记检查继续保留37项原验收诊断。当前Figma准确节点接口再次返回403及Token expired，冻结目录原稿和完整TTS Make V17仍是已有可读输入。用户已批准保留紧凑布局，容量冲突继续保留其原关闭条件。[登记输入更新](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/registration-source-refresh-k.json) [当前Figma接口回执](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/figma-api-k-20261115.json)

漫画的当前原始原生失败已补齐。正常书架按准确source/book身份进入现有漫画，一次原操作在10:42:28.803返回当前网络无法解析书源域名，10:42:28.843记录Manga image unavailable NETWORK。界面显示章节加载失败及原重试/换源入口，本次未派发后续重试。此前标题选择器命中同一书架演员内两个保留Text，在点击前停止，后继改用已有原生行身份。当前可把该次失败定位到域名解析阶段，健康图片内容、保留头部与连续绘制仍沿原条件保留。[当前漫画原始回执](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-manga-original-result-d600.json)

### 当前未决内容与关闭条件

- 全应用正式登记仍有37项诊断，其中E2完整交互21项、E3适配5项、G-03视觉依据8项及SCOPE范围3项。各页全部目标、动作状态、字形、裁切和读屏语义的逐格证据继续由agent补齐。本批与历史原生场景均按各自准确输入及行为范围登记。
- 独立整页视觉依据继续按原图、原稿版本及当前页面状态对应。目录冻结层级与TTS Make V17已找到，当前Figma准确节点403只影响远端当前版本读取。冻结资料支持其已覆盖尺寸及比例，其余整页G-03条件保持。
- 用户已决定保留紧凑布局。目录工具、行及TTS Quick的44vp容量冲突保留具体槽位核算，命中与相邻响应分别使用实际可达证据关闭。
- 当前暴露的系统字号滑块最高第5档实测1.45，第4档已补证为1.3。1.3的八个基础初始样本及Source分组和恢复已有本批准确原生依据，其余状态和变体继续推进。实际1.6与2的输入路径仍未建立。对应有限SDK几何样本保留原判定。
- 移除确认的实际纯高度变化及部分More回退锚点尚未达到准确运行前提。源码高度依赖修复与准确方法回归已完成，原生后果按实际窗口行为单列。
- 当前读屏接口可记录client/window身份，普通UITest扩展项只返回uniqueId。完整spoken名称、role、实际语音队列及短反馈听觉结果仍缺对应可观察回执。
- G05需要连续实际绘制帧。已有两次平台录屏调用均未获得实际授权及STARTED，独立C接口也未建立有效创建结果。G10需要历史异常同期原始录像、trace或绘制数据，沿用户确认的现有资料边界保留。
- 现有漫画资料在当前VM的一次原始请求中域名解析失败，健康内容路径的关闭仍需可用的既有输入或环境。当前失败阶段已有原生回执，历史主机输出与当前结论各自保存。

### 前一批列表行、实体动作与时序索引修复

该批生产修复提交为`8771b09f`，当时修改3个生产UI文件。4个新增准确SDK用例及2个既有准确回归形成通过证据，含13个按最终属性或动作参数拒绝的负例。当前代码相对有效部署回执绑定的`0.2.0.DEV.2d056e9641ba`有19个生产ETS文件变化，当前完整工程编译、签名及本批VM验证待执行。[本批用例与准确复用范围](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-data-results-j.json)

**UIF-33修正RSS其余两处Repeat行。** 全部条目与订阅管理的同键行在DTO替换后都实际保留“旧标题”。当前两个父ListItem把当前item和index递送到保留行。回归覆盖当前文章标题、摘要、日期及实际选择回调，管理行的名称、来源信息、Toggle输入值、行分隔和出现回调索引。两个行身份记录在同键更新中保持，四个旧DTO或索引捕获负例被拒绝。RepeatItem调度及Toggle输入采用有限平台port，原生复用、焦点及绘制继续按各自条件验证。[全部条目原失效](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-j-witness-rss-source-01.log) [订阅管理原失效](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-j-witness-rss-management-01.log) [当前管理行回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-rss-management-rows-j-final.json)

**UIF-34修正复用管理行的实体动作。** 源码见证把同一行的当前实体从initial换到current后，查看、编辑、刷新、删除四个已保留动作都仍递送initial。当前actionBar接收当前实体getter，四次SDK回调分别递送current。旧Toggle实体回调在该变化后继续被身份条件拒绝。该场景采用有限的同节点实体替换及公共动作构造回调port，RSS按现有L0条件登记。[四动作原实体失效](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-j-witness-rss-actions-02.log) [当前实体及旧Toggle拒绝回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-rss-management-actions-j.json)

**UIF-35修正书架保留行的动效位置。** bookRowRenderKey明确省略行位置，排序可把相同内容的行移到另一位置。原Builder把rowIndex和后续index按值递送，现有动效合同对首行与后续行采用不同延迟。准确见证中，行移出首行后卡片宽仍为109.52380952380952，当前时序应为100。现有数据源增加按行键查询当前位置的getter，位置表与items、keys一起更新，并在同步reload监听器前可读。Row、Card、Cover及CoverLayer沿当前索引取样，位置查询在行移除后返回原捕获值，供该节点的剩余绘制使用。回归覆盖0→1→0的位置变化、同一节点身份、卡片宽度、封面及图层圆角、同步监听器读取和四个捕获负例。测试使用实际生产时序常量及方法，原生曲线以有限线性接口递送，原生LazyForEach移动和连续合成继续待验。[原行时序失效](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-j-witness-shelf-index-02.log) [当前位置与同步一致性回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-shelf-row-index-j.json)

既有bounded-badge准确回归通过36个样本，RSS主题图标准确回归及4个负例通过。未选择的旧view-handoff脚本仅调整对应私有参数签名，保留NOT_RUN。原登记引用检查为0诊断，登记检查结果为FAIL、37项诊断。[角标回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-j-badge-01.log) [RSS图标回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-rss-theme-j.json) [正式登记检查](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-j-register-01.json)

343个后续参数调用现有29个已修正，220个按固定值、键控身份、捕获的owner代次或当前ID查询建立源码依据，另有94个继续核对。逐组记录当前文件哈希、准确源码锚点及原始调用序号，源码判定范围限于参数生命周期。搜索筛选sheetGeometry对象递送及原生验证页的重复字体失败重试继续列为源码待答项。当前代码工作与后续VM验证继续由agent执行。[参数生命周期逐项对账](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-parameter-lifetimes-j.json)

### 前一批当前数据、几何与晚到页脚回执修复

前一批生产修复提交为`78b00309`，该批修改7个生产UI文件。9个准确选择用例通过，包含28个按最终属性或真实动作拒绝的负例。该批代码相对已安装候选`0.2.0.DEV.2d056e9641ba`共有18个生产ETS文件发生变化，完整工程编译、签名及本批VM验证仍待执行。代码侧复核继续按原顺序推进。[本批准确用例与复用依据](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-data-results-i.json)

**UIF-27修正RSS当前数据递送。** fatalError从1项更新到2项时，正文原保留1；同名源的原因更新及第二条同名源被原名称键遗漏。当前错误计数及数组读取当前投影，错误行键包含位置、名称和实际原因。feed、refreshing及emptyUnread的订阅列表原保持62vp，当前3项更新到186vp，两个未读条目的范围更新到144vp。同键Repeat的源标题、URL、未读计数、暂停状态和文章标题、摘要、日期及行索引均改为当前读取。回归保留四个行原生记录身份，两次实际选择回调各一次。Repeat调度、索引更新和ListItem展开采用有界平台port，原生虚拟化、裁切及移除绘制仍需对应环境证据。RSS沿现有L0条件登记。[数组原失效](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-i-witness-rss-feed-01.log) [同键行原失效](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-i-witness-rss-rows-01.log) [当前行值与动作回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-rss-rows-i-final.json)

**UIF-28修正搜索空结果的关键词和计数。** 实际resultsContent的延迟ListItem挂载后，正文沿保留的ReaderPageState接收当前关键词和已搜索数。准确场景检查1项“原关键词”更新到7项“当前关键词”，两个独立旧值捕获负例均由当前正文断言拒绝。[搜索当前正文回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-data-results-i.json)

**UIF-29修正导入格式徽标主题色。** TXT、EPUB、MOBI、AZW3继续使用原四个注册颜色角色，消费端按当前主题解析。四个保留Text背景跟随主题变化，冻结日间色的负例被拒绝。**UIF-30修正排版库几何递送。** 两个选择行、四个步进行及八个加减按钮读取当前坐标；有限几何输入下检查同一组节点的纵向及横向更新，并实际接纳一次步进。完整原生字号、字形和连续绘制沿各自开放条件记录。[徽标及排版坐标回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-data-results-i.json)

**UIF-31修正书源恢复覆盖槽的页头续接。** pendingOverlay直接读取当前页面geometry，页头起点60→100时，同一Column的顶部padding更新到100，当前Notice容量由440更新到400。准确回归检查实际父节点和公共Notice参数，长文原生裁切继续按原验收范围记录。[覆盖起点原失效](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-i-witness-source-overlay-01.log) [当前起点及容量回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-data-results-i.json)

**UIF-32补齐已挂载书架内容的晚到页脚回执。** 旧footer-propagation在137vp测量回执到达后才挂载内容，覆盖范围只有初次装配。当前先在0值挂载，再沿实际Scaffold→MainTabShell→BookshelfShell→Scene递送137、153、137，有书、空书架及加载状态均检查同一页面子实例的当前Prop。新见证在正常有书分支实际得到0而预期137。Shell的内容槽现递送当前高度getter，Scene在三个页面的Prop装配处取值。该捕获及旧测试顺序在基线`10a5d58d`已存在，追溯到`d8ad88ef1`；本轮修正此前对晚到续接的覆盖遗漏。八个负例保留错误页面、丢失预算和旧捕获的实际失败依据。原测试同时改用独立footerMeasurementKey接纳标准设置页的高度回执。[来源与旧测试覆盖边界](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/shelf-footer-capture-origin-i.json) [三种书架状态与八个负例](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-i-repair-shelf-footer-03.log)

343个后续候选中，21个调用已随本批修复，322个继续按正常入口、键和生命周期核对。RSS数组及DTO递送属于该原始数值、字符串、布尔清单之外的额外源码范围。书架expandedLayout已追到phoneContent固定false及tabletContent固定true，数值行索引继续独立核对。主导航和设置壳的标准页起点最终传入SettingsPage忽略参数的覆盖槽，当前具体消费事实已登记。已有9项准确结果只支持其列明的方法和有限平台port。15项登记绑定及修订刷新后，引用检查0诊断；登记检查继续保留37项诊断。全应用原生矩阵与后续代码复核继续由agent执行。[343项当前对账](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-candidate-disposition-i.json) [登记输入更新](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/registration-source-refresh-i.json) [引用检查](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-i-refs-03.json)

### 前一批文案、图标与字体修复

前一批代码提交为`47d3c245`，该批修改14个生产UI文件。当前已安装候选为`0.2.0.DEV.2d056e9641ba`，对应已交付生产提交`8801ea4d`。后继代码已完成21个准确选择用例的本地结果，完整工程编译、签名打包及对应VM场景待代码复核继续完成后执行。

**UIF-24修正动态文案、计数、元数据和图标的续接。** 实际SDK复现书架全选接纳后仍显示“全选”、书源检测四计数保留0/0/0/12、漫画及替换规则和RSS图标沿用初始主题、同ID分组名称与选择器保留旧值、书籍元数据标签保留初值、导入结果标题和同操作规则恢复文案保留旧值。当前实际父Builder通过getter或同ID当前记录读取，把当前状态送到保留的原生或共享控件。布局及字体配方继续使用原声明。原48候选中37个动态调用已修正，1个固定删除图标随私有类型调整，10个调用有稳定值、当前读取或代次隔离依据。逐项结果绑定原路径、参数、源码哈希及准确case。[48项逐条对账](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-candidate-disposition-h.json)

12项准确SDK用例覆盖上述更新和实际接纳，19个历史捕获负例均由当前属性或行为断言拒绝。实际替换规则父行同时覆盖编辑和删除图标。已有9项准确调用、角色、目标和布局回归取得通过结果，含书架多选、保留分组管理、文字及漫画详情的字体和窗口样本。先前已通过case沿其准确方法范围复用。[动态属性与行为回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-live-labels-h-final.json) [替换规则真实父行补充](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-reader-live-icons-h.json) [准确方法复用依据](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-live-evidence-reuse-h.json)

**UIF-25修正搜索缺书源原因换代。** 正常stateContent从noSources切到allDisabled时，旧原始reason使PageState标题和动作继续保留前态。当前按实际reason建立明确的子树身份，新的标题与管理动作同步装配，旧原因回调保留原拒旧条件。实际状态变化和管理动作均通过SDK，去掉原因代次的负例复现旧标题。[动态属性与行为回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-live-labels-h-final.json)

**UIF-26补齐书架多选页的晚到字体测量依赖。** 既有selectionFontReceipt检出headerFontRevision已到1而测量代次仍为1，旧100vp页头仍被接纳。提交追溯确认，该遗漏由本轮早先`0810d5f4`测量依赖拆分引入，基线`10a5d58d`的统一换代原会覆盖字体完成回执。拆分后的页头身份只读取视口、系统字号、密度和横向安全区。当前页头增加字体修订，页脚独立读取共享几何及底部安全区。回归确认页头换代2、旧高度退出、页脚代次保持，以及退场后的字体回执拒绝。[字体代次原失效](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-h-shelf-detail-layout-02.log) [字体与独立页脚回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-h-shelf-detail-layout-03.log)

既有测试入口中还修正了历史路径、遗漏的当前编辑代次与原生测量依赖、仅退场直接子组件的处理，以及旧Text框高度和旧布局判据。SourceTools忙碌输入沿现有禁用策略断言，原冻结样式记录保留原内容。详情目录的当前30vp自然内容行和44vp原生动作分别断言。详情的旧高度拒绝采用实际320→319vp宽度变化触发，并额外断言相同输入保持原代次。原失败日志均保留。引用检查0诊断，登记检查保留37项诊断，15项登记输入及其一次修订已刷新。[登记输入更新](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/registration-source-refresh-h.json)

扩大参数名检查时记录343个调用，包含171个数值、151个字符串和21个布尔参数，涉及身份、代次、索引、几何及正文。后继批次已修正其中21个调用，并补齐RSS错误正文、数组及DTO的当前递送。其余322个调用继续核对。后继编译及未覆盖原生矩阵继续由agent执行。[其余参数候选](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-additional-parameters-h.json)

### 已纠正的遗漏与错误

- TTS Make V17完整原始TSX已存在于仓库。此前列为缺失属于检索遗漏。原Quick四个HTML按钮宽高为28、36、28、28，当前独立响应宽度为39、36、32.5、37.5，高度均44。实际AST及分配回归确认包含原按钮且相邻响应分离。Figma接口刷新403记录保留，冻结原稿继续提供其实际覆盖的依据。[原稿准确回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/implementation-continuation-tts-original-02.log)
- 目录旧平面行26vp附属宽度曾被概括到正常语义目录。正常语义路径实际支付44vp宽，Quick32/Full40行高及平面26vp宽分别核对。原始40高裁切行将44高响应投影到40，原相邻目标横向重叠14。获准的紧凑布局及容量冲突继续登记。[原稿与分支对照](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/directory-original-target-comparison-20261115.json)
- UIF-07由先前popup外壳修复引入，overlay根层级落到Appearance全屏关闭面之下，已修正根zIndex并补真实正常装配断言。UIF-09/10补齐Toggle输入身份及原生代次拒旧。13个焦点回调类中9处关键动作已从onIdle移到onFrame。首次完整编译发现测试错误假设FocusController返回布尔值，现按实际void与BusinessError合同修正。原失败记录保留。默认无诊断日志的正常通用设置连续两次换代，键盘和绿色读屏焦点均保持。[准确焦点回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/implementation-continuation-focus-frame-03.log) [默认无日志原生结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-toggle-silent-c96f.json)
- 目录验证夹具原来省略当前内存owner的恢复投影，默认只读状态遮住可写场景。现已分别接通Full的`directoryRecovery`及Control的`bookmarkRecovery`，并通过公共port的`NoStructure`进入真实平面回退。首次错接属性名的编译失败和修正均保留。新增入口位于既有DEBUG验证菜单，内存动作保持原owner约束。[最终夹具回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/implementation-continuation-directory-memory-05.log)

### 本次新增生产修复

**UIF-13修复平面目录的旧行值续用。** 基线`10a5d58d`已经在`onDataChange`后返回相同`row.key`。普通对象行的原生Builder因此保留删除前的书签数据，392f上两次点击都派发删除。当前原生键加入已接纳行值，选章、定位和滚动锚点继续使用业务行键。准确SDK回归检查实际键生成器、未变化行稳定性、删除后的添加动作、下载排队后的禁用及旧键负例。Full和Quick的实际回调均为删除、添加、下载各一次，计数1、2、3，随后下载按钮禁用。原生26vp平面承载之外的行内顶部响应也实际收到回调。[SDK结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/implementation-continuation-flat-update-02.log) [Full与Quick原生结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-directory-flat-update-12cd.json)

**UIF-14补齐漫画下载局部状态的消息接入与动效。** popup外层零时长transition已接通，内部首次读取仍使用缺少偏好与前景约束的自绘加载分支。正常阅读→目录→完整目录路径实际出现LoadingProgress813及四个运行中的自定义动画。当前两个父入口继续传入既有reduceMotion，局部加载和无可用操作失败按消息规范复用`ReaderPageState`，`loadingActive`读取当前前景及偏好，ready动作面继续复用公共组件并取得同一偏好。重试经过原父owner、当前代次和失败准入。消息入口已登记，原自绘加载与失败分支已移除。[准确SDK结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/implementation-continuation-manga-loading-04.log) [popup生命周期](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/implementation-continuation-manga-popup-lifecycle-05.log) [准确消息入口检查](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/implementation-continuation-manga-message-01.json) [共享失败态重试回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/implementation-continuation-manga-shared-retry-01.log)

5aad同场景trace确认LoadingProgress804实际挂载，八次自定义动画采样均为0。菜单显示实际下载操作，Back关闭popup，随后逐层返回阅读和书架。当前采样、实际像素和完整动效验收各保留其证据范围。首个自动入口在章节尚处加载状态时停止，后继观察沿原在途操作继续，确认当前目录按钮出现后进入目录。原失败没有改写。[修复前原生记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-reduce-motion-manga-popup-12cd.json) [修复后原生对照](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-manga-loading-fixed-5aad.json)

**UIF-15统一章节批量动作的可用性与实际准入。** 全选已完成章节时，原“下载所选”和“暂停所选”仅按选择数量启用，实际点击却被`sendAction`中的章节事实准入拒绝。这个条件已存在于审计基线`10a5d58d`。当前两个按钮读取当前书籍和精确章节身份，复用原`actionAvailable`，`captureSelection`复用同一份选择证明生成逻辑，实际发送前仍保留最终核验。准确SDK覆盖九组状态、同实例enabled更新、不可用投影、同索引陈旧章节身份及失效owner。原生320×168vp流内栏的完成章节双按钮均禁用，实际点击暂停位置没有新增意图。320vp正常高度固定栏的混合章节可暂停，实际只收到一次`intent-pause-chapters`。动作发生于既有独立内存下载夹具。[准确SDK](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-c-selection-sdk-05.log) [实际原生回执](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-download-action-admission-a0fd.json)

**UIF-16补齐书源整行换代导致的焦点丢失。** a0fd的第一书源开关经实际Tab获焦，一次Enter接纳false后，原生实例1200变为1654，`focused`变为false，原生代次重新为0。外层`LazyForEach`使用包含enabled及sourceVersion的`sourceRenderKey`，接纳新值会销毁整行和`ReaderToggle` owner。通用设置保留同一组件的通过结果此前没有覆盖这个父级替换。Core的`source_list_entry`对完整Source序列化计算sourceVersion，正常开关值改变也会改变版本。实现同时处理两个字段。外层行键改用sourceId，正文和非Toggle动作槽继续按完整渲染证明换代，Toggle保留组件并读取当前值、当前名称和当前源DTO，原陈旧快照拒绝条件继续完整执行。平台文档说明同键条目复用缓存，当前真实失败独立建立了实际影响。[原生失败](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-source-row-focus-before-a0fd.json) [平台LazyForEach说明](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/arkts-rendering-control-lazyforeach/)

13项准确选择的SDK用例通过，包含当前行键、真实Native Prop换代、两次动作、旧版本及移除拒绝、正常Index接纳和待核对生命周期、原生夹具版本变化、80行安全布局及32样本布局矩阵。原测试提取器遗漏当前方法、几何和生命周期的失败已修正并保留。ba71实际Source内存场景在320vp、字体1下，键盘两次Enter和纯读屏两次双击分别接纳true→false→true，原生代次0→1→2，键盘场景持续获焦。纯读屏三个捕获点的键盘焦点均为false，绿色框均为[632,602,698,668]并覆盖当前44vp响应区。实际内存owner的源版本及动作计数分别为1、2。夹具使用有限内存回执和不透明版本，实际Source页面与共享Toggle参与原生绘制和动作。[实际行与开关回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-c-source-row-sdk-final.log) [正常Index回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-c-source-index-final.log) [本次原生结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-source-row-focus-ba71.json)

读屏第一次激活已成功，随后日志断言因启动记录过期而失败。原FAIL保留，后续只执行第二次激活，最终同一PID原始日志保留动作计数1、2及源版本1、2。另发现早先同会话的固定`fixture.log`文件名会被第二次捕获覆盖，第一份保存日志的字节新鲜度无法追溯。实际截图、断言结果和最终双回执日志仍有各自证据。取证脚本已给分组、几何、夹具及前景日志分配独立时间戳，并在解析前保存、检查实际dump及传输输出。一次修改引入的局部变量重名已在语法检查中发现并修正，最终脚本语法通过。[原始失败与保留范围](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-source-row-focus-ba71.json)

**UIF-17补齐公共及页面原生加载指示的活动约束。** 基线14个生产原生构造点中，10处缺少减少动态效果或应用前景约束。原`ReaderPageState`仅消费默认true的loadingActive，`ReaderRecoveryAction`及书源、设置、书架管理、多选、导入、详情和漫画条带占位存在未约束分支。现复用`SettingsPresentation.mount`已有的readerReduceMotion发布键及readerAppForeground事实，补齐原生enableLoading。书源两处保留内容的读取中状态复用公共PageState的inline加载变体，保留32vp指示、10vp横距及原调用方内距。其他消息状态继续使用原公共表面与动作。当前13个构造点、12个文件均有准确AST约束清单，未新增偏好发布链。[反例](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-d-loading-motion-witness-01.log) [当前SDK及构造点清单](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-d-loading-motion-05.log)

平台enableLoading=false隐藏动画内容并保留布局占位。忙碌按钮原文字opacity为0，单独关闭动画会留下空白按钮。当前在动效隐藏时恢复原动作标签，busy、disabled、generation及原业务准入继续执行。SDK实际检查三个PageState变体的同实例属性更新、调用方活动约束、失败态重试、忙碌标签与零动作，以及SourceTools真实statusCard两种入口的偏好更新。Source和Tools布局准确回归、Root忙碌场景及两项消息入口检查通过。[平台说明](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-loadingprogress/) [工具布局](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-d-source-tools-layout-01.log) [书源布局](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-d-source-layout-01.log) [Root入口](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-d-source-fixture-01.log)

正常通用设置→开发者模式→消息预览已完成偏好false/true的相同场景对照。关闭偏好时，忙碌与加载各两次捕获的原生裁切像素不同。开启偏好后，两组裁切各自相同，48×48px页面加载盒只有一种背景色，原状态文案保留；忙碌动作“核对示例”实际opacity为1，按钮仍禁用。八个捕获点保留准确采样范围。首个文本导航误命中系统状态栏“设置”快捷返回，已补应用bundle祖先范围。消息样例按钮的普通树标签为空，首次查找停止后按实际截图及按钮边界继续，原失败均保留。[正常偏好原生结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-loading-preference-99fb.json)

旧DEBUG书源忙碌场景曾把statusKind固定为idle，只覆盖当时的行禁用。现按真实reading事实传loading，320vp、字体1下实际出现公共行内加载态，32vp盒、10vp横距和保留列表均取得原生结果，11个可见Toggle全部禁用，Root意图计数0。书源工具另补选择3→0→12→0及Back回菜单，三次选择实际回调计数2、3、4，进入时已有一次debug-key输入回调1。该回调与选择分开记账。[当前书源忙碌](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-source-busy-loading-99fb.json) [工具选择](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-source-tools-selection-99fb.json)

**UIF-18修复书源工具页选择发布后的焦点丢失。** 99fb上全选按钮经实际Tab获焦后，一次Enter接纳3→12项选择，原生实例203变为466，键盘焦点变为false。批量卡片的父级键包含selectionRevision，书源行的键也包含selected、actionsEnabled及列表修订。当前保留批量控件及同sourceId行的原生实例，ReaderButton的实际属性观察直接读取当前快照，动作激活时生成当前精确选择证明。原batchSelectionAction和sourceRowAction继续拒绝陈旧快照，外层回调保留页面opening及当前实体准入。[修复前实际失败](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native/1794700149586/result.json) [最终批量SDK](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-tools-batch-e-final.json) [行控件SDK](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-tools-selection-e.json)

准确回归覆盖7个批量和3个行按钮的保留实例、标签与可用性更新、当前选择/列表修订、停止中状态，以及busy、原操作受阻、未知回执、编辑读回、移除实体和退场页面。历史父级换键、旧行标签及旧行键三个负例均实际失败。原布局16行/8环境及固定58高、强制同行负例继续保留，实际外层分配及文字宽度用例通过。旧测试缺少当前方法依赖、误将Text作为可点击载体的失败已修正。完整编译另发现新增文案字典的两种泛型键写法均未通过ArkTS，最终改为显式动作分支并取得完整编译通过。全部失败按原记录保留。[行布局](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-e-layout-01.log) [写入准入](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-e-typography-03.log) [动作分配](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-e-actions-01.log) [最终构建](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-e-build-04.log)

1c2e已在既有独立12书源内存夹具、320vp、字体1下完成准确键盘验证。全选3→12后原生实例201持续获焦。第一书源12→11→12两次选择中，按钮实例248、251、254保持，选择按钮248持续获焦，三次选择回调计数依次2、3、4。进入时debug-key计数1单独记账。场景结束后恢复正常书架。当前键盘结果沿这些实际选择动作保存，纯读屏后继结果见下段。完整动作状态和全页视觉沿各自验收条件继续执行。[修复后原生结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-source-tools-focus-1c2e.json)

本轮在同一1c2e候选另补纯读屏激活。系统读屏四项标志实际开启后，单次全选3→12和第一书源12→11→12的三次物理双击均各接纳一次。五个捕获点键盘焦点均为false，全选实例201的绿色框为[447,470,833,536]，行选择实例248的绿色框为[459,1848,525,1914]，均覆盖当前原生响应区。三个行按钮身份248、251、254保持，选择回调计数2、3、4，进入时debug-key计数1单独保存。实际读屏四项标志已恢复0并回到正常书架。[纯读屏实际结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-source-tools-reader-1c2e.json)

**UIF-19修复书源编辑器的可用性续接。** 正常saveEditor先发布busy=true，再发布保存或读回事实。原editorCard在只跟随读回恢复布尔值的ForEach内，把enabled原始值传入actionButton。实际SDK见证中，保存按钮初始可用，busy发布后仍为true，业务回调则按当前事实拒绝重复动作。当前取消、保存及核对按钮直接从当前editorRevision、busy、原操作和读回事实读取可用性，实际动作复用同一准入方法并保留opening拒旧。取消和保存保留原生实例，原生输入继续按当前编辑资格更新。[修复前见证](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-f-editor-witness-01.log) [当前编辑器SDK](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-tools-editor-f.json)

准确SDK覆盖busy往返、未知回执、受阻原操作、已保存待重读、核对busy、编辑修订和页面退场，原始值捕获负例被拒绝。既有DEBUG工具夹具的保存回调由单纯记录改为接纳一次后保持未决busy，草稿及写入/读回事实分别保留实际内存状态，场景退出结束该样例。新增日志只记录当前busy和editorRevision。夹具准入、原生动作冷态、布局分配及44次字形测量按七个准确case通过。[夹具回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-f-fixture-01.log) [实际状态日志回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-f-fixture-02.log) [准入回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-f-typography-01.log) [布局分配](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-f-actions-01.log)

51ef的实际编辑器中，取消459、保存462和TextArea457的原生身份保持，保存后全部同步enabled=false，251字节草稿保持，重复点击禁用保存位置后，保存意图仍为1次。Root原始回执记录busy=true、editorRevision=1、累计意图4。进入时debug-key1、打开编辑器2及初始editor-draft3分别记账。首次取证脚本在滚动前要求尚在视口之外的双按钮，原生树已证明编辑器打开及TextArea被底边裁切，保存尚未派发。入口改为600px有界外层滚动后沿同一编辑器继续，一次保存完成上述结果，最后恢复正常书架。原失败与采样均保留。[实际编辑器结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-source-tools-editor-busy-51ef.json)

### Toggle迟到回执与可用性续接的补正

UIF-09后继验证实际进入了纯读屏激活。a679在第三次换代丢失绿色焦点，338的六次纯读屏通过后，混合输入接管又出现真实丢焦。缓冲记录保留当前pendingAccessibility及pendingAfterAccessibility，却停在上一代读屏身份。源码见证进一步复现busy挂载、已排帧期间的恢复锁，以及读屏回执之后、最终键盘帧之前的续接丢失。前序两次通过只覆盖当时的实际时序，原失败逐次保留。

当前修复在当前身份、代次、前景和挂载有效的前提下保留被busy或disabled阻断的键盘与读屏意图。可用性恢复后继续当前回执链。平台接受事件与实际原生焦点回执分别处理，未收到实际读屏回执时仅进行一次100ms重试，卸载、后台、身份变化及已移走的实际焦点继续拒绝迟到动作。最终帧、API结算和重试期间暂不可用的分支均有准确SDK回归。[修复前失败见证](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/implementation-continuation-toggle-late-witness-02.log) [最终13项准确回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/implementation-continuation-toggle-late-availability-08.log)

测试夹具原来只给本地Prop赋值，SDK内部父来源仍为初始空身份。首次父级更新会额外触发身份Watch，掩盖真实可用性续接。当前在挂载之前同步实际SDK初始Prop来源，再执行真实父级更新。此前一次重试负例的字符串匹配随生产谓词变化失效，现已按实际谓词调整，失败日志保留。

fe1f正常通用设置默认关闭诊断，连续四次实际读屏双击、两次键盘Enter和两次读屏接管均通过。原生实例650→762→764→766→768→770→772→774→776，值依次交替并回到false。纯读屏保持键盘未获焦，混合输入保持键盘获焦，十个捕获点的实际绿色框均位于当前Toggle响应区。实际焦点日志为0字节。八次场景的原生结论限定于正常通用设置和已观察时序，全部消费者及异步时序沿各自条件继续验收。[当前原生结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-toggle-current-fe1f.json)

缓冲诊断由agent选择加入现有DEBUG warm-Want入口，默认关闭。显式buffered模式在回调中只保留有界内存，单owner及全局均最多64条，显式flush后才写日志。原有实时诊断仍为显式开启且最多40条。正常Want文件接收链及release关闭条件有准确回归。

### 已补齐的正常原生路径

| 场景 | 实际结果 | 当前范围 |
| --- | --- | --- |
| 正常设置Toggle | 四次纯读屏、两次键盘及两次读屏接管，原生值与实际焦点保持 | 当前fe1f、默认诊断关闭、当前VM密度1.5。精确场景之外的消费者与时序独立验收。[记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-toggle-current-fe1f.json) |
| 外书未决恢复引导 | 既有零进度本地书的受拒绝手势实际显示Sample EPUB、作者及原书更多恢复路径 | 当前正常书籍和既有原未决事实。只读引导绘制与原操作核对分别记账。[记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-foreign-bookmark-guide-fe1f.json) |
| 下载筛选，减少动态效果开启 | popup打开，选未下载使4/4变为1/4，恢复全部状态及4/4 | 正常偏好、当前宿主、选值和关闭，含8秒trace。[记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-reduce-motion-download-popup-12cd.json) |
| 书源工具，减少动态效果开启 | 模式搜索→发现→搜索，深度列表和关键词我的保留。返回后原工具按钮focused为true | 正常SourceJourney入口和返回焦点，含8秒trace。[记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-reduce-motion-tools-popup-12cd.json) |
| 阅读顶部More，减少动态效果开启 | 实际菜单打开，Back先关闭popup，随后关闭控制栏并退出阅读 | 正常顶部锚点，含8秒trace。短窗口备用锚点依赖实际高度。[记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-reduce-motion-reader-more-12cd.json) |
| 正常Sample EPUB朗读 | 五次当前会话platform-start，首次距意图1128ms、距dispatch769ms，退出收到停止和释放回执 | 当前系统引擎启动与退出，进度恢复0。实际可听语音独立验收。[记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-tts-platform-trace-12cd.json) |
| 分组及页头 | 正常分组返回焦点、最大系统字体长恢复提示、102vp页头换高与IME续接已有准确原生结果 | 相关生产输入保持相同，沿原范围复用。[分组](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-group-wrap-focus-c96f.json) [页头](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-header-continuation-140c.json) |

### 本轮补齐的原生场景

- 缺书名或作者的合法旧V1原记录已接入实际`ReaderDirectoryHost`及`ReaderDirectoryRecoverySurface`的独立DEBUG场景。有限gateway端口只提供内存回执，实际Runtime请求计数保持0。默认字体下，第一次核对、busy重复点击、不可用回执保留原字节及第二次确认后移除均有实际原生回执。最大系统字体档5实测约1.45倍，提示展开后的全文和核对动作可达，busy期间重复点击仍保持核对计数1，确认后当前提示移除。新入口保留既有DEBUG、字体、当前scene和Back归属。[旧记录与最大字号](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-legacy-original-max-a0fd.json)
- 下载已补书籍浏览、书籍管理、章节浏览、章节管理的正常高度及168vp短高度。正常管理栏位于List外，短高度管理栏流入同一List，末尾可滚动到达。全选、取消及Back取得实际回执。前一候选中“暂停所选”可用却无操作的失败保留，UIF-15后继结果单独记录。[本轮账本](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/ledger.json)
- 同一目录组件已完成章节与书签标签切换、短内容滚走后返回头部，以及122→168→190→168→122vp的真实内容高度变化。实际内容宽272.6667vp，默认字体1。122/168vp使用List内前缀，190vp书签分支使用固定标签及剩余列表预算。所有变体的其他控件、读屏、方向和主题继续保留各自验收条件。[短目录逐场景记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-directory-short-variants-a0fd.json)

- 书源页已补默认、空、忙碌、保留列表读取失败、空列表读取失败、待核对、原操作未确认及已确认待清理八种原生呈现。320vp、默认字体下，可见忙碌Toggle均禁用，保留失败仍有原行，空失败显示重试，原操作清理分支显示对应动作。每个场景Back返回菜单，八项实际面积回执的意图计数均为0，最后回到正常书架。场景使用既有独立内存投影，正常业务写入及完整读屏、主题、方向矩阵继续分别验收。[八状态原生记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-source-state-matrix-a0fd.json)

### 候选2d的历史交付记录

- 生产修复提交`8801ea4d`，产品版本`0.2.0`，`versionCode 1000000`。已安装`0.2.0.DEV.2d056e9641ba`，运行清单`20261115T005852Z-8801ea4d-06df1067`。完整ArkTS编译、指定`minliny_HarmonyOS`签名、停止态DB/WAL备份、可弃副本兼容性证明、保数据安装及启动通过。formal FFI一项本次执行、两项合成证据复用，五项兼容性结果通过。signed HAP SHA-256为`7b85ca8d70ba8620d6081e6fca316a52d34cf8cf266a67c374b85c91bfc56285`。[不可变清单](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/hap/20261115T005852Z-8801ea4d-06df1067/manifest.json) [部署回执](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/hap/20261115T005852Z-8801ea4d-06df1067/deploy-vm-6460677a198b-20261115T010046Z.json)
- 第一次部署准备由agent误把远端formal驱动指纹填为本地部署脚本指纹，校验处停止，installAttempted=false，原安装身份及停止态数据回读一致。按实际远端驱动字节修正配置后，在新尝试目录完成上述正式准入和安装，原失败保留。[首次准备失败](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/deployment/vm-ui-framework-2d056e96-20261115/result.json)
- 候选2d的640个生产ETS/TS运行输入绑定该次不可变编译与签名快照，含273个ETS和367个TS。当时后继14文件变更的完整编译与原生验证尚待执行，当前后继结果已记入本文首节。相对51ef只改变Rules、Discover、Sync和RSS四个保留页面，其他636项字节相同。既有Source、Directory、Download、共享组件和夹具原生结果沿其准确行为范围复用。[当前字节与差异绑定](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/candidate-source-delta-51ef-2d05.json)
- 该候选当时的VM实屏为1280×2832、密度1.5、逻辑宽约853vp。候选2d正常书架、Sample EPUB、作者、章节和继续阅读已核对，四项读屏标志实际为0，该会话租约已释放。减少动态效果false、字体档2、粗细1及界面缩放1沿既有准确恢复证据使用。[当前原生启动结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native/1794704491085/result.json)
- 正式登记保留visual21项NOT_RUN、interaction21项FAIL、adaptation5项FAIL及16项NOT_RUN、Source content原FAIL。本批12个准确SDK及本地case按实际范围记账，新增四项保留页面修复未改变已登记页面根。当前引用与登记检查结果见账本，原633输入审计基线保持冻结。

### 当前仍开放的验收内容

| 内容 | 已建立的答案 | 剩余工作或原条件 |
| --- | --- | --- |
| 实际纯高度变化 | 移除确认长文、末尾双动作与准确高度SDK回归通过。已纠正未进入Recents就推断窗口路线的遗漏，实际停留手势已进入最近任务 | 当前已检查的标题入口只恢复Reader，未取得受支持的纯高度调整路线。移除确认与More短窗备用锚点保留准确原生高度场景，备用锚点由topBarVisible选择。[本次能力检查](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-capability-followup-b450.json) |
| G05连续绘制 | 当前ArkUI/RS trace确认初始正文66→110跨两个UIvsync，命令提交相差6.791ms。新SceneBoard环境的一次公共应用录制亦已执行 | 本次仍进入RequestUserPrivacyAuthority却未见授权面或STARTED，30秒截止释放。已有独立C API创建失败。连续真实像素尚未取得，单帧和trace沿原范围保存。[trace](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-initial-geometry-trace-c96f.json) [录制实际结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-capability-followup-b450.json) |
| 实际自动宣告与声音 | 显式不打断宣告、前景、当前generation和宿主资格已接通，TTS实际平台启动、停止及释放已有结果 | 当前可用采集路线没有取得实际音频。读屏队列、不打断听感、可听语音及未覆盖播放状态仍需相应实际证据 |
| 全应用剩余原生矩阵 | 21项当前登记按正常宿主、变体、原稿及局部结果逐项对账。正常GAP-04既有记录的只读指引，以及缺元数据旧V1记录的实际Host内存端口默认/最大字体原生动作均已有准确范围 | 书源当前值及版本变化的键盘、纯读屏焦点已补本次准确原生证据。平台无障碍服务的-c/-w实际只返回客户端与窗口信息，UITest扩展属性实际只支持uniqueId，对accessibilityText返回Invalid attribute name。原生名称、角色宣告尚无对应读取或声音证据。书源工具的本轮纯读屏选择和编辑busy结果按上文范围使用。全部目标、其他焦点和动态状态、整页字形、裁切、主题、方向及完整变体仍由agent继续逐项执行。旧记录场景的有限端口和真实公共Host、组件、原生动作范围已逐项注明。当前局部通过及真实最高1.45字号均保存准确范围，精确2倍原生环境条件保留。[21项对账](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/registered-design-native-map-20261115.json) [实际无障碍读取能力](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-accessibility-capability-ba71.json) |
| 独立整页视觉依据 | 完整TTS Make V17原TSX及目录原始提取已核对，用户保留紧凑布局的决定继续有效。四工具32宽、Quick32/Full40高及TTS Quick横向容量冲突按批准决定登记 | 书架、搜索、详情和部分二级及漫画完整组合的独立批准来源仍未齐全。最近保存的Figma节点读取结果为403、Token expired，冻结原稿继续沿实际覆盖范围使用。[当前读取](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/figma-api-k-20261115.json) |
| 漫画健康正文前提 | 停止态原DB/WAL的同字节可弃副本确认3份旧manifest、18页、3个已驱逐版本，当前head、retention、offline receipt及页请求均为0。旧页记录无法提供当前可读离线章节 | 当前d600的原始VM请求已记录域名解析失败及NETWORK分类，准确回执见本文首节。健康正文场景需要当前有效的实际素材前提。两章缓存目录、popup、返回与原进度证据保持其范围。[存储前提](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/manga-storage-precondition-20261115.json) |
| G10历史Tab归因 | 当前代码与现有历史材料已核对 | 异常同期原始录像、trace或绘制数据仍缺，沿用户已确认的现有资料条件保留 |

**UIF-20补齐保留规则管理页的当前草稿与行数据。** 实际SDK见证确认，普通edit方法更新State后，四个表单的共享输入仍使用初始原始值，同ID行刷新后标题和编辑回调仍捕获旧DTO，三个“启用”开关还共用输入身份。当前四个草稿使用组件opening与各自编辑修订，普通输入读取当前值，程序化预填切换草稿身份，旧输入、开关及保存回调拒绝迟到。五个开关身份分别唯一，行标题、详情、编辑和订阅拉取读取当前DTO，已移除实体禁用并拒绝原动作。准确SDK覆盖15个输入、5个Toggle、3个订阅类型、同ID更新、移除、未决保存与退场，并独立拒绝原始值捕获、旧草稿及旧DTO负例。[规则与分页准确SDK](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-current-inputs-g-final.json) [同ID行回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-current-inputs-g.json)

规则管理的Index和Surface保留了装配分支。全树追踪未发现调用ReaderExitActions.requestRules的生产入口，SettingsScenes也没有绑定规则管理入口。此前仅凭路由存在写为正常入口属于核对遗漏，已纠正。当前保留分支的代码与完整编译已有结果，正常用户导航和该页原生行为仍为NOT_RUN。

**UIF-21补齐保留发现页的分页资格更新。** 实际SDK中，当前页与可用性已更新，两个保留按钮仍沿用初始false/true。当前按钮按静态方向读取当前presentation，原生enabled、primary、页码及实际方向回调同步更新，loading和退场继续拒绝动作。准确负例复现原始布尔捕获。产品L0准入保持原范围。[规则与分页准确SDK](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-current-inputs-g-final.json) [同ID行回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/builder-current-inputs-g.json)

**UIF-22与UIF-23补齐保留WebDAV和RSS表单。** 实际SDK确认WebDAV五个字段在配置加载后仍保留初始值，RSS十四个字段在快照更新后全部保留空值。当前字段通过getter读取当前状态，WebDAV主题图标也读取当前配方。实际回归确认已接纳草稿更新、未决期间草稿策略、密码原生遮罩、已确认保存后的两个可见凭据清空、本地已编辑URL保留及busy禁用输入。RSS十四个字段逐项输入均到达当前快照与同一共享控件。两个历史原始值捕获负例均被拒绝。产品L0下这两个完整表单继续按保留分支处理。[表单准确SDK](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/retained-form-current-inputs-g-final.json)

本批12个准确选择用例通过，涉及两项新SDK入口和四项既有入口。测试提取器、旧Text点击假定、JSON输入依赖和旧36vp断言已按当前真实组件纠正，原失败日志保留。完整ArkTS编译及指定签名候选2d已完成，当前正常书架实屏及四项读屏关闭标志已核对。[共享控件调用回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-g-foundation-consumers-01.log) [JSON与RSS当前入口回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-g-foundation-json-rss-05.log) [当前正常书架](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native/1794704491085/result.json)



后续章节保留前序候选的历史审计、失败、修复与原生身份。当前修复、候选及剩余工作以本节和账本`implementation.completionCorrection20261115`为准。全量目标保持执行中。

## 2026年11月15日前序候选记录

全量实施目标保持执行中。现有授权和紧凑布局保留决定足以继续工作。原稿核对、源码复核、准确回归和VM场景继续由agent完成，当前没有等待用户作出的实施决断。此前完成表述只覆盖对应候选的局部交付，整体验收沿逐项证据推进。

### 已纠正的错误与新增修复

- TTS Make V17的完整原始TSX已存在于仓库。此前列为缺失属于检索遗漏。原Quick四个HTML按钮宽高为28、36、28、28，当前独立响应宽度为39、36、32.5、37.5，高度均44。准确AST及实际分配回归确认包含原按钮且相邻区域分离。44vp全目标冲突继续沿已确认的紧凑布局保留。[原稿准确回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/implementation-continuation-tts-original-02.log)
- 目录此前将旧平面行的26vp附属响应概括到了正常语义目录。正常路径实际经过ReaderDirectoryNavigationSurface及ReaderDirectoryNavigationList，原生附属承载宽44vp。展开目录下载目标的左右边缘点击分别仅触发chapter16和18的一次内存回调，旁边禁用书签没有新增回调。平面分支26vp、Quick行高32vp、Full行高40vp及四工具32vp宽度分别记账。原始44目标在40高裁切行中投影高度40，相邻目标横向重叠14。[原稿、分支和实际命中对照](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/directory-original-target-comparison-20261115.json)
- UIF-08已修复四个bindPopup构造点的原生宿主动效，覆盖InlineSelect、阅读更多的两个锚点和漫画下载菜单。减少动态效果开启时显式支付零时长transition，漫画目录的阅读及换源偏好链已接通，修复提交c6f3d7f1。实际SDK参数、实时更新、拒旧和原popup容量回归通过。
- UIF-09已有真实读屏焦点丢失证据。前几次修复的原生失败均保留。最终生产目标ID绑定inputIdentity及nativeRevision，先等实际键盘焦点回执，再请求当前实例读屏焦点，按实际读屏回执完成键盘续接。默认关闭诊断日志。当前正常通用设置连续两次切换false→true→false，原生实例661→773→775，键盘及绿色读屏焦点均保持，前后像素相同，焦点诊断日志为空。[默认无日志原生结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-toggle-silent-c96f.json)
- UIF-10修复inputIdentity改变时继承旧焦点状态和迟到回调的问题。当前身份、代次、前景、禁用、busy、卸载与迟到回调负例及Source、Settings、Rules、RSS正常消费者准确回归通过。[准确SDK回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/implementation-continuation-toggle-native-id-06.log)
- UIF-11确认13个焦点回调类中仍有9处把关键动作放在onIdle。安装SDK明确该回调仅在帧剩余时间大于1ms时执行。现已移到onFrame，原owner和拒旧条件保持各自约束。13类真实SDK方法通过，父级投递、目录键盘回执与IME续接、搜索生命周期准确回归通过。首次完整编译同时发现测试虚构requestFocus的布尔返回值，现按实际void和BusinessError约定修正，第二次完整编译通过。[13类真实回调回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/implementation-continuation-focus-frame-03.log)

### 已补齐的原生结果

| 场景 | 实际结果 | 证据范围 |
| --- | --- | --- |
| 正常书架分组关闭 | More→编辑分组→Back后，原More Button重新取得焦点 | 正常业务打开点的键盘焦点。[记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-normal-group-focus-20261115.json) |
| 分组恢复最大系统字体 | 档5实际倍率1.4500000477，180vp槽内长文案可达末尾，双动作实际收到回调 | 实际生产Notice和内存动作。[记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-group-max-font-20261115.json) |
| 分组诊断自身换行及焦点 | 三个按钮的完整标签均可见，320vp换到第二行，实际320vp槽可达。当前onFrame候选关闭生产分组恢复层后，实际打开按钮重新获焦 | 最大可选系统字体，当前候选。错误坐标及错误文本断言记录保留，准确后继场景通过。[记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-group-wrap-focus-c96f.json) |
| 实测102vp页头续接 | 260→420vp、IME314vp和Back中页头Area计数始终1，正文避让110vp，间隔8vp | StandardPage实际组件和原生盒。初始66→110vp是否进入可见绘制继续归连续帧检查。[记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-header-continuation-140c.json) |
| 长移除确认基础容量 | 实际Scroll高570.285vp，长文案末尾及双动作可达，移除触发一次内存意图 | 既有确认宿主。真实窗口纯高度变化继续开放。[记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-removal-long-140c.json) |


正常Sample EPUB的TTS Quick播放按钮已补原生边缘命中。点击前即时核对可用按钮，点在36vp绘制外框下方、44vp响应区内后，实际会话接收启动意图。冻结启动源仍显示旧状态，实际胶囊及阅读跟随按自身owner解释。原进度0%、语速1.00x、定时25分钟和系统音色均已恢复或保留原值，最后回到书架。后续准备态、真实onStart和可听结果继续开放。[正常TTS原生记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-tts-paid-edge-c96f.json)

### 当前构建、部署与登记

当前已安装候选为0.2.0.DEV.c96f5e48a87a，生产提交24f7533592cbf6001315663b313baaa0a6a68f91。638个ETS/TS输入全部匹配不可变快照，含272个ETS和366个TS。完整ArkTS编译、指定minliny_HarmonyOS签名、准确停止态DB/WAL副本兼容性证明、保数据安装及启动通过。产品版本0.2.0，安装计数器1000000，包名io.reader.minliny。签名HAP SHA256为183f4fc7196c5c5782edf22d29ab7c14a5797899342b13779aded851b134aca3。[manifest](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/hap/20261114T182149Z-24f75335-74ba2eea/manifest.json) · [部署回执](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/hap/20261114T182149Z-24f75335-74ba2eea/deploy-vm-6460677a198b-20261114T182249Z.json) · [输入绑定](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/current-code-byte-comparison-c96f.json)

正式control登记为revision27。当前引用检查通过且零诊断，页面检查保留37项诊断，含21项E2 FAIL、5项E3 FAIL、8项G03 NOT_RUN及3项SCOPE NOT_RUN。visual21项NOT_RUN和Source content FAIL继续保留。仅执行本次选定回归，构建contracts-scope为none，全量套件NOT_RUN。[引用检查](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/implementation-continuation-refs-11.json) · [页面检查](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/implementation-continuation-register-11.json)

VM最后恢复正常书架。减少动态效果恢复false，屏幕朗读恢复OFF，字体档2、粗细1和界面缩放1均经实际系统树核对。全部本次租约已释放。

### 剩余工作及真实资料缺口

剩余可执行工作继续留在全量目标内，包含其余消费者和纯读屏激活、可写书签及Quick和平面目录的逐目标命中、TTS其余状态、不同下拉宿主的连续动效、实际短反馈可听宣告、移除确认纯高度场景、21项登记的字形裁切和适配矩阵，以及G05连续帧。当前局部PASS沿其精确入口和候选使用。

为连续帧及音频检查，本次由agent增加显式DEBUG warm-Want公共录屏适配。精确参数之外没有录屏IO，输出限自身缓存，麦克风关闭，启动等待上限30秒，实际录制范围1至15秒。准确生命周期回归及工程编译通过。独立shell C API Create返回null，应用身份已进入RequestUserPrivacyAuthority，首次没有STARTED并在30秒后释放。当前没有可用视频或音频，G05及可听验收继续开放。[能力记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-capture-capability-20261115.json)


本次另沿当前包取得两段各8秒的真实ArkUI与RenderService trace。260→420→260vp序列中页头Area维持一次、正文避让110vp。初始装配记录到66→110vp正文Area变化及两个ArkUI命令提交，提交相隔6.791ms。实际显示合成是否呈现前一位置继续开放。[窗口高度trace](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-geometry-trace-c96f.json) · [初始装配trace](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-initial-geometry-trace-c96f.json)

用户已接受沿现有资料推进并保留原证据条件。Figma API本次刷新返回403和Token expired，冻结原稿、完整TTS原TSX和桌面来源继续使用。G10历史异常同期录像、trace与绘制输入仍缺。独立整页批准组合与精确2倍系统字体按原关闭条件保留。上述缺口没有产生新的用户决断要求。[完整当前账本](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/ledger.json)

## 前期子批次记录

以下保留此前日期、候选和局部证据身份。段落中的“当前”沿各自当时的候选解释，本次状态以上节和完整账本completionCorrection20261115为准。

## 确认项继续执行与未决条件更新

已确认的UIF-07菜单外壳层级错误已在9fdf3c67修正，正常Appearance宿主的原生选值、关闭和Back证据保留。先前同节点Toggle候选的原生值更新失败已撤回，当前受控重挂候选沿准确键盘值与焦点证据使用。此前扩大“已批准原稿”的归因和误加“原生页头必须93vp”的门槛均已更正。93vp继续用于显式方法见证，原方案原生场景要求实测高于58vp。

### 本次新增执行结果

- 复用ab7c签装包，进入现有DEBUG下载内存装配。四个状态选项的真实Button完整可见，实际选择“未下载”更新当前筛选值。Back和外部点击关闭下拉后保留筛选面板，恢复“全部状态”后Back返回下载页。[下载原生记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-download-selector-ab7c.json)
- 新增一个DEBUG分组恢复场景，经现有诊断菜单装配实际BookshelfGroupDialog、恢复投影和ReaderRecoveryNotice。长文案展开后能滚动到“分组长文案末尾”，两个末项动作均收到实际点击并分别记录当前opening的内存意图。实际容器180→320→180vp时，唯一Notice Scroll为156→296→156vp，展开状态及opening1保留。Back关闭后诊断打开按钮重新取得键盘焦点，最后恢复正常书架并释放租约。[分组原生记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-group-recovery-3c5e.json)
- 准确新增回归group-native-fixture和page-structure的group-recovery通过。原12组分组容量SDK样本沿未变生产输入复用。新诊断ETS的完整ArkTS编译、指定证书签名、停止态副本兼容性证明、保数据安装和启动通过。未选择的业务及全量套件保留NOT_RUN。

当前安装候选为0.2.0.DEV.3c5e34ef0c10，源码提交ef88c23f，636个ETS/TS输入与不可变快照一致，其中新增1个DEBUG诊断文件。产品版本0.2.0、安装计数器1000000、包名io.reader.minliny，证书为用户指定minliny_HarmonyOS。签名HAP SHA256为8e4c7a7a17fd9b07f901d15332ad63846fa813786ea1fda41da401298a67f531。[不可变manifest](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/hap/20261114T153826Z-ef88c23f-3dce928c/manifest.json) · [部署回执](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/hap/20261114T153826Z-ef88c23f-3dce928c/deploy-vm-6460677a198b-20261114T153941Z.json) · [输入字节核对](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/current-code-byte-comparison-3c5e.json)

分组场景使用内存回执和动作适配，生产组件负责实际布局、滚动与输入。记录的reconcile和continue代表当前动作意图，持久化分组事务沿自身业务证据解释。焦点返回证据绑定诊断打开按钮。新增诊断入口沿现有DEBUG及字体就绪准入，由本次实施自行选择。

### 仍未决的具体内容

| 项目 | 当前已有答案 | 关闭仍需的事实 |
| --- | --- | --- |
| 目录与TTS紧凑布局 | 原尺寸与密度有冻结来源，用户已选择保留。目录原始提取含章节附属44×44 HitTarget，工具32vp与行32/40vp的容量冲突已核算 | 逐目标对照原始响应、当前原生可命中范围及邻项重叠分派。四工具扩大需48vp横向容量，行32/40vp也要回答相邻44vp响应如何分派。保留布局决定继续有效 |
| Figma原稿归属 | 目录备份4765:7940与冻结原始提取可追溯。TTS当前应用同步节点和原Make来源已分清 | 逐目标响应与状态的完整原稿对照，原TTS Make交互响应依据。当前API返回Token expired，桌面缓存显示待重连，服务端最新版本尚未确认 |
| 页头测量续接 | 同盒续接、有限补采、拒旧及卸载有方法回归。现有目录和书源IME观察各保留准确范围 | 一处实际可进入且实测高于58vp的页头，在完整高度、IME和窗口序列中的页头与正文原点。93vp为方法输入 |
| 减少动态效果 | 九处接线及目录两条来源已补齐。Tools、Appearance和Download的原生选值与关闭已有记录 | 各不同宿主、偏好中途变化以及连续绘制中的实际动效、焦点与收束结果 |
| 分组与移除确认 | 分组短槽全文、末项双动作和180/320vp容量有新增VM组件证据。移除确认的纯高度依赖有SDK回归 | 正常书架打开点的焦点返回，以及大字号、IME等剩余组合。移除确认自身在纯高度变化后的真实Scroll容量和末行动作 |
| 自动宣告及Toggle读屏焦点 | 前景宿主和generation的唯一不打断宣告通道已接入。Toggle的false→true→false及键盘焦点有VM证据 | 实际可听宣告、打断情况和读屏焦点连续性。现场已记录读屏开关关闭，可听结果保持开放 |
| 全页视觉、命中、字形和适配 | 当前21项E2 FAIL、5项E3 FAIL、8项G-03 NOT_RUN、3项SCOPE NOT_RUN及21项visual NOT_RUN原判定保留。局部通过结果按准确输入复用 | 逐页逐状态的有效命中、字形裁切、完整适配及独立整页批准依据。VM最高实际字号1.45，2倍仍缺相应原生环境证据，Source content原FAIL保留 |
| 连续绘制G05及历史Tab归因G10 | 当前源码和选定端点观察已保存，连续帧判定开放 | G05需要当前过程的连续真实帧。G10需要历史异常同期录像、trace或绘制输入，用户已决定沿现有资料保留缺口 |

此后各节保留截至ab7c及更早候选的审计、修复与原生证据身份。当前交付状态以上述后继候选及完整账本confirmedContinuation为准。

## 本轮复核与纠错

用户继续追问保留项是否已有答案，以及已完成修改是否做错。本次复核覆盖本轮29个生产变更文件的差异及相关正常装配链。保留项仍有未决答案，当前准确清单保存在账本implementation.review20261114.remainingItems。

### 确认并修正的一处新增回归

UIF-07由facf700e的共享下拉修复引入。ReaderSelectPanel新增定位Column外壳时，将原zIndex10留在内层，外壳采用默认层级。ReaderControlAppearanceContent.selectOverlay的全屏关闭Row为zIndex9，同容器菜单根层级因此低于关闭表面。先前overlay回归检查了定位和容量，缺少实际外观宿主的遮罩组合。

补充准确回归使用正常Appearance.selectOverlay Builder、现有共享Panel和实际原生属性。旧代码在菜单根层级断言上失败，恢复定位外壳zIndex10后通过，原12组popup样本及5组select-host回归通过。修复提交为9fdf3c67。当前候选完整ArkTS编译及指定签名通过，635个生产输入与不可变快照一致。

正常书架继续阅读既有本地Sample EPUB，进入界面Quick并展开Full后，真实菜单根Column的zIndex为10，关闭Row为9。点击繁转简使实际owner选值更新并关闭菜单，随后重新选择原文恢复原偏好。菜单打开时Back先关闭菜单，同一外观触发器继续挂载。最后现场为当前候选正常书架，全部有界会话结束。[准确原生记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-overlay-order-ab7c.json)

当前候选为0.2.0.DEV.ab7c29a4a2d9，签名HAP SHA256为ebe67e8e14d34cbc8663137ad0b39716ccf5978c2e68b6501f59130ada1f62f5。保数据签装、准确副本兼容性证明与正常启动通过。[当前不可变manifest](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/hap/20261114T150635Z-9fdf3c67-77a64461/manifest.json)

早先同节点Toggle候选的实际值更新失败已经撤回，当前受控重挂的准确键盘值与焦点结果保留。此前将紧凑布局保留概括为完整批准原稿对照的表述也已更正。其余本轮生产差异在此次复核中尚未确认新增代码错误，其正确性结论沿实际方法、SDK和原生覆盖范围使用。

### 保留项当前答案

| 项目 | 已有答案 | 仍需回答 |
| --- | --- | --- |
| 目录与TTS紧凑布局 | 原始比例与密度有冻结来源，用户明确选择保留布局。目录原提取含章节附属44 HitTarget | 逐目标有效原生命中、裁切与重叠分派，TTS原Make交互响应重新对照 |
| 测量续接与动效偏好 | 原因、生产接线及准确方法或SDK回归已回答 | 实测高于58vp的页头、完整高度/IME组合，各不同宿主动效与焦点 |
| 短反馈宣告 | 当前前景generation平台通道有准确方法回归 | 实际可听、打断情况及读屏焦点 |
| 分组恢复与移除确认 | 有界容量和纯高度订阅的代码及SDK已回答 | 真实长未决分组的末项动作，以及真实移除确认纯高度场景 |
| Toggle换实例 | 键盘两次激活的实际值与焦点已回答 | 实际读屏焦点及其余原生消费者 |
| 全页视觉及E2/E3 | 已有局部来源、预算和准确场景均保留 | 逐状态完整Figma对照及批准组合，全目标命中、字形、完整适配与精确2倍字号 |
| G05与历史G10 | 已有源码及选定端点记录 | 连续真实帧证据及历史坏帧同期原始输入 |

正式引用检查通过且零诊断，登记检查仍为37项诊断，含21项E2 FAIL、5项E3 FAIL、8项G-03 NOT_RUN和3项SCOPE NOT_RUN。visual21项NOT_RUN与Source完整字形及裁切验收继续开放。以上保留项沿各自关闭条件记账。[原问题与实施账本](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/ledger.json)

## 前次实施回填

2026 年 11 月 14 日，已沿原隔离检出完成本轮代码可执行范围、准确局部回归、完整工程编译、指定证书签名和现有 VM 保数据交付。当前生产候选为 `0.2.0.DEV.40bc7b38fab6`，绑定 HarmonyOS `facf700e27d9246a234f0203d44d2114d7bc0297`。当前状态为 CODE_AND_SCOPED_VM_DELIVERED，整体验收沿原条件开放。

UIF-01 至 UIF-05 的应用侧原因已有对应生产修改及方法或正常 SDK 回归。续查同时补齐详情、漫画目录和保留 Discover 的测量依赖，为目录查询支付透明44vp响应槽，保留已批准的紧凑外框。Toggle 键盘焦点风险经历原生复现、失败方向撤回和后继候选两次 Enter 值与焦点复验，当前受控重挂与有界焦点恢复生效。移除确认已接入窗口 revision 并完成准确 SDK 容量更新回归。[实施方案当前结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/docs/architecture/ui-framework-implementation-plan-20261114.md)

VM 新增 UIF-06。旧候选底部下拉因绝对定位内容没有贡献原生 popup 自然尺寸，末项被裁切。修复将 popup 自然流和页面 overlay 定位分别接入现有宿主，并支付当前窗口、安全区与IME预算。后继40bc候选完整编译和指定签名通过。默认字体下，底部下拉被平台完整安置到触发器上方，末项实际选择更新owner并关闭。1.45倍系统字体下，末项完整可见及实际回调也通过。原失败和修复后证据保留。[原生下拉记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-popup-40bc.json)

当前库存为635个生产ETS/TS文件，14个StandardPage和11个Scaffold构造点的框架消费处置已对账，完整ArkTS工程编译通过。635项生产输入与当前候选快照一致。20个路由和4个manifest根沿原准入条件保留。原633项审计清单保存原始身份。Source重复动作按现有业务owner及生产上下文完成登记，control登记为revision25。[代码复核](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-first-review.json) · [候选字节绑定](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/current-code-byte-comparison-40bc.json)

本轮原生证据覆盖目录查询44vp边缘命中及IME/Back、漫画页头与工具原点、Toggle键盘值与焦点、共享下拉末项与Back，以及1.45倍书源输入和下拉场景。系统最大字体档实际映射1.45倍，结束后已恢复原标准档及Reader实测1倍。最终现场为当前候选正常书架。[字体与现场记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-font-and-environment-40bc.json)

用户已明确选择沿批准原稿保留目录与TTS紧凑布局，并接受按原条件保留证据缺口。其余44vp容量冲突有准确数值记录。正式页面检查保留37项诊断，其中E2为21项FAIL、E3为5项FAIL、G-03为8项NOT_RUN、SCOPE为3项NOT_RUN，visual为21项NOT_RUN。可听宣告、实际读屏焦点、真实长分组恢复、完整页面E2/E3、独立整页批准、GAP-04、G05与历史G10继续沿原条件开放。[完整问题账本](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/ledger.json)

下文保存原始审计输入、结论和历史证据。原审计问题的源码状态以本节和账本implementation字段中的交付结果为准。

## Figma 对照补核

用户于2026年11月14日追问保留项的Figma依据。本轮代码实施主要复用了冻结的原稿提取、既有来源登记和当前生产容量核算，保留项逐项重新打开Figma的对照尚未完成。前述“批准原稿保留”需要同时注明本轮用户选择保留布局的授权，以及每项独立的原稿对照范围。

本次已通过Figma桌面补看33页同步前目录备份节点4765:7940，确认单行查询与四工具、双tab、紧凑章节行和底部当前章节的组合。2026年9月5日冻结提取另提供336×52工具栏、168×32查询绘制、32×32工具绘制、16图形、5间距及36高Full tab、40高Full章节行。该提取还包含8个章节下载或书签的显式44×44 HitTarget。当时核对的平面分支26vp附属原生响应仍需逐项对账，正常语义分支44vp宽度及新原生命中依据见本次继续实施状态，原提取中的40高裁切行和相距30的附属动作中心也会影响有效命中。原生裁切、重叠和分派仍按真实消费者核验。[目录原始提取](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/tools/fixtures/reader-directory-toolbar-hierarchy-20260905.json)

TTS的独立依据是2026年9月11日Make版本17的冻结DOM测量，Quick视口286×190、播放卡264×66，四个传输控件绘制依次28、36、28、28。前述39、36、32.5、37.5为当前代码分配的独立响应宽度。当前Figma的07页节点1977:22789明确标为当前应用同步App7fc3af9a，其内容需沿此来源使用。原Make每个目标的交互响应仍缺本轮重新对照。[TTS冻结测量](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/tools/fixtures/reader-control-tts-make-20260911.json)

本次API读取备份目录节点返回403和Token expired，Figma桌面可以查看已有内容，同时显示待重连同步。服务端最新版本的新鲜度继续开放。完整保留项的逐项设计对照、命中及视觉验收沿各自条件保存。[补核记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/figma-followup-review-20261114.json)

## 原始审计记录

日期为 2026 年 11 月 14 日。

当前框架存在五项新增开放问题。其中三项涉及生产接线或布局约束，一项涉及短反馈的无障碍宣告机制，一项涉及回归测试的判据。页头测量换代后的续接缺口按 P1 处理，其余四项按 P2 处理。历史控制栏问题已能追到明确代码链，当前生产源码包含对应修复。连续绘制、完整触摸与读屏、历史 Tab 坏态归因，以及部分整页批准依据仍有开放范围。

本报告按应用级全量范围编排。完整源码清单、共享框架分层、20 个路由值、4 个 manifest 根、历史整改项和剩余验证工作均有去向。具体结论标明源码、方法、既有交付记录或原生观察的证据层级。源码库存与 AST 装配发现提供防遗漏范围，各页面全部运行状态的逐项原生验收仍待完成。配套修改步骤见[实施方案](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/docs/architecture/ui-framework-implementation-plan-20261114.md)。

## 审计基线

| 项目 | 本次绑定 |
| --- | --- |
| 工作区 | `/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112` |
| HarmonyOS HEAD | `10a5d58d0231f48a4c4fceff22c733b3b3cb1fe2` |
| Core HEAD | `c078126376294faa3a611690fbe48e79f0f86cc4` |
| Reader UI HEAD | `f206f0db011ae82c5a6e4059769fa3688b9cfcd5` |
| Git 状态 | 本轮文档写入前，上述三个检出均无已跟踪差异 |
| 产品档位 | `ReaderProductScope` 固定为 `l0` |
| 产品版本 | 最近可追溯交付记录为 HarmonyOS `0.2.0`，安装计数器 `1000000` |
| 源码库存 | `entry/src/main/ets` 下 268 个 ETS 和 365 个 TS 文件 |
| 公共 UI 库存 | `entry/src/main/ets/ui` 下 90 个文件，其中 layout 目录 16 个 |
| 源码检查范围 | 公共框架职责、正常装配入口、所追踪的页面和平台调用链 |
| 本轮运行证据 | 两项隔离的真实方法或 SDK 装配见证 |

源码指纹与共享构造点保存于[完整清单](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-inventory.json)。清单中 268 个 ETS 的解析诊断为零，这一结果只约束解析阶段。

最近可追溯交付记录指向生产提交 `45f30d329dfd0d85b40d64873e0211d5b672275d`、App `0.2.0.DEV.23dcb7399460` 和签名 HAP SHA256 `bbdd870611df0b1debf9a2a4f5e3543cb7632eafb4b5f51ccb0308cf7a11e136`。该记录含保数据部署、普通 Back 和目录往返的有限后证。本报告沿用其原范围，当前设备现场状态需要对应动作时再核验。[交付记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/control-module-height-20261113/goal-completion-audit/current-delivery-23dc.json)

## 结论与问题索引

| 编号 | 优先级 | 发现 | 当前证据 | 主要影响 |
| --- | --- | --- | --- | --- |
| UIF-01 | P1 | 环境换代退休页头回执，原生盒保持原样时缺少新回执续接 | 源码及真实方法见证 | StandardPage 的正文避让，同型直接宿主 |
| UIF-02 | P2 | 九个公共下拉构造点漏传减少动态效果 | 全树构造点及正常 SDK 装配见证 | 下载六处、书源工具两处、目录规则一处 |
| UIF-05 | P2 | 书架分组恢复提示缺少覆盖层高度边界 | 正常入口及组件容量分支 | 短窗口、大字号、展开长未决文案 |
| UIF-03 | P2 | 自绘短反馈缺少显式自动宣告通道 | 共享宿主及生产调用检索 | 保持原焦点时的短反馈可获知性 |
| UIF-04 | P2 | modifier 次数负例缺少行为失效依据 | 测试源码及官方平台约定 | 公共控件回归结论的可信度 |

UIF 编号延续上一轮账本。排序按处理优先级与生产影响排列。原生是否出现某个具体坏态，按各项列出的剩余问题判断。[机器账本](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/ledger.json)

## 框架各层的责任和审计处置

| 框架层 | 当前主要 owner | 核对内容 | 处置 |
| --- | --- | --- | --- |
| 根装配与产品准入 | Index、ReaderProductScope | 生产与诊断根、L0 路由条件、覆盖层相邻关系 | 20 个路由值和 4 个根均列入下文 |
| 路由与返回 | ReaderNavigation、各 Journey | 原来源、代次、临时 Back、保留阅读和平台窗口先后 | 所追踪链未新增确定的路由错误，完整状态组合仍需对应场景证据 |
| 页面几何 | ReaderPageGeometry、StandardPage、直接页面 owner | 正文唯一几何 owner、头尾和 rail、局部视口 | UIF-01，保留现有几何职责划分 |
| 原生测量 | MeasurementStore、FixedHeaderHost、SurfaceRectMeasurement | 回执身份、单位、换代、相同盒续接 | 拒旧已存在，续接存在 UIF-01 |
| 滚动 | PageScrollHost、ScrollLayout、原生 List 和目录列表 | start/end inset、短内容、锚点、实际滚动 owner | 历史短内容原点修复保留，动态场景按影响复验 |
| 表面与材料 | Dialog、Bounded、Panel、Raised、Tab | 绘制盒、边框、内容盒、裁切、阴影和宿主坐标 | 历史表面修复列入对账，分组覆盖层存在 UIF-05 |
| 公共输入与选择 | Button、FormField、Select、Toggle、SegmentedControl | 受控值、动作资格、真实 carrier、原生实例 | UIF-02，Toggle 焦点连续性列为条件风险 |
| 窗口与安全区 | WindowCoordinator、WindowMetrics | 密度、字号、IME、系统栏、配置发布和串行策略 | 配置变化是 UIF-01 的触发入口之一 |
| 字体与主题 | Fonts、FontLoadHost、Typography、ThemeRegistry | 文件就绪、样式角色、真实量字、主题输入 | 当前 checked font 路径继续使用，完整字形矩阵按原记录开放 |
| 动效 | MotionPolicy、MotionSpec、Clock、SelectPanel | 全局偏好传播、时钟、迟到完成回调 | UIF-02，实际连续绘制仍有开放范围 |
| 消息 | Transient、Recovery、PageState、NativeAlert | 分类、前景宿主、原操作身份、容量、宣告 | UIF-03、UIF-05 |
| 验证与登记 | SDK probe、页面 register、装配检查 | 正常入口、真实 producer、负例、结果范围 | UIF-04 及既有证据缺口 |

16 个 layout 文件的现有职责划分有对应消费者。当前所追踪的调用链支持保留 TS 几何与 ETS 原生边界、共享 Scaffold 与 StandardPage、独立测量存储和滚动投影。修复应落在具体错误依赖与接线上。[几何宿主合同](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/docs/architecture/page-geometry-host-contracts-20261111.md)

### 公共源码分组与审读证据

| 分组 | 文件数 | 本次重点 | 结论或后续 |
| --- | --- | --- | --- |
| chrome | 3 | App、返回及阅读顶栏与原生页头组合 | 对照页头测量与父子盒，纳入 UIF-01 影响分析 |
| controls | 18 | 公共输入、选择、Button、Toggle 与 FormRow | UIF-02、UIF-04，Toggle 焦点风险 |
| feedback | 7 | 短反馈、恢复、PageState 及多事项组合 | UIF-03、UIF-05，沿原业务身份与类别接入 |
| foundation | 28 | 窗口、字体、主题、配方、动效与单位 | UIF-01、UIF-02，原生字形与全动作时序仍开放 |
| layout | 16 | 几何、测量、滚动投影、宿主和原生 frame | UIF-01，16 个职责与输入哈希见覆盖快照 |
| patterns | 2 | Tab 和无封面组合 | Tab 应用层修复已有，历史坏态因果仍开放 |
| platform | 5 | 原生确认、窗口、Web 和字体宿主 | 平台生命周期沿已追踪入口使用，完整系统交互待对应证据 |
| surfaces | 11 | bounded、dialog、raised、panel 与材料 | 保留表面职责，分组临时恢复容量单列 |

这些文件数来自全部路径与哈希清单。语义结论对应账本内明确列出的方法、装配和调用链。每个文件的库存归属与 16 个 layout 的责任存入覆盖快照，完整逐页状态空间、性能指标与原生资源释放的量化结论仍待各自证据。

### 排除的候选问题

- ReaderFormField 的两次 attributeModifier 支持合法顺序组合，生产缺陷判断已排除。UIF-04 保留的是当前负例缺少行为失败依据。
- SurfaceRectMeasurement 的位置单位已对照本机 SDK。FrameNode 位置为 vp，当前尺寸转换路径的已审部分没有建立重复缩放原因。
- 通用 pageVisible 的透明度属性不足以确定隐藏阅读泄漏输入。实际 Index、ReaderShell 和阅读装配具有前景、输入与 accessibility 围栏，已追踪调用链未建立该项可达缺陷。

候选原因和排除依据保存在[原问题账本](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/ledger.json)。

## 页头测量换代后的续接缺口

### 原因与触发条件

UIF-01 的触发前提是已采纳页头高于回退值 58vp，随后某次环境或局部视口变化递增 `measurementKey`，而页头自身的原生尺寸和位置保持原样。较大字号、复合页头以及只改变窗口高度或键盘事实的场景需要重点检查。

`ReaderStandardPage.onLayoutInputsChanged` 递增 key。`headerHeight` 随即通过 `readForGeneration` 读取新代事实，旧回执失去资格，结果回退为 58。`ReaderFixedHeaderHost` 仅在 `onAreaChange` 中发布高度，key 变化自身没有主动读取当前盒或续接相同盒回执。本机 SDK 将该事件定义为布局引起的尺寸或位置变化，重新绑定回调没有提供一次必达的新尺寸回执。[失效与读取](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/ui/layout/ReaderStandardPage.ets:55) [原生回执入口](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/ui/layout/ReaderFixedHeaderHost.ets:15) [SDK 事件语义](/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/component/common.d.ts:20037)

### 已得到的见证

已有测量输入为页头 93vp、页脚 84vp，正文 startInset 为 101vp。保持宽度、字号和页头原生盒，改变窗口高度与键盘事实后，真实方法将页头读数改为 58vp，正文 startInset 改为 66vp。93 是显式有限回执输入，见证没有执行原生布局调度。页脚可能因位置变化获得新 Area，持续缺口结论约束保持原盒的页头。[方法结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/standard-page-witness-02.json)

### 影响与关闭条件

StandardPage 有 14 个构造点。设置、书架设置和管理、书源工具共享该机制，保留的 RSS 和 Sync 标准页也消费它。SourceManagementPage 另有同型失效和 Area-only 发布结构。其他直接 owner 使用不同的 fallback 与身份策略，应逐个核对，不能仅凭使用同一个 store 就判为相同坏态。[书源同型路径](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/source/ui/SourceManagementPage.ets:1320)

关闭要求是在原生盒保持原样时得到当前事实或合法复用既有事实，同时继续拒绝真实宽度、字号、实体或挂载已经失配的旧回执。旧测试手动注入每一代的新回执，其通过结果保留拒旧和收敛范围。[现有测试](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/tools/test-ui-window-layout-closure.mjs:44)

## 减少动态效果的调用方遗漏

### 原因与影响面

UIF-02 来自全局偏好和公共组件之间的接线遗漏。SettingsPresentation 已发布偏好，ReaderInlineSelect 的 `reduceMotion` 默认 false，并将该值传给触发器和面板。全树 AST 发现 9 个生产构造点，均未提供此 Prop。

| 文件和分支 | 构造点 |
| --- | --- |
| SharedDownloadPage | 784、1308、1326、1422、1436、1533 行，共六处 |
| SourceToolsPage 的 debugCard | 792、802 行，共两处 |
| ReaderDirectoryRules 的规则边界选择 | 293 行，一处 |

下载页已有 reduceMotion 输入。SourceJourneySurface 已有该输入，其 toolsPage 没有向 SourceToolsPage 传递。目录规则链需要沿实际目录 Destination 和 FullDirectory 补齐偏好输入。SourceJourneySurface 的业务导航类与 UI 装配组件承担不同责任，Prop 修改应落在实际构造链。[全局发布](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/settings/presentation/SettingsPresentation.ets:60) [公共默认值](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/ui/controls/ReaderInlineSelect.ets:23) [书源实际装配](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/source/ui/SourceJourneySurface.ets:105)

### 证据与关闭条件

正常 InlineSelect build、触发器和 popup builder 已进入实际 SelectPanel。默认接线下 inline 和 panel 的 reduceMotion 均为 false，expandPanel 发出 160ms 动画参数。平台弹出窗口和动画像素保持独立证据范围。[SDK 结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/inline-select-witness-02.json)

已有 `inlineSelectSdk.choose` 在选择前主动把 reduceMotion 设为 true，不能用其选择结果代替真实调用方的偏好传播。关闭需要覆盖全局 true 和 false、菜单打开中途切换、关闭完成回调、旧 identity 和卸载。[辅助方法](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/tools/lib/reader-inline-select-sdk-probe.mjs:41)

## 分组恢复提示的覆盖层容量

UIF-05 的正常路径为 Index 的 BookshelfGroupDialog、surface、recovery 和 ReaderRecoveryNotice。分组 owner 的 recovery 可以把 blocked mutation 的消息接入原操作提示。

surface 中的顶部 Column 没有剩余高度约束或 Scroll。recovery 未传 maxHeightVp，共享 Notice 使用默认 -1，走自然高度分支。展开后文字上限为 10000 行。长未决文案、短窗口或大字号时，当前装配缺少完整阅读和恢复动作可达的布局保障。具体原生裁切位置仍待对应场景观察。[覆盖层](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/bookshelf/ui/BookshelfGroupDialog.ets:39) [Notice 构造](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/bookshelf/ui/BookshelfGroupDialog.ets:95) [容量分支](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/ui/feedback/ReaderRecoveryNotice.ets:52)

共享 Notice 的自然高度适用于已有内容流消费者。该项应由分组覆盖层支付当前可用高度，沿用共享组件已有的有界滚动能力。关闭条件包括展开长文案、零剩余空间、双动作 busy、原 generation 回调、外点与 Back、焦点返回及分组事务身份。

## 短反馈的无障碍宣告

UIF-03 已确认应用侧缺少显式宣告通道。ReaderTransientFeedback 发布内容、tone、可见性和 generation。ReaderTransientToast 用普通 Text 呈现并定时收起，当前宿主没有自动宣告声明。完整生产检索未找到 accessibilityLiveRegion、sendAccessibilityEvent 或 announceForAccessibility 调用。[共享反馈](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/ui/feedback/ReaderTransientFeedback.ts:98) [真实宿主](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/ui/feedback/ReaderTransientToast.ets:66)

系统是否通过其他事件读出特定 Text，仍待原生读屏观察。当前源码无法保证用户保持原焦点时及时获知短反馈。关闭需要在实际有效前景宿主按当前 generation 宣告一次，处理替代、重复、后台和卸载，并保留原焦点。SDK 已提供 sendAccessibilityEvent、announceForAccessibility，以及 API18 起的不打断宣告事件，可以复用平台能力。[本机 SDK](/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/api/@ohos.accessibility.d.ts:96)

## modifier 负例的证明力

UIF-04 位于 `assertSingleNativeModifier` 和对应负例。测试要求调用次数等于一，加入第二个 modifier 就被拒绝。该断言可以检查特定局部封装约定，其结果不能独立证明属性、几何或业务行为已经失效。[测试断言](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/tools/test-framework-confluence-controls.mjs:25)

华为文档支持同一组件顺序应用多个 modifier，并按后写覆盖同名属性。公共输入框当前的双 modifier 可以合法组合，已从候选生产缺陷中排除。需要补充的证据是最终属性、更新后的语义、禁用与按压状态、真实回调，以及会实际破坏这些结果的负例。[官方约定](https://developer.huawei.com/consumer/en/doc/harmonyos-guides/arkts-user-defined-extension-attributemodifier/)

## 条件风险与证据缺口

| 项目 | 已知事实 | 待回答的问题 | 当前处置 |
| --- | --- | --- | --- |
| Toggle 焦点连续性 | 每次有效 native change 都递增 nativeRevision 并更换原生 Toggle，用于恢复受控值 | 键盘及读屏焦点在该原生实例替换后是否连续 | 保留风险，先审现有证据，再选最小原生场景 |
| 移除确认的高度更新 | BookRemovalDialog 的 messageMaxHeight 读取窗口事实，父级缺少窗口 revision 依赖 | 纯高度变化时是否由原生父约束或文字 Area 保证容量更新 | 保留风险，源码没有证明必然裁切 |
| 全动作连续绘制 | 已有 settled 帧、有限过渡和 SDK 方法证据 | 全模块点击是否存在原生中间坏帧及准确时序 | G05 开放，需可用的连续取帧入口或现成视频 |
| 历史 Tab 扇形 | 应用层零宽绘制与 Area/clip 缺口已修，后继正常像素和 RS 已记录 | 历史坏态的 Area、半径、inner path、DrawCmd 与帧时序 | G10 开放，缺同 App/PID/window/frame 的坏态事实 |
| 完整命中与适配 | 正式登记的 E2/E3 仍有失败或未运行 | 各实际目标父预算、相邻命中和真实大字号是否成立 | 按准确页面和变体关闭 |
| 整页视觉批准 | 部分独立原稿及后继批准可用，Figma 部分页面带源码衍生标记 | 书架、搜索、详情及部分二级/漫画状态的完整批准组合 | 来源登记保持 OPEN_APPROVAL |

Toggle 和移除确认的原生后果尚未建立，实施方案安排有界定位步骤。G05 和 G10 分别需要当前连续绘制证据与历史坏态同期数据，普通后继正常帧只能证明其采样时刻。[风险源码](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/ui/controls/ReaderToggle.ets:43) [移除高度](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/bookshelf/ui/BookRemovalDialog.ets:68) [既有开放项](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/docs/architecture/ui-design-full-fix-20261113.md:455)

## 历史控制栏根因的当前对账

| 原因族 | 历史证据 | 当前源码处置 | 剩余关闭范围 |
| --- | --- | --- | --- |
| 活动内容决定公共外壳 | chooser 直接消费当前 minimum/chrome | sharedShell 用于公共选择，模块 minimum 继续用于内容适配 | 全状态连续画面及真实环境变更 |
| 页面语义先于完整 profile | 新模块先挂载，后登记并采纳测量 | 准备目标 facts/profile 后共同提交 session 与 receipt | 原生调度和连续绘制 |
| 测量请求代次使有效输入失效 | provider bind 立即递增 generation | 已提交 receipt 与待测请求分离 | 全部真实控制动作和临时层时序 |
| Home 的 Scroll/direct 双树 | 阈值两分支分别装配 homeContent | 单一 Scroll owner，切换滚动资格 | 真实滚动、焦点和动态字体 |
| 触控下限进入 paint/slot/坐标 | 31536cfb 等历史改动 | 默认配方与响应分配已分开 | 紧凑横向目标仍有 E2 冲突 |
| 705 变为通用优选比例 | 安全区特例写入比例常量 | 原参考 736 与真实物理约束分开 | 不同窗口、安全区端点 |
| 父子内容盒与边框欠账 | d8 检查点及前后 Git blob | 内容盒扣边框，真实组合支付完整高度 | 对应窄宽、大字号和像素边界 |
| 重复描边与 Full actor 错绑 | 公共/私有表面同时绘制，Full stroke 读 moving content | 表面 owner 分配，Full fill/stroke 使用同源 actor | 连续多进度原生绘制 |
| 异步导航后的读取时机 | Replace 入口请求切页后立即读取 | 完整提交后沿原 owner 启动读取 | 非空、失败及写入恢复的准确分支 |
| 失活 intent 消费 Back | 仅因对象存在返回 consumed | 清理旧对象，消费资格由 active intent 决定 | pending hide/open 竞态的原生问题仍按方法证据边界 |

`31536cfb` 是触控下限传播链的重要合流点。目录最终宽高及部分预算来自多个提交的累计变化，具体数值需要绑定相应 Git blob、宽度、字号和文案。每次原生闪烁与上述更新的逐帧对应继续沿 G05 保留，现有代码链已建立机制和可达中间状态。

这些改动及选定原生观察见[当前修复记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/docs/architecture/ui-design-full-fix-20261113.md:202)。历史 d8ad88ef 是已有 WIP 的检查点，Git 证明父提交到检查点的差异，具体编写会话继续保留边界。历史尺寸表中的 236 和 238 表示自然内容高度需求，参考条件为特定宽度、1× 字号与基线文字包络。

## 既有全应用设计问题的当前对账

下表对账 2026 年 11 月 13 日的 15 个整改条目。当前源码变化与既有记录支持的有限结果分别沿原来源使用。整页 visual 的关闭状态见后文。

| 旧编号 | 原问题 | 当前处置 |
| --- | --- | --- |
| S-01 | 恢复提示间隔、下划线、误判展开 | 当前 Flex 含 18/6 间隔，标题自身量字决定展开，动作使用 notice 配方 |
| RD-03 | TXT 规则恢复提示推移表单 | ReaderFullDirectory 使用独立有界 Scroll 覆盖槽，表单有独立滚动体 |
| RD-04 | TTS 恢复提示进入表单流 | windowModal 下使用独立恢复覆盖层并支付剩余高度 |
| RD-05 | 阅读恢复卡自动持续遮挡 | 当前显式请求后展示，控制栏和其他前景占用时暂退，正文布局独立 |
| P-01 | 下载行被三个 44 高纯信息区撑大 | 当前普通行按 bookTop/source/status 等角色分配，自然文字高度参与增长 |
| RD-01 | 默认目录工具栏强制 stacked | 默认 paint 与输入配方已恢复，窄宽和响应可行性单独判断 |
| RD-02 | Full 标题与目录 Tab 常态增高 | 共享标题绘制 30 与响应角色分开，各模块预算保留 |
| RD-07 | 书签空态和失败态配方丢失 | 当前使用 readingBookmark 变体 |
| RD-08 | 秒数按钮名称与五秒行为冲突 | 当前名称为增加或减少五秒，分钟分支为五分钟 |
| S-02 | App 主题标签横向预算不足 | ReaderFormRow 依据真实宽度和量字决定上下排，使用 168 的单一控件宽度源 |
| S-03 | 书源统计固定单行 | 当前 statsRow 支持 BREAK_WORD，自然增长 |
| S-04 | 四个纯统计各占整行 | 当前 batch summary 使用可换行 Flex |
| S-05 | 多事项各画完整卡 | 当前 RecoveryGroup 持有共同表面，条目保留独立身份和分隔 |
| P-02 | 书架更新徽标缺宽度预算 | 当前按封面宽扣减后限制文本与外框宽，保留可访问完整计数策略 |
| P-03 | 导入进行态固定 228 | 当前自然内容测量、有界 Scroll、可用高度夹取及旧代回调围栏 |

以上处置的来源为[原审计](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/docs/architecture/ui-design-comparison-audit-20261113.md)与[修复及后继审修记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/docs/architecture/ui-design-full-fix-20261113.md)。本次抽查的当前正常入口包括 ReaderFullDirectory.directoryRulesLayer、TtsConfigOverlay.build、LocalReadingExperience.readerRecoveryContent、Source stats/summary、LocalImportDialog.importingPanel 和 Settings 的主题行。

保留条目 S-06 涉及 RSS/Sync 恢复动作装配，其产品准入继续由 L0 与实际恢复入口控制。原 UI 差异记录、独立批准来源、源码衍生画板和后继实施决定保持各自来源，任何新的尺寸归一都需对应到明确业务或设计依据。

## 全部路由值和页面根的处置

ReaderRoute 声明 20 个值。以下表格说明现有装配与本报告关联，路由声明自身不产生一个日常入口。

| 路由值 | 当前宿主或状态 | 关联审计范围 |
| --- | --- | --- |
| bookshelf | BookshelfScene/Shell，populated、empty、status 分支 | 单一正文几何、筛选、继续阅读、导入、分组、移除，UIF-05 |
| search | ReaderLibrarySearchSurface + SearchPage | 外部页头、查询/结果 owner、列表恢复、来源页往返、临时面板 |
| detail | LocalBookDetail 及原阅读返回上下文 | 顶部 Hero、Scroll、目录入口、在架状态、恢复消息 |
| reading | ReaderShell + text 或 manga actor | 控制栏体系、正文、保留实例、媒体及输入生命周期 |
| directory | ReaderDirectoryDestination，text/manga，detail/reader 两来源 | 头尾预算、目录状态、规则编辑、返回、UIF-01 同型审查与 UIF-02 |
| downloads | SharedDownloadPage，普通/管理/章节及弹层 | 响应角色、停留状态、原操作、六个下拉遗漏 |
| source | SourceJourneySurface + SourceManagementPage | 查询/筛选、统计、行、平台登录、恢复，UIF-01 同型路径 |
| sourceTools | 同一 Source journey 下的 Tools owner | 批量、检测、编辑、导出、日志，UIF-01 与 UIF-02 |
| settings | SettingsScenes/Shell/Page | Home/General/About/Developer/消息预览，UIF-01，偏好发布 |
| bookshelfSettings | BookshelfSettingsPage + StandardPage | 受控开关、分段、读取和未决状态，UIF-01 |
| bookshelfMultiSelect | BookshelfMultiSelectPage | 原生 List、选择页头与移除 footer、实体与代次 |
| bookshelfManagement | Index 保留管理分支 | 保留入口与归属 owner，日常可达性由真实调用方判断 |
| rulesManagement | Index 保留全局规则分支 | 规则表单与回执，普通入口按产品准入判断 |
| discover | product gate 关闭的保留实现 | MainTabShell 下正文与头尾，开放时需补验证 |
| rss | product gate 关闭的保留实现 | MainTabShell 下 RSS 主列表 |
| rssSubscriptionManagement | product gate 关闭的保留实现 | 标准页、选择及恢复 |
| rssSubscriptionEditor | product gate 关闭的保留实现 | 表单草稿、保存及输入 |
| rssSourceFeed | product gate 关闭的保留实现 | 标准页、列表与状态 |
| rssEntryDetail | product gate 关闭的保留实现 | 标准页、正文与 footer |
| sync | 新入口 product gate 关闭，历史恢复语义单列 | placeholder/StandardPage，历史恢复按实际入口审查 |

manifest 的四个根为 Index、ReaderStartupRecovery、ReaderRendererPilot 和 ReaderPageStructureVerification。前两者承担生产主根与启动兜底，后两者承担诊断或 DEBUG 验证。诊断 Builder 的直接调用证据须同时给出实际 build 装配链。[根清单](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/resources/base/profile/main_pages.json) [产品准入](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/app/ReaderProductScope.ts)

## 正式登记和证据状态

当前 register 为 Source、Directory、Downloads、Tools 四族，含变体共 21 项。21 项 visual 均为 NOT_RUN，21 项 interaction 均为 FAIL。adaptation 有 5 项 FAIL，其余 16 项 NOT_RUN。这里是机器登记当前保存的结果，不等于本轮重新运行了对应检查。[正式登记](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/tools/page-structure/register.json)

16 层登记的完整结果展开如下。PASS 保持登记内原有的有限依据，部分 FAIL 表示完整证据尚未闭合。

| 层 | PASS | FAIL | NOT_RUN |
| --- | --- | --- | --- |
| route | 0 | 0 | 21 |
| scaffold | 7 | 0 | 14 |
| informationArchitecture | 0 | 0 | 21 |
| header | 0 | 0 | 21 |
| scroll | 0 | 0 | 21 |
| content | 0 | 1 | 20 |
| query | 4 | 0 | 17 |
| footer | 0 | 0 | 21 |
| overlay | 0 | 0 | 21 |
| states | 1 | 0 | 20 |
| visual | 0 | 0 | 21 |
| interaction | 0 | 21 | 0 |
| adaptation | 0 | 5 | 16 |
| accessibility | 0 | 0 | 21 |
| measurement | 7 | 0 | 14 |
| dataLifecycle | 0 | 0 | 21 |

Source 的 content FAIL 保留了整页原生字形、裁切与内容验收缺口。其现有局部 SDK 已覆盖安全宿主和增长父级，完整原生结论仍开放。interaction 的登记包含完整命中、焦点与读屏覆盖不足，adaptation 的登记包含准确系统倍率及完整页面适配不足。具体 knownGap、证据及 followUp 保存于原 register 和本次快照。

既有总诊断记录仍保留 39 项，其中 E2 21 项、E3 5 项，另有 13 项 NOT_RUN。目录及 TTS 的部分紧凑横向响应小于 44，属于已知约束冲突。关闭时需同时核对原稿密度、父级预算、相邻命中和实际响应，不得只用外部 Common 的大小替代原生目标。[当前约束记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/docs/architecture/ui-design-full-fix-20261113.md:242)

## 实施后需要覆盖的状态

| 维度 | 必要场景 | 与问题的联系 |
| --- | --- | --- |
| 测量身份 | 同盒换代、真正宽度变化、字号/字体就绪、实体替换、卸载重挂 | UIF-01 与迟到回执 |
| 窗口 | 正常竖屏、320 宽、横屏短窗、现有 VM 分数密度、纯高度变化 | 几何、物理像素与可用容量 |
| 字号 | 1、1.3、1.6、2 的代码场景，设备实际支持倍率另记 | 当前消费者预算及字体策略 |
| 输入 | 原生点击、键盘激活、焦点、IME、Back、外点 | 资格、控制权、短窗可达性 |
| 状态 | loading、empty、error、partial、pending、blocked、busy、disabled | 消息类别和实际条件模板 |
| 切换 | 请求中换页、同实体重开、换书、隐藏保留、前后台 | 请求身份、有效呈现和迟到回调 |
| 消息 | 短/长、单/双动作、多事项、展开、替代、宣告 | UIF-03、UIF-05 |
| 动效 | 偏好 true/false、过程中改变、完成前退休 | UIF-02 与帧时序 |

具体修复只选择实际影响的场景。这个矩阵用于定义全应用审计范围与剩余证据，某一项失败也应先定位该项。

## 审计产物和后续关闭

- [完整问题账本](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/ledger.json)记录触发、原因链、源码行与 SHA、置信范围及两个保留风险。
- [源码清单](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-inventory.json)记录 633 个源码输入及所选共享构造点。
- [页头续接见证](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/standard-page-witness-02.json)和[下拉偏好见证](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/inline-select-witness-02.json)提供两项当前运行证据。
- [覆盖与状态快照](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/full-report-scope.json)记录路由、框架文件与当前 register 的展开结果。

首轮见证因夹具缺少 measureTextSize 而失败，补齐所需有限端口后完成两项见证，首次失败保留于账本。生产修复尚待按实施方案执行。本报告新增审计与方案文档，实施完成后应在原问题上追加实际修改、运行和交付证据。
