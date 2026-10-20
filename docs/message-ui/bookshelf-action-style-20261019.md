# 书架长按弹窗样式修复

用户本次明确指出：“长按书架页书籍的弹窗比例不对，边框和排版参考书源切换弹窗，图标背景色和强调色不统一且过淡”。本项是对长按书籍操作面的新增修改授权；不改旧消息迁移批准清单，也不将旧未实施/已排除范围追认为已批准。

## 代码定位与实施范围

原native Sheet和内层自绘Surface重复设270高、24顶圆角，两层底色不同，内层另画灰色边框和重阴影。宽度取书架封面列宽（手机352/平板720），而非当前换源抽屉最大390。Header/ActionList仍绝对定位，旧四个40高动作规格却承载新的“三快捷图标＋危险分组”内容，底部缺乏余量。

实际图标混用了黑、灰、绿SVG；删除使用深色按钮上的反白资源，却放在浅底行，导致低对比。旧SheetSpec中绿色动作/背景字段没有进入实际quick renderer，仅改字段无法解决。

本次参考实际在用的 `source-switch-drawer`（不是退役紧凑300×385 popup）：宽度上限390、22顶圆角、SS_WINDOW_BG实色底及SS_DRAWER_SCRIM遮罩。保留native Sheet及原presentation/book/navigation/once-only生命周期；native独自画外框并用FIT_CONTENT测量，内部改自然流、取消固定高度/绝对位置/重复底色边框阴影。Header沿用换源标题24/32.4与静态SerifBold，20水平内边距。

四个原动作平铺纵向行，正常行最小56，带副文行最小72并允许自然撑高；图标格36、图形22。普通图标格用TOK_GREEN，危险格用TOK_DOWNLOAD_DANGER，图形用TOK_DOWNLOAD_GREEN_INK（白日纸白、夜间深墨），保留日夜语义与对比。信息图标复用既有真正info资源，删除保留红色语义。仅新增有限bookshelf动作变体，其他menu/quick/grouped物理布局与行为保持原样，不新增通用样式参数或新配色体系。

不可变范围见证为 `bookshelf-action-style-scope-20261019.json`；本文件追加定向SDK/身份/隔离检查、HAP、设备与用户视觉验收结果，不以源码或SDK通过代替原生效果。

## 本地验证记录

书架native owner、共享composition、Bounded frame/header及view/menu专项均通过；覆盖270/390/720/1024视口、非对称安全区、视口更新、自然高度、四操作可达的SDK结构和原presentation/once-only/退休回调负对照。换源visual/typography、响应宽度、bounded typography、native default controls关联检查通过。旧menu/quick/grouped与不可变历史renderer和原三份规格在day/night下逐原生节点属性一致。

全局架构通过独立有限书架后继承接五个共享actor及唯一quick到bookshelf消费边；原消息迁移fixture、100项历史业务预算与其他变体fixture不改。新增图标底格仅登记实际backgroundColor从6到7，原预算不变；图形颜色入口另纳入精确物理shape。

最终审查发现首次实现使用的Image.fillColor只处理SVG填充，而四个图标是stroke图形。已在代码侧发现并主动取消首轮契约执行，未产生或安装该实现的HAP。改为平台colorFilter保留原alpha、将RGB统一映射至已有前景角色，避免无效或填实图形。依据为OpenHarmony官方Image文档fillColor/colorFilter及SvgGraphic分别处理fill与stroke的实现；该接口选择不以SDK setter通过当作像素变色证明。

完整门禁的下一次诊断发现 `test-bookshelf-physical-feedback.mjs` 的历史单书弹窗检查仍提取旧封面宽方法执行，并要求270固定高/24圆角及内外双绘制；新方法因该测试缺少SurfaceWidthSpec依赖而报错。已记录并主动结束该轮，未产生HAP。仅按本次明确授权更新该检查块，执行当前真实metrics/viewport/safe geometry调用链，保留历史baseline分支及其余18项；19项最终均通过。全tools搜索未发现其他仍活动的旧书架Sheet几何断言。

最终完整签名构建于2026-10-19 13:34 UTC启动，使用规范iteration/local入口及允许的4个契约worker；结果、产物和设备证据待流水线完成后追加。

## 最终开发安装结果（2026-10-19）

上文13:34 UTC完整门禁中的703项均真实通过，但根代理期间补写本说明文件，触发全工作区输入变化保护，因此该轮整体失败，未生成HAP。逐文件比较确认唯一变化为本文件，生产与测试均未变化。其后的重复全量执行已按用户“暂停”要求取消，自有子进程已全部回收。该失误与无效重复耗时归根代理操作，不归因于用户或UI代码。

用户随后明确要求：非刚需不执行门禁、执行前逐条说明必要性、未明确要求禁止全门禁，并将门禁逐项筛选和默认关闭转交独立后台对话 `01a15470-e8fa-7771-a94a-7b2d4a01c9fb`；本对话优先完成本项UI。此后使用项目现有DevEco开发构建入口 `node scripts/deveco-build.mjs`，未再调用合同测试。编译/打包/指定签名身份及实际HAP验签、Native字节匹配是本次生成并安装可运行开发包所需检查。

- DevEco开发构建：PASS，39.797秒，日志 `.reader-artifacts/bookshelf-action-ui-20261019/development-build.log`。
- 开发signed HAP：`entry/build/default/outputs/default/entry-default-signed.hap`；SHA256 `5ef5316862bd1cccb7af674d3cab67943e4c6dfcb33c5a4c300dd74165c83fd5`。使用 `minliny_HarmonyOS`，证书SHA256 `3a563778e5bf17cd3ead0218e13b4a5030de3f5d7d4e21e0336d8eb37b676dc4`，debug Profile，包名 `io.reader.minliny`，验签PASS。
- Harmony HEAD `5a01ec1cdbd5ec864046e1b9202963ead23a513a` / Core HEAD `b52365329f1312c7bb80605c8a74eecaf8f4bc44`，均保留原dirty WIP；实际安装包源内容fingerprint `15616c7b6b6646747e55b10ffc767da085c3e2ed16dbea8757fb61e2fdd3edff`。
- 真机 `targetRef=b1f20b88963d`：2026-10-19 13:56:04 UTC保数据替换安装PASS、启动PASS；未卸载或清数据。开发安装回执 `.reader-artifacts/bookshelf-action-ui-20261019/development-physical-install.json`。此为DevEco开发安装记录，不冒充不可变pipeline manifest或验收包。

真机实际长按展开截图 `.reader-artifacts/bookshelf-action-ui-20261019/reader-control-book-action-fixed.png` 及对应UI树已观察：当前手机宽度适配正常，单一原生底色/圆角外框，四条纵向操作完整显示，普通三格深绿底/白色描边图形，移除格及标题保持红色，副文完整，底部未见裁切。点击“书籍信息”后UI树出现该书标题及“书籍详情”，该跳转PASS；未执行移除动作，不扩展验证详情书源/目录业务。

首次前台截图并非Reader，不作为本项UI证据；已重新启动Reader后从实际书架长按取证。完整物理取图前置曾两次因手机/电脑时钟一致性条件拒绝，安装阶段的启动/签名/目标检查已通过。按本次用户要求，取图临时脚本仅保留精确USB目标、boot.completed=true及两秒稳定SceneBoard PID；手机和电脑时钟同步与本次静态UI截图无依赖，因此未作为取图前置。未修改共享生产门禁，该条件留给独立门禁任务逐条审计。

已达证据：代码修复、定向SDK验证、DevEco开发编译签名、保数据真机安装启动、当前日间弹窗展开及书籍信息跳转。夜间真机视觉和用户视觉验收OPEN；不以日间截图或既有SDK通过替代。

## 尚需回答的原生问题

代码已定位并修复重复固定高度/绘制、错用封面宽和图标对比。原生Sheet的系统安全底部及FIT_CONTENT最终像素仍不能由SDK探针证明。后续取证仅需确认：实际宽度与内容比例、四动作可达、底部无裁切/多余重复安全区、日夜图标对比；不需要通过真实移除书籍制造数据变更。
