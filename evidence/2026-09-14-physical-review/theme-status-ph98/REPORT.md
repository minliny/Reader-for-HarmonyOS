# PH98 状态栏主题颜色排查与修复

用户反馈个别主题下控制栏对应状态栏颜色错误。尚未取得主题名称、背景/文字图标的具体范围，以及现场包身份。当前审计基线 Harmony `0905782c`；上轮 `20260915T132601Z-1b2e6136-a0d4b317` 仅构建未安装，不能当成本次现场包。本次未操作真机/VM。

## 当前源码事实

- 8 主题的 `statusBackground/paperStart/paperEnd` 全部一致，`statusForeground/ink` 一致，ARGB 均不透明。LRE 状态栏背景带、系统窗口请求都取当前 activeTheme。未发现某主题配置错色或直接走应用色的分支。
- 控制栏主体按应用主题，阅读状态栏按阅读主题；不修改主题原色、日夜分类或联动规则。
- `paper` 和 `paperNight` 正文有纸纹、状态栏背景带为纯色，存在纹理差异；未证明是用户所指，不改变既定纹理设计。

## 已复现的窗口更新缺陷

`ReaderWindowCoordinator.flushChrome` 原先用外层 catch 结束整个队列：旧颜色请求失败时，期间排队的新主题一起被遗留；旧 Window 回执返回后直接 return，也会丢掉重建窗口已排队的主题。原测试在生产 Coordinator 中分别失败：新主题仍停留应用默认色，新窗口没有收到颜色写入。此处使用可控 Window Promise 失败/延迟，证明 Reader 状态机缺陷，不冒称获取了本次手机原生失败。

修复逐次处理原生失败，仅当已有更新请求时继续；没有新请求的失败保持待重试，避免自动失败循环。旧窗口/旧安装周期回执不能标记新窗口完成。

另复现：最新主题写入失败后，状态栏本来就可见时，打开控制栏因窗口策略去重而不再尝试颜色，且几何不变无其他事件触发恢复。现可见状态栏策略入口重试待应用颜色；已成功的颜色仍不重复写，显隐策略仍去重。

## 已排除的推测

官方 OpenHarmony 三个固定版本均在事件任务执行时读取/按字段合并系统栏属性，没有证据支持“显隐和颜色两 API 并发必然互相覆盖”。因此未合并两队列，也未用虚构的原生显隐重置色模拟证明缺陷。[上游审计](UPSTREAM_AUDIT.md)及[抓取源码哈希](upstream-source-hashes.json)。原完整只读源码留在 `/tmp/reader-status-upstream`，以下固定上游链接可独立核对：

- [NAPI 入口，master 固定提交](https://github.com/openharmony/window_window_manager/blob/3c2e3d4e8c0a7f3408732313d8267b53ec5b2d6b/interfaces/kits/napi/window_runtime/window_napi/js_window.cpp#L3988)
- [SceneBoard 字段合并](https://github.com/openharmony/window_window_manager/blob/3c2e3d4e8c0a7f3408732313d8267b53ec5b2d6b/wm/src/window_scene_session_impl.cpp#L4136)
- [ARGB 与前景色解析](https://github.com/openharmony/window_window_manager/blob/3c2e3d4e8c0a7f3408732313d8267b53ec5b2d6b/interfaces/kits/napi/window_runtime/window_napi/js_window_utils.cpp#L1371)

上游源码不等同当前商业 HarmonyOS/OEM 二进制实证。

## 本地回归与剩余验证

新增 `test-reader-window-chrome-order.mjs` 直接编译完整生产 Coordinator，使用实际 LRE 颜色请求方法与8主题注册表。6场景通过：全主题显隐/同日夜及跨日夜切换；旧请求失败后新主题；旧窗口成功/失败晚到；最新失败不自循环及前台重试；可见策略不变时控制栏恢复。既有窗口去重、窗口颜色、阅读设置回归通过。旧测试只对 stub 核对参数，未覆盖这些队列失败路径。

修复的是已确定的丢请求/漏恢复缺陷。原反馈的具体主题及实际偏色仍 OPEN；不能以受控异常回归关闭用户现场，也不能把缺少主题名称记成新的产品待决事项。若具体主题可在代码侧进一步复现则继续先修代码；只有剩余问题无法代码定位且有设备授权，才安排最小原生取证。
