import type { ReaderAppColorRole } from './ReaderThemeRegistry';
import {
  ReaderTextStyle, ReaderInheritedTextStyle, TYPE_SOURCE_TOOLS_ACTION,
  TYPE_SOURCE_TOOLS_COMPACT_ACTION, TYPE_SOURCE_TOOLS_BODY,
  TYPE_RULES_MANAGEMENT_ACTION, TYPE_RULES_COMPACT_ACTION,
  TYPE_RULES_MANAGEMENT_INPUT, TYPE_APP_COMPACT_PRIMARY_ACTION, TYPE_SYNC_INPUT,
} from './ReaderTypography';

export type ReaderButtonSpecId = 'source-action' | 'source-compact' | 'rules-action' | 'rules-compact' | 'sync-action';
export type ReaderButtonLayout = 'intrinsic' | 'equal' | 'full';
export interface ReaderButtonSpec {
  text: ReaderTextStyle | ReaderInheritedTextStyle;
  height: number;
  radius: number;
  horizontalPadding: number;
  stacked: boolean;
  primarySurface: ReaderAppColorRole;
  secondarySurface: ReaderAppColorRole;
  primaryBorder: ReaderAppColorRole;
  secondaryBorder: ReaderAppColorRole;
  disabledOpacity: number;
}
const SOURCE_ACTION: ReaderButtonSpec = {
  text: TYPE_SOURCE_TOOLS_ACTION, height: 42, radius: 8, horizontalPadding: 0, stacked: false,
  primarySurface: 'TOK_PRIMARY_DARK', secondarySurface: 'TOK_SURFACE_PANEL_SOFT',
  primaryBorder: 'TOK_PRIMARY_DARK', secondaryBorder: 'TOK_BORDER', disabledOpacity: 0.62,
};
// Named variants retain current physical tuples; callers receive no style bag.
function copyReaderButtonSpec(): ReaderButtonSpec {
  return { text: SOURCE_ACTION.text, height: SOURCE_ACTION.height, radius: SOURCE_ACTION.radius,
    horizontalPadding: SOURCE_ACTION.horizontalPadding, stacked: SOURCE_ACTION.stacked,
    primarySurface: SOURCE_ACTION.primarySurface, secondarySurface: SOURCE_ACTION.secondarySurface,
    primaryBorder: SOURCE_ACTION.primaryBorder, secondaryBorder: SOURCE_ACTION.secondaryBorder,
    disabledOpacity: SOURCE_ACTION.disabledOpacity };
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
SYNC_ACTION.disabledOpacity = 1;
const BUTTONS: Record<ReaderButtonSpecId, ReaderButtonSpec> = {
  'source-action': SOURCE_ACTION, 'source-compact': SOURCE_COMPACT,
  'rules-action': RULES_ACTION, 'rules-compact': RULES_COMPACT, 'sync-action': SYNC_ACTION,
};
export function resolveReaderButtonSpec(id: ReaderButtonSpecId): ReaderButtonSpec { return BUTTONS[id]; }

export type ReaderFormFieldSpecId = 'source-debug' | 'rules-input' | 'sync-credential';
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
  'source-debug': { text: TYPE_SOURCE_TOOLS_BODY, height: 40, radius: 8, horizontalPadding: 12,
    textRole: 'TOK_INK', surfaceRole: 'TOK_PAPER', placeholderRole: undefined },
  'rules-input': { text: TYPE_RULES_MANAGEMENT_INPUT, height: 40, radius: 8, horizontalPadding: 12,
    textRole: 'TOK_INK', surfaceRole: 'TOK_PAPER', placeholderRole: undefined },
  'sync-credential': { text: TYPE_SYNC_INPUT, height: 36, radius: 6, horizontalPadding: 11,
    textRole: 'TOK_CONTROL_INK', surfaceRole: 'TOK_FIELD_SURFACE', placeholderRole: 'app.SyncPage.webdavInputRow.placeholderColor.FF9C9488' },
};
export function resolveReaderFormFieldSpec(id: ReaderFormFieldSpecId): ReaderFormFieldSpec { return FIELDS[id]; }
