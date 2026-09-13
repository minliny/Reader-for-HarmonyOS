# 快捷设置分组圆角：VM现象、代码定位与修复

## 现象与来源

- 产物：`20260913T125821Z-2df5cfa6-7c0928b6`。根任务已取得 `implementation-vm-20260913/reader-control-settings-quick.png/.json`；本子任务未操作设备。
- 三条分组底色的边界分别为 `[159,1822][942,1927]`、`[159,2011][942,2116]`、`[159,2200][942,2305]`（原始1280×2832px）。density3.5，当前bar约223.714×30vp。
- 原始PNG每条左上角的(2,2)/(14,2)/(2,14)像素均为RGB(245,237,228)，外侧为(255,250,245)。半径8vp=28px的左上圆角外侧被底色填满，方角确定存在。内部选项的6vp圆角仍显示，不能笼统称为全部圆角丢失。
- Figma归档 `tools/fixtures/reader-control-search-settings-live-20260905.json`，`settingsDesign` 的 `1692:3687/3692/3699` 明确：SegmentBar的panel-soft填色RGBA(238,230,219,.64)、radius8；Quick248×30→Full308×33。内部Choice的radius6。

## 代码定位

`ReaderControlSettingsContent.sharedClip()` 在完整源区域可见时复用 `RectShape().width('100%').height('100%')`，在部分滚动可见时复用动态Path。旧 `segmentRow` 把这个无圆角的可见性裁剪直接应用于拥有底色、边框和radius8的同一个Stack。动态矩形裁剪与圆角绘制职责混在一起，SDK Builder属性检查只看到了borderRadius8，未验证裁剪的所属层级；VM显示底色最终方角。

## 已实施

- 外层：原始宽高/位置及 `sharedClip(row,true)`，没有底色或边框，继续使用现有矩形/Path缓存。
- 内层：宽高跟随相同bar，显式位置(0,0)，保留原panel-soft、TOK_LINE边框、radius8及alpha，使用 `clip(true)` 按自身圆角限制内容。
- 选项仍为原13个保留Text actor、radius6与AttributeModifier，现有事件、状态和共享进度不改；没有新增时钟、路径生成器或主题颜色。

## 修正旧证据口径

此前“设置容器/外框全部已修”的说法过于笼统，应拆成当前事实：三条bar与各Choice边框已存在，但bar的圆角底色在本次VM仍失败，本次针对其层级完成修复。

**快捷内容区域不另增独立圆边框。** 本轮合同§6保留原bar/card边框和alpha。Figma `1692:3148 AddedActor/FullContentSurface` 是radius12、1px描边的Full表面，动效明确Quick opacity0→Full1；当前 `ReaderControlMotionGeometry`/`ReaderControlMotionStage` 与其一致。该行为继续保持，不将其列为需要用户重新决定的产品事项，也不把完整页尺寸的表面强行显示到快捷页。

## 本地门禁

- 新 `test-reader-settings-rounded-clip.mjs` 执行真实SDK生成的Builder闭包，并按实际Stack create/pop追踪父子层级：三个无paint裁剪载体各自包含一个独立radius8绘制层，13个Choice仍在对应绘制层内。
- 42组正向/反向进度、3种宽度及Day/Night组合；部分滚动时继续生成既有Path；相同姿态复用缓存；完整可见场景只分配一次公共Rect、不生成Path；节点不重挂载。
- 将动态clip重新放回有paint的bar的变异测试被明确拒绝，覆盖旧结构失败。
- 通过证据：`settings-rounded-clip-builder.json`。相关 `test-reader-control-search-settings-content`、`test-reader-render-work`、`test-reader-control-morph-scroll` 均通过。
- 证据边界：Builder层级与本地回归通过；新HAP原生圆角像素需根任务复核，不将本地结果称为VM视觉通过。
