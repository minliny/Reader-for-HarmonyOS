import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Structural wiring only. Geometry behavior has separate production-function
// tests; this gate cannot establish ArkUI compositing, touch or pixel parity.
const stage = await readFile(new URL('../entry/src/main/ets/features/reading/ReaderControlMotionStage.ets', import.meta.url), 'utf8');
const page = await readFile(new URL('../entry/src/main/ets/pages/ReaderControlMotionVerification.ets', import.meta.url), 'utf8');
const actors = ['shell', 'grabber', 'header', 'contentSurface', 'content', 'brightness', 'navigation'];

function codeMask(source) {
  // Keep offsets while excluding braces and claim-like text inside comments or
  // strings. These two inspected ArkTS files contain no regexp literals.
  return source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g,
    value => value.replace(/[^\n]/g, ' '));
}

function bracePairs(code) {
  const stack = [];
  const pairs = new Map();
  for (let index = 0; index < code.length; index += 1) {
    if (code[index] === '{') stack.push(index);
    if (code[index] === '}') {
      assert.ok(stack.length > 0, 'balanced inspected ArkTS body');
      const open = stack.pop();
      pairs.set(open, index);
      pairs.set(index, open);
    }
  }
  assert.equal(stack.length, 0, 'all inspected ArkTS bodies close');
  return pairs;
}

function singleMatch(source, expression, message) {
  const matches = [...source.matchAll(expression)];
  assert.equal(matches.length, 1, message);
  return matches[0];
}

function checkStage(source) {
  const code = codeMask(source);
  assert.doesNotMatch(code, /\.preventDefault\(/,
    'raw touch on Stack must not call the unsupported default-action API (device crash 100017)');
  // Branch behavior is executed by test-reader-control-stage-lifecycle.mjs:
  // primary DOWN/continuation plus owned Cancel/secondary DOWN/secondary delta.
  // The old count of two rejected the newly required isolation branches.
  assert.equal([...code.matchAll(/event\.stopPropagation\(\)/g)].length, 5,
    'all five owned-touch branches retain propagation isolation without preventDefault');
  const pairs = bracePairs(code);
  assert.match(code, /@BuilderParam\s+moduleContent:\s*\(\)\s*=>\s*void/,
    'content slot cannot freeze a by-value sampled frame in a nested Builder');
  assert.match(code, /copyReaderControlSessionState\(next\)/,
    'visual hand-off copies the nested transition instead of sharing host state');
  assert.match(code, /onVisualSessionChange:\s*\(state:\s*ReaderControlSessionState\)/,
    'the Stage exposes a non-reactive visual sample callback');
  assert.match(code, /onSessionCommit:\s*\(state:\s*ReaderControlSessionState\)/,
    'semantic state is handed back only through an explicit endpoint callback');
  assert.match(code, /private setVisualSession\(next:\s*ReaderControlSessionState/,
    'all local clock writes pass through one visual-session gate');
  assert.match(code, /private lastCommittedEpoch:\s*number/,
    'endpoint hand-offs keep an explicit semantic commit identity');
  assert.match(code,
    /if \(this\.lastCommittedEpoch === next\.epoch &&[\s\S]*?this\.lastCommittedLocationKey === locationKey\) return;/,
    'duplicate endpoint notifications are suppressed before the Host @State write');
  assert.equal([...code.matchAll(/this\.visualSession\s*=/g)].length, 3,
    'the Stage has explicit local visual-session write sites only');
  assert.doesNotMatch(code, /this\.semanticSession\s*=\s*(?:advanceReaderControlSession|result\.session|toggleReaderControlSession)/,
    'automatic/gesture reducers must not write the semantic prop directly');
  singleMatch(code, /const pose = sampleReaderControlSession\(this\.visualSession\);[\s\S]*?sampleReaderControlMotionComposition\(pose, bounds\)/g,
    'Stage samples the production composition from its one session');
  assert.match(code, /private cachedFrameKey:\s*string/,
    'Stage caches one immutable composition sample per VSync/layout key');
  assert.doesNotMatch(code, /\bsampleReaderControlMotion\b|\bflattenedActor\b/,
    'flattened compatibility geometry must not drive production sibling opacity');

  const build = singleMatch(code, /\bbuild\(\)\s*\{/g, 'one Stage render body');
  const buildOpen = code.indexOf('{', build.index);
  const buildClose = pairs.get(buildOpen);
  const dockTranslate = singleMatch(code, /\.translate\(\{\s*y:\s*this\.frame\(\)\.dock\.translateY\s*\}\)/g,
    'the dock displacement is applied once');
  const dockOpacity = singleMatch(code, /\.opacity\(this\.frame\(\)\.dock\.opacity\)/g,
    'the already-composited dock is faded once');
  // Identify the actual parent body, not an arbitrary text window containing
  // actor names: the closing brace immediately preceding its modifier chain.
  const groupClose = code.lastIndexOf('}', dockTranslate.index);
  const groupOpen = pairs.get(groupClose);
  assert.ok(groupOpen > buildOpen && groupClose < buildClose, 'dock is a group inside build');
  assert.match(code.slice(0, groupOpen), /Stack\(\{\s*alignContent:\s*Alignment\.TopStart\s*\}\)\s*$/,
    'dock modifiers belong to an explicit parent Stack');
  assert.match(code.slice(groupClose + 1, dockTranslate.index),
    /^\s*\.width\(this\.bounds\(\)\.width\)\.height\(this\.bounds\(\)\.fullHeight\)\s*$/,
    'dock translation modifies the common actor parent directly');
  assert.match(code.slice(dockTranslate.index + dockTranslate[0].length, dockOpacity.index), /^\s*$/,
    'dock displacement and opacity are on the same parent chain');
  assert.doesNotMatch(code.slice(dockOpacity.index + dockOpacity[0].length), /^\s*\.renderGroup\(true\)/,
    'dynamic dock content must not be forced through an off-screen renderGroup cache');
  const body = code.slice(groupOpen + 1, groupClose);
  const buildBody = code.slice(buildOpen + 1, buildClose);
  assert.doesNotMatch(body, /if\s*\(\s*readerControlContentLocation\(this\.session\)\.level\s*!==\s*'hidden'\s*\)/,
    'the dock stays mounted at the hidden endpoint; only opacity/hit testing changes');
  assert.match(code, /private contentModule\(\): string[\s\S]*lastVisibleContentModule/,
    'hidden endpoint keeps the last visible content actor identity');
  assert.match(body, /readerControlHasFullContentSurface\(this\.contentModule\(\)\)/,
    'full-content surface follows the retained actor identity during hidden hand-off');
  assert.match(body, /\.visibility\(Visibility\.Visible\)/,
    'full-content surface stays mounted across route and endpoint changes');
  assert.doesNotMatch(body, /readerControlHasFullContentSurface\(this\.contentModule\(\)\)\s*\?\s*Visibility\.Visible\s*:\s*Visibility\.Hidden/,
    'route changes must not detach the full-content compositor layer');
  assert.match(body, /\.enabled\([\s\S]*?this\.frame\(\)\.visibility\s*>\s*0/,
    'hidden dock content is inert without conditional unmount');
  assert.match(body, /\.hitTestBehavior\([\s\S]*?this\.frame\(\)\.visibility\s*>\s*0/,
    'hidden dock has no touch target while its node remains mounted');
  assert.doesNotMatch(body, /\.opacity\([^;\n]*visibility|visibilityProgress/,
    'individual actor opacity must not multiply the visibility clock (the parent gate owns hidden hit testing)');
  for (const actor of actors) {
    const opacity = actor === 'header' ?
      /\.opacity\(this\.persistentHeader \? 1 : this\.frame\(\)\.header\.opacity\)/g :
      actor === 'contentSurface' ?
      /\.opacity\(readerControlHasFullContentSurface\(this\.contentModule\(\)\)\s*\?\s*this\.frame\(\)\.contentSurface\.opacity\s*:\s*0\)/g :
      new RegExp(`\\.opacity\\(this\\.frame\\(\\)\\.${actor}\\.opacity\\)`, 'g');
    singleMatch(body, opacity, `${actor} is rendered inside the dock group`);
    singleMatch(buildBody, opacity, `${actor} is not duplicated outside the dock group`);
    const references = [...buildBody.matchAll(new RegExp(`this\\.frame\\(\\)\\.${actor}\\b`, 'g'))];
    assert.ok(references.every(match => {
      const offset = buildOpen + 1 + match.index;
      return offset > groupOpen && offset < groupClose;
    }), `${actor} geometry cannot escape the dock parent`);
  }
  assert.match(body, /\.zIndex\(this\.persistentHeader \? 1 : 0\)/,
    'a persistent title remains above the Quick viewport while its parent stays in the common dock');
  for (const builder of ['fullHeaderContent', 'moduleContent', 'brightnessContent', 'navigationContent']) {
    singleMatch(body, new RegExp(`this\\.${builder}\\(`, 'g'), `${builder} is in the common group`);
  }
  singleMatch(buildBody, /this\.topBarContent\(\)/g,
    'TopBar is rendered by the same Stage clock, outside the dock group');
  assert.match(buildBody, /\.translate\(\{ y: this\.topBarFrame\(\)\.translateY \}\)\.opacity\(this\.topBarFrame\(\)\.opacity\)/,
    'TopBar uses the Stage-local visibility sample');
  singleMatch(body, /\.onTouch\(\(event:\s*TouchEvent\):\s*void\s*=>\s*\{\s*this\.touch\(event\);\s*this\.traceFrame\([^;]+;\s*\}\)/g,
    'handle input is transformed with the entire dock');
  singleMatch(buildBody, /\.onTouch\(/g, 'there is no detached second handle input');
  assert.match(body, /\.accessibilityVirtualNode\(this\.accessibleControlActions\)/,
    'handle accessibility actions stay with the grouped input region');
}

function checkPage(source) {
  const code = codeMask(source);
  assert.match(code, /@State private visualSession: ReaderControlSessionState/,
    'diagnostic keeps a separate visual observation mirror');
  singleMatch(code, /ReaderControlMotionStage\(\{\s*semanticSession:\s*this\.session,/g,
    'Stage receives the diagnostic semantic session as a read-only prop');
  singleMatch(code, /topBarContent:\s*\(\): void => this\.topBar\(\)/g,
    'diagnostic TopBar is rendered by the common Stage');
  assert.match(code, /onVisualSessionChange:\s*\(state:\s*ReaderControlSessionState\)/,
    'diagnostic observes the Stage visual clock without feeding it back as semantic state');
  assert.match(code, /onSessionCommit:\s*\(state:\s*ReaderControlSessionState\)/,
    'diagnostic receives endpoint commits separately');
  assert.match(code, /\}\)\.hitTestBehavior\(HitTestMode\.Transparent\)/,
    'ArkUI custom-component Common wrapper remains transparent to the probe');
  assert.match(code, /settleDurationMs:\s*1150,\s*showDurationMs:\s*420,\s*dismissDurationMs:\s*360,/,
    'gesture settlement receives distinct morph/show/hide durations');
  singleMatch(code, /\.onTouch\(\(event:\s*TouchEvent\):\s*void\s*=>\s*this\.backdropTouch\(event\)\)/g,
    'backdrop is driven by raw touch ownership, never generated click after handle release');
  assert.match(code, /reduceReaderControlBackdropTouch\(this\.backdropState,\s*touch,/,
    'diagnostic backdrop uses the behavior-tested ownership reducer');
  assert.match(code, /invalidationRevision:\s*this\.inputRevision/,
    'backdrop invalidation tracks explicit commands, not automatic animation epochs');
  assert.doesNotMatch(code, /backdropEpoch/,
    'automatic continuation epochs must not invalidate a genuine background tap');
  assert.match(code, /private content\(\)/,
    'content builder remains a live Stage BuilderParam slot');
  assert.match(code, /motionProgress:\s*this\.contentFrame\(\)\.progress/,
    'child motion props must be reactive to the session, not a by-value builder snapshot');
  for (const [command, duration] of [
    ['openReaderControlSession', '420'], ['dismissReaderControlSession', '360'],
    ['collapseReaderControlSession', '1150'],
  ]) {
    const calls = [...code.matchAll(new RegExp(`${command}\\(this\\.session,\\s*([^)]*)\\)`, 'g'))];
    assert.ok(calls.length > 0, `${command} is wired`);
    calls.forEach(call => assert.equal(call[1].trim(), duration, `${command} duration is ${duration}`));
  }
  assert.match(source, /let result = backReaderControlSession\(this\.session,\s*1150\);\s*if \(result\.state\.transition\?\.kind === 'dismiss'\)\s*\{\s*result = backReaderControlSession\(this\.session,\s*360\);/,
    'Back uses morph duration unless its resulting transition is whole dismissal');
}

checkStage(stage);
checkPage(page);
// Small mutation checks ensure the gate rejects the regressions it names.
assert.throws(() => checkStage(stage.replace('sampleReaderControlMotionComposition(pose, bounds)',
  'sampleReaderControlMotion(pose, bounds)')), 'flattened-sampler regression is detected');
assert.throws(() => checkStage(stage.replace('.opacity(this.frame().dock.opacity)',
  '.opacity(this.frame().dock.opacity).opacity(this.frame().dock.opacity)')), 'duplicate whole fade is detected');
assert.throws(() => checkStage(stage.replace(
  '.opacity(this.frame().dock.opacity)',
  '.opacity(this.frame().dock.opacity).renderGroup(true)')),
  'reintroducing an off-screen renderGroup cache is rejected');
assert.throws(() => checkStage(stage.replace(
  '      Stack({ alignContent: Alignment.TopStart }) {\n        Stack()\n          .id(\'reader-control-verification-shell\')',
  '      Stack({ alignContent: Alignment.TopStart }) {\n        if (readerControlContentLocation(this.visualSession).level !== \'hidden\') {\n        Stack()\n          .id(\'reader-control-motion-shell\')')),
  'reintroducing hidden-endpoint conditional unmount is rejected');
assert.throws(() => checkStage(stage.replace('.opacity(this.persistentHeader ? 1 : this.frame().header.opacity)',
  '.opacity(this.frame().header.opacity)')), 'persistent Quick title must not inherit an added-only header fade');
assert.throws(() => checkStage(stage.replace('this.touch(event);', '')),
  'missing grouped handle input is detected');
assert.throws(() => checkPage(page.replace('showDurationMs: 420', 'showDurationMs: 1150')),
  'using morph time for whole show is detected');
assert.throws(() => checkPage(page.replace('semanticSession: this.session', 'semanticSession: this.visualSession')),
  'diagnostic must not feed its visual mirror back as the semantic Stage prop');
console.log('reader control Stage composition + diagnostic timing wiring: PASS (structure only; not pixels/touch)');
