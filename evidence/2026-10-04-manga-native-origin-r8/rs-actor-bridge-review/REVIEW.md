# ArkUI actor → RSNode 官方源码桥接研究

记录日期：2026-10-04。

结论：仅凭 Reader PID 与 UITest Image 的数字 ID，不能严格推导 RSNode ID。官方 `openharmony/arkui_ace_engine` master 存在显式对象关联和 dump 路径，但这不证明当前 VM 使用相同实现，也不证明任何帧已提交或显示。

## 范围与版本

- 本记录仅整理已完成的官方源码研究；未增加研究、测试或运行时取证。
- 来源均为官方 `openharmony/arkui_ace_engine` 的 `master` 文件。链接未固定提交 SHA，列出的行号为本次阅读时位置，分支后续可能变化。
- 当前 VM 的 OS 6.1 / API 23 是独立已有记录，不能据此推定其 ArkUI engine 等于本轮 master。当前 VM 是否保留以下字段、trace 或 dump 路径仍未验证。
- 没有执行 HDC、VM、runtime 工具、截图、源图片、缓存或数据库读取；没有修改产品、测试、旧冻结证据。

## 已证实的标识与关联

| 标识 | 本轮官方源码事实 | 路径、行号与链接 |
| --- | --- | --- |
| FrameNode/UINode ID | `GetId()` 返回 int32 `nodeId_`。 | `frameworks/core/components_ng/base/ui_node.h`，346–349；[官方文件](https://raw.githubusercontent.com/openharmony/arkui_ace_engine/master/frameworks/core/components_ng/base/ui_node.h) |
| Accessibility ID | `GetAccessibilityId()` 返回独立 int64 字段；构造函数从独立 atomic counter 分配，不能假定它等于 nodeId。 | `ui_node.h`，351–354；`frameworks/core/components_ng/base/ui_node.cpp`，57–62；[官方实现](https://raw.githubusercontent.com/openharmony/arkui_ace_engine/master/frameworks/core/components_ng/base/ui_node.cpp) |
| Developer inspector ID | 正常无障碍导出分别写入 `AccessibilityId`、`UniqueId=nodeId`、`InspectorKey`。InspectorKey 来自开发者设置的 inspector 字符串。 | `adapter/ohos/osal/js_accessibility_manager.cpp`，1960–1974；[官方导出](https://raw.githubusercontent.com/openharmony/arkui_ace_engine/master/adapter/ohos/osal/js_accessibility_manager.cpp) |
| Inspector `$ID` | Inspector JSON 中 `$ID` 使用 `parent->GetId()`，不能与开发者 inspector 字符串混同。 | `frameworks/core/components_ng/base/inspector.cpp`，31–34、378–380；[官方 inspector](https://raw.githubusercontent.com/openharmony/arkui_ace_engine/master/frameworks/core/components_ng/base/inspector.cpp) |
| RSNode ID | Rosen render context 的 `GetRSNode()` 返回关联对象；其 `GetNodeId()` 返回该 RSNode 的 `GetId()`，类型 uint64。 | `frameworks/core/components_ng/render/adapter/rosen_render_context.h`，176–184；[官方声明与实现](https://raw.githubusercontent.com/openharmony/arkui_ace_engine/master/frameworks/core/components_ng/render/adapter/rosen_render_context.h) |

无障碍导出的 ID 还可能被 `UpdateElementInfoTreeId()` 拼入 treeId，不能把导出的 accessibility 数值普遍视为原始 nodeId。依据：`js_accessibility_manager.cpp`，8629–8653，[官方实现](https://raw.githubusercontent.com/openharmony/arkui_ace_engine/master/adapter/ohos/osal/js_accessibility_manager.cpp)。本轮未检查 UITest 的 `id/hashcode` 序列化定义，未给这两个字段指定上述任一语义。

## 显式桥与 dump 路径

`RosenRenderContext::AddFrameNodeInfoToRsNode()` 将当前 host 的 FrameNode ID/tag 写入 RSNode 的 `SetFrameNodeInfo`。当 LayoutInspector node trace 启用时，同条 trace 包含 FrameNode ID 与 `rsNode_->GetId()`。这是源码中的显式关联；没有 PID 或 UITest ID 的算式。该文件也允许 `SetRSNode()` 替换关联对象，因此证据须属于当前 actor/lifecycle。依据：`frameworks/core/components_ng/render/adapter/rosen_render_context.cpp`，597–618、6526–6537，[官方实现](https://raw.githubusercontent.com/openharmony/arkui_ace_engine/master/frameworks/core/components_ng/render/adapter/rosen_render_context.cpp)。

完整 ArkUI dump 在同一个节点上提供以下链：

1. `UINode::DumpTree(..., hasJson=true, ...)` 写入 `ID`、`AccessibilityId`、`InstanceId`，再调用该节点的 `DumpInfo`。路径：`ui_node.cpp`，1328–1343；[官方源码](https://raw.githubusercontent.com/openharmony/arkui_ace_engine/master/frameworks/core/components_ng/base/ui_node.cpp)。
2. `FrameNode::DumpInfo(json)` 调用它的 render-context `DumpInfo(json)`。路径：`frameworks/core/components_ng/base/frame_node.cpp`，7965–7974；[官方源码](https://raw.githubusercontent.com/openharmony/arkui_ace_engine/master/frameworks/core/components_ng/base/frame_node.cpp)。
3. Rosen `BuildPositionInfo` 加入 `rsNode_->DumpNode(0)` 字符串；`DumpInfo(json)` 将其放入 `rsNode` 对象。文本 dump 也调用 `DumpNode(0)`。路径：`rosen_render_context.cpp`，6597–6601、8061–8064、8108–8143；[官方源码](https://raw.githubusercontent.com/openharmony/arkui_ace_engine/master/frameworks/core/components_ng/render/adapter/rosen_render_context.cpp)。

本轮未审查外部 RSNode `DumpNode` 实现，不声明其字符串在当前系统一定含有何种 ID 字段。也未证明这些 ArkUI dump 内容会出现在现有 UITest JSON 中。源码路径可作为候选桥，不能代替实际同 PID、同生命周期的关联记录。

## 可成立与仍未成立的证明

可成立：官方 master 存在 FrameNode 对象 → Rosen render context → RSNode 对象的关联，以及将节点 ID 与该关联同时记录的源码路径。

仍未成立：

- 当前 UITest Image `id/hashcode` 的确切语义及其到当前 FrameNode 的映射。
- 当前 VM 是否与上述 master 一致，以及对应字段/DFX 能否使用。
- 当前 Reader Image 与某个 RSNode 的实际同生命周期关联。
- 当前 RSNode 的 submitted frame、合成显示、源图片首像素或顶部颜色归属。

严格 actor 关联至少需要：确认实际 UITest 字段语义，再取得同进程、同窗口、同生命周期的 `accessibilityId → nodeId → 当前 RSNode GetId` 显式桥记录。不能用数字相同、PID/低位拼接、tag/位置相似或旧样本替代。

本记录到此结束；未提出或执行额外设备操作。
