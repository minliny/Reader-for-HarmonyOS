import { TOK_RADIUS_LG } from './ReaderTokens';
import type { ReaderAppColorRole } from './ReaderThemeRegistry';
import { TOK_BORDER_W, TOK_CONTENT_MAX_W_TABLET, TOK_RADIUS_MD } from './ReaderTokens';

export type ReaderCardSpecId = 'settings-category' | 'sync-config' | 'sync-status' | 'management-section' | 'rules-section';

export interface ReaderCardSpec {
  backgroundRole: ReaderAppColorRole;
  borderRole: ReaderAppColorRole;
  borderWidth: number;
  radius: number;
  maxWidth: number;
}

// CategorySection and Sync configuration already use the same actual tuple.
// Share that one specification; status and management cards share the large radius token.
const STANDARD_CARD: ReaderCardSpec = {
  backgroundRole: 'TOK_CARD_BG', borderRole: 'app.border.contentCard',
  borderWidth: TOK_BORDER_W, radius: TOK_RADIUS_MD, maxWidth: TOK_CONTENT_MAX_W_TABLET,
};
const SYNC_STATUS_CARD: ReaderCardSpec = {
  backgroundRole: 'TOK_CARD_BG', borderRole: 'app.border.contentCard',
  borderWidth: TOK_BORDER_W, radius: TOK_RADIUS_LG, maxWidth: TOK_CONTENT_MAX_W_TABLET,
};
// Management pages span the standard page frame, which already applies its
// own max width; section surfaces use the shared large radius.
const MANAGEMENT_SECTION_CARD: ReaderCardSpec = {
  backgroundRole: 'TOK_CARD_BG', borderRole: 'app.border.contentCard',
  borderWidth: TOK_BORDER_W, radius: TOK_RADIUS_LG, maxWidth: Number.MAX_SAFE_INTEGER,
};
const RULES_SECTION_CARD: ReaderCardSpec = {
  backgroundRole: 'TOK_CARD_BG', borderRole: 'app.border.contentCard',
  borderWidth: TOK_BORDER_W, radius: TOK_RADIUS_LG, maxWidth: Number.MAX_SAFE_INTEGER,
};

export function resolveReaderCardSpec(id: ReaderCardSpecId): ReaderCardSpec {
  if (id === 'sync-status') return SYNC_STATUS_CARD;
  if (id === 'management-section') return MANAGEMENT_SECTION_CARD;
  if (id === 'rules-section') return RULES_SECTION_CARD;
  return STANDARD_CARD;
}
