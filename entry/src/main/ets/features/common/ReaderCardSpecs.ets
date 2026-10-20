import type { ReaderAppColorRole } from './ReaderThemeRegistry';
import { TOK_BORDER_W, TOK_CONTENT_MAX_W_TABLET, TOK_RADIUS_MD } from './ReaderTokens';

export type ReaderCardSpecId = 'settings-category' | 'sync-config' | 'sync-status';

export interface ReaderCardSpec {
  backgroundRole: ReaderAppColorRole;
  borderRole: ReaderAppColorRole;
  borderWidth: number;
  radius: number;
  maxWidth: number;
}

// CategorySection and Sync configuration already use the same actual tuple.
// Share that one specification; the existing Sync status cards retain r13.
const STANDARD_CARD: ReaderCardSpec = {
  backgroundRole: 'TOK_CARD_BG', borderRole: 'TOK_BORDER',
  borderWidth: TOK_BORDER_W, radius: TOK_RADIUS_MD, maxWidth: TOK_CONTENT_MAX_W_TABLET,
};
const SYNC_STATUS_CARD: ReaderCardSpec = {
  backgroundRole: 'TOK_SURFACE_SOLID', borderRole: 'app.SyncPage.CARD_BORDER_SOFT',
  borderWidth: TOK_BORDER_W, radius: 13, maxWidth: TOK_CONTENT_MAX_W_TABLET,
};

export function resolveReaderCardSpec(id: ReaderCardSpecId): ReaderCardSpec {
  if (id === 'sync-status') return SYNC_STATUS_CARD;
  return STANDARD_CARD;
}
