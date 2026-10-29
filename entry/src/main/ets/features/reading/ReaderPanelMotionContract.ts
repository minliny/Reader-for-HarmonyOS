/** Panel-specific actor pose. MotionSpec owns duration, curve and reduceMotion;
 * this contract owns the authored displacement and entry delay. */
export interface ReaderPanelActorPose {
  fromY: number;
  delayMs: number;
}

export const READER_PANEL_APPEARANCE_ACTORS: Record<string, ReaderPanelActorPose> = {
  'reader.panel.appearance.surface.in': { fromY: 0, delayMs: 128 },
  'reader.panel.appearance.content.in': { fromY: 0, delayMs: 146 },
  'reader.panel.appearance.header.in': { fromY: -12, delayMs: 146 },
  'reader.panel.appearance.theme.in': { fromY: 0, delayMs: 146 },
  'reader.panel.appearance.font.in': { fromY: 0, delayMs: 175 },
  'reader.panel.appearance.typography.in': { fromY: 0, delayMs: 256 },
};

export function readerPanelActorPose(id: string): ReaderPanelActorPose | undefined {
  return READER_PANEL_APPEARANCE_ACTORS[id];
}
