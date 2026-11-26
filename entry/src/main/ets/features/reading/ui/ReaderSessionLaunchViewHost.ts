import type { UIContext } from '@ohos.arkui.UIContext';
import type { ReaderSessionLaunchTransaction } from './ReaderSessionLaunchController';

export interface ReaderSessionLaunchViewHost {
  read(): ReaderSessionLaunchTransaction | undefined;
  publish(launch: ReaderSessionLaunchTransaction): void;
  ready(): boolean;
  layoutCurrent(): boolean;
  retireForLayout(): void;
  context(): UIContext;
  observing(): boolean;
  drainPageTurn(): void;
  hideControl(): void;
  updateWindow(): void;
  viewportRevision(): number;
  reducedMotion(): boolean;
  stageOpacity(): number;
  setStageOpacity(opacity: number): void;
  finalizeFooter(): void;
  finish(released?: ReaderSessionLaunchTransaction): void;
}
