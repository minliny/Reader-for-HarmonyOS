# 书源管理页尺寸异常（2026-11-01）

- 用户在验证 `20261101T065149Z-fce869a1-ae255483` 后确认原搜索分组导航“都正常了”，但书源管理页出现大量尺寸问题。当前包 signed SHA `67affab6191566584e784062302b7e4ca2b6385007d9ae0850135b0867826a06`，0.2.0/versionCode1000000，dirty输入由manifest绑定。
- 状态OPEN，尚未定位具体尺寸根因，不把搜索分组的旧图片当作当前SourceManagementPage证据。
- 先审页面与SourceRow、SearchField/Toggle/Badge、source按钮规格、More/Filter、PageGeometry/Scaffold的实际宽高、缩放和避让。此前已排除源码中明显的source route主动转groups、整屏footer固定拦截及重复safe-top；不因此认定原生整页布局通过。
- 未决问题为当前实际管理页中异常的控件、相对宽高与遮挡。已请求再允许当前页1张实屏，旧单张授权只覆盖搜索sheet且已用完；当前未获答复前不取图。不启动/点击/录屏/AX，不预设所有固定尺寸都该放大或统一更改字体。
- 第一轮静态结论：SourceFilter和More实测header高度未加公共Header外margin titleBottom，bodyLimit也漏减BoundedSurface.contentBottom；两者在可用窗高分支命中时可能多放32vp。底栏manage走ReaderButton字号高度增长，add走LabeledIcon固定44命中框；SourceManagement搜索框固定44/42，导入按钮固定40，行内检测/登录固定宽44，而相关文字系统缩放，契约不一致。
- 主列表sourceRow只有minHeight76、没有百分比高度子项，不能复用搜索GroupRow此前根因；窄屏/scale>1主动把actions放第二行是当前结构决策，尚不能在无图时当作异常。当前未发现必然双safeTop或List/row frame简单双扣，不对未证项先改。
- 用户选择“先只从代码核对”：本轮只读审计，不修改生产/测试源码、不构建/安装/设备采集。后续需用当前生产方法量化尺寸，确认事实与风险后给逐项结论，不将代码核对写成新实屏或原生像素验证。
- 精度纠正：当前SourceFilterPanel已使用公共ReaderFilterTrigger，其宽高固定44，并不会随字号增长；先前初审提到trigger高度增长不符合现代码，不能采用。实际搜索行差异是field44/filter44/add40（add响应区44），视觉框与响应框应分别记录。

## 只读量化结果

### 已确认的尺寸契约不一致

1. **底栏两个同排动作不等高缩放。** `ReaderButton.ets:71`按真实resolver给批量管理增加行框高度；`ReaderLabeledIconAction.ets:83`给新增书源固定44。当前规格两者字角色均13fp，1倍框高同为44，1.6倍时分别56/44vp。无需实屏即可确认框高策略不一致，尚不能据此断言当前设备发生裁切。
2. **筛选/更多最大高度预算漏项。** `ReaderSourceFilterPanel.ets:113`与`SourceManagementMoreMenu.ets:123`实测header直接作为完整占高，漏外margin titleBottom12；同时没有扣除BoundedSurface.contentBottom20。测量前最多漏20，测量后最多漏32。实际是否溢出仍取决于min分支及内容是否填满上限。

### 真实生产普通方法算例

仅在私有副本调用生产方法，无仓内case/门禁、无源码/设备变更。输入safeTop24、interactiveBottom24，footer事实72，header未测0/已测frame44；字号1/1.6，当前compact header两档frame均44。不是手机测量。

|窗口（vp）|Source body测前→测后|Source预算结果|More最大预算结果|
|---|---:|---|---|
|366×844|540.16→540.16|命中64%cap，仍余107.84；没有由该算例证明溢出|多20→32，仅长内容填满上限才显现|
|844×366|190→202|可用窗高分支，总上限多20→32|同样多20→32|
|240×360|184→196|可用窗高分支，总上限多20→32|同样多20→32|
|240×844|540.16→540.16|高度结论同竖屏；窄宽不直接令该函数溢出|同上述最大预算漏项|

原始脚本/日志/JSON及10个当前源码文件内容指纹在本聊天私有 `filter-sheet-implementation/source-management-layout-audit-20261101/`。普通方法探针exit0不等于native布局PASS。

### 需统一目标或原生观察的风险

- 检测/登录固定宽44，1倍框高28、1.6倍框高38；字形及“检测中”等较长文案的横向容纳没有同步宽度预算。文字未在source-management家族显式按同一fontScale钳制；不能将fp字号直接当成实际字形高度，当前只能记溢出/裁切风险。
- 搜索field/input/icon固定44/42/13，筛选固定44；导入视觉框40、响应框44。该差别是现行规格，不是已证的新增缩放回归。Source输入是12fp系统策略，但native输入实际缩放和字形容纳尚未观察。
- `SourceManagementPage.ets:564`在内容宽<400或**任何systemFontScale>1**时，整组行操作移到下一行。因此即使宽窗足够，1.00→1.01也会触发结构突变；这是确定的当前分支策略，是否不符合目标需明确。主列表本身只有minHeight76，无之前那类百分比高度装饰。
- 当前源标题13fp、URL/分类/统计10fp、行内操作11fp，是现行紧凑配方；统一放大属于规格调整，不把这些数值本身报成已证程序错误。

## 对应修复边界（尚未实施）

- 底栏统一使用同一行框增长规则和受控文字缩放；保持两按钮现有语义/颜色。
- 两弹层按header frame+titleBottom+contentBottom+footer做完整预算，保持64%cap，并以短窗/测量前后守恒验证。
- 行内按钮按实际标签与字号保留横向容量；搜索输入以同一字体策略推导内部/外框最小高度。只调对应Source规格，不向其它按钮家族扩散。
- 行操作是否换行应依据剩余宽度/实际动作容量，避免用任意scale>1作为唯一理由；基础字体大小如需改动另列角色范围。

本轮仅代码核对，没有生产/测试源码修改、没有构建/安装或新取屏。源码结论与设备视觉结论分别保留；当前页面的全部尺寸问题仍OPEN。
