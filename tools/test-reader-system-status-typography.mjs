import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { chromeTypography, readerPageChromeTopTextStyle, measureReaderPageChromeText } from './lib/reader-page-chrome-measurement-probe.mjs';
import { ReaderPageChromeMeasurements, resolveReaderPageChromeLayout } from '../entry/src/main/ets/features/reading/ReaderPageChromeLayout.ts';
registerHooks({ resolve(s, c, next) { try { return next(s, c); } catch (error) {
  if (s.startsWith('.') && !s.endsWith('.ts')) return next(`${s}.ts`, c); throw error;
} } });
const { ReaderRectVp: Rect, ReaderWindowMetricsSnapshot: Metrics } = await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const { resolveReaderReadingLayout } = await import('../entry/src/main/ets/features/reading/ReaderLayoutGeometry.ts');

function reading(height = 48, extended = true) {
  const metrics = new Metrics();
  Object.assign(metrics, {ready: true, windowRect: new Rect(0, 0, 390, 844),
    statusBarHeight: height, statusBarRect: new Rect(0, 0, 390, height)});
  return resolveReaderReadingLayout(390, 844, false, metrics, extended);
}
// Resource values and native glyph measurements are independent boundary
// inputs. Production code must not derive either from status-region height.
let density = 3, scale = 1.5, resourceFp = 16, nativeLineHeightFp = 21;
let resourceFailure = false, nativeCalls = 0, resourceReads = 0;
const optionsSeen = [];
const context = {
  px2vp: px => px / density, fp2px: fp => fp * density * scale,
  px2fp: px => px / (density * scale),
  getHostContext: () => ({resourceManager: {getNumber(id) {
    resourceReads++;
    assert.equal(id, 'sys.float.ohos_id_text_size_body2');
    if (resourceFailure) throw new Error('resource unavailable');
    return resourceFp * density * scale;
  }}}),
  getMeasureUtils: () => ({
    measureTextSize(options) { nativeCalls++; optionsSeen.push(options);
      return {width: options.textContent.length * options.fontSize * 0.5 * density * scale,
        height: nativeLineHeightFp * density * scale}; },
    measureText: options => options.textContent.length * options.fontSize * 0.5 * density * scale,
  }),
};
let layout = reading(); layout.systemFontScale = scale;
const style = readerPageChromeTopTextStyle(layout, context);
assert.equal(style.fontFamily, 'HarmonyOS Sans');
assert.equal(style.fontSizeFp, resourceFp, '72 resource pixels resolve to 16fp, not 72fp or 24fp');
assert.equal(style.lineHeightFp, undefined, 'the upstream AUTO role is not replaced with a guessed font ratio');
const cache = new Map();
assert.deepEqual(measureReaderPageChromeText('12:30', style, layout, context, cache), {width: 60, height: 31.5});
assert.equal(optionsSeen[0].fontSize, 16, 'native measure consumes the same fp value as Text');
measureReaderPageChromeText('12:30', style, layout, context, cache);
assert.equal(nativeCalls, 1, 'existing bounded cache shares native text measurements');
resourceFp = 18;
assert.equal(readerPageChromeTopTextStyle(layout, context).fontSizeFp, 18, 'resource overrides are not frozen to upstream defaults');
resourceFailure = true;
assert.equal(readerPageChromeTopTextStyle(layout, context), chromeTypography.TYPE_READER_IMMERSIVE_TIME,
  'resource failure uses the explicit original fallback, never a status-height inference');
resourceFailure = false;
assert.equal(readerPageChromeTopTextStyle(reading(0), context), chromeTypography.TYPE_READER_IMMERSIVE_TIME);

scale = 0.85; layout.systemFontScale = 0.85;
assert.equal(measureReaderPageChromeText('9%', chromeTypography.TYPE_READER_IMMERSIVE_PROGRESS, layout, context, cache).height,
  14.4 * 0.85, 'explicit fp line height uses current native conversion even below scale 1');
scale = 1; resourceFp = 16;
const geometry = (height, accessory = 24, extended = true) => resolveReaderPageChromeLayout(reading(height, extended),
  new ReaderPageChromeMeasurements(100, 21, 40, 21, 0, 0, 0, 0, false, 0, 0, accessory, accessory));
const short = geometry(36), tall = geometry(60), withoutBookmark = geometry(36, 0);
assert.equal(short.topStartX, tall.topStartX, 'bar height cannot invent a different left glyph inset');
assert.equal(short.topEndX + 40, tall.topEndX + 40, 'bar height cannot invent a different right glyph inset');
assert.equal(short.topEndX, withoutBookmark.topEndX, 'the bookmark no longer pushes the clock away from its outer edge');
assert.equal(short.topStartX, withoutBookmark.topStartX, 'the bookmark never shifts the title outer edge');
assert.ok(short.topAccessoryX + short.topAccessoryWidth < short.topEndX);
assert.ok(short.topStartX + short.topStartMaxWidth < short.topAccessoryX);
assert.equal(geometry(36, 24, false).topEndY - short.topEndY, 36,
  'normal and extended mode move the whole native-height line by one real status region');

layout = reading();
layout.pageChromeStatusMetrics.statusBarRect = new Rect(20, 0, 350, 48);
const inset = resolveReaderPageChromeLayout(layout, new ReaderPageChromeMeasurements(100, 21, 40, 21));
assert.equal(inset.topStartX, 44, 'window-relative status origin participates in the left track');
assert.equal(inset.topEndX + 40, 346, 'status width participates in the right track');

const TopStyleOwner = productionMotionMethods(new URL('../entry/src/main/ets/features/reading/ReaderPageChrome.ets', import.meta.url),
  ['topTextStyle'], {readerPageChromeTopTextStyle});
const owner = Object.assign(new TopStyleOwner(), {layout: reading(), getUIContext: () => context});
const beforeReads = resourceReads;
const cachedStyle = owner.topTextStyle();
for (let frame = 0; frame < 20; frame++) assert.equal(owner.topTextStyle(), cachedStyle);
assert.equal(resourceReads, beforeReads + 1, 'one component resolves the system resource once per geometry/configuration revision');
owner.layout.pageChromeStatusMetrics.revision++;
owner.topTextStyle();
assert.equal(resourceReads, beforeReads + 2, 'a new platform revision invalidates the cached typography');
density = 2; owner.topTextStyle();
assert.equal(resourceReads, beforeReads + 3, 'display density invalidates the cached resource conversion');
scale = 1.5; owner.topTextStyle();
assert.equal(resourceReads, beforeReads + 4, 'native font scale invalidates the cached resource conversion');
console.log('PASS PH114 production top typography: system resource units, AUTO native measurements, fallback, scaling and stable outer tracks');
