import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

// Reuse the production Surface and existing installed-SDK fixture. Only native
// frame delivery and rectangle reads are controlled; no compositor claim.
const fixtureUrl = new URL('./test-manga-scroll-stability-sdk.mjs', import.meta.url);
const fixture = readFileSync(fixtureUrl, 'utf8');
const cut = fixture.indexOf('const failures = [];');
assert.ok(cut > 0);
const prelude = fixture.slice(0, cut)
  .replace(/from '([^']+)'/g, (all, specifier) => specifier.startsWith('.') ? `from '${new URL(specifier, fixtureUrl).href}'` : all)
  .replaceAll('import.meta.url', JSON.stringify(fixtureUrl.href));
const scenarios = `
list.onScrollIndex(0, 1); await tick(); properties.flush();
const horizontal = [...owner.nodes.values()].find(node => node.type === 'Scroll');
assert.equal(list.scrollBar, 'BarState.Off');
assert.equal(horizontal.scrollBar, 'BarState.Off');
let rectangleQueries = 0, offsetQueries = 0, latestY = -20;
owner.scroller.getItemRect = () => { rectangleQueries++; return { x:0, y:latestY, width:300, height:300 }; };
owner.horizontalScroller.currentOffset = () => { offsetQueries++; return { xOffset:0 }; };
const before = snapshot();
for (let index=0; index<100; index++) { list.onScroll(); horizontal.onScroll(); }
assert.equal(rectangleQueries,0,'native input/scroll callbacks do not synchronously query layout');
assert.equal(offsetQueries,0);
assert.equal(frames.length,1,'both scrollers share one pending observation');
latestY = -150;
const observation = frames.shift();observation.onFrame(0);
assert.equal(rectangleQueries,0,'frame start precedes rendered native geometry');
observation.onIdle(2_000_000); await tick(); properties.flush();
assert.equal(rectangleQueries,1); assert.equal(offsetQueries,1);
assert.equal(owner.visibleAnchor.y,0.25,'delivered frame observes latest native position');
assert.equal(snapshot().mounts,before.mounts); assert.equal(snapshot().reloads,before.reloads);
assert.equal(snapshot().changes,before.changes); assert.deepEqual(snapshot().actors,before.actors);
console.log('PASS 200 actual SDK scroll callbacks coalesce to one latest-position read, retaining Image actors');

owner.restoringAnchor=true; owner.appliedLayoutGeneration=owner.layoutGeneration;
const restoredQueries=rectangleQueries;
for (let index=0; index<100; index++) list.onScrollIndex(0,1);
assert.equal(rectangleQueries,restoredQueries,'restore range callbacks cannot re-enter native geometry');
assert.equal(frames.length,1);
const restored = frames.shift();restored.onFrame(0);assert.equal(owner.restoringAnchor,true);
restored.onIdle(2_000_000); await tick();
assert.equal(owner.restoringAnchor,false);
assert.equal(rectangleQueries,restoredQueries+1);
console.log('PASS repeated native restoration callbacks defer geometry and settle the current anchor');

list.onScroll(); horizontal.onScroll(); assert.equal(frames.length,1);
owner.controller.close = async () => {};
owner.restoreAppWindowChrome = () => {};
owner.aboutToDisappear();
{const frame=frames.shift();frame.onFrame(0);frame.onIdle(2_000_000);}
assert.equal(rectangleQueries,restoredQueries+1,'disappeared Surface cannot read native layout');
assert.equal(offsetQueries,2);
console.log('PASS pending observation is invalidated by production disappearance');

// Final stop still captures immediately; pending observation cannot subsequently
// overwrite the saved, confirmed position. Use the same admitted image context.
owner.mounted=true; owner.opened=true; owner.controller.savePosition=async()=>{};
owner.controller.savedLocation=null; latestY=-90;
list.onScroll(); assert.equal(frames.length,1);
list.onScrollStop(); await tick();
assert.equal(owner.confirmedPosition.anchor.y,0.15);
const finalQueries=rectangleQueries;
{const frame=frames.shift();frame.onFrame(0);frame.onIdle(2_000_000);}
assert.equal(rectangleQueries,finalQueries,'native stop consumes and cancels the pending observation');
console.log('PASS native stop captures position synchronously and cancels obsolete observation');
`;
const directory = mkdtempSync(join(tmpdir(), 'reader-manga-observation-'));
try {
  const file = join(directory, 'probe.mjs'); writeFileSync(file, prelude + scenarios);
  await import(pathToFileURL(file).href);
} finally { rmSync(directory, { recursive:true, force:true }); }
