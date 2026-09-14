# PH62–65 搜索布局、准入、合并与发布审计

用户当前观察包84cdc4ef（run20260914T012243Z-84cdc4ef-eed02cc4），初始代码d4d8e73a。原始反馈FOLLOWUP_56_67.md：最近搜索距离输入仍空；三个结果标签字号/高度样式不一致；搜索指示器卡顿；搜索《终宋》出现百度图片且后段卡顿、部分结果未合并。本轮不设备/HDC/构建/提交，不以本地样本冒充此次真实返回。

## 修前代码事实

- PH62：首次页Scroll已TopStart，`initialContent`仍固定top:28；搜索栏下面仍有28vp主动留白，不是历史chip测量回归。
- PH63：source标签10fp/10vp行高、四向padding和色底；计数11fp/16.5vp无底；书架标记10fp没有显式行高。三者同一行仅父容器居中，不会得到一致文字框/外框。
- PH64/65：Spinner已是平台LoadingProgress、常驻底部、按active/foreground/reduceMotion控制，未发现自绘角度计时器；主线程结果处理仍会阻塞它。16ms批次重复全量flatten→present合并→页面全量分组排序→每行onDataChange；任何present又请求全量source.list与search-book.list别名投影。刷新遇到下一次presentation对象变化即丢弃并立即重算，可能直到搜索尾声都不显示已取得的合并事实。
- PH65准入：类别判断虽尊重类型并识别漫画/写真/图站，却未覆盖明确“图片”来源；默认type0仍可能通过。将先以仓内实际bundled规则验证，不能单独封禁百度域名。结果身份始终保留sourceId/bookId；不同作者不会按相同标题猜测合并。

接下来用实际生产方法、SDK节点属性及可重复计数回归验证这些因果，再限制范围修复；对未取得的《终宋》本次书源输出明确保留个案边界。


## 定点修复与原因（已冻结，未构建/安装）

| 编号 | 当前代码定位 | 修复和边界 |
| --- | --- | --- |
| PH62 | `SearchPage.ets:589 initialContent` | `top:28` 改为已有 `TOK_SPACE_XS=8`。保留 `stateContent` 的 TopStart、稳定外容器测量、前两行与“展开/收起”行为。没有再次改历史项数规则。 |
| PH63 | `SearchPage.ets:1320 SearchResultCard.build` | 三个标签统一 10fp/15vp、左右6/上下2padding、圆角4和主题浅底；保留书源/书架绿色、计数弱文字语义。Flex允许换行，长书源限制可用宽度并省略，不挤掉后续标签。实际点击仍传真实 book/variants。 |
| PH64 | `SearchSpinner.ets`；下列搜索发布路径 | 平台 LoadingProgress 生命周期已正确，未再更换动效样式。减少阻塞它的重复主线程工作；本地计数只能证明工作减少及让步，不能证明 OEM 端帧率。 |
| PH65 准入 | `ReaderSourceCategory.ts:40`；`SearchGateway.loadSources/searchBySource` | 显式“图片/图库/图集/壁纸”名称或分组归 other，排除文本小说候选。没有域名黑名单，不以 image/CDN URL 推断类别；原书源身份、原始规则、启停配置不改、不删除。 |
| PH65 发布与行更新 | `SearchOrchestrator.ets:435/728`；`SearchPage.ets:189/201/848` | 来源桶只在新行到来后重新展平；失败/完成计数复用结果数组。仅新身份或真实 Core 通知触发缓存补完；未变的书籍、候选、已在架状态不赋值、不发送 onDataChange。按当前查询和真实 payload 缓存既有规范化/相关度结果，仍使用原匹配算法、原首见顺序和滚动锚点。 |
| PH65 别名合并 | `SearchOrchestrator.ets:244`；`SearchGateway.ts:276` | 完成的投影按 sourceId+bookId 对齐最新列表，只替换仍属于该读请求的确切 payload；保留后来的行、计数与 searching 状态，缺少新身份时串行补下一轮。下一批原始结果不会冲掉已确认 groupKey；无变化的投影保留对象/数组、不发布。不同作者与缺失作者仍不猜测合并，历史别名仅来自现有 CachedBookIdentityResolver 的 Core acquisition.aliases。 |
| PH65 注册表 | `SearchGateway.ts:84/230/276`；`BookAcquisitionCoordinator.ts:67/89` | 提供只读源配置 revision，缓存投影复用已加载来源。导入/更新/删除/runtime.storage.apply/runtime.storage.restore 开始与结束均失效，失败也失效；读期间 revision 变化即拒绝旧结果。延迟 source.list 不进入新注册表。没有该观察接口的注入调用继续重新读取。 |
| PH65 大响应 | `SearchGateway.ts:190/240` | 书籍解码和来源解码每32项让出事件循环；旧搜索在让步后失去准入时返回失败，不输出半份过期结果。原缓存别名投影的分片与许可边界不变。 |

新增修复还纠正同源标签问题：书架成员判断使用真实 sourceId/bookId 或规范化 title+author；不再拿导航/别名 groupKey 与书架标题键直接比较（两者可能分别为 JSON、历史键或规范化当前名），避免已在架标记漏显。

## 两条实际图片规则证据

文件 `entry/src/main/resources/rawfile/reader-tested-book-source-collection.json` 是单行 JSON。按零基数组索引定位：

- `[177]`：`bookSourceUrl=https://image.baidu.com#乃星`，`bookSourceName=百度图片（优）`，`bookSourceType=0`，`bookSourceGroup=特殊 书源`。
- `[251]`：`bookSourceUrl=https://image.baidu.com#guaner`，其 name/type/group 相同。

两条 `ruleSearch.bookList` 均从 `baseUrl.match(/word=(.*)/)[1]` 解码查询词，直接构造 `{title: 查询词, url: baseUrl, img: ...}`，`ruleSearch.name=title`。`ruleContent` 输出 `<img src=...>`，并非正文小说。旧分类只认识漫画、写真、图站等，名称“百度图片（优）”与type0因此进入 novel。此处已证实的是仓内规则的构造行为和旧分类放行原因；**没有当次真机 book.search payload，不能断言用户看到的是这两条中的哪条、原启停状态或具体 sourceId，更不能宣称《终宋》原书源已恢复。**

## 恢复/同步入口覆盖

- 普通导入、编辑、启停、批量删除由 `SourceGateway.ts` 调 owner.request 的 source.import/update/delete，均经过 Coordinator。
- WebDAV 恢复在 `SyncGateway.ts:394` 调 owner.request(`runtime.storage.apply`)，随后 flush/transaction commit；实际改变来源的 apply 已失效。后续 commit 只确认恢复回执，不被误当成每次重建来源。
- 运行中经 owner 的 storage.restore 同样覆盖。`ReaderRuntimeOwner.ts:633` 的启动内部 restore 和 `:849` bundled 安装在请求可用之前执行，新的搜索缓存此时尚未形成；首次 source.list 读到恢复后的集合。
- 在变更两侧递增，是为防止变更期间启动的读取也落入可复用缓存；发生异常时仍保守失效，而非把抛错当作“数据库一定没变”。版本观察不改变 Core 事务、来源身份或用户设置。

## 本地证据

修前失败：

1. `/private/tmp/ph65-category-red.log`：明确图片来源 expected other，actual novel。
2. `/private/tmp/ph65-rows-red.log`：1改/1增样本仍发 change0/change1/change2/add3。
3. `/private/tmp/ph65-gateway-red.log`：一次 loadSources 加两次缓存投影 source.list 共3次，expected1。
4. `/private/tmp/ph65-orchestrator-red.log`：进行中后一批结果到来后，已完成别名投影仍显示“旧名”，expected“已证实详情书名”。

修后本轮实际执行并通过的既有检查组（完整日志 `/private/tmp/ph65-final-<文件名>.log`）：

- test-reader-source-category.mjs：两个实际 bundled 图片来源及通用图片标签，正常小说/CDN保留；1046条全部分类。
- test-search-view-state.mjs：4000旧行+1改行+1新行仅1 change/1 add；重复发布0 change/add；新增一行只做≤5次规范化，下一次同输入0；稳定行/同相关度首见排序/锚点/规范化书架标记。
- test-search-gateway.mjs：来源复用1读；配置版本变化重新读并剔除停用源；迟到投影拒绝；1024条解码期间至少16次事件循环让步；取消旧搜索不放行；无新增事实保留数组引用；既有真实身份/变量、2048条别名分片回归。
- test-search-orchestrator.mjs：投影在其他源尚未结束时立即可见（无需等待40源全部结束）；新行/新版本/新关键字保护；39次计数更新保持同一结果数组且仅1次缓存读；canonical groupKey跨后续原始批次保留；既有并发、暂停、重试、失败隔离、来源范围、生命周期。
- test-book-acquisition-coordinator.mjs：五类源变更入口成功和异常均在两侧失效；延迟 source.list 不复活删除身份；既有统一书籍获取/取消/准备链。
- test-search-history-layout-lifecycle.mjs：真实 SDK 编译执行，TopStart与top8、单条/两行/超出、测量与展开收起全部通过。
- test-search-publication-state.mjs、test-legado-product-logic.mjs、test-search-settings-physical-feedback.mjs、test-search-detail-cache-first.mjs：相关发布、产品、平台spinner、缓存优先回归通过。

共 **10个既有检查组**。其中补充行为计数取代了“只通过字符串断言”的完成判断。Root另外新增 `test-search-physical-layout.mjs` 并独立报告PASS：真实SDK日夜/在架状态下的三标签统一框、换行、长源省略、迟到计数/名称更新和真实点击参数。本子任务未重跑root独立组。曾误引用两个不存在的测试文件（test-search-relevance.mjs、test-search-orchestrator-log-privacy.mjs），得到 MODULE_NOT_FOUND；这两次没有执行测试，不计为通过，相关度与日志既有约束在实际存在的上述组验证。

## 交付及未决边界

- 此报告的修复位于工作区，生产/测试已冻结交root统一构建；本子任务没有设备、HDC、构建、安装或提交操作。
- 当前物理设备仍是84cdc4ef，不能把本轮本地结果写成该包真机已修好。
- 别名可见时限由一次正在执行的分片投影完成决定，不再取决于整个搜索完成；测试证明在其余源保持未完成时即可发布，但不承诺未经设备测量的固定毫秒或FPS。
- 本轮没有新写通用模糊匹配引擎，也没有引入另一套解析器。复用现有 Core/平台协议、JSON解析、CachedBookIdentityResolver 的身份/别名能力及现有相关度函数，仅调整Reader发布所有权、规范化缓存、来源类别准入和组件布局。
- 当次《终宋》异常返回的原始来源/作者/标题/variables、所有“未合并”具体对照样本未知。通用规则准入、已证别名合并与发布缺陷已在代码侧闭环；不能把缺乏来源事实的不同作者/缺失作者结果强行合并。
- 平台spinner生命周期本地通过，真机主线程/渲染帧率和最终视觉效果、用户验收仍未通过本轮证明。保留其他完整实施计划OPEN，不以四项局部补修覆盖全量验收。
