# 当前页面、导入、搜索、正文边距与亮度审计

本次仅审查 Harmony 当前工作树（检查时 HEAD `50cad401ffc6d235f4ac388136ee5213b9b736ad`），不修改生产代码、不提交、不操作 VM/真机。以下“已改”表示源码事实；不是最终视觉/设备验收。与旧回复冲突时，以列出的生产路径和探针输出为准。Figma 节点编号来自现有代码与历史交接，本次没有现场读取这些非胶囊节点，不能把注释认作最新动效参数证据。

## 1. 导入入口、异步生命周期（原问题10）

### 已改

- `features/bookshelf/LocalImportDialog.ets:149-151`：中间“从系统文件中选择”区域已接 `onSelectFiles`，底部按钮在187行接同一回调。
- `pages/Index.ets:5170-5205`：现在先 await `selectLocalBookInputs()`；返回非空选择后才写 `importing` 并调用 `importPreparedSelections()`。此前“先正在导入后文件选择器”已在当前源码调整。
- `features/bookshelf/BookshelfFlowGateway.ts` 已拆选择与导入边界；入库事实仍由 Core 返回。

### 确定缺口

- **旧布尔值越过 await**：Index 5182 行计算 `isStillOnBookshelf`，5190 后 await 真正导入，5196/5199/5202 仍使用旧值。用户导入期间离页或导航 generation 改变，结果依然能写入当前展示。
- **选择器防重不完整**：入口仅防 `state === importing`；picker 尚未返回时 state 仍 fileSelection，重复入口可能启动多个选择事务。
- 仅用 navigationGeneration 不能区分同一路由上两个先后导入请求。

### 实施约束

1. 建立独立 `importAttemptId`，记录 route generation、runtime owner generation；从 pickerOpening 起占用一个入口 owner。
2. 在每个 await 后重新读取 route/attempt/owner；禁止跨 await 复用布尔值。Picker 取消不显示“导入完成”，重入不创建第二个 picker。
3. 入库成功后即使离页也失效旧书架读 generation，但只给当前同一事务写 UI；不能撤销已成功入库来“修复页面跳转”。
4. 离页/关闭时清理 Host 选择临时资源、取消未开始工作；已经提交的 Core 数据保留。晚到结果不得重开弹窗或覆盖新导入结果。
5. 回归覆盖 picker延迟、取消、重复点击、导入中离页、返回同一路由、新导入抢先完成、旧请求失败晚到。

## 2. 导入结果页与动效（原问题9、11）

### 已改与未改

- 结果列表**已经是 Scroll**：LocalImportDialog 354-369。滚动是用户已定规则，无需再问分页。
- 结果高度已从固定636改成 `min(636,226+min(410,max(61,count*61)))`，478-486。单本为287vp，不能再说仍固定大半屏。
- 但只读取 viewportWidth，没有读取可用高度；636/410仍是固定上限。小屏/横屏/系统字体放大时不闭环。
- 行高只是假定61，真实失败行还可附两行错误文案（398-399），因此数量×61不是实际内容高度。
- 摘要图标仍无条件 `import_summary`（309）和红底 `#FDECEA`（313）；该SVG确为红色感叹号。不是单行结果状态判断失效：单行右侧404-407已经成功/失败分支。
- 右侧 `import_refresh.svg` 原始24×24带变换clip，UI又缩为18×18并rotate(-113.93)（334-340）。资源已经嵌有旋转裁剪，再旋转会继续改变构图；须用原始对应节点核对/重导资源，不能只扩大按钮掩盖。
- 完成按钮仍 `min(201,panelWidth-32)`、左对齐（273-294/474-475）；没有实现“占内容容器宽度”的新规格。
- 导入中223-225是三张静态SVG，没有旋转/时间进度；63-69直接条件切换三个面板，没有完成和结果交接动效。

### 实施约束

1. 结果状态按真实batch投影全成功/部分成功/全失败/待确认，摘要图标、底色、文案同源；成功不能复用警告资源。保留每项具体失败原因，不伪造未导入项目。
2. 外壳高度 `min(实际内容高度,安全可用高度)`；可用高度由视口减顶部/底部系统安全区和设计最小边距。头部、摘要、完成按钮测量后固定，剩余高度分配给结果列表，超出滚动。
3. 列表使用真实行测量或支持动态行高的原生列表；宽度变化、字体缩放、错误文案增加均重新预算。0/1/2/7/50本、长中文文件名、混合失败、横屏短窗口必测。
4. 完成按钮使用结果内容宽度，保留既有高度/圆角/字体；禁止借适配改字重、字号或整个面板等比缩字。
5. 导入UI状态至少有 pickerOpening、importing、settling、result、cancelled；业务状态和动画状态分开，真实完成即更新数据，呈现可以完成当前必要转场；不得人为延迟入库。
6. 使用已有spinner track/arc/halo资源和Figma对应轨道，spinner只转弧线而不是整块文案；完成标记和结果面板按已定义设计衔接。时间参数必须由对应设计轨道填入，不可从胶囊或控制栏320ms抄值。
7. 稳定动效owner、帧回调可取消、后台停动画；取消/失败/瞬时完成/降低动态效果均有确定可见终态，不无限转圈；不以动画伪造解析进度百分比。
8. 已有参考：Figma file selection2657:916、importing2899:58923、result2657:917。以上静态节点有据；最新完整motion数值须由设计读取者归档，不再向用户索要设计。

## 3. 搜索历史与搜索加载（原问题13、15）

### 已改

- SearchPage 527-555：原先固定前4项+同行更多，已把展开/收起入口移到独立尾行并靠右；609-636已有收起文案和反向切换，状态进入 `viewState.historyExpanded`。
- 308-323：LoadingProgress已提升到搜索状态内容外的共同Stack，loading→results不再依靠两处重复定义的loader。
- `isSweeping()` 330-332保留loading与results.searching期间显示，用户停止搜索仍可操作。

### 剩余/根因

- 折叠仍硬取4项，和可用宽度、实际换行无关，短词时第一行右侧仍可大量空白。尾行按钮已经固定相对位置，但没解决前4项的使用空间效率。
- 加载仍是原生 `LoadingProgress(36)`，没有导出的Figma actor/keyframes映射，不能称Figma完整一致。
- loadingContent 643-660的文案也固定bottom48；共同Stack中的spinner也bottom48，存在同一底部区域叠放的几何风险。移出loader后原文案相对关系未同步改为一个测量组。
- results/empty会插入groupScopeRow（304），因此共同Stack本身高度/顶部会随状态改变；“一个loader节点”不自动保证屏幕坐标不跳。

### 实施约束

1. 历史按可用宽度和字体测量计算折叠行数/可见项；保留原chip字号/圆角/间距。不要以固定4项替代两行/设计高度约束，也不靠塞空白占位固定按钮。
2. 更多/收起固定在同一尾行锚点，不随最后一个chip长度漂移；展开后全量可滚动，收起回到稳定历史区，保留键盘与搜索输入状态。
3. 加载indicator由query generation唯一持有，loading→首批→后续批次不卸载重启；停止/完成/失败结束。共同容器锚点以整个搜索安全视口为基准，不依赖当前结果分支高度。
4. spinner与说明文案建立一个测量组，明确间距、底边距和results时是否显示文案，避免二者都定位bottom48造成覆盖。
5. Figma原有图形和轨道优先，已有顶部/底部用户修改规则继续继承；不能为了连续性擅换造型/尺寸/转速。参考历史节点2635:58801，完整motion参数需归档。
6. 回归：0/1/4/5/30条、短长中文和emoji、窄屏/字体放大、历史清空；loading→results→streaming结束、停止后晚到批次、切query、出入页面；同一屏幕锚点、没有双loader、无触摸遮挡。

## 4. 正文左右边距（原问题18）

### 当前与历史基准

- ReaderLayoutGeometry 64/82：原有手机32vp、平板44.44vp；本次git diff前后都保留这两个数。
- 当前新增 `ReaderContentInsetProfile` 默认仍32/44.44（32-39），生产调用 LocalReadingExperience:5461 没有传自定义profile。
- 几何251行 `Math.max(profile.contentHorizontal,configuredHorizontal,safeHorizontal)` 把32/44.44当不可降低下限，所以传手机24也无效。
- 现有测试 tools/test-reader-layout-architecture.mjs:47-49 **明确把配置24仍得32当作正确要求**，会掩盖缩边距改动未生效。
- 原有手机390vp实际正文宽326vp；377vp为313vp。此前回复引用352/620/720是通用页面内容列宽，不能当作已验证的阅读正文基准。

### 建议的完整自适应实施规格（新方案，不冒充历史原值）

- 手机基础边距 `clamp(16,24*viewportWidth/390,28)` vp；大窗口继续以历史44.44vp作为基础，在宽屏增加居中限宽约束 `max(0,(viewportWidth-720)/2)`。
- 最终左右使用同一个 `max(基础边距,有效左右安全区最大值,宽屏限宽边距)`，保持正文居中，不再额外max旧32。
- 390宽得到24/正文342；320宽约19.69/正文280.62；760宽44.44/正文671.12；1024宽152/正文720。有效cutout/system inset优先，禁止正文进入不可读安全区域。
- 缩放字体不缩容器或字体；仍由同一真实布局生成分页宽度、ArkUI排版、native翻页纹理、连续滚动宽度、选区命中坐标和顶部/底部信息投影。不能只改Padding而不刷新分页缓存。
- 读者已有明确存储值（若后续发现）必须保留，默认值迁移不覆盖个人选择；布局revision变化重新测量，恢复Core阅读锚点，不按旧页码猜进度。
- 回归320/360/377/390/430/600/760/1024、横屏/分屏、刘海单侧、系统字体1/1.3/2、TXT/EPUB/在线、仿真/平移/覆盖/滚动；比较排版宽度和绘制宽度必须相同，无左右二次padding。

## 5. 自动亮度状态与实时拖动（原问题19、20）

### 已改

- ReaderControlPanel 1545-1562已经MOVE即时预览，并尝试每16ms提交变化；END不再是唯一入口。
- LocalReadingExperience 8730-8766已有Window串行写与generation过期淘汰；离页恢复原窗口亮度8789以后存在。不能说当前完全没有实时路径。
- 自动状态确实从 `brightness < 0` 投影（8780），onAuto调用setWindowBrightness(-1)；这个是跟随系统窗口策略，不能直接等同已打开设备全局环境光自动亮度。

### 确定风险

- 每次MOVE先增加generation，队列到任务后await getLastWindow，再次校验。若窗口获取超过MOVE间隔，每次获取到窗口时都过期，被跳过；持续拖动期间可能一次系统写都没有，停指后才写最后值。生产方法探针已复现。
- END在系统ACK前把preview设为-1（1568），会回显旧brightnessPercent；state只在最后ACK后更新（8755）。因此有脱手回跳风险。
- 当前16ms是事件节流，未安排“被节流掉的最后一次MOVE”尾部flush；停指仍按住时，最后值可以一直不发送。
- `A`背景、描边、文字固定；选中态仅opacity 1/0.72（1492-1519）。已有可见状态不是完整Figma状态复现。
- Cancel只丢preview，之前已写的系统亮度没有明确提交/回滚语义。自动模式下percent保留上次手动值，滑块不代表系统实际环境亮度。

### 实施约束

1. 按窗口lifecycle取得并复用有效Window handle；同一生命周期不为每个MOVE异步重复查窗口。句柄失效时重新获取，不能让持续input不断废弃唯一lookup。
2. 使用一个在途系统写+一个latestPending目标；在途完成后立即写最新值，不能给每次MOVE建立无限Promise链。generation仅拒绝离页/旧owner的结果，不能让当前owner的每个请求相互饿死。
3. 每个MOVE同步更新UI期望值和手动意图；16ms/单帧合并必须安排尾部flush，即使手指停住未抬起也写最新值。
4. END确保最新目标送达；ACK前保留optimistic值，成功确认，失败恢复已确认值并给非阻断错误反馈。旧ACK不得覆盖新值。
5. 自动/手动互斥同一队列，自动意图不得被先前手动晚到覆盖；自动图标按Figma现有状态的颜色/边框/资源投影，并使用应用主题，不另造选中样式。
6. Cancel固定采用当前已发出的最新值作为最终值（避免取消引发亮度闪跳），离开阅读页按现有窗口owner规则恢复进入前策略。持久化仅在真正完成手势/明确模式变化时写，不能每帧存配置。
7. 本地通过mock Window 0/8/24/100ms lookup和write、失败、退出、重复自动/手动、MOVE停止未抬手、END前ACK/后ACK验证；必须证明拖动期间至少有系统写，pending有上界，最后值最终收敛。真实亮度帧延迟需后续VM/按授权设备层证据，不能由方法探针声称通过。

## 6. 书架模式持久化补充风险（本轮关联审计）

- WebDavCredentialStore:92-98先读取Asset配置；load:88把缺省模式补成cover，因此一旦存在旧WebDAV配置，Preferences里已保存的list可能永远读不到。
- saveBookshelfViewMode:102-122仅将Preferences写串行，114先释放队列，然后116读取Asset、122全量save。两个模式请求可以反序完成全量写；与SyncGateway:132-149编辑凭据并发时，还可能拿旧凭据覆盖新凭据。
- 实测生产方法 list→cover：Preferences最终cover、Asset最终list，下次load又以Asset的list为准。
- BookshelfPage:174-181的异步恢复没有mounted/user-selection revision检查，晚恢复可以覆盖用户刚刚的模式选择；持久化失败在1156静默吞掉。

实施约束：本机非秘密配置以单一Preferences记录为事实源，继续在WebDAV本机配置模块下管理；Asset仅存秘密字段。旧Asset模式一次迁移仅在本地键不存在时使用，迁移完成后不再双写。若必须保留双介质，读改写必须在一个串行事务owner内部且带revision，不允许先读旧快照再排队全量写。配置恢复不能覆盖用户更新的selection revision；恢复默认是显式重置配置操作，删除WebDAV凭据不能无意清除本机书架模式。测试连续切换、配置编辑同时切换、局部写失败、冷启恢复、旧版本迁移、无WebDAV凭据与已有凭据两种状态。

## 7. 本地生产方法探针结果

探针使用现有 `productionMotionMethods()` 提取未修改普通生产方法，依赖通过mock提供；正文调用生产 `resolveReaderReadingLayout()`。这不是ArkUI布局或设备像素模拟。

```json
{
  "importLateResult":{"route":"reading","applied":true,"resultState":"result"},
  "modeRace":{"latestIntent":"cover","local":"cover","secure":"list"},
  "layout24":{"actualLeft":32,"bodyWidth":326},
  "brightness":{"lookupDelayMs":24,"moveIntervalMs":16,"dragStop":161,"writes":[{"target":0.7,"at":185}]}
}
```

亮度探针只在最后一次MOVE结束后写一次；精确墙钟受调度影响，核心判定是整个连续MOVE窗口没有任何写入。

探针脚本：`/private/tmp/reader-surface-current-probe.mjs`。生产内容未修改。问题记录止于本文件，由root统一合入现有根审计和全量实施规格，不另建待办或日期方案。

## 8. 本轮获授权后的实施与本地证据（补充前述只读审计）

本节记录 2026-09-13 工作树的实际实施；上文 1—7 节保留的是实施前审计证据，不代表这些生产缺口仍未修改。没有在本节把源码、本地回归、ArkTS 编译、产物、VM/真机及用户验收合并为一个“通过”。本子任务未提交 Git、未运行设备操作；最终提交/正式构建由主任务统一执行。

### 已落地的页面、状态与本机配置

- **书架四行**：`ShelfBookListDetails.ets` 与 `ShelfBookPresentation.ts` 统一普通/批量列表；书名 15/18.3、作者 12/15、最新章节 11/13.75、标签/进度 10/12 延用原文字规格。最新章节不再退回当前章节。来源使用实际名称，缺失短标识不显示 URL；来源/进度是三个等权槽位中的左槽/中槽，第三槽留白以保持几何居中。分组过滤保持 Core 原顺序，不另排序。已删除旧未调用的来源/章节/进度重复实现。
- **书架入口**：筛选行与轻量默认分组选择器独立展开；齿轮不再打开完整 CRUD；More 为批量管理、本地导入、书架设置。当前显示模式的批量视图复用同一列表行。单书菜单是不透明、按可用安全宽度的 75% 布局，编辑分组仅显式选择“默认”时写入，打开弹窗不改历史自定义分组。书架设置页与应用设置入口共享 `BookshelfSettingsPage`，自动检查更新与显示模式已接行为。
- **永久模式**：`WebDavCredentialStore.ts` 以 Preferences 为唯一非秘密模式持久化来源；仅当地 key 真缺失且迁移 marker 缺失才读旧 Asset 模式。读/迁移/写共用队列；新版秘密 Asset 不再镜像模式。flush 失败撤回内存待写值；快速切换以最后确实落盘的 ACK 作为回退基线；初读失败的重试只重读，不把未知的旧选择覆盖为默认。书架/设置的用户写入先经过 `ReaderThemeHost.prepareUserChange()`，恢复后再读取 durable baseline，并检查页面 generation。
- **导入**：`Index.beginImport` 从 pickerOpening 起绑定 attempt、navigation generation、runtime owner；每个 await 后重新验证。取消/关闭/离页/相同路由重开不会被旧结果覆盖；未使用的 picker 资源清理，已入库 Core 数据保留。结果基于真实回执区分 created/existing/失败/待处理，不合成成功数。成功图标、右侧刷新 SVG 的裁切、318@350 按钮、真实头/摘要/脚/行测量、短列表收紧和长列表滚动已接。小高度下非固定底部内容进入滚动，完成按钮保持可达。
- **导入动效**：保留一个不透明外壳；旋转圆弧 1000 ms linear，背景/减弱动效不跑连续循环。经本轮授权实施的切换值为导入层 120 ms、外壳高度 220 ms、结果层延迟 80 ms 后 140 ms；这些值仍标注实施方案来源，不冒称历史 Figma 的原始参数。新测量值按剩余时长重定向，不等待动效才提交业务结果。
- **搜索**：历史按实际字体测量和实际可用宽度保留两行，不固定四条；展开/收起动作在固定右侧槽位。上下两个 spinner 复用 Make 的 1000 ms linear native actor，保持同次请求 owner；底部 actor 锚定整体安全视口，结果行流入不将其挤动。Host 简介只处理显示空白；通用 HTML/实体净化由 TOC 子任务在 Core 既有 `intro` 返回投影使用上游标准实现，原始存储不改。
- **目录/更多接线**：Index 用共享 acquisition coordinator 接入已缓存目录，去除先拦删源/停源与 catch-all 在线重取；安全错误摘要保留分类。卷标题保留 canonical index，remote map 与后续复制带 `navigable`，初始/换源候选跳过 URL 为空的条目。阅读“书籍信息”先走原串行退出，再复用既有 book/session/TOC 到详情，无重搜/重取目录。进一步发现的 `ReadingOfflineGateway` 卷标题离线投影/下载问题已交 TOC 子任务补齐，不把本 Index 接线当作其已验收证明。

### WebDAV 主题与书架模式备份，以及可恢复的跨存储提交

- 现有加密配置包内增加版本化 `hostConfig`，仅包括 bookshelfViewMode 和主题四类选择。Core 强类型白名单拒绝 RGB/主题定义/密码等扩展，Host 编码也只复制这组字段。缺 hostConfig 的旧包保留现有主题/模式；冲突仍必须手动选择。仅 Host 不同时即使 Core 一致也产生冲突。
- Host `capture()` 使用 `ReaderThemeHost.durableBackup()`；Host decode 在 journal/Core apply 之前调用共同主题目录的纯 `restoreReaderThemeSelection`，拒绝已知 ID 伪造 scheme，未知 ID 使用相应默认主题回退。
- 完整顺序：持久化只含 operationId/checksum 的 Host journal → Core 原子配置 apply（同一 SQLite 提交写入受保护 receipt）→ Host 模式/主题落盘 → 幂等 commit → 清 journal。operationId 复用已锁定 getrandom 提供 128 位随机值，避免进程重启后原递增计数器撞 ID。
- `transaction.commit.queryOnly` 可在旧内存 transaction 消失后查询 durable receipt。receipt 存在则继续完成先前已确认的 Host 选择；缺失证明 Core apply 未发生，不写 Host 选择并清理未完成 intent。丢失 apply/commit 响应不重复套用旧快照。receipt 是有界单条业务凭据，复用既有 durable generic-cache 机制，用户清缓存保留，ConfigSnapshot 备份白名单排除它。
- resolve 与最终 storage.apply 都按配置白名单合并到最新用户数据；最终 rebase 与替换覆盖 source publication guard，避免 Host journal 等待窗口把新阅读位置等用户数据替换成旧快照。重复 apply 收到同 operation receipt 时返回当前数据，不重放旧进度。
- Core/Host/设置入口共享 owner 级恢复 Promise；中心恢复屏障防止“启动恢复失败后接受新主题，然后旧恢复覆盖新选择”。Store 另对未完成 journal 的模式写入校验 restore operation owner。

### 原始本地回归与证据边界

- `/private/tmp/reader-surface-final-contract-results.json`：17 个当前页面/旧合同迁移/导入/错误投影/同步生产探针子集全部通过。旧断言被替换为当前实际边界；包括零进度“未读”、非整百分比、canonical 7 且空 URL 卷标题、真实 Index 取消/失败/返回/信息入口。
- `/private/tmp/reader-webdav-host-config-tests.log`：8 个 Core WebDAV 产品测试通过，包含 Host-only 手动冲突、加密内字段、旧备份、真实磁盘 SQLite 关闭/重开、重复 commit、错误 operation、cache-clear 后 receipt 保留和不进入配置备份。
- `/private/tmp/reader-webdav-final-apply-rebase.log`：2 个 Core 单测通过；覆盖最终合并保留偏移 120、随后 180、重复 apply 不回退；同时验证随机 operation 形状和严格查询边界。
- `/private/tmp/reader-webdav-runtime-storage-apply-tests.log`：既有 2 个 storage.apply 取消/关闭/坏载荷/Host CAS 失败回归通过。
- `/private/tmp/reader-webdav-contract-tests.log`：reader-contract 本地测试通过；`/private/tmp/reader-webdav-host-config-clippy.log` 为该阶段 Clippy `-D warnings` 通过日志。主任务将在最终冻结源码上执行完整 Core 门禁，不能拿此前阶段日志替代最终产物证据。
- 本子任务前半段 EPUB 标准语义单路径已完成，真实语料原始证据 `/private/tmp/reader-projection-corpus-results.json`、`reader-local-book-projection-regression.log`、`reader-local-book-projection-clippy.log`。13 文件校验/元数据位置检查与单本耗时均达当时本地目标；不扩大为视觉和设备验收。
- **仍独立开放的证据层**：完整工作树最终 ArkTS/正式 HAP/NAPI、VM 的真实系统文件选择器和动画/小窗/大字体行为、真机表现与用户验收；这些由主任务继续收敛。本页静态 geometry 和 native animation 参数回归不能证明设备上每一帧效果。


### 9. 最终可达界面局部颜色漏接修复（本轮源码）

现象/定位：批量 App 主题迁移未覆盖文件顶层的局部色常量，导致设置分段控件、同步行/按钮、书源状态、发现筛选、RSS 表面、目录边缘淡出及书签动作仍保留固定 Day 色；书架设置另有一处 Color.White。全部为当前源码可直接定位，不申请设备取证。

现已移除 45 个顶层固定色常量及 1 处 Color.White，在 canonical registry 新增 46 个 App 角色，76 处实际消费使用 readerAppScheme 响应式读取。逐项原始 Day、Night、alpha 与源位置已追加同目录 theme-consumer-bindings.json（originalConstant 字段）；无临时测试色表进入生产。原 Day 和 alpha 全保留；Night 表面/文字/边框采用已批准语义，绿色成功、红色错误和中性未验证状态仍分开，未用主色替换所有状态。

| 当前文件（entry/src/main/ets 下） | 局部角色数 | 实际绑定数 |
| --- | ---: | ---: |
| `features/common/ReaderSegmentedControl.ets` | 6 | 6 |
| `features/sync/SyncPage.ets` | 7 | 17 |
| `features/source/SourceManagementPage.ets` | 8 | 12 |
| `features/discover/DiscoverPage.ets` | 5 | 6 |
| `features/rss/RssEntryDetailPage.ets` | 2 | 7 |
| `features/rss/RssSourceFeedPage.ets` | 2 | 3 |
| `features/rss/RssPage.ets` | 11 | 17 |
| `features/reading/ReaderDirectoryModulePanel.ets` | 2 | 4 |
| `features/reading/ReaderBookmarkRow.ets` | 1 | 2 |
| `features/reading/ReaderBookmarkEmptyState.ets` | 1 | 1 |
| `features/bookshelf/BookshelfSettingsPage.ets` | 1 | 1 |

ReaderAppearanceSharedActors 的主题枚举、名称和色块也删除旧硬编码，直接调用现有 ReaderControlAppearanceStyle → ReaderThemeRegistry 读取；这仍是阅读主题预览，不改成 App 色块。该共享旧外观树的可达性与当前主控制树分开记账，不作为当前 UI 设备验收结论。

本地证据：test-theme-local-consumers.mjs 执行实际 SourceManagementPage 状态颜色方法，扫描上述 76 处绑定并验证 46 个角色 Day/alpha/Night；日志 /private/tmp/reader-theme-local-final.log。test-reader-control-geometry、test-reader-appearance-make 均通过，分别检查上下边缘渐变和共享色块的真实方法。12 个修改 ETS 经 DevEco ETS AST 解析全部通过；generate-theme-registry --check 通过（559 个 App 角色×2、8 个阅读主题）；SVG provenance 337 资源通过，几何与路径未改。构建/VM/真机/视觉验收由根任务单独记录，本次未操作设备、未提交 Git。


### 10. 最终交付复核发现的合同漏接与复位实现

本轮代码复核确认原“恢复默认”行在 unimplementedSettings gate 下且没有事件；不是视觉待验。现仅解除该行门禁，保留其它未实现设置 gate，新增原生确认与真实 SettingsOrchestrator.restoreDefaults → LocalConfigurationReset 协调器。确认范围明确为通用四项、书架 cover、App system/默认 day/night 与当前系统对应 active、阅读排版/阅读设置、Host 朗读偏好；保留 Core 所有书籍/源/进度/书签、朗读服务配置/凭据、WebDAV 凭据、设备身份、导入字体文件。不触发 storage.clear、cache.clear 或删除数据；不是整机配置重置。

协调器先经过既有 WebDAV receipt/journal 屏障，再持久化 reset intent，逐一用现有 Preferences 与 AppearanceStore 完成、最后确认清除 intent。失败/失联/重启保留前滚恢复记录；入口和手动配置变更先恢复，失效 owner 不能继续写后续域。Settings/ReaderSettings/TtsPrefs 队列改为同 context/owner 共享，防旧实例 flush 越过复位；非复位写和新页面读走统一屏障，内部 resetOwned bypass 防自等待。通用开关按 changedKey 在实际队列内重读确认快照合并，避免旧快照兄弟字段覆盖刚恢复的默认。Preferences flush 失败恢复缓存中的确认值。显式 request 与只读空 recover 竞态已有生产方法回归，空 probe 不能吞复位。

新正式工具 test-local-configuration-reset.mjs 执行编译后的真实协调器/三个持久网关/ThemeHost/AppearanceStore，以及实际 SettingsPage 确认方法。覆盖 6 个写阶段失败、清除 intent 失败、owner 替换、模拟新进程续做、重复请求、空 probe 竞态、新用户主题/单开关意图排序、取消和失效确认。原始日志 /private/tmp/reader-local-reset-final.log。系统确认框的真实像素/原生点击仍需独立验收。

主题旧四字段备份补齐：Reader-UI/theme/ReaderThemeSelection.ts 新增严格历史迁移，已知 ID 用历史精确分类；未知依固定 App → 实时系统 → 当前 effective，不能按名称含 night 猜，缺观察明确失败；新写始终 envelope v1 且无RGB/运行时观测。SyncHostConfiguration.decode 兼容确切旧形状、拒未知字段，保留 fallback reason。SyncGateway.start 将 ReaderThemeHost.observedSystemScheme() 作为 runtime-only systemScheme 传给 Core，结果 themeMigrationReason 仅进入 readerThemeRestoreFallback 诊断。Core 解密合同和旧包真实加密回归由 TOC agent 另行闭环；本段不以 Host 测试冒充 Core 包兼容通过。

定向结果：test-reader-theme-selection、test-sync-host-configuration、test-reader-theme-host、test-reader-settings、test-reader-tts-preferences、test-sync-webdav-product、generate-theme-registry --check 均通过。对应日志依次 /private/tmp/reader-theme-selection-final.log、/private/tmp/reader-sync-host-final.log、/private/tmp/reader-theme-host-final.log、/private/tmp/reader-settings-final.log、/private/tmp/reader-tts-preferences-final.log、/private/tmp/reader-sync-webdav-product-final.log。根任务已接 EntryAbility 两处恢复屏障和 Index onRestoreDefaults；最终 ArkTS/全量测试/产物/设备均由根任务单独记录。

同次只读发现已分派：源名冷恢复由 Core 当前 SQLite Source.name 可靠投影（TOC agent）；书架设置返回滚动/筛选展开由根任务；阅读主题数量 >8 的几何越界由胶囊 agent；未知本地夜主题 ID 回默认由根主题 owner。不得因仅完成本段把这些分派项称已验收。
