/** Collapse only explicit static Day/Night resource selection for legacy
 * structural glyph assertions. Business ternaries remain untouched; actual
 * Day/Night SDK observer behavior is exercised by session-launch-recovery. */
export function readerDayResourceBranches(source) {
  return source.replace(/\(this\.(?:appScheme|appThemeScheme) === 'night' \? 'app\.media\.[^']+_theme_night' : ('app\.media\.[^']+')\)/g, '$1');
}
