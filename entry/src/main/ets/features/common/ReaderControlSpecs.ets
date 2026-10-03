import { TOK_SPACE_XS } from './ReaderTokens';
import type { ReaderAppColorRole } from './ReaderThemeRegistry';
import {
  ReaderTextStyle, ReaderInheritedTextStyle, TYPE_FORM_HINT, TYPE_SOURCE_TOOLS_ACTION,
  TYPE_SOURCE_TOOLS_COMPACT_ACTION, TYPE_SOURCE_TOOLS_BODY,
  TYPE_RULES_MANAGEMENT_ACTION, TYPE_RULES_COMPACT_ACTION,
  TYPE_RULES_MANAGEMENT_INPUT, TYPE_APP_COMPACT_PRIMARY_ACTION, TYPE_SYNC_INPUT,
  TYPE_FORM_LABEL_ACTION, TYPE_FORM_COMPACT_ACTION, TYPE_FORM_INPUT, TYPE_FORM_URL_INPUT,
  TYPE_APP_PRIMARY_ACTION, TYPE_APP_SECONDARY_ACTION, TYPE_APP_SMALL_LABEL, TYPE_RSS_STATE_ACTION, TYPE_RSS_LINK_ACTION,
  TYPE_SHELF_MANAGEMENT_BUTTON, TYPE_SHELF_MANAGEMENT_SMALL_ACTION, TYPE_SHELF_MANAGEMENT_ROW_ACTION, TYPE_RSS_BOTTOM_ACTION, TYPE_SOURCE_TOOLS_CODE_INPUT,
} from './ReaderTypography';

export type ReaderButtonSpecId = 'source-action' | 'source-compact' | 'rules-action' | 'rules-compact' | 'sync-action' | 'form-action' | 'form-busy-action' | 'form-document-action' | 'search-primary' | 'search-secondary' | 'discover-page' | 'rss-mode-tab' | 'rss-state' | 'rss-source-link' | 'shelf-action' | 'shelf-small' | 'shelf-row-edit' | 'shelf-row-select' | 'rss-detail-bottom' | 'rss-filter' | 'sync-config-test' | 'sync-config-save' | 'source-management-retry' | 'source-management-category' | 'source-management-status-compact' | 'source-management-status-wide' | 'source-management-detect' | 'source-management-login' | 'source-management-manage';
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
  primaryDisabledOpacity: number | undefined;
  hasBorder: boolean;
  primaryHasBorder: boolean;
  hasSurface: boolean;
  outerRadius: boolean;
  primaryText: ReaderAppColorRole;
  secondaryText: ReaderAppColorRole;
  verticalPadding: number;
  allPadding: number | undefined;
  maxLines: number;
  fixedWidth: number;
  responseOffset: number | undefined;
  busyOpacity: number;
  centerText: boolean;
  outerMargin: { right: number; bottom: number } | undefined;
  responsiveStatusWidth: boolean;
}
const SOURCE_ACTION: ReaderButtonSpec = {
  text: TYPE_SOURCE_TOOLS_ACTION, height: 42, radius: 8, horizontalPadding: 0, stacked: false,
  primarySurface: 'TOK_PRIMARY_DARK', secondarySurface: 'TOK_SURFACE_PANEL_SOFT',
  primaryBorder: 'TOK_PRIMARY_DARK', secondaryBorder: 'TOK_BORDER', disabledOpacity: 0.62, primaryDisabledOpacity: undefined, hasBorder: true, primaryHasBorder: true, hasSurface: true, outerRadius: true,
  primaryText: 'TOK_ON_PRIMARY', secondaryText: 'TOK_PRIMARY_TEXT', verticalPadding: 0, allPadding: undefined, maxLines: 0, fixedWidth: 0, responseOffset: undefined, busyOpacity: 1, centerText: true, outerMargin: undefined, responsiveStatusWidth: false,
};
// Named variants retain current physical tuples; callers receive no style bag.
function copyReaderButtonSpec(): ReaderButtonSpec {
  return { text: SOURCE_ACTION.text, height: SOURCE_ACTION.height, radius: SOURCE_ACTION.radius,
    horizontalPadding: SOURCE_ACTION.horizontalPadding, stacked: SOURCE_ACTION.stacked,
    primarySurface: SOURCE_ACTION.primarySurface, secondarySurface: SOURCE_ACTION.secondarySurface,
    primaryBorder: SOURCE_ACTION.primaryBorder, secondaryBorder: SOURCE_ACTION.secondaryBorder,
    disabledOpacity: SOURCE_ACTION.disabledOpacity, primaryDisabledOpacity: SOURCE_ACTION.primaryDisabledOpacity, hasBorder: SOURCE_ACTION.hasBorder, primaryHasBorder: SOURCE_ACTION.primaryHasBorder,
    hasSurface: SOURCE_ACTION.hasSurface, outerRadius: SOURCE_ACTION.outerRadius,
    primaryText: SOURCE_ACTION.primaryText, secondaryText: SOURCE_ACTION.secondaryText, verticalPadding: SOURCE_ACTION.verticalPadding, allPadding: SOURCE_ACTION.allPadding,
    maxLines: SOURCE_ACTION.maxLines, fixedWidth: SOURCE_ACTION.fixedWidth, responseOffset: SOURCE_ACTION.responseOffset, busyOpacity: SOURCE_ACTION.busyOpacity, centerText: SOURCE_ACTION.centerText, outerMargin: SOURCE_ACTION.outerMargin, responsiveStatusWidth: SOURCE_ACTION.responsiveStatusWidth };
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

const SHELF_ACTION: ReaderButtonSpec = copyReaderButtonSpec();
SHELF_ACTION.text = TYPE_SHELF_MANAGEMENT_BUTTON; SHELF_ACTION.height = 44; SHELF_ACTION.hasBorder = false;
const SHELF_SMALL: ReaderButtonSpec = copyReaderButtonSpec();
SHELF_SMALL.text = TYPE_SHELF_MANAGEMENT_SMALL_ACTION; SHELF_SMALL.height = undefined;
SHELF_SMALL.centerText = false; SHELF_SMALL.horizontalPadding = 9; SHELF_SMALL.verticalPadding = 7;
SHELF_SMALL.disabledOpacity = 1; SHELF_SMALL.secondarySurface = 'TOK_SURFACE_SOLID';
const SHELF_ROW_EDIT: ReaderButtonSpec = copyReaderButtonSpec();
SHELF_ROW_EDIT.text = TYPE_SHELF_MANAGEMENT_ROW_ACTION; SHELF_ROW_EDIT.height = undefined;
SHELF_ROW_EDIT.centerText = false; SHELF_ROW_EDIT.allPadding = 8;
SHELF_ROW_EDIT.hasBorder = false; SHELF_ROW_EDIT.disabledOpacity = 1; SHELF_ROW_EDIT.hasSurface = false; SHELF_ROW_EDIT.outerRadius = false;
const SHELF_ROW_SELECT: ReaderButtonSpec = copyReaderButtonSpec();
SHELF_ROW_SELECT.text = TYPE_SHELF_MANAGEMENT_ROW_ACTION; SHELF_ROW_SELECT.height = undefined;
SHELF_ROW_SELECT.centerText = false; SHELF_ROW_SELECT.allPadding = 8;
SHELF_ROW_SELECT.hasBorder = false; SHELF_ROW_SELECT.disabledOpacity = 1;
const RSS_DETAIL_BOTTOM: ReaderButtonSpec = copyReaderButtonSpec();
RSS_DETAIL_BOTTOM.text = TYPE_RSS_BOTTOM_ACTION; RSS_DETAIL_BOTTOM.height = 46; RSS_DETAIL_BOTTOM.radius = 999;
RSS_DETAIL_BOTTOM.disabledOpacity = 0.38; RSS_DETAIL_BOTTOM.primaryDisabledOpacity = 1; RSS_DETAIL_BOTTOM.primaryHasBorder = false;
RSS_DETAIL_BOTTOM.secondarySurface = 'TOK_CARD_BG_HI'; RSS_DETAIL_BOTTOM.secondaryBorder = 'app.RssEntryDetailPage.CARD_BORDER';
const RSS_FILTER: ReaderButtonSpec = copyReaderButtonSpec();
RSS_FILTER.text = TYPE_APP_COMPACT_PRIMARY_ACTION; RSS_FILTER.height = 30; RSS_FILTER.radius = 999;
RSS_FILTER.horizontalPadding = 10; RSS_FILTER.stacked = true; RSS_FILTER.maxLines = 1;
RSS_FILTER.hasBorder = false; RSS_FILTER.disabledOpacity = 1;
RSS_FILTER.primarySurface = 'app.action.fill'; RSS_FILTER.secondarySurface = 'app.RssPage.SOFT_PILL_BG';
RSS_FILTER.secondaryText = 'app.RssPage.filterPill.fontColor.FF564D44'; RSS_FILTER.outerMargin = { right: 6, bottom: 6 };
const SYNC_CONFIG_TEST: ReaderButtonSpec = copyReaderButtonSpec();
SYNC_CONFIG_TEST.text = TYPE_APP_COMPACT_PRIMARY_ACTION; SYNC_CONFIG_TEST.height = 42; SYNC_CONFIG_TEST.stacked = true;
SYNC_CONFIG_TEST.radius = 8; SYNC_CONFIG_TEST.disabledOpacity = 1; SYNC_CONFIG_TEST.centerText = false;
SYNC_CONFIG_TEST.secondarySurface = 'app.SyncPage.GHOST_BG'; SYNC_CONFIG_TEST.secondaryBorder = 'app.SyncPage.GHOST_BORDER';
const SYNC_CONFIG_SAVE: ReaderButtonSpec = copyReaderButtonSpec();
SYNC_CONFIG_SAVE.text = TYPE_APP_COMPACT_PRIMARY_ACTION; SYNC_CONFIG_SAVE.height = 42; SYNC_CONFIG_SAVE.stacked = true;
SYNC_CONFIG_SAVE.radius = 12; SYNC_CONFIG_SAVE.disabledOpacity = 1; SYNC_CONFIG_SAVE.centerText = false;
SYNC_CONFIG_SAVE.primarySurface = 'app.SyncPage.SOLID_BG'; SYNC_CONFIG_SAVE.primaryBorder = 'app.SyncPage.SOLID_BG';


const SOURCE_MANAGEMENT_RETRY: ReaderButtonSpec = copyReaderButtonSpec();
SOURCE_MANAGEMENT_RETRY.text = TYPE_FORM_COMPACT_ACTION; SOURCE_MANAGEMENT_RETRY.height = undefined;
SOURCE_MANAGEMENT_RETRY.hasSurface = false; SOURCE_MANAGEMENT_RETRY.hasBorder = false;
SOURCE_MANAGEMENT_RETRY.outerRadius = false; SOURCE_MANAGEMENT_RETRY.centerText = false;
SOURCE_MANAGEMENT_RETRY.disabledOpacity = 1;
const SOURCE_MANAGEMENT_CATEGORY: ReaderButtonSpec = copyReaderButtonSpec();
SOURCE_MANAGEMENT_CATEGORY.text = TYPE_FORM_HINT; SOURCE_MANAGEMENT_CATEGORY.height = 32;
SOURCE_MANAGEMENT_CATEGORY.radius = 16; SOURCE_MANAGEMENT_CATEGORY.horizontalPadding = 12;
SOURCE_MANAGEMENT_CATEGORY.centerText = false; SOURCE_MANAGEMENT_CATEGORY.hasBorder = false;
SOURCE_MANAGEMENT_CATEGORY.disabledOpacity = 1; SOURCE_MANAGEMENT_CATEGORY.secondarySurface = 'TOK_CARD_BG';
SOURCE_MANAGEMENT_CATEGORY.secondaryText = 'TOK_INK';
const SOURCE_MANAGEMENT_STATUS: ReaderButtonSpec = copyReaderButtonSpec();
SOURCE_MANAGEMENT_STATUS.text = TYPE_FORM_COMPACT_ACTION; SOURCE_MANAGEMENT_STATUS.height = 32;
SOURCE_MANAGEMENT_STATUS.radius = 16; SOURCE_MANAGEMENT_STATUS.maxLines = 1;
SOURCE_MANAGEMENT_STATUS.disabledOpacity = 0.45; SOURCE_MANAGEMENT_STATUS.secondarySurface = 'TOK_CARD_BG';
SOURCE_MANAGEMENT_STATUS.fixedWidth = 58; SOURCE_MANAGEMENT_STATUS.responsiveStatusWidth = true;
SOURCE_MANAGEMENT_STATUS.secondaryBorder = 'app.SourceManagementPage.CHIP_BORDER'; SOURCE_MANAGEMENT_STATUS.secondaryText = 'TOK_INK';
const SOURCE_MANAGEMENT_STATUS_WIDE: ReaderButtonSpec = copyReaderButtonSpec();
SOURCE_MANAGEMENT_STATUS_WIDE.text = SOURCE_MANAGEMENT_STATUS.text; SOURCE_MANAGEMENT_STATUS_WIDE.height = SOURCE_MANAGEMENT_STATUS.height;
SOURCE_MANAGEMENT_STATUS_WIDE.radius = SOURCE_MANAGEMENT_STATUS.radius; SOURCE_MANAGEMENT_STATUS_WIDE.maxLines = SOURCE_MANAGEMENT_STATUS.maxLines;
SOURCE_MANAGEMENT_STATUS_WIDE.disabledOpacity = SOURCE_MANAGEMENT_STATUS.disabledOpacity; SOURCE_MANAGEMENT_STATUS_WIDE.secondarySurface = SOURCE_MANAGEMENT_STATUS.secondarySurface;
SOURCE_MANAGEMENT_STATUS_WIDE.secondaryBorder = SOURCE_MANAGEMENT_STATUS.secondaryBorder; SOURCE_MANAGEMENT_STATUS_WIDE.secondaryText = SOURCE_MANAGEMENT_STATUS.secondaryText;
SOURCE_MANAGEMENT_STATUS_WIDE.fixedWidth = 72; SOURCE_MANAGEMENT_STATUS_WIDE.responsiveStatusWidth = true;
const SOURCE_MANAGEMENT_DETECT: ReaderButtonSpec = copyReaderButtonSpec();
SOURCE_MANAGEMENT_DETECT.text = TYPE_FORM_COMPACT_ACTION; SOURCE_MANAGEMENT_DETECT.height = 28;
SOURCE_MANAGEMENT_DETECT.radius = 7; SOURCE_MANAGEMENT_DETECT.fixedWidth = 44; SOURCE_MANAGEMENT_DETECT.stacked = true;
SOURCE_MANAGEMENT_DETECT.centerText = false; SOURCE_MANAGEMENT_DETECT.maxLines = 1;
SOURCE_MANAGEMENT_DETECT.disabledOpacity = 1; SOURCE_MANAGEMENT_DETECT.busyOpacity = 0.62;
SOURCE_MANAGEMENT_DETECT.secondarySurface = 'TOK_CARD_BG'; SOURCE_MANAGEMENT_DETECT.secondaryBorder = 'app.SourceManagementPage.CHIP_BORDER';
SOURCE_MANAGEMENT_DETECT.secondaryText = 'TOK_INK';
const SOURCE_MANAGEMENT_LOGIN: ReaderButtonSpec = copyReaderButtonSpec();
SOURCE_MANAGEMENT_LOGIN.text = TYPE_FORM_COMPACT_ACTION; SOURCE_MANAGEMENT_LOGIN.height = 28;
SOURCE_MANAGEMENT_LOGIN.radius = 7; SOURCE_MANAGEMENT_LOGIN.fixedWidth = 44; SOURCE_MANAGEMENT_LOGIN.stacked = true;
SOURCE_MANAGEMENT_LOGIN.centerText = false; SOURCE_MANAGEMENT_LOGIN.maxLines = 1; SOURCE_MANAGEMENT_LOGIN.disabledOpacity = 1;
SOURCE_MANAGEMENT_LOGIN.secondarySurface = 'TOK_CARD_BG'; SOURCE_MANAGEMENT_LOGIN.secondaryBorder = 'app.SourceManagementPage.CHIP_BORDER';
const SOURCE_MANAGEMENT_MANAGE: ReaderButtonSpec = copyReaderButtonSpec();
SOURCE_MANAGEMENT_MANAGE.text = TYPE_FORM_LABEL_ACTION; SOURCE_MANAGEMENT_MANAGE.height = 44;
SOURCE_MANAGEMENT_MANAGE.radius = 8; SOURCE_MANAGEMENT_MANAGE.stacked = true; SOURCE_MANAGEMENT_MANAGE.centerText = false;
SOURCE_MANAGEMENT_MANAGE.maxLines = 1; SOURCE_MANAGEMENT_MANAGE.disabledOpacity = 1;
SOURCE_MANAGEMENT_MANAGE.secondarySurface = 'TOK_SURFACE_SOLID'; SOURCE_MANAGEMENT_MANAGE.secondaryBorder = 'app.SourceManagementPage.SEARCH_FIELD_BORDER';
SOURCE_MANAGEMENT_MANAGE.secondaryText = 'TOK_INK';

const BUTTONS: Record<ReaderButtonSpecId, ReaderButtonSpec> = {
  'source-action': SOURCE_ACTION, 'source-compact': SOURCE_COMPACT,
  'rules-action': RULES_ACTION, 'rules-compact': RULES_COMPACT, 'sync-action': SYNC_ACTION,
  'form-action': FORM_ACTION, 'form-busy-action': FORM_BUSY_ACTION, 'form-document-action': FORM_DOCUMENT_ACTION,
  'search-primary': SEARCH_PRIMARY, 'search-secondary': SEARCH_SECONDARY, 'discover-page': DISCOVER_PAGE,
  'rss-mode-tab': RSS_MODE, 'rss-state': RSS_STATE, 'rss-source-link': RSS_SOURCE_LINK,
  'shelf-action': SHELF_ACTION, 'shelf-small': SHELF_SMALL, 'shelf-row-edit': SHELF_ROW_EDIT, 'shelf-row-select': SHELF_ROW_SELECT, 'rss-detail-bottom': RSS_DETAIL_BOTTOM,
  'rss-filter': RSS_FILTER, 'sync-config-test': SYNC_CONFIG_TEST, 'sync-config-save': SYNC_CONFIG_SAVE,
  'source-management-retry': SOURCE_MANAGEMENT_RETRY, 'source-management-category': SOURCE_MANAGEMENT_CATEGORY,
  'source-management-status-compact': SOURCE_MANAGEMENT_STATUS, 'source-management-status-wide': SOURCE_MANAGEMENT_STATUS_WIDE, 'source-management-detect': SOURCE_MANAGEMENT_DETECT,
  'source-management-login': SOURCE_MANAGEMENT_LOGIN, 'source-management-manage': SOURCE_MANAGEMENT_MANAGE,
};
export function resolveReaderButtonSpec(id: ReaderButtonSpecId): ReaderButtonSpec { return BUTTONS[id]; }

export type ReaderFormFieldSpecId = 'source-debug' | 'rules-input' | 'sync-credential' | 'form-body' | 'form-url' | 'shelf-native' | 'shelf-order' | 'source-code';
export interface ReaderFormFieldSpec {
  text: ReaderTextStyle | ReaderInheritedTextStyle | undefined;
  height: number;
  radius: number | undefined;
  horizontalPadding: number | undefined;
  allPadding: number | undefined;
  textRole: ReaderAppColorRole | undefined;
  surfaceRole: ReaderAppColorRole | undefined;
  placeholderRole: ReaderAppColorRole | undefined;
  hasBorder: boolean;
  multiline: boolean;
  numberInput: boolean;
}
const FIELDS: Record<ReaderFormFieldSpecId, ReaderFormFieldSpec> = {
  // The repeated group drafts keep actual ArkUI default text/placeholder/caret
  // rendering. No empty role and no physical font override is fabricated.
  'shelf-native': { text: undefined, height: 44, radius: undefined, horizontalPadding: undefined,
    textRole: undefined, surfaceRole: undefined, placeholderRole: undefined, allPadding: undefined, hasBorder: false, multiline: false, numberInput: false },
  'shelf-order': { text: undefined, height: 44, radius: undefined, horizontalPadding: undefined,
    textRole: undefined, surfaceRole: undefined, placeholderRole: undefined, allPadding: undefined, hasBorder: false, multiline: false, numberInput: true },
  'source-code': { text: TYPE_SOURCE_TOOLS_CODE_INPUT, height: 320, radius: 8, horizontalPadding: undefined,
    textRole: 'TOK_INK', surfaceRole: 'TOK_PAPER', placeholderRole: undefined, allPadding: TOK_SPACE_XS, hasBorder: true, multiline: true, numberInput: false },
  'form-body': { text: TYPE_FORM_INPUT, height: 44, radius: 8, horizontalPadding: 12,
    textRole: 'TOK_INK', surfaceRole: 'TOK_PAPER', placeholderRole: undefined, allPadding: undefined, hasBorder: true, multiline: false, numberInput: false },
  'form-url': { text: TYPE_FORM_URL_INPUT, height: 44, radius: 8, horizontalPadding: 12,
    textRole: 'TOK_INK', surfaceRole: 'TOK_SURFACE_FIELD', placeholderRole: 'TOK_MUTED', allPadding: undefined, hasBorder: true, multiline: false, numberInput: false },
  'source-debug': { text: TYPE_SOURCE_TOOLS_BODY, height: 40, radius: 8, horizontalPadding: 12,
    textRole: 'TOK_INK', surfaceRole: 'TOK_PAPER', placeholderRole: undefined, allPadding: undefined, hasBorder: true, multiline: false, numberInput: false },
  'rules-input': { text: TYPE_RULES_MANAGEMENT_INPUT, height: 40, radius: 8, horizontalPadding: 12,
    textRole: 'TOK_INK', surfaceRole: 'TOK_PAPER', placeholderRole: undefined, allPadding: undefined, hasBorder: true, multiline: false, numberInput: false },
  'sync-credential': { text: TYPE_SYNC_INPUT, height: 36, radius: 6, horizontalPadding: 11,
    textRole: 'TOK_CONTROL_INK', surfaceRole: 'TOK_FIELD_SURFACE', placeholderRole: 'app.SyncPage.webdavInputRow.placeholderColor.FF9C9488', allPadding: undefined, hasBorder: true, multiline: false, numberInput: false },
};
export function resolveReaderFormFieldSpec(id: ReaderFormFieldSpecId): ReaderFormFieldSpec { return FIELDS[id]; }
