# 导入与搜索动效：当前代码和现场 Figma 复核

日期：2026-09-13（18:14补证：已取得搜索原始 Make 全量源ZIP及实时CSS）。范围：只读生产代码，现场 Figma 只读；不改生产、不构建、不操作设备。取证末尾 Harmony HEAD 为 3ab102c6b32d507fa5f2fc22c0283873a6fec2fe（同一任务中的独立整理提交持续进行，结论以本报告点名源码及原始返回为准）。

## 1. 来源与取证边界

已读取 figma-use、figma-use-motion、figma-implement-motion、figma-design-to-code 指导。现场文件 klhs2jMM4MncaJFqZMfqEK：

- Library/LocalImportDialog 2657:918：get_design_context；get_motion_context recursive=true。
- Search Phone Loading 2635:58809：get_design_context；get_motion_context recursive=true。
- Import Result footer 2657:905：get_metadata，核对实际几何而非把生成 CSS flex 权重当固定尺寸。
- 上述两棵递归 motion 返回均为 {"nodes":[]}，原始返回已归档。结论仅为**这两棵组件树此次没有返回 keyframe tracks**，不能扩大为整个 Figma 无动效，也不能证明原始 Make 没有 CSS 动效。
- Search 组件说明明确其拷贝自用户授权 Make SW2sjgSEPEPuPwyR0TULyP。get_design_context 返回 resource_link 后，本次继续通过 CUA 只读浏览器进入官方 Code 视图，取得 Version 5 的 App.tsx 全文27356字符/628行，核对 globals.css 为空和 tailwind.css 库导入，并使用官方 Download code 取得完整ZIP。随后读取预览DOM的 computed CSS 和实际 style keyframes：**1s linear infinite spin，终点 rotate(360deg)，13/36尺寸旋转中心为6.5/18**。因此搜索旋转参数已取证，不再是候选。无普通HTTP下载、无设计编辑、无插件安装。
- 本地 appearance-reference/src/App.tsx 的“导入”仅是字体导入单元格；tts-reference 也不是该 Make 的搜索/本地书籍导入源码。不能借用它们替代缺失的原始 CSS 证据。
- docs/IMPLEMENTATION_SLICE_A_B_001.md:459 明确历史记录为 LocalImportDialog 三个 Phone 静态终态；该文档不能作为动效精确参数证据。

原始数据位于同目录 import-search-motion-raw/：6份 figma-*.json 保留工具原始结构；make-search-source.zip 为官方界面原始下载；make-search-source/ 提取 App.tsx、CSS、package.json；make-search-source-provenance.json 记录来源/版本/时间及SHA；make-search-live-css.json 保存实际DOM读取结果与方法。App.tsx SHA256为3585f71d1c69336b785e9c81a2d7634fd1a9e84a643541e5e93c98c733ee4007。

## 2. 可以直接落实的 Figma 几何

| Actor | 现场节点与尺寸 | 当前代码 / 差异 |
|---|---|---|
| 导入中弹窗表面 | Importing 2899:58923，390×844 画布中弹窗350×228，x20 y308，radius20，阴影0/25/50/-12 rgba(0,0,0,.25) | LocalImportDialog importingPanel 基础几何存在；不含展示动效 |
| 导入 halo | 2899:59038，56×56，弹窗内x147 y35 | 同尺寸静态 Image |
| 导入 spinner track | 2899:59039，32×32，内x159 y47 | 同尺寸静态 Image |
| 导入 spinner arc | 2899:59040，32×32，内x159 y47；导出内容有右1.55% inset | 当前无旋转属性 / 动画 owner，确定是静态 |
| 导入提示 | 2899:59041，Inter SemiBold14，line21，y111；2899:59042，Inter Regular11，line16.5，y140 | 相同文字与基本几何，不能用文字闪现冒充完成过渡 |
| 结果摘要 | 2657:807，318×52，图标背景36×36、图标18×18 | 静态结果摘要存在；“成功”总态误用感叹号等功能问题由表面审计处理 |
| 结果 footer | 2657:905，350×76，padding左右16/top16/bottom20 | footer固定在列表外的结构可保留 |
| 结果完成按钮 | **2657:906，x16 y16，318×40；icon14，文字13，pill radius** | **当前硬上限201，确诊与当前 Figma 318 不符** |
| 搜索头部 spinner | 2635:58784，13×13；内2635:58785静态旋转176° | 当前用系统 LoadingProgress13；Make已取证为1000ms linear旋转，中心6.5/6.5，需按该周期/图形复现 |
| 搜索正文 spinner | 2635:58803，36×36；内2635:58804静态旋转176°，旋转后外界38.424 | 当前用 LoadingProgress36；Make为1000ms linear旋转，中心18/18。Figma的176°是截取相位，不能在原始0→360上再固化叠加176° |
| 搜索正文提示 | spinner下18，Inter Regular13，line19.5，#756f69 | 原稿body padding-top120；当前代码注释标明用户批准改为底部固定，这个后续规则应保留 |

**完成按钮根因已足够清楚：** 生成代码含 flex-[201_0_0]，含义是 flex-grow 权重201、shrink0、basis0，且该 footer 只有一个子按钮，因此占满318内宽；不能读作“固定201宽”。现场 metadata 的 width=318 已排除歧义。LocalImportDialog.ets:273 的201注释与 :475 的 Math.min(201, ...) 是错误实现。修复为面板内可用宽 panelWidth−2×16（适配实际安全宽），40高，保持图标/文字/圆角原稿。这里无需把“满宽”再描述成待决定的新设计，也不能声称用户曾明确要求满宽。

结果整体高度的636是原稿静态多条示例，已由用户后续“按实际条数自适应，超高滚动”覆盖，不恢复固定636。按钮/列表适配与动效是不同门禁。

## 3. 当前已确定的代码问题

1. 导入中 arc/track/halo 都是 Image，只有结果refresh有静态 rotate(-113.93)；不存在 import animation controller、持续旋转、完成呈现或切结果过渡。LocalImportDialog 按 state 直接切三个子树。
2. Index.beginImport 当前已先等待系统 picker，返回非空后才置 importing；不要把已经修过的 picker 顺序再列“未实施”。但 picker 重入/旧 session 回调、退出清理应纳入这次动效 owner，不能仅加动画属性。
3. SearchPage.ets:309 已有 loading/results共用的一个底部 LoadingProgress，早先“两状态各建底部 spinner”已消除。但 :639 loadingContent 提示自己的 bottom48，spinner又 bottom48：两者独立定位，提示与36高图标占据相同底部区域，存在遮叠/不连贯布局直接原因。
4. loading/results 之间应保持该36×36 actor的身份与时钟；每批书源结果、列表重排、文案变化都不能重置转角。标题栏13×13指示器可以单独存在，不能算成底部双实例故障。
5. 搜索已通过原始Make代码和实时CSS确定1000ms linear无穷旋转；**导入**仍只有当前树motion=[]及静态资料，不能把搜索已定参数冒充导入也已定。胶囊3500ms、控制栏320/260/200/220都不是导入动效来源。

## 4. 可实施时序（搜索旋转已取证；导入转场为本方案候选）

下面只使用当前已经存在的图形与终态；不新增图案、弹窗或成功庆祝。**搜索原始 Make 已比对；导入不在该 Make App 中**（App仅为五种搜索状态，全文没有LocalImport/ImportResult/导入状态），不能跨组件借据。导入候选仍不得标成“Figma逐帧一致已闭环”。

| 时段/触发 | Actor及属性 | 时值、来源与约束 |
|---|---|---|
| picker返回有效文件，真实导入开始 | 弹窗表面及提示立即可见；arc owner启动 | 不加人为延迟，提交首个importing帧即开始；halo/track保持静止 |
| 导入持续 | 32×32 arc，pivot(16,16)，rotate | 0→360°，1000ms，linear，无限连续；父层坐标及SVG内部inset保留，不围绕裁剪后包围盒偏心旋转 |
| 全部条目得出真实终态 t=0 | 锁定 result model；终止无穷循环；保留当前angle到离场 | 不回零、不等一整圈、不修改导入耗时或阻塞数据库提交；success/failed/recoveryPending用真实结果 |
| t=0–120ms | importing内部内容 opacity1→0 | cubic-bezier(0.2,0,0,1)；表面/遮罩保持存在，不能先撤掉弹窗露出书架一帧 |
| t=0–220ms | 同一个弹窗表面：height从228→测量后的resultHeight | 同curve；width/radius固定；resultHeight先按条目、safe-area/上限计算；过渡中不得拿高度0测量；若即时结果在首帧前到达则直接结果，不强造完整loading停留 |
| t=80–220ms | 已存在结果标题/摘要/列表/footer opacity0→1 | 同curve；summary成功图标按真实状态同时呈现；不新造描边勾选轨道，因当前未取证；入口期间禁重复提交，结果完成按钮可在可见稳定态接收操作 |
| 搜索开始至扫源结束 | 原Figma36×36 spinner，一个长期挂载actor | **参考确值1000ms linear旋转，0→360°无限循环**；头部13×13同周期；加载→首批结果保持同actor时钟是当前产品流式结果的必要适配，source batch不能重新onAppear启动 |
| 搜索底部位置 | spinner与caption为一个共同容器 | 36高spinner，18间距，caption实测高19.5，容器底距48；原稿caption仅loading出现时可用保持布局/opacity策略切换，避免caption消失导致spinner跳位置 |
| 暂停/完成/失败/返回 | loop owner + generation | 立即停止循环并按真实状态展示结果/空/错误；onDisappear释放；旧搜索generation不能重新显示或重启loop |
| reduce-motion | 以上所有actor | 保留真实状态反馈及固定位置，旋转可停为静态、过渡0ms；不得保留闪烁或无限timer |

上述导入120/220ms和导入1000ms仅为本方案新建议，**不是控制栏token复用，也不是导入Figma已有事实**。剩余参考边界精确为“导入进行/完成/切结果轨道未从当前组件树或历史静态资料取得”；搜索CSS已读到，不能再把它列为阻塞。

## 5. 修复门禁

- 代码/本地：导入空选择/取消不出loading；有效选择立即显示；0条/1条/多条/失败/混合/recoveryPending；快速完成不人为等时；并发点击只一个session；前后台和退出停止循环，旧callback不重新挂载；真实结果先提交再过渡，不丢结果。
- 几何：350基准弹窗下，完成按钮实测318×40、左右16；更窄屏按安全区缩放；结果列表独立滚动、footer始终可达；不用201固定上限。1条结果不固定大半屏。
- 动效：采样spinner相位0/90/180/270与回环；loading→results相位不断；结果批次推送不重置；无遮挡、无双底部spinner、无caption同位重叠；导入结束不中间露底。
- 证据层次：本地状态/时间线探针可以证明owner/generation/无延迟；VM按相同产物记录帧时间与尺寸；当前代码无需先真机定位。Figma逐帧验收必须区分已知几何和本方案候选时序；不能拿此次motion=[]或构建通过宣称视觉验收通过。

## 6. 搜索原始 Make 补证（覆盖前轮“尚未取得源正文”的临时结论）

- 来源是“书籍搜索页设计”Version 5，全量源通过官方代码界面下载，没有修改Make。
- App.tsx:71-88 的 Spinner 为单个SVG，viewBox 0 0 24 24，圆cx/cy12、r10、stroke2.5；四分之一arc，strokeLinecap round；整体class animate-spin。默认深色轨道rgba(45,74,62,0.15)、弧线#2d4a3e；头部light轨道rgba(255,250,244,0.3)、弧线#fffaf4。应用主题适配应保留两角色关系，不复用平台不明曲线。
- App.tsx:258-266：正文36，caption间距18，字体13；Phone原稿paddingTop120、Tablet160。后续用户已定底部位置仍优先，但几何应放同一个容器而非两个bottom48。
- 实际CSS四个实例（Phone/Tablet各两个）均1s linear infinite，transform-box:view-box；原始SVG无176度固定基旋转；预览style只有to rotate360。176°来自Figma静态抓取相位。
- App.tsx:485只有搜索按钮background和opacity各150ms，不代表整个内容区淡入/淡出。App.tsx:538起按state条件渲染各内容，未发现搜索状态区自定义transition/keyframe。无需新增结果crossfade冒充设计。
- App.tsx:389的1800ms仅为Make演示搜索延迟，生产依真实本地/远程结果推进，不人为延迟、不把它当旋转周期。
- 已保存globals为空、tailwind.css官方库导入、实际DOM编译keyframe，故1000ms不是仅凭Tailwind默认值记忆推断。
