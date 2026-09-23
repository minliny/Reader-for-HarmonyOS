import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  readerControlVerificationColdStartPage,
} from '../entry/src/main/ets/app/ReaderControlVerificationLaunch.ts';

const normal = 'pages/Index';
const diagnostic = 'pages/ReaderControlMotionVerification';
const rendererPilot = 'pages/ReaderRendererPilot';
const candidateValues = [undefined, null, false, 0, 1, '', 'true', 'TRUE', '1',
  diagnostic, rendererPilot, { readerControlMotionVerification: true }, { route: diagnostic },
  [true], new Boolean(true)];
for (const debug of [false, true]) {
  for (const mode of ['release', '', 'DEBUG', 'debug', 'debug ', 'preview', 'custom']) {
    for (const value of candidateValues) {
      const expected = debug === true && mode === 'debug' && value === true ? diagnostic : normal;
      assert.equal(readerControlVerificationColdStartPage(debug, mode, value, undefined), expected,
        'renderer pilot requires exact debug cold-start admission');
    }
  }
}
assert.equal(readerControlVerificationColdStartPage(true, 'debug', true, undefined), diagnostic);
assert.equal(readerControlVerificationColdStartPage(true, 'debug', undefined, true), rendererPilot);
assert.equal(readerControlVerificationColdStartPage(true, 'debug', true, true), normal,
  'conflicting diagnostic requests fall back to the normal reader');

// Supplemental integration guards: not a claim of compiled/device behavior.
const ability = await readFile(new URL('../entry/src/main/ets/entryability/EntryAbility.ets', import.meta.url), 'utf8');
assert.match(ability, /private coldStartPage: string = 'pages\/Index'/);
assert.match(ability, /windowStage\.loadContent\(this\.coldStartPage,/);
assert.match(ability, /readerControlVerificationColdStartPage\(/);
assert.match(ability, /want\.parameters\?\.readerOpenSourcePilot/);
assert.equal([...ability.matchAll(/this\.coldStartPage\s*=/g)].length, 1,
  'only onCreate admits a cold-start destination');
assert.match(ability, /onNewWant\(want: Want,[\s\S]*?ReaderSystemFileOpenHost\.receive\(want\);\s*\}/,
  'warm file wants enter the import queue without changing diagnostic routes or reloading the window');
assert.doesNotMatch(ability, /want\.(?:uri|action)|want\.parameters\?\.\[['"](?:route|page|url)['"]\]/,
  'no arbitrary external route enters loadContent');
assert.match(ability, /ReaderRuntimeOwner\.install\(this\.context,\s*readerDisableOptionalEntryMemory\(DEBUG, BUILD_MODE_NAME, want\.parameters\?\.readerDisableOptionalEntryMemory\)\)/);
assert.match(ability, /this\.runtimeOwner\?\.flush\(\)/);
assert.match(ability, /owner\?\.release\(\)/);

const pages = JSON.parse(await readFile(new URL('../entry/src/main/resources/base/profile/main_pages.json', import.meta.url), 'utf8'));
assert.deepEqual(pages.src, [normal, diagnostic, rendererPilot], 'diagnostics are registered for guarded debug cold starts');
const renderer = await readFile(new URL('../entry/src/main/ets/pages/ReaderRendererPilot.ets', import.meta.url), 'utf8');
assert.match(renderer, /\$rawfile\('reader-oss-pilot\/index\.html'\)/);
assert.match(renderer, /\.fileAccess\(false\)/);
assert.match(renderer, /\.domStorageAccess\(false\)/);
assert.doesNotMatch(renderer, /ReaderRuntimeOwner|LocalReadingExperience|deleteBook|clearData/);
const page = await readFile(new URL('../entry/src/main/ets/pages/ReaderControlMotionVerification.ets', import.meta.url), 'utf8');
assert.match(page, /@Entry\s+@Component\s+struct ReaderControlMotionVerification/);
assert.match(page, /ReaderControlMotionStage\(/);
assert.match(page, /ReaderControlAppearanceContent\(/);
assert.match(page, /独立格位、默认末尾，保留自定义排序/);
assert.match(page, /非阅读器业务验收/);
assert.doesNotMatch(page, /ReaderRuntimeOwner|LocalReadingExperience|clearData|deleteBook/,
  'diagnostic content is not a production session or data-reset path');
const pointer = await readFile(new URL('./fixtures/ReaderControlMotionVerification.ets', import.meta.url), 'utf8');
assert.match(pointer, /'entry\/src\/main\/ets\/pages\/ReaderControlMotionVerification\.ets'/);
assert.doesNotMatch(pointer, /@Entry|@Component|struct ReaderControlMotionVerification/,
  'there is no duplicate large diagnostic component');
const pipeline = await readFile(new URL('../scripts/hap-pipeline.mjs', import.meta.url), 'utf8');
assert.match(pipeline, /'product=default'.*'module=entry@default'.*'buildMode=debug'/,
  'generated BuildProfile import matches the sole pipeline target');
console.log('reader control diagnostic cold-start production admission + packaging wiring: PASS');
