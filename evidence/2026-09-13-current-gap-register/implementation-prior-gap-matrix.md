# 全量实施后的旧52项与Make七组映射

本文件是 `READER_REPAIR_SPEC.md §11` 的实施证据附件，不取代或重写旧总账。核对对象是2026-09-13当前共享工作树；旧包/VM/真机的通过、失败和未验证仍按原始证据归属，不能继承给本次候选。

原52ID来自 `../2026-09-10-page-turn-physical-b1f20b88963d/CURRENT_ISSUES_AND_REPAIR_PLAN.md`；这里的C01–C08是原控制性能ID，不是CURRENT_GAP_REGISTER C段的14个序号。后者已在 `prior-gaps-current-audit.md`逐项保留，本轮更新其C08/C09/Native呈现故障，其他保护基线仍在。

## 证据解释

以下“本地”均指本轮实际执行生产方法或C++真实Host+mock，或静态接线约束，**不是完整UI/像素验收**。本轮新增28组旧基线/Make/TTS/主题检查全部通过，日志在 `implementation-prior-gap-local/`；本组目录/进度/恢复另20组通过，Native呈现245检查0失败。不得把组数换算成旧52项的完成比例。

- `input`=test-reader-page-input-runtime；`preparation`=page-preparation-runtime；`page-stage`=page-turn-stage；`drag-follow`=drag-follow-gate；`rapid`=rapid-page-turn-state。
- `native-core/host/event-dispatch`=reader-book-turn-native-core/host-runtime/event-dispatch；`native-barrier`=reader-book-turn-present-barrier；`surface-recovery`=reader-book-turn-surface-recovery。
- `presentation-recovery`=reader-presentation-recovery；`page-progress`=reader-page-progress-runtime；`progress-observation`=reader-progress-observation；`continuous`=reader-continuous-input-runtime；`settlement`=reader-page-settlement-runtime。
- `option-update/backdrop-publication/list-position/directory-model/gesture-continuation/motion-presentation` 分别为reader-control-option-update/backdrop-publication/list-positioning/directory-model/gesture-continuation/motion-presentation。
- `render-work/highlight/theme/session-launch/navigable-toc` 分别为reader-render-work/dynamic-highlight/theme-selection/session-launch/navigable-toc；`directory-markers`为reader-directory-markers。

## 52项逐项

| ID | 当前代码措施（本轮新增或已有保护） | 生产锚点 | 已运行本地覆盖 | 仍独立开放的关闭证据/边界 |
|---|---|---|---|---|
| F01 | Native纸面不透明、clear不swap | bookturn_renderer Draw/ClearSurface | native-core / native-barrier | 各阅读色/图文/正反卷面逐帧合成 |
| F02 | 目标内容准入/调度/隐藏/释放分开；本轮移除两帧绕过 | LRE confirmBookTurnPresented；ReaderPageTurnStage onContentReady | presentation-recovery / native-barrier | 实际上屏无精确display fence；用已准入常驻opaque目标兜底，屏幕连续性仍开 |
| F03 | 表面生命周期及首帧准入；已落盘页不因surfaceLost回滚 | NAPI CallJsEvent；LRE onBookTurnNativeEvent/failBookTurnRuntime | event-dispatch / surface-recovery | 实际旋转/后台/强制surface重建矩阵 |
| F04 | source/target纹理槽固定，按成功方向轮换 | BookTurnHost CommitSlots；LRE promotePreparedPageTurn | native-barrier / page-stage | 图文/回滚/提交中段像素 |
| F05 | A/B两个物理页无条件常驻，数据角色换位 | ReaderPageTurnStage build/slotPage | page-stage / render-work | 全内容、快速交错原生attach/detach计数 |
| F06 | 阅读底不透明，应用与阅读色分工保留 | ReaderThemeRegistry；BookTurnRenderer Clear/Draw | theme / native-core | 全8阅读主题与5模式交错像素 |
| F07 | 静态纹理排除动态高亮，矩形传递Native | ReaderDynamicHighlight/ReadingSurface；LRE onPageDynamicHighlights | highlight / render-work | 高亮卷曲与终帧像素连续 |
| F08 | 五模式基础/故障路径保护保留 | LRE effectivePageTurnStyle/performPageTurn | input / preparation / continuous / presentation-recovery | 完整跨模式视觉/设备矩阵；旧800次样本不继承当前包 |
| F09 | 阴影RGB混合不降低目标alpha | bookturn_renderer glBlendFuncSeparate | native-core | 合成alpha与局部闪烁实测 |
| C01 | Panel按标量响应，几何/属性差分复用；未声称成本消失 | ReaderControlPanel/Runtime；ReaderControlSettingsOptionModifier | option-update / render-work | 原UI 57.926ms/Settings28.515ms仍是历史未分离样本；需当前trace区分UI/layout/filter/GPU |
| C02 | 同帧几何及边界缓存保留 | ReaderControlActorGeometry/ReaderControlSettingsGeometry | option-update / render-work | 实际分配峰值与p95/p99 |
| C03 | 稳定路由与actor发布；宽高布局仍真实执行 | ReaderControlRuntime/ReaderControlPanel | motion-presentation / render-work | layout/GC独立成本，不能由属性减少推出帧率 |
| C04 | 可见行+行内fraction恢复；反向定位序列 | ReaderControlListPositioning/ReaderControlDirectoryContent | list-position / directory-model | 深目录动画中反向/再抓与数据交错真实帧 |
| C05 | 稳定章节key与逐行通知；标题导航安全 | ReaderDirectoryDataSnapshot/ReaderDirectoryList | directory-model / directory-markers / navigable-toc | 远程迟到/下载/删除与动效原生组合 |
| C06 | 停指冻结，时钟接续，异常时间重建速度 | ReaderControlGestureContinuation/Runtime | gesture-continuation / motion-presentation | 十轮连续MOVE再抓、中段清晰度像素与触控延迟 |
| C07 | 去重复clip/Canvas/背景区域分配；不删除设计blur | ReaderControlPanel/ReadingSurface | render-work / backdrop-publication | 约20 blur、GPU、GC长帧和真实layout成本 |
| C08 | 语义保持原最近书签规则 | ReaderControlDirectoryModel；规格§13.5 | directory-model | 不是本轮已确认缺陷：若改最近为scalar距离另定；当前不阻塞修复 |
| N01 | Native VSync消费最新有效样本，无24ms回放 | bookturn_host SubmitInput/RenderLoop | native-host / input | 输入事件→屏幕首像素分布/120Hz |
| N02 | 内侧/边缘/再抓相对锚点一致 | BookTurnMotionState/ReaderPageGestureState | input / settlement | 冷热停指按住、精确末MOVE→首像素及反向 |
| N03 | endGesture原子采样最终UP；首指不被第二指终止 | ReaderPageInteractionLayer；bookturn_host EndGesture | input / native-host | 真实乱序/CANCEL/所有系统事件组合 |
| N04 | 同代次拖动与收尾保留有效Native画面 | LRE FRAME_PRESENTED/finishPreparedPageTurnSettlement | surface-recovery / native-barrier | 同候选首帧/终帧/回滚像素 |
| N05 | 手动80–320ms，端点立即完成，提交前再抓 | ReaderPageSettlementTimeline；Native motion | settlement / native-core | 位置/倾角连续性及多时点再抓屏幕证据 |
| N06 | 代次/同异槽pending纹理重检，失败不发布坏纹理 | bookturn_host UploadTexture；LRE captureBookTurnTexture | native-host / native-barrier | 跨章及失败资源寿命设备计数 |
| N07 | 请求方向优先，当前mounted快照与图片解码准入 | LRE refreshBookTurnTextures/captureDecodedBookTurnPage | preparation / render-work / native-host | 大图冷解码耗时和布局主题交错像素 |
| N08 | 本轮独立content-ready+scheduled ack+有界2D退路 | ReaderPageTurnStage；LRE request/completeBookTurn2DFallback | presentation-recovery / native-barrier | 没有display API回执；不把本地mock当送显证明，剩逐帧连续性 |
| N09 | glyph/scalar→UTF16高亮，64矩形显式降级 | ReaderDynamicHighlight/Native shader | highlight / render-work | 真实字体glyph、GPU和图文夜间像素 |
| N10 | 页chrome/分钟/胶囊几何参与纹理身份 | LRE pageChromeSnapshot/texture identity | session-launch / render-work | 颜色空间/过滤/暗带/分钟双向像素矩阵 |
| N11 | Native worker复制、有限快照复用、轻量UI发布 | bookturn_host；LRE captureBookTurnTexture | native-host / render-work | 27.118ms等历史峰值不改写；GPU/分配峰值/120Hz仍开 |
| N12 | 程序化320、物理80–320、积压点击30独立节奏 | ReaderPageSettlementTimeline/ReaderRapidPageTurnState | settlement / rapid | 真实吞吐、冷准备前延迟、屏幕帧 |
| N13 | 固定纹理/网格与有界cache保护 | BookTurnHost/ReadingChapterWindow/ReadingPaginationIndex | native-host / preparation / render-work | 长时PSS/heap温升功耗；旧heap增长仍保留，不能宣称无泄漏 |
| N14 | surfaceEpoch在C++队列与NAPI交付边界校验 | bookturn_host Attach/Detach；bookturn_napi CallJsEvent | event-dispatch / native-barrier / surface-recovery | 旋转/强制失联/进程退出实测分别开 |
| N15 | slot逻辑提交与release事件区分，丢回执可恢复 | LRE onBookTurnNativeEvent/requestBookTurn2DFallback | presentation-recovery / native-barrier | A清理/B首帧真实交错 |
| P01 | 冷准备保留首指和最新样本，ready同owner接续 | ReaderPageInteractionLayer readinessChanged | input / drag-follow | 冷远程页/首次像素/停指按住延迟 |
| P02 | 最终UP先入arena再判tap/拖动 | ReaderPageInteractionLayer handleTouch | input | 极稀疏反向真实轨迹/CANCEL |
| P03 | 纵向previous映射正确X且镜像对称 | LRE updatePageTurnGesturePresentation | input / settlement | 五模式纵向/横向逐帧动态对照 |
| P04 | none/CANCEL立即复位所有权 | LRE effectivePageTurnStyle/rollback；pointer release | input / continuous / surface-recovery | 系统实际CANCEL与切模式生命周期 |
| P05 | 边界清不可达净目标，反向立即可排 | ReaderRapidPageTurnState reachReaderRapidPageBoundary | rapid / preparation | 原UITest空root一次异常保留，非当前代码复现；设备边界交错 |
| P06 | 固定physical slot和snapshot id；标题不重编号 | ReaderPageTurnStage；LRE promotePreparedPageTurn | page-stage / navigable-toc | 不同内容/快速交错的原生实例计数 |
| P07 | 本轮writing未知有界观察，目标/原锚/foreign裁决 | ReaderControlSelectionTransaction；LRE persistence | progress-observation / page-progress | 真实慢存储；永不返回保持unknown可读并可查询，不强制释放原写 |
| P08 | 冻结projection/revision/provider基线保护仍在 | LRE promotePreparedPageTurn/readingLayout | page-stage / preparation | 原《绍宋》34章6/11页44%缺当时scalar/layout/hash，原因不能从新oracle确认，保留未定位部分 |
| P09 | none ready+durable后无人工视觉延时 | LRE startPreparedPageTurnSettlement | settlement / preparation / page-progress | 点击到ready/慢保存/跨章时间分布 |
| P10 | 方向优先，前驱前缀索引/按需邻章读取 | LRE preparePageTurn/previousChapterMeasurement；ReadingChapterWindow | preparation / navigable-toc | 真实超长章与冷远程目录/正文时延 |
| P11 | 冷指针lease与各输入来源同仲裁 | ReaderPageInteractionLayer；LRE pageTurnInputPhase | input / drag-follow | 冷首像素与手指停住持续按住的真实对照 |
| P12 | 冻结两页/布局，provider及二分索引保留 | LRE pageTurnProjection/ReadingPaginationIndex | render-work / page-stage | 全部内容类型GC/分配/UI+GPU预算 |
| P13 | 分页/Native List共享首指，auto/音量不得抢占 | ReaderPageInteractionLayer/ReaderContinuousReadingStage | input / continuous / rapid | 多输入源真实交错与系统CANCEL |
| P14 | 首授予完整验证，MOVE轻量，单pointer watchdog | ReaderPageInteractionLayer schedulePointerWatchdog | input / drag-follow | 实际输入到VSync关联与长帧分布 |
| P15 | 单调时钟，异常时钟重置速度 | ReaderPageInputClock/ReaderControlRuntime | input / gesture-continuation | 事件/VSync时钟现实对应，不虚构发生频率 |
| R01 | scalar量化/内边距/恢复布局/模式切换锚保护 | ReaderContinuousReadingStage；LRE canonicalModeAnchor | continuous | 超长章冷定位、字体/章尾真实像素 |
| R02 | 本轮单drain永不返回/读失败/foreign/迟到补齐 | LRE commit/drain/persistContinuousProgress | continuous / progress-observation | 真实退出/恢复；进程重启从Core权威行读取，不宣称UI Promise即保存 |
| R03 | fragment+fraction与同期手动位移保留，图片行身份更新 | ReaderContinuousReadingStage restoreImageAnchor | continuous / render-work | 慢解码/多图/字体/章尾原生layout像素 |
| R04 | 首指+500ms tap/longpress，程序滚动清旧手动边界意图 | ReaderContinuousReadingStage handleTouch/scroll | continuous / input | 真实两三指/UP/CANCEL/程序滚动混合 |
| R05 | 滚动上章直达尾锚，不扫描所有分页 | LRE turnPreviousPage/openPageTurnChapter | continuous / preparation / navigable-toc | 超长章耗时、章尾实际视口与重进恢复 |

## Make v17/v9 七组

| 组 | 当前实现与已定边界 | 本轮本地证据 | 剩余层级 |
|---|---|---|---|
| B1 在线配置 | ReaderTtsConfigOverlay五字段（名称/URL/密钥/发音人/格式），secret空值保留与显式清除、取消草稿/失败回填；不是旧“两字段” | tts-config-interaction、tts-product-surface通过；Core/Host GET+POST已有契约 | 真服务授权、POST/音频格式/失败恢复按绑定候选验证；不得虚构真实音频通过 |
| B2 开关/章节定时/试听 | preferences四开关、chapterEnd、0.50x；本轮root已实现auditionVoice与onVoiceAudition，试音独立requestId，停止/失败/正式启动不串线 | tts-preferences、tts-audition、tts-launch-intent、tts-session-coordinator全部通过 | 系统音色可用性、来电/后台/焦点、真实声音与在线服务分开；此前“无试听代码”已过期 |
| B3 主题 | 两套应用palette+八套reading主题registry/联动；same-type保留follow-system，type不符才取消；defaults和主题ID，参考alpha沿用 | theme-selection、appearance及本组阅读快照保护通过 | 全应用/平台颜色与透明度视觉仍按当前候选验收，不能把静态token存在当全像素通过 |
| B4 翻页集合 | 按§11/§13明确保持仿真/平移/覆盖/滚动/无动画；旧Make淡入是另一产品版本，不把仿真改名 | appearance-make、appearance、input、page-stage通过 | 无本轮未决实现；若另增淡入/删模式必须独立产品范围，当前不重复问用户 |
| B5 播放视觉 | ReaderControlTtsContent现有状态点/框/左线/图标/阴影/暂停与空闲配色；本轮重新读取真实PhoneScreen.tsx后补24柱循环（此前静态样本是实际遗漏），ReaderTtsWaveform独立装饰非电平计；胶囊按独立3500ms轨道实现 | control-tts-make、tts-product-surface、session-launch、tts-waveform真实Make轨道/共享clock/冻结源绑定通过 | 完整actor像素/动态对照仍开；真实参考与精确轨道见下段，当前不再留“静态/动画待定” |
| B6 键盘/首击 | TTS overlay已用KeyboardAvoidMode.RESIZE，固定footer+有界Scroll，窗口resize高度回流并离开还原；控制点击有显式命中层 | tts-config-interaction、control-input-routing通过 | IME展开/关闭/切页/重入、可视区域和首击真实交互仍开，不再报告完全无实现 |
| B7 验收口径 | 当前生产方法运行/故障回归已补；静态shape只是接线检查之一 | 本附件实际28组 + 本组20组，不拿旧198数作为完成比 | 产物、VM、真机、Figma和用户接受各自独立，不以音频mock/属性diff关闭 |

## 时值与性能禁止混账

控制展开/收起/直接关闭/恢复的320/260/200/220ms操作节奏属于控制状态机；胶囊完整3500ms是另一个轨道（含等待、启动与生命周期），Native手动收尾80–320ms/积压点击30ms又是第三类。不得混为单一时钟或互相替换。

本轮真实上游AttributeModifier差分13节点、120姿态，24960→7440（70.19%）是属性调用数；该数字不能推导帧率收益。`reader-render-work`覆盖同值/空高亮去重、UTF16单次扫描、120设置姿态零重复path、目录noop纠偏。未剔除设计blur，未声称剩余UI/layout/filter/GPU无成本。

旧57.926/28.515/27.118ms长帧、PSS下降与heap增长、十轮再抓未齐、P08原案缺scalar/layout、图文分钟颜色空间、GPU/60/120Hz/触控到屏幕/长时温升功耗全部保留。它们是有明确采集问题的开放证据，不因此次代码回归或统一ArkTS编译成功而PASS。

复核中额外找到并补完B5波形循环遗漏，以及ReadingOfflineGateway丢navigable/将卷标题计入下载进度的遗漏；本轮没有把这些可确定问题留待设备定位。当前能确定的TOC/简介/目标revision绕过/失联Native无限重试/unknown写观察缺口已在代码和本地层修复。真实永不返回的Core命令不能安全假定未提交或释放其串行lane，故保留unknown可读与查询入口，查询也有观察期限。恢复/重启从同source/book的Core持久行裁决，不能伪造进度保存成功。

## B5真实Make波形补齐与末轮目录复核

权威代码：`../2026-09-11-make-style-parity/tts-reference/src/PhoneScreen.tsx:327` EqualiserBar；`1354` @keyframes wb。24基高 `[7,13,9,18,12,22,15,10,20,14,8,17,11,21,13,9,16,12,19,10,14,8,15,11]`，容器26、柱宽2.5；第i柱时长650+(i%5)*110ms、delay=i*30ms、ease-in-out infinite alternate、scaleY .4→1.15。未到delay之前遵循CSS无fill的scale=1；非playing高度4/不scale、height300ms ease、background350ms ease，playing opacity .75+(i%3)*.12。

ReaderTtsWaveformModel薄采样适配使用平台注入曲线，不重复实现Bezier引擎。ReaderTtsWaveform单共享postFrame clock，Quick/Full同一sample；parent在launchGeneration仅捕获一次已发布frame（不会点击时推进相位），两份sourceOnly冻结该sample，sourceOnly/不可见/控制面板inactive/减动态不运行重复帧驱动；旧owner离开后的迟到callback无效。主题采用既有应用palette角色，去除原来额外*.7 opacity。测试 `test-reader-tts-waveform.mjs`直接读取原Make基高/CSS后逐柱比较delay/正反/循环/300与350过渡，再验证共享frame、冻结、隐藏、owner交接及Panel→两份Source接线；通过日志 `implementation-prior-gap-local/reader-tts-waveform-current.log`。这不是实际音量计，也不是GPU/屏幕像素验收。

目录末轮复核：ReadingOfflineGateway.loadProjection保留volume的canonical index+navigable=false+unknown状态，不去查其image manifest；整书进度总数按可读章；纯标题range不派发prefetch，恶意/旧Core回的标题materialization lease被拒绝。Core此前已在canonical range内跳空URL（保留原index），两层都不重编号。Index负责queued/clear copy也已由页面owner补navigable。`test-reading-offline-gateway.mjs`新增标题projection/range/total/lease四组通过；control-p0目录a11y守门同步更新后通过。
