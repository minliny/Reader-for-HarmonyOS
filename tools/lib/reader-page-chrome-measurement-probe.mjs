import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import * as fonts from '../../entry/src/main/ets/features/common/ReaderFontFamilies.ts';
import { loadReaderTypographyRoles } from './reader-typography-probe.mjs';

const source = relative => readFileSync(new URL(relative, import.meta.url), 'utf8');
const executable = text => stripTypeScriptTypes(text.replace(/import\s+(?:type\s+)?\{[\s\S]*?\}\s*from[^;]*;/g, '')).replace(/\bexport /g, '');
const typographySource = source('../../entry/src/main/ets/features/common/ReaderTypography.ets');
const roles = loadReaderTypographyRoles(typographySource);
// The constructor belongs to the actual production role instance; preserve
// the public helper's original four exports without copying ReaderTextStyle.
export const chromeTypography = {
  ReaderTextStyle: roles.TYPE_READER_IMMERSIVE_TIME.constructor,
  TYPE_READER_IMMERSIVE_TIME: roles.TYPE_READER_IMMERSIVE_TIME,
  TYPE_READER_IMMERSIVE_PROGRESS: roles.TYPE_READER_IMMERSIVE_PROGRESS,
  TYPE_READER_IMMERSIVE_PAGE_ORDINAL: roles.TYPE_READER_IMMERSIVE_PAGE_ORDINAL,
};
// Execute the complete production helper; only the platform resource reference
// and UIContext are boundary fixtures. Resource numeric values remain per-test.
const dependencies = { ...chromeTypography, ...fonts, $r: name => ({ id: name }) };
const implementation = new Function(...Object.keys(dependencies), executable(source(
  '../../entry/src/main/ets/features/reading/ReaderPageChromeTextMeasurement.ets')) +
  '; return {measureReaderPageChromeText, readerPageChromeTextMeasurements, readerPageChromeTopTextStyle};')(...Object.values(dependencies));
export const { measureReaderPageChromeText, readerPageChromeTextMeasurements, readerPageChromeTopTextStyle } = implementation;
