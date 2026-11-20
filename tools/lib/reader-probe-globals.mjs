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
