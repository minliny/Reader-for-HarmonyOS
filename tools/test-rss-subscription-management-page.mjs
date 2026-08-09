import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const page = readFileSync(resolve(
  repo,
  'entry/src/main/ets/features/rss/RssSubscriptionManagementPage.ets',
), 'utf8');

// One true child page, built from the existing Reader child-page primitives.
assert.match(page, /export struct RssSubscriptionManagementPage/);
assert.match(page, /PageBackBar\(\{/);
assert.match(page, /title: '订阅源管理'/);
assert.match(page, /ReaderToggle\(\{/);
assert.doesNotMatch(page, /MainTabShell|BottomNav|NavigationRail/);

// The page owns disclosure only; Core data and every business action are inputs/intents.
assert.equal((page.match(/@State/g) ?? []).length, 1);
assert.match(page, /@State private expandedSubscriptionId: string = ''/);
assert.match(page, /@Prop focusedSubscriptionId: string = ''/);
assert.match(page, /item\.subscriptionId === this\.focusedSubscriptionId/);
assert.match(page, /this\.expandedSubscriptionId = this\.focusedSubscriptionId/);
assert.match(page, /private readonly pageScroller: Scroller = new Scroller\(\)/);
assert.match(page, /Scroll\(this\.pageScroller\)/);
assert.match(page, /private focusSubscriptionIfNeeded\([\s\S]*this\.pageScroller\.scrollTo\(\{/);
assert.match(page, /onAdd: \(\) => void/);
assert.match(page, /onToggle: \(subscriptionId: string, enabled: boolean\) => void/);
assert.match(page, /onViewArticles: \(subscriptionId: string\) => void/);
assert.match(page, /onEditSource: \(subscriptionId: string\) => void/);
assert.match(page, /onRefresh: \(subscriptionId: string\) => void/);
assert.match(page, /onDelete: \(subscriptionId: string\) => void/);
assert.match(page, /this\.onToggle\(item\.subscriptionId, !item\.enabled\)/);

// Phone and Tablet share one compact responsive assembly.
assert.match(page, /return this\.isTablet \? TOK_CONTENT_MAX_W_TABLET : TOK_CONTENT_MAX_W_PHONE/);
assert.match(page, /\.height\(56\)/);
assert.match(page, /private actionBar\(subscriptionId: string\)[\s\S]*\.height\(44\)/);
assert.match(page, /this\.actionTarget\('查看文章'/);
assert.match(page, /this\.actionTarget\('编辑来源'/);
assert.match(page, /this\.actionTarget\('立即刷新'/);
assert.match(page, /this\.actionTarget\('删除'/);

// Reuse supplied assets; deletion is danger-colored but has no danger background.
assert.match(page, /app\.media\.rss_source/);
assert.match(page, /app\.media\.rss_filter_chevron/);
assert.match(page, /app\.media\.rss_view_all/);
assert.match(page, /app\.media\.rss_edit/);
assert.match(page, /app\.media\.rss_refresh/);
assert.match(page, /app\.media\.settings_gen_cache/);
assert.match(page, /danger \? TOK_DANGER : TOK_PRIMARY_DARK/);
assert.doesNotMatch(page, /backgroundColor\(TOK_DANGER\)/);
assert.doesNotMatch(page, /\.svg['"]/);

// Explicitly reject the removed or unsupported management concepts.
assert.doesNotMatch(page, /搜索|分类|正常|需登录|规则|导入/);

console.log('rss subscription management page contract: PASS');
