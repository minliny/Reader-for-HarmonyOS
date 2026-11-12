import { actualReaderFloatingBarMetrics } from './reader-page-shell-runtime-probe.mjs';
import { APP_HEADER_BAR_HEIGHT } from '../../entry/src/main/ets/ui/foundation/ReaderHeaderMetrics.ts';

// Existing focused fixtures use the historical key for the standard header fallback.
export const READER_FLOATING_TOP_BAR_HEIGHT = APP_HEADER_BAR_HEIGHT;
export const { READER_FLOATING_TAB_BAR_HEIGHT,
  readerFloatingBarBottomInset, readerFloatingTabBottomInset, readerFloatingTabContentInset } = actualReaderFloatingBarMetrics();
