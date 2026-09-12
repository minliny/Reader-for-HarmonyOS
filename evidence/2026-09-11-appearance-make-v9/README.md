# HarmonyOS 外观控制页 · Make V9

参考：[Redesign Typography Library Module，Version 9](https://www.figma.com/make/LOYUJr93KwespD5j7N6icw/Redesign-Typography-Library-Module)，2026-09-11 实际预览。

本次修改：排版库合并为 8 行卡片，胶囊选项按钮显示当前值，菜单保留选中标记并按可用空间向下或向上展开；步进器采用 26 / 44 / 26 分段，显示数值单位。快捷控制栏与完整页共用八种新色块，“夜纹”显示为“靛夜”，保存值仍为 `paperNight`。

继续使用现有状态回调、字体排序、阅读背景渲染和翻页能力。Make 示例中的“淡入”没有被伪装为应用已有能力；现有覆盖、滚动等模式继续可选。控制栏进度轴、轨迹、手势和动效参数未改动，见 `motion-before.sha256`。

验证：

- 新增检查执行实际菜单处理方法，覆盖选择后回读、再次打开、旧菜单回调失效、非法选项、滚动后的定位与窄窗口边界。
- 182 个 Harmony 合约检查通过；新增图标的原始 SVG 路径及来源登记校验通过。
- 原生 ArkTS 编译、HAP 打包、签名验证和独立 manifest 复核通过。
- 后续按用户“安装 VM”的要求，已安装并启动于当前 Mate 80 Pro VM（目标引用 `6460677a198b`），覆盖更新保留数据。VM 进程、实例路径、端口归属、系统启动完成与稳定 SceneBoard 均重新核对，安装前后签名身份一致。受限环境中的 HDC 连接失败已通过受许可的环境重新检查解决，没有重启、重置或替换 VM。
- 页面交互、原生视觉、真机体验和用户验收仍未执行；安装与启动成功不能替代这些验收。

安装包：[entry-default-signed.hap](../../.reader-artifacts/hap/20260911T133517Z-35f2f99a-92f2b4a4/entry-default-signed.hap)

构建清单：[manifest.json](../../.reader-artifacts/hap/20260911T133517Z-35f2f99a-92f2b4a4/manifest.json)

VM 部署回执：[deploy-vm-6460677a198b-20260911T134931Z.json](../../.reader-artifacts/hap/20260911T133517Z-35f2f99a-92f2b4a4/deploy-vm-6460677a198b-20260911T134931Z.json)。签名/Profile 为已验证的 signed debug。安装与启动均为 PASS。

签名包 SHA-256：`a3adb1d2544a49ee53ffd2f44a809a5e6d2fee9efc0a60f47dffcbfc277be0bb`。

本包是保留当前未提交工作区的 iteration 构建，不是干净提交验收包。Harmony HEAD 为 `35f2f99a8d635615475fde75120bf8629f944565`；构建输入指纹为 `92f2b4a401a029a2f605dfc791942bb7976a3c50aab94b50a470f18bf998dac8`。独立于既有工作区改动的本次差异见 `task-only.patch`，新增源码和图标见构建输入快照。

Core HEAD 为 `6b2a9d87048e3da812bec08b7c2b3fff1c16e2e2`，同样为 dirty；部署前重新核对两仓 HEAD 未变化。本次按指定 immutable run 安装，没有重新构建或替换其他包。

参考读取边界：Figma 设计上下文返回了 Make 源文件资源链接，但资源正文读取失败；本次颜色、尺寸和图标来自已实际打开的 Make 预览 DOM，菜单已在参考页点击展开确认。未将网页预览当作原生运行证据。
