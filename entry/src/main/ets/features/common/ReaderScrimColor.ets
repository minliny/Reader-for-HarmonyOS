import { ColorMetrics } from '@kit.ArkUI';

/** Platform alpha composition with the opaque hex form used by system bars.
 * The owning surface supplies an opaque paper/ink beneath its actual scrim. */
export function readerScrimmedOpaqueColor(base: ResourceColor, scrim: ResourceColor): string {
  const color = ColorMetrics.resourceColor(base).blendColor(ColorMetrics.resourceColor(scrim));
  return `#FF${Math.round(color.red).toString(16).padStart(2, '0')}${Math.round(color.green).toString(16).padStart(2, '0')}${Math.round(color.blue).toString(16).padStart(2, '0')}`;
}
