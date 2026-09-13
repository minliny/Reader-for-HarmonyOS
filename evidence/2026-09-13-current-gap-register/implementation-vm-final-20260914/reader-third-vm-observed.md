# 第三包五模块收起独立观察

仅本地读取落盘文件；未HDC、未写活跃probe。范围为auto/settings/appearance/tts/directory的quick/full/collapsed 15份JSON及auto-full、directory-collapsed PNG。

五项均真实由(1118,510)收起按钮回同模块Quick：每对Full→collapsed之间仅一次成功click，无Back/额外手势；Full按钮在可见bounds内，Header祖先Default；shell由[46,388][1235,2734]回[46,1579][1235,2734]，content由[92,588][1190,2689]回[92,1681][1008,2346]。Header有效opacity归0或小于0.0004，底导航恢复。15份可见正文/页码hash一致，footer仍3/4，没有点穿翻页迹象。不是7模块全通过，也不证明连续动效流畅度。

目录独立现象必须保留：原Quick可见146(部分)至150；Full可见139(部分)至150；收起后139(部分)至143，PNG可读140–143。当前正文150没有变化。Full视口扩大造成尾部native钳制本身合理；源码在Full端点清空leadingRow/Key，令收起重新捕获钳制位置，现已通过实际生产方法探针确认并定点修复，详情如下。原已安装包的列表保位不算通过。

逐文件SHA、有效祖先opacity、Header bounds、操作回执、正文hash见同名JSON。没有修改生产或用户数据（本观察阶段）。

## 目录尾部锚漂移：已定位并修复，待下一包

安装身份已从不可变manifest核对：Harmony 9509d4feb410ce559d67b77785e2248e88485f4e / Core 952704bd5，run 20260913T160039Z-9509d4fe-25529e1f。本次补修在该已安装包之后，不能冒充第三包已含修复。

依据：READER_REPAIR_SPEC §C04/C05要求深目录fraction/动画中数据变化固定可见锚、不回顶部；既有生产方法已明确保存leading row key+fraction，不用estimated absolute offset。此次不否定Full变高时有限List必须向尾部钳制，而是保护该暂时钳制前的语义意图，在无用户滚动的Quick→Full→Quick往返后恢复原位置。

根因：ReaderControlDirectoryContent.queueLeadingCorrection与onInputChanged在Full或Quick端点无条件清空leadingRow/leadingKey；Full变高后原Quick末尾锚无法处于顶端，native合法变成约138.69行，端点却丢弃原145.59行意图。收起时再捕获138.69行，于是Quick从146–150变成140–143。这是往返锚退化，不是正文翻页或只因可见范围增大。

正式回归扩在既有test-reader-control-directory-model.mjs，抽取真实生产方法，使用150行和VM可用高度（Quick190vp、Full2101/3.5vp）以及有限List的真实offset上限。修前原Quick4659，往返4438.171428571428，准确复现约七行上移；原始失败见reader-directory-tail-anchor-before.log。

修复只改ReaderControlDirectoryContent：复用原真实getItemRect与0.5px容差判断，当native行高/行内fraction已对齐才释放语义锚；被尾部钳制或未测量时保留到后续反向恢复。用户真实滚动、新session/tab仍按旧逻辑清空；已对齐端点也照常清空，避免旧锚事后复活。无共享Panel、资源、主题、业务和输入改动。

新增8个有限视口场景：目录/书签各自尾部往返及Full用户滚动接管，内部0/.25/.8 fraction三组，未到Full就反转一组。全部通过；原端点释放用真实已对齐rect验证，未删掉这一保护。另Header几何+真实SDK闭包往返、Host session、五组件morph scroll三个相关文件通过。日志路径和SHA在同名JSON。没有运行全量门禁、ArkTS构建、签名或新包VM，不声称此次补修原生画面已通过。

生产和正式测试两个文件已冻结，无Git/HDC操作；需root提交后按正常流水线构建，最小下一包VM只回答目录Quick146–150→Full→按钮收起后是否回原Quick锚，并补一次Full用户滚动接管确保不被旧锚拉回。
