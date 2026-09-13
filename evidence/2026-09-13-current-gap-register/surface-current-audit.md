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
