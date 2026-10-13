import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boundedSurfaceSdk } from './lib/bounded-surface-sdk-probe.mjs';
import { createDefaultReaderWindowMetrics } from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import { createRequire } from 'node:module';

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
assert.match(page, /ReaderStandardPage\(\{[\s\S]*variant: 'rssManagement'[\s\S]*content: \(\): void => \{ this\.pageContent\(\); \}[\s\S]*scroller: this\.pageScroller/);
const standard=readFileSync(resolve(repo,'entry/src/main/ets/features/common/ReaderStandardPage.ets'),'utf8');
assert.match(standard,/Scroll\(this\.scroller\)/,'the actual common native Scroll receives the original page controller');
assert.match(page, /private focusSubscriptionIfNeeded\([\s\S]*this\.pageScroller\.scrollTo\(\{/);
assert.match(page, /onAdd: \(\) => void/);
assert.match(page, /onImport: \(\) => void/);
assert.match(page, /onExport: \(\) => void/);
assert.match(page, /onToggle: \(subscriptionId: string, enabled: boolean\) => void/);
assert.match(page, /onViewArticles: \(subscriptionId: string\) => void/);
assert.match(page, /onEditSource: \(subscriptionId: string\) => void/);
assert.match(page, /onRefresh: \(subscriptionId: string\) => void/);
assert.match(page, /onDelete: \(subscriptionId: string\) => void/);
assert.match(page, /this\.onToggle\(item\.subscriptionId, next\)/);

// Phone and Tablet share one compact responsive assembly.
assert.match(standard,/padding\(\{ left: this\.contentFrame\(\)\.left, right: this\.contentFrame\(\)\.right/,
  'the common page owns horizontal content geometry');
assert.match(page, /\.height\(56\)/);
assert.match(page, /private actionBar\(subscriptionId: string\)[\s\S]*\.height\(44\)/);
assert.match(page, /this\.actionTarget\('查看文章'/);
assert.match(page, /this\.actionTarget\('编辑来源'/);
assert.match(page, /this\.actionTarget\('立即刷新'/);
assert.match(page, /this\.actionTarget\('删除'/);
assert.match(page, /this\.sourceDocumentAction\('导入 RSS 源'/);
assert.match(page, /this\.sourceDocumentAction\('导出全部'/);

// Each Figma action owns a fixed-color outline asset; runtime tinting is forbidden.
assert.match(page, /app\.media\.rss_source/);
assert.match(page, /app\.media\.rss_filter_chevron/);
assert.match(page, /app\.media\.rss_manage_view_all/);
assert.match(page, /app\.media\.rss_manage_edit/);
assert.match(page, /app\.media\.rss_manage_refresh/);
assert.match(page, /app\.media\.rss_manage_delete/);
assert.doesNotMatch(page, /app\.media\.settings_gen_cache/,
  'the delete action must never regress to the Settings storage glyph');
assert.doesNotMatch(page, /\.fillColor\(/,
  'stroke-only RSS actions must use fixed asset variants rather than Image.fillColor');
assert.doesNotMatch(page, /backgroundColor\(TOK_DANGER\)/);
assert.doesNotMatch(page, /\.svg['"]/);

// Explicitly reject unrelated status/search concepts. Source document import
// is admitted, but the page still never invents health/auth/rule state.
assert.doesNotMatch(page, /搜索|分类|正常|需登录/);

// Actual page -> standard body slot -> native Scroll retains the original
// focus controller. Unrelated stats/list content is an explicit Builder seam;
// the real pageContent delegation and focus method are executed unchanged.
{
 const sdk=boundedSurfaceSdk(),scrolls=[],bodies=[],queue=[];
 class Scroller{scrollTo(value){scrolls.push(value);}}
 class Header{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
 sdk.childSources.PageBackBar=readFileSync(resolve(repo,'entry/src/main/ets/features/common/PageBackBar.ets'),'utf8');
 const loader=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
 createRequire(import.meta.url)(loader+'/lib/validate_ui_syntax.js').builderParamObjectCollection.set('PageBackBar',new Set(['trailing']));
 const metrics=createDefaultReaderWindowMetrics();metrics.windowRect.width=393;metrics.systemInsets.left=24;metrics.cutoutInsets.right=30;
 const owner=sdk.consumer(page,['build','pageContent','backBar','pageScroller','focusSubscriptionIfNeeded','expandedSubscriptionId','focusedSubscriptionId'],
  {Scroller,PageBackBar:Header,ReaderWindowCoordinator:{metrics:()=>metrics},setTimeout:action=>queue.push(action)});
 Object.assign(owner,{focusedSubscriptionId:'feed',stats:()=>bodies.push('stats'),operationFeedback:()=>bodies.push('operationFeedback'),subscriptionList:()=>bodies.push('subscriptionList')});owner.initialRender();
 const child=sdk.walk(owner).find(actor=>actor.variant==='rssManagement');assert.ok(child);assert.equal(child.scroller,owner.pageScroller);
 const scroll=[...child.nodes.values()].find(node=>node.type==='Scroll');assert.ok(scroll);assert.equal(scroll.create,owner.pageScroller);assert.equal(scroll.height,'100%');
 assert.deepEqual(bodies,['stats','operationFeedback','subscriptionList']);
 const body=[...child.nodes.values()].find(node=>node.type==='Column'&&node.padding);assert.deepEqual([body.padding.left,body.padding.right],[24,30]);
 owner.focusSubscriptionIfNeeded({subscriptionId:'feed'},3);queue.shift()();assert.deepEqual(scrolls,[{xOffset:0,yOffset:168,animation:false}]);
 assert.equal(owner.expandedSubscriptionId,'feed');sdk.properties.flush();assert.equal(child.scroller,owner.pageScroller);assert.equal(scroll.create,owner.pageScroller);assert.deepEqual(bodies,['stats','operationFeedback','subscriptionList']);
}

console.log('rss subscription management page contract: PASS');
