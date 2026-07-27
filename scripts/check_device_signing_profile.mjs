// check_device_signing_profile.mjs — fail closed before a real-device HAP install.
//
// A locally generated profile can be structurally valid and still be rejected
// by a Huawei device.  This checks only non-secret profile metadata:
//   - AppGallery-issued debug profile (not the repository's local PKI);
//   - exact bundle-name match with AppScope/app.json5;
//   - when requested, the currently connected device belongs to the profile.
//
// It deliberately never reads signing passwords, private keys, or prints a
// device UDID.  DevEco owns those private materials in ~/.ohos/config.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEVECO_CONTENTS = '/Applications/DevEco-Studio.app/Contents';
const DEFAULT_SIGN_TOOL = `${DEVECO_CONTENTS}/sdk/default/openharmony/toolchains/lib/hap-sign-tool.jar`;

function result(ok, errors = []) {
  return { ok, errors };
}

export function extractProfileVerification(output) {
  const start = output.indexOf('{');
  const end = output.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('hap-sign-tool did not return a parseable profile verification result');
  }
  return JSON.parse(output.slice(start, end + 1));
}

export function evaluateDeviceProfile(verification, expectedBundleName, connectedDeviceId = '') {
  const errors = [];
  const content = verification?.content ?? {};
  const bundleInfo = content['bundle-info'] ?? {};
  const debugInfo = content['debug-info'] ?? {};
  const profileBundleName = typeof bundleInfo['bundle-name'] === 'string'
    ? bundleInfo['bundle-name'] : '';
  const issuer = typeof content.issuer === 'string' ? content.issuer : '';
  const type = typeof content.type === 'string' ? content.type : '';
  const deviceIds = Array.isArray(debugInfo['device-ids']) ? debugInfo['device-ids'] : [];

  if (verification?.verifiedPassed !== true) {
    errors.push('the Profile itself did not pass hap-sign-tool verification');
  }
  if (type !== 'debug') {
    errors.push('the Profile is not a debug Profile');
  }
  if (issuer !== 'app_gallery') {
    errors.push('the Profile is not AppGallery-issued; local self-signed profiles cannot be used for this real-device gate');
  }
  if (profileBundleName !== expectedBundleName) {
    errors.push('the Profile bundle name does not match AppScope/app.json5');
  }
  if (connectedDeviceId.length > 0 && !deviceIds.includes(connectedDeviceId)) {
    errors.push('the connected device is not included in this debug Profile');
  }
  return result(errors.length === 0, errors);
}

function readBundleName() {
  const appScope = fs.readFileSync(path.join(REPO, 'AppScope/app.json5'), 'utf8');
  const match = appScope.match(/"bundleName"\s*:\s*"([^"]+)"/);
  if (match === null) throw new Error('AppScope/app.json5 has no bundleName');
  return match[1];
}

function readProfilePath() {
  const buildProfile = fs.readFileSync(path.join(REPO, 'build-profile.json5'), 'utf8');
  const match = buildProfile.match(/"profile"\s*:\s*"([^"]+)"/);
  if (match === null) throw new Error('build-profile.json5 has no signing profile path');
  return path.resolve(REPO, match[1]);
}

function commandPath(name, candidates = []) {
  const fromPath = spawnSync('sh', ['-c', `command -v ${name}`], { encoding: 'utf8' });
  if (fromPath.status === 0 && fromPath.stdout.trim().length > 0) return fromPath.stdout.trim();
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return name;
}

function readConnectedDeviceId(hdc) {
  const read = spawnSync(hdc, ['shell', 'bm', 'get', '--udid'], { encoding: 'utf8' });
  const match = `${read.stdout ?? ''}\n${read.stderr ?? ''}`.match(/\b[A-F0-9]{64}\b/i);
  if (read.status !== 0 || match === null) {
    throw new Error('could not read the connected device identity; connect exactly one unlocked device with USB debugging enabled');
  }
  return match[0];
}

export function verifyConfiguredDeviceSigning({ requireDevice = false } = {}) {
  const profilePath = readProfilePath();
  if (!fs.existsSync(profilePath)) {
    throw new Error('the configured signing Profile file does not exist');
  }
  const signTool = process.env.HAP_SIGN_TOOL ?? DEFAULT_SIGN_TOOL;
  if (!fs.existsSync(signTool)) {
    throw new Error('hap-sign-tool.jar is unavailable; install or configure DevEco Studio');
  }
  const verified = spawnSync('java', ['-jar', signTool, 'verify-profile', '-inFile', profilePath], {
    encoding: 'utf8',
  });
  if (verified.status !== 0) {
    throw new Error('hap-sign-tool could not verify the configured Profile');
  }
  const hdc = commandPath('hdc', [
    `${DEVECO_CONTENTS}/sdk/default/openharmony/toolchains/hdc`,
    `${DEVECO_CONTENTS}/sdk/default/hms/toolchains/hdc`,
  ]);
  const deviceId = requireDevice ? readConnectedDeviceId(hdc) : '';
  return evaluateDeviceProfile(extractProfileVerification(verified.stdout), readBundleName(), deviceId);
}

function main() {
  const requireDevice = process.argv.includes('--require-device');
  try {
    const checked = verifyConfiguredDeviceSigning({ requireDevice });
    if (!checked.ok) {
      console.error('DEVICE_SIGNING_PREFLIGHT: blocked');
      for (const error of checked.errors) console.error(`- ${error}`);
      console.error('Configure an AppGallery-issued Debug certificate/Profile for the current bundle in DevEco Studio, then retry.');
      process.exit(1);
    }
    console.log('DEVICE_SIGNING_PREFLIGHT: official debug Profile matches the current bundle and connected device.');
  } catch (error) {
    console.error(`DEVICE_SIGNING_PREFLIGHT: blocked — ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
