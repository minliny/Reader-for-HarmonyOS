export const configure: (componentId: string, widthVp: number, heightVp: number) => boolean;
export const isReady: (componentId: string) => boolean;
export const readyMask: (componentId: string) => number;
export const canStart: (componentId: string, direction: number) => boolean;
export const uploadTexture: (
  componentId: string,
  slot: number,
  pixelMap: object,
  identity: string,
) => boolean;
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
  edgeX: number,
  edgeY: number,
  velocityX: number,
  eventTimeMs: number,
) => boolean;
export const settle: (componentId: string, generation: number, commit: boolean) => boolean;
export const startProgrammatic: (componentId: string, generation: number, direction: number) => boolean;
export const commitSlots: (componentId: string, generation: number, direction: number) => boolean;
export const setEventCallback: (
  componentId: string,
  callback: (event: number, generation: number, detail: number) => void,
) => boolean;
