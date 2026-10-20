# Phase 2 Dialog schema34 repair

日期：2026-10-02

## 修复原因

此前的 Phase 2 Dialog 候选携带只支持 SQLite schema 28 的 Core，而保数据 VM 的现有数据库为 schema 34。HAP 可以构建并安装，但 Core 在打开现有数据库时拒绝迁移，书架和书源页面只能显示加载失败；这使删除确认和编辑分组没有真实数据入口可验证。这个问题是 Core/Host 产物配对错误，不是 Dialog UI 的业务回调问题。

## 修复内容

- Core 使用包含 v29–v34 迁移的 schema34 分支：`fix/schema34-phase2-dialog-pairing-20261002`。
- Core 将工作区绑定到本分支的 Dialog Host 基线 `0b5343a5329cc354650afd7a92ef22bb8b88eed0` 和 Reader-UI 合同 `7814dad6f09099d03bca98a7f357119bb63617b7`。
- Core 配对提交为 `03edb0da`、`488ec701`、`73f5713b`；最终 build identity 的 Core commit 为 `73f5713bff3c0ea6dcccaebc4b7ff05a2f6e9b44`，worktree clean。
- Host 分支 `fix/phase2-dialog-schema34-20261002` 重新同步完整 Core Harmony package、SDK 和 arm64 NAPI，未改动 Dialog 业务逻辑或当前 UI 基线。
- 使用当前授权的 `minliny_HarmonyOS` debug profile 和 `io.reader.minliny` 身份构建；不卸载、不清空、不改写 VM 数据。

## 已验证

### 源码和产物

- Dialog、Core source、ArkTS、HAP 和签名门禁通过。
- schema34 Core Native/SDK smoke 通过。
- 最终 HAP 必须使用本文件记录的 clean Host commit 重新构建；产物以对应 manifest 和部署回执为准。

### VM 保数据交互

目标：`127.0.0.1:5555`，target ref `6460677a198b`。

证据目录：`/Users/minliny/Documents/Reader/evidence/2026-10-02-phase2-dialog-schema34-vm/`

- 初始书架加载出已有书籍，未出现 schema 28 拒绝或空的 Core 加载失败态：`initial.json`。
- 书架真实更多操作 Sheet 打开：`action3.json`、`action3.png`。
- “编辑分组”共享 Dialog 打开，并点击遮罩关闭，未保存变更：`group-dialog2.json`、`group-dialog2.png`、`group-closed2.json`。
- “移除书架”确认 Dialog 打开；点击“取消”后原书仍存在：`remove-dialog.json`、`remove-dialog.png`、`remove-closed.json`。
- 书源管理显示 `919 个书源 · 137 个启用`；JSON 导入 Dialog 输入 `https://example.com/not-json` 后返回真实错误 `HTTP 404`，关闭后回到书源管理且计数不变：`json-invalid3.json`、`json-closed.json`。

## 证据边界

本修复关闭了 schema 兼容、HAP 构建/签名、保数据安装和上述真实交互验证。截图只证明当前运行效果和入口状态，不等同于设计稿验收；未点击“移除”或“默认”选项，因此用户数据未被有意改变。用户最终视觉和产品验收仍单独记录。
