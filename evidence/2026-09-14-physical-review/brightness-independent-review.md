# PH01–04 / PH33 独立只读复核

时间：2026-09-14。源码基线为当前工作区、用户真机反馈对应已安装 9509d4fe；本轮工作区修补尚不能当作该安装包行为。范围仅 ReaderBrightnessCurve、LocalReadingExperience 亮度段、Panel 亮度轨道、ReaderSelect/ReaderSelectPanel 配色、两份新增回归与 brightness-theme-audit。未改生产或测试，未构建、Git、HDC 或设备操作，未重复全量门禁。

## 确认的时序问题

1. **首次系统档位未返回就点击 A，原修补仍用旧值进入手动。** 实际生产方法注入延迟 Settings Promise，系统值 204（0.8）尚未返回时点击 A，窗口写入 0.09084175084175085（初始滑条 50 经曲线转换），后到系统值被 generation 拒绝。原回归只覆盖“读完后点击”。已立即反馈 root；root 已补共享在途系统读取、待手动意图以及先点击后返回测试。本报告没有代替 root 的最终测试回执。

2. **上述追加修补仍有控制栏重开打断待手动意图的边界。** 按新生产方法执行 `refreshSystemBrightness → setReaderAutomaticBrightness → refreshReaderBrightness`，最后才返回 Settings 204。控制栏重开会增加 generation，旧读取不再写入手动，但 `brightnessAutomaticIntent=false` 留存。实际输出为 `auto=true, intent=false, percent=50, writes=[]`，下一次 A 点击写 `-1`，与当前自动状态的反向切换不符。现象源于取消旧事务时只废弃结果而未同步清掉旧意图。已反馈 root 处理；本报告记录时尚未复核其修正。最小修正应明确 refresh 的意图取消/延续语义，不能留下孤立的 false；对应回归需包含关闭后重开控制栏再点击。

## 其余范围复核结论

- **曲线与逆映射：** 固定 AOSP android-15.0.0_r1 的 HLG 薄移植，窗口范围 0.01–1；991 个样本的单调与逆变换约束在新增测试中。生产入口先排除非有限输入。未发现该范围另一个数学阻断；这是低档位操作距离分配，不是面板 nits 或个人舒适区校准。
- **退出迟到回执：** 实际生产方法探针在待写入时先执行恢复，观察到 owner 7 被 release、旧回执未再改 UI（generation=3）。仅证明本次 LRE 生命周期隔离；没有扩大声称已独立复核共享 writer 的所有 native 恢复算法。
- **轨道低填充：** 实际 SDK Builder 属性为外层 24×92 命中区、内层 8×92 单一圆角裁切（radius=4、clip=true），填充不再独立圆角。几何上封住短填充越过轨道底弧的问题。拖动每个变化 MOVE 都发出更新，未恢复成只在 UP 写入。未把本地属性验证当成设备像素验收。
- **系统设置边界：** 本机 SDK `@ohos.settings.d.ts` 将 SCREEN_BRIGHTNESS_STATUS 定义为 0–255 设置值（140–147），getValue(context,name) 是公开 Stage 只读接口（1030–1039），代码未调用要求 MANAGE_SETTINGS 的 setValue，也未修改系统自动亮度开关。`display.BrightnessInfo` 的 sdrNits/currentHeadroom/maxHeadroom 不是可控最小/最大舒适范围。保存的系统档位不能冒充环境自适应后的实测亮度。
- **PH33 主题属性：** 两个组件使用 App 颜色角色，无直接遗留日间颜色常量消费。独立实际 SDK Builder 补查 selected/unselected 的 Day→Night→Day：selected fill 为 `#B8EEE6DB → #B82C2824 → #B8EEE6DB`，文字 `#FF2F6373 → #FFD2BD96 → #FF2F6373`，check 资源随夜间切换；未选中透明背景、文字 `#FF41484C → #FFEADFCE → #FF41484C`。25 高度及 6 圆角未变。其余开合表面/边框在现有新增测试有覆盖。此处未发现新阻断。

## 交付边界

上述两项为已定位的应用异步状态问题，不需要新增产品决策或靠真机抓取定位。root 负责生产和回归修正。root 对第二项已明确采用保留用户等待事务：refreshReaderBrightness 观察当前 request generation 而不递增，存在 intent 时不准入读回；关/重开控制栏仅观察，不取消自动转手动或 MOVE 意图，并补正式重开场景回归。两次发现均等待 root 最终回执，本次只读复核到此冻结。

最终合包前需使两项回归通过；本报告不宣称最终门禁、ArkTS、VM、真机亮度感受或用户验收通过。除此之外，本次指定文件和边界内未发现需要阻断合包的新缺陷。
