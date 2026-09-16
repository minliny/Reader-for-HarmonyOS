# PH103：跟随高亮开关深色关闭态

用户反馈及起始版本见上级 FEEDBACK.md。代码基线 `8d33df17`。

## 定位及修复

当前 `ReaderControlPanel` 普通内容和播放投影均挂载 `ReaderControlAutoPageContent`，旧 `ReaderAutoPageFullPanel` 未被实例化。本次修复当前生产入口。

`followHighlightRow` 给共享开关传入面板软表面作为关闭轨道色；深色时轨道 `#A32C2824`、滑块 `#BD2C2824` 的 RGB 相同，外层行背景 `#FA2A2622` 也极其接近。SDK 编译后的实际 Builder 显示停止状态下行 enabled=true、opacity=1，代码没有把关闭状态隐藏；缺陷在颜色搭配。

现在深色关闭态不覆盖共享开关的默认轨道，使用主题库已有的 `#FF5C6065`；日间软表面、开启态、圆角尺寸、滑块位置及点击命令不变。没有增加新调色算法或第二套主题。共享组件继续通过 StorageLink 接收应用日夜类型。

## 本地证据及边界

- `before.log` / `after.log`：实际 SDK 编译父 Builder 与共享开关 build，单次挂载后日间→夜间→日间、关闭/开启颜色输出。只有夜间关闭轨道改变；子组件身份、点击返回值和滑块位置保留。运行中仍不允许修改，行自身 opacity=1。
- `playback.log`：既有播放内容、几何、滚动交接、Builder 与 SDK 解析检查通过。
- `theme-controls.log`：既有日夜控件回归通过。
- 这是组件属性输出和代码检查，未模拟原生混色、依赖调度或屏幕像素。本次未构建、安装或操作设备，实际设备视觉及用户验收尚未完成；不能将上一包的 277 组检查归到本次修改后。

## 后续交付

用户随后要求安装真机。20260916T003557Z-b37f745a-f7e147cb 已完成 277 组检查、ArkTS、签名与 manifest 复验，2026-09-16 08:36:48 北京时间保数据安装并启动当前 USB 真机 PASS。没有设备交互测试，详见[安装记录](delivery/INSTALLATION.md)。
