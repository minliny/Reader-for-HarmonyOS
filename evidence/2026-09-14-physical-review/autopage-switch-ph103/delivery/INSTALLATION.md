# 最新修复包真机安装

- 完成时间：2026-09-16T00:36:48.568Z（北京时间 2026-09-16 08:36:48）。
- run：`20260916T003557Z-b37f745a-f7e147cb`；iteration，acceptanceEligible=false。
- Harmony：`b37f745a8c88865e99e5644eb784de6c769f08a3`，dirty=false；Core：`bf49495317798f68b98928712eb6e106af02bed1`，dirty=false。
- [不可变 manifest](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-artifacts/hap/20260916T003557Z-b37f745a-f7e147cb/manifest.json)。
- signed HAP SHA-256：`96fc18c1416daa06793a8120c0ef2abc7c9e7e84572e37bd647150506ef2eb79`；签名验签通过，Profile=debug；安装前后应用身份匹配。
- 277 组 Harmony 检查、ArkTS、隔离非增量构建、签名及独立 manifest 复验 PASS。
- 当前 USB 真机 targetRef=`b1f20b88963d`，启动完成；预检、保数据覆盖安装、启动 PASS。无卸载/清数据，未操作 VM。
- 包含 PH100 搜索简介及章节链路、PH101 朗读启动、PH89 倒计时基线、PH102 搜索封面、PH103 深色开关修复。
- [部署回执](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-artifacts/hap/20260916T003557Z-b37f745a-f7e147cb/deploy-physical-b1f20b88963d-20260916T003648Z.json)；功能交互、设备视觉与用户验收仍 OPEN。本轮只执行用户要求的安装/启动，没有进行设备测试。

## 首轮环境失败与处理

本机默认 Xcode 工具入口要求确认许可证，直接使用已有独立 Command Line Tools 的 Git；首轮门禁随后在 C++ 探针缺少 atomic 头文件处失败。记录已保留，失败包没有发布或安装。对本次进程设置 DEVELOPER_DIR=/Library/Developer/CommandLineTools、SDKROOT=/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk 及对应工具 PATH 后，原失败探针 22/22 通过，重新完整构建并安装上述产物。未接受 Xcode 许可、未修改全局 xcode-select、未绕过测试。
