# PH118 完整目录页面身份复审（只读审计）

日期：2026-09-17。用户反馈“完整目录仍是整个完整控制栏的目录页，已改三次”，明确要求先不修改，查清目标页面。此轮不修改生产代码、测试或Figma，不构建、不安装、不操作设备；只追加问题及审计证据。

源码为Harmony HEAD `5fb96de4cf322c9b4f35c558051ba1fea5196ad5`加既有dirty工作；最近已安装PH116 run `20260916T165029Z-5fb96de4-1d4e16c4`；PH117 run `20260917T005752Z-5fb96de4-4643d531`已构建但未安装。本次没有以设备取证验证用户画面，以下为源码、实时Figma和历史设计输入件证据。

## 当前错误目标已确认

- 实际调用链：`LocalBookDetail.ets:364`的`onOpenDirectory` → `Index.ets:3794 openFullDirectory` → `route=directory / returnTarget=detail` → `Index.ets:1148 ReaderFullDirectory` → `ReaderFullDirectory.ets:122 FullDirectoryPanel`。
- 当前相对HEAD并未更换目录主体。`ReaderFullDirectory`只新增catalogMessage透传；openFullDirectory只移除空目录gate；20章展开与入口可点是另外两项修复。
- 当前实时控制栏用`ReaderControlDirectoryContent`，因此不能声称两处必然是同一个运行时实例。但详情仍采用完整阅读目录控制态的设计与功能布局，单独路由不等于详情专属页面。

## 实时Figma证据

文件`klhs2jMM4MncaJFqZMfqEK`：

- 详情命中区`1996:30381`和阅读目录模块展开命中区`1996:30649`均导航到`1995:60567 Prototype/Reader Full Directory/Phone`。
- 目的实例`1995:60568`和Final实例`943:11617`主组件均为`942:74`，组件集`942:77 Page/Reader Full Directory`。
- 该主组件内部`927:3`明确名为“Main Content - 目录大半屏控制窗（Expanded Directory Panel）”；底部控制面板`927:66`为364×736。
- 返回命中区`1996:30593`导航回`1995:59528 Reader Control Home`。已实际查看目的截图，包含书名/换源/更多、拖拽柄/收起、目录/书签、搜索/顶底/排序和章节状态，属于阅读控制态。
- 原始只读返回见figma-target-proof.json（原始证据仅本地保留）。扫描书架组件、Final、Responsive Masters、Reader 2、旧参考、样式编辑、组件/状态/导航、动效和备份共20个相关页面，未找到另一个有明确名称及详情入口证明的Book Directory成稿；这不等于原始设计不存在。

## 漏查的详情专属原始设计输入件（历史层）

`Reader-for-Android/docs/ui-design/03-书架链路/书籍目录/frontend-input/README.md:10`明确：“书籍目录 是从书籍详情页 查看目录 进入的完整目录页”。同级输入件的组件规格、fixture、renderer、校验预览均存在。

- 页面名称是**书架链路／书籍目录（Book Directory）**，使用LibraryShell；包括返回与“目录”标题、书名/来源/总章数摘要、当前阅读章节/进度、全部章节列表。
- README验收明确无主导航、换源、搜索、更多、筛选、排序；COMPONENT_SPEC定义back/openCurrentChapter/openChapter/retry/backToDetail。
- `04-阅读链路/目录与书签/frontend-input/README.md:10`另行明确从阅读控制层底部目录按钮打开，目录/书签/搜索/更多处于阅读上下文。
- 两页可以共享ChapterRow，不能据此共享整个阅读控制面板。`书籍详情/frontend-input/COMPONENT_SPEC.md`还明确20条章节预览，不缩成3到4条固定列表，与用户本轮说明一致。
- 实际查看的是既有`书籍目录/frontend-input/verify/design-draft-preview.png`，属于输入件渲染验证图，不冒充已找到Figma的对应新节点。README引用的上级`UI设计图.png`和`文字稿.md`在当前检出中缺失；原图和Figma导入对应关系继续以来源追溯为准，不能直接宣称旧Android像素样式已获本轮Harmony批准。

## 旧稿之后的canonical demo仍明确区分两页

不能止于上述旧输入件：Reader-UI commit `2235f9637cd4a8cf2490abfefb7dc2c363c60aec`（2026-07-08）删除旧交付材料，其README明确指定`frontend-demo/`和`contracts/fixtures/view-state.fixtures.json`为当时的多端结构依据，并禁止把旧设计包重新当当前真源。实读这个后续版本，页面身份仍清晰分开：

- `frontend-demo/route-contract.js:86`：`book-directory`＝“书籍目录（Book Directory）”，LibraryShell。
- 同文件`:98`：`reader-full-directory`＝“目录大半屏控制窗（Expanded Directory Panel）”，ReaderShell。
- `frontend-demo/render-runtime.js:2199`：书籍详情的“完整目录”按钮明确`data-route="book-directory"`。
- 同文件`:2274–2313`：`bookDirectoryScreen`使用普通LibraryShell，顶部标题“书籍目录”，书名/作者/总章数摘要，目录/书签标签与章节列表；选章进入沉浸阅读。没有阅读正文底层、控制窗拖拽柄或“收起”按钮。
- 同文件`:8207`与`:8240`分别派发`bookDirectoryScreen`和`readerStateScreen`，并非一个目录组件的两种入口。

该后续demo已增加书签标签、调整摘要字段，因此不能把更早输入件的“无书签/摘要必须显示来源/当前进度单列”等推断当最终视觉要求。**已证实的目标身份是LibraryShell的Book Directory，误用的是ReaderShell的Expanded Directory Panel。** 最新Figma中查到的连接与该入口合同冲突，不应因连线存在而反过来否定用户反馈。

可复核的带原始行号摘录及全blob哈希见canonical-demo-excerpts.md（原始证据仅本地保留）、canonical-source-receipt.json（原始证据仅本地保留）。尚未证明具体哪次Figma整理误合并；不据此断言操作人或时间。

## 迁移交接与最后历史实现复核

进一步核对7月交接及8月4日删除前的最后代码，避免只凭更早版本判断：

- `d15d8423:docs/design/handoffs/book-detail/LOCAL_READY_FOR_FIGMA.json:123–125`明确定义`book-directory`为canonical LibraryShell route，Reader Full Directory可以是下游Figma node/visual-state标签，但不得取代业务路由/owner。
- 同版本`FIGMA_F0_CROSSWALK.json:106–117`确实把book-directory交互映射到`927:*`的Reader Full Directory节点。这是可定位的映射混用证据；不是用户确认两类页面可以合并的证据。
- `a4c4be17^:frontend-demo-optimized/renderers/d2-bookshelf-discover-renderers.js:1546`，详情“完整目录”仍指向`book-directory`；`:1591–1684 bookDirectoryV2`的loading/error/正常均为LibraryShell，正常态为返回标题栏、书籍摘要、目录/书签及章节列表，没有阅读背景、大半屏外壳、拖动条或收起按钮。
- `a4c4be17`（2026-08-04）整体废弃本地演示、确立Figma视觉来源，未找到单独将详情书籍目录改为阅读控制大半屏的明确产品决定。不能恢复整套旧实现，也不能把迁移中的映射混用认定为用户要求已改变。

完整摘录及哈希见figma-handoff-and-final-demo.md（原始证据仅本地保留）、handoff-source-receipt.json（原始证据仅本地保留）。原目标页面身份已查清；当前Figma独立成稿对应关系未闭合，实施继续暂停。

## 前次审计错误

PH116 `detail-directory-ph116/REPORT.md:17–20`读取了真实prototype连线，但把“连线存在”和“独立路由不启动阅读”提升成“产品页面正确”，未追主组件的Expanded Directory身份，也未检索原始书架链路Book Directory。用户已明确否定该页面，这项否定必须覆盖旧映射。

`tools/test-detail-external-directory.mjs:68–82`用空DirectoryChild替代ReaderFullDirectory，只验证外层挂载/参数/返回与不启动阅读实例，没有验证主体设计。测试通过不能支持目标页面正确。

结论：撤销PH116关于“当前独立目录形态正确、应保留”的审计结论；现有完整目录目标仍错误。此次只确认页面身份与历史来源，不实施第四次页面修改。
