import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { MAIN_TAB_LABEL_LINE_HEIGHT } from '../../entry/src/main/ets/features/common/ReaderLayoutTokens.ts';
import { readerInteractiveSafeBottom } from '../../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import { pureModuleProbe } from './ets-pure-module-probe.mjs';

// Run the production helper while retaining extensionless ArkTS imports in the app.
const source = readFileSync(new URL('../../entry/src/main/ets/features/common/ReaderFloatingBarMetrics.ts', import.meta.url), 'utf8');
const { readerScaledControlHeight } = pureModuleProbe(readFileSync(
  new URL('../../entry/src/main/ets/features/common/ReaderSurfaceResolvers.ts', import.meta.url), 'utf8'),
  'ReaderSurfaceResolvers.ts', {}, ['readerScaledControlHeight']);
const helpers = new Function('readerInteractiveSafeBottom', 'readerScaledControlHeight', 'MAIN_TAB_LABEL_LINE_HEIGHT', `${stripTypeScriptTypes(
  source.replace(/import[\s\S]*?from '[^']+';/g, '').replace(/\bexport /g, ''))};
  return { READER_FLOATING_TOP_BAR_HEIGHT, READER_FLOATING_TAB_BAR_HEIGHT,
    readerFloatingBarBottomInset, readerFloatingTabBottomInset, readerFloatingTabContentInset,
    readerMainTabItemHeight, readerFloatingTabBarHeight };`)(
  readerInteractiveSafeBottom, readerScaledControlHeight, MAIN_TAB_LABEL_LINE_HEIGHT);
export const { READER_FLOATING_TOP_BAR_HEIGHT, READER_FLOATING_TAB_BAR_HEIGHT,
  readerFloatingBarBottomInset, readerFloatingTabBottomInset, readerFloatingTabContentInset,
  readerMainTabItemHeight, readerFloatingTabBarHeight } = helpers;
