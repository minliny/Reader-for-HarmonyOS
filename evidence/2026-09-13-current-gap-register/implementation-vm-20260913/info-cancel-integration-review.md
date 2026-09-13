# 书籍信息退出取消的集成复核（2026-09-13）

范围：检查冻结的三项 VM 补修及 Harmony 本地统一门禁，无设备操作，无 Core 全量重复执行。

本次针对 `2df5cfa6` 之后尚未提交的书籍信息导航补修发现额外故障路径：更多→书籍信息→进度保存失败→“继续阅读”→稍后正常退出阅读，实际转入书籍详情，预期回到原书架入口。该问题已在本地生产方法调用链复现，不需要继续设备抓取定位。

根因：`Index.requestReaderBookInfo()` 设置 `bookInfoAfterReaderExit`；其清除点只有 `onReaderExited()`。`ReadingExperience.finishExit()` 失败弹窗的“继续阅读”只重启计时，没有撤销 Host 持有的目的地。之后普通退出仍消费旧 Info 目的地。

验证：复用 `tools/test-bookshelf-reading-entry.mjs` 的真实 Panel→LRE→Index→注册退出闭包→保存链，附加上述取消分支，断言失败：`actual: detail, expected: bookshelf`。原始输出在 `/private/tmp/reader-info-cancel-review.log`。现有该测试的失败路径先调用 secondary 又调用同一旧弹窗 primary，并验证仍到详情，未区分真正取消和重试。

修复建议：给退出取消增加显式通知，由 LRE 的“继续阅读”回调撤销 Index 的 Info 等一次性退出目的地；失败弹窗的重试直接保留目的地，取消后旧弹窗按钮不应继续生效。分别测试“直接重试→详情”和“继续阅读→正常退出→原入口”。通知与已有退出所有权保持单一来源，正常系统 Back 分层语义不变。

结论：三项补修不能仅凭现有全量检查通过就立即视为可发布，需要先补上此已复现的取消路径。root 已获通知；本 agent 没有修改生产导航实现。

## 冻结补修的统一门禁结果

- `scripts/check-local.sh` 运行结束，exit 0：**221 组通过**。日志 `/private/tmp/reader-vm-fixes-local-gate.log`，SHA256 `54d942d1644d26ed6ec4099a15014d72ebd8e86809ab036e900d36636c865b1f`。
- 入口自动发现 `tools/test-*.mjs`（排除 `test-*-server.mjs`），`test-reader-auto-page-native-layout.mjs` 已自动纳入，无须增加另一份手动清单。新测试的真实 SDK Builder 共 84 个往返样本通过。
- 已检查三项补修的生产/测试 diff；tracked `git diff --check` 以及新增 AutoPage test/fixture 的空白检查没有错误。
- 上述全量测试结果反映加入本记录取消分支之前的覆盖；额外取消探针失败仍须修复，不能用 221 组通过覆盖该失败。未重跑 Core、未构建、未安装、未提交、未触碰设备。
