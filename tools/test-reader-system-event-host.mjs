import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const host = await readFile(new URL(
  '../entry/src/main/ets/app/ReaderReadingSystemEventHost.ts',
  import.meta.url,
), 'utf8');
const experience = await readFile(new URL(
  '../entry/src/main/ets/features/reading/LocalReadingExperience.ets',
  import.meta.url,
), 'utf8');

assert.match(host, /inputConsumer\.on\('keyPressed'/);
assert.match(host, /KeyCode\.KEYCODE_VOLUME_UP/);
assert.match(host, /KeyCode\.KEYCODE_VOLUME_DOWN/);
assert.match(host, /isRepeat: false/);
assert.match(host, /COMMON_EVENT_SCREEN_OFF/);
assert.match(host, /subscribeToEvent/);
assert.match(host, /inputConsumer\.off\('keyPressed'/);
assert.match(host, /commonEventManager\.unsubscribe/);
assert.match(experience, /ReaderReadingSystemEventHost/);
assert.match(experience, /snapshot\.volumeKeysTurnPage/);
assert.match(experience, /snapshot\.stopTtsOnScreenOff/);
assert.match(experience, /stop\('screenOff'\)/);

console.log('reader physical-key and screen-off Host contract: PASS');
