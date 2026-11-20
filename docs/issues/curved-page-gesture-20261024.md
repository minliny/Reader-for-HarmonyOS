# 拇指圆弧滑动未触发翻页

- 用户现象：左手握持，以拇指圆弧轨迹翻页时，既未翻页，也未触发下拉书签。
- 源码基线：HarmonyOS 主工作区 HEAD `6b1bd7534b61a8ebfac10150fd308eae8430606e` 加现有 dirty WIP；本轮开始时 `ReaderPageGestureState.ts` 与对应状态测试无未提交修改。已安装包身份未核实。
- 代码定位：`applyReaderPageGestureSample` 要求 X 或 Y 分别达到另一轴的 1.5 倍，留下约 33.7°–56.3° 的未认领区；超过点击阈值后也不再是点击。`committedDirection` 又在 UP 因 Y 达到 X 的 1.5 倍而取消已认领翻页，但 owner 不转交书签。两条路径都可以无动作结束。
- 已审范围：物理输入与页面缩放坐标分离、MOVE/UP 共用状态机、一次消费、LocalReadingExperience 的分页与书签独立宿主。现有依赖无需新增；这属于 Reader 已有业务手势仲裁策略，不引入通用手势识别器。
- 本次语义：明确纵向（Y 至少为 X 的 1.5 倍）保持上下滑动作；其余达到水平确认距离的斜向归翻页。翻页认领后按原水平有符号位移提交，后续弧线的 Y 不再撤销；回到水平起点阈值内、跨过起点或系统 CANCEL 仍撤销。已认领书签不被翻页抢占，书签阈值和回撤语义保持。
- 必要验证：仅 `H-reader-page-gesture-state` / `tools/test-reader-page-gesture-state.mjs`，直接调用生产 TypeScript 状态机，无嵌套测试、SDK、构建、设备或网络动作。覆盖斜向空档、先水平后纵向弧线、左右镜像、MOVE/UP 稀疏采样、物理坐标、回撤/取消及书签边界。因归属与 UP 提交条件本轮变化，该检查不可省略；不执行其他门禁。
- 尚未解决的证据：用户真实触摸轨迹未采集；明显纵向起步且已发布书签反馈的动作仍按书签处理。本地合成轨迹只能证明代码决策，不证明用户手感。HAP、安装、VM/真机及用户验收均 NOT_RUN / OPEN。
- 旧源码复现：新回归在 `UP(-8,1200)` 处失败（期望 next，实际 undefined）；另以 `(-8,8) → (-20,22) → (-40,46) → (-64,72)` 直接调用生产函数，得到 `owner=undecided, direction=null, bookmark=false, rollback`。两个代码缺陷分别有本地反例。
- 修复：水平认领改为明确纵向扇区的补集；已认领水平翻页删除末端 Y 否决。其他阈值、状态字段、宿主接线与书签逻辑未变。
- 本项测试定义复审：原断言要求斜向不认领、已认领翻页遇纵向末端必须撤销，与本次修复语义相反，已明确更新这两类预期；其他原有边界断言保留。新增两组固定曲线路径，覆盖左右/上下镜像和可变/不可变两条生产调用路径，另检查 UP-only、明确纵向边界及同轨迹回撤/跨起点/CANCEL。预期来自上述交互规则，不使用实现函数计算期望。无新增依赖、fixture、嵌套入口或默认触发。仅更新 `H-reader-page-gesture-state` 的语义证据和该已复审定义指纹，未重新封存其他项。
- 本地结果：修复后 `node tools/test-reader-page-gesture-state.mjs` PASS；本次变更的 `git diff --check` PASS。精确索引入口 `H-reader-page-gesture-state --run` PASS（114ms，仅1项），日志 `/var/folders/53/6tc2ktbd19dbwxd5pmbp0d_w0000gn/T/reader-contract-run-YnlgJF`。全量、打包、安装与设备交互未执行。

## 完整触发链优化（用户批准“全量优化”）

- 审计新增问题：早期18vp纵向样本可将随后左弧线锁成书签或上一页；动画结束会把尚未释放的输入起点重设，吞掉点击/40vp滑动；120vp拖动退回9vp仍提交；书签峰值48退25提交、峰值200退99取消；tracking阶段错误关闭长按选字；邻页预排阻塞稳定页面的书签；同向连续划动可能接管旧页而非新增翻页。
- 本轮实现规则：横向16vp确认；纵向MOVE在32vp前保持候选，UP仍按动作距离确认（上滑24、书签48）。认领后不跨动作抢占。翻页反向回撤24vp撤销，重新沿原方向推进16vp且满足动作最小距离才恢复提交；轻划8vp保留。书签48vp进入待提交，回到32vp以下退出，横向偏离退出后须重新回到较明确下拉方向才能再进入。
- 输入交接：忙碌期间的整段手势保留到UP；动画结束不重设起点，不把旧书签下拉变成延迟写入。同向划动累计，反向MOVE才允许接管尚未提交的可见页面；接管保持可见位置。
- 宿主：未认领tracking/longPress保留选字，正式拖动/settlement仍关闭选字；书签准入复用现有安全暂停邻页预排，再核对当前页与写入身份；移除提示明确为“本页书签”，保留本页多书签的既有删除语义。系统边缘和连续滚动的专属手势保持，避免新增冲突。
- 复用评估：已检查Host依赖（无第三方手势库）与现有原始事件入口、原生Text/List、状态机、邻页暂停、写入owner；本次仅修改Reader业务仲裁，不引入或重写通用识别算法。未扩大到漫画独立阅读链。
- 执行前验证清单：`H-reader-page-gesture-state`（生产纯状态，验证候选/回撤/书签迟滞）；`H-reader-page-input-runtime`（真实输入方法及受控事件、计时器，验证动画交接/指针/边缘/长按）；`H-reader-text-selection-lifecycle#owner-dismissal`（实际Host许可和正文关闭方法，验证tracking不会自我禁用）；`H-reader-bookmark-top-info#transaction`（实际Host书签准入/回弹/ACK顺序及重抓，验证预排暂停和保存身份）。以上均无嵌套测试/设备/网络/Core构建；仅所选transaction的既有支持模块按其加载要求解析，不运行geometry/subscription或兄弟case。测试定义变化只复审上述具体项，不扩展门禁。
- 验证中发现的问题、修正和最终结果在下方追加；HAP、安装、原生事件/视觉与用户手感保持OPEN。
- 首轮：状态机与选字owner定向检查PASS；输入runtime在缩放重抓用例失败（预期next，实际撤销）。原因：新增回撤峰值由Host的stage位移初始化，Interaction仅换算原有inputOffsetX，导致峰值与后续物理输入混用。需同步换算重抓峰值、回撤基点和待提交状态，再复验此项。
- 换算修复后输入runtime PASS。书签transaction的MOVE不重复扫描断言失败：fixture仍在24vp未认领阶段手动调用已认领预览的渲染方法，触发正常canonical读取。将其“已认领MOVE”序列首点改为32vp，并另以真实输入runtime验证32vp前仍是候选；不删除扫描断言。其他身份/ACK/回弹断言保持。
- transaction后续暴露已有位置修复的fixture漂移：隐藏状态栏、页面未下移时，现有源码正确使用短反馈，但旧fixture仍要求顶部纸面提示。将纸面计时器用例设为显示状态栏的有空白场景，并新增隐藏状态栏的短反馈断言；不修改并行工作已完成的提示位置逻辑。
- 同/反方向接管规则放在新的手势入口 `regrabReaderPageGesture`；既有 `regrabPageTurn` 的5参数settlement接管方法和自动翻页协议保持，避免把本次输入优化扩散到Native首帧/持久化路径。
- 测试定义复审：只更新上述4个ID对应定义与语义证据。原点击/物理阈值/系统边缘/取消/一次消费/ACK身份断言保留；新阈值预期来自本轮交互规则，未从实现反算预期。两个case的公共辅助文件已有并行修改，仅为`foundationSpecs`额外导出两个搜索尺寸函数；未改变既有返回函数、断言、调用范围或计时器，已核对仅这两个case的依赖身份。其他case及父项不重新封存、不执行。
- 对照诊断：以内存加载HEAD旧生产状态机和当前状态机，向下切线圆弧由无动作变next，向上切线圆弧由previous变next，120vp退9vp由next变撤销；书签48退25由提交变撤销、200退99由撤销变提交。均为代码合成轨迹证据，不等同原生手感。
- 索引首轮未派发：runner的case资源清单还保留两个已修改测试文件的旧sourceSha256；四项索引定义检查通过后，在派发前停止。复核两文件仅增加受控事件/真实方法调用，无新增资源、case、嵌套测试；同步两项文件级资源身份与所选case的资源指纹。未选兄弟case保留旧定义与资源指纹，不能因此免复审执行。
- 最终结果：四项直接定向执行PASS；同步已复审登记后，精确索引执行4/4 PASS：gesture-state 103ms、input-runtime 98ms、owner-dismissal 101ms、bookmark transaction 853ms。日志目录 `/var/folders/53/6tc2ktbd19dbwxd5pmbp0d_w0000gn/T/reader-contract-run-2sm9BZ`。`git diff --check` PASS；保留现有其他dirty WIP，未提交。
- 交付边界：本轮完成小说分页/书签触发链源码优化及上述本地验证；连续滚动、系统边缘、漫画独立输入和原自动/Native settlement协议未扩展。全量测试、完整ArkTS构建、签名HAP、安装、VM/真机视觉交互与用户手感验收均NOT_RUN / OPEN；当前设备不能据此认定已更新。
