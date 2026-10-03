import type { ReaderAppColorRole } from './ReaderThemeRegistry';
import {
  ReaderTextStyle, ReaderInheritedTextStyle, TYPE_SOURCE_TOOLS_ACTION,
  TYPE_SOURCE_TOOLS_COMPACT_ACTION, TYPE_SOURCE_TOOLS_BODY,
  TYPE_RULES_MANAGEMENT_ACTION, TYPE_RULES_COMPACT_ACTION,
  TYPE_RULES_MANAGEMENT_INPUT, TYPE_APP_COMPACT_PRIMARY_ACTION, TYPE_SYNC_INPUT,
  TYPE_FORM_LABEL_ACTION, TYPE_FORM_COMPACT_ACTION, TYPE_FORM_INPUT, TYPE_FORM_URL_INPUT,
  TYPE_APP_PRIMARY_ACTION, TYPE_APP_SECONDARY_ACTION, TYPE_APP_SMALL_LABEL, TYPE_RSS_STATE_ACTION, TYPE_RSS_LINK_ACTION,
} from './ReaderTypography';

export type ReaderButtonSpecId = 'source-action' | 'source-compact' | 'rules-action' | 'rules-compact' | 'sync-action' | 'form-action' | 'form-busy-action' | 'form-document-action' | 'search-primary' | 'search-secondary' | 'discover-page' | 'rss-mode-tab' | 'rss-state' | 'rss-source-link';
export type ReaderButtonLayout = 'intrinsic' | 'equal' | 'full';
export interface ReaderButtonSpec {
  text: ReaderTextStyle | ReaderInheritedTextStyle;
  height: number | undefined;
  radius: number;
  horizontalPadding: number;
  stacked: boolean;
  primarySurface: ReaderAppColorRole;
  secondarySurface: ReaderAppColorRole;
  primaryBorder: ReaderAppColorRole;
  secondaryBorder: ReaderAppColorRole;
  disabledOpacity: number;
  hasBorder: boolean;
  primaryText: ReaderAppColorRole;
  secondaryText: ReaderAppColorRole;
  verticalPadding: number;
  maxLines: number;
  fixedWidth: number;
  responseOffset: number | undefined;
  busyOpacity: number;
  centerText: boolean;
}
const SOURCE_ACTION: ReaderButtonSpec = {
  text: TYPE_SOURCE_TOOLS_ACTION, height: 42, radius: 8, horizontalPadding: 0, stacked: false,
  primarySurface: 'TOK_PRIMARY_DARK', secondarySurface: 'TOK_SURFACE_PANEL_SOFT',
  primaryBorder: 'TOK_PRIMARY_DARK', secondaryBorder: 'TOK_BORDER', disabledOpacity: 0.62, hasBorder: true,
  primaryText: 'TOK_ON_PRIMARY', secondaryText: 'TOK_PRIMARY_TEXT', verticalPadding: 0, maxLines: 0, fixedWidth: 0, responseOffset: undefined, busyOpacity: 1, centerText: true,
};
// Named variants retain current physical tuples; callers receive no style bag.
function copyReaderButtonSpec(): ReaderButtonSpec {
  return { text: SOURCE_ACTION.text, height: SOURCE_ACTION.height, radius: SOURCE_ACTION.radius,
    horizontalPadding: SOURCE_ACTION.horizontalPadding, stacked: SOURCE_ACTION.stacked,
    primarySurface: SOURCE_ACTION.primarySurface, secondarySurface: SOURCE_ACTION.secondarySurface,
    primaryBorder: SOURCE_ACTION.primaryBorder, secondaryBorder: SOURCE_ACTION.secondaryBorder,
    disabledOpacity: SOURCE_ACTION.disabledOpacity, hasBorder: SOURCE_ACTION.hasBorder,
    primaryText: SOURCE_ACTION.primaryText, secondaryText: SOURCE_ACTION.secondaryText, verticalPadding: SOURCE_ACTION.verticalPadding,
    maxLines: SOURCE_ACTION.maxLines, fixedWidth: SOURCE_ACTION.fixedWidth, responseOffset: SOURCE_ACTION.responseOffset, busyOpacity: SOURCE_ACTION.busyOpacity, centerText: SOURCE_ACTION.centerText };
}
const SOURCE_COMPACT: ReaderButtonSpec = copyReaderButtonSpec();
SOURCE_COMPACT.text = TYPE_SOURCE_TOOLS_COMPACT_ACTION;
SOURCE_COMPACT.height = 30; SOURCE_COMPACT.radius = 7; SOURCE_COMPACT.horizontalPadding = 10;
const RULES_ACTION: ReaderButtonSpec = copyReaderButtonSpec();
RULES_ACTION.text = TYPE_RULES_MANAGEMENT_ACTION; RULES_ACTION.height = 40;
const RULES_COMPACT: ReaderButtonSpec = copyReaderButtonSpec();
RULES_COMPACT.text = TYPE_RULES_COMPACT_ACTION;
RULES_COMPACT.height = 30; RULES_COMPACT.radius = 7; RULES_COMPACT.horizontalPadding = 12;
const SYNC_ACTION: ReaderButtonSpec = copyReaderButtonSpec();
SYNC_ACTION.text = TYPE_APP_COMPACT_PRIMARY_ACTION;
SYNC_ACTION.height = 40; SYNC_ACTION.radius = 10; SYNC_ACTION.stacked = true;
SYNC_ACTION.primarySurface = 'app.SyncPage.SOLID_BG'; SYNC_ACTION.secondarySurface = 'app.SyncPage.GHOST_BG';
SYNC_ACTION.primaryBorder = 'app.SyncPage.SOLID_BG'; SYNC_ACTION.secondaryBorder = 'app.SyncPage.GHOST_BORDER';
SYNC_ACTION.disabledOpacity = 1; SYNC_ACTION.centerText = false;
const FORM_ACTION: ReaderButtonSpec = copyReaderButtonSpec();
FORM_ACTION.text = TYPE_FORM_LABEL_ACTION; FORM_ACTION.height = 44;
FORM_ACTION.hasBorder = false; FORM_ACTION.disabledOpacity = 1;
const FORM_BUSY_ACTION: ReaderButtonSpec = copyReaderButtonSpec();
FORM_BUSY_ACTION.text = TYPE_FORM_LABEL_ACTION; FORM_BUSY_ACTION.height = 44; FORM_BUSY_ACTION.hasBorder = false;
const FORM_DOCUMENT_ACTION: ReaderButtonSpec = copyReaderButtonSpec();
FORM_DOCUMENT_ACTION.text = TYPE_FORM_COMPACT_ACTION; FORM_DOCUMENT_ACTION.height = 36;
FORM_DOCUMENT_ACTION.hasBorder = false; FORM_DOCUMENT_ACTION.disabledOpacity = 1;
FORM_DOCUMENT_ACTION.secondarySurface = 'TOK_PRIMARY_SOFT';
const SEARCH_PRIMARY: ReaderButtonSpec = copyReaderButtonSpec();
SEARCH_PRIMARY.centerText = false; SEARCH_PRIMARY.text = TYPE_APP_PRIMARY_ACTION; SEARCH_PRIMARY.height = undefined;
SEARCH_PRIMARY.radius = 999; SEARCH_PRIMARY.horizontalPadding = 18; SEARCH_PRIMARY.verticalPadding = 11.5;
SEARCH_PRIMARY.hasBorder = false; SEARCH_PRIMARY.disabledOpacity = 1; SEARCH_PRIMARY.responseOffset = -4;
SEARCH_PRIMARY.primarySurface = 'app.action.fill';
const SEARCH_SECONDARY: ReaderButtonSpec = copyReaderButtonSpec();
SEARCH_SECONDARY.centerText = false; SEARCH_SECONDARY.text = TYPE_APP_SECONDARY_ACTION; SEARCH_SECONDARY.height = undefined;
SEARCH_SECONDARY.radius = 999; SEARCH_SECONDARY.horizontalPadding = 18.5; SEARCH_SECONDARY.verticalPadding = 11.5;
SEARCH_SECONDARY.disabledOpacity = 1; SEARCH_SECONDARY.responseOffset = -4;
SEARCH_SECONDARY.secondarySurface = 'TOK_CARD_BG'; SEARCH_SECONDARY.secondaryText = 'TOK_MUTED';
const DISCOVER_PAGE: ReaderButtonSpec = copyReaderButtonSpec();
DISCOVER_PAGE.centerText = false; DISCOVER_PAGE.text = TYPE_APP_SMALL_LABEL; DISCOVER_PAGE.height = undefined;
DISCOVER_PAGE.radius = 999; DISCOVER_PAGE.horizontalPadding = 12; DISCOVER_PAGE.verticalPadding = 8;
DISCOVER_PAGE.hasBorder = false; DISCOVER_PAGE.disabledOpacity = 1; DISCOVER_PAGE.busyOpacity = 0.6;
DISCOVER_PAGE.primarySurface = 'app.action.fill'; DISCOVER_PAGE.secondarySurface = 'app.DiscoverPage.CHIP_BG';
DISCOVER_PAGE.secondaryText = 'TOK_MUTED';
const RSS_MODE: ReaderButtonSpec = copyReaderButtonSpec();
RSS_MODE.text = TYPE_APP_COMPACT_PRIMARY_ACTION; RSS_MODE.height = 30; RSS_MODE.radius = 999;
RSS_MODE.horizontalPadding = 10; RSS_MODE.stacked = true; RSS_MODE.maxLines = 1;
RSS_MODE.hasBorder = false; RSS_MODE.disabledOpacity = 1; RSS_MODE.responseOffset = -7;
RSS_MODE.primarySurface = 'app.action.fill'; RSS_MODE.secondarySurface = 'app.RssPage.SOFT_PILL_BG';
RSS_MODE.secondaryText = 'app.RssPage.statusTab.fontColor.FF564D44';
const RSS_STATE: ReaderButtonSpec = copyReaderButtonSpec();
RSS_STATE.centerText = false; RSS_STATE.text = TYPE_RSS_STATE_ACTION; RSS_STATE.height = 36; RSS_STATE.radius = 999;
RSS_STATE.stacked = true; RSS_STATE.maxLines = 1; RSS_STATE.fixedWidth = 88;
RSS_STATE.hasBorder = false; RSS_STATE.disabledOpacity = 1; RSS_STATE.responseOffset = -4;
RSS_STATE.primarySurface = 'app.action.fill'; RSS_STATE.secondarySurface = 'TOK_PRIMARY_SOFT';
const RSS_SOURCE_LINK: ReaderButtonSpec = copyReaderButtonSpec();
RSS_SOURCE_LINK.text = TYPE_RSS_LINK_ACTION; RSS_SOURCE_LINK.height = 28; RSS_SOURCE_LINK.radius = 999;
RSS_SOURCE_LINK.horizontalPadding = 9; RSS_SOURCE_LINK.hasBorder = false; RSS_SOURCE_LINK.disabledOpacity = 1;
RSS_SOURCE_LINK.secondarySurface = 'TOK_PRIMARY_SOFT'; RSS_SOURCE_LINK.responseOffset = -8;
const BUTTONS: Record<ReaderButtonSpecId, ReaderButtonSpec> = {
  'source-action': SOURCE_ACTION, 'source-compact': SOURCE_COMPACT,
  'rules-action': RULES_ACTION, 'rules-compact': RULES_COMPACT, 'sync-action': SYNC_ACTION,
  'form-action': FORM_ACTION, 'form-busy-action': FORM_BUSY_ACTION, 'form-document-action': FORM_DOCUMENT_ACTION,
  'search-primary': SEARCH_PRIMARY, 'search-secondary': SEARCH_SECONDARY, 'discover-page': DISCOVER_PAGE,
  'rss-mode-tab': RSS_MODE, 'rss-state': RSS_STATE, 'rss-source-link': RSS_SOURCE_LINK,
};
export function resolveReaderButtonSpec(id: ReaderButtonSpecId): ReaderButtonSpec { return BUTTONS[id]; }

export type ReaderFormFieldSpecId = 'source-debug' | 'rules-input' | 'sync-credential' | 'form-body' | 'form-url';
export interface ReaderFormFieldSpec {
  text: ReaderTextStyle | ReaderInheritedTextStyle;
  height: number;
  radius: number;
  horizontalPadding: number;
  textRole: ReaderAppColorRole;
  surfaceRole: ReaderAppColorRole;
  placeholderRole: ReaderAppColorRole | undefined;
}
const FIELDS: Record<ReaderFormFieldSpecId, ReaderFormFieldSpec> = {
  'form-body': { text: TYPE_FORM_INPUT, height: 44, radius: 8, horizontalPadding: 12,
    textRole: 'TOK_INK', surfaceRole: 'TOK_PAPER', placeholderRole: undefined },
  'form-url': { text: TYPE_FORM_URL_INPUT, height: 44, radius: 8, horizontalPadding: 12,
    textRole: 'TOK_INK', surfaceRole: 'TOK_SURFACE_FIELD', placeholderRole: 'TOK_MUTED' },
  'source-debug': { text: TYPE_SOURCE_TOOLS_BODY, height: 40, radius: 8, horizontalPadding: 12,
    textRole: 'TOK_INK', surfaceRole: 'TOK_PAPER', placeholderRole: undefined },
  'rules-input': { text: TYPE_RULES_MANAGEMENT_INPUT, height: 40, radius: 8, horizontalPadding: 12,
    textRole: 'TOK_INK', surfaceRole: 'TOK_PAPER', placeholderRole: undefined },
  'sync-credential': { text: TYPE_SYNC_INPUT, height: 36, radius: 6, horizontalPadding: 11,
    textRole: 'TOK_CONTROL_INK', surfaceRole: 'TOK_FIELD_SURFACE', placeholderRole: 'app.SyncPage.webdavInputRow.placeholderColor.FF9C9488' },
};
export function resolveReaderFormFieldSpec(id: ReaderFormFieldSpecId): ReaderFormFieldSpec { return FIELDS[id]; }
