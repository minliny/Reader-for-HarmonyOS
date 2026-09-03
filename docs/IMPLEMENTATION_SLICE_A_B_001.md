# 阶段 A + B 首条闭环：实施前声明

> **历史实施切片，不是当前待开发清单。** 本文保留当时的消费节点、边界和分层证据；其中暂停项、
> 缺口和实施顺序不得直接作为当前任务。唯一待开发清单见
> [`../../DEVELOPMENT_BACKLOG.md`](../../DEVELOPMENT_BACKLOG.md)，禁止在本文追加当前待办。

状态：实施中。本文是 HarmonyOS 实现切片的约束记录，不是设计副本、页面 AST 或生成器输入。

## 本次消费的实时 Figma 节点

- `23 · Pages · Final`
  - Bookshelf：Phone `943:11`，Tablet `943:437`
  - Book Detail：Phone `943:651`，Tablet `943:855`
  - Reader Module Directory / TOC：Phone `943:9888`，Tablet `943:10196`
- `15 · Reader 2`
  - Responsive ReadingSurface：`1023:18354`
  - Phone PaperLayer/ReadingContent：`1023:18355` / `1023:18356` / `1023:18357`
  - TabletExpanded PaperLayer/ReadingContent：`1023:18371` / `1023:18372` / `1023:18373`
- `07 States`
  - Bookshelf empty：`286:31`（其中图标为 `271:96`）

本次读取时间：2026-08-04。实现前与交付前都以实时 Figma 节点为准；该记录不取得设计权威。

## 目标页面与状态

建立一个标准 HAP 的单一应用入口和导航；在真实 Core 状态可用时完成：

`Bookshelf → Book Detail → TOC → chapter content → Phone/Tablet 静态 ReadingSurface`。

启动时必须先恢复 Core 存储。空书架是合法的真实状态，不能以 Figma 示例书或固定正文伪造一条阅读链路。

## 本次 Core 命令

- 启动与持久化：`runtime.setHostCapabilities`、`runtime.storage.restore`、`runtime.storage.flush`
- 书架：`bookshelf.list`
- 详情、目录、正文：`book.detail`、`book.toc`、`chapter.content`
- 阅读位置：`reading.progress.get`、`reader.location.resolve`、`reading.progress.update`

本地书真实导入在取得对应 Figma 已画状态后，使用 `local_book.import`、`bookshelf.add`、`local_book.toc`、`local_book.chapter.content`；不得使用 SDK fake URL 或固定示例正文代替。

## Host capability

本切片仅集中注册并声明：

- `persistence.get`
- `persistence.put`

远程书详情、目录或正文实际发出请求时，才注册并声明 `http.execute`。文件选择、TTS、WebDAV、Cookie、WebView、通知、后台运行和所有其他 capability 均不在本次切片。

## 明确暂停项

- 所有翻页模式与 `reader.page.turn.*`
- 所有未批准动效、Review-only 动效和所有 Tablet 非零动效
- `reader.panel.expand/collapse`
- 通用页面引擎、代码生成器、跨端 UI 框架、第二套设计系统
- 其他平台仓库和已删除的旧 HarmonyOS 前端实现

若任何后续页面缺少可见状态、素材、尺寸或 Phone/Tablet 响应式规则，立即记录 `FIGMA_VISUAL_GAP`，不写近似实现。

## 本次已触发的 FIGMA_VISUAL_GAP

`State/BookshelfEmpty` 提供了“导入本地书籍”这一入口，但当前 Figma 未找到本地文件选择后的 loading、解析失败、导入确认或导入结果节点，也未找到无封面书籍的 Bookshelf / Book Detail 变体。影响范围是新安装且 Core 恢复为空时的“导入 → 非空书架 → 正文”实际数据接续。

因此本次只实现该节点本身的静态组件与唯一 Core 生命周期；因其缺少页面级位置/响应式约束，该组件不挂载到 Bookshelf 页面。不会为导入按钮、无封面降级或示例书籍编写近似 UI。待补齐并确认相应 Figma Phone/Tablet 节点后，再接入 `local_book.import` 和文件 Host capability。

HarmonyOS AppScope manifest 的 `icon` 字段是构建必填项。当前 Figma 没有明确的 app icon / launcher / logo 节点；`Icon/Bookshelf` 仅是页面语义图标，不能擅自升格。因此 HAP 装配停在 `A-APP-ICON-01`，不会写入 DevEco 默认图标或临时替代资源。

## 脊柱修正声明（不新增视觉实现）

- Figma：不新增消费节点；仍只受上述节点和 `A-APP-ICON-01` / `B-IMPORT-01` 约束。
- 目标：修正单一 runtime 的销毁边界，以及真实 Core `bookshelf.list` / persistence 响应的协议映射。
- Core 命令：`runtime.storage.restore`、`runtime.storage.flush`、`bookshelf.list`。
- Host capability：仍仅 `persistence.get`、`persistence.put`；不会注册或实现 HTTP、文件选择、TTS、WebDAV。
- 暂停项：不挂载 Bookshelf 空状态、不实现导入、详情、目录、正文、翻页或任何动效。

## 书架数据与本地导入切片声明（2026-08-04）

### 本次消费的实时 Figma 节点

- `23 · Pages · Final`：Bookshelf Phone `943:11`、Tablet `943:437`。两者定义了已有书籍时的 Continue Reading、书架标题和封面网格响应式布局。
- `07 · Components · States & Overlays`：`State/BookshelfEmpty` `286:31`。它只定义空态卡片本身，不定义该卡在 Phone/Tablet Bookshelf 页面中的落位。
- `08 · Components · Library & Import`：`Library/LocalImportDialog` `2657:918`。
  - Phone `State=File Selection`：`2657:916`；
  - Phone `State=Importing`：`2899:58923`；
  - Phone `State=Import Result`：`2657:917`。
  该组件的 Figma 描述明确该流程由 Host 调起系统多文件选择器，允许 TXT 与 EPUB，组件只表现系统选择之后的应用内状态。Figma 节点 `2547:1941` 还明确单次最多 50 本。

### 目标页面、状态与本次代码边界

本次先完成真实的系统选文件 → 沙箱暂存 → 异步 Base64 → Core 本地导入 → 书架写入的数据闭环，以及给页面使用的导入结果模型。`BookshelfFlowGateway` 仅将未筛选的真实 `bookshelf.list` 结果归类为 `empty` 或 `populated`，并在一次导入流程结束后重新读取书架；它不定义任何视觉布局、占位封面或未画错误页。页面不会直接解析 Core 协议，也不会自行创建 runtime。

`State/BookshelfEmpty`、Bookshelf 有数据视图及 Phone 导入三态的 ArkUI 挂载，必须等其剩余响应式/无封面可见合同补齐后再接入；本次不以临时列表、占位封面或从 Phone 推导 Tablet 的方式显示它们。

### 本次 Core 命令

- `bookshelf.list`
- `import.parse`（`kind: "localBook"`）
- `import.persist`
- `bookshelf.add`
- 仅当 `bookshelf.add` 失败时调用 `import.rollback`

每个已选文件以其稳定 `bookId` 构造 `LocalBookParseParams`。这里采用 Core 已提供的本地书事务入口，而不是在 `local_book.import` 后留下无法回滚的物化数据：`import.persist` 成功后才调用 `bookshelf.add({ sourceId: "local", ... })`；若书架写入失败，立即使用该次 persist 返回的 rollback token 还原本地书。它们的本地书物化语义与 `local_book.import` 一致，不伪造“重复文件”结果；同一 `bookId` 重导入由 Core 覆盖/书架 upsert。

### 本次 Host capability

- 已有：`persistence.get`、`persistence.put`。
- 新增的集中 Host 服务（不是 NAPI capability 回调）：`DocumentViewPicker`、文件 URI 暂存、异步文件读取、异步 Base64 编码。

文件选择器只过滤 Figma 已定义的 `.txt`、`.epub`，单次选择上限为 Figma `2547:1941` 定义的 50；不申请宽泛存储权限，不将 URI 或文件系统 API 泄漏给 ArkUI 页面。为服从 Core `import.parse` 的 24 MiB Base64 传输上限，Host 在暂存后以 18 MiB 原始字节上限拒绝过大的单个文件，并把它作为既有 Figma 结果列表中的该文件“失败”，不伪造新的错误页面。

### 明确不触碰的暂停项

- Tablet 的本地导入 UI：`2657:918` 的全部三种变体均为 390×844 Phone，不能推导 Tablet。
- 空书架页面级落位，以及 `coverUrl` 缺失的本地书在 Bookshelf / Book Detail 中的可见形态。
- 导入结果以外的确认、回滚、重复判定和失败重试交互；当前 Figma 只定义结果列表和“完成”。
- 所有翻页、动效、通用框架、HTTP/TTS/WebDAV 和其他平台仓库。

## 初版应用图标授权（2026-08-04）

### 视觉来源与目标

本任务中你明确授权附件 `codex-clipboard-7b003f80-876f-4361-aa35-61f3093df815.png` 作为初版 HarmonyOS 应用图标。该 PNG 为 1254×1254，SHA-256 为 `36e26a54dece69525a568157ca4bfad96423873a407f9d2bad13edc84c83989b`。它只解决 HAP launcher 图标资源，不取得 Bookshelf、阅读页或其他可见 UI 的设计权威；Figma 中尚无 app-icon 节点的事实继续登记。

### 本次实现边界

- 目标：将该已授权的原始 PNG 保存为 `AppScope/resources/base/media/app_icon.png`，并在 AppScope manifest 中引用 `$media:app_icon`。EntryAbility 的启动窗口使用同一原始 PNG 无裁切缩放得到的 `entry/src/main/resources/base/media/start_icon.png`（256×256），并引用 `$media:start_icon`，以解除 HAP 对 `app.icon` / `startWindowIcon` 的装配前置条件。构建首次暴露 `startWindowIcon` 为 SDK 23 的必填项后，只复用同一已授权视觉资源。
- Core 命令：无。
- Host capability：无。
- 不触碰：所有 Figma 页面、页面素材、书架/导入视觉状态、翻页和动效；图标不反向成为 Figma 的颜色或组件来源。

## HAP 严格编译与 Core 包接线修正（2026-08-04）

### 本次消费的视觉来源

无。该修正只处理 HAP 装配已暴露的 ArkTS 类型限制与唯一 Core runtime 的本地包解析；不新增、变更或挂载任何页面视觉。

### 目标页面、状态与代码边界

保持现有 `Index → BookshelfFlowGateway → ReaderRuntimeOwner` 的非可见数据路径不变。ArkUI 入口与组件继续使用 `.ets`；不含 UI 的 Host/Core/gateway 服务和 staged Core package entry 使用单向 `.ts` facade，`.ts` 不导入 `.ets`，以适配当前 SDK 的严格 ArkTS 限制。将已构建的 Core Harmony 包以真实、模块内的 staged package 接入，不能依赖跨仓库 `file:` 符号链接。当前输入包来自 `Reader-Core-Native/target/harmony-napi/arm64-v8a/package`，其 package-manifest SHA-256 为 `d07110284ab423dcf406daaa8381fb8512cca427dc50f3bb4f5bc8f79702719d`；staging 只复制该清单中的 ArkTS wrapper 和 arm64-v8a NAPI 二进制，并仅将 package entry 及 types 元数据改为 `.ts` facade，以暴露既有 `createReaderCoreRuntime` 导出，不改写 Core 业务实现。

### Core 命令与 Host capability

- 命令保持不变：`runtime.setHostCapabilities`、`runtime.storage.restore`、`runtime.storage.flush`、`bookshelf.list`、`import.parse`、`import.persist`、`bookshelf.add`、`import.rollback`。
- Host capability 保持不变：`persistence.get`、`persistence.put`，以及已声明的系统文件选择/沙箱暂存服务。

### 明确不触碰的暂停项

- 不以 HAP 能编译为由挂载 Bookshelf、空态、导入或无封面书的近似 UI。
- 不新增 NAPI runtime、通用状态框架、代码生成器、动画或其他平台接线。
- `B-IMPORT-01`、阅读/翻页和所有其他 Figma 缺口继续有效。

## NAPI 归档路径修正（2026-08-04）

### 本次消费的视觉来源

无。HAP 归档审计已确认 staged package 内嵌的 `libs/arm64-v8a/libreader_core_napi.so` 未被 PackHap 收集；本修正只将同一份、已由 Core package manifest 校验的 arm64-v8a 二进制放入 HarmonyOS entry 模块的标准 native library 路径。不会由此产生或变更任何 ArkUI 可见内容。

### 目标、Core 与 Host 边界

- 目标：将 SHA-256 为 `ced5b79a0aba783228de4bac71d053617760c442c53840a478e17e1ca808eab1` 的输入 `libreader_core_napi.so` 复制到 `entry/libs/arm64-v8a/`，让 PackHap 按模块 native library 规则纳入 HAP。归档阶段会 strip 调试信息，故以归档路径、arm64 ELF、NAPI 注册字符串和一致的 ELF BuildID 校验其来源；同时单独记录 stripped 归档二进制哈希，不把它误报为输入文件的逐字哈希。
- Core 命令与 runtime 数量：均不变；只交付已有唯一 runtime 所依赖的已构建 native module。
- Host capability：不变；不新增权限或平台能力。

### 明确不触碰的暂停项

- 不把 HAP 装配或二进制存在当成 NAPI 加载、签名、模拟器或设备运行证据。
- 不处理书架、导入、详情、目录、正文、翻页、动效或任何尚未满足的 Figma 可见状态。

### 本地归档验证

- `hvigorw assembleApp --no-daemon` 已通过；HAP 内含 `resources/base/media/app_icon.png`、`resources/base/media/start_icon.png` 和 `libs/arm64-v8a/libreader_core_napi.so`。
- PackHap 后的 native library 为 stripped arm64 ELF，BuildID 仍为 `749a41e42a70797981bcbd55cb5fc0ee0a6c7dd5`，归档内 SHA-256 为 `496ee6b863da6433729f2c344988a15ecf80de86a8aa255890781513af47ca89`；输入二进制保留调试信息，故其 SHA-256 仍为上文的 `ced5b79a...`。
- 当前构建未配置签名，且仅随包提供 arm64-v8a；这不是 x86_64 模拟器或真实设备启动证明。

## 模拟器 NAPI 解析修正（2026-08-04）

### 本次消费的视觉来源

无。Pura 90 API 23 arm64-v8a 模拟器已安装并启动本 HAP，但 `ReaderRuntimeOwner.start()` 的首个真实调用记录 `Cannot read property createRuntime of undefined`。先将 staged facade 改为 ArkTS 明确支持的 namespace import；随后 NMM 日志将该 `undefined` 的实际根因定位为缺失的 `libc++_shared.so`，见下一节。该修正不增删或改变任何页面、图标、布局、Figma 节点或动效。

### 目标、Core 与 Host 边界

- 目标：在 `entry/vendor/core-harmony/Index.ts` 将 native module 从 default import 改为 ArkTS 支持的 namespace import，使 `libreader_core_napi.so` 的现有命名导出对象进入 `NativeReaderCoreModule`。这是 Harmony App 的 `.ets → .ts` staging facade 适配；它不是缺失动态库的替代修复，依赖打包见下一节。不改 Native Core 的 C++/Rust 业务、ABI、命令或 runtime 数量。
- Core 命令：保持 `runtime.setHostCapabilities`、`runtime.storage.restore`、`bookshelf.list` 等既有调用，不新增命令。
- Host capability：保持仅 `persistence.get`、`persistence.put` 与已声明的本地文件服务；不引入网络、TTS 或 WebDAV。

### 明确不触碰的暂停项

- 不因模拟器能启动进程而挂载未获 Figma 合同的书架、导入、详情、目录或阅读视觉。
- 不加入 fallback/mock Core，也不新增 runtime；若 namespace import 后仍不能获得 native exports，即报告真实加载错误。

## 模拟器 Native 依赖修正（2026-08-04）

### 本次消费的视觉来源

无。模拟器的 ArkCompiler/NMM 日志已经将前一项的 native export 为 `undefined` 定位为动态装载失败：`libreader_core_napi.so` 需要 `libc++_shared.so`，而 HAP 内此前只含前者。该修正只补齐 NAPI 的标准 C++ runtime 依赖；不改变页面或 Figma 合同。

### 目标、Core 与 Host 边界

- 目标：从当前 SDK 的 `aarch64-linux-ohos/libc++_shared.so` 复制与 NAPI 同 ABI 的 runtime 到 `entry/libs/arm64-v8a/`，使它随 `libreader_core_napi.so` 一同进入 HAP。输入 runtime SHA-256 为 `341b75246162c5c2eed2c57808e062cc698118d39b82125e3709ff5eca883b0d`，ELF BuildID 为 `127e06750377fa33d9999ba0646387430bb00b91`。
- Core 命令、唯一 runtime 与 Host capability：均不变；这是 Host 对既有 NAPI 动态依赖的打包接线。

### 明确不触碰的暂停项

- 不改变 Native Core 的 Rust/C++ 业务或 ABI，也不通过 mock/fallback 跳过真实 native 装载。
- 不处理任何未批准的 Bookshelf、导入、阅读视觉或动效。

### Pura 90 模拟器验证

- 目标：`127.0.0.1:5555`，API 23，`aarch64` / `arm64-v8a`；与 HAP 及 NAPI ABI 一致。
- 初次安装和启动本 HAP 均成功，但 PID `9819` 的 ArkCompiler 日志明确记录 `Error loading shared library libc++_shared.so` 与 native export `undefined`，故不计为 Core runtime 成功。
- 补齐依赖后，`hvigorw assembleApp --no-daemon` 成功，归档同时含 `libs/arm64-v8a/libreader_core_napi.so` 与 `libs/arm64-v8a/libc++_shared.so`。`hdc install -r`、`aa start -a EntryAbility -b io.reader.harmonyos -m entry` 均成功；新 PID `11289` 仍存活，且该 PID 没有 `Reader` tag 的启动/书架错误。
- 当前 `Index` 的正常路径确实会调用唯一 runtime 的 `start()` 和 `BookshelfFlowGateway.load()`；上述结果证明这条空书架数据初始化路径未触发其错误处理。它不是已挂载的空书架视觉或导入流程验收，后两者继续受 `B-IMPORT-01` 约束。

## Figma Bookshelf 有数据页重做声明（2026-08-04）

### 本次消费的实时 Figma 节点

- `23 · Pages · Final`：`Bookshelf / Phone` `943:11`、`Bookshelf / Tablet` `943:437`。
- 其中直接消费：`ContinueReading/Phone` `I943:11;2236:1382`、`SectionHeader/Phone` `I943:11;2236:1406`、Phone 的 `BookItem/*/Cover` 网格、`BottomNav/Phone` `I943:11;2236:1583`；以及 Tablet 对应的 `I943:437;2236:1394`、`I943:437;2236:1454`、`BookItem/*/Cover` 网格和 `I943:437;2236:1726`。
- 图标与书籍封面只使用上述 Figma 节点导出的资产；不手绘或以 launcher 图标替代页面图标。
- Figma 指定 `Noto Serif SC` 与 `Noto Sans SC`。前者从 `Reader-UI/fonts` 的既有 Regular/Bold 文件注册；后者补入 Figma 同名的 Noto CJK SC 可变 OTF（SIL OFL，来源为 `notofonts/noto-cjk`），其 Reader-UI 源文件与 HAP rawfile 副本 SHA-256 均为 `d13ed01ec8aa45d6178999b648e96fb92150683e9f8e2a581f2acf208dcbe44b`。它不是新的字体设计或视觉替代。

### 目标页面与真实状态

本次仅实现 `bookshelf.list` 返回至少一本**带可显示 coverUrl** 图书，且真实 `hasReadingProgress=true` 查询返回一项时的 Bookshelf：Phone 390×844 与 Tablet 760×960 的静态 Figma 布局、真实书名/作者/最近阅读书籍状态、点击书籍的用户意图边界。页面不解析 Core JSON，也不创建 runtime。

### Core 命令与 Host capability

- Core：`bookshelf.list`，以及为 Figma `Continue Reading` 获取真实最近阅读项所需的 `bookshelf.list({ hasReadingProgress: true, sortBy: "lastReadAt", sortDirection: "descending", limit: 1 })`。
- Host：不新增 NAPI capability；已存在的 `persistence.get`、`persistence.put` 保持不变。远程封面下载/缓存尚未成为本次能力：若当前实际 `coverUrl` 不能作为 ArkUI 本地可显示资源解析，则该状态不进入本次可见页，必须先补集中 Host 方案和相应 Figma 状态。

### 明确暂停项与实时缺口复核

- 本次不挂载空书架。实时检查 `23 · Pages · Final` 后，`State/BookshelfEmpty` `286:31` 在该 Final 页面没有实例或 Phone/Tablet 落位；不能从其 352×350 独立卡推导屏幕位置。
- 本次不挂载导入。实时 Figma 已有 Phone `Library/LocalImportDialog` 的 File Selection `2657:916`、Importing `2899:58923`、Import Result `2657:917`，但没有 Tablet 变体，也没有从 Bookshelf/Empty 到该流程的正式触发/落位。
- 本地 TXT/EPUB 导入当前由 Core 产生 `coverUrl: null`；实时 `Library/BookCover` `493:185` 只定义六个 demo cover 变体，没有无封面 BookItem/Book Detail 变体。不得把 demo cover、占位封面、默认图片或其他端样式分配给真实本地书。
- `943:11` / `943:437` 都固定包含 `Continue Reading`。当前 Figma 没有“书架有书但还没有阅读进度”的无 Continue Reading 页面状态；不得将任意第一本书伪装为最近阅读。
- 不实现详情、目录、正文、翻页、任何动效、页面生成器、通用设计系统或其他平台仓库。

## Bookshelf 有数据页入口接线声明（2026-08-04）

### 本次消费的实时 Figma 节点

- `23 · Pages · Final`：`Bookshelf / Phone` `943:11`、`Bookshelf / Tablet` `943:437`；交付前已重新读取二者。
- 直接挂载的可见节点保持为上述声明中的 `ContinueReading`、`SectionHeader`、`BookItem` 封面网格及 Phone/Tablet 导航实例；不新增任何 Figma 外的启动页、骨架屏或空白替代页。

### 目标状态、Core 命令与 Host capability

- 目标：让唯一 `ReaderRuntimeOwner` 恢复持久化后，将**真实** Bookshelf 数据传入上述 ArkUI 页面。只有 `bookshelf.list` 返回至少一本非空 `coverUrl` 的书，且 `bookshelf.list({ hasReadingProgress: true, sortBy: "lastReadAt", sortDirection: "descending", limit: 1 })` 返回一项同样具有非空 `coverUrl` 的最近阅读书时，才挂载 Figma 已定义的有数据页面。
- Core：仅以上两个 `bookshelf.list` 查询，以及既有 `runtime.storage.restore`；页面不接触协议 JSON。
- Host：不新增 capability。继续只使用已注册的 `persistence.get`、`persistence.put`；本次不为未定义的封面下载失败态引入直接网络或占位封面。

### 明确暂停项

- 任何未通过上述真实数据准入的状态：空书架、无封面书、有书但无阅读进度、远程封面不可显示、加载/错误提示。它们分别缺少 Final 页面级落位、无封面组件、无 Continue Reading 变体或失败可见状态，不能由入口猜测。
- Compact/其他设备类型的布局：本次仅选择 Figma 已读取的 Phone 和 Tablet 最终页，不从其中一个推导另一个未交付视口。
- 导入、详情、目录、正文、翻页和所有动效。

### ArkTS 字重编译修正

- Figma 来源、目标状态、Core 命令、Host capability 与暂停项均不变，仍为 `943:11` / `943:437` 的默认静态有数据书架和上述两个 `bookshelf.list` 查询。
- SDK 的 `FontWeight` 枚举不提供 `Black` 成员；Continue Reading 标签保留 Figma 的 Noto Sans SC Black（900）字重，改以 ArkUI 接受的数值 `900` 表示，不能降级为 Bold 或替换字体。

### Bookshelf 实时 Figma 审计修正

- Figma：仍只消费 `943:11` / `943:437`。本次复核具体使用 Continue Reading `I943:11;2236:1382` / `I943:437;2236:1394` 及两个 Final 页的滚动容器 `I943:11;940:47` / `I943:437;859:43`。
- 目标：修正已挂载有数据默认态的可见色值和滚动尾部约束。Continue Reading surface 是 `rgba(255,255,255,0.88)`（`#E0FFFFFF`），不能误用 BottomNav 的 `#E6FFFCF8`；滚动容器的 Figma 底部 padding 分别为 Phone 628、Tablet 744，不能以未来源化的 96 代替。
- Core、Host：仍仅为两个 `bookshelf.list` 查询和 `persistence.get` / `persistence.put`，不新增任何网络、文件或 NAPI capability。
- 暂停：BookItem 的 `TitleLines=1/2` 是 Figma 显式变体，但当前 Core shelf 模型没有该视觉选择字段，且 Final 静态矩阵存在不同行轨道；在重新读取共享 BookItem 的运行时选择约束前，不把自然换行或固定两行提升为正式动态规则。导入、详情、目录、正文、翻页和动效继续暂停。

### Bookshelf TitleLines fail-closed 修正

- Figma：仍只消费 `Library/BookCard` `493:196` 及 Final `943:11` / `943:437`；已确认 Phone/Tablet 的 `TitleLines=1/2` 与 Grid 行轨为独立可见变体，Figma 没有给出真实书名到变体的选择条件。
- 目标：在该选择规则缺失期间撤回有数据页的运行时准入，记录 `FIGMA_VISUAL_GAP`；不能让 `ShelfBook.title` 的自然换行、字符数或本地默认值决定 `TitleLines`。这会使当前空 Core 的虚拟机继续不显示未定义页面，而不是恢复空壳或示例书。
- Core：查询仍只为 `bookshelf.list`；Host 不新增能力。
- 暂停：Bookshelf 有数据页的运行时挂载（含 Phone/Tablet 网格），直至 Figma/产品提供 TitleLines 选择规则。Book Detail、TOC、正文、导入、翻页和动效同样不在本次改动中。

## Phone 本地导入三态与真实意图边界（2026-08-04）

### 本次消费的实时 Figma 节点

- `Library/LocalImportDialog` `2657:918`，仅消费其已画出的 Phone `390×844` 覆盖层：
  - File Selection `2657:916`；
  - Importing `2899:58923`；
  - Import Result `2657:917`。
- 该组件由 `rgba(31,27,23,0.40)` 遮罩及固定位置的窗口组成；File Selection 窗口为 `x=20, y=222.13, w=350, h=399.75`，Importing 窗口为 `x=20, y=308, w=350, h=228`，Import Result 窗口为 `x=20, y=104, w=350, h=636`。
- 组件中的图标只使用上述节点导出的 Figma SVG 资产；不手绘、不以 launcher 图标或其他页面图标替代。

### 目标状态、Core 命令与 Host capability

- 目标：实现可由一个已获准的 Phone 页面入口挂载的 `File Selection → Importing → Import Result` ArkUI 组件。选择文件按钮只发出用户意图；真正的系统 picker、暂存、Base64、逐本导入与结果由现有 `BookshelfFlowGateway.importFromSystemPicker()` 完成。取消与完成只发出关闭意图；组件不自行创建 runtime，也不解析 Core 协议。
- Core：`import.parse`、`import.persist`、`bookshelf.add`，以及已有失败补偿 `import.rollback`；导入结束后的真实书架重读仍为 `bookshelf.list`。
- Host：不新增 NAPI capability；只复用集中 Host 的 `DocumentViewPicker`、文件 URI 暂存及既有 `persistence.get` / `persistence.put`。系统选取器不是 ArkUI 模态状态，也不假装为 Figma 内的文件列表。

### 明确不触碰的暂停项

- 不挂载空书架卡片：`State/BookshelfEmpty` `286:31` 没有 Final Phone/Tablet 书架父级落位。
- 不挂载本导入组件：Figma 没有从空书架/顶栏到该覆盖层的正式触发与父页面状态；实现组件和意图边界不等于猜测入口。
- 不实现 Tablet 导入、导入前确认、回滚确认、重复文件提示、失败重试、无封面本地书的 Bookshelf/Book Detail/正文接续。
- 不实现书架 Cover↔List Motion、翻页或任何未批准动效；Importing 只显示已画出的静态终态，不播放或推断 spinner 动画。

### `FIGMA_VISUAL_GAP`：导入字体素材缺失，停止该局部

`2657:918` 的实际文字度量依赖 `Songti SC Bold` 和多个 `Inter` 字重。Inter 已由下一节以其官方 OFL 字体补齐；目标 Pura 90 API 23 模拟器的 `/system/fonts` 仍没有 Songti。因此当前不能在 ArkUI 侧保证该覆盖层标题的 Figma 字形与度量，也不能以 Noto、HarmonyOS Sans、Source Han Serif 或图片文本替代。

已导出并保留该节点的原始 SVG 图标，且已有 Host→Core 真实导入闭环；但不创建或挂载 `LocalImportDialog.ets`，直至 Figma/产品补 Songti SC 的准确可打包字体或明确 HarmonyOS 字体映射。此项已登记为 `B-IMPORT-FONT-01`，不因组件其余尺寸已知而作近似实现。

## 开源 Inter 字体补齐（2026-08-04）

### 本次消费的实时 Figma 字体节点

- `Library/LocalImportDialog` `2657:918`：Inter Regular、Semi Bold、Bold、Extra Bold。
- `Book Detail / Phone` `943:651`：Inter Regular、Bold、Extra Bold、Black。

### 目标、Core 与 Host 边界

- 目标：从 Inter 作者维护的 `rsms/inter` 官方 `v4.1` 发布源原样下载 `InterVariable.ttf` 及其 SIL Open Font License 1.1，保存为 `Reader-UI/fonts/InterVariable.ttf` 和 HAP 的 rawfile 副本。ArkUI 后续以单个可变字体注册并按 Figma 现有数值字重 `400/600/700/800/900` 消费；不子集化、改名或自制字形。
- Core 命令：无。Host capability：无。

### 已完成的资源校验

- `InterVariable.ttf` 的 UI 源副本和 HAP rawfile 副本 SHA-256 均为 `4989b125924991b90d05b2d16e0e388c48f7d5bb8b30539bbf9c755278d0ccaf`；其可变轴覆盖 `400/600/700/800/900`。
- 对应 `Inter-OFL.txt` 两份副本的 SHA-256 均为 `262481e844521b326f5ecd053e59b98c8b2da78c8ee1bdbb6e8174305e54935a`。

### 明确不触碰的暂停项

- 这只关闭 Inter 的字体资产缺口，不授权把 `Songti SC Bold` 替换为 Noto、Source Han Serif 或任何其他相似字体。
- 空书架父页面、导入触发/结果接续、无封面本地书、Tablet 导入、Book Detail 其余状态、书架 List、翻页与所有动效继续暂停。

## 空书架 Noto Sans SC 字体注册修正（2026-08-04）

### 本次消费的实时 Figma 节点

- `State/BookshelfEmpty` `286:31`：标题、正文和两个按钮均为 `Noto Sans SC`（Bold 或 Regular）；其节点已重新读取。

### 目标、Core 与 Host 边界

- 目标：仅让现有未挂载 `BookshelfEmptyCard` 以 HAP 内已存在的 `NotoSansSC-VF.otf` 注册为 `ReaderNotoSansSC` 后，使用该实际 family alias。布局、文案、素材、尺寸与交互均不变。
- Core 命令：无。Host capability：无。

### 明确不触碰的暂停项

- 不因字体可用而挂载空书架；该卡的 Final 页面落位、响应式规则及导入入口仍缺失。
- 不实现导入、无封面书、Book Detail、列表、Tablet 变体、翻页或动效。

## Phone 导入流程恢复与 EPUB 封面事实修复（2026-08-04）

### 本次消费的实时 Figma 节点

- `Library/LocalImportDialog` `2657:918`：Phone 的 File Selection `2657:916`、Importing `2899:58923`、Import Result `2657:917`；固定 Songti 标题节点为 `2657:761`（“导入本地书籍”）与 `2657:805`（“导入结果”）。
- `23 · Pages · Final / Bookshelf`：Phone `943:11` 与其既有 More Action `I943:11;2236:1502;461:455`；该节点仅提供可见图标状态，不把它的原型反应误报为导入合同。
- `Library/BookCard` `493:196`：Cover / TitleLines=1 的 Phone `493:187` 和 Tablet `2241:2`。这是组件明确的默认属性，不再把“默认一行”错误登记为缺少动态选择规则。
- `Reference/LiveCapture/M3/bookshelf-empty` `574:198`：完整的 Phone 390×844 空书架视觉；其标注为 `reference-only · local frontend-demo-optimized`，故只作为本地开发中空 Core 的精确 Figma 可见起点，不把它误报为 Final/Tablet 验收或替代缺失的正式 Empty 变体。

### 目标页面、真实状态、Core 命令与 Host capability

- 目标：在 Phone 上由 `574:198` 的精确空书架状态承载空 Core，并挂载 Figma 已画的三态导入覆盖层。有数据的 Phone Bookshelf 中，现有 More Action 的点击由 HarmonyOS 输入/路由层直接打开同一覆盖层，不创建额外菜单或过渡页面。该输入映射是工程行为，不宣称为 Figma 原型反应。
- 真实状态：选择文件后仅在系统 picker 返回且实际导入 Promise 尚未完成时显示 Importing；完成后以 `LocalImportBatch` 的真实成功/失败条目填入 Import Result，绝不采用 Figma 示例的“7 本已导入 · 2 本失败”或一秒定时完成。
- Core：`import.parse`、`import.persist`、`bookshelf.add`、失败补偿 `import.rollback`，导入后 `bookshelf.list`；另在 Native Core 中读取 EPUB OPF 已声明的封面资源并作为真实 `coverUrl` 传回，而不采用 Figma demo cover 或 UI 侧占位图。
- Host：复用唯一 `ReaderHostRegistry` 中的 `DocumentViewPicker`、暂存/编码、`persistence.get`、`persistence.put`；不新增 NAPI runtime、网络、TTS、WebDAV 或通用能力层。
- 诊断：若系统 picker 已授权文件但暂存、读取、编码或 Core 调用失败，只记录文件名与实际异常到设备日志；Figma `2657:917` 没有错误文案节点，因此可见结果仍严格为该节点已有的成功/失败标志，不添加自创错误提示。
- 暂存修复：`reader-import/staging` 是跨进程保留的应用私有目录，创建前必须先检查并允许既有目录；不得把系统已授权文件的 `File exists` 误报为导入失败。
- 持久化修复：同一幂等规则也适用于唯一 Host 的 `reader-core` snapshot 目录。真实 `import.persist` 会触发 `persistence.put`；该目录已存在时必须继续写入原子快照，不能让 Core 的业务成功因 Host 目录创建失败而回滚。
- 准入诊断：Bookshelf Final 不满足时，设备日志必须区分“缺声明封面”和“缺阅读进度”两个真实 Core 状态；诊断不新增任何 Figma 可见文案或页面。
- 当前模拟器所选 `epub3_nav_spine_resource_cover.epub` 的 OPF 虽声明 `properties="cover-image"`，但 `OPS/images/cover.png` 只有 5 字节，未满足 PNG 签名；Core 正确返回无 `coverUrl`。这是源文件数据无效，不是 NAPI、ArkTS 或持久化字段丢失，也不授权用示例/占位封面补齐。

### 明确不触碰的暂停项

- 不从 Phone 推断 Tablet 导入、空书架父级、无封面 BookCard/Book Detail、书架“有书但无阅读进度”页、Book Detail/TOC/阅读正文、翻页或任何动效。
- 不以本地 TXT、无 OPF 封面或封面解码失败的书籍伪装为有封面 Figma BookCard；这些数据仍保留在真实 Core 书架，待 Figma 提供无封面状态后再挂载对应可见页。
- 不将 Figma 示例书名、示例封面、固定正文或 Review 状态提升为生产数据。

### 字体与资产处理

- `Songti SC Bold` 仍没有可再分发的 HarmonyOS 字体，因此不把 macOS Songti 文件加入 HAP，也不把动态 Core 书名静态化。两个固定对话框标题改用从相应 Figma 文本节点直接导出的轮廓 SVG；它们是此两个固定字符串的 Figma 素材，不是替代字体或可复用排版方案。
- 该导出解决了开发期固定标签的像素来源，不自动解决字体轮廓的发布授权；发布前仍需确认现有 Figma/字体许可是否允许该 SVG 随 HAP 分发。所有动态数据继续由已授权的 Inter/Noto 字体渲染。

## Local Detail、目录与静态 ReadingSurface 接续声明（2026-08-04）

### 本次消费的实时 Figma 节点

- `Page/Book Detail` 的 Local Phone `2987:11445` 与 Local Tablet `2987:11517`；本次只消费其已画出的顶栏、封面 hero、简介、最近章节、章节信息和底部双操作栏。
- `Reader/FullDirectory` 的 Phone `1995:60567` 与 Tablet `1995:60899`；本次只消费已画出的静态目录布局与行项目，不把章节选择后的视觉变化从 prototype 或相邻页面推断出来。
- `Reader/Responsive/ReadingSurface` 的 Phone `1023:18355` 与 TabletExpanded `1023:18371`；正文对应的 Figma 字体映射为 HAP 已内置的 `Noto Serif SC`，不把它换成系统默认字体。
- `Reader/ReadingPaper/Day`：本次由上述两个实时节点直接导出 Phone PaperLayer asset `6dc0196e-0643-4ca7-a99a-c0ea53ac0e37` 与 TabletExpanded asset `c7045833-5725-4868-8ef0-2a9a950816d0`；两者分别是 100×100 的重复纸纹层，必须与节点指定的日间底色/明暗径向层共同构成 PaperLayer。

### 目标页面、真实状态、Core 命令与 Host capability

- 目标：在真实、带明确 EPUB 封面的本地书满足 Bookshelf Final 准入后，依次由 Book Detail、目录和静态 ReadingSurface 消费实际书籍元数据、目录、章节正文及已保存阅读进度；页面只消费 gateway 给出的 plain state，并发出 intent。
- 资源：只将 Figma 导出的两份 PaperLayer 纹理下载进 HAP 资源；不生成纹理，不拿截图作画布，不使用单端资源代替另一端，也不把 Figma 的示例“雨夜”正文写入运行时数据。
- Core：`local_book.toc`、`local_book.chapter.content`、`reading.progress.get`、`reader.location.resolve`、`reading.progress.update`，以及进入前既有 `bookshelf.list`。本次 gateway 按实际协议校验 `reader.location.resolve` 的 `sourceId=local`、章节、Unicode 标量偏移、进度、viewport、fontScale、行高与分页信息，并只把 canonical location/reflow 的 plain state 暴露给页面；不沿用旧文档中的 `book.toc` / `chapter.content` 名称猜测本地书协议。
- Host：只复用唯一 runtime、`persistence.get` 与 `persistence.put`。本次不接入 HTTP、文件 picker、TTS、WebDAV、网络封面或额外 runtime。

### 明确不触碰的暂停项

- 没有明确封面的书、TXT、本地封面读取失败及“有书但无阅读进度”的 Bookshelf 仍不进入 Final 数据书架；不分配 Figma 示例封面或占位图。
- 不实现翻页、所有未批准动效、目录章节选择后的未画状态、Tablet 目录打开时的正文宽度推断，或任何 Review-only 行为。
- 不将 Figma 节点给出的重复纹理、线性日间底色和径向明暗层误作动效；本次不添加控制层、分页切换、自动翻页或任何新动画。

## ReadingSurface 原文位置与真实行度量基础（2026-08-04）

### 本次消费的实时 Figma 节点

- `Reader/Responsive/ReadingSurface` `1023:18354`，其组件说明规定 `PageBody`、标题和页码只能由同一完整章节的本地分页 manifest 注入。
- Phone `1023:18355` / `1023:18357` 与 TabletExpanded `1023:18371` / `1023:18373`：正文实际宽高、Noto Serif SC、18 字号、35.28 行高、15.8 段距与 2em 首行缩进。

### 目标、Core 命令与 Host capability

- 目标：建立只服务 ReadingSurface 的 Unicode 标量 ↔ ArkUI UTF-16 行边界转换；分页器后续只能使用实际 `TextController` 的 `LineMetrics`，不得通过字符宽度估算或改写章节原文。
- Core：不新增命令。结果将作为已有 `reader.location.resolve` 与 `reading.progress.update` 的 `chapterOffset` 输入；当前改动不提交阅读位置。
- Host：不新增 capability，继续复用唯一 runtime 和既有持久化 Host。

### 明确不触碰的暂停项

- 不实现翻页、页面切换、自动翻页、控制层动效或任何 Review-only 行为。
- 不在 Tablet 目录打开时选择 314 或 670 的正文宽度；该状态继续受 `R-TOC-READING-01` 限制。
- 不把 `trim`、换行归一化、固定段数或 Figma 示例正文当作分页输入，也不以 HAP 编译代替真实 TextController 行度量验证。

## EPUB 段落边界保留（2026-08-04）

### 本次消费的实时 Figma 节点

- `Reader/Responsive/ReadingSurface` `1023:18354` 及 Phone/Tablet 的 `PageBody`：Figma 明确以段落间距和首行缩进排版同一完整章节的分页 manifest；它不授权页面端从被压平的文字猜回原段落。

### 目标、Core 命令与 Host capability

- 目标：修正 Native Core 的 EPUB XHTML 正文提取，使 `p`、`div`、标题、列表等块级边界在 `local_book.chapter.content` 的真实 `content` 中保留为段落分隔；内联文本仍按既有规则去标签、解实体、合并普通空白。
- Core：影响 `import.parse`、`import.persist` 后物化的本地章节，以及 `local_book.chapter.content` 的真实文本和 Unicode 标量位置；不改变 UI 协议外形或凭空创建段落。
- Host：不新增或改变任何 capability。

### 明确不触碰的暂停项

- 不把 EPUB 示例文本写入 ArkUI，不实现翻页、目录选章提交、Tablet TOC 宽度推断或动效。
- 不放宽封面校验、不为无封面书补图；封面与阅读进度准入继续按各自真实状态处理。
- Book Detail 的动态书名在 Figma 中为 `Songti SC Bold`，但 HarmonyOS 没有可再分发字体或准确平台映射；固定“书籍详情”可使用该固定 Figma 字符串的轮廓资产，动态 Core 标题不能以静态示例、Noto 或系统 fallback 替代。

## EPUB 段落边界的导入闭环回归（2026-08-04）

### 本次消费的实时 Figma 节点

- `Reader/Responsive/ReadingSurface` `1023:18354`：`PageBody` 只接受由同一完整章节的本地分页 manifest 注入的真实正文；其段距、硬换行和 Unicode 标量位置不能由页面猜测。

### 目标、Core 命令与 Host capability

- 目标：为 `import.parse → import.persist → local_book.chapter.content` 增加精确正文回归，覆盖 XHTML 块级段落、`br` 和 emoji，确认对 ArkUI 暴露的最终正文保留 `\n\n` / `\n`，并以 Unicode 标量而非 UTF-16 或字节作为位置单位。
- Core：`import.parse`、`import.persist`、`local_book.chapter.content`；不增加 DTO、命令或页面侧文本修复。
- Host：无新增 capability；测试使用 Core 内存存储，HAP 仍只消费唯一 runtime 的既有持久化 Host。

### 明确不触碰的暂停项

- 不实施重导入后的阅读位置迁移策略：这是同一 `bookId` 内容修订后的独立 Core 规则，不能在本次 XHTML 边界修复中暗自用旧 offset 近似恢复。
- 不实现分页、翻页、目录选章提交、Tablet TOC 宽度推断、控制层或任何动效。

## 系统文件选择器返回后的导入结果恢复（2026-08-04）

### 本次消费的实时 Figma 节点

- `Library/LocalImportDialog` `2657:918`：File Selection、Importing 与 Import Result 的 Phone 静态终态；`Import Result` 只展示真实文件名及成功/失败结果，不能在选择器返回后消失或用样例数据重建。

### 目标页面、Core 命令与 Host capability

- 目标：当 `DocumentViewPicker` 暂停并重建 Bookshelf 页面实例时，保存仅限本应用进程生命周期的导入呈现状态。系统 picker 返回后，真实 `LocalImportBatch` 必须重新挂载同一 Figma `Import Result` 终态；取消只关闭该状态，不保留虚构结果。
- Core：不新增命令，继续使用已完成的 `import.parse`、`import.persist`、`bookshelf.add` 和重读 `bookshelf.list`；导入成功/失败仍来自 Core/Host 的实际返回。
- Host：不新增 capability；只复用 `DocumentViewPicker` 和唯一 runtime。暂存的 UI 状态不进入 Core snapshot、书籍数据或任何跨进程业务存储。

### 明确不触碰的暂停项

- 不补“有书但未开始阅读”的 Bookshelf 可见状态，也不为它创建假的阅读位置；有效封面但尚无进度的真实书仍受 `B-BOOKSHELF-STATE-01` 限制。
- 不推断 Tablet 导入、Detail/TOC 路由、分页、翻页、动效或未画的错误文案。

## ReadingSurface 分页 manifest 原文消费修正（2026-08-04）

### 本次消费的实时 Figma 节点

- `Reader/Responsive/ReadingSurface` `1023:18354`，以及 Phone `1023:18355` / TabletExpanded `1023:18371`：组件说明要求 `PageBody` 由同一完整章节的本地分页 manifest 注入；段距、首行缩进和硬换行不能由页面端重新猜分段。

### 目标页面、Core 命令与 Host capability

- 目标：让静态 ReadingSurface 只渲染上游分页 manifest 已选定的原始段落数组，保留每项中的 CRLF、硬换行、首尾空白与 Unicode 标量顺序；页面不再 `trim`、归一化换行或按 `\\n\\n` 自行切分 Core 正文。
- Core：不新增命令，继续消费 `local_book.chapter.content` 的真实内容；段落建立和分页仍属于 Core 内容与本地分页层，而不是 ArkUI 视图。
- Host：不新增 capability；继续复用唯一 runtime 与现有持久化 Host。

### 明确不触碰的暂停项

- 不实现分页算法、翻页、目录选章提交、控制层、动效、Tablet TOC 宽度选择或任何 Figma 未画状态。
- 不用 Figma 示例正文、固定字符数、自然换行或视觉近似来填充 manifest。
