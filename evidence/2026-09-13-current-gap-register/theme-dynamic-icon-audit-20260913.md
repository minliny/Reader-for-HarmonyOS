# 夜间动态 SVG 漏接：当前代码与修复记录

## 原始现象

二包 `a91af09f`（`b17f29a4` 仅为采集文件命名前缀，不是安装源码） 的 `implementation-vm-followup-20260913/reader-control-b17f29a4-20260913-theme-night.png/.json`：底部目录/朗读/设置仍蓝绿色，界面选中图标仍浅白色；对应背景与文字已经切到 Night。

原图中 native Image bounds 分别为 `[209,2488][293,2572]`、`[480,2488][564,2572]`、`[750,2488][834,2572]`、`[1021,2488][1105,2572]`。像素采样前三个未选中图标的纯色分别包含822/1230/1448个 `#2F6373` 像素，选中界面含1379个 `#FFFAF4` 像素。

## 已定位根因和既定映射

- Panel.moduleIcon 只看选中状态，不看 App scheme。动态模板拼出的资源名绕过了此前只发现 `'app.media.xxx'` 的生成器。
- 已定 §2.3 / `theme-control-role-mapping.md:92/124`：控制主色 Day #2F6373 → Night #D2BD96；亮控制主色底上的选中前景 Day #FFFAF4 → Night #1C1A18。不新定义颜色，不改 path、尺寸、fill-none、stroke、alpha。
- `rc_list_theme_night` 已存在但未接。其余3个未选中、4个选中资源缺Night变体。
- SDK AST 枚举当前全部 `.ets` 的动态 `$r`，共6个实际调用点：Panel.moduleButton、Panel.quickAction、MainTabBar.tabIcon、ReaderDirectoryModulePanel.downloadMarkerHitTarget、FullDirectoryPanel.downloadMarkerHitTarget/bookmarkMarkerHitTarget。
- 同类遗漏：Quick搜索/自动翻页/替换应Night ink #EADFCE；App底部4个未选中outline应Night muted #BAAD9C，4个active白色配primaryDark沿用；目录下载/空书签应muted、完成/已有书签应primary。全部有既定角色，不改变功能或形状。

## 修复范围及边界

- 生成器只增加“完整源码字符串恰好匹配现有SVG文件”的发现；不执行源码、不推测未知拼接、不引入通用解析器。
- 6处动态消费者以当前有限状态集执行生产方法/SDK Builder并检查实际资源与既定颜色，新增动态 `$r` 调用点必须进入回归清单；未来外部数据或任意字符串拼接的资源无法单凭字面量静态保证，必须显式登记可达资源及测试，不得把这类未知算通过。
- 修复已完成并冻结。原VM失败与本地回归分开记录；新包VM确认由root统一执行。

## 完成项与本地门禁

- 生产接线：ReaderControlPanel仅quickAction图片调用及quickActionIcon/moduleIcon；MainTabBar仅tabIconResource；ReaderDirectoryModulePanel仅downloadMarker；FullDirectoryPanel仅downloadMarker/bookmarkMarker。未改Panel Header、时长、布局或触摸行为。
- 新增13个Night SVG：控制导航原缺7个、Quick自动翻页/替换2个、App底部未选中outline4个。其它已有Night资源直接复用。
- 生成器此次额外发现17个原先遗漏的完整裸名称：其中13个需派生，4个App选中白色保持同值不派生。共享Reader-UI/theme/registry.json及两个ReaderThemeRegistry.ts镜像已同步；当前576个App角色×2、8个阅读主题。
- 原版新增回归首先失败于 `reader_directory_list_active` 在Night仍输出 `#FFFAF4`，期望已定onControlPrimary `#1C1A18`。修复后 `test-theme-dynamic-icons` 101个实际状态/颜色案例通过：6个动态入口全部枚举，SDK Builder保留挂载跨Day/Night/Day及选中切换、实际SVG非颜色字节完全相同、目录生产方法、生成器真实--list发现与manifest一致。输出 `theme-dynamic-icon-builder-after.json`。
- 漂移检查通过：generate-theme-icons --check（165个变体）、generate-theme-registry --check（双镜像）、test-svg-provenance（350个资产）。
- 受影响回归通过：reader-module-selection（改成执行真实生产方法验证Day/Night，保留轮廓来源约束）、reader-directory-markers、reader-bookmark-panels、icon-design-contract、theme-local-consumers、reader-control-input-routing。
- `SVG_PROVENANCE.json` 中既有Night条目的registry hash随新增角色更新；资源path/alpha未变，不是重新画图。
- 待统一ArkTS、新包和VM图像验证；本地通过不标为VM或用户验收通过。
