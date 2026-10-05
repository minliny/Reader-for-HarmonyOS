# R6 漫画系统栏显隐与位置

用户要求：状态栏与底部手势横条仅在唤起控制栏时显示，沉浸阅读态隐藏。

基线：R5 run 20261003T123734Z-568ec4e3-52338352；签名 HAP SHA256 f00ebc4a15240832ee5decf39f660cf30eafcf7454759c85875dd94af4f74719；VM 127.0.0.1:5555。R5 证据保持不变。

代码定位：MangaReadingSurface.toggleControls 仅更新 controlsVisible，未请求系统窗口策略；ReaderShell 漫画分支未传 active、overlay 与身份门禁。ReaderWindowCoordinator 已实现 status、navigation、navigationIndicator 三项显隐及串行 revision，无需另建管理器。

范围：只补漫画窗口归属与实际控制栏显示状态映射，复用现有 coordinator；同步纸色/深墨前景。退出、失活恢复 App，旧身份不能覆盖新章节。错误、重试、登录与内置面板采用实际 UI 呈现条件。

未决：真实系统栏像素、首次 reveal 几何、阅读锚点；SDK 生产方法和响应式回归先行，随后仅 VM 做 hide/show/面板/退出取证。不使用真机、不清数据、不改变书源或阅读偏好。

验收分账：代码定位已完成；修复、SDK、签名包、VM、用户验收待记录。源码候选为 /private/tmp/reader-manga-sheet-ui-delivery-20261003-1913；持久候选为 /Users/minliny/Documents/Reader/.reader-isolated/manga-ui-20261002。

## VM 首轮观察追加

R6已通过canonical安装/启动，dataPolicy preserve。immersive和controls两原图1280x2832显示：前者无顶部时钟，后者有；当前05/5of32保持。controls原图底部暂未辨认到系统手势横条，UI树仅status WindowScene21，不能把navigationIndicator像素计为PASS。代码已复用全三项specific API并SDK证明请求true/false；剩余问题需最小VM只读窗口/日志确认是否平台未创建navigationIndicator或native请求失败，不做假横条、不改系统导航设置。

## VM 静止采样与退出恢复结论

后续只读 WindowManager stdout 明确存在 SCBGestureNavBar16/window19，rect[0,2734,1280,98]；无平台未创建指示条的证据。目录和控制栏静止原图均出现系统纸色带及淡灰短横条，原图约 x444..835、y2794..2811。静止控栏 top y171..353、bottom y2229..2693 与 UI 树基本吻合。早期即时截图与稍后 UI 树失配保留为采样边界，不能定为产品失败或精确动态时序通过。

hidden-settled 原图与树确认两系统栏隐藏；returned 原图与树确认书架两系统栏恢复，继续阅读仍05·5/32。当前静止显隐/位置通过，完整像素锚点及首次帧/精确时序仍开放。两次 UI lease 均已释放，应用数据保留。具体版本、原图、哈希、回执和验收边界见 RESULT.md、VM_RECORD.json。

额外探针失败亦保留：带引号的 WindowManager/redirection 输出为空，不是有效 dump；hilog -x 与 -z 同用被平台拒绝 CODE -31。改为直接 WindowManager stdout 及 hilog -z 100 -T Reader 后取得有效观察与日志，未发现该有界 Reader 日志中的 Manga system bars 警告。未改 OS 设置、未操作真机。
