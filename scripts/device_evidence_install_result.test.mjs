import test from 'node:test';
import assert from 'node:assert/strict';
import { isSuccessfulHdcInstall } from './device_evidence_install_result.mjs';

test('rejects HDC textual PKCS7 install failure even with exit code zero', () => {
  assert.equal(isSuccessfulHdcInstall({
    status: 0,
    stdout: '[Info]App install path: entry-default-signed.hap msg:error: failed to install bundle. code:9568257 error: fail to verify pkcs7 file. AppMod finish',
    stderr: '',
  }), false);
});

test('rejects nonzero HDC result even if its payload contains success', () => {
  assert.equal(isSuccessfulHdcInstall({ status: 1, stdout: 'success', stderr: '' }), false);
});

test('accepts an explicit clean HDC success result', () => {
  assert.equal(isSuccessfulHdcInstall({
    status: 0,
    stdout: '[Info] App install path: entry-default-signed.hap msg:install bundle successfully.',
    stderr: '',
  }), true);
});
