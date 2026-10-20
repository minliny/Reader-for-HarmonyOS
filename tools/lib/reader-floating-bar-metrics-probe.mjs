import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { readerInteractiveSafeBottom } from '../../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';

// Run the production helper while retaining extensionless ArkTS imports in the app.
const source = readFileSync(new URL('../../entry/src/main/ets/features/common/ReaderFloatingBarMetrics.ts', import.meta.url), 'utf8');
const helpers = new Function('readerInteractiveSafeBottom', `${stripTypeScriptTypes(
  source.replace(/import[\s\S]*?from '[^']+';/g, '').replace(/\bexport /g, ''))};
  return { READER_FLOATING_TOP_BAR_HEIGHT, READER_FLOATING_TAB_BAR_HEIGHT,
    readerFloatingBarBottomInset, readerFloatingTabBottomInset, readerFloatingTabContentInset };`)(readerInteractiveSafeBottom);
export const { READER_FLOATING_TOP_BAR_HEIGHT, READER_FLOATING_TAB_BAR_HEIGHT,
  readerFloatingBarBottomInset, readerFloatingTabBottomInset, readerFloatingTabContentInset } = helpers;
