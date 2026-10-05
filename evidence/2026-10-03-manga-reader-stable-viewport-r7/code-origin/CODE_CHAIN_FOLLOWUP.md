# R7 图片顶部浅蓝区域：生产链只读补充审计

审计日期：2026-10-04（Asia/Shanghai）。输入是已冻结的独立交付 workspace `/private/tmp/reader-manga-sheet-ui-delivery-20261003-1913`。本次只读生产源码，没有读取设备、用户数据库、图片缓存或网络资源，没有运行 HDC、构建或新增测试；只新增本报告。此前冻结的 `AUDIT.md`、probe、运行日志、JSON 和 SHASUMS 均未修改。

## 当前结论

本轮没有定位到能确定制造截图中约 72–80px 浅蓝顶部区域的 Reader 代码错误。已逐层排除：首块请求固定偏移、分块之间人为留缝、宽度适配时行内垂直居中、占位行高度被沿用到已就绪图片、目的画布未绘制顶部，以及列表显式 header/padding/initialIndex。

这不是“原图自带边距”的判定，也不是实际首像素已经通过。生产代码能证明请求的区域和布局；现有 SDK probe 能证明真实编译输出的 Image/祖先请求及窄负控。两者不能证明原生 codec 返回的每个像素、Image 解码后的实际绘制起点，或当前书源脚本返回的图像内容。用户已明确不提取首图缓存，这些边界保持 OPEN；本报告不以推测替代字节关联，不提出裁边或硬编码上移。

## 1. Session → Gateway → Runtime：没有首块偏移适配

源码位置以下均相对输入 Host `Reader-for-HarmonyOS/entry/src/main/ets/`。

- `features/manga/MangaSessionController.ts:514–537`：`loadPageOwned` 初次加载明确把 `mangaPosition=0` 交给 ResourceGateway。就绪回执提供 `intrinsicWidth/Height`，普通分块的 `tileHeight=image.height`，预览的 `tileHeight=intrinsicHeight`；geometry 在发布 ready 变化之前写入。
- 同文件 `408–437`：`setTileWindow` 将已解码 `page.image` 原对象、原 URI、原 lease 转交给 `tileIndex=0`。该步骤没有重新解码、改变尺寸、添加透明边或移动图像。
- 同文件 `467–482`：后续块的请求位置是 `tileIndex * tileHeight / intrinsicHeight`。`tileIndex=0` 仍为 0，后续块按真实已准入 geometry 推进。generation、wanted key 和 tile 身份检查限制过期回执。
- `features/manga/MangaResourceGateway.ts:32–74`：位置与 preview 标记透传到 Runtime，没有加减 status 高度、固定像素或书源边距。
- `app/ReaderRuntimeOwner.ts:460–490`：缓存路径和在线准备路径最终都把完整 prepared bytes 与同一 `mangaPosition` 交给 `ReadingBodyImageHost.loadBytes`。缓存读写是字节保存，不做布局、背景绘制或顶部裁边。在线分支先经 Core 准备，再同样进入 Body。

`loadTileOwned` 本身没有再次比较回执 `regionY` 与 tile 的预期 sourceY；实际区域计算和尺寸验证位于 Body。它是像素来源证明的边界，不是已复现的错误：现有公式输入为 0 时没有非零 sourceY，尚无真实相异回执可指向本问题。

## 2. Body：首块 regionY 为 0；EXIF 改变编码坐标而不增加边缘

`app/ReadingBodyImageHost.ts:381–553` 是实际区域解码路径。

普通分块公式为：

```text
tileHeight = min(intrinsicHeight, 2048, max(1, floor(1Mi / intrinsicWidth)))
targetY = min(intrinsicHeight - 1, floor(mangaPosition * intrinsicHeight + 0.000001))
regionY = floor(targetY / tileHeight) * tileHeight
regionHeight = min(tileHeight, intrinsicHeight - regionY)
```

因此有效 `mangaPosition=0` 必然请求 normalized `regionY=0`。微小 epsilon 防止块边界浮点下溢，没有 72、80、statusBar 或手势条高度参与该公式。

EXIF 1/2 的编码 ROI 从 y0 起；3/4 使用 `sourceHeight-regionY-regionHeight`，5/6 从 encoded x0 起；7/8 使用 `sourceWidth-regionY-regionHeight`。后续 flip/rotate 把该编码条带映射回正向首条。这些反向编码坐标有可能非零，含义是选取编码末端条带后旋转，不是给显示顶部增加空白。轴交换时 intrinsic width/height 同步交换。

JPEG/PNG 的 `desiredSize` 与 `desiredRegion.size` 相同，并明确 CROP_FIRST；没有“包含适配后扩大画布”的 Host 分支。普通分块在解码后要求 raw 尺寸等于 ROI 尺寸；旋转后要求 width 等于 intrinsicWidth、height 等于 regionHeight，否则拒绝 MANGA_REGION_DECODE_MISMATCH / TRANSFORM_MISMATCH。预览请求整图区域（x0/y0）及受预算约束的缩略尺寸，由 codec 缩放；也验证最终 target 尺寸。

`decodeBytes:303–331` 将回执的 width/height/intrinsicWidth/intrinsicHeight/regionY 返回给 Session。`materializeDisplayFile:579–614` 只建立按内容 SHA、generation、尺寸及 regionY 区分的 display 文件身份；`performDisplayFileWrite:615–665` 对区域直接 `packToFile(pixelMap, ..., PNG quality100)`，没有创建更大的 PixelMap、填背景或以非零 destinationY 绘制。非派生路径按字节原样写入。

尺寸验证能拒绝意外扩大结果，不能证明同尺寸结果的内容起点。原生 codec 是否精确遵守 ROI、EXIF 变换结果及 PNG pack/二次 Image 解码的实际像素未被本次代码阅读或 SDK 请求探针替代。

## 3. Core / prepared graphics：覆盖完整目的区，没有未绘制顶部

Core `crates/reader-runtime/src/remote/manga_decode.rs:10–18,79–93,114–127,230–272` 根据已绑定的 sourceRuleVersion / manifestVersion 选择 `imageDecode`。无脚本是 identity-v1；有脚本是 bytes-v1。`crates/reader-js/src/lib.rs:9386–9399` 的 owned 入口无脚本时原封返回收到的 bytes，不修改编码内容。脚本字节分支（9599–9611）可以返回解密后的 encoded bytes；Reader 没有额外给这些 bytes 添加边缘，但不能从通用执行器反推出具体书源输出的首像素。

图形适配分支仅允许同宽同高、全宽、不缩放的有限 strip 重排：

- `crates/reader-js/src/manga_graphics.js:24–35,41–45,53–69`：目的 Bitmap 尺寸必须等于输入；每条 source/target 高度一致；sourceY 和 targetY 各自从 0 完整覆盖到 height，缺口、重叠或越界均拒绝。
- `crates/reader-js/src/lib.rs:9281–9335` 再校验上述完整覆盖和固定输出格式。Host `app/MangaImageGraphicsPlan.ts:22–42` 再校验整数坐标、边界、首条 start0 和总高。
- `app/MangaImageGraphicsHost.ts:111–153`：输出 buffer 恰为 `width*height*4`，每条 `readPixels` 读全宽 sourceY 区域，写到 `offset=targetY*width*4`、同宽 stride。所有目的行已由已准入计划覆盖，最终 PixelMap 与输入尺寸完全一致；没有留出顶部空行或额外的 destinationY 外壳偏移。

允许的 strip 排列可以按解密规则把输入中已有的某条空白/浅色内容移动到前面；字节脚本也可以返回内容不同的完整图片。这属于书源解密内容边界。没有检查当前用户书源、实际 plan 或 bytes，不能断言当前首图使用了 graphics、脚本正确，或浅蓝区域来自哪个阶段。

## 4. Projection / Ready 行：块高连续，不沿用未知高度

`features/manga/MangaStripProjection.ts:43–69` 按 `ceil(height/tileHeight)` 生成块；块 `sourceY=tileIndex*tileHeight`，末块高度 `min(tileHeight,height-sourceY)`。首块 sourceY0，末块不加补齐空行，全部块精确覆盖正向 intrinsicHeight，没有块间间隔字段。

未知 geometry 暂用 600×800 单个 placeholder。它没有已就绪 Image，显示的是 spinner/error 占位。`MangaReadingSurface.ets:757–765` 的真实 LazyForEach key 包含 `known,width,height,sourceY,sourceHeight,fileUri,revision,error`；未知→已知、几何变化、URI 就绪都改变表现 key。配合 `publish/notifyPublishedRows:357–407` 的结构 reload / 行变更通知，已就绪图片读取最新行高，而不是继承 800 高的 placeholder。如果在异步等待期观察到 spinner 或暂时 blank，它不能单凭外观等同于稳定 ready 图片里的浅蓝像素。

## 5. Width / contain / List / anchor

`MangaReadingSurface.ets:638–651` 的 width 适配中：

```text
Image.width = viewportWidth * zoom
Image.height = Image.width * row.height / row.width
ListItem.height = Image.height
rowDisplayTop = 0
```

所以 ListItem 的 Center 在宽度适配下没有多余高度可居中。真实 Image Builder `1316–1341` 直接使用 fileUri、上述尺寸和 ImageFit.Fill；List space0。Scroll、List、ListItem 和 Image 没有显式 padding/margin/offset/translate/header/initialIndex/contentStartOffset。前次实际 SDK probe 已覆盖这些生产请求和 margin / Fill 窄负控，本次不重复测试。

contain 是有意不同的模式：known 行宽度最多为 `viewportHeight * width / intrinsicHeight`，ListItem 高度至少为 viewportHeight*zoom，行内上下居中，`rowDisplayTop=(rowHeight-imageHeight)/2` 可以非零。`fitPreference=source` 仅在 manifest 明确 fit contain 时进入它。代码不能对所有模式声称“绝无空白”；当前样本的实际 fit/zoom 来源仍须以已有证据判断，不读取用户设置作替代。已冻结 AUDIT 记录的 A 首 ListItem 与 Image bounds/origBounds 都从 y0 起且同为524高，没有图像和行之间的顶部居中空间；它支持排除该样本的行内 contain gap，不能证明映射的第一个 source pixel。

`open:213–316` / `publish:357–384` 只在 manifest/page 身份吻合时使用已保存的位置，否则逻辑 y0。`restore:449–472` 先 scrollToIndex(START)，再以非负行内裁切量 scrollBy；width y0 对应首块 sourceY0、scrollBy0。正 y 恢复会滚入图片，不能由该公式额外向下填一个蓝色区。contain 的 rowDisplayTop 补偿仅在 y>0 时参与恢复。`rememberVisible:416–438` 在读取原生矩形前验证当前 scale/行高，未知 geometry 不覆盖已测 anchor。resize 使用先前逻辑 anchor，无固定 status 高度相加；用户触摸取消尚未生效的异步恢复 generation。

实际保存的 ordinal/y/x、本帧原生列表偏移和 overscroll 状态没有被本次访问。不能把“逻辑首块公式”写成“用户当前一定在 ordinal0/tile0”，也不能把无 authored offset 写成原生列表不会产生任何瞬时移动。`changeFit:655–672` 在 preview 切换异步期间会重发 geometry 和恢复旧 anchor；代码无固定浅蓝间隙，如怀疑该时段瞬态仍需要有具体状态时序的反例，当前没有可确定归因本截图的反例。

## 边界与后续决策

| 项目 | 代码侧结论 |
| --- | --- |
| 首 tile 请求被人为加 y / 72–80 常数 | 已排除本链，position0→normalized regionY0 |
| tileHeight 补足末块或插入块间缝 | 已排除，连续覆盖实际 intrinsicHeight |
| width ready 图片被占位行或 Center 下移 | 已排除生产几何；实际 SDK 窄负控已覆盖 |
| graphics 新画布增加边框 / 顶部未绘制 | 已排除已准入计划，尺寸不变且目的全覆盖 |
| EXIF / ROI / pack / Image 原生同尺寸像素正确 | OPEN；尺寸与请求成立，不等于真实像素证明 |
| 源图 / imageDecode 字节或 strip 内容本身 | OPEN；未访问当前数据/缓存，不能归属 |
| 含 contain 的所有配置都无上下空白 | 不成立；contain 明确有意居中，width 零原点结论不能外推 |
| Index/Shell/window safe-area 或 clip | 由 Root 独立审计，本报告不把另一链未决项写成通过 |

本轮没有足够具体的代码缺陷支持修改生产，也不新增镜像测试。保留当前 UI 全窗口链与宽度适配公式；不裁源内容、不写固定负 offset、不把潜在原生像素问题宣称已经修复。用户不提取 cache 的约束下，源码层可排除项已经列清，源像素/原生绘制的剩余未知继续明示。

## 审计输入 SHA-256

以下均在只读审计时重新计算；Manga 主文件与 R7 冻结 SHA 相同。

```text
4e8cda54f879494a574de75ab2c85821d02edd96b70bdbf8e3e1085150461676  Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets
a478eaf8d41cdc1d3fe097f53dab2982fe9ea5a5a68fe20ab7839fdea16c0363  Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaStripProjection.ts
88007c3ced534ee439348af492de53942c28606127313e8912d714fe60390857  Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaSessionController.ts
c1c94073f97e5a2db641a1aec1cca17c93551b876dded3e352b95415cd269105  Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaResourceGateway.ts
77758b6ecac7701f36964c554691b90464d1764ba57bd5ce350bb63033d68e05  Reader-for-HarmonyOS/entry/src/main/ets/app/ReaderRuntimeOwner.ts
63fed92b1bc7808a49ffac8f48eb237b01d016830ba054102a3b764a43ae1f1e  Reader-for-HarmonyOS/entry/src/main/ets/app/ReadingBodyImageHost.ts
a3e559256d7503d331c5e1d1dd97133dc9cdd6b3ee668d0a43ffa7eac79d64f9  Reader-for-HarmonyOS/entry/src/main/ets/app/MangaImageGraphicsPlan.ts
002b4475f33fceb699f78b99ce6e01eeaa3305f96e04b8c8797e5005c1721090  Reader-for-HarmonyOS/entry/src/main/ets/app/MangaImageGraphicsHost.ts
b9793c2562928c52957816f9696359fc11ac78e163de47ade5a5d12336c36d2b  Reader-Core-Native/crates/reader-runtime/src/remote/manga_decode.rs
cf027e209ea3af1c26eb23e9058db1c31d72e4fa8992d707118780b5a0edba4d  Reader-Core-Native/crates/reader-js/src/lib.rs
8edd6e0def4a7103bbdb3276cf97ca784cf34da682c2dde6c7119dc4065abd9f  Reader-Core-Native/crates/reader-js/src/manga_graphics.js
```
