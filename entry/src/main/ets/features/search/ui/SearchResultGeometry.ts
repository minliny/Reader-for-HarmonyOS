/** Search-result density, referenced to the approved 390-wide demo.
 * Consumers receive the available content width, not the full window width. */
export class SearchResultGeometry {
  readonly outerInset: number = 20;
  readonly coverToContent: number = 67 / 350;
  readonly coverAspect: number = 1.5;
  readonly columnGap: number = 12;
  readonly rowPadding: number = 14;
  readonly metadataGap: number = 4;
  readonly footerGap: number = 6;
  readonly filterIconSize: number = 20;
  readonly filterActionSize: number = 44;

  coverWidth(contentWidth: number, expandedLayout: boolean): number {
    const width = Number.isFinite(contentWidth) ? Math.max(0, contentWidth) : 0;
    return Math.min(expandedLayout ? 80 : 67, width * this.coverToContent);
  }

}

export const SEARCH_RESULT_GEOMETRY: SearchResultGeometry = new SearchResultGeometry();
