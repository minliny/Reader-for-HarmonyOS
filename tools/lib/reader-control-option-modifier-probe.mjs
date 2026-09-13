import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

export function productionSettingsOptionModifier() {
  const source = readFileSync(new URL('../../entry/src/main/ets/features/reading/ReaderControlSettingsOptionModifier.ets', import.meta.url), 'utf8');
  const body = stripTypeScriptTypes(source.replace(/^import .*;\n/gm, '').replace('export class ', 'class '));
  const deps = { TOK_LINE: 'TOK_LINE', TOK_READ_ELEVATED: 'TOK_READ_ELEVATED', TOK_READ_INK: 'TOK_READ_INK', TOK_READ_PRIMARY: 'TOK_READ_PRIMARY',
    Color: { Transparent: 'Color.Transparent' }, FontWeight: { Medium: 'FontWeight.Medium' }, TextAlign: { Center: 'TextAlign.Center' } };
  return new Function(...Object.keys(deps), `${body}; return ReaderControlSettingsOptionModifier;`)(...Object.values(deps));
}
