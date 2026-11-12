import { TOK_RADIUS_LG } from '../foundation/ReaderTokens';
import type { ReaderAppColorRole } from '../foundation/ReaderThemeRegistry';
import { TOK_BORDER_W, TOK_CONTENT_MAX_W_TABLET, TOK_RADIUS_MD, TOK_SPACE_MD, TOK_SPACE_SM, TOK_SPACE_XS } from '../foundation/ReaderTokens';

export type ReaderCardSpecId = 'settings-category' | 'sync-config' | 'sync-status' | 'editor-section' |
  'bordered-list-section' | 'preference-panel' | 'danger-action' | 'task-diagnostics';

export interface ReaderCardSpec {
  backgroundRole: ReaderAppColorRole;
  borderRole: ReaderAppColorRole;
  borderWidth: number;
  radius: number;
  maxWidth: number;
  contentPadding?: number;
  contentSpacing?: number;
}

// CategorySection and Sync configuration already use the same actual tuple.
// Share that one specification; status cards use the large radius token.
const STANDARD_CARD: ReaderCardSpec = {
  backgroundRole: 'TOK_CARD_BG', borderRole: 'app.border.contentCard',
  borderWidth: TOK_BORDER_W, radius: TOK_RADIUS_MD, maxWidth: TOK_CONTENT_MAX_W_TABLET,
};
const SYNC_STATUS_CARD: ReaderCardSpec = {
  backgroundRole: 'TOK_CARD_BG', borderRole: 'app.border.contentCard',
  borderWidth: TOK_BORDER_W, radius: TOK_RADIUS_LG, maxWidth: TOK_CONTENT_MAX_W_TABLET,
};
const EDITOR_SECTION_CARD: ReaderCardSpec = {
  backgroundRole: 'TOK_SURFACE_SOLID', borderRole: 'TOK_BORDER', borderWidth: TOK_BORDER_W,
  radius: 10, maxWidth: Number.MAX_SAFE_INTEGER, contentPadding: TOK_SPACE_SM, contentSpacing: TOK_SPACE_SM,
};
const BORDERED_LIST_SECTION_CARD: ReaderCardSpec = {
  backgroundRole: 'TOK_CARD_BG', borderRole: 'TOK_BORDER', borderWidth: TOK_BORDER_W,
  radius: 10, maxWidth: Number.MAX_SAFE_INTEGER, contentPadding: TOK_SPACE_SM, contentSpacing: TOK_SPACE_XS,
};
const PREFERENCE_PANEL_CARD: ReaderCardSpec = {
  backgroundRole: 'TOK_CARD_BG', borderRole: 'TOK_BORDER', borderWidth: TOK_BORDER_W,
  radius: TOK_RADIUS_LG, maxWidth: Number.MAX_SAFE_INTEGER, contentPadding: TOK_SPACE_MD, contentSpacing: TOK_SPACE_MD,
};
const DANGER_ACTION_CARD: ReaderCardSpec = {
  backgroundRole: 'app.surface.dangerCard', borderRole: 'app.surface.dangerCard', borderWidth: 0,
  radius: TOK_RADIUS_MD, maxWidth: Number.MAX_SAFE_INTEGER,
};
const TASK_DIAGNOSTICS_CARD: ReaderCardSpec = {
  backgroundRole: 'TOK_MESSAGE_SURFACE', borderRole: 'TOK_MESSAGE_BORDER', borderWidth: TOK_BORDER_W,
  radius: 12, maxWidth: Number.MAX_SAFE_INTEGER, contentPadding: 17, contentSpacing: TOK_SPACE_SM,
};

export function resolveReaderCardSpec(id: ReaderCardSpecId): ReaderCardSpec {
  if (id === 'sync-status') return SYNC_STATUS_CARD;
  if (id === 'editor-section') return EDITOR_SECTION_CARD;
  if (id === 'bordered-list-section') return BORDERED_LIST_SECTION_CARD;
  if (id === 'preference-panel') return PREFERENCE_PANEL_CARD;
  if (id === 'danger-action') return DANGER_ACTION_CARD;
  if (id === 'task-diagnostics') return TASK_DIAGNOSTICS_CARD;
  return STANDARD_CARD;
}
