import type { RssOriginalMutationProjection } from '../features/rss/RssMutationRecoveryContract';
import type { RssRouteOperationProjection } from '../features/rss/RssRouteOperationHost';
import { EMPTY_DISCOVER_PRESENTATION, type DiscoverPresentation } from '../features/discover/DiscoverOrchestrator';
import { type RssItem, type RssSubscription } from '../features/rss/RssGateway';
import { type RssFavoritePresentation } from '../features/rss/RssEntryDetailPage';
import { EMPTY_RSS_EDITOR_SNAPSHOT, type RssSubscriptionEditorSnapshot } from '../features/rss/RssSubscriptionEditorOrchestrator';
import { type RssEntrySnapshot, type RssManagementOperationProjection, type RssSourceSnapshot } from '../features/rss/RssOrchestrator';
import { projectOperationFacts, type OperationFacts } from './ReaderOperationFacts';
import { type RssPresentation } from '../features/rss/RssPage';
import type { SyncSnapshot } from '../features/sync/SyncGateway';

export type RssDetailReturnTarget = 'rss' | 'rssSourceFeed';
export type RssSourceFeedReturnTarget = 'rss' | 'rssSubscriptionManagement';

/** Optional UI presentation only. No instance exists until its admitted product
 * surface first requests one. Runtime business/recovery owners stay separate. */
export class ReaderRssProductPresentation {
  rssFeedRead: OperationFacts<RssSubscription[]> = projectOperationFacts<RssSubscription[]>({ phase: 'idle' });
  rssFeedOriginal: RssOriginalMutationProjection | undefined = undefined;
  rssSourceOriginal: RssOriginalMutationProjection | undefined = undefined;
  rssEntryOriginal: RssOriginalMutationProjection | undefined = undefined;
  rssSourceOperation: RssRouteOperationProjection<RssSourceSnapshot> | undefined = undefined;
  rssSourceRead: OperationFacts<RssSourceSnapshot> = projectOperationFacts<RssSourceSnapshot>({ phase: 'idle' });
  rssEntryOperation: RssRouteOperationProjection<RssEntrySnapshot> | undefined = undefined;
  rssEntryRead: OperationFacts<RssEntrySnapshot> = projectOperationFacts<RssEntrySnapshot>({ phase: 'idle' });
  rssPresentation: RssPresentation = { kind: 'feed', subscriptions: [], recentUnread: [] };
  rssManagementOperation: RssManagementOperationProjection | undefined = undefined;
  rssManagementRead: OperationFacts<RssSubscription[]> =
    projectOperationFacts<RssSubscription[]>({ phase: 'idle' });
  selectedRssSubscription: RssSubscription | undefined = undefined;
  selectedRssItems: RssItem[] = [];
  selectedRssItem: RssItem | undefined = undefined;
  selectedRssFavoriteState: RssFavoritePresentation = 'loading';
  rssDetailReturnTarget: RssDetailReturnTarget = 'rss';
  rssSourceFeedReturnTarget: RssSourceFeedReturnTarget = 'rss';
  rssManagementFocusSubscriptionId: string = '';
  rssEditorSnapshot: RssSubscriptionEditorSnapshot = EMPTY_RSS_EDITOR_SNAPSHOT;
  rssOperationResultMessage: string = '';
}

export class ReaderDiscoverProductPresentation {
  discoverPresentation: DiscoverPresentation = EMPTY_DISCOVER_PRESENTATION;
}

export class ReaderSyncProductPresentation {
  syncSnapshot: SyncSnapshot = {
    webdavUrl: '',
    webdavUser: '',
    webdavPass: '',
    backupPass: '',
    webdavPath: '/ReaderBackup/ReaderHarmony',
    saveLocation: 'WebDAV',
    backupFrequency: '手动',
    backupScope: '配置数据（不含离线书籍和正文，AES 加密）',
    history: [],
    statusMessage: '',
  };
  syncSnapshotReady: boolean = false;
}
