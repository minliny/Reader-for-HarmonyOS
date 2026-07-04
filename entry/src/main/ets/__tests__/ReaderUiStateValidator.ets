import { ReaderMotionId } from '../ui/ReaderMotion';
import { ReaderControlLayout } from '../ui/ReaderControlLayout';
import {
  ReaderAdaptive,
  ReaderContentMode,
  ReaderDemoHeightClass,
  ReaderDemoViewportClass,
  ReaderDemoWidthClass,
  ReaderHeightClass,
  ReaderMainTabMode,
  ReaderOrientation,
  ReaderPanelMode,
  ReaderWidthClass
} from '../ui/ReaderAdaptive';
import { ReaderMainTab, ReaderRoute } from '../ui/ReaderRouteMapping';
import { ReaderEntryTarget, ReaderMode, ReaderUiReducer } from '../ui/ReaderUiState';

interface TestResult { name: string; passed: boolean; error?: string; }

class TestRunner {
  results: TestResult[] = [];
  passed: number = 0;
  failed: number = 0;

  assert(condition: boolean, name: string, error?: string): void {
    const ok = condition;
    this.results.push({ name, passed: ok, error: ok ? undefined : error });
    if (ok) {
      this.passed++;
    } else {
      this.failed++;
    }
  }
}

export function runReaderUiStateTests(): TestRunner {
  const r = new TestRunner();
  const target = readerEntryTarget();
  const initial = ReaderUiReducer.initialState();

  const discover = ReaderUiReducer.selectTab(initial, ReaderMainTab.discover);
  r.assert(discover.activeTab === ReaderMainTab.discover, '主 Tab 切换到发现');
  r.assert(discover.route === ReaderRoute.discover, '主 Tab route 是发现根页面');
  r.assert(discover.routeStack.length === 1 && discover.routeStack[0] === ReaderRoute.discover, '主 Tab 切换不 push 二级 route');
  r.assert(discover.motion.activeMotionId === ReaderMotionId.tabItemSwitch, '主 Tab 切换使用 tab.item.switch');
  r.assert(discover.motion.appMotionId === ReaderMotionId.appTabSwitch, '主 Tab 切换对齐 app.tab.switch');

  const reading = ReaderUiReducer.pushReaderEntry(initial, target);
  r.assert(reading.route === ReaderRoute.immersiveReading, '书架入口进入 immersive-reading');
  r.assert(reading.readerPresentationRoute === ReaderRoute.immersiveReading, '进入阅读最终是沉浸阅读 presentation');
  r.assert(reading.overlayState.isOpen === false, '进入阅读不自动打开控制层');
  r.assert(reading.routeStack.length === 2 && reading.routeStack[0] === ReaderRoute.bookshelf &&
    reading.routeStack[1] === ReaderRoute.immersiveReading, '阅读返回栈保留来源页');
  r.assert(reading.motion.interruptPolicy === 'latest-entry-wins', '连续点击语义保留最后入口目标');

  const control = ReaderUiReducer.showReaderControls(reading);
  const sourceSwitch = ReaderUiReducer.openSourceSwitch(control);
  r.assert(sourceSwitch.currentRoute === ReaderRoute.sourceSwitch, 'source-switch 暴露为当前视觉 route');
  r.assert(sourceSwitch.route === ReaderRoute.immersiveReading, 'source-switch 不替换 ReaderShell 宿主 route');
  r.assert(sourceSwitch.overlayState.kind === 'source-switch', 'source-switch 使用 overlay 状态');
  r.assert(sourceSwitch.readerPresentationRoute === ReaderRoute.readerControl, 'source-switch 不替换阅读 presentation');
  r.assert(sourceSwitch.routeStack.length === control.routeStack.length, 'source-switch 不写入 backStack');
  const selectedSourceSwitch = ReaderUiReducer.selectSourceSwitchSource(sourceSwitch, '笔趣阁镜像');
  r.assert(selectedSourceSwitch.sourceSwitchSelectedSource === '笔趣阁镜像', 'source-switch 候选选择写入本地 UI state');
  r.assert(selectedSourceSwitch.routeStack.length === control.routeStack.length, 'source-switch 候选选择不写入 backStack');
  r.assert(selectedSourceSwitch.readerContext.sourceId === control.readerContext.sourceId, 'source-switch 候选选择不提前修改真实书源');
  r.assert(selectedSourceSwitch.motion.activeMotionId === ReaderMotionId.stateContentReplace, 'source-switch 候选选择对齐 state.content.replace');
  const confirmedSourceSwitch = ReaderUiReducer.confirmSourceSwitchSource(selectedSourceSwitch);
  r.assert(confirmedSourceSwitch.readerContext.sourceId === '笔趣阁镜像', 'source-switch 确认后提交本地 ReaderContext sourceId');
  r.assert(confirmedSourceSwitch.routeStack.length === control.routeStack.length, 'source-switch 确认不写入 backStack');
  r.assert(confirmedSourceSwitch.readerPresentationRoute === ReaderRoute.readerControl, 'source-switch 确认后回到来源 presentation');
  r.assert(confirmedSourceSwitch.motion.activeMotionId === ReaderMotionId.appRouteReplace, 'source-switch 确认对齐 app.route.replace');
  const closedSourceSwitch = ReaderUiReducer.closeSourceSwitch(selectedSourceSwitch);
  r.assert(closedSourceSwitch.overlayState.kind === 'reader-control', '关闭 source-switch 回到阅读控制层 overlay');
  r.assert(closedSourceSwitch.currentRoute === ReaderRoute.immersiveReading, '关闭 source-switch 后视觉 route 回到 ReaderShell');
  r.assert(closedSourceSwitch.readerPresentationRoute === ReaderRoute.readerControl, '关闭 source-switch 回到来源 presentation');
  r.assert(closedSourceSwitch.focusState.owner === ReaderRoute.readerControl, '关闭 source-switch 恢复来源焦点');
  r.assert(closedSourceSwitch.motion.activeMotionId === ReaderMotionId.appRoutePop, '关闭 source-switch 对齐 app.route.pop');

  const readerMore = ReaderUiReducer.toggleReaderMore(control);
  r.assert(readerMore.overlayState.kind === 'reader-more', 'reader-more overlay 打开后写入 overlayState');
  r.assert(readerMore.overlayState.focusReturn === ReaderRoute.readerControl, 'reader-more 记录控制层 focus return');
  r.assert(readerMore.focusState.owner === 'reader-more', 'reader-more 打开后焦点进入 overlay');
  const readerMoreClosed = ReaderUiReducer.closeReaderMore(readerMore);
  r.assert(readerMoreClosed.overlayState.kind === 'reader-control', '关闭 reader-more 回到 reader-control overlay');
  r.assert(readerMoreClosed.focusState.owner === ReaderRoute.readerControl, '关闭 reader-more 焦点回到 reader-control');
  const bookCacheFromMore = ReaderUiReducer.replaceReaderPresentation(readerMore, ReaderRoute.readerBookCache);
  r.assert(bookCacheFromMore.readerMode === ReaderMode.utility, 'reader-more 菜单 route action 进入 utility host');
  r.assert(bookCacheFromMore.overlayState.kind === 'reader-control', 'reader-more 菜单 route action 会关闭 reader-more overlay');
  r.assert(bookCacheFromMore.focusState.owner === ReaderRoute.readerBookCache, 'reader-more 菜单 route action 焦点进入目标 utility route');

  const textSelection = ReaderUiReducer.openReaderTextSelection(reading);
  r.assert(textSelection.readerTextSelectionOpen, '长按正文打开文本选择层');
  r.assert(textSelection.focusState.owner === 'reader-text-selection', '文本选择层获得焦点');
  const keyboardAdjustedSelection = ReaderUiReducer.setKeyboardInsetBottom(textSelection, 280);
  r.assert(keyboardAdjustedSelection.adaptive.keyboardInsetBottom === 280, '键盘 inset 写入 adaptive 验证钩子');
  r.assert(keyboardAdjustedSelection.focusState.owner === 'reader-text-selection', '键盘 inset 更新不抢占当前 overlay/focus');
  const closedSelection = ReaderUiReducer.closeReaderTextSelection(keyboardAdjustedSelection);
  r.assert(!closedSelection.readerTextSelectionOpen, '关闭文本选择层释放 overlay');
  r.assert(closedSelection.focusState.owner === 'reader-body', '关闭文本选择层焦点回到 reader body');
  r.assert(closedSelection.adaptive.keyboardInsetBottom === 280, '关闭 overlay 不丢失键盘 inset 布局输入');

  const startedAutoPage = ReaderUiReducer.startReaderSession(control, 'autoPage');
  r.assert(startedAutoPage.route === ReaderRoute.immersiveReading, '启动自动翻页不新增 route');
  r.assert(startedAutoPage.readerPresentationRoute === ReaderRoute.immersiveReading, '启动自动翻页 replace 回沉浸阅读');
  r.assert(startedAutoPage.activeSession.kind === 'autoPage', '自动翻页会话成为唯一 activeSession');
  r.assert(startedAutoPage.activeSession.capsuleVisible, '沉浸态显示运行胶囊');
  r.assert(!startedAutoPage.activeSession.controlSpaceVisible, '沉浸态不显示控制层运行空间');
  r.assert(startedAutoPage.motion.activeMotionId === ReaderMotionId.readerSessionAutoPageStart, '自动翻页启动 motion id 正确');
  r.assert(startedAutoPage.motion.appMotionId === ReaderMotionId.readerSessionCapsuleEnter, '自动翻页启动挂接 capsule.enter');

  const controlWithSession = ReaderUiReducer.showReaderControls(startedAutoPage);
  r.assert(controlWithSession.activeSession.controlSpaceVisible, '打开控制层后显示运行空间');
  r.assert(!controlWithSession.activeSession.capsuleVisible, '打开控制层后沉浸胶囊不作为真实交互节点');
  r.assert(controlWithSession.motion.appMotionId === ReaderMotionId.readerSessionControlSpaceEnter, '打开控制层挂接 controlSpace.enter');

  const fullWithSession = ReaderUiReducer.replaceReaderPresentation(controlWithSession, ReaderRoute.readerFullTts);
  r.assert(fullWithSession.readerMode === ReaderMode.full, '完整页 presentation 标记为 full');
  r.assert(fullWithSession.activeSession.controlSpaceVisible, '完整页保持运行空间可交互');
  r.assert(!fullWithSession.activeSession.capsuleVisible, '完整页不同时保留沉浸胶囊交互');

  const ttsModule = ReaderUiReducer.replaceReaderPresentation(controlWithSession, ReaderRoute.tts);
  const ttsDropdown = ReaderUiReducer.toggleReaderTtsOption(ttsModule, 'voice');
  r.assert(ttsDropdown.readerTtsExpandedOption === 'voice', 'TTS option-key 点击展开对应 dropdown');
  r.assert(ttsDropdown.readerSettingsExpandedOption === '', 'TTS dropdown 展开会关闭 Settings dropdown');
  r.assert(ttsDropdown.motion.activeMotionId === ReaderMotionId.dropdownMenuExpand, 'TTS dropdown 展开使用 dropdown.menu.expand');
  const selectedTtsOption = ReaderUiReducer.selectReaderTtsOption(ttsDropdown, 'voice', '沉稳男声');
  r.assert(selectedTtsOption.readerTts.voice === '沉稳男声', 'TTS option select 写入 readerTts state');
  r.assert(selectedTtsOption.readerTtsExpandedOption === '', 'TTS option select 后关闭 dropdown');
  r.assert(selectedTtsOption.motion.activeMotionId === ReaderMotionId.dropdownOptionSelect, 'TTS option select 使用 dropdown.option.select');

  const settingsModule = ReaderUiReducer.replaceReaderPresentation(controlWithSession, ReaderRoute.readerSettings);
  const settingsDropdown = ReaderUiReducer.toggleReaderSettingsOption(settingsModule, 'tapMode');
  r.assert(settingsDropdown.readerSettingsExpandedOption === 'tapMode', 'Settings option-key 点击展开对应 dropdown');
  r.assert(settingsDropdown.readerTtsExpandedOption === '', 'Settings dropdown 展开会关闭 TTS dropdown');
  r.assert(settingsDropdown.motion.activeMotionId === ReaderMotionId.dropdownMenuExpand, 'Settings dropdown 展开使用 dropdown.menu.expand');
  const selectedSettingsOption = ReaderUiReducer.selectReaderSettingsOption(settingsDropdown, 'tapMode', '上下区域');
  r.assert(selectedSettingsOption.readerSettings.tapMode === '上下区域', 'Settings option select 写入 readerSettings state');
  r.assert(selectedSettingsOption.readerSettingsExpandedOption === '', 'Settings option select 后关闭 dropdown');
  r.assert(selectedSettingsOption.motion.activeMotionId === ReaderMotionId.dropdownOptionSelect, 'Settings option select 使用 dropdown.option.select');

  const toggledVolumePage = ReaderUiReducer.toggleReaderSettingsSwitch(settingsModule, 'volumePage');
  r.assert(!toggledVolumePage.readerSettings.volumePage, 'Settings toggle 写入 readerSettings 布尔状态');
  r.assert(toggledVolumePage.readerSettingsExpandedOption === '', 'Settings toggle 会关闭 settings dropdown');
  r.assert(toggledVolumePage.focusState.owner === 'reader-settings-volumePage-switch', 'Settings toggle 写入可解释 focus owner');
  r.assert(toggledVolumePage.motion.activeMotionId === ReaderMotionId.stateContentReplace, 'Settings toggle 使用 state.content.replace');

  const settingsModuleWithoutSession = ReaderUiReducer.replaceReaderPresentation(control, ReaderRoute.readerSettings);
  const autoPageFromSettings = ReaderUiReducer.toggleReaderSettingsSwitch(settingsModuleWithoutSession, 'autoPage');
  r.assert(autoPageFromSettings.activeSession.kind === 'autoPage', 'Settings 自动翻页 toggle 启动 autoPage session');
  r.assert(autoPageFromSettings.readerPresentationRoute === ReaderRoute.immersiveReading, 'Settings 自动翻页启动后回到沉浸阅读');
  r.assert(autoPageFromSettings.activeSession.capsuleVisible, 'Settings 自动翻页启动后显示沉浸胶囊');
  r.assert(autoPageFromSettings.motion.activeMotionId === ReaderMotionId.readerSessionAutoPageStart, 'Settings 自动翻页启动使用 reader.session.autoPage.start');

  const toggledInControlSpace = ReaderUiReducer.toggleReaderSessionPlaying(fullWithSession);
  r.assert(toggledInControlSpace.motion.activeMotionId === ReaderMotionId.readerSessionControlSpaceUpdate, '控制层内暂停继续更新 controlSpace');
  r.assert(toggledInControlSpace.motion.appMotionId === ReaderMotionId.readerSessionCapsuleControlPressToggle, '控制层内暂停继续等价 capsule control.toggle');

  const hiddenControls = ReaderUiReducer.hideReaderControls(fullWithSession);
  r.assert(hiddenControls.readerPresentationRoute === ReaderRoute.immersiveReading, '隐藏控制层回到沉浸阅读');
  r.assert(hiddenControls.activeSession.capsuleVisible, '隐藏控制层后恢复沉浸胶囊');
  r.assert(!hiddenControls.activeSession.controlSpaceVisible, '隐藏控制层后释放 controlSpace 交互节点');
  r.assert(hiddenControls.motion.appMotionId === ReaderMotionId.readerSessionControlSpaceExit, '隐藏控制层挂接 controlSpace.exit');

  const toggledInCapsule = ReaderUiReducer.toggleReaderSessionPlaying(hiddenControls);
  r.assert(toggledInCapsule.motion.activeMotionId === ReaderMotionId.readerSessionCapsuleControlPressToggle, '沉浸胶囊暂停继续使用 capsule control.toggle');

  const stopped = ReaderUiReducer.stopReaderSession(hiddenControls);
  r.assert(stopped.activeSession.kind === 'none', '停止会话清空 activeSession');
  r.assert(!stopped.activeSession.capsuleVisible && !stopped.activeSession.controlSpaceVisible, '停止会话释放 capsule/controlSpace 节点');

  const switchedToTts = ReaderUiReducer.startReaderSession(startedAutoPage, 'tts');
  r.assert(switchedToTts.activeSession.kind === 'tts', 'autoPage 切到 TTS 时只保留最后会话');
  r.assert(switchedToTts.readerSettings.autoPage === false, '切到 TTS 后自动翻页设置同步关闭');
  r.assert(switchedToTts.readerTts.playing, '切到 TTS 后朗读状态同步开启');
  r.assert(switchedToTts.motion.activeMotionId === ReaderMotionId.readerSessionTtsStart, '切到 TTS 使用 reader.session.tts.start');
  r.assert(switchedToTts.motion.appMotionId === ReaderMotionId.readerSessionCapsuleSwitch, '会话互斥切换挂接 capsule.switch');
  const ttsControl = ReaderUiReducer.showReaderControls(switchedToTts);
  const switchedToAutoPage = ReaderUiReducer.startReaderSession(ttsControl, 'autoPage');
  r.assert(switchedToAutoPage.activeSession.kind === 'autoPage', 'TTS 切到 autoPage 时只保留最后会话');
  r.assert(switchedToAutoPage.readerSettings.autoPage, '切到 autoPage 后自动翻页设置同步开启');
  r.assert(switchedToAutoPage.readerTts.playing === false, '切到 autoPage 后朗读状态同步关闭');
  r.assert(switchedToAutoPage.motion.activeMotionId === ReaderMotionId.readerSessionAutoPageStart, '切到 autoPage 使用 reader.session.autoPage.start');
  r.assert(switchedToAutoPage.motion.appMotionId === ReaderMotionId.readerSessionCapsuleSwitch, '反向会话切换同样挂接 capsule.switch');

  const mediumLandscape = ReaderAdaptive.fromMetrics(812, 430);
  r.assert(mediumLandscape.widthClass === ReaderWidthClass.medium, '812x430 推导为 medium 宽度等级');
  r.assert(mediumLandscape.heightClass === ReaderHeightClass.compact, '812x430 推导为 compact 高度等级');
  r.assert(mediumLandscape.orientation === ReaderOrientation.landscape, '812x430 推导为 landscape');
  r.assert(mediumLandscape.demoWidthClass === ReaderDemoWidthClass.expanded, '812x430 demo widthClass 是 expanded');
  r.assert(mediumLandscape.demoHeightClass === ReaderDemoHeightClass.compact, '812x430 demo heightClass 是 compact');
  r.assert(mediumLandscape.demoViewportClass === ReaderDemoViewportClass.compactLandscape, '812x430 demo viewportClass 是 compact-landscape');
  r.assert(mediumLandscape.readerPanelMode === ReaderPanelMode.sideDock, 'medium landscape 使用 sideDock 控制层');
  r.assert(ReaderAdaptive.sourceSwitchUsesFlowLayout(mediumLandscape), 'compact-landscape source-switch 使用三列 FlowShell');
  r.assert(ReaderControlLayout.sourceSwitchReaderWidth(mediumLandscape, true) === 300, 'compact-landscape FlowShell reader slot 宽度为 300');
  r.assert(ReaderControlLayout.sourceSwitchWindowX(mediumLandscape, true) === 324, 'compact-landscape FlowShell window slot x 为 324');
  r.assert(ReaderControlLayout.sourceSwitchResultX(mediumLandscape, true) === 636, 'compact-landscape FlowShell result slot x 为 636');
  r.assert(ReaderControlLayout.sourceSwitchReaderHeight(mediumLandscape, true) === 406, 'compact-landscape FlowShell reader slot 高度扣除 12px padding');
  r.assert(ReaderControlLayout.sourceSwitchReaderNavY(mediumLandscape) === 74, 'compact-landscape FlowShell reader nav y 为 74');
  r.assert(ReaderControlLayout.sourceSwitchReaderTextTop(mediumLandscape) === 136, 'compact-landscape FlowShell reading inset top 为 136');
  r.assert(ReaderControlLayout.actionPanelHeight(mediumLandscape, true, false) === 64.6, 'compact-landscape FlowShell action panel 高度按可用空间分配为 64.6');
  r.assert(ReaderControlLayout.chapterPanelHeight(mediumLandscape, true, false) === 95.4, 'compact-landscape FlowShell chapter panel 高度按可用空间分配为 95.4');
  r.assert(ReaderControlLayout.readerDropdownY('tts', 'timer', ReaderControlLayout.modulePanelInnerHeight(mediumLandscape, true, false)) === 60,
    'compact-landscape TTS timer dropdown 向上避让');
  r.assert(ReaderControlLayout.sessionHostLeft(mediumLandscape) === 684, 'compact-landscape controlSpace 胶囊右侧锚点 x 为 684');
  r.assert(ReaderControlLayout.sessionHostTop(mediumLandscape) === 97, 'compact-landscape controlSpace 胶囊上沿 y 为 97');
  const expandedWidthLandscape = ReaderAdaptive.fromMetrics(812, 640);
  r.assert(expandedWidthLandscape.demoViewportClass === ReaderDemoViewportClass.expandedWidth, '812x640 demo viewportClass 是 expanded-width');
  r.assert(expandedWidthLandscape.readerPanelMode === ReaderPanelMode.sideDock, '812x640 仍可使用 sideDock 控制层');
  r.assert(!ReaderAdaptive.sourceSwitchUsesFlowLayout(expandedWidthLandscape), 'expanded-width source-switch 不使用三列 FlowShell');
  r.assert(!ReaderControlLayout.sourceSwitchUsesFlowLayout(expandedWidthLandscape, true), 'layout adapter 保持 expanded-width 不进入 FlowShell');
  const expandedLandscape = ReaderAdaptive.fromMetrics(1024, 640);
  r.assert(expandedLandscape.widthClass === ReaderWidthClass.expanded, '1024x640 推导为 expanded 宽度等级');
  r.assert(expandedLandscape.orientation === ReaderOrientation.landscape, '1024x640 推导为 landscape');
  r.assert(expandedLandscape.demoViewportClass === ReaderDemoViewportClass.tabletExpanded, '1024x640 demo viewportClass 是 tablet-expanded');
  r.assert(expandedLandscape.readerPanelMode === ReaderPanelMode.sideDock, 'expanded landscape 使用 sideDock 控制层');
  r.assert(expandedLandscape.mainTabMode === ReaderMainTabMode.navRail, 'expanded landscape 主导航预留 navRail');
  r.assert(ReaderAdaptive.sourceSwitchUsesFlowLayout(expandedLandscape), 'tablet-expanded source-switch 使用三列 FlowShell');
  r.assert(ReaderControlLayout.sourceSwitchReaderWidth(expandedLandscape, true) === 476, 'tablet-expanded 1024 FlowShell reader slot 宽度为 476');
  r.assert(ReaderControlLayout.sourceSwitchWindowX(expandedLandscape, true) === 500, 'tablet-expanded 1024 FlowShell window slot x 为 500');
  r.assert(ReaderControlLayout.sourceSwitchResultX(expandedLandscape, true) === 812, 'tablet-expanded 1024 FlowShell result slot x 为 812');
  r.assert(ReaderControlLayout.sourceSwitchReaderHeight(expandedLandscape, true) === 616, 'tablet-expanded 1024 FlowShell reader slot 高度扣除 12px padding');
  r.assert(ReaderControlLayout.sourceSwitchReaderNavY(expandedLandscape) === 112, 'tablet-expanded FlowShell reader nav y 为 112');
  r.assert(ReaderControlLayout.sourceSwitchReaderTextTop(expandedLandscape) === 206, 'tablet-expanded FlowShell reading inset top 为 206');
  r.assert(ReaderControlLayout.actionPanelHeight(expandedLandscape, true, false) === 72.5, 'tablet-expanded FlowShell action panel 高度按可用空间分配为 72.5');
  r.assert(ReaderControlLayout.chapterPanelHeight(expandedLandscape, true, false) === 99.5, 'tablet-expanded FlowShell chapter panel 高度按可用空间分配为 99.5');
  r.assert(ReaderControlLayout.readerDropdownY('settings', 'pageAnimation', ReaderControlLayout.modulePanelInnerHeight(expandedLandscape, true, false)) === 10,
    'tablet-expanded settings pageAnimation dropdown 向上避让');
  r.assert(ReaderControlLayout.sessionHostLeft(expandedLandscape) === 888, 'tablet-expanded controlSpace 胶囊右侧锚点 x 为 888');
  r.assert(ReaderControlLayout.sessionHostTop(expandedLandscape) === 244, 'tablet-expanded controlSpace 胶囊上沿 y 为 244');
  const compactPortrait = ReaderAdaptive.fromMetrics(390, 844);
  r.assert(compactPortrait.demoWidthClass === ReaderDemoWidthClass.standard, '390x844 demo widthClass 是 standard');
  r.assert(compactPortrait.demoHeightClass === ReaderDemoHeightClass.regular, '390x844 demo heightClass 是 regular');
  r.assert(compactPortrait.demoViewportClass === ReaderDemoViewportClass.standardPortrait, '390x844 demo viewportClass 是 standard-portrait');
  r.assert(!ReaderAdaptive.sourceSwitchUsesFlowLayout(compactPortrait), 'compact portrait source-switch 保持 phone overlay');
  r.assert(!ReaderControlLayout.sourceSwitchUsesFlowLayout(compactPortrait, true), 'layout adapter 保持 phone portrait 不进入 FlowShell');
  r.assert(ReaderControlLayout.actionPanelHeight(compactPortrait, false, false) === 78.2, 'phone portrait action panel 高度为 78.2');
  r.assert(ReaderControlLayout.chapterPanelHeight(compactPortrait, false, false) === 107.8, 'phone portrait chapter panel 高度为 107.8');
  r.assert(ReaderControlLayout.moreMenuWidth() === 214 && ReaderControlLayout.moreMenuTop() === 74, 'reader-more 菜单宽度和顶栏锚点对齐 demo');
  r.assert(ReaderControlLayout.moreMenuItemHeight() === 46 && ReaderControlLayout.moreMenuGap() === 4, 'reader-more 菜单项使用 demo grid gap');
  r.assert(ReaderControlLayout.fullHostTopInset() === 88 && ReaderControlLayout.fullHostBottomInset() === 18, 'full/utility host 使用 demo top/bottom inset');
  r.assert(ReaderControlLayout.fullPanelHeaderHeight() === 30 && ReaderControlLayout.fullGrabberVisualTop() === 9, 'full panel header 与绝对抓手 token 对齐 demo');
  r.assert(ReaderControlLayout.sessionCapsuleWidth('autoPage') === 96 && ReaderControlLayout.sessionCapsuleWidth('tts') === 94,
    'session capsule 宽度区分 autoPage 和 TTS');
  r.assert(ReaderControlLayout.sessionHostLeft(compactPortrait) === 256, 'phone portrait controlSpace 胶囊右侧锚点 x 为 256');
  r.assert(ReaderControlLayout.sessionHostTop(compactPortrait) === 462, 'phone portrait controlSpace 胶囊上沿 y 为 462');
  r.assert(ReaderControlLayout.utilitySummaryHeight() === 58 && ReaderControlLayout.utilityBlockGap() === 8,
    'utility summary/action grid 使用统一 token');
  const expandedSourceSwitch = ReaderUiReducer.openSourceSwitch(
    ReaderUiReducer.setAdaptive(control, expandedLandscape)
  );
  r.assert(expandedSourceSwitch.currentRoute === ReaderRoute.sourceSwitch, 'expanded landscape source-switch 保持 FlowShell 视觉 route');
  r.assert(expandedSourceSwitch.routeStack.length === control.routeStack.length, 'expanded landscape source-switch 不污染 backStack');

  const phoneProfile = ReaderAdaptive.fromPhysicalMetrics(1320, 2856, 560);
  r.assert(phoneProfile.widthVp === 377 && phoneProfile.heightVp === 816, '1320x2856/560dpi 代表手机换算为 377x816vp');
  r.assert(phoneProfile.widthClass === ReaderWidthClass.compact, '1320x2856/560dpi 代表手机是 compact');
  r.assert(phoneProfile.orientation === ReaderOrientation.portrait, '1320x2856/560dpi 代表手机是 portrait');
  r.assert(phoneProfile.mainTabMode === ReaderMainTabMode.bottomTabs, '1320x2856/560dpi 代表手机保持底部主 Tab');
  r.assert(phoneProfile.readerPanelMode === ReaderPanelMode.bottomSheet, '1320x2856/560dpi 代表手机控制层使用 bottomSheet');
  r.assert(phoneProfile.readerContentMode === ReaderContentMode.single, '1320x2856/560dpi 代表手机阅读正文使用 single');
  r.assert(phoneProfile.bookshelfColumns === 3, '1320x2856/560dpi 代表手机书架保持三列');
  r.assert(!ReaderAdaptive.sourceSwitchUsesFlowLayout(phoneProfile), '1320x2856/560dpi 代表手机 source-switch 使用 phone overlay');

  const currentPhoneLikeProfile = ReaderAdaptive.fromPhysicalMetrics(1280, 2832, 560);
  r.assert(currentPhoneLikeProfile.widthClass === ReaderWidthClass.compact, '1280x2832/560dpi 近似手机仍是 compact');
  r.assert(currentPhoneLikeProfile.orientation === ReaderOrientation.portrait, '1280x2832/560dpi 近似手机仍是 portrait');
  r.assert(currentPhoneLikeProfile.readerPanelMode === ReaderPanelMode.bottomSheet, '1280x2832/560dpi 近似手机仍使用 bottomSheet');
  r.assert(!ReaderAdaptive.sourceSwitchUsesFlowLayout(currentPhoneLikeProfile), '1280x2832/560dpi 近似手机 source-switch 仍使用 phone overlay');

  const tabletProfile = ReaderAdaptive.fromPhysicalMetrics(2560, 1600, 360);
  r.assert(tabletProfile.widthVp === 1138 && tabletProfile.heightVp === 711, '2560x1600/360dpi 平板档位换算为 1138x711vp');
  r.assert(tabletProfile.widthClass === ReaderWidthClass.expanded, '2560x1600/360dpi 平板是 expanded');
  r.assert(tabletProfile.orientation === ReaderOrientation.landscape, '2560x1600/360dpi 平板是 landscape');
  r.assert(tabletProfile.demoViewportClass === ReaderDemoViewportClass.tabletExpanded, '2560x1600/360dpi 平板 demo viewportClass 是 tablet-expanded');
  r.assert(tabletProfile.mainTabMode === ReaderMainTabMode.navRail, '2560x1600/360dpi 平板主导航使用 navRail');
  r.assert(tabletProfile.readerPanelMode === ReaderPanelMode.sideDock, '2560x1600/360dpi 平板控制层使用 sideDock');
  r.assert(tabletProfile.readerContentMode === ReaderContentMode.wideSingle, '2560x1600/360dpi 平板阅读正文使用 wideSingle');
  r.assert(tabletProfile.bookshelfColumns === 5, '2560x1600/360dpi 平板书架使用五列');
  r.assert(ReaderAdaptive.sourceSwitchUsesFlowLayout(tabletProfile), '2560x1600/360dpi 平板 source-switch 使用 FlowShell 三槽');
  r.assert(ReaderControlLayout.sourceSwitchReaderWidth(tabletProfile, true) === 590, '2560x1600/360dpi 平板 FlowShell reader slot 宽度为 590');
  r.assert(ReaderControlLayout.sourceSwitchWindowX(tabletProfile, true) === 614, '2560x1600/360dpi 平板 FlowShell window slot x 为 614');
  r.assert(ReaderControlLayout.sourceSwitchResultX(tabletProfile, true) === 926, '2560x1600/360dpi 平板 FlowShell result slot x 为 926');
  r.assert(ReaderControlLayout.sourceSwitchReaderHeight(tabletProfile, true) === 687, '2560x1600/360dpi 平板 FlowShell reader slot 高度扣除 12px padding');
  r.assert(ReaderControlLayout.sourceSwitchReaderNavY(tabletProfile) === 112, '2560x1600/360dpi 平板 FlowShell reader nav y 为 112');
  r.assert(ReaderControlLayout.sourceSwitchReaderTextTop(tabletProfile) === 206, '2560x1600/360dpi 平板 FlowShell reading inset top 为 206');
  r.assert(ReaderControlLayout.actionPanelHeight(tabletProfile, true, false) === 72.5, '2560x1600/360dpi 平板 FlowShell action panel 高度按可用空间分配为 72.5');
  r.assert(ReaderControlLayout.chapterPanelHeight(tabletProfile, true, false) === 99.5, '2560x1600/360dpi 平板 FlowShell chapter panel 高度按可用空间分配为 99.5');
  r.assert(ReaderControlLayout.readerDropdownY('tts', 'timer', ReaderControlLayout.modulePanelInnerHeight(tabletProfile, true, false)) === 60,
    '2560x1600/360dpi 平板 TTS timer dropdown 向上避让');
  r.assert(ReaderControlLayout.sessionHostLeft(tabletProfile) === 1002, '2560x1600/360dpi 平板 controlSpace 胶囊右侧锚点 x 为 1002');
  r.assert(ReaderControlLayout.sessionHostTop(tabletProfile) === 377, '2560x1600/360dpi 平板 controlSpace 胶囊上沿 y 为 377');

  return r;
}

function readerEntryTarget(): ReaderEntryTarget {
  const target = new ReaderEntryTarget();
  target.bookId = 'fixture-book';
  target.sourceId = 'fixture-source';
  target.bookTitle = '夜航船';
  target.author = '张岱';
  target.chapterIndex = 31;
  target.chapterTitle = '第 32 章 雨夜';
  target.progressText = '38%';
  target.pageLabel = '1 / 3';
  target.totalChapters = 128;
  target.contentPreview = '雨声从窗外落下。\n灯影贴着纸页移动。';
  target.sourceRoute = ReaderRoute.bookshelf;
  target.entryKind = 'cover';
  return target;
}
