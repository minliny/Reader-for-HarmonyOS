# 胶囊当前源码与 live Figma 审计（2026-09-13）

范围：自动翻页、朗读快捷/完整控制页启动到播放胶囊；只读审计生产代码，未构建/安装/操作 VM 或真机。证据文件保存不代表已修复。
源码审计基线：Harmony HEAD 50cad401ffc6d235f4ac388136ee5213b9b736ad 及当时未提交工作树。
本报告的四场景原始 official Figma MCP design_context/motion_context 见 capsule-figma-live.json。该文件保留完整工具返回，不以旧文档替代当前 Figma。

## 1. 设计基准与此前错误口径

文件 klhs2jMM4MncaJFqZMfqEK；C 1307:3126，D 1353:3288，E 1392:4012，F 1392:5024。
四者 timelineCohorts.durationMs 均3500；C/D/F loop用于审视，E once。应用启动执行一次。
C额外3个review标题不属于产品actor；每场景12个产品actor。

|场景|source actor|参考源尺寸|
|---|---|---|
|quick auto|1308:3236|286×196|
|quick TTS|1353:3304|286×190|
|full auto playback|1392:4862|316.675×104.384|
|full TTS playback|1392:5053|312×128|

此前320/260/200/220ms属于Quick/Full控制栏时序，不能写成胶囊时长。
Reader-Core-Native/docs/frontend-complete-app/MOTION_SPEC.md:222保留了旧review-only、删ghost、420/160/200、打断跳终态等内容，与本次live Figma/后续用户要求冲突，不得作为当前权威。
C/D/E/F是启动轨道，没有定义用户拖动胶囊；控制栏停指/反向拖动不得混入胶囊的产品能力。
用户要求点击即响应：点击当帧接管source actor和播放意图并启动共享轴，不追加音频/snapshot等待；不等于第一帧瞬显右下完整胶囊。
原轴有100/200ms起始保持；按轴运行时即保留该设计保持，播放按压/准备状态必须当帧反馈。不可把桥接等待误算成设计保持。

## 2. 完整关键轨道

|轨道|3500ms轴范围|行为|
|---|---|---|
|top bar/dock/full outgoing|100–700|顶栏上移，其余外壳下移，源模块独立脱离|
|immersive info/page label opacity|100–500|0→1 ease-out|
|source flight/geometry|200–1400|源尺寸→24×24，飞到右下锚点，(.4,0,.2,1)|
|sharp source scale|200–1400|quick→.084；full auto→.076；full TTS→.077，等比|
|sharp source opacity|700–1100|1→0 ease-in|
|blur ghost opacity|600→900→1200|0→.6→0，独立轨道|
|source surface/canonical surface|1100–1400|源1→0，胶囊壳0→1|
|pause circle opacity|1100–1400|0→1；圆点停留前已显示暂停键|
|dot hold|1400–1700|24×24|
|shell expand|1700–2300|24→96/94，右边缘固定，(.2,0,0,1)|
|leading icon + label|1700–2300|1700 step opacity 0→1，裁剪内x=-72/-70→0，与壳同起止|
|pause circle position|1700–2300|相对壳x=4→76/74，屏幕右缘固定|
|page label first displacement|100–1400|先让出圆点位置|
|page label second displacement|1700–2300|与壳同轴向左，自己的ease-in-out曲线|
|settled hold|2300–3500|终态保持，不重播，不重新挂载|

PageLabel相对终态轨道：C +101.45→72→0；D +101.452→72→2；E +101→72→0；F +99→70→0。
静态auto96×24，TTS94×24，padding6/gap4/pause16×16。
必须按真实viewport/safe area/source rect重定端点；上述参考尺寸不能硬编码为所有设备绝对位置。

## 3. 当前已存在的机制

有ReaderSessionCapsuleModel统一投影、四sourceKind/measured geometry、TTS/auto互斥stop屏障、shared sampler、generation失效保护、sharp/ghost/canonical/dot/expand actor、page-turn input owner、临时宽度不覆盖settled measurement和PixelMap release。不能据此说Figma或设备验收通过。

## 4. 已定位缺陷及修改边界

|ID|当前证据与根因|实施要求|
|---|---|---|
|C01|LocalReadingExperience约5981：start→whenStarted→beginMorph。TTS/互斥stop等待阻塞视觉|有效点击当帧建立独立presentation；业务屏障照常异步，不伪造playing；失败/取消撤销，不在成功后重播|
|C02|约7856：capture→hideControl→async snapshot；约7668：capture阶段shouldShow=false。注释“已挂载fallback”与源码相反|source必须稳定挂载，snapshot不是启动前置。优先复用真实actor；如保留快照，只用匹配revision的预捕获图或在接管成功前保留源，任意时刻一个可见owner|
|C03|flight Image→dot Row→expand capsule→morph/static builder换树|固定Stage与actor集合；phase不控制视觉挂载，终态保留同一节点|
|C04|ReaderSessionCapsule.capsuleContent把leading/label/pause合在同一Row平移|pause独立于leading content，按Figma分别显现/定位|
|C05|sampler的revealOverlap启发式：壳600–840，内容720–1000|删除人工重叠，直接采样原始keyframes，壳/content同起止|
|C06|pageChromeSnapshot只传sessionVisible+最终全宽；ReaderPageChromeLayout:131直接预留width+5；没有progress|独立transient PageLabel actor共用sample；不能expand首帧跳到最终预留；不要每帧重建正文/纹理|
|C07|source整张图同一fade，ghost=.55×progress×fade，blur12|surface/clear/blur三轨拆分，保持live导出opacity、blur和曲线；性能优化不能静默减效果|
|C08|controlVisible时derive返回undefined→type fallback auto，TTS可误用96目标宽|事务显式携带type/sourceKind/target width，不从隐藏胶囊投影推类型|
|C09|measurement有revision但只按kind缓存，启动未校验viewport/visit/scroll等|token绑定lifecycle/book/moduleVisit/sourceKind/layoutRevision/scroll/revision；旧测量不可飞旧位置|
|C10|1884及proxy/dot使用reading paperStart/ink，内部primary/line固定|胶囊含全部actor统一app palette，页码reading palette；保留现有alpha|

## 5. 实施组织与不变量

1. 冻结本次四组live节点和原始轨道；主题/布局revision均进入证据。
2. SessionLaunchPresentation持有generation、lifecycle、book/source、moduleVisit、type/sourceKind、sourceRect/targetRect、paletteRevision、startTimestamp、businessStatus、cancelReason。
3. 单个不可变PresentationSample输出每个actor的rect/scale/opacity/blur/clip；只用一个monotonic时钟。
4. 固定actor：sourceSharp/sourceBlur/sourceSurface/canonicalSurface/revealClip/leadingIconLabel/pauseCircle，加topBar/dockFull/immersiveInfo/pageLabel。
5. 控制外壳退出不能再另外启动普通hide动画；业务可关闭输入，视觉outgoing由共享轴持有。
6. quick捕获整个对应模块，full只捕获播放区域；不能让source连同整块Full一起飞。
7. geometry变化复用当前进度/当前屏幕位置重新求端点，不从头播放；95/96/94等尺寸不得由hidden projection默认值覆盖。
8. pause/resume只更新圆钮与业务；stop/离页/background/切源/module切换使旧generation失效；迟到快照release且不hide新页。
9. 不新增用户拖拽胶囊。控制栏既有手势独立保留可逆规则。重开控制层按现有控制呈现接管，不无条件跳终点。
10. snapshot fallback必须可见、有界、不双重显示；frame callback可取消/失效。资源在完成/取消/失败/退出全部释放。
11. reduced motion静态终态但业务状态真实；不显示虚假已播放。
12. 每帧禁止Core请求、设置写入、全文测量、分页缓存刷新、PixelMap分配；原有ArkUI组件/monotonic调度优先复用。
13. 3500ms是本轮live轴；运动2300ms完成即可开放稳定控件。若产品另有速度压缩，只能作为显式独立映射，不能混入本次Figma事实或擅定新值。

## 6. 验证门禁

现tools/test-reader-session-capsule.mjs主要是regex，且锁定TTS成功后morph、capture不显示、morph/static两builder等旧行为。必须替换为状态/采样行为测试，不是改regex放行。

- 四入口actor清单完整；关键t及前后1ms：0/100/200/500/600/700/900/1100/1200/1400/1700/2300/3500。
- pause在交接时显现；1700ms壳/leading/PageLabel第二段同起，2300ms同时到端点。
- 同timestamp确定性；冻结不漂移；任意采样往返不改状态。
- TTS延迟0/100/1000ms、失败/不可用；snapshot延迟/失败；measurement零值/过期；重复play/stop；换页后迟到回调。
- TTS→auto严格等待业务stop；stop失败另一业务不能启动；视觉启动不代表音频已成功。
- auto96/TTS94及字体放大、长文案、窄/大屏、安全区变化；morph终态与静态完全一致。
- 一份source owner、一个canonical shell、一个pause/leading；无空白帧/重影；分配释放平衡。
- 本地回归后才生成manifest绑定HAP；VM四入口逐帧和中断验证；VM不代表真机性能或用户验收。
- 本轮根因代码侧已可定位，不以重复真机抓取代替修复。

结论：Figma数据足够，代码根因已明确，实施方案可闭环；没有需要用户重新定义图标显现或信息让位的产品缺口。当前仍是审计/方案完成，非修复/设备验收完成。

