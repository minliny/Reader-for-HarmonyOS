import { themeDayDesignSource } from './lib/reader-theme-design-source.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => themeDayDesignSource(readFileSync(resolve(repo, path), 'utf8'));

const rss = read('entry/src/main/ets/features/rss/RssPage.ets');
const sourceFeed = read('entry/src/main/ets/features/rss/RssSourceFeedPage.ets');
const entryDetail = read('entry/src/main/ets/features/rss/RssEntryDetailPage.ets');
const management = read('entry/src/main/ets/features/rss/RssSubscriptionManagementPage.ets');
const editor = read('entry/src/main/ets/features/rss/RssSubscriptionEditorPage.ets');
const editorOrchestrator = read('entry/src/main/ets/features/rss/RssSubscriptionEditorOrchestrator.ets');
const gateway = read('entry/src/main/ets/features/rss/RssGateway.ts');
const orchestrator = read('entry/src/main/ets/features/rss/RssOrchestrator.ets');
const index = read('entry/src/main/ets/pages/Index.ets');
const mainTabBar = read('entry/src/main/ets/features/shell/MainTabBar.ets');
const mainTabShell = read('entry/src/main/ets/features/shell/MainTabShell.ets');

// One RSS route owns one persistent main-page shell. Presentation states only
// replace content inside that shell and must not reintroduce standalone bars.
assert.equal((rss.match(/MainTabShell\(\{/g) ?? []).length, 1);
assert.doesNotMatch(rss, /PageBackBar/);
assert.doesNotMatch(rss, /private backBar\(/);
assert.match(rss, /kind: 'feed'/);
assert.match(rss, /kind: 'refreshing'/);
assert.match(rss, /kind: 'emptyUnread'/);
assert.match(rss, /kind: 'fatalError'/);
assert.doesNotMatch(rss, /kind: 'empty';/);
assert.doesNotMatch(rss, /kind: 'error';/);
assert.match(rss, /interface RssEmptyUnreadPresentation \{\s*kind: 'emptyUnread';\s*subscriptions: RssSubscription\[\];/);
assert.match(rss, /this\.emptyUnreadScroll\(this\.presentation\.subscriptions\)/);
assert.match(rss, /private emptyUnreadScroll\(subscriptions: RssSubscription\[\]\)[\s\S]*this\.subscriptionSection\(subscriptions\);[\s\S]*this\.emptyUnreadSection\(\);/);
assert.doesNotMatch(rss, /private emptyContent\(/);

// Tablet is a responsive assembly of the same RSS route: it uses the shared
// vertical rail, reserves the 100vp content gutter, and removes BottomNav.
assert.match(rss, /showBottomNav: !this\.isWideViewport\(\)/);
assert.match(rss, /showTabletRail: this\.isWideViewport\(\)/);
assert.match(rss,
  /if \(this\.isWideViewport\(\)\) \{\s*Blank\(\)\.width\(RSS_TABLET_RAIL_WIDTH\);/);
assert.match(rss,
  /new SurfaceWidthSpec\(TOK_CONTENT_RAIL_W_TABLET, TOK_SCREEN_INSET, TOK_SCREEN_INSET\)/);
assert.match(rss, /const RSS_WIDE_BREAKPOINT = 600/);
assert.match(rss, /const RSS_TABLET_RAIL_WIDTH = 100/);
assert.match(rss, /\.onAreaChange\(\(_oldValue: Area, newValue: Area\)/);
assert.match(rss, /return this\.effectiveViewportWidth\(\) >= RSS_WIDE_BREAKPOINT/);
assert.match(mainTabShell, /@Prop showTabletRail: boolean = false/);
assert.match(mainTabShell, /vertical: true/);
assert.match(mainTabBar, /@Prop vertical: boolean = false/);
assert.match(mainTabBar, /Column\(\{ space: 6 \}\)/);
assert.match(mainTabBar, /\.width\(82\)\s*\.height\(332\)/);
assert.match(mainTabBar, /\.width\(66\)\s*\.height\(58\)/);

// Status metadata is static at Tablet width. Phone gets a bounded marquee,
// which only animates when its combined text actually overflows the slot.
assert.match(rss, /if \(this\.isWideViewport\(\)\) \{\s*Text\(this\.refreshStatusText\(\)\)/);
assert.match(rss, /Marquee\(\{/);
assert.match(rss, /\.width\(132\.5625\)/);
assert.match(rss, /private refreshStatusText\(\): string/);

// Empty/error actions share one 88x36 pill language; secondary is semantic
// primary-soft rather than an unrelated outlined rectangle.
assert.equal((rss.match(/\.width\(88\)\s*\.height\(36\)/g) ?? []).length, 2);
assert.match(rss, /\.backgroundColor\(TOK_PRIMARY_SOFT\)/);

// Sources / All / Favorites / Rules are main-page content modes. Unsupported
// modes emit an intent and remain on Sources; they are not added to ReaderRoute.
assert.match(rss, /export type RssMode = 'sources' \| 'all' \| 'favorites' \| 'rules'/);
assert.match(rss, /this\.statusTab\('源列表', 'sources'\)/);
assert.match(rss, /this\.statusTab\('全部', 'all'\)/);
assert.match(rss, /this\.statusTab\('收藏', 'favorites'\)/);
assert.match(rss, /this\.statusTab\('规则订阅', 'rules'\)/);
assert.match(rss, /onModeRequested: \(mode: RssMode\)/);
assert.match(index, /activeMode: 'sources'/);
assert.match(index, /onModeRequested: \(mode: RssMode\)/);
assert.match(index, /RSS mode %\{private\}s has no admitted data contract/);
assert.doesNotMatch(index, /type ReaderRoute = [^;]*'rssAll'/);

// Management, SourceFeed, and EntryDetail are true RSS child routes. They use
// child-page assemblies and must not mount the persistent main shell.
assert.match(index, /'rss' \| 'rssSubscriptionManagement' \| 'rssSourceFeed' \| 'rssEntryDetail'/);
assert.match(index, /this\.route === 'rssSubscriptionManagement'/);
assert.match(index, /this\.route === 'rssSourceFeed'/);
assert.match(index, /this\.route === 'rssEntryDetail'/);
assert.match(management, /export struct RssSubscriptionManagementPage/);
assert.match(management, /PageBackBar\(\{/);
assert.doesNotMatch(management, /MainTabShell/);
assert.match(sourceFeed, /export struct RssSourceFeedPage/);
assert.match(sourceFeed, /PageBackBar\(\{/);
assert.doesNotMatch(sourceFeed, /MainTabShell/);
assert.match(sourceFeed, /if \(this\.items\.length > 0\) \{\s*this\.entryList\(\);/);
assert.doesNotMatch(sourceFeed, /categoryDisclosure|categoryOptions|categoryValues|visibleItems/);
assert.doesNotMatch(sourceFeed, /继续下滑加载下一页|paginationHint/);
assert.doesNotMatch(sourceFeed, /this\.actionTarget\('记录'|this\.actionTarget\('调试'/);
assert.doesNotMatch(sourceFeed, /app\.media\.rss_bookmark/);
assert.doesNotMatch(index, /'rssNovel'|'rssTech'|'rssReleases'/);
assert.match(entryDetail, /export struct RssEntryDetailPage/);
assert.match(entryDetail, /PageBackBar\(\{/);
assert.doesNotMatch(entryDetail, /MainTabShell/);
assert.doesNotMatch(entryDetail, /actionTarget\('已读'|actionTarget\('移除收藏'/);
assert.doesNotMatch(entryDetail, /已解析正文|原文条目/);
assert.doesNotMatch(entryDetail, /Text\(this\.item\.description\)/);
assert.match(index, /onSelectSubscription: \(id: string\): void => this\.onRssSubscriptionSelected\(id\)/);
assert.match(index, /onSelectItem: \(subscriptionId: string, guid: string\): void =>\s*this\.onRssItemSelected\(subscriptionId, guid\)/);
assert.match(rss, /onSelectItem: \(subscriptionId: string, guid: string\) => void/);
assert.match(rss, /rss-item-\$\{item\.subscriptionId\.length\}:\$\{item\.subscriptionId\}-\$\{item\.guid\.length\}:\$\{item\.guid\}/);
assert.match(rss, /this\.onSelectItem\(item\.subscriptionId, item\.guid\)/);
assert.match(sourceFeed, /rss-source-item-\$\{item\.subscriptionId\.length\}:\$\{item\.subscriptionId\}-\$\{item\.guid\.length\}:\$\{item\.guid\}/);
assert.match(entryDetail, /rss-summary-\$\{this\.item\.subscriptionId\.length\}:\$\{this\.item\.subscriptionId\}-\$\{this\.item\.guid\.length\}:\$\{this\.item\.guid\}-\$\{index\}/);
assert.match(index, /private onRssItemSelected\(subscriptionId: string, guid: string\): void \{[\s\S]*candidate\.subscriptionId === subscriptionId &&\s*candidate\.guid === guid/);
assert.doesNotMatch(index, /private onRssItemSelected\(guid: string\)/);
assert.match(gateway, /async loadItems\(subscriptionId: string\): Promise<RssSubscriptionItemsResult>/);
assert.match(gateway, /firstSeenAt: number/);
assert.match(gateway, /firstSeenAt: this\.requiredInteger\(item, 'firstSeenAt'\)/);
assert.doesNotMatch(gateway, /private async loadItems/);
assert.doesNotMatch(gateway, /category\?:|entries\?:|type\?:|rules\?:|authNeeded\?:|feedTitle\?:/);
assert.doesNotMatch(gateway, /MAX_RECENT_UNREAD_SUBSCRIPTIONS|loadRecentUnread|slice\(0,\s*4\)/);
assert.doesNotMatch(gateway, /Promise\.all/);
assert.doesNotMatch(index, /\.loadRecentUnread\(/);
assert.match(index, /rss\.entries\.query/);

// Management is reachable from the main RSS page. Toggle, per-feed refresh,
// and confirmed delete enter one serial orchestrator chain; rows change only
// after Core's authoritative list has reloaded.
assert.match(index, /onManage: \(\): void => this\.onRssManage\(\)/);
assert.match(index, /private onRssManage\(\): void \{[\s\S]*this\.route = 'rssSubscriptionManagement';[\s\S]*this\.getRssOrchestrator\(\)\.open\(\);/);
assert.doesNotMatch(index, /RSS subscription management has no admitted route/);
assert.match(index, /onToggle: \(id: string, enabled: boolean\): void =>[\s\S]*toggleSubscription\(id, enabled\)/);
assert.match(index, /onRefresh: \(id: string\): void => this\.getRssOrchestrator\(\)\.refreshSubscription\(id\)/);
assert.match(index, /showAlertDialog\(\{[\s\S]*primaryButton:[\s\S]*value: '取消'[\s\S]*secondaryButton:[\s\S]*value: '删除'/);
assert.match(index, /private confirmRssSubscriptionDelete\(subscriptionId: string\): void \{[\s\S]*removeSubscription\(subscriptionId\);/);
assert.match(index, /private onRssManagementViewArticles\(subscriptionId: string\): void \{\s*this\.onRssSubscriptionSelected\(subscriptionId, 'rssSubscriptionManagement'\);/);
assert.match(index, /private returnFromRssSourceFeed\(\): void \{[\s\S]*this\.route = 'rssSubscriptionManagement';/);
assert.match(orchestrator, /private mutationChain: Promise<void> = Promise\.resolve\(\)/);
assert.match(orchestrator, /this\.mutationChain = this\.mutationChain[\s\S]*this\.applyMutation/);
assert.match(orchestrator, /await this\.runMutationWithRetry\(mutation\);[\s\S]*await this\.loadSubscriptionsWithRetry\(\)/);
assert.match(orchestrator, /if \(this\.isCurrentSession\(session\)\) \{\s*this\.emit\(subscriptions\);/);
assert.match(orchestrator, /owner\.request\('runtime\.status', \{\}\)/);
assert.match(orchestrator, /isReaderCoreTransactionPendingError\(error\)/);
assert.doesNotMatch(orchestrator, /error\.message\.indexOf|error\.message\.includes/);
assert.doesNotMatch(orchestrator, /mutationSeq|seq ===/);
assert.doesNotMatch(orchestrator, /this\.emit\([^\n]*\.map\(/);
assert.doesNotMatch(orchestrator, /private (subscriptions|items):/);
assert.match(gateway, /request\('rss\.subscription\.persist', \{[\s\S]*operation: 'update'/);
assert.match(gateway, /request\('rss\.subscription\.remove', \{/);
assert.match(gateway, /request\('rss\.feed\.refresh', \{/);
assert.match(gateway, /returned a mismatched updated subscription/);
assert.match(gateway, /returned inconsistent unread counts/);
assert.match(gateway, /count !== items\.length/);
assert.match(gateway, /unreadCount > count \|\| newCount > count/);
assert.match(gateway, /unreadCount !== subscription\.unreadCount \|\| unreadCount > count/);
assert.match(gateway, /returned a duplicate scoped identity/);
assert.match(gateway, /private requiredNonEmptyString\(/);
assert.match(gateway, /private optionalNonEmptyString\(/);
assert.doesNotMatch(gateway, /candidate === undefined \|\| candidate === null/);
assert.match(gateway, /inconsistent fetch flags/);

// Scoped entry identity, read state, and favorite membership are Core truth.
// Index forwards intents only; the existing orchestrator owns the sole serial
// chain and publishes authoritative source/entry snapshots after mutations.
assert.match(gateway, /request\('rss\.entry\.read', \{\s*subscriptionId,\s*guid,\s*read,/);
assert.match(gateway, /echoedSubscriptionId !== subscriptionId \|\| echoedGuid !== guid \|\| echoedRead !== read/);
assert.match(gateway, /request\('rss\.favorite\.list', \{\s*subscriptionId,\s*\}\)/);
assert.doesNotMatch(gateway, /request\('rss\.favorite\.list', \{[\s\S]{0,120}limit:/);
assert.match(gateway, /request\('rss\.favorite\.persist', \{\s*subscriptionId,\s*guid,\s*addedAt,\s*\}\)/);
assert.match(gateway, /request\('rss\.favorite\.remove', \{\s*subscriptionId,\s*guid,\s*\}\)/);
assert.doesNotMatch(gateway, /request\('rss\.favorite\.persist', \{[\s\S]{0,220}(title|link|summary|feedUrl|firstSeenAt):/);
assert.match(orchestrator, /private mutationChain: Promise<void> = Promise\.resolve\(\)/);
assert.equal((orchestrator.match(/private mutationChain:/g) ?? []).length, 1);
assert.match(orchestrator, /private enqueueRouteTask\([\s\S]*this\.mutationChain = this\.mutationChain/);
assert.match(orchestrator, /async \(\): Promise<void> => \{\s*await this\.gateway\.setEntryRead\(subscriptionId, guid, true\);\s*\}/);
assert.match(orchestrator, /const snapshot = await this\.loadEntrySnapshotWithRetry\(subscriptionId, guid\)/);
assert.match(orchestrator, /const current = await this\.loadFavoriteMembershipWithRetry\(subscriptionId, guid\);[\s\S]*if \(current !== favorite\)/);
assert.match(orchestrator, /await this\.gateway\.persistFavorite\(subscriptionId, guid, addedAt\)/);
assert.match(orchestrator, /await this\.gateway\.removeFavorite\(subscriptionId, guid\)/);
assert.match(orchestrator, /await this\.gateway\.refreshSubscription\(subscriptionId\);[\s\S]*loadSourceSnapshotWithRetry\(subscriptionId\)/);
assert.match(orchestrator, /const itemResult = await this\.loadItemsWithRetry\(subscriptionId\)/);
assert.match(orchestrator, /candidate\.subscriptionId === subscriptionId \? itemResult\.subscription : candidate/);
assert.match(orchestrator, /subscription: itemResult\.subscription/);
assert.doesNotMatch(index, /private rssMutationChain|private rssMutationQueue/);
assert.doesNotMatch(index, /new RssGateway\(ReaderRuntimeOwner\.current\(\)\)\.loadItems/);
assert.match(index, /private openRssEntryDetail\([\s\S]*getRssOrchestrator\(\)\.openEntry\(/);
assert.match(index, /private onRssEntryFavoriteRequested\([\s\S]*getRssOrchestrator\(\)\.setEntryFavorite\(/);
assert.match(index, /selectedRssFavoriteState = snapshot\.favorite \? 'favorited' : 'notFavorited'/);
assert.match(index, /onRefresh: \(\): void => this\.refreshRssSourceFeed\(\)/);
assert.match(index, /private refreshRssSourceFeed\(\): void \{[\s\S]*getRssOrchestrator\(\)\.refreshSourceFeed\(/);
assert.match(index, /private onRssSubscriptionSelected\([\s\S]*this\.selectedRssItems = \[\];[\s\S]*this\.loadRssSourceItems\(generation, subscriptionId\)/);
assert.doesNotMatch(index, /this\.selectedRssItems = this\.rssRecentUnread\(\)\.filter/);
assert.match(index, /focusedSubscriptionId: this\.rssManagementFocusSubscriptionId/);
assert.match(index, /onEditSource: \(\): void =>\s*this\.openRssManagementForSubscription/);
assert.match(index, /onSourceSettings: \(\): void =>\s*this\.openRssManagementForSubscription/);
assert.match(index, /HOST_CAPABILITY_GAP: RSS original link requires webview\.open Host wiring/);
assert.match(entryDetail, /export type RssFavoritePresentation = 'loading' \| 'favorited' \| 'notFavorited' \| 'unavailable'/);
assert.match(entryDetail, /favoriteState === 'favorited' \? TOK_PRIMARY_SOFT/);
assert.match(entryDetail, /enabled\(this\.favoriteState === 'favorited' \|\| this\.favoriteState === 'notFavorited'\)/);
assert.match(entryDetail, /Text\('摘要'\)/);
assert.match(entryDetail, /private summaryBodyCard\(\)/);
assert.match(entryDetail, /private hasOriginalLink\(\): boolean/);
assert.equal((entryDetail.match(/\.enabled\(this\.hasOriginalLink\(\)\)/g) ?? []).length, 2);
assert.doesNotMatch(entryDetail, /private bodyCard\(|bodyParagraphs\(|已解析正文/);

// Management rows are projections of full Core source truth. Add/edit and
// document import/export use the full-source protocol without an ArkUI store.
const managementMeta = index.match(
  /private rssSubscriptionManagementMeta\(subscription: RssSubscription\): string \{[\s\S]*?\n  \}/,
)?.[0] ?? '';
assert.match(managementMeta, /subscription\.siteUrl/);
assert.match(managementMeta, /subscription\.feedUrl/);
assert.match(managementMeta, /subscription\.lastFetchAt/);
assert.match(managementMeta, /subscription\.sourceGroup/);
assert.match(managementMeta, /subscription\.customOrder/);
assert.match(managementMeta, /subscription\.ruleArticles/);
assert.match(managementMeta, /已停用/);
assert.doesNotMatch(managementMeta, /unreadCount|正常|健康|文章|条/);
assert.match(index, /route = 'rssSubscriptionEditor'/);
assert.match(index, /getRssEditorOrchestrator\(\)\.openCreate\(\)/);
assert.match(index, /getRssEditorOrchestrator\(\)\.openEdit\(subscriptionId\)/);
assert.match(editor, /export struct RssSubscriptionEditorPage/);
assert.match(editor, /constraintSize\(\{ minHeight: 60 \}\)/);
assert.match(editorOrchestrator, /gateway\.createSubscription/);
assert.match(editorOrchestrator, /gateway\.updateSubscription/);
assert.match(gateway, /request\('rss-source\.list'/);
assert.equal((gateway.match(/request\('rss-source\.put'/g) ?? []).length, 2);
assert.match(gateway, /request\('rss-source\.import'/);
assert.match(gateway, /request\('rss-source\.export'/);
assert.match(gateway, /selectRssSourceJson\(\)/);
assert.match(gateway, /saveRssSourceJson\(json, 'reader-rss-sources\.json'\)/);
assert.match(editor, /来源组织与刷新/);
assert.match(editor, /规则型 RSS（HTML）/);
assert.match(editorOrchestrator, /sourceGroup: subscription\.sourceGroup/);
assert.match(index, /private requestRssSourceImport\(\): void/);
assert.match(index, /private exportRssSources\(\): void/);
assert.match(orchestrator, /private mutationChain: Promise<void> = Promise\.resolve\(\)/);

// Aggregate main-page modes, main-page refresh, and URL Host opening
// remain explicit gaps. Scoped SourceFeed/EntryDetail actions must not regress
// to the removed generic no-op dispatchers.
assert.doesNotMatch(index, /RSS SourceFeed action %\{private\}s has no admitted transaction/);
assert.doesNotMatch(index, /RSS EntryDetail action %\{private\}s has no admitted host transaction/);
assert.match(index, /RSS refresh is placeholder-only until its admitted flow is supplied/);
assert.match(index, /RSS mode %\{private\}s has no admitted data contract/);
assert.match(index, /rss\.entries\.query/);

// Filter is an inline disclosure in normal layout flow, not a dropdown/select.
assert.doesNotMatch(rss, /ReaderSelect/);
assert.match(rss, /筛选 = 内联展开 \(非下拉\)/);
assert.match(rss, /if \(this\.filterOpen\) \{\s*this\.filterExpand\(\)/);
assert.match(rss, /this\.filterValue = opt/);
assert.match(rss, /return \['全部', '有更新', '暂停'\]/);
assert.doesNotMatch(rss, /'正常'|'需登录'|authNeeded/);
assert.doesNotMatch(rss, /this\.actionPill\('导入'|this\.actionPill\('新建'/);

// Compact visual pills keep their Figma dimensions, but standalone actions
// expose a 44vp touch response region. Dense wrapping filter chips are
// intentionally excluded because expanded regions would overlap siblings.
assert.equal((rss.match(/\.responseRegion\(\{ x: 0, y: -\d+, width: '100%', height: 44 \}\)/g) ?? []).length, 7);
assert.equal((sourceFeed.match(/\.responseRegion\(\{ x: 0, y: -\d+, width: '100%', height: 44 \}\)/g) ?? []).length, 1);
assert.equal((entryDetail.match(/\.responseRegion\(\{ x: 0, y: -\d+, width: '100%', height: 44 \}\)/g) ?? []).length, 1);

console.log('rss page architecture contract: PASS');
