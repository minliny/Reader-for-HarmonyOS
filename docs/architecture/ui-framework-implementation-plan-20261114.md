# Reader HarmonyOS UI 框架实施方案

## 2026-11-16 代码收口与连续三轮全局审计

用户要求先完成全部代码侧未闭环项，再由 review agent 做全局审计，连续三轮通过后可以解除 VM 禁令。当前连续通过为 0，VM 禁令有效，本阶段 VM、HDC 和设备操作为 0。

第一轮绑定 aa015470，结论为 INCOMPLETE，确认五项 P2。UIF-51 至 UIF-55 已在 1b6b846a 修复，13 个准确用例及 6 个旧行为负例取得结果。第二轮复核这五项修复通过，并完成 472 个必审 UI 文件的合同审阅，包含 93 个共享 UI、289 个功能 UI/presentation 和 90 个 App/root 文件，剩余必审文件为 0。第二轮确认另外 12 项 P2，结论为 FAIL。[完整第二轮报告](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round-02.json)

UIF-56 至 UIF-67 已完成当前代码修复，涵盖书架筛选导航准入、两个显示方式消费者和主题选择的异步写入准入、发现与 RSS 当前数据、同步历史重键、Full TTS picker 容量、TTS 选项文案、规则预览、普通文字目录节点、分页正文 recipe 和波形基高。未派发显示方式请求退休后恢复已确认投影，原 Host 继续保存已经派发的真实回执。Discover、RSS 和 Sync 保留原有 L0 准入条件。[第二轮修复与验证](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round02-repair-summary.json)

新增 12 个准确局部用例和 9 个旧行为负例已有通过结果。22 个修改脚本完成语法核验。第二轮本地候选为 0.2.0.DEV.d1b2e9ce101d，完整 ArkTS 编译和原指定证书签名通过，642 个生产 ETS/TS 输入与产物清单逐字节一致。首次编译发现本次空筛选状态的 ForEach 需要单一 Column 子宿主，修正后第二次编译通过。13 项受影响登记的指纹已同步，引用检查 0 诊断，登记继续保留 37 项原有诊断。[生产字节绑定](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round02-repair-production-build-binding.json)

第三轮绑定 8d6d8bdc，完成 472 个必审文件，结论为 FAIL，确认 4 项 P2。UIF-68 至 UIF-71 已修复，涵盖设置分区标题自然增长、多选书籍同身份当前字段、Root 至阅读页的实时输入准入和未接受指针退休，以及平面目录和书签旧动作的原模块准入。原有已接受翻页结算、业务回执及几何事实继续按各自归属处理。4 个新准确用例和 2 个投影旧行为负例通过，13 个修改脚本语法通过。[第三轮修复与验证](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round03-repair-summary.json)

第三轮本地候选为 0.2.0.DEV.d9f70a1af08b，完整 ArkTS 编译及指定证书签名通过，642 个生产 ETS/TS 输入与产物清单逐字节一致。局部夹具的两次遗漏已保留失败记录并修正。连续通过仍为 0，下一轮将由新的 review agent 做完整全局审计。[第三轮完整审计](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round-03.json)

第四轮绑定 8c4bd963，完成 472 个必审文件，结论为 FAIL，确认 4 项 P2。UIF-72 至 UIF-75 已成批修复。漫画设置、页码、亮度和边界手势接入同一 Root 实时输入准入，未接受手势保留原修订。连续阅读 Stage 接入父输入修订及实时函数，旧指针在恢复前景后继续退休。语义目录校验原 Content、Surface、List 和当前章节事实。搜索的历史、提交、停止、重试、结果与筛选入口在首次动作前消费当前可见性，发布与已接纳队列保留原生命周期。[第四轮全局报告](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round-04.json)

4 个新准确用例及平面目录共用判据复查通过，9 个修改脚本语法通过。第四轮本地候选为 0.2.0.DEV.436dbd994df8，完整 ArkTS 编译及指定证书签名通过，642 个生产 ETS/TS 字节绑定无漂移。首次构建期间继续修改测试适配器导致受控输入封存失败，固定全部输入后第二次构建通过，失败记录保留。13 项受影响登记已同步，引用 0 诊断，原有登记诊断仍为 37。连续通过仍为 0，VM、HDC 和设备操作继续为 0。[第四轮修复与验证](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round04-repair-summary.json)

第五轮绑定 f22699d4，完成 472 个必审文件，结论为 FAIL，确认 3 组 P2。UIF-76 至 UIF-78 已按 68 项同族入口表修复。书架首读、长按／More 首开、book-action 和顶部 More token 在本地写状态或排队前消费原 live input。书源类别、状态、分组、清空在首次修改前复用已有管理输入资格。Manga semantic／flat、BookDirectoryPage semantic、FullDirectoryPanel 及上层 opening 均递送原宿主当前资格，Surface 直属 fold／retry／clear 与 Full 本地工具也消费它。[第五轮全局报告](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round-05.json)

3 个新增准确用例及原 Reader／semantic 共享适配复查通过，11 个修改脚本语法通过。第五轮本地候选为 0.2.0.DEV.012ee74c63d5，一次完整 ArkTS 编译及指定证书签名通过，642 个生产 ETS/TS 字节绑定无漂移。21 项登记指纹已同步，引用 0 诊断，原登记诊断继续为 37。原已接纳 pending action、native 消失／分组收起清理与业务回执保留原 owner。连续通过仍为 0，下一轮从当前冻结代码开始。[第五轮修复与验证](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round05-repair-summary.json)

第六、七轮完整全局审计曾连续 PASS。第八轮最终封存前补查恢复路径，确认 UIF-79 与 UIF-80 两组 P2，连续计数从 2 归零。先前父层 live guard 没有覆盖叶节点一次性 dispatchedId 及选择面板 closeInFlight 的首次修改，失效后恢复场景遗漏已纠正。[第八轮最终报告](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round-08.json)

两组已修复。书籍操作与顶部 More 把原实时资格递送到叶节点 isCurrent，失效 token 保留未消费状态，同一 opening 的新动作在恢复后可被接纳。SourceGroup 把原 managementInputIsCurrent 递送到 SelectPanel，在 selectAndCollapse 首次修改前检查，已接纳的动画 finish／onDismiss 仍由原 owner 完成。两个新增恢复用例首次运行通过，当前本地候选为 0.2.0.DEV.7045c48f046a，一次规范全 ArkTS 编译及指定证书签名通过，642 个生产字节绑定零漂移。2 项受影响登记已同步，原 37 诊断保留。下一批重新从 0 开始三轮独立全局审计，VM 操作为 0。[修复及恢复回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-global-review/round08-repair-summary.json)

连续三轮通过条件仍待完成。21 项登记的完整原生验收、独立整页视觉、可听读屏、G05 和历史 G10 保留原标准。VM 最后保存的字号为 1.3 倍，原字号恢复仍待执行。

## 2026-11-15 执行量与效率复核，VM 验证已禁止

用户已要求停止 VM 验证，先核算原计划、实际完成量和效率。当前阶段使用本地 Git、原计划、构建台账、部署回执及已保存的原生会话。统计截止于北京时间11月15日23时21分19秒，源码为e8b80d12。下方各轮进度保留其当时输入，当前限制和核算以本节及原账本executionAssessment20261115为准。

原计划为6个批次，包含5项初始问题、2个条件风险和4个页面族含变体共21项的16层验收。初始5项的应用侧修复和准确局部回归均已有交付。批次0至3已有应用侧成果，批次4和5继续开放。正式336层保存结果仍为19 PASS、27 FAIL和290 NOT_RUN，较10a5d58d基线新增PASS为0，完整关闭页面为0/21。

实施跨时段为35小时14分9秒，包含中断与等待。记录中有65次HAP构建尝试，其中52次成功、13次失败。52个不可变候选均有成功保数据安装记录。464个VM会话包含5077项动作，382个正常结束、82个失败，其中15个会话没有动作。会话正常结束不计为页面验收通过。构建台账累计34分59秒，VM会话累计3小时33分36秒，部署从首个记录阶段至结束累计26分17秒。三个区间合并去重为4小时34分34秒，其余跨时段包含源码与测试修改、分析、文档、编排、中断及等待，当前日志不足以逐秒分摊。

确认的低效因素包含过早代码完成判定、零散补夹具与候选、至少21个驱动或判据错误会话、13个Toggle修改提交、39个纯文档或登记提交，以及未及时同步的当前状态别名。13次构建失败分为6次ArkTS编译、4次漏传已有Native缓存路径、2次worker优先级准入和1次构建输入漂移。详细逐条统计、原始路径和口径保存在[执行核算记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/execution-assessment-20261115.json)。

最后保存的VM会话已释放，页面停在诊断菜单，临时系统字号仍为第4档、实际1.3倍，原字号第2档恢复待执行。保存的VirtualPixelRatio和DensityInCurResolution均为3.5。当前候选为0.2.0.DEV.9014de0e4eca，641个ETS/TS运行时输入与不可变快照逐字节一致。AE漫画自然行命中修复及已有原生动作已追加到原账本，13项Directory登记已同步生产组件和测试入口指纹，8个漫画变体补入准确组件证据。选定引用检查0诊断，登记保留27项既有E2/E3及测量、范围诊断，来源漂移为0。

漫画自然行的UIF-50已经由e8b80d12修复。原响应区固定44vp，实际长标题行高488px时，标题中心点击超出原154px响应高度45px。当前响应区消费整行自然宽高，既有身份、禁用、选择及分组准入继续由原owner持有。准确SDK12样本及旧44vp负例已有结果，保存的font1.3组件原生记录包含标题中部、另一行下缘和独立章节下载动作。语义和平面换源的完整及168vp短槽首目标均有0→1→1的忙态拒重记录。[AE现有证据对账](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-font13-manga-ae.json) [13项登记更新及检查](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/registration-followup-ae.json)

## 2026-11-15 VM 显示异常与正常重启恢复

本轮读屏和Toggle验证期间，11月15日04:14:13的RenderService绘制线程卡在模拟器DGLES的eglSwapBuffers，随后出现SERVICE_BLOCK和Watchdog退出。foundation、DMS及SceneBoard重建，OEM显示配置读取失败，保存DPI的user_set_dpi_value查询count为0，defaultDpi为0，实际显示密度回退到1.5。具体交互触发DGLES阻塞的直接因果继续保留。

此前通过系统设置切到大档再切回默认档，Reader比例及VirtualPixelRatio恢复3.5。用户再次指出系统显示无法恢复后，本轮确认DensityInCurResolution仍为1，状态栏窗口只有58px高，完整桌面图标和系统文字仍过小。此前只核对Reader比例及VirtualPixelRatio就继续验证，恢复结论不完整。

恢复期间另有4次临时原生适配尝试。01/02在动态库加载处失败，03/04已调用ScreenManagerAdapter.SetVirtualPixelRatio(screen0,3.5)，均返回100。此前将4次都表述为未进入密度写入不准确，现按原始源码和输出纠正。临时二进制及依赖副本的清理沿原记录保存。

用户明确授权正常重启VM并保留数据后，已执行一次正常重启。DMS启动时刻更新为16:53:33.897，SceneBoard从30321变为1426。物理分辨率保持1280×2832，VirtualPixelRatio和DensityInCurResolution均为3.5，屏幕挖孔信息恢复，状态栏窗口从58px恢复为136px。锁屏、完整桌面及Reader书架实屏均已查看。[重启、前后参数与实屏证据](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/display-recovery-after-reboot-20261115.json)

原安装包0.2.0.DEV.d61901614df1的版本、内容身份、UID及更新时间前后一致。正常启动后可见原四本书，Sample EPUB及Native Check保持未读，ReaderFramework显示27%，ReaderManga显示100%。本轮核验范围为正常重启、完整显示恢复、安装身份及可见书架数据，全部用户数据的逐字节审计沿其原范围保存。[完整原因与更正记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/display-density-incident-20261115.json)

最初DGLES阻塞的底层触发点以及再次异常恢复后的保持行为仍有各自证据缺口。全应用框架实施目标已恢复为active，后继验证沿完整恢复的系统显示配置推进。


## 2026年11月15日当前实施状态

全量实施目标已恢复为active。现有批准资料和紧凑布局保留决定继续有效，未完成工作保留在账本。此前把尚未完成的原稿检索、分支核对和原生场景提前写成待用户决定，现已纠正。当前运行代码提交为`c189905d`，已安装候选为`0.2.0.DEV.b2a0c9e4d9eb`。下文保留各批次当时的源码、失败及验证范围。正常重启后的完整系统显示已恢复，代码、原稿和准确原生入口的剩余工作继续由agent推进。


### 1.3倍字体下的文字目录与短槽控制内容

当前b2a0候选通过现有DEBUG装配调用生产ReaderFullDirectory和ReaderControlDirectoryContent，补齐文字详情、阅读上下文，以及树／平面Full／Quick和短槽共七个实际场景。九个捕获点分别核对配置1.3与独立原生倍率1.2999999523。文字父槽为320×770.2857vp，控制父槽为320×809.1429vp，实际Full内容为272.5714×533.7143vp，Quick为220.5714×190vp。正常应用路由、原阅读会话和业务写入继续按各自入口验收。[准确场景及证据范围](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-font13-directory-ad.json)

文字详情、阅读上下文和树Full的46vp完整章节行分别完成章首书签及下载附属动作，平面Full完成书签创建。平面Quick在38vp行内、26vp原生按钮盒上方18px的位置触摸，准确创建第21章章首书签。八次附属动作共取得五次书签创建和三次下载回调，四个控制场景均捕获实际书签页。26vp横向容量和Quick38vp行高的已知约束继续登记。

同一短槽actor的目录和书签模式分别完成122→168→190→168→122vp。十个点均保留各模式自己的原生List，实际高度为427／588／665／588／427px。122vp前缀经滚动到达标签、查询及工具，五个工具原生盒均完整154×154px并位于同一List内。当前工具可见性和八次附属动作各有明确范围，其余动作、焦点、读屏、方向及完整E2/E3继续按各自条件处理。

私有驱动修正两项入口问题。首次控制会话因标准输入关闭，在零UI动作时正常结束。后续详情动作与书签页完成后，菜单允许列表漏列已有阅读及控制入口，在查找阅读入口前停止。现已按当前菜单源码补齐允许列表，并复用已完成的详情范围。章节动作检查还显式拒绝裁切后的行和按钮盒，支持本次实测46／38vp行高。原始FAIL及准确续接均已保留。[驱动问题与修正](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/font13-directory-driver-failure-ad.json)

Directory基础登记修订为48，reading-text、control-text及两个短槽变体分别修订为47。十四次有限内存owner回调由八次附属动作和六次标签切换组成。系统三个滑块最终恢复2／1／1，独立原生字体回到1，正常启动返回原四本书架，TXT27%、两本测试书未读、漫画100%。两个密度字段均3.5，状态栏136px，SceneBoard1426。漫画及换源目标的1.3倍场景、其余正常宿主与焦点条件继续由agent执行。[登记范围](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/registration-font13-directory-ad.json) [本批收尾与后继工作](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-ad-delivery-review.json)

### 1.3倍字体下的下载变体、九状态与可见性判据修正

当前b2a0候选在320vp、实际系统字体1.3下补齐五个下载变体。全高父槽实测770.2857vp，书籍固定管理栏、章节浏览及章节固定管理栏已有当前原生依据。168vp父槽补齐书籍和章节流内管理栏，原生List归属、实际0→12本书及0→18个条目的全选、准确书籍身份和Back返回均已核对。原九状态及布局回执保留其当时的1倍字体和1849.3333vp全高输入。[本批完整原生范围](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-font13-download-ac.json)

读取中、空书架、读取失败、保留内容失败、原操作待核对、核对读取中、筛空、章节投影读取中及章节投影失败共九种实际有限状态已补证。读取失败重试接纳一次，清除筛选后查询为空、意图计数仍为0，章节失败的两次重试合并为一个未完成读取。全高恢复提示的重复触摸保持一次刷新，原操作结果仍未确认。[准确入口与已有证据不足之处](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/font13-download-plan-ac.json)

**私有可见性判据已修正。** 旧查找只检查裁切后的bounds，短窗章节全选载体曾只露出83px，原始高度为154px。该次实际回调及List归属证据保留。当前文字查找比较原始范围，布局断言显式检查完整摘要及154px全选载体，实际断言分支拒绝旧裁切样本，接受当前完整样本。固定栏四份及流内四份完整载体范围均已核对，一份流内初始截图通过同一实际断言分支复用。其余动作和整页E2/E3继续按各自条件处理。[判据、更正及当前证据](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/font13-download-visibility-correction-ac.json) [真实分支负例与正例](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/font13-download-visibility-method-ac.json)

168vp恢复样本中的Notice Scroll实测217px，正文原始高400px。两次实际滚动补齐分段正文和末项刷新动作，当前按钮完整高154px。刷新后的禁用重复触摸保持意图计数0→1→1，底层查询focused始终为false，当前捕获窗口中没有IME。原未知事实在读取中继续保留，正文分段及动作实屏已查看。

本批五次driver FAIL均保留，包含两次固定八步查找不足、一次断言顺序错误、一次把流内页头可见性加作详情身份前提，以及一次菜单45秒总限。查找与前提已按当前源码、原生位置和准确回执修正，已完成步骤逐项复用。末端菜单采用有界较快拖动，本次准确查找实测8545ms，四次及45秒限制继续生效。[失败及定位](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/font13-download-driver-failure-ac.json)

Downloads基础登记修订为31，五个变体分别修订为28，interaction及adaptation附上各自实际范围。当前七次有限owner回调来自三个准确打开书籍场景、读取重试、全高恢复、章节重试和短窗恢复，队列、文件及网络业务继续沿原范围验收。系统三个滑块最终恢复2／1／1，独立原生字体回到1，正常启动返回原四本书架，原TXT27%、两本测试书未读、漫画100%，两个密度字段均3.5，状态栏136px，SceneBoard1426。[登记更新](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/registration-font13-download-ac.json) [本批收尾与后继范围](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-ac-delivery-review.json)

### 1.3倍字体下的书源与工具恢复提示

当前b2a0候选补齐320vp、实际系统字体1.3、父槽高770.2857vp下的六个恢复状态。Source的回执待核对及原操作未确认分别完成实际核对，待清理完成实际继续清理，三次当前意图均被接纳。提示退休后原保留行Toggle恢复启用。Tools的未知回执完成核对，原操作未确认和待清理分别完成继续及继续清理，三次当前有限内存意图均只增加一次，原未决事实继续保留。[六状态及当前动作回执](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-font13-recovery-ab.json)

Source三份及Tools两份长提示均完成展开、收起。五份原生正文范围保持完整，十四个启用的动作载体均至少154px高，对应当前密度下44vp，全部位于各自当前Notice Scroll内。五张展开实屏已查看正文末尾和动作。Tools未知回执沿现有投影使用短“等待核对”，其正文范围单独记录。实际配置和独立原生字体比值在六个状态中逐项核对，其他高度、方向、真实业务写入和完整读屏沿各自范围验收。[准确入口及原证据不足之处](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/font13-recovery-plan-ab.json)

本批私有菜单驱动保留两次FAIL。首次固定约900px拖动在四次后停于工具目标之前，后继按实际2597px视口分配跨度。较长拖动随后触发10秒客户端超时，当前只读原生树确认原拖动已生效、目标已完整可见，后继直接消费该目标。后续菜单拖动使用30秒普通命令上限，四次及45秒总限继续生效。[失败、现场位置及修正](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/font13-recovery-driver-failure-ab.json)

Source和Tools基础登记分别修订为51及41，interaction和adaptation追加本批范围。六次恢复动作与三个工具默认关键词初始化回调分开计数，原生收尾观察的全局计数为9。两份文档和当前原生清单已更新，完整21项逐层判定沿原条件保存。[登记更新](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/registration-font13-recovery-ab.json) [当前后继范围](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/remaining-native-entry-review-ab.json)

系统三个滑块已恢复原2／1／1，独立原生字体读数回到1，正常启动后回到原四本书架。原TXT27%、两本测试书未读、漫画100%，两个DMS密度字段均3.5，状态栏136px，SceneBoard1426。当前运行代码和原签装候选继续复用。[本批收尾](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/continuation-ab-delivery-review.json)

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

## 前次交付记录

2026 年 11 月 14 日，已按用户要求先完成代码侧可执行整改，再完成本轮准确 VM 场景。实施沿用原隔离检出，生产候选绑定 HarmonyOS `facf700e27d9246a234f0203d44d2114d7bc0297`。Core 为 `c078126376294faa3a611690fbe48e79f0f86cc4`，Reader-UI 为 `f206f0db011ae82c5a6e4059769fa3688b9cfcd5`。当前阶段为 CODE_AND_SCOPED_VM_DELIVERED，整体验收沿原条件开放。

### 已完成的生产整改

| 范围 | 当前实现与准确回归 | 本轮原生依据及剩余条件 |
| --- | --- | --- |
| UIF-01 测量续接 | StandardPage、SourceManagement、BookshelfMultiSelect、详情、漫画目录和保留 Discover 按头尾真实依赖续接。有限原生矩形补采覆盖同尺寸换代，迟到、卸载和真实失配继续受拒旧条件约束。standard-page-generation、standard-page-same-area、direct-page-same-area 通过 | 目录查询与漫画的 IME/Back 原点、1.45 倍书源输入及页头连续性已有准确采样。实测高于58vp的页头和全部窗口组合仍按原生关闭条件保留 |
| UIF-02 动效偏好 | 下载六处、书源工具两处、目录规则一处接线完成，详情和阅读内两条目录来源贯通。正常 SDK 装配覆盖偏好、实时变化和回调退休 | 书源工具原生打开、Back、末项选择和实际 owner 更新通过。动效逐帧、下载和目录的完整焦点矩阵继续开放 |
| UIF-03 短反馈宣告 | 沿当前前景宿主及 generation 接入不打断平台宣告，跨宿主同代只认领一次。transient-announcement 通过 | 现有 VM 屏幕朗读开关为关闭。可听、打断情况和读屏焦点保留原验收条件 |
| UIF-04 测试判据 | 最终属性、状态更新和真实动作断言替代 modifier 调用次数拒绝，合法顺序组合与行为负例通过 | 方法与 SDK 结果沿各自范围入账 |
| UIF-05 分组恢复容量 | 实际覆盖槽按窗口、安全区、IME 和 recoveryTop 支付 maxHeight，既有单一 Notice Scroll 消费预算。长文案、双动作、busy、零容量及 resize 回归通过 | 真实长未决分组提示的原生全文、末项动作及焦点返回继续开放 |
| Toggle 条件风险 | 受控重挂后仅对当前先前键盘焦点执行一次有界帧后恢复，拒旧和禁用条件已回归 | af920500e5af 上两次 Enter 后值 false→true→false，后继原生 Toggle 均保持焦点。原偏好已恢复。实际读屏焦点继续开放 |
| 移除确认条件风险 | 补窗口 revision 依赖，实际 SDK 更新路径能重算纯高度变化后的 Scroll 容量。removal-resize 通过 | 精确纯高度变化的真实确认场景继续开放 |
| 目录查询响应 | 既有 50vp 工具栏支付透明 44vp 承载槽，保留 32vp 外框与 Control 30vp、Standalone 32vp 输入配方。48 个查询上下文、42 个目录预算与动作样本和 200 个 Source SDK 样本通过 | 60649f803468 上查询框上下外框边缘均能使真实 TextInput 获焦，IME/Back 恢复通过。当前40bc候选复用该项原身份观察 |

当前生产库存为 635 个 ETS/TS 文件，含 270 个 ETS、365 个 TS。14 个 StandardPage 和 11 个 Scaffold 构造点的框架消费处置逐项对账。20 个路由值、4 个 manifest 根及 L0 准入沿原来源保存。当前候选完整 ArkTS 工程编译通过，635 项生产输入与不可变候选快照一致。后续文档与登记更新沿同一生产输入复用签名包。[代码复核](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/code-first-review.json) · [候选字节绑定](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/current-code-byte-comparison-40bc.json)

### VM 新发现与修复

VM 发现 UIF-06。旧候选中，书源工具底部下拉的原生包裹盒为零尺寸，绝对定位内容没有参与平台 popup 避让，末项被裁切且内部没有可滚动范围。ReaderSelectPanel 现按 popup 自然流和页面 overlay 定位宿主提供各自布局，ReaderInlineSelect 支付当前窗口、安全区及 IME 高度。inline-popup-layout、select-host、select-reduce-motion 和 parent-chain 回归通过。

后继候选40bc完整编译、签名及保数据部署通过。默认字号下，平台将底部下拉安置到触发器上方，末项原生 Button 完整可见，Back 关闭后保留原宿主，实际选择“发现”更新 owner 并关闭面板。系统特大档的真实倍率为 1.45，末项 Button 与文字也完整可见，实际选择回调通过。初始失败候选、错误方向及修复后证据均保留。[UIF-06 原生记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-popup-40bc.json)

### 签名候选与现场恢复

当前 App 为 `0.2.0.DEV.40bc7b38fab6`，产品版本 `0.2.0`，安装计数器 `1000000`，签名 HAP SHA256 为 `9e8741e2073076468b96c7200070c5de1bd61b6182e5d62d2019bdca18eeb38f`。证书为用户指定 minliny_HarmonyOS，包名 io.reader.minliny。iteration 构建及准确交付已完成。contracts-scope 为 none，全量套件结果为 NOT_RUN。[不可变 manifest](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/hap/20261114T054448Z-facf700e-15be72a2/manifest.json)

保数据安装在远程 HDC server `192.168.1.10:8710` 的准确 VM `127.0.0.1:5555` 上完成。停止态原库和 WAL 有不可变备份，精确副本完成兼容性证明，安装与启动回执为 PASS。系统字体由标准档2临时调到特大档5，Reader 实测倍率为 1.4500000477。场景结束后，设置恢复到2，原字体粗细1、界面缩放1均核验，Reader 实测倍率恢复为1。最后现场为当前候选正常书架，全部有界 HDC 会话已结束。[部署回执](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/hap/20261114T054448Z-facf700e-15be72a2/deploy-vm-6460677a198b-20261114T054634Z.json) · [字体及现场记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-font-and-environment-40bc.json)

### 保留的布局与验收条件

用户明确选择沿批准原稿保留目录与 TTS 紧凑布局。目录四个 32vp 工具扩成四个独立 44vp 响应时有 48vp 横向缺口，tab 的 Quick/Full 高度为31/36vp，章节行为32/40vp，附属响应宽度26vp。TTS Quick 的四个独立响应宽度为39、36、32.5、37.5vp。这些容量冲突保留准确数值和 E2 诊断。

正式 control 登记为 revision25。21项页面登记的输入与引用已同步，引用检查通过。正式页面检查保留37项诊断，含 E2 的21项 FAIL、E3 的5项 FAIL、G-03 的8项 NOT_RUN 和 SCOPE 的3项 NOT_RUN。visual 的21项仍为 NOT_RUN。完整读屏可听、真实长分组恢复、全部页面命中和字形、精确2倍系统字体、独立整页视觉批准、GAP-04、连续绘制G05和历史Tab坏态归因G10按原关闭条件保存。用户明确选择沿现有资料推进，新增原稿和同期历史证据的缺口继续保留。[完整账本](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/ledger.json)

方法、SDK、编译、签名、安装、原生观察、复用和用户验收分别记账。原始633项审计库存、历史失败候选与未运行项保留其原始身份。下文保存授权前实施方案，当前结果以上述交付记录及账本为准。

## Figma 对照补核

用户于2026年11月14日追问保留项的Figma依据。本轮代码实施主要复用了冻结的原稿提取、既有来源登记和当前生产容量核算，保留项逐项重新打开Figma的对照尚未完成。前述“批准原稿保留”需要同时注明本轮用户选择保留布局的授权，以及每项独立的原稿对照范围。

本次已通过Figma桌面补看33页同步前目录备份节点4765:7940，确认单行查询与四工具、双tab、紧凑章节行和底部当前章节的组合。2026年9月5日冻结提取另提供336×52工具栏、168×32查询绘制、32×32工具绘制、16图形、5间距及36高Full tab、40高Full章节行。该提取还包含8个章节下载或书签的显式44×44 HitTarget。当时核对的平面分支26vp附属原生响应仍需逐项对账，正常语义分支44vp宽度及新原生命中依据见本次继续实施状态，原提取中的40高裁切行和相距30的附属动作中心也会影响有效命中。原生裁切、重叠和分派仍按真实消费者核验。[目录原始提取](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/tools/fixtures/reader-directory-toolbar-hierarchy-20260905.json)

TTS的独立依据是2026年9月11日Make版本17的冻结DOM测量，Quick视口286×190、播放卡264×66，四个传输控件绘制依次28、36、28、28。前述39、36、32.5、37.5为当前代码分配的独立响应宽度。当前Figma的07页节点1977:22789明确标为当前应用同步App7fc3af9a，其内容需沿此来源使用。原Make每个目标的交互响应仍缺本轮重新对照。[TTS冻结测量](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/tools/fixtures/reader-control-tts-make-20260911.json)

本次API读取备份目录节点返回403和Token expired，Figma桌面可以查看已有内容，同时显示待重连同步。服务端最新版本的新鲜度继续开放。完整保留项的逐项设计对照、命中及视觉验收沿各自条件保存。[补核记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/figma-followup-review-20261114.json)

## 原始实施方案

日期为 2026 年 11 月 14 日。实施输入为 HarmonyOS `10a5d58d0231f48a4c4fceff22c733b3b3cb1fe2`、Core `c078126376294faa3a611690fbe48e79f0f86cc4` 和 Reader-UI `f206f0db011ae82c5a6e4059769fa3688b9cfcd5`。

本方案承接[全应用审计报告](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/docs/architecture/ui-framework-audit-20261114.md)及[五项问题账本](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/ledger.json)。当前状态为 PLAN_ONLY。各批次列出的源码修改、回归增补、构建和原生验证均为后续实施工作。

## 实施目标与交付边界

第一组交付关闭 UIF-01 至 UIF-05 的应用侧原因，并提交对应真实方法或正常 SDK 装配回归。第二组交付回答 Toggle 焦点与移除确认容量的两个条件风险。第三组交付逐页补齐 E2、E3、视觉来源和原生生命周期证据。历史 Tab 坏态归因沿 G10 单独保留同期取证要求。

每个问题在原账本中追加生产修改、输入指纹、准确测试项、结果、剩余问题和原生证据。源码修复、方法回归、编译签名、安装、原生交互、视觉批准分别记录。实施后报告应能直接回答哪些问题已经在代码侧关闭，哪些证据已复用，哪些原生结论仍开放。

## 批次与依赖

| 批次 | 主要工作 | 依赖与产出 | 完成条件 |
| --- | --- | --- | --- |
| 0 | 核对当前 checkout、问题与旧证据 | 输入指纹、受影响调用点、逐项验证选择 | 相关差异有归属，复用与待跑范围已写入原账本 |
| 1 | UIF-01 测量续接和页头避让 | 共享页、原生测量宿主及同型直接 owner | 同盒换代可收敛，真实失配旧回调继续无效 |
| 2 | UIF-04 判据修正及 UIF-02 偏好接线 | 原生属性回归、九处下拉及两条目录来源 | 正常入口继承偏好，行为断言和负例具有对应结果 |
| 3 | UIF-05 分组恢复容量及 UIF-03 短反馈宣告 | 分组覆盖层和共享反馈的薄平台适配 | 长内容与动作可达，当前前景反馈按代次宣告 |
| 4 | 两个条件风险与跨宿主组合复核 | 代码定位、必要时的准确原生问题 | 各风险得到已排除或可复现归因及相应处置 |
| 5 | 受影响原生行为和全应用剩余项关闭 | 固定候选、最小交付、逐页证据 | 本次五项逐层记账，E2/E3、视觉、G05/G10 各自更新 |

批次 2 和 3 的问题在技术上可以独立实施。一次共享修改影响多个问题时合并采样并保存各自断言。UIF-04 的测试调整随所覆盖控件提交，避免无行为依据的计数规则继续充当生产结论。各批次按问题提交，便于审查和局部回退。

## 批次 0　固定输入与复用依据

1. 在当前隔离检出核对 HEAD、未提交差异和实际正在工作的 owner。以本报告指纹作比较起点，保留并行 WIP。
2. 对五项问题重新核对相关输入有无漂移。仅在相关生产方法或依赖改变时更新该项来源，历史见证保留原结果与原指纹。
3. 复用最近交付中已经覆盖且本次未影响的普通 Back、目录往返、表面边框、短内容滚动原点等准确场景。后续修改改变其生产依赖时，再选择对应的局部回归。
4. 在原账本为每个拟运行项补充唯一问题、旧证据不足之处、实际入口、隐式调用、输入、时间上限及停止条件。缺少目标场景的旧 PASS 只能沿其已证明范围使用。
5. 记录本次实施耗时的代码、方法、构建、签装、设备查询和等待部分。后续候选具备复用条件时沿用已有产物与缓存。

本批次使用现有[源码清单](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/source-inventory.json)、[覆盖快照](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/full-report-scope.json)和[最近交付记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/control-module-height-20261113/goal-completion-audit/current-delivery-23dc.json)。

## 批次 1　修复测量换代后的续接

### 修改范围

| 文件或 owner | 修改内容 |
| --- | --- |
| ReaderStandardPage | 区分页面几何变化与实际头尾测量依赖变化，明确同盒事实的续接资格 |
| ReaderFixedHeaderHost | 对确需新代测量的情况提供当前挂载盒的有限补采入口，并保留原生 Area 后续更新 |
| ReaderPageScaffold | 必要时传递测量请求与当前挂载身份，统一 header/footer 回执 |
| ReaderMeasurements | 沿用有限高度、单调代次及拒旧语义，只有共享 owner 确实需要时才扩充最小接口 |
| SourceManagementPage | 核对并修正其独立的 generation、fallback 和 Area-only 续接链 |
| 其余直接 Scaffold owner | 逐个检查失效条件、测量产生入口和 fallback，按实际同型证据纳入修复 |

源码入口见[StandardPage](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/ui/layout/ReaderStandardPage.ets:55)、[FixedHeaderHost](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/ui/layout/ReaderFixedHeaderHost.ets:15)、[Scaffold](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/ui/layout/ReaderPageScaffold.ets)、[测量存储](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/ui/layout/ReaderMeasurements.ts)和[书源独立 owner](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/source/ui/SourceManagementPage.ets:1320)。14 个 StandardPage 构造点和 11 个 Scaffold 构造点已保存在 AST 清单。

### 采用的处理方向

页面 geometry revision 与头尾 slot 的测量资格分别判断。仅窗口高度、键盘或无关环境字段变化，且页头的宽度、字体、内容配方和挂载身份继续有效时，保留已知页头高度并据此重算正文。真正改变测量依赖时生成新请求，并由当前原生宿主补采当前事实。

补采使用现有 SDK 节点或矩形读取能力及有限 post-frame 调度。实现时先核对项目已有 SurfaceRectMeasurement 适配是否能直接复用。相同高度也能按当前有效请求交回，避免把数值 epsilon 去重当成代次续接。每次读取捕获宿主、请求和挂载身份，采纳前再次核验。原生查询失败、零尺寸或节点退休均有明确退出结果，后续真实 Area 仍可更新。

Header 和 footer 分别判断测量依赖。rail 与底栏互换、footer 条件消失、真正宽度改变、字体就绪以及实体重挂均需要独立覆盖。对 header 合法保留事实时，不能连带复活已退休 footer。直接 owner 的修复沿用其自身配方和滚动职责。

### 最小回归与负例

在现有 `test-ui-window-layout-closure.mjs` 中增加同盒续接场景。建议 case 名为 `standard-page-same-area`，该名称当前尚未注册。

- 用真实 StandardPage 方法和完整几何输入建立 93vp 页头。保持页头原生盒和宽度，改变 viewport 高度、IME 及环境 revision，验证 startInset 持续按有效 93vp 分配或由有限补采恢复。
- 通过正常 build 装配回调，验证新请求即使得到相同高度也可以采纳。测试显式不给 Area 事件，不能由夹具补发一个生产端没有义务产生的事件。
- 改变宽度、字号、字体就绪、配方或挂载身份，注入上一请求的迟到回执，验证其无法修改当前几何。
- 覆盖 footer 消失、rail 往返和卸载重挂，验证 inset 只由当前存在的 owner 支付。
- 对 SourceManagement 的独立生命周期复用其实际方法和当前 producer，验证同型原因已经消除。

已有 `standard-page-generation` 的拒旧和手动新回执收敛断言继续保留。实现后按实际依赖调整其期待值。方法级证据充分后，剩余原生问题为窗口纯高度或 IME 变化时是否会出现中间避让错误。最小原生场景选一个实际可进入且页头实测高于 58vp 的页面，记录变更前后页头与正文原点，保留同窗同帧身份。

## 批次 2　修正控件判据并补齐动态效果偏好

### UIF-04 的测试修改

`assertSingleNativeModifier` 的计数结果只能解释局部装配约定。现有 Button 的合并 modifier 实现可以继续使用。回归断言直接检查最终 native carrier、语义、样式和业务动作，状态更新后再次执行正常 SDK 更新路径。[现有测试](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/tools/test-framework-confluence-controls.mjs:25)

具体断言覆盖实际宽高或 minimum、选择角色与选中值、enabled、按压和禁用外观、真实 onClick，以及 disabled/retired 后回调拒绝。负例移除一个必要属性、破坏某个状态更新或动作资格，使相应行为断言失败。两个合法 modifier 顺序组合应按平台规则得到合并及后写覆盖结果，测试记录该边界。

现有 `source-native-targets` 和 `source-group-budget` 为点名入口。需要补充的状态断言并入该文件，必要的新 case 先注册准确含义。华为对多个 modifier 的顺序应用已有平台约定。[官方文档](https://developer.huawei.com/consumer/en/doc/harmonyos-guides/arkts-user-defined-extension-attributemodifier/)

### UIF-02 的实际接线

优先沿现有 Prop 传递单一全局偏好，实际修改位置如下。

| 来源 | 完整 UI 装配链 | 修改 |
| --- | --- | --- |
| 下载 | Index → SharedDownloadPage → 六个 ReaderInlineSelect | 消费页面已有 reduceMotion Prop |
| 书源工具 | Index → SourceJourneySurface.toolsPage → SourceToolsPage.debugCard → 两个 ReaderInlineSelect | toolsPage 传递，Tools Page 接收并向两处传递 |
| 阅读内目录 | 已有 reduceMotion 的 ReaderShell → ReaderDirectoryDestination → ReaderFullDirectory → ReaderDirectoryRules → ReaderInlineSelect | 补齐四层真实 UI 绑定 |
| 详情目录 | Index.externalDirectory → DetailDirectoryScene → ReaderDirectoryDestination → 后续相同链 | 根使用 settings snapshot，Scene 与 Destination 接收并传递 |

链路见[下载](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/downloads/ui/SharedDownloadPage.ets:784)、[书源装配](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/source/ui/SourceJourneySurface.ets:105)、[Tools](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/source/ui/SourceToolsPage.ets:792)、[阅读根](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ui/ReaderShell.ets:335)、[详情入口](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/pages/Index.ets:1093)、[详情 Scene](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ui/DetailDirectoryScene.ets:24)、[Destination](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ui/ReaderDirectoryDestination.ets:139)、[FullDirectory](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ui/ReaderFullDirectory.ets:390)和[规则选择器](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ui/ReaderDirectoryRules.ets:293)。

ReaderSourceJourney 等业务导航类继续只处理原导航职责。偏好的持有者沿用 SettingsPresentation。菜单生命周期中途改为减少动态效果时，核对 SelectPanel 当前 Watch 和动画完成逻辑，按现有 motion policy 完成当前状态及回调退休。

### 回归与关闭

修正 `inlineSelectSdk.choose` 的无条件 `inline.reduceMotion=true`。由调用方显式选择偏好，测试分别检查 true/false。需要即时完成的有限方法场景可以显式提供对应输入，并另设正常调用方传播场景。[SDK helper](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/tools/lib/reader-inline-select-sdk-probe.mjs:41)

在现有 secondary layout 的 `select-host`、`actions-tools-rules` 和 `download-controls` 场景中复用真实装配，按实际依赖补充正常入口。建议增加 `select-reduce-motion` case，该名称当前尚未注册。覆盖九个构造点，目录包含阅读和详情两来源，检查当前 panel 的 reduceMotion 和实际动画参数。true 时遵守现有零时长或无动画分支，false 时沿当前配方。菜单打开后切换偏好、关闭时切页、旧 selectionId 与卸载时，已退休回调不得继续操作新 owner。

原生剩余问题为 popup 实际打开与关闭的动效、焦点和外点行为。选下载、书源工具和目录三个宿主各一个实际入口，已覆盖相同宿主语义的旧证据可复用。若只修改测试判据且生产输入相同，沿用原生产包。

## 批次 3　恢复提示容量与短反馈宣告

### UIF-05 的容量分配

在 BookshelfGroupDialog 的恢复覆盖槽中计算当前可用高度。输入来自实际宿主 viewport、safe-area、现有 recoveryTop 与上下留白。沿用 ReaderRecoveryNotice 的 `maxHeightVp` 有界滚动能力，或由该槽提供一个有界 Scroll，选择单一实际滚动 owner。[分组覆盖槽](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/bookshelf/ui/BookshelfGroupDialog.ets:39) [共享容量入口](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/ui/feedback/ReaderRecoveryNotice.ets:25)

宿主显式订阅会改变该预算的窗口事实。高度为零或负值时夹取到零，原操作事实与恢复入口仍由原 presentation 持有。空间恢复后重新分配容量。展开长文案时，动作和全文在当前边界内可以滚动到达。原分组事务的 identity/generation、双动作 busy、外点、Back、焦点域与焦点返回按当前规则执行。

在 `test-secondary-layout-repairs.mjs` 的 recovery overlay 场景或现有分组装配测试中增加准确分组子项。建议 case 名为 `bookshelf-group-recovery-capacity`，当前尚未注册。通过正常 build、surface、recovery 链进入共享 Notice，输入短文案、长 blocked message、展开、双动作、busy、zero-height 和 resize，检查预算确实落到原生 Scroll，并点击真实动作验证原代次资格。

最小原生剩余问题为短窗口和大字号下最后一个动作是否可达，以及滚动和关闭后焦点是否回到当前触发入口。已有原操作自然完成或前提失配时结束该场景并记录结果。

### UIF-03 的显式宣告

由 ReaderTransientToast 的有效前景宿主发起一次平台宣告，复用 ReaderTransientFeedback 已有 generation 和 active-host 归属。平台接口使用 SDK 提供的 `sendAccessibilityEvent`，按当前 API 能力选择不打断宣告。API18 起的事件类型已经存在于本机 SDK，当前实际构建目标及运行环境仍在该动作处核对。[宿主生命周期](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/ui/feedback/ReaderTransientToast.ets:110) [SDK 接口](/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/api/@ohos.accessibility.d.ts:376)

宣告适配保持在现有消息或平台边界，包含下列行为。

- 在当前 host、foreground、visible、非空消息及有效 generation 均成立时发出。前景宿主竞争沿用现有优先级。
- 同一业务 generation 的宣告资格由现有共享反馈归属协调，处理同一反馈的宿主交接，避免只靠单组件本地计数造成重复。
- 从反馈当前 title/message 生成可理解的文字，重复发布、空内容、替代和隐藏的规则与现有可见状态一致。
- 使用平台宣告事件保留当前输入焦点。可见 UI 和原业务操作继续由已有 owner 持有。
- 在实际发出前再核验身份。异步 API 返回只记录该次调用结果，失败按当前消息日志边界记账，随后到达的旧完成不改写新反馈。

在共享反馈现有测试目录中增加准确宣告场景。建议 case 名为 `transient-announcement`，当前尚未注册。运行真实 host 的 syncToast、挂载、前景变更及卸载方法，对平台接口设置有限 spy。覆盖活动/非活动 host、竞争、同代重复、不同代替代、同代宿主交接、后台、退休和平台拒绝，检查发送次数与文字，检查无请求焦点调用。

方法测试关闭应用发事件的接线问题。原生读屏场景回答宣告是否实际可听、是否打断当前内容、焦点是否稳定。平台 API 成功回执和实际听到分别记录。已由代码定位的缺口修复及局部回归完成后，再安排该准确问题。

## 批次 4　两个条件风险的定位

| 风险 | 先做的源码工作 | 原生未决问题与最小场景 | 实施条件 |
| --- | --- | --- | --- |
| Toggle 焦点 | 追踪八个构造点、nativeRevision 替换、受控值回写及已有 focus 处理 | 对当前可达设置开关做一次键盘或读屏激活，观察焦点能否继续同一操作 | 若确实丢焦点，优先使用原生受控更新或当前 focus owner 的有限恢复，并复验拒绝状态的投影 |
| BookRemoval 高度 | 追踪 Index 装配、父约束、文字 Area、窗口 revision 与 messageMaxHeight 更新 | 打开真实移除确认后只改变高度，观察正文与动作边界 | 若新预算没有传到当前宿主，补充实际 owner 的窗口依赖或有效测量更新 |

风险源码见[Toggle](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/ui/controls/ReaderToggle.ets:43)和[移除确认](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/entry/src/main/ets/features/bookshelf/ui/BookRemovalDialog.ets:68)。源码或旧证据已经回答的问题直接记录结论。原生行为足以排除风险时保留排除证据。确认缺陷后登记准确触发、因果链和最小回归，再实施对应修改。

## 共享框架组合回归的选择

下表列出实施时可用的现有入口以及保护边界。执行前核对该项定义与隐式调用仍符合本次范围。新增 case 以注册后的实际名称为准。

| 入口与准确 case | 嵌套或范围 | 本次必要依据 | 停止与复用 |
| --- | --- | --- | --- |
| test-ui-window-layout-closure，standard-page-generation | 选定生产方法、完整纯几何/store、有限输入 | UIF-01 修改会影响代次及拒旧 | 该项失败先审方法与输入，其他无关窗口 case 保留原结果 |
| 同文件，window-environment | 真实 environment/coordinator 绑定、有限平台端口 | 仅实际改到环境发布或订阅时选择 | 只改 slot 策略时核对旧结果能否复用 |
| test-framework-confluence-controls，source-native-targets | 当前 SDK Button、相关 spec、所选状态 | UIF-04 修改其行为判据 | 计数断言退回局部含义，失败归于对应属性或回调 |
| 同文件，source-group-budget | 当前 SelectPanel/ChoiceRow border-box | 只有控件预算或 modifier 实际受影响时选择 | 单纯补 Prop 时复用未变配方结果 |
| test-secondary-layout-repairs，select-host/actions-tools-rules/download-controls | 当前相关控件和具体页面装配，有限量字/动画端口 | UIF-02 的正常接线与六处下载下拉 | 仅点名受影响 case，平台 popup 仍另记 |
| 同文件，recovery-overlays 及拟增分组 case | 当前恢复层与实际 Notice | UIF-05 需要验证原生容量属性确实被装配 | 外围 overlay 旧断言继续沿原来源使用 |
| 共享反馈拟增 transient-announcement | 实际消息 host 与有限平台事件 spy | UIF-03 缺少自动宣告通道 | 只证明平台调用与身份，实际读屏单列 |
| overlay assembly 检查的准确宿主 | 现有已登记槽和真实 build 追踪 | 仅新增或改变装配合同、登记时选择 | 已知槽检查覆盖边界继续记录 |
| 读者控制栏历史准确 case | 按本次实际依赖选择 lifecycle、budget、surface 或 navigation 子项 | 修改进入这些生产依赖时才执行 | 共享 UI 名称相似本身不触发全组 |

测试入口见[窗口](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/tools/test-ui-window-layout-closure.mjs)、[控件](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/tools/test-framework-confluence-controls.mjs)、[二级装配](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/tools/test-secondary-layout-repairs.mjs)、[覆盖层检查](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/tools/check-overlay-assembly.mjs)和[门禁选择规则](/Users/minliny/Documents/Reader/GATE_INDEX.md)。当前方案中的表格是执行选择依据，实际运行结果在原问题中追加。

## 批次 5　原生行为与全应用剩余项

### 固定候选和实际交付

当实施进入 HAP 或设备动作时，使用项目 reader-harmonyos-hap-pipeline 流程，核对候选源码、Core pin、工具链、输入、不可变产物和签名。沿用用户指定 `minliny_HarmonyOS` 证书、`io.reader.minliny` 包名和匹配 Profile。版本按现行治理处理。每个签装动作单独核验身份及保数据条件。

先查相同生产输入的已有产物与场景证据。确需新构建时只构建该候选一次，记录产物 SHA 与 manifest。仅测试变更且生产包输入相同的情形，复用已签名生产 App。HDC 经 reader-hdc-lease 入口，按实际 server、精确 target 和占用执行，完整调用链直连，设置本次问题所需的有界期限。

代码侧已回答的原因先完成修复与局部回归。设备场景逐项写明剩余问题、旧证据为何不足、动作、观测值和停止条件。平台工具或必要运行条件缺失时记录具体缺口，已完成的代码与方法结果继续有效。

### 正式登记的后续工作

当前四个页面族含变体共 21 项。保存结果为 visual 21 项 NOT_RUN、interaction 21 项 FAIL、adaptation 5 项 FAIL 与 16 项 NOT_RUN。实施后更新实际受到影响的登记和证据，保留各项输入及原结果。登记中的 FAIL 包含完整原生命中、焦点或读屏证据缺席。Source 的 content FAIL 还保留整页原生字形与裁切验收缺口，具体原因沿原条目处理。[正式 register](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/tools/page-structure/register.json)

| 工作面 | 实施内容 | 关闭依据 |
| --- | --- | --- |
| Source/Tools | 测量续接、下拉偏好、真实 native target 及选择语义 | 正常入口，实际父级预算、触摸、焦点、读屏及大字号 |
| Directory 及 12 变体 | 详情/阅读来源、text/manga、规则/书签/正文及各临时层 | 按变体的真实装配、响应可行性和返回身份 |
| Downloads 及 5 变体 | 普通/管理/章节/弹层的偏好、内容和原操作 | 各实际状态的命中、焦点、容量与大字号 |
| 书架/搜索/详情/设置及诊断根 | 报告中的路由与根责任逐项对照，复用已有有限来源 | 对实际可达状态的独立依据和对应运行证据 |
| L0 保留模块 | 复核共享框架消费和关闭条件，保留 S-06 来源 | 未来实际开放范围明确后按其真实入口完成对应验证 |

当前目录及 TTS 部分紧凑横向响应与 44vp 下限存在已知冲突。每处先列 paint、native carrier、父槽、边框、gap 和可用宽高，再选择可容纳的响应分配或经确认的页面布局调整。使用真实目标和相邻命中验证，默认密度与小窗口分别给出依据。

### 视觉依据、连续绘制与历史坏态

1. 对完整书架、搜索、详情及部分二级和漫画状态补齐独立批准来源，核对后续批准是否覆盖当前组合。源码衍生画板继续标注来源。存在明确设计差异时沿原配方实施，涉及布局变更时给出具体可审阅方案。
2. 阅读恢复引导的 GAP-04 沿已有 `CODE_VERIFIED_NATIVE_OPEN` 记录补实际原生入口与遮挡证据。
3. G05 先检查现成视频、trace 或可用连续取帧能力。在固定候选的一段正常操作中记录目标、profile 提交、Area、输入资格与像素时序。只改变某一链路时选择对应动作，保留真实窗口和帧身份。
4. G10 需要历史 Tab 扇形坏态同期的 App、PID、window、frame、Area、半径、path 与绘制命令。缺少同期输入时继续开放归因。后继正常场景的像素与 RS 证据沿其采样时刻保存。

来源与现有开放状态见[原设计审计](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/docs/architecture/ui-design-comparison-audit-20261113.md:131)和[整改总账](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/docs/architecture/ui-design-full-fix-20261113.md)。

## 验收、失败处理和回退

| 问题 | 应用侧关闭 | 方法或装配关闭 | 原生剩余关闭 |
| --- | --- | --- | --- |
| UIF-01 | 测量事实续接与拒旧均成立 | 无 Area 同盒场景、真正依赖变化、卸载与迟到回执 | 当前窗口/IME 变化的正文避让与中间绘制 |
| UIF-02 | 九处接线和目录两来源完整 | true/false、过程中变更、旧 identity 及卸载 | popup 动效、外点、Back 与焦点 |
| UIF-05 | 分组恢复槽支付当前高度 | 长文展开、双动作、零空间、resize 与原操作资格 | 全文和动作可达、关闭及焦点返回 |
| UIF-03 | 有效 host 按反馈 generation 宣告 | 竞争、交接、重复、替代、后台、失败与退休 | 实际可听、不打断策略及焦点连续 |
| UIF-04 | 每个负例能对应一个真实失败 | 属性、更新、交互和合法组合均按平台语义检查 | 所涉及原生行为随相应生产项复验 |

每次局部失败先保留输出、输入指纹及本次已完成结果，再审生产路径与夹具。夹具缺端口记夹具失败，生产动作失效记对应问题，缺少所选证据保持未完成。形成新的可检验原因后再安排一次有界运行。

按问题保存小型提交及其对应回归。回退时核对当前差异和后续依赖，只恢复本问题实际修改。安装候选及用户数据按既有保数据流程处理，源码回退与设备结果分别记录。

最后交付包括实际源码差异、准确测试结果、更新后的原问题账本及页面登记、发生过的构建签装 manifest、原生证据和仍开放的视觉或历史归因项。当前这两份文档及覆盖快照构成实施输入。
