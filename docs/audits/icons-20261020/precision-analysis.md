# 图标清晰度诊断（2026-10-20）

用户参考图的原始文件为 1280 × 2832 PNG。它没有整体降低为低分辨率，但动作面板的四个图标确实丢失了应有的边缘过渡：在原像素中呈现硬锯齿，预览再缩小时容易表现为发虚。现在不能把这个现象归因于“SVG 只有 24 px”，也不能用 `sourceSize` 或 `interpolation(High)` 提高这些 SVG 的精度。

本记录只读检查源图、已有 UI 树、当前源码和 SDK，并裁切原 PNG 做像素分析；没有构建、测试、设备操作或生产代码修改。截图包含现已删除的底部描述，因此它证明的是截图当时的结果，不能充当当前版本的复验结果。

## 1. 原图证据

- 原图：[reader-control-book-action-fixed.png](../../../.reader-artifacts/bookshelf-action-ui-20261019/reader-control-book-action-fixed.png)
- 同时点 UI 树：[reader-control-book-action-fixed.json](../../../.reader-artifacts/bookshelf-action-ui-20261019/reader-control-book-action-fixed.json)
- 原始裁切：[80 × 80 px PNG](precision-check-original-crop.png)
- 放大观察：[最近邻 8 倍 PNG](precision-check-nearest-8x.png)。仅复制原像素展示台阶，不创造边缘，不作为改善后效果图。

`Image` 的四个物理边界均为 77 × 77 px：

| 图形 | 原图中的边界（px） | 裁切的不同 RGBA 色值数 | 观察 |
| --- | --- | ---: | --- |
| 多选勾 | `[95,1977][172,2054]` | 2 | 5466 个背景像素、463 个纯白像素，无中间覆盖色 |
| 信息 | `[95,2175][172,2252]` | 2 | 4551 个背景像素、1378 个纯白像素 |
| 文件夹 | `[95,2373][172,2450]` | 2 | 4667 个背景像素、1262 个纯白像素 |
| 垃圾桶 | `[95,2598][172,2675]` | 2 | 3865 个危险色背景像素、2064 个纯白像素 |

三个普通底色为 `(46,74,62,255)`，危险底色为 `(165,61,49,255)`，四个前景都是 `(255,255,255,255)`。上述裁切完全位于圆角底色内部，没有混入文字或底色外缘。

对照同一张 PNG：顶部搜索图标裁切 `[106,211][190,292]` 有 52 种色值；标题文字裁切 `[70,1760][410,1855]` 有 252 种色值。可以排除“整个 PNG 被二值化”“截图整体没有抗锯齿”这两种解释。图标自身边缘缺少过渡，是已有图中的实际问题。

聊天/查看工具可能把 1280 × 2832 缩为 926 × 2048；这个重采样会额外改变观感。本结论来自文件的原始像素，未用缩略图推断设备分辨率。

## 2. 本轮修复前的代码及几何

本轮审计时 `ReaderSheetActionList` 复用的资源如下；这个清单记录修复前工作树，不反推旧 HAP 中每个资源的版本：

| 当前资源（day/night 成对） | width/height | viewBox | 原线宽 | 22 vp 下的有效线宽 |
| --- | --- | --- | ---: | ---: |
| `bookshelf_more_batch` | 24 × 24 | 0 0 24 24 | 1.75 | 1.604 vp |
| `settings_row_about` | 48 × 48 | 0 0 48 48 | 3.5 | 1.604 vp |
| `source_group_folder` | 48 × 48 | 0 0 48 48 | 3.5 | 1.604 vp |
| `download_visual_trash` | 未写 intrinsic width/height | 0 0 24 24 | 2 | 1.833 vp |

`ReaderActionMenuSurface.row()` 由 `ActionSheetSurfaceSpec.iconSize = 22` 控制实际宽高，容器为 36 vp。已有 UI 树的 77 px 与 22 vp × 3.5 一致；这只是当前几何与旧截图的对应关系，不代替读取设备的实际 density。

这些文件均是 path/stroke 矢量，没有嵌入小尺寸位图。`viewBox=24` 或 `width=24` 是矢量坐标/固有几何，不等于只生成 24 个屏幕像素。把它改成 `width=96`、保持相同 `viewBox`，不能据此宣称可见精度提高四倍。

前三者归一后的线宽一致，垃圾桶约粗 14.3%；这是样式一致性问题，与抗锯齿缺失分别处理。非整数物理线宽和曲线必然需要覆盖率过渡；把所有路径坐标强行取整，会改变形状，不能替代抗锯齿。

当前四图共享 `.colorFilter(this.actionIconFilter())` 路径，而同图搜索图标不经过它。旧图四图同时缺少过渡，是优先检查该染色路径的充分线索；**现有材料尚不能证明底层滤镜就是唯一原因**，也没有截图同包的完整 source binding 可以证明旧矩阵与当前矩阵完全相同。

修复前矩阵 alpha 行为 `[0, 0, 0, color.alpha / 255, 0]`。SDK `ColorMetrics.alpha` getter 的值域确为 0…255，除以 255 正确；不能将该行直接改为 `color.alpha`。

**另外已从代码定位到明确的 RGB 偏移错误。** 它把同样是 0…255 的 `color.red/green/blue` 直接放在矩阵最后一列。官方 Image 文档的 [计算公式图](https://raw.githubusercontent.com/openharmony/docs/OpenHarmony-6.0-Release/zh-cn/application-dev/reference/apis-arkui/arkui-ts/figures/image_matrix_2.png) 对最后一列另外乘以 255，例如 `R' = r1R + r2G + r3B + r4A + 255r5`。所以把 252 当作偏移会生成 64,260，远超通道上限，饱和为白色；要保持预期纸色，偏移应为 `color.red / 255` 等归一化值。这个错误与截图前景均为纯白的结果一致，但它不能单独证明所有边缘过渡丢失的底层原因。

需要动态染色时，也可复用官方示例提供的 `drawing.ColorFilter.createBlendModeColorFilter(common2D.Color, drawing.BlendMode.SRC_IN)`；该 `common2D.Color` 的通道使用 0…255，不要把它与矩阵系数的单位混用。应由同一公共图标角色函数管理，而不是在每个页面再写一套颜色矩阵。一个正确的颜色滤镜也不应被一概描述成会降低分辨率。

## 3. SDK 支持边界

本机声明位于 `/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/component/image.d.ts`，项目 `build-profile.json5` 指定兼容/目标 SDK `6.1.0(23)`。下表同时与 [OpenHarmony 官方 Image 文档](https://github.com/openharmony/docs/blob/OpenHarmony-6.0-Release/zh-cn/application-dev/reference/apis-arkui/arkui-ts/ts-basic-components-image.md) 对照。

| API | 对本次 SVG 能否解决问题 | 关键限制 |
| --- | --- | --- |
| `sourceSize` | 不能 | SVG 不支持；面向位图降采样，目标必须小于源尺寸。`ImageSourceSize` 数值单位为 vp，不能再把 density 乘进去当作 px。 |
| `autoResize` | 不能 | SVG 不支持。关闭位图自动降采样可能增加内存，不是 SVG 开关。 |
| `interpolation(High)` | 不能 | SVG 不支持；是位图缩放插值，不增加矢量路径精度。 |
| `renderMode` | 不能 | SVG 不支持，且设置颜色滤镜时不生效。 |
| `objectFit(ImageFit.Contain)` | 可以明确几何约束 | 保持完整图形和纵横比；方形资源放在方形布局时不承诺额外像素质量收益。 |
| `fillColor` | 不能直接替代现有 stroke 染色 | 当前资源以 stroke 为主，不可为改色把空心路径变成实心。 |
| `Image(...).antiAlias(true)` | 不存在此公共 Image API | SDK 的 `antiAlias` 属于 `CommonShapeMethod`，不可误加给 Image。 |
| `pixelRound` | 不能解决该图的缺失过渡 | 公共属性默认对未指定方向就近取整；已有四图边界都是整数。 |

[官方 SVG 能力文档](https://github.com/openharmony/docs/blob/master/zh-cn/application-dev/reference/apis-arkui/arkui-ts/ts-image-svg2-capabilities.md) 另说明 `supportSvg2(true)` 从 API 21 扩大颜色滤镜作用范围，并改变 `fill=none` 等解析语义。它是解析兼容选择，不能当作提高清晰度按钮，也不宜为这四图顺便全局开启。

开源引擎的 [SvgGraphic 实现](https://github.com/openharmony/arkui_ace_engine/blob/master/frameworks/core/components_ng/svg/parse/svg_graphic.cpp) 直接绘制路径，并有 stroke/fill 抗锯齿设置；它是架构参考。该仓库 master 不等于本机闭源 HarmonyOS 的精确实现版本，不能把其默认值当作这张真机图已经通过的证据。

## 4. 最小修复方向与影响

优先保持 22 vp 图标和现有容器/触控尺寸，用明确的语义 day/night SVG 前景资源直接绘制这组图标，减少对跨场景资源的运行时染色依赖；配合 `Contain`，不在普通图标上叠加额外缩放。公共组件仍按有限角色选择颜色和状态，不允许调用方任意借图。

这种方案使用已有 SVG 能力与资源管理，不引入自建解码器、Canvas 图标系统或运行时超采样缓存。预期只增加少量矢量文本资源，并减少该组运行时滤镜使用；精确帧耗时仍须以实际实现为准，不能承诺零成本。

如果以后改用 PixelMap/位图，才需要按实际 density 让目标纹理像素匹配显示像素，例如 22 vp 在 density=3.5 时约为 77 × 77 px。RGBA 单图理论像素负载为 `77 × 77 × 4 = 23,716 B`（约 23.2 KiB，不含对象、GPU 对齐和缓存）。线性尺寸盲目乘 2 后约 92.6 KiB，乘 4 后约 370.6 KiB；分别是 4 倍、16 倍像素负载，并增加栅格化、上传和采样成本。四图同时缓存还要再乘数量。

超采样后最终仍要落到设备原有物理像素，不会提高屏幕分辨率。它可能改善特定栅格边缘，也可能因下采样滤波让细线更软；对现有矢量直绘首先修正确的绘制/颜色路径，比增加离屏纹理合理。

## 5. 仍需区分的验证结果

当前可以确认：原图四图缺少边缘过渡、整体截图仍有抗锯齿、修复前 RGB 矩阵偏移少做归一化导致通道饱和、SVG 不受 intrinsic 24/48 px 的位图上限约束、上述解码/插值参数不能提升 SVG。

当前不能确认：完成本次生产修复后的真机边缘是否已恢复、旧包实际底层染色/渲染发生缺失过渡的精确系统实现分支、修复前后实际帧耗时。若代码侧仍无法排除，需要回答的最小设备问题是“保持相同 22 vp、同一密度和静止时点，直接语义 SVG 相对原滤镜路径是否恢复中间覆盖色”，只需该面板的局部结果，不扩大为全应用门禁或全量设备遍历。
