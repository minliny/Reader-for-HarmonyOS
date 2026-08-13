import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateDeviceProfile, extractProfileVerification } from './check_device_signing_profile.mjs';

const BUNDLE = 'com.minliny.reader';
const DEVICE = 'A'.repeat(64);

function officialProfile(overrides = {}) {
  return {
    verifiedPassed: true,
    content: {
      type: 'debug',
      issuer: 'app_gallery',
      'bundle-info': { 'bundle-name': BUNDLE },
      'debug-info': { 'device-ids': [DEVICE] },
    },
    ...overrides,
  };
}

test('accepts the only profile shape allowed for a configured real device', () => {
  assert.deepEqual(evaluateDeviceProfile(officialProfile(), BUNDLE, DEVICE), { ok: true, errors: [] });
});

test('rejects a local PKI even when its profile is structurally valid', () => {
  const profile = officialProfile({ content: { ...officialProfile().content, issuer: 'pki_internal' } });
  const checked = evaluateDeviceProfile(profile, BUNDLE, DEVICE);
  assert.equal(checked.ok, false);
  assert.match(checked.errors.join('\n'), /not AppGallery-issued/);
});

test('rejects profiles reused from a different bundle or device', () => {
  const otherBundle = evaluateDeviceProfile(officialProfile(), 'reader.minliny.testpackage', DEVICE);
  assert.equal(otherBundle.ok, false);
  assert.match(otherBundle.errors.join('\n'), /bundle name/);
  const otherDevice = evaluateDeviceProfile(officialProfile(), BUNDLE, 'B'.repeat(64));
  assert.equal(otherDevice.ok, false);
  assert.match(otherDevice.errors.join('\n'), /connected device/);
});

test('extracts the JSON emitted by hap-sign-tool without depending on its log prefix', () => {
  const payload = '{"verifiedPassed":true,"content":{"issuer":"app_gallery"}}';
  assert.deepEqual(extractProfileVerification(`07-25 12:00:00 INFO - ${payload}\nINFO - done`), JSON.parse(payload));
});
