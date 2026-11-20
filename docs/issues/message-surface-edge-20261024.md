# 悬浮框绘制越过边框（2026-10-24）

## 用户报告与交付身份

用户在安装消息框架接入包后报告“悬浮框边缘有不明浮层”，随后明确为“悬浮框的实际边缘超出了边框位置”。目前未指明具体页面或消息类别；不能直接等同于 Toast，也不能把正常软投影当作已经定位的根因。

- 最近安装：`20261023T155303Z-6b1bd753-be3ba859`，signed HAP SHA256 `cd6771df0b6153d901e603d72934237d76438ad7f3976068e1a8a49dafdf7332`。
- Harmony 输入：`6b1bd7534b61a8ebfac10150fd308eae8430606e` + dirty 快照；Core：`9131ddcfeef1922620c6867f88fe82608e51a079`。
- 保数据安装和启动已有回执；本问题说明原生视觉仍未验收。
- 同时报告的搜索简介 HTML 标签问题单独记录为 `search-intro-markup-20261024.md`。

## 代码侧审计范围

共享 Toast、RecoveryNotice、DialogSurface、BoundedSurface、书架更多菜单，以及这些组件的原生 Sheet/Dialog 宿主。核对背景/边框/圆角/裁剪/阴影是否使用同一实际尺寸，并检查父层重复背景与默认原生样式。

初步发现：Toast 显式绘制 18px 阴影且未裁剪子内容；RecoveryNotice 绘制 16px 阴影、没有独立边框；这两项本身不足以证明用户看到的越界来自它们。批准原稿也包含软投影。需继续区分可见实体背景、子节点越界、默认宿主背板与软投影。

未执行设备截图、交互测试、全量门禁或新包构建。后续检查只针对定位到的具体共享框体与简介格式化路径；测试入口、嵌套调用和必要性在执行前追加。

## 具体入口与代码定位

用户进一步指明“顶部现在你不是改成悬浮框了嘛，整个悬浮框外部边缘都比线条轮廓更大”。对应当前搜索顶部合并卡片，继续向上追踪而非修改 Toast：

1. `SearchPage.build` 仍传 `headerKind: 'search'`。
2. `ReaderPageScaffold → ReaderFixedHeaderHost → ReaderHeaderFrameModifier` 将该 kind 按旧固定实体顶栏处理，默认 `surface: 'solid'`，绘制满宽 `TOK_PAPER` 背板并矩形裁剪。
3. 内部圆角卡片还有手机左右各 16vp / 平板各 20vp、底部 6vp 的外部留白；外层背板把这些本该透明的范围一并遮住。卡片本身另有 5px 模糊/2px偏移投影，增加第二圈外边缘。

修复限 `SearchPage.ets`：改用已有 `floating` 透明宿主；背景、边框和13vp圆角仍在同一 Column，增加该节点圆角裁剪，移除该卡片外扩投影。不改变尺寸、头部测量、列表起点、筛选展开、搜索状态、重试或点击业务。其余 Toast/通知/弹窗投影不作无依据修改。

## 本轮必要检查计划

- 问题局部脚本 `tools/evidence/search-surface-edge-20261024/probe.mjs`：只执行实际 SearchPage 的 build/searchHeader、ReaderPageScaffold/ReaderFixedHeaderHost 及 ReaderHeaderFrameModifier 链路的 SDK lowering/属性发射；日夜、初始/结果、筛选收起/展开。嵌套只有已有 ETS SDK 与 builder 工具，不跑父套件、网络或设备。必要性：此前只审卡片内层会漏掉祖先实体背板，需证明真实生产接线使用透明宿主且仅卡片持有背景边框；另保留原头部高度回调的绑定。
- `git diff --check` 仅本轮文件，检查补丁格式。
- 本轮开发包依次使用 `Reader-Core/scripts/build-harmony-napi.sh`（嵌套现有 build-ohos 的单个 reader-ffi release 目标、CMake桥接与输入指纹；不带 host-probe/sdk-smoke），Host `hap-pipeline.mjs sync-native`（配套字节核验与同步），`hap-pipeline.mjs build --class iteration`（contracts none、真实ArkTS编译、隔离打包、包字节与指定证书核验）。必要性：简介修复位于 Core，新 HAP 必须带本次解析实现；不能打包旧 SO。构建及本地探针均不能代替原生像素验收。

## 局部 SDK 结果与审计边界

当前已定位到搜索顶部卡片的祖先实体背板，不再处于“未知框体”的初始状态。前期只读审计的排除依据仍保留：`ReaderTransientToast.ets:108–114` 的背景/边框/圆角在同一 Row，外围定位 Stack 没有背景；批准原稿 `approved-original.html:66` 明确保留软投影。`Index.ets:5003` 的移除确认框使用 `customStyle:true`，本机 SDK `custom_dialog_controller.d.ts:127–134` 明确该宿主背景透明。`BookshelfPage.ets:410–413` 的原生书籍 Sheet 唯一绘制底色并关闭宿主阴影，`ReaderBoundedSurface.ets:60–65` 不再重复绘制底板。这些证据排除对应路径，不能替代祖先链审计，也不据此盲改其它消息框。SDK 的 `ShadowOptions.radius/offsetX/offsetY` 单位为 px（`common.d.ts:7484–7606`），不是 vp。

实际执行：`node tools/evidence/search-surface-edge-20261024/probe.mjs`。初次探针准备因既有 `foundationSpecs()` 初始化无关完整按钮规格时缺少 `ReaderTextStyle` 构造器而失败，未产生产品检查通过结论。随后收窄为只从生产 `ReaderControlSpecs.ets` 提取并经 SDK 编译实际使用的 `readerSearchActionWidth/readerSearchControlHeight` 两个函数，不修改产品代码、SDK 或历史测试。修正后的同一入口退出码 0：

- 16 个组合：日/夜 × 初始/结果 × 收起/展开 × 手机/平板。
- SDK 实际 lowering `SearchPage.build/searchHeader`，继续实际执行 `ReaderPageScaffold → ReaderFixedHeaderHost → ReaderHeaderFrameModifier`。外层固定宿主背景为透明，卡片外 16/20vp 与底部 6vp 留白保持透明；背景、边框、13vp 圆角和裁剪属于唯一同一节点，该卡片不再发射外扩阴影。
- 实际 `onAreaChange → onHeightChange → onHeaderHeightChange → acceptSearchHeaderHeight` 回调接受当前原生高度，仍作为列表顶部避让；旧 window/key 回调和无效高度被拒绝。未更改测量或业务逻辑。
- 在内存中只恢复旧 `headerKind:'search'`，真实父层重新发射满宽 `TOK_PAPER`；同一断言拒绝该负例，证明检查覆盖祖先背板而非只检查内层卡片。

结果与四个相关生产文件 SHA256 保存在 `tools/evidence/search-surface-edge-20261024/result.json`。书籍列表、输入控件与筛选项的内部内容是明确的空槽边界；未验证其排版、网络业务或滚动行为。上述结果只证明实际 SDK 代码与属性发射，不模拟原生布局/像素，也不等于真机视觉或用户验收。该子任务未运行其它门禁、HAP 构建或设备操作。

## 配套构建准备

执行前发现另一任务持有共享 Core 构建租约，未打断或绕过。对现有 `target/harmony-napi/arm64-v8a/core-input-snapshot.json` 的只读 `build-input-snapshot.mjs verify` 返回 `Core build inputs changed`：其输入与本轮最终测试准备变更后的 Core 不匹配，因此不作为本次配套产物复用。待最终精准检查完成后从当前源码重建，不使用旧 SO 掩盖错配。

## 修复包复验

并行交付随后已从最终 Core 源码重建配套库并通过同一规范流水线生成开发包，本任务没有重复构建。完成以下实际复验后复用：

- `build-input-snapshot.mjs verify target/harmony-napi/arm64-v8a/core-input-snapshot.json` PASS；该快照SHA与新HAP的Core provenance一致。
- `hap-pipeline.mjs verify --manifest .../20261023T162151Z-6b1bd753-21f7c85e/manifest.json` PASS；真实ArkTS类型检查、无增量编译和签名均PASS，contracts none，全量NOT_RUN。
- 4个Host相关生产文件及2个Core修改文件逐文件SHA匹配产物快照；HAP内配套库身份一致。
- HAP run `20261023T162151Z-6b1bd753-21f7c85e`，signed SHA256 `d37f3ce53aa91b3438e0b24044a0b9cf38fc4640902f66a9e5a78e75b43cd415`。
- 签名为指定 `minliny_HarmonyOS` 证书，SHA256 `3a563778e5bf17cd3ead0218e13b4a5030de3f5d7d4e21e0336d8eb37b676dc4`，debug Profile；包名 `io.reader.minliny`。
- Harmony `6b1bd7534b61a8ebfac10150fd308eae8430606e` dirty；Core `9131ddcfeef1922620c6867f88fe82608e51a079` dirty；均main，保留既有WIP。

完整绑定记录：工作区 `.reader-artifacts/search-fixes-20261024/delivery-verification.json`。本任务本轮未进行真机安装、启动、截图或交互；未改变设备数据。原生像素与用户验收仍OPEN。简介的3个精准case均PASS，详见同目录问题记录。
