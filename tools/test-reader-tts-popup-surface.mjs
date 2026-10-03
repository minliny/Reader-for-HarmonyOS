import assert from 'node:assert/strict';
import { stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const specs = read('entry/src/main/ets/features/common/ReaderSurfaceSpecs.ets');
const overlay = read('entry/src/main/ets/features/reading/ReaderTtsConfigOverlay.ets');

const { resolvePopupSpec } = new Function('TextAlign',
  `${stripTypeScriptTypes(specs).replace(/^export /gm, '')}; return { resolvePopupSpec };`)(
  { Start: 'TextAlign.Start', Center: 'TextAlign.Center' },
);
const manager = resolvePopupSpec('tts-config-manager');

assert.equal(manager.width, 364, 'TTS manager keeps the existing 364vp panel width');
assert.equal(manager.borderWidth, 0.5, 'TTS manager keeps the existing half-pixel border');
assert.equal(manager.borderRadius, 22, 'TTS manager keeps the existing 22vp radius');
assert.equal(manager.shadowRadius, 48, 'TTS manager keeps the existing shadow radius');
assert.equal(manager.shadowOffsetY, 18, 'TTS manager keeps the existing shadow offset');
assert.match(specs, /'tts-config-manager': new PopupSurfaceSpec\(\{[\s\S]*?width: 364/);
assert.match(specs, /'tts-config-manager': new PopupSurfaceSpec\(\{[\s\S]*?surfaceBackgroundRole: 'app\.ReaderTtsConfigOverlay\.build\.backgroundColor\.FFFFFAF4'/);
assert.match(overlay, /import \{ PopupSurfaceSpec, resolvePopupSpec \} from '\.\.\/common\/ReaderSurfaceSpecs';/);
assert.match(overlay, /private managerSurfaceSpec\(\): PopupSurfaceSpec/);
assert.match(overlay, /return resolvePopupSpec\('tts-config-manager'\)/);
assert.match(overlay, /this\.managerSurfaceSpec\(\)\.width/);
assert.match(overlay, /this\.managerSurfaceSpec\(\)\.surfaceBackgroundRole/);
assert.match(overlay, /this\.managerSurfaceSpec\(\)\.surfaceBorderRole/);
assert.match(overlay, /this\.managerSurfaceSpec\(\)\.borderRadius/);
assert.match(overlay, /this\.managerSurfaceSpec\(\)\.shadowRadius/);
assert.match(overlay, /this\.managerSurfaceSpec\(\)\.shadowOffsetY/);
assert.doesNotMatch(overlay, /this\.manager \? 364/,
  'manager width is owned by the popup surface contract');

console.log('reader TTS manager popup surface contract: PASS');
