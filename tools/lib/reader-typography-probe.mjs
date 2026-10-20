import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import * as fontFamilies from '../../entry/src/main/ets/features/common/ReaderFontFamilies.ts';
import { DOWNLOAD_VISUAL } from '../../entry/src/main/ets/features/common/SharedDownloadVisualSpec.ts';
import { MANGA_DIRECTORY_VISUAL } from '../../entry/src/main/ets/features/manga/MangaDirectoryVisual.ts';

/** Execute the real typography-only ETS module with its real physical-family
 * exports. Builder/layout probes no longer duplicate role names or tuples in
 * ad-hoc stubs. This loader does not emulate ArkUI or write compiler output. */
export function loadReaderTypographyRoles(source = readFileSync(new URL(
  '../../entry/src/main/ets/features/common/ReaderTypography.ets', import.meta.url), 'utf8')) {
  const names = [...source.matchAll(/^export const (TYPE_\w+)\s*=/gm)].map(match => match[1]);
  assert.ok(names.length > 0, 'production ReaderTypography exports semantic roles');
  assert.equal(new Set(names).size, names.length, 'typography role exports are unique');
  const executable = stripTypeScriptTypes(source
    .replace(/^import[\s\S]*?;\s*/gm, '')
    .replace(/^export /gm, ''));
  return new Function(...Object.keys(fontFamilies), 'DOWNLOAD_VISUAL', 'MANGA_DIRECTORY_VISUAL',
    `${executable}; return { ${names.join(', ')} };`)(
    ...Object.values(fontFamilies), DOWNLOAD_VISUAL, MANGA_DIRECTORY_VISUAL);
}

const typography = loadReaderTypographyRoles();
// Execute the approved scoped message roles from their production module,
// rather than duplicating tuples in every focused SDK fixture.
const messageSource = readFileSync(new URL(
  '../../entry/src/main/ets/features/common/ReaderMessageStyle.ets', import.meta.url), 'utf8');
const messageNames = [...messageSource.matchAll(/^export const (MESSAGE_\w+)\s*=/gm)].map(match => match[1]);
const typographySource = readFileSync(new URL(
  '../../entry/src/main/ets/features/common/ReaderTypography.ets', import.meta.url), 'utf8');
const classSource = typographySource.slice(typographySource.indexOf('export class ReaderTextStyle'),
  typographySource.indexOf('\nexport class ReaderInheritedTextStyle'));
const ReaderTextStyle = new Function(`${stripTypeScriptTypes(classSource).replace(/^export /gm, '')}; return ReaderTextStyle;`)();
export const readerMessageStyles = new Function('ReaderTextStyle', ...Object.keys(fontFamilies),
  `${stripTypeScriptTypes(messageSource).replace(/^import[^;]+;\s*/gm, '').replace(/^export /gm, '')}; return {${messageNames.join(',')}};`)(
  ReaderTextStyle, ...Object.values(fontFamilies));
export const readerTypographyRoles = { ...typography, ...readerMessageStyles };
