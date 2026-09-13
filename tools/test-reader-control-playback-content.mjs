import * as ttsConfig from '../entry/src/main/ets/features/reading/ReaderTtsConfigOptions.ts';
import * as morphScroll from '../entry/src/main/ets/features/reading/ReaderControlMorphScroll.ts';
import * as presentation from '../entry/src/main/ets/features/reading/ReaderControlMotionPresentation.ts';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import * as geometry from '../entry/src/main/ets/features/reading/ReaderControlPlaybackGeometry.ts';
import * as actors from '../entry/src/main/ets/features/reading/ReaderControlActorGeometry.ts';
import * as ttsState from '../entry/src/main/ets/features/reading/ReaderTtsState.ts';
import * as sourceIdentity from '../entry/src/main/ets/features/reading/ReaderSessionMorphState.ts';
import { createReaderBuilderProbe, readerBuilderSdkAvailable } from './lib/reader-control-builder-probe.mjs';

const root = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
const fixture = JSON.parse(readFileSync(new URL('./fixtures/reader-control-playback-live-20260905.json', import.meta.url), 'utf8'));
const near = (a, b, label) => assert.ok(Math.abs(a - b) < 0.0011, `${label}: ${a} != ${b}`);

// Expected samples are derived from the live motion CSS and static node-local
// bounds, not a second copy of production interpolation functions.
function sourceEndpoint(module, id, endpoint) {
  const node = fixture[module].motion.nodes.find(value => value.nodeId === id);
  assert.ok(node, `live motion inventory includes ${id}`);
  const result = { ...fixture.staticBounds[id], opacity: 1 };
  assert.ok(Number.isFinite(result.x), `live static context includes ${id}`);
  const css = node.codeSnippets.css;
  for (const track of css.split('@keyframes ').slice(1)) {
    const property = track.slice(0, track.indexOf(' ')).match(/_(height|width|translate|opacity)_\d+$/)?.[1];
    if (!property) continue;
    const stops = [...track.matchAll(/([\d.]+)%\s*\{([^}]+)\}/g)];
    const stop = endpoint === 0 ? stops[0] : stops.at(-1);
    const value = stop[2].match(new RegExp(`${property}: ([^;]+);`))?.[1];
    assert.ok(value, `${id} ${property} has endpoint`);
    if (property === 'translate') {
      const [x, y] = value.match(/-?[\d.]+/g).map(Number);
      result.x += x; result.y += y;
    } else result[property] = Number.parseFloat(value);
  }
  return result;
}

const makeFixture = JSON.parse(readFileSync(new URL('./fixtures/reader-control-tts-make-20260911.json', import.meta.url), 'utf8'));
const autoNodes = {
  controlHeader: '1938:7532', previous: '1939:785', toggle: '1939:800', playIcon: '1939:801',
  next: '1939:817', stop: '1939:832', stopLabel: '1939:840', timer: '1938:7559',
  detailsHeader: '1938:8073', speed: '1939:848', follow: '1938:8091',
};
function checkGeometry(api = geometry) {
  for (const [module, mapping, sample] of [
    ['autoPage', autoNodes, api.sampleReaderControlAutoPage],
  ]) {
    for (const p of [0, 0.1, 0.25, 0.5, 0.9, 1]) {
      const frame = sample(p, 286 + 52 * p);
      for (const [actor, id] of Object.entries(mapping)) {
        const q = sourceEndpoint(module, id, 0), f = sourceEndpoint(module, id, 1);
        for (const field of ['x', 'y', 'width', 'height', 'opacity']) {
          near(frame[actor][field], q[field] + (f[field] - q[field]) * p, `${module}/${id}/${field}/p${p}`);
        }
      }
      assert.deepEqual(sample(p, 286 + 52 * p), frame, 'reverse/re-grab at same p has same pose');
    }
  }
  const fields = ['x', 'y', 'width', 'height'];
  for (const p of [0, .1, .25, .5, .75, .9, 1, .5, .25, 0]) {
    const frame = api.sampleReaderControlTts(p, 286 + 52 * p);
    for (const [name, [q, f]] of Object.entries(makeFixture.shared)) {
      fields.forEach((field, i) => near(frame[name][field], q[i] + (f[i] - q[i]) * p, `Make/${name}/${field}/p${p}`));
    }
    assert.deepEqual(api.sampleReaderControlTts(p, 286 + 52 * p), frame, 'one p gives identical reverse/re-grab geometry');
  }
  for (const [key, p] of [['quickOnly', 0], ['fullOnly', 1], ['adaptedFull', 1]]) {
    const frame = api.sampleReaderControlTts(p, p === 0 ? 286 : 338);
    for (const [name, values] of Object.entries(makeFixture[key])) {
      // The quick playback label intentionally widens beyond the Make source
      // bounds so its live status subtitle remains readable on the native card.
      if (key === 'quickOnly' && name === 'quickPlaybackLabel') continue;
      fields.forEach((field, i) => near(frame[name][field], values[i], `${key}/${name}/${field}`));
      assert.equal(frame[name].opacity, 1, 'measured endpoint is visible');
    }
  }
  near(api.sampleReaderControlTts(0, 286).quickPlaybackLabel.width, 110,
    'quick playback status keeps the widened readable actor');
  near(api.sampleReaderControlTts(1, 338).contentHeight, makeFixture.fullContentHeight, 'real config rows remain scrollable');

}
checkGeometry();
// Source parent clipping matters independently of matching every child track:
// at p=.25 Speed labels are inside the outer viewport but outside Speed itself.
{
  const receipt = JSON.parse(readFileSync(new URL('./fixtures/reader-control-shared-layer-live-20260906.json', import.meta.url), 'utf8'));
  const parents = receipt.sources.remainingParents.nodes;
  const source = readFileSync(new URL('ReaderControlTtsContent.ets', root), 'utf8');
  for (const [name, id, clipped] of [['playback', '1691:3104', false], ['timer', '1691:3195', true], ['speed', '1691:3258', false]]) {
    assert.equal(parents.find(n => n.id === id).clipsContent, clipped);
    const body = source.split(`  private ${name}() {`)[1].split('  @Builder')[0];
    assert.equal(body.includes('.clip(true)'), clipped, `${name} matches its actual source parent clipping`);
  }
  // The Make preset row is below the Quick actor until it grows; preserve
  // the unclipped child and let the common scroll/morph clip own visibility.
  const frame = geometry.sampleReaderControlTts(.25, 299);
  assert.ok(frame.speedPresets.y > frame.speed.height);

}
for (const p of [0, 0.25, 0.5, 0.75, 1]) {
  for (const delta of [-24, 0, 120]) {
    const frame = geometry.sampleReaderControlTts(p, 286 + 52 * p + delta, 0.73);
    near(frame.speedThumb.width, 18, 'TTS thumb remains rigid at responsive width');
    near(frame.speedThumb.x + 9, frame.speedTrack.x + frame.speedTrack.width * 0.73, 'thumb tracks current business rate');
    assert.ok(frame.next.x + frame.next.width <= frame.playback.width, 'TTS transport fits host width');
  }
  const noSeek = geometry.sampleReaderControlTts(p, 286 + 52 * p);
  const seek = geometry.sampleReaderControlTts(p, 286 + 52 * p, 1 / 3, 32);
  near(seek.timer.y - noSeek.timer.y, 32 * p, 'sentence-seek row expands Timer position simultaneously');
  near(seek.speed.y - noSeek.speed.y, 32 * p, 'sentence-seek row expands Speed position simultaneously');
}

const deps = { ...presentation, ...ttsConfig, ...morphScroll, ...geometry, ...actors, ...ttsState, ...sourceIdentity, Scroller: class { currentOffset() { return { yOffset: 0 }; } },
  ScrollSource: { SCROLLER: 6, FLING: 1, DRAG: 0 } };
function loadInputAdapter(name, source) {
  const boundary = source.indexOf('\n  build() {');
  assert.ok(boundary > 0, `${name} actual adapter boundary exists`);
  const rateMethod = name === 'ReaderControlTtsContent' ?
    ['effectiveRate', 'onlineServicePage', 'isHttpEngineSelected'].map(method =>
      source.match(new RegExp('  private ' + method + '\\(\\): [^{]+\\{[\\s\\S]*?\\n  \\}'))?.[0] ?? '').join('\n') : '';
  if (name === 'ReaderControlTtsContent') assert.ok(rateMethod, 'actual rate method used by frame must exist');
  const adapter = (source.slice(0, boundary) + '\n' + rateMethod + '\n}')
    .replace(/^import[\s\S]*?;\s*/gm, '')
    .replace(/@(?:Component|Prop|State)\b\s*/g, '')
    .replace(/@(?:Watch|StorageLink)\('[^']+'\)\s*/g, '')
    .replace(`export struct ${name}`, `class ${name}`);
  return new Function(...Object.keys(deps), `${stripTypeScriptTypes(adapter)}\nreturn ${name};`)(...Object.values(deps));
}
function actualCallArgument(source, startMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `real render attribute exists: ${startMarker}`);
  const open = source.indexOf('(', start);
  let depth = 1;
  for (let end = open + 1; end < source.length; end += 1) {
    if (source[end] === '(') depth += 1;
    if (source[end] === ')' && --depth === 0) return source.slice(open + 1, end);
  }
  assert.fail(`unterminated actual render attribute: ${startMarker}`);
}

function checkAutoPageSpeedContent(source) {
  const start = source.indexOf('  private speedRow() {');
  const end = source.indexOf('  private followHighlightRow() {', start);
  assert.ok(start >= 0 && end > start, 'actual speed builder boundaries exist');
  const speedBuilder = source.slice(start, end);
  assert.doesNotMatch(speedBuilder, /\.clip\(true\)/,
    'live 1939:848 has no overflow clip: its 32vp Quick actor must not cut the 44vp child layout');
  assert.match(speedBuilder, /this\.speedControlsWidth\(\)/,
    'speed controls width follows the shared compact/full endpoints');
  assert.match(speedBuilder, /this\.speedControlsHeight\(\)/,
    'speed controls height follows the shared compact/full endpoints');
  assert.match(speedBuilder, /this\.speedControlsX\(\)/,
    'speed controls x follows the shared compact/full endpoints');
  assert.match(speedBuilder, /this\.speedControlsY\(\)/,
    'speed controls y follows the shared compact/full endpoints');
  assert.match(source, /private speedControlsWidth\(\): number \{ return readerControlLerp\(140, 167, this\.p\(\)\); \}/,
    'speed helper retains the authored width endpoints');
  assert.match(source, /private speedControlsHeight\(\): number \{ return readerControlLerp\(32, 44, this\.p\(\)\); \}/,
    'speed helper retains the authored height endpoints');
  const quick = geometry.sampleReaderControlAutoPage(0, 286);
  const full = geometry.sampleReaderControlAutoPage(1, 338);
  assert.equal(quick.speed.height, 32, 'do not replace the authored Quick actor track with child minimum');
  assert.equal(full.speed.height, 64);
  assert.ok(quick.speed.width >= 264 && full.speed.width >= 306,
    'speed actor retains authored compact/full widths');
}
const autoContentSource = readFileSync(new URL('ReaderControlAutoPageContent.ets', root), 'utf8');
checkAutoPageSpeedContent(autoContentSource);
if (readerBuilderSdkAvailable) {
  const autoMembers = ['p', 'frame', 'headerActor', 'headerMeta', 'moduleHeader', 'fullOnlyScrollTranslation', 'presentation'];
  function checkMountedAutoHeaders(source, frozenArguments = false) {
    const { owner } = createReaderBuilderProbe(source, autoMembers, { ...geometry, ...actors, ...morphScroll, ...presentation });
    Object.assign(owner, { motionProgress: 0, availableWidth: 286, cachedProgress: -1, cachedWidth: -1, scrollMotion: morphScroll.createReaderControlMorphScroll(), status: 'stopped' });
    const headers = ['control', 'details'].map(kind => {
      const id = owner.observers.length;
      owner.moduleHeader(kind, owner.headerMeta(kind), owner.headerActor(kind));
      return { kind, id };
    });
    for (const p of [0, .25, 1, .5, 0, 1]) {
      Object.assign(owner, { motionProgress: p, availableWidth: 286 + 52 * p,
        status: p === 1 ? 'running' : 'paused' });
      owner.replay();
      for (const { kind, id } of headers) {
        const row = owner.nodes.get(id), expected = owner.headerActor(kind);
        near(row.opacity, expected.opacity * presentation.sampleReaderControlMotionPresentation(p).contentOpacity,
          `${kind} mounted header alpha at p${p}`);
        assert.deepEqual(row.position, { x: expected.x, y: expected.y });
        near(row.width, expected.width); near(row.height, expected.height);
        assert.equal(owner.nodes.get(id + 2).create, owner.headerMeta(kind), 'mounted header reads current status string');
      }
    }
  }
  checkMountedAutoHeaders(autoContentSource);
  const frozenAuto = autoContentSource
    .replace("private moduleHeader(kind: 'control' | 'details')", "private moduleHeader(kind: 'control' | 'details', meta: string, actor: ReaderControlActorFrame)")
    .replaceAll('this.headerActor(kind).', 'actor.')
    .replace('Text(this.headerMeta(kind))', 'Text(meta)');
  assert.notEqual(frozenAuto, autoContentSource);
  assert.throws(() => checkMountedAutoHeaders(frozenAuto), /mounted header|deep-equal/,
    'actual SDK closures reproduce the old by-value actor/meta freeze after a single Quick mount');

  const ttsSource = readFileSync(new URL('ReaderControlTtsContent.ets', root), 'utf8');
  const members = ['p', 'frame', 'effectiveRate', 'headerActor', 'headerMeta', 'quickLabelActor', 'moduleHeader', 'quickLabel',
    'playbackLabel', 'statusText', 'isActivelySpeaking', 'timerSummary', 'twoDigits', 'voiceSelectorRow', 'ttsSelectValueField',
    'fullInput', 'fieldLabel', 'fieldValue', 'fieldWidth', 'onlineServicePage', 'isHttpEngineSelected',
    'systemEngineDisplay', 'currentVoiceLabel', 'currentEngineLabel', 'toggleRow', 'toggleValue', 'changeToggle'];
  const { owner } = createReaderBuilderProbe(ttsSource, members, { ...geometry, ...actors, ...ttsState, ...ttsConfig });
  Object.assign(owner, { motionProgress: 0, availableWidth: 286, cachedProgress: -1, cachedWidth: -1,
    ratePreview: -1, state: { status: 'idle', rate: 1, totalSlices: 0 }, timerMinutes: 15, timerSeconds: 0,
    interactionEnabled: true, engine: 'system', serviceTab: '', voiceOptions: [], language: 'zh-CN', person: 0, httpEngines: [{ id: 4, name: '新引擎' }],
    followHighlight: true, pauseOnInterruption: true, allowMixing: false, failurePolicy: 'stop' });
  const headerIds = ['playback', 'timer', 'speed'].map(kind => {
    const full = owner.observers.length; owner.moduleHeader(kind);
    const quick = owner.observers.length; owner.quickLabel(kind);
    return { kind, full, quick, quickEnd: owner.observers.length };
  });
  const voiceId = owner.observers.length; owner.voiceSelectorRow();
  const fieldIds = ['engine', 'language', 'session', 'failure'].map(kind => {
    const id = owner.observers.length; owner.ttsSelectValueField(kind); return { kind, id, end: owner.observers.length };
  });
  for (const kind of ['followHighlight', 'pauseOnInterruption', 'allowMixing']) owner.toggleRow(kind);
  for (const p of [0, .3, 1, .6, 0]) {
    Object.assign(owner, { motionProgress: p, availableWidth: 286 + 52 * p, timerMinutes: 7, timerSeconds: 9,
      state: { status: 'playing', rate: 1.7, totalSlices: 0 }, language: 'en-US', person: 2,
      voiceOptions: [{ language: 'zh-CN', person: 0, label: '中文' }, { language: 'en-US', person: 2, label: 'English' }],
      followHighlight: false, pauseOnInterruption: false, allowMixing: true, failurePolicy: 'skip' });
    owner.replay();
    for (const { kind, full, quick, quickEnd } of headerIds) {
      const actor = owner.headerActor(kind), label = owner.quickLabelActor(kind);
      assert.equal(owner.nodes.get(full).opacity, actor.opacity);
      assert.deepEqual(owner.nodes.get(full).position, { x: actor.x, y: actor.y });
      assert.ok([...owner.nodes.entries()].some(([id, node]) => id >= full && id < quick &&
        node.type === 'Text' && node.create === owner.headerMeta(kind)), 'retained status badge projects live state');
      assert.equal(owner.nodes.get(quick).opacity, label.opacity);
      assert.deepEqual(owner.nodes.get(quick).position, { x: label.x, y: label.y });
      if (kind === 'playback') assert.ok([...owner.nodes.entries()].some(([id, node]) =>
        id >= quick && id < quickEnd && node.type === 'Text' && node.create === '朗读中'), 'mounted status remains live inside the new label hierarchy');
    }
    assert.equal(owner.nodes.get(voiceId).enabled, p === 1, 'live selector follows Full input admission without remount');
    assert.ok([...owner.nodes.entries()].some(([id, node]) => id >= voiceId && id < fieldIds[0].id &&
      node.type === 'Text' && node.create === 'English'), 'voice chip projects live device voice');
    for (const { kind, id, end } of fieldIds) assert.ok([...owner.nodes.entries()].some(([key, node]) =>
      key >= id && key < end && node.type === 'Text' && node.create === owner.fieldValue(kind)), 'field projects live value');
    assert.deepEqual([...owner.children.values()].map(child => child.params.value), [false, false, true],
      'SDK-emitted child Prop updates carry current booleans');
  }
  owner.motionProgress = 1; owner.replay();
  const changed = []; owner.onFollowHighlightChange = value => changed.push(value);
  const click = [...owner.nodes.values()].find(node => node.type === '__Common__' && node.onClick).onClick;
  click(); owner.followHighlight = true; owner.replay(); click();
  assert.deepEqual(changed, [true, false], 'one retained click closure inverts latest state, not initial boolean');
  owner.engine = 'http-tts:4'; owner.replay();
  assert.equal(owner.nodes.get(voiceId).enabled, true, 'online engine keeps the explanatory configuration surface accessible at Full');
  assert.ok([...owner.nodes.entries()].some(([key, node]) => key >= fieldIds[0].id && key < fieldIds[0].end &&
    node.type === 'Text' && node.create === '新引擎'));
  console.log('Actual SDK Auto/TTS mounted Builder observers: reversible actor geometry + live strings/numbers/booleans/child Prop payloads PASS');
} else console.log('Mounted Builder SDK regression SKIP: ETS loader unavailable');
for (const [from, to] of [
  ['.position({ x: this.frame().speed.x, y: this.frame().speed.y })',
    '.position({ x: this.frame().speed.x, y: this.frame().speed.y }).clip(true)'],
  ['this.speedControlsWidth()', '167'],
]) {
  assert.ok(autoContentSource.includes(from), 'actual speed layout mutation target exists');
  assert.throws(() => checkAutoPageSpeedContent(autoContentSource.replace(from, to)),
    'speed child regression rejects added clipping or lost source minimum');
}
for (const [name, module] of [['ReaderControlTtsContent', 'tts'], ['ReaderControlAutoPageContent', 'autoPage']]) {
  const source = readFileSync(new URL(`${name}.ets`, root), 'utf8');
  const Component = loadInputAdapter(name, source), component = new Component(), reports = [];
  component.onMorphActorMeasured = (...args) => reports.push(args);
  const quick = { globalPosition: { x: '17.5', y: 456.25 }, width: 286, height: 190 };
  const full = { globalPosition: { x: 40, y: 179 }, width: 312, height: 128 };
  component.reportMorphActor(); assert.equal(reports.length, 0, 'no fabricated rectangle before native measurement');
  component.measureActor(true, full); assert.equal(reports.length, 0, 'Full measurement cannot impersonate missing Quick rectangle');
  component.measureActor(false, quick);
  assert.deepEqual(reports.at(-1), [module === 'tts' ? 'quickTts' : 'quickAutoPage', 17.5, 456.25, 286, 190]);
  for (const form of ['quick', 'full']) {
    component.form = form;
    const kind = geometry.readerControlPlaybackSourceKind(module, form);
    for (const p of [0, 0.2, 0.5, 0.9, 1]) {
      component.motionProgress = p;
      component.reportMorphActor();
      assert.equal(reports.at(-1)[0], kind, 'source kind follows actual Session form, never p threshold');
      assert.equal(component.actorId(form === 'full'), sourceIdentity.readerSessionMorphActorId(kind));
      assert.notEqual(component.actorId(form !== 'full'), sourceIdentity.readerSessionMorphActorId(kind));
      assert.equal(component.sharedInput(), p === 0 || p === 1, 'no actor command during whole morph');
      assert.equal(component.fullInput(), p === 1);
    }
  }
  assert.deepEqual(reports.at(-1), [module === 'tts' ? 'fullTtsPlayback' : 'fullAutoPagePlayback', 40, 179, 312, 128]);
  const beforeInvalid = reports.length;
  component.measureActor(true, { ...full, width: 0 });
  assert.equal(reports.length, beforeInvalid, 'invalid native Full rect cannot fallback to unrelated Quick actor');
  component.interactionEnabled = false;
  assert.equal(component.fullInput(), false); assert.equal(component.sharedInput(), false);
  if (module === 'tts') component.ratePreview = 1.7; else component.speedPreviewSeconds = 5;
  component.onMotionChanged();
  assert.equal(module === 'tts' ? component.ratePreview : component.speedPreviewSeconds, -1,
    'revoking content input cancels local native-range preview without issuing a business command');
  if (module === 'tts') {
    for (const [status, label] of [['playing', '朗读中'], ['preparing', '准备中'], ['resuming', '准备中'],
      ['paused', '继续'], ['interrupted', '继续'], ['error', '失败·重试'], ['failed', '失败·重试'],
      ['unavailable', '不可用'], ['idle', '未开始'], ['stopping', '停止中'], ['completed', '已完成'], ['probing', '检查中']]) {
      component.state = { status };
      assert.equal(component.playbackLabel(), label, `actual persistent Quick TTS status ${status}`);
    }
  }
  // Evaluate the production render-attribute expressions, not a rewritten
  // compensation model. This proves valid scroll extents and continuous poses
  // for a retained native offset; it does not simulate ArkUI callback delivery.
  const retained = new Component(), originalScroller = retained.scroller;
  if (module === 'tts') retained.state = { status: 'idle', rate: 1, totalSlices: 0 };
  const fullViewportHeight = module === 'tts' ? 666 : 250;
  const nativeOffset = module === 'tts' ? 500 : 150;
  retained.scrollMotion.fullScrollOffset = nativeOffset;
  retained.scrollMotion.nativeScrollOffset = nativeOffset;
  const heightExpression = actualCallArgument(source, '.height(Math.max(this.frame().contentHeight');
  const translationExpression = 'this.sharedScrollTranslation()';
  assert.ok(translationExpression, 'actual render scroll-compensation expression exists');
  const heightFor = new Function(...Object.keys(morphScroll), `return function() { return (${heightExpression}); };`)(...Object.values(morphScroll));
  const translationFor = new Function(`return (${translationExpression});`);
  for (const p of [1, .7, .2, 0, .15, .6, 1]) {
    retained.motionProgress = p; retained.availableWidth = 286 + 52 * p;
    retained.availableHeight = 190 + (fullViewportHeight - 190) * p;
    const height = heightFor.call(retained), translation = translationFor.call(retained);
    assert.ok(height - retained.availableHeight >= nativeOffset - 1e-8,
      `${module} native scroll offset remains valid during shrink/reverse`);
    near(translation - nativeOffset, -nativeOffset * p,
      `${module} retained Full scroll contributes only the shared continuous p`);
    assert.equal(retained.scroller, originalScroller, 'Full -> Quick -> Full never creates a second Scroller');
    assert.equal(retained.scrollMotion.fullScrollOffset, nativeOffset, 'sampling does not restart, reset or time the saved offset');
  }
  if (module === 'tts') {
    // Only the three shared module roots receive scroll-to-Quick compensation.
    // Detail/Config are Full-only: their source 26/34vp exit is NOT S+26/S+34.
    assert.equal([...source.matchAll(/\.translate\(\{ y: this\.sharedScrollTranslation\(\) \}\)/g)].length, 3);
    for (const actor of ['playback', 'timer', 'speed']) {
      const body = source.split(`  private ${actor}() {`)[1].split('  @Builder')[0];
      assert.match(body, /\.translate\(\{ y: this\.sharedScrollTranslation\(\) \}\)/);
    }
    const scrollBody = source.slice(source.indexOf('\n  private normalContent() {'), source.indexOf('\n  private headerActor'));
    assert.equal([...scrollBody.matchAll(/\.translate\(/g)].length, 2, 'only two Full-only coordinate compensations, never whole-Scroll rewind');
    assert.equal([...scrollBody.matchAll(/\.translate\(\{ y: this\.fullOnlyScrollTranslation\(\) \}\)/g)].length, 2);
    for (const s of [0, 180, 523, 780]) {
      retained.scrollMotion.fullScrollOffset = s;
      retained.scrollMotion.nativeScrollOffset = s;
      for (const p of [1, .95, .6, .2, 0, .2, .6, .95, 1]) {
        retained.motionProgress = p; retained.availableWidth = 286 + 52 * p;
        const frame = retained.frame(), shift = retained.sharedScrollTranslation();
        for (const actor of ['playback', 'timer', 'speed']) {
          near(frame[actor].y + shift - s, frame[actor].y - s * p, `${actor}: actual shared screen-local pose`);
        }
        for (const [actor, fullY, exit] of [['detail', makeFixture.adaptedFull.detail[1], 26], ['config', makeFixture.adaptedFull.config[1], 34]]) {
          const position = actualCallArgument(scrollBody.slice(scrollBody.indexOf(`.position({ x: this.frame().${actor}.x`)), '.position(');
          const actualY = new Function(`return (${position}).y;`).call(retained) + retained.fullOnlyScrollTranslation() - s;
          near(actualY, fullY - s + exit * (1 - p), `${actor}: original local exit at scroll ${s}, p${p}`);
          near(frame[actor].opacity, p, `${actor}: same p, no delayed second phase`);
        }
      }
    }
    // Real component handoff: freeze once at the newest native position, even
    // if onDidScroll has not arrived. Reversals must not recapture or scroll.
    const handoff = new Component(), calls = [];
    let offset = 500;
    handoff.scroller = { currentOffset: () => ({ xOffset: 0, yOffset: offset }),
      scrollTo: value => calls.push(value) };
    handoff.motionProgress = 1; handoff.onMotionChanged(); handoff.onFullDidScroll();
    assert.equal(handoff.scrollMotion.fullScrollOffset, 500);
    offset = 523; handoff.interactionEnabled = false; handoff.onMotionChanged();
    assert.equal(handoff.scrollMotion.fullScrollOffset, 523, 'handoff captures native position, not stale callback');
    assert.deepEqual(calls, [{ xOffset: 0, yOffset: 523, animation: false }]);
    for (const p of [.98, .4, .7, .2, 0, .3, 1]) {
      handoff.motionProgress = p; handoff.onMotionChanged(); handoff.onFullDidScroll();
      assert.equal(handoff.scrollMotion.fullScrollOffset, 523, 'one scroll anchor survives an uncommitted held reversal');
    }
    assert.equal(calls.length, 1, 'no per-frame native scroll commands');
    handoff.interactionEnabled = true; handoff.onMotionChanged();
    offset = 410; handoff.onFullDidScroll();
    assert.equal(handoff.scrollMotion.fullScrollOffset, 410, 'Full endpoint resumes normal scrolling');
    assert.match(source, /\.onDidScroll\(/);
    const willScroll = actualCallArgument(source, '.onWillScroll(');
    const allowScroll = new Function(`return (${stripTypeScriptTypes(`const callback = ${willScroll};`).replace(/^const callback = /, '').replace(/;\s*$/, '')});`).call(handoff);
    assert.deepEqual(allowScroll(0, 7), { xOffset: 0, yOffset: 7 });
    handoff.interactionEnabled = false;
    assert.deepEqual(allowScroll(0, 7), { xOffset: 0, yOffset: 0 }, 'no residual native delta during morph');
    handoff.onMotionChanged(); // Freeze a fresh collapse at S=410.
    handoff.motionProgress = 0; handoff.onMotionChanged();
    assert.equal(handoff.scrollMotion.fullScrollOffset, 410, 'held Quick endpoint is still reversible');
    const callCountBeforeCommit = calls.length;
    handoff.interactionEnabled = true; handoff.onMotionChanged();
    assert.equal(handoff.scrollMotion.fullScrollOffset, 0, 'committed Quick discards the old Full scroll anchor');
    assert.equal(handoff.scrollMotion.nativeScrollOffset, 410, 'test models a deferred native scrollTo callback');
    assert.deepEqual(calls.at(-1), { xOffset: 0, yOffset: 0, animation: false });
    assert.equal(calls.length, callCountBeforeCommit + 1);
    near(handoff.sharedScrollTranslation() - offset, 0, 'Quick actors do not jump before native reset completes');
    assert.deepEqual(allowScroll(0, -410, 0, deps.ScrollSource.SCROLLER), { xOffset: 0, yOffset: -410 }, 'own reset is not blocked');
    assert.deepEqual(allowScroll(0, 7, 0, deps.ScrollSource.FLING), { xOffset: 0, yOffset: 0 }, 'old inertia stays blocked');
    handoff.interactionEnabled = false; handoff.motionProgress = .15; handoff.onMotionChanged();
    near(handoff.sharedScrollTranslation() - offset, 0, 'immediate new expansion starts at top even before reset callback');
    near(handoff.fullOnlyScrollTranslation() - offset, 0, 'Full-only content also starts at top on the new expansion');
    offset = 0; handoff.onFullDidScroll();
    assert.equal(handoff.scrollMotion.resettingFullScroll, false);
    for (const p of [.2, .7, 1]) {
      handoff.motionProgress = p; handoff.onMotionChanged();
      near(handoff.sharedScrollTranslation(), 0, 'new expansion uses the unscrolled Figma track');
      near(handoff.fullOnlyScrollTranslation(), 0);
    }
    handoff.interactionEnabled = true; handoff.onMotionChanged();
    offset = 260; handoff.onFullDidScroll();
    assert.equal(handoff.scrollMotion.fullScrollOffset, 260, 'new Full session scrolls normally after resetting');
    assert.equal([...source.matchAll(/\.scrollTo\(/g)].length, 1, 'one shared command adapter handles handoff and committed reset');
  } else {
    assert.match(source, /advanceReaderControlMorphScroll/);
    for (const actor of ['timer', 'follow']) assert.match(source, new RegExp('frame\\(\\)\\.' + actor + '\\.y \\}\\)\\s*\\.translate\\(\\{ y: this\\.fullOnlyScrollTranslation'));
    assert.match(source, /\.translate\(\{ y: this\.sharedScrollTranslation\(\) \}\)/);
  }
  if (module === 'autoPage') assert.match(source, /ReaderControlTimerWheel\(\{/);
  else assert.match(source, /this\.timerStepButton\(minutes, -5\)/);
  assert.match(source, /ReaderControlSwitchTrack\(\{/);
  assert.doesNotMatch(source, /(?:ReaderTtsFullPanel|ReaderAutoPageFullPanel)\(\{/);
  assert.doesNotMatch(source, /\b(?:setTimeout|setInterval|animateTo|postFrameCallback)\s*\(/);
  assert.doesNotMatch(source, /\.position\(\{ x: -14, y: -58 \}\)/);
  assert.match(source, /measureActor\(false, area\)/); assert.match(source, /measureActor\(true, area\)/);
  const media = [...source.matchAll(/app\.media\.([a-zA-Z0-9_]+)/g)].map(m => m[1]);
  for (const id of new Set(media)) {
    assert.ok(['svg', 'png', 'jpg', 'webp'].some(ext => existsSync(new URL(`../entry/src/main/resources/base/media/${id}.${ext}`, import.meta.url))), `real packaged media ${id}`);
  }
}

const wheelSource = readFileSync(new URL('ReaderControlTimerWheel.ets', root), 'utf8');
const Wheel = loadInputAdapter('ReaderControlTimerWheel', wheelSource), wheel = new Wheel(), steps = [];
wheel.onStep = delta => steps.push(delta);
wheel.value = 0; wheel.maximum = 59;
wheel.step(-1); wheel.step(0); assert.deepEqual(steps, [], 'minimum and selected timer values are not commands');
wheel.step(1); assert.deepEqual(steps, [1]);
wheel.value = 59; wheel.step(1); assert.deepEqual(steps, [1], 'maximum cannot step past range');
wheel.interactionEnabled = false; wheel.step(-1); assert.deepEqual(steps, [1], 'motion input revoke gates timer');
wheel.neighbours = 2; assert.deepEqual(wheel.offsets(), [-2, -1, 0, 1, 2], 'TTS has five source rows');
wheel.neighbours = 1; assert.deepEqual(wheel.offsets(), [-1, 0, 1], 'AutoPage has three source rows');

// The SDK parse check is read-only and does not build/sign a HAP. It catches
// ArkUI DSL syntax that standard TypeScript-only method tests cannot parse.
const sdkRoot = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
if (existsSync(`${sdkRoot}/node_modules/typescript`)) {
  const require = createRequire(import.meta.url), ts = require(`${sdkRoot}/node_modules/typescript`);
  const options = require(`${sdkRoot}/lib/ets_checker`).compilerOptions;
  for (const name of ['ReaderControlTtsContent', 'ReaderControlAutoPageContent', 'ReaderControlTimerWheel']) {
    const file = ts.createSourceFile(`${name}.ets`, readFileSync(new URL(`${name}.ets`, root), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    assert.deepEqual(file.parseDiagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')), [], `ArkTS parser accepts ${name}`);
  }
} else console.log('SDK syntax check SKIP: ets-loader not installed; pure geometry/identity checks still run.');

const geometrySource = readFileSync(new URL('ReaderControlPlaybackGeometry.ts', root), 'utf8');
function mutant(replace, replacement) {
  assert.ok(geometrySource.includes(replace), 'mutation target exists');
  const executable = stripTypeScriptTypes(geometrySource.replace(replace, replacement)
    .replace(/^import[\s\S]*?;\s*/gm, '')).replace(/^export /gm, '');
  return new Function(...Object.keys(actors), `${executable}; return { sampleReaderControlTts, sampleReaderControlAutoPage };`)(...Object.values(actors));
}
for (const [from, to] of [
  ['readerControlActor(125, 19, 28, 28)', 'readerControlActor(58, 60, 44, 44)'],
  ['readerControlLerp(87, 401.5, p)', 'readerControlLerp(87, 401.5, p > 0.5 ? 1 : 0)'],
  ['readerControlActor(31.4921875, 2.5, 32, 32)', 'readerControlActor(0, 0, 32, 32)'],
]) assert.throws(() => checkGeometry(mutant(from, to)), 'live track regression kills a wrong actor/threshold mutation');
console.log('Reader control playback: live-track geometry, child clipping/min-height, persistent content, actual measurement identity, SDK syntax and 5 mutations PASS');
