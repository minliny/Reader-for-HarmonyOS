# PH114：拓展到刘海的文字与正文几何

用户报告顶部信息文字高宽不等于系统状态栏、左右间距错位、正文顶部没有同步移动；随后确认控制栏打开和关闭两态都不对。起始已安装 run `20260916T144055Z-5fb96de4-2d6e0f65`（signed SHA `e2cc8c8f14e896d519255d86adc2df6c985839a13c85533f169a29764317521a`），安装通过不关闭本问题。

本轮先记录并审计代码，不操作设备。沿用 docs/READER_REPAIR_SPEC.md §3：关闭时信息栏在系统状态栏下，开启时占用隐藏前的实际状态栏区域；控制打开时系统状态栏可见、重叠信息隐藏。切口决定不可绘制区域，不重复增加整块高度。

## 已确认的代码原因

1. ReaderLayoutGeometry 在计算了真实信息栏位置后，仍用手机72vp/平板92.44vp对正文顶部取最大值。24vp状态栏的关闭/开启正文应为56/32vp，却都被旧下限钳到72vp；真实40vp状态栏也出现只移动部分高度。已知有效状态区域现在直接使用信息栏底边加间隙，并仍避开切口；没有顶部状态区域时保留既有fallback。
2. ReaderPageChrome 顶部使用阅读器捆绑 NotoSansSC 的12fp/14.4行高，而非系统状态文字规格；横向位置又由状态区域高度的一半推算，右侧还永久保留书签槽。区域边界不是OEM字形位置，这两个消费者不能凭同一个statusBarHeight获得字体/左右精确一致。已统一系统字号资源、字体测量和OpenHarmony布局基线；系统公开窗口接口只给区域和颜色，不给OEM字形基线，真机精确像素仍OPEN。
3. 另发现窗口设置保存失败回滚时，只恢复开关/系统策略，不恢复正文排版。控制栏使系统栏保持可见时，可能完全没有后续窗口几何事件补救。实际 commitReaderWindowSettings→readingLayout→reflow 方法探针修前失败（settings-reflow-red.log），补回旧开关的重排后通过（settings-reflow-green.log）。验证双向切换×控件打开/关闭、无native resize事件、相同几何不重复重排、旧失败/卸载不干扰新生命周期，以及已提交阅读锚点不变。

当前 LRE 原有布局缓存键包含开关与metrics revision，分页窗口键包含正文top/尺寸/开关；因此复用原有窗口更新和重排路径，无需第二套状态、渲染器或缓存。顶栏渲染、文字测量及动态书签需要使用相同文字规格，避免新旧宽度并存。

交叉审查进一步复现：24vp状态区域、40vp实际AUTO文字时，只按区域底边加8vp会造成文字/正文重叠8vp。正文预算因此还接收与页面顶栏相同测量函数得到的实际title/clock高度；原状态区域仍是真实区域，文字过高只增加正文避让。LRE仅在已有布局缓存失效时测量，分页冻结/提交期的原有快照语义不变。

正文几何的原始红绿与160组样本记录见PH114_BODY_LAYOUT（原始证据仅本地保留）。设置回滚探针已接入真实顶部文字helper，通过`settings-reflow-integrated-green.log`；`settings-reflow-integrated.log`保留了一次非登录shell误用Node18导致无法加载TS的环境失败，切回既有Node26后通过，非产品失败。

## 证据边界

几何/真实生产方法/SDK本地检查通过，包含最终200组正文预算；顶部字体、边距及固定上游依据见TOP_TYPOGRAPHY（原始证据仅本地保留），资源单位与额外重叠缺口的独立复核见INDEPENDENT_REVIEW（原始证据仅本地保留）。旧已授权截图/布局仅用于解释原有计算与真实系统字形并不等价，未把其中的手机px常量写成适配规则。本轮无HDC操作；最终真机字形/边距/开关体验、用户验收OPEN。

## PH114中间产物（尚不含随后新增PH115）

290份完整Harmony合同、ArkTS检查、隔离无增量编译/签名与独立manifest复验PASS。run `20260916T154422Z-5fb96de4-be051bef`，manifest为 `.reader-artifacts/hap/20260916T154422Z-5fb96de4-be051bef/manifest.json`；signed SHA256 `95f8875abfeba9f44924384380fc6d800e057c5798c5d757daf5e482fe57edb6`，本地debug签名已验证。Harmony `5fb96de4cf322c9b4f35c558051ba1fea5196ad5`、Core `bf49495317798f68b98928712eb6e106af02bed1`均dirty，iteration / acceptanceEligible=false。记录见`hap-build.log`、`hap-verify.log`；包中Core原始输入SHA保持`73e6f206b5fa0b51c98a727f3591f4e2dee8461256421dee92efd61a8c0c9465`。未安装、无数据变更；VM/真机交互/用户验收OPEN。

构建进行时用户追加PH115“每次调整字号先错排再闪烁恢复”，已在总账记录并继续代码定位；上述中间包不包含PH115修复，不作为最终合并交付包。

PH114–PH116最终合并产物及独立验证统一记录于[DELIVERY.md](../source-switch-ph116/DELIVERY.md)。后续换源审查还补齐旧阅读实例的窗口所有权围栏，避免其退出回调覆盖新阅读实例状态栏策略；这不替代真机颜色/字形验收。
