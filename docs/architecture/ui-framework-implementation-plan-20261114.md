# Reader HarmonyOS UI 框架实施方案

## 2026年11月15日后继修复与未决内容

全量目标继续执行。当前没有等待用户决定的实施选项。原稿查找、分支核对、回归修正、可进入的VM场景和登记对账均由agent继续完成。已确认的紧凑布局决定继续适用。下面的状态更新到生产修复提交`8036ac9f`。

### 新确认的遗漏及修复

目录平面回退存在UIF-13。基线`10a5d58d`已经使用稳定的`row.key`，数据源对书签与下载值变化调用`onDataChange`。行内使用普通对象，原生`LazyForEach`因此保留旧Builder。实际392f候选中，两次点击同一书签都派发删除，原生行ID和树指纹保持原样。此次属于先前审计遗漏的已有问题。

当前键值加入已接纳行数据。选章、定位和滚动锚点继续使用业务行键。准确SDK回归检查实际键生成器、未变化行的稳定键、删除后的添加动作、下载排队后的禁用，并拒绝旧键值负例。原生Full与Quick都实际派发删除、添加、下载三次回调，计数分别为1、2、3，随后下载按钮禁用。首个会话在后续Quick入口未滚到可视区时停止，已通过的Full断言保留。第二个会话只补Quick。获准的32/40vp行高和26vp平面附属宽度继续保留。[准确SDK结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/implementation-continuation-flat-update-02.log) [原生状态更新结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-directory-flat-update-12cd.json)

书签验证夹具原来省略了当前内存owner的恢复投影，导致合法的默认只读状态遮住可写场景。现已补齐Full的`directoryRecovery`及Control的`bookmarkRecovery`，并通过公共目录port的`NoStructure`进入真实平面回退。新增入口限定在既有DEBUG验证菜单。首次编译发现Control属性名用错，失败候选未安装。回归现已断言两个消费者各自的真实属性名并拒绝错接。正常生产写入准入沿原业务owner执行。[最终夹具准确回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/implementation-continuation-directory-memory-05.log) [语义目录Full与Quick结果](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-directory-semantic-writable-392f.json)

TTS此前仅凭“准备中”和冻结的发起面板文本，无法判断当前引擎是否启动。现使用应用已有的`readerTtsTrace=true`入口，实际正常Sample EPUB收到五次当前会话`tts.platform-start`。第一次距播放意图1128ms、距dispatch769ms。Back后记录到host-stop、stop-ack、audio-release、listener-release及owner-release。此场景已回答当前平台启动与退出问题。原进度通过正常Slider恢复为0，语速1.00x、25分钟定时和原系统音色保留，最后冷启动恢复无追踪的正常书架。实际可听语音及其他播放状态仍分别验收。[平台回调与恢复记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-tts-platform-trace-12cd.json)

### 本节后续补证及UIF-14

减少动态效果开启后，正常下载筛选下拉、书源工具模式下拉及阅读顶部More三个宿主均完成原生打开和关闭。下载筛选实际从4/4变为1/4并恢复4/4，书源工具模式实际搜索→发现→搜索，深度“列表”和关键词“我的”保留。三处各取得8秒有界trace，当前采样的自定义动画计数均为0。该计数只描述采样，完整像素动效继续保留开放条件。书源工具返回后，`source-back:2:tools:header`实际focused为true。[下载宿主](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-reduce-motion-download-popup-12cd.json) [工具宿主及返回焦点](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-reduce-motion-tools-popup-12cd.json) [阅读顶部More](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-reduce-motion-reader-more-12cd.json)

正常漫画入口本次出现“章节加载失败”，保留原现象并保持重试和换源入口。源码确认目录准入独立于正文opened状态，随后沿正常目录→完整目录进入当前两章目录，实际下载popup可打开并由Back逐层返回。未执行任何下载或清理动作，漫画原100%、第2页和Sample EPUB原0%及继续阅读项均保持。此场景同时发现UIF-14。popup外层零时长transition已接通，内部`MangaDownloadOperationsPanel`仍缺少减少动态效果及前景约束。当前trace中的LoadingProgress813存在期间出现四个自定义动画，精确归属还需修复后的同场景对照。[当前漫画宿主与原始trace](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-reduce-motion-manga-popup-12cd.json)

UIF-14的三个生产输入现已补齐既有偏好传递、`foreground && !reduceMotion`加载约束和共享动作面的偏好。准确SDK回归覆盖两个正常父入口、当前LoadingProgress最终属性、实时偏好与前景变化、真实动作渲染器，以及三个漏接负例。旧popup回归同时修正了过期的Row/原生Button查找、实际最小高度承载和当前目录准入辅助，原失败日志保留。当前已安装候选仍为12cd，后继完整编译、签名及同场景VM对照待执行。[加载约束回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/implementation-continuation-manga-loading-03.log) [原popup生命周期回归](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/implementation-continuation-manga-popup-lifecycle-04.log)

### 当前交付身份

- 已安装`0.2.0.DEV.12cd63ffb89c`，运行清单`20261114T191217Z-8036ac9f-a152a7da`，保数据安装及启动通过。签名为既定`minliny_HarmonyOS`证书。signed HAP SHA-256为`2c65487628d65bb38f653c32de8f8c2584708f1a647b8612ab89b7fed3a69df3`。[不可变清单](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/hap/20261114T191217Z-8036ac9f-a152a7da/manifest.json)
- 12cd安装后，638个生产ETS/TS输入已与该候选逐一对账。相对392f，该候选唯一生产变化是Control平面列表的键值，其他637项相同。随后UIF-14修改三个漫画加载相关输入，当前需后继候选绑定。Toggle、分组、页头及TTS继续沿各自未受影响范围复用证据。[输入比对](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/current-code-byte-comparison-12cd.json) [实际变化范围](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/candidate-source-delta-392f-12cd.json)
- 原生会话最后恢复正常书架、Sample EPUB进度0、减少动态效果false和系统读屏OFF。字体原档2、粗细1、界面缩放1继续保留。本批租约均释放。编译日志仍含既有ArkTS警告，完整编译与签名结果为PASS。全量业务套件保持NOT_RUN。

### 未决内容及后续承担

| 内容 | 当前已经回答 | 仍需完成及原因 |
| --- | --- | --- |
| 原稿及紧凑目标 | 已找到TTS Make V17完整TSX。目录原始40高裁切行将44高响应投影到40，相邻目标重叠14。正常语义附属宽44、平面附属宽26分别核对 | 已获准保留的目录四工具32宽、Quick32/Full40行高及TTS Quick四个不足44的独立宽度继续登记容量冲突。现有布局决定已足够执行 |
| Toggle焦点 | 共享修复的默认无日志键盘加读屏连续两次换实例已通过。纯读屏场景实际绿色焦点落在Toggle，键盘focused为false | 一次VM双击注入返回成功，但checked、原生ID及前后树和屏幕指纹均相同，尚未触发onChange。需找到能实际派发原生无障碍激活的入口后验证换代。保留为未进入场景。[记录](/Users/minliny/Documents/Reader/.reader-isolated/framework-confluence-20261112/Reader-for-HarmonyOS/.reader-artifacts/app-ui-framework-audit-20261114/native-toggle-pure-reader-12cd.json) |
| 减少动态效果 | 九处接线、目录两条来源链及四个原生popup构造点已修复，准确SDK参数与拒旧通过。SourceTools登记中的旧“无偏好输入”描述已更正 | 不同原生popup宿主、偏好中途变化、动画收束和焦点仍由agent按准确场景补齐 |
| 移除确认纯高度变化 | 长文案、滚动到底和内存确认动作已有真实宿主结果，当前高度更新代码与拒旧回归已核对 | 仍需实际窗口仅改变高度的原生入口。现有WindowManagerService帮助只给dump，已试Multitask未建立有效调整路线。此条件继续追踪 |
| G05连续绘制 | 已取得有界ArkUI与RS trace。首次页头正文66→110跨两个UIvsync，命令提交相差6.791ms | trace不能回答实际显示像素是否闪动。应用录制已到隐私授权请求，未收到STARTED，现有独立C API创建亦失败。可用连续像素采集能力继续调查 |
| 读屏短反馈与TTS声音 | 短反馈显式宣告、当前owner及generation归属已接通。TTS实际onStart与停止释放已补齐 | 实际自动宣告听感、TTS可听输出及未覆盖播放状态仍需对应音频或原生回执 |
| 全应用剩余登记 | 正式21项仍按各层保存原判定，输入漂移为0。局部新通过结果逐项补入 | 整页字形、裁切、材质、主题、方向、目标命中和状态覆盖仍由agent继续核对。完整独立视觉依据与原生矩阵尚未齐全，visual21项NOT_RUN及其余原FAIL保持原含义 |
| G10历史Tab归因 | 已核当前代码与现有历史材料 | 异常同期原始录像、trace或绘制数据仍缺。用户已决定沿现有资料推进，按原条件保留该缺口 |

后续各节保留c96f及更早候选的局部历史证据。当前候选、修复与未决状态以本节及完整账本`implementation.completionCorrection20261115`为准。

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
