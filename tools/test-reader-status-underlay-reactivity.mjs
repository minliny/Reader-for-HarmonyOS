import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { ReaderRectVp } from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import { READER_THEME_DEFINITIONS } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import { readerAppearanceThemeStyle } from '../entry/src/main/ets/features/reading/ReaderAppearanceRenderStyle.ts';

const source = readFileSync(new URL(
  '../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url), 'utf8');
const members = ['readerStatusBarUnderlay'];
// Keep this test executable against the original implementation as well as
// its geometry helper. Both are extracted from the actual production source.
if (/private readerStatusBarMetrics\(/.test(source)) members.push('readerStatusBarMetrics');

function fixture(rect = new ReaderRectVp(), theme = 'warmNight') {
  let metrics = { statusBarRect: rect, statusBarHeight: rect.height };
  const state = {
    windowChromeActive: true,
    readerSettingsSnapshot: { extendIntoCutout: false },
    appearanceSnapshot: { activeTheme: theme },
    readerWindowMetricsRevision: 1,
  };
  const activeObservers = [];
  const dependencies = new Map();
  const { owner } = createReaderBuilderProbe(source, members, {
    ReaderWindowCoordinator: { metrics: () => metrics },
    readerAppearanceThemeStyle,
  }, {
    onObserverEnter: (_owner, id) => {
      activeObservers.push(id);
      dependencies.set(id, new Set());
    },
    onObserverExit: (_owner, id) => assert.equal(activeObservers.pop(), id),
  });
  // Observe the properties actually read by SDK-emitted Row/If closures. Only
  // observers that read the changed property are replayed; an unconditional
  // Builder replay would conceal a missing ArkUI state dependency.
  for (const key of Object.keys(state)) {
    Object.defineProperty(owner, key, {
      get() {
        const id = activeObservers.at(-1);
        if (id !== undefined) dependencies.get(id).add(key);
        return state[key];
      },
    });
  }
  owner.controlsPresentedForWindow = () => false;
  owner.readerStatusBarUnderlay();
  const initialObserverCount = owner.observers.length;
  function update(key, value) {
    state[key] = value;
    const ids = [...dependencies].filter(([, keys]) => keys.has(key)).map(([id]) => id);
    owner.replayOnly(ids);
    assert.equal(owner.observers.length, initialObserverCount, 'existing underlay must remain mounted');
    return ids;
  }
  function row() {
    const rows = [...owner.nodes.values()].filter(node => node.id === 'reader-status-bar-underlay');
    assert.equal(rows.length, 1);
    return rows[0];
  }
  return {
    row,
    geometry: () => ({ width: row().width, height: row().height, position: row().position }),
    updateMetrics(nextRect) {
      metrics = { statusBarRect: nextRect, statusBarHeight: nextRect.height };
      return update('readerWindowMetricsRevision', state.readerWindowMetricsRevision + 1);
    },
    updateTheme: themeId => update('appearanceSnapshot', { activeTheme: themeId }),
  };
}

const results = [];
function check(name, run) {
  try {
    run();
    results.push({ name, status: 'PASS' });
  } catch (error) {
    results.push({ name, status: 'FAIL', error: error.stack });
  }
}

check('disabled extension: zero initial measured region recovers through the metrics dependency', () => {
  const f = fixture();
  assert.deepEqual(f.geometry(), { width: 0, height: 0, position: { x: 0, y: 0 } });
  const observers = f.updateMetrics(new ReaderRectVp(0, 0, 390, 48));
  assert.deepEqual(f.geometry(), { width: 390, height: 48, position: { x: 0, y: 0 } },
    `late measured geometry must reach the retained Row; metrics observers=${JSON.stringify(observers)}`);
  assert.equal(f.row().backgroundColor, '#FF413020');
});

check('measured origin, width and height update without a theme change or remount', () => {
  const f = fixture(new ReaderRectVp(0, 0, 390, 48), 'green');
  f.updateMetrics(new ReaderRectVp(4, 2, 382, 46));
  assert.deepEqual(f.geometry(), { width: 382, height: 46, position: { x: 4, y: 2 } });
  assert.equal(f.row().backgroundColor, '#FFE3EBDD');
});

check('all eight reading palettes remain unchanged in the retained underlay', () => {
  const f = fixture(new ReaderRectVp(3, 1, 384, 50));
  for (const theme of READER_THEME_DEFINITIONS) {
    f.updateTheme(theme.id);
    assert.equal(f.row().backgroundColor, theme.statusBackground, theme.id);
    assert.deepEqual(f.geometry(), { width: 384, height: 50, position: { x: 3, y: 1 } });
    assert.equal(f.row().zIndex, 10);
  }
});

for (const result of results) console.log(JSON.stringify(result));
assert.equal(results.filter(result => result.status === 'FAIL').length, 0,
  'SDK-emitted status-underlay observers must subscribe to the measured geometry revision');
console.log('PASS production SDK observers and observed-property scheduling; no native layout, device pixels or failure-frequency claim.');
