import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

const source = new URL('../entry/src/main/ets/features/reading/ReaderControlPanel.ets', import.meta.url);
const Panel = productionMotionMethods(source, ['reportBackdropRegions'], {});
const calls = [];
const dock = { x: 0, y: 0, width: 100, height: 200 };
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
assert.deepEqual(calls[0].value[1], { x: 10, y: 25, width: 80, height: 40 });
panel.frame = () => ({ topBar: { translateY: 12 } });
panel.reportBackdropRegions();
assert.equal(calls[1].value, regions, 'motion reuses the same region array');
assert.equal(calls[1].value[1], calls[0].value[1], 'motion reuses the same top-bar rect');
assert.deepEqual(calls[1].value[1], { x: 10, y: 32, width: 80, height: 40 });
panel.dockMeasured = false; panel.reportBackdropRegions();
assert.equal(calls[2].ready, false);
console.log('Reader control backdrop publication: stable array/rect identity across motion PASS');
