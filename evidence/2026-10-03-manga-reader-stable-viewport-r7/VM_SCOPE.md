# R7 VM 图片视口最小验证

源码已定位并修复：整根安全区padding、显隐引起viewport resize/restore、漫画不透明原生背景及Shell overlay status underlay。独立源码审查、实际SDK生产Builder/State/Coordinator回归已通过；SDK提供的Area/Scroller是受控端口，无法证明目标ArkUI layout-safe实际约束与合成像素，剩余只用已授权VM最小验证。

先以canonical manifest verify/inspect及保数据install绑定新R7包，再取得独占HDC目标lease。已只读重新发现Mate 80 Pro实例路径、进程/trace，与其GuestOS Boot Completed日志一致；HDC唯一目标127.0.0.1:5555，bootevent.boot.completed=true，SceneBoard PID15675。安装前再检查lease和目标状态；若其他agent占用则等待，不启动/重置VM。

最小场景：打开已有漫画继续阅读位置；静止原图和UI树采样 immersive-A；轻点中心唤起controls-B后静止采样；打开目录-C采样，不选择条目、不滚动；关闭-C并收起controls，采样immersive-D；确认A/B无遮挡中心图像、A/D全图漫画区域和Image bounds一致，Canvas/Scroll区域覆盖整个窗口。退出回书架验证原生两系统栏恢复，记录仍同章节页码。必要时第一个R7在当前geometry证据失败先回源码，不反复设备试错。

不换源、换章、导入、设置、缩放或旋转；不测试真机、不卸载/清数据。目录动画精确曲线/时长仍另行验收。本项不以页码一致代替图片像素位置一致，也不以SDK同actor代替目标原生bounds。

像素比较：原JPEG相同尺寸，无遮挡中间区域直接同坐标比较并用纹理点局部交叉校验；保存原图和UI树、时间/文件SHA。JPEG容差不能隐去真实位移，若仅页码一致或原图被控栏遮挡则保持对应结论OPEN。系统图标由原像素核验，不依赖导航横条的文字树节点。
