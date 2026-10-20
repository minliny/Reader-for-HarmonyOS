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
function copyReaderChoiceSpec(): ReaderChoiceSpec {
  return {
    height: COMMON_ROW.height,
    padding: COMMON_ROW.padding,
    gap: COMMON_ROW.gap,
    radius: COMMON_ROW.radius,
    text: COMMON_ROW.text,
    selectedText: COMMON_ROW.selectedText,
    selectedWeight: COMMON_ROW.selectedWeight,
    variableWeight: COMMON_ROW.variableWeight,
    textRole: COMMON_ROW.textRole,
    selectedTextRole: COMMON_ROW.selectedTextRole,
    selectedBackground: COMMON_ROW.selectedBackground,
    dividerRole: COMMON_ROW.dividerRole,
    dividerHeight: COMMON_ROW.dividerHeight,
    iconDay: COMMON_ROW.iconDay,
    iconNight: COMMON_ROW.iconNight,
    iconWidth: COMMON_ROW.iconWidth,
    iconHeight: COMMON_ROW.iconHeight,
    showIcon: COMMON_ROW.showIcon,
    rotateIcon: COMMON_ROW.rotateIcon,
    layout: COMMON_ROW.layout,
    textLeft: COMMON_ROW.textLeft,
    textTop: COMMON_ROW.textTop,
    textHeight: COMMON_ROW.textHeight,
    textWidthInset: COMMON_ROW.textWidthInset,
    iconRight: COMMON_ROW.iconRight,
    iconTop: COMMON_ROW.iconTop,
    ellipsis: COMMON_ROW.ellipsis,
    textAlignStart: COMMON_ROW.textAlignStart,
  };
}
const CHOICE_SOURCE_GROUP_OPTION: ReaderChoiceSpec = copyReaderChoiceSpec();
CHOICE_SOURCE_GROUP_OPTION.padding = 14;
CHOICE_SOURCE_GROUP_OPTION.text = TYPE_SELECT_SOURCE_GROUP_VALUE;
CHOICE_SOURCE_GROUP_OPTION.selectedText = TYPE_SELECT_SOURCE_GROUP_VALUE;
CHOICE_SOURCE_GROUP_OPTION.textRole = 'TOK_INK';
CHOICE_SOURCE_GROUP_OPTION.selectedTextRole = 'TOK_INK';
const CHOICE_DEFAULT_SELECTED: ReaderChoiceSpec = copyReaderChoiceSpec();
CHOICE_DEFAULT_SELECTED.gap = 8;
CHOICE_DEFAULT_SELECTED.text = TYPE_SELECT_DEFAULT_VALUE;
CHOICE_DEFAULT_SELECTED.selectedText = TYPE_SELECT_DEFAULT_VALUE;
CHOICE_DEFAULT_SELECTED.selectedWeight = TYPE_SELECT_DEFAULT_VALUE.fontWeight;
CHOICE_DEFAULT_SELECTED.textRole = 'TOK_PRIMARY_TEXT';
CHOICE_DEFAULT_SELECTED.selectedTextRole = 'TOK_PRIMARY_TEXT';
CHOICE_DEFAULT_SELECTED.selectedBackground = 'TOK_SURFACE_PANEL_SOFT';
CHOICE_DEFAULT_SELECTED.iconDay = 'app.media.reader_chevron_down';
CHOICE_DEFAULT_SELECTED.iconNight = 'app.media.reader_chevron_down_theme_night';
CHOICE_DEFAULT_SELECTED.iconWidth = 12;
CHOICE_DEFAULT_SELECTED.iconHeight = 8;
CHOICE_DEFAULT_SELECTED.showIcon = 'always';
CHOICE_DEFAULT_SELECTED.rotateIcon = true;
const CHOICE_SOURCE_GROUP_SELECTED: ReaderChoiceSpec = copyReaderChoiceSpec();
CHOICE_SOURCE_GROUP_SELECTED.text = TYPE_SELECT_SOURCE_GROUP_VALUE;
CHOICE_SOURCE_GROUP_SELECTED.selectedText = TYPE_SELECT_SOURCE_GROUP_VALUE;
CHOICE_SOURCE_GROUP_SELECTED.selectedWeight = TYPE_SELECT_SOURCE_GROUP_VALUE.fontWeight;
CHOICE_SOURCE_GROUP_SELECTED.textRole = 'TOK_INK';
CHOICE_SOURCE_GROUP_SELECTED.selectedTextRole = 'TOK_INK';
CHOICE_SOURCE_GROUP_SELECTED.selectedBackground = 'app.ReaderSelectPanel.sourceGroupSelectedRow.backgroundColor.FFFFFCF8';
CHOICE_SOURCE_GROUP_SELECTED.iconDay = 'app.media.source_group_chevron';
CHOICE_SOURCE_GROUP_SELECTED.iconNight = 'app.media.source_group_chevron_theme_night';
CHOICE_SOURCE_GROUP_SELECTED.iconWidth = 12;
CHOICE_SOURCE_GROUP_SELECTED.iconHeight = 12;
CHOICE_SOURCE_GROUP_SELECTED.showIcon = 'always';
CHOICE_SOURCE_GROUP_SELECTED.rotateIcon = true;
CHOICE_SOURCE_GROUP_SELECTED.layout = 'positioned';
CHOICE_SOURCE_GROUP_SELECTED.textLeft = 14;
CHOICE_SOURCE_GROUP_SELECTED.textTop = 10;
CHOICE_SOURCE_GROUP_SELECTED.textHeight = 15;
CHOICE_SOURCE_GROUP_SELECTED.textWidthInset = 42;
CHOICE_SOURCE_GROUP_SELECTED.iconRight = 21;
CHOICE_SOURCE_GROUP_SELECTED.iconTop = 12;
const CHOICE_APPEARANCE_COMPACT_SELECTED: ReaderChoiceSpec = copyReaderChoiceSpec();
CHOICE_APPEARANCE_COMPACT_SELECTED.text = TYPE_SELECT_APPEARANCE_VALUE;
CHOICE_APPEARANCE_COMPACT_SELECTED.selectedText = TYPE_SELECT_APPEARANCE_VALUE;
CHOICE_APPEARANCE_COMPACT_SELECTED.selectedWeight = TYPE_SELECT_APPEARANCE_VALUE.fontWeight;
CHOICE_APPEARANCE_COMPACT_SELECTED.textRole = 'TOK_PRIMARY_TEXT';
CHOICE_APPEARANCE_COMPACT_SELECTED.selectedTextRole = 'TOK_PRIMARY_TEXT';
CHOICE_APPEARANCE_COMPACT_SELECTED.selectedBackground = 'TOK_SURFACE_PANEL_SOFT';
CHOICE_APPEARANCE_COMPACT_SELECTED.iconDay = 'app.media.reader_chevron_down';
CHOICE_APPEARANCE_COMPACT_SELECTED.iconNight = 'app.media.reader_chevron_down_theme_night';
CHOICE_APPEARANCE_COMPACT_SELECTED.iconWidth = 8;
CHOICE_APPEARANCE_COMPACT_SELECTED.iconHeight = 4;
CHOICE_APPEARANCE_COMPACT_SELECTED.showIcon = 'always';
CHOICE_APPEARANCE_COMPACT_SELECTED.rotateIcon = true;
CHOICE_APPEARANCE_COMPACT_SELECTED.layout = 'positioned';
CHOICE_APPEARANCE_COMPACT_SELECTED.textLeft = 10;
CHOICE_APPEARANCE_COMPACT_SELECTED.textTop = 11;
CHOICE_APPEARANCE_COMPACT_SELECTED.textHeight = 14;
CHOICE_APPEARANCE_COMPACT_SELECTED.textWidthInset = 28;
CHOICE_APPEARANCE_COMPACT_SELECTED.iconRight = 14;
CHOICE_APPEARANCE_COMPACT_SELECTED.iconTop = 16;
const CHOICE_APPEARANCE_LIBRARY: ReaderChoiceSpec = copyReaderChoiceSpec();
CHOICE_APPEARANCE_LIBRARY.height = 25;
CHOICE_APPEARANCE_LIBRARY.padding = 9;
CHOICE_APPEARANCE_LIBRARY.gap = 10;
CHOICE_APPEARANCE_LIBRARY.radius = 6;
CHOICE_APPEARANCE_LIBRARY.text = TYPE_SELECT_APPEARANCE_LIBRARY_OPTION_REGULAR;
CHOICE_APPEARANCE_LIBRARY.selectedText = TYPE_SELECT_APPEARANCE_LIBRARY_OPTION_SELECTED;
CHOICE_APPEARANCE_LIBRARY.selectedWeight = 700;
CHOICE_APPEARANCE_LIBRARY.variableWeight = true;
CHOICE_APPEARANCE_LIBRARY.textAlignStart = false;
CHOICE_APPEARANCE_LIBRARY.textRole = 'app.ReaderSelectPanel.appearanceLibraryOption.fontColor.FF41484C';
CHOICE_APPEARANCE_LIBRARY.selectedTextRole = 'app.ReaderSelectPanel.appearanceLibraryOption.fontColor.FF2F6373';
CHOICE_APPEARANCE_LIBRARY.selectedBackground = 'app.appearance.selectSelected';
CHOICE_APPEARANCE_LIBRARY.iconDay = 'app.media.reader_appearance_make_check';
CHOICE_APPEARANCE_LIBRARY.iconNight = 'app.media.reader_appearance_make_check_theme_night';
CHOICE_APPEARANCE_LIBRARY.iconWidth = 11;
CHOICE_APPEARANCE_LIBRARY.iconHeight = 9;
CHOICE_APPEARANCE_LIBRARY.showIcon = 'selected';
const CHOICE_SETTINGS_PHONE: ReaderChoiceSpec = copyReaderChoiceSpec();
CHOICE_SETTINGS_PHONE.height = 52;
CHOICE_SETTINGS_PHONE.padding = 16;
CHOICE_SETTINGS_PHONE.text = TYPE_SETTINGS_SELECT_PHONE_OPTION;
CHOICE_SETTINGS_PHONE.selectedText = TYPE_SETTINGS_SELECT_PHONE_OPTION;
CHOICE_SETTINGS_PHONE.selectedWeight = 700;
CHOICE_SETTINGS_PHONE.ellipsis = false;
CHOICE_SETTINGS_PHONE.textAlignStart = false;
CHOICE_SETTINGS_PHONE.textRole = 'app.SettingsSelectOverlay.phoneOption.fontColor.FF1F1B17';
CHOICE_SETTINGS_PHONE.selectedTextRole = 'app.SettingsSelectOverlay.phoneOption.fontColor.FF2D4A3E';
CHOICE_SETTINGS_PHONE.selectedBackground = 'app.SettingsSelectOverlay.phoneOption.backgroundColor.0D2D4A3E';
CHOICE_SETTINGS_PHONE.dividerRole = 'app.SettingsSelectOverlay.phoneOption.backgroundColor.FFC1C7CD';
CHOICE_SETTINGS_PHONE.dividerHeight = 1;
CHOICE_SETTINGS_PHONE.iconDay = 'app.media.settings_select_check';
CHOICE_SETTINGS_PHONE.iconNight = 'app.media.settings_select_check_theme_night';
CHOICE_SETTINGS_PHONE.iconWidth = 16;
CHOICE_SETTINGS_PHONE.iconHeight = 16;
CHOICE_SETTINGS_PHONE.showIcon = 'selected';
const CHOICE_SETTINGS_TABLET: ReaderChoiceSpec = copyReaderChoiceSpec();
CHOICE_SETTINGS_TABLET.height = 42;
CHOICE_SETTINGS_TABLET.padding = 14;
CHOICE_SETTINGS_TABLET.text = TYPE_SETTINGS_SELECT_TABLET_OPTION;
CHOICE_SETTINGS_TABLET.selectedText = TYPE_SETTINGS_SELECT_TABLET_OPTION;
CHOICE_SETTINGS_TABLET.selectedWeight = 700;
CHOICE_SETTINGS_TABLET.ellipsis = false;
CHOICE_SETTINGS_TABLET.textAlignStart = false;
CHOICE_SETTINGS_TABLET.textRole = 'app.SettingsSelectOverlay.tabletOption.fontColor.FF1F1B17';
CHOICE_SETTINGS_TABLET.selectedTextRole = 'app.SettingsSelectOverlay.tabletOption.fontColor.FF2D4A3E';
CHOICE_SETTINGS_TABLET.selectedBackground = 'app.SettingsSelectOverlay.tabletOption.backgroundColor.0F2D4A3E';
CHOICE_SETTINGS_TABLET.dividerRole = 'app.SettingsSelectOverlay.tabletOption.backgroundColor.FFC1C7CD';
CHOICE_SETTINGS_TABLET.dividerHeight = 1;
CHOICE_SETTINGS_TABLET.iconDay = 'app.media.settings_select_check';
CHOICE_SETTINGS_TABLET.iconNight = 'app.media.settings_select_check_theme_night';
CHOICE_SETTINGS_TABLET.iconWidth = 14;
CHOICE_SETTINGS_TABLET.iconHeight = 14;
CHOICE_SETTINGS_TABLET.showIcon = 'selected';

const CHOICES: Record<ReaderChoiceSpecId, ReaderChoiceSpec> = {
  'default-option': COMMON_ROW,
  'source-group-option': CHOICE_SOURCE_GROUP_OPTION,
  'default-selected': CHOICE_DEFAULT_SELECTED,
  'source-group-selected': CHOICE_SOURCE_GROUP_SELECTED,
  'appearance-compact-selected': CHOICE_APPEARANCE_COMPACT_SELECTED,
  'appearance-library': CHOICE_APPEARANCE_LIBRARY,
  'settings-phone': CHOICE_SETTINGS_PHONE,
  'settings-tablet': CHOICE_SETTINGS_TABLET,
};

export function resolveReaderChoiceSpec(id: ReaderChoiceSpecId): ReaderChoiceSpec { return CHOICES[id]; }
