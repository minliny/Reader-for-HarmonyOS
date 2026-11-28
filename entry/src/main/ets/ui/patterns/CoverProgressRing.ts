/**
 * Pure geometry and formatting helpers for compact cover-mode progress ring badges.
 */

export function coverProgressBadgeText(percent: number): string {
  if (!Number.isFinite(percent) || percent <= 0) return '';
  if (percent < 1) return '<1%';
  return `${Math.min(100, Math.floor(percent))}%`;
}

export function coverProgressIsComplete(percent: number): boolean {
  return Number.isFinite(percent) && percent >= 100;
}

export function coverProgressArcCommands(
  percent: number,
  sizeVp: number,
  strokeVp: number,
  vpToPx: number,
): string {
  if (
    !Number.isFinite(percent) || percent <= 0 || percent >= 100 ||
    !Number.isFinite(sizeVp) || sizeVp <= 0 ||
    !Number.isFinite(vpToPx) || vpToPx <= 0
  ) {
    return '';
  }
  const angleDeg = Math.max(18, Math.min(359.5, (percent / 100) * 360));
  const center = (sizeVp / 2) * vpToPx;
  const safeStroke = Number.isFinite(strokeVp) && strokeVp > 0 ? strokeVp : 0;
  const radius = Math.max(0.5, (sizeVp - safeStroke) / 2) * vpToPx;
  const rad = (angleDeg * Math.PI) / 180;
  const startX = center;
  const startY = center - radius;
  const endX = center + radius * Math.sin(rad);
  const endY = center - radius * Math.cos(rad);
  const largeArc = angleDeg > 180 ? 1 : 0;
  return `M ${startX.toFixed(2)} ${startY.toFixed(2)} A ${radius.toFixed(2)} ${radius.toFixed(2)} 0 ${largeArc} 1 ${endX.toFixed(2)} ${endY.toFixed(2)}`;
}
