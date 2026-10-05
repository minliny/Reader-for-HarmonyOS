# 构建尝试记录（诊断摘录，非完整原始日志）

- 1：图标门禁拒绝 Image.fillColor，错误为“Image.fillColor is forbidden for SVG icons; generate a fixed-color asset variant instead”。已改固定色资源，原门禁通过。
- 2：规范本地回归因 localhost 夹具 `Error: listen EPERM: operation not permitted 127.0.0.1` 中断，来源 test-reading-directory-fixture.mjs。改用允许localhost夹具的执行环境，未绕过门禁。
- 3：SDK声明检查发现 FontWeight 不含 Black。主动终止仅本任务构建，标题改数字900。
- 4：真实SDK闭包回放复现选中态捕获初值，主动终止仅本任务构建；按稳定kind/key参数及实时State读取修复。同mount往返与旧边界负控通过，审计JSON与green日志在同目录。
- 5：完整门禁在 `test-svg-provenance` 拒绝未登记的22个新增SVG。已规范增加固定 Radix1.3.2 来源、8个原始组件及MIT/提取回执哈希；只允许重着色，原374个资产同步前后字节一致。完整失败日志见 `hap-attempt-svg-registry-failure.log`。
- 6：最终只读复核又发现目录顶部边线、内部底部留白及tree/fallback空态位置差异；主动终止仅本任务尚未完成的构建以补齐，日志见 `hap-attempt-directory-review-stop.log`。该尝试没有产物或安装。
- 7：核实demo深墨range有独立#ABC39E浅绿覆盖后，主动停止尚未完成的本任务构建并补色，日志见 `hap-attempt-dark-range-review-stop.log`。实际SDK同mount主题往返通过。
- 8：全部源码冻结后的规范完整构建通过，run `20261003T085836Z-568ec4e3-3dcdb3db`，完整日志 `manga-sheets-hap-delivery-20261003.log`；inspect及一次保留数据替换安装均PASS，见delivery.json和安装回执。先前失败/主动停止未记成成功产物。

此前构建共用临时输出路径，完整临时日志被后续尝试覆盖；诊断精确摘录保留于此，完整失败输出另在本对话工具记录中。最终构建日志将另存本目录，不把主动终止、局部门禁通过或旧产物记为新包成功。
