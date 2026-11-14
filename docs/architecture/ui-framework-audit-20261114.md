# Reader HarmonyOS 全应用 UI 框架审计报告

## 2026年11月15日继续实施状态

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

### 当前构建、部署与登记

当前已安装候选为0.2.0.DEV.c96f5e48a87a，生产提交24f7533592cbf6001315663b313baaa0a6a68f91。638个ETS/TS输入全部匹配不可变快照，含272个ETS和366个TS。完整ArkTS编译、指定minliny_HarmonyOS签名、准确停止态DB/WAL副本兼容性证明、保数据安装及启动通过。产品版本0.2.0，安装计数器1000000，包名io.reader.minliny。签名HAP SHA256为183f4fc7196c5c5782edf22d29ab7c14a5797899342b13779aded851b134aca3。[manifest](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/hap/20261114T182149Z-24f75335-74ba2eea/manifest.json) · [部署回执](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/hap/20261114T182149Z-24f75335-74ba2eea/deploy-vm-6460677a198b-20261114T182249Z.json) · [输入绑定](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/current-code-byte-comparison-c96f.json)

正式control登记为revision27。当前引用检查通过且零诊断，页面检查保留37项诊断，含21项E2 FAIL、5项E3 FAIL、8项G03 NOT_RUN及3项SCOPE NOT_RUN。visual21项NOT_RUN和Source content FAIL继续保留。仅执行本次选定回归，构建contracts-scope为none，全量套件NOT_RUN。[引用检查](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/implementation-continuation-refs-10.json) · [页面检查](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/implementation-continuation-register-10.json)

VM最后恢复正常书架。减少动态效果恢复false，屏幕朗读恢复OFF，字体档2、粗细1和界面缩放1均经实际系统树核对。全部本次租约已释放。

### 剩余工作及真实资料缺口

剩余可执行工作继续留在全量目标内，包含其余消费者和纯读屏激活、可写书签及Quick和平面目录的逐目标命中、TTS其余状态、不同下拉宿主的连续动效、实际短反馈可听宣告、移除确认纯高度场景、21项登记的字形裁切和适配矩阵，以及G05连续帧。当前局部PASS沿其精确入口和候选使用。

为连续帧及音频检查，本次由agent增加显式DEBUG warm-Want公共录屏适配。精确参数之外没有录屏IO，输出限自身缓存，麦克风关闭，启动等待上限30秒，实际录制范围1至15秒。准确生命周期回归及工程编译通过。独立shell C API Create返回null，应用身份已进入RequestUserPrivacyAuthority，首次没有STARTED并在30秒后释放。当前没有可用视频或音频，G05及可听验收继续开放。[能力记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-capture-capability-20261115.json)

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
