import type { ReaderAppColorRole } from './ReaderThemeRegistry';
import {
  ReaderTextStyle, TYPE_SELECT_DEFAULT_VALUE, TYPE_SELECT_OPTION,
  TYPE_SELECT_SOURCE_GROUP_VALUE, TYPE_SELECT_APPEARANCE_VALUE,
  TYPE_SETTINGS_SELECT_PHONE_OPTION, TYPE_SETTINGS_SELECT_TABLET_OPTION,
  TYPE_SELECT_APPEARANCE_LIBRARY_OPTION_REGULAR, TYPE_SELECT_APPEARANCE_LIBRARY_OPTION_SELECTED,
} from './ReaderTypography';

export type ReaderChoiceSpecId = 'settings-phone' | 'settings-tablet' | 'appearance-library' |
  'default-selected' | 'source-group-selected' | 'appearance-compact-selected' | 'default-option' | 'source-group-option';
export type ReaderChoiceLayout = 'row' | 'positioned';

export interface ReaderChoiceSpec {
  height: number;
  padding: number;
  gap: number;
  radius: number;
  text: ReaderTextStyle;
  selectedText: ReaderTextStyle;
  selectedWeight: number;
  variableWeight: boolean;
  textRole: ReaderAppColorRole;
  selectedTextRole: ReaderAppColorRole;
  selectedBackground: ReaderAppColorRole | undefined;
  dividerRole: ReaderAppColorRole | undefined;
  dividerHeight: number;
  iconDay: string;
  iconNight: string;
  iconWidth: number;
  iconHeight: number;
  showIcon: 'always' | 'selected' | 'never';
  rotateIcon: boolean;
  layout: ReaderChoiceLayout;
  textLeft: number;
  textTop: number;
  textHeight: number;
  textWidthInset: number;
  iconRight: number;
  iconTop: number;
  ellipsis: boolean;
  textAlignStart: boolean;
}

const COMMON_ROW: ReaderChoiceSpec = {
  height: 36, padding: 10, gap: 0, radius: 0,
  text: TYPE_SELECT_OPTION, selectedText: TYPE_SELECT_OPTION,
  selectedWeight: TYPE_SELECT_OPTION.fontWeight, variableWeight: false,
  textRole: 'TOK_CONTROL_INK', selectedTextRole: 'TOK_CONTROL_INK',
  selectedBackground: undefined, dividerRole: undefined, dividerHeight: 0,
  iconDay: '', iconNight: '', iconWidth: 0, iconHeight: 0, showIcon: 'never', rotateIcon: false,
  layout: 'row', textLeft: 0, textTop: 0, textHeight: 0, textWidthInset: 0, iconRight: 0, iconTop: 0,
  ellipsis: true, textAlignStart: true,
};

// A finite registry preserves every current geometry/typography tuple. It is
// not an arbitrary style bag exposed to page callers.
const CHOICES: Record<ReaderChoiceSpecId, ReaderChoiceSpec> = {
  'default-option': COMMON_ROW,
  'source-group-option': { ...COMMON_ROW, padding: 14, text: TYPE_SELECT_SOURCE_GROUP_VALUE,
    selectedText: TYPE_SELECT_SOURCE_GROUP_VALUE, textRole: 'TOK_INK', selectedTextRole: 'TOK_INK' },
  'default-selected': { ...COMMON_ROW, gap: 8, text: TYPE_SELECT_DEFAULT_VALUE,
    selectedText: TYPE_SELECT_DEFAULT_VALUE, selectedWeight: TYPE_SELECT_DEFAULT_VALUE.fontWeight,
    textRole: 'TOK_PRIMARY_TEXT', selectedTextRole: 'TOK_PRIMARY_TEXT', selectedBackground: 'TOK_SURFACE_PANEL_SOFT',
    iconDay: 'app.media.reader_chevron_down', iconNight: 'app.media.reader_chevron_down_theme_night',
    iconWidth: 12, iconHeight: 8, showIcon: 'always', rotateIcon: true },
  'source-group-selected': { ...COMMON_ROW, text: TYPE_SELECT_SOURCE_GROUP_VALUE,
    selectedText: TYPE_SELECT_SOURCE_GROUP_VALUE, selectedWeight: TYPE_SELECT_SOURCE_GROUP_VALUE.fontWeight,
    textRole: 'TOK_INK', selectedTextRole: 'TOK_INK',
    selectedBackground: 'app.ReaderSelectPanel.sourceGroupSelectedRow.backgroundColor.FFFFFCF8',
    iconDay: 'app.media.source_group_chevron', iconNight: 'app.media.source_group_chevron_theme_night',
    iconWidth: 12, iconHeight: 12, showIcon: 'always', rotateIcon: true,
    layout: 'positioned', textLeft: 14, textTop: 10, textHeight: 15, textWidthInset: 42, iconRight: 21, iconTop: 12 },
  'appearance-compact-selected': { ...COMMON_ROW, text: TYPE_SELECT_APPEARANCE_VALUE,
    selectedText: TYPE_SELECT_APPEARANCE_VALUE, selectedWeight: TYPE_SELECT_APPEARANCE_VALUE.fontWeight,
    textRole: 'TOK_PRIMARY_TEXT', selectedTextRole: 'TOK_PRIMARY_TEXT', selectedBackground: 'TOK_SURFACE_PANEL_SOFT',
    iconDay: 'app.media.reader_chevron_down', iconNight: 'app.media.reader_chevron_down_theme_night',
    iconWidth: 8, iconHeight: 4, showIcon: 'always', rotateIcon: true,
    layout: 'positioned', textLeft: 10, textTop: 11, textHeight: 14, textWidthInset: 28, iconRight: 14, iconTop: 16 },
  'appearance-library': { ...COMMON_ROW, height: 25, padding: 9, gap: 10, radius: 6,
    text: TYPE_SELECT_APPEARANCE_LIBRARY_OPTION_REGULAR, selectedText: TYPE_SELECT_APPEARANCE_LIBRARY_OPTION_SELECTED,
    selectedWeight: 700, variableWeight: true, textAlignStart: false,
    textRole: 'app.ReaderSelectPanel.appearanceLibraryOption.fontColor.FF41484C',
    selectedTextRole: 'app.ReaderSelectPanel.appearanceLibraryOption.fontColor.FF2F6373',
    selectedBackground: 'app.appearance.selectSelected',
    iconDay: 'app.media.reader_appearance_make_check', iconNight: 'app.media.reader_appearance_make_check_theme_night',
    iconWidth: 11, iconHeight: 9, showIcon: 'selected' },
  'settings-phone': { ...COMMON_ROW, height: 52, padding: 16, text: TYPE_SETTINGS_SELECT_PHONE_OPTION,
    selectedText: TYPE_SETTINGS_SELECT_PHONE_OPTION, selectedWeight: 700, ellipsis: false, textAlignStart: false,
    textRole: 'app.SettingsSelectOverlay.phoneOption.fontColor.FF1F1B17',
    selectedTextRole: 'app.SettingsSelectOverlay.phoneOption.fontColor.FF2D4A3E',
    selectedBackground: 'app.SettingsSelectOverlay.phoneOption.backgroundColor.0D2D4A3E',
    dividerRole: 'app.SettingsSelectOverlay.phoneOption.backgroundColor.FFC1C7CD', dividerHeight: 1,
    iconDay: 'app.media.settings_select_check', iconNight: 'app.media.settings_select_check_theme_night',
    iconWidth: 16, iconHeight: 16, showIcon: 'selected' },
  'settings-tablet': { ...COMMON_ROW, height: 42, padding: 14, text: TYPE_SETTINGS_SELECT_TABLET_OPTION,
    selectedText: TYPE_SETTINGS_SELECT_TABLET_OPTION, selectedWeight: 700, ellipsis: false, textAlignStart: false,
    textRole: 'app.SettingsSelectOverlay.tabletOption.fontColor.FF1F1B17',
    selectedTextRole: 'app.SettingsSelectOverlay.tabletOption.fontColor.FF2D4A3E',
    selectedBackground: 'app.SettingsSelectOverlay.tabletOption.backgroundColor.0F2D4A3E',
    dividerRole: 'app.SettingsSelectOverlay.tabletOption.backgroundColor.FFC1C7CD', dividerHeight: 1,
    iconDay: 'app.media.settings_select_check', iconNight: 'app.media.settings_select_check_theme_night',
    iconWidth: 14, iconHeight: 14, showIcon: 'selected' },
};

export function resolveReaderChoiceSpec(id: ReaderChoiceSpecId): ReaderChoiceSpec { return CHOICES[id]; }
