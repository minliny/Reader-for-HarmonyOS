# 6cf9705d 阶段验证（历史包）

绑定 `20260915T062858Z-6cf9705d-462c40b4`、Core c28f0f792、VM 6460677a198b。HAP SHA-256 `44511a77edbac92f9ecc6742fce38ea988037643512b77012d0abc700b532487`。保数据安装/启动通过，Core3860/3860、210协议及clippy/drift/ABI通过；Harmony264项入口及ArkTS/签名通过。不是验收包，构建时Harmony证据文件dirty。

## PH76 实际原生回调

- early，runToken1789453983156-1：PASS，callbackToMatchMs=3，orderedMatch=true，unexpectedDocument=false，matchedBeforePageEnd=true，目标页结束尚未发生。初始化blank事件继续保留，不进入目标文档结束判定。
- cancel，runToken1789453986511-2：PASS，旧old.js在取消后resourceDiscarded；新new.js匹配1ms，returnedResource=new.js，observedLateOldCallbacks=0。

见 ph76-native-results.log。这两个内存夹具使用真实ArkWeb回调，但不访问外部网站，不等于实际代理联网或所有调度的穷尽证明。384旧cancel FAIL、4cb/90bc加载前失败、af406探针判定失败均保持各包原事实。

## 真实《鸣龙》查询

4.699秒采样时已见准确作者关关公子，30/109源、164组、12失败、4候选；8.675秒41/109、179组、12失败、6候选；15.693秒80/109、326组、31失败、10候选；30.746秒采样时已结束、374组、43失败、准确组13候选。“作者：”造成的准确作者分组重复在这些可见采样中消失。

这些时间是观察上界，不是精确首现/结束事件，也没有帧时间测量。实际日志在14:35:20.747准确定位 HttpExecuteHost.ts:878:65 的 `.encode(text).length`，平台旧TextEncoder返回undefined，导致请求体编码阶段失败；不是Core编码器故障。随后c56修复，见相邻vm-c56ad545/ONLINE_RUN.md。不能拿本包请求前失败较多时较快结束的结果声称性能合格。缺正文403在本包误报为raw bytes类型错误，后续亦在c56修正。
