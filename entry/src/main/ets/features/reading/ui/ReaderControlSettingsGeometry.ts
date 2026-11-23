import { readerControlActor as actor, readerControlLerp as lerp, readerControlUnit as unit,
  sampleReaderControlActor as sample, type ReaderControlActorFrame } from './ReaderControlActorGeometry.ts';

export type ReaderControlSettingsGroup = 'direction' | 'pageTurn' | 'timeout';
export type ReaderControlSettingsAddedGroup = 'status' | 'typography' | 'control';

export interface ReaderControlSettingsEndpointMinimum {
  width: number;
  labelHeights: number[];
  optionHeights: number[];
  columns: number[];
  titleHeight: number;
  addedTitleHeight: number;
  toggleLabelHeight: number;
  toggleRowHeight: number;
  fits: boolean;
}
export interface ReaderControlSettingsMinimumProfile {
  quick: ReaderControlSettingsEndpointMinimum;
  full: ReaderControlSettingsEndpointMinimum;
}

export interface ReaderControlSettingsFrame {
  title: ReaderControlActorFrame;
  screenHeight: number;
  contentHeight: number;
  toggleLabelHeight: number;
  labels: ReaderControlActorFrame[];
  bars: ReaderControlActorFrame[];
  directionChoices: ReaderControlActorFrame[];
  pageChoices: ReaderControlActorFrame[];
  timeoutChoices: ReaderControlActorFrame[];
  groups: ReaderControlActorFrame[];
  children: ReaderControlActorFrame[];
}

/** One immutable pose shared by all mounted Settings actor attributes. */
export function sampleReaderControlSettings(p: number, width: number,
  minimum?: ReaderControlSettingsMinimumProfile): ReaderControlSettingsFrame {
  if (minimum !== undefined) return sampleMeasuredSettings(p, minimum);
  const bars = [readerControlSettingsBar(0, p, width), readerControlSettingsBar(1, p, width),
    readerControlSettingsBar(2, p, width)];
  const directionChoices: ReaderControlActorFrame[] = [];
  const pageChoices: ReaderControlActorFrame[] = [];
  for (let i = 0; i < 3; i++) directionChoices.push(readerControlSettingsChoice(3, i, p, bars[0].width));
  for (let i = 0; i < 5; i++) pageChoices.push(readerControlSettingsChoice(5, i, p, bars[1].width));
  const groupWidth = Math.max(0, width - 30);
  return {
    title: readerControlSettingsScreenTitle(p),
    screenHeight: 258, contentHeight: lerp(190, 732, unit(p)), toggleLabelHeight: 16,
    labels: [readerControlSettingsLabel(0, p), readerControlSettingsLabel(1, p), readerControlSettingsLabel(2, p)],
    bars, directionChoices, pageChoices, timeoutChoices: pageChoices.slice(),
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

/** Natural endpoints, sampled by the original shared p. Icons and switches keep their dimensions. */
function measuredSettingsEndpoint(form: ReaderControlSettingsEndpointMinimum, full: boolean,
  added: ReaderControlSettingsEndpointMinimum): ReaderControlSettingsFrame {
  const p = full ? 1 : 0;
  const frame = sampleReaderControlSettings(p, form.width);
  frame.title.height = form.titleHeight;
  frame.title.width = Math.max(0, Math.min(160, form.width - 30));
  let labelY = full ? 37 + form.titleHeight - 16 : 18;
  for (let row = 0; row < 3; row++) {
    const label = frame.labels[row]; const bar = frame.bars[row];
    label.y = labelY; label.height = form.labelHeights[row];
    label.width = Math.max(0, form.width - 30);
    bar.y = label.y + label.height + (full ? 8 : 5);
    const count = row === 0 ? 3 : 5;
    bar.height = Math.ceil(count / form.columns[row]) * (form.optionHeights[row] + 3) + 3;
    labelY = bar.y + bar.height + (full ? 15 : 7);
  }
  frame.directionChoices = measuredSettingsChoices(3, form.columns[0], p, frame.bars[0].width, form.optionHeights[0]);
  frame.pageChoices = measuredSettingsChoices(5, form.columns[1], p, frame.bars[1].width, form.optionHeights[1]);
  frame.timeoutChoices = measuredSettingsChoices(5, form.columns[2], p, frame.bars[2].width, form.optionHeights[2]);
  frame.screenHeight = Math.max(258, frame.bars[2].y + frame.bars[2].height + 20);
  // Extra groups share the Full natural rows during the same morph; no second tree.
  const fullFrame = full ? frame : measuredSettingsEndpoint(added, true, added);
  const titleY = 21;
  const rowY = titleY + added.addedTitleHeight + 6;
  const statusHeight = rowY + 3 * added.toggleRowHeight + 12;
  const typographyHeight = rowY + 2 * added.toggleRowHeight + 12;
  const firstGroupY = 5 + fullFrame.screenHeight;
  const groupYs = [firstGroupY, firstGroupY + statusHeight, firstGroupY + statusHeight + typographyHeight];
  const groupHeights = [statusHeight, typographyHeight, statusHeight];
  for (let index = 0; index < 3; index++) {
    frame.groups[index].y = groupYs[index] + (full ? 0 : 14 + 4 * index);
    frame.groups[index].height = groupHeights[index];
  }
  frame.children[1].height = added.addedTitleHeight;
  for (let row = 0; row < 3; row++) {
    frame.children[2 + row].y = rowY + row * added.toggleRowHeight + (full ? 0 : 24 + 3 * row);
    frame.children[2 + row].height = added.toggleRowHeight;
  }
  frame.toggleLabelHeight = added.toggleLabelHeight;
  frame.contentHeight = full ? groupYs[2] + statusHeight : Math.max(190, frame.bars[2].y + frame.bars[2].height + 5);
  return frame;
}
function measuredSettingsChoices(count: number, columns: number, p: number, width: number,
  height: number): ReaderControlActorFrame[] {
  const result: ReaderControlActorFrame[] = [];
  for (let index = 0; index < count; index++) {
    if (columns === count) {
      const original = readerControlSettingsChoice(count, index, p, width);
      original.height = height; result.push(original);
    } else {
      const cellWidth = Math.max(0, (width - 6 - 3 * (columns - 1)) / columns);
      result.push(actor(3 + index % columns * (cellWidth + 3), 3 + Math.floor(index / columns) * (height + 3), cellWidth, height));
    }
  }
  return result;
}
function sampleMeasuredSettings(p: number, minimum: ReaderControlSettingsMinimumProfile): ReaderControlSettingsFrame {
  const q = measuredSettingsEndpoint(minimum.quick, false, minimum.full);
  const f = measuredSettingsEndpoint(minimum.full, true, minimum.full);
  const current = sampleReaderControlSettings(p, lerp(minimum.quick.width, minimum.full.width, unit(p)));
  current.title = sample(q.title, f.title, p);
  current.screenHeight = lerp(q.screenHeight, f.screenHeight, unit(p));
  current.contentHeight = lerp(q.contentHeight, f.contentHeight, unit(p));
  current.toggleLabelHeight = lerp(q.toggleLabelHeight, f.toggleLabelHeight, unit(p));
  for (let row = 0; row < 3; row++) {
    current.labels[row] = sample(q.labels[row], f.labels[row], p);
    current.bars[row] = sample(q.bars[row], f.bars[row], p);
    current.groups[row] = sample(q.groups[row], f.groups[row], p);
  }
  for (let i = 0; i < 3; i++) current.directionChoices[i] = sample(q.directionChoices[i], f.directionChoices[i], p);
  for (let i = 0; i < 5; i++) {
    current.pageChoices[i] = sample(q.pageChoices[i], f.pageChoices[i], p);
    current.timeoutChoices[i] = sample(q.timeoutChoices[i], f.timeoutChoices[i], p);
    current.children[i] = sample(q.children[i], f.children[i], p);
  }
  return current;
}
