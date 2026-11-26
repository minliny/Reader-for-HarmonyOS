import { ReadingSurfacePageFragment } from './ReadingSurface';
import { ReadingSurfaceLayoutMap } from '../application/ReadingSurfaceLayoutMap';
import { ReadingPaginationKey, ReadingPaginationPrefixObservation } from '../application/ReadingPaginationIndex';
import { ReaderAppearanceSnapshot } from '../application/ReaderAppearanceState';

export { MeasuredReadingLine, ParagraphRange } from '../application/ReadingMeasurementFacts';

/**
 * A bounded paragraph submitted to the native Text measurement owner.
 * It is discarded after the line metrics have been copied into first-page
 * fragments, keeping real long chapters bounded by the batch limits below.
 */
export class MeasurementParagraph {
  nativeMeasured: boolean = false;
  id: string;
  rangeIndex: number;
  text: string;
  chapterStartScalar: number;
  layoutMap: ReadingSurfaceLayoutMap;
  controller: TextController;
  isParagraphStart: boolean;
  /** Absolute resume target; shaping always receives the complete paragraph. */
  requestedStartScalar: number;

  constructor(
    id: string,
    rangeIndex: number,
    text: string,
    chapterStartScalar: number,
    layoutMap: ReadingSurfaceLayoutMap,
    controller: TextController,
    isParagraphStart: boolean,
    requestedStartScalar: number,
  ) {
    this.id = id;
    this.rangeIndex = rangeIndex;
    this.text = text;
    this.chapterStartScalar = chapterStartScalar;
    this.layoutMap = layoutMap;
    this.controller = controller;
    this.isParagraphStart = isParagraphStart;
    this.requestedStartScalar = requestedStartScalar;
  }
}

export class PhysicalReadingPage {
  fragments: ReadingSurfacePageFragment[];
  startScalar: number;
  endScalar: number;
  contentHeight: number;
  bodyCapacity: number;
  measuredAppearance: ReaderAppearanceSnapshot | undefined;
  // Written once by the accepted measurement, before publication. Keep the
  // original request even after a complete chapter index replaces its draft.
  paginationKey: ReadingPaginationKey | undefined = undefined;
  paginationObservation: ReadingPaginationPrefixObservation | undefined = undefined;

  constructor(
    fragments: ReadingSurfacePageFragment[],
    startScalar: number,
    endScalar: number,
    contentHeight: number,
    bodyCapacity: number,
    measuredAppearance?: ReaderAppearanceSnapshot,
  ) {
    this.fragments = fragments;
    this.startScalar = startScalar;
    this.endScalar = endScalar;
    this.contentHeight = contentHeight;
    this.bodyCapacity = bodyCapacity;
    this.measuredAppearance = measuredAppearance;
  }
}
