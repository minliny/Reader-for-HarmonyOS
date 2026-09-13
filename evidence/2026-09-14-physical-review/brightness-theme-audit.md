# PH01–04、PH33 代码审计

基线：用户审视9509包；当前4802ef4b。未操作设备。

## 定位

- PH01：LocalReadingExperience.setReaderBrightness直接percent/100，admitReaderBrightness再brightness×100，Panel按整数1步进；低亮度只占约四分之一条段不是GPU问题，映射和量化本身可从代码确认。
- PH02：setReaderAutomaticBrightness无条件写-1，已自动再次点击仍写-1，没有反向切手动分支。
- PH03：当前只读Window.brightness；-1表示跟随系统，不能提供实际系统档位。已核查本机SDK及OpenHarmony settings公开接口，SCREEN_BRIGHTNESS_STATUS是0–255设置值；display.getBrightnessInfo(API22)为sdrNits/currentHeadroom/maxHeadroom，不是可控亮度上下限，也不能推导个人舒适范围。不能宣称已经获得面板实测nits校准曲线。
- PH04：24vp命中Stack内分别画8vp背景与独立圆角填充，填充低于8vp高时横向跨度仍为8vp，未按原轨道底端圆弧裁切。修复须保留24vp命中区，视觉层统一8×92圆角裁切。
- PH33：Appearance stepper、ReaderSelect appearanceLibrary、ReaderSelectPanel直接消费APPEARANCE_SELECT_*日间常量，绕过注册表；不是字体前景均漏配色。5个颜色作为App角色迁入注册表，保留原Day及alpha；Night复用既定bright/primary/border基色。

## 修复约束

亮度采用AOSP SettingsLib DisplayUtils固定android-15.0.0_r1的HLG映射薄移植（Apache-2.0），保留0.01–1窗口范围，滑条更细步进并双向逆变换；不自己另造通用曲线。此曲线分配低亮度操作距离，不冒充每台设备已经校准的人眼舒适度。自动模式读取系统当前设置档位投影，异常保持已有有效值；只写Reader窗口，不修改系统自动亮度总开关。自动按钮在自动/手动之间切换，连续点击意图和异步失败由同一亮度写入器串行处理。退出仍恢复进入前策略。

参考：[OpenHarmony settings](https://github.com/openharmony/docs/blob/master/zh-cn/application-dev/reference/apis-basic-services-kit/js-apis-settings.md)、[display](https://github.com/openharmony/docs/blob/master/zh-cn/application-dev/reference/apis-arkui/js-apis-display.md)。本机SDK为对应能力核对依据，新的设备亮度感受与真实系统值一致性待后续合并验证。

## 本地实施与证据

已接入AOSP曲线、自动/手动双向切换、系统设置值异步读取及过期拒绝、圆弧裁切；PH33五角色和PH37关闭轨道角色已统一注册（583角色）。滑条位置25%/50%/75%分别写约2.94%/9.08%/26.90%窗口值；末端仍100%。这是曲线映射值，不是实测nits或舒适度承诺。

[亮度生产回归](brightness-perception.log)：991个单调/逆变换样本、双击pending意图、系统读值/迟到/离页/失败、SDK 24vp命中+8vp圆弧裁切通过。[Cancel回归](brightness-cancel.log)通过；既有writer回归通过，保留单在途/末值/失败/退出策略。[深色交互绘制](appearance-colors.log)通过Day/Night/Day与开合状态的真实SDK观察器。以上不替代ArkTS构建或设备像素/亮度体验。

4802ef4b打包阻断的测试依赖已补上leadingAnchorIsAligned，原断言未降低，test-reader-render-work现通过；旧失败日志仍保留。

### 独立复核发现及追加修复

自动模式首次读取系统档位尚未返回时立刻点A，会使用默认/旧的50%滑条位置进入手动（曲线后约9.08%），然后拒绝迟到的真实系统值，导致亮度跳变。原测试仅覆盖先读后点击，未覆盖先点击后读完。修复为自动转手动共享在途系统观察，设置待处理手动意图，读取完成后按实际值写窗口；双击、拖动和离页以同一generation撤销旧读取。只在系统读取失败时使用已有有效档位，不把默认值称为系统实测值。

独立第二轮复核补充：重开控制栏的refresh曾递增请求generation，丢弃待手动读值却留下false intent。现refresh只观察原generation，待用户意图时不准入窗口读回；正式回归覆盖等待读值期间关闭/重开再确认的顺序，已通过。原[只读复核报告](brightness-independent-review.md)保留修前结论，不回写成当时已通过。

顶层书架轮廓补修见FEEDBACK默认实施选择：AppTopBar仅书架开启底部分隔，不影响其他顶栏。SDK Day/Night及开启/关闭状态已纳入appearance-colors.log。
