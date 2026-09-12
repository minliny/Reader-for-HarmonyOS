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
export const startProgrammatic: (componentId: string, generation: number, direction: number, rapid?: boolean) => boolean;
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
