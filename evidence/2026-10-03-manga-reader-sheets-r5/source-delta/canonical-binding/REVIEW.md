# 构建绑定脚本问题记录

2026-10-03，首次执行新增绑定脚本时，R4 父目录索引多上溯一级，`frozen_hashes()` 在读目录阶段报 `FileNotFoundError` 并停止，尚未复制 manifest、写入绑定或修改任何产品／冻结归档。代码侧将 `OUTPUT.parents[3]` 修正为 `OUTPUT.parents[2]`，随后重跑全部绑定检查。此为证据脚本路径问题，不是产品或构建失败。
