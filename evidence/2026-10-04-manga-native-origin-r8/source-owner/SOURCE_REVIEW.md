# R8 原生 Image 目的区数值探针：源码收口

仅 temporary delivery Host 是本轮写入源；R7 product/evidence/probe/SHASUMS 未改。此版本只为取得实际漫画 Image 的原生几何回执，无文件/cache/PixelMap/HTTP 读取，无 HDC，无构建或安装。

## 原生语义与证据层级

安装 SDK 的 `component/image.d.ts:1682–1945` 声明 `onComplete` 的九个数值字段；0 是数据加载完成，1 是解码完成。原生 NG Image 在成功分支从 loading context 取得 dstRect，并用 dstRect 与组件 contentOffset 计算回执的目的区。JS 桥只复制 native event 字段，因此本探针不是读取 JS 的 width/height 请求。参见 [官方 ImagePattern 实现](https://github.com/openharmony/arkui_ace_engine/blob/master/frameworks/core/components_ng/pattern/image/image_pattern.cpp#L412) 和 [官方 JS 事件桥](https://github.com/openharmony/arkui_ace_engine/blob/master/frameworks/bridge/declarative_frontend/jsview/js_image.cpp#L110)。

该回调先于 MarkNeedRenderOnly，是原生已计算的目的区域，不是已提交到屏幕的帧。这里核查的是官方 upstream master 与本机 API 声明，未把 upstream 当成当前 VM 的二进制源码绑定。native content/component 字段只在同一事件单位下比较；Area 以 vp 独立输出，density 另列，未将二者直接混算。即使目的区有效且 offset0，也不能证明源图第一个颜色、codec 输出像素或全窗口祖先没有偏移。

## 接入和最小行为

- EntryAbility 仅在 cold onCreate 的 DEBUG=true、BUILD_MODE_NAME='debug'、Want 参数为 primitive true 三条件下设置 `readerMangaImageOriginProbe`。缺少参数或字符串/数字均为 false；onNewWant 不开探针，onDestroy 关闭。Surface 只读 AppStorage Link，所有入口严格 `===true`。
- 真实 Image 仅增加 onComplete / onAreaChange 两个观察回调；原 URI表达式、ImageFit.Fill、尺寸、key、draggable、父边距与列表/anchor 代码不变，没有新增 Image.id。viewport 原 onAreaChange 在原 resize 后附加数值观察。
- Callback factory 捕获已有 controller/chapter/tile/image 对象、row 数值几何和既有 opaque key，用于拒绝已释放、旧身份、替换图片对象或表现 key 变化后的回执；不读取或输出 URI内容。结构发布/表现变化和卸载使样本失效，旧排队帧有 generation fence。
- 最多缓存8行，仅缓存九个 native 数值、原生 Area 数值和 generation。最多输出128条。Tag 为 `MangaGeometry`，日志无 sourceId/bookId/title/URL/fileUri/pixels、原始 event spread 或缓存路径。
- controls/panel/metrics 变化安排至多一条排队 frame callback。metrics Watch 通过 propertyName 分支只调用诊断，不重复 chrome/policy 写入。snapshot 的 retainedReceipt 标记和 state/receipt/Area generations 不把历史 onComplete 伪造成新回执；`submittedPaintEvidence` 恒为0。无新回执的状态切换维持 OPEN。
- flag 在排队期间关闭，回调会清空并停止输出；身份无效、退出或卸载同样阻止输出。调度失败不改变 UI/runtime/settings/source/anchor。

纯 TS validator 只检查 native destination：missing、未解码或非法数值为 OPEN；明确非零偏移或 destination/component 尺寸不同为 FAIL；有效零原点且尺寸吻合才是 local native-destination PASS。0.5个同一 native unit 仅为数值舍入容差，没有 status 高度、裁边算法或固定向上 offset。native origin PASS 不能提升为 FULLSCREEN/源颜色结论。

## 本地验证与失败保留

既有 surface、sheet motion、sheet selection、window chrome order 25cases 在最终调用门禁版本5bb2aedd上 exit0，实际 stdout 保存在 `related-sdk.json`。assembly、render-key、stable viewport SDK也已通过。最后只新增两行 opaque publishedRowKeys fence，最终源 b16c0207 再由独立 test owner 实际 SDK lower：65cases + 2生产 source mutations PASS（其工具、完整输出和报告由独立 owner保存）。Root canonical 后续会完整运行全部门禁，本报告没有包/设备结论。

首次 related run 暴露原缩减 fixture 未抽取新增 diagnostic helper：motion/selection 调用 invalidateImageGeometrySamples 抛 TypeError，window order 调用 imageGeometryStateChanged 抛 TypeError。修复是在 production 调用点增加严格 enabled gate，使默认关闭路径完全不进入诊断；没有放宽旧断言或改这些旧测试。首次把 assembly 命令误写为不存在的 test-manga-ui-assembly.mjs，随后使用真实 test-manga-ui-assembly-sdk.mjs 并通过。仓库级 git diff --check 受缺失 git-lfs filter-process阻断；四个本轮文件已用独立 scoped whitespace check，并从精确 R7 内容生成 source-diff.patch，未修改 Git LFS 或运行构建。

## 冻结

SOURCE_FROZEN=true。四个输入及精确 baseline SHA 见 `source-hashes.json`；本 owner 不再改 product/helper。新独立 native SDK test 的工具冻结由其 owner 宣告。此 report/delta 是新的 R8 证据，不覆盖 R7 冻结材料；剩余真实 native 回执和 UI tree 关联由 Root 按规范处理，仍不提取用户图片缓存。
