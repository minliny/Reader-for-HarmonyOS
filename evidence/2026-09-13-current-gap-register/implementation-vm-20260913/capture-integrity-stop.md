# 首包 VM 取证完整性停止

2026-09-13 22:00:52 CST，首包 `20260913T125821Z-2df5cfa6-7c0928b6` 的唯一 probe 会话50242在接收 `reader-control-settings-quick.png` 后退出。对应日志最后一个command为file recv成功，但没有该图的capture-integrity成功记录，也没有后续settings-full手势派发记录。此后的write_stdin报告Unknown process id；不能把未派发的操作记为设备执行。

本地图1877533字节，第一PNG的IEND在572607字节结束，后有1304926字节尾部。查看器能显示PNG前缀不代表整份文件通过取证门禁。该图不得单独作为验收通过证据；同次JSON布局已有独立成功hash回执，可继续用于代码定位。

代码侧：probe的pngExtent明确拒绝IEND后的尾部；run在接收后进行此检查，异常路径finally释放共享server lease。当前不存在server lock，保护行为有效。普通screenCap路径由调用者命名，本次使用了容易与历史guest文件重名的静态路径；采样操作自带UUID的15张图均通过完整性检查。目前疑点是旧guest同名文件写入未截断或传输附带旧尾部，尚未取得guest文件extent，不能直接归因HDC连接或Reader渲染。后续使用本次run独有文件名取证，不删除旧证据、不改VM/HDC状态。

22点后只读核对：原Emulator PID21552与HDC server PID75381的启动时间、参数、状态S均未变；未发现连接失败文本或Reader崩溃证据。继续设备操作前重新读取既有目标boot/SceneBoard前置门禁。此次没有重启、卸载、清数据或改用其他目标。

后续只读 guest stat 核对：原 guest PNG 同样为1877533字节，与接收后的文件完全等长；访问时间为9月7日、修改时间为9月13日22:00:53。这说明该路径原已存在，多余长度在 guest 文件侧已经存在，不能归因本地 file recv 追加。尚未读取系统截图实现，不能把“同名覆盖未截断”推测写成已证实上游根因。新的每次截图使用UUID文件名，并继续要求完整PNG边界和哈希成功；原文件保留为失败证据。
