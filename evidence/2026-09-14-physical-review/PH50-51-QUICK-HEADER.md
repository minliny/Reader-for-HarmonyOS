# PH50/51 快捷搜索与自动翻页顶部审计

初始当前源码9a8ef9a1；已安装仍643bcaf5。仅使用当前源码、归档Figma设计/动效和既有VM画面，未操作设备。

## PH50 搜索边线与按钮

归档`tools/fixtures/reader-control-search-settings-live-20260905.json`中`searchSheetDesign`：Query1938:5088有1vp底线，Full高度51；输入1939:346、搜索按钮1939:365是8vp圆角soft表面，没有独立stroke。当前Builder按此遗漏独立描边，并将不可搜索状态的整个按钮透明度降为0.4，表面轮廓一起变淡。用户本次明确要求可见外轮廓，因此在现有角色上补TOK_LINE描边，并只淡化禁用图标。

当前几何Quick输入y12.993、高24，底线却在80.443，相距43.45vp。原因是字段沿自己的Figma轨迹上移，而底线及Results裁切容器保留Full静态局部坐标。首条结果原先全局y42.993，但父裁切从81.443开始，首条54vp只剩15.55vp可见。此前测试甚至断言这一裁切为正确，故仅旧合同PASS不能证明实际布局正确。

修复：Query底线跟随输入底部，Quick下方5vp、Full9vp；Results紧接底线，子行补偿容器位移，保持已有Figma各行屏幕轨迹、字号、宽度和行距。Full仍为原(2,53,334,612)，Quick首条从容器原点完整展示，不再有38.45vp空带。输入和按钮均为原8vp圆角、TOK_LINE边线；禁用时边线和表面不淡化，图标仍0.4且点击不执行搜索。现有滚动锚点、尾部5vp、原生惯性补偿不另起状态机。

## PH51 自动翻页顶部

归档`capsule-figma-live.json`的Quick Header `I1308:3237;736:3`为264×24，只含返回按钮。用户此前已明确移除快捷自动翻页的返回按钮。当前`normalContent`将整个Quick header移走，却保留播放框上方40vp的起点；Full内部标题又是opacity=p，因此Quick上方没有任何可见栏位。既有b17f29a4的`implementation-vm-followup-20260913/reader-control-b17f29a4-20260913-auto-quick.png`也能看到此空槽，但不是本次643的验收画面。

按用户此次补齐顶部栏位及此前无返回要求：在原24vp槽位恢复“自动翻页”及真实未开始/运行中/已暂停状态，采用已有应用主题正文/次要色，字号11/10fp。保持播放框y40、速度区和Full内部标题轨迹不变。Quick顶部随已有p淡出，完整页仍由Stage标题承担，不新增时钟。普通内容与播放胶囊启动源投影都渲染同一顶部Builder，避免启动切换时少一行。

## 本地证据

`test-reader-quick-search-auto-header.mjs`实际SDK Builder检查日夜、三种宽度、正反向p、输入/按钮边线、禁用点击、运行状态变化及Quick/源投影顶部Builder。`test-reader-control-search-settings-content.mjs`更新已错误固化的Query裁切断言，同时继续校验原始Figma屏幕轨迹、原生滚动视窗/锚点/尾部及5个破坏性变体。`test-reader-control-playback-content.mjs`原轨迹/测量身份/常驻树检查PASS。

SDK发出的属性不是原生字形或设备像素验收。本次完整编译/签名由root冻结后统一执行；新包设备视觉和用户验收保持OPEN，不拿旧图作新版本验证。
