import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { parseRunnerInstalledMetadata, publicRunnerInstalledMetadata } from '../../../scripts/lib/runner-installed-metadata.mjs';

const bundleName = 'io.reader.minliny.uitestrunner';
const appId = 'private-fixture-app-id';
const appIdentifier = 'private-fixture-app-identifier';
const sha256 = value => createHash('sha256').update(value).digest('hex');
const runner = { name: 'entry_test', moduleName: 'entry_test', bundleName, moduleType: 2, versionCode: 1000000 };
const entry = { ...runner, name: 'entry', moduleName: 'entry', moduleType: 1 };
const bms = {
  name: bundleName,
  appId,
  appIdentifier,
  versionName: '0.2.0',
  versionCode: 1000000,
  updateTime: 1795084800000,
  applicationInfo: { bundleName, appProvisionType: 'debug', uid: 200123 },
  hapModuleInfos: [runner],
  hapModuleNames: ['entry_test'],
  moduleNames: ['entry_test'],
  codePath: '/private/device/path',
};
const dump = (data, header = bundleName) => `${header}:\n${JSON.stringify(data)}\n`;

test('runner BMS projection proves the scoped feature and redacts private identities', () => {
  const expected = {
    bundlePresent: true,
    bundleName,
    moduleName: 'entry_test',
    appProvisionType: 'debug',
    appIdSha256: sha256(appId),
    appIdentifierSha256: sha256(appIdentifier),
    versionName: '0.2.0',
    versionCode: 1000000,
    updateTime: 1795084800000,
    uid: 200123,
  };
  const installed = parseRunnerInstalledMetadata(dump(bms), bundleName);
  assert.deepEqual(installed, expected);
  assert.deepEqual(publicRunnerInstalledMetadata({ ...installed, appId, appIdentifier, codePath: bms.codePath }), {
    bundleName,
    moduleName: 'entry_test',
    appProvisionType: 'debug',
    appIdSha256: sha256(appId),
    appIdentifierSha256: sha256(appIdentifier),
    versionName: '0.2.0',
    versionCode: 1000000,
    updateTime: 1795084800000,
  });
  assert.throws(() => publicRunnerInstalledMetadata({ bundlePresent: false, bundleName }),
    /exact independent Runner installation is unavailable/);
  assert.deepEqual(parseRunnerInstalledMetadata(dump({ ...bms,
    hapModuleInfos: [entry, runner],
    hapModuleNames: ['entry', 'entry_test'],
    moduleNames: ['entry_test', 'entry'],
  }), bundleName), expected);
  const noRunner = parseRunnerInstalledMetadata(dump({ ...bms, hapModuleInfos: [entry],
    hapModuleNames: ['entry'], moduleNames: ['entry'],
  }), bundleName);
  assert.deepEqual(noRunner, { ...expected, moduleName: '' });
  assert.throws(() => publicRunnerInstalledMetadata(noRunner), /exact independent Runner installation is unavailable/);
  assert.deepEqual(parseRunnerInstalledMetadata(dump({ ...bms, hapModuleNames: undefined, moduleNames: undefined })
    .replaceAll('\n', '\r\n'), bundleName), expected);

  for (const [change, error] of [
    [{ name: 'io.reader.minliny' }, /bundle identity/],
    [{ bundleName: 'io.reader.minliny' }, /bundle identity/],
    [{ applicationInfo: { ...bms.applicationInfo, bundleName: 'com.example.wrong' } }, /bundle identity/],
    [{ applicationInfo: { ...bms.applicationInfo, appProvisionType: 'unknown' } }, /signing metadata/],
    [{ appId: '' }, /signing metadata/],
    [{ appIdentifier: undefined }, /signing metadata/],
    [{ versionName: '0.2.0\n' }, /version or installation/],
    [{ versionCode: '1000000' }, /version or installation/],
    [{ updateTime: 0 }, /version or installation/],
    [{ applicationInfo: { ...bms.applicationInfo, uid: -1 } }, /version or installation/],
    [{ hapModuleInfos: undefined, hapModulesInfo: [runner] }, /native module records/],
    [{ hapModuleInfos: [{ ...runner, moduleType: 1 }] }, /current entry_test feature/],
    [{ hapModuleInfos: [{ ...runner, versionCode: 999999 }] }, /current entry_test feature/],
    [{ hapModuleInfos: [{ ...runner, moduleType: 'feature' }] }, /invalid or ambiguous/],
    [{ hapModuleInfos: [{ ...runner, bundleName: 'com.example.wrong' }] }, /invalid or ambiguous/],
    [{ hapModuleInfos: [{ ...runner, name: 'entry' }] }, /invalid or ambiguous/],
    [{ hapModuleInfos: [runner, runner] }, /invalid or ambiguous/],
    [{ hapModuleNames: ['entry'] }, /contradictory module membership/],
    [{ hapModuleInfos: [entry] }, /contradictory module membership/],
  ]) {
    assert.throws(() => parseRunnerInstalledMetadata(dump({ ...bms, ...change }), bundleName), error);
  }
  assert.throws(() => parseRunnerInstalledMetadata(dump(bms, 'com.example.wrong'), bundleName),
    /absence is not established/);
  assert.throws(() => parseRunnerInstalledMetadata(dump(bms), 'io.reader.minliny'), /independent Runner bundle/);
  assert.throws(() => parseRunnerInstalledMetadata(`${bundleName}:\n{${appId}`, bundleName), {
    message: 'Installed Runner metadata is malformed',
  });
});

test('runner BMS projection proves only specific absence', () => {
  const unavailable = 'error: failed to get information and the parameters may be wrong.';
  const explicit = `error: bundle [${bundleName}] not found`;
  const inventory = 'ID: 100:\n\tcom.ohos.sceneboard\n\tio.reader.minliny';
  const expected = { bundlePresent: false, bundleName };
  assert.deepEqual(parseRunnerInstalledMetadata(explicit, bundleName), expected);
  assert.deepEqual(parseRunnerInstalledMetadata(`${explicit}.`, bundleName, inventory), expected);
  assert.deepEqual(parseRunnerInstalledMetadata(unavailable, bundleName, inventory), expected);
  for (const listing of ['', 'ID: 100:', `${inventory}\n\t${bundleName}`, `${inventory}\nID: 101:\n\tcom.example.app`,
    `${inventory}\nerror: timeout`, 'com.ohos.sceneboard']) {
    assert.throws(() => parseRunnerInstalledMetadata(unavailable, bundleName, listing), /absence is not established/);
  }
  assert.throws(() => parseRunnerInstalledMetadata(explicit, bundleName, `${inventory}\n\t${bundleName}`),
    /absence is not established/);
  for (const output of ['Connect server failed', 'error: bundle [io.reader.minliny] not found', `${explicit}\ncommand failed`]) {
    assert.throws(() => parseRunnerInstalledMetadata(output, bundleName, inventory), /absence is not established/);
  }
});
