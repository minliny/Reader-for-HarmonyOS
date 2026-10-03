import type { ReaderAppColorRole } from './ReaderThemeRegistry';
import { ReaderTextStyle, ReaderInheritedTextStyle, TYPE_FORM_LABEL_ACTION, TYPE_APP_SMALL_ACTION,
  TYPE_APP_COMPACT_PRIMARY_ACTION, TYPE_FORM_COMPACT_ACTION, TYPE_RSS_LINK_ACTION } from './ReaderTypography';

export type ReaderLabeledIconActionSpecId = 'rss-feed' | 'rss-entry' | 'rss-management' |
  'rss-manage' | 'rss-source-operations' | 'rss-view-all' | 'source-management-add';
export interface ReaderLabeledIconActionSpec {
  text: ReaderTextStyle | ReaderInheritedTextStyle;
  textRole: ReaderAppColorRole;
  dangerRole: ReaderAppColorRole | undefined;
  surfaceRole: ReaderAppColorRole | undefined;
  borderRole: ReaderAppColorRole | undefined;
  divided: boolean;
  iconSize: number;
  rowHeight: number | undefined;
  gap: number;
  surfaceOnHit: boolean;
  rowWidth: number | string | undefined;
  horizontalPadding: number | undefined;
  radius: number | undefined;
  centerRow: boolean;
  outerHit: boolean;
  equalLayout: boolean;
  responseOffset: number | undefined;
}
const FEED: ReaderLabeledIconActionSpec = {
  text: TYPE_APP_SMALL_ACTION, textRole: 'app.RssSourceFeedPage.actionTarget.fontColor.FF3F372F',
  dangerRole: undefined, surfaceRole: 'app.RssSourceFeedPage.ACTION_BG', borderRole: undefined,
  divided: false, iconSize: 18, rowHeight: 32, gap: 5, surfaceOnHit: false, rowWidth: undefined, horizontalPadding: 9,
  radius: 999, centerRow: false, outerHit: true, equalLayout: false, responseOffset: undefined,
};
function copyReaderLabeledIconActionSpec(): ReaderLabeledIconActionSpec {
  return { text: FEED.text, textRole: FEED.textRole, dangerRole: FEED.dangerRole,
    surfaceRole: FEED.surfaceRole, borderRole: FEED.borderRole, divided: FEED.divided,
    iconSize: FEED.iconSize, rowHeight: FEED.rowHeight, gap: FEED.gap, surfaceOnHit: FEED.surfaceOnHit, rowWidth: FEED.rowWidth,
    horizontalPadding: FEED.horizontalPadding, radius: FEED.radius, centerRow: FEED.centerRow,
    outerHit: FEED.outerHit, equalLayout: FEED.equalLayout, responseOffset: FEED.responseOffset };
}
const ENTRY: ReaderLabeledIconActionSpec = copyReaderLabeledIconActionSpec();
ENTRY.textRole = 'app.RssEntryDetailPage.actionTarget.fontColor.FF3F372F';
ENTRY.surfaceRole = 'app.RssEntryDetailPage.ACTION_BG'; ENTRY.rowHeight = 34;
ENTRY.rowWidth = '100%'; ENTRY.horizontalPadding = undefined; ENTRY.centerRow = true; ENTRY.equalLayout = true;
const MANAGEMENT: ReaderLabeledIconActionSpec = copyReaderLabeledIconActionSpec();
MANAGEMENT.text = TYPE_FORM_COMPACT_ACTION; MANAGEMENT.textRole = 'TOK_INK'; MANAGEMENT.dangerRole = 'TOK_DANGER';
MANAGEMENT.surfaceRole = undefined; MANAGEMENT.divided = true; MANAGEMENT.borderRole = 'TOK_ROW_DIVIDER';
MANAGEMENT.iconSize = 16; MANAGEMENT.rowHeight = 44; MANAGEMENT.horizontalPadding = undefined;
MANAGEMENT.radius = undefined; MANAGEMENT.centerRow = true; MANAGEMENT.outerHit = false; MANAGEMENT.equalLayout = true;
const MANAGE: ReaderLabeledIconActionSpec = copyReaderLabeledIconActionSpec();
MANAGE.text = TYPE_APP_COMPACT_PRIMARY_ACTION; MANAGE.textRole = 'TOK_PRIMARY_TEXT';
MANAGE.surfaceRole = 'app.RssPage.PILL_BG'; MANAGE.borderRole = 'app.RssPage.PILL_BORDER';
MANAGE.iconSize = 16; MANAGE.rowHeight = 34; MANAGE.rowWidth = 64; MANAGE.horizontalPadding = undefined;
MANAGE.radius = 12; MANAGE.centerRow = true; MANAGE.outerHit = false; MANAGE.responseOffset = -5;
const SOURCE_OPERATIONS: ReaderLabeledIconActionSpec = copyReaderLabeledIconActionSpec();
SOURCE_OPERATIONS.text = TYPE_RSS_LINK_ACTION; SOURCE_OPERATIONS.textRole = 'TOK_PRIMARY_TEXT';
SOURCE_OPERATIONS.surfaceRole = 'TOK_PRIMARY_SOFT'; SOURCE_OPERATIONS.iconSize = 16;
SOURCE_OPERATIONS.rowHeight = 30; SOURCE_OPERATIONS.horizontalPadding = 8;
SOURCE_OPERATIONS.outerHit = false; SOURCE_OPERATIONS.responseOffset = -7;
const VIEW_ALL: ReaderLabeledIconActionSpec = copyReaderLabeledIconActionSpec();
VIEW_ALL.text = TYPE_RSS_LINK_ACTION; VIEW_ALL.textRole = 'TOK_PRIMARY_TEXT';
VIEW_ALL.surfaceRole = 'app.RssPage.VIEW_ALL_BG'; VIEW_ALL.iconSize = 20;
VIEW_ALL.rowHeight = 28; VIEW_ALL.horizontalPadding = 8;
VIEW_ALL.outerHit = false; VIEW_ALL.responseOffset = -8;
const SOURCE_ADD: ReaderLabeledIconActionSpec = copyReaderLabeledIconActionSpec();
SOURCE_ADD.text = TYPE_FORM_LABEL_ACTION; SOURCE_ADD.textRole = 'TOK_ON_PRIMARY';
SOURCE_ADD.surfaceRole = 'TOK_PRIMARY_DARK'; SOURCE_ADD.iconSize = 18; SOURCE_ADD.gap = 8;
SOURCE_ADD.rowHeight = undefined; SOURCE_ADD.horizontalPadding = undefined; SOURCE_ADD.radius = 8;
SOURCE_ADD.surfaceOnHit = true; SOURCE_ADD.equalLayout = true;
const SPECS: Record<ReaderLabeledIconActionSpecId, ReaderLabeledIconActionSpec> = {
  'rss-feed': FEED, 'rss-entry': ENTRY, 'rss-management': MANAGEMENT,
  'rss-manage': MANAGE, 'rss-source-operations': SOURCE_OPERATIONS, 'rss-view-all': VIEW_ALL, 'source-management-add': SOURCE_ADD,
};
export function resolveReaderLabeledIconActionSpec(id: ReaderLabeledIconActionSpecId): ReaderLabeledIconActionSpec { return SPECS[id]; }
