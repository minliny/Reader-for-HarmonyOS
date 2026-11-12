import type { UIContext } from '@ohos.arkui.UIContext';
import { measureReaderControlText } from './ReaderControlTextMeasurement';
import { TYPE_READER_CONTROL_COLLAPSE_INTER, TYPE_READER_CONTROL_COLLAPSE_UI,
  TYPE_READER_CONTROL_HEADER_INTER, TYPE_READER_CONTROL_HEADER_UI,
  TYPE_READER_CONTROLS_RETAINED_MODULE_BUTTON_LABEL,
  TYPE_READER_CONTROLS_RETAINED_BRIGHTNESS_RAIL_LABEL } from '../../../ui/foundation/ReaderTypography';
import { TOK_BORDER_W } from '../../../ui/foundation/ReaderTokens';
import { READER_CONTROL_BRIGHTNESS_RAIL_WIDTH, READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE,
  READER_CONTROL_BRIGHTNESS_ICON_SIZE, READER_CONTROL_BRIGHTNESS_CONTROL_GAP } from './ReaderControlGeometry';
import type { ReaderControlCandidateWidths, ReaderControlCandidateMinimum,
  ReaderControlModuleMinimum, ReaderControlModuleMeasurer, ReaderControlContentModule } from './ReaderLayoutGeometry';
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

export interface ReaderControlMeasuredProfile {
  module: ReaderControlContentModule;
  identity: string;
  metricsRevision: number;
  widths: ReaderControlCandidateWidths;
  playbackData: ReaderControlPlaybackProfileData | undefined;
  quick: ReaderControlHomeFormProfile | undefined;
  full: ReaderControlHomeFormProfile | undefined;
  navigationLabelHeight: number;
  navigationHeight: number;
  titleHeight: number;
  collapseLabelHeight: number;
  collapseWidth: number;
  headerHeight: number;
}

export interface ReaderControlMinimumMeasurementInput {
  context: UIContext;
  headerInter: boolean;
  title: string;
  identity: string;
  metricsRevision: number;
  measureHomeForm: (width: number) => ReaderControlHomeFormProfile | undefined;
}
export interface ReaderControlMinimumMeasurement {
  candidate: ReaderControlCandidateMinimum;
  profile: ReaderControlMeasuredProfile;
}

/** Actual SDK text/module measurement. Profiles are returned to the original
 * Panel; this adapter holds no provider, font, map or lifecycle state. */
export function measureReaderControlMinimum(input: ReaderControlMinimumMeasurementInput,
  module: ReaderControlContentModule, widths: ReaderControlCandidateWidths, key: string,
  delegate: ReaderControlModuleMeasurer | undefined,
  profileReader?: ReaderControlPlaybackProfileReader): ReaderControlMinimumMeasurement | undefined {
    const context = input.context;
    const navigationCellWidth = Math.max(1, (widths.panelWidthVp - 24 - 9 - TOK_BORDER_W * 2 - 12) / 4);
    let navigationLabelHeight = 15;
    for (const label of ['目录', '朗读', '界面', '设置']) {
      const extent = measureReaderControlText(context, label,
        TYPE_READER_CONTROLS_RETAINED_MODULE_BUTTON_LABEL, navigationCellWidth, 'wrap');
      if (extent === undefined) return undefined;
      navigationLabelHeight = Math.max(navigationLabelHeight, extent.heightVp);
    }
    const collapseStyle = input.headerInter ? TYPE_READER_CONTROL_COLLAPSE_INTER : TYPE_READER_CONTROL_COLLAPSE_UI;
    const titleStyle = input.headerInter ? TYPE_READER_CONTROL_HEADER_INTER : TYPE_READER_CONTROL_HEADER_UI;
    const collapse = measureReaderControlText(context, '收起', collapseStyle, widths.fullContentWidthVp);
    if (collapse === undefined) return undefined;
    const collapseWidth = Math.max(40, collapse.singleLineWidthVp + 20);
    const title = measureReaderControlText(context, input.title, titleStyle,
      Math.max(1, widths.fullContentWidthVp - collapseWidth - 34));
    if (title === undefined) return undefined;
    const titleHeight = Math.max(input.headerInter ? 17 : 20, title.heightVp);
    const collapseHeight = Math.max(input.headerInter ? 12 : 14, collapse.heightVp);
    const headerHeight = Math.max(30, titleHeight + (input.headerInter ? 13 : 10),
      collapseHeight + (input.headerInter ? 14 : 12) + 4);
    const navigationHeight = 80 + navigationLabelHeight - 15;
    const automatic = measureReaderControlText(context, 'A', TYPE_READER_CONTROLS_RETAINED_BRIGHTNESS_RAIL_LABEL,
      READER_CONTROL_BRIGHTNESS_RAIL_WIDTH - TOK_BORDER_W * 2);
    if (automatic === undefined) return undefined;
    const automaticHeight = Math.max(READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE, automatic.heightVp);
    const automaticWidth = Math.max(READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE, automatic.singleLineWidthVp);
    const quick = module === 'home' ? input.measureHomeForm(widths.quickContentWidthVp) : undefined;
    const full = module === 'home' ? input.measureHomeForm(widths.fullContentWidthVp) : undefined;
    let minimum: ReaderControlModuleMinimum | undefined;
    if (module === 'home') {
      if (quick === undefined || full === undefined) return undefined;
      minimum = { module: 'home', quick: { heightVp: quick.minimumHeight, minWidthVp: quick.minWidth, fits: quick.fits },
        full: { heightVp: full.minimumHeight, minWidthVp: full.minWidth, fits: full.fits } };
    } else {
      minimum = delegate?.(widths, key);
      if (minimum === undefined || minimum.module !== module) return undefined;
    }
    // The brightness rail shares the same Quick vertical budget. Its real
    // cap label must fit without shortening the original actionable track.
    const brightnessMinimum = READER_CONTROL_BRIGHTNESS_RAIL_WIDTH + READER_CONTROL_BRIGHTNESS_ICON_SIZE / 2 +
      READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE / 2 + 2 * READER_CONTROL_BRIGHTNESS_CONTROL_GAP +
      READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE + automaticHeight - READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE;
    minimum = { module: minimum.module,
      quick: { heightVp: Math.max(minimum.quick.heightVp, brightnessMinimum),
        minWidthVp: minimum.quick.minWidthVp, fits: minimum.quick.fits && automaticWidth <= READER_CONTROL_BRIGHTNESS_RAIL_WIDTH - 2 },
      full: minimum.full };
    const profile: ReaderControlMeasuredProfile = { module: module, identity: input.identity,
      metricsRevision: input.metricsRevision, widths: widths,
      playbackData: module === 'tts' || module === 'autoPage' ? profileReader?.(key) : undefined,
      quick: quick, full: full,
      navigationLabelHeight: navigationLabelHeight, navigationHeight: navigationHeight,
      titleHeight: titleHeight, collapseLabelHeight: collapseHeight,
      collapseWidth: collapseWidth, headerHeight: headerHeight };
    const result: ReaderControlCandidateMinimum = { key: key, widths: widths, minimum: minimum,
      chrome: { quickReserveVp: 29 + 18 + navigationHeight + 13,
        fullReserveVp: 19 + headerHeight + 8 + 13, navigationHeightVp: navigationHeight,
        headerHeightVp: headerHeight, brightnessAutoHeightVp: automaticHeight,
        brightnessAutoWidthVp: automaticWidth } };
    return { candidate: result, profile: profile };
}
