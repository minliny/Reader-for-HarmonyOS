# UI 框架精确检查定义审查

日期：2026-11-08。本记录审查检查本身的输入、作用和反例，支持当前两个叶入口的选择资格；不代表产品、原生布局、持久事务或发布验收。

## 选择与范围

| 当前入口 | 资格 | 实际保护范围 |
|---|---|---|
| `H-architecture-shared-producers#ui-boundary` | QUALIFIED | 当前公共UI与非UI平台的直接依赖、静态导出及公开类型/值转发；窗口指标既有读口限明确的`metrics()`调用 |
| `H-architecture-shared-producers#settings-arguments` | QUALIFIED | 下列设置与手机底栏实际调用的公开字段、准确参数表达式和传播链 |
| `H-architecture-shared-producers#navigation-owner` | NEEDS_EVIDENCE | 已有直接结果，但动态装配probe的全部定义闭包未在本轮复审，保持待审 |

默认执行均保持OFF。不新增自动全gate、构建或安装触发；使用现有显式选择入口。两个叶的当前定义摘要与资源声明分别登记，不借用历史button/choice/icon身份。

本文件的整个测试脚本身份已经变化。`contract-case-manifest.json`刷新当前文件摘要时，将未复审的button/choice/icon声明标REVIEW_NEEDED、navigation-owner标NEEDS_EVIDENCE；仅上表两个已复审叶为QUALIFIED。历史gate条目的原批准与definitionInputs不改，不能用新文件摘要重签旧用例。

## ui-boundary实际机制

现用ETS SDK解析器读取`entry/src/main/ets`，扫描`ui`及遗留共享UI、`platform`的真实导入。解析相对路径、bundle路径、动态字符串导入、类型导入、具名/默认/namespace/star转导出。非字面动态路径和无法分类或解析的本地路径明确失败。

转发追踪包括类型别名、联合/泛型包装、接口及继承、typeof/import-type、常量别名链、显式工厂签名、公开类签名及字段初始化器、对象/数组的直接别名。按具名导出追踪，安全导出不因同一文件另有被禁止的导出而一并失败；循环有访问键终止。

既有窗口环境口不是整个app owner豁免：只有直接具名导入（可别名）的`ReaderWindowCoordinator.metrics()`调用被接纳，brightness/detach、方法/类值逃逸、namespace、转导出、动态模块和其他app窗口类型仍拒绝。生产窗口owner与UI消费者不改，不新建环境事实源。

该规则不解释任意运行时函数体或推断工厂返回，也不证明跨进程、原生焦点、业务准入或所有传递依赖。静态转发检查与ArkTS类型检查、真实owner和设备验收分别记账。

## ui-boundary反例与正例

本轮使用同一现用SDK解析器先复现5类静态漏追，另复现箭头/函数表达式的显式返回签名漏追，随后在现有case内补齐，不新建第二个检查引擎。

负例覆盖直接/别名业务导入、app owner、非字面动态路径、类型转发、值别名链、公开类型化值、继承与字段、具名/匿名默认工厂、typed arrow/function、对象与数组别名、窗口写入或逃逸，以及非UI平台导入公共或功能UI。安全具名导出、局部泛型遮蔽、namespace内的安全类型、直接别名窗口指标读取仍通过。

独立只读审查指出窗口全文件豁免和typed factory/公开字段的遗漏；最终源码已收紧窗口例外，补签名和static/instance字段负例。审查不把未执行的推断称为运行失败。

## settings-arguments实际机制

`verifySharedProducerInputCalls`只解析选定真实producer/consumer的SDK AST，检查显式有限Props、公开字段、重复/未知字段和调用存在；本case再核对所列表达式。它不冻结整份组件实现或全应用样式预算。

实际链路为`SettingsScenes → SettingsPage → SettingsShell → MainTabShell → ReaderBottomNavigation → ReaderBottomTabBar`；另外核对StandardPage/Scaffold的几何和测量接线、书架设置返回、受控Toggle和主题/书架显示方式两条分段选择。

四个实际源码变异分别覆盖漏掉既有预算、错误选择值、导航代次固定为0、底栏输入资格强制true，均要求拒绝。宽屏没有执行或采用结论；保留原源码分支的参数声明检查不等于验证宽屏布局。

该case不能证明所有公共API、ArkTS类型、运行时测量、Preferences读回或输入法/焦点。原业务owner仍裁定值和回执。

## 定义、资源与执行边界

共同定义闭包为现有case选择器、测试脚本、shared-producer输入解析、ETS compiler/runtime位置解析及生产工具链/开发环境解析；ui-boundary另含shared-ui-boundary。对应文件摘要在gate条目的definitionInputs逐项冻结。

需要支持当前脚本的Node及实际Harmony ETS loader。`resources: []`表示不需要Native/shared-build/network-fixture互斥资源，不表示无需SDK。两个叶不调用Native、HAP、VM、网络fixture或兄弟case，不因选择失败扩大范围。

实际执行的候选源码、工具摘要、日志和精确runner结果另记于工作区[本轮框架收口记录](../../../.local/ui-api-closure-20261108/)。当前资格只说明上述定义可被明确选择；编译、产品范围与完整P/F验收仍有各自证据。
