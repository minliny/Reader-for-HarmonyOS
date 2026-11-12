import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const source = readFileSync(new URL('../../entry/src/main/ets/app/composition/JsonImportPresentation.ets', import.meta.url), 'utf8');
const plain = source.replace(/^@Observed\n/gm, '').replace(/^export /gm, '');
export const JsonImportPresentation = new Function(stripTypeScriptTypes(plain) + '; return JsonImportPresentation;')();

export function bindJsonImportFixtureFields(prototype) {
  Object.defineProperty(prototype, 'jsonImportVisible', {
    get() { return this.jsonImportPresentation.opening !== undefined; },
    set(value) {
      if (value) this.jsonImportPresentation.open('bookSource', () => true, () => {});
      else this.jsonImportPresentation.dismiss();
    },
    configurable: true,
  });
}
