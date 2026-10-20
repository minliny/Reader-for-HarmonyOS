// Cross-platform delivery decisions. These values do not describe installed devices.
export const profiles = [
  {id:'phone',label:'基准内容窗 390 × 844',width:390,height:844,platform:'content',insets:[0,0,0,0]},
  {id:'small',label:'窄窗 320 × 640',width:320,height:640,platform:'content',insets:[0,0,0,0]},
  {id:'ios',label:'iOS 安全区样本 393 × 852',width:393,height:852,platform:'ios',insets:[59,0,34,0]},
  {id:'android',label:'Android 手势样本 360 × 800',width:360,height:800,platform:'android',insets:[24,0,24,0]},
  {id:'android-buttons',label:'Android 三键样本 360 × 800',width:360,height:800,platform:'android',insets:[24,0,48,0]},
  {id:'landscape',label:'横屏安全区样本 844 × 390',width:844,height:390,platform:'ios',insets:[0,59,21,59]},
  {id:'wide',label:'宽窗 760 × 960',width:760,height:960,platform:'content',insets:[0,0,0,0]},
  {id:'tablet',label:'平板类型样本 760 × 960',width:760,height:960,platform:'content',deviceType:'tablet',insets:[0,0,0,0]},
  {id:'split',label:'分屏 600 × 640',width:600,height:640,platform:'android',insets:[24,0,24,0]},
];
export const platformRules = [
  ['单位','尺寸：1 vp 对应 1 iOS pt / Android dp；基准字号：1 fp 对应 1 pt / sp。像素按屏幕密度换算，禁止把整张 390 稿缩放铺满。'],
  ['坐标','W/H 为当前应用窗口；S=(top,right,bottom,left) 为运行时安全区。普通页上界避开 S.top；背景铺满窗口。横向边距 max(原边距,S.left/right)，不重复相加。'],
  ['底部','浮动主导航底距 B=max(15,S.bottom)，内容尾部留白=68+B+16；没有主导航的操作条用 max(原底距,S.bottom)。内容能滚到最后一项。'],
  ['键盘','K 是键盘遮挡的底部高度；可编辑页有效底界 H-max(S.bottom,K)。输入框、确认按钮和错误文案在此范围内；浮动键盘按遮挡矩形滚动避让。安全区只能消费一次。'],
  ['阅读','纸面背景及图片绘制可延伸至窗口边缘；正文、元信息、控制栏与命中区按阅读几何和实时安全区定位。全屏切换重新测量，保留文本锚点。'],
  ['宽度','书架源码按W≥600进入宽版；搜索源码由deviceInfo的tablet决定。移植决定统一以可用窗口W≥600选择搜索宽版，避免分屏仍套设备大屏布局；只有有书书架显示侧栏。其他页面不自动改双栏。'],
  ['触摸','保持图标视觉尺寸；移植的最小触摸目标 iOS 44×44、Android 48×48。优先整行/整卡命中；紧邻小控件重排间距，禁止命中区相互重叠。'],
  ['返回','阅读控制内：临时层→模块 Full→同模块 Quick→控制首页→隐藏控制层→退出。忙状态按各模块真实 guard 决定，不能统一禁用所有返回；设置恢复只禁页面控件，Index 系统返回仍能回首页。IME 是否先消费系统返回由各端验证；交互式返回提交前不写业务结果。'],
  ['系统界面','文件选择/保存、系统确认、登录 Web 容器、语音服务和亮度由各端 Host 实现相同意图及结果。系统弹窗与键盘使用本端外观；应用自绘表面保留当前主题/字体/SVG。'],
  ['系统栏','自绘顶栏/浮动导航不叠加目标系统默认导航栏；系统状态栏/导航区背景延续当前paper。浅色背景使用深色系统glyph、深色使用浅色glyph，主题/全屏变化由Host重新应用并测量。'],
  ['可访问性','整行开关作为一个语义节点，暴露名称/开关值/禁用/选中；装饰SVG不单独朗读，纯图标动作有完整中文名称。弹窗焦点进入标题及第一项，关闭返回原触发控件；异步失败读原提示，不抢走草稿焦点。'],
  ['减少动态效果','移植effectiveReduceMotion=应用已存偏好 OR 系统减少动态效果。移除非必要位移/周期波形，保留颜色与状态反馈；业务计时/取消/回滚仍按回执处理。'],
  ['语言与输入','交付基准为当前zh-CN文案与简体中文字形；保留书名/来源/正文中的其他Unicode字符。URL/JSON/密钥沿原字段输入语义；输入法composition期间不提交半成品查询，原未开放语言设置不新增入口。'],
  ['生命周期','进入后台、旋转、分屏、键盘切换不重新执行导入/删除/换源；草稿、选中项、原结果与阅读锚点归 owner 保留。迟到回调按原调用链拒绝覆盖新上下文。'],
];
export const fontProbes = [
  '山间札记 · 第三章 山路',
  '天地玄黄，宇宙洪荒。书架、目录、朗读与设置。',
  '（括号）「引号」《书名》……破折号——与标点。',
  'Reader 1.00x · 1278 / 1294 · 37.5% · ABCxyz',
  '超长书名用于检验单行省略与尾部操作保留的布局情况',
  'https://source.example/a-very-long-path?keyword=山路&chapter=第三章',
  '扩展字𠮷、组合字符é、emoji📚；缺字必须回退，不能丢字符。',
];
export const acceptance = [
  ['应用画面','全部可达页面/组件 × 全部已有状态 × 浅/深色，基准内容窗390×844。使用同一夹具、主题、字体文件和源码指纹。'],
  ['响应式','全部界面默认状态在320×640、760×960；书架与搜索另查599/600/601边界。有书/无书、封面/列表分别检查。横屏/分屏检查所有固定底部区域。'],
  ['系统适配','两端实际安全区、手势/三键导航、软键盘/浮动键盘、最大系统字号、屏幕阅读器及减少动态效果。预览中的安全区数字只是压力样本。'],
  ['布局门槛','基准自绘矩形边界误差≤1逻辑单位；图标形状/资源与颜色token完全一致；固定尺寸、对齐、圆角、按钮数量和文案按逐页规格。阴影/抗锯齿用截图复核，不用全图差异百分比掩盖几何错位。'],
  ['文字门槛','基准角色字号/字重/字族/显式行高一致；文本起点与基线误差≤1逻辑单位。AUTO行高要各端记录实测值。单行省略/多行上限一致；正文锚点一致，分页页数不是跨端位置身份。'],
  ['动效门槛','自定义动画起止几何符合源码公式；时长偏差≤一帧（按实际刷新率）；中途反向/打断无闪白/回跳/重复提交。OS键盘动画与系统返回不套自定义时长。'],
  ['数据门槛','截图不能证明导入/存储/下载/登录成功。逐行为验证成功、失败、取消竞争、迟到回调、离页与恢复；事务目标保留原内容及可重试范围，符合准入的 ordinary 阅读允许先呈现后异步保存。'],
  ['原生记录','每条原生记录附平台/OS/机型或模拟器/密度/窗口/安全区/系统字号/主题/减少动态效果/源码commit+dirty指纹/截图或视频。未经记录的格子保持未验证。'],
];
export const sharedGeometry = [
  ['首页顶栏','高58；左右max(20,S.left/right)，顶内距6；标题29/38、700、Noto Serif Bold；单行省略。'],
  ['返回顶栏','高58；返回命中44×44、图标24、圆角22；标题24/33、700；左右max(20,S.left/right)，标题占剩余宽度。'],
  ['主导航','底栏最大宽360、高68、圆角24、边框1；2项均分；项高54、图标24、文字11/18 700。宽书架侧栏82×332，项66×58。'],
  ['弹窗','按 ReaderSurfaceSpecs / 各领域组件分别实现，不能统一套352宽/16圆角。book-removal上限306/边距20/padding17/r12；JSON导入上限520/边距20/padding16/r14；默认分组75%宽/padding20/r20。'],
  ['按压','ReaderPressFeedback：TOK_ACCENT的12%alpha混合到本色；按下/取消/松开由控件事件恢复；不擅加缩放或Material波纹。禁用透明度沿各组件值。'],
  ['资源','使用资产清单对应SVG与主题变体，contain保持viewBox比例；选中主导航仍用outline，禁止替成filled。字体与OFL许可一起打包。'],
];
export const typographyRules = [
  ['基准','scale=1；使用同一文件和真实字重。显式lineHeight与字号分别传入；AUTO保持AUTO，不能拿fontSize×1.5代替。字距未设置时保持默认，不追加tracking。'],
  ['iOS缩放','系统角色用UIFontMetrics按角色映射：首页/页面→title1/title2；section→headline；tab/元信息/小字段→caption1；其余→body。阅读正文由已保存appearance字号/行距拥有，系统缩放不再乘一次。'],
  ['Android缩放','系统角色用sp及平台sp换算，行高也用sp；尺寸/边距用dp。Android非线性字体缩放不可用单一fontScale乘法复制。阅读正文appearance字号转dp物理度量，避免双重缩放。'],
  ['回退','Inter缺少的CJK先回退当前Noto Sans SC；Noto Serif缺字→Noto Sans SC→平台CJK/emoji。自带文件加载失败改平台字体并记录校准未通过，不静默宣称像素还原。HarmonyOS Sans只能在Harmony使用；两端对应系统sans，此槽单独原生校准。'],
  ['换行','UI单行按源码maxLines=1尾部省略；说明/错误按字段约束自动换行，URL允许字符边界断行。正文保留段落/硬换行，不插全角空格假冒缩进；禁则/塑形复用平台文本引擎。'],
  ['大字体适配','按缩放后实测文字撑高行/按钮/顶栏；动作行无法容纳则换行或纵排。可滚动正文区域承担溢出；长书名仍可省略，动作标签、确认与错误不裁切。此为移植规则，非现有Harmony已验收行为。'],
  ['位置保护','字体、宽度或系统栏变化前保留Core文本锚点，重新测量后恢复；不以旧页码/滚动像素作为唯一位置。预览压力倍率1/1.3/2只检查溢出，不冒充原生Dynamic Type曲线。'],
];
export const platformSources = [
  {label:'Apple safeAreaLayoutGuide',url:'https://developer.apple.com/documentation/uikit/uiview/safearealayoutguide'},
  {label:'Apple UIFontMetrics',url:'https://developer.apple.com/documentation/uikit/uifontmetrics'},
  {label:'Apple 触摸与可访问性',url:'https://developer.apple.com/design/human-interface-guidelines/accessibility'},
  {label:'Apple keyboard layout guide',url:'https://developer.apple.com/documentation/uikit/adjusting-your-layout-with-keyboard-layout-guide'},
  {label:'Android WindowInsets',url:'https://developer.android.com/develop/ui/compose/system/insets'},
  {label:'Android 字体非线性缩放',url:'https://developer.android.com/about/versions/14/features#non-linear-font-scaling'},
  {label:'Android 触摸与语义',url:'https://developer.android.com/develop/ui/compose/accessibility/api-defaults'},
];
