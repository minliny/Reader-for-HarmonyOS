import type { ReaderControlLocation } from './ReaderControlSessionState';
import { type ReaderControlLayoutSnapshot, type ReaderControlCandidateWidths, type ReaderControlCandidateMinimum, type ReaderControlModuleMinimum, type ReaderControlModuleMeasurer, type ReaderControlContentModule } from './ReaderLayoutGeometry';
import { readerControlHeaderPaintProfile, readerControlHeaderRole, readerControlHeaderTitle, readerControlHeaderActionLabel,
  type ReaderControlHeaderPaintProfile } from './ReaderControlHeaderGeometry';
import { measureReaderDirectoryMinimum, type ReaderDirectoryMinimumFacts, type ReaderDirectoryMinimumProfile } from './ReaderControlDirectoryMinimum';
import { measureReaderSearchMinimum, type ReaderSearchMinimumFacts, type ReaderSearchMinimumProfile } from './ReaderControlSearchMinimum';
import { measureReaderTtsMinimum, type ReaderTtsMinimumFacts, type ReaderTtsMinimumProfile } from './ReaderControlTtsMinimum';
import { measureReaderControlAutoPageMinimum, type ReaderControlAutoPageMinimumFacts, type ReaderControlAutoPageMinimumProfile } from './ReaderControlAutoPageMinimum';
import { measureReaderControlAppearanceMinimum, type ReaderControlAppearanceMinimumInput, type ReaderControlAppearanceFontMinimumInput } from './ReaderControlAppearanceMinimum';
import type { ReaderControlAppearanceMinimumProfile } from './ReaderControlAppearanceGeometry';
import { measureReaderControlSettingsMinimum, type ReaderControlSettingsMinimumFacts } from './ReaderControlSettingsMinimum';
import { sampleReaderControlSettings, type ReaderControlSettingsMinimumProfile } from './ReaderControlSettingsGeometry';
import { measureReaderControlReplaceMinimum, type ReaderControlReplaceMinimumFacts } from './ReaderControlReplaceMinimum';
import { sampleReaderControlReplace, type ReaderControlReplaceMinimumProfile } from './ReaderControlReplaceGeometry';
import type { UIContext } from '@ohos.arkui.UIContext';
import { measureReaderControlText } from './ReaderControlTextMeasurement';
import { TYPE_READER_CONTROL_COLLAPSE_INTER, TYPE_READER_CONTROL_COLLAPSE_UI, TYPE_READER_CONTROL_COLLAPSE_TTS,
  TYPE_READER_CONTROL_HEADER_INTER, TYPE_READER_CONTROL_HEADER_UI,
  TYPE_READER_CONTROLS_RETAINED_REPLACE_HEADER_LABEL, TYPE_READER_CONTROLS_RETAINED_REPLACE_HEADER_LABEL_SECONDARY,
  TYPE_READER_CONTROLS_RETAINED_MODULE_BUTTON_LABEL,
  TYPE_READER_CONTROLS_RETAINED_BRIGHTNESS_RAIL_LABEL } from '../../../ui/foundation/ReaderTypography';
import { TOK_BORDER_W } from '../../../ui/foundation/ReaderTokens';
import { READER_CONTROL_BRIGHTNESS_RAIL_WIDTH, READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE,
  READER_CONTROL_BRIGHTNESS_ICON_SIZE, READER_CONTROL_BRIGHTNESS_CONTROL_GAP,
  READER_CONTROL_HOME_SHORT_ACTION_HEIGHT, READER_CONTROL_HOME_SECTION_GAP } from './ReaderControlGeometry';

import type { ReaderControlPlaybackProfileData, ReaderControlPlaybackProfileReader } from './ReaderControlPlaybackProfile';

export interface ReaderControlHomeFormProfile {
  chapterTitleHeight: number;
  chapterRowHeight: number;
  progressHeight: number;
  percentWidth: number;
  countWidth: number;
  actionLabelHeight: number;
  actionHeight: number;
  minimumHeight: number;
  minWidth: number;
  fits: boolean;
}

/** Display facts from the current module owner, consumed by the same pure measurement pass. */
export interface ReaderControlHomeFacts { chapterTitle: string; totalChapters: number; }
export interface ReaderControlModuleFacts {
  home?: ReaderControlHomeFacts;
  module: ReaderControlContentModule;
  directory?: ReaderDirectoryMinimumFacts;
  appearance?: ReaderControlAppearanceMinimumInput;
  settings?: ReaderControlSettingsMinimumFacts;
  search?: ReaderSearchMinimumFacts;
  tts?: ReaderTtsMinimumFacts;
  autoPage?: ReaderControlAutoPageMinimumFacts;
  replace?: ReaderControlReplaceMinimumFacts;
}
export interface ReaderControlModuleProfileData {
  module: ReaderControlContentModule;
  directory?: ReaderDirectoryMinimumProfile;
  appearance?: ReaderControlAppearanceMinimumProfile;
  settings?: ReaderControlSettingsMinimumProfile;
  search?: ReaderSearchMinimumProfile;
  tts?: ReaderTtsMinimumProfile;
  autoPage?: ReaderControlAutoPageMinimumProfile;
  replace?: ReaderControlReplaceMinimumProfile;
}
export interface ReaderControlPreparedModuleMinimum {
  minimum: ReaderControlModuleMinimum;
  moduleData: ReaderControlModuleProfileData;
}
export interface ReaderControlPreparedModuleProfile {
  ownerCurrent?: () => boolean;
  facts: ReaderControlModuleFacts;
  identity: string;
  key: string;
  moduleData: ReaderControlModuleProfileData;
}
export interface ReaderControlPresentationReceipt {
  facts?: ReaderControlModuleFacts;
  identity: string;
  ownerKey: string;
  environmentKey: string;
  key: string;
  location: ReaderControlLocation;
  layout: ReaderControlLayoutSnapshot;
  profile: ReaderControlMeasuredProfile;
  prepared?: ReaderControlPreparedModuleProfile;
}
export type ReaderControlMeasuredProfileReader = (key: string) => ReaderControlMeasuredProfile | undefined;

export function readerControlModuleFactsMatch(facts: ReaderControlModuleFacts | undefined, module: ReaderControlContentModule): boolean {
  if (facts === undefined) return false;
  const shapeMatches = facts.module === module && (facts.home !== undefined) === (module === 'home') &&
    (facts.directory !== undefined) === (module === 'directory') &&
    (facts.appearance !== undefined) === (module === 'appearance') &&
    (facts.settings !== undefined) === (module === 'settings') &&
    (facts.search !== undefined) === (module === 'search') &&
    (facts.tts !== undefined) === (module === 'tts') &&
    (facts.autoPage !== undefined) === (module === 'autoPage') &&
    (facts.replace !== undefined) === (module === 'replace');
  if (!shapeMatches) return false;
  try {
    if (module === 'home') return typeof facts.home?.chapterTitle === 'string' && Number.isFinite(facts.home?.totalChapters);
    if (module === 'directory') {
      const directory = facts.directory;
      const snapshot = directory?.readViewSnapshot?.();
      return snapshot !== undefined && Array.isArray(snapshot.rows) && typeof snapshot.loading === 'boolean' &&
        directory?.hasRows === (snapshot.rows.length > 0) && directory.currentTitle === snapshot.currentTitle &&
        directory.currentPosition === snapshot.currentPosition;
    }
    if (module === 'search') {
      const search = facts.search;
      const state = search?.readViewState?.();
      return state !== undefined && search?.resultsMode === (state.kind === 'results') &&
        search.loading === (state.kind === 'loading') && (state.kind !== 'results' || Array.isArray(state.results));
    }
    if (module === 'tts') {
      const tts = facts.tts;
      const state = tts?.readViewState?.();
      return state !== undefined && typeof state.status === 'string' && tts?.error === (state.errorMessage ?? '') &&
        tts.seek === (state.totalSlices > 1);
    }
    if (module === 'appearance') {
      const appearance = facts.appearance;
      return appearance?.readViewSnapshot?.() !== undefined && Array.isArray(appearance.readViewFontOrder?.());
    }
    if (module === 'replace') {
      const replacement = facts.replace;
      const state = replacement?.readViewState?.();
      return state !== undefined && Array.isArray(state.rules) && replacement?.ruleCount === state.rules.length;
    }
    return module === 'settings' ? facts.settings?.groupLabels.length === 3 && facts.settings.optionLabels.length === 3 :
      typeof facts.autoPage?.status === 'string' && typeof facts.autoPage?.timerSummary === 'string';
  } catch (_) {
    return false;
  }
}

export function readerControlModuleProfileMatches(data: ReaderControlModuleProfileData, module: ReaderControlContentModule): boolean {
  return data.module === module &&
    (data.directory !== undefined) === (module === 'directory') &&
    (data.appearance !== undefined) === (module === 'appearance') &&
    (data.settings !== undefined) === (module === 'settings') &&
    (data.search !== undefined) === (module === 'search') &&
    (data.tts !== undefined) === (module === 'tts') &&
    (data.autoPage !== undefined) === (module === 'autoPage') &&
    (data.replace !== undefined) === (module === 'replace');
}

export function measureReaderControlModuleMinimum(context: UIContext, widths: ReaderControlCandidateWidths,
  module: ReaderControlContentModule, facts: ReaderControlModuleFacts): ReaderControlPreparedModuleMinimum | undefined {
  if (!readerControlModuleFactsMatch(facts, module)) return undefined;
  if (module === 'directory' && facts.directory !== undefined) {
    const data = measureReaderDirectoryMinimum(context, widths, facts.directory);
    return data === undefined ? undefined : { minimum: { module: module, quick: data.quick.minimum, full: data.full.minimum },
      moduleData: { module: module, directory: data } };
  }
  if (module === 'search' && facts.search !== undefined) {
    const data = measureReaderSearchMinimum(context, widths, facts.search);
    return data === undefined ? undefined : { minimum: { module: module, quick: data.quick.minimum, full: data.full.minimum },
      moduleData: { module: module, search: data } };
  }
  if (module === 'appearance' && facts.appearance !== undefined) {
    const data = measureReaderControlAppearanceMinimum(context, widths, facts.appearance);
    return data === undefined ? undefined : { minimum: data.minimum, moduleData: { module: module, appearance: data.profile } };
  }
  if (module === 'tts' && facts.tts !== undefined) {
    const data = measureReaderTtsMinimum(context, widths, facts.tts);
    return data === undefined ? undefined : { minimum: data.minimum, moduleData: { module: module, tts: data } };
  }
  if (module === 'autoPage' && facts.autoPage !== undefined) {
    const data = measureReaderControlAutoPageMinimum(context, widths, facts.autoPage.status, facts.autoPage.timerSummary);
    return data === undefined ? undefined : { minimum: data.minimum, moduleData: { module: module, autoPage: data } };
  }
  if (module === 'settings' && facts.settings !== undefined) {
    const data = measureReaderControlSettingsMinimum(context, widths, facts.settings.groupLabels, facts.settings.optionLabels, facts.settings.toggleLabels);
    if (data === undefined) return undefined;
    const quick = sampleReaderControlSettings(0, widths.quickContentWidthVp, data);
    const full = sampleReaderControlSettings(1, widths.fullContentWidthVp, data);
    return { minimum: { module: module, quick: { heightVp: Math.max(183, quick.contentHeight), minWidthVp: widths.quickContentWidthVp, fits: data.quick.fits },
      full: { heightVp: full.bars[2].y + full.bars[2].height + 5, minWidthVp: widths.fullContentWidthVp, fits: data.full.fits } },
      moduleData: { module: module, settings: data } };
  }
  if (module === 'replace' && facts.replace !== undefined) {
    const value = facts.replace;
    const data = measureReaderControlReplaceMinimum(context, widths, value.statusText, value.recoveryLabel,
      value.name, value.pattern, value.meta, value.temporaryTitle, value.editorOpen);
    if (data === undefined) return undefined;
    const quick = sampleReaderControlReplace(0, widths.quickContentWidthVp, 190, data);
    const full = sampleReaderControlReplace(1, widths.fullContentWidthVp, 666, data);
    const count = Math.max(1, Math.min(3, value.ruleCount));
    return { minimum: { module: module,
      quick: { heightVp: Math.max(190, quick.list.y + Math.max(data.quick.rowHeight * count, value.statusVisible ? data.quick.statusHeight : 0) + data.quick.actionHeight + 30.45),
        minWidthVp: widths.quickContentWidthVp, fits: data.quick.fits },
      full: { heightVp: Math.max(full.list.y + Math.max(data.full.rowHeight, value.statusVisible ? data.full.statusHeight : 0) + 13,
        value.layerOpen ? 24 + data.full.editorHeaderHeight + 16 + Math.max(76, data.full.editorFlagHeight) +
          (value.editorOpen ? Math.max(36, data.full.actionHeight) + 8 : 0) : 0),
        minWidthVp: widths.fullContentWidthVp, fits: data.full.fits } }, moduleData: { module: module, replace: data } };
  }
  return undefined;
}

export interface ReaderControlMeasuredProfile {
  module: ReaderControlContentModule;
  moduleData?: ReaderControlModuleProfileData;
  moduleFacts?: ReaderControlModuleFacts;
  headerPaint: ReaderControlHeaderPaintProfile;
  identity: string;
  metricsRevision: number;
  /** Native measurement origin, retained across an IME-only environment rebind. */
  measurementMetricsRevision?: number;
  widths: ReaderControlCandidateWidths;
  playbackData: ReaderControlPlaybackProfileData | undefined;
  quick: ReaderControlHomeFormProfile | undefined;
  full: ReaderControlHomeFormProfile | undefined;
  topBarVisible: boolean;
  navigationLabelHeight: number;
  navigationHeight: number;
  titleHeight: number;
  collapseLabelHeight: number;
  collapseWidth: number;
  headerHeight: number;
}

export interface ReaderControlMinimumMeasurementInput {
  context: UIContext;
  moduleFacts?: ReaderControlModuleFacts;
  preparedMinimumRequired?: boolean;
  headerInter: boolean;
  title: string;
  identity: string;
  metricsRevision: number;
  topBarHeightVp: number;
  availableWithTopBarHeightVp?: number;
  measureHomeForm: (width: number) => ReaderControlHomeFormProfile | undefined;
}
export interface ReaderControlMinimumMeasurement {
  candidate: ReaderControlCandidateMinimum;
  profile: ReaderControlMeasuredProfile;
}

function measureHeader(context: UIContext, module: string, width: number,
  titleText: string = readerControlHeaderTitle(module)): ReaderControlHeaderPaintProfile | undefined {
  const role = readerControlHeaderRole(module);
  const actionStyle = role === 'ttsMake' ? TYPE_READER_CONTROL_COLLAPSE_TTS : role === 'replace' ?
    TYPE_READER_CONTROLS_RETAINED_REPLACE_HEADER_LABEL_SECONDARY : role === 'plainInter' ?
      TYPE_READER_CONTROL_COLLAPSE_INTER : TYPE_READER_CONTROL_COLLAPSE_UI;
  const titleStyle = role === 'replace' ? TYPE_READER_CONTROLS_RETAINED_REPLACE_HEADER_LABEL :
    role === 'plainInter' ? TYPE_READER_CONTROL_HEADER_INTER : TYPE_READER_CONTROL_HEADER_UI;
  const action = measureReaderControlText(context, readerControlHeaderActionLabel(module), actionStyle, width);
  if (action === undefined) return undefined;
  const actionWidth = role === 'ttsMake' ? action.singleLineWidthVp + 34 : Math.max(40, action.singleLineWidthVp + 20);
  const title = measureReaderControlText(context, titleText, titleStyle, Math.max(1, width - actionWidth - 34));
  if (title === undefined) return undefined;
  return readerControlHeaderPaintProfile(module, { titleWidthVp: title.singleLineWidthVp, titleHeightVp: title.heightVp,
    actionLabelWidthVp: action.singleLineWidthVp, actionLabelHeightVp: action.heightVp });
}

/** Actual SDK text/module measurement. Profiles are returned to the original
 * Panel; this adapter holds no provider, font, map or lifecycle state. */
export function measureReaderControlMinimum(input: ReaderControlMinimumMeasurementInput,
  module: ReaderControlContentModule, widths: ReaderControlCandidateWidths, key: string,
  delegate: ReaderControlModuleMeasurer | undefined,
  profileReader?: ReaderControlPlaybackProfileReader): ReaderControlMinimumMeasurement | undefined {
    if (input.preparedMinimumRequired === true && (input.moduleFacts === undefined ||
      !readerControlModuleFactsMatch(input.moduleFacts, module))) return undefined;
    const context = input.context;
    const navigationCellWidth = Math.max(1, (widths.panelWidthVp - 24 - 9 - TOK_BORDER_W * 2 - 12) / 4);
    let navigationLabelHeight = 13.889;
    for (const label of ['目录', '朗读', '界面', '设置']) {
      const extent = measureReaderControlText(context, label,
        TYPE_READER_CONTROLS_RETAINED_MODULE_BUTTON_LABEL, navigationCellWidth, 'wrap');
      if (extent === undefined) return undefined;
      navigationLabelHeight = Math.max(navigationLabelHeight, extent.heightVp);
    }
    const headerPaint = measureHeader(context, module, widths.fullContentWidthVp, input.title);
    if (headerPaint === undefined) return undefined;
    const titleHeight = headerPaint.titleHeightVp;
    const collapseHeight = headerPaint.actionLabelHeightVp;
    const collapseWidth = headerPaint.actionPaintWidthVp;
    const headerHeight = headerPaint.heightVp;
    const normalNavigationHeight = 80 + navigationLabelHeight - 13.889;
    const topBarVisible = input.availableWithTopBarHeightVp === undefined ||
      input.availableWithTopBarHeightVp >= 29 + 18 + normalNavigationHeight + 13 + 44;
    // Secondary modules already return to Home through their registered Back
    // owner. Its duplicate navigation is optional in a constrained viewport.
    const navigationHeight = !topBarVisible && module !== 'home' ? 0 : normalNavigationHeight;
    const quickGap = topBarVisible ? 18 : 8;
    const automatic = measureReaderControlText(context, 'A', TYPE_READER_CONTROLS_RETAINED_BRIGHTNESS_RAIL_LABEL,
      READER_CONTROL_BRIGHTNESS_RAIL_WIDTH - TOK_BORDER_W * 2);
    if (automatic === undefined) return undefined;
    const automaticSize = Math.max(READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE,
      automatic.heightVp + TOK_BORDER_W * 2, automatic.singleLineWidthVp + TOK_BORDER_W * 2);
    const automaticHitHeight = Math.max(44, automaticSize);
    const quick = input.measureHomeForm(widths.quickContentWidthVp);
    const full = input.measureHomeForm(widths.fullContentWidthVp);
    if (quick === undefined || full === undefined) return undefined;
    const homeShortReserve = topBarVisible ? 0 : READER_CONTROL_HOME_SHORT_ACTION_HEIGHT + READER_CONTROL_HOME_SECTION_GAP;
    let minimum: ReaderControlModuleMinimum | undefined;
    let prepared: ReaderControlPreparedModuleMinimum | undefined;
    if (module === 'home') {
      minimum = { module: 'home', quick: { heightVp: quick.minimumHeight + homeShortReserve, minWidthVp: quick.minWidth, fits: quick.fits },
        full: { heightVp: full.minimumHeight + homeShortReserve, minWidthVp: full.minWidth, fits: full.fits } };
    } else {
      if (input.moduleFacts !== undefined) {
        prepared = measureReaderControlModuleMinimum(context, widths, module, input.moduleFacts);
        minimum = prepared?.minimum;
      } else if (input.preparedMinimumRequired !== true) {
        minimum = delegate?.(widths, key);
      }
      if (minimum === undefined || minimum.module !== module) return undefined;
    }
    // The brightness rail shares the same Quick vertical budget. Its real
    // cap label must fit without shortening the original actionable track.
    const brightnessMinimum = READER_CONTROL_BRIGHTNESS_RAIL_WIDTH + READER_CONTROL_BRIGHTNESS_ICON_SIZE / 2 +
      READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE / 2 + 2 * READER_CONTROL_BRIGHTNESS_CONTROL_GAP + 44 +
      (automaticHitHeight - READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE) / 2;
    minimum = { module: minimum.module,
      quick: { heightVp: Math.max(minimum.quick.heightVp, brightnessMinimum),
        minWidthVp: minimum.quick.minWidthVp, fits: minimum.quick.fits && automaticSize <= READER_CONTROL_BRIGHTNESS_RAIL_WIDTH - TOK_BORDER_W * 2 },
      full: minimum.full };
    // The same authored shell hosts every module. Its measured Home form and
    // fixed header vocabulary cannot change when the active module changes.
    let sharedHeaderHeight = 30;
    for (const sharedModule of ['directory', 'appearance', 'tts', 'settings', 'search', 'autoPage', 'replace']) {
      const sharedHeader = measureHeader(context, sharedModule, widths.fullContentWidthVp);
      if (sharedHeader === undefined) return undefined;
      sharedHeaderHeight = Math.max(sharedHeaderHeight, sharedHeader.heightVp);
    }
    const playbackData: ReaderControlPlaybackProfileData | undefined = prepared?.moduleData.tts !== undefined ?
      { tts: prepared.moduleData.tts, ttsFacts: input.moduleFacts?.tts } : prepared?.moduleData.autoPage !== undefined ?
        { autoPage: prepared.moduleData.autoPage, autoPageFacts: input.moduleFacts?.autoPage } :
      module === 'tts' || module === 'autoPage' ? profileReader?.(key) : undefined;
    const profile: ReaderControlMeasuredProfile = { module: module, moduleData: prepared?.moduleData,
      headerPaint: headerPaint, moduleFacts: input.moduleFacts, identity: input.identity,
      metricsRevision: input.metricsRevision, widths: widths,
      playbackData: playbackData,
      quick: quick, full: full,
      topBarVisible: topBarVisible, navigationLabelHeight: navigationLabelHeight, navigationHeight: navigationHeight,
      titleHeight: titleHeight, collapseLabelHeight: collapseHeight,
      collapseWidth: collapseWidth, headerHeight: headerHeight };
    const result: ReaderControlCandidateMinimum = { key: key, widths: widths, minimum: minimum,
      chrome: { topBarVisible: topBarVisible, topBarHeightVp: input.topBarHeightVp, quickReserveVp: 29 + quickGap + navigationHeight + 13,
        fullReserveVp: 19 + headerHeight + 8 + 13, navigationHeightVp: navigationHeight,
        headerHeightVp: headerHeight, brightnessAutoHeightVp: automaticSize,
        brightnessAutoWidthVp: automaticSize },
      sharedShell: {
        minimum: { module: 'home',
          quick: { heightVp: Math.max(quick.minimumHeight + homeShortReserve, brightnessMinimum),
            minWidthVp: quick.minWidth, fits: quick.fits && automaticSize <= READER_CONTROL_BRIGHTNESS_RAIL_WIDTH - TOK_BORDER_W * 2 },
          full: { heightVp: full.minimumHeight + homeShortReserve, minWidthVp: full.minWidth, fits: full.fits } },
        chrome: { topBarVisible: topBarVisible, topBarHeightVp: input.topBarHeightVp,
          quickReserveVp: 29 + quickGap + normalNavigationHeight + 13,
          fullReserveVp: 19 + sharedHeaderHeight + 8 + 13, navigationHeightVp: normalNavigationHeight,
          headerHeightVp: sharedHeaderHeight, brightnessAutoHeightVp: automaticSize,
          brightnessAutoWidthVp: automaticSize } } };
    return { candidate: result, profile: profile };
}

/** Geometry equality excludes request and owner metadata, while retaining every measured paint/target/scroll budget. */
export function readerControlMeasuredProfileGeometryKey(profile: ReaderControlMeasuredProfile): string {
  return JSON.stringify([profile.module, profile.widths, profile.quick, profile.full,
    profile.topBarVisible, profile.navigationLabelHeight, profile.navigationHeight,
    profile.titleHeight, profile.collapseLabelHeight, profile.collapseWidth, profile.headerHeight,
    profile.headerPaint, profile.moduleData, profile.playbackData?.tts, profile.playbackData?.autoPage,
    profile.playbackData?.ttsPlaybackErrorHeight]);
}

/** Only fields consumed by the pure measurers enter this key. Display rows,
 * results, rules and business snapshots are immutable references elsewhere. */
export function readerControlModuleFactsGeometryKey(facts: ReaderControlModuleFacts): string {
  const directory = facts.directory;
  const search = facts.search;
  const tts = facts.tts;
  const appearance = facts.appearance;
  const replacement = facts.replace;
  return JSON.stringify([facts.module, facts.home?.chapterTitle, facts.home?.totalChapters,
    directory === undefined ? undefined : [directory.tab, directory.title, directory.excerpt,
      directory.currentTitle, directory.currentPosition, directory.hasRows, directory.loading,
      directory.message, directory.action, directory.bookmarkError, directory.bookmarkFilteredEmpty,
      directory.catalogStatus, directory.catalogAction],
    search === undefined ? undefined : [search.query, search.title, search.snippet, search.message,
      search.hasResults, search.resultsMode, search.loading, search.loadMoreLabel, search.loadMoreMessage],
    tts === undefined ? undefined : [tts.playbackLabel, tts.status, tts.voice, tts.timerCaption,
      tts.timerSummary, tts.minutes, tts.seconds, tts.rate, tts.error, tts.seek, tts.online,
      tts.serviceDescription, tts.manageLabel, tts.manageBorderWidth, tts.engineValue, tts.languageValue, tts.failureValue],
    appearance === undefined ? undefined : [appearance.themes, appearance.themeSummary, appearance.themeActions,
      appearance.fonts.map((font: ReaderControlAppearanceFontMinimumInput): string[] => [font.label, font.family]), appearance.indentValue, appearance.languageValue,
      appearance.indentOptions, appearance.languageOptions, appearance.metricLabels, appearance.metricValues],
    facts.settings?.groupLabels, facts.settings?.optionLabels, facts.settings?.toggleLabels,
    facts.autoPage?.status, facts.autoPage?.timerSummary,
    replacement === undefined ? undefined : [replacement.statusText, replacement.recoveryLabel,
      replacement.name, replacement.pattern, replacement.meta, replacement.temporaryTitle,
      replacement.editorOpen, replacement.layerOpen, replacement.ruleCount, replacement.statusVisible]]);
}

export function readerControlModuleFactsDisplayEqual(first: ReaderControlModuleFacts | undefined,
  second: ReaderControlModuleFacts | undefined): boolean {
  if (first === second) return true;
  if (first === undefined || second === undefined ||
    readerControlModuleFactsGeometryKey(first) !== readerControlModuleFactsGeometryKey(second)) return false;
  if (first.module === 'directory') {
    const firstSnapshot = first.directory?.readViewSnapshot?.();
    const secondSnapshot = second.directory?.readViewSnapshot?.();
    return firstSnapshot === secondSnapshot || (firstSnapshot !== undefined && secondSnapshot !== undefined &&
      firstSnapshot.rows === secondSnapshot.rows && firstSnapshot.catalogState === secondSnapshot.catalogState &&
      firstSnapshot.loading === secondSnapshot.loading && firstSnapshot.targetRow === secondSnapshot.targetRow &&
      firstSnapshot.currentTitle === secondSnapshot.currentTitle && firstSnapshot.currentPosition === secondSnapshot.currentPosition);
  }
  if (first.module === 'search') return first.search?.readViewState?.() === second.search?.readViewState?.() &&
    first.search?.resultScope === second.search?.resultScope;
  if (first.module === 'tts') {
    const firstState = first.tts?.readViewState?.();
    const secondState = second.tts?.readViewState?.();
    // Compare the playback fields read by the controls. Transport and page-follow
    // facts are still delivered to their owners without republishing this layout.
    return firstState?.status === secondState?.status && firstState?.rate === secondState?.rate &&
      firstState?.totalSlices === secondState?.totalSlices && firstState?.sliceIndex === secondState?.sliceIndex &&
      firstState?.errorMessage === secondState?.errorMessage &&
      first.tts?.viewTimerMode === second.tts?.viewTimerMode && first.tts?.viewTimerMinutes === second.tts?.viewTimerMinutes &&
      first.tts?.viewTimerSeconds === second.tts?.viewTimerSeconds && first.tts?.viewRate === second.tts?.viewRate;
  }
  if (first.module === 'replace') return first.replace?.readViewState?.() === second.replace?.readViewState?.() &&
    first.replace?.viewLayer === second.replace?.viewLayer && first.replace?.viewLocalError === second.replace?.viewLocalError;
  if (first.module === 'appearance') {
    const firstAppearance = first.appearance;
    const secondAppearance = second.appearance;
    return firstAppearance?.readViewSnapshot?.() === secondAppearance?.readViewSnapshot?.() &&
      firstAppearance?.readViewFontOrder?.()?.join('|') === secondAppearance?.readViewFontOrder?.()?.join('|');
  }
  return true;
}
