# 当前生产控制栏审计与分阶段修复方案

日期：2026-09-10。范围：当前工作区的生产控制栏展开、收起、打开、关闭及内容形变。只读核查业务代码，执行本地测试；未访问任何设备，未修改业务代码。本文的代码行号对应此次核查快照，后续并行修改可能使行号变化。

## 结论与证据边界

当前没有发现普通展开/收起在中段主动等待另一个阶段完成的逻辑。已经确认 UI 线程逐帧更新、真实布局持续变化、目录逐帧滚动修正、重复几何和裁剪计算，以及内容清晰度平台和曲线慢尾。尚未实测确认其中哪个环节超出呈现帧预算，不能把这些机制直接等同于设备掉帧根因。

生产路径是 `ReaderControlPanel → ReaderControlRuntime`，不是旧 `ReaderControlMotionStage`。`ReaderControlMotionStage` 当前只由 `ReaderControlMotionVerification.ets:231` 挂载。

| 优先级 | 已确认机制 | 当前可支持的结论 |
| --- | --- | --- |
| P1 | UI 线程帧回调更新状态，再改变内容宽高、列表布局、裁剪和模糊 | 存在集中于动画过程的工作负担；实际耗时尚待测量 |
| P1 | 目录/书签每次 progress 更新直接调用 `scrollTo`，行高和视口同时变化 | 多个布局输入交织；内容位置顿挫和帧预算影响尚待测量 |
| P2 | Panel 整体几何每次 `frame()` 都重新生成；模块端点几何和裁剪仍有重复计算 | 可落实缓存优化；不能将少量 JS 运算直接判为主要掉帧原因 |
| P2 | 中段透明度和模糊度有固定平台，自动曲线有明显慢尾 | 可解释视觉停留；不是时钟暂停或真实掉帧的证据 |
| P2 | 部分测试仍围绕旧组件，缺少当前生产组件的完整帧链路验证 | 旧测试 PASS 不能证明当前目录锚点或设备流畅度 |

上述 P1/P2 是调查及改进优先级，不表示尚未实测的瓶颈已经被证实。

## 当前源码证据

以下路径均相对于 `/Users/minliny/Documents/Reader/Reader-for-HarmonyOS`。

### 生产时钟与状态连续性

- `entry/src/main/ets/features/reading/ReaderControlPanel.ets:373`：创建 `ReaderControlRuntime`。
- 同文件 `399–413`：接收运行时更新，写入 `visualSession`、布局补偿，报告区域并预约下一帧。
- 同文件 `416–430`：使用 `postFrameCallback` 推进生产时钟。
- 同文件 `683–690`：内外两层内容 viewport 每帧改变真实宽高并裁剪。
- `ReaderControlRuntime.ts:75–84`：相同语义命令会直接返回，不重启本地进度。
- 同文件 `87–102`：布局重定基线只有非 `unchanged` 时才使帧票据失效。
- 同文件 `113–124`：每帧推进同一个 session；没有普通展开中段等待另一个动画的阶段。

### 目录与书签

- `ReaderControlDirectoryContent.ets:119–128`：progress 改变行高，按冻结的浮点行号调用 `scrollTo`。
- 同文件 `134–140`：输入交接时抓取当前偏移并停止惯性。
- 同文件 `25–30`：数据变化通过全量 JSON 签名判断，然后通知 reload。
- 同文件 `283`：列表行身份包含 `${row.key}:${JSON.stringify(row)}`。业务字段更新会改变行身份，动画中恰好收到下载/书签等更新时存在额外重建风险。
- `ReaderControlDirectoryModel.ts:48–69`：初始居中请求归属于一次真实打开，用户滚动可撤销；Quick/Full 变化不应产生新居中请求。这些规则应保留。

### 缓存、裁剪与模糊

- `ReaderControlPanel.ets:494–505`：整体 `frame()` 无缓存，多次声明式属性读取会重复采样并分配 actor。
- `ReaderControlTtsContent.ets:90–99`：当前帧已有 `p、width、rate、seekHeight` 缓存。
- `ReaderControlAutoPageContent.ets:68–73`：当前帧已有 `p、width` 缓存。
- `ReaderControlAppearanceContent.ets:120–131`：当前帧已有 `p、width、fullHeight` 缓存。
- TTS 同文件 `131–148`：outline/sharedClip 仍重复采样 full/quick 端点并构建路径。
- AutoPage 同文件 `107–121`：sharedPaintRect/sharedClip 重复采样端点与当前几何并构建路径。
- Appearance 同文件 `142–153`：共享 actor 裁剪重复采样端点，并创建 `PathShape`。

因此不能将当前实现描述为“完全没有缓存”。需要优化的是 Panel 多次采样以及各模块未覆盖的端点、裁剪和绘制计算。

### 中段视觉平台和慢尾

- `ReaderControlMotionPresentation.ts:20–28`：`p∈[0.2,0.8]` 时内容固定为 opacity `0.35`、blur `2`；只有头尾各 20% 改变清晰度。这是此前选定的呈现方式，应作为体验项评估，不应未经对照直接删除。
- `ReaderControlPanel.ets:366–368、524–528`：open/morph/dismiss 均使用 cubicBezier `(0.2,0,0,1)`。
- 数学采样：50% 时间已走完 87.78% 路程；75% 时间已走完 97.55%；最后 25% 时间只剩约 2.45% 位移。当前展开为 320 ms，最后 80 ms 位移很小。这能解释近终点的停留感，解释不了中途整画面大量重复帧。
- `entry/src/main/ets/features/common/ProductMotionTiming.ts:2–6`：当前打开 220 ms、展开 320 ms、收起 260 ms、关闭 200 ms、恢复 220 ms。
- `ReaderControlMorphScroll.ts:50–73`：没有中段计时器；只在交接时停止惯性、稳定快捷端点归零，共享 actor 的补偿随同一个 progress 变化。

### 最近书签的语义待明确

`ReaderControlListPositioning.ts:89–112` 当前按章节距离选择书签，距离相同时按阅读顺序选择，同章优先较小 offset。不能据此直接报告“最近书签定位错误”：需要先明确产品目标究竟是最近章节中的书签，还是距离当前 scalar 锚点最近的书签。如果目标是后者，生产输入需要补充当前 scalar offset，并定义跨章节距离及等距时的选择规则。这是语义待明确项，不是本报告已确认 bug。

## 分阶段可落地方案

### 阶段 1：建立真实生产链路的测量基线

保留现有时长和曲线，在 Panel/Runtime 边界记录同一 epoch 的帧时间、progress、visibility、布局补偿、当前模块、几何计算次数和耗时、目录滚动命令次数、布局观察次数。不要在每个 actor 上输出高频日志干扰结果。

先对已有本地录像分开判断：

1. 壳体位置继续变化而内容清晰度保持不变：呈现平台。
2. 位置与整幅画面重复：真实停帧候选。
3. 位置突然跳变：状态、滚动或布局交接候选。

将录像绑定到对应 HAP manifest，避免用最新源码解释较早版本。后续 VM 应运行挂载实际 `ReaderControlPanel` 的生产页面，覆盖七个模块，不只运行旧 Stage 验证页。本阶段不要求重新连接真机。

### 阶段 2：消除重复计算，保持现有轨迹

- Panel 每次运行时更新生成一份最终几何。缓存键包含 `expansionProgress、visibilityProgress、motionOffsetY、width、fullHeight、quickHeight、bottomGap`；不能只用 epoch，因为同一 epoch 内几何不断变化。缓存对象不得被反复累加 offset。
- 保留 TTS 当前帧缓存已有 `p、width、rate、seekHeight/error row` 失效条件；端点样本另外按 `width、seekHeight` 缓存。
- AutoPage 端点按 width 缓存；Appearance 端点按 `width、fullHeight` 缓存。字体重排改变实际 actor 位置时，相关裁剪必须失效。
- 裁剪缓存按 `p、actor identity、current/full/quick rect、scroll anchor、viewport height、vp2px density` 失效。同一帧复用结果，不能跨变化的 p 复用旧路径。
- 增加执行级计数断言：同一输入帧内重复读取不重复构造；每个失效条件改变都会刷新结果；几何值和旧实现保持等价。

### 阶段 3：目录/书签统一锚点与布局交接

- 用稳定行 key＋行内偏移表示锚点，不只存浮点行号。排序、过滤、删除书签、更新下载状态后仍可追踪同一条内容；锚点行消失时定义相邻行回退规则。
- 一次 morph 冻结起始锚点及起止形态，中途反向沿同一路径继续，不重新居中，也不重新抓取可能已经被形变修正的滚动位置。
- 将真实行高变化与滚动修正合并到一致的布局更新中，每帧最多一次有意义的 scroll 修正；偏移未变化时不下发命令。不要用额外延迟计时器或第二条动画补偿链路。
- 保留初始居中的所有权规则：实际打开才创建请求；延迟数据可完成旧请求；用户主动滚动撤销请求；形态变化不创建请求。
- 列表使用稳定 `row.key`；业务字段更新通过精确数据变化通知刷新，结构变化才 reload。不能以整个业务对象 JSON 作为行身份。
- 最近书签先明确目标距离定义，再决定是否传入当前 scalar offset。

### 阶段 4：按实测结果优化布局、裁剪与模糊

- 保留 shell、viewport 和关键 actor 的真实形变。不能用整块文本缩放替代布局，造成字号或图标比例漂移。
- 对内部尺寸固定、只移动的区域保持布局尺寸稳定，使用位移与裁剪表达运动；真正变宽的文本保留正确重排。
- 合并同一区域重复裁剪，仅保留必要的动态路径；保证 Quick/Full、中间反向和已滚动内容的可见切片一致。
- 对模糊与半透明叠加单独做 VM 对照，确认是否构成绘制或合成瓶颈后再调整范围，不凭静态推测删除效果。
- 性能稳定后，再单独评估慢尾和清晰度平台。修改呈现曲线与修改计算链路应有独立对照，不能把缩短动画当作停帧修复。

### 阶段 5：进度连续性与验收

保留唯一 progress 和单调时钟。缓存失效、列表更新及业务数据到达都不能重启计时。相同语义命令和重复布局通知不得倒退进度。拖动期间保持手指直接控制；松手从当前样本及当前速度继续；重抓、反向、取消不能跳到旧起点。

验收矩阵：

- 七模块的 Quick→Full、Full→Quick、打开、关闭。
- 在 p≈0.2/0.5/0.8 抓住、停住、反向、松手；快速重复点击和系统 Back。
- 目录及书签的顶部、中部、底部；大列表；搜索、排序；异步数据更新；用户滚动与迟到的居中请求竞争。
- TTS 带/不带 seek 与错误行；字体重排后再形变；Full 内容滚动后收起并中途反向。
- 窗口尺寸、密度和字体变化；后台恢复；减少动态效果。
- 分开统计清晰度平台与实际重复帧：相邻呈现帧间隔、最长停留、p95、完成时长、几何计算、布局和滚动修正次数。报告设备/VM 刷新率和采集方式后再解释指标。

## 本次本地验证

本次只读审计已重新运行，以下均 PASS；保存本文时未重复测试：

- `tools/test-reader-control-runtime.mjs`
- `tools/test-reader-control-motion-policy.mjs`
- `tools/test-reader-control-motion-presentation.mjs`
- `tools/test-reader-control-playback-content.mjs`
- `tools/test-reader-control-directory-model.mjs`
- `tools/test-reader-control-p0.mjs`
- `tools/test-reader-control-directory-content.mjs`

覆盖说明：最后一项主体在第 7 行读取旧 `FullDirectoryPanel.ets`，仅部分检查当前组件挂载关系。`directory-model` 验证当前生产定位模型，但不是当前 `ReaderControlDirectoryContent` 的完整布局/滚动执行。因此需要补充当前组件的执行级测试。所有上述 PASS 均不代表设备帧率、录像视觉或用户验收通过。

## 核查快照摘要

此次读取的文件 SHA-256：

| 文件 | SHA-256 |
| --- | --- |
| ReaderControlPanel.ets | `4223d363b719d583fd14d25b9bed3514f2f0f78aacbceb7e05445359cea344e6` |
| ReaderControlRuntime.ts | `e06c8e7e6f21941da70d413de9a9f10f4b531b9ef988077d0e3967c44e76b903` |
| ReaderControlDirectoryContent.ets | `566c4c7315397f48b9426c182f545505717d10c661ec38a4a1a89ffb361f738f` |
| ReaderControlMotionPresentation.ts | `61570c1f6175d43531a399aa33bbc7c6474e4df4e712fe1846c235fa6eb5d197` |

这些指纹标识审计读取时的源码，不证明任何已安装包使用了这些文件。
