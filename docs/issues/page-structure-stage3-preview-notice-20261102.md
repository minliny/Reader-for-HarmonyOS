# Stage 3 历史预览的当前阅读说明

**字体证据以[实施方案](page-structure-fix-20261102.md)第14.9节更正为准。** Stage 3的checked字体回执在本机Previewer中为mock，只证明调用次序，不能证明Reader字体实际加载，也不能据此接受正确字形、字体预算或设备视觉。

三帧仍可用于观察当时的三态内容投影。Stage 3闭环时源码SHA为`6aa9546a5808256fb86ff2897a0346d24ec9c9402378a439f51b6e800fa324c3`，不是Stage 4当前源码。样本数据、零OS inset、density/fontScale=1的限制仍适用；没有设备、实际点击/登录、系统Back、读屏、2.0×或用户验收。

历史[manifest](../../.reader-artifacts/page-structure-stage3-20261102/evidence.json)的SHA仍为`249f470070a8da6e28293ed1bad59c91375c6482b423e979992a35c7795e6be7`。其`fontAdmission`措辞保留历史意义，必须结合上述纠正阅读。旧manifest、JPEG、JS/ABC与日志均未覆写；原[预览汇总](../../.reader-artifacts/page-structure-stage3-20261102/native-demo.md)未被列入冻结manifest的输入/输出，本次仅在顶部添加阅读更正，保留下方历史内容，使旧链接也能看到提示。本页是继续引用它们的当前说明入口。

Stage 4进一步确认真实字体加载后，最小对照中可变字体仍绘制异常，系统字号setter也不生效。详见[Stage 4原生说明](../../.reader-artifacts/page-structure-stage4-20261102/README.md)。旧三帧不用于覆盖或豁免这些失败。

## 历史三态帧

以下均非字体/字形验收图。

默认列表：

![Stage 3历史默认列表](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-artifacts/page-structure-stage3-20261102/normal-native-02/frame-000.jpg)

筛选为空：

![Stage 3历史筛选空态](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-artifacts/page-structure-stage3-20261102/filtered-empty-native-01/frame-001.jpg)

登录忙碌状态投影（不证明真实登录或按钮点击）：

![Stage 3历史登录忙碌投影](/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/.reader-artifacts/page-structure-stage3-20261102/login-busy-native-01/frame-000.jpg)
