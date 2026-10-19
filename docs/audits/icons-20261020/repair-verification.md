# 图标修复的有限本地验证（2026-10-20）

结果：**16 个点名用例通过**。只验证本次改动涉及的三个组件，以及它们已有的真实书架面板单次分发保护。没有运行现成回归套件、全量门禁、构建或设备操作，也没有为兼容旧 fixture 修改生产源码。

## 执行前选择及依据

唯一入口：

```sh
node --experimental-strip-types .reader-artifacts/icon-repair-20261020/selected-components.mjs
```

| 本次选项 | 实际执行及嵌套 | 具体风险及不可省略依据 |
| --- | --- | --- |
| 动作菜单/面板 | `ReaderActionMenuSurface` 真实 SDK Builder 输出；day/night 的 menu、sheet 分支各一次；额外只选 `ReaderSheetActionList` 的实际字段与 `dispatch/dispatchToken` 等方法联测 | 本轮移除 ColorFilter 并更换动作图，需防资源被重新染色、disabled/retired 回调越过准入、同一面板一次点击被重复提交。编译无法证明这些运行时分支。 |
| 公共图标按钮 | `ReaderIconButton` 真实 SDK Builder 输出及实际 `ReaderPressFeedback` 对象；day 覆盖 night、night 覆盖 day、auto 跟随 night | 本轮加入显式主题、禁用视觉与触区声明，需防纸面阅读主题被应用主题覆盖，以及禁用/无标签/退场按钮仍调用业务。 |
| 书源加载图标 | `SourceSwitchSpinner` 真实 SDK Builder 输出、真实属性更新；active/foreground/reduceMotion 的八种组合及每种退场后的回放 | 本轮转用原生 LoadingProgress，需确认后台、reduceMotion、非 active、退场分支均停止原生动画请求，静态编译无法证明。 |

以上范围先读取辅助探针的实际调用和导入路径，再由根任务确认执行；没有将其他失败或历史默认套件追加进来。

## 探针实际边界

- `createReaderBuilderProbe` 复用本机官方 ETS 的 parse、`processComponentClass` 与 observer closure 输出。它解析所选组件的实际成员，不重写生产 Image API。
- `createArkUIPropertyRuntimeProbe` 从安装的 `libace_compatible` 读取真实 V1 属性/proxy 类，记录属性依赖并有限回放；订阅分发、原生属性调用是记录边界。
- `pureModuleProbe` 只执行本次需要的有限 surface spec、动作 DTO 与图标资源 factory；`compileIconButtonSpecs` 使用实际 icon spec；`productionReaderPressFeedback` 使用实际按压修饰器源码。
- Builder helper 的静态依赖及默认 globals 会读取有限 typography、surface/window policy 等模块；本次组件没有 page/message/switch 子组件调用，因此没有触发那些可选 UI 构造分支，没有套件发现、子进程或构建调用。
- `ImageFit.Contain` 作为平台枚举 seam 注入；真实 `.objectFit(...)` 仍进入 SDK 输出并被记录，没有删除生产 API 来绕过探针。
- 公共菜单本身不承诺整个呈现期只允许提交一次。书架 action sheet 的 once 归属仍在 `ReaderSheetActionList.dispatch`；联测实际调用该方法，没有在测试中替它复制 once 算法。

## 结果

| 范围 | 用例数 | 结果 |
| --- | ---: | --- |
| menu day/night：资源身份、Contain、无滤镜、禁用/退场不分发 | 2 | PASS |
| sheet day/night：预着色资源、危险底角色、无滤镜、禁用/退场不分发 | 2 | PASS |
| 实际书架 dispatch：重复点击仅一次，旧/非 current/退场回调不提交 | 1 | PASS |
| IconButton 主题覆盖、44 vp 属性声明、禁用透明度、空标签/退场准入 | 3 | PASS |
| Spinner 八种组合、26 vp 参数传递、主题色、隐藏与无点击命中、退场停止 | 8 | PASS |

最后一次入口执行约 1.73 秒。原始结果时间 `2026-10-19T16:35:55.123Z`，即北京时间 2026-10-20 00:35:55。

第一次尝试状态为 **FAIL（探针记录读取错误）**：前五项已执行，随后验证脚本错误地从 node 本体取 `attributeModifier`，而既有 helper 将修饰器记录在 `attributeCalls`。仅修正忽略目录脚本的读取位置，保留该次日志；第二次同一范围全部通过。未修改生产源码、公共 helper 或旧 fixture 来换取通过。

证据：

- [唯一执行脚本](../../../.reader-artifacts/icon-repair-20261020/selected-components.mjs)
- [最终日志](../../../.reader-artifacts/icon-repair-20261020/selected-components.log)
- [逐项回执与选中源码 SHA-256](../../../.reader-artifacts/icon-repair-20261020/selected-components-result.json)
- [第一次失败日志](../../../.reader-artifacts/icon-repair-20261020/selected-components-attempt1.log)

## 没有由本次验证证明的事项

未执行的套件、构建、签名、安装和设备交互均为 `NOT_RUN`。原生像素抗锯齿、滤镜移除后的截图质量、帧耗时、真实点击命中、父容器外 responseRegion、屏幕阅读器和系统动画调度仍是原生证据边界；它们不能由上述 PASS 推导通过。

这是一份本次修复的有限验证记录及忽略目录探针，不新增自动门禁或默认执行入口。
