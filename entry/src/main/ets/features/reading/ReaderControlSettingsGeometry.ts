import { readerControlActor as actor, readerControlLerp as lerp, readerControlUnit as unit,
  sampleReaderControlActor as sample, type ReaderControlActorFrame } from './ReaderControlActorGeometry.ts';

export type ReaderControlSettingsGroup = 'direction' | 'pageTurn' | 'timeout';
export type ReaderControlSettingsAddedGroup = 'status' | 'typography' | 'control';

export interface ReaderControlSettingsFrame {
  title: ReaderControlActorFrame;
  labels: ReaderControlActorFrame[];
  bars: ReaderControlActorFrame[];
  directionChoices: ReaderControlActorFrame[];
  pageChoices: ReaderControlActorFrame[];
  groups: ReaderControlActorFrame[];
  children: ReaderControlActorFrame[];
}

/** One immutable pose shared by all mounted Settings actor attributes. */
export function sampleReaderControlSettings(p: number, width: number): ReaderControlSettingsFrame {
  const bars = [readerControlSettingsBar(0, p, width), readerControlSettingsBar(1, p, width),
    readerControlSettingsBar(2, p, width)];
  const directionChoices: ReaderControlActorFrame[] = [];
  const pageChoices: ReaderControlActorFrame[] = [];
  for (let i = 0; i < 3; i++) directionChoices.push(readerControlSettingsChoice(3, i, p, bars[0].width));
  for (let i = 0; i < 5; i++) pageChoices.push(readerControlSettingsChoice(5, i, p, bars[1].width));
  const groupWidth = Math.max(0, width - 30);
  return {
    title: readerControlSettingsScreenTitle(p),
    labels: [readerControlSettingsLabel(0, p), readerControlSettingsLabel(1, p), readerControlSettingsLabel(2, p)],
    bars, directionChoices, pageChoices,
    groups: [readerControlSettingsAddedGroup('status', p, width),
      readerControlSettingsAddedGroup('typography', p, width), readerControlSettingsAddedGroup('control', p, width)],
    children: [readerControlSettingsAddedChild('divider', 0, p, groupWidth),
      readerControlSettingsAddedChild('title', 0, p, groupWidth),
      readerControlSettingsAddedChild('row', 0, p, groupWidth),
      readerControlSettingsAddedChild('row', 1, p, groupWidth),
      readerControlSettingsAddedChild('row', 2, p, groupWidth)],
  };
}

/** Local coordinates inside PersistentModule/Settings/Screen (15,5). */
export function readerControlSettingsLabel(index: number, p: number): ReaderControlActorFrame {
  // Compact endpoint reserves a clear title lane (0..16vp). The previous
  // 15vp label origin intersected the title's 17..33vp box and its own
  // segment bar. Keep the same row rhythm while moving the compact labels
  // and bars down; full endpoint remains Figma exact.
  return sample(actor(4, 18 + 54 * index, 248, 12),
    actor(0, 37 + 72 * index, 150, 16), p);
}

export function readerControlSettingsBar(index: number, p: number,
  availableWidth: number): ReaderControlActorFrame {
  const progress = unit(p);
  const delta = availableWidth - lerp(286, 338, progress);
  const value = sample(actor(4, 35 + 54 * index, 248, 30),
    actor(0, 61 + 72 * index, 308, 33), progress);
  return actor(value.x, value.y, Math.max(0, value.width + delta), value.height);
}

/** Each option keeps its own source track under the animated bar.
 * Nonuniform gaps are recovered values, not rounded uniform fractions. */
export function readerControlSettingsChoice(count: number, index: number, p: number,
  barWidth: number): ReaderControlActorFrame {
  const progress = unit(p);
  const quickX = count === 3 ? [3, 84, 166] : [3, 52, 101, 149, 198];
  const fullX = count === 3 ? [3, 104.66, 206.32] : [3, 64, 125, 186, 247];
  const base = sample(actor(quickX[index], 3, count === 3 ? 79 : 47, 24),
    actor(fullX[index], 3, count === 3 ? 98.66 : 58, 27), progress);
  const delta = barWidth - lerp(248, 308, progress);
  return actor(base.x + delta * index / count, base.y,
    Math.max(0, base.width + delta / count), base.height);
}

export function readerControlSettingsScreenTitle(p: number): ReaderControlActorFrame {
  return sample(actor(0, 0, 160, 16, 0), actor(0, 9, 160, 16), p);
}

export function readerControlSettingsAddedGroup(group: ReaderControlSettingsAddedGroup,
  p: number, availableWidth: number): ReaderControlActorFrame {
  const y = group === 'status' ? 263 : group === 'typography' ? 432 : 563;
  const translation = group === 'status' ? 14 : group === 'typography' ? 18 : 22;
  const height = group === 'typography' ? 131 : 169;
  return sample(actor(15, y + translation, Math.max(0, availableWidth - 30), height, 0),
    actor(15, y, Math.max(0, availableWidth - 30), height), p);
}

/** Children are local to the animated parent: alpha is p*p, Y includes BOTH
 * translations. The renderer owns actual composition, not this sampler. */
export function readerControlSettingsAddedChild(kind: 'divider' | 'title' | 'row',
  index: number, p: number, groupWidth: number): ReaderControlActorFrame {
  const y = kind === 'divider' ? 0 : kind === 'title' ? 21 : 43 + 38 * index;
  const translation = kind === 'divider' ? 18 : kind === 'title' ? 21 : 24 + 3 * index;
  const height = kind === 'divider' ? 1 : kind === 'title' ? 16 : 38;
  const width = kind === 'title' ? Math.min(160, groupWidth) : groupWidth;
  return sample(actor(0, y + translation, width, height, 0), actor(0, y, width, height), p);
}
