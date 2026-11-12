// The search endpoint is the existing bookshelf_search.svg path, in its original
// 48-unit viewBox. The back endpoint uses book_detail_back.svg's three strokes.
// Keep the original curves here so morphing does not replace the idle icon with
// a smaller, heavier approximation. The endpoint test checks both SVG assets.
const SEARCH_RING_START: number[] = [7.06569, 25.3576];
const SEARCH_RING_CURVES: number[][] = [
  [6.36212, 23.659, 6, 21.8385, 6, 20],
  [6, 18.1615, 6.36212, 16.341, 7.06569, 14.6424],
  [7.76925, 12.9439, 8.80048, 11.4005, 10.1005, 10.1005],
  [11.4005, 8.80048, 12.9439, 7.76925, 14.6424, 7.06569],
  [16.341, 6.36212, 18.1615, 6, 20, 6],
  [21.8385, 6, 23.659, 6.36212, 25.3576, 7.06569],
  [27.0561, 7.76925, 28.5995, 8.80048, 29.8995, 10.1005],
  [31.1995, 11.4005, 32.2307, 12.9439, 32.9343, 14.6424],
  [33.6379, 16.341, 34, 18.1615, 34, 20],
  [34, 21.8385, 33.6379, 23.659, 32.9343, 25.3576],
  [32.2307, 27.0561, 31.1995, 28.5995, 29.8995, 29.8995],
  [28.5995, 31.1995, 27.0561, 32.2307, 25.3576, 32.9343],
  [23.659, 33.6379, 21.8385, 34, 20, 34],
  [18.1615, 34, 16.341, 33.6379, 14.6424, 32.9343],
  [12.9439, 32.2307, 11.4005, 31.1995, 10.1005, 29.8995],
  [8.80048, 28.5995, 7.76925, 27.0561, 7.06569, 25.3576],
];

export function librarySearchIconStrokeWidth(extent: number): number {
  return 3.5 * extent / 48;
}

export function librarySearchIconPath(progress: number, extent: number): string {
  const p = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const scale = extent / 48;
  const blend = (from: number, to: number): number => (from + (to - from) * p) * scale;
  let path = `M ${blend(SEARCH_RING_START[0], 22)} ${blend(SEARCH_RING_START[1], 12)}`;
  for (let segment = 0; segment < SEARCH_RING_CURVES.length; segment++) {
    const curve = SEARCH_RING_CURVES[segment];
    const upper = segment < 8;
    const offset = upper ? segment : segment - 8;
    path += ' C';
    for (let point = 0; point < 3; point++) {
      const fraction = (offset + (point + 1) / 3) / 8;
      const x = upper ? 22 - 12 * fraction : 10 + 12 * fraction;
      const y = upper ? 12 + 12 * fraction : 24 + 12 * fraction;
      path += ` ${blend(curve[point * 2], x)} ${blend(curve[point * 2 + 1], y)}`;
    }
  }
  if (p === 0) path += ' Z';
  return path + ` M ${blend(42, 38)} ${blend(42, 24)} L ${blend(30, 10)} ${blend(30, 24)}`;
}
