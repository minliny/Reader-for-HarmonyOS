# PH90 内容搜索打开、旧结果与输入路径复核

## 范围和不能混用的结论

用户反馈为完整内容搜索唤起后卡顿、点击输入框后键盘很久才出现、随后点击无响应，可能尚未提交搜索。Core `search.content` 锁修复只能解释执行搜索的路径，不能单独证明这一触发点已经解决。本记录是当前共享工作树上的代码、真实 SDK 方法/属性回归，无设备、无 Native/HAP 构建、无提交；并行 owner 的 PH78/PH90 Core 修改不计入本切片实现。

初始切片确定并修复两项旧结果成本：反复线性查找造成平方级工作；LRE→Panel→Content 传递嵌套 `@Prop` 导致结果数组反复深复制。后续独立 owner 已接入原生 List/LazyForEach，本切片的三个回归也已更新至新主链，见末尾“原生 List 接线后的回归”。**原生实际可见范围、同帧绘制及真机空输入页 IME 迟滞仍需设备证据，不能据桌面方法测试宣称 PH90 全关闭。**

## 进入、输入与键盘审计

- `LocalReadingExperience.ets::prepareControlPage` 对 quickSearch/fullSearch 不发请求；进入模块仅完成已有控制状态切换。`updateQuickSearchQuery` 只更新输入、取消旧 generation、公布 idle。只有 `runQuickSearch`/`loadMoreQuickSearch` 才调用 Core 内容搜索。
- `ReaderControlSearchContent.ets::aboutToAppear` 注册字体后接纳当前搜索状态。共享 `ReaderFonts.ets` 已有进程级注册闩锁；不是每次打开重新注册字体。空 idle 既无结果 ForEach，也无结果滚动树。
- 输入 `onEditChange` 通知临时层状态；Panel 的 `contentInputEnabled` 根据可见度、交互、过渡和手指所有权判定，没有把 temporaryLayerActive 作为反向禁用输入的条件，未见开键盘→禁用输入→关键盘的状态闭环。既有真实 Host keyboard/Back/隐藏失败/高度预算回归通过。
- 审计时 TextInput 本体高 14vp，视觉输入容器为 24→32vp，外 Row 没有点击转发焦点；不能由此单独推断数秒停顿的原因。root 后续明确授权了整块视觉输入容器的点击→原生输入焦点薄接，实施见下文，字体与布局几何保持原样。
- 真实 LRE 进入/输入方法探针没有触发 Core；idle SDK Builder 创建约 0.42ms、一次 replay 约 0.06ms。这个桌面方法时长不是设备 IME 或主线程帧时间证据，不能排除同时运行的其他工作阻塞。

## 大量旧结果的确证与修复

当前每次请求 `READER_CONTENT_SEARCH_PAGE_SIZE = 50`，但“加载更多”会持续累积，没有 50 条总上限。真实 LRE 方法回归连续取得 40 页、2000 条，末页停止继续请求，并验证新输入 generation 会拒绝旧返回。

旧组件用 ForEach 全量创建行；一行的标题、辅助文本、三个 snippet span 和 clip 等反复调用 `find/findIndex`。生产 Builder 创建及一次 morph replay 的扫描次数实测如下：

| 结果数 | 修复前 predicate 调用 | 修复后 | 旧创建 / replay | 新创建 / replay |
| --- | ---: | ---: | ---: | ---: |
| 0 | 0 | 0 | 0.37 / 0.06ms | 0.42 / 0.06ms |
| 50 | 15,300 | 0 | 1.64 / 0.69ms | 1.95 / 0.78ms |
| 500 | 1,503,000 | 0 | 11.54 / 8.87ms | 5.60 / 4.05ms |
| 2000 | 24,012,000 | 0 | 92.40 / 87.81ms | 22.36 / 15.06ms |

时长为单次本机 SDK 生成方法的诊断值，不是稳定基准或设备通过指标。修复前后仍各自挂载全部 N 行，表中不能读成虚拟化已经完成。

实施文件：

1. `ReaderControlSearchContent.ets`：用标准 Map 按 chapterIndex/chapterOffset 定位当前数组里的行号；新数组只建立一次索引，motion 和 metadata-only 变化保留索引。行闭包仍以稳定键访问当前 payload，同键正文、标题、点击更新不绑定旧对象；旧重复键保持原 find 的首条优先行为。
2. `ReaderContentSearchPublication.ts`：复用项目已验证的普通持有对象 + 数字 revision 模式，保存 session 拥有的不可变搜索快照，不发明另一套复制/缓存引擎。
3. LRE 仅搜索 state 链使用 `publishQuickSearchState`，原业务读写仍读普通 raw state，所有状态发表同时更新 publication 和 revision；第一搜索终态由两次发布合并成一次。Panel 普通字段持有 publication，只有数字 revision 通过 `@Prop`。
4. Content 接纳 revision 后把 raw snapshot 赋给局部 `@State` 顶层代理；raw 比较单独缓存，避免代理与原对象永远不相等。没有组件 getter，也不把结果数组送进 `@Prop`。本切片没有扩展其他 Panel props。
5. 后续授权的输入命中修复：每个 Content 实例生成稳定且唯一的 TextInput id，整块 field Row 点击调用已有 UIContext FocusController.requestFocus，明确启用原生键盘焦点语义；只有 mounted 且 interactionEnabled 时接受。移除、过渡禁用或 native focus 调用失败不会抢焦点或破坏搜索界面。不自动请求焦点、不提交搜索、不改变输入字体、14vp 字行或 24→32vp 容器几何。

真实 SDK compiler、`SynchedPropertyOneWayPU` 与 State/proxy 方法贯穿实际 LRE 的这两项参数和 Panel 的生产 Builder：2000 条 ×21 个 morph 样本，**对象 payload Prop copy 为 0**，索引身份不变。metadata loadingMore 保留原数组，同键 payload 替换刷新，idle 清除可选结果均通过。普通测试 fixture 把对象直接赋给 child 不能独立证明这一属性边界，因此另有此贯穿测试。

## 迁移前审计所得的原生虚拟化约束（历史记录）

`ReaderDirectoryList.ets` 已用 List + IDataSource/LazyForEach + ChildrenMainSize，且记载 Repeat.virtualScroll 在隐藏 empty→populated 时曾留下空原生范围。可复用该原生能力和已有数据通知适配，不应自建虚拟化引擎；Scroll 本身没有 cachedCount，单把其子 ForEach 换 LazyForEach 不形成有界的可见行范围。

当前搜索几何使用原生滚动基准 B、期望视觉偏移 O 和首行 origin C：行视觉位置为 `C + i×H − O`，原树在原生 B 内另补偿 `B−O`。其原生 extent 为 `max(N×H+C+5, viewport+B)`。Quick 深滚动向 Full 顶部展开时，B 和 O 可能相差上千行。如果只把此 translate 留在 ListItem 中，List 仍按 B 的原生可见范围构建，目标 O 范围可能不存在。

也不能把 `C+B−O` 简单塞入 native contentStartOffset：OpenHarmony 6.0 分支的 List 实现把负值钳到 0，并在 start+end 达到 viewport 时清零。这是具体的适配限制，非没有查平台能力。[上游 List 布局实现](https://raw.githubusercontent.com/openharmony/arkui_ace_engine/OpenHarmony-6.0-Release/frameworks/core/components_ng/pattern/list/list_layout_algorithm.cpp)（CalcContentOffset 与 Measure，约 146–150、212–215）。该上游分支用于平台语义审计，不能代表真机二进制身份。

迁移前确定的最小边界如下；此处记录的是当时约束，后续已授权的原生偏移追随方案见末尾：

- 复用原生 List/LazyForEach 数据源，列表、输入与 controller 身份不因 quick/full、输入或分页重建；追加用真实数据通知，metadata 变化不刷新全部原生条目。
- 明确 List 原生偏移与 O 的交接协议，控制器异步回读只更新 B，不把程序滚动当用户意图；既有 morph 不逐帧调用 scrollTo 的保护不能未经证明就删除。若采用新的同步机制，先通过生产方法/原生合同探针证明可见范围始终覆盖 O，再合并。
- 行高度 54→72、首行负/正 origin、尾端 inset、宽度/clip 保持现有 Figma 轨迹。复用目录列表的异步 ChildrenMainSize 合并与生命周期取消，避免 @Watch 期间重建原生 extent。
- 验收矩阵覆盖 0/50/2000/更大累积集、hidden empty→populated、同键替换、追加、删除、快速展开反向重抓、深偏移→Full 顶部→Quick、两端可达、IME 高度变化、native scroll 回调迟到/钳位、生命周期关闭。可见行创建量必须受 viewport+固定缓存约束，不能通过把 cachedCount 设成距离或全量 N 回避问题。

root 随后授权独立 owner 使用固定 72vp 原生标尺与合并派发的控制器追随，修正此前“不能逐帧 scrollTo”的内部约束，保持既定视觉几何。本切片只更新三项回归和证据，未编辑生产组件、共享 helper 或 owner 的完整原生同步回归。

## 正式回归与原始记录

- `tools/test-reader-content-search-open-cost.mjs`：PASS；真实 Builder 的 0/50/500/2000、LRE 进入/输入、40 页连续加载及过期返回。`ph90-search-open-complete.jsonl`；原扫描证据 `ph90-search-open-before.jsonl`。
- `tools/test-reader-content-search-publication.mjs`：PASS；两级实际参数/SDK Prop/State 与21采样，`ph90-search-publication-final.log`。
- `tools/test-reader-control-search-settings-content.mjs`：PASS；既有 Figma 几何、clip、原生 extent、同实例滚动、同键 payload 与 mutation 回归，`ph90-search-geometry-final.log`。
- `tools/test-reader-control-search-scroll.mjs`：PASS，`ph90-search-scroll-final.log`。
- `tools/test-reader-control-replace-host.mjs`：PASS；新增 publish 方法同步到既有 close/reset 生产方法 harness，原替换状态保护不变，`ph90-search-close-regression.log`。
- `tools/test-reader-control-host-keyboard.mjs`：PASS，`ph90-search-keyboard-contract.log`。
- `tools/test-reader-content-search-focus.mjs`：PASS；真实 SDK field Builder 的整块点击、两个实例唯一 id、disabled/unmounted/焦点失败边界，`ph90-search-focus.log`。新增焦点方法后重跑原几何和 publication 测试仍通过，日志 `ph90-search-geometry-focus-final.log`、`ph90-search-publication-focus-final.log`。
- `git diff --check`：PASS。

贯穿测试首次 fixture 取到 LRE/Panel 文件内其他 class，注册了错误的 Prop 集合；因此失败恰好检测到父 revision 未抵达 Panel。已改为选择具有目标成员或 build 的真实 struct，没有放松断言，初次日志 `ph90-search-publication-first/second/third.log` 保留。

设备最小待答问题仍为：空 idle 且尚未 submit 时，点击是否进入真实 TextInput 命中区；IME 请求时主线程是否被并行的 Core/Host 工作占用；旧结果数/模块状态及后台 source 操作是否与卡顿同时存在。需使用绑定最终产物的最小取证，不能把桌面 SDK 数字、Core 锁修复或本报告当作 PH90 全关闭。


## 原生 List 接线后的回归（2026-09-15）

本次仅编辑 `tools/test-reader-content-search-open-cost.mjs`、`tools/test-reader-content-search-publication.mjs`、`tools/test-reader-content-search-focus.mjs` 及本记录/原始输出。List、DataSource、坐标适配和共享测试 helper 由 acquisition owner 实施；未复制一套虚拟化算法、未保留已删除的 `resultRowsHeight` 伪方法来满足旧测试。

新测试以实际 SDK 编译 `resultsBody`，给平台边界 `LazyForEach.create` 明确提供索引 `[0,1,2,3,4,5,6,7]`；生成器、行构建器、DataSource 与字段查找均为生产实现。断言传入的是组件的完整 DataSource，totalCount 为 50/500/2000，创建行数严格等于这 8 个请求，replay 不新增行；另以 `N-2,N-1` 验证无需 Reader 窗口重建便可访问最后两条。空 idle 无列表请求、无行创建。**8 是本探针明确注入的原生请求数量，不是对真实 Ace 可见范围的模拟、测量或通过阈值。** 实際可见范围是否覆盖当前视觉偏移、native readback 与 paint 是否同帧，由 owner 的同步回归及 root 的 VM 最小取证分别负责。

最新版通过记录绑定组件 SHA256 `0e9884f8ab336bbcde6185afe35d97850413fec08de90abe0971242e18927120`，SDK 属性类 SHA256 仍为 `41ece7cba3f807e336504e582eed056349af2a552949979c6d6f69080e2fda86`。数据发布和行构建分别计时，避免漏算发布映射成本：

| 完整结果数 | DataSource 发布 | 实际生成器挂载行 | Builder 创建 / replay | find/findIndex predicate |
| --- | ---: | ---: | ---: | ---: |
| 0 | 0.58ms | 0 | 0.62 / 0.11ms | 0 |
| 50 | 0.16ms | 8 | 2.49 / 2.24ms | 0 |
| 500 | 0.15ms | 8 | 1.35 / 0.78ms | 0 |
| 2000 | 0.25ms | 8 | 1.16 / 0.44ms | 0 |

来源 `ph90-search-open-native-list-final.jsonl`，仅为此次本机方法诊断，包含 JIT、并行负载等波动，不是设备性能基准。前一次通过的 `ph90-search-open-native-list.jsonl` 中 2000 条为 0.88 / 0.41ms，也保留而不择优替代最终记录。

原历史归档源码与 `ph90-search-open-before.jsonl` 的 2000 行、24,012,000 predicate、92.40 / 87.81ms 原始数据没有覆盖。`--baseline` 仍运行该归档真实全量 ForEach；这次复核 `ph90-search-open-native-list-baseline-recheck.jsonl` 仍为 2000 行、24,012,000 predicate，时长 158.26 / 166.55ms。计数稳定而时长有波动，因此本报告不计算设备提速倍率。

出版贯穿回归使用真实 LRE 参数、Panel Builder、SDK Prop/State 类以及 Content `onResultDataChanged`，同时验完整 DataSource：

- 2000 条 × 21 个 morph 样本：对象 payload Prop copy=0，结果数组/索引/DataSource 身份稳定，native 数据通知为 0。
- metadata-only `loadingMore`：保留原数组、索引及 DataSource，不发 reload/change/add。
- 一次追加 50 条：完整累积为 2050，只发 `onDataAdd(2000..2049)`，不重载旧项。
- 同键替换第 1999 条：当前业务结果与 DataSource 返回同一个新对象，只发一次 `onDataChange(1999)`。
- 转 idle：同一 DataSource 清至 0，发一次 reload，不能选中旧结果；以上发布的对象 Prop copy 仍为 0。未挂载页面没有残留 native follow timer。
- 原 LRE 连续 40 页 × 50=2000、末页停止请求、旧 generation 不能覆盖新输入，以及空页进入/输入零 Core 请求继续通过。
- 原焦点真实 SDK Builder 回归继续通过，新增原生 14vp TextInput `borderRadius(0)` 断言；字段 32vp 高度、原文字字号、唯一 id、整块点击及 disabled/unmounted/native failure 保护保持。

执行命令（本轮均 exit 0）：

```sh
node --experimental-strip-types tools/test-reader-content-search-open-cost.mjs
node --experimental-strip-types tools/test-reader-content-search-open-cost.mjs --baseline
node --experimental-strip-types tools/test-reader-content-search-publication.mjs
node --experimental-strip-types tools/test-reader-content-search-focus.mjs
```

对应输出：`ph90-search-open-native-list-final.jsonl`、`ph90-search-open-native-list-baseline-recheck.jsonl`、`ph90-search-publication-native-list-final.log`、`ph90-search-focus-native-list.log`。首次 open-cost 新 fixture 把 SDK 编译放在 find 计数区间里，空集也录到 2351 次编译器调用而失败；`ph90-search-open-native-list-first.jsonl` 保留。修正方式是把真实 SDK 编译移到生产调用计数之前，未改变生产查找断言或可见行约束。
