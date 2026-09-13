# 真机阅读反馈：代码定位、修复及证据边界

Artifact: 9509d4fe, run/SHA in FEEDBACK.md. This audit uses current source, the installed commit's source and existing Figma evidence. No device, build, install or commit operations.

| ID | Recorded cause / current investigation |
|---|---|
| PH05 | Quick Settings label actor height 12 with Text lineHeight 16; its rectangular motion mask clips the label. |
| PH06 | Original Quick ModulePanel owns a radius-8 panel/line outline; shared content migration retained only its viewport. FullContentSurface opacity 0 at Quick is a different actor. |
| PH08/16 | Header zIndex 2 overlaps grabber y19..28, including an enabled transparent Quick header; grabber has no explicit foreground ownership. |
| PH09 | Exact Figma 3500ms timeline exists; visual state settles at 2300, but identical state is still published every native frame during the 1200ms tail hold. Checking input and rendering cost without changing authored duration. |
| PH10 | Shell and footer use different authored curves over 1700..2300. Final 5vp gap does not prevent intermediate intersection. New physical feedback requires collision-free layout while retaining original timeline. |
| PH11 | At 3500 the chrome overlay is removed and page-owned cached chrome becomes visible, exposing a stale footer layout. |
| PH12 | Paused-session resume uses static capsule path; it becomes eligible only after ordinary control dismissal commits. Investigating shared closing presentation. |
| PH13 | Gesture reducer has preview state and 160ms rollback, but no rendered top-right bookmark actor. |
| PH14 | Creation omits Core bookText; list projection discards bookText and renders content only. Unknown chapter length exposes the internal scalar offset label. |
| PH15 | Full content and its underlying surface have the same bounds; content paints after and may cover the bottom stroke. |
| PH32 | Appearance library repeats pageTurn/alignment settings as two 42vp rows. Remove duplicate entry points and the corresponding 84vp space. |

以上为发现时的初始记录。以下是生产冻结后的逐项结果；初始猜测与最终修复有差异时以下表为准。

## 包、来源与结果范围

- 用户反馈包为 `9509d4fe`；run/SHA/保数据安装回执见 `FEEDBACK.md`。本轮读取该提交的8个生产文件，关键原句与行号归档在 `reading-installed-source-facts.json`。
- 本轮未操作 HDC、VM、真机，未构建或提交。下文“修复”指生产源码和本地回归，不指新包、设备视觉或用户验收。
- 本轮按 Figma motion/design-to-code 技能读取原始参考。胶囊 C/D/E/F 的48个actor、3500ms源时间轴继续使用 `../2026-09-13-current-gap-register/capsule-figma-live.json`。没有篡改该证据或声称设计缺少动效。
- 本轮重新读取 Figma `942:70`，其中 `924:69` 明确快捷设置卡片 286×190、8px圆角、panel rgba(255,252,248,.62)、line rgba(180,166,151,.34)；原始返回存 `settings-quick-figma-live.json`。

## 逐项闭环

| ID / 原号 | 已定位的生产原因 | 实施结果与约束 | 本地证明 / 剩余证据 |
|---|---|---|---|
| PH05 / 5 | `ReaderControlSettingsContent` 把Full字体11/行高16固定套在Quick高12的label actor上，`sharedClip`又按12裁切；不是只有外层位置错误。 | `ReaderControlSettingsContent:210` 随同一个p取Quick字体10、行高12至Full字体11、行高16；行高直接取实际label高度，保留原bar位置、54vp行距与动态clip/cache。没有把选项整体往下猜移。 | 实际SDK Builder检查完整字行在clip内、标签底不超过bar顶；把固定16恢复后红测失败。42个正反向/宽度/主题状态及滚动clip通过。真机字形视觉待新包。 |
| PH06 / 6 | 共享Stage迁移只保留ContentViewport，遗漏原Quick ModulePanel的独立card。先前把恢复稿AddedActor/FullContentSurface的Quick opacity0解读成“Quick本来没有外框”是错误结论。 | `ReaderControlPanel:860` 恢复独立Quick表面，按当前viewport宽高、8vp圆角、既有panel/line角色随1-p退场。Home/TTS保留自己的card，避免双底色；FullContentSurface仍按p入场。 | SDK Builder证明Quick表面可见、Full为0，原Full表面契约保留。原Figma原句已归档。其它Quick模块沿原共享panel/line体系恢复，未新造色彩。设备轮廓待新包。 |
| PH08 / 8、PH16 / 16 | Header zIndex2且透明Quick header仍可命中；header y19..49与grabber y0..28的下9vp重叠，grabber处于默认层。 | `ReaderControlPanel:896/919` 透明header禁用命中、完整72×28 grabber升到zIndex3。仍由既有raw-touch Runtime完成tap/drag/CANCEL；没有另加onClick或第二driver。 | SDK层级红绿验证旧层级会失败；原7模块Runtime/手指时间归一/Link交付及输入路由回归通过。这里只证明明确拦截缺陷已消除，不把本地探针称为真实手指验收。 |
| PH09 / 9 | 源设计动作至2300ms、尾hold至3500ms完整存在。旧实现尾hold1200ms每帧仍发布等值状态；业务ACK没有再另开dismiss时钟，尾hold也不应阻止胶囊/正文操作。用户这次明确要求实际时长缩短。 | 统一Controller时间倍率0.5；所有actor/页码/状态栏/源释放仍共用同一designTime。有效动作1150ms，完整1750ms；hold只安排一个600ms终点任务，不每帧刷新。取消、后台、离页、Reduce Motion沿原generation/owner撤销。 | 四入口实生产Controller检查350/700/850/1150/1750边界、源资源一次释放、取消后迟到hold无效。旧48actor的源时间域54000项比较保留，PH10位置覆写单列；不能称改后实际毫秒与原稿相同。帧率/主观时长待新包。 |
| PH10 / 10 | 原稿1700–2300 shell用(.2,0,0,1)，页码用ease-in-out；最终5vp间距无法保证中段不交叠。 | `ReaderSessionLaunchPresentation:217` 在两者共占底栏后的阶段，页码x取min(原轨道,当前shell左缘−终态左缘)。保留所有原轨道时刻/透明度/图标显现，按本次用户“不可重叠”增加响应式空间约束。 | 四入口700–1750实际毫秒逐3ms几何验证页码右缘始终≤shell左缘−5。原稿Quick TTS终态+2px也收敛至不侵占该5vp间距，明确为新反馈驱动差异。字体/设备动态像素待新包。 |
| PH11 / 11 | 3500原终点关闭Chrome overlay，重显page-owned冻结快照/纹理；可能把页码送回未预留胶囊的位置。 | LRE:1952、8072让整个会话持续使用同一个overlay owner；达到hold/terminal不移交给旧纹理。仅锚点/文本/实际page revision变化时刷新，翻页事务冻结期继续读已捕获值；结束/取消通过既有退出交接释放。 | Host生产方法验证当前12→24锚改变、冻结期不跳50、禁止读取旧renderPage快照；到1750 overlay仍保持，所有权结束才释放。设备快照交接待新包。 |
| PH12 / 12 | 已有/暂停会话恢复使用静态capsule路径，原eligibility直到control dismiss提交才放行。只修按钮hideControl仍会遗漏Panel内驱动的手势关闭。 | LRE:1727、7862、8504同时接语义和实际手势关闭边沿：首个closing frame即可挂已有capsule与预留页码；100个后续视觉帧不重复发布owner。反向重新打开撤销准入，未重放新launch。 | 生产方法验证button closing、gesture closing、100帧一边沿、反向取消；业务ACK仍不新开动画。实际正文/胶囊同帧观感待新包。 |
| PH13 / 13 | 原手势有48vp阈值、半峰反向preview和160ms回弹，但没有读取preview的右上可见actor。 | LRE:10312接右上24vp既有Tabler书签资产，位置依据当前信息栏/安全区；跟随原page offset和160ms回弹。手指态显示松手添加/移除/取消；持久标记只由Core确认的当前页书签状态驱动，unknown/失败不假报成功。状态查询按条目投影与页锚缓存，避免每帧遍历目录。 | SDK Builder六态（加/删/撤销/空/已确认/未知）验证可见性；原gesture合同与CANCEL/回弹测试继续保留。复用已批准图形，但这次补接的右上组合不是新读到的完整Figma motion节点，不宣称逐像素原稿一致。真机手感和成功反馈待新包。 |
| PH14 / 14 | Core字段bookText是正文，content是笔记。旧LRE→Index→Gateway创建没传bookText；list又丢弃bookText，列表只读content；未知章长度直接显示内部“偏移N”。 | LRE:10338从当前页精确scalar范围截最多160字符正文，Index:3888/Gateway:369贯穿bookText；原笔记不覆盖。Projection以bookText呈现摘要，内部offset不再作用户文案，真实跳转锚不变。LRE:5734对当前已物化章旧空摘要做显示侧补全，缓存按book/chapter/contentVersion/time/anchor≤128；不联网、不写旧数据。 | 真实Gateway请求/回读、emoji+CRLF、旧记录不变、笔记保留、锚不变、缓存上限及稳定引用通过。**异章旧记录仍可能没有历史正文；当前显示“暂无正文摘录”，待该章本地正文可取后补，未批量下载或伪造旧摘要。** |
| PH15 / 15 | Full内容viewport与底板同边界，内容在底板border之后绘制，opaque行可盖住底描边。 | `ReaderControlPanel:879` 把单次stroke放到内容后的独立无命中层。原底板不再重复画stroke，避免叠加alpha加深；Quick8→Full12同p，只有原有FullSurface模块画Full内容描边。保留外壳和子卡几何。 | SDK检查Full描边在内容层之后、原surface没有第二遍border；alpha/角色不变。底角像素仍需新包。 |
| PH32 / 30 | Make V9沿用了更早存在的重复pageTurn/alignment，迁移排版时未做与Settings的职责去重。它们不是本轮刚添加。 | Content:549去掉两行和隐蔽选项路由，Full排版库406→322、背景338→254、最低滚动内容773→689；主题第9/12行扩展仍递增。仅保留缩进/简繁/字体与四个排版数值。备用旧FullPanel无生产外部入口，也同步删除重复行。 | 实际选择器验证重复kind不可打开/无写，原排版字体/单位与主题扩展回归通过。来源精确链见 `search-settings-audit.md` PH32：早期d6966fc9及9/11 task-only.patch旧y158/210→V9 y122/164，不能归为V9首次引入。 |

## 统一时间映射

| 事件 | Figma原始时间 | 当前生产实际时间 |
|---|---:|---:|
| 用户意图/源首帧 | 0 | 0 |
| 信息栏开始呈现、控栏开始退场 | 100ms | 50ms |
| 源区域开始飞行 | 200ms | 100ms |
| 控栏/状态栏呈现所有权交接 | 700ms | 350ms |
| 圆点位置完成、源资源可释放 | 1400ms | 700ms |
| 胶囊扩展/leading开始显现 | 1700ms | 850ms |
| 视觉终态 | 2300ms | 1150ms |
| hold结束 | 3500ms | 1750ms |

业务ACK不换算、不等待视觉终态、不触发第二套动效。准备期间点暂停仍先记desired，服务准备完成后不得先播再停。Reduced Motion直接使用终态；手动打开控制栏从当前采样姿态交接，源准备完成的确认继续有generation门禁。

## 本地门禁与交付边界

- `reading-local-regression.json`：实际生产Controller、实际SDK Panel原生属性与层级、Host尾hold/关闭边沿、Core字段/旧摘录恢复的记录。Builder探针不能模拟最终合成器像素。
- `/private/tmp/reader-physical-reading-tests.json`：27组定向回归全部0退出，涵盖session、settings、control几何/层级/runtime、appearance、bookmark、pageChrome和render-work。
- 最后接线后追加运行 `reader-physical-reading-repair`、`reader-control-replace-host`、`reader-control-host-keyboard`、`reader-control-input-routing`、`reader-replace-quick`、`reader-render-work`、`reader-book-turn-architecture`、`reader-control-playback-host-intents` 均通过。根agent负责总门禁与真实ArkTS编译。
- 剩余明确证据层：新候选包构建/签名、设备动画连续帧、实际点击/反向手势、PH13右上可见反馈、PH14异章旧空摘录、用户审视。不得把本地修复记为这些已通过，也不得把已定要求重新包装成用户待决。

生产修改已冻结。后续只按总门禁发现的具体问题修补，不扩大审计范围。
