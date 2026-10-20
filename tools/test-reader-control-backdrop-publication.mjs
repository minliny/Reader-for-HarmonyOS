import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

const source = new URL('../entry/src/main/ets/features/reading/ReaderControlPanel.ets', import.meta.url);
const Panel = productionMotionMethods(source, ['reportBackdropRegions'], {});
const calls = [];
const dock = { x: 0, y: 0, width: 100, height: 200, borderRadius: 24 };
const top = { x: 10, y: 20, width: 80, height: 40 };
const regions = [dock, { x: 0, y: 0, width: 0, height: 0 }];
const panel = Object.assign(new Panel(), {
  dockRect: dock, topBarRect: top, backdropRegions: regions, dockMeasured: true,
  controlObscured: false, frame: () => ({ topBar: { translateY: 5 } }),
  onBackdropRegionsChange: (value, ready) => calls.push({ value, ready }),
});
panel.reportBackdropRegions();
assert.equal(calls.length, 1);
assert.equal(calls[0].value, regions);
assert.equal(calls[0].value[0], dock);
assert.deepEqual(calls[0].value[1], { x: 10, y: 25, width: 80, height: 40, borderRadius: 24 });
assert.equal(calls[0].value[0].borderRadius, 24, 'dock retains its visual shell radius');
panel.frame = () => ({ topBar: { translateY: 12 } });
panel.reportBackdropRegions();
assert.equal(calls[1].value, regions, 'motion reuses the same region array');
assert.equal(calls[1].value[1], calls[0].value[1], 'motion reuses the same top-bar rect');
assert.deepEqual(calls[1].value[1], { x: 10, y: 32, width: 80, height: 40, borderRadius: 24 });
panel.dockMeasured = false; panel.reportBackdropRegions();
assert.equal(calls[2].ready, false);

// Execute the Host's unmodified SDK adapter. Native drawing is instrumented:
// these assertions cover vp translation and cache keys, not native curve pixels.
const paths = [];
const drawing = {
  RoundRect: class {
    constructor(rect, xRadius, yRadius) { Object.assign(this, { rect, xRadius, yRadius }); }
  },
  Path: class {
    constructor() { this.points = []; paths.push(this); }
    addRoundRect(roundRect) { this.roundRect = roundRect; }
    contains(x, y) { this.points.push([x, y]); return this.accepted ?? true; }
  },
};
const Host = productionMotionMethods(new URL(
  '../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url),
  ['controlBackdropContainsRoundedRect'], { drawing });
const host = new Host();
let rect = { x: 13, y: 19, width: 364, height: 54, borderRadius: 24 };
assert.equal(host.controlBackdropContainsRoundedRect(rect, 14, 20), true);
assert.equal(paths.length, 1);
assert.deepEqual(paths[0].roundRect, new drawing.RoundRect(
  { left: 0, top: 0, right: 364, bottom: 54 }, 24, 24));
assert.deepEqual(paths[0].points, [[1, 1]], 'window vp point is translated into local native path coordinates');
rect = { ...rect, x: 20, y: 80 };
paths[0].accepted = false;
assert.equal(host.controlBackdropContainsRoundedRect(rect, 21, 81), false, 'native containment result is retained');
assert.equal(paths.length, 1, 'motion translations reuse the native path');
assert.deepEqual(paths[0].points.at(-1), [1, 1]);
for (const change of [{ width: 350 }, { height: 60 }, { borderRadius: 20 }]) {
  const previousCount = paths.length;
  rect = { ...rect, ...change };
  host.controlBackdropContainsRoundedRect(rect, rect.x + 1, rect.y + 1);
  assert.equal(paths.length, previousCount + 1, 'size and radius each invalidate the native path cache');
  assert.equal(paths.at(-1).roundRect.xRadius, rect.borderRadius);
  assert.equal(paths.at(-1).roundRect.yRadius, rect.borderRadius);
}
console.log('Reader control backdrop: stable R24 publication and native path adapter/cache PASS');
