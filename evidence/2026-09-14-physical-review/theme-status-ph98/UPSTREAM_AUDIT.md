# PH98 上游窗口 API 只读审计

结论：API 共享 SystemBarProperty，但已检查的官方实现不支持“JS 两条队列并发导致颜色和 enable 必然互相覆盖”。显隐 API 在事件任务执行时才读取属性，颜色 API 在任务执行时根据 field flags 合并当前属性。两者均使用 napi_send_event 在同一 NAPI 环境调度；没有看到调用入队前冻结整份旧原生属性再无条件覆盖的路径。不能用模拟的无条件颜色重置替代上游事实。

固定源码：
- master: 3c2e3d4e8c0a7f3408732313d8267b53ec5b2d6b
- OpenHarmony-6.0-Release: 3d609461bd21e7f3ca13128dc8ffc7e91e02699a
- OpenHarmony-5.0.3-Release: 91dbd6777835fd293eb7a59899b8e0638262588e

master 证据：
- interfaces/kits/napi/window_runtime/window_napi/js_window.cpp:3988-4005 显隐只在 asyncTask 内获取当前 property，改 enable/animation，并携带 {true,false,false,isSetAnimation}；4015 napi_send_event。
- 同文件:4097-4110 颜色在 asyncTask 内调用 UpdateSystemBarProperties；4120 napi_send_event。
- wm/src/window_scene_session_impl.cpp:4136-4165 按 flags 读取并合并当前属性；4175-4191 使用 PartialSystemBarProperty 按 APPLICATION owner 更新。
- wm/src/window_impl.cpp:1105-1143 旧架构同样按 flags 合并当前属性。
- interfaces/kits/napi/window_runtime/window_napi/js_window_utils.cpp:1371-1398 接受 #RRGGBB 和 #AARRGGBB，6 位补 FF；1403-1429 显式 statusBarContentColor 优先；1478-1486 只有传入 animation 字段才更改该字段。

发布分支交叉检查：
- 6.0 js_window.cpp:3347-3361 显隐任务中现读现改；3435-3445 颜色任务；wm/src/window_scene_session_impl.cpp:3106-3136 按 flags 合并，3139-3163 页级 map 加锁且只修改标记字段。
- 5.0.3 js_window.cpp:2876-2888 显隐任务中现读现改；2961-2971 颜色任务；1009-1042 通用更新函数按 flags 合并当前属性。

默认动画：官方文档说明 enableAnimation 默认 false。5.0.3 为 false；master 省略第三参会沿用 property.enableAnimation_；6.0 Release:3358 的省略第三参分支读 property.enable_，与文档默认存在差异。但 ReaderWindowCoordinator:337/342/344/353/356/358 全部显式第三参 false，因此 Reader 不触发该分支。颜色 API 未设置 animation flag 时保留当前值。

文档边界：setSpecificSystemBarEnabled Promise 成功不代表系统栏已经实际显示/隐藏。非全屏/非最大化、自由窗口的有效性亦有约束。官方 OpenHarmony 源码不能证明当前商业 HarmonyOS/OEM 二进制的内部实现完全相同。

当前 repo 8 个主题的 #FF... ARGB 合法，无需颜色格式转换，也不要降为黑白图标 boolean。没有设备操作，没有修改工作区源码。
