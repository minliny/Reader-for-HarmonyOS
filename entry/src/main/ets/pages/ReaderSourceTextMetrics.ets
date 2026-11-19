interface SourceTextLine {
  start: number;
  end: number;
  leftPx: number;
  topPx: number;
  widthPx: number;
  heightPx: number;
  baselinePx: number;
}

interface SourceTextLabelMetrics {
  role: string;
  lines: SourceTextLine[];
}

/** Optional controllers for mounted labels in the in-memory Source fixture. */
export class ReaderSourceTextMetrics {
  private readonly sourceId: string;
  private readonly labels: Map<string, TextOptions> = new Map();

  constructor(sourceId: string) { this.sourceId = sourceId; }

  readonly options = (role: string, sourceId?: string): TextOptions | undefined => {
    if (sourceId !== undefined && sourceId !== this.sourceId) return undefined;
    const current = this.labels.get(role);
    if (current !== undefined) return current;
    const options: TextOptions = { controller: new TextController() };
    this.labels.set(role, options);
    return options;
  };

  read(): SourceTextLabelMetrics[] {
    const labels: SourceTextLabelMetrics[] = [];
    this.labels.forEach((options: TextOptions, role: string): void => {
      const lines: SourceTextLine[] = [];
      try {
        const layout = options.controller.getLayoutManager();
        const count = layout.getLineCount();
        for (let index = 0; index < count; index += 1) {
          const line = layout.getLineMetrics(index);
          lines.push({ start: line.startIndex, end: line.endIndex, leftPx: line.left, topPx: line.topHeight,
            widthPx: line.width, heightPx: line.height, baselinePx: line.baseline });
        }
      } catch (_unavailable) {
        // An unmounted or retired Text cannot supply a measurement.
        lines.length = 0;
      }
      labels.push({ role, lines });
    });
    return labels;
  }
}
