# 控制栏重复属性更新修复

## CU-01 设置选项的每帧重复属性下发

- 现象：用户报告控制栏展开/收起中段卡顿、停留。历史 a11ccc84 Settings expand UI VSync 57.926ms，Settings 更新 28.515ms；这些不是当前版本的耗时。
- 触发：设置面板共享进度变化；13 个选项 Text 的同一更新闭包同时读取进度、宽度、设置快照，并重复设置字体、颜色、圆角、事件等未变化属性。
- 源码身份：本目录 baseline.json；共享 dirty 树，不回退其他任务修改。
- 代码结论：真实 SDK 编译闭包可证明重复下发；不能由调用次数直接推出原生布局/滤镜耗时。
- 修复：复用 ArkUI AttributeModifier 的原生属性差分，保留 Text 节点、真实尺寸重排、原模糊/透明度和裁剪层级。仅新增 Reader 的选项样式适配，不自研通用属性缓存或渲染引擎。
- 上游：已安装 SDK API 23 提供接口；OpenHarmony arkui_ace_engine 5.0.0 Release 官方实现（Apache-2.0，blob db887af84f29a4b7a4b26e6e25e80af753eaa344）确认 ModifierWithKey.applyStage 的标量/对象差分。实际 VM API 23 效果仍须单独测量。
- 本地回归：待执行；必须覆盖原属性等价、展开/收起/反向/停住、宽度/能力/业务状态变化、稳定回调读取最新业务数据。
- VM：已只读发现现有实例，尚未安装或操作应用。待完整就绪门禁、锁与精确候选后进行同路线测量。
- 真机：不使用；此前释放状态保持。

## 仍需追踪

- CU-02：Panel 更新、原生布局、20 个运行时模糊作用节点的各自耗时，尚未证明仅靠 CU-01 可消除长帧。
- 继承 2026-09-12-rendering-residual-repair、2026-09-11-code-rendering-audit 与原 52 项总账的未决点；不以本批次替换或清空。

## CU-03 日志查询参数错误（已代码侧修正）

- 首次就绪检查使用 hilog -x -t 150；该工具的 -t 表示日志类型，返回 Invalid log type，不能作为稳定性证据。
- 改用 hilog -x，保存 vm-system-log.txt：6283 行、822891 字节，未出现 LIFECYCLE_TIMEOUT / SceneBoard exits 4times / kernel panic / guest reset。
- VM boot completed=true、SceneBoard PID 2458 两次保持，现有实例 Emulator.log 有 Guest OS Boot Completed!!。尚未操作应用。

## CU-04 全量门禁中的在线朗读旧断言（已定位）

- build-1.log：test-reader-http-tts-gateway.mjs:58 期望 POST 被拒绝，但返回成功；隔离编译未开始、未产包。
- 当前 ReaderHttpTtsGateway.ts 的描述符已允许 GET/POST；Core http_tts_profile.rs 的 speech-json、Azure SSML 分支明确生成 POST，并有请求体测试。旧断言与现行接口冲突。
- 修正旧测试：增加合法 POST 请求体/头透传，使用 PATCH 检查非法方法，并保留非法 body 拒绝；没有更改正在扩展的朗读生产逻辑，不声明 Host 传输/播放已验收。

## 本地结果

- 真实 SDK 已挂载闭包：反向、宽度、业务选中、能力禁用、开关和保留回调回归 PASS。
- 官方固定版本差分 + 生产 Modifier：13 节点，120 个姿态，原生属性调用 24960 → 9000（63.94%）；逐项比较真实几何、模糊、透明度、选中态。5.0 fontWeight 对象仍会重复下发，停住时不宣称零调用。
- 这些结果不换算为 VM 帧耗时，也不证明 CU-02 已关闭。

## CU-06 背景触摸区域每帧分配（已代码侧修正）

- `ReaderControlPanel.reportBackdropRegions()` 原先每次姿态新建区域数组和顶部矩形；动效期间该路径随 runtime frame 重复执行。
- 现在复用稳定的两项区域数组和矩形对象，只更新坐标/尺寸/ready；Host 仍接收同样的两个排除区域，隐藏和布局未改变。
- `test-reader-control-backdrop-publication.mjs` 验证连续姿态保持数组/矩形身份、坐标实时更新和 ready 状态。

## CU-05 构建中共享源码发生变化（未发布候选）

- build-2.log：188 组合同通过，ArkTS/Native 和签名步骤完成；发布前 source fingerprint 883809dc… 变成 2c75dfff…，流水线退出 1。
- 本轮没有新的 manifest，不准选择临时 HAP。构建已退出，没有持续占用构建锁或 VM。
- 当前原子改动回归已完成，等待共享源码交接协调后的统一构建；不归因给未确认的写入者，不回滚或覆盖其他修改。
- 之后的完整本地门禁（含本轮新增测试）最终为 196 组通过、退出码 0；该结果仍只属于代码/本地证据层。
