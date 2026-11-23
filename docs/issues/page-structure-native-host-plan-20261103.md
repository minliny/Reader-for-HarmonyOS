# E2/E3 原生宿主取证计划

> 2026-11-12整合候选采用PR #22新职责结构及配套Core/UI。旧HAP与旧Native回执保持原绑定。本轮原生计划见[合流实施记录](../architecture/framework-confluence-20261112.md)，现场目标、ABI、系统字号及保数据准入重新核对。原同实例截图、触摸、返回、焦点及字号恢复授权继续按用户限定范围执行。

状态：`HAP6_INSTALL_START_AND_DIAGNOSTIC_ROUTE_PASS / SOURCE_SCALE1_GLYPH_LOCAL_PASS / HAP7_SIGNED_READY_INSTALLING / E2_E3_OPEN`。HAP6已进入诊断菜单与Source；局部中文/英文生产字形正确，实测Area365.714×809.143、scale1。夹具Root漏top safe使页头被状态栏遮挡，已由SourceOwner做Root-only代码修复并通过30个safe-area SDK上下文；含该修复的HAP7已完整编译/签名PASS，canonical安装进行中，修后baseline待复核。不把这段局部证据扩写为全页字形、目标命中、四档字号或全层通过。

当前可审阅候选：HAP7 run `20261103T120548Z-fce869a1-5f3233de`；不可变[manifest](../../.reader-artifacts/page-structure-final-20261103/hap/20261103T120548Z-fce869a1-5f3233de/manifest.json)。signed HAP SHA-256 `0a1ced9d7a44ada8dff7b50512d2877224dede490604e67a7a90731404123457`，214689523 bytes；完整ArkTS/非增量编译与指定签名PASS，证书仍为`minliny_HarmonyOS`，包名`io.reader.minliny`。本计划更新时安装仍进行中；没有该新run部署回执便不称已装。HAP5/HAP6原manifest与失败/成功记录保留，HAP6安装启动及诊断路由通过见下节。只消费当前manifest绑定产物，不从entry/build选包；因Root safe-area生产输入变化重建是新候选，不是同字节重复构建。

用户已明确回复“允许按上述范围执行”，已放开此前只读限制。已授权的具体范围为：同一实例准确目标发现/Ready核对、规范停写备份与保数据更新、启动、基线和一次真实大字号、正确生产字形、仅内存组件的触摸/Back/焦点取证及字号恢复；不卸载、清数据、创建/重置VM、真实登录提交或文件写入。签名和保数据准入独立，任一缺失即停。短模式增量已完成本地验证并发布上述新候选，现按此同一范围执行；授权不等于设备、字号或交互已通过，也不授权列出的破坏性动作。

## 已排除与当前候选

- CPU Previewer原路径：既有记录已经证实系统字号setter无效、fp2px/vp2px未反映所设scale，以及生产变量字体字形绘制异常。日志、帧与工具链/字体指纹保留；本轮不重试，不换字体、不把文字metrics算实际渲染。
- 前一轮“现有实例镜像缺失”的判断已撤回：当时只拼接config.ini中的sdkPath/imageSubPath，未核hardware-qemu.ini的实际路径。用户授权只读核对后确认实际镜像在用户SDK目录，7.0.0的system/vendor/userdata/sys_prod等文件存在，并被当前Emulator进程打开。没有更换镜像或创建/重置实例；只读启动检查另见末节。
- 当前HarmonyOS SDK的Configuration声明有fontSizeScale；产品EntryAbility在configuration update触发ReaderWindowCoordinator刷新，后者实际systemFontScale来源为display.scaledDensity / density。API存在不证明设备能设置全部四个字号，必须在真实宿主核对读回。
- 历史只读阶段的基础运行核对已完成；用户随后明确扩展了安装/启动/截图触摸/Back焦点/真实字号及恢复的同实例范围，不再重复询问同范围。HAP5/HAP6安装与普通启动已过，HAP6还已进入诊断菜单/Source并观测局部scale1字形；真实字号修改及完整页面目标证据尚未完成，基础Ready或安装不推导E2/E3。

## 当前候选的安全组件路线（2026-11-03）

本轮代码已增加仅debug准入的`ReaderPageStructureVerification`，复用诊断菜单入口；release直达拒绝，不新增产品路由。已有debug冷启动参数仍须以实际Want观测核对，不能从aa命令成功推导目标页已挂载。所有被测页面等待真实`prepareReaderFonts` checked回执后挂载，下载另等待其原字体准备。宽度320/366只是外层请求值，实际Area与真实WindowCoordinator系统scale另记，不注入字号、不换生产字体。源码/SDK已过，不代表以下原生路线已执行。

| 组件路线 | 实际宿主 | 安全范围与证明边界 |
|---|---|---|
| 书源默认/空/未知回执/忙碌 | 真实SourceManagementPage | 内存书源及回执投影；按钮记录意图，不发网络、登录或原写；平台登录和真实业务回执另验 |
| 详情完整目录/阅读完整目录/漫画目录 | 真实页面与当前Tree目录渲染 | 注入薄NavigationPort，真实条目/命中/滚动装配，内存章节；不替换Runtime单例，不宣称Core查询/下载已验 |
| 阅读控制目录展开/收拢 | 真实ReaderControlDirectoryContent | 仅内容slot；没有生产Header/手势Stage，不能据此关闭控制外壳、手势和动效验收 |
| 下载普通/管理/章节/设置 | 真实SharedDownloadPage | 内存书籍、队列、存储策略；点击只改内存/记意图，不操作用户下载/文件 |
| 书源工具/选择/编辑/任务结果 | 真实SourceToolsPage | JSON与选择是内存；保存/删除/导出回调只记意图；现有原生导出确认仍可出现，平台确认结果不能当文件落盘证据 |

所有入口、菜单和临时Back都捕获presentation/身份并在退场后拒绝旧回调。目录与工具没有的Back消费能力不在夹具里虚构。源码/测试/消息登记的冻结结果见实施方案14.19–14.25及各分批manifest，实际签名HAP另由规范pipeline发布。

隔离边界只在组件及其按钮回调：既有EntryAbility.onCreate即使选择诊断冷启动页也会安装ReaderRuntimeOwner，并执行原启动/恢复/主题等流程。组件不创建Runtime/Host、不发业务RPC，不能外推为整个App启动不会读取或更新用户存储。不换包名或另造空数据库；安装的正常停写、完整备份和兼容准入由pipeline完成，启动沿已获授权单独记录，不把内存夹具当真实业务回执。root添加的EntryAbility安全telemetry已随HAP6发布并帮助确认实际boolean/exacttrue/Pilot分支；当前HAP7再包含夹具Root安全区修复。这些是候选输入变化，不是夹具获得业务或用户存储owner。

实际平台服务已做代码侧审查：ArkWeb登录即使假profile也可能加载、清理并持久化共享CookieSessionStore；文件保存任一返回URI后会CREATE/TRUNC写入。因此安全夹具不调用这两条服务。要验真实登录Back/文件取消，必须使用真实业务身份和单独限定的路径；不能用example.invalid和空JSON宣称无持久副作用，也不新增旁路原生API伪造通过。

## 取证要回答的最小问题

1. 当前生产字体是否在该宿主正确绘制，且系统设置变化确实传入display.scaledDensity/density和当前Text节点？先做一次基线及一次可达大字号；若变量字体仍失败或字号读回无变化，立即停止后续矩阵，不重复相同故障。
2. 基线通过后，核对1/1.3/1.6/2四点是否由真实系统设置到达；不可达点记UNSUPPORTED/NOT_RUN，不能用AppStorage注入或替代字体补齐。
3. 在实际320/366vp窗口中，完整目标清单的边缘触摸是否派发到唯一当前owner；responseRegion是否被祖先裁剪、遮挡或与相邻目标重叠？只读/无持久副作用动作优先验证（筛选、展开、关闭、输入焦点）。检测/登录/开关和恢复动作若有真实业务副作用，先约定准确夹具与原操作状态，不随意操作用户书源。
4. 正确字形下的三种行形态、筛选、页脚、分组选择、恢复通知是否有截断、重叠、目标丢失；返回后旧回调/焦点是否进入新presentation？不能用局部SDK声明尺寸回答。

## 已授权范围内的有界步骤

1. 继续使用用户已指定并授权的同一现有模拟器及准确目标；同范围不再问。HAP6诊断路由已确认进入，当前按HAP7的Root安全区修复候选先复核baseline；前提通过后才按既定顺序核真实大字号及目标。新增或超出既有范围的动作另行裁决。
2. 只读发现经reader-hdc-lease，清除代理并核实际直连/server/target/占用；模拟器另核bootCompleted、Guest OS Boot Completed和SceneBoard稳定。目标不Ready或存在活动owner时停止，不重启/清理设备。
3. 使用本轮冻结源码、匹配Core/Native、唯一指定证书与Profile，通过规范pipeline准备独立候选manifest。若准确输入/产物已有匹配证据则复用，不因取证重跑业务全量。构建、验签、保数据准入、安装分别记录；不消费旧或来源未绑定HAP。
4. 若需要覆盖安装，按pipeline的原应用停止态写屏障和数据保护要求执行；缺少sandbox/配套只读inspector或身份不匹配则停止。不得卸载、清数据、换包名或证书。
5. 第一阶段只采基线和一次真实大字号；确认字形和字号通路后再按问题扩为完整矩阵。每次采样绑定source/HAP/字体/实际width/实际scale/操作owner，不只保存JPEG。
6. 一项明确失败即停止该分支，保留日志和失败帧先代码定位；UI查找/滚动有界，租约空闲不超过60秒、会话不超过10分钟，普通命令/传输/安装分别遵循既定时限。字号变更记录原值并恢复，无法恢复时明确报告，不自行重置系统。

## 预期回执

候选manifest与精确字节、真实宿主与系统版本（公开说明不暴露实体标识）、系统字号设置及两层实际读回、正确生产字体的原始帧、各目标边缘触摸/唯一回调、局部布局/内容状态、原值恢复、已执行和未执行项。E2/E3按各自证据单独裁决；HAP成功、安装成功或单帧可见均不能自动关闭。

页面取证已获本文首部列出的具体动作授权；原只读与新增同实例授权持续有效，同范围不再确认。授权不会把代码/SDK、安装或命令成功转为原生页面验收。

## HAP5/HAP6交付、HAP7当前分支与原始路由事实（2026-11-03）

- 规范pipeline的[部署回执](../../.reader-artifacts/page-structure-final-20261103/hap/20261103T112329Z-fce869a1-29af95b2/deploy-vm-6460677a198b-20261103T113814Z.json)记录 `dataPolicy=preserve`、匹配inspector的 `storageAdmission=READY`、停写备份/最终重核与replace完成、`install=PASS`、`launch=PASS`。此处不读取或披露备份数据库内容。
- HAP5后续一次带已有debug参数的冷启动没有进入目标Pilot/验证页。新 `onCreate` PID26211在19:41:18.972之后形成完整启动seq1→46、一次loadContent并到shelf.query，settled UI仍为Index。HAP5原因仍 `UNKNOWN`；不拿HAP6后来的成功反推旧原因。
- 路由只读观测首次sandbox HDC虽然status0，却返回 `Connect server failed`，保持原FAIL；受审后通过同一server租约的第二次观测完成，见[attempt2原回执](../../.reader-artifacts/page-structure-native-final-20261103/route-observation-attempt2.json)。不因此重启服务、换目标、反复安装或把它判为设备故障。
- 当前设备 `aa start -h` 明确支持 `--pb` boolean。读取installed公共HAP SHA返回PermissionDenied；未提权、未读取DB、未更改数据。发布HAP候选字节与实际安装回执已分别绑定，不据此声称已直接读回installed文件SHA。
- 离线[路由审计](../../.reader-artifacts/cold-pilot-route-audit-20261103/audit.json)及[观测更正](../../.reader-artifacts/cold-pilot-route-audit-20261103/cold-observation-and-import-update.json)保留原结论演进。HAP6 run `20261103T115722Z-fce869a1-97b634e3`、signed SHA `b08d77ebf3fdb095f5275dda3969a8a4e5b62488867b2c46258112e063afa473` 的install/start均PASS；PID退出屏障后的冷启动日志给出rendererType boolean/exacttrue/Pilot，随后实际进入component menu与Source，路由观测缺口在该候选已闭合。安全telemetry不输出完整Want、凭据或用户数据。
- HAP6 Source局部scale1中文/英文字形可读、实际Area与scale已记录，见[source baseline](../../.reader-artifacts/page-structure-native-final-20261103/source-baseline.json)。当时Root缺top safe导致Header遮挡，不能当完整baseline PASS；Root-only修复SHA `fa365…`及safe-area30上下文SDK结果由SourceOwner另账。当前HAP7已签名发布并安装中，修后baseline未复核前不扩大采样。
- 真实Settings字体UI已进入并settled可用：原字号“标准”（Slider2）、字体粗细“标准”（Slider1）、显示缩放“默认”（Slider1）；尚未修改。阶位读数不是scale倍率，不存在由初始启动慢推导Settings不支持的判断。原值后续必须恢复并留回执。
- 整页E2/E3、真实大字号通路、边缘触摸、页面Back/焦点仍OPEN/未完成；不把局部scale1字形、命令成功或安装成功推成全层PASS。

## 现有模拟器只读核对结果（历史基础阶段，保留原时点）

2026-11-03：现有Mate 90 Pro实例对应当前Emulator进程；实际打开用户SDK的HarmonyOS7.0.0镜像及该实例的qcow2数据层，镜像metadata为7.0.0.107/API26。这里只证明文件存在/运行路径，没有对多GB镜像做完整字节或签名验收。

HDC实际listener为本地127.0.0.1:8710，客户端/server到VM均走127.0.0.1回环；route显示lo0，server→VM为ESTABLISHED，VM端口由同一Emulator持有。经标准租约发现该VM为Connected，其他目标未接触。首次sandbox客户端10秒超时后，最小TCP诊断返回EPERM；保留失败，在只读授权下通过受审的非sandbox执行成功，不重启服务或自动重连。

同一准确VM/server租约内读取：bootCompleted=true、bootId、uptime，以及间隔1秒两次SceneBoard PID/bootId；PID和boot身份一致。当前Emulator日志在本次宿主启动之后有Guest OS Boot Completed，最新boot标记之后未发现该日志中的已知reset/SceneBoard/kernel异常。结论仅为`BASIC_GUEST_READINESS_PASS`，不声称完整guest日志无异常、Reader可用或生产字形正确。会话结束后租约释放。

原始结果与失败回执保存在`.reader-artifacts/page-structure-native-host-inspect-20261103/`。本次未停止或启动任何VM/HDC/App，未构建、签名、安装、截图、触摸或修改字号；页面E2/E3仍FAIL。
