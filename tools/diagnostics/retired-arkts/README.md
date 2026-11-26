# 退役的 HarmonyOS ArkTS 诊断源码

此处保留结构验证页和渲染试点的历史源码。`ReaderPageStructureVerification` 和 `ReaderRendererPilot` 及各自的专用依赖已移出 `entry/src/main/ets`。迁移时只调整指向原模块的相对导入。结构验证页的五条[消息登记](message-entrypoints.json)保留原路径和 ID，供核对历史回执。两组漫画夹具生成器的 TypeScript 输出在这里的 `app/` 目录，原 rawfile 资源路径仍可供历史记录引用。

历史回执中的 `entry/src/main/ets/app/` 和 `entry/src/main/ets/pages/` 路径按其记录的源码修订解释。需要重放旧诊断时，从回执绑定的 Host 修订及其 overlay 恢复原布局。此目录未注册为页面、模块或测试入口。
