# 翻页与控制栏修复：当前问题、实现及验证总账

当前状态：**继续执行中，未将全量验收标为完成**。截至本报告更新，原52项全部保留；本轮扩大回归又定位并修复了滚动内边距坐标、滚动首指占用、缓存淘汰后上一章无法加载三项遗漏。只使用现有 VM，保留书架、进度和配置，未使用已释放的真机。

## 当前候选与证据边界

- Run：`20260911T051040Z-35f2f99a-5da12a49`；[manifest](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-artifacts/hap/20260911T051040Z-35f2f99a-5da12a49/manifest.json)；signed debug SHA-256：`2cd9b1464088125792a9f4fd14d9bb38b8f3991beea21821e279c4693179057a`。
- 181组Harmony检查、Native solver235 / motion538 / renderer373 / barrier177、ArkTS/Native编译及独立签名复验通过。Iteration，`acceptanceEligible=false`。
- 保数据安装到 Mate 80 Pro VM（`127.0.0.1:5555`）通过：[部署回执](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-artifacts/hap/20260911T051040Z-35f2f99a-5da12a49/deploy-vm-6460677a198b-20260911T051321Z.json)；[当前候选证据](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/evidence/2026-09-10-page-turn-vm-followup/repair-validation-5da12a49)。VM交互仍在执行。
- 当前候选初检512份源文件、223份控制文件无漂移。Harmony HEAD `35f2f99a8d635615475fde75120bf8629f944565`、Core HEAD `6b2a9d87048e3da812bec08b7c2b3fff1c16e2e2`。共享工作区有大量既存和并行改动；本任务未修改Core业务，不能把整个dirty差异归于本任务。
- 具体样本必须归属各自候选。90be→78b只改滚动组件及其测试；78b→5da改滚动输入与邻章读取及测试。下述旧候选数据没有改标为当前包实测。

## 已落实的修复

1. Native首帧、收尾帧、隐藏、清理与输入释放分阶段；输入和清理均按代次/表面身份校验。上传解锁期间出现同槽或另一槽新纹理时重算ready mask，上传失败不放行旧像素。
2. 平移/覆盖固定a/b物理节点，晋升只旋转角色；保留刚离开视野的页面，页面投影和provider按revision读取。静态截图ID固定到物理节点，修复晋升后时钟刷新捕获空reserve的问题。
3. MOVE处理使用轻量准入和一个watchdog，VSync消费最新样本，UP归入最终坐标，去除24ms回放。旧队列、Auto Page、音量键均走首指占用；滚动List也已接入DOWN/UP/CANCEL及失能、章节切换和消失清理。
4. 纹理复制改在Native worker读取；回UI后重验截图代次/指针/布局/生命周期，再送入仍校验surfaceEpoch的Native队列。Native启用O2；移除无用途的整页Canvas；页眉测量跨离屏实例使用有界LRU。
5. 控制栏复用完整端点几何、paint和字体顺序；复杂session保留为普通决策状态，界面只观察必要标量和稳定路由，避免每帧触发整个模块分支。清晰度平台已消除，自动曲线覆盖完整轴，保留actor空间轨迹与手势速度续接。
6. 滚动scalar采用最近量化；恢复跨布局阶段隔离早到stop/save；未测量行不写零锚点。保存与恢复统一以正文内边距为原点，图片fraction使用同一原点。
7. 前一章被三章缓存淘汰后，按需重新读取并去重；仅匹配页/代次/生命周期的结果恢复准备。失败保留原页和意图，迟到结果不替换当前章，后续显式请求可重试。

## VM中新发现的问题及闭环进度

| 项目 | 复现 | 修复与复验 | 当前边界 |
|---|---|---|---|
| 滚动第一次重进偏移 | 90be首次短滚恢复45px；此后8次重进却均0px，说明只测重复重进会漏掉问题 | 78b改内边距原点后，四距离-3/0/0/4px，随后8次均0px | 当前TXT/当前布局在8px阈值内；图片、字体、章尾另验 |
| 缓存淘汰后上一章无响应 | 78b连续向后100页正文连续；返回第5次停在第25章首，等待后仍不动 | 5da同点25→24章末→25已恢复，往返原文一致 | 四模式连续100页长跑正在重跑 |
| 滚动静止按住缺少占用 | 源码连接审计确认原生List未登记DOWN，共用队列可进入 | 5da已接入共用占用，生产逻辑测试涵盖额外手指、UP/CANCEL/disable/unmount和晚drain | 当前VM的Auto Page/音量键组合待补 |
| 首次滚动恢复提前保存 | 8305重复重进曾跳1192px | 48bf布局阶段隔离后8次0px；进一步由90be发现上述内边距遗漏 | 历史修复不等于所有锚点已通过 |
| 分钟边界仿真空纸 | 48bf晋升后分钟刷新捕获空当前页 | cb19557b物理ID修复后正面/背面/底页有正文，时钟同为10:28 | 当前候选双向与图片/夜间矩阵待补 |

## 控制栏与Native性能证据

90be的七个模块均完成打开、拖动展开、自动展开、自动收起、拖动关闭，端点检查通过。37段trace中的各操作最大UI OnVsync任务如下（ms；guest wall time，含未调度时间）：

| 模块 | 打开 | 拖动展开 | 自动展开 | 收起 | 关闭 |
|---|---:|---:|---:|---:|---:|
| 外观 | 6.852 | 8.946 | 8.959 | 9.727 | 12.263 |
| 自动翻页 | 12.441 | 8.294 | 8.452 | 7.662 | 6.266 |
| 目录 | 13.804 | 21.452 | 8.023 | 5.951 | 9.771 |
| 替换 | 10.722 | 12.683 | 4.529 | 5.904 | 10.766 |
| 搜索 | 7.341 | 15.072 | 7.155 | 8.331 | 5.743 |
| 设置 | 10.458 | 26.771 | 6.448 | 6.608 | 9.916 |
| 朗读 | 7.157 | 11.926 | 9.494 | 12.494 | 3.807 |

目录21.452ms中guest调度14.744ms、未调度6.708ms，GC占13.439ms wall；设置26.771ms中调度16.640ms、未调度10.131ms，GC占14.671ms wall。**这两次超预算帧仍保留，不能宣布完全没有卡顿。** 对应036朗读打开28.439ms、收起26.461ms，修复观察依赖后90be样本改善；书籍冷热状态及VM调度不同，不是严格A/B、p95/p99或用户观感验收。

90be仿真next/previous最大UI任务15.914/14.414ms。PixelMap确在worker复制；previous样本2.808–12.441ms，转换1.991–2.238ms。UI完成回调1.089–5.464ms；上传wall仍含等待，未取得GPU完成时间。8305平移样本当前正文Build/Destroy为0；Native路径的离屏截图组件Build/Destroy不能混算为当前正文重挂载。证据见 [trace分析](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/evidence/2026-09-10-page-turn-vm-followup/repair-validation-90be6e9c/trace-analysis.json) 和 [Native分段](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/evidence/2026-09-10-page-turn-vm-followup/repair-validation-90be6e9c/native-upload-summary.json)。

036在同一PID中四模式共800次同章扫动（各方向100次/模式）正文核对通过，PSS依次466157、459362、461020、460848、455814KiB。Heap allocated从96298增加至110428KiB，所以只证明这些PSS快照没有持续增长，**不证明无泄漏、无分配峰值或实机热稳定**。此批只在十页章内扫动，不是连续100个不同页。

90be四模式共24个稀疏UP/双指/三指动作及12次Home→前台循环通过。稀疏UP不是移动后QuietHold；普通Home恢复不是Surface强制丢失。5da连续不同页长跑另记。

## 原52项当前总账

“已实现”是代码状态；VM列只承认具名样本，保留项不得从总账消失。原始编号与问题定义见文末实施前审计。

| 编号 | 代码状态 | 已完成与证据 | 尚未关闭 |
|---|---|---|---|
| F01 | RETAINED；VM PARTIAL | 可见期间不提交透明初始化/清理帧；Native GL 状态与交接回归通过。 | 文本页曲面中间样本已取得；全主题/图片/实际显示逐帧矩阵仍需独立证据。 |
| F02 | IMPLEMENTED；VM PARTIAL | 隐藏、清理、释放输入分阶段；清理失败不让新事务覆盖，177项 barrier 检查通过。 | N08没有实际显示 fence；不能把调度回调计数视作送显确认。 |
| F03 | IMPLEMENTED；VM PARTIAL | 首帧按代次准入；模式切换正常 SurfaceLost 不再禁用仿真；90be四模式各3次前后台同PID正文恢复通过。 | 强制 Surface 销毁/重建及迟到回执的完整 VM 故障矩阵。 |
| F04 | IMPLEMENTED；VM PARTIAL | 事务 source/destination 固定，成功后旋转物理槽；已修空底页与物理截图ID，双向文本中间帧有正文。 | 图片、回滚、提交各阶段实际像素覆盖仍未齐全。 |
| F05 | IMPLEMENTED；VM PARTIAL | 平移/覆盖固定 a/b 两物理节点；退出视野内容保留，provider 按 revision 缓存；8305平移正文 Build/Destroy=0。 | 快速交错与全部内容类型下的实例计数；离屏截图组件生命周期不能混算为当前正文重挂载。 |
| F06 | RETAINED；VM PARTIAL | 不透明主题底与统一呈现阶段保留；四分页效果的实选切换和正文往返已验证。 | 夜间/图片/字体与模式交错的完整像素矩阵。 |
| F07 | IMPLEMENTED；VM OPEN | 静态快照排除高亮；ArkUI 字符矩形同步 Native 动态着色。 | 高亮与卷页、终帧的像素连续性。 |
| F08 | VALIDATION；VM PARTIAL | 五模式普通路径已有VM证据；90be四模式稀疏UP、多指、12次前后台通过；78b滚动四距离及8次重进通过；5da长跨章复验进行中。 | 失败/未知写结果、旋转、强制Surface丢失和全视觉矩阵仍未齐全，不能宣布全验收。 |
| F09 | RETAINED；VM OPEN | 阴影混合保留目标 alpha，GL 状态测试通过。 | 合成链 alpha 和局部闪烁实测。 |
| C01 | PARTIAL；VM PARTIAL | Panel 复杂时钟对象改为普通决策状态；界面只观察进度/可见度/占用标量和稳定路由；90be七模块操作端点通过。 | 90be目录拖动21.452ms、设置拖动26.771ms仍超16.67ms；GC与guest未调度时间均有贡献。 |
| C02 | IMPLEMENTED；VM PARTIAL | 同帧几何、完整端点、字体顺序缓存；页眉跨离屏实例64项LRU；生产缓存失效用例通过。 | 完整分配峰值和低端实机预算未测；不能用单次改善代替p95/p99。 |
| C03 | PARTIAL；VM PARTIAL | 稳定语义路由避免每帧触发整个模块分支，按标量发布actor变化，保留真实文字重排。 | 剩余宽高布局/GC预算继续保留；90be七模块最大值分操作列在trace报告。 |
| C04 | IMPLEMENTED；VM PARTIAL | 目录稳定行锚点与一帧一次必要修正已实现；七模块普通展开/收起端点通过。 | 150章深滚、排序筛选、反向与再抓的VM组合验证进行中。 |
| C05 | IMPLEMENTED；VM PARTIAL | 稳定行key与逐行差异通知，内容变化和视觉进度分离。 | 大目录、书签筛选排序/删除及迟到数据的VM矩阵尚未完成；保留全部项目。 |
| C06 | IMPLEMENTED；VM PARTIAL | 已消除20%–80%清晰度平台；自动展开/收起使用完整smoothstep轴，保留actor轨迹、320/260ms时长与手势速度续接。 | 749采样中段非空；当前包p约.2/.5/.8、反向、10次再抓及完整连续画面仍待采集，不能标全程流畅。 |
| C07 | PARTIAL；VM PARTIAL | 去重复裁剪、交互避让邻页任务；普通与静态离屏页不再创建无用整页Canvas。 | 余下滤镜、宽高布局及GPU完成耗时没有完整预算；两次GC长帧仍保留。 |
| C08 | SEMANTIC；VM OPEN | 保留最近书签原选择规则，未把歧义直接当缺陷修改。 | 确认产品最近书签是否指当前 scalar 距离。 |
| N01 | IMPLEMENTED；VM PARTIAL | 24ms回放已移除，Native VSync取最新有效样本；90be双向UI窗口峰值15.914/14.414ms。 | 这是guest UI任务短样本，不是输入到屏幕延迟或120Hz验收。 |
| N02 | IMPLEMENTED；VM PARTIAL | 内侧/边缘起手与再抓共用相对锚点；双向正常拖动已执行。 | 精确移动后无MOVE的QuietHold输入器不可用；轨迹反向/再抓完整矩阵待补。 |
| N03 | IMPLEMENTED；VM PARTIAL | endGesture原子消费最终位置；90be四模式仅UP位置跨阈值双向各1例通过，额外手指不结束首指。 | 真实乱序/CANCEL仍以生产逻辑用例为主，未覆盖所有系统事件。 |
| N04 | IMPLEMENTED；VM PARTIAL | 同事务拖动到收尾保持 Native 可见。 | 同版本首/终帧及回滚实测。 |
| N05 | IMPLEMENTED；VM OPEN | 80–320ms 手动收尾、已到端点立即结束；提交前按已提交姿态再抓。 | 不同时间点反复再抓和位置/倾角连续性。 |
| N06 | IMPLEMENTED；VM PARTIAL | 事务纹理及代次保护保留；已补上传中同槽/异槽pending重检与失败纹理失效，177项检查通过。 | 跨章及失败回滚资源寿命的完整VM统计。 |
| N07 | IMPLEMENTED；VM PARTIAL | 当前/请求方向优先；静态捕获按物理槽位，mounted内容revision门禁；新增被淘汰邻章按需加载。 | 冷远程章/图片的起手延迟与快照成本分布未全测；5da长跨章进行中。 |
| N08 | PARTIAL；VM OPEN | 区分 buffer submit 与 ArkUI 内容准备；保留不透明终帧并校验 revision。 | 仍使用 postFrame 调度交接，没有显示 fence；固定帧数不构成实际上屏证明。 |
| N09 | IMPLEMENTED；VM OPEN | 字符矩形、Canvas 正文混色和 Native UV 高亮；64 矩形上限与显式降级，无全页重复上传。 | SDK glyph 矩形、中文字体/图片/夜间、GPU shader 及像素实测。 |
| N10 | PARTIAL；VM PARTIAL | 时钟与胶囊几何进入纹理身份，分钟空闲刷新；修复晋升后角色ID错绑导致当前快照空白。cb19557b同类分钟样本10:28一致。 | 当前候选双向分钟边界/图片/夜间像素矩阵待补；颜色空间/过滤/端点暗带与fallback仍未完整实测。 |
| N11 | PARTIAL；VM PARTIAL | PixelMap在Native worker读取，UI完成时重验代次/指针/布局/生命周期后排队；Native O2；移除多余Canvas。 | 90be worker拷贝2.808–12.441ms、转换1.991–2.238ms（previous）；UI完成1.089–5.464ms。上传wall含等待，GPU完成仍未测。 |
| N12 | IMPLEMENTED；VM OPEN | V2.1 普通程序化 320ms、积压 rapid 180ms 上限；移除旧隐式平移动画注册。 | ≥4.5页/秒是包含保存及交接的目标，尚未实测达标。 |
| N13 | PARTIAL；VM PARTIAL | 固定纹理/网格/有界LRU；036同PID800次往返PSS466157→455814KiB，过程无持续PSS上升。 | Heap allocated 96298→110428KiB；不得宣布无泄漏。全分配峰值、120Hz、长时温升功耗未测。 |
| N14 | IMPLEMENTED；VM PARTIAL | 统一代次、surfaceEpoch和lifecycle；worker迟到拒绝入队并释放资源；90be四模式前后台同PID恢复通过。 | 旋转、强制Surface丢失/重建、进程终止等仍需分别验证。 |
| N15 | IMPLEMENTED；VM OPEN | SLOTS_COMMITTED 只做逻辑提交，TERMINAL_RELEASED 后恢复后续绘制。 | A 清理/B 首帧交错、丢回执及 Surface 重建实测。 |
| P01 | IMPLEMENTED；VM OPEN | 未就绪保留首指与意图，ready 后按当前位置重新锚定，不补播旧位移。 | QuietHold 无 MOVE、冷页、抬手及取消 VM 回归。 |
| P02 | IMPLEMENTED；VM PARTIAL | 最终UP先归入手势再判点击/拖动；90be四模式仅UP变更坐标的next/previous共8例通过。 | 极稀疏反向轨迹与真实系统CANCEL组合仍待覆盖。 |
| P03 | IMPLEMENTED；VM OPEN | 纵向上一页位移映射到正确 X；最终 offset 连续。 | 平移/覆盖纵向路径实测。 |
| P04 | IMPLEMENTED；VM PARTIAL | none取消立即复位；四模式切换及none正常正文往返通过。 | 真实系统CANCEL没有可用公共注入入口；代码取消路径用例通过不等于设备全验收。 |
| P05 | IMPLEMENTED；VM OPEN | 权威边界在入队前判断，不能抵消反向有效请求。 | 首尾和净目标组合 VM 回归。 |
| P06 | IMPLEMENTED；VM PARTIAL | 两个固定物理页、promotion保留反向页，固定current-page-a/b截图ID；036四模式800次正文稳定检查通过。 | 036是十页同章扫动，5da不同页长跨章往返正在执行；还需异常交错实例统计。 |
| P07 | IMPLEMENTED；VM OPEN | 未知写结果先串行查询 Core；目标确认提交、原页确认回滚、未知保持并仅重试读取。 | 本地 lost reply/foreign/unavailable 通过；真实慢存储/故障注入未验。Core get/update 同 latency FIFO，无新造 source-switch transactionId。 |
| P08 | PARTIAL；VM PARTIAL | 冻结投影/revision/provider和稳定物理槽已落实；原案例重新核实为真机《绍宋》第34章6/11页44%。 | 原案缺少当时权威scalar/layout identity，且真机已释放。VM自建书原文oracle不能替代原案关闭。另发现的被淘汰前章卡住已独立修复。 |
| P09 | IMPLEMENTED；VM PARTIAL | 无动画复用预准备页并等权威保存；补齐缺失邻章读取，保留原页和待处理方向。 | 点击到ready、慢保存和跨章的完整时间分布仍待测；各包功能样本分开记录。 |
| P10 | IMPLEMENTED；VM PARTIAL | 请求方向优先，前驱前缀续算；补修前章缓存淘汰后prepare直接放弃的缺口，去重读取并拒绝旧代次/旧页/旧生命周期结果。 | 5da原失败25→24末→25已通过；四模式100页长往返进行中，冷远程章时延尚未全测。 |
| P11 | PARTIAL；VM OPEN | 冷指针续接及旧请求绕过 lease 的确定性路径已修。 | 不能用单一修复解释全部用户反馈；仍按住但无新 MOVE 的真实响应待 VM。 |
| P12 | IMPLEMENTED；VM PARTIAL | 冻结两页/布局、索引二分、稳定provider；8305平移当前正文重挂载计数0，90be控制观察依赖进一步拆分。 | 全部内容类型的GC/分配/UI+GPU预算未齐全，不能由单一trace推出全模式跟手。 |
| P13 | IMPLEMENTED；VM PARTIAL | 分页DOWN统一首指占用；新增滚动List接入同一acquire/release，UP/CANCEL/disable/chapter/disappear释放；生产逻辑回归通过。 | 90be分页2/3指双向通过；5da滚动与Auto Page/音量键实测待补。036同章800通过；78b连续next100通过、reverse第5次FAIL；5da修复后长跑进行中。 |
| P14 | IMPLEMENTED；VM PARTIAL | 首次授予完整准入、MOVE轻量检查、每手势一个watchdog；90be普通/稀疏/多指路径及前后台通过。 | 真正长时间无MOVE、超时恢复和全部输入源冲突的VM证据未齐全。 |
| P15 | IMPLEMENTED；VM OPEN | 统一单调时间，异常时间重建速度样本基线。 | 设备事件/VSync 时钟关联，不把本地注入当现实异常发生率。 |
| R01 | PARTIAL；VM PARTIAL | 同条目段内scalar用最近量化，恢复分布局阶段防提前保存；新增按List正文内边距统一坐标原点，修复positive-y被夹为零。 | 78b四距离恢复-3/0/0/4px，8次重进0px；图片/字体变化的精确字形锚点与章尾组合仍待补。 |
| R02 | IMPLEMENTED；VM PARTIAL | awaitable保存drain及晚回执校验，恢复期间停止回调禁止提前覆写；78b短滚退出及8次重进通过。 | 真实慢写/失败提示/重试/退出中止仍以生产逻辑用例为主。 |
| R03 | IMPLEMENTED；VM PARTIAL | 图片fragment+fraction补偿与并发手动位移保留；fraction已统一正文内边距坐标。 | 图片测试EPUB已通过正常应用导入；当前候选图片视口、跨章、异步重排的VM实测待补。 |
| R04 | IMPLEMENTED；VM PARTIAL | 额外指针不夺取/结束首指；新增原生List DOWN到UP/CANCEL共享占用，失能和章节/生命周期切换释放。 | 90be分页2/3指双向通过；5da原生List多指与程序化请求组合待补。 |
| R05 | IMPLEMENTED；VM OPEN | 滚动返回上一章直接请求章节尾部，最终保存实际首可见位置。 | 超长章耗时、尾部实际视口及恢复验证。 |

## 无法由当前VM直接替代的项目

- 精确移动后停住、仍按住且无新MOVE：现有独立ELF在main前被依赖库权限拒绝，暂停uinput自身子进程也被guest拒绝；未尝试绕过。`-k`仍发送MOVE，主机静默不证明guest静默。上述失败样本不计通过。
- 实际显示fence：当前postFrame、mounted内容revision、eglSwapBuffers仅证明调度/内容交付/提交阶段，不能等同真实显示回执。N08继续开放。
- 原P08是**真机《绍宋》第34章6/11页、44%**，不是《诡秘之主》或VM缩进书。当时缺少权威scalar和layout identity；用户已释放真机，新VM样本不能冒充原案关闭。
- 120Hz、物理触控到光子、温升/功耗、低端机以及最终用户手感验收，需要相应设备与条件。
- “最近书签”的产品语义仍未确认，保持原规则，不把选择歧义强行改成距离最近。

当前候选仍在测试。完成后的VM释放、源文件末次复核和剩余项会写回本报告及 [execution-status.json](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/evidence/2026-09-10-page-turn-physical-b1f20b88963d/execution-status.json)。[此前执行记录](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/evidence/2026-09-10-page-turn-physical-b1f20b88963d/EXECUTION_HISTORY_THROUGH_20260911_0516.md) 与各候选原始资料保留，不将旧失败删除或改标通过。

