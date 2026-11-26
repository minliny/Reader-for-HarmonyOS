import { readBookshelfFileDrop, type BookshelfFileDrop } from '../application/BookshelfFileDrop';

export function showBookshelfFileDropFeedback(event: DragEvent, enabled: boolean): boolean {
  const accepted = enabled && !event.isRemote();
  event.dragBehavior = DragBehavior.COPY;
  event.setResult(accepted ? DragResult.DROP_ENABLED : DragResult.DROP_DISABLED);
  return accepted;
}

export function dispatchBookshelfFileDrop(event: DragEvent, enabled: boolean, reduceMotion: boolean,
  submit: (drop: BookshelfFileDrop) => boolean): void {
  if (reduceMotion) event.useCustomDropAnimation = true;
  event.dragBehavior = DragBehavior.COPY;
  if (!enabled || event.isRemote()) {
    event.setResult(DragResult.DRAG_FAILED);
    return;
  }
  let drop: BookshelfFileDrop = { uris: [], failure: 'noLocalFile' };
  try {
    drop = readBookshelfFileDrop(event.getData().getRecords());
  } catch (_) {
    // The current shelf presents the scoped unreadable-file feedback.
  }
  event.setResult(submit(drop) ? DragResult.DRAG_SUCCESSFUL : DragResult.DRAG_FAILED);
}
