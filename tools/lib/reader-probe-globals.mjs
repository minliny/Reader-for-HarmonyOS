import * as directoryVisual from '../../entry/src/main/ets/features/manga/MangaDirectoryVisual.ts';
import * as directoryGeometry from '../../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts';
import { readerAppColor, readerThemeDefinition } from '../../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { productionReaderPressFeedback } from './reader-press-feedback-probe.mjs';
import { productionMangaDirectoryPressFeedback } from './manga-directory-press-feedback-probe.mjs';
import { readerTypographyRoles } from './reader-typography-probe.mjs';
import { actualReaderPageShell } from './reader-page-shell-runtime-probe.mjs';
import { readerContentSafeTop, createDefaultReaderWindowMetrics } from '../../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import { readerRecoveryView } from '../../entry/src/main/ets/app/ReaderRecoveryProjection.ts';
import { ReaderMeasurementStore } from '../../entry/src/main/ets/features/common/ReaderMeasurements.ts';
import { RemoteReadingGatewayError } from '../../entry/src/main/ets/features/reading/RemoteReadingContract.ts';
import * as localImportMotion from '../../entry/src/main/ets/features/bookshelf/LocalImportMotion.ts';
import * as readerScrollLayoutModule from '../../entry/src/main/ets/features/common/ReaderScrollLayout.ts';
import * as headerMetrics from '../../entry/src/main/ets/features/common/ReaderHeaderMetrics.ts';

const readableAdmissionInitializer = readFileSync(new URL('../../entry/src/main/ets/features/bookshelf/BookshelfReadableAdmissionOwner.ts', import.meta.url), 'utf8')
  .match(/export const EMPTY_READABLE_ADMISSION:[\s\S]*?= \{[\s\S]*?\n\};/)[0];
const EMPTY_READABLE_ADMISSION = new Function(stripTypeScriptTypes(readableAdmissionInitializer.replace('export ', '')) + ';return EMPTY_READABLE_ADMISSION;')();

const recoveryChildren = ['ReaderRecoveryAction', 'ReaderRecoveryNotice'];

// HeaderSpecs is .ets; mirror its finite geometry so pages that read the
// initial fallback can compile without the whole chrome stack.
class BookshelfHeaderSpec {
  constructor(barHeight = 52, topInset = 8, contentGap = 14) {
    this.barHeight = barHeight; this.topInset = topInset; this.contentGap = contentGap;
    this.frameHeight = barHeight + topInset; this.contentClearance = barHeight + topInset + contentGap;
  }
}
class DetailHeaderSpec {
  topGap = 8; barHeight = 52; contentGap = 16; contentUnderlap = 8; scrollThreshold = 4;
  headerTop(topInset) { return Math.max(0, topInset) + this.topGap; }
  contentStart(topInset, measuredBarHeight) { return this.headerTop(topInset) + Math.max(0, measuredBarHeight) + this.contentGap; }
}
const buttonSpec = () => ({ text: { fontFamily: 'sans-serif', fontWeight: 500, fontSizeFp: 14, lineHeightFp: 20 },
  height: 40, radius: 10, horizontalPadding: 12, stacked: false, primarySurface: 'app.button.primary',
  secondarySurface: 'app.button.secondary', primaryBorder: 'app.border.control', secondaryBorder: 'app.border.control',
  disabledOpacity: 0.4, primaryDisabledOpacity: 0.4, hasBorder: true, primaryHasBorder: true, hasSurface: true,
  outerRadius: false, primaryText: 'TOK_READ_INK', secondaryText: 'TOK_READ_INK', verticalPadding: 8,
  allPadding: undefined, maxLines: 1 });
const headers = { bookshelfHeaderSpec: () => new BookshelfHeaderSpec(), detailHeaderSpec: () => new DetailHeaderSpec(),
  resolveReaderButtonSpec: () => buttonSpec(),
  readerVisualSafeLeft: () => 0, readerVisualSafeRight: () => 0,
  readerHeaderVeilMaterial: (_scrolled, scheme) => ({ radius: 0, color: scheme === 'night' ? '#1F1F1F' : '#FFFFFF' }),
  readerHeaderVeilBorder: (_scrolled, _scheme) => ({ width: 0, color: 'transparent' }),
  SheetSize: { MEDIUM: 0, LARGE: 1, FIT_CONTENT: 2 },
  readerMainViewport: () => ({ width: 393, height: 852, left: 0, top: 0 }),
  readerMainNavigationMode: (width) => width >= 900 ? 'rail' : width >= 600 ? 'expanded' : 'compact',
  resolvePopupSpec: () => ({ collapsedHeight: 44, expandedHeight: 220, pointerWidth: 12, pointerHeight: 6,
    radius: 12, maxWidth: 320, rowHeight: 44 }),
  SheetType: { BOTTOM: 0, CENTER: 1, POPUP: 2 },
  readerSheetWidth: (_id, viewportWidth, safeLeft, safeRight) => Math.min(390,
    Math.max(0, (Number.isFinite(viewportWidth) ? viewportWidth : 0) - (safeLeft ?? 0) - (safeRight ?? 0))),
  readerSheetChrome: (_id, _scheme, width) => ({ width,
    backgroundColor: 'app.surface.sheet', radius: { topLeft: 22, topRight: 22, bottomLeft: 0, bottomRight: 0 },
    maskColor: 'TOK_SS_DRAWER_SCRIM', shadow: { radius: 0, offsetX: 0, offsetY: 0, color: 'transparent' },
    borderWidth: { top: 1 }, borderColor: 'app.border.modalHighlight' }),
  ReaderTransientFeedback: class { show() { return true; } reset() {} },
  readerPageInitialHeaderHeight: (kind) => kind === 'bookshelf' ? 60 : 58 };

export function readerProbeGlobals({ source, dependencies, platform, Child }) {
  // Geometry/property probes do not register physical platform fonts. The
  // actual registrar has a separate demand/failure/retry test.
  const globals = { readerRegisteredFontFamily: (_font, family) => family,
    // Pure projections and presentation-only ports the refactored surfaces call
    // directly. Explicit case dependencies still override every entry.
    readerReadableFontScale: (fs) => Number.isFinite(fs) && fs > 0 ? Math.max(1, fs) : 1,
    readerScaledControlHeight: (base, lineHeight, fs) => Math.ceil(
      (Number.isFinite(base) ? Math.max(0, base) : 0) +
      (Number.isFinite(lineHeight) ? Math.max(0, lineHeight) : 0) *
      Math.max(0, (Number.isFinite(fs) && fs > 0 ? Math.max(1, fs) : 1) - 1)),
    readerActionTouchRegion: (width, height) => ({ x: 0, y: 0, width, height }),
    registerReaderFonts: () => undefined,
    createDefaultSettingsSnapshot: () => ({ autoCheckUpdate: true, tapBottomScrollTop: true, reduceMotion: false,
      crashLog: true, developerMode: false, wideNavigationRail: false }),
    readerWidthClassWithHint: (width, hint) => hint === true || width >= 600 ? 'expanded' : 'compact',
    readerActionIcon: (kind, scheme) => `resource:${kind}:${scheme === 'night' ? 'night' : 'day'}`,
    readerSurfaceMaxHeight: (available, reserved, minimum = 0) => Math.max(
      Number.isFinite(minimum) ? Math.max(0, minimum) : 0,
      (Number.isFinite(available) ? Math.max(0, available) : 0) - (Number.isFinite(reserved) ? Math.max(0, reserved) : 0)),
    readerSurfaceElevation: () => ({ radius: 0, offsetY: 0 }),
    readerInteractiveSafeLeft: () => 0, readerInteractiveSafeRight: () => 0,
    motionAnimateParam: () => ({ duration: 200, curve: 'ease-in-out' }),
    readerMotionAnimateParam: () => ({ duration: 200, curve: 'ease-in-out' }),
    ReaderMeasurementStore,
    readerExpandedLayout: (metrics) => {
      const width = metrics?.windowRect?.width;
      return Number.isFinite(width) && width > 0 && width >= 600;
    },
    ...localImportMotion, ...headers, ...readerScrollLayoutModule, ...headerMetrics,
    readerScaledBarHeight: (base, lineHeight, fs) => Math.ceil(
      (Number.isFinite(base) ? Math.max(0, base) : 0) +
      (Number.isFinite(lineHeight) ? Math.max(0, lineHeight) : 0) *
      Math.max(0, (Number.isFinite(fs) && fs > 0 ? Math.max(1, fs) : 1) - 1)),
    readerMotionDurationMs: (_id, reduceMotion) => reduceMotion === true ? 0 : 200,
    motionAnimateParamDelayed: (_id, delay) => ({ duration: 200, curve: 'ease-in-out', delay }),
    RemoteReadingGatewayError,
    defaultSourceManagementFilters: () => ({ searchQuery: '', statusValue: '全部', categoryValue: 'all', groupValue: '全部分组' }),
    TextInputController: class { caretPosition() {} },
    FrameCallback: class { onFrame() {} cancel() {} },
    ReaderActionAccessibility: class { constructor() {} applyNormalAttribute() {} },
    readerFontFamilyReady: () => true, MangaDirectoryCurrentFooter: Child,
    // Constructor arguments cross the platform seam unchanged; native color
    // parsing and focus-box rasterization remain target evidence.
    readerAppColor, readerThemeDefinition, readerRecoveryView, EMPTY_READABLE_ADMISSION, readerContentSafeTop, ReaderControlSwitchTrack: Child,
    ...Object.fromEntries(recoveryChildren.map(name => [name, Child])), $r: value => value,
    ...Object.fromEntries([...source.matchAll(/\b(TOK_[A-Z0-9_]+)\b/g)].map(m => [m[1], m[1]])),
    ...readerTypographyRoles, ...directoryVisual, ...directoryGeometry, visual: directoryVisual.MANGA_DIRECTORY_VISUAL,
    // Actual production surface/inset policy, including all finite variants.
    ...actualReaderPageShell(),
    // Constructor identity is the native seam; movement requires an explicit
    // focused Scroller fixture. Render probes do not simulate scroll physics.
    Scroller: class {},
    ReaderWindowCoordinator: { metrics: () => {
      const metrics = createDefaultReaderWindowMetrics();
      metrics.windowRect.width = 393; metrics.windowRect.height = 852;
      return metrics;
    } },
    readerInteractiveSafeBottom: metrics => metrics.interactiveSafeInsets?.bottom ?? 0,
    ...dependencies };
  const resolved = { ...platform, ...globals };
  globals.ReaderPressFeedback ??= productionReaderPressFeedback({ Color: resolved.Color });
  globals.MangaDirectoryPressFeedback ??= productionMangaDirectoryPressFeedback(undefined,
    { LengthMetrics: resolved.LengthMetrics, ColorMetrics: resolved.ColorMetrics });
  return globals;
}
