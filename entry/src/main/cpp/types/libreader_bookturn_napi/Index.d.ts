export const configure: (componentId: string, widthVp: number, heightVp: number) => boolean;
export const isReady: (componentId: string) => boolean;
export const readyMask: (componentId: string) => number;
export const canStart: (componentId: string, direction: number) => boolean;
export const uploadTexture: (
  componentId: string,
  slot: number,
  pixelMap: object,
  identity: string,
  canPublish: () => boolean,
) => Promise<boolean>;
export const updateInput: (
  componentId: string,
  generation: number,
  direction: number,
  verticalPrevious: boolean,
  widthVp: number,
  heightVp: number,
  startX: number,
  startY: number,
  pointerX: number,
  pointerY: number,
  eventTimeMs: number,
) => boolean;
export const endGesture: (
  componentId: string,
  generation: number,
  direction: number,
  verticalPrevious: boolean,
  widthVp: number,
  heightVp: number,
  startX: number,
  startY: number,
  pointerX: number,
  pointerY: number,
  eventTimeMs: number,
  commit: boolean,
) => boolean;
export interface BookTurnRegrabFrame { generation: number; edgeX: number; edgeY: number; theta: number; }
export const regrab: (
  componentId: string,
  generation: number,
  direction: number,
  verticalPrevious: boolean,
  widthVp: number,
  heightVp: number,
  startX: number,
  startY: number,
  pointerX: number,
  pointerY: number,
  eventTimeMs: number,
  previousGeneration: number,
) => BookTurnRegrabFrame | undefined;
export const settle: (componentId: string, generation: number, commit: boolean) => boolean;
/** profile: 0 manual (320ms), 1 rapid manual (30ms), 2 automatic (500ms).
 *  Automatic first-buffer event detail supplies the reveal-confirmation token. */
export const startProgrammatic: (componentId: string, generation: number, direction: number, profile?: number) => boolean;
/** Starts a primed automatic turn after its generation/token-matched ArkUI
 *  reveal request. Accepted duplicates do not restart the clock. */
export const startAutomaticTimeline: (componentId: string, generation: number, surfaceToken: number) => boolean;
export const commitSlots: (componentId: string, generation: number, direction: number) => boolean;
/** ArkUI presentation barrier: hold the committed terminal frame until the
 *  promoted content is confirmed composited (releaseTerminalFrame). */
export const retainTerminalFrame: (componentId: string, generation: number) => boolean;
export const releaseTerminalFrame: (componentId: string, generation: number) => boolean;
/** Clear the EGL surface after ArkUI has hidden the XComponent for this
 * generation. Release and clear are intentionally separate operations. */
export const clearSurface: (componentId: string, generation: number) => boolean;
export const retainedTerminalGeneration: (componentId: string) => number;
export const committedSlotsGeneration: (componentId: string) => number;
export const completedTerminalGeneration: (componentId: string) => number;
export const setEventCallback: (
  componentId: string,
  callback: (event: number, generation: number, detail: number) => void,
) => boolean;

export const setDynamicHighlights: (componentId: string, identity: string, values: number[]) => boolean;
