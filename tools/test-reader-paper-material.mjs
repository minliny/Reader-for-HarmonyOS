import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { selectedProductionMethods } from './lib/selected-production-methods.mjs';

const root = new URL('../entry/src/main/', import.meta.url);
const material = new URL('ets/ui/foundation/ReaderPaperMaterial.ets', root);

test('Reader paper overrides take effect only on platform-confirmed API 26', () => {
  for (const [distributionOSApiVersion, available, expectedCalls] of [
    [60100, true, []],
    [60101, true, []],
    [260000, false, ['26.0.0']],
    [260000, true, ['26.0.0', 'empty']],
  ]) {
    const calls = [];
    const PaperMaterial = selectedProductionMethods(
      material, 'ReaderPaperMaterial', ['applyNormalAttribute'], {
        deviceInfo: { distributionOSApiVersion, apiAvailable: sdk => { calls.push(sdk); return available; } },
        uiMaterial: { Material: { empty: 'empty' } },
      });
    new PaperMaterial().applyNormalAttribute({ systemMaterial: material => calls.push(material) });
    assert.deepEqual(calls, expectedCalls);
  }
});

test('paper controls lazy-load optional SDK material and survive unavailable native operations', () => {
  assert.match(readFileSync(material, 'utf8'), /import\s+lazy\s+\{\s*uiMaterial\s*\}\s+from\s+'@kit\.ArkUI'/);
  for (const failure of ['availability', 'module', 'modifier']) {
    const fail = () => { throw new Error(`optional paper material: ${failure}`); };
    const PaperMaterial = selectedProductionMethods(material, 'ReaderPaperMaterial', ['applyNormalAttribute'], {
      deviceInfo: { distributionOSApiVersion: 260000, apiAvailable: failure === 'availability' ? fail : () => true },
      uiMaterial: {
        get Material() {
          return failure === 'module' ? fail() : { empty: 'empty' };
        },
      },
    });
    assert.doesNotThrow(() => new PaperMaterial().applyNormalAttribute({
      systemMaterial: failure === 'modifier' ? fail : () => assert.fail('unavailable material must not be applied'),
    }));
  }
});

test('entry manifest permits individual material overrides with API 23 minimum', () => {
  const manifest = JSON.parse(readFileSync(new URL('module.json5', root), 'utf8'));
  assert.equal(manifest.module.metadata.find(item => item.name === 'ohos.arkui.UIMaterial.state')?.value, 'default');
  const profile = JSON.parse(readFileSync(new URL('../../../build-profile.json5', root), 'utf8'));
  const product = profile.app.products.find(item => item.name === 'default');
  assert.equal(product.compatibleSdkVersion, '6.1.0(23)');
  assert.equal(product.targetSdkVersion, '26.0.0');
});
