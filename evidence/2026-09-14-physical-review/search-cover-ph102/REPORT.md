# PH102 搜索进行中封面闪烁

用户反馈搜索进行中很多封面闪烁。审计基线 Harmony `d68e89b7` / Core `bf4949531`，开始时clean；VM当前run `20260915T170116Z-973aa937-8ca702f9`，手机最后run `20260915T151630Z-356f150e-e58cc5c3`。关键词和现场帧未绑定，本轮先代码定位，不占用设备。

## 定位与修复

1. `SearchResultDataSource.replace` 在同书的源数量、简介、可用性等变化时，对已保留的 `@Observed SearchBookGroup` 再发送批量 `CHANGE`。这不是单纯属性通知。OpenHarmony公开引擎 `LazyForEachBuilder::RepairDatasetItems` 的 `isChanged` 分支将原节点改为null并执行offscreen清理，即使沿用key也会失去原子节点。旧测试只检查JS行对象相同和通知数量，未验证实际Image连续性。新增生产方法回归修前明确产生`change index0`并失败。
2. 原卡片直接用 `group.book.coverUrl`；同组代表源会随目录/正文验证的优先级切换。封面跟着代表源变化，导致重新请求/解码甚至在图片与占位之间切换。当前选择保持已接纳封面，只要其URL仍属于同一组候选且未加载失败。代表源、简介和点击目标继续按当前证据更新，封面选择不反写Core数据，也不改阅读准入策略。

实施：保留原有LazyForEach、稳定书籍key、原生排序/增删移动路径，同key内容仅由已有ObjectLink更新，不再发CHANGE。每个行对象保留独立coverUrl和本行已失败URL集合。无封面时补第一条非空URL；真实onError只改同一行当前URL，可换同组其他封面，均失败时使用原有占位。新searchRequestId清除前次失败事实；旧URL/旧请求回调不能污染当前封面。不新增网络预取或图片缓存引擎，图片传输解码缓存继续由ArkUI Image处理；新源admit只看新候选，不反复扫描全组。

对照来源（2026-09-16只读审计，公开master不冒称与当前手机Native字节一致）：
- [官方批量变更实现](https://github.com/openharmony/arkui_ace_engine/blob/master/frameworks/core/components_ng/syntax/lazy_for_each_builder.cpp#L447-L452)
- [官方LazyForEach合同](https://github.com/openharmony/docs/blob/master/zh-cn/application-dev/reference/apis-arkui/arkui-ts/ts-rendering-control-lazyforeach.md)

## 本地验证

`tools/test-search-cover-continuity.mjs` 执行实际SearchBookGroup/DataSource、SDK编译后的SearchResultCard、当前安装SDK原始ObservedObject与ObjectLink属性实现；依赖调度作最小instrumentation，不模拟原生绘制。60轮同组代表源和简介变化，Image observer身份及URL保持、文本正常更新、点击目标与全部variants仍最新，结构通知为0。另覆盖失败换图、全部失败、晚到URL及跨请求回调、空白URL、后到候选恢复和另一书籍隔离。

已有4千行增删/排序/锚点回归、真实Index→SearchPage publication边界、手机/平板/日夜卡片比例与标签布局均通过。旧测试中要求元数据CHANGE的断言改为要求ObjectLink更新且不替换Native行，结构操作原坐标和排序仍验证。新增SDK测试辅助仅补充原始NestedObject属性类及对象类型边界。

没有运行VM/真机搜索；网络站点自身错误、原生解码时间与现场闪烁帧是否全部消除仍待新包设备验证。代码/本地事实不替代像素或用户验收。

## 产物

修复提交 `d920db3d`，构建源码 Harmony `12710922` / Core `bf49495317798f68b98928712eb6e106af02bed1`，构建时两仓clean。run `20260915T173454Z-12710922-83b13ceb`；277组Harmony、ArkTS、隔离非增量构建、signed debug签名及独立manifest复验PASS，Native未改。

[manifest](../../../.reader-artifacts/hap/20260915T173454Z-12710922-83b13ceb/manifest.json)，签名HAP SHA-256 `8458bbc7fb683997377af1b96e27200d2fbfdac6be8b176657741d524ad41bc8`。既有SearchPage普通迭代变量传ObjectLink等SDK警告仍在日志中；实际Observed/ObjectLink回归正常且编译通过，不称无警告。

该包同时含PH101朗读启动与PH89倒计时基线修正。本轮未安装，手机和VM均维持上文原包；iteration并非验收候选，设备闪烁/原生帧率/用户验收OPEN。
