# R6 独立静止像素审查

日期：2026-10-03。审查者：`sheet_motion_reaudit`。

本报告只审查已经保存的 R6 原生 JPEG 与同名 UI 树。没有操作 HDC、占用 VM、修改产品或测试、重采样、插帧、重绘原图。预览裁剪仅在 `/private/tmp` 生成，保持原像素尺度，不修改这里的原始证据。

根任务提供的部署关联信息为 run `20261003T132254Z-568ec4e3-d6c1d5d4`、signed HAP SHA-256 `0c57c7221e3a7612bf764c471655d120f3d37fe63e7f003c8a93a7b5d837bff7`。本报告没有独立执行产物或安装验证，不能代替部署记录、主线验收或用户验收。

## 静止样本结论

全部原图为 1280 × 2832。判断同时使用全图与原尺度顶部、底部中心裁剪；UI 树只用于核对控件身份及边界，不能以系统横条没有文字节点推断它不可见。

| 样本 | 原图观察 | UI 树及边界交叉核对 | 本次结论 |
| --- | --- | --- | --- |
| `directory-settled.jpeg/json` | 顶部时间 09:43、信号及电池图标可见；底部纸色系统带上有淡灰短横条；目录圆角和内部内容可见 | Status `WindowScene` 的 `hostWindowId=21`，范围 `[0,0][1280,136]`；底部横条位于根任务记录的 GestureNav 窗口 `[0,2734,1280,98]` 内 | 这张静止目录样本的两端系统栏显示成立 |
| `controls-settled.jpeg/json` | 顶部时间 09:44、信号及电池图标可见；底部淡灰短横条可见；阅读控制卡与漫画画面共同显示，页码为 5 / 32 | UI 树顶卡 `Row [56,171][1224,353]`、底卡 `Column [56,2229][1224,2693]`；原图对应卡片的外形位置基本吻合，边缘受圆角、阴影和 JPEG 压缩影响，不宣称每个像素严格相等 | 这张静止控制栏样本的两端系统栏显示及主要控件位置成立 |
| `hidden-settled.jpeg/json` | 顶部没有时间、信号、电池图标；底部中心是漫画内容，没有可辨识短横条；常驻页码仍为 5 / 32 | UI 树没有 Status `WindowScene`，页码 Text 为 `[1069,2711][1238,2790]`；图片顶部仍有纸色背景区域，不能把图标隐藏等同于所有系统背景带几何均消失 | 这张静止沉浸样本的状态图标和导航横条隐藏成立 |
| `returned.jpeg/json` | 退出后书架显示时间 09:46、信号、电池图标及底部淡灰短横条；继续阅读卡显示 `05 · 5 页 / 32 页` | Status `WindowScene [0,0][1280,136]`；继续阅读 Text `[322,702][938,755]` 为 `05 · 5 页 / 32 页`，书架漫画条目亦显示 `05 · 第 5 页 / 32 页` | 这張静止返回样本显示 App 两端系统栏恢复，书架可见的章节/页码状态保留；不据此替代持久化或冷启动验证 |

`directory-settled` 与 `controls-settled` 的底部原尺度像素均能识别同一圆端横条。以背景中心像素与暗 10–40 的三通道容差进行辅助扫描，横条可辨识范围为 **x444–835、y2794–2811**；这是 JPEG 样本的辅助范围，不是原生控件精确布局 API 的结果。背景中心约 `(248,244,235)`，横条内部约 `(229,226,219)`。返回样本也经原尺度裁剪直接看到该短横条。

## 保留早期即时样本的边界

早期 `controls.jpeg/json` 的原图未能辨识底部横条；原图中的顶卡、底卡位置与同名 UI 树边界也有差异。它不是同步合成帧和 UI 树的保证，不能由一对按顺序抓取的即时样本直接推断稳定页面的布局错误或导航栏永久缺失。

早期样本及其哈希保持不变。后续 settled 原图实际出现横条，主要控制卡边界与树基本吻合，因此本报告不把早期未见线登记为已确认产品 FAIL，也不抹去此前采样结果。`immersive.jpeg` 与 `hidden-settled.jpeg` 内容 SHA 相同，说明这两张保存图片的内容相同；不由哈希推断动态过程或采样原子性。

## 只读源码 / SDK 校准

临时交付树的 `entry/src/main/ets/app/ReaderWindowCoordinator.ts:374–381` 已分别调用 `setSpecificSystemBarEnabled` 控制 `status`、`navigation`、`navigationIndicator`；`:393–398` 的 App 恢复也分别启用三者。`:618–622` 已写 `navigationBarColor` 和 `navigationBarContentColor`。

本机 SDK `/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/api/@ohos.window.d.ts` 的 `SpecificSystemBar`（3404）包含 `navigationIndicator`，`setSpecificSystemBarEnabled`（4707）支持显隐及动画参数。`SystemBarProperties` 的 `navigationBarColor`、`isNavigationBarLightIcon`、`navigationBarContentColor` 分别在 568、592、607；该接口没有单独的 indicator 颜色字段。现在没有证据把未设置 `isNavigationBarLightIcon` 当作横条缺失根因；也不能把原图中淡灰色的最终横条像素归因于某一原生映射机制。

`MangaReadingSurface.ets:1223–1224` 仍通过 `readerInteractiveSafeInsets(metrics)` 消费实际 system/cutout/gesture/navigation 避让事实。Coordinator 已保存受精确窗口几何/方向限制的 `statusBarRect`。当前 settled 样本没有证明需要另加 retained 顶部 inset，无条件添加可能使隐藏态持续保留或重复增加顶部空间，因此本报告不建议基于早期即时样本变更几何。

## 未证明范围

- 系统栏显隐与控制栏弹出的逐帧精确同步、完成时长及原生动画曲线；这里的静止样本不提供这些证据。
- 原生导航横条颜色如何映射到 SceneBoard 最终合成像素，及不同背景偏好的所有实际颜色分支。
- 横屏、其他 VM 配置、真实设备、切后台或快速重复操作的系统栏行为。
- App 退出恢复的完整窗口属性集合、主线合入、全量漫画页面验收及用户满意度。

当前结论只限于上述 R6 静止场景：控制栏/目录状态显示两端系统栏，沉浸态隐藏图标及导航横条，返回书架恢复显示。

## 原始文件 SHA-256

| 文件 | SHA-256 |
| --- | --- |
| `immersive.jpeg` | `2887d62ba3127a5be87829694d6226058b79893c6292ed05acf052877606bb84` |
| `immersive.json` | `da206b3d469ed28273d6ada933ef5a39476445b388b1a403e36165d9accec1a5` |
| `controls.jpeg` | `9f5eef25cd686990af19d4ee52de0903927fc178559bc30d1002c12e34660a7a` |
| `controls.json` | `5174092978209983ca7e82dc914b78e35108232f2c447221990d7fbd5d227072` |
| `directory-settled.jpeg` | `1ddb1490c878787447f70ca69dea1b10dea05974583db1b9e98e3870dd9e875e` |
| `directory-settled.json` | `1f4556b99a0eb694aedf86fe50240d54b99f2baa9c8fab0e0e965d76a0298969` |
| `controls-settled.jpeg` | `b2b3dcc5d4aaba71105bf58b0cc6cb029a790c55e14eab58c1b7d0bcad64f61e` |
| `controls-settled.json` | `96db27963f06ce51dd5d2d6320f7a7974fe32b16b238d087b22eb0e72c25711d` |
| `hidden-settled.jpeg` | `2887d62ba3127a5be87829694d6226058b79893c6292ed05acf052877606bb84` |
| `hidden-settled.json` | `c804016af649754d176ef412ec880aa0ccca81a626ec2f0c0bb333435d9e0344` |
| `returned.jpeg` | `b67f7f2409a979201da0a8c16d5565eaf0a867311f9cbcb8fbe5b2b993025072` |
| `returned.json` | `bda359b1334829fca76dd5378db72fba4d11b8a97404de28a49e30e5e315441c` |
