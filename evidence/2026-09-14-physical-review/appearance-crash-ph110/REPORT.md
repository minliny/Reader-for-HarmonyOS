# PH110 快捷控制栏“界面”入口闪退

用户在真机安装 `20260916T043101Z-5fb96de4-ae46eea4` 后报告点击快捷控制栏“界面”闪退。安装与启动已确认，具体现场异常栈未取得。当前源码为 Harmony `5fb96de4` + PH104–109 工作树修复，Core `bf4949531`。

先审计真实入口、ReaderControlAppearanceContent Builder、字体槽与尺寸计算、缓存依赖和本轮字体相关 diff，并用当前生产方法和 Harmony SDK 编译探针验证。尚未操作设备；源码定位、本地测试、产物和设备行为分别补记。

## 代码根因已复现

PH106 新增独立 `custom` 字体按钮后，导入字体用户的字体槽从 9 个变为 10 个；`extendedThemes()` 因字体溢出返回 true。旧 `aboutToAppear()` 随即调用 `syncExtendedThemeScroll()`，此时原生 Scroll 尚未挂载/绑定，直接读取 `scroller.currentOffset().yOffset` 抛出 `TypeError: Cannot read properties of undefined (reading 'yOffset')`。

本机 SDK `/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/component/scroll.d.ts:625–634` 明确规定未绑定时 `currentOffset()` 返回 void。没有假定未绑定平台结果为零，也没有借清除已导入字体绕过问题。

完整生产组件（全部 135 个成员）经实际 Harmony SDK 编译，使用 SDK Property/Watch 类执行构造、aboutToAppear 和 initialRender：默认字体正常；custom + 未绑定 Scroller 在快捷/完整两个端点稳定复现同一栈；custom + 已绑定正常。另在默认/custom 下修改真实 motionProgress 属性，SDK Watch 均能在未绑定时复现。已有字体几何计算所有端点均为有限值，无 frame/fontIds 递归，构造字段也都在 Watch 注册前初始化，排除了这几条候选路径。

**这是上一轮 PH106 字体修复触发的回归。** 原测试覆盖了 fontCell、数据和几何，但没有执行整个组件首次生命周期及未绑定的原生控制器边界。279 组检查和编译成功没有证明这条运行路径安全。本轮补完整组件回归；不把平台 stub 的结果冒充已取得真机崩溃栈。

## 修复范围

- 首次滚动同步移到实际 Scroll 的 onAppear，不再在组件 aboutToAppear 读取未绑定控制器。
- Appearance 的同步、扩展同步和滚动回调均先验证当前位置存在且有限；未知时提前返回，保留上次有效滚动状态，不发布错误位置，不发 scrollTo。
- 独立审计发现 Settings、TTS、AutoPage、Replace 的同步同样直接解引用未绑定控制器。原方法探针 5/5 失败，见 同类边界基线（原始证据仅本地保留）。本轮一并保护这四个模块的同步/滚动回调、相关播放控件位置报告和 Replace 源变更；它们是本地确认的同类代码隐患，不称已经观察到四个额外真机闪退。
- 保留字体文件、独立 custom/导入按钮、字体选择、排序、既有动效几何和滚动位置。复用平台 Scroller 与既有滚动状态策略，仅修 Reader 的生命周期适配，无新增依赖或通用算法。

## 验证边界

修前 完整组件基线（原始证据仅本地保留） 8 个组合中 2 个 custom/未绑定组合失败；真实 Watch 基线（原始证据仅本地保留） 8 个组合中 4 个未绑定组合失败。原始生产文件保留于 `baseline/`。

修后新增 `tools/test-reader-appearance-lifecycle.mjs` 完整执行 135 个生产成员及 SDK Property/Watch：默认/custom × 快捷/完整 4 个组合均 PASS；每组覆盖构造及 aboutToAppear 不读未绑定控制器、初次渲染前/后/退出后的 Watch 与滚动回调在 undefined/NaN/Infinity 时保留状态且不发命令、真实 SDK Scroll.onAppear 绑定后恢复 96vp 位置、127/130 个面板节点保留、选字体与导入动作独立。见 完整组件修后结果（原始证据仅本地保留）。

共享滚动回归新增 5 个面板的未绑定/非有限位置门禁，同时保留展开收起、反向拖动、滚动复位和已绑定状态测试。见 共享滚动回归（原始证据仅本地保留）。关联 appearance-theme-extension、global-presentation、PH104–108、search-publication、search-boundary、capsule-page-turn 均通过。整套 Harmony 280 组检查、ArkTS 编译、非增量打包和签名完成，独立产物复验 PASS，见 构建记录（原始证据仅本地保留）和 复验记录（原始证据仅本地保留）。构建仍有 SDK/现有源码警告，完整保留于日志；本轮没有修改 Core，也没有重跑 Core 全量测试。

平台 Scroller、UIContext、字体注册和子控件由探针替身提供；业务成员、SDK 编译及 Property/Watch 采用实际代码。当前确定了未绑定返回 undefined 时的抛错链；没有取得这次用户现场原生崩溃栈，没有额外真机交互复测。设备视觉/交互与用户验收分别保持 OPEN。

## 本轮产物

- run：`20260916T045509Z-5fb96de4-a001d8e7`，iteration，`acceptanceEligible=false`；包含 PH104–110 修复。
- Harmony：`5fb96de4cf322c9b4f35c558051ba1fea5196ad5` + dirty 工作树；Core：`bf49495317798f68b98928712eb6e106af02bed1`，clean。
- 构建输入指纹：`a001d8e7eab52aa2e33c3b46830f98b240644cd3a0dc9de51c8632cc2675207c`。
- signed HAP SHA-256：`e1dd1b87673f45b97f2f336d54c9f348b9313dd87567dbac9c451c59cb652b71`。
- 不可变产物清单（原始证据仅本地保留）。清单的设备状态是构建时快照，后续安装结果另记部署回执，不回写清单。

## 安装预检记录

沿用用户刚才“安装到真机”的要求，为同一台手机保数据更新修复。重新发现目标后锁定原目标设备，回执仅本地保留，未操作并行存在的 VM。首次只读启动检查遗漏 HDC 自身的目标参数，返回 `ExecuteCommand need connect-key`，没有设备命令执行；修正为明确指定同一目标后返回 `bootevent.boot.completed=true`。这次是命令参数错误，不是应用或设备故障。后续仅做包身份预检、保数据更新和启动，不增加交互抓取。

北京时间 **2026-09-16 12:58:40**，新 run 已在同一台物理设备完成保数据覆盖安装并启动。签名前后身份一致，`dataPolicy=preserve`，`install=PASS`，`launch=PASS`。没有卸载、清数据或额外功能操作。

- 设备与签名预检（原始证据仅本地保留）：`matching-identity-signed-update-candidate`，`preservesData=true`。
- 安装日志（原始证据仅本地保留）。
- 原目标设备，回执仅本地保留。

本轮确认到安装/启动；修后真机点击“界面”及视觉交互未代用户复测，`featureInteraction`、`userAcceptance` 仍为 OPEN。
