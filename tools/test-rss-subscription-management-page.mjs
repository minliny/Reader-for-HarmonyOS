import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"focus-scroll": {"description": "实际page→StandardPage→native Scroll保原Scroller/焦点/area", "resources": []}};
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { dirname, resolve } = await import('node:path');
const { fileURLToPath } = await import('node:url');
const { boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { createDefaultReaderWindowMetrics } = await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const { createRequire } = await import('node:module');


const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const page = readFileSync(resolve(
  repo,
  'entry/src/main/ets/features/rss/RssSubscriptionManagementPage.ets',
), 'utf8');

// Actual page -> standard body slot -> native Scroll retains the original
// focus controller. Unrelated stats/list content is an explicit Builder seam;
// the real pageContent delegation and focus method are executed unchanged.
{
 const sdk=boundedSurfaceSdk(),scrolls=[],bodies=[],queue=[];
 class Scroller{scrollTo(value){scrolls.push(value);}}
 class Header{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
 sdk.childSources.PageBackBar=readFileSync(resolve(repo,'entry/src/main/ets/features/common/PageBackBar.ets'),'utf8');
 const loader=resolveEtsLoaderRoot();
 createRequire(import.meta.url)(loader+'/lib/validate_ui_syntax.js').builderParamObjectCollection.set('PageBackBar',new Set(['trailing']));
 const metrics=createDefaultReaderWindowMetrics();metrics.windowRect.width=393;metrics.systemInsets.left=24;metrics.cutoutInsets.right=30;
 const owner=sdk.consumer(page,['build','pageContent','backBar','pageScroller','focusSubscriptionIfNeeded','expandedSubscriptionId','focusedSubscriptionId'],
  {Scroller,PageBackBar:Header,ReaderWindowCoordinator:{metrics:()=>metrics},setTimeout:action=>queue.push(action)});
 Object.assign(owner,{focusedSubscriptionId:'feed',stats:()=>bodies.push('stats'),operationFeedback:()=>bodies.push('operationFeedback'),subscriptionList:()=>bodies.push('subscriptionList')});owner.initialRender();
 const child=sdk.walk(owner).find(actor=>actor.variant==='rssManagement');assert.ok(child);assert.equal(child.scroller,owner.pageScroller);
 const scroll=[...child.nodes.values()].find(node=>node.type==='Scroll');assert.ok(scroll);assert.equal(scroll.create,owner.pageScroller);assert.equal(scroll.height,'100%');
 assert.deepEqual(bodies,['stats','operationFeedback','subscriptionList']);
 const body=[...child.nodes.values()].find(node=>node.type==='Column'&&node.padding);assert.deepEqual([body.padding.left,body.padding.right],[24,30]);
 owner.focusSubscriptionIfNeeded({subscriptionId:'feed'},3);queue.shift()();assert.equal(scrolls.length,1);assert.equal(scrolls[0].xOffset,0);assert.ok(scrolls[0].yOffset>0);assert.equal(scrolls[0].animation,false,'focus restores through actual native controller without invented layout timing');
 assert.equal(owner.expandedSubscriptionId,'feed');sdk.properties.flush();assert.equal(child.scroller,owner.pageScroller);assert.equal(scroll.create,owner.pageScroller);assert.deepEqual(bodies,['stats','operationFeedback','subscriptionList']);
}

console.log('rss subscription management page contract: PASS');

}
