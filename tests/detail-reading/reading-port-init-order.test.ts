import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('buildSpeechPorts does not eagerly capture readingProgressOwners or host.speech()', () => {
  const portsSource = readFileSync(
    new URL('../../entry/src/main/ets/features/reading/ui/LocalReadingExperiencePorts.ets', import.meta.url),
    'utf8',
  );
  const start = portsSource.indexOf('export function buildSpeechPorts(');
  const nextFn = portsSource.indexOf('export function buildReadingProgressPorts(');
  assert.ok(start >= 0 && nextFn > start, 'buildSpeechPorts and buildReadingProgressPorts must both exist');
  const speechBody = portsSource.slice(start, nextFn);
  assert.ok(!/readingProgressOwners/.test(speechBody), 'buildSpeechPorts must not construct readingProgressOwners');
  assert.ok(!/host\.speech\(\)/.test(speechBody), 'buildSpeechPorts must not evaluate host.speech() eagerly');
});

test('LocalReadingExperience declares all eager readingProgressOwners targets before buildReadingProgressPorts', () => {
  const source = readFileSync(
    new URL('../../entry/src/main/ets/features/reading/ui/LocalReadingExperience.ets', import.meta.url),
    'utf8',
  );
  const buildCallOffset = source.indexOf('buildReadingProgressPorts(this.portHost)');
  assert.ok(buildCallOffset > 0, 'buildReadingProgressPorts(this.portHost) call must exist');

  const requiredOwnerFields = [
    'exitProgress',
    'mountHost',
    'measuredPage',
    'surface',
    'speech',
    'turnRuntime',
    'readerBookmark',
    'playback',
    'auxiliarySession',
    'readingRecordHost',
    'readingRecordGateway',
    'recovery',
    'controlVerification',
  ];

  for (const field of requiredOwnerFields) {
    const pattern = new RegExp(`^\\s{2}private\\s+readonly\\s+${field}\\b`, 'm');
    const match = pattern.exec(source);
    assert.ok(match, `LocalReadingExperience must declare ${field}`);
    assert.ok(
      match.index < buildCallOffset,
      `${field} (offset ${match.index}) must be initialized before buildReadingProgressPorts(this.portHost) (offset ${buildCallOffset})`,
    );
  }
});
