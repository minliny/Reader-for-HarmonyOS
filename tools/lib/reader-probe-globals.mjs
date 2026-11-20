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

const readableAdmissionInitializer = readFileSync(new URL('../../entry/src/main/ets/features/bookshelf/BookshelfReadableAdmissionOwner.ts', import.meta.url), 'utf8')
  .match(/export const EMPTY_READABLE_ADMISSION:[\s\S]*?= \{[\s\S]*?\n\};/)[0];
const EMPTY_READABLE_ADMISSION = new Function(stripTypeScriptTypes(readableAdmissionInitializer.replace('export ', '')) + ';return EMPTY_READABLE_ADMISSION;')();

const recoveryChildren = ['ReaderRecoveryAction', 'ReaderRecoveryNotice'];

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
