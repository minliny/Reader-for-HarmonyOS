# 原有翻页、Make/TTS 与性能遗留复核

2026-09-13，只读当前源码与既有证据，补齐原 20 项之前的遗留；不修改生产代码、不提交、不操作 VM/真机。本文件是审计证据补充，实施顺序仍由工作区唯一 DEVELOPMENT_BACKLOG/根实施规格管理。

基线：Harmony HEAD `50cad401ffc6d235f4ac388136ee5213b9b736ad` 加当前既有工作树修改。输入为 CURRENT_GAP_REGISTER.md B/C、control-update-performance/ISSUES.md 与 REPAIR_REPORT.md、当前生产方法/本地回归。旧账的“缺代码”状态不能直接继承。

## C 段 14 项逐项复核

状态释义：“已有代码/本地”表示旧缺实现描述已过期，仍需保留原生/性能/用户验收；“部分”表示有保护链路但未证明所有故障组合；不把测试通过等同屏幕呈现。

| 原序号 | 当前状态 | 现证据/实施约束 |
|---|---|---|
| C01 冷准备中 pointer 无法重获呈现权 | 已有代码/本地，原生跟手待证据 | ReaderPageInteractionLayer:687 readiness 改变时重放保留 DOWN 与最新物理样本；drag-follow/page-input 通过。必须保留同 pointer、原始起点、最新位置，准备完成不能制造新 DOWN 或让已释放手势复活；冷 TXT/远程章/反向准备的原生延迟仍测。 |
| C02 收尾再抓等待旧事务 | 已有代码/本地，非中断区仍受约束 | LRE:9834 regrabPageTurn 从当前 flat offset/Native edge 恢复，撤销旧释放意图与时钟；Core 已开始写入/动画已完成时禁止打断是当前明确边界。page-settlement 实际方法再抓回归通过。不得只删 busy guard；新手势不能让旧写入回执覆盖新状态。 |
| C03 最后 UP 未参与呈现/方向 | 已有代码/本地 | ReaderPageInteractionLayer:323 先 updateRawPointer(event,pointer,false)，再计算 tap/settle；page-input 通过。保留 UP-only 越阈值和反方向 UP 检验，UP 不能触发一次新 regrab。 |
| C04 tracking UP 被误判 tap | 已有代码/本地 | tracking 分支使用 !coldPointerRebased 与 readerPageGestureCanTap；last UP 先经过 arena。不能删回 tracking===tap；长按、纵向、拒绝/冷 pointer 和短 tap 分开。 |
| C05 纯纵向上一页按住无连续呈现 | 已有代码/本地，原生方向对照仍开 | LRE:9930 flat offset 从 verticalPrevious 的 currentOffsetY 映射，simulation 接 verticalPrevious；不可仅验水平下一页。必须对 slide/cover/simulation 分别验纵向 previous 的 MOVE/停住/UP/反向。 |
| C06 none/减动态取消所有权不收敛 | 已有代码/本地，生命周期故障矩阵待补 | LRE:2063 effectivePageTurnStyle 统一 fallback none；9914 none rollback 清 gesture/input/presentation，idle 刷延后 chrome；releasePagePointer 用 epoch/lifecycle 阻止晚 drain。仍保留禁用/切模式/退页/CANCEL/自动翻页插队矩阵。 |
| C07 rapid 边界净目标不可达 | 已有代码/本地 | ReaderRapidPageTurnState:81 reachReaderRapidPageBoundary 清朝不可达方向净目标；LRE request/drain 已调用。rapid 回归通过。边界后的反向必须立即可达，不能清除反向已排队量。 |
| C08 continuous Promise 不等持久目标 | 部分已修/本地，未知结果故障矩阵仍开 | LRE:4501 单 trailing commit drain，:4569 catch 后串行 loadProgress 核对真实 chapter/scalar；不是只 await 任意 Promise。失败读/并发滚动/退页/重启最终位置组合必须保留；不能把 stale isCurrent 导致未发布误当目标未写。 |
| C09 2 秒超时被当未写入 | 部分已修，必须保留未知结果状态验证 | LRE:5374 deadline 对 writing 重装计时，已完成写入走 promotion；:10310 reconcilePreparedPageTurn 串行读进度，对未知返回 undefined，并保留页面提供重新确认。旧“完全无对账”描述过期，但当前由多个 bool 表达，queued/dispatched/durable/unknown 语义与永不返回请求还需故障注入/收敛约束，不能超时直接回滚。 |
| C10 scroll 图片变高无锚补偿 | 已有代码/本地 | ReaderContinuousReadingStage:451 保存 fragment id、y、高度比例和期间 manualScroll；:475 重排后 scrollBy 差量，保留可见锚。continuous-input 生产方法多图批次/同期滚动回归通过；原生异步图片/惯性像素仍待。 |
| C11 scroll 多指未锁首指 | 已有代码/本地 | continuous stage:287 按 touchPointerId 找 MOVE/UP；第二 DOWN 在 active 时忽略；注册 shared onPointerStart/End。生产多指 DOWN/UP/CANCEL/禁用/退页回归通过。 |
| C12 none 仍等待排版/保存 | 部分/性能验证开放 | none 由独立有效模式进入，跳过 animation/prepared visual gate；真实内容仍需测量与持久化。不得用“零视觉延迟”要求跳过真实排版/进度确认；目标应为内容和提交结果就绪后无人工延时/额外动画。冷页和超长章 latency 必须单独计。 |
| C13 scroll 上章逐物理页扫描 | 已有代码/本地，超长章性能待证据 | LRE:10979 continuous 直接 openPageTurnChapter(previous, MAX_SAFE_INTEGER) 尾锚，由 List 对齐，不走 startPreviousChapterMeasurement。paged 缺 predecessor 的真实页边界测量仍存在，不能把 paged 行为当 scroll 旧缺口。 |
| C14 A/B 条件重挂载 | 旧条件分支缺陷已不在当前代码；实例证据开放 | ReaderPageTurnStage build 直接、无条件各创建一个 A/B ReaderPageTurnSurface，固定 slotIdentity，通过 provider/revision/visibility/offset 换角色；page-turn-stage 几何/角色测试通过。真正原生实例生命周期与 compositor fence 不能用 .id 注释或 mock 代替，仍需 attach/detach 计数与同帧证据。 |

本轮运行并通过：test-reader-page-input-runtime、test-reader-continuous-input-runtime、test-reader-rapid-page-turn-state、test-reader-page-settlement-runtime、test-reader-continuous-reading、test-reader-page-turn-stage、test-reader-drag-follow-gate。没有重新测原生 GPU/VSync/触摸延迟。

## B 段 Make/TTS 七组复核

| 旧组 | 当前状态 | 约束/剩余关闭条件 |
|---|---|---|
| B1 在线 TTS 只有两字段 | 旧描述过期，完整能力仍待验 | ReaderTtsConfigOverlay 当前已有名称/URL/API 密钥/发音人/格式（MP3/WAV/PCM），beginEdit 回填 voice/format，secret 留空表示保留，clearKey 显式清除，busy/generation/失败留草稿和 resetDraft 已存在。LRE 的配置写入/激活/secret alias 回滚与 HttpTTS POST/格式链路需按实际服务、取消/失败/重启验证，不能只看五个控件关闭。 |
| B2 TTS 开关/章节定时/精度 | 大部分已有代码，试听仍缺 | Preferences 已含 followHighlight/pauseOnInterruption/backgroundPlayback/keepScreenOn；LRE 5819 起加载、Host 调用与失败回滚，5996/6027 有 chapterEnd，快速和完整界面均有本章结束，速度预设含 0.50x。当前 TTS/控制内容未查到独立音色试听回调/行为，仍属真实缺口；音色/引擎失败回滚有部分实现但须验证重启老会话和 Core/Host 一致。 |
| B3 主题映射 | 现存，根方案负责 | ReaderControlThemeStyle 忽略主题参数/大量固定色；统一两套应用+八套阅读角色与双向规则按用户新决议实施，沿用当前 alpha，不重用已撤回不透明规划。 |
| B4 翻页选项集合 | 差异现存 | Appearance 当前为仿真、覆盖、平移、滚动、无动画；Make 旧比较是平移、仿真、淡入、无。需根规格清楚列设计参考版本和已授权产品集合；不得借“对齐 Make”静默删除正在审计的覆盖/滚动能力，也不得只把仿真改名当淡入。 |
| B5 播放视觉 | 实现部分、完整视觉开放 | 当前有 speaking 状态色/状态点、卡片 alpha、速度/定时/播放 geometry；并非纯静态空白。波形、暂停/空闲、左线、图标、阴影和状态切换必须逐 actor 对照同一 Make/Figma，不能因已有卡片框关闭。 |
| B6 键盘遮挡/首击导航 | 部分代码、原生交互证据开放 | 配置存在可交互输入/弹层/scroll，近期冷导航与收起命中代码已改；不能据旧失败说完全没修，也不能凭接口说键盘/IME 首击通过。指定键盘展开/切页/取消/重入及首击的原生验证案例。 |
| B7 测试仅实现形状 | 部分改进，交付门禁仍开 | 当前存在生产方法运行测试，TTS preferences/product-surface 本轮通过；依然不足在线音频、来电、后台、PCM/MP3/WAV和Figma完整状态验收。root 不能把本地 198 数量当所有 TTS 功能闭环。 |

## 动效时间必须分开

- 之前记录的 320/260/200/220ms 属于控制面板展开/收起/直接关闭/恢复的操作节奏，不能迁移为播放胶囊 Figma 规格。
- 胶囊权威来源是单独完整 3500ms Figma 时间轴；该时长的具体播放段/等待段与可逆范围以胶囊专项审计帧轴为准，不能简单将整个动作拉成 3500ms 或把控制栏数值套入。
- 当前 MotionSpec.ets:144–151 仍有 capsule 480/120/240/160ms 代码阶段；ReaderSessionMorphTimeline 使用后一半展开重叠 reveal 的推导。它们是当前实现，不是已验收 Figma 参数。必须按专项提供的节点/actor/时间轴替换，不用“共享一个时钟”掩盖错误的轨道。

## 原性能总账必须继承，不得遗漏

来源：control-update-performance/ISSUES.md 与 REPAIR_REPORT.md 的“保留的主线”，及 code-rendering-audit/CODE_RENDERING_FINDINGS.md。

1. CU-01 设置选项差分：现有 AttributeModifier 与静态/动态拆分有本地证明；历史 24960→7440 属性调用（70.19%）是调用数，绝不是帧耗时提高 70.19%。不得再做重复通用属性缓存。
2. CU-02 / C01/C03/C07：Panel 响应式更新、原生布局、20 个模糊节点各自耗时仍未从当前有效候选 trace 分离；历史 57.926ms UI VSync、28.515ms Settings 更新、27.118ms Native 峰值不是当前值。
3. CU-06 背景命中区域分配已有复用对象修复；保留其身份/实时坐标回归，不用删命中区降低开销。
4. N08 display fence 仍为必须关闭项：ReaderPageTurnSurface 当前用 postFrameCallback 报 onPresented，不能把它等同最终屏幕呈现。Native terminal、SLOTS_COMMITTED、clearSurface、releaseTerminal 及 ArkUI 目标帧之间要有可验证交接。
5. F03/N14/N15：Native 丢帧/失败/Surface 丢失/迟到旧 generation/终帧释放矩阵不能遗漏；保留旧页直到新页可接管，失败后保留可操作 UI。
6. C04/C05：动画过程中字号/主题/图片/目录/高亮/设置变化的组合，冻结布局与排队更新必须验证；不能只测稳定业务状态。
7. 冷页/冷远程章节、未知写入结果、字体/高亮/图片/主题像素矩阵、超长章节、连续 MOVE 与再抓、slide/cover 的 next/previous/verticalPrevious 都继续保留。
8. GPU、60/120Hz、温升、功耗和 C08 语义项仍是独立性能/产品门禁。本轮没有测，禁止清账。
9. 控制栏收起命中已有 shell HitTestMode.None/header zIndex/显式 collapse id 修复及旧 VM 局部通过；旧真机受来电/HDC污染结果不能覆盖当前产物，也不应把此项退回“完全没实现”。
10. HDC 已有共享 owner/串行 lease 实现与一次恢复证据；传输稳定不是 UI 流畅。重新发现 exact target/boot/SceneBoard、保数据 manifest 绑定仍需执行，不能用历史端口/旧 HAP 补当前缺口。
11. 原《绍宋》第 34 章 6/11 页 44% 缺失的当时 scalar/layout 证据仍须保留；不能被新正文间距方案掩盖。连续 MOVE 再抓十轮、字号与中间态像素补测也尚未由本轮本地回归关闭。
12. 页面级高亮合并/空或相同结果去重、Unicode scalar→UTF16 单次切分、深目录锚点补偿和目录重复 scrollTo 的既有修复必须纳入性能基线；不能再声称每个 MOVE 都重新分页，亦不能认为设置差分通过便代表其他模块滤镜与布局成本已消失。

## 根方案应采用的关闭口径

- 将 C01–C07、C10、C11、C13、C14 中已经存在的代码作为保护基线；只补缺失故障案例和原生证据，不从零重写。
- C08/C09/C12、display fence、原生滤镜/VSync/交接与冷路径继续列明确实现/性能门禁。
- B1/B2 已有字段和状态链路，禁止继续报告“只有两字段/没有章节定时”；独立试听、真实服务/系统事件、主题与 Figma 逐 actor 仍需补齐。
- 证据分源码、本地、产物、VM、真机、用户验收六栏，不因工作树整理提交或构建通过改变后四栏。
