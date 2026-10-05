# 三个漫画弹窗：R3 VM 取证与 R4 修复

## 问题与验收责任

用户报告目录内部样式、弹出动效与已批准 demo 不一致。此前把构建/参数检查当作视觉还原验收，漏掉字体实际绘制、控件内部布局和关闭时的内容生命周期；该结论撤回。每个可见问题先记录，再按源码/API定位，最终 VM 图与动效证据独立记账。

## 本轮 R3 产物

- 独立源码：`/private/tmp/reader-manga-sheet-ui-delivery-20261003-1913`，Core/Host 为 dirty iteration。
- run：`20261003T113812Z-568ec4e3-9b6b030f`。
- signed HAP SHA256：`f57754fa66b124158b27c9efecc80d7316d85ba60a7ef457ea94c07f0271c9b2`。
- 指定 minliny_HarmonyOS 证书 SHA256：`3A563778E5BF17CD3EAD0218E13B4A5030DE3F5D7D4E21E0336D8EB37B676DC4`。
- Core 输入指纹：`9e97919470b42d81d87082c2c257984778da5e5e5e55798273b3242c99608c4b`；配套 SO SHA256：`1fabbfa63b996e39da9a3ec01f6b396cf841f0d0b4016303daac56a974c17996`。
- canonical build、436 Harmony 合同、验签、inspect、install/launch PASS。部署回执：immutable run 内 `deploy-vm-6460677a198b-20261003T113920Z.json`，`dataPreserved=true`。VM targetRef `6460677a198b`。
- 安装后书架保留，真实漫画《斗破苍穹》05，第5页/32页；竖向、跟随书源、暖纸、亮度50%、页码ON。

## 稳定原图与实际内部样式

- `vm/directory.jpeg` 和 `directory.json`：手机558vp目录、18vp内容边距、44vp搜索框、58vp普通/当前行、13vp箭头、当前项打开留距50vp；标题900及当前550已实际出现粗细层级，配色匹配设计。
- `vm/mode-settled.jpeg/json`：阅读方式双选项、适配列表、绿底白字选中态、当前跟随书源；独立逐项比较仍另记。
- `vm/settings.jpeg/json` 与 `settings-night.jpeg/json`：真实50%亮度、双底色选择、Slider/Toggle/恢复默认，昼夜真实图。没有为照片强改为 demo fixture 的78%。
- 页码一击实测：点击文字位置(200,2359)后 `toggle-off.json` 的 Toggle.checked=false；点击开关位置(1150,2359)后 `toggle-on.json` 为true。没有重复点击抵消。
- `settings-restored.json`：暖纸选择背景#1F3528、brightness50、Toggle.checked=true，恢复原偏好。
- `directory-first-open-preparing.jpeg` 是第一次字体准入等待期早拍；`mode.jpeg/json` 是上一面板尚在关闭时下一点击被生命周期门禁拒绝的闭态。原始失败/早期取证不删，不作对应稳定弹窗原图。

## 确认 FAIL：面板顶角被边框调用清零

- R3稳定目录 top y782 开始整宽暖白，x0/1/10/30/60/75/100均未形成22vp顶角；mode/settings相同。不能将源码写有borderRadius作为物理绘制PASS。
- 源码先 `.borderRadius(...).clip(true)`，再 `.border(wide ? object : undefined)`。官方 `JSViewAbstract::JsBorder` 非Object分支执行默认0的 `SetBorderRadius`；OpenHarmony-6.0-Release :4208–4223、master :4493–4501及common resetBorder均有该语义。
- 来源：https://github.com/openharmony/arkui_ace_engine/blob/OpenHarmony-6.0-Release/frameworks/bridge/declarative_frontend/jsview/js_view_abstract.cpp#L4208
- R4只移序为border→borderRadius→clip；两处 Surface新SHA `0f5e6d2654e8cc228b43b2ab2c9023e728db904193a147ce71da425113a6b897`，原参数/动效/测试未变。五项真实SDK/P0及旧顺序负控PASS，重新冻结；实际圆角须新包原图验收。

## 动效证据边界

- `motion/dir-open` 和 `dir-close` 保留各5张原生640×1416 JPEG、有效原生时钟命令窗口及原始输出。已有闭态/入场中间位置、目录内容保留的退场中间位置。post-command frame并不必然已结束；未手动标注前 analyzer 保持OPEN。
- 这是原生画面，不插值、不重建、不把并行文件序号当连续时间。窗口是CLI请求/输出时间，不能当VSync或触摸精确时刻；完整曲线、时长、平滑度及遮罩曲线一致性仍OPEN。
- 下一版本保留原collector，派生late collector新增0.8秒后的独立原图，补端点而不推定动画时长。六场景须与新产物重新绑定。
- 真实当前源是扁平目录；卷组数量/辅助信息只由真实Core事实绘制。‘整卷可读’缺可靠权威字段，不凭标题或URL伪造。分组、宽屏等未运行场景不借本张手机图宣称通过。
